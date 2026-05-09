import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  Dispatch,
  SetStateAction,
} from "react";
import { Pencil, X, Download, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "../../services/supabaseClient";
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

interface Brand {
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

function parsePrazos(raw: string): number[] {
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

function calcularPrecoVenda(
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

function fmtBRL(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function totPares(qtds: Record<string, number>): number {
  return Object.values(qtds).reduce((s, v) => s + (v || 0), 0);
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function BuyOrderModule({ user }: { user?: User }) {
  const [step, setStep] = useState(0);
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
  });

  useEffect(() => {
    if (user) {
      const role = String(user?.role || "").toUpperCase();
      setCab((prev) => ({
        ...prev,
        role: role === "ADMIN" ? "comprador" : "gerente",
      }));
    }
  }, [user]);

  useEffect(() => {
    async function setupSession() {
      if (user?.id) {
        await supabase.rpc("set_user_session", { user_id: user.id });
      }
    }
    setupSession();
  }, [user]);
  const [prazosRaw, setPrazosRaw] = useState("");
  const [items, setItems] = useState<OrderItem[]>([]);
  const [pedidos, setPedidos] = useState<SubOrder[]>([]);
  const [saving, setSaving] = useState(false);
  const [showSolicitarCotaExtra, setShowSolicitarCotaExtra] = useState(false);
  const [validationError, setValidationError] = useState<any>(null);
  const [error, setError] = useState("");
  const [userStoreNumber, setUserStoreNumber] = useState<string | null>(null);

  useEffect(() => {
    async function fetchUserStoreNumber() {
      const isAdmin = String(user?.role || "").toUpperCase() === "ADMIN";
      if (user && !isAdmin && user.storeId) {
        const { data } = await supabase
          .from("stores")
          .select("number")
          .eq("id", user.storeId)
          .single();
        if (data?.number) {
          setUserStoreNumber(data.number);
        }
      }
    }
    fetchUserStoreNumber();
  }, [user]);
  const [numeroPedidoSalvo, setNumeroPedidoSalvo] = useState<number | null>(
    null,
  );
  const [exportando, setExportando] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedLoja, setSelectedLoja] = useState<number | null>(null);
  const [limitPedidos, setLimitPedidos] = useState(5);
  const [totalPedidos, setTotalPedidos] = useState(0);
  const [roundBase, setRoundBase] = useState(15.5);
  const [loading, setLoading] = useState(false);
  const [deletingOrder, setDeletingOrder] = useState<any | null>(null);

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
        .order("created_at", { ascending: false });

      // 3. Aplicar busca por texto
      if (searchTerm.trim()) {
        query = query.or(
          `numero_pedido.eq.${searchTerm},marca.ilike.%${searchTerm}%,fornecedor.ilike.%${searchTerm}%`,
        );
      }

      // ✅ FILTRO CORRETO
      if (isManager) {
        // Gerente vê apenas seus próprios pedidos
        query = query.eq("user_id", user?.id || "NO_USER_ID");
      }

      // Buscar pedidos
      const {
        data: allOrders,
        error: fetchError,
        count,
      } = await query.limit(500);

      if (fetchError) throw fetchError;

      let finalData = allOrders || [];

      if (isManager && userStoreNumber) {
        // Filtrar no frontend os pedidos que incluem a loja do gerente (se precisar, embora o insert só crie com as lojas corretas)
        finalData = finalData.filter((order: any) => {
          const subOrders = order.buy_order_sub_orders || [];
          const todasLojas = subOrders.flatMap(
            (sub: any) => sub.lojas_numeros || [],
          );
          return todasLojas.includes(userStoreNumber!);
        });
      } else if (isAdmin && selectedLoja) {
        // Se Admin tiver um filtro de loja selecionado na interface
        finalData = finalData.filter((order) => {
          const subOrders = order.buy_order_sub_orders || [];
          const todasLojas = subOrders.flatMap(
            (sub: any) => sub.lojas_numeros || [],
          );
          return todasLojas.includes(selectedLoja);
        });
      }

      setRecentOrders(finalData.slice(0, limitPedidos));
      setTotalPedidos(finalData.length);
    } catch (error: any) {
      console.error("Erro ao buscar pedidos:", error);
      toast.error(`❌ ${error.message || "Erro ao carregar pedidos"}`);
    }
  }, [searchTerm, selectedLoja, limitPedidos, user, isManager, isAdmin]);

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
    if (step === 1 && items.length === 0) {
      setError("Adicione ao menos um item antes de continuar.");
      return;
    }
    setError("");
    setStep((s) => s + 1);
  }

  // ─── Salvar no Supabase ──────────────────────────────────────────────────────

  const [showStandByModalForOrderId, setShowStandByModalForOrderId] = useState<
    string | null
  >(null);
  const [quotaModalData, setQuotaModalData] = useState<any | null>(null);

  async function handleSave(
    targetAction: "rascunho" | "rascunho_then_standby" | "confirmado",
  ) {
    setSaving(true);
    setError("");
    try {
      // ✅ VALIDAÇÃO 1: Verificar se há ITENS
      if (items.length === 0) {
        throw new Error('Adicione ao menos um item antes de salvar');
      }

      // ✅ VALIDAÇÃO 2: Verificar se há PEDIDOS (sub-orders com itens vinculados)
      if (pedidos.length === 0 || pedidos.every(p => p.itensComGrades.length === 0)) {
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
        await supabase.rpc("set_user_session", { user_id: userId });
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
        const primeiroPedido = pedidos[0];
        const storeNumber = primeiroPedido?.lojas[0];
        const deliveryDate = new Date(cab.fat_fim + "T00:00:00");
        const month = deliveryDate.getMonth() + 1;
        const year = deliveryDate.getFullYear();

        const validation = await apiService.validarCotaDisponivel(
          storeNumber?.toString() || "",
          preTotalValorLiquidoGeral,
          cab.role,
          month,
          year
        );

        if (!validation.permitido) {
          const isAdmin = user?.role === UserRole.ADMIN || user?.role === UserRole.SUPER_ADMIN;
          
          if (!isAdmin) {
             toast.error(`❌ Bloqueado: ${validation.mensagem}`, { duration: 6000 });
             setSaving(false);
             return;
          } else {
             const confirmarAdmin = confirm(
               `Atenção: A cota atual foi excedida em R$ ${validation.excede_em.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}.\n\n` +
               `Como ADMINISTRADOR, você deseja autorizar este pedido mesmo assim?`
             );
             if (!confirmarAdmin) {
               setSaving(false);
               return;
             }
          }
        }

        // Mantém validação de capacidade de entrega se já existir
        const { data: valData, error: valErr } = await supabase.rpc('validate_order_capacity_v2', {
          p_store_number: storeNumber?.toString() || '', 
          p_delivery_month: month,
          p_delivery_year: year,
          p_payment_months: preVencimentos.map(v => v.getMonth() + 1),
          p_payment_year: preVencimentos.length > 0 ? preVencimentos[0].getFullYear() : year,
          p_order_value: preTotalValorLiquidoGeral,
          p_user_role: cab.role,
          p_exclude_order_id: editingOrderId
        });

        if (valErr) throw valErr;

        if (valData && !valData.success) {
          if (valData.error === 'CAPACIDADE_ENTREGA_INSUFICIENTE') {
            setValidationError(valData);
            setShowSolicitarCotaExtra(true);
            setSaving(false);
            return;
          }
        }
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
        // ✅ USAR FUNÇÃO SEGURA DO APISERVICE
        await apiService.updateBuyOrder(orderId, {
          user_name: user?.name || user?.email || "sistema",
          user_role: cab.role,
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
          status: "rascunho", // Volta para rascunho se foi alterado
        });

        // Excluir os velhos relacionamentos para recriar
        
        // 1. Buscar os items_ids do pedido para deletar os vinculos das grades primeiro
        const { data: items_data } = await supabase.from("buy_order_items").select("id").eq("order_id", orderId);
        if (items_data && items_data.length > 0) {
          const itemIds = items_data.map(i => i.id);
          await supabase.from("buy_order_item_suborder_grades").delete().in("item_id", itemIds);
        }

        await supabase.from("buy_order_items").delete().eq("order_id", orderId);
        await supabase
          .from("buy_order_sub_orders")
          .delete()
          .eq("order_id", orderId);
      } else {
        const { data: order, error: oErr } = await supabase
          .from("buy_orders")
          .insert({
            user_id: userId,
            user_name: user?.name || user?.email || "sistema",
            user_role: cab.role,
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
            status: "rascunho", // Sempre salva inicialmente como rascunho
          })
          .select("id, numero_pedido")
          .single();
        if (oErr) throw oErr;
        orderId = order.id;
        setEditingOrderId(order.id);
        setNumeroPedidoSalvo(order.numero_pedido);
      }

      // 4. Insert buy_order_items
      if (items.length > 0) {
        const itemInputs: BuyOrderItemInput[] = items.map((it, idx) => {
          const itemGradesObj: Record<string, any> = {};
          let totalParesItem = 0;

          pedidos.forEach((ped) => {
            const icg = ped.itensComGrades.find((x) => x.itemIdx === idx);
            if (icg) {
              icg.grades.forEach((g) => {
                // Mapeia a letra da grade para suas quantidades
                itemGradesObj[g.letter] = g.qtds;
                totalParesItem += totPares(g.qtds) * ped.lojas.length;
              });
            }
          });

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
          };
        });

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
            .insert(gradesSubPedidos);
          if (gsErr) throw gsErr;
        }
      }

      // 5. Insert buy_order_sub_orders
      if (pedidos.length > 0) {
        const subRows = pedidos.map((ped) => ({
          order_id: orderId,
          sub_order_num: ped.num,
          pedido_numero: ped.pedido_numero || null,
          lojas_numeros: ped.lojas,
        }));
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
          total_valor_bruto: totalBruto,
          total_valor_liquido: totalLiquido,
          total_pares: pedidos.reduce((acc, p) => acc + (p.itensComGrades.reduce((sum, i) => sum + i.grades.reduce((s, g) => s + totPares(g.qtds), 0), 0) * p.lojas.length), 0)
        })
        .eq("id", orderId);

      // Agora lidar com o fluxo de acordo com a AÇÃO escolhida

      if (targetAction === "rascunho") {
        toast.success(`Rascunho salvo com sucesso! Nº será gerado em breve.`);
        resetStateAndFetch();
      } else if (targetAction === "confirmado") {
        // Tentar confirmar imediatamente chamando a RPC.
        // Ela faz o cálculo da cota, atualiza o status para 'confirmado' ou falha com erro de cota.
        const { data: cData, error: cErr } = await supabase.rpc(
          "confirm_order_from_stand_by",
          {
            p_order_id: orderId,
            p_user_id: userId,
          },
        );

        if (cErr) throw cErr;

        if (!cData.success) {
          if (cData.error === "Cota insuficiente") {
            setQuotaModalData({
              available: cData.cota_disponivel,
              required: cData.valor_pedido,
              deficit: cData.deficit,
              buyerType: cData.tipo_comprador,
            });
            // O pedido já está salvo como rascunho. O usuário terá que ir ver na lista depois.
            resetStateAndFetch();
            toast.error(
              "O pedido foi salvo como Rascunho devido a falta de cota.",
            );
            return;
          } else {
            throw new Error(cData.error);
          }
        }

        // Marcar qualquer cota extra aprovada para este pedido como "usada"
        await supabase.rpc('mark_quota_extra_as_used', { p_order_id: orderId });

        toast.success(`Pedido Confirmado! Cota consumida.`);
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
    setNumeroPedidoSalvo(null);
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
      fetchRecentOrders();
    } catch (err: any) {
      console.error("Erro:", err);
      toast.error(`❌ ${err.message}`);
    } finally {
      setExportando(null);
    }
  }

  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);

  const handleEditOrder = async (orderId: string) => {
    setLoading(true); // Usa o loading geral
    try {
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
        .eq("id", orderId)
        .single();

      if (error) throw error;

      // ✅ SEMPRE carregar no fluxo de 3 etapas (COM cores e grades)
      loadOrderIntoSteps(data);
      
    } catch (err: any) {
      console.error("❌ Erro ao buscar pedido:", err);
      toast.error(`❌ Erro: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const loadOrderIntoSteps = (order: any) => {
    console.log("📦 Carregando pedido para edição:", order);

    // 1. Preencher Cabeçalho
    setCab({
      role: order.user_role,
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
    });

    setPrazosRaw(order.prazos ? order.prazos.join("/") : "");

    // ✅ 2. Preencher Itens COM CORES
    const loadedItems = (order.buy_order_items || [])
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
    
    setItems(loadedItems);
    console.log("✅ Itens carregados:", loadedItems);

    // 1. Criar um mapa de grades globais para a Coluna 2
    const gradesMap: Record<string, { cat: string; qtds: Record<string, number> }> = {};
    
    order.buy_order_items.forEach((item: any) => {
      if (item.grades) {
        Object.keys(item.grades).forEach(letra => {
          if (!gradesMap[letra]) {
            gradesMap[letra] = {
              cat: item.modelo,
              qtds: item.grades[letra]
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
    const loadedSubOrders = (order.buy_order_sub_orders || []).map((sub: any) => ({
      num: sub.sub_order_num,
      pedido_numero: sub.pedido_numero,
      lojas: sub.lojas_numeros || [],
      itensComGrades: (order.buy_order_items || [])
        .filter((item: any) => 
          item.buy_order_item_suborder_grades?.some((g: any) => g.sub_order_num === sub.sub_order_num)
        )
        .map((item: any) => {
          const itemIdx = loadedItems.findIndex((i: any) => i.ref === item.referencia);
          return {
            itemIdx,
            grades: item.buy_order_item_suborder_grades
              .filter((g: any) => g.sub_order_num === sub.sub_order_num)
              .map((g: any) => ({
                letter: g.grade_letra,
                cat: item.modelo,
                qtds: item.grades[g.grade_letra] || {}
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
    
    toast.info("📝 Pedido carregado - Revise cada etapa e salve");
  };

  const handleDeleteOrder = async (orderId: string) => {
    try {
      // ✅ SETAR SESSÃO ANTES DE EXCLUIR
      const userId = user?.id;
      if (!userId) {
        toast.error('❌ Usuário não identificado. Faça login novamente.');
        return;
      }

      await supabase.rpc("set_user_session", { user_id: userId });
      
      const { data, error } = await supabase.rpc('delete_buy_order', {
        p_order_id: orderId
      });
      
      if (error) {
        console.error('Erro ao chamar RPC:', error);
        toast.error('❌ Erro ao excluir pedido.');
        return;
      }
      
      if (data?.success) {
        toast.success(data.message || '✅ Pedido excluído!');
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
      <div
        style={{
          background: "#fff",
          border: "0.5px solid #e5e7eb",
          borderRadius: 10,
          overflow: "hidden",
        }}
      >
        {/* Título + role */}
        <div className="p-4 md:p-6 border-b flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {numeroPedidoSalvo ? (
              <span style={{ fontSize: 15, fontWeight: 600 }}>
                Pedido #{numeroPedidoSalvo}
              </span>
            ) : (
              <span style={{ fontSize: 15, fontWeight: 500 }}>
                Novo pedido de compra
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
          />
        )}
        {step === 1 && (
          <StepItens
            items={items}
            setItems={setItems}
            cab={cab}
            roundBase={roundBase}
            selectedLojas={step2State.selectedLojas}
          />
        )}
        {step === 2 && (
          <StepPedidos
            items={items}
            pedidos={pedidos}
            setPedidos={setPedidos}
            user={user}
            cab={cab}
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
          <button
            onClick={() => {
              setError("");
              setStep((s) => Math.max(0, s - 1));
            }}
            style={{
              visibility: step === 0 ? "hidden" : "visible",
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

            {step === STEPS.length - 1 && (pedidos.length === 0 || pedidos.every(p => p.itensComGrades.length === 0)) ? (
              <div className="text-xs text-amber-600 bg-amber-50 border border-amber-300 rounded-lg px-3 py-1 flex items-center h-8">
                ⚠️ Crie ao menos um pedido
              </div>
            ) : null}

            {step === STEPS.length - 1 ? (
              <>
                <button
                  onClick={() => handleSave("rascunho")}
                  disabled={saving || !isHeaderValid || items.length === 0 || pedidos.length === 0 || pedidos.every(p => p.itensComGrades.length === 0)}
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
                    opacity: (saving || !isHeaderValid || items.length === 0 || pedidos.length === 0 || pedidos.every(p => p.itensComGrades.length === 0)) ? 0.7 : 1,
                  }}
                >
                  Salvar Rascunho
                </button>
                <button
                  onClick={() => {
                    handleSave("rascunho_then_standby");
                  }}
                  disabled={saving || !isHeaderValid || items.length === 0 || pedidos.length === 0 || pedidos.every(p => p.itensComGrades.length === 0)}
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
                    opacity: (saving || !isHeaderValid || items.length === 0 || pedidos.length === 0 || pedidos.every(p => p.itensComGrades.length === 0)) ? 0.7 : 1,
                  }}
                >
                  Salvar em Stand By
                </button>
                <button
                  onClick={() => handleSave("confirmado")}
                  disabled={saving || !isHeaderValid || items.length === 0 || pedidos.length === 0 || pedidos.every(p => p.itensComGrades.length === 0)}
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
                    opacity: (saving || !isHeaderValid || items.length === 0 || pedidos.length === 0 || pedidos.every(p => p.itensComGrades.length === 0)) ? 0.7 : 1,
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

      {/* Lista de Pedidos Recentes */}
      <div
        style={{
          marginTop: 24,
          background: "#fff",
          border: "0.5px solid #e5e7eb",
          borderRadius: 10,
          overflow: "hidden",
        }}
      >
        {/* Cabeçalho com filtros */}
        <div
          style={{ padding: "16px 18px", borderBottom: "0.5px solid #e5e7eb" }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 12,
            }}
          >
            <span
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: "#374151",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              Pedidos Recentes ({recentOrders.length})
            </span>
            <button
              onClick={fetchRecentOrders}
              style={{
                background: "none",
                border: "none",
                color: "#185FA5",
                fontSize: 11,
                cursor: "pointer",
                fontWeight: 500,
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              <RefreshCw size={12} />
              Atualizar
            </button>
          </div>

          {/* Filtros */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {/* Busca */}
            <input
              type="text"
              placeholder="Buscar por nº, marca ou fornecedor..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                flex: 1,
                minWidth: 200,
                padding: "6px 10px",
                border: "1px solid #d1d5db",
                borderRadius: 6,
                fontSize: 11,
              }}
            />

            {/* ✅ Filtro de loja baseado em permissões */}
            {canViewAllStores ? (
              <select
                value={selectedLoja || ""}
                onChange={(e) =>
                  setSelectedLoja(
                    e.target.value ? Number(e.target.value) : null,
                  )
                }
                style={{
                  padding: "6px 10px",
                  border: "1px solid #d1d5db",
                  borderRadius: 6,
                  fontSize: 11,
                  minWidth: 120,
                }}
              >
                <option value="">Todas as lojas</option>
                {allowedStores.map((store) => (
                  <option key={store.number} value={store.number}>
                    Loja {store.number}
                  </option>
                ))}
              </select>
            ) : allowedStores.length > 0 ? (
              <span
                style={{
                  padding: "6px 10px",
                  background: "#f3f4f6",
                  borderRadius: 6,
                  fontSize: 10,
                  color: "#6b7280",
                }}
              >
                📍 Loja {allowedStores[0]?.number} - {allowedStores[0]?.name}
              </span>
            ) : null}
          </div>
        </div>

        {/* Tabela */}
        <div style={{ overflowX: "auto" }}>
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
              {recentOrders.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    style={{
                      padding: "20px",
                      textAlign: "center",
                      color: "#9ca3af",
                    }}
                  >
                    {searchTerm
                      ? "Nenhum pedido encontrado com esse filtro."
                      : "Nenhum pedido encontrado."}
                  </td>
                </tr>
              )}
              {recentOrders.map((o) => {
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
                      <div
                        style={{ display: "flex", gap: 4, flexWrap: "wrap" }}
                      >
                        {lojasUnicas.length > 0 ? (
                          lojasUnicas.map((loja) => (
                            <span
                              key={loja}
                              style={{
                                fontSize: 9,
                                color: "#374151",
                                background: "#f3f4f6",
                                padding: "2px 6px",
                                borderRadius: 4,
                                border: "0.5px solid #d1d5db",
                              }}
                            >
                              {loja}
                            </span>
                          ))
                        ) : (
                          <span style={{ fontSize: 10, color: "#9ca3af" }}>
                            —
                          </span>
                        )}
                      </div>
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
                        {o.user_role === "comprador" ||
                        o.user_role === "ADMIN" ? (
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
                        const status =
                          o.status ||
                          (o.exported_at ? "exportado" : "confirmado");
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
                        if (status === "exportado" || o.exported_at)
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
        </div>

        {/* Botão Ver Mais */}
        {recentOrders.length >= limitPedidos && (
          <div
            style={{
              padding: 12,
              textAlign: "center",
              borderTop: "0.5px solid #e5e7eb",
            }}
          >
            <button
              onClick={() => setLimitPedidos((prev) => prev + 10)}
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
              Ver mais 10 pedidos
            </button>
          </div>
        )}
      </div>

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

// ─── Step 0: Cabeçalho ────────────────────────────────────────────────────────

function StepCabecalho({
  cab,
  setCab,
  prazosRaw,
  setPrazosRaw,
  numeroPedidoSalvo,
  setNumeroPedidoSalvo,
  roundBase,
}: {
  cab: Cabecalho;
  setCab: Dispatch<SetStateAction<Cabecalho>>;
  prazosRaw: string;
  setPrazosRaw: (s: string) => void;
  numeroPedidoSalvo: number | null;
  setNumeroPedidoSalvo: (n: number | null) => void;
  roundBase: number;
}) {
  const { fetchAndFillBrand, isLoading } = useBrandAutocomplete();
  const [brands, setBrands] = useState<Brand[]>([]);
  const [showDrop, setShowDrop] = useState(false);
  const [searching, setSearching] = useState(false);
  const [activeSearchField, setActiveSearchField] = useState<string | null>(
    null,
  );
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [vencimentosCalculados, setVencimentosCalculados] = useState<string[]>(
    [],
  );

  const calculateVencimentos = (dataFinal: string, prazosStr: string) => {
    if (!dataFinal || !prazosStr) return [];

    // Configura 12:00 UTC para evitar que a conversão por fuso decaia para o dia anterior
    const data = new Date(dataFinal + "T12:00:00");
    const prazos = prazosStr
      .split(/[,;\/\s]+/)
      .map((p) => parseInt(p.trim()))
      .filter((p) => !isNaN(p));

    return prazos.map((prazo) => {
      const venc = new Date(data);
      venc.setDate(venc.getDate() + prazo);
      const meses = [
        "JAN",
        "FEV",
        "MAR",
        "ABR",
        "MAI",
        "JUN",
        "JUL",
        "AGO",
        "SET",
        "OUT",
        "NOV",
        "DEZ",
      ];
      return `${meses[venc.getMonth()]}/${venc.getFullYear().toString().slice(-2)}`;
    });
  };

  useEffect(() => {
    if (cab.fat_fim && prazosRaw) {
      setVencimentosCalculados(calculateVencimentos(cab.fat_fim, prazosRaw));
    } else {
      setVencimentosCalculados([]);
    }
  }, [cab.fat_fim, prazosRaw]);

  function onFieldInput(field: keyof Cabecalho, val: string) {
    const uppercaseVal = val.toUpperCase();
    setCab((c) => ({
      ...c,
      [field]: uppercaseVal,
      brand_id: field === "marca" ? null : c.brand_id,
    }));

    if (field === "marca" && numeroPedidoSalvo) setNumeroPedidoSalvo(null);

    // ✅ Autocomplete otimizado para marca
    if (field === "marca") {
      fetchAndFillBrand(uppercaseVal, setCab);
      return;
    }

    if (["fornecedor", "representante"].includes(field as string)) {
      if (uppercaseVal.length < 3) {
        setBrands([]);
        setShowDrop(false);
        return;
      }

      clearTimeout(searchTimer.current!);
      setSearching(true);
      setShowDrop(true);
      setActiveSearchField(field as string);

      searchTimer.current = setTimeout(async () => {
        const { data } = await supabase
          .from("buy_brands")
          .select("id,marca,fornecedor,representante,telefone,email")
          .ilike(field as string, `%${uppercaseVal}%`)
          .eq("is_active", true)
          .order(field as string, { ascending: true })
          .limit(8);
        setBrands(data ?? []);
        setSearching(false);
      }, 300);
    }
  }

  function selectBrand(b: Brand) {
    setCab((c) => ({
      ...c,
      brand_id: b.id,
      marca: b.marca,
      fornecedor: b.fornecedor,
      representante: b.representante,
      telefone: b.telefone ?? "",
      email: b.email ?? "",
    }));
    setShowDrop(false);
    setActiveSearchField(null);
  }

  const liq = 100 * (1 - (cab.desconto || 0) / 100);
  const exVenda = calcularPrecoVenda(100, cab.desconto, cab.markup);

  const labelStyle: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 600,
    color: "#475569",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    marginBottom: 4,
    display: "block",
  };

  return (
    <div>
      {/* SEÇÃO 1: DADOS DO FORNECEDOR */}
      <div
        style={{
          padding: "10px 18px",
          background: "#f8fafc",
          borderBottom: "1px solid #e2e8f0",
          fontSize: 11,
          fontWeight: 800,
          color: "#1e293b",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
        }}
      >
        📦 Dados do Fornecedor
      </div>
      <div className="p-4 md:p-6 border-b border-slate-200 space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="relative">
            <label style={labelStyle}>Marca *</label>
            <input
              value={cab.marca}
              onChange={(e) => onFieldInput("marca", e.target.value)}
              onBlur={() => setTimeout(() => setShowDrop(false), 250)}
              placeholder="Digite a marca..."
              autoComplete="off"
              className={`w-full h-10 px-3 border rounded-lg text-sm uppercase font-bold focus:ring-2 focus:ring-blue-500 outline-none transition-all ${!cab.marca ? "border-red-300 bg-red-50/30" : "border-slate-300"}`}
            />
            {showDrop && activeSearchField === "marca" && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-300 rounded-lg shadow-xl z-50 max-h-60 overflow-y-auto">
                {searching && (
                  <div className="p-4 text-xs text-slate-500 italic">
                    Buscando marca...
                  </div>
                )}
                {!searching && brands.length === 0 && (
                  <div className="p-4 text-xs text-slate-500 italic">
                    Marca nova
                  </div>
                )}
                {!searching &&
                  brands.map((b) => (
                    <div
                      key={b.id}
                      onMouseDown={() => selectBrand(b)}
                      className="p-3 text-sm cursor-pointer hover:bg-blue-50 border-b border-slate-50 last:border-0 transition-colors"
                    >
                      <div className="font-bold text-blue-900">{b.marca}</div>
                      <div className="text-[10px] text-slate-500 mt-1 uppercase">
                        {b.fornecedor} • {b.representante}
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
          <div className="relative">
            <label style={labelStyle}>Fornecedor *</label>
            <input
              value={cab.fornecedor}
              onChange={(e) => onFieldInput("fornecedor", e.target.value)}
              onBlur={() => setTimeout(() => setShowDrop(false), 250)}
              placeholder="Razão social"
              autoComplete="off"
              className={`w-full h-10 px-3 border rounded-lg text-sm uppercase focus:ring-2 focus:ring-blue-500 outline-none transition-all ${!cab.fornecedor ? "border-red-300 bg-red-50/30" : "border-slate-300"}`}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="relative">
            <label style={labelStyle}>Representante *</label>
            <input
              value={cab.representante}
              onChange={(e) => onFieldInput("representante", e.target.value)}
              onBlur={() => setTimeout(() => setShowDrop(false), 250)}
              placeholder="Nome do representante"
              autoComplete="off"
              className={`w-full h-10 px-3 border rounded-lg text-sm uppercase focus:ring-2 focus:ring-blue-500 outline-none transition-all ${!cab.representante ? "border-red-300 bg-red-50/30" : "border-slate-300"}`}
            />
          </div>
          <div>
            <label style={labelStyle}>Telefone Rep. *</label>
            <input
              value={cab.telefone}
              onChange={(e) =>
                setCab((c) => ({ ...c, telefone: e.target.value }))
              }
              placeholder="(00) 00000-0000"
              className={`w-full h-10 px-3 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all ${!cab.telefone ? "border-red-300 bg-red-50/30" : "border-slate-300"}`}
            />
          </div>
          <div>
            <label style={labelStyle}>Email Rep. *</label>
            <input
              value={cab.email}
              onChange={(e) =>
                setCab((c) => ({ ...c, email: e.target.value.toUpperCase() }))
              }
              placeholder="vendas@fornecedor.com.br"
              className={`w-full h-10 px-3 border rounded-lg text-sm uppercase focus:ring-2 focus:ring-blue-500 outline-none transition-all ${!cab.email ? "border-red-300 bg-red-50/30" : "border-slate-300"}`}
            />
          </div>
        </div>
      </div>

      {/* SEÇÃO 2: FATURAMENTO */}
      <div
        style={{
          padding: "10px 18px",
          background: "#f8fafc",
          borderBottom: "1px solid #e2e8f0",
          fontSize: 11,
          fontWeight: 800,
          color: "#1e293b",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
        }}
      >
        📅 Faturamento
      </div>
      <div className="p-4 md:p-6 border-b border-slate-200">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-5">
          <div>
            <label style={labelStyle}>Data Inicial *</label>
            <input
              type="date"
              value={cab.fat_inicio}
              onChange={(e) =>
                setCab((c) => ({ ...c, fat_inicio: e.target.value }))
              }
              className={`w-full h-10 px-3 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all ${!cab.fat_inicio || (cab.fat_fim && (new Date(cab.fat_inicio + "T00:00:00").getMonth() !== new Date(cab.fat_fim + "T00:00:00").getMonth() || new Date(cab.fat_inicio + "T00:00:00").getFullYear() !== new Date(cab.fat_fim + "T00:00:00").getFullYear())) ? "border-red-300 bg-red-50/30" : "border-slate-300"}`}
            />
          </div>
          <div>
            <label style={labelStyle}>Data Final *</label>
            <input
              type="date"
              value={cab.fat_fim}
              onChange={(e) =>
                setCab((c) => ({ ...c, fat_fim: e.target.value }))
              }
              className={`w-full h-10 px-3 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all ${!cab.fat_fim || (cab.fat_inicio && (new Date(cab.fat_inicio + "T00:00:00").getMonth() !== new Date(cab.fat_fim + "T00:00:00").getMonth() || new Date(cab.fat_inicio + "T00:00:00").getFullYear() !== new Date(cab.fat_fim + "T00:00:00").getFullYear())) ? "border-red-300 bg-red-50/30" : "border-slate-300"}`}
            />
          </div>
          <div>
            <label style={labelStyle}>Prazos * (ex: 90/120/150)</label>
            <input
              value={prazosRaw}
              onChange={(e) => {
                setPrazosRaw(e.target.value);
                setCab((c) => ({ ...c, prazos: parsePrazos(e.target.value) }));
              }}
              placeholder="Ex: 90/120/150 cada parcela"
              className={`w-full h-10 px-3 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all ${!prazosRaw ? "border-red-300 bg-red-50/30" : "border-slate-300"}`}
            />
            {vencimentosCalculados.length > 0 && (
              <div className="flex gap-2 flex-wrap mt-2">
                {vencimentosCalculados.map((v, idx) => (
                  <span
                    key={idx}
                    className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-full text-[10px] font-bold"
                  >
                    {v}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* SEÇÃO 3: PRECIFICAÇÃO */}
      <div
        style={{
          padding: "10px 18px",
          background: "#f8fafc",
          borderBottom: "1px solid #e2e8f0",
          fontSize: 11,
          fontWeight: 800,
          color: "#1e293b",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
        }}
      >
        💰 Precificação
      </div>
      <div className="p-4 md:p-6 border-b border-slate-200">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
          <div className="grid grid-cols-2 gap-4">
            <div className="w-full">
              <label style={labelStyle} className="text-left w-full block">
                Markup (%) *
              </label>
              <input
                type="number"
                min={0}
                max={10}
                step={0.01}
                value={cab.markup === 0 ? "" : cab.markup}
                onChange={(e) =>
                  setCab((c) => ({
                    ...c,
                    markup: parseFloat(e.target.value) || 0,
                  }))
                }
                className={`w-full h-10 px-3 text-center font-bold text-blue-600 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all ${cab.markup === 0 ? "border-amber-300 bg-amber-50/30" : "border-slate-300"}`}
              />
              <div className="text-[10px] text-slate-400 mt-1 italic text-left">
                Fator multiplicador (ex: 2.60)
              </div>
            </div>
            <div className="w-full">
              <label style={labelStyle} className="text-left w-full block">
                Desconto (%)
              </label>
              <input
                type="number"
                min={0}
                max={100}
                step={0.1}
                value={cab.desconto === 0 ? "" : cab.desconto}
                onChange={(e) =>
                  setCab((c) => ({
                    ...c,
                    desconto: parseFloat(e.target.value) || 0,
                  }))
                }
                className="w-full h-10 px-3 text-center font-bold text-blue-600 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              />
            </div>
          </div>
          <div className="w-full pt-0 md:pt-[18px]">
            <div
              style={{
                background: "#f8fafc",
                border: "1px solid #e2e8f0",
                borderRadius: 8,
                padding: "0 20px",
                display: "flex",
                alignItems: "center",
                height: 40,
                justifyContent: "space-between",
              }}
            >
              <div className="flex items-center gap-2">
                <div
                  style={{
                    fontSize: 10,
                    color: "#64748b",
                    fontWeight: 700,
                    textTransform: "uppercase",
                  }}
                >
                  Custo
                </div>
                <div style={{ fontSize: 13, fontWeight: 700 }}>R$ 100,00</div>
              </div>
              <div className="flex items-center gap-2">
                <div
                  style={{
                    fontSize: 10,
                    color: "#64748b",
                    fontWeight: 700,
                    textTransform: "uppercase",
                  }}
                >
                  Desc.
                </div>
                <div
                  style={{ fontSize: 12, fontWeight: 700, color: "#dc2626" }}
                >
                  {cab.desconto.toFixed(1)}%
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div
                  style={{
                    fontSize: 10,
                    color: "#1d4ed8",
                    fontWeight: 700,
                    textTransform: "uppercase",
                  }}
                >
                  Venda Est.
                </div>
                <div
                  style={{ fontSize: 15, fontWeight: 800, color: "#1d4ed8" }}
                >
                  {fmtBRL(exVenda)}
                </div>
              </div>
            </div>
            <div className="text-[10px] text-slate-400 mt-1 italic text-right">
              Marcação do markup e desconto estimado
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Step 1: Itens ────────────────────────────────────────────────────────────

function StepItens({
  items,
  setItems,
  cab,
  roundBase,
  selectedLojas,
}: {
  items: OrderItem[];
  setItems: Dispatch<SetStateAction<OrderItem[]>>;
  cab: Cabecalho;
  roundBase: number;
  selectedLojas: number[];
}) {
  const [showPopup, setShowPopup] = useState(false);
  const [editIdx, setEditIdx] = useState(-1);
  const [form, setForm] = useState({
    ref: "",
    tipo: "",
    cor1: "",
    cor2: "",
    cor3: "",
    modelo: "FEM",
    custo: "",
  });
  const [historicPrice, setHistoricPrice] = useState<number | null>(null);

  useEffect(() => {
    if (form.ref && form.ref.length >= 5) {
      const timer = setTimeout(async () => {
        const preco = await fetchPreviousPrice(form.ref);
        if (preco) {
          setHistoricPrice(preco);
        } else {
          setHistoricPrice(null);
        }
      }, 500);
      return () => clearTimeout(timer);
    } else {
      setHistoricPrice(null);
    }
  }, [form.ref]);
  const [cor2Manual, setCor2Manual] = useState(false);
  const [cor3Manual, setCor3Manual] = useState(false);
  const [isCalculating, setIsCalculating] = useState(false);

  const [tipoSuggestions, setTipoSuggestions] = useState<string[]>([]);
  const [showTipoDropdown, setShowTipoDropdown] = useState(false);
  const [corSuggestions, setCorSuggestions] = useState<string[]>([]);
  const [showCorDropdown, setShowCorDropdown] = useState<{
    field: "cor1" | "cor2" | "cor3" | null;
  }>({ field: null });

  const [isMobile, setIsMobile] = useState(false);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);

  const refInputRef = useRef<HTMLInputElement>(null);
  const tipoInputRef = useRef<HTMLInputElement>(null);
  const cor1InputRef = useRef<HTMLInputElement>(null);
  const cor2InputRef = useRef<HTMLInputElement>(null);
  const cor3InputRef = useRef<HTMLInputElement>(null);
  const modeloInputRef = useRef<HTMLSelectElement>(null);
  const custoInputRef = useRef<HTMLInputElement>(null);
  const btnSalvarRef = useRef<HTMLButtonElement>(null);

  function handleEnterKey(
    e: React.KeyboardEvent,
    nextRef: React.RefObject<any>,
    ignoreDropdown = false,
  ) {
    if (
      e.key === "Enter" &&
      (ignoreDropdown || selectedSuggestionIndex === -1)
    ) {
      e.preventDefault();
      nextRef.current?.focus();
    }
  }

  useEffect(() => {
    const checkDevice = () => {
      setIsMobile(window.innerWidth < 768 || "ontouchstart" in window);
    };
    checkDevice();
    window.addEventListener("resize", checkDevice);
    return () => window.removeEventListener("resize", checkDevice);
  }, []);

  async function searchTipos(query: string) {
    if (query.length < 3) {
      setTipoSuggestions([]);
      setShowTipoDropdown(false);
      return;
    }
    const { data } = await supabase
      .from("buy_item_types")
      .select("tipo")
      .ilike("tipo", `%${query}%`)
      .order("uso_count", { ascending: false })
      .order("tipo", { ascending: true })
      .limit(10);
    setTipoSuggestions(data?.map((t) => t.tipo) || []);
    setShowTipoDropdown(true);
  }

  async function searchCores(query: string, field: "cor1" | "cor2" | "cor3") {
    if (query.length < 2) {
      setCorSuggestions([]);
      setShowCorDropdown({ field: null });
      return;
    }
    const { data } = await supabase
      .from("buy_item_colors")
      .select("cor")
      .ilike("cor", `%${query}%`)
      .order("uso_count", { ascending: false })
      .order("cor", { ascending: true })
      .limit(10);
    setCorSuggestions(data?.map((c) => c.cor) || []);
    setShowCorDropdown({ field });
  }

  function selectTipo(tipo: string) {
    setForm((f) => ({ ...f, tipo }));
    setShowTipoDropdown(false);
    supabase.rpc("increment_tipo_usage", { tipo_name: tipo });
  }

  function selectCor(cor: string, field: "cor1" | "cor2" | "cor3") {
    if (field === "cor1") {
      setForm((f) => ({
        ...f,
        cor1: cor,
        cor2: cor2Manual ? f.cor2 : cor,
        cor3: cor3Manual ? f.cor3 : cor,
      }));
    } else if (field === "cor2") {
      setCor2Manual(true);
      setForm((f) => ({ ...f, cor2: cor }));
    } else {
      setCor3Manual(true);
      setForm((f) => ({ ...f, cor3: cor }));
    }
    setShowCorDropdown({ field: null });
    supabase.rpc("increment_color_usage", { color_name: cor });
  }

  function openNew() {
    setForm({
      ref: "",
      tipo: "",
      cor1: "",
      cor2: "",
      cor3: "",
      modelo: "FEM",
      custo: "",
    });
    setEditIdx(-1);
    setCor2Manual(false);
    setCor3Manual(false);
    setCorSuggestions([]);
    setTipoSuggestions([]);
    setShowPopup(true);
  }
  function openEdit(i: number) {
    const it = items[i];
    setForm({
      ref: it.ref,
      tipo: it.tipo,
      cor1: it.cor1,
      cor2: it.cor2,
      cor3: it.cor3,
      modelo: it.modelo || "FEM",
      custo: String(it.custo),
    });
    setEditIdx(i);
    setCor2Manual(!!it.cor2);
    setCor3Manual(!!it.cor3);
    setCorSuggestions([]);
    setTipoSuggestions([]);
    setShowPopup(true);
  }

  function onCor1(v: string) {
    const vu = v.toUpperCase();
    setForm((f) => ({
      ...f,
      cor1: vu,
      cor2: cor2Manual ? f.cor2 : vu,
      cor3: cor3Manual ? f.cor3 : vu,
    }));
  }

  async function saveItem() {
    setIsCalculating(true);
    const custo = parseFloat(form.custo) || 0;
    const preco_venda = estVenda;

    const item: OrderItem = {
      ref: form.ref,
      tipo: form.tipo,
      cor1: form.cor1,
      cor2: form.cor2,
      cor3: form.cor3,
      modelo: form.modelo,
      custo,
      preco_venda,
      historico_preco_venda: historicPrice || undefined,
    };
    if (editIdx >= 0)
      setItems((its) => its.map((it, i) => (i === editIdx ? item : it)));
    else setItems((its) => [...its, item]);
    setShowPopup(false);
    setIsCalculating(false);
  }

  function delItem(i: number) {
    setItems((its) => its.filter((_, idx) => idx !== i));
  }

  const estVenda = calcularPrecoVenda(
    parseFloat(form.custo) || 0,
    cab.desconto,
    cab.markup,
  );

  return (
    <div className="flex flex-col h-full">
      <div
        style={{
          padding: "6px 18px",
          background: "#f9fafb",
          borderBottom: "0.5px solid #e5e7eb",
          fontSize: 10,
          fontWeight: 500,
          color: "#6b7280",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span>Itens do pedido</span>
        <button
          onClick={openNew}
          style={{
            height: 22,
            padding: "0 10px",
            borderRadius: 4,
            fontSize: 11,
            fontWeight: 500,
            cursor: "pointer",
            border: "none",
            background: "#185FA5",
            color: "#fff",
          }}
        >
          + Item
        </button>
      </div>

      <div className="overflow-auto flex-1">
        <table className="w-full border-collapse table-fixed">
          <thead>
            <tr style={{ background: "#f9fafb" }}>
              <th
                className="w-8"
                style={{
                  padding: "6px 4px",
                  textAlign: "left",
                  fontWeight: 500,
                  color: "#6b7280",
                  borderBottom: "0.5px solid #e5e7eb",
                  whiteSpace: "nowrap",
                }}
              >
                #
              </th>
              <th
                className="w-28"
                style={{
                  padding: "6px 4px",
                  textAlign: "left",
                  fontWeight: 500,
                  color: "#6b7280",
                  borderBottom: "0.5px solid #e5e7eb",
                  whiteSpace: "nowrap",
                }}
              >
                Referência
              </th>
              <th
                className="w-48 text-xs"
                style={{
                  padding: "6px 4px",
                  textAlign: "left",
                  fontWeight: 500,
                  color: "#6b7280",
                  borderBottom: "0.5px solid #e5e7eb",
                  whiteSpace: "nowrap",
                }}
              >
                Tipo
              </th>
              <th
                className="w-20 text-xs"
                style={{
                  padding: "6px 4px",
                  textAlign: "left",
                  fontWeight: 500,
                  color: "#6b7280",
                  borderBottom: "0.5px solid #e5e7eb",
                  whiteSpace: "nowrap",
                }}
              >
                Cor 1
              </th>
              <th
                className="w-20 text-xs"
                style={{
                  padding: "6px 4px",
                  textAlign: "left",
                  fontWeight: 500,
                  color: "#6b7280",
                  borderBottom: "0.5px solid #e5e7eb",
                  whiteSpace: "nowrap",
                }}
              >
                Cor 2
              </th>
              <th
                className="w-20 text-xs"
                style={{
                  padding: "6px 4px",
                  textAlign: "left",
                  fontWeight: 500,
                  color: "#6b7280",
                  borderBottom: "0.5px solid #e5e7eb",
                  whiteSpace: "nowrap",
                }}
              >
                Cor 3
              </th>
              <th
                className="w-24 text-right"
                style={{
                  padding: "6px 8px",
                  fontWeight: 500,
                  color: "#6b7280",
                  borderBottom: "0.5px solid #e5e7eb",
                  whiteSpace: "nowrap",
                }}
              >
                Custo
              </th>
              <th
                className="w-24 text-right"
                style={{
                  padding: "6px 12px",
                  fontWeight: 500,
                  color: "#6b7280",
                  borderBottom: "0.5px solid #e5e7eb",
                  whiteSpace: "nowrap",
                }}
              >
                Venda
              </th>
              <th
                className="w-16 text-right"
                style={{
                  padding: "6px 12px",
                  fontWeight: 500,
                  color: "#6b7280",
                  borderBottom: "0.5px solid #e5e7eb",
                  whiteSpace: "nowrap",
                }}
              >
                Ações
              </th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr>
                <td
                  colSpan={9}
                  style={{
                    textAlign: "center",
                    padding: "20px 0",
                    color: "#9ca3af",
                    fontSize: 12,
                  }}
                >
                  Nenhum item. Clique em "+ Item" para adicionar.
                </td>
              </tr>
            )}
            {items.map((it, i) => (
              <tr key={i} style={{ borderBottom: "0.5px solid #f3f4f6" }}>
                <td
                  className="text-[10px]"
                  style={{ padding: "5px 4px", color: "#9ca3af" }}
                >
                  {i + 1}
                </td>
                <td
                  className="text-xs"
                  style={{ padding: "5px 4px", fontWeight: 500 }}
                >
                  {it.ref || "—"}
                </td>
                <td className="text-[10px]" style={{ padding: "5px 4px" }}>
                  {it.tipo || "—"}
                </td>
                <td className="text-[10px]" style={{ padding: "5px 4px" }}>
                  {it.cor1 || "—"}
                </td>
                <td
                  className="text-[10px]"
                  style={{ padding: "5px 4px", color: "#9ca3af" }}
                >
                  {it.cor2 || "—"}
                </td>
                <td
                  className="text-[10px]"
                  style={{ padding: "5px 4px", color: "#9ca3af" }}
                >
                  {it.cor3 || "—"}
                </td>
                <td
                  className="text-[11px] text-right font-medium"
                  style={{ padding: "5px 8px", color: "#64748b" }}
                >
                  {fmtBRL(it.custo)}
                </td>
                <td
                  className={`text-xs text-right font-semibold ${it.historico_preco_venda && it.preco_venda > it.historico_preco_venda ? "text-emerald-600 animate-pulse" : it.historico_preco_venda && it.preco_venda < it.historico_preco_venda ? "text-amber-500 animate-pulse" : "text-[#185FA5]"}`}
                  style={{ padding: "5px 12px" }}
                >
                  {fmtBRL(it.preco_venda)}
                </td>
                <td className="text-right" style={{ padding: "5px 12px" }}>
                  <button
                    onClick={() => openEdit(i)}
                    style={{
                      border: "none",
                      background: "transparent",
                      cursor: "pointer",
                      color: "#185FA5",
                      marginRight: 8,
                    }}
                    title="Editar"
                  >
                    <Pencil size={12} strokeWidth={2.5} />
                  </button>
                  <button
                    onClick={() => delItem(i)}
                    style={{
                      border: "none",
                      background: "transparent",
                      cursor: "pointer",
                      color: "#dc2626",
                    }}
                    title="Excluir"
                  >
                    <X size={14} strokeWidth={2.5} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Popup item */}
      {showPopup && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.4)",
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
              border: "0.5px solid #e5e7eb",
              width: 400,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "10px 16px",
                borderBottom: "0.5px solid #e5e7eb",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span style={{ fontSize: 13, fontWeight: 500 }}>
                {editIdx >= 0 ? `Editar item ${editIdx + 1}` : "Novo item"}
              </span>
              <button
                onClick={() => setShowPopup(false)}
                style={{
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                  fontSize: 16,
                  color: "#6b7280",
                }}
              >
                ✕
              </button>
            </div>
            <div style={{ padding: 16 }}>
              {/* LINHA 1: Referência ocupa linha inteira */}
              <div style={{ marginBottom: 10 }}>
                <label
                  style={{
                    fontSize: 10,
                    fontWeight: 500,
                    color: "#6b7280",
                    textTransform: "uppercase",
                    display: "block",
                    marginBottom: 3,
                  }}
                >
                  Referência *
                </label>
                <input
                  ref={refInputRef}
                  onKeyDown={(e) => handleEnterKey(e, tipoInputRef, true)}
                  value={form.ref}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      ref: e.target.value.toUpperCase(),
                    }))
                  }
                  placeholder="REF-001"
                  style={{
                    height: 30,
                    width: "100%",
                    padding: "0 8px",
                    border: "0.5px solid #d1d5db",
                    borderRadius: 5,
                    fontSize: 12,
                    outline: "none",
                    textTransform: "uppercase",
                  }}
                  autoFocus
                />
              </div>

              {/* LINHA 2: Tipo com AUTOCOMPLETE */}
              <div style={{ marginBottom: 10, position: "relative" }}>
                <label
                  style={{
                    fontSize: 10,
                    fontWeight: 500,
                    color: "#6b7280",
                    textTransform: "uppercase",
                    display: "block",
                    marginBottom: 3,
                  }}
                >
                  Tipo
                </label>
                <input
                  ref={tipoInputRef}
                  value={form.tipo}
                  onChange={(e) => {
                    const v = e.target.value.toUpperCase();
                    setForm((f) => ({ ...f, tipo: v }));
                    searchTipos(v);
                    setSelectedSuggestionIndex(-1);
                  }}
                  onKeyDown={(e) => {
                    if (isMobile) {
                      handleEnterKey(e, cor1InputRef, true);
                      return;
                    }
                    if (showTipoDropdown && tipoSuggestions.length > 0) {
                      if (e.key === "ArrowDown") {
                        e.preventDefault();
                        setSelectedSuggestionIndex((prev) =>
                          prev < tipoSuggestions.length - 1 ? prev + 1 : prev,
                        );
                        return;
                      } else if (e.key === "ArrowUp") {
                        e.preventDefault();
                        setSelectedSuggestionIndex((prev) =>
                          prev > 0 ? prev - 1 : -1,
                        );
                        return;
                      } else if (
                        e.key === "Enter" &&
                        selectedSuggestionIndex >= 0
                      ) {
                        e.preventDefault();
                        selectTipo(tipoSuggestions[selectedSuggestionIndex]);
                        setSelectedSuggestionIndex(-1);
                        cor1InputRef.current?.focus();
                        return;
                      } else if (e.key === "Escape") {
                        setShowTipoDropdown(false);
                        setSelectedSuggestionIndex(-1);
                        return;
                      }
                    }
                    handleEnterKey(e, cor1InputRef);
                  }}
                  onBlur={() =>
                    setTimeout(() => {
                      setShowTipoDropdown(false);
                      setSelectedSuggestionIndex(-1);
                    }, 200)
                  }
                  placeholder="Digite o tipo do produto"
                  style={{
                    height: 30,
                    width: "100%",
                    padding: "0 8px",
                    border: "0.5px solid #d1d5db",
                    borderRadius: 5,
                    fontSize: 12,
                    outline: "none",
                    textTransform: "uppercase",
                  }}
                />
                {showTipoDropdown && tipoSuggestions.length > 0 && (
                  <div
                    style={{
                      position: "absolute",
                      top: "100%",
                      left: 0,
                      right: 0,
                      background: "#fff",
                      border: "0.5px solid #d1d5db",
                      borderRadius: 5,
                      zIndex: 110,
                      marginTop: 2,
                      boxShadow: "0 4px 12px rgba(0,0,0,.1)",
                    }}
                  >
                    {tipoSuggestions.map((tipo, idx) => {
                      const isSelected =
                        !isMobile && idx === selectedSuggestionIndex;
                      return (
                        <div
                          key={tipo}
                          onMouseDown={() => selectTipo(tipo)}
                          style={{
                            padding: "7px 10px",
                            fontSize: 12,
                            cursor: "pointer",
                            borderBottom: "0.5px solid #f3f4f6",
                            background: isSelected ? "#1d4ed8" : "",
                            color: isSelected ? "#fff" : "",
                          }}
                          onMouseEnter={() => {
                            if (!isMobile) setSelectedSuggestionIndex(idx);
                          }}
                        >
                          {tipo}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr 1fr",
                  gap: 10,
                  marginBottom: 10,
                }}
              >
                {[
                  {
                    key: "cor1",
                    label: "Cor 1 *",
                    ref: cor1InputRef,
                    nextRef: cor2InputRef,
                    onChange: (v: string) => {
                      const vu = v.toUpperCase();
                      onCor1(vu);
                      searchCores(vu, "cor1");
                      setSelectedSuggestionIndex(-1);
                    },
                  },
                  {
                    key: "cor2",
                    label: "Cor 2",
                    ref: cor2InputRef,
                    nextRef: cor3InputRef,
                    onChange: (v: string) => {
                      const vu = v.toUpperCase();
                      setCor2Manual(true);
                      setForm((f) => ({ ...f, cor2: vu }));
                      searchCores(vu, "cor2");
                      setSelectedSuggestionIndex(-1);
                    },
                  },
                  {
                    key: "cor3",
                    label: "Cor 3",
                    ref: cor3InputRef,
                    nextRef: modeloInputRef,
                    onChange: (v: string) => {
                      const vu = v.toUpperCase();
                      setCor3Manual(true);
                      setForm((f) => ({ ...f, cor3: vu }));
                      searchCores(vu, "cor3");
                      setSelectedSuggestionIndex(-1);
                    },
                  },
                ].map((f) => (
                  <div key={f.key} style={{ position: "relative" }}>
                    <label
                      style={{
                        fontSize: 10,
                        fontWeight: 500,
                        color: "#6b7280",
                        textTransform: "uppercase",
                        display: "block",
                        marginBottom: 3,
                      }}
                    >
                      {f.label}
                    </label>
                    <input
                      ref={f.ref}
                      value={(form as any)[f.key]}
                      onChange={(e) => f.onChange(e.target.value.toUpperCase())}
                      onKeyDown={(e) => {
                        if (isMobile) {
                          handleEnterKey(e, f.nextRef, true);
                          return;
                        }
                        if (
                          showCorDropdown.field === f.key &&
                          corSuggestions.length > 0
                        ) {
                          if (e.key === "ArrowDown") {
                            e.preventDefault();
                            setSelectedSuggestionIndex((prev) =>
                              prev < corSuggestions.length - 1
                                ? prev + 1
                                : prev,
                            );
                            return;
                          } else if (e.key === "ArrowUp") {
                            e.preventDefault();
                            setSelectedSuggestionIndex((prev) =>
                              prev > 0 ? prev - 1 : -1,
                            );
                            return;
                          } else if (
                            e.key === "Enter" &&
                            selectedSuggestionIndex >= 0
                          ) {
                            e.preventDefault();
                            selectCor(
                              corSuggestions[selectedSuggestionIndex],
                              f.key as any,
                            );
                            setSelectedSuggestionIndex(-1);
                            f.nextRef.current?.focus();
                            return;
                          } else if (e.key === "Escape") {
                            setShowCorDropdown({ field: null });
                            setSelectedSuggestionIndex(-1);
                            return;
                          }
                        }
                        handleEnterKey(e, f.nextRef);
                      }}
                      onBlur={() =>
                        setTimeout(() => {
                          setShowCorDropdown({ field: null });
                          setSelectedSuggestionIndex(-1);
                        }, 200)
                      }
                      placeholder="—"
                      style={{
                        height: 30,
                        width: "100%",
                        padding: "0 8px",
                        border: "0.5px solid #d1d5db",
                        borderRadius: 5,
                        fontSize: 12,
                        outline: "none",
                        textTransform: "uppercase",
                      }}
                    />
                    {showCorDropdown.field === f.key &&
                      corSuggestions.length > 0 && (
                        <div
                          style={{
                            position: "absolute",
                            top: "100%",
                            left: 0,
                            right: 0,
                            background: "#fff",
                            border: "0.5px solid #d1d5db",
                            borderRadius: 5,
                            zIndex: 110,
                            marginTop: 2,
                            boxShadow: "0 4px 12px rgba(0,0,0,.1)",
                          }}
                        >
                          {corSuggestions.map((cor, idx) => {
                            const isSelected =
                              !isMobile && idx === selectedSuggestionIndex;
                            return (
                              <div
                                key={cor}
                                onMouseDown={() => selectCor(cor, f.key as any)}
                                style={{
                                  padding: "7px 10px",
                                  fontSize: 12,
                                  cursor: "pointer",
                                  borderBottom: "0.5px solid #f3f4f6",
                                  background: isSelected ? "#1d4ed8" : "",
                                  color: isSelected ? "#fff" : "",
                                }}
                                onMouseEnter={() => {
                                  if (!isMobile)
                                    setSelectedSuggestionIndex(idx);
                                }}
                              >
                                {cor}
                              </div>
                            );
                          })}
                        </div>
                      )}
                  </div>
                ))}
              </div>

              {/* Linha 4: Modelo (dropdown) */}
              <div style={{ marginBottom: 10 }}>
                <label
                  style={{
                    fontSize: 10,
                    fontWeight: 500,
                    color: "#6b7280",
                    textTransform: "uppercase",
                    display: "block",
                    marginBottom: 3,
                  }}
                >
                  Modelo *
                </label>
                <select
                  ref={modeloInputRef}
                  value={form.modelo}
                  onKeyDown={(e) => handleEnterKey(e, custoInputRef, true)}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, modelo: e.target.value }))
                  }
                  style={{
                    height: 30,
                    width: "100%",
                    padding: "0 8px",
                    border: "0.5px solid #d1d5db",
                    borderRadius: 5,
                    fontSize: 12,
                    outline: "none",
                    background: "#fff",
                  }}
                >
                  <option value="MASC">Masculino</option>
                  <option value="FEM">Feminino</option>
                  <option value="INF">Infantil</option>
                  <option value="ACES">Acessório</option>
                </select>
              </div>

              <div style={{ marginBottom: 10 }}>
                <label
                  style={{
                    fontSize: 10,
                    fontWeight: 500,
                    color: "#6b7280",
                    textTransform: "uppercase",
                    display: "block",
                    marginBottom: 3,
                  }}
                >
                  Custo (R$)
                </label>
                <input
                  ref={custoInputRef}
                  onKeyDown={(e) => handleEnterKey(e, btnSalvarRef, true)}
                  type="number"
                  step={0.01}
                  value={form.custo}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, custo: e.target.value }))
                  }
                  placeholder="0,00"
                  style={{
                    height: 30,
                    width: 140,
                    padding: "0 8px",
                    border: "0.5px solid #d1d5db",
                    borderRadius: 5,
                    fontSize: 12,
                    outline: "none",
                  }}
                />
              </div>

              <div
                style={{
                  background: "#f9fafb",
                  border: "0.5px solid #e5e7eb",
                  borderRadius: 6,
                  padding: "8px 12px",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                <span style={{ fontSize: 11, color: "#6b7280" }}>
                  Desconto {cab.desconto}% → Markup {cab.markup}x → Venda:
                </span>
                <span
                  className={`text-[15px] font-medium ${historicPrice && estVenda > historicPrice ? "text-emerald-600 animate-pulse" : historicPrice && estVenda < historicPrice ? "text-amber-500 animate-pulse" : "text-[#185FA5]"}`}
                >
                  {form.custo ? fmtBRL(estVenda) : "—"}
                </span>
                {historicPrice && form.custo && (
                  <span className="text-[10px] text-slate-400 ml-auto italic">
                    Último: {fmtBRL(historicPrice)}
                  </span>
                )}
              </div>
            </div>
            <div
              style={{
                padding: "10px 16px",
                borderTop: "0.5px solid #e5e7eb",
                display: "flex",
                justifyContent: "flex-end",
                gap: 8,
              }}
            >
              <button
                onClick={() => setShowPopup(false)}
                style={{
                  height: 28,
                  padding: "0 14px",
                  borderRadius: 5,
                  fontSize: 12,
                  cursor: "pointer",
                  border: "0.5px solid #d1d5db",
                  background: "transparent",
                }}
              >
                Cancelar
              </button>
              <button
                ref={btnSalvarRef}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveItem();
                }}
                onClick={saveItem}
                disabled={isCalculating}
                style={{
                  height: 28,
                  padding: "0 14px",
                  borderRadius: 5,
                  fontSize: 12,
                  fontWeight: 500,
                  cursor: "pointer",
                  border: "none",
                  background: isCalculating ? "#9ca3af" : "#185FA5",
                  color: "#fff",
                }}
              >
                {isCalculating
                  ? "Calculando..."
                  : editIdx >= 0
                    ? "Salvar"
                    : "Adicionar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Step 2: Pedidos ──────────────────────────────────────────────────────────