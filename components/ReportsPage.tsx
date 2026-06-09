import React, { useState, useEffect } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { supabase } from "../services/supabaseClient";
import { toast } from "sonner";
import { 
  Trophy, 
  BarChart3, 
  ClipboardList, 
  ShoppingBag, 
  DollarSign, 
  FileText, 
  Calendar, 
  User, 
  ArrowLeft, 
  Download, 
  X, 
  Sliders,
  CheckCircle,
  TrendingDown,
  AlertTriangle,
  Zap,
  Tag,
  Clock,
  Eye
} from "lucide-react";

interface Report {
  id: string;
  title: string;
  tag: string;
  desc: string;
  icon: string;
  rpc: string;
}

interface Section {
  id: string;
  label: string;
  icon: string;
  accent: string;
  reports: Report[];
}

const sections: Section[] = [
  {
    id: "metas",
    label: "Metas & Pessoas",
    icon: "🎯",
    accent: "#F59E0B",
    reports: [
      {
        id: "premiacoes_semanal",
        title: "Premiação Semanal Detalhada",
        tag: "PA · Vendas · Ticket",
        desc: "Cada vendedor por loja: metas atingidas, prêmios individuais, identificação de novos vs antigos.",
        icon: "🏆",
        rpc: "generate_weekly_awards_report"
      },
      {
        id: "ranking_mensal",
        title: "Ranking Metas Mensal",
        tag: "Venda 50% · Ticket 30% · PA 20%",
        desc: "Ranking ponderado das 18 lojas com score final. Top 3 em destaque, últimas 3 em alerta.",
        icon: "📊",
        rpc: "generate_monthly_ranking_report"
      },
      {
        id: "premiacao_mensal",
        title: "Premiação Mensal Consolidada",
        tag: "Acumulado do mês",
        desc: "Acumulado do mês por vendedor: total pago, semanas que bateu meta, ranking dos maiores ganhadores.",
        icon: "💎",
        rpc: "generate_monthly_awards_report"
      }
    ]
  },
  {
    id: "pedidos",
    label: "Pedidos — Visão Geral",
    icon: "📦",
    accent: "#3B82F6",
    reports: [
      {
        id: "pedidos_fornecedor",
        title: "Pedidos por Fornecedor",
        tag: "Valor · Pares · Faturamento",
        desc: "Agrupado por fornecedor/marca com meses de faturamento e vencimento dos títulos.",
        icon: "🏭",
        rpc: "generate_orders_by_supplier_report"
      },
      {
        id: "resumo_loja",
        title: "Resumo por Loja",
        tag: "Compras consolidadas",
        desc: "Total comprado por loja: pedidos, pares, valor, markup médio, split gerente vs comprador.",
        icon: "🏪",
        rpc: "generate_orders_by_store_report"
      },
      {
        id: "semestral",
        title: "Visão Semestral",
        tag: "1º sem vs 2º sem · YoY",
        desc: "Compras acumuladas por semestre, evolução e comparativo de crescimento em relação ao ano anterior.",
        icon: "📆",
        rpc: "generate_semester_report"
      },
      {
        id: "categorias",
        title: "Pedidos por Categorias",
        tag: "Calçado · Meia · Bolsa",
        desc: "Distribuição das compras por tipo de produto, com participação % em cada loja.",
        icon: "🏷️",
        rpc: "generate_orders_by_category_report"
      }
    ]
  },
  {
    id: "analise",
    label: "Pedidos — Análise",
    icon: "🔍",
    accent: "#10B981",
    reports: [
      {
        id: "parametros_genero",
        title: "Parâmetros por Gênero",
        tag: "Mix de público por loja",
        desc: "Distribuição masculino, feminino, infantil e acessórios — identifica lojas desbalanceadas.",
        icon: "👟",
        rpc: "generate_gender_parameters_report"
      },
      {
        id: "marcas_sem_compra",
        title: "Tempo Sem Reposição (Gap)",
        tag: "Marcas inativas",
        desc: "Quais marcas cada loja está comprando e quais parou — alerta de tempo sem produto.",
        icon: "⏰",
        rpc: "generate_brands_gap_report"
      },
      {
        id: "desempenho_compras",
        title: "Desempenho de Compras",
        tag: "KPIs e Conversão",
        desc: "Visão executiva: pedidos criados vs confirmados, tempo médio, custo médio por par.",
        icon: "📈",
        rpc: "generate_purchase_performance_report"
      },
      {
        id: "markup_marcas",
        title: "Markup por Marcas",
        tag: "Margem de precificação",
        desc: "Markup médio e descontos por marca, alerta para marcas com margem abaixo do ideal (<2.0).",
        icon: "💹",
        rpc: "generate_markup_by_brand_report"
      },
      {
        id: "cotas",
        title: "Cotas — Abertas & Utilizadas",
        tag: "Saldo e utilização por loja",
        desc: "Saldo de cotas OTB por loja e lançamentos/pedidos detalhados que consumiram limite.",
        icon: "💰",
        rpc: "generate_quota_usage_report"
      }
    ]
  },
  {
    id: "financeiro",
    label: "Financeiro & Pesquisa",
    icon: "💵",
    accent: "#8B5CF6",
    reports: [
      {
        id: "dre",
        title: "DRE Comparativo",
        tag: "Mês · Ano Ant. · YoY",
        desc: "Demonstrativo DRE estruturado com variação em percentual e comparativo com o mesmo mês do ano anterior.",
        icon: "📈",
        rpc: "generate_dre_comparative_report"
      },
      {
        id: "pesquisas",
        title: "Relatório de Pesquisas",
        tag: "NPS · Avaliação de Clientes",
        desc: "Pesquisas ativas, total de respostas por loja, notas de satisfação e indicadores de participação.",
        icon: "📋",
        rpc: "generate_surveys_report"
      }
    ]
  }
];

// Months list for helper
const MONTHS_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

