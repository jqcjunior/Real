import React, { useState, useMemo } from 'react';
import { User, Store, ProductPerformance } from '../types';
import { formatCurrency, formatDecimal } from '../constants';
import { ShoppingBag, DollarSign, Package, Hash, AlertCircle, Trophy, BarChart3, TrendingUp, Target, Clock, BrainCircuit, Sparkles, Loader2, Zap, X } from 'lucide-react';
import { analyzePerformance } from '../services/geminiService';

interface DashboardManagerProps {
  user: User;
  stores: Store[];
  performanceData: any[]; 
  purchasingData: ProductPerformance[];
}

const KPICard = ({ label, value, target, icon: Icon, type = 'currency', color = 'blue' }: { label: string, value: number, target?: number, icon: any, type?: 'currency' | 'decimal' | 'integer', color?: string }) => {
  const ating = target && target > 0 ? (value / target) * 100 : 0;
  const isOk = ating >= 100;
  const colorClass = color === 'blue' ? 'text-blue-600' : color === 'emerald' ? 'text-emerald-600' : 'text-orange-600';
  
  const formattedValue = type === 'currency' ? formatCurrency(value) : type === 'integer' ? Math.round(value).toLocaleString() : formatDecimal(value);

  return (
    <div className="bg-white p-6 rounded-[28px] shadow-sm border border-slate-100 flex flex-col justify-between hover:border-blue-200 transition-all group min-h-[140px]">
      <div className="flex justify-between items-start">
        <div className={`p-2 bg-slate-50 ${colorClass} rounded-xl group-hover:scale-110 transition-transform`}><Icon size={18} /></div>
        <span className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em]">{label}</span>
      </div>
      <div className="mt-4">
        <h3 className={`text-xl font-black italic tracking-tighter leading-none text-slate-900`}>{formattedValue}</h3>
        {target !== undefined && target > 0 && (
          <div className="mt-2 flex justify-between items-center">
            <div className="flex-1 bg-slate-100 h-1 rounded-full overflow-hidden mr-3">
              <div className={`h-full transition-all duration-1000 ${isOk ? 'bg-green-500' : 'bg-blue-500'}`} style={{ width: `${Math.min(ating, 100)}%` }} />
            </div>
            <span className={`text-[10px] font-black ${isOk ? 'text-green-600' : 'text-blue-600'}`}>{ating.toFixed(0)}%</span>
          </div>
        )}
      </div>
    </div>
  );
};

