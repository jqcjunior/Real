import React, {
  useState,
  useEffect,
  useRef,
  Dispatch,
  SetStateAction,
} from "react";
import { RefreshCw, Trash2, Copy } from "lucide-react";
import { toast } from "sonner"; // assume toast is available, but wait, usually it's imported or globally available. Actually, checking if there is toast.
import { supabase } from "../../services/supabaseClient";
import { User } from "../../types";

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface GradeItem {
  letter: string;
  cat: "MASC" | "FEM" | "INF" | "ACES";
  qtds: Record<string, number>;
}

export interface ItemComGrades {
  itemIdx: number;
  grades: GradeItem[];
}

export interface OrderItem {
  ref: string;
  tipo: string;
  cor1: string;
  cor2: string;
  cor3: string;
  modelo: string;
  custo: number;
  preco_venda: number;
  historico_preco_venda?: number;
  _catalogImageUrl?: string | null;
}

export interface SubOrder {
  num: number;
  pedido_numero: string;
  itensComGrades: ItemComGrades[];
  lojas: number[];
  lojaMode: "sub" | "all" | null;
}

export interface StoreRequirement {
  categoria: string;
  tamanhos_obrigatorios: number[];
  mensagem: string;
}

export interface BrandRestriction {
  lojas_proibidas_encontradas: number[];
  mensagem_alerta: string;
  tem_restricao: boolean;
}

export interface ProductRestriction {
  lojas_proibidas_encontradas: number[];
  mensagem_alerta: string;
  tem_restricao: boolean;
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const SUBGRUPO = [
  5, 8, 9, 26, 31, 34, 40, 43, 44, 45, 50, 56, 72, 88, 96, 100, 102, 109,
];
const ALL_LOJAS = [
  ...Array.from({ length: 60 }, (_, i) => i + 1),         // 1–60
  ...Array.from({ length: 51 }, (_, i) => i + 70),         // 70–120
];
const GRADE_LETTERS = "ABCDEFGH";

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
      16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33,
      34, 35, 36,
    ].map(String),
  },
  ACES: { label: "Acess", sizes: ["UN", "P", "M", "G", "GG"] },
};

