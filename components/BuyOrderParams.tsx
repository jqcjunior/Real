import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { Settings, Check, Loader2, ChevronRight, Search, Calendar } from 'lucide-react';

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
    cotaGerentePct: number;
    cotaCompradorPct: number;
  }

  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>(
    Array.from({ length: 12 }).map((_, i) => ({
      month: i + 1,
      cotaTotal: 0,
      despesas: 0,
      cotaGerentePct: 50,
      cotaCompradorPct: 50
    }))
  );

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
              cotaTotal: p ? (p.cota_valor || p.cota_default || 0) : 0,
              despesas: p ? (p.despesas_comprometidas || 0) : 0,
              cotaGerentePct: p ? (p.cota_gerente_pct || 50) : 50,
              cotaCompradorPct: p ? (p.cota_comprador_pct || 50) : 50
            };
          });
          setMonthlyData(newMonthly);
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
              cotaTotal: p ? (p.cota_valor || p.cota_default || 0) : 0,
              despesas: p ? (p.despesas_comprometidas || 0) : 0,
              cotaGerentePct: p ? (p.cota_gerente_pct || 50) : 50,
              cotaCompradorPct: p ? (p.cota_comprador_pct || 50) : 50
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
            cotaGerentePct: 50,
            cotaCompradorPct: 50
          })));
        }
      } catch (err) {
        setMonthlyData(Array.from({ length: 12 }).map((_, i) => ({
          month: i + 1,
          cotaTotal: 0,
          despesas: 0,
          cotaGerentePct: 50,
          cotaCompradorPct: 50
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
        cota_default: m.cotaTotal, // For reference if needed later
        despesas_comprometidas: m.despesas,
        cota_gerente_pct: m.cotaGerentePct,
        cota_comprador_pct: m.cotaCompradorPct,
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
              Parâmetros de Cotas
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
                  <span>💰</span> ESTRUTURA DA COTA MENSAL E DIVISÃO
                </h4>
                
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[700px]">
                    <thead>
                      <tr>
                        <th className="text-[10px] font-black text-slate-500 uppercase tracking-widest p-2 border-b border-slate-200 dark:border-slate-700">Mês</th>
                        <th className="text-[10px] font-black text-slate-500 uppercase tracking-widest p-2 border-b border-slate-200 dark:border-slate-700 w-32">Cota Total (R$)</th>
                        <th className="text-[10px] font-black text-slate-500 uppercase tracking-widest p-2 border-b border-slate-200 dark:border-slate-700 w-32">Despesas (R$)</th>
                        <th className="text-[10px] font-black text-slate-500 uppercase tracking-widest p-2 border-b border-slate-200 dark:border-slate-700 w-32">Cota Limpa</th>
                        <th className="text-[10px] font-black text-slate-500 uppercase tracking-widest p-2 border-b border-slate-200 dark:border-slate-700 w-24">👨‍💼 % Gerente</th>
                        <th className="text-[10px] font-black text-slate-500 uppercase tracking-widest p-2 border-b border-slate-200 dark:border-slate-700 w-24">🛒 % Compra.</th>
                        <th className="text-[10px] font-black text-slate-500 uppercase tracking-widest p-2 border-b border-slate-200 dark:border-slate-700">Check</th>
                      </tr>
                    </thead>
                    <tbody>
                      {monthlyData.map((data, index) => {
                        const cotaLimpa = Math.max(0, data.cotaTotal - data.despesas);
                        const totalPct = data.cotaGerentePct + data.cotaCompradorPct;
                        const isValid = Math.abs(totalPct - 100) < 0.01;
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
                            <td className="p-2 text-xs font-black text-blue-600 dark:text-blue-400">
                              {cotaLimpa.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </td>
                            <td className="p-2">
                              <input 
                                type="number" step="0.1" min="0" max="100" 
                                value={data.cotaGerentePct} 
                                onChange={e => handleUpdateMonth(index, 'cotaGerentePct', Number(e.target.value))} 
                                className={`w-full bg-white dark:bg-slate-900 border rounded-lg px-2 py-1.5 text-xs font-black outline-none focus:border-orange-400 transition-all text-slate-900 dark:text-white ${isValid ? 'border-slate-200 dark:border-slate-700' : 'border-red-400 bg-red-50 dark:bg-red-900/20'}`} 
                              />
                            </td>
                            <td className="p-2">
                              <input 
                                type="number" step="0.1" min="0" max="100" 
                                value={data.cotaCompradorPct} 
                                onChange={e => handleUpdateMonth(index, 'cotaCompradorPct', Number(e.target.value))} 
                                className={`w-full bg-white dark:bg-slate-900 border rounded-lg px-2 py-1.5 text-xs font-black outline-none focus:border-orange-400 transition-all text-slate-900 dark:text-white ${isValid ? 'border-slate-200 dark:border-slate-700' : 'border-red-400 bg-red-50 dark:bg-red-900/20'}`} 
                              />
                            </td>
                            <td className="p-2 text-xs font-black">
                              {isValid ? (
                                <span className="text-emerald-500">✅</span>
                              ) : (
                                <span className="text-red-500">{totalPct.toFixed(1)}%</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
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