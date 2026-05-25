import React, {
  useState,
  useEffect,
  useRef,
  Dispatch,
  SetStateAction,
} from "react";
import { RefreshCw, Trash2 } from "lucide-react";
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
const ALL_LOJAS = Array.from({ length: 120 }, (_, i) => i + 1);
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
}

interface StepPedidosProps {
  items: OrderItem[];
  pedidos: SubOrder[];
  setPedidos: Dispatch<SetStateAction<SubOrder[]>> | any; // Fix potential type issues with setPedidos
  user?: User;
  brandId?: string; // Receber brandId do cabeçalho para evitar erro RLS
  cab: Cabecalho;
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
  step2State,
  setStep2State,
  allowedStores = [],
  canViewAllStores = false,
}: StepPedidosProps) {
  const isGerente = user?.role === "MANAGER";
  const AVAILABLE_LOJAS = allowedStores.map((s) => parseInt(s.number));
  const [userStoreNumber, setUserStoreNumber] = useState<number | null>(null);

  useEffect(() => {
    async function fetchUserStoreNumber() {
      if (user && user.role === "MANAGER" && user.storeId) {
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

  const [editingTempItem, setEditingTempItem] = useState<number | null>(null);
  const [deletingTempItem, setDeletingTempItem] = useState<number | null>(null);
  const [showCancelOrderModal, setShowCancelOrderModal] = useState(false);

  type QuotaModalState = {
    lojasFaltando: { loja: number; falta: number }[];
    valorPorLoja: number;
    onConfirm: (motivo?: string) => void;
  } | null;

  const [quotaModal, setQuotaModal] = useState<QuotaModalState>(null);

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

  function handleGradeKeyDown(
    e: React.KeyboardEvent,
    currentSize: string,
    allSizes: string[],
  ) {
    if (!gradeExpandida) return;

    const currentIdx = allSizes.indexOf(currentSize);
    let nextIdx = -1;

    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      nextIdx = currentIdx + 1;
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      nextIdx = currentIdx - 1;
    } else if (e.key === "Enter") {
      nextIdx = currentIdx + 1; // ENTER também avança
    }

    if (nextIdx >= 0 && nextIdx < allSizes.length) {
      e.preventDefault();
      const nextKey = `${gradeExpandida}-${allSizes[nextIdx]}`;
      inputRefs.current[nextKey]?.focus();
      inputRefs.current[nextKey]?.select();
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

  function adicionarGrade() {
    const letrasUsadas = Object.keys(gradesGlobais);
    const proxima = GRADE_LETTERS.split("").find(
      (l) => !letrasUsadas.includes(l),
    );
    if (proxima) {
      const firstItemIdx = Array.from(selectedItems)[0] ?? 0;
      const initialCat = (items[firstItemIdx]?.modelo || "MASC") as any;

      setStep2State((prev: any) => ({
        ...prev,
        gradesGlobais: {
          ...prev.gradesGlobais,
          [proxima]: {
            cat: initialCat,
            qtds: {},
          },
        },
        gradeExpandida: proxima,
      }));
    }
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
    if (!window.confirm(`Tem certeza que deseja EXCLUIR a Grade ${letter}?`)) {
      return;
    }

    setStep2State((prev: any) => {
      const { [letter]: _, ...resto } = prev.gradesGlobais;
      return {
        ...prev,
        gradesGlobais: resto,
      };
    });

    toast.success(`🗑️ Grade ${letter} excluída com sucesso!`);
  };

  const handleLimparTodasGrades = () => {
    if (!window.confirm("Tem certeza que deseja LIMPAR todas as grades?")) {
      return;
    }
    setStep2State((prev: any) => ({
      ...prev,
      gradesGlobais: {},
    }));
    toast.info("🧹 Todas as grades foram limpas!");
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
          itensJaVinculados.push(items[itemIdx].ref);
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
    if (tempPedidoItens.length === 0) {
      alert("Vincule ao menos um item com grade antes de criar o pedido");
      return;
    }

    if (selectedLojas.length === 0 && canViewAllStores) {
      alert("Selecione ao menos uma loja");
      return;
    }

    const lojasParaPedido = !canViewAllStores ? AVAILABLE_LOJAS : selectedLojas;

    // Calcular valor por loja já com desconto
    const valorPorLoja = tempPedidoItens.reduce((total, icg) => {
      const item = items[icg.itemIdx];
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
      if (lojasFaltando.length > 0 && user?.role !== 'ADMIN' && motivo) {
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
      setQuotaModal(null);
    };

    if (lojasFaltando.length === 0) {
      // Todas as lojas têm cota — criar direto sem perguntar nada
      await executarCriacao();
    } else if (user?.role === 'ADMIN') {
      // Admin: window.confirm e cria mesmo assim
      const totalFalta = lojasFaltando.reduce((s, r) => s + r.falta, 0);
      const ok = window.confirm(
        `Atenção: A cota foi excedida em ${fmtBRL(totalFalta)} em ${lojasFaltando.length} loja(s).\n\nComo ADMINISTRADOR, deseja autorizar mesmo assim?`
      );
      if (ok) await executarCriacao();
    } else {
      // Gerente/Comprador: modal de justificativa
      setQuotaModal({ lojasFaltando, valorPorLoja, onConfirm: executarCriacao });
    }
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
    const modelos = Array.from(selectedItems).map((idx) => items[idx].modelo);
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

  const handleCancelOrder = () => {
    setStep2State((prev: any) => ({
      ...prev,
      tempPedidoItens: [],
      selectedItems: new Set(),
    }));
    setShowCancelOrderModal(false);
  };

  return (
    <div className="p-4">
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-3 rounded-t-lg">
        <h3 className="text-sm font-bold uppercase tracking-wide">
          📦 Montagem de Pedidos
        </h3>
        <p className="text-xs opacity-90 mt-0.5">
          Selecione: Item → Grade → Lojas → Criar Pedido
        </p>
      </div>

      <div
        className={`grid ${isMobile ? "grid-cols-1 gap-4" : !canViewAllStores ? "grid-cols-3 gap-0" : "grid-cols-4 gap-0"} bg-white border border-slate-200 rounded-b-lg overflow-hidden`}
      >
        {/* COLUNA 1: ITENS */}
        <div
          className={`p-3 ${!isMobile && "border-r border-slate-200"} bg-slate-50`}
        >
          <div className="flex items-center gap-2 mb-2">
            <span className="bg-blue-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold">
              1
            </span>
            <h4 className="text-xs font-bold text-slate-700 uppercase flex-1">
              Itens
            </h4>
          </div>

          {/* Botões Selecionar/Desmarcar Todos */}
          <div className="flex gap-1.5 mb-2">
            <button
              onClick={() =>
                setStep2State((prev: any) => ({
                  ...prev,
                  selectedItems: new Set(items.map((_, idx) => idx)),
                }))
              }
              className="flex-1 px-2 py-1 text-[8px] font-bold bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors shadow-sm active:scale-95"
            >
              ✓ Todos
            </button>
            <button
              onClick={() =>
                setStep2State((prev: any) => ({
                  ...prev,
                  selectedItems: new Set(),
                }))
              }
              className="flex-1 px-2 py-1 text-[8px] font-bold bg-slate-400 text-white rounded-md hover:bg-slate-500 transition-colors shadow-sm active:scale-95"
            >
              ✕ Limpar
            </button>
          </div>

          <div
            className={`${!canViewAllStores ? "grid grid-cols-2 gap-2" : "space-y-2"} max-h-[500px] overflow-y-auto`}
          >
            {items.map((item, idx) => {
              const isSelected = selectedItems.has(idx);
              const jaVinculado = tempPedidoItens.some(
                (icg) => icg.itemIdx === idx,
              );

              return (
                <div
                  key={idx}
                  onClick={() => toggleItem(idx)}
                  className={`p-2 rounded-lg border cursor-pointer transition-all ${
                    jaVinculado
                      ? "bg-green-50 border-green-300 shadow-sm"
                      : isSelected
                        ? "bg-blue-50 border-blue-400 shadow-sm"
                        : "bg-white border-slate-200 hover:border-blue-300"
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => {}}
                      className="mt-0.5"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] font-black text-slate-400 shrink-0 bg-slate-200 rounded px-1">
                          #{idx + 1}
                        </span>
                        <div className="text-xs font-bold text-slate-800 truncate">
                          {item.ref}
                        </div>
                        {jaVinculado && (
                          <span className="bg-green-600 text-white text-[7px] font-bold px-1.5 py-0.5 rounded uppercase shrink-0">
                            Vinculado
                          </span>
                        )}
                      </div>
                      <div className="text-[9px] text-slate-600 truncate">
                        {item.tipo} · {item.modelo}
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="text-[10px] font-bold text-green-700">
                          Custo:{" "}
                          {fmtBRL(item.custo * (1 - (cab.desconto || 0) / 100))}
                        </div>
                        <div className="text-[8px] text-slate-400 line-through">
                          {fmtBRL(item.preco_venda)}
                        </div>
                        {item.cor1 && (
                          <div className="flex items-center gap-0.5">
                            <div
                              className="w-2 h-2 rounded-full border border-slate-300 shrink-0"
                              style={{ backgroundColor: '#94a3b8' }}
                            />
                            <span className="text-[7px] text-slate-500 uppercase font-medium">
                              {item.cor1}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* COLUNA 2: GRADES */}
        <div className={`p-3 ${!isMobile && "border-r border-slate-200"}`}>
          <div className="flex items-center gap-2 mb-3">
            <span className="bg-blue-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold">
              2
            </span>
            <h4 className="text-xs font-bold text-slate-700 uppercase flex-1">
              Grades
            </h4>
            <div className="flex gap-2">
              {Object.keys(gradesGlobais).length > 0 && (
                <button
                  onClick={handleLimparTodasGrades}
                  className="px-2 py-1 text-[9px] font-bold bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded transition"
                  title="Limpar todas as grades"
                >
                  Limpar Tudo
                </button>
              )}
              {Object.keys(gradesGlobais).length < 8 && (
                <button
                  onClick={adicionarGrade}
                  className="px-2 py-1 text-[9px] font-bold bg-green-600 text-white rounded hover:bg-green-700"
                >
                  + Grade
                </button>
              )}
            </div>
          </div>

          {Object.keys(gradesGlobais).length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-[10px]">
              Clique em "+ Grade" para começar
            </div>
          ) : (
            <div className="space-y-2 max-h-[500px] overflow-y-auto">
              {Object.keys(gradesGlobais)
                .sort()
                .map((letter) => {
                  const isExpanded = gradeExpandida === letter;
                  const gradeData = gradesGlobais[letter];
                  const currentCat = gradeData.cat;
                  const sizes = CATS[currentCat]?.sizes || [];
                  const totalPares = totPares(gradeData.qtds);

                  return (
                    <div
                      key={letter}
                      className="border rounded-lg p-2 bg-white group"
                    >
                      {/* Header da Grade (sempre visível) */}
                      <div className="flex items-center gap-2 pb-2">
                        <div
                          className="flex-1 flex items-center gap-2 cursor-pointer"
                          onClick={() =>
                            setStep2State((prev: any) => ({
                              ...prev,
                              gradeExpandida: isExpanded ? null : letter,
                            }))
                          }
                        >
                          <div className="w-6 h-6 bg-blue-600 text-white rounded font-bold flex items-center justify-center text-xs">
                            {letter}
                          </div>
                          <div className="flex-1 font-semibold text-[10px] text-slate-600">
                            {totalPares > 0 ? "Pares" : "Grade Vazia"}
                          </div>
                          <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-[10px] font-bold">
                            {totalPares}p
                          </span>
                          <span className="text-slate-400 text-[10px] mr-2">
                            {isExpanded ? "▼" : "▶"}
                          </span>
                        </div>

                        {/* NOVOS BOTÕES */}
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleLimparGrade(letter);
                            }}
                            className="p-1 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded transition"
                            title="Limpar quantidades desta grade"
                          >
                            <RefreshCw size={12} className="text-amber-600" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleExcluirGrade(letter);
                            }}
                            className="p-1 bg-red-50 hover:bg-red-100 border border-red-200 rounded transition"
                            title="Excluir esta grade"
                          >
                            <Trash2 size={12} className="text-red-600" />
                          </button>
                        </div>
                      </div>

                      {/* Resumo da Grade (sempre visível se houver pares e não estiver expandido, ou sempre acima do botão) */}
                      {!isExpanded && totalPares > 0 && (
                        <div className="flex flex-wrap gap-2.5 mb-2 px-1">
                          {Object.entries(gradeData?.qtds || {})
                            .filter(([_, v]) => v > 0)
                            .map(([sz, v]) => (
                              <div
                                key={sz}
                                className="text-[10px] text-slate-600"
                              >
                                <span className="font-bold text-slate-800">
                                  {sz}-
                                </span>
                                {v}
                              </div>
                            ))}
                        </div>
                      )}

                      {/* Grid Expandido */}
                      {isExpanded && (
                        <div className="mt-2 pt-2 border-t">
                          {/* Seletor de categoria */}
                          <div className="flex flex-wrap gap-1 mb-2">
                            {catsPermitidas.map((k) => {
                              const v = CATS[k];
                              return (
                                <button
                                  key={k}
                                  onClick={() => {
                                    setStep2State((prev: any) => ({
                                      ...prev,
                                      gradesGlobais: {
                                        ...prev.gradesGlobais,
                                        [letter]: {
                                          ...prev.gradesGlobais[letter],
                                          cat: k as any,
                                          qtds: {},
                                        },
                                      },
                                    }));
                                  }}
                                  className={`px-2 py-0.5 text-[8px] font-bold rounded border ${
                                    currentCat === k
                                      ? "bg-blue-600 text-white border-blue-600"
                                      : "bg-white border-slate-200 text-slate-500"
                                  }`}
                                >
                                  {v.label}
                                </button>
                              );
                            })}
                          </div>

                          {/* Grid de numeração COMPACTO */}
                          <div className="grid grid-cols-6 gap-1">
                            {sizes.map((sz) => {
                              const qtd = gradeData?.qtds[sz] || 0;
                              return (
                                <div key={sz} className="text-center">
                                  <div className="text-[7px] text-slate-400 font-bold mb-0.5">
                                    {sz}
                                  </div>
                                  {isMobile ? (
                                    // Mobile: Botões +/-
                                    <div className="flex flex-col gap-0.5">
                                      <button
                                        onClick={() => setGradeQtd(sz, qtd + 1)}
                                        className="w-full h-5 bg-green-500 text-white rounded text-[10px] font-bold active:bg-green-600"
                                      >
                                        +
                                      </button>
                                      <div
                                        className={`text-[9px] font-bold ${qtd > 0 ? "text-green-700" : "text-slate-300"}`}
                                      >
                                        {qtd}
                                      </div>
                                      <button
                                        onClick={() => setGradeQtd(sz, qtd - 1)}
                                        className="w-full h-5 bg-red-500 text-white rounded text-[10px] font-bold active:bg-red-600"
                                      >
                                        −
                                      </button>
                                    </div>
                                  ) : (
                                    // Desktop: Input
                                    <input
                                      ref={(el) => {
                                        inputRefs.current[`${letter}-${sz}`] =
                                          el;
                                      }}
                                      type="number"
                                      min={0}
                                      value={qtd || ""}
                                      onChange={(e) =>
                                        setGradeQtd(
                                          sz,
                                          parseInt(e.target.value) || 0,
                                        )
                                      }
                                      onKeyDown={(e) =>
                                        handleGradeKeyDown(e, sz, sizes)
                                      }
                                      className={`w-full h-6 text-center text-[10px] border rounded ${
                                        qtd > 0
                                          ? "bg-green-50 border-green-300 text-green-700 font-bold"
                                          : "bg-white border-slate-200"
                                      }`}
                                    />
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      <button
                        onClick={() => vincularAoPedido(letter)}
                        disabled={totalPares === 0}
                        className="mt-2 w-full px-2 py-1 bg-blue-600 text-white text-[9px] font-bold rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        ✓ Vincular Grade {letter}
                      </button>
                    </div>
                  );
                })}
            </div>
          )}
        </div>

        {/* COLUNA 3: LOJAS */}
        {canViewAllStores && (
          <div
            className={`p-3 ${!isMobile && "border-r border-slate-200"} bg-slate-50`}
          >
            <div className="flex items-center gap-2 mb-3">
              <span className="bg-blue-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold">
                3
              </span>
              <h4 className="text-xs font-bold text-slate-700 uppercase">
                Lojas
              </h4>
            </div>

            <div className="flex gap-2 mb-2">
              <button
                onClick={() => selectLojaMode("sub")}
                className={`px-2 py-1 text-[10px] rounded font-medium ${
                  lojaMode === "sub"
                    ? "bg-blue-600 text-white"
                    : "bg-white border border-slate-300 text-slate-600"
                }`}
              >
                Sub
              </button>
              <button
                onClick={() => selectLojaMode("all")}
                className={`px-2 py-1 text-[10px] rounded font-medium ${
                  lojaMode === "all"
                    ? "bg-blue-600 text-white"
                    : "bg-white border border-slate-300 text-slate-600"
                }`}
              >
                Todas
              </button>
              <span className="text-[9px] text-slate-500 self-center ml-auto">
                {selectedLojas.length} sel.
              </span>
            </div>

            {pool.length > 0 && (
              <div className="max-h-[400px] overflow-y-auto">
                <div className="flex flex-wrap gap-1.5">
                  {pool.map((n) => (
                    <div
                      key={n}
                      onClick={() => toggleLoja(n)}
                      className={`w-9 h-9 flex items-center justify-center text-[10px] font-bold rounded border cursor-pointer ${
                        selectedLojas.includes(n)
                          ? "bg-blue-600 text-white border-blue-600"
                          : "bg-white border-slate-200 text-slate-500"
                      }`}
                    >
                      {n}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ⚠️ ALERTAS: RESTRIÇÕES DE MARCA/PRODUTO E REQUISITOS DE GRADE */}
            {(brandRestriction ||
              productRestrictions.length > 0 ||
              storeRequirements.length > 0) && (
              <div className="mt-3 space-y-2">
                {/* ALERTA DE RESTRIÇÃO DE MARCA (VERMELHO ESCURO) */}
                {brandRestriction && (
                  <div className="p-3 bg-red-50 border-2 border-red-500 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-red-600 text-xl">⛔</span>
                      <h5 className="text-xs font-bold text-red-900 uppercase">
                        Atenção: Restrição de Marca
                      </h5>
                    </div>

                    <div className="bg-white rounded p-2 border border-red-300">
                      <div className="flex items-start gap-2">
                        <span className="text-red-600 text-lg">🚫</span>
                        <div className="flex-1">
                          <div className="text-xs font-bold text-red-900">
                            {brandRestriction.mensagem_alerta}
                          </div>
                          <div className="text-[10px] text-red-700 mt-1">
                            Lojas selecionadas com restrição:{" "}
                            {brandRestriction.lojas_proibidas_encontradas.join(
                              ", ",
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* ALERTA DE RESTRIÇÃO DE PRODUTO (VERMELHO CLARO) */}
                {productRestrictions.length > 0 && (
                  <div className="p-3 bg-orange-50 border-2 border-orange-400 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-orange-600 text-xl">⚠️</span>
                      <h5 className="text-xs font-bold text-orange-900 uppercase">
                        Atenção: Produto Não Vendido
                      </h5>
                    </div>

                    <div className="space-y-2">
                      {productRestrictions.map((res, idx) => (
                        <div
                          key={idx}
                          className="bg-white rounded p-2 border border-orange-300"
                        >
                          <div className="flex items-start gap-2">
                            <span className="text-orange-600 text-lg">🚫</span>
                            <div className="flex-1">
                              <div className="text-xs font-bold text-orange-900">
                                {res.mensagem_alerta}
                              </div>
                              <div className="text-[10px] text-orange-700 mt-1">
                                Lojas selecionadas:{" "}
                                {res.lojas_proibidas_encontradas.join(", ")}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* ALERTA DE REQUISITOS DE GRADE (AMARELO) */}
                {storeRequirements.length > 0 && (
                  <div className="p-3 bg-amber-50 border border-amber-300 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-amber-600 text-lg">⚠️</span>
                      <h5 className="text-xs font-bold text-amber-900 uppercase">
                        Atenção: Requisitos de Grade
                      </h5>
                    </div>

                    <div className="space-y-2">
                      {storeRequirements.map((req, idx) => (
                        <div
                          key={idx}
                          className="bg-white rounded p-2 border border-amber-200"
                        >
                          <div className="flex items-start gap-2">
                            <span className="text-amber-600">📍</span>
                            <div className="flex-1">
                              <div className="text-xs font-bold text-amber-900">
                                {req.mensagem}
                              </div>
                              <div className="text-[10px] text-amber-700 mt-1">
                                Tamanhos obrigatórios:{" "}
                                {req.tamanhos_obrigatorios.join(", ")}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* COLUNA 4: FINALIZAÇÃO COM LISTA DE PEDIDOS */}
        <div className="p-3 flex flex-col">
          <div className="flex items-center gap-2 mb-3">
            <span className="bg-green-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold">
              {!canViewAllStores ? "3" : "4"}
            </span>
            <h4 className="text-xs font-bold text-slate-700 uppercase flex-1">
              Pedidos
            </h4>
          </div>

          {/* Badge informativo para restrito */}
          {!canViewAllStores && AVAILABLE_LOJAS.length > 0 && (
            <div className="mb-3 bg-blue-50 border border-blue-200 rounded-lg p-2 flex items-center gap-2 flex-wrap">
              {AVAILABLE_LOJAS.map((lojaNum) => (
                <div
                  key={lojaNum}
                  className="w-8 h-8 flex items-center justify-center bg-blue-600 text-white rounded font-bold text-sm"
                >
                  {lojaNum}
                </div>
              ))}
              <div className="flex-1">
                <div className="text-[10px] font-bold text-blue-900">
                  Lojas Permitidas
                </div>
                <div className="text-[8px] text-blue-600">
                  Pedido automático
                </div>
              </div>
            </div>
          )}

          {/* Pedido Temporário */}
          {tempPedidoItens.length > 0 && (
            <div className="bg-amber-50 border border-amber-300 rounded-lg p-2 mb-3 flex flex-col max-h-[50vh]">
              <div className="flex justify-between items-center mb-2">
                <div className="text-xs font-bold text-amber-900">
                  Pedido Temporário
                </div>
                <button
                  onClick={() => setShowCancelOrderModal(true)}
                  className="text-[9px] bg-red-100 text-red-700 px-2 py-1 rounded hover:bg-red-200 border border-red-200 font-bold flex items-center gap-1 transition-colors"
                  title="Cancelar Pedido Inteiro"
                >
                  <span className="text-red-500 text-sm leading-none">🗑️</span>{" "}
                  Cancelar Pedido
                </button>
              </div>

              <div className="text-[9px] text-amber-700 space-y-0.5 mb-2">
                <div>
                  Pares/Loja:{" "}
                  <strong>{totaisPedidoTemp.totalParesPorLoja}</strong>
                </div>
                <div>
                  Lojas: <strong>{totaisPedidoTemp.numLojas}</strong>
                </div>
                <div className="pt-1 border-t border-amber-200">
                  <div className="text-blue-700">
                    Total Geral:{" "}
                    <strong>{totaisPedidoTemp.totalParesGeral} pares</strong>
                  </div>
                  <div className="text-slate-500 line-through">
                    Bruto: {fmtBRL(totaisPedidoTemp.totalValorBrutoGeral)}
                  </div>
                  <div className="text-green-700">
                    Líquido (-{cab.desconto}%):{" "}
                    <strong>
                      {fmtBRL(totaisPedidoTemp.totalValorLiquidoGeral)}
                    </strong>
                  </div>
                </div>
              </div>

              <div className="mt-1 mb-2 flex-1 overflow-y-auto bg-white rounded border border-amber-200 shadow-sm">
                <table className="w-full text-left text-[9px]">
                  <thead className="bg-amber-100 sticky top-0 shadow-sm">
                    <tr>
                      <th className="p-1 px-2 border-b border-amber-200 font-bold text-amber-900">
                        Ref
                      </th>
                      <th className="p-1 border-b border-amber-200 font-bold text-amber-900 text-center">
                        Pares
                      </th>
                      <th className="p-1 border-b border-amber-200 font-bold text-amber-900 text-center w-14">
                        Ações
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {tempPedidoItens.map((icg, idx) => {
                      const item = items[icg.itemIdx];
                      const totalItem = icg.grades.reduce(
                        (s, g) => s + totPares(g.qtds),
                        0,
                      );
                      return (
                        <tr
                          key={idx}
                          className="border-b border-slate-100 hover:bg-slate-50 transition-colors"
                        >
                          <td
                            className="p-1 px-2 font-medium text-slate-800 truncate max-w-[80px]"
                            title={item.ref}
                          >
                            <div className="font-bold text-[9px]">{item.ref}</div>
                            <div className="flex gap-0.5 mt-0.5 flex-wrap">
                              {icg.grades.map((g) => (
                                <span
                                  key={g.letter}
                                  className="text-[7px] font-black bg-blue-100 text-blue-700 px-1 py-0.5 rounded leading-none"
                                >
                                  {g.letter}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="p-1 text-center font-bold text-slate-700">
                            {totalItem}
                          </td>
                          <td className="p-1 text-center">
                            <div className="flex gap-2 justify-center items-center h-full">
                              <button
                                onClick={() => setEditingTempItem(idx)}
                                className="text-blue-600 hover:text-blue-800 transition-colors"
                                title="Editar item"
                              >
                                ✏️
                              </button>
                              <button
                                onClick={() => setDeletingTempItem(idx)}
                                className="text-red-600 hover:text-red-800 transition-colors"
                                title="Excluir item"
                              >
                                🗑️
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <button
                onClick={criarPedido}
                className="w-full px-2 py-1.5 bg-green-600 text-white text-[10px] font-bold rounded hover:bg-green-700 mt-auto"
              >
                ✓ Criar Pedido
              </button>
            </div>
          )}

          {/* Lista de Pedidos Criados */}
          <div className="flex-1 overflow-y-auto space-y-2">
            {pedidos
              .filter((p) => p.itensComGrades.length > 0)
              .map((ped) => {
                const totals = calcPedidoTotals(ped);
                const pedidoIndex = pedidos.findIndex((p) => p.num === ped.num);

                return (
                  <div
                    key={ped.num}
                    onClick={() => setEditingPedido(pedidoIndex)}
                    className="bg-white border border-slate-200 rounded-lg p-2 cursor-pointer hover:border-blue-400 transition-all"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <div className="text-xs font-bold text-slate-800">
                        Pedido {ped.num}
                      </div>
                      <div className="text-[8px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-600 font-mono">
                        {ped.pedido_numero}
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          delPedido(pedidoIndex);
                        }}
                        className="ml-auto text-red-500 text-xs"
                      >
                        ✕
                      </button>
                    </div>
                    <div className="text-[9px] text-slate-600 space-y-0.5">
                      <div>
                        Pares Total:{" "}
                        <strong className="text-green-700">
                          {totals.totalParesGeral}
                        </strong>
                      </div>
                      <div>
                        Valor Total:{" "}
                        <strong className="text-green-700">
                          {fmtBRL(totals.totalValorLiquidoGeral)}
                        </strong>
                      </div>
                    </div>
                  </div>
                );
              })}
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

      {/* MODAL CANCELAR PEDIDO INTEIRO */}
      {showCancelOrderModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden animate-fade-in-up border border-slate-100">
            <div className="bg-red-50 p-6 flex flex-col items-center border-b border-red-100">
              <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center text-3xl mb-4 shadow-sm border border-red-200">
                ⚠️
              </div>
              <h3 className="text-lg font-black text-red-900 text-center uppercase tracking-tight">
                Cancelar Pedido Completo?
              </h3>
            </div>

            <div className="p-6">
              <p className="text-sm text-slate-600 text-center mb-6">
                Tem certeza que deseja cancelar <strong>TODO O PEDIDO</strong>?
              </p>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-6">
                <div className="flex justify-between items-center text-xs mb-2">
                  <span className="text-slate-500 font-medium font-sans uppercase tracking-wider">
                    Total Pares
                  </span>
                  <span className="text-slate-900 font-black">
                    {totaisPedidoTemp.totalParesGeral}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs mb-2">
                  <span className="text-slate-500 font-medium font-sans uppercase tracking-wider">
                    Total Valor
                  </span>
                  <span className="text-slate-900 font-black">
                    {fmtBRL(totaisPedidoTemp.totalValorLiquidoGeral)}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500 font-medium font-sans uppercase tracking-wider">
                    Lojas
                  </span>
                  <span className="text-slate-900 font-black">
                    {totaisPedidoTemp.numLojas}
                  </span>
                </div>
              </div>

              <p className="text-xs text-red-600/80 text-center font-bold mb-6 italic">
                ⚠️ TODOS os itens serão perdidos! Esta ação não pode ser
                desfeita.
              </p>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowCancelOrderModal(false)}
                  className="flex-1 px-4 py-3 bg-white border border-slate-300 text-slate-700 font-bold text-xs uppercase tracking-wider rounded-xl hover:bg-slate-50 hover:border-slate-400 transition-all shadow-sm"
                >
                  Não, Manter
                </button>
                <button
                  onClick={handleCancelOrder}
                  className="flex-1 px-4 py-3 bg-red-600 text-white font-bold text-xs uppercase tracking-wider rounded-xl hover:bg-red-700 transition-all shadow-sm flex justify-center items-center gap-2"
                >
                  ❌ Sim, Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL EXCLUIR ITEM TEMPORÁRIO */}
      {deletingTempItem !== null && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden animate-fade-in-up border border-slate-100">
            <div className="bg-red-50 p-5 flex flex-col items-center border-b border-red-100">
              <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center text-2xl mb-3 shadow-sm border border-red-200">
                🗑️
              </div>
              <h3 className="text-md font-black text-red-900 text-center uppercase tracking-tight">
                Confirmar Exclusão
              </h3>
            </div>

            <div className="p-5">
              <p className="text-sm text-slate-600 text-center mb-4">
                Tem certeza que deseja excluir?
              </p>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 mb-5">
                <div className="text-xs font-black text-slate-800 mb-1">
                  📦 Ref: {items[tempPedidoItens[deletingTempItem].itemIdx].ref}
                </div>
                <div className="text-[10px] text-slate-600 uppercase mb-2 line-clamp-1">
                  {items[tempPedidoItens[deletingTempItem].itemIdx].modelo}
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-slate-200">
                  <div className="text-[10px] font-bold text-blue-700">
                    {tempPedidoItens[deletingTempItem].grades.reduce(
                      (s, g) => s + totPares(g.qtds),
                      0,
                    )}{" "}
                    pares
                  </div>
                  <div className="text-[10px] font-bold text-green-700">
                    {fmtBRL(
                      tempPedidoItens[deletingTempItem].grades.reduce(
                        (s, g) => s + totPares(g.qtds),
                        0,
                      ) *
                        (items[tempPedidoItens[deletingTempItem].itemIdx]
                          .custo *
                          (1 - (cab.desconto || 0) / 100)),
                    )}
                  </div>
                </div>
              </div>

              <p className="text-xs text-red-600/80 text-center font-bold mb-5 italic">
                ⚠️ Esta ação não pode ser desfeita.
              </p>

              <div className="flex gap-2">
                <button
                  onClick={() => setDeletingTempItem(null)}
                  className="flex-1 px-3 py-2.5 bg-white border border-slate-300 text-slate-700 font-bold text-[10px] uppercase tracking-wider rounded-xl hover:bg-slate-50 hover:border-slate-400 transition-all shadow-sm"
                >
                  Não, Cancelar
                </button>
                <button
                  onClick={() => handleRemoveTempItem(deletingTempItem)}
                  className="flex-1 px-3 py-2.5 bg-red-600 text-white font-bold text-[10px] uppercase tracking-wider rounded-xl hover:bg-red-700 transition-all shadow-sm flex justify-center items-center gap-1"
                >
                  ❌ Sim, Excluir
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL COTA INSUFICIENTE */}
      {quotaModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden border border-slate-100">
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

  const updateQtd = (gradeIndex: number, size: string, value: number) => {
    setLocalItem((prev) => {
      const copy = { ...prev };
      copy.grades[gradeIndex].qtds[size] = Math.max(0, value);
      return copy;
    });
  };

  const removeGrade = (gradeIndex: number) => {
    setLocalItem((prev) => {
      const copy = { ...prev };
      copy.grades = copy.grades.filter((_, i) => i !== gradeIndex);
      return copy;
    });
  };

  const calculateTotalPares = () => {
    return localItem.grades.reduce((sum, g) => sum + totPares(g.qtds), 0);
  };

  const totalPares = calculateTotalPares();
  const totalCusto =
    totalPares * (itemData.custo * (1 - (cab.desconto || 0) / 100));

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl max-w-xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-4 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold">✏️ Editar Item do Pedido</h3>
            <p className="text-xs opacity-90 truncate max-w-sm">
              Ref: {itemData.ref}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:bg-white/20 rounded-lg w-8 h-8 flex items-center justify-center text-xl"
          >
            ✕
          </button>
        </div>

        <div className="p-4 overflow-y-auto flex-1">
          <div className="bg-slate-50 rounded-lg p-3 border border-slate-200 mb-4">
            <div className="font-bold text-slate-800">
              📦 REFERÊNCIA: {itemData.ref}
            </div>
            <div className="text-xs text-slate-600 mt-1 uppercase">
              DESCRIÇÃO: {itemData.modelo}
            </div>
            <div className="text-xs text-slate-600 uppercase">
              TIPO: {itemData.tipo}
            </div>
            <div className="text-xs text-slate-600 uppercase">
              CUSTO (Líquido):{" "}
              {fmtBRL(itemData.custo * (1 - (cab.desconto || 0) / 100))}
            </div>
          </div>

          <div className="text-sm font-bold text-slate-800 mb-3 border-b border-slate-200 pb-1">
            🔢 GRADES VINCULADAS:
          </div>

          {localItem.grades.length === 0 ? (
            <div className="text-xs italic text-red-500 py-4 text-center">
              Nenhuma grade vinculada. Ao salvar, este item não fará parte do
              pedido.
            </div>
          ) : (
            <div className="space-y-4">
              {localItem.grades.map((grade, gIdx) => {
                const paresDaGrade = totPares(grade.qtds);
                return (
                  <div
                    key={gIdx}
                    className="border border-slate-200 rounded-lg overflow-hidden"
                  >
                    <div className="bg-slate-100 flex justify-between items-center px-3 py-2 border-b border-slate-200">
                      <div className="font-bold text-sm text-slate-800">
                        Grade {grade.letter} ({paresDaGrade}p)
                      </div>
                      <button
                        onClick={() => removeGrade(gIdx)}
                        className="text-red-500 hover:text-red-700 text-xs font-bold uppercase"
                      >
                        Remover Grade
                      </button>
                    </div>
                    <div className="p-3 bg-white flex flex-wrap gap-2 justify-center">
                      {Object.keys(grade.qtds).map((sz) => (
                        <div key={sz} className="w-12 text-center">
                          <label className="block text-[10px] font-bold text-slate-600 mb-1">
                            {sz}
                          </label>
                          <input
                            type="number"
                            min="0"
                            className="w-full text-center border border-slate-300 rounded p-1 text-sm bg-slate-50 focus:bg-white focus:border-blue-500 outline-none"
                            value={grade.qtds[sz] || 0}
                            onChange={(e) =>
                              updateQtd(gIdx, sz, parseInt(e.target.value) || 0)
                            }
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="border-t border-slate-200 p-4 bg-slate-50">
          <div className="flex justify-between items-center mb-4">
            <div className="text-slate-600 text-sm font-medium">
              Total:{" "}
              <strong className="text-slate-900">{totalPares} pares</strong>
            </div>
            <div className="text-slate-600 text-sm font-medium">
              Subtotal:{" "}
              <strong className="text-green-700">{fmtBRL(totalCusto)}</strong>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 text-sm border border-slate-300 bg-white text-slate-700 rounded-lg hover:bg-slate-50 font-bold uppercase"
            >
              Cancelar
            </button>
            <button
              onClick={() => onSave(localItem)}
              className="flex-1 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-bold flex justify-center items-center gap-2 uppercase"
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
      totalValorLiquidoGeral:
        totalValorLiquidoPorLoja * localPedido.lojas.length,
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
                const totalItem = icg.grades.reduce(
                  (s, g) => s + totPares(g.qtds),
                  0,
                );
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
                        {item.tipo}
                      </div>
                      <div className="space-y-1">
                        {icg.grades.map((g) => (
                          <div
                            key={g.letter}
                            className="text-[10px] text-slate-500"
                          >
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
            <div className="text-xs font-bold text-slate-700 uppercase mb-2">
              Lojas ({localPedido.lojas.length})
            </div>
            <div className="flex flex-wrap gap-2">
              {localPedido.lojas.map((loja) => (
                <div
                  key={loja}
                  className="bg-blue-50 border border-blue-300 px-3 py-1.5 rounded-lg flex items-center gap-2"
                >
                  <span className="text-sm font-bold text-blue-800">
                    {loja}
                  </span>
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
