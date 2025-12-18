
import React, { useState, useMemo } from 'react';
import { IceCreamItem, IceCreamDailySale, IceCreamTransaction, IceCreamCategory, IceCreamExpenseCategory, IceCreamPaymentMethod } from '../types';
import { formatCurrency } from '../constants';
import { IceCream, Plus, DollarSign, Save, Trash2, X, Calculator, Edit3, Package, ChevronDown, Loader2, ShoppingCart, CheckCircle2, ChevronRight, Hash, CreditCard, Wallet, Banknote, Shield, TrendingDown, Calendar, User, FileText, Lock, Unlock, Users, Receipt, CheckCircle, TrendingUp, ArrowUpRight, ArrowDownRight, UserCheck, Briefcase } from 'lucide-react';

interface IceCreamModuleProps {
  items: IceCreamItem[];
  sales: IceCreamDailySale[];
  finances: IceCreamTransaction[];
  onAddSales: (sale: IceCreamDailySale[]) => Promise<void>;
  onUpdatePrice: (id: string, price: number) => Promise<void>;
  onUpdateItem: (item: IceCreamItem) => Promise<void>;
  onAddTransaction: (tx: IceCreamTransaction) => Promise<void>;
  onDeleteTransaction: (id: string) => Promise<void>;
  onAddItem: (name: string, category: IceCreamCategory, price: number, flavor?: string) => Promise<void>;
  onDeleteItem: (id: string) => Promise<void>;
}

const EXPENSE_CATEGORIES: IceCreamExpenseCategory[] = ['Vale Funcionário', 'Pagamento Funcionário', 'Fornecedor', 'Material/Consumo', 'Aluguel', 'Energia', 'Outros'];
const PRODUCT_CATEGORIES: IceCreamCategory[] = ['Adicionais', 'Bebidas', 'Cascão', 'Casquinha', 'Milkshake', 'Sundae'];

