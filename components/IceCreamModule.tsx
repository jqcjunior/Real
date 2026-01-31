
import React, { useState, useMemo, useEffect } from 'react';
import { IceCreamItem, IceCreamDailySale, IceCreamTransaction, IceCreamCategory, IceCreamPaymentMethod, User, UserRole, Store, IceCreamStock, IceCreamPromissoryNote, IceCreamRecipeItem, StoreProfitPartner } from '../types';
import { formatCurrency, BRAND_LOGO } from '../constants';
import { 
    IceCream, Plus, Package, ShoppingCart, CheckCircle2, 
    Trash2, X, History, PieChart, ArrowDownCircle, ArrowUpCircle, 
    Loader2, Search, Trash, ChevronRight, Calculator, FileText, Ban, UserCheck, Save, Image as ImageIcon, Sliders, Settings, Calendar, BarChart3, ListChecks, TrendingUp, TrendingDown, DollarSign, Wallet, CreditCard, Banknote, PackagePlus, Printer, ClipboardList, AlertCircle, Info, ToggleLeft, ToggleRight, Receipt, ArrowRight,
    Users as UsersIcon, ShieldCheck, UserCog, Clock, FileBarChart, Users, Handshake, AlertTriangle, Zap, Beaker, Layers, Clipboard, Edit3, Filter, ChevronDown, FilePieChart, Briefcase, Warehouse, PencilLine, Truck
} from 'lucide-react';
import PDVMobileView from './PDVMobileView';
import { supabase } from '../services/supabaseClient';
import { PermissionKey } from '../security/permissions';

interface IceCreamModuleProps {
  user: User;
  stores: Store[];
  items: IceCreamItem[];
  stock: IceCreamStock[];
  sales: IceCreamDailySale[];
  finances: IceCreamTransaction[];
  promissories: IceCreamPromissoryNote[];
  can: (p: PermissionKey) => boolean;
  onAddSales: (sale: IceCreamDailySale[]) => Promise<void>;
  onCancelSale: (id: string, reason?: string) => Promise<void>;
  onUpdatePrice: (id: string, price: number) => Promise<void>;
  onAddTransaction: (tx: IceCreamTransaction) => Promise<void>;
  onAddItem: (name: string, category: string, price: number, flavor?: string, stockInitial?: number, unit?: string, consumptionPerSale?: number, targetStoreId?: string, recipe?: IceCreamRecipeItem[]) => Promise<void>;
  onSaveProduct: (product: Partial<IceCreamItem>) => Promise<void>;
  onDeleteItem: (id: string) => Promise<void>;
  onUpdateStock: (storeId: string, base: string, value: number, unit: string, type: 'production' | 'adjustment' | 'purchase') => Promise<void>;
  liquidatePromissory: (id: string) => Promise<void>;
}

const PRODUCT_CATEGORIES: IceCreamCategory[] = ['Sundae', 'Milkshake', 'Casquinha', 'Cascão', 'Cascão Trufado', 'Copinho', 'Bebidas', 'Adicionais'].sort() as IceCreamCategory[];

const getCategoryImage = (category: IceCreamCategory, name: string) => {
    const itemName = name.toLowerCase();
    if (['Sundae', 'Casquinha', 'Cascão', 'Cascão Trufado'].includes(category)) {
        return 'https://img.icons8.com/color/144/ice-cream-cone.png';
    }
    if (itemName.includes('nutella') || itemName.includes('calda') || itemName.includes('chocolate')) {
        return 'https://img.icons8.com/color/144/chocolate-spread.png';
    }
    if (itemName.includes('água') || itemName.includes('agua')) {
        return 'https://img.icons8.com/color/144/water-bottle.png';
    }
    const icons: Record<string, string> = {
        'Milkshake': 'https://img.icons8.com/color/144/milkshake.png',
        'Copinho': 'https://img.icons8.com/color/144/ice-cream-bowl.png',
        'Bebidas': 'https://img.icons8.com/color/144/natural-food.png',
        'Adicionais': 'https://img.icons8.com/color/144/sugar-bowl.png'
    };
    return icons[category] || 'https://img.icons8.com/color/144/ice-cream.png';
};

const MONTHS = [
  { value: 1, label: 'Janeiro' }, { value: 2, label: 'Fevereiro' }, { value: 3, label: 'Março' },
  { value: 4, label: 'Abril' }, { value: 5, label: 'Maio' }, { value: 6, label: 'Junho' },
  { value: 7, label: 'Julho' }, { value: 8, label: 'Agosto' }, { value: 9, label: 'Setembro' },
  { value: 10, label: 'Outubro' }, { value: 11, label: 'Novembro' }, { value: 12, label: 'Dezembro' }
];

