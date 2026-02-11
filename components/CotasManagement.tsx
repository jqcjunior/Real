import React, { useState, useMemo, useEffect } from 'react';
import { Store, User, Cota, UserRole, CotaSettings, CotaDebts, MonthlyPerformance, QuotaCategory, QuotaMixParameter } from '../types';
import { formatCurrency, BRAND_LOGO } from '../constants';
import { 
    Plus, Trash2, Building2, Loader2, DollarSign, Calculator, X, Save, 
    History, CheckCircle, BadgeCheck, FileBarChart, Printer, Check,
    LayoutGrid, UserCheck, Briefcase, Layers, TrendingDown, Info, Calendar,
    AlertTriangle, ArrowUpRight, ArrowDownRight, Target, PieChart, ChevronRight, Settings,
    Activity, ArrowRight, ChevronDown, ChevronUp, Lightbulb, Wallet, Filter, User as UserIcon, CalendarDays,
    ShoppingBag, Shirt, Smile, Watch, Sparkles 
} from 'lucide-react';

const FULL_MONTH_NAMES = ["JANEIRO", "FEVEREIRO", "MARÇO", "ABRIL", "MAIO", "JUNHO", "JULHO", "AGOSTO", "SETEMBRO", "OUTUBRO", "NOVEMBRO", "DEZEMBRO"];
const SHORT_MONTHS_DISPLAY = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];

const getMonthNameFromKey = (key: string) => {
    if (!key) return '-';
    const parts = key.split('-');
    if (parts.length < 2) return key;
    const monthIndex = parseInt(parts[1]) - 1;
    return FULL_MONTH_NAMES[monthIndex] || key;
};

const generateTimeline = (): { label: string, key: string, monthIndex: number }[] => {
    const months: { label: string, key: string, monthIndex: number }[] = [];
    const now = new Date();
    const startMonth = now.getMonth(); 
    const startYear = now.getFullYear();

    for (let i = 0; i < 12; i++) {
        const d = new Date(startYear, startMonth + i, 1);
        const mIndex = d.getMonth();
        const year = d.getFullYear();
        const yearSuffix = String(year).slice(-2);
        const label = `${SHORT_MONTHS_DISPLAY[mIndex]}-${yearSuffix}`;
        const key = `${year}-${String(mIndex + 1).padStart(2, '0')}`;
        months.push({ label, key, monthIndex: mIndex });
    }
    return months;
};

const getInstallmentValueForMonth = (order: Cota, monthKey: string): number => {
    if (!order.installments) return 0;
    if (!Array.isArray(order.installments)) {
        return (order.installments as Record<string, number>)[monthKey] || 0;
    }
    return 0;
};

const calculateInstallmentsMap = (shipmentMonthKey: string, terms: string, totalValue: number): Record<string, number> => {
    const termDays = terms.split('/').map(t => parseInt(t.trim())).filter(t => !isNaN(t));
    if (termDays.length === 0) return { [shipmentMonthKey]: totalValue };
    
    const [year, month] = shipmentMonthKey.split('-').map(Number);
    const valuePerInstallment = parseFloat((totalValue / termDays.length).toFixed(2));
    const installments: Record<string, number> = {};
    
    let sumAdded = 0;
    termDays.forEach((days, index) => {
        const monthsToAdd = Math.floor(days / 30);
        const d = new Date(year, (month - 1) + monthsToAdd, 1);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const currentVal = (index === termDays.length - 1) 
            ? parseFloat((totalValue - sumAdded).toFixed(2))
            : valuePerInstallment;
        installments[key] = (installments[key] || 0) + currentVal;
        sumAdded += currentVal;
    });
    return installments;
};

const normalizeText = (text: string) => {
    return String(text || '')
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "") 
        .toUpperCase()
        .trim();
};

const getCategoryIcon = (category: string) => {
    const norm = normalizeText(category);
    if (norm.includes('FEMININO')) return <ShoppingBag size={14} />;
    if (norm.includes('MASCULINO')) return <Shirt size={14} />;
    if (norm.includes('INFANTIL')) return <Smile size={14} />;
    if (norm.includes('ACESSORIO')) return <Watch size={14} />;
    return <Layers size={14} />;
};

