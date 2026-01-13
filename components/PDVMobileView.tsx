

import React, { useState } from 'react';
import { 
    IceCreamItem, IceCreamDailySale, IceCreamTransaction, IceCreamCategory, 
    IceCreamExpenseCategory, IceCreamPaymentMethod, User, UserRole 
} from '../types';
import { formatCurrency } from '../constants';
import { 
    ShoppingCart, FileText, ArrowDownCircle, Plus, Trash2, 
    CheckCircle2, Hash, CreditCard, Banknote, X, ChevronRight, 
    Printer, List, PieChart, Save, Loader2, ArrowUpCircle, Ban, Info, Boxes, AlertTriangle
} from 'lucide-react';

interface PDVMobileViewProps {
  user: User;
  items: IceCreamItem[];
  cart: IceCreamDailySale[];
  setCart: React.Dispatch<React.SetStateAction<IceCreamDailySale[]>>;
  selectedCategory: IceCreamCategory | null;
  setSelectedCategory: (cat: IceCreamCategory | null) => void;
  selectedProductName: string | null;
  setSelectedProductName: (name: string | null) => void;
  selectedItem: IceCreamItem | null;
  setSelectedItem: (item: IceCreamItem | null) => void;
  selectedMl: string;
  setSelectedMl: (ml: string) => void;
  quantity: number;
  setQuantity: (q: number) => void;
  paymentMethod: IceCreamPaymentMethod | null;
  setPaymentMethod: (pm: IceCreamPaymentMethod | null) => void;
  onAddSales: (sale: IceCreamDailySale[]) => Promise<void>;
  onCancelSale: (saleCode: string, reason: string) => Promise<void>;
  onAddTransaction: (tx: IceCreamTransaction) => Promise<void>;
  dailyData: any;
  handlePrintDailyDRE: (type: 'detailed' | 'summary') => void;
  handlePrintTicket: (items: IceCreamDailySale[], time: string) => void;
  financeForm: any;
  setFinanceForm: any;
  isSubmitting: boolean;
  setIsSubmitting: (s: boolean) => void;
  setShowTicketModal: (s: boolean) => void;
  setLastSoldItems: (items: IceCreamDailySale[]) => void;
  setLastSaleTime: (time: string) => void;
}