const IceCreamModule: React.FC<IceCreamModuleProps> = ({ 
    items, sales, finances, onAddSales, onUpdatePrice, onUpdateItem, onAddTransaction, onDeleteTransaction, onAddItem, onDeleteItem 
}) => {
  const [activeTab, setActiveTab] = useState<'dre' | 'vendas' | 'financeiro' | 'historico' | 'products'>('dre');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
      const now = new Date();
      return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  // PDV States
  const [selectedCategory, setSelectedCategory] = useState<IceCreamCategory | null>(null);
  const [selectedProductName, setSelectedProductName] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<IceCreamItem | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [paymentMethod, setPaymentMethod] = useState<IceCreamPaymentMethod | null>(null);
  const [cart, setCart] = useState<IceCreamDailySale[]>([]);

  // Financial States
  const [financeForm, setFinanceForm] = useState({ 
      category: 'Vale Funcionário' as IceCreamExpenseCategory, 
      type: 'exit' as 'entry' | 'exit',
      value: '', 
      employeeName: '',
      description: '',
      date: new Date().toISOString().split('T')[0]
  });

  // Modais
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<IceCreamItem | null>(null);
  const [productForm, setProductForm] = useState({ name: '', category: 'Sundae' as IceCreamCategory, flavor: '', price: '', active: true });

  const activeEmployees = useMemo(() => {
      const names = new Set<string>();
      finances.forEach(f => { if (f.employeeName) names.add(f.employeeName); });
      return Array.from(names).sort();
  }, [finances]);

  const categoryItems = useMemo(() => {
    if (!selectedCategory) return [];
    const names = new Set<string>();
    items.filter(i => i.category === selectedCategory && i.active).forEach(i => names.add(i.name));
    return Array.from(names).sort();
  }, [items, selectedCategory]);

  const itemFlavors = useMemo(() => {
    if (!selectedProductName || !selectedCategory) return [];
    return items.filter(i => i.name === selectedProductName && i.category === selectedCategory && i.active);
  }, [items, selectedProductName, selectedCategory]);

  const dreData = useMemo(() => {
    const monthSales = sales.filter(s => s.createdAt && s.createdAt.startsWith(selectedMonth));
    const monthFinances = finances.filter(f => f.date.startsWith(selectedMonth));
    const salesRevenue = monthSales.reduce((acc, sale) => acc + (sale.totalValue || 0), 0);
    const manualEntries = monthFinances.filter(f => f.type === 'entry').reduce((acc, f) => acc + f.value, 0);
    const totalEntries = salesRevenue + manualEntries;
    const totalExits = monthFinances.filter(f => f.type === 'exit').reduce((acc, f) => acc + f.value, 0);
    const netProfit = totalEntries - totalExits;
    const margin = totalEntries > 0 ? (netProfit / totalEntries) * 100 : 0;
    
    return { 
        totalEntries, totalExits, netProfit, margin, 
        regisLuciene: netProfit > 0 ? netProfit * 0.6333 : 0, 
        ademir: netProfit > 0 ? netProfit * 0.2667 : 0, 
        junior: netProfit > 0 ? netProfit * 0.10 : 0, 
        salesRevenue, manualEntries,
        expensesByCategory: EXPENSE_CATEGORIES.map(cat => ({
            name: cat,
            value: monthFinances.filter(f => f.category === cat).reduce((a, b) => a + b.value, 0)
        })).filter(e => e.value > 0)
    };
  }, [sales, finances, selectedMonth]);

  const handleAddToCart = () => {
      if (!selectedItem || !paymentMethod) {
          alert("Selecione o produto e a forma de pagamento.");
          return;
      }
      const newItem: IceCreamDailySale = {
          id: `cart-${Date.now()}-${Math.random()}`,
          itemId: selectedItem.id,
          productName: selectedItem.name,
          category: selectedItem.category,
          flavor: selectedItem.flavor || '',
          unitsSold: quantity,
          unitPrice: selectedItem.price,
          totalValue: selectedItem.price * quantity,
          paymentMethod: paymentMethod
      };
      setCart([...cart, newItem]);
      setSelectedItem(null);
      setQuantity(1);
  };

  const handleFinalizeSale = async () => {
      if (cart.length === 0) return;
      setIsSubmitting(true);
      try {
          await onAddSales(cart);
          setCart([]);
          alert("Venda registrada com sucesso!");
      } catch (e) {
          alert("Erro ao registrar venda.");
      } finally {
          setIsSubmitting(false);
      }
  };

  const handleSaveTransaction = async (e: React.FormEvent) => {
      e.preventDefault();
      const val = parseFloat(financeForm.value.replace(/\./g, '').replace(',', '.'));
      if (isNaN(val) || val <= 0) {
          alert("Valor inválido.");
          return;
      }
      setIsSubmitting(true);
      try {
          await onAddTransaction({
              id: `tx-${Date.now()}`,
              date: financeForm.date,
              type: financeForm.type,
              category: financeForm.category,
              value: val,
              employeeName: financeForm.employeeName,
              description: financeForm.description,
              createdAt: new Date()
          });
          setFinanceForm(prev => ({ ...prev, value: '', description: '' }));
          alert("Transação registrada!");
      } catch (e) {
          alert("Erro ao salvar transação.");
      } finally {
          setIsSubmitting(false);
      }
  };

  const handleSaveProduct = async () => {
    const cleanPrice = productForm.price.replace(/\./g, '').replace(',', '.');
    const priceVal = parseFloat(cleanPrice);
    
    if (!productForm.name || isNaN(priceVal)) {
        alert("Preencha Nome e Valor corretamente.");
        return;
    }

    setIsSubmitting(true);
    try {
        if (editingItem) {
            await onUpdateItem({ 
                ...editingItem, 
                name: String(productForm.name), 
                category: productForm.category, 
                flavor: productForm.flavor, 
                price: priceVal, 
                active: productForm.active 
            });
            alert("Produto atualizado com sucesso!");
        } else {
            await onAddItem(String(productForm.name), productForm.category, priceVal, productForm.flavor);
            alert("Produto cadastrado!");
        }
        setIsProductModalOpen(false);
        setEditingItem(null);
    } catch (e) {
        alert("Erro ao salvar no banco. Verifique os dados.");
    } finally {
        setIsSubmitting(false);
    }
  };

  const handleEditClick = (item: IceCreamItem) => {
      setEditingItem(item);
      setProductForm({ 
          name: item.name, 
          category: item.category, 
          flavor: item.flavor || '', 
          price: item.price.toFixed(2).replace('.', ','), 
          active: item.active 
      });
      setIsProductModalOpen(true);
  };

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-[1600px] mx-auto min-h-full bg-gray-50 flex flex-col">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
        <div className="flex items-center gap-4">
          <div className="p-4 bg-blue-800 rounded-2xl text-white shadow-lg"><IceCream size={32} /></div>
          <div>
            <h2 className="text-3xl font-black text-gray-900 uppercase italic leading-none">Gestão <span className="text-red-600">Sorvete</span></h2>
            <p className="text-gray-500 text-sm font-bold uppercase tracking-widest mt-1">Sincronizado com Banco de Dados Real</p>
          </div>
        </div>
        <div className="flex bg-gray-100 p-1 rounded-2xl overflow-x-auto no-scrollbar max-w-full">
          {[
              {id:'dre',label:'DRE',icon:FileText},
              {id:'vendas',label:'PDV',icon:ShoppingCart},
              {id:'financeiro',label:'Financeiro',icon:Banknote},
              {id:'historico',label:'Histórico',icon:Hash},
              {id:'products',label:'Produtos',icon:Package}
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase transition-all whitespace-nowrap ${activeTab === tab.id ? 'bg-white text-blue-700 shadow-md scale-105' : 'text-gray-500 hover:text-gray-700'}`}><tab.icon size={16}/> {tab.label}</button>
          ))}
        </div>
      </div>

      {/* DRE TAB */}
      {activeTab === 'dre' && (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 animate-in fade-in duration-500">
              <div className="lg:col-span-3 space-y-6">
                  {/* Summary Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="bg-white p-8 rounded-[40px] shadow-sm border border-gray-100">
                          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Entradas Totais</p>
                          <div className="flex items-center justify-between">
                            <p className="text-3xl font-black text-gray-900">{formatCurrency(dreData.totalEntries)}</p>
                            <div className="p-3 bg-green-50 text-green-600 rounded-2xl"><TrendingUp size={24}/></div>
                          </div>
                          <div className="mt-4 text-[10px] font-bold text-gray-400 space-y-1">
                              <p className="flex justify-between">Vendas PDV: <span>{formatCurrency(dreData.salesRevenue)}</span></p>
                              <p className="flex justify-between">Manuais: <span>{formatCurrency(dreData.manualEntries)}</span></p>
                          </div>
                      </div>
                      <div className="bg-white p-8 rounded-[40px] shadow-sm border border-gray-100">
                          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Saídas / Despesas</p>
                          <div className="flex items-center justify-between">
                            <p className="text-3xl font-black text-red-600">{formatCurrency(dreData.totalExits)}</p>
                            <div className="p-3 bg-red-50 text-red-600 rounded-2xl"><TrendingDown size={24}/></div>
                          </div>
                      </div>
                      <div className="bg-blue-900 p-8 rounded-[40px] shadow-xl text-white relative overflow-hidden">
                          <p className="text-[10px] font-black text-blue-300 uppercase tracking-widest mb-2">Lucro Líquido</p>
                          <p className="text-3xl font-black">{formatCurrency(dreData.netProfit)}</p>
                          <div className="mt-2 flex items-center gap-2">
                              <span className="text-[10px] font-black px-2 py-0.5 bg-white/20 rounded-lg">{dreData.margin.toFixed(1)}% Margem</span>
                          </div>
                          <Shield size={64} className="absolute -bottom-4 -right-4 opacity-10" />
                      </div>
                  </div>

                  {/* Profit Share */}
                  <div className="bg-white p-8 rounded-[40px] shadow-sm border border-gray-100">
                      <h3 className="font-black text-gray-900 text-xl uppercase italic tracking-tighter mb-6 flex items-center gap-3">
                          <Users className="text-blue-700" size={24} /> Divisão de <span className="text-red-600">Lucros</span>
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                          <div className="p-6 bg-gray-50 rounded-[32px] border border-gray-100">
                              <div className="flex items-center gap-3 mb-2">
                                  <Briefcase size={16} className="text-gray-400" />
                                  <span className="text-[10px] font-black text-gray-500 uppercase">Regis & Luciene (63.33%)</span>
                              </div>
                              <p className="text-2xl font-black text-gray-900">{formatCurrency(dreData.regisLuciene)}</p>
                          </div>
                          <div className="p-6 bg-gray-50 rounded-[32px] border border-gray-100">
                              <div className="flex items-center gap-3 mb-2">
                                  <User size={16} className="text-gray-400" />
                                  <span className="text-[10px] font-black text-gray-500 uppercase">Ademir (26.67%)</span>
                              </div>
                              <p className="text-2xl font-black text-gray-900">{formatCurrency(dreData.ademir)}</p>
                          </div>
                          <div className="p-6 bg-gray-50 rounded-[32px] border border-gray-100">
                              <div className="flex items-center gap-3 mb-2">
                                  <User size={16} className="text-gray-400" />
                                  <span className="text-[10px] font-black text-gray-500 uppercase">Junior (10%)</span>
                              </div>
                              <p className="text-2xl font-black text-gray-900">{formatCurrency(dreData.junior)}</p>
                          </div>
                      </div>
                  </div>
              </div>

              {/* Sidebar Filters & Expenses */}
              <div className="space-y-6">
                  <div className="bg-white p-8 rounded-[40px] shadow-sm border border-gray-100">
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">Período de Análise</p>
                      <input 
                        type="month" 
                        value={selectedMonth} 
                        onChange={(e) => setSelectedMonth(e.target.value)} 
                        className="w-full p-4 bg-gray-50 border-none rounded-2xl font-black text-gray-700 outline-none focus:ring-4 focus:ring-blue-100 transition-all"
                      />
                  </div>

                  <div className="bg-white p-8 rounded-[40px] shadow-sm border border-gray-100">
                      <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">Gasto por Categoria</h4>
                      <div className="space-y-4">
                          {dreData.expensesByCategory.map(exp => (
                              <div key={exp.name}>
                                  <div className="flex justify-between text-[11px] font-bold text-gray-600 mb-1 uppercase tracking-tight">
                                      <span>{exp.name}</span>
                                      <span>{formatCurrency(exp.value)}</span>
                                  </div>
                                  <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
                                      <div 
                                        className="h-full bg-red-500" 
                                        style={{ width: `${(exp.value / dreData.totalExits) * 100}%` }}
                                      />
                                  </div>
                              </div>
                          ))}
                          {dreData.expensesByCategory.length === 0 && <p className="text-center py-4 text-xs text-gray-400 font-bold uppercase">Nenhuma despesa</p>}
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* PDV (VENDAS) TAB */}
      {activeTab === 'vendas' && (
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 animate-in slide-in-from-right-2 duration-500 h-full">
              {/* Category & Product Picker */}
              <div className="xl:col-span-2 space-y-6">
                  <div className="bg-white p-6 rounded-[32px] shadow-sm border border-gray-100 flex flex-wrap gap-2">
                      {PRODUCT_CATEGORIES.map(cat => (
                          <button 
                            key={cat} 
                            onClick={() => { setSelectedCategory(cat); setSelectedProductName(null); setSelectedItem(null); }}
                            className={`px-6 py-3 rounded-2xl text-[11px] font-black uppercase tracking-wider transition-all ${selectedCategory === cat ? 'bg-blue-800 text-white shadow-lg scale-105' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                          >
                              {cat}
                          </button>
                      ))}
                  </div>

                  {selectedCategory && (
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 animate-in fade-in">
                          {categoryItems.map(name => (
                              <button 
                                key={name}
                                onClick={() => { setSelectedProductName(name); setSelectedItem(null); }}
                                className={`p-6 rounded-[32px] border-2 transition-all flex flex-col items-center text-center gap-2 ${selectedProductName === name ? 'bg-blue-50 border-blue-600' : 'bg-white border-gray-100 hover:border-blue-200'}`}
                              >
                                  <Package size={32} className={selectedProductName === name ? 'text-blue-700' : 'text-gray-300'} />
                                  <span className="text-[11px] font-black uppercase italic text-gray-900">{name}</span>
                              </button>
                          ))}
                      </div>
                  )}

                  {selectedProductName && (
                      <div className="bg-white p-8 rounded-[40px] shadow-sm border border-gray-100 animate-in slide-in-from-top-2">
                          <h4 className="text-[10px] font-black text-gray-400 uppercase mb-4 tracking-widest">Selecione o Sabor / Opção</h4>
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                              {itemFlavors.map(item => (
                                  <button 
                                    key={item.id}
                                    onClick={() => setSelectedItem(item)}
                                    className={`p-4 rounded-2xl border-2 text-left transition-all ${selectedItem?.id === item.id ? 'bg-red-50 border-red-600' : 'bg-gray-50 border-transparent hover:border-red-200'}`}
                                  >
                                      <p className="text-[10px] font-black uppercase text-red-600 mb-1">{item.flavor || 'Padrão'}</p>
                                      <p className="text-lg font-black text-gray-900">{formatCurrency(item.price)}</p>
                                  </button>
                              ))}
                          </div>

                          {selectedItem && (
                              <div className="mt-8 pt-8 border-t border-gray-100 flex flex-col md:flex-row items-center justify-between gap-6">
                                  <div className="flex items-center gap-4">
                                      <button onClick={() => setQuantity(Math.max(1, quantity - 1))} className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center font-black text-xl">-</button>
                                      <span className="text-2xl font-black w-10 text-center">{quantity}</span>
                                      <button onClick={() => setQuantity(quantity + 1)} className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center font-black text-xl">+</button>
                                  </div>
                                  
                                  <div className="flex flex-1 flex-wrap gap-2 justify-center">
                                      {(['Pix', 'Cartão', 'Dinheiro'] as IceCreamPaymentMethod[]).map(pm => (
                                          <button 
                                            key={pm}
                                            onClick={() => setPaymentMethod(pm)}
                                            className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase flex items-center gap-2 border-2 transition-all ${paymentMethod === pm ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-400 border-gray-100 hover:border-gray-200'}`}
                                          >
                                              {pm === 'Pix' ? <Hash size={14}/> : pm === 'Cartão' ? <CreditCard size={14}/> : <Banknote size={14}/>}
                                              {pm}
                                          </button>
                                      ))}
                                  </div>

                                  <button 
                                    onClick={handleAddToCart}
                                    className="bg-red-600 text-white px-8 py-4 rounded-3xl font-black uppercase text-xs shadow-xl shadow-red-200 hover:bg-red-700 transition-all flex items-center gap-2"
                                  >
                                      <Plus size={20}/> Adicionar
                                  </button>
                              </div>
                          )}
                      </div>
                  )}
              </div>

              {/* Checkout / Cart */}
              <div className="bg-gray-900 rounded-[48px] p-8 text-white shadow-2xl flex flex-col h-full sticky top-8">
                  <div className="flex items-center gap-3 mb-8">
                      <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center"><ShoppingCart size={24}/></div>
                      <div>
                          <h3 className="text-xl font-black uppercase italic tracking-tighter">Resumo da <span className="text-red-500">Venda</span></h3>
                          <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">{cart.length} itens no carrinho</p>
                      </div>
                  </div>

                  <div className="flex-1 overflow-y-auto no-scrollbar space-y-4 mb-8">
                      {cart.map((item, idx) => (
                          <div key={item.id} className="flex items-center justify-between bg-white/5 p-4 rounded-3xl border border-white/5 group">
                              <div className="flex-1">
                                  <p className="text-[10px] font-black text-red-500 uppercase tracking-tight">{item.category}</p>
                                  <p className="font-black uppercase italic leading-none my-1">{item.productName} <span className="text-[10px] text-gray-500 font-medium not-italic">- {item.flavor}</span></p>
                                  <p className="text-xs font-bold text-gray-400">{item.unitsSold}x {formatCurrency(item.unitPrice)} • {item.paymentMethod}</p>
                              </div>
                              <button onClick={() => setCart(cart.filter((_, i) => i !== idx))} className="p-2 text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"><X size={18}/></button>
                          </div>
                      ))}
                      {cart.length === 0 && (
                          <div className="h-full flex flex-col items-center justify-center text-gray-700 gap-4 py-20">
                              <ShoppingCart size={64} className="opacity-20" />
                              <p className="text-[10px] font-black uppercase tracking-widest opacity-40">Aguardando Lançamento</p>
                          </div>
                      )}
                  </div>

                  <div className="pt-8 border-t border-white/10 space-y-4">
                      <div className="flex justify-between items-end">
                          <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Total Geral</span>
                          <span className="text-4xl font-black tracking-tighter italic">{formatCurrency(cart.reduce((a, b) => a + b.totalValue, 0))}</span>
                      </div>
                      <button 
                        onClick={handleFinalizeSale}
                        disabled={cart.length === 0 || isSubmitting}
                        className="w-full py-5 bg-red-600 hover:bg-red-700 disabled:bg-gray-800 disabled:text-gray-600 rounded-3xl font-black uppercase text-xs transition-all shadow-2xl flex items-center justify-center gap-2"
                      >
                          {isSubmitting ? <Loader2 className="animate-spin" size={20}/> : <CheckCircle2 size={20}/>}
                          Finalizar Pedido
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* FINANCEIRO TAB */}
      {activeTab === 'financeiro' && (
          <div className="max-w-4xl mx-auto w-full animate-in zoom-in duration-300">
              <div className="bg-white p-10 rounded-[48px] shadow-sm border border-gray-100">
                  <h3 className="font-black text-gray-900 text-2xl uppercase italic tracking-tighter mb-8 flex items-center gap-3">
                      <Banknote className="text-blue-700" size={32} /> Lançamento de <span className="text-red-600">Caixa</span>
                  </h3>
                  
                  <form onSubmit={handleSaveTransaction} className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div>
                              <label className="text-[10px] font-black text-gray-400 uppercase mb-2 block ml-1">Tipo de Movimentação</label>
                              <div className="flex bg-gray-100 p-1.5 rounded-2xl">
                                  <button 
                                    type="button"
                                    onClick={() => setFinanceForm({...financeForm, type: 'exit'})}
                                    className={`flex-1 py-3 rounded-xl text-xs font-black uppercase transition-all ${financeForm.type === 'exit' ? 'bg-red-600 text-white shadow-lg' : 'text-gray-500 hover:text-gray-700'}`}
                                  >Saída (Gasto)</button>
                                  <button 
                                    type="button"
                                    onClick={() => setFinanceForm({...financeForm, type: 'entry'})}
                                    className={`flex-1 py-3 rounded-xl text-xs font-black uppercase transition-all ${financeForm.type === 'entry' ? 'bg-green-600 text-white shadow-lg' : 'text-gray-500 hover:text-gray-700'}`}
                                  >Entrada (Reforço)</button>
                              </div>
                          </div>
                          <div>
                              <label className="text-[10px] font-black text-gray-400 uppercase mb-2 block ml-1">Data</label>
                              <input type="date" value={financeForm.date} onChange={e => setFinanceForm({...financeForm, date: e.target.value})} className="w-full p-4 bg-gray-50 border-none rounded-2xl font-bold focus:ring-4 focus:ring-blue-100" />
                          </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div>
                              <label className="text-[10px] font-black text-gray-400 uppercase mb-2 block ml-1">Categoria</label>
                              <select 
                                value={financeForm.category} 
                                onChange={e => setFinanceForm({...financeForm, category: e.target.value as IceCreamExpenseCategory})}
                                className="w-full p-4 bg-gray-50 border-none rounded-2xl font-bold uppercase text-xs focus:ring-4 focus:ring-blue-100 appearance-none"
                              >
                                  {EXPENSE_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                              </select>
                          </div>
                          <div>
                              <label className="text-[10px] font-black text-gray-400 uppercase mb-2 block ml-1">Valor do Lançamento</label>
                              <div className="relative">
                                  <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-gray-400">R$</span>
                                  <input 
                                    value={financeForm.value} 
                                    onChange={e => setFinanceForm({...financeForm, value: e.target.value})} 
                                    placeholder="0,00" 
                                    className="w-full p-4 pl-12 bg-gray-50 border-none rounded-2xl font-black text-xl text-gray-800 focus:ring-4 focus:ring-blue-100"
                                  />
                              </div>
                          </div>
                      </div>

                      {financeForm.category.includes('Funcionário') && (
                          <div>
                              <label className="text-[10px] font-black text-gray-400 uppercase mb-2 block ml-1">Nome do Funcionário</label>
                              <input 
                                list="employee-names"
                                value={financeForm.employeeName} 
                                onChange={e => setFinanceForm({...financeForm, employeeName: e.target.value})}
                                placeholder="Informe o nome..." 
                                className="w-full p-4 bg-gray-50 border-none rounded-2xl font-bold"
                              />
                              <datalist id="employee-names">{activeEmployees.map(name => <option key={name} value={name} />)}</datalist>
                          </div>
                      )}

                      <div>
                          <label className="text-[10px] font-black text-gray-400 uppercase mb-2 block ml-1">Descrição / Observação</label>
                          <textarea 
                            value={financeForm.description} 
                            onChange={e => setFinanceForm({...financeForm, description: e.target.value})}
                            placeholder="Descreva detalhes do pagamento..." 
                            className="w-full p-4 bg-gray-50 border-none rounded-2xl font-bold h-24 resize-none"
                          />
                      </div>

                      <button 
                        type="submit" 
                        disabled={isSubmitting}
                        className={`w-full py-5 rounded-[24px] font-black uppercase text-xs shadow-xl transition-all flex items-center justify-center gap-3 ${financeForm.type === 'exit' ? 'bg-red-600 hover:bg-red-700 shadow-red-100' : 'bg-green-600 hover:bg-green-700 shadow-green-100'} text-white`}
                      >
                          {isSubmitting ? <Loader2 className="animate-spin" size={20}/> : <Save size={20}/>}
                          Efetivar Lançamento
                      </button>
                  </form>
              </div>
          </div>
      )}

      {/* HISTORICO TAB */}
      {activeTab === 'historico' && (
          <div className="space-y-8 animate-in fade-in duration-500">
              <div className="bg-white rounded-[40px] shadow-sm border border-gray-100 overflow-hidden">
                  <div className="p-8 border-b bg-gray-50/50 flex justify-between items-center">
                      <h3 className="font-black text-gray-900 text-xl uppercase italic tracking-tighter flex items-center gap-3"><ShoppingCart size={24}/> Histórico de <span className="text-red-600">Vendas Diárias</span></h3>
                      <div className="flex items-center gap-2"><Calendar size={16} className="text-gray-400"/><input type="month" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} className="bg-transparent font-bold text-xs outline-none" /></div>
                  </div>
                  <div className="overflow-x-auto">
                      <table className="w-full text-left">
                          <thead><tr className="bg-white text-[10px] font-black text-gray-400 uppercase tracking-widest border-b"><th className="px-10 py-5">Data/Hora</th><th className="px-10 py-5">Produto</th><th className="px-10 py-5">Sabor</th><th className="px-10 py-5">Quantidade</th><th className="px-10 py-5">Pagamento</th><th className="px-10 py-5 text-right">Valor Total</th></tr></thead>
                          <tbody className="divide-y divide-gray-50">
                              {sales.filter(s => s.createdAt?.startsWith(selectedMonth)).map(sale => (
                                  <tr key={sale.id} className="hover:bg-blue-50/30 transition-colors">
                                      <td className="px-10 py-4 text-xs font-mono text-gray-400">{sale.createdAt ? new Date(sale.createdAt).toLocaleString('pt-BR') : '-'}</td>
                                      <td className="px-10 py-4 font-black uppercase text-gray-800 text-sm">{sale.productName}</td>
                                      <td className="px-10 py-4 text-xs font-bold text-gray-500 uppercase">{sale.flavor || '-'}</td>
                                      <td className="px-10 py-4 font-bold text-gray-900">{sale.unitsSold}</td>
                                      <td className="px-10 py-4"><span className="px-3 py-1 bg-gray-100 rounded-full text-[9px] font-black uppercase border">{sale.paymentMethod}</span></td>
                                      <td className="px-10 py-4 text-right font-black text-blue-700">{formatCurrency(sale.totalValue)}</td>
                                  </tr>
                              ))}
                              {sales.filter(s => s.createdAt?.startsWith(selectedMonth)).length === 0 && <tr><td colSpan={6} className="py-20 text-center text-gray-400 font-black uppercase tracking-widest">Nenhuma venda no período</td></tr>}
                          </tbody>
                      </table>
                  </div>
              </div>

              <div className="bg-white rounded-[40px] shadow-sm border border-gray-100 overflow-hidden">
                  <div className="p-8 border-b bg-gray-50/50 flex justify-between items-center">
                      <h3 className="font-black text-gray-900 text-xl uppercase italic tracking-tighter flex items-center gap-3"><Banknote size={24}/> Fluxo de <span className="text-red-600">Caixa Manual</span></h3>
                  </div>
                  <div className="overflow-x-auto">
                      <table className="w-full text-left">
                          <thead><tr className="bg-white text-[10px] font-black text-gray-400 uppercase tracking-widest border-b"><th className="px-10 py-5">Data</th><th className="px-10 py-5">Tipo</th><th className="px-10 py-5">Categoria</th><th className="px-10 py-5">Descrição</th><th className="px-10 py-5 text-right">Valor</th><th className="px-10 py-5 text-center">Ação</th></tr></thead>
                          <tbody className="divide-y divide-gray-50">
                              {finances.filter(f => f.date.startsWith(selectedMonth)).map(tx => (
                                  <tr key={tx.id} className="hover:bg-blue-50/30 transition-colors">
                                      <td className="px-10 py-4 text-xs font-mono text-gray-400">{new Date(tx.date + 'T12:00:00').toLocaleDateString('pt-BR')}</td>
                                      <td className="px-10 py-4"><span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase ${tx.type === 'entry' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'} border`}>{tx.type === 'entry' ? 'ENTRADA' : 'SAÍDA'}</span></td>
                                      <td className="px-10 py-4 font-black uppercase text-gray-800 text-xs">{tx.category}</td>
                                      {/* Fix: Changed tx.employee_name to tx.employeeName to match IceCreamTransaction interface */}
                                      <td className="px-10 py-4 text-xs text-gray-500 max-w-xs truncate">{tx.employeeName ? `[${tx.employeeName}] ` : ''}{tx.description}</td>
                                      <td className={`px-10 py-4 text-right font-black ${tx.type === 'entry' ? 'text-green-700' : 'text-red-600'}`}>{tx.type === 'exit' ? '-' : ''}{formatCurrency(tx.value)}</td>
                                      <td className="px-10 py-4 text-center"><button onClick={() => { if(window.confirm('Excluir transação?')) onDeleteTransaction(tx.id) }} className="p-2 text-gray-300 hover:text-red-500 transition-colors"><Trash2 size={16}/></button></td>
                                  </tr>
                              ))}
                          </tbody>
                      </table>
                  </div>
              </div>
          </div>
      )}

      {/* PRODUCTS TAB (Existing in snippet but duplicated/polished here) */}
      {activeTab === 'products' && (
        <div className="max-w-6xl mx-auto space-y-6 animate-in slide-in-from-top-2">
            <div className="flex justify-between items-center bg-white p-8 rounded-[40px] shadow-sm border border-gray-100">
                <div>
                    <h3 className="font-black text-gray-900 text-2xl flex items-center gap-3 uppercase italic leading-none"><Package className="text-blue-700" size={28} /> Gerenciamento de <span className="text-red-600">Produtos</span></h3>
                    <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mt-2">Clique em editar para alterar preços e sabores.</p>
                </div>
                <button onClick={() => { setEditingItem(null); setProductForm({ name: '', category: 'Sundae', flavor: '', price: '', active: true }); setIsProductModalOpen(true); }} className="bg-blue-700 text-white px-10 py-4 rounded-3xl font-black uppercase text-xs shadow-xl shadow-blue-200 hover:bg-blue-800 transition-all active:scale-95 flex items-center justify-center gap-2"><Plus size={20}/> Adicionar Produto</button>
            </div>
            <div className="bg-white rounded-[40px] shadow-sm border border-gray-100 overflow-hidden">
                <table className="w-full text-left text-sm">
                    <thead><tr className="bg-gray-50 border-b border-gray-100 text-[10px] font-black text-gray-400 uppercase tracking-widest"><th className="px-8 py-5">Status</th><th className="px-8 py-5">Nome do Produto</th><th className="px-8 py-5">Categoria</th><th className="px-8 py-5">Sabor</th><th className="px-8 py-5">Valor Unitário</th><th className="px-8 py-5 text-right">Ações</th></tr></thead>
                    <tbody className="divide-y divide-gray-50">
                        {items.map(item => (
                            <tr key={String(item.id)} className={`hover:bg-gray-50 transition-colors group ${!item.active ? 'opacity-50 grayscale' : ''}`}>
                                <td className="px-8 py-4"><button onClick={() => onUpdateItem({...item, active: !item.active})} className={`p-2 rounded-xl transition-all ${item.active ? 'text-green-500 bg-green-50' : 'text-gray-400 bg-gray-100'}`}>{item.active ? <CheckCircle size={18}/> : <X size={18}/>}</button></td>
                                <td className="px-8 py-4"><span className="font-black text-gray-900 uppercase italic">{item.name}</span></td>
                                <td className="px-8 py-4"><span className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-[9px] font-black uppercase border border-gray-200">{item.category}</span></td>
                                <td className="px-8 py-4"><span className="text-xs text-gray-500 font-medium">{item.flavor || '-'}</span></td>
                                <td className="px-8 py-4"><span className="text-base font-black text-blue-700">{formatCurrency(item.price)}</span></td>
                                <td className="px-8 py-4 text-right"><div className="flex justify-end gap-2"><button onClick={() => handleEditClick(item)} className="p-2 text-blue-600 hover:bg-blue-100 rounded-xl transition-all"><Edit3 size={18}/></button><button onClick={() => { if(window.confirm(`Deseja excluir o produto "${item.name}"?`)) onDeleteItem(String(item.id)) }} className="p-2 text-gray-300 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"><Trash2 size={18}/></button></div></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
      )}

      {/* MODAL PRODUTOS */}
      {isProductModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[110] p-4">
            <div className="bg-white rounded-[48px] shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in duration-200">
                <div className="p-8 bg-gray-50 border-b flex justify-between items-center"><h3 className="text-2xl font-black text-gray-900 uppercase italic tracking-tighter">{editingItem ? 'Editar' : 'Novo'} <span className="text-blue-700">Produto</span></h3><button onClick={() => setIsProductModalOpen(false)} className="bg-white p-2 rounded-full text-gray-400 hover:text-gray-600 shadow-sm transition-colors"><X size={20} /></button></div>
                <div className="p-10 space-y-6">
                    <div><label className="text-[10px] font-black text-gray-400 uppercase block mb-2 ml-1">Nome do Produto *</label><input value={productForm.name} onChange={e => setProductForm({...productForm, name: e.target.value})} placeholder="Ex: Milkshake" className="w-full p-5 bg-gray-50 border-none rounded-3xl font-bold text-gray-800 focus:ring-4 focus:ring-blue-100 transition-all" /></div>
                    <div><label className="text-[10px] font-black text-gray-400 uppercase block mb-2 ml-1">Categoria *</label><div className="relative"><select value={productForm.category} onChange={e => setProductForm({...productForm, category: e.target.value as IceCreamCategory})} className="w-full p-5 bg-gray-50 border-none rounded-3xl font-black text-gray-800 uppercase appearance-none focus:ring-4 focus:ring-blue-100 transition-all">{PRODUCT_CATEGORIES.map(cat => (<option key={cat} value={cat}>{cat}</option>))}</select><ChevronDown className="absolute right-5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" /></div></div>
                    <div><label className="text-[10px] font-black text-gray-400 uppercase block mb-2 ml-1">Sabor</label><input value={productForm.flavor} onChange={e => setProductForm({...productForm, flavor: e.target.value})} placeholder="Ex: Morango" className="w-full p-5 bg-gray-50 border-none rounded-3xl font-bold text-gray-800 focus:ring-4 focus:ring-blue-100 transition-all" /></div>
                    <div><label className="text-[10px] font-black text-gray-400 uppercase block mb-2 ml-1">Valor Unitário *</label><div className="relative"><span className="absolute left-5 top-1/2 -translate-y-1/2 font-black text-blue-700">R$</span><input value={productForm.price} onChange={e => setProductForm({...productForm, price: e.target.value})} placeholder="0,00" className="w-full p-5 pl-12 bg-white border-4 border-gray-100 rounded-3xl font-black text-3xl text-blue-700 shadow-xl focus:border-blue-700 outline-none transition-all" /></div></div>
                    <div className="flex items-center gap-3 bg-gray-50 p-4 rounded-2xl"><input type="checkbox" id="active-check" checked={productForm.active} onChange={e => setProductForm({...productForm, active: e.target.checked})} className="w-5 h-5 accent-blue-600"/><label htmlFor="active-check" className="text-xs font-black text-gray-500 uppercase cursor-pointer">Produto Ativo no PDV</label></div>
                </div>
                <div className="p-8 bg-gray-50 flex gap-4 border-t border-gray-100"><button onClick={() => setIsProductModalOpen(false)} className="flex-1 py-5 bg-white border border-gray-200 rounded-3xl font-black text-gray-400 uppercase text-xs hover:bg-gray-100 transition-colors">Cancelar</button><button onClick={handleSaveProduct} disabled={isSubmitting} className="flex-1 py-5 bg-blue-700 text-white rounded-3xl font-black uppercase text-xs shadow-xl shadow-blue-200 flex items-center justify-center gap-2 hover:bg-blue-800 transition-all active:scale-95">{isSubmitting ? <Loader2 className="animate-spin" size={16}/> : null} Salvar no Banco</button></div>
            </div>
        </div>
      )}
    </div>
  );
};

export default IceCreamModule;
