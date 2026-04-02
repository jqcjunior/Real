import React, { useState, useMemo, useCallback } from 'react';
import { 
    IceCreamItem, IceCreamDailySale, IceCreamCategory, 
    IceCreamPaymentMethod, User 
} from '../types';
import { formatCurrency } from '../constants';
import { 
    ShoppingCart, Plus, Trash2, 
    CheckCircle2, Loader2, ChevronLeft,
    IceCream, DollarSign, AlertCircle
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
    onAddSaleAtomic: (saleData: any, items: IceCreamDailySale[], payments: { method: IceCreamPaymentMethod, amount: number }[]) => Promise<void>;
    onUpdateStock: (storeId: string, base: string, value: number, unit: string, type: 'production' | 'adjustment' | 'purchase' | 'inventory') => Promise<void>;
    handlePrintTicket: (items: IceCreamDailySale[], saleCode: string, method: string, buyer?: string) => void;
    isSubmitting: boolean;
    setIsSubmitting: (s: boolean) => void;
    effectiveStoreId: string; 
}

// Constantes memoizadas
const CATEGORIES = ['Sundae', 'Milkshake', 'Casquinha', 'Cascão', 'Cascão Trufado', 'Copinho', 'Bebidas', 'Adicionais'].sort();
const PAYMENT_METHODS = ['Pix', 'Dinheiro', 'Cartão', 'Fiado', 'Misto'] as const;
const MISTO_METHODS = ['Pix', 'Dinheiro', 'Cartão', 'Fiado'] as const;

