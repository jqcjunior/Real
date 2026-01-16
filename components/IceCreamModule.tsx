
import React, { useState, useMemo, useEffect } from 'react';
import { IceCreamItem, IceCreamDailySale, IceCreamTransaction, IceCreamCategory, IceCreamPaymentMethod, User, UserRole, Store, IceCreamStock, IceCreamPromissoryNote } from '../types';
import { formatCurrency } from '../constants';
import { 
    IceCream, Plus, Package, ShoppingCart, CheckCircle2, 
    Trash2, X, History, PieChart, ArrowDownCircle, ArrowUpCircle, 
    Loader2, Search, Trash, ChevronRight, Calculator, FileText, Ban, UserCheck, Save, Image as ImageIcon, Sliders, Settings, Calendar, BarChart3
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
  onAddItem: (name: string, category: string, price: number, flavor?: string, stockInitial?: number, unit?: string, consumptionPerSale?: number, targetStoreId?: string) => Promise<void>;
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
  const isManager = user.role === UserRole.MANAGER;
  
  const [activeTab, setActiveTab] = useState<'pdv' | 'estoque' | 'dre' | 'audit' | 'config' | 'estoque-edit'>(() => {
      if (can('MODULE_GELATERIA_PDV')) return 'pdv';
      if (can('MODULE_GELATERIA_ESTOQUE')) return 'estoque';
      return 'pdv';
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cart, setCart] = useState<IceCreamDailySale[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<IceCreamCategory | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<IceCreamPaymentMethod | null>(null);
  const [buyerName, setBuyerName] = useState('');
  
  const [showProductModal, setShowProductModal] = useState(false);
  const [showTransactionModal, setShowTransactionModal] = useState(false);
  
  const [newProd, setNewProd] = useState({
      name: '',
      category: 'Copinho' as IceCreamCategory,
      price: '',
      flavor: '',
      consumption: '1'
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

  const handleAddToCart = (item: IceCreamItem) => {
      const existing = cart.find(c => c.itemId === item.id);
      if (existing) {
          setCart(cart.map(c => c.itemId === item.id ? { ...c, unitsSold: c.unitsSold + 1, totalValue: (c.unitsSold + 1) * c.unitPrice } : c));
      } else {
          setCart([...cart, {
              id: `temp-${Date.now()}`,
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
      }
  };

  const finalizeSale = async () => {
      if (cart.length === 0 || !paymentMethod) return;
      if (paymentMethod === 'Fiado' && !buyerName) {
          alert("Erro: Para 'Fiado', o nome do funcionário é obrigatório.");
          return;
      }

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
          printTicket(salesToSave, buyerName);
          setCart([]);
          setPaymentMethod(null);
          setBuyerName('');
      } catch (e) {
          alert("Falha ao registrar venda.");
      } finally {
          setIsSubmitting(false);
      }
  };

  const handleCreateProduct = async (e: React.FormEvent) => {
      e.preventDefault();
      setIsSubmitting(true);
      try {
          const priceNum = parseFloat(newProd.price.replace(',', '.'));
          const consNum = parseFloat(newProd.consumption.replace(',', '.'));
          await onAddItem(newProd.name, newProd.category, priceNum, newProd.flavor, 0, 'un', consNum, effectiveStoreId);
          setShowProductModal(false);
          setNewProd({ name: '', category: 'Copinho', price: '', flavor: '', consumption: '1' });
      } catch (e) { alert("Erro ao criar sorvete."); } finally { setIsSubmitting(false); }
  };

  const handleSaveTransaction = async (e: React.FormEvent) => {
      e.preventDefault();
      const val = parseFloat(txForm.value.replace(',', '.'));
      if (isNaN(val) || val <= 0) return;
      setIsSubmitting(true);
      try {
          await onAddTransaction({
              id: '',
              storeId: effectiveStoreId,
              date: txForm.date,
              type: 'exit',
              category: txForm.category,
              value: val,
              description: txForm.description,
              createdAt: new Date()
          });
          setShowTransactionModal(false);
          setTxForm({ date: new Date().toISOString().split('T')[0], category: 'Despesa Operacional', value: '', description: '' });
      } catch (e) { alert("Erro ao salvar despesa."); } finally { setIsSubmitting(false); }
  };

  const printTicket = (salesList: IceCreamDailySale[], buyer?: string) => {
      const printWindow = window.open('', '_blank', 'width=300,height=600');
      if (!printWindow) return;
      const total = salesList.reduce((a,b) => a + b.totalValue, 0);
      const html = `<html><body style="font-family:monospace; font-size:12px; width:250px; padding:10px;"><div style="text-align:center;"><h2 style="margin:0;">GELATERIA REAL</h2><p>Unidade ${stores.find(s => s.id === effectiveStoreId)?.number || '---'}</p><hr/></div><p>Data: ${new Date().toLocaleString()}</p><p>Atendente: ${user.name}</p>${buyer ? `<p>Comprador: <b>${buyer.toUpperCase()}</b></p>` : ''}<hr/><table width="100%">${salesList.map(s => `<tr><td>${s.unitsSold}x ${s.productName}</td><td align="right">${formatCurrency(s.totalValue)}</td></tr>`).join('')}</table><hr/><div style="text-align:right;"><b>TOTAL: ${formatCurrency(total)}</b></div><p>Pagamento: ${salesList[0].paymentMethod}</p><br/><br/><div style="border-top:1px solid #000; text-align:center;">Assinatura Atendente</div>${buyer ? `<br/><br/><div style="border-top:1px solid #000; text-align:center;">Assinatura Comprador</div>` : ''}</body><script>window.onload = () => { window.print(); setTimeout(() => window.close(), 500); }</script></html>`;
      printWindow.document.write(html);
      printWindow.document.close();
  };

  const dreStats = useMemo(() => {
      const daySales = (sales || []).filter(s => s.createdAt?.startsWith(todayKey) && s.status !== 'canceled');
      const dayExits = (finances || []).filter(f => f.date === todayKey && f.type === 'exit');
      const monthSales = (sales || []).filter(s => s.createdAt?.startsWith(monthKey) && s.status !== 'canceled');
      const monthExits = (finances || []).filter(f => f.date?.startsWith(monthKey) && f.type === 'exit');
      return {
          dayIn: daySales.reduce((a,b) => a + b.totalValue, 0),
          dayOut: dayExits.reduce((a,b) => a + b.value, 0),
          monthIn: monthSales.reduce((a,b) => a + b.totalValue, 0),
          monthOut: monthExits.reduce((a,b) => a + b.value, 0)
      };
  }, [sales, finances, todayKey, monthKey]);

  const mobileProps: any = {
      user, items: filteredItems, cart, setCart, 
      selectedCategory, setSelectedCategory, 
      paymentMethod, setPaymentMethod,
      buyerName, setBuyerName,
      onAddSales, onAddTransaction,
      dailyData: { sales, finances },
      isSubmitting, setIsSubmitting,
      handlePrintTicket: printTicket,
      onCancelSale,
      selectedProductName: null,
      setSelectedProductName: () => {},
      selectedItem: null,
      setSelectedItem: () => {},
      selectedMl: '',
      setSelectedMl: () => {},
      quantity: 1,
      setQuantity: () => {}
  };

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
                {can('MODULE_GELATERIA_PDV') && <button onClick={() => setActiveTab('pdv')} className={`flex-1 md:flex-none px-4 py-2 rounded-xl text-[9px] font-black uppercase transition-all flex items-center justify-center gap-2 whitespace-nowrap ${activeTab === 'pdv' ? 'bg-white text-blue-700 shadow-md' : 'text-gray-500'}`}><ShoppingCart size={14}/> PDV</button>}
                {can('MODULE_GELATERIA_ESTOQUE') && <button onClick={() => setActiveTab('estoque')} className={`flex-1 md:flex-none px-4 py-2 rounded-xl text-[9px] font-black uppercase transition-all flex items-center justify-center gap-2 whitespace-nowrap ${activeTab === 'estoque' ? 'bg-white text-blue-700 shadow-md' : 'text-gray-500'}`}><Package size={14}/> Estoque</button>}
                {can('MODULE_GELATERIA_DRE') && <button onClick={() => setActiveTab('dre')} className={`flex-1 md:flex-none px-4 py-2 rounded-xl text-[9px] font-black uppercase transition-all flex items-center justify-center gap-2 whitespace-nowrap ${activeTab === 'dre' ? 'bg-white text-blue-700 shadow-md' : 'text-gray-500'}`}><PieChart size={14}/> DRE</button>}
                {can('MODULE_GELATERIA_AUDIT') && <button onClick={() => setActiveTab('audit')} className={`flex-1 md:flex-none px-4 py-2 rounded-xl text-[9px] font-black uppercase transition-all flex items-center justify-center gap-2 whitespace-nowrap ${activeTab === 'audit' ? 'bg-white text-blue-700 shadow-md' : 'text-gray-500'}`}><History size={14}/> Auditoria</button>}
                {can('MODULE_GELATERIA_CONFIG') && <button onClick={() => setActiveTab('config')} className={`flex-1 md:flex-none px-4 py-2 rounded-xl text-[9px] font-black uppercase transition-all flex items-center justify-center gap-2 whitespace-nowrap ${activeTab === 'config' ? 'bg-white text-blue-700 shadow-md' : 'text-gray-500'}`}><Settings size={14}/> Config</button>}
            </div>
        </div>

        <div className="flex-1 overflow-y-auto no-scrollbar p-4 md:p-8 pb-24 md:pb-8">
            {activeTab === 'pdv' && can('MODULE_GELATERIA_PDV') && (
                <>
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
                                    <div key={i} className="flex justify-between items-center p-4 bg-gray-50 rounded-2xl border border-gray-100">
                                        <div className="flex-1 min-w-0 pr-4">
                                            <p className="font-black text-gray-900 uppercase text-[10px] truncate">{c.productName}</p>
                                            <p className="text-[9px] text-gray-400 font-bold uppercase">{c.unitsSold}x {formatCurrency(c.unitPrice)}</p>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className="font-black text-blue-900 text-xs">{formatCurrency(c.totalValue)}</span>
                                            <button onClick={() => setCart(cart.filter((_, idx) => idx !== i))} className="p-1.5 text-gray-300 hover:text-red-600 transition-colors"><Trash2 size={14}/></button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div className="pt-4 border-t space-y-4">
                                <div className="flex justify-between items-baseline"><span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Subtotal</span><span className="text-3xl font-black text-blue-950 italic">{formatCurrency(cart.reduce((a,b) => a + b.totalValue, 0))}</span></div>
                                <div className="grid grid-cols-2 gap-2">{['Pix', 'Dinheiro', 'Cartão', 'Fiado'].map((m: any) => (<button key={m} onClick={() => setPaymentMethod(m)} className={`py-3 rounded-xl font-black uppercase text-[10px] border-2 transition-all ${paymentMethod === m ? 'bg-blue-900 text-white border-blue-900 shadow-xl' : 'bg-white text-gray-400 border-gray-100'}`}>{m}</button>))}</div>
                                {paymentMethod === 'Fiado' && (<div className="space-y-1 animate-in slide-in-from-top-2 duration-200"><label className="text-[9px] font-black text-red-600 uppercase ml-2">Nome do Comprador *</label><input value={buyerName} onChange={e => setBuyerName(e.target.value)} placeholder="Digite o nome..." className="w-full p-4 bg-red-50 border-none rounded-2xl text-xs font-black uppercase" /></div>)}
                                <button onClick={finalizeSale} disabled={isSubmitting || cart.length === 0 || !paymentMethod} className="w-full py-5 bg-red-600 hover:bg-red-700 disabled:opacity-30 text-white rounded-[24px] font-black uppercase text-xs shadow-2xl flex items-center justify-center gap-3 transition-all border-b-4 border-red-900 active:scale-95">{isSubmitting ? <Loader2 className="animate-spin" /> : <CheckCircle2 size={18}/>} Finalizar Venda</button>
                            </div>
                        </div>
                    </div>
                    <div className="lg:hidden h-full"><PDVMobileView {...mobileProps} /></div>
                </>
            )}

            {activeTab === 'dre' && can('MODULE_GELATERIA_DRE') && (
                <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-4">
                            <h3 className="text-sm font-black uppercase italic text-gray-400 tracking-widest flex items-center gap-2"><Calendar size={14}/> Resumo Diário</h3>
                            <div className="grid grid-cols-1 gap-4">
                                <div className="bg-white p-6 rounded-[32px] shadow-sm border-l-8 border-green-500 flex justify-between items-center">
                                    <span className="text-[10px] font-black text-gray-400 uppercase">Vendas Hoje</span>
                                    <p className="text-2xl font-black text-gray-900 italic">{formatCurrency(dreStats.dayIn)}</p>
                                </div>
                                <div className="bg-white p-6 rounded-[32px] shadow-sm border-l-8 border-red-500 flex justify-between items-center">
                                    <span className="text-[10px] font-black text-gray-400 uppercase">Saídas Hoje</span>
                                    <p className="text-2xl font-black text-gray-900 italic">{formatCurrency(dreStats.dayOut)}</p>
                                </div>
                                <div className="bg-gray-900 p-6 rounded-[32px] shadow-xl text-white flex justify-between items-center">
                                    <span className="text-[10px] font-black text-blue-300 uppercase">Saldo do Dia</span>
                                    <p className="text-2xl font-black italic text-blue-400">{formatCurrency(dreStats.dayIn - dreStats.dayOut)}</p>
                                </div>
                            </div>
                        </div>
                        <div className="space-y-4">
                            <h3 className="text-sm font-black uppercase italic text-gray-400 tracking-widest flex items-center gap-2"><BarChart3 size={14}/> Performance Mensal</h3>
                            <div className="grid grid-cols-1 gap-4">
                                <div className="bg-blue-50 p-6 rounded-[32px] shadow-sm border border-blue-100 flex justify-between items-center">
                                    <span className="text-[10px] font-black text-blue-400 uppercase">Acumulado Mês</span>
                                    <p className="text-2xl font-black text-blue-900 italic">{formatCurrency(dreStats.monthIn)}</p>
                                </div>
                                <div className="bg-orange-50 p-6 rounded-[32px] shadow-sm border border-orange-100 flex justify-between items-center">
                                    <span className="text-[10px] font-black text-orange-400 uppercase">Despesas Mês</span>
                                    <p className="text-2xl font-black text-orange-900 italic">{formatCurrency(dreStats.monthOut)}</p>
                                </div>
                                <div className="bg-white p-6 rounded-[32px] shadow-xl border-2 border-blue-900 flex justify-between items-center">
                                    <span className="text-[10px] font-black text-gray-400 uppercase">Lucro Operacional</span>
                                    <p className="text-2xl font-black italic text-green-600">{formatCurrency(dreStats.monthIn - dreStats.monthOut)}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-[32px] md:rounded-[40px] shadow-sm border border-gray-100 overflow-hidden">
                        <div className="p-6 md:p-8 border-b bg-gray-50 flex justify-between items-center">
                            <h3 className="text-base md:text-lg font-black uppercase italic tracking-tighter">Fluxo <span className="text-blue-600">Financeiro Completo</span></h3>
                            <button onClick={() => setShowTransactionModal(true)} className="px-6 py-3 bg-red-600 text-white rounded-xl font-black uppercase text-[9px] shadow-lg flex items-center gap-2 transition-all hover:scale-95 active:scale-90"><ArrowDownCircle size={14}/> Lançar Saída</button>
                        </div>
                        <div className="overflow-x-auto no-scrollbar">
                            <table className="w-full text-left">
                                <thead className="bg-white border-b text-[10px] font-black text-gray-400 uppercase tracking-widest">
                                    <tr><th className="px-8 py-5">Data</th><th className="px-8 py-5">Categoria</th><th className="px-8 py-5">Descrição</th><th className="px-8 py-5 text-right">Valor</th></tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {(finances || []).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(f => (
                                        <tr key={f.id} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-8 py-5 font-bold text-gray-400 text-xs">{new Date(f.date + 'T12:00:00').toLocaleDateString('pt-BR')}</td>
                                            <td className="px-8 py-5"><span className={`px-3 py-1 rounded-lg font-black uppercase text-[8px] border ${f.type === 'entry' ? 'bg-green-50 text-green-700 border-green-100' : 'bg-red-50 text-red-700 border-red-100'}`}>{f.category}</span></td>
                                            <td className="px-8 py-5 text-xs font-bold text-gray-900 uppercase italic truncate max-w-xs">{f.description}</td>
                                            <td className={`px-8 py-5 text-right font-black text-sm ${f.type === 'entry' ? 'text-green-700' : 'text-red-700'}`}>{formatCurrency(f.value)}</td>
                                        </tr>
                                    ))}
                                    {(finances || []).length === 0 && <tr><td colSpan={4} className="py-20 text-center text-gray-300 font-black uppercase text-[10px] tracking-widest italic opacity-20">Sem lançamentos registrados</td></tr>}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'estoque' && can('MODULE_GELATERIA_ESTOQUE') && (
                <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-500">
                    <div className="bg-white rounded-[32px] md:rounded-[40px] shadow-sm border border-gray-100 overflow-hidden">
                        <div className="p-6 md:p-8 border-b bg-gray-50 flex justify-between items-center">
                            <h3 className="text-lg md:text-xl font-black uppercase italic tracking-tighter">Saldos <span className="text-blue-600">Estoque</span></h3>
                        </div>
                        <div className="divide-y divide-gray-50">
                            {(filteredStock || []).map(st => (
                                <div key={st.id} className="p-6 flex justify-between items-center">
                                    <p className="font-black uppercase text-gray-900 text-xs md:text-sm italic">{st.product_base}</p>
                                    <div className="text-right">
                                        <span className={`text-xl md:text-2xl font-black italic ${st.stock_current <= 50 ? 'text-red-600' : 'text-blue-900'}`}>{st.stock_current}</span>
                                        <span className="ml-2 text-[8px] md:text-[10px] font-bold text-gray-400 uppercase">{st.unit}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'audit' && can('MODULE_GELATERIA_AUDIT') && (
                <div className="max-w-6xl mx-auto bg-white rounded-[40px] shadow-sm border border-gray-100 overflow-hidden animate-in fade-in duration-500">
                    <div className="p-8 border-b bg-gray-50 flex justify-between items-center">
                        <h3 className="text-xl font-black uppercase italic tracking-tighter">Auditoria de <span className="text-red-600">Promissórias</span></h3>
                    </div>
                    <div className="overflow-x-auto no-scrollbar">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="bg-white border-b text-[10px] font-black text-gray-400 uppercase">
                                    <th className="px-8 py-5">Emissão</th>
                                    <th className="px-8 py-5">Comprador</th>
                                    <th className="px-8 py-5 text-center">Status</th>
                                    <th className="px-8 py-5 text-right">Valor</th>
                                    <th className="px-8 py-5 text-right">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {(promissories || []).map(p => (
                                    <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-8 py-5 font-bold text-gray-400 text-xs">{new Date(p.created_at).toLocaleDateString('pt-BR')}</td>
                                        <td className="px-8 py-5 font-black text-gray-900 uppercase italic text-xs">{p.buyer_name}</td>
                                        <td className="px-8 py-5 text-center"><span className={`px-4 py-1.5 rounded-full font-black uppercase text-[8px] ${p.status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700 animate-pulse'}`}>{p.status === 'paid' ? 'Liquidado' : 'Pendente'}</span></td>
                                        <td className="px-8 py-5 text-right font-black text-red-600 text-sm">{formatCurrency(p.value)}</td>
                                        <td className="px-8 py-5 text-right">{p.status === 'pending' && (<button onClick={() => liquidatePromissory(p.id)} className="p-2.5 bg-green-600 text-white rounded-xl shadow-md hover:bg-green-700 transition-all active:scale-90"><UserCheck size={16}/></button>)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
            
            {activeTab === 'config' && can('MODULE_GELATERIA_CONFIG') && (
                 <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in duration-500">
                     <div className="bg-white p-8 rounded-[40px] shadow-sm border border-gray-100 flex justify-between items-center">
                         <h3 className="text-xl font-black uppercase italic tracking-tighter">Itens do <span className="text-blue-600">Cardápio</span></h3>
                         <button onClick={() => setShowProductModal(true)} className="bg-gray-900 text-white px-6 py-3 rounded-2xl font-black uppercase text-[10px] shadow-xl hover:bg-black transition-all active:scale-95 flex items-center gap-2"><Plus size={16}/> Novo Sorvete</button>
                     </div>
                     <div className="bg-white rounded-[40px] shadow-xl border border-gray-100 overflow-hidden">
                        <div className="overflow-x-auto no-scrollbar">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-gray-50/50 text-[10px] font-black text-gray-400 uppercase tracking-widest border-b">
                                        <th className="px-8 py-5">Produto</th><th className="px-8 py-5">Categoria</th><th className="px-8 py-5 text-center">Consumo</th><th className="px-8 py-5 text-right">Preço</th><th className="px-8 py-5 text-right"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {filteredItems.map(item => (
                                        <tr key={item.id} className="hover:bg-blue-50/30 transition-all group">
                                            <td className="px-8 py-5 font-black uppercase italic text-sm text-gray-900">{item.name}</td>
                                            <td className="px-8 py-5"><span className="px-3 py-1 rounded-lg bg-blue-50 text-blue-700 text-[10px] font-black uppercase border border-blue-100">{item.category}</span></td>
                                            <td className="px-8 py-5 text-center font-bold text-gray-500 text-xs">{item.consumptionPerSale} un</td>
                                            <td className="px-8 py-5 text-right font-black text-blue-900 text-base italic">{formatCurrency(item.price)}</td>
                                            <td className="px-8 py-5 text-right"><button onClick={() => onDeleteItem(item.id)} className="p-3 text-gray-300 hover:text-red-600 transition-all"><Trash2 size={20}/></button></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                     </div>
                 </div>
            )}
        </div>

        {showTransactionModal && (
            <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-[200] p-4">
                <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in duration-300 border-t-8 border-red-600">
                    <div className="p-8 bg-gray-50 border-b flex justify-between items-center">
                        <h3 className="text-2xl font-black text-gray-900 uppercase italic tracking-tighter">Lançar <span className="text-red-600">Saída de Caixa</span></h3>
                        <button onClick={() => setShowTransactionModal(false)} className="bg-white p-2 rounded-full text-gray-400 hover:text-red-600 shadow-xl transition-all border border-gray-100"><X size={20}/></button>
                    </div>
                    <form onSubmit={handleSaveTransaction} className="p-10 space-y-6">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-gray-400 uppercase ml-2">Data</label>
                                <input type="date" required value={txForm.date} onChange={e => setTxForm({...txForm, date: e.target.value})} className="w-full p-4 bg-gray-50 border-none rounded-2xl font-black text-xs" />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-gray-400 uppercase ml-2">Valor (R$)</label>
                                <input required value={txForm.value} onChange={e => setTxForm({...txForm, value: e.target.value})} placeholder="0,00" className="w-full p-4 bg-gray-50 border-none rounded-2xl font-black text-red-600 text-lg" />
                            </div>
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-gray-400 uppercase ml-2">Categoria</label>
                            <select value={txForm.category} onChange={e => setTxForm({...txForm, category: e.target.value})} className="w-full p-4 bg-gray-50 border-none rounded-2xl font-black uppercase text-xs">
                                <option>Despesa Operacional</option>
                                <option>Pagamento Fornecedor</option>
                                <option>Limpeza / Insumos</option>
                                <option>Manutenção</option>
                                <option>Outros</option>
                            </select>
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-gray-400 uppercase ml-2">Descrição / Motivo</label>
                            <input required value={txForm.description} onChange={e => setTxForm({...txForm, description: e.target.value})} placeholder="EX: COMPRA DE LEITE CONDENSADO" className="w-full p-4 bg-gray-50 border-none rounded-2xl font-bold text-xs uppercase" />
                        </div>
                        <button type="submit" disabled={isSubmitting} className="w-full py-5 bg-red-600 text-white rounded-[24px] font-black uppercase text-xs shadow-xl flex items-center justify-center gap-3 active:scale-95 transition-all border-b-4 border-red-900">
                            {isSubmitting ? <Loader2 className="animate-spin" /> : <ArrowDownCircle size={18}/>} Confirmar Saída
                        </button>
                    </form>
                </div>
            </div>
        )}

        {showProductModal && (
            <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-[100] p-4">
                <div className="bg-white rounded-[40px] md:rounded-[60px] shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto no-scrollbar animate-in zoom-in duration-300">
                    <div className="p-6 md:p-10 bg-gray-50 border-b flex justify-between items-center sticky top-0 z-10">
                        <div><h3 className="text-xl md:text-3xl font-black text-gray-900 uppercase italic leading-none">Novo <span className="text-red-600">Sorvete</span></h3><p className="text-[8px] md:text-[10px] font-black text-gray-400 uppercase mt-1 tracking-widest">Cadastro de Itens no Cardápio</p></div>
                        <button onClick={() => setShowProductModal(false)} className="bg-white p-2 md:p-3 rounded-full text-gray-400 hover:text-red-600 shadow-xl transition-all border border-gray-100"><X size={20}/></button>
                    </div>
                    <form onSubmit={handleCreateProduct} className="p-6 md:p-12 space-y-6 md:space-y-8">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
                            <div className="space-y-2"><label className="text-[9px] md:text-[10px] font-black text-gray-500 uppercase ml-1">Nome Comercial *</label><input required value={newProd.name} onChange={e => setNewProd({...newProd, name: e.target.value})} className="w-full px-5 py-4 md:px-6 md:py-5 bg-gray-50 border-none rounded-[20px] md:rounded-[24px] font-black text-gray-800 uppercase italic text-sm focus:ring-4 focus:ring-blue-100 outline-none" /></div>
                            <div className="space-y-2"><label className="text-[9px] md:text-[10px] font-black text-gray-500 uppercase ml-1">Categoria PDV</label><select value={newProd.category} onChange={e => setNewProd({...newProd, category: e.target.value as any})} className="w-full px-5 py-4 md:px-6 md:py-5 bg-gray-50 border-none rounded-[20px] md:rounded-[24px] font-black text-gray-800 uppercase text-xs focus:ring-4 focus:ring-blue-100 outline-none">{PRODUCT_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}</select></div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
                            <div className="space-y-2"><label className="text-[9px] md:text-[10px] font-black text-gray-500 uppercase ml-1">Sabor / Variação</label><input value={newProd.flavor} onChange={e => setNewProd({...newProd, flavor: e.target.value})} className="w-full px-5 py-4 md:px-6 md:py-5 bg-gray-50 border-none rounded-[20px] md:rounded-[24px] font-bold text-gray-800 uppercase text-sm focus:ring-4 focus:ring-blue-100 outline-none" placeholder="EX: MORANGO" /></div>
                            <div className="space-y-2"><label className="text-[9px] md:text-[10px] font-black text-gray-500 uppercase ml-1">Preço de Venda</label><input required value={newProd.price} onChange={e => setNewProd({...newProd, price: e.target.value})} className="w-full px-5 py-4 md:px-6 md:py-5 bg-gray-50 border-none rounded-[20px] md:rounded-[24px] font-black text-blue-900 text-xl focus:ring-4 focus:ring-blue-100 outline-none" placeholder="0,00" /></div>
                        </div>
                        <div className="bg-blue-50 p-6 md:p-8 rounded-[32px] md:rounded-[40px] border border-blue-100 space-y-4">
                            <div className="flex items-center gap-3"><div className="p-2 bg-blue-600 text-white rounded-xl"><Sliders size={16}/></div><h4 className="text-[10px] font-black text-blue-900 uppercase">Inteligência de Insumos</h4></div>
                            <div className="space-y-2"><label className="text-[9px] font-black text-blue-400 uppercase ml-1">Consumo por Venda</label><input required value={newProd.consumption} onChange={e => setNewProd({...newProd, consumption: e.target.value})} className="w-full px-5 py-4 md:px-6 md:py-5 bg-white border-none rounded-[20px] md:rounded-[24px] font-black text-gray-800 text-sm outline-none" /></div>
                        </div>
                        <div className="flex flex-col md:flex-row gap-4">
                            <button type="button" onClick={() => setShowProductModal(false)} className="flex-1 py-4 md:py-5 bg-white border-2 border-gray-200 rounded-[20px] md:rounded-[28px] font-black text-gray-500 uppercase text-xs">CANCELAR</button>
                            <button type="submit" disabled={isSubmitting} className="flex-1 py-4 md:py-5 bg-blue-900 text-white rounded-[20px] md:rounded-[28px] font-black uppercase text-xs shadow-2xl flex items-center justify-center gap-3 hover:bg-black transition-all border-b-4 border-blue-950">{isSubmitting ? <Loader2 className="animate-spin" /> : <Save size={18}/>} SALVAR SORVETE</button>
                        </div>
                    </form>
                </div>
            </div>
        )}
    </div>
  );
};

export default IceCreamModule;
