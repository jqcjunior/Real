import React, { useState, useMemo } from 'react';
import { 
    IceCreamItem, IceCreamDailySale, IceCreamTransaction, IceCreamCategory, 
    IceCreamPaymentMethod, User 
} from '../types';
import { formatCurrency } from '../constants';
import { 
    ShoppingCart, Plus, Trash2, 
    CheckCircle2, Loader2, ChevronLeft,
    IceCream, DollarSign
} from 'lucide-react';

interface PDVMobileViewProps {
    user: User;
    items: IceCreamItem[];
    cart: IceCreamDailySale[];
    setCart: React.Dispatch<React.SetStateAction<IceCreamDailySale[]>>;
    selectedCategory: IceCreamCategory | null;
    setSelectedCategory: (cat: IceCreamCategory | null) => void;
    paymentMethod: IceCreamPaymentMethod | 'Misto' | null;
    setPaymentMethod: (pm: IceCreamPaymentMethod | 'Misto' | null) => void;
    mistoValues: Record<string, string>;
    setMistoValues: React.Dispatch<React.SetStateAction<Record<string, string>>>;
    buyerName: string;
    setBuyerName: (name: string) => void;
    existingBuyerNames: string[]; 
    onAddSales: (sale: IceCreamDailySale[]) => Promise<void>;
    onUpdateStock: (storeId: string, base: string, value: number, unit: string, type: 'production' | 'adjustment' | 'purchase' | 'inventory') => Promise<void>;
    onAddTransaction: (tx: IceCreamTransaction) => Promise<void>;
    handlePrintTicket: (items: IceCreamDailySale[], saleCode: string, method: string, buyer?: string) => void;
    isSubmitting: boolean;
    setIsSubmitting: (s: boolean) => void;
    effectiveStoreId: string; 
}

