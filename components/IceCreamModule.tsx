
import React, { useState, useMemo } from 'react';
import { IceCreamItem, IceCreamDailySale, IceCreamTransaction, IceCreamCategory, IceCreamExpenseCategory } from '../types';
import { formatCurrency } from '../constants';
import { IceCream, Plus, DollarSign, PieChart, Save, Trash2, Calendar, TrendingUp, TrendingDown, X, Calculator, FileSpreadsheet, Edit3, Check, ChevronLeft, ChevronRight, Package, Tag, ChevronDown, Loader2, ArrowUpRight, ArrowDownRight, Briefcase, ShoppingCart } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart as RePie, Pie } from 'recharts';

interface IceCreamModuleProps {
  items: IceCreamItem[];
  sales: IceCreamDailySale[];
  finances: IceCreamTransaction[];
  onAddSales: (sales: IceCreamDailySale[]) => Promise<void>;
  onUpdatePrice: (id: string, price: number) => Promise<void>;
  onUpdateItem: (item: IceCreamItem) => Promise<void>;
  onAddTransaction: (tx: IceCreamTransaction) => Promise<void>;
  onDeleteTransaction: (id: string) => Promise<void>;
  onAddItem: (name: string, category: IceCreamCategory, price: number) => Promise<void>;
  onDeleteItem: (id: string) => Promise<void>;
}

const EXPENSE_CATEGORIES: IceCreamExpenseCategory[] = ['CMV', 'Aluguel', 'Energia', 'Pessoal', 'Manutenção', 'Impostos', 'Outros'];
const PRODUCT_CATEGORIES: IceCreamCategory[] = ['Milkshake', 'Casquinha', 'Cascão', 'Sundae', 'Adicionais', 'Bebidas'];

