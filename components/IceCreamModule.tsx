
import React, { useState, useMemo, useEffect } from 'react';
import { IceCreamItem, IceCreamDailySale, IceCreamTransaction, IceCreamCategory, IceCreamExpenseCategory, IceCreamPaymentMethod, User, UserRole, Store, StoreProfitPartner, IceCreamStock } from '../types';
import { formatCurrency } from '../constants';
import { 
    IceCream, Plus, DollarSign, Save, Trash2, X, Calculator, Edit3, Package, 
    Loader2, ShoppingCart, CheckCircle2, Hash, CreditCard, 
    Banknote, Users, Search, Filter, Calendar, TrendingUp, TrendingDown, ChevronRight, Printer, ArrowDownCircle, ArrowUpCircle, FileText, List, PieChart, Ticket, Ban, Info, Boxes, AlertTriangle, RefreshCw, BarChart3, ChevronLeft, CalendarDays, Wallet, Briefcase, Store as StoreIcon, UserCheck, Target, Factory, Wrench
} from 'lucide-react';

interface IceCreamModuleProps {
  initialTab?: 'vendas' | 'estoque' | 'dre_diario' | 'dre_mensal' | 'financeiro' | 'products' | 'partners';
  user: User;
  stores: Store[];
  items: IceCreamItem[];
  stock: IceCreamStock[];
  sales: IceCreamDailySale[];
  finances: IceCreamTransaction[];
  profitPartners: StoreProfitPartner[];
  onAddSales: (sale: IceCreamDailySale[]) => Promise<void>;
  onCancelSale: (saleCode: string, reason: string) => Promise<void>;
  onUpdatePrice: (id: string, price: number) => Promise<void>;
  onUpdateItem: (item: IceCreamItem) => Promise<void>;
  onAddTransaction: (tx: IceCreamTransaction) => Promise<void>;
  onDeleteTransaction: (id: string) => Promise<void>;
  onAddItem: (name: string, category: string, price: number, flavor?: string, stockInitial?: number, unit?: string, consumptionPerSale?: number, targetStoreId?: string) => Promise<void>;
  onDeleteItem: (id: string) => Promise<void>;
  onUpdateStock: (storeId: string, base: string, value: number, unit: string, type: 'production' | 'adjustment') => Promise<void>;
  onAddProfitPartner: (p: Partial<StoreProfitPartner>) => Promise<void>;
  onUpdateProfitPartner: (p: StoreProfitPartner) => Promise<void>;
  onDeleteProfitPartner: (id: string) => Promise<void>;
}

const PRODUCT_CATEGORIES: IceCreamCategory[] = ['Sundae', 'Milkshake', 'Casquinha', 'Cascão', 'Bebidas', 'Adicionais'].sort() as IceCreamCategory[];

