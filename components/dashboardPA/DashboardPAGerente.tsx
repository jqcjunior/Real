import React, { useState, useEffect, useRef } from 'react';
import { 
  Trophy, 
  TrendingUp, 
  Users, 
  Upload, 
  ChevronRight,
  ArrowUpRight,
  DollarSign,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { dashboardPAService } from '../../services/dashboardPAService';
import { PAWeek, PASale, PAParameters } from '../../types/pa';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import * as XLSX from 'xlsx';

interface DashboardPAGerenteProps {
  user: any;
  store: any;
}

const DashboardPAGerente: React.FC<DashboardPAGerenteProps> = ({ user, store }) => {
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [weeks, setWeeks] = useState<PAWeek[]>([]);
  const [selectedWeek, setSelectedWeek] = useState<string | null>(null);
  const [sales, setSales] = useState<PASale[]>([]);
  const [params, setParams] = useState<PAParameters | null>(null);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadInitialData();
  }, [selectedMonth, selectedYear]);

  useEffect(() => {
    if (selectedWeek) {
      loadSales(selectedWeek);
    }
  }, [selectedWeek]);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const loadInitialData = async () => {
    try {
      setLoading(true);
      const [paramsData, weeksData] = await Promise.all([
        dashboardPAService.getParameters(store.id),
        dashboardPAService.getWeeks(store.id, selectedYear, selectedMonth)
      ]);
      
      setParams(paramsData);
      setWeeks(weeksData);
      
      if (weeksData.length > 0) {
        const activeWeek = weeksData.find(w => w.status === 'aberta') || weeksData[0];
        setSelectedWeek(activeWeek.id);
      } else {
        setSelectedWeek(null);
        setSales([]);
      }
    } catch (error) {
      console.error('Error loading initial data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadSales = async (weekId: string) => {
    try {
      const salesData = await dashboardPAService.getStoreSales(weekId, store.id);
      setSales(salesData);
    } catch (error) {
      console.error('Error loading sales:', error);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedWeek) return;

    setImporting(true);
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);

        // Map XLS columns to our structure
        const mappedData = data.map((row: any) => {
          // Normalize keys to uppercase to handle variations
          const upperRow: any = {};
          Object.keys(row).forEach(key => {
            upperRow[key.toUpperCase()] = row[key];
          });

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

        if (mappedData.length === 0) {
          throw new Error('Nenhum dado válido encontrado no arquivo.');
        }

        await dashboardPAService.importSales(selectedWeek, store.id, mappedData, user.email || user.name);
        await loadSales(selectedWeek);
        setShowImportModal(false);
        showToast('Importação concluída com sucesso!', 'success');
      } catch (error: any) {
        console.error('Error importing XLS:', error);
        showToast(error.message || 'Erro ao importar arquivo. Verifique o formato.', 'error');
      } finally {
        setImporting(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsBinaryString(file);
  };

  const totalStoreSales = sales.reduce((acc, curr) => acc + curr.total_vendas, 0);
  const totalAwards = sales.reduce((acc, curr) => acc + (curr.valor_premio || 0), 0);
  const avgPA = sales.length > 0 ? sales.reduce((acc, curr) => acc + curr.pa, 0) / sales.length : 0;

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
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 md:p-8 space-y-8">
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
            <span className="font-black italic uppercase tracking-tighter text-xl">{store.name}</span>
          </div>
          <h1 className="text-4xl md:text-6xl font-black italic uppercase tracking-tighter text-slate-900 dark:text-white leading-none">
            Performance <span className="text-orange-500">P.A.</span>
          </h1>
          <p className="text-slate-500 dark:text-slate-400 font-medium uppercase tracking-widest text-xs italic">
            Acompanhamento Semanal de Vendedores
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2 bg-white dark:bg-slate-900 p-2 rounded-[24px] border border-slate-100 dark:border-slate-800 shadow-sm">
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

          <select 
            value={selectedWeek || ''} 
            onChange={(e) => setSelectedWeek(e.target.value)}
            className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[24px] px-6 py-4 font-black italic uppercase tracking-tighter text-sm outline-none focus:border-orange-500 transition-all shadow-sm"
          >
            {weeks.length === 0 && <option value="">Nenhuma semana encontrada</option>}
            {weeks.map(w => (
              <option key={w.id} value={w.id}>
                {format(new Date(w.data_inicio), 'dd/MM', { locale: ptBR })} a {format(new Date(w.data_fim), 'dd/MM', { locale: ptBR })} ({w.status})
              </option>
            ))}
          </select>
          
          <button 
            onClick={() => setShowImportModal(true)}
            disabled={!selectedWeek}
            className="flex items-center gap-3 px-8 py-4 bg-orange-500 text-white rounded-[24px] font-black italic uppercase tracking-tighter text-sm shadow-lg shadow-orange-500/20 hover:bg-orange-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Upload className="w-5 h-5" />
            <span>Importar XLS</span>
          </button>
        </div>
      </header>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { label: 'Vendas da Loja', value: `R$ ${totalStoreSales.toLocaleString()}`, icon: TrendingUp, color: 'orange' },
          { label: 'P.A. Médio', value: avgPA.toFixed(2), icon: Trophy, color: 'blue' },
          { label: 'Premiação Total', value: `R$ ${totalAwards.toLocaleString()}`, icon: DollarSign, color: 'emerald' }
        ].map((stat, i) => (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            key={stat.label}
            className="bg-white dark:bg-slate-900 p-8 rounded-[40px] border border-slate-100 dark:border-slate-800 shadow-sm"
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

      {/* Sellers Table */}
      <div className="space-y-6">
        <h2 className="text-2xl font-black italic uppercase tracking-tighter text-slate-900 dark:text-white">
          Performance dos <span className="text-orange-500">Vendedores</span>
        </h2>

        <div className="bg-white dark:bg-slate-900 rounded-[48px] border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-bottom border-slate-50 dark:border-slate-800/50">
                  <th className="p-6 font-black italic uppercase tracking-tighter text-xs text-slate-400">Vendedor</th>
                  <th className="p-6 font-black italic uppercase tracking-tighter text-xs text-slate-400">Total Vendas</th>
                  <th className="p-6 font-black italic uppercase tracking-tighter text-xs text-slate-400 text-center">P.A.</th>
                  <th className="p-6 font-black italic uppercase tracking-tighter text-xs text-slate-400 text-center">Itens</th>
                  <th className="p-6 font-black italic uppercase tracking-tighter text-xs text-slate-400 text-center">Status</th>
                  <th className="p-6 font-black italic uppercase tracking-tighter text-xs text-slate-400 text-right">Prêmio</th>
                </tr>
              </thead>
              <tbody>
                {sales.map((row, i) => (
                  <motion.tr 
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    key={row.id} 
                    className="group hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all"
                  >
                    <td className="p-6">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-[16px] bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 font-black italic uppercase tracking-tighter text-xs">
                          {row.nome_vendedor.substring(0, 2)}
                        </div>
                        <div className="flex flex-col">
                          <span className="font-black italic uppercase tracking-tighter text-slate-900 dark:text-white leading-none">{row.nome_vendedor}</span>
                          <span className="text-[10px] text-slate-400 font-bold uppercase italic tracking-tighter">COD: {row.cod_vendedor}</span>
                        </div>
                      </div>
                    </td>
                    <td className="p-6 font-black italic uppercase tracking-tighter text-slate-900 dark:text-white">
                      R$ {row.total_vendas.toLocaleString()}
                    </td>
                    <td className="p-6 text-center">
                      <span className={`px-4 py-1 rounded-full font-black italic uppercase tracking-tighter text-xs ${
                        row.pa >= (params?.pa_inicial || 0) 
                          ? 'bg-emerald-500/10 text-emerald-500' 
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                      }`}>
                        {row.pa.toFixed(2)}
                      </span>
                    </td>
                    <td className="p-6 text-center font-black italic uppercase tracking-tighter text-slate-900 dark:text-white">
                      {row.qtde_itens}
                    </td>
                    <td className="p-6 text-center">
                      {row.atingiu_meta ? (
                        <div className="flex flex-col items-center justify-center text-emerald-500">
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4" />
                            <span className="font-black italic uppercase tracking-tighter text-[10px]">PREMIADO</span>
                          </div>
                          {row.faixas_acima && row.faixas_acima > 0 ? (
                            <span className="text-[8px] font-bold uppercase italic tracking-tighter">+{row.faixas_acima} faixas</span>
                          ) : null}
                        </div>
                      ) : (
                        <div className="flex items-center justify-center gap-2 text-slate-400">
                          <AlertCircle className="w-4 h-4" />
                          <span className="font-black italic uppercase tracking-tighter text-[10px]">NÃO ATINGIU</span>
                        </div>
                      )}
                    </td>
                    <td className="p-6 text-right font-black italic uppercase tracking-tighter text-emerald-500">
                      {row.atingiu_meta ? `R$ ${row.valor_premio}` : '-'}
                    </td>
                  </motion.tr>
                ))}
                {sales.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-20 text-center">
                      <div className="flex flex-col items-center gap-4 opacity-20">
                        <FileSpreadsheet className="w-16 h-16" />
                        <p className="font-black italic uppercase tracking-tighter">Nenhum dado importado para esta semana.</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Import Modal */}
      <AnimatePresence>
        {showImportModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowImportModal(false)}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-xl bg-white dark:bg-slate-900 rounded-[48px] p-12 shadow-2xl overflow-hidden"
            >
              <button 
                onClick={() => setShowImportModal(false)}
                className="absolute top-8 right-8 p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-all"
              >
                <X className="w-6 h-6" />
              </button>

              <div className="space-y-8">
                <div className="space-y-2">
                  <h3 className="text-3xl font-black italic uppercase tracking-tighter text-slate-900 dark:text-white leading-none">
                    Importar <span className="text-orange-500">Relatório XLS</span>
                  </h3>
                  <p className="text-slate-500 dark:text-slate-400 font-black italic uppercase tracking-tighter text-xs">
                    Selecione o arquivo exportado do sistema de vendas.
                  </p>
                </div>

                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="border-4 border-dashed border-slate-100 dark:border-slate-800 rounded-[40px] p-12 flex flex-col items-center gap-4 cursor-pointer hover:border-orange-500/50 hover:bg-orange-500/5 transition-all group"
                >
                  <div className="p-6 rounded-[32px] bg-orange-500/10 text-orange-500 group-hover:scale-110 transition-all">
                    <Upload className="w-10 h-10" />
                  </div>
                  <div className="text-center">
                    <p className="font-black italic uppercase tracking-tighter text-slate-900 dark:text-white">Clique para selecionar</p>
                    <p className="text-slate-400 font-black italic uppercase tracking-tighter text-[10px]">Formatos aceitos: .xls, .xlsx</p>
                  </div>
                  <input 
                    ref={fileInputRef}
                    type="file" 
                    accept=".xls,.xlsx"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </div>

                <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-[32px] space-y-3">
                  <p className="font-black italic uppercase tracking-tighter text-[10px] text-slate-400">Instruções de Formato:</p>
                  <ul className="space-y-1">
                    {['Código', 'Vendedor', 'Qtde Vendas', 'PA', 'Total'].map(col => (
                      <li key={col} className="flex items-center gap-2 text-xs font-black italic uppercase tracking-tighter text-slate-600 dark:text-slate-300">
                        <div className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                        <span>Coluna: {col}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {importing && (
                  <div className="flex items-center justify-center gap-3 text-orange-500 font-black italic uppercase tracking-tighter">
                    <motion.div 
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                      className="w-5 h-5 border-2 border-orange-500 border-t-transparent rounded-full"
                    />
                    <span>Processando arquivo...</span>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default DashboardPAGerente;
