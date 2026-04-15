import React, { useState, useMemo } from 'react';
import { ShoppingCart, Trash2, CheckCircle2, Loader2 } from 'lucide-react';
import { IceCreamDailySale, IceCreamPaymentMethod, IceCreamItem, IceCreamCategory, UserRole } from '../../../types';
import { formatCurrency } from '../../../constants';
import PDVMobileView from '../../PDVMobileView';
import { ProductGrid } from '../../ProductGrid';
import { PRODUCT_CATEGORIES } from '../constants';

interface PDVTabProps {
    user: any;
    items: IceCreamItem[];
    effectiveStoreId: string;
    onAddSales: (sale: IceCreamDailySale[]) => Promise<void>;
    onAddSaleAtomic: (saleData: any, items: IceCreamDailySale[], payments: { method: IceCreamPaymentMethod, amount: number }[]) => Promise<void>;
    onUpdateStock: (storeId: string, base: string, value: number, unit: string, type: any, stockId?: string) => Promise<void>;
    handleOpenPrintPreview: (items: IceCreamDailySale[], saleCode: string, method: string | null, buyer?: string) => void;
    existingBuyerNames: string[];
    iceCreamSales: IceCreamDailySale[];
}

const PDVTab: React.FC<PDVTabProps> = ({
    user,
    items,
    effectiveStoreId,
    onAddSales,
    onAddSaleAtomic,
    onUpdateStock,
    handleOpenPrintPreview,
    existingBuyerNames,
    iceCreamSales
}) => {
    const [cart, setCart] = useState<IceCreamDailySale[]>([]);
    const [selectedCategory, setSelectedCategory] = useState<IceCreamCategory | null>(null);
    const [paymentMethod, setPaymentMethod] = useState<IceCreamPaymentMethod | 'Misto' | null>(null);
    const [mistoValues, setMistoValues] = useState<Record<string, string>>({ 'Pix': '', 'Dinheiro': '', 'Cartão': '', 'Fiado': '' });
    const [buyerName, setBuyerName] = useState('');
    const [amountReceived, setAmountReceived] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const filteredItems = useMemo(() => {
        // Usar ranking se disponível
        const rankedItems = items
            .filter(i => i.storeId === effectiveStoreId && i.active)
            .map(item => {
                // Adicionar contador de vendas (se disponível no cache)
                const salesCount = iceCreamSales
                    .filter(s => s.itemId === item.id && s.status !== 'canceled')
                    .length;
                return { ...item, salesCount };
            })
            .sort((a, b) => {
                // Ordenar por vendas (decrescente), depois alfabético
                if (b.salesCount !== a.salesCount) {
                    return b.salesCount - a.salesCount;
                }
                return a.name.localeCompare(b.name);
            });
        
        return rankedItems;
    }, [items, effectiveStoreId, iceCreamSales]);
    const cartTotal = useMemo(() => cart.reduce((acc, curr) => acc + curr.totalValue, 0), [cart]);

    const changeDue = useMemo(() => {
        const paid = parseFloat((amountReceived as string).replace(',', '.')) || 0;
        return Math.max(0, paid - cartTotal);
    }, [amountReceived, cartTotal]);

    const finalizeSale = async () => {
        if (cart.length === 0 || !paymentMethod) return;
        const isMisto = paymentMethod === 'Misto';
        const splitData = isMisto 
          ? Object.entries(mistoValues)
              .map(([method, val]) => ({ 
                method: method as IceCreamPaymentMethod, 
                amount: parseFloat((val as string).replace(',', '.')) || 0 
              }))
              .filter(p => p.amount > 0) 
          : [{ method: paymentMethod as IceCreamPaymentMethod, amount: cartTotal }];

        if (isMisto && Math.abs(splitData.reduce((a, b) => a + b.amount, 0) - cartTotal) > 0.01) { 
          alert("A soma dos pagamentos não confere com o total da venda."); 
          return; 
        }

        const hasFiado = splitData.some(p => p.method === 'Fiado');
        if (hasFiado && !buyerName.trim()) {
          alert("O nome do comprador é obrigatório para vendas no Fiado.");
          return;
        }

        setIsSubmitting(true);
        const saleCode = `GEL-${Date.now().toString().slice(-6)}`;
        
        try {
          const saleData = {
            store_id: effectiveStoreId,
            total: cartTotal,
            sale_code: saleCode,
            buyer_name: hasFiado ? buyerName.trim().toUpperCase() : null
          };

          const operationalSales = cart.map(item => ({ 
            ...item, 
            paymentMethod: (isMisto ? 'Misto' : paymentMethod) as IceCreamPaymentMethod, 
            buyer_name: saleData.buyer_name, 
            saleCode, 
            unitsSold: Math.round(item.unitsSold), 
            status: 'completed' as const 
          }));

          await onAddSaleAtomic(saleData, operationalSales, splitData);

          const stockUpdates: Promise<void>[] = [];
          for (const c of cart) {
            const itemDef = items.find(it => it.id === c.itemId);
            if (itemDef?.recipe) {
              for (const ingredient of itemDef.recipe) { 
                stockUpdates.push(onUpdateStock(effectiveStoreId, String(ingredient.stock_base_name).toUpperCase(), -(ingredient.quantity * c.unitsSold), '', 'adjustment')); 
              }
            }
          }
          if (stockUpdates.length > 0) await Promise.all(stockUpdates);

          handleOpenPrintPreview(operationalSales, saleCode, isMisto ? 'Misto' : (paymentMethod as string), saleData.buyer_name);
          setCart([]); 
          setPaymentMethod(null); 
          setBuyerName(''); 
          setAmountReceived(''); 
          setMistoValues({ 'Pix': '', 'Dinheiro': '', 'Cartão': '', 'Fiado': '' });
        } catch (e: any) {
          alert("Erro ao finalizar venda: " + e.message);
        } finally {
          setIsSubmitting(false);
        }
    };

    return (
        <div className="h-full">
            <div className="lg:hidden h-full">
                <PDVMobileView 
                    user={user} 
                    items={filteredItems} 
                    cart={cart} 
                    setCart={setCart} 
                    selectedCategory={selectedCategory} 
                    setSelectedCategory={setSelectedCategory} 
                    paymentMethod={paymentMethod} 
                    setPaymentMethod={setPaymentMethod} 
                    buyerName={buyerName} 
                    setBuyerName={setBuyerName} 
                    mistoValues={mistoValues} 
                    setMistoValues={setMistoValues} 
                    onAddSales={onAddSales} 
                    onAddSaleAtomic={onAddSaleAtomic}
                    onUpdateStock={onUpdateStock} 
                    handlePrintTicket={handleOpenPrintPreview} 
                    isSubmitting={isSubmitting} 
                    setIsSubmitting={setIsSubmitting} 
                    effectiveStoreId={effectiveStoreId} 
                    existingBuyerNames={existingBuyerNames}
                />
            </div>
            <div className="hidden lg:grid grid-cols-12 gap-4 p-6 max-w-[1500px] mx-auto h-full overflow-hidden">
                <div className="col-span-8 flex flex-col h-full overflow-hidden">
                    <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-3">
                        <button onClick={() => setSelectedCategory(null)} className={`px-5 py-2 rounded-xl font-black uppercase text-[10px] border-2 transition-all ${!selectedCategory ? 'bg-blue-900 text-white border-blue-900 shadow-lg' : 'bg-white text-gray-400 border-gray-100'}`}>Tudo</button>
                        {PRODUCT_CATEGORIES.map(cat => <button key={cat} onClick={() => setSelectedCategory(cat)} className={`px-5 py-2 rounded-xl font-black uppercase text-[10px] border-2 transition-all whitespace-nowrap ${selectedCategory === cat ? 'bg-blue-900 text-white border-blue-900 shadow-lg' : 'bg-white text-gray-400 border-gray-100'}`}>{cat}</button>)}
                    </div>
                    
                    <ProductGrid 
                        items={filteredItems} 
                        selectedCategory={selectedCategory}
                        onAddToCart={(item) => {
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
                        }}
                    />

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
                            {['Pix', 'Dinheiro', 'Cartão', 'Fiado', 'Misto'].map(m => <button key={m} onClick={() => { setPaymentMethod(m as any); if(m !== 'Dinheiro' && m !== 'Misto' && m !== 'Fiado') setAmountReceived(''); }} className={`py-3 rounded-xl font-black uppercase text-[10px] border-2 transition-all ${paymentMethod === m ? 'bg-blue-900 text-white border-blue-900 shadow-xl' : 'bg-white border-gray-200 text-gray-400'}`}>{m}</button>)}
                        </div>
                        {paymentMethod === 'Dinheiro' && (
                            <div className="bg-green-50 p-4 rounded-2xl border-2 border-green-200 space-y-3">
                                <div className="flex justify-between items-center"><label className="text-[10px] font-black text-green-700 uppercase">Valor Recebido</label><input value={amountReceived} onChange={e => setAmountReceived(e.target.value)} placeholder="0,00" className="w-32 text-right bg-white border-none rounded-xl p-3 font-black text-green-700 outline-none text-lg shadow-inner" /></div>
                                <div className="flex justify-between items-baseline border-t border-green-100 pt-2"><span className="text-[10px] font-black text-green-700 uppercase">Troco</span><span className="text-2xl font-black text-green-700 italic">{formatCurrency(changeDue)}</span></div>
                            </div>
                        )}
                        {paymentMethod === 'Misto' && (
                            <div className="bg-blue-50 p-4 rounded-2xl border-2 border-blue-200 space-y-2">
                                {['Pix', 'Dinheiro', 'Cartão', 'Fiado'].map(m => <div key={m} className="flex justify-between items-center bg-white px-3 py-2 rounded-lg border border-blue-50"><label className="text-[10px] font-black text-gray-500 uppercase">{m}</label><input value={mistoValues[m]} onChange={e => setMistoValues({...mistoValues, [m]: e.target.value})} placeholder="0,00" className="w-20 text-right font-black text-blue-900 text-xs outline-none bg-transparent" /></div>)}
                            </div>
                        )}
                        {(paymentMethod === 'Fiado' || (paymentMethod === 'Misto' && mistoValues['Fiado'])) && <input value={buyerName} onChange={e => setBuyerName(e.target.value.toUpperCase())} className="w-full p-4 bg-red-50 border-2 border-red-100 rounded-2xl font-black uppercase text-sm outline-none" placeholder="NOME DO FUNCIONÁRIO..." />}
                        <button 
                            onClick={finalizeSale} 
                            disabled={isSubmitting || cart.length === 0 || !paymentMethod} 
                            className="w-full py-5 bg-red-600 hover:bg-red-700 text-white rounded-[24px] font-black uppercase text-xs shadow-2xl flex items-center justify-center gap-3 transition-all border-b-4 border-red-900"
                        >
                            {isSubmitting ? <Loader2 className="animate-spin" /> : <CheckCircle2 size={18}/>} 
                            Finalizar Venda
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PDVTab;
