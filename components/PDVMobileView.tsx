
import React, { useState, useMemo } from 'react';
import { 
    IceCreamItem, IceCreamDailySale, IceCreamTransaction, IceCreamCategory, 
    IceCreamPaymentMethod, User, UserRole 
} from '../types';
import { formatCurrency } from '../constants';
import { 
    ShoppingCart, Plus, Trash2, 
    CheckCircle2, ChevronRight, 
    Loader2, ChevronLeft,
    IceCream, DollarSign
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
  paymentMethod: IceCreamPaymentMethod | 'Misto' | null;
  setPaymentMethod: (pm: IceCreamPaymentMethod | 'Misto' | null) => void;
  mistoValues: Record<string, string>;
  setMistoValues: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  buyerName: string;
  setBuyerName: (name: string) => void;
  onAddSales: (sale: IceCreamDailySale[]) => Promise<void>;
  onCancelSale: (id: string) => Promise<void>;
  onAddTransaction: (tx: IceCreamTransaction) => Promise<void>;
  onUpdateStock: (storeId: string, base: string, value: number, unit: string, type: 'production' | 'adjustment' | 'purchase') => Promise<void>;
  dailyData: any;
  handlePrintTicket: (items: IceCreamDailySale[], saleCode: string, isFiado: boolean, buyer?: string) => void;
  isSubmitting: boolean;
  setIsSubmitting: (s: boolean) => void;
  effectiveStoreId: string; 
}

