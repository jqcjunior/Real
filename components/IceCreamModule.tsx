import React, { useState, useMemo, useEffect } from 'react';
import { IceCreamItem, IceCreamDailySale, IceCreamTransaction, IceCreamCategory, IceCreamPaymentMethod, User, UserRole, Store, IceCreamStock, IceCreamPromissoryNote, IceCreamRecipeItem, StoreProfitPartner } from '../types';
import { formatCurrency, BRAND_LOGO } from '../constants';
import { 
    IceCream, Plus, Package, ShoppingCart, CheckCircle2, 
    Trash2, X, History, PieChart, ArrowDownCircle, ArrowUpCircle, 
    Loader2, Search, Trash, ChevronRight, Calculator, FileText, Ban, UserCheck, Save, Image as ImageIcon, Sliders, Settings, Calendar, BarChart3, ListChecks, TrendingUp, TrendingDown, DollarSign, Wallet, CreditCard, Banknote, PackagePlus, Printer, ClipboardList, AlertCircle, Info, ToggleLeft, ToggleRight, Receipt, ArrowRight,
    Users as UsersIcon, ShieldCheck, UserCog, Clock, FileBarChart, Users, Handshake, AlertTriangle, Zap, Beaker, Layers, Clipboard, Edit3, Filter, ChevronDown, FilePieChart, Briefcase, Warehouse, PencilLine, Truck, ChevronUp
} from 'lucide-react';
import PDVMobileView from './PDVMobileView';
import { ProductGrid } from './ProductGrid'; 
import { supabase } from '../services/supabaseClient';
import { PermissionKey } from '../security/permissions';
import { getPermissionColumn } from '../permissions.utils';
import { GELATERIA_PERMISSIONS_MAP, getVisibleTabs } from '../gelateria.permissions';