const IceCreamModule: React.FC<IceCreamModuleProps> = ({ 
    items, sales, finances, onAddSales, onUpdatePrice, onUpdateItem, onAddTransaction, onDeleteTransaction, onAddItem, onDeleteItem 
}) => {
  const [activeTab, setActiveTab] = useState<'dre' | 'sales' | 'finances' | 'products'>('dre');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Modais de Criação
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<IceCreamItem | null>(null);
  const [productForm, setProductForm] = useState({ name: '', category: 'Sundae' as IceCreamCategory, price: '' });
  
  const [unitInputs, setUnitInputs] = useState<Record<string, string>>({});
  const [financeForm, setFinanceForm] = useState({ category: 'CMV' as IceCreamExpenseCategory, value: '', description: '' });

  // --- CÁLCULOS DRE ---
  const dreData = useMemo(() => {
    // 1. Receita Bruta (Vendas registradas na grade + Entradas manuais de venda)
    const salesRevenue = sales.reduce((acc, sale) => {
        const item = items.find(i => String(i.id) === String(sale.itemId));
        return acc + (sale.unitsSold * (item?.price || 0));
    }, 0);
    
    const manualSales = finances
        .filter(f => f.type === 'entry')
        .reduce((acc, f) => acc + f.value, 0);
    
    const totalRevenue = salesRevenue + manualSales;

    // 2. Custos e Despesas
    const expensesByCategory = EXPENSE_CATEGORIES.map(cat => {
        const total = finances
            .filter(f => f.type === 'exit' && f.category === cat)
            .reduce((acc, f) => acc + f.value, 0);
        return { name: cat, value: total };
    });

    const totalExpenses = expensesByCategory.reduce((acc, curr) => acc + curr.value, 0);
    const netProfit = totalRevenue - totalExpenses;
    const margin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

    return { totalRevenue, totalExpenses, netProfit, margin, expensesByCategory };
  }, [sales, items, finances]);

  // --- HANDLERS ---
  const handleSaveSales = async () => {
    setIsSubmitting(true);
    const newSales = Object.entries(unitInputs)
        .filter(([_, qty]) => parseInt(qty) > 0)
        .map(([id, qty]) => ({ id: `s-${Date.now()}-${id}`, date: selectedDate, itemId: id, unitsSold: parseInt(qty) }));

    if (newSales.length === 0) { alert("Insira ao menos uma quantidade."); setIsSubmitting(false); return; }
    await onAddSales(newSales);
    setUnitInputs({});
    setIsModalOpen(false);
    setIsSubmitting(false);
  };

  const handleSaveExpense = async () => {
    const val = parseFloat(financeForm.value.replace(',', '.'));
    if (isNaN(val) || val <= 0) { alert("Valor inválido"); return; }
    setIsSubmitting(true);
    await onAddTransaction({
        id: `tx-${Date.now()}`, date: selectedDate, type: 'exit', category: financeForm.category, value: val, description: financeForm.description, createdAt: new Date()
    });
    setFinanceForm({ category: 'CMV', value: '', description: '' });
    setIsModalOpen(false);
    setIsSubmitting(false);
  };

  const handleSaveProduct = async () => {
    const priceVal = parseFloat(productForm.price.replace(',', '.'));
    if (!productForm.name || isNaN(priceVal)) { alert("Dados incompletos"); return; }
    setIsSubmitting(true);
    if (editingItem) {
        await onUpdateItem({ ...editingItem, name: productForm.name, category: productForm.category, price: priceVal });
    } else {
        await onAddItem(productForm.name, productForm.category, priceVal);
    }
    setProductForm({ name: '', category: 'Sundae', price: '' });
    setEditingItem(null);
    setIsProductModalOpen(false);
    setIsSubmitting(false);
  };

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-[1600px] mx-auto animate-in fade-in duration-500">
      {/* HEADER DINÂMICO */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
        <div className="flex items-center gap-4">
          <div className="p-4 bg-gradient-to-br from-blue-600 to-blue-800 rounded-2xl text-white shadow-xl shadow-blue-200">
            <IceCream size={32} />
          </div>
          <div>
            <h2 className="text-3xl font-black text-gray-900 tracking-tighter uppercase italic leading-none">Gestão <span className="text-red-600">Sorvete</span></h2>
            <p className="text-gray-500 text-sm font-bold mt-1 uppercase tracking-widest">Dashboard & DRE Operacional</p>
          </div>
        </div>
        
        <div className="flex bg-gray-100 p-1 rounded-2xl">
          {[
            { id: 'dre', label: 'DRE / Resumo', icon: PieChart },
            { id: 'sales', label: 'Vendas', icon: ShoppingCart },
            { id: 'finances', label: 'Financeiro', icon: DollarSign },
            { id: 'products', label: 'Produtos', icon: Package }
          ].map(tab => (
            <button 
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase transition-all ${activeTab === tab.id ? 'bg-white text-blue-700 shadow-md scale-105' : 'text-gray-500 hover:text-gray-700'}`}
            >
                <tab.icon size={16}/> {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* VIEW: DRE / RESUMO */}
      {activeTab === 'dre' && (
        <div className="space-y-6 animate-in slide-in-from-bottom-2 duration-400">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-white p-6 rounded-3xl border-l-8 border-green-500 shadow-sm">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Faturamento Bruto</p>
                <p className="text-3xl font-black text-gray-900">{formatCurrency(dreData.totalRevenue)}</p>
                <div className="mt-2 flex items-center text-green-600 text-xs font-bold gap-1"><ArrowUpRight size={14}/> Total acumulado</div>
            </div>
            <div className="bg-white p-6 rounded-3xl border-l-8 border-red-500 shadow-sm">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Despesas Totais</p>
                <p className="text-3xl font-black text-gray-900">{formatCurrency(dreData.totalExpenses)}</p>
                <div className="mt-2 flex items-center text-red-600 text-xs font-bold gap-1"><ArrowDownRight size={14}/> Saídas registradas</div>
            </div>
            <div className={`p-6 rounded-3xl border-l-8 shadow-sm ${dreData.netProfit >= 0 ? 'bg-blue-900 border-blue-400 text-white' : 'bg-red-900 border-red-400 text-white'}`}>
                <p className="text-[10px] font-black opacity-60 uppercase tracking-widest mb-1">Resultado Líquido</p>
                <p className="text-3xl font-black">{formatCurrency(dreData.netProfit)}</p>
                <div className="mt-2 text-xs font-bold uppercase opacity-80">Margem: {dreData.margin.toFixed(1)}%</div>
            </div>
            <div className="bg-white p-6 rounded-3xl border-l-8 border-purple-500 shadow-sm">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Ticket Médio Est.</p>
                <p className="text-3xl font-black text-gray-900">{formatCurrency(sales.length > 0 ? dreData.totalRevenue / sales.length : 0)}</p>
                <p className="text-[10px] font-bold text-purple-600 mt-2 uppercase">Base: {sales.length} vendas</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white p-8 rounded-[40px] shadow-sm border border-gray-100">
                <h3 className="text-xl font-black text-gray-800 mb-6 flex items-center gap-3 uppercase italic"><PieChart className="text-blue-600"/> Composição de Custos</h3>
                <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={dreData.expensesByCategory}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis dataKey="name" fontSize={10} fontWeight="bold" axisLine={false} tickLine={false} />
                            <YAxis fontSize={10} axisLine={false} tickLine={false} />
                            <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)'}} />
                            <Bar dataKey="value" radius={[10, 10, 0, 0]} barSize={40}>
                                {dreData.expensesByCategory.map((_, index) => (
                                    <Cell key={`cell-${index}`} fill={['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4', '#475569'][index % 7]} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            <div className="bg-white p-8 rounded-[40px] shadow-sm border border-gray-100 flex flex-col">
                <h3 className="text-xl font-black text-gray-800 mb-6 flex items-center gap-3 uppercase italic"><Calculator className="text-blue-600"/> DRE Simplificada</h3>
                <div className="space-y-4 flex-1">
                    <div className="flex justify-between p-4 bg-gray-50 rounded-2xl"><span className="font-bold text-gray-500 uppercase text-xs">Receita Bruta</span><span className="font-black text-green-600">{formatCurrency(dreData.totalRevenue)}</span></div>
                    {dreData.expensesByCategory.filter(e => e.value > 0).map(exp => (
                        <div key={exp.name} className="flex justify-between px-4"><span className="text-gray-400 font-bold uppercase text-[10px]">{exp.name}</span><span className="font-bold text-red-500">-{formatCurrency(exp.value)}</span></div>
                    ))}
                    <div className="pt-4 border-t border-dashed border-gray-200 mt-auto">
                        <div className="flex justify-between p-4 bg-blue-50 rounded-2xl"><span className="font-black text-blue-900 uppercase text-sm">Lucro Operacional</span><span className="font-black text-blue-700 text-xl">{formatCurrency(dreData.netProfit)}</span></div>
                    </div>
                </div>
            </div>
          </div>
        </div>
      )}

      {/* VIEW: LANÇAMENTO DE VENDAS */}
      {activeTab === 'sales' && (
        <div className="space-y-4 animate-in fade-in duration-300">
            <div className="flex justify-between items-center bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 bg-gray-50 p-1 rounded-xl border border-gray-200">
                        <button onClick={() => {
                            const d = new Date(selectedDate + 'T12:00:00');
                            d.setDate(d.getDate() - 1);
                            setSelectedDate(d.toISOString().split('T')[0]);
                        }} className="p-2 hover:bg-white rounded-lg transition-all text-gray-400"><ChevronLeft size={20}/></button>
                        <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="bg-transparent border-none outline-none font-black text-gray-700 text-sm" />
                        <button onClick={() => {
                            const d = new Date(selectedDate + 'T12:00:00');
                            d.setDate(d.getDate() + 1);
                            setSelectedDate(d.toISOString().split('T')[0]);
                        }} className="p-2 hover:bg-white rounded-lg transition-all text-gray-400"><ChevronRight size={20}/></button>
                    </div>
                </div>
                <button onClick={() => { setActiveTab('sales'); setIsModalOpen(true); }} className="bg-blue-600 text-white px-6 py-3 rounded-2xl font-black uppercase text-xs shadow-lg hover:scale-105 active:scale-95 transition-all flex items-center gap-2"><Plus size={18}/> Novo Lançamento</button>
            </div>
            
            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-gray-50 text-[10px] font-black uppercase text-gray-400 border-b border-gray-100">
                        <tr>
                            <th className="p-5">Data</th>
                            <th className="p-5">Produto</th>
                            <th className="p-5 text-center">Unidades</th>
                            <th className="p-5 text-right">Subtotal</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {sales.slice().reverse().map(sale => {
                            const item = items.find(i => String(i.id) === String(sale.itemId));
                            return (
                                <tr key={sale.id} className="hover:bg-gray-50/50 transition-colors">
                                    <td className="p-5 text-xs font-bold text-gray-500">{new Date(sale.date + 'T12:00:00').toLocaleDateString('pt-BR')}</td>
                                    <td className="p-5 font-black text-gray-800 uppercase tracking-tight text-sm">{String(item?.name || 'Item Excluído')}</td>
                                    <td className="p-5 text-center font-black text-blue-600 text-base">{sale.unitsSold}</td>
                                    <td className="p-5 text-right font-black text-gray-900">{formatCurrency(sale.unitsSold * (item?.price || 0))}</td>
                                </tr>
                            );
                        })}
                        {sales.length === 0 && (
                            <tr><td colSpan={4} className="p-20 text-center text-gray-400 font-bold uppercase text-xs italic tracking-widest">Nenhuma venda registrada</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
      )}

      {/* VIEW: FINANCEIRO (SAÍDAS) */}
      {activeTab === 'finances' && (
        <div className="space-y-4 animate-in fade-in duration-300">
            <div className="flex justify-between items-center bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
                <h3 className="font-black text-gray-800 uppercase text-xs italic ml-4">Movimentações de Saída (DRE)</h3>
                <button onClick={() => { setActiveTab('finances'); setIsModalOpen(true); }} className="bg-red-600 text-white px-6 py-3 rounded-2xl font-black uppercase text-xs shadow-lg hover:scale-105 active:scale-95 transition-all flex items-center gap-2"><Plus size={18}/> Lançar Despesa</button>
            </div>
            
            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-gray-50 text-[10px] font-black uppercase text-gray-400 border-b border-gray-100">
                        <tr>
                            <th className="p-5">Data</th>
                            <th className="p-5">Categoria</th>
                            <th className="p-5">Descrição</th>
                            <th className="p-5 text-right">Valor</th>
                            <th className="p-5 w-20 text-center">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {finances.filter(f => f.type === 'exit').slice().reverse().map(tx => (
                            <tr key={tx.id} className="hover:bg-gray-50/50 transition-colors group">
                                <td className="p-5 text-xs font-bold text-gray-500">{new Date(tx.date + 'T12:00:00').toLocaleDateString('pt-BR')}</td>
                                <td className="p-5"><span className="px-3 py-1 bg-red-50 text-red-700 rounded-full text-[10px] font-black uppercase border border-red-100">{String(tx.category)}</span></td>
                                <td className="p-5 text-sm text-gray-600 font-medium">{tx.description || '-'}</td>
                                <td className="p-5 text-right font-black text-red-600">{formatCurrency(tx.value)}</td>
                                <td className="p-5 text-center">
                                    <button onClick={() => onDeleteTransaction(tx.id)} className="p-2 text-gray-300 hover:text-red-600 transition-colors"><Trash2 size={16}/></button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
      )}

      {/* VIEW: PRODUTOS */}
      {activeTab === 'products' && (
        <div className="max-w-5xl mx-auto space-y-6 animate-in slide-in-from-top-2 duration-300">
            <div className="flex justify-between items-center bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
                <div>
                    <h3 className="font-black text-gray-800 text-xl flex items-center gap-3 uppercase italic"><Package className="text-blue-600" /> Catálogo de Produtos</h3>
                    <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mt-1">Gerencie itens e preços para faturamento</p>
                </div>
                <button onClick={() => { setEditingItem(null); setProductForm({ name: '', category: 'Sundae', price: '' }); setIsProductModalOpen(true); }} className="bg-gray-900 text-white px-8 py-4 rounded-2xl font-black uppercase text-xs shadow-xl hover:bg-black transition-all active:scale-95 flex items-center gap-2"><Plus size={20}/> Adicionar Item</button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {items.length > 0 ? items.map(item => (
                    <div key={item.id} className="bg-white p-6 rounded-[32px] shadow-sm border border-gray-100 hover:shadow-xl hover:-translate-y-1 transition-all group relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-gray-50 rounded-bl-[100px] -mr-10 -mt-10 group-hover:bg-blue-50 transition-colors"></div>
                        
                        <span className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-[9px] font-black uppercase border border-blue-100 mb-4 inline-block">{String(item.category)}</span>
                        <h4 className="text-xl font-black text-gray-800 uppercase tracking-tighter mb-2">{String(item.name)}</h4>
                        <div className="flex items-baseline gap-1 mb-6">
                            <span className="text-xs font-bold text-gray-400">R$</span>
                            <span className="text-3xl font-black text-gray-900">{item.price.toFixed(2).replace('.', ',')}</span>
                        </div>
                        
                        <div className="flex gap-2">
                            <button onClick={() => {
                                setEditingItem(item);
                                setProductForm({ name: item.name, category: item.category, price: item.price.toString().replace('.', ',') });
                                setIsProductModalOpen(true);
                            }} className="flex-1 py-3 bg-gray-100 hover:bg-blue-600 hover:text-white rounded-xl text-[10px] font-black uppercase transition-all flex items-center justify-center gap-2 text-gray-600"><Edit3 size={14}/> Editar</button>
                            <button onClick={() => onDeleteItem(item.id)} className="w-12 h-12 flex items-center justify-center bg-gray-50 hover:bg-red-50 text-gray-300 hover:text-red-600 rounded-xl transition-all"><Trash2 size={18}/></button>
                        </div>
                    </div>
                )) : (
                    <div className="col-span-full py-32 text-center bg-white rounded-[40px] border-2 border-dashed border-gray-100">
                        <Package size={64} className="mx-auto text-gray-100 mb-4" />
                        <p className="font-black text-gray-300 uppercase tracking-widest">Nenhum produto cadastrado</p>
                    </div>
                )}
            </div>
        </div>
      )}

      {/* MODAL SHARED (LANÇAMENTOS) */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[100] p-4">
            <div className={`bg-white rounded-[48px] shadow-2xl w-full overflow-hidden animate-in zoom-in duration-300 ${activeTab === 'sales' ? 'max-w-2xl' : 'max-w-md'}`}>
                <div className="p-8 bg-gray-50/50 border-b border-gray-100 flex justify-between items-center">
                    <h3 className="text-2xl font-black text-gray-800 flex items-center gap-3 uppercase tracking-tighter italic">
                        {activeTab === 'sales' ? <Plus className="text-blue-600"/> : <DollarSign className="text-red-600"/>}
                        {activeTab === 'sales' ? 'Lançar Vendas' : 'Lançar Despesa'}
                    </h3>
                    <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 bg-white rounded-full p-2 border border-gray-100 shadow-sm"><X size={24} /></button>
                </div>
                
                <div className="p-10 space-y-8 max-h-[60vh] overflow-y-auto no-scrollbar">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2"><Calendar size={14}/> Data</label>
                        <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="w-full p-5 bg-gray-100 border-none rounded-2xl font-black text-gray-800 text-xl text-center focus:ring-4 focus:ring-blue-100 transition-all outline-none" />
                    </div>

                    {activeTab === 'sales' ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {items.map(item => (
                                <div key={item.id} className="bg-gray-50 p-4 rounded-3xl border border-gray-100 hover:border-blue-200 transition-all group">
                                    <label className="text-[10px] font-black text-gray-400 uppercase block mb-1 truncate">{String(item.name)}</label>
                                    <div className="relative">
                                        <ShoppingCart className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300 group-focus-within:text-blue-500 transition-colors" size={20}/>
                                        <input 
                                            type="number" 
                                            placeholder="0" 
                                            value={unitInputs[item.id] || ''} 
                                            onChange={e => setUnitInputs({...unitInputs, [item.id]: e.target.value})} 
                                            className="w-full pl-12 pr-4 py-4 bg-white border border-gray-200 rounded-2xl outline-none font-black text-2xl text-gray-800 focus:ring-4 focus:ring-blue-100 transition-all text-center"
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Categoria da Despesa</label>
                                <div className="relative">
                                    <select value={financeForm.category} onChange={e => setFinanceForm({...financeForm, category: e.target.value as any})} className="w-full p-5 bg-gray-100 border-none rounded-2xl outline-none focus:ring-4 focus:ring-red-100 font-black text-gray-800 appearance-none uppercase text-sm">
                                        {EXPENSE_CATEGORIES.map(cat => (<option key={cat} value={cat}>{cat}</option>))}
                                    </select>
                                    <ChevronDown className="absolute right-5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Valor da Saída</label>
                                <div className="relative">
                                    <span className="absolute left-6 top-1/2 -translate-y-1/2 font-black text-red-500 text-xl">R$</span>
                                    <input value={financeForm.value} onChange={e => setFinanceForm({...financeForm, value: e.target.value})} placeholder="0,00" className="w-full pl-16 pr-6 py-6 bg-gray-900 border-none rounded-3xl outline-none focus:ring-8 focus:ring-red-500/10 font-black text-4xl text-white placeholder-gray-800 shadow-2xl" />
                                </div>
                            </div>
                            <input value={financeForm.description} onChange={e => setFinanceForm({...financeForm, description: e.target.value})} placeholder="Observações..." className="w-full p-5 bg-gray-100 border-none rounded-2xl outline-none focus:ring-4 focus:ring-red-100 font-bold text-sm text-gray-800" />
                        </div>
                    )}
                </div>
                
                <div className="p-8 bg-gray-50/50 flex gap-4 border-t border-gray-100">
                    <button onClick={() => setIsModalOpen(false)} className="flex-1 py-5 bg-white border border-gray-200 rounded-2xl font-black text-gray-400 uppercase text-xs tracking-widest hover:bg-gray-100 transition-all">Cancelar</button>
                    <button onClick={activeTab === 'sales' ? handleSaveSales : handleSaveExpense} disabled={isSubmitting} className={`flex-1 py-5 rounded-2xl font-black text-white shadow-xl transition-all active:scale-95 text-xs uppercase tracking-widest ${activeTab === 'sales' ? 'bg-blue-600' : 'bg-red-600'}`}>
                        {isSubmitting ? <Loader2 className="animate-spin mx-auto" size={20}/> : 'Confirmar Lançamento'}
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* MODAL PRODUTO */}
      {isProductModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[110] p-4">
            <div className="bg-white rounded-[48px] shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in duration-300">
                <div className="p-8 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
                    <h3 className="text-2xl font-black text-gray-800 uppercase flex items-center gap-3 italic">
                        {editingItem ? <Edit3 className="text-blue-600"/> : <Plus className="text-blue-600"/>}
                        {editingItem ? 'Editar Produto' : 'Novo Produto'}
                    </h3>
                    <button onClick={() => setIsProductModalOpen(false)} className="text-gray-400 hover:text-gray-600"><X size={24} /></button>
                </div>
                <div className="p-10 space-y-6">
                    <div className="space-y-1">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Nome do Produto</label>
                        <input value={productForm.name} onChange={e => setProductForm({...productForm, name: e.target.value})} placeholder="Ex: Milkshake Morango" className="w-full p-5 bg-gray-50 border-none rounded-2xl focus:ring-4 focus:ring-blue-100 outline-none font-bold text-gray-800 shadow-inner" />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Categoria</label>
                        <div className="relative">
                            <select value={productForm.category} onChange={e => setProductForm({...productForm, category: e.target.value as IceCreamCategory})} className="w-full p-5 bg-gray-50 border-none rounded-2xl outline-none focus:ring-4 focus:ring-blue-100 font-black text-gray-800 appearance-none uppercase shadow-inner">
                                {PRODUCT_CATEGORIES.map(cat => (<option key={cat} value={cat}>{cat}</option>))}
                            </select>
                            <ChevronDown className="absolute right-5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                        </div>
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Preço de Venda</label>
                        <div className="relative">
                            <Tag className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400" size={24} />
                            <input value={productForm.price} onChange={e => setProductForm({...productForm, price: e.target.value})} placeholder="0,00" className="w-full pl-14 p-6 bg-white border-4 border-gray-100 rounded-3xl focus:border-blue-500 outline-none font-black text-3xl text-blue-700 shadow-xl" />
                        </div>
                    </div>
                </div>
                <div className="p-8 bg-gray-50 flex gap-4 border-t border-gray-100">
                    <button onClick={() => setIsProductModalOpen(false)} className="flex-1 py-5 bg-white border border-gray-200 rounded-2xl font-black text-gray-400 uppercase text-xs shadow-sm">Cancelar</button>
                    <button onClick={handleSaveProduct} disabled={isSubmitting} className="flex-1 py-5 bg-gray-900 text-white rounded-2xl font-black uppercase text-xs shadow-2xl hover:bg-black transition-all active:scale-95 flex items-center justify-center gap-2">
                        {isSubmitting && <Loader2 className="animate-spin" size={18}/>}
                        {editingItem ? 'Atualizar' : 'Salvar Produto'}
                    </button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default IceCreamModule;
