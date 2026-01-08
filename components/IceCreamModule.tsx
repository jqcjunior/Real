
import React, { useState, useMemo, useEffect } from 'react';
import { IceCreamItem, IceCreamDailySale, IceCreamTransaction, IceCreamCategory, IceCreamExpenseCategory, IceCreamPaymentMethod, User, UserRole, Store, StoreProfitPartner, IceCreamStock } from '../types';
import { formatCurrency } from '../constants';
import { 
    IceCream, Plus, DollarSign, Save, Trash2, X, Calculator, Edit3, Package, 
    Loader2, ShoppingCart, CheckCircle2, Hash, CreditCard, 
    Banknote, Users, Search, Filter, Calendar, TrendingUp, TrendingDown, ChevronRight, Printer, ArrowDownCircle, ArrowUpCircle, FileText, List, PieChart, Ticket, Ban, Info, Boxes, AlertTriangle, RefreshCw, BarChart3, ChevronLeft, CalendarDays, Wallet, Briefcase, Store as StoreIcon, UserCheck, Target
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
  onUpdateStock: (storeId: string, base: string, initial: number, current: number, unit: string) => Promise<void>;
  onAddProfitPartner: (p: Partial<StoreProfitPartner>) => Promise<void>;
  onUpdateProfitPartner: (p: StoreProfitPartner) => Promise<void>;
  onDeleteProfitPartner: (id: string) => Promise<void>;
}

const PRODUCT_CATEGORIES: IceCreamCategory[] = ['Sundae', 'Milkshake', 'Casquinha', 'Cascão', 'Bebidas', 'Adicionais'].sort() as IceCreamCategory[];
const EXPENSE_CATEGORIES: IceCreamExpenseCategory[] = ['Vale Funcionário', 'Pagamento Funcionário', 'Fornecedor', 'Material/Consumo', 'Aluguel', 'Energia', 'Outros'];

const MONTHS = [
  { value: '01', label: 'Janeiro' }, { value: '02', label: 'Fevereiro' }, { value: '03', label: 'Março' },
  { value: '04', label: 'Abril' }, { value: '05', label: 'Maio' }, { value: '06', label: 'Junho' },
  { value: '07', label: 'Julho' }, { value: '08', label: 'Agosto' }, { value: '09', label: 'Setembro' },
  { value: '10', label: 'Outubro' }, { value: '11', label: 'Novembro' }, { value: '12', label: 'Dezembro' }
];

