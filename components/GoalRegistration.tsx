
import React, { useState, useEffect, useRef } from 'react';
import { Store, MonthlyPerformance } from '../types';
import { Save, Calendar, Target, AlertTriangle, Upload, FileSpreadsheet, Loader2, CheckCircle, X, ShoppingBag, Package, AlertCircle } from 'lucide-react';
import { formatCurrency } from '../constants';
import * as XLSX from 'xlsx';

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
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success'>('idle');

  const years = Array.from({ length: 5 }, (_, i) => currentYear - 1 + i);
  const months = [
    { value: 1, label: 'Janeiro' }, { value: 2, label: 'Fevereiro' }, { value: 3, label: 'Março' },
    { value: 4, label: 'Abril' }, { value: 5, label: 'Maio' }, { value: 6, label: 'Junho' },
    { value: 7, label: 'Julho' }, { value: 8, label: 'Agosto' }, { value: 9, label: 'Setembro' },
    { value: 10, label: 'Outubro' }, { value: 11, label: 'Novembro' }, { value: 12, label: 'Dezembro' }
  ];

  const activeStores = stores
    .filter(s => s.status === 'active')
    .sort((a, b) => parseInt(a.number) - parseInt(b.number));

  useEffect(() => {
    const newFormData: Record<string, Partial<MonthlyPerformance>> = {};
    activeStores.forEach(store => {
      const existing = performanceData.find(p => p.storeId === store.id && p.month === selectedMonthStr);
      newFormData[store.id] = existing ? { ...existing } : { revenueTarget: 0, itemsTarget: 0, paTarget: 0, ticketTarget: 0, puTarget: 0, delinquencyTarget: 2.0 };
    });
    setFormData(newFormData);
    setSaveStatus('idle');
  }, [selectedMonthStr, performanceData, stores]); 

  const handleInputChange = (storeId: string, field: keyof MonthlyPerformance, value: string) => {
    const numValue = parseFloat(value.replace(',', '.'));
    setFormData(prev => ({ ...prev, [storeId]: { ...prev[storeId], [field]: isNaN(numValue) ? 0 : numValue } }));
    setSaveStatus('idle');
  };

  const executeSave = async () => {
    setSaveStatus('saving');
    const dataToSave: MonthlyPerformance[] = activeStores.map(store => {
        const data = formData[store.id] || {};
        return {
            storeId: store.id,
            month: selectedMonthStr,
            revenueTarget: data.revenueTarget || 0,
            revenueActual: data.revenueActual || 0,
            itemsTarget: data.itemsTarget || 0,
            itemsActual: data.itemsActual || 0,
            paTarget: data.paTarget || 0,
            ticketTarget: data.ticketTarget || 0,
            puTarget: data.puTarget || 0,
            delinquencyTarget: data.delinquencyTarget || 0,
            percentMeta: (data.revenueTarget || 0) > 0 ? ((data.revenueActual || 0) / (data.revenueTarget || 1)) * 100 : 0,
            itemsPerTicket: data.itemsPerTicket || 0,
            unitPriceAverage: data.unitPriceAverage || 0,
            averageTicket: data.averageTicket || 0,
            delinquencyRate: data.delinquencyRate || 0,
            trend: 'stable' as const,
            correctedDailyGoal: (data.revenueTarget || 0) / 30
        } as MonthlyPerformance;
    });
    try {
        await onUpdateData(dataToSave);
        setSaveStatus('success');
        alert("Metas sincronizadas com sucesso para todas as lojas!");
    } catch (e) {
        alert("Erro ao salvar metas.");
    } finally { setSaveStatus('idle'); }
  };

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-full animate-in fade-in duration-500">
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6 bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
        <div>
          <h2 className="text-3xl font-black text-gray-900 tracking-tighter flex items-center gap-3 uppercase italic">
            <Target className="text-red-600" size={36} /> Cadastro Unificado de Metas
          </h2>
          <p className="text-gray-500 font-medium text-sm mt-1 uppercase tracking-widest">Edição global de todas as {activeStores.length} unidades em uma única página.</p>
        </div>
        <div className="flex flex-wrap items-center gap-4 w-full xl:w-auto">
            <div className="flex items-center gap-3 bg-gray-50 p-2 rounded-2xl border border-gray-200">
                <Calendar className="text-blue-600 ml-2" size={20} />
                <select value={selectedMonthIndex} onChange={(e) => setSelectedMonthIndex(Number(e.target.value))} className="bg-transparent border-none font-black text-gray-800 outline-none cursor-pointer">
                    {months.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
                <select value={selectedYear} onChange={(e) => setSelectedYear(Number(e.target.value))} className="bg-transparent border-none font-black text-gray-800 outline-none cursor-pointer">
                    {years.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
            </div>
            <button onClick={executeSave} disabled={saveStatus === 'saving'} className="flex-1 xl:flex-none bg-blue-700 text-white px-8 py-3.5 rounded-2xl font-black uppercase text-xs shadow-xl hover:bg-blue-800 transition-all flex items-center justify-center gap-2">
                {saveStatus === 'saving' ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />} Salvar Todas as Lojas
            </button>
        </div>
      </div>

      <div className="bg-white rounded-[32px] shadow-2xl border border-gray-200 overflow-hidden flex flex-col max-h-[calc(100vh-250px)]">
        <div className="overflow-auto flex-1 no-scrollbar">
            <table className="w-full text-left border-collapse table-fixed">
                <thead className="sticky top-0 z-20 shadow-sm">
                    <tr className="bg-gray-900 text-white text-[10px] font-black uppercase tracking-widest">
                        <th className="p-5 w-64 border-r border-white/10 bg-gray-950">Unidade / Loja</th>
                        <th className="p-5 text-center border-r border-white/10">Meta Venda (R$)</th>
                        <th className="p-5 text-center border-r border-white/10">Meta P.A.</th>
                        <th className="p-5 text-center border-r border-white/10">Meta P.U.</th>
                        <th className="p-5 text-center border-r border-white/10">Meta Ticket</th>
                        <th className="p-5 text-center border-r border-white/10">Qtd Itens</th>
                        <th className="p-5 text-center">Inadimp. %</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                    {activeStores.map(store => {
                        const data = formData[store.id] || {};
                        return (
                            <tr key={store.id} className="hover:bg-blue-50/50 transition-colors group">
                                <td className="p-5 border-r border-gray-100 bg-white group-hover:bg-blue-50/50">
                                    <div className="font-black text-gray-900 text-base italic uppercase tracking-tighter">#{store.number} - {store.name}</div>
                                    <div className="text-[10px] text-gray-400 font-bold uppercase">{store.city}</div>
                                </td>
                                <td className="p-3 border-r border-gray-100"><input type="number" step="0.01" value={data.revenueTarget || ''} onChange={(e) => handleInputChange(store.id, 'revenueTarget', e.target.value)} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none text-right font-black text-gray-800" placeholder="0.00"/></td>
                                <td className="p-3 border-r border-gray-100"><input type="number" step="0.01" value={data.paTarget || ''} onChange={(e) => handleInputChange(store.id, 'paTarget', e.target.value)} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none text-center font-black text-gray-800" placeholder="0.00"/></td>
                                <td className="p-3 border-r border-gray-100"><input type="number" step="0.01" value={data.puTarget || ''} onChange={(e) => handleInputChange(store.id, 'puTarget', e.target.value)} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none text-right font-black text-gray-800" placeholder="0.00"/></td>
                                <td className="p-3 border-r border-gray-100"><input type="number" step="0.01" value={data.ticketTarget || ''} onChange={(e) => handleInputChange(store.id, 'ticketTarget', e.target.value)} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none text-right font-black text-gray-800" placeholder="0.00"/></td>
                                <td className="p-3 border-r border-gray-100"><input type="number" value={data.itemsTarget || ''} onChange={(e) => handleInputChange(store.id, 'itemsTarget', e.target.value)} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none text-center font-black text-gray-800" placeholder="0"/></td>
                                <td className="p-3"><input type="number" step="0.1" value={data.delinquencyTarget || ''} onChange={(e) => handleInputChange(store.id, 'delinquencyTarget', e.target.value)} className="w-full p-3 bg-white border-2 border-red-50 rounded-xl outline-none text-right font-black text-red-600" placeholder="0.0"/></td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
        <div className="p-4 bg-gray-50 border-t border-gray-200 text-center text-[10px] font-black text-gray-400 uppercase tracking-widest">
            Listando {activeStores.length} lojas ativas para o período selecionado.
        </div>
      </div>
    </div>
  );
};

export default GoalRegistration;