export default function CentralRelatorios({ 
  user, 
  activeSection: initialSection 
}: { 
  user?: any; 
  activeSection?: string;
}) {
  const [activeSection, setActiveSection] = useState<string>("metas");
  const [loadingId, setLoadingId] = useState<string | null>(null);
  
  // Date and Range filters
  const [filterYear, setFilterYear] = useState<number>(2026);
  const [filterMonth, setFilterMonth] = useState<number>(6); // June
  const [filterMonthsRange, setFilterMonthsRange] = useState<number>(3); // Last 3 months
  const [filterStartDate, setFilterStartDate] = useState<string>(""); // For weekly awards

  // Stores filter
  const [stores, setStores] = useState<Array<{ number: number; name: string }>>([]);
  const [selectedStore, setSelectedStore] = useState<number>(0);

  // Load stores from database
  useEffect(() => {
    const fetchStores = async () => {
      try {
        const { data, error } = await supabase
          .from("stores")
          .select("number, name")
          .eq("status", "active")
          .order("number", { ascending: true });
        if (error) throw error;
        if (data) {
          setStores(data.map(s => ({
            number: Number(s.number),
            name: s.name
          })));
        }
      } catch (e) {
        console.error("Erro ao buscar lojas para filtro de relatórios:", e);
      }
    };
    fetchStores();
  }, []);

  // Preview State
  const [previewData, setPreviewData] = useState<{
    report: Report;
    data: any[];
    rawResponse?: any;
    summary: {
      totalRows: number;
      primaryMetricName?: string;
      primaryMetricValue?: string;
      secondaryMetricName?: string;
      secondaryMetricValue?: string;
    };
  } | null>(null);

  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'));

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains('dark'));
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });

    return () => observer.disconnect();
  }, []);

  const th = {
    bodyBg: isDark ? "#090c14" : "#f8fafc",
    cardBg: isDark ? "#0e1322" : "#ffffff",
    panelBg: isDark ? "#0c101f" : "#f1f5f9",
    borderColor: isDark ? "#1e293b" : "#e2e8f0",
    borderHeaderColor: isDark ? "#161d2d" : "#e2e8f0",
    textPrimary: isDark ? "#e2e8f0" : "#0f172a",
    textHeader: isDark ? "#e8ecf2" : "#1e293b",
    textSecondary: isDark ? "#8193a8" : "#475569",
    textMuted: isDark ? "#64748b" : "#64748b",
    textDesc: isDark ? "#64748b" : "#475569",
    selectBg: isDark ? "#10172a" : "#ffffff",
    selectColor: isDark ? "#cbd5e1" : "#334155",
    selectBorder: isDark ? "#1e293b" : "#cbd5e1",
    headerBg: isDark ? "linear-gradient(180deg, #0d1120 0%, #090c14 100%)" : "linear-gradient(180deg, #ffffff 0%, #f1f5f9 100%)",
    headerBorder: isDark ? "#161d2d" : "#e2e8f0",
    modalOverlayBg: isDark ? "rgba(5, 7, 13, 0.92)" : "rgba(15, 23, 42, 0.6)",
    shadow: isDark ? "none" : "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
    cardShadow: isDark ? "none" : "0 8px 24px rgba(0,0,0,0.04)",
    thBg: isDark ? "#111827" : "#f1f5f9",
    thText: isDark ? "#94a3b8" : "#475569",
    tdBorder: isDark ? "#161e30" : "#e2e8f0",
    tableRowHover: isDark ? "#162035" : "#f1f5f9",
    previewsHeaderTitle: isDark ? "#ffffff" : "#0f172a",
  };

  // Sync active section from props (so sidebar routing works organically)
  useEffect(() => {
    if (initialSection) {
      setActiveSection(initialSection);
    }
  }, [initialSection]);

  // Helper utility to format row values to currency or percent dynamically
  const getRowValue = (row: any, key: string): string => {
    const val = row[key];
    if (val === null || val === undefined) return "—";

    const keyLower = key.toLowerCase();

    if (typeof val === "boolean") {
      return val ? "SIM" : "NÃO";
    }

    // Format percentage
    if (
      keyLower.includes("pct") || 
      keyLower.includes("percentual") || 
      keyLower.includes("atingimento") || 
      keyLower.includes("participacao") || 
      keyLower.includes("score") || 
      keyLower.includes("crescimento") || 
      keyLower.includes("var") || 
      keyLower.includes("queda") || 
      keyLower === "progresso"
    ) {
      const num = Number(val);
      if (!isNaN(num)) {
        return `${num.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
      }
    }

    // Format currency details
    if (
      keyLower.includes("valor") || 
      keyLower.includes("bruto") || 
      keyLower.includes("pago") || 
      keyLower.includes("venda") || 
      keyLower.includes("premio") || 
      keyLower.includes("custo") || 
      keyLower.includes("ganho") || 
      keyLower.includes("despesa") || 
      keyLower.includes("receita") || 
      keyLower.includes("cota") || 
      keyLower.includes("saldo") || 
      keyLower.includes("faturamento") || 
      keyLower === "total"
    ) {
      const num = Number(val);
      if (!isNaN(num)) {
        return num.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
      }
    }

    // Format standard numbers
    if (typeof val === "number") {
      return val.toLocaleString("pt-BR");
    }

    return String(val);
  };

  // Helper to translate default keys into beautifully formatted table headers
  const getTranslatedHeader = (key: string): string => {
    const translations: Record<string, string> = {
      store_id: "Loja ID",
      store_number: "Loja",
      store_name: "Nome da Loja",
      vendedor: "Vendedor",
      vendedor_nome: "Nome Vendedor",
      is_novo: "Novo Co.",
      pa_achievement: "PA Ating.",
      pa_meta: "PA Meta",
      pa_bat: "PA Batido",
      vendas_bat: "Vendas Bat.",
      ticket_bat: "Ticket Bat.",
      premio_pa: "Prêmio PA",
      premio_vendas: "Prêmio Vendas",
      premio_ticket: "Prêmio Ticket",
      total_pago: "Total Ganho",
      total: "Total",
      revenue_target: "Meta Venda",
      revenue_realized: "Venda Realizada",
      revenue_pct: "% Venda",
      ticket_target: "Meta Ticket",
      ticket_realized: "Ticket Real",
      ticket_pct: "% Ticket",
      pa_target: "Meta PA",
      pa_realized: "PA Real",
      pa_pct: "% PA",
      score: "Score Geral",
      rank: "Posição",
      semanas_ativas: "Semanas Ativas",
      fornecedor: "Fornecedor",
      marca: "Marca",
      total_pedidos: "Qtd Pedidos",
      total_pares: "Total Pares",
      valor_bruto: "Valor Bruto",
      markup_medio: "Markup Médio",
      desconto_medio: "Desconto Médio",
      meses_faturamento: "Meses Fat.",
      meses_vencimento: "Meses Venc.",
      pedidos: "Pedidos",
      pares: "Pares",
      total_pedidos_gerente: "Ped. Gerente",
      total_pedidos_comprador: "Ped. Comprador",
      total_valor_gerente: "Valor Gerente",
      total_valor_comprador: "Valor Comprador",
      categoria: "Categoria",
      masculino_pares: "Masc Pares",
      masculino_pct: "% Masc",
      feminino_pares: "Fem Pares",
      feminino_pct: "% Fem",
      infantil_pares: "Infantil Pares",
      infantil_pct: "% Inf",
      acessorio_pares: "Aces Pares",
      acessorio_pct: "% Aces",
      marcas_inativas: "Marcas Inativas",
      ultima_compra: "Últ. Compra",
      dias_sem_reposicao: "Dias s/ Repor",
      status_alerta: "Status",
      conversao_pct: "% Conv",
      custo_medio_par: "Custo/Par",
      status: "Status",
      cota_inicial: "Cota Inicial",
      cota_utilizada: "Cota Utilizada",
      cota_disponivel: "Cota Disponível",
      pct_uso: "% Uso",
      gerente_utilizada: "G. Usado",
      comprador_utilizada: "C. Usado",
      conta_dre: "Conta DRE",
      mes_atual: "Mês Atual",
      mes_anterior: "Mês Anterior",
      variacao_pct: "Var %",
      ano_anterior: "Mesmo Mês YoY",
      variacao_yoy_pct: "Var % YoY",
      opinioes_totais: "Respostas",
      participantes_count: "Lojas Participantes",
      pedido: "Pedido",
      criado: "Criado em",
      colaborador: "Quem Pediu",
      valor: "Valor",
      markup: "Markup",
      desconto: "Desconto",
      faturamento: "Faturamento",
      lojas_no_sub: "Lojas no Sub"
    };

    return translations[key.toLowerCase()] || key.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
  };

  // Helper to flatten nested RPC answers for visually robust screen previews and standard column headers
  const flattenReportData = (reportId: string, data: any): any[] => {
    if (!data) return [];
    
    if (reportId === "premiacoes_semanal") {
      const sellers: any[] = [];
      if (data.lojas && Array.isArray(data.lojas)) {
        data.lojas.forEach((loja: any) => {
          if (loja.vendedores && Array.isArray(loja.vendedores)) {
            loja.vendedores.forEach((v: any) => {
              sellers.push({
                loja: `${loja.store_number} - ${loja.store_name}`,
                vendedor: v.nome,
                is_novo: v.is_novo ? 'SIM' : 'NÃO',
                pa_atingido: v.pa_atingido,
                pa_meta: v.pa_meta,
                atingiu_pa: v.atingiu_pa ? '✓' : '✗',
                atingiu_vendas: v.atingiu_vendas ? '✓' : '✗',
                atingiu_ticket: v.atingiu_ticket ? '✓' : '✗',
                premio_pa: v.premio_pa,
                premio_vendas: v.premio_vendas,
                premio_ticket: v.premio_ticket,
                total: v.premio_total
              });
            });
          }
        });
      }
      return sellers;
    }

    if (reportId === "ranking_mensal") {
      const flatRanking: any[] = [];
      if (data.ranking && Array.isArray(data.ranking)) {
        data.ranking.forEach((loja: any, index: number) => {
          flatRanking.push({
            posicao: index + 1,
            loja: `${loja.store_number} - ${loja.store_name}`,
            meta_venda: loja.meta_venda,
            realizado: loja.venda_real,
            pct_venda: loja.pct_venda,
            ticket_meta: loja.meta_ticket,
            ticket_real: loja.ticket_real,
            pct_ticket: loja.pct_ticket,
            pa_meta: loja.meta_pa,
            pa_real: loja.pa_real,
            pct_pa: loja.pct_pa,
            score: loja.score
          });
        });
      }
      return flatRanking;
    }

    if (reportId === "pedidos_fornecedor") {
      const flatFornecedores: any[] = [];
      if (data.fornecedores && Array.isArray(data.fornecedores)) {
        data.fornecedores.forEach((f: any) => {
          flatFornecedores.push({
            fornecedor: f.fornecedor,
            marca: f.marca,
            pedidos: f.total_pedidos,
            pares: f.total_pares,
            valor_bruto: f.valor_bruto,
            markup: f.markup_medio,
            desconto: f.desconto_medio,
            faturamento: Array.isArray(f.meses_faturamento) ? f.meses_faturamento.join(', ') : f.meses_faturamento || '',
            vencimentos: Array.isArray(f.vencimentos) ? f.vencimentos.join(', ') : f.vencimentos || ''
          });
        });
      }
      return flatFornecedores;
    }

    if (reportId === "resumo_loja") {
      if (selectedStore > 0) {
        const flatPedidos: any[] = [];
        const pedidosList = data.pedidos || [];
        pedidosList.forEach((p: any) => {
          flatPedidos.push({
            pedido: p.numero_pedido,
            marca: p.marca,
            fornecedor: p.fornecedor,
            criado: p.created_at,
            colaborador: p.user_name || p.user_role || "-",
            pares: p.pares_loja,
            valor: p.valor_loja,
            markup: p.markup,
            desconto: `${p.desconto}%`,
            faturamento: p.fat_inicio ? `${p.fat_inicio} a ${p.fat_fim}` : '-',
            lojas_no_sub: p.lojas_no_sub > 1 ? `÷${p.lojas_no_sub}` : '1'
          });
        });
        return flatPedidos;
      } else {
        const flatLojas: any[] = [];
        if (data.lojas && Array.isArray(data.lojas)) {
          data.lojas.forEach((l: any) => {
            flatLojas.push({
              loja: `${l.store_number} - ${l.store_name}`,
              pedidos: l.total_pedidos,
              pares: l.total_pares,
              valor_bruto: l.valor_bruto,
              markup: l.markup_medio,
              desconto: l.desconto_medio,
              ped_gerente: l.pedidos_gerente,
              ped_comprador: l.pedidos_comprador,
              val_gerente: l.valor_gerente,
              val_comprador: l.valor_comprador
            });
          });
        }
        return flatLojas;
      }
    }

    if (reportId === "semestral") {
      const flatSemestral: any[] = [];
      if (data.lojas && Array.isArray(data.lojas)) {
        data.lojas.forEach((l: any) => {
          flatSemestral.push({
            loja: `${l.store_number} - ${l.store_name}`,
            pares_sem1_2026: l.sem1_2026_pares,
            valor_sem1_2026: l.sem1_2026_valor,
            pares_sem2_2025: l.sem2_2025_pares,
            valor_sem2_2025: l.sem2_2025_valor,
            pares_sem1_2025: l.sem1_2025_pares,
            valor_sem1_2025: l.sem1_2025_valor
          });
        });
      }
      return flatSemestral;
    }

    // Generic list extruders
    if (Array.isArray(data)) {
      return data;
    }

    // Look for specific named arrays inside response object for categories, parameters, etc.
    const kCandidates = ["lojas", "vendedores", "ranking", "fornecedores", "categorias", "dados", "marcas", "contas", "pesquisas", "linhas"];
    for (const key of kCandidates) {
      if (data && Array.isArray(data[key])) {
        return data[key];
      }
    }

    // Or look for ANY array property at all
    if (data && typeof data === "object") {
      for (const key of Object.keys(data)) {
        if (Array.isArray(data[key])) {
          return data[key];
        }
      }
    }

    // Fallback to array wrap if it's not a list
    return [data];
  };

  // Run the RPC database call & open visual preview
  const handleGenerate = async (report: Report) => {
    setLoadingId(report.id);
    try {
      let rpcName = report.rpc;
      let rpcParams: Record<string, any> = {};

      // Map parameters based on report characteristics
      if (report.id === "resumo_loja" && selectedStore > 0) {
        rpcName = "generate_store_orders_detail";
        rpcParams = { p_store_number: selectedStore, p_months: filterMonthsRange };
      } else if (report.id === "premiacoes_semanal") {
        rpcParams = { p_data_inicio: filterStartDate || null };
      } else if (["ranking_mensal", "premiacao_mensal", "cotas", "dre"].includes(report.id)) {
        if (report.id === "premiacao_mensal") {
          rpcParams = { p_mes_ref: filterMonth, p_ano_ref: filterYear };
        } else {
          rpcParams = { p_year: filterYear, p_month: filterMonth };
        }
      } else if (["pedidos_fornecedor", "resumo_loja", "categorias", "parametros_genero", "marcas_sem_compra", "desempenho_compras", "markup_marcas"].includes(report.id)) {
        if (report.id === "marcas_sem_compra") {
          rpcParams = { p_months_active: filterMonthsRange };
        } else {
          rpcParams = { p_months: filterMonthsRange };
        }
      }

      // Perform real data request
      const { data, error } = await supabase.rpc(rpcName, rpcParams);

      if (error) {
        console.error("Database RPC error:", error);
        toast.error(`Falha ao carregar relatório do banco: ${error.message}`);
        setLoadingId(null);
        return;
      }

      if (!data) {
        toast.warning("Nenhum registro retornado do banco de dados.");
        setLoadingId(null);
        return;
      }

      // Flatten data for visual tabular preview rendering
      const flatRows = flattenReportData(report.id, data);

      if (flatRows.length === 0) {
        toast.warning("Nenhum registro encontrado para os filtros selecionados.");
        setLoadingId(null);
        return;
      }

      // Compute general summary facts for preview panel
      let totalRows = flatRows.length;
      let primaryMetricName = "Total Registros";
      let primaryMetricValue = String(totalRows);
      let secondaryMetricName: string | undefined;
      let secondaryMetricValue: string | undefined;

      // Custom KPI summaries depending on report ID
      if (report.id === "premiacoes_semanal") {
        primaryMetricName = "Total Pago Prêmios";
        primaryMetricValue = Number(data.resumo?.total_geral || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
        
        secondaryMetricName = "Novos Vendedores";
        secondaryMetricValue = String(data.resumo?.count_novos || 0);
      } else if (report.id === "ranking_mensal") {
        const avgScore = flatRows.reduce((acc, curr) => acc + Number(curr.score || 0), 0) / totalRows;
        primaryMetricName = "Score Médio Rede";
        primaryMetricValue = `${avgScore.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
      } else if (report.id === "pedidos_fornecedor") {
        primaryMetricName = "Valor Bruto Total";
        primaryMetricValue = Number(data.resumo?.total_valor || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
        secondaryMetricName = "Total de Pares";
        secondaryMetricValue = Number(data.resumo?.total_pares || 0).toLocaleString("pt-BR");
      } else if (report.id === "resumo_loja") {
        if (selectedStore > 0) {
          primaryMetricName = "Total Pedidos";
          primaryMetricValue = String(data.total_pedidos || 0);
          secondaryMetricName = "Total Pares / Valor";
          secondaryMetricValue = `${Number(data.total_pares || 0).toLocaleString("pt-BR")} pares · ${Number(data.total_valor || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`;
        } else {
          const totalValue = flatRows.reduce((acc, curr) => acc + Number(curr.valor_bruto || 0), 0);
          const totalPares = flatRows.reduce((acc, curr) => acc + Number(curr.pares || curr.total_pares || 0), 0);
          primaryMetricName = "Valor Bruto Total";
          primaryMetricValue = totalValue.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
          secondaryMetricName = "Total de Pares";
          secondaryMetricValue = totalPares.toLocaleString("pt-BR");
        }
      } else if (report.id === "semestral") {
        primaryMetricName = "Rede 1º Sem 2026";
        primaryMetricValue = Number(data.rede?.sem1_2026_valor || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
        secondaryMetricName = "Pares Sem1 2026";
        secondaryMetricValue = Number(data.rede?.sem1_2026_pares || 0).toLocaleString("pt-BR");
      } else if (report.id === "cotas") {
        const totalLimit = flatRows.reduce((acc, curr) => acc + Number(curr.cota_inicial || curr.limite || 0), 0);
        const totalUsed = flatRows.reduce((acc, curr) => acc + Number(curr.cota_utilizada || curr.utilizado || 0), 0);
        primaryMetricName = "Limite Consolidado";
        primaryMetricValue = totalLimit.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
        secondaryMetricName = "% Consumido Rede";
        secondaryMetricValue = totalLimit > 0 ? `${Math.round((totalUsed / totalLimit) * 100)}%` : "0%";
      }

      setPreviewData({
        report,
        data: flatRows,
        rawResponse: data,
        summary: {
          totalRows,
          primaryMetricName,
          primaryMetricValue,
          secondaryMetricName,
          secondaryMetricValue
        }
      });

      toast.success("Relatório gerado com sucesso! Visualize os resultados abaixo.");
    } catch (e: any) {
      console.error(e);
      toast.error(`Erro ao processar chamada: ${e.message || e}`);
    } finally {
      setLoadingId(null);
    }
  };

  // Generate and download PDF from preview data using jsPDF
  const handleDownloadPDF = () => {
    if (!previewData) return;

    const { report, data, rawResponse } = previewData;
    const doc = new jsPDF("l", "mm", "a4"); // Landscape layout A4 size
    const pageWidth = doc.internal.pageSize.getWidth();

    // Color Theme Definitions
    const PRIMARY_COLOR: [number, number, number] = [24, 95, 165]; // #185FA5
    const SECONDARY_COLOR = [100, 100, 100];
    const BACKGROUND_HEADER = [240, 244, 248];

    // Page Header
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(20);
    doc.setTextColor(24, 95, 165);
    doc.text(report.title, 14, 18);

    doc.setFont("Helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);

    // Helper to add footer meta
    const addStandardFooters = (pdfDoc: jsPDF, wSpan: number) => {
      const pageCount = (pdfDoc as any).internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        pdfDoc.setPage(i);
        pdfDoc.setFontSize(8);
        pdfDoc.setTextColor(150, 150, 150);
        
        pdfDoc.text(
          `Gerado em: ${new Date().toLocaleString("pt-BR")} · RealAdmin - Portal de Relatórios`, 
          14, 
          pdfDoc.internal.pageSize.getHeight() - 10
        );
        
        const pageNumText = `Página ${i} de ${pageCount}`;
        pdfDoc.text(
          pageNumText, 
          wSpan - pdfDoc.getTextWidth(pageNumText) - 14, 
          pdfDoc.internal.pageSize.getHeight() - 10
        );
      }
    };

    // Period description in header
    let periodText = "";
    if (["ranking_mensal", "premiacao_mensal", "cotas", "dre"].includes(report.id)) {
      periodText = `Período: ${MONTHS_NAMES[filterMonth - 1]} de ${filterYear}`;
    } else if (["pedidos_fornecedor", "resumo_loja", "categorias", "parametros_genero", "marcas_sem_compra", "desempenho_compras", "markup_marcas"].includes(report.id)) {
      periodText = `Estatísticas baseadas nos últimos ${filterMonthsRange} meses`;
    } else if (report.id === "premiacoes_semanal") {
      periodText = filterStartDate 
        ? `Data Inicial da Semana: ${new Date(filterStartDate + "T00:00:00").toLocaleDateString("pt-BR")}`
        : `Última Semana Fechada`;
    } else {
      periodText = `Visão Consolidada Geral`;
    }
    doc.text(`Real Calçados · ${periodText}`, 14, 24);

    // Draw a dividing line
    doc.setDrawColor(220, 225, 230);
    doc.setLineWidth(0.5);
    doc.line(14, 28, pageWidth - 14, 28);

    // REPORT 1: Premiação Semanal Detalhada
    if (report.id === "premiacoes_semanal") {
      const respData = rawResponse;
      if (!respData) {
        toast.error("Ocorreu um erro: dados brutos não encontrados.");
        return;
      }

      // Metadata info
      const sem = respData.semana || {};
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(11);
      doc.text(`Semana: ${sem.data_inicio || "-"} a ${sem.data_fim || "-"}`, 14, 34);
      doc.setFont("Helvetica", "normal");
      doc.setFontSize(10);
      doc.text(`Pagamento: ${sem.data_pagamento || "-"} | Ref: ${sem.mes_ref || "-"}/${sem.ano_ref || "-"}`, 14, 40);

      let currentY = 46;
      const lojasList = respData.lojas || [];

      lojasList.forEach((loja: any) => {
        // Break page if remaining vertical height is extremely tight
        if (currentY > 210) {
          doc.addPage();
          currentY = 20;
        }

        doc.setFontSize(11);
        doc.setFont('Helvetica', 'bold');
        doc.setTextColor(24, 95, 165);
        doc.text(`Loja ${loja.store_number || ""} — ${loja.store_name || ""} | Total Loja: R$ ${Number(loja.total_premio || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}`, 14, currentY);
        doc.setTextColor(50, 50, 50);
        currentY += 4;

        const vendedoresList = loja.vendedores || [];

        autoTable(doc, {
          startY: currentY,
          headStyles: { fillColor: PRIMARY_COLOR, fontSize: 8 },
          styles: { fontSize: 7, cellPadding: 2 },
          head: [['Vendedor', 'Novo?', 'PA', 'Meta PA', 'PA✓', 'Venda✓', 'Ticket✓', 'Prêm.PA', 'Prêm.Venda', 'Prêm.Ticket', 'Total']],
          body: vendedoresList.map((v: any) => [
            v.nome || "",
            v.is_novo ? 'SIM' : '',
            v.pa_atingido !== undefined ? v.pa_atingido : '',
            v.pa_meta !== undefined ? v.pa_meta : '',
            v.atingiu_pa ? '✓' : '✗',
            v.atingiu_vendas ? '✓' : '✗',
            v.atingiu_ticket ? '✓' : '✗',
            `R$ ${Number(v.premio_pa || 0).toFixed(2)}`,
            `R$ ${Number(v.premio_vendas || 0).toFixed(2)}`,
            `R$ ${Number(v.premio_ticket || 0).toFixed(2)}`,
            `R$ ${Number(v.premio_total || 0).toFixed(2)}`
          ]),
          didParseCell: function(cellData) {
            if (cellData.section === 'body') {
              const rowIndex = cellData.row.index;
              const vendedor = vendedoresList[rowIndex];
              if (vendedor && vendedor.is_novo) {
                cellData.cell.styles.fillColor = [255, 243, 205]; // Soft yellow background
              }
              if (cellData.column.index === 1 && cellData.cell.raw === 'SIM') {
                cellData.cell.styles.textColor = [220, 53, 69]; // Bold red text for "SIM"
                cellData.cell.styles.fontStyle = 'bold';
              }
            }
          }
        });

        // Loop over the written autoTable final Y height
        // @ts-ignore
        currentY = doc.lastAutoTable.finalY + 10;
      });

      // Overlay standard headers & totals in footers across all generated screens
      const pageCount = (doc as any).internal.getNumberOfPages();
      const resumo = respData.resumo || {};
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(9);
        doc.setTextColor(50, 50, 50);
        doc.setFont('Helvetica', 'bold');
        doc.text(`TOTAL GERAL: R$ ${Number(resumo.total_geral || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}`, 14, 275);
        doc.setFont('Helvetica', 'normal');
        doc.text(`Pago a ANTIGOS: R$ ${Number(resumo.total_antigos || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})} (${resumo.count_antigos || 0}) | Pago a NOVOS: R$ ${Number(resumo.total_novos || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})} (${resumo.count_novos || 0})`, 14, 281);
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')} · RealAdmin`, 14, 288);
        doc.text(`Página ${i} de ${pageCount}`, pageWidth - 30, 288);
      }

      const pdfFilename = `Relatorio_${report.id}_${new Date().toISOString().substring(0, 10)}.pdf`;
      doc.save(pdfFilename);
      toast.success(`Download do PDF concluído: ${pdfFilename}`);
      return;
    }

    // REPORT 2: Ranking Metas Mensal
    if (report.id === "ranking_mensal") {
      const respData = rawResponse;
      if (!respData) return;

      const pesos = respData.pesos || {};
      doc.setFont("Helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(50, 50, 50);
      doc.text(`Pesos: Venda ${pesos.venda || 0}% | Ticket ${pesos.ticket || 0}% | PA ${pesos.pa || 0}%`, 14, 34);

      const rankingList = respData.ranking || [];

      autoTable(doc, {
        startY: 40,
        headStyles: { fillColor: PRIMARY_COLOR, fontSize: 8 },
        styles: { fontSize: 8, cellPadding: 2.5 },
        head: [['#', 'Loja', 'Meta Venda', 'Realizado', '% Venda', 'Ticket Meta', 'Ticket Real', '% Ticket', 'PA Meta', 'PA Real', '% PA', 'Score']],
        body: rankingList.map((loja: any, index: number) => [
          index + 1,
          `${loja.store_number || ""} - ${loja.store_name || ""}`,
          `R$ ${Number(loja.meta_venda || 0).toLocaleString('pt-BR', {minimumFractionDigits: 0})}`,
          `R$ ${Number(loja.venda_real || 0).toLocaleString('pt-BR', {minimumFractionDigits: 0})}`,
          `${loja.pct_venda || 0}%`,
          `R$ ${Number(loja.meta_ticket || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}`,
          `R$ ${Number(loja.ticket_real || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}`,
          `${loja.pct_ticket || 0}%`,
          loja.meta_pa !== undefined ? loja.meta_pa : '',
          loja.pa_real !== undefined ? loja.pa_real : '',
          `${loja.pct_pa || 0}%`,
          `${loja.score || 0}%`
        ]),
        didParseCell: function(cellData) {
          if (cellData.section === 'body') {
            const rowIndex = cellData.row.index;
            // Top 3: green
            if (rowIndex < 3) {
              cellData.cell.styles.fillColor = [212, 237, 218];
              cellData.cell.styles.textColor = [15, 115, 50];
              cellData.cell.styles.fontStyle = "bold";
            }
            // Last 3: red
            if (rowIndex >= rankingList.length - 3) {
              cellData.cell.styles.fillColor = [248, 215, 218];
              cellData.cell.styles.textColor = [185, 28, 28];
              cellData.cell.styles.fontStyle = "bold";
            }
          }
        }
      });

      addStandardFooters(doc, pageWidth);
      const pdfFilename = `Relatorio_${report.id}_${new Date().toISOString().substring(0, 10)}.pdf`;
      doc.save(pdfFilename);
      toast.success(`Download do PDF concluído: ${pdfFilename}`);
      return;
    }

    // REPORT 3: Pedidos por Fornecedor
    if (report.id === "pedidos_fornecedor") {
      const respData = rawResponse;
      if (!respData) return;

      const resumo = respData.resumo || {};
      doc.setFont("Helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(50, 50, 50);
      doc.text(`Total Fornecedores: ${resumo.total_fornecedores || 0} | Pares: ${Number(resumo.total_pares || 0).toLocaleString('pt-BR')} | Valor: R$ ${Number(resumo.total_valor || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}`, 14, 34);

      const fornecedoresList = respData.fornecedores || [];

      autoTable(doc, {
        startY: 40,
        headStyles: { fillColor: PRIMARY_COLOR, fontSize: 8 },
        styles: { fontSize: 7, cellPadding: 2 },
        head: [['Fornecedor', 'Marca', 'Pedidos', 'Pares', 'Valor Bruto', 'Markup', 'Desc.', 'Faturamento', 'Títulos']],
        body: fornecedoresList.map((f: any) => [
          f.fornecedor || "",
          f.marca || "",
          f.total_pedidos !== undefined ? f.total_pedidos : '',
          Number(f.total_pares || 0).toLocaleString('pt-BR'),
          `R$ ${Number(f.valor_bruto || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}`,
          f.markup_medio !== undefined ? f.markup_medio : '',
          `${f.desconto_medio || 0}%`,
          Array.isArray(f.meses_faturamento) ? f.meses_faturamento.join(', ') : f.meses_faturamento || '',
          Array.isArray(f.vencimentos) ? f.vencimentos.join(', ') : f.vencimentos || ''
        ])
      });

      addStandardFooters(doc, pageWidth);
      const pdfFilename = `Relatorio_${report.id}_${new Date().toISOString().substring(0, 10)}.pdf`;
      doc.save(pdfFilename);
      toast.success(`Download do PDF concluído: ${pdfFilename}`);
      return;
    }

    // REPORT 4: Resumo por Loja
    if (report.id === "resumo_loja") {
      const respData = rawResponse;
      if (!respData) return;

      if (selectedStore > 0) {
        const docStore = new jsPDF("p", "mm", "a4");

        // Cabeçalho
        docStore.setFontSize(18);
        docStore.setTextColor(24, 95, 165);
        docStore.text(`Loja ${respData.store_number} — ${respData.store_name}`, 20, 20);
        docStore.setFontSize(11);
        docStore.setTextColor(100, 100, 100);
        docStore.text(`Período: últimos ${respData.periodo?.meses || 3} meses (desde ${respData.periodo?.de || ""})`, 20, 28);

        // Resumo
        docStore.setFontSize(12);
        docStore.setTextColor(0, 0, 0);
        docStore.text(`Total: ${respData.total_pedidos || 0} pedidos | ${Number(respData.total_pares || 0).toLocaleString('pt-BR')} pares | R$ ${Number(respData.total_valor || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}`, 20, 38);

        // Tabela de pedidos
        const pList = respData.pedidos || [];
        autoTable(docStore, {
          startY: 45,
          headStyles: { fillColor: [24, 95, 165], fontSize: 7 },
          styles: { fontSize: 7 },
          head: [['Ped.', 'Marca', 'Fornecedor', 'Criado', 'Quem', 'Pares', 'Valor', 'Markup', 'Desc.', 'Faturamento', 'Lojas']],
          body: pList.map((p: any) => [
            p.numero_pedido || '',
            p.marca || '',
            p.fornecedor || '',
            p.created_at || '',
            p.user_name || '',
            p.pares_loja !== undefined ? Number(p.pares_loja).toLocaleString('pt-BR') : '',
            `R$ ${Number(p.valor_loja || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}`,
            p.markup || '',
            `${p.desconto || 0}%`,
            p.fat_inicio ? `${p.fat_inicio} a ${p.fat_fim}` : '-',
            p.lojas_no_sub > 1 ? `÷${p.lojas_no_sub}` : '1'
          ]),
          didParseCell: function(cellData) {
            if (cellData.section === 'body') {
              // Destacar pedidos compartilhados (÷ lojas)
              const rowIdx = cellData.row.index;
              const pedido = pList[rowIdx];
              if (pedido && pedido.lojas_no_sub > 1) {
                cellData.cell.styles.fillColor = [240, 248, 255]; // azul claro
              }
              // Role: gerente = verde, admin = roxo, comprador = laranja
              if (cellData.column.index === 4 && pedido) {
                const roleLower = String(pedido.user_role || '').toLowerCase();
                if (['manager', 'gerente'].includes(roleLower)) {
                  cellData.cell.styles.textColor = [25, 135, 84];
                } else if (roleLower === 'admin') {
                  cellData.cell.styles.textColor = [111, 66, 193];
                }
              }
            }
          }
        });

        // Rodapé
        const pageCountStore = (docStore as any).internal.getNumberOfPages();
        for (let i = 1; i <= pageCountStore; i++) {
          docStore.setPage(i);
          docStore.setFontSize(8);
          docStore.setTextColor(150, 150, 150);
          docStore.text(`Gerado em: ${new Date().toLocaleString('pt-BR')} · RealAdmin`, 20, docStore.internal.pageSize.getHeight() - 10);
          docStore.text(`Página ${i} de ${pageCountStore}`, docStore.internal.pageSize.getWidth() - 30, docStore.internal.pageSize.getHeight() - 10);
        }

        const filename = `Detalhe_Loja_${respData.store_number}_${new Date().toISOString().slice(0,10)}.pdf`;
        docStore.save(filename);
        toast.success(`Download do PDF concluído: ${filename}`);
        return;
      }

      const lojasList = respData.lojas || [];

      autoTable(doc, {
        startY: 34,
        headStyles: { fillColor: PRIMARY_COLOR, fontSize: 8 },
        styles: { fontSize: 7, cellPadding: 2 },
        head: [['Loja', 'Pedidos', 'Pares', 'Valor Bruto', 'Markup', 'Desc.', 'Ped.Ger.', 'Ped.Comp.', 'Val.Ger.', 'Val.Comp.']],
        body: lojasList.map((l: any) => [
          `${l.store_number || ""} - ${l.store_name || ""}`,
          l.total_pedidos !== undefined ? l.total_pedidos : '',
          Number(l.total_pares || 0).toLocaleString('pt-BR'),
          `R$ ${Number(l.valor_bruto || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}`,
          l.markup_medio !== undefined ? l.markup_medio : '',
          `${l.desconto_medio || 0}%`,
          l.pedidos_gerente !== undefined ? l.pedidos_gerente : '',
          l.pedidos_comprador !== undefined ? l.pedidos_comprador : '',
          `R$ ${Number(l.valor_gerente || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}`,
          `R$ ${Number(l.valor_comprador || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}`
        ])
      });

      addStandardFooters(doc, pageWidth);
      const pdfFilename = `Relatorio_${report.id}_${new Date().toISOString().substring(0, 10)}.pdf`;
      doc.save(pdfFilename);
      toast.success(`Download do PDF concluído: ${pdfFilename}`);
      return;
    }

    // REPORT 5: Visão Semestral
    if (report.id === "semestral") {
      const respData = rawResponse;
      if (!respData) return;

      const rede = respData.rede || {};
      doc.setFont("Helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(50, 50, 50);
      doc.text(`Rede 1º Sem 2026: ${Number(rede.sem1_2026_pares || 0).toLocaleString('pt-BR')} pares | R$ ${Number(rede.sem1_2026_valor || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}`, 14, 34);

      const lojasList = respData.lojas || [];

      autoTable(doc, {
        startY: 40,
        headStyles: { fillColor: PRIMARY_COLOR, fontSize: 8 },
        styles: { fontSize: 7, cellPadding: 2 },
        head: [['Loja', '1ºSem 2026 Pares', '1ºSem 2026 Valor', '2ºSem 2025 Pares', '2ºSem 2025 Valor', '1ºSem 2025 Pares', '1ºSem 2025 Valor']],
        body: lojasList.map((l: any) => [
          `${l.store_number || ""} - ${l.store_name || ""}`,
          Number(l.sem1_2026_pares || 0).toLocaleString('pt-BR'),
          `R$ ${Number(l.sem1_2026_valor || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}`,
          Number(l.sem2_2025_pares || 0).toLocaleString('pt-BR'),
          `R$ ${Number(l.sem2_2025_valor || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}`,
          Number(l.sem1_2025_pares || 0).toLocaleString('pt-BR'),
          `R$ ${Number(l.sem1_2025_valor || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}`
        ])
      });

      addStandardFooters(doc, pageWidth);
      const pdfFilename = `Relatorio_${report.id}_${new Date().toISOString().substring(0, 10)}.pdf`;
      doc.save(pdfFilename);
      toast.success(`Download do PDF concluído: ${pdfFilename}`);
      return;
    }

    // GENERAL FALLBACK MAPPING FOR ALL OTHER REPORTS (6-14)
    const keys = Object.keys(data[0]);
    const headers = keys.map(k => getTranslatedHeader(k));
    const bodyRows = data.map(row => keys.map(k => getRowValue(row, k)));

    // Generate beautifully styled table
    autoTable(doc, {
      startY: 32,
      head: [headers],
      body: bodyRows,
      theme: "striped",
      headStyles: {
        fillColor: PRIMARY_COLOR,
        textColor: [255, 255, 255],
        fontSize: 9,
        fontStyle: "bold"
      },
      styles: {
        fontSize: 8,
        cellPadding: 3
      },
      alternateRowStyles: {
        fillColor: [247, 249, 251]
      },
      // Accent highlights in rows (Top 3 in ranking green background, critical ranges red etc.)
      didParseCell: function (cellData) {
        if (cellData.section === "body") {
          const rawValue = String(cellData.cell.raw).toLowerCase();
          
          // Style highlights for specific key metrics
          if (report.id === "ranking_mensal" && cellData.column.index === 0) {
            const rank = Number(cellData.cell.raw);
            if (rank <= 3) {
              cellData.cell.styles.fillColor = [224, 242, 230]; // Soft Green
              cellData.cell.styles.textColor = [15, 115, 50];
              cellData.cell.styles.fontStyle = "bold";
            } else if (bodyRows.length > 3 && rank > bodyRows.length - 3) {
              cellData.cell.styles.fillColor = [254, 226, 226]; // Soft Red
              cellData.cell.styles.textColor = [185, 28, 28];
              cellData.cell.styles.fontStyle = "bold";
            }
          }

          // Mark active/critical threshold visually
          if (rawValue === "crítico" || rawValue === "esgotado" || rawValue === "alta") {
            cellData.cell.styles.textColor = [185, 28, 28];
            cellData.cell.styles.fontStyle = "bold";
          } else if (rawValue === "atenção" || rawValue === "alerta") {
            cellData.cell.styles.textColor = [217, 119, 6];
            cellData.cell.styles.fontStyle = "bold";
          } else if (rawValue === "ok" || rawValue === "ativa") {
            cellData.cell.styles.textColor = [15, 115, 50];
            cellData.cell.styles.fontStyle = "bold";
          }
        }
      }
    });

    // Add footer indices to other reports
    addStandardFooters(doc, pageWidth);

    // Direct client file triggers
    const pdfFilename = `Relatorio_${report.id}_${new Date().toISOString().substring(0, 10)}.pdf`;
    doc.save(pdfFilename);
    toast.success(`Download do PDF concluído: ${pdfFilename}`);
  };

  const currentSection = sections.find((s) => s.id === activeSection);
  const totalReportsCount = sections.reduce((a, s) => a + s.reports.length, 0);

  return (
    <div style={{
      minHeight: "100vh",
      background: th.bodyBg,
      fontFamily: "'Segoe UI', -apple-system, sans-serif",
      color: th.textPrimary,
      display: "flex",
      flexDirection: "column",
    }}>

      {/* HEADER SECTION */}
      <header style={{
        padding: "24px 24px 16px",
        borderBottom: "1px solid " + th.headerBorder,
        background: th.headerBg,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "14px", marginBottom: "16px" }}>
          <div style={{
            width: 44, height: 44,
            background: "linear-gradient(135deg, #185FA5, #3b82f6)",
            borderRadius: 12,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 22,
            boxShadow: "0 0 20px rgba(24,95,165,0.35)",
          }}>📊</div>
          <div>
            <h1 style={{
              margin: 0, fontSize: 24, fontWeight: 700,
              color: th.textHeader, letterSpacing: "-0.4px",
            }}>Gestão de Relatórios</h1>
            <p style={{ margin: 0, fontSize: 13, color: th.textSecondary }}>
              Painel de relatórios consolidados · dezenas de RPCs integrados
            </p>
          </div>
        </div>

         {/* SECTION NAVIGATION TABS */}
        <div style={{
          display: "flex", gap: "8px", overflowX: "auto",
          paddingBottom: "6px",
          msOverflowStyle: "none",
          scrollbarWidth: "none",
        }}>
          {sections.map((s) => {
            const active = activeSection === s.id;
            return (
              <button key={s.id} onClick={() => setActiveSection(s.id)} style={{
                padding: "8px 16px",
                borderRadius: "8px",
                border: active ? `1px solid ${s.accent}50` : "1px solid " + th.borderColor,
                background: active ? `${s.accent}12` : th.cardBg,
                color: active ? s.accent : th.textSecondary,
                fontSize: "13px",
                fontWeight: active ? 600 : 500,
                cursor: "pointer",
                whiteSpace: "nowrap",
                transition: "all 0.2s",
                display: "flex", alignItems: "center", gap: "8px",
              }}>
                <span style={{ fontSize: "15px" }}>{s.icon}</span>
                {s.label}
                <span style={{
                  background: active ? `${s.accent}25` : th.borderColor,
                  color: active ? s.accent : th.textMuted,
                  fontSize: "11px", fontWeight: 700,
                  padding: "1px 6px", borderRadius: "4px",
                  minWidth: "18px", textAlign: "center",
                }}>{s.reports.length}</span>
              </button>
            );
          })}
        </div>
      </header>

      {/* REUSABLE REPORT PERIOD SELECTOR (Tarefa 4) */}
      <section style={{
        background: th.panelBg,
        borderBottom: "1px solid " + th.borderHeaderColor,
        padding: "16px 24px",
        display: "flex",
        flexWrap: "wrap",
        gap: "24px",
        alignItems: "center",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", color: th.textMuted }}>
          <Sliders size={16} color="#3b82f6" />
          <span style={{ fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px" }}>Configurar Filtros</span>
        </div>

        {/* YEAR SELECTION */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <label style={{ fontSize: "12px", color: th.textSecondary }}>Ano:</label>
          <select 
            value={filterYear}
            onChange={(e) => setFilterYear(Number(e.target.value))}
            style={{
              background: th.selectBg,
              border: "1px solid " + th.selectBorder,
              color: th.selectColor,
              fontSize: "12px",
              borderRadius: "6px",
              padding: "5px 10px",
              outline: "none",
              cursor: "pointer"
            }}
          >
            {[2024, 2025, 2026, 2027].map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>

        {/* MONTH SELECTION */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <label style={{ fontSize: "12px", color: th.textSecondary }}>Mês:</label>
          <select 
            value={filterMonth}
            onChange={(e) => setFilterMonth(Number(e.target.value))}
            style={{
              background: th.selectBg,
              border: "1px solid " + th.selectBorder,
              color: th.selectColor,
              fontSize: "12px",
              borderRadius: "6px",
              padding: "5px 10px",
              outline: "none",
              cursor: "pointer"
            }}
          >
            {MONTHS_NAMES.map((name, idx) => (
              <option key={idx} value={idx + 1}>{name}</option>
            ))}
          </select>
        </div>

        {/* MONTHS RANGE (Last X months) */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <label style={{ fontSize: "12px", color: th.textSecondary }}>Período Histórico:</label>
          <select 
            value={filterMonthsRange}
            onChange={(e) => setFilterMonthsRange(Number(e.target.value))}
            style={{
              background: th.selectBg,
              border: "1px solid " + th.selectBorder,
              color: th.selectColor,
              fontSize: "12px",
              borderRadius: "6px",
              padding: "5px 10px",
              outline: "none",
              cursor: "pointer"
            }}
          >
            <option value={1}>Último Mês</option>
            <option value={3}>Últimos 3 meses</option>
            <option value={6}>Últimos 6 meses</option>
            <option value={12}>Últimos 12 meses</option>
          </select>
        </div>

        {/* START DATE (Specifically for Weekly Awards) */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <label style={{ fontSize: "12px", color: th.textSecondary }}>Semanal Início:</label>
          <input 
            type="date"
            value={filterStartDate}
            onChange={(e) => setFilterStartDate(e.target.value)}
            style={{
              background: th.selectBg,
              border: "1px solid " + th.selectBorder,
              color: th.selectColor,
              fontSize: "12px",
              borderRadius: "6px",
              padding: "4px 8px",
              outline: "none",
              colorScheme: isDark ? "dark" : "light"
            }}
          />
        </div>
      </section>

      {/* PORTAL BODY CONTAINER */}
      <main style={{ padding: "24px", flex: 1 }}>
        
        {/* Dynamic Section Intro Bar */}
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "18px",
          maxWidth: "1000px"
        }}>
          <div>
            <h2 style={{
              margin: 0,
              fontSize: "16px",
              fontWeight: 600,
              color: th.textPrimary
            }}>Relatórios de {currentSection?.label}</h2>
            <p style={{ margin: "2px 0 0", fontSize: "12px", color: th.textSecondary }}>
              Os relatórios usam de forma nativa os parâmetros e filtros definidos no cabeçalho.
            </p>
          </div>
          <span style={{
            fontSize: "11px",
            background: th.panelBg,
            border: "1px solid " + th.borderColor,
            color: th.textMuted,
            padding: "4px 10px",
            borderRadius: "5px"
          }}>
            {currentSection?.reports.length} de {totalReportsCount} totais
          </span>
        </div>

        {/* GRID OF INDIVIDUAL REPORTS CARDS (Tarefa 2) */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(290px, 1fr))",
          gap: "16px",
          maxWidth: "1000px",
        }}>
          {currentSection?.reports.map((r) => {
            const isLoading = loadingId === r.id;
            const accent = currentSection.accent;

              return (
                <div key={r.id} style={{
                  background: th.cardBg,
                  border: "1px solid " + th.borderColor,
                  borderRadius: "14px",
                  padding: "20px",
                  transition: "all 0.25s",
                  position: "relative",
                  display: "flex",
                  flexDirection: "column",
                  overflow: "hidden",
                  height: r.id === "resumo_loja" ? "auto" : "210px",
                  minHeight: "210px"
                }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = accent + "60";
                e.currentTarget.style.transform = "translateY(-2px)";
                e.currentTarget.style.boxShadow = `0 8px 24px ${accent}0b`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = th.borderColor;
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "none";
              }}
              >
                <div style={{
                  position: "absolute", top: -35, right: -35,
                  width: 90, height: 90,
                  background: `radial-gradient(circle, ${accent}08 0%, transparent 70%)`,
                  borderRadius: "50%", pointerEvents: "none",
                }} />

                <div style={{ display: "flex", alignItems: "flex-start", gap: "12px", marginBottom: "8px" }}>
                  <div style={{
                    fontSize: 22, width: 44, height: 44,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    background: `${accent}12`, borderRadius: "10px", flexShrink: 0,
                    color: accent
                  }}>{r.icon}</div>
                  <div style={{ minWidth: 0 }}>
                    <h3 style={{
                      margin: "0 0 3px", fontSize: "14px", fontWeight: 600,
                      color: th.textPrimary,
                      lineHeight: "1.3"
                    }}>{r.title}</h3>
                    <span style={{
                      fontSize: "11px", color: accent, fontWeight: 500,
                      opacity: 0.9,
                    }}>{r.tag}</span>
                  </div>
                </div>

                <p style={{
                  fontSize: "12px", color: th.textDesc,
                  lineHeight: 1.5, margin: "0 0 auto",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  display: "-webkit-box",
                  WebkitLineClamp: 3,
                  WebkitBoxOrient: "vertical"
                }}>{r.desc}</p>

                {r.id === "resumo_loja" && (
                  <div style={{ marginTop: "10px", display: "flex", flexDirection: "column", gap: "4px" }}>
                    <label style={{ fontSize: "11px", color: th.textSecondary, fontWeight: 500 }}>Filtrar Loja:</label>
                    <select
                      value={selectedStore}
                      onChange={(e) => setSelectedStore(Number(e.target.value))}
                      style={{
                        background: th.selectBg,
                        border: "1px solid " + th.selectBorder,
                        color: th.selectColor,
                        fontSize: "12px",
                        borderRadius: "6px",
                        padding: "5px 10px",
                        outline: "none",
                        cursor: "pointer",
                        width: "100%"
                      }}
                    >
                      <option value={0}>Todas as lojas (resumo)</option>
                      {stores.map(s => (
                        <option key={s.number} value={s.number}>
                          Loja {s.number} - {s.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div style={{ marginTop: "14px" }}>
                  <button
                    onClick={() => handleGenerate(r)}
                    disabled={isLoading}
                    style={{
                      width: "100%", padding: "9px 14px",
                      background: isLoading ? `${accent}25` : `${accent}e6`,
                      color: "#fff", border: "none", borderRadius: "8px",
                      fontSize: "12px", fontWeight: 600, cursor: isLoading ? "wait" : "pointer",
                      transition: "all 0.2s",
                      display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
                      boxShadow: isLoading ? "none" : `0 4px 12px ${accent}20`,
                    }}
                    onMouseEnter={(e) => { if (!isLoading) e.currentTarget.style.background = accent; }}
                    onMouseLeave={(e) => { if (!isLoading) e.currentTarget.style.background = `${accent}e6`; }}
                  >
                    {isLoading ? (
                      <>
                        <span style={{
                          display: "inline-block", width: 14, height: 14,
                          border: "2px solid rgba(255,255,255,0.25)",
                          borderTopColor: "#fff", borderRadius: "50%",
                          animation: "spin .7s linear infinite",
                        }} />
                        Processando...
                      </>
                    ) : (
                      <>
                        <Eye size={13} />
                        Gerar Preview & PDF
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {/* DYNAMIC DATA PREVIEW MODAL / EXPANDABLE SECTION (Tarefa 5) */}
      {previewData && (
        <div style={{
          position: "fixed",
          top: 0, left: 0, right: 0, bottom: 0,
          background: th.modalOverlayBg,
          zIndex: 1000,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          padding: "24px",
          backdropFilter: "blur(6px)"
        }}>
          <div style={{
            background: th.panelBg,
            border: "1px solid " + th.borderColor,
            borderRadius: "16px",
            width: "100%",
            maxWidth: "1100px",
            maxHeight: "90vh",
            display: "flex",
            flexDirection: "column",
            boxShadow: isDark ? "0 20px 50px rgba(0,0,0,0.6)" : th.shadow,
            overflow: "hidden",
            animation: "fadeIn 0.2s ease-out"
          }}>
            
            {/* Modal Header */}
            <header style={{
              padding: "18px 24px",
              borderBottom: "1px solid " + th.borderColor,
              background: th.cardBg,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center"
            }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span style={{ fontSize: "20px" }}>{previewData.report.icon}</span>
                  <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 700, color: th.previewsHeaderTitle }}>
                    {previewData.report.title}
                  </h3>
                </div>
                <p style={{ margin: "2px 0 0", fontSize: "12px", color: th.textMuted }}>
                  Real Calçados · Dados consultados com os filtros atuais
                </p>
              </div>

              {/* Action Operations */}
              <div style={{ display: "flex", gap: "10px" }}>
                <button 
                  onClick={handleDownloadPDF}
                  style={{
                    background: "linear-gradient(135deg, #10b981, #059669)",
                    color: "#fff",
                    border: "none",
                    borderRadius: "8px",
                    fontWeight: 600,
                    fontSize: "12px",
                    padding: "8px 16px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    boxShadow: "0 4px 12px rgba(16,185,129,0.25)"
                  }}
                >
                  <Download size={14} />
                  Baixar PDF
                </button>
                <button 
                  onClick={() => setPreviewData(null)}
                  style={{
                    background: th.borderColor,
                    color: th.textSecondary,
                    border: "none",
                    borderRadius: "8px",
                    padding: "8px 14px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px"
                  }}
                >
                  <X size={15} />
                  Fechar
                </button>
              </div>
            </header>

            {/* Modal Body with Summary and Tables */}
            <div style={{
              padding: "24px",
              overflowY: "auto",
              flex: 1,
              display: "flex",
              flexDirection: "column",
              gap: "20px"
            }}>
              
              {/* Top Summary Cards / Metricas */}
              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: "14px"
              }}>
                <div style={{
                  background: th.cardBg,
                  border: "1px solid " + th.borderColor,
                  borderRadius: "10px",
                  padding: "14px 16px"
                }}>
                  <div style={{ fontSize: "11px", color: th.textMuted, textTransform: "uppercase", fontWeight: 600 }}>
                    Registros Identificados
                  </div>
                  <div style={{ fontSize: "20px", fontWeight: 700, color: th.textPrimary, marginTop: "4px" }}>
                    {previewData.summary.totalRows}
                  </div>
                </div>

                <div style={{
                  background: th.cardBg,
                  border: "1px solid " + th.borderColor,
                  borderRadius: "10px",
                  padding: "14px 16px"
                }}>
                  <div style={{ fontSize: "11px", color: th.textMuted, textTransform: "uppercase", fontWeight: 600 }}>
                    {previewData.summary.primaryMetricName}
                  </div>
                  <div style={{ fontSize: "20px", fontWeight: 700, color: "#10b981", marginTop: "4px" }}>
                    {previewData.summary.primaryMetricValue}
                  </div>
                </div>

                {previewData.summary.secondaryMetricName && (
                  <div style={{
                    background: th.cardBg,
                    border: "1px solid " + th.borderColor,
                    borderRadius: "10px",
                    padding: "14px 16px"
                  }}>
                    <div style={{ fontSize: "11px", color: th.textMuted, textTransform: "uppercase", fontWeight: 600 }}>
                      {previewData.summary.secondaryMetricName}
                    </div>
                    <div style={{ fontSize: "20px", fontWeight: 700, color: "#eab308", marginTop: "4px" }}>
                      {previewData.summary.secondaryMetricValue}
                    </div>
                  </div>
                )}
              </div>

              {/* Data Table View */}
              <div style={{
                border: "1px solid " + th.borderColor,
                borderRadius: "10px",
                background: th.cardBg,
                overflow: "hidden"
              }}>
                <div style={{ overflowX: "auto" }}>
                  <table style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    textAlign: "left",
                    fontSize: "12px"
                  }}>
                    <thead>
                      <tr style={{ background: th.thBg, borderBottom: "1px solid " + th.borderColor }}>
                        {Object.keys(previewData.data[0]).map((key) => (
                          <th 
                            key={key} 
                            style={{ 
                              padding: "12px 14px", 
                              color: th.thText, 
                              fontWeight: 600,
                              whiteSpace: "nowrap"
                            }}
                          >
                            {getTranslatedHeader(key)}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {previewData.data.map((row, rowIdx) => (
                        <tr 
                          key={rowIdx} 
                          style={{ 
                            borderBottom: "1px solid " + th.tdBorder,
                            background: rowIdx % 2 === 0 ? th.cardBg : th.panelBg,
                            transition: "background 0.15s"
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = th.tableRowHover; }}
                          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = rowIdx % 2 === 0 ? th.cardBg : th.panelBg; }}
                        >
                          {Object.keys(row).map((key) => {
                            const rawValue = String(row[key] || "").toLowerCase();
                            // Render with appropriate styling
                            let textCellColor = th.textPrimary;
                            let cellFontWeight = "normal";

                            if (rawValue === "crítico" || rawValue === "esgotado") {
                              textCellColor = "#f87171";
                              cellFontWeight = "600";
                            } else if (rawValue === "atenção" || rawValue === "alerta") {
                              textCellColor = "#fbbf24";
                              cellFontWeight = "600";
                            } else if (rawValue === "ok" || rawValue === "ativa") {
                              textCellColor = "#34d399";
                              cellFontWeight = "600";
                            }

                            return (
                              <td 
                                key={key} 
                                style={{ 
                                  padding: "10px 14px", 
                                  color: textCellColor,
                                  fontWeight: cellFontWeight as any,
                                  whiteSpace: "nowrap"
                                }}
                              >
                                {getRowValue(row, key)}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
            
            {/* Modal Footer helper */}
            <footer style={{
              padding: "14px 24px",
              borderTop: "1px solid " + th.borderColor,
              background: th.panelBg,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              fontSize: "11px",
              color: th.textSecondary
            }}>
              <span>Utilize o botão de "Baixar PDF" para obter a versão impressa pronta para A4.</span>
              <span>Total de {previewData.data.length} linhas renderizadas.</span>
            </footer>
          </div>
        </div>
      )}

      {/* FOOTER METADATA */}
      <footer style={{
        padding: "16px 24px",
        borderTop: "1px solid " + th.borderHeaderColor,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        background: th.panelBg,
        fontSize: "11px"
      }}>
        <p style={{ color: th.textMuted, margin: 0 }}>
          Clique em <strong style={{ color: th.textSecondary }}>Gerar Preview & PDF</strong> para rodar a query na nuvem.
        </p>
        <p style={{ color: th.textMuted, margin: 0 }}>
          RealAdmin · Supabase Postgres · jsPDF Autotable
        </p>
      </footer>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity: 0; transform: scale(0.98); } to { opacity: 1; transform: scale(1); } }
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #1e293b; border-radius: 4px; }
        ::-webkit-scrollbar-thumb:hover { background: #334155; }
      `}</style>
    </div>
  );
}
