export interface DREData {
  id?: string;
  loja_id: number;
  mes_referencia: string; // ISO format or YYYY-MM
  grupo: string;
  descricao: string;
  valor: number;
  created_at?: string;
}

export interface DREImport {
  id: string;
  filename: string;
  user_id: string;
  created_at: string;
  status: 'parsing' | 'completed' | 'error';
  store_count: number;
  month_count: number;
}

export interface DREParameters {
  id?: string;
  loja_id: number;
  descricao: string;
  periodo_inicio: string;
  periodo_fim: string;
  media: number;
  mediana: number;
  desvio_padrao: number;
  min: number;
  max: number;
  q1: number;
  q3: number;
  limite_inferior: number;
  limite_superior: number;
  coeficiente_variacao: number;
  considera_sazonalidade: boolean;
  updated_at?: string;
}

export interface DREAnomaly {
  id?: string;
  loja_id: number;
  mes_referencia: string;
  tipo: 'outlier_superior' | 'outlier_inferior' | 'estouro_cota' | 'valor_zerado' | 'variacao_abrupta' | 'sazonalidade_anormal';
  severidade: 'baixa' | 'media' | 'alta' | 'critica';
  descricao: string;
  valor_real: number;
  valor_esperado: number;
  desvio_absoluto: number;
  desvio_percentual: number;
  status: 'pendente' | 'em_analise' | 'resolvido' | 'falso_positivo';
  resolvido_por?: string;
  resolvido_em?: string;
  created_at?: string;
}

export interface CotaLoja {
  id: string;
  loja_id: number;
  mes_referencia: string;
  cota_total: number;
  percent_gerente: number;
  percent_comprador: number;
}

export interface CotaCategoria {
  id: string;
  cota_loja_id: string;
  categoria: 'Acessórios' | 'Feminino' | 'Masculino' | 'Infantil' | 'Esportivo';
  percentual: number;
  valor_calculado: number;
}

export interface Sazonalidade {
  id: string;
  nome: string;
  fator: number; // ex: 1.8 para 180%
  meses: number[]; // 1-12
}

export interface DespesaGerenciavel {
  id: string;
  descricao: string;
  categoria: string;
  grupo: string;
}

// Views Interfaces
export interface ResumoMensal {
  loja_id: number;
  mes_referencia: string;
  receita_total: number;
  despesa_total: number;
  margem_liquida: number;
  margem_percent: number;
}

export interface StatusCotaView {
  loja_id: number;
  mes_referencia: string;
  cota_total: number;
  consumo_fornecedores: number;
  percent_utilizado: number;
  saldo_disponivel: number;
}

export interface ComparativoMoM {
  loja_id: number;
  descricao: string;
  mes_atual: string;
  valor_atual: number;
  mes_anterior: string;
  valor_anterior: number;
  variacao_percent: number;
}

export interface RankingLoja {
  loja_id: number;
  nome_loja: string;
  score: number;
  rank: number;
  faturamento_total: number;
  margem_media: number;
}

export interface ExcelParseResult {
  data: DREData[];
  summary: {
    lojasInvolved: number[];
    monthsInvolved: string[];
    groupsFound: string[];
  };
}

export interface KPICard {
  title: string;
  value: string | number;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  icon?: string;
  color?: string;
}

export interface FiltrosDRE {
  mesReferencia: string;
  lojas: number[];
  grupos: string[];
}
