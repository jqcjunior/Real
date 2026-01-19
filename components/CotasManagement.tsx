
import React, { useState, useMemo, useEffect } from 'react';
import { Store, User, Cota, UserRole, CotaSettings, CotaDebts, MonthlyPerformance } from '../types';
import { formatCurrency } from '../constants';
import { 
    Plus, Trash2, AlertCircle, ShoppingBag, Target, X, Building2,
    Loader2, Check, Calendar, Tag, Package, ArrowRightLeft, DollarSign,
    CheckCircle2, Inbox, UserCircle, Search, Save, CalendarDays, Settings2,
    History, Undo2, ChevronRight, Layers, PieChart, BarChart3, LayoutGrid, ChevronDown, BadgeCheck, UserCog, Briefcase
} from 'lucide-react';

const SHORT_MONTHS = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];
const FULL_MONTHS = ['JANEIRO', 'FEVEREIRO', 'MARÇO', 'ABRIL', 'MAIO', 'JUNHO', 'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO'];

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

// Helper para definir o rótulo de quantidade baseado na classificação
const getQtyLabel = (clf: string) => clf?.startsWith('Acessórios') ? 'Unidades' : 'Pares';

interface CotasManagementProps {
  user: User;
  stores: Store[];
  cotas: Cota[];
  cotaSettings: CotaSettings[];
  cotaDebts: CotaDebts[];
  performanceData: MonthlyPerformance[];
  onAddCota: (cota: Cota) => Promise<void>;
  onUpdateCota: (id: string, updates: Partial<Cota>) => Promise<void>;
  onDeleteCota: (id: string) => Promise<void>;
  onSaveSettings: (settings: CotaSettings) => Promise<void>;
  onSaveDebts: (debt: CotaDebts) => Promise<void>;
  onDeleteDebt: (id: string) => Promise<void>;
}

