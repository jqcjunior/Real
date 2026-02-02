import React, { useState, useMemo, useEffect } from 'react';
import { Store, User, Cota, UserRole, CotaSettings, CotaDebts, MonthlyPerformance, QuotaCategory, QuotaMixParameter } from '../types';
import { formatCurrency, BRAND_LOGO } from '../constants';
import { 
    Plus, Trash2, Building2, Loader2, DollarSign, Calculator, X, Save, 
    History, CheckCircle, BadgeCheck, FileBarChart, Printer, Check,
    LayoutGrid, UserCheck, Briefcase, Layers, TrendingDown, Info, Calendar,
    AlertTriangle, ArrowUpRight, ArrowDownRight, Target, PieChart, ChevronRight, Settings,
    Activity, ArrowRight, ChevronDown, ChevronUp, Lightbulb
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
    const now = new Date();
    const currentMonth = now.getMonth(); 
    const currentYear = now.getFullYear();

    for (let i = 0; i < 12; i++) {
        const monthIndex = (currentMonth + i) % 12;
        const yearOffset = Math.floor((currentMonth + i) / 12);
        const targetYear = currentYear + yearOffset;
        const yearSuffix = String(targetYear).slice(-2);
        
        const label = `${SHORT_MONTHS_DISPLAY[monthIndex]}-${yearSuffix}`;
        const key = `${targetYear}-${String(monthIndex + 1).padStart(2, '0')}`;
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
  const [expandedEmployee, setExpandedEmployee] = useState<string | null>(null);

  // Simulation State
  const [simStartMonth, setSimStartMonth] = useState(timeline[0].key);
  const [simInstallments, setSimInstallments] = useState(3);

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

  // --- LÓGICA PRINCIPAL DE CÁLCULO ---
  const consolidated = useMemo(() => {
    const storeOrders = cotas.filter(p => p.storeId === viewStoreId);
    const storeDebts = cotaDebts.filter(d => d.storeId === viewStoreId);
    const settings = cotaSettings.find(s => s.storeId === viewStoreId);
    const stats: Record<string, any> = {};

    timeline.forEach(m => {
        // 1. Dados Básicos
        const budgetTotal = Number(settings?.budgetValue || 0);
        const monthlyFixedExpenses = storeDebts.filter(d => d.month === m.key).reduce((a, b) => a + Number(b.value), 0);
        const managerPercentDecimal = (settings?.managerPercent || 0) / 100;

        // 2. Cálculo dos Limites (Cotas)
        // Regra: Gerente é % sobre o total bruto.
        const limitManager = budgetTotal * managerPercentDecimal;
        
        // Regra: Comprador é o que sobra DEPOIS de tirar Gasto Fixo e Cota Gerente
        // Comprador = (Total - GastoFixo - CotaGerente)
        const limitBuyer = Math.max(0, budgetTotal - monthlyFixedExpenses - limitManager);

        // 3. Cálculo do Utilizado (Pedidos)
        let usedBuyer = 0;
        let usedManager = 0;
        let pendingInstallmentSum = 0;

        storeOrders.forEach(p => { 
            const val = getInstallmentValueForMonth(p, m.key);
            const role = String(p.createdByRole || '').toUpperCase();
            
            // Validado ou Fechado conta como consumido
            if (p.status === 'VALIDADO' || p.status === 'validated' || p.status === 'FECHADA') {
                if (role === 'GERENTE') { 
                    usedManager += val; 
                } else { 
                    usedBuyer += val; 
                }
            } 
            // Aberto/Pendente conta como "Pendente" mas tecnicamente já consome o OTB visualmente
            else if (p.status === 'ABERTA' || p.status === 'pending') {
                pendingInstallmentSum += val;
                // Opcional: Se quiser que o pendente já abata do saldo disponível imediatamente:
                if (role === 'GERENTE') { usedManager += val; } else { usedBuyer += val; }
            }
        });

        // 4. Saldos Disponíveis
        const balanceManager = limitManager - usedManager;
        const balanceBuyer = limitBuyer - usedBuyer;

        stats[m.key] = { 
            limitManager,
            limitBuyer,
            usedManager,
            usedBuyer,
            balanceManager,
            balanceBuyer,
            debts: monthlyFixedExpenses,
            pendingInstallmentSum 
        };
    });
    return { orders: storeOrders, stats, debts: storeDebts };
  }, [cotas, cotaSettings, cotaDebts, viewStoreId, timeline]);

  // --- LÓGICA DE SUGESTÃO DE COMPRA (SIMULADOR) ---
  
  const simulationResult = useMemo(() => {
      if (!simStartMonth || simInstallments <= 0) return { maxPurchase: 0, limitingMonth: '' };

      // Encontrar o índice do mês de início
      const startIndex = timeline.findIndex(t => t.key === simStartMonth);
      if (startIndex === -1) return { maxPurchase: 0, limitingMonth: '' };

      // Vamos olhar os próximos X meses (parcelas)
      let minAvailable = Infinity;
      let limitingMonthLabel = '';

      // Assumindo que a compra será feita pelo COMPRADOR (Geral)
      // Se quiser simular para gerente, teria que ter um toggle.
      // Aqui usamos o saldo do COMPRADOR.
      
      for (let i = 0; i < simInstallments; i++) {
          const targetIndex = startIndex + i;
          if (targetIndex < timeline.length) {
              const monthKey = timeline[targetIndex].key;
              const available = consolidated.stats[monthKey]?.balanceBuyer || 0;
              
              if (available < minAvailable) {
                  minAvailable = available;
                  limitingMonthLabel = timeline[targetIndex].label;
              }
          }
      }

      // Se o saldo disponível for negativo em algum mês, não pode comprar nada
      if (minAvailable < 0) minAvailable = 0;

      // Capacidade de Compra = (Menor Saldo Mensal) * (Numero de Parcelas)
      // Ex: Se em Julho (pior mês) tenho 50k, e vou dividir em 3x, posso comprar 150k.
      // Pois 150k / 3 = 50k por mês, que cabe no pior mês.
      const maxPurchase = minAvailable * simInstallments;

      return { maxPurchase, limitingMonth: limitingMonthLabel };
  }, [consolidated, simStartMonth, simInstallments, timeline]);


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

  // ... (handlePrintValidated, groupedCategories, mixHierarchyData, handleUpdateMix mantidos iguais) ...
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
        <div className="bg-white px-4 py-1.5 flex flex-col md:flex-row justify-between items-center gap-3 z-50 shadow-sm border-b shrink-0">
            <div className="flex items-center gap-3">
                <div className="bg-blue-900 text-white p-1.5 rounded-lg shadow-md shrink-0"><Building2 size={18}/></div>
                <div>
                    <h1 className="text-sm font-black uppercase italic leading-none tracking-tight text-blue-900">Engenharia <span className="text-blue-800 font-black">de Compras</span></h1>
                    <div className="flex items-center gap-2 mt-0.5">
                        {isAdmin ? (
                            <select value={viewStoreId} onChange={e => setManualStoreId(e.target.value)} className="bg-white border border-gray-200 rounded px-1 py-0 text-[8px] font-black uppercase text-blue-900 outline-none shadow-sm">
                                {activeStores.map(s => (
                                  <option key={s.id} value={s.id}>Loja {s.number} - {s.city}</option>
                                ))}
                            </select>
                        ) : (
                            <span className="text-[9px] font-black text-blue-800 uppercase tracking-widest">
                              Loja {stores.find(s => s.id === viewStoreId)?.number} - {stores.find(s => s.id === viewStoreId)?.city}
                            </span>
                        )}
                    </div>
                </div>
            </div>
            
            <div className="flex flex-wrap gap-1">
                <button onClick={() => { setSelectedStoresForOrder([viewStoreId]); setActiveForm('order'); }} className="bg-blue-900 text-white px-2.5 py-1.5 rounded-lg font-black uppercase text-[8px] shadow-sm hover:bg-black transition-all flex items-center gap-1.5 border-b-2 border-blue-950"><Plus size={10}/> Novo Pedido</button>
                <button onClick={() => setActiveForm('validated_orders')} className="bg-green-600 text-white px-2.5 py-1.5 rounded-lg font-black uppercase text-[8px] shadow-sm hover:bg-green-700 transition-all flex items-center gap-1.5 border-b-2 border-green-800"><BadgeCheck size={10}/> Validados</button>
                <button onClick={() => setActiveForm('mix_view')} className="bg-purple-600 text-white px-2.5 py-1.5 rounded-lg font-black uppercase text-[8px] shadow-sm hover:bg-purple-700 transition-all flex items-center gap-1.5 border-b-2 border-purple-800"><FileBarChart size={10}/> Mix</button>
                <button onClick={() => setActiveForm('expense')} className="bg-orange-600 text-white px-2.5 py-1.5 rounded-lg font-black uppercase text-[8px] shadow-sm hover:bg-orange-700 transition-all flex items-center gap-1.5 border-b-2 border-orange-800"><DollarSign size={10}/> Despesa</button>
                <button onClick={() => setActiveForm('cota_config')} className="bg-yellow-500 text-blue-950 px-2.5 py-1.5 rounded-lg font-black uppercase text-[8px] shadow-sm hover:bg-yellow-600 transition-all flex items-center gap-1.5 border-b-2 border-yellow-700"><Calculator size={10}/> Cota</button>
            </div>
        </div>

        {/* SUGESTÃO DE COMPRA (SIMULADOR) */}
        <div className="bg-blue-50 px-4 py-2 border-b border-blue-100 shrink-0">
            <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                    <Lightbulb size={16} className="text-yellow-600" />
                    <span className="text-[10px] font-black uppercase text-blue-900">Sugestão de Compra (OTB):</span>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-[9px] font-bold text-gray-500 uppercase">Inicio Pagto:</span>
                    <select value={simStartMonth} onChange={e => setSimStartMonth(e.target.value)} className="bg-white border rounded px-1 py-0.5 text-[9px] font-black uppercase">
                        {timeline.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
                    </select>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-[9px] font-bold text-gray-500 uppercase">Parcelas:</span>
                    <input type="number" value={simInstallments} onChange={e => setSimInstallments(Math.max(1, parseInt(e.target.value)))} className="w-10 bg-white border rounded px-1 py-0.5 text-[9px] font-black text-center" />
                </div>
                <div className="ml-4 flex items-center gap-2 bg-white px-3 py-1 rounded-lg border border-blue-100">
                    <span className="text-[9px] font-bold text-gray-400 uppercase">Pode comprar hoje:</span>
                    <span className="text-sm font-black text-green-600">{formatCurrency(simulationResult.maxPurchase)}</span>
                    {simulationResult.limitingMonth && <span className="text-[8px] text-red-400 font-bold uppercase">(Limitado por: {simulationResult.limitingMonth})</span>}
                </div>
            </div>
        </div>

        {/* TIMELINE TABLE */}
        <div className="flex-1 overflow-auto bg-white border-t border-gray-100 no-scrollbar">
            <table className="w-full text-center border-separate border-spacing-0 table-fixed min-w-[1500px]">
                <thead className="sticky top-0 z-40">
                    <tr className="bg-blue-900 text-white text-[8px] font-black uppercase h-8">
                        <th className="p-1 w-[160px] text-left sticky left-0 bg-blue-900 z-50">Marca / Identificação</th>
                        <th className="p-1 w-[170px] border-l border-white/10 sticky left-[160px] bg-blue-900 z-50">Resumo</th>
                        {timeline.map(m => <th key={m.key} className="p-1 w-20 border-l border-white/10">{m.label}</th>)}
                    </tr>
                </thead>
                <tbody className="text-[10px] font-bold uppercase">
                    
                    {/* LINHAS DE TOTAIS / OTB */}
                    <tr className="bg-gray-100 border-b h-7">
                        <td className="px-2 text-left sticky left-0 bg-gray-100 z-30 font-black text-gray-500 text-[9px]">META GLOBAL</td>
                        <td className="font-black italic text-gray-500 sticky left-[160px] bg-gray-100 z-30 text-[9px]">{formatCurrency(Number(storeSettings?.budgetValue || 0))}</td>
                        {timeline.map(m => <td key={m.key} className="p-1 text-gray-300">-</td>)}
                    </tr>

                    <tr className="bg-red-50 border-b h-7">
                        <td className="px-2 text-left sticky left-0 bg-red-50 z-30 font-black text-red-600 text-[9px]">GASTOS FIXOS (DIVIDAS)</td>
                        <td className="font-black italic text-red-600 sticky left-[160px] bg-red-50 z-30 text-[9px]">{formatCurrency(consolidated.totalDebtsGlobal)}</td>
                        {timeline.map(m => (
                            <td key={m.key} className="p-1 font-black text-red-600 text-[9px]">{formatCurrency(consolidated.stats[m.key].debts)}</td>
                        ))}
                    </tr>

                    {/* COTA GERENTE */}
                    <tr className="bg-orange-50 border-b h-8 border-t-2 border-orange-200">
                        <td className="px-2 text-left sticky left-0 bg-orange-50 z-30">
                            <div className="font-black text-orange-700 text-[9px]">COTA GERENTE</div>
                            <div className="text-[7px] text-orange-400 font-bold">{storeSettings?.managerPercent || 0}% da Meta Bruta</div>
                        </td>
                        <td className="font-black italic text-orange-700 sticky left-[160px] bg-orange-50 z-30 text-[9px] text-right pr-2">SALDO:</td>
                        {timeline.map(m => (
                            <td key={m.key} className={`p-1 font-black text-[10px] ${consolidated.stats[m.key].balanceManager < 0 ? 'text-red-600' : 'text-orange-700'}`}>
                                {formatCurrency(consolidated.stats[m.key].balanceManager)}
                            </td>
                        ))}
                    </tr>

                    {/* COTA COMPRADOR */}
                    <tr className="bg-blue-50 border-b h-8 border-t-2 border-blue-200">
                        <td className="px-2 text-left sticky left-0 bg-blue-50 z-30">
                            <div className="font-black text-blue-800 text-[9px]">COTA COMPRADOR</div>
                            <div className="text-[7px] text-blue-400 font-bold">Sobra Líquida (Meta - Fixos - Gerente)</div>
                        </td>
                        <td className="font-black italic text-blue-800 sticky left-[160px] bg-blue-50 z-30 text-[9px] text-right pr-2">SALDO:</td>
                        {timeline.map(m => (
                            <td key={m.key} className={`p-1 font-black text-[10px] ${consolidated.stats[m.key].balanceBuyer < 0 ? 'text-red-600 animate-pulse' : 'text-blue-800'}`}>
                                {formatCurrency(consolidated.stats[m.key].balanceBuyer)}
                            </td>
                        ))}
                    </tr>

                    {/* LISTA DE PEDIDOS */}
                    {consolidated.orders.filter(o => o.status === 'ABERTA' || o.status === 'pending').map(order => {
                        const role = String(order.createdByRole || '').toUpperCase();
                        const isManagerOrder = role === 'GERENTE';
                        const isAcessorio = (order.classification || order.category_name)?.toUpperCase().includes('ACESSÓRIO');
                        const qtyType = isAcessorio ? 'UN' : 'PR';

                        return (
                            <tr key={order.id} className="hover:bg-blue-50/50 transition-colors border-b group h-10">
                                <td className="px-2 text-left sticky left-0 bg-white group-hover:bg-blue-50/50 z-30 shadow-sm overflow-hidden">
                                    <div className="flex items-center gap-1.5">
                                        <div className={`w-2 h-2 rounded-full shrink-0 ${isManagerOrder ? 'bg-orange-500' : 'bg-blue-600'} shadow-sm`}></div>
                                        <div className="flex-1 min-w-0">
                                            <div className={`text-[9px] font-black uppercase italic leading-none mb-0.5 truncate ${isManagerOrder ? 'text-orange-700' : 'text-blue-800'}`}>{order.brand}</div>
                                            <div className="text-[7px] text-gray-900 font-bold uppercase leading-none truncate">
                                                {order.classification || order.category_name || 'GERAL'} | {order.pairs || 0}{qtyType}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1 ml-auto opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => onUpdateCota(order.id, { status: 'VALIDADO' })} className="text-green-500 hover:scale-110"><CheckCircle size={12}/></button>
                                            <button onClick={() => onDeleteCota(order.id)} className="text-red-300 hover:text-red-600 hover:scale-110"><Trash2 size={12}/></button>
                                        </div>
                                    </div>
                                </td>
                                <td className="bg-white sticky left-[160px] z-30 group-hover:bg-blue-50/50 shadow-sm text-center">
                                    <div className="text-[9px] font-black text-gray-900 italic">{formatCurrency(order.totalValue)}</div>
                                </td>
                                {timeline.map(m => {
                                    const val = getInstallmentValueForMonth(order, m.key);
                                    return <td key={m.key} className={`p-0.5 border-r border-gray-50 font-black text-[9px] ${val > 0 ? (isManagerOrder ? 'text-orange-600' : 'text-blue-600') : 'text-gray-100'}`}>{val > 0 ? formatCurrency(val) : ''}</td>;
                                })}
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>

        {/* MODAL: MIX DE PRODUTOS */}
        {activeForm === 'mix_view' && (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[100] p-4">
                <div className="bg-[#f8fafc] rounded-[24px] w-full max-w-6xl shadow-2xl overflow-hidden border-t-4 border-purple-600 max-h-[90vh] flex flex-col">
                    <div className="p-3 border-b bg-white flex justify-between items-center shrink-0">
                        <h3 className="text-sm font-black uppercase italic text-blue-950 flex items-center gap-2">
                            <Activity className="text-purple-600" size={16} /> Dashboard <span className="text-purple-600">Mix OTB</span>
                        </h3>
                        <div className="flex items-center gap-2">
                             {isAdmin && (
                                <button onClick={() => setIsEditingMix(!isEditingMix)} className={`p-1.5 rounded-lg transition-all shadow-sm ${isEditingMix ? 'bg-purple-600 text-white' : 'bg-white text-purple-600 border border-purple-100 hover:bg-purple-50'}`}>
                                    {isEditingMix ? <Save size={14} /> : <Settings size={14} />}
                                </button>
                             )}
                             <button onClick={() => { setActiveForm(null); setIsEditingMix(false); }} className="p-1.5 bg-gray-100 text-gray-400 hover:text-red-600 rounded-lg transition-all"><X size={16}/></button>
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar">
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                            {mixHierarchyData.map(seg => (
                                <div key={seg.segment} className="bg-white p-3 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between hover:border-purple-200 transition-all">
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="p-1.5 bg-purple-50 text-purple-600 rounded-lg"><Layers size={14}/></div>
                                        <div className="text-right">
                                            <p className="text-[7px] font-black text-gray-400 uppercase tracking-widest leading-none mb-0.5">Meta</p>
                                            <span className="text-sm font-black text-purple-600 italic tracking-tighter">{seg.metaPercent.toFixed(1)}%</span>
                                        </div>
                                    </div>
                                    <div>
                                        <h4 className="text-[10px] font-black text-blue-950 uppercase italic tracking-tighter mb-1">{seg.segment}</h4>
                                        <div className="space-y-1">
                                            <div className="flex justify-between items-end">
                                                <span className="text-[7px] font-black text-gray-400 uppercase">{formatCurrency(seg.utilizedValue)}</span>
                                                <span className={`text-[8px] font-black italic ${seg.utilizedPercent > seg.metaPercent ? 'text-red-600' : 'text-green-600'}`}>{seg.utilizedPercent.toFixed(1)}%</span>
                                            </div>
                                            <div className="w-full bg-gray-100 rounded-full h-1 overflow-hidden">
                                                <div className={`h-full rounded-full transition-all duration-1000 ${seg.utilizedPercent > seg.metaPercent ? 'bg-red-500' : 'bg-purple-600'}`} style={{width: `${Math.min((seg.utilizedPercent / Math.max(seg.metaPercent, 1)) * 100, 100)}%`}} />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            {mixHierarchyData.map(seg => (
                                <div key={seg.segment} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
                                    <div className="p-2.5 bg-gray-950 text-white flex justify-between items-center">
                                        <h4 className="font-black uppercase italic tracking-widest text-[8px] flex items-center gap-1.5">
                                            <div className="w-1 h-3 bg-purple-500 rounded-full"></div> {seg.segment}
                                        </h4>
                                        <span className="text-[8px] font-black text-purple-400 uppercase tracking-widest">Soma: {seg.metaPercent.toFixed(1)}%</span>
                                    </div>
                                    <div className="p-2.5 space-y-1.5">
                                        {seg.subcategories.map(sub => (
                                            <div key={sub.id} className="flex items-center gap-2 p-2 bg-gray-50 rounded-xl border border-transparent hover:border-purple-100 transition-all">
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-[9px] font-black text-blue-950 uppercase italic leading-none mb-0.5 truncate">{sub.category_name}</p>
                                                    <p className="text-[7px] font-bold text-gray-400 uppercase tracking-widest">{formatCurrency(sub.utilizedValue)}</p>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[9px] font-black text-blue-900 italic">{sub.utilizedPercent.toFixed(1)}%</span>
                                                    <div className="w-px h-3.5 bg-gray-200"></div>
                                                    <div className="w-14">
                                                        {isEditingMix ? (
                                                            <input type="text" defaultValue={sub.metaPercent} onBlur={(e) => handleUpdateMix(sub.category_name, e.target.value)} className="w-full p-0.5 bg-white border border-purple-200 rounded text-center text-[9px] font-black text-purple-600 outline-none" />
                                                        ) : (
                                                            <span className="text-[9px] font-black text-purple-600 italic">{sub.metaPercent.toFixed(1)}%</span>
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
            </div>
        )}

        {/* MODAL: NOVO PEDIDO */}
        {activeForm === 'order' && (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[100] p-4">
                <div className="bg-white rounded-[24px] w-full max-w-xl shadow-2xl overflow-hidden border-t-4 border-blue-900 max-h-[90vh] overflow-y-auto no-scrollbar">
                    <div className="p-4 border-b bg-gray-50/50 flex justify-between items-center">
                        <h3 className="text-sm font-black uppercase italic text-blue-950 flex items-center gap-2"><Plus className="text-red-600" size={16} /> Novo <span className="text-red-600">Pedido</span></h3>
                        <button onClick={() => setActiveForm(null)} className="text-gray-400 hover:text-red-600"><X size={18}/></button>
                    </div>
                    <form onSubmit={handleSaveOrder} className="p-4 space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <label className="text-[8px] font-black text-gray-400 uppercase ml-2">Marca</label>
                                <input required value={brand} onChange={e => setBrand(e.target.value)} className="w-full p-2 bg-gray-50 rounded-xl font-black text-gray-900 uppercase italic shadow-inner outline-none text-[10px]" placeholder="EX: VIZZANO" />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[8px] font-black text-gray-400 uppercase ml-2">Classificação</label>
                                <select required value={selectedCategoryId} onChange={e => setSelectedCategoryId(e.target.value)} className="w-full p-2 bg-gray-50 rounded-xl font-black text-gray-900 uppercase outline-none text-[9px]">
                                    <option value="">SELECIONE...</option>
                                    {(Object.entries(groupedCategories) as [string, QuotaCategory[]][]).map(([parent, cats]) => (
                                        <optgroup key={parent} label={parent}>
                                            {cats.map(c => <option key={c.id} value={c.id}>{c.category_name}</option>)}
                                        </optgroup>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                            <div className="space-y-1">
                                <label className="text-[8px] font-black text-gray-400 uppercase ml-2">Embarque</label>
                                <select value={shipmentMonth} onChange={e => setShipmentMonth(e.target.value)} className="w-full p-2 bg-gray-50 rounded-xl font-black text-gray-900 outline-none text-[9px]">
                                    {timeline.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
                                </select>
                            </div>
                            <div className="space-y-1">
                                <label className="text-[8px] font-black text-gray-400 uppercase ml-2">Prazos</label>
                                <input required value={paymentTerms} onChange={e => setPaymentTerms(e.target.value)} className="w-full p-2 bg-gray-50 rounded-xl font-black text-gray-900 text-center outline-none text-[9px]" />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[8px] font-black text-gray-400 uppercase ml-2">Valor (R$)</label>
                                <input required value={totalValue} onChange={e => setTotalValue(e.target.value)} className="w-full p-2 bg-blue-50/50 rounded-xl font-black text-blue-900 text-xs text-center shadow-inner outline-none" placeholder="0,00" />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <label className="text-[8px] font-black text-gray-400 uppercase ml-2">Qtd</label>
                                <input value={pairs} onChange={e => setPairs(e.target.value.replace(/\D/g, ''))} className="w-full p-2 bg-gray-50 rounded-xl font-black text-gray-900 text-center outline-none text-[10px]" placeholder="0" />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[8px] font-black text-gray-400 uppercase ml-2">Perfil</label>
                                <div className="flex bg-gray-100 p-1 rounded-xl">
                                    <button type="button" onClick={() => setOrderCreatedByRole('COMPRADOR')} className={`flex-1 py-1 rounded-lg font-black text-[8px] uppercase transition-all ${orderCreatedByRole === 'COMPRADOR' ? 'bg-blue-900 text-white' : 'text-gray-400'}`}>Comp</button>
                                    <button type="button" onClick={() => setOrderCreatedByRole('GERENTE')} className={`flex-1 py-1 rounded-lg font-black text-[8px] uppercase transition-all ${orderCreatedByRole === 'GERENTE' ? 'bg-orange-600 text-white' : 'text-gray-400'}`}>Ger</button>
                                </div>
                            </div>
                        </div>
                        {isAdmin && (
                            <div className="bg-gray-50 p-2 rounded-xl border border-gray-100 shadow-inner">
                                <label className="text-[8px] font-black text-blue-900 uppercase italic ml-2 mb-1 block">Unidades</label>
                                <div className="grid grid-cols-5 gap-1 max-h-20 overflow-y-auto no-scrollbar">
                                    {activeStores.map(s => (
                                        <button key={s.id} type="button" onClick={() => setSelectedStoresForOrder(prev => prev.includes(s.id) ? prev.filter(id => id !== s.id) : [...prev, s.id])} className={`p-1 rounded-lg text-[7px] font-black uppercase border-2 transition-all ${selectedStoresForOrder.includes(s.id) ? 'bg-blue-900 border-blue-900 text-white' : 'bg-white border-gray-100 text-gray-400'}`}>{s.number}</button>
                                    ))}
                                </div>
                            </div>
                        )}
                        <button type="submit" disabled={isSubmitting} className="w-full py-2.5 bg-red-600 text-white rounded-xl font-black uppercase text-[9px] shadow-lg active:scale-95 transition-all border-b-4 border-red-900 flex items-center justify-center gap-2">
                            {isSubmitting ? <Loader2 className="animate-spin" size={12} /> : <Save size={12}/>} SALVAR PEDIDO
                        </button>
                    </form>
                </div>
            </div>
        )}

        {/* MODAL: DESPESAS */}
        {activeForm === 'expense' && (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[100] p-4">
                <div className="bg-white rounded-[24px] w-full max-w-xl shadow-2xl animate-in zoom-in duration-300 overflow-hidden border-t-4 border-orange-600 max-h-[90vh] flex flex-col">
                    <div className="p-4 border-b bg-gray-50/50 flex justify-between items-center">
                        <h3 className="text-sm font-black uppercase italic text-blue-950 flex items-center gap-2"><DollarSign className="text-orange-600" size={18} /> Gastos <span className="text-orange-600">Fixos</span></h3>
                        <button onClick={() => setActiveForm(null)} className="text-gray-400 hover:text-red-600 transition-all"><X size={20}/></button>
                    </div>
                    <form onSubmit={handleSaveAllExpenses} className="flex-1 overflow-y-auto no-scrollbar p-4">
                        <div className="grid grid-cols-2 gap-3 pr-1.5">
                            {timeline.map(m => (
                                <div key={m.key} className="bg-gray-50 p-2 rounded-xl border border-gray-100 shadow-sm group hover:border-orange-200 transition-all">
                                    <label className="text-[7px] font-black text-gray-400 uppercase tracking-widest mb-1 block group-hover:text-orange-600 transition-colors">{m.label}</label>
                                    <div className="relative">
                                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-orange-400 text-[9px] font-black">R$</span>
                                        <input 
                                            value={semesterDebts[m.key] || ''} 
                                            onChange={e => setSemesterDebts({...semesterDebts, [m.key]: e.target.value})} 
                                            className="w-full pl-6 pr-1.5 py-1.5 bg-white border border-gray-200 rounded-lg text-[10px] font-black text-blue-900 outline-none focus:ring-2 focus:ring-orange-50"
                                            placeholder="0,00"
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                        <button type="submit" disabled={isSubmitting} className="w-full mt-4 py-2.5 bg-orange-600 text-white rounded-xl font-black uppercase text-[9px] shadow-lg active:scale-95 transition-all border-b-4 border-orange-900 flex items-center justify-center gap-2">
                            {isSubmitting ? <Loader2 className="animate-spin" size={14} /> : <Save size={14}/>} ATUALIZAR DESPESAS
                        </button>
                    </form>
                </div>
            </div>
        )}

        {/* MODAL: CONFIGURAÇÃO DE COTA */}
        {activeForm === 'cota_config' && (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[100] p-4">
                <div className="bg-white rounded-[24px] w-full max-w-sm shadow-2xl animate-in zoom-in duration-300 overflow-hidden border-t-4 border-yellow-500">
                    <div className="p-4 border-b bg-gray-50/50 flex justify-between items-center">
                        <h3 className="text-sm font-black uppercase italic text-blue-950 flex items-center gap-2"><Calculator className="text-yellow-500" size={18} /> Configurar <span className="text-yellow-600">OTB</span></h3>
                        <button onClick={() => setActiveForm(null)} className="text-gray-400 hover:text-red-600 transition-all"><X size={20}/></button>
                    </div>
                    <form onSubmit={handleSaveCotaSettings} className="p-6 space-y-4">
                        <div className="space-y-1.5">
                            <label className="text-[9px] font-black text-gray-400 uppercase ml-2 tracking-widest">Verba Global</label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300 font-black text-[10px]">R$</span>
                                <input 
                                    required 
                                    value={budgetVal} 
                                    onChange={e => setBudgetVal(e.target.value)} 
                                    className="w-full pl-8 pr-3 py-3 bg-gray-50 border-none rounded-xl font-black text-blue-950 text-lg shadow-inner outline-none focus:ring-4 focus:ring-yellow-50"
                                    placeholder="0,00"
                                />
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[9px] font-black text-gray-400 uppercase ml-2 tracking-widest">Partilha Gerente (%)</label>
                            <input 
                                required 
                                value={managerPct} 
                                onChange={e => setManagerPct(e.target.value)} 
                                className="w-full p-3 bg-gray-50 border-none rounded-xl font-black text-orange-600 text-lg shadow-inner outline-none text-center focus:ring-4 focus:ring-yellow-50"
                                placeholder="20"
                            />
                        </div>
                        <button type="submit" disabled={isSubmitting} className="w-full py-3 bg-yellow-500 text-blue-950 rounded-xl font-black uppercase text-[9px] shadow-lg active:scale-95 transition-all border-b-4 border-yellow-700 flex items-center justify-center gap-2">
                            {isSubmitting ? <Loader2 className="animate-spin" size={14} /> : <Save size={14}/>} SALVAR CONFIGURAÇÃO
                        </button>
                    </form>
                </div>
            </div>
        )}

        {/* MODAL: VALIDADOS */}
        {activeForm === 'validated_orders' && (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[100] p-4">
                <div className="bg-white rounded-[24px] w-full max-w-4xl shadow-2xl animate-in zoom-in duration-300 overflow-hidden border-t-8 border-green-600 max-h-[90vh] flex flex-col">
                    <div className="p-4 border-b bg-gray-50/50 flex justify-between items-center">
                        <h3 className="text-sm font-black uppercase italic text-blue-950 flex items-center gap-2"><BadgeCheck className="text-green-600" size={18} /> Pedidos <span className="text-green-600">Validados</span></h3>
                        <div className="flex gap-2">
                             <button onClick={handlePrintValidated} className="p-1.5 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-all"><Printer size={16}/></button>
                             <button onClick={() => setActiveForm(null)} className="p-1.5 bg-gray-50 text-gray-400 hover:text-red-600 rounded-lg transition-all"><X size={16}/></button>
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto no-scrollbar">
                        <table className="w-full text-left">
                            <thead className="bg-white sticky top-0 z-10 border-b border-gray-100 text-[9px] font-black text-gray-400 uppercase tracking-widest">
                                <tr>
                                    <th className="px-4 py-3">Identificação</th>
                                    <th className="px-4 py-3">Embarque</th>
                                    <th className="px-4 py-3 text-right">Valor Total</th>
                                    <th className="px-4 py-3 text-center">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50 font-bold text-[10px]">
                                {consolidated.orders.filter(o => o.status === 'VALIDADO' || o.status === 'validated' || o.status === 'FECHADA').map(order => (
                                    <tr key={order.id} className="hover:bg-gray-50 transition-all group">
                                        <td className="px-4 py-2">
                                            <div className="font-black text-gray-900 uppercase italic tracking-tighter leading-none">{order.brand}</div>
                                            <div className="text-[8px] text-gray-400 uppercase mt-0.5 italic">{order.classification || order.category_name}</div>
                                        </td>
                                        <td className="px-4 py-2"><span className="text-[9px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full uppercase">{getMonthNameFromKey(order.shipmentDate)}</span></td>
                                        <td className="px-4 py-2 text-right font-black text-blue-950 text-xs italic">{formatCurrency(order.totalValue)}</td>
                                        <td className="px-4 py-2 text-center">
                                            <div className="flex justify-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                                                <button onClick={() => onUpdateCota(order.id, { status: 'ABERTA' })} className="p-1.5 text-orange-600 hover:bg-orange-50 rounded-lg"><ArrowDownRight size={16}/></button>
                                                <button onClick={() => onDeleteCota(order.id)} className="p-1.5 text-red-300 hover:text-red-600 rounded-lg"><Trash2 size={16}/></button>
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