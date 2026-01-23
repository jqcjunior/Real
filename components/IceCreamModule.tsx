
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
  onCancelSale: (id: string) => Promise<void>;
  onUpdatePrice: (id: string, price: number) => Promise<void>;
  onAddTransaction: (tx: IceCreamTransaction) => Promise<void>;
  onAddItem: (name: string, category: string, price: number, flavor?: string, stockInitial?: number, unit?: string, consumptionPerSale?: number, targetStoreId?: string, recipe?: IceCreamRecipeItem[]) => Promise<void>;
  onSaveProduct: (product: Partial<IceCreamItem>) => Promise<void>;
  onDeleteItem: (id: string) => Promise<void>;
  onUpdateStock: (storeId: string, base: string, value: number, unit: string, type: 'production' | 'adjustment' | 'purchase') => Promise<void>;
  liquidatePromissory: (id: string) => Promise<void>;
}

const PRODUCT_CATEGORIES: IceCreamCategory[] = ['Sundae', 'Milkshake', 'Casquinha', 'Cascão', 'Cascão Trufado', 'Copinho', 'Bebidas', 'Adicionais'].sort() as IceCreamCategory[];

// Helper refinado para obter imagem ilustrativa por palavra-chave e categoria
const getCategoryImage = (category: IceCreamCategory, name: string) => {
    const itemName = name.toLowerCase();
    
    // 1. Mains (Sundae e Cascão agora repetem a imagem da Casquinha conforme solicitado)
    if (['Sundae', 'Casquinha', 'Cascão', 'Cascão Trufado'].includes(category)) {
        return 'https://img.icons8.com/color/144/ice-cream-cone.png';
    }

    // 2. Keyword Overrides (Caldas e Chocolate agora replicam o ícone da Nutella)
    if (itemName.includes('nutella') || itemName.includes('calda') || itemName.includes('chocolate')) {
        return 'https://img.icons8.com/color/144/chocolate-spread.png';
    }
    
    if (itemName.includes('água') || itemName.includes('agua')) {
        return 'https://img.icons8.com/color/144/water-bottle.png';
    }

    // 3. Outras Categorias
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
  const [buyerName, setBuyerName] = useState('');
  const [amountReceived, setAmountReceived] = useState('');
  
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  // Filtros de Auditoria
  const [auditDay, setAuditDay] = useState<string>(new Date().getDate().toString());
  const [auditMonth, setAuditMonth] = useState<string>((new Date().getMonth() + 1).toString());
  const [auditYear, setAuditYear] = useState<string>(new Date().getFullYear().toString());
  const [auditSearch, setAuditSearch] = useState('');

  const [showProductModal, setShowProductModal] = useState(false);
  const [showTransactionModal, setShowTransactionModal] = useState(false);
  const [showPartnersModal, setShowPartnersModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState<{id: string} | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  
  // Modais de Estoque
  const [showNewInsumoModal, setShowNewInsumoModal] = useState(false);
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [showInventoryModal, setShowInventoryModal] = useState(false);

  const [partners, setPartners] = useState<StoreProfitPartner[]>([]);
  const [newPartner, setNewPartner] = useState({ name: '', percentage: '' });
  
  const [newInsumo, setNewInsumo] = useState({ name: '', unit: 'un', initial: '' });
  const [purchaseForm, setPurchaseForm] = useState<Record<string, string>>({}); 
  const [inventoryForm, setInventoryForm] = useState<Record<string, string>>({});

  const [newProd, setNewProd] = useState({
      name: '',
      category: 'Copinho' as IceCreamCategory,
      price: '',
      flavor: ''
  });
  
  const [tempRecipe, setTempRecipe] = useState<IceCreamRecipeItem[]>([]);
  const [newRecipeItem, setNewRecipeItem] = useState({ stock_base_name: '', quantity: '1' });
  const [editingProduct, setEditingProduct] = useState<IceCreamItem | null>(null);

  const [txForm, setTxForm] = useState({
      date: new Date().toLocaleDateString('en-CA'),
      category: 'Despesa Operacional',
      value: '',
      description: ''
  });
  
  const [manualStoreId, setManualStoreId] = useState('');
  const isAdmin = user.role === UserRole.ADMIN;
  const effectiveStoreId = isAdmin 
    ? (manualStoreId || user.storeId || (stores.length > 0 ? stores[0].id : ''))
    : (user.storeId || (stores.length > 0 ? stores[0].id : ''));
  
  const cartTotal = useMemo(() => cart.reduce((acc, curr) => acc + curr.totalValue, 0), [cart]);

  const changeDue = useMemo(() => {
    const paid = parseFloat(amountReceived.replace(',', '.')) || 0;
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
  const filteredStock = useMemo(() => (stock ?? []).filter(s => s.store_id === effectiveStoreId).sort((a,b) => a.product_base.localeCompare(b.product_base)), [stock, effectiveStoreId]);
  
  const todayKey = new Date().toLocaleDateString('en-CA');
  const periodKey = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`;

  const dreStats = useMemo(() => {
      const daySales = (sales ?? []).filter(s => s.createdAt?.startsWith(todayKey) && s.status !== 'canceled' && s.storeId === effectiveStoreId);
      const dayExits = (finances ?? []).filter(f => f.date === todayKey && (f.type === 'exit' || (f.type as string) === 'saida') && f.storeId === effectiveStoreId);
      const monthSales = (sales ?? []).filter(s => s.createdAt?.startsWith(periodKey) && s.status !== 'canceled' && s.storeId === effectiveStoreId);
      const monthExits = (finances ?? []).filter(f => f.date?.startsWith(periodKey) && (f.type === 'exit' || (f.type as string) === 'saida') && f.storeId === effectiveStoreId);

      const byMethod = (list: IceCreamDailySale[]) => ({
          pix: list.filter(s => s.paymentMethod === 'Pix').reduce((a,b) => a + b.totalValue, 0),
          money: list.filter(s => s.paymentMethod === 'Dinheiro').reduce((a,b) => a + b.totalValue, 0),
          card: list.filter(s => s.paymentMethod === 'Cartão').reduce((a,b) => a + b.totalValue, 0),
          fiado: list.filter(s => s.paymentMethod === 'Fiado').reduce((a,b) => a + b.totalValue, 0)
      });

      const byCategory = (list: IceCreamDailySale[]) => {
          const catMap: Record<string, number> = {};
          list.forEach(s => {
              catMap[s.category] = (catMap[s.category] || 0) + s.totalValue;
          });
          return Object.entries(catMap).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value);
      };

      const monthIn = monthSales.reduce((a,b) => a + b.totalValue, 0);
      const monthOut = monthExits.reduce((a,b) => a + Number(b.value), 0);
      const profit = monthIn - monthOut;

      return {
          dayIn: daySales.reduce((a,b) => a + b.totalValue, 0),
          dayOut: dayExits.reduce((a,b) => a + Number(b.value), 0),
          dayMethods: byMethod(daySales),
          dayCategories: byCategory(daySales),
          daySales: daySales.sort((a,b) => (b.createdAt || '').localeCompare(a.createdAt || '')),
          monthMethods: byMethod(monthSales),
          monthCategories: byCategory(monthSales),
          monthIn,
          monthOut,
          profit,
          monthExits: monthExits.sort((a,b) => b.date.localeCompare(a.date)),
      };
  }, [sales, finances, todayKey, periodKey, effectiveStoreId]);

  const filteredAuditSales = useMemo(() => {
      return (sales ?? []).filter(s => {
          if (s.storeId !== effectiveStoreId) return false;
          if (!s.createdAt) return false;
          
          const sDate = new Date(s.createdAt);
          const sDay = sDate.getDate().toString();
          const sMonth = (sDate.getMonth() + 1).toString();
          const sYear = sDate.getFullYear().toString();

          const matchDay = auditDay === '' || auditDay === sDay;
          const matchMonth = auditMonth === '' || auditMonth === sMonth;
          const matchYear = auditYear === '' || auditYear === sYear;
          const matchSearch = auditSearch === '' || 
              s.productName.toLowerCase().includes(auditSearch.toLowerCase()) || 
              s.saleCode?.toLowerCase().includes(auditSearch.toLowerCase()) ||
              s.buyer_name?.toLowerCase().includes(auditSearch.toLowerCase());

          return matchDay && matchMonth && matchYear && matchSearch;
      });
  }, [sales, effectiveStoreId, auditDay, auditMonth, auditYear, auditSearch]);

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
      if (paymentMethod === 'Fiado' && !buyerName) { alert("Nome do funcionário obrigatório."); return; }
      setIsSubmitting(true);
      try {
          const saleCode = `GEL-${Date.now().toString().slice(-6)}`;
          const salesToSave = cart.map(c => ({ ...c, paymentMethod: paymentMethod!, buyer_name: paymentMethod === 'Fiado' ? buyerName.toUpperCase() : undefined, saleCode }));
          
          // Registrar Venda
          await onAddSales(salesToSave);

          // Baixa Automática de Insumos (CONJUNTA)
          for (const c of cart) {
              const itemDef = items.find(it => it.id === c.itemId);
              if (itemDef?.recipe && itemDef.recipe.length > 0) {
                  for (const ingredient of itemDef.recipe) {
                      const qtyToDeduct = ingredient.quantity * c.unitsSold;
                      await onUpdateStock(effectiveStoreId, ingredient.stock_base_name, -qtyToDeduct, '', 'adjustment');
                  }
              }
          }

          setCart([]); setPaymentMethod(null); setBuyerName(''); setAmountReceived('');
          alert("Venda realizada com baixa de insumos!");
      } catch (e) { alert("Falha ao registrar venda."); } finally { setIsSubmitting(false); }
  };

  const handleSaveProductForm = async (e: React.FormEvent) => {
      e.preventDefault();
      setIsSubmitting(true);
      try {
          const price = Number(newProd.price.replace(',', '.'));
          await onSaveProduct({
              id: editingProduct?.id,
              storeId: effectiveStoreId,
              name: newProd.name,
              category: newProd.category,
              price: price,
              flavor: newProd.flavor,
              recipe: tempRecipe
          });
          
          setNewProd({ name: '', category: 'Copinho', price: '', flavor: '' });
          setTempRecipe([]); setEditingProduct(null); setShowProductModal(false);
          alert("Produto e Receita salvos com sucesso!"); 
      } catch (err) { alert("Erro ao salvar produto."); } finally { setIsSubmitting(false); }
  };

  const handleAddRecipeItem = () => {
    if (!newRecipeItem.stock_base_name) return;
    const qty = parseFloat(newRecipeItem.quantity.replace(',', '.'));
    if (isNaN(qty)) return;
    setTempRecipe([...tempRecipe, { stock_base_name: newRecipeItem.stock_base_name, quantity: qty }]);
    setNewRecipeItem({ stock_base_name: '', quantity: '1' });
  };

  const handleCancelSale = async () => {
      if (!showCancelModal) return;
      setIsSubmitting(true);
      try {
          await onCancelSale(showCancelModal.id);
          setShowCancelModal(null); setCancelReason('');
          alert("Venda excluída com sucesso!");
      } catch (e) { alert("Erro ao excluir."); } finally { setIsSubmitting(false); }
  };

  const handleAddPartner = async () => {
    const pct = parseFloat(newPartner.percentage.replace(',', '.'));
    if (!newPartner.name || isNaN(pct) || !effectiveStoreId) return;
    setIsSubmitting(true);
    try {
        const { error } = await supabase.from('store_profit_distribution').insert([{
            store_id: effectiveStoreId,
            partner_name: newPartner.name.toUpperCase().trim(),
            percentage: pct,
            active: true
        }]);
        if (error) throw error;
        setNewPartner({ name: '', percentage: '' });
        await fetchPartners();
        alert("Sócio adicionado com sucesso!");
    } catch (e) {
        console.error("Error adding partner:", e);
        alert("Erro ao adicionar sócio.");
    } finally {
        setIsSubmitting(false);
    }
  };

  // Funções de Estoque
  const handleAddNewInsumo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newInsumo.name || !effectiveStoreId) return;
    setIsSubmitting(true);
    try {
        const initial = parseFloat(newInsumo.initial.replace(',', '.')) || 0;
        const { error } = await supabase.from('ice_cream_stock').insert([{
            store_id: effectiveStoreId,
            product_base: newInsumo.name.toUpperCase().trim(),
            stock_initial: initial,
            stock_current: initial,
            unit: newInsumo.unit
        }]);
        if (error) throw error;
        setNewInsumo({ name: '', unit: 'un', initial: '' });
        setShowNewInsumoModal(false);
        alert("Novo insumo cadastrado!");
    } catch (e) { alert("Erro ao cadastrar insumo."); } finally { setIsSubmitting(false); }
  };

  const handlePurchaseStock = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
        // Itera sobre as quantidades informadas no formulário de compra (Record)
        for (const st of filteredStock) {
            const qtyStr = purchaseForm[st.id];
            if (qtyStr !== undefined && qtyStr !== '') {
                const qty = parseFloat(qtyStr.replace(',', '.'));
                if (!isNaN(qty) && qty > 0) {
                    await onUpdateStock(effectiveStoreId, st.product_base, qty, st.unit, 'purchase');
                }
            }
        }
        setPurchaseForm({});
        setShowPurchaseModal(false);
        alert("Compras registradas e estoque atualizado!");
    } catch (e) { alert("Erro ao registrar compra."); } finally { setIsSubmitting(false); }
  };

  const handleInventoryAdjustment = async (e: React.FormEvent) => {
      e.preventDefault();
      setIsSubmitting(true);
      try {
          for (const st of filteredStock) {
              const newValueStr = inventoryForm[st.id];
              if (newValueStr !== undefined && newValueStr !== '') {
                  const newValue = parseFloat(newValueStr.replace(',', '.'));
                  if (!isNaN(newValue)) {
                      const delta = newValue - st.stock_current;
                      if (delta !== 0) {
                          await onUpdateStock(effectiveStoreId, st.product_base, delta, st.unit, 'adjustment');
                      }
                  }
              }
          }
          setShowInventoryModal(false);
          alert("Inventário processado com sucesso!");
      } catch (e) { alert("Erro no processamento do inventário."); } finally { setIsSubmitting(false); }
  };

  return (
    <div className="flex flex-col h-full bg-gray-50 overflow-hidden font-sans relative">
        <div className="bg-white border-b px-4 md:px-6 py-2 flex flex-col md:flex-row justify-between items-center gap-2 z-40 shadow-sm shrink-0">
            <div className="flex items-center gap-2">
                <div className="p-1.5 bg-blue-900 rounded-xl text-white shadow-lg shrink-0">
                    <IceCream size={18} />
                </div>
                <div className="truncate">
                    <h2 className="text-sm md:text-base font-black uppercase italic tracking-tighter text-blue-950 leading-none">Gelateria <span className="text-red-600">Real</span></h2>
                    <div className="flex items-center gap-1 mt-0.5">
                        <p className="text-[7px] font-black text-gray-400 uppercase tracking-widest leading-none">Unidade</p>
                        {isAdmin ? (
                            <select value={effectiveStoreId} onChange={(e) => setManualStoreId(e.target.value)} className="bg-transparent border-none text-[8px] font-black text-blue-600 uppercase outline-none cursor-pointer focus:ring-0 p-0 h-auto min-h-0">
                                {[...stores].sort((a, b) => parseInt(a.number || '0') - parseInt(b.number || '0')).map(s => (
                                    <option key={s.id} value={s.id}>{s.number} - {s.city}</option>
                                ))}
                            </select>
                        ) : (
                            <span className="text-[8px] font-black text-blue-600 uppercase">
                                {stores.find(s => s.id === effectiveStoreId)?.number} - {stores.find(s => s.id === effectiveStoreId)?.city}
                            </span>
                        )}
                    </div>
                </div>
            </div>
            <div className="flex bg-gray-100 p-0.5 rounded-xl overflow-x-auto no-scrollbar w-full md:w-auto max-w-full">
                <button onClick={() => setActiveTab('pdv')} className={`flex-1 md:flex-none px-3 py-2 rounded-lg text-[8px] md:text-[9px] font-black uppercase transition-all flex items-center justify-center gap-1.5 whitespace-nowrap ${activeTab === 'pdv' ? 'bg-white text-blue-700 shadow-md' : 'text-gray-500'}`}><ShoppingCart size={12}/> PDV</button>
                <button onClick={() => setActiveTab('estoque')} className={`flex-1 md:flex-none px-3 py-2 rounded-lg text-[8px] md:text-[9px] font-black uppercase transition-all flex items-center justify-center gap-1.5 whitespace-nowrap ${activeTab === 'estoque' ? 'bg-white text-blue-700 shadow-md' : 'text-gray-500'}`}><Package size={12}/> Estoque</button>
                {can('MODULE_GELATERIA_DRE_DIARIO') && (<button onClick={() => setActiveTab('dre_diario')} className={`flex-1 md:flex-none px-3 py-2 rounded-lg text-[8px] md:text-[9px] font-black uppercase transition-all flex items-center justify-center gap-1.5 whitespace-nowrap ${activeTab === 'dre_diario' ? 'bg-white text-blue-700 shadow-md' : 'text-gray-500'}`}><Clock size={12}/> DRE Diário</button>)}
                {can('MODULE_GELATERIA_DRE_MENSAL') && (<button onClick={() => setActiveTab('dre_mensal')} className={`flex-1 md:flex-none px-3 py-2 rounded-lg text-[8px] md:text-[9px] font-black uppercase transition-all flex items-center justify-center gap-1.5 whitespace-nowrap ${activeTab === 'dre_mensal' ? 'bg-white text-purple-700 shadow-sm' : 'text-gray-400'}`}><FileBarChart size={12}/> DRE Mensal</button>)}
                <button onClick={() => setActiveTab('audit')} className={`flex-1 md:flex-none px-3 py-2 rounded-lg text-[8px] md:text-[9px] font-black uppercase transition-all flex items-center justify-center gap-1.5 whitespace-nowrap ${activeTab === 'audit' ? 'bg-white text-blue-700 shadow-md' : 'text-gray-500'}`}><History size={12}/> Auditoria</button>
                {can('MODULE_GELATERIA_CONFIG') && (<button onClick={() => setActiveTab('produtos')} className={`flex-1 md:flex-none px-3 py-2 rounded-lg text-[8px] md:text-[9px] font-black uppercase transition-all flex items-center justify-center gap-1.5 whitespace-nowrap ${activeTab === 'produtos' ? 'bg-white text-blue-700 shadow-md' : 'text-gray-500'}`}><PackagePlus size={12}/> Produtos</button>)}
            </div>
        </div>

        <div className="flex-1 overflow-y-auto no-scrollbar relative">
            {activeTab === 'pdv' && (
                <div className="h-full">
                    <div className="lg:hidden h-full">
                        <PDVMobileView user={user} items={filteredItems} cart={cart} setCart={setCart} selectedCategory={selectedCategory} setSelectedCategory={setSelectedCategory} selectedProductName={null} setSelectedProductName={() => {}} selectedItem={null} setSelectedItem={() => {}} selectedMl="" setSelectedMl={() => {}} quantity={1} setQuantity={() => {}} paymentMethod={paymentMethod} setPaymentMethod={setPaymentMethod} buyerName={buyerName} setBuyerName={setBuyerName} onAddSales={onAddSales} onCancelSale={onCancelSale} onAddTransaction={onAddTransaction} dailyData={dreStats} handlePrintTicket={() => {}} isSubmitting={isSubmitting} setIsSubmitting={setIsSubmitting} effectiveStoreId={effectiveStoreId} />
                    </div>
                    <div className="hidden lg:grid grid-cols-12 gap-4 p-6 max-w-[1500px] mx-auto h-full overflow-hidden">
                        <div className="col-span-8 flex flex-col h-full overflow-hidden">
                            <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-3">
                                <button onClick={() => setSelectedCategory(null)} className={`px-5 py-2 rounded-xl font-black uppercase text-[10px] border-2 transition-all ${!selectedCategory ? 'bg-blue-900 text-white border-blue-900 shadow-lg' : 'bg-white text-gray-400 border-gray-100'}`}>Tudo</button>
                                {PRODUCT_CATEGORIES.map(cat => (<button key={cat} onClick={() => setSelectedCategory(cat)} className={`px-5 py-2 rounded-xl font-black uppercase text-[10px] border-2 transition-all whitespace-nowrap ${selectedCategory === cat ? 'bg-blue-900 text-white border-blue-900 shadow-lg' : 'bg-white text-gray-400 border-gray-100'}`}>{cat}</button>))}
                            </div>
                            <div className="grid grid-cols-3 xl:grid-cols-4 gap-4 overflow-y-auto no-scrollbar pr-2 pb-10">
                                {filteredItems.filter(i => (!selectedCategory || i.category === selectedCategory) && i.active).map(item => (
                                    <button key={item.id} onClick={() => handleAddToCart(item)} className="bg-white p-4 rounded-[32px] border-2 border-gray-100 hover:border-blue-600 transition-all flex flex-col items-center text-center group shadow-sm">
                                        <div className="w-full aspect-square bg-gray-50 rounded-[24px] mb-3 flex items-center justify-center text-blue-100 group-hover:scale-105 transition-transform overflow-hidden">
                                            <img src={item.image_url || getCategoryImage(item.category, item.name)} className="w-full h-full object-cover p-2" />
                                        </div>
                                        <h4 className="font-black text-gray-900 uppercase text-[10px] truncate w-full mb-1">{item.name}</h4>
                                        <p className="text-lg font-black text-blue-900 italic leading-none">{formatCurrency(item.price)}</p>
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="col-span-4 bg-white rounded-[40px] shadow-2xl border border-gray-100 p-8 flex flex-col h-full sticky top-0 overflow-hidden">
                            <h3 className="text-lg font-black uppercase italic mb-6 flex items-center gap-3 border-b pb-4"><ShoppingCart className="text-red-600" size={20} /> Venda <span className="text-gray-300 ml-auto font-bold text-xs">{cart.length} ITENS</span></h3>
                            <div className="flex-1 overflow-y-auto mb-6 space-y-2 no-scrollbar">
                                {cart.map((c) => (
                                    <div key={c.id} className="flex justify-between items-center p-4 bg-gray-50 rounded-2xl border border-gray-100">
                                        <div className="flex-1 min-w-0 pr-4"><p className="font-black text-gray-900 uppercase text-[10px] truncate">{c.productName}</p><p className="text-[9px] text-gray-400 font-bold uppercase">{formatCurrency(c.unitPrice)}</p></div>
                                        <div className="flex items-center gap-3"><span className="font-black text-blue-900 text-xs">{formatCurrency(c.totalValue)}</span><button onClick={() => setCart(cart.filter(item => item.id !== c.id))} className="p-1.5 text-red-300 hover:text-red-600"><Trash2 size={14}/></button></div>
                                    </div>
                                ))}
                            </div>
                            <div className="pt-4 border-t space-y-4 shrink-0">
                                <div className="flex justify-between items-baseline"><span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Subtotal</span><span className="text-3xl font-black text-blue-950 italic">{formatCurrency(cartTotal)}</span></div>
                                <div className="grid grid-cols-2 gap-2">{['Pix', 'Dinheiro', 'Cartão', 'Fiado'].map((m: any) => (<button key={m} onClick={() => { setPaymentMethod(m); }} className={`py-3 rounded-xl font-black uppercase text-[10px] border-2 transition-all ${paymentMethod === m ? 'bg-blue-900 text-white border-blue-900 shadow-xl' : 'bg-white border-gray-200 text-gray-400'}`}>{m}</button>))}</div>
                                {paymentMethod === 'Dinheiro' && (
                                    <div className="bg-green-50 p-4 rounded-2xl border-2 border-green-200 animate-in zoom-in duration-300 space-y-3">
                                        <div className="flex justify-between items-center"><label className="text-[10px] font-black text-green-700 uppercase">Valor Recebido</label><input autoFocus value={amountReceived} onChange={e => setAmountReceived(e.target.value)} placeholder="0,00" className="w-32 text-right bg-white border-none rounded-xl p-3 font-black text-green-700 outline-none text-lg shadow-inner" /></div>
                                        <div className="flex justify-between items-baseline border-t border-green-100 pt-2"><span className="text-[10px] font-black text-green-600 uppercase">Troco a Devolver</span><span className="text-2xl font-black text-green-700 italic">{formatCurrency(changeDue)}</span></div>
                                    </div>
                                )}
                                {paymentMethod === 'Fiado' && (
                                    <div className="animate-in fade-in duration-300">
                                        <label className="text-[9px] font-black text-red-600 uppercase mb-1 block ml-1">Funcionário Comprador</label>
                                        <input value={buyerName} onChange={e => setBuyerName(e.target.value.toUpperCase())} className="w-full p-4 bg-red-50 border-2 border-red-100 rounded-2xl font-black uppercase text-sm outline-none focus:ring-4 focus:ring-red-100 shadow-inner" placeholder="NOME DO FUNCIONÁRIO..." />
                                    </div>
                                )}
                                <button onClick={finalizeSale} disabled={isSubmitting || cart.length === 0 || !paymentMethod || (paymentMethod === 'Fiado' && !buyerName)} className="w-full py-5 bg-red-600 hover:bg-red-700 disabled:opacity-30 text-white rounded-[24px] font-black uppercase text-xs shadow-2xl flex items-center justify-center gap-3 transition-all border-b-4 border-red-900 active:scale-95">{isSubmitting ? <Loader2 className="animate-spin" /> : <CheckCircle2 size={18}/>} {paymentMethod === 'Fiado' ? 'Gerar Promissória' : 'Finalizar Venda'}</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'dre_diario' && (
                <div className="p-4 md:p-8 space-y-6 animate-in fade-in duration-300 max-w-5xl mx-auto">
                    <div className="bg-white p-8 rounded-[40px] shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between items-center gap-6">
                        <div className="flex items-center gap-4">
                            <div className="p-4 bg-blue-50 text-blue-700 rounded-3xl"><Clock size={32}/></div>
                            <div>
                                <h3 className="text-2xl font-black uppercase italic text-blue-950 tracking-tighter">Fluxo de Caixa <span className="text-blue-700">Diário</span></h3>
                                <div className="flex bg-gray-100 p-1 rounded-lg mt-2">
                                    <button onClick={() => setDreSubTab('resumo')} className={`px-4 py-1.5 rounded-md text-[9px] font-black uppercase transition-all ${dreSubTab === 'resumo' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-400'}`}>Resumido</button>
                                    <button onClick={() => setDreSubTab('detalhado')} className={`px-4 py-1.5 rounded-md text-[9px] font-black uppercase transition-all ${dreSubTab === 'detalhado' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-400'}`}>Detalhado</button>
                                </div>
                            </div>
                        </div>
                        <div className="text-right">
                             <p className="text-[9px] font-black text-gray-400 uppercase">Data de Apuração</p>
                             <p className="text-lg font-black text-blue-950">{new Date().toLocaleDateString('pt-BR')}</p>
                        </div>
                    </div>

                    {dreSubTab === 'resumo' ? (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="bg-white p-6 rounded-[32px] border-2 border-green-100 shadow-sm space-y-4">
                                <span className="text-[9px] font-black text-green-600 uppercase tracking-widest">Resumo Entradas (+)</span>
                                <div className="space-y-2">
                                    {dreStats.dayCategories.map(cat => (
                                        <div key={cat.name} className="flex justify-between items-center text-[10px] font-black border-b border-gray-50 pb-1">
                                            <span className="text-gray-400 uppercase">{cat.name}</span>
                                            <span className="text-gray-900">{formatCurrency(cat.value)}</span>
                                        </div>
                                    ))}
                                </div>
                                <div className="pt-2 border-t-2 border-green-50">
                                    <p className="text-2xl font-black text-green-700 italic">{formatCurrency(dreStats.dayIn)}</p>
                                </div>
                            </div>
                            <div className="bg-white p-6 rounded-[32px] border-2 border-red-100 shadow-sm flex flex-col justify-between">
                                <div>
                                    <span className="text-[9px] font-black text-red-600 uppercase tracking-widest">Resumo Saídas (-)</span>
                                    <p className="text-3xl font-black text-red-700 italic mt-4">{formatCurrency(dreStats.dayOut)}</p>
                                </div>
                            </div>
                            <div className="bg-gray-950 p-6 rounded-[32px] text-white shadow-xl flex flex-col justify-between">
                                <div>
                                    <span className="text-[9px] font-black text-blue-400 uppercase tracking-widest">Saldo Líquido</span>
                                    <p className="text-3xl font-black italic mt-4">{formatCurrency(dreStats.dayIn - dreStats.dayOut)}</p>
                                    <p className="text-[8px] font-bold text-gray-500 uppercase mt-2">Diferença real em caixa</p>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="bg-white rounded-[40px] shadow-xl border border-gray-100 overflow-hidden">
                            <table className="w-full text-left">
                                <thead className="bg-gray-50 text-[9px] font-black text-gray-400 uppercase tracking-widest border-b">
                                    <tr>
                                        <th className="px-6 py-4">Horário / Código</th>
                                        <th className="px-6 py-4">Operação</th>
                                        <th className="px-6 py-4">Categoria</th>
                                        <th className="px-6 py-4 text-right">Valor</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50 font-bold text-[10px]">
                                    {dreStats.daySales.map(s => (
                                        <tr key={s.id} className="hover:bg-green-50/20">
                                            <td className="px-6 py-3 text-gray-400">#{s.saleCode} <span className="block">{new Date(s.createdAt!).toLocaleTimeString()}</span></td>
                                            <td className="px-6 py-3 uppercase text-gray-900">VENDA: {s.productName}</td>
                                            <td className="px-6 py-3 uppercase text-gray-500">{s.category}</td>
                                            <td className="px-6 py-3 text-right text-green-600">{formatCurrency(s.totalValue)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'dre_mensal' && (
                <div className="p-4 md:p-8 space-y-6 animate-in fade-in duration-300 max-w-6xl mx-auto">
                    <div className="bg-white p-8 rounded-[40px] shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between items-center gap-6">
                        <div className="flex items-center gap-4">
                            <div className="p-4 bg-purple-50 text-purple-700 rounded-3xl"><FilePieChart size={32}/></div>
                            <div>
                                <h3 className="text-2xl font-black uppercase italic text-blue-950 tracking-tighter">DRE <span className="text-purple-700">Mensal</span></h3>
                                <div className="flex bg-gray-100 p-1 rounded-lg mt-2">
                                    <button onClick={() => setDreSubTab('resumo')} className={`px-4 py-1.5 rounded-md text-[9px] font-black uppercase transition-all ${dreSubTab === 'resumo' ? 'bg-white text-purple-700 shadow-sm' : 'text-gray-400'}`}>Resumido</button>
                                    <button onClick={() => setDreSubTab('detalhado')} className={`px-4 py-1.5 rounded-md text-[9px] font-black uppercase transition-all ${dreSubTab === 'detalhado' ? 'bg-white text-purple-700 shadow-sm' : 'text-gray-400'}`}>Detalhamento Insumos</button>
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 bg-gray-50 p-2 rounded-2xl border">
                             <select value={selectedMonth} onChange={e => setSelectedMonth(Number(e.target.value))} className="bg-transparent border-none text-xs font-black uppercase outline-none">
                                {MONTHS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                             </select>
                             <select value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))} className="bg-transparent border-none text-xs font-black outline-none">
                                {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
                             </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                        <div className="lg:col-span-8 space-y-6">
                            <div className="bg-white p-8 rounded-[40px] shadow-sm border border-gray-100">
                                <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-6 flex items-center gap-2"><Briefcase size={14}/> Demonstrativo de Resultado</h4>
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center pb-4 border-b">
                                        <span className="font-bold text-gray-600 uppercase text-xs">Venda Bruta (+)</span>
                                        <span className="font-black text-green-600 text-lg">{formatCurrency(dreStats.monthIn)}</span>
                                    </div>
                                    <div className="flex justify-between items-center pb-4 border-b">
                                        <span className="font-bold text-gray-600 uppercase text-xs">Despesas / Saídas (-)</span>
                                        <span className="font-black text-red-600 text-lg">{formatCurrency(dreStats.monthOut)}</span>
                                    </div>
                                    <div className="flex justify-between items-center pt-2">
                                        <span className="font-black text-blue-950 uppercase text-sm">Lucro Operacional (=)</span>
                                        <span className="font-black text-blue-900 text-2xl italic">{formatCurrency(dreStats.profit)}</span>
                                    </div>
                                </div>
                            </div>

                            {dreSubTab === 'resumo' ? (
                                <div className="bg-white p-8 rounded-[40px] shadow-sm border border-gray-100">
                                    <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-6 flex items-center gap-2"><PieChart size={14}/> Mix de Categorias</h4>
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                        {dreStats.monthCategories.map(cat => (
                                            <div key={cat.name} className="p-4 bg-gray-50 rounded-2xl">
                                                <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest">{cat.name}</p>
                                                <p className="text-sm font-black text-gray-900 italic mt-1">{formatCurrency(cat.value)}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <div className="bg-white p-8 rounded-[40px] shadow-sm border border-gray-100">
                                    <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-6 flex items-center gap-2"><Layers size={14}/> Detalhamento de Saídas</h4>
                                    <div className="max-h-60 overflow-y-auto no-scrollbar pr-2 space-y-2">
                                        {dreStats.monthExits.map(ex => (
                                            <div key={ex.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-xl">
                                                <div>
                                                    <p className="text-[10px] font-black text-gray-900 uppercase">{ex.category}</p>
                                                    <p className="text-[8px] text-gray-400 font-bold uppercase">{new Date(ex.date + 'T12:00:00').toLocaleDateString('pt-BR')} - {ex.description}</p>
                                                </div>
                                                <span className="font-black text-red-600 text-xs">-{formatCurrency(ex.value)}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="lg:col-span-4 space-y-6">
                            <div className="bg-gray-950 p-8 rounded-[40px] shadow-2xl text-white">
                                <div className="flex justify-between items-center mb-6">
                                    <h4 className="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em] flex items-center gap-2"><UsersIcon size={16}/> Partilha de Lucros</h4>
                                    <button onClick={() => setShowPartnersModal(true)} className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-all"><Settings size={14}/></button>
                                </div>
                                <div className="space-y-4">
                                    {partners.map(p => (
                                        <div key={p.id} className="border-b border-white/5 pb-4 last:border-0">
                                            <div className="flex justify-between items-baseline mb-1">
                                                <span className="text-[10px] font-black uppercase italic tracking-tighter">{p.partner_name}</span>
                                                <span className="text-[9px] font-bold text-blue-400">{p.percentage}%</span>
                                            </div>
                                            <p className="text-xl font-black italic tracking-tighter text-blue-100">{formatCurrency((dreStats.profit * p.percentage) / 100)}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'audit' && (
                <div className="p-4 md:p-8 space-y-6 animate-in fade-in duration-300 max-w-6xl mx-auto">
                    <div className="bg-white p-6 rounded-[40px] shadow-sm border border-gray-100 flex flex-col gap-6">
                        <div>
                            <h3 className="text-xl font-black uppercase italic text-blue-950 tracking-tighter flex items-center gap-3"><History className="text-blue-700" size={28}/> Auditoria de <span className="text-red-600">Vendas</span></h3>
                            <p className="text-gray-400 text-[9px] font-black uppercase tracking-widest mt-1">Controle de transações por período</p>
                        </div>
                        
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                            <div className="space-y-1">
                                <label className="text-[8px] font-black text-gray-400 uppercase ml-1">Dia</label>
                                <select value={auditDay} onChange={e => setAuditDay(e.target.value)} className="w-full bg-gray-50 border-none rounded-xl p-3 text-[10px] font-black uppercase outline-none shadow-inner">
                                    <option value="">TODOS</option>
                                    {Array.from({length: 31}, (_, i) => (
                                        <option key={i+1} value={i+1}>{i+1}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="space-y-1">
                                <label className="text-[8px] font-black text-gray-400 uppercase ml-1">Mês</label>
                                <select value={auditMonth} onChange={e => setAuditMonth(e.target.value)} className="w-full bg-gray-50 border-none rounded-xl p-3 text-[10px] font-black uppercase outline-none shadow-inner">
                                    <option value="">TODOS</option>
                                    {MONTHS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                                </select>
                            </div>
                            <div className="space-y-1">
                                <label className="text-[8px] font-black text-gray-400 uppercase ml-1">Ano</label>
                                <select value={auditYear} onChange={e => setAuditYear(e.target.value)} className="w-full bg-gray-50 border-none rounded-xl p-3 text-[10px] font-black uppercase outline-none shadow-inner">
                                    <option value="">TODOS</option>
                                    {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
                                </select>
                            </div>
                            <div className="col-span-2 space-y-1">
                                <label className="text-[8px] font-black text-gray-400 uppercase ml-1">Busca Rápida</label>
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" size={14}/>
                                    <input value={auditSearch} onChange={e => setAuditSearch(e.target.value)} placeholder="PRODUTO, CÓDIGO OU FUNCIONÁRIO..." className="w-full bg-gray-50 border-none rounded-xl pl-10 pr-4 py-3 text-[10px] font-black uppercase outline-none shadow-inner" />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-[40px] shadow-xl border border-gray-100 overflow-hidden">
                        <div className="overflow-x-auto no-scrollbar">
                            <table className="w-full text-left">
                                <thead className="bg-gray-50 text-[9px] font-black text-gray-400 uppercase tracking-widest border-b">
                                    <tr>
                                        <th className="px-8 py-5">Cod / Data</th>
                                        <th className="px-8 py-5">Produto / Qtd</th>
                                        <th className="px-8 py-5">Pagamento</th>
                                        <th className="px-8 py-5 text-right">Total</th>
                                        <th className="px-8 py-5 text-center">Ações</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50 font-bold text-[10px]">
                                    {filteredAuditSales.map(sale => (
                                        <tr key={sale.id} className={`hover:bg-blue-50/30 transition-all ${sale.status === 'canceled' ? 'opacity-30 grayscale italic line-through' : ''}`}>
                                            <td className="px-8 py-5">
                                                <div className="text-xs font-black text-blue-950">#{sale.saleCode || 'GEL-000'}</div>
                                                <div className="text-[8px] text-gray-400 uppercase mt-0.5">{new Date(sale.createdAt!).toLocaleString('pt-BR')}</div>
                                            </td>
                                            <td className="px-8 py-5">
                                                <div className="text-[10px] font-black text-gray-900 uppercase italic tracking-tighter">{sale.unitsSold}x {sale.productName}</div>
                                                <div className="text-[8px] text-gray-400 uppercase mt-0.5">{sale.flavor}</div>
                                            </td>
                                            <td className="px-8 py-5">
                                                <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase border ${sale.paymentMethod === 'Fiado' ? 'bg-red-50 text-red-600 border-red-100' : 'bg-green-50 text-green-700 border-green-100'}`}>{sale.paymentMethod}</span>
                                            </td>
                                            <td className="px-8 py-5 text-right font-black text-blue-950 text-sm">{formatCurrency(sale.totalValue)}</td>
                                            <td className="px-8 py-5 text-center">
                                                {sale.status !== 'canceled' && (
                                                    <button onClick={() => setShowCancelModal({id: sale.id})} className="p-2 text-gray-300 hover:text-red-600 transition-all"><Ban size={16}/></button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'produtos' && (
                <div className="p-4 md:p-8 space-y-6 animate-in fade-in duration-300 max-w-6xl mx-auto">
                    <div className="bg-white p-8 rounded-[40px] shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between items-center gap-6">
                        <div className="flex items-center gap-4">
                            <div className="p-4 bg-orange-50 text-orange-600 rounded-3xl"><PackagePlus size={32}/></div>
                            <div>
                                <h3 className="text-2xl font-black uppercase italic text-blue-950 tracking-tighter">Gestão de <span className="text-orange-600">Cardápio</span></h3>
                                <p className="text-gray-400 text-[10px] font-black uppercase tracking-widest mt-1">Engenharia de Produto e Receitas</p>
                            </div>
                        </div>
                        <button onClick={() => { setEditingProduct(null); setNewProd({name: '', category: 'Copinho', price: '', flavor: ''}); setTempRecipe([]); setShowProductModal(true); }} className="px-8 py-3 bg-orange-600 text-white rounded-2xl font-black uppercase text-[10px] shadow-lg hover:bg-orange-700 transition-all active:scale-95 border-b-4 border-orange-900 flex items-center gap-2"><Plus size={16}/> Novo Item</button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {filteredItems.map(item => (
                            <div key={item.id} className="bg-white p-6 rounded-[32px] shadow-sm border border-gray-100 flex flex-col group hover:border-blue-600 transition-all">
                                <div className="w-full aspect-square bg-gray-50 rounded-[24px] mb-4 overflow-hidden flex items-center justify-center text-blue-100">
                                    <img src={item.image_url || getCategoryImage(item.category, item.name)} className="w-full h-full object-cover p-2" />
                                </div>
                                <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">{item.category}</h4>
                                <p className="font-black text-blue-950 uppercase italic text-xs mb-1">{item.name}</p>
                                <p className="text-[8px] font-bold text-blue-600 uppercase mb-3">RECEITA: {item.recipe?.length || 0} INSUMOS</p>
                                <div className="flex justify-between items-baseline mt-auto">
                                    <span className="text-xl font-black text-blue-900 italic">{formatCurrency(item.price)}</span>
                                    <div className="flex gap-1">
                                        <button onClick={() => { setEditingProduct(item); setNewProd({name: item.name, category: item.category, price: item.price.toFixed(2).replace('.', ','), flavor: item.flavor || ''}); setTempRecipe(item.recipe || []); setShowProductModal(true); }} className="p-2 bg-gray-50 text-gray-400 hover:text-blue-600 rounded-xl transition-all"><Edit3 size={14}/></button>
                                        <button onClick={async () => { if(window.confirm("Excluir item?")) { await onDeleteItem(item.id); alert("Item removido"); } }} className="p-2 bg-gray-50 text-gray-400 hover:text-red-600 rounded-xl transition-all"><Trash2 size={14}/></button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {activeTab === 'estoque' && (
                <div className="p-4 md:p-8 space-y-6 animate-in fade-in duration-300 max-w-6xl mx-auto">
                    <div className="bg-white p-8 rounded-[40px] shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between items-center gap-6">
                        <div className="flex items-center gap-4">
                            <div className="p-4 bg-orange-50 text-orange-600 rounded-3xl"><Warehouse size={32}/></div>
                            <div>
                                <h3 className="text-2xl font-black uppercase italic text-blue-950 tracking-tighter">Controle de <span className="text-orange-600">Insumos</span></h3>
                                <p className="text-gray-400 text-[10px] font-black uppercase tracking-widest mt-1">Gestão de Saldos, Compras e Inventário</p>
                            </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                             <button onClick={() => setShowNewInsumoModal(true)} className="px-4 py-2 bg-gray-900 text-white rounded-xl font-black uppercase text-[9px] shadow-lg flex items-center gap-2 border-b-2 border-black active:scale-95"><Plus size={14}/> Novo Insumo</button>
                             <button onClick={() => {
                                 setPurchaseForm({}); 
                                 setShowPurchaseModal(true);
                             }} className="px-4 py-2 bg-blue-600 text-white rounded-xl font-black uppercase text-[9px] shadow-lg flex items-center gap-2 border-b-2 border-blue-900 active:scale-95"><Truck size={14}/> Lançar Compra</button>
                             <button onClick={() => { 
                                 const initialInv: Record<string, string> = {};
                                 filteredStock.forEach(s => initialInv[s.id] = s.stock_current.toString());
                                 setInventoryForm(initialInv);
                                 setShowInventoryModal(true); 
                             }} className="px-4 py-2 bg-orange-600 text-white rounded-xl font-black uppercase text-[9px] shadow-lg flex items-center gap-2 border-b-2 border-orange-900 active:scale-95"><PencilLine size={14}/> Inventário</button>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {filteredStock.map(st => (
                            <div key={st.id} className="bg-white p-6 rounded-[32px] shadow-sm border border-gray-100 relative group overflow-hidden">
                                <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity"><Layers size={60}/></div>
                                <div className="flex justify-between items-start mb-4">
                                    <div className={`p-2 rounded-xl text-white ${st.stock_current <= 5 ? 'bg-red-500 animate-pulse' : 'bg-orange-500'}`}><Package size={16}/></div>
                                </div>
                                <h4 className="text-[10px] font-black text-blue-950 uppercase italic leading-none mb-2 truncate pr-4">{st.product_base}</h4>
                                <div className="flex items-baseline gap-1">
                                    <span className={`text-2xl font-black italic tracking-tighter ${st.stock_current <= 5 ? 'text-red-600' : 'text-gray-900'}`}>{st.stock_current}</span>
                                    <span className="text-[8px] font-bold text-gray-400 uppercase tracking-widest">{st.unit}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>

        {/* MODAL: NOVO INSUMO (PRODUTO DE ESTOQUE) */}
        {showNewInsumoModal && (
            <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-[120] p-4">
                <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in duration-300 border-t-8 border-gray-900">
                    <div className="p-8 border-b bg-gray-50 flex justify-between items-center">
                        <h3 className="text-xl font-black text-gray-900 uppercase italic tracking-tighter leading-none">Novo <span className="text-blue-600">Insumo</span></h3>
                        <button onClick={() => setShowNewInsumoModal(false)} className="bg-white p-2 rounded-full text-gray-400 hover:text-red-600 shadow-sm border"><X size={20} /></button>
                    </div>
                    <form onSubmit={handleAddNewInsumo} className="p-8 space-y-6">
                        <div className="space-y-2">
                            <label className="text-[9px] font-black text-gray-400 uppercase ml-2 tracking-widest">Nome do Insumo</label>
                            <input required value={newInsumo.name} onChange={e => setNewInsumo({...newInsumo, name: e.target.value})} className="w-full p-4 bg-gray-50 border-none rounded-2xl font-black text-gray-800 uppercase italic shadow-inner outline-none focus:ring-4 focus:ring-blue-50" placeholder="EX: COPO 300ML" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-[9px] font-black text-gray-400 uppercase ml-2 tracking-widest">Unidade</label>
                                <select value={newInsumo.unit} onChange={e => setNewInsumo({...newInsumo, unit: e.target.value})} className="w-full p-4 bg-gray-50 rounded-2xl font-black uppercase text-xs outline-none">
                                    <option value="un">Unidade</option>
                                    <option value="kg">Quilo</option>
                                    <option value="l">Litro</option>
                                    <option value="cx">Caixa</option>
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[9px] font-black text-gray-400 uppercase ml-2 tracking-widest">Saldo Inicial</label>
                                <input required value={newInsumo.initial} onChange={e => setNewInsumo({...newInsumo, initial: e.target.value})} className="w-full p-4 bg-gray-50 rounded-2xl font-black text-center text-lg outline-none" placeholder="0" />
                            </div>
                        </div>
                        <button type="submit" disabled={isSubmitting} className="w-full py-4 bg-gray-900 text-white rounded-2xl font-black uppercase text-xs shadow-xl active:scale-95 transition-all border-b-4 border-black flex items-center justify-center gap-2">
                            {isSubmitting ? <Loader2 className="animate-spin" /> : <Save size={18}/>} CADASTRAR INSUMO
                        </button>
                    </form>
                </div>
            </div>
        )}

        {/* MODAL: ENTRADA DE COMPRA */}
        {showPurchaseModal && (
            <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-[120] p-4">
                <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in duration-300 border-t-8 border-blue-600 max-h-[90vh] flex flex-col">
                    <div className="p-8 border-b bg-gray-50 flex justify-between items-center shrink-0">
                        <div>
                            <h3 className="text-xl font-black text-gray-900 uppercase italic tracking-tighter leading-none">Entrada de <span className="text-blue-600">Compra em Lote</span></h3>
                            <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mt-1">Informe a quantidade adquirida para cada insumo</p>
                        </div>
                        <button onClick={() => setShowPurchaseModal(false)} className="bg-white p-2 rounded-full text-gray-400 hover:text-red-600 shadow-sm border"><X size={20} /></button>
                    </div>
                    <form onSubmit={handlePurchaseStock} className="flex-1 overflow-y-auto no-scrollbar p-8">
                        <div className="space-y-3">
                            {filteredStock.map(s => (
                                <div key={s.id} className="flex items-center gap-4 p-4 bg-gray-50 rounded-2xl border border-gray-100 group hover:border-blue-200 transition-all">
                                    <div className="flex-1">
                                        <p className="text-[10px] font-black text-blue-950 uppercase italic tracking-tight leading-none mb-1">{s.product_base}</p>
                                        <p className="text-[8px] font-bold text-gray-400 uppercase">Saldo Sistêmico: {s.stock_current} {s.unit}</p>
                                    </div>
                                    <div className="w-32 relative">
                                        <input 
                                            value={purchaseForm[s.id] || ''} 
                                            onChange={e => setPurchaseForm({...purchaseForm, [s.id]: e.target.value})}
                                            className="w-full p-3 bg-white rounded-xl font-black text-blue-700 shadow-inner outline-none border border-transparent focus:border-blue-500 text-center"
                                            placeholder="+ Qtd"
                                        />
                                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[8px] font-black text-gray-300 uppercase">{s.unit}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </form>
                    <div className="p-8 bg-gray-50 border-t flex justify-center shrink-0">
                        <button type="submit" onClick={handlePurchaseStock} disabled={isSubmitting} className="w-full max-w-sm py-5 bg-blue-600 text-white rounded-[28px] font-black uppercase text-xs shadow-xl active:scale-95 transition-all border-b-4 border-blue-900 flex items-center justify-center gap-3">
                            {isSubmitting ? <Loader2 className="animate-spin" /> : <Truck size={18}/>} EFETIVAR ENTRADA DE NOTA
                        </button>
                    </div>
                </div>
            </div>
        )}

        {/* MODAL: INVENTÁRIO */}
        {showInventoryModal && (
            <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-[120] p-4">
                <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in duration-300 border-t-8 border-orange-600 max-h-[90vh] flex flex-col">
                    <div className="p-8 border-b bg-gray-50 flex justify-between items-center shrink-0">
                        <div>
                            <h3 className="text-xl font-black text-gray-900 uppercase italic tracking-tighter leading-none">Ajuste de <span className="text-orange-600">Inventário</span></h3>
                            <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mt-1">Sincronize o saldo sistêmico com o estoque físico</p>
                        </div>
                        <button onClick={() => setShowInventoryModal(false)} className="bg-white p-2 rounded-full text-gray-400 hover:text-red-600 shadow-sm border"><X size={20} /></button>
                    </div>
                    <form onSubmit={handleInventoryAdjustment} className="flex-1 overflow-y-auto no-scrollbar p-8">
                        <div className="space-y-3">
                            {filteredStock.map(s => (
                                <div key={s.id} className="flex items-center gap-4 p-4 bg-gray-50 rounded-2xl border border-gray-100 group hover:border-orange-200 transition-all">
                                    <div className="flex-1">
                                        <p className="text-[10px] font-black text-blue-950 uppercase italic tracking-tight leading-none mb-1">{s.product_base}</p>
                                        <p className="text-[8px] font-bold text-gray-400 uppercase">Saldo Atual: {s.stock_current} {s.unit}</p>
                                    </div>
                                    <div className="w-32 relative">
                                        <input 
                                            value={inventoryForm[s.id] || ''} 
                                            onChange={e => setInventoryForm({...inventoryForm, [s.id]: e.target.value})}
                                            className="w-full p-3 bg-white rounded-xl font-black text-orange-700 shadow-inner outline-none border border-transparent focus:border-orange-500 text-center"
                                            placeholder="Nova Qtd"
                                        />
                                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[8px] font-black text-gray-300 uppercase">{s.unit}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </form>
                    <div className="p-8 bg-gray-50 border-t flex justify-center shrink-0">
                        <button type="submit" onClick={handleInventoryAdjustment} disabled={isSubmitting} className="w-full max-w-sm py-5 bg-orange-600 text-white rounded-[28px] font-black uppercase text-xs shadow-xl active:scale-95 transition-all border-b-4 border-orange-900 flex items-center justify-center gap-3">
                            {isSubmitting ? <Loader2 className="animate-spin" /> : <Save size={18}/>} ATUALIZAR ESTOQUE FÍSICO
                        </button>
                    </div>
                </div>
            </div>
        )}

        {/* MODAL: PRODUTO */}
        {showProductModal && (
            <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-[120] p-4">
                <div className="bg-white rounded-[48px] shadow-2xl w-full max-w-4xl overflow-hidden animate-in zoom-in duration-300 border-t-8 border-orange-600 max-h-[90vh] flex flex-col">
                    <div className="p-8 bg-gray-50 border-b flex justify-between items-center shrink-0">
                        <h3 className="text-2xl font-black text-gray-900 uppercase italic tracking-tighter leading-none">{editingProduct ? 'Editar' : 'Novo'} <span className="text-orange-600">Produto</span></h3>
                        <button onClick={() => setShowProductModal(false)} className="bg-white p-2 rounded-full text-gray-400 hover:text-red-600 shadow-sm border"><X size={20} /></button>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto no-scrollbar p-10">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                            <div className="space-y-6">
                                <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest border-b pb-2">Dados Básicos</h4>
                                <div className="space-y-4">
                                    <div className="space-y-1">
                                        <label className="text-[9px] font-black text-gray-400 uppercase ml-2">Nome do Produto</label>
                                        <input required value={newProd.name} onChange={e => setNewProd({...newProd, name: e.target.value})} className="w-full p-4 bg-gray-50 border-none rounded-2xl font-black text-gray-800 uppercase italic outline-none focus:ring-4 focus:ring-orange-50 transition-all" />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1">
                                            <label className="text-[9px] font-black text-gray-400 uppercase ml-2">Categoria</label>
                                            <select value={newProd.category} onChange={e => setNewProd({...newProd, category: e.target.value as any})} className="w-full p-4 bg-gray-50 rounded-2xl font-black uppercase text-xs outline-none">
                                                {PRODUCT_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                                            </select>
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[9px] font-black text-gray-400 uppercase ml-2">Preço (R$)</label>
                                            <input required value={newProd.price} onChange={e => setNewProd({...newProd, price: e.target.value})} className="w-full p-4 bg-orange-50 border-none rounded-2xl font-black text-orange-700 outline-none text-center text-xl shadow-inner" placeholder="0,00" />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-6">
                                <h4 className="text-[10px] font-black text-blue-600 uppercase tracking-widest border-b pb-2">Engenharia de Receita (Baixa de Insumos)</h4>
                                <div className="bg-blue-50 p-6 rounded-[32px] border border-blue-100 space-y-4">
                                    <div className="flex gap-2">
                                        <select 
                                            value={newRecipeItem.stock_base_name} 
                                            onChange={e => setNewRecipeItem({...newRecipeItem, stock_base_name: e.target.value})} 
                                            className="flex-1 p-3 bg-white border border-blue-100 rounded-xl text-[10px] font-black uppercase outline-none"
                                        >
                                            <option value="">Escolher Insumo...</option>
                                            {filteredStock.map(st => <option key={st.id} value={st.product_base}>{st.product_base}</option>)}
                                        </select>
                                        <input 
                                            value={newRecipeItem.quantity} 
                                            onChange={e => setNewRecipeItem({...newRecipeItem, quantity: e.target.value})} 
                                            className="w-20 p-3 bg-white border border-blue-100 rounded-xl text-center font-black outline-none" 
                                            placeholder="Qtd" 
                                        />
                                        <button type="button" onClick={handleAddRecipeItem} className="p-3 bg-blue-600 text-white rounded-xl shadow-lg hover:bg-blue-700"><Plus size={16}/></button>
                                    </div>

                                    <div className="space-y-2 max-h-40 overflow-y-auto no-scrollbar">
                                        {tempRecipe.map((item, i) => (
                                            <div key={i} className="flex justify-between items-center bg-white p-3 rounded-xl border border-blue-50 shadow-sm">
                                                <span className="text-[10px] font-black text-gray-900 uppercase italic">{item.stock_base_name}</span>
                                                <div className="flex items-center gap-3">
                                                    <span className="text-[10px] font-black text-blue-600">{item.quantity} un/venda</span>
                                                    <button type="button" onClick={() => setTempRecipe(tempRecipe.filter((_, idx) => idx !== i))} className="text-red-300 hover:text-red-600"><Trash2 size={14}/></button>
                                                </div>
                                            </div>
                                        ))}
                                        {tempRecipe.length === 0 && (
                                            <p className="text-[9px] text-center text-gray-400 italic py-4">Nenhum insumo vinculado a este produto.</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="p-8 bg-gray-50 border-t flex justify-center shrink-0">
                        <button onClick={handleSaveProductForm} disabled={isSubmitting} className="w-full max-w-sm py-5 bg-gray-950 text-white rounded-[28px] font-black uppercase text-xs shadow-xl active:scale-95 transition-all border-b-4 border-orange-600 flex items-center justify-center gap-2">
                            {isSubmitting ? <Loader2 className="animate-spin" /> : <Save size={18}/>} SALVAR PRODUTO E RECEITA
                        </button>
                    </div>
                </div>
            </div>
        )}

        {/* MODAL: SÓCIOS */}
        {showPartnersModal && (
            <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-[120] p-4">
                <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in duration-300">
                    <div className="p-8 border-b bg-gray-50 flex justify-between items-center">
                        <h3 className="text-xl font-black text-blue-950 uppercase italic tracking-tighter">Gestão de <span className="text-purple-600">Sócios</span></h3>
                        <button onClick={() => setShowPartnersModal(false)} className="p-2 text-gray-400 hover:text-red-600"><X size={20}/></button>
                    </div>
                    <div className="p-8 space-y-6">
                        <div className="space-y-4">
                            {partners.map(p => (
                                <div key={p.id} className="flex justify-between items-center p-4 bg-gray-50 rounded-2xl">
                                    <span className="font-black uppercase text-xs text-blue-900">{p.partner_name}</span>
                                    <div className="flex items-center gap-3">
                                        <span className="font-bold text-gray-400 text-xs">{p.percentage}%</span>
                                        <button onClick={async () => { await supabase.from('store_profit_distribution').delete().eq('id', p.id); fetchPartners(); }} className="text-red-300 hover:text-red-600"><Trash2 size={16}/></button>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="pt-6 border-t space-y-4">
                             <input value={newPartner.name} onChange={e => setNewPartner({...newPartner, name: e.target.value})} placeholder="NOME DO SÓCIO" className="w-full p-3 bg-gray-50 rounded-xl font-black uppercase text-[10px] outline-none border focus:border-purple-600" />
                             <input value={newPartner.percentage} onChange={e => setNewPartner({...newPartner, percentage: e.target.value})} placeholder="PORCENTAGEM (%)" className="w-full p-3 bg-gray-50 rounded-xl font-black uppercase text-[10px] outline-none border focus:border-purple-600" />
                             <button onClick={() => handleAddPartner()} className="w-full py-3 bg-purple-600 text-white rounded-xl font-black uppercase text-[10px] shadow-lg active:scale-95">Adicionar Sócio</button>
                        </div>
                    </div>
                </div>
            </div>
        )}

        {/* Modal de Cancelamento */}
        {showCancelModal && (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[130] p-4">
                <div className="bg-white rounded-[40px] p-10 max-w-sm w-full text-center shadow-2xl animate-in zoom-in duration-200">
                    <div className="p-5 bg-red-50 text-red-600 rounded-full w-fit mx-auto mb-6"><AlertTriangle size={48} /></div>
                    <h3 className="text-2xl font-black text-gray-900 uppercase italic mb-2 tracking-tighter">Estornar <span className="text-red-600">Venda?</span></h3>
                    <p className="text-gray-400 text-xs font-bold uppercase mb-8">Esta ação irá remover permanentemente a entrada de caixa.</p>
                    <div className="space-y-4">
                        <div className="flex gap-3">
                            <button onClick={() => setShowCancelModal(null)} className="flex-1 py-4 bg-gray-100 text-gray-500 rounded-2xl font-black uppercase text-[10px]">Voltar</button>
                            <button onClick={handleCancelSale} disabled={isSubmitting} className="flex-1 py-4 bg-red-600 text-white rounded-2xl font-black uppercase text-[10px] shadow-lg active:scale-95 disabled:opacity-30">Confirmar Exclusão</button>
                        </div>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};

export default IceCreamModule;