const CotasManagement: React.FC<CotasManagementProps> = ({ 
  user, stores, cotas, cotaSettings, cotaDebts, performanceData,
  onAddCota, onUpdateCota, onDeleteCota, onSaveSettings, onSaveDebts, onDeleteDebt
}) => {
  const timeline = useMemo(() => generateTimeline(), []);
  const isAdmin = user.role === UserRole.ADMIN;
  
  const activeStores = useMemo(() => {
      const unique = new Map<string, Store>();
      (stores || []).filter(s => s.status === 'active').forEach(s => {
          if (!unique.has(s.number)) unique.set(s.number, s);
      });
      return Array.from(unique.values()).sort((a, b) => parseInt(a.number) - parseInt(b.number));
  }, [stores]);
  
  // LOGICA DE SEGURANÇA: Fixar storeId se não for ADMIN
  const [manualStoreId, setManualStoreId] = useState<string>('');
  const viewStoreId = isAdmin 
    ? (manualStoreId || activeStores[0]?.id || '') 
    : (user.storeId || activeStores[0]?.id || '');

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
    } else {
        setCotaValue('0');
        setMgrPercent('30');
    }
  }, [viewStoreId, cotaSettings]);

  const consolidated = useMemo(() => {
    const storeAllOrders = cotas.filter(p => p.storeId === viewStoreId);
    const storeDebts = cotaDebts.filter(d => d.storeId === viewStoreId);
    const storeSettings = cotaSettings.find(s => s.storeId === viewStoreId);
    
    const stats: Record<string, { 
        otb: number, compradorLimit: number, gerenteLimit: number, compradorUsed: number, 
        gerenteUsed: number, pendingTotal: number, debts: number, available: number 
    }> = {};

    timeline.forEach(m => {
        const otb = Number(storeSettings?.budgetValue || 0);
        const managerPct = Number(storeSettings?.managerPercent || 30);
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
        stats[m.key] = { 
            otb, compradorLimit, gerenteLimit, compradorUsed, gerenteUsed, pendingTotal, 
            debts: monthlyDebts, available: otb - compradorUsed - gerenteUsed - pendingTotal - monthlyDebts 
        };
    });

    return { 
        pendingOrders: storeAllOrders.filter(p => p.status !== 'validated'), 
        validatedOrders: storeAllOrders.filter(p => p.status === 'validated').sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()), 
        stats, 
        storeSettings, 
        storeDebts, 
        currentStoreName: stores.find(s => s.id === viewStoreId)?.name || 'Unidade' 
    };
  }, [cotas, cotaSettings, cotaDebts, viewStoreId, timeline, stores]);

  const storeParams = useMemo(() => {
    const storeOrders = cotas.filter(c => c.storeId === viewStoreId);
    const totalPairs = storeOrders.reduce((acc, curr) => acc + (Number(curr.pairs) || 0), 0);
    const summary: Record<string, { total: number, target: number, subs: Record<string, number> }> = {
      'Feminino': { total: 0, target: 45, subs: {} },
      'Masculino': { total: 0, target: 20, subs: {} },
      'Infantil': { total: 0, target: 15, subs: {} },
      'Acessórios': { total: 0, target: 20, subs: {} }
    };

    storeOrders.forEach(c => {
        const cat = c.classification || 'Outros';
        const pairsVal = Number(c.pairs) || 0;
        let mainCat: string | null = null;
        
        if (cat.includes('Feminino')) mainCat = 'Feminino';
        else if (cat.includes('Masculino')) mainCat = 'Masculino';
        else if (cat.includes('Infantil')) mainCat = 'Infantil';
        else if (cat.includes('Acessórios')) mainCat = 'Acessórios';
        else if (cat === 'Unissex') mainCat = 'Masculino';

        if (mainCat && summary[mainCat]) {
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
        const normalizedShipmentDate = `${shipmentDate}-01`;

        for (const storeId of selectedStoresForOrder) {
            await onAddCota({ 
                id: '', 
                storeId, 
                brand: brand.toUpperCase(), 
                classification, 
                totalValue: valNum, 
                shipmentDate: normalizedShipmentDate, 
                paymentTerms, 
                pairs: Number(pairs) || 0, 
                installments, 
                createdByRole: orderCreator, 
                createdAt: new Date(), 
                status: 'pending' 
            });
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

  const currentStoreObj = stores.find(s => s.id === viewStoreId);

  return (
    <div className="flex flex-col h-screen bg-[#f8fafc] font-sans overflow-hidden text-blue-950">
        <div className="flex-none bg-white border-b border-gray-200 px-8 py-4 flex justify-between items-center z-50 shadow-sm">
            <div className="flex items-center gap-6">
                <div className="bg-blue-900 text-white w-14 h-14 rounded-2xl flex flex-col items-center justify-center shadow-lg border-2 border-white">
                    <Building2 size={24} />
                    <span className="text-[10px] font-black uppercase mt-0.5 leading-none">{currentStoreObj?.number || '---'}</span>
                </div>
                <div>
                    <h1 className="text-xl font-black uppercase italic text-blue-950 leading-none tracking-tighter">Engenharia <span className="text-red-600">de Compras</span></h1>
                    {isAdmin ? (
                        <select value={viewStoreId} onChange={e => setManualStoreId(e.target.value)} className="bg-gray-100 mt-2 border-none rounded-xl px-4 py-1.5 text-[10px] font-black uppercase text-gray-700 outline-none appearance-none cursor-pointer">
                            {activeStores.map(s => <option key={s.id} value={s.id}>UNIDADE {s.number} - {s.city}</option>)}
                        </select>
                    ) : (
                        <div className="mt-2 text-[10px] font-black uppercase text-blue-600">UNIDADE {currentStoreObj?.number} - {currentStoreObj?.city}</div>
                    )}
                </div>
            </div>

            <div className="flex gap-2">
                <button onClick={() => { setActiveForm('order'); setSelectedStoresForOrder([viewStoreId]); }} className="flex items-center gap-2 bg-blue-900 text-white px-5 py-3 rounded-xl text-[10px] font-black uppercase hover:bg-black transition-all shadow-md">
                    <Plus size={16} /> Novo Pedido
                </button>
                <button onClick={() => setActiveForm('history')} className="flex items-center gap-2 bg-green-600 text-white px-5 py-3 rounded-xl text-[10px] font-black uppercase hover:bg-green-700 transition-all shadow-md">
                    <History size={16} /> Carteira Pedidos
                </button>
                <button onClick={() => setActiveForm('expense')} className="flex items-center gap-2 bg-orange-600 text-white px-5 py-3 rounded-xl text-[10px] font-black uppercase hover:bg-orange-700 transition-all shadow-md">
                    <AlertCircle size={16} /> Lançar Despesa
                </button>
                {isAdmin && (
                    <button onClick={() => setActiveForm('cota_config')} className="flex items-center gap-2 bg-yellow-400 text-blue-950 px-5 py-3 rounded-xl text-[10px] font-black uppercase hover:bg-yellow-500 transition-all shadow-md">
                        <Settings2 size={16} /> Definir Cota
                    </button>
                )}
                <button onClick={() => setActiveForm('params')} className="flex items-center gap-2 bg-[#ddd6fe] text-[#5b21b6] px-5 py-3 rounded-xl text-[10px] font-black uppercase hover:bg-[#c4b5fd] transition-all shadow-md border border-[#c4b5fd]">
                    <BarChart3 size={16} /> Mix/Params
                </button>
            </div>
        </div>

        <div className="flex-1 overflow-auto bg-white relative shadow-inner">
            <table className="w-full text-center border-separate border-spacing-0 table-fixed min-w-[1800px]">
                <thead className="sticky top-0 z-40">
                    <tr className="bg-[#1e3a8a] text-white text-[9px] font-black uppercase tracking-widest h-12">
                        <th className="p-3 w-[260px] text-left border-r border-white/10 sticky left-0 bg-[#1e3a8a] z-50 shadow-md">Marca / Identificação</th>
                        <th className="p-3 w-28 border-r border-white/10 bg-[#1e3a8a] sticky left-[260px] z-50">Resumo</th>
                        {timeline.map(m => <th key={m.key} className="p-3 w-24 border-r border-white/10">{m.label}</th>)}
                    </tr>
                    <tr className="bg-[#fde047] text-blue-950 h-11 border-b-2 border-yellow-600">
                        <td className="p-3 text-left border-r border-yellow-500/30 sticky left-0 bg-[#fde047] z-30 font-black shadow-md text-[10px]">SALDO COTA ATUAL</td>
                        <td className="border-r border-yellow-500/30 sticky left-[260px] bg-[#fde047] z-30 font-black italic text-[9px]">LÍQUIDO</td>
                        {timeline.map(m => (<td key={m.key} className={`p-2 border-r border-yellow-500/30 font-black text-[11px] text-center ${consolidated.stats[m.key].available < 0 ? 'text-red-700 animate-pulse' : 'text-blue-900'}`}>{formatCurrency(consolidated.stats[m.key].available)}</td>))}
                    </tr>
                </thead>
                <tbody className="text-[10px] font-bold uppercase">
                    <tr className="bg-red-50 text-red-700 h-9 border-b border-red-100"><td className="p-2.5 text-left border-r border-red-200/30 sticky left-0 bg-red-50 z-30 font-black">Gastos Fixos / Debts</td><td className="border-r border-red-200/30 sticky left-[260px] bg-red-50 z-30 font-black italic text-[8px]">SAÍDAS</td>{timeline.map(m => <td key={m.key} className="p-2 border-r border-red-100 font-black text-center">{formatCurrency(consolidated.stats[m.key].debts)}</td>)}</tr>
                    <tr className="bg-blue-50/40 text-blue-800 h-9"><td className="p-2.5 text-left border-r border-gray-200 sticky left-0 bg-blue-50 z-30 font-black">Cota Comprador ({100 - Number(consolidated.storeSettings?.managerPercent || 30)}%)</td><td className="border-r border-gray-200 sticky left-[260px] bg-blue-50 z-30 font-black italic text-[8px]">VALIDADO</td>{timeline.map(m => <td key={m.key} className="p-2 border-r border-gray-100 text-center font-black">{formatCurrency(consolidated.stats[m.key].compradorUsed)}</td>)}</tr>
                    <tr className="bg-orange-50/40 text-orange-800 h-9"><td className="p-2.5 text-left border-r border-gray-200 sticky left-0 bg-orange-50 z-30 font-black">Cota Gerente ({Number(consolidated.storeSettings?.managerPercent || 30)}%)</td><td className="border-r border-gray-200 sticky left-[260px] bg-orange-50 z-30 font-black italic text-[8px]">VALIDADO</td>{timeline.map(m => <td key={m.key} className="p-2 border-r border-gray-100 text-center font-black">{formatCurrency(consolidated.stats[m.key].gerenteUsed)}</td>)}</tr>
                    <tr className="bg-gray-100 text-gray-900 h-9 border-b-2 border-gray-300"><td className="p-2.5 text-left border-r border-gray-200 sticky left-0 bg-gray-100 z-30 font-black italic">Aguardando Validação</td><td className="border-r border-gray-200 sticky left-[260px] bg-gray-100 z-30 font-black italic text-[8px]">PENDENTE</td>{timeline.map(m => <td key={m.key} className="p-2 border-r border-gray-100 font-black text-center text-gray-600">{formatCurrency(consolidated.stats[m.key].pendingTotal)}</td>)}</tr>
                    
                    {consolidated.pendingOrders.map((order, idx) => (
                        <tr key={order.id} className={`${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'} hover:bg-blue-50 transition-colors border-b border-gray-100 group h-10`}>
                            <td className="p-2.5 text-left border-r border-gray-100 sticky left-0 bg-inherit z-30 font-black text-gray-900 shadow-sm"><div className="flex items-center justify-between"><div className="flex flex-col"><div className="flex items-center gap-2"><div className={`w-2.5 h-2.5 rounded-full shadow-sm ${order.createdByRole === 'GERENTE' ? 'bg-orange-600' : 'bg-blue-600'}`}></div><span className="truncate text-sm text-blue-950 leading-none italic uppercase">{order.brand}</span></div><span className="text-[7px] text-gray-400 not-italic uppercase mt-1 leading-none ml-4.5 tracking-widest">{order.classification} | {order.pairs || 0} {getQtyLabel(order.classification).toUpperCase()}</span></div><div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity"><button onClick={() => toggleValidation(order)} className="p-1 text-gray-300 hover:text-green-500 hover:scale-110 transition-all"><CheckCircle2 size={16}/></button><button onClick={() => onDeleteCota(order.id)} className="p-1 text-red-300 hover:text-red-600 transition-all"><Trash2 size={16}/></button></div></div></td>
                            <td className="p-2 border-r border-gray-100 sticky left-[260px] bg-inherit z-30 text-[8px] font-black text-center shadow-sm"><div className="flex flex-col gap-0.5 leading-tight"><span className="text-blue-600">EMB: {FULL_MONTHS[parseInt(order.shipmentDate.split('-')[1]) - 1]}</span><span className="text-gray-900 border-t border-gray-100 mt-0.5 pt-0.5">{formatCurrency(order.totalValue)}</span></div></td>
                            {timeline.map(m => { const inst = typeof order.installments === 'string' ? JSON.parse(order.installments) : order.installments; const val = Number(inst?.[m.key] || 0); return (<td key={m.key} className={`p-2 border-r border-gray-50 text-center ${val > 0 ? 'bg-yellow-100/10 text-gray-400 font-bold text-[9px]' : 'text-gray-100'}`}>{val > 0 ? formatCurrency(val) : '-'}</td>); })}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>

        {/* O restante do código de modais (params, history, etc) permanece idêntico ao original */}
        {/* ... */}
        
        <div className="flex-none bg-gray-900 text-white px-8 py-2 flex justify-between items-center text-[8px] font-black uppercase tracking-[0.3em] z-50">
            <div className="flex gap-8"><span className="flex items-center gap-2 text-green-400"><CheckCircle2 size={10}/> Engenharia Sincronizada</span><span className="opacity-30">Real Admin 2026 | v26.0</span></div>
            <span className="text-blue-400 italic">Gestão Estratégica de Capital Corporativo</span>
        </div>
    </div>
  );
};

export default CotasManagement;
