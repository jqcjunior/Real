
import React, { useState, useEffect, useMemo } from 'react';
import { Store, MonthlyPerformance } from '../types';
import { formatCurrency } from '../constants';
import { Target, Loader2, Save, Calendar, Calculator, TrendingUp, Copy, CheckCircle2, ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';

interface GoalRegistrationProps {
  stores: Store[];
  performanceData: MonthlyPerformance[];
  onUpdateData: (data: MonthlyPerformance[]) => Promise<void>; 
}

const GoalRegistration: React.FC<GoalRegistrationProps> = ({ stores, performanceData, onUpdateData }) => {
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonthIndex, setSelectedMonthIndex] = useState(new Date().getMonth() + 1);
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
        businessDays: 26,
        trend: 'stable'
      };
    });
    setFormData(newFormData);
  }, [selectedMonthStr, performanceData, activeStores]);

  const handleInputChange = (storeId: string, field: keyof MonthlyPerformance, value: any) => {
      let finalValue = value;
      if (typeof value === 'string' && field !== 'trend') {
          finalValue = parseFloat(value.replace(/\./g, '').replace(',', '.')) || 0;
      }
      
      setFormData(prev => ({
          ...prev,
          [storeId]: { ...prev[storeId], [field]: finalValue }
      }));
  };

  const handleCloneLastMonth = () => {
      const lastMonthIndex = selectedMonthIndex === 1 ? 12 : selectedMonthIndex - 1;
      const lastYear = selectedMonthIndex === 1 ? selectedYear - 1 : selectedYear;
      const lastMonthStr = `${lastYear}-${String(lastMonthIndex).padStart(2, '0')}`;
      
      if (window.confirm(`Deseja clonar as metas de ${lastMonthStr} para o mês atual?`)) {
          const clonedData: Record<string, Partial<MonthlyPerformance>> = {};
          activeStores.forEach(store => {
              const lastMonthPerf = performanceData.find(p => p.storeId === store.id && p.month === lastMonthStr);
              if (lastMonthPerf) {
                  clonedData[store.id] = {
                      ...lastMonthPerf,
                      id: undefined,
                      month: selectedMonthStr,
                      revenueActual: 0,
                      itemsActual: 0,
                      percentMeta: 0
                  };
              } else {
                  clonedData[store.id] = formData[store.id];
              }
          });
          setFormData(clonedData);
      }
  };

  const handleSave = async () => {
    setSaveStatus('saving');
    try {
        const dataToSave: MonthlyPerformance[] = activeStores.map(store => {
            const data = formData[store.id];
            return {
                ...data,
                storeId: store.id,
                month: selectedMonthStr,
                revenueTarget: Number(data?.revenueTarget) || 0,
                itemsTarget: Number(data?.itemsTarget) || 0,
                paTarget: Number(data?.paTarget) || 0,
                ticketTarget: Number(data?.ticketTarget) || 0,
                puTarget: Number(data?.puTarget) || 0,
                delinquencyTarget: Number(data?.delinquencyTarget) || 0,
                businessDays: Number(data?.businessDays) || 26,
                trend: data?.trend || 'stable'
            } as MonthlyPerformance;
        });
        
        await onUpdateData(dataToSave);
        setSaveStatus('success');
        setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (e) { 
        setSaveStatus('error');
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-4 flex flex-col h-full animate-in fade-in duration-500 pb-20">
      
      <div className="flex flex-col lg:flex-row justify-between items-center gap-4 bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-red-600 text-white rounded-2xl">
            <Target size={24} />
          </div>
          <div>
            <h2 className="text-xl font-black uppercase italic tracking-tighter text-gray-900">
                Planejamento <span className="text-red-600">de Metas</span>
            </h2>
            <p className="text-gray-400 font-bold uppercase text-[9px] tracking-widest">Definição mensal por unidade</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 bg-gray-50 p-1.5 rounded-xl border">
                <Calendar className="text-blue-600 ml-1" size={14} />
                <select value={selectedMonthIndex} onChange={(e) => setSelectedMonthIndex(Number(e.target.value))} className="bg-transparent text-gray-900 font-black outline-none cursor-pointer px-1 uppercase text-[10px]">
                    {months.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
                <select value={selectedYear} onChange={(e) => setSelectedYear(Number(e.target.value))} className="bg-transparent text-gray-900 font-black outline-none cursor-pointer px-1 text-[10px]">
                    {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
                </select>
          </div>
          <button onClick={handleCloneLastMonth} className="bg-blue-50 text-blue-700 px-4 py-2 rounded-xl hover:bg-blue-100 font-black uppercase text-[9px] tracking-widest flex items-center gap-2">
              <Copy size={14} /> Clonar
          </button>
          <button onClick={handleSave} disabled={saveStatus === 'saving'} className="bg-gray-950 text-white px-6 py-2.5 rounded-xl font-black uppercase text-[9px] tracking-widest flex items-center gap-2 border-b-4 border-red-600 active:scale-95 disabled:opacity-50">
            {saveStatus === 'saving' ? <Loader2 className="animate-spin" size={14}/> : <Save size={14}/>} 
            Efetivar
          </button>
        </div>
      </div>

      <div className="flex-1 bg-white rounded-3xl shadow-sm border border-gray-100 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-auto no-scrollbar">
            <table className="w-full text-left border-collapse min-w-[1000px]">
              <thead className="bg-gray-50 text-[9px] font-black uppercase tracking-widest text-gray-400 border-b sticky top-0 z-30">
                <tr>
                  <th className="px-6 py-3 sticky left-0 bg-gray-50 z-40">Unidade</th>
                  <th className="px-3 py-3 text-center">Faturamento (R$)</th>
                  <th className="px-3 py-3 text-center">Ritmo Dia</th>
                  <th className="px-3 py-3 text-center">Pares</th>
                  <th className="px-3 py-3 text-center">P.A</th>
                  <th className="px-3 py-3 text-center w-24">Ticket</th>
                  <th className="px-3 py-3 text-center w-20">Dias</th>
                  <th className="px-3 py-3 text-center w-20">Inad (%)</th>
                  <th className="px-3 py-3 text-center w-24">Trend</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {activeStores.map(s => {
                    const rowData = formData[s.id];
                    const daily = (Number(rowData?.revenueTarget) || 0) / (Number(rowData?.businessDays) || 26);
                    return (
                        <tr key={s.id} className="hover:bg-blue-50/20 transition-all group">
                            <td className="px-6 py-1.5 sticky left-0 bg-white group-hover:bg-blue-50/30 z-20 shadow-sm">
                                <div className="flex flex-col">
                                    <span className="font-black uppercase italic text-blue-950 text-[11px]">LOJA {s.number}</span>
                                    <span className="text-[8px] font-bold text-gray-400 uppercase leading-none truncate max-w-[100px]">{s.city.split(' - ')[0]}</span>
                                </div>
                            </td>
                            <td className="px-2 py-1.5">
                                <input type="text" value={rowData?.revenueTarget || ''} onChange={e => handleInputChange(s.id, 'revenueTarget', e.target.value)} className="w-full p-1.5 bg-gray-50 rounded-lg font-black text-blue-900 text-center text-[11px] focus:ring-2 focus:ring-blue-100 outline-none border-none shadow-inner" placeholder="0" />
                            </td>
                            <td className="px-2 py-1.5 text-center">
                                <span className="text-[10px] font-black text-gray-400 italic">{formatCurrency(daily)}</span>
                            </td>
                            <td className="px-2 py-1.5">
                                <input type="text" value={rowData?.itemsTarget || ''} onChange={e => handleInputChange(s.id, 'itemsTarget', e.target.value)} className="w-full p-1.5 bg-gray-50 rounded-lg font-black text-gray-700 text-center text-[11px] outline-none border-none shadow-inner" placeholder="0" />
                            </td>
                            <td className="px-2 py-1.5">
                                <input type="text" value={rowData?.paTarget || ''} onChange={e => handleInputChange(s.id, 'paTarget', e.target.value)} className="w-full p-1.5 bg-gray-50 rounded-lg font-black text-gray-700 text-center text-[11px] outline-none border-none shadow-inner" placeholder="0,00" />
                            </td>
                            <td className="px-2 py-1.5">
                                <input type="text" value={rowData?.ticketTarget || ''} onChange={e => handleInputChange(s.id, 'ticketTarget', e.target.value)} className="w-full p-1.5 bg-gray-50 rounded-lg font-black text-gray-700 text-center text-[11px] outline-none border-none shadow-inner" placeholder="0,00" />
                            </td>
                            <td className="px-2 py-1.5">
                                <input type="text" value={rowData?.businessDays || ''} onChange={e => handleInputChange(s.id, 'businessDays', e.target.value)} className="w-full p-1.5 bg-gray-50 rounded-lg font-black text-gray-700 text-center text-[11px] outline-none border-none shadow-inner" placeholder="26" />
                            </td>
                            <td className="px-2 py-1.5">
                                <input type="text" value={rowData?.delinquencyTarget || ''} onChange={e => handleInputChange(s.id, 'delinquencyTarget', e.target.value)} className="w-full p-1.5 bg-red-50 rounded-lg font-black text-red-700 text-center text-[11px] outline-none border-none shadow-inner" placeholder="2.0" />
                            </td>
                            <td className="px-2 py-1.5">
                                <div className="flex bg-gray-100 p-0.5 rounded-lg justify-center">
                                    <button onClick={() => handleInputChange(s.id, 'trend', 'up')} className={`p-1 rounded ${rowData?.trend === 'up' ? 'bg-green-500 text-white shadow-sm' : 'text-gray-400'}`}><ArrowUpRight size={12}/></button>
                                    <button onClick={() => handleInputChange(s.id, 'trend', 'stable')} className={`p-1 rounded ${rowData?.trend === 'stable' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-400'}`}><Minus size={12}/></button>
                                    <button onClick={() => handleInputChange(s.id, 'trend', 'down')} className={`p-1 rounded ${rowData?.trend === 'down' ? 'bg-red-500 text-white shadow-sm' : 'text-gray-400'}`}><ArrowDownRight size={12}/></button>
                                </div>
                            </td>
                        </tr>
                    );
                })}
              </tbody>
            </table>
        </div>
      </div>
      
      {saveStatus === 'success' && (
          <div className="fixed bottom-4 right-4 bg-green-600 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase animate-bounce shadow-xl flex items-center gap-2">
              <CheckCircle2 size={14}/> Sincronizado com o Servidor
          </div>
      )}
    </div>
  );
};

export default GoalRegistration;
