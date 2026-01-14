
import React, { useState, useEffect, useMemo } from 'react';
import { Store, MonthlyPerformance } from '../types';
import { Save, Calendar, Target, Loader2, CheckCircle, Info } from 'lucide-react';

interface GoalRegistrationProps {
  stores: Store[];
  performanceData: MonthlyPerformance[];
  onUpdateData: (data: MonthlyPerformance[]) => Promise<void>; 
}

const GoalRegistration: React.FC<GoalRegistrationProps> = ({ stores, performanceData, onUpdateData }) => {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedMonthIndex, setSelectedMonthIndex] = useState(currentMonth);
  const selectedMonthStr = `${selectedYear}-${String(selectedMonthIndex).padStart(2, '0')}`;
  
  const [formData, setFormData] = useState<Record<string, Partial<MonthlyPerformance>>>({});
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');

  const years = Array.from({ length: 5 }, (_, i) => currentYear - 1 + i);
  const months = [
    { value: 1, label: 'Janeiro' }, { value: 2, label: 'Fevereiro' }, { value: 3, label: 'Março' },
    { value: 4, label: 'Abril' }, { value: 5, label: 'Maio' }, { value: 6, label: 'Junho' },
    { value: 7, label: 'Julho' }, { value: 8, label: 'Agosto' }, { value: 9, label: 'Setembro' },
    { value: 10, label: 'Outubro' }, { value: 11, label: 'Novembro' }, { value: 12, label: 'Dezembro' }
  ];

  const activeStores = useMemo(() => {
    const unique = new Map<string, Store>();
    (stores || []).filter(s => s.status === 'active').forEach(s => {
        if (!unique.has(s.number)) unique.set(s.number, s);
    });
    return Array.from(unique.values()).sort((a, b) => parseInt(a.number) - parseInt(b.number));
  }, [stores]);

  useEffect(() => {
    const newFormData: Record<string, Partial<MonthlyPerformance>> = {};
    activeStores.forEach(store => {
      const existing = performanceData.find(p => p.storeId === store.id && p.month === selectedMonthStr);
      if (existing) {
          newFormData[store.id] = { 
              ...existing,
              delinquencyTarget: existing.delinquencyTarget || 2.00,
              paTarget: existing.paTarget || 0,
              ticketTarget: existing.ticketTarget || 0,
              puTarget: existing.puTarget || 0,
              itemsTarget: existing.itemsTarget || 0
          };
      } else {
          newFormData[store.id] = { 
            revenueTarget: 0, itemsTarget: 0, paTarget: 0, ticketTarget: 0, puTarget: 0, delinquencyTarget: 2.00, businessDays: 26 
          };
      }
    });
    setFormData(newFormData);
    setSaveStatus('idle');
  }, [selectedMonthStr, performanceData, activeStores]); 

  const handleInputChange = (storeId: string, field: keyof MonthlyPerformance, value: string) => {
    const cleanValue = value.replace(',', '.');
    setFormData(prev => ({ ...prev, [storeId]: { ...prev[storeId], [field]: Number(cleanValue) || 0 } }));
    setSaveStatus('idle');
  };

  const executeSaveStores = async () => {
    setSaveStatus('saving');
    try {
        const dataToSave: MonthlyPerformance[] = activeStores.map(store => {
            const data = formData[store.id] || {};
            const existing = performanceData.find(p => p.storeId === store.id && p.month === selectedMonthStr);
            return {
                storeId: store.id,
                month: selectedMonthStr,
                revenueTarget: Number(data.revenueTarget || 0),
                revenueActual: Number(existing?.revenueActual || 0),
                itemsTarget: Math.round(Number(data.itemsTarget || 0)),
                itemsActual: Number(existing?.itemsActual || 0),
                paTarget: Number(data.paTarget || 0),
                itemsPerTicket: Number(existing?.itemsPerTicket || 0),
                ticketTarget: Number(data.ticketTarget || 0),
                averageTicket: Number(existing?.averageTicket || 0),
                puTarget: Number(data.puTarget || 0),
                unitPriceAverage: Number(existing?.unitPriceAverage || 0),
                delinquencyTarget: Number(data.delinquencyTarget || 0),
                delinquencyRate: Number(existing?.delinquencyRate || 0),
                businessDays: Number(data.businessDays || 26),
                percentMeta: 0, trend: 'stable', correctedDailyGoal: 0
            } as MonthlyPerformance;
        });
        await onUpdateData(dataToSave);
        setSaveStatus('success');
        setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (e: any) { setSaveStatus('error'); alert(`Erro: ${e.message}`); }
  };

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6 max-w-full bg-gray-50 min-h-full flex flex-col h-screen overflow-hidden">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 bg-white p-6 rounded-2xl shadow-sm border border-gray-200 shrink-0">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-blue-100 text-blue-700 rounded-xl"><Target size={28} /></div>
          <div>
            <h2 className="text-xl font-black text-gray-900 tracking-tight uppercase italic leading-none">Gestão de <span className="text-red-600">Metas Corporativas</span></h2>
            <p className="text-gray-500 font-bold text-[10px] uppercase tracking-widest mt-1.5 flex items-center gap-1"><Info size={12}/> Planejamento de Performance por Unidade Operacional</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
            <div className="flex items-center gap-2 bg-gray-50 p-2 rounded-xl border border-gray-200 shadow-inner mr-2">
                <Calendar className="text-blue-600 ml-1" size={16} />
                <select value={selectedMonthIndex} onChange={(e) => setSelectedMonthIndex(Number(e.target.value))} className="bg-transparent border-none font-black text-gray-800 outline-none cursor-pointer uppercase text-xs">
                    {months.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
                <div className="w-px h-4 bg-gray-300 mx-1"></div>
                <select value={selectedYear} onChange={(e) => setSelectedYear(Number(e.target.value))} className="bg-transparent border-none font-black text-gray-800 outline-none cursor-pointer text-xs">
                    {years.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
            </div>
            <button onClick={executeSaveStores} disabled={saveStatus === 'saving'} className={`flex-1 lg:flex-none px-8 py-3 rounded-xl font-black uppercase text-xs shadow-lg transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50 ${saveStatus === 'success' ? 'bg-green-600 text-white' : saveStatus === 'error' ? 'bg-red-600 text-white' : 'bg-gray-900 text-white hover:bg-black'}`}>
                {saveStatus === 'saving' ? <><Loader2 className="animate-spin" size={16} /> Gravando...</> : saveStatus === 'success' ? <><CheckCircle size={16} /> Atualizado!</> : <><Save size={16} /> Efetivar Metas</>}
            </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden flex flex-col flex-1">
        {/* Container com scroll duplo */}
        <div className="overflow-x-auto overflow-y-auto flex-1 custom-scrollbar">
            <table className="w-full border-collapse table-fixed min-w-[1400px]">
                <thead className="sticky top-0 z-20">
                    <tr className="bg-gray-900 text-white text-[10px] font-black uppercase tracking-widest h-12">
                        <th className="p-4 w-64 border-r border-white/5 bg-gray-950 sticky left-0 z-30 shadow-md text-left">Unidade / Loja</th>
                        <th className="p-4 text-center border-r border-white/5 bg-blue-900">Meta Faturamento (R$)</th>
                        <th className="p-4 text-center border-r border-white/5">Meta Itens</th>
                        <th className="p-4 text-center border-r border-white/5">Meta P.A.</th>
                        <th className="p-4 text-center border-r border-white/5">Meta Ticket Médio</th>
                        <th className="p-4 text-center border-r border-white/5">Meta P.U.</th>
                        <th className="p-4 text-center border-r border-white/5">Dias Úteis</th>
                        <th className="p-4 text-center bg-red-950/20">Limite Inadimp. (%)</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                    {activeStores.map(store => {
                        const data = formData[store.id] || {};
                        return (
                            <tr key={store.id} className="hover:bg-blue-50/50 transition-all group h-16">
                                <td className="p-4 border-r border-gray-100 bg-white group-hover:bg-blue-50 sticky left-0 z-10 shadow-sm">
                                    <div className="font-black text-gray-900 text-sm uppercase italic tracking-tighter leading-none">{store.number} - {store.name}</div>
                                    <div className="text-[9px] text-gray-400 font-bold uppercase mt-1">{store.city}</div>
                                </td>
                                <td className="p-2 border-r border-gray-100 bg-blue-50/10">
                                    <input type="text" value={data.revenueTarget || ''} onChange={e => handleInputChange(store.id, 'revenueTarget', e.target.value)} className="w-full p-2 bg-transparent border-none rounded-lg outline-none text-center font-black text-blue-900 focus:bg-white transition-all text-sm" placeholder="0,00" />
                                </td>
                                <td className="p-2 border-r border-gray-100">
                                    <input type="text" value={data.itemsTarget || ''} onChange={e => handleInputChange(store.id, 'itemsTarget', e.target.value)} className="w-full p-2 bg-transparent border-none rounded-lg outline-none text-center font-black text-blue-600 focus:bg-white transition-all text-sm" placeholder="0" />
                                </td>
                                <td className="p-2 border-r border-gray-100">
                                    <input type="text" value={data.paTarget || ''} onChange={e => handleInputChange(store.id, 'paTarget', e.target.value)} className="w-full p-2 bg-transparent border-none rounded-lg outline-none text-center font-bold text-gray-700 focus:bg-white transition-all text-sm" placeholder="0,00" />
                                </td>
                                <td className="p-2 border-r border-gray-100">
                                    <input type="text" value={data.ticketTarget || ''} onChange={e => handleInputChange(store.id, 'ticketTarget', e.target.value)} className="w-full p-2 bg-transparent border-none rounded-lg outline-none text-center font-bold text-gray-700 focus:bg-white transition-all text-sm" placeholder="0,00" />
                                </td>
                                <td className="p-2 border-r border-gray-100">
                                    <input type="text" value={data.puTarget || ''} onChange={e => handleInputChange(store.id, 'puTarget', e.target.value)} className="w-full p-2 bg-transparent border-none rounded-lg outline-none text-center font-bold text-gray-700 focus:bg-white transition-all text-sm" placeholder="0,00" />
                                </td>
                                <td className="p-2 border-r border-gray-100">
                                    <input type="number" value={data.businessDays || 26} onChange={e => handleInputChange(store.id, 'businessDays', e.target.value)} className="w-full p-2 bg-transparent border-none rounded-lg outline-none text-center font-bold text-gray-700 focus:bg-white transition-all text-sm" placeholder="26" />
                                </td>
                                <td className="p-2 bg-red-50/20">
                                    <input type="text" value={data.delinquencyTarget || ''} onChange={e => handleInputChange(store.id, 'delinquencyTarget', e.target.value)} className="w-full p-2 bg-transparent border-none rounded-lg outline-none text-center font-black text-red-600 focus:bg-white transition-all text-sm" placeholder="2,00" />
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
      </div>
    </div>
  );
};

export default GoalRegistration;
