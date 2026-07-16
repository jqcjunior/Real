import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  Dispatch,
  SetStateAction,
} from "react";
import { Pencil, X, Download, RefreshCw, Printer, Plus, Copy, ShoppingCart } from "lucide-react";
import { toast } from "sonner";
import { printOrder } from './BuyOrderPrintView';
import ProductPhotoUpload from './ProductPhotoUpload';
import { supabase } from "../../services/supabaseClient";
import { cleanupOrphanPhotos } from "../../services/cleanupOrphanPhotos";
import apiService from '../../services/apiService';
import { useBrandAutocomplete } from "../../hooks/useBrandAutocomplete";
import { usePermissions } from "../../hooks/usePermissions";
import { useUserStorePermissions } from "../../hooks/useUserStorePermissions";
import { User, UserRole } from "../../types";
import {
  insertBuyOrderItems,
  fetchPreviousPrice,
  tipoParaModelo,
  normalizeGrades,
  BuyOrderItemInput,
} from "./buyOrderItems.utils";
import StepPedidos, {
  GradeItem,
  ItemComGrades,
  OrderItem,
  SubOrder,
  Cabecalho,
} from "./BuyOrderStepPedidos";
import { BuyOrderModuleModal } from "./BuyOrderModuleModal";
import { StandByModal } from "./StandByModal";
import { QuotaInsufficientModal } from "../QuotaInsufficientModal";
import StandByDashboard from "./StandByDashboard";
import SolicitarCotaExtraModal from "../SolicitarCotaExtraModal";
import SurveyVotingScreen from "./SurveyVotingScreen";
import SurveyProgressModal from "./SurveyProgressModal";
import StepCabecalho from "./BuyOrderStepCabecalho";
import StepItens from "./BuyOrderStepItens";

// ... AlertasCardSticky component ...
interface Alerta {
  tipo: "marca" | "produto";
  nivel: "warning" | "error" | "info";
  icone: string;
  titulo: string;
  mensagem: string;
}

