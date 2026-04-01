export interface PAParameters {
  id?: string;
  store_id: string;
  pa_inicial: number;
  incremento_pa: number;
  valor_base: number;
  incremento_valor: number;
  criado_por_role?: string;
  criado_por_id?: string;
  updated_at?: string;
  created_at?: string;
}

export interface PAWeek {
  id: string;
  store_id: string;
  data_inicio: string;
  data_fim: string;
  mes_ref: number;
  ano_ref: number;
  status: 'aberta' | 'fechada';
  liberada_por?: string;
  liberada_em?: string;
  created_at?: string;
}

export interface PASale {
  id: string;
  semana_id: string;
  store_id: string;
  cod_vendedor: string;
  nome_vendedor: string;
  dias_trabalhados?: number;
  qtde_vendas?: number;
  perc_vendas?: string;
  qtde_itens?: number;
  perc_itens?: string;
  pa: number;
  total_vendas: number;
  perc_total?: string;
  importado_por?: string;
  importado_em?: string;
  // Campos vindos do JOIN com Premiacoes:
  atingiu_meta?: boolean;
  valor_premio?: number;
  faixas_acima?: number;
  pa_atingido?: number;
  pa_meta?: number;
}

export interface PAStoreSummary {
  store_id: string;
  store_name: string;
  total_sales: number;
  avg_pa: number;
  eligible_sellers: number;
  total_awards: number;
}