const PDVMobileView: React.FC<PDVMobileViewProps> = (props) => {
  const [mobileTab, setMobileTab] = useState<'vender' | 'dre' | 'estoque' | 'saida'>('vender');
  const [step, setStep] = useState<'categories' | 'products' | 'details' | 'cart'>('categories');

  const handleMobileAddToCart = () => {
    if(!props.selectedItem) { alert("Selecione um item."); return; }
    // Fixed: Added missing required property 'storeId' to fix compilation error.
    const newItem: IceCreamDailySale = { 
        id: `cart-mob-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`, 
        storeId: props.user.storeId || '',
        itemId: props.selectedItem.id, 
        productName: props.selectedItem.name, 
        category: props.selectedItem.category, 
        flavor: props.selectedItem.flavor || 'Padrão', 
        ml: props.selectedMl, 
        unitsSold: props.quantity, 
        unitPrice: props.selectedItem.price, 
        totalValue: Number((props.selectedItem.price * props.quantity).toFixed(2)), 
        paymentMethod: 'Pix', 
        createdAt: new Date().toISOString(), 
        status: 'active' 
    }; 
    props.setCart(prev => [...prev, newItem]); 
    setStep('cart'); 
  };

  const handleFinalize = async () => {
    if (props.cart.length === 0) { alert("Carrinho vazio."); return; }
    if (!props.paymentMethod) { alert("Escolha o pagamento."); return; }

    props.setIsSubmitting(true);
    const currentTime = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    
    try {
        const finalCart = props.cart.map(item => ({ ...item, paymentMethod: props.paymentMethod! }));
        await props.onAddSales(finalCart);
        props.setLastSoldItems([...finalCart]);
        props.setLastSaleTime(currentTime);
        props.setCart([]); 
        props.setShowTicketModal(true);
        setStep('categories');
    } catch (e: any) { 
        alert(`FALHA AO GRAVAR: ${e.message}`); 
    } finally { 
        props.setIsSubmitting(false); 
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50 text-gray-900 font-sans">
      <header className="bg-white border-b px-4 py-3 flex justify-between items-center sticky top-0 z-50">
        <div className="flex items-center gap-2"><div className="p-2 bg-blue-700 rounded-lg text-white"><ShoppingCart size={18}/></div><h1 className="font-black uppercase italic text-sm tracking-tighter">Real <span className="text-red-600">Mobile</span></h1></div>
        <div className="text-[10px] font-black uppercase text-gray-400">Op: {props.user.name.split(' ')[0]}</div>
      </header>

      <main className="flex-1 overflow-y-auto pb-24 px-4 pt-4">
        {mobileTab === 'vender' && (
          <div className="space-y-4">
            {step === 'categories' && (
              <div className="grid grid-cols-2 gap-3">
                {['Sundae', 'Milkshake', 'Casquinha', 'Cascão', 'Bebidas', 'Adicionais'].sort().map(cat => (
                  <button key={cat} onClick={() => { props.setSelectedCategory(cat as any); setStep('products'); }} className="aspect-square bg-white border-2 border-gray-100 rounded-3xl flex flex-col items-center justify-center gap-2 shadow-sm active:bg-blue-50 transition-all"><span className="font-black uppercase italic text-xs text-blue-700">{cat}</span></button>
                ))}
              </div>
            )}

            {step === 'products' && (
              <div className="space-y-3 animate-in slide-in-from-right duration-200">
                <button onClick={() => setStep('categories')} className="text-[10px] font-black text-gray-400 uppercase flex items-center gap-1 mb-2">← Categorias</button>
                <div className="grid grid-cols-1 gap-2">
                  {props.selectedCategory && props.items.filter(i => i.category === props.selectedCategory && i.active).map(item => (
                    <button key={item.id} onClick={() => { props.setSelectedProductName(item.name); setStep('details'); }} className="w-full p-4 bg-white border-2 border-gray-100 rounded-2xl flex justify-between items-center shadow-sm">
                      <span className="font-black uppercase italic text-sm">{item.name}</span>
                      <ChevronRight size={18} className="text-gray-300"/>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {step === 'details' && props.selectedProductName && (
                <div className="space-y-6 animate-in slide-in-from-right duration-300">
                    <button onClick={() => setStep('products')} className="text-[10px] font-black text-gray-400 uppercase flex items-center gap-1 mb-2">← Produtos</button>
                    <div className="bg-white p-6 rounded-[32px] border-2 border-gray-100 shadow-sm space-y-6">
                        <div className="text-center">
                            <h2 className="text-xl font-black uppercase italic tracking-tighter text-blue-900">{props.selectedProductName}</h2>
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Configure o item</p>
                        </div>

                        <div className="space-y-3">
                            <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest block text-center">Tamanho / Volume</label>
                            <div className="grid grid-cols-3 gap-2">
                                {['Padrão', '300ml', '500ml', '700ml'].map(ml => (
                                    <button key={ml} onClick={() => props.setSelectedMl(ml)} className={`py-3 rounded-2xl font-black text-[10px] border-2 transition-all ${props.selectedMl === ml ? 'bg-blue-600 border-blue-600 text-white shadow-lg' : 'bg-gray-50 border-gray-100 text-gray-400'}`}>{ml}</button>
                                ))}
                            </div>
                        </div>

                        <div className="flex items-center justify-between bg-gray-50 p-4 rounded-3xl border border-gray-100">
                             <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Quantidade</span>
                             <div className="flex items-center gap-6">
                                 <button onClick={() => props.setQuantity(Math.max(1, props.quantity - 1))} className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center font-black text-lg border border-gray-200">-</button>
                                 <span className="text-xl font-black text-blue-900 w-6 text-center">{props.quantity}</span>
                                 <button onClick={() => props.setQuantity(props.quantity + 1)} className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center font-black text-lg border border-gray-200">+</button>
                             </div>
                        </div>

                        <button onClick={handleMobileAddToCart} className="w-full py-5 bg-blue-700 text-white rounded-[24px] font-black uppercase text-xs shadow-xl flex items-center justify-center gap-3 active:scale-95 transition-all">
                            <Plus size={18}/> Adicionar ao Carrinho
                        </button>
                    </div>
                </div>
            )}

            {step === 'cart' && (
              <div className="space-y-6 animate-in slide-in-from-bottom duration-300">
                <div className="flex justify-between items-center"><button onClick={() => setStep('categories')} className="text-[10px] font-black text-blue-600 uppercase tracking-widest">+ ADICIONAR ITEM</button><button onClick={() => props.setCart([])} className="text-[10px] font-black text-red-400 uppercase tracking-widest">ESVAZIAR</button></div>
                <div className="space-y-3">
                  {props.cart.map((item, idx) => (
                    <div key={item.id} className="bg-white p-4 rounded-2xl border flex justify-between items-center shadow-sm">
                      <div><p className="text-[8px] font-black text-red-500 uppercase">{item.category} • {item.ml}</p><p className="font-black uppercase italic text-xs leading-none my-1">{item.productName}</p><p className="text-[10px] font-bold text-gray-400">{item.unitsSold}x {formatCurrency(item.unitPrice)}</p></div>
                      <button onClick={() => props.setCart(prev => prev.filter((_, i) => i !== idx))} className="text-gray-300 p-2"><Trash2 size={16}/></button>
                    </div>
                  ))}
                </div>
                {props.cart.length > 0 && (
                  <div className="bg-gray-900 rounded-[32px] p-6 text-white space-y-6 shadow-2xl">
                    <div className="flex justify-between items-end"><span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Total</span><span className="text-4xl font-black italic tracking-tighter">{formatCurrency(props.cart.reduce((a, b) => a + b.totalValue, 0))}</span></div>
                    <div className="space-y-3">
                        <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest block text-center">Pagamento</label>
                        <div className="grid grid-cols-3 gap-2">
                            {(['Pix', 'Cartão', 'Dinheiro'] as IceCreamPaymentMethod[]).map(pm => (
                                <button key={pm} onClick={() => props.setPaymentMethod(pm)} className={`py-3 rounded-xl flex flex-col items-center gap-1 border-2 transition-all ${props.paymentMethod === pm ? 'bg-blue-600 border-blue-600 text-white shadow-lg' : 'bg-white/5 border-white/10 text-gray-400'}`}>
                                    {pm === 'Pix' ? <Hash size={14}/> : pm === 'Cartão' ? <CreditCard size={14}/> : <Banknote size={14}/>}
                                    <span className="text-[9px] font-black uppercase">{pm}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                    <button onClick={handleFinalize} disabled={props.isSubmitting || !props.paymentMethod} className="w-full py-5 bg-red-600 rounded-2xl font-black uppercase text-xs shadow-xl active:scale-95 disabled:bg-gray-800 transition-all">
                        {props.isSubmitting ? (
                          <div className="flex items-center justify-center gap-2">
                            <Loader2 className="animate-spin" size={20}/>
                            <span>Processando venda...</span>
                          </div>
                        ) : 'Finalizar e Imprimir'}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default PDVMobileView;
