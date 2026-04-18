import { supabase } from '../../../services/supabaseClient';
import type { 
  DREData, 
  DREParameters, 
  DREAnomaly, 
  Sazonalidade, 
  ResumoMensal,
  StatusCotaView,
  ComparativoMoM,
  RankingLoja
} from '../types/dre.types';

/**
 * Funções para manipular dados do DRE no Supabase
 */

// CRUD DRE_DATA
export async function getDREDataByPeriodo(
  periodoInicio: string,
  periodoFim: string,
  lojaIds: number[]
): Promise<DREData[]> {
  const { data, error } = await supabase
    .from('dre_data')
    .select('*')
    .in('loja_id', lojaIds)
    .gte('mes_referencia', periodoInicio)
    .lte('mes_referencia', periodoFim);

  if (error) throw error;
  return data || [];
}

export async function insertDREData(lotes: DREData[]) {
  const { error } = await supabase
    .from('dre_data')
    .insert(lotes);

  if (error) throw error;
}

// CRUD DRE_PARAMETERS
export async function upsertDREParameters(parametros: DREParameters) {
  const { error } = await supabase
    .from('dre_parameters')
    .upsert(parametros, { 
      onConflict: 'loja_id, descricao, periodo_inicio, periodo_fim' 
    });

  if (error) throw error;
}

export async function getDREParameters(lojaId: number, descricao: string): Promise<DREParameters | null> {
  const { data, error } = await supabase
    .from('dre_parameters')
    .select('*')
    .eq('loja_id', lojaId)
    .eq('descricao', descricao)
    .order('updated_at', { ascending: false })
    .limit(1)
    .single();

  if (error && error.code !== 'PGRST116') throw error; // PGRST116 is code for 0 rows returned
  return data;
}

// CRUD DRE_ANOMALIES
export async function insertAnomalies(anomalias: DREAnomaly[]) {
  const { error } = await supabase
    .from('dre_anomalies')
    .insert(anomalias);

  if (error) throw error;
}

export async function getAnomalies(mesReferencia: string, lojaIds?: number[]): Promise<DREAnomaly[]> {
  let query = supabase
    .from('dre_anomalies')
    .select('*')
    .eq('mes_referencia', mesReferencia);
  
  if (lojaIds && lojaIds.length > 0) {
    query = query.in('loja_id', lojaIds);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

// CRUD SAZONALIDADES
export async function getSazonalidades(): Promise<Sazonalidade[]> {
  const { data, error } = await supabase
    .from('dre_sazonalidade')
    .select('*');

  if (error) throw error;
  return data || [];
}

// VIEWS - RANKING, COMPARATIVO, RESUMO
export async function getResumoMensal(mesReferencia: string, lojaIds?: number[]): Promise<ResumoMensal[]> {
  let query = supabase
    .from('view_dre_resumo_mensal')
    .select('*')
    .eq('mes_referencia', mesReferencia);

  if (lojaIds && lojaIds.length > 0) {
    query = query.in('loja_id', lojaIds);
  }

  const { data, error } = await query;
  // Note: views are handled as tables in supabase-js
  if (error) throw error;
  return (data as any) || [];
}

export async function getStatusCota(mesReferencia: string, lojaIds?: number[]): Promise<StatusCotaView[]> {
  let query = supabase
    .from('view_dre_cotas_status')
    .select('*')
    .eq('mes_referencia', mesReferencia);

  if (lojaIds && lojaIds.length > 0) {
    query = query.in('loja_id', lojaIds);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data as any) || [];
}

export async function getComparativo(mesAtual: string, lojaIds?: number[]): Promise<ComparativoMoM[]> {
  let query = supabase
    .from('view_dre_comparativo_mom')
    .select('*')
    .eq('mes_atual', mesAtual);

  if (lojaIds && lojaIds.length > 0) {
    query = query.in('loja_id', lojaIds);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data as any) || [];
}

export async function getRanking(mesReferencia: string): Promise<RankingLoja[]> {
  const { data, error } = await supabase
    .from('view_ranking_lojas')
    .select('*')
    .eq('mes_referencia', mesReferencia);

  if (error) throw error;
  return (data as any) || [];
}