const PDVMobileView: React.FC<PDVMobileViewProps> = (props) => {
    const [step, setStep] = useState<'categories' | 'products' | 'cart'>('categories');
    const [amountPaid, setAmountPaid] = useState('');
    const [errors, setErrors] = useState<{
        payment?: string;
        buyer?: string;
        misto?: string;
    }>({});

    // Memoizar função de obter imagem da categoria
    const getCategoryImage = useCallback((category: string, name: string) => {
        const itemName = (name || '').toLowerCase();
        if (category === 'Sundae') return 'https://img.icons8.com/color/144/ice-cream-bowl.png';
        if (['Casquinha', 'Cascão', 'Cascão Trufado'].includes(category)) return 'https://img.icons8.com/color/144/ice-cream-cone.png';
        if (category === 'Milkshake') return 'https://img.icons8.com/color/144/milkshake.png';
        if (category === 'Copinho') return 'https://img.icons8.com/color/144/ice-cream-bowl.png';
        if (category === 'Bebidas') return 'https://img.icons8.com/color/144/soda-bottle.png';
        if (category === 'Adicionais' || itemName.includes('nutella') || itemName.includes('chocolate')) return 'https://img.icons8.com/color/144/chocolate-spread.png';
        if (itemName.includes('água')) return 'https://img.icons8.com/color/144/water-bottle.png';
        return 'https://img.icons8.com/color/144/ice-cream.png';
    }, []);

    // Produtos filtrados memoizados
    const filteredProducts = useMemo(() => 
        props.items?.filter(i => i.category === props.selectedCategory && i.active) || [],
        [props.items, props.selectedCategory]
    );

    // Total do carrinho
    const cartTotal = useMemo(() => 
        (props.cart || []).reduce((a, b) => a + b.totalValue, 0), 
        [props.cart]
    );
    
    // Validação pagamento misto
    const mistoTotal = useMemo(() => 
        Object.values(props.mistoValues).reduce((acc, val) => 
            acc + (parseFloat(String(val).replace(',', '.')) || 0), 0
        ), 
        [props.mistoValues]
    );

    const mistoIsValid = useMemo(() => 
        Math.abs(mistoTotal - cartTotal) < 0.05,
        [mistoTotal, cartTotal]
    );

    // Troco
    const changeDue = useMemo(() => {
        const paid = parseFloat((amountPaid || '0').replace(',', '.')) || 0;
        return Math.max(0, paid - cartTotal);
    }, [amountPaid, cartTotal]);

    // Handler otimizado para adicionar ao carrinho
    const handleMobileAddToCart = useCallback((item: IceCreamItem) => {
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
    }, [props.effectiveStoreId, props.setCart]);

    // Validação antes de finalizar
    const validateSale = useCallback(() => {
        const newErrors: typeof errors = {};
        
        if (!props.paymentMethod) {
            newErrors.payment = 'Selecione forma de pagamento';
        }
        
        if (props.paymentMethod === 'Fiado' && !props.buyerName?.trim()) {
            newErrors.buyer = 'Nome obrigatório para fiado';
        }
        
        if (props.paymentMethod === 'Misto') {
            if (!mistoIsValid) {
                newErrors.misto = `Diferença: ${formatCurrency(Math.abs(cartTotal - mistoTotal))}`;
            }
            if (props.mistoValues['Fiado'] && !props.buyerName?.trim()) {
                newErrors.buyer = 'Nome obrigatório para fiado';
            }
        }
        
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    }, [props.paymentMethod, props.buyerName, props.mistoValues, mistoIsValid, cartTotal, mistoTotal]);

    // Handler de finalização
    const handleFinalize = useCallback(async () => {
        if (!props.cart || props.cart.length === 0) return;
        
        // Validar antes de prosseguir
        if (!validateSale()) {
            return;
        }
        
        const isMisto = props.paymentMethod === 'Misto';
        const splitData = isMisto 
            ? Object.entries(props.mistoValues || {}).map(([method, val]) => ({
                method: method as IceCreamPaymentMethod,
                amount: parseFloat((val as string).replace(',', '.')) || 0
            })).filter(p => p.amount > 0) 
            : [{ method: props.paymentMethod as IceCreamPaymentMethod, amount: cartTotal }];

        props.setIsSubmitting(true);
        const saleCode = `GEL-M${Date.now().toString().slice(-6)}`;
        
        try {
            const saleData = {
                store_id: props.effectiveStoreId,
                total: cartTotal,
                sale_code: saleCode,
                buyer_name: (props.paymentMethod === 'Fiado' || (isMisto && props.mistoValues['Fiado'])) ? props.buyerName?.toUpperCase() : undefined
            };

            let operationalSales: IceCreamDailySale[] = [];

            if (!isMisto) {
                operationalSales = props.cart.map(item => ({
                    ...item,
                    paymentMethod: props.paymentMethod as IceCreamPaymentMethod,
                    buyer_name: saleData.buyer_name,
                    saleCode,
                    status: 'completed' as const
                }));
            } else {
                let remainingPayments = splitData.map(p => ({ ...p }));

                operationalSales = props.cart.map(item => {
                    let selectedMethod: IceCreamPaymentMethod | null = null;

                    for (let i = 0; i < remainingPayments.length; i++) {
                        if (remainingPayments[i].amount >= item.totalValue) {
                            selectedMethod = remainingPayments[i].method;
                            remainingPayments[i].amount -= item.totalValue;
                            break;
                        }
                    }

                    if (!selectedMethod) {
                        throw new Error("Erro na distribuição da venda mista. Valores inconsistentes.");
                    }

                    return {
                        ...item,
                        paymentMethod: selectedMethod,
                        buyer_name: saleData.buyer_name,
                        saleCode,
                        status: 'completed' as const
                    };
                });
            }

            await props.onAddSaleAtomic(saleData, operationalSales, splitData);
            
            // Atualização de estoque em lote
            const stockUpdates: Promise<void>[] = [];
            for (const c of props.cart) {
                const itemDef = props.items?.find(it => it.id === c.itemId);
                if (itemDef?.recipe) {
                    for (const ing of itemDef.recipe) {
                        stockUpdates.push(props.onUpdateStock(props.effectiveStoreId, ing.stock_base_name, -(ing.quantity * c.unitsSold), '', 'adjustment'));
                    }
                }
            }
            if (stockUpdates.length > 0) await Promise.all(stockUpdates);

            props.handlePrintTicket(operationalSales, saleCode, isMisto ? 'Misto' : (props.paymentMethod as string), (props.paymentMethod === 'Fiado' || (isMisto && props.mistoValues['Fiado'])) ? props.buyerName : undefined);
            
            // Limpar estado
            props.setCart([]); 
            props.setPaymentMethod(null); 
            props.setBuyerName(''); 
            setAmountPaid('');
            setErrors({});
            setStep('categories');
            alert("Venda registrada com sucesso!");
        } catch (e: any) { 
            alert(e.message || "Erro ao finalizar venda."); 
        } finally { 
            props.setIsSubmitting(false); 
        }
    }, [props, cartTotal, validateSale, mistoTotal]);

    // Handler de navegação
    const handleBack = useCallback(() => {
        setStep(step === 'cart' ? 'products' : 'categories');
        setErrors({});
    }, [step]);

    return (
        <div className="flex flex-col h-full bg-[#F8F9FA] dark:bg-slate-950 text-gray-900 dark:text-slate-100 font-sans relative overflow-hidden transition-colors duration-300">
            {/* Header */}
            <header className="px-4 sm:px-6 py-3 sm:py-4 bg-white dark:bg-slate-900 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between shrink-0 transition-colors duration-300">
                {step !== 'categories' ? (
                    <button 
                        onClick={handleBack}
                        aria-label={step === 'cart' ? 'Voltar para produtos' : 'Voltar para categorias'}
                        className="p-2 -ml-2 text-gray-400 dark:text-slate-500 active:text-blue-600 dark:active:text-blue-400 transition-colors"
                    >
                        <ChevronLeft size={24} />
                    </button>
                ) : <div className="w-8" />}
                <h1 className="text-xs sm:text-sm font-black uppercase tracking-widest text-blue-950 dark:text-white italic">
                    Gelateria <span className="text-red-600">Real</span>
                </h1>
                <div className="w-8" />
            </header>

            {/* Main Content */}
            <main className="flex-1 overflow-y-auto pb-44 p-3 sm:p-4 md:p-6 no-scrollbar">
                {/* Categorias */}
                {step === 'categories' && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4 animate-in fade-in zoom-in duration-300">
                        {CATEGORIES.map(cat => (
                            <button 
                                key={cat} 
                                onClick={() => { props.setSelectedCategory(cat as any); setStep('products'); }} 
                                aria-label={`Ver produtos da categoria ${cat}`}
                                className="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-[28px] p-4 sm:p-6 shadow-[4px_4px_10px_rgba(0,0,0,0.03)] dark:shadow-[4px_4px_10px_rgba(0,0,0,0.2)] border border-gray-50 dark:border-slate-800 flex flex-col items-center gap-2 sm:gap-3 active:scale-95 transition-all hover:border-blue-200 dark:hover:border-blue-800"
                            >
                                <div className="w-12 h-12 sm:w-16 sm:h-16 flex items-center justify-center">
                                    <img 
                                        src={getCategoryImage(cat, cat)} 
                                        className="w-full h-full object-contain" 
                                        alt=""
                                        loading="lazy"
                                    />
                                </div>
                                <span className="font-black uppercase text-[9px] sm:text-[10px] text-blue-950 dark:text-white tracking-tighter text-center">
                                    {cat}
                                </span>
                            </button>
                        ))}
                    </div>
                )}

                {/* Produtos */}
                {step === 'products' && (
                    <div className="space-y-2 sm:space-y-3 animate-in slide-in-from-right duration-300">
                        {filteredProducts.length === 0 ? (
                            <div className="text-center py-12 text-gray-400 dark:text-slate-500">
                                <IceCream size={48} className="mx-auto mb-3 opacity-30" />
                                <p className="text-sm font-bold">Nenhum produto disponível</p>
                            </div>
                        ) : (
                            filteredProducts.map(item => (
                                <button 
                                    key={item.id} 
                                    onClick={() => handleMobileAddToCart(item)} 
                                    aria-label={`Adicionar ${item.name} por ${formatCurrency(item.price)}`}
                                    className="w-full bg-white dark:bg-slate-900 p-3 sm:p-4 rounded-2xl sm:rounded-[24px] shadow-sm border border-gray-100 dark:border-slate-800 flex items-center gap-3 sm:gap-4 active:scale-95 transition-all hover:border-blue-200 dark:hover:border-blue-700"
                                >
                                    <div className="w-14 h-14 sm:w-16 sm:h-16 bg-[#F1F3F6] dark:bg-slate-800 rounded-xl sm:rounded-2xl flex items-center justify-center shrink-0 overflow-hidden">
                                        <img 
                                            src={item.image_url || getCategoryImage(item.category, item.name)} 
                                            className="w-full h-full object-contain p-2" 
                                            alt=""
                                            loading="lazy"
                                        />
                                    </div>
                                    <div className="text-left flex-1 min-w-0">
                                        <p className="font-black uppercase italic text-[11px] sm:text-xs text-blue-950 dark:text-white leading-tight truncate">
                                            {item.name}
                                        </p>
                                        <p className="text-[10px] sm:text-[11px] font-bold text-blue-600 dark:text-blue-400 mt-0.5 sm:mt-1">
                                            {formatCurrency(item.price)}
                                        </p>
                                    </div>
                                    <div className="bg-[#F8F9FA] dark:bg-slate-800 p-1.5 sm:p-2 rounded-lg sm:rounded-xl border border-gray-100 dark:border-slate-700">
                                        <Plus size={16} className="sm:w-[18px] sm:h-[18px] text-blue-900 dark:text-blue-400" />
                                    </div>
                                </button>
                            ))
                        )}
                    </div>
                )}

                {/* Carrinho */}
                {step === 'cart' && (
                    <div className="space-y-4 sm:space-y-6 animate-in slide-in-from-bottom duration-300">
                        {/* Itens do Carrinho */}
                        <div className="space-y-2 sm:space-y-3">
                            {props.cart?.length === 0 ? (
                                <div className="text-center py-12 text-gray-400 dark:text-slate-500">
                                    <ShoppingCart size={48} className="mx-auto mb-3 opacity-30" />
                                    <p className="text-sm font-bold">Carrinho vazio</p>
                                </div>
                            ) : (
                                props.cart?.map((item) => (
                                    <div 
                                        key={item.id} 
                                        className="bg-white dark:bg-slate-900 p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-gray-100 dark:border-slate-800 flex justify-between items-center gap-3"
                                    >
                                        <div className="flex-1 pr-3 sm:pr-4 min-w-0">
                                            <p className="font-black uppercase text-[10px] sm:text-[11px] text-blue-950 dark:text-white truncate">
                                                {item.productName}
                                            </p>
                                            <p className="text-[9px] sm:text-[10px] text-gray-400 dark:text-slate-500 font-bold mt-0.5">
                                                {formatCurrency(item.unitPrice)}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-3 sm:gap-4 shrink-0">
                                            <span className="font-black text-xs sm:text-sm text-blue-900 dark:text-blue-400">
                                                {formatCurrency(item.totalValue)}
                                            </span>
                                            <button 
                                                onClick={() => props.setCart(prev => prev.filter(i => i.id !== item.id))} 
                                                aria-label={`Remover ${item.productName}`}
                                                className="text-red-300 dark:text-red-400 hover:text-red-500 dark:hover:text-red-300 p-1 transition-colors"
                                            >
                                                <Trash2 size={16} className="sm:w-[18px] sm:h-[18px]" />
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        {/* Seção de Pagamento */}
                        {props.cart?.length > 0 && (
                            <div className="bg-white dark:bg-slate-900 p-4 sm:p-6 rounded-2xl sm:rounded-[32px] shadow-sm border border-gray-100 dark:border-slate-800 space-y-3 sm:space-y-4">
                                <h3 className="text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest border-b border-gray-100 dark:border-slate-800 pb-2 sm:pb-3">
                                    Pagamento
                                </h3>
                                
                                {/* Erro de pagamento */}
                                {errors.payment && (
                                    <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/30 rounded-xl text-red-600 dark:text-red-400 text-[10px] font-bold animate-in slide-in-from-top-2 duration-200">
                                        <AlertCircle size={14} />
                                        <span>{errors.payment}</span>
                                    </div>
                                )}

                                {/* Métodos de Pagamento */}
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
                                    {PAYMENT_METHODS.map(pm => (
                                        <button 
                                            key={pm} 
                                            type="button"
                                            onClick={() => { props.setPaymentMethod(pm); setErrors(prev => ({ ...prev, payment: undefined })); }}
                                            aria-label={`Pagar com ${pm}`}
                                            aria-pressed={props.paymentMethod === pm}
                                            className={`py-2.5 sm:py-3 rounded-lg sm:rounded-xl font-black uppercase text-[9px] sm:text-[10px] border-2 transition-all ${props.paymentMethod === pm ? 'bg-blue-900 dark:bg-blue-700 border-blue-900 dark:border-blue-700 text-white shadow-lg scale-105' : 'bg-[#F8F9FA] dark:bg-slate-800 border-transparent text-gray-400 dark:text-slate-500 hover:border-gray-200 dark:hover:border-slate-700'}`}
                                        >
                                            {pm}
                                        </button>
                                    ))}
                                </div>

                                {/* Dinheiro - Campo de Valor Recebido */}
                                {props.paymentMethod === 'Dinheiro' && (
                                    <div className="p-3 sm:p-4 bg-[#F1F3F6] dark:bg-slate-800 rounded-xl sm:rounded-2xl space-y-2 animate-in zoom-in duration-200">
                                        <div className="flex justify-between items-center">
                                            <label htmlFor="amount-paid" className="text-[9px] sm:text-[10px] font-black uppercase text-gray-500 dark:text-slate-400">
                                                Valor Recebido
                                            </label>
                                            <input 
                                                id="amount-paid"
                                                type="tel"
                                                inputMode="decimal"
                                                value={amountPaid} 
                                                onChange={e => setAmountPaid(e.target.value)} 
                                                placeholder="0,00" 
                                                className="w-20 sm:w-24 text-right bg-white dark:bg-slate-900 dark:text-white rounded-lg p-2 font-black text-sm outline-none shadow-inner border border-gray-200 dark:border-slate-700 focus:border-blue-500 dark:focus:border-blue-400 transition-colors" 
                                            />
                                        </div>
                                        <div className="flex justify-between border-t border-gray-200 dark:border-slate-700 pt-2">
                                            <span className="text-[9px] sm:text-[10px] font-black uppercase text-green-600 dark:text-green-400">
                                                Troco
                                            </span>
                                            <span className="font-black text-sm sm:text-base text-green-700 dark:text-green-300">
                                                {formatCurrency(changeDue)}
                                            </span>
                                        </div>
                                    </div>
                                )}

                                {/* Pagamento Misto */}
                                {props.paymentMethod === 'Misto' && (
                                    <div className={`p-3 sm:p-4 rounded-xl sm:rounded-2xl space-y-2 animate-in zoom-in duration-200 border transition-colors ${mistoIsValid ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-900/30' : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-900/30'}`}>
                                        {/* Feedback Visual */}
                                        {!mistoIsValid && (
                                            <div className="flex items-center gap-2 p-2 bg-white dark:bg-slate-900 rounded-lg text-red-600 dark:text-red-400 text-[10px] font-bold mb-2">
                                                <AlertCircle size={14} />
                                                <span>{errors.misto || `Falta: ${formatCurrency(Math.abs(cartTotal - mistoTotal))}`}</span>
                                            </div>
                                        )}

                                        {MISTO_METHODS.map(m => (
                                            <div key={m} className="flex justify-between items-center bg-white dark:bg-slate-900 px-3 py-2 rounded-lg sm:rounded-xl border border-gray-100 dark:border-slate-800 shadow-sm">
                                                <label htmlFor={`misto-${m}`} className="text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase">
                                                    {m}
                                                </label>
                                                <input 
                                                    id={`misto-${m}`}
                                                    type="tel"
                                                    inputMode="decimal"
                                                    value={props.mistoValues[m] || ''} 
                                                    onChange={e => {
                                                        props.setMistoValues({...props.mistoValues, [m]: e.target.value});
                                                        setErrors(prev => ({ ...prev, misto: undefined }));
                                                    }}
                                                    placeholder="0,00" 
                                                    className="w-20 sm:w-24 text-right font-black text-blue-900 dark:text-blue-400 text-xs outline-none bg-transparent" 
                                                />
                                            </div>
                                        ))}

                                        {/* Total Misto */}
                                        <div className="flex justify-between items-center pt-2 border-t border-gray-200 dark:border-slate-700">
                                            <span className="text-[9px] font-black uppercase text-gray-500 dark:text-slate-400">
                                                Total Informado
                                            </span>
                                            <span className={`font-black text-sm ${mistoIsValid ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                                {formatCurrency(mistoTotal)}
                                            </span>
                                        </div>
                                    </div>
                                )}

                                {/* Campo Nome (Fiado) */}
                                {(props.paymentMethod === 'Fiado' || (props.paymentMethod === 'Misto' && props.mistoValues?.['Fiado'])) && (
                                    <div className="space-y-2 animate-in slide-in-from-top-2 duration-200">
                                        <label htmlFor="buyer-name" className="text-[9px] sm:text-[10px] font-black text-red-500 dark:text-red-400 uppercase ml-1">
                                            Colaborador *
                                        </label>
                                        <input 
                                            id="buyer-name"
                                            type="text"
                                            value={props.buyerName} 
                                            onChange={e => {
                                                props.setBuyerName(e.target.value.toUpperCase());
                                                setErrors(prev => ({ ...prev, buyer: undefined }));
                                            }}
                                            list="mobile-buyers-list"
                                            placeholder="NOME DO FUNCIONÁRIO..." 
                                            aria-required="true"
                                            aria-invalid={!!errors.buyer}
                                            aria-describedby={errors.buyer ? "buyer-error" : undefined}
                                            className={`w-full p-3 sm:p-4 border-2 rounded-xl sm:rounded-2xl font-black uppercase text-[10px] sm:text-[11px] outline-none shadow-inner transition-colors ${errors.buyer ? 'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-900/30 text-red-700 dark:text-red-300' : 'bg-red-50 dark:bg-red-900/20 dark:text-white border-transparent focus:border-red-300 dark:focus:border-red-700'}`}
                                        />
                                        <datalist id="mobile-buyers-list">
                                            {(props.existingBuyerNames || []).map(n => <option key={n} value={n} />)}
                                        </datalist>
                                        {errors.buyer && (
                                            <p id="buyer-error" className="text-red-600 dark:text-red-400 text-[9px] font-bold ml-1 flex items-center gap-1">
                                                <AlertCircle size={12} />
                                                {errors.buyer}
                                            </p>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </main>

            {/* Bottom Sheet - Finalização */}
            {props.cart?.length > 0 && (
                <div 
                    className="fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-900 px-4 sm:px-6 py-5 sm:py-6 pb-8 sm:pb-10 shadow-[0_-10px_30px_rgba(0,0,0,0.05)] dark:shadow-[0_-10px_30px_rgba(0,0,0,0.3)] rounded-t-3xl sm:rounded-t-[40px] z-50 animate-in slide-in-from-bottom duration-500 border-t border-gray-100 dark:border-slate-800"
                    style={{ paddingBottom: 'max(2.5rem, env(safe-area-inset-bottom))' }}
                >
                    <div className="flex justify-between items-center mb-4 sm:mb-5">
                        <div className="flex flex-col">
                            <span className="text-[9px] sm:text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest leading-none mb-1">
                                Total Final
                            </span>
                            <span className="text-xl sm:text-2xl font-black italic text-blue-950 dark:text-white leading-none">
                                {formatCurrency(cartTotal)}
                            </span>
                        </div>
                        <div className="bg-[#F8F9FA] dark:bg-slate-800 px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl sm:rounded-2xl font-black text-[9px] sm:text-[10px] text-blue-900 dark:text-blue-400 border border-gray-100 dark:border-slate-700">
                            {props.cart.length} {props.cart.length === 1 ? 'ITEM' : 'ITENS'}
                        </div>
                    </div>
                    <button 
                        onClick={handleFinalize} 
                        disabled={props.isSubmitting || !props.paymentMethod} 
                        aria-label="Finalizar venda"
                        className="w-full py-4 sm:py-5 bg-red-600 text-white rounded-2xl sm:rounded-[24px] font-black uppercase text-[11px] sm:text-xs shadow-[0_10px_20px_rgba(220,38,38,0.3)] active:scale-95 disabled:bg-gray-300 dark:disabled:bg-slate-700 disabled:text-gray-500 dark:disabled:text-slate-500 disabled:shadow-none disabled:cursor-not-allowed flex items-center justify-center gap-2 sm:gap-3 transition-all border-b-4 border-red-900 disabled:border-gray-400 dark:disabled:border-slate-600"
                    >
                        {props.isSubmitting ? (
                            <>
                                <Loader2 className="animate-spin" size={18} />
                                <span>Processando...</span>
                            </>
                        ) : (
                            <>
                                <CheckCircle2 size={18} className="sm:w-5 sm:h-5" />
                                <span>Finalizar Venda</span>
                            </>
                        )}
                    </button>
                </div>
            )}
        </div>
    );
};

export default PDVMobileView;
