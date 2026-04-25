import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { Settings, Check, Loader2, ChevronRight, Search, Calendar, Plus, Trash2, Edit2, X } from 'lucide-react';

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
  
  const [categoria, setCategoria] = useState<'INF' | 'MASC' | 'FEM' | 'TODOS'>('INF');
  const [tamanhos, setTamanhos] = useState('34, 35, 36');
  const [mensagem, setMensagem] = useState('');

  useEffect(() => {
    carregarAlertas();
  }, [storeNumber]);

  const carregarAlertas = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('buy_store_grade_requirements')
        .select('*')
        .eq('store_id', parseInt(storeNumber))
        .order('categoria');
      
      if (error) throw error;
      setAlertas(data || []);
    } catch (err) {
      console.error('Erro ao carregar alertas de grade:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSalvar = async () => {
    try {
      const tamanhosArray = tamanhos
        .split(',')
        .map(t => parseInt(t.trim()))
        .filter(t => !isNaN(t));

      if (tamanhosArray.length === 0) {
        alert('❌ Digite pelo menos um tamanho válido!');
        return;
      }

      const { error } = await supabase
        .from('buy_store_grade_requirements')
        .upsert({
          store_id: parseInt(storeNumber),
          categoria,
          tamanhos_obrigatorios: tamanhosArray,
          mensagem_customizada: mensagem || null,
          ativo: true
        }, {
          onConflict: 'store_id,categoria'
        });

      if (error) throw error;

      alert('✅ Requisito de grade salvo!');
      setEditando(false);
      setTamanhos('34, 35, 36');
      setMensagem('');
      carregarAlertas();
    } catch (err: any) {
      console.error('Erro ao salvar:', err);
      alert('❌ Erro: ' + err.message);
    }
  };

  const handleDeletar = async (id: string) => {
    if (!confirm('Deletar este requisito de grade?')) return;

    try {
      const { error } = await supabase
        .from('buy_store_grade_requirements')
        .delete()
        .eq('id', id);

      if (error) throw error;

      alert('✅ Requisito deletado!');
      carregarAlertas();
    } catch (err: any) {
      console.error('Erro ao deletar:', err);
      alert('❌ Erro: ' + err.message);
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
          {editando ? 'Cancelar' : '+ Adicionar'}
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
                onChange={e => setCategoria(e.target.value as any)}
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
                onChange={e => setTamanhos(e.target.value)}
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
              onChange={e => setMensagem(e.target.value)}
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
        <p className="text-xs text-slate-400 text-center py-4">Nenhum requisito configurado</p>
      ) : (
        <div className="space-y-2">
          {alertas.map(alerta => (
            <div key={alerta.id} className="flex items-center justify-between bg-slate-50 dark:bg-slate-900 rounded-lg p-3 border border-slate-200 dark:border-slate-700">
              <div className="flex-1">
                <p className="text-xs font-black text-slate-900 dark:text-white">
                  {alerta.categoria} → Tamanhos: {alerta.tamanhos_obrigatorios.join(', ')}
                </p>
                {alerta.mensagem_customizada && (
                  <p className="text-[10px] text-slate-500 mt-0.5">{alerta.mensagem_customizada}</p>
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
  
  const [marca, setMarca] = useState('');
  const [lojas, setLojas] = useState('');
  const [mensagem, setMensagem] = useState('');

  useEffect(() => {
    carregarAlertas();
  }, []);

  const carregarAlertas = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('buy_brand_store_restrictions')
        .select('*')
        .order('marca');
      
      if (error) throw error;
      setAlertas(data || []);
    } catch (err) {
      console.error('Erro ao carregar restrições de marca:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSalvar = async () => {
    if (!marca.trim() || !lojas.trim()) {
      alert('❌ Preencha marca e lojas!');
      return;
    }

    try {
      const lojasArray = lojas
        .split(',')
        .map(l => parseInt(l.trim()))
        .filter(l => !isNaN(l));

      if (lojasArray.length === 0) {
        alert('❌ Digite pelo menos uma loja válida!');
        return;
      }

      const mensagemFinal = mensagem || `⛔ NÃO comprar ${marca.toUpperCase()} para lojas ${lojasArray.join(', ')}`;

      const { error } = await supabase
        .from('buy_brand_store_restrictions')
        .upsert({
          marca: marca.trim().toUpperCase(),
          lojas_proibidas: lojasArray,
          mensagem_alerta: mensagemFinal,
          ativo: true
        }, {
          onConflict: 'marca'
        });

      if (error) throw error;

      alert('✅ Restrição de marca salva!');
      setEditando(false);
      setMarca('');
      setLojas('');
      setMensagem('');
      carregarAlertas();
    } catch (err: any) {
      console.error('Erro ao salvar:', err);
      alert('❌ Erro: ' + err.message);
    }
  };

  const handleDeletar = async (id: string) => {
    if (!confirm('Deletar esta restrição de marca?')) return;

    try {
      const { error } = await supabase
        .from('buy_brand_store_restrictions')
        .delete()
        .eq('id', id);

      if (error) throw error;

      alert('✅ Restrição deletada!');
      carregarAlertas();
    } catch (err: any) {
      console.error('Erro ao deletar:', err);
      alert('❌ Erro: ' + err.message);
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
          {editando ? 'Cancelar' : '+ Adicionar'}
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
                onChange={e => setMarca(e.target.value)}
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
                onChange={e => setLojas(e.target.value)}
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
              onChange={e => setMensagem(e.target.value)}
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
        <p className="text-xs text-slate-400 text-center py-4">Nenhuma restrição configurada</p>
      ) : (
        <div className="space-y-2">
          {alertas.map(alerta => (
            <div key={alerta.id} className="flex items-center justify-between bg-slate-50 dark:bg-slate-900 rounded-lg p-3 border border-slate-200 dark:border-slate-700">
              <div className="flex-1">
                <p className="text-xs font-black text-slate-900 dark:text-white">
                  {alerta.marca} → Lojas: {alerta.lojas_proibidas.join(', ')}
                </p>
                <p className="text-[10px] text-slate-500 mt-0.5">{alerta.mensagem_alerta}</p>
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
  
  const [tipoProduto, setTipoProduto] = useState('');
  const [lojas, setLojas] = useState('');
  const [mensagem, setMensagem] = useState('');

  useEffect(() => {
    carregarAlertas();
  }, []);

  const carregarAlertas = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('buy_product_store_restrictions')
        .select('*')
        .order('tipo_produto');
      
      if (error) throw error;
      setAlertas(data || []);
    } catch (err) {
      console.error('Erro ao carregar restrições de produto:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSalvar = async () => {
    if (!tipoProduto.trim() || !lojas.trim()) {
      alert('❌ Preencha tipo de produto e lojas!');
      return;
    }

    try {
      const lojasArray = lojas
        .split(',')
        .map(l => parseInt(l.trim()))
        .filter(l => !isNaN(l));

      if (lojasArray.length === 0) {
        alert('❌ Digite pelo menos uma loja válida!');
        return;
      }

      const mensagemFinal = mensagem || `⛔ Lojas ${lojasArray.join(', ')} NÃO vendem ${tipoProduto.toUpperCase()}`;

      const { error } = await supabase
        .from('buy_product_store_restrictions')
        .upsert({
          tipo_produto: tipoProduto.trim().toUpperCase(),
          lojas_proibidas: lojasArray,
          mensagem_alerta: mensagemFinal,
          ativo: true
        }, {
          onConflict: 'tipo_produto'
        });

      if (error) throw error;

      alert('✅ Restrição de produto salva!');
      setEditando(false);
      setTipoProduto('');
      setLojas('');
      setMensagem('');
      carregarAlertas();
    } catch (err: any) {
      console.error('Erro ao salvar:', err);
      alert('❌ Erro: ' + err.message);
    }
  };

  const handleDeletar = async (id: string) => {
    if (!confirm('Deletar esta restrição de produto?')) return;

    try {
      const { error } = await supabase
        .from('buy_product_store_restrictions')
        .delete()
        .eq('id', id);

      if (error) throw error;

      alert('✅ Restrição deletada!');
      carregarAlertas();
    } catch (err: any) {
      console.error('Erro ao deletar:', err);
      alert('❌ Erro: ' + err.message);
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
          {editando ? 'Cancelar' : '+ Adicionar'}
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
                onChange={e => setTipoProduto(e.target.value)}
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
                onChange={e => setLojas(e.target.value)}
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
              onChange={e => setMensagem(e.target.value)}
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
        <p className="text-xs text-slate-400 text-center py-4">Nenhuma restrição configurada</p>
      ) : (
        <div className="space-y-2">
          {alertas.map(alerta => (
            <div key={alerta.id} className="flex items-center justify-between bg-slate-50 dark:bg-slate-900 rounded-lg p-3 border border-slate-200 dark:border-slate-700">
              <div className="flex-1">
                <p className="text-xs font-black text-slate-900 dark:text-white">
                  {alerta.tipo_produto} → Lojas: {alerta.lojas_proibidas.join(', ')}
                </p>
                <p className="text-[10px] text-slate-500 mt-0.5">{alerta.mensagem_alerta}</p>
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
  cota_gerente_pct: number;
  cota_comprador_pct: number;
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
  cota_gerente_pct: number;
  cota_comprador_pct: number;
  usa_parametros_customizados: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════

export default function BuyOrderParams({ user }: { user: any }) {
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN' || user?.role === 'MANAGER';

  const [stores, setStores] = useState<Store[]>([]);
  const [selectedStore, setSelectedStore] = useState<Store | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  
  const monthNames = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  // Estados do formulário
  const [feminino, setFeminino] = useState(40);
  const [infMenina, setInfMenina] = useState(10);
  const [infMenino, setInfMenino] = useState(10);
  const [masculino, setMasculino] = useState(20);
  const [acessorio, setAcessorio] = useState(20);

  interface MonthlyData {
    month: number;
    cotaTotal: number;
    despesas: number;
    cotaGerenteValor?: number;
    cotaCompradorValor?: number;
    // Removido cotaGerentePct e cotaCompradorPct (agora são anuais)
  }

  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>(
    Array.from({ length: 12 }).map((_, i) => ({
      month: i + 1,
      cotaTotal: 0,
      despesas: 0,
      cotaGerenteValor: 0,
      cotaCompradorValor: 0
    }))
  );

  // Percentuais ANUAIS (não mensais - aplicados a todos os meses)
  const [cotaGerentePctAnual, setCotaGerentePctAnual] = useState(80);
  const [cotaCompradorPctAnual, setCotaCompradorPctAnual] = useState(20);

  if (!isAdmin) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <p>Acesso restrito. Apenas administradores podem configurar cotas.</p>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CARREGAR LOJAS
  // ═══════════════════════════════════════════════════════════════════════════

  useEffect(() => {
    loadStores();
  }, [selectedYear]);

  const loadStores = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('v_stores_quota_config')
        .select('*')
        .eq('year', selectedYear)
        .eq('month', 1)
        .order('store_number');

      if (error) throw error;
      setStores(data || []);
    } catch (err) {
      console.error('Erro ao carregar lojas:', err);
      alert('Erro ao carregar lojas');
    } finally {
      setLoading(false);
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // ABRIR MODAL DE EDIÇÃO
  // ═══════════════════════════════════════════════════════════════════════════

  const handleOpenStore = async (store: Store) => {
    setSelectedStore(store);

    // Se tem parâmetros customizados, carregar
    if (store.tem_parametros_customizados) {
      try {
        const { data, error } = await supabase
          .from('buyorder_parameters_store')
          .select('*')
          .eq('store_number', store.store_number)
          .eq('year', selectedYear);

        if (error) throw error;

        if (data && data.length > 0) {
          setFeminino(data[0].feminino_pct || 40);
          setInfMenina(data[0].infantil_menina_pct || 10);
          setInfMenino(data[0].infantil_menino_pct || 10);
          setMasculino(data[0].masculino_pct || 20);
          setAcessorio(data[0].acessorio_pct || 20);

          const newMonthly = Array.from({ length: 12 }).map((_, i) => {
            const m = i + 1;
            const p = data.find(x => x.month === m);
            return {
              month: m,
              cotaTotal: p ? (p.cota_valor || 0) : 0,
              despesas: p ? (p.despesas_comprometidas || 0) : 0,
              cotaGerenteValor: p ? (p.cota_gerente_valor || 0) : 0,
              cotaCompradorValor: p ? (p.cota_comprador_valor || 0) : 0
            };
          });
          setMonthlyData(newMonthly);

          // Carregar valores anuais (pegar do primeiro mês)
          if (data && data.length > 0) {
            setCotaGerentePctAnual(data[0].cota_gerente_pct || 80);
            setCotaCompradorPctAnual(data[0].cota_comprador_pct || 20);
          }
        }
      } catch (err) {
        console.error('Erro ao carregar parâmetros:', err);
      }
    } else {
      // Usar valores globais/padrão
      try {
        const { data, error } = await supabase
          .from('buyorder_parameters_global')
          .select('*')
          .eq('year', selectedYear);

        if (data && data.length > 0) {
          setFeminino(data[0].feminino_pct || 40);
          setInfMenina(data[0].infantil_menina_pct || 10);
          setInfMenino(data[0].infantil_menino_pct || 10);
          setMasculino(data[0].masculino_pct || 20);
          setAcessorio(data[0].acessorio_pct || 20);

          const newMonthly = Array.from({ length: 12 }).map((_, i) => {
            const m = i + 1;
            const p = data.find(x => x.month === m);
            return {
              month: m,
              cotaTotal: p ? (p.cota_valor || 0) : 0,
              despesas: p ? (p.despesas_comprometidas || 0) : 0,
              cotaGerenteValor: p ? (p.cota_gerente_valor || 0) : 0,
              cotaCompradorValor: p ? (p.cota_comprador_valor || 0) : 0
            };
          });
          setMonthlyData(newMonthly);
        } else {
          setFeminino(40);
          setInfMenina(10);
          setInfMenino(10);
          setMasculino(20);
          setAcessorio(20);
          setMonthlyData(Array.from({ length: 12 }).map((_, i) => ({
            month: i + 1,
            cotaTotal: 0,
            despesas: 0,
            cotaGerenteValor: 0,
            cotaCompradorValor: 0
          })));
        }
      } catch (err) {
        setMonthlyData(Array.from({ length: 12 }).map((_, i) => ({
          month: i + 1,
          cotaTotal: 0,
          despesas: 0,
          cotaGerenteValor: 0,
          cotaCompradorValor: 0
        })));
      }
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // ATUALIZAR MÊS ESPECÍFICO
  // ═══════════════════════════════════════════════════════════════════════════
  
  const handleUpdateMonth = (monthIndex: number, field: keyof MonthlyData, value: number) => {
    setMonthlyData(prev => {
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
      alert('A soma das metas deve ser 100%');
      return;
    }

    setSaving(true);
    try {
      const payloads = monthlyData.map(m => ({
        store_number: selectedStore.store_number,
        year: selectedYear,
        month: m.month,
        feminino_pct: feminino,
        infantil_menina_pct: infMenina,
        infantil_menino_pct: infMenino,
        masculino_pct: masculino,
        acessorio_pct: acessorio,
        cota_valor: m.cotaTotal,
        despesas_comprometidas: m.despesas,
        cota_gerente_pct: cotaGerentePctAnual,
        cota_comprador_pct: cotaCompradorPctAnual,
        usa_parametros_customizados: true
      }));

      const { error } = await supabase
        .from('buyorder_parameters_store')
        .upsert(payloads, {
          onConflict: 'store_number,year,month'
        });

      if (error) throw error;

      alert(`✅ Parâmetros salvos para o ano ${selectedYear}!`);
      loadStores();
    } catch (err: any) {
      console.error('Erro ao salvar:', err);
      alert('❌ Erro ao salvar: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // RESETAR PARA GLOBAL
  // ═══════════════════════════════════════════════════════════════════════════

  const handleResetToGlobal = async () => {
    if (!selectedStore) return;

    if (!confirm('Tem certeza que deseja usar os parâmetros globais para esta loja?')) {
      return;
    }

    try {
      const { error } = await supabase.rpc('reset_store_to_global', {
        p_store_number: selectedStore.store_number,
        p_year: currentYear
      });

      if (error) throw error;

      alert('✅ Loja configurada para usar parâmetros globais!');
      setSelectedStore(null);
      loadStores();
    } catch (err: any) {
      console.error('Erro:', err);
      alert('❌ Erro: ' + err.message);
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // FILTRAR LOJAS
  // ═══════════════════════════════════════════════════════════════════════════

  const filteredStores = stores.filter(s =>
    s.store_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.store_number.includes(searchTerm) ||
    s.city.toLowerCase().includes(searchTerm.toLowerCase())
  ).sort((a, b) => {
    // Try to sort numerically if the store_number is numeric
    const aNum = parseInt(a.store_number);
    const bNum = parseInt(b.store_number);
    if (!isNaN(aNum) && !isNaN(bNum)) {
      return aNum - bNum;
    }
    return a.store_number.localeCompare(b.store_number);
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

  return (
    <div className="w-full max-w-5xl mx-auto h-[80vh] flex flex-col overflow-hidden bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between p-6 border-b border-slate-200 dark:border-slate-800 gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-orange-100 dark:bg-orange-900/30 rounded-xl">
            <Settings size={20} className="text-orange-600 dark:text-orange-400" />
          </div>
          <div>
            <h2 className="text-lg font-black text-slate-900 dark:text-white uppercase italic">
              Parâmetros de Compra
            </h2>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
              Clique em uma loja para editar
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700">
            <Calendar size={16} className="text-slate-400" />
            <select 
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="bg-transparent text-sm font-black text-slate-700 dark:text-slate-300 outline-none uppercase cursor-pointer"
            >
              {[2025, 2026, 2027, 2028].map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Lista de Lojas */}
        <div className="w-64 border-r border-slate-200 dark:border-slate-800 flex flex-col flex-shrink-0">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar loja..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-lg pl-9 pr-4 py-2.5 text-xs font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-orange-500/50 transition-all"
              />
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto">
            {filteredStores.map(store => {
              const isSelected = selectedStore?.store_number === store.store_number;
              return (
                <button
                  key={store.store_number}
                  onClick={() => handleOpenStore(store)}
                  className={`w-full text-left px-4 py-3 flex items-center justify-between gap-2 transition-all border-b border-slate-100 dark:border-slate-800 ${
                    isSelected
                      ? 'bg-orange-50 dark:bg-orange-900/20 border-l-4 border-l-orange-500'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800 border-l-4 border-l-transparent'
                  }`}
                >
                  <div className="min-w-0">
                    <p className={`text-xs font-black uppercase truncate ${isSelected ? 'text-orange-600 dark:text-orange-400' : 'text-slate-700 dark:text-slate-300'}`}>
                      Loja {store.store_number}
                    </p>
                    <p className="text-[10px] font-bold text-slate-400 truncate">{store.city}</p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {store.tem_parametros_customizados && (
                      <div className="w-2 h-2 rounded-full bg-emerald-400" title="Configurado" />
                    )}
                    <ChevronRight size={14} className={isSelected ? 'text-orange-500' : 'text-slate-300'} />
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Painel de Edição */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50 dark:bg-slate-900/50">
          {!selectedStore ? (
            <div className="flex flex-col items-center justify-center h-full text-center gap-4 py-12">
              <div className="p-6 bg-white dark:bg-slate-800 shadow-sm border border-slate-200 dark:border-slate-700 rounded-3xl">
                <Settings size={40} className="text-slate-300 dark:text-slate-600" />
              </div>
              <p className="text-sm font-black text-slate-400 uppercase italic">
                Selecione uma loja ao lado
              </p>
              <p className="text-xs font-bold text-slate-400">
                Para configurar metas, cotas e percentuais
              </p>
            </div>
          ) : (
            <div className="space-y-6 max-w-2xl mx-auto pb-12">
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white uppercase italic">
                  Loja {selectedStore.store_number} — {selectedStore.store_name}
                </h3>
                <p className="text-xs font-bold text-slate-400 mt-0.5">
                  {selectedStore.city.toUpperCase()} • ANO INTERCALAR: {selectedYear}
                </p>
              </div>

              {/* Metas por Categoria */}
              <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-200 dark:border-slate-700 shadow-sm">
                <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-widest mb-4 flex items-center gap-2">
                  <span>📊</span> METAS POR CATEGORIA (%)
                </h4>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">
                      Feminino
                    </label>
                    <input
                      type="number"
                      step="0.1" min="0" max="100"
                      value={feminino}
                      onChange={e => setFeminino(Number(e.target.value))}
                      className="w-full bg-slate-50 dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 focus:border-orange-400 rounded-xl px-4 py-2.5 text-sm font-black text-slate-900 dark:text-white outline-none transition-all"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">
                      Inf. Menina
                    </label>
                    <input
                      type="number"
                      step="0.1" min="0" max="100"
                      value={infMenina}
                      onChange={e => setInfMenina(Number(e.target.value))}
                      className="w-full bg-slate-50 dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 focus:border-orange-400 rounded-xl px-4 py-2.5 text-sm font-black text-slate-900 dark:text-white outline-none transition-all"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">
                      Inf. Menino
                    </label>
                    <input
                      type="number"
                      step="0.1" min="0" max="100"
                      value={infMenino}
                      onChange={e => setInfMenino(Number(e.target.value))}
                      className="w-full bg-slate-50 dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 focus:border-orange-400 rounded-xl px-4 py-2.5 text-sm font-black text-slate-900 dark:text-white outline-none transition-all"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">
                      Masculino
                    </label>
                    <input
                      type="number"
                      step="0.1" min="0" max="100"
                      value={masculino}
                      onChange={e => setMasculino(Number(e.target.value))}
                      className="w-full bg-slate-50 dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 focus:border-orange-400 rounded-xl px-4 py-2.5 text-sm font-black text-slate-900 dark:text-white outline-none transition-all"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">
                      Acessórios
                    </label>
                    <input
                      type="number"
                      step="0.1" min="0" max="100"
                      value={acessorio}
                      onChange={e => setAcessorio(Number(e.target.value))}
                      className="w-full bg-slate-50 dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 focus:border-orange-400 rounded-xl px-4 py-2.5 text-sm font-black text-slate-900 dark:text-white outline-none transition-all"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">
                      Total
                    </label>
                    <div className={`w-full border-2 rounded-xl px-4 py-2.5 text-sm font-black flex items-center ${isMetasValid ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
                      {totalMetas.toFixed(1)}%
                    </div>
                  </div>
                </div>
              </div>

              {/* Estrutura Cota Mensal e Divisão */}
              <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
                <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-widest flex items-center gap-2">
                  <span>💰</span> DIVISÃO ANUAL DE COMPRAS
                </h4>
                
                <div className="grid grid-cols-3 gap-4 bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">
                      👨‍💼 % Gerente (Anual)
                    </label>
                    <input
                      type="number"
                      step="1" min="0" max="100"
                      value={cotaGerentePctAnual}
                      onChange={e => setCotaGerentePctAnual(Number(e.target.value))}
                      className="w-full bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 focus:border-blue-400 rounded-xl px-4 py-2 text-sm font-black text-slate-900 dark:text-white outline-none transition-all"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">
                      🛒 % Comprador (Anual)
                    </label>
                    <input
                      type="number"
                      step="1" min="0" max="100"
                      value={cotaCompradorPctAnual}
                      onChange={e => setCotaCompradorPctAnual(Number(e.target.value))}
                      className="w-full bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 focus:border-blue-400 rounded-xl px-4 py-2 text-sm font-black text-slate-900 dark:text-white outline-none transition-all"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">
                      Total
                    </label>
                    <div className={`w-full border-2 rounded-xl px-4 py-2 text-sm font-black flex items-center h-[38px] ${(cotaGerentePctAnual + cotaCompradorPctAnual) === 100 ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
                      {(cotaGerentePctAnual + cotaCompradorPctAnual)}%
                    </div>
                  </div>
                </div>

                <div className="pt-4 overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[500px]">
                    <thead>
                      <tr>
                        <th className="text-[10px] font-black text-slate-500 uppercase tracking-widest p-2 border-b border-slate-200 dark:border-slate-700">Mês</th>
                        <th className="text-[10px] font-black text-slate-500 uppercase tracking-widest p-2 border-b border-slate-200 dark:border-slate-700 w-32">Cota Total (R$)</th>
                        <th className="text-[10px] font-black text-slate-500 uppercase tracking-widest p-2 border-b border-slate-200 dark:border-slate-700 w-32">Despesas (R$)</th>
                        <th className="text-[10px] font-black text-slate-500 uppercase tracking-widest p-2 border-b border-slate-200 dark:border-slate-700 w-32 text-right">Cota Limpa</th>
                        <th className="text-[10px] font-black text-slate-500 uppercase tracking-widest p-2 border-b border-slate-200 dark:border-slate-700 w-32 text-right">Cota Gerente</th>
                        <th className="text-[10px] font-black text-slate-500 uppercase tracking-widest p-2 border-b border-slate-200 dark:border-slate-700 w-32 text-right">Cota Comprador</th>
                      </tr>
                    </thead>
                    <tbody>
                      {monthlyData.map((data, index) => {
                        const cotaLimpa = Math.max(0, data.cotaTotal - data.despesas);
                        const formatarMoeda = (valor: number) => 
                          valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

                        return (
                          <tr key={index} className="border-b border-slate-100 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                            <td className="p-2 text-xs font-bold text-slate-700 dark:text-slate-300 uppercase">
                              {monthNames[data.month - 1]}
                            </td>
                            <td className="p-2">
                              <input 
                                type="number" step="1000" min="0" 
                                value={data.cotaTotal} 
                                onChange={e => handleUpdateMonth(index, 'cotaTotal', Number(e.target.value))} 
                                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 text-xs font-black outline-none focus:border-orange-400 transition-all text-slate-900 dark:text-white" 
                              />
                            </td>
                            <td className="p-2">
                              <input 
                                type="number" step="1000" min="0" 
                                value={data.despesas} 
                                onChange={e => handleUpdateMonth(index, 'despesas', Number(e.target.value))} 
                                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 text-xs font-black outline-none focus:border-orange-400 transition-all text-slate-900 dark:text-white" 
                              />
                            </td>
                            <td className="p-2 text-xs font-black text-slate-400 text-right">
                              {formatarMoeda(cotaLimpa)}
                            </td>
                            <td className="p-2 text-xs font-black text-blue-600 dark:text-blue-400 text-right bg-blue-50/10">
                              {formatarMoeda(data.cotaGerenteValor || 0)}
                            </td>
                            <td className="p-2 text-xs font-black text-emerald-600 dark:text-emerald-400 text-right bg-emerald-50/10">
                              {formatarMoeda(data.cotaCompradorValor || 0)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Administração de Alertas */}
              <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
                <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-widest flex items-center gap-2 border-b border-slate-100 dark:border-slate-700 pb-3">
                  <span>🔔</span> ADMINISTRAÇÃO DE ALERTAS
                </h4>

                <div className="space-y-6">
                  {/* Requisitos de Grade por Loja */}
                  <AlertasGradePorLoja storeNumber={selectedStore.store_number} />

                  {/* Restrições de Marca */}
                  <AlertasMarcaGlobal />

                  {/* Restrições de Produto */}
                  <AlertasProdutoGlobal />
                </div>
              </div>

              {/* Ações */}
              <div className="flex gap-4 pt-2">
                <button
                  onClick={handleResetToGlobal}
                  className="flex-1 py-4 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-black uppercase text-xs rounded-2xl border-2 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all active:scale-95"
                >
                  Restaurar Padrão
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-[2] flex items-center justify-center gap-2 py-4 bg-orange-600 hover:bg-orange-700 text-white font-black uppercase text-xs rounded-2xl border-b-4 border-orange-800 transition-all active:scale-95 disabled:opacity-50"
                >
                  {saving ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <><Check size={18} /> Salvar Parâmetros</>
                  )}
                </button>
              </div>

            </div>
          )}
        </div>
      </div>
    </div>
  );
}