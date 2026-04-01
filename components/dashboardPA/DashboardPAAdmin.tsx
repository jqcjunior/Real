import React, { useState, useEffect } from 'react';
import { 
  Trophy, 
  TrendingUp, 
  Users, 
  Calendar, 
  Settings, 
  Download, 
  ChevronRight,
  Search,
  Filter,
  ArrowUpRight,
  ArrowDownRight,
  DollarSign,
  Store
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { dashboardPAService } from '../../services/dashboardPAService';
import { PAWeek, PAStoreSummary, PAParameters } from '../../types';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface DashboardPAAdminProps {
  user: any;
  stores: any[];
}

const DashboardPAAdmin: React.FC<DashboardPAAdminProps> = ({ user, stores }) => {
  const [weeks, setWeeks] = useState<PAWeek[]>([]);
  const [selectedWeek, setSelectedWeek] = useState<string | null>(null);
  const [summary, setSummary] = useState<PAStoreSummary[]>([]);
  const [params, setParams] = useState<PAParameters | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'parameters' | 'weeks'>('overview');

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (selectedWeek) {
      loadSummary(selectedWeek);
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

  const loadSummary = async (weekId: string) => {
    try {
      const summaryData = await dashboardPAService.getAdminSummary(weekId);
      setSummary(summaryData);
    } catch (error) {
      console.error('Error loading summary:', error);
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
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 md:p-8 space-y-8">
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
                  <div className="flex items-center gap-1 text-emerald-500 bg-emerald-500/10 px-3 py-1 rounded-full text-xs font-bold italic">
                    <ArrowUpRight className="w-3 h-3" />
                    <span>+12%</span>
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
            {/* Store Performance List */}
            <div className="lg:col-span-2 space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-black italic uppercase tracking-tighter text-slate-900 dark:text-white">
                  Performance por <span className="text-orange-500">Loja</span>
                </h2>
                <div className="flex items-center gap-4">
                  <select 
                    value={selectedWeek || ''} 
                    onChange={(e) => setSelectedWeek(e.target.value)}
                    className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[20px] px-4 py-2 font-black italic uppercase tracking-tighter text-xs outline-none focus:border-orange-500 transition-all"
                  >
                    {weeks.map(w => (
                      <option key={w.id} value={w.id}>Semana {w.week_number} - {format(new Date(w.start_date), 'dd/MM', { locale: ptBR })}</option>
                    ))}
                  </select>
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
                      </tr>
                    </thead>
                    <tbody>
                      {summary.map((row, i) => (
                        <motion.tr 
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.05 }}
                          key={row.store_id} 
                          className="group hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all cursor-pointer"
                        >
                          <td className="p-6">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-[16px] bg-orange-500/10 flex items-center justify-center text-orange-500">
                                <Store className="w-5 h-5" />
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
                        </motion.tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Sidebar / Parameters Preview */}
            <div className="space-y-6">
              <h2 className="text-2xl font-black italic uppercase tracking-tighter text-slate-900 dark:text-white">
                Configuração <span className="text-orange-500">Atual</span>
              </h2>
              
              <div className="bg-orange-500 rounded-[40px] p-8 text-white space-y-6 relative overflow-hidden shadow-xl shadow-orange-500/20">
                <div className="absolute top-0 right-0 p-8 opacity-20 transform translate-x-4 -translate-y-4">
                  <Settings className="w-32 h-32" />
                </div>
                
                <div className="relative z-10 space-y-6">
                  <div className="space-y-1">
                    <p className="font-black italic uppercase tracking-tighter text-xs opacity-70">P.A. Mínimo</p>
                    <p className="text-5xl font-black italic uppercase tracking-tighter">{params?.min_pa.toFixed(2)}</p>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/20">
                    <div className="space-y-1">
                      <p className="font-black italic uppercase tracking-tighter text-[10px] opacity-70">Teto P.A.</p>
                      <p className="text-xl font-black italic uppercase tracking-tighter">{params?.max_pa.toFixed(2)}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="font-black italic uppercase tracking-tighter text-[10px] opacity-70">Prêmio Fixo</p>
                      <p className="text-xl font-black italic uppercase tracking-tighter">R$ {params?.award_value}</p>
                    </div>
                  </div>

                  <button 
                    onClick={() => setActiveTab('parameters')}
                    className="w-full py-4 bg-white text-orange-500 rounded-[24px] font-black italic uppercase tracking-tighter text-sm hover:bg-slate-50 transition-all"
                  >
                    Ajustar Parâmetros
                  </button>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="bg-white dark:bg-slate-900 rounded-[40px] p-8 border border-slate-100 dark:border-slate-800 space-y-4">
                <h3 className="font-black italic uppercase tracking-tighter text-slate-900 dark:text-white">Ações Rápidas</h3>
                <div className="space-y-2">
                  <button className="w-full flex items-center justify-between p-4 rounded-[24px] bg-slate-50 dark:bg-slate-800/50 hover:bg-orange-500/10 group transition-all">
                    <div className="flex items-center gap-3">
                      <Download className="w-5 h-5 text-orange-500" />
                      <span className="font-black italic uppercase tracking-tighter text-xs text-slate-600 dark:text-slate-300">Exportar Relatório</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-1 transition-all" />
                  </button>
                  <button className="w-full flex items-center justify-between p-4 rounded-[24px] bg-slate-50 dark:bg-slate-800/50 hover:bg-orange-500/10 group transition-all">
                    <div className="flex items-center gap-3">
                      <Calendar className="w-5 h-5 text-orange-500" />
                      <span className="font-black italic uppercase tracking-tighter text-xs text-slate-600 dark:text-slate-300">Nova Semana</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-1 transition-all" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {activeTab === 'parameters' && (
        <div className="max-w-2xl mx-auto">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-slate-900 rounded-[48px] border border-slate-100 dark:border-slate-800 p-12 shadow-xl"
          >
            <h2 className="text-3xl font-black italic uppercase tracking-tighter text-slate-900 dark:text-white mb-8">
              Configurar <span className="text-orange-500">Parâmetros</span>
            </h2>
            
            <form className="space-y-8" onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              dashboardPAService.updateParameters({
                min_pa: Number(formData.get('min_pa')),
                max_pa: Number(formData.get('max_pa')),
                award_value: Number(formData.get('award_value'))
              }).then(() => {
                loadInitialData();
                setActiveTab('overview');
              });
            }}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-2">
                  <label className="font-black italic uppercase tracking-tighter text-xs text-slate-400">P.A. Mínimo</label>
                  <input 
                    name="min_pa"
                    type="number" 
                    step="0.01"
                    defaultValue={params?.min_pa}
                    className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-[24px] p-6 font-black italic uppercase tracking-tighter text-xl outline-none focus:ring-2 ring-orange-500/50 transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="font-black italic uppercase tracking-tighter text-xs text-slate-400">Teto P.A.</label>
                  <input 
                    name="max_pa"
                    type="number" 
                    step="0.01"
                    defaultValue={params?.max_pa}
                    className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-[24px] p-6 font-black italic uppercase tracking-tighter text-xl outline-none focus:ring-2 ring-orange-500/50 transition-all"
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <label className="font-black italic uppercase tracking-tighter text-xs text-slate-400">Valor da Premiação (R$)</label>
                  <input 
                    name="award_value"
                    type="number" 
                    defaultValue={params?.award_value}
                    className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-[24px] p-6 font-black italic uppercase tracking-tighter text-xl outline-none focus:ring-2 ring-orange-500/50 transition-all"
                  />
                </div>
              </div>

              <div className="flex gap-4 pt-4">
                <button 
                  type="button"
                  onClick={() => setActiveTab('overview')}
                  className="flex-1 py-6 bg-slate-100 dark:bg-slate-800 rounded-[32px] font-black italic uppercase tracking-tighter text-slate-600 dark:text-slate-300 hover:bg-slate-200 transition-all"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  className="flex-1 py-6 bg-orange-500 text-white rounded-[32px] font-black italic uppercase tracking-tighter shadow-lg shadow-orange-500/20 hover:bg-orange-600 transition-all"
                >
                  Salvar Alterações
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default DashboardPAAdmin;
