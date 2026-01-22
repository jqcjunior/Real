
import React, { useState, useMemo, useEffect } from 'react';
import { Store, User, Cota, UserRole, CotaSettings, CotaDebts, MonthlyPerformance, QuotaCategory, QuotaMixParameter } from '../types';
import { formatCurrency, BRAND_LOGO } from '../constants';
import { 
    Plus, Trash2, Building2, Loader2, DollarSign, Calculator, X, Save, 
    History, CheckCircle, BadgeCheck, FileBarChart, Printer, Check,
    LayoutGrid, UserCheck, Briefcase, Layers, TrendingDown, Info, Calendar,
    AlertTriangle, ArrowUpRight, ArrowDownRight, Target, PieChart, ChevronRight
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

export const CotasManagement: React.FC<CotasManagementProps> = ({ 
  user, stores, cotas, cotaSettings, cotaDebts, productCategories = [], mixParameters = [],
  onAddCota, onUpdateCota, onDeleteCota, onSaveSettings, onSaveDebts, onDeleteDebt
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

  return (
    <div className="flex flex-col h-screen bg-[#f3f4f6] overflow-hidden text-blue-950 font-sans">
        {/* TOP BAR - RESTAURADO */}
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
            {/* BOTÕES DE AÇÕES RESTAURADOS */}
            <div className="flex flex-wrap gap-2">
                <button onClick={() => { setSelectedStoresForOrder([viewStoreId]); setActiveForm('order'); }} className="bg-blue-900 text-white px-5 py-2.5 rounded-lg font-black uppercase text-[10px] shadow-md hover:bg-black transition-all flex items-center gap-2 border-b-4 border-blue-950"><Plus size={14}/> Novo Pedido</button>
                <button onClick={() => setActiveForm('validated_orders')} className="bg-green-600 text-white px-5 py-2.5 rounded-lg font-black uppercase text-[10px] shadow-md hover:bg-green-700 transition-all flex items-center gap-2 border-b-4 border-green-800"><BadgeCheck size={14}/> Pedidos Validados</button>
                <button onClick={() => setActiveForm('mix_view')} className="bg-purple-600 text-white px-5 py-2.5 rounded-lg font-black uppercase text-[10px] shadow-md hover:bg-purple-700 transition-all flex items-center gap-2 border-b-4 border-purple-800"><FileBarChart size={14}/> Parâmetros Mix</button>
                <button onClick={() => setActiveForm('expense')} className="bg-orange-600 text-white px-5 py-2.5 rounded-lg font-black uppercase text-[10px] shadow-md hover:bg-orange-700 transition-all flex items-center gap-2 border-b-4 border-orange-800"><DollarSign size={14}/> Lançar Despesa</button>
                <button onClick={() => setActiveForm('cota_config')} className="bg-yellow-500 text-blue-950 px-5 py-2.5 rounded-lg font-black uppercase text-[10px] shadow-md hover:bg-yellow-600 transition-all flex items-center gap-2 border-b-4 border-yellow-700"><Calculator size={14}/> Definir Cota</button>
            </div>
        </div>

        {/* TIMELINE TABLE - CORRIGIDO MAPEAMENTO */}
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

                    {/* GRID DE PEDIDOS ABERTOS - CORRIGIDO CORES E DADOS */}
                    {consolidated.orders.filter(o => o.status === 'ABERTA' || o.status === 'pending').map(order => {
                        const role = String(order.createdByRole || '').toUpperCase();
                        const isManagerOrder = role === 'GERENTE';
                        const isAcessorio = (order.classification || order.category_name)?.toUpperCase().includes('ACESSÓRIO');
                        const qtyType = isAcessorio ? 'UNIDADES' : 'PARES';

                        return (
                            <tr key={order.id} className="hover:bg-blue-50/50 transition-colors border-b group h-16">
                                <td className="px-4 text-left sticky left-0 bg-white group-hover:bg-blue-50/50 z-30 shadow-sm">
                                    <div className="flex items-center gap-3">
                                        {/* BOLINHA DE COR POR PERFIL */}
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
                                        {/* MÊS DE EMBARQUE RESTAURADO */}
                                        <div className="text-[9px] font-black text-blue-600 uppercase tracking-tighter mb-0.5">EMB: {getMonthNameFromKey(order.shipmentDate)}</div>
                                        {/* VALOR TOTAL RESTAURADO */}
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

        {/* MODAL: NOVO PEDIDO */}
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
                                    {Object.entries(groupedCategories).map(([parent, cats]) => (
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

        {/* MODAL: LANÇAR DESPESA */}
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

        {/* MODAL: DEFINIR COTA */}
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
                        <div className="p-5 bg-yellow-50 rounded-2xl border border-yellow-100 flex items-start gap-3">
                            <Info className="text-yellow-600 shrink-0" size={18} />
                            <p className="text-[9px] font-bold text-yellow-800 leading-relaxed uppercase">Este valor define o limite bruto disponível para compras em cada mês da timeline.</p>
                        </div>
                        <button type="submit" disabled={isSubmitting} className="w-full py-5 bg-yellow-500 text-blue-950 rounded-[28px] font-black uppercase text-xs shadow-xl active:scale-95 transition-all border-b-4 border-yellow-700 flex items-center justify-center gap-3">
                            {isSubmitting ? <Loader2 className="animate-spin" /> : <Save size={18}/>} EFETIVAR CONFIGURAÇÃO
                        </button>
                    </form>
                </div>
            </div>
        )}

        {/* MODAL: PEDIDOS VALIDADOS */}
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

        {/* MODAL: MIX DE PRODUTOS */}
        {activeForm === 'mix_view' && (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[100] p-4">
                <div className="bg-white rounded-[48px] w-full max-w-4xl shadow-2xl animate-in zoom-in duration-300 overflow-hidden border-t-8 border-purple-600 max-h-[90vh] flex flex-col">
                    <div className="p-8 border-b bg-gray-50/50 flex justify-between items-center">
                        <div>
                            <h3 className="text-2xl font-black uppercase italic text-blue-950 flex items-center gap-3"><FileBarChart className="text-purple-600" /> Parâmetros <span className="text-purple-600">de Mix</span></h3>
                            <p className="text-gray-400 text-[10px] font-black uppercase tracking-widest mt-1">Sugestão de compra ideal baseada em performance</p>
                        </div>
                        <button onClick={() => setActiveForm(null)} className="text-gray-400 hover:text-red-600 transition-all"><X size={24}/></button>
                    </div>
                    <div className="flex-1 overflow-y-auto no-scrollbar p-10">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                             <div className="space-y-6">
                                <h4 className="text-[10px] font-black text-purple-600 uppercase tracking-[0.2em] flex items-center gap-3"><PieChart size={16}/> Composição Proporcional</h4>
                                <div className="space-y-4">
                                    {mixParameters.map(p => {
                                        const budget = Number(storeSettings?.budgetValue || 0);
                                        const share = (budget * p.percentage) / 100;
                                        return (
                                            <div key={p.id} className="bg-gray-50 p-6 rounded-[32px] border border-gray-100 shadow-sm">
                                                <div className="flex justify-between items-center mb-2">
                                                    <span className="text-[11px] font-black text-gray-900 uppercase italic">{p.category_name}</span>
                                                    <span className="text-xs font-black text-purple-600">{p.percentage}%</span>
                                                </div>
                                                <div className="w-full bg-white rounded-full h-1.5 overflow-hidden shadow-inner mb-3">
                                                    <div className="bg-purple-600 h-full rounded-full" style={{width: `${p.percentage}%`}}></div>
                                                </div>
                                                <div className="flex justify-between items-baseline">
                                                    <span className="text-[8px] font-black text-gray-400 uppercase">Potencial de Compra</span>
                                                    <span className="text-sm font-black text-blue-950 italic">{formatCurrency(share)}</span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                             </div>

                             <div className="space-y-6">
                                <h4 className="text-[10px] font-black text-blue-900 uppercase tracking-[0.2em] flex items-center gap-3"><Layers size={16}/> Classificações de Compra</h4>
                                <div className="grid grid-cols-1 gap-3">
                                    {productCategories.slice(0, 10).map(cat => (
                                        <div key={cat.id} className="flex justify-between items-center p-4 bg-white border-2 border-gray-50 rounded-2xl group hover:border-blue-100 transition-all">
                                            <div className="flex items-center gap-4">
                                                <div className="w-1 h-6 bg-blue-900 rounded-full group-hover:scale-y-125 transition-transform"></div>
                                                <div>
                                                    <p className="text-[10px] font-black text-blue-950 uppercase italic leading-none">{cat.category_name}</p>
                                                    <p className="text-[8px] font-bold text-gray-400 uppercase mt-1">{cat.parent_category}</p>
                                                </div>
                                            </div>
                                            <ChevronRight className="text-gray-200 group-hover:text-blue-600 transition-colors" size={16}/>
                                        </div>
                                    ))}
                                </div>
                             </div>
                        </div>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};
