import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
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

// ─────────────────────────────────────────────
// CONSTANTES DE MÓDULO (fora do componente)
// ─────────────────────────────────────────────

const FULL_MONTH_NAMES = [
  'JANEIRO', 'FEVEREIRO', 'MARÇO', 'ABRIL', 'MAIO', 'JUNHO',
  'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO',
];
const SHORT_MONTHS_DISPLAY = [
  'JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN',
  'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ',
];

/** Status válidos para pedidos */
const ORDER_STATUS = {
  OPEN: ['ABERTA', 'pending'] as const,
  VALIDATED: ['VALIDADO', 'validated', 'FECHADA'] as const,
} as const;

const isValidatedOrder = (o: Cota): boolean =>
  (ORDER_STATUS.VALIDATED as readonly string[]).includes(o.status);

const isOpenOrder = (o: Cota): boolean =>
  (ORDER_STATUS.OPEN as readonly string[]).includes(o.status);

const isManagerRole = (role: string | undefined): boolean => {
  const r = String(role ?? '').trim().toUpperCase();
  return r === 'GERENTE' || r === 'MANAGER';
};

/** Gera 12 meses a partir do mês atual — calculado UMA vez no módulo */
const generateTimeline = (): { label: string; key: string; monthIndex: number }[] => {
  const now = new Date();
  const startMonth = now.getMonth();
  const startYear = now.getFullYear();

  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date(startYear, startMonth + i, 1);
    const mIndex = d.getMonth();
    const year = d.getFullYear();
    return {
      label: `${SHORT_MONTHS_DISPLAY[mIndex]}-${String(year).slice(-2)}`,
      key: `${year}-${String(mIndex + 1).padStart(2, '0')}`,
      monthIndex: mIndex,
    };
  });
};

// ✅ Gerado fora do componente — não recalcula a cada render
const TIMELINE = generateTimeline();

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────

const getMonthNameFromKey = (key: string): string => {
  if (!key) return '-';
  const parts = key.split('-');
  if (parts.length < 2) return key;
  const idx = parseInt(parts[1]) - 1;
  return FULL_MONTH_NAMES[idx] ?? key;
};

const getInstallmentValueForMonth = (order: Cota, monthKey: string): number => {
  if (!order.installments) return 0;
  if (Array.isArray(order.installments)) return 0;
  return (order.installments as Record<string, number>)[monthKey] ?? 0;
};

