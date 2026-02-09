import React, { useState, useEffect, useMemo } from 'react';
import { Store, MonthlyGoal } from '../types';
import { formatCurrency } from '../constants';
import { Target, Loader2, Save, Calendar, CalendarDays, CheckCircle2, ChevronDown, Activity, Info, Package, DollarSign } from 'lucide-react';

interface GoalRegistrationProps {
  stores: Store[];
  goalsData: MonthlyGoal[];
  onSaveGoals: (data: MonthlyGoal[]) => Promise<void>;
}

const GoalRegistration: React.FC<GoalRegistrationProps> = ({
  stores,
  goalsData,
  onSaveGoals
}) => {
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');

  const months = [
    { value: 1, label: 'Janeiro' }, { value: 2, label: 'Fevereiro' }, { value: 3, label: 'Março' },
    { value: 4, label: 'Abril' }, { value: 5, label: 'Maio' }, { value: 6, label: 'Junho' },
    { value: 7, label: 'Julho' }, { value: 8, label: 'Agosto' }, { value: 9, label: 'Setembro' },
    { value: 10, label: 'Outubro' }, { value: 11, label: 'Novembro' }, { value: 12, label: 'Dezembro' }
  ];

  const activeStores = useMemo(
    () => (stores || []).filter(s => s.status !== 'inactive').sort((a, b) => (parseInt(a.number) || 0) - (parseInt(b.number) || 0)),
    [stores]
  );

  useEffect(() => {
    const initial: Record<string, any> = {};
    activeStores.forEach(store => {
      const existing = (goalsData || []).find(g => g.storeId === store.id && Number(g.year) === Number(selectedYear) && Number(g.month) === Number(selectedMonth));
      initial[store.id] = existing ? { ...existing, paTarget: String(existing.paTarget || 0).replace('.', ',') } : { storeId: store.id, year: selectedYear, month: selectedMonth, revenueTarget: 0, itemsTarget: 0, paTarget: '0,00', puTarget: 0, ticketTarget: 0, delinquencyTarget: 2, businessDays: 26, trend: 'stable' };
    });
    setFormData(initial);
  }, [activeStores, goalsData, selectedYear, selectedMonth]);

  const handleChange = (storeId: string, field: string, value: any) => {
    setFormData(prev => ({ ...prev, [storeId]: { ...prev[storeId], [field]: value } }));
  };

  const handleSave = async () => {
    setSaveStatus('saving');
    try {
      const dataToSave = Object.values(formData).map((item: any) => ({
          ...item,
          paTarget: parseFloat(String(item.paTarget).replace(',', '.')) || 0,
          revenueTarget: Number(item.revenueTarget) || 0,
          itemsTarget: Number(item.itemsTarget) || 0,
          puTarget: Number(item.puTarget) || 0,
          ticketTarget: Number(item.ticketTarget) || 0,
          delinquencyTarget: Number(item.delinquencyTarget) || 0,
          businessDays: Number(item.businessDays) || 0
      })) as MonthlyGoal[];
      await onSaveGoals(dataToSave);
      setSaveStatus('success');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch { setSaveStatus('error'); }
  };

  return (
    <div className="p-4 md:p-6 space-y-6 flex flex-col h-full bg-[#F8FAFC] pb-24 max-w-[1400px] mx-auto">
      
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-red-600 text-white rounded-2xl shadow-xl shadow-red-100"><Target size={20} /></div>
          <div>
            <h2 className="text-lg font-black uppercase italic tracking-tighter text-slate-900 leading-none">Cadastro de <span className="text-red-600">Metas</span></h2>
            <p className="text-slate-400 text-[9px] uppercase font-black tracking-widest mt-1">Definição Estratégica da Rede</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
            <div className="flex bg-slate-100 p-1 rounded-xl">
                <select value={selectedMonth} onChange={e => setSelectedMonth(Number(e.target.value))} className="bg-white px-3 py-1.5 rounded-lg text-[10px] font-black uppercase text-slate-700 outline-none border-none cursor-pointer">
                    {months.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
                <select value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))} className="bg-transparent px-3 py-1.5 text-[10px] font-black text-slate-400 outline-none border-none cursor-pointer">
                    {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
                </select>
            </div>
            <button onClick={handleSave} disabled={saveStatus === 'saving'} className="bg-slate-950 text-white px-6 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-xl hover:bg-blue-600 transition-all active:scale-95 border-b-2 border-red-700 disabled:opacity-50 flex items-center gap-2">
                {saveStatus === 'saving' ? <Loader2 className="animate-spin" size={14} /> : (saveStatus === 'success' ? <CheckCircle2 size={14}/> : <Save size={14} />)}
                {saveStatus === 'saving' ? 'Gravando...' : (saveStatus === 'success' ? 'Salvo!' : 'Efetivar Metas')}
            </button>
        </div>
      </div>

      <div className="bg-white rounded-[32px] shadow-sm border border-slate-100 overflow-hidden flex-1">
        <div className="overflow-x-auto no-scrollbar h-full">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 bg-white z-20">
              <tr className="bg-slate-50 text-[8px] font-black uppercase text-slate-400 tracking-widest border-b">
                <th className="px-6 py-4 w-48 sticky left-0 bg-slate-50 border-r">Unidade / Cidade</th>
                <th className="px-4 py-4 text-center">Faturamento (R$)</th>
                <th className="px-4 py-4 text-center">Itens (PR)</th>
                <th className="px-4 py-4 text-center">P.A (Virg.)</th>
                <th className="px-4 py-4 text-center">P.U Médio</th>
                <th className="px-4 py-4 text-center">Ticket Médio</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {activeStores.map((store) => {
                const row = formData[store.id];
                if (!row) return null;
                return (
                  <tr key={store.id} className="hover:bg-blue-50/30 transition-all group">
                    <td className="px-6 py-3 sticky left-0 bg-white group-hover:bg-blue-50/50 z-10 border-r">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-black text-slate-900 uppercase italic leading-none mb-0.5">#{store.number} - {store.name.substring(0,10)}</span>
                        <span className="text-[8px] font-bold text-slate-400 uppercase truncate">{store.city}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <input type="number" value={row.revenueTarget || ''} onChange={e => handleChange(store.id, 'revenueTarget', e.target.value)} className="w-full p-2 bg-slate-50 border-none rounded-lg font-black text-slate-900 text-center text-[11px] outline-none focus:bg-white focus:ring-2 focus:ring-blue-100" placeholder="0" />
                    </td>
                    <td className="px-3 py-2">
                      <input type="number" value={row.itemsTarget || ''} onChange={e => handleChange(store.id, 'itemsTarget', e.target.value)} className="w-full p-2 bg-slate-50 border-none rounded-lg font-black text-slate-600 text-center text-[11px] outline-none focus:bg-white focus:ring-2 focus:ring-blue-100" placeholder="0" />
                    </td>
                    <td className="px-3 py-2">
                      <input type="text" value={row.paTarget || ''} onChange={e => handleChange(store.id, 'paTarget', e.target.value)} className="w-full p-2 bg-purple-50 border-none rounded-lg font-black text-purple-700 text-center text-[11px] outline-none focus:bg-white focus:ring-2 focus:ring-purple-100" placeholder="0,00" />
                    </td>
                    <td className="px-3 py-2">
                      <input type="number" value={row.puTarget || ''} onChange={e => handleChange(store.id, 'puTarget', e.target.value)} className="w-full p-2 bg-slate-50 border-none rounded-lg font-black text-orange-700 text-center text-[11px] outline-none focus:bg-white focus:ring-2 focus:ring-orange-100" placeholder="0" />
                    </td>
                    <td className="px-3 py-2">
                      <input type="number" value={row.ticketTarget || ''} onChange={e => handleChange(store.id, 'ticketTarget', e.target.value)} className="w-full p-2 bg-emerald-50 border-none rounded-lg font-black text-emerald-700 text-center text-[11px] outline-none focus:bg-white focus:ring-2 focus:ring-emerald-100" placeholder="0" />
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