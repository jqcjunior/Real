
import React, { useState, useMemo, useRef } from 'react';
import { Store, MonthlyPerformance } from '../types';
import { formatCurrency, formatDecimal } from '../constants';
import { 
    TrendingUp, Target, ShoppingBag, Upload, FileSpreadsheet, Loader2, 
    CheckCircle, X, Trophy, Medal, Crown, DollarSign, ArrowUpRight, 
    BrainCircuit, Sparkles, Zap, Box, Percent, Hash, Tag, BarChart3
} from 'lucide-react';
import { 
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
    Legend, ComposedChart, Line, Area, AreaChart 
} from 'recharts';
import * as XLSX from 'xlsx';
import { analyzePerformance } from '../services/geminiService';

interface DashboardAdminProps {
  stores: Store[];
  performanceData: MonthlyPerformance[];
  onImportData: (data: MonthlyPerformance[]) => Promise<void>; 
  onSaveGoals?: (goals: MonthlyPerformance[]) => Promise<void>;
}

const MONTHS = [
  { value: 1, label: 'Janeiro' }, { value: 2, label: 'Fevereiro' }, { value: 3, label: 'Março' },
  { value: 4, label: 'Abril' }, { value: 5, label: 'Maio' }, { value: 6, label: 'Junho' },
  { value: 7, label: 'Julho' }, { value: 8, label: 'Agosto' }, { value: 9, label: 'Setembro' },
  { value: 10, label: 'Outubro' }, { value: 11, label: 'Novembro' }, { value: 12, label: 'Dezembro' }
];

