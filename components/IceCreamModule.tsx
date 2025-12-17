
import React, { useState, useMemo } from 'react';
import { IceCreamItem, IceCreamDailySale, IceCreamTransaction, IceCreamCategory, IceCreamExpenseCategory } from '../types';
import { formatCurrency } from '../constants';
import { IceCream, Plus, DollarSign, PieChart, Save, Trash2, Calendar, TrendingUp, TrendingDown, X, Calculator, Edit3, Package, Tag, ChevronDown, Loader2, ArrowUpRight, ArrowDownRight, ShoppingCart } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

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
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Modais
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<IceCreamItem | null>(null);
  const [productForm, setProductForm] = useState({ name: '', category: 'Sundae' as IceCreamCategory, price: '' });
  
  const [unitInputs, setUnitInputs] = useState<Record<string, string>>({});
  const [financeForm, setFinanceForm] = useState({ type: 'exit' as 'entry' | 'exit', category: 'CMV' as IceCreamExpenseCategory, value: '', description: '' });

  const dreData = useMemo(() => {
    const salesRevenue = sales.reduce((acc, sale) => {
        const item = items.find(i => String(i.id) === String(sale.itemId));
        return acc + (sale.unitsSold * (item?.price || 0));
    }, 0);
    const manualSales = finances.filter(f => f.type === 'entry').reduce((acc, f) => acc + f.value, 0);
    const totalRevenue = salesRevenue + manualSales;
    const expensesByCategory = EXPENSE_CATEGORIES.map(cat => ({
        name: cat,
        value: finances.filter(f => f.type === 'exit' && f.category === cat).reduce((acc, f) => acc + f.value, 0)
    }));
    const totalExpenses = expensesByCategory.reduce((acc, curr) => acc + curr.value, 0);
    const netProfit = totalRevenue - totalExpenses;
    const margin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;
    return { totalRevenue, totalExpenses, netProfit, margin, expensesByCategory };
  }, [sales, items, finances]);

  const handleSaveSales = async () => {
    const newSales = Object.entries(unitInputs)
        .filter(([_, qty]) => parseInt(qty) > 0)
        .map(([id, qty]) => ({ id: `temp-${Date.now()}-${id}`, date: selectedDate, itemId: id, unitsSold: parseInt(qty) }));
    if (newSales.length === 0) return alert("Insira quantidades.");
    setIsSubmitting(true);
    await onAddSales(newSales);
    setUnitInputs({});
    setIsSubmitting(false);
    alert("Vendas salvas!");
  };

  const handleSaveFinance = async () => {
    const val = parseFloat(financeForm.value.replace(',', '.'));
    if (isNaN(val) || val <= 0) return alert("Valor inválido");
    setIsSubmitting(true);
    await onAddTransaction({
        id: `tx-${Date.now()}`, date: selectedDate, type: financeForm.type, category: financeForm.category, value: val, description: financeForm.description, createdAt: new Date()
    });
    setFinanceForm({ type: 'exit', category: 'CMV', value: '', description: '' });
    setIsSubmitting(false);
    alert("Lançamento financeiro realizado!");
  };

  const handleSaveProduct = async () => {
    const priceVal = parseFloat(productForm.price.replace(',', '.'));
    if (!productForm.name || isNaN(priceVal)) return alert("Dados incompletos");
    setIsSubmitting(true);
    if (editingItem) {
        await onUpdateItem({ ...editingItem, name: String(productForm.name), category: productForm.category, price: priceVal });
    } else {
        await onAddItem(String(productForm.name), productForm.category, priceVal);
    }
    setProductForm({ name: '', category: 'Sundae', price: '' });
    setEditingItem(null);
    setIsProductModalOpen(false);
    setIsSubmitting(false);
  };

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-[1600px] mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
        <div className="flex items-center gap-4">
          <div className="p-4 bg-blue-800 rounded-2xl text-white shadow-lg"><IceCream size={32} /></div>
          <div><h2 className="text-3xl font-black text-gray-900 uppercase italic">Gestão <span className="text-red-600">Sorvete</span></h2><p className="text-gray-500 text-sm font-bold uppercase tracking-widest">Painel Operacional Integrado</p></div>
        </div>
        <div className="flex bg-gray-100 p-1 rounded-2xl">
          {[{id:'dre',label:'DRE',icon:PieChart},{id:'sales',label:'Vendas',icon:ShoppingCart},{id:'finances',label:'Financeiro',icon:DollarSign},{id:'products',label:'Produtos',icon:Package}].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase transition-all ${activeTab === tab.id ? 'bg-white text-blue-700 shadow-md' : 'text-gray-500 hover:text-gray-700'}`}><tab.icon size={16}/> {tab.label}</button>
          ))}
        </div>
      </div>

      {activeTab === 'dre' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-white p-6 rounded-3xl border-l-8 border-green-500 shadow-sm"><p className="text-[10px] font-black text-gray-400 uppercase mb-1">Receita Total</p><p className="text-3xl font-black text-gray-900">{formatCurrency(dreData.totalRevenue)}</p></div>
            <div className="bg-white p-6 rounded-3xl border-l-8 border-red-500 shadow-sm"><p className="text-[10px] font-black text-gray-400 uppercase mb-1">Despesas</p><p className="text-3xl font-black text-gray-900">{formatCurrency(dreData.totalExpenses)}</p></div>
            <div className={`p-6 rounded-3xl border-l-8 shadow-sm ${dreData.netProfit >= 0 ? 'bg-blue-900 border-blue-400 text-white' : 'bg-red-900 border-red-400 text-white'}`}><p className="text-[10px] font-black opacity-60 uppercase mb-1">Lucro Líquido</p><p className="text-3xl font-black">{formatCurrency(dreData.netProfit)}</p></div>
            <div className="bg-white p-6 rounded-3xl border-l-8 border-purple-500 shadow-sm"><p className="text-[10px] font-black text-gray-400 uppercase mb-1">Margem</p><p className="text-3xl font-black text-gray-900">{dreData.margin.toFixed(1)}%</p></div>
          </div>
          <div className="bg-white p-8 rounded-[40px] shadow-sm border border-gray-100"><h3 className="text-xl font-black text-gray-800 mb-6 flex items-center gap-3 uppercase italic"><PieChart className="text-blue-600"/> Composição de Despesas</h3><div className="h-[300px]"><ResponsiveContainer width="100%" height="100%"><BarChart data={dreData.expensesByCategory}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" /><XAxis dataKey="name" fontSize={10} fontWeight="bold" axisLine={false} /><YAxis fontSize={10} axisLine={false} /><Tooltip /><Bar dataKey="value" radius={[10, 10, 0, 0]} barSize={40}>{dreData.expensesByCategory.map((_, index) => (<Cell key={`cell-${index}`} fill={['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6'][index % 5]} />))}</Bar></BarChart></ResponsiveContainer></div></div>
        </div>
      )}

      {activeTab === 'sales' && (
        <div className="bg-white p-8 rounded-[40px] shadow-sm border border-gray-100 max-w-4xl mx-auto"><div className="flex justify-between items-center mb-8"><div><h3 className="text-2xl font-black text-gray-800 uppercase italic">Lançamento de Vendas</h3><p className="text-sm text-gray-400 font-bold uppercase">Preencha as unidades vendidas no dia selecionado.</p></div><input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="p-3 bg-gray-100 rounded-2xl font-bold border-none outline-none focus:ring-2 focus:ring-blue-500" /></div><div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">{items.map(item => (<div key={item.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl hover:bg-gray-100 transition-colors"><span className="font-bold text-gray-700 truncate w-1/2">{item.name}</span><div className="flex items-center gap-3"><span className="text-xs font-black text-blue-600">{formatCurrency(item.price)}</span><input type="number" value={unitInputs[item.id] || ''} onChange={e => setUnitInputs({...unitInputs, [item.id]: e.target.value})} className="w-20 p-2 text-center rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500" placeholder="0" /></div></div>))}</div><button onClick={handleSaveSales} disabled={isSubmitting} className="w-full py-5 bg-blue-700 text-white rounded-3xl font-black uppercase shadow-xl hover:bg-blue-800 transition-all active:scale-95 flex items-center justify-center gap-2">{isSubmitting ? <Loader2 className="animate-spin"/> : <Save/>} Salvar Lançamento Diário</button></div>
      )}

      {activeTab === 'finances' && (
        <div className="bg-white p-8 rounded-[40px] shadow-sm border border-gray-100 max-w-4xl mx-auto"><h3 className="text-2xl font-black text-gray-800 uppercase italic mb-8">Financeiro Manual</h3><div className="space-y-6"><div className="grid grid-cols-2 gap-4"><div><label className="text-[10px] font-black text-gray-400 uppercase block mb-1">Tipo</label><select value={financeForm.type} onChange={e => setFinanceForm({...financeForm, type: e.target.value as any})} className="w-full p-4 bg-gray-100 rounded-2xl font-bold border-none outline-none"><option value="exit">Saída (Despesa)</option><option value="entry">Entrada (Manual)</option></select></div><div><label className="text-[10px] font-black text-gray-400 uppercase block mb-1">Categoria</label><select value={financeForm.category} onChange={e => setFinanceForm({...financeForm, category: e.target.value as any})} className="w-full p-4 bg-gray-100 rounded-2xl font-bold border-none outline-none">{EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}</select></div></div><div><label className="text-[10px] font-black text-gray-400 uppercase block mb-1">Valor (R$)</label><input value={financeForm.value} onChange={e => setFinanceForm({...financeForm, value: e.target.value})} placeholder="0,00" className="w-full p-4 bg-gray-100 rounded-2xl font-bold border-none outline-none text-2xl" /></div><div><label className="text-[10px] font-black text-gray-400 uppercase block mb-1">Descrição</label><input value={financeForm.description} onChange={e => setFinanceForm({...financeForm, description: e.target.value})} placeholder="Ex: Pagamento fornecedor leite" className="w-full p-4 bg-gray-100 rounded-2xl font-bold border-none outline-none" /></div><button onClick={handleSaveFinance} disabled={isSubmitting} className="w-full py-5 bg-red-600 text-white rounded-3xl font-black uppercase shadow-xl hover:bg-red-700 transition-all active:scale-95 flex items-center justify-center gap-2">{isSubmitting ? <Loader2 className="animate-spin"/> : <Plus/>} Registrar Movimentação</button></div><div className="mt-12 border-t pt-8"><h4 className="font-black text-gray-400 uppercase text-xs mb-4">Últimos Lançamentos</h4><div className="space-y-3">{finances.slice(-5).reverse().map(f => (<div key={f.id} className="flex justify-between items-center p-4 bg-gray-50 rounded-2xl"><div className="flex items-center gap-3"><div className={`p-2 rounded-lg ${f.type === 'entry' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{f.type === 'entry' ? <TrendingUp size={16}/> : <TrendingDown size={16}/>}</div><div><p className="font-bold text-gray-800">{f.category}</p><p className="text-[10px] text-gray-400 font-bold uppercase">{f.description || 'Sem descrição'}</p></div></div><div className="text-right"><p className={`font-black ${f.type === 'entry' ? 'text-green-600' : 'text-red-600'}`}>{f.type === 'entry' ? '+' : '-'}{formatCurrency(f.value)}</p><button onClick={() => onDeleteTransaction(f.id)} className="text-[10px] text-gray-300 hover:text-red-500 font-black uppercase">Excluir</button></div></div>))}</div></div></div>
      )}

      {activeTab === 'products' && (
        <div className="max-w-5xl mx-auto space-y-6">
            <div className="flex justify-between items-center bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
                <div><h3 className="font-black text-gray-800 text-xl flex items-center gap-3 uppercase italic"><Package className="text-gray-900" /> Produtos Disponíveis</h3><p className="text-xs text-gray-400 font-bold uppercase mt-1">Gerenciamento de cardápio e precificação.</p></div>
                <button onClick={() => { setEditingItem(null); setProductForm({ name: '', category: 'Sundae', price: '' }); setIsProductModalOpen(true); }} className="bg-gray-950 text-white px-8 py-4 rounded-2xl font-black uppercase text-xs shadow-xl hover:bg-black transition-all flex items-center gap-2"><Plus size={20}/> Novo Item</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {items.length > 0 ? items.map(item => (
                    <div key={String(item.id)} className="bg-white p-6 rounded-[32px] shadow-sm border border-gray-100 hover:shadow-xl transition-all group overflow-hidden relative">
                        <span className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-[9px] font-black uppercase mb-4 inline-block">{item.category}</span>
                        <h4 className="text-xl font-black text-gray-900 uppercase tracking-tighter mb-2 truncate">{item.name}</h4>
                        <div className="flex items-baseline gap-1 mb-6"><span className="text-xs font-bold text-gray-400">R$</span><span className="text-3xl font-black text-blue-900">{item.price.toFixed(2).replace('.', ',')}</span></div>
                        <div className="flex gap-2 relative z-10"><button onClick={() => { setEditingItem(item); setProductForm({ name: item.name, category: item.category, price: item.price.toString().replace('.', ',') }); setIsProductModalOpen(true); }} className="flex-1 py-3 bg-gray-100 hover:bg-blue-600 hover:text-white rounded-xl text-[10px] font-black uppercase transition-all flex items-center justify-center gap-2"><Edit3 size={14}/> Alterar</button><button onClick={() => onDeleteItem(String(item.id))} className="w-12 h-12 flex items-center justify-center bg-gray-50 hover:bg-red-50 text-gray-300 hover:text-red-600 rounded-xl transition-all"><Trash2 size={18}/></button></div>
                    </div>
                )) : (<div className="col-span-full py-20 text-center bg-white rounded-3xl border border-dashed border-gray-200 font-bold text-gray-400 uppercase">Nenhum produto cadastrado no banco de dados.</div>)}
            </div>
        </div>
      )}

      {isProductModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[110] p-4">
            <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in duration-200">
                <div className="p-8 bg-gray-50 border-b flex justify-between items-center"><h3 className="text-2xl font-black text-gray-800 uppercase italic">{editingItem ? 'Editar Produto' : 'Cadastrar Produto'}</h3><button onClick={() => setIsProductModalOpen(false)} className="text-gray-400 hover:text-gray-600"><X size={24} /></button></div>
                <div className="p-10 space-y-6">
                    <div><label className="text-[10px] font-black text-gray-400 uppercase block mb-1">Nome do Produto</label><input value={productForm.name} onChange={e => setProductForm({...productForm, name: e.target.value})} placeholder="Ex: Casquinha Mista" className="w-full p-4 bg-gray-50 rounded-2xl border-none font-bold text-gray-800" /></div>
                    <div><label className="text-[10px] font-black text-gray-400 uppercase block mb-1">Categoria</label><select value={productForm.category} onChange={e => setProductForm({...productForm, category: e.target.value as IceCreamCategory})} className="w-full p-4 bg-gray-50 rounded-2xl border-none font-black text-gray-800 uppercase">{PRODUCT_CATEGORIES.map(cat => (<option key={cat} value={cat}>{cat}</option>))}</select></div>
                    <div><label className="text-[10px] font-black text-gray-400 uppercase block mb-1">Preço de Venda</label><input value={productForm.price} onChange={e => setProductForm({...productForm, price: e.target.value})} placeholder="0,00" className="w-full p-4 bg-white border-2 border-gray-100 rounded-2xl font-black text-3xl text-blue-700" /></div>
                </div>
                <div className="p-8 bg-gray-50 flex gap-4"><button onClick={() => setIsProductModalOpen(false)} className="flex-1 py-4 bg-white border border-gray-200 rounded-2xl font-black text-gray-400 uppercase text-xs">Cancelar</button><button onClick={handleSaveProduct} disabled={isSubmitting} className="flex-1 py-4 bg-gray-900 text-white rounded-2xl font-black uppercase text-xs shadow-xl flex items-center justify-center gap-2">{isSubmitting && <Loader2 className="animate-spin" size={16}/>} {editingItem ? 'Atualizar' : 'Salvar'}</button></div>
            </div>
        </div>
      )}
    </div>
  );
};

export default IceCreamModule;