const DashboardManager: React.FC<DashboardManagerProps> = ({ user, stores, performanceData }) => {
  const [selectedMonth, setSelectedMonth] = useState<string>('2026-02');
  const [aiInsight, setAiInsight] = useState<string>('');
  const [isLoadingAi, setIsLoadingAi] = useState(false);

  const myStore = useMemo(() => stores.find(s => s.id === user.storeId) || stores[0], [stores, user.storeId]);

  const myPerformance = useMemo(() => {
      const p = performanceData.find(pd => String(pd.month) === selectedMonth && String(pd.storeId || pd.store_id) === String(myStore.id));
      if (!p) return null;
      return {
        revAct: Number(p.revenueActual || 0),
        revTgt: Number(p.revenueTarget || 0),
        paAct: Number(p.itemsPerTicket || 0),
        paTgt: Number(p.paTarget || 0),
        puAct: Number(p.unitPriceAverage || 0),
        puTgt: Number(p.puTarget || 0),
        tktAct: Number(p.averageTicket || 0),
        tktTgt: Number(p.ticketTarget || 0),
        itemsAct: Number(p.itemsActual || 0),
        itemsTgt: Number(p.itemsTarget || 0),
        ating: p.revenueTarget > 0 ? (p.revenueActual / p.revenueTarget) * 100 : 0
      };
  }, [performanceData, selectedMonth, myStore]);

  const handleGenerateInsight = async () => {
    setIsLoadingAi(true);
    try {
        const insight = await analyzePerformance(performanceData, stores, 'MANAGER', myStore.id);
        setAiInsight(insight);
    } catch (e) { alert("Erro IA"); } finally { setIsLoadingAi(false); }
  };

  return (
    <div className="p-4 md:p-6 space-y-6 pb-16 min-h-full bg-[#F8FAFC] animate-in fade-in duration-500">
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex justify-between items-center">
            <div className="flex items-center gap-4">
                <div className="p-2.5 bg-blue-700 rounded-xl text-white shadow-lg"><ShoppingBag size={20} /></div>
                <div>
                    <h2 className="text-lg font-black text-slate-900 uppercase italic leading-none">
                        {myStore?.name} <span className="text-blue-700">#{myStore?.number}</span>
                    </h2>
                    <p className="text-[9px] font-bold text-slate-400 uppercase mt-1 tracking-widest">Painel Gerencial Real</p>
                </div>
            </div>
            <div className="flex items-center gap-3">
                <select value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} className="bg-slate-50 px-4 py-2 rounded-xl text-[10px] font-black text-blue-900 uppercase border-none outline-none cursor-pointer">
                    <option value="2026-02">Fevereiro 2026</option>
                    <option value="2026-01">Janeiro 2026</option>
                </select>
                <button onClick={handleGenerateInsight} disabled={isLoadingAi} className="p-2.5 bg-slate-900 text-white rounded-xl shadow-lg active:scale-95 transition-all">
                    {isLoadingAi ? <Loader2 className="animate-spin" size={16} /> : <Sparkles className="text-amber-400" size={16} />}
                </button>
            </div>
        </div>

        {myPerformance ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <KPICard label="Faturamento" value={myPerformance.revAct} target={myPerformance.revTgt} icon={DollarSign} color="blue" />
                <KPICard label="Peças / Atendimento" value={myPerformance.paAct} target={myPerformance.paTgt} icon={Hash} type="decimal" color="orange" />
                <KPICard label="Preço Médio" value={myPerformance.puAct} target={myPerformance.puTgt} icon={Zap} color="emerald" />
                <KPICard label="Ticket Médio" value={myPerformance.tktAct} target={myPerformance.tktTgt} icon={Target} color="blue" />
            </div>
        ) : (
            <div className="p-20 text-center bg-white rounded-3xl shadow-sm border border-slate-100 opacity-30 grayscale">
                <AlertCircle className="mx-auto mb-2" size={48} />
                <p className="text-[10px] font-black uppercase tracking-[0.3em]">Aguardando dados online do período</p>
            </div>
        )}
        
        {aiInsight && (
           <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
               <div className="bg-white rounded-[40px] w-full max-w-xl shadow-2xl animate-in zoom-in duration-300 overflow-hidden">
                    <div className="p-6 bg-slate-900 text-white flex justify-between items-center">
                        <h3 className="text-sm font-black uppercase italic tracking-tighter flex items-center gap-2"><BrainCircuit className="text-blue-500" size={18} /> Consultoria <span className="text-blue-500">Gemini Pro</span></h3>
                        <button onClick={() => setAiInsight('')} className="hover:text-red-400 transition-colors"><X size={20} /></button>
                    </div>
                    <div className="p-8">
                        <div className="bg-slate-50 p-6 rounded-2xl text-slate-700 text-xs font-medium leading-relaxed max-h-[50vh] overflow-y-auto no-scrollbar shadow-inner">
                            {aiInsight.split('\n').map((line, i) => <p key={i} className="mb-3">{line}</p>)}
                        </div>
                        <button onClick={() => setAiInsight('')} className="w-full mt-6 py-4 bg-blue-600 text-white rounded-xl font-black uppercase text-[10px] tracking-widest active:scale-95 transition-all">Entendido</button>
                    </div>
               </div>
           </div>
        )}
    </div>
  );
};

export default DashboardManager;