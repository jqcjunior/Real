
import React, { useState } from 'react';
import { 
    IceCreamItem, IceCreamDailySale, IceCreamTransaction, IceCreamCategory, 
    IceCreamExpenseCategory, IceCreamPaymentMethod, User, UserRole 
} from '../types';
import { formatCurrency } from '../constants';
import { 
    ShoppingCart, FileText, ArrowDownCircle, Plus, Trash2, 
    CheckCircle2, Hash, CreditCard, Banknote, X, ChevronRight, 
    Printer, List, PieChart, Save, Loader2, ArrowUpCircle, Ban, Info
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
  const [mobileTab, setMobileTab] = useState<'vender' | 'dre' | 'saida'>('vender');
  const [step, setStep] = useState<'categories' | 'products' | 'details' | 'cart'>('categories');

  const isAdminOrManager = props.user.role === UserRole.ADMIN || props.user.role === UserRole.MANAGER;

  // Helpers de Filtragem
  const categoryItems = props.selectedCategory 
    ? Array.from(new Set(props.items.filter(i => i.category === props.selectedCategory && i.active).map(i => i.name))).sort()
    : [];

  const itemFlavors = props.selectedProductName && props.selectedCategory
    ? props.items.filter(i => i.name === props.selectedProductName && i.category === props.selectedCategory && i.active)
    : [];

  const handleFinalize = async () => {
    if (props.cart.length === 0 || !props.paymentMethod) return;
    props.setIsSubmitting(true);
    const currentTime = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    try {
        await props.onAddSales(props.cart);
        props.setLastSoldItems([...props.cart]);
        props.setLastSaleTime(currentTime);
        props.setCart([]);
        props.setShowTicketModal(true);
        setStep('categories');
    } catch (e) {
        alert("Erro ao finalizar venda.");
    } finally {
        props.setIsSubmitting(false);
    }
  };

  const handleCancel = async (sale: IceCreamDailySale) => {
    if (!isAdminOrManager) return;
    const reason = prompt(`Motivo do cancelamento da venda ${sale.saleCode}:`);
    if (reason) {
        props.setIsSubmitting(true);
        try {
            await props.onCancelSale(sale.saleCode || '', reason);
            alert("Venda cancelada!");
        } catch (e) {
            alert("Erro ao cancelar.");
        } finally {
            props.setIsSubmitting(false);
        }
    }
  };

  const handleSaveExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(props.financeForm.value.replace(/\./g, '').replace(',', '.'));
    if (isNaN(val) || val <= 0) { alert("Valor inválido."); return; }
    props.setIsSubmitting(true);
    try {
        await props.onAddTransaction({
            id: `tx-${Date.now()}`,
            date: props.financeForm.date,
            type: 'exit',
            category: props.financeForm.category,
            value: val,
            employeeName: props.financeForm.employeeName,
            description: props.financeForm.description,
            createdAt: new Date()
        });
        props.setFinanceForm((prev: any) => ({ ...prev, value: '', description: '' }));
        alert("Saída registrada!");
    } catch (e) { alert("Erro ao salvar."); } finally { props.setIsSubmitting(false); }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50 text-gray-900 font-sans">
      {/* Header Fixo Mobile */}
      <header className="bg-white border-b px-4 py-3 flex justify-between items-center sticky top-0 z-50">
        <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-700 rounded-lg text-white"><ShoppingCart size={18}/></div>
            <h1 className="font-black uppercase italic text-sm tracking-tighter">Real <span className="text-red-600">PDV Mobile</span></h1>
        </div>
        <div className="text-[10px] font-black uppercase text-gray-400">Op: {props.user.name.split(' ')[0]}</div>
      </header>

      {/* Área de Conteúdo Scrollable */}
      <main className="flex-1 overflow-y-auto pb-24 px-4 pt-4">
        
        {mobileTab === 'vender' && (
          <div className="space-y-4">
            {/* Steps do Fluxo de Venda */}
            {step === 'categories' && (
              <div className="grid grid-cols-2 gap-3">
                {['Sundae', 'Milkshake', 'Casquinha', 'Cascão', 'Bebidas', 'Adicionais'].sort().map(cat => (
                  <button 
                    key={cat} 
                    onClick={() => { props.setSelectedCategory(cat as any); setStep('products'); }}
                    className="aspect-square bg-white border-2 border-gray-100 rounded-3xl flex flex-col items-center justify-center gap-2 shadow-sm active:bg-blue-50 active:border-blue-200 transition-all"
                  >
                    <span className="font-black uppercase italic text-xs text-blue-700">{cat}</span>
                  </button>
                ))}
              </div>
            )}

            {step === 'products' && (
              <div className="space-y-3 animate-in slide-in-from-right duration-200">
                <button onClick={() => setStep('categories')} className="text-[10px] font-black text-gray-400 uppercase flex items-center gap-1 mb-2">← Voltar Categorias</button>
                <div className="grid grid-cols-1 gap-2">
                  {categoryItems.map(name => (
                    <button 
                      key={name} 
                      onClick={() => { props.setSelectedProductName(name); setStep('details'); }}
                      className="w-full p-6 bg-white border-2 border-gray-100 rounded-2xl flex justify-between items-center shadow-sm active:scale-[0.98]"
                    >
                      <span className="font-black uppercase italic text-sm">{name}</span>
                      <ChevronRight size={18} className="text-gray-300"/>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {step === 'details' && props.selectedProductName && (
              <div className="space-y-6 animate-in slide-in-from-right duration-200">
                <button onClick={() => setStep('products')} className="text-[10px] font-black text-gray-400 uppercase flex items-center gap-1">← Voltar Produtos</button>
                
                <div className="bg-white p-6 rounded-[32px] shadow-md border border-gray-100 space-y-6">
                    <div>
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-3">Selecione o Sabor</label>
                      <div className="grid grid-cols-2 gap-2">
                        {itemFlavors.map(item => (
                          <button 
                            key={item.id} 
                            onClick={() => props.setSelectedItem(item)}
                            className={`p-4 rounded-xl border-2 text-left transition-all ${props.selectedItem?.id === item.id ? 'bg-red-50 border-red-600' : 'bg-gray-50 border-transparent'}`}
                          >
                            <p className="text-[9px] font-black uppercase text-red-600">{item.flavor || 'Padrão'}</p>
                            <p className="text-lg font-black">{formatCurrency(item.price)}</p>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-3">Tamanho</label>
                      <div className="grid grid-cols-3 gap-2">
                        {['180ml', '300ml', '400ml', '500ml', '700ml'].map(ml => (
                          <button 
                            key={ml} 
                            onClick={() => props.setSelectedMl(ml)}
                            className={`py-3 rounded-lg text-[10px] font-black border-2 ${props.selectedMl === ml ? 'bg-gray-900 border-gray-900 text-white' : 'bg-white border-gray-100 text-gray-400'}`}
                          >
                            {ml}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-4 pt-4 border-t">
                      <div className="flex items-center gap-4 bg-gray-100 p-1.5 rounded-xl">
                        <button onClick={() => props.setQuantity(Math.max(1, props.quantity - 1))} className="w-10 h-10 bg-white rounded-lg flex items-center justify-center font-black">-</button>
                        <span className="font-black text-xl w-6 text-center">{props.quantity}</span>
                        <button onClick={() => props.setQuantity(props.quantity + 1)} className="w-10 h-10 bg-white rounded-lg flex items-center justify-center font-black">+</button>
                      </div>
                      <button 
                        onClick={() => {
                          const newItem: IceCreamDailySale = {
                            id: `cart-${Date.now()}`,
                            itemId: props.selectedItem!.id,
                            productName: props.selectedItem!.name,
                            category: props.selectedItem!.category,
                            flavor: props.selectedItem!.flavor || '',
                            ml: props.selectedMl,
                            unitsSold: props.quantity,
                            unitPrice: props.selectedItem!.price,
                            totalValue: Number((props.selectedItem!.price * props.quantity).toFixed(2)),
                            paymentMethod: 'Pix', // Default
                            createdAt: new Date().toISOString(),
                            status: 'active'
                          };
                          props.setCart([...props.cart, newItem]);
                          setStep('cart');
                        }}
                        disabled={!props.selectedItem}
                        className="flex-1 py-4 bg-red-600 text-white rounded-xl font-black uppercase text-xs shadow-lg disabled:bg-gray-200"
                      >
                        Confirmar Item
                      </button>
                    </div>
                </div>
              </div>
            )}

            {step === 'cart' && (
              <div className="space-y-6 animate-in slide-in-from-bottom duration-300">
                <div className="flex justify-between items-center">
                  <button onClick={() => setStep('categories')} className="text-[10px] font-black text-blue-600 uppercase">+ Adicionar Outro</button>
                  <button onClick={() => props.setCart([])} className="text-[10px] font-black text-red-400 uppercase">Esvaziar</button>
                </div>

                <div className="space-y-3">
                  {props.cart.map((item, idx) => (
                    <div key={item.id} className="bg-white p-4 rounded-2xl border flex justify-between items-center shadow-sm">
                      <div>
                        <p className="text-[8px] font-black text-red-500 uppercase">{item.category} • {item.ml}</p>
                        <p className="font-black uppercase italic text-xs leading-none my-1">{item.productName}</p>
                        <p className="text-[10px] font-bold text-gray-400">{item.unitsSold}x {formatCurrency(item.unitPrice)}</p>
                      </div>
                      <button onClick={() => props.setCart(props.cart.filter((_, i) => i !== idx))} className="text-gray-300 p-2"><Trash2 size={16}/></button>
                    </div>
                  ))}
                  {props.cart.length === 0 && (
                    <div className="text-center py-20 opacity-20">
                      <ShoppingCart size={48} className="mx-auto mb-2"/>
                      <p className="text-[10px] font-black uppercase tracking-widest">Carrinho Vazio</p>
                    </div>
                  )}
                </div>

                {props.cart.length > 0 && (
                  <div className="bg-gray-900 rounded-[32px] p-6 text-white space-y-6 shadow-2xl">
                    <div className="flex justify-between items-end">
                      <span className="text-[10px] font-black text-gray-500 uppercase">Total Venda</span>
                      <span className="text-4xl font-black italic">{formatCurrency(props.cart.reduce((a, b) => a + b.totalValue, 0))}</span>
                    </div>

                    <div className="space-y-3">
                      <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest block text-center">Forma de Pagamento</label>
                      <div className="grid grid-cols-3 gap-2">
                        {(['Pix', 'Cartão', 'Dinheiro'] as IceCreamPaymentMethod[]).map(pm => (
                          <button 
                            key={pm} 
                            onClick={() => props.setPaymentMethod(pm)}
                            className={`py-3 rounded-xl flex flex-col items-center gap-1 border-2 transition-all ${props.paymentMethod === pm ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white/5 border-white/10 text-gray-400'}`}
                          >
                            {pm === 'Pix' ? <Hash size={14}/> : pm === 'Cartão' ? <CreditCard size={14}/> : <Banknote size={14}/>}
                            <span className="text-[9px] font-black uppercase">{pm}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <button 
                      onClick={handleFinalize}
                      disabled={props.isSubmitting || !props.paymentMethod}
                      className="w-full py-5 bg-red-600 rounded-2xl font-black uppercase text-xs shadow-xl active:scale-95 disabled:bg-gray-800"
                    >
                      {props.isSubmitting ? <Loader2 className="animate-spin mx-auto" size={20}/> : 'Finalizar Venda'}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {mobileTab === 'dre' && (
          <div className="space-y-4 animate-in fade-in duration-300">
            <div className="bg-white p-6 rounded-[32px] shadow-sm border space-y-4">
              <h3 className="font-black uppercase italic text-sm text-center">Controle de Caixa Hoje</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-4 bg-green-50 rounded-2xl border border-green-100 text-center">
                  <p className="text-[8px] font-black text-green-600 uppercase">Entradas</p>
                  <p className="text-sm font-black text-green-700">{formatCurrency(props.dailyData.totalSales)}</p>
                </div>
                <div className="p-4 bg-red-50 rounded-2xl border border-red-100 text-center">
                  <p className="text-[8px] font-black text-red-600 uppercase">Saídas</p>
                  <p className="text-sm font-black text-red-700">{formatCurrency(props.dailyData.totalExits)}</p>
                </div>
              </div>
              <div className={`p-6 rounded-2xl text-center text-white ${props.dailyData.balance >= 0 ? 'bg-blue-900' : 'bg-red-900'}`}>
                <p className="text-[8px] font-black uppercase opacity-60">Saldo Líquido</p>
                <p className="text-3xl font-black italic">{formatCurrency(props.dailyData.balance)}</p>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-4">
                <button onClick={() => props.handlePrintDailyDRE('detailed')} className="flex items-center justify-center gap-2 py-3 bg-gray-900 text-white rounded-xl font-black uppercase text-[9px] shadow-md"><List size={14}/> Detalhado</button>
                <button onClick={() => props.handlePrintDailyDRE('summary')} className="flex items-center justify-center gap-2 py-3 bg-blue-700 text-white rounded-xl font-black uppercase text-[9px] shadow-md"><PieChart size={14}/> Resumido</button>
              </div>
            </div>

            <div className="bg-white rounded-[32px] p-4 shadow-sm border">
               <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-4">Histórico de Hoje</label>
               <div className="space-y-2">
                 {props.dailyData.allDaySales.map((s: IceCreamDailySale) => (
                   <div key={s.id} className={`flex justify-between items-center py-2 border-b border-gray-50 last:border-0 ${s.status === 'canceled' ? 'opacity-30' : ''}`}>
                     <div className="flex flex-col flex-1">
                        <span className="text-[8px] font-black text-gray-400">{s.saleCode}</span>
                        <span className={`text-[10px] font-bold truncate ${s.status === 'canceled' ? 'line-through' : ''}`}>{s.productName}</span>
                     </div>
                     <div className="flex items-center gap-3">
                        <span className={`text-[10px] font-black ${s.status === 'canceled' ? 'text-gray-400 line-through' : 'text-gray-900'}`}>{formatCurrency(s.totalValue)}</span>
                        {isAdminOrManager && s.status !== 'canceled' && (
                            <button onClick={() => handleCancel(s)} className="text-red-400 p-1"><Ban size={14}/></button>
                        )}
                        {s.status === 'canceled' && (
                             <div className="group relative">
                                <Info size={14} className="text-gray-400" />
                                <div className="absolute right-0 bottom-full mb-1 hidden group-hover:block bg-black text-white text-[7px] p-2 rounded w-32 z-50">
                                    MOTIVO: {s.cancelReason}
                                </div>
                             </div>
                        )}
                     </div>
                   </div>
                 ))}
               </div>
            </div>
          </div>
        )}

        {mobileTab === 'saida' && (
          <div className="animate-in zoom-in duration-300">
             <div className="bg-white p-8 rounded-[40px] shadow-md border space-y-6">
                <h3 className="font-black text-lg uppercase italic text-center flex items-center justify-center gap-2"><ArrowDownCircle className="text-red-600" size={24}/> Lançar Saída</h3>
                <form onSubmit={handleSaveExpense} className="space-y-4">
                   <div>
                     <label className="text-[10px] font-black text-gray-400 uppercase block mb-1">Valor Saída</label>
                     <input 
                        value={props.financeForm.value} 
                        onChange={e => props.setFinanceForm((prev: any) => ({ ...prev, value: e.target.value }))}
                        className="w-full p-4 bg-gray-50 border-none rounded-2xl font-black text-2xl text-center focus:ring-4 focus:ring-red-100 outline-none"
                        placeholder="0,00"
                     />
                   </div>
                   <div>
                     <label className="text-[10px] font-black text-gray-400 uppercase block mb-1">Categoria</label>
                     <select 
                        value={props.financeForm.category} 
                        onChange={e => props.setFinanceForm((prev: any) => ({ ...prev, category: e.target.value }))}
                        className="w-full p-4 bg-gray-50 border-none rounded-2xl font-black uppercase text-xs"
                     >
                       {['Vale Funcionário', 'Pagamento Funcionário', 'Fornecedor', 'Material/Consumo', 'Aluguel', 'Energia', 'Outros'].map(c => <option key={c} value={c}>{c}</option>)}
                     </select>
                   </div>
                   <div>
                     <label className="text-[10px] font-black text-gray-400 uppercase block mb-1">Responsável</label>
                     <input 
                        value={props.financeForm.employeeName} 
                        onChange={e => props.setFinanceForm((prev: any) => ({ ...prev, employeeName: e.target.value }))}
                        className="w-full p-4 bg-gray-50 border-none rounded-2xl font-bold uppercase italic text-sm"
                        placeholder="QUEM RETIROU?"
                     />
                   </div>
                   <button 
                      type="submit" 
                      disabled={props.isSubmitting}
                      className="w-full py-5 bg-red-600 text-white rounded-2xl font-black uppercase text-xs shadow-xl active:scale-95"
                   >
                     {props.isSubmitting ? <Loader2 size={20} className="animate-spin mx-auto"/> : <Save size={18} className="mx-auto inline-block mr-2"/>}
                     {props.isSubmitting ? '' : 'Confirmar Saída'}
                   </button>
                </form>
             </div>
          </div>
        )}
      </main>

      {/* Navegação Inferior Fixa */}
      <nav className="bg-white border-t px-2 py-3 flex justify-around items-center fixed bottom-0 left-0 right-0 z-50 shadow-[0_-5px_15px_rgba(0,0,0,0.05)]">
        <button onClick={() => { setMobileTab('vender'); setStep('categories'); }} className={`flex flex-col items-center gap-1 transition-all ${mobileTab === 'vender' ? 'text-blue-700 scale-110' : 'text-gray-400'}`}>
          <ShoppingCart size={24}/><span className="text-[9px] font-black uppercase">Vender</span>
        </button>
        <button onClick={() => setMobileTab('dre')} className={`flex flex-col items-center gap-1 transition-all ${mobileTab === 'dre' ? 'text-blue-700 scale-110' : 'text-gray-400'}`}>
          <FileText size={24}/><span className="text-[9px] font-black uppercase">DRE</span>
        </button>
        <button onClick={() => setMobileTab('saida')} className={`flex flex-col items-center gap-1 transition-all ${mobileTab === 'saida' ? 'text-red-600 scale-110' : 'text-gray-400'}`}>
          <ArrowDownCircle size={24}/><span className="text-[9px] font-black uppercase">Saída</span>
        </button>
      </nav>
    </div>
  );
};

export default PDVMobileView;
