
import React, { useState, useMemo, useEffect } from 'react';
import { Store, User, Cota, UserRole, CotaSettings, CotaDebts, MonthlyPerformance, QuotaCategory, QuotaMixParameter } from '../types';
import { formatCurrency, BRAND_LOGO } from '../constants';
import { 
    Plus, Trash2, Building2, Loader2, DollarSign, Calculator, X, Save, 
    History, CheckCircle, BadgeCheck, FileBarChart, Printer, Check,
    LayoutGrid, UserCheck, Briefcase, Layers, TrendingDown, Info, Calendar,
    AlertTriangle, ArrowUpRight, ArrowDownRight, Target, PieChart
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
}

const CotasManagement: React.FC<CotasManagementProps> = ({ 
  user, stores, cotas, cotaSettings, cotaDebts, productCategories = [], mixParameters = [],
  onAddCota, onUpdateCota, onDeleteCota, onSaveSettings, onSaveDebts
}) => {
  const timeline = useMemo(() => generateTimeline(), []);
  const isAdmin = user.role === UserRole.ADMIN;
  const [manualStoreId, setManualStoreId] = useState<string>('');
  const activeStores = useMemo(() => (stores || []).filter(s => s.status === 'active').sort((a, b) => (parseInt(a.number) || 0) - (parseInt(b.number) || 0)), [stores]);
  const viewStoreId = isAdmin ? (manualStoreId || activeStores[0]?.id || '') : user.storeId!;

  const [activeForm, setActiveForm] = useState<'order' | 'expense' | 'cota_config' | 'validated_orders' | 'mix_view' | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

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

    timeline.forEach(m => {
        const budgetTotal = Number(settings?.budgetValue || 0);
        const monthlyDebts = storeDebts.filter(d => d.month === m.key).reduce((a, b) => a + Number(b.value), 0);
        
        let buyerValid = 0;
        let managerValid = 0;
        let pendingInstallmentSum = 0;

        storeOrders.forEach(p => { 
            const val = getInstallmentValueForMonth(p, m.key);
            if (p.status === 'VALIDADO' || p.status === 'validated' || p.status === 'FECHADA') {
                if (p.createdByRole === 'GERENTE') managerValid += val;
                else buyerValid += val;
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
    return { orders: storeOrders, stats, debts: storeDebts };
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
                    {/* LINHA DE SALDO FINAL */}
                    <tr className="bg-yellow-400 border-b border-yellow-500 h-12">
                        <td className="px-4 py-2 text-left sticky left-0 bg-yellow-400 z-30 font-black text-blue-900 shadow-sm">SALDO COTA ATUAL</td>
                        <td className="font-black italic text-blue-900 sticky left-[224px] bg-yellow-400 z-30">LÍQUIDO</td>
                        {timeline.map(m => (
                            <td key={m.key} className={`p-2 font-black ${consolidated.stats[m.key].available < 0 ? 'text-red-600 animate-pulse' : 'text-blue-900'}`}>
                                {formatCurrency(consolidated.stats[m.key].available)}
                            </td>
                        ))}
                    </tr>

                    {/* LINHA DE GASTOS FIXOS */}
                    <tr className="bg-gray-50/50 border-b h-11">
                        <td className="px-4 text-left sticky left-0 bg-[#f9fafb] z-30 font-black text-red-600">GASTOS FIXOS / DEBTS</td>
                        <td className="font-black italic text-red-600 sticky left-[224px] bg-[#f9fafb] z-30">SAÍDAS</td>
                        {timeline.map(m => (
                            <td key={m.key} className="p-2 font-black text-red-600">
                                {formatCurrency(consolidated.stats[m.key].debts)}
                            </td>
                        ))}
                    </tr>

                    <tr className="bg-white border-b h-11">
                        <td className="px-4 text-left sticky left-0 bg-white z-30 font-black text-blue-800">COTA COMPRADOR ({100 - (storeSettings?.managerPercent || 20)}%)</td>
                        <td className="font-black italic text-blue-800 sticky left-[224px] bg-white z-30">VALIDADO</td>
                        {timeline.map(m => (
                            <td key={m.key} className="p-2 font-black text-blue-800">
                                {formatCurrency(consolidated.stats[m.key].buyerValid)}
                            </td>
                        ))}
                    </tr>

                    <tr className="bg-orange-50/20 border-b h-11">
                        <td className="px-4 text-left sticky left-0 bg-[#fefce8] z-30 font-black text-orange-700">COTA GERENTE ({storeSettings?.managerPercent || 20}%)</td>
                        <td className="font-black italic text-orange-700 sticky left-[224px] bg-[#fefce8] z-30">VALIDADO</td>
                        {timeline.map(m => (
                            <td key={m.key} className="p-2 font-black text-orange-700">
                                {formatCurrency(consolidated.stats[m.key].managerValid)}
                            </td>
                        ))}
                    </tr>

                    {/* SEÇÃO AGUARDANDO VALIDAÇÃO */}
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

                    {/* GRID DE PEDIDOS ABERTOS */}
                    {consolidated.orders.filter(o => o.status === 'ABERTA' || o.status === 'pending').map(order => {
                        const isManagerOrder = order.createdByRole === 'GERENTE';
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
                                            <div className="text-[8px] text-gray-400 font-bold uppercase italic">
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

        {/* MODAL PEDIDOS VALIDADOS */}
        {activeForm === 'validated_orders' && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[150] flex items-center justify-center p-4">
                <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-4xl overflow-hidden animate-in zoom-in duration-300 border-t-8 border-green-600 flex flex-col max-h-[90vh]">
                    <div className="p-8 border-b bg-gray-50 flex justify-between items-center">
                        <div>
                            <h3 className="text-2xl font-black uppercase italic text-blue-900 tracking-tighter leading-none">Pedidos <span className="text-green-600">Validados</span></h3>
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1">Conferência de Carteira Ativa</p>
                        </div>
                        <div className="flex gap-2">
                             <button onClick={handlePrintValidated} className="p-3 bg-white text-blue-600 rounded-xl hover:bg-blue-50 border border-blue-100 transition-all shadow-sm" title="Imprimir para Conferência"><Printer size={20}/></button>
                             <button onClick={() => setActiveForm(null)} className="p-3 bg-white text-gray-400 hover:text-red-600 rounded-xl transition-all border border-gray-100 shadow-sm"><X size={20}/></button>
                        </div>
                    </div>
                    <div className="overflow-y-auto flex-1 p-8 no-scrollbar bg-white">
                        <table className="w-full text-left">
                            <thead className="text-[10px] font-black text-gray-400 uppercase tracking-widest border-b">
                                <tr>
                                    <th className="py-4">Mês Embarque</th>
                                    <th className="py-4">Marca</th>
                                    <th className="py-4">Classificação</th>
                                    <th className="py-4 text-right">Valor Total</th>
                                    <th className="py-4 text-center">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {consolidated.orders.filter(o => o.status === 'VALIDADO' || o.status === 'validated' || o.status === 'FECHADA').sort((a,b) => a.shipmentDate.localeCompare(b.shipmentDate)).map(order => (
                                    <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="py-4 text-[11px] font-black text-blue-600">{getMonthNameFromKey(order.shipmentDate)}</td>
                                        <td className={`py-4 text-[11px] font-black uppercase italic ${order.createdByRole === 'GERENTE' ? 'text-orange-700' : 'text-blue-800'}`}>{order.brand}</td>
                                        <td className="py-4 text-[9px] font-bold text-gray-400 uppercase">{order.classification || order.category_name}</td>
                                        <td className="py-4 text-right font-black text-blue-900">{formatCurrency(order.totalValue)}</td>
                                        <td className="py-4 text-center">
                                            <button onClick={() => onUpdateCota(order.id, { status: 'ABERTA' })} className="p-1.5 text-gray-400 hover:text-red-600" title="Retornar para Aberta (Em Edição)"><History size={14}/></button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        )}

        {/* MODAL MIX ANALYTICS - MELHORADO E COMPARATIVO */}
        {activeForm === 'mix_view' && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[150] flex items-center justify-center p-4">
                <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-[95vw] overflow-hidden animate-in zoom-in duration-300 border-t-8 border-purple-600 flex flex-col max-h-[95vh]">
                    <div className="p-8 border-b bg-gray-50 flex justify-between items-center">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-purple-100 text-purple-600 rounded-2xl shadow-inner"><PieChart size={28}/></div>
                            <div>
                                <h3 className="text-2xl font-black uppercase italic text-blue-950 tracking-tighter leading-none">Análise de <span className="text-purple-600">Mix Estratégico</span></h3>
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1">Comparativo de Meta vs. Real (Pendentes + Validados)</p>
                            </div>
                        </div>
                        <button onClick={() => setActiveForm(null)} className="p-3 bg-white text-gray-400 hover:text-red-600 rounded-xl transition-all border border-gray-100 shadow-sm"><X size={20}/></button>
                    </div>
                    
                    <div className="overflow-y-auto flex-1 p-8 no-scrollbar bg-white space-y-10">
                        {/* NOVO: CAMADA VISUAL DE CARDS DE DECISÃO */}
                        <div className="grid grid-cols-4 gap-6">
                             {(Object.entries(groupedCategories) as [string, QuotaCategory[]][]).map(([parent, children]) => {
                                 const allOrders = consolidated.orders;
                                 
                                 /** 
                                  * REGRA OBRIGATÓRIA DE CÁLCULO:
                                  * TOTAL_GERAL = Soma de total_comprado de TODAS as parent_category 
                                  * (OU o Budget total definido, caso desejado para controle de ocupação de cota)
                                  * Para alinhar com o objetivo de decisão, usaremos o BUDGET TOTAL como denominador global.
                                  */
                                 const budgetTotalGlobal = Number(storeSettings?.budgetValue || 0);
                                 const totalPurchasedGlobal = allOrders.reduce((a,b) => a + b.totalValue, 0);
                                 
                                 // Denominador Único e Global para o MIX
                                 const TOTAL_GERAL_DENOMINADOR = budgetTotalGlobal > 0 ? budgetTotalGlobal : (totalPurchasedGlobal > 0 ? totalPurchasedGlobal : 1);
                                 
                                 // Cálculo da Categoria Pai
                                 const parentTotalValue = allOrders
                                    .filter(o => children.some(c => c.category_name === (o.classification || o.category_name)))
                                    .reduce((a,b) => a + b.totalValue, 0);
                                 
                                 // percentual_real = total_comprado / TOTAL_GERAL * 100
                                 const actualPercent = (parentTotalValue / TOTAL_GERAL_DENOMINADOR) * 100;
                                 
                                 // percentual_meta = Soma das metas das subcategorias (mix_percentage)
                                 const groupMetaPercent = mixParameters
                                    .filter(p => children.some(c => c.category_name === p.category_name))
                                    .reduce((acc, curr) => acc + curr.percentage, 0);
                                 
                                 // Valor Financeiro da Meta baseado no orçamento total
                                 const budgetValueTarget = (budgetTotalGlobal * groupMetaPercent) / 100;
                                 const diffValue = budgetValueTarget - parentTotalValue;
                                 
                                 // Cores de Alerta Baseadas no Delta
                                 let statusColor = "border-gray-100 bg-gray-50";
                                 let textColor = "text-gray-400";
                                 let Icon = Info;
                                 
                                 if (groupMetaPercent > 0) {
                                     const diffPct = actualPercent - groupMetaPercent;
                                     if (Math.abs(diffPct) <= 2) { statusColor = "border-green-100 bg-green-50/50"; textColor = "text-green-600"; Icon = BadgeCheck; }
                                     else if (diffPct < -2) { statusColor = "border-yellow-100 bg-yellow-50/50"; textColor = "text-yellow-600"; Icon = Target; }
                                     else { statusColor = "border-red-100 bg-red-50/50"; textColor = "text-red-600"; Icon = AlertTriangle; }
                                 }

                                 return (
                                     <div key={parent} className={`rounded-[40px] p-8 border-2 shadow-sm transition-all flex flex-col relative overflow-hidden group ${statusColor}`}>
                                         <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform"><Icon size={80}/></div>
                                         
                                         <div className="flex justify-between items-start mb-6">
                                             <div>
                                                 <h4 className="font-black text-blue-900 uppercase italic text-sm truncate pr-10">{parent}</h4>
                                                 <div className="flex items-center gap-2 mt-2">
                                                     <span className="text-[10px] font-black bg-white px-2 py-1 rounded-lg shadow-sm text-gray-500 border border-gray-100">META: {groupMetaPercent.toFixed(1)}%</span>
                                                     <span className={`text-[10px] font-black px-2 py-1 rounded-lg shadow-sm border ${textColor} bg-white`}>REAL: {actualPercent.toFixed(1)}%</span>
                                                 </div>
                                             </div>
                                         </div>

                                         <div className="flex-1 space-y-4">
                                             <div className="flex flex-col">
                                                 <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Total Comprado</span>
                                                 <span className="text-xl font-black text-blue-950 italic">{formatCurrency(parentTotalValue)}</span>
                                             </div>

                                             {/* Alertas de Decisão baseados no Delta Financeiro */}
                                             <div className="pt-4 border-t border-dashed border-gray-200">
                                                 {diffValue > 100 ? (
                                                     <div className="flex items-center gap-2 text-yellow-600 animate-pulse">
                                                         <ArrowDownRight size={16}/>
                                                         <span className="text-[10px] font-black uppercase">Falta Comprar {formatCurrency(diffValue)}</span>
                                                     </div>
                                                 ) : diffValue < -100 ? (
                                                     <div className="flex items-center gap-2 text-red-600">
                                                         <ArrowUpRight size={16}/>
                                                         <span className="text-[10px] font-black uppercase">Excesso de {formatCurrency(Math.abs(diffValue))}</span>
                                                     </div>
                                                 ) : (
                                                     <div className="flex items-center gap-2 text-green-600">
                                                         <CheckCircle size={16}/>
                                                         <span className="text-[10px] font-black uppercase">Meta Atingida</span>
                                                     </div>
                                                 )}
                                             </div>
                                         </div>
                                     </div>
                                 );
                             })}
                        </div>

                        {/* TABELA DE DETALHAMENTO POR SUB-CLASSE (BRODOWN) */}
                        <div className="space-y-4">
                             <h4 className="text-xs font-black text-gray-400 uppercase tracking-[0.3em] ml-2 flex items-center gap-2"><Layers size={14}/> Participação Interna por Sub-Classe</h4>
                             <div className="grid grid-cols-4 gap-4">
                                {(Object.entries(groupedCategories) as [string, QuotaCategory[]][]).map(([parent, children]) => {
                                    const allOrders = consolidated.orders;
                                    const parentTotal = allOrders.filter(o => children.some(c => c.category_name === (o.classification || o.category_name))).reduce((a,b) => a + b.totalValue, 0);

                                    return (
                                        <div key={parent + '_detail'} className="bg-gray-50 rounded-[32px] p-5 border border-gray-100 shadow-inner flex flex-col">
                                            <div className="flex justify-between items-center mb-4 bg-white p-3 rounded-2xl shadow-sm border border-gray-100">
                                                <h5 className="font-black text-blue-900 uppercase italic text-[10px] truncate">{parent}</h5>
                                                <span className="text-[9px] font-black text-gray-400 uppercase">Detalhamento</span>
                                            </div>
                                            <div className="space-y-1.5 flex-1">
                                                {children.map(child => {
                                                    const childTotal = allOrders.filter(o => (o.classification || o.category_name) === child.category_name).reduce((a,b) => a + b.totalValue, 0);
                                                    const pctChild = parentTotal > 0 ? (childTotal / parentTotal) * 100 : 0;
                                                    return (
                                                        <div key={child.id} className="bg-white/60 p-2.5 rounded-xl border border-gray-100 flex justify-between items-center">
                                                            <span className="text-[8px] font-black text-gray-500 uppercase truncate pr-2">{child.category_name}</span>
                                                            <span className="text-[9px] font-black text-purple-700 shrink-0">{pctChild.toFixed(1)}%</span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    );
                                })}
                             </div>
                        </div>
                    </div>
                </div>
            </div>
        )}

        {/* MODAL LANÇAR DESPESA EXTRA */}
        {activeForm === 'expense' && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[150] flex items-center justify-center p-4">
                <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in duration-300 border-t-8 border-orange-600 flex flex-col max-h-[90vh]">
                    <div className="p-8 border-b bg-gray-50 flex justify-between items-center">
                        <div>
                            <h3 className="text-xl font-black uppercase italic text-blue-900">Programação de <span className="text-orange-600">Gastos Fixos (Debts)</span></h3>
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1">Previsão Mensal (Dedução do OTB)</p>
                        </div>
                        <button onClick={() => setActiveForm(null)} className="text-gray-400 hover:text-red-600 transition-all"><X size={24}/></button>
                    </div>
                    <form onSubmit={handleSaveAllExpenses} className="overflow-y-auto no-scrollbar flex-1 p-8">
                        <div className="grid grid-cols-2 gap-4">
                            {timeline.map(m => (
                                <div key={m.key} className="bg-gray-50 p-4 rounded-[24px] border border-gray-100 shadow-inner flex items-center gap-4">
                                    <div className="bg-white w-20 py-2 rounded-xl text-center shadow-sm border border-gray-100">
                                        <span className="text-[10px] font-black text-blue-900 uppercase">{m.label}</span>
                                    </div>
                                    <div className="flex-1">
                                        <input 
                                            value={semesterDebts[m.key] || ''} 
                                            onChange={e => setSemesterDebts({...semesterDebts, [m.key]: e.target.value})}
                                            className="w-full bg-transparent border-none font-black text-red-600 text-lg outline-none text-right pr-2"
                                            placeholder="0,00"
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </form>
                    <div className="p-8 bg-gray-50 border-t flex gap-4">
                        <button type="button" onClick={() => setActiveForm(null)} className="flex-1 py-5 bg-white border-2 border-gray-200 rounded-[28px] font-black text-gray-400 uppercase text-xs active:scale-95 transition-all">Cancelar</button>
                        <button onClick={handleSaveAllExpenses} disabled={isSubmitting} className="flex-1 py-5 bg-orange-600 text-white rounded-[28px] font-black uppercase text-xs shadow-xl active:scale-95 transition-all border-b-4 border-orange-800 flex items-center justify-center gap-3">
                            {isSubmitting ? <Loader2 className="animate-spin" /> : <Save size={18}/>} Gravar Programação
                        </button>
                    </div>
                </div>
            </div>
        )}

        {/* MODAL CONFIGURAR COTA OTB */}
        {activeForm === 'cota_config' && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[150] flex items-center justify-center p-4">
                <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in duration-300 border-t-8 border-yellow-500">
                    <div className="p-8 border-b bg-gray-50 flex justify-between items-center">
                        <h3 className="text-xl font-black uppercase italic text-blue-950 flex items-center gap-3"><Calculator className="text-yellow-600" size={24}/> Definir Cota OTB</h3>
                        <button onClick={() => setActiveForm(null)} className="text-gray-400 hover:text-red-600 transition-all"><X size={24}/></button>
                    </div>
                    <form onSubmit={handleSaveCotaSettings} className="p-10 space-y-6">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-400 uppercase ml-2 tracking-widest">Valor do OTB (Orçamento)</label>
                            <input required value={budgetVal} onChange={e => setBudgetVal(e.target.value)} className="w-full p-5 bg-gray-50 rounded-[28px] font-black text-blue-900 text-3xl text-center shadow-inner outline-none focus:ring-8 focus:ring-yellow-50" placeholder="0,00" />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-400 uppercase ml-2 tracking-widest">Participação do Gerente (%)</label>
                            <input required value={managerPct} onChange={e => setManagerPct(e.target.value)} className="w-full p-4 bg-gray-50 rounded-2xl font-black text-orange-600 text-center shadow-inner outline-none" placeholder="20" />
                        </div>
                        <button type="submit" className="w-full py-5 bg-blue-900 text-white rounded-[24px] font-black uppercase text-xs shadow-xl active:scale-95 transition-all border-b-4 border-blue-950">Confirmar Cota</button>
                    </form>
                </div>
            </div>
        )}

        {/* MODAL NOVO PEDIDO CORPORATIVO */}
        {activeForm === 'order' && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[150] flex items-center justify-center p-4">
                <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-4xl overflow-hidden animate-in zoom-in duration-300 border-t-8 border-blue-900 flex flex-col max-h-[95vh]">
                    <div className="p-8 border-b bg-gray-50 flex justify-between items-center">
                        <div className="flex items-center gap-6">
                            <div>
                                <h3 className="text-2xl font-black uppercase italic text-blue-900 tracking-tighter leading-none">Incluir <span className="text-red-600">Pedido</span></h3>
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1">Registro de Pedido Estratégico</p>
                            </div>
                            <div className="bg-gray-200 p-1 rounded-full flex items-center shadow-inner border border-gray-300 h-9 shrink-0">
                                <button type="button" onClick={() => setOrderCreatedByRole('COMPRADOR')} className={`px-4 h-7 rounded-full text-[9px] font-black uppercase transition-all flex items-center gap-2 ${orderCreatedByRole === 'COMPRADOR' ? 'bg-blue-900 text-white shadow-lg' : 'text-gray-500'}`}><UserCheck size={12}/> Comprador</button>
                                <button type="button" onClick={() => setOrderCreatedByRole('GERENTE')} className={`px-4 h-7 rounded-full text-[9px] font-black uppercase transition-all flex items-center gap-2 ${orderCreatedByRole === 'GERENTE' ? 'bg-orange-600 text-white shadow-lg' : 'text-gray-500'}`}><Briefcase size={12}/> Gerente</button>
                            </div>
                        </div>
                        <button onClick={() => setActiveForm(null)} className="bg-white p-2 rounded-full text-gray-400 hover:text-red-600 transition-all shadow-sm border border-gray-100"><X size={24}/></button>
                    </div>

                    <div className="overflow-y-auto flex-1 p-8 space-y-8 no-scrollbar bg-white">
                        <div className="space-y-4">
                            <label className="text-[11px] font-black text-blue-900 uppercase tracking-widest flex items-center gap-2"><LayoutGrid size={16}/> Destino do Pedido (Lojas)</label>
                            <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 gap-3 p-6 bg-gray-50 rounded-[32px] border border-gray-100 shadow-inner">
                                {activeStores.map(s => {
                                    const isSelected = selectedStoresForOrder.includes(s.id);
                                    return (
                                        <button key={s.id} type="button" onClick={() => setSelectedStoresForOrder(prev => isSelected ? prev.filter(id => id !== s.id) : [...prev, s.id])} className={`relative w-12 h-12 rounded-full font-black text-[11px] transition-all flex items-center justify-center border-2 ${isSelected ? 'bg-green-500 border-green-600 text-white shadow-lg scale-110' : 'bg-white border-gray-200 text-gray-400 hover:border-blue-400'}`}>{isSelected ? <Check size={14} strokeWidth={4} /> : s.number.padStart(2, '0')}</button>
                                    );
                                })}
                            </div>
                        </div>

                        <form onSubmit={handleSaveOrder} className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="space-y-2"><label className="text-[10px] font-black text-gray-400 uppercase ml-2 tracking-widest">Marca / Fornecedor</label><input required value={brand} onChange={e => setBrand(e.target.value)} className="w-full p-4 bg-gray-50 border-none rounded-2xl font-black text-gray-900 uppercase italic shadow-inner outline-none focus:ring-4 focus:ring-blue-100" placeholder="EX: MOLECA" /></div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-gray-400 uppercase ml-2 tracking-widest">Classificação Oficial</label>
                                    <select required value={selectedCategoryId} onChange={e => setSelectedCategoryId(e.target.value)} className="w-full p-4 bg-gray-50 border-none rounded-2xl font-black text-gray-900 uppercase text-xs shadow-inner outline-none">
                                        <option value="">SELECIONE...</option>
                                        {(Object.entries(groupedCategories) as [string, QuotaCategory[]][]).map(([parent, children]) => (
                                            <optgroup key={parent} label={parent} className="text-blue-600 font-black">
                                                {children.map(c => <option key={c.id} value={c.id} className="text-gray-900">{c.category_name}</option>)}
                                            </optgroup>
                                        ))}
                                    </select>
                                </div>
                                <div className="space-y-2"><label className="text-[10px] font-black text-gray-400 uppercase ml-2 tracking-widest">Mês Referência (Embarque)</label><select value={shipmentMonth} onChange={e => setShipmentMonth(e.target.value)} className="w-full p-4 bg-gray-50 border-none rounded-2xl font-black text-gray-900 uppercase shadow-inner">{timeline.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}</select></div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                                <div className="space-y-2"><label className="text-[10px] font-black text-gray-400 uppercase ml-2 tracking-widest">Condição de Pagto</label><input required value={paymentTerms} onChange={e => setPaymentTerms(e.target.value)} className="w-full p-4 bg-gray-50 border-none rounded-2xl font-black text-gray-900 text-center shadow-inner" placeholder="30/60/90" /></div>
                                <div className="md:col-span-2 space-y-2"><label className="text-[10px] font-black text-gray-400 uppercase ml-2 tracking-widest">Valor do Pedido (R$)</label><input required value={totalValue} onChange={e => setTotalValue(e.target.value)} className="w-full p-4 bg-blue-50 border-none rounded-2xl font-black text-blue-900 text-2xl shadow-inner text-center" placeholder="0,00" /></div>
                                <div className="space-y-2"><label className="text-[10px] font-black text-gray-400 uppercase ml-2 tracking-widest">Qtd (Pares/Unids)</label><input required value={pairs} onChange={e => setPairs(e.target.value)} className="w-full p-4 bg-gray-50 border-none rounded-2xl font-black text-gray-900 text-center shadow-inner" placeholder="0" /></div>
                            </div>
                            <button type="submit" disabled={isSubmitting || selectedStoresForOrder.length === 0} className="w-full py-5 bg-blue-900 hover:bg-black text-white rounded-[24px] font-black uppercase text-xs shadow-2xl transition-all border-b-4 border-blue-950 flex items-center justify-center gap-3">
                                {isSubmitting ? <Loader2 className="animate-spin" /> : <Save size={20}/>} Confirmar Pedido em {selectedStoresForOrder.length} Loja(s)
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};

export default CotasManagement;