const AlertasCardSticky = ({
  marca,
  lojasSelecionadas,
  itens,
}: {
  marca: string;
  lojasSelecionadas: number[];
  itens: any[];
}) => {
  const [alertas, setAlertas] = useState<Alerta[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    verificarRestricoesCompletas();
  }, [marca, JSON.stringify(lojasSelecionadas), itens]);

  const verificarRestricoesCompletas = async () => {
    setLoading(true);
    const novosAlertas: Alerta[] = [];

    // 1. Verificar restrições de MARCA
    if (marca && lojasSelecionadas.length > 0) {
      const { data: restricaoMarca } = await supabase
        .from("buy_brand_store_restrictions")
        .select("*")
        .ilike("marca", marca)
        .eq("ativo", true)
        .maybeSingle();

      if (restricaoMarca && restricaoMarca.lojas_proibidas) {
        const lojasConflito = lojasSelecionadas.filter((loja) =>
          restricaoMarca.lojas_proibidas.includes(loja),
        );

        if (lojasConflito.length > 0) {
          novosAlertas.push({
            tipo: "marca",
            nivel: "error",
            icone: "⛔",
            titulo: marca,
            mensagem: `Lojas ${lojasConflito.join(", ")} não podem comprar esta marca`,
          });
        }
      }
    }

    // 2. Verificar restrições de PRODUTOS
    for (const item of itens) {
      if (!item.tipo) continue;

      const { data: restricaoProduto } = await supabase
        .from("buy_product_store_restrictions")
        .select("*")
        .ilike("tipo_produto", item.tipo)
        .eq("ativo", true)
        .maybeSingle();

      if (restricaoProduto && restricaoProduto.lojas_proibidas) {
        const lojasConflito = lojasSelecionadas.filter((loja) =>
          restricaoProduto.lojas_proibidas.includes(loja),
        );

        if (lojasConflito.length > 0) {
          novosAlertas.push({
            tipo: "produto",
            nivel: "warning",
            icone: "⚠️",
            titulo: item.tipo,
            mensagem: `Lojas ${lojasConflito.join(", ")} não vendem este produto`,
          });
        }
      }
    }

    setAlertas(novosAlertas);
    setLoading(false);
  };

  const alertasErro = alertas.filter((a) => a.nivel === "error");
  const alertasAviso = alertas.filter((a) => a.nivel === "warning");
  const temProblemas = alertasErro.length > 0 || alertasAviso.length > 0;

  if (alertas.length === 0) {
    return (
      <div className="sticky bottom-0 bg-white border-t border-gray-200 py-2">
        <div className="max-w-md mx-auto text-center">
          <p className="text-sm text-gray-400">
            {loading ? "Verificando restrições..." : "Nenhum alerta"}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="sticky bottom-0 bg-white border-t-2 border-gray-300 shadow-lg py-3 z-50">
      <div className="max-w-3xl mx-auto px-4">
        <div
          className={`
            relative rounded-lg shadow-inner border-2 transition-all duration-300
            ${
              temProblemas
                ? "bg-gradient-to-r from-yellow-50 via-orange-50 to-red-50 border-red-300"
                : "bg-gradient-to-r from-green-50 to-emerald-50 border-green-300"
            }
          `}
        >
          <div
            className={`
            px-3 py-2 border-b flex items-center justify-between
            ${temProblemas ? "border-red-300 bg-red-100/50" : "border-green-300 bg-green-100/50"}
          `}
          >
            <div className="flex items-center gap-2">
              <span className="text-lg">{temProblemas ? "⚠️" : "✅"}</span>
              <h4 className="font-semibold text-sm text-gray-800">
                ALERTAS E RESTRIÇÕES
              </h4>
            </div>

            {temProblemas && (
              <div className="bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                {alertasErro.length + alertasAviso.length}
              </div>
            )}

            {loading && (
              <div className="animate-spin h-4 w-4 border-2 border-gray-400 rounded-full border-t-transparent" />
            )}
          </div>

          <div className="px-3 py-2 flex gap-2 overflow-x-auto">
            {alertasErro.map((alerta, idx) => (
              <div
                key={`erro-${idx}`}
                className="flex-shrink-0 w-64 flex items-start gap-2 bg-red-50 border border-red-300 rounded p-2"
              >
                <span className="text-lg flex-shrink-0">{alerta.icone}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-red-900 text-xs truncate">
                    {alerta.titulo}
                  </p>
                  <p className="text-red-700 text-xs">{alerta.mensagem}</p>
                </div>
              </div>
            ))}

            {alertasAviso.map((alerta, idx) => (
              <div
                key={`aviso-${idx}`}
                className="flex-shrink-0 w-64 flex items-start gap-2 bg-yellow-50 border border-yellow-300 rounded p-2"
              >
                <span className="text-lg flex-shrink-0">{alerta.icone}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-yellow-900 text-xs truncate">
                    {alerta.titulo}
                  </p>
                  <p className="text-yellow-700 text-xs">{alerta.mensagem}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface Brand {
  id: string;
  marca: string;
  fornecedor: string;
  representante: string;
  telefone: string;
  email: string;
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const SUBGRUPO = [
  5, 8, 9, 26, 31, 34, 40, 43, 44, 45, 50, 56, 72, 88, 96, 100, 102, 109,
];
const ALL_LOJAS = Array.from({ length: 120 }, (_, i) => i + 1);
const GRADE_LETTERS = "ABCDEFG";

const CATS: Record<string, { label: string; sizes: string[] }> = {
  MASC: {
    label: "Masc",
    sizes: [37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48].map(String),
  },
  FEM: {
    label: "Fem",
    sizes: [33, 34, 35, 36, 37, 38, 39, 40, 41, 42].map(String),
  },
  INF: {
    label: "Inf",
    sizes: [
      16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32,
    ].map(String),
  },
  ACES: { label: "Acess", sizes: ["UN", "P", "M", "G", "GG"] },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function parsePrazos(raw: string): number[] {
  return raw
    .split("/")
    .map((s) => parseInt(s.trim()))
    .filter((n) => !isNaN(n) && n > 0)
    .slice(0, 7);
}

function addDays(dateStr: string, days: number): string {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toLocaleDateString("pt-BR");
}

export function calcularPrecoVenda(
  custo: number,
  desconto: number,
  markup: number,
): number {
  if (!custo || custo <= 0 || !markup || markup <= 0) return 0;
  const custoLiquido = custo * (1 - (desconto || 0) / 100);
  const valorBase = custoLiquido * markup;
  const dezena = Math.floor(valorBase / 10) * 10;

  return valorBase < dezena + 5 ? dezena + 9.99 : dezena + 19.99;
}

export function fmtBRL(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function totPares(qtds: Record<string, number>): number {
  return Object.values(qtds).reduce((s, v) => s + (v || 0), 0);
}

export const getCategoryBadge = (tipo: string): { label: string; color: string } => {
  const t = (tipo || '').toUpperCase().trim();
  if (t === 'ACES' || t.includes('ACESSORIO') || t.includes('ACESSÓRIO')) 
    return { label: 'ACES', color: 'bg-purple-100 text-purple-700' };
  if (t === 'INF' || t.includes('INFANTIL')) 
    return { label: 'INF', color: 'bg-amber-100 text-amber-700' };
  if (t === 'FEM' || t.includes('FEMININO')) 
    return { label: 'FEM', color: 'bg-pink-100 text-pink-700' };
  if (t === 'MASC' || t.includes('MASCULINO')) 
    return { label: 'MASC', color: 'bg-blue-100 text-blue-700' };
  return { label: t || '', color: t ? 'bg-gray-100 text-gray-700' : 'bg-transparent text-transparent' };
};

// ─── Componente principal ─────────────────────────────────────────────────────

interface BuyOrderModuleProps {
  user?: User;
  navigationParams?: { order_id?: string };
  onClearNavigationParams?: () => void;
}

export default function BuyOrderModule({
  user,
  navigationParams,
  onClearNavigationParams,
}: BuyOrderModuleProps) {
  const [step, setStep] = useState(0);
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' ? window.innerWidth < 768 : false
  );

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  const [cab, setCab] = useState<Cabecalho>({
    role: "comprador",
    brand_id: null,
    marca: "",
    fornecedor: "",
    representante: "",
    telefone: "",
    email: "",
    fat_inicio: "",
    fat_fim: "",
    prazos: [],
    markup: 2.6,
    desconto: 0,
    modo_pesquisa: false,
    survey_params: null,
  });

  useEffect(() => {
    if (user) {
      const role = String(user?.role || "").toUpperCase();
      const modoInterface =
        role === "ADMIN" || role === "COMPRADOR" ? "comprador" : "gerente";
      setCab((prev) => ({
        ...prev,
        role: modoInterface,
      }));
    }
  }, [user]);

  useEffect(() => {
    async function setupSession() {
      if (user?.id) {
        await supabase.rpc("set_user_session", { p_user_id: user.id });
      }
    }
    setupSession();
  }, [user]);
  const [prazosRaw, setPrazosRaw] = useState("");
  const orderFormRef = useRef<HTMLDivElement>(null);
  const prazosInputRef = useRef<HTMLInputElement>(null);
  const [highlightHeader, setHighlightHeader] = useState(false);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [pedidos, setPedidos] = useState<SubOrder[]>([]);
  const [saving, setSaving] = useState(false);
  const [showSolicitarCotaExtra, setShowSolicitarCotaExtra] = useState(false);
  const [validationError, setValidationError] = useState<any>(null);
  const [error, setError] = useState("");
  const [userStoreNumber, setUserStoreNumber] = useState<string | null>(null);
  const [gerentePedidosLiberado, setGerentePedidosLiberado] = useState<boolean | null>(null);

  useEffect(() => {
    async function fetchUserStoreNumber() {
      const isAdmin = String(user?.role || "").toUpperCase() === "ADMIN";
      if (user && !isAdmin && user.storeId) {
        const { data } = await supabase
          .from("stores")
          .select("number, gerente_pode_lancar_pedido")
          .eq("id", user.storeId)
          .single();
        if (data?.number) {
          setUserStoreNumber(data.number);
          setGerentePedidosLiberado(data.gerente_pode_lancar_pedido !== false);
        }
      }
    }
    fetchUserStoreNumber();
  } , [user]);
  const [numeroPedidoSalvo, setNumeroPedidoSalvo] = useState<number | null>(
    null,
  );
  const [exportando, setExportando] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [orderNumberFilter, setOrderNumberFilter] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [dataInicio, setDataInicio] = useState<string>("");
  const [dataFim, setDataFim] = useState<string>("");
  const PAGE_SIZE = 20;
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  const [selectedLoja, setSelectedLoja] = useState<number | null>(null);

  useEffect(() => {
    setPage(0);
  }, [searchTerm, roleFilter, selectedLoja, statusFilter, dataInicio, dataFim, orderNumberFilter]);

  useEffect(() => {
    if (navigationParams && navigationParams.order_id) {
      const getOrderNumber = async () => {
        try {
          const { data, error } = await supabase
            .from("buy_orders")
            .select("numero_pedido")
            .eq("id", navigationParams.order_id)
            .single();
          if (data && data.numero_pedido) {
            setOrderNumberFilter(String(data.numero_pedido));
          }
        } catch (err) {
          console.error("Erro ao resolver order_id para numero_pedido:", err);
        } finally {
          if (onClearNavigationParams) {
            onClearNavigationParams();
          }
        }
      };
      getOrderNumber();
    }
  }, [navigationParams, onClearNavigationParams]);

  const [limitPedidos, setLimitPedidos] = useState(5);
  const [totalPedidos, setTotalPedidos] = useState(0);
  const [roundBase, setRoundBase] = useState(15.5);
  const [loading, setLoading] = useState(false);
  const [loadingRecent, setLoadingRecent] = useState(false);
  const [deletingOrder, setDeletingOrder] = useState<any | null>(null);
  const [copyingOrder, setCopyingOrder] = useState<any | null>(null);
  const [copiedFromPedido, setCopiedFromPedido] = useState<{ numero: number; marca: string } | null>(null);

  const [step2State, setStep2State] = useState({
    selectedItems: new Set<number>(),
    tempPedidoItens: [] as ItemComGrades[],
    gradesGlobais: {} as Record<
      string,
      { cat: string; qtds: Record<string, number> }
    >,
    gradeExpandida: null as string | null,
    selectedLojas: [] as number[],
    lojaMode: null as "sub" | "all" | null,
  });

  useEffect(() => {
    supabase
      .from("pricing_round_parameters")
      .select("round_base")
      .maybeSingle()
      .then(({ data, error }) => {
        if (!error && data?.round_base != null) {
          setRoundBase(Number(data.round_base));
        }
      });
  }, []);

  const prevDesconto = useRef<number>(cab.desconto);
  const prevMarkup = useRef<number>(cab.markup);

  useEffect(() => {
    const desconto = Number(cab.desconto) || 0;
    const markup = Number(cab.markup) || 0;

    if (
      prevDesconto.current === desconto &&
      prevMarkup.current === markup
    ) {
      return;
    }

    prevDesconto.current = desconto;
    prevMarkup.current = markup;

    if (markup <= 0) return;

    setItems((prevItems) => {
      if (prevItems.length === 0) return prevItems;
      return prevItems.map((item) => {
        const custo = Number(item.custo) || 0;
        if (custo <= 0) return item;

        const novaVenda = calcularPrecoVenda(custo, desconto, markup);
        return { ...item, preco_venda: novaVenda };
      });
    });
  }, [cab.desconto, cab.markup]);

  const [recentOrders, setRecentOrders] = useState<any[]>([]);

  const isHeaderValid = !!(
    cab.marca &&
    cab.fornecedor &&
    cab.representante &&
    cab.telefone &&
    cab.email &&
    cab.fat_inicio &&
    cab.fat_fim &&
    cab.prazos.length > 0 &&
    cab.markup >= 0 &&
    cab.desconto >= 0 &&
    cab.desconto < 100 &&
    new Date(cab.fat_inicio + "T00:00:00").getMonth() ===
      new Date(cab.fat_fim + "T00:00:00").getMonth() &&
    new Date(cab.fat_inicio + "T00:00:00").getFullYear() ===
      new Date(cab.fat_fim + "T00:00:00").getFullYear()
  );

  const { isAdmin, isManager, canEditOrder, canConfirmOrder, canCancelOrder } =
    usePermissions(user);

  // ✅ NOVO: Hook de permissões
  const {
    loading: loadingPermissions,
    stores: allowedStores,
    canViewAllStores,
    hasAccess,
  } = useUserStorePermissions(user!, "buy_order_module");

  const fetchRecentOrders = useCallback(async () => {
    setLoadingRecent(true);
    try {
      // ✅ 1. BUSCAR NÚMERO DA LOJA DO USUÁRIO
      let userStoreNumber: number | null = null;

      if (user && user.storeId && (isManager || !isAdmin)) {
        const { data: storeData } = await supabase
          .from("stores")
          .select("number")
          .eq("id", user.storeId)
          .single();

        userStoreNumber = storeData?.number ? parseInt(storeData.number) : null;
      }

      // 2. Buscar pedidos base
      let query = supabase
        .from("buy_orders")
        .select("*, buy_order_sub_orders(lojas_numeros)", { count: "exact" })
        .order("numero_pedido", { ascending: false })
        .range(0, (page + 1) * PAGE_SIZE - 1);

      // 3. Aplicar busca por texto
      const searchTxt = searchTerm.trim();
      if (searchTxt) {
        const isNumeric = /^\d+$/.test(searchTxt);
        const filters = [
          `marca.ilike.%${searchTxt}%`,
          `fornecedor.ilike.%${searchTxt}%`
        ];
        if (isNumeric) {
          filters.push(`numero_pedido.eq.${searchTxt}`);
        }
        query = query.or(filters.join(','));
      }

      // NOVO: Filtro de Número do Pedido
      const orderNumTxt = orderNumberFilter.trim();
      if (orderNumTxt) {
        if (/^\d+$/.test(orderNumTxt)) {
          query = query.eq('numero_pedido', parseInt(orderNumTxt));
        } else {
          query = query.eq('id', '00000000-0000-0000-0000-000000000000');
        }
      }

      // NOVO: Filtro de Papel
      if (roleFilter) {
        query = query.eq('user_role', roleFilter);
      }

      // Filtro de Data (Server-Side)
      if (dataInicio) {
        query = query.gte('created_at', dataInicio + 'T00:00:00');
      }
      if (dataFim) {
        query = query.lte('created_at', dataFim + 'T23:59:59');
      }

      // Filtro de Status
      if (statusFilter) {
        if (statusFilter === "nao_exportado") {
          query = query.neq("status", "exportado");
        } else {
          query = query.eq("status", statusFilter);
        }
      }



      // Buscar pedidos
      const {
        data: allOrders,
        error: fetchError,
        count,
      } = await query;

      if (fetchError) throw fetchError;

      let finalData = allOrders || [];

      if (isManager && userStoreNumber) {
        // Filtrar no frontend os pedidos que incluem a loja do gerente
        finalData = finalData.filter((order: any) => {
          const subOrders = order.buy_order_sub_orders || [];
          const todasLojas = subOrders.flatMap(
            (sub: any) => sub.lojas_numeros || [],
          );
          return todasLojas.includes(userStoreNumber!);
        });
      }

      if (selectedLoja) {
        // Se houver filtro de loja na interface (para Admin ou usuários com permissão)
        finalData = finalData.filter((order) => {
          const subOrders = order.buy_order_sub_orders || [];
          const todasLojas = subOrders.flatMap(
            (sub: any) => sub.lojas_numeros || [],
          ).map(Number);
          return todasLojas.includes(Number(selectedLoja));
        });
      }

      setRecentOrders(finalData);
      setHasMore(allOrders?.length === (page + 1) * PAGE_SIZE);
      setTotalPedidos(count || 0);
    } catch (error: any) {
      console.error("Erro ao buscar pedidos:", error);
      toast.error(`❌ ${error.message || "Erro ao carregar pedidos"}`);
    } finally {
      setLoadingRecent(false);
    }
  }, [searchTerm, selectedLoja, roleFilter, statusFilter, dataInicio, dataFim, page, user, isManager, isAdmin, orderNumberFilter]);

  useEffect(() => {
    fetchRecentOrders();
  }, [fetchRecentOrders]);

  const STEPS = ["Cabeçalho", "Itens", "Pedidos"];

  // ─── Navegação ──────────────────────────────────────────────────────────────

  function navNext() {
    if (step === 0) {
      if (!isHeaderValid) {
        setError(
          "Preencha todos os campos obrigatórios do cabeçalho (verifique se as datas de faturamento estão no mesmo mês).",
        );
        return;
      }
    }
    if (step === 1) {
      if (items.length === 0) {
        setError("Adicione ao menos um item antes de continuar.");
        return;
      }
      setStep2State((prev: any) => ({
        ...prev,
        tempPedidoItens: (prev.tempPedidoItens || []).filter(
          (icg: any) => icg.itemIdx >= 0 && icg.itemIdx < items.length,
        ),
      }));
      setPedidos((prev: any[]) => {
        return (prev || []).map((ped) => ({
          ...ped,
          itensComGrades: (ped.itensComGrades || []).filter(
            (icg: any) => icg.itemIdx >= 0 && icg.itemIdx < items.length,
          ),
        }));
      });
    }
    setError("");
    setStep((s) => s + 1);
  }

  // ─── Salvar no Supabase ──────────────────────────────────────────────────────

  const [showStandByModalForOrderId, setShowStandByModalForOrderId] = useState<
    string | null
  >(null);
  const [surveyVotingOrder, setSurveyVotingOrder] = useState<{ orderId: string; subOrderNum: number; storeId: string; numero: number; marca: string } | null>(null);
  const [surveyProgressOrder, setSurveyProgressOrder] = useState<{ orderId: string; numero: number; marca: string } | null>(null);
  const [quotaModalData, setQuotaModalData] = useState<any | null>(null);

  async function handleSave(
    targetAction: "rascunho" | "rascunho_then_standby" | "confirmado",
  ) {
    setSaving(true);
    setError("");
    let numeroPedidoLocal: number | null = null;
    try {
      const order = editingOrder;
      // ✅ VALIDAÇÃO 1: Verificar se há ITENS
      if (items.length === 0) {
        throw new Error('Adicione ao menos um item antes de salvar');
      }

      // ✅ VALIDAÇÃO 2: Verificar se há PEDIDOS (sub-orders com itens vinculados)
      // Em modo pesquisa, grades ainda não existem — sub-orders com lojas são suficientes
      const needsGrades = !cab.modo_pesquisa;
      if (pedidos.length === 0 || (needsGrades && pedidos.every(p => p.itensComGrades.length === 0))) {
        throw new Error('Vincule ao menos um item com grade e crie um pedido antes de salvar');
      }

      // ✅ VALIDAÇÃO 3: Verificar LOJAS (para comprador)
      const hasLojas = pedidos.some(p => p.lojas.length > 0);
      if (!hasLojas && canViewAllStores) {
        throw new Error('Selecione ao menos uma loja para cada pedido');
      }

      // ✅ GARANTIR SESSÃO NO POSTGRES PARA RLS
      const userId = user?.id || (await getCurrentAppUserId());
      if (userId && userId !== "00000000-0000-0000-0000-000000000000") {
        await supabase.rpc("set_user_session", { p_user_id: userId });
      }

      // 0. Pré-calcular totais e vencimentos para validação
      let preTotalParesGeral = 0;
      let preTotalValorBrutoGeral = 0;
      pedidos.forEach((ped) => {
        ped.itensComGrades.forEach((icg) => {
          const item = items[icg.itemIdx];
          icg.grades.forEach((g) => {
            const pairsForItems = totPares(g.qtds);
            const pairsTotal = pairsForItems * ped.lojas.length;
            preTotalParesGeral += pairsTotal;
            preTotalValorBrutoGeral += pairsTotal * item.custo;
          });
        });
      });
      const preTotalValorLiquidoGeral = preTotalValorBrutoGeral * (1 - (cab.desconto || 0) / 100);

      const preVencimentos = cab.prazos.map((p) => {
        const d = new Date(cab.fat_fim + "T00:00:00");
        d.setDate(d.getDate() + p);
        return d;
      });

      // ✅ VALIDAÇÃO DE COTA (APENAS PARA CONFIRMAÇÃO DIRETA)
      if (targetAction === "confirmado") {
        // Validação de cota já é feita no BuyOrderStepPedidos antes de criar o pedido.
        // Aqui apenas prosseguimos com a confirmação.
      }

      // 1. Upsert brand em buy_brands
      let brandId = cab.brand_id;
      if (!brandId) {
        const { data: bId, error: bErr } = await supabase.rpc(
          "upsert_buy_brand",
          {
            p_marca: cab.marca,
            p_fornecedor: cab.fornecedor,
            p_representante: cab.representante,
            p_telefone: cab.telefone || null,
            p_email: cab.email || null,
          },
        );

        if (bErr) {
          const { data: bData, error: bErr2 } = await supabase
            .from("buy_brands")
            .upsert(
              {
                marca: cab.marca,
                fornecedor: cab.fornecedor,
                representante: cab.representante,
                telefone: cab.telefone || null,
                email: cab.email || null,
              },
              { onConflict: "marca" },
            )
            .select("id")
            .single();
          if (bErr2) throw bErr2;
          brandId = bData.id;
        } else {
          brandId = bId;
        }
      }

      // 2. Calcular vencimentos
      const vencimentos = cab.prazos.map((p) => {
        const d = new Date(cab.fat_fim + "T00:00:00");
        d.setDate(d.getDate() + p);
        return d.toISOString().split("T")[0];
      });

      // 3. Insert ou Update buy_orders - INICIALMENTE COMO RASCUNHO
      let orderId = editingOrderId;

      if (editingOrderId) {
        numeroPedidoLocal = numeroPedidoSalvo;
        // ✅ USAR FUNÇÃO SEGURA DO APISERVICE
        await apiService.updateBuyOrder(orderId, {
          user_name: user?.name || user?.email || "sistema",
          brand_id: brandId,
          marca: cab.marca,
          fornecedor: cab.fornecedor,
          representante: cab.representante,
          telefone: cab.telefone || null,
          email: cab.email || null,
          fat_inicio: cab.fat_inicio || null,
          fat_fim: cab.fat_fim,
          prazos: cab.prazos,
          vencimentos,
          desconto: cab.desconto,
          markup: cab.markup,
          modo_pesquisa: cab.modo_pesquisa || false,
          survey_params: cab.survey_params || null,
          status: cab.modo_pesquisa 
            ? "aguardando_pesquisa" 
            : (["stand_by", "confirmado", "exportado"].includes(order?.status || "") 
                ? order.status 
                : "rascunho"),
          edited_at: new Date().toISOString(),
        });

        // Buscar IDs atuais dos itens do pedido
        const { data: items_data } = await supabase
          .from("buy_order_items")
          .select("id")
          .eq("order_id", orderId);

        const existingItemIds = items_data?.map(i => i.id) || [];

        // Deletar grades e itens SOMENTE dos itens que serão recriados
        // (preserva itens que não foram alterados pelo usuário)
        if (existingItemIds.length > 0) {
          await supabase
            .from("buy_order_item_suborder_grades")
            .delete()
            .in("item_id", existingItemIds);
          
          await supabase
            .from("buy_order_items")
            .delete()
            .eq("order_id", orderId);
        }

        // Deletar sub-orders para recriar com as lojas novas/removidas
        await supabase
          .from("buy_order_sub_orders")
          .delete()
          .eq("order_id", orderId);
      } else {
        const { data: order, error: oErr } = await supabase
          .from("buy_orders")
          .insert({
            numero_pedido: 0,
            user_id: userId,
            user_name: user?.name || user?.email || "sistema",
            user_role: String(user?.role || "").toLowerCase(),
            brand_id: brandId,
            marca: cab.marca,
            fornecedor: cab.fornecedor,
            representante: cab.representante,
            telefone: cab.telefone || null,
            email: cab.email || null,
            fat_inicio: cab.fat_inicio || null,
            fat_fim: cab.fat_fim,
            prazos: cab.prazos,
            vencimentos,
            desconto: cab.desconto,
            markup: cab.markup,
            modo_pesquisa: cab.modo_pesquisa || false,
            survey_params: cab.survey_params || null,
            status: cab.modo_pesquisa ? "aguardando_pesquisa" : "rascunho", // Sempre salva inicialmente como rascunho
          })
          .select("id, numero_pedido")
          .single();
        if (oErr) throw oErr;
        orderId = order.id;
        setEditingOrderId(order.id);
        setNumeroPedidoSalvo(order.numero_pedido);
        numeroPedidoLocal = order.numero_pedido;
      }

      // 4. Insert buy_order_items
      if (items.length > 0) {
        if (cab.modo_pesquisa) {
          // MODO PESQUISA: salvar itens sem grades — grades virão dos votos dos gerentes
          const surveyItemRows = items.map((it, idx) => ({
            order_id: orderId,
            item_order: idx + 1,
            referencia: String(it.ref || '').trim(),
            tipo: String(it.tipo || '').trim().toUpperCase(),
            cor1: String(it.cor1 || '').trim().toUpperCase(),
            cor2: it.cor2 ? String(it.cor2).trim().toUpperCase() : null,
            cor3: it.cor3 ? String(it.cor3).trim().toUpperCase() : null,
            modelo: (it.modelo as any) || tipoParaModelo(String(it.tipo || '')),
            custo: it.custo,
            preco_venda: it.preco_venda,
            grades: [],
            total_pares: 0,
            markup_aplicado: cab.markup || null,
          }));
          const { error: siErr } = await supabase
            .from('buy_order_items')
            .insert(surveyItemRows);
          if (siErr) throw new Error(`Erro ao salvar itens da pesquisa: ${siErr.message}`);
          // Não insere buy_order_item_suborder_grades — não há grades ainda
        } else {
          // MODO NORMAL: fluxo existente com grades obrigatórias
          const itemInputs: BuyOrderItemInput[] = items
            .map((it, idx) => {
              const itemGradesObj: Record<string, any> = {};
              let totalParesItem = 0;
              pedidos.forEach((ped) => {
                const icg = ped.itensComGrades.find((x) => x.itemIdx === idx);
                if (icg) {
                  icg.grades.forEach((g) => {
                    itemGradesObj[g.letter] = g.qtds;
                    totalParesItem += totPares(g.qtds) * ped.lojas.length;
                  });
                }
              });
              // Retorna null se item não tem grade vinculada
              if (Object.keys(itemGradesObj).length === 0) return null;
              return {
                order_id: orderId,
                item_order: idx + 1,
                referencia: it.ref,
                tipo: it.tipo || "",
                cor1: it.cor1,
                cor2: it.cor2 || null,
                cor3: it.cor3 || null,
                modelo: (it.modelo as any) || tipoParaModelo(it.tipo),
                custo: it.custo,
                preco_venda: it.preco_venda,
                grades: itemGradesObj,
                total_pares: totalParesItem,
                markup_aplicado: cab.markup,
              } as BuyOrderItemInput;
            })
            .filter((item): item is BuyOrderItemInput => item !== null);

          const result = await insertBuyOrderItems(itemInputs);
          if (!result.success) {
            throw new Error("Erro ao salvar itens. Verifique os dados.");
          }

          const insertedItems = result.data!;

          // Salvar qual grade o item usa em cada sub-pedido
          const gradesSubPedidos: any[] = [];

          pedidos.forEach((ped) => {
            ped.itensComGrades.forEach((icg) => {
              const insertedItem = insertedItems.find(
                (i) => i.item_order === icg.itemIdx + 1,
              );
              if (!insertedItem) return;

              icg.grades.forEach((g) => {
                gradesSubPedidos.push({
                  item_id: insertedItem.id,
                  sub_order_num: ped.num,
                  grade_letra: g.letter,
                });
              });
            });
          });

          if (gradesSubPedidos.length > 0) {
            const { error: gsErr } = await supabase
              .from("buy_order_item_suborder_grades")
              .upsert(gradesSubPedidos, { onConflict: "item_id,sub_order_num,grade_letra" });
            if (gsErr) throw gsErr;
          }
        }
      }

      // 5. Insert buy_order_sub_orders
      if (pedidos.length > 0) {
        const subRows = pedidos.map((ped) => {
          let pedTotalPares = 0;
          let pedValorBruto = 0;
          ped.itensComGrades.forEach(icg => {
            const itemObj = items[icg.itemIdx];
            icg.grades.forEach(g => {
              const pares = totPares(g.qtds) * ped.lojas.length;
              pedTotalPares += pares;
              pedValorBruto += pares * itemObj.custo;
            });
          });

          return {
            order_id: orderId,
            sub_order_num: ped.num,
            pedido_numero: ped.pedido_numero || null,
            lojas_numeros: ped.lojas,
            total_pares: pedTotalPares,
            valor_bruto: pedValorBruto
          };
        });
        const { error: sErr } = await supabase
          .from("buy_order_sub_orders")
          .insert(subRows);
        if (sErr) throw sErr;
      }

      // 6. Recalcular totais antes de finalizar
      let totalBruto = 0;
      pedidos.forEach(p => {
        p.itensComGrades.forEach(icg => {
          const item = items[icg.itemIdx];
          icg.grades.forEach(g => {
            totalBruto += totPares(g.qtds) * p.lojas.length * item.custo;
          });
        });
      });

      const totalLiquido = totalBruto * (1 - (cab.desconto || 0) / 100);

      await supabase
        .from("buy_orders")
        .update({ 
          updated_at: new Date().toISOString()
        })
        .eq("id", orderId);

      // Agora lidar com o fluxo de acordo com a AÇÃO escolhida

      // MODO PESQUISA: independente do botão clicado, status já está
      // correto (aguardando_pesquisa) — não sobrescrever
      if (cab.modo_pesquisa) {
        toast.success(`✅ Pesquisa #${numeroPedidoLocal ?? numeroPedidoSalvo} criada! Copie o link na lista de pedidos e envie aos gerentes.`);
        resetStateAndFetch();
        return;
      }

      if (targetAction === "rascunho") {
        toast.success(`Rascunho salvo com sucesso! Nº será gerado em breve.`);
        resetStateAndFetch();
      } else if (targetAction === "confirmado") {
        // Validação de cota já é feita no BuyOrderStepPedidos antes de criar o pedido.
        // Aqui apenas prosseguimos com a confirmação.

        // Buscar suborders para definir order_type
        const { data: subOrders } = await supabase
          .from('buy_order_sub_orders')
          .select('id')
          .eq('order_id', orderId);
          
        const numLojas = subOrders?.length || 0;

        await apiService.updateBuyOrder(orderId, { 
          status: "confirmado"
        });

        // Marcar qualquer cota extra aprovada para este pedido como "usada"
        await supabase.rpc('mark_quota_extra_as_used', { p_order_id: orderId });

        toast.success(`✅ Pedido #${numeroPedidoLocal ?? numeroPedidoSalvo} confirmado com sucesso!`);
        fetchRecentOrders();
        resetStateAndFetch();
      } else if (targetAction === "rascunho_then_standby") {
        // Mostrar o Modal de Stand By para setar o motivo
        setShowStandByModalForOrderId(orderId);
      }
    } catch (e: any) {
      setError("Erro ao salvar: " + (e?.message ?? JSON.stringify(e)));
    } finally {
      setSaving(false);
    }
  }

  function resetStateAndFetch() {
    setEditingOrderId(null);
    setEditingOrder(null);
    setNumeroPedidoSalvo(null);
    setCopiedFromPedido(null);
    setStep(0);
    setCab({
      role: "comprador",
      brand_id: null,
      marca: "",
      fornecedor: "",
      representante: "",
      telefone: "",
      email: "",
      fat_inicio: "",
      fat_fim: "",
      prazos: [],
      markup: 2.6,
      desconto: 0,
      modo_pesquisa: false,
      survey_params: null,
    });
    setItems([]);
    setPedidos([]);
    setPrazosRaw("");
    fetchRecentOrders();
  }

  async function getCurrentAppUserId(): Promise<string> {
    const { data } = await supabase.rpc("current_app_user_id");
    return data ?? "00000000-0000-0000-0000-000000000000";
  }

  // ─── Exportar para Excel (EXCELJS) ──────────────────────────────────────────

  async function handleExportExcel(orderId: string) {
    if (exportando === orderId) return;

    try {
      setExportando(orderId);

      const response = await fetch("/api/export-buy-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Erro ao exportar");
      }

      let fileName = `Pedido_${Date.now()}.xlsx`;
      const disposition = response.headers.get("content-disposition");
      if (disposition && disposition.indexOf("attachment") !== -1) {
        const filenameRegex = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/;
        const matches = filenameRegex.exec(disposition);
        if (matches != null && matches[1]) {
          fileName = matches[1].replace(/['"]/g, "");
        }
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      a.click();
      window.URL.revokeObjectURL(url);

      toast.success("✅ Pedido exportado com sucesso!");

      // Atualizar status para "exportado" no banco
      await supabase
        .from("buy_orders")
        .update({ status: "exportado", central_status: "exportado" })
        .eq("id", orderId);

      fetchRecentOrders();
    } catch (err: any) {
      console.error("Erro:", err);
      toast.error(`❌ ${err.message}`);
    } finally {
      setExportando(null);
    }
  }

  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [showCloseWizardConfirm, setShowCloseWizardConfirm] = useState(false);
  const [editingOrder, setEditingOrder] = useState<any>(null);

  const handleEditOrder = async (orderId: string) => {
    setLoading(true); // Usa o loading geral
    try {
      const { data, error } = await supabase
        .from("buy_orders")
        .select(
          `
          id, numero_pedido, marca, fornecedor, representante, telefone, email,
          fat_inicio, fat_fim, prazos, desconto, markup, user_name, user_role,
          created_at, exported_at, status, central_status,
          buy_order_items (
            id, item_order, referencia, tipo, cor1, cor2, cor3, modelo, 
            total_pares, custo, preco_venda, grades,
            buy_order_item_suborder_grades (item_id, sub_order_num, grade_letra)
          ),
          buy_order_sub_orders (id, sub_order_num, pedido_numero, lojas_numeros)
        `,
        )
        .eq("id", orderId)
        .single();

      if (error) throw error;

      // ✅ SEMPRE carregar no fluxo de 3 etapas (COM cores e grades)
      await loadOrderIntoSteps(data);
      
    } catch (err: any) {
      console.error("❌ Erro ao buscar pedido:", err);
      toast.error(`❌ Erro: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

/**
 * Converte grades do formato banco (array) para formato frontend (objeto).
 * Banco:    [{letra: "A", tamanhos: {33: 1, 34: 2}}, {letra: "B", tamanhos: {35: 1}}]
 * Frontend: {A: {33: 1, 34: 2}, B: {35: 1}}
 * Também aceita formato objeto direto (caso já esteja no formato certo).
 */
function gradesArrayToObject(grades: any): Record<string, Record<string, number>> {
  if (!grades) return {};
  
  // Se já é objeto com letras como chave (formato antigo/direto), retornar como está
  if (!Array.isArray(grades)) {
    // Verificar se as chaves são letras A-H (formato objeto)
    const keys = Object.keys(grades);
    if (keys.length > 0 && keys.every(k => /^[A-H]$/.test(k))) {
      return grades;
    }
    return {};
  }
  
  // Converter array para objeto
  const result: Record<string, Record<string, number>> = {};
  for (const g of grades) {
    if (g && g.letra) {
      result[g.letra] = g.tamanhos || {};
    }
  }
  return result;
}

  const loadOrderIntoSteps = async (order: any, isCopy = false) => {
    console.log(`📦 Carregando pedido para ${isCopy ? "cópia" : "edição"}:`, order);

    if (!isCopy) {
      setEditingOrder(order);
      
      setTimeout(() => {
        orderFormRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start"
        });
      }, 100);

      setHighlightHeader(true);
      setTimeout(() => {
        setHighlightHeader(false);
      }, 2000);
    } else {
      setEditingOrder(null);
    }

    const savedRole = (order.user_role === "gerente" || order.user_role === "manager")
      ? "gerente"
      : "comprador";

    // 1. Preencher Cabeçalho
    setCab({
      role: savedRole,
      brand_id: null,
      marca: order.marca,
      fornecedor: order.fornecedor,
      representante: order.representante,
      telefone: order.telefone || "",
      email: order.email || "",
      fat_inicio: order.fat_inicio || "",
      fat_fim: order.fat_fim || "",
      prazos: order.prazos || [],
      markup: order.markup || 2.6,
      desconto: order.desconto || 0,
      modo_pesquisa: order.modo_pesquisa || false,
      survey_params: order.survey_params || null,
    });

    setPrazosRaw(order.prazos ? order.prazos.join("/") : "");

    // ✅ 2. Preencher Itens COM CORES
    let loadedItems: OrderItem[] = (order.buy_order_items || [])
      .sort((a: any, b: any) => (a.item_order || 0) - (b.item_order || 0))
      .map((item: any) => ({
        ref: item.referencia || "",
        tipo: item.tipo || "",
        cor1: item.cor1 || "",  // ✅ CORES CARREGADAS
        cor2: item.cor2 || "",
        cor3: item.cor3 || "",
        modelo: item.modelo || "FEM",
        custo: item.custo || 0,
        preco_venda: item.preco_venda || 0,
      }));

    loadedItems = await Promise.all(
      loadedItems.map(async (item: OrderItem) => {
        if (!item.ref) return { ...item, _catalogImageUrl: null };
        const { data } = await supabase
          .from('product_catalog').select('image_url')
          .eq('marca', order.marca).eq('referencia', item.ref)
          .eq('cor1', item.cor1 || '').maybeSingle();
        return { ...item, _catalogImageUrl: data?.image_url || null };
      })
    );
    
    setItems(loadedItems);
    console.log("✅ Itens carregados:", loadedItems);

    // 1. Criar um mapa de grades globais para a Coluna 2
    const gradesMap: Record<string, { cat: string; qtds: Record<string, number> }> = {};
    
    order.buy_order_items.forEach((item: any) => {
      if (item.grades) {
        const gradesObj = gradesArrayToObject(item.grades);
        Object.keys(gradesObj).forEach(letra => {
          if (!gradesMap[letra]) {
            gradesMap[letra] = {
              cat: item.modelo,
              qtds: gradesObj[letra]
            };
          }
        });
      }
    });

    // 2. Atualizar o estado do Step 2 para que a UI reflita os dados
    setStep2State({
      selectedItems: new Set<number>(), // Começa limpo para nova seleção
      tempPedidoItens: [], // Limpo pois os itens já estão nas SubOrders
      gradesGlobais: gradesMap, // Carrega as definições de grade A, B, C...
      gradeExpandida: null,
      selectedLojas: [], 
      lojaMode: "all"
    });

    // 3. Mapear as SubOrders para a Coluna 4
    // Na cópia: janelas em branco (lojas e itens zerados, grades globais preservadas)
    // Na edição: carrega tudo do original
    const loadedSubOrders = isCopy
      ? (order.buy_order_sub_orders || []).map((sub: any) => ({
          num: sub.sub_order_num,
          pedido_numero: null,
          lojas: [],
          itensComGrades: []
        }))
      : (order.buy_order_sub_orders || []).map((sub: any) => ({
          num: sub.sub_order_num,
          pedido_numero: sub.pedido_numero,
          lojas: sub.lojas_numeros || [],
          itensComGrades: (order.buy_order_items || [])
            .filter((item: any) =>
              item.buy_order_item_suborder_grades?.some((g: any) => g.sub_order_num === sub.sub_order_num)
            )
            .map((item: any) => {
              const itemIdx = loadedItems.findIndex((i: any) => i.ref === item.referencia);
              const gradesObj = gradesArrayToObject(item.grades);
              return {
                itemIdx,
                grades: item.buy_order_item_suborder_grades
                  .filter((g: any) => g.sub_order_num === sub.sub_order_num)
                  .map((g: any) => ({
                    letter: g.grade_letra,
                    cat: item.modelo,
                    qtds: gradesObj[g.grade_letra] || {}
                  }))
              };
            })
        }));

    setPedidos(loadedSubOrders);
    console.log("✅ Pedidos carregados:", loadedSubOrders);

    // 4. Ir para etapa 0 (Cabeçalho)
    setStep(0);
    setEditingOrderId(order.id);
    setNumeroPedidoSalvo(order.numero_pedido);
    
    if (!isCopy) {
      if (order.status === "stand_by") {
        toast.info("Pedido Stand By carregado para edição.");
      } else {
        toast.info(`Pedido #${order.numero_pedido} carregado para edição.`);
      }
    } else {
      toast.info("📝 Pedido carregado - Revise cada etapa e salve");
    }
  };

  const handleDeleteOrder = async (orderId: string) => {
    try {
      // ✅ SETAR SESSÃO ANTES DE EXCLUIR
      const userId = user?.id;
      if (!userId) {
        toast.error('❌ Usuário não identificado. Faça login novamente.');
        return;
      }

      await supabase.rpc("set_user_session", { p_user_id: userId });
      
      const { data, error } = await supabase.rpc('delete_buy_order', {
        p_order_id: orderId,
        p_user_id: userId
      });
      
      if (error) {
        console.error('Erro ao chamar RPC:', error);
        toast.error('❌ Erro ao excluir pedido.');
        return;
      }
      
      if (data?.success) {
        toast.success(data.message || '✅ Pedido excluído!');
        try {
          await cleanupOrphanPhotos(supabase);
        } catch (cleanErr) {
          console.error("Erro ao limpar fotos órfãs:", cleanErr);
        }
        await fetchRecentOrders();
        setDeletingOrder(null);
      } else {
        const errorCode = data?.code;
        
        if (errorCode === 'UNAUTHENTICATED') {
          toast.error('❌ Sessão expirada. Faça login novamente.');
        } else if (errorCode === 'UNAUTHORIZED') {
          toast.error('❌ Sem permissão para excluir.');
        } else {
          toast.error(`❌ ${data?.error || 'Erro desconhecido'}`);
        }
      }
    } catch (err: any) {
      console.error("❌ Erro:", err);
      toast.error(`❌ ${err.message}`);
    }
  };

  const handleCopyOrder = async (originalOrder: any) => {
    setLoading(true);
    try {
      // 1. Buscar os dados completos do pedido original (SELECT-only)
      const { data, error } = await supabase
        .from("buy_orders")
        .select(
          `
          id, numero_pedido, marca, fornecedor, representante, telefone, email,
          fat_inicio, fat_fim, prazos, desconto, markup, user_name, user_role,
          created_at, exported_at,
          buy_order_items (
            id, item_order, referencia, tipo, cor1, cor2, cor3, modelo, 
            total_pares, custo, preco_venda, grades,
            buy_order_item_suborder_grades (item_id, sub_order_num, grade_letra)
          ),
          buy_order_sub_orders (id, sub_order_num, pedido_numero, lojas_numeros)
        `,
        )
        .eq("id", originalOrder.id)
        .single();

      if (error) throw error;

      // 2. Carregar nos steps do wizard como se fosse uma nova criação
      await loadOrderIntoSteps(data, true);

      // 3. Modificar estados para forçar criação de NOVO registro ao salvar (sem IDs do banco)
      setEditingOrderId(null);
      setNumeroPedidoSalvo(null);
      setCopiedFromPedido({
        numero: data.numero_pedido,
        marca: data.marca || data.fornecedor || "S/M",
      });

      toast.success(
        `📋 Dados do pedido #${originalOrder.numero_pedido || "S/N"} carregados! Ajuste o que quiser antes de salvar.`,
      );
      setCopyingOrder(null);
    } catch (err: any) {
      console.error("Erro ao buscar pedido para cópia:", err);
      toast.error(`❌ Erro ao carregar dados do pedido: ${err.message || err}`);
    } finally {
      setLoading(false);
    }
  };

  // ─── Render ──────────────────────────────────────────────────────────────────

  const [activeTab, setActiveTab] = useState<"create" | "stand_by">("create");

  // ✅ NOVO: Loading enquanto carrega permissões
  if (loadingPermissions) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-4 border-blue-500 rounded-full border-t-transparent mx-auto mb-4" />
          <p className="text-sm text-slate-500">Carregando permissões...</p>
        </div>
      </div>
    );
  }

  // ✅ NOVO: Sem acesso
  if (!hasAccess) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="text-6xl mb-4">🔒</div>
          <h2 className="text-xl font-bold text-slate-800 mb-2">
            Acesso Negado
          </h2>
          <p className="text-sm text-slate-500">
            Você não tem permissão para acessar este módulo.
          </p>
        </div>
      </div>
    );
  }

  if (activeTab === "stand_by") {
    return (
      <div className="flex flex-col h-full bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-4 w-full flex gap-2 border-b border-slate-200">
          <button
            onClick={() => setActiveTab("create")}
            className="px-4 py-2 text-sm font-semibold text-slate-500 hover:text-slate-700 bg-white hover:bg-slate-50 rounded-lg border border-slate-200 transition-colors"
          >
            ← Voltar para Pedidos
          </button>
        </div>
        <StandByDashboard
          user={user}
          onEditOrder={(id: string) => {
            setStep(0); // Garante que começa no cabeçalho
            setActiveTab("create");
            handleEditOrder(id);
          }}
        />
      </div>
    );
  }

  const filteredOrders = recentOrders.filter((order) => {
    // 1. Termo de busca (nº, marca ou fornecedor)
    if (searchTerm.trim()) {
      const txt = searchTerm.toLowerCase().trim();
      const numPedido = String(order.numero_pedido || "").toLowerCase();
      const marca = String(order.marca || "").toLowerCase();
      const fornecedor = String(order.fornecedor || "").toLowerCase();
      
      const matchSearch = numPedido.includes(txt) || marca.includes(txt) || fornecedor.includes(txt);
      if (!matchSearch) return false;
    }

    // 2. Filtro de Status
    if (statusFilter) {
      const orderStatus = order.status || "confirmado";
      if (statusFilter === "nao_exportado") {
        if (orderStatus === "exportado") return false;
      } else {
        if (orderStatus !== statusFilter) return false;
      }
    }

    // 3. Filtro de Papel
    if (roleFilter) {
      if (order.user_role !== roleFilter) return false;
    }

    // Filtro de Data
    if (dataInicio) {
      const ini = new Date(dataInicio + "T00:00:00");
      if (new Date(order.created_at) < ini) return false;
    }
    if (dataFim) {
      const fim = new Date(dataFim + "T23:59:59");
      if (new Date(order.created_at) > fim) return false;
    }

    // 4. Filtro de Loja
    if (selectedLoja) {
      const subOrders = order.buy_order_sub_orders || [];
      const todasLojas = subOrders.flatMap(
        (sub: any) => sub.lojas_numeros || []
      ).map(Number);
      if (!todasLojas.includes(Number(selectedLoja))) return false;
    }

    return true;
  });

  const isGerenteReal = String(user?.role || "").toUpperCase() === "MANAGER";
  const gerenteBloqueadoCriacao = isGerenteReal && gerentePedidosLiberado === false;

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-6">
      {/* TABS */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setActiveTab("create")}
          className="px-4 py-2 text-sm font-semibold rounded-lg transition-colors border bg-[#185FA5] text-white border-transparent"
        >
          Criar / Recentes
        </button>
        <button
          onClick={() => setActiveTab("stand_by")}
          className="px-4 py-2 text-sm font-semibold rounded-lg transition-colors border flex items-center gap-2 bg-white text-amber-700 border-amber-200 hover:bg-amber-50"
        >
          ⏱️ Painel Stand By
        </button>
      </div>

      {/* Header */}
      {!gerenteBloqueadoCriacao && (
        <div
          ref={orderFormRef}
          style={{
            background: highlightHeader ? "#eff6ff" : "#fff",
            border: highlightHeader ? "1.5px solid #3b82f6" : "0.5px solid #e5e7eb",
            borderRadius: 10,
            overflow: "hidden",
            transition: "all 0.5s ease",
          }}
        >
        {/* Título + role */}
        <div className="p-4 md:p-6 border-b flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex flex-col gap-1.5">
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {editingOrderId && editingOrder ? (
                <span style={{ fontSize: 15, fontWeight: 600 }}>
                  ✏️ Editando Pedido #{editingOrder.numero_pedido || numeroPedidoSalvo}
                </span>
              ) : (
                <span style={{ fontSize: 15, fontWeight: 500 }} className="flex items-center gap-2">
                  Novo pedido de compra
                  {items.length > 0 && (
                    <button
                      onClick={resetStateAndFetch}
                      className="text-[10px] text-red-600 hover:text-red-800 font-bold px-2 py-0.5 rounded hover:bg-red-50 border border-red-200 transition-colors ml-2"
                      title="Descartar todos os dados e começar do zero"
                    >
                      Descartar
                    </button>
                  )}
                </span>
              )}
              <span
                style={{
                  fontSize: 11,
                  padding: "2px 8px",
                  borderRadius: 20,
                  background: cab.role === "comprador" ? "#E6F1FB" : "#EAF3DE",
                  color: cab.role === "comprador" ? "#0C447C" : "#27500A",
                  border: `0.5px solid ${cab.role === "comprador" ? "#B5D4F4" : "#C0DD97"}`,
                }}
              >
                {cab.role === "comprador" ? "Modo Comprador" : "Modo Gerente"}
              </span>
            </div>
            {editingOrderId && editingOrder && (
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[10px] font-bold px-2.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 uppercase tracking-wider">
                  Modo Edição
                </span>
                {editingOrder?.status === "stand_by" && (
                  <span className="text-[10px] font-bold px-2.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 uppercase tracking-wider animate-pulse">
                    Stand By
                  </span>
                )}
              </div>
            )}
          </div>
          {String(user?.role || "").toUpperCase() === "ADMIN" && (
            <div style={{ display: "flex", gap: 5 }}>
              {(["comprador", "gerente"] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => setCab((c) => ({ ...c, role: r }))}
                  style={{
                    height: 28,
                    minWidth: 90,
                    padding: "0 12px",
                    borderRadius: 6,
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: "pointer",
                    border: `0.5px solid ${cab.role === r ? "#185FA5" : "#d1d5db"}`,
                    background: cab.role === r ? "#185FA5" : "#fff",
                    color: cab.role === r ? "#fff" : "#64748b",
                    transition: "all 0.2s",
                    boxShadow:
                      cab.role === r
                        ? "0 2px 4px rgba(24, 95, 165, 0.2)"
                        : "none",
                  }}
                >
                  {r.charAt(0).toUpperCase() + r.slice(1)}
                </button>
              ))}
            </div>
          )}
        </div>
        
        {/* Banner de Cópia */}
        {copiedFromPedido && (
          <div className="bg-blue-50 border-b border-blue-200 px-4 md:px-6 py-2.5 flex items-center justify-between text-blue-800 text-xs font-medium">
            <span className="flex items-center gap-1.5 leading-none">
              <span>📋</span>
              <span>
                Copiado do pedido <strong>#{copiedFromPedido.numero}</strong> ({copiedFromPedido.marca}) — Revise e ajuste antes de salvar
              </span>
            </span>
            <button
              onClick={() => setCopiedFromPedido(null)}
              className="text-blue-500 hover:text-blue-700 font-bold ml-2 text-sm leading-none"
              title="Fechar aviso"
              aria-label="Fechar aviso"
            >
              ×
            </button>
          </div>
        )}

        {/* Stepper */}
        <div className="flex px-4 md:px-6 border-b">
          {STEPS.map((s, i) => (
            <div
              key={s}
              style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "9px 0",
                fontSize: 11,
                color: i === step ? "#111" : "#9ca3af",
              }}
            >
              <div
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 10,
                  fontWeight: 500,
                  background:
                    i < step
                      ? "#EAF3DE"
                      : i === step
                        ? "#185FA5"
                        : "transparent",
                  border: `0.5px solid ${i < step ? "#97C459" : i === step ? "#185FA5" : "#d1d5db"}`,
                  color: i < step ? "#27500A" : i === step ? "#fff" : "#9ca3af",
                }}
              >
                {i < step ? "✓" : i + 1}
              </div>
              <span>{s}</span>
              {i < STEPS.length - 1 && (
                <div
                  style={{
                    flex: 1,
                    height: 0.5,
                    background: "#e5e7eb",
                    margin: "0 6px",
                  }}
                />
              )}
            </div>
          ))}
        </div>

        {/* Corpo da etapa */}
        {step === 0 && (
          <StepCabecalho
            cab={cab}
            setCab={setCab}
            prazosRaw={prazosRaw}
            setPrazosRaw={setPrazosRaw}
            numeroPedidoSalvo={numeroPedidoSalvo}
            setNumeroPedidoSalvo={setNumeroPedidoSalvo}
            roundBase={roundBase}
            isMobile={isMobile}
            user={user}
            prazosInputRef={prazosInputRef}
          />
        )}
        {step === 1 && (
          <StepItens
            items={items}
            setItems={setItems}
            cab={cab}
            roundBase={roundBase}
            selectedLojas={step2State.selectedLojas}
            isMobile={isMobile}
            setStep2State={setStep2State}
            setPedidos={setPedidos}
            user={user}
          />
        )}
        {step === 2 && (
          <StepPedidos
            items={items}
            pedidos={pedidos}
            setPedidos={setPedidos}
            user={user}
            cab={cab}
            onUpdateCab={(updates) => setCab((prev) => ({ ...prev, ...updates }))}
            step2State={step2State}
            setStep2State={setStep2State}
            allowedStores={allowedStores}
            canViewAllStores={canViewAllStores}
          />
        )}

        {/* Alertas de Restrições - Aparece nos Steps 1 e 2 */}
        {(step === 1 || step === 2) && (
          <AlertasCardSticky
            marca={cab.marca}
            lojasSelecionadas={step === 2 ? step2State.selectedLojas : []}
            itens={items}
          />
        )}

        {/* Footer navegação */}
        {error && (
          <div
            style={{
              padding: "8px 18px",
              background: "#FCEBEB",
              borderTop: "0.5px solid #F09595",
              fontSize: 12,
              color: "#A32D2D",
            }}
          >
            {error}
          </div>
        )}
        <div className="p-4 md:p-6 border-t flex flex-col md:flex-row justify-between items-center gap-4">
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {step > 0 && (
              <button
                onClick={() => {
                  setError("");
                  setStep((s) => Math.max(0, s - 1));
                }}
                style={{
                  height: 32,
                  padding: "0 14px",
                  borderRadius: 6,
                  fontSize: 13,
                  cursor: "pointer",
                  border: "1px solid #d1d5db",
                  background: "transparent",
                  fontWeight: 500,
                }}
              >
                ← Voltar
              </button>
            )}
            <button
              onClick={() => setShowCloseWizardConfirm(true)}
              style={{
                height: 32,
                padding: "0 20px",
                borderRadius: 6,
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                border: "none",
                background: (!!editingOrderId && !!editingOrder) ? "#64748b" : "#dc2626",
                color: "#fff",
              }}
            >
              {(!!editingOrderId && !!editingOrder) ? "← Fechar sem salvar" : "← Cancelar"}
            </button>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              flexWrap: "wrap",
              justifyContent: "center",
            }}
          >
            <span className="hidden md:block text-xs text-slate-500 font-medium">
              {cab.marca && `${cab.marca} · `}
              {items.length > 0 && `${items.length} itens`}
            </span>

            {step === STEPS.length - 1 && (pedidos.length === 0 || (!cab.modo_pesquisa && pedidos.every(p => p.itensComGrades.length === 0))) ? (
              <div className="text-xs text-amber-600 bg-amber-50 border border-amber-300 rounded-lg px-3 py-1 flex items-center h-8">
                ⚠️ Crie ao menos um pedido
              </div>
            ) : null}

            {step === STEPS.length - 1 ? (
              <>
                <button
                  onClick={() => handleSave("rascunho")}
                  disabled={saving || !isHeaderValid || items.length === 0 || pedidos.length === 0 || (!cab.modo_pesquisa && pedidos.every(p => p.itensComGrades.length === 0))}
                  style={{
                    height: 32,
                    padding: "0 16px",
                    borderRadius: 6,
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                    border: "1px solid #94a3b8",
                    background: "#f8fafc",
                    color: "#475569",
                    opacity: (saving || !isHeaderValid || items.length === 0 || pedidos.length === 0 || (!cab.modo_pesquisa && pedidos.every(p => p.itensComGrades.length === 0))) ? 0.7 : 1,
                  }}
                >
                  Salvar Rascunho
                </button>
                <button
                  onClick={() => {
                    handleSave("rascunho_then_standby");
                  }}
                  disabled={saving || !isHeaderValid || items.length === 0 || pedidos.length === 0 || (!cab.modo_pesquisa && pedidos.every(p => p.itensComGrades.length === 0))}
                  style={{
                    height: 32,
                    padding: "0 16px",
                    borderRadius: 6,
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                    border: "1px solid #d97706",
                    background: "#fffbeb",
                    color: "#b45309",
                    opacity: (saving || !isHeaderValid || items.length === 0 || pedidos.length === 0 || (!cab.modo_pesquisa && pedidos.every(p => p.itensComGrades.length === 0))) ? 0.7 : 1,
                  }}
                >
                  Salvar em Stand By
                </button>
                <button
                  onClick={() => handleSave("confirmado")}
                  disabled={saving || !isHeaderValid || items.length === 0 || pedidos.length === 0 || (!cab.modo_pesquisa && pedidos.every(p => p.itensComGrades.length === 0))}
                  style={{
                    height: 32,
                    padding: "0 16px",
                    borderRadius: 6,
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                    border: "transparent",
                    background: "#16a34a",
                    color: "#fff",
                    opacity: (saving || !isHeaderValid || items.length === 0 || pedidos.length === 0 || (!cab.modo_pesquisa && pedidos.every(p => p.itensComGrades.length === 0))) ? 0.7 : 1,
                  }}
                >
                  {saving ? "Aguarde..." : "Confirmar Pedido"}
                </button>
              </>
            ) : (
              <button
                onClick={navNext}
                disabled={saving || !isHeaderValid}
                style={{
                  height: 32,
                  padding: "0 20px",
                  borderRadius: 6,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  border: "none",
                  background: "#185FA5",
                  color: "#fff",
                  opacity: saving || !isHeaderValid ? 0.7 : 1,
                }}
              >
                Próximo →
              </button>
            )}
          </div>
        </div>
      </div>
      )}

      {gerenteBloqueadoCriacao && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-2 text-center">
          <p className="text-sm text-amber-700 font-medium">
            ⚠️ O lançamento de novos pedidos está desativado para sua loja. Acompanhe os pedidos abaixo.
          </p>
        </div>
      )}

      {/* Lista de Pedidos Recentes */}
      {step === 0 && (
      <div
        style={{
          marginTop: 24,
          background: "#fff",
          border: "0.5px solid #e5e7eb",
          borderRadius: 10,
          overflow: "hidden",
        }}
      >
        {/* Cabeçalho com filtros reorganizado */}
        <div className="p-4 md:p-6 border-b border-slate-200 bg-slate-50/50">
          {/* Primeira linha: Título, Busca ampla e Botão Atualizar */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
            <div className="flex items-center justify-between md:justify-start gap-4 shrink-0">
              <h3 className="text-sm font-black uppercase tracking-wider text-slate-800 flex items-center gap-2">
                <ShoppingCart size={16} className="text-blue-600" />
                Pedidos Recentes
                <span className="bg-blue-50 text-blue-700 text-[10px] font-black px-2 py-0.5 rounded-full border border-blue-100">
                  {filteredOrders.length}{hasMore ? '+' : ''}
                </span>
              </h3>
              
              <div className="flex items-center gap-2">
                {!!(orderNumberFilter || dataInicio || dataFim || statusFilter || roleFilter || selectedLoja || searchTerm) && (
                  <button
                    type="button"
                    onClick={() => {
                      setOrderNumberFilter("");
                      setDataInicio("");
                      setDataFim("");
                      setStatusFilter("");
                      setRoleFilter("");
                      setSelectedLoja(null);
                      setSearchTerm("");
                      toast.info("Todos os filtros foram limpos!");
                    }}
                    className="flex items-center gap-1 text-[9px] sm:text-xs font-black text-rose-600 hover:text-rose-800 uppercase tracking-widest transition-all border border-rose-200 bg-rose-50/50 hover:bg-rose-100 px-2.5 py-1 rounded-lg shrink-0"
                  >
                    Limpar
                  </button>
                )}
                
                <button
                  onClick={fetchRecentOrders}
                  disabled={loadingRecent}
                  className="md:hidden flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-800 disabled:text-slate-400 transition-colors shrink-0"
                >
                  <RefreshCw className={loadingRecent ? "animate-spin" : ""} size={12} />
                  {loadingRecent ? "Atualizando..." : "Atualizar"}
                </button>
              </div>
            </div>

            {/* Busca ampla ocupando o espaço disponível */}
            <div className="flex-1 flex gap-2 max-w-2xl md:ml-4">
              <input
                type="text"
                placeholder="Buscar por nº do pedido, marca ou fornecedor..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={`w-full h-10 px-4 border rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white shadow-sm transition-all ${
                  searchTerm ? 'border-blue-500 bg-blue-50/10 ring-1 ring-blue-500/20 font-semibold' : 'border-slate-300'
                }`}
              />
              <button
                onClick={fetchRecentOrders}
                disabled={loadingRecent}
                className="hidden md:flex h-10 px-4 items-center gap-2 bg-white hover:bg-slate-50 border border-slate-300 hover:border-slate-400 disabled:text-slate-400 disabled:hover:bg-white text-xs font-bold text-blue-600 rounded-xl shadow-sm transition-all shrink-0"
              >
                <RefreshCw className={loadingRecent ? "animate-spin" : ""} size={14} />
                {loadingRecent ? "Atualizando..." : "Atualizar"}
              </button>
            </div>
          </div>

          {/* Segunda linha: Filtros específicos alinhados */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {/* Campo 1: Número do Pedido */}
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Nº Pedido</label>
              <input
                type="text"
                placeholder="Ex: 12345"
                value={orderNumberFilter}
                onChange={(e) => setOrderNumberFilter(e.target.value)}
                className={`w-full h-10 px-3 border rounded-xl text-xs font-medium bg-white shadow-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all ${
                  orderNumberFilter ? 'border-blue-500 bg-blue-50/10 text-blue-700 ring-1 ring-blue-500/20 font-bold' : 'border-slate-300 text-slate-700'
                }`}
              />
            </div>

            {/* Campo 2: Data Inicial */}
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Data Inicial</label>
              <input
                type="date"
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
                className={`w-full h-10 px-3 border rounded-xl text-xs font-medium bg-white shadow-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all ${
                  dataInicio ? 'border-blue-500 bg-blue-50/10 text-blue-700 ring-1 ring-blue-500/20 font-bold' : 'border-slate-300 text-slate-700'
                }`}
              />
            </div>

            {/* Campo 3: Data Final */}
            <div className="flex flex-col gap-1">
              <div className="flex justify-between items-center">
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Data Final</label>
                {(dataInicio || dataFim) && (
                  <button
                    type="button"
                    onClick={() => { setDataInicio(""); setDataFim(""); }}
                    className="text-[9px] font-bold text-red-600 hover:text-red-800 transition-colors"
                  >
                    Limpar
                  </button>
                )}
              </div>
              <input
                type="date"
                value={dataFim}
                onChange={(e) => setDataFim(e.target.value)}
                className={`w-full h-10 px-3 border rounded-xl text-xs font-medium bg-white shadow-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all ${
                  dataFim ? 'border-blue-500 bg-blue-50/10 text-blue-700 ring-1 ring-blue-500/20 font-bold' : 'border-slate-300 text-slate-700'
                }`}
              />
            </div>

            {/* Campo 4: Status */}
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className={`w-full h-10 px-3 border rounded-xl text-xs font-medium bg-white shadow-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer ${
                  statusFilter ? 'border-blue-500 bg-blue-50/10 text-blue-700 ring-1 ring-blue-500/20 font-bold' : 'border-slate-300 text-slate-700'
                }`}
              >
                <option value="">Todos</option>
                <option value="rascunho">Rascunho</option>
                <option value="stand_by">Stand By</option>
                <option value="confirmado">Confirmado</option>
                <option value="exportado">Exportado</option>
                <option value="nao_exportado">Não Exportado</option>
              </select>
            </div>

            {/* Campo 5: Papel */}
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Papel</label>
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className={`w-full h-10 px-3 border rounded-xl text-xs font-medium bg-white shadow-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer ${
                  roleFilter ? 'border-blue-500 bg-blue-50/10 text-blue-700 ring-1 ring-blue-500/20 font-bold' : 'border-slate-300 text-slate-700'
                }`}
              >
                <option value="">Todos</option>
                <option value="manager">Gerente</option>
                <option value="comprador">Comprador</option>
              </select>
            </div>

            {/* Campo 6: Loja */}
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Loja</label>
              {canViewAllStores ? (
                <select
                  value={selectedLoja || ""}
                  onChange={(e) =>
                    setSelectedLoja(
                      e.target.value ? Number(e.target.value) : null,
                    )
                  }
                  className={`w-full h-10 px-3 border rounded-xl text-xs font-medium bg-white shadow-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer ${
                    selectedLoja ? 'border-blue-500 bg-blue-50/10 text-blue-700 ring-1 ring-blue-500/20 font-bold' : 'border-slate-300 text-slate-700'
                  }`}
                >
                  <option value="">Todas</option>
                  {allowedStores.map((store) => (
                    <option key={store.number} value={store.number}>
                      Loja {store.number}
                    </option>
                  ))}
                </select>
              ) : allowedStores.length > 0 ? (
                <div className="w-full h-10 px-3 border border-slate-200 rounded-xl text-xs font-bold bg-slate-100 text-slate-500 shadow-inner flex items-center truncate">
                  📍 {allowedStores[0]?.number}
                </div>
              ) : (
                <div className="w-full h-10 px-3 border border-slate-200 rounded-xl text-xs font-bold bg-slate-100 text-slate-400 shadow-inner flex items-center justify-center">
                  -
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Tabela */}
        <div style={{ overflowX: "auto" }}>
          {isMobile ? (
            <div className="space-y-2 p-3">
              {filteredOrders.length === 0 && (
                  <div className="p-4 text-center text-slate-400 text-sm">
                    Nenhum pedido encontrado com esse filtro.
                  </div>
              )}
              {filteredOrders.map((order) => {
                const subOrders = order.buy_order_sub_orders || [];
                const todasLojas = subOrders.flatMap(
                  (sub: any) => sub.lojas_numeros || []
                ) as number[];
                const lojasUnicas = [...new Set(todasLojas)].sort((a, b) => a - b);
                const status = order.status || "confirmado";

                return (
                  <div key={order.id} className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex flex-col">
                        <span className="text-[12px] font-black text-slate-800 uppercase leading-none">{order.marca}</span>
                        <span className="text-[10px] text-slate-500 font-bold mt-1">Pedido #{order.numero_pedido}</span>
                      </div>
                      <span className={`text-[9px] font-black px-2 py-1 rounded-lg uppercase tracking-widest border ${
                        status === 'confirmado' ? 'bg-green-50 text-green-700 border-green-200' :
                        status === 'exportado' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                        status === 'rascunho' ? 'bg-slate-50 text-slate-500 border-slate-200' :
                        'bg-amber-50 text-amber-700 border-amber-200'
                      }`}>
                        {status}
                      </span>
                    </div>
                    {/* Lojas em badges */}
                    <div className="flex flex-wrap gap-1 mb-3">
                      {lojasUnicas.slice(0, 9).map((l: number) => (
                        <span key={l} className="text-[8px] font-black bg-blue-50 text-blue-600 border border-blue-100 px-1.5 py-0.5 rounded">
                          L{l}
                        </span>
                      ))}
                      {lojasUnicas.length > 9 && (
                        <span className="text-[8px] font-black bg-blue-50 text-blue-600 border border-blue-100 px-1.5 py-0.5 rounded">
                          +{lojasUnicas.length - 9}
                        </span>
                      )}
                    </div>
                    {/* Botões de ação em linha */}
                    <div style={{ display: 'flex', gap: '8px', marginTop: '8px', paddingTop: '12px', borderTop: '1px solid #f1f5f9' }}>
                      {status === 'aguardando_pesquisa' ? (
                        <>
                          <button
                            onClick={() => {
                              const link = `${window.location.origin}/pesquisa-compra/${order.id}`;
                              navigator.clipboard.writeText(link);
                              toast.success('✅ Link copiado!');
                            }}
                            className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-purple-600 text-white rounded-lg text-[11px] font-medium hover:bg-purple-700"
                          >
                            🔗 Copiar Link
                          </button>
                          <button
                            onClick={() => setSurveyProgressOrder({ orderId: order.id, numero: order.numero_pedido, marca: order.marca })}
                            className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-purple-100 text-purple-700 rounded-lg text-[11px] font-medium hover:bg-purple-200"
                          >
                            📊 Progresso
                          </button>
                        </>
                      ) : (
                        <>
                          <button 
                            onClick={() => handleExportExcel(order.id)}
                            disabled={exportando === order.id}
                            className="flex-1 flex items-center justify-center gap-2 py-2 bg-blue-600 text-white rounded-lg text-[11px] font-medium hover:bg-blue-700 disabled:opacity-50"
                          >
                            <Download size={14} /> {exportando === order.id ? 'Exp...' : 'Exportar'}
                          </button>
                          <button
                            onClick={() => printOrder(order, supabase)}
                            className="flex-1 flex items-center justify-center gap-2 py-2 bg-blue-100 text-blue-700 rounded-lg text-[11px] font-medium hover:bg-blue-200"
                          >
                            <Printer size={14} /> Imprimir
                          </button>
                        </>
                      )}

                      <button
                        onClick={() => setCopyingOrder(order)}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-slate-100 text-slate-700 rounded-lg text-[11px] font-medium hover:bg-slate-200"
                        title="Copiar pedido"
                        aria-label="Copiar pedido"
                      >
                        <Copy size={14} /> Copiar
                      </button>

                      {canEditOrder(order) && (status === 'rascunho' || isAdmin) && (
                        <button
                          onClick={() => {
                            setStep(0);
                            handleEditOrder(order.id);
                          }}
                          disabled={exportando === order.id}
                          className="flex-1 flex items-center justify-center gap-2 py-2 bg-slate-100 text-slate-700 rounded-lg text-[11px] font-medium hover:bg-slate-200 disabled:opacity-50"
                        >
                          <Pencil size={14} /> Editar
                        </button>
                      )}

                      {canCancelOrder(order) && (
                        <button
                          onClick={() => setDeletingOrder({ id: order.id, numero_pedido: order.numero_pedido })}
                          disabled={exportando === order.id}
                          className="flex-1 flex items-center justify-center gap-2 py-2 bg-red-50 text-red-500 rounded-lg text-[11px] font-medium hover:bg-red-100 disabled:opacity-50"
                        >
                          <X size={14} /> Excluir
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
          <table
            style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}
          >
            <thead>
              <tr style={{ background: "#f9fafb" }}>
                <th
                  style={{
                    padding: "8px 12px",
                    textAlign: "left",
                    fontWeight: 600,
                    color: "#6b7280",
                    borderBottom: "0.5px solid #e5e7eb",
                  }}
                >
                  Data/Marca
                </th>
                <th
                  style={{
                    padding: "8px 12px",
                    textAlign: "left",
                    fontWeight: 600,
                    color: "#6b7280",
                    borderBottom: "0.5px solid #e5e7eb",
                  }}
                >
                  Número
                </th>
                <th
                  style={{
                    padding: "8px 12px",
                    textAlign: "left",
                    fontWeight: 600,
                    color: "#6b7280",
                    borderBottom: "0.5px solid #e5e7eb",
                  }}
                >
                  Lojas
                </th>
                <th
                  style={{
                    padding: "8px 12px",
                    textAlign: "left",
                    fontWeight: 600,
                    color: "#6b7280",
                    borderBottom: "0.5px solid #e5e7eb",
                  }}
                >
                  Criado por
                </th>
                <th
                  style={{
                    padding: "8px 12px",
                    textAlign: "left",
                    fontWeight: 600,
                    color: "#6b7280",
                    borderBottom: "0.5px solid #e5e7eb",
                  }}
                >
                  Status
                </th>
                <th
                  style={{
                    padding: "8px 12px",
                    textAlign: "right",
                    fontWeight: 600,
                    color: "#6b7280",
                    borderBottom: "0.5px solid #e5e7eb",
                  }}
                >
                  Ação
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    style={{
                      padding: "20px",
                      textAlign: "center",
                      color: "#9ca3af",
                    }}
                  >
                    Nenhum pedido encontrado com esse filtro.
                  </td>
                </tr>
              )}
              {filteredOrders.map((o) => {
                const subOrders = o.buy_order_sub_orders || [];
                const todasLojas = subOrders.flatMap(
                  (sub: any) => sub.lojas_numeros || [],
                ) as number[];
                const lojasUnicas = [...new Set(todasLojas)].sort(
                  (a, b) => a - b,
                );

                return (
                  <tr
                    key={o.id}
                    style={{ borderBottom: "0.5px solid #f3f4f6" }}
                  >
                    {/* Data/Marca */}
                    <td style={{ padding: "10px 12px" }}>
                      <div style={{ fontWeight: 600, color: "#111" }}>
                        {o.marca}
                      </div>
                      <div style={{ fontSize: 10, color: "#9ca3af" }}>
                        {new Date(o.created_at).toLocaleDateString("pt-BR")}
                      </div>
                    </td>

                    {/* Número */}
                    <td
                      style={{
                        padding: "10px 12px",
                        color: "#6b7280",
                        fontWeight: 600,
                      }}
                    >
                      #{o.numero_pedido || "—"}
                    </td>

                    {/* Lojas */}
                    <td style={{ padding: "10px 12px" }}>
                      {(() => {
                        // Coletar todas as lojas do pedido (de todos os sub_orders)
                        const subOrders = (o.buy_order_sub_orders || []) as any[];
                        const todasLojasRaw = subOrders
                          .flatMap((s: any) => s.lojas_numeros || [])
                          .map(Number);
                        
                        const todasLojas: number[] = Array.from(new Set(todasLojasRaw)).sort((a, b) => a - b);

                        if (todasLojas.length === 0) {
                          return <span style={{ fontSize: 10, color: "#9ca3af" }}>—</span>;
                        }

                        const numLojas = todasLojas.length;
                        const metade = Math.ceil(numLojas / 2);
                        const linha1 = todasLojas.slice(0, metade);
                        const linha2 = todasLojas.slice(metade);

                        return (
                          <div className="flex flex-col gap-0.5">
                            <div className="flex flex-wrap gap-0.5">
                              {linha1.map((loja: number) => (
                                <span
                                  key={loja}
                                  className="inline-flex items-center justify-center w-7 h-5 rounded text-[9px] font-black bg-slate-100 text-slate-700 border border-slate-200"
                                >
                                  {loja}
                                </span>
                              ))}
                            </div>
                            {linha2.length > 0 && (
                              <div className="flex flex-wrap gap-0.5">
                                {linha2.map((loja: number) => (
                                  <span
                                    key={loja}
                                    className="inline-flex items-center justify-center w-7 h-5 rounded text-[9px] font-black bg-slate-100 text-slate-700 border border-slate-200"
                                  >
                                    {loja}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </td>

                    {/* ✅ NOVA COLUNA: Criado por */}
                    <td style={{ padding: "10px 12px" }}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        {["comprador", "admin", "super_admin"].includes(
                          (o.user_role || "").toLowerCase()
                        ) ? (
                          <>
                            <span style={{ fontSize: 14 }}>⚙️</span>
                            <div>
                              <div
                                style={{
                                  fontSize: 10,
                                  fontWeight: 600,
                                  color: "#7c3aed",
                                }}
                              >
                                COMPRADOR
                              </div>
                              <div style={{ fontSize: 9, color: "#9ca3af" }}>
                                {o.user_name || "—"}
                              </div>
                            </div>
                          </>
                        ) : (
                          <>
                            <span style={{ fontSize: 14 }}>👤</span>
                            <div>
                              <div
                                style={{
                                  fontSize: 10,
                                  fontWeight: 600,
                                  color: "#16a34a",
                                }}
                              >
                                GERENTE
                              </div>
                              <div style={{ fontSize: 9, color: "#9ca3af" }}>
                                {o.user_name || "—"}
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    </td>

                    {/* Status */}
                    <td style={{ padding: "10px 12px" }}>
                      {(() => {
                        const status = o.status || "confirmado";
                        if (status === "cancelado")
                          return (
                            <span
                              style={{
                                fontSize: 9,
                                color: "#991b1b",
                                background: "#fef2f2",
                                padding: "2px 6px",
                                borderRadius: 10,
                                border: "0.5px solid #fecaca",
                                fontWeight: 600,
                              }}
                            >
                              Cancelado
                            </span>
                          );
                        if (status === "exportado")
                          return (
                            <span
                              style={{
                                fontSize: 9,
                                color: "#27500A",
                                background: "#EAF3DE",
                                padding: "2px 6px",
                                borderRadius: 10,
                                border: "0.5px solid #C0DD97",
                                fontWeight: 600,
                              }}
                            >
                              Exportado
                            </span>
                          );
                        if (status === "aguardando_pesquisa")
                          return (
                            <span
                              style={{
                                fontSize: 9,
                                color: "#6b21a8",
                                background: "#f3e8ff",
                                padding: "2px 6px",
                                borderRadius: 10,
                                border: "0.5px solid #e9d5ff",
                                fontWeight: 600,
                              }}
                            >
                              Pesquisa em Aberto
                            </span>
                          );
                        if (status === "confirmado")
                          return (
                            <span
                              style={{
                                fontSize: 9,
                                color: "#16a34a",
                                background: "#dcfce7",
                                padding: "2px 6px",
                                borderRadius: 10,
                                border: "0.5px solid #bbf7d0",
                                fontWeight: 600,
                              }}
                            >
                              Confirmado
                            </span>
                          );
                        if (status === "stand_by")
                          return (
                            <span
                              style={{
                                fontSize: 9,
                                color: "#b45309",
                                background: "#fffbeb",
                                padding: "2px 6px",
                                borderRadius: 10,
                                border: "0.5px solid #fde68a",
                                fontWeight: 600,
                              }}
                            >
                              Stand By
                            </span>
                          );
                        return (
                          <span
                            style={{
                              fontSize: 9,
                              color: "#475569",
                              background: "#f1f5f9",
                              padding: "2px 6px",
                              borderRadius: 10,
                              border: "0.5px solid #cbd5e1",
                              fontWeight: 600,
                            }}
                          >
                            Rascunho
                          </span>
                        );
                      })()}
                    </td>

                    {/* ✅ AÇÕES: 3 botões (Exportar, Editar, Excluir) */}
                    <td style={{ padding: "10px 12px", textAlign: "right" }}>
                      <div
                        style={{
                          display: "flex",
                          gap: 6,
                          justifyContent: "flex-end",
                          alignItems: "center",
                        }}
                      >
                        {/* Botão Exportar */}
                        {(o.status === "confirmado" ||
                          o.status === "exportado" ||
                          (!o.status && o.exported_at)) && (
                          <button
                            onClick={() => handleExportExcel(o.id)}
                            disabled={exportando === o.id}
                            title="Exportar Excel"
                            style={{
                              width: 28,
                              height: 28,
                              padding: 0,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              background:
                                exportando === o.id ? "#94a3b8" : "#185FA5",
                              color: "#fff",
                              border: "none",
                              borderRadius: 6,
                              cursor:
                                exportando === o.id ? "not-allowed" : "pointer",
                              transition: "all 0.2s",
                            }}
                          >
                            <Download size={14} />
                          </button>
                        )}

                        {/* Botão Editar */}
                        {canEditOrder(o) &&
                          (o.status === "rascunho" ||
                            o.status === "stand_by" ||
                            !o.status) && (
                            <button
                              onClick={() => handleEditOrder(o.id)}
                              title="Editar"
                              style={{
                                width: 28,
                                height: 28,
                                padding: 0,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                background: "#fff",
                                color: "#6b7280",
                                border: "1px solid #d1d5db",
                                borderRadius: 6,
                                cursor: "pointer",
                                transition: "all 0.2s",
                              }}
                            >
                              <Pencil size={14} />
                            </button>
                          )}

                        {/* Botão de Pesquisa (Votar / Progresso) */}
                        {o.status === "aguardando_pesquisa" && (
                          isAdmin ? (
                            <>
                              <button
                                onClick={() => {
                                  const link = `${window.location.origin}/pesquisa-compra/${o.id}`;
                                  navigator.clipboard.writeText(link);
                                  alert(`✅ Link copiado!\n\n${link}\n\nEnvie para os gerentes via WhatsApp ou e-mail.`);
                                }}
                                className="flex items-center gap-1 px-2 py-1.5 bg-slate-600 hover:bg-slate-700 text-white rounded-lg text-[10px] font-black uppercase transition-all"
                                title="Copiar link para enviar aos gerentes"
                              >
                                🔗 Copiar Link
                              </button>
                              <button
                                onClick={() => setSurveyProgressOrder({ orderId: o.id, numero: o.numero_pedido, marca: o.marca })}
                                className="flex items-center gap-1 px-2 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-[10px] font-black uppercase transition-all"
                              >
                                📊 Progresso
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => {
                                const storeId = user?.storeId || '';
                                setSurveyVotingOrder({ orderId: o.id, subOrderNum: 1, storeId, numero: o.numero_pedido, marca: o.marca });
                              }}
                              title="Votar na Pesquisa"
                              style={{
                                height: 28,
                                padding: "0 10px",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                background: "#a855f7",
                                color: "#fff",
                                border: "none",
                                borderRadius: 6,
                                cursor: "pointer",
                                transition: "all 0.2s",
                                fontSize: "11px",
                                fontWeight: "bold"
                              }}
                            >
                              🗳️ Votar
                            </button>
                          )
                        )}

                        {/* Botão Imprimir */}
                        <button
                          onClick={() => printOrder(o, supabase)}
                          title="Imprimir pedido com fotos"
                          style={{
                            width: 28,
                            height: 28,
                            padding: 0,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            background: "#dbeafe",
                            color: "#1d4ed8",
                            border: "none",
                            borderRadius: 6,
                            cursor: "pointer",
                            transition: "all 0.2s",
                          }}
                        >
                          <Printer size={14} />
                        </button>

                        {/* Botão Copiar */}
                        <button
                          onClick={() => setCopyingOrder(o)}
                          title="Copiar pedido"
                          aria-label="Copiar pedido"
                          style={{
                            width: 28,
                            height: 28,
                            padding: 0,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            background: "#f1f5f9",
                            color: "#475569",
                            border: "1px solid #cbd5e1",
                            borderRadius: 6,
                            cursor: "pointer",
                            transition: "all 0.2s",
                          }}
                        >
                          <Copy size={14} />
                        </button>

                        {/* Botão Excluir */}
                        {canCancelOrder(o) && (
                          <button
                            onClick={() => setDeletingOrder(o)}
                            title="Excluir"
                            style={{
                              width: 28,
                              height: 28,
                              padding: 0,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              background: "#fff",
                              color: "#dc2626",
                              border: "1px solid #fca5a5",
                              borderRadius: 6,
                              cursor: "pointer",
                              transition: "all 0.2s",
                            }}
                          >
                            <X size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          )}
        </div>

        {/* Botão Ver Mais */}
        {hasMore && (
          <div
            style={{
              padding: 12,
              textAlign: "center",
              borderTop: "0.5px solid #e5e7eb",
            }}
          >
            <button
              onClick={() => setPage((prev) => prev + 1)}
              style={{
                padding: "6px 16px",
                background: "#f3f4f6",
                border: "1px solid #d1d5db",
                borderRadius: 6,
                fontSize: 11,
                fontWeight: 500,
                cursor: "pointer",
                color: "#374151",
              }}
            >
              Carregar mais
            </button>
          </div>
        )}
      </div>
      )}

      {/* Modal de Fechar Wizard sem salvar */}
      {showCloseWizardConfirm && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 200,
          }}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: 10,
              width: 400,
              maxWidth: "90vw",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "16px",
                background: (!!editingOrderId && !!editingOrder) ? "#f0f9ff" : "#fef2f2",
                borderBottom: (!!editingOrderId && !!editingOrder) ? "1px solid #bae6fd" : "1px solid #fecaca",
              }}
            >
              <div
                style={{
                  fontSize: 16,
                  fontWeight: 700,
                  color: (!!editingOrderId && !!editingOrder) ? "#0369a1" : "#991b1b",
                  textAlign: "center",
                }}
              >
                {(!!editingOrderId && !!editingOrder) ? "Fechar sem salvar?" : "⚠️ Cancelar Pedido"}
              </div>
            </div>
            <div style={{ padding: 20 }}>
              <p
                style={{
                  fontSize: 13,
                  color: "#374151",
                  textAlign: "center",
                }}
              >
                {(!!editingOrderId && !!editingOrder)
                  ? "Nenhuma alteração será gravada — o pedido continua exatamente como estava (inclusive se estiver em Stand By)."
                  : "Todas as informações preenchidas serão perdidas."}
              </p>
            </div>
            <div
              style={{
                padding: "12px 16px",
                borderTop: "0.5px solid #e5e7eb",
                display: "flex",
                justifyContent: "flex-end",
                gap: 8,
              }}
            >
              <button
                onClick={() => setShowCloseWizardConfirm(false)}
                style={{
                  height: 32,
                  padding: "0 16px",
                  borderRadius: 6,
                  border: "1px solid #d1d5db",
                  background: "#fff",
                  cursor: "pointer",
                  fontSize: 12,
                }}
              >
                Continuar Editando
              </button>
              <button
                onClick={() => {
                  setShowCloseWizardConfirm(false);
                  resetStateAndFetch();
                }}
                style={{
                  height: 32,
                  padding: "0 16px",
                  borderRadius: 6,
                  border: "none",
                  background: (!!editingOrderId && !!editingOrder) ? "#0369a1" : "#dc2626",
                  color: "#fff",
                  cursor: "pointer",
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                {(!!editingOrderId && !!editingOrder) ? "Fechar" : "❌ Cancelar Pedido"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Confirmação de Exclusão */}
      {deletingOrder && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
          }}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: 10,
              width: 400,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "16px",
                background: "#fef2f2",
                borderBottom: "1px solid #fecaca",
              }}
            >
              <div
                style={{
                  fontSize: 16,
                  fontWeight: 700,
                  color: "#991b1b",
                  textAlign: "center",
                }}
              >
                ⚠️ Confirmar Exclusão
              </div>
            </div>
            <div style={{ padding: 20 }}>
              <p
                style={{
                  fontSize: 13,
                  color: "#374151",
                  textAlign: "center",
                  marginBottom: 16,
                }}
              >
                Tem certeza que deseja excluir o pedido{" "}
                <strong>#{deletingOrder.numero_pedido}</strong>?
              </p>
              <div
                style={{
                  background: "#f9fafb",
                  border: "1px solid #e5e7eb",
                  borderRadius: 8,
                  padding: 12,
                }}
              >
                <div
                  style={{ fontSize: 11, color: "#6b7280", marginBottom: 4 }}
                >
                  <strong>Marca:</strong> {deletingOrder.marca}
                </div>
                <div style={{ fontSize: 11, color: "#6b7280" }}>
                  <strong>Criado em:</strong>{" "}
                  {new Date(deletingOrder.created_at).toLocaleDateString(
                    "pt-BR",
                  )}
                </div>
              </div>
              <p
                style={{
                  fontSize: 11,
                  color: "#dc2626",
                  textAlign: "center",
                  marginTop: 12,
                  fontWeight: 600,
                }}
              >
                ⚠️ Esta ação não pode ser desfeita!
              </p>
            </div>
            <div
              style={{
                padding: "12px 16px",
                borderTop: "0.5px solid #e5e7eb",
                display: "flex",
                justifyContent: "flex-end",
                gap: 8,
              }}
            >
              <button
                onClick={() => setDeletingOrder(null)}
                style={{
                  height: 32,
                  padding: "0 16px",
                  borderRadius: 6,
                  border: "1px solid #d1d5db",
                  background: "#fff",
                  cursor: "pointer",
                  fontSize: 12,
                }}
              >
                Cancelar
              </button>
              <button
                onClick={() => handleDeleteOrder(deletingOrder.id)}
                style={{
                  height: 32,
                  padding: "0 16px",
                  borderRadius: 6,
                  border: "none",
                  background: "#dc2626",
                  color: "#fff",
                  cursor: "pointer",
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                ❌ Excluir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Confirmação de Cópia de Pedido */}
      {copyingOrder && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
            padding: "16px",
          }}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: 10,
              width: "100%",
              maxWidth: 400,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "16px",
                background: "#eff6ff",
                borderBottom: "1px solid #bfdbfe",
              }}
            >
              <div
                style={{
                  fontSize: 16,
                  fontWeight: 700,
                  color: "#1e40af",
                  textAlign: "center",
                }}
              >
                📋 Copiar Pedido
              </div>
            </div>
            <div style={{ padding: 20 }}>
              <p
                style={{
                  fontSize: 13,
                  color: "#374151",
                  textAlign: "center",
                  marginBottom: 16,
                  lineHeight: "1.5",
                }}
              >
                Copiar pedido <strong>#{copyingOrder.numero_pedido || "S/N"} ({copyingOrder.marca || copyingOrder.fornecedor})</strong>?
              </p>
              <p
                style={{
                  fontSize: 12,
                  color: "#4b5563",
                  textAlign: "center",
                  marginBottom: 16,
                  lineHeight: "1.4",
                }}
              >
                Os dados do pedido serão carregados para criação de um novo pedido. 
                Você poderá alterar tudo antes de salvar.
              </p>
            </div>
            <div
              style={{
                padding: "12px 16px",
                borderTop: "0.5px solid #e5e7eb",
                display: "flex",
                justifyContent: "flex-end",
                gap: 8,
              }}
            >
              <button
                onClick={() => setCopyingOrder(null)}
                style={{
                  height: 32,
                  padding: "0 16px",
                  borderRadius: 6,
                  border: "1px solid #d1d5db",
                  background: "#fff",
                  cursor: "pointer",
                  fontSize: 12,
                }}
              >
                Cancelar
              </button>
              <button
                onClick={() => handleCopyOrder(copyingOrder)}
                style={{
                  height: 32,
                  padding: "0 16px",
                  borderRadius: 6,
                  border: "none",
                  background: "#2563eb",
                  color: "#fff",
                  cursor: "pointer",
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                Copiar e Editar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stand By Modal */}
      {showStandByModalForOrderId && (
        <StandByModal
          orderId={showStandByModalForOrderId}
          userId={user?.id || ""}
          onClose={() => setShowStandByModalForOrderId(null)}
          onSuccess={() => {
            setShowStandByModalForOrderId(null);
            resetStateAndFetch();
          }}
        />
      )}

      {/* Quota Insufficient Modal */}
      {quotaModalData && (
        <QuotaInsufficientModal
          available={quotaModalData.available}
          required={quotaModalData.required}
          deficit={quotaModalData.deficit}
          buyerType={quotaModalData.buyerType}
          onClose={() => setQuotaModalData(null)}
        />
      )}

      {/* Survey Voting Screen */}
      {surveyVotingOrder && (
        <SurveyVotingScreen
          user={user}
          orderId={surveyVotingOrder.orderId}
          subOrderNum={surveyVotingOrder.subOrderNum}
          storeId={surveyVotingOrder.storeId}
          onClose={() => setSurveyVotingOrder(null)}
          onComplete={() => {
            setSurveyVotingOrder(null);
            resetStateAndFetch();
          }}
        />
      )}

      {/* Survey Progress Modal */}
      {surveyProgressOrder && (
        <SurveyProgressModal
          orderId={surveyProgressOrder.orderId}
          numeroPedido={surveyProgressOrder.numero}
          marca={surveyProgressOrder.marca}
          user={user}
          onClose={() => setSurveyProgressOrder(null)}
          onFinalized={() => {
            setSurveyProgressOrder(null);
            resetStateAndFetch();
          }}
        />
      )}

      {/* Cota Extra Solicitation Modal */}
      <SolicitarCotaExtraModal
        isOpen={showSolicitarCotaExtra}
        onClose={() => {
          setShowSolicitarCotaExtra(false);
          setValidationError(null);
        }}
        deficit={validationError?.deficit || 0}
        mesEntrega={validationError?.mes_entrega || 0}
        anoEntrega={validationError?.ano_entrega || 0}
        storeNumber={String(pedidos[0]?.lojas?.[0] || "")}
        userRole={cab.role}
        orderId={null}
        userId={user?.id || ""}
        onSuccess={() => {
          toast.success("Solicitação enviada! Salve como RASCUNHO e aguarde.");
        }}
      />
    </div>
  );
}