const CATS_COMPATIVEIS: Record<string, string[]> = {
  FEM: ["FEM", "INF"],
  MASC: ["MASC", "INF"],
  INF: ["INF"],
  ACES: ["ACES"],
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtBRL(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function totPares(qtds: Record<string, number>): number {
  return Object.values(qtds).reduce((s, v) => s + (v || 0), 0);
}

function sanitizeQtds(qtds: Record<string, any>): Record<string, number> {
  const result: Record<string, number> = {};
  for (const [k, v] of Object.entries(qtds || {})) {
    const parsed = typeof v === 'number' ? v : parseInt(String(v), 10);
    if (!isNaN(parsed) && parsed > 0) result[k] = parsed;
  }
  return result;
}

function corParaHex(cor: string): string {
  const mapa: Record<string, string> = {
    'PRETO': '#1a1a1a', 'BRANCO': '#f5f5f5', 'VERMELHO': '#dc2626',
    'AZUL': '#2563eb', 'VERDE': '#16a34a', 'AMARELO': '#ca8a04',
    'ROSA': '#ec4899', 'ROXO': '#7c3aed', 'LARANJA': '#ea580c',
    'MARROM': '#92400e', 'CINZA': '#6b7280', 'BEGE': '#d4a017',
    'VIOLETA': '#7c3aed', 'CHAMPANHE': '#d4a017', 'GRAFITE': '#374151',
    'BORDO': '#881337', 'CARAMELO': '#b45309', 'AREIA': '#d4a017',
  };
  return mapa[cor?.toUpperCase()] || '#94a3b8';
}

function gerarNumeroPedido(): string {
  const now = new Date();
  const ano = now.getFullYear();
  const mes = String(now.getMonth() + 1).padStart(2, "0");
  const dia = String(now.getDate()).padStart(2, "0");
  const hora = String(now.getHours()).padStart(2, "0");
  const min = String(now.getMinutes()).padStart(2, "0");
  const seg = String(now.getSeconds()).padStart(2, "0");
  return `${ano}${mes}${dia}-${hora}${min}${seg}`;
}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface Cabecalho {
  role: "comprador" | "gerente";
  brand_id: string | null;
  marca: string;
  fornecedor: string;
  representante: string;
  telefone: string;
  email: string;
  fat_inicio: string;
  fat_fim: string;
  prazos: number[];
  markup: number;
  desconto: number;
  modo_pesquisa: boolean;
  survey_params: {
    prazo_horas: number;
    sub_orders: Array<{
      num: number;
      tipo_limite: 'valor' | 'pares' | 'itens' | 'nenhum';
      limite: number;
      itens_minimos: number;
      prazo_horas: number;
      itens_obrigatorios: string[];
    }>;
  } | null;
}

interface StepPedidosProps {
  items: OrderItem[];
  pedidos: SubOrder[];
  setPedidos: Dispatch<SetStateAction<SubOrder[]>> | any; // Fix potential type issues with setPedidos
  user?: User;
  brandId?: string; // Receber brandId do cabeçalho para evitar erro RLS
  cab: Cabecalho;
  onUpdateCab: (updates: Partial<Cabecalho>) => void;
  step2State: {
    selectedItems: Set<number>;
    tempPedidoItens: ItemComGrades[];
    gradesGlobais: Record<
      string,
      { cat: string; qtds: Record<string, number> }
    >;
    gradeExpandida: string | null;
    selectedLojas: number[];
    lojaMode: "sub" | "all" | null;
  };
  setStep2State: Dispatch<SetStateAction<any>>;
  allowedStores?: Array<{ number: string; name: string; city: string }>;
  canViewAllStores?: boolean;
}

// ─── Componente Principal ─────────────────────────────────────────────────────

export default function StepPedidos({
  items,
  pedidos,
  setPedidos,
  user,
  brandId,
  cab,
  onUpdateCab,
  step2State,
  setStep2State,
  allowedStores = [],
  canViewAllStores = false,
}: StepPedidosProps) {
  console.log("BuyOrderStepPedidos - user.role:", user?.role);
  const isSurveyMode = cab?.modo_pesquisa === true;
  const isGerente = String(user?.role || "").toLowerCase() === "manager";
  const AVAILABLE_LOJAS = allowedStores.map((s) => parseInt(s.number));
  const [userStoreNumber, setUserStoreNumber] = useState<number | null>(null);

  useEffect(() => {
    async function fetchUserStoreNumber() {
      if (user && String(user.role || "").toLowerCase() === "manager" && user.storeId) {
        const { data } = await supabase
          .from("stores")
          .select("number")
          .eq("id", user.storeId)
          .single();

        if (data?.number) {
          setUserStoreNumber(parseInt(data.number));
        }
      }
    }
    fetchUserStoreNumber();
  }, [user]);

  const {
    selectedItems,
    tempPedidoItens,
    gradesGlobais,
    gradeExpandida,
    selectedLojas,
    lojaMode,
  } = step2State;

  const [isMobile, setIsMobile] = useState(false);
  const [editingPedido, setEditingPedido] = useState<number | null>(null);
  const [openDetails, setOpenDetails] = useState<Record<number, boolean>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [editingTempItem, setEditingTempItem] = useState<number | null>(null);
  const [deletingTempItem, setDeletingTempItem] = useState<number | null>(null);
  const [showCancelOrderModal, setShowCancelOrderModal] = useState(false);

  type QuotaModalState = {
    lojasFaltando: { loja: number; falta: number }[];
    valorPorLoja: number;
    onConfirm: (motivo?: string) => void;
  } | null;

  const [quotaModal, setQuotaModal] = useState<QuotaModalState>(null);
  const [lojasOpen, setLojasOpen] = useState(true);

  // 1. Sanitizar gradesGlobais ao montar ou receber dados
  useEffect(() => {
    let hasInvalid = false;
    const sanitizedGrades: Record<string, any> = {};

    for (const [letter, grade] of Object.entries(gradesGlobais || {})) {
      const sanitizedQtds = sanitizeQtds(grade.qtds);
      
      // Checa se qtds mudou (compara tamanho e valores)
      const curKeys = Object.keys(grade.qtds || {});
      const newKeys = Object.keys(sanitizedQtds);
      let isDifferent = curKeys.length !== newKeys.length;
      if (!isDifferent) {
        for (const k of curKeys) {
          if (grade.qtds[k] !== sanitizedQtds[k]) {
            isDifferent = true;
            break;
          }
        }
      }

      if (isDifferent) {
        hasInvalid = true;
      }
      sanitizedGrades[letter] = { ...grade, qtds: sanitizedQtds };
    }

    if (hasInvalid) {
      setStep2State((prev: any) => ({
        ...prev,
        gradesGlobais: sanitizedGrades
      }));
    }
  }, [gradesGlobais, setStep2State]);

  const [storeRequirements, setStoreRequirements] = useState<
    StoreRequirement[]
  >([]);
  const [brandRestriction, setBrandRestriction] =
    useState<BrandRestriction | null>(null);
  const [productRestrictions, setProductRestrictions] = useState<
    ProductRestriction[]
  >([]);

  useEffect(() => {
    async function fetchRequirements() {
      if (selectedLojas.length === 0) {
        setStoreRequirements([]);
        return;
      }

      const allRequirements: StoreRequirement[] = [];

      // Para cada loja selecionada, buscar requisitos
      for (const lojaId of selectedLojas) {
        const { data, error } = await supabase.rpc("check_store_requirements", {
          p_store_id: lojaId,
          p_categoria: "TODOS", // Por enquanto, buscar todos
        });

        if (data && data.length > 0) {
          allRequirements.push(...data);
        }
      }

      setStoreRequirements(allRequirements);
    }

    fetchRequirements();
  }, [selectedLojas]);

  useEffect(() => {
    async function fetchBrandRestrictions() {
      if (selectedLojas.length === 0) {
        setBrandRestriction(null);
        return;
      }

      // Pegar marca do cabeçalho do pedido
      const marca = cab.marca;

      if (!marca) {
        setBrandRestriction(null);
        return;
      }

      const { data, error } = await supabase.rpc("check_brand_restrictions", {
        p_marca: marca,
        p_lojas_selecionadas: selectedLojas,
      });

      if (data && data.length > 0) {
        const resultado = data[0];
        if (resultado.tem_restricao) {
          setBrandRestriction(resultado);
        } else {
          setBrandRestriction(null);
        }
      }
    }

    fetchBrandRestrictions();
  }, [selectedLojas, cab.marca]);

  // ═══════════════════════════════════════════════════════════════
  // 3. Buscar restrições de PRODUTO quando itens/lojas mudarem (NOVO!)
  // ═══════════════════════════════════════════════════════════════
  useEffect(() => {
    async function fetchProductRestrictions() {
      if (selectedLojas.length === 0 || selectedItems.size === 0) {
        setProductRestrictions([]);
        return;
      }

      const allRestrictions: ProductRestriction[] = [];

      // Para cada item selecionado, verificar se há restrição
      for (const itemIdx of Array.from(selectedItems)) {
        const item = items[itemIdx as number];
        if (!item || !item.tipo) continue;

        const { data, error } = await supabase.rpc(
          "check_product_restrictions",
          {
            p_tipo_produto: item.tipo,
            p_lojas_selecionadas: selectedLojas,
          },
        );

        if (data && data.length > 0) {
          const resultado = data[0];
          if (resultado.tem_restricao) {
            allRestrictions.push(resultado);
          }
        }
      }

      setProductRestrictions(allRestrictions);
    }

    fetchProductRestrictions();
  }, [selectedLojas, selectedItems, items]);

  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const [activeInput, setActiveInput] = useState<string | null>(null);

  useEffect(() => {
    if (activeInput && inputRefs.current[activeInput]) {
      inputRefs.current[activeInput]?.focus();
    }
  }, [gradesGlobais]); // Re-run when gradesGlobais changes in case of remount

  function handleGradeKeyDown(
    e: React.KeyboardEvent,
    currentSize: string,
    allSizes: string[],
    letterOverride?: string,
  ) {
    const activeLetter = letterOverride || gradeExpandida;
    if (!activeLetter) return;

    const currentIdx = allSizes.indexOf(currentSize);
    let nextIdx = -1;

    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      nextIdx = currentIdx + 1;
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      nextIdx = currentIdx - 1;
    } else if (e.key === "Enter") {
      nextIdx = currentIdx + 1;
    }

    if (nextIdx >= 0 && nextIdx < allSizes.length) {
      e.preventDefault();
      const nextKey = `${activeLetter}-${allSizes[nextIdx]}`;
      setTimeout(() => {
        if (inputRefs.current[nextKey]) {
          inputRefs.current[nextKey]?.focus();
          inputRefs.current[nextKey]?.select();
        }
      }, 10);
    }
  }

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  useEffect(() => {
    // Empty useEffect or remove initialization logic
    // Removing the default empty order to prevent skipping order number "1"
  }, []);

  function toggleItem(itemIdx: number) {
    setStep2State((prev: any) => {
      const next = new Set(prev.selectedItems);
      if (next.has(itemIdx)) {
        next.delete(itemIdx);
      } else {
        next.add(itemIdx);
      }
      return { ...prev, selectedItems: next };
    });
  }

  const toggleExpand = (letra: string) => {
    setStep2State((prev: any) => ({
      ...prev,
      gradeExpandida: prev.gradeExpandida === letra ? null : letra,
    }));
  };

  function adicionarGrade() {
    // Filtrar apenas chaves válidas (letras A-H), ignorar chaves numéricas ou inválidas
    const letrasUsadas = Object.keys(gradesGlobais).filter(k => /^[A-H]$/.test(k));
    const proxima = GRADE_LETTERS.split("").find(
      (l) => !letrasUsadas.includes(l),
    );
    if (!proxima) return;

    // Pegar modelo do primeiro item da lista (já cadastrado no step anterior)
    const modeloMap: Record<string, string> = {
      'MASC': 'MASC', 'FEM': 'FEM', 'INF': 'INF', 'ACES': 'ACES',
    };
    const primeiroModelo = items[0]?.modelo?.toUpperCase() || 'MASC';
    const initialCat = (modeloMap[primeiroModelo] || 'MASC') as any;

    setStep2State((prev: any) => {
      // Remover chaves inválidas (numéricas) ao adicionar nova grade
      const gradesLimpas: Record<string, any> = {};
      Object.entries(prev.gradesGlobais).forEach(([k, v]) => {
        if (/^[A-H]$/.test(k)) gradesLimpas[k] = v;
      });
      return {
        ...prev,
        gradesGlobais: {
          ...gradesLimpas,
          [proxima]: { cat: initialCat, qtds: {} },
        },
        gradeExpandida: proxima,
      };
    });
  }

  const handleLimparGrade = (letter: string) => {
    setStep2State((prev: any) => ({
      ...prev,
      gradesGlobais: {
        ...prev.gradesGlobais,
        [letter]: {
          ...prev.gradesGlobais[letter],
          qtds: {}, // Limpa todas as quantidades
        },
      },
    }));
    toast.info(`🧹 Grade ${letter} limpa! Digite novamente as quantidades.`);
  };

  const handleExcluirGrade = (letter: string) => {
    // Salvar snapshot da grade para possível desfazer
    const gradeSnapshot = gradesGlobais[letter];

    setStep2State((prev: any) => {
      const { [letter]: _, ...resto } = prev.gradesGlobais;
      return {
        ...prev,
        gradesGlobais: resto,
        gradeExpandida: prev.gradeExpandida === letter ? null : prev.gradeExpandida,
      };
    });

    toast.success(`🗑️ Grade ${letter} excluída!`, {
      action: {
        label: 'Desfazer',
        onClick: () => {
          setStep2State((prev: any) => ({
            ...prev,
            gradesGlobais: {
              ...prev.gradesGlobais,
              [letter]: gradeSnapshot,
            },
          }));
          toast.info(`↩️ Grade ${letter} restaurada!`);
        },
      },
      duration: 5000,
    });
  };

  const handleLimparTodasGrades = () => {
    const snapshot = { ...gradesGlobais };
    setStep2State((prev: any) => ({
      ...prev,
      gradesGlobais: {},
      gradeExpandida: null,
    }));
    toast.info("🧹 Todas as grades limpas!", {
      action: {
        label: 'Desfazer',
        onClick: () => {
          setStep2State((prev: any) => ({
            ...prev,
            gradesGlobais: snapshot,
          }));
          toast.info("↩️ Grades restauradas!");
        },
      },
      duration: 5000,
    });
  };

  function vincularAoPedido(gradeLetter: string) {
    if (
      selectedItems.size === 0 ||
      !gradeLetter ||
      !gradesGlobais[gradeLetter]
    ) {
      alert("Selecione pelo menos um item e preencha a grade");
      return;
    }

    const gradeTemplate = gradesGlobais[gradeLetter];
    if (totPares(gradeTemplate.qtds) === 0) {
      alert("A grade está vazia");
      return;
    }

    const novosItens: ItemComGrades[] = [];
    let itensJaVinculados: string[] = [];
    const updatedTempItens = [...tempPedidoItens];

    selectedItems.forEach((itemIdx) => {
      const item = items[itemIdx];
      if (!item) return;

      const gradeData: GradeItem = {
        letter: gradeLetter,
        cat: gradeTemplate.cat as any,
        qtds: { ...gradeTemplate.qtds },
      };

      const existingIdx = updatedTempItens.findIndex(
        (x) => x.itemIdx === itemIdx,
      );

      if (existingIdx >= 0) {
        // Item já existe no pedido temporário, verificar se já tem essa letra
        if (
          updatedTempItens[existingIdx].grades.some(
            (g) => g.letter === gradeLetter,
          )
        ) {
          itensJaVinculados.push(item.ref);
        } else {
          updatedTempItens[existingIdx].grades.push(gradeData);
        }
      } else {
        // Novo item no pedido temporário
        updatedTempItens.push({
          itemIdx,
          grades: [gradeData],
        });
      }
    });

    if (itensJaVinculados.length > 0) {
      alert(
        `A grade ${gradeLetter} já foi vinculada para: ${itensJaVinculados.join(", ")}`,
      );
    }

    setStep2State((prev: any) => ({
      ...prev,
      tempPedidoItens: updatedTempItens,
      selectedItems: new Set(),
    }));
    // MANTER gradeExpandida para que o usuário veja o que acabou de vincular e possa reutilizar
  }

  async function criarPedido() {
    if (isSubmitting) return;
    setIsSubmitting(true);

    if (tempPedidoItens.length === 0) {
      alert("Vincule ao menos um item com grade antes de criar o pedido");
      setIsSubmitting(false);
      return;
    }

    if (selectedLojas.length === 0 && canViewAllStores) {
      alert("Selecione ao menos uma loja");
      setIsSubmitting(false);
      return;
    }

    const lojasParaPedido = !canViewAllStores ? AVAILABLE_LOJAS : selectedLojas;

    const lojaJaUsada = lojasParaPedido.filter((loja) =>
      pedidos.some((p) => p.lojas.includes(loja))
    );

    if (lojaJaUsada.length > 0) {
      toast.warning(
        lojaJaUsada.length === 1
          ? `Loja ${lojaJaUsada[0]} já está em outro pedido desta sessão.`
          : `Lojas ${lojaJaUsada.join(", ")} já estão em outros pedidos desta sessão.`
      );
    }

    // Calcular valor por loja já com desconto
    const valorPorLoja = tempPedidoItens.reduce((total, icg) => {
      const item = items[icg.itemIdx];
      if (!item) return total;
      return total + icg.grades.reduce((s, g) => s + totPares(g.qtds) * item.custo, 0);
    }, 0) * (1 - (cab.desconto || 0) / 100);

    const parcelaPorMes = cab.prazos.length > 0 ? valorPorLoja / cab.prazos.length : valorPorLoja;

    const diaFat = parseInt((cab.fat_inicio || '').split('-')[2] || '1', 10);
    const mesFat = parseInt((cab.fat_inicio || '').split('-')[1] || '1', 10);
    const anoFat = parseInt((cab.fat_inicio || '').split('-')[0] || '2026', 10);
    const tipoComprador = cab.role === 'gerente' ? 'GERENTE' : 'COMPRADOR';

    // Verificar cota de todas as lojas em paralelo
    const resultados = await Promise.all(
      lojasParaPedido.map(async (loja) => {
        const { data } = await supabase.rpc('get_otb_disponivel_mes_v2', {
          p_store_number: String(loja),
          p_year: anoFat,
          p_month: mesFat,
          p_tipo_comprador: tipoComprador,
          p_prazo_dias: cab.prazos,
          p_day: diaFat,
        });
        const resultado = data?.[0];
        const cotaMinima = resultado?.cota_minima_disponivel ?? 0;
        return { loja, cotaMinima, falta: Math.max(0, parcelaPorMes - cotaMinima) };
      })
    );

    const lojasFaltando = resultados.filter((r) => r.falta > 0);

    const executarCriacao = async (motivo?: string) => {
      const numeroPedido = gerarNumeroPedido();

      // Se gerente/comprador e tem lojas sem cota, registrar solicitação
      const isUserAdmin = String(user?.role || "").toLowerCase() === "admin";
      if (lojasFaltando.length > 0 && !isUserAdmin && motivo) {
        await Promise.all(
          lojasFaltando.map((r) =>
            supabase.rpc('request_quota_extra', {
              p_store_number: String(r.loja),
              p_month: mesFat,
              p_year: anoFat,
              p_tipo_comprador: tipoComprador,
              p_valor_extra: r.falta,
              p_motivo: motivo,
              p_order_id: null,
              p_user_id: user?.id || '',
            })
          )
        );
      }

      setPedidos((ps: any[]) => [
        ...ps,
        {
          num: ps.length + 1,
          pedido_numero: numeroPedido,
          itensComGrades: tempPedidoItens,
          lojas: lojasParaPedido,
          lojaMode: !canViewAllStores ? "all" : lojaMode,
        },
      ]);

      // Limpar pedido temporário e lojas para novo pedido
      setStep2State((prev: any) => ({
        ...prev,
        tempPedidoItens: [],
        selectedItems: new Set(),
        selectedLojas: [],
        lojaMode: null,
      }));
      setIsSubmitting(false);
      setQuotaModal(null);
    };

    if (lojasFaltando.length === 0) {
      // Todas as lojas têm cota — criar direto sem perguntar nada
      await executarCriacao();
    } else if (String(user?.role || "").toLowerCase() === 'admin') {
      // Admin: window.confirm e cria mesmo assim
      const totalFalta = lojasFaltando.reduce((s, r) => s + r.falta, 0);
      const ok = window.confirm(
        `Atenção: A cota foi excedida em ${fmtBRL(totalFalta)} em ${lojasFaltando.length} loja(s).\n\nComo ADMINISTRADOR, deseja autorizar mesmo assim?`
      );
      if (ok) {
        await executarCriacao();
      } else {
        setIsSubmitting(false); // cancelou
      }
    } else {
      // Gerente/Comprador: modal de justificativa
      setIsSubmitting(false); // abre modal, reset aqui
      setQuotaModal({ lojasFaltando, valorPorLoja, onConfirm: executarCriacao });
    }
  }

  async function criarPedidoSurvey() {
    if (selectedLojas.length === 0) {
      alert('Selecione ao menos uma loja para este sub-pedido.');
      return;
    }
    if (pedidos.length >= 5) {
      alert('Limite máximo de 5 sub-pedidos atingido.');
      return;
    }
    const lojaJaUsada = selectedLojas.filter((l) =>
      pedidos.some((p) => p.lojas.includes(l))
    );
    if (lojaJaUsada.length > 0) {
      const ok = window.confirm(
        `As lojas ${lojaJaUsada.join(', ')} já estão em outro sub-pedido. Deseja continuar?`
      );
      if (!ok) return;
    }
    const allItems: ItemComGrades[] = items.map((_, idx) => ({
      itemIdx: idx,
      grades: [],
    }));
    const numeroPedido = gerarNumeroPedido();
    setPedidos((ps: SubOrder[]) => [
      ...ps,
      {
        num: ps.length + 1,
        pedido_numero: numeroPedido,
        itensComGrades: allItems,
        lojas: [...selectedLojas].sort((a, b) => a - b),
        lojaMode: lojaMode,
      },
    ]);
    setStep2State((prev: any) => ({
      ...prev,
      selectedLojas: [],
      lojaMode: null,
    }));
  }

  function delPedido(idx: number) {
    setPedidos((ps) =>
      ps.filter((_, i) => i !== idx).map((p, i) => ({ ...p, num: i + 1 })),
    );
  }

  function setGradeQtd(size: string, qtd: number) {
    if (!gradeExpandida || !gradesGlobais[gradeExpandida]) return;

    setStep2State((prev: any) => {
      const current = prev.gradesGlobais[gradeExpandida];
      return {
        ...prev,
        gradesGlobais: {
          ...prev.gradesGlobais,
          [gradeExpandida]: {
            ...current,
            qtds: {
              ...current.qtds,
              [size]: Math.max(0, qtd),
            },
          },
        },
      };
    });
  }

  function toggleLoja(n: number) {
    setStep2State((prev: any) => ({
      ...prev,
      selectedLojas: prev.selectedLojas.includes(n)
        ? prev.selectedLojas.filter((x: number) => x !== n)
        : [...prev.selectedLojas, n],
    }));
  }

  function selectLojaMode(mode: "sub" | "all") {
    if (lojaMode === mode) {
      // Se já está ativo, desativa
      setStep2State((prev: any) => ({
        ...prev,
        lojaMode: null,
        selectedLojas: [],
      }));
    } else {
      // Ativa o modo MAS NÃO pré-seleciona as lojas
      setStep2State((prev: any) => ({ ...prev, lojaMode: mode }));
      // REMOVIDO: setSelectedLojas(...) - usuário escolhe manualmente
    }
  }

  const pool =
    lojaMode === "sub" ? SUBGRUPO : lojaMode === "all" ? AVAILABLE_LOJAS : [];

  // CÁLCULO CORRETO: Total considerando todas as lojas, usando CUSTO e aplicando DESCONTO
  function calcPedidoTotals(
    ped: SubOrder | { itensComGrades: ItemComGrades[] },
    lojas?: number[],
  ) {
    let totalParesPorLoja = 0;
    let totalValorBrutoPorLoja = 0;

    ped.itensComGrades.forEach((icg) => {
      const item = items[icg.itemIdx];
      if (!item) return;
      icg.grades.forEach((g) => {
        const pares = totPares(g.qtds);
        totalParesPorLoja += pares;
        totalValorBrutoPorLoja += pares * item.custo;
      });
    });

    const numLojas = lojas
      ? lojas.length
      : "lojas" in ped
        ? ped.lojas.length
        : 1;
    const totalValorLiquidoPorLoja =
      totalValorBrutoPorLoja * (1 - (cab.desconto || 0) / 100);

    return {
      totalParesPorLoja,
      totalValorBrutoPorLoja,
      totalValorLiquidoPorLoja,
      totalParesGeral: totalParesPorLoja * numLojas,
      totalValorBrutoGeral: totalValorBrutoPorLoja * numLojas,
      totalValorLiquidoGeral: totalValorLiquidoPorLoja * numLojas,
      numLojas,
    };
  }

  const catsPermitidas = (() => {
    if (selectedItems.size === 0) return Object.keys(CATS);
    const modelos = Array.from(selectedItems).map((idx) => items[idx]?.modelo).filter(Boolean) as string[];
    const unico = new Set(modelos);
    if (unico.size === 1) {
      return CATS_COMPATIVEIS[Array.from(unico)[0]] || Object.keys(CATS);
    }
    const sets = Array.from(unico).map(
      (m) => new Set(CATS_COMPATIVEIS[m] || []),
    );
    const intersecao = sets.reduce(
      (acc, set) => new Set([...acc].filter((x) => set.has(x))),
    );
    return Array.from(intersecao);
  })();

  const totaisPedidoTemp = calcPedidoTotals(
    { itensComGrades: tempPedidoItens },
    !canViewAllStores ? AVAILABLE_LOJAS : selectedLojas,
  );

  const handleRemoveTempItem = (idx: number) => {
    setStep2State((prev: any) => ({
      ...prev,
      tempPedidoItens: prev.tempPedidoItens.filter(
        (_: any, i: number) => i !== idx,
      ),
    }));
    setDeletingTempItem(null);
  };

  const handleReplicarGrades = (sourceIndex: number) => {
    const sourceItems = pedidos[sourceIndex]?.itensComGrades;
    
    if (!sourceItems || sourceItems.length === 0) {
      toast.warning('O pedido selecionado não tem grades configuradas.');
      return;
    }

    if (tempPedidoItens.length > 0) {
      const confirmar = window.confirm(
        'Este rascunho de pedido já tem grades configuradas. Deseja substituir pelas grades do Pedido ' + (sourceIndex + 1) + '?'
      );
      if (!confirmar) return;
    }

    // Clonar os itens do pedido fonte (deep clone)
    const clonedItems: ItemComGrades[] = sourceItems.map(item => ({
      itemIdx: item.itemIdx,
      grades: item.grades.map(g => ({
        letter: g.letter,
        cat: g.cat,
        qtds: { ...g.qtds }
      }))
    }));

    setStep2State((prev: any) => ({
      ...prev,
      tempPedidoItens: clonedItems
    }));

    toast.success(
      `Replicado completo: ${clonedItems.length} referência(s) copiadas do Pedido ${sourceIndex + 1}`
    );
  };

  const handleCancelOrder = () => {
    setStep2State((prev: any) => ({
      ...prev,
      tempPedidoItens: [],
      selectedItems: new Set(),
    }));
    setShowCancelOrderModal(false);
  };

  const gradesComPares = Object.keys(gradesGlobais)
    .sort()
    .filter((l) => totPares(gradesGlobais[l].qtds) > 0 || l === gradeExpandida);
  const gradesVazias = Object.keys(gradesGlobais)
    .sort()
    .filter((l) => totPares(gradesGlobais[l].qtds) === 0 && l !== gradeExpandida);

  return (
    <div className="p-4 bg-slate-100 min-h-screen">
      <div className="max-w-[1450px] mx-auto bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
        {/* HEADER COMPACTO */}
        <div className="bg-gradient-to-r from-blue-700 to-blue-800 text-white p-3 px-4 flex justify-between items-center shrink-0 shadow-md relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center border border-white/20">
              <span className="text-lg">📦</span>
            </div>
            <div>
              <h3 className="text-sm font-black uppercase tracking-widest leading-none">
                Montagem de Pedidos
              </h3>
              <p className="text-[10px] opacity-60 font-bold mt-1 uppercase tracking-tighter">
                Real Calçados · Painel Operacional
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            {tempPedidoItens.length > 0 && (
              <>
                <button
                  onClick={() => setShowCancelOrderModal(true)}
                  className="px-3 py-1.5 bg-red-600/20 hover:bg-red-600/40 border border-red-500/30 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-2"
                >
                  <Trash2 size={12} />
                  Limpar Rascunho
                </button>
                <button
                  onClick={criarPedido}
                  disabled={isSubmitting}
                  className="px-3 py-1.5 bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-2 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="w-4 h-4 bg-green-400 rounded-full flex items-center justify-center shrink-0 shadow-md shadow-green-900/30">
                    <span className="text-white text-[9px] font-black leading-none">✓</span>
                  </span>
                  {isSubmitting ? 'Salvando...' : 'Concluir Pedido'}
                  <span className="bg-white/15 border border-white/20 px-1.5 py-0.5 rounded-full text-[9px] font-bold">
                    {canViewAllStores ? selectedLojas.length : AVAILABLE_LOJAS.length}L
                  </span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* ESTRUTURA 3 COLUNAS */}
        <div className="grid grid-cols-1 md:grid-cols-[1.8fr_1fr_1.2fr] min-h-[460px]">
          {/* COLUNA 1: ITENS (2 colunas internas) */}
          <div className="border-r border-slate-100 flex flex-col bg-slate-50/10 h-full">
            <div className="p-3 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
              <div className="flex items-center gap-2">
                <span className="bg-blue-600 text-white w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black shadow-sm">1</span>
                <h4 className="text-[10px] font-black text-slate-700 uppercase tracking-widest">Produtos Disponíveis</h4>
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => setStep2State(p => ({ ...p, selectedItems: new Set(items.map((_, i) => i)) }))}
                  className="px-2 py-1 bg-blue-100 text-blue-700 hover:bg-blue-200 rounded text-[9px] font-black transition-colors border border-blue-200/50"
                >
                  ✓ TODOS
                </button>
                <button
                  onClick={() => setStep2State(p => ({ ...p, selectedItems: new Set() }))}
                  className="px-2 py-1 bg-slate-100 text-slate-500 hover:bg-slate-200 rounded text-[9px] font-black transition-colors"
                >
                  ✕ LIMPAR
                </button>
              </div>
            </div>

            <div className="p-2 overflow-y-auto flex-1 bg-slate-50/20 custom-scrollbar">
              <div className="grid grid-cols-2 gap-2">
                {items.map((item, idx) => {
                  const isSelected = selectedItems.has(idx);
                  const jaVinculado = tempPedidoItens.some(icg => icg.itemIdx === idx);

                  return (
                    <div
                      key={idx}
                      onClick={() => toggleItem(idx)}
                      className={`p-2 rounded-xl border-2 cursor-pointer transition-all duration-300 relative group overflow-hidden ${
                        jaVinculado ? 'bg-green-50/80 border-green-200 shadow-sm' :
                        isSelected ? 'bg-blue-50 border-blue-500 ring-4 ring-blue-500/10' :
                        'bg-white border-slate-200 hover:border-slate-300 shadow-sm'
                      }`}
                    >
                      {/* Badge Background Ref */}
                      <div className="absolute -right-2 -bottom-2 text-[30px] font-black text-slate-900/5 select-none uppercase -rotate-12 group-hover:rotate-0 transition-transform">
                        {item.ref.slice(-3)}
                      </div>

                      <div className="flex items-center gap-1.5 relative z-10">
                        <span className="text-[8px] font-black text-slate-400 bg-slate-100 rounded px-1 shrink-0 group-hover:bg-slate-200 transition-colors">
                          #{idx + 1}
                        </span>
                        <span className="text-[10px] font-black text-slate-800 truncate flex-1 uppercase tracking-tight">{item.ref}</span>
                        {jaVinculado && (
                          <div className="w-4 h-4 bg-green-600 text-white rounded-full flex items-center justify-center text-[10px] font-black shadow-md border border-white">✓</div>
                        )}
                      </div>
                      
                      <div className="text-[9px] text-slate-500 font-bold truncate mt-1 relative z-10 opacity-70">
                        {item.tipo || '—'} · {item.modelo}
                      </div>

                      <div className="mt-2 relative z-10">
                        <div className="flex items-center gap-1 mb-1.5">
                          <span className="text-[8px] text-slate-400 leading-none">C</span>
                          <span className="text-[9px] font-bold text-slate-500 leading-none">{fmtBRL(item.custo)}</span>
                          <span className="mx-0.5 text-slate-200 text-[8px]">·</span>
                          <span className="text-[8px] text-slate-400 leading-none">V</span>
                          <span className="text-[9px] font-black text-green-700 leading-none">{fmtBRL(item.preco_venda)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {[item.cor1, item.cor2, item.cor3].filter(Boolean).map((cor, i) => (
                            <span key={i} className="text-[8px] font-bold text-slate-600 leading-none truncate max-w-[44px]">
                              {cor}{i < [item.cor1, item.cor2, item.cor3].filter(Boolean).length - 1 ? ' ·' : ''}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* COLUNA 2: GRADES (Sem scroll horizontal) */}
          <div className="border-r border-slate-100 flex flex-col bg-white overflow-hidden">
            {!isSurveyMode ? (
              <>
                <div className="p-3 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
              <div className="flex items-center gap-2">
                <span className="bg-blue-600 text-white w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black shadow-sm">2</span>
                <h4 className="text-[10px] font-black text-slate-700 uppercase tracking-widest">Montagem</h4>
              </div>
              <div className="flex gap-1">
                {Object.keys(gradesGlobais).length > 0 && (
                  <button
                    onClick={handleLimparTodasGrades}
                    className="p-1 text-slate-400 hover:text-red-500 rounded transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
                {Object.keys(gradesGlobais).length < 8 && (
                  <button
                    onClick={adicionarGrade}
                    className="px-2 py-1 bg-green-600 text-white rounded-lg text-[9px] font-black hover:bg-green-700 transition-all shadow-md shadow-green-600/10 active:scale-95"
                  >
                    + GRADE
                  </button>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-2 custom-scrollbar bg-slate-50/40">
              {Object.keys(gradesGlobais).length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center opacity-30 text-center px-4">
                  <div className="text-5xl mb-4">🧵</div>
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-relaxed">
                    Nenhuma grade criada.<br/>Use o botão + GRADE para começar.
                  </p>
                </div>
              ) : (
                <>
                  {/* Grades com Pares (Ativas) */}
                  {gradesComPares.map((letter) => {
                    const isExpanded = gradeExpandida === letter;
                    const gradeData = gradesGlobais[letter];
                    const paresCount = totPares(gradeData.qtds);
                    const currentCat = gradeData.cat;
                    const sizes = CATS[currentCat]?.sizes || [];

                    return (
                      <div key={letter} className="border border-slate-200 rounded-xl bg-white shadow-sm overflow-hidden transition-all duration-300">
                        {/* Header — expande/recolhe ao clicar */}
                        <div
                          className={`p-2 flex items-center gap-3 cursor-pointer transition-colors ${isExpanded ? 'bg-blue-50/50' : 'hover:bg-slate-50'}`}
                          onClick={() => toggleExpand(letter)}
                        >
                          <div className={`w-6 h-6 rounded-lg text-[11px] font-black flex items-center justify-center transition-all ${
                            isExpanded ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'bg-slate-100 text-slate-500'
                          }`}>
                            {letter}
                          </div>

                          <div className="flex-1 overflow-hidden">
                            <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Resumo da Grade</div>
                            <div className="text-[8px] font-bold text-slate-600 truncate">
                              {Object.entries(gradeData.qtds)
                                .filter(([_, v]) => (v || 0) > 0)
                                .map(([sz, v]) => `${sz}·${v}`).join('  ')}
                            </div>
                          </div>

                          <div className="flex flex-col items-end shrink-0">
                            <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-lg border ${
                              paresCount > 0 ? 'bg-green-100 text-green-700 border-green-200' : 'bg-slate-100 text-slate-400 border-slate-200'
                            }`}>
                              {paresCount}p
                            </span>
                            {selectedLojas.length > 0 && !isExpanded && (
                              <span className="text-[8px] font-black text-slate-400 mt-1 uppercase">
                                {selectedLojas.length} {selectedLojas.length === 1 ? 'Loja' : 'Lojas'}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Quando RECOLHIDA: clique no resumo vincula + mostra lojas selecionadas */}
                        {!isExpanded && (
                          <div
                            className={`mx-2 mb-2 rounded-lg py-1.5 px-2 flex items-center justify-between cursor-pointer transition-all ${
                              paresCount > 0 && selectedItems.size > 0
                                ? 'bg-blue-600 hover:bg-blue-700 text-white'
                                : 'bg-slate-100 text-slate-300 cursor-not-allowed'
                            }`}
                            onClick={() => {
                              if (paresCount > 0 && selectedItems.size > 0) vincularAoPedido(letter);
                            }}
                          >
                            <span className="text-[9px] font-black uppercase tracking-wider truncate">
                              ✓ Vincular {letter}
                            </span>
                            <span className={`text-[8px] font-black shrink-0 ml-2 px-1.5 py-0.5 rounded ${
                              paresCount > 0 && selectedItems.size > 0
                                ? 'bg-white/20'
                                : 'bg-slate-200 text-slate-400'
                            }`}>
                              {selectedItems.size > 0
                                ? `${selectedItems.size} iten${selectedItems.size > 1 ? 's' : ''}`
                                : 'sel. itens'}
                            </span>
                          </div>
                        )}

                        {isExpanded && (
                          <div className="p-3 pt-1 border-t border-slate-100 bg-white">
                            {/* Toolbar de Grade */}
                            <div className="flex items-center gap-1.5 mb-3 flex-wrap">
                              {catsPermitidas.map((k) => (
                                <button
                                  key={k}
                                  onClick={() => setStep2State(p => ({
                                    ...p,
                                    gradesGlobais: {
                                      ...p.gradesGlobais,
                                      [letter]: { ...p.gradesGlobais[letter], cat: k, qtds: {} }
                                    }
                                  }))}
                                  className={`px-2 py-1 text-[8px] font-black rounded-md border transition-all ${
                                    currentCat === k ? 'bg-blue-600 text-white border-blue-600 shadow-md' : 'bg-white border-slate-200 text-slate-400 hover:border-slate-300'
                                  }`}
                                >
                                  {CATS[k].label}
                                </button>
                              ))}
                              <div className="flex gap-1 ml-auto">
                                <button onClick={() => handleLimparGrade(letter)} className="p-1.5 bg-amber-50 text-amber-600 rounded-md border border-amber-100 hover:bg-amber-100 transition-colors">
                                  <RefreshCw size={12} />
                                </button>
                                <button onClick={() => handleExcluirGrade(letter)} className="p-1.5 bg-red-50 text-red-600 rounded-md border border-red-100 hover:bg-red-100 transition-colors">
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            </div>

                            {/* Grid Visual de Inputs */}
                            <div className="grid grid-cols-6 gap-1.5 mb-4">
                              {sizes.map((sz) => {
                                const qtd = gradeData.qtds[sz] || 0;
                                return (
                                  <div key={sz} className="flex flex-col items-center">
                                    <span className="text-[9px] font-black text-slate-700 mb-1">{sz}</span>
                                    <input
                                      ref={(el) => { inputRefs.current[`${letter}-${sz}`] = el; }}
                                      type="number"
                                      min={0}
                                      value={typeof qtd === 'number' ? (qtd || "") : ""}
                                      onChange={(e) => setGradeQtd(sz, parseInt(e.target.value) || 0)}
                                      onKeyDown={(e) => handleGradeKeyDown(e, sz, sizes, letter)}
                                      onFocus={() => setActiveInput(`${letter}-${sz}`)}
                                      onBlur={(e) => {
                                        // only clear if it's losing focus without moving to another
                                        if (!e.relatedTarget) setActiveInput(null);
                                      }}
                                      className={`w-full h-8 text-center text-xs border rounded-lg transition-all outline-none font-black ${
                                        qtd > 0 ? 'bg-blue-600 text-white border-blue-600 shadow-inner' : 'bg-slate-50 border-slate-200 focus:border-blue-400 focus:bg-white'
                                      }`}
                                    />
                                  </div>
                                );
                              })}
                            </div>

                            <button
                              onClick={() => vincularAoPedido(letter)}
                              disabled={paresCount === 0 || selectedItems.size === 0}
                              className={`w-full py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all shadow-md flex items-center justify-center gap-2 whitespace-nowrap min-w-0 ${
                                paresCount > 0 && selectedItems.size > 0
                                  ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-blue-600/10'
                                  : 'bg-slate-100 text-slate-300 cursor-not-allowed border border-slate-200'
                              }`}
                            >
                              <span className="whitespace-nowrap">✓ Vincular Grade {letter}</span>
                              {selectedItems.size > 0 && <span className="bg-white/20 px-1.5 rounded shrink-0">{selectedItems.size}it</span>}
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* Grades Vazias (Layout Grade Compacta) */}
                  {gradesVazias.length > 0 && (
  <div className="grid grid-cols-1 md:grid-cols-1 gap-2">
    {gradesVazias.map((letter) => {
      const isExpanded = gradeExpandida === letter;
      const gradeData = gradesGlobais[letter];
      const currentCat = gradeData.cat;
      const sizes = CATS[currentCat]?.sizes || [];
      const totalPares = totPares(gradeData.qtds);

      return (
        <div key={letter} className="flex flex-col gap-2 w-full">
          <div
            onClick={() => toggleExpand(letter)}
            className={`p-2 border rounded-xl flex items-center gap-2 cursor-pointer transition-all ${
              isExpanded ? 'bg-blue-50 border-blue-400 shadow-sm ring-2 ring-blue-500/5' : 'bg-white border-slate-100 hover:border-slate-200'
            } md:p-3`}
          >
            <div className={`w-5 h-5 rounded-lg text-[10px] font-black flex items-center justify-center transition-all ${
              isExpanded ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20' : 'bg-slate-100 text-slate-500'
            }`}>
              {letter}
            </div>
            <span className={`text-[9px] font-black uppercase tracking-widest ${isExpanded ? 'text-blue-700' : 'text-slate-400'}`}>Vazia</span>
          </div>

          {isExpanded && (
            <div className="bg-white border border-blue-100 rounded-xl p-3 shadow-lg shadow-blue-900/5 ring-1 ring-black/5 animate-in slide-in-from-top-2 w-full mt-2 overflow-hidden">
              {/* Seletor de categoria */}
              <div className="flex items-center gap-1.5 mb-3 flex-wrap">
                {catsPermitidas.map((k) => (
                  <button
                    key={k}
                    onClick={() => setStep2State((p: any) => ({
                      ...p,
                      gradesGlobais: {
                        ...p.gradesGlobais,
                        [letter]: { ...p.gradesGlobais[letter], cat: k, qtds: {} }
                      }
                    }))}
                    className={`px-2 py-1 text-[8px] font-black rounded-md border transition-all ${
                      currentCat === k ? 'bg-blue-600 text-white border-blue-600 shadow-md' : 'bg-white border-slate-200 text-slate-400 hover:border-slate-300'
                    }`}
                  >
                    {CATS[k].label}
                  </button>
                ))}
                <div className="flex gap-1 ml-auto">
                  <button onClick={() => handleLimparGrade(letter)} className="p-1.5 bg-amber-50 text-amber-600 rounded-md border border-amber-100 hover:bg-amber-100 transition-colors">
                    <RefreshCw size={12} />
                  </button>
                  <button onClick={() => handleExcluirGrade(letter)} className="p-1.5 bg-red-50 text-red-600 rounded-md border border-red-100 hover:bg-red-100 transition-colors">
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>

              {/* Grid de inputs */}
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-1.5 mb-4">
                {sizes.map((sz) => {
                  const qtd = gradeData.qtds[sz] || 0;
                  return (
                    <div key={sz} className="flex flex-col items-center">
                      <span className="text-[9px] font-black text-slate-700 mb-1">{sz}</span>
                      <input
                        ref={(el) => { inputRefs.current[`${letter}-${sz}`] = el; }}
                        type="number"
                        min={0}
                        value={typeof qtd === 'number' ? (qtd || "") : ""}
                        onChange={(e) => setGradeQtd(sz, parseInt(e.target.value) || 0)}
                        onKeyDown={(e) => handleGradeKeyDown(e, sz, sizes, letter)}
                        onFocus={() => setActiveInput(`${letter}-${sz}`)}
                        onBlur={(e) => {
                          if (!e.relatedTarget) setActiveInput(null);
                        }}
                        className={`w-full h-8 text-center text-xs border rounded-lg transition-all outline-none font-black ${
                          qtd > 0 ? 'bg-blue-600 text-white border-blue-600 shadow-inner' : 'bg-slate-50 border-slate-200 focus:border-blue-400 focus:bg-white'
                        }`}
                      />
                    </div>
                  );
                })}
              </div>

              <button
                onClick={() => vincularAoPedido(letter)}
                disabled={totalPares === 0 || selectedItems.size === 0}
                className={`w-full py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all shadow-md flex items-center justify-center gap-2 whitespace-nowrap min-w-0 ${
                  totalPares > 0 && selectedItems.size > 0
                    ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-blue-600/10'
                    : 'bg-slate-100 text-slate-300 cursor-not-allowed border border-slate-200'
                }`}
              >
                <span className="whitespace-nowrap">✓ Vincular Grade {letter}</span>
                {selectedItems.size > 0 && <span className="bg-white/20 px-1.5 rounded shrink-0">{selectedItems.size}it</span>}
              </button>
            </div>
          )}
        </div>
      );
    })}
  </div>
)}
                </>
              )}
            </div>
            </>
            ) : (
              <div className="flex flex-col h-full">
                {pedidos.length === 0 && (
                  <div className="m-3 p-3 bg-purple-50 border border-purple-200 rounded-xl">
                    <p className="text-[11px] font-black text-purple-800 mb-1">
                      🔬 Modo Pesquisa Ativo
                    </p>
                    <p className="text-[10px] text-purple-600 leading-relaxed">
                      <strong>1.</strong> Selecione as lojas na coluna à direita (SUBGRUPO ou TODAS)<br/>
                      <strong>2.</strong> Clique em <strong>ADICIONAR SUB-PEDIDO</strong><br/>
                      <strong>3.</strong> Repita para cada grupo de lojas (máx. 5)<br/>
                      <strong>4.</strong> Configure os parâmetros abaixo<br/>
                      <strong>5.</strong> Salve o pedido — gerentes receberão o link para votar
                    </p>
                  </div>
                )}
                <SurveyParamsConfig
                  subOrders={pedidos}
                  surveyParams={cab.survey_params}
                  onUpdate={(params) => onUpdateCab({ survey_params: params })}
                  items={items}
                />
              </div>
            )}
            
            {/* Rascunho Rápido was moved to Col3 */}
          </div>

          {/* COLUNA 3: LOJAS + PEDIDOS CRIADOS */}
          <div className="flex flex-col bg-slate-50/30 h-full relative">
            
            {/* CONTROLE DE LOJAS */}
            <div className="flex flex-col border-b border-slate-200 bg-white z-20">
              <div
                className={`flex items-center gap-3 px-4 py-3.5 cursor-pointer transition-all ${
                  lojasOpen ? 'bg-blue-600 text-white shadow-xl rotate-0' : 'bg-white hover:bg-slate-50 text-slate-600'
                }`}
                onClick={() => setLojasOpen(prev => !prev)}
              >
                <div className={`w-6 h-6 rounded-full text-[11px] font-black flex items-center justify-center transition-all ${
                  lojasOpen ? 'bg-white text-blue-600 shadow-md transform rotate-90' : 'bg-slate-100 text-slate-400'
                }`}>
                  3
                </div>
                <h4 className="text-[11px] font-black uppercase tracking-[0.2em] flex-1">Distribuição</h4>
                {selectedLojas.length > 0 && (
                  <div className="px-2 py-0.5 bg-white/10 border border-white/20 rounded-full text-[9px] font-black animate-in zoom-in duration-300">
                    {selectedLojas.length} LOJAS
                  </div>
                )}
                <span className={`text-[10px] transition-transform duration-500 ${lojasOpen ? '-rotate-90' : ''}`}>▶</span>
              </div>

              {lojasOpen && canViewAllStores && (
                <div className="p-4 animate-in slide-in-from-top-4 duration-500 ease-out border-t border-slate-100">
                  <div className="flex gap-2 mb-4">
                    <button
                      onClick={() => selectLojaMode('sub')}
                      className={`flex-1 py-1.5 rounded-xl border-2 text-[10px] font-black tracking-widest transition-all ${
                        lojaMode === 'sub' ? 'bg-blue-600 text-white border-blue-600 shadow-lg scale-105' : 'bg-white border-slate-100 text-slate-400 hover:border-slate-200'
                      }`}
                    >
                      SUBGRUPO
                    </button>
                    <button
                      onClick={() => selectLojaMode('all')}
                      className={`flex-1 py-1.5 rounded-xl border-2 text-[10px] font-black tracking-widest transition-all ${
                        lojaMode === 'all' ? 'bg-blue-600 text-white border-blue-600 shadow-lg scale-105' : 'bg-white border-slate-100 text-slate-400 hover:border-slate-200'
                      }`}
                    >
                      TODAS
                    </button>
                  </div>

{/* Botão Selecionar Todas (só aparece no modo "all") */}
                  {lojaMode === 'all' && (
                    <div className="flex gap-2 mb-2">
                      <button
                        onClick={() => {
                          const todasSelecionadas = ALL_LOJAS.every(n => selectedLojas.includes(n));
                          setStep2State((prev: any) => ({
                            ...prev,
                            selectedLojas: todasSelecionadas ? [] : [...ALL_LOJAS],
                          }));
                        }}
                        className="w-full py-1.5 rounded-xl border-2 text-[10px] font-black tracking-widest transition-all bg-slate-800 text-white border-slate-800 hover:bg-slate-700"
                      >
                        {ALL_LOJAS.every(n => selectedLojas.includes(n)) ? '✕ DESMARCAR TODAS' : '✓ SELECIONAR TODAS'}
                      </button>
                    </div>
                  )}

                  <div className="grid grid-cols-5 gap-1.5 mb-4 bg-slate-50/50 p-2.5 rounded-2xl border border-slate-200/50 max-h-52 overflow-y-auto custom-scrollbar">
                    {pool.map((n) => {
                      const isSelected = selectedLojas.includes(n);
                      return (
                        <button
                          key={n}
                          onClick={() => toggleLoja(n)}
                          className={`h-8 flex items-center justify-center text-[10px] font-black rounded-xl border-2 transition-all ${
                            isSelected
                              ? 'bg-blue-600 text-white border-blue-600 shadow-md ring-4 ring-blue-600/10'
                              : 'bg-white border-slate-200 text-slate-400 hover:bg-white hover:shadow-sm'
                          }`}
                        >
                          {n}
                        </button>
                      );
                    })}
                  </div>

                  {isSurveyMode ? (
                    selectedLojas.length > 0 && pedidos.length < 5 && (
                      <button
                        onClick={criarPedidoSurvey}
                        className="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-2xl text-[11px] font-black tracking-[0.1em] shadow-xl shadow-purple-600/20 active:scale-95 transition-all flex items-center justify-center gap-3"
                      >
                        <span>🔬 ADICIONAR SUB-PEDIDO {pedidos.length + 1}</span>
                        <div className="h-4 w-px bg-white/20" />
                        <span className="bg-white/20 px-3 rounded-full py-0.5">{selectedLojas.length} LOJAS</span>
                      </button>
                    )
                  ) : (
                    tempPedidoItens.length > 0 && selectedLojas.length > 0 && (
                      <button
                        onClick={criarPedido}
                        disabled={isSubmitting}
                        className="w-full py-3 bg-green-600 hover:bg-green-700 text-white rounded-2xl text-[11px] font-black tracking-[0.1em] shadow-xl shadow-green-600/20 active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <span>{isSubmitting ? 'Salvando...' : '✓ FINALIZAR PEDIDO'}</span>
                        <div className="h-4 w-px bg-white/20" />
                        <span className="bg-white/20 px-3 rounded-full py-0.5">{selectedLojas.length} LOJAS</span>
                      </button>
                    )
                  )}
                </div>
              )}
            </div>

            {/* RASCUNHO ATUAL */}
            {(tempPedidoItens.length > 0 || pedidos.length > 0) && (
              <div className="flex flex-col border-b border-t border-slate-200 bg-slate-50 border-x-0 w-full shrink-0">
                <div className="flex items-center justify-between p-3 border-b border-slate-200 bg-white">
                  <span className="text-[10px] font-black tracking-widest text-slate-700 uppercase flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse border border-slate-200"></span>
                    Rascunho
                  </span>
                  <div className="flex items-center gap-2">
                    <div className="bg-emerald-600 px-2 py-0.5 rounded text-[10px] font-black text-white shadow-sm">
                      {fmtBRL(totaisPedidoTemp.totalValorLiquidoPorLoja)}
                    </div>
                    <div className="bg-blue-600 px-2 py-0.5 rounded text-[10px] font-black text-white shadow-sm">
                      {totaisPedidoTemp.totalParesPorLoja} Prs
                    </div>
                  </div>
                </div>

                {/* Painel de Replicação de Grades */}
                {pedidos.length > 0 && (
                  <div className="p-2 border-b border-slate-200 bg-white flex flex-col gap-2 shrink-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <button
                        onClick={() => handleReplicarGrades(0)}
                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[10px] font-black uppercase tracking-wider transition-all shadow-md shadow-blue-600/10 active:scale-95 cursor-pointer"
                      >
                        <Copy size={12} />
                        Replicar Grades do Pedido 1
                      </button>

                      {pedidos.length > 1 && (
                        <select
                          onChange={(e) => {
                            if (e.target.value !== "") {
                              handleReplicarGrades(Number(e.target.value));
                              e.target.value = ""; // reset selection dropdown
                            }
                          }}
                          defaultValue=""
                          className="px-2 py-1.5 bg-slate-50 border border-slate-250 rounded-lg text-[10px] font-bold text-slate-650 outline-none focus:border-blue-400 cursor-pointer min-w-[124px]"
                        >
                          <option value="" disabled>Replicar de outro...</option>
                          {pedidos.map((p, idx) => (
                            <option key={idx} value={idx}>
                              Pedido {p.num} ({p.itensComGrades.length} refs)
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  </div>
                )}

                {tempPedidoItens.length > 0 ? (
                  <div className="p-2 space-y-1 bg-slate-50/50">
                    {tempPedidoItens.map((icg, idx) => {
                      const item = items[icg.itemIdx];
                      if (!item) return null;
                      const totalItem = icg.grades.reduce((s, g) => s + totPares(g.qtds), 0);
                      const gradesLabel = icg.grades.map(g => `Gr ${g.letter}`).join(' · ');
                      const isLong = item.ref.length > 10;
                      const coresTexto = [item.cor1, item.cor2, item.cor3]
                        .filter(Boolean)
                        .join(' - ');

                      return (
                        <div
                          key={idx}
                          className="bg-white border border-amber-100 rounded-lg px-2 py-1.5 flex flex-col gap-0.5"
                        >
                          {isLong ? (
                            // Layout 2 linhas para ref longa
                            <>
                              <div className="flex items-center justify-between gap-1">
                                <div className="flex items-center gap-1 min-w-0">
                                  <span className="text-[8px] font-black text-slate-400 shrink-0">#{idx + 1}</span>
                                  <span className="text-[9px] font-black text-slate-800 truncate">{item.ref}</span>
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                  <button onClick={() => setEditingTempItem(idx)} className="text-blue-500 hover:text-blue-700 text-[10px] leading-none" title="Editar">✏️</button>
                                  <button onClick={() => setDeletingTempItem(idx)} className="text-red-400 hover:text-red-600 text-[10px] leading-none" title="Excluir">🗑️</button>
                                </div>
                              </div>
                              <div className="flex items-center justify-between gap-1">
                                <span className="text-[7px] text-slate-400 truncate">
                                  {item.tipo}{coresTexto ? ` - ${coresTexto}` : ''}
                                </span>
                                <div className="flex items-center gap-1 shrink-0">
                                  <span className="text-[8px] font-bold text-blue-600">{gradesLabel}</span>
                                  <span className="text-[8px] font-black text-slate-700 bg-slate-100 rounded px-1">{totalItem}p</span>
                                </div>
                              </div>
                            </>
                          ) : (
                            // Layout 1 linha para ref curta
                            <>
                              <div className="flex items-center gap-1">
                                <span className="text-[8px] font-black text-slate-400 shrink-0">#{idx + 1}</span>
                                <span className="text-[9px] font-black text-slate-800 truncate flex-1">{item.ref}</span>
                                <span className="text-[8px] font-bold text-blue-600 shrink-0">{gradesLabel}</span>
                                <span className="text-[8px] font-black text-slate-700 bg-slate-100 rounded px-1 shrink-0">{totalItem}p</span>
                                <button onClick={() => setEditingTempItem(idx)} className="text-blue-500 hover:text-blue-700 text-[10px] leading-none shrink-0" title="Editar">✏️</button>
                                <button onClick={() => setDeletingTempItem(idx)} className="text-red-400 hover:text-red-600 text-[10px] leading-none shrink-0" title="Excluir">🗑️</button>
                              </div>
                              <span className="text-[7px] text-slate-400 truncate">
                                {item.tipo}{coresTexto ? ` - ${coresTexto}` : ''}
                              </span>
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-4 text-center bg-slate-50/20 text-slate-400 border-b border-slate-100">
                    <p className="text-[10px] font-bold uppercase tracking-wider">Rascunho Vazio</p>
                    <p className="text-[9px] text-slate-400/85 mt-1 leading-relaxed">
                      Selecione itens e monte a grade, ou replique as grades de outro pedido acima.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* LISTA DE PEDIDOS FIXADO EMBAIXO */}
            <div className="flex flex-col p-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 bg-green-600 text-white rounded-full flex items-center justify-center text-[11px] font-black shadow-lg shadow-green-600/10">4</div>
                  <h4 className="text-[11px] font-black text-slate-700 uppercase tracking-widest">Controle de Pedidos</h4>
                </div>
                {pedidos.length > 0 && (
                  <span className="text-[10px] font-black text-green-700 bg-green-100 px-2.5 py-0.5 rounded-full shadow-sm">
                    {pedidos.length} TOTAL
                  </span>
                )}
              </div>

              <div className="flex flex-col gap-3">
                {pedidos.map((ped, i) => {
                  const totais = calcPedidoTotals(ped);

                  // ── Detectar pares e unidades por loja ──────────────────
                  let totalPrs = 0;
                  let totalUn = 0;
                  const lojaMap: Record<number, { prs: number; un: number; valor: number }> = {};
                  ped.lojas.forEach((loja: number) => {
                    lojaMap[loja] = { prs: 0, un: 0, valor: 0 };
                  });
                  ped.itensComGrades.forEach((icg: any) => {
                    const item = items[icg.itemIdx];
                    if (!item) return;
                    icg.grades.forEach((g: any) => {
                      const qtd = totPares(g.qtds);
                      const valorItem = qtd * item.custo * (1 - (cab.desconto || 0) / 100);
                      if (g.cat === "ACES") {
                        totalUn += qtd;
                        ped.lojas.forEach((loja: number) => {
                          if (lojaMap[loja]) {
                            lojaMap[loja].un += qtd;
                            lojaMap[loja].valor += valorItem;
                          }
                        });
                      } else {
                        totalPrs += qtd;
                        ped.lojas.forEach((loja: number) => {
                          if (lojaMap[loja]) {
                            lojaMap[loja].prs += qtd;
                            lojaMap[loja].valor += valorItem;
                          }
                        });
                      }
                    });
                  });

                  const hasPrs = totalPrs > 0;
                  const hasUn = totalUn > 0;
                  const isMix = hasPrs && hasUn;
                  const numLojas = ped.lojas.length;
                  const detailOpen = openDetails[ped.num] ?? false;

                  return (
                    <div
                      key={ped.num}
                      className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm"
                    >
                      {/* ── Linha 1: título + badge MIX + ações ── */}
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[12px] font-black text-slate-800 shrink-0">
                          Pedido #{ped.num}
                        </span>
                        {isMix && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-teal-50 text-teal-700 border border-teal-200 shrink-0">
                            MIX
                          </span>
                        )}
                        <div className="flex gap-1 ml-auto shrink-0">
                          <button
                            onClick={() => setEditingPedido(i)}
                            className="w-[26px] h-[26px] flex items-center justify-center rounded-lg border border-slate-200 text-slate-400 hover:bg-slate-50 hover:text-blue-500 transition-colors"
                            aria-label="Editar pedido"
                          >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                          </button>
                          <button
                            onClick={() => delPedido(i)}
                            className="w-[26px] h-[26px] flex items-center justify-center rounded-lg border border-slate-200 text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                            aria-label="Excluir pedido"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>

                      {/* ── Linha 2: chips de lojas em grid 9 colunas ── */}
                      <div className="border-t border-slate-100 my-2" />
                      <div
                        className="grid gap-1 w-full"
                        style={{ gridTemplateColumns: "repeat(9, minmax(0, 1fr))" }}
                      >
                        {ped.lojas.sort((a: number, b: number) => a - b).map((loja: number) => (
                          <span
                            key={loja}
                            className="inline-flex items-center justify-center text-[12px] font-black h-[22px] px-2 rounded-full bg-blue-50 text-blue-700 border border-blue-300 overflow-hidden"
                          >
                            {loja}
                          </span>
                        ))}
                      </div>

                      {/* ── Linha 3: resumo + botão detalhes ── */}
                      <div className="border-t border-slate-100 my-2" />
                      <div className="flex items-center gap-3">
                        {hasPrs && (
                          <div className="flex flex-col gap-0.5">
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">Total Prs</span>
                            <span className="text-[13px] font-black text-blue-600">{totalPrs * numLojas}Prs</span>
                          </div>
                        )}
                        {isMix && <div className="w-px h-7 bg-slate-200" />}
                        {hasUn && (
                          <div className="flex flex-col gap-0.5">
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">Total Un</span>
                            <span className="text-[13px] font-black text-amber-600">{totalUn * numLojas}Un</span>
                          </div>
                        )}
                        <div className="w-px h-7 bg-slate-200" />
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">Total Valor</span>
                          <span className="text-[12px] font-black text-slate-700">{fmtBRL(totais.totalValorLiquidoGeral)}</span>
                        </div>
                        <button
                          onClick={() => setOpenDetails((prev) => ({ ...prev, [ped.num]: !detailOpen }))}
                          className="ml-auto flex items-center gap-1 text-[10px] font-bold text-slate-500 border border-slate-200 rounded-lg px-2 py-1 hover:bg-slate-50 transition-colors shrink-0"
                        >
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
                          <span>{detailOpen ? "fechar" : "detalhes"}</span>
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ transform: detailOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}><polyline points="6 9 12 15 18 9"/></svg>
                        </button>
                      </div>

                      {/* ── Detalhes por loja (expansível) ── */}
                      {detailOpen && (
                        <div className="border-t border-slate-100 mt-2 pt-2 space-y-1">
                          {ped.lojas.sort((a: number, b: number) => a - b).map((loja: number) => {
                            const d = lojaMap[loja];
                            if (!d) return null;
                            return (
                              <div
                                key={loja}
                                className="flex items-center justify-between bg-slate-50 rounded-lg px-2 py-1.5"
                              >
                                <span className="flex items-center gap-1.5 text-[12px] font-bold text-slate-700">
                                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                                  Loja {loja}
                                </span>
                                <div className="flex items-center gap-2">
                                  {d.prs > 0 && (
                                    <span className="text-[11px] font-black text-blue-600">{d.prs}Prs</span>
                                  )}
                                  {d.prs > 0 && d.un > 0 && (
                                    <span className="text-[10px] text-slate-300">·</span>
                                  )}
                                  {d.un > 0 && (
                                    <span className="text-[11px] font-black text-amber-600">{d.un}Un</span>
                                  )}
                                  <span className="text-[11px] text-slate-500">{fmtBRL(d.valor)}</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* ── Total geral ── */}
                      <div className="mt-2 flex items-center justify-between bg-blue-50 border border-blue-100 rounded-lg px-2 py-1.5">
                        <span className="text-[9px] font-black text-blue-500 uppercase tracking-wider">Total geral</span>
                        <span className="text-[12px] font-black text-blue-800">
                          {hasPrs && `${totalPrs * numLojas}Prs`}
                          {isMix && " · "}
                          {hasUn && `${totalUn * numLojas}Un`}
                          {" · "}
                          {fmtBRL(totais.totalValorLiquidoGeral)}
                        </span>
                      </div>
                    </div>
                  );
                })}

                {pedidos.length === 0 && (
                  <div className="h-full flex flex-col items-center justify-center py-20 px-10">
                    <div className="text-6xl mb-6 opacity-20 filter grayscale">📋</div>
                    <span className="text-[11px] font-black uppercase tracking-[0.3em] text-slate-300 text-center leading-relaxed">
                      Painel Vazio<br/>Inicie o Fluxo à Esquerda
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* POPUP DE EDIÇÃO */}
        {editingPedido !== null && (
          <EditPedidoPopup
            pedido={pedidos[editingPedido]}
            items={items}
            cab={cab}
            onClose={() => setEditingPedido(null)}
            onSave={(updated) => {
              setPedidos((ps) =>
                ps.map((p, i) => (i === editingPedido ? updated : p)),
              );
              setEditingPedido(null);
            }}
          />
        )}

        {/* POPUP DE EDIÇÃO ITEM TEMPORÁRIO */}
        {editingTempItem !== null && (
          <EditTempItemPopup
            itemComGrade={tempPedidoItens[editingTempItem]}
            itemData={items[tempPedidoItens[editingTempItem].itemIdx]}
            cab={cab}
            onClose={() => setEditingTempItem(null)}
            onSave={(updated) => {
              setStep2State((prev: any) => {
                const newItens = [...prev.tempPedidoItens];

                // Verifica se ainda há pares na grade
                const totalPares = updated.grades.reduce(
                  (acc: number, g: any) => {
                    return (
                      acc +
                      Object.values(g.qtds as Record<string, number>).reduce(
                        (s: number, q: number) => s + (q || 0),
                        0,
                      )
                    );
                  },
                  0,
                );

                if (totalPares > 0) {
                  newItens[editingTempItem] = updated;
                } else {
                  // Remove if 0 pairs remaining
                  newItens.splice(editingTempItem, 1);
                }
                return { ...prev, tempPedidoItens: newItens };
              });
              setEditingTempItem(null);
            }}
          />
        )}

        {/* MODAIS (Styled) */}
        {deletingTempItem !== null && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-in fade-in duration-300">
            <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full border border-slate-100 transition-all scale-100">
              <div className="text-3xl mb-4">🗑️</div>
              <h3 className="text-base font-black text-slate-800 uppercase tracking-tight">Remover do Rascunho?</h3>
              <p className="text-xs text-slate-500 mt-2 leading-relaxed">Esta ação removerá o item e suas grades vinculadas permanentemente deste pedido em construção.</p>
              <div className="flex gap-2 mt-6">
                <button onClick={() => setDeletingTempItem(null)} className="flex-1 py-2 text-[10px] font-black text-slate-400 uppercase hover:bg-slate-50 rounded-xl transition-colors">Voltar</button>
                <button onClick={() => handleRemoveTempItem(deletingTempItem)} className="flex-1 py-2 text-[10px] font-black text-white bg-red-600 rounded-xl shadow-lg shadow-red-600/20 hover:bg-red-700 transition-all">Confirmar Exclusão</button>
              </div>
            </div>
          </div>
        )}

        {showCancelOrderModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-in fade-in duration-300">
            <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full border border-slate-100 transition-all scale-100">
              <div className="text-3xl mb-4">⚠️</div>
              <h3 className="text-base font-black text-slate-800 uppercase tracking-tight">Limpar Todo o Trabalho?</h3>
              <p className="text-xs text-slate-500 mt-2 leading-relaxed">Você perderá todo o progresso atual deste pedido. Esta ação não pode ser desfeita.</p>
              <div className="flex gap-2 mt-6">
                <button onClick={() => setShowCancelOrderModal(false)} className="flex-1 py-2 text-[10px] font-black text-slate-400 uppercase hover:bg-slate-50 rounded-xl transition-colors">Continuar Editando</button>
                <button onClick={handleCancelOrder} className="flex-1 py-2 text-[10px] font-black text-white bg-slate-800 rounded-xl shadow-lg hover:bg-slate-900 transition-all">Limpar Tudo</button>
              </div>
            </div>
          </div>
        )}

        {quotaModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-in fade-in duration-300">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden border border-slate-100 transition-all scale-100">
              <div className="bg-red-50 p-5 flex flex-col items-center border-b border-red-100">
                <div className="text-3xl mb-2">🚫</div>
                <h3 className="text-base font-black text-red-900 uppercase">Cota Insuficiente</h3>
                <div className="text-xs text-red-700 mt-1">
                  {quotaModal.lojasFaltando.length} loja(s) sem cota suficiente
                </div>
              </div>
              <div className="p-5">
                <div className="bg-slate-50 rounded-lg p-3 border border-slate-200 mb-4 max-h-32 overflow-y-auto">
                  {quotaModal.lojasFaltando.map((r) => (
                    <div key={r.loja} className="flex justify-between text-xs py-0.5">
                      <span className="text-slate-600">Loja {r.loja}</span>
                      <span className="text-red-600 font-bold">Falta {fmtBRL(r.falta)}</span>
                    </div>
                  ))}
                </div>
                <QuotaJustificativaForm
                  onCancel={() => setQuotaModal(null)}
                  onConfirm={(motivo) => quotaModal.onConfirm(motivo)}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Popup de Edição Item Temporário ──────────────────────────────────────────────────

function EditTempItemPopup({
  itemComGrade,
  itemData,
  cab,
  onClose,
  onSave,
}: {
  itemComGrade: ItemComGrades;
  itemData: OrderItem;
  cab: Cabecalho;
  onClose: () => void;
  onSave: (updated: ItemComGrades) => void;
}) {
  const [localItem, setLocalItem] = useState<ItemComGrades>(
    JSON.parse(JSON.stringify(itemComGrade)),
  );

  const removeGrade = (gradeIndex: number) => {
    setLocalItem((prev) => ({
      ...prev,
      grades: prev.grades.filter((_, i) => i !== gradeIndex),
    }));
  };

  const totalPares = localItem.grades.reduce((sum, g) => sum + totPares(g.qtds), 0);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl max-w-md w-full overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-4 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold">✏️ Gerenciar Grades do Item</h3>
            <p className="text-xs opacity-80 truncate">{itemData.ref} · {itemData.tipo}</p>
          </div>
          <button onClick={onClose} className="text-white hover:bg-white/20 rounded-lg w-8 h-8 flex items-center justify-center text-xl">✕</button>
        </div>

        {/* Aviso */}
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center gap-2">
          <span className="text-amber-600 text-sm">⚠️</span>
          <p className="text-[10px] text-amber-700 font-medium">
            Para alterar quantidades, volte à coluna 2 e edite a grade diretamente.
          </p>
        </div>

        {/* Corpo */}
        <div className="p-4 space-y-2 overflow-y-auto max-h-64">
          {localItem.grades.length === 0 ? (
            <div className="text-center py-6 text-red-500 text-xs font-bold">
              Nenhuma grade vinculada. Ao salvar, este item será removido do rascunho.
            </div>
          ) : (
            localItem.grades.map((grade, gIdx) => {
              const pares = totPares(grade.qtds);
              const resumo = Object.entries(grade.qtds)
                .filter(([_, v]) => v > 0)
                .map(([sz, v]) => `${sz}:${v}`)
                .join(' ');
              return (
                <div key={gIdx} className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 bg-blue-600 text-white rounded text-[10px] font-black flex items-center justify-center shrink-0">
                        {grade.letter}
                      </span>
                      <span className="text-[10px] font-bold text-slate-700">{pares} pares</span>
                      <span className="text-[9px] text-slate-400 font-mono truncate">{resumo}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => removeGrade(gIdx)}
                    className="ml-2 px-2 py-1 text-[9px] font-bold text-red-600 bg-red-50 border border-red-200 rounded hover:bg-red-100 transition shrink-0"
                  >
                    Remover
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 p-3 bg-slate-50 flex items-center justify-between gap-2">
          <div className="text-xs text-slate-500">
            Total: <strong className="text-slate-800">{totalPares} pares</strong>
            {' · '}
            <strong className="text-green-700">{fmtBRL(totalPares * itemData.custo * (1 - (cab.desconto || 0) / 100))}</strong>
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-3 py-1.5 text-[10px] font-bold border border-slate-300 rounded-lg hover:bg-slate-100">
              Cancelar
            </button>
            <button
              onClick={() => onSave(localItem)}
              className="px-3 py-1.5 text-[10px] font-bold bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              💾 Salvar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function QuotaJustificativaForm({
  onCancel,
  onConfirm,
}: {
  onCancel: () => void;
  onConfirm: (motivo: string) => void;
}) {
  const [motivo, setMotivo] = useState("");
  const valido = motivo.trim().length >= 20;
  return (
    <div>
      <label className="text-xs font-bold text-slate-700 block mb-1 uppercase">
        Justificativa * (mín. 20 caracteres)
      </label>
      <textarea
        value={motivo}
        onChange={(e) => setMotivo(e.target.value)}
        rows={3}
        placeholder="Ex: Oportunidade especial com condição diferenciada..."
        className="w-full border border-slate-300 rounded-lg p-2 text-xs resize-none focus:outline-none focus:border-blue-400"
      />
      <div
        className={`text-[10px] mb-3 ${valido ? "text-green-600" : "text-amber-500"}`}
      >
        {motivo.trim().length} caracteres
      </div>
      <div className="flex gap-2">
        <button
          onClick={onCancel}
          className="flex-1 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50"
        >
          Cancelar
        </button>
        <button
          onClick={() => valido && onConfirm(motivo.trim())}
          disabled={!valido}
          className="flex-1 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold disabled:opacity-40 hover:bg-blue-700"
        >
          Solicitar e Criar
        </button>
      </div>
    </div>
  );
}

function EditPedidoPopup({
  pedido,
  items,
  onClose,
  onSave,
  cab,
}: {
  pedido: SubOrder;
  items: OrderItem[];
  onClose: () => void;
  onSave: (updated: SubOrder) => void;
  cab: Cabecalho;
}) {
  const [localPedido, setLocalPedido] = useState({ ...pedido });
  const [showAddLoja, setShowAddLoja] = useState(false);
  const [searchLoja, setSearchLoja] = useState("");

  const lojasDisponiveis = ALL_LOJAS.filter(
    (n) => !localPedido.lojas.includes(n) && String(n).includes(searchLoja)
  );

  function addLoja(loja: number) {
    setLocalPedido((p) => ({
      ...p,
      lojas: [...p.lojas, loja].sort((a, b) => a - b),
    }));
    setSearchLoja("");
  }

  function removeItem(itemIdx: number) {
    setLocalPedido((p) => ({
      ...p,
      itensComGrades: p.itensComGrades.filter((icg) => icg.itemIdx !== itemIdx),
    }));
  }

  function removeLoja(loja: number) {
    setLocalPedido((p) => ({
      ...p,
      lojas: p.lojas.filter((l) => l !== loja),
    }));
  }

  const totals = (() => {
    let totalParesPorLoja = 0;
    let totalValorBrutoPorLoja = 0;
    localPedido.itensComGrades.forEach((icg) => {
      const item = items[icg.itemIdx];
      if (!item) return;
      icg.grades.forEach((g) => {
        const pares = totPares(g.qtds);
        totalParesPorLoja += pares;
        totalValorBrutoPorLoja += pares * item.custo;
      });
    });
    const totalValorLiquidoPorLoja =
      totalValorBrutoPorLoja * (1 - (cab.desconto || 0) / 100);
    return {
      totalParesPorLoja,
      totalValorBrutoPorLoja,
      totalValorLiquidoPorLoja,
      totalParesGeral: totalParesPorLoja * localPedido.lojas.length,
      totalValorBrutoGeral: totalValorBrutoPorLoja * localPedido.lojas.length,
      totalValorLiquidoGeral: totalValorLiquidoPorLoja * localPedido.lojas.length,
    };
  })();

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-4 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold">Pedido {pedido.num}</h3>
            <p className="text-xs opacity-90">
              {totals.totalParesGeral} pares ·{" "}
              {fmtBRL(totals.totalValorLiquidoGeral)} ·{" "}
              {localPedido.lojas.length} lojas
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:bg-white/20 rounded-lg w-8 h-8 flex items-center justify-center text-xl"
          >
            ✕
          </button>
        </div>

        <div className="p-4 overflow-y-auto max-h-[calc(90vh-140px)]">
          <div className="mb-4">
            <label className="text-xs font-bold text-slate-700 uppercase mb-2 block">
              Código (Automático)
            </label>
            <div className="w-full h-9 px-3 border border-slate-300 rounded-lg text-sm font-mono bg-slate-50 flex items-center">
              {localPedido.pedido_numero}
            </div>
          </div>

          <div className="mb-4">
            <div className="text-xs font-bold text-slate-700 uppercase mb-2">
              Itens ({localPedido.itensComGrades.length})
            </div>
            <div className="space-y-2">
              {localPedido.itensComGrades.map((icg) => {
                const item = items[icg.itemIdx];
                if (!item) return null;
                const totalItem = icg.grades.reduce(
                  (s, g) => s + totPares(g.qtds),
                  0,
                );
                const coresTexto = [item.cor1, item.cor2, item.cor3]
                  .filter(Boolean)
                  .join(' - ');
                return (
                  <div
                    key={icg.itemIdx}
                    className="bg-slate-50 border border-slate-200 rounded-lg p-3 flex items-start justify-between"
                  >
                    <div className="flex-1">
                      <div className="text-sm font-bold text-slate-800">
                        {item.ref}
                      </div>
                      <div className="text-xs text-slate-600 mb-2">
                        {item.tipo}{coresTexto ? ` - ${coresTexto}` : ''}
                      </div>
                      <div className="space-y-1">
                        {icg.grades.map((g) => (
                          <div key={g.letter} className="text-[10px] text-slate-500">
                            <strong>Grade {g.letter} ({totPares(g.qtds)}p)</strong> (
                            {CATS[g.cat]?.label}):{" "}
                            {Object.entries(g.qtds)
                              .filter(([_, v]) => v > 0)
                              .map(([sz, v]) => `${sz}-${v}`)
                              .join(" * ")}
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="ml-3">
                      <div className="text-xs font-bold text-green-700 mb-1">
                        {totalItem}p
                      </div>
                      <button
                        onClick={() => removeItem(icg.itemIdx)}
                        className="text-red-500 hover:text-red-700 text-xs"
                      >
                        Remover
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            {/* ── Header lojas + botão adicionar ── */}
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-bold text-slate-700 uppercase">
                Lojas ({localPedido.lojas.length})
              </div>
              <button
                onClick={() => setShowAddLoja((v) => !v)}
                className="text-[10px] font-bold px-2 py-1 bg-blue-50 text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
              >
                {showAddLoja ? "✕ Fechar" : "+ Adicionar Loja"}
              </button>
            </div>

            {/* ── Seletor de lojas ── */}
            {showAddLoja && (
              <div className="mb-3 border border-slate-200 rounded-xl p-3 bg-slate-50">
                <input
                  type="text"
                  placeholder="Buscar loja pelo número..."
                  value={searchLoja}
                  onChange={(e) => setSearchLoja(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-xs mb-2 focus:outline-none focus:border-blue-400"
                />
                <div className="grid grid-cols-8 gap-1.5 max-h-32 overflow-y-auto">
                  {lojasDisponiveis.map((n) => (
                    <button
                      key={n}
                      onClick={() => addLoja(n)}
                      className="h-8 flex items-center justify-center text-[10px] font-black rounded-xl border-2 border-slate-200 bg-white text-slate-500 hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-all"
                    >
                      {n}
                    </button>
                  ))}
                  {lojasDisponiveis.length === 0 && (
                    <div className="col-span-8 text-center text-[10px] text-slate-400 py-2">
                      Nenhuma loja disponível
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── Lista de lojas atuais ── */}
            <div className="flex flex-wrap gap-2">
              {localPedido.lojas.map((loja) => (
                <div
                  key={loja}
                  className="bg-blue-50 border border-blue-300 px-3 py-1.5 rounded-lg flex items-center gap-2"
                >
                  <span className="text-sm font-bold text-blue-800">{loja}</span>
                  <button
                    onClick={() => removeLoja(loja)}
                    className="text-red-500 hover:text-red-700 text-xs"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="border-t border-slate-200 p-4 flex justify-between items-center bg-slate-50">
          <div className="text-xs text-slate-600">
            <div>
              Por Loja: <strong>{totals.totalParesPorLoja}p</strong> ·{" "}
              <strong>{fmtBRL(totals.totalValorLiquidoPorLoja)}</strong>
            </div>
            <div className="text-green-700">
              Total Geral: <strong>{totals.totalParesGeral}p</strong> ·{" "}
              <strong>{fmtBRL(totals.totalValorLiquidoGeral)}</strong>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm border border-slate-300 rounded-lg hover:bg-slate-100"
            >
              Cancelar
            </button>
            <button
              onClick={() => onSave(localPedido)}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
            >
              Salvar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

interface SurveyParamsConfigProps {
  subOrders: SubOrder[];
  surveyParams: any;
  onUpdate: (params: any) => void;
  items: OrderItem[];
}

export function SurveyParamsConfig({
  subOrders,
  surveyParams,
  onUpdate,
  items,
}: SurveyParamsConfigProps) {
  const defaultParams = React.useMemo(() => {
    const defaultSubOrders = subOrders.map(sub => {
      const existing = surveyParams?.sub_orders?.find((o: any) => o.num === sub.num);
      return {
        num: sub.num,
        tipo_limite: existing?.tipo_limite || 'nenhum',
        limite: existing?.limite || 0,
        itens_minimos: existing?.itens_minimos || 0,
        prazo_horas: existing?.prazo_horas || 24,
        itens_obrigatorios: existing?.itens_obrigatorios || [],
      };
    });

    return {
      prazo_horas: surveyParams?.prazo_horas || 24,
      sub_orders: defaultSubOrders,
    };
  }, [subOrders, surveyParams]);

  React.useEffect(() => {
    if (!surveyParams || surveyParams.sub_orders?.length !== subOrders.length) {
      onUpdate(defaultParams);
    }
  }, [defaultParams, surveyParams, subOrders, onUpdate]);

  const currentParams = surveyParams || defaultParams;

  const updateSubOrderParam = (num: number, field: string, value: any) => {
    const updatedSubOrders = currentParams.sub_orders.map((sub: any) => {
      if (sub.num === num) {
        return { ...sub, [field]: value };
      }
      return sub;
    });
    onUpdate({ ...currentParams, sub_orders: updatedSubOrders });
  };

  return (
    <div className="flex flex-col h-full bg-slate-50/50">
      <div className="p-3 border-b border-slate-200 bg-white shrink-0">
        <div className="flex items-center gap-2 mb-3">
          <span className="bg-blue-600 text-white w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black shadow-sm">2</span>
          <h4 className="text-[10px] font-black text-slate-700 uppercase tracking-widest">Parâmetros da Pesquisa</h4>
        </div>

        {/* Prazo Geral */}
        <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-lg">⏱️</span>
            <div>
              <p className="text-xs font-black text-blue-900">Prazo Geral de Votação</p>
              <p className="text-[10px] text-slate-400">Tempo limite para encerramento automático</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={1}
              value={currentParams.prazo_horas}
              onChange={(e) => onUpdate({ ...currentParams, prazo_horas: parseInt(e.target.value) || 24 })}
              className="w-16 h-8 px-2 text-center font-bold text-blue-600 border border-blue-200 bg-white rounded-lg text-xs focus:ring-2 focus:ring-blue-500 outline-none"
            />
            <span className="text-xs font-bold text-blue-700">horas</span>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar">
        {currentParams.sub_orders?.map((sub: any) => {
          const matchedSub = subOrders.find(o => o.num === sub.num);
          const lojasStr = matchedSub?.lojas?.join(', ') || 'Sem lojas';

          return (
            <div key={sub.num} className="border border-slate-200 rounded-xl bg-white shadow-sm overflow-hidden p-3 space-y-3 text-left">
              {/* Suborder title & stores */}
              <div className="flex justify-between items-start border-b border-slate-100 pb-2">
                <div>
                  <h5 className="text-[11px] font-black text-slate-800 uppercase tracking-tight">Sub-Pedido #{sub.num}</h5>
                  <p className="text-[10px] text-slate-400 font-medium mt-0.5 truncate max-w-[180px]">
                    Lojas: {lojasStr}
                  </p>
                </div>
                <span className="text-[9px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md font-bold uppercase">
                  {matchedSub?.pedido_numero || 'Pendente'}
                </span>
              </div>

              {/* Deadline & Limit Type */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Prazo Votação</label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min={1}
                      value={sub.prazo_horas}
                      onChange={(e) => updateSubOrderParam(sub.num, 'prazo_horas', parseInt(e.target.value) || 24)}
                      className="w-full h-8 px-2 text-center font-semibold text-slate-700 border border-slate-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="text-[10px] text-slate-400 font-bold">h</span>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Tipo de Limite</label>
                  <select
                    value={sub.tipo_limite}
                    onChange={(e) => updateSubOrderParam(sub.num, 'tipo_limite', e.target.value)}
                    className="w-full h-8 px-2 text-xs font-bold text-slate-700 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="nenhum">NENHUM</option>
                    <option value="valor">VALOR (R$)</option>
                    <option value="pares">PARES</option>
                    <option value="itens">ITENS</option>
                  </select>
                </div>
              </div>

              {/* Config fields based on limit type */}
              {sub.tipo_limite !== 'nenhum' && (
                <div className="grid grid-cols-2 gap-2 p-2 bg-slate-50 border border-slate-100 rounded-lg">
                  <div>
                    <label className="text-[9px] font-black text-slate-500 uppercase block mb-1">
                      {sub.tipo_limite === 'valor' ? 'Limite R$' : sub.tipo_limite === 'pares' ? 'Limite Pares' : 'Limite Itens'}
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={sub.limite}
                      onChange={(e) => updateSubOrderParam(sub.num, 'limite', parseFloat(e.target.value) || 0)}
                      className="w-full h-8 px-2 font-bold text-slate-700 border border-slate-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] font-black text-slate-500 uppercase block mb-1">
                      {sub.tipo_limite === 'valor' ? 'Mínimo Valor' : sub.tipo_limite === 'pares' ? 'Mínimo Pares' : 'Mínimo Itens'}
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={sub.itens_minimos}
                      onChange={(e) => updateSubOrderParam(sub.num, 'itens_minimos', parseInt(e.target.value) || 0)}
                      className="w-full h-8 px-2 font-bold text-slate-700 border border-slate-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    />
                  </div>
                </div>
              )}

              {/* Mandatory Items Select */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase block">Itens Obrigatórios</label>
                <div className="flex flex-wrap gap-1 border border-slate-200 rounded-lg p-1.5 min-h-[32px] bg-slate-50/50">
                  {sub.itens_obrigatorios?.length === 0 ? (
                    <span className="text-[10px] text-slate-400 italic px-1">Nenhum item selecionado</span>
                  ) : (
                    sub.itens_obrigatorios?.map((ref: string) => (
                      <span key={ref} className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded text-[9px] font-bold border border-blue-200/50">
                        {ref}
                        <button
                          type="button"
                          onClick={() => {
                            const filtered = sub.itens_obrigatorios.filter((r: string) => r !== ref);
                            updateSubOrderParam(sub.num, 'itens_obrigatorios', filtered);
                          }}
                          className="text-blue-500 hover:text-red-500 font-black"
                        >
                          ×
                        </button>
                      </span>
                    ))
                  )}
                </div>

                <select
                  value=""
                  onChange={(e) => {
                    const ref = e.target.value;
                    if (ref && !sub.itens_obrigatorios?.includes(ref)) {
                      updateSubOrderParam(sub.num, 'itens_obrigatorios', [...(sub.itens_obrigatorios || []), ref]);
                    }
                  }}
                  className="w-full h-8 px-2 text-[10px] font-bold text-slate-600 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="">+ Adicionar Item Obrigatório</option>
                  {items.map((item) => (
                    <option key={item.ref} value={item.ref}>
                      {item.ref} ({item.modelo || 'Sem modelo'})
                    </option>
                  ))}
                </select>
              </div>

              {/* Indicador de status da configuração */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-100 mt-1">
                <span className="text-[9px] text-slate-400 italic">Parâmetros atualizados automaticamente</span>
                <span className={`text-[9px] font-black flex items-center gap-1 px-2 py-0.5 rounded-full border ${
                  sub.tipo_limite !== 'nenhum' && sub.limite > 0
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-amber-50 text-amber-600 border-amber-200'
                }`}>
                  {sub.tipo_limite !== 'nenhum' && sub.limite > 0 ? '✓ Configurado' : '⚠ Incompleto'}
                </span>
              </div>

            </div>
          );
        })}
      </div>
    </div>
  );
}
