
import React, { useState, useMemo, useEffect } from 'react';
import { Store, User, Cota, UserRole, CotaSettings, CotaDebts, MonthlyPerformance, QuotaCategory, QuotaMixParameter } from '../types';
import { formatCurrency, BRAND_LOGO } from '../constants';
import { 
    Plus, Trash2, Building2, Loader2, DollarSign, Calculator, X, Save, 
    History, CheckCircle, BadgeCheck, FileBarChart, Printer, Check,
    LayoutGrid, UserCheck, Briefcase, Layers, TrendingDown, Info, Calendar,
    AlertTriangle, ArrowUpRight, ArrowDownRight, Target, PieChart, ChevronRight, Settings,
    Activity, ArrowRight
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

const generateTimeline = (): { label: string, key: string }[] => {
    const months: { label: string, key: string }[] = [];
    const targetYear = 2026; 
    for (let i = 0; i < 12; i++) {
        const label = `${SHORT_MONTHS_DISPLAY[i]}-26`;
        const key = `${targetYear}-${String(i + 1).padStart(2, '0')}`;
        months.push({ label, key });
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
  onUpdateMixParameter?: (id: string | null, category: string, percent: number) => Promise<void>;
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

  // Form states
  const [brand, setBrand] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [shipmentMonth, setShipmentMonth] = useState(timeline[0].key);
  const [paymentTerms, setPaymentTerms] = useState('30/60/90');
  const [totalValue, setTotalValue] = useState('');
  const [pairs, setPairs] = useState('');
  const [selectedStoresForOrder, setSelectedStoresForOrder] = useState<string[]>([]);
  const [orderCreatedByRole, setOrderCreatedByRole] = useState<'COMPRADOR' | 'GERENTE'>('COMPRADOR');

  // Multi-month Expense Form States
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

  // Cota Settings States
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

    let totalBuyerValidGlobal = 0;
    let totalManagerValidGlobal = 0;
    let totalDebtsGlobal = 0;

    timeline.forEach(m => {
        const budgetTotal = Number(settings?.budgetValue || 0);
        const monthlyDebts = storeDebts.filter(d => d.month === m.key).reduce((a, b) => a + Number(b.value), 0);
        totalDebtsGlobal += monthlyDebts;

        let buyerValid = 0;
        let managerValid = 0;
        let pendingInstallmentSum = 0;

        storeOrders.forEach(p => { 
            const val = getInstallmentValueForMonth(p, m.key);
            const role = String(p.createdByRole || '').toUpperCase();
            if (p.status === 'VALIDADO' || p.status === 'validated' || p.status === 'FECHADA') {
                if (role === 'GERENTE') { managerValid += val; totalManagerValidGlobal += val; }
                else { buyerValid += val; totalBuyerValidGlobal += val; }
            } else if (p.status === 'ABERTA' || p.status === 'pending') {
                pendingInstallmentSum += val;
            }
        });

        const totalComprado = buyerValid + managerValid + pendingInstallmentSum;

        stats[m.key] = { 
            available: budgetTotal - monthlyDebts - totalComprado,
            debts: monthlyDebts, 
            buyerValid, 
            managerValid, 
            totalComprado,
            pendingInstallmentSum 
        };
    });
    return { orders: storeOrders, stats, debts: storeDebts, totalBuyerValidGlobal, totalManagerValidGlobal, totalDebtsGlobal };
  }, [cotas, cotaSettings, cotaDebts, viewStoreId, timeline]);

  const handleSaveOrder = async (e: React.FormEvent) => {
      e.preventDefault();
      const val = parseFloat((totalValue as string).replace(',', '.'));
      if (!brand || !selectedCategoryId || isNaN(val) || selectedStoresForOrder.length === 0) return;
      
      setIsSubmitting(true);
      try {
          const installmentsMap = calculateInstallmentsMap(shipmentMonth, paymentTerms, val);
          const category = productCategories.find(c => c.id === selectedCategoryId);
          for (const storeId of selectedStoresForOrder) {
              await onAddCota({
                  id: `tmp-${Date.now()}`,
                  storeId,
                  brand: brand.toUpperCase().trim(),
                  category_id: selectedCategoryId,
                  category_name: category?.category_name || 'GERAL',
                  totalValue: val,
                  shipmentDate: shipmentMonth, 
                  paymentTerms: paymentTerms.trim(),
                  pairs: parseInt(pairs) || 0,
                  installments: installmentsMap,
                  createdByRole: orderCreatedByRole, 
                  status: 'ABERTA',
                  createdAt: new Date()
              });
          }
          setBrand(''); setTotalValue(''); setPairs(''); setActiveForm(null);
          alert("Pedido(s) registrado(s) com sucesso!");
      } catch (err: any) {
          alert("Erro: " + err.message);
      } finally { setIsSubmitting(false); }
  };

  const handleSaveAllExpenses = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
        for (const [month, valueStr] of Object.entries(semesterDebts)) {
            const val = parseFloat((valueStr as string).replace(',', '.'));
            if (!isNaN(val)) {
                await onSaveDebts({ storeId: viewStoreId, month: month, value: val });
            }
        }
        setActiveForm(null);
        alert("Despesas atualizadas com sucesso!");
    } catch (e) {
        alert("Erro ao salvar despesas.");
    } finally {
        setIsSubmitting(false);
    }
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

  const handlePrintValidated = () => {
    const printWindow = window.open('', '_blank', 'width=1000,height=1200');
    if (!printWindow) return;
    const store = stores.find(s => s.id === viewStoreId);
    
    const grouped: Record<string, Cota[]> = {};
    consolidated.orders.filter(o => o.status === 'VALIDADO' || o.status === 'validated' || o.status === 'FECHADA').forEach(o => {
        if (!grouped[o.shipmentDate]) grouped[o.shipmentDate] = [];
        grouped[o.shipmentDate].push(o);
    });

    const rows = Object.entries(grouped).map(([date, items]) => {
        const monthLabel = getMonthNameFromKey(date);
        return `
            <div style="margin-bottom: 25px;">
                <h3 style="background:#1e3a8a; color:white; padding:8px 12px; font-size:12px; font-weight:900; text-transform:uppercase; border-radius:4px;">EMBARQUE: ${monthLabel}</h3>
                <table style="width:100%; border-collapse: collapse; font-size:11px; margin-top:10px;">
                    <thead>
                        <tr style="border-bottom: 2px solid #000; text-align:left; background:#f4f4f4;">
                            <th style="padding:8px;">MARCA</th>
                            <th style="padding:8px;">CLASSIFICAÇÃO</th>
                            <th style="padding:8px; text-align:center;">QTD</th>
                            <th style="padding:8px; text-align:right;">VALOR TOTAL</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${items.map(i => `
                            <tr style="border-bottom: 1px solid #eee;">
                                <td style="padding:8px;"><b>${i.brand}</b></td>
                                <td style="padding:8px;">${i.category_name || i.classification}</td>
                                <td style="padding:8px; text-align:center;">${i.pairs}</td>
                                <td style="padding:8px; text-align:right; font-weight:bold;">${formatCurrency(i.totalValue)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }).join('');

    const html = `<html><head><style>body { font-family: sans-serif; padding: 30px; } h1 { color: #1e3a8a; }</style></head><body>
        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:4px solid #1e3a8a; padding-bottom:15px; margin-bottom:20px;">
            <div>
                <h1 style="margin:0; font-size:24px; font-weight:900; font-style:italic;">PEDIDOS <span style="color:#dc2626;">VALIDADOS</span></h1>
                <p style="margin:5px 0 0; font-size:11px; font-weight:bold; color:#666;">UNIDADE ${store?.number} - ${store?.city}</p>
            </div>
            <div style="text-align:right; font-size:10px; font-weight:bold; color:#999;">EMISSÃO: ${new Date().toLocaleString('pt-BR')}</div>
        </div>
        ${rows}
        <div style="margin-top:40px; border-top:1px solid #000; padding-top:10px; text-align:center; font-size:10px; font-weight:bold;">REAL ADMIN - ENGENHARIA DE COMPRAS</div>
        <script>window.onload = function() { window.print(); setTimeout(window.close, 1000); }</script>
    </body></html>`;
    printWindow.document.write(html);
    printWindow.document.close();
  };

  const groupedCategories = useMemo(() => {
      const groups: Record<string, QuotaCategory[]> = {};
      (productCategories || []).forEach(c => {
          if (!groups[c.parent_category]) groups[c.parent_category] = [];
          groups[c.parent_category].push(c);
      });
      return groups;
  }, [productCategories]);

  // Dados consolidados do Mix para o Modal Hierárquico - CORREÇÃO DA SOMA DE PEDIDOS
  const mixHierarchyData = useMemo(() => {
      const budget = Number(storeSettings?.budgetValue || 0);
      const segments = ['FEMININO', 'MASCULINO', 'INFANTIL', 'ACESSÓRIO'];
      
      return segments.map(segName => {
          const subCats = (productCategories || []).filter(c => c.parent_category === segName);
          let segMetaPercentTotal = 0;
          let segUtilizedValueTotal = 0;

          const details = subCats.map(cat => {
              const param = mixParameters.find(m => m.category_name === cat.category_name);
              const metaPercent = param?.percentage || 0;
              
              // FIX: Busca precisa de pedidos cadastrados para esta categoria na loja atual
              const utilizedValue = cotas
                .filter(o => o.storeId === viewStoreId && (o.category_id === cat.id || o.category_name === cat.category_name || o.classification === cat.category_name))
                .reduce((acc, curr) => acc + Number(curr.totalValue || 0), 0);
              
              segMetaPercentTotal += metaPercent;
              segUtilizedValueTotal += utilizedValue;

              return {
                  id: cat.id,
                  category_name: cat.category_name,
                  metaPercent,
                  utilizedValue,
                  utilizedPercent: budget > 0 ? (utilizedValue / budget) * 100 : 0
              };
          });

          return {
              segment: segName,
              metaPercent: segMetaPercentTotal,
              utilizedValue: segUtilizedValueTotal,
              utilizedPercent: budget > 0 ? (segUtilizedValueTotal / budget) * 100 : 0,
              subcategories: details
          };
      });
  }, [productCategories, mixParameters, cotas, viewStoreId, storeSettings]);

  const handleUpdateMix = async (category: string, value: string) => {
      if (!onUpdateMixParameter) return;
      const percent = parseFloat(value.replace(',', '.')) || 0;
      const existing = mixParameters.find(p => p.category_name === category);
      await onUpdateMixParameter(existing?.id || null, category, percent);
  };

  return (
    <div className="flex flex-col h-screen bg-[#f3f4f6] overflow-hidden text-blue-950 font-sans">
        {/* TOP BAR */}
        <div className="bg-white px-8 py-4 flex flex-col md:flex-row justify-between items-center gap-4 z-50 shadow-sm border-b shrink-0">
            <div className="flex items-center gap-3">
                <div className="bg-blue-900 text-white p-2.5 rounded-xl shadow-lg shrink-0"><Building2 size={24}/></div>
                <div>
                    <h1 className="text-xl font-black uppercase italic leading-none tracking-tight text-blue-900">Engenharia <span className="text-blue-800 font-black">de Compras</span></h1>
                    <div className="flex items-center gap-2 mt-1">
                        {isAdmin ? (
                            <select value={viewStoreId} onChange={e => setManualStoreId(e.target.value)} className="bg-white border border-gray-200 rounded-lg px-2 py-0.5 text-[10px] font-black uppercase text-blue-900 outline-none shadow-sm">
                                {activeStores.map(s => <option key={s.id} value={s.id}>Loja {s.number} - {s.city}</option>)}
                            </select>
                        ) : (
                            <span className="text-[10px] font-black text-blue-800 uppercase tracking-widest">Loja {stores.find(s => s.id === viewStoreId)?.number}</span>
                        )}
                    </div>
                </div>
            </div>
            
            <div className="flex flex-wrap gap-2">
                <button onClick={() => { setSelectedStoresForOrder([viewStoreId]); setActiveForm('order'); }} className="bg-blue-900 text-white px-5 py-2.5 rounded-lg font-black uppercase text-[10px] shadow-md hover:bg-black transition-all flex items-center gap-2 border-b-4 border-blue-950"><Plus size={14}/> Novo Pedido</button>
                <button onClick={() => setActiveForm('validated_orders')} className="bg-green-600 text-white px-5 py-2.5 rounded-lg font-black uppercase text-[10px] shadow-md hover:bg-green-700 transition-all flex items-center gap-2 border-b-4 border-green-800"><BadgeCheck size={14}/> Pedidos Validados</button>
                <button onClick={() => setActiveForm('mix_view')} className="bg-purple-600 text-white px-5 py-2.5 rounded-lg font-black uppercase text-[10px] shadow-md hover:bg-purple-700 transition-all flex items-center gap-2 border-b-4 border-purple-800"><FileBarChart size={14}/> Parâmetros Mix</button>
                <button onClick={() => setActiveForm('expense')} className="bg-orange-600 text-white px-5 py-2.5 rounded-lg font-black uppercase text-[10px] shadow-md hover:bg-orange-700 transition-all flex items-center gap-2 border-b-4 border-orange-800"><DollarSign size={14}/> Lançar Despesa</button>
                <button onClick={() => setActiveForm('cota_config')} className="bg-yellow-500 text-blue-950 px-5 py-2.5 rounded-lg font-black uppercase text-[10px] shadow-md hover:bg-yellow-600 transition-all flex items-center gap-2 border-b-4 border-yellow-700"><Calculator size={14}/> Definir Cota</button>
            </div>
        </div>

        {/* TIMELINE TABLE */}
        <div className="flex-1 overflow-auto bg-white border-t border-gray-100">
            <table className="w-full text-center border-separate border-spacing-0 table-fixed min-w-[1800px]">
                <thead className="sticky top-0 z-40">
                    <tr className="bg-blue-900 text-white text-[10px] font-black uppercase h-12">
                        <th className="p-2 w-[224px] text-left sticky left-0 bg-blue-900 z-50">Marca / Identificação</th>
                        <th className="p-2 w-32 border-l border-white/10 sticky left-[224px] bg-blue-900 z-50">Resumo</th>
                        {timeline.map(m => <th key={m.key} className="p-2 w-32 border-l border-white/10">{m.label}</th>)}
                    </tr>
                </thead>
                <tbody className="text-[11px] font-bold uppercase">
                    <tr className="bg-yellow-400 border-b border-yellow-500 h-12">
                        <td className="px-4 py-2 text-left sticky left-0 bg-yellow-400 z-30 font-black text-blue-900 shadow-sm">SALDO COTA ATUAL</td>
                        <td className="font-black italic text-blue-900 sticky left-[224px] bg-yellow-400 z-30">LÍQUIDO</td>
                        {timeline.map(m => (
                            <td key={m.key} className={`p-2 font-black ${consolidated.stats[m.key].available < 0 ? 'text-red-600 animate-pulse' : 'text-blue-900'}`}>
                                {formatCurrency(consolidated.stats[m.key].available)}
                            </td>
                        ))}
                    </tr>

                    <tr className="bg-gray-50/50 border-b h-11">
                        <td className="px-4 text-left sticky left-0 bg-[#f9fafb] z-30 font-black text-red-600">GASTOS FIXOS / DEBTS</td>
                        <td className="font-black italic text-red-600 sticky left-[224px] bg-[#f9fafb] z-30">{formatCurrency(consolidated.totalDebtsGlobal)}</td>
                        {timeline.map(m => (
                            <td key={m.key} className="p-2 font-black text-red-600">
                                {formatCurrency(consolidated.stats[m.key].debts)}
                            </td>
                        ))}
                    </tr>

                    <tr className="bg-white border-b h-11">
                        <td className="px-4 text-left sticky left-0 bg-white z-30 font-black text-blue-800">COTA COMPRADOR ({100 - (storeSettings?.managerPercent || 20)}%)</td>
                        <td className="font-black italic text-blue-800 sticky left-[224px] bg-white z-30">{formatCurrency(consolidated.totalBuyerValidGlobal)}</td>
                        {timeline.map(m => (
                            <td key={m.key} className="p-2 font-black text-blue-800">
                                {formatCurrency(consolidated.stats[m.key].buyerValid)}
                            </td>
                        ))}
                    </tr>

                    <tr className="bg-orange-50/20 border-b h-11">
                        <td className="px-4 text-left sticky left-0 bg-[#fefce8] z-30 font-black text-orange-700">COTA GERENTE ({storeSettings?.managerPercent || 20}%)</td>
                        <td className="font-black italic text-orange-700 sticky left-[224px] bg-[#fefce8] z-30">{formatCurrency(consolidated.totalManagerValidGlobal)}</td>
                        {timeline.map(m => (
                            <td key={m.key} className="p-2 font-black text-orange-700">
                                {formatCurrency(consolidated.stats[m.key].managerValid)}
                            </td>
                        ))}
                    </tr>

                    <tr className="bg-gray-100 border-b border-gray-200 h-10">
                        <td className="px-4 text-left sticky left-0 bg-gray-100 z-30 font-black text-gray-500 italic text-[9px] tracking-widest">
                            AGUARDANDO VALIDAÇÃO
                        </td>
                        <td className="bg-gray-100 font-black text-[9px] text-gray-400 sticky left-[224px] z-30">PENDENTE</td>
                        {timeline.map(m => (
                            <td key={m.key} className="p-2 font-black text-gray-400 italic">
                                {consolidated.stats[m.key].pendingInstallmentSum > 0 ? formatCurrency(consolidated.stats[m.key].pendingInstallmentSum) : '-'}
                            </td>
                        ))}
                    </tr>

                    {consolidated.orders.filter(o => o.status === 'ABERTA' || o.status === 'pending').map(order => {
                        const role = String(order.createdByRole || '').toUpperCase();
                        const isManagerOrder = role === 'GERENTE';
                        const isAcessorio = (order.classification || order.category_name)?.toUpperCase().includes('ACESSÓRIO');
                        const qtyType = isAcessorio ? 'UNIDADES' : 'PARES';

                        return (
                            <tr key={order.id} className="hover:bg-blue-50/50 transition-colors border-b group h-16">
                                <td className="px-4 text-left sticky left-0 bg-white group-hover:bg-blue-50/50 z-30 shadow-sm">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-3 h-3 rounded-full shrink-0 ${isManagerOrder ? 'bg-orange-500 shadow-orange-200' : 'bg-blue-600 shadow-blue-200'} shadow-md`}></div>
                                        <div className="flex-1 min-w-0">
                                            <div className={`text-sm font-black uppercase italic leading-none mb-1 truncate ${isManagerOrder ? 'text-orange-700' : 'text-blue-800'}`}>{order.brand}</div>
                                            <div className="text-[9px] text-gray-900 font-bold uppercase leading-none mb-0.5">
                                                {order.classification || order.category_name || 'GERAL'}
                                            </div>
                                            <div className="text-[8px] font-bold text-gray-400 uppercase italic">
                                                | {order.pairs || 0} {qtyType}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1 ml-auto opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => onUpdateCota(order.id, { status: 'VALIDADO' })} className="text-green-500 hover:scale-110" title="Validar Pedido"><CheckCircle size={18}/></button>
                                            <button onClick={() => onDeleteCota(order.id)} className="text-red-300 hover:text-red-600 hover:scale-110" title="Excluir"><Trash2 size={18}/></button>
                                        </div>
                                    </div>
                                </td>
                                <td className="bg-white sticky left-[224px] z-30 group-hover:bg-blue-50/50 shadow-sm">
                                    <div className="flex flex-col items-center justify-center h-full">
                                        <div className="text-[9px] font-black text-blue-600 uppercase tracking-tighter mb-0.5">EMB: {getMonthNameFromKey(order.shipmentDate)}</div>
                                        <div className="text-[10px] font-black text-gray-900 italic">{formatCurrency(order.totalValue)}</div>
                                    </div>
                                </td>
                                {timeline.map(m => {
                                    const val = getInstallmentValueForMonth(order, m.key);
                                    return <td key={m.key} className={`p-2 border-r border-gray-50 font-black text-[10px] ${val > 0 ? (isManagerOrder ? 'text-orange-600' : 'text-blue-600') : 'text-gray-100'}`}>{val > 0 ? formatCurrency(val) : ''}</td>;
                                })}
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>

        {/* MODAL: MIX DE PRODUTOS - PAINEL HIERÁRQUICO SOLICITADO */}
        {activeForm === 'mix_view' && (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[100] p-4">
                <div className="bg-[#f8fafc] rounded-[48px] w-full max-w-7xl shadow-2xl animate-in zoom-in duration-300 overflow-hidden border-t-8 border-purple-600 max-h-[95vh] flex flex-col">
                    
                    {/* Header do Modal */}
                    <div className="p-8 border-b bg-white flex justify-between items-center shrink-0">
                        <div>
                            <h3 className="text-2xl font-black uppercase italic text-blue-950 flex items-center gap-3">
                                <Activity className="text-purple-600" /> Dashboard <span className="text-purple-600">de Mix Proporcional</span>
                            </h3>
                            <p className="text-gray-400 text-[10px] font-black uppercase tracking-widest mt-1">Definição estratégica de metas por segmento e atingimento real (Pedidos do Banco)</p>
                        </div>
                        <div className="flex items-center gap-2">
                             {isAdmin && (
                                <button onClick={() => setIsEditingMix(!isEditingMix)} className={`p-4 rounded-2xl transition-all shadow-md ${isEditingMix ? 'bg-purple-600 text-white' : 'bg-white text-purple-600 border border-purple-100 hover:bg-purple-50'}`}>
                                    {isEditingMix ? <Save size={24} /> : <Settings size={24} />}
                                </button>
                             )}
                             <button onClick={() => { setActiveForm(null); setIsEditingMix(false); }} className="p-4 bg-gray-100 text-gray-400 hover:text-red-600 rounded-2xl transition-all"><X size={24}/></button>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-8 space-y-12 no-scrollbar">
                        
                        {/* PAINEL SUPERIOR: SEGMENTOS PRINCIPAIS (AGREGADO) */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                            {mixHierarchyData.map(seg => (
                                <div key={seg.segment} className="bg-white p-6 rounded-[36px] shadow-sm border border-gray-100 flex flex-col justify-between group hover:border-purple-300 transition-all">
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="p-3 bg-purple-50 text-purple-600 rounded-2xl group-hover:scale-110 transition-transform"><Layers size={20}/></div>
                                        <div className="text-right">
                                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">Meta Segmento</p>
                                            <span className="text-xl font-black text-purple-600 italic tracking-tighter">{seg.metaPercent.toFixed(1)}%</span>
                                        </div>
                                    </div>
                                    <div>
                                        <h4 className="text-sm font-black text-blue-950 uppercase italic tracking-tighter mb-3">{seg.segment}</h4>
                                        <div className="space-y-1.5">
                                            <div className="flex justify-between items-end">
                                                <span className="text-[9px] font-black text-gray-400 uppercase">Utilizado: {formatCurrency(seg.utilizedValue)}</span>
                                                <span className={`text-[10px] font-black italic ${seg.utilizedPercent > seg.metaPercent ? 'text-red-600' : 'text-green-600'}`}>{seg.utilizedPercent.toFixed(1)}%</span>
                                            </div>
                                            <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden shadow-inner">
                                                <div 
                                                    className={`h-full rounded-full transition-all duration-1000 ${seg.utilizedPercent > seg.metaPercent ? 'bg-red-500' : 'bg-purple-600'}`} 
                                                    style={{width: `${Math.min((seg.utilizedPercent / Math.max(seg.metaPercent, 1)) * 100, 100)}%`}}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* PAINEL INFERIOR: DETALHAMENTO DE SUB-CATEGORIAS */}
                        <div className="space-y-10">
                            <h3 className="text-xs font-black text-gray-400 uppercase tracking-[0.3em] flex items-center gap-3 ml-4">
                                <Plus size={14} className="text-purple-600"/> Detalhamento das Metas de Mix (Categorias Individuais)
                            </h3>
                            
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                {mixHierarchyData.map(seg => (
                                    <div key={seg.segment} className="bg-white rounded-[40px] shadow-lg border border-gray-100 overflow-hidden flex flex-col">
                                        <div className="p-6 bg-gray-950 text-white flex justify-between items-center">
                                            <h4 className="font-black uppercase italic tracking-widest text-xs flex items-center gap-3">
                                                <div className="w-1 h-6 bg-purple-500 rounded-full"></div>
                                                {seg.segment} <span className="text-[9px] not-italic text-gray-500 font-bold ml-2">({seg.subcategories.length} CATEGORIAS)</span>
                                            </h4>
                                            <span className="text-[10px] font-black text-purple-400 uppercase tracking-widest">Soma Meta: {seg.metaPercent.toFixed(1)}%</span>
                                        </div>
                                        <div className="p-6 space-y-3">
                                            {seg.subcategories.map(sub => (
                                                <div key={sub.id} className="flex items-center gap-4 p-4 bg-gray-50 rounded-2xl border border-transparent hover:border-purple-100 group transition-all">
                                                    <div className="flex-1">
                                                        <p className="text-[10px] font-black text-blue-950 uppercase italic leading-none mb-1">{sub.category_name}</p>
                                                        <p className="text-[8px] font-bold text-gray-400 uppercase tracking-widest">Atingimento: {formatCurrency(sub.utilizedValue)}</p>
                                                    </div>
                                                    <div className="flex items-center gap-6">
                                                        <div className="text-right">
                                                            <p className="text-[8px] font-black text-gray-400 uppercase leading-none mb-1">Atingido</p>
                                                            <span className="text-xs font-black text-blue-900 italic">{sub.utilizedPercent.toFixed(1)}%</span>
                                                        </div>
                                                        <div className="w-px h-6 bg-gray-200"></div>
                                                        <div className="w-24">
                                                            <p className="text-[8px] font-black text-purple-600 uppercase leading-none mb-1">Meta Mix</p>
                                                            {isEditingMix ? (
                                                                <div className="flex items-center gap-1">
                                                                    <input 
                                                                        type="text" 
                                                                        defaultValue={sub.metaPercent}
                                                                        key={`${sub.id}-${sub.metaPercent}`}
                                                                        onBlur={(e) => handleUpdateMix(sub.category_name, e.target.value)}
                                                                        className="w-full p-1.5 bg-white border border-purple-200 rounded-lg text-center text-xs font-black text-purple-600 outline-none focus:ring-4 focus:ring-purple-50"
                                                                    />
                                                                    <span className="text-[9px] font-black text-purple-300">%</span>
                                                                </div>
                                                            ) : (
                                                                <span className="text-sm font-black text-purple-600 italic">{sub.metaPercent.toFixed(1)}%</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {isEditingMix && (
                        <div className="p-6 bg-purple-600 text-white flex items-center justify-center gap-4 animate-in slide-in-from-bottom duration-300">
                            <AlertTriangle size={24} />
                            <p className="text-[11px] font-black uppercase tracking-widest text-center leading-relaxed">
                                Modo de Configuração Ativo: A meta do Segmento superior será atualizada automaticamente ao salvar as subcategorias.
                                <br/><span className="text-[9px] opacity-70 italic font-bold">Os dados são persistidos no banco de dados corporativo.</span>
                            </p>
                        </div>
                    )}
                </div>
            </div>
        )}

        {/* RESTANTE DOS MODAIS (Order, Expense, Config, Validated) - MANTIDOS */}
        {activeForm === 'order' && (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[100] p-4">
                <div className="bg-white rounded-[40px] w-full max-w-2xl shadow-2xl animate-in zoom-in duration-300 overflow-hidden border-t-8 border-blue-900">
                    <div className="p-8 border-b bg-gray-50/50 flex justify-between items-center">
                        <h3 className="text-2xl font-black uppercase italic text-blue-950 flex items-center gap-3"><Plus className="text-red-600" /> Registrar <span className="text-red-600">Novo Pedido</span></h3>
                        <button onClick={() => setActiveForm(null)} className="text-gray-400 hover:text-red-600"><X size={24}/></button>
                    </div>
                    <form onSubmit={handleSaveOrder} className="p-10 space-y-6">
                        <div className="grid grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-gray-400 uppercase ml-2">Marca / Fabricante</label>
                                <input required value={brand} onChange={e => setBrand(e.target.value)} className="w-full p-4 bg-gray-50 rounded-2xl font-black text-gray-900 uppercase italic shadow-inner outline-none focus:ring-4 focus:ring-blue-50" placeholder="EX: BEIRA RIO" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-gray-400 uppercase ml-2">Classificação</label>
                                <select required value={selectedCategoryId} onChange={e => setSelectedCategoryId(e.target.value)} className="w-full p-4 bg-gray-50 rounded-2xl font-black text-gray-900 uppercase outline-none cursor-pointer">
                                    <option value="">SELECIONE...</option>
                                    {(Object.entries(groupedCategories) as [string, QuotaCategory[]][]).map(([parent, cats]) => (
                                        <optgroup key={parent} label={parent}>
                                            {cats.map(c => <option key={c.id} value={c.id}>{c.category_name}</option>)}
                                        </optgroup>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="grid grid-cols-3 gap-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-gray-400 uppercase ml-2">Mês Embarque</label>
                                <select value={shipmentMonth} onChange={e => setShipmentMonth(e.target.value)} className="w-full p-4 bg-gray-50 rounded-2xl font-black text-gray-900 outline-none">
                                    {timeline.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-gray-400 uppercase ml-2">Prazos (ex: 30/60/90)</label>
                                <input required value={paymentTerms} onChange={e => setPaymentTerms(e.target.value)} className="w-full p-4 bg-gray-50 rounded-2xl font-black text-gray-900 text-center outline-none" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-gray-400 uppercase ml-2">Total Pedido (R$)</label>
                                <input required value={totalValue} onChange={e => setTotalValue(e.target.value)} className="w-full p-4 bg-blue-50/50 rounded-2xl font-black text-blue-900 text-xl text-center shadow-inner outline-none focus:ring-4 focus:ring-blue-100" placeholder="0,00" />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-gray-400 uppercase ml-2">Volume (Pares/Unidades)</label>
                                <input value={pairs} onChange={e => setPairs(e.target.value.replace(/\D/g, ''))} className="w-full p-4 bg-gray-50 rounded-2xl font-black text-gray-900 text-center outline-none" placeholder="0" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-gray-400 uppercase ml-2">Perfil do Pedido</label>
                                <div className="flex bg-gray-100 p-1 rounded-2xl">
                                    <button type="button" onClick={() => setOrderCreatedByRole('COMPRADOR')} className={`flex-1 py-3 rounded-xl font-black text-[10px] uppercase transition-all ${orderCreatedByRole === 'COMPRADOR' ? 'bg-blue-900 text-white shadow-lg' : 'text-gray-400'}`}>Comprador</button>
                                    <button type="button" onClick={() => setOrderCreatedByRole('GERENTE')} className={`flex-1 py-3 rounded-xl font-black text-[10px] uppercase transition-all ${orderCreatedByRole === 'GERENTE' ? 'bg-orange-600 text-white shadow-lg' : 'text-gray-400'}`}>Gerente</button>
                                </div>
                            </div>
                        </div>

                        {isAdmin && (
                            <div className="space-y-3 bg-gray-50 p-6 rounded-[32px] border border-gray-100 shadow-inner">
                                <label className="text-[10px] font-black text-blue-900 uppercase italic ml-2">Vincular Unidades (Multi-loja)</label>
                                <div className="grid grid-cols-4 gap-2 max-h-32 overflow-y-auto pr-2 no-scrollbar">
                                    {activeStores.map(s => (
                                        <button key={s.id} type="button" onClick={() => setSelectedStoresForOrder(prev => prev.includes(s.id) ? prev.filter(id => id !== s.id) : [...prev, s.id])} className={`p-2 rounded-xl text-[9px] font-black uppercase border-2 transition-all ${selectedStoresForOrder.includes(s.id) ? 'bg-blue-900 border-blue-900 text-white shadow-md' : 'bg-white border-gray-100 text-gray-400 hover:border-blue-200'}`}>{s.number}</button>
                                    ))}
                                </div>
                            </div>
                        )}

                        <button type="submit" disabled={isSubmitting} className="w-full py-5 bg-red-600 text-white rounded-[28px] font-black uppercase text-xs shadow-2xl active:scale-95 transition-all border-b-4 border-red-900 flex items-center justify-center gap-3">
                            {isSubmitting ? <Loader2 className="animate-spin" /> : <Save size={18}/>} SALVAR PEDIDO
                        </button>
                    </form>
                </div>
            </div>
        )}

        {activeForm === 'expense' && (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[100] p-4">
                <div className="bg-white rounded-[40px] w-full max-w-xl shadow-2xl animate-in zoom-in duration-300 overflow-hidden border-t-8 border-orange-600 max-h-[90vh] flex flex-col">
                    <div className="p-8 border-b bg-gray-50/50 flex justify-between items-center">
                        <div>
                            <h3 className="text-2xl font-black uppercase italic text-blue-950 flex items-center gap-3"><DollarSign className="text-orange-600" /> Despesas <span className="text-orange-600">Extra-OTB</span></h3>
                            <p className="text-gray-400 text-[10px] font-black uppercase tracking-widest mt-1">Lançamento de gastos fixos e deduções</p>
                        </div>
                        <button onClick={() => setActiveForm(null)} className="text-gray-400 hover:text-red-600"><X size={24}/></button>
                    </div>
                    <form onSubmit={handleSaveAllExpenses} className="flex-1 overflow-y-auto no-scrollbar">
                        <div className="p-10 space-y-4">
                            {timeline.map(m => (
                                <div key={m.key} className="flex items-center gap-4 bg-gray-50 p-4 rounded-[24px] border border-gray-100 group hover:border-orange-200 transition-all">
                                    <div className="w-20 font-black text-[10px] text-gray-500 uppercase tracking-tighter">{m.label}</div>
                                    <div className="flex-1 relative">
                                        <input 
                                            value={semesterDebts[m.key] || ''} 
                                            onChange={e => setSemesterDebts({...semesterDebts, [m.key]: e.target.value})}
                                            className="w-full p-4 bg-white rounded-2xl font-black text-orange-700 shadow-inner outline-none focus:ring-4 focus:ring-orange-50 text-right pr-12"
                                            placeholder="0,00"
                                        />
                                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-300 font-black text-[10px]">R$</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="p-10 bg-gray-50 border-t flex justify-center">
                            <button type="submit" disabled={isSubmitting} className="w-full max-w-sm py-5 bg-orange-600 text-white rounded-[28px] font-black uppercase text-xs shadow-2xl active:scale-95 transition-all border-b-4 border-orange-900 flex items-center justify-center gap-3">
                                {isSubmitting ? <Loader2 className="animate-spin" /> : <Save size={18}/>} ATUALIZAR DESPESAS
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        )}

        {activeForm === 'cota_config' && (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[100] p-4">
                <div className="bg-white rounded-[40px] w-full max-w-md shadow-2xl animate-in zoom-in duration-300 overflow-hidden border-t-8 border-yellow-500">
                    <div className="p-8 border-b bg-gray-50/50 flex justify-between items-center">
                        <h3 className="text-xl font-black uppercase italic text-blue-950 flex items-center gap-3"><Calculator className="text-yellow-600" /> Configurar <span className="text-yellow-600">Limites</span></h3>
                        <button onClick={() => setActiveForm(null)} className="text-gray-400 hover:text-red-600"><X size={24}/></button>
                    </div>
                    <form onSubmit={handleSaveCotaSettings} className="p-10 space-y-8">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-400 uppercase ml-2">Teto de Compras (Mensal)</label>
                            <div className="relative">
                                <input required value={budgetVal} onChange={e => setBudgetVal(e.target.value)} className="w-full p-5 bg-gray-50 rounded-[28px] font-black text-gray-900 text-2xl shadow-inner outline-none focus:ring-4 focus:ring-yellow-50 pl-12" placeholder="0,00" />
                                <DollarSign className="absolute left-5 top-1/2 -translate-y-1/2 text-yellow-500" size={24}/>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-400 uppercase ml-2">Participação Gerência (%)</label>
                            <input required value={managerPct} onChange={e => setManagerPct(e.target.value)} className="w-full p-5 bg-gray-50 rounded-[28px] font-black text-gray-900 text-2xl shadow-inner outline-none text-center" placeholder="20" />
                        </div>
                        <button type="submit" disabled={isSubmitting} className="w-full py-5 bg-yellow-500 text-blue-950 rounded-[28px] font-black uppercase text-xs shadow-xl active:scale-95 transition-all border-b-4 border-yellow-700 flex items-center justify-center gap-3">
                            {isSubmitting ? <Loader2 className="animate-spin" /> : <Save size={18}/>} EFETIVAR CONFIGURAÇÃO
                        </button>
                    </form>
                </div>
            </div>
        )}

        {activeForm === 'validated_orders' && (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[100] p-4">
                <div className="bg-white rounded-[48px] w-full max-w-4xl shadow-2xl animate-in zoom-in duration-300 overflow-hidden border-t-8 border-green-600 max-h-[90vh] flex flex-col">
                    <div className="p-8 border-b bg-gray-50/50 flex justify-between items-center">
                        <div>
                            <h3 className="text-2xl font-black uppercase italic text-blue-950 flex items-center gap-3"><BadgeCheck className="text-green-600" /> Carteira de <span className="text-green-600">Pedidos</span></h3>
                            <p className="text-gray-400 text-[10px] font-black uppercase tracking-widest mt-1">Histórico de compras autorizadas pela rede</p>
                        </div>
                        <div className="flex gap-2">
                             <button onClick={handlePrintValidated} className="p-3 bg-blue-50 text-blue-700 rounded-2xl hover:bg-blue-100 transition-all shadow-sm"><Printer size={20}/></button>
                             <button onClick={() => setActiveForm(null)} className="p-3 bg-gray-50 text-gray-400 hover:text-red-600 rounded-2xl transition-all"><X size={20}/></button>
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto no-scrollbar">
                        <table className="w-full text-left">
                            <thead className="bg-white sticky top-0 z-10 border-b border-gray-100 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                                <tr>
                                    <th className="px-8 py-5">Identificação</th>
                                    <th className="px-8 py-5">Embarque</th>
                                    <th className="px-8 py-5 text-right">Valor Total</th>
                                    <th className="px-8 py-5 text-center">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50 font-bold">
                                {consolidated.orders.filter(o => o.status === 'VALIDADO' || o.status === 'validated' || o.status === 'FECHADA').map(order => (
                                    <tr key={order.id} className="hover:bg-gray-50 transition-all group">
                                        <td className="px-8 py-5">
                                            <div className="font-black text-gray-900 uppercase italic text-sm tracking-tighter leading-none">{order.brand}</div>
                                            <div className="text-[9px] text-gray-400 uppercase mt-1 italic tracking-widest">{order.classification || order.category_name}</div>
                                        </td>
                                        <td className="px-8 py-5"><span className="text-[10px] font-black text-blue-600 bg-blue-50 px-3 py-1 rounded-full uppercase italic">{getMonthNameFromKey(order.shipmentDate)}</span></td>
                                        <td className="px-8 py-5 text-right font-black text-blue-950 text-base italic">{formatCurrency(order.totalValue)}</td>
                                        <td className="px-8 py-5 text-center">
                                            <div className="flex justify-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                                                <button onClick={() => onUpdateCota(order.id, { status: 'ABERTA' })} className="p-2 text-orange-600 hover:bg-orange-50 rounded-xl transition-all" title="Reverter p/ Aberto"><ArrowDownRight size={18}/></button>
                                                <button onClick={() => onDeleteCota(order.id)} className="p-2 text-red-300 hover:text-red-600 rounded-xl transition-all"><Trash2 size={18}/></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};