const PDVMobileView: React.FC<PDVMobileViewProps> = (props) => {
    const [step, setStep] = useState<'categories' | 'products' | 'cart'>('categories');
    const [amountPaid, setAmountPaid] = useState('');

    // Ícones Dinâmicos com Fallback
    const getCategoryImage = (category: string, name: string) => {
        const itemName = (name || '').toLowerCase();
        if (['Sundae', 'Casquinha', 'Cascão', 'Cascão Trufado'].includes(category)) return 'https://img.icons8.com/color/144/ice-cream-cone.png';
        if (itemName.includes('nutella') || itemName.includes('chocolate')) return 'https://img.icons8.com/color/144/chocolate-spread.png';
        if (itemName.includes('água')) return 'https://img.icons8.com/color/144/water-bottle.png';
        
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

    const cartTotal = useMemo(() => (props.cart || []).reduce((a, b) => a + b.totalValue, 0), [props.cart]);
    
    const changeDue = useMemo(() => {
        const paid = parseFloat((amountPaid || '0').replace(',', '.')) || 0;
        return Math.max(0, paid - cartTotal);
    }, [amountPaid, cartTotal]);

    const handleFinalize = async () => {
        if (!props.cart || props.cart.length === 0 || !props.paymentMethod) return;
        
        const isMisto = props.paymentMethod === 'Misto';
        const splitData = isMisto 
            ? Object.entries(props.mistoValues || {}).map(([method, val]) => ({
                method: method as IceCreamPaymentMethod,
                amount: parseFloat((val as string).replace(',', '.')) || 0
            })).filter(p => p.amount > 0) 
            : [{ method: props.paymentMethod as IceCreamPaymentMethod, amount: cartTotal }];

        if (isMisto && Math.abs(splitData.reduce((a, b) => a + b.amount, 0) - cartTotal) > 0.05) {
            alert("Total divergente."); return;
        }

        props.setIsSubmitting(true);
        const saleCode = `GEL-M${Date.now().toString().slice(-6)}`;
        
        try {
            const operationalSales = props.cart.map(item => ({
                ...item,
                paymentMethod: (isMisto ? 'Misto' : props.paymentMethod) as IceCreamPaymentMethod,
                buyer_name: (props.paymentMethod === 'Fiado' || (isMisto && props.mistoValues['Fiado'])) ? props.buyerName?.toUpperCase() : undefined,
                saleCode,
                status: 'active' as const
            }));

            await props.onAddSales(operationalSales);
            
            for (const payment of splitData) {
                await props.onAddTransaction({
                    id: '0', storeId: props.effectiveStoreId, date: new Date().toISOString().split('T')[0],
                    type: 'entry', category: 'RECEITA DE VENDA PDV', value: payment.amount,
                    description: `Pagamento via ${payment.method} - Ref. ${saleCode}`, createdAt: new Date()
                });
            }

            for (const c of props.cart) {
                const itemDef = props.items?.find(it => it.id === c.itemId);
                if (itemDef?.recipe) {
                    for (const ing of itemDef.recipe) {
                        await props.onUpdateStock(props.effectiveStoreId, ing.stock_base_name, -(ing.quantity * c.unitsSold), '', 'adjustment');
                    }
                }
            }

            props.handlePrintTicket(operationalSales, saleCode, isMisto ? 'Misto' : (props.paymentMethod as string), props.buyerName);
            props.setCart([]); props.setPaymentMethod(null); props.setBuyerName(''); setStep('categories');
            alert("Venda registrada!");
        } catch (e) { 
            alert("Erro ao finalizar."); 
        } finally { 
            props.setIsSubmitting(false); 
        }
    };

    return (
        <div className="flex flex-col h-full bg-[#F8F9FA] text-gray-900 font-sans relative overflow-hidden">
            <header className="px-6 py-4 bg-white border-b border-gray-100 flex items-center justify-between shrink-0">
                {step !== 'categories' ? (
                    <button onClick={() => setStep(step === 'cart' ? 'products' : 'categories')} className="p-2 -ml-2 text-gray-400 active:text-blue-600">
                        <ChevronLeft size={24} />
                    </button>
                ) : <div className="w-8" />}
                <h1 className="text-sm font-black uppercase tracking-widest text-blue-950 italic">
                    Gelateria <span className="text-red-600">Real</span>
                </h1>
                <div className="w-8" />
            </header>

            <main className="flex-1 overflow-y-auto pb-44 p-4 no-scrollbar">
                {step === 'categories' && (
                    <div className="grid grid-cols-2 gap-4 animate-in fade-in zoom-in duration-300">
                        {['Sundae', 'Milkshake', 'Casquinha', 'Cascão', 'Cascão Trufado', 'Copinho', 'Bebidas', 'Adicionais'].sort().map(cat => (
                            <button 
                                key={cat} 
                                onClick={() => { props.setSelectedCategory(cat as any); setStep('products'); }} 
                                className="bg-white rounded-[28px] p-6 shadow-[4px_4px_10px_rgba(0,0,0,0.03)] border border-gray-50 flex flex-col items-center gap-3 active:scale-95 transition-all"
                            >
                                <img src={getCategoryImage(cat, cat)} className="w-14 h-14 object-contain" alt={cat} />
                                <span className="font-black uppercase text-[10px] text-blue-950 tracking-tighter">{cat}</span>
                            </button>
                        ))}
                    </div>
                )}

                {step === 'products' && (
                    <div className="space-y-3 animate-in slide-in-from-right duration-300">
                        {props.items?.filter(i => i.category === props.selectedCategory && i.active).map(item => (
                            <button 
                                key={item.id} 
                                onClick={() => handleMobileAddToCart(item)} 
                                className="w-full bg-white p-4 rounded-[24px] shadow-sm border border-gray-100 flex items-center gap-4 active:scale-95 transition-all"
                            >
                                <div className="w-16 h-16 bg-[#F1F3F6] rounded-2xl flex items-center justify-center shrink-0">
                                    <img src={item.image_url || getCategoryImage(item.category, item.name)} className="w-10 h-10 object-contain" alt={item.name} />
                                </div>
                                <div className="text-left flex-1">
                                    <p className="font-black uppercase italic text-xs text-blue-950">{item.name}</p>
                                    <p className="text-[11px] font-bold text-blue-600 mt-1">{formatCurrency(item.price)}</p>
                                </div>
                                <div className="bg-[#F8F9FA] p-2 rounded-xl border border-gray-100"><Plus size={18} className="text-blue-900" /></div>
                            </button>
                        ))}
                    </div>
                )}

                {step === 'cart' && (
                    <div className="space-y-6 animate-in slide-in-from-bottom duration-300">
                        <div className="space-y-3">
                            {props.cart?.map((item) => (
                                <div key={item.id} className="bg-white p-4 rounded-2xl border border-gray-100 flex justify-between items-center">
                                    <div className="flex-1 pr-4 truncate">
                                        <p className="font-black uppercase text-[10px] text-blue-950 truncate">{item.productName}</p>
                                        <p className="text-[9px] text-gray-400 font-bold">{formatCurrency(item.unitPrice)}</p>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <span className="font-black text-xs text-blue-900">{formatCurrency(item.totalValue)}</span>
                                        <button onClick={() => props.setCart(prev => prev.filter(i => i.id !== item.id))} className="text-red-300 p-1"><Trash2 size={18}/></button>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="bg-white p-6 rounded-[32px] shadow-sm border border-gray-100 space-y-4">
                            <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest border-b pb-3">Pagamento</h3>
                            <div className="grid grid-cols-2 gap-2">
                                {(['Pix', 'Dinheiro', 'Cartão', 'Fiado', 'Misto'] as const).map(pm => (
                                    <button 
                                        key={pm} 
                                        type="button"
                                        onClick={() => props.setPaymentMethod(pm)} 
                                        className={`py-3 rounded-xl font-black uppercase text-[10px] border-2 transition-all ${props.paymentMethod === pm ? 'bg-blue-900 border-blue-900 text-white shadow-lg' : 'bg-[#F8F9FA] border-transparent text-gray-400'}`}
                                    >
                                        {pm}
                                    </button>
                                ))}
                            </div>

                            {props.paymentMethod === 'Dinheiro' && (
                                <div className="p-4 bg-[#F1F3F6] rounded-2xl space-y-2 animate-in zoom-in duration-200">
                                    <div className="flex justify-between items-center">
                                        <span className="text-[9px] font-black uppercase text-gray-500">Valor Recebido</span>
                                        <input 
                                            value={amountPaid} 
                                            onChange={e => setAmountPaid(e.target.value)} 
                                            placeholder="0,00" 
                                            className="w-24 text-right bg-white rounded-lg p-2 font-black text-sm outline-none shadow-inner" 
                                        />
                                    </div>
                                    <div className="flex justify-between border-t border-gray-200 pt-2">
                                        <span className="text-[9px] font-black uppercase text-green-600">Troco</span>
                                        <span className="font-black text-green-700">{formatCurrency(changeDue)}</span>
                                    </div>
                                </div>
                            )}

                            {props.paymentMethod === 'Misto' && (
                                <div className="p-4 bg-blue-50 rounded-2xl space-y-2 animate-in zoom-in duration-200 border border-blue-100">
                                    {(['Pix', 'Dinheiro', 'Cartão', 'Fiado'] as const).map(m => (
                                        <div key={m} className="flex justify-between items-center bg-white px-3 py-2 rounded-xl border border-blue-50 shadow-sm">
                                            <label className="text-[10px] font-black text-gray-400 uppercase">{m}</label>
                                            <input 
                                                value={props.mistoValues[m] || ''} 
                                                onChange={e => props.setMistoValues({...props.mistoValues, [m]: e.target.value})} 
                                                placeholder="0,00" 
                                                className="w-24 text-right font-black text-blue-900 text-xs outline-none bg-transparent" 
                                            />
                                        </div>
                                    ))}
                                </div>
                            )}

                            {(props.paymentMethod === 'Fiado' || (props.paymentMethod === 'Misto' && props.mistoValues?.['Fiado'])) && (
                                <div className="space-y-2 animate-in slide-in-from-top-2 duration-200">
                                    <label className="text-[9px] font-black text-red-500 uppercase ml-1">Colaborador</label>
                                    <input 
                                        value={props.buyerName} 
                                        onChange={e => props.setBuyerName(e.target.value.toUpperCase())} 
                                        list="mobile-buyers-list"
                                        placeholder="NOME DO FUNCIONÁRIO..." 
                                        className="w-full p-4 bg-red-50 border-none rounded-2xl font-black uppercase text-[11px] outline-none shadow-inner" 
                                    />
                                    <datalist id="mobile-buyers-list">
                                        {(props.existingBuyerNames || []).map(n => <option key={n} value={n} />)}
                                    </datalist>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </main>

            {/* Barra de Ação Flutuante */}
            {props.cart?.length > 0 && (
                <div className="fixed bottom-0 left-0 right-0 bg-white px-6 py-6 pb-10 shadow-[0_-10px_30px_rgba(0,0,0,0.05)] rounded-t-[40px] z-50 animate-in slide-in-from-bottom duration-500">
                    <div className="flex justify-between items-center mb-5">
                        <div className="flex flex-col">
                            <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">Total Final</span>
                            <span className="text-2xl font-black italic text-blue-950 leading-none">{formatCurrency(cartTotal)}</span>
                        </div>
                        <div className="bg-[#F8F9FA] px-4 py-2 rounded-2xl font-black text-[10px] text-blue-900 border border-gray-100">
                            {props.cart.length} ITENS
                        </div>
                    </div>
                    <button 
                        onClick={handleFinalize} 
                        disabled={props.isSubmitting || !props.paymentMethod} 
                        className="w-full py-5 bg-red-600 text-white rounded-[24px] font-black uppercase text-xs shadow-[0_10px_20px_rgba(220,38,38,0.3)] active:scale-95 disabled:bg-gray-200 disabled:shadow-none flex items-center justify-center gap-3 transition-all border-b-4 border-red-900"
                    >
                        {props.isSubmitting ? <Loader2 className="animate-spin" size={20} /> : <CheckCircle2 size={20}/>} 
                        Finalizar Venda
                    </button>
                </div>
            )}
        </div>
    );
};

export default PDVMobileView;