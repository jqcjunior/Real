import { supabase } from '../../services/supabaseClient';

/**
 * 🗓️ SISTEMA DE GESTÃO SEMANAL P.A - REDE REAL
 * 
 * REGRAS:
 * - Semana comercial: Sábado a Sexta
 * - Pagamento: Próximo Sábado
 * - Feriados: Desconsiderar (loja fechada)
 * - Auto-criação: Na última sexta, criar próximas 4 semanas
 */

interface WeekConfig {
  store_id: string;
  data_inicio: string;  // YYYY-MM-DD (sábado)
  data_fim: string;     // YYYY-MM-DD (sexta-feira)
  mes_ref: number;      // Mês do data_inicio
  ano_ref: number;
  status: 'aberta' | 'importada' | 'bloqueada' | 'reaberta' | 'recibos_impressos';
}

interface ValidationResult {
  valid: boolean;
  week_id?: string;
  error?: string;
  warning?: string;
}

// ====================================
// 📅 FUNÇÕES DE DATA
// ====================================

/**
 * Obtém o próximo sábado a partir de uma data
 */
export const getNextSaturday = (date: Date): Date => {
  const result = new Date(date);
  const day = result.getDay();
  // Sunday (0), Monday (1), ..., Friday (5), Saturday (6)
  // Se for sábado (6), queremos o PRÓXIMO sábado (+7)
  const diff = (6 - day + 7) % 7 || 7;
  result.setDate(result.getDate() + diff);
  return result;
};

/**
 * Obtém a sexta-feira da mesma semana (Sábado + 6 dias)
 */
export const getFriday = (saturday: Date): Date => {
  const result = new Date(saturday);
  result.setDate(result.getDate() + 6);
  return result;
};

/**
 * Formata Date para string YYYY-MM-DD (sem deslocamento de fuso horário)
 */
export const formatDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Verifica se hoje é sexta-feira
 */
export const isFriday = (): boolean => {
  return new Date().getDay() === 5;
};

/**
 * Gera as próximas N semanas a partir de uma data de início (Sábado)
 */
export const generateNextWeeks = (startSaturday: Date, count: number): Array<{ start: string, end: string }> => {
  const weeks = [];
  let current = new Date(startSaturday);
  
  for (let i = 0; i < count; i++) {
    const saturday = new Date(current);
    const friday = getFriday(saturday);
    
    weeks.push({
      start: formatDate(saturday),
      end: formatDate(friday)
    });
    
    // Próxima semana (sábado + 7 dias)
    current.setDate(current.getDate() + 7);
  }
  
  return weeks;
};

// ====================================
// 🔍 VALIDAÇÃO DE DATAS
// ====================================

/**
 * Valida se uma data pertence a uma semana cadastrada
 */
export const validateSaleDate = async (
  storeId: string,
  saleDate: string // YYYY-MM-DD
): Promise<ValidationResult> => {
  try {
    const { data: weeks, error } = await supabase
      .from('Dashboard_PA_Semanas')
      .select('id, data_inicio, data_fim, status')
      .eq('store_id', storeId)
      .lte('data_inicio', saleDate)
      .gte('data_fim', saleDate);
    
    if (error) {
      return {
        valid: false,
        error: `Erro ao buscar semana: ${error.message}`
      };
    }
    
    if (!weeks || weeks.length === 0) {
      return {
        valid: false,
        error: `Data ${saleDate} não pertence a nenhuma semana cadastrada`
      };
    }
    
    const week = weeks[0];
    
    if (week.status === 'bloqueada') {
      return {
        valid: false,
        error: `Semana ${week.data_inicio} a ${week.data_fim} está BLOQUEADA`
      };
    }
    
    return {
      valid: true,
      week_id: week.id
    };
    
  } catch (err: any) {
    return {
      valid: false,
      error: `Erro na validação: ${err.message}`
    };
  }
};

// ====================================
// 🤖 AUTO-GERAÇÃO DE SEMANAS
// ====================================

/**
 * Verifica se já existem semanas futuras cadastradas
 */
export const checkFutureWeeks = async (storeId: string, fromDate: string): Promise<number> => {
  const { data, error } = await supabase
    .from('Dashboard_PA_Semanas')
    .select('id')
    .eq('store_id', storeId)
    .gte('data_inicio', fromDate);
  
  if (error) {
    console.error('Erro ao verificar semanas futuras:', error);
    return 0;
  }
  
  return data?.length || 0;
};