interface CotasManagementProps {
  user: User;
  stores: Store[];
  cotas: Cota[];
  cotaSettings: CotaSettings[];
  cotaDebts: CotaDebts[];
  performanceData: MonthlyPerformance[];
  productCategories: QuotaCategory[];
  mixParameters: QuotaMixParameter[];
  onAddCota: (cota: Cota) => Promise<void>;
  onUpdateCota: (id: string, updates: Partial<Cota>) => Promise<void>;
  onDeleteCota: (id: string) => Promise<void>;
  onSaveSettings: (settings: CotaSettings) => Promise<void>;
  onSaveDebts: (debt: CotaDebts) => Promise<void>;
  onDeleteDebt: (id: string) => Promise<void>;
  onUpdateMixParameter?: (id: string | null, storeId: string, category: string, percent: number, semester: number) => Promise<void>;
}

export const CotasManagement: React.FC<CotasManagementProps> = ({ 
    user, stores, cotas, cotaSettings, cotaDebts, productCategories = [], mixParameters = [],
    onAddCota, onUpdateCota, onDeleteCota, onSaveSettings, onSaveDebts, onDeleteDebt, onUpdateMixParameter
}) => {
  const timeline = useMemo(() => generateTimeline(), []);
  const isAdmin = user.role === UserRole.ADMIN;
  const [manualStoreId, setManualStoreId] = useState<string>('');
  const activeStores = useMemo(() => (stores || []).filter(s => s.status === 'active').sort((a, b) => (parseInt(a.number) || 0) - (parseInt(b.number) || 0)), [stores]);
  const viewStoreId = isAdmin ? (manualStoreId || activeStores[0]?.id || '') : user.storeId!;

  const [activeForm, setActiveForm] = useState<'order' | 'expense' | 'cota_config' | 'validated_orders' | 'mix_view' | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEditingMix, setIsEditingMix] = useState(false);
  const [mixFilterSemester, setMixFilterSemester] = useState<'all' | '1' | '2'>('all');
  const [selectedMobileMonth, setSelectedMobileMonth] = useState(timeline[0].key);

  const [brand, setBrand] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [shipmentMonth, setShipmentMonth] = useState(timeline[0].key);
  const [paymentTerms, setPaymentTerms] = useState('30/60/90');
  const [totalValue, setTotalValue] = useState('');
  const [pairs, setPairs] = useState('');
  const [selectedStoresForOrder, setSelectedStoresForOrder] = useState<string[]>([]);
  const [orderCreatedByRole, setOrderCreatedByRole] = useState<'COMPRADOR' | 'GERENTE'>('COMPRADOR');
  
  const [simStartMonth, setSimStartMonth] = useState(timeline[0].key);
  const [simInstallments, setSimInstallments] = useState(3);
  const [semesterDebts, setSemesterDebts] = useState<Record<string, string>>({});

  useEffect(() => {
    if (activeForm === 'expense') {
        const initialDebts: Record<string, string> = {};
        timeline.forEach(m => {
            const existing = cotaDebts.find(d => d.storeId === viewStoreId && d.month === m.key);
            initialDebts[m.key] = existing ? existing.value.toString() : '';
        });
        setSemesterDebts(initialDebts);
    }
  }, [activeForm, cotaDebts, viewStoreId, timeline]);

  const storeSettings = useMemo(() => cotaSettings.find(s => s.storeId === viewStoreId), [cotaSettings, viewStoreId]);
  const [budgetVal, setBudgetVal] = useState('');
  const [managerPct, setManagerPct] = useState('');

  useEffect(() => {
    if (storeSettings) {
        setBudgetVal(storeSettings.budgetValue.toString());
        setManagerPct(storeSettings.managerPercent.toString());
    }
  }, [storeSettings, activeForm]);

  const consolidated = useMemo(() => {
    const storeOrders = cotas.filter(p => p.storeId === viewStoreId);
    const storeDebts = cotaDebts.filter(d => d.storeId === viewStoreId);
    const settings = cotaSettings.find(s => s.storeId === viewStoreId);
    const stats: Record<string, any> = {};

    let totalDebtsGlobal = 0;
    let totalBuyerValidGlobal = 0;
    let totalManagerValidGlobal = 0;

    timeline.forEach(m => {
        const budgetTotal = Number(settings?.budgetValue || 0);
        const monthlyFixedExpenses = storeDebts.filter(d => d.month === m.key).reduce((a, b) => a + Number(b.value), 0);
        totalDebtsGlobal += monthlyFixedExpenses;
        const managerPercentDecimal = (settings?.managerPercent || 0) / 100;
        const limitManager = budgetTotal * managerPercentDecimal;
        const limitBuyer = Math.max(0, budgetTotal - monthlyFixedExpenses - limitManager);

        let usedBuyer = 0;
        let usedManager = 0;
        let pendingInstallmentSum = 0;

        storeOrders.forEach(p => { 
            const val = getInstallmentValueForMonth(p, m.key);
            const role = String(p.createdByRole || '').toUpperCase();
            if (p.status === 'VALIDADO' || p.status === 'validated' || p.status === 'FECHADA') {
                if (role === 'GERENTE') { usedManager += val; totalManagerValidGlobal += val; } 
                else { usedBuyer += val; totalBuyerValidGlobal += val; }
            } else if (p.status === 'ABERTA' || p.status === 'pending') {
                pendingInstallmentSum += val;
                if (role === 'GERENTE') { usedManager += val; } else { usedBuyer += val; }
            }
        });

        stats[m.key] = { limitManager, limitBuyer, usedManager, usedBuyer, balanceManager: limitManager - usedManager, balanceBuyer: limitBuyer - usedBuyer, debts: monthlyFixedExpenses, pendingInstallmentSum };
    });
    return { orders: storeOrders, stats, debts: storeDebts, totalBuyerValidGlobal, totalManagerValidGlobal, totalDebtsGlobal };
  }, [cotas, cotaSettings, cotaDebts, viewStoreId, timeline]);

  const simulationResult = useMemo(() => {
      if (!simStartMonth || simInstallments <= 0) return { maxPurchase: 0, limitingMonth: '' };
      const startIndex = timeline.findIndex(t => t.key === simStartMonth);
      if (startIndex === -1) return { maxPurchase: 0, limitingMonth: '' };
      let minAvailable = Infinity;
      let limitingMonthLabel = '';
      for (let i = 0; i < simInstallments; i++) {
          const targetIndex = startIndex + i;
          if (targetIndex >= timeline.length) continue;
          const monthKey = timeline[targetIndex].key;
          const available = consolidated.stats[monthKey]?.balanceBuyer || 0;
          if (available < minAvailable) { minAvailable = available; limitingMonthLabel = timeline[targetIndex].label; }
      }
      if (minAvailable === Infinity || minAvailable < 0) minAvailable = 0;
      return { maxPurchase: minAvailable * simInstallments, limitingMonth: limitingMonthLabel };
  }, [consolidated, simStartMonth, simInstallments, timeline]);

  const mixHierarchyData = useMemo(() => {
      const budget = Number(storeSettings?.budgetValue || 0);
      const segments = ['FEMININO', 'MASCULINO', 'INFANTIL', 'ACESSÓRIO'];
      const mixRelevantOrders = cotas.filter(o => {
          if (o.storeId !== viewStoreId) return false;
          if (mixFilterSemester === 'all') return true; 
          const month = parseInt(o.shipmentDate.split('-')[1]); 
          return mixFilterSemester === '1' ? (month >= 1 && month <= 6) : (month >= 7 && month <= 12);
      });

      return segments.map(segName => {
          const segParam = mixParameters.find(m => (m.store_id === viewStoreId || m.storeId === viewStoreId) && normalizeText(m.category_name) === normalizeText(segName) && (mixFilterSemester === 'all' || m.semester === Number(mixFilterSemester)));
          const metaPercent = Number(segParam?.percentage || 0);
          const subCats = (productCategories || []).filter(c => normalizeText(c.parent_category) === normalizeText(segName));
          let segUtilizedValueTotal = 0;

          const details = subCats.map(cat => {
              const utilizedValue = mixRelevantOrders.filter(o => String(o.category_id) === String(cat.id) || normalizeText(o.category_name) === normalizeText(cat.category_name)).reduce((acc, curr) => acc + Number(curr.totalValue || 0), 0);
              segUtilizedValueTotal += utilizedValue;
              return { id: cat.id, category_name: cat.category_name, utilizedValue };
          });
          details.sort((a, b) => b.utilizedValue - a.utilizedValue);
          const utilizedPercentGlobal = budget > 0 ? (segUtilizedValueTotal / budget) * 100 : 0;
          const utilizationOfQuota = metaPercent > 0 ? (utilizedPercentGlobal / metaPercent) * 100 : 0;

          return { segment: segName, metaPercent, utilizedValue: segUtilizedValueTotal, utilizedPercent: utilizedPercentGlobal, utilizationOfQuota, subcategories: details };
      });
  }, [productCategories, mixParameters, cotas, viewStoreId, storeSettings, mixFilterSemester]);

  const getTrafficLightStyle = (utilizationRatio: number, isActiveItem: boolean = false) => {
      if (!isActiveItem) return { text: 'text-gray-400', bar: 'bg-gray-300' };
      if (utilizationRatio >= 99) return { text: 'text-red-600', bar: 'bg-red-500' };
      if (utilizationRatio >= 70) return { text: 'text-amber-600', bar: 'bg-amber-500' };
      return { text: 'text-emerald-600', bar: 'bg-emerald-500' };
  };

  const handleSaveOrder = async (e: React.FormEvent) => {
      e.preventDefault();
      const val = parseFloat((totalValue as string).replace(',', '.'));
      if (!brand || !selectedCategoryId || isNaN(val) || selectedStoresForOrder.length === 0) return;
      setIsSubmitting(true);
      try {
          const installmentsMap = calculateInstallmentsMap(shipmentMonth, paymentTerms, val);
          const category = productCategories.find(c => c.id === selectedCategoryId);
          for (const storeId of selectedStoresForOrder) {
              await onAddCota({ id: `tmp-${Date.now()}`, storeId, brand: brand.toUpperCase().trim(), category_id: selectedCategoryId, category_name: category?.category_name || 'GERAL', totalValue: val, shipmentDate: shipmentMonth, paymentTerms: paymentTerms.trim(), pairs: parseInt(pairs) || 0, installments: installmentsMap, createdByRole: orderCreatedByRole, status: 'ABERTA', createdAt: new Date() });
          }
          setBrand(''); setTotalValue(''); setPairs(''); setActiveForm(null);
          alert("Pedido(s) registrado(s) com sucesso!");
      } catch (err: any) { alert("Erro: " + err.message); } finally { setIsSubmitting(false); }
  };

  const handleSaveAllExpenses = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
        for (const [month, valueStr] of Object.entries(semesterDebts)) {
            const val = parseFloat((valueStr as string).replace(',', '.')) || 0;
            if (!isNaN(val)) { await onSaveDebts({ storeId: viewStoreId, month: month, value: val }); }
        }
        setActiveForm(null);
        alert("Despesas atualizadas com sucesso!");
    } catch (e) { alert("Erro ao salvar despesas."); } finally { setIsSubmitting(false); }
  };

  const handleSaveCotaSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat((budgetVal as string).replace(',', '.'));
    const pct = parseFloat((managerPct as string).replace(',', '.'));
    if (isNaN(val) || isNaN(pct)) return;
    setIsSubmitting(true);
    await onSaveSettings({ storeId: viewStoreId, budgetValue: val, managerPercent: pct });
    setActiveForm(null);
    setIsSubmitting(false);
    alert("Cota configurada com sucesso!");
  };

  return (
    <div className="flex flex-col h-screen bg-[#f3f4f6] overflow-hidden text-blue-950 font-sans">
        <div className="bg-white px-4 py-3 flex flex-col lg:flex-row justify-between items-center gap-4 z-50 shadow-sm border-b shrink-0">
            <div className="flex items-center gap-3 w-full lg:w-auto">
                <div className="bg-blue-900 text-white p-2 rounded-lg shadow-md shrink-0"><Building2 size={20}/></div>
                <div className="flex-1">
                    <h1 className="text-sm font-black uppercase italic leading-none tracking-tight text-blue-900">Engenharia <span className="text-blue-800 font-black">de Compras</span></h1>
                    <div className="flex items-center gap-2 mt-1">
                        {isAdmin ? (
                            <select value={viewStoreId} onChange={e => setManualStoreId(e.target.value)} className="bg-white border border-gray-200 rounded px-2 py-1 text-[10px] font-black uppercase text-blue-900 outline-none shadow-sm w-full lg:w-auto">
                                {activeStores.map(s => ( <option key={s.id} value={s.id}>Loja {s.number} - {s.city}</option> ))}
                            </select>
                        ) : (
                            <span className="text-[10px] font-black text-blue-800 uppercase tracking-widest">
                              Loja {stores.find(s => s.id === viewStoreId)?.number} - {stores.find(s => s.id === viewStoreId)?.city}
                            </span>
                        )}
                    </div>
                </div>
            </div>
            
            <div className="grid grid-cols-3 lg:flex gap-2 w-full lg:w-auto">
                <button onClick={() => { setSelectedStoresForOrder([viewStoreId]); setActiveForm('order'); }} className="bg-blue-900 text-white px-3 py-2 rounded-lg font-black uppercase text-[9px] shadow-sm hover:bg-black transition-all flex items-center justify-center gap-1.5 border-b-2 border-blue-950"><Plus size={12}/> <span className="hidden sm:inline">Novo</span> Pedido</button>
                <button onClick={() => setActiveForm('validated_orders')} className="bg-green-600 text-white px-3 py-2 rounded-lg font-black uppercase text-[9px] shadow-sm hover:bg-green-700 transition-all flex items-center justify-center gap-1.5 border-b-2 border-green-800"><BadgeCheck size={12}/> Validados</button>
                <button onClick={() => setActiveForm('mix_view')} className="bg-purple-600 text-white px-3 py-2 rounded-lg font-black uppercase text-[9px] shadow-sm hover:bg-purple-700 transition-all flex items-center justify-center gap-1.5 border-b-2 border-purple-800"><FileBarChart size={12}/> Mix</button>
                <button onClick={() => setActiveForm('expense')} className="bg-orange-600 text-white px-3 py-2 rounded-lg font-black uppercase text-[9px] shadow-sm hover:bg-orange-700 transition-all flex items-center justify-center gap-1.5 border-b-2 border-orange-800"><DollarSign size={12}/> Despesa</button>
                <button onClick={() => setActiveForm('cota_config')} className="bg-yellow-500 text-blue-950 px-3 py-2 rounded-lg font-black uppercase text-[9px] shadow-sm hover:bg-yellow-600 transition-all flex items-center justify-center gap-1.5 border-b-2 border-yellow-700"><Calculator size={12}/> Cota</button>
            </div>
        </div>

        <div className="bg-blue-50 px-4 py-3 border-b border-blue-100 shrink-0">
            <div className="flex flex-col lg:flex-row items-start lg:items-center gap-4">
                <div className="flex items-center gap-2">
                    <Lightbulb size={18} className="text-yellow-600" />
                    <span className="text-xs font-black uppercase text-blue-900">Sugestão (OTB):</span>
                </div>
                <div className="grid grid-cols-2 lg:flex items-center gap-3 w-full lg:w-auto">
                    <div className="flex items-center gap-2">
                        <span className="text-[9px] font-bold text-gray-500 uppercase">Inicio:</span>
                        <select value={simStartMonth} onChange={e => setSimStartMonth(e.target.value)} className="bg-white border rounded px-2 py-1 text-[9px] font-black uppercase outline-none flex-1 lg:w-auto">
                            {timeline.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
                        </select>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-[9px] font-bold text-gray-500 uppercase">Vezes:</span>
                        <input type="number" value={simInstallments} onChange={e => setSimInstallments(Math.max(1, parseInt(e.target.value)))} className="w-12 bg-white border rounded px-2 py-1 text-[9px] font-black text-center" />
                    </div>
                </div>

                <div className="w-full lg:w-auto lg:ml-4 flex flex-col lg:flex-row items-start lg:items-center gap-2 bg-white px-3 py-2 rounded-lg border border-blue-100 shadow-sm ml-auto">
                    <div className="flex justify-between w-full lg:w-auto gap-4">
                        <span className="text-[9px] font-bold text-gray-400 uppercase">Pode comprar hoje:</span>
                        <span className="text-sm font-black text-green-600">{formatCurrency(simulationResult.maxPurchase)}</span>
                    </div>
                    {simulationResult.limitingMonth && <span className="text-[8px] text-red-400 font-bold uppercase">(Travado em: {simulationResult.limitingMonth})</span>}
                </div>
            </div>
        </div>

        <div className="hidden lg:block flex-1 overflow-auto bg-white border-t border-gray-100 no-scrollbar">
            <table className="w-full text-center border-separate border-spacing-0 table-fixed min-w-[1500px]">
                <thead className="sticky top-0 z-40">
                    <tr className="bg-blue-900 text-white text-[8px] font-black uppercase h-8">
                        <th className="p-1 w-[160px] text-left sticky left-0 bg-blue-900 z-50">Marca / Identificação</th>
                        <th className="p-1 w-[170px] border-l border-white/10 sticky left-[160px] bg-blue-900 z-50">Resumo</th>
                        {timeline.map(m => <th key={m.key} className="p-1 w-20 border-l border-white/10">{m.label}</th>)}
                    </tr>
                </thead>
                <tbody className="text-[10px] font-bold uppercase">
                    <tr className="bg-gray-100 border-b h-7">
                        <td className="px-2 text-left sticky left-0 bg-gray-100 z-30 font-black text-gray-500 text-[9px]">META GLOBAL</td>
                        <td className="font-black italic text-gray-500 sticky left-[160px] bg-gray-100 z-30 text-[9px]">{formatCurrency(Number(storeSettings?.budgetValue || 0))}</td>
                        {timeline.map(m => <td key={m.key} className="p-1 text-gray-300">-</td>)}
                    </tr>
                    <tr className="bg-red-50 border-b h-7">
                        <td className="px-2 text-left sticky left-0 bg-red-50 z-30 font-black text-red-600 text-[9px]">GASTOS FIXOS (DIVIDAS)</td>
                        <td className="font-black italic text-red-600 sticky left-[160px] bg-red-50 z-30 text-[9px]">{formatCurrency(consolidated.totalDebtsGlobal)}</td>
                        {timeline.map(m => ( <td key={m.key} className="p-1 font-black text-red-600 text-[9px]">{formatCurrency(consolidated.stats[m.key].debts)}</td> ))}
                    </tr>
                    <tr className="bg-orange-50 border-b h-8 border-t-2 border-orange-200">
                        <td className="px-2 text-left sticky left-0 bg-orange-50 z-30"><div className="font-black text-orange-700 text-[9px]">COTA GERENTE</div><div className="text-[7px] text-orange-400 font-bold">{storeSettings?.managerPercent || 0}% da Meta Bruta</div></td>
                        <td className="font-black italic text-orange-700 sticky left-[160px] bg-orange-50 z-30 text-[9px] text-right pr-2">SALDO:</td>
                        {timeline.map(m => ( <td key={m.key} className={`p-1 font-black text-[10px] ${consolidated.stats[m.key].balanceManager < 0 ? 'text-red-600' : 'text-orange-700'}`}>{formatCurrency(consolidated.stats[m.key].balanceManager)}</td> ))}
                    </tr>
                    <tr className="bg-blue-50 border-b h-8 border-t-2 border-blue-200">
                        <td className="px-2 text-left sticky left-0 bg-blue-50 z-30"><div className="font-black text-blue-800 text-[9px]">COTA COMPRADOR</div><div className="text-[7px] text-blue-400 font-bold">Sobra Líquida</div></td>
                        <td className="font-black italic text-blue-800 sticky left-[160px] bg-blue-50 z-30 text-[9px] text-right pr-2">SALDO:</td>
                        {timeline.map(m => ( <td key={m.key} className={`p-1 font-black text-[10px] ${consolidated.stats[m.key].balanceBuyer < 0 ? 'text-red-600 animate-pulse' : 'text-blue-800'}`}>{formatCurrency(consolidated.stats[m.key].balanceBuyer)}</td> ))}
                    </tr>
                    {consolidated.orders.filter(o => o.status === 'ABERTA' || o.status === 'pending').map(order => {
                        const isManagerOrder = String(order.createdByRole).toUpperCase() === 'GERENTE';
                        return (
                            <tr key={order.id} className="hover:bg-blue-50/50 transition-colors border-b group h-10">
                                <td className="px-2 text-left sticky left-0 bg-white group-hover:bg-blue-50/50 z-30 shadow-sm overflow-hidden"><div className="flex items-center gap-1.5"><div className={`w-2 h-2 rounded-full shrink-0 ${isManagerOrder ? 'bg-orange-500' : 'bg-blue-600'} shadow-sm`}></div><div className="flex-1 min-w-0"><div className={`text-[9px] font-black uppercase italic leading-none mb-0.5 truncate ${isManagerOrder ? 'text-orange-700' : 'text-blue-800'}`}>{order.brand}</div><div className="text-[7px] text-gray-900 font-bold uppercase leading-none truncate">{order.category_name || 'GERAL'} | {order.pairs || 0} PR</div></div><div className="flex items-center gap-1 ml-auto opacity-0 group-hover:opacity-100 transition-opacity"><button onClick={() => onUpdateCota(order.id, { status: 'VALIDADO' })} className="text-green-500 hover:scale-110"><CheckCircle size={12}/></button><button onClick={() => onDeleteCota(order.id)} className="text-red-300 hover:text-red-600 hover:scale-110"><Trash2 size={12}/></button></div></div></td>
                                <td className="bg-white sticky left-[160px] z-30 group-hover:bg-blue-50/50 shadow-sm text-center"><div className={`text-[9px] font-black italic ${isManagerOrder ? 'text-orange-700' : 'text-gray-900'}`}>{formatCurrency(order.totalValue)}</div></td>
                                {timeline.map(m => {
                                    const val = getInstallmentValueForMonth(order, m.key);
                                    return ( <td key={m.key} className={`p-0.5 border-r border-gray-50 font-black text-[9px] ${val > 0 ? (isManagerOrder ? 'text-orange-600 bg-orange-50/30' : 'text-blue-600') : 'text-gray-100'}`}>{val > 0 ? formatCurrency(val) : ''}</td> );
                                })}
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>

        {activeForm === 'mix_view' && (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[100] p-4">
                <div className="bg-[#f8fafc] rounded-[24px] w-full max-w-6xl shadow-2xl overflow-hidden border-t-4 border-purple-600 max-h-[90vh] flex flex-col">
                    <div className="p-3 border-b bg-white flex justify-between items-center shrink-0">
                        <h3 className="text-sm font-black uppercase italic text-blue-950 flex items-center gap-2"><Activity className="text-purple-600" size={16} /> Dashboard <span className="text-purple-600">Mix OTB</span></h3>
                        <button onClick={() => setActiveForm(null)} className="p-1.5 bg-gray-100 text-gray-400 hover:text-red-600 rounded-lg transition-all"><X size={16}/></button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar">
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                            {mixHierarchyData.map(seg => {
                                const styles = getTrafficLightStyle(seg.utilizationOfQuota, seg.utilizedValue > 0);
                                return (
                                <div key={seg.segment} className="p-3 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between bg-white">
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="p-1.5 rounded-lg bg-gray-50 text-gray-600">{getCategoryIcon(seg.segment)}</div>
                                        <div className="text-right">
                                            <p className="text-[7px] font-black text-gray-400 uppercase tracking-widest leading-none mb-0.5">Meta</p>
                                            <span className="text-sm font-black italic tracking-tighter text-blue-900">{(seg.metaPercent || 0).toFixed(1)}%</span>
                                        </div>
                                    </div>
                                    <div>
                                        <h4 className="text-[10px] font-black text-blue-950 uppercase italic tracking-tighter mb-1">{seg.segment}</h4>
                                        <div className="space-y-1">
                                            <div className="flex justify-between items-end"><span className="text-[7px] font-black text-gray-400 uppercase">{formatCurrency(seg.utilizedValue)}</span><span className={`text-[8px] font-black italic ${styles.text}`}>{(seg.utilizationOfQuota || 0).toFixed(1)}% Usado</span></div>
                                            <div className="w-full bg-gray-100 rounded-full h-1 overflow-hidden"><div className={`h-full rounded-full transition-all duration-1000 ${styles.bar}`} style={{width: `${Math.min(seg.utilizationOfQuota || 0, 100)}%`}} /></div>
                                        </div>
                                    </div>
                                </div>
                            )})}
                        </div>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};