const IceCreamModule: React.FC<IceCreamModuleProps> = ({ 
    initialTab, user, stores, items, stock, sales, finances, profitPartners, onAddSales, onCancelSale, onUpdateItem, onAddTransaction, onDeleteTransaction, onAddItem, onDeleteItem, onUpdateStock, onAddProfitPartner, onUpdateProfitPartner, onDeleteProfitPartner
}) => {
  const isAdmin = user.role === UserRole.ADMIN;
  const isManager = user.role === UserRole.MANAGER;
  const canEditStock = isAdmin || isManager;

  const [adminStoreId, setAdminStoreId] = useState<string>(user.storeId || (stores?.[0]?.id || ''));
  const effectiveStoreId = isAdmin ? adminStoreId : user.storeId!;

  const [activeTab, setActiveTab] = useState(initialTab || 'vendas');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const todayKey = new Date().toISOString().split('T')[0];

  const filteredItems = useMemo(() => (items || []).filter(i => i.storeId === effectiveStoreId), [items, effectiveStoreId]);
  const filteredStock = useMemo(() => (stock || []).filter(s => s.store_id === effectiveStoreId), [stock, effectiveStoreId]);
  const filteredSales = useMemo(() => (sales || []).filter(s => s.storeId === effectiveStoreId), [sales, effectiveStoreId]);
  const filteredExits = useMemo(() => (finances || []).filter(f => f.storeId === effectiveStoreId), [finances, effectiveStoreId]);

  const [selectedCategory, setSelectedCategory] = useState<IceCreamCategory | null>(null);
  const [selectedItem, setSelectedItem] = useState<IceCreamItem | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [paymentMethod, setPaymentMethod] = useState<IceCreamPaymentMethod | null>(null);
  const [cart, setCart] = useState<IceCreamDailySale[]>([]);

  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [isStockModalOpen, setIsStockModalOpen] = useState(false);
  const [stockModalType, setStockModalType] = useState<'production' | 'adjustment'>('production');
  const [stockForm, setStockForm] = useState({ product_base: 'Casquinha', value: '', unit: 'un' });

  const handleFinalizeSale = async () => {
      if (cart.length === 0 || !paymentMethod) return alert("Verifique o carrinho.");
      setIsSubmitting(true);
      try {
          const finalCart = (cart || []).map(i => ({ ...i, paymentMethod: paymentMethod!, storeId: effectiveStoreId }));
          await onAddSales(finalCart);
          setCart([]);
      } catch (e: any) { alert(`ERRO: ${e.message}`); } finally { setIsSubmitting(false); }
  };

  const dailySummaryData = useMemo(() => {
    const daySales = (filteredSales || []).filter(s => s.createdAt?.startsWith(todayKey) && s.status !== 'canceled');
    const totalEntries = daySales.reduce((acc, s) => acc + (Number(s.totalValue) || 0), 0);
    const totalExits = (filteredExits || []).filter(f => f.date === todayKey && f.type === 'exit').reduce((acc, f) => acc + (Number(f.value) || 0), 0);
    return { totalEntries, totalExits, result: totalEntries - totalExits };
  }, [filteredSales, filteredExits, todayKey]);

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-[1600px] mx-auto min-h-full bg-gray-50 pb-20">
      {isAdmin && (
        <div className="bg-blue-950 p-6 rounded-[32px] text-white flex justify-between items-center gap-4">
            <h3 className="font-black uppercase text-xl">Gestão <span className="text-blue-400">Unidade</span></h3>
            <select value={adminStoreId} onChange={e => setAdminStoreId(e.target.value)} className="bg-white/10 rounded-2xl px-6 py-4 font-black outline-none text-white appearance-none">
                {(stores || []).map(s => <option key={s.id} value={s.id} className="bg-blue-950">{s.number} - {s.name}</option>)}
            </select>
        </div>
      )}

      <div className="flex bg-white p-4 rounded-[32px] justify-between items-center shadow-sm">
        <h2 className="font-black text-gray-900 uppercase">GELATERIA</h2>
        <div className="flex bg-gray-100 p-1 rounded-2xl overflow-x-auto no-scrollbar">
           {['vendas', 'estoque', 'dre_diario', 'financeiro'].map(tab => (
               <button key={tab} onClick={() => setActiveTab(tab as any)} className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase transition-all ${activeTab === tab ? 'bg-white text-blue-700 shadow' : 'text-gray-500'}`}>{tab}</button>
           ))}
        </div>
      </div>

      {activeTab === 'vendas' && (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              <div className="lg:col-span-3 space-y-6">
                  <div className="flex gap-2 overflow-x-auto no-scrollbar">
                      {PRODUCT_CATEGORIES.map(cat => (
                          <button key={cat} onClick={() => setSelectedCategory(cat)} className={`px-6 py-3 rounded-xl font-black uppercase text-[10px] border-2 ${selectedCategory === cat ? 'bg-blue-600 text-white' : 'bg-white text-blue-600 border-gray-100'}`}>{cat}</button>
                      ))}
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {(filteredItems || []).filter(i => !selectedCategory || i.category === selectedCategory).map(item => (
                          <button key={item.id} onClick={() => setSelectedItem(item)} className="p-6 bg-white rounded-[32px] border-2 border-gray-100 text-left hover:border-blue-200 transition-all h-40 flex flex-col justify-between">
                              <h4 className="font-black text-gray-900 uppercase text-xs">{item.name}</h4>
                              <p className="font-black text-blue-900">{formatCurrency(item.price)}</p>
                          </button>
                      ))}
                  </div>
              </div>
              <div className="bg-gray-900 rounded-[40px] p-8 text-white">
                  <h3 className="font-black uppercase mb-8 text-center border-b border-white/10 pb-4">Caixa</h3>
                  <div className="space-y-4 mb-8">
                      {(cart || []).map((item, idx) => (
                          <div key={item.id} className="flex justify-between p-2 bg-white/5 rounded-xl text-[10px]">
                              <span>{item.productName} ({item.unitsSold}x)</span>
                              <button onClick={() => setCart(cart.filter((_, i) => i !== idx))}><X size={14} /></button>
                          </div>
                      ))}
                  </div>
                  {cart.length > 0 && (
                      <button onClick={handleFinalizeSale} disabled={isSubmitting || !paymentMethod} className="w-full py-4 bg-red-600 rounded-2xl font-black uppercase">Finalizar</button>
                  )}
              </div>
          </div>
      )}

      {activeTab === 'estoque' && (
          <div className="bg-white rounded-[40px] shadow-sm border border-gray-100 overflow-hidden">
              <table className="w-full text-left">
                  <thead>
                      <tr className="border-b text-[9px] font-black text-gray-400 uppercase">
                          <th className="p-5">Base</th>
                          <th className="p-5 text-center">Saldo</th>
                          <th className="p-5 text-right"></th>
                      </tr>
                  </thead>
                  <tbody>
                      {(filteredStock || []).map(st => (
                          <tr key={st.id} className="border-b">
                              <td className="p-5 font-black uppercase text-xs">{st.product_base}</td>
                              <td className={`p-5 text-center font-black text-lg ${st.stock_current < 0 ? 'text-red-600' : 'text-blue-900'}`}>{st.stock_current}</td>
                              <td className="p-5 text-right">
                                  {canEditStock && <button onClick={() => { setStockForm({ product_base: st.product_base, value: '', unit: st.unit }); setStockModalType('production'); setIsStockModalOpen(true); }} className="p-2 bg-blue-50 text-blue-600 rounded-lg"><Plus size={16}/></button>}
                              </td>
                          </tr>
                      ))}
                  </tbody>
              </table>
          </div>
      )}
    </div>
  );
};

export default IceCreamModule;