/**
 * Cria semanas para uma loja específica
 */
export const createWeeksForStore = async (
  storeId: string,
  weeks: Array<{ start: string, end: string }>
): Promise<{ success: boolean; count: number; error?: string }> => {
  try {
    const weeksToInsert: WeekConfig[] = weeks.map(week => {
      const startDate = new Date(week.start + 'T00:00:00');
      
      return {
        store_id: storeId,
        data_inicio: week.start,
        data_fim: week.end,
        mes_ref: startDate.getMonth() + 1, // 1-12
        ano_ref: startDate.getFullYear(),
        status: 'aberta'
      };
    });
    
    const { error } = await supabase
      .from('Dashboard_PA_Semanas')
      .insert(weeksToInsert);
    
    if (error) {
      console.error('Erro ao inserir semanas:', error);
      return {
        success: false,
        count: 0,
        error: error.message
      };
    }
    
    return {
      success: true,
      count: weeksToInsert.length
    };
    
  } catch (err: any) {
    return {
      success: false,
      count: 0,
      error: err.message
    };
  }
};

/**
 * 🚀 FUNÇÃO PRINCIPAL - Auto-gera próximas 4 semanas se necessário
 */
export const autoGenerateWeeksIfNeeded = async (
  storeIds: string[]
): Promise<{ totalCreated: number; errors: string[] }> => {
  const results = {
    totalCreated: 0,
    errors: [] as string[]
  };
  
  if (!isFriday()) return results;
  
  const now = new Date();
  const nextSaturday = getNextSaturday(now);
  const nextWeeks = generateNextWeeks(nextSaturday, 4);
  
  for (const storeId of storeIds) {
    try {
      const futureCount = await checkFutureWeeks(storeId, formatDate(nextSaturday));
      
      if (futureCount >= 4) continue;
      
      const result = await createWeeksForStore(storeId, nextWeeks);
      
      if (result.success) {
        results.totalCreated += result.count;
      } else {
        results.errors.push(`Loja ${storeId}: ${result.error}`);
      }
    } catch (err: any) {
      results.errors.push(`Loja ${storeId}: ${err.message}`);
    }
  }
  
  return results;
};

// ====================================
// 📊 CRIAÇÃO MANUAL DE SEMANAS
// ====================================

/**
 * Interface para criação manual (para o Admin)
 */
export const createWeeksManually = async (
  storeIds: string[],
  startDate: string, // YYYY-MM-DD (deve ser sábado)
  weekCount: number = 4
): Promise<{ success: boolean; totalCreated: number; errors: string[] }> => {
  const results = {
    success: true,
    totalCreated: 0,
    errors: [] as string[]
  };
  
  const start = new Date(startDate + 'T00:00:00');
  if (start.getDay() !== 6) {
    return {
      success: false,
      totalCreated: 0,
      errors: [`${startDate} não é um sábado`]
    };
  }
  
  const weeks = generateNextWeeks(start, weekCount);
  
  for (const storeId of storeIds) {
    const result = await createWeeksForStore(storeId, weeks);
    
    if (result.success) {
      results.totalCreated += result.count;
    } else {
      results.success = false;
      results.errors.push(`Loja ${storeId}: ${result.error}`);
    }
  }
  
  return results;
};

// ====================================
// 🛡️ VALIDAÇÃO EM LOTE
// ====================================

export const validateSaleDates = async (
  storeId: string,
  dates: string[]
): Promise<{
  valid: string[];
  invalid: Array<{ date: string; error: string }>;
  warnings: Array<{ date: string; message: string }>;
  weekIds: Map<string, string>;
}> => {
  const results = {
    valid: [] as string[],
    invalid: [] as Array<{ date: string; error: string }>,
    warnings: [] as Array<{ date: string; message: string }>,
    weekIds: new Map<string, string>()
  };
  
  for (const date of dates) {
    const validation = await validateSaleDate(storeId, date);
    
    if (validation.valid) {
      results.valid.push(date);
      if (validation.week_id) {
        results.weekIds.set(date, validation.week_id);
      }
    } else {
      results.invalid.push({
        date,
        error: validation.error || 'Erro desconhecido'
      });
    }
  }
  
  return results;
};
