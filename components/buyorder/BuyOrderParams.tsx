import React, { useState, useEffect } from "react";
import { supabase } from "../../services/supabaseClient";
import {
  Settings,
  Check,
  Loader2,
  ChevronRight,
  Search,
  Calendar,
  Plus,
  Trash2,
  Edit2,
  X,
} from "lucide-react";
import { toast } from "sonner";

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENTES DE ADMINISTRAÇÃO DE ALERTAS
// ═══════════════════════════════════════════════════════════════════════════

interface AlertasGradePorLojaProps {
  storeNumber: string;
}

function AlertasGradePorLoja({ storeNumber }: AlertasGradePorLojaProps) {
  const [alertas, setAlertas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editando, setEditando] = useState(false);

  const [categoria, setCategoria] = useState<"INF" | "MASC" | "FEM" | "TODOS">(
    "INF",
  );
  const [tamanhos, setTamanhos] = useState("34, 35, 36");
  const [mensagem, setMensagem] = useState("");

  useEffect(() => {
    carregarAlertas();
  }, [storeNumber]);

  const carregarAlertas = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("buy_store_grade_requirements")
        .select("*")
        .eq("store_id", parseInt(storeNumber))
        .order("categoria");

      if (error) throw error;
      setAlertas(data || []);
    } catch (err) {
      console.error("Erro ao carregar alertas de grade:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSalvar = async () => {
    try {
      const tamanhosArray = tamanhos
        .split(",")
        .map((t) => parseInt(t.trim()))
        .filter((t) => !isNaN(t));

      if (tamanhosArray.length === 0) {
        alert("❌ Digite pelo menos um tamanho válido!");
        return;
      }

      const { error } = await supabase
        .from("buy_store_grade_requirements")
        .upsert(
          {
            store_id: parseInt(storeNumber),
            categoria,
            tamanhos_obrigatorios: tamanhosArray,
            mensagem_customizada: mensagem || null,
            ativo: true,
          },
          {
            onConflict: "store_id,categoria",
          },
        );

      if (error) throw error;

      alert("✅ Requisito de grade salvo!");
      setEditando(false);
      setTamanhos("34, 35, 36");
      setMensagem("");
      carregarAlertas();
    } catch (err: any) {
      console.error("Erro ao salvar:", err);
      alert("❌ Erro: " + err.message);
    }
  };

  const handleDeletar = async (id: string) => {
    if (!confirm("Deletar este requisito de grade?")) return;

    try {
      const { error } = await supabase
        .from("buy_store_grade_requirements")
        .delete()
        .eq("id", id);

      if (error) throw error;

      alert("✅ Requisito deletado!");
      carregarAlertas();
    } catch (err: any) {
      console.error("Erro ao deletar:", err);
      alert("❌ Erro: " + err.message);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-200 dark:border-slate-700 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-widest flex items-center gap-2">
          <span>📍</span> REQUISITOS DE GRADE (LOJA {storeNumber})
        </h4>
        <button
          onClick={() => setEditando(!editando)}
          className="px-3 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-900 text-[10px] font-black uppercase rounded-lg transition-all"
        >
          {editando ? "Cancelar" : "+ Adicionar"}
        </button>
      </div>

      {editando && (
        <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-4 mb-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-black text-slate-500 uppercase mb-1.5 block">
                Categoria
              </label>
              <select
                value={categoria}
                onChange={(e) => setCategoria(e.target.value as any)}
                className="w-full bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs font-black outline-none"
              >
                <option value="INF">Infantil</option>
                <option value="MASC">Masculino</option>
                <option value="FEM">Feminino</option>
                <option value="TODOS">Todos</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-500 uppercase mb-1.5 block">
                Tamanhos (separados por vírgula)
              </label>
              <input
                type="text"
                placeholder="34, 35, 36"
                value={tamanhos}
                onChange={(e) => setTamanhos(e.target.value)}
                className="w-full bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs font-black outline-none"
              />
            </div>
          </div>
          <div>
            <label className="text-[10px] font-black text-slate-500 uppercase mb-1.5 block">
              Mensagem Customizada (opcional)
            </label>
            <input
              type="text"
              placeholder="Loja X precisa desses tamanhos..."
              value={mensagem}
              onChange={(e) => setMensagem(e.target.value)}
              className="w-full bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs font-black outline-none"
            />
          </div>
          <button
            onClick={handleSalvar}
            className="w-full py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-black uppercase rounded-lg transition-all"
          >
            Salvar Requisito
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 size={18} className="animate-spin text-amber-500" />
        </div>
      ) : alertas.length === 0 ? (
        <p className="text-xs text-slate-400 text-center py-4">
          Nenhum requisito configurado
        </p>
      ) : (
        <div className="space-y-2">
          {alertas.map((alerta) => (
            <div
              key={alerta.id}
              className="flex items-center justify-between bg-slate-50 dark:bg-slate-900 rounded-lg p-3 border border-slate-200 dark:border-slate-700"
            >
              <div className="flex-1">
                <p className="text-xs font-black text-slate-900 dark:text-white">
                  {alerta.categoria} → Tamanhos:{" "}
                  {alerta.tamanhos_obrigatorios.join(", ")}
                </p>
                {alerta.mensagem_customizada && (
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    {alerta.mensagem_customizada}
                  </p>
                )}
              </div>
              <button
                onClick={() => handleDeletar(alerta.id)}
                className="px-2 py-1 bg-red-100 hover:bg-red-200 text-red-900 text-[10px] font-black rounded transition-all flex-shrink-0 ml-2"
              >
                Deletar
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENTE 2: Restrições de Marca (Global)
// ═══════════════════════════════════════════════════════════════════════════

function AlertasMarcaGlobal() {
  const [alertas, setAlertas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editando, setEditando] = useState(false);

  const [marca, setMarca] = useState("");
  const [lojas, setLojas] = useState("");
  const [mensagem, setMensagem] = useState("");

  useEffect(() => {
    carregarAlertas();
  }, []);

  const carregarAlertas = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("buy_brand_store_restrictions")
        .select("*")
        .order("marca");

      if (error) throw error;
      setAlertas(data || []);
    } catch (err) {
      console.error("Erro ao carregar restrições de marca:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSalvar = async () => {
    if (!marca.trim() || !lojas.trim()) {
      alert("❌ Preencha marca e lojas!");
      return;
    }

    try {
      const lojasArray = lojas
        .split(",")
        .map((l) => parseInt(l.trim()))
        .filter((l) => !isNaN(l));

      if (lojasArray.length === 0) {
        alert("❌ Digite pelo menos uma loja válida!");
        return;
      }

      const mensagemFinal =
        mensagem ||
        `⛔ NÃO comprar ${marca.toUpperCase()} para lojas ${lojasArray.join(", ")}`;

      const { error } = await supabase
        .from("buy_brand_store_restrictions")
        .upsert(
          {
            marca: marca.trim().toUpperCase(),
            lojas_proibidas: lojasArray,
            mensagem_alerta: mensagemFinal,
            ativo: true,
          },
          {
            onConflict: "marca",
          },
        );

      if (error) throw error;

      alert("✅ Restrição de marca salva!");
      setEditando(false);
      setMarca("");
      setLojas("");
      setMensagem("");
      carregarAlertas();
    } catch (err: any) {
      console.error("Erro ao salvar:", err);
      alert("❌ Erro: " + err.message);
    }
  };

  const handleDeletar = async (id: string) => {
    if (!confirm("Deletar esta restrição de marca?")) return;

    try {
      const { error } = await supabase
        .from("buy_brand_store_restrictions")
        .delete()
        .eq("id", id);

      if (error) throw error;

      alert("✅ Restrição deletada!");
      carregarAlertas();
    } catch (err: any) {
      console.error("Erro ao deletar:", err);
      alert("❌ Erro: " + err.message);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-200 dark:border-slate-700 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-widest flex items-center gap-2">
          <span>⛔</span> RESTRIÇÕES DE MARCA (GLOBAL)
        </h4>
        <button
          onClick={() => setEditando(!editando)}
          className="px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-900 text-[10px] font-black uppercase rounded-lg transition-all"
        >
          {editando ? "Cancelar" : "+ Adicionar"}
        </button>
      </div>

      {editando && (
        <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-4 mb-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-black text-slate-500 uppercase mb-1.5 block">
                Marca
              </label>
              <input
                type="text"
                placeholder="COCA COLA"
                value={marca}
                onChange={(e) => setMarca(e.target.value)}
                className="w-full bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs font-black uppercase outline-none"
              />
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-500 uppercase mb-1.5 block">
                Lojas Proibidas (vírgula)
              </label>
              <input
                type="text"
                placeholder="86, 56, 72"
                value={lojas}
                onChange={(e) => setLojas(e.target.value)}
                className="w-full bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs font-black outline-none"
              />
            </div>
          </div>
          <div>
            <label className="text-[10px] font-black text-slate-500 uppercase mb-1.5 block">
              Mensagem de Alerta (opcional)
            </label>
            <input
              type="text"
              placeholder="⛔ NÃO comprar COCA COLA para lojas..."
              value={mensagem}
              onChange={(e) => setMensagem(e.target.value)}
              className="w-full bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs font-black outline-none"
            />
          </div>
          <button
            onClick={handleSalvar}
            className="w-full py-2.5 bg-red-600 hover:bg-red-700 text-white text-xs font-black uppercase rounded-lg transition-all"
          >
            Salvar Restrição
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 size={18} className="animate-spin text-red-500" />
        </div>
      ) : alertas.length === 0 ? (
        <p className="text-xs text-slate-400 text-center py-4">
          Nenhuma restrição configurada
        </p>
      ) : (
        <div className="space-y-2">
          {alertas.map((alerta) => (
            <div
              key={alerta.id}
              className="flex items-center justify-between bg-slate-50 dark:bg-slate-900 rounded-lg p-3 border border-slate-200 dark:border-slate-700"
            >
              <div className="flex-1">
                <p className="text-xs font-black text-slate-900 dark:text-white">
                  {alerta.marca} → Lojas: {alerta.lojas_proibidas.join(", ")}
                </p>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  {alerta.mensagem_alerta}
                </p>
              </div>
              <button
                onClick={() => handleDeletar(alerta.id)}
                className="px-2 py-1 bg-red-100 hover:bg-red-200 text-red-900 text-[10px] font-black rounded transition-all flex-shrink-0 ml-2"
              >
                Deletar
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENTE 3: Restrições de Produto (Global)
// ═══════════════════════════════════════════════════════════════════════════

function AlertasProdutoGlobal() {
  const [alertas, setAlertas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editando, setEditando] = useState(false);

  const [tipoProduto, setTipoProduto] = useState("");
  const [lojas, setLojas] = useState("");
  const [mensagem, setMensagem] = useState("");

  useEffect(() => {
    carregarAlertas();
  }, []);

  const carregarAlertas = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("buy_product_store_restrictions")
        .select("*")
        .order("tipo_produto");

      if (error) throw error;
      setAlertas(data || []);
    } catch (err) {
      console.error("Erro ao carregar restrições de produto:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSalvar = async () => {
    if (!tipoProduto.trim() || !lojas.trim()) {
      alert("❌ Preencha tipo de produto e lojas!");
      return;
    }

    try {
      const lojasArray = lojas
        .split(",")
        .map((l) => parseInt(l.trim()))
        .filter((l) => !isNaN(l));

      if (lojasArray.length === 0) {
        alert("❌ Digite pelo menos uma loja válida!");
        return;
      }

      const mensagemFinal =
        mensagem ||
        `⛔ Lojas ${lojasArray.join(", ")} NÃO vendem ${tipoProduto.toUpperCase()}`;

      const { error } = await supabase
        .from("buy_product_store_restrictions")
        .upsert(
          {
            tipo_produto: tipoProduto.trim().toUpperCase(),
            lojas_proibidas: lojasArray,
            mensagem_alerta: mensagemFinal,
            ativo: true,
          },
          {
            onConflict: "tipo_produto",
          },
        );

      if (error) throw error;

      alert("✅ Restrição de produto salva!");
      setEditando(false);
      setTipoProduto("");
      setLojas("");
      setMensagem("");
      carregarAlertas();
    } catch (err: any) {
      console.error("Erro ao salvar:", err);
      alert("❌ Erro: " + err.message);
    }
  };

  const handleDeletar = async (id: string) => {
    if (!confirm("Deletar esta restrição de produto?")) return;

    try {
      const { error } = await supabase
        .from("buy_product_store_restrictions")
        .delete()
        .eq("id", id);

      if (error) throw error;

      alert("✅ Restrição deletada!");
      carregarAlertas();
    } catch (err: any) {
      console.error("Erro ao deletar:", err);
      alert("❌ Erro: " + err.message);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-200 dark:border-slate-700 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-widest flex items-center gap-2">
          <span>🚫</span> RESTRIÇÕES DE PRODUTO (GLOBAL)
        </h4>
        <button
          onClick={() => setEditando(!editando)}
          className="px-3 py-1.5 bg-orange-100 hover:bg-orange-200 text-orange-900 text-[10px] font-black uppercase rounded-lg transition-all"
        >
          {editando ? "Cancelar" : "+ Adicionar"}
        </button>
      </div>

      {editando && (
        <div className="bg-orange-50 dark:bg-orange-900/20 rounded-xl p-4 mb-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-black text-slate-500 uppercase mb-1.5 block">
                Tipo de Produto
              </label>
              <input
                type="text"
                placeholder="SCARPIN SALTO FINO"
                value={tipoProduto}
                onChange={(e) => setTipoProduto(e.target.value)}
                className="w-full bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs font-black uppercase outline-none"
              />
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-500 uppercase mb-1.5 block">
                Lojas Proibidas (vírgula)
              </label>
              <input
                type="text"
                placeholder="56, 86"
                value={lojas}
                onChange={(e) => setLojas(e.target.value)}
                className="w-full bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs font-black outline-none"
              />
            </div>
          </div>
          <div>
            <label className="text-[10px] font-black text-slate-500 uppercase mb-1.5 block">
              Mensagem de Alerta (opcional)
            </label>
            <input
              type="text"
              placeholder="⛔ Loja 56 NÃO vende scarpin de salto fino..."
              value={mensagem}
              onChange={(e) => setMensagem(e.target.value)}
              className="w-full bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs font-black outline-none"
            />
          </div>
          <button
            onClick={handleSalvar}
            className="w-full py-2.5 bg-orange-600 hover:bg-orange-700 text-white text-xs font-black uppercase rounded-lg transition-all"
          >
            Salvar Restrição
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 size={18} className="animate-spin text-orange-500" />
        </div>
      ) : alertas.length === 0 ? (
        <p className="text-xs text-slate-400 text-center py-4">
          Nenhuma restrição configurada
        </p>
      ) : (
        <div className="space-y-2">
          {alertas.map((alerta) => (
            <div
              key={alerta.id}
              className="flex items-center justify-between bg-slate-50 dark:bg-slate-900 rounded-lg p-3 border border-slate-200 dark:border-slate-700"
            >
              <div className="flex-1">
                <p className="text-xs font-black text-slate-900 dark:text-white">
                  {alerta.tipo_produto} → Lojas:{" "}
                  {alerta.lojas_proibidas.join(", ")}
                </p>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  {alerta.mensagem_alerta}
                </p>
              </div>
              <button
                onClick={() => handleDeletar(alerta.id)}
                className="px-2 py-1 bg-red-100 hover:bg-red-200 text-red-900 text-[10px] font-black rounded transition-all flex-shrink-0 ml-2"
              >
                Deletar
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TIPOS
// ═══════════════════════════════════════════════════════════════════════════

interface Store {
  store_number: string;
  store_name: string;
  city: string;
  year: number;
  month: number;
  tem_parametros_customizados: boolean;
  cota_total: number;
  despesas_comprometidas: number;
  cota_compra_disponivel: number;
  cota_gerente_valor: number;
  cota_comprador_valor: number;
}

interface StoreParams {
  store_number: string;
  year: number;
  feminino_pct: number;
  infantil_menina_pct: number;
  infantil_menino_pct: number;
  masculino_pct: number;
  acessorio_pct: number;
  cota_valor: number;
  usa_parametros_customizados: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════

export default function BuyOrderParams({ user }: { user: any }) {
  const isAdmin =
    user?.role === "ADMIN" ||
    user?.role === "SUPER_ADMIN" ||
    user?.role === "MANAGER";

  const [stores, setStores] = useState<Store[]>([]);
  const [selectedStore, setSelectedStore] = useState<Store | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);

  const monthNames = [
    "Janeiro",
    "Fevereiro",
    "Março",
    "Abril",
    "Maio",
    "Junho",
    "Julho",
    "Agosto",
    "Setembro",
    "Outubro",
    "Novembro",
    "Dezembro",
  ];

  // Estados do formulário
  const [feminino, setFeminino] = useState(40);
  const [infMenina, setInfMenina] = useState(10);
  const [infMenino, setInfMenino] = useState(10);
  const [masculino, setMasculino] = useState(20);
  const [acessorio, setAcessorio] = useState(20);

  // Calcular ano fiscal rolling (12 meses a partir do mês atual)
  const currentMonth = new Date().getMonth() + 1; // 1-12

  // Função helper para converter índice visual (0-11) em ano/mês real
  const getFiscalYearMonth = (visualIndex: number): { year: number; month: number } => {
    return {
      year: selectedYear,
      month: visualIndex + 1
    };
  };

  interface MonthlyData {
    month: number;
    cotaTotal: number;
    despesas: number;
    cota_disponivel?: number;
  }

  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>(
    Array.from({ length: 12 }).map((_, i) => ({
      month: i + 1,
      cotaTotal: 0,
      despesas: 0,
    })),
  );

  const [cotasDisponiveis, setCotasDisponiveis] = useState<any[]>([]);

  const toNumber = (v: any): number => {
    if (v === null || v === undefined || v === "") return 0;
    const n = typeof v === "string" ? parseFloat(v) : v;
    return isNaN(n) ? 0 : n;
  };

  const formatarMoeda = (valor: any) =>
    toNumber(valor).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });

  if (!isAdmin) {
    return (
      <div style={{ padding: "2rem", textAlign: "center" }}>
        <p>Acesso restrito. Apenas administradores podem configurar cotas.</p>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CARREGAR LOJAS
  // ═══════════════════════════════════════════════════════════════════════════

  useEffect(() => {
    loadStores();
    // Recarregar dados da loja selecionada quando o ano muda
    if (selectedStore) {
      handleOpenStore(selectedStore);
    }
  }, [selectedYear]);

  const loadStores = async () => {
    setLoading(true);
    try {
      // Get all active stores first
      const { data: storesData, error: storesError } = await supabase
        .from("stores")
        .select("number, name, city")
        .eq("status", "active");

      if (storesError) throw storesError;

      // Try to get quota info for the selected year
      const { data: quotaData, error: quotaError } = await supabase
        .from("buyorder_parameters_store")
        .select("store_number, cota_valor")
        .eq("year", selectedYear)
        .gt("cota_valor", 0);

      if (quotaError) {
        console.warn("Erro ao buscar cotas (ignorando):", quotaError);
      }

      // Map everything
      const mappedStores: Store[] = (storesData || []).map((store) => {
        // Conta quantos meses configurados essa loja tem no ano selecionado
        const mesesConfigurados = (quotaData || []).filter(
          (q) => String(q.store_number) === String(store.number)
        ).length;

        return {
          store_number: store.number,
          store_name: store.name,
          city: store.city,
          year: selectedYear,
          month: 1,
          tem_parametros_customizados: mesesConfigurados >= 12,
          cota_total: 0,
          despesas_comprometidas: 0,
          cota_compra_disponivel: 0,
          cota_gerente_valor: 0,
          cota_comprador_valor: 0,
        };
      });

      setStores(
        mappedStores.sort((a, b) => {
          const numA =
            typeof a.store_number === "number"
              ? a.store_number
              : parseInt(String(a.store_number).replace(/\D/g, ""));
          const numB =
            typeof b.store_number === "number"
              ? b.store_number
              : parseInt(String(b.store_number).replace(/\D/g, ""));
          return (numA || 0) - (numB || 0);
        }),
      );
    } catch (err) {
      console.error("Erro ao carregar lojas:", err);
      alert("Erro ao carregar lojas");
    } finally {
      setLoading(false);
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // ABRIR MODAL DE EDIÇÃO
  // ═══════════════════════════════════════════════════════════════════════════

  const handleOpenStore = async (store: Store) => {
    setSelectedStore(store);

    // Se tem parâmetros customizados ou não, carregamos as cotas calculadas do banco
    try {
      // Buscar cotas da VIEW correta
      const { data: cotasView, error: cotasError } = await supabase
        .from("v_cotas_mes_correto")
        .select("*")
        .eq("store_number", store.store_number)
        .eq("year", selectedYear)
        .order("month");

      if (cotasError) {
        console.warn("Erro ao carregar cotas:", cotasError);
      }

      setCotasDisponiveis(cotasView || []);

      // Carregar também os parâmetros brutos para pegar porcentagens anuais e outras flags
      const { data: paramData } = await supabase
        .from("buyorder_parameters_store")
        .select("*")
        .eq("store_number", store.store_number)
        .eq("year", selectedYear);

      if (paramData && paramData.length > 0) {
        // Usar o registro do mês fiscal atual (ou o primeiro encontrado) para as porcentagens globais da loja
        const currentParam = paramData.find(p => p.year === selectedYear && p.month === currentMonth) || paramData[0];
        setFeminino(currentParam.feminino_pct || 40);
        setInfMenina(currentParam.infantil_menina_pct || 10);
        setInfMenino(currentParam.infantil_menino_pct || 10);
        setMasculino(currentParam.masculino_pct || 20);
        setAcessorio(currentParam.acessorio_pct || 20);
      } else {
        // Fallback para globais se não houver customizados
        const { data: globalData } = await supabase
          .from("buyorder_parameters_global")
          .select("*")
          .eq("year", selectedYear);
          
        if (globalData && globalData.length > 0) {
          const currentGlobal = globalData.find(g => g.year === selectedYear) || globalData[0];
          setFeminino(currentGlobal.feminino_pct || 40);
          setInfMenina(currentGlobal.infantil_menina_pct || 10);
          setInfMenino(currentGlobal.infantil_menino_pct || 10);
          setMasculino(currentGlobal.masculino_pct || 20);
          setAcessorio(currentGlobal.acessorio_pct || 20);
        }
      }

      if (cotasView && cotasView.length > 0) {
        const newMonthly = Array.from({ length: 12 }).map((_, i) => {
          const fiscal = getFiscalYearMonth(i);
          const q = cotasView.find((x: any) => x.month === fiscal.month && x.year === fiscal.year);
          
          if (!q) {
            return {
              month: fiscal.month,
              cotaTotal: 0,
              despesas: 0,
            };
          }
          
          return {
            month: fiscal.month,
            cotaTotal: Number(q.cota_bruta || q.cota_valor || 0),
            despesas: Number(q.despesas_comprometidas || 0),
            cota_disponivel: Number(q.cota_maio_livre || q.disponivel_real || 0),
          };
        });
        setMonthlyData(newMonthly);
      }
    } catch (err) {
      console.error("Erro ao carregar cotas/parâmetros:", err);
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // ATUALIZAR MÊS ESPECÍFICO
  // ═══════════════════════════════════════════════════════════════════════════

  const handleUpdateMonth = (
    monthIndex: number,
    field: keyof MonthlyData,
    value: any,
  ) => {
    setMonthlyData((prev) => {
      const newArray = [...prev];
      newArray[monthIndex] = { ...newArray[monthIndex], [field]: value };
      return newArray;
    });
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // SALVAR PARÂMETROS
  // ═══════════════════════════════════════════════════════════════════════════

  const handleSave = async () => {
    if (!selectedStore) return;

    // Validar
    const totalMetas = feminino + infMenina + infMenino + masculino + acessorio;

    if (Math.abs(totalMetas - 100) > 0.01) {
      alert("A soma das metas deve ser 100%");
      return;
    }

    setSaving(true);
    try {
      const payloads = monthlyData.map((m, visualIndex) => {
        const fiscal = getFiscalYearMonth(visualIndex);
        
        return {
          store_number: selectedStore.store_number,
          year: fiscal.year,
          month: fiscal.month,
          feminino_pct: feminino,
          infantil_menina_pct: infMenina,
          infantil_menino_pct: infMenino,
          masculino_pct: masculino,
          acessorio_pct: acessorio,
          cota_valor: m.cotaTotal,
          usa_parametros_customizados: true,
          usar_cota_fixa: false,
          cota_gerente_fixa: null,
        };
      });

      const { error } = await supabase
        .from("buyorder_parameters_store")
        .upsert(payloads, {
          onConflict: "store_number,year,month",
        });

      if (error) throw error;
      
      // ✅ TRIGGER AUTOMÁTICO sincroniza buyorder_quota_control
      toast.success(`✅ Parâmetros salvos com sucesso!`);

      // ✅ ADICIONAR: recarregar lista de lojas para atualizar indicadores (bolinha verde, valores)
      await loadStores();

      // ✅ ADICIONAR: recarregar os dados do mês atual na grid
      if (selectedStore) {
        await handleOpenStore(selectedStore);
      }
    } catch (err: any) {
      console.error("Erro ao salvar:", err);
      alert("❌ Erro ao salvar: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // RESETAR PARA GLOBAL
  // ═══════════════════════════════════════════════════════════════════════════

  const handleResetToGlobal = async () => {
    if (!selectedStore) return;

    if (
      !confirm(
        "Tem certeza que deseja usar os parâmetros globais para esta loja?",
      )
    ) {
      return;
    }

    try {
      const { error } = await supabase.rpc("reset_store_to_global", {
        p_store_number: selectedStore.store_number,
        p_year: selectedYear,
      });

      if (error) throw error;

      alert("✅ Loja configurada para usar parâmetros globais!");
      setSelectedStore(null);
      loadStores();
    } catch (err: any) {
      console.error("Erro:", err);
      alert("❌ Erro: " + err.message);
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // FILTRAR LOJAS
  // ═══════════════════════════════════════════════════════════════════════════

  const filteredStores = stores
    .filter(
      (s) =>
        s.store_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.store_number.includes(searchTerm) ||
        s.city.toLowerCase().includes(searchTerm.toLowerCase()),
    )
    .sort((a, b) => {
      const numA =
        typeof a.store_number === "number"
          ? a.store_number
          : parseInt(a.store_number.toString().replace(/\D/g, ""));
      const numB =
        typeof b.store_number === "number"
          ? b.store_number
          : parseInt(b.store_number.toString().replace(/\D/g, ""));
      return (numA || 0) - (numB || 0);
    });

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={32} className="animate-spin text-orange-500" />
      </div>
    );
  }

  const totalMetas = feminino + infMenina + infMenino + masculino + acessorio;
  const isMetasValid = Math.abs(totalMetas - 100) < 0.01;

  // Estado mobile: mostrar lista ou edição
  const [mobileView, setMobileView] = React.useState<'list' | 'edit'>('list');

  const handleOpenStoreMobile = async (store: Store) => {
    await handleOpenStore(store);
    setMobileView('edit');
  };

  return (
    <div className="w-full max-w-5xl mx-auto flex flex-col bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">

      {/* ── HEADER ── */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800 gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          {/* Botão voltar — só mobile quando está editando */}
          {selectedStore && (
            <button
              onClick={() => { setMobileView('list'); setSelectedStore(null); }}
              className="sm:hidden p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500"
            >
              ←
            </button>
          )}
          <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-xl">
            <Settings size={18} className="text-orange-600 dark:text-orange-400" />
          </div>
          <div>
            <h2 className="text-sm font-black text-slate-900 dark:text-white uppercase">
              {selectedStore && mobileView === 'edit'
                ? `Loja ${selectedStore.store_number} · ${selectedStore.city}`
                : 'Parâmetros de Compra'}
            </h2>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest hidden sm:block">
              Clique em uma loja para editar
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700">
          <Calendar size={14} className="text-slate-400" />
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="bg-transparent text-sm font-black text-slate-700 dark:text-slate-300 outline-none cursor-pointer"
          >
            {[2025, 2026, 2027, 2028].map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      </div>

      {/* ── BODY: lado a lado desktop, abas mobile ── */}
      <div className="flex flex-1 min-h-0">

        {/* Lista de lojas — sempre visível no desktop, só visível no mobile quando mobileView=list */}
        <div className={`
          w-full sm:w-64 sm:flex flex-col border-r border-slate-200 dark:border-slate-800 flex-shrink-0
          ${mobileView === 'edit' ? 'hidden sm:flex' : 'flex'}
        `}>
          <div className="p-3 border-b border-slate-200 dark:border-slate-800">
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar loja..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-lg pl-8 pr-3 py-2 text-xs font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-orange-500/50"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto max-h-[60vh] sm:max-h-none">
            {filteredStores.map((store) => {
              const isSel = selectedStore?.store_number === store.store_number;
              return (
                <button
                  key={store.store_number}
                  onClick={() => handleOpenStoreMobile(store)}
                  className={`w-full text-left px-4 py-3 flex items-center justify-between gap-2 transition-all border-b border-slate-100 dark:border-slate-800 border-l-4 ${
                    isSel
                      ? 'bg-orange-50 dark:bg-orange-900/20 border-l-orange-500'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800 border-l-transparent'
                  }`}
                >
                  <div className="min-w-0">
                    <p className={`text-xs font-black uppercase truncate ${isSel ? 'text-orange-600' : 'text-slate-700 dark:text-slate-300'}`}>
                      Loja {store.store_number}
                    </p>
                    <p className="text-[10px] font-bold text-slate-400 truncate">{store.city}</p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {store.tem_parametros_customizados && (
                      <div className="w-2 h-2 rounded-full bg-emerald-400" />
                    )}
                    <ChevronRight size={13} className={isSel ? 'text-orange-500' : 'text-slate-300'} />
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Painel de edição — sempre visível no desktop, só visível no mobile quando mobileView=edit */}
        <div className={`
          flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-50/50 dark:bg-slate-900/50
          ${mobileView === 'list' ? 'hidden sm:block' : 'block'}
        `}>
          {!selectedStore ? (
            <div className="flex flex-col items-center justify-center h-48 text-center gap-3">
              <Settings size={32} className="text-slate-300 dark:text-slate-600" />
              <p className="text-sm font-black text-slate-400 uppercase italic">Selecione uma loja</p>
            </div>
          ) : (
            <div className="space-y-5 max-w-2xl mx-auto pb-16">

              {/* Título loja — só desktop (mobile está no header) */}
              <div className="hidden sm:block">
                <h3 className="text-base font-black text-slate-900 dark:text-white uppercase italic">
                  Loja {selectedStore.store_number} — {selectedStore.store_name}
                </h3>
                <p className="text-xs font-bold text-slate-400 mt-0.5">
                  {selectedStore.city.toUpperCase()} · {selectedYear}
                </p>
              </div>

              {/* Metas por Categoria */}
              <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-200 dark:border-slate-700 shadow-sm">
                <h4 className="text-[10px] font-black text-slate-900 dark:text-white uppercase tracking-widest mb-4 flex items-center gap-2">
                  📊 METAS POR CATEGORIA (%)
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'Feminino',    val: feminino,   set: setFeminino },
                    { label: 'Masculino',   val: masculino,  set: setMasculino },
                    { label: 'Inf. Menina', val: infMenina,  set: setInfMenina },
                    { label: 'Inf. Menino', val: infMenino,  set: setInfMenino },
                    { label: 'Acessórios',  val: acessorio,  set: setAcessorio },
                    { label: 'Total',       val: null,       set: null },
                  ].map((f) =>
                    f.val === null ? (
                      <div key="total">
                        <label className="text-[9px] font-black text-slate-400 uppercase mb-1 block">Total</label>
                        <div className={`w-full border-2 rounded-xl px-3 py-2.5 text-sm font-black text-center ${isMetasValid ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
                          {totalMetas.toFixed(1)}%
                        </div>
                      </div>
                    ) : (
                      <div key={f.label}>
                        <label className="text-[9px] font-black text-slate-400 uppercase mb-1 block">{f.label}</label>
                        <input
                          type="number" inputMode="decimal" step="0.1" min="0" max="100"
                          value={f.val || ''}
                          onChange={(e) => f.set!(e.target.value === '' ? 0 : Number(e.target.value))}
                          className="w-full bg-slate-50 dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 focus:border-orange-400 rounded-xl px-3 py-2.5 text-sm font-black text-slate-900 dark:text-white outline-none transition-all"
                        />
                      </div>
                    )
                  )}
                </div>
              </div>

              {/* Cotas Mensais */}
              <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700">
                  <h4 className="text-[10px] font-black text-slate-900 dark:text-white uppercase tracking-widest">
                    💰 COTAS MENSAIS
                  </h4>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse" style={{ minWidth: '340px' }}>
                    <thead>
                      <tr className="border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                        <th className="text-[9px] font-black text-slate-400 uppercase tracking-wider px-3 py-2 text-left">Mês</th>
                        <th className="text-[9px] font-black text-slate-400 uppercase tracking-wider px-3 py-2 text-right">Cota Total</th>
                        <th className="text-[9px] font-black text-slate-400 uppercase tracking-wider px-3 py-2 text-right">Despesas</th>
                        <th className="text-[9px] font-black text-slate-400 uppercase tracking-wider px-3 py-2 text-right">Disponível</th>
                      </tr>
                    </thead>
                    <tbody>
                      {monthlyData.map((data, index) => {
                        const fiscal = getFiscalYearMonth(index);
                        const disponivel = data.cota_disponivel ?? (toNumber(data.cotaTotal) - toNumber(data.despesas));
                        const isNeg = disponivel < 0;
                        return (
                          <tr key={index} className="border-b border-slate-50 dark:border-slate-800/50 hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors">
                            <td className="px-3 py-2">
                              <span className="text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase whitespace-nowrap">
                                {monthNames[fiscal.month - 1].slice(0,3)}/{String(fiscal.year).slice(-2)}
                              </span>
                            </td>
                            <td className="px-3 py-2">
                              <input
                                type="number" inputMode="decimal" step="1000" min="0"
                                value={data.cotaTotal || ''}
                                onChange={(e) => handleUpdateMonth(index, 'cotaTotal', e.target.value === '' ? 0 : Number(e.target.value))}
                                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 text-[11px] font-black outline-none focus:border-orange-400 text-slate-900 dark:text-white text-right"
                              />
                            </td>
                            <td className="px-3 py-2">
                              <div className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 text-[11px] font-black text-slate-500 text-right whitespace-nowrap">
                                {data.despesas > 0 ? formatarMoeda(data.despesas) : '—'}
                              </div>
                            </td>
                            <td className="px-3 py-2">
                              <div className={`w-full rounded-lg px-2 py-1.5 text-[11px] font-black text-right whitespace-nowrap border ${
                                isNeg
                                  ? 'bg-red-50 border-red-200 text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-300'
                                  : 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-900/20 dark:border-emerald-800 dark:text-emerald-300'
                              }`}>
                                {formatarMoeda(disponivel)}
                                {isNeg && <span className="block text-[8px] font-black uppercase">⚠️ Estourado</span>}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Alertas */}
              <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
                <h4 className="text-[10px] font-black text-slate-900 dark:text-white uppercase tracking-widest border-b border-slate-100 dark:border-slate-700 pb-3">
                  🔔 ADMINISTRAÇÃO DE ALERTAS
                </h4>
                <div className="space-y-5">
                  <AlertasGradePorLoja storeNumber={selectedStore.store_number} />
                  <AlertasMarcaGlobal />
                  <AlertasProdutoGlobal />
                </div>
              </div>

              {/* Ações */}
              <div className="flex gap-3">
                <button
                  onClick={handleResetToGlobal}
                  className="flex-1 py-3.5 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-black uppercase text-xs rounded-2xl border-2 border-slate-200 dark:border-slate-700 hover:bg-slate-50 transition-all active:scale-95"
                >
                  Restaurar Padrão
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-[2] flex items-center justify-center gap-2 py-3.5 bg-orange-600 hover:bg-orange-700 text-white font-black uppercase text-xs rounded-2xl border-b-4 border-orange-800 transition-all active:scale-95 disabled:opacity-50"
                >
                  {saving ? <Loader2 size={16} className="animate-spin" /> : <><Check size={16} /> Salvar Parâmetros</>}
                </button>
              </div>

            </div>
          )}
        </div>
      </div>
    </div>
  );
}
