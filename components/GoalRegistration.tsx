import React, { useState, useEffect } from 'react';
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

  const activeStores = stores
    .filter(s => s.status === 'active')
    .sort((a, b) => parseInt(a.number) - parseInt(b.number));

  useEffect(() => {
    const newFormData: Record<string, Partial<MonthlyPerformance>> = {};
    activeStores.forEach(store => {
      const existing = performanceData.find(p => p.storeId === store.id && p.month === selectedMonthStr);
      if (existing) {
          newFormData[store.id] = { ...existing };
      } else {
          newFormData[store.id] = { revenueTarget: 0, itemsTarget: 0, paTarget: 0, ticketTarget: 0, puTarget: 0, delinquencyTarget: 2.0 };
      }
    });
    setFormData(newFormData);
    setSaveStatus('idle');
  }, [selectedMonthStr, performanceData, stores]); 

  const handleInputChange = (storeId: string, field: keyof MonthlyPerformance, value: string) => {
    setFormData(prev => ({ 
      ...prev, 
      [storeId]: { 
        ...prev[storeId], 
        [field]: value 
      } 
    }));
    setSaveStatus('idle');
  };

  const parseToNum = (val: any): number => {
      if (typeof val === 'number') return val;
      if (!val || typeof val !== 'string') return 0;
      // Remove pontos de milhar e substitui vírgula por ponto
      const clean = val.replace(/\./g, '').replace(',', '.');
      const num = parseFloat(clean);
      return isNaN(num) ? 0 : num;
  };

  const executeSave = async () => {
    setSaveStatus('saving');
    try {
        const dataToSave: MonthlyPerformance[] = activeStores.map(store => {
            const data = formData[store.id] || {};
            const existing = performanceData.find(p => p.storeId === store.id && p.month === selectedMonthStr);
            
            return {
                storeId: store.id,
                month: selectedMonthStr,
                revenueTarget: parseToNum(data.revenueTarget ?? existing?.revenueTarget),
                revenueActual: parseToNum(data.revenueActual ?? existing?.revenueActual),
                itemsTarget: Math.round(parseToNum(data.itemsTarget ?? existing?.itemsTarget)),
                itemsActual: parseToNum(data.itemsActual ?? existing?.itemsActual),
                paTarget: parseToNum(data.paTarget ?? existing?.paTarget),
                itemsPerTicket: parseToNum(data.itemsPerTicket ?? existing?.itemsPerTicket),
                ticketTarget: parseToNum(data.ticketTarget ?? existing?.ticketTarget),
                averageTicket: parseToNum(data.averageTicket ?? existing?.averageTicket),
                puTarget: parseToNum(data.puTarget ?? existing?.puTarget),
                unitPriceAverage: parseToNum(data.unitPriceAverage ?? existing?.unitPriceAverage),
                delinquencyTarget: parseToNum(data.delinquencyTarget ?? existing?.delinquencyTarget),
                delinquencyRate: parseToNum(data.delinquencyRate ?? existing?.delinquencyRate),
                percentMeta: 0,
                trend: 'stable' as const,
                correctedDailyGoal: 0
            } as MonthlyPerformance;
        });

        await onUpdateData(dataToSave);
        setSaveStatus('success');
        setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (e: any) {
        // Lógica de extração de erro robusta para evitar [object Object]
        let errorMsg = "Erro desconhecido ao salvar.";
        
        if (e instanceof Error) {
            errorMsg = e.message;
        } else if (typeof e === 'string') {
            errorMsg = e;
        } else if (e && typeof e === 'object') {
            // Caso venha um objeto direto do Supabase sem passar pelo Error do App.tsx
            errorMsg = e.message || e.details || e.hint || JSON.stringify(e);
        }

        console.error("Erro Final Capturado no UI:", errorMsg);
        setSaveStatus('error');
        alert(`Não foi possível salvar as metas.\n\nMotivo: ${errorMsg}\n\nSugestão: Verifique se a regra de unicidade (UNIQUE) foi aplicada ao banco de dados e se não há duplicatas.`);
    }
  };

  return (
    <div className="p-0 md:p-6 lg:p-8 space-y-6 max-w-full bg-gray-50 min-h-full">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-blue-100 text-blue-700 rounded-xl"><Target size={28} /></div>
          <div>
            <h2 className="text-2xl font-black text-gray-900 tracking-tight uppercase italic leading-none">
              Cadastro de <span className="text-red-600">Metas Mensais</span>
            </h2>
            <p className="text-gray-500 font-bold text-[10px] uppercase tracking-widest mt-1.5 flex items-center gap-1">
              <Info size={12}/> Sincronização via Supabase (UPSERT)
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
            <div className="flex items-center gap-2 bg-gray-50 p-2 rounded-xl border border-gray-200 shadow-inner">
                <Calendar className="text-blue-600 ml-1" size={16} />
                <select value={selectedMonthIndex} onChange={(e) => setSelectedMonthIndex(Number(e.target.value))} className="bg-transparent border-none font-black text-gray-800 outline-none cursor-pointer uppercase text-xs">
                    {months.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
                <div className="w-px h-4 bg-gray-300 mx-1"></div>
                <select value={selectedYear} onChange={(e) => setSelectedYear(Number(e.target.value))} className="bg-transparent border-none font-black text-gray-800 outline-none cursor-pointer text-xs">
                    {years.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
            </div>

            <button 
                onClick={executeSave} 
                disabled={saveStatus === 'saving'} 
                className={`flex-1 lg:flex-none px-8 py-3 rounded-xl font-black uppercase text-xs shadow-lg transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50 ${
                    saveStatus === 'success' ? 'bg-green-600 text-white' : 
                    saveStatus === 'error' ? 'bg-red-600 text-white' : 'bg-gray-900 text-white hover:bg-black'
                }`}
            >
                {saveStatus === 'saving' ? (
                    <><Loader2 className="animate-spin" size={16} /> Salvando...</>
                ) : saveStatus === 'success' ? (
                    <><CheckCircle size={16} /> Concluído!</>
                ) : (
                    <><Save size={16} /> Salvar Alterações</>
                )}
            </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden flex flex-col h-[calc(100vh-240px)]">
        <div className="overflow-auto flex-1 no-scrollbar">
            <table className="w-full text-left border-collapse table-fixed">
                <thead className="sticky top-0 z-20">
                    <tr className="bg-gray-900 text-white text-[10px] font-black uppercase tracking-widest">
                        <th className="p-4 w-64 border-r border-white/5 bg-gray-950 sticky left-0 z-30">Unidade Operacional</th>
                        <th className="p-4 text-center border-r border-white/5 bg-blue-900">Meta Faturamento (R$)</th>
                        <th className="p-4 text-center border-r border-white/5">Meta P.A. (Itens/Atend)</th>
                        <th className="p-4 text-center border-r border-white/5">Meta P.U. (Médio)</th>
                        <th className="p-4 text-center border-r border-white/5">Meta Ticket</th>
                        <th className="p-4 text-center border-r border-white/5">Meta Volume (Itens)</th>
                        <th className="p-4 text-center bg-red-950/20">Limite Inadimp. %</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                    {activeStores.map(store => {
                        const data = formData[store.id] || {};
                        return (
                            <tr key={store.id} className="hover:bg-blue-50 transition-all group">
                                <td className="p-4 border-r border-gray-100 bg-white group-hover:bg-blue-50 sticky left-0 z-10 shadow-[2px_0_5px_rgba(0,0,0,0.02)]">
                                    <div className="flex items-center gap-3">
                                        <span className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center font-black text-gray-400 text-[10px]">#{store.number}</span>
                                        <div>
                                            <div className="font-black text-gray-900 text-sm uppercase italic tracking-tighter leading-none">{store.name}</div>
                                            <div className="text-[9px] text-gray-400 font-bold uppercase mt-1">{store.city}</div>
                                        </div>
                                    </div>
                                </td>
                                <td className="p-2 border-r border-gray-100 bg-blue-50/20 group-hover:bg-blue-100/30">
                                    <input 
                                        type="text" 
                                        value={data.revenueTarget ?? ''} 
                                        onChange={(e) => handleInputChange(store.id, 'revenueTarget', e.target.value)} 
                                        className="w-full p-3 bg-transparent border-none rounded-lg outline-none text-right font-black text-blue-900 focus:bg-white focus:ring-2 focus:ring-blue-400 transition-all" 
                                        placeholder="0,00"
                                    />
                                </td>
                                <td className="p-2 border-r border-gray-100">
                                    <input 
                                        type="text" 
                                        value={data.paTarget ?? ''} 
                                        onChange={(e) => handleInputChange(store.id, 'paTarget', e.target.value)} 
                                        className="w-full p-3 bg-transparent border-none rounded-lg outline-none text-center font-bold text-gray-700 focus:bg-white focus:ring-2 focus:ring-blue-100 transition-all" 
                                        placeholder="0.00"
                                    />
                                </td>
                                <td className="p-2 border-r border-gray-100">
                                    <input 
                                        type="text" 
                                        value={data.puTarget ?? ''} 
                                        onChange={(e) => handleInputChange(store.id, 'puTarget', e.target.value)} 
                                        className="w-full p-3 bg-transparent border-none rounded-lg outline-none text-right font-bold text-gray-700 focus:bg-white focus:ring-2 focus:ring-blue-100 transition-all" 
                                        placeholder="0,00"
                                    />
                                </td>
                                <td className="p-2 border-r border-gray-100">
                                    <input 
                                        type="text" 
                                        value={data.ticketTarget ?? ''} 
                                        onChange={(e) => handleInputChange(store.id, 'ticketTarget', e.target.value)} 
                                        className="w-full p-3 bg-transparent border-none rounded-lg outline-none text-right font-bold text-gray-700 focus:bg-white focus:ring-2 focus:ring-blue-100 transition-all" 
                                        placeholder="0,00"
                                    />
                                </td>
                                <td className="p-2 border-r border-gray-100">
                                    <input 
                                        type="text" 
                                        value={data.itemsTarget ?? ''} 
                                        onChange={(e) => handleInputChange(store.id, 'itemsTarget', e.target.value)} 
                                        className="w-full p-3 bg-transparent border-none rounded-lg outline-none text-center font-bold text-gray-700 focus:bg-white focus:ring-2 focus:ring-blue-100 transition-all" 
                                        placeholder="0"
                                    />
                                </td>
                                <td className="p-2 bg-red-50/30 group-hover:bg-red-100/50">
                                    <div className="relative">
                                        <input 
                                            type="text" 
                                            value={data.delinquencyTarget ?? ''} 
                                            onChange={(e) => handleInputChange(store.id, 'delinquencyTarget', e.target.value)} 
                                            className="w-full p-3 bg-transparent border-none rounded-lg outline-none text-right font-black text-red-600 focus:bg-white focus:ring-2 focus:ring-red-400 transition-all" 
                                            placeholder="0.0"
                                        />
                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-red-300 font-black pointer-events-none">%</span>
                                    </div>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
        
        <div className="px-6 py-4 bg-gray-900 text-white flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
            <div className="flex items-center gap-6">
                <span className="flex items-center gap-2 text-blue-400"><Target size={14}/> Sincronização HTTPS</span>
                <span className="flex items-center gap-2 text-green-400">Canal de Dados Criptografado</span>
            </div>
            <div className="flex items-center gap-2 opacity-60">Utilize vírgula para decimais (Ex: 10,50)</div>
        </div>
      </div>
    </div>
  );
};

export default GoalRegistration;