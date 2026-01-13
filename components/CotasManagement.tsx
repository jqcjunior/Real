
import React, { useState, useMemo, useEffect } from 'react';
import { Store, User, Cota, UserRole, CotaSettings, CotaDebt, MonthlyPerformance } from '../types';
import { formatCurrency } from '../constants';
import { 
    Plus, Trash2, AlertCircle, ShoppingBag, Target, X, Building2,
    Loader2, Check, Calendar, Tag, Package, ArrowRightLeft, DollarSign,
    CheckCircle2, Inbox, UserCircle, Search, Save, CalendarDays, Settings2,
    History, Undo2, ChevronRight, Layers, PieChart, BarChart3, LayoutGrid, ChevronDown
} from 'lucide-react';

const SHORT_MONTHS = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];

const generateTimeline = () => {
    const months = [];
    const targetYear = 2026; 
    const yearShort = "26";
    for (let i = 0; i < 12; i++) {
        const label = `${SHORT_MONTHS[i]}-${yearShort}`;
        const key = `${targetYear}-${String(i + 1).padStart(2, '0')}`;
        months.push({ label, key });
    }
    return months;
};

const calculateInstallments = (shipmentMonth: string, terms: string, totalValue: number) => {
    if (!terms || !shipmentMonth) return {};
    const [year, month] = shipmentMonth.split('-').map(Number);
    const shipmentDate = new Date(year, month - 1, 1);
    const termDays = terms.split('/').map(t => parseInt(t.trim())).filter(t => !isNaN(t));
    if (termDays.length === 0) return { [shipmentMonth]: totalValue };
    const valuePerInstallment = totalValue / termDays.length;
    const installments: Record<string, number> = {};
    termDays.forEach(days => {
        const monthsToAdd = Math.floor(days / 30);
        const dueDate = new Date(shipmentDate.getFullYear(), shipmentDate.getMonth() + monthsToAdd, 1);
        const key = `${dueDate.getFullYear()}-${String(dueDate.getMonth() + 1).padStart(2, '0')}`;
        installments[key] = (installments[key] || 0) + valuePerInstallment;
    });
    return installments;
};

interface CotasManagementProps {
  user: User;
  stores: Store[];
  cotas: Cota[];
  cotaSettings: CotaSettings[];
  cotaDebts: CotaDebt[];
  performanceData: MonthlyPerformance[];
  onAddCota: (cota: Cota) => Promise<void>;
  onUpdateCota: (id: string, updates: Partial<Cota>) => Promise<void>;
  onDeleteCota: (id: string) => Promise<void>;
  onSaveSettings: (settings: CotaSettings) => Promise<void>;
  onSaveDebts: (debt: CotaDebt) => Promise<void>;
  onDeleteDebt: (id: string) => Promise<void>;
}

