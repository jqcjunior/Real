
import React, { useState, useEffect, useMemo } from 'react';
import { Store, MonthlyPerformance } from '../types';
import { formatCurrency } from '../constants';
import { Target, Loader2, Save, Calendar, Calculator, TrendingUp } from 'lucide-react';

interface GoalRegistrationProps {
  stores: Store[];
  performanceData: MonthlyPerformance[];
  onUpdateData: (data: MonthlyPerformance[]) => Promise<void>; 
}

const GoalRegistration: React.FC<GoalRegistrationProps> = ({ stores, performanceData, onUpdateData }) => {
  const [selectedYear, setSelectedYear] = useState(2026);
  const [selectedMonthIndex, setSelectedMonthIndex] = useState(1);
  const selectedMonthStr = `${selectedYear}-${String(selectedMonthIndex).padStart(2, '0')}`;
  
  const [formData, setFormData] = useState<Record<string, Partial<MonthlyPerformance>>>({});
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');

  const months = [
    { value: 1, label: 'Janeiro' }, { value: 2, label: 'Fevereiro' }, { value: 3, label: 'Março' },
    { value: 4, label: 'Abril' }, { value: 5, label: 'Maio' }, { value: 6, label: 'Junho' },
    { value: 7, label: 'Julho' }, { value: 8, label: 'Agosto' }, { value: 9, label: 'Setembro' },
    { value: 10, label: 'Outubro' }, { value: 11, label: 'Novembro' }, { value: 12, label: 'Dezembro' }
  ];

  const activeStores = useMemo(() => {
    return (stores || []).filter(s => s.status === 'active').sort((a, b) => parseInt(a.number) - parseInt(b.number));
  }, [stores]);

  useEffect(() => {
    const newFormData: Record<string, Partial<MonthlyPerformance>> = {};
    activeStores.forEach(store => {
      const existing = performanceData.find(p => p.storeId === store.id && p.month === selectedMonthStr);
      newFormData[store.id] = existing || { 
        revenueTarget: 0, 
        itemsTarget: 0, 
        paTarget: 0, 
        ticketTarget: 0, 
        puTarget: 0, 
        delinquencyTarget: 2, 
        businessDays: 26 
      };
    });
    setFormData(newFormData);
  }, [selectedMonthStr, performanceData, activeStores]);

  const globalStats = useMemo(() => {
      let revenue = 0;
      let items = 0;
      Object.keys(formData).forEach(key => {
          const item = formData[key];
          revenue += Number(item?.revenueTarget || 0);
          items += Number(item?.itemsTarget || 0);
      });
      return { revenue, items };
  }, [formData]);

  const handleInputChange = (storeId: string, field: keyof MonthlyPerformance, value: string) => {
      const numValue = parseFloat(value.replace(',', '.')) || 0;
      setFormData(prev => ({
          ...prev,
          [storeId]: { ...prev[storeId], [field]: numValue }
      }));
  };

  const handleSave = async () => {
    setSaveStatus('saving');
    try {
        const dataToSave: MonthlyPerformance[] = activeStores.map(store => {
            const data = formData[store.id];
            const dailyGoal = (Number(data?.revenueTarget) || 0) / (Number(data?.businessDays) || 26);
            return {
                ...data,
                storeId: store.id,
                month: selectedMonthStr,
                correctedDailyGoal: dailyGoal,
                trend: 'stable'
            } as MonthlyPerformance;
        });
        
        await onUpdateData(dataToSave);
        setSaveStatus('success');
        setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (e) { 
        setSaveStatus('error');
        alert("Erro ao salvar metas.");
    }
  };

  return (
    <div className="p-2 md:p-3 space-y-3 flex flex-col h-full animate-in fade-in duration-500 pb-20">
      {/* Header Compacto */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3 bg-white p-3 md:p-4 rounded-[20px] shadow-sm border border-gray-100">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-red-50 text-red-600 rounded-[12px]">
            <Target size={20} />
          </div>
          <div>
            <h2 className="text-lg md:text-xl font-black uppercase italic tracking-tighter leading-none text-gray-900">
                Gestão <span className="text-red-600">de Metas</span>
            </h2>
            <p className="text-gray-400 font-bold uppercase text-[7px] tracking-[0.2em] mt-0.5">Definição de Objetivos de Performance</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full lg:w-auto">
          <div className="flex items-center gap-1 bg-gray-50 p-1 rounded-lg border border-gray-200 shadow-inner flex-1 sm:flex-none">
                <Calendar className="text-blue-600 ml-1" size={12} />
                <select value={selectedMonthIndex} onChange={(e) => setSelectedMonthIndex(Number(e.target.value))} className="bg-transparent text-gray-900 font-black outline-none cursor-pointer px-1 uppercase text-[9px]">
                    {months.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
                <div className="w-px h-3 bg-gray-300 mx-1"></div>
                <select value={selectedYear} onChange={(e) => setSelectedYear(Number(e.target.value))} className="bg-transparent text-gray-900 font-black outline-none cursor-pointer px-1 text-[9px]">
                    {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
                </select>
          </div>

          <button onClick={handleSave} disabled={saveStatus === 'saving'} className="bg-gray-950 text-white px-4 py-2 rounded-xl font-black uppercase text-[9px] tracking-widest flex items-center justify-center gap-2 shadow-lg hover:bg-black transition-all active:scale-95 border-b-2 border-red-700 disabled:opacity-50">
            {saveStatus === 'saving' ? <Loader2 className="animate-spin" size={12}/> : <Save size={12}/>} 
            {saveStatus === 'success' ? 'Salvo!' : 'Efetivar'}
          </button>
        </div>
      </div>

      {/* Stats Globais Menores */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <div className="bg-blue-900 text-white p-3 md:p-4 rounded-[20px] shadow-md flex items-center justify-between group overflow-hidden relative">
               <div className="absolute top-0 right-0 p-2 opacity-10"><TrendingUp size={40}/></div>
               <div>
                   <p className="text-[7px] font-black text-blue-300 uppercase tracking-widest mb-0.5">Faturamento Rede</p>
                   <h3 className="text-xl font-black italic tracking-tighter">{formatCurrency(globalStats.revenue)}</h3>
               </div>
          </div>
          <div className="bg-white p-3 md:p-4 rounded-[20px] shadow-sm border border-gray-100 flex items-center justify-between group overflow-hidden relative">
               <div className="absolute top-0 right-0 p-2 opacity-5"><Calculator size={40}/></div>
               <div>
                   <p className="text-[7px] font-black text-gray-400 uppercase tracking-widest mb-0.5">Total de Itens</p>
                   <h3 className="text-xl font-black text-gray-900 italic tracking-tighter">{globalStats.items.toLocaleString()} <span className="text-[10px] not-italic text-gray-400 font-bold uppercase ml-0.5">PARES</span></h3>
               </div>
          </div>
      </div>

      {/* Tabela de Lançamento Ultra Compacta */}
      <div className="flex-1 bg-white rounded-[20px] shadow-sm border border-gray-100 overflow-hidden flex flex-col">
        <div className="overflow-x-auto no-scrollbar">
            <table className="w-full text-left border-collapse min-w-[1000px]">
              <thead className="bg-gray-50 text-[7px] font-black uppercase tracking-[0.1em] text-gray-400 border-b">
                <tr>
                  <th className="px-3 py-2 sticky left-0 bg-gray-50 z-20 w-[160px]">Unidade</th>
                  <th className="px-1 py-2 text-center">Faturamento (R$)</th>
                  <th className="px-1 py-2 text-center">Ritmo</th>
                  <th className="px-1 py-2 text-center">Itens</th>
                  <th className="px-1 py-2 text-center">P.A.</th>
                  <th className="px-1 py-2 text-center">Ticket</th>
                  <th className="px-1 py-2 text-center">P.U.</th>
                  <th className="px-1 py-2 text-center w-14">Dias</th>
                  <th className="px-3 py-2 text-center">Inadimp. (%)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {activeStores.map(s => {
                    const rowData = formData[s.id];
                    const daily = (Number(rowData?.revenueTarget) || 0) / (Number(rowData?.businessDays) || 26);
                    return (
                        <tr key={s.id} className="hover:bg-blue-50/20 transition-colors group">
                            <td className="px-3 py-1 sticky left-0 bg-white group-hover:bg-blue-50/30 z-10">
                                <div className="flex flex-col">
                                    <span className="font-black uppercase italic text-gray-900 text-[11px] tracking-tight">{s.number} - {s.name}</span>
                                    <span className="text-[7px] font-bold text-gray-400 uppercase leading-none">{s.city.split(' - ')[0]}</span>
                                </div>
                            </td>
                            <td className="px-1 py-1">
                                <input type="text" value={rowData?.revenueTarget || ''} onChange={e => handleInputChange(s.id, 'revenueTarget', e.target.value)} className="w-full p-1.5 bg-gray-50 border-none rounded-lg font-black text-blue-900 text-center text-[11px] focus:ring-1 focus:ring-blue-200 transition-all outline-none" placeholder="0" />
                            </td>
                            <td className="px-1 py-1 text-center">
                                <div className="py-1 px-1.5 bg-blue-50/50 rounded-lg border border-dashed border-blue-200 min-w-[70px]">
                                    <span className="text-[9px] font-black text-blue-700 italic">{formatCurrency(daily)}</span>
                                </div>
                            </td>
                            <td className="px-1 py-1">
                                <input type="text" value={rowData?.itemsTarget || ''} onChange={e => handleInputChange(s.id, 'itemsTarget', e.target.value)} className="w-full p-1.5 bg-gray-50 border-none rounded-lg font-black text-gray-700 text-center text-[11px] focus:ring-1 focus:ring-blue-100 outline-none" placeholder="0" />
                            </td>
                            <td className="px-1 py-1">
                                <input type="text" value={rowData?.paTarget || ''} onChange={e => handleInputChange(s.id, 'paTarget', e.target.value)} className="w-full p-1.5 bg-gray-50 border-none rounded-lg font-black text-gray-700 text-center text-[11px] focus:ring-1 focus:ring-blue-100 outline-none" placeholder="0,00" />
                            </td>
                            <td className="px-1 py-1">
                                <input type="text" value={rowData?.ticketTarget || ''} onChange={e => handleInputChange(s.id, 'ticketTarget', e.target.value)} className="w-full p-1.5 bg-gray-50 border-none rounded-lg font-black text-gray-700 text-center text-[11px] focus:ring-1 focus:ring-blue-100 outline-none" placeholder="0,00" />
                            </td>
                            <td className="px-1 py-1">
                                <input type="text" value={rowData?.puTarget || ''} onChange={e => handleInputChange(s.id, 'puTarget', e.target.value)} className="w-full p-1.5 bg-gray-50 border-none rounded-lg font-black text-gray-700 text-center text-[11px] focus:ring-1 focus:ring-blue-100 outline-none" placeholder="0,00" />
                            </td>
                            <td className="px-1 py-1">
                                <input type="text" value={rowData?.businessDays || ''} onChange={e => handleInputChange(s.id, 'businessDays', e.target.value)} className="w-full p-1.5 bg-gray-50 border-none rounded-lg font-black text-gray-700 text-center text-[11px] outline-none" placeholder="26" />
                            </td>
                            <td className="px-3 py-1">
                                <input type="text" value={rowData?.delinquencyTarget || ''} onChange={e => handleInputChange(s.id, 'delinquencyTarget', e.target.value)} className="w-full p-1.5 bg-red-50/50 border-none rounded-lg font-black text-red-700 text-center text-[11px] focus:ring-1 focus:ring-red-100 outline-none" placeholder="2.0" />
                            </td>
                        </tr>
                    );
                })}
              </tbody>
            </table>
        </div>
      </div>
      
      {/* Bottom Compacto */}
      <div className="fixed bottom-0 left-0 lg:left-64 right-0 bg-white border-t border-gray-100 p-2 flex justify-between items-center z-40 shadow-lg">
          <div className="flex items-center gap-1.5 ml-2">
              <div className="w-1 h-1 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-[7px] font-black uppercase text-gray-400 tracking-widest">Sincronização Real-Time</span>
          </div>
          <p className="text-[8px] font-black text-blue-900 uppercase italic mr-2">Rede Real: <span className="text-red-600 ml-1">{formatCurrency(globalStats.revenue)}</span></p>
      </div>
    </div>
  );
};

export default GoalRegistration;