const IceCreamModule: React.FC<IceCreamModuleProps> = ({ 
    user, stores = [], items = [], stock = [], sales = [], finances = [], promissories = [], can,
    onAddSales, onCancelSale, onUpdatePrice, onAddTransaction, onAddItem, onSaveProduct, onDeleteItem, onUpdateStock,
    liquidatePromissory
}) => {
  const [activeTab, setActiveTab] = useState<'pdv' | 'estoque' | 'dre_diario' | 'dre_mensal' | 'audit' | 'produtos'>('pdv');
  const [dreSubTab, setDreSubTab] = useState<'resumo' | 'detalhado'>('resumo');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cart, setCart] = useState<IceCreamDailySale[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<IceCreamCategory | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<IceCreamPaymentMethod | null>(null);
  const [mistoValues, setMistoValues] = useState<Record<string, string>>({ 'Pix': '', 'Dinheiro': '', 'Cartão': '' });
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
  const [showPartnersModal, setShowPartnersModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState<{id: string, code: string} | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  
  const [showNewInsumoModal, setShowNewInsumoModal] = useState(false);
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [showInventoryModal, setShowInventoryModal] = useState(false);

  const [partners, setPartners] = useState<StoreProfitPartner[]>([]);
  
  const [newInsumo, setNewInsumo] = useState({ name: '', unit: 'un', initial: '' });
  const [purchaseForm, setPurchaseForm] = useState<Record<string, string>>({}); 
  const [inventoryForm, setInventoryForm] = useState<Record<string, string>>({});

  const [newProd, setNewProd] = useState({ name: '', category: 'Copinho' as IceCreamCategory, price: '', flavor: '' });
  const [tempRecipe, setTempRecipe] = useState<IceCreamRecipeItem[]>([]);
  const [newRecipeItem, setNewRecipeItem] = useState({ stock_base_name: '', quantity: '1' });
  const [editingProduct, setEditingProduct] = useState<IceCreamItem | null>(null);

  const [txForm, setTxForm] = useState({ date: new Date().toLocaleDateString('en-CA'), category: 'Despesa Operacional', value: '', description: '' });
  
  const [manualStoreId, setManualStoreId] = useState('');
  const isAdmin = user.role === UserRole.ADMIN;
  const effectiveStoreId = isAdmin 
    ? (manualStoreId || user.storeId || (stores.length > 0 ? stores[0].id : ''))
    : (user.storeId || (stores.length > 0 ? stores[0].id : ''));
  
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

  useEffect(() => { fetchPartners(); }, [effectiveStoreId]);

  const filteredItems = useMemo(() => (items ?? []).filter(i => i.storeId === effectiveStoreId), [items, effectiveStoreId]);
  const filteredStock = useMemo(() => (stock ?? []).filter(s => s.store_id === effectiveStoreId).sort((a,b) => a.product_base.localeCompare(b.product_base)), [stock, effectiveStoreId]);
  
  // Robust day key generation (ISO local)
  const todayDate = new Date();
  const todayKey = `${todayDate.getFullYear()}-${String(todayDate.getMonth() + 1).padStart(2, '0')}-${String(todayDate.getDate()).padStart(2, '0')}`;
  const periodKey = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`;

  const dreStats = useMemo(() => {
      // 1. Filtrar Vendas Operacionais do dia (Fonte Primária)
      const daySales = (sales ?? []).filter(s => 
          s.createdAt?.startsWith(todayKey) && 
          s.status !== 'canceled' && 
          s.storeId === effectiveStoreId
      );

      // 2. Filtrar Finanças do dia (Saídas e Rateio)
      const dayFinances = (finances ?? []).filter(f => 
          f.date?.startsWith(todayKey) && 
          f.storeId === effectiveStoreId
      );

      // 3. Resumo de Entradas via Sales (Garante que se salvou no PDV, aparece no DRE)
      let dayIn = 0;
      const dayMethods = { pix: 0, money: 0, card: 0, fiado: 0 };

      daySales.forEach(s => {
          dayIn += Number(s.totalValue);
          if (s.paymentMethod === 'Pix') dayMethods.pix += Number(s.totalValue);
          else if (s.paymentMethod === 'Dinheiro') dayMethods.money += Number(s.totalValue);
          else if (s.paymentMethod === 'Cartão') dayMethods.card += Number(s.totalValue);
          else if (s.paymentMethod === 'Fiado') dayMethods.fiado += Number(s.totalValue);
          else if (s.paymentMethod === 'Misto') {
              // Se for misto, buscamos o rateio real gravado nas finanças para esta venda
              const relatedFinances = dayFinances.filter(f => f.type === 'entry' && f.description?.includes(s.saleCode || ''));
              relatedFinances.forEach(f => {
                  if (f.description?.includes('via Pix')) dayMethods.pix += Number(f.value);
                  else if (f.description?.includes('via Dinheiro')) dayMethods.money += Number(f.value);
                  else if (f.description?.includes('via Cartão')) dayMethods.card += Number(f.value);
              });
          }
      });

      const dayOut = dayFinances.filter(f => f.type === 'exit').reduce((a, b) => a + Number(b.value), 0);

      // 4. Estatísticas Mensais (Mantendo via Finanças para consistência contábil)
      const monthFinances = (finances ?? []).filter(f => f.date?.startsWith(periodKey) && f.storeId === effectiveStoreId);
      const monthIn = monthFinances.filter(f => f.type === 'entry').reduce((a, b) => a + Number(b.value), 0);
      const monthOut = monthFinances.filter(f => f.type === 'exit').reduce((a, b) => a + Number(b.value), 0);
      const profit = monthIn - monthOut;

      const getMethodTotalMonth = (list: IceCreamTransaction[], method: string) => 
        list.filter(f => f.type === 'entry' && f.description?.toLowerCase().includes(`via ${method.toLowerCase()}`)).reduce((a, b) => a + Number(b.value), 0);

      const monthMethods = {
          pix: getMethodTotalMonth(monthFinances, 'Pix'),
          money: getMethodTotalMonth(monthFinances, 'Dinheiro'),
          card: getMethodTotalMonth(monthFinances, 'Cartão'),
          fiado: getMethodTotalMonth(monthFinances, 'Fiado')
      };

      return {
          dayIn, 
          dayOut, 
          dayMethods, 
          daySales: daySales.sort((a,b) => (b.createdAt || '').localeCompare(a.createdAt || '')),
          monthMethods, monthIn, monthOut, profit,
      };
  }, [sales, finances, todayKey, periodKey, effectiveStoreId]);

  const groupedAuditSales = useMemo(() => {
      const filtered = (sales ?? []).filter(s => {
          if (s.storeId !== effectiveStoreId) return false;
          if (!s.createdAt) return false;
          const sDate = new Date(s.createdAt);
          const matchDay = auditDay === '' || auditDay === sDate.getDate().toString();
          const matchMonth = auditMonth === '' || auditMonth === (sDate.getMonth() + 1).toString();
          const matchYear = auditYear === '' || auditYear === sDate.getFullYear().toString();
          const matchSearch = auditSearch === '' || 
              s.productName.toLowerCase().includes(auditSearch.toLowerCase()) || 
              s.saleCode?.toLowerCase().includes(auditSearch.toLowerCase()) ||
              s.buyer_name?.toLowerCase().includes(auditSearch.toLowerCase());
          return matchDay && matchMonth && matchYear && matchSearch;
      });

      const groups: Record<string, any> = {};

      filtered.forEach(s => {
          const code = s.saleCode || 'GEL-000';
          if (!groups[code]) {
              const relatedFinances = (finances ?? []).filter(f => f.storeId === effectiveStoreId && f.description?.includes(code));
              const methodsSet = new Set<string>();
              relatedFinances.forEach(f => {
                  const mMatch = f.description?.match(/via (.*?) -/);
                  if (mMatch) methodsSet.add(mMatch[1]);
              });
              if (methodsSet.size === 0) methodsSet.add(s.paymentMethod);

              groups[code] = {
                  saleCode: code,
                  createdAt: s.createdAt || '',
                  paymentMethods: Array.from(methodsSet),
                  buyer_name: s.buyer_name,
                  status: s.status || 'active',
                  totalValue: 0,
                  items: {}
              };
          }
          const itemKey = `${s.itemId}-${s.flavor}`;
          if (!groups[code].items[itemKey]) {
              groups[code].items[itemKey] = { productName: s.productName, unitsSold: 1, flavor: s.flavor };
              groups[code].totalValue += s.totalValue;
          }
      });

      return Object.values(groups).sort((a: any, b: any) => b.createdAt.localeCompare(a.createdAt));
  }, [sales, effectiveStoreId, auditDay, auditMonth, auditYear, auditSearch, finances]);

  const handleAddToCart = (item: IceCreamItem) => {
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
  };

  const finalizeSale = async () => {
      if (cart.length === 0 || !paymentMethod) return;
      const isMisto = paymentMethod === 'Misto';
      const splitData = isMisto ? Object.entries(mistoValues).map(([method, val]) => ({
          method: method as IceCreamPaymentMethod,
          amount: parseFloat((val as string).replace(',', '.')) || 0
      })).filter(p => p.amount > 0) : [{ method: paymentMethod as IceCreamPaymentMethod, amount: cartTotal }];

      if (isMisto && Math.abs(splitData.reduce((a, b) => a + b.amount, 0) - cartTotal) > 0.05) { alert("Total divergente."); return; }

      setIsSubmitting(true);
      const saleCode = `GEL-${Date.now().toString().slice(-6)}`;
      
      try {
          const operationalSales = cart.map(item => ({
              ...item,
              paymentMethod: (isMisto ? 'Misto' : paymentMethod) as IceCreamPaymentMethod,
              buyer_name: (paymentMethod === 'Fiado' || (isMisto && mistoValues['Fiado'])) ? buyerName.toUpperCase() : undefined,
              saleCode,
              unitsSold: Math.round(item.unitsSold),
              status: 'active' as const
          }));

          const financialPromises = splitData.map(payment => 
              onAddTransaction({
                  id: '0',
                  storeId: effectiveStoreId,
                  date: new Date().toISOString().split('T')[0],
                  type: 'entry',
                  category: 'RECEITA DE VENDA PDV',
                  value: payment.amount,
                  description: `Pagamento via ${payment.method} - Ref. ${saleCode}`,
                  createdAt: new Date()
              })
          );

          await Promise.all([
              onAddSales(operationalSales),
              ...financialPromises
          ]);

          for (const c of cart) {
              const itemDef = items.find(it => it.id === c.itemId);
              if (itemDef?.recipe) {
                  for (const ingredient of itemDef.recipe) {
                      await onUpdateStock(effectiveStoreId, ingredient.stock_base_name, -(ingredient.quantity * c.unitsSold), '', 'adjustment');
                  }
              }
          }

          setCart([]); setPaymentMethod(null); setBuyerName(''); setAmountReceived(''); setMistoValues({ 'Pix': '', 'Dinheiro': '', 'Cartão': '' });
          alert("Venda realizada!");
      } catch (e) { alert("Falha ao registrar."); } finally { setIsSubmitting(false); }
  };

  const handleCancelSale = async () => {
      if (!showCancelModal) return;
      setIsSubmitting(true);
      try {
          await onCancelSale(showCancelModal.code, cancelReason);
          setShowCancelModal(null); setCancelReason('');
          alert("Estorno realizado!");
      } catch (e) { alert("Erro ao estornar."); } finally { setIsSubmitting(false); }
  };

  const handleSaveTransaction = async () => {
    if (!txForm.value || !txForm.description) return;
    setIsSubmitting(true);
    try {
        await onAddTransaction({
            id: '0',
            storeId: effectiveStoreId,
            date: txForm.date,
            type: 'exit',
            category: txForm.category,
            value: parseFloat(txForm.value.replace(',', '.')),
            description: txForm.description,
            createdAt: new Date()
        });
        setShowTransactionModal(false);
        setTxForm({ date: new Date().toLocaleDateString('en-CA'), category: 'Despesa Operacional', value: '', description: '' });
        alert("Lançamento efetuado!");
    } catch (e) { alert("Erro ao registrar."); } finally { setIsSubmitting(false); }
  };

  const handleSaveSupplies = async () => {
      if (!newInsumo.name || !newInsumo.initial) return;
      setIsSubmitting(true);
      try {
          await onUpdateStock(effectiveStoreId, newInsumo.name.toUpperCase(), parseFloat(newInsumo.initial.replace(',', '.')), newInsumo.unit, 'adjustment');
          setNewInsumo({ name: '', unit: 'un', initial: '' });
          setShowNewInsumoModal(false);
          alert("Insumo cadastrado!");
      } catch (e) { alert("Erro ao salvar insumo."); } finally { setIsSubmitting(false); }
  };

  const handleSavePurchase = async () => {
      setIsSubmitting(true);
      try {
          for (const [stockId, valueStr] of Object.entries(purchaseForm)) {
              // Fix: Added string cast to valueStr to ensure 'replace' method is available (fixes unknown type error)
              const val = parseFloat((valueStr as string).replace(',', '.'));
              const stockItem = stock.find(s => s.id === stockId);
              if (!isNaN(val) && val > 0 && stockItem) {
                  await onUpdateStock(effectiveStoreId, stockItem.product_base, val, stockItem.unit, 'purchase');
              }
          }
          setPurchaseForm({});
          setShowPurchaseModal(false);
          alert("Compras lançadas!");
      } catch (e) { alert("Erro ao salvar compras."); } finally { setIsSubmitting(false); }
  };

  const handleSaveInventory = async () => {
      setIsSubmitting(true);
      try {
          for (const [stockId, valueStr] of Object.entries(inventoryForm)) {
              // Fix: Added string cast to valueStr to ensure 'replace' method is available (fixes unknown type error)
              const newVal = parseFloat((valueStr as string).replace(',', '.'));
              const stockItem = stock.find(s => s.id === stockId);
              if (!isNaN(newVal) && stockItem) {
                  const diff = newVal - stockItem.stock_current;
                  if (diff !== 0) {
                      await onUpdateStock(effectiveStoreId, stockItem.product_base, diff, stockItem.unit, 'adjustment');
                  }
              }
          }
          setInventoryForm({});
          setShowInventoryModal(false);
          alert("Inventário atualizado!");
      } catch (e) { alert("Erro ao salvar inventário."); } finally { setIsSubmitting(false); }
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
                            <select value={effectiveStoreId} onChange={(e) => setManualStoreId(e.target.value)} className="bg-transparent border-none text-[8px] font-black text-blue-600 uppercase outline-none cursor-pointer focus:ring-0 p-0 h-auto min-h-0">
                                {[...stores].sort((a, b) => parseInt(a.number || '0') - parseInt(b.number || '0')).map(s => <option key={s.id} value={s.id}>{s.number} - {s.city}</option>)}
                            </select>
                        ) : <span className="text-[8px] font-black text-blue-600 uppercase">{stores.find(s => s.id === effectiveStoreId)?.number} - {stores.find(s => s.id === effectiveStoreId)?.city}</span>}
                    </div>
                </div>
            </div>
            <div className="flex bg-gray-100 p-0.5 rounded-xl overflow-x-auto no-scrollbar w-full md:w-auto max-w-full">
                <button onClick={() => setActiveTab('pdv')} className={`flex-1 md:flex-none px-3 py-2 rounded-lg text-[8px] md:text-[9px] font-black uppercase transition-all flex items-center justify-center gap-1.5 whitespace-nowrap ${activeTab === 'pdv' ? 'bg-white text-blue-700 shadow-md' : 'text-gray-500'}`}><ShoppingCart size={12}/> PDV</button>
                <button onClick={() => setActiveTab('estoque')} className={`flex-1 md:flex-none px-3 py-2 rounded-lg text-[8px] md:text-[9px] font-black uppercase transition-all flex items-center justify-center gap-1.5 whitespace-nowrap ${activeTab === 'estoque' ? 'bg-white text-blue-700 shadow-md' : 'text-gray-500'}`}><Package size={12}/> Estoque</button>
                {can('MODULE_GELATERIA_DRE_DIARIO') && <button onClick={() => setActiveTab('dre_diario')} className={`flex-1 md:flex-none px-3 py-2 rounded-lg text-[8px] md:text-[9px] font-black uppercase transition-all flex items-center justify-center gap-1.5 whitespace-nowrap ${activeTab === 'dre_diario' ? 'bg-white text-blue-700 shadow-md' : 'text-gray-500'}`}><Clock size={12}/> DRE Diário</button>}
                {can('MODULE_GELATERIA_DRE_MENSAL') && <button onClick={() => setActiveTab('dre_mensal')} className={`flex-1 md:flex-none px-3 py-2 rounded-lg text-[8px] md:text-[9px] font-black uppercase transition-all flex items-center justify-center gap-1.5 whitespace-nowrap ${activeTab === 'dre_mensal' ? 'bg-white text-purple-700 shadow-sm' : 'text-gray-400'}`}><FileBarChart size={12}/> DRE Mensal</button>}
                <button onClick={() => setActiveTab('audit')} className={`flex-1 md:flex-none px-3 py-2 rounded-lg text-[8px] md:text-[9px] font-black uppercase transition-all flex items-center justify-center gap-1.5 whitespace-nowrap ${activeTab === 'audit' ? 'bg-white text-blue-700 shadow-md' : 'text-gray-500'}`}><History size={12}/> Auditoria</button>
                {can('MODULE_GELATERIA_CONFIG') && <button onClick={() => setActiveTab('produtos')} className={`flex-1 md:flex-none px-3 py-2 rounded-lg text-[8px] md:text-[9px] font-black uppercase transition-all flex items-center justify-center gap-1.5 whitespace-nowrap ${activeTab === 'produtos' ? 'bg-white text-blue-700 shadow-md' : 'text-gray-500'}`}><PackagePlus size={12}/> Produtos</button>}
            </div>
        </div>

        <div className="flex-1 overflow-y-auto no-scrollbar relative">
            {activeTab === 'pdv' && (
                <div className="h-full">
                    <div className="lg:hidden h-full"><PDVMobileView user={user} items={filteredItems} cart={cart} setCart={setCart} selectedCategory={selectedCategory} setSelectedCategory={setSelectedCategory} selectedProductName={null} setSelectedProductName={() => {}} selectedItem={null} setSelectedItem={() => {}} selectedMl="" setSelectedMl={() => {}} quantity={1} setQuantity={() => {}} paymentMethod={paymentMethod} setPaymentMethod={setPaymentMethod} buyerName={buyerName} setBuyerName={setBuyerName} mistoValues={mistoValues} setMistoValues={setMistoValues} onAddSales={onAddSales} onCancelSale={async (code) => { await onCancelSale(code); }} onAddTransaction={onAddTransaction} onUpdateStock={onUpdateStock} dailyData={dreStats} handlePrintTicket={() => {}} isSubmitting={isSubmitting} setIsSubmitting={setIsSubmitting} effectiveStoreId={effectiveStoreId} /></div>
                    <div className="hidden lg:grid grid-cols-12 gap-4 p-6 max-w-[1500px] mx-auto h-full overflow-hidden">
                        <div className="col-span-8 flex flex-col h-full overflow-hidden">
                            <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-3">
                                <button onClick={() => setSelectedCategory(null)} className={`px-5 py-2 rounded-xl font-black uppercase text-[10px] border-2 transition-all ${!selectedCategory ? 'bg-blue-900 text-white border-blue-900 shadow-lg' : 'bg-white text-gray-400 border-gray-100'}`}>Tudo</button>
                                {PRODUCT_CATEGORIES.map(cat => <button key={cat} onClick={() => setSelectedCategory(cat)} className={`px-5 py-2 rounded-xl font-black uppercase text-[10px] border-2 transition-all whitespace-nowrap ${selectedCategory === cat ? 'bg-blue-900 text-white border-blue-900 shadow-lg' : 'bg-white text-gray-400 border-gray-100'}`}>{cat}</button>)}
                            </div>
                            <div className="grid grid-cols-3 xl:grid-cols-4 gap-4 overflow-y-auto no-scrollbar pr-2 pb-10">
                                {filteredItems.filter(i => (!selectedCategory || i.category === selectedCategory) && i.active).map(item => (
                                    <button key={item.id} onClick={() => handleAddToCart(item)} className="bg-white p-4 rounded-[32px] border-2 border-gray-100 hover:border-blue-600 transition-all flex flex-col items-center text-center group shadow-sm">
                                        <div className="w-full aspect-square bg-gray-50 rounded-[24px] mb-3 flex items-center justify-center overflow-hidden"><img src={item.image_url || getCategoryImage(item.category, item.name)} className="w-full h-full object-cover p-2" /></div>
                                        <h4 className="font-black text-gray-900 uppercase text-[10px] truncate w-full mb-1">{item.name}</h4>
                                        <p className="text-lg font-black text-blue-900 italic leading-none">{formatCurrency(item.price)}</p>
                                    </button>
                                ))}
                            </div>
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
                                    {['Pix', 'Dinheiro', 'Cartão', 'Fiado', 'Misto'].map(m => <button key={m} onClick={() => { setPaymentMethod(m as any); if(m !== 'Dinheiro' && m !== 'Misto') setAmountReceived(''); }} className={`py-3 rounded-xl font-black uppercase text-[10px] border-2 transition-all ${paymentMethod === m ? 'bg-blue-900 text-white border-blue-900 shadow-xl' : 'bg-white border-gray-200 text-gray-400'}`}>{m}</button>)}
                                </div>
                                {paymentMethod === 'Dinheiro' && (
                                    <div className="bg-green-50 p-4 rounded-2xl border-2 border-green-200 space-y-3">
                                        <div className="flex justify-between items-center"><label className="text-[10px] font-black text-green-700 uppercase">Valor Recebido</label><input value={amountReceived} onChange={e => setAmountReceived(e.target.value)} placeholder="0,00" className="w-32 text-right bg-white border-none rounded-xl p-3 font-black text-green-700 outline-none text-lg shadow-inner" /></div>
                                        <div className="flex justify-between items-baseline border-t border-green-100 pt-2"><span className="text-[10px] font-black text-green-600 uppercase">Troco</span><span className="text-2xl font-black text-green-700 italic">{formatCurrency(changeDue)}</span></div>
                                    </div>
                                )}
                                {paymentMethod === 'Misto' && (
                                    <div className="bg-blue-50 p-4 rounded-2xl border-2 border-blue-200 space-y-2">
                                        {['Pix', 'Dinheiro', 'Cartão'].map(m => <div key={m} className="flex justify-between items-center bg-white px-3 py-2 rounded-lg border border-blue-50"><label className="text-[10px] font-black text-gray-500 uppercase">{m}</label><input value={mistoValues[m]} onChange={e => setMistoValues({...mistoValues, [m]: e.target.value})} placeholder="0,00" className="w-20 text-right font-black text-blue-900 text-xs outline-none bg-transparent" /></div>)}
                                    </div>
                                )}
                                {(paymentMethod === 'Fiado' || (paymentMethod === 'Misto' && mistoValues['Fiado'])) && <input value={buyerName} onChange={e => setBuyerName(e.target.value.toUpperCase())} className="w-full p-4 bg-red-50 border-2 border-red-100 rounded-2xl font-black uppercase text-sm outline-none" placeholder="NOME DO FUNCIONÁRIO..." />}
                                <button onClick={finalizeSale} disabled={isSubmitting || cart.length === 0 || !paymentMethod} className="w-full py-5 bg-red-600 hover:bg-red-700 text-white rounded-[24px] font-black uppercase text-xs shadow-2xl flex items-center justify-center gap-3 transition-all border-b-4 border-red-900">{isSubmitting ? <Loader2 className="animate-spin" /> : <CheckCircle2 size={18}/>} Finalizar Venda</button>
                            </div>
                        </div>
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
                            <thead className="bg-gray-50 text-[9px] font-black text-gray-400 uppercase border-b"><tr><th className="px-8 py-5">Cod / Data</th><th className="px-8 py-5">Produtos</th><th className="px-8 py-5">Pagamento</th><th className="px-8 py-5 text-right">Total</th><th className="px-8 py-5 text-center">Ações</th></tr></thead>
                            <tbody className="divide-y divide-gray-50 font-bold text-[10px]">
                                {groupedAuditSales.map((saleGroup: any) => (
                                    <tr key={saleGroup.saleCode} className={`hover:bg-blue-50/30 transition-all ${saleGroup.status === 'canceled' ? 'opacity-50 grayscale italic line-through' : ''}`}>
                                        <td className="px-8 py-5"><div className="text-xs font-black text-blue-950">#{saleGroup.saleCode}</div><div className="text-[8px] text-gray-400 uppercase mt-0.5">{new Date(saleGroup.createdAt).toLocaleString('pt-BR')}</div></td>
                                        <td className="px-8 py-5">{Object.values(saleGroup.items).map((item: any, idx: number) => <div key={idx} className="mb-1 last:mb-0"><div className="text-[10px] font-black text-gray-900 uppercase italic tracking-tighter">{item.unitsSold}x {item.productName}</div></div>)}</td>
                                        <td className="px-8 py-5"><div className="flex flex-wrap gap-1">{saleGroup.paymentMethods.map((pm: any, idx: number) => <span key={idx} className="px-2 py-0.5 rounded text-[8px] font-black uppercase border bg-green-50 text-green-700 border-green-100">{pm}</span>)}</div>{saleGroup.buyer_name && <div className="text-[8px] text-gray-400 uppercase mt-1 truncate">Comprador: {saleGroup.buyer_name}</div>}</td>
                                        <td className="px-8 py-5 text-right font-black text-sm">{formatCurrency(saleGroup.totalValue)}</td>
                                        <td className="px-8 py-5 text-center">{saleGroup.status === 'canceled' ? <span className="bg-red-100 text-red-700 px-3 py-1 rounded-full text-[8px] font-black uppercase border border-red-200">ESTORNADA</span> : <button onClick={() => setShowCancelModal({id: '0', code: saleGroup.saleCode})} className="p-2 text-gray-300 hover:text-red-600 transition-all"><Ban size={18}/></button>}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {activeTab === 'estoque' && (
                <div className="p-4 md:p-8 space-y-6 animate-in fade-in duration-300 max-w-6xl mx-auto pb-20">
                    <div className="bg-white p-8 rounded-[40px] shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between items-center gap-6">
                        <div className="flex items-center gap-4"><div className="p-4 bg-orange-50 text-orange-600 rounded-3xl"><Warehouse size={32}/></div><div><h3 className="text-2xl font-black uppercase italic text-blue-950 tracking-tighter">Controle de <span className="text-orange-600">Insumos</span></h3></div></div>
                        <div className="flex flex-wrap gap-2"><button onClick={() => setShowNewInsumoModal(true)} className="px-4 py-2 bg-gray-900 text-white rounded-xl font-black uppercase text-[9px] shadow-lg flex items-center gap-2 border-b-2 border-black active:scale-95"><Plus size={14}/> Novo Insumo</button><button onClick={() => { setPurchaseForm({}); setShowPurchaseModal(true); }} className="px-4 py-2 bg-blue-600 text-white rounded-xl font-black uppercase text-[9px] shadow-lg flex items-center gap-2 border-b-2 border-blue-900 active:scale-95"><Truck size={14}/> Lançar Compra</button><button onClick={() => { const initialInv: Record<string, string> = {}; filteredStock.forEach(s => initialInv[s.id] = s.stock_current.toString()); setInventoryForm(initialInv); setShowInventoryModal(true); }} className="px-4 py-2 bg-orange-600 text-white rounded-xl font-black uppercase text-[9px] shadow-lg flex items-center gap-2 border-b-2 border-orange-900 active:scale-95"><PencilLine size={14}/> Inventário</button></div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {filteredStock.map(st => <div key={st.id} className="bg-white p-6 rounded-[32px] shadow-sm border border-gray-100 relative group overflow-hidden"><div className={`p-2 rounded-xl text-white w-fit mb-4 ${st.stock_current <= 5 ? 'bg-red-500 animate-pulse' : 'bg-orange-500'}`}><Package size={16}/></div><h4 className="text-[10px] font-black text-blue-950 uppercase italic leading-none mb-2 truncate">{st.product_base}</h4><div className="flex items-baseline gap-1"><span className={`text-2xl font-black italic tracking-tighter ${st.stock_current <= 5 ? 'text-red-600' : 'text-gray-900'}`}>{st.stock_current}</span><span className="text-[8px] font-bold text-gray-400 uppercase tracking-widest">{st.unit}</span></div></div>)}
                    </div>
                </div>
            )}

            {activeTab === 'dre_diario' && (
                <div className="p-4 md:p-8 space-y-6 animate-in fade-in duration-300 max-w-5xl mx-auto pb-20">
                    <div className="bg-white p-8 rounded-[40px] shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between items-center gap-6">
                        <div className="flex items-center gap-4"><div className="p-4 bg-blue-50 text-blue-700 rounded-3xl"><Clock size={32}/></div><div><h3 className="text-2xl font-black uppercase italic text-blue-950 tracking-tighter">Fluxo de Caixa <span className="text-blue-700">Diário</span></h3><div className="flex bg-gray-100 p-1 rounded-lg mt-2"><button onClick={() => setDreSubTab('resumo')} className={`px-4 py-1.5 rounded-md text-[9px] font-black uppercase transition-all ${dreSubTab === 'resumo' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-400'}`}>Resumo</button><button onClick={() => setDreSubTab('detalhado')} className={`px-4 py-1.5 rounded-md text-[9px] font-black uppercase transition-all ${dreSubTab === 'detalhado' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-400'}`}>Detalhado</button></div></div></div>
                        <div className="flex flex-col items-end gap-2">
                             <button onClick={() => setShowTransactionModal(true)} className="px-6 py-2.5 bg-red-600 text-white rounded-xl font-black uppercase text-[10px] shadow-lg flex items-center gap-2 border-b-4 border-red-900 active:scale-95"><DollarSign size={14}/> Lançar Saída (Sangria)</button>
                             <div className="text-right"><p className="text-[9px] font-black text-gray-400 uppercase">Apuração</p><p className="text-lg font-black text-blue-950">{todayKey.split('-').reverse().join('/')}</p></div>
                        </div>
                    </div>
                    {dreSubTab === 'resumo' ? (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="bg-white p-6 rounded-[32px] border-2 border-green-100 shadow-sm space-y-4"><span className="text-[9px] font-black text-green-600 uppercase tracking-widest">Resumo Entradas (+)</span><div className="space-y-2">
                                <div className="flex justify-between items-center text-[10px] font-black border-b border-gray-50 pb-1"><span className="text-gray-400 uppercase">Pix</span><span className="text-gray-900">{formatCurrency(dreStats.dayMethods.pix)}</span></div>
                                <div className="flex justify-between items-center text-[10px] font-black border-b border-gray-50 pb-1"><span className="text-gray-400 uppercase">Dinheiro</span><span className="text-gray-900">{formatCurrency(dreStats.dayMethods.money)}</span></div>
                                <div className="flex justify-between items-center text-[10px] font-black border-b border-gray-50 pb-1"><span className="text-gray-400 uppercase">Cartão</span><span className="text-gray-900">{formatCurrency(dreStats.dayMethods.card)}</span></div>
                                <div className="flex justify-between items-center text-[10px] font-black border-b border-gray-50 pb-1"><span className="text-gray-400 uppercase">Fiado</span><span className="text-gray-900">{formatCurrency(dreStats.dayMethods.fiado)}</span></div>
                            </div><div className="pt-2 border-t-2 border-green-50"><p className="text-2xl font-black text-green-700 italic">{formatCurrency(dreStats.dayIn)}</p></div></div>
                            <div className="bg-white p-6 rounded-[32px] border-2 border-red-100 shadow-sm flex flex-col justify-between"><div><span className="text-[9px] font-black text-red-600 uppercase tracking-widest">Resumo Saídas (-)</span><p className="text-3xl font-black text-red-700 italic mt-4">{formatCurrency(dreStats.dayOut)}</p></div></div>
                            <div className="bg-gray-950 p-6 rounded-[32px] text-white shadow-xl flex flex-col justify-between"><div><span className="text-[9px] font-black text-blue-400 uppercase tracking-widest">Saldo Líquido</span><p className="text-3xl font-black italic mt-4">{formatCurrency(dreStats.dayIn - dreStats.dayOut)}</p></div></div>
                        </div>
                    ) : (
                        <div className="bg-white rounded-[40px] shadow-xl border border-gray-100 overflow-hidden"><table className="w-full text-left"><thead className="bg-gray-50 text-[9px] font-black text-gray-400 uppercase tracking-widest border-b"><tr><th className="px-6 py-4">Horário / Código</th><th className="px-6 py-4">Operação</th><th className="px-6 py-4 text-right">Valor</th></tr></thead><tbody className="divide-y divide-gray-50 font-bold text-[10px]">{dreStats.daySales.map(s => <tr key={s.id} className="hover:bg-green-50/20"><td className="px-6 py-3 text-gray-400">#{s.saleCode} <span className="block">{new Date(s.createdAt!).toLocaleTimeString()}</span></td><td className="px-6 py-3 uppercase text-gray-900">VENDA: {s.productName}</td><td className="px-6 py-3 text-right text-green-600">{formatCurrency(s.totalValue)}</td></tr>)}</tbody></table></div>
                    )}
                </div>
            )}

            {activeTab === 'dre_mensal' && (
                <div className="p-4 md:p-8 space-y-6 animate-in fade-in duration-300 max-w-6xl mx-auto pb-20">
                    <div className="bg-white p-8 rounded-[40px] shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between items-center gap-6">
                        <div className="flex items-center gap-4"><div className="p-4 bg-purple-50 text-purple-700 rounded-3xl"><FilePieChart size={32}/></div><div><h3 className="text-2xl font-black uppercase italic text-blue-950 tracking-tighter">DRE <span className="text-purple-700">Mensal</span></h3></div></div>
                        <div className="flex items-center gap-2 bg-gray-50 p-2 rounded-2xl border"><select value={selectedMonth} onChange={e => setSelectedMonth(Number(e.target.value))} className="bg-transparent border-none text-xs font-black uppercase outline-none">{MONTHS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}</select><select value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))} className="bg-transparent border-none text-xs font-black outline-none">{[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}</select></div>
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                        <div className="lg:col-span-8 space-y-6">
                            <div className="bg-white p-8 rounded-[40px] shadow-sm border border-gray-100"><h4 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-6 flex items-center gap-2"><Briefcase size={14}/> Demonstrativo de Resultado</h4><div className="space-y-4">
                                <div className="flex justify-between items-center pb-4 border-b"><span className="font-bold text-gray-600 uppercase text-xs">Faturamento (+)</span><span className="font-black text-green-600 text-lg">{formatCurrency(dreStats.monthIn)}</span></div>
                                <div className="flex justify-between items-center pb-4 border-b"><span className="font-bold text-gray-600 uppercase text-xs">Saídas (-)</span><span className="font-black text-red-600 text-lg">{formatCurrency(dreStats.monthOut)}</span></div>
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
                            <h4 className="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em] mb-6 flex items-center gap-2"><UsersIcon size={16}/> Partilha de Lucros</h4>
                            <div className="space-y-4">{partners.map(p => <div key={p.id} className="border-b border-white/5 pb-4 last:border-0"><div className="flex justify-between items-baseline mb-1"><span className="text-[10px] font-black uppercase italic tracking-tighter">{p.partner_name}</span><span className="text-[9px] font-bold text-blue-400">{p.percentage}%</span></div><p className="text-xl font-black italic tracking-tighter text-blue-100">{formatCurrency((dreStats.profit * p.percentage) / 100)}</p></div>)}</div>
                            {partners.length === 0 && <p className="text-[9px] text-gray-600 uppercase text-center py-10 italic">Nenhuma partilha configurada</p>}
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'produtos' && (
                <div className="p-4 md:p-8 space-y-6 animate-in fade-in duration-300 max-w-6xl mx-auto pb-20">
                    <div className="bg-white p-8 rounded-[40px] shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between items-center gap-6">
                        <div className="flex items-center gap-4"><div className="p-4 bg-orange-50 text-orange-600 rounded-3xl"><PackagePlus size={32}/></div><div><h3 className="text-2xl font-black uppercase italic text-blue-950 tracking-tighter">Gestão de <span className="text-orange-600">Cardápio</span></h3></div></div>
                        <button onClick={() => { setEditingProduct(null); setNewProd({name: '', category: 'Copinho', price: '', flavor: ''}); setTempRecipe([]); setShowProductModal(true); }} className="px-8 py-3 bg-orange-600 text-white rounded-2xl font-black uppercase text-[10px] shadow-lg border-b-4 border-orange-900 flex items-center gap-2"><Plus size={16}/> Novo Item</button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {filteredItems.map(item => <div key={item.id} className="bg-white p-6 rounded-[32px] shadow-sm border border-gray-100 flex flex-col group hover:border-blue-600 transition-all"><div className="w-full aspect-square bg-gray-50 rounded-[24px] mb-4 overflow-hidden flex items-center justify-center"><img src={item.image_url || getCategoryImage(item.category, item.name)} className="w-full h-full object-cover p-2" /></div><h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">{item.category}</h4><p className="font-black text-blue-950 uppercase italic text-xs mb-1">{item.name}</p><div className="flex justify-between items-baseline mt-auto"><span className="text-xl font-black text-blue-900 italic">{formatCurrency(item.price)}</span><div className="flex gap-1"><button onClick={() => { setEditingProduct(item); setNewProd({name: item.name, category: item.category, price: item.price.toString().replace('.', ','), flavor: item.flavor || ''}); setTempRecipe(item.recipe || []); setShowProductModal(true); }} className="p-2 bg-gray-50 text-gray-400 hover:text-blue-600 rounded-xl transition-all"><Edit3 size={14}/></button><button onClick={async () => { if(window.confirm("Excluir?")) { await onDeleteItem(item.id); alert("Removido"); } }} className="p-2 bg-gray-50 text-gray-400 hover:text-red-600 rounded-xl transition-all"><Trash2 size={14}/></button></div></div></div>)}
                    </div>
                </div>
            )}
        </div>

        {/* MODAL DE PRODUTO / CARDÁPIO */}
        {showProductModal && (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[130] p-4">
                <div className="bg-white rounded-[40px] w-full max-w-2xl max-h-[90vh] shadow-2xl animate-in zoom-in duration-300 overflow-hidden flex flex-col">
                    <div className="p-8 border-b flex justify-between items-center bg-gray-50/50">
                        <h3 className="text-xl font-black uppercase italic text-blue-950 flex items-center gap-3"><Plus className="text-orange-600" /> {editingProduct ? 'Editar' : 'Novo'} <span className="text-orange-600">Produto</span></h3>
                        <button onClick={() => setShowProductModal(false)} className="text-gray-400 hover:text-red-600"><X size={24}/></button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-10 space-y-8 no-scrollbar">
                        <div className="grid grid-cols-2 gap-6">
                            <div className="space-y-2"><label className="text-[10px] font-black text-gray-400 uppercase ml-2">Nome do Produto</label><input value={newProd.name} onChange={e => setNewProd({...newProd, name: e.target.value})} className="w-full p-4 bg-gray-50 rounded-2xl font-black uppercase italic outline-none shadow-inner" placeholder="EX: MILKSHAKE GRANDE" /></div>
                            <div className="space-y-2"><label className="text-[10px] font-black text-gray-400 uppercase ml-2">Categoria</label><select value={newProd.category} onChange={e => setNewProd({...newProd, category: e.target.value as any})} className="w-full p-4 bg-gray-50 rounded-2xl font-black outline-none shadow-inner">{PRODUCT_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
                        </div>
                        <div className="grid grid-cols-2 gap-6">
                            <div className="space-y-2"><label className="text-[10px] font-black text-gray-400 uppercase ml-2">Preço de Venda (R$)</label><input value={newProd.price} onChange={e => setNewProd({...newProd, price: e.target.value})} className="w-full p-4 bg-gray-50 rounded-2xl font-black text-blue-900 shadow-inner outline-none" placeholder="0,00" /></div>
                            <div className="space-y-2"><label className="text-[10px] font-black text-gray-400 uppercase ml-2">Sabor Padrão</label><input value={newProd.flavor} onChange={e => setNewProd({...newProd, flavor: e.target.value})} className="w-full p-4 bg-gray-50 rounded-2xl font-black uppercase shadow-inner outline-none" placeholder="OPCIONAL" /></div>
                        </div>

                        <div className="pt-6 border-t">
                            <h4 className="text-xs font-black text-blue-900 uppercase italic mb-4 flex items-center gap-2"><Beaker size={14}/> Engenharia de Receita (Baixa de Estoque)</h4>
                            <div className="bg-gray-50 p-6 rounded-[32px] border space-y-4">
                                <div className="flex gap-2">
                                    <select value={newRecipeItem.stock_base_name} onChange={e => setNewRecipeItem({...newRecipeItem, stock_base_name: e.target.value})} className="flex-1 p-4 bg-white rounded-2xl font-black uppercase text-[10px] outline-none border-none shadow-sm"><option value="">SELECIONE INSUMO...</option>{filteredStock.map(s => <option key={s.id} value={s.product_base}>{s.product_base}</option>)}</select>
                                    <input value={newRecipeItem.quantity} onChange={e => setNewRecipeItem({...newRecipeItem, quantity: e.target.value})} className="w-24 p-4 bg-white rounded-2xl font-black text-center outline-none border-none shadow-sm" placeholder="QTD" />
                                    <button onClick={() => { if(!newRecipeItem.stock_base_name) return; setTempRecipe([...tempRecipe, { stock_base_name: newRecipeItem.stock_base_name, quantity: parseFloat(newRecipeItem.quantity.replace(',', '.')) || 0 }]); setNewRecipeItem({stock_base_name: '', quantity: '1'}); }} className="p-4 bg-blue-900 text-white rounded-2xl shadow-lg active:scale-95"><Plus size={20}/></button>
                                </div>
                                <div className="space-y-2 max-h-40 overflow-y-auto no-scrollbar">
                                    {tempRecipe.map((ri, idx) => <div key={idx} className="flex justify-between items-center bg-white p-3 rounded-xl border border-gray-100 shadow-sm"><span className="text-[10px] font-black uppercase">{ri.stock_base_name}</span><div className="flex items-center gap-4"><span className="text-[10px] font-black text-blue-600">{ri.quantity} un/g</span><button onClick={() => setTempRecipe(tempRecipe.filter((_, i) => i !== idx))} className="text-red-300 hover:text-red-600"><Trash2 size={14}/></button></div></div>)}
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="p-8 bg-gray-50 border-t flex justify-center">
                        <button onClick={async () => {
                            const val = parseFloat(newProd.price.replace(',', '.')) || 0;
                            await onSaveProduct({ ...editingProduct, storeId: effectiveStoreId, name: newProd.name, category: newProd.category, price: val, flavor: newProd.flavor, recipe: tempRecipe });
                            setShowProductModal(false);
                            alert("Produto salvo!");
                        }} disabled={isSubmitting} className="w-full max-w-sm py-5 bg-orange-600 text-white rounded-[28px] font-black uppercase text-xs shadow-xl transition-all border-b-4 border-orange-900 flex items-center justify-center gap-3">{isSubmitting ? <Loader2 className="animate-spin" /> : <Save size={18}/>} CONFIRMAR PRODUTO</button>
                    </div>
                </div>
            </div>
        )}

        {/* MODAL NOVO INSUMO */}
        {showNewInsumoModal && (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[130] p-4">
                <div className="bg-white rounded-[40px] w-full max-w-md shadow-2xl animate-in zoom-in duration-300 overflow-hidden border-t-8 border-gray-900">
                    <div className="p-8 border-b bg-gray-50/50 flex justify-between items-center">
                        <h3 className="text-xl font-black uppercase italic text-blue-950 flex items-center gap-3"><Package className="text-blue-900" /> Novo <span className="text-blue-900">Insumo</span></h3>
                        <button onClick={() => setShowNewInsumoModal(false)} className="text-gray-400 hover:text-red-600"><X size={24}/></button>
                    </div>
                    <div className="p-10 space-y-6">
                        <div className="space-y-2"><label className="text-[10px] font-black text-gray-400 uppercase ml-2 tracking-widest">Nome do Material</label><input value={newInsumo.name} onChange={e => setNewInsumo({...newInsumo, name: e.target.value.toUpperCase()})} className="w-full p-4 bg-gray-50 rounded-2xl font-black text-gray-900 uppercase shadow-inner outline-none" placeholder="EX: LEITE CONDENSADO" /></div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2"><label className="text-[10px] font-black text-gray-400 uppercase ml-2 tracking-widest">Unidade</label><select value={newInsumo.unit} onChange={e => setNewInsumo({...newInsumo, unit: e.target.value})} className="w-full p-4 bg-gray-50 rounded-2xl font-black outline-none border-none shadow-inner"><option value="un">un</option><option value="kg">kg</option><option value="l">litros</option><option value="g">gramas</option></select></div>
                            <div className="space-y-2"><label className="text-[10px] font-black text-gray-400 uppercase ml-2 tracking-widest">Saldo Inicial</label><input value={newInsumo.initial} onChange={e => setNewInsumo({...newInsumo, initial: e.target.value})} className="w-full p-4 bg-gray-50 rounded-2xl font-black text-center shadow-inner outline-none" placeholder="0" /></div>
                        </div>
                        <button onClick={handleSaveSupplies} disabled={isSubmitting} className="w-full py-5 bg-gray-950 text-white rounded-[28px] font-black uppercase text-xs shadow-xl active:scale-95 transition-all border-b-4 border-gray-700 flex items-center justify-center gap-3">{isSubmitting ? <Loader2 className="animate-spin" /> : <Save size={18}/>} CADASTRAR NO ESTOQUE</button>
                    </div>
                </div>
            </div>
        )}

        {/* MODAL LANÇAR COMPRA */}
        {showPurchaseModal && (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[130] p-4">
                <div className="bg-white rounded-[40px] w-full max-w-xl shadow-2xl animate-in zoom-in duration-300 overflow-hidden border-t-8 border-blue-600 max-h-[90vh] flex flex-col">
                    <div className="p-8 border-b bg-gray-50/50 flex justify-between items-center shrink-0">
                        <h3 className="text-xl font-black uppercase italic text-blue-950 flex items-center gap-3"><Truck className="text-blue-600" /> Lançar <span className="text-blue-600">Compra / Entrada</span></h3>
                        <button onClick={() => setShowPurchaseModal(false)} className="text-gray-400 hover:text-red-600"><X size={24}/></button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-8 space-y-4 no-scrollbar">
                        {filteredStock.map(st => (
                            <div key={st.id} className="flex items-center gap-4 bg-gray-50 p-4 rounded-2xl border border-gray-100 group hover:border-blue-200 transition-all">
                                <div className="flex-1"><p className="text-[10px] font-black text-gray-900 uppercase">{st.product_base}</p><p className="text-[8px] text-gray-400 font-bold uppercase">Saldo Atual: {st.stock_current} {st.unit}</p></div>
                                <div className="w-32 relative"><input value={purchaseForm[st.id] || ''} onChange={e => setPurchaseForm({...purchaseForm, [st.id]: e.target.value})} className="w-full p-3 bg-white rounded-xl font-black text-blue-600 text-center shadow-sm border-none outline-none" placeholder="0" /><span className="absolute right-3 top-1/2 -translate-y-1/2 text-[8px] font-black text-gray-300 uppercase">{st.unit}</span></div>
                            </div>
                        ))}
                    </div>
                    <div className="p-8 bg-gray-50 border-t shrink-0">
                        <button onClick={handleSavePurchase} disabled={isSubmitting} className="w-full py-5 bg-blue-600 text-white rounded-[28px] font-black uppercase text-xs shadow-xl active:scale-95 transition-all border-b-4 border-blue-900 flex items-center justify-center gap-3">{isSubmitting ? <Loader2 className="animate-spin" /> : <Save size={18}/>} EFETIVAR COMPRAS</button>
                    </div>
                </div>
            </div>
        )}

        {/* MODAL INVENTÁRIO */}
        {showInventoryModal && (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[130] p-4">
                <div className="bg-white rounded-[40px] w-full max-w-xl shadow-2xl animate-in zoom-in duration-300 overflow-hidden border-t-8 border-orange-600 max-h-[90vh] flex flex-col">
                    <div className="p-8 border-b bg-gray-50/50 flex justify-between items-center shrink-0">
                        <h3 className="text-xl font-black uppercase italic text-blue-950 flex items-center gap-3"><PencilLine className="text-orange-600" /> Ajustar <span className="text-orange-600">Inventário</span></h3>
                        <button onClick={() => setShowInventoryModal(false)} className="text-gray-400 hover:text-red-600"><X size={24}/></button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-8 space-y-4 no-scrollbar">
                        {filteredStock.map(st => (
                            <div key={st.id} className="flex items-center gap-4 bg-gray-50 p-4 rounded-2xl border border-gray-100 group hover:border-orange-200 transition-all">
                                <div className="flex-1"><p className="text-[10px] font-black text-gray-900 uppercase">{st.product_base}</p><p className="text-[8px] text-gray-400 font-bold uppercase">Sistema: {st.stock_current} {st.unit}</p></div>
                                <div className="w-32 relative"><input value={inventoryForm[st.id] || ''} onChange={e => setInventoryForm({...inventoryForm, [st.id]: e.target.value})} className="w-full p-3 bg-white rounded-xl font-black text-orange-600 text-center shadow-sm border-none outline-none" placeholder="0" /><span className="absolute right-3 top-1/2 -translate-y-1/2 text-[8px] font-black text-gray-300 uppercase">{st.unit}</span></div>
                            </div>
                        ))}
                    </div>
                    <div className="p-8 bg-gray-50 border-t shrink-0">
                        <button onClick={handleSaveInventory} disabled={isSubmitting} className="w-full py-5 bg-orange-600 text-white rounded-[28px] font-black uppercase text-xs shadow-xl active:scale-95 transition-all border-b-4 border-orange-900 flex items-center justify-center gap-3">{isSubmitting ? <Loader2 className="animate-spin" /> : <Save size={18}/>} ATUALIZAR ESTOQUE REAL</button>
                    </div>
                </div>
            </div>
        )}

        {/* MODAL TRANSAÇÃO (SANGRIAS) */}
        {showTransactionModal && (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[130] p-4">
                <div className="bg-white rounded-[40px] w-full max-w-md shadow-2xl animate-in zoom-in duration-300 border-t-8 border-red-600 overflow-hidden">
                    <div className="p-8 border-b bg-gray-50/50 flex justify-between items-center"><h3 className="text-xl font-black uppercase italic text-blue-950 flex items-center gap-3"><DollarSign className="text-red-600" /> Registrar <span className="text-red-600">Despesa</span></h3><button onClick={() => setShowTransactionModal(false)} className="text-gray-400 hover:text-red-600"><X size={24}/></button></div>
                    <div className="p-10 space-y-6">
                        <div className="space-y-2"><label className="text-[10px] font-black text-gray-400 uppercase ml-2 tracking-widest">Valor (R$)</label><input value={txForm.value} onChange={e => setTxForm({...txForm, value: e.target.value})} className="w-full p-5 bg-red-50 rounded-[24px] font-black text-red-700 text-2xl shadow-inner outline-none border-none text-center" placeholder="0,00" /></div>
                        <div className="space-y-2"><label className="text-[10px] font-black text-gray-400 uppercase ml-2 tracking-widest">Descrição / Motivo</label><input value={txForm.description} onChange={e => setTxForm({...txForm, description: e.target.value.toUpperCase()})} className="w-full p-4 bg-gray-50 rounded-2xl font-black text-gray-900 uppercase shadow-inner outline-none" placeholder="EX: COMPRA DE LEITE, LIMP." /></div>
                        <div className="space-y-2"><label className="text-[10px] font-black text-gray-400 uppercase ml-2 tracking-widest">Categoria</label><select value={txForm.category} onChange={e => setTxForm({...txForm, category: e.target.value})} className="w-full p-4 bg-gray-50 rounded-2xl font-black outline-none border-none shadow-inner">
                            <option value="Despesa Operacional">Despesa Operacional</option>
                            <option value="Material Limpeza">Material Limpeza</option>
                            <option value="Material Sorvete">Material Sorvete</option>
                            <option value="Fornecedor">Fornecedor</option>
                            <option value="Clientes">Clientes</option>
                            <option value="Divisão">Divisão</option>
                        </select></div>
                        <button onClick={handleSaveTransaction} disabled={isSubmitting} className="w-full py-5 bg-red-600 text-white rounded-[28px] font-black uppercase text-xs shadow-xl active:scale-95 transition-all border-b-4 border-red-900 flex items-center justify-center gap-3">{isSubmitting ? <Loader2 className="animate-spin" /> : <Save size={18}/>} EFETIVAR LANÇAMENTO</button>
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
