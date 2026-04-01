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
import { PAWeek, PASale, PAParameters } from '../../types';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import * as XLSX from 'xlsx';

interface DashboardPAGerenteProps {
  user: any;
  store: any;
}

const DashboardPAGerente: React.FC<DashboardPAGerenteProps> = ({ user, store }) => {
  const [weeks, setWeeks] = useState<PAWeek[]>([]);
  const [selectedWeek, setSelectedWeek] = useState<string | null>(null);
  const [sales, setSales] = useState<PASale[]>([]);
  const [params, setParams] = useState<PAParameters | null>(null);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (selectedWeek) {
      loadSales(selectedWeek);
    }
  }, [selectedWeek]);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      const [paramsData, weeksData] = await Promise.all([
        dashboardPAService.getParameters(),
        dashboardPAService.getWeeks(new Date().getFullYear(), new Date().getMonth() + 1)
      ]);
      
      setParams(paramsData);
      setWeeks(weeksData);
      
      if (weeksData.length > 0) {
        const activeWeek = weeksData.find(w => w.is_active) || weeksData[0];
        setSelectedWeek(activeWeek.id);
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
        // Expected columns: Vendedor, Vendas, PA, Itens
        const mappedData = data.map((row: any) => ({
          seller_name: row['Vendedor'] || row['NOME'] || row['VENDEDOR'],
          total_sales: Number(row['Vendas'] || row['VALOR'] || row['TOTAL']),
          pa_value: Number(row['PA'] || row['P.A.'] || row['PA_VALOR']),
          items_sold: Number(row['Itens'] || row['QTD'] || row['ITENS'])
        })).filter(s => s.seller_name && !isNaN(s.pa_value));

        await dashboardPAService.importSales(selectedWeek, store.id, mappedData);
        await loadSales(selectedWeek);
        setShowImportModal(false);
        alert('Importação concluída com sucesso!');
      } catch (error) {
        console.error('Error importing XLS:', error);
        alert('Erro ao importar arquivo. Verifique o formato.');
      } finally {
        setImporting(false);
      }
    };
    reader.readAsBinaryString(file);
  };

  const totalStoreSales = sales.reduce((acc, curr) => acc + curr.total_sales, 0);
  const totalAwards = sales.reduce((acc, curr) => acc + curr.award_amount, 0);
  const avgPA = sales.length > 0 ? sales.reduce((acc, curr) => acc + curr.pa_value, 0) / sales.length : 0;

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

        <div className="flex items-center gap-4">
          <select 
            value={selectedWeek || ''} 
            onChange={(e) => setSelectedWeek(e.target.value)}
            className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[24px] px-6 py-4 font-black italic uppercase tracking-tighter text-sm outline-none focus:border-orange-500 transition-all shadow-sm"
          >
            {weeks.map(w => (
              <option key={w.id} value={w.id}>Semana {w.week_number} - {format(new Date(w.start_date), 'dd/MM', { locale: ptBR })}</option>
            ))}
          </select>
          
          <button 
            onClick={() => setShowImportModal(true)}
            className="flex items-center gap-3 px-8 py-4 bg-orange-500 text-white rounded-[24px] font-black italic uppercase tracking-tighter text-sm shadow-lg shadow-orange-500/20 hover:bg-orange-600 transition-all"
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
                          {row.seller_name.substring(0, 2)}
                        </div>
                        <span className="font-black italic uppercase tracking-tighter text-slate-900 dark:text-white">{row.seller_name}</span>
                      </div>
                    </td>
                    <td className="p-6 font-black italic uppercase tracking-tighter text-slate-900 dark:text-white">
                      R$ {row.total_sales.toLocaleString()}
                    </td>
                    <td className="p-6 text-center">
                      <span className={`px-4 py-1 rounded-full font-black italic uppercase tracking-tighter text-xs ${
                        row.pa_value >= (params?.min_pa || 0) 
                          ? 'bg-emerald-500/10 text-emerald-500' 
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                      }`}>
                        {row.pa_value.toFixed(2)}
                      </span>
                    </td>
                    <td className="p-6 text-center font-black italic uppercase tracking-tighter text-slate-900 dark:text-white">
                      {row.items_sold}
                    </td>
                    <td className="p-6 text-center">
                      {row.is_eligible ? (
                        <div className="flex items-center justify-center gap-2 text-emerald-500">
                          <CheckCircle2 className="w-4 h-4" />
                          <span className="font-black italic uppercase tracking-tighter text-[10px]">PREMIADO</span>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center gap-2 text-slate-400">
                          <AlertCircle className="w-4 h-4" />
                          <span className="font-black italic uppercase tracking-tighter text-[10px]">NÃO ATINGIU</span>
                        </div>
                      )}
                    </td>
                    <td className="p-6 text-right font-black italic uppercase tracking-tighter text-emerald-500">
                      {row.is_eligible ? `R$ ${row.award_amount}` : '-'}
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
                    {['Vendedor', 'Vendas', 'PA', 'Itens'].map(col => (
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
