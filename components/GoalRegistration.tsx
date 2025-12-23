
import React, { useState, useEffect, useMemo } from 'react';
import { Store, MonthlyPerformance, SellerGoal } from '../types';
import { Save, Calendar, Target, Loader2, CheckCircle, Info, Users, Plus, Trash2, UserPlus, Zap, Calculator, Percent } from 'lucide-react';
import { formatDecimal, formatCurrency } from '../constants';
import { supabase } from '../services/supabaseClient';

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
  
  const [activeTab, setActiveTab] = useState<'stores' | 'sellers'>('stores');
  const [formData, setFormData] = useState<Record<string, Partial<MonthlyPerformance>>>({});
  const [sellerGoals, setSellerGoals] = useState<SellerGoal[]>([]);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');

  const [selectedStoreId, setSelectedStoreId] = useState<string>('');

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
    if (activeStores.length > 0 && !selectedStoreId) setSelectedStoreId(activeStores[0].id);
  }, [activeStores]);

  const loadSellerGoals = async () => {
    const { data } = await supabase.from('seller_goals').select('*').eq('month', selectedMonthStr);
    if (data) {
        setSellerGoals(data.map(d => ({
            id: d.id,
            storeId: d.store_id,
            sellerName: d.seller_name,
            month: d.month,
            revenueTarget: Number(d.revenue_target),
            revenueActual: Number(d.revenue_actual),
            itemsActual: Number(d.items_actual),
            paActual: Number(d.pa_actual),
            commissionRate: Number(d.commission_rate || 0)
        })));
    }
  };

  useEffect(() => {
    loadSellerGoals();
    const newFormData: Record<string, Partial<MonthlyPerformance>> = {};
    activeStores.forEach(store => {
      const existing = performanceData.find(p => p.storeId === store.id && p.month === selectedMonthStr);
      if (existing) {
          newFormData[store.id] = { 
              ...existing,
              delinquencyTarget: formatDecimal(existing.delinquencyTarget || 0) as any
          };
      } else {
          newFormData[store.id] = { revenueTarget: 0, itemsTarget: 0, paTarget: 0, ticketTarget: 0, puTarget: 0, delinquencyTarget: '2,00' as any, businessDays: 26 };
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
      const clean = val.replace(/\./g, '').replace(',', '.');
      const num = parseFloat(clean);
      return isNaN(num) ? 0 : num;
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
                businessDays: parseToNum(data.businessDays ?? existing?.businessDays ?? 26),
                percentMeta: 0,
                trend: 'stable' as const,
                correctedDailyGoal: 0
            } as MonthlyPerformance;
        });

        await onUpdateData(dataToSave);
        setSaveStatus('success');
        setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (e: any) {
        setSaveStatus('error');
        alert(`Erro ao salvar: ${e.message}`);
    }
  };

  const handleAddSeller = () => {
      const name = prompt("Nome do Vendedor:");
      if (!name) return;
      const newGoal: SellerGoal = {
          storeId: selectedStoreId,
          sellerName: name.toUpperCase(),
          month: selectedMonthStr,
          revenueTarget: 0,
          revenueActual: 0,
          commissionRate: 1.5
      };
      setSellerGoals([...sellerGoals, newGoal]);
  };

  const handleUpdateSellerGoal = (idx: number, field: keyof SellerGoal, value: string) => {
      const updated = [...sellerGoals];
      const numValue = parseToNum(value);
      (updated[idx] as any)[field] = numValue;
      setSellerGoals(updated);
  };

  const saveSellers = async () => {
      setSaveStatus('saving');
      try {
          const payload = sellerGoals
            .filter(sg => sg.storeId === selectedStoreId)
            .map(sg => ({
              store_id: sg.storeId,
              seller_name: sg.sellerName,
              month: sg.month,
              revenue_target: sg.revenueTarget,
              revenue_actual: sg.revenueActual,
              items_actual: sg.itemsActual || 0,
              pa_actual: sg.paActual || 0,
              commission_rate: sg.commissionRate || 0
          }));
          await supabase.from('seller_goals').upsert(payload, { onConflict: 'store_id,seller_name,month' });
          setSaveStatus('success');
          loadSellerGoals();
          setTimeout(() => setSaveStatus('idle'), 3000);
      } catch (e) {
          setSaveStatus('error');
      }
  };

  const filteredSellerGoals = sellerGoals.filter(sg => sg.storeId === selectedStoreId);

  // Totais para Dashboard de Registro
  const registrationSummary = useMemo(() => {
    let totalGoal = 0;
    Object.values(formData).forEach(val => {
        totalGoal += parseToNum(val.revenueTarget);
    });
    return { totalGoal };
  }, [formData]);

  return (
    <div className="p-0 md:p-6 lg:p-8 space-y-6 max-w-full bg-gray-50 min-h-full">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-blue-100 text-blue-700 rounded-xl"><Target size={28} /></div>
          <div>
            <h2 className="text-2xl font-black text-gray-900 tracking-tight uppercase italic leading-none">
              Gestão de <span className="text-red-600">Metas Dinâmicas</span>
            </h2>
            <p className="text-gray-500 font-bold text-[10px] uppercase tracking-widest mt-1.5 flex items-center gap-1">
              <Info size={12}/> {activeTab === 'stores' ? 'Metas Globais das Unidades' : 'Metas Individuais da Equipe'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
            <div className="bg-blue-50 px-4 py-2 rounded-xl border border-blue-100 flex flex-col items-end mr-4">
                <span className="text-[8px] font-black text-blue-400 uppercase tracking-widest">Total Rede Acumulado</span>
                <span className="text-sm font-black text-blue-900 uppercase italic">{formatCurrency(registrationSummary.totalGoal)}</span>
            </div>

            <div className="flex bg-gray-100 p-1 rounded-xl border border-gray-200 shadow-inner mr-2">
                <button onClick={() => setActiveTab('stores')} className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'stores' ? 'bg-white text-blue-700 shadow-md' : 'text-gray-400 hover:text-gray-600'}`}>Unidades</button>
                <button onClick={() => setActiveTab('sellers')} className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'sellers' ? 'bg-white text-blue-700 shadow-md' : 'text-gray-400 hover:text-gray-600'}`}>Vendedores</button>
            </div>

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
                onClick={activeTab === 'stores' ? executeSaveStores : saveSellers} 
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

      {activeTab === 'stores' ? (
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
                          <th className="p-4 text-center border-r border-white/5">Dias Úteis</th>
                          <th className="p-4 text-center border-r border-white/5">Furo Diário Est.</th>
                          <th className="p-4 text-center bg-red-950/20">Limite Inadimp. %</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                      {activeStores.map(store => {
                          const data = formData[store.id] || {};
                          const dailyNeeded = parseToNum(data.revenueTarget) / (parseToNum(data.businessDays) || 26);
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
                                          placeholder="0,00"
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
                                          type="number" 
                                          value={data.businessDays ?? 26} 
                                          onChange={(e) => handleInputChange(store.id, 'businessDays', e.target.value)} 
                                          className="w-full p-3 bg-transparent border-none rounded-lg outline-none text-center font-bold text-gray-700 focus:bg-white focus:ring-2 focus:ring-blue-100 transition-all" 
                                          placeholder="26"
                                      />
                                  </td>
                                  <td className="p-2 border-r border-gray-100 bg-gray-50/50">
                                      <div className="text-right px-3 font-black text-blue-600/50 italic text-xs">
                                          {formatCurrency(dailyNeeded)}
                                      </div>
                                  </td>
                                  <td className="p-2 bg-red-50/30 group-hover:bg-red-100/50">
                                      <div className="relative">
                                          <input 
                                              type="text" 
                                              value={data.delinquencyTarget ?? ''} 
                                              onChange={(e) => handleInputChange(store.id, 'delinquencyTarget', e.target.value)} 
                                              className="w-full p-3 bg-transparent border-none rounded-lg outline-none text-right font-black text-red-600 focus:bg-white focus:ring-2 focus:ring-red-400 transition-all" 
                                              placeholder="2,00"
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
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            <div className="lg:col-span-1 space-y-4">
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
                    <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">Selecione a Unidade</h3>
                    <div className="space-y-2">
                        {activeStores.map(s => (
                            <button 
                                key={s.id} 
                                onClick={() => setSelectedStoreId(s.id)}
                                className={`w-full text-left p-4 rounded-2xl text-xs font-black uppercase transition-all flex justify-between items-center ${selectedStoreId === s.id ? 'bg-blue-600 text-white shadow-lg' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'}`}
                            >
                                <span>{s.number} - {s.city}</span>
                                {selectedStoreId === s.id && <CheckCircle size={14}/>}
                            </button>
                        ))}
                    </div>
                </div>
                
                <div className="bg-blue-900 text-white p-6 rounded-3xl shadow-xl relative overflow-hidden">
                    <Zap size={60} className="absolute -right-4 -bottom-4 opacity-10" />
                    <h4 className="text-[10px] font-black text-blue-300 uppercase tracking-widest mb-4">Meta da Unidade</h4>
                    <p className="text-2xl font-black italic tracking-tighter">
                        {formatCurrency(Object.values(formData).find((_, idx) => activeStores[idx]?.id === selectedStoreId)?.revenueTarget || 0)}
                    </p>
                    <p className="text-[9px] font-bold text-blue-400 mt-2 uppercase">Definida pelo Administrador</p>
                </div>

                <button onClick={handleAddSeller} className="w-full py-4 bg-gray-900 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl flex items-center justify-center gap-2 hover:bg-black transition-all">
                    <UserPlus size={16}/> Adicionar Vendedor
                </button>
            </div>
            
            <div className="lg:col-span-3">
                <div className="bg-white rounded-3xl shadow-xl border border-gray-200 overflow-hidden">
                    <div className="p-6 bg-gray-50 border-b flex justify-between items-center">
                        <h3 className="font-black text-gray-900 uppercase italic tracking-tight flex items-center gap-2">
                            <Users size={20} className="text-blue-600"/> Equipe: <span className="text-blue-700">{stores.find(s => s.id === selectedStoreId)?.name}</span>
                        </h3>
                    </div>
                    <div className="p-0">
                        <table className="w-full text-left">
                            <thead className="bg-white border-b">
                                <tr className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                                    <th className="p-5">Nome do Vendedor</th>
                                    <th className="p-5 text-right">Meta Individual (R$)</th>
                                    <th className="p-5 text-right">Comissão (%)</th>
                                    <th className="p-5 text-right">Realizado (R$)</th>
                                    <th className="p-5 text-center">Progresso</th>
                                    <th className="p-5 w-20"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {filteredSellerGoals.map((sg, idx) => (
                                    <tr key={idx} className="hover:bg-gray-50 group">
                                        <td className="p-5">
                                            <span className="font-black text-gray-900 uppercase italic text-sm">{sg.sellerName}</span>
                                        </td>
                                        <td className="p-5">
                                            <input 
                                                value={sg.revenueTarget === 0 ? '' : sg.revenueTarget}
                                                onChange={(e) => handleUpdateSellerGoal(idx, 'revenueTarget', e.target.value)}
                                                className="w-full bg-gray-100/50 border-none rounded-xl p-3 text-right font-black text-blue-900 focus:bg-white focus:ring-2 focus:ring-blue-100 outline-none"
                                                placeholder="0,00"
                                            />
                                        </td>
                                        <td className="p-5 w-24">
                                            <div className="relative">
                                                <input 
                                                    value={sg.commissionRate === 0 ? '' : sg.commissionRate}
                                                    onChange={(e) => handleUpdateSellerGoal(idx, 'commissionRate', e.target.value)}
                                                    className="w-full bg-gray-100/50 border-none rounded-xl p-3 text-right font-bold text-orange-600 focus:bg-white focus:ring-2 focus:ring-orange-100 outline-none"
                                                    placeholder="1,5"
                                                />
                                                <Percent className="absolute left-2 top-1/2 -translate-y-1/2 text-orange-200" size={10} />
                                            </div>
                                        </td>
                                        <td className="p-5">
                                            <input 
                                                value={sg.revenueActual === 0 ? '' : sg.revenueActual}
                                                onChange={(e) => handleUpdateSellerGoal(idx, 'revenueActual', e.target.value)}
                                                className="w-full bg-gray-100/50 border-none rounded-xl p-3 text-right font-bold text-gray-600 focus:bg-white focus:ring-2 focus:ring-blue-100 outline-none"
                                                placeholder="0,00"
                                            />
                                        </td>
                                        <td className="p-5">
                                            {(() => {
                                                const pct = sg.revenueTarget > 0 ? (sg.revenueActual / sg.revenueTarget) * 100 : 0;
                                                return (
                                                    <div className="flex flex-col items-center gap-1">
                                                        <span className="text-[9px] font-black text-gray-400">{pct.toFixed(1)}%</span>
                                                        <div className="w-24 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                                            <div className={`h-full ${pct >= 100 ? 'bg-green-500' : 'bg-blue-600'}`} style={{ width: `${Math.min(pct, 100)}%` }}/>
                                                        </div>
                                                    </div>
                                                );
                                            })()}
                                        </td>
                                        <td className="p-5 text-right">
                                            <button onClick={() => setSellerGoals(sellerGoals.filter((_, i) => i !== idx))} className="text-gray-300 hover:text-red-500 transition-colors">
                                                <Trash2 size={16}/>
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                {filteredSellerGoals.length === 0 && (
                                    <tr>
                                        <td colSpan={6} className="p-20 text-center text-[10px] font-black text-gray-300 uppercase tracking-[0.3em]">Nenhum vendedor cadastrado</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
      )}

      <div className="px-6 py-4 bg-gray-900 text-white flex justify-between items-center text-[10px] font-black uppercase tracking-widest rounded-2xl">
          <div className="flex items-center gap-6">
              <span className="flex items-center gap-2 text-blue-400"><Target size={14}/> Sincronização HTTPS</span>
              <span className="flex items-center gap-2 text-green-400">Canal de Dados Criptografado</span>
          </div>
          <div className="flex items-center gap-2 opacity-60">Utilize vírgula para decimais (Ex: 10,50)</div>
      </div>
    </div>
  );
};

export default GoalRegistration;
