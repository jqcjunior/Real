
import React, { useState, useMemo, useRef } from 'react';
import { Store, MonthlyPerformance } from '../types';
import { formatCurrency } from '../constants';
import { TrendingUp, Target, ShoppingBag, CreditCard, Tag, Upload, FileSpreadsheet, Loader2, CheckCircle, X, Save, Package, Trophy, Medal, Star, Crown, DollarSign, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import * as XLSX from 'xlsx';

// ATENÇÃO: DashboardAdmin agora centraliza o acesso ao cadastro unificado.

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

const DashboardAdmin: React.FC<DashboardAdminProps> = ({ stores, performanceData, onImportData, onSaveGoals }) => {
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
     const now = new Date();
     return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  const [showImportModal, setShowImportModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [importStatus, setImportStatus] = useState('');

  const handleMonthYearChange = (type: 'month' | 'year', value: number) => {
      const [currentY, currentM] = selectedMonth.split('-');
      let newY = parseInt(currentY);
      let newM = parseInt(currentM);
      if (type === 'month') newM = value;
      if (type === 'year') newY = value;
      const newStr = `${newY}-${String(newM).padStart(2, '0')}`;
      setSelectedMonth(newStr);
  };

  const availableYears = useMemo(() => {
      const years = new Set<number>();
      const currentYear = new Date().getFullYear();
      years.add(currentYear);
      performanceData.forEach(d => years.add(parseInt(d.month.split('-')[0])));
      for (let y = currentYear; y <= 2030; y++) years.add(y);
      return Array.from(years).sort((a,b) => b - a);
  }, [performanceData]);

  const formatMonthName = (dateStr: string) => {
    if (!dateStr) return '';
    const [year, month] = dateStr.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1, 1);
    const monthName = date.toLocaleString('pt-BR', { month: 'long' });
    return monthName.charAt(0).toUpperCase() + monthName.slice(1);
  };

  // DEDUPLICAÇÃO LOCAL RIGOROSA PARA CÁLCULOS TOTAIS
  const currentMonthData = useMemo(() => {
      const data = performanceData.filter(p => p.month === selectedMonth);
      const uniqueMap = new Map();
      data.forEach(p => {
          if (!uniqueMap.has(p.storeId)) {
              uniqueMap.set(p.storeId, p);
          }
      });
      return Array.from(uniqueMap.values());
  }, [performanceData, selectedMonth]);

  const networkStats = useMemo(() => {
      const totalRevenue = currentMonthData.reduce((acc, curr) => acc + curr.revenueActual, 0);
      const totalTarget = currentMonthData.reduce((acc, curr) => acc + curr.revenueTarget, 0);
      const count = currentMonthData.length;
      const percentMeta = totalTarget > 0 ? (totalRevenue / totalTarget) * 100 : 0;
      
      const avgTicket = count > 0 ? currentMonthData.reduce((acc, curr) => acc + curr.averageTicket, 0) / count : 0;
      const avgPA = count > 0 ? currentMonthData.reduce((acc, curr) => acc + curr.itemsPerTicket, 0) / count : 0;
      const totalItems = currentMonthData.reduce((acc, curr) => acc + (curr.itemsActual || 0), 0);

      return { totalRevenue, totalTarget, percentMeta, avgTicket, avgPA, totalItems };
  }, [currentMonthData]);

  const rankedStores = useMemo(() => {
      const withStats = currentMonthData.map(data => {
          const store = stores.find(s => s.id === data.storeId);
          const xp = Math.round((data.percentMeta || 0) * 100);
          return { ...data, storeName: store?.name || 'Unidade', storeNumber: store?.number || '00', xp, status: store?.status };
      });
      return withStats.filter(s => s.status === 'active').sort((a, b) => b.xp - a.xp).map((item, index) => ({ ...item, rank: index + 1 }));
  }, [currentMonthData, stores]);

  const parseNumber = (val: any): number => {
    if (typeof val === 'number') return val;
    if (typeof val === 'string') {
        let clean = val.replace('%', '').trim();
        if (!clean || clean === '-') return 0;
        if (clean.includes(',') && clean.includes('.')) clean = clean.replace(/\./g, '').replace(',', '.');
        else if (clean.includes(',')) clean = clean.replace(',', '.');
        return parseFloat(clean) || 0;
    }
    return 0;
  };

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
          if (startRowIndex === -1) throw new Error("Formato não reconhecido.");
          
          const changesMap = new Map<string, MonthlyPerformance>();
          for (let i = startRowIndex; i < jsonData.length; i++) {
              const row = jsonData[i];
              if (!row || row.length === 0) continue;
              const storeNumber = String(row[0] || '').replace(/\D/g, '');
              const store = stores.find(s => s.number === String(parseInt(storeNumber)));
              if (store) {
                  const actual = parseNumber(row[7]);
                  const meta = parseNumber(row[6]);
                  changesMap.set(store.id, {
                      storeId: store.id,
                      month: selectedMonth,
                      revenueTarget: meta,
                      revenueActual: actual,
                      itemsPerTicket: parseNumber(row[3]),
                      unitPriceAverage: parseNumber(row[4]),
                      averageTicket: parseNumber(row[5]),
                      itemsActual: parseNumber(row[2]),
                      delinquencyRate: parseNumber(row[14]),
                      percentMeta: meta > 0 ? (actual/meta)*100 : 0,
                      trend: 'stable',
                      correctedDailyGoal: 0
                  } as MonthlyPerformance);
              }
          }
          const results = Array.from(changesMap.values());
          if (results.length > 0) {
              await onImportData(results);
              alert("Dados sincronizados com sucesso!");
              setShowImportModal(false);
          }
      } catch (err: any) { alert(err.message); } finally { setIsProcessing(false); }
  };

  const NetworkStatCard = ({ title, value, target, percent, icon: Icon, colorClass, prefix = '' }: any) => (
     <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-between">
         <div>
             <div className="flex items-center justify-between mb-4"><h3 className="text-gray-500 text-sm font-bold uppercase">{title}</h3><div className={`p-2 rounded-lg ${colorClass}`}><Icon size={20}/></div></div>
             <p className="text-3xl font-bold text-gray-900">{prefix}{typeof value === 'number' ? value.toLocaleString('pt-BR', { minimumFractionDigits: title.includes('Itens') ? 0 : 2 }) : value}</p>
         </div>
         {target > 0 && (
             <div className="mt-4 flex items-center gap-2"><div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden"><div className={`h-full ${percent >= 100 ? 'bg-green-500' : 'bg-blue-500'}`} style={{ width: `${Math.min(percent, 100)}%` }}></div></div><span className="text-xs font-bold text-gray-500">{percent.toFixed(1)}%</span></div>
         )}
     </div>
  );

  return (
    <div className="p-8 max-w-[1600px] mx-auto space-y-8">
       <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <div><h2 className="text-3xl font-black text-gray-900 tracking-tighter uppercase italic">Visão <span className="text-red-600">Geral</span></h2><p className="text-gray-500 font-bold uppercase text-xs tracking-widest">Monitoramento Consolidado da Rede</p></div>
          <div className="flex items-center gap-3">
             <div className="flex items-center gap-2 bg-white p-2 rounded-lg border border-gray-200 shadow-sm">
                <select value={parseInt(selectedMonth.split('-')[1])} onChange={(e) => handleMonthYearChange('month', parseInt(e.target.value))} className="bg-transparent text-gray-700 font-bold outline-none cursor-pointer">
                    {MONTHS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
                <select value={parseInt(selectedMonth.split('-')[0])} onChange={(e) => handleMonthYearChange('year', parseInt(e.target.value))} className="bg-transparent text-gray-700 font-bold outline-none cursor-pointer">
                    {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
             </div>
             {/* ACESSO AO CADASTRO UNIFICADO DE METAS */}
             <button onClick={() => window.dispatchEvent(new CustomEvent('changeView', { detail: 'metas_registration' }))} className="flex items-center gap-2 bg-blue-700 text-white px-6 py-2.5 rounded-lg hover:bg-blue-800 transition-all shadow-md font-black uppercase text-xs">
                <Target size={18} /> Definir Metas
             </button>
             <button onClick={() => setShowImportModal(true)} className="flex items-center gap-2 bg-green-600 text-white px-4 py-2.5 rounded-lg hover:bg-green-700 transition-all shadow-md font-black uppercase text-xs">
                <Upload size={18} /> Sincronizar Excel
             </button>
          </div>
       </div>

       <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6">
           <NetworkStatCard title="Faturamento Rede" value={networkStats.totalRevenue} target={networkStats.totalTarget} percent={networkStats.percentMeta} icon={ShoppingBag} colorClass="bg-green-50 text-green-600" prefix="R$" />
           <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-between"><div className="flex items-center justify-between mb-4"><h3 className="text-gray-500 text-sm font-bold uppercase">Meta Global</h3><div className="p-2 bg-blue-50 rounded-lg text-blue-600"><Target size={20}/></div></div><p className="text-3xl font-bold text-gray-900">{formatCurrency(networkStats.totalTarget)}</p></div>
           <NetworkStatCard title="Ticket Médio" value={networkStats.avgTicket} target={0} percent={0} icon={CreditCard} colorClass="bg-purple-50 text-purple-600" prefix="R$" />
           <NetworkStatCard title="P.A. Médio" value={networkStats.avgPA} target={0} percent={0} icon={Tag} colorClass="bg-orange-50 text-orange-600" />
           <NetworkStatCard title="Itens Vendidos" value={networkStats.totalItems} target={0} percent={0} icon={Package} colorClass="bg-indigo-50 text-indigo-600" />
           <div className="bg-blue-900 p-6 rounded-xl shadow-xl text-white flex flex-col justify-between"><div className="flex items-center justify-between mb-4"><h3 className="text-blue-300 text-xs font-bold uppercase">Lojas Ativas</h3><div className="p-2 bg-white/10 rounded-lg"><Crown size={20}/></div></div><p className="text-4xl font-black">{rankedStores.length}</p></div>
       </div>

       <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center"><h3 className="font-black text-gray-800 uppercase italic tracking-tighter">Ranking de Performance - {formatMonthName(selectedMonth)}</h3></div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
                <thead className="bg-gray-900 text-white font-bold uppercase text-[10px] tracking-widest">
                    <tr>
                        <th className="p-4">Rank</th>
                        <th className="p-4">Loja / Unidade</th>
                        <th className="p-4 text-center">XP (Meta %)</th>
                        <th className="p-4 text-right">Faturamento</th>
                        <th className="p-4 text-right">Meta Estabelecida</th>
                        <th className="p-4 text-center">Status</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                    {rankedStores.map((item) => (
                        <tr key={item.storeId} className="hover:bg-blue-50/30 transition-colors">
                            <td className="p-4 font-black text-gray-400">#{item.rank}</td>
                            <td className="p-4 font-bold text-gray-900 uppercase italic">{item.storeNumber} - {item.storeName}</td>
                            <td className="p-4 text-center"><div className="flex items-center justify-center gap-2"><span className="font-black text-blue-700">{item.percentMeta.toFixed(1)}%</span><div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden"><div className={`h-full ${item.percentMeta >= 100 ? 'bg-green-500' : 'bg-blue-500'}`} style={{ width: `${Math.min(item.percentMeta, 100)}%` }}></div></div></div></td>
                            <td className="p-4 text-right font-medium">{formatCurrency(item.revenueActual)}</td>
                            <td className="p-4 text-right text-gray-500">{formatCurrency(item.revenueTarget)}</td>
                            <td className="p-4 text-center">
                                <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase ${item.percentMeta >= 100 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{item.percentMeta >= 100 ? 'META BATIDA' : 'EM CURSO'}</span>
                            </td>
                        </tr>
                    ))}
                    {rankedStores.length === 0 && (
                        <tr><td colSpan={6} className="p-20 text-center text-gray-400 font-bold uppercase tracking-widest">Aguardando importação de dados para este período.</td></tr>
                    )}
                </tbody>
            </table>
          </div>
       </div>

       {showImportModal && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
              <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl animate-in zoom-in duration-200">
                  <div className="flex justify-between items-center mb-6"><h3 className="text-xl font-black text-gray-800 uppercase italic">Sincronizar Planilha</h3><button onClick={() => {setShowImportModal(false); setSelectedFile(null);}} className="text-gray-400 hover:text-gray-600"><X size={24} /></button></div>
                  <input type="file" ref={fileInputRef} className="hidden" accept=".xlsx, .xls" onChange={(e) => setSelectedFile(e.target.files?.[0] || null)} />
                  <div onClick={() => !isProcessing && fileInputRef.current?.click()} className={`border-4 border-dashed rounded-2xl p-10 flex flex-col items-center justify-center mb-6 cursor-pointer transition-all ${selectedFile ? 'border-green-300 bg-green-50' : 'border-gray-200 hover:bg-gray-50'}`}>{selectedFile ? <><CheckCircle size={40} className="text-green-500 mb-2" /><span className="text-xs font-black text-green-700 uppercase">{selectedFile.name}</span></> : <><Upload size={40} className="text-gray-300 mb-2" /><span className="text-xs text-gray-400 font-black uppercase">Clique para selecionar Excel</span></>}</div>
                  {importStatus && <div className="mb-4 text-center text-xs font-black text-blue-600 uppercase animate-pulse">{importStatus}</div>}
                  <div className="flex gap-3"><button onClick={() => setShowImportModal(false)} className="flex-1 py-3 bg-gray-100 rounded-xl font-black uppercase text-xs text-gray-500">Voltar</button><button onClick={handleProcessImport} disabled={!selectedFile || isProcessing} className="flex-1 px-4 py-3 rounded-xl bg-blue-700 text-white font-black uppercase text-xs shadow-lg hover:bg-blue-800 disabled:opacity-50">Iniciar Sincronia</button></div>
              </div>
          </div>
       )}
    </div>
  );
};

export default DashboardAdmin;
