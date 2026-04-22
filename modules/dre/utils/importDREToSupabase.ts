import { supabase } from '@/services/supabaseClient';
import type { DREData } from '../types/dre.types';

interface ImportResult {
  success: boolean;
  error?: string;
  count?: number;
}

export const importDREToSupabase = async (
  records: DREData[],
  onProgress: (progress: number, message: string) => void
): Promise<ImportResult> => {
  if (records.length === 0) {
    return { success: false, error: 'Lista de registros vazia' };
  }

  try {
    // 1. Identificar Lojas e Períodos para Limpeza
    const periods = Array.from(new Set(records.map(r => r.mes_referencia)));
    const storeIds = Array.from(new Set(records.map(r => r.loja_id)));

    if (periods.length > 0 && storeIds.length > 0) {
      onProgress(5, 'Limpando dados antigos...');
      const { error: deleteError } = await supabase
        .from('dre_data')
        .delete()
        .in('mes_referencia', periods)
        .in('loja_id', storeIds);
      
      if (deleteError) {
        console.warn('Aviso ao limpar dados antigos:', deleteError);
      }
    }

    // 2. Criar Master Import Record na tabela pai (dre_imports) 
    // para evitar erro de Foreign Key (FK)
    const importId = crypto.randomUUID();
    
    onProgress(10, 'Registrando lote de importação...');
    const { error: importError } = await supabase
      .from('dre_imports')
      .insert([{ 
        id: importId, 
        created_at: new Date().toISOString()
      }]);

    if (importError) {
      console.warn('Aviso ao criar registro em dre_imports:', importError);
      // Se falhar e a FK for obrigatória, o próximo passo falhará com o erro que o usuário relatou
    }

    const batchSize = 100;
    const total = records.length;
    const batches = Math.ceil(total / batchSize);

    for (let i = 0; i < batches; i++) {
      const batch = records.slice(i * batchSize, (i + 1) * batchSize).map(r => ({
        ...r,
        import_id: importId
      }));

      const currentProgress = Math.round(((i + 1) / batches) * 100);
      onProgress(currentProgress, `Salvando lote ${i + 1} de ${batches}...`);

      const { error } = await supabase
        .from('dre_data')
        .insert(batch);

      if (error) throw error;
    }

    onProgress(100, 'Importação concluída com sucesso!');
    return { success: true, count: records.length };

  } catch (err: any) {
    console.error('Erro na importação:', err);
    return { 
      success: false, 
      error: err.message || 'Erro deconhecido ao salvar no banco' 
    };
  }
};