const CotasManagement: React.FC<CotasManagementProps> = ({ 
  user, stores, cotas, cotaSettings, cotaDebts, performanceData,
  onAddCota, onUpdateCota, onDeleteCota, onSaveSettings, onSaveDebts, onDeleteDebt
}) => {
  const timeline = useMemo(() => generateTimeline(), []);
  
  const activeStores = useMemo(() => {
      const unique = new Map<string, Store>();
      (stores || []).filter(s => s.status === 'active').forEach(s => {
          if (!unique.has(s.number)) unique.set(s.number, s);
      });
      return Array.from(unique.values()).sort((a, b) => parseInt(a.number) - parseInt(b.number));
  }, [stores]);
  
  const [viewStoreId, setViewStoreId] = useState<string>(activeStores[0]?.id || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeForm, setActiveForm] = useState<'order' | 'expense' | 'history' | 'cota_config' | 'params' | null>(null);

  // Form States - Order
  const [brand, setBrand] = useState('');
  const [classification, setClassification] = useState('Feminino Moda');
  const [shipmentDate, setShipmentDate] = useState(timeline[0].key);
  const [paymentTerms, setPaymentTerms] = useState('30/60/90');
  const [totalValue, setTotalValue] = useState('');
  const [pairs, setPairs] = useState('');
  const [orderCreator, setOrderCreator] = useState<'COMPRADOR' | 'GERENTE'>('COMPRADOR');
  const [selectedStoresForOrder, setSelectedStoresForOrder] = useState<string[]>([viewStoreId]);

  // Expense State
  const [expenseValue, setExpenseValue] = useState('');
  const [expenseMonth, setExpenseMonth] = useState(timeline[0].key);
  const [expenseDesc, setExpenseDesc] = useState('');

  // Config State
  const [cotaValue, setCotaValue] = useState('');
  const [mgrPercent, setMgrPercent] = useState('30');

  useEffect(() => {
    const currentSettings = cotaSettings.find(s => s.storeId === viewStoreId);
    if (currentSettings) {
        setCotaValue(String(currentSettings.budgetValue));
        setMgrPercent(String(currentSettings.managerPercent));
    }
  }, [viewStoreId, cotaSettings, activeForm]);

  const consolidated = useMemo(() => {
    const storeAllOrders = cotas.filter(p => p.storeId === viewStoreId);
    const storeDebts = cotaDebts.filter(d => d.storeId === viewStoreId);
    const storeSettings = cotaSettings.find(s => s.storeId === viewStoreId);
    
    const stats: Record<string, { 
        otb: number, compradorLimit: number, gerenteLimit: number, compradorUsed: number, 
        gerenteUsed: number, pendingTotal: number, debts: number, available: number 
    }> = {};

    timeline.forEach(m => {
        const perf = performanceData.find(p => p.storeId === viewStoreId && p.month === m.key);
        const otb = perf?.revenueTarget || storeSettings?.budgetValue || 0;
        const managerPct = storeSettings?.managerPercent || 30;
        const compradorLimit = otb * ((100 - managerPct) / 100);
        const gerenteLimit = otb * (managerPct / 100);
        const monthlyDebts = storeDebts.filter(d => d.month === m.key).reduce((a, b) => a + Number(b.value), 0);
        
        let compradorUsed = 0; let gerenteUsed = 0; let pendingTotal = 0;
        storeAllOrders.forEach(p => { 
            const inst = typeof p.installments === 'string' ? JSON.parse(p.installments) : p.installments;
            const val = Number(inst?.[m.key] || 0);
            if (p.status === 'validated') {
                if (p.createdByRole === 'GERENTE') gerenteUsed += val;
                else compradorUsed += val;
            } else { pendingTotal += val; }
        });
        stats[m.key] = { otb, compradorLimit, gerenteLimit, compradorUsed, gerenteUsed, pendingTotal, debts: monthlyDebts, available: otb - compradorUsed - gerenteUsed - pendingTotal - monthlyDebts };
    });

    return { pendingOrders: storeAllOrders.filter(p => p.status !== 'validated'), validatedOrders: storeAllOrders.filter(p => p.status === 'validated'), stats, storeSettings, storeDebts, currentStoreName: stores.find(s => s.id === viewStoreId)?.name || 'Unidade' };
  }, [cotas, cotaSettings, cotaDebts, viewStoreId, timeline, performanceData, stores]);

  const storeParams = useMemo(() => {
    const storeOrders = cotas.filter(c => c.storeId === viewStoreId);
    const totalPairs = storeOrders.reduce((acc, curr) => acc + (Number(curr.pairs) || 0), 0);
    
    const summary = {
      Feminino: { total: 0, target: 45, subs: {} as Record<string, number> },
      Masculino: { total: 0, target: 20, subs: {} as Record<string, number> },
      Infantil: { total: 0, target: 15, subs: {} as Record<string, number> },
      Acessórios: { total: 0, target: 20, subs: {} as Record<string, number> }
    };
    
    storeOrders.forEach(c => {
        const cat = c.classification || 'Outros';
        const pairsVal = Number(c.pairs) || 0;
        let mainCat: keyof typeof summary | null = null;
        
        if (cat.startsWith('Feminino')) mainCat = 'Feminino';
        else if (cat.startsWith('Masculino')) mainCat = 'Masculino';
        else if (cat.startsWith('Infantil')) mainCat = 'Infantil';
        else if (cat.startsWith('Acessórios')) mainCat = 'Acessórios';
        
        if (mainCat) {
            summary[mainCat].total += pairsVal;
            summary[mainCat].subs[cat] = (summary[mainCat].subs[cat] || 0) + pairsVal;
        }
    });

    return { totalPairs, summary };
  }, [cotas, viewStoreId]);

  const handleInsertOrder = async () => {
    if (!brand || !totalValue || !classification || selectedStoresForOrder.length === 0) 
        return alert("Preencha Marca, Valor, Classificação e selecione ao menos uma loja.");
    setIsSubmitting(true);
    try {
        const valNum = Number(totalValue.replace(/\./g, '').replace(',', '.'));
        const installments = calculateInstallments(shipmentDate, paymentTerms, valNum);
        for (const storeId of selectedStoresForOrder) {
            await onAddCota({ id: '', storeId, brand: brand.toUpperCase(), classification, totalValue: valNum, shipmentDate, paymentTerms, pairs: Number(pairs) || 0, installments, createdByRole: orderCreator, createdAt: new Date(), status: 'pending' });
        }
        setBrand(''); setTotalValue(''); setPairs(''); setClassification('Feminino Moda'); setActiveForm(null);
    } catch (e) { console.error(e); } finally { setIsSubmitting(false); }
  };

  const handleInsertExpense = async () => {
      if (!expenseValue) return alert("Informe o valor da despesa.");
      setIsSubmitting(true);
      try {
          await onSaveDebts({ storeId: viewStoreId, month: expenseMonth, value: Number(expenseValue.replace(/\./g, '').replace(',', '.')), description: expenseDesc });
          setExpenseValue(''); setExpenseDesc(''); setActiveForm(null);
      } catch (e) { alert("Erro ao salvar despesa."); } finally { setIsSubmitting(false); }
  };

  const handleSaveCotaSettings = async () => {
      setIsSubmitting(true);
      try {
          await onSaveSettings({ storeId: viewStoreId, budgetValue: Number(cotaValue.replace(/\./g, '').replace(',', '.')), managerPercent: Number(mgrPercent) });
          setActiveForm(null);
      } catch (e) { alert("Erro ao salvar cota."); } finally { setIsSubmitting(false); }
  };

  const toggleValidation = async (order: Cota) => {
      if (order.status !== 'validated') {
          const inst = typeof order.installments === 'string' ? JSON.parse(order.installments) : order.installments;
          let canValidate = true;
          let errorMsg = "";
          Object.entries(inst).forEach(([month, value]) => {
              const stat = consolidated.stats[month];
              if (stat) {
                  const limit = order.createdByRole === 'GERENTE' ? stat.gerenteLimit : stat.compradorLimit;
                  const used = order.createdByRole === 'GERENTE' ? stat.gerenteUsed : stat.compradorUsed;
                  if (used + Number(value) > limit) { canValidate = false; errorMsg = `BLOQUEIO: Limite excedido em ${month}!`; }
              }
          });
          if (!canValidate) { alert(errorMsg); return; }
      }
      await onUpdateCota(order.id, { status: order.status === 'validated' ? 'pending' : 'validated' as any });
  };

  return (
    <div className="flex flex-col h-screen bg-[#f8fafc] font-sans overflow-hidden text-blue-950">
        {/* CABEÇALHO */}
        <div className="flex-none bg-white border-b border-gray-200 px-8 py-4 flex justify-between items-center z-50 shadow-sm">
            <div className="flex items-center gap-6">
                <div className="bg-blue-900 text-white w-14 h-14 rounded-2xl flex flex-col items-center justify-center shadow-lg border-2 border-white">
                    <Building2 size={24} />
                    <span className="text-[10px] font-black uppercase mt-0.5 leading-none">{stores.find(s => s.id === viewStoreId)?.number || '---'}</span>
                </div>
                <div>
                    <h1 className="text-xl font-black uppercase italic text-blue-950 leading-none tracking-tighter">Engenharia <span className="text-red-600">de Compras</span></h1>
                    <select value={viewStoreId} onChange={e => setViewStoreId(e.target.value)} className="bg-gray-100 mt-2 border-none rounded-xl px-4 py-1.5 text-[10px] font-black uppercase text-gray-700 outline-none appearance-none cursor-pointer">
                        {activeStores.map(s => <option key={s.id} value={s.id}>UNIDADE {s.number} - {s.city}</option>)}
                    </select>
                </div>
            </div>

            <div className="flex gap-2">
                <button onClick={() => { setActiveForm('order'); setSelectedStoresForOrder([viewStoreId]); }} className="flex items-center gap-2 bg-blue-900 text-white px-5 py-3 rounded-xl text-[10px] font-black uppercase hover:bg-black transition-all shadow-md">
                    <Plus size={16} /> Novo Pedido
                </button>
                <button onClick={() => setActiveForm('history')} className="flex items-center gap-2 bg-green-600 text-white px-5 py-3 rounded-xl text-[10px] font-black uppercase hover:bg-green-700 transition-all shadow-md">
                    <History size={16} /> Pedidos
                </button>
                <button onClick={() => setActiveForm('expense')} className="flex items-center gap-2 bg-orange-600 text-white px-5 py-3 rounded-xl text-[10px] font-black uppercase hover:bg-orange-700 transition-all shadow-md">
                    <AlertCircle size={16} /> Despesa
                </button>
                <button onClick={() => setActiveForm('cota_config')} className="flex items-center gap-2 bg-yellow-400 text-blue-950 px-5 py-3 rounded-xl text-[10px] font-black uppercase hover:bg-yellow-500 transition-all shadow-md">
                    <Settings2 size={16} /> Cotas
                </button>
                <button onClick={() => setActiveForm('params')} className="flex items-center gap-2 bg-[#ddd6fe] text-[#5b21b6] px-5 py-3 rounded-xl text-[10px] font-black uppercase hover:bg-[#c4b5fd] transition-all shadow-md border border-[#c4b5fd]">
                    <BarChart3 size={16} /> Parâmetros
                </button>
            </div>
        </div>

        {/* MODAL: PARÂMETROS DE MIX (ROXO CLARO) */}
        {activeForm === 'params' && (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[100] p-4">
                <div className="bg-white rounded-[40px] w-full max-w-4xl shadow-2xl animate-in zoom-in duration-200 overflow-hidden border-t-8 border-[#c4b5fd] max-h-[90vh] flex flex-col">
                    <div className="p-8 border-b border-gray-100 flex justify-between items-center bg-purple-50">
                        <div>
                            <h3 className="text-xl font-black uppercase italic text-blue-950 flex items-center gap-3"><PieChart className="text-purple-600" size={28}/> Parâmetros de Mix - Loja {stores.find(s => s.id === viewStoreId)?.number}</h3>
                            <p className="text-[10px] font-black text-purple-400 uppercase tracking-widest mt-1 ml-10">Meta Global: 45% Fem | 20% Masc | 15% Inf | 20% Acess</p>
                        </div>
                        <button onClick={() => setActiveForm(null)} className="text-gray-400 hover:text-red-600"><X size={32}/></button>
                    </div>
                    <div className="p-8 overflow-y-auto space-y-8 no-scrollbar">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            {['Feminino', 'Masculino', 'Infantil', 'Acessórios'].map((catKey) => {
                                const data = storeParams.summary[catKey as keyof typeof storeParams.summary];
                                const mainPercent = storeParams.totalPairs > 0 ? (data.total / storeParams.totalPairs) * 100 : 0;
                                return (
                                    <div key={catKey} className="bg-gray-50 p-6 rounded-[32px] border border-gray-100 flex flex-col">
                                        <div className="flex justify-between items-end mb-4">
                                            <div>
                                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{catKey}</p>
                                                <p className="text-3xl font-black text-blue-950">{mainPercent.toFixed(1)}%</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-[9px] font-bold text-gray-400">META: {data.target}%</p>
                                                <p className="text-xs font-black text-blue-600">{data.total} PARES</p>
                                            </div>
                                        </div>
                                        <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden mb-6">
                                            <div className="h-full bg-blue-600 transition-all duration-700" style={{ width: `${Math.min(mainPercent, 100)}%` }} />
                                        </div>
                                        <div className="space-y-2 mt-auto">
                                            <p className="text-[9px] font-black text-gray-400 uppercase mb-2 border-b pb-1">Subclassificações</p>
                                            {Object.entries(data.subs).length > 0 ? Object.entries(data.subs).sort((a,b) => b[1] - a[1]).map(([subName, subVal]) => {
                                                const subPct = storeParams.totalPairs > 0 ? (subVal / storeParams.totalPairs) * 100 : 0;
                                                return (
                                                    <div key={subName} className="flex justify-between items-center text-[10px]">
                                                        <span className="font-bold text-gray-600 uppercase">{subName.replace(catKey + ' ', '')}</span>
                                                        <span className="font-black text-blue-900">{subPct.toFixed(1)}% <span className="text-gray-300 ml-1">({subVal})</span></span>
                                                    </div>
                                                );
                                            }) : <p className="text-[9px] text-gray-300 uppercase italic">Nenhum registro</p>}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        <div className="bg-gray-900 p-8 rounded-[32px] text-white flex justify-between items-center shadow-xl">
                            <div>
                                <p className="text-[10px] font-black text-purple-400 uppercase tracking-widest mb-1">Volume Total da Unidade</p>
                                <h4 className="text-4xl font-black italic tracking-tighter">{storeParams.totalPairs.toLocaleString()} <span className="text-sm not-italic font-bold text-gray-500 ml-2">PARES EM CARTEIRA</span></h4>
                            </div>
                            <PieChart size={60} className="text-blue-500 opacity-50" />
                        </div>
                    </div>
                </div>
            </div>
        )}

        {/* MODAL: NOVO PEDIDO (MULTI-LOJA) */}
        {activeForm === 'order' && (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[100] p-4">
                <div className="bg-white rounded-[40px] w-full max-w-5xl shadow-2xl animate-in zoom-in duration-200 overflow-hidden border-t-8 border-blue-900 max-h-[90vh] flex flex-col">
                    <div className="p-8 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                        <h3 className="text-xl font-black uppercase italic text-blue-950 flex items-center gap-3"><ShoppingBag className="text-blue-600" size={28}/> Novo Pedido Estratégico</h3>
                        <button onClick={() => setActiveForm(null)} className="text-gray-400 hover:text-red-600"><X size={32}/></button>
                    </div>
                    <div className="p-10 space-y-6 overflow-y-auto no-scrollbar">
                        <div className="bg-blue-50/50 p-6 rounded-[32px] border border-blue-100">
                            <label className="text-[10px] font-black text-blue-900 uppercase mb-4 block tracking-widest flex items-center gap-2"><LayoutGrid size={14}/> Unidades para este Pedido</label>
                            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                                {activeStores.map(s => (
                                    <button key={s.id} onClick={() => selectedStoresForOrder.includes(s.id) ? setSelectedStoresForOrder(prev => prev.filter(id => id !== s.id)) : setSelectedStoresForOrder(prev => [...prev, s.id])} className={`p-3 rounded-2xl text-[10px] font-black uppercase transition-all border-2 ${selectedStoresForOrder.includes(s.id) ? 'bg-blue-600 border-blue-600 text-white shadow-md' : 'bg-white border-gray-100 text-gray-400'}`}>Loja {s.number}</button>
                                ))}
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div>
                                <label className="text-[10px] font-black text-gray-400 uppercase mb-2 block">Marca</label>
                                <input value={brand} onChange={e => setBrand(e.target.value)} className="w-full p-4 bg-gray-50 rounded-2xl outline-none text-lg font-black uppercase border-2 border-transparent focus:border-blue-500" placeholder="BEIRA RIO" />
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-gray-400 uppercase mb-2 block">Quantidade (Pares)</label>
                                <input type="number" value={pairs} onChange={e => setPairs(e.target.value)} className="w-full p-4 bg-gray-50 rounded-2xl outline-none text-lg font-black border-2 border-transparent focus:border-blue-500" placeholder="0" />
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-gray-400 uppercase mb-2 block">Embarque</label>
                                <select value={shipmentDate} onChange={e => setShipmentDate(e.target.value)} className="w-full p-4 bg-gray-50 rounded-2xl outline-none font-black appearance-none border-2 border-transparent focus:border-blue-500">{timeline.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}</select>
                            </div>
                        </div>
                        <div className="bg-blue-50 p-6 rounded-[32px] border-2 border-blue-200">
                            <label className="text-[10px] font-black text-blue-900 uppercase mb-3 block tracking-widest">Classificação de Produto *</label>
                            <select value={classification} onChange={e => setClassification(e.target.value)} className="w-full p-4 bg-white rounded-2xl outline-none text-sm font-black text-gray-950 border-2 border-blue-300 uppercase italic shadow-sm">
                                <optgroup label="Feminino">
                                    <option value="Feminino Birken">Feminino Birken</option><option value="Feminino Botas">Feminino Botas</option><option value="Feminino Casual">Feminino Casual</option><option value="Feminino Chinelo">Feminino Chinelo</option><option value="Feminino Conforto">Feminino Conforto</option><option value="Feminino Esportivo">Feminino Esportivo</option><option value="Feminino Moda">Feminino Moda</option><option value="Feminino Rasteira">Feminino Rasteira</option>
                                </optgroup>
                                <optgroup label="Masculino">
                                    <option value="Masculino Botas">Masculino Botas</option><option value="Masculino Casual">Masculino Casual</option><option value="Masculino Chinelo">Masculino Chinelo</option><option value="Masculino Esportivo">Masculino Esportivo</option><option value="Masculino Sapatenis">Masculino Sapatenis</option><option value="Masculino Sapato">Masculino Sapato</option>
                                </optgroup>
                                <optgroup label="Infantil">
                                    <option value="Infantil Botas">Infantil Botas</option><option value="Infantil Feminino">Infantil Feminino</option><option value="Infantil Masculino">Infantil Masculino</option><option value="Infantil Unissex">Infantil Unissex</option>
                                </optgroup>
                                <optgroup label="Calçados">
                                    <option value="Unissex">Unissex</option>
                                </optgroup>
                                <optgroup label="Acessórios">
                                    <option value="Acessórios Bolsa">Acessórios Bolsa</option><option value="Acessórios Escolar">Acessórios Escolar</option><option value="Acessórios Esportivo">Acessórios Esportivo</option><option value="Acessórios Mala">Acessórios Mala</option><option value="Acessórios Meia">Acessórios Meia</option><option value="Acessórios Mochila">Acessórios Mochila</option><option value="Acessórios Óculos">Acessórios Óculos</option><option value="Acessórios Perfume">Acessórios Perfume</option><option value="Acessórios Relógio">Acessórios Relógio</option>
                                </optgroup>
                            </select>
                        </div>
                        <div className="grid grid-cols-2 gap-6">
                            <div>
                                <label className="text-[10px] font-black text-gray-400 uppercase mb-2 block">Valor Bruto Total (R$)</label>
                                <input value={totalValue} onChange={e => setTotalValue(e.target.value)} className="w-full p-4 bg-gray-50 rounded-2xl outline-none text-2xl font-black text-blue-900 border-2 border-transparent focus:border-blue-500 shadow-inner" placeholder="0,00" />
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-gray-400 uppercase mb-2 block">Prazos</label>
                                <input value={paymentTerms} onChange={e => setPaymentTerms(e.target.value)} className="w-full p-4 bg-gray-50 rounded-2xl outline-none text-2xl font-black border-2 border-transparent focus:border-blue-500 shadow-inner" placeholder="30/60/90" />
                            </div>
                        </div>
                        <button onClick={handleInsertOrder} disabled={isSubmitting} className="w-full py-6 bg-blue-900 text-white rounded-[24px] font-black uppercase text-xs shadow-xl flex items-center justify-center gap-3 transition-all hover:bg-black border-b-4 border-red-600">
                            {isSubmitting ? <Loader2 className="animate-spin" /> : <Save size={20}/>} Lançar Pedido em {selectedStoresForOrder.length} Lojas
                        </button>
                    </div>
                </div>
            </div>
        )}

        {/* MODAL: LANÇAR DESPESA (TABELA cota_debts) */}
        {activeForm === 'expense' && (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[100] p-4">
                <div className="bg-white rounded-[40px] w-full max-w-lg shadow-2xl animate-in zoom-in duration-200 overflow-hidden border-t-8 border-orange-600">
                    <div className="p-8 border-b border-gray-100 flex justify-between items-center bg-orange-50">
                        <h3 className="text-xl font-black uppercase italic text-orange-950 flex items-center gap-3"><AlertCircle className="text-orange-600" size={28}/> Lançar Despesa (Dedução)</h3>
                        <button onClick={() => setActiveForm(null)} className="text-gray-400 hover:text-red-600"><X size={32}/></button>
                    </div>
                    <div className="p-10 space-y-6">
                        <div>
                            <label className="text-[10px] font-black text-gray-400 uppercase mb-2 block">Valor da Despesa</label>
                            <input value={expenseValue} onChange={e => setExpenseValue(e.target.value)} className="w-full p-5 bg-gray-50 rounded-2xl outline-none text-3xl font-black text-orange-700 text-center" placeholder="0,00" />
                        </div>
                        <div>
                            <label className="text-[10px] font-black text-gray-400 uppercase mb-2 block">Mês de Referência</label>
                            <select value={expenseMonth} onChange={e => setExpenseMonth(e.target.value)} className="w-full p-4 bg-gray-50 rounded-2xl font-black appearance-none border border-gray-100">{timeline.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}</select>
                        </div>
                        <div>
                            <label className="text-[10px] font-black text-gray-400 uppercase mb-2 block">Descrição</label>
                            <input value={expenseDesc} onChange={e => setExpenseDesc(e.target.value)} className="w-full p-4 bg-gray-50 rounded-2xl outline-none font-bold border border-gray-100" placeholder="Ex: Manutenção Elétrica" />
                        </div>
                        <button onClick={handleInsertExpense} disabled={isSubmitting} className="w-full py-5 bg-orange-600 text-white rounded-[24px] font-black uppercase text-xs shadow-xl flex items-center justify-center gap-3">
                            {isSubmitting ? <Loader2 size={20} className="animate-spin" /> : <Save size={18}/>} Registrar em cota_debts
                        </button>
                    </div>
                </div>
            </div>
        )}

        {/* MODAL CONFIGURAÇÃO COTAS (TABELA cota_settings) */}
        {activeForm === 'cota_config' && (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[100] p-4">
                <div className="bg-white rounded-[40px] w-full max-w-lg shadow-2xl animate-in zoom-in duration-200 border-t-8 border-yellow-400 overflow-hidden">
                    <div className="p-8 border-b border-gray-100 flex justify-between items-center bg-yellow-50">
                        <h3 className="text-xl font-black uppercase italic text-blue-950 flex items-center gap-3"><Settings2 className="text-yellow-600" size={28}/> Configurar Limite (OTB)</h3>
                        <button onClick={() => setActiveForm(null)} className="text-gray-400 hover:text-red-600"><X size={32}/></button>
                    </div>
                    <div className="p-10 space-y-8">
                        <div>
                            <label className="text-[10px] font-black text-gray-400 uppercase mb-2 block tracking-widest">Limite OTB Mensal (R$)</label>
                            <input value={cotaValue} onChange={e => setCotaValue(e.target.value)} className="w-full p-6 bg-gray-50 rounded-3xl outline-none text-4xl font-black text-blue-900 text-center" placeholder="0,00" />
                        </div>
                        <div className="grid grid-cols-2 gap-6">
                            <div><label className="text-[10px] font-black text-gray-400 uppercase mb-2 block tracking-widest">Gerente (%)</label><input type="number" value={mgrPercent} onChange={e => setMgrPercent(e.target.value)} className="w-full p-4 bg-gray-50 rounded-2xl text-center font-black text-2xl text-orange-600" /></div>
                            <div><label className="text-[10px] font-black text-gray-400 uppercase mb-2 block tracking-widest">Comprador (%)</label><div className="w-full p-4 bg-gray-100 rounded-2xl text-center font-black text-2xl text-blue-600">{100 - Number(mgrPercent)}</div></div>
                        </div>
                        <button onClick={handleSaveCotaSettings} className="w-full py-6 bg-blue-950 text-white rounded-[24px] font-black uppercase text-xs shadow-xl hover:bg-black transition-all">
                            {isSubmitting ? <Loader2 className="animate-spin" /> : 'Salvar em cota_settings'}
                        </button>
                    </div>
                </div>
            </div>
        )}

        {/* MODAL: HISTÓRICO VALIDADOS (CARTEIRA DE PEDIDOS) - REFINADO */}
        {activeForm === 'history' && (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[100] p-4">
                <div className="bg-white rounded-[40px] w-full max-w-5xl shadow-2xl animate-in zoom-in duration-200 overflow-hidden border-t-8 border-green-600 max-h-[85vh] flex flex-col">
                    <div className="p-8 border-b border-gray-200 flex justify-between items-center bg-gray-50">
                        <div>
                            <h3 className="text-xl font-black uppercase italic text-blue-950 flex items-center gap-3"><History className="text-green-600" size={28}/> Carteira de Pedidos</h3>
                            <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mt-1 ml-10">Visualizando pedidos validados da unidade operacional</p>
                        </div>
                        <button onClick={() => setActiveForm(null)} className="text-gray-400 hover:text-red-600 transition-colors"><X size={32}/></button>
                    </div>
                    <div className="p-0 overflow-auto flex-1 no-scrollbar bg-white">
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-gray-100 sticky top-0 z-10 shadow-sm">
                                <tr className="text-[10px] font-black text-blue-950 uppercase tracking-widest">
                                    <th className="py-4 px-6">Identificação da Marca</th>
                                    <th className="py-4 px-4 text-center">Classificação</th>
                                    <th className="py-4 px-4 text-center">Volume (Pares)</th>
                                    <th className="py-4 px-6 text-right">Faturamento Total</th>
                                    <th className="py-4 px-6 text-center w-24">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {consolidated.validatedOrders.map(order => (
                                    <tr key={order.id} className="hover:bg-blue-50/40 transition-colors group">
                                        <td className="py-2.5 px-6">
                                            <span className="font-black text-sm text-blue-950 uppercase italic tracking-tighter">{order.brand}</span>
                                        </td>
                                        <td className="py-2.5 px-4 text-center">
                                            <span className="text-[10px] font-bold text-gray-800 bg-gray-50 px-3 py-1 rounded-full uppercase border border-gray-100">{order.classification}</span>
                                        </td>
                                        <td className="py-2.5 px-4 text-center">
                                            <span className="font-black text-sm text-blue-700">{order.pairs || 0}</span>
                                        </td>
                                        <td className="py-2.5 px-6 text-right font-black text-gray-950 text-sm">
                                            {formatCurrency(order.totalValue)}
                                        </td>
                                        <td className="py-2.5 px-6 text-center">
                                            <button onClick={() => toggleValidation(order)} className="p-1.5 text-orange-600 hover:bg-orange-100 rounded-lg transition-all" title="Estornar Pedido">
                                                <Undo2 size={18}/>
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                {consolidated.validatedOrders.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="p-20 text-center">
                                            <div className="flex flex-col items-center gap-4 opacity-20">
                                                <Inbox size={64} className="text-gray-400" />
                                                <p className="text-[11px] font-black text-gray-500 uppercase italic tracking-[0.5em]">Nenhum pedido validado em carteira</p>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        )}

        {/* GRADE FINANCEIRA PRINCIPAL */}
        <div className="flex-1 overflow-auto bg-white relative shadow-inner no-scrollbar">
            <table className="w-full text-center border-separate border-spacing-0 table-fixed min-w-[1800px]">
                <thead className="sticky top-0 z-40">
                    <tr className="bg-[#1e3a8a] text-white text-[9px] font-black uppercase tracking-widest h-12">
                        <th className="p-3 w-[260px] text-left border-r border-white/10 sticky left-0 bg-[#1e3a8a] z-50 shadow-md">Marca / Identificação</th>
                        <th className="p-3 w-28 border-r border-white/10 bg-[#1e3a8a] sticky left-[260px] z-50">Resumo</th>
                        {timeline.map(m => <th key={m.key} className="p-3 w-24 border-r border-white/10">{m.label}</th>)}
                    </tr>
                    <tr className="bg-[#fde047] text-blue-950 h-11 border-b-2 border-yellow-600">
                        <td className="p-3 text-left border-r border-yellow-500/30 sticky left-0 bg-[#fde047] z-30 font-black shadow-md text-[10px]">COTA DISPONÍVEL</td>
                        <td className="border-r border-yellow-500/30 sticky left-[260px] bg-[#fde047] z-30 font-black italic text-[9px]">LÍQUIDO</td>
                        {timeline.map(m => (<td key={m.key} className={`p-2 border-r border-yellow-500/30 font-black text-[11px] text-center ${consolidated.stats[m.key].available < 0 ? 'text-red-700 animate-pulse' : 'text-blue-900'}`}>{formatCurrency(consolidated.stats[m.key].available)}</td>))}
                    </tr>
                </thead>
                <tbody className="text-[10px] font-bold uppercase">
                    <tr className="bg-red-50 text-red-700 h-10 border-b border-red-100"><td className="p-3 text-left border-r border-red-200/30 sticky left-0 bg-red-50 z-30 font-black">Despesas Operacionais</td><td className="border-r border-red-200/30 sticky left-[260px] bg-red-50 z-30 font-black italic text-[8px]">TABELA DEBT</td>{timeline.map(m => <td key={m.key} className="p-2 border-r border-red-100 font-black text-center">{formatCurrency(consolidated.stats[m.key].debts)}</td>)}</tr>
                    <tr className="bg-blue-50/40 text-blue-800 h-10"><td className="p-3 text-left border-r border-gray-200 sticky left-0 bg-blue-50 z-30 font-black">Cota Comprador ({100 - (consolidated.storeSettings?.managerPercent || 30)}%)</td><td className="border-r border-gray-200 sticky left-[260px] bg-blue-50 z-30 font-black italic text-[8px]">VALOR</td>{timeline.map(m => <td key={m.key} className="p-2 border-r border-gray-100 text-center font-black">{formatCurrency(consolidated.stats[m.key].compradorUsed)}</td>)}</tr>
                    <tr className="bg-orange-50/40 text-orange-800 h-10"><td className="p-3 text-left border-r border-gray-200 sticky left-0 bg-orange-50 z-30 font-black">Cota Gerente ({consolidated.storeSettings?.managerPercent || 30}%)</td><td className="border-r border-gray-200 sticky left-[260px] bg-orange-50 z-30 font-black italic text-[8px]">VALOR</td>{timeline.map(m => <td key={m.key} className="p-2 border-r border-gray-100 text-center font-black">{formatCurrency(consolidated.stats[m.key].gerenteUsed)}</td>)}</tr>
                    <tr className="bg-gray-100 text-gray-900 h-10 border-b-2 border-gray-300"><td className="p-3 text-left border-r border-gray-200 sticky left-0 bg-gray-100 z-30 font-black italic">Pedidos Pendentes</td><td className="border-r border-gray-200 sticky left-[260px] bg-gray-100 z-30 font-black italic text-[8px]">AGUARDANDO</td>{timeline.map(m => <td key={m.key} className="p-2 border-r border-gray-100 font-black text-center text-gray-600">{formatCurrency(consolidated.stats[m.key].pendingTotal)}</td>)}</tr>
                    {consolidated.pendingOrders.map((order, idx) => (
                        <tr key={order.id} className={`${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'} hover:bg-blue-50 transition-colors border-b border-gray-100 group`}>
                            <td className="p-3 text-left border-r border-gray-100 sticky left-0 bg-inherit z-30 font-black text-gray-900 shadow-sm"><div className="flex items-center justify-between"><div className="flex flex-col"><div className="flex items-center gap-2"><div className={`w-3 h-3 rounded-full shadow-sm ${order.createdByRole === 'GERENTE' ? 'bg-orange-600' : 'bg-blue-600'}`}></div><span className="truncate text-sm text-blue-950 leading-none italic uppercase">{order.brand}</span></div><span className="text-[7px] text-gray-400 not-italic uppercase mt-1 leading-none ml-5 tracking-widest">{order.classification} | {order.pairs || 0} PARES</span></div><div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity"><button onClick={() => toggleValidation(order)} className="p-1 text-gray-300 hover:text-green-500 hover:scale-110 transition-all"><CheckCircle2 size={18}/></button><button onClick={() => onDeleteCota(order.id)} className="p-1 text-red-300 hover:text-red-600 transition-all"><Trash2 size={18}/></button></div></div></td>
                            <td className="p-2 border-r border-gray-100 sticky left-[260px] bg-inherit z-30 text-[8px] font-black text-center shadow-sm"><div className="flex flex-col gap-0.5 leading-tight"><span className="text-blue-600">EMB: {order.shipmentDate}</span><span className="text-gray-900 border-t border-gray-100 mt-0.5 pt-0.5">{formatCurrency(order.totalValue)}</span></div></td>
                            {timeline.map(m => { const inst = typeof order.installments === 'string' ? JSON.parse(order.installments) : order.installments; const installmentValue = Number(inst?.[m.key] || 0); return (<td key={m.key} className={`p-2 border-r border-gray-50 text-center ${installmentValue > 0 ? 'bg-yellow-100/10 text-gray-400 font-bold text-[10px]' : 'text-gray-100'}`}>{installmentValue > 0 ? formatCurrency(installmentValue) : '-'}</td>); })}
                        </tr>
                    ))}
                    {consolidated.pendingOrders.length === 0 && (<tr><td colSpan={14} className="p-20 text-center text-[10px] font-black text-gray-300 uppercase italic tracking-[0.5em]">Tudo em dia!</td></tr>)}
                </tbody>
            </table>
        </div>

        {/* RODAPÉ */}
        <div className="flex-none bg-gray-900 text-white px-8 py-2 flex justify-between items-center text-[8px] font-black uppercase tracking-[0.3em] z-50">
            <div className="flex gap-8"><span className="flex items-center gap-2 text-green-400"><CheckCircle2 size={10}/> Engenharia Sincronizada</span><span className="opacity-30">Real Admin 2026 | v26.2</span></div>
            <span className="text-blue-400 italic">Gestão Estratégica de Capital Corporativo</span>
        </div>
    </div>
  );
};

export default CotasManagement;
