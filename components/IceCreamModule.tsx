
import React, { useState, useMemo } from 'react';
import { IceCreamItem, IceCreamDailySale, IceCreamTransaction, IceCreamCategory, IceCreamExpenseCategory, IceCreamPaymentMethod, User, UserRole } from '../types';
import { formatCurrency } from '../constants';
import { 
    IceCream, Plus, DollarSign, Save, Trash2, X, Calculator, Edit3, Package, 
    Loader2, ShoppingCart, CheckCircle2, Hash, CreditCard, 
    Banknote, Users, Search
} from 'lucide-react';

interface IceCreamModuleProps {
  user: User;
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
const PRODUCT_CATEGORIES: IceCreamCategory[] = ['Sundae', 'Milkshake', 'Casquinha', 'Cascão', 'Bebidas', 'Adicionais'].sort() as IceCreamCategory[];
const ML_OPTIONS = ['100ml', '200ml', '300ml', '400ml', '500ml', '700ml', 'Padrão'];

const IceCreamModule: React.FC<IceCreamModuleProps> = ({ 
    user, items, sales, finances, onAddSales, onUpdateItem, onAddTransaction, onDeleteTransaction, onAddItem, onDeleteItem 
}) => {
  const isCashier = user.role === UserRole.CASHIER;
  // Perfil Cashier só acessa 'vendas' por padrão
  const [activeTab, setActiveTab] = useState<'dre' | 'vendas' | 'financeiro' | 'products'>(isCashier ? 'vendas' : 'dre');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
      const now = new Date();
      return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  // PDV States
  const [selectedCategory, setSelectedCategory] = useState<IceCreamCategory | null>(null);
  const [selectedProductName, setSelectedProductName] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<IceCreamItem | null>(null);
  const [selectedMl, setSelectedMl] = useState<string>('Padrão');
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
        junior: netProfit > 0 ? netProfit * 0.10 : 0
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
          ml: selectedMl,
          unitsSold: quantity,
          unitPrice: selectedItem.price,
          totalValue: selectedItem.price * quantity,
          paymentMethod: paymentMethod
      };
      setCart([...cart, newItem]);
      setSelectedItem(null);
      setQuantity(1);
      setSelectedMl('Padrão');
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
          alert("Lançamento efetuado!");
      } catch (e) {
          alert("Erro ao salvar transação.");
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

  const handleSaveProduct = async () => {
    const cleanPrice = productForm.price.replace(/\./g, '').replace(',', '.');
    const priceVal = parseFloat(cleanPrice);
    if (!productForm.name || isNaN(priceVal)) { alert("Preencha Nome e Valor."); return; }
    setIsSubmitting(true);
    try {
        if (editingItem) await onUpdateItem({ ...editingItem, name: productForm.name, category: productForm.category, flavor: productForm.flavor, price: priceVal, active: productForm.active });
        else await onAddItem(productForm.name, productForm.category, priceVal, productForm.flavor);
        setIsProductModalOpen(false);
        setEditingItem(null);
    } catch (e) { alert("Erro ao salvar."); } finally { setIsSubmitting(false); }
  };

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-[1600px] mx-auto min-h-full bg-gray-50">
      
      <div className="flex flex-col xl:flex-row justify-between items-center gap-6 bg-white p-6 rounded-[40px] shadow-sm border border-gray-100">
        <div className="flex items-center gap-4">
          <div className="p-5 bg-gradient-to-br from-blue-700 to-blue-900 rounded-3xl text-white shadow-xl"><IceCream size={32} /></div>
          <div>
            <h2 className="text-3xl font-black text-gray-900 uppercase italic tracking-tighter leading-none">Módulo <span className="text-red-600">Gelateria</span></h2>
            <p className="text-gray-400 text-[10px] font-black uppercase tracking-widest mt-2 ml-1">Terminal Operacional de Vendas</p>
          </div>
        </div>
        
        <div className="flex bg-gray-100 p-1.5 rounded-[24px] overflow-x-auto no-scrollbar shadow-inner">
          {[
              {id:'dre',label:'DRE Mensal',icon:Calculator, adminOnly: true},
              {id:'vendas',label:'PDV Vendas',icon:ShoppingCart, adminOnly: false},
              {id:'financeiro',label:'Lançamentos',icon:Banknote, adminOnly: false},
              {id:'products',label:'Catálogo',icon:Package, adminOnly: true}
          ].filter(tab => !tab.adminOnly || !isCashier).map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`flex items-center gap-2 px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === tab.id ? 'bg-white text-blue-700 shadow-xl scale-105' : 'text-gray-500 hover:text-gray-700'}`}>
                <tab.icon size={14}/> {tab.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'dre' && !isCashier && (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 animate-in fade-in duration-300">
              <div className="lg:col-span-3 space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="bg-white p-8 rounded-[48px] shadow-sm border border-gray-100">
                          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Faturamento Bruto</p>
                          <p className="text-3xl font-black text-gray-900">{formatCurrency(dreData.totalEntries)}</p>
                      </div>
                      <div className="bg-white p-8 rounded-[48px] shadow-sm border border-gray-100">
                          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Despesas Operacionais</p>
                          <p className="text-3xl font-black text-red-600">{formatCurrency(dreData.totalExits)}</p>
                      </div>
                      <div className="bg-gradient-to-br from-blue-900 to-blue-950 p-8 rounded-[48px] shadow-2xl text-white">
                          <p className="text-[10px] font-black text-blue-300 uppercase tracking-widest mb-2">Resultado Líquido</p>
                          <p className="text-4xl font-black italic tracking-tighter">{formatCurrency(dreData.netProfit)}</p>
                      </div>
                  </div>
                  <div className="bg-white p-10 rounded-[56px] shadow-xl border border-gray-100">
                      <h3 className="font-black text-gray-900 text-2xl uppercase italic tracking-tighter mb-8 flex items-center gap-3"><Users className="text-blue-700" size={32} /> Distribuição de Lucros</h3>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
                          <div className="p-6 bg-gray-50 rounded-[40px]">
                              <span className="text-[9px] font-black text-gray-400 uppercase block mb-4">Regis & Luciene (63,33%)</span>
                              <p className="text-2xl font-black text-gray-900">{formatCurrency(dreData.regisLuciene)}</p>
                          </div>
                          <div className="p-6 bg-gray-50 rounded-[40px]">
                              <span className="text-[9px] font-black text-gray-400 uppercase block mb-4">Ademir (26,67%)</span>
                              <p className="text-2xl font-black text-gray-900">{formatCurrency(dreData.ademir)}</p>
                          </div>
                          <div className="p-6 bg-gray-50 rounded-[40px]">
                              <span className="text-[9px] font-black text-gray-400 uppercase block mb-4">Junior (10%)</span>
                              <p className="text-2xl font-black text-gray-900">{formatCurrency(dreData.junior)}</p>
                          </div>
                      </div>
                  </div>
              </div>
              <div className="bg-white p-8 rounded-[40px] border border-gray-100">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">Filtro de Período</p>
                  <input type="month" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} className="w-full p-4 bg-gray-50 rounded-2xl font-black text-sm outline-none" />
              </div>
          </div>
      )}

      {activeTab === 'vendas' && (
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 animate-in slide-in-from-bottom-2 duration-400">
              <div className="xl:col-span-2 space-y-6">
                  <div className="bg-white p-6 rounded-[32px] shadow-sm border border-gray-100 flex flex-wrap gap-2">
                      {PRODUCT_CATEGORIES.map(cat => (
                          <button key={cat} onClick={() => { setSelectedCategory(cat); setSelectedProductName(null); setSelectedItem(null); }} className={`px-8 py-4 rounded-[20px] text-[11px] font-black uppercase tracking-widest transition-all border-2 ${selectedCategory === cat ? 'bg-blue-600 border-blue-600 text-white shadow-lg scale-105' : 'bg-white border-gray-100 text-blue-600 hover:border-blue-200'}`}>
                              {cat}
                          </button>
                      ))}
                  </div>

                  {selectedCategory && (
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                          {categoryItems.map(name => (
                              <button key={name} onClick={() => { setSelectedProductName(name); setSelectedItem(null); }} className={`p-8 rounded-[40px] border-2 transition-all flex flex-col items-center text-center gap-4 ${selectedProductName === name ? 'bg-blue-50 border-blue-600' : 'bg-white border-gray-100 hover:border-blue-300'}`}>
                                  <Package size={40} className={selectedProductName === name ? 'text-blue-700' : 'text-gray-200'} />
                                  <span className="text-xs font-black uppercase italic text-gray-900">{name}</span>
                              </button>
                          ))}
                      </div>
                  )}

                  {selectedProductName && (
                      <div className="bg-white p-10 rounded-[56px] shadow-xl border border-gray-100">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                              <div>
                                  <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">Escolha o Sabor</h4>
                                  <div className="grid grid-cols-2 gap-3">
                                      {itemFlavors.map(item => (
                                          <button key={item.id} onClick={() => setSelectedItem(item)} className={`p-5 rounded-[24px] border-2 text-left transition-all ${selectedItem?.id === item.id ? 'bg-red-50 border-red-600 shadow-md' : 'bg-gray-50 border-transparent hover:border-red-200'}`}>
                                              <p className="text-[9px] font-black uppercase text-red-600 mb-1">{item.flavor || 'Padrão'}</p>
                                              <p className="text-xl font-black text-gray-900">{formatCurrency(item.price)}</p>
                                          </button>
                                      ))}
                                  </div>
                              </div>
                              <div>
                                  <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">Tamanho (ml)</h4>
                                  <div className="grid grid-cols-3 gap-2">
                                      {ML_OPTIONS.map(ml => (
                                          <button key={ml} onClick={() => setSelectedMl(ml)} className={`py-3 rounded-xl text-[10px] font-bold border-2 transition-all ${selectedMl === ml ? 'bg-gray-900 border-gray-900 text-white' : 'bg-white border-gray-100 text-gray-400 hover:border-gray-300'}`}>{ml}</button>
                                      ))}
                                  </div>
                              </div>
                          </div>

                          {selectedItem && (
                              <div className="mt-10 pt-10 border-t border-gray-100 flex flex-col lg:flex-row items-center justify-between gap-8">
                                  <div className="flex items-center gap-6">
                                      <button onClick={() => setQuantity(Math.max(1, quantity - 1))} className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center font-black text-2xl hover:bg-gray-200 transition-all">-</button>
                                      <span className="text-3xl font-black w-12 text-center">{quantity}</span>
                                      <button onClick={() => setQuantity(quantity + 1)} className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center font-black text-2xl hover:bg-gray-200 transition-all">+</button>
                                  </div>
                                  <div className="flex flex-1 flex-wrap gap-3 justify-center">
                                      {(['Pix', 'Cartão', 'Dinheiro'] as IceCreamPaymentMethod[]).map(pm => (
                                          <button key={pm} onClick={() => setPaymentMethod(pm)} className={`px-8 py-4 rounded-[20px] text-[10px] font-black uppercase flex items-center gap-3 border-2 transition-all ${paymentMethod === pm ? 'bg-blue-800 text-white border-blue-800 shadow-xl' : 'bg-white text-gray-400 border-gray-100 hover:border-blue-200'}`}>
                                              {pm === 'Pix' ? <Hash size={16}/> : pm === 'Cartão' ? <CreditCard size={16}/> : <Banknote size={16}/>}
                                              {pm}
                                          </button>
                                      ))}
                                  </div>
                                  <button onClick={handleAddToCart} className="bg-red-600 text-white px-10 py-5 rounded-[24px] font-black uppercase text-xs shadow-2xl hover:bg-red-700 transition-all flex items-center gap-3 active:scale-95"><Plus size={20}/> Adicionar</button>
                              </div>
                          )}
                      </div>
                  )}
              </div>

              <div className="bg-gray-900 rounded-[56px] p-10 text-white shadow-2xl flex flex-col h-fit sticky top-8">
                  <h3 className="text-2xl font-black uppercase italic tracking-tighter leading-none mb-10">Carrinho de <span className="text-red-500">Vendas</span></h3>
                  <div className="space-y-4 mb-10 max-h-[400px] overflow-y-auto no-scrollbar">
                      {cart.map((item, idx) => (
                          <div key={item.id} className="flex items-center justify-between bg-white/5 p-5 rounded-[32px] border border-white/5 group">
                              <div className="flex-1">
                                  <p className="text-[10px] font-black text-red-500 uppercase">{item.category} • {item.ml}</p>
                                  <p className="font-black uppercase italic my-1 text-sm">{item.productName} - {item.flavor}</p>
                                  <p className="text-[10px] font-bold text-gray-400">{item.unitsSold}x {formatCurrency(item.unitPrice)} | <span className="text-blue-400">{item.paymentMethod}</span></p>
                              </div>
                              <button onClick={() => setCart(cart.filter((_, i) => i !== idx))} className="p-3 text-gray-600 hover:text-red-500"><Trash2 size={20}/></button>
                          </div>
                      ))}
                      {cart.length === 0 && <p className="text-center py-10 text-[10px] text-gray-600 font-black uppercase tracking-widest">Carrinho Vazio</p>}
                  </div>
                  <div className="pt-10 border-t border-white/10 space-y-6">
                      <div className="flex justify-between items-end">
                          <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Total</span>
                          <span className="text-5xl font-black tracking-tighter italic text-white">{formatCurrency(cart.reduce((a, b) => a + b.totalValue, 0))}</span>
                      </div>
                      <button onClick={handleFinalizeSale} disabled={cart.length === 0 || isSubmitting} className="w-full py-6 bg-red-600 hover:bg-red-700 disabled:bg-gray-800 rounded-[30px] font-black uppercase text-sm shadow-2xl flex items-center justify-center gap-3 transition-all active:translate-y-1">
                          {isSubmitting ? <Loader2 className="animate-spin" size={20}/> : <CheckCircle2 size={20}/>} Finalizar Venda
                      </button>
                  </div>
              </div>
          </div>
      )}

      {activeTab === 'financeiro' && (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-10 animate-in fade-in duration-300">
              <div className="bg-white p-12 rounded-[64px] shadow-2xl border border-gray-100">
                  <h3 className="font-black text-gray-900 text-3xl uppercase italic tracking-tighter mb-10 flex items-center gap-4"><Banknote className="text-blue-700" size={40} /> Lançamento de <span className="text-red-600">Despesa</span></h3>
                  <form onSubmit={handleSaveTransaction} className="space-y-8">
                      <div className="grid grid-cols-2 gap-8">
                          <div className="space-y-2">
                              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block ml-1">Data</label>
                              <input type="date" value={financeForm.date} onChange={e => setFinanceForm({...financeForm, date: e.target.value})} className="w-full p-5 bg-gray-50 border-none rounded-[24px] font-black text-sm outline-none focus:ring-4 focus:ring-blue-100" />
                          </div>
                          <div className="space-y-2">
                              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block ml-1">Valor (R$)</label>
                              <input value={financeForm.value} onChange={e => setFinanceForm({...financeForm, value: e.target.value})} placeholder="0,00" className="w-full p-6 bg-gray-50 border-none rounded-[28px] font-black text-4xl text-gray-900 focus:ring-4 focus:ring-blue-100 outline-none" />
                          </div>
                      </div>
                      <div className="grid grid-cols-2 gap-8">
                          <div className="space-y-2">
                              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block ml-1">Categoria</label>
                              <select value={financeForm.category} onChange={e => setFinanceForm({...financeForm, category: e.target.value as IceCreamExpenseCategory})} className="w-full p-5 bg-gray-50 border-none rounded-[24px] font-black uppercase text-xs">
                                  {EXPENSE_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                              </select>
                          </div>
                          <div className="space-y-2">
                              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block ml-1">Beneficiário / Nome</label>
                              <input value={financeForm.employeeName} onChange={e => setFinanceForm({...financeForm, employeeName: e.target.value})} placeholder="Quem recebeu?" className="w-full p-5 bg-gray-50 border-none rounded-[24px] font-black text-gray-800 uppercase italic text-sm outline-none focus:ring-4 focus:ring-blue-100" />
                          </div>
                      </div>
                      <button type="submit" disabled={isSubmitting} className="w-full py-6 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white rounded-[32px] font-black uppercase text-sm shadow-2xl flex items-center justify-center gap-4 transition-all">
                          {isSubmitting ? <Loader2 className="animate-spin" size={24}/> : <Save size={24}/>} Efetivar Lançamento
                      </button>
                  </form>
              </div>
          </div>
      )}

      {activeTab === 'products' && !isCashier && (
        <div className="space-y-6 animate-in fade-in duration-300">
            <div className="flex justify-between items-center bg-white p-10 rounded-[48px] shadow-sm border border-gray-100">
                <div>
                    <h3 className="font-black text-gray-900 text-2xl uppercase italic tracking-tighter">Catálogo de <span className="text-red-600">Itens</span></h3>
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-2">Configurações de Preços e Disponibilidade</p>
                </div>
                <button onClick={() => { setEditingItem(null); setProductForm({ name: '', category: 'Sundae', flavor: '', price: '', active: true }); setIsProductModalOpen(true); }} className="bg-gray-950 text-white px-10 py-5 rounded-[24px] font-black uppercase text-xs shadow-2xl hover:bg-black transition-all border-b-4 border-red-700">Adicionar Novo Produto</button>
            </div>
            <div className="bg-white rounded-[48px] shadow-xl border border-gray-100 overflow-hidden">
                <table className="w-full text-left">
                    <thead><tr className="bg-gray-50 text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100"><th className="px-10 py-6">Identificação</th><th className="px-10 py-6">Categoria</th><th className="px-10 py-6">Valor</th><th className="px-10 py-6 text-right">Ações</th></tr></thead>
                    <tbody className="divide-y divide-gray-50">
                        {items.map(item => (
                            <tr key={item.id} className={`hover:bg-blue-50/20 transition-all ${!item.active ? 'opacity-40 grayscale' : ''}`}>
                                <td className="px-10 py-5"><span className="font-black text-gray-900 uppercase italic tracking-tight">{item.name} - {item.flavor}</span></td>
                                <td className="px-10 py-5"><span className="px-4 py-1.5 bg-blue-50 text-blue-700 rounded-full text-[9px] font-black uppercase border border-blue-100">{item.category}</span></td>
                                <td className="px-10 py-5"><span className="text-lg font-black text-blue-800">{formatCurrency(item.price)}</span></td>
                                <td className="px-10 py-5 text-right">
                                    <div className="flex justify-end gap-3">
                                        <button onClick={() => handleEditClick(item)} className="p-3 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-600 hover:text-white"><Edit3 size={18}/></button>
                                        <button onClick={() => onDeleteItem(item.id)} className="p-3 bg-red-50 text-red-500 rounded-xl hover:bg-red-600 hover:text-white"><Trash2 size={18}/></button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
      )}

      {isProductModalOpen && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-xl flex items-center justify-center z-[150] p-4">
            <div className="bg-white rounded-[60px] shadow-2xl w-full max-w-xl overflow-hidden animate-in zoom-in duration-300">
                <div className="p-10 bg-gray-50 border-b flex justify-between items-center">
                    <h3 className="text-3xl font-black text-gray-900 uppercase italic tracking-tighter leading-none">{editingItem ? 'Editar' : 'Novo'} <span className="text-blue-700">Produto</span></h3>
                    <button onClick={() => setIsProductModalOpen(false)} className="text-gray-400 hover:text-red-600 transition-all"><X size={24} /></button>
                </div>
                <div className="p-12 space-y-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-500 uppercase block tracking-widest">Nome *</label>
                            <input value={productForm.name} onChange={e => setProductForm({...productForm, name: e.target.value})} className="w-full px-6 py-5 bg-gray-50 border-none rounded-[24px] font-black text-gray-800 uppercase italic focus:ring-4 focus:ring-blue-100 outline-none" />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-500 uppercase block tracking-widest">Categoria</label>
                            <select value={productForm.category} onChange={e => setProductForm({...productForm, category: e.target.value as IceCreamCategory})} className="w-full px-6 py-5 bg-gray-50 border-none rounded-[24px] font-black text-blue-700 uppercase outline-none">
                                {PRODUCT_CATEGORIES.map(cat => (<option key={cat} value={cat}>{cat}</option>))}
                            </select>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-500 uppercase block tracking-widest">Sabor</label>
                            <input value={productForm.flavor} onChange={e => setProductForm({...productForm, flavor: e.target.value})} className="w-full px-6 py-5 bg-gray-50 border-none rounded-[24px] font-black text-gray-800 uppercase italic outline-none" />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-500 uppercase block tracking-widest">Valor (R$)</label>
                            <input value={productForm.price} onChange={e => setProductForm({...productForm, price: e.target.value})} placeholder="0,00" className="w-full px-6 py-5 bg-blue-50/50 border-4 border-blue-100 rounded-[28px] font-black text-3xl text-blue-900 outline-none focus:border-blue-600 transition-all" />
                        </div>
                    </div>
                    <div className="flex items-center gap-4 bg-gray-50 p-6 rounded-[30px] border border-gray-100">
                        <input type="checkbox" id="active-check" checked={productForm.active} onChange={e => setProductForm({...productForm, active: e.target.checked})} className="w-6 h-6 accent-blue-600 rounded-lg cursor-pointer"/><label htmlFor="active-check" className="text-xs font-black text-gray-600 uppercase tracking-widest cursor-pointer select-none">Ativo no PDV</label>
                    </div>
                </div>
                <div className="p-10 bg-gray-50 flex gap-5 border-t border-gray-100">
                    <button onClick={() => setIsProductModalOpen(false)} className="flex-1 py-6 bg-white border-2 border-gray-200 rounded-[28px] font-black text-gray-400 uppercase text-xs">Cancelar</button>
                    <button onClick={handleSaveProduct} disabled={isSubmitting} className="flex-1 py-6 bg-blue-700 text-white rounded-[28px] font-black uppercase text-xs shadow-2xl flex items-center justify-center gap-3 transition-all">
                        {isSubmitting ? <Loader2 className="animate-spin" size={20}/> : <Save size={20}/>} Confirmar Cadastro
                    </button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default IceCreamModule;