const PDVMobileView: React.FC<PDVMobileViewProps> = (props) => {
  const [step, setStep] = useState<'categories' | 'products' | 'cart'>('categories');
  const [amountPaid, setAmountPaid] = useState('');

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

  const handleMobileAddToCart = (item: IceCreamItem) => {
    const newItem: IceCreamDailySale = { 
        id: `cart-mob-${Date.now()}-${Math.random()}`, 
        storeId: props.effectiveStoreId, 
        itemId: item.id, 
        productName: item.name, 
        category: item.category, 
        flavor: item.flavor || 'Padrão', 
        unitsSold: 1, 
        unitPrice: item.price, 
        totalValue: item.price, 
        paymentMethod: 'Pix', 
        status: 'active' 
    }; 
    props.setCart(prev => [...prev, newItem]); 
    setStep('cart'); 
  };

  const cartTotal = useMemo(() => props.cart.reduce((a, b) => a + b.totalValue, 0), [props.cart]);
  
  const changeDue = useMemo(() => {
      const paid = parseFloat((amountPaid as string).replace(',', '.')) || 0;
      return Math.max(0, paid - cartTotal);
  }, [amountPaid, cartTotal]);

  const handleFinalize = async () => {
    if (props.cart.length === 0 || !props.paymentMethod) return;

    const isMisto = props.paymentMethod === 'Misto';
    const splitData = isMisto ? Object.entries(props.mistoValues).map(([method, val]) => ({
        method: method as IceCreamPaymentMethod,
        amount: parseFloat((val as string).replace(',', '.')) || 0
    })).filter(p => p.amount > 0) : [{ method: props.paymentMethod as IceCreamPaymentMethod, amount: cartTotal }];

    const totalInformed = splitData.reduce((a, b) => a + b.amount, 0);
    if (isMisto && Math.abs(totalInformed - cartTotal) > 0.05) {
        alert(`Total divergente.`);
        return;
    }

    if (splitData.some(p => p.method === 'Fiado') && !props.buyerName) {
        alert("Funcionário obrigatório.");
        return;
    }

    props.setIsSubmitting(true);
    const saleCode = `GEL-M${Date.now().toString().slice(-5)}`;
    
    try {
        // 1. REGISTRO OPERACIONAL: Itens com unidades INTEIRAS
        const operationalSales = props.cart.map(item => ({
            ...item,
            // Fix: Explicitly cast paymentMethod and status to avoid string widening and align with IceCreamDailySale interface.
            paymentMethod: (isMisto ? 'Misto' : props.paymentMethod) as IceCreamPaymentMethod,
            buyer_name: (props.paymentMethod === 'Fiado' || (isMisto && props.mistoValues['Fiado'])) ? props.buyerName.toUpperCase() : undefined,
            saleCode,
            unitsSold: Math.round(item.unitsSold), // GARANTIA DE INTEIRO
            status: 'active' as const
        }));

        // 2. REGISTRO FINANCEIRO: Rateio real disparado individualmente para o DRE
        const financialPromises = splitData.map(payment => 
            props.onAddTransaction({
                id: '0',
                storeId: props.effectiveStoreId,
                date: new Date().toLocaleDateString('en-CA'),
                type: 'entry',
                category: 'RECEITA DE VENDA PDV',
                value: payment.amount,
                description: `Pagamento via ${payment.method} - Ref. ${saleCode}`,
                createdAt: new Date()
            })
        );

        // Processamento paralelo para agilizar conclusão
        await Promise.all([
            props.onAddSales(operationalSales),
            ...financialPromises
        ]);

        // Baixa de estoque paralela
        for (const c of props.cart) {
            const itemDef = props.items.find(it => it.id === c.itemId);
            if (itemDef?.recipe) {
                for (const ingredient of itemDef.recipe) {
                    props.onUpdateStock(props.effectiveStoreId, ingredient.stock_base_name, -(ingredient.quantity * c.unitsSold), '', 'adjustment');
                }
            }
        }

        // Limpeza instantânea da interface
        props.setCart([]); props.setPaymentMethod(null); props.setBuyerName(''); setAmountPaid('');
        props.setMistoValues({ 'Pix': '', 'Dinheiro': '', 'Cartão': '' });
        setStep('categories');
        alert("Venda registrada!");
    } catch (e) { alert("Erro ao finalizar."); } finally { props.setIsSubmitting(false); }
  };

  return (
    <div className="flex flex-col h-full bg-white text-gray-900 font-sans relative overflow-hidden">
      <main className="flex-1 overflow-y-auto pb-40 p-3 no-scrollbar">
        {step === 'categories' && (
          <div className="space-y-3 animate-in fade-in duration-300">
            <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Menu Gelateria</h2>
            <div className="grid grid-cols-2 gap-2">
              {['Sundae', 'Milkshake', 'Casquinha', 'Cascão', 'Cascão Trufado', 'Copinho', 'Bebidas', 'Adicionais'].sort().map(cat => (
                <button 
                  key={cat} 
                  onClick={() => { props.setSelectedCategory(cat as any); setStep('products'); }} 
                  className="bg-gray-50 border border-gray-100 rounded-2xl py-6 flex flex-col items-center justify-center gap-1 shadow-sm active:scale-95 active:bg-blue-50 transition-all border-b-4 border-gray-200"
                >
                  <span className="font-black uppercase italic text-[11px] text-blue-950 tracking-tighter leading-none">{cat}</span>
                </button>
              ))}
            </div>
          </div>
        )}
        {step === 'products' && (
          <div className="space-y-3 animate-in slide-in-from-right duration-300">
            <div className="flex items-center justify-between mb-2">
              <button onClick={() => setStep('categories')} className="text-[10px] font-black text-blue-600 uppercase flex items-center gap-1 bg-blue-50 px-3 py-2 rounded-xl">
                <ChevronLeft size={14} /> Menu
              </button>
              <h2 className="text-xs font-black text-gray-900 uppercase italic tracking-tighter bg-gray-50 px-4 py-2 rounded-xl">{props.selectedCategory}</h2>
            </div>
            <div className="grid grid-cols-1 gap-2.5">
              {props.items.filter(i => i.category === props.selectedCategory && i.active).map(item => (
                <button 
                  key={item.id} 
                  onClick={() => handleMobileAddToCart(item)} 
                  className="w-full p-4 bg-white border border-gray-100 rounded-2xl flex justify-between items-center shadow-sm active:border-blue-600 active:scale-[0.98] transition-all"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center shrink-0 overflow-hidden">
                      <img src={item.image_url || getCategoryImage(item.category as IceCreamCategory, item.name)} className="w-full h-full object-cover p-1" />
                    </div>
                    <div className="text-left">
                      <p className="font-black uppercase italic text-[11px] text-blue-950 leading-tight">{item.name}</p>
                      <p className="text-[10px] font-bold text-gray-400 mt-1">{formatCurrency(item.price)}</p>
                    </div>
                  </div>
                  <div className="bg-blue-900 text-white p-2 rounded-xl shadow-lg"><Plus size={18}/></div>
                </button>
              ))}
            </div>
          </div>
        )}
        {step === 'cart' && (
          <div className="space-y-4 animate-in slide-in-from-bottom duration-300">
            <div className="flex justify-between items-center px-1">
                <button onClick={() => setStep('categories')} className="text-[10px] font-black text-blue-600 uppercase flex items-center gap-1.5 border border-blue-200 px-4 py-2 rounded-2xl bg-blue-50 shadow-sm">
                  <Plus size={14}/> ADICIONAR
                </button>
                <button onClick={() => { if(window.confirm("Zerar carrinho?")) { props.setCart([]); setStep('categories'); } }} className="text-[10px] font-black text-red-500 uppercase tracking-widest p-2">ESVAZIAR</button>
            </div>
            <div className="space-y-2">
              <h3 className="text-[9px] font-black text-gray-400 uppercase tracking-[0.2em] ml-2">RESUMO DO PEDIDO</h3>
              {props.cart.map((item) => (
                <div key={item.id} className="bg-gray-50 p-3.5 rounded-2xl border border-gray-100 flex justify-between items-center shadow-sm animate-in slide-in-from-right duration-200">
                  <div className="flex-1 pr-4 truncate">
                    <p className="font-black uppercase italic text-[10px] text-blue-950 leading-tight truncate">{item.productName}</p>
                    <p className="text-[9px] font-bold text-gray-400 mt-0.5">{formatCurrency(item.unitPrice)}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[11px] font-black text-blue-900">{formatCurrency(item.totalValue)}</span>
                    <button onClick={() => props.setCart(prev => prev.filter(i => i.id !== item.id))} className="text-red-300 p-2 active:text-red-600 bg-white rounded-xl border border-red-50 shadow-sm"><Trash2 size={16}/></button>
                  </div>
                </div>
              ))}
            </div>
            {props.cart.length > 0 && (
              <div className="bg-blue-50/40 rounded-[32px] p-5 space-y-5 border border-blue-100 shadow-inner">
                <p className="text-[10px] font-black text-blue-900 uppercase tracking-widest border-b border-blue-100 pb-2">FECHAMENTO</p>
                <div className="grid grid-cols-2 gap-2">
                    {(['Pix', 'Dinheiro', 'Cartão', 'Fiado', 'Misto'] as const).map(pm => (
                        <button key={pm} onClick={() => { props.setPaymentMethod(pm); if(pm !== 'Dinheiro' && pm !== 'Misto') setAmountPaid(''); }} className={`py-4 rounded-2xl font-black uppercase text-[10px] border-2 transition-all ${props.paymentMethod === pm ? 'bg-blue-900 border-blue-900 text-white shadow-xl scale-[1.02]' : 'bg-white border-gray-200 text-gray-400'}`}>{pm}</button>
                    ))}
                </div>
                {props.paymentMethod === 'Dinheiro' && (
                    <div className="bg-white p-4 rounded-2xl shadow-xl space-y-3 animate-in zoom-in border-2 border-green-500">
                        <div className="flex justify-between items-center">
                            <label className="text-[9px] font-black text-gray-400 uppercase">Recebido (R$)</label>
                            <input autoFocus value={amountPaid} onChange={e => setAmountPaid(e.target.value)} placeholder="0,00" className="w-24 text-right bg-gray-50 rounded-xl p-2.5 font-black text-green-700 outline-none text-sm border-2 border-green-50 focus:border-green-500" />
                        </div>
                        <div className="flex justify-between items-baseline border-t border-gray-50 pt-2">
                            <span className="text-[9px] font-black text-green-600 uppercase">Troco</span>
                            <span className="text-xl font-black text-green-700 italic leading-none">{formatCurrency(changeDue)}</span>
                        </div>
                    </div>
                )}
                {props.paymentMethod === 'Misto' && (
                    <div className="bg-white p-5 rounded-2xl shadow-xl space-y-3 animate-in zoom-in border-2 border-blue-500">
                        <p className="text-[9px] font-black text-blue-700 uppercase italic border-b pb-1">Distribuição Mista</p>
                        {['Pix', 'Dinheiro', 'Cartão'].map(m => (
                            <div key={m} className="flex justify-between items-center bg-gray-50 p-2 rounded-xl border border-gray-100">
                                <label className="text-[10px] font-black text-gray-400 uppercase">{m}</label>
                                <input 
                                    value={props.mistoValues[m] || ''} 
                                    onChange={e => props.setMistoValues({...props.mistoValues, [m]: e.target.value})} 
                                    placeholder="0,00" 
                                    className="w-20 text-right font-black text-blue-900 text-xs outline-none bg-transparent" 
                                />
                            </div>
                        ))}
                    </div>
                )}
                {(props.paymentMethod === 'Fiado' || (props.paymentMethod === 'Misto' && props.mistoValues['Fiado'])) && (
                    <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                        <label className="text-[9px] font-black text-red-500 uppercase block ml-1">Funcionário (Comprador)</label>
                        <input value={props.buyerName} onChange={e => props.setBuyerName(e.target.value)} placeholder="NOME DO FUNCIONÁRIO..." className="w-full p-4 bg-red-50 border-2 border-red-100 rounded-2xl text-[11px] font-black uppercase placeholder-red-200 outline-none shadow-sm" />
                    </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>
      {props.cart.length > 0 && (
          <div className="fixed bottom-0 left-0 right-0 lg:hidden bg-white border-t border-gray-100 px-5 py-4 pb-10 shadow-[0_-20px_40px_rgba(0,0,0,0.1)] z-50 rounded-t-[40px] animate-in slide-in-from-bottom duration-500">
              <div className="flex justify-between items-center mb-4">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Valor Final</span>
                    <span className="text-2xl font-black italic tracking-tighter text-blue-950 leading-none">{formatCurrency(cartTotal)}</span>
                  </div>
                  <div className="bg-blue-900 text-white px-4 py-2 rounded-2xl flex items-center gap-2 shadow-lg">
                    <ShoppingCart size={14}/>
                    <span className="text-xs font-black">{props.cart.length}</span>
                  </div>
              </div>
              <button 
                onClick={handleFinalize} 
                disabled={props.isSubmitting || !props.paymentMethod} 
                className="w-full py-5 bg-red-600 hover:bg-red-700 disabled:bg-gray-300 disabled:text-gray-400 text-white rounded-[24px] font-black uppercase text-xs shadow-2xl flex items-center justify-center gap-3 transition-all active:scale-95 border-b-4 border-red-900"
              >
                  {props.isSubmitting ? <Loader2 className="animate-spin" size={20}/> : <CheckCircle2 size={20}/>}
                  Registrar Venda
              </button>
          </div>
      )}
    </div>
  );
};

export default PDVMobileView;