const IceCreamModule: React.FC<IceCreamModuleProps> = ({ 
    initialTab, user, stores, items, stock, sales, finances, profitPartners, onAddSales, onCancelSale, onUpdateItem, onAddTransaction, onDeleteTransaction, onAddItem, onDeleteItem, onUpdateStock, onAddProfitPartner, onUpdateProfitPartner, onDeleteProfitPartner
}) => {
  const isAdmin = user.role === UserRole.ADMIN;
  const [adminStoreId, setAdminStoreId] = useState<string>(user.storeId || (stores.length > 0 ? stores[0].id : ''));
  const effectiveStoreId = isAdmin ? adminStoreId : user.storeId!;

  const [activeTab, setActiveTab] = useState(initialTab || 'vendas');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const todayKey = new Date().toISOString().split('T')[0];
  const [monthlyFilterMonth, setMonthlyFilterMonth] = useState(String(new Date().getMonth() + 1).padStart(2, '0'));
  const [monthlyFilterYear, setMonthlyFilterYear] = useState(String(new Date().getFullYear()));

  // Filtragem RIGOROSA
  const filteredItems = useMemo(() => items.filter(i => i.storeId === effectiveStoreId), [items, effectiveStoreId]);
  const filteredStock = useMemo(() => stock.filter(s => s.store_id === effectiveStoreId), [stock, effectiveStoreId]);
  const filteredSales = useMemo(() => sales.filter(s => s.storeId === effectiveStoreId), [sales, effectiveStoreId]);
  const filteredExits = useMemo(() => finances.filter(f => f.storeId === effectiveStoreId), [finances, effectiveStoreId]);

  // PDV States
  const [selectedCategory, setSelectedCategory] = useState<IceCreamCategory | null>(null);
  const [selectedItem, setSelectedItem] = useState<IceCreamItem | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [paymentMethod, setPaymentMethod] = useState<IceCreamPaymentMethod | null>(null);
  const [cart, setCart] = useState<IceCreamDailySale[]>([]);

  // Modais
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [isStockModalOpen, setIsStockModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<IceCreamItem | null>(null);
  const [stockForm, setStockForm] = useState({ product_base: 'Casquinha', initial: '', current: '', unit: 'un' });
  const [productForm, setProductForm] = useState({ name: '', category: 'Casquinha' as IceCreamCategory, price: '', flavor: '', consumption: '1' });
  const [financeForm, setFinanceForm] = useState({ date: todayKey, category: 'Material/Consumo', value: '', employee: '', description: '' });

  const dailySummaryData = useMemo(() => {
    const daySales = filteredSales.filter(s => s.createdAt?.startsWith(todayKey) && s.status !== 'canceled');
    const totalEntries = daySales.reduce((acc, s) => acc + s.totalValue, 0);
    const totalExits = filteredExits.filter(f => f.date === todayKey && f.type === 'exit').reduce((acc, f) => acc + f.value, 0);
    return { totalEntries, totalExits, result: totalEntries - totalExits, allDaySales: filteredSales.filter(s => s.createdAt?.startsWith(todayKey)) };
  }, [filteredSales, filteredExits, todayKey]);

  const handleFinalizeSale = async () => {
      if (!paymentMethod) return alert("Escolha o pagamento");
      setIsSubmitting(true);
      try {
          const finalCart = cart.map(i => ({ ...i, paymentMethod: paymentMethod!, storeId: effectiveStoreId }));
          await onAddSales(finalCart);
          setCart([]); alert("Venda realizada!");
      } finally { setIsSubmitting(false); }
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
      e.preventDefault();
      setIsSubmitting(true);
      try {
          if (editingItem) { await onUpdateItem({ ...editingItem, name: productForm.name, price: Number(productForm.price), flavor: productForm.flavor }); }
          else { await onAddItem(productForm.name, productForm.category, Number(productForm.price), productForm.flavor, 0, 'un', Number(productForm.consumption), effectiveStoreId); }
          setIsProductModalOpen(false);
      } finally { setIsSubmitting(false); }
  };

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-[1600px] mx-auto min-h-full bg-gray-50 pb-20">
      
      {/* SELETOR ADMIN */}
      {isAdmin && (
        <div className="bg-blue-950 p-6 rounded-[32px] text-white shadow-2xl flex flex-col md:flex-row items-center justify-between gap-4 border-b-4 border-blue-900 animate-in slide-in-from-top duration-300">
            <div className="flex items-center gap-4"><div className="p-3 bg-white/10 rounded-2xl"><StoreIcon size={28}/></div><div><h3 className="text-xl font-black uppercase italic tracking-tighter">Filtro <span className="text-blue-400">Unidade</span></h3><p className="text-[10px] font-bold text-blue-300 uppercase tracking-widest">Navegue pelos dados de qualquer loja</p></div></div>
            <select value={adminStoreId} onChange={e => setAdminStoreId(e.target.value)} className="w-full md:w-80 bg-white/10 border-none rounded-2xl px-6 py-4 font-black text-xs uppercase text-white outline-none focus:ring-4 focus:ring-blue-500/30 cursor-pointer shadow-inner appearance-none">
                {stores.map(s => <option key={s.id} value={s.id} className="bg-blue-950">{s.number} - {s.name}</option>)}
            </select>
        </div>
      )}

      {/* TABS */}
      <div className="flex flex-col lg:flex-row justify-between items-center gap-4 bg-white p-4 rounded-[32px] shadow-sm border border-gray-100">
        <div className="flex items-center gap-3"><div className="p-3 bg-gradient-to-br from-blue-700 to-blue-900 rounded-2xl text-white"><IceCream size={20} /></div><h2 className="text-xl font-black text-gray-900 uppercase italic tracking-tighter">GELATERIA <span className="text-red-600">MODAL</span></h2></div>
        <div className="flex bg-gray-100 p-1 rounded-2xl overflow-x-auto no-scrollbar shadow-inner w-full lg:w-auto">
          {[
              {id:'vendas',label:'PDV',icon:ShoppingCart, show: true},
              {id:'estoque',label:'Estoque',icon:Boxes, show: true},
              {id:'dre_diario',label:'DRE Diário',icon:FileText, show: true},
              {id:'dre_mensal',label:'DRE Mensal',icon:BarChart3, show: isAdmin || user.role === UserRole.MANAGER},
              {id:'financeiro',label:'Saídas',icon:ArrowDownCircle, show: true},
              {id:'products',label:'Produtos',icon:Package, show: isAdmin || user.role === UserRole.MANAGER},
              {id:'partners',label:'Sócios',icon:Users, show: isAdmin}
          ].filter(t => t.show).map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`flex-1 lg:flex-none flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${activeTab === tab.id ? 'bg-white text-blue-700 shadow-md scale-105' : 'text-gray-500 hover:text-gray-700'}`}>
                <tab.icon size={14}/> <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* PDV */}
      {activeTab === 'vendas' && (
          <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 animate-in fade-in duration-500">
              <div className="xl:col-span-3 space-y-6">
                  <div className="bg-white p-4 rounded-[24px] shadow-sm flex gap-2 overflow-x-auto no-scrollbar">
                      {PRODUCT_CATEGORIES.map(cat => (
                          <button key={cat} onClick={() => { setSelectedCategory(cat); setSelectedItem(null); }} className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest border-2 whitespace-nowrap ${selectedCategory === cat ? 'bg-blue-600 border-blue-600 text-white shadow-lg' : 'bg-white border-gray-100 text-blue-600'}`}>{cat}</button>
                      ))}
                  </div>
                  {selectedCategory && (
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          {filteredItems.filter(i => i.category === selectedCategory && i.active).map(item => (
                              <button key={item.id} onClick={() => setSelectedItem(item)} className={`p-8 rounded-[32px] border-2 text-left transition-all flex flex-col justify-between h-48 ${selectedItem?.id === item.id ? 'bg-blue-50 border-blue-600 ring-4 ring-blue-500/10' : 'bg-white border-gray-100 hover:border-blue-200'}`}>
                                  <div>
                                      <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-2">{item.flavor || 'Padrão'}</p>
                                      <h4 className="font-black text-gray-900 uppercase italic leading-tight text-sm">{item.name}</h4>
                                  </div>
                                  <p className="text-xl font-black text-blue-900">{formatCurrency(item.price)}</p>
                              </button>
                          ))}
                      </div>
                  )}
                  {selectedItem && (
                      <div className="bg-white p-8 rounded-[40px] shadow-xl flex items-center gap-8 border-t-8 border-blue-600 animate-in slide-in-from-bottom-4">
                           <div className="flex items-center gap-4 bg-gray-100 p-2 rounded-2xl shadow-inner">
                               <button onClick={() => setQuantity(Math.max(1, quantity - 1))} className="w-12 h-12 bg-white rounded-xl font-black text-xl shadow-sm">-</button>
                               <span className="text-2xl font-black w-10 text-center">{quantity}</span>
                               <button onClick={() => setQuantity(quantity + 1)} className="w-12 h-12 bg-white rounded-xl font-black text-xl shadow-sm">+</button>
                           </div>
                           <button onClick={() => {
                               const ni: IceCreamDailySale = { id: `cart-${Date.now()}`, storeId: effectiveStoreId, itemId: selectedItem.id, productName: selectedItem.name, category: selectedItem.category, flavor: selectedItem.flavor || 'Padrão', unitsSold: quantity, unitPrice: selectedItem.price, totalValue: selectedItem.price * quantity, paymentMethod: 'Pix', status: 'active' };
                               setCart([...cart, ni]); setSelectedItem(null); setQuantity(1);
                           }} className="bg-red-600 text-white px-10 py-5 rounded-2xl font-black uppercase text-xs shadow-2xl flex items-center gap-3 active:scale-95 transition-all"><Plus size={20}/> Adicionar ao Carrinho</button>
                      </div>
                  )}
              </div>
              
              <div className="bg-gray-900 rounded-[40px] p-8 text-white shadow-2xl flex flex-col h-fit sticky top-6 border-b-8 border-red-700">
                  <h3 className="text-xl font-black uppercase italic tracking-tighter mb-8 text-center border-b border-white/10 pb-4">Venda Atual</h3>
                  <div className="space-y-4 mb-8 max-h-[300px] overflow-y-auto no-scrollbar">
                      {cart.map((item, idx) => (
                          <div key={item.id} className="flex items-center justify-between bg-white/5 p-4 rounded-2xl border border-white/5 group">
                              <div className="flex-1"><p className="text-[9px] font-black text-red-500 uppercase">{item.productName}</p><p className="text-[10px] font-bold text-gray-400">{item.unitsSold}x {formatCurrency(item.unitPrice)}</p></div>
                              <button onClick={() => setCart(cart.filter((_, i) => i !== idx))} className="p-2 text-gray-600 hover:text-red-500 transition-colors"><Trash2 size={16}/></button>
                          </div>
                      ))}
                      {cart.length === 0 && <p className="text-center py-20 opacity-20 text-[9px] font-black uppercase tracking-widest">Aguardando Itens...</p>}
                  </div>
                  {cart.length > 0 && (
                    <div className="pt-6 border-t border-white/10 space-y-6">
                        <div className="grid grid-cols-3 gap-2">
                            {(['Pix', 'Cartão', 'Dinheiro'] as IceCreamPaymentMethod[]).map(pm => (
                                <button key={pm} onClick={() => setPaymentMethod(pm)} className={`py-3 rounded-xl border-2 transition-all ${paymentMethod === pm ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white/5 border-white/10 text-gray-500'}`}><span className="text-[8px] font-black uppercase">{pm}</span></button>
                            ))}
                        </div>
                        <div className="flex justify-between items-end"><span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Total</span><span className="text-3xl font-black italic tracking-tighter">{formatCurrency(cart.reduce((a, b) => a + b.totalValue, 0))}</span></div>
                        <button onClick={handleFinalizeSale} disabled={isSubmitting} className="w-full py-5 bg-red-600 rounded-2xl font-black uppercase text-xs shadow-2xl flex items-center justify-center gap-3 active:scale-95 border-b-4 border-red-900">{isSubmitting ? <Loader2 className="animate-spin" size={18}/> : <CheckCircle2 size={18}/>} Finalizar Transação</button>
                    </div>
                  )}
              </div>
          </div>
      )}

      {/* ESTOQUE BASE */}
      {activeTab === 'estoque' && (
          <div className="space-y-6 animate-in fade-in duration-500">
              <div className="flex justify-between items-center bg-white p-8 rounded-[40px] shadow-sm border border-gray-100">
                  <div>
                      <h3 className="text-xl font-black uppercase italic tracking-tighter">Controle de <span className="text-blue-600">Estoque Base</span></h3>
                      <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">Saldos compartilhados entre sabores</p>
                  </div>
                  <button onClick={() => { setStockForm({ product_base: 'Casquinha', initial: '', current: '', unit: 'un' }); setIsStockModalOpen(true); }} className="px-8 py-4 bg-gray-950 text-white rounded-xl font-black uppercase text-[10px] flex items-center gap-2 hover:bg-black shadow-lg"><Plus size={16}/> Lançar Estoque</button>
              </div>
              <div className="bg-white rounded-[40px] shadow-sm border border-gray-100 overflow-hidden">
                  <table className="w-full text-left">
                      <thead>
                          <tr className="bg-white border-b border-gray-100 text-[9px] font-black text-gray-400 uppercase tracking-widest"><th className="px-8 py-5">Base / Categoria</th><th className="px-8 py-5 text-center">Inicial</th><th className="px-8 py-5 text-center">Saldo Real</th><th className="px-8 py-5 text-center">Status</th><th className="px-8 py-5 text-right">Ações</th></tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                          {filteredStock.map(st => (
                              <tr key={st.id} className="hover:bg-gray-50 transition-colors group">
                                  <td className="px-8 py-5"><div className="font-black text-gray-900 uppercase italic text-sm">{st.product_base}</div></td>
                                  <td className="px-8 py-5 text-center font-bold text-gray-500">{st.stock_initial} {st.unit}</td>
                                  <td className="px-8 py-5 text-center font-black text-lg text-blue-900">{st.stock_current} {st.unit}</td>
                                  <td className="px-8 py-5 text-center">
                                      {st.stock_current < 10 ? <span className="bg-red-50 text-red-600 px-3 py-1 rounded-full text-[8px] font-black uppercase border border-red-100 animate-pulse">Crítico</span> : <span className="bg-green-50 text-green-600 px-3 py-1 rounded-full text-[8px] font-black uppercase border border-green-100">Seguro</span>}
                                  </td>
                                  <td className="px-8 py-5 text-right">
                                      <button onClick={() => { setStockForm({ product_base: st.product_base, initial: st.stock_initial.toString(), current: st.stock_current.toString(), unit: st.unit }); setIsStockModalOpen(true); }} className="p-3 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-600 hover:text-white transition-all shadow-sm"><RefreshCw size={18}/></button>
                                  </td>
                              </tr>
                          ))}
                          {filteredStock.length === 0 && <tr><td colSpan={5} className="py-20 text-center text-gray-400 font-black uppercase tracking-widest italic opacity-40">Nenhum estoque lançado para esta unidade</td></tr>}
                      </tbody>
                  </table>
              </div>
          </div>
      )}

      {/* CATÁLOGO DE PRODUTOS */}
      {activeTab === 'products' && (
          <div className="space-y-6 animate-in fade-in duration-500">
              <div className="flex justify-between items-center bg-white p-8 rounded-[40px] shadow-sm border border-gray-100">
                  <h3 className="text-xl font-black uppercase italic tracking-tighter">Catálogo de <span className="text-red-600">Produtos Ativos</span></h3>
                  <button onClick={() => { setEditingItem(null); setProductForm({ name: '', category: 'Casquinha', price: '', flavor: '', consumption: '1' }); setIsProductModalOpen(true); }} className="px-8 py-4 bg-gray-950 text-white rounded-xl font-black uppercase text-[10px] flex items-center gap-2 hover:bg-black shadow-lg"><Plus size={16}/> Novo Produto</button>
              </div>
              <div className="bg-white rounded-[40px] shadow-sm border border-gray-100 overflow-hidden">
                  <table className="w-full text-left">
                      <thead>
                          <tr className="bg-white border-b border-gray-100 text-[9px] font-black text-gray-400 uppercase tracking-widest"><th className="px-8 py-5">Identificação</th><th className="px-8 py-5">Base Consumo</th><th className="px-8 py-5 text-center">Preço</th><th className="px-8 py-5 text-center">Status</th><th className="px-8 py-5 text-right">Ações</th></tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                          {filteredItems.map(item => (
                              <tr key={item.id} className={`hover:bg-gray-50 transition-all ${!item.active ? 'opacity-30 grayscale' : ''}`}>
                                  <td className="px-8 py-5"><div className="font-black text-gray-900 uppercase italic text-sm">{item.name}</div><div className="text-[9px] font-bold text-gray-400 uppercase">{item.flavor || 'Padrão'}</div></td>
                                  <td className="px-8 py-5"><span className="px-3 py-1 bg-gray-100 rounded-full text-[9px] font-black uppercase text-gray-500">{item.category}</span></td>
                                  <td className="px-8 py-5 text-center font-black text-blue-900">{formatCurrency(item.price)}</td>
                                  <td className="px-8 py-5 text-center">{item.active ? <span className="text-green-600 font-black text-[9px] uppercase">Ativo</span> : <span className="text-red-400 font-black text-[9px] uppercase">Inativo</span>}</td>
                                  <td className="px-8 py-5 text-right"><div className="flex justify-end gap-2"><button onClick={() => { setEditingItem(item); setProductForm({ name: item.name, category: item.category, price: item.price.toString(), flavor: item.flavor || '', consumption: item.consumptionPerSale.toString() }); setIsProductModalOpen(true); }} className="p-3 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-600 hover:text-white transition-all"><Edit3 size={18}/></button><button onClick={() => onDeleteItem(item.id)} className="p-3 bg-red-50 text-red-400 rounded-xl hover:bg-red-600 hover:text-white transition-all"><Trash2 size={18}/></button></div></td>
                              </tr>
                          ))}
                      </tbody>
                  </table>
              </div>
          </div>
      )}

      {/* MODAL ESTOQUE */}
      {isStockModalOpen && (
          <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-[200] p-4">
              <div className="bg-white rounded-[48px] shadow-2xl w-full max-w-md p-10 animate-in zoom-in duration-300">
                  <div className="flex justify-between items-center mb-8"><h3 className="text-xl font-black text-gray-900 uppercase italic tracking-tighter leading-none">Lançar <span className="text-blue-600">Estoque</span></h3><button onClick={() => setIsStockModalOpen(false)} className="p-2 bg-gray-50 text-gray-400 hover:text-red-600 rounded-full transition-all"><X size={24}/></button></div>
                  <form onSubmit={async (e) => {
                      e.preventDefault();
                      setIsSubmitting(true);
                      try { await onUpdateStock(effectiveStoreId, stockForm.product_base, Number(stockForm.initial), Number(stockForm.current || stockForm.initial), stockForm.unit); setIsStockModalOpen(false); }
                      finally { setIsSubmitting(false); }
                  }} className="space-y-6">
                      <div><label className="text-[10px] font-black text-gray-400 uppercase block mb-1">Base de Consumo</label><select value={stockForm.product_base} onChange={e => setStockForm({...stockForm, product_base: e.target.value})} className="w-full p-4 bg-gray-50 rounded-2xl font-black text-sm outline-none focus:ring-4 focus:ring-blue-100">{PRODUCT_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
                      <div className="grid grid-cols-2 gap-4">
                          <div><label className="text-[10px] font-black text-gray-400 uppercase block mb-1">Estoque Inicial</label><input required type="number" value={stockForm.initial} onChange={e => setStockForm({...stockForm, initial: e.target.value})} className="w-full p-4 bg-gray-900 text-white rounded-2xl font-black text-2xl outline-none" placeholder="0" /></div>
                          <div><label className="text-[10px] font-black text-gray-400 uppercase block mb-1">Unidade</label><input value={stockForm.unit} onChange={e => setStockForm({...stockForm, unit: e.target.value})} className="w-full p-4 bg-gray-50 rounded-2xl font-black text-sm outline-none" placeholder="un, kg, lt" /></div>
                      </div>
                      <button type="submit" disabled={isSubmitting} className="w-full py-5 bg-blue-700 text-white rounded-[24px] font-black uppercase text-xs shadow-2xl flex items-center justify-center gap-3 transition-all active:scale-95 border-b-4 border-blue-900">{isSubmitting ? <Loader2 className="animate-spin" size={18}/> : <Save size={18}/>} Efetivar Lançamento</button>
                  </form>
              </div>
          </div>
      )}

      {/* MODAL PRODUTO */}
      {isProductModalOpen && (
          <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-[200] p-4">
              <div className="bg-white rounded-[48px] shadow-2xl w-full max-w-md p-10 animate-in zoom-in duration-300">
                  <div className="flex justify-between items-center mb-8"><h3 className="text-xl font-black text-gray-900 uppercase italic tracking-tighter leading-none">{editingItem ? 'Editar' : 'Novo'} <span className="text-red-600">Produto</span></h3><button onClick={() => setIsProductModalOpen(false)} className="p-2 bg-gray-50 text-gray-400 hover:text-red-600 rounded-full transition-all"><X size={24}/></button></div>
                  <form onSubmit={handleSaveProduct} className="space-y-6">
                      <div><label className="text-[10px] font-black text-gray-400 uppercase block mb-1">Nome Comercial</label><input required value={productForm.name} onChange={e => setProductForm({...productForm, name: e.target.value.toUpperCase()})} className="w-full p-4 bg-gray-50 rounded-2xl font-black text-sm outline-none focus:ring-4 focus:ring-blue-100" placeholder="EX: CASQUINHA BAUNILHA" /></div>
                      <div className="grid grid-cols-2 gap-4">
                          <div><label className="text-[10px] font-black text-gray-400 uppercase block mb-1">Sabor</label><input value={productForm.flavor} onChange={e => setProductForm({...productForm, flavor: e.target.value.toUpperCase()})} className="w-full p-4 bg-gray-50 rounded-2xl font-black text-sm outline-none" placeholder="OPCIONAL" /></div>
                          <div><label className="text-[10px] font-black text-gray-400 uppercase block mb-1">Preço (R$)</label><input required value={productForm.price} onChange={e => setProductForm({...productForm, price: e.target.value})} className="w-full p-4 bg-gray-900 text-white rounded-2xl font-black text-xl outline-none" placeholder="0,00" /></div>
                      </div>
                      <div><label className="text-[10px] font-black text-gray-400 uppercase block mb-1">Base de Abatimento no Estoque</label><select value={productForm.category} onChange={e => setProductForm({...productForm, category: e.target.value as IceCreamCategory})} className="w-full p-4 bg-blue-50 border-2 border-blue-100 rounded-2xl font-black text-sm outline-none">{PRODUCT_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
                      <button type="submit" disabled={isSubmitting} className="w-full py-5 bg-red-600 text-white rounded-[24px] font-black uppercase text-xs shadow-2xl flex items-center justify-center gap-3 transition-all active:scale-95 border-b-4 border-red-900">{isSubmitting ? <Loader2 className="animate-spin" size={18}/> : <Save size={18}/>} Gravar Produto</button>
                  </form>
              </div>
          </div>
      )}

      {/* DRE DIÁRIO */}
      {activeTab === 'dre_diario' && (
          <div className="space-y-6 animate-in fade-in duration-500">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-white p-8 rounded-[40px] shadow-sm border border-gray-100 flex items-center justify-between"><div><p className="text-[10px] font-black text-gray-400 uppercase mb-1">Entradas (Hoje)</p><p className="text-3xl font-black text-green-600">{formatCurrency(dailySummaryData.totalEntries)}</p></div><div className="p-4 bg-green-50 text-green-600 rounded-3xl"><TrendingUp size={32}/></div></div>
                  <div className="bg-white p-8 rounded-[40px] shadow-sm border border-gray-100 flex items-center justify-between"><div><p className="text-[10px] font-black text-gray-400 uppercase mb-1">Saídas (Hoje)</p><p className="text-3xl font-black text-red-600">{formatCurrency(dailySummaryData.totalExits)}</p></div><div className="p-4 bg-red-50 text-red-600 rounded-3xl"><TrendingDown size={32}/></div></div>
                  <div className="bg-gray-900 p-8 rounded-[40px] shadow-2xl text-white flex items-center justify-between"><div><p className="text-[10px] font-black text-gray-400 uppercase mb-1">Saldo Líquido</p><p className="text-3xl font-black italic">{formatCurrency(dailySummaryData.result)}</p></div><button className="p-4 bg-white/10 text-white rounded-3xl hover:bg-white/20 transition-all"><Printer size={32}/></button></div>
              </div>
              <div className="bg-white rounded-[40px] shadow-sm border border-gray-100 overflow-hidden">
                  <div className="p-8 border-b border-gray-50 flex justify-between items-center bg-gray-50/30"><h3 className="text-sm font-black uppercase tracking-widest">Movimentações <span className="text-blue-600">Reais (Hoje)</span></h3></div>
                  <table className="w-full text-left">
                      <thead><tr className="bg-white text-[9px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100"><th className="px-8 py-4">Horário</th><th className="px-8 py-4">Operação / Produto</th><th className="px-8 py-4 text-center">Tipo</th><th className="px-8 py-4 text-right">Valor</th><th className="px-8 py-4 text-right w-16"></th></tr></thead>
                      <tbody className="divide-y divide-gray-50">
                          {dailySummaryData.allDaySales.map(sale => (
                              <tr key={sale.id} className={`hover:bg-gray-50 transition-colors ${sale.status === 'canceled' ? 'opacity-30' : ''}`}>
                                  <td className="px-8 py-4 text-[10px] font-black text-gray-400">{new Date(sale.createdAt!).toLocaleTimeString('pt-BR')}</td>
                                  <td className="px-8 py-4"><div className="font-black text-gray-800 uppercase italic text-xs">{sale.productName}</div><div className="text-[9px] text-gray-400 font-bold uppercase">{sale.unitsSold}x - {sale.paymentMethod}</div></td>
                                  <td className="px-8 py-4 text-center"><span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-[8px] font-black uppercase">VENDA</span></td>
                                  <td className="px-8 py-4 text-right font-black text-blue-900">{formatCurrency(sale.totalValue)}</td>
                                  <td className="px-8 py-4 text-right">{sale.status === 'active' && <button onClick={() => { const r = prompt("Motivo:"); if(r) onCancelSale(sale.saleCode!, r); }} className="p-2 text-gray-300 hover:text-red-500"><Ban size={16}/></button>}</td>
                              </tr>
                          ))}
                      </tbody>
                  </table>
              </div>
          </div>
      )}

      {/* FOOTER BARRA DE SEGURANÇA */}
      <div className="px-8 py-4 bg-gray-950 text-white flex flex-col sm:flex-row justify-between items-center gap-4 text-[9px] font-black uppercase tracking-widest rounded-[24px] shadow-lg fixed bottom-4 left-4 right-4 md:relative md:bottom-0 md:left-0 md:right-0 z-40">
          <div className="flex items-center gap-8"><span className="flex items-center gap-2 text-blue-500"><Target size={14}/> Persistência SQL Ativa</span><span className="flex items-center gap-2 text-green-500 hidden md:flex"><Target size={14}/> Auditoria AES-256</span></div>
          <div className="flex items-center gap-2 opacity-40 italic">Gelateria v6.0 (Integrated) • Real Admin</div>
      </div>
    </div>
  );
};

export default IceCreamModule;
