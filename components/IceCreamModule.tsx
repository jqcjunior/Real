
import React, { useState, useMemo } from 'react';
import { IceCreamItem, IceCreamDailySale, IceCreamTransaction, IceCreamCategory, IceCreamExpenseCategory, IceCreamPaymentMethod } from '../types';
import { formatCurrency } from '../constants';
import { IceCream, Plus, DollarSign, PieChart, Save, Trash2, X, Calculator, Edit3, Package, ChevronDown, Loader2, ShoppingCart, CheckCircle2, ChevronRight, Hash, CreditCard, Wallet, Banknote, Shield, TrendingUp, TrendingDown, Calendar, User, Search, FileText, Lock, Unlock, Users, Receipt, CheckCircle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface IceCreamModuleProps {
  items: IceCreamItem[];
  sales: IceCreamDailySale[];
  finances: IceCreamTransaction[];
  onAddSales: (sale: IceCreamDailySale) => Promise<void>;
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
  
  // Mês de referência compartilhado
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

  // Financial States
  const [financeForm, setFinanceForm] = useState({ 
      category: 'Vale Funcionário' as IceCreamExpenseCategory, 
      value: '', 
      employeeName: '',
      description: '',
      date: new Date().toISOString().split('T')[0]
  });

  // Modais
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<IceCreamItem | null>(null);
  const [productForm, setProductForm] = useState({ name: '', category: 'Sundae' as IceCreamCategory, flavor: '', price: '', active: true });

  // Nomes de funcionários para o seletor
  const activeEmployees = useMemo(() => {
      const names = new Set<string>();
      finances.forEach(f => { if (f.employeeName) names.add(f.employeeName); });
      return Array.from(names).sort();
  }, [finances]);

  // PDV Logic: Group Items by Category then Name (to show flavors) - FILTRANDO APENAS ATIVOS
  const categoryItems = useMemo(() => {
    if (!selectedCategory) return [];
    const names = new Set<string>();
    items
      .filter(i => i.category === selectedCategory && i.active) // Somente ativos para o PDV
      .forEach(i => names.add(i.name));
    return Array.from(names).sort();
  }, [items, selectedCategory]);

  const itemFlavors = useMemo(() => {
    if (!selectedProductName || !selectedCategory) return [];
    return items.filter(i => i.name === selectedProductName && i.category === selectedCategory && i.active); // Somente ativos para o PDV
  }, [items, selectedProductName, selectedCategory]);

  // CONSOLIDAÇÃO DRE & FECHAMENTO
  const dreData = useMemo(() => {
    const monthSales = sales.filter(s => s.createdAt && s.createdAt.startsWith(selectedMonth));
    const monthFinances = finances.filter(f => f.date.startsWith(selectedMonth));

    const salesRevenue = monthSales.reduce((acc, sale) => acc + (sale.totalValue || 0), 0);
    const manualEntries = monthFinances.filter(f => f.type === 'entry').reduce((acc, f) => acc + f.value, 0);
    const totalEntries = salesRevenue + manualEntries;

    const totalExits = monthFinances.filter(f => f.type === 'exit').reduce((acc, f) => acc + f.value, 0);
    const expensesByCategory = EXPENSE_CATEGORIES.map(cat => ({
        name: cat,
        value: monthFinances.filter(f => f.type === 'exit' && f.category === cat).reduce((acc, f) => acc + f.value, 0)
    }));

    const netProfit = totalEntries - totalExits;
    const margin = totalEntries > 0 ? (netProfit / totalEntries) * 100 : 0;

    // Regras de Distribuição: 63,33% Regis/Luciene | 26,67% Ademir | 10% Junior
    const regisLuciene = netProfit > 0 ? netProfit * 0.6333 : 0;
    const ademir = netProfit > 0 ? netProfit * 0.2667 : 0;
    const junior = netProfit > 0 ? netProfit * 0.10 : 0;

    // Lógica de Mês Encerrado: Se mês selecionado < mês atual
    const now = new Date();
    const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const isClosed = selectedMonth < currentMonthStr;

    return { 
        totalEntries, totalExits, netProfit, margin, 
        expensesByCategory, regisLuciene, ademir, junior, 
        salesRevenue, manualEntries, isClosed 
    };
  }, [sales, finances, selectedMonth]);

  const handleFinishSale = async () => {
    if (!selectedItem || !paymentMethod || quantity < 1) {
        alert("Selecione Produto, Sabor, Quantidade e Forma de Pagamento.");
        return;
    }
    setIsSubmitting(true);
    try {
        const sale: IceCreamDailySale = {
            id: `temp-${Date.now()}`,
            itemId: selectedItem.id,
            productName: selectedItem.name,
            category: selectedItem.category,
            flavor: selectedItem.flavor || 'Padrão',
            unitsSold: quantity,
            unitPrice: selectedItem.price,
            totalValue: selectedItem.price * quantity,
            paymentMethod: paymentMethod
        };
        await onAddSales(sale);
        setSelectedCategory(null);
        setSelectedProductName(null);
        setSelectedItem(null);
        setQuantity(1);
        setPaymentMethod(null);
        alert("Venda realizada com sucesso!");
    } catch (e) {
        alert("Erro ao finalizar venda.");
    } finally {
        setIsSubmitting(false);
    }
  };

  const handleSaveFinance = async () => {
    const val = parseFloat(financeForm.value.replace(',', '.'));
    if (isNaN(val) || val <= 0) return alert("Valor inválido");
    
    const isEmployeeCat = financeForm.category.includes('Funcionário');
    if (isEmployeeCat && !financeForm.employeeName) return alert("Informe o nome do funcionário.");

    setIsSubmitting(true);
    await onAddTransaction({
        id: `tx-${Date.now()}`, 
        date: financeForm.date, 
        type: 'exit', 
        category: financeForm.category, 
        value: val, 
        employeeName: isEmployeeCat ? financeForm.employeeName : undefined,
        description: financeForm.description, 
        createdAt: new Date()
    });
    setFinanceForm({ ...financeForm, value: '', employeeName: '', description: '' });
    setIsSubmitting(false);
    alert("Lançamento realizado!");
  };

  const handleSaveProduct = async () => {
    const priceVal = parseFloat(productForm.price.replace(',', '.'));
    if (!productForm.name || isNaN(priceVal)) return alert("Preencha Nome e Valor.");
    setIsSubmitting(true);
    if (editingItem) {
        await onUpdateItem({ ...editingItem, name: String(productForm.name), category: productForm.category, flavor: productForm.flavor, price: priceVal, active: productForm.active });
    } else {
        await onAddItem(String(productForm.name), productForm.category, priceVal, productForm.flavor);
    }
    setProductForm({ name: '', category: 'Sundae', flavor: '', price: '', active: true });
    setEditingItem(null);
    setIsProductModalOpen(false);
    setIsSubmitting(false);
  };

  const handleToggleProductStatus = async (item: IceCreamItem) => {
      await onUpdateItem({ ...item, active: !item.active });
  };

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-[1600px] mx-auto min-h-full bg-gray-50 flex flex-col">
      {/* CABEÇALHO DO MÓDULO */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
        <div className="flex items-center gap-4">
          <div className="p-4 bg-blue-800 rounded-2xl text-white shadow-lg"><IceCream size={32} /></div>
          <div>
            <h2 className="text-3xl font-black text-gray-900 uppercase italic leading-none">Gestão <span className="text-red-600">Sorvete</span></h2>
            <p className="text-gray-500 text-sm font-bold uppercase tracking-widest mt-1">Fluxo de Caixa e Distribuição de Lucros</p>
          </div>
        </div>
        <div className="flex bg-gray-100 p-1 rounded-2xl overflow-x-auto no-scrollbar max-w-full">
          {[
              {id:'dre',label:'DRE',icon:FileText},
              {id:'vendas',label:'Vendas',icon:ShoppingCart},
              {id:'financeiro',label:'Financeiro',icon:Banknote},
              {id:'historico',label:'Histórico',icon:Hash},
              {id:'products',label:'Produtos',icon:Package}
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase transition-all whitespace-nowrap ${activeTab === tab.id ? 'bg-white text-blue-700 shadow-md scale-105' : 'text-gray-500 hover:text-gray-700'}`}><tab.icon size={16}/> {tab.label}</button>
          ))}
        </div>
      </div>

      {/* ABA DRE - CONSOLIDADO MENSAL */}
      {activeTab === 'dre' && (
        <div className="space-y-6 animate-in fade-in duration-500">
          
          {/* Filtro e Status de Competência */}
          <div className="bg-white p-8 rounded-[40px] shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between items-center gap-6">
              <div>
                  <h3 className="text-2xl font-black text-gray-900 uppercase italic tracking-tighter leading-none">Consolidado <span className="text-red-600">DRE</span></h3>
                  <div className="mt-4 flex items-center gap-3 bg-gray-100 p-2 rounded-2xl w-fit">
                        <Calendar size={18} className="text-blue-600 ml-2"/>
                        <input 
                            type="month" 
                            value={selectedMonth} 
                            onChange={e => setSelectedMonth(e.target.value)} 
                            className="bg-transparent font-black text-gray-800 border-none outline-none uppercase text-xs cursor-pointer"
                        />
                  </div>
              </div>

              <div className="flex items-center gap-4">
                  {dreData.isClosed ? (
                      <div className="flex items-center gap-2 bg-gray-900 text-white px-6 py-3 rounded-2xl font-black uppercase text-[10px] shadow-xl">
                          <Lock size={14} className="text-red-500" /> Mês Encerrado
                      </div>
                  ) : (
                      <div className="flex items-center gap-2 bg-green-50 text-green-700 border border-green-200 px-6 py-3 rounded-2xl font-black uppercase text-[10px]">
                          <Unlock size={14} /> Mês Aberto
                      </div>
                  )}
              </div>
          </div>

          {/* KPI CARDS */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white p-6 rounded-3xl border-l-8 border-green-500 shadow-sm">
                <p className="text-[10px] font-black text-gray-400 uppercase mb-1">Entradas Totais</p>
                <p className="text-3xl font-black text-gray-900">{formatCurrency(dreData.totalEntries)}</p>
                <div className="flex justify-between mt-2 text-[9px] font-bold text-gray-400">
                    <span>Vendas: {formatCurrency(dreData.salesRevenue)}</span>
                    <span>Extras: {formatCurrency(dreData.manualEntries)}</span>
                </div>
            </div>
            <div className="bg-white p-6 rounded-3xl border-l-8 border-red-500 shadow-sm">
                <p className="text-[10px] font-black text-gray-400 uppercase mb-1">Saídas (Custos)</p>
                <p className="text-3xl font-black text-gray-900">{formatCurrency(dreData.totalExits)}</p>
            </div>
            <div className={`p-6 rounded-3xl border-l-8 shadow-sm ${dreData.netProfit >= 0 ? 'bg-blue-900 border-blue-400 text-white' : 'bg-red-900 border-red-400 text-white'}`}>
                <p className="text-[10px] font-black opacity-60 uppercase mb-1">Lucro Líquido</p>
                <p className="text-3xl font-black">{formatCurrency(dreData.netProfit)}</p>
            </div>
            <div className="bg-white p-6 rounded-3xl border-l-8 border-purple-500 shadow-sm">
                <p className="text-[10px] font-black text-gray-400 uppercase mb-1">Margem Líquida %</p>
                <p className="text-3xl font-black text-gray-900">{dreData.margin.toFixed(2)}%</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* PAINEL DE DISTRIBUIÇÃO SOCIETÁRIA */}
            <div className="lg:col-span-8 bg-white p-8 rounded-[40px] shadow-sm border border-gray-100 flex flex-col h-full">
                <div className="flex items-center justify-between mb-8">
                    <h3 className="text-xl font-black text-gray-800 flex items-center gap-3 uppercase italic leading-none">
                        <Users className="text-blue-600"/> Distribuição de Lucros (Automática)
                    </h3>
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest bg-gray-50 px-3 py-1 rounded-full border">Divisão de Cotas</span>
                </div>

                <div className="space-y-4 flex-1">
                    {/* Regis e Luciene */}
                    <div className="bg-blue-50 p-6 rounded-3xl border border-blue-100 flex justify-between items-center transition-all hover:scale-[1.01]">
                        <div className="flex items-center gap-4">
                            <div className="w-14 h-14 bg-blue-600 text-white rounded-2xl flex items-center justify-center font-black text-lg">63,3%</div>
                            <div>
                                <h4 className="font-black text-gray-900 uppercase italic text-lg leading-tight">Regis e Luciene</h4>
                                <p className="text-[10px] text-blue-400 font-bold uppercase tracking-wider">Sócios Majoritários</p>
                            </div>
                        </div>
                        <div className="text-right">
                            <p className="text-2xl font-black text-blue-900">{formatCurrency(dreData.regisLuciene)}</p>
                        </div>
                    </div>

                    {/* Ademir */}
                    <div className="bg-orange-50 p-6 rounded-3xl border border-orange-100 flex justify-between items-center transition-all hover:scale-[1.01]">
                        <div className="flex items-center gap-4">
                            <div className="w-14 h-14 bg-orange-500 text-white rounded-2xl flex items-center justify-center font-black text-lg">26,6%</div>
                            <div>
                                <h4 className="font-black text-gray-900 uppercase italic text-lg leading-tight">Ademir</h4>
                                <p className="text-[10px] text-orange-400 font-bold uppercase tracking-wider">Sócio</p>
                            </div>
                        </div>
                        <div className="text-right">
                            <p className="text-2xl font-black text-orange-900">{formatCurrency(dreData.ademir)}</p>
                        </div>
                    </div>

                    {/* Junior */}
                    <div className="bg-green-50 p-6 rounded-3xl border border-green-100 flex justify-between items-center transition-all hover:scale-[1.01]">
                        <div className="flex items-center gap-4">
                            <div className="w-14 h-14 bg-green-600 text-white rounded-2xl flex items-center justify-center font-black text-lg">10%</div>
                            <div>
                                <h4 className="font-black text-gray-900 uppercase italic text-lg leading-tight">Junior</h4>
                                <p className="text-[10px] text-green-500 font-bold uppercase tracking-wider">Administrador</p>
                            </div>
                        </div>
                        <div className="text-right">
                            <p className="text-2xl font-black text-green-900">{formatCurrency(dreData.junior)}</p>
                        </div>
                    </div>
                </div>

                <div className="mt-8 p-6 bg-gray-900 rounded-[28px] flex justify-between items-center text-white">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-white/10 rounded-xl"><Calculator size={20} className="text-blue-400" /></div>
                        <span className="text-sm font-black uppercase italic">Total Gerado no Período</span>
                    </div>
                    <span className="text-3xl font-black text-blue-400">{formatCurrency(dreData.regisLuciene + dreData.ademir + dreData.junior)}</span>
                </div>
            </div>

            {/* RESUMO TÉCNICO */}
            <div className="lg:col-span-4 bg-white p-8 rounded-[40px] shadow-sm border border-gray-100 flex flex-col h-full">
                <h3 className="text-xl font-black text-gray-800 mb-8 flex items-center gap-3 uppercase italic leading-none">
                    <Receipt className="text-red-500"/> Relatório Executivo
                </h3>
                
                <div className="space-y-6 flex-1">
                    <div className="flex justify-between items-center border-b border-gray-50 pb-4">
                        <span className="text-[10px] font-black text-gray-400 uppercase">Receita Bruta</span>
                        <span className="font-black text-gray-900">{formatCurrency(dreData.totalEntries)}</span>
                    </div>
                    <div className="flex justify-between items-center border-b border-gray-50 pb-4">
                        <span className="text-[10px] font-black text-gray-400 uppercase">Impostos/Taxas (Est.)</span>
                        <span className="font-black text-red-500">-</span>
                    </div>
                    <div className="flex justify-between items-center border-b border-gray-50 pb-4">
                        <span className="text-[10px] font-black text-gray-400 uppercase">Custos Operacionais</span>
                        <span className="font-black text-red-500">{formatCurrency(dreData.totalExits)}</span>
                    </div>
                    <div className="flex justify-between items-center border-b border-gray-50 pb-4">
                        <span className="text-[10px] font-black text-gray-400 uppercase">Lucro a Distribuir</span>
                        <span className="font-black text-green-600">{formatCurrency(dreData.netProfit)}</span>
                    </div>
                </div>

                <div className="mt-auto space-y-3">
                    <button onClick={() => window.print()} className="w-full py-4 bg-gray-100 text-gray-600 rounded-2xl font-black uppercase text-xs flex items-center justify-center gap-2 hover:bg-gray-200 transition-all active:scale-95">
                        <FileText size={16}/> Imprimir DRE
                    </button>
                    <p className="text-[9px] text-gray-300 font-bold text-center uppercase leading-tight">Relatório gerado em {new Date().toLocaleString('pt-BR')}<br/>Baseado em dados do Supabase</p>
                </div>
            </div>
          </div>
        </div>
      )}

      {/* ABA VENDAS - PDV INTERFACE */}
      {activeTab === 'vendas' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-in slide-in-from-right-4 duration-500 flex-1">
            <div className="lg:col-span-8 space-y-6">
                <div className="flex items-center gap-2 text-gray-400 text-[10px] font-black uppercase tracking-widest bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
                    <span className={selectedCategory ? 'text-blue-600' : 'text-gray-900'}>1. Categoria</span>
                    <ChevronRight size={14} />
                    <span className={selectedProductName ? 'text-blue-600' : (selectedCategory ? 'text-gray-900' : '')}>2. Produto</span>
                    <ChevronRight size={14} />
                    <span className={selectedItem ? 'text-blue-600' : (selectedProductName ? 'text-gray-900' : '')}>3. Sabor / Tamanho</span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                    {PRODUCT_CATEGORIES.map(cat => (
                        <button key={cat} onClick={() => { setSelectedCategory(cat); setSelectedProductName(null); setSelectedItem(null); }} className={`p-4 rounded-2xl font-black uppercase text-[10px] shadow-sm transition-all border-2 flex flex-col items-center gap-2 ${selectedCategory === cat ? 'bg-blue-600 text-white border-blue-400 scale-105 shadow-blue-200' : 'bg-white text-gray-500 border-transparent hover:border-gray-200'}`}><div className={`p-2 rounded-xl ${selectedCategory === cat ? 'bg-blue-400' : 'bg-gray-100'}`}><Package size={20} /></div>{cat}</button>
                    ))}
                </div>
                {selectedCategory && (
                    <div className="bg-white p-8 rounded-[40px] shadow-sm border border-gray-100 min-h-[200px]">
                        <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-6 flex items-center gap-2"><ChevronDown size={14}/> Produtos em {selectedCategory}</h4>
                        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">{categoryItems.map(name => (<button key={name} onClick={() => { setSelectedProductName(name); setSelectedItem(null); }} className={`p-5 rounded-3xl font-bold text-sm transition-all border-2 text-left flex flex-col justify-between h-28 ${selectedProductName === name ? 'bg-blue-50 border-blue-300 text-blue-900 ring-4 ring-blue-50' : 'bg-gray-50 border-transparent hover:border-gray-200 text-gray-700'}`}><span className="uppercase tracking-tighter leading-tight">{name}</span>{selectedProductName === name && <CheckCircle2 size={20} className="text-blue-600 self-end" />}</button>))}{categoryItems.length === 0 && <p className="col-span-full text-center py-10 font-bold text-gray-300">Nenhum produto cadastrado.</p>}</div>
                    </div>
                )}
                {selectedProductName && (
                    <div className="bg-white p-8 rounded-[40px] shadow-sm border border-gray-100 animate-in fade-in slide-in-from-bottom-2">
                        <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-6">Sabores / Variações Disponíveis</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">{itemFlavors.map(item => (<button key={item.id} onClick={() => setSelectedItem(item)} className={`p-6 rounded-3xl font-black text-lg transition-all border-2 flex justify-between items-center ${selectedItem?.id === item.id ? 'bg-red-500 text-white border-red-400 shadow-xl' : 'bg-gray-50 border-transparent hover:border-gray-200 text-gray-800'}`}><div className="flex flex-col text-left"><span className="text-[10px] opacity-70 uppercase mb-1">Sabor</span><span>{item.flavor || 'Original'}</span></div><div className="text-right"><span className="text-[10px] block opacity-70">Preço</span>{formatCurrency(item.price)}</div></button>))}</div>
                    </div>
                )}
            </div>
            <div className="lg:col-span-4 h-fit sticky top-8">
                <div className="bg-white rounded-[40px] shadow-2xl border border-gray-200 overflow-hidden">
                    <div className="p-8 bg-gray-900 text-white"><h3 className="text-xl font-black uppercase italic tracking-tighter flex items-center gap-3"><Calculator size={24} className="text-red-500" /> Detalhes da Venda</h3></div>
                    <div className="p-8 space-y-8">
                        <div className="space-y-4">{!selectedItem ? (<div className="py-10 text-center text-gray-300 font-bold uppercase italic text-sm">Aguardando seleção...</div>) : (<div className="space-y-4 animate-in fade-in"><div className="flex justify-between items-center border-b pb-4"><div className="flex flex-col"><span className="text-[10px] font-black text-gray-400 uppercase">Item</span><span className="font-black text-gray-900 text-lg uppercase tracking-tighter">{selectedItem.name}</span><span className="text-blue-600 font-bold text-xs">{selectedItem.flavor || 'Original'}</span></div><div className="text-right"><span className="text-[10px] font-black text-gray-400 uppercase">Unitário</span><div className="text-lg font-black text-gray-900">{formatCurrency(selectedItem.price)}</div></div></div><div className="flex justify-between items-center"><span className="text-[10px] font-black text-gray-400 uppercase">Quantidade</span><div className="flex items-center gap-4 bg-gray-100 p-2 rounded-2xl"><button onClick={() => setQuantity(Math.max(1, quantity - 1))} className="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center font-black text-xl">-</button><span className="font-black text-2xl w-8 text-center">{quantity}</span><button onClick={() => setQuantity(quantity + 1)} className="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center font-black text-xl">+</button></div></div></div>)}</div>
                        <div className="space-y-4"><span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block border-b pb-2">Forma de Pagamento</span><div className="grid grid-cols-3 gap-2">{[{id:'Pix', icon: Banknote},{id:'Cartão', icon: CreditCard},{id:'Dinheiro', icon: Wallet}].map(p => (<button key={p.id} onClick={() => setPaymentMethod(p.id as any)} className={`flex flex-col items-center gap-2 p-3 rounded-2xl border-2 transition-all ${paymentMethod === p.id ? 'border-gray-900 bg-gray-900 text-white scale-105' : 'border-gray-100 text-gray-400 hover:border-gray-200'}`}><p.icon size={24} /><span className="text-[9px] font-black uppercase">{p.id}</span></button>))}</div></div>
                        <div className="bg-gray-50 p-6 rounded-3xl border-2 border-dashed border-gray-200"><div className="flex justify-between items-end"><span className="text-[10px] font-black text-gray-400 uppercase">Total a Pagar</span><div className="text-4xl font-black text-blue-800 tracking-tighter">{formatCurrency((selectedItem?.price || 0) * quantity)}</div></div></div>
                        <button onClick={handleFinishSale} disabled={isSubmitting || !selectedItem || !paymentMethod} className="w-full py-6 bg-blue-700 text-white rounded-[28px] font-black uppercase text-sm shadow-2xl shadow-blue-200 hover:bg-blue-800 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-3">{isSubmitting ? <Loader2 className="animate-spin" /> : <ShoppingCart />} Finalizar Venda</button>
                    </div>
                </div>
                <div className="mt-4 p-4 text-[10px] font-bold text-gray-400 uppercase text-center flex items-center justify-center gap-2"><Shield size={12} /> Registro Auditado • Horário do Servidor</div>
            </div>
        </div>
      )}

      {/* ABA FINANCEIRO - LANÇAMENTOS E TRAVA */}
      {activeTab === 'financeiro' && (
          <div className="space-y-6 animate-in slide-in-from-bottom-2 duration-500">
              <div className="bg-white p-8 rounded-[40px] shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between items-center gap-6">
                  <div>
                      <h3 className="text-2xl font-black text-gray-900 uppercase italic tracking-tighter leading-none">Fluxo de <span className="text-blue-700">Caixa</span></h3>
                      <div className="mt-4 flex items-center gap-3 bg-gray-100 p-2 rounded-2xl">
                            <Calendar size={18} className="text-blue-600 ml-2"/>
                            <input type="month" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} className="bg-transparent font-black text-gray-800 border-none outline-none uppercase text-xs cursor-pointer" />
                      </div>
                  </div>
                  <div className="flex gap-8 overflow-x-auto no-scrollbar w-full md:w-auto">
                      <div className="text-center md:text-right">
                          <p className="text-[10px] font-black text-green-600 uppercase tracking-widest mb-1">Entradas</p>
                          <p className="text-2xl font-black text-gray-900">{formatCurrency(dreData.totalEntries)}</p>
                      </div>
                      <div className="text-center md:text-right border-l pl-8 border-gray-100">
                          <p className="text-[10px] font-black text-red-600 uppercase tracking-widest mb-1">Saídas</p>
                          <p className="text-2xl font-black text-gray-900">{formatCurrency(dreData.totalExits)}</p>
                      </div>
                  </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                  <div className="lg:col-span-5">
                      <div className={`bg-white p-8 rounded-[40px] shadow-sm border border-gray-100 space-y-6 ${dreData.isClosed ? 'opacity-50 grayscale pointer-events-none' : ''}`}>
                          <div className="flex items-center gap-3 border-b pb-4">
                              <div className="p-3 bg-red-100 text-red-600 rounded-2xl"><TrendingDown size={20}/></div>
                              <h4 className="text-xl font-black text-gray-900 uppercase italic">Lançar Despesa</h4>
                          </div>
                          {dreData.isClosed && <div className="bg-red-50 p-4 rounded-2xl text-red-600 font-black text-[10px] uppercase text-center border border-red-200">Competência encerrada para novos lançamentos.</div>}
                          <div className="space-y-4">
                              <div>
                                  <label className="text-[10px] font-black text-gray-400 uppercase block mb-2 ml-1">Categoria de Saída *</label>
                                  <select value={financeForm.category} onChange={e => setFinanceForm({...financeForm, category: e.target.value as IceCreamExpenseCategory})} className="w-full p-4 bg-gray-100 rounded-2xl font-black text-gray-800 outline-none uppercase appearance-none">{EXPENSE_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}</select>
                              </div>
                              {financeForm.category.includes('Funcionário') && (
                                  <div className="animate-in fade-in slide-in-from-top-1">
                                      <label className="text-[10px] font-black text-purple-600 uppercase block mb-2 ml-1">Nome do Funcionário *</label>
                                      <div className="relative">
                                          <input list="employees-list" value={financeForm.employeeName} onChange={e => setFinanceForm({...financeForm, employeeName: e.target.value})} placeholder="Selecione ou digite" className="w-full p-4 pl-12 bg-purple-50 border-2 border-purple-100 rounded-2xl font-bold text-gray-800 outline-none focus:border-purple-300 transition-all" /><User className="absolute left-4 top-1/2 -translate-y-1/2 text-purple-400" size={18}/><datalist id="employees-list">{activeEmployees.map(name => <option key={name} value={name}/>)}</datalist>
                                      </div>
                                  </div>
                              )}
                              <div className="grid grid-cols-2 gap-4">
                                  <div><label className="text-[10px] font-black text-gray-400 uppercase block mb-2 ml-1">Data *</label><input type="date" value={financeForm.date} onChange={e => setFinanceForm({...financeForm, date: e.target.value})} className="w-full p-4 bg-gray-100 rounded-2xl font-bold text-gray-800 outline-none" /></div>
                                  <div><label className="text-[10px] font-black text-gray-400 uppercase block mb-2 ml-1">Valor (R$) *</label><input value={financeForm.value} onChange={e => setFinanceForm({...financeForm, value: e.target.value})} placeholder="0,00" className="w-full p-4 bg-gray-100 rounded-2xl font-black text-xl text-red-600 outline-none" /></div>
                              </div>
                              <div><label className="text-[10px] font-black text-gray-400 uppercase block mb-2 ml-1">Descrição</label><textarea value={financeForm.description} onChange={e => setFinanceForm({...financeForm, description: e.target.value})} className="w-full p-4 bg-gray-100 rounded-2xl font-medium text-gray-800 outline-none h-20 resize-none" placeholder="Ex: Pagamento referente a..." /></div>
                              <button onClick={handleSaveFinance} disabled={isSubmitting || dreData.isClosed} className="w-full py-5 bg-gray-900 text-white rounded-3xl font-black uppercase italic shadow-xl hover:bg-black transition-all active:scale-95 flex items-center justify-center gap-2">{isSubmitting ? <Loader2 className="animate-spin"/> : <Save/>} Registrar Saída</button>
                          </div>
                      </div>
                  </div>
                  <div className="lg:col-span-7">
                      <div className="bg-white rounded-[40px] shadow-sm border border-gray-100 overflow-hidden flex flex-col h-full">
                          <div className="p-8 border-b bg-gray-50 flex justify-between items-center"><h4 className="text-xl font-black text-gray-800 uppercase italic leading-none">Movimentação Detalhada</h4><div className="bg-white px-3 py-1 rounded-full text-[10px] font-black text-gray-400 uppercase border border-gray-200">{finances.filter(f => f.date.startsWith(selectedMonth)).length} registros</div></div>
                          <div className="overflow-auto flex-1"><table className="w-full text-left"><thead className="bg-white border-b border-gray-100"><tr className="text-[10px] font-black text-gray-400 uppercase tracking-widest"><th className="px-8 py-5">Data</th><th className="px-8 py-5">Categoria</th><th className="px-8 py-5 text-right">Valor</th><th className="px-8 py-5 text-right">Ação</th></tr></thead><tbody className="divide-y divide-gray-50">{finances.filter(f => f.date.startsWith(selectedMonth)).map(f => (<tr key={f.id} className="hover:bg-gray-50 transition-all group"><td className="px-8 py-4 font-bold text-xs text-gray-500">{new Date(f.date + 'T12:00:00').toLocaleDateString('pt-BR')}</td><td className="px-8 py-4"><div className="flex flex-col"><span className="font-black text-gray-900 uppercase italic text-sm">{f.category}</span><span className="text-[10px] font-black text-blue-600 uppercase">{f.employeeName || f.description || '-'}</span></div></td><td className="px-8 py-4 text-right"><span className={`font-black text-base ${f.type === 'exit' ? 'text-red-600' : 'text-green-600'}`}>{f.type === 'exit' ? '-' : '+'}{formatCurrency(f.value)}</span></td><td className="px-8 py-4 text-right"><button onClick={() => {if(window.confirm('Excluir este lançamento?')) onDeleteTransaction(f.id)}} disabled={dreData.isClosed} className={`p-2 rounded-xl transition-all ${dreData.isClosed ? 'opacity-0' : 'text-gray-300 hover:text-red-600 hover:bg-red-50 group-hover:opacity-100'}`}><Trash2 size={16}/></button></td></tr>))}{finances.filter(f => f.date.startsWith(selectedMonth)).length === 0 && (<tr><td colSpan={4} className="py-20 text-center text-gray-300 font-bold uppercase tracking-widest">Nenhuma movimentação lançada.</td></tr>)}</tbody></table></div>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* ABA HISTÓRICO DE VENDAS */}
      {activeTab === 'historico' && (
          <div className="bg-white rounded-[40px] shadow-sm border border-gray-100 overflow-hidden flex-1 animate-in fade-in duration-300">
              <div className="p-8 border-b bg-gray-50 flex justify-between items-center"><h3 className="text-xl font-black uppercase italic tracking-tighter text-gray-800">Histórico de Vendas</h3><div className="text-xs font-black text-gray-400 uppercase tracking-widest">Total: {sales.length} registros</div></div>
              <div className="overflow-x-auto"><table className="w-full text-left"><thead className="bg-white border-b border-gray-100"><tr className="text-[10px] font-black text-gray-400 uppercase tracking-widest"><th className="px-8 py-5">Data/Hora</th><th className="px-8 py-5">Produto</th><th className="px-8 py-5">Sabor</th><th className="px-8 py-5 text-center">Qtd</th><th className="px-8 py-5">Pagamento</th><th className="px-8 py-5 text-right">Valor Total</th></tr></thead><tbody className="divide-y divide-gray-50">{sales.map(sale => (<tr key={sale.id} className="hover:bg-gray-50 transition-colors"><td className="px-8 py-4 text-xs font-bold text-gray-500">{sale.createdAt ? new Date(sale.createdAt).toLocaleString('pt-BR') : '-'}</td><td className="px-8 py-4 flex flex-col"><span className="font-black text-gray-900 uppercase italic text-sm">{sale.productName}</span><span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">{sale.category}</span></td><td className="px-8 py-4"><span className="text-xs font-medium text-blue-600">{sale.flavor}</span></td><td className="px-8 py-4 text-center font-black text-gray-900">x{sale.unitsSold}</td><td className="px-8 py-4"><span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase border ${sale.paymentMethod === 'Pix' ? 'bg-green-50 text-green-700 border-green-200' : sale.paymentMethod === 'Cartão' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-orange-50 text-orange-700 border-orange-200'}`}>{sale.paymentMethod}</span></td><td className="px-8 py-4 text-right font-black text-gray-900">{formatCurrency(sale.totalValue)}</td></tr>))}</tbody></table></div>
          </div>
      )}

      {/* ABA PRODUTOS */}
      {activeTab === 'products' && (
        <div className="max-w-6xl mx-auto space-y-6 animate-in slide-in-from-top-2">
            <div className="flex justify-between items-center bg-white p-8 rounded-[40px] shadow-sm border border-gray-100"><div><h3 className="font-black text-gray-900 text-2xl flex items-center gap-3 uppercase italic leading-none"><Package className="text-blue-700" size={28} /> Gerenciamento de <span className="text-red-600">Produtos</span></h3><p className="text-xs text-gray-400 font-bold uppercase tracking-widest mt-2">Controle o cardápio e preços dos itens da sorveteria.</p></div><button onClick={() => { setEditingItem(null); setProductForm({ name: '', category: 'Sundae', flavor: '', price: '', active: true }); setIsProductModalOpen(true); }} className="bg-blue-700 text-white px-10 py-4 rounded-3xl font-black uppercase text-xs shadow-xl shadow-blue-200 hover:bg-blue-800 transition-all active:scale-95 flex items-center justify-center gap-2"><Plus size={20}/> Adicionar Produto</button></div>
            <div className="bg-white rounded-[40px] shadow-sm border border-gray-100 overflow-hidden"><table className="w-full text-left text-sm"><thead><tr className="bg-gray-50 border-b border-gray-100 text-[10px] font-black text-gray-400 uppercase tracking-widest"><th className="px-8 py-5">Status</th><th className="px-8 py-5">Nome do Produto</th><th className="px-8 py-5">Categoria</th><th className="px-8 py-5">Sabor</th><th className="px-8 py-5">Valor Unitário</th><th className="px-8 py-5 text-right">Ações</th></tr></thead><tbody className="divide-y divide-gray-50">{items.map(item => (<tr key={String(item.id)} className={`hover:bg-gray-50 transition-colors group ${!item.active ? 'opacity-50 grayscale' : ''}`}><td className="px-8 py-4"><button onClick={() => handleToggleProductStatus(item)} className={`p-2 rounded-xl transition-all ${item.active ? 'text-green-500 bg-green-50' : 'text-gray-400 bg-gray-100'}`} title={item.active ? 'Inativar' : 'Ativar'}>{item.active ? <CheckCircle size={18}/> : <X size={18}/>}</button></td><td className="px-8 py-4"><span className="font-black text-gray-900 uppercase italic">{item.name}</span></td><td className="px-8 py-4"><span className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-[9px] font-black uppercase border border-gray-200">{item.category}</span></td><td className="px-8 py-4"><span className="text-xs text-gray-500 font-medium">{item.flavor || '-'}</span></td><td className="px-8 py-4"><span className="text-base font-black text-blue-700">{formatCurrency(item.price)}</span></td><td className="px-8 py-4 text-right"><div className="flex justify-end gap-2"><button onClick={() => { setEditingItem(item); setProductForm({ name: item.name, category: item.category, flavor: item.flavor || '', price: item.price.toString().replace('.', ','), active: item.active }); setIsProductModalOpen(true); }} className="p-2 text-blue-600 hover:bg-blue-100 rounded-xl transition-all" title="Editar"><Edit3 size={18}/></button><button onClick={() => { if(window.confirm(`Deseja excluir o produto "${item.name}"?`)) onDeleteItem(String(item.id)) }} className="p-2 text-gray-300 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all" title="Excluir"><Trash2 size={18}/></button></div></td></tr>))}</tbody></table></div>
        </div>
      )}

      {/* MODAL PRODUTOS */}
      {isProductModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[110] p-4">
            <div className="bg-white rounded-[48px] shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in duration-200">
                <div className="p-8 bg-gray-50 border-b flex justify-between items-center"><h3 className="text-2xl font-black text-gray-900 uppercase italic tracking-tighter">{editingItem ? 'Editar' : 'Novo'} <span className="text-blue-700">Produto</span></h3><button onClick={() => setIsProductModalOpen(false)} className="bg-white p-2 rounded-full text-gray-400 hover:text-gray-600 shadow-sm transition-colors"><X size={20} /></button></div>
                <div className="p-10 space-y-6"><div><label className="text-[10px] font-black text-gray-400 uppercase block mb-2 ml-1">Nome do Produto *</label><input value={productForm.name} onChange={e => setProductForm({...productForm, name: e.target.value})} placeholder="Ex: Milkshake" className="w-full p-5 bg-gray-50 border-none rounded-3xl font-bold text-gray-800 focus:ring-4 focus:ring-blue-100 transition-all" /></div><div><label className="text-[10px] font-black text-gray-400 uppercase block mb-2 ml-1">Categoria *</label><div className="relative"><select value={productForm.category} onChange={e => setProductForm({...productForm, category: e.target.value as IceCreamCategory})} className="w-full p-5 bg-gray-50 border-none rounded-3xl font-black text-gray-800 uppercase appearance-none focus:ring-4 focus:ring-blue-100 transition-all">{PRODUCT_CATEGORIES.map(cat => (<option key={cat} value={cat}>{cat}</option>))}</select><ChevronDown className="absolute right-5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" /></div></div><div><label className="text-[10px] font-black text-gray-400 uppercase block mb-2 ml-1">Sabor</label><input value={productForm.flavor} onChange={e => setProductForm({...productForm, flavor: e.target.value})} placeholder="Ex: Morango" className="w-full p-5 bg-gray-50 border-none rounded-3xl font-bold text-gray-800 focus:ring-4 focus:ring-blue-100 transition-all" /></div><div><label className="text-[10px] font-black text-gray-400 uppercase block mb-2 ml-1">Valor *</label><div className="relative"><span className="absolute left-5 top-1/2 -translate-y-1/2 font-black text-blue-700">R$</span><input value={productForm.price} onChange={e => setProductForm({...productForm, price: e.target.value})} placeholder="0,00" className="w-full p-5 pl-12 bg-white border-4 border-gray-100 rounded-3xl font-black text-3xl text-blue-700 shadow-xl focus:border-blue-700 outline-none transition-all" /></div></div>
                <div className="flex items-center gap-3 bg-gray-50 p-4 rounded-2xl"><input type="checkbox" id="active-check" checked={productForm.active} onChange={e => setProductForm({...productForm, active: e.target.checked})} className="w-5 h-5 accent-blue-600"/><label htmlFor="active-check" className="text-xs font-black text-gray-500 uppercase cursor-pointer">Produto Ativo no PDV</label></div></div>
                <div className="p-8 bg-gray-50 flex gap-4 border-t border-gray-100"><button onClick={() => setIsProductModalOpen(false)} className="flex-1 py-5 bg-white border border-gray-200 rounded-3xl font-black text-gray-400 uppercase text-xs hover:bg-gray-100 transition-colors">Cancelar</button><button onClick={handleSaveProduct} disabled={isSubmitting} className="flex-1 py-5 bg-blue-700 text-white rounded-3xl font-black uppercase text-xs shadow-xl shadow-blue-200 flex items-center justify-center gap-2 hover:bg-blue-800 transition-all active:scale-95">{isSubmitting ? <Loader2 className="animate-spin" size={16}/> : null} Finalizar Cadastro</button></div>
            </div>
        </div>
      )}
    </div>
  );
};

export default IceCreamModule;