const calculateInstallmentsMap = (
  shipmentMonthKey: string,
  terms: string,
  totalValue: number
): Record<string, number> => {
  const termDays = terms
    .split('/')
    .map(t => parseInt(t.trim()))
    .filter(t => !isNaN(t));

  if (termDays.length === 0) return { [shipmentMonthKey]: totalValue };

  const [year, month] = shipmentMonthKey.split('-').map(Number);
  const installments: Record<string, number> = {};
  const perInstallment = totalValue / termDays.length;
  let sumAdded = 0;

  termDays.forEach((days, index) => {
    const monthsToAdd = Math.floor(days / 30);
    const d = new Date(year, (month - 1) + monthsToAdd, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

    // Garante que o último parcela fecha exatamente o total (sem centavos perdidos)
    const value =
      index === termDays.length - 1
        ? parseFloat((totalValue - sumAdded).toFixed(2))
        : parseFloat(perInstallment.toFixed(2));

    installments[key] = parseFloat(((installments[key] ?? 0) + value).toFixed(2));
    sumAdded += value;
  });

  return installments;
};

const normalizeText = (text: string): string =>
  String(text ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .trim();

// ─────────────────────────────────────────────
// ÍCONES POR CATEGORIA
// ─────────────────────────────────────────────

const getCategoryIcon = (category: string) => {
  const norm = normalizeText(category);
  if (norm.includes('FEMININO')) return <ShoppingBag size={14} />;
  if (norm.includes('MASCULINO')) return <Shirt size={14} />;
  if (norm.includes('INFANTIL')) return <Smile size={14} />;
  if (norm.includes('ACESSORIO')) return <Watch size={14} />;
  return <Layers size={14} />;
};

// ─────────────────────────────────────────────
// SEMÁFORO DE CORES
// ─────────────────────────────────────────────

const getTrafficLightStyle = (utilizationRatio: number, isActive: boolean) => {
  if (!isActive) return { text: 'text-gray-400', bar: 'bg-gray-300' };
  if (utilizationRatio >= 99) return { text: 'text-red-600', bar: 'bg-red-500' };
  if (utilizationRatio >= 70) return { text: 'text-amber-600', bar: 'bg-amber-500' };
  return { text: 'text-emerald-600', bar: 'bg-emerald-500' };
};

// ─────────────────────────────────────────────
// TIPOS INTERNOS
// ─────────────────────────────────────────────

interface MonthStats {
  limitManager: number;
  limitBuyer: number;
  usedManager: number;
  usedBuyer: number;
  balanceManager: number;
  balanceBuyer: number;
  debts: number;
  pendingInstallmentSum: number;
}

interface ToastState {
  msg: string;
  type: 'success' | 'error';
}

// ─────────────────────────────────────────────
// HOOK: useConsolidated
// ─────────────────────────────────────────────

const useConsolidated = (
  cotas: Cota[],
  cotaSettings: CotaSettings[],
  cotaDebts: CotaDebts[],
  viewStoreId: string
) => {
  return useMemo(() => {
    const storeOrders = cotas.filter(p => p.storeId === viewStoreId);
    const storeDebts = cotaDebts.filter(d => d.storeId === viewStoreId);
    const settings = cotaSettings.find(s => s.storeId === viewStoreId);

    const budgetTotal = Number(settings?.budgetValue ?? 0);
    const managerRatio = (settings?.managerPercent ?? 0) / 100;
    const limitManager = budgetTotal * managerRatio;

    // ✅ Totais globais calculados UMA vez (bug anterior: somava 12x dentro do loop de meses)
    const totalBuyerValidGlobal = storeOrders
      .filter(o => isValidatedOrder(o) && !isManagerRole(o.createdByRole))
      .reduce((s, o) => s + Number(o.totalValue), 0);

    const totalManagerValidGlobal = storeOrders
      .filter(o => isValidatedOrder(o) && isManagerRole(o.createdByRole))
      .reduce((s, o) => s + Number(o.totalValue), 0);

    const totalDebtsGlobal = storeDebts.reduce((s, d) => s + Number(d.value), 0);

    const stats: Record<string, MonthStats> = {};

    for (const m of TIMELINE) {
      const monthlyDebts = storeDebts
        .filter(d => d.month === m.key)
        .reduce((s, d) => s + Number(d.value), 0);

      const limitBuyer = Math.max(0, budgetTotal - monthlyDebts - limitManager);

      let usedBuyer = 0;
      let usedManager = 0;
      let pendingInstallmentSum = 0;

      for (const p of storeOrders) {
        const val = getInstallmentValueForMonth(p, m.key);
        if (val === 0) continue;

        const manager = isManagerRole(p.createdByRole);

        if (isValidatedOrder(p) || isOpenOrder(p)) {
          if (manager) usedManager += val;
          else usedBuyer += val;
        }
        if (isOpenOrder(p)) {
          pendingInstallmentSum += val;
        }
      }

      stats[m.key] = {
        limitManager,
        limitBuyer,
        usedManager,
        usedBuyer,
        balanceManager: limitManager - usedManager,
        balanceBuyer: limitBuyer - usedBuyer,
        debts: monthlyDebts,
        pendingInstallmentSum,
      };
    }

    return {
      orders: storeOrders,
      stats,
      debts: storeDebts,
      totalBuyerValidGlobal,
      totalManagerValidGlobal,
      totalDebtsGlobal,
    };
  }, [cotas, cotaSettings, cotaDebts, viewStoreId]);
};

// ─────────────────────────────────────────────
// HOOK: useSimulation
// ─────────────────────────────────────────────

const useSimulation = (
  stats: Record<string, MonthStats>,
  simStartMonth: string,
  simInstallments: number
) => {
  return useMemo(() => {
    if (!simStartMonth || simInstallments <= 0) return { maxPurchase: 0, limitingMonth: '' };

    const startIndex = TIMELINE.findIndex(t => t.key === simStartMonth);
    if (startIndex === -1) return { maxPurchase: 0, limitingMonth: '' };

    let minAvailable = Infinity;
    let limitingMonthLabel = '';

    for (let i = 0; i < simInstallments; i++) {
      const idx = startIndex + i;
      if (idx >= TIMELINE.length) break;

      const available = stats[TIMELINE[idx].key]?.balanceBuyer ?? 0;
      if (available < minAvailable) {
        minAvailable = available;
        limitingMonthLabel = TIMELINE[idx].label;
      }
    }

    return {
      maxPurchase: Math.max(0, minAvailable) * simInstallments,
      limitingMonth: limitingMonthLabel,
    };
  }, [stats, simStartMonth, simInstallments]);
};

// ─────────────────────────────────────────────
// HOOK: useMixData
// ─────────────────────────────────────────────

const SEGMENTS = ['FEMININO', 'MASCULINO', 'INFANTIL', 'ACESSÓRIO'] as const;
type Semester = 'all' | '1' | '2';

const useMixData = (
  productCategories: QuotaCategory[],
  mixParameters: QuotaMixParameter[],
  cotas: Cota[],
  viewStoreId: string,
  budget: number,
  semester: Semester
) => {
  return useMemo(() => {
    // ✅ Filtrar pedidos UMA vez fora do loop de segmentos
    const relevantOrders = cotas.filter(o => {
      if (o.storeId !== viewStoreId) return false;
      if (semester === 'all') return true;
      const month = o.shipmentDate ? parseInt(o.shipmentDate.split('-')[1] ?? '0') : 0;
      if (!month) return false;
      return semester === '1' ? month <= 6 : month >= 7;
    });

    // ✅ Map de categorias por pai para lookup O(1) em vez de filter O(n) por segmento
    const catsByParent = new Map<string, QuotaCategory[]>();
    for (const c of productCategories) {
      const key = normalizeText(c.parent_category);
      const arr = catsByParent.get(key) ?? [];
      arr.push(c);
      catsByParent.set(key, arr);
    }

    return SEGMENTS.map(segName => {
      const normSeg = normalizeText(segName);

      const segParam = mixParameters.find(m => {
        if (!m) return false;
        const storeMatch = m.store_id === viewStoreId || m.storeId === viewStoreId;
        const catMatch = normalizeText(m.category_name) === normSeg;
        const semMatch = semester === 'all' ? true : m.semester === Number(semester);
        return storeMatch && catMatch && semMatch;
      });

      const metaPercent = segParam?.percentage ?? 0;
      const subCats = catsByParent.get(normSeg) ?? [];

      // Sets para lookup O(1) na filtragem de genéricos
      const subCatIds = new Set(subCats.map(c => String(c.id)));
      const subCatNames = new Set(subCats.map(c => normalizeText(c.category_name)));

      let segTotal = 0;

      const subcategories = subCats.map(cat => {
        const targetId = String(cat.id);
        const targetName = normalizeText(cat.category_name);

        const value = relevantOrders
          .filter(o => {
            const oId = String(o.category_id ?? '');
            const oName = normalizeText(o.category_name ?? '');
            const oClass = normalizeText(o.classification ?? '');
            return oId === targetId || oName === targetName || oClass === targetName;
          })
          .reduce((s, o) => s + Number(o.totalValue ?? 0), 0);

        segTotal += value;
        return { id: cat.id, category_name: cat.category_name, utilizedValue: value };
      });

      // Pedidos genéricos do segmento sem subcategoria específica
      const genericValue = relevantOrders
        .filter(o => {
          const oName = normalizeText(o.category_name ?? o.classification ?? '');
          const oId = String(o.category_id ?? '');
          return oName === normSeg && !subCatIds.has(oId) && !subCatNames.has(oName);
        })
        .reduce((s, o) => s + Number(o.totalValue ?? 0), 0);

      segTotal += genericValue;

      // Ordenação inteligente
      subcategories.sort((a, b) => {
        const aHas = a.utilizedValue > 0;
        const bHas = b.utilizedValue > 0;
        if (aHas !== bHas) return aHas ? -1 : 1;
        if (aHas) return b.utilizedValue - a.utilizedValue;
        return a.category_name.localeCompare(b.category_name);
      });

      const utilizedPercent = budget > 0 ? (segTotal / budget) * 100 : 0;
      const utilizationOfQuota = metaPercent > 0 ? (utilizedPercent / metaPercent) * 100 : 0;

      return { segment: segName, metaPercent, utilizedValue: segTotal, utilizedPercent, utilizationOfQuota, subcategories };
    });
  }, [productCategories, mixParameters, cotas, viewStoreId, budget, semester]);
};

// ─────────────────────────────────────────────
// HOOK: useToast
// ─────────────────────────────────────────────

const useToast = () => {
  const [toast, setToast] = useState<ToastState | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((msg: string, type: 'success' | 'error' = 'success') => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setToast({ msg, type });
    timerRef.current = setTimeout(() => setToast(null), 3200);
  }, []);

  return { toast, showToast };
};

// ─────────────────────────────────────────────
// SUB-COMPONENTE: Toast
// ─────────────────────────────────────────────

const Toast: React.FC<{ toast: ToastState | null }> = ({ toast }) => {
  if (!toast) return null;
  return (
    <div
      className={`fixed bottom-6 right-6 z-[200] flex items-center gap-3 px-4 py-3 rounded-2xl shadow-2xl font-black text-[11px] uppercase tracking-wide transition-all animate-in slide-in-from-bottom-4 duration-300
        ${toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}
    >
      {toast.type === 'success' ? <CheckCircle size={14} /> : <AlertTriangle size={14} />}
      {toast.msg}
    </div>
  );
};

// ─────────────────────────────────────────────
// INTERFACES DO COMPONENTE PRINCIPAL
// ─────────────────────────────────────────────

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
  onUpdateMixParameter?: (
    id: string | null,
    storeId: string,
    category: string,
    percent: number,
    semester: number
  ) => Promise<void>;
  can: (permissionKey: string) => boolean;
}

// ─────────────────────────────────────────────
// COMPONENTE PRINCIPAL
// ─────────────────────────────────────────────

export const CotasManagement: React.FC<CotasManagementProps> = ({
  user, stores, cotas, cotaSettings, cotaDebts,
  productCategories = [], mixParameters = [],
  onAddCota, onUpdateCota, onDeleteCota,
  onSaveSettings, onSaveDebts, onDeleteDebt,
  onUpdateMixParameter,
  can,
}) => {
  if (!stores || stores.length === 0) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="animate-spin text-blue-600" size={32} />
        <p className="ml-3 text-sm font-bold text-gray-400">Carregando lojas...</p>
      </div>
    );
  }

  const isAdmin = user.role === UserRole.ADMIN;
  const isManager = user.role === UserRole.MANAGER;
  const { toast, showToast } = useToast();

  // ── Loja visualizada ──────────────────────
  const activeStores = useMemo(
    () => (stores ?? [])
      .filter(s => s.status === 'active')
      .sort((a, b) => (parseInt(a.number) || 0) - (parseInt(b.number) || 0)),
    [stores]
  );

  const [manualStoreId, setManualStoreId] = useState<string>('');
  const viewStoreId = isAdmin
    ? (manualStoreId || activeStores[0]?.id || '')
    : (user.storeId || '');

  // ── Estados de UI ─────────────────────────
  const [activeForm, setActiveForm] = useState<
    'order' | 'expense' | 'cota_config' | 'validated_orders' | 'mix_view' | null
  >(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEditingMix, setIsEditingMix] = useState(false);
  const [mixFilterSemester, setMixFilterSemester] = useState<Semester>('all');
  const [selectedMobileMonth, setSelectedMobileMonth] = useState(TIMELINE[0].key);

  // ── Estado: Formulário de Pedido ──────────
  const [brand, setBrand] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [shipmentMonth, setShipmentMonth] = useState(TIMELINE[0].key);
  const [paymentTerms, setPaymentTerms] = useState('30/60/90');
  const [totalValue, setTotalValue] = useState('');
  const [pairs, setPairs] = useState('');
  const [selectedStoresForOrder, setSelectedStoresForOrder] = useState<string[]>([]);
  const [orderCreatedByRole, setOrderCreatedByRole] = useState<'COMPRADOR' | 'GERENTE'>('COMPRADOR');

  // ── Estado: Simulador ─────────────────────
  const [simStartMonth, setSimStartMonth] = useState(TIMELINE[0].key);
  const [simInstallments, setSimInstallments] = useState(3);

  // ── Estado: Despesas ──────────────────────
  const [semesterDebts, setSemesterDebts] = useState<Record<string, string>>({});

  // ── Estado: Configuração de Cota ─────────
  const [budgetVal, setBudgetVal] = useState('');
  const [managerPct, setManagerPct] = useState('');

  // ── Dados consolidados (hook otimizado) ───
  const consolidated = useConsolidated(cotas, cotaSettings, cotaDebts, viewStoreId);
  const storeSettings = useMemo(
    () => cotaSettings.find(s => s.storeId === viewStoreId),
    [cotaSettings, viewStoreId]
  );

  // ── Simulação OTB ─────────────────────────
  const simulationResult = useSimulation(consolidated.stats, simStartMonth, simInstallments);

  // ── Mix OTB ───────────────────────────────
  const mixHierarchyData = useMixData(
    productCategories,
    mixParameters,
    cotas,
    viewStoreId,
    Number(storeSettings?.budgetValue ?? 0),
    mixFilterSemester
  );

  // ── Categorias agrupadas por pai ──────────
  const groupedCategories = useMemo(() => {
    const groups: Record<string, QuotaCategory[]> = {};
    (productCategories ?? []).forEach(c => {
      const parent = c.parent_category || 'OUTROS';
      (groups[parent] ??= []).push(c);
    });
    return groups;
  }, [productCategories]);

  // ── Effects ───────────────────────────────

  // Preenche configurações ao abrir modal
  useEffect(() => {
    if (storeSettings) {
      setBudgetVal(String(storeSettings.budgetValue ?? ''));
      setManagerPct(String(storeSettings.managerPercent ?? ''));
    }
  }, [storeSettings]);

  // Preenche despesas ao abrir modal de expense
  useEffect(() => {
    if (activeForm !== 'expense') return;
    const initial: Record<string, string> = {};
    TIMELINE.forEach(m => {
      const existing = cotaDebts.find(d => d.storeId === viewStoreId && d.month === m.key);
      initial[m.key] = existing ? String(existing.value) : '';
    });
    setSemesterDebts(initial);
  }, [activeForm, viewStoreId]); // ✅ cotaDebts removido — evita loop se o pai recriar o array

  // Reseta loja selecionada no formulário ao trocar de loja
  useEffect(() => {
    setSelectedStoresForOrder([viewStoreId]);
  }, [viewStoreId]);

  // ── Etiqueta de embarque reverso (Simulador) ──
  const calculatedShipmentLabel = useMemo(() => {
    if (!simStartMonth) return null;
    const [year, month] = simStartMonth.split('-').map(Number);
    const d30 = new Date(year, month - 2, 1);
    const d90 = new Date(year, month - 4, 1);
    return (
      <div className="flex flex-col leading-none ml-2">
        <span className="text-[9px] font-black text-blue-800 uppercase">EMBARQUE:</span>
        <div className="flex gap-2 text-[10px]">
          <span className="text-gray-400 font-bold">{SHORT_MONTHS_DISPLAY[d30.getMonth()]} (30d)</span>
          <span className="text-orange-600 font-black">{SHORT_MONTHS_DISPLAY[d90.getMonth()]} (90d)</span>
        </div>
      </div>
    );
  }, [simStartMonth]);

  // ── Handlers ─────────────────────────────

  const handleSaveOrder = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(totalValue.replace(',', '.'));
    if (!brand || !selectedCategoryId || isNaN(val) || selectedStoresForOrder.length === 0) return;

    setIsSubmitting(true);
    try {
      const installmentsMap = calculateInstallmentsMap(shipmentMonth, paymentTerms, val);
      const category = productCategories.find(c => c.id === selectedCategoryId);

      await Promise.all(
        selectedStoresForOrder.map(storeId =>
          onAddCota({
            id: `tmp-${Date.now()}-${storeId}`,
            storeId,
            brand: brand.toUpperCase().trim(),
            category_id: selectedCategoryId,
            category_name: category?.category_name ?? 'GERAL',
            totalValue: val,
            shipmentDate: shipmentMonth,
            paymentTerms: paymentTerms.trim(),
            pairs: parseInt(pairs) || 0,
            installments: installmentsMap,
            createdByRole: orderCreatedByRole,
            status: 'ABERTA',
            createdAt: new Date(),
          })
        )
      );

      setBrand('');
      setTotalValue('');
      setPairs('');
      setActiveForm(null);
      showToast('Pedido(s) registrado(s) com sucesso!');
    } catch (err: any) {
      showToast('Erro ao salvar pedido: ' + (err?.message ?? 'Tente novamente.'), 'error');
    } finally {
      setIsSubmitting(false);
    }
  }, [brand, selectedCategoryId, totalValue, selectedStoresForOrder, shipmentMonth, paymentTerms, pairs, orderCreatedByRole, productCategories, onAddCota, showToast]);

  const handleSaveAllExpenses = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await Promise.all(
        Object.entries(semesterDebts).map(([month, valueStr]) => {
          const val = parseFloat(String(valueStr).replace(',', '.')) || 0;
          return onSaveDebts({ storeId: viewStoreId, month, value: val });
        })
      );
      setActiveForm(null);
      showToast('Despesas atualizadas com sucesso!');
    } catch {
      showToast('Erro ao salvar despesas.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  }, [semesterDebts, viewStoreId, onSaveDebts, showToast]);

  const handleSaveCotaSettings = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(String(budgetVal).replace(',', '.'));
    const pct = parseFloat(String(managerPct).replace(',', '.'));
    if (isNaN(val) || isNaN(pct)) return;

    setIsSubmitting(true);
    try {
      await onSaveSettings({ storeId: viewStoreId, budgetValue: val, managerPercent: pct });
      setActiveForm(null);
      showToast('Cota configurada com sucesso!');
    } catch {
      showToast('Erro ao salvar configuração.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  }, [budgetVal, managerPct, viewStoreId, onSaveSettings, showToast]);

  const handleUpdateMix = useCallback(async (category: string, value: string) => {
    if (!onUpdateMixParameter) return;
    if (mixFilterSemester === 'all') {
      showToast('Selecione um semestre para editar o mix', 'error');
      return;
    }

    const percent = parseFloat(value.replace(',', '.')) || 0;
    const currentSemester = Number(mixFilterSemester);

    const existing = mixParameters.find(p =>
      (p.store_id === viewStoreId || p.storeId === viewStoreId) &&
      normalizeText(p.category_name) === normalizeText(category) &&
      p.semester === currentSemester
    );

    try {
      await onUpdateMixParameter(existing?.id ?? null, viewStoreId, category, percent, currentSemester);
      showToast('Mix atualizado!');
    } catch {
      showToast('Erro ao atualizar mix.', 'error');
    }
  }, [onUpdateMixParameter, mixFilterSemester, mixParameters, viewStoreId, showToast]);

  const toggleStoreForOrder = useCallback((storeId: string) => {
    setSelectedStoresForOrder(prev =>
      prev.includes(storeId) ? prev.filter(id => id !== storeId) : [...prev, storeId]
    );
  }, []);

  const handlePrintValidated = useCallback(() => {
    const printWindow = window.open('', '_blank', 'width=1000,height=1200');
    if (!printWindow) return;

    const store = stores.find(s => s.id === viewStoreId);
    const grouped: Record<string, Cota[]> = {};

    consolidated.orders
      .filter(isValidatedOrder)
      .forEach(o => {
        (grouped[o.shipmentDate] ??= []).push(o);
      });

    const rows = Object.entries(grouped)
      .map(([date, items]) => `
        <div style="margin-bottom:25px;">
          <h3 style="background:#1e3a8a;color:white;padding:8px 12px;font-size:12px;font-weight:900;text-transform:uppercase;border-radius:4px;">
            EMBARQUE: ${getMonthNameFromKey(date)}
          </h3>
          <table style="width:100%;border-collapse:collapse;font-size:11px;margin-top:10px;">
            <thead>
              <tr style="border-bottom:2px solid #000;text-align:left;background:#f4f4f4;">
                <th style="padding:8px;">MARCA</th>
                <th style="padding:8px;text-align:center;">GESTOR</th>
                <th style="padding:8px;">CLASSIFICAÇÃO</th>
                <th style="padding:8px;text-align:center;">QTD</th>
                <th style="padding:8px;text-align:right;">VALOR TOTAL</th>
              </tr>
            </thead>
            <tbody>
              ${items.map(i => `
                <tr style="border-bottom:1px solid #eee;">
                  <td style="padding:8px;"><b>${i.brand}</b></td>
                  <td style="padding:8px;text-align:center;font-size:9px;">${String(i.createdByRole ?? 'COMPRADOR').toUpperCase()}</td>
                  <td style="padding:8px;">${i.category_name ?? i.classification}</td>
                  <td style="padding:8px;text-align:center;">${i.pairs}</td>
                  <td style="padding:8px;text-align:right;font-weight:bold;">${formatCurrency(i.totalValue)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `)
      .join('');

    printWindow.document.write(`
      <html>
        <head>
          <style>body{font-family:sans-serif;padding:30px}h1{color:#1e3a8a}</style>
        </head>
        <body>
          <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:4px solid #1e3a8a;padding-bottom:15px;margin-bottom:20px;">
            <div>
              <h1 style="margin:0;font-size:24px;font-weight:900;font-style:italic;">
                PEDIDOS <span style="color:#dc2626;">VALIDADOS</span>
              </h1>
              <p style="margin:5px 0 0;font-size:11px;font-weight:bold;color:#666;">
                UNIDADE ${store?.number ?? '?'} - ${store?.city ?? 'DESCONHECIDA'}
              </p>
            </div>
            <div style="text-align:right;font-size:10px;font-weight:bold;color:#999;">
              EMISSÃO: ${new Date().toLocaleString('pt-BR')}
            </div>
          </div>
          ${rows}
          <div style="margin-top:40px;border-top:1px solid #000;padding-top:10px;text-align:center;font-size:10px;font-weight:bold;">
            REAL ADMIN - ENGENHARIA DE COMPRAS
          </div>
          <script>window.onload=function(){window.print();setTimeout(window.close,1000)}<\/script>
        </body>
      </html>
    `);
    printWindow.document.close();
  }, [stores, viewStoreId, consolidated.orders]);

  // ── Pedidos filtrados (evitar recalcular nos dois lugares) ──
  const openOrders = useMemo(() => consolidated.orders.filter(isOpenOrder), [consolidated.orders]);
  const validatedOrders = useMemo(() => consolidated.orders.filter(isValidatedOrder), [consolidated.orders]);

  // ─────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────

  // ── Navegação mobile entre meses ──────────
  const currentMonthIdx = TIMELINE.findIndex(m => m.key === selectedMobileMonth);
  const goToPrevMonth = useCallback(() => {
    if (currentMonthIdx > 0) setSelectedMobileMonth(TIMELINE[currentMonthIdx - 1].key);
  }, [currentMonthIdx]);
  const goToNextMonth = useCallback(() => {
    if (currentMonthIdx < TIMELINE.length - 1) setSelectedMobileMonth(TIMELINE[currentMonthIdx + 1].key);
  }, [currentMonthIdx]);

  const currentMonthStats = consolidated.stats[selectedMobileMonth];
  const currentStore = stores.find(s => s.id === viewStoreId);

  // Pedidos do mês selecionado (mobile) — parcela no mês OU embarque no mês
  const openOrdersCurrentMonth = useMemo(() =>
    openOrders.filter(o =>
      getInstallmentValueForMonth(o, selectedMobileMonth) > 0 ||
      o.shipmentDate === selectedMobileMonth
    ),
    [openOrders, selectedMobileMonth]
  );

  return (
    <div className="flex flex-col h-screen bg-[#f3f4f6] overflow-hidden text-blue-950 font-sans">

      {/* ── Toast Global ── */}
      <Toast toast={toast} />

      {/* ════════════════════════════════════════
          MOBILE LAYOUT (< lg)
      ════════════════════════════════════════ */}
      <div className="lg:hidden flex flex-col h-screen overflow-hidden bg-[#0f172a]">

        {/* — Mobile Header — */}
        <div className="bg-[#0f172a] px-4 pt-4 pb-3 shrink-0">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Engenharia de Compras</p>
              {isAdmin ? (
                <select
                  value={viewStoreId}
                  onChange={e => setManualStoreId(e.target.value)}
                  className="bg-transparent text-white font-black text-sm uppercase outline-none border-none mt-0.5 -ml-0.5 w-full"
                  aria-label="Selecionar loja"
                >
                  {activeStores.map(s => (
                    <option key={s.id} value={s.id} className="bg-slate-800">
                      Loja {s.number} — {s.city}
                    </option>
                  ))}
                </select>
              ) : (
                <h2 className="text-white font-black text-sm uppercase tracking-tight">
                  Loja {currentStore?.number ?? '?'} — {currentStore?.city ?? 'Carregando...'}
                </h2>
              )}
            </div>
            <button
              onClick={() => { setSelectedStoresForOrder([viewStoreId]); setActiveForm('order'); }}
              className="bg-blue-600 text-white w-10 h-10 rounded-xl flex items-center justify-center shadow-lg active:scale-95 transition-all"
              aria-label="Novo pedido"
            >
              <Plus size={20} />
            </button>
          </div>

          {/* — Navegação de mês — */}
          <div className="flex items-center justify-between bg-white/5 rounded-2xl px-4 py-3">
            <button
              onClick={goToPrevMonth}
              disabled={currentMonthIdx === 0}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 disabled:opacity-20 active:bg-white/10 transition-all"
              aria-label="Mês anterior"
            >
              <ChevronDown size={18} className="rotate-90" />
            </button>
            <div className="text-center">
              <p className="text-white font-black text-lg uppercase tracking-widest leading-none">
                {getMonthNameFromKey(selectedMobileMonth)}
              </p>
              <p className="text-slate-400 text-[10px] font-bold mt-0.5">
                {selectedMobileMonth.split('-')[0]}
              </p>
            </div>
            <button
              onClick={goToNextMonth}
              disabled={currentMonthIdx === TIMELINE.length - 1}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 disabled:opacity-20 active:bg-white/10 transition-all"
              aria-label="Próximo mês"
            >
              <ChevronDown size={18} className="-rotate-90" />
            </button>
          </div>
        </div>

        {/* — Cards de saldo — */}
        <div className="px-4 pb-3 shrink-0 grid grid-cols-2 gap-3">
          {/* Saldo Comprador */}
          <div className={`rounded-2xl p-4 ${(currentMonthStats?.balanceBuyer ?? 0) < 0 ? 'bg-red-900/40 border border-red-700/40' : 'bg-blue-600/20 border border-blue-500/20'}`}>
            <p className="text-[9px] font-black text-blue-300 uppercase tracking-widest mb-1">Comprador</p>
            <p className={`text-xl font-black leading-none ${(currentMonthStats?.balanceBuyer ?? 0) < 0 ? 'text-red-400' : 'text-white'}`}>
              {formatCurrency(currentMonthStats?.balanceBuyer ?? 0)}
            </p>
            <div className="mt-2 flex justify-between text-[8px] text-slate-500 font-bold">
              <span>Usado</span>
              <span>{formatCurrency(currentMonthStats?.usedBuyer ?? 0)}</span>
            </div>
            <div className="mt-1 w-full bg-white/10 rounded-full h-1">
              <div
                className={`h-full rounded-full ${(currentMonthStats?.balanceBuyer ?? 0) < 0 ? 'bg-red-500' : 'bg-blue-400'}`}
                style={{
                  width: `${Math.min(100, currentMonthStats?.limitBuyer > 0
                    ? ((currentMonthStats?.usedBuyer ?? 0) / currentMonthStats.limitBuyer) * 100
                    : 0)}%`
                }}
              />
            </div>
          </div>

          {/* Saldo Gerente */}
          <div className={`rounded-2xl p-4 ${(currentMonthStats?.balanceManager ?? 0) < 0 ? 'bg-red-900/40 border border-red-700/40' : 'bg-orange-500/10 border border-orange-500/20'}`}>
            <p className="text-[9px] font-black text-orange-300 uppercase tracking-widest mb-1">Gerente</p>
            <p className={`text-xl font-black leading-none ${(currentMonthStats?.balanceManager ?? 0) < 0 ? 'text-red-400' : 'text-orange-300'}`}>
              {formatCurrency(currentMonthStats?.balanceManager ?? 0)}
            </p>
            <div className="mt-2 flex justify-between text-[8px] text-slate-500 font-bold">
              <span>Usado</span>
              <span>{formatCurrency(currentMonthStats?.usedManager ?? 0)}</span>
            </div>
            <div className="mt-1 w-full bg-white/10 rounded-full h-1">
              <div
                className={`h-full rounded-full ${(currentMonthStats?.balanceManager ?? 0) < 0 ? 'bg-red-500' : 'bg-orange-400'}`}
                style={{
                  width: `${Math.min(100, currentMonthStats?.limitManager > 0
                    ? ((currentMonthStats?.usedManager ?? 0) / currentMonthStats.limitManager) * 100
                    : 0)}%`
                }}
              />
            </div>
          </div>

          {/* Dívidas + OTB — linha inferior */}
          <div className="bg-white/5 rounded-2xl p-3 border border-white/5">
            <p className="text-[9px] font-black text-red-400 uppercase tracking-widest mb-1">Dívidas Fixas</p>
            <p className="text-base font-black text-red-400">{formatCurrency(currentMonthStats?.debts ?? 0)}</p>
          </div>
          <div className="bg-green-900/30 rounded-2xl p-3 border border-green-700/30">
            <p className="text-[9px] font-black text-green-400 uppercase tracking-widest mb-1">OTB Disponível</p>
            <p className="text-base font-black text-green-400">{formatCurrency(simulationResult.maxPurchase)}</p>
          </div>
        </div>

        {/* — Lista de pedidos do mês — */}
        <div className="flex-1 overflow-y-auto bg-white rounded-t-[28px] no-scrollbar">
          <div className="sticky top-0 bg-white px-4 pt-4 pb-2 border-b border-gray-100 flex items-center justify-between z-10">
            <h3 className="text-[11px] font-black text-gray-800 uppercase tracking-widest">
              Pedidos em Aberto
              <span className="ml-2 bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-[9px]">
                {openOrdersCurrentMonth.length}
              </span>
            </h3>
            {/* Ações rápidas */}
            <div className="flex gap-1.5">
              <button onClick={() => setActiveForm('validated_orders')} className="bg-green-50 text-green-700 p-2 rounded-xl" aria-label="Validados"><BadgeCheck size={15} /></button>
              <button onClick={() => setActiveForm('mix_view')} className="bg-purple-50 text-purple-700 p-2 rounded-xl" aria-label="Mix"><FileBarChart size={15} /></button>
              <button onClick={() => setActiveForm('expense')} className="bg-orange-50 text-orange-700 p-2 rounded-xl" aria-label="Despesas"><DollarSign size={15} /></button>
              <button onClick={() => setActiveForm('cota_config')} className="bg-yellow-50 text-yellow-700 p-2 rounded-xl" aria-label="Configurar cota"><Calculator size={15} /></button>
            </div>
          </div>

          <div className="divide-y divide-gray-50">
            {openOrdersCurrentMonth.length === 0 && (
              <div className="py-16 text-center">
                <p className="text-gray-300 font-black text-4xl mb-2">—</p>
                <p className="text-[11px] font-bold text-gray-400 uppercase">Sem pedidos neste mês</p>
              </div>
            )}
            {openOrdersCurrentMonth.map(order => {
              const manager = isManagerRole(order.createdByRole);
              const installVal = getInstallmentValueForMonth(order, selectedMobileMonth);
              return (
                <div key={order.id} className="px-4 py-3.5 flex items-center gap-3 active:bg-gray-50 transition-colors">
                  {/* Indicador de role */}
                  <div className={`w-1 self-stretch rounded-full shrink-0 ${manager ? 'bg-orange-400' : 'bg-blue-500'}`} />

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className={`text-[7px] font-black uppercase px-1.5 py-0.5 rounded tracking-wide ${manager ? 'bg-orange-100 text-orange-600' : 'bg-blue-100 text-blue-600'}`}>
                        {manager ? 'GER' : 'COMP'}
                      </span>
                      <span className="text-[9px] font-black text-gray-400 uppercase truncate">
                        {order.category_name ?? order.classification ?? 'GERAL'}
                      </span>
                    </div>
                    <p className="text-sm font-black text-blue-950 uppercase italic truncate leading-tight">
                      {order.brand}
                    </p>
                    <p className="text-[9px] text-gray-400 font-bold mt-0.5">
                      Embarque: {getMonthNameFromKey(order.shipmentDate)}
                      {order.pairs ? ` · ${order.pairs} un` : ''}
                    </p>
                  </div>

                  {/* Valores */}
                  <div className="text-right shrink-0">
                    <p className="text-sm font-black text-blue-900">{formatCurrency(order.totalValue)}</p>
                    {installVal > 0 && installVal !== order.totalValue && (
                      <p className="text-[9px] font-bold text-gray-400">Parcela: {formatCurrency(installVal)}</p>
                    )}
                  </div>

                  {/* Ações */}
                  <div className="flex flex-col gap-1.5 shrink-0 ml-1">
                    <button
                      onClick={() => onUpdateCota(order.id, { status: 'VALIDADO' })}
                      className="w-8 h-8 flex items-center justify-center bg-green-50 text-green-600 rounded-xl active:scale-95 transition-all"
                      aria-label={`Validar ${order.brand}`}
                    >
                      <CheckCircle size={15} />
                    </button>
                    <button
                      onClick={() => onDeleteCota(order.id)}
                      className="w-8 h-8 flex items-center justify-center bg-red-50 text-red-400 rounded-xl active:scale-95 transition-all"
                      aria-label={`Excluir ${order.brand}`}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Padding seguro para barra de sistema */}
          <div className="h-8" />
        </div>
      </div>

      {/* ════════════════════════════════════════
          DESKTOP LAYOUT (≥ lg)
      ════════════════════════════════════════ */}
      <div className="hidden lg:flex lg:flex-col lg:h-screen lg:overflow-hidden">

      {/* ── TOP BAR DESKTOP ── */}
      <div className="bg-white px-4 py-3 flex justify-between items-center gap-4 z-50 shadow-sm border-b shrink-0">
        <div className="flex items-center gap-3">
          <div className="bg-blue-900 text-white p-2 rounded-lg shadow-md shrink-0">
            <Building2 size={20} />
          </div>
          <div>
            <h1 className="text-sm font-black uppercase italic leading-none tracking-tight text-blue-900">
              Engenharia <span className="text-blue-800 font-black">de Compras</span>
            </h1>
            <div className="flex items-center gap-2 mt-1">
              {isAdmin ? (
                <select
                  value={viewStoreId}
                  onChange={e => setManualStoreId(e.target.value)}
                  className="bg-white border border-gray-200 rounded px-2 py-1 text-[10px] font-black uppercase text-blue-900 outline-none shadow-sm"
                  aria-label="Selecionar loja"
                >
                  {activeStores.map(s => (
                    <option key={s.id} value={s.id}>Loja {s.number} - {s.city}</option>
                  ))}
                </select>
              ) : (
                <span className="text-[10px] font-black text-blue-800 uppercase tracking-widest">
                  Loja {currentStore?.number ?? '?'} - {currentStore?.city ?? 'Carregando...'}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <button onClick={() => { setSelectedStoresForOrder([viewStoreId]); setActiveForm('order'); }} className="bg-blue-900 text-white px-3 py-2 rounded-lg font-black uppercase text-[9px] shadow-sm hover:bg-black transition-all flex items-center gap-1.5 border-b-2 border-blue-950" aria-label="Novo pedido"><Plus size={12} /> Novo Pedido</button>
          <button onClick={() => setActiveForm('validated_orders')} className="bg-green-600 text-white px-3 py-2 rounded-lg font-black uppercase text-[9px] shadow-sm hover:bg-green-700 transition-all flex items-center gap-1.5 border-b-2 border-green-800" aria-label="Ver pedidos validados"><BadgeCheck size={12} /> Validados</button>
          <button onClick={() => setActiveForm('mix_view')} className="bg-purple-600 text-white px-3 py-2 rounded-lg font-black uppercase text-[9px] shadow-sm hover:bg-purple-700 transition-all flex items-center gap-1.5 border-b-2 border-purple-800" aria-label="Ver mix"><FileBarChart size={12} /> Mix</button>
          <button onClick={() => setActiveForm('expense')} className="bg-orange-600 text-white px-3 py-2 rounded-lg font-black uppercase text-[9px] shadow-sm hover:bg-orange-700 transition-all flex items-center gap-1.5 border-b-2 border-orange-800" aria-label="Gerenciar despesas"><DollarSign size={12} /> Despesa</button>
          <button onClick={() => setActiveForm('cota_config')} className="bg-yellow-500 text-blue-950 px-3 py-2 rounded-lg font-black uppercase text-[9px] shadow-sm hover:bg-yellow-600 transition-all flex items-center gap-1.5 border-b-2 border-yellow-700" aria-label="Configurar cota"><Calculator size={12} /> Cota</button>
        </div>
      </div>

      {/* ── SIMULADOR OTB (desktop only) ── */}
      <div className="bg-blue-50 px-4 py-3 border-b border-blue-100 shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Lightbulb size={18} className="text-yellow-600" />
            <span className="text-xs font-black uppercase text-blue-900">Sugestão (OTB):</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[9px] font-bold text-gray-500 uppercase">Inicio:</span>
            <select value={simStartMonth} onChange={e => setSimStartMonth(e.target.value)} className="bg-white border border-gray-200 rounded px-2 py-1 text-[9px] font-black uppercase text-slate-900 outline-none" aria-label="Mês de início">
              {TIMELINE.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[9px] font-bold text-gray-500 uppercase">Vezes:</span>
            <input type="number" value={simInstallments} min={1} onChange={e => setSimInstallments(Math.max(1, parseInt(e.target.value) || 1))} className="w-12 bg-white border rounded px-2 py-1 text-[9px] font-black text-center" aria-label="Parcelas" />
          </div>
          {calculatedShipmentLabel}
          <div className="ml-auto flex items-center gap-4 bg-white px-3 py-2 rounded-lg border border-blue-100 shadow-sm">
            <span className="text-[9px] font-bold text-gray-400 uppercase">Pode comprar hoje:</span>
            <span className="text-sm font-black text-green-600">{formatCurrency(simulationResult.maxPurchase)}</span>
            {simulationResult.limitingMonth && <span className="text-[8px] text-red-400 font-bold uppercase">(Travado em: {simulationResult.limitingMonth})</span>}
          </div>
        </div>
      </div>

      {/* ── DESKTOP TABLE ── */}
      <div className="flex-1 overflow-auto bg-white border-t border-gray-100 no-scrollbar">
        <table className="w-full text-center border-separate border-spacing-0 table-fixed min-w-[1200px]">
          <thead className="sticky top-0 z-40">
            <tr className="bg-blue-900 text-white text-[8px] font-black uppercase h-8">
              <th className="p-1 w-[160px] text-left sticky left-0 bg-blue-900 z-50">Marca / Identificação</th>
              <th className="p-1 w-[170px] border-l border-white/10 sticky left-[160px] bg-blue-900 z-50">Resumo</th>
              {TIMELINE.map(m => (
                <th key={m.key} className="p-1 w-20 border-l border-white/10">{m.label}</th>
              ))}
            </tr>
          </thead>
          <tbody className="text-[10px] font-bold uppercase">

            {/* Meta Global */}
            <tr className="bg-gray-100 border-b h-7">
              <td className="px-2 text-left sticky left-0 bg-gray-100 z-30 font-black text-gray-500 text-[9px]">META GLOBAL</td>
              <td className="font-black italic text-gray-500 sticky left-[160px] bg-gray-100 z-30 text-[9px]">
                {formatCurrency(Number(storeSettings?.budgetValue ?? 0))}
              </td>
              {TIMELINE.map(m => <td key={m.key} className="p-1 text-gray-300">-</td>)}
            </tr>

            {/* Gastos Fixos */}
            <tr className="bg-red-50 border-b h-7">
              <td className="px-2 text-left sticky left-0 bg-red-50 z-30 font-black text-red-600 text-[9px]">GASTOS FIXOS (DÍVIDAS)</td>
              <td className="font-black italic text-red-600 sticky left-[160px] bg-red-50 z-30 text-[9px]">
                {formatCurrency(consolidated.totalDebtsGlobal)}
              </td>
              {TIMELINE.map(m => (
                <td key={m.key} className="p-1 font-black text-red-600 text-[9px]">
                  {formatCurrency(consolidated.stats[m.key]?.debts ?? 0)}
                </td>
              ))}
            </tr>

            {/* Cota Gerente */}
            <tr className="bg-orange-50 border-b h-8 border-t-2 border-orange-200">
              <td className="px-2 text-left sticky left-0 bg-orange-50 z-30">
                <div className="font-black text-orange-700 text-[9px]">COTA GERENTE</div>
                <div className="text-[7px] text-orange-400 font-bold">{storeSettings?.managerPercent ?? 0}% da Meta Bruta</div>
              </td>
              <td className="font-black italic text-orange-700 sticky left-[160px] bg-orange-50 z-30 text-[9px] text-right pr-2">SALDO:</td>
              {TIMELINE.map(m => (
                <td key={m.key} className={`p-1 font-black text-[10px] ${(consolidated.stats[m.key]?.balanceManager ?? 0) < 0 ? 'text-red-600' : 'text-orange-700'}`}>
                  {formatCurrency(consolidated.stats[m.key]?.balanceManager ?? 0)}
                </td>
              ))}
            </tr>

            {/* Cota Comprador */}
            <tr className="bg-blue-50 border-b h-8 border-t-2 border-blue-200">
              <td className="px-2 text-left sticky left-0 bg-blue-50 z-30">
                <div className="font-black text-blue-800 text-[9px]">COTA COMPRADOR</div>
                <div className="text-[7px] text-blue-400 font-bold">Sobra Líquida (Meta - Fixos - Gerente)</div>
              </td>
              <td className="font-black italic text-blue-800 sticky left-[160px] bg-blue-50 z-30 text-[9px] text-right pr-2">SALDO:</td>
              {TIMELINE.map(m => (
                <td key={m.key} className={`p-1 font-black text-[10px] ${(consolidated.stats[m.key]?.balanceBuyer ?? 0) < 0 ? 'text-red-600 animate-pulse' : 'text-blue-800'}`}>
                  {formatCurrency(consolidated.stats[m.key]?.balanceBuyer ?? 0)}
                </td>
              ))}
            </tr>

            {/* Pedidos Abertos */}
            {openOrders.map(order => {
              const manager = isManagerRole(order.createdByRole);
              const isAcessorio = (order.classification ?? order.category_name ?? '').toUpperCase().includes('ACESSÓRIO');
              const qtyType = isAcessorio ? 'UN' : 'PR';

              return (
                <tr key={order.id} className="hover:bg-blue-50/50 transition-colors border-b group h-10">
                  <td className="px-2 text-left sticky left-0 bg-white group-hover:bg-blue-50/50 z-30 shadow-sm overflow-hidden">
                    <div className="flex items-center gap-1.5">
                      <div className={`w-2 h-2 rounded-full shrink-0 shadow-sm ${manager ? 'bg-orange-500' : 'bg-blue-600'}`} />
                      <div className="flex-1 min-w-0">
                        <div className={`text-[9px] font-black uppercase italic leading-none mb-0.5 truncate ${manager ? 'text-orange-700' : 'text-blue-800'}`}>
                          {order.brand}
                        </div>
                        <div className="text-[7px] text-gray-900 font-bold uppercase leading-none truncate">
                          {order.classification ?? order.category_name ?? 'GERAL'} | {order.pairs ?? 0}{qtyType}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 ml-auto opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => onUpdateCota(order.id, { status: 'VALIDADO' })}
                          className="text-green-500 hover:scale-110"
                          aria-label={`Validar ${order.brand}`}
                        >
                          <CheckCircle size={12} />
                        </button>
                        <button
                          onClick={() => onDeleteCota(order.id)}
                          className="text-red-300 hover:text-red-600 hover:scale-110"
                          aria-label={`Excluir ${order.brand}`}
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  </td>
                  <td className="bg-white sticky left-[160px] z-30 group-hover:bg-blue-50/50 shadow-sm text-center">
                    <div className={`text-[9px] font-black italic ${manager ? 'text-orange-700' : 'text-gray-900'}`}>
                      {formatCurrency(order.totalValue)}
                    </div>
                  </td>
                  {TIMELINE.map(m => {
                    const val = getInstallmentValueForMonth(order, m.key);
                    return (
                      <td key={m.key} className={`p-0.5 border-r border-gray-50 font-black text-[9px] ${val > 0 ? (manager ? 'text-orange-600 bg-orange-50/30' : 'text-blue-600') : 'text-gray-100'}`}>
                        {val > 0 ? formatCurrency(val) : ''}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>{/* fim desktop table */}
      </div>{/* fim desktop wrapper lg */}

      {/* ═══════════════════════════════════════
          MODAIS GLOBAIS
          fixed inset-0 → visíveis em mobile e desktop
      ═══════════════════════════════════════ */}

      {/* ── MODAL: MIX OTB ── */}
      {activeForm === 'mix_view' && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[100] p-4">
          <div className="bg-[#f8fafc] rounded-[24px] w-full max-w-6xl shadow-2xl overflow-hidden border-t-4 border-purple-600 max-h-[90vh] flex flex-col">
            <div className="p-3 border-b bg-white flex justify-between items-center shrink-0">
              <h3 className="text-sm font-black uppercase italic text-blue-950 flex items-center gap-2">
                <Activity className="text-purple-600" size={16} /> Dashboard <span className="text-purple-600">Mix OTB</span>
              </h3>
              <div className="flex items-center gap-2">
                <div className="flex bg-gray-100 p-0.5 rounded-lg" role="group" aria-label="Filtrar por semestre">
                  {(['all', '1', '2'] as Semester[]).map(s => (
                    <button
                      key={s}
                      onClick={() => setMixFilterSemester(s)}
                      className={`px-2 py-1 rounded-md text-[8px] font-black uppercase ${mixFilterSemester === s ? 'bg-white text-purple-900 shadow-sm' : 'text-gray-400'}`}
                    >
                      {s === 'all' ? 'Tudo' : `${s}º Sem`}
                    </button>
                  ))}
                </div>
                {isAdmin && (
                  <button
                    onClick={() => setIsEditingMix(!isEditingMix)}
                    className={`p-1.5 rounded-lg transition-all shadow-sm ${isEditingMix ? 'bg-purple-600 text-white' : 'bg-white text-purple-600 border border-purple-100 hover:bg-purple-50'}`}
                    aria-label={isEditingMix ? 'Salvar mix' : 'Editar mix'}
                  >
                    {isEditingMix ? <Save size={14} /> : <Settings size={14} />}
                  </button>
                )}
                <button
                  onClick={() => { setActiveForm(null); setIsEditingMix(false); }}
                  className="p-1.5 bg-gray-100 text-gray-400 hover:text-red-600 rounded-lg transition-all"
                  aria-label="Fechar"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* — Totais do semestre selecionado — */}
            <div className="px-4 pt-3 pb-2 shrink-0 bg-gray-50 border-b border-gray-100">
              {(() => {
                const totalUtilizado = mixHierarchyData.reduce((s, seg) => s + seg.utilizedValue, 0);
                const totalMeta = Number(storeSettings?.budgetValue ?? 0);
                const pctGlobal = totalMeta > 0 ? (totalUtilizado / totalMeta) * 100 : 0;
                return (
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Total Comprado</p>
                      <p className="text-lg font-black text-blue-950 italic leading-none">{formatCurrency(totalUtilizado)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Verba Global</p>
                      <p className="text-lg font-black text-gray-400 italic leading-none">{formatCurrency(totalMeta)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest">% Utilizado</p>
                      <p className={`text-lg font-black italic leading-none ${pctGlobal >= 100 ? 'text-red-600' : pctGlobal >= 70 ? 'text-amber-600' : 'text-emerald-600'}`}>
                        {pctGlobal.toFixed(1)}%
                      </p>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* — 4 Cards de segmento — */}
            <div className="flex-1 overflow-y-auto p-4 no-scrollbar">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {mixHierarchyData.map(seg => {
                  const styles = getTrafficLightStyle(seg.utilizationOfQuota, true);
                  const barWidth = Math.min(seg.utilizationOfQuota, 100);
                  const metaValue = Number(storeSettings?.budgetValue ?? 0) * (seg.metaPercent / 100);

                  return (
                    <div key={seg.segment} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                      {/* Cabeçalho do card */}
                      <div className="flex items-center justify-between px-4 pt-4 pb-3">
                        <div className="flex items-center gap-2.5">
                          <div className={`p-2 rounded-xl bg-gray-50 ${styles.text}`}>
                            {getCategoryIcon(seg.segment)}
                          </div>
                          <div>
                            <h4 className="text-sm font-black text-blue-950 uppercase italic leading-none tracking-tight">
                              {seg.segment}
                            </h4>
                            <p className="text-[9px] font-bold text-gray-400 uppercase mt-0.5">
                              Share global: {seg.utilizedPercent.toFixed(1)}%
                            </p>
                          </div>
                        </div>

                        {/* Meta % — editável se admin */}
                        <div className="text-right">
                          <p className="text-[7px] font-black text-gray-400 uppercase tracking-widest mb-0.5">Meta</p>
                          {isEditingMix ? (
                            <div className="flex items-center gap-0.5">
                              <input
                                key={`input-${seg.segment}-${mixFilterSemester}`}
                                type="text"
                                defaultValue={seg.metaPercent}
                                onBlur={e => handleUpdateMix(seg.segment, e.target.value)}
                                onKeyDown={e => {
                                  if (e.key === 'Enter') {
                                    handleUpdateMix(seg.segment, (e.target as HTMLInputElement).value);
                                    (e.target as HTMLInputElement).blur();
                                  }
                                }}
                                className="w-12 p-1 bg-purple-50 border border-purple-200 rounded-lg text-center text-sm font-black text-purple-700 outline-none"
                                aria-label={`Meta ${seg.segment}`}
                              />
                              <span className="text-sm font-black text-purple-500">%</span>
                            </div>
                          ) : (
                            <span className="text-xl font-black italic text-blue-900 leading-none">
                              {seg.metaPercent.toFixed(0)}<span className="text-sm text-gray-400">%</span>
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Barra de progresso grossa */}
                      <div className="px-4 pb-1">
                        <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-700 ${styles.bar}`}
                            style={{ width: `${barWidth}%` }}
                            role="progressbar"
                            aria-valuenow={barWidth}
                            aria-valuemin={0}
                            aria-valuemax={100}
                          />
                        </div>
                      </div>

                      {/* Linha de valores */}
                      <div className="grid grid-cols-3 divide-x divide-gray-100 border-t border-gray-100 mt-3">
                        <div className="px-3 py-2.5 text-center">
                          <p className="text-[7px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">Comprado</p>
                          <p className="text-[11px] font-black text-blue-950 leading-none">{formatCurrency(seg.utilizedValue)}</p>
                        </div>
                        <div className="px-3 py-2.5 text-center">
                          <p className="text-[7px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">Verba Meta</p>
                          <p className="text-[11px] font-black text-gray-500 leading-none">{formatCurrency(metaValue)}</p>
                        </div>
                        <div className="px-3 py-2.5 text-center">
                          <p className="text-[7px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">% Usado</p>
                          <p className={`text-[11px] font-black leading-none ${styles.text}`}>
                            {seg.utilizationOfQuota.toFixed(1)}%
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════
          MODAL: NOVO PEDIDO
      ═══════════════════════════════════════ */}
      {activeForm === 'order' && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-[24px] w-full max-w-xl shadow-2xl overflow-hidden border-t-4 border-blue-900 max-h-[90vh] overflow-y-auto no-scrollbar">
            <div className="p-4 border-b bg-gray-50/50 flex justify-between items-center">
              <h3 className="text-sm font-black uppercase italic text-blue-950 flex items-center gap-2">
                <Plus className="text-red-600" size={16} /> Novo <span className="text-red-600">Pedido</span>
              </h3>
              <button onClick={() => setActiveForm(null)} className="text-gray-400 hover:text-red-600" aria-label="Fechar">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSaveOrder} className="p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[8px] font-black text-gray-400 uppercase ml-2" htmlFor="order-brand">Marca</label>
                  <input
                    id="order-brand"
                    required
                    value={brand}
                    onChange={e => setBrand(e.target.value)}
                    className="w-full p-2 bg-gray-50 rounded-xl font-black text-gray-900 uppercase italic shadow-inner outline-none text-[10px]"
                    placeholder="EX: VIZZANO"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[8px] font-black text-gray-400 uppercase ml-2" htmlFor="order-category">Classificação</label>
                  <select
                    id="order-category"
                    required
                    value={selectedCategoryId}
                    onChange={e => setSelectedCategoryId(e.target.value)}
                    className="w-full p-2 bg-gray-50 rounded-xl font-black text-gray-900 uppercase outline-none text-[9px]"
                  >
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
                  <label className="text-[8px] font-black text-gray-400 uppercase ml-2" htmlFor="order-shipment">Embarque</label>
                  <select
                    id="order-shipment"
                    value={shipmentMonth}
                    onChange={e => setShipmentMonth(e.target.value)}
                    className="w-full p-2 bg-gray-50 rounded-xl font-black text-gray-900 outline-none text-[9px]"
                  >
                    {TIMELINE.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[8px] font-black text-gray-400 uppercase ml-2" htmlFor="order-terms">Prazos</label>
                  <input
                    id="order-terms"
                    required
                    value={paymentTerms}
                    onChange={e => setPaymentTerms(e.target.value)}
                    className="w-full p-2 bg-gray-50 rounded-xl font-black text-gray-900 text-center outline-none text-[9px]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[8px] font-black text-gray-400 uppercase ml-2" htmlFor="order-value">Valor (R$)</label>
                  <input
                    id="order-value"
                    required
                    value={totalValue}
                    onChange={e => setTotalValue(e.target.value)}
                    className="w-full p-2 bg-blue-50/50 rounded-xl font-black text-blue-900 text-xs text-center shadow-inner outline-none"
                    placeholder="0,00"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[8px] font-black text-gray-400 uppercase ml-2" htmlFor="order-pairs">Qtd</label>
                  <input
                    id="order-pairs"
                    value={pairs}
                    onChange={e => setPairs(e.target.value.replace(/\D/g, ''))}
                    className="w-full p-2 bg-gray-50 rounded-xl font-black text-gray-900 text-center outline-none text-[10px]"
                    placeholder="0"
                    inputMode="numeric"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[8px] font-black text-gray-400 uppercase ml-2">Perfil</label>
                  <div className="flex bg-gray-100 p-1 rounded-xl" role="group" aria-label="Perfil do pedido">
                    <button
                      type="button"
                      onClick={() => setOrderCreatedByRole('COMPRADOR')}
                      className={`flex-1 py-1 rounded-lg font-black text-[8px] uppercase transition-all ${orderCreatedByRole === 'COMPRADOR' ? 'bg-blue-900 text-white' : 'text-gray-400'}`}
                      aria-pressed={orderCreatedByRole === 'COMPRADOR'}
                    >
                      Comp
                    </button>
                    <button
                      type="button"
                      onClick={() => setOrderCreatedByRole('GERENTE')}
                      className={`flex-1 py-1 rounded-lg font-black text-[8px] uppercase transition-all ${orderCreatedByRole === 'GERENTE' ? 'bg-orange-600 text-white' : 'text-gray-400'}`}
                      aria-pressed={orderCreatedByRole === 'GERENTE'}
                    >
                      Ger
                    </button>
                  </div>
                </div>
              </div>

              {isAdmin && (
                <div className="bg-gray-50 p-2 rounded-xl border border-gray-100 shadow-inner">
                  <label className="text-[8px] font-black text-blue-900 uppercase italic ml-2 mb-1 block">Unidades</label>
                  <div className="grid grid-cols-5 gap-1 max-h-20 overflow-y-auto no-scrollbar">
                    {activeStores.map(s => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => toggleStoreForOrder(s.id)}
                        aria-pressed={selectedStoresForOrder.includes(s.id)}
                        className={`p-1 rounded-lg text-[7px] font-black uppercase border-2 transition-all
                          ${selectedStoresForOrder.includes(s.id)
                            ? 'bg-blue-900 border-blue-900 text-white'
                            : 'bg-white border-gray-100 text-gray-400'}`}
                      >
                        {s.number}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-2.5 bg-red-600 text-white rounded-xl font-black uppercase text-[9px] shadow-lg active:scale-95 transition-all border-b-4 border-red-900 flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isSubmitting ? <Loader2 className="animate-spin" size={12} /> : <Save size={12} />}
                SALVAR PEDIDO
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════
          MODAL: DESPESAS FIXAS
      ═══════════════════════════════════════ */}
      {activeForm === 'expense' && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-[24px] w-full max-w-xl shadow-2xl overflow-hidden border-t-4 border-orange-600 max-h-[90vh] flex flex-col">
            <div className="p-4 border-b bg-gray-50/50 flex justify-between items-center">
              <h3 className="text-sm font-black uppercase italic text-blue-950 flex items-center gap-2">
                <DollarSign className="text-orange-600" size={18} /> Gastos <span className="text-orange-600">Fixos</span>
              </h3>
              <button onClick={() => setActiveForm(null)} className="text-gray-400 hover:text-red-600 transition-all" aria-label="Fechar">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSaveAllExpenses} className="flex-1 overflow-y-auto no-scrollbar p-4">
              <div className="grid grid-cols-2 gap-3 pr-1.5">
                {TIMELINE.map(m => (
                  <div key={m.key} className="bg-gray-50 p-2 rounded-xl border border-gray-100 shadow-sm group hover:border-orange-200 transition-all">
                    <label
                      htmlFor={`debt-${m.key}`}
                      className="text-[7px] font-black text-gray-400 uppercase tracking-widest mb-1 block group-hover:text-orange-600 transition-colors"
                    >
                      {m.label}
                    </label>
                    <div className="relative">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-orange-400 text-[9px] font-black">R$</span>
                      <input
                        id={`debt-${m.key}`}
                        value={semesterDebts[m.key] ?? ''}
                        onChange={e => setSemesterDebts(prev => ({ ...prev, [m.key]: e.target.value }))}
                        className="w-full pl-6 pr-1.5 py-1.5 bg-white border border-gray-200 rounded-lg text-[10px] font-black text-blue-900 outline-none focus:ring-2 focus:ring-orange-50"
                        placeholder="0,00"
                        inputMode="decimal"
                      />
                    </div>
                  </div>
                ))}
              </div>
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full mt-4 py-2.5 bg-orange-600 text-white rounded-xl font-black uppercase text-[9px] shadow-lg active:scale-95 transition-all border-b-4 border-orange-900 flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {isSubmitting ? <Loader2 className="animate-spin" size={14} /> : <Save size={14} />}
                ATUALIZAR DESPESAS
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════
          MODAL: CONFIGURAÇÃO DE COTA
      ═══════════════════════════════════════ */}
      {activeForm === 'cota_config' && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-[24px] w-full max-w-sm shadow-2xl overflow-hidden border-t-4 border-yellow-500">
            <div className="p-4 border-b bg-gray-50/50 flex justify-between items-center">
              <h3 className="text-sm font-black uppercase italic text-blue-950 flex items-center gap-2">
                <Calculator className="text-yellow-500" size={18} /> Configurar <span className="text-yellow-600">OTB</span>
              </h3>
              <button onClick={() => setActiveForm(null)} className="text-gray-400 hover:text-red-600 transition-all" aria-label="Fechar">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSaveCotaSettings} className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-[9px] font-black text-gray-400 uppercase ml-2 tracking-widest" htmlFor="cfg-budget">Verba Global</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300 font-black text-[10px]">R$</span>
                  <input
                    id="cfg-budget"
                    required
                    value={budgetVal}
                    onChange={e => setBudgetVal(e.target.value)}
                    className="w-full pl-8 pr-3 py-3 bg-gray-50 border-none rounded-xl font-black text-blue-950 text-lg shadow-inner outline-none focus:ring-4 focus:ring-yellow-50"
                    placeholder="0,00"
                    inputMode="decimal"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[9px] font-black text-gray-400 uppercase ml-2 tracking-widest" htmlFor="cfg-manager">Partilha Gerente (%)</label>
                <input
                  id="cfg-manager"
                  required
                  value={managerPct}
                  onChange={e => setManagerPct(e.target.value)}
                  className="w-full p-3 bg-gray-50 border-none rounded-xl font-black text-orange-600 text-lg shadow-inner outline-none text-center focus:ring-4 focus:ring-yellow-50"
                  placeholder="20"
                  inputMode="decimal"
                />
              </div>
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 bg-yellow-500 text-blue-950 rounded-xl font-black uppercase text-[9px] shadow-lg active:scale-95 transition-all border-b-4 border-yellow-700 flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {isSubmitting ? <Loader2 className="animate-spin" size={14} /> : <Save size={14} />}
                SALVAR CONFIGURAÇÃO
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════
          MODAL: PEDIDOS VALIDADOS
      ═══════════════════════════════════════ */}
      {activeForm === 'validated_orders' && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-[24px] w-full max-w-4xl shadow-2xl overflow-hidden border-t-8 border-green-600 max-h-[90vh] flex flex-col">
            <div className="p-4 border-b bg-gray-50/50 flex justify-between items-center">
              <h3 className="text-sm font-black uppercase italic text-blue-950 flex items-center gap-2">
                <BadgeCheck className="text-green-600" size={18} /> Pedidos <span className="text-green-600">Validados</span>
              </h3>
              <div className="flex gap-2">
                <button
                  onClick={handlePrintValidated}
                  className="p-1.5 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-all"
                  aria-label="Imprimir validados"
                >
                  <Printer size={16} />
                </button>
                <button
                  onClick={() => setActiveForm(null)}
                  className="p-1.5 bg-gray-50 text-gray-400 hover:text-red-600 rounded-lg transition-all"
                  aria-label="Fechar"
                >
                  <X size={16} />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto no-scrollbar">
              <table className="w-full text-left">
                <thead className="bg-white sticky top-0 z-10 border-b border-gray-100 text-[9px] font-black text-gray-400 uppercase tracking-widest">
                  <tr>
                    <th className="px-4 py-3">Identificação</th>
                    <th className="px-4 py-3 text-center">Gestor</th>
                    <th className="px-4 py-3">Embarque</th>
                    <th className="px-4 py-3 text-right">Valor Total</th>
                    <th className="px-4 py-3 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 font-bold text-[10px]">
                  {validatedOrders.map(order => (
                    <tr key={order.id} className="hover:bg-gray-50 transition-all group">
                      <td className="px-4 py-2">
                        <div className="font-black text-gray-900 uppercase italic tracking-tighter leading-none">{order.brand}</div>
                        <div className="text-[8px] text-gray-400 uppercase mt-0.5 italic">
                          {order.classification ?? order.category_name}
                        </div>
                      </td>
                      <td className="px-4 py-2 text-center">
                        <span className={`text-[9px] font-black px-2 py-1 rounded uppercase
                          ${isManagerRole(order.createdByRole) ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'}`}>
                          {String(order.createdByRole ?? 'COMPRADOR').toUpperCase()}
                        </span>
                      </td>
                      <td className="px-4 py-2">
                        <span className="text-[9px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full uppercase">
                          {getMonthNameFromKey(order.shipmentDate)}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-right font-black text-blue-950 text-xs italic">
                        {formatCurrency(order.totalValue)}
                      </td>
                      <td className="px-4 py-2 text-center">
                        <div className="flex justify-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                          <button
                            onClick={() => onUpdateCota(order.id, { status: 'ABERTA' })}
                            className="p-1.5 text-orange-600 hover:bg-orange-50 rounded-lg"
                            aria-label={`Reabrir pedido ${order.brand}`}
                          >
                            <ArrowDownRight size={16} />
                          </button>
                          <button
                            onClick={() => onDeleteCota(order.id)}
                            className="p-1.5 text-red-300 hover:text-red-600 rounded-lg"
                            aria-label={`Excluir pedido ${order.brand}`}
                          >
                            <Trash2 size={16} />
                          </button>
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
