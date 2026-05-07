import { supabase } from '@/services/supabaseClient';
import type { 
  DREData, 
  DREParameters, 
  DREAnomaly, 
  Sazonalidade, 
  ResumoMensal,
  StatusCotaView,
  ComparativoMoM,
  RankingLoja,
  AlertaAtivo,
  EvolucaoTemporal
} from '../types/dre.types';

/**
 * Funções para manipular dados do DRE no Supabase
 */

// CRUD DRE_DATA
export async function getDREDataByPeriodo(
  periodoInicio: string,
  periodoFim: string,
  lojaIds?: number[]
): Promise<DREData[]> {
  let query = supabase
    .from('dre_data')
    .select('*')
    .gte('mes_referencia', periodoInicio)
    .lte('mes_referencia', periodoFim);

  if (lojaIds && lojaIds.length > 0) {
    query = query.in('loja_id', lojaIds);
  }

  const { data, error } = await query
    .order('loja_id', { ascending: true })
    .order('mes_referencia', { ascending: true });

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

/**
 * Busca a lista de contas únicas presentes no banco de dados
 */
export async function getContasDisponiveis() {
  const { data, error } = await supabase
    .from('view_dre_contas_disponiveis')
    .select('*')
    .order('grupo', { ascending: true })
    .order('descricao', { ascending: true });

  if (error && error.code !== 'PGRST116') {
     console.warn('View view_dre_contas_disponiveis não encontrada. Certifique-se de executar as migrações SQL.');
     // Fallback: Tenta buscar direto da tabela se a view falhar (pode ser lento)
     const { data: fallback, error: err2 } = await supabase
       .from('dre_data')
       .select('descricao, grupo')
       .order('grupo')
       .order('descricao');
     
     if (err2) throw err2;
     
     // Unique descriptions
     const unique = fallback?.reduce((acc: any[], curr) => {
       if (!acc.find(x => x.descricao === curr.descricao)) {
         acc.push({ ...curr, lojas_com_dados: 0, total_registros: 1 });
       }
       return acc;
     }, []);
     return unique || [];
  }
  
  if (error) throw error;
  return data || [];
}

/**
 * Busca apenas as lojas que possuem dados DRE importados
 */
export async function getLojasComDadosDRE() {
  const { data, error } = await supabase
    .from('view_dre_lojas_disponiveis')
    .select('*')
    .order('loja_id', { ascending: true });
  
  if (error) {
    console.error('Erro ao coletar lojas com dados DRE:', error);
    return [];
  }
  
  return data?.map(loja => ({
    id: loja.loja_id,
    numero: loja.loja_id,
    nome: loja.nome_loja || `Loja ${loja.loja_id}`,
    cidade: loja.cidade,
    mesesComDados: loja.meses_com_dados,
    totalRegistros: loja.total_registros,
    periodo: `${loja.primeiro_mes} até ${loja.ultimo_mes}`
  })) || [];
}

/**
 * BI: Busca os alertas ativos da visão consolidada
 */
export async function getAlertasAtivos(limit = 10): Promise<AlertaAtivo[]> {
  const { data, error } = await supabase
    .from('view_dre_alertas_ativos')
    .select('*')
    .limit(limit);
  
  if (error) {
    console.error('Erro ao buscar alertas ativos:', error);
    return [];
  }
  return data || [];
}

/**
 * BI: Marcar um alerta como resolvido
 */
export async function resolverAlerta(alertaId: string) {
  const { error } = await supabase
    .from('dre_alertas')
    .update({ status: 'resolvido', resolvido_em: new Date().toISOString() })
    .eq('id', alertaId);
  
  if (error) throw error;
}

/**
 * BI: Top 10 maiores despesas por loja e mês
 */
export async function getTopDespesas(lojaId: number, mesReferencia: string, limit = 10) {
  const { data, error } = await supabase
    .from('dre_data')
    .select('descricao, valor, grupo')
    .eq('loja_id', lojaId)
    .eq('mes_referencia', mesReferencia)
    .not('descricao', 'ilike', '%VENDA%')
    .not('descricao', 'ilike', '%RECEBI%')
    .order('valor', { ascending: false })
    .limit(limit);
  
  if (error) throw error;
  return data || [];
}

/**
 * BI: Evolução temporal de uma conta específica
 */
export async function getEvolucaoTemporal(lojaId: number, descricao: string): Promise<EvolucaoTemporal[]> {
  const { data, error } = await supabase
    .from('view_dre_evolucao_temporal')
    .select('*')
    .eq('loja_id', lojaId)
    .eq('descricao', descricao)
    .order('mes_referencia', { ascending: true });
  
  if (error) throw error;
  return data || [];
}

/**
 * BI: Busca todos os resumos mensais para o Heatmap
 */
export async function getAllResumosMensais(): Promise<ResumoMensal[]> {
  const { data, error } = await supabase
    .from('view_dre_resumo_mensal')
    .select('*')
    .order('loja_id', { ascending: true })
    .order('mes_referencia', { ascending: true });
  
  if (error) throw error;
  return data || [];
}
