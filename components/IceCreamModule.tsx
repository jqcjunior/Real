import React, { useState, useMemo, useEffect } from 'react';
import { IceCreamItem, IceCreamDailySale, IceCreamCategory, IceCreamPaymentMethod, User, UserRole, Store, IceCreamStock, IceCreamPromissoryNote, IceCreamRecipeItem, StoreProfitPartner, Sale, IceCreamSangria, IceCreamSangriaCategory, IceCreamStockMovement, AdminUser } from '../types';
import { formatCurrency, BRAND_LOGO } from '../constants';
import { 
    IceCream, Plus, Package, ShoppingCart, CheckCircle2, XCircle,
    Trash2, X, History, PieChart, ArrowDownCircle, ArrowUpCircle, ExternalLink, Activity,
    Loader2, Search, Trash, ChevronRight, Calculator, FileText, Ban, UserCheck, Save, Image as ImageIcon, Sliders, Settings, Calendar, BarChart3, ListChecks, TrendingUp, TrendingDown, DollarSign, Wallet, CreditCard, Banknote, PackagePlus, Printer, ClipboardList, AlertCircle, Info, ToggleLeft, ToggleRight, Receipt, ArrowRight,
    Users as UsersIcon, ShieldCheck, UserCog, Clock, FileBarChart, Users, Handshake, AlertTriangle, Zap, Beaker, Layers, Clipboard, Edit3, Filter, ChevronDown, FilePieChart, Briefcase, Warehouse, PencilLine, Truck, ChevronUp
} from 'lucide-react';
import PDVMobileView from './PDVMobileView';
import { ProductGrid } from './ProductGrid'; 
import { supabase } from '../services/supabaseClient';

interface IceCreamModuleProps {
  user: User;
  stores: Store[];
  items: IceCreamItem[];
  stock: IceCreamStock[];
  sales: IceCreamDailySale[];
  salesHeaders?: Sale[];
  salePayments: any[];
  promissories: IceCreamPromissoryNote[];
  can: (permissionKey: string) => boolean;
  onAddSales: (sale: IceCreamDailySale[]) => Promise<void>;
  onAddSaleAtomic: (saleData: any, items: IceCreamDailySale[], payments: { method: IceCreamPaymentMethod, amount: number }[]) => Promise<void>;
  onCancelSale: (id: string, reason?: string) => Promise<void>;
  onUpdatePrice: (id: string, price: number) => Promise<void>;
  onAddItem: (name: string, category: string, price: number, flavor?: string, stockInitial?: number, unit?: string, consumptionPerSale?: number, targetStoreId?: string, recipe?: IceCreamRecipeItem[]) => Promise<void>;
  onSaveProduct: (product: Partial<IceCreamItem>) => Promise<void>;
  onDeleteItem: (id: string) => Promise<void>;
  onUpdateStock: (storeId: string, base: string, value: number, unit: string, type: 'production' | 'adjustment' | 'purchase' | 'inventory', stockId?: string) => Promise<void>;
  liquidatePromissory: (id: string) => Promise<void>;
  onDeleteStockItem: (id: string) => Promise<void>;
  sangriaCategories: IceCreamSangriaCategory[];
  sangrias: IceCreamSangria[];
  stockMovements: IceCreamStockMovement[];
  partners: StoreProfitPartner[];
  adminUsers: AdminUser[];
  onAddSangria: (sangria: Partial<IceCreamSangria>) => Promise<void>;
  onAddSangriaCategory: (cat: Partial<IceCreamSangriaCategory>) => Promise<void>;
  onDeleteSangriaCategory: (id: string) => Promise<void>;
  onAddStockMovement: (movement: Partial<IceCreamStockMovement>) => Promise<void>;
}

const PRODUCT_CATEGORIES: IceCreamCategory[] = ['Sundae', 'Milkshake', 'Casquinha', 'Cascão', 'Cascão Trufado', 'Copinho', 'Bebidas', 'Adicionais'].sort() as IceCreamCategory[];

const getCategoryIconEdit = (category: string, name: string = '') => {
    const itemName = (name || '').toLowerCase();
    if (category === 'Sundae') return 'https://img.icons8.com/color/144/ice-cream-bowl.png';
    if (['Casquinha', 'Cascão', 'Cascão Trufado'].includes(category)) return 'https://img.icons8.com/color/144/ice-cream-cone.png';
    if (category === 'Milkshake') return 'https://img.icons8.com/color/144/milkshake.png';
    if (category === 'Copinho') return 'https://img.icons8.com/color/144/ice-cream-bowl.png';
    if (category === 'Bebidas') return 'https://img.icons8.com/color/144/soda-bottle.png';
    if (category === 'Adicionais' || itemName.includes('nutella') || itemName.includes('chocolate')) return 'https://img.icons8.com/color/144/chocolate-spread.png';
    return 'https://img.icons8.com/color/144/ice-cream.png';
};

const MONTHS = [
  { value: 1, label: 'Janeiro' }, { value: 2, label: 'Fevereiro' }, { value: 3, label: 'Março' },
  { value: 4, label: 'Abril' }, { value: 5, label: 'Maio' }, { value: 6, label: 'Junho' },
  { value: 7, label: 'Julho' }, { value: 8, label: 'Agosto' }, { value: 9, label: 'Setembro' },
  { value: 10, label: 'Outubro' }, { value: 11, label: 'Novembro' }, { value: 12, label: 'Dezembro' }
];

