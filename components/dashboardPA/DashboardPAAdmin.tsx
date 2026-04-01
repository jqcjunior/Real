import React, { useState, useEffect, useRef } from 'react';
import { 
  Trophy, 
  TrendingUp, 
  Users, 
  Calendar, 
  Settings, 
  Upload, 
  ChevronRight,
  ArrowUpRight,
  DollarSign,
  Store as StoreIcon,
  Plus,
  X,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Clock
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { dashboardPAService } from '../../services/dashboardPAService';
import { PAWeek, PAStoreSummary, PAParameters } from '../../types/pa';
import { Store } from '../../types';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import * as XLSX from 'xlsx';

interface DashboardPAAdminProps {
  user: any;
  stores: Store[];
}

const DashboardPAAdmin: React.FC<DashboardPAAdminProps> = ({ user, stores }) => {
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [weeks, setWeeks] = useState<PAWeek[]>([]);
  const [selectedWeek, setSelectedWeek] = useState<string | null>(null);
  const [summary, setSummary] = useState<PAStoreSummary[]>([]);
  const [params, setParams] = useState<PAParameters | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'parameters' | 'weeks'>('overview');
  
  // Admin specific states
  const [selectedStoreId, setSelectedStoreId] = useState<string>(stores[0]?.id || '');
  const [showImportModal, setShowImportModal] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importStoreId, setImportStoreId] = useState<string>('');
  const [importWeekId, setImportWeekId] = useState<string>('');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Weeks tab states
  const [showNewWeekModal, setShowNewWeekModal] = useState(false);
  const [newWeekData, setNewWeekData] = useState({
    store_id: stores[0]?.id || '',
    data_inicio: format(new Date(), 'yyyy-MM-dd'),
    data_fim: format(new Date(), 'yyyy-MM-dd'),
    mes_ref: new Date().getMonth() + 1,
    ano_ref: new Date().getFullYear()
  });

  useEffect(() => {
    loadInitialData();
  }, [selectedMonth, selectedYear]);

  useEffect(() => {
    if (selectedWeek) {
      loadSummary(selectedWeek);
    }
  }, [selectedWeek]);

  useEffect(() => {
    if (activeTab === 'parameters' && selectedStoreId) {
      loadStoreParams(selectedStoreId);
    }
    if (activeTab === 'weeks' && selectedStoreId) {
      loadStoreWeeks(selectedStoreId);
    }
  }, [activeTab, selectedStoreId, selectedMonth, selectedYear]);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const loadInitialData = async () => {
    try {
      setLoading(true);
      const weeksData = await dashboardPAService.getAllWeeks(selectedYear, selectedMonth);
      setWeeks(weeksData);
      
      if (weeksData.length > 0) {
        const activeWeek = weeksData.find(w => w.status === 'aberta') || weeksData[0];
        setSelectedWeek(activeWeek.id);
      } else {
        setSelectedWeek(null);
        setSummary([]);
      }
    } catch (error) {
      console.error('Error loading initial data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStoreParams = async (storeId: string) => {
    try {
      const data = await dashboardPAService.getParameters(storeId);
      setParams(data);
    } catch (error) {
      console.error('Error loading params:', error);
    }
  };

  const loadStoreWeeks = async (storeId: string) => {
    try {
      const data = await dashboardPAService.getWeeks(storeId, selectedYear, selectedMonth);
      setWeeks(data);
    } catch (error) {
      console.error('Error loading weeks:', error);
    }
  };

  const loadSummary = async (weekId: string) => {
    try {
      const summaryData = await dashboardPAService.getAdminSummary(weekId);
      setSummary(summaryData);
    } catch (error) {
      console.error('Error loading summary:', error);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !importWeekId || !importStoreId) return;

    setImporting(true);
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(ws);

        const mappedData = data.map((row: any) => {
          const upperRow: any = {};
          Object.keys(row).forEach(key => upperRow[key.toUpperCase()] = row[key]);

          return {
            cod_vendedor: upperRow['CÓDIGO'] || upperRow['COD'] || upperRow['CODIGO'] || '',
            nome_vendedor: upperRow['VENDEDOR'] || upperRow['NOME'] || '',
            dias_trabalhados: Number(upperRow['DIAS'] || 0),
            qtde_vendas: Number(upperRow['QTDE VENDAS'] || upperRow['QTD VENDAS'] || upperRow['VENDAS'] || 0),
            perc_vendas: String(upperRow['% VENDAS'] || upperRow['PERC VENDAS'] || '0%'),
            qtde_itens: Number(upperRow['QTDE ITENS'] || upperRow['QTD ITENS'] || upperRow['ITENS'] || 0),
            perc_itens: String(upperRow['% ITENS'] || upperRow['PERC ITENS'] || '0%'),
            pa: Number(upperRow['PA'] || upperRow['P.A.'] || 0),
            total_vendas: Number(upperRow['TOTAL'] || upperRow['VENDAS R$'] || 0),
            perc_total: String(upperRow['% TOTAL'] || upperRow['PERC TOTAL'] || '0%')
          };
        }).filter(s => s.nome_vendedor && !isNaN(s.pa));

        await dashboardPAService.importSales(importWeekId, importStoreId, mappedData, user.email || user.name);
        if (selectedWeek === importWeekId) loadSummary(selectedWeek);
        setShowImportModal(false);
        showToast('Importação concluída com sucesso!', 'success');
      } catch (error: any) {
        showToast(error.message || 'Erro ao importar.', 'error');
      } finally {
        setImporting(false);
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleCreateWeek = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await dashboardPAService.createWeek({
        ...newWeekData,
        status: 'aberta'
      });
      showToast('Semana criada com sucesso!', 'success');
      setShowNewWeekModal(false);
      loadStoreWeeks(selectedStoreId);
    } catch (error) {
      showToast('Erro ao criar semana.', 'error');
    }
  };

  const totalSales = summary.reduce((acc, curr) => acc + curr.total_sales, 0);
  const totalAwards = summary.reduce((acc, curr) => acc + curr.total_awards, 0);
  const totalEligible = summary.reduce((acc, curr) => acc + curr.eligible_sellers, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50 dark:bg-slate-950">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full"
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 md:p-8 space-y-8 pb-24">
      {/* Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`fixed top-8 left-1/2 -translate-x-1/2 z-[100] px-8 py-4 rounded-[24px] font-black italic uppercase tracking-tighter text-sm shadow-2xl ${
              toast.type === 'success' ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'
            }`}
          >
            {toast.message}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header Section */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-3 text-orange-500">
            <Trophy className="w-8 h-8" />
            <span className="font-black italic uppercase tracking-tighter text-xl">Módulo Performance</span>
          </div>
          <h1 className="text-4xl md:text-6xl font-black italic uppercase tracking-tighter text-slate-900 dark:text-white leading-none">
            Dashboard <span className="text-orange-500">P.A.</span>
          </h1>
          <p className="text-slate-500 dark:text-slate-400 font-medium uppercase tracking-widest text-xs italic">
            Gestão de Performance e Premiações Semanais
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2 bg-white dark:bg-slate-900 p-2 rounded-[32px] border border-slate-100 dark:border-slate-800 shadow-sm">
            <select 
              value={selectedMonth} 
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              className="bg-transparent border-none px-4 py-2 font-black italic uppercase tracking-tighter text-xs outline-none"
            >
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i + 1} value={i + 1}>
                  {format(new Date(2024, i, 1), 'MMMM', { locale: ptBR })}
                </option>
              ))}
            </select>
            <select 
              value={selectedYear} 
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="bg-transparent border-none px-4 py-2 font-black italic uppercase tracking-tighter text-xs outline-none"
            >
              {[2024, 2025, 2026].map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 bg-white dark:bg-slate-900 p-2 rounded-[32px] border border-slate-100 dark:border-slate-800 shadow-sm">
            {(['overview', 'parameters', 'weeks'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-6 py-3 rounded-[24px] font-black italic uppercase tracking-tighter text-sm transition-all ${
                activeTab === tab 
                  ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20' 
                  : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
              }`}
            >
              {tab === 'overview' ? 'Geral' : tab === 'parameters' ? 'Parâmetros' : 'Semanas'}
            </button>
          ))}
          </div>
        </div>
      </header>

      {activeTab === 'overview' && (
        <>
          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { label: 'Vendas Totais', value: `R$ ${totalSales.toLocaleString()}`, icon: TrendingUp, color: 'orange' },
              { label: 'Premiações', value: `R$ ${totalAwards.toLocaleString()}`, icon: DollarSign, color: 'emerald' },
              { label: 'Vendedores Premiados', value: totalEligible, icon: Users, color: 'blue' }
            ].map((stat, i) => (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                key={stat.label}
                className="bg-white dark:bg-slate-900 p-8 rounded-[40px] border border-slate-100 dark:border-slate-800 shadow-sm group hover:border-orange-500/50 transition-all"
              >
                <div className="flex justify-between items-start mb-4">
                  <div className={`p-4 rounded-[24px] bg-${stat.color}-500/10 text-${stat.color}-500`}>
                    <stat.icon className="w-6 h-6" />
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-slate-400 font-black italic uppercase tracking-tighter text-xs">{stat.label}</p>
                  <p className="text-3xl font-black italic uppercase tracking-tighter text-slate-900 dark:text-white">
                    {stat.value}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Main Content Area */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-black italic uppercase tracking-tighter text-slate-900 dark:text-white">
                  Performance por <span className="text-orange-500">Loja</span>
                </h2>
                <div className="flex flex-wrap items-center gap-4">
                  <select 
                    value={selectedWeek || ''} 
                    onChange={(e) => setSelectedWeek(e.target.value)}
                    className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[20px] px-4 py-2 font-black italic uppercase tracking-tighter text-xs outline-none focus:border-orange-500 transition-all"
                  >
                    {weeks.length === 0 && <option value="">Nenhuma semana</option>}
                    {weeks.map(w => (
                      <option key={w.id} value={w.id}>
                        {stores.find(s => s.id === w.store_id)?.number} - {format(new Date(w.data_inicio), 'dd/MM')} a {format(new Date(w.data_fim), 'dd/MM')}
                      </option>
                    ))}
                  </select>
                  <button 
                    onClick={() => {
                      setImportStoreId('');
                      setImportWeekId('');
                      setShowImportModal(true);
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-[20px] font-black italic uppercase tracking-tighter text-xs shadow-lg shadow-orange-500/20 hover:bg-orange-600 transition-all"
                  >
                    <Upload className="w-4 h-4" />
                    <span>Importar XLS</span>
                  </button>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 rounded-[48px] border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-bottom border-slate-50 dark:border-slate-800/50">
                        <th className="p-6 font-black italic uppercase tracking-tighter text-xs text-slate-400">Loja</th>
                        <th className="p-6 font-black italic uppercase tracking-tighter text-xs text-slate-400">Vendas</th>
                        <th className="p-6 font-black italic uppercase tracking-tighter text-xs text-slate-400 text-center">P.A. Médio</th>
                        <th className="p-6 font-black italic uppercase tracking-tighter text-xs text-slate-400 text-center">Premiados</th>
                        <th className="p-6 font-black italic uppercase tracking-tighter text-xs text-slate-400 text-right">Total Prêmios</th>
                        <th className="p-6 font-black italic uppercase tracking-tighter text-xs text-slate-400 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summary.map((row, i) => (
                        <motion.tr 
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.05 }}
                          key={row.store_id} 
                          className="group hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all"
                        >
                          <td className="p-6">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-[16px] bg-orange-500/10 flex items-center justify-center text-orange-500">
                                <StoreIcon className="w-5 h-5" />
                              </div>
                              <span className="font-black italic uppercase tracking-tighter text-slate-900 dark:text-white">{row.store_name}</span>
                            </div>
                          </td>
                          <td className="p-6 font-black italic uppercase tracking-tighter text-slate-900 dark:text-white">
                            R$ {row.total_sales.toLocaleString()}
                          </td>
                          <td className="p-6 text-center">
                            <span className="px-4 py-1 rounded-full bg-orange-500/10 text-orange-500 font-black italic uppercase tracking-tighter text-xs">
                              {row.avg_pa.toFixed(2)}
                            </span>
                          </td>
                          <td className="p-6 text-center font-black italic uppercase tracking-tighter text-slate-900 dark:text-white">
                            {row.eligible_sellers}
                          </td>
                          <td className="p-6 text-right font-black italic uppercase tracking-tighter text-emerald-500">
                            R$ {row.total_awards.toLocaleString()}
                          </td>
                          <td className="p-6 text-right">
                            <button 
                              onClick={() => {
                                setImportStoreId(row.store_id);
                                setImportWeekId(selectedWeek || '');
                                setShowImportModal(true);
                              }}
                              className="p-2 text-orange-500 hover:bg-orange-500/10 rounded-full transition-all"
                              title="Importar para esta loja"
                            >
                              <Upload className="w-4 h-4" />
                            </button>
                          </td>
                        </motion.tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <h2 className="text-2xl font-black italic uppercase tracking-tighter text-slate-900 dark:text-white">
                Resumo de <span className="text-orange-500">Metas</span>
              </h2>
              <div className="bg-white dark:bg-slate-900 rounded-[40px] p-8 border border-slate-100 dark:border-slate-800 space-y-6">
                <div className="flex items-center justify-between">
                  <span className="font-black italic uppercase tracking-tighter text-xs text-slate-400">Total de Lojas</span>
                  <span className="font-black italic uppercase tracking-tighter text-slate-900 dark:text-white">{stores.length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-black italic uppercase tracking-tighter text-xs text-slate-400">Lojas com Dados</span>
                  <span className="font-black italic uppercase tracking-tighter text-slate-900 dark:text-white">{summary.length}</span>
                </div>
                <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${(summary.length / stores.length) * 100}%` }}
                    className="h-full bg-orange-500"
                  />
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {activeTab === 'parameters' && (
        <div className="max-w-4xl mx-auto space-y-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <h2 className="text-3xl font-black italic uppercase tracking-tighter text-slate-900 dark:text-white">
              Configurar <span className="text-orange-500">Parâmetros</span>
            </h2>
            <select 
              value={selectedStoreId}
              onChange={(e) => setSelectedStoreId(e.target.value)}
              className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[24px] px-6 py-4 font-black italic uppercase tracking-tighter text-sm outline-none focus:border-orange-500 transition-all shadow-sm"
            >
              {stores.map(s => (
                <option key={s.id} value={s.id}>#{s.number} - {s.name}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-white dark:bg-slate-900 rounded-[48px] border border-slate-100 dark:border-slate-800 p-12 shadow-xl"
            >
              <form className="space-y-8" onSubmit={async (e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                try {
                  await dashboardPAService.upsertParameters({
                    store_id: selectedStoreId,
                    pa_inicial: Number(formData.get('pa_inicial')),
                    incremento_pa: Number(formData.get('incremento_pa')),
                    valor_base: Number(formData.get('valor_base')),
                    incremento_valor: Number(formData.get('incremento_valor')),
                    criado_por_role: user.role,
                    criado_por_id: user.id
                  });
                  showToast('Parâmetros salvos com sucesso!', 'success');
                  loadStoreParams(selectedStoreId);
                } catch (error) {
                  showToast('Erro ao salvar parâmetros.', 'error');
                }
              }}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="font-black italic uppercase tracking-tighter text-xs text-slate-400">P.A. Inicial (Faixa 1)</label>
                    <input name="pa_inicial" type="number" step="0.01" defaultValue={params?.pa_inicial || 1.60} className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-[24px] p-6 font-black italic uppercase tracking-tighter text-xl outline-none focus:ring-2 ring-orange-500/50 transition-all" />
                  </div>
                  <div className="space-y-2">
                    <label className="font-black italic uppercase tracking-tighter text-xs text-slate-400">Incremento P.A. (p/ Faixa)</label>
                    <input name="incremento_pa" type="number" step="0.01" defaultValue={params?.incremento_pa || 0.05} className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-[24px] p-6 font-black italic uppercase tracking-tighter text-xl outline-none focus:ring-2 ring-orange-500/50 transition-all" />
                  </div>
                  <div className="space-y-2">
                    <label className="font-black italic uppercase tracking-tighter text-xs text-slate-400">Valor Base (Faixa 1)</label>
                    <input name="valor_base" type="number" step="0.01" defaultValue={params?.valor_base || 30.00} className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-[24px] p-6 font-black italic uppercase tracking-tighter text-xl outline-none focus:ring-2 ring-orange-500/50 transition-all" />
                  </div>
                  <div className="space-y-2">
                    <label className="font-black italic uppercase tracking-tighter text-xs text-slate-400">Incremento Valor (p/ Faixa)</label>
                    <input name="incremento_valor" type="number" step="0.01" defaultValue={params?.incremento_valor || 10.00} className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-[24px] p-6 font-black italic uppercase tracking-tighter text-xl outline-none focus:ring-2 ring-orange-500/50 transition-all" />
                  </div>
                </div>
                <button type="submit" className="w-full py-6 bg-orange-500 text-white rounded-[32px] font-black italic uppercase tracking-tighter shadow-lg shadow-orange-500/20 hover:bg-orange-600 transition-all">
                  Salvar Parâmetros
                </button>
              </form>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-slate-900 rounded-[48px] p-12 text-white space-y-8"
            >
              <h3 className="text-2xl font-black italic uppercase tracking-tighter">Prévia das <span className="text-orange-500">Faixas</span></h3>
              <div className="space-y-4">
                {[0, 1, 2, 3, 4].map(i => {
                  const pa = (params?.pa_inicial || 1.60) + (i * (params?.incremento_pa || 0.05));
                  const valor = (params?.valor_base || 30.00) + (i * (params?.incremento_valor || 10.00));
                  return (
                    <div key={i} className="flex items-center justify-between p-4 bg-white/5 rounded-[24px] border border-white/10">
                      <div className="flex items-center gap-4">
                        <div className="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center font-black italic text-xs">{i + 1}</div>
                        <span className="font-black italic uppercase tracking-tighter text-sm">P.A. ≥ {pa.toFixed(2)}</span>
                      </div>
                      <span className="font-black italic uppercase tracking-tighter text-orange-500">R$ {valor.toFixed(2)}</span>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          </div>
        </div>
      )}

      {activeTab === 'weeks' && (
        <div className="max-w-4xl mx-auto space-y-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <h2 className="text-3xl font-black italic uppercase tracking-tighter text-slate-900 dark:text-white">
              Gestão de <span className="text-orange-500">Semanas</span>
            </h2>
            <div className="flex items-center gap-4">
              <select 
                value={selectedStoreId}
                onChange={(e) => setSelectedStoreId(e.target.value)}
                className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[24px] px-6 py-4 font-black italic uppercase tracking-tighter text-sm outline-none focus:border-orange-500 transition-all shadow-sm"
              >
                {stores.map(s => (
                  <option key={s.id} value={s.id}>#{s.number} - {s.name}</option>
                ))}
              </select>
              <button 
                onClick={() => {
                  setNewWeekData(prev => ({ 
                    ...prev, 
                    store_id: selectedStoreId,
                    mes_ref: selectedMonth,
                    ano_ref: selectedYear
                  }));
                  setShowNewWeekModal(true);
                }}
                className="flex items-center gap-2 px-6 py-4 bg-orange-500 text-white rounded-[24px] font-black italic uppercase tracking-tighter text-sm shadow-lg shadow-orange-500/20 hover:bg-orange-600 transition-all"
              >
                <Plus className="w-5 h-5" />
                <span>Nova Semana</span>
              </button>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-[48px] border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-bottom border-slate-50 dark:border-slate-800/50">
                  <th className="p-6 font-black italic uppercase tracking-tighter text-xs text-slate-400">Período</th>
                  <th className="p-6 font-black italic uppercase tracking-tighter text-xs text-slate-400 text-center">Referência</th>
                  <th className="p-6 font-black italic uppercase tracking-tighter text-xs text-slate-400 text-center">Status</th>
                  <th className="p-6 font-black italic uppercase tracking-tighter text-xs text-slate-400 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {weeks.map((week, i) => (
                  <motion.tr 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    key={week.id} 
                    className="group border-b border-slate-50 dark:border-slate-800/50"
                  >
                    <td className="p-6">
                      <div className="flex items-center gap-3">
                        <Calendar className="w-5 h-5 text-orange-500" />
                        <span className="font-black italic uppercase tracking-tighter text-slate-900 dark:text-white">
                          {format(new Date(week.data_inicio), 'dd/MM/yyyy')} a {format(new Date(week.data_fim), 'dd/MM/yyyy')}
                        </span>
                      </div>
                    </td>
                    <td className="p-6 text-center font-black italic uppercase tracking-tighter text-slate-600 dark:text-slate-400">
                      {week.mes_ref.toString().padStart(2, '0')}/{week.ano_ref}
                    </td>
                    <td className="p-6 text-center">
                      <span className={`px-4 py-1 rounded-full font-black italic uppercase tracking-tighter text-[10px] ${
                        week.status === 'aberta' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                      }`}>
                        {week.status}
                      </span>
                    </td>
                    <td className="p-6 text-right">
                      <button 
                        onClick={async () => {
                          const newStatus = week.status === 'aberta' ? 'bloqueada' : 'aberta';
                          await dashboardPAService.updateWeekStatus(week.id, newStatus);
                          loadStoreWeeks(selectedStoreId);
                        }}
                        className="font-black italic uppercase tracking-tighter text-xs text-orange-500 hover:underline"
                      >
                        {week.status === 'aberta' ? 'Fechar' : 'Abrir'}
                      </button>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Import Modal */}
      <AnimatePresence>
        {showImportModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowImportModal(false)} className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative w-full max-w-xl bg-white dark:bg-slate-900 rounded-[48px] p-12 shadow-2xl overflow-hidden">
              <button onClick={() => setShowImportModal(false)} className="absolute top-8 right-8 p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-all"><X className="w-6 h-6" /></button>
              <div className="space-y-8">
                <div className="space-y-2">
                  <h3 className="text-3xl font-black italic uppercase tracking-tighter text-slate-900 dark:text-white leading-none">Importar <span className="text-orange-500">XLS</span></h3>
                  <p className="text-slate-500 dark:text-slate-400 font-black italic uppercase tracking-tighter text-xs">Selecione a loja e a semana para importar os dados.</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="font-black italic uppercase tracking-tighter text-[10px] text-slate-400">Loja</label>
                    <select value={importStoreId} onChange={(e) => setImportStoreId(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-800 rounded-[16px] p-4 font-black italic uppercase tracking-tighter text-xs outline-none focus:ring-2 ring-orange-500/50 transition-all">
                      <option value="">Selecionar Loja</option>
                      {stores.map(s => <option key={s.id} value={s.id}>#{s.number} - {s.name}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="font-black italic uppercase tracking-tighter text-[10px] text-slate-400">Semana</label>
                    <select value={importWeekId} onChange={(e) => setImportWeekId(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-800 rounded-[16px] p-4 font-black italic uppercase tracking-tighter text-xs outline-none focus:ring-2 ring-orange-500/50 transition-all">
                      <option value="">Selecionar Semana</option>
                      {weeks.filter(w => !importStoreId || w.store_id === importStoreId).map(w => (
                        <option key={w.id} value={w.id}>{format(new Date(w.data_inicio), 'dd/MM')} a {format(new Date(w.data_fim), 'dd/MM')}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div onClick={() => fileInputRef.current?.click()} className="border-4 border-dashed border-slate-100 dark:border-slate-800 rounded-[40px] p-12 flex flex-col items-center gap-4 cursor-pointer hover:border-orange-500/50 hover:bg-orange-500/5 transition-all group">
                  <div className="p-6 rounded-[32px] bg-orange-500/10 text-orange-500 group-hover:scale-110 transition-all"><Upload className="w-10 h-10" /></div>
                  <div className="text-center">
                    <p className="font-black italic uppercase tracking-tighter text-slate-900 dark:text-white">Clique para selecionar</p>
                    <p className="text-slate-400 font-black italic uppercase tracking-tighter text-[10px]">Formatos aceitos: .xls, .xlsx</p>
                  </div>
                  <input ref={fileInputRef} type="file" accept=".xls,.xlsx" onChange={handleFileUpload} className="hidden" />
                </div>
                {importing && (
                  <div className="flex items-center justify-center gap-3 text-orange-500 font-black italic uppercase tracking-tighter">
                    <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }} className="w-5 h-5 border-2 border-orange-500 border-t-transparent rounded-full" />
                    <span>Processando...</span>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* New Week Modal */}
      <AnimatePresence>
        {showNewWeekModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowNewWeekModal(false)} className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative w-full max-w-xl bg-white dark:bg-slate-900 rounded-[48px] p-12 shadow-2xl">
              <button onClick={() => setShowNewWeekModal(false)} className="absolute top-8 right-8 p-2 text-slate-400 hover:text-slate-600 transition-all"><X className="w-6 h-6" /></button>
              <h3 className="text-3xl font-black italic uppercase tracking-tighter text-slate-900 dark:text-white mb-8">Nova <span className="text-orange-500">Semana</span></h3>
              <form onSubmit={handleCreateWeek} className="space-y-6">
                <div className="space-y-2">
                  <label className="font-black italic uppercase tracking-tighter text-xs text-slate-400">Loja</label>
                  <select value={newWeekData.store_id} onChange={e => setNewWeekData({...newWeekData, store_id: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-800 rounded-[20px] p-4 font-black italic uppercase tracking-tighter outline-none focus:ring-2 ring-orange-500/50">
                    {stores.map(s => <option key={s.id} value={s.id}>#{s.number} - {s.name}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="font-black italic uppercase tracking-tighter text-xs text-slate-400">Início</label>
                    <input type="date" value={newWeekData.data_inicio} onChange={e => setNewWeekData({...newWeekData, data_inicio: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-800 rounded-[20px] p-4 font-black italic uppercase tracking-tighter outline-none focus:ring-2 ring-orange-500/50" />
                  </div>
                  <div className="space-y-2">
                    <label className="font-black italic uppercase tracking-tighter text-xs text-slate-400">Fim</label>
                    <input type="date" value={newWeekData.data_fim} onChange={e => setNewWeekData({...newWeekData, data_fim: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-800 rounded-[20px] p-4 font-black italic uppercase tracking-tighter outline-none focus:ring-2 ring-orange-500/50" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="font-black italic uppercase tracking-tighter text-xs text-slate-400">Mês Ref.</label>
                    <input type="number" value={newWeekData.mes_ref} onChange={e => setNewWeekData({...newWeekData, mes_ref: Number(e.target.value)})} className="w-full bg-slate-50 dark:bg-slate-800 rounded-[20px] p-4 font-black italic uppercase tracking-tighter outline-none focus:ring-2 ring-orange-500/50" />
                  </div>
                  <div className="space-y-2">
                    <label className="font-black italic uppercase tracking-tighter text-xs text-slate-400">Ano Ref.</label>
                    <input type="number" value={newWeekData.ano_ref} onChange={e => setNewWeekData({...newWeekData, ano_ref: Number(e.target.value)})} className="w-full bg-slate-50 dark:bg-slate-800 rounded-[20px] p-4 font-black italic uppercase tracking-tighter outline-none focus:ring-2 ring-orange-500/50" />
                  </div>
                </div>
                <button type="submit" className="w-full py-6 bg-orange-500 text-white rounded-[32px] font-black italic uppercase tracking-tighter shadow-lg shadow-orange-500/20 hover:bg-orange-600 transition-all">Criar Semana</button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default DashboardPAAdmin;
