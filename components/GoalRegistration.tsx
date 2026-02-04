
import React, { useState, useEffect, useMemo } from 'react';
import { Store, MonthlyGoal } from '../types';
import { formatCurrency } from '../constants';
import {
  Target,
  Loader2,
  Save,
  Calendar,
  Copy,
  CheckCircle2,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  TrendingUp,
  LayoutGrid,
  Hash,
  ShoppingBag,
  Percent,
  Clock,
  DollarSign,
  Package
} from 'lucide-react';

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

  // Armazenamos como string para permitir a digitação de vírgulas no P.A.
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [saveStatus, setSaveStatus] =
    useState<'idle' | 'saving' | 'success' | 'error'>('idle');

  const months = [
    { value: 1, label: 'Janeiro' }, { value: 2, label: 'Fevereiro' }, { value: 3, label: 'Março' },
    { value: 4, label: 'Abril' }, { value: 5, label: 'Maio' }, { value: 6, label: 'Junho' },
    { value: 7, label: 'Julho' }, { value: 8, label: 'Agosto' }, { value: 9, label: 'Setembro' },
    { value: 10, label: 'Outubro' }, { value: 11, label: 'Novembro' }, { value: 12, label: 'Dezembro' }
  ];

  const activeStores = useMemo(
    () =>
      (stores || [])
        .filter(s => s.status !== 'inactive')
        .sort((a, b) => (parseInt(a.number) || 0) - (parseInt(b.number) || 0)),
    [stores]
  );

  const networkTotals = useMemo(() => {
    // Fix: Explicitly type acc and curr to resolve "unknown" type errors in reduce
    return Object.values(formData).reduce((acc: { revenue: number; items: number }, curr: any) => ({
      revenue: acc.revenue + (Number(curr.revenueTarget) || 0),
      items: acc.items + (Number(curr.itemsTarget) || 0)
    }), { revenue: 0, items: 0 });
  }, [formData]);

  useEffect(() => {
    const initial: Record<string, any> = {};
    activeStores.forEach(store => {
      const existing = (goalsData || []).find(
        g => g.storeId === store.id && Number(g.year) === Number(selectedYear) && Number(g.month) === Number(selectedMonth)
      );
      
      if (existing) {
          initial[store.id] = {
              ...existing,
              // Convertemos P.A. para string com vírgula para o input
              paTarget: String(existing.paTarget || 0).replace('.', ',')
          };
      } else {
          initial[store.id] = {
            storeId: store.id,
            year: selectedYear,
            month: selectedMonth,
            revenueTarget: 0,
            itemsTarget: 0,
            paTarget: '0,00',
            puTarget: 0,
            ticketTarget: 0,
            delinquencyTarget: 2,
            businessDays: 26,
            trend: 'stable'
          };
      }
    });
    setFormData(initial);
  }, [activeStores, goalsData, selectedYear, selectedMonth]);

  const handleChange = (storeId: string, field: string, value: any) => {
    let finalValue = value;
    
    // Logica específica para P.A. - mantém como string para aceitar vírgula durante digitação
    if (field === 'paTarget') {
        finalValue = value; 
    } else if (field !== 'trend') {
        // Para os outros campos, mantemos a lógica numérica padrão
        const cleanValue = String(value).replace(/\./g, '').replace(',', '.');
        finalValue = parseFloat(cleanValue) || 0;
    }

    setFormData(prev => ({
      ...prev,
      [storeId]: { ...prev[storeId], [field]: finalValue }
    }));
  };

  const handleSave = async () => {
    setSaveStatus('saving');
    try {
      // Parseamos os valores de volta para número antes de enviar ao banco
      // Fix: Explicitly type item as any to avoid "unknown" type errors and allow spreading
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
    } catch {
      setSaveStatus('error');
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6 flex flex-col h-full bg-[#f8fafc] pb-24">
      
      <div className="flex flex-col lg:flex-row justify-between items-center gap-4 bg-white p-6 rounded-[32px] shadow-sm border border-gray-100">
        <div className="flex items-center gap-5">
          <div className="p-4 bg-red-600 text-white rounded-2xl shadow-xl shadow-red-200">
            <Target size={24} />
          </div>
          <div>
            <h2 className="text-xl md:text-2xl font-black uppercase italic tracking-tighter text-blue-950 leading-none">
              Cadastro de <span className="text-red-600">Metas Mensais</span>
            </h2>
            <p className="text-gray-400 text-[9px] uppercase font-black tracking-widest mt-1 flex items-center gap-2">
              <Calendar size={12} /> {months.find(m => m.value === selectedMonth)?.label} {selectedYear}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2">
          <div className="flex items-center gap-2 bg-gray-50 px-3 py-2 rounded-xl border border-gray-200">
            <select value={selectedMonth} onChange={e => setSelectedMonth(Number(e.target.value))} className="bg-transparent font-black text-[10px] uppercase text-blue-900 outline-none">
              {months.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
            <div className="w-px h-4 bg-gray-300"></div>
            <select value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))} className="bg-transparent font-black text-[10px] text-blue-900 outline-none">
              {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>

          <button onClick={handleSave} disabled={saveStatus === 'saving'} className="bg-gray-950 text-white px-6 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-xl hover:bg-blue-600 transition-all active:scale-95 border-b-4 border-red-700 disabled:opacity-50 flex items-center gap-2">
            {saveStatus === 'saving' ? <Loader2 className="animate-spin" size={14} /> : <Save size={14} />}
            Efetivar
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
          <div className="bg-white p-4 rounded-2xl border border-gray-100 flex items-center justify-between">
              <div><p className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Faturamento Global</p><p className="text-xl font-black italic text-blue-900 leading-none mt-1">{formatCurrency(networkTotals.revenue)}</p></div>
              <div className="p-2 bg-green-50 text-green-600 rounded-xl"><DollarSign size={20}/></div>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-gray-100 flex items-center justify-between">
              <div><p className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Meta Itens/Pares</p><p className="text-xl font-black italic text-blue-900 leading-none mt-1">{networkTotals.items.toLocaleString()} <span className="text-[9px] not-italic">pares</span></p></div>
              <div className="p-2 bg-blue-50 text-blue-600 rounded-xl"><Package size={20}/></div>
          </div>
      </div>

      <div className="bg-white rounded-[32px] shadow-xl border border-gray-100 overflow-hidden flex-1">
        <div className="overflow-x-auto no-scrollbar h-full">
          <table className="w-full min-w-[1300px] text-left border-collapse">
            <thead className="sticky top-0 bg-white z-20">
              <tr className="bg-gray-50 text-[9px] font-black uppercase text-gray-400 tracking-widest border-b">
                <th className="px-6 py-4 w-[180px] sticky left-0 bg-gray-50">Unidade</th>
                <th className="px-3 py-4 text-center">Faturamento (R$)</th>
                <th className="px-3 py-4 text-center">Itens/Pares</th>
                <th className="px-3 py-4 text-center">P.A. (VÍRGULA)</th>
                <th className="px-3 py-4 text-center">P.U. (MÉDIO)</th>
                <th className="px-3 py-4 text-center">TICKET MÉDIO</th>
                <th className="px-3 py-4 text-center w-24">Dias Úteis</th>
                <th className="px-3 py-4 text-center w-24">Inad (%)</th>
                <th className="px-3 py-4 text-center">Tendência</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {activeStores.map((store) => {
                const row = formData[store.id];
                if (!row) return null;
                return (
                  <tr key={store.id} className="hover:bg-blue-50/50 transition-all group">
                    <td className="px-6 py-3 sticky left-0 bg-white group-hover:bg-blue-50 z-10 border-r border-gray-100">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-black text-gray-900 uppercase italic tracking-tighter leading-none mb-1">LOJA {store.number}</span>
                        <span className="text-[7px] font-bold text-gray-400 uppercase truncate">{store.city}</span>
                      </div>
                    </td>
                    <td className="px-2 py-3">
                      <input type="number" value={row.revenueTarget || ''} onChange={e => handleChange(store.id, 'revenueTarget', e.target.value)} className="w-full p-2 bg-gray-50 border border-transparent rounded-lg font-black text-blue-900 text-center text-[11px] outline-none focus:bg-white focus:border-blue-500" placeholder="0" />
                    </td>
                    <td className="px-2 py-3">
                      <input type="number" value={row.itemsTarget || ''} onChange={e => handleChange(store.id, 'itemsTarget', e.target.value)} className="w-full p-2 bg-gray-50 border border-transparent rounded-lg font-black text-gray-800 text-center text-[11px] outline-none focus:bg-white focus:border-blue-500" placeholder="0" />
                    </td>
                    <td className="px-2 py-3">
                      {/* Único campo que permite vírgula via string */}
                      <input type="text" value={row.paTarget || ''} onChange={e => handleChange(store.id, 'paTarget', e.target.value)} className="w-full p-2 bg-purple-50 border border-purple-100 rounded-lg font-black text-purple-700 text-center text-[11px] outline-none focus:bg-white focus:border-purple-500" placeholder="0,00" />
                    </td>
                    <td className="px-2 py-3">
                      <input type="number" value={row.puTarget || ''} onChange={e => handleChange(store.id, 'puTarget', e.target.value)} className="w-full p-2 bg-gray-50 border border-transparent rounded-lg font-black text-orange-700 text-center text-[11px] outline-none focus:bg-white focus:border-orange-500" placeholder="0" />
                    </td>
                    <td className="px-2 py-3">
                      <input type="number" value={row.ticketTarget || ''} onChange={e => handleChange(store.id, 'ticketTarget', e.target.value)} className="w-full p-2 bg-emerald-50 border border-transparent rounded-lg font-black text-emerald-700 text-center text-[11px] outline-none focus:bg-white focus:border-emerald-500" placeholder="0" />
                    </td>
                    <td className="px-2 py-3">
                      <input type="number" value={row.businessDays || ''} onChange={e => handleChange(store.id, 'businessDays', e.target.value)} className="w-full p-2 bg-gray-50 border border-transparent rounded-lg font-black text-gray-600 text-center text-[11px] outline-none focus:bg-white focus:border-blue-500" placeholder="26" />
                    </td>
                    <td className="px-2 py-3">
                      <input type="number" value={row.delinquencyTarget || ''} onChange={e => handleChange(store.id, 'delinquencyTarget', e.target.value)} className="w-full p-2 bg-gray-50 border border-transparent rounded-lg font-black text-red-600 text-center text-[11px] outline-none focus:bg-white focus:border-red-500" placeholder="0" />
                    </td>
                    <td className="px-2 py-3">
                      <div className="flex justify-center gap-1">
                        {['up', 'stable', 'down'].map(t => (
                            <button key={t} onClick={() => handleChange(store.id, 'trend', t)} className={`p-1.5 rounded-lg transition-all ${row.trend === t ? (t==='up'?'bg-green-600':t==='down'?'bg-red-600':'bg-blue-600') + ' text-white shadow-md' : 'text-gray-300 hover:text-gray-500'}`}>
                                {t === 'up' ? <ArrowUpRight size={14} /> : t === 'down' ? <ArrowDownRight size={14} /> : <Minus size={14} />}
                            </button>
                        ))}
                      </div>
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