const IceCreamModule: React.FC<IceCreamModuleProps> = ({ 
    user, stores = [], items = [], stock = [], sales = [], salePayments = [], promissories = [], can,
    onAddSales, onAddSaleAtomic, onCancelSale, onUpdatePrice, onAddItem, onSaveProduct, onDeleteItem, onUpdateStock,
    liquidatePromissory, onDeleteStockItem, salesHeaders,
    sangriaCategories = [], sangrias = [], onAddSangria, onAddSangriaCategory, onDeleteSangriaCategory, onAddStockMovement,
    stockMovements = [], partners: initialPartners = [], adminUsers = []
}) => {
  const [activeTab, setActiveTab] = useState<'pdv' | 'estoque' | 'dre_diario' | 'dre_mensal' | 'audit' | 'produtos'>('pdv');
  const [dreSubTab, setDreSubTab] = useState<'resumo' | 'detalhado'>('resumo');
  const [auditSubTab, setAuditSubTab] = useState<'vendas' | 'avarias'>('vendas');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cart, setCart] = useState<IceCreamDailySale[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<IceCreamCategory | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<IceCreamPaymentMethod | 'Misto' | null>(null);
  const [mistoValues, setMistoValues] = useState<Record<string, string>>({ 'Pix': '', 'Dinheiro': '', 'Cartão': '', 'Fiado': '' });
  const [buyerName, setBuyerName] = useState('');
  const [amountReceived, setAmountReceived] = useState('');
  
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const [auditDay, setAuditDay] = useState<string>(new Date().getDate().toString());
  const [auditMonth, setAuditMonth] = useState<string>((new Date().getMonth() + 1).toString());
  const [auditYear, setAuditYear] = useState<string>(new Date().getFullYear().toString());
  const [auditSearch, setAuditSearch] = useState('');
  const [displayDate, setDisplayDate] = useState(new Date().toISOString().split('T')[0]);

  const [showProductModal, setShowProductModal] = useState(false);
  const [showWastageModal, setShowWastageModal] = useState(false);
  const [showSangriaModal, setShowSangriaModal] = useState(false);
  const [showSangriaDetailModal, setShowSangriaDetailModal] = useState<'day' | 'month' | null>(null);
  const [showPartnersModal, setShowPartnersModal] = useState(false);
  const [partnerForm, setPartnerForm] = useState({ partner_name: '', percentage: '' });
  const [sangriaForm, setSangriaForm] = useState({ amount: '', categoryId: '', description: '' });
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');

  const [showCancelModal, setShowCancelModal] = useState<{id: string, code: string} | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  
  const [showNewInsumoModal, setShowNewInsumoModal] = useState(false);
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [showInventoryModal, setShowInventoryModal] = useState(false);

  const [showTicketModal, setShowTicketModal] = useState(false);
  const [ticketData, setTicketData] = useState<{ items: IceCreamDailySale[], saleCode: string, method: string | null, buyer?: string } | null>(null);

  const [showDaySummary, setShowDaySummary] = useState(false);
  const [auditWastageStart, setAuditWastageStart] = useState(new Date().toISOString().split('T')[0]);
  const [auditWastageEnd, setAuditWastageEnd] = useState(new Date().toISOString().split('T')[0]);

  const [partners, setPartners] = useState<StoreProfitPartner[]>([]);
  const [expandedEmployee, setExpandedEmployee] = useState<string | null>(null);
  const [showCanceledDetails, setShowCanceledDetails] = useState(false);
  
  const [newInsumo, setNewInsumo] = useState({ name: '', unit: 'un', initial: '' });
  const [purchaseForm, setPurchaseForm] = useState<Record<string, string>>({}); 
  const [inventoryForm, setInventoryForm] = useState<Record<string, string>>({});
  const [wastageForm, setWastageForm] = useState({ stockId: '', quantity: '', reason: 'DEFEITO / AVARIA' });

  const [editingProduct, setEditingProduct] = useState<IceCreamItem | null>(null);
  const [productForm, setProductForm] = useState<Partial<IceCreamItem>>({ name: '', category: 'Copinho', price: 0, active: true, recipe: [] });
  const [newRecipeItem, setNewRecipeItem] = useState({ stock_base_name: '', quantity: '1' });
  const [manualStoreId, setManualStoreId] = useState('');
  
  // NOVOS ESTADOS PARA SANGRIA COM DATA E EDIÇÃO
  const [sangriaDate, setSangriaDate] = useState(new Date().toISOString().split('T')[0]);
  const [showEditSangriaModal, setShowEditSangriaModal] = useState(false);
  const [editingSangria, setEditingSangria] = useState<any>(null);
  const [editSangriaForm, setEditSangriaForm] = useState<any>({});

  const isAdmin = user.role === UserRole.ADMIN;
  const effectiveStoreId = isAdmin 
    ? (manualStoreId || user.storeId || (stores.length > 0 ? stores[0].id : ''))
    : (user.storeId || (stores.length > 0 ? stores[0].id : ''));
  
  const visibleTabs = useMemo(() => {
    const tabs = [
      { label: 'PDV', icon: ShoppingCart, view: 'pdv', perm: 'MODULE_GELATERIA_PDV' },
      { label: 'Estoque', icon: Package, view: 'estoque', perm: 'MODULE_GELATERIA_ESTOQUE' },
      { label: 'DRE Diário', icon: Clock, view: 'dre_diario', perm: 'MODULE_GELATERIA_DRE_DIARIO' },
      { label: 'DRE Mensal', icon: FileBarChart, view: 'dre_mensal', perm: 'MODULE_GELATERIA_DRE_MENSAL' },
      { label: 'Auditoria', icon: History, view: 'audit', perm: 'MODULE_GELATERIA_AUDIT' },
      { label: 'Produtos', icon: PackagePlus, view: 'produtos', perm: 'MODULE_GELATERIA_CONFIG' }
    ];
    return tabs.filter(tab => can(tab.perm));
  }, [can]);

  const existingBuyerNames = useMemo(() => {
    const names = new Set<string>();
    (sales || []).forEach(s => {
      if (s.buyer_name) names.add(s.buyer_name);
    });
    return Array.from(names);
  }, [sales]);

  const cartTotal = useMemo(() => cart.reduce((acc, curr) => acc + curr.totalValue, 0), [cart]);

  const changeDue = useMemo(() => {
    const paid = parseFloat((amountReceived as string).replace(',', '.')) || 0;
    return Math.max(0, paid - cartTotal);
  }, [amountReceived, cartTotal]);

  const fetchPartners = async () => {
    if (!effectiveStoreId) return;
    const { data } = await supabase.from('store_profit_distribution').select('*').eq('store_id', effectiveStoreId).eq('active', true).order('created_at', { ascending: true });
    if (data) setPartners(data);
  };

  useEffect(() => { 
      fetchPartners(); 
  }, [effectiveStoreId]);

  const filteredItems = useMemo(() => (items ?? []).filter(i => i.storeId === effectiveStoreId), [items, effectiveStoreId]);
  const filteredStock = useMemo(() => (stock ?? []).filter(s => s.store_id === effectiveStoreId && (s.is_active !== false)).sort((a,b) => a.product_base.localeCompare(b.product_base)), [stock, effectiveStoreId]);
  
  const todayKey = new Date().toLocaleDateString('en-CA'); 
  const periodKey = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`;

const dreStats = useMemo(() => {
    const dDate = new Date(displayDate + 'T00:00:00');
    const currentYear = dDate.getFullYear();
    const currentMonth = dDate.getMonth();
    const currentDate = dDate.getDate();

    // ===== INTERVALOS SEGUROS EM TEMPO LOCAL =====
    const monthStart = new Date(Number(selectedYear), Number(selectedMonth) - 1, 1, 0, 0, 0);
    const monthEnd = new Date(Number(selectedYear), Number(selectedMonth), 1, 0, 0, 0);

    const dayStart = new Date(currentYear, currentMonth, currentDate, 0, 0, 0);
    const dayEnd = new Date(currentYear, currentMonth, currentDate + 1, 0, 0, 0);

    // ===== FATURAMENTO MENSAL E DIÁRIO (CRUZANDO salesHeaders, salePayments e sales) =====
    let monthIn = 0;
    const monthMethods = { pix: 0, money: 0, card: 0, fiado: 0 };
    const monthFiadoDetails: any[] = [];
    
    let monthCanceledTotal = 0;
    const monthCanceledDetails: any[] = [];

    let dayCanceledTotal = 0;
    const dayCanceledDetails: any[] = [];

    let dayIn = 0;
    const dayMethods = { 
        pix: { count: 0, total: 0 }, 
        money: { count: 0, total: 0 }, 
        card: { count: 0, total: 0 }, 
        fiado: { count: 0, total: 0 } 
    };

    const monthSalesHeaders = (salesHeaders ?? []).filter(s => {
        if (!s.created_at) return false;
        const d = new Date(s.created_at);
        return d >= monthStart && d < monthEnd && s.store_id === effectiveStoreId;
    });

    monthSalesHeaders.forEach(sale => {
        const d = new Date(sale.created_at);
        const isDaySale = d >= dayStart && d < dayEnd;

        if (sale.status === 'canceled') {
            const val = Number(sale.total_amount || 0);
            monthCanceledTotal += val;
            monthCanceledDetails.push({
                id: sale.id,
                saleCode: sale.sale_code,
                createdAt: sale.created_at,
                totalValue: val,
                canceledBy: sale.canceled_by_name || 'N/A',
                cancelReason: sale.cancel_reason || 'N/A'
            });
            if (isDaySale) {
                dayCanceledTotal += val;
                dayCanceledDetails.push({
                    id: sale.id,
                    saleCode: sale.sale_code,
                    createdAt: sale.created_at,
                    totalValue: val,
                    canceledBy: sale.canceled_by_name || 'N/A',
                    cancelReason: sale.cancel_reason || 'N/A'
                });
            }
            return;
        }

        if (sale.status !== 'completed') return;

        const payments = (salePayments ?? []).filter(p => p.sale_id === sale.id);
        
        if (payments.length > 0) {
            payments.forEach(p => {
                const val = Number(p.amount || 0);
                monthIn += val;
                if (isDaySale) dayIn += val;

                const method = p.payment_method?.toLowerCase();
                if (method === 'pix') {
                    monthMethods.pix += val;
                    if (isDaySale) {
                        dayMethods.pix.total += val;
                        dayMethods.pix.count++;
                    }
                } else if (method === 'dinheiro') {
                    monthMethods.money += val;
                    if (isDaySale) {
                        dayMethods.money.total += val;
                        dayMethods.money.count++;
                    }
                } else if (method === 'cartão') {
                    monthMethods.card += val;
                    if (isDaySale) {
                        dayMethods.card.total += val;
                        dayMethods.card.count++;
                    }
                } else if (method === 'fiado') {
                    monthMethods.fiado += val;
                    if (isDaySale) {
                        dayMethods.fiado.total += val;
                        dayMethods.fiado.count++;
                    }
                    monthFiadoDetails.push({
                        buyer_name: sale.buyer_name || 'NÃO INFORMADO',
                        totalValue: p.amount,
                        saleCode: sale.sale_code || '---',
                        createdAt: p.created_at,
                        productName: 'Venda Diversa'
                    });
                }
            });
        } else {
            // Fallback para itens da venda (ice_cream_daily_sales)
            const items = (sales ?? []).filter(i => i.saleCode === sale.sale_code && i.status === 'completed');
            items.forEach(i => {
                const val = Number(i.totalValue || 0);
                monthIn += val;
                if (isDaySale) dayIn += val;

                const method = i.paymentMethod?.toLowerCase();
                if (method === 'pix') {
                    monthMethods.pix += val;
                    if (isDaySale) {
                        dayMethods.pix.total += val;
                        dayMethods.pix.count++;
                    }
                } else if (method === 'dinheiro') {
                    monthMethods.money += val;
                    if (isDaySale) {
                        dayMethods.money.total += val;
                        dayMethods.money.count++;
                    }
                } else if (method === 'cartão') {
                    monthMethods.card += val;
                    if (isDaySale) {
                        dayMethods.card.total += val;
                        dayMethods.card.count++;
                    }
                } else if (method === 'fiado') {
                    monthMethods.fiado += val;
                    if (isDaySale) {
                        dayMethods.fiado.total += val;
                        dayMethods.fiado.count++;
                    }
                    monthFiadoDetails.push({
                        buyer_name: i.buyer_name || 'NÃO INFORMADO',
                        totalValue: i.totalValue,
                        saleCode: i.saleCode || '---',
                        createdAt: i.createdAt,
                        productName: i.productName || 'Venda Diversa'
                    });
                }
            });
        }
    });

    const profit = monthIn; // Sem despesas por enquanto

    // ===== VENDAS DO DIA (para resumo) =====
    const daySales = (sales ?? []).filter(s => {
        if (!s.createdAt) return false;
        const d = new Date(s.createdAt);

        return (
            d >= dayStart &&
            d < dayEnd &&
            s.status === 'completed' &&
            s.storeId === effectiveStoreId
        );
    });

    // ===== RESUMO DE ITENS (RODAPÉ DRE DIÁRIO) =====
    const resumo: Record<string, { qtd: number; total: number }> = {};

    daySales.forEach(venda => {
        if (!resumo[venda.productName]) {
            resumo[venda.productName] = { qtd: 0, total: 0 };
        }

        resumo[venda.productName].qtd += Number(venda.unitsSold || 0);
        resumo[venda.productName].total += Number(venda.totalValue || 0);
    });

    // ===== SANGRIAS E AVARIAS =====
    const monthSangrias = (sangrias ?? []).filter(s => {
        if (!s.transaction_date && !s.created_at) return false;
        // Prioriza transaction_date, fallback para created_at (sangrias antigas)
        const dateToUse = s.transaction_date || s.created_at;
        const d = new Date(dateToUse + 'T00:00:00');
        return d >= monthStart && d < monthEnd && s.store_id === effectiveStoreId;
    });
    const monthSangriaTotal = monthSangrias.reduce((acc, s) => acc + Number(s.amount || 0), 0);

    const daySangrias = (sangrias ?? []).filter(s => {
        if (!s.transaction_date && !s.created_at) return false;
        // Prioriza transaction_date, fallback para created_at (sangrias antigas)
        const dateToUse = s.transaction_date || s.created_at;
        const d = new Date(dateToUse + 'T00:00:00');
        return d >= dayStart && d < dayEnd && s.store_id === effectiveStoreId;
    });
    const daySangriaTotal = daySangrias.reduce((acc, s) => acc + Number(s.amount || 0), 0);

    const monthWastage = (stockMovements ?? []).filter(m => {
        if (!m.created_at) return false;
        const d = new Date(m.created_at);
        return d >= monthStart && d < monthEnd && m.store_id === effectiveStoreId && m.movement_type === 'AVARIA';
    });
    const monthWastageTotal = monthWastage.reduce((acc, m) => acc + Math.abs(Number(m.quantity || 0)), 0);

    const dayWastage = (stockMovements ?? []).filter(m => {
        if (!m.created_at) return false;
        const d = new Date(m.created_at);
        return d >= dayStart && d < dayEnd && m.store_id === effectiveStoreId && m.movement_type === 'AVARIA';
    });
    const dayWastageTotal = dayWastage.reduce((acc, m) => acc + Math.abs(Number(m.quantity || 0)), 0);

    const monthProfit = monthIn - monthSangriaTotal;
    const dayProfit = dayIn - daySangriaTotal;

    return {
        monthIn,
        monthMethods,
        monthOut: monthSangriaTotal,
        monthSangriaTotal,
        monthSangrias,
        monthWastageTotal,
        profit: monthProfit,
        monthProfit,
        monthFiadoDetails: monthFiadoDetails.sort((a, b) =>
            String(b.createdAt || '').localeCompare(String(a.createdAt || ''))
        ),
        monthCanceledTotal,
        monthCanceledDetails: monthCanceledDetails.sort((a, b) =>
            String(b.createdAt || '').localeCompare(String(a.createdAt || ''))
        ),
        dayCanceledTotal,
        dayCanceledCount: dayCanceledDetails.length,
        dayCanceledDetails: dayCanceledDetails.sort((a, b) =>
            String(b.createdAt || '').localeCompare(String(a.createdAt || ''))
        ),
        dayIn,
        dayOut: daySangriaTotal,
        daySangriaTotal,
        daySangrias,
        dayWastageTotal,
        dayProfit,
        dayMethods,
        dayExits: daySangrias,
        daySales: daySales.sort((a, b) =>
            String(b.createdAt || '').localeCompare(String(a.createdAt || ''))
        ),
        resumoItensRodape: Object.entries(resumo).sort(
            (a, b) => b[1].qtd - a[1].qtd
        )
    };
}, [sales, salePayments, selectedYear, selectedMonth, effectiveStoreId, sangrias, stockMovements, displayDate]);

  const monthFiadoGrouped = useMemo(() => {
    const groups: Record<string, { name: string, total: number, items: any[] }> = {};
    dreStats.monthFiadoDetails.forEach(f => {
        const name = (f.buyer_name || 'NÃO INFORMADO').trim().toUpperCase();
        if (!groups[name]) groups[name] = { name, total: 0, items: [] };
        groups[name].total += Number(f.totalValue);
        groups[name].items.push(f);
    });
    return Object.values(groups).sort((a, b) => b.total - a.total);
  }, [dreStats.monthFiadoDetails]);

  const groupedAuditSales = useMemo(() => {
    const groups: Record<string, any> = {};
    
    const filterParts = [];
    if (auditYear) filterParts.push(auditYear);
    if (auditMonth) filterParts.push(String(auditMonth).padStart(2, '0'));
    if (auditDay) filterParts.push(String(auditDay).padStart(2, '0'));
    const filterPrefix = filterParts.join('-');

    const filtered = (sales || []).filter(s => {
      if (s.storeId !== effectiveStoreId) return false;
      const localDate = new Date(s.createdAt || '').toLocaleDateString('en-CA');
      if (filterPrefix && !localDate.startsWith(filterPrefix)) return false;
      if (auditSearch) {
        const search = auditSearch.toLowerCase();
        return (
          (s.productName || '').toLowerCase().includes(search) ||
          s.saleCode?.toLowerCase().includes(search) ||
          s.buyer_name?.toLowerCase().includes(search)
        );
      }
      return true;
    });

    filtered.forEach(s => {
      const code = s.saleCode || `ID-${s.id}`;
      if (!groups[code]) {
        groups[code] = {
          saleCode: s.saleCode || 'PDV-AVULSO',
          createdAt: s.createdAt,
          status: s.status,
          buyer_name: s.buyer_name,
          paymentMethods: [],
          items: [],
          totalValue: 0
        };
      }
      groups[code].items.push(s);
      groups[code].totalValue += Number(s.totalValue);
      if (s.paymentMethod && !groups[code].paymentMethods.includes(s.paymentMethod)) {
        groups[code].paymentMethods.push(s.paymentMethod);
      }
    });
    return Object.values(groups).sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [sales, effectiveStoreId, auditDay, auditMonth, auditYear, auditSearch]);

  const auditSummary = useMemo(() => {
    // NOVA FUNCIONALIDADE — RESUMO BASEADO NO FILTRO DE AUDITORIA
    const filterParts = [];
    if (auditYear) filterParts.push(auditYear);
    if (auditMonth) filterParts.push(String(auditMonth).padStart(2, '0'));
    if (auditDay) filterParts.push(String(auditDay).padStart(2, '0'));
    const filterPrefix = filterParts.join('-');

    const filtered = (sales || []).filter(s => {
      if (s.storeId !== effectiveStoreId) return false;
      if (s.status !== 'completed') return false;
      const localDate = new Date(s.createdAt || '').toLocaleDateString('en-CA');
      if (filterPrefix && !localDate.startsWith(filterPrefix)) return false;
      return true;
    });

    const resumo: Record<string, { qtd: number; total: number }> = {};
    const resumoPagamentos: Record<string, number> = { 'Dinheiro': 0, 'Fiado': 0, 'Pix': 0, 'Cartão': 0 };
    let totalGeral = 0;
    let totalItens = 0;

    filtered.forEach(venda => {
      if (!resumo[venda.productName]) {
        resumo[venda.productName] = { qtd: 0, total: 0 };
      }
      const qtd = Number(venda.unitsSold || 0);
      const total = Number(venda.totalValue || 0);
      resumo[venda.productName].qtd += qtd;
      resumo[venda.productName].total += total;
      totalGeral += total;
      totalItens += qtd;

      // Adicionando ao resumo de pagamentos
      if (venda.paymentMethod) {
          const method = venda.paymentMethod;
          if (resumoPagamentos[method] !== undefined) {
              resumoPagamentos[method] += total;
          } else if (method === 'Misto') {
              // Se for misto, precisariamos dos detalhes da venda, mas aqui vamos tentar simplificar
              // ou buscar na tabela de pagamentos se disponível.
              // Por enquanto, vamos somar no total geral mas talvez não consigamos quebrar perfeitamente aqui sem salePayments
          }
      }
    });

    // Refinamento: Usar salePayments para totais de pagamento mais precisos (especialmente para Misto)
    const filterPartsPayments = [];
    if (auditYear) filterPartsPayments.push(auditYear);
    if (auditMonth) filterPartsPayments.push(String(auditMonth).padStart(2, '0'));
    if (auditDay) filterPartsPayments.push(String(auditDay).padStart(2, '0'));
    const filterPrefixPayments = filterPartsPayments.join('-');

    const resumoPagamentosFinal: Record<string, number> = { 'Dinheiro': 0, 'Fiado': 0, 'Pix': 0, 'Cartão': 0 };
    const resumoPagamentosQtd: Record<string, number> = { 'Dinheiro': 0, 'Fiado': 0, 'Pix': 0, 'Cartão': 0 };

    const auditSalesHeaders = (salesHeaders ?? []).filter(s => {
        if (s.store_id !== effectiveStoreId) return false;
        if (s.status !== 'completed') return false;
        if (!s.created_at) return false;
        const localDate = new Date(s.created_at).toLocaleDateString('en-CA');
        return !filterPrefixPayments || localDate.startsWith(filterPrefixPayments);
    });

    auditSalesHeaders.forEach(sale => {
        const payments = (salePayments ?? []).filter(p => p.sale_id === sale.id);
        
        if (payments.length > 0) {
            payments.forEach(p => {
                const method = p.payment_method;
                if (resumoPagamentosFinal[method] !== undefined) {
                    resumoPagamentosFinal[method] += Number(p.amount || 0);
                    resumoPagamentosQtd[method] += 1;
                }
            });
        } else {
            // Fallback para itens da venda (ice_cream_daily_sales)
            const items = (sales ?? []).filter(i => i.saleCode === sale.sale_code && i.status === 'completed');
            items.forEach(i => {
                const method = i.paymentMethod;
                if (method && resumoPagamentosFinal[method] !== undefined) {
                    resumoPagamentosFinal[method] += Number(i.totalValue || 0);
                    resumoPagamentosQtd[method] += 1;
                }
            });
        }
    });

    return {
      resumoItens: Object.entries(resumo).sort((a, b) => b[1].qtd - a[1].qtd),
      resumoPagamentos: resumoPagamentosFinal,
      resumoPagamentosQtd,
      totalGeral,
      totalItens,
      totalCanceledValue: (salesHeaders ?? []).filter(s => {
          if (s.store_id !== effectiveStoreId) return false;
          if (s.status !== 'canceled') return false;
          if (!s.created_at) return false;
          const localDate = new Date(s.created_at).toLocaleDateString('en-CA');
          return !filterPrefixPayments || localDate.startsWith(filterPrefixPayments);
      }).reduce((acc, s) => acc + Number(s.total_amount || 0), 0),
      totalCanceledCount: (salesHeaders ?? []).filter(s => {
          if (s.store_id !== effectiveStoreId) return false;
          if (s.status !== 'canceled') return false;
          if (!s.created_at) return false;
          const localDate = new Date(s.created_at).toLocaleDateString('en-CA');
          return !filterPrefixPayments || localDate.startsWith(filterPrefixPayments);
      }).length
    };
  }, [sales, auditYear, auditMonth, auditDay, effectiveStoreId, salePayments, salesHeaders]);

  const filteredAuditWastage = useMemo(() => {
    // NOVA FUNCIONALIDADE — FILTRO AVARIAS
    return (stockMovements ?? []).filter(m => {
      if (m.movement_type !== 'AVARIA' || m.store_id !== effectiveStoreId) return false;
      if (!m.created_at) return false;
      const d = new Date(m.created_at).toISOString().split('T')[0];
      return d >= auditWastageStart && d <= auditWastageEnd;
    }).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [stockMovements, effectiveStoreId, auditWastageStart, auditWastageEnd]);

  const handlePrintDreMensal = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) { alert("Pop-up bloqueado!"); return; }
    const store = stores.find(s => s.id === effectiveStoreId);
    const monthLabel = MONTHS.find(m => m.value === selectedMonth)?.label;
    const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>DRE Mensal - Sorveteria Real</title>
            <style>
                @page { size: A4; margin: 15mm; }
                body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 0; color: #1e293b; line-height: 1.4; }
                .header { border-bottom: 3px solid #1e3a8a; padding-bottom: 10px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: flex-end; }
                .header h2 { color: #1e3a8a; margin: 0; text-transform: uppercase; font-style: italic; font-weight: 900; font-size: 24px; }
                .header p { margin: 0; font-size: 12px; font-weight: bold; color: #64748b; }
                .section { margin-bottom: 20px; padding: 15px; border: 1px solid #e2e8f0; border-radius: 12px; background: #fff; }
                .section-title { font-size: 11px; font-weight: 900; color: #1e3a8a; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 10px; border-bottom: 1px solid #e2e8f0; padding-bottom: 5px; }
                .kpi { display: flex; justify-content: space-between; font-weight: bold; font-size: 14px; padding: 5px 0; }
                .total-row { border-top: 2px solid #1e3a8a; margin-top: 5px; padding-top: 5px; font-size: 18px; color: #1e3a8a; }
                table { width: 100%; border-collapse: collapse; margin-top: 5px; }
                th { text-align: left; padding: 8px; border-bottom: 2px solid #cbd5e1; font-size: 10px; text-transform: uppercase; color: #64748b; }
                td { padding: 8px; border-bottom: 1px solid #f1f5f9; font-size: 11px; font-weight: 600; }
                .text-right { text-align: right; }
                .footer { margin-top: 30px; text-align: center; font-size: 9px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 10px; }
            </style>
        </head>
        <body>
            <div class="header">
                <div>
                    <h2>SORVETERIA REAL</h2>
                    <p>Relatório Gerencial de Resultados</p>
                </div>
                <div class="text-right">
                    <p>UNIDADE: ${store?.number || '---'} | ${store?.city || ''}</p>
                    <p>REFERÊNCIA: ${monthLabel} / ${selectedYear}</p>
                </div>
            </div>

            <div class="section">
                <div class="section-title">Resumo Financeiro</div>
                <div class="kpi"><span>Faturamento Bruto (+)</span> <span style="color:#059669">${formatCurrency(dreStats.monthIn)}</span></div>
                <div class="kpi"><span>Sangrias / Saídas (-)</span> <span style="color:#dc2626">${formatCurrency(dreStats.monthSangriaTotal)}</span></div>
                <div class="kpi total-row"><span>LUCRO LÍQUIDO (=)</span> <span>${formatCurrency(dreStats.profit)}</span></div>
            </div>

            <div class="section">
                <div class="section-title">RESUMO OPERACIONAL DO PERÍODO</div>
                <div class="kpi"><span>Total de Sangrias</span> <span>${formatCurrency(dreStats.monthSangriaTotal)}</span></div>
                <div class="kpi"><span>Total de Avarias</span> <span>${dreStats.monthWastageTotal.toFixed(2)}</span></div>
                <div class="kpi"><span>Vendas Canceladas</span> <span>${formatCurrency(dreStats.monthCanceledTotal)}</span></div>
                <div class="kpi"><span>Margem Líquida (%)</span> <span>${dreStats.monthIn > 0 ? ((dreStats.profit / dreStats.monthIn) * 100).toFixed(1) : '0.0'}%</span></div>
            </div>

            <div class="section">
                <div class="section-title">Partilha de Lucros (Sócios/Parceiros)</div>
                <table>
                    <thead>
                        <tr><th>Nome do Parceiro</th><th>Porcentagem</th><th class="text-right">Valor Repasse</th></tr>
                    </thead>
                    <tbody>
                        ${partners.length > 0 
                            ? partners.map(p => `<tr><td>${p.partner_name}</td><td>${p.percentage}%</td><td class="text-right">${formatCurrency((dreStats.profit * p.percentage) / 100)}</td></tr>`).join('')
                            : '<tr><td colspan="3" style="text-align:center; color:#94a3b8; font-style:italic;">Nenhuma partilha configurada</td></tr>'
                        }
                    </tbody>
                </table>
            </div>

            <div class="section">
                <div class="section-title">Débitos de Funcionários (Vendas Fiado)</div>
                <table>
                    <thead>
                        <tr>
                            <th>Colaborador</th>
                            <th class="text-right">Total Acumulado</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${monthFiadoGrouped.length > 0 
                            ? monthFiadoGrouped.map(f => `<tr><td>${f.name}</td><td class="text-right">${formatCurrency(f.total)}</td></tr>`).join('')
                            : '<tr><td colspan="2" style="text-align:center; color:#94a3b8; font-style:italic;">Nenhum débito registrado no período</td></tr>'
                        }
                    </tbody>
                </table>
            </div>

            <div class="section">
                <div class="section-title">Detalhamento de Vendas Canceladas</div>
                <table>
                    <thead>
                        <tr><th>Código</th><th>Data</th><th>Cancelado Por</th><th>Motivo</th><th class="text-right">Valor</th></tr>
                    </thead>
                    <tbody>
                        ${dreStats.monthCanceledDetails.length > 0 
                            ? dreStats.monthCanceledDetails.map(c => `<tr><td>#${c.saleCode}</td><td>${new Date(c.createdAt).toLocaleDateString()}</td><td>${c.canceledBy}</td><td>${c.cancelReason}</td><td class="text-right">${formatCurrency(c.totalValue)}</td></tr>`).join('')
                            : '<tr><td colspan="5" style="text-align:center; color:#94a3b8; font-style:italic;">Nenhuma venda cancelada no período</td></tr>'
                        }
                    </tbody>
                </table>
            </div>

            <div class="footer">
                Documento gerado em ${new Date().toLocaleString('pt-BR')} por Real Admin v6.5
            </div>

            <script>
                window.onload = () => {
                    window.print();
                    setTimeout(() => window.close(), 1000);
                };
            </script>
        </body>
        </html>
    `;
    printWindow.document.write(html); printWindow.document.close();
  };

  const handleOpenPrintPreview = (items: IceCreamDailySale[], saleCode: string, method: string | null, buyer?: string) => {
    setTicketData({ items, saleCode, method, buyer });
    setShowTicketModal(true);
  };

  const handlePrintTicket = (items: IceCreamDailySale[], saleCode: string, method: string | null, buyer?: string) => {
    const printWindow = window.open('', '_blank', 'width=300,height=600');
    if (!printWindow) {
        alert("O navegador bloqueou a abertura do ticket. Por favor, permita pop-ups para esta página.");
        return;
    }
    const total = items.reduce((acc, curr) => acc + curr.totalValue, 0);
    const isFiado = method?.toUpperCase().includes('FIADO') || buyer;
    
    const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                @page { size: 58mm auto; margin: 0; }
                body { 
                    font-family: 'Courier New', Courier, monospace; 
                    width: 48mm; 
                    padding: 2mm; 
                    font-size: 10px; 
                    color: #000;
                    background: #fff;
                    margin: 0;
                    -webkit-print-color-adjust: exact;
                }
                .text-center { text-align: center; }
                .bold { font-weight: bold; }
                hr { border: 0; border-top: 1px dashed #000; margin: 2mm 0; }
                .flex { display: flex; justify-content: space-between; gap: 2px; }
                .mt-2 { margin-top: 2mm; }
                .footer { font-size: 8px; margin-top: 4mm; line-height: 1.2; }
                .item-name { flex: 1; text-align: left; }
                .signature-line { border-top: 1px solid #000; margin-top: 10mm; text-align: center; font-size: 8px; font-weight: bold; width: 100%; }
            </style>
        </head>
        <body>
            <div class="text-center bold" style="font-size: 12px;">SORVETERIA REAL</div>
            <hr/>
            <div class="flex"><span class="bold">CÓDIGO:</span> <span class="bold">#${saleCode}</span></div>
            <div class="flex"><span>DATA:</span> <span>${new Date().toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}</span></div>
            <hr/>
            <div class="bold">ITENS:</div>
            ${items.map(i => `
                <div class="flex" style="margin-top: 1mm;">
                    <span class="item-name">${i.unitsSold}x ${i.productName.substring(0, 20)}</span>
                    <span>${formatCurrency(i.totalValue)}</span>
                </div>
            `).join('')}
            <hr/>
            <div class="flex bold" style="font-size: 11px;">
                <span>TOTAL</span>
                <span>${formatCurrency(total)}</span>
            </div>
            <div class="mt-2 flex"><span>PAGTO:</span> <span class="bold">${(method || 'MISTO').toUpperCase()}</span></div>
            ${buyer ? `<div class="flex"><span>FUNC:</span> <span class="bold">${buyer}</span></div>` : ''}
            
            ${isFiado ? `
                <div class="mt-4">
                    <div class="signature-line">ASSINATURA DO CLIENTE</div>
                    <div class="text-center" style="font-size: 7px; margin-top: 2px;">AUTORIZO O LANÇAMENTO NO MEU DÉBITO</div>
                </div>
            ` : ''}

            <hr/>
            <div class="text-center footer">
                Aguarde ser atendido<br/>
                Real Admin v6.5 - Unid: ${stores.find(s => s.id === effectiveStoreId)?.number || '---'}
            </div>
            <script>
                window.onload = () => {
                    setTimeout(() => {
                        window.print();
                        setTimeout(() => window.close(), 1000);
                    }, 800);
                };
            </script>
        </body>
        </html>
    `;
    printWindow.document.write(html); 
    printWindow.document.close();
  };

  const finalizeSale = async () => {
    if (cart.length === 0 || !paymentMethod) return;
    const isMisto = paymentMethod === 'Misto';
    const splitData = isMisto 
      ? Object.entries(mistoValues)
          .map(([method, val]) => ({ 
            method: method as IceCreamPaymentMethod, 
            amount: parseFloat((val as string).replace(',', '.')) || 0 
          }))
          .filter(p => p.amount > 0) 
      : [{ method: paymentMethod as IceCreamPaymentMethod, amount: cartTotal }];

    if (isMisto && Math.abs(splitData.reduce((a, b) => a + b.amount, 0) - cartTotal) > 0.01) { 
      alert("A soma dos pagamentos não confere com o total da venda."); 
      return; 
    }

    const hasFiado = splitData.some(p => p.method === 'Fiado');
    if (hasFiado && !buyerName.trim()) {
      alert("O nome do comprador é obrigatório para vendas no Fiado.");
      return;
    }

    setIsSubmitting(true);
    const saleCode = `GEL-${Date.now().toString().slice(-6)}`;
    
    try {
      const saleData = {
        store_id: effectiveStoreId,
        total: cartTotal,
        sale_code: saleCode,
        buyer_name: hasFiado ? buyerName.trim().toUpperCase() : null
      };

      const operationalSales = cart.map(item => ({ 
        ...item, 
        paymentMethod: (isMisto ? 'Misto' : paymentMethod) as IceCreamPaymentMethod, 
        buyer_name: saleData.buyer_name, 
        saleCode, 
        unitsSold: Math.round(item.unitsSold), 
        status: 'completed' as const 
      }));

      await onAddSaleAtomic(saleData, operationalSales, splitData);

      // Otimização: Atualização de estoque em lote (Promise.all)
      const stockUpdates: Promise<void>[] = [];
      for (const c of cart) {
        const itemDef = items.find(it => it.id === c.itemId);
        if (itemDef?.recipe) {
          for (const ingredient of itemDef.recipe) { 
            stockUpdates.push(onUpdateStock(effectiveStoreId, String(ingredient.stock_base_name).toUpperCase(), -(ingredient.quantity * c.unitsSold), '', 'adjustment')); 
          }
        }
      }
      if (stockUpdates.length > 0) await Promise.all(stockUpdates);

      handleOpenPrintPreview(operationalSales, saleCode, isMisto ? 'Misto' : (paymentMethod as string), saleData.buyer_name);
      setCart([]); 
      setPaymentMethod(null); 
      setBuyerName(''); 
      setAmountReceived(''); 
      setMistoValues({ 'Pix': '', 'Dinheiro': '', 'Cartão': '', 'Fiado': '' });
    } catch (e) { 
      alert("Falha ao registrar venda."); 
    } finally { 
      setIsSubmitting(false); 
    }
  };

  const handleCancelSale = async () => {
    if (!showCancelModal) return;
    
    console.time('⏱️ Cancelamento total');
    
    const targetSales = sales.filter(s => s.saleCode === showCancelModal.code);
    
    if (targetSales.length === 0) {
      alert("Venda não encontrada.");
      return;
    }
    
    const saleHeader = salesHeaders?.find(s => s.sale_code === showCancelModal.code);
    
    if (!saleHeader) {
      alert("Cabeçalho da venda não encontrado.");
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      console.time('⏱️ 1. Estorno de estoque');
      
      const stockUpdates: Promise<void>[] = [];
      
      for (const soldItem of targetSales) {
        const itemDef = items.find(it => it.id === soldItem.itemId) || 
                        items.find(it => it.name === soldItem.productName);
        
        if (itemDef?.recipe) {
          for (const ingredient of itemDef.recipe) {
            stockUpdates.push(
              onUpdateStock(
                effectiveStoreId,
                String(ingredient.stock_base_name).toUpperCase(),
                (ingredient.quantity * soldItem.unitsSold),
                '',
                'adjustment'
              )
            );
          }
        }
      }
      
      if (stockUpdates.length > 0) {
        console.log(`🔄 Executando ${stockUpdates.length} atualizações de estoque...`);
        await Promise.all(stockUpdates);
        console.log(`✅ ${stockUpdates.length} atualizações de estoque concluídas!`);
      }
      
      console.timeEnd('⏱️ 1. Estorno de estoque');
      
      console.time('⏱️ 2. Cancelamento no banco');
      
      const [salesUpdate, dailySalesUpdate] = await Promise.all([
        supabase
          .from('ice_cream_sales')
          .update({ 
            status: 'canceled',
            cancel_reason: cancelReason || 'Cancelado manualmente',
            canceled_by: user.id,
            canceled_by_name: user.name,
            canceled_at: new Date().toISOString()
          })
          .eq('id', saleHeader.id),
        
        supabase
          .from('ice_cream_daily_sales')
          .update({ status: 'canceled' })
          .eq('sale_id', saleHeader.id),

        // Limpeza financeira (essencial para integridade do DRE)
        supabase.from('financial_card_sales').delete().eq('sale_code', showCancelModal.code),
        supabase.from('financial_pix_sales').delete().eq('sale_code', showCancelModal.code),
        supabase.from('ice_cream_daily_sales_payments').delete().eq('sale_code', showCancelModal.code)
      ]);
      
      console.timeEnd('⏱️ 2. Cancelamento no banco');
      
      if (salesUpdate.error) {
        console.error('❌ Erro ice_cream_sales:', salesUpdate.error);
        throw new Error(`Erro: ${salesUpdate.error.message}`);
      }
      
      if (dailySalesUpdate.error) {
        console.error('❌ Erro ice_cream_daily_sales:', dailySalesUpdate.error);
        throw new Error(`Erro: ${dailySalesUpdate.error.message}`);
      }
      
      console.timeEnd('⏱️ Cancelamento total');
      
      setShowCancelModal(null);
      setCancelReason('');
      
      alert("✅ Venda cancelada com sucesso!");
      
      window.location.reload();
      
    } catch (error: any) {
      console.error('❌ Erro no cancelamento:', error);
      alert(`❌ Erro: ${error?.message || 'Erro desconhecido'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveProductForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try { await onSaveProduct({ ...productForm, storeId: effectiveStoreId }); setShowProductModal(false); setEditingProduct(null); alert("Produto salvo!"); } catch (e) { alert("Erro ao salvar."); } finally { setIsSubmitting(false); }
  };

  const handleSaveWastage = async () => {
      if (!wastageForm.stockId || !wastageForm.quantity || !effectiveStoreId) return;
      setIsSubmitting(true);
      try {
          const stItem = stock.find(s => s.stock_id === wastageForm.stockId);
          if (!stItem) throw new Error("Insumo não encontrado");
          
          const val = parseFloat(wastageForm.quantity.replace(',', '.'));
          await onUpdateStock(effectiveStoreId, stItem.product_base, -val, stItem.unit, 'adjustment', stItem.stock_id);
          
          // Add stock movement history
          await onAddStockMovement({
              stock_id: stItem.stock_id,
              store_id: effectiveStoreId,
              user_id: user.id,
              quantity: -val,
              movement_type: 'AVARIA',
              reason: wastageForm.reason || 'DEFEITO / AVARIA'
          });
          
          setWastageForm({ stockId: '', quantity: '', reason: 'DEFEITO / AVARIA' });
          setShowWastageModal(false);
          alert("Baixa de avaria realizada com sucesso!");
      } catch (e) {
          alert("Erro ao realizar baixa.");
      } finally {
          setIsSubmitting(false);
      }
  };

  const handleSaveSupplies = async () => {
    if (!newInsumo.name.trim() || !effectiveStoreId) return;
    setIsSubmitting(true);
    try {
      const val = parseFloat((newInsumo.initial || '0').replace(',', '.'));
      await onUpdateStock(effectiveStoreId, newInsumo.name.toUpperCase().trim(), val, newInsumo.unit, 'adjustment');
      setNewInsumo({ name: '', unit: 'un', initial: '' });
      setShowNewInsumoModal(false); alert("Insumo cadastrado!");
    } catch (e) { alert("Erro."); } finally { setIsSubmitting(false); }
  };

  const handleSaveSangria = async () => {
      if (!sangriaForm.amount || !sangriaForm.categoryId || !effectiveStoreId) {
          alert("Preencha valor e categoria.");
          return;
      }
      setIsSubmitting(true);
      try {
          const { error } = await supabase.rpc('create_ice_cream_sangria', {
              p_store_id: effectiveStoreId,
              p_user_id: user.id,
              p_category_id: sangriaForm.categoryId,
              p_amount: parseFloat(sangriaForm.amount.replace(',', '.')),
              p_description: sangriaForm.description || null,
              p_transaction_date: sangriaDate,
              p_notes: null
          });
          
          if (error) throw error;
          
          setSangriaForm({ amount: '', categoryId: '', description: '' });
          setSangriaDate(new Date().toISOString().split('T')[0]);
          setShowSangriaModal(false);
          alert("Sangria realizada com sucesso!");
      } catch (e: any) {
          alert("Erro ao realizar sangria: " + e.message);
      } finally {
          setIsSubmitting(false);
      }
  };

  const handleEditSangria = (sangria: any) => {
      setEditingSangria(sangria);
      setEditSangriaForm({
          amount: sangria.amount.toString(),
          categoryId: sangria.category_id,
          description: sangria.description || '',
          transactionDate: sangria.transaction_date || new Date(sangria.created_at).toISOString().split('T')[0],
          notes: sangria.notes || ''
      });
      setShowEditSangriaModal(true);
  };

  const handleSaveEditSangria = async () => {
      if (!editingSangria) return;
      setIsSubmitting(true);
      try {
          const { error } = await supabase.rpc('update_ice_cream_sangria_admin', {
              p_sangria_id: editingSangria.id,
              p_amount: parseFloat(editSangriaForm.amount.replace(',', '.')),
              p_description: editSangriaForm.description,
              p_category_id: editSangriaForm.categoryId,
              p_transaction_date: editSangriaForm.transactionDate,
              p_notes: editSangriaForm.notes
          });
          if (error) throw error;
          alert('Sangria atualizada com sucesso!');
          setShowEditSangriaModal(false);
          setEditingSangria(null);
      } catch (e: any) {
          alert('Erro: ' + e.message);
      } finally {
          setIsSubmitting(false);
      }
  };

  const handlePrintDRE = () => {
    const dDate = new Date(displayDate + 'T00:00:00');
    const storeName = stores.find(s => s.id === effectiveStoreId)?.name || 'Sorveteria Real';
    const dateStr = dDate.toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    
    const paymentSummary = {
        'À Vista': { count: dreStats.dayMethods.money.count, total: dreStats.dayMethods.money.total },
        'Fiado': { count: dreStats.dayMethods.fiado.count, total: dreStats.dayMethods.fiado.total },
        'Pix': { count: dreStats.dayMethods.pix.count, total: dreStats.dayMethods.pix.total },
        'Cartão': { count: dreStats.dayMethods.card.count, total: dreStats.dayMethods.card.total }
    };

    const totalFinanceiro = dreStats.dayIn;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const html = `
      <html>
        <head>
          <title>DRE DIÁRIO - ${storeName}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap');
            body { font-family: 'Inter', Arial, sans-serif; margin: 0; padding: 15mm; color: #1a1a1a; line-height: 1.4; }
            @media print {
              body { padding: 0; }
              @page { size: A4; margin: 15mm; }
              .no-print { display: none; }
              * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
            }
            .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #eee; padding-bottom: 20px; }
            .header h1 { margin: 0; font-size: 24px; font-weight: 900; text-transform: uppercase; letter-spacing: -1px; }
            .header h2 { margin: 5px 0; font-size: 18px; color: #666; font-weight: 700; }
            .header p { margin: 5px 0; font-size: 14px; color: #999; text-transform: capitalize; }
            
            .section { margin-bottom: 30px; page-break-inside: avoid; }
            .section-title { font-size: 12px; font-weight: 900; text-transform: uppercase; color: #666; margin-bottom: 15px; display: flex; align-items: center; gap: 8px; border-left: 4px solid #3b82f6; padding-left: 10px; }
            
            .product-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
            .product-table tr:nth-child(even) { background-color: #f9f9f9; }
            .product-table td { padding: 10px; font-size: 11px; border-bottom: 1px solid #eee; }
            .product-name { font-weight: 700; text-transform: uppercase; }
            .product-qty { text-align: right; color: #3b82f6; font-weight: 900; }
            .product-total { text-align: right; font-weight: 900; }
            
            .canceled-box { background-color: #fef2f2; border: 1px solid #fee2e2; padding: 15px; border-radius: 12px; margin-bottom: 30px; }
            .canceled-box p { margin: 0; font-size: 12px; font-weight: 900; color: #991b1b; }
            
            .payment-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
            .payment-box { border: 1px solid #eee; padding: 15px; border-radius: 12px; }
            .payment-box h5 { margin: 0 0 10px 0; font-size: 10px; font-weight: 900; text-transform: uppercase; color: #666; }
            .payment-box .row { display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 4px; }
            .payment-box .total { font-size: 14px; font-weight: 900; color: #1a1a1a; margin-top: 8px; border-top: 1px dashed #eee; padding-top: 8px; }
            
            .grand-total { text-align: center; padding: 25px; background: #f8fafc; border-radius: 20px; margin: 40px 0; border: 2px solid #e2e8f0; }
            .grand-total p { margin: 0; font-size: 10px; font-weight: 900; color: #64748b; text-transform: uppercase; letter-spacing: 2px; }
            .grand-total h3 { margin: 10px 0 0 0; font-size: 32px; font-weight: 900; color: #1e293b; font-style: italic; }
            
            .signatures { display: flex; justify-content: space-between; margin-top: 80px; gap: 40px; }
            .sig-block { flex: 1; text-align: center; }
            .sig-line { border-top: 1px solid #000; margin-bottom: 10px; }
            .sig-label { font-size: 10px; font-weight: 700; text-transform: uppercase; color: #666; }
            
            .footer { margin-top: 50px; text-align: center; font-size: 9px; color: #999; border-top: 1px solid #eee; padding-top: 20px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>🍦 DRE DIÁRIO - SORVETERIA REAL</h1>
            <h2>${storeName}</h2>
            <p>${dateStr}</p>
          </div>
          
          <div class="section">
            <div class="section-title">📊 RESUMO DO DIA</div>
            <table class="product-table">
              ${dreStats.resumoItensRodape.map(([name, data]: [string, any]) => `
                <tr>
                  <td class="product-name">${name}</td>
                  <td class="product-qty">${data.qtd} UNIDADES</td>
                  <td class="product-total">R$ ${data.total.toFixed(2).replace('.', ',')}</td>
                </tr>
              `).join('')}
              ${dreStats.resumoItensRodape.length === 0 ? '<tr><td colspan="3" style="text-align: center; padding: 20px; color: #999;">Nenhuma venda registrada</td></tr>' : ''}
            </table>
          </div>
          
          ${dreStats.dayCanceledCount > 0 ? `
            <div class="canceled-box">
              <p>❌ VENDAS CANCELADAS: ${dreStats.dayCanceledCount} vendas | TOTAL: R$ ${dreStats.dayCanceledTotal.toFixed(2).replace('.', ',')}</p>
            </div>
          ` : `
            <div class="section" style="margin-bottom: 15px; opacity: 0.5;">
              <div class="section-title" style="border-left-color: #cbd5e1;">❌ VENDAS CANCELADAS</div>
              <p style="font-size: 10px; font-weight: 700; color: #64748b; margin-left: 10px;">NENHUM CANCELAMENTO REGISTRADO</p>
            </div>
          `}
          
          <div class="section">
            <div class="section-title">💳 RESUMO FINANCEIRO POR MÉTODO</div>
            <div class="payment-grid">
              ${Object.entries(paymentSummary).map(([method, data]) => `
                <div class="payment-box">
                  <h5>${method}</h5>
                  <div class="row">
                    <span>Recebimentos:</span>
                    <span>${data.count}</span>
                  </div>
                  <div class="total">
                    <span>Total:</span>
                    <span>R$ ${data.total.toFixed(2).replace('.', ',')}</span>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
          
          <div class="grand-total">
            <p>Total Financeiro Geral</p>
            <h3>R$ ${totalFinanceiro.toFixed(2).replace('.', ',')}</h3>
          </div>
          
          <div class="signatures">
            <div class="sig-block">
              <div class="sig-line" style="margin-top: 60px;"></div>
              <div class="sig-label">Balconista</div>
            </div>
            <div class="sig-block">
              <div class="sig-line" style="margin-top: 60px;"></div>
              <div class="sig-label">${user.name} (Gerente)</div>
            </div>
          </div>
          
          <div class="footer">
            Gerado em: ${new Date().toLocaleString('pt-BR')} | Sistema de Gestão Sorveteria Real
          </div>
          
          <script>
            window.onload = () => {
              setTimeout(() => {
                window.print();
              }, 500);
            };
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
  };

  const handleDeleteSangria = async (sangriaId: string) => {
      if (!confirm('Tem certeza que deseja deletar esta sangria?')) return;
      setIsSubmitting(true);
      try {
          const { error } = await supabase.rpc('delete_ice_cream_sangria_admin', {
              p_sangria_id: sangriaId
          });
          if (error) throw error;
          alert('Sangria deletada com sucesso!');
      } catch (e: any) {
          alert('Erro: ' + e.message);
      } finally {
          setIsSubmitting(false);
      }
  };

  const handleSaveSangriaCategory = async () => {
      if (!newCategoryName.trim() || !effectiveStoreId) return;
      setIsSubmitting(true);
      try {
          await onAddSangriaCategory({
              store_id: effectiveStoreId,
              name: newCategoryName.trim().toUpperCase(),
              is_active: true
          });
          setNewCategoryName('');
          alert("Categoria cadastrada!");
      } catch (e) {
          alert("Erro ao cadastrar categoria.");
      } finally {
          setIsSubmitting(false);
      }
  };

  const handleSavePartner = async () => {
      if (!partnerForm.partner_name || !partnerForm.percentage || !effectiveStoreId) return;
      
      const newPercent = parseFloat(partnerForm.percentage.replace(',', '.'));
      const activeTotal = partners.filter(p => p.active).reduce((acc, p) => acc + p.percentage, 0);
      
      if (activeTotal + newPercent > 100.01) {
          alert(`A soma dos percentuais ativos (${(activeTotal + newPercent).toFixed(1)}%) não pode ultrapassar 100%.`);
          return;
      }

      setIsSubmitting(true);
      try {
          await supabase.from('store_profit_distribution').insert([{
              store_id: effectiveStoreId,
              partner_name: partnerForm.partner_name.toUpperCase(),
              percentage: newPercent,
              active: true
          }]);
          setPartnerForm({ partner_name: '', percentage: '' });
          fetchPartners();
          alert("Sócio adicionado!");
      } catch (e) {
          alert("Erro ao salvar sócio.");
      } finally {
          setIsSubmitting(false);
      }
  };

  const handleTogglePartner = async (id: string, active: boolean) => {
      if (active) {
          const pToToggle = partners.find(p => p.id === id);
          const activeTotal = partners.filter(p => p.active && p.id !== id).reduce((acc, p) => acc + p.percentage, 0);
          if (activeTotal + (pToToggle?.percentage || 0) > 100.01) {
              alert("Ativar este sócio faria a soma ultrapassar 100%.");
              return;
          }
      }
      try {
          await supabase.from('store_profit_distribution').update({ active }).eq('id', id);
          fetchPartners();
      } catch (e) {
          alert("Erro ao atualizar status.");
      }
  };

  const handleDeletePartner = async (id: string) => {
      if (!confirm("Excluir sócio?")) return;
      try {
          await supabase.from('store_profit_distribution').delete().eq('id', id);
          fetchPartners();
      } catch (e) {
          alert("Erro ao excluir.");
      }
  };

  const handleSavePurchase = async () => {
    setIsSubmitting(true);
    try {
      for (const [stockId, valueStr] of Object.entries(purchaseForm)) {
        const val = parseFloat((String(valueStr || '')).replace(',', '.'));
        if (Number.isNaN(val) || val === 0) continue;
        const stockItem = stock.find(s => s.stock_id === stockId);
        if (stockItem) await onUpdateStock(effectiveStoreId, stockItem.product_base, val, stockItem.unit, 'purchase', stockItem.stock_id);
      }
      setPurchaseForm({}); setShowPurchaseModal(true); alert("Estoque abastecido!");
    } catch (e) { alert("Erro."); } finally { setIsSubmitting(false); }
  };

  const handleSaveInventory = async () => {
    setIsSubmitting(true);
    try {
      for (const [stockId, valueStr] of Object.entries(inventoryForm)) {
        const parsed = parseFloat((String(valueStr || '')).replace(',', '.'));
        if (!Number.isFinite(parsed)) continue;
        const stockItem = stock.find(s => s.stock_id === stockId);
        if (stockItem) await onUpdateStock(effectiveStoreId, stockItem.product_base, parsed, stockItem.unit, 'inventory', stockItem.stock_id);
      }
      setInventoryForm({}); setShowInventoryModal(false); alert("Inventário atualizado!");
    } catch (e) { alert("Erro."); } finally { setIsSubmitting(false); }
  };

  const handleToggleFreezeStock = async (st: IceCreamStock) => {
      if (!isAdmin) {
          alert("Apenas administradores podem congelar insumos.");
          return;
      }

      const isUsedInRecipe = items.some(it => it.recipe?.some(r => String(r.stock_base_name).toUpperCase() === String(st.product_base).toUpperCase()));
      const warningMsg = isUsedInRecipe 
        ? `ATENÇÃO: O insumo "${st.product_base}" está vinculado à receita de um ou mais produtos ativos.\n\nCongelá-lo impedirá o abatimento automático e pode gerar inconsistências no controle de custos.\n\nDeseja continuar com o CONGELAMENTO mesmo assim?`
        : `Deseja CONGELAR o insumo "${st.product_base}"?\n\nEle não poderá mais ser usado em novas vendas ou compras, mas os dados antigos serão mantidos.`;

      if (window.confirm(warningMsg)) {
          await onDeleteStockItem(st.stock_id);
          alert("Insumo congelado com sucesso!");
      }
  };

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-slate-950 overflow-hidden font-sans relative transition-colors duration-300">
        <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 md:px-6 py-2 flex flex-col md:flex-row justify-between items-center gap-2 z-40 shadow-sm shrink-0 transition-colors duration-300">
            <div className="flex items-center gap-2">
                <div className="p-1.5 bg-blue-900 dark:bg-blue-700 rounded-xl text-white shadow-lg shrink-0"><IceCream size={18} /></div>
                <div className="truncate">
                    <h2 className="text-sm md:text-base font-black uppercase italic tracking-tighter text-blue-950 dark:text-white leading-none">Sorveteria <span className="text-red-600">Real</span></h2>
                    <div className="flex items-center gap-1 mt-0.5">
                        <p className="text-[7px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest leading-none">Unidade</p>
                        {isAdmin ? (
                            <select value={effectiveStoreId} onChange={(e) => setManualStoreId(e.target.value)} className="bg-transparent border-none text-[8px] font-black text-blue-600 dark:text-blue-400 uppercase outline-none focus:ring-0 p-0 h-auto min-h-0">
                                {[...stores].sort((a, b) => parseInt(a.number || '0') - parseInt(b.number || '0')).map(s => <option key={s.id} value={s.id} className="dark:bg-slate-900">{s.number} - {s.city}</option>)}
                            </select>
                        ) : <span className="text-[8px] font-black text-blue-600 dark:text-blue-400 uppercase">{stores.find(s => s.id === effectiveStoreId)?.number} - {stores.find(s => s.id === effectiveStoreId)?.city}</span>}
                    </div>
                </div>
            </div>
            <div className="flex flex-wrap bg-gray-100 dark:bg-slate-800 p-0.5 rounded-xl overflow-x-auto no-scrollbar w-full md:w-auto max-w-full transition-colors duration-300">
                {visibleTabs.map(tab => (
                    <button 
                        key={tab.label} 
                        onClick={() => setActiveTab(tab.view as any)} 
                        className={`flex-1 sm:flex-none px-3 py-2 rounded-lg text-[8px] md:text-[9px] font-black uppercase transition-all flex items-center justify-center gap-1.5 whitespace-nowrap ${activeTab === tab.view ? 'bg-white dark:bg-slate-700 text-blue-900 dark:text-white shadow-sm' : 'text-gray-400 dark:text-slate-500 hover:text-blue-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-slate-700/50'}`}
                    >
                        <tab.icon size={12}/> {tab.label}
                    </button>
                ))}
            </div>
        </div>

        <div className="flex-1 overflow-y-auto no-scrollbar relative">
            {activeTab === 'pdv' && (
                <div className="h-full">
                    <div className="lg:hidden h-full">
                            <PDVMobileView 
                                user={user} 
                                items={filteredItems} 
                                cart={cart} 
                                setCart={setCart} 
                                selectedCategory={selectedCategory} 
                                setSelectedCategory={setSelectedCategory} 
                                paymentMethod={paymentMethod} 
                                setPaymentMethod={setPaymentMethod} 
                                buyerName={buyerName} 
                                setBuyerName={setBuyerName} 
                                mistoValues={mistoValues} 
                                setMistoValues={setMistoValues} 
                                onAddSales={onAddSales} 
                                onAddSaleAtomic={onAddSaleAtomic}
                                onUpdateStock={onUpdateStock} 
                                handlePrintTicket={handleOpenPrintPreview} 
                                isSubmitting={isSubmitting} 
                                setIsSubmitting={setIsSubmitting} 
                                effectiveStoreId={effectiveStoreId} 
                                existingBuyerNames={existingBuyerNames}
                            />
                    </div>
                    <div className="hidden lg:grid grid-cols-12 gap-4 p-6 max-w-[1500px] mx-auto h-full overflow-hidden">
                        <div className="col-span-8 flex flex-col h-full overflow-hidden">
                            <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-3">
                                <button onClick={() => setSelectedCategory(null)} className={`px-5 py-2 rounded-xl font-black uppercase text-[10px] border-2 transition-all ${!selectedCategory ? 'bg-blue-900 text-white border-blue-900 shadow-lg' : 'bg-white text-gray-400 border-gray-100'}`}>Tudo</button>
                                {PRODUCT_CATEGORIES.map(cat => <button key={cat} onClick={() => setSelectedCategory(cat)} className={`px-5 py-2 rounded-xl font-black uppercase text-[10px] border-2 transition-all whitespace-nowrap ${selectedCategory === cat ? 'bg-blue-900 text-white border-blue-900 shadow-lg' : 'bg-white text-gray-400 border-gray-100'}`}>{cat}</button>)}
                            </div>
                            
                            <ProductGrid 
                                items={filteredItems} 
                                selectedCategory={selectedCategory}
                                onAddToCart={(item) => {
                                    setCart([...cart, { 
                                        id: `temp-${Date.now()}-${Math.random()}`, 
                                        storeId: effectiveStoreId, 
                                        itemId: item.id, 
                                        productName: item.name, 
                                        category: item.category, 
                                        flavor: item.flavor || 'Padrão', 
                                        unitsSold: 1, 
                                        unitPrice: item.price, 
                                        totalValue: item.price, 
                                        paymentMethod: 'Dinheiro' 
                                    }]); 
                                }}
                            />

                        </div>
                        <div className="col-span-4 bg-white rounded-[40px] shadow-2xl border border-gray-100 p-8 flex flex-col h-full overflow-hidden">
                            <h3 className="text-lg font-black uppercase italic mb-6 flex items-center gap-3 border-b pb-4"><ShoppingCart className="text-red-600" size={20} /> Venda <span className="text-gray-300 ml-auto font-bold text-xs">{cart.length} ITENS</span></h3>
                            <div className="flex-1 overflow-y-auto mb-6 space-y-2 no-scrollbar">
                                {cart.map((c) => (
                                    <div key={c.id} className="flex justify-between items-center p-4 bg-gray-50 rounded-2xl border border-gray-100">
                                        <div className="flex-1 min-w-0 pr-4"><p className="font-black uppercase text-[10px] truncate">{c.productName}</p><p className="text-[9px] text-gray-400 font-bold uppercase">{formatCurrency(c.unitPrice)}</p></div>
                                        <div className="flex items-center gap-3"><span className="font-black text-blue-900 text-xs">{formatCurrency(c.totalValue)}</span><button onClick={() => setCart(cart.filter(item => item.id !== c.id))} className="p-1.5 text-red-300 hover:text-red-600"><Trash2 size={14}/></button></div>
                                    </div>
                                ))}
                            </div>
                            <div className="pt-4 border-t space-y-4">
                                <div className="flex justify-between items-baseline"><span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Subtotal</span><span className="text-3xl font-black text-blue-950 italic">{formatCurrency(cartTotal)}</span></div>
                                <div className="grid grid-cols-2 gap-2">
                                    {['Pix', 'Dinheiro', 'Cartão', 'Fiado', 'Misto'].map(m => <button key={m} onClick={() => { setPaymentMethod(m as any); if(m !== 'Dinheiro' && m !== 'Misto' && m !== 'Fiado') setAmountReceived(''); }} className={`py-3 rounded-xl font-black uppercase text-[10px] border-2 transition-all ${paymentMethod === m ? 'bg-blue-900 text-white border-blue-900 shadow-xl' : 'bg-white border-gray-200 text-gray-400'}`}>{m}</button>)}
                                </div>
                                {paymentMethod === 'Dinheiro' && (
                                    <div className="bg-green-50 p-4 rounded-2xl border-2 border-green-200 space-y-3">
                                        <div className="flex justify-between items-center"><label className="text-[10px] font-black text-green-700 uppercase">Valor Recebido</label><input value={amountReceived} onChange={e => setAmountReceived(e.target.value)} placeholder="0,00" className="w-32 text-right bg-white border-none rounded-xl p-3 font-black text-green-700 outline-none text-lg shadow-inner" /></div>
                                        <div className="flex justify-between items-baseline border-t border-green-100 pt-2"><span className="text-[10px] font-black text-green-700 uppercase">Troco</span><span className="text-2xl font-black text-green-700 italic">{formatCurrency(changeDue)}</span></div>
                                    </div>
                                )}
                                {paymentMethod === 'Misto' && (
                                    <div className="bg-blue-50 p-4 rounded-2xl border-2 border-blue-200 space-y-2">
                                        {['Pix', 'Dinheiro', 'Cartão', 'Fiado'].map(m => <div key={m} className="flex justify-between items-center bg-white px-3 py-2 rounded-lg border border-blue-50"><label className="text-[10px] font-black text-gray-500 uppercase">{m}</label><input value={mistoValues[m]} onChange={e => setMistoValues({...mistoValues, [m]: e.target.value})} placeholder="0,00" className="w-20 text-right font-black text-blue-900 text-xs outline-none bg-transparent" /></div>)}
                                    </div>
                                )}
                                {(paymentMethod === 'Fiado' || (paymentMethod === 'Misto' && mistoValues['Fiado'])) && <input value={buyerName} onChange={e => setBuyerName(e.target.value.toUpperCase())} className="w-full p-4 bg-red-50 border-2 border-red-100 rounded-2xl font-black uppercase text-sm outline-none" placeholder="NOME DO FUNCIONÁRIO..." />}
                                <button onClick={finalizeSale} disabled={isSubmitting || cart.length === 0 || !paymentMethod} className="w-full py-5 bg-red-600 hover:bg-red-700 text-white rounded-[24px] font-black uppercase text-xs shadow-2xl flex items-center justify-center gap-3 transition-all border-b-4 border-red-900">{isSubmitting ? <Loader2 className="animate-spin" /> : <CheckCircle2 size={18}/>} Finalizar Venda</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'dre_diario' && (
                <div className="p-4 md:p-8 space-y-6 animate-in fade-in duration-300 max-w-5xl mx-auto pb-20">
                    <div className="bg-white p-8 rounded-[40px] shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between items-center gap-6">
                        <div className="flex items-center gap-4">
                            <div className="p-4 bg-blue-50 text-blue-700 rounded-3xl"><Clock size={32}/></div>
                            <div>
                                <h3 className="text-2xl font-black uppercase italic text-blue-950 tracking-tighter">Fluxo de Caixa <span className="text-blue-700">Diário</span></h3>
                                <div className="flex items-center gap-2 mt-2">
                                    <input 
                                        type="date" 
                                        value={displayDate} 
                                        onChange={e => setDisplayDate(e.target.value)} 
                                        className="bg-transparent border-none text-[10px] font-black uppercase text-gray-400 outline-none cursor-pointer hover:text-blue-600 transition-all"
                                    />
                                    <span className="text-[10px] font-bold text-gray-300 uppercase tracking-widest">• {new Date(displayDate + 'T00:00:00').toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
                                </div>
                                <div className="flex bg-gray-100 p-1 rounded-lg mt-2">
                                    <button onClick={() => setDreSubTab('resumo')} className={`px-4 py-1.5 rounded-md text-[9px] font-black uppercase transition-all ${dreSubTab === 'resumo' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-400'}`}>Resumo</button>
                                    <button onClick={() => setDreSubTab('detalhado')} className={`px-4 py-1.5 rounded-md text-[9px] font-black uppercase transition-all ${dreSubTab === 'detalhado' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-400'}`}>Detalhado</button>
                                </div>
                            </div>
                        </div>
                        <div className="flex flex-col items-end gap-3">
                            <div className="flex gap-2">
                                <button onClick={() => setShowSangriaModal(true)} className="px-6 py-2.5 bg-red-500 text-white rounded-xl font-black uppercase text-[10px] shadow-lg flex items-center gap-2 border-b-4 border-red-700 active:scale-95"><DollarSign size={14}/> Sangria</button>
                                <button onClick={() => setShowWastageModal(true)} className="px-6 py-2.5 bg-orange-500 text-white rounded-xl font-black uppercase text-[10px] shadow-lg flex items-center gap-2 border-b-4 border-orange-700 active:scale-95"><AlertTriangle size={14}/> Baixa Avaria</button>
                            </div>
                            <button
                                onClick={handlePrintDRE}
                                className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-2xl font-black uppercase text-xs hover:bg-blue-700 transition-all shadow-lg active:scale-95 w-full justify-center"
                            >
                                <Printer size={20} />
                                Imprimir DRE
                            </button>
                        </div>
                    </div>
                  {dreSubTab === 'resumo' && (
                        <div className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="bg-white p-6 rounded-[32px] border-2 border-green-100 shadow-sm space-y-4">
                                    <span className="text-[9px] font-black text-green-600 uppercase tracking-widest">Resumo Entradas (+)</span>
                                    <div className="space-y-2">
                                        <div className="flex justify-between items-center text-[10px] font-black border-b border-gray-50 pb-1"><span className="text-gray-400 uppercase">Pix</span><span className="text-gray-900">{formatCurrency(dreStats.dayMethods.pix.total)}</span></div>
                                        <div className="flex justify-between items-center text-[10px] font-black border-b border-gray-50 pb-1"><span className="text-gray-400 uppercase">Dinheiro</span><span className="text-gray-900">{formatCurrency(dreStats.dayMethods.money.total)}</span></div>
                                        <div className="flex justify-between items-center text-[10px] font-black border-b border-gray-50 pb-1"><span className="text-gray-400 uppercase">Cartão</span><span className="text-gray-900">{formatCurrency(dreStats.dayMethods.card.total)}</span></div>
                                        <div className="flex justify-between items-center text-[10px] font-black border-b border-gray-50 pb-1"><span className="text-gray-400 uppercase">Fiado</span><span className="text-gray-900">{formatCurrency(dreStats.dayMethods.fiado.total)}</span></div>
                                    </div>
                                    <div className="pt-2 border-t-2 border-green-50"><p className="text-2xl font-black text-green-700 italic">{formatCurrency(dreStats.dayIn)}</p></div>
                                </div>
                                <div className="bg-white p-6 rounded-[32px] border-2 border-red-100 shadow-sm flex flex-col justify-between cursor-pointer hover:bg-red-50 transition-all" onClick={() => setShowSangriaDetailModal('day')}>
                                    <div>
                                        <span className="text-[9px] font-black text-red-600 uppercase tracking-widest flex items-center gap-2">Resumo Saídas (-) <ExternalLink size={10}/></span>
                                        <p className="text-3xl font-black text-red-700 italic mt-4">{formatCurrency(dreStats.daySangriaTotal)}</p>
                                    </div>
                                </div>
                                <div className="bg-gray-950 p-6 rounded-[32px] text-white shadow-xl flex flex-col justify-between">
                                    <div>
                                        <span className="text-[9px] font-black text-blue-400 uppercase tracking-widest">Saldo Líquido</span>
                                        <p className="text-3xl font-black italic mt-4">{formatCurrency(dreStats.dayProfit)}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Vendas Canceladas - Detalhamento Diário */}
                            <div className="bg-white p-8 rounded-[40px] border border-gray-100 shadow-sm">
                                <div className="flex justify-between items-center mb-6">
                                    <h4 className="text-[10px] font-black text-red-500 uppercase tracking-widest flex items-center gap-2">
                                        <XCircle size={16} /> Vendas Canceladas no Dia ({dreStats.dayCanceledCount})
                                    </h4>
                                    <button 
                                        onClick={() => setShowCanceledDetails(!showCanceledDetails)}
                                        className="px-4 py-2 bg-gray-50 rounded-xl text-[10px] font-black uppercase hover:bg-gray-100 transition-all flex items-center gap-2"
                                    >
                                        {showCanceledDetails ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}
                                        {showCanceledDetails ? 'Ocultar Detalhes' : 'Ver Detalhes'}
                                    </button>
                                </div>
                                
                                {showCanceledDetails && (
                                    <div className="space-y-3 animate-in slide-in-from-top-2 duration-300">
                                        {dreStats.dayCanceledDetails.map(c => (
                                            <div key={c.id} className="flex justify-between items-center p-4 bg-red-50/50 rounded-2xl border border-red-100">
                                                <div className="flex flex-col">
                                                    <span className="text-[10px] font-black text-red-900 uppercase">#{c.saleCode} - {new Date(c.createdAt).toLocaleTimeString()}</span>
                                                    <span className="text-[9px] font-bold text-gray-500 uppercase mt-1">Motivo: <span className="text-red-600 italic">{c.cancelReason}</span></span>
                                                    <span className="text-[8px] font-black text-gray-400 uppercase">Por: {c.canceledBy}</span>
                                                </div>
                                                <span className="font-black text-red-700 text-sm">{formatCurrency(c.totalValue)}</span>
                                            </div>
                                        ))}
                                        {dreStats.dayCanceledDetails.length === 0 && (
                                            <p className="text-center text-[9px] text-gray-400 uppercase italic py-4">Nenhum cancelamento hoje</p>
                                        )}
                                    </div>
                                )}
                            </div>

                            <div className="bg-white p-8 rounded-[40px] border border-gray-100 shadow-sm">
                                <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                                    <Activity size={16} className="text-blue-600" /> RESUMO OPERACIONAL DO PERÍODO
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                                        <p className="text-[9px] font-black text-gray-400 uppercase">Total de Sangrias</p>
                                        <p className="text-xl font-black text-red-600 italic">{formatCurrency(dreStats.daySangriaTotal)}</p>
                                    </div>
                                    <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                                        <p className="text-[9px] font-black text-gray-400 uppercase">Total de Avarias</p>
                                        <p className="text-xl font-black text-orange-600 italic">{dreStats.dayWastageTotal.toFixed(2)}</p>
                                    </div>
                                    <div className="p-4 bg-blue-950 rounded-2xl border border-blue-900 text-white">
                                        <p className="text-[9px] font-black text-blue-300 uppercase">Margem Líquida (%)</p>
                                        <p className="text-xl font-black italic">{dreStats.dayIn > 0 ? ((dreStats.dayProfit / dreStats.dayIn) * 100).toFixed(1) : '0.0'}%</p>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-white p-8 rounded-[40px] border border-gray-100 shadow-sm">
                                <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                                    <ListChecks size={16} className="text-blue-600" /> Resumo de Itens Vendidos no Dia
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {dreStats.resumoItensRodape?.map(([nome, dados]: [string, any]) => (
                                        <div key={nome} className="flex justify-between items-center bg-gray-50 p-4 rounded-2xl border border-gray-100">
                                            <div className="flex flex-col">
                                                <span className="text-[10px] font-black uppercase text-blue-950 truncate max-w-[150px]">{nome}</span>
                                                <span className="text-blue-600 font-black uppercase mt-1">
                                                    QTD: <span className="text-lg font-black">{dados.qtd}</span>
                                                </span>
                                            </div>
                                            <span className="text-xs font-black text-gray-900">{formatCurrency(dados.total)}</span>
                                        </div>
                                    ))}
                                    {(!dreStats.resumoItensRodape || dreStats.resumoItensRodape.length === 0) && (
                                        <p className="col-span-full text-center text-[9px] text-gray-400 uppercase italic py-4">Nenhuma venda hoje</p>
                                    )}
                                </div>
                            </div>

                            <div className="bg-white p-8 rounded-[40px] border border-gray-100 shadow-sm">
                                <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                                    <ArrowDownCircle size={16} className="text-red-500" /> Detalhamento de Saídas (Sangrias)
                                </h4>
                                <div className="space-y-3">
                                    {dreStats.dayExits?.map((f: any) => (
                                        <div key={f.id} className="flex justify-between items-center p-4 bg-red-50 rounded-2xl border border-red-100">
                                            <div>
                                                <span className="text-[10px] font-black text-red-900 uppercase italic">{f.description}</span>
                                                <p className="text-[8px] font-bold text-red-400 uppercase">{f.category}</p>
                                            </div>
                                            <span className="font-black text-red-700 text-sm">-{formatCurrency(f.value)}</span>
                                        </div>
                                    ))}
                                    {(!dreStats.dayExits || dreStats.dayExits.length === 0) && (
                                        <p className="text-center text-[9px] text-gray-400 uppercase italic py-4">Nenhuma sangria hoje</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                    {dreSubTab === 'detalhado' && (
                        <div className="bg-white rounded-[40px] shadow-xl border border-gray-100 overflow-hidden"><table className="w-full text-left"><thead className="bg-gray-50 text-[9px] font-black text-gray-400 uppercase tracking-widest border-b"><tr><th className="px-6 py-4">Horário / Código</th><th className="px-6 py-4">Operação</th><th className="px-6 py-4 text-right">Valor</th></tr></thead><tbody className="divide-y divide-gray-50 font-bold text-[10px]">{dreStats.daySales.map(s => <tr key={s.id} className="hover:bg-green-50/20"><td className="px-6 py-3 text-gray-400">#{s.saleCode} <span className="block">{new Date(s.createdAt!).toLocaleTimeString()}</span></td><td className="px-6 py-3 uppercase text-gray-900">VENDA: {s.productName}</td><td className="px-6 py-3 text-right text-green-600">{formatCurrency(s.totalValue)}</td></tr>)}</tbody></table></div>
                    )}
                </div>
            )}

            {activeTab === 'dre_mensal' && (
                <div className="p-4 md:p-8 space-y-8 animate-in fade-in duration-300 max-w-6xl mx-auto pb-20">
                    <div className="bg-white p-8 rounded-[40px] shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between items-center gap-6">
                        <div className="flex items-center gap-4"><div className="p-4 bg-purple-50 text-purple-700 rounded-3xl"><FilePieChart size={32}/></div><div><h3 className="text-2xl font-black uppercase italic text-blue-950 tracking-tighter">DRE <span className="text-purple-700">Mensal</span></h3></div></div>
                        <div className="flex flex-col sm:flex-row items-center gap-3">
                            <div className="flex items-center gap-2 bg-gray-50 dark:bg-slate-800 p-2 rounded-2xl border dark:border-slate-700"><select value={selectedMonth} onChange={e => setSelectedMonth(Number(e.target.value))} className="bg-transparent border-none text-xs font-black uppercase text-slate-900 dark:text-white outline-none">{MONTHS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}</select><select value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))} className="bg-transparent border-none text-xs font-black text-slate-900 dark:text-white outline-none">{[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}</select></div>
                            <button onClick={handlePrintDreMensal} className="px-6 py-2.5 bg-gray-900 text-white rounded-xl font-black uppercase text-[10px] shadow-lg flex items-center gap-2 border-b-4 border-gray-700 active:scale-95"><Printer size={14}/> Imprimir Relatório (A4)</button>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                        <div className="lg:col-span-8 space-y-6">
                            <div className="bg-white p-8 rounded-[40px] shadow-sm border border-gray-100"><h4 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-6 flex items-center gap-2"><Briefcase size={14}/> Demonstrativo de Resultado</h4><div className="space-y-4">
                                <div className="flex justify-between items-center pb-4 border-b"><span className="font-bold text-gray-600 uppercase text-xs">Faturamento (+)</span><span className="font-black text-green-600 text-lg">{formatCurrency(dreStats.monthIn)}</span></div>
                                <div className="flex justify-between items-center pb-4 border-b cursor-pointer hover:bg-red-50 transition-all rounded-lg px-2 -mx-2" onClick={() => setShowSangriaDetailModal('month')}>
                                    <span className="font-bold text-gray-600 uppercase text-xs flex items-center gap-2">Despesas / Saídas (-) <ExternalLink size={10}/></span>
                                    <span className="font-black text-red-600 text-lg">{formatCurrency(dreStats.monthSangriaTotal)}</span>
                                </div>
                                <div className="flex justify-between items-center pt-2"><span className="font-black text-blue-950 uppercase text-sm">Lucro Líquido (=)</span><span className="font-black text-blue-900 text-2xl italic">{formatCurrency(dreStats.profit)}</span></div>
                            </div></div>
                            <div className="bg-white p-8 rounded-[40px] shadow-sm border border-gray-100">
                                <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                                    <Activity size={16} className="text-blue-600" /> RESUMO OPERACIONAL DO PERÍODO
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                                    <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                                        <p className="text-[9px] font-black text-gray-400 uppercase">Total de Sangrias</p>
                                        <p className="text-xl font-black text-red-600 italic">{formatCurrency(dreStats.monthSangriaTotal)}</p>
                                    </div>
                                    <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                                        <p className="text-[9px] font-black text-gray-400 uppercase">Total de Avarias</p>
                                        <p className="text-xl font-black text-orange-600 italic">{dreStats.monthWastageTotal.toFixed(2)}</p>
                                    </div>
                                    <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                                        <p className="text-[9px] font-black text-gray-400 uppercase">Vendas Canceladas</p>
                                        <p className="text-xl font-black text-gray-600 italic">{formatCurrency(dreStats.monthCanceledTotal)}</p>
                                    </div>
                                    <div className="p-4 bg-blue-950 rounded-2xl border border-blue-900 text-white">
                                        <p className="text-[9px] font-black text-blue-300 uppercase">Margem Líquida (%)</p>
                                        <p className="text-xl font-black italic">{dreStats.monthIn > 0 ? ((dreStats.profit / dreStats.monthIn) * 100).toFixed(1) : '0.0'}%</p>
                                    </div>
                                </div>
                            </div>
                            <div className="bg-white p-8 rounded-[40px] shadow-sm border border-gray-100">
                                <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-4">Detalhamento por Método</h4>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    <div className="p-4 bg-gray-50 rounded-2xl"><p className="text-[8px] font-black text-gray-400 uppercase">Pix</p><p className="font-black text-blue-900">{formatCurrency(dreStats.monthMethods.pix)}</p></div>
                                    <div className="p-4 bg-gray-50 rounded-2xl"><p className="text-[8px] font-black text-gray-400 uppercase">Dinheiro</p><p className="font-black text-green-700">{formatCurrency(dreStats.monthMethods.money)}</p></div>
                                    <div className="p-4 bg-gray-50 rounded-2xl"><p className="text-[8px] font-black text-gray-400 uppercase">Cartão</p><p className="font-black text-orange-600">{formatCurrency(dreStats.monthMethods.card)}</p></div>
                                    <div className="p-4 bg-gray-50 rounded-2xl"><p className="text-[8px] font-black text-gray-400 uppercase">Fiado</p><p className="font-black text-red-600">{formatCurrency(dreStats.monthMethods.fiado)}</p></div>
                                </div>
                            </div>
                        </div>
                        <div className="lg:col-span-4 bg-gray-950 p-8 rounded-[40px] text-white shadow-2xl flex flex-col h-fit">
                            <div className="flex justify-between items-center mb-6">
                                <h4 className="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em] flex items-center gap-3"><UsersIcon size={16}/> Partilha de Lucros</h4>
                                {can('admin_settings') && (
                                    <button onClick={() => setShowPartnersModal(true)} className="text-blue-400 hover:text-blue-200 transition-all">
                                        <Settings size={16}/>
                                    </button>
                                )}
                            </div>
                            <div className="space-y-4">{partners.map(p => <div key={p.id} className="border-b border-white/5 pb-4 last:border-0"><div className="flex justify-between items-baseline mb-1"><span className="text-[10px] font-black uppercase italic tracking-tighter">{p.partner_name}</span><span className="text-[9px] font-bold text-blue-400">{p.percentage}%</span></div><p className="text-xl font-black italic tracking-tighter text-blue-100">{formatCurrency((dreStats.profit * p.percentage) / 100)}</p></div>)}</div>
                            {partners.length === 0 && <p className="text-[9px] text-gray-600 uppercase text-center py-10 italic">Nenhuma partilha configurada</p>}
                        </div>
                    </div>
                    <div className="bg-white rounded-[40px] shadow-xl border border-gray-100 overflow-hidden">
                        <div className="p-6 bg-red-50 border-b border-red-100 flex justify-between items-center">
                            <div>
                                <h4 className="text-xs font-black uppercase text-red-700 flex items-center gap-2"><ClipboardList size={16}/> Débito Funcionário - Resumo Mensal</h4>
                                <p className="text-[9px] font-bold text-red-400 uppercase mt-1">Soma total por colaborador</p>
                            </div>
                            <span className="text-lg font-black text-red-700 italic">{formatCurrency(dreStats.monthMethods.fiado)}</span>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-gray-50 text-[9px] font-black text-gray-400 uppercase tracking-widest border-b">
                                    <tr>
                                        <th className="px-8 py-4">Colaborador / Profissional</th>
                                        <th className="px-8 py-4 text-right">Total Acumulado (R$)</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50 font-bold text-[10px]">
                                    {monthFiadoGrouped.map((f, i) => (
                                        <React.Fragment key={f.name}>
                                            <tr onClick={() => setExpandedEmployee(expandedEmployee === f.name ? null : f.name)} className={`hover:bg-red-50/20 cursor-pointer transition-all ${expandedEmployee === f.name ? 'bg-red-50/40' : ''}`}>
                                                <td className="px-8 py-4 flex items-center gap-3">
                                                    {expandedEmployee === f.name ? <ChevronUp size={14} className="text-red-500" /> : <ChevronDown size={14} className="text-gray-400" />}
                                                    <span className="text-blue-950 uppercase italic text-xs tracking-tighter">{f.name}</span>
                                                </td>
                                                <td className="px-8 py-4 text-right text-red-700 text-sm font-black italic">{formatCurrency(f.total)}</td>
                                            </tr>
                                            {expandedEmployee === f.name && (
                                                <tr className="bg-gray-50/50">
                                                    <td colSpan={2} className="px-12 py-6">
                                                        <div className="bg-white rounded-2xl border border-red-100 shadow-sm overflow-hidden">
                                                            <div className="p-3 bg-red-600 text-white text-[8px] font-black uppercase tracking-widest">Histórico Detalhado: {f.name}</div>
                                                            <table className="w-full text-[9px] font-bold">
                                                                <thead className="bg-gray-50 border-b border-gray-100 text-gray-400 uppercase">
                                                                    <tr><th className="px-4 py-2 text-gray-900">Data</th><th className="px-4 py-2 text-gray-900">Cód. Venda</th><th className="px-4 py-2 text-gray-900">Item</th><th className="px-4 py-2 text-right text-gray-900">Valor</th></tr>
                                                                </thead>
                                                                <tbody className="divide-y divide-gray-50">
                                                                    {f.items.map((item, idx) => (
                                                                        <tr key={idx}>
                                                                            <td className="px-4 py-2 text-gray-900">{new Date(item.createdAt).toLocaleDateString('pt-BR')}</td>
                                                                            <td className="px-4 py-2 text-blue-900 font-black">#{item.saleCode}</td>
                                                                            <td className="px-4 py-2 uppercase italic text-blue-950 font-black">{item.productName}</td>
                                                                            <td className="px-4 py-2 text-right text-red-600 font-black">{formatCurrency(item.totalValue)}</td>
                                                                        </tr>
                                                                    ))}
                                                                </tbody>
                                                            </table>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    ))}
                                    {monthFiadoGrouped.length === 0 && (<tr><td colSpan={2} className="p-16 text-center text-gray-400 uppercase tracking-[0.3em] italic">Nenhuma compra no fiado</td></tr>)}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="bg-white rounded-[40px] shadow-xl border border-gray-100 overflow-hidden">
                        <div className="p-6 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
                            <div>
                                <h4 className="text-xs font-black uppercase text-gray-700 flex items-center gap-2"><XCircle size={16} className="text-gray-400" /> Vendas Canceladas - Detalhamento Mensal</h4>
                                <p className="text-[9px] font-bold text-gray-400 uppercase mt-1">Histórico de cancelamentos do período</p>
                            </div>
                            <button 
                                onClick={() => setShowCanceledDetails(!showCanceledDetails)}
                                className="px-4 py-2 bg-white border rounded-xl text-[10px] font-black uppercase hover:bg-gray-50 transition-all flex items-center gap-2"
                            >
                                {showCanceledDetails ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}
                                {showCanceledDetails ? 'Ocultar Detalhes' : 'Ver Detalhes'}
                            </button>
                        </div>
                        {showCanceledDetails && (
                            <div className="overflow-x-auto animate-in slide-in-from-top-2 duration-300">
                                <table className="w-full text-left">
                                    <thead className="bg-gray-50 text-[9px] font-black text-gray-400 uppercase tracking-widest border-b">
                                        <tr>
                                            <th className="px-8 py-4">Código / Data</th>
                                            <th className="px-8 py-4">Cancelado Por</th>
                                            <th className="px-8 py-4">Motivo</th>
                                            <th className="px-8 py-4 text-right">Valor Estornado</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50 font-bold text-[10px]">
                                        {dreStats.monthCanceledDetails.map(c => (
                                            <tr key={c.id} className="hover:bg-gray-50/50 transition-all">
                                                <td className="px-8 py-4">
                                                    <span className="block text-blue-950 font-black">#{c.saleCode}</span>
                                                    <span className="text-[9px] text-gray-400">{new Date(c.createdAt).toLocaleString()}</span>
                                                </td>
                                                <td className="px-8 py-4 uppercase text-gray-600">{c.canceledBy}</td>
                                                <td className="px-8 py-4 uppercase text-gray-400 italic max-w-xs truncate">{c.cancelReason}</td>
                                                <td className="px-8 py-4 text-right text-gray-900 font-black italic">{formatCurrency(c.totalValue)}</td>
                                            </tr>
                                        ))}
                                        {dreStats.monthCanceledDetails.length === 0 && (
                                            <tr>
                                                <td colSpan={4} className="px-8 py-10 text-center text-gray-400 uppercase italic text-[9px]">Nenhum cancelamento registrado</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {activeTab === 'estoque' && (
                <div className="p-4 md:p-8 space-y-6 animate-in fade-in duration-300 max-w-6xl mx-auto pb-20">
                    <div className="bg-white p-8 rounded-[40px] shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between items-center gap-6">
                        <div className="flex items-center gap-4"><div className="p-4 bg-orange-50 text-orange-600 rounded-3xl"><Warehouse size={32}/></div><div><h3 className="text-2xl font-black uppercase italic text-blue-950 tracking-tighter">Controle de <span className="text-orange-600">Insumos</span></h3></div></div>
                        <div className="flex flex-wrap gap-2">
                          <button onClick={() => setShowNewInsumoModal(true)} className="px-4 py-2 bg-gray-900 text-white rounded-xl font-black uppercase text-[9px] shadow-lg flex items-center gap-2 border-b-2 border-black active:scale-95"><Plus size={14}/> Novo Insumo</button>
                          <button onClick={() => { setPurchaseForm({}); setShowPurchaseModal(true); }} className="px-4 py-2 bg-blue-600 text-white rounded-xl font-black uppercase text-[9px] shadow-lg flex items-center gap-2 border-b-2 border-blue-900 active:scale-95"><Truck size={14}/> Lançar Compra</button>
                          <button onClick={() => { const initialInv: Record<string, string> = {}; filteredStock.forEach(s => initialInv[s.stock_id] = s.stock_current.toString()); setInventoryForm(initialInv); setShowInventoryModal(true); }} className="px-4 py-2 bg-orange-600 text-white rounded-xl font-black uppercase text-[9px] shadow-lg flex items-center gap-2 border-b-2 border-orange-900 active:scale-95"><PencilLine size={14}/> Inventário</button>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {filteredStock.map(st => (
                            <div key={st.stock_id} className={`bg-white p-6 rounded-[32px] shadow-sm border border-gray-100 relative group overflow-hidden ${st.is_active === false ? 'opacity-40 grayscale' : ''}`}>
                                {isAdmin && (
                                    <button 
                                        onClick={() => handleToggleFreezeStock(st)} 
                                        className="absolute top-4 right-4 p-2 text-gray-300 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-all z-10"
                                        title="Congelar Insumo"
                                    >
                                        <Trash2 size={16}/>
                                    </button>
                                )}
                                <div className={`p-2 rounded-xl text-white w-fit mb-4 ${st.stock_current <= 5 ? 'bg-red-500 animate-pulse' : 'bg-orange-500'}`}>
                                    <Package size={16}/>
                                </div>
                                <h4 className="text-[10px] font-black text-blue-950 uppercase italic leading-none mb-2 truncate pr-6">{st.product_base}</h4>
                                <div className="flex items-baseline gap-1">
                                    <span className={`text-2xl font-black italic tracking-tighter ${st.stock_current <= 5 ? 'text-red-600' : 'text-gray-900'}`}>{st.stock_current}</span>
                                    <span className="text-[8px] font-bold text-gray-400 uppercase tracking-widest">{st.unit}</span>
                                </div>
                            </div>
                        ))}
                        {filteredStock.length === 0 && (
                            <div className="col-span-full py-20 text-center bg-gray-50 border-2 border-dashed border-gray-200 rounded-[32px]">
                                <Info className="mx-auto text-gray-300 mb-3" size={40}/>
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Nenhum insumo ativo no momento</p>
                            </div>
                        )}
                    </div>
                </div>
            )}
            
            {activeTab === 'audit' && (
                <div className="p-4 md:p-8 space-y-6 animate-in fade-in duration-300 max-w-6xl mx-auto pb-20">
                    <div className="bg-white p-6 rounded-[40px] shadow-sm border border-gray-100 flex flex-col gap-6">
                        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                            <div>
                                <h3 className="text-xl font-black uppercase italic text-blue-950 tracking-tighter flex items-center gap-3"><History className="text-blue-700" size={28}/> Auditoria <span className="text-red-600">Geral</span></h3>
                                <div className="flex bg-gray-100 p-1 rounded-xl mt-3">
                                    <button onClick={() => setAuditSubTab('vendas')} className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${auditSubTab === 'vendas' ? 'bg-white text-blue-900 shadow-sm' : 'text-gray-400'}`}>Vendas Operacionais</button>
                                    <button onClick={() => setAuditSubTab('avarias')} className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${auditSubTab === 'avarias' ? 'bg-white text-blue-900 shadow-sm' : 'text-gray-400'}`}>Baixas / Avarias</button>
                                </div>
                            </div>
                            {/* NOVA FUNCIONALIDADE — BOTÃO RESUMO DO DIA */}
                            <div className="flex items-center gap-3">
                                <button 
                                    onClick={() => setShowDaySummary(!showDaySummary)}
                                    className="px-6 py-3 bg-blue-600 text-white rounded-2xl font-black uppercase text-[10px] shadow-lg flex items-center gap-2 hover:bg-blue-700 transition-all"
                                >
                                    📊 Resumo do Dia
                                </button>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                            <select value={auditDay} onChange={e => setAuditDay(e.target.value)} className="bg-gray-50 dark:bg-slate-800 border-none rounded-xl p-3 text-[10px] font-black uppercase text-slate-900 dark:text-white outline-none shadow-inner"><option value="">DIA</option>{Array.from({length: 31}, (_, i) => <option key={i+1} value={String(i+1)}>{i+1}</option>)}</select>
                            <select value={auditMonth} onChange={e => setAuditMonth(e.target.value)} className="bg-gray-50 dark:bg-slate-800 border-none rounded-xl p-3 text-[10px] font-black uppercase text-slate-900 dark:text-white outline-none shadow-inner"><option value="">MÊS</option>{MONTHS.map(m => <option key={m.value} value={String(m.value)}>{m.label}</option>)}</select>
                            <select value={auditYear} onChange={e => setAuditYear(e.target.value)} className="bg-gray-50 dark:bg-slate-800 border-none rounded-xl p-3 text-[10px] font-black uppercase text-slate-900 dark:text-white outline-none shadow-inner"><option value="">ANO</option>{[2024, 2025, 2026].map(y => <option key={y} value={String(y)}>{y}</option>)}</select>
                            <div className="col-span-2 relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" size={14}/><input value={auditSearch} onChange={e => setAuditSearch(e.target.value)} placeholder="PRODUTO, CÓDIGO OU FUNCIONÁRIO..." className="w-full bg-gray-50 border-none rounded-xl pl-10 pr-4 py-3 text-[10px] font-black uppercase outline-none shadow-inner" /></div>
                        </div>
                    </div>

                    {/* NOVA FUNCIONALIDADE — RESUMO DO DIA PANEL */}
                    {showDaySummary && (
                        <div className="bg-white p-8 rounded-[40px] shadow-2xl border-2 border-blue-100 animate-in slide-in-from-top duration-500">
                            <div className="flex items-center justify-between mb-6">
                                <h4 className="text-xl font-black uppercase italic text-blue-950 flex items-center gap-3">
                                    📊 Resumo do Dia
                                </h4>
                                <button onClick={() => setShowDaySummary(false)} className="text-gray-400 hover:text-red-500 transition-all"><X size={24}/></button>
                            </div>
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                                    {auditSummary.resumoItens.map(([name, data]: any) => (
                                        <div key={name} className="bg-gray-50 p-4 rounded-3xl border border-gray-100">
                                            <p className="text-xs font-black text-blue-900 uppercase italic truncate mb-1">{name}</p>
                                            <div className="flex justify-between items-end">
                                                <p className="text-[10px] font-bold text-gray-400 uppercase">{data.qtd} unidades</p>
                                                <p className="text-sm font-black text-blue-600">{formatCurrency(data.total)}</p>
                                            </div>
                                        </div>
                                    ))}
                                    <div className="bg-red-50 p-4 rounded-3xl border border-red-100">
                                        <p className="text-xs font-black text-red-900 uppercase italic truncate mb-1">Vendas Canceladas</p>
                                        <div className="flex justify-between items-end">
                                            <p className="text-[10px] font-bold text-red-400 uppercase">{auditSummary.totalCanceledCount} vendas</p>
                                            <p className="text-sm font-black text-red-600">{formatCurrency(auditSummary.totalCanceledValue)}</p>
                                        </div>
                                    </div>
                                </div>
                            <div className="mt-8 pt-6 border-t border-dashed border-gray-200">
                                <h5 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                    <Wallet size={14} className="text-blue-600" /> Resumo Financeiro por Método
                                </h5>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                                    {Object.entries(auditSummary.resumoPagamentos).map(([method, total]) => (
                                        <div key={method} className="bg-blue-50/50 p-4 rounded-2xl border border-blue-100">
                                            <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-1">
                                                {method === 'Dinheiro' ? 'À Vista' : method}
                                            </p>
                                            <div className="flex justify-between items-end mt-2">
                                                <div className="flex flex-col">
                                                    <span className="text-[8px] font-bold text-gray-400 uppercase">Recebimentos</span>
                                                    <span className="text-xs font-black text-blue-950">{auditSummary.resumoPagamentosQtd[method]}</span>
                                                </div>
                                                <div className="flex flex-col items-end">
                                                    <span className="text-[8px] font-bold text-gray-400 uppercase">Total</span>
                                                    <span className="text-sm font-black text-blue-900">{formatCurrency(total as number)}</span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <div className="flex justify-between items-center bg-blue-950 p-6 rounded-3xl text-white shadow-xl">
                                    <div className="flex flex-col">
                                        <p className="text-[10px] font-black text-blue-300 uppercase tracking-widest">Total Financeiro</p>
                                        <p className="text-[9px] text-blue-400 mt-1">Soma de todos os recebimentos</p>
                                    </div>
                                    <p className="text-3xl font-black italic">{formatCurrency(auditSummary.totalGeral)}</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* NOVA FUNCIONALIDADE — TOTAIS RÁPIDOS */}
                    <div className="flex flex-wrap gap-6 px-4 py-2 bg-blue-50/50 rounded-2xl border border-blue-100/50">
                        <div className="flex items-center gap-2">
                            <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Total vendido no período:</span>
                            <span className="text-xs font-black text-blue-700">{formatCurrency(auditSummary.totalGeral)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Total de itens vendidos:</span>
                            <span className="text-xs font-black text-blue-700">{auditSummary.totalItens} itens</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-[9px] font-black text-red-400 uppercase tracking-widest">Vendas Canceladas:</span>
                            <span className="text-xs font-black text-red-700">{auditSummary.totalCanceledCount} ({formatCurrency(auditSummary.totalCanceledValue)})</span>
                        </div>
                    </div>

                    {auditSubTab === 'vendas' ? (
                        <div className="bg-white rounded-[40px] shadow-xl border border-gray-100 overflow-hidden">
                            <table className="w-full text-left">
                                <thead className="bg-gray-50 text-[9px] font-black text-gray-400 uppercase border-b"><tr><th className="px-8 py-5">Cod / Data</th><th className="px-8 py-5">Produtos / Baixas</th><th className="px-8 py-5">Pagamento</th><th className="px-8 py-5 text-right">Total</th><th className="px-8 py-5 text-center">Ações</th></tr></thead>
                                <tbody className="divide-y divide-gray-50 font-bold text-[10px]">
                                    {groupedAuditSales.map((saleGroup: any) => (
                                        <tr key={saleGroup.saleCode} className={`hover:bg-blue-50/30 transition-all ${saleGroup.status === 'canceled' ? 'opacity-50 grayscale italic line-through' : ''}`}>
                                            <td className="px-8 py-5"><div className="text-xs font-black text-blue-950">#{saleGroup.saleCode}</div><div className="text-[8px] text-gray-400 uppercase mt-0.5">{new Date(saleGroup.createdAt).toLocaleString('pt-BR')}</div></td>
                                            <td className="px-8 py-5">
                                                {saleGroup.items.map((item: any, idx: number) => {
                                                    const itemDef = items.find(it => it.id === item.itemId) || items.find(it => it.name === item.productName);
                                                    return (
                                                        <div key={idx} className="mb-3 last:mb-0">
                                                            <div className="text-[10px] font-black text-gray-900 uppercase italic tracking-tighter">{item.unitsSold}x {item.productName}</div>
                                                            {itemDef?.recipe?.map((r: any, i: number) => (
                                                                <div key={i} className="text-[8px] text-orange-600 font-black flex items-center gap-1 ml-2 uppercase">
                                                                    <Zap size={8} /> Abate: {(r.quantity * item.unitsSold).toFixed(3)} - {r.stock_base_name}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    );
                                                })}
                                            </td>
                                            <td className="px-8 py-5"><div className="flex flex-wrap gap-1">{saleGroup.paymentMethods.map((pm: any, idx: number) => <span key={idx} className="px-2 py-0.5 rounded text-[8px] font-black uppercase border bg-green-50 text-green-700 border-green-100">{pm}</span>)}</div>{saleGroup.buyer_name && <div className="text-[8px] text-gray-400 uppercase mt-1 truncate">Comprador: {saleGroup.buyer_name}</div>}</td>
                                            <td className="px-8 py-5 text-right font-black text-sm">{formatCurrency(saleGroup.totalValue)}</td>
                                            <td className="px-8 py-5 text-center">
                                                <div className="flex items-center justify-center gap-2">
                                                    {saleGroup.status !== 'canceled' && (
                                                        <button 
                                                            onClick={() => handleOpenPrintPreview(saleGroup.items, saleGroup.saleCode, saleGroup.paymentMethods.join(' + '), saleGroup.buyer_name)} 
                                                            className="p-2 text-blue-400 hover:text-blue-600 transition-all"
                                                            title="Reimprimir Ticket"
                                                        >
                                                            <Printer size={18}/>
                                                        </button>
                                                    )}
                                                    {saleGroup.status === 'canceled' ? (
                                                        <span className="bg-red-100 text-red-700 px-3 py-1 rounded-full text-[8px] font-black uppercase border border-red-200">ESTORNADA</span>
                                                    ) : (
                                                        <button onClick={() => setShowCancelModal({id: '0', code: saleGroup.saleCode})} className="p-2 text-gray-300 hover:text-red-600 transition-all">
                                                            <Ban size={18}/>
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    {groupedAuditSales.length === 0 && (
                                        <tr><td colSpan={5} className="px-8 py-10 text-center text-gray-400 uppercase font-black tracking-widest italic">Nenhuma venda operacional encontrada para os filtros selecionados</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {/* NOVA FUNCIONALIDADE — FILTRO AVARIAS UI */}
                            <div className="bg-white p-6 rounded-[40px] shadow-sm border border-gray-100 flex flex-col md:flex-row items-center gap-4">
                                <div className="flex items-center gap-3 shrink-0">
                                    <div className="p-2 bg-orange-50 text-orange-600 rounded-xl"><Calendar size={20}/></div>
                                    <span className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Período de Avarias:</span>
                                </div>
                                <div className="flex items-center gap-2 w-full">
                                    <input 
                                        type="date" 
                                        value={auditWastageStart} 
                                        onChange={e => setAuditWastageStart(e.target.value)}
                                        className="flex-1 bg-gray-50 border-none rounded-xl p-3 text-[10px] font-black uppercase outline-none shadow-inner"
                                    />
                                    <span className="text-gray-300 font-bold">até</span>
                                    <input 
                                        type="date" 
                                        value={auditWastageEnd} 
                                        onChange={e => setAuditWastageEnd(e.target.value)}
                                        className="flex-1 bg-gray-50 border-none rounded-xl p-3 text-[10px] font-black uppercase outline-none shadow-inner"
                                    />
                                </div>
                            </div>

                            <div className="bg-white rounded-[40px] shadow-xl border border-gray-100 overflow-hidden">
                                <table className="w-full text-left">
                                    <thead className="bg-gray-50 text-[9px] font-black text-gray-400 uppercase border-b">
                                        <tr>
                                            <th className="px-8 py-5">Data / Hora</th>
                                            <th className="px-8 py-5">Detalhes do Ajuste de Estoque</th>
                                            <th className="px-8 py-5 text-right">Ação</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50 font-bold text-[10px]">
                                        {filteredAuditWastage.map((f: any) => (
                                            <tr key={f.id} className="hover:bg-orange-50/20 transition-all">
                                                <td className="px-8 py-5">
                                                    <div className="text-[10px] font-black text-gray-900 uppercase">{new Date(f.created_at).toLocaleDateString('pt-BR')}</div>
                                                    <div className="text-[8px] text-gray-400 uppercase mt-0.5">{new Date(f.created_at).toLocaleTimeString('pt-BR')}</div>
                                                </td>
                                                <td className="px-8 py-5">
                                                    <div className="text-[10px] font-black text-orange-700 uppercase italic tracking-tighter">BAIXA DE AVARIA / DEFEITO</div>
                                                    <div className="text-[9px] text-gray-600 font-medium uppercase mt-1 leading-relaxed">
                                                        {stock.find(s => s.stock_id === f.stock_id)?.product_base} - {Math.abs(f.quantity)} {stock.find(s => s.stock_id === f.stock_id)?.unit}
                                                        <br/>
                                                        <span className="text-[8px] text-gray-400 italic">Motivo: {f.reason}</span>
                                                    </div>
                                                </td>
                                                <td className="px-8 py-5 text-right">
                                                    <span className="px-3 py-1 rounded-full text-[8px] font-black uppercase border bg-red-50 text-red-700 border-red-100">STOCK_OUT</span>
                                                </td>
                                            </tr>
                                        ))}
                                        {filteredAuditWastage.length === 0 && (
                                            <tr><td colSpan={3} className="px-8 py-10 text-center text-gray-400 uppercase font-black tracking-widest italic">Nenhuma baixa de avaria encontrada para os filtros selecionados</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'produtos' && (
                <div className="p-4 md:p-8 space-y-6 animate-in fade-in duration-300 max-w-6xl mx-auto pb-20">
                    <div className="bg-white p-8 rounded-[40px] shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between items-center gap-6">
                        <div className="flex items-center gap-4">
                            <div className="p-4 bg-blue-50 text-blue-700 rounded-3xl"><PackagePlus size={32}/></div>
                            <div>
                                <h3 className="text-2xl font-black uppercase italic text-blue-950 tracking-tighter">Gestão de <span className="text-blue-700">Produtos</span></h3>
                                <p className="text-[10px] font-bold text-gray-400 uppercase mt-1">Configuração de preços e composição</p>
                            </div>
                        </div>
                        <button onClick={() => { setEditingProduct(null); setProductForm({ name: '', category: 'Copinho', price: 0, active: true, recipe: [] }); setShowProductModal(true); }} className="px-6 py-3 bg-gray-900 text-white rounded-xl font-black uppercase text-[10px] shadow-lg flex items-center gap-2 border-b-4 border-red-600 active:scale-95">
                            <Plus size={16}/> Novo Produto
                        </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {filteredItems.map(item => (
                            <div key={item.id} className="bg-white p-6 rounded-[32px] shadow-sm border border-gray-100 group relative flex flex-col">
                                <div className="absolute top-4 right-4 flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                                    <button onClick={() => { setEditingProduct(item); setProductForm(item); setShowProductModal(true); }} className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100"><Edit3 size={14}/></button>
                                    <button onClick={() => onDeleteItem(item.id)} className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100"><Trash size={14}/></button>
                                </div>
                                <div className="w-16 h-16 bg-gray-50 rounded-2xl mb-4 flex items-center justify-center overflow-hidden shrink-0">
                                    <img src={item.image_url || getCategoryIconEdit(item.category, item.name)} referrerPolicy="no-referrer" className="w-full h-full object-contain p-2" />
                                </div>
                                <h4 className="text-xs font-black text-blue-950 uppercase italic tracking-tighter mb-1 truncate pr-16">{item.name}</h4>
                                <p className="text-[9px] font-bold text-gray-400 uppercase mb-3">{item.category}</p>
                                <div className="mt-auto pt-3 border-t flex justify-between items-center">
                                    <span className="text-lg font-black text-blue-900 italic">{formatCurrency(item.price)}</span>
                                    <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase border ${item.active ? 'bg-green-50 text-green-700 border-green-100' : 'bg-red-50 text-red-700 border-red-100'}`}>
                                        {item.active ? 'Ativo' : 'Inativo'}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>

        {/* MODAL: PRÉVIA DO TICKET (58mm) */}
        {showTicketModal && ticketData && (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[200] p-4">
                <div className="bg-white rounded-[40px] w-full max-sm max-h-[90vh] shadow-2xl animate-in zoom-in duration-300 overflow-hidden flex flex-col">
                    <div className="p-5 border-b flex justify-between items-center bg-gray-50/50 shrink-0">
                        <h3 className="font-black text-blue-950 uppercase italic text-xs flex items-center gap-2"><Printer size={16} className="text-blue-600"/> Prévia do Ticket</h3>
                        <button onClick={() => setShowTicketModal(false)} className="text-gray-400 hover:text-red-600 p-1"><X size={24}/></button>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto p-4 flex justify-center bg-gray-100 no-scrollbar">
                        <div className="bg-white w-[58mm] min-h-[100mm] h-fit shadow-lg p-3 text-black font-mono text-[9px] relative border-l border-r border-gray-200 mx-auto">
                            <div className="text-center font-black text-[11px] mb-2">SORVETERIA REAL</div>
                            <div className="border-t border-dashed border-black my-2"></div>
                            
                            <div className="flex justify-between">
                                <span className="font-black uppercase">CÓDIGO:</span>
                                <span className="font-black">#{ticketData.saleCode}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="uppercase">DATA:</span>
                                <span>{new Date().toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                            
                            <div className="border-t border-dashed border-black my-2"></div>
                            <div className="font-black mb-1 uppercase">ITENS:</div>
                            {ticketData.items.map((i, idx) => (
                                <div key={idx} className="flex justify-between mb-0.5">
                                    <span className="flex-1 truncate pr-1">{i.unitsSold}x {i.productName}</span>
                                    <span className="shrink-0">{formatCurrency(i.totalValue)}</span>
                                </div>
                            ))}
                            
                            <div className="border-t border-dashed border-black my-2"></div>
                            <div className="flex justify-between font-black text-[10px]">
                                <span className="uppercase">TOTAL</span>
                                <span>{formatCurrency(ticketData.items.reduce((acc, c) => acc + c.totalValue, 0))}</span>
                            </div>
                            
                            <div className="mt-3 flex justify-between">
                                <span className="uppercase">PAGTO:</span>
                                <span className="font-black">{(ticketData.method || 'MISTO').toUpperCase()}</span>
                            </div>
                            {ticketData.buyer && (
                                <div className="flex justify-between">
                                    <span className="uppercase">FUNC:</span>
                                    <span className="font-black truncate max-w-[30mm]">{ticketData.buyer}</span>
                                </div>
                            )}

                            {(ticketData.method?.toUpperCase().includes('FIADO') || ticketData.buyer) && (
                                <div className="mt-4">
                                    <div className="border-t border-black pt-1 text-center font-bold" style={{ fontSize: '7px' }}>ASSINATURA DO CLIENTE</div>
                                    <div className="text-center" style={{ fontSize: '6px' }}>AUTORIZO O LANÇAMENTO NO MEU DÉBITO</div>
                                </div>
                            )}
                            
                            <div className="border-t border-dashed border-black my-2"></div>
                            <div className="text-center mt-3 leading-tight opacity-70 italic" style={{ fontSize: '8px' }}>
                                Aguarde ser atendido<br/>
                                Real Admin v6.5<br/>
                                Unid: {stores.find(s => s.id === effectiveStoreId)?.number || '---'}
                            </div>
                        </div>
                    </div>

                    <div className="p-4 bg-white border-t flex flex-col gap-2 shrink-0">
                        <button 
                            onClick={() => handlePrintTicket(ticketData.items, ticketData.saleCode, ticketData.method, ticketData.buyer)}
                            className="w-full py-4 bg-blue-900 text-white rounded-[20px] font-black uppercase text-[10px] shadow-xl active:scale-95 border-b-4 border-blue-950 flex items-center justify-center gap-2 transition-all"
                        >
                            <Printer size={16}/> Imprimir Agora
                        </button>
                        <button 
                            onClick={() => setShowTicketModal(false)}
                            className="w-full py-3 bg-gray-100 text-gray-500 rounded-[20px] font-black uppercase text-[9px] active:scale-95"
                        >
                            Fechar Prévia
                        </button>
                    </div>
                </div>
            </div>
        )}

        {showWastageModal && (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[130] p-4">
                <div className="bg-white rounded-[40px] w-full max-w-md shadow-2xl animate-in zoom-in duration-300 border-t-8 border-orange-500 overflow-hidden">
                    <div className="p-8 border-b bg-gray-50/50 flex justify-between items-center">
                        <h3 className="text-xl font-black uppercase italic text-blue-950 flex items-center gap-3"><AlertTriangle className="text-orange-500" /> Baixa <span className="text-orange-600">por Avaria</span></h3>
                        <button onClick={() => setShowWastageModal(false)} className="text-gray-400 hover:text-red-600"><X size={24}/></button>
                    </div>
                    <div className="p-10 space-y-6">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-400 uppercase ml-2">Insumo do Estoque</label>
                            <select 
                                value={wastageForm.stockId} 
                                onChange={e => setWastageForm({...wastageForm, stockId: e.target.value})} 
                                className="w-full p-4 bg-gray-50 rounded-2xl font-black uppercase outline-none shadow-inner border border-gray-100"
                            >
                                <option value="">SELECIONE O INSUMO...</option>
                                {filteredStock.map(s => <option key={s.stock_id} value={s.stock_id}>{s.product_base} (Disponível: {s.stock_current} {s.unit})</option>)}
                            </select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-400 uppercase ml-2">Quantidade Perdida</label>
                            <input 
                                value={wastageForm.quantity} 
                                onChange={e => setWastageForm({...wastageForm, quantity: e.target.value})} 
                                className="w-full p-4 bg-gray-50 rounded-2xl font-black text-center text-xl outline-none shadow-inner border border-orange-100" 
                                placeholder="0,00" 
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-400 uppercase ml-2">Justificativa / Motivo</label>
                            <textarea 
                                value={wastageForm.reason} 
                                onChange={e => setWastageForm({...wastageForm, reason: e.target.value.toUpperCase()})} 
                                className="w-full p-4 bg-gray-50 rounded-2xl font-black uppercase text-[10px] shadow-inner outline-none border border-gray-100 h-24"
                            />
                        </div>
                        <button onClick={handleSaveWastage} disabled={isSubmitting || !wastageForm.stockId || !wastageForm.quantity} className="w-full py-5 bg-orange-600 text-white rounded-[28px] font-black uppercase text-xs shadow-xl active:scale-95 transition-all border-b-4 border-orange-900 flex items-center justify-center gap-3">
                            {isSubmitting ? <Loader2 className="animate-spin" /> : <Trash size={18}/>} EFETIVAR BAIXA
                        </button>
                    </div>
                </div>
            </div>
        )}

        {showNewInsumoModal && (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[130] p-4">
                <div className="bg-white rounded-[40px] w-full max-w-md shadow-2xl animate-in zoom-in duration-300 border-t-8 border-orange-500 overflow-hidden">
                    <div className="p-8 border-b bg-gray-50/50 flex justify-between items-center"><h3 className="text-xl font-black uppercase italic text-blue-950 flex items-center gap-3"><Plus className="text-orange-600" /> Novo <span className="text-orange-600">Insumo</span></h3><button onClick={() => setShowNewInsumoModal(false)} className="text-gray-400 hover:text-red-600"><X size={24}/></button></div>
                    <div className="p-10 space-y-6">
                        <div className="space-y-2"><label className="text-[10px] font-black text-gray-400 uppercase ml-2">Nome do Insumo (EX: COPO 300ML)</label><input value={newInsumo.name} onChange={e => setNewInsumo({...newInsumo, name: e.target.value})} className="w-full p-4 bg-gray-50 rounded-2xl font-black text-gray-900 uppercase shadow-inner outline-none" /></div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2"><label className="text-[10px] font-black text-gray-400 uppercase ml-2">Unidade</label><select value={newInsumo.unit} onChange={e => setNewInsumo({...newInsumo, unit: e.target.value})} className="w-full p-4 bg-gray-50 dark:bg-slate-800 rounded-2xl font-black text-slate-900 dark:text-white outline-none"><option value="un">un</option><option value="kg">kg</option><option value="ml">ml</option></select></div>
                            <div className="space-y-2"><label className="text-[10px] font-black text-gray-400 uppercase ml-2">Qtd Inicial</label><input value={newInsumo.initial} onChange={e => setNewInsumo({...newInsumo, initial: e.target.value})} className="w-full p-4 bg-gray-50 rounded-2xl font-black text-center outline-none" placeholder="0" /></div>
                        </div>
                        <button onClick={handleSaveSupplies} disabled={isSubmitting} className="w-full py-5 bg-orange-600 text-white rounded-[28px] font-black uppercase text-xs shadow-xl active:scale-95 transition-all border-b-4 border-orange-900 flex items-center justify-center gap-3">{isSubmitting ? <Loader2 className="animate-spin" /> : <Save size={18}/>} SALVAR INSUMO</button>
                    </div>
                </div>
            </div>
        )}

        {showPurchaseModal && (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[130] p-4">
                <div className="bg-white rounded-[40px] w-full max-w-2xl max-h-[90vh] shadow-2xl animate-in zoom-in duration-300 border-t-8 border-blue-600 flex flex-col overflow-hidden">
                    <div className="p-8 border-b bg-gray-50/50 flex justify-between items-center shrink-0"><h3 className="text-xl font-black uppercase italic text-blue-950 flex items-center gap-3"><Truck className="text-blue-600" /> Lançar <span className="text-blue-600">Compras</span></h3><button onClick={() => setShowPurchaseModal(false)} className="text-gray-400 hover:text-red-600"><X size={24}/></button></div>
                    <div className="flex-1 overflow-y-auto p-10 space-y-4 no-scrollbar">
                        {filteredStock.map(s => (
                            <div key={s.stock_id} className="flex items-center gap-4 bg-gray-50 p-4 rounded-2xl border border-gray-100">
                                <div className="flex-1"><p className="text-[10px] font-black text-blue-950 uppercase italic leading-none">{s.product_base}</p><p className="text-[8px] font-bold text-gray-400 uppercase mt-1">Atual: {s.stock_current} {s.unit}</p></div>
                                <div className="w-32 relative"><input value={purchaseForm[s.stock_id] || ''} onChange={e => setPurchaseForm({...purchaseForm, [s.stock_id]: e.target.value})} className="w-full p-3 bg-white border border-blue-100 rounded-xl font-black text-blue-900 text-center text-sm outline-none focus:ring-4 focus:ring-blue-50" placeholder="0" /><span className="absolute right-3 top-1/2 -translate-y-1/2 text-[8px] font-black text-blue-300 uppercase">{s.unit}</span></div>
                            </div>
                        ))}
                    </div>
                    <div className="p-10 border-t bg-gray-50 flex justify-center shrink-0"><button onClick={handleSavePurchase} disabled={isSubmitting} className="w-full py-5 bg-blue-900 text-white rounded-[28px] font-black uppercase text-xs shadow-xl active:scale-95 transition-all border-b-4 border-blue-950 flex items-center justify-center gap-3">{isSubmitting ? <Loader2 className="animate-spin" /> : <Save size={18}/>} EFETIVAR COMPRAS</button></div>
                </div>
            </div>
        )}

        {showInventoryModal && (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[130] p-4">
                <div className="bg-white rounded-[40px] w-full max-w-2xl max-h-[90vh] shadow-2xl animate-in zoom-in duration-300 border-t-8 border-orange-600 flex flex-col overflow-hidden">
                    <div className="p-8 border-b bg-gray-50/50 flex justify-between items-center shrink-0"><h3 className="text-xl font-black uppercase italic text-blue-950 flex items-center gap-3"><PencilLine className="text-orange-600" /> Atualizar <span className="text-orange-600">Inventário</span></h3><button onClick={() => setShowInventoryModal(false)} className="text-gray-400 hover:text-red-600"><X size={24}/></button></div>
                    <div className="flex-1 overflow-y-auto p-10 space-y-4 no-scrollbar">
                        {filteredStock.map(s => (
                            <div key={s.stock_id} className="flex items-center gap-4 bg-gray-50 p-4 rounded-2xl border border-gray-100">
                                <div className="flex-1"><p className="text-[10px] font-black text-blue-950 uppercase italic leading-none">{s.product_base}</p><p className="text-[8px] font-bold text-gray-400 uppercase mt-1">Atual em Banco: {s.stock_current} {s.unit}</p></div>
                                <div className="w-32 relative"><input value={inventoryForm[s.stock_id] || ''} onChange={e => setInventoryForm({...inventoryForm, [s.stock_id]: e.target.value})} className="w-full p-3 bg-white border border-orange-100 rounded-xl font-black text-orange-700 text-center text-sm outline-none focus:ring-4 focus:ring-orange-50" placeholder="0" /><span className="absolute right-3 top-1/2 -translate-y-1/2 text-[8px] font-black text-orange-300 uppercase">{s.unit}</span></div>
                            </div>
                        ))}
                    </div>
                    <div className="p-10 border-t bg-gray-50 flex justify-center shrink-0"><button onClick={handleSaveInventory} disabled={isSubmitting} className="w-full py-5 bg-orange-600 text-white rounded-[28px] font-black uppercase text-xs shadow-xl active:scale-95 transition-all border-b-4 border-orange-900 flex items-center justify-center gap-3">{isSubmitting ? <Loader2 className="animate-spin" /> : <Save size={18}/>} EFETIVAR INVENTÁRIO</button></div>
                </div>
            </div>
        )}

        {showProductModal && (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[130] p-4">
                <div className="bg-white rounded-[40px] w-full max-w-4xl max-h-[90vh] shadow-2xl animate-in zoom-in duration-300 border-t-8 border-blue-600 flex flex-col overflow-hidden">
                    <div className="p-8 border-b bg-gray-50/50 flex justify-between items-center shrink-0">
                        <h3 className="text-xl font-black uppercase italic text-blue-950 flex items-center gap-3">
                            <PackagePlus className="text-blue-600" /> {editingProduct ? 'Editar' : 'Novo'} <span className="text-blue-600">Produto</span>
                        </h3>
                        <button onClick={() => setShowProductModal(false)} className="text-gray-400 hover:text-red-600 transition-all"><X size={24}/></button>
                    </div>
                    <div className="flex-1 overflow-y-auto no-scrollbar">
                        <form onSubmit={handleSaveProductForm} className="p-10 space-y-10">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-6">
                                    <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest border-b pb-2">Informações Gerais</h4>
                                    <div className="space-y-2"><label className="text-[9px] font-black text-gray-500 uppercase ml-2">Nome do Produto</label><input required value={productForm.name} onChange={e => setProductForm({...productForm, name: e.target.value})} className="w-full p-4 bg-gray-50 border-none rounded-2xl font-black uppercase italic outline-none focus:ring-4 focus:ring-blue-50" /></div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2"><label className="text-[9px] font-black text-gray-500 uppercase ml-2">Categoria</label><select value={productForm.category} onChange={e => setProductForm({...productForm, category: e.target.value as IceCreamCategory})} className="w-full p-4 bg-gray-50 dark:bg-slate-800 rounded-2xl font-black uppercase text-slate-900 dark:text-white outline-none">{PRODUCT_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
                                        <div className="space-y-2"><label className="text-[9px] font-black text-gray-500 uppercase ml-2">Preço de Venda</label><input required value={productForm.price} onChange={e => setProductForm({...productForm, price: parseFloat(e.target.value) || 0})} className="w-full p-4 bg-blue-50 border-none rounded-2xl font-black text-blue-700 outline-none text-xl shadow-inner" /></div>
                                    </div>
                                    <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-2xl">
                                        <label className="text-[10px] font-black text-gray-500 uppercase">Status:</label>
                                        <button type="button" onClick={() => setProductForm({...productForm, active: !productForm.active})} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${productForm.active ? 'bg-green-50 text-white shadow-lg' : 'bg-red-50 text-white'}`}>{productForm.active ? 'Visível no PDV' : 'Oculto no PDV'}</button>
                                    </div>
                                </div>
                                <div className="space-y-6">
                                    <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest border-b pb-2">Receita / Baixa Automática</h4>
                                    <div className="p-6 bg-gray-950 rounded-3xl space-y-4 shadow-xl">
                                        <div className="grid grid-cols-2 gap-3">
                                            <select value={newRecipeItem.stock_base_name} onChange={e => setNewRecipeItem({...newRecipeItem, stock_base_name: e.target.value})} className="bg-white/10 border-none rounded-xl p-3 text-xs font-black text-white outline-none">
                                                <option value="" className="text-black">SELECIONE INSUMO...</option>
                                                {stock.filter(s => s.store_id === effectiveStoreId && s.is_active !== false).map(s => <option key={s.stock_id} value={s.product_base} className="text-black">{s.product_base}</option>)}
                                            </select>
                                            <input value={newRecipeItem.quantity} onChange={e => setNewRecipeItem({...newRecipeItem, quantity: e.target.value})} placeholder="QTD" className="bg-white/10 border-none rounded-xl p-3 text-xs font-black text-white text-center outline-none" />
                                        </div>
                                        <button type="button" onClick={() => { if(!newRecipeItem.stock_base_name || !newRecipeItem.quantity) return; const updatedRecipe = [...(productForm.recipe || []), { stock_base_name: newRecipeItem.stock_base_name, quantity: parseFloat(newRecipeItem.quantity.replace(',', '.')) }]; setProductForm({...productForm, recipe: updatedRecipe}); setNewRecipeItem({stock_base_name: '', quantity: '1'}); }} className="w-full py-3 bg-blue-600 text-white rounded-xl font-black uppercase text-[10px] shadow-lg border-b-2 border-blue-900 active:scale-95 transition-all">Vincular p/ Baixa</button>
                                    </div>
                                    <div className="space-y-2 max-h-[150px] overflow-y-auto no-scrollbar">
                                        {(productForm.recipe || []).map((r, i) => (
                                            <div key={i} className="flex justify-between items-center bg-white p-3 rounded-xl border border-gray-100 shadow-sm">
                                                <div className="flex flex-col"><span className="text-[10px] font-black text-blue-900 uppercase italic">{r.stock_base_name}</span><span className="text-[9px] font-bold text-gray-400 uppercase">Abate: {r.quantity} por venda</span></div>
                                                <button type="button" onClick={() => setProductForm({...productForm, recipe: (productForm.recipe || []).filter((_, idx) => idx !== i)})} className="p-2 text-red-300 hover:text-red-600"><Trash2 size={16}/></button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                            <button type="submit" disabled={isSubmitting} className="w-full py-5 bg-blue-900 text-white rounded-[28px] font-black uppercase text-xs shadow-2xl active:scale-95 transition-all border-b-4 border-blue-950 flex items-center justify-center gap-3">
                                {isSubmitting ? <Loader2 className="animate-spin" /> : <Save size={18}/>} EFETIVAR CADASTRO
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        )}

        {showCancelModal && (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[130] p-4">
                <div className="bg-white rounded-[40px] p-10 max-sm w-full text-center shadow-2xl animate-in zoom-in duration-200">
                    <div className="p-5 bg-red-50 text-red-600 rounded-full w-fit mx-auto mb-6"><AlertTriangle size={48} /></div>
                    <h3 className="text-2xl font-black text-gray-900 uppercase italic mb-2 tracking-tighter">Estornar <span className="text-red-600">Venda?</span></h3>
                    <input value={cancelReason} onChange={e => setCancelReason(e.target.value)} placeholder="Motivo do estorno..." className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl text-[10px] font-black uppercase outline-none focus:ring-4 focus:ring-red-50 mb-6 shadow-inner" />
                    <div className="flex gap-3"><button onClick={() => { setShowCancelModal(null); setCancelReason(''); }} className="flex-1 py-4 bg-gray-100 text-gray-500 rounded-2xl font-black uppercase text-[10px]">Voltar</button><button onClick={handleCancelSale} disabled={isSubmitting} className="flex-1 py-4 bg-red-600 text-white rounded-2xl font-black uppercase text-[10px] shadow-lg active:scale-95 disabled:opacity-30">Confirmar Estorno</button></div>
                </div>
            </div>
        )}

        {showSangriaModal && (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[130] p-4">
                <div className="bg-white rounded-[40px] w-full max-w-md shadow-2xl animate-in zoom-in duration-300 border-t-8 border-red-600 flex flex-col overflow-hidden">
                    <div className="p-8 border-b bg-gray-50/50 flex justify-between items-center shrink-0">
                        <h3 className="text-xl font-black uppercase italic text-blue-950 flex items-center gap-3">
                            <DollarSign className="text-red-600" /> Realizar <span className="text-red-600">Sangria</span>
                        </h3>
                        <button onClick={() => setShowSangriaModal(false)} className="text-gray-400 hover:text-red-600"><X size={24}/></button>
                    </div>
                    <div className="p-10 space-y-6">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-400 uppercase ml-2">Valor</label>
                            <input value={sangriaForm.amount} onChange={e => setSangriaForm({...sangriaForm, amount: e.target.value})} className="w-full p-4 bg-red-50 rounded-2xl font-black text-red-700 text-2xl text-center outline-none focus:ring-4 focus:ring-red-100" placeholder="0,00" />
                        </div>
                        <div className="space-y-2">
                            <div className="flex justify-between items-center px-2">
                                <label className="text-[10px] font-black text-gray-400 uppercase">Categoria</label>
                                <button onClick={() => setShowCategoryManager(true)} className="text-blue-600 hover:text-blue-800 transition-all"><Settings size={14}/></button>
                            </div>
                            <select value={sangriaForm.categoryId} onChange={e => setSangriaForm({...sangriaForm, categoryId: e.target.value})} className="w-full p-4 bg-gray-50 dark:bg-slate-800 rounded-2xl font-black uppercase text-slate-900 dark:text-white outline-none">
                                <option value="">SELECIONE...</option>
                                {sangriaCategories.filter(c => c.store_id === effectiveStoreId && c.is_active).map(c => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-400 uppercase ml-2">Data da Sangria</label>
                            <input type="date" value={sangriaDate} onChange={e => setSangriaDate(e.target.value)} className="w-full p-4 bg-gray-50 rounded-2xl font-black text-gray-900 outline-none shadow-inner border border-gray-100" />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-400 uppercase ml-2">Descrição (Opcional)</label>
                            <textarea value={sangriaForm.description} onChange={e => setSangriaForm({...sangriaForm, description: e.target.value})} className="w-full p-4 bg-gray-50 rounded-2xl font-black uppercase text-[10px] outline-none h-24 resize-none" placeholder="MOTIVO DA SANGRIA..." />
                        </div>
                        <button onClick={handleSaveSangria} disabled={isSubmitting} className="w-full py-5 bg-red-600 text-white rounded-[28px] font-black uppercase text-xs shadow-xl active:scale-95 transition-all border-b-4 border-red-900 flex items-center justify-center gap-3">
                            {isSubmitting ? <Loader2 className="animate-spin" /> : <Save size={18}/>} EFETIVAR SANGRIA
                        </button>
                    </div>
                </div>
            </div>
        )}

        {showCategoryManager && (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[140] p-4">
                <div className="bg-white rounded-[40px] w-full max-w-md shadow-2xl animate-in zoom-in duration-300 border-t-8 border-blue-600 flex flex-col overflow-hidden">
                    <div className="p-8 border-b bg-gray-50/50 flex justify-between items-center shrink-0">
                        <h3 className="text-xl font-black uppercase italic text-blue-950 flex items-center gap-3">
                            <Settings className="text-blue-600" /> Categorias de <span className="text-blue-600">Sangria</span>
                        </h3>
                        <button onClick={() => setShowCategoryManager(false)} className="text-gray-400 hover:text-red-600"><X size={24}/></button>
                    </div>
                    <div className="p-10 space-y-6">
                        <div className="flex gap-2">
                            <input value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)} className="flex-1 p-4 bg-gray-50 rounded-2xl font-black uppercase text-xs outline-none" placeholder="NOVA CATEGORIA..." />
                            <button onClick={handleSaveSangriaCategory} disabled={isSubmitting} className="p-4 bg-blue-600 text-white rounded-2xl shadow-lg active:scale-95"><Plus size={20}/></button>
                        </div>
                        <div className="space-y-2 max-h-[300px] overflow-y-auto no-scrollbar">
                            {sangriaCategories.filter(c => c.store_id === effectiveStoreId).map(c => (
                                <div key={c.id} className="flex justify-between items-center p-4 bg-gray-50 rounded-2xl border border-gray-100">
                                    <span className="text-[10px] font-black text-blue-950 uppercase italic">{c.name}</span>
                                    <button onClick={() => onDeleteSangriaCategory(c.id)} className="text-red-300 hover:text-red-600 transition-all"><Trash2 size={16}/></button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        )}

        {showSangriaDetailModal && (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[140] p-4">
                <div className="bg-white rounded-[40px] w-full max-w-2xl shadow-2xl animate-in zoom-in duration-300 border-t-8 border-red-600 flex flex-col overflow-hidden max-h-[90vh]">
                    <div className="p-8 border-b bg-gray-50/50 flex justify-between items-center shrink-0">
                        <h3 className="text-xl font-black uppercase italic text-blue-950 flex items-center gap-3">
                            <DollarSign className="text-red-600" /> Detalhamento de <span className="text-red-600">Sangrias</span>
                        </h3>
                        <button onClick={() => setShowSangriaDetailModal(null)} className="text-gray-400 hover:text-red-600"><X size={24}/></button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-6 no-scrollbar">
                        <table className="w-full text-left">
                            <thead className="bg-gray-50 text-[9px] font-black text-gray-400 uppercase tracking-widest border-b sticky top-0 z-10">
                                <tr>
                                    <th className="px-4 py-4">Data / Hora</th>
                                    <th className="px-4 py-4">Categoria</th>
                                    <th className="px-4 py-4">Descrição</th>
                                    <th className="px-4 py-4">Usuário</th>
                                    <th className="px-4 py-4 text-right">Valor</th>
                                    {isAdmin && <th className="px-4 py-4 text-center">Ações</th>}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50 font-bold text-[10px]">
                                {(showSangriaDetailModal === 'day' ? dreStats.daySangrias : dreStats.monthSangrias).map(s => {
                                    const cat = sangriaCategories.find(c => c.id === s.category_id);
                                    const userObj = adminUsers.find(u => u.id === s.user_id);
                                    return (
                                        <tr key={s.id} className="hover:bg-red-50/20">
                                            <td className="px-4 py-3 text-gray-400">
                                                <div className="text-[10px] font-black text-gray-900">
                                                    {new Date((s.transaction_date || s.created_at!) + 'T00:00:00').toLocaleDateString('pt-BR')}
                                                </div>
                                                <div className="text-[8px] text-gray-400 uppercase">
                                                    {new Date(s.created_at!).toLocaleTimeString('pt-BR')}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 uppercase text-blue-950">{cat?.name || '---'}</td>
                                            <td className="px-4 py-3 text-gray-500 italic">{s.description || '---'}</td>
                                            <td className="px-4 py-3 uppercase text-gray-400">{userObj?.name || '---'}</td>
                                            <td className="px-4 py-3 text-right text-red-600 font-black">{formatCurrency(s.amount)}</td>
                                            {isAdmin && (
                                                <td className="px-4 py-3 text-center">
                                                    <div className="flex justify-center gap-2">
                                                        <button onClick={() => handleEditSangria(s)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-all"><PencilLine size={16}/></button>
                                                        <button onClick={() => handleDeleteSangria(s.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-all"><Trash2 size={16}/></button>
                                                    </div>
                                                </td>
                                            )}
                                        </tr>
                                    );
                                })}
                                {(showSangriaDetailModal === 'day' ? dreStats.daySangrias : dreStats.monthSangrias).length === 0 && (
                                    <tr><td colSpan={5} className="px-4 py-10 text-center text-gray-400 uppercase italic">Nenhuma sangria encontrada</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                    <div className="p-6 bg-gray-50 border-t flex justify-between items-center">
                        <span className="text-[10px] font-black text-gray-400 uppercase">Total do Período</span>
                        <span className="text-xl font-black text-red-600 italic">{formatCurrency(showSangriaDetailModal === 'day' ? dreStats.daySangriaTotal : dreStats.monthSangriaTotal)}</span>
                    </div>
                </div>
            </div>
        )}

        {showPartnersModal && (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[140] p-4">
                <div className="bg-white rounded-[40px] w-full max-w-md shadow-2xl animate-in zoom-in duration-300 border-t-8 border-blue-600 flex flex-col overflow-hidden max-h-[90vh]">
                    <div className="p-8 border-b bg-gray-50/50 flex justify-between items-center shrink-0">
                        <h3 className="text-xl font-black uppercase italic text-blue-950 flex items-center gap-3">
                            <UsersIcon className="text-blue-600" /> Gestão de <span className="text-blue-600">Sócios</span>
                        </h3>
                        <button onClick={() => setShowPartnersModal(false)} className="text-gray-400 hover:text-red-600"><X size={24}/></button>
                    </div>
                    <div className="p-8 space-y-6 flex-1 overflow-y-auto no-scrollbar">
                        <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100">
                            <p className="text-[10px] font-black text-blue-900 uppercase mb-2">Soma dos Percentuais Ativos</p>
                            <div className="flex items-baseline gap-2">
                                <span className={`text-3xl font-black italic ${Math.abs(partners.filter(p => p.active).reduce((a,p) => a + p.percentage, 0) - 100) < 0.1 ? 'text-green-600' : 'text-red-600'}`}>
                                    {partners.filter(p => p.active).reduce((a,p) => a + p.percentage, 0).toFixed(1)}%
                                </span>
                                <span className="text-[10px] font-bold text-blue-400 uppercase">/ 100% obrigatório</span>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-2">
                                <div className="space-y-1">
                                    <label className="text-[9px] font-black text-gray-400 uppercase ml-2">Nome</label>
                                    <input value={partnerForm.partner_name} onChange={e => setPartnerForm({...partnerForm, partner_name: e.target.value})} className="w-full p-3 bg-gray-50 rounded-xl font-black uppercase text-[10px] outline-none" placeholder="NOME..." />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[9px] font-black text-gray-400 uppercase ml-2">%</label>
                                    <input value={partnerForm.percentage} onChange={e => setPartnerForm({...partnerForm, percentage: e.target.value})} className="w-full p-3 bg-gray-50 rounded-xl font-black text-[10px] outline-none" placeholder="0.00" />
                                </div>
                            </div>
                            <button onClick={handleSavePartner} disabled={isSubmitting} className="w-full py-3 bg-blue-600 text-white rounded-xl font-black uppercase text-[10px] shadow-lg active:scale-95 transition-all">
                                Adicionar Sócio
                            </button>
                        </div>

                        <div className="space-y-2">
                            {partners.map(p => (
                                <div key={p.id} className="flex justify-between items-center p-4 bg-gray-50 rounded-2xl border border-gray-100">
                                    <div className="flex flex-col">
                                        <span className="text-[10px] font-black text-blue-950 uppercase italic">{p.partner_name}</span>
                                        <span className="text-[9px] font-bold text-blue-400">{p.percentage}%</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button onClick={() => handleTogglePartner(p.id, !p.active)} className={`p-2 rounded-lg transition-all ${p.active ? 'text-green-600 bg-green-50' : 'text-gray-300 bg-gray-100'}`}>
                                            {p.active ? <CheckCircle2 size={16}/> : <XCircle size={16}/>}
                                        </button>
                                        <button onClick={() => handleDeletePartner(p.id)} className="p-2 text-red-300 hover:text-red-600 transition-all">
                                            <Trash2 size={16}/>
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="p-6 bg-gray-50 border-t">
                        <p className="text-[8px] text-gray-400 uppercase font-bold text-center">A soma dos percentuais ativos deve ser exatamente 100% para o fechamento correto.</p>
                    </div>
                </div>
            </div>
        )}

        {showEditSangriaModal && editingSangria && (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[150] p-4">
                <div className="bg-white rounded-[40px] w-full max-w-md shadow-2xl border-t-8 border-orange-600 animate-in zoom-in duration-300">
                    <div className="p-8 border-b flex justify-between items-center">
                        <h3 className="text-xl font-black uppercase italic text-blue-950">
                            Editar <span className="text-orange-600">Sangria</span>
                        </h3>
                        <button onClick={() => setShowEditSangriaModal(false)}>
                            <X size={24}/>
                        </button>
                    </div>
                    
                    <div className="p-10 space-y-6">
                        <div>
                            <label className="text-[10px] font-black text-gray-400 uppercase ml-2">
                                Valor
                            </label>
                            <input
                                value={editSangriaForm.amount}
                                onChange={e => setEditSangriaForm({...editSangriaForm, amount: e.target.value})}
                                className="w-full p-4 bg-red-50 rounded-2xl font-black text-red-700 text-2xl text-center outline-none"
                            />
                        </div>
                        
                        <div>
                            <label className="text-[10px] font-black text-gray-400 uppercase ml-2">
                                Data da Sangria
                            </label>
                            <input
                                type="date"
                                value={editSangriaForm.transactionDate}
                                onChange={e => setEditSangriaForm({...editSangriaForm, transactionDate: e.target.value})}
                                className="w-full p-4 bg-gray-50 rounded-2xl font-black outline-none"
                            />
                        </div>
                        
                        <div>
                            <label className="text-[10px] font-black text-gray-400 uppercase ml-2">
                                Categoria
                            </label>
                            <select
                                value={editSangriaForm.categoryId}
                                onChange={e => setEditSangriaForm({...editSangriaForm, categoryId: e.target.value})}
                                className="w-full p-4 bg-gray-50 rounded-2xl font-black uppercase outline-none"
                            >
                                {sangriaCategories.filter(c => c.store_id === effectiveStoreId && c.is_active).map(c => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </select>
                        </div>
                        
                        <div>
                            <label className="text-[10px] font-black text-gray-400 uppercase ml-2">
                                Descrição
                            </label>
                            <textarea
                                value={editSangriaForm.description}
                                onChange={e => setEditSangriaForm({...editSangriaForm, description: e.target.value})}
                                className="w-full p-4 bg-gray-50 rounded-2xl font-black uppercase text-[10px] outline-none h-24"
                            />
                        </div>
                        
                        <button
                            onClick={handleSaveEditSangria}
                            disabled={isSubmitting}
                            className="w-full py-5 bg-orange-600 text-white rounded-[28px] font-black uppercase text-xs shadow-xl flex items-center justify-center gap-2"
                        >
                            {isSubmitting ? <Loader2 className="animate-spin" /> : <Save size={18} />} SALVAR ALTERAÇÕES
                        </button>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};

export default IceCreamModule;