interface IceCreamModuleProps {
  user: User;
  stores: Store[];
  items: IceCreamItem[];
  stock: IceCreamStock[];
  sales: IceCreamDailySale[];
  finances: IceCreamTransaction[];
  promissories: IceCreamPromissoryNote[];
  can: (p: PermissionKey | string | string[]) => boolean;
  pagePermissions?: any[];
  onAddSales: (sale: IceCreamDailySale[]) => Promise<void>;
  onCancelSale: (id: string, reason?: string) => Promise<void>;
  onUpdatePrice: (id: string, price: number) => Promise<void>;
  onAddTransaction: (tx: IceCreamTransaction) => Promise<void>;
  onAddItem: (name: string, category: string, price: number, flavor?: string, stockInitial?: number, unit?: string, consumptionPerSale?: number, targetStoreId?: string, recipe?: IceCreamRecipeItem[]) => Promise<void>;
  onSaveProduct: (product: Partial<IceCreamItem>) => Promise<void>;
  onDeleteItem: (id: string) => Promise<void>;
  onUpdateStock: (storeId: string, base: string, value: number, unit: string, type: 'production' | 'adjustment' | 'purchase' | 'inventory', stockId?: string) => Promise<void>;
  liquidatePromissory: (id: string) => Promise<void>;
  onDeleteStockItem: (id: string) => Promise<void>;
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
    user, stores = [], items = [], stock = [], sales = [], finances = [], promissories = [], can, pagePermissions = [],
    onAddSales, onCancelSale, onUpdatePrice, onAddTransaction, onAddItem, onSaveProduct, onDeleteItem, onUpdateStock,
    liquidatePromissory, onDeleteStockItem
}) => {
  const [activeTab, setActiveTab] = useState<'pdv' | 'estoque' | 'dre_diario' | 'dre_mensal' | 'audit' | 'produtos'>('pdv');
  const [dreSubTab, setDreSubTab] = useState<'resumo' | 'detalhado'>('resumo');
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

  const [showProductModal, setShowProductModal] = useState(false);
  const [showTransactionModal, setShowTransactionModal] = useState(false);
  const [showWastageModal, setShowWastageModal] = useState(false);
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [expenseCategories, setExpenseCategories] = useState<{id: string, name: string}[]>([]);
  const [newCategoryName, setNewCategoryName] = useState('');

  const [showPartnersModal, setShowPartnersModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState<{id: string, code: string} | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  
  const [showNewInsumoModal, setShowNewInsumoModal] = useState(false);
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [showInventoryModal, setShowInventoryModal] = useState(false);

  const [partners, setPartners] = useState<StoreProfitPartner[]>([]);
  const [expandedEmployee, setExpandedEmployee] = useState<string | null>(null);
  
  const [newInsumo, setNewInsumo] = useState({ name: '', unit: 'un', initial: '' });
  const [purchaseForm, setPurchaseForm] = useState<Record<string, string>>({}); 
  const [inventoryForm, setInventoryForm] = useState<Record<string, string>>({});
  const [wastageForm, setWastageForm] = useState({ stockId: '', quantity: '', reason: 'DEFEITO / AVARIA' });

  const [editingProduct, setEditingProduct] = useState<IceCreamItem | null>(null);
  const [productForm, setProductForm] = useState<Partial<IceCreamItem>>({ name: '', category: 'Copinho', price: 0, active: true, recipe: [] });
  const [newRecipeItem, setNewRecipeItem] = useState({ stock_base_name: '', quantity: '1' });

  const [txForm, setTxForm] = useState({ date: new Date().toLocaleDateString('en-CA'), category: '', value: '', description: '' });
  
  const [manualStoreId, setManualStoreId] = useState('');
  const isAdmin = user.role === UserRole.ADMIN;
  const effectiveStoreId = isAdmin 
    ? (manualStoreId || user.storeId || (stores.length > 0 ? stores[0].id : ''))
    : (user.storeId || (stores.length > 0 ? stores[0].id : ''));
  
  const visibleTabs = useMemo(() => {
    const tabs = [
      { id: 'PDV', label: 'PDV', icon: ShoppingCart, view: 'pdv' },
      { id: 'ESTOQUE', label: 'Estoque', icon: Package, view: 'estoque' },
      { id: 'DRE_DIARIO', label: 'DRE Diário', icon: Clock, view: 'dre_diario' },
      { id: 'DRE_MENSAL', label: 'DRE Mensal', icon: FileBarChart, view: 'dre_mensal' },
      { id: 'AUDIT', label: 'Auditoria', icon: History, view: 'audit' },
      { id: 'CONFIG', label: 'Produtos', icon: PackagePlus, view: 'produtos' }
    ];
    const allowedIds = getVisibleTabs(pagePermissions, user.role);
    return tabs.filter(tab => allowedIds.includes(tab.id));
  }, [pagePermissions, user.role]);

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

  const fetchExpenseCategories = async () => {
    if (!effectiveStoreId) return;
    const { data } = await supabase.from('ice_cream_expense_categories').select('*').eq('store_id', effectiveStoreId).order('name', { ascending: true });
    if (data) {
        setExpenseCategories(data);
        if (data.length > 0 && !txForm.category) {
            setTxForm(prev => ({ ...prev, category: data[0].name }));
        }
    }
  };

  useEffect(() => { 
      fetchPartners(); 
      fetchExpenseCategories();
  }, [effectiveStoreId]);

  const handleAddCategory = async () => {
      if (!newCategoryName.trim()) return;
      const { error } = await supabase.from('ice_cream_expense_categories').insert([{ store_id: effectiveStoreId, name: newCategoryName.toUpperCase().trim() }]);
      if (error) { alert("Erro ao adicionar categoria."); }
      else { setNewCategoryName(''); fetchExpenseCategories(); }
  };

  const handleDeleteCategory = async (id: string) => {
      if (!window.confirm("Deseja remover esta categoria?")) return;
      const { error } = await supabase.from('ice_cream_expense_categories').delete().eq('id', id);
      if (error) { alert("Erro ao remover."); }
      else { fetchExpenseCategories(); }
  };

  const filteredItems = useMemo(() => (items ?? []).filter(i => i.storeId === effectiveStoreId), [items, effectiveStoreId]);
  const filteredStock = useMemo(() => (stock ?? []).filter(s => s.store_id === effectiveStoreId && (s.is_active !== false)).sort((a,b) => a.product_base.localeCompare(b.product_base)), [stock, effectiveStoreId]);
  
  const todayKey = new Date().toLocaleDateString('en-CA'); 
  const periodKey = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`;

  const dreStats = useMemo(() => {
      const daySales = (sales ?? []).filter(s => s.createdAt?.startsWith(todayKey) && s.status !== 'canceled' && s.storeId === effectiveStoreId);
      const monthSales = (sales ?? []).filter(s => s.createdAt?.startsWith(periodKey) && s.status !== 'canceled' && s.storeId === effectiveStoreId);
      const dayFinances = (finances ?? []).filter(f => f.date === todayKey && f.storeId === effectiveStoreId);
      const monthFinances = (finances ?? []).filter(f => f.date?.startsWith(periodKey) && f.storeId === effectiveStoreId);

      let dayIn = 0;
      const dayMethods = { pix: 0, money: 0, card: 0, fiado: 0 };
      daySales.forEach(s => {
          dayIn += Number(s.totalValue);
          if (s.paymentMethod === 'Pix') dayMethods.pix += Number(s.totalValue);
          else if (s.paymentMethod === 'Dinheiro') dayMethods.money += Number(s.totalValue);
          else if (s.paymentMethod === 'Cartão') dayMethods.card += Number(s.totalValue);
          else if (s.paymentMethod === 'Fiado') dayMethods.fiado += Number(s.totalValue);
          else if (s.paymentMethod === 'Misto') {
              const relatedFinances = dayFinances.filter(f => f.type === 'entry' && f.description?.includes(s.saleCode || ''));
              relatedFinances.forEach(f => {
                  const desc = f.description?.toLowerCase() || '';
                  if (desc.includes('via pix')) dayMethods.pix += Number(f.value);
                  else if (desc.includes('via dinheiro')) dayMethods.money += Number(f.value);
                  else if (desc.includes('via cartão')) dayMethods.card += Number(f.value);
                  else if (desc.includes('via fiado')) dayMethods.fiado += Number(f.value);
              });
          }
      });

      const dayExits = dayFinances.filter(f => f.type === 'exit');
      const dayOut = dayExits.reduce((a, b) => a + Number(b.value), 0);
      let monthIn = 0;
      const monthMethods = { pix: 0, money: 0, card: 0, fiado: 0 };
      const monthFiadoDetails: any[] = [];

      monthSales.forEach(s => {
          monthIn += Number(s.totalValue);
          if (s.paymentMethod === 'Pix') monthMethods.pix += Number(s.totalValue);
          else if (s.paymentMethod === 'Dinheiro') monthMethods.money += Number(s.totalValue);
          else if (s.paymentMethod === 'Cartão') monthMethods.card += Number(s.totalValue);
          else if (s.paymentMethod === 'Fiado') { monthMethods.fiado += Number(s.totalValue); monthFiadoDetails.push(s); }
          else if (s.paymentMethod === 'Misto') {
              const relatedFinances = monthFinances.filter(f => f.type === 'entry' && f.description?.includes(s.saleCode || ''));
              relatedFinances.forEach(f => {
                  const desc = f.description?.toLowerCase() || '';
                  if (desc.includes('via pix')) monthMethods.pix += Number(f.value);
                  else if (desc.includes('via dinheiro')) monthMethods.money += Number(f.value);
                  else if (desc.includes('via cartão')) dayMethods.card += Number(f.value);
                  else if (desc.includes('via fiado')) { monthMethods.fiado += Number(f.value); monthFiadoDetails.push({ ...s, totalValue: f.value, paymentMethod: 'Fiado' }); }
              });
          }
      });

      const monthOut = monthFinances.filter(f => f.type === 'exit').reduce((a, b) => a + Number(b.value), 0);
      const profit = monthIn - monthOut;
      const resumo: Record<string, { qtd: number; total: number }> = {};
      daySales.forEach(venda => {
          if (!resumo[venda.productName]) resumo[venda.productName] = { qtd: 0, total: 0 };
          resumo[venda.productName].qtd += Number(venda.unitsSold);
          resumo[venda.productName].total += Number(venda.totalValue);
      });

      return {
          dayIn, dayOut, dayMethods, dayExits, resumoItensRodape: Object.entries(resumo).sort((a, b) => b[1].qtd - a[1].qtd),
          daySales: daySales.sort((a,b) => (b.createdAt || '').localeCompare(a.createdAt || '')),
          monthMethods, monthIn, monthOut, profit, monthFiadoDetails: monthFiadoDetails.sort((a,b) => (b.createdAt || '').localeCompare(a.createdAt || '')),
      };
  }, [sales, finances, todayKey, periodKey, effectiveStoreId]);

  const monthFiadoGrouped = useMemo(() => {
    const groups: Record<string, { name: string, total: number, items: any[] }> = {};
    dreStats.monthFiadoDetails.forEach(f => {
        const name = f.buyer_name || 'NÃO INFORMADO';
        if (!groups[name]) groups[name] = { name, total: 0, items: [] };
        groups[name].total += Number(f.totalValue);
        groups[name].items.push(f);
    });
    return Object.values(groups).sort((a, b) => b.total - a.total);
  }, [dreStats.monthFiadoDetails]);

  const groupedAuditSales = useMemo(() => {
    const grouped: Record<string, any> = {};
    const filtered = (sales || []).filter(s => {
        if (s.storeId !== effectiveStoreId) return false;
        if (!s.createdAt) return false;
        const date = new Date(s.createdAt);
        const dMatch = auditDay ? date.getDate() === parseInt(auditDay) : true;
        const mMatch = auditMonth ? (date.getMonth() + 1) === parseInt(auditMonth) : true;
        const yMatch = auditYear ? date.getFullYear() === parseInt(auditYear) : true;
        const search = auditSearch.toLowerCase();
        const sMatch = search ? (s.productName.toLowerCase().includes(search) || s.saleCode?.toLowerCase().includes(search) || s.buyer_name?.toLowerCase().includes(search)) : true;
        return dMatch && mMatch && yMatch && sMatch;
    });
    filtered.forEach(s => {
      const code = s.saleCode || 'GEL-000';
      if (!grouped[code]) grouped[code] = { saleCode: code, createdAt: s.createdAt, buyer_name: s.buyer_name, status: s.status, totalValue: 0, paymentMethods: new Set<string>(), items: [] };
      grouped[code].totalValue += Number(s.totalValue);
      grouped[code].paymentMethods.add(s.paymentMethod);
      grouped[code].items.push(s);
    });
    return Object.values(grouped).sort((a: any, b: any) => (b.createdAt || '').localeCompare(a.createdAt || '')).map((g: any) => ({ ...g, paymentMethods: Array.from(g.paymentMethods) }));
  }, [sales, effectiveStoreId, auditDay, auditMonth, auditYear, auditSearch]);

  const handlePrintDreMensal = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) { alert("Pop-up bloqueado!"); return; }
    const store = stores.find(s => s.id === effectiveStoreId);
    const monthLabel = MONTHS.find(m => m.value === selectedMonth)?.label;
    const html = `<html><head><title>DRE Mensal</title><style>body{font-family:sans-serif;padding:30px;color:#1e293b;}h2{color:#1e3a8a;border-bottom:2px solid #1e3a8a;padding-bottom:10px;}.section{margin-bottom:20px;padding:15px;border:1px solid #e2e8f0;border-radius:10px;}.kpi{display:flex;justify-content:space-between;font-weight:bold;}table{width:100%;border-collapse:collapse;}th,td{text-align:left;padding:8px;border-bottom:1px solid #f1f5f9;font-size:12px;}</style></head><body><div class="header"><h2>GELATERIA REAL</h2><p>UNIDADE: ${store?.number || '---'} | ${monthLabel} / ${selectedYear}</p></div><div class="section"><div class="kpi"><span>Faturamento (+)</span> <span style="color:green">${formatCurrency(dreStats.monthIn)}</span></div><div class="kpi"><span>Despesas (-)</span> <span style="color:red">${formatCurrency(dreStats.monthOut)}</span></div><hr/><div class="kpi"><span>LUCRO LÍQUIDO</span> <span>${formatCurrency(dreStats.profit)}</span></div></div><div class="section"><p><b>DÉBITOS DE FUNCIONÁRIOS</b></p><table><thead><tr><th>Nome</th><th style="text-align:right">Total</th></tr></thead><tbody>${monthFiadoGrouped.map(f => `<tr><td>${f.name}</td><td style="text-align:right">${formatCurrency(f.total)}</td></tr>`).join('')}</tbody></table></div><script>window.onload=()=>{window.print();setTimeout(()=>window.close(),500);};</script></body></html>`;
    printWindow.document.write(html); printWindow.document.close();
  };

  const handlePrintTicket = (items: IceCreamDailySale[], saleCode: string, method: string | null, buyer?: string) => {
    const printWindow = window.open('', '_blank', 'width=300,height=600');
    if (!printWindow) {
        alert("O navegador bloqueou a abertura do ticket. Por favor, permita pop-ups para esta página.");
        return;
    }
    const total = items.reduce((acc, curr) => acc + curr.totalValue, 0);
    const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                @page { margin: 0; }
                body { 
                    font-family: 'Courier New', Courier, monospace; 
                    width: 72mm; 
                    padding: 4mm; 
                    font-size: 11px; 
                    color: #000;
                    background: #fff;
                    margin: 0;
                }
                .text-center { text-align: center; }
                .bold { font-weight: bold; }
                hr { border: 0; border-top: 1px dashed #000; margin: 2mm 0; }
                .flex { display: flex; justify-content: space-between; }
                .mt-2 { margin-top: 2mm; }
                .footer { font-size: 9px; margin-top: 5mm; }
            </style>
        </head>
        <body>
            <div class="text-center bold" style="font-size: 14px;">GELATERIA REAL</div>
            <div class="text-center" style="font-size: 9px;">Comprovante de Venda</div>
            <hr/>
            <div class="flex"><span class="bold">COD:</span> <span>#${saleCode}</span></div>
            <div class="flex"><span>DATA:</span> <span>${new Date().toLocaleString('pt-BR')}</span></div>
            <hr/>
            <div class="bold">ITENS:</div>
            ${items.map(i => `
                <div class="flex" style="margin-top: 1mm;">
                    <span>${i.unitsSold}x ${i.productName}</span>
                    <span>${formatCurrency(i.totalValue)}</span>
                </div>
            `).join('')}
            <hr/>
            <div class="flex bold" style="font-size: 13px;">
                <span>TOTAL</span>
                <span>${formatCurrency(total)}</span>
            </div>
            <div class="mt-2 flex"><span>PAGTO:</span> <span class="bold">${(method || 'MISTO').toUpperCase()}</span></div>
            ${buyer ? `<div class="flex"><span>FUNC:</span> <span class="bold">${buyer}</span></div>` : ''}
            <hr/>
            <div class="text-center footer">
                Obrigado pela preferência!<br/>
                Real Admin v6.5
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
    printWindow.document.write(html); 
    printWindow.document.close();
  };

  const finalizeSale = async () => {
    if (cart.length === 0 || !paymentMethod) return;
    const isMisto = paymentMethod === 'Misto';
    const splitData = isMisto ? Object.entries(mistoValues).map(([method, val]) => ({ method: method as IceCreamPaymentMethod, amount: parseFloat((val as string).replace(',', '.')) || 0 })).filter(p => p.amount > 0) : [{ method: paymentMethod as IceCreamPaymentMethod, amount: cartTotal }];
    if (isMisto && Math.abs(splitData.reduce((a, b) => a + b.amount, 0) - cartTotal) > 0.05) { alert("Total divergente."); return; }
    setIsSubmitting(true);
    const saleCode = `GEL-${Date.now().toString().slice(-6)}`;
    try {
      const operationalSales = cart.map(item => ({ ...item, paymentMethod: (isMisto ? 'Misto' : paymentMethod) as IceCreamPaymentMethod, buyer_name: (paymentMethod === 'Fiado' || (isMisto && mistoValues['Fiado'])) ? buyerName.toUpperCase() : undefined, saleCode, unitsSold: Math.round(item.unitsSold), status: 'active' as const }));
      const financialPromises = splitData.map(payment => onAddTransaction({ id: '0', storeId: effectiveStoreId, date: new Date().toISOString().split('T')[0], type: 'entry', category: 'RECEITA DE VENDA PDV', value: payment.amount, description: `Pagamento via ${payment.method} - Ref. ${saleCode}`, createdAt: new Date() }));
      await Promise.all([onAddSales(operationalSales), ...financialPromises]);
      for (const c of cart) {
        const itemDef = items.find(it => it.id === c.itemId);
        if (itemDef?.recipe) {
          for (const ingredient of itemDef.recipe) { await onUpdateStock(effectiveStoreId, String(ingredient.stock_base_name).toUpperCase(), -(ingredient.quantity * c.unitsSold), '', 'adjustment'); }
        }
      }
      handlePrintTicket(operationalSales, saleCode, isMisto ? 'Misto' : (paymentMethod as string), (paymentMethod === 'Fiado' || (isMisto && mistoValues['Fiado'])) ? buyerName : undefined);
      setCart([]); setPaymentMethod(null); setBuyerName(''); setAmountReceived(''); setMistoValues({ 'Pix': '', 'Dinheiro': '', 'Cartão': '', 'Fiado': '' });
      alert("Venda registrada!");
    } catch (e) { alert("Falha ao registrar venda."); } finally { setIsSubmitting(false); }
  };

  const handleCancelSale = async () => {
    if (!showCancelModal) return;
    const targetSales = sales.filter(s => s.saleCode === showCancelModal.code);
    if (targetSales.length === 0) return;
    setIsSubmitting(true);
    try {
      for (const soldItem of targetSales) {
        const itemDef = items.find(it => it.id === soldItem.itemId) || items.find(it => it.name === soldItem.productName);
        if (itemDef?.recipe) {
          for (const ingredient of itemDef.recipe) { await onUpdateStock(effectiveStoreId, String(ingredient.stock_base_name).toUpperCase(), (ingredient.quantity * soldItem.unitsSold), '', 'adjustment'); }
        }
      }
      await onCancelSale(showCancelModal.code, cancelReason);
      setShowCancelModal(null); setCancelReason(''); alert("Estorno realizado!");
    } catch (e) { alert("Erro no estorno."); } finally { setIsSubmitting(false); }
  };

  const handleSaveProductForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try { await onSaveProduct({ ...productForm, storeId: effectiveStoreId }); setShowProductModal(false); setEditingProduct(null); alert("Produto salvo!"); } catch (e) { alert("Erro ao salvar."); } finally { setIsSubmitting(false); }
  };

  const handleSaveTransaction = async () => {
    if (!txForm.value || !txForm.description || !txForm.category) return;
    setIsSubmitting(true);
    try { 
      await onAddTransaction({ id: '0', storeId: effectiveStoreId, date: txForm.date, type: 'exit', category: txForm.category, value: parseFloat(txForm.value.replace(',', '.')), description: txForm.description, createdAt: new Date() }); 
      setShowTransactionModal(false); 
      setTxForm({ date: new Date().toLocaleDateString('en-CA'), category: expenseCategories[0]?.name || '', value: '', description: '' }); 
      alert("Saída lançada!"); 
    } catch (e) { alert("Erro ao lançar."); } finally { setIsSubmitting(false); }
  };

  const handleSaveWastage = async () => {
      if (!wastageForm.stockId || !wastageForm.quantity || !effectiveStoreId) return;
      setIsSubmitting(true);
      try {
          const stItem = stock.find(s => s.stock_id === wastageForm.stockId);
          if (!stItem) throw new Error("Insumo não encontrado");
          
          const val = parseFloat(wastageForm.quantity.replace(',', '.'));
          // Salva como saída no financeiro se houver custo (opcional, aqui foca no estoque)
          await onUpdateStock(effectiveStoreId, stItem.product_base, -val, stItem.unit, 'adjustment', stItem.stock_id);
          
          // Registra como despesa de operação no financeiro
          await onAddTransaction({
              id: '0', storeId: effectiveStoreId, date: new Date().toISOString().split('T')[0],
              type: 'exit', category: 'AVARIA / DEFEITO PRODUTO', value: 0, // Valor zero pois é perda física
              description: `Baixa de Avaria: ${val}${stItem.unit} de ${stItem.product_base}. Motivo: ${wastageForm.reason}`,
              createdAt: new Date()
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

  const handleSavePurchase = async () => {
    setIsSubmitting(true);
    try {
      for (const [stockId, valueStr] of Object.entries(purchaseForm)) {
        const val = parseFloat((String(valueStr || '')).replace(',', '.'));
        if (Number.isNaN(val) || val === 0) continue;
        const stockItem = stock.find(s => s.stock_id === stockId);
        if (stockItem) await onUpdateStock(effectiveStoreId, stockItem.product_base, val, stockItem.unit, 'purchase', stockItem.stock_id);
      }
      setPurchaseForm({}); setShowPurchaseModal(false); alert("Estoque abastecido!");
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
    <div className="flex flex-col h-full bg-gray-50 overflow-hidden font-sans relative">
        <div className="bg-white border-b px-4 md:px-6 py-2 flex flex-col md:flex-row justify-between items-center gap-2 z-40 shadow-sm shrink-0">
            <div className="flex items-center gap-2">
                <div className="p-1.5 bg-blue-900 rounded-xl text-white shadow-lg shrink-0"><IceCream size={18} /></div>
                <div className="truncate">
                    <h2 className="text-sm md:text-base font-black uppercase italic tracking-tighter text-blue-950 leading-none">Gelateria <span className="text-red-600">Real</span></h2>
                    <div className="flex items-center gap-1 mt-0.5">
                        <p className="text-[7px] font-black text-gray-400 uppercase tracking-widest leading-none">Unidade</p>
                        {isAdmin ? (
                            <select value={effectiveStoreId} onChange={(e) => setManualStoreId(e.target.value)} className="bg-transparent border-none text-[8px] font-black text-blue-600 uppercase outline-none focus:ring-0 p-0 h-auto min-h-0">
                                {[...stores].sort((a, b) => parseInt(a.number || '0') - parseInt(b.number || '0')).map(s => <option key={s.id} value={s.id}>{s.number} - {s.city}</option>)}
                            </select>
                        ) : <span className="text-[8px] font-black text-blue-600 uppercase">{stores.find(s => s.id === effectiveStoreId)?.number} - {stores.find(s => s.id === effectiveStoreId)?.city}</span>}
                    </div>
                </div>
            </div>
            <div className="flex bg-gray-100 p-0.5 rounded-xl overflow-x-auto no-scrollbar w-full md:w-auto max-w-full">
                {visibleTabs.map(tab => (
                    <button 
                        key={tab.id} 
                        onClick={() => setActiveTab(tab.view as any)} 
                        className={`flex-1 md:flex-none px-3 py-2 rounded-lg text-[8px] md:text-[9px] font-black uppercase transition-all flex items-center justify-center gap-1.5 whitespace-nowrap ${activeTab === tab.view ? 'bg-white text-blue-900 shadow-sm border border-blue-100' : 'text-gray-400 hover:text-blue-900 hover:bg-white/50'}`}
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
                            onAddTransaction={onAddTransaction} 
                            onUpdateStock={onUpdateStock} 
                            handlePrintTicket={handlePrintTicket} 
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
                        <div className="flex items-center gap-4"><div className="p-4 bg-blue-50 text-blue-700 rounded-3xl"><Clock size={32}/></div><div><h3 className="text-2xl font-black uppercase italic text-blue-950 tracking-tighter">Fluxo de Caixa <span className="text-blue-700">Diário</span></h3><div className="flex bg-gray-100 p-1 rounded-lg mt-2"><button onClick={() => setDreSubTab('resumo')} className={`px-4 py-1.5 rounded-md text-[9px] font-black uppercase transition-all ${dreSubTab === 'resumo' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-400'}`}>Resumo</button><button onClick={() => setDreSubTab('detalhado')} className={`px-4 py-1.5 rounded-md text-[9px] font-black uppercase transition-all ${dreSubTab === 'detalhado' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-400'}`}>Detalhado</button></div></div></div>
                        <div className="flex flex-col items-end gap-2">
                             <div className="flex gap-2">
                                <button onClick={() => setShowWastageModal(true)} className="px-6 py-2.5 bg-orange-500 text-white rounded-xl font-black uppercase text-[10px] shadow-lg flex items-center gap-2 border-b-4 border-orange-700 active:scale-95"><AlertTriangle size={14}/> Baixa Avaria</button>
                                <button onClick={() => setShowTransactionModal(true)} className="px-6 py-2.5 bg-red-600 text-white rounded-xl font-black uppercase text-[10px] shadow-lg flex items-center gap-2 border-b-4 border-red-900 active:scale-95"><DollarSign size={14}/> Lançar Saída (Sangria)</button>
                             </div>
                             <div className="text-right"><p className="text-[9px] font-black text-gray-400 uppercase">Apuração</p><p className="text-lg font-black text-blue-950">{todayKey.split('-').reverse().join('/')}</p></div>
                        </div>
                    </div>
                  {dreSubTab === 'resumo' && (
                        <div className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="bg-white p-6 rounded-[32px] border-2 border-green-100 shadow-sm space-y-4">
                                    <span className="text-[9px] font-black text-green-600 uppercase tracking-widest">Resumo Entradas (+)</span>
                                    <div className="space-y-2">
                                        <div className="flex justify-between items-center text-[10px] font-black border-b border-gray-50 pb-1"><span className="text-gray-400 uppercase">Pix</span><span className="text-gray-900">{formatCurrency(dreStats.dayMethods.pix)}</span></div>
                                        <div className="flex justify-between items-center text-[10px] font-black border-b border-gray-50 pb-1"><span className="text-gray-400 uppercase">Dinheiro</span><span className="text-gray-900">{formatCurrency(dreStats.dayMethods.money)}</span></div>
                                        <div className="flex justify-between items-center text-[10px] font-black border-b border-gray-50 pb-1"><span className="text-gray-400 uppercase">Cartão</span><span className="text-gray-900">{formatCurrency(dreStats.dayMethods.card)}</span></div>
                                        <div className="flex justify-between items-center text-[10px] font-black border-b border-gray-50 pb-1"><span className="text-gray-400 uppercase">Fiado</span><span className="text-gray-900">{formatCurrency(dreStats.dayMethods.fiado)}</span></div>
                                    </div>
                                    <div className="pt-2 border-t-2 border-green-50"><p className="text-2xl font-black text-green-700 italic">{formatCurrency(dreStats.dayIn)}</p></div>
                                </div>
                                <div className="bg-white p-6 rounded-[32px] border-2 border-red-100 shadow-sm flex flex-col justify-between"><div><span className="text-[9px] font-black text-red-600 uppercase tracking-widest">Resumo Saídas (-)</span><p className="text-3xl font-black text-red-700 italic mt-4">{formatCurrency(dreStats.dayOut)}</p></div></div>
                                <div className="bg-gray-950 p-6 rounded-[32px] text-white shadow-xl flex flex-col justify-between"><div><span className="text-[9px] font-black text-blue-400 uppercase tracking-widest">Saldo Líquido</span><p className="text-3xl font-black italic mt-4">{formatCurrency(dreStats.dayIn - dreStats.dayOut)}</p></div></div>
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
                            <div className="flex items-center gap-2 bg-gray-50 p-2 rounded-2xl border"><select value={selectedMonth} onChange={e => setSelectedMonth(Number(e.target.value))} className="bg-transparent border-none text-xs font-black uppercase outline-none">{MONTHS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}</select><select value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))} className="bg-transparent border-none text-xs font-black outline-none">{[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}</select></div>
                            <button onClick={handlePrintDreMensal} className="px-6 py-2.5 bg-gray-900 text-white rounded-xl font-black uppercase text-[10px] shadow-lg flex items-center gap-2 border-b-4 border-gray-700 active:scale-95"><Printer size={14}/> Imprimir Relatório</button>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                        <div className="lg:col-span-8 space-y-6">
                            <div className="bg-white p-8 rounded-[40px] shadow-sm border border-gray-100"><h4 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-6 flex items-center gap-2"><Briefcase size={14}/> Demonstrativo de Resultado</h4><div className="space-y-4">
                                <div className="flex justify-between items-center pb-4 border-b"><span className="font-bold text-gray-600 uppercase text-xs">Faturamento (+)</span><span className="font-black text-green-600 text-lg">{formatCurrency(dreStats.monthIn)}</span></div>
                                <div className="flex justify-between items-center pb-4 border-b"><span className="font-bold text-gray-600 uppercase text-xs">Despesas / Saídas (-)</span><span className="font-black text-red-600 text-lg">{formatCurrency(dreStats.monthOut)}</span></div>
                                <div className="flex justify-between items-center pt-2"><span className="font-black text-blue-950 uppercase text-sm">Lucro Líquido (=)</span><span className="font-black text-blue-900 text-2xl italic">{formatCurrency(dreStats.profit)}</span></div>
                            </div></div>
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
                            <h4 className="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em] mb-6 flex items-center gap-3"><UsersIcon size={16}/> Partilha de Lucros</h4>
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
                                        </React.Fragment>                                    ))}
                                    {monthFiadoGrouped.length === 0 && (<tr><td colSpan={2} className="p-16 text-center text-gray-400 uppercase tracking-[0.3em] italic">Nenhuma compra no fiado</td></tr>)}
                                </tbody>
                            </table>
                        </div>
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
                        <h3 className="text-xl font-black uppercase italic text-blue-950 tracking-tighter flex items-center gap-3"><History className="text-blue-700" size={28}/> Auditoria de <span className="text-red-600">Vendas Operacionais</span></h3>
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                            <select value={auditDay} onChange={e => setAuditDay(e.target.value)} className="bg-gray-50 border-none rounded-xl p-3 text-[10px] font-black uppercase outline-none shadow-inner"><option value="">DIA</option>{Array.from({length: 31}, (_, i) => <option key={i+1} value={i+1}>{i+1}</option>)}</select>
                            <select value={auditMonth} onChange={e => setAuditMonth(e.target.value)} className="bg-gray-50 border-none rounded-xl p-3 text-[10px] font-black uppercase outline-none shadow-inner"><option value="">MÊS</option>{MONTHS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}</select>
                            <select value={auditYear} onChange={e => setAuditYear(e.target.value)} className="bg-gray-50 border-none rounded-xl p-3 text-[10px] font-black uppercase outline-none shadow-inner"><option value="">ANO</option>{[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}</select>
                            <div className="col-span-2 relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" size={14}/><input value={auditSearch} onChange={e => setAuditSearch(e.target.value)} placeholder="PRODUTO, CÓDIGO OU FUNCIONÁRIO..." className="w-full bg-gray-50 border-none rounded-xl pl-10 pr-4 py-3 text-[10px] font-black uppercase outline-none shadow-inner" /></div>
                        </div>
                    </div>
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
                                                        onClick={() => handlePrintTicket(saleGroup.items, saleGroup.saleCode, saleGroup.paymentMethods.join(' + '), saleGroup.buyer_name)} 
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
                            </tbody>
                        </table>
                    </div>
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
                                    <img src={item.image_url || getCategoryIconEdit(item.category, item.name)} className="w-full h-full object-contain p-2" />
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
                <div className="bg-white rounded-[40px] w-full max-w-md shadow-2xl animate-in zoom-in duration-300 border-t-8 border-orange-600 overflow-hidden">
                    <div className="p-8 border-b bg-gray-50/50 flex justify-between items-center"><h3 className="text-xl font-black uppercase italic text-blue-950 flex items-center gap-3"><Plus className="text-orange-600" /> Novo <span className="text-orange-600">Insumo</span></h3><button onClick={() => setShowNewInsumoModal(false)} className="text-gray-400 hover:text-red-600"><X size={24}/></button></div>
                    <div className="p-10 space-y-6">
                        <div className="space-y-2"><label className="text-[10px] font-black text-gray-400 uppercase ml-2">Nome do Insumo (EX: COPO 300ML)</label><input value={newInsumo.name} onChange={e => setNewInsumo({...newInsumo, name: e.target.value})} className="w-full p-4 bg-gray-50 rounded-2xl font-black text-gray-900 uppercase shadow-inner outline-none" /></div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2"><label className="text-[10px] font-black text-gray-400 uppercase ml-2">Unidade</label><select value={newInsumo.unit} onChange={e => setNewInsumo({...newInsumo, unit: e.target.value})} className="w-full p-4 bg-gray-50 rounded-2xl font-black outline-none"><option value="un">un</option><option value="kg">kg</option><option value="ml">ml</option></select></div>
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
                                        <div className="space-y-2"><label className="text-[9px] font-black text-gray-500 uppercase ml-2">Categoria</label><select value={productForm.category} onChange={e => setProductForm({...productForm, category: e.target.value as IceCreamCategory})} className="w-full p-4 bg-gray-50 rounded-2xl font-black uppercase outline-none">{PRODUCT_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
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

        {showTransactionModal && (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[130] p-4">
                <div className="bg-white rounded-[40px] w-full max-w-md shadow-2xl animate-in zoom-in duration-300 border-t-8 border-red-600 overflow-hidden">
                    <div className="p-8 border-b bg-gray-50/50 flex justify-between items-center"><h3 className="text-xl font-black uppercase italic text-blue-950 flex items-center gap-3"><DollarSign className="text-red-600" /> Registrar <span className="text-red-600">Despesa</span></h3><button onClick={() => setShowTransactionModal(false)} className="text-gray-400 hover:text-red-600"><X size={24}/></button></div>
                    <div className="p-10 space-y-6">
                        <div className="space-y-2"><label className="text-[10px] font-black text-gray-400 uppercase ml-2 tracking-widest">Valor (R$)</label><input value={txForm.value} onChange={e => setTxForm({...txForm, value: e.target.value})} className="w-full p-5 bg-red-50 rounded-[24px] font-black text-red-700 text-2xl shadow-inner outline-none border-none text-center" placeholder="0,00" /></div>
                        <div className="space-y-2"><label className="text-[10px] font-black text-gray-400 uppercase ml-2 tracking-widest">Descrição / Motivo</label><input value={txForm.description} onChange={e => setTxForm({...txForm, description: e.target.value.toUpperCase()})} className="w-full p-4 bg-gray-50 rounded-2xl font-black text-gray-900 uppercase shadow-inner outline-none" placeholder="EX: COMPRA DE LEITE, LIMP." /></div>
                        <div className="space-y-2">
                            <div className="flex justify-between items-center ml-2">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Categoria</label>
                                <button onClick={() => setShowCategoryManager(true)} className="text-gray-400 hover:text-blue-600 transition-all"><Settings size={14}/></button>
                            </div>
                            <select value={txForm.category} onChange={e => setTxForm({...txForm, category: e.target.value})} className="w-full p-4 bg-gray-50 rounded-2xl font-black outline-none border-none shadow-inner">
                                <option value="">SELECIONE...</option>
                                {expenseCategories.map(cat => (
                                    <option key={cat.id} value={cat.name}>{cat.name}</option>
                                ))}
                            </select>
                        </div>
                        <button onClick={handleSaveTransaction} disabled={isSubmitting || !txForm.category} className="w-full py-5 bg-red-600 text-white rounded-[28px] font-black uppercase text-xs shadow-xl active:scale-95 transition-all border-b-4 border-red-900 flex items-center justify-center gap-3">{isSubmitting ? <Loader2 className="animate-spin" /> : <Save size={18}/>} EFETIVAR LANÇAMENTO</button>
                    </div>
                </div>
            </div>
        )}

        {showCategoryManager && (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[150] p-4">
                <div className="bg-white rounded-[40px] w-full max-w-sm shadow-2xl animate-in zoom-in duration-300 border-t-8 border-blue-600 overflow-hidden">
                    <div className="p-6 border-b bg-gray-50/50 flex justify-between items-center"><h3 className="text-lg font-black uppercase italic text-blue-950 flex items-center gap-3"><Settings className="text-blue-600" /> Categorias</h3><button onClick={() => setShowCategoryManager(false)} className="text-gray-400 hover:text-red-600"><X size={20}/></button></div>
                    <div className="p-8 space-y-6">
                        <div className="flex gap-2">
                            <input value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)} placeholder="NOVA CATEGORIA..." className="flex-1 p-3 bg-gray-50 rounded-xl font-black uppercase text-[10px] outline-none border border-gray-200" />
                            <button onClick={handleAddCategory} className="bg-blue-600 text-white p-3 rounded-xl"><Plus size={18}/></button>
                        </div>
                        <div className="space-y-2 max-h-[300px] overflow-y-auto no-scrollbar">
                            {expenseCategories.map(cat => (
                                <div key={cat.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-xl border border-gray-100">
                                    <span className="text-[10px] font-black text-gray-700 uppercase">{cat.name}</span>
                                    <button onClick={() => handleDeleteCategory(cat.id)} className="text-red-300 hover:text-red-600"><Trash2 size={14}/></button>
                                </div>
                            ))}
                            {expenseCategories.length === 0 && <p className="text-[9px] text-gray-400 text-center py-4 uppercase font-bold italic">Nenhuma categoria configurada</p>}
                        </div>
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
    </div>
  );
};

export default IceCreamModule;