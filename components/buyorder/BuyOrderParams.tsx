import React, { useState, useEffect, useMemo } from "react";
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
  Tag,
} from "lucide-react";
import { toast } from "sonner";

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENTES DE ADMINISTRAÇÃO DE ALERTAS
// ═══════════════════════════════════════════════════════════════════════════

interface AlertasGradePorLojaProps {
  storeNumber: string;
  readOnly?: boolean;
}

export function AlertasGradePorLoja({ storeNumber, readOnly }: AlertasGradePorLojaProps) {
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
        {!readOnly && (
          <button
            onClick={() => setEditando(!editando)}
            className="px-3 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-900 text-[10px] font-black uppercase rounded-lg transition-all"
          >
            {editando ? "Cancelar" : "+ Adicionar"}
          </button>
        )}
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
              {!readOnly && (
                <button
                  onClick={() => handleDeletar(alerta.id)}
                  className="px-2 py-1 bg-red-100 hover:bg-red-200 text-red-900 text-[10px] font-black rounded transition-all flex-shrink-0 ml-2"
                >
                  Deletar
                </button>
              )}
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

export function AlertasMarcaGlobal({ readOnly }: { readOnly?: boolean }) {
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
        {!readOnly && (
          <button
            onClick={() => setEditando(!editando)}
            className="px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-900 text-[10px] font-black uppercase rounded-lg transition-all"
          >
            {editando ? "Cancelar" : "+ Adicionar"}
          </button>
        )}
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
              {!readOnly && (
                <button
                  onClick={() => handleDeletar(alerta.id)}
                  className="px-2 py-1 bg-red-100 hover:bg-red-200 text-red-900 text-[10px] font-black rounded transition-all flex-shrink-0 ml-2"
                >
                  Deletar
                </button>
              )}
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

export function AlertasProdutoGlobal({ readOnly }: { readOnly?: boolean }) {
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
        {!readOnly && (
          <button
            onClick={() => setEditando(!editando)}
            className="px-3 py-1.5 bg-orange-100 hover:bg-orange-200 text-orange-900 text-[10px] font-black uppercase rounded-lg transition-all"
          >
            {editando ? "Cancelar" : "+ Adicionar"}
          </button>
        )}
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
              {!readOnly && (
                <button
                  onClick={() => handleDeletar(alerta.id)}
                  className="px-2 py-1 bg-red-100 hover:bg-red-200 text-red-900 text-[10px] font-black rounded transition-all flex-shrink-0 ml-2"
                >
                  Deletar
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function AlertasMarcaStore({ storeNumber, readOnly }: { storeNumber: string; readOnly?: boolean }) {
  const [alertas, setAlertas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editando, setEditando] = useState(false);

  const [marca, setMarca] = useState("");
  const [mensagem, setMensagem] = useState("");

  useEffect(() => {
    carregarAlertas();
  }, [storeNumber]);

  const carregarAlertas = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("buy_brand_store_restrictions")
        .select("*")
        .order("marca");

      if (error) throw error;

      // Filter in frontend
      const filtered = (data || []).filter(item => 
        Array.isArray(item.lojas_proibidas) && item.lojas_proibidas.map(Number).includes(Number(storeNumber))
      );

      setAlertas(filtered);
    } catch (err) {
      console.error("Erro ao carregar restrições de marca para loja:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSalvar = async () => {
    if (!marca.trim()) {
      alert("❌ Preencha a marca!");
      return;
    }

    try {
      const { data: existingBrand } = await supabase
        .from("buy_brand_store_restrictions")
        .select("*")
        .eq("marca", marca.trim().toUpperCase())
        .maybeSingle();

      let lojasArray = [Number(storeNumber)];
      if (existingBrand && Array.isArray(existingBrand.lojas_proibidas)) {
        const current = existingBrand.lojas_proibidas.map(Number);
        if (!current.includes(Number(storeNumber))) {
          lojasArray = [...current, Number(storeNumber)];
        } else {
          lojasArray = current;
        }
      }

      const mensagemFinal = mensagem || `⛔ NÃO comprar ${marca.toUpperCase()} para a Loja ${storeNumber}`;

      const { error } = await supabase
        .from("buy_brand_store_restrictions")
        .upsert(
          {
            id: existingBrand?.id, // Use existing id if found for update
            marca: marca.trim().toUpperCase(),
            lojas_proibidas: lojasArray,
            mensagem_alerta: mensagemFinal,
            ativo: true,
          },
          {
            onConflict: "marca",
          }
        );

      if (error) throw error;

      alert("✅ Restrição de marca salva para a Loja " + storeNumber);
      setEditando(false);
      setMarca("");
      setMensagem("");
      carregarAlertas();
    } catch (err: any) {
      console.error("Erro ao salvar restrição de marca:", err);
      alert("❌ Erro: " + err.message);
    }
  };

  const handleDeletar = async (alerta: any) => {
    if (!confirm(`Remover restrição da marca ${alerta.marca} para a Loja ${storeNumber}?`)) return;

    try {
      const currentLojas = Array.isArray(alerta.lojas_proibidas) ? alerta.lojas_proibidas.map(Number) : [];
      const updatedLojas = currentLojas.filter(l => l !== Number(storeNumber));

      if (updatedLojas.length === 0) {
        // Delete completely
        const { error } = await supabase
          .from("buy_brand_store_restrictions")
          .delete()
          .eq("id", alerta.id);
        if (error) throw error;
      } else {
        // Update keeping other stores
        const { error } = await supabase
          .from("buy_brand_store_restrictions")
          .update({ lojas_proibidas: updatedLojas })
          .eq("id", alerta.id);
        if (error) throw error;
      }

      alert("✅ Restrição removida!");
      carregarAlertas();
    } catch (err: any) {
      console.error("Erro ao remover restrição:", err);
      alert("❌ Erro: " + err.message);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-200 dark:border-slate-700 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-widest flex items-center gap-2">
          <span>⛔</span> RESTRIÇÕES DE MARCA (LOJA {storeNumber})
        </h4>
        {!readOnly && (
          <button
            onClick={() => setEditando(!editando)}
            className="px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-900 text-[10px] font-black uppercase rounded-lg transition-all"
          >
            {editando ? "Cancelar" : "+ Adicionar"}
          </button>
        )}
      </div>

      {editando && (
        <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-4 mb-4 space-y-3">
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
              Mensagem de Alerta (opcional)
            </label>
            <input
              type="text"
              placeholder={`⛔ NÃO comprar COCA COLA para a Loja ${storeNumber}`}
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
          Nenhuma restrição configurada para esta loja
        </p>
      ) : (
        <div className="space-y-2">
          {alertas.map((alerta) => (
            <div
              key={alerta.id}
              className="flex items-center justify-between bg-slate-50 dark:bg-slate-900 rounded-lg p-3 border border-slate-200 dark:border-slate-700"
            >
              <div className="flex-1">
                <p className="text-xs font-black text-slate-900 dark:text-white uppercase">
                  {alerta.marca}
                </p>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  {alerta.mensagem_alerta}
                </p>
              </div>
              {!readOnly && (
                <button
                  onClick={() => handleDeletar(alerta)}
                  className="px-2 py-1 bg-red-100 hover:bg-red-200 text-red-900 text-[10px] font-black rounded transition-all flex-shrink-0 ml-2"
                >
                  Remover
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function AlertasProdutoStore({ storeNumber, readOnly }: { storeNumber: string; readOnly?: boolean }) {
  const [alertas, setAlertas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editando, setEditando] = useState(false);

  const [tipoProduto, setTipoProduto] = useState("");
  const [mensagem, setMensagem] = useState("");

  useEffect(() => {
    carregarAlertas();
  }, [storeNumber]);

  const carregarAlertas = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("buy_product_store_restrictions")
        .select("*")
        .order("tipo_produto");

      if (error) throw error;

      // Filter in frontend
      const filtered = (data || []).filter(item => 
        Array.isArray(item.lojas_proibidas) && item.lojas_proibidas.map(Number).includes(Number(storeNumber))
      );

      setAlertas(filtered);
    } catch (err) {
      console.error("Erro ao carregar restrições de produto para loja:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSalvar = async () => {
    if (!tipoProduto.trim()) {
      alert("❌ Preencha o tipo de produto!");
      return;
    }

    try {
      const { data: existingProduct } = await supabase
        .from("buy_product_store_restrictions")
        .select("*")
        .eq("tipo_produto", tipoProduto.trim().toUpperCase())
        .maybeSingle();

      let lojasArray = [Number(storeNumber)];
      if (existingProduct && Array.isArray(existingProduct.lojas_proibidas)) {
        const current = existingProduct.lojas_proibidas.map(Number);
        if (!current.includes(Number(storeNumber))) {
          lojasArray = [...current, Number(storeNumber)];
        } else {
          lojasArray = current;
        }
      }

      const mensagemFinal = mensagem || `⛔ Loja ${storeNumber} NÃO vende ${tipoProduto.toUpperCase()}`;

      const { error } = await supabase
        .from("buy_product_store_restrictions")
        .upsert(
          {
            id: existingProduct?.id, // Use existing id if found for update
            tipo_produto: tipoProduto.trim().toUpperCase(),
            lojas_proibidas: lojasArray,
            mensagem_alerta: mensagemFinal,
            ativo: true,
          },
          {
            onConflict: "tipo_produto",
          }
        );

      if (error) throw error;

      alert("✅ Restrição de produto salva para a Loja " + storeNumber);
      setEditando(false);
      setTipoProduto("");
      setMensagem("");
      carregarAlertas();
    } catch (err: any) {
      console.error("Erro ao salvar restrição de produto:", err);
      alert("❌ Erro: " + err.message);
    }
  };

  const handleDeletar = async (alerta: any) => {
    if (!confirm(`Remover restrição do produto ${alerta.tipo_produto} para a Loja ${storeNumber}?`)) return;

    try {
      const currentLojas = Array.isArray(alerta.lojas_proibidas) ? alerta.lojas_proibidas.map(Number) : [];
      const updatedLojas = currentLojas.filter(l => l !== Number(storeNumber));

      if (updatedLojas.length === 0) {
        // Delete completely
        const { error } = await supabase
          .from("buy_product_store_restrictions")
          .delete()
          .eq("id", alerta.id);
        if (error) throw error;
      } else {
        // Update keeping other stores
        const { error } = await supabase
          .from("buy_product_store_restrictions")
          .update({ lojas_proibidas: updatedLojas })
          .eq("id", alerta.id);
        if (error) throw error;
      }

      alert("✅ Restrição removida!");
      carregarAlertas();
    } catch (err: any) {
      console.error("Erro ao remover restrição:", err);
      alert("❌ Erro: " + err.message);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-200 dark:border-slate-700 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-widest flex items-center gap-2">
          <span>🚫</span> RESTRIÇÕES DE PRODUTO (LOJA {storeNumber})
        </h4>
        {!readOnly && (
          <button
            onClick={() => setEditando(!editando)}
            className="px-3 py-1.5 bg-orange-100 hover:bg-orange-200 text-orange-900 text-[10px] font-black uppercase rounded-lg transition-all"
          >
            {editando ? "Cancelar" : "+ Adicionar"}
          </button>
        )}
      </div>

      {editando && (
        <div className="bg-orange-50 dark:bg-orange-900/20 rounded-xl p-4 mb-4 space-y-3">
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
              Mensagem de Alerta (opcional)
            </label>
            <input
              type="text"
              placeholder={`⛔ Loja ${storeNumber} NÃO vende scarpin de salto fino...`}
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
          Nenhuma restrição de produto para esta loja
        </p>
      ) : (
        <div className="space-y-2">
          {alertas.map((alerta) => (
            <div
              key={alerta.id}
              className="flex items-center justify-between bg-slate-50 dark:bg-slate-900 rounded-lg p-3 border border-slate-200 dark:border-slate-700"
            >
              <div className="flex-1">
                <p className="text-xs font-black text-slate-900 dark:text-white uppercase">
                  {alerta.tipo_produto}
                </p>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  {alerta.mensagem_alerta}
                </p>
              </div>
              {!readOnly && (
                <button
                  onClick={() => handleDeletar(alerta)}
                  className="px-2 py-1 bg-red-100 hover:bg-red-200 text-red-900 text-[10px] font-black rounded transition-all flex-shrink-0 ml-2"
                >
                  Remover
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function BuyOrderParams({
  user,
  readOnly,
  realizedSubtypes,
  selectedStoreNumber,
  selectedYear,
  selectedMonth
}: {
  user: any;
  readOnly?: boolean;
  realizedSubtypes?: Map<string, { pares: number; valor: number }>;
  selectedStoreNumber?: string;
  selectedYear?: number;
  selectedMonth?: number;
}) {
  const storeNum = selectedStoreNumber || "5";
  const year = selectedYear || new Date().getFullYear();
  const month = selectedMonth || (new Date().getMonth() + 1);

  const isReadOnly = readOnly !== undefined ? readOnly : (user?.role?.toUpperCase() !== "ADMIN" && user?.role?.toUpperCase() !== "SUPER_ADMIN");

  // Category values
  const [feminino, setFeminino] = useState(40);
  const [infMenina, setInfMenina] = useState(10);
  const [infMenino, setInfMenino] = useState(10);
  const [masculino, setMasculino] = useState(20);
  const [acessorio, setAcessorio] = useState(20);
  
  // Extra DB fields we want to preserve
  const [existingRecord, setExistingRecord] = useState<any | null>(null);
  
  // Loading & Saving states
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Subcategories values
  const [subcategories, setSubcategories] = useState<Record<string, Record<string, number>>>({
    FEMININO: {},
    MASCULINO: {},
    INFANTIL: {},
    ACESSÓRIO: {}
  });

  const [categoriesSubtypes, setCategoriesSubtypes] = useState<Record<string, string[]>>({
    FEMININO: ['Scarpin', 'Botas', 'Tênis', 'Sapatilha', 'Sandálias', 'Papete', 'Tamanco', 'Casuais', 'Chinelo'],
    MASCULINO: ['Tênis', 'Sapato', 'Sapatênis', 'Chinelos', 'Botas', 'Casual'],
    INFANTIL: ['Tênis', 'Sandália', 'Bota', 'Sapatilha', 'Papete', 'Tamanco', 'Casuais', 'Chinelo'],
    ACESSÓRIO: ['Malas', 'Relógios', 'Bolsas', 'Meias']
  });

  // Helper function to render subtipo icon/emoji
  const renderSubtipoIcon = (sub: string) => {
    const name = sub.toLowerCase().trim();
    if (name.includes('scarpin')) return '👠';
    if (name.includes('bota')) return '👢';
    if (name.includes('tênis') || name.includes('tenis')) return '👟';
    if (name.includes('sapatilha')) return '🥿';
    if (name.includes('sandália') || name.includes('sandalias') || name.includes('sandálias') || name.includes('sandalia')) return '👡';
    if (name.includes('tamanco')) return '🩴';
    if (name.includes('chinelo')) return '🩴';
    if (name.includes('sapato')) return '👞';
    if (name.includes('papete')) return '🩴';
    if (name.includes('mala')) return '🧳';
    if (name.includes('relógio') || name.includes('relogio')) return '⌚';
    if (name.includes('bolsa')) return '👜';
    if (name.includes('meia')) return '🧦';
    if (name.includes('bola esportiva') || name.includes('bola')) return '⚽';
    if (name.includes('equipamento de futebol') || name.includes('equipamento')) return '🥅';
    if (name.includes('proteção esportiva') || name.includes('protecao')) return '🛡️';
    if (name.includes('óculos') || name.includes('oculos')) return '🕶️';
    if (name.includes('carteira')) return '👛';
    if (name.includes('necessaire')) return '🧴';
    if (name.includes('mochila')) return '🎒';
    if (name.includes('vestuário') || name.includes('vestuario')) return '👕';
    
    if (name.includes('cinto')) {
      return <Tag className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 inline" />;
    }
    
    return '📦';
  };

  const MONTH_NAMES = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
  ];

  // Fetch category parameters & subcategory parameters whenever filters change
  useEffect(() => {
    loadParameters();
  }, [storeNum, year, month]);

  const loadParameters = async () => {
    setLoading(true);
    try {
      // 1. Fetch from buyorder_parameters_store
      const { data: paramData, error: paramError } = await supabase
        .from("buyorder_parameters_store")
        .select("*")
        .eq("store_number", storeNum)
        .eq("year", year)
        .eq("month", month)
        .maybeSingle();

      if (paramError) throw paramError;

      if (paramData) {
        setExistingRecord(paramData);
        setFeminino(Number(paramData.feminino_pct || 0));
        setInfMenina(Number(paramData.infantil_menina_pct || 0));
        setInfMenino(Number(paramData.infantil_menino_pct || 0));
        setMasculino(Number(paramData.masculino_pct || 0));
        setAcessorio(Number(paramData.acessorio_pct || 0));
      } else {
        // Fallback to global parameters
        setExistingRecord(null);
        const { data: globalData } = await supabase
          .from("buyorder_parameters_global")
          .select("*")
          .eq("year", year)
          .maybeSingle();

        if (globalData) {
          setFeminino(Number(globalData.feminino_pct || 40));
          setInfMenina(Number(globalData.infantil_menina_pct || 10));
          setInfMenino(Number(globalData.infantil_menino_pct || 10));
          setMasculino(Number(globalData.masculino_pct || 20));
          setAcessorio(Number(globalData.acessorio_pct || 20));
        } else {
          // Hard fallbacks
          setFeminino(40);
          setInfMenina(10);
          setInfMenino(10);
          setMasculino(20);
          setAcessorio(20);
        }
      }

      // Fetch dynamic subtipos from buy_tipo_subtipo_map
      const { data: mapData, error: mapError } = await supabase
        .from('buy_tipo_subtipo_map')
        .select('categoria, subtipo');

      let dynamicSubtypes: Record<string, string[]> = {
        FEMININO: [],
        MASCULINO: [],
        INFANTIL: [],
        ACESSÓRIO: []
      };

      if (!mapError && mapData) {
        const temp: Record<string, Set<string>> = {
          FEMININO: new Set(),
          MASCULINO: new Set(),
          INFANTIL: new Set(),
          ACESSÓRIO: new Set()
        };

        mapData.forEach((row: any) => {
          if (row.subtipo && row.categoria) {
            const catUI = row.categoria === 'ACESSORIO' ? 'ACESSÓRIO' : row.categoria.toUpperCase().trim();
            if (temp[catUI]) {
              temp[catUI].add(row.subtipo.trim());
            }
          }
        });

        // Convert Sets to arrays, sort alphabetically, and union with hardcoded baseline to always be additive!
        const baseline: Record<string, string[]> = {
          FEMININO: ['Scarpin', 'Botas', 'Tênis', 'Sapatilha', 'Sandálias', 'Papete', 'Tamanco', 'Casuais', 'Chinelo'],
          MASCULINO: ['Tênis', 'Sapato', 'Sapatênis', 'Chinelos', 'Botas', 'Casual'],
          INFANTIL: ['Tênis', 'Sandália', 'Bota', 'Sapatilha', 'Papete', 'Tamanco', 'Casuais', 'Chinelo'],
          ACESSÓRIO: ['Malas', 'Relógios', 'Bolsas', 'Meias']
        };

        Object.keys(temp).forEach(cat => {
          const unionSet = new Set([...baseline[cat], ...Array.from(temp[cat])]);
          dynamicSubtypes[cat] = Array.from(unionSet).sort();
        });
      } else {
        if (mapError) console.error("Erro ao carregar subtipos do banco:", mapError);
        dynamicSubtypes = {
          FEMININO: ['Scarpin', 'Botas', 'Tênis', 'Sapatilha', 'Sandálias', 'Papete', 'Tamanco', 'Casuais', 'Chinelo'],
          MASCULINO: ['Tênis', 'Sapato', 'Sapatênis', 'Chinelos', 'Botas', 'Casual'],
          INFANTIL: ['Tênis', 'Sandália', 'Bota', 'Sapatilha', 'Papete', 'Tamanco', 'Casuais', 'Chinelo'],
          ACESSÓRIO: ['Malas', 'Relógios', 'Bolsas', 'Meias']
        };
      }

      setCategoriesSubtypes(dynamicSubtypes);

      // 2. Fetch subcategory parameters
      const { data: subData, error: subError } = await supabase
        .from('buyorder_subcategory_params')
        .select('*')
        .eq('store_number', storeNum)
        .eq('year', year)
        .eq('month', month);

      if (subError) throw subError;

      const newParams: Record<string, Record<string, number>> = {
        FEMININO: {},
        MASCULINO: {},
        INFANTIL: {},
        ACESSÓRIO: {}
      };

      // Initialize with 0
      Object.entries(dynamicSubtypes).forEach(([cat, subs]) => {
        subs.forEach(sub => {
          newParams[cat][sub] = 0;
        });
      });

      // Populate
      subData?.forEach(row => {
        const catUI = row.categoria === 'ACESSORIO' ? 'ACESSÓRIO' : row.categoria.toUpperCase().trim();
        if (newParams[catUI]) {
          newParams[catUI][row.subtipo] = Number(row.percentual || 0);
        }
      });

      setSubcategories(newParams);
    } catch (err) {
      console.error("Erro ao carregar parâmetros do mix:", err);
      toast.error("Erro ao carregar metas de mix");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAll = async () => {
    if (isReadOnly) return;

    // Validate category total
    const totalCategories = feminino + masculino + infMenina + infMenino + acessorio;
    if (Math.abs(totalCategories - 100) > 0.05) {
      toast.error(`A soma das metas de categorias deve ser 100%. (Soma Atual: ${totalCategories.toFixed(1)}%)`);
      return;
    }

    // Validate subcategory totals
    const unalignedCategories: string[] = [];
    Object.entries(subcategories).forEach(([category, subtiposObj]) => {
      const sum = Object.values(subtiposObj).reduce((a, b) => a + b, 0);
      if (sum > 0 && Math.abs(sum - 100) > 0.05) {
        unalignedCategories.push(category);
      }
    });

    if (unalignedCategories.length > 0) {
      if (!confirm(`Aviso: A soma das metas de subtipo das seguintes categorias não é 100%: ${unalignedCategories.join(', ')}. Deseja salvar mesmo assim?`)) {
        return;
      }
    }

    setSaving(true);
    try {
      // 1. Save buyorder_parameters_store
      const payloadStore = existingRecord
        ? {
            ...existingRecord,
            feminino_pct: feminino,
            masculino_pct: masculino,
            infantil_menina_pct: infMenina,
            infantil_menino_pct: infMenino,
            acessorio_pct: acessorio,
            usa_parametros_customizados: true
          }
        : {
            store_number: storeNum,
            year: year,
            month: month,
            feminino_pct: feminino,
            masculino_pct: masculino,
            infantil_menina_pct: infMenina,
            infantil_menino_pct: infMenino,
            acessorio_pct: acessorio,
            cota_valor: 0,
            usa_parametros_customizados: true,
            usar_cota_fixa: false,
            cota_gerente_fixa: null
          };

      const { error: storeError } = await supabase
        .from("buyorder_parameters_store")
        .upsert([payloadStore], { onConflict: "store_number,year,month" });

      if (storeError) throw storeError;

      // 2. Save buyorder_subcategory_params (delete and recreate to prevent orphaned rows)
      const { error: deleteError } = await supabase
        .from('buyorder_subcategory_params')
        .delete()
        .eq('store_number', storeNum)
        .eq('year', year)
        .eq('month', month);

      if (deleteError) throw deleteError;

      const subPayloads: any[] = [];
      Object.entries(subcategories).forEach(([categoria, subtiposObj]) => {
        Object.entries(subtiposObj).forEach(([subtipo, percentual]) => {
          if (percentual > 0) {
            subPayloads.push({
              store_number: storeNum,
              year: year,
              month: month,
              categoria,
              subtipo,
              percentual
            });
          }
        });
      });

      if (subPayloads.length > 0) {
        const { error: subInsertError } = await supabase
          .from('buyorder_subcategory_params')
          .insert(subPayloads);

        if (subInsertError) throw subInsertError;
      }

      toast.success("✅ Planejamento de Mix salvo com sucesso!");
      await loadParameters();
    } catch (err: any) {
      console.error("Erro ao salvar planejamento:", err);
      toast.error("Erro ao salvar planejamento: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  // Sum calculations
  const totalCategories = useMemo(() => {
    return feminino + masculino + infMenina + infMenino + acessorio;
  }, [feminino, masculino, infMenina, infMenino, acessorio]);

  const subcategorySums = useMemo(() => {
    const sums: Record<string, number> = {};
    Object.entries(subcategories).forEach(([cat, subs]) => {
      sums[cat] = Object.values(subs).reduce((a, b) => a + b, 0);
    });
    return sums;
  }, [subcategories]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <span className="text-xs font-black uppercase tracking-widest text-slate-400">
          Carregando Planejamento de Mix...
        </span>
      </div>
    );
  }

  // Visual status header
  const isBalanced = Math.abs(totalCategories - 100) < 0.05;

  return (
    <div className="space-y-6">
      
      {/* Overview Dashboard Balance Alert & Info Banner */}
      <div className={`p-5 rounded-2xl border flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all ${
        isBalanced 
          ? 'bg-emerald-50/50 border-emerald-200 dark:bg-emerald-950/10 dark:border-emerald-800' 
          : 'bg-rose-50/50 border-rose-200 dark:bg-rose-950/10 dark:border-rose-800'
      }`}>
        <div className="space-y-1">
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${isBalanced ? 'bg-emerald-500' : 'bg-rose-500'}`} />
            Balanço do Mix de Categorias ({MONTH_NAMES[month - 1]} / {year})
          </h3>
          <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
            {isBalanced 
              ? "Soma de categorias perfeita! As proporções estão balanceadas em 100%." 
              : `A soma das metas de categorias deve ser exatamente 100%. Soma atual: ${totalCategories.toFixed(1)}%`
            }
          </p>
        </div>

        {/* Cota Valor Read-Only metric */}
        <div className="flex items-center gap-3">
          <div className="px-4 py-2.5 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-right">
            <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block">
              Cota Financeira
            </span>
            <span className="text-xs font-black text-slate-800 dark:text-white font-mono">
              {existingRecord?.cota_valor 
                ? Number(existingRecord.cota_valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                : 'Nenhuma Cota Definida'
              }
            </span>
          </div>

          <div className={`px-4 py-2.5 rounded-xl text-right border ${
            isBalanced 
              ? 'bg-emerald-100/70 border-emerald-300 text-emerald-800 dark:bg-emerald-900/30' 
              : 'bg-rose-100/70 border-rose-300 text-rose-800 dark:bg-rose-900/30'
          }`}>
            <span className="text-[9px] font-black uppercase tracking-wider opacity-60 block">
              Soma Total
            </span>
            <span className="text-sm font-black font-mono">
              {totalCategories.toFixed(1)}%
            </span>
          </div>
        </div>
      </div>

      {/* 4 Cards Category Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">

        {/* 1. FEMININO */}
        <div className="bg-pink-50/30 dark:bg-pink-950/5 border border-pink-100 dark:border-pink-900/50 rounded-3xl p-5 flex flex-col justify-between space-y-5 shadow-sm">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-pink-100 dark:bg-pink-950/40 flex items-center justify-center text-lg">👠</div>
                <h4 className="text-xs font-black uppercase text-pink-700 dark:text-pink-400 tracking-wider">
                  Feminino
                </h4>
              </div>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  disabled={isReadOnly}
                  value={feminino || ''}
                  onChange={(e) => setFeminino(Math.max(0, Number(e.target.value)))}
                  className="w-16 bg-white dark:bg-slate-900 border-2 border-pink-200 dark:border-pink-800 focus:border-pink-400 rounded-lg py-1 px-2 text-xs font-black text-right outline-none"
                />
                <span className="text-xs font-bold text-pink-500">%</span>
              </div>
            </div>

            <div className="h-px bg-pink-100/60 dark:bg-pink-900/30" />

            {/* Subtypes List */}
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              <span className="text-[9px] font-black uppercase tracking-widest text-pink-500/80 block">Subtipos</span>
              {categoriesSubtypes.FEMININO.map(sub => (
                <div key={sub} className="flex items-center justify-between gap-2 py-0.5">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-xs flex-shrink-0">{renderSubtipoIcon(sub)}</span>
                    <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300 truncate">{sub}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      disabled={isReadOnly}
                      value={subcategories.FEMININO[sub] || ''}
                      onChange={(e) => {
                        const val = Math.max(0, Number(e.target.value));
                        setSubcategories(prev => ({
                          ...prev,
                          FEMININO: { ...prev.FEMININO, [sub]: val }
                        }));
                      }}
                      className="w-14 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded py-0.5 px-1.5 text-[11px] font-black text-right outline-none"
                    />
                    <span className="text-[10px] font-bold text-slate-400">%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Progress bar and Balance */}
          <div className="space-y-1.5 pt-3 border-t border-pink-100/60 dark:bg-pink-900/10">
            <div className="flex items-center justify-between text-[10px]">
              <span className="font-bold text-pink-700 dark:text-pink-400 uppercase">Soma Subtipos</span>
              <span className="font-black font-mono">{subcategorySums.FEMININO}%</span>
            </div>
            <div className="h-1.5 w-full bg-pink-100 dark:bg-pink-950/40 rounded-full overflow-hidden">
              <div 
                className={`h-full rounded-full transition-all duration-300 ${Math.abs(subcategorySums.FEMININO - 100) < 0.05 ? 'bg-emerald-500' : 'bg-pink-500'}`}
                style={{ width: `${Math.min(100, subcategorySums.FEMININO)}%` }}
              />
            </div>
            {Math.abs(subcategorySums.FEMININO - 100) < 0.05 ? (
              <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">✓ Balanceado</span>
            ) : (
              <span className="text-[9px] font-bold text-pink-500">Diferença de {(100 - subcategorySums.FEMININO).toFixed(0)}%</span>
            )}
          </div>
        </div>

        {/* 2. MASCULINO */}
        <div className="bg-blue-50/30 dark:bg-blue-950/5 border border-blue-100 dark:border-blue-900/50 rounded-3xl p-5 flex flex-col justify-between space-y-5 shadow-sm">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-950/40 flex items-center justify-center text-lg">👞</div>
                <h4 className="text-xs font-black uppercase text-blue-700 dark:text-blue-400 tracking-wider">
                  Masculino
                </h4>
              </div>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  disabled={isReadOnly}
                  value={masculino || ''}
                  onChange={(e) => setMasculino(Math.max(0, Number(e.target.value)))}
                  className="w-16 bg-white dark:bg-slate-900 border-2 border-blue-200 dark:border-blue-800 focus:border-blue-400 rounded-lg py-1 px-2 text-xs font-black text-right outline-none"
                />
                <span className="text-xs font-bold text-blue-500">%</span>
              </div>
            </div>

            <div className="h-px bg-blue-100/60 dark:bg-blue-900/30" />

            {/* Subtypes List */}
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              <span className="text-[9px] font-black uppercase tracking-widest text-blue-500/80 block">Subtipos</span>
              {categoriesSubtypes.MASCULINO.map(sub => (
                <div key={sub} className="flex items-center justify-between gap-2 py-0.5">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-xs flex-shrink-0">{renderSubtipoIcon(sub)}</span>
                    <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300 truncate">{sub}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      disabled={isReadOnly}
                      value={subcategories.MASCULINO[sub] || ''}
                      onChange={(e) => {
                        const val = Math.max(0, Number(e.target.value));
                        setSubcategories(prev => ({
                          ...prev,
                          MASCULINO: { ...prev.MASCULINO, [sub]: val }
                        }));
                      }}
                      className="w-14 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded py-0.5 px-1.5 text-[11px] font-black text-right outline-none"
                    />
                    <span className="text-[10px] font-bold text-slate-400">%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Progress bar and Balance */}
          <div className="space-y-1.5 pt-3 border-t border-blue-100/60 dark:bg-blue-900/10">
            <div className="flex items-center justify-between text-[10px]">
              <span className="font-bold text-blue-700 dark:text-blue-400 uppercase">Soma Subtipos</span>
              <span className="font-black font-mono">{subcategorySums.MASCULINO}%</span>
            </div>
            <div className="h-1.5 w-full bg-blue-100 dark:bg-blue-950/40 rounded-full overflow-hidden">
              <div 
                className={`h-full rounded-full transition-all duration-300 ${Math.abs(subcategorySums.MASCULINO - 100) < 0.05 ? 'bg-emerald-500' : 'bg-blue-500'}`}
                style={{ width: `${Math.min(100, subcategorySums.MASCULINO)}%` }}
              />
            </div>
            {Math.abs(subcategorySums.MASCULINO - 100) < 0.05 ? (
              <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">✓ Balanceado</span>
            ) : (
              <span className="text-[9px] font-bold text-blue-500">Diferença de {(100 - subcategorySums.MASCULINO).toFixed(0)}%</span>
            )}
          </div>
        </div>

        {/* 3. INFANTIL */}
        <div className="bg-purple-50/30 dark:bg-purple-950/5 border border-purple-100 dark:border-purple-900/50 rounded-3xl p-5 flex flex-col justify-between space-y-5 shadow-sm">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-950/40 flex items-center justify-center text-lg">🧒</div>
                <h4 className="text-xs font-black uppercase text-purple-700 dark:text-purple-400 tracking-wider">
                  Infantil
                </h4>
              </div>
              <div className="flex flex-col gap-1.5 text-right">
                <div className="flex items-center gap-1">
                  <span className="text-[8px] font-bold text-purple-400 uppercase">Menina:</span>
                  <input
                    type="number"
                    disabled={isReadOnly}
                    value={infMenina || ''}
                    onChange={(e) => setInfMenina(Math.max(0, Number(e.target.value)))}
                    className="w-12 bg-white dark:bg-slate-900 border-2 border-purple-200 dark:border-purple-800 focus:border-purple-400 rounded-lg py-0.5 px-1.5 text-[11px] font-black text-right outline-none"
                  />
                  <span className="text-[10px] font-bold text-purple-500">%</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-[8px] font-bold text-purple-400 uppercase">Menino:</span>
                  <input
                    type="number"
                    disabled={isReadOnly}
                    value={infMenino || ''}
                    onChange={(e) => setInfMenino(Math.max(0, Number(e.target.value)))}
                    className="w-12 bg-white dark:bg-slate-900 border-2 border-purple-200 dark:border-purple-800 focus:border-purple-400 rounded-lg py-0.5 px-1.5 text-[11px] font-black text-right outline-none"
                  />
                  <span className="text-[10px] font-bold text-purple-500">%</span>
                </div>
              </div>
            </div>

            <div className="h-px bg-purple-100/60 dark:bg-purple-900/30" />

            {/* Subtypes List */}
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              <span className="text-[9px] font-black uppercase tracking-widest text-purple-500/80 block">Subtipos</span>
              {categoriesSubtypes.INFANTIL.map(sub => (
                <div key={sub} className="flex items-center justify-between gap-2 py-0.5">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-xs flex-shrink-0">{renderSubtipoIcon(sub)}</span>
                    <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300 truncate">{sub}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      disabled={isReadOnly}
                      value={subcategories.INFANTIL[sub] || ''}
                      onChange={(e) => {
                        const val = Math.max(0, Number(e.target.value));
                        setSubcategories(prev => ({
                          ...prev,
                          INFANTIL: { ...prev.INFANTIL, [sub]: val }
                        }));
                      }}
                      className="w-14 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded py-0.5 px-1.5 text-[11px] font-black text-right outline-none"
                    />
                    <span className="text-[10px] font-bold text-slate-400">%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Progress bar and Balance */}
          <div className="space-y-1.5 pt-3 border-t border-purple-100/60 dark:bg-purple-900/10">
            <div className="flex items-center justify-between text-[10px]">
              <span className="font-bold text-purple-700 dark:text-purple-400 uppercase">Soma Subtipos</span>
              <span className="font-black font-mono">{subcategorySums.INFANTIL}%</span>
            </div>
            <div className="h-1.5 w-full bg-purple-100 dark:bg-purple-950/40 rounded-full overflow-hidden">
              <div 
                className={`h-full rounded-full transition-all duration-300 ${Math.abs(subcategorySums.INFANTIL - 100) < 0.05 ? 'bg-emerald-500' : 'bg-purple-500'}`}
                style={{ width: `${Math.min(100, subcategorySums.INFANTIL)}%` }}
              />
            </div>
            {Math.abs(subcategorySums.INFANTIL - 100) < 0.05 ? (
              <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">✓ Balanceado</span>
            ) : (
              <span className="text-[9px] font-bold text-purple-500">Diferença de {(100 - subcategorySums.INFANTIL).toFixed(0)}%</span>
            )}
          </div>
        </div>

        {/* 4. ACESSÓRIO */}
        <div className="bg-amber-50/30 dark:bg-amber-950/5 border border-amber-100 dark:border-amber-900/50 rounded-3xl p-5 flex flex-col justify-between space-y-5 shadow-sm">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-950/40 flex items-center justify-center text-lg">🕶️</div>
                <h4 className="text-xs font-black uppercase text-amber-700 dark:text-amber-400 tracking-wider">
                  Acessório
                </h4>
              </div>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  disabled={isReadOnly}
                  value={acessorio || ''}
                  onChange={(e) => setAcessorio(Math.max(0, Number(e.target.value)))}
                  className="w-16 bg-white dark:bg-slate-900 border-2 border-amber-200 dark:border-amber-800 focus:border-amber-400 rounded-lg py-1 px-2 text-xs font-black text-right outline-none"
                />
                <span className="text-xs font-bold text-amber-500">%</span>
              </div>
            </div>

            <div className="h-px bg-amber-100/60 dark:bg-amber-900/30" />

            {/* Subtypes List */}
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              <span className="text-[9px] font-black uppercase tracking-widest text-amber-500/80 block">Subtipos</span>
              {categoriesSubtypes.ACESSÓRIO.map(sub => (
                <div key={sub} className="flex items-center justify-between gap-2 py-0.5">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-xs flex-shrink-0">{renderSubtipoIcon(sub)}</span>
                    <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300 truncate">{sub}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      disabled={isReadOnly}
                      value={subcategories.ACESSÓRIO[sub] || ''}
                      onChange={(e) => {
                        const val = Math.max(0, Number(e.target.value));
                        setSubcategories(prev => ({
                          ...prev,
                          ACESSÓRIO: { ...prev.ACESSÓRIO, [sub]: val }
                        }));
                      }}
                      className="w-14 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded py-0.5 px-1.5 text-[11px] font-black text-right outline-none"
                    />
                    <span className="text-[10px] font-bold text-slate-400">%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Progress bar and Balance */}
          <div className="space-y-1.5 pt-3 border-t border-amber-100/60 dark:bg-amber-900/10">
            <div className="flex items-center justify-between text-[10px]">
              <span className="font-bold text-amber-700 dark:text-amber-400 uppercase">Soma Subtipos</span>
              <span className="font-black font-mono">{subcategorySums.ACESSÓRIO}%</span>
            </div>
            <div className="h-1.5 w-full bg-amber-100 dark:bg-amber-950/40 rounded-full overflow-hidden">
              <div 
                className={`h-full rounded-full transition-all duration-300 ${Math.abs(subcategorySums.ACESSÓRIO - 100) < 0.05 ? 'bg-emerald-500' : 'bg-amber-500'}`}
                style={{ width: `${Math.min(100, subcategorySums.ACESSÓRIO)}%` }}
              />
            </div>
            {Math.abs(subcategorySums.ACESSÓRIO - 100) < 0.05 ? (
              <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">✓ Balanceado</span>
            ) : (
              <span className="text-[9px] font-bold text-amber-500">Diferença de {(100 - subcategorySums.ACESSÓRIO).toFixed(0)}%</span>
            )}
          </div>
        </div>

      </div>

      {/* Action Buttons Section */}
      {!isReadOnly && (
        <div className="flex justify-end pt-4">
          <button
            type="button"
            onClick={handleSaveAll}
            disabled={saving}
            className="px-8 py-3.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-black uppercase tracking-wider rounded-2xl border-b-4 border-blue-800 transition-all flex items-center gap-2 shadow-md hover:shadow-lg active:scale-[0.98]"
          >
            {saving ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Gravando Planejamento...
              </>
            ) : (
              <>
                <Check size={14} />
                Salvar Planejamento de Mix
              </>
            )}
          </button>
        </div>
      )}

    </div>
  );
}
