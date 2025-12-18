
import React, { useState, useMemo } from 'react';
import { IceCreamItem, IceCreamDailySale, IceCreamTransaction, IceCreamCategory, IceCreamExpenseCategory, IceCreamPaymentMethod } from '../types';
import { formatCurrency } from '../constants';
import { IceCream, Plus, DollarSign, Save, Trash2, X, Calculator, Edit3, Package, ChevronDown, Loader2, ShoppingCart, CheckCircle2, ChevronRight, Hash, CreditCard, Wallet, Banknote, Shield, TrendingDown, Calendar, User, FileText, Lock, Unlock, Users, Receipt, CheckCircle } from 'lucide-react';

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
    const now = new Date();
    const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const isClosed = selectedMonth < currentMonthStr;

    return { 
        totalEntries, totalExits, netProfit, margin, 
        regisLuciene: netProfit > 0 ? netProfit * 0.6333 : 0, 
        ademir: netProfit > 0 ? netProfit * 0.2667 : 0, 
        junior: netProfit > 0 ? netProfit * 0.10 : 0, 
        salesRevenue, manualEntries, isClosed 
    };
  }, [sales, finances, selectedMonth]);

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
              {id:'vendas',label:'Vendas',icon:ShoppingCart},
              {id:'financeiro',label:'Financeiro',icon:Banknote},
              {id:'historico',label:'Histórico',icon:Hash},
              {id:'products',label:'Produtos',icon:Package}
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase transition-all whitespace-nowrap ${activeTab === tab.id ? 'bg-white text-blue-700 shadow-md scale-105' : 'text-gray-500 hover:text-gray-700'}`}><tab.icon size={16}/> {tab.label}</button>
          ))}
        </div>
      </div>

      {activeTab === 'products' && (
        <div className="max-w-6xl mx-auto space-y-6 animate-in slide-in-from-top-2">
            <div className="flex justify-between items-center bg-white p-8 rounded-[40px] shadow-sm border border-gray-100"><div><h3 className="font-black text-gray-900 text-2xl flex items-center gap-3 uppercase italic leading-none"><Package className="text-blue-700" size={28} /> Gerenciamento de <span className="text-red-600">Produtos</span></h3><p className="text-xs text-gray-400 font-bold uppercase tracking-widest mt-2">Clique em editar para alterar preços e sabores.</p></div><button onClick={() => { setEditingItem(null); setProductForm({ name: '', category: 'Sundae', flavor: '', price: '', active: true }); setIsProductModalOpen(true); }} className="bg-blue-700 text-white px-10 py-4 rounded-3xl font-black uppercase text-xs shadow-xl shadow-blue-200 hover:bg-blue-800 transition-all active:scale-95 flex items-center justify-center gap-2"><Plus size={20}/> Adicionar Produto</button></div>
            <div className="bg-white rounded-[40px] shadow-sm border border-gray-100 overflow-hidden"><table className="w-full text-left text-sm"><thead><tr className="bg-gray-50 border-b border-gray-100 text-[10px] font-black text-gray-400 uppercase tracking-widest"><th className="px-8 py-5">Status</th><th className="px-8 py-5">Nome do Produto</th><th className="px-8 py-5">Categoria</th><th className="px-8 py-5">Sabor</th><th className="px-8 py-5">Valor Unitário</th><th className="px-8 py-5 text-right">Ações</th></tr></thead><tbody className="divide-y divide-gray-50">{items.map(item => (<tr key={String(item.id)} className={`hover:bg-gray-50 transition-colors group ${!item.active ? 'opacity-50 grayscale' : ''}`}><td className="px-8 py-4"><button onClick={() => onUpdateItem({...item, active: !item.active})} className={`p-2 rounded-xl transition-all ${item.active ? 'text-green-500 bg-green-50' : 'text-gray-400 bg-gray-100'}`}>{item.active ? <CheckCircle size={18}/> : <X size={18}/>}</button></td><td className="px-8 py-4"><span className="font-black text-gray-900 uppercase italic">{item.name}</span></td><td className="px-8 py-4"><span className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-[9px] font-black uppercase border border-gray-200">{item.category}</span></td><td className="px-8 py-4"><span className="text-xs text-gray-500 font-medium">{item.flavor || '-'}</span></td><td className="px-8 py-4"><span className="text-base font-black text-blue-700">{formatCurrency(item.price)}</span></td><td className="px-8 py-4 text-right"><div className="flex justify-end gap-2"><button onClick={() => handleEditClick(item)} className="p-2 text-blue-600 hover:bg-blue-100 rounded-xl transition-all"><Edit3 size={18}/></button><button onClick={() => { if(window.confirm(`Deseja excluir o produto "${item.name}"?`)) onDeleteItem(String(item.id)) }} className="p-2 text-gray-300 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"><Trash2 size={18}/></button></div></td></tr>))}</tbody></table></div>
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
