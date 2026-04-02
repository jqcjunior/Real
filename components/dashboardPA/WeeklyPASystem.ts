import { supabase } from '../../services/supabaseClient';

/**
 * 🗓️ SISTEMA DE GESTÃO SEMANAL P.A - REDE REAL
 * 
 * REGRAS:
 * - Semana comercial: Segunda a Sexta (+ Domingo se loja abrir)
 * - Sábado: Vendas contam para PRÓXIMA semana
 * - Feriados: Desconsiderar (loja fechada)
 * - Auto-criação: Na última sexta, criar próximas 4 semanas
 */

interface WeekConfig {
  store_id: string;
  data_inicio: string;  // YYYY-MM-DD (segunda-feira)
  data_fim: string;     // YYYY-MM-DD (domingo)
  mes_ref: number;      // Mês do data_inicio
  ano_ref: number;
  status: 'aberta' | 'importada' | 'bloqueada' | 'reaberta';
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
 * Obtém a próxima segunda-feira a partir de uma data
 */
export const getNextMonday = (date: Date): Date => {
  const result = new Date(date);
  const day = result.getDay();
  const diff = day === 0 ? 1 : (8 - day); // Se domingo, +1; senão próxima segunda
  result.setDate(result.getDate() + diff);
  return result;
};

/**
 * Obtém o domingo da mesma semana
 */
export const getSunday = (monday: Date): Date => {
  const result = new Date(monday);
  result.setDate(result.getDate() + 6); // Segunda + 6 = Domingo
  return result;
};

/**
 * Formata Date para string YYYY-MM-DD
 */
export const formatDate = (date: Date): string => {
  return date.toISOString().split('T')[0];
};

/**
 * Verifica se hoje é sexta-feira
 */
export const isFriday = (): boolean => {
  return new Date().getDay() === 5;
};

/**
 * Verifica se uma data é sábado
 */
export const isSaturday = (dateStr: string): boolean => {
  const date = new Date(dateStr + 'T00:00:00');
  return date.getDay() === 6;
};

/**
 * Gera as próximas N semanas a partir de uma data
 */
export const generateNextWeeks = (startMonday: Date, count: number): Array<{ start: string, end: string }> => {
  const weeks = [];
  let current = new Date(startMonday);
  
  for (let i = 0; i < count; i++) {
    const monday = new Date(current);
    const sunday = getSunday(monday);
    
    weeks.push({
      start: formatDate(monday),
      end: formatDate(sunday)
    });
    
    // Próxima semana (segunda + 7 dias)
    current.setDate(current.getDate() + 7);
  }
  
  return weeks;
};

// ====================================
// 🔍 VALIDAÇÃO DE DATAS
// ====================================

/**
 * Valida se uma data pertence a uma semana cadastrada
 * Aplica regra do sábado (vai para próxima semana)
 */
export const validateSaleDate = async (
  storeId: string,
  saleDate: string // YYYY-MM-DD
): Promise<ValidationResult> => {
  try {
    const date = new Date(saleDate + 'T00:00:00');
    const dayOfWeek = date.getDay();
    
    // REGRA DO SÁBADO: Redirecionar para próxima semana
    if (dayOfWeek === 6) {
      // Buscar semana que COMEÇA após este sábado
      const nextMonday = new Date(date);
      nextMonday.setDate(date.getDate() + 2); // Sábado + 2 = Segunda
      
      const { data: nextWeek, error } = await supabase
        .from('Dashboard_PA_Semanas')
        .select('id, data_inicio, data_fim, status')
        .eq('store_id', storeId)
        .eq('data_inicio', formatDate(nextMonday))
        .single();
      
      if (error || !nextWeek) {
        return {
          valid: false,
          error: `Sábado ${saleDate}: Semana iniciando ${formatDate(nextMonday)} não cadastrada`
        };
      }
      
      if (nextWeek.status === 'bloqueada') {
        return {
          valid: false,
          error: `Sábado ${saleDate}: Próxima semana (${nextWeek.data_inicio} a ${nextWeek.data_fim}) está BLOQUEADA`
        };
      }
      
      return {
        valid: true,
        week_id: nextWeek.id,
        warning: `⚠️ Vendas de sábado ${saleDate} contam na semana ${nextWeek.data_inicio} a ${nextWeek.data_fim}`
      };
    }
    
    // Dias normais: Segunda a Domingo (exceto sábado)
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
 * Chame no useEffect do Dashboard toda sexta-feira
 */
export const autoGenerateWeeksIfNeeded = async (
  storeIds: string[]
): Promise<{ totalCreated: number; errors: string[] }> => {
  const results = {
    totalCreated: 0,
    errors: [] as string[]
  };
  
  // 1. Verificar se é sexta-feira
  if (!isFriday()) {
    console.log('⏳ Não é sexta-feira, aguardando...');
    return results;
  }
  
  console.log('✅ Sexta-feira detectada! Verificando semanas futuras...');
  
  // 2. Obter próxima segunda-feira
  const now = new Date();
  const nextMonday = getNextMonday(now);
  
  // 3. Gerar próximas 4 semanas
  const nextWeeks = generateNextWeeks(nextMonday, 4);
  
  // 4. Para cada loja, verificar e criar se necessário
  for (const storeId of storeIds) {
    try {
      // Verificar quantas semanas futuras já existem
      const futureCount = await checkFutureWeeks(storeId, formatDate(nextMonday));
      
      if (futureCount >= 4) {
        console.log(`✅ Loja ${storeId}: ${futureCount} semanas futuras já cadastradas`);
        continue;
      }
      
      // Criar semanas faltantes
      const result = await createWeeksForStore(storeId, nextWeeks);
      
      if (result.success) {
        console.log(`✅ Loja ${storeId}: ${result.count} semanas criadas`);
        results.totalCreated += result.count;
      } else {
        const errorMsg = `Loja ${storeId}: ${result.error}`;
        console.error(`❌ ${errorMsg}`);
        results.errors.push(errorMsg);
      }
      
    } catch (err: any) {
      const errorMsg = `Loja ${storeId}: ${err.message}`;
      console.error(`❌ ${errorMsg}`);
      results.errors.push(errorMsg);
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
  startDate: string, // YYYY-MM-DD (deve ser segunda-feira)
  weekCount: number = 4
): Promise<{ success: boolean; totalCreated: number; errors: string[] }> => {
  const results = {
    success: true,
    totalCreated: 0,
    errors: [] as string[]
  };
  
  // 1. Validar que é segunda-feira
  const start = new Date(startDate + 'T00:00:00');
  if (start.getDay() !== 1) {
    return {
      success: false,
      totalCreated: 0,
      errors: [`${startDate} não é uma segunda-feira`]
    };
  }
  
  // 2. Gerar semanas
  const weeks = generateNextWeeks(start, weekCount);
  
  // 3. Criar para cada loja
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

/**
 * Valida múltiplas datas de vendas de uma só vez
 * Útil ao importar planilha
 */
export const validateSaleDates = async (
  storeId: string,
  dates: string[]
): Promise<{
  valid: string[];
  invalid: Array<{ date: string; error: string }>;
  warnings: Array<{ date: string; message: string }>;
  weekIds: Map<string, string>; // date -> week_id
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
      if (validation.warning) {
        results.warnings.push({
          date,
          message: validation.warning
        });
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

// ====================================
// 📋 EXEMPLO DE USO
// ====================================

/**
 * EXEMPLO NO DASHBOARD ADMIN:
 * 
 * useEffect(() => {
 *   const checkWeeks = async () => {
 *     const storeIds = stores.map(s => s.id);
 *     const result = await autoGenerateWeeksIfNeeded(storeIds);
 *     
 *     if (result.totalCreated > 0) {
 *       toast.success(`${result.totalCreated} semanas criadas automaticamente!`);
 *     }
 *     
 *     if (result.errors.length > 0) {
 *       console.error('Erros:', result.errors);
 *     }
 *   };
 *   
 *   checkWeeks();
 * }, [stores]);
 * 
 * 
 * EXEMPLO NA IMPORTAÇÃO DE XLSX:
 * 
 * const handleImport = async (data: any[]) => {
 *   // 1. Extrair datas únicas
 *   const dates = [...new Set(data.map(row => row.data_venda))];
 *   
 *   // 2. Validar todas as datas
 *   const validation = await validateSaleDates(storeId, dates);
 *   
 *   // 3. Mostrar erros
 *   if (validation.invalid.length > 0) {
 *     alert(`Datas inválidas:\n${validation.invalid.map(i => `${i.date}: ${i.error}`).join('\n')}`);
 *     return;
 *   }
 *   
 *   // 4. Mostrar avisos (sábados)
 *   if (validation.warnings.length > 0) {
 *     const confirm = window.confirm(
 *       `Atenção:\n${validation.warnings.map(w => w.message).join('\n')}\n\nContinuar?`
 *     );
 *     if (!confirm) return;
 *   }
 *   
 *   // 5. Importar dados
 *   // ... resto da lógica
 * };
 */