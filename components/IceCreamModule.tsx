
import React, { useState, useMemo, useEffect } from 'react';
import { IceCreamItem, IceCreamDailySale, IceCreamTransaction, IceCreamCategory, IceCreamPaymentMethod, User, UserRole, Store, IceCreamStock, IceCreamPromissoryNote, IceCreamRecipeItem } from '../types';
import { formatCurrency } from '../constants';
import { 
    IceCream, Plus, Package, ShoppingCart, CheckCircle2, 
    Trash2, X, History, PieChart, ArrowDownCircle, ArrowUpCircle, 
    Loader2, Search, Trash, ChevronRight, Calculator, FileText, Ban, UserCheck, Save, Image as ImageIcon, Sliders, Settings, Calendar, BarChart3, ListChecks, TrendingUp, TrendingDown, DollarSign, Wallet, CreditCard, Banknote, PackagePlus
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
  onCancelSale: (saleCode: string, reason: string) => Promise<void>;
  onUpdatePrice: (id: string, price: number) => Promise<void>;
  onAddTransaction: (tx: IceCreamTransaction) => Promise<void>;
  onAddItem: (name: string, category: string, price: number, flavor?: string, stockInitial?: number, unit?: string, consumptionPerSale?: number, targetStoreId?: string, recipe?: IceCreamRecipeItem[]) => Promise<void>;
  onDeleteItem: (id: string) => Promise<void>;
  onUpdateStock: (storeId: string, base: string, value: number, unit: string, type: 'production' | 'adjustment') => Promise<void>;
  liquidatePromissory: (id: string) => Promise<void>;
}

const PRODUCT_CATEGORIES: IceCreamCategory[] = ['Sundae', 'Milkshake', 'Casquinha', 'Cascão', 'Copinho', 'Bebidas', 'Adicionais'].sort() as IceCreamCategory[];

const IceCreamModule: React.FC<IceCreamModuleProps> = ({ 
    user, stores = [], items = [], stock = [], sales = [], finances = [], promissories = [], can,
    onAddSales, onCancelSale, onUpdatePrice, onAddTransaction, onAddItem, onDeleteItem, onUpdateStock,
    liquidatePromissory
}) => {
  const isAdmin = user.role === UserRole.ADMIN;
  const [activeTab, setActiveTab] = useState<'pdv' | 'estoque' | 'dre' | 'audit' | 'config'>('pdv');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cart, setCart] = useState<IceCreamDailySale[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<IceCreamCategory | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<IceCreamPaymentMethod | null>(null);
  const [buyerName, setBuyerName] = useState('');
  const [amountPaid, setAmountPaid] = useState(''); // Para cálculo de troco
  
  const [showProductModal, setShowProductModal] = useState(false);
  const [showTransactionModal, setShowTransactionModal] = useState(false);
  const [showNewStockModal, setShowNewStockModal] = useState(false);
  const [showInwardModal, setShowInwardModal] = useState(false); // Modal de Entrada de Mercadoria
  
  // States para Ficha Técnica (Receita)
  const [newProd, setNewProd] = useState({
      name: '',
      category: 'Copinho' as IceCreamCategory,
      price: '',
      flavor: ''
  });
  const [recipe, setRecipe] = useState<IceCreamRecipeItem[]>([]);
  const [selectedStockBase, setSelectedStockBase] = useState('');
  const [qtyToConsume, setQtyToConsume] = useState('1');

  // State para Novo Insumo de Estoque
  const [newStockItem, setNewStockItem] = useState({
      product_base: '',
      stock_initial: '',
      unit: 'un'
  });

  // State para Entrada de Mercadoria
  const [inwardData, setInwardData] = useState({
      stock_item_id: '',
      quantity: '',
      date: new Date().toISOString().split('T')[0]
  });

  const [txForm, setTxForm] = useState({
      date: new Date().toISOString().split('T')[0],
      category: 'Despesa Operacional',
      value: '',
      description: ''
  });
  
  const effectiveStoreId = user.storeId || (stores.length > 0 ? stores[0].id : '');
  const filteredItems = useMemo(() => (items || []).filter(i => i.storeId === effectiveStoreId), [items, effectiveStoreId]);
  const filteredStock = useMemo(() => (stock || []).filter(s => s.store_id === effectiveStoreId), [stock, effectiveStoreId]);
  const todayKey = new Date().toISOString().split('T')[0];
  const monthKey = todayKey.substring(0, 7);

  // Lógica de Carrinho: Agora insere itens individualmente para facilitar exclusão unitária
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

  const cartTotal = useMemo(() => cart.reduce((a, b) => a + b.totalValue, 0), [cart]);
  const changeDue = useMemo(() => {
      const paid = parseFloat(amountPaid.replace(',', '.')) || 0;
      return Math.max(0, paid - cartTotal);
  }, [amountPaid, cartTotal]);

  const finalizeSale = async () => {
      if (cart.length === 0 || !paymentMethod) return;
      if (paymentMethod === 'Fiado' && !buyerName) { alert("Nome do funcionário obrigatório."); return; }
      
      setIsSubmitting(true);
      try {
          const saleCode = `GEL-${Date.now().toString().slice(-6)}`;
          const salesToSave = cart.map(c => ({ 
              ...c, 
              paymentMethod: paymentMethod!, 
              buyer_name: paymentMethod === 'Fiado' ? buyerName.toUpperCase() : undefined, 
              saleCode 
          }));
          await onAddSales(salesToSave);
          setCart([]); 
          setPaymentMethod(null); 
          setBuyerName(''); 
          setAmountPaid('');
      } catch (e) { 
          alert("Falha ao registrar venda."); 
      } finally { 
          setIsSubmitting(false); 
      }
  };

  const handleCreateStockItem = async (e: React.FormEvent) => {
      e.preventDefault();
      setIsSubmitting(true);
      try {
          const val = parseFloat(newStockItem.stock_initial.replace(',', '.'));
          await onUpdateStock(effectiveStoreId, newStockItem.product_base.toUpperCase(), val, newStockItem.unit, 'adjustment');
          setShowNewStockModal(false);
          setNewStockItem({ product_base: '', stock_initial: '', unit: 'un' });
      } catch (e) {
          alert("Erro ao cadastrar insumo.");
      } finally {
          setIsSubmitting(false);
      }
  };

  const handleInwardEntry = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!inwardData.stock_item_id || !inwardData.quantity) return;
      setIsSubmitting(true);
      try {
          const selectedItem = filteredStock.find(s => s.id === inwardData.stock_item_id);
          if (!selectedItem) throw new Error("Item não encontrado.");

          const qty = parseFloat(inwardData.quantity.replace(',', '.'));
          // Usamos 'production' pois na nossa lógica de App.tsx ele soma ao valor atual
          await onUpdateStock(effectiveStoreId, selectedItem.product_base, qty, selectedItem.unit, 'production');
          
          setShowInwardModal(false);
          setInwardData({ stock_item_id: '', quantity: '', date: new Date().toISOString().split('T')[0] });
          alert("Entrada registrada com sucesso!");
      } catch (e) {
          alert("Erro ao processar entrada.");
      } finally {
          setIsSubmitting(false);
      }
  };

  const addToRecipe = () => {
      if (!selectedStockBase) return;
      setRecipe([...recipe, { stock_base_name: selectedStockBase, quantity: Number(qtyToConsume) }]);
      setSelectedStockBase('');
      setQtyToConsume('1');
  };

  const handleCreateProduct = async (e: React.FormEvent) => {
      e.preventDefault();
      if (recipe.length === 0) { alert("Adicione pelo menos um item à ficha técnica (Copo, casquinha, etc)"); return; }
      setIsSubmitting(true);
      try {
          const priceNum = parseFloat(newProd.price.replace(',', '.'));
          await onAddItem(newProd.name, newProd.category, priceNum, newProd.flavor, 0, 'un', 1, effectiveStoreId, recipe);
          setShowProductModal(false);
          setNewProd({ name: '', category: 'Copinho', price: '', flavor: '' });
          setRecipe([]);
      } catch (e) { alert("Erro ao criar sorvete."); } finally { setIsSubmitting(false); }
  };

  const handleSaveTransaction = async (e: React.FormEvent) => {
      e.preventDefault();
      const val = parseFloat(txForm.value.replace(',', '.'));
      if (isNaN(val) || val <= 0) return;
      setIsSubmitting(true);
      try {
          await onAddTransaction({ id: '', storeId: effectiveStoreId, date: txForm.date, type: 'exit', category: txForm.category, value: val, description: txForm.description, createdAt: new Date() });
          setShowTransactionModal(false);
          setTxForm({ date: new Date().toISOString().split('T')[0], category: 'Despesa Operacional', value: '', description: '' });
      } catch (e) { alert("Erro ao salvar despesa."); } finally { setIsSubmitting(false); }
  };

  const dreStats = useMemo(() => {
      const daySales = (sales || []).filter(s => s.createdAt?.startsWith(todayKey) && s.status !== 'canceled');
      const dayExits = (finances || []).filter(f => f.date === todayKey && f.type === 'exit');
      const monthSales = (sales || []).filter(s => s.createdAt?.startsWith(monthKey) && s.status !== 'canceled');
      const monthExits = (finances || []).filter(f => f.date?.startsWith(monthKey) && f.type === 'exit');

      const byMethod = (list: IceCreamDailySale[]) => {
          return {
              pix: list.filter(s => s.paymentMethod === 'Pix').reduce((a,b) => a + b.totalValue, 0),
              money: list.filter(s => s.paymentMethod === 'Dinheiro').reduce((a,b) => a + b.totalValue, 0),
              card: list.filter(s => s.paymentMethod === 'Cartão').reduce((a,b) => a + b.totalValue, 0),
              fiado: list.filter(s => s.paymentMethod === 'Fiado').reduce((a,b) => a + b.totalValue, 0)
          };
      };

      const byCategory = (list: IceCreamDailySale[]) => {
          const catMap: Record<string, number> = {};
          list.forEach(s => {
              catMap[s.category] = (catMap[s.category] || 0) + s.totalValue;
          });
          return Object.entries(catMap).sort((a,b) => b[1] - a[1]);
      };

      return {
          dayIn: daySales.reduce((a,b) => a + b.totalValue, 0),
          dayOut: dayExits.reduce((a,b) => a + b.value, 0),
          dayMethods: byMethod(daySales),
          dayCats: byCategory(daySales),
          monthIn: monthSales.reduce((a,b) => a + b.totalValue, 0),
          monthOut: monthExits.reduce((a,b) => a + b.value, 0)
      };
  }, [sales, finances, todayKey, monthKey]);

  return (
    <div className="flex flex-col h-full bg-gray-50 overflow-hidden font-sans relative">
        <div className="bg-white border-b px-4 md:px-8 py-3 flex flex-col md:flex-row justify-between items-center gap-4 z-40 shadow-sm">
            <div className="flex items-center gap-3 w-full md:w-auto">
                <div className="p-2 md:p-2.5 bg-blue-900 rounded-2xl text-white shadow-lg shrink-0"><IceCream size={20} className="md:w-6 md:h-6"/></div>
                <div className="truncate">
                    <h2 className="text-base md:text-lg font-black uppercase italic tracking-tighter text-blue-950 leading-none">Gelateria <span className="text-red-600">Real</span></h2>
                    <p className="text-[7px] md:text-[8px] font-black text-gray-400 uppercase tracking-widest mt-1">Unidade {stores.find(s => s.id === effectiveStoreId)?.number}</p>
                </div>
            </div>

            <div className="flex bg-gray-100 p-1 rounded-2xl overflow-x-auto no-scrollbar w-full md:w-auto max-w-full">
                <button onClick={() => setActiveTab('pdv')} className={`flex-1 md:flex-none px-4 py-2 rounded-xl text-[9px] font-black uppercase transition-all flex items-center justify-center gap-2 whitespace-nowrap ${activeTab === 'pdv' ? 'bg-white text-blue-700 shadow-md' : 'text-gray-500'}`}><ShoppingCart size={14}/> PDV</button>
                <button onClick={() => setActiveTab('estoque')} className={`flex-1 md:flex-none px-4 py-2 rounded-xl text-[9px] font-black uppercase transition-all flex items-center justify-center gap-2 whitespace-nowrap ${activeTab === 'estoque' ? 'bg-white text-blue-700 shadow-md' : 'text-gray-500'}`}><Package size={14}/> Estoque</button>
                <button onClick={() => setActiveTab('dre')} className={`flex-1 md:flex-none px-4 py-2 rounded-xl text-[9px] font-black uppercase transition-all flex items-center justify-center gap-2 whitespace-nowrap ${activeTab === 'dre' ? 'bg-white text-blue-700 shadow-md' : 'text-gray-500'}`}><PieChart size={14}/> DRE</button>
                <button onClick={() => setActiveTab('audit')} className={`flex-1 md:flex-none px-4 py-2 rounded-xl text-[9px] font-black uppercase transition-all flex items-center justify-center gap-2 whitespace-nowrap ${activeTab === 'audit' ? 'bg-white text-blue-700 shadow-md' : 'text-gray-500'}`}><History size={14}/> Auditoria</button>
                <button onClick={() => setActiveTab('config')} className={`flex-1 md:flex-none px-4 py-2 rounded-xl text-[9px] font-black uppercase transition-all flex items-center justify-center gap-2 whitespace-nowrap ${activeTab === 'config' ? 'bg-white text-blue-700 shadow-md' : 'text-gray-500'}`}><Settings size={14}/> Config</button>
            </div>
        </div>

        <div className="flex-1 overflow-y-auto no-scrollbar p-4 md:p-8 pb-24 md:pb-8">
            {activeTab === 'pdv' && (
                <div className="hidden lg:grid grid-cols-12 gap-8 max-w-[1500px] mx-auto h-full">
                    <div className="col-span-8 space-y-6">
                        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
                            <button onClick={() => setSelectedCategory(null)} className={`px-5 py-2.5 rounded-xl font-black uppercase text-[10px] border-2 transition-all ${!selectedCategory ? 'bg-blue-900 text-white border-blue-900 shadow-lg' : 'bg-white text-gray-400 border-gray-100'}`}>Tudo</button>
                            {PRODUCT_CATEGORIES.map(cat => (
                                <button key={cat} onClick={() => setSelectedCategory(cat)} className={`px-5 py-2.5 rounded-xl font-black uppercase text-[10px] border-2 transition-all whitespace-nowrap ${selectedCategory === cat ? 'bg-blue-900 text-white border-blue-900 shadow-lg' : 'bg-white text-gray-400 border-gray-100'}`}>{cat}</button>
                            ))}
                        </div>
                        <div className="grid grid-cols-3 xl:grid-cols-4 gap-4 overflow-y-auto no-scrollbar pr-2 max-h-[75vh]">
                            {filteredItems.filter(i => (!selectedCategory || i.category === selectedCategory) && i.active).map(item => (
                                <button key={item.id} onClick={() => handleAddToCart(item)} className="bg-white p-4 rounded-[32px] border-2 border-gray-100 hover:border-blue-600 transition-all flex flex-col items-center text-center group shadow-sm">
                                    <div className="w-full aspect-square bg-gray-50 rounded-[24px] mb-3 flex items-center justify-center text-blue-100 group-hover:scale-105 transition-transform overflow-hidden">
                                        {item.image_url ? <img src={item.image_url} className="w-full h-full object-cover" /> : <IceCream size={40} />}
                                    </div>
                                    <h4 className="font-black text-gray-900 uppercase text-[10px] truncate w-full">{item.name}</h4>
                                    <p className="text-lg font-black text-blue-900 mt-1 italic">{formatCurrency(item.price)}</p>
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="col-span-4 bg-white rounded-[40px] shadow-2xl border border-gray-100 p-8 flex flex-col h-fit sticky top-0">
                        <h3 className="text-lg font-black uppercase italic mb-6 flex items-center gap-3 border-b pb-4"><ShoppingCart className="text-red-600" size={20} /> Carrinho <span className="text-gray-300 ml-auto font-bold text-xs">{cart.length} ITENS</span></h3>
                        <div className="flex-1 overflow-y-auto max-h-[300px] mb-6 space-y-2 no-scrollbar">
                            {cart.map((c, i) => (
                                <div key={c.id} className="flex justify-between items-center p-4 bg-gray-50 rounded-2xl border border-gray-100 animate-in slide-in-from-right duration-200">
                                    <div className="flex-1 min-w-0 pr-4">
                                        <p className="font-black text-gray-900 uppercase text-[10px] truncate">{c.productName}</p>
                                        <p className="text-[9px] text-gray-400 font-bold uppercase">{formatCurrency(c.unitPrice)}</p>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className="font-black text-blue-900 text-xs">{formatCurrency(c.totalValue)}</span>
                                        <button onClick={() => setCart(cart.filter((_, idx) => idx !== i))} className="p-1.5 text-red-300 hover:text-red-600 transition-colors"><Trash2 size={14}/></button>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="pt-4 border-t space-y-4">
                            <div className="flex justify-between items-baseline"><span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Subtotal</span><span className="text-3xl font-black text-blue-950 italic">{formatCurrency(cartTotal)}</span></div>
                            
                            {/* CÁLCULO DE TROCO PARA DINHEIRO */}
                            {paymentMethod === 'Dinheiro' && (
                                <div className="bg-green-50 p-4 rounded-2xl border border-green-200 space-y-3 animate-in fade-in zoom-in duration-300">
                                    <div className="flex justify-between items-center">
                                        <label className="text-[9px] font-black text-green-700 uppercase tracking-widest">Valor Pago</label>
                                        <input 
                                            autoFocus
                                            value={amountPaid} 
                                            onChange={e => setAmountPaid(e.target.value)} 
                                            placeholder="0,00"
                                            className="w-24 text-right bg-white border-none rounded-lg p-2 font-black text-green-900 outline-none focus:ring-2 focus:ring-green-400"
                                        />
                                    </div>
                                    <div className="flex justify-between items-baseline border-t border-green-100 pt-2">
                                        <span className="text-[9px] font-black text-green-600 uppercase tracking-widest">Troco</span>
                                        <span className="text-xl font-black text-green-700 italic">{formatCurrency(changeDue)}</span>
                                    </div>
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-2">{['Pix', 'Dinheiro', 'Cartão', 'Fiado'].map((m: any) => (<button key={m} onClick={() => { setPaymentMethod(m); if(m !== 'Dinheiro') setAmountPaid(''); }} className={`py-3 rounded-xl font-black uppercase text-[10px] border-2 transition-all ${paymentMethod === m ? 'bg-blue-900 text-white border-blue-900 shadow-xl' : 'bg-white text-gray-400 border-gray-100'}`}>{m}</button>))}</div>
                            
                            {paymentMethod === 'Fiado' && (
                                <input value={buyerName} onChange={e => setBuyerName(e.target.value)} placeholder="NOME DO FUNCIONÁRIO..." className="w-full p-4 bg-red-50 border-none rounded-2xl font-black text-[10px] uppercase text-red-900 outline-none" />
                            )}

                            <button onClick={finalizeSale} disabled={isSubmitting || cart.length === 0 || !paymentMethod} className="w-full py-5 bg-red-600 hover:bg-red-700 disabled:opacity-30 text-white rounded-[24px] font-black uppercase text-xs shadow-2xl flex items-center justify-center gap-3 transition-all border-b-4 border-red-900 active:scale-95">{isSubmitting ? <Loader2 className="animate-spin" /> : <CheckCircle2 size={18}/>} Finalizar Venda</button>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'dre' && (
                <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        <div className="lg:col-span-2 space-y-6">
                            <div className="bg-white p-8 rounded-[48px] shadow-sm border border-gray-100">
                                <div className="flex justify-between items-center mb-8">
                                    <h3 className="text-xl font-black uppercase italic tracking-tighter flex items-center gap-3"><TrendingUp className="text-green-600"/> Faturamento <span className="text-blue-900">Diário</span></h3>
                                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest bg-gray-50 px-4 py-1.5 rounded-full">{new Date().toLocaleDateString('pt-BR')}</span>
                                </div>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    <div className="bg-blue-50 p-6 rounded-[32px] border border-blue-100">
                                        <p className="text-[9px] font-black text-blue-400 uppercase mb-2 flex items-center gap-1"><Wallet size={12}/> Pix</p>
                                        <p className="text-xl font-black text-blue-900">{formatCurrency(dreStats.dayMethods.pix)}</p>
                                    </div>
                                    <div className="bg-green-50 p-6 rounded-[32px] border border-green-100">
                                        <p className="text-[9px] font-black text-green-400 uppercase mb-2 flex items-center gap-1"><Banknote size={12}/> Dinheiro</p>
                                        <p className="text-xl font-black text-green-900">{formatCurrency(dreStats.dayMethods.money)}</p>
                                    </div>
                                    <div className="bg-purple-50 p-6 rounded-[32px] border border-purple-100">
                                        <p className="text-[9px] font-black text-purple-400 uppercase mb-2 flex items-center gap-1"><CreditCard size={12}/> Cartão</p>
                                        <p className="text-xl font-black text-purple-900">{formatCurrency(dreStats.dayMethods.card)}</p>
                                    </div>
                                    <div className="bg-red-50 p-6 rounded-[32px] border border-red-100">
                                        <p className="text-[9px] font-black text-red-400 uppercase mb-2 flex items-center gap-1"><UserCheck size={12}/> Fiado</p>
                                        <p className="text-xl font-black text-red-900">{formatCurrency(dreStats.dayMethods.fiado)}</p>
                                    </div>
                                </div>
                                <div className="mt-6 pt-6 border-t flex justify-between items-center">
                                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Total Bruto do Dia</span>
                                    <span className="text-4xl font-black italic text-blue-950 tracking-tighter">{formatCurrency(dreStats.dayIn)}</span>
                                </div>
                            </div>

                            <div className="bg-white p-8 rounded-[48px] shadow-sm border border-gray-100">
                                <h3 className="text-lg font-black uppercase italic tracking-tighter mb-6 flex items-center gap-3"><BarChart3 className="text-blue-600"/> Vendas <span className="text-gray-400">por Categoria</span></h3>
                                <div className="space-y-4">
                                    {dreStats.dayCats.map(([cat, val]) => (
                                        <div key={cat} className="flex items-center gap-4">
                                            <span className="text-[10px] font-black text-gray-500 uppercase w-24 truncate">{cat}</span>
                                            <div className="flex-1 h-3 bg-gray-50 rounded-full overflow-hidden">
                                                <div className="h-full bg-blue-600" style={{ width: `${(val / (dreStats.dayIn || 1)) * 100}%` }}></div>
                                            </div>
                                            <span className="text-[11px] font-black text-blue-900 w-20 text-right">{formatCurrency(val)}</span>
                                        </div>
                                    ))}
                                    {dreStats.dayCats.length === 0 && <p className="text-center py-10 text-gray-300 text-[10px] font-black uppercase tracking-widest italic opacity-20">Nenhuma venda hoje</p>}
                                </div>
                            </div>
                        </div>

                        <div className="space-y-6">
                            <div className="bg-blue-950 p-8 rounded-[48px] shadow-2xl text-white">
                                <div className="flex justify-between items-center mb-8">
                                    <h3 className="text-xl font-black uppercase italic tracking-tighter">Visão <span className="text-blue-400">Mensal</span></h3>
                                    <Calculator className="text-blue-400" size={24}/>
                                </div>
                                <div className="space-y-6">
                                    <div className="flex justify-between items-baseline border-b border-white/5 pb-4">
                                        <span className="text-[9px] font-black text-blue-300 uppercase tracking-widest">Faturamento (+)</span>
                                        <span className="text-2xl font-black italic">{formatCurrency(dreStats.monthIn)}</span>
                                    </div>
                                    <div className="flex justify-between items-baseline border-b border-white/5 pb-4">
                                        <span className="text-[9px] font-black text-red-400 uppercase tracking-widest">Despesas (-)</span>
                                        <span className="text-2xl font-black italic text-red-400">{formatCurrency(dreStats.monthOut)}</span>
                                    </div>
                                    <div className="pt-2">
                                        <span className="text-[9px] font-black text-green-400 uppercase tracking-widest block mb-2">Saldo Líquido Estimado</span>
                                        <span className="text-5xl font-black italic tracking-tighter text-green-400">{formatCurrency(dreStats.monthIn - dreStats.monthOut)}</span>
                                    </div>
                                </div>
                            </div>

                            <button onClick={() => setShowTransactionModal(true)} className="w-full py-5 bg-white border-2 border-gray-100 rounded-[32px] font-black text-blue-900 uppercase text-xs flex items-center justify-center gap-3 hover:bg-gray-50 transition-all shadow-sm">
                                <ArrowDownCircle className="text-red-600" size={20}/> Lançar Saída de Caixa
                            </button>

                            <div className="bg-white p-6 rounded-[32px] shadow-sm border border-gray-100 overflow-hidden">
                                <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-4 border-b pb-3">Últimos Lançamentos</h4>
                                <div className="space-y-3 max-h-[300px] overflow-y-auto no-scrollbar">
                                    {finances.slice(0, 10).map(f => (
                                        <div key={f.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-2xl">
                                            <div>
                                                <p className="text-[9px] font-black uppercase text-gray-900">{f.category}</p>
                                                <p className="text-[7px] font-bold text-gray-400 uppercase">{new Date(f.date).toLocaleDateString('pt-BR')}</p>
                                            </div>
                                            <span className={`text-[11px] font-black ${f.type === 'entry' ? 'text-green-600' : 'text-red-600'}`}>
                                                {f.type === 'entry' ? '+' : '-'}{formatCurrency(f.value)}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'estoque' && (
                <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-500">
                    <div className="bg-white rounded-[40px] shadow-sm border border-gray-100 overflow-hidden">
                        <div className="p-8 border-b bg-gray-50 flex flex-col md:flex-row justify-between items-center gap-4">
                            <h3 className="text-xl font-black uppercase italic tracking-tighter">Itens Físicos <span className="text-blue-600">em Estoque</span></h3>
                            <div className="flex gap-2">
                                <button onClick={() => setShowInwardModal(true)} className="bg-green-600 text-white px-5 py-3 rounded-2xl font-black uppercase text-[10px] shadow-lg flex items-center gap-2 hover:bg-green-700 transition-all active:scale-95 border-b-4 border-green-800">
                                    <PackagePlus size={16}/> Entrada de Mercadoria
                                </button>
                                <button onClick={() => setShowNewStockModal(true)} className="bg-blue-900 text-white px-5 py-3 rounded-2xl font-black uppercase text-[10px] shadow-lg flex items-center gap-2 hover:bg-black transition-all active:scale-95 border-b-4 border-blue-950">
                                    <Plus size={16}/> Novo Insumo
                                </button>
                            </div>
                        </div>
                        <div className="divide-y divide-gray-50">
                            {filteredStock.map(st => (
                                <div key={st.id} className="p-6 flex justify-between items-center hover:bg-blue-50/20 transition-all">
                                    <div>
                                        <p className="font-black uppercase text-gray-900 text-sm italic">{st.product_base}</p>
                                        <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mt-1">Material de Operação</p>
                                    </div>
                                    <div className="text-right">
                                        <span className={`text-2xl font-black italic ${st.stock_current <= 50 ? 'text-red-600' : 'text-blue-900'}`}>{st.stock_current}</span>
                                        <span className="ml-2 text-[10px] font-bold text-gray-400 uppercase">{st.unit}</span>
                                    </div>
                                </div>
                            ))}
                            {filteredStock.length === 0 && (
                                <div className="p-20 text-center text-gray-300">
                                    <Package className="mx-auto mb-4 opacity-20" size={48} />
                                    <p className="text-[10px] font-black uppercase tracking-widest italic">Nenhum insumo cadastrado</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'config' && (
                <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500">
                    <div className="flex justify-between items-center bg-white p-8 rounded-[40px] shadow-sm border border-gray-100">
                        <h3 className="text-xl font-black uppercase italic tracking-tighter">Gestão de <span className="text-blue-600">Cardápio & Fichas</span></h3>
                        <button onClick={() => setShowProductModal(true)} className="bg-gray-900 text-white px-8 py-4 rounded-2xl font-black uppercase text-xs shadow-xl hover:bg-black transition-all active:scale-95 flex items-center gap-2 border-b-4 border-red-600"><Plus size={18}/> Novo Produto</button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {filteredItems.map(item => (
                            <div key={item.id} className="bg-white rounded-[40px] shadow-sm border border-gray-100 p-8 group relative">
                                <button onClick={() => onDeleteItem(item.id)} className="absolute top-6 right-6 text-gray-200 hover:text-red-600 transition-colors"><Trash2 size={20}/></button>
                                <div className="flex items-center gap-5 mb-6">
                                    <div className="w-16 h-16 bg-blue-50 rounded-3xl flex items-center justify-center text-blue-600 font-black"><IceCream size={32}/></div>
                                    <div>
                                        <h4 className="font-black text-lg text-gray-900 uppercase italic leading-none">{item.name}</h4>
                                        <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mt-2">{item.category} | <span className="text-gray-400">{formatCurrency(item.price)}</span></p>
                                    </div>
                                </div>
                                <div className="space-y-3 bg-gray-50 p-6 rounded-[28px] border border-gray-100 shadow-inner">
                                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-2 flex items-center gap-2"><ListChecks size={12}/> Insumos Consumidos:</p>
                                    {item.recipe?.map((r, idx) => (
                                        <div key={idx} className="flex justify-between items-center text-[11px] font-bold">
                                            <span className="text-gray-600 uppercase italic">{r.stock_base_name}</span>
                                            <span className="text-blue-900 font-black">{r.quantity} un</span>
                                        </div>
                                    ))}
                                    {(!item.recipe || item.recipe.length === 0) && <p className="text-[9px] text-red-400 font-black uppercase italic">⚠️ Ficha técnica vazia</p>}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>

        {/* MODAL ENTRADA DE MERCADORIA (NOVO) */}
        {showInwardModal && (
            <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-[100] p-4">
                <div className="bg-white rounded-[48px] shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in duration-300">
                    <div className="p-10 bg-green-50 border-b flex justify-between items-center">
                        <h3 className="text-2xl font-black text-green-900 uppercase italic tracking-tighter">Entrada de <span className="text-green-600">Mercadoria</span></h3>
                        <button onClick={() => setShowInwardModal(false)} className="text-gray-400 hover:text-red-600"><X size={28}/></button>
                    </div>
                    <form onSubmit={handleInwardEntry} className="p-10 space-y-6">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Selecionar Insumo Registrado</label>
                            <select required value={inwardData.stock_item_id} onChange={e => setInwardData({...inwardData, stock_item_id: e.target.value})} className="w-full px-6 py-4 bg-gray-50 border-none rounded-2xl font-black text-gray-800 uppercase text-xs outline-none focus:ring-4 focus:ring-green-100 shadow-sm appearance-none cursor-pointer">
                                <option value="">ESCOLHA O ITEM...</option>
                                {filteredStock.map(st => <option key={st.id} value={st.id}>{st.product_base} ({st.unit})</option>)}
                            </select>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Qtd. Adquirida</label>
                                <input required type="text" value={inwardData.quantity} onChange={e => setInwardData({...inwardData, quantity: e.target.value})} className="w-full px-6 py-4 bg-gray-50 border-none rounded-2xl font-black text-blue-900 text-lg outline-none focus:ring-4 focus:ring-green-100 shadow-sm" placeholder="0" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Data da Aquisição</label>
                                <input required type="date" value={inwardData.date} onChange={e => setInwardData({...inwardData, date: e.target.value})} className="w-full px-6 py-4 bg-gray-50 border-none rounded-2xl font-black text-gray-800 text-xs outline-none focus:ring-4 focus:ring-green-100 shadow-sm" />
                            </div>
                        </div>
                        <button type="submit" disabled={isSubmitting || !inwardData.stock_item_id} className="w-full py-5 bg-green-600 text-white rounded-[24px] font-black uppercase text-xs shadow-xl active:scale-95 transition-all border-b-4 border-green-800 disabled:opacity-30">
                            {isSubmitting ? <Loader2 className="animate-spin" /> : <Save size={18}/>} EFETIVAR ENTRADA
                        </button>
                    </form>
                </div>
            </div>
        )}

        {/* MODAL NOVO INSUMO DE ESTOQUE */}
        {showNewStockModal && (
            <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-[100] p-4">
                <div className="bg-white rounded-[48px] shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in duration-300">
                    <div className="p-10 bg-blue-50 border-b flex justify-between items-center">
                        <h3 className="text-2xl font-black text-blue-900 uppercase italic tracking-tighter">Cadastrar <span className="text-blue-600">Novo Insumo</span></h3>
                        <button onClick={() => setShowNewStockModal(false)} className="text-gray-400 hover:text-red-600"><X size={28}/></button>
                    </div>
                    <form onSubmit={handleCreateStockItem} className="p-10 space-y-6">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Nome do Insumo (Ex: COPO 300ML)</label>
                            <input required value={newStockItem.product_base} onChange={e => setNewStockItem({...newStockItem, product_base: e.target.value})} className="w-full px-6 py-4 bg-gray-50 border-none rounded-2xl font-black text-gray-800 uppercase italic text-sm outline-none focus:ring-4 focus:ring-blue-100 shadow-sm" placeholder="DIGITE O NOME..." />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Saldo Inicial</label>
                                <input required type="number" value={newStockItem.stock_initial} onChange={e => setNewStockItem({...newStockItem, stock_initial: e.target.value})} className="w-full px-6 py-4 bg-gray-50 border-none rounded-2xl font-black text-blue-900 text-lg outline-none focus:ring-4 focus:ring-blue-100 shadow-sm" placeholder="0" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Unidade</label>
                                <select value={newStockItem.unit} onChange={e => setNewStockItem({...newStockItem, unit: e.target.value})} className="w-full px-6 py-4 bg-gray-50 border-none rounded-2xl font-black text-gray-800 uppercase text-xs outline-none focus:ring-4 focus:ring-blue-100 shadow-sm">
                                    <option value="un">Unidade (un)</option>
                                    <option value="kg">Quilo (kg)</option>
                                    <option value="lt">Litro (lt)</option>
                                </select>
                            </div>
                        </div>
                        <button type="submit" disabled={isSubmitting} className="w-full py-5 bg-blue-900 text-white rounded-[24px] font-black uppercase text-xs shadow-xl active:scale-95 transition-all border-b-4 border-blue-950">
                            {isSubmitting ? <Loader2 className="animate-spin" /> : <Save size={18}/>} SALVAR INSUMO
                        </button>
                    </form>
                </div>
            </div>
        )}

        {/* MODAL LANÇAR SAÍDA */}
        {showTransactionModal && (
            <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-[100] p-4">
                <div className="bg-white rounded-[48px] shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in duration-300">
                    <div className="p-10 bg-red-50 border-b flex justify-between items-center">
                        <h3 className="text-2xl font-black text-red-900 uppercase italic tracking-tighter">Lançar <span className="text-red-600">Saída</span></h3>
                        <button onClick={() => setShowTransactionModal(false)} className="text-gray-400 hover:text-red-600"><X size={28}/></button>
                    </div>
                    <form onSubmit={handleSaveTransaction} className="p-10 space-y-6">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Valor (R$)</label>
                            <input required value={txForm.value} onChange={e => setTxForm({...txForm, value: e.target.value})} className="w-full px-6 py-4 bg-gray-50 border-none rounded-2xl font-black text-red-600 text-xl outline-none" placeholder="0,00" />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Categoria de Despesa</label>
                            <select value={txForm.category} onChange={e => setTxForm({...txForm, category: e.target.value})} className="w-full px-6 py-4 bg-gray-50 border-none rounded-2xl font-black text-gray-800 uppercase text-xs outline-none">
                                <option value="Insumos">Insumos (Copo, colher, etc)</option>
                                <option value="Limpeza">Material de Limpeza</option>
                                <option value="Funcionários">Adiantamento / Bonus</option>
                                <option value="Manutenção">Manutenção Equipamentos</option>
                                <option value="Outros">Outras Despesas</option>
                            </select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Justificativa / Descrição</label>
                            <textarea value={txForm.description} onChange={e => setTxForm({...txForm, description: e.target.value})} className="w-full px-6 py-4 bg-gray-50 border-none rounded-2xl font-medium text-sm outline-none h-24" placeholder="Ex: Compra de detergente e panos..." />
                        </div>
                        <button type="submit" disabled={isSubmitting} className="w-full py-5 bg-red-600 text-white rounded-[24px] font-black uppercase text-xs shadow-xl active:scale-95 transition-all border-b-4 border-red-900">{isSubmitting ? <Loader2 className="animate-spin" /> : <CheckCircle2 size={18}/>} EFETIVAR SAÍDA</button>
                    </form>
                </div>
            </div>
        )}

        {/* MODAL NOVO PRODUTO COM FICHA TÉCNICA */}
        {showProductModal && (
            <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-[100] p-4">
                <div className="bg-white rounded-[60px] shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto no-scrollbar animate-in zoom-in duration-300">
                    <div className="p-10 bg-gray-50 border-b flex justify-between items-center sticky top-0 z-10">
                        <div>
                            <h3 className="text-3xl font-black text-gray-900 uppercase italic leading-none">Cadastrar <span className="text-red-600">Produto</span></h3>
                            <p className="text-[10px] font-black text-gray-400 uppercase mt-2 tracking-widest">Defina o preço e os insumos para controle automático</p>
                        </div>
                        <button onClick={() => setShowProductModal(false)} className="bg-white p-3 rounded-full text-gray-400 hover:text-red-600 shadow-xl transition-all border border-gray-100"><X size={24}/></button>
                    </div>
                    
                    <form onSubmit={handleCreateProduct} className="p-10 space-y-10">
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-8">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-gray-500 uppercase block ml-1 tracking-widest">Nome Comercial *</label>
                                <input required value={newProd.name} onChange={e => setNewProd({...newProd, name: e.target.value})} className="w-full px-6 py-4 bg-gray-50 border-none rounded-2xl font-black text-gray-800 uppercase italic text-sm focus:ring-4 focus:ring-blue-100 outline-none shadow-sm" placeholder="EX: SUNDAE 300ML" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-gray-500 uppercase block ml-1 tracking-widest">Categoria</label>
                                <select value={newProd.category} onChange={e => setNewProd({...newProd, category: e.target.value as any})} className="w-full px-6 py-4 bg-gray-50 border-none rounded-2xl font-black text-gray-800 uppercase text-xs focus:ring-4 focus:ring-blue-100 outline-none shadow-sm cursor-pointer appearance-none">
                                    {PRODUCT_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-gray-500 uppercase block ml-1 tracking-widest">Preço de Venda</label>
                                <input required value={newProd.price} onChange={e => setNewProd({...newProd, price: e.target.value})} className="w-full px-6 py-4 bg-gray-50 border-none rounded-2xl font-black text-blue-900 text-lg focus:ring-4 focus:ring-blue-100 outline-none shadow-sm" placeholder="0,00" />
                            </div>
                        </div>

                        {/* FICHA TÉCNICA */}
                        <div className="bg-blue-950 p-10 rounded-[48px] shadow-2xl text-white space-y-8">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-blue-600 rounded-2xl"><ListChecks size={24}/></div>
                                <div>
                                    <h4 className="text-xl font-black uppercase italic tracking-tighter">Ficha Técnica <span className="text-blue-400">de Insumos</span></h4>
                                    <p className="text-[9px] font-black text-blue-300 uppercase tracking-widest mt-1">Selecione o que será abatido do estoque nesta venda</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                                <div className="md:col-span-7 space-y-2">
                                    <label className="text-[10px] font-black text-blue-300 uppercase ml-2">Item de Estoque Físico</label>
                                    <select value={selectedStockBase} onChange={e => setSelectedStockBase(e.target.value)} className="w-full p-4 bg-white/10 border-none rounded-2xl text-white font-black uppercase text-xs outline-none focus:ring-2 focus:ring-blue-500 appearance-none cursor-pointer">
                                        <option value="" className="text-gray-900">Selecionar insumo...</option>
                                        {filteredStock.map(st => <option key={st.id} value={st.product_base} className="text-gray-900">{st.product_base}</option>)}
                                    </select>
                                </div>
                                <div className="md:col-span-3 space-y-2">
                                    <label className="text-[10px] font-black text-blue-300 uppercase ml-2">Quantidade</label>
                                    <input type="number" value={qtyToConsume} onChange={e => setQtyToConsume(e.target.value)} className="w-full p-4 bg-white/10 border-none rounded-2xl text-white font-black text-center outline-none focus:ring-2 focus:ring-blue-500" />
                                </div>
                                <button type="button" onClick={addToRecipe} className="md:col-span-2 p-4 bg-blue-600 hover:bg-blue-500 rounded-2xl font-black uppercase text-[10px] transition-all flex items-center justify-center shadow-lg active:scale-95"><Plus size={18}/></button>
                            </div>

                            <div className="space-y-3 pt-4">
                                {recipe.map((r, i) => (
                                    <div key={i} className="flex justify-between items-center p-4 bg-white/5 rounded-2xl border border-white/5 animate-in slide-in-from-left duration-200">
                                        <span className="font-black uppercase italic text-xs tracking-tight">{r.stock_base_name}</span>
                                        <div className="flex items-center gap-4">
                                            <span className="font-black text-blue-400">{r.quantity} un</span>
                                            <button type="button" onClick={() => setRecipe(recipe.filter((_, idx) => idx !== i))} className="text-red-400 hover:text-red-300"><Trash2 size={16}/></button>
                                        </div>
                                    </div>
                                ))}
                                {recipe.length === 0 && <p className="text-center py-4 text-blue-300 text-[10px] font-black uppercase tracking-widest italic opacity-40">Nenhum insumo vinculado</p>}
                            </div>
                        </div>

                        <div className="flex gap-4 pt-4">
                            <button type="button" onClick={() => setShowProductModal(false)} className="flex-1 py-5 bg-white border-2 border-gray-100 rounded-[28px] font-black text-gray-400 uppercase text-xs transition-all hover:bg-gray-50 active:scale-95">CANCELAR</button>
                            <button type="submit" disabled={isSubmitting || recipe.length === 0} className="flex-1 py-5 bg-red-600 text-white rounded-[28px] font-black uppercase text-xs shadow-2xl flex items-center justify-center gap-3 transition-all active:scale-95 disabled:opacity-30 border-b-4 border-red-900">
                                {isSubmitting ? <Loader2 className="animate-spin" /> : <Save size={18}/>} SALVAR PRODUTO
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        )}
    </div>
  );
};

export default IceCreamModule;