const DashboardAdmin: React.FC<DashboardAdminProps> = ({ stores, performanceData, onImportData }) => {
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
     const now = new Date();
     return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  const [showImportModal, setShowImportModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [importStatus, setImportStatus] = useState('');
  
  const [aiInsight, setAiInsight] = useState<string>('');
  const [isLoadingAi, setIsLoadingAi] = useState(false);

  const handleMonthYearChange = (type: 'month' | 'year', value: number) => {
      const [currentY, currentM] = selectedMonth.split('-');
      let newY = parseInt(currentY);
      let newM = parseInt(currentM);
      if (type === 'month') newM = value;
      if (type === 'year') newY = value;
      const newStr = `${newY}-${String(newM).padStart(2, '0')}`;
      setSelectedMonth(newStr);
      setAiInsight('');
  };

  const handleGenerateNetworkInsight = async () => {
      setIsLoadingAi(true);
      try {
          const insight = await analyzePerformance(performanceData, stores, 'ADMIN');
          setAiInsight(insight);
      } catch (e) {
          alert("Erro ao gerar análise.");
      } finally {
          setIsLoadingAi(false);
      }
  };

  const availableYears = useMemo(() => {
      const years = new Set<number>();
      const currentYear = new Date().getFullYear();
      years.add(currentYear);
      performanceData.forEach(d => years.add(parseInt(d.month.split('-')[0])));
      for (let y = currentYear - 1; y <= currentYear + 1; y++) years.add(y);
      return Array.from(years).sort((a,b) => b - a);
  }, [performanceData]);

  const currentMonthData = useMemo(() => {
      const data = performanceData.filter(p => p.month === selectedMonth);
      const uniqueMap = new Map();
      data.forEach(p => {
          if (!uniqueMap.has(p.storeId)) uniqueMap.set(p.storeId, p);
      });
      return Array.from(uniqueMap.values());
  }, [performanceData, selectedMonth]);

  const rankedStores = useMemo(() => {
      const withStats = currentMonthData.map(data => {
          const store = stores.find(s => s.id === data.storeId);
          return { 
              ...data, 
              storeName: store?.name || 'Unidade', 
              storeNumber: store?.number || '00', 
              status: store?.status || 'active'
          };
      });
      return withStats
        .filter(s => s.status === 'active')
        .sort((a, b) => b.percentMeta - a.percentMeta)
        .map((item, index) => ({ ...item, rank: index + 1 }));
  }, [currentMonthData, stores]);

  const networkStats = useMemo(() => {
      const totalRevenue = currentMonthData.reduce((acc, curr) => acc + curr.revenueActual, 0);
      const totalTarget = currentMonthData.reduce((acc, curr) => acc + curr.revenueTarget, 0);
      const percentMeta = totalTarget > 0 ? (totalRevenue / totalTarget) * 100 : 0;
      return { totalRevenue, totalTarget, percentMeta };
  }, [currentMonthData]);

  // Gráfico de Performance Meta vs Real
  const chartData = useMemo(() => {
      return rankedStores.slice(0, 10).map(s => ({
          name: s.storeNumber,
          Meta: s.revenueTarget,
          Real: s.revenueActual,
          XP: s.percentMeta
      }));
  }, [rankedStores]);

  const handleProcessImport = async () => {
      if (!selectedFile) return;
      setIsProcessing(true);
      setImportStatus('Sincronizando...');
      try {
          const arrayBuffer = await selectedFile.arrayBuffer();
          const workbook = XLSX.read(arrayBuffer);
          const sheet = workbook.Sheets[workbook.SheetNames[0]];
          const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
          
          let startRowIndex = -1;
          for (let r = 0; r < 20; r++) {
              if (jsonData[r]?.join(' ').toLowerCase().includes('loja')) { startRowIndex = r + 1; break; }
          }
          if (startRowIndex === -1) throw new Error("Formato Excel não reconhecido.");
          
          const results: MonthlyPerformance[] = [];
          for (let i = startRowIndex; i < jsonData.length; i++) {
              const row = jsonData[i];
              if (!row || row.length === 0) continue;
              const storeNumber = String(row[0] || '').replace(/\D/g, '');
              const store = stores.find(s => s.number === String(parseInt(storeNumber)));
              if (store) {
                  const actual = parseFloat(String(row[7]).replace(',', '.')) || 0;
                  const meta = parseFloat(String(row[6]).replace(',', '.')) || 0;
                  results.push({
                      storeId: store.id,
                      month: selectedMonth,
                      revenueTarget: meta,
                      revenueActual: actual,
                      percentMeta: meta > 0 ? (actual / meta) * 100 : 0,
                      itemsActual: parseInt(String(row[2])) || 0,
                      itemsPerTicket: parseFloat(String(row[3])) || 0,
                      unitPriceAverage: parseFloat(String(row[4])) || 0,
                      averageTicket: parseFloat(String(row[5])) || 0,
                      delinquencyRate: parseFloat(String(row[14])) || 0,
                      trend: 'stable',
                      correctedDailyGoal: 0
                  } as MonthlyPerformance);
              }
          }
          if (results.length > 0) {
              await onImportData(results);
              alert("Importação concluída!");
              setShowImportModal(false);
          }
      } catch (err: any) { alert(err.message); } finally { setIsProcessing(false); }
  };

  return (
    <div className="p-8 max-w-full mx-auto space-y-8 animate-in fade-in duration-700">
       
       <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6">
          <div>
            <h2 className="text-4xl font-black text-gray-900 tracking-tighter uppercase italic leading-none flex items-center gap-3">
                <BrainCircuit className="text-blue-700" size={40} />
                Inteligência <span className="text-red-600">Corporativa</span>
            </h2>
            <p className="text-gray-500 font-bold uppercase text-[10px] tracking-[0.3em] mt-3 ml-1">Painel Real Admin v4.5</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
             <div className="flex items-center gap-2 bg-white p-2 rounded-2xl border border-gray-100 shadow-sm">
                <select value={parseInt(selectedMonth.split('-')[1])} onChange={(e) => handleMonthYearChange('month', parseInt(e.target.value))} className="bg-transparent text-gray-700 font-black outline-none cursor-pointer px-2 uppercase text-xs">
                    {MONTHS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
                <div className="w-px h-4 bg-gray-200"></div>
                <select value={parseInt(selectedMonth.split('-')[0])} onChange={(e) => handleMonthYearChange('year', parseInt(e.target.value))} className="bg-transparent text-gray-700 font-black outline-none cursor-pointer px-2 text-xs">
                    {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
             </div>
             <button onClick={() => window.dispatchEvent(new CustomEvent('changeView', { detail: 'metas_registration' }))} className="flex items-center gap-2 bg-gray-900 text-white px-6 py-3 rounded-2xl hover:bg-black transition-all shadow-xl font-black uppercase text-[10px] tracking-widest border-b-4 border-red-600">
                <Target size={16} /> Definir Metas
             </button>
             <button onClick={() => setShowImportModal(true)} className="flex items-center gap-2 bg-green-600 text-white px-6 py-3 rounded-2xl hover:bg-green-700 transition-all shadow-xl font-black uppercase text-[10px] tracking-widest border-b-4 border-green-800">
                <Upload size={16} /> Importar Excel
             </button>
          </div>
       </div>

       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
           <div className="bg-white p-8 rounded-[40px] shadow-sm border border-gray-100 group overflow-hidden relative">
               <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity"><ShoppingBag size={80}/></div>
               <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Faturamento Rede</p>
               <h3 className="text-3xl font-black text-gray-900">{formatCurrency(networkStats.totalRevenue)}</h3>
               <div className="mt-4 flex items-center gap-2">
                   <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                       <div className="h-full bg-blue-600" style={{ width: `${Math.min(networkStats.percentMeta, 100)}%` }}></div>
                   </div>
                   <span className="text-[10px] font-black text-blue-700">{networkStats.percentMeta.toFixed(1)}%</span>
               </div>
           </div>
           <div className="bg-white p-8 rounded-[40px] shadow-sm border border-gray-100 relative group overflow-hidden">
               <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity"><Target size={80}/></div>
               <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Meta Global</p>
               <h3 className="text-3xl font-black text-gray-900">{formatCurrency(networkStats.totalTarget)}</h3>
           </div>
           <div className="bg-gradient-to-br from-blue-900 to-blue-950 p-8 rounded-[40px] shadow-2xl text-white relative group overflow-hidden">
               <div className="absolute top-0 right-0 p-6 opacity-10"><Zap size={80}/></div>
               <p className="text-[10px] font-black text-blue-300 uppercase tracking-widest mb-2">Unidades</p>
               <h3 className="text-4xl font-black italic tracking-tighter">{rankedStores.length} <span className="text-sm not-italic font-bold text-blue-400">ATIVAS</span></h3>
           </div>
           <div className="bg-white p-4 rounded-[40px] shadow-sm border border-gray-100 flex flex-col justify-center items-center text-center group cursor-pointer hover:border-blue-200 transition-all" onClick={handleGenerateNetworkInsight}>
               {isLoadingAi ? (
                   <Loader2 className="animate-spin text-blue-600" size={32} />
               ) : (
                   <>
                       <div className="p-4 bg-blue-50 text-blue-600 rounded-3xl mb-2 group-hover:scale-110 transition-transform"><Sparkles size={24}/></div>
                       <p className="text-[10px] font-black text-gray-900 uppercase tracking-widest">Diagnóstico por IA</p>
                   </>
               )}
           </div>
       </div>

       {/* Visual de Performance Meta vs Real */}
       <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 bg-white p-8 rounded-[48px] shadow-sm border border-gray-100">
                <div className="flex justify-between items-center mb-8">
                    <h3 className="text-lg font-black text-gray-900 uppercase italic tracking-tighter flex items-center gap-3">
                        <BarChart3 className="text-blue-600" size={24} /> Desempenho <span className="text-blue-600">Top 10 Lojas</span>
                    </h3>
                    <div className="flex items-center gap-4 text-[9px] font-black uppercase tracking-widest text-gray-400">
                        <div className="flex items-center gap-1"><div className="w-2 h-2 bg-blue-600 rounded-full"></div> Real</div>
                        <div className="flex items-center gap-1"><div className="w-2 h-2 bg-gray-200 rounded-full"></div> Meta</div>
                    </div>
                </div>
                <div className="h-[400px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                            <XAxis dataKey="name" axisLine={false} tickLine={false} fontSize={10} fontStyle="bold" dy={10} />
                            <YAxis axisLine={false} tickLine={false} fontSize={10} tickFormatter={(v) => `R$${v/1000}k`} />
                            <Tooltip 
                                contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 20px 40px rgba(0,0,0,0.1)', fontWeight: 'bold' }}
                                formatter={(v: number) => formatCurrency(v)}
                            />
                            <Bar dataKey="Real" fill="#3b82f6" radius={[10, 10, 0, 0]} barSize={40} />
                            <Bar dataKey="Meta" fill="#e5e7eb" radius={[10, 10, 0, 0]} barSize={40} />
                            <Line type="monotone" dataKey="XP" stroke="#ef4444" strokeWidth={3} dot={{ fill: '#ef4444', r: 4 }} yAxisId={0} />
                        </ComposedChart>
                    </ResponsiveContainer>
                </div>
            </div>

            <div className="bg-gradient-to-br from-gray-900 to-black p-8 rounded-[48px] shadow-2xl text-white">
                <h3 className="text-lg font-black uppercase italic tracking-tighter mb-8 flex items-center gap-3">
                    <Trophy className="text-yellow-500" size={24} /> Hall da <span className="text-yellow-500">Fama</span>
                </h3>
                <div className="space-y-6">
                    {rankedStores.slice(0, 3).map((s, i) => (
                        <div key={s.storeId} className={`p-6 rounded-[32px] border-2 flex items-center gap-6 transition-all hover:scale-105 ${i === 0 ? 'bg-yellow-500/10 border-yellow-500/30' : i === 1 ? 'bg-gray-400/10 border-gray-400/30' : 'bg-orange-500/10 border-orange-500/30'}`}>
                            <div className="relative">
                                {i === 0 ? <Crown size={40} className="text-yellow-500" /> : <Medal size={40} className={i === 1 ? 'text-gray-400' : 'text-orange-500'} />}
                                <div className="absolute -top-2 -right-2 bg-white text-black w-6 h-6 rounded-full flex items-center justify-center font-black text-xs">#{i+1}</div>
                            </div>
                            <div className="flex-1">
                                <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Loja {s.storeNumber}</p>
                                <p className="text-lg font-black uppercase italic truncate">{s.storeName}</p>
                                <div className="mt-2 flex items-center gap-2">
                                    <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden">
                                        <div className="h-full bg-yellow-500" style={{ width: `${Math.min(s.percentMeta, 100)}%` }}></div>
                                    </div>
                                    <span className="text-[10px] font-black text-yellow-500">{s.percentMeta.toFixed(1)}%</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
                <div className="mt-10 p-6 bg-white/5 rounded-[32px] border border-white/10 text-center">
                    <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Média da Rede</p>
                    <p className="text-3xl font-black italic">{networkStats.percentMeta.toFixed(1)}%</p>
                </div>
            </div>
       </div>

       {aiInsight && (
           <div className="bg-white border-2 border-blue-100 rounded-[40px] p-8 shadow-xl animate-in slide-in-from-top-4 duration-500">
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-lg"><Sparkles size={20}/></div>
                    <h4 className="text-sm font-black text-gray-900 uppercase italic tracking-tight">Relatório Executivo <span className="text-blue-600">Gemini IA</span></h4>
                </div>
                <div className="prose prose-sm max-w-none text-gray-700 font-medium leading-relaxed" dangerouslySetInnerHTML={{ __html: aiInsight.replace(/\n/g, '<br/>') }} />
           </div>
       )}

       <div className="bg-white rounded-[48px] shadow-xl border border-gray-100 overflow-hidden">
          <div className="p-8 border-b border-gray-50 flex justify-between items-center bg-gray-50/50">
             <h3 className="text-xl font-black text-gray-900 uppercase italic tracking-tighter flex items-center gap-3">
                <Trophy className="text-yellow-500" size={24} /> Ranking de <span className="text-blue-700">Performance Detalhado</span>
             </h3>
          </div>
          
          <div className="overflow-x-auto no-scrollbar">
            <table className="w-full text-left min-w-[1400px]">
                <thead>
                    <tr className="bg-white text-[9px] font-black text-gray-400 uppercase tracking-[0.2em] border-b">
                        <th className="px-6 py-6 text-center">Rank</th>
                        <th className="px-6 py-6">Loja / Unidade</th>
                        <th className="px-6 py-6 text-right">Faturamento</th>
                        <th className="px-6 py-6 text-center">XP (%)</th>
                        <th className="px-6 py-6 text-center">Itens</th>
                        <th className="px-6 py-6 text-center">P.A</th>
                        <th className="px-6 py-6 text-center">P.U</th>
                        <th className="px-6 py-6 text-center">Ticket</th>
                        <th className="px-6 py-6 text-center">Inadimp.</th>
                        <th className="px-6 py-6 text-right">Meta Est.</th>
                        <th className="px-6 py-6 text-center">Status</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                    {rankedStores.map((item, idx) => (
                        <tr key={item.storeId} className="hover:bg-blue-50/40 transition-all group">
                            <td className="px-6 py-6 text-center">
                                <div className="flex flex-col items-center justify-center">
                                    {idx === 0 ? <Crown className="text-yellow-500 mb-1" size={18} /> : idx === 1 ? <Medal className="text-gray-400 mb-1" size={16} /> : idx === 2 ? <Medal className="text-orange-400 mb-1" size={16} /> : null}
                                    <span className={`text-base font-black ${idx < 3 ? 'text-gray-900' : 'text-gray-300'}`}>#{item.rank}</span>
                                </div>
                            </td>
                            <td className="px-6 py-6">
                                <span className="text-sm font-black text-gray-900 uppercase italic tracking-tight">{item.storeNumber} - {item.storeName}</span>
                            </td>
                            <td className="px-6 py-6 text-right font-black text-gray-900">{formatCurrency(item.revenueActual)}</td>
                            <td className="px-6 py-6">
                                <div className="flex flex-col items-center gap-2">
                                    <span className={`text-xs font-black italic ${item.percentMeta >= 100 ? 'text-green-600' : 'text-blue-700'}`}>{item.percentMeta.toFixed(1)}%</span>
                                    <div className="w-24 h-1.5 bg-gray-100 rounded-full overflow-hidden shadow-inner">
                                        <div className={`h-full transition-all duration-1000 ${item.percentMeta >= 100 ? 'bg-green-500' : 'bg-blue-600'}`} style={{ width: `${Math.min(item.percentMeta, 100)}%` }} />
                                    </div>
                                </div>
                            </td>
                            <td className="px-6 py-6 text-center">
                                <div className="flex flex-col items-center">
                                    <Box size={14} className="text-gray-300 mb-1" />
                                    <span className="text-xs font-bold text-gray-700">{item.itemsActual?.toLocaleString() || 0}</span>
                                </div>
                            </td>
                            <td className="px-6 py-6 text-center">
                                <div className="flex flex-col items-center">
                                    <Hash size={14} className="text-gray-300 mb-1" />
                                    <span className="text-xs font-bold text-gray-700">{item.itemsPerTicket?.toFixed(2) || '0.00'}</span>
                                </div>
                            </td>
                            <td className="px-6 py-6 text-center">
                                <div className="flex flex-col items-center">
                                    <DollarSign size={14} className="text-gray-300 mb-1" />
                                    <span className="text-xs font-bold text-gray-700">{item.unitPriceAverage?.toFixed(2) || '0.00'}</span>
                                </div>
                            </td>
                            <td className="px-6 py-6 text-center">
                                <div className="flex flex-col items-center">
                                    <Tag size={14} className="text-gray-300 mb-1" />
                                    <span className="text-xs font-bold text-gray-700">{item.averageTicket?.toFixed(2) || '0.00'}</span>
                                </div>
                            </td>
                            <td className="px-6 py-6 text-center">
                                <div className="flex flex-col items-center">
                                    <Percent size={14} className="text-gray-300 mb-1" />
                                    <span className={`text-xs font-bold ${item.delinquencyRate > 3 ? 'text-red-500' : 'text-green-600'}`}>{formatDecimal(item.delinquencyRate)}%</span>
                                </div>
                            </td>
                            <td className="px-6 py-6 text-right">
                                <span className="text-[10px] font-bold text-gray-400">{formatCurrency(item.revenueTarget)}</span>
                            </td>
                            <td className="px-6 py-6 text-center">
                                {item.percentMeta >= 100 ? (
                                    <span className="px-3 py-1 bg-green-50 text-green-700 rounded-full text-[8px] font-black uppercase border border-green-200">Meta Batida</span>
                                ) : (
                                    <span className="px-3 py-1 bg-gray-50 text-gray-400 rounded-full text-[8px] font-black uppercase border border-gray-100">Em Curso</span>
                                )}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
          </div>
       </div>

       {showImportModal && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-4 backdrop-blur-md">
              <div className="bg-white rounded-[48px] p-10 max-w-md w-full shadow-2xl border-t-8 border-green-600">
                  <div className="flex justify-between items-center mb-8">
                      <h3 className="text-2xl font-black text-gray-900 uppercase italic tracking-tighter">Sincronizar <span className="text-green-600">Excel</span></h3>
                      <button onClick={() => {setShowImportModal(false); setSelectedFile(null);}} className="text-gray-400 hover:text-red-600 transition-colors bg-gray-50 p-2 rounded-full"><X size={24} /></button>
                  </div>
                  <input type="file" ref={fileInputRef} className="hidden" accept=".xlsx, .xls" onChange={(e) => setSelectedFile(e.target.files?.[0] || null)} />
                  <div onClick={() => !isProcessing && fileInputRef.current?.click()} className={`border-4 border-dashed rounded-[32px] p-12 flex flex-col items-center justify-center mb-8 cursor-pointer transition-all ${selectedFile ? 'border-green-400 bg-green-50 shadow-inner' : 'border-gray-100 hover:bg-gray-50 hover:border-blue-400'}`}>
                      {selectedFile ? <CheckCircle size={48} className="text-green-500 mb-4" /> : <FileSpreadsheet size={48} className="text-gray-200 mb-4" />}
                      <span className="text-[10px] text-gray-400 font-black uppercase tracking-widest text-center">{selectedFile ? selectedFile.name : 'Selecionar Planilha Corporativa'}</span>
                  </div>
                  {importStatus && <div className="mb-6 text-center text-[10px] font-black text-blue-600 uppercase tracking-widest animate-pulse flex items-center justify-center gap-2"><Loader2 size={12} className="animate-spin"/> {importStatus}</div>}
                  <div className="flex gap-4">
                      <button onClick={() => setShowImportModal(false)} className="flex-1 py-5 bg-gray-50 text-gray-400 rounded-3xl font-black uppercase text-[10px] tracking-widest">Voltar</button>
                      <button onClick={handleProcessImport} disabled={!selectedFile || isProcessing} className="flex-1 py-5 bg-blue-700 text-white rounded-3xl font-black uppercase text-[10px] tracking-widest shadow-xl hover:bg-blue-800 disabled:opacity-50 transition-all border-b-4 border-blue-900">Efetivar</button>
                  </div>
              </div>
          </div>
       )}
    </div>
  );
};

export default DashboardAdmin;
