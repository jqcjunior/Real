
import React, { useState, useMemo } from 'react';
import { IceCreamItem, IceCreamDailySale, IceCreamTransaction, IceCreamCategory, IceCreamExpenseCategory, IceCreamPaymentMethod, User, UserRole } from '../types';
import { formatCurrency } from '../constants';
import { 
    IceCream, Plus, DollarSign, Save, Trash2, X, Calculator, Edit3, Package, 
    Loader2, ShoppingCart, CheckCircle2, Hash, CreditCard, 
    Banknote, Users, Search, Filter, Calendar, TrendingUp, ChevronRight, Printer, ArrowDownCircle, ArrowUpCircle, FileText, List, PieChart, Ticket
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
const ML_OPTIONS = ['180ml', '300ml', '400ml', '500ml', '700ml'];

const MONTHS = [
  { v: '01', l: 'Janeiro' }, { v: '02', l: 'Fevereiro' }, { v: '03', l: 'Março' },
  { v: '04', l: 'Abril' }, { v: '05', l: 'Maio' }, { v: '06', l: 'Junho' },
  { v: '07', l: 'Julho' }, { v: '08', l: 'Agosto' }, { v: '09', l: 'Setembro' },
  { v: '10', l: 'Outubro' }, { v: '11', l: 'Novembro' }, { v: '12', l: 'Dezembro' }
];

const IceCreamModule: React.FC<IceCreamModuleProps> = ({ 
    user, items, sales, finances, onAddSales, onUpdateItem, onAddTransaction, onDeleteTransaction, onAddItem, onDeleteItem 
}) => {
  const isCashier = user.role === UserRole.CASHIER;
  const isAdminOrManager = user.role === UserRole.ADMIN || user.role === UserRole.MANAGER;
  
  const [activeTab, setActiveTab] = useState<'vendas' | 'dre_diario' | 'dre_mensal' | 'financeiro' | 'products'>('vendas');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const todayKey = new Date().toISOString().split('T')[0];
  const [selectedMonth, setSelectedMonth] = useState(String(new Date().getMonth() + 1).padStart(2, '0'));
  const [selectedYear, setSelectedYear] = useState(String(new Date().getFullYear()));

  // PDV States
  const [selectedCategory, setSelectedCategory] = useState<IceCreamCategory | null>(null);
  const [selectedProductName, setSelectedProductName] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<IceCreamItem | null>(null);
  const [selectedMl, setSelectedMl] = useState<string>('300ml');
  const [quantity, setQuantity] = useState(1);
  const [paymentMethod, setPaymentMethod] = useState<IceCreamPaymentMethod | null>(null);
  const [cart, setCart] = useState<IceCreamDailySale[]>([]);

  // Ticket Post-Venda
  const [showTicketModal, setShowTicketModal] = useState(false);
  const [lastSoldItems, setLastSoldItems] = useState<IceCreamDailySale[]>([]);
  const [lastSaleTime, setLastSaleTime] = useState('');

  // Financeiro
  const [financeForm, setFinanceForm] = useState({ category: 'Vale Funcionário' as IceCreamExpenseCategory, value: '', employeeName: '', description: '', date: todayKey });

  // Modais de Produto
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<IceCreamItem | null>(null);
  const [productForm, setProductForm] = useState({ name: '', category: 'Sundae' as IceCreamCategory, flavor: '', price: '', active: true });

  // --- LOGICA DRE DIÁRIO ---
  const dailyData = useMemo(() => {
    const daySales = sales.filter(s => s.createdAt?.startsWith(todayKey));
    const dayFinances = finances.filter(f => f.date === todayKey);
    const totalSales = daySales.reduce((acc, s) => acc + s.totalValue, 0);
    const totalExits = dayFinances.filter(f => f.type === 'exit').reduce((acc, f) => acc + f.value, 0);
    return { daySales, dayFinances, totalSales, totalExits, balance: totalSales - totalExits };
  }, [sales, finances, todayKey]);

  // --- LOGICA DRE MENSAL ---
  const monthlyData = useMemo(() => {
    const period = `${selectedYear}-${selectedMonth}`;
    const mSales = sales.filter(s => s.createdAt?.startsWith(period));
    const mFinances = finances.filter(f => f.date.startsWith(period));
    const totalRevenue = mSales.reduce((acc, s) => acc + s.totalValue, 0);
    const totalExpenses = mFinances.filter(f => f.type === 'exit').reduce((acc, f) => acc + f.value, 0);
    const netProfit = totalRevenue - totalExpenses;

    return {
        totalRevenue, totalExpenses, netProfit,
        dist: {
            lucieneRegis: netProfit > 0 ? netProfit * 0.6333 : 0,
            ademir: netProfit > 0 ? netProfit * 0.2667 : 0,
            junior: netProfit > 0 ? netProfit * 0.10 : 0
        }
    };
  }, [sales, finances, selectedMonth, selectedYear]);

  // --- IMPRESSÃO TICKET TÉRMICO ---
  const handlePrintTicket = (items: IceCreamDailySale[], time: string) => {
    const printWindow = window.open('', '_blank', 'width=300,height=600');
    if (!printWindow) return;

    const total = items.reduce((a, b) => a + b.totalValue, 0);
    const saleId = Date.now().toString().slice(-6);

    const html = `
      <html>
        <head>
          <title>Ticket de Venda #${saleId}</title>
          <style>
            @page { margin: 0; }
            body { 
              font-family: 'Courier New', Courier, monospace; 
              width: 58mm; 
              margin: 0 auto; 
              padding: 5px; 
              font-size: 11px; 
              line-height: 1.2;
            }
            .center { text-align: center; }
            .header { border-bottom: 1px dashed #000; padding-bottom: 5px; margin-bottom: 5px; }
            .items { width: 100%; border-collapse: collapse; margin-bottom: 5px; }
            .items td { padding: 2px 0; vertical-align: top; }
            .footer { border-top: 1px dashed #000; padding-top: 5px; margin-top: 5px; }
            .bold { font-weight: bold; }
            .total-box { border: 1px solid #000; padding: 5px; margin-top: 5px; font-size: 14px; }
            .divider { border-top: 1px dashed #000; margin: 5px 0; }
            @media print {
               body { width: 58mm; }
            }
          </style>
        </head>
        <body>
          <div class="header center">
            <span class="bold" style="font-size: 14px;">REAL GELATERIA</span><br/>
            <span>CONTROLE DE PRODUCAO</span><br/>
            <span>${new Date().toLocaleDateString('pt-BR')} ${time}</span><br/>
            <span>VENDA: #${saleId}</span>
          </div>
          
          <table class="items">
            ${items.map(i => `
              <tr>
                <td colspan="2" class="bold uppercase">${i.productName} ${i.ml || ''}</td>
              </tr>
              <tr>
                <td style="padding-left: 5px;">${i.unitsSold}x ${formatCurrency(i.unitPrice)}</td>
                <td style="text-align: right;">${formatCurrency(i.totalValue)}</td>
              </tr>
            `).join('')}
          </table>

          <div class="divider"></div>
          
          <div class="footer">
            <div style="display: flex; justify-content: space-between;">
              <span>PAGAMENTO:</span>
              <span class="bold">${items[0]?.paymentMethod || 'PIX'}</span>
            </div>
            <div class="total-box center bold">
              TOTAL: ${formatCurrency(total)}
            </div>
            <div class="center" style="margin-top: 10px;">
              <span>OP: ${user.name.split(' ')[0]}</span><br/>
              <span class="bold" style="font-size: 10px;">AGUARDE SER CHAMADO</span>
            </div>
          </div>
          <script>window.onload = () => { window.print(); window.close(); };</script>
        </body>
      </html>
    `;
    printWindow.document.write(html);
    printWindow.document.close();
  };

  // --- IMPRESSÃO DRE DIÁRIO ---
  const handlePrintDailyDRE = (type: 'detailed' | 'summary') => {
    const printWindow = window.open('', '_blank', 'width=900,height=1200');
    if (!printWindow) return;

    let salesHtml = '';
    const footerHtml = `
      <div class="result">
          <p>Total Entradas: ${formatCurrency(dailyData.totalSales)}</p>
          <p>Total Saídas: ${formatCurrency(dailyData.totalExits)}</p>
          <p style="font-size: 20px; border-top: 2px solid #000; padding-top: 10px;">RESULTADO LÍQUIDO: ${formatCurrency(dailyData.balance)}</p>
      </div>
      <div class="footer">
          <div class="sig">Assinatura Caixa<br/>${user.name}</div>
          <div class="sig">Assinatura Gerente<br/>Data: ___/___/____</div>
      </div>
    `;

    if (type === 'detailed') {
      salesHtml = `
        <h3>VENDAS DO DIA - DETALHADO</h3>
        <table>
            <thead>
                <tr><th>Produto</th><th>ML</th><th>Qtd</th><th>Unit</th><th>Pagto</th><th>Total</th><th>Hora</th></tr>
            </thead>
            <tbody>
                ${dailyData.daySales.map(s => {
                    const hora = s.createdAt ? new Date(s.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '--:--';
                    return `
                        <tr>
                            <td>${s.productName}</td>
                            <td>${s.ml || '-'}</td>
                            <td>${s.unitsSold}</td>
                            <td>${formatCurrency(s.unitPrice)}</td>
                            <td>${s.paymentMethod}</td>
                            <td>${formatCurrency(s.totalValue)}</td>
                            <td>${hora}</td>
                        </tr>
                    `;
                }).join('')}
            </tbody>
        </table>
      `;
    } else {
      const grouped = dailyData.daySales.reduce((acc, s) => {
          const key = `${s.productName}-${s.ml || 'N/A'}-${s.unitPrice}`;
          if (!acc[key]) {
              acc[key] = { productName: s.productName, ml: s.ml, unitPrice: s.unitPrice, unitsSold: 0, totalValue: 0 };
          }
          acc[key].unitsSold += s.unitsSold;
          acc[key].totalValue += s.totalValue;
          return acc;
      }, {} as Record<string, any>);

      salesHtml = `
        <h3>VENDAS DO DIA - RESUMO AGRUPADO</h3>
        <table>
            <thead>
                <tr><th>Produto</th><th>ML</th><th>Qtd Total</th><th>Unit</th><th>Valor Total</th></tr>
            </thead>
            <tbody>
                ${Object.values(grouped).map(g => `
                    <tr>
                        <td>${g.productName}</td>
                        <td>${g.ml || '-'}</td>
                        <td>${g.unitsSold}</td>
                        <td>${formatCurrency(g.unitPrice)}</td>
                        <td>${formatCurrency(g.totalValue)}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
      `;
    }

    const expensesHtml = `
      <h3>DESPESAS DO DIA - DETALHADO</h3>
      <table>
          <thead>
              <tr><th>Tipo</th><th>Categoria</th><th>Descrição</th><th>Valor</th><th>Hora</th></tr>
          </thead>
          <tbody>
              ${dailyData.dayFinances.map(f => {
                  const hora = f.createdAt ? new Date(f.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '--:--';
                  return `
                      <tr>
                          <td>${f.type === 'exit' ? 'SAÍDA' : 'ENTRADA'}</td>
                          <td>${f.category}</td>
                          <td>${f.description || '-'}</td>
                          <td>${formatCurrency(f.value)}</td>
                          <td>${hora}</td>
                      </tr>
                  `;
              }).join('')}
          </tbody>
      </table>
    `;

    const html = `
      <html>
        <head>
            <title>Fechamento ${type === 'detailed' ? 'Detalhado' : 'Resumido'} - ${new Date().toLocaleDateString()}</title>
            <style>
                body { font-family: 'Inter', sans-serif; padding: 40px; font-size: 11px; color: #1a1a1a; }
                .header { text-align: center; border-bottom: 3px solid #000; margin-bottom: 30px; padding-bottom: 10px; }
                .header h2 { margin: 0; font-size: 22px; font-style: italic; font-weight: 900; }
                h3 { border-left: 5px solid #000; padding-left: 10px; text-transform: uppercase; margin-top: 30px; }
                table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
                th, td { border: 1px solid #000; padding: 8px; text-align: left; }
                th { background: #f0f0f0; font-weight: bold; text-transform: uppercase; font-size: 9px; }
                .result { text-align: right; margin-top: 40px; font-weight: 900; }
                .footer { margin-top: 80px; display: flex; justify-content: space-between; gap: 50px; }
                .sig { border-top: 2px solid #000; width: 45%; text-align: center; padding-top: 10px; font-weight: bold; text-transform: uppercase; }
            </style>
        </head>
        <body>
            <div class="header">
                <h2>REAL GELATERIA</h2>
                <p>FECHAMENTO DIÁRIO DE CAIXA | DATA: ${new Date().toLocaleDateString('pt-BR')}</p>
                <p>MODO: ${type === 'detailed' ? 'DETALHADO ITEM A ITEM' : 'RESUMO POR PRODUTO'}</p>
            </div>
            ${salesHtml}
            ${expensesHtml}
            ${footerHtml}
            <script>window.onload = () => { window.print(); window.close(); };</script>
        </body>
      </html>
    `;
    printWindow.document.write(html);
    printWindow.document.close();
  };

  // --- HANDLERS PDV ---
  const handleAddToCart = () => {
      if (!selectedItem || !paymentMethod) {
          alert("Selecione o produto e a forma de pagamento.");
          return;
      }
      const newItem: IceCreamDailySale = {
          id: `cart-${Date.now()}`,
          itemId: selectedItem.id,
          productName: selectedItem.name,
          category: selectedItem.category,
          flavor: selectedItem.flavor || '',
          ml: selectedMl,
          unitsSold: quantity,
          unitPrice: selectedItem.price,
          totalValue: Number((selectedItem.price * quantity).toFixed(2)),
          paymentMethod: paymentMethod,
          createdAt: new Date().toISOString()
      };
      setCart([...cart, newItem]);
      setSelectedItem(null);
      setQuantity(1);
  };

  const handleFinalizeSale = async () => {
      if (cart.length === 0) return;
      setIsSubmitting(true);
      const currentTime = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      try {
          await onAddSales(cart);
          setLastSoldItems([...cart]);
          setLastSaleTime(currentTime);
          setCart([]);
          setShowTicketModal(true);
      } catch (e) {
          alert("Erro ao processar venda.");
      } finally {
          setIsSubmitting(false);
      }
  };

  const handleSaveTransaction = async (e: React.FormEvent) => {
      e.preventDefault();
      const val = parseFloat(financeForm.value.replace(/\./g, '').replace(',', '.'));
      if (isNaN(val) || val <= 0) { alert("Valor inválido."); return; }
      setIsSubmitting(true);
      try {
          await onAddTransaction({
              id: `tx-${Date.now()}`,
              date: financeForm.date,
              type: 'exit',
              category: financeForm.category,
              value: val,
              employeeName: financeForm.employeeName,
              description: financeForm.description,
              createdAt: new Date()
          });
          setFinanceForm(prev => ({ ...prev, value: '', description: '' }));
          alert("Lançamento efetuado!");
      } catch (e) { alert("Erro ao salvar lançamento."); } finally { setIsSubmitting(false); }
  };

  // --- FILTROS DE CATALOGO ---
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

  const handleEditProduct = (item: IceCreamItem) => {
      if (isCashier) return;
      setEditingItem(item);
      setProductForm({ name: item.name, category: item.category, flavor: item.flavor || '', price: item.price.toString(), active: item.active });
      setIsProductModalOpen(true);
  };

  const handleSaveProduct = async () => {
      const priceVal = parseFloat(productForm.price.replace(',', '.'));
      if (!productForm.name || isNaN(priceVal)) return;
      setIsSubmitting(true);
      try {
          if (editingItem) await onUpdateItem({ ...editingItem, ...productForm, price: priceVal });
          else await onAddItem(productForm.name, productForm.category, priceVal, productForm.flavor);
          setIsProductModalOpen(false);
      } finally { setIsSubmitting(false); }
  };

  return (
    <div className="p-4 md:p-8 space-y-4 md:space-y-6 max-w-[1600px] mx-auto min-h-full bg-gray-50 pb-20 md:pb-8">
      
      {/* HEADER DINÂMICO - Otimizado Mobile */}
      <div className="flex flex-col lg:flex-row justify-between items-center gap-4 bg-white p-4 md:p-6 rounded-[32px] shadow-sm border border-gray-100">
        <div className="flex items-center gap-3 w-full lg:w-auto">
          <div className="p-4 bg-gradient-to-br from-blue-700 to-blue-900 rounded-2xl text-white shadow-lg"><IceCream size={24} /></div>
          <div>
            <h2 className="text-xl md:text-2xl font-black text-gray-900 uppercase italic tracking-tighter leading-none">REAL <span className="text-red-600">GELATERIA</span></h2>
            <p className="text-gray-400 text-[9px] font-black uppercase tracking-widest mt-1">PDV de Balcão Profissional</p>
          </div>
        </div>
        
        <div className="flex bg-gray-100 p-1 rounded-2xl overflow-x-auto no-scrollbar shadow-inner w-full lg:w-auto">
          {[
              {id:'vendas',label:'PDV',icon:ShoppingCart, show: true},
              {id:'dre_diario',label:'DRE Diário',icon:FileText, show: true},
              {id:'dre_mensal',label:'DRE Mensal',icon:Calculator, show: isAdminOrManager},
              {id:'financeiro',label:'Saídas',icon:ArrowDownCircle, show: true},
              {id:'products',label:'Produtos',icon:Package, show: isAdminOrManager}
          ].filter(t => t.show).map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`flex-1 lg:flex-none flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${activeTab === tab.id ? 'bg-white text-blue-700 shadow-md scale-105' : 'text-gray-500 hover:text-gray-700'}`}>
                <tab.icon size={14}/> <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* VIEW: PDV VENDAS */}
      {activeTab === 'vendas' && (
          <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 animate-in slide-in-from-bottom-2 duration-400">
              {/* Coluna de Seleção */}
              <div className="xl:col-span-3 space-y-4 md:space-y-6">
                  {/* Categorias - Scroll Horizontal em Mobile */}
                  <div className="bg-white p-3 md:p-6 rounded-[24px] shadow-sm border border-gray-100 overflow-x-auto no-scrollbar flex gap-2">
                      {PRODUCT_CATEGORIES.map(cat => (
                          <button 
                            key={cat} 
                            onClick={() => { setSelectedCategory(cat); setSelectedProductName(null); setSelectedItem(null); }} 
                            className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border-2 flex-shrink-0 ${selectedCategory === cat ? 'bg-blue-600 border-blue-600 text-white shadow-lg' : 'bg-white border-gray-100 text-blue-600'}`}
                          >
                              {cat}
                          </button>
                      ))}
                  </div>

                  {/* Grid de Produtos - Botões Grandes para Toque */}
                  {selectedCategory && (
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 md:gap-4">
                          {categoryItems.map(name => (
                              <button 
                                key={name} 
                                onClick={() => { setSelectedProductName(name); setSelectedItem(null); }} 
                                className={`p-6 md:p-8 rounded-[32px] border-2 transition-all flex items-center justify-center text-center font-black uppercase italic text-xs leading-tight ${selectedProductName === name ? 'bg-blue-50 border-blue-600 text-blue-700 shadow-md' : 'bg-white border-gray-100 text-gray-400 hover:border-blue-200'}`}
                              >
                                  {name}
                              </button>
                          ))}
                      </div>
                  )}

                  {/* Detalhes do Produto Selecionado */}
                  {selectedProductName && (
                      <div className="bg-white p-6 md:p-10 rounded-[40px] shadow-xl border border-gray-100 space-y-6">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                              <div>
                                  <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">Escolha o Sabor</h4>
                                  <div className="grid grid-cols-2 gap-2 md:gap-3">
                                      {itemFlavors.map(item => (
                                          <button key={item.id} onClick={() => setSelectedItem(item)} className={`p-4 md:p-5 rounded-2xl border-2 text-left transition-all ${selectedItem?.id === item.id ? 'bg-red-50 border-red-600 shadow-md' : 'bg-gray-50 border-transparent hover:border-red-200'}`}>
                                              <p className="text-[9px] font-black uppercase text-red-600 mb-1">{item.flavor || 'Padrão'}</p>
                                              <p className="text-lg md:text-xl font-black text-gray-900">{formatCurrency(item.price)}</p>
                                          </button>
                                      ))}
                                  </div>
                              </div>
                              <div className="space-y-4">
                                  <div>
                                    <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">Tamanho / ML</h4>
                                    <div className="grid grid-cols-3 gap-2">
                                        {ML_OPTIONS.map(ml => (
                                            <button key={ml} onClick={() => setSelectedMl(ml)} className={`py-3 rounded-xl text-[10px] font-bold border-2 transition-all ${selectedMl === ml ? 'bg-gray-900 border-gray-900 text-white' : 'bg-white border-gray-100 text-gray-400'}`}>{ml}</button>
                                        ))}
                                    </div>
                                  </div>
                              </div>
                          </div>

                          {selectedItem && (
                              <div className="pt-8 border-t border-gray-100 flex flex-col lg:flex-row items-center gap-6">
                                  <div className="flex items-center gap-4 bg-gray-100 p-2 rounded-2xl">
                                      <button onClick={() => setQuantity(Math.max(1, quantity - 1))} className="w-12 h-12 rounded-xl bg-white flex items-center justify-center font-black text-xl hover:bg-gray-50 shadow-sm">-</button>
                                      <span className="text-2xl font-black w-8 text-center">{quantity}</span>
                                      <button onClick={() => setQuantity(quantity + 1)} className="w-12 h-12 rounded-xl bg-white flex items-center justify-center font-black text-xl hover:bg-gray-50 shadow-sm">+</button>
                                  </div>
                                  <div className="flex flex-1 flex-wrap gap-2 justify-center">
                                      {(['Pix', 'Cartão', 'Dinheiro'] as IceCreamPaymentMethod[]).map(pm => (
                                          <button key={pm} onClick={() => setPaymentMethod(pm)} className={`px-6 py-3 rounded-xl text-[9px] font-black uppercase flex items-center gap-2 border-2 transition-all ${paymentMethod === pm ? 'bg-blue-800 text-white border-blue-800 shadow-lg' : 'bg-white text-gray-400 border-gray-100'}`}>
                                              {pm === 'Pix' ? <Hash size={14}/> : pm === 'Cartão' ? <CreditCard size={14}/> : <Banknote size={14}/>} {pm}
                                          </button>
                                      ))}
                                  </div>
                                  <button onClick={handleAddToCart} className="w-full lg:w-auto bg-red-600 text-white px-10 py-5 rounded-2xl font-black uppercase text-xs shadow-2xl hover:bg-red-700 transition-all flex items-center justify-center gap-3"><Plus size={20}/> Adicionar</button>
                              </div>
                          )}
                      </div>
                  )}
              </div>

              {/* Coluna do Carrinho - Fixa em Desktop, Bottom Sheet em Mobile Simulada */}
              <div className="bg-gray-900 rounded-[40px] p-6 md:p-8 text-white shadow-2xl flex flex-col h-fit sticky top-6">
                  <h3 className="text-xl font-black uppercase italic tracking-tighter mb-8 text-center">Carrinho Atual</h3>
                  <div className="space-y-4 mb-8 max-h-[300px] overflow-y-auto no-scrollbar">
                      {cart.map((item, idx) => (
                          <div key={item.id} className="flex items-center justify-between bg-white/5 p-4 rounded-2xl border border-white/5">
                              <div className="flex-1">
                                  <p className="text-[9px] font-black text-red-500 uppercase">{item.category} • {item.ml}</p>
                                  <p className="font-black uppercase italic text-xs leading-none my-1">{item.productName}</p>
                                  <p className="text-[9px] font-bold text-gray-400">{item.unitsSold}x {formatCurrency(item.unitPrice)} | <span className="text-blue-400">{item.paymentMethod}</span></p>
                              </div>
                              <button onClick={() => setCart(cart.filter((_, i) => i !== idx))} className="p-2 text-gray-600 hover:text-red-500"><Trash2 size={16}/></button>
                          </div>
                      ))}
                      {cart.length === 0 && <p className="text-center py-10 text-[9px] text-gray-600 font-black uppercase tracking-widest">Aguardando Produtos...</p>}
                  </div>
                  <div className="pt-6 border-t border-white/10 space-y-4">
                      <div className="flex justify-between items-end">
                          <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Total</span>
                          <span className="text-3xl md:text-4xl font-black tracking-tighter italic text-white">{formatCurrency(cart.reduce((a, b) => a + b.totalValue, 0))}</span>
                      </div>
                      <button onClick={handleFinalizeSale} disabled={cart.length === 0 || isSubmitting} className="w-full py-5 bg-red-600 hover:bg-red-700 disabled:bg-gray-800 rounded-2xl font-black uppercase text-xs shadow-2xl flex items-center justify-center gap-3 transition-all">
                          {isSubmitting ? <Loader2 className="animate-spin" size={18}/> : <CheckCircle2 size={18}/>} Finalizar e Emitir Ticket
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* VIEW: DRE DIÁRIO */}
      {activeTab === 'dre_diario' && (
          <div className="space-y-6 animate-in fade-in duration-500">
              <div className="flex flex-col md:flex-row justify-between items-center gap-6 bg-white p-8 rounded-[40px] shadow-sm border border-gray-100">
                  <div>
                      <h3 className="text-xl font-black text-gray-900 uppercase italic tracking-tighter">Conferência de <span className="text-red-600">Caixa Diário</span></h3>
                      <p className="text-gray-400 text-[9px] font-black uppercase tracking-widest mt-1">Dados de: {new Date().toLocaleDateString('pt-BR')}</p>
                  </div>
                  <div className="flex gap-3">
                      <button onClick={() => handlePrintDailyDRE('detailed')} className="px-6 py-4 bg-gray-900 text-white rounded-xl font-black uppercase text-[10px] flex items-center gap-2 hover:bg-black shadow-lg"><Printer size={16}/> Detalhado</button>
                      <button onClick={() => handlePrintDailyDRE('summary')} className="px-6 py-4 bg-blue-700 text-white rounded-xl font-black uppercase text-[10px] flex items-center gap-2 hover:bg-blue-800 shadow-lg"><PieChart size={16}/> Resumido</button>
                  </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* ENTRADAS */}
                  <div className="bg-white rounded-[32px] shadow-xl border border-gray-100 overflow-hidden">
                      <div className="p-5 bg-green-50 border-b border-green-100 flex justify-between items-center">
                          <h4 className="font-black text-green-700 uppercase italic tracking-tighter flex items-center gap-2"><ArrowUpCircle size={18}/> Entradas</h4>
                          <span className="text-lg font-black text-green-800">{formatCurrency(dailyData.totalSales)}</span>
                      </div>
                      <div className="overflow-x-auto max-h-[400px] no-scrollbar">
                          <table className="w-full text-left">
                              <thead className="bg-gray-50 text-[9px] font-black text-gray-400 uppercase tracking-widest"><tr className="border-b">
                                  <th className="px-6 py-4">Produto</th><th className="px-4 py-4 text-center">Qtd</th><th className="px-4 py-4 text-right">Total</th>
                              </tr></thead>
                              <tbody className="divide-y divide-gray-50">
                                  {dailyData.daySales.map(s => (
                                      <tr key={s.id} className="text-[10px] font-bold text-gray-600">
                                          <td className="px-6 py-4 uppercase italic">{s.productName} ({s.ml})</td>
                                          <td className="px-4 py-4 text-center">{s.unitsSold}</td>
                                          <td className="px-4 py-4 text-right text-gray-900 font-black">{formatCurrency(s.totalValue)}</td>
                                      </tr>
                                  ))}
                              </tbody>
                          </table>
                      </div>
                  </div>

                  {/* SAÍDAS */}
                  <div className="bg-white rounded-[32px] shadow-xl border border-gray-100 overflow-hidden">
                      <div className="p-5 bg-red-50 border-b border-red-100 flex justify-between items-center">
                          <h4 className="font-black text-red-700 uppercase italic tracking-tighter flex items-center gap-2"><ArrowDownCircle size={18}/> Saídas</h4>
                          <span className="text-lg font-black text-red-800">{formatCurrency(dailyData.totalExits)}</span>
                      </div>
                      <div className="overflow-x-auto max-h-[400px] no-scrollbar">
                          <table className="w-full text-left">
                              <thead className="bg-gray-50 text-[9px] font-black text-gray-400 uppercase tracking-widest"><tr className="border-b">
                                  <th className="px-6 py-4">Categoria</th><th className="px-4 py-4">Descrição</th><th className="px-4 py-4 text-right">Valor</th>
                              </tr></thead>
                              <tbody className="divide-y divide-gray-50">
                                  {dailyData.dayFinances.map(f => (
                                      <tr key={f.id} className="text-[10px] font-bold text-gray-600">
                                          <td className="px-6 py-4 uppercase italic">{f.category}</td>
                                          <td className="px-4 py-4 italic">{f.description || '-'}</td>
                                          <td className="px-4 py-4 text-right text-red-600 font-black">{formatCurrency(f.value)}</td>
                                      </tr>
                                  ))}
                              </tbody>
                          </table>
                      </div>
                  </div>
              </div>

              <div className={`p-10 rounded-[48px] text-white shadow-2xl text-center bg-gradient-to-br ${dailyData.balance >= 0 ? 'from-blue-900 to-blue-950' : 'from-red-900 to-red-950'}`}>
                  <p className="text-[10px] font-black text-blue-300 uppercase tracking-widest mb-3">Saldo Líquido de Hoje</p>
                  <p className="text-5xl font-black italic tracking-tighter leading-none">{formatCurrency(dailyData.balance)}</p>
              </div>
          </div>
      )}

      {/* VIEW: DRE MENSAL */}
      {activeTab === 'dre_mensal' && isAdminOrManager && (
          <div className="space-y-6 animate-in fade-in duration-500">
              <div className="bg-white p-6 md:p-8 rounded-[40px] shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between items-center gap-6">
                  <div>
                      <h3 className="text-xl font-black text-gray-900 uppercase italic tracking-tighter">Performance <span className="text-blue-700">Consolidada</span></h3>
                      <p className="text-gray-400 text-[10px] font-black uppercase tracking-widest mt-1">Rateio de Lucros por Período</p>
                  </div>
                  <div className="flex gap-2">
                      <select value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} className="bg-gray-50 border-none rounded-xl px-4 py-3 font-black text-[10px] uppercase outline-none">
                          {MONTHS.map(m => <option key={m.v} value={m.v}>{m.l}</option>)}
                      </select>
                      <select value={selectedYear} onChange={e => setSelectedYear(e.target.value)} className="bg-gray-50 border-none rounded-xl px-4 py-3 font-black text-[10px] outline-none">
                          {['2024','2025','2026'].map(y => <option key={y} value={y}>{y}</option>)}
                      </select>
                  </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-white p-6 rounded-[32px] shadow-sm border border-gray-100">
                      <p className="text-[9px] font-black text-gray-400 uppercase mb-1">Faturamento Bruto</p>
                      <h4 className="text-2xl font-black text-gray-900">{formatCurrency(monthlyData.totalRevenue)}</h4>
                  </div>
                  <div className="bg-white p-6 rounded-[32px] shadow-sm border border-gray-100">
                      <p className="text-[9px] font-black text-gray-400 uppercase mb-1">Despesas Mês</p>
                      <h4 className="text-2xl font-black text-red-600">{formatCurrency(monthlyData.totalExpenses)}</h4>
                  </div>
                  <div className={`p-6 rounded-[32px] shadow-xl text-white bg-gradient-to-br ${monthlyData.netProfit >= 0 ? 'from-gray-900 to-black' : 'from-red-900 to-red-950'}`}>
                      <p className="text-[9px] font-black text-blue-400 uppercase mb-1">Lucro Líquido</p>
                      <h4 className="text-3xl font-black italic tracking-tighter">{formatCurrency(monthlyData.netProfit)}</h4>
                  </div>
              </div>

              {monthlyData.netProfit > 0 && (
                  <div className="bg-white p-8 md:p-12 rounded-[56px] shadow-xl border border-gray-100 border-t-8 border-t-blue-700">
                      <h4 className="text-xl font-black text-gray-900 uppercase italic tracking-tighter mb-8 flex items-center gap-3"><TrendingUp className="text-blue-700" size={24}/> Divisão Oficial de Resultados</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                          <div className="p-6 bg-blue-50/50 rounded-[32px] border border-blue-100 text-center">
                              <span className="text-[9px] font-black text-blue-500 uppercase block mb-1">Luciene + Regis (63,33%)</span>
                              <p className="text-2xl font-black text-blue-900 italic">{formatCurrency(monthlyData.dist.lucieneRegis)}</p>
                          </div>
                          <div className="p-6 bg-gray-50 rounded-[32px] border border-gray-100 text-center">
                              <span className="text-[9px] font-black text-gray-400 uppercase block mb-1">Ademir (26,67%)</span>
                              <p className="text-2xl font-black text-gray-900 italic">{formatCurrency(monthlyData.dist.ademir)}</p>
                          </div>
                          <div className="p-6 bg-red-50/50 rounded-[32px] border border-red-100 text-center">
                              <span className="text-[9px] font-black text-red-400 uppercase block mb-1">Junior (10,00%)</span>
                              <p className="text-2xl font-black text-red-600 italic">{formatCurrency(monthlyData.dist.junior)}</p>
                          </div>
                      </div>
                  </div>
              )}
          </div>
      )}

      {/* VIEW: FINANCEIRO */}
      {activeTab === 'financeiro' && (
          <div className="max-w-2xl mx-auto animate-in zoom-in duration-300">
              <div className="bg-white p-8 md:p-12 rounded-[48px] shadow-2xl border border-gray-100">
                  <h3 className="font-black text-gray-900 text-2xl uppercase italic tracking-tighter mb-8 flex items-center gap-4"><ArrowDownCircle className="text-red-600" size={32} /> Registrar Saída de Caixa</h3>
                  <form onSubmit={handleSaveTransaction} className="space-y-6">
                      <div className="grid grid-cols-2 gap-4">
                          <div><label className="text-[9px] font-black text-gray-400 uppercase block mb-1">Data</label>
                          <input type="date" value={financeForm.date} onChange={e => setFinanceForm({...financeForm, date: e.target.value})} className="w-full p-4 bg-gray-50 border-none rounded-2xl font-black text-xs" /></div>
                          <div><label className="text-[9px] font-black text-gray-400 uppercase block mb-1">Valor (R$)</label>
                          <input value={financeForm.value} onChange={e => setFinanceForm({...financeForm, value: e.target.value})} placeholder="0,00" className="w-full p-4 bg-gray-50 border-none rounded-2xl font-black text-xl text-gray-900 outline-none" /></div>
                      </div>
                      <div>
                          <label className="text-[9px] font-black text-gray-400 uppercase block mb-1">Categoria</label>
                          <select value={financeForm.category} onChange={e => setFinanceForm({...financeForm, category: e.target.value as IceCreamExpenseCategory})} className="w-full p-4 bg-gray-50 border-none rounded-2xl font-black uppercase text-xs">
                              {EXPENSE_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                          </select>
                      </div>
                      <div><label className="text-[9px] font-black text-gray-400 uppercase block mb-1">Descrição</label>
                      <textarea value={financeForm.description} onChange={e => setFinanceForm({...financeForm, description: e.target.value})} className="w-full p-4 bg-gray-50 border-none rounded-2xl font-medium h-20 outline-none" /></div>
                      <button type="submit" disabled={isSubmitting} className="w-full py-5 bg-red-600 text-white rounded-[24px] font-black uppercase text-xs shadow-xl flex items-center justify-center gap-3">
                          {isSubmitting ? <Loader2 className="animate-spin" size={20}/> : <Save size={20}/>} Confirmar Lançamento
                      </button>
                  </form>
              </div>
          </div>
      )}

      {/* VIEW: CATALOGO */}
      {activeTab === 'products' && isAdminOrManager && (
          <div className="space-y-6 animate-in fade-in duration-500">
              <div className="flex justify-between items-center bg-white p-6 rounded-[32px] shadow-sm border border-gray-100">
                  <h3 className="font-black text-gray-900 text-xl uppercase italic tracking-tighter">Gerenciar Catálogo</h3>
                  <button onClick={() => { setEditingItem(null); setProductForm({ name: '', category: 'Sundae', flavor: '', price: '', active: true }); setIsProductModalOpen(true); }} className="bg-gray-950 text-white px-8 py-4 rounded-xl font-black uppercase text-[10px] shadow-lg">Novo Item</button>
              </div>
              <div className="bg-white rounded-[32px] shadow-xl border border-gray-100 overflow-hidden">
                  <table className="w-full text-left">
                      <thead><tr className="bg-gray-50 text-[9px] font-black text-gray-400 uppercase tracking-widest border-b"><th className="px-8 py-4">Produto</th><th className="px-8 py-4">Categoria</th><th className="px-8 py-4">Preço</th><th className="px-8 py-4 text-right">Ações</th></tr></thead>
                      <tbody className="divide-y divide-gray-50">
                          {items.map(item => (
                              <tr key={item.id} className={`hover:bg-blue-50/20 ${!item.active ? 'opacity-40 grayscale' : ''}`}>
                                  <td className="px-8 py-4 font-black text-gray-900 uppercase italic text-xs">{item.name} {item.flavor ? `- ${item.flavor}` : ''}</td>
                                  <td className="px-8 py-4"><span className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-[8px] font-black uppercase">{item.category}</span></td>
                                  <td className="px-8 py-4 font-black text-blue-800">{formatCurrency(item.price)}</td>
                                  <td className="px-8 py-4 text-right">
                                      <div className="flex justify-end gap-2">
                                          <button onClick={() => handleEditProduct(item)} className="p-2 bg-blue-50 text-blue-600 rounded-lg"><Edit3 size={16}/></button>
                                          <button onClick={() => onDeleteItem(item.id)} className="p-2 bg-red-50 text-red-500 rounded-lg"><Trash2 size={16}/></button>
                                      </div>
                                  </td>
                              </tr>
                          ))}
                      </tbody>
                  </table>
              </div>
          </div>
      )}

      {/* MODAL: TICKET PÓS-VENDA (Simulação de Impressora Térmica) */}
      {showTicketModal && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-xl flex items-center justify-center z-[200] p-4">
            <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in duration-300 flex flex-col items-center">
                <div className="p-8 text-center bg-green-50 w-full border-b border-green-100">
                    <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center text-white mx-auto mb-4 shadow-lg"><CheckCircle2 size={32} /></div>
                    <h3 className="text-xl font-black text-green-900 uppercase italic tracking-tighter">Venda Finalizada!</h3>
                    <p className="text-[10px] font-black text-green-600 uppercase tracking-widest mt-1">Ticket de Produção Emitido</p>
                </div>

                <div className="p-8 w-full">
                    {/* Visual do Cupom */}
                    <div className="bg-gray-50 p-6 rounded-2xl border-2 border-dashed border-gray-300 font-mono text-[11px] text-gray-700 space-y-3 shadow-inner">
                        <div className="text-center font-black border-b border-gray-200 pb-2 mb-2">
                           <p>REAL GELATERIA</p>
                           <p>TICKET DE CONTROLE</p>
                        </div>
                        <div className="flex justify-between"><span>HORA:</span><span>{lastSaleTime}</span></div>
                        <div className="flex justify-between"><span>OP:</span><span className="uppercase">{user.name.split(' ')[0]}</span></div>
                        <div className="border-b border-gray-200 pt-2"></div>
                        {lastSoldItems.map((it, idx) => (
                           <div key={idx} className="flex justify-between font-black uppercase italic">
                               <span>{it.unitsSold}x {it.productName}</span>
                               <span>{formatCurrency(it.totalValue)}</span>
                           </div>
                        ))}
                        <div className="border-b border-gray-200 pt-2"></div>
                        <div className="flex justify-between text-base font-black border-t-2 border-black pt-2">
                            <span>TOTAL:</span>
                            <span>{formatCurrency(lastSoldItems.reduce((a,b) => a + b.totalValue, 0))}</span>
                        </div>
                    </div>

                    <div className="flex flex-col gap-3 mt-8">
                        <button 
                            onClick={() => handlePrintTicket(lastSoldItems, lastSaleTime)} 
                            className="w-full py-4 bg-gray-950 text-white rounded-2xl font-black uppercase text-xs flex items-center justify-center gap-3 shadow-xl hover:bg-black transition-all"
                        >
                            <Printer size={18} /> Imprimir Via Térmica
                        </button>
                        <button 
                            onClick={() => setShowTicketModal(false)} 
                            className="w-full py-4 bg-gray-100 text-gray-400 rounded-2xl font-black uppercase text-xs hover:bg-gray-200 transition-all"
                        >
                            Fechar e Nova Venda
                        </button>
                    </div>
                </div>
            </div>
        </div>
      )}

      {/* MODAL: PRODUTO */}
      {isProductModalOpen && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-xl flex items-center justify-center z-[150] p-4">
            <div className="bg-white rounded-[56px] shadow-2xl w-full max-w-xl overflow-hidden animate-in zoom-in duration-300">
                <div className="p-8 bg-gray-50 border-b flex justify-between items-center">
                    <h3 className="text-2xl font-black text-gray-900 uppercase italic tracking-tighter">{editingItem ? 'Editar' : 'Novo'} Produto</h3>
                    <button onClick={() => setIsProductModalOpen(false)} className="text-gray-400 hover:text-red-600 transition-all"><X size={24} /></button>
                </div>
                <div className="p-10 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div><label className="text-[10px] font-black text-gray-500 uppercase block mb-2">Nome</label><input value={productForm.name} onChange={e => setProductForm({...productForm, name: e.target.value})} className="w-full px-5 py-4 bg-gray-50 border-none rounded-2xl font-black text-gray-800 uppercase italic outline-none" /></div>
                        <div><label className="text-[10px] font-black text-gray-500 uppercase block mb-2">Categoria</label>
                            <select value={productForm.category} onChange={e => setProductForm({...productForm, category: e.target.value as IceCreamCategory})} className="w-full px-5 py-4 bg-gray-50 border-none rounded-2xl font-black text-blue-700 uppercase outline-none">
                                {PRODUCT_CATEGORIES.map(cat => (<option key={cat} value={cat}>{cat}</option>))}
                            </select>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div><label className="text-[10px] font-black text-gray-500 uppercase block mb-2">Sabor</label><input value={productForm.flavor} onChange={e => setProductForm({...productForm, flavor: e.target.value})} className="w-full px-5 py-4 bg-gray-50 border-none rounded-2xl font-black text-gray-800 uppercase italic outline-none" /></div>
                        <div><label className="text-[10px] font-black text-gray-500 uppercase block mb-2">Preço (R$)</label><input value={productForm.price} onChange={e => setProductForm({...productForm, price: e.target.value})} placeholder="0,00" className="w-full px-5 py-4 bg-blue-50 border-2 border-blue-100 rounded-2xl font-black text-2xl text-blue-900 outline-none" /></div>
                    </div>
                </div>
                <div className="p-8 bg-gray-50 flex gap-4 border-t border-gray-100">
                    <button onClick={() => setIsProductModalOpen(false)} className="flex-1 py-4 bg-white border-2 border-gray-200 rounded-2xl font-black text-gray-400 uppercase text-[10px]">Cancelar</button>
                    <button onClick={handleSaveProduct} disabled={isSubmitting} className="flex-1 py-4 bg-blue-700 text-white rounded-2xl font-black uppercase text-[10px] shadow-xl flex items-center justify-center gap-3">
                        {isSubmitting ? <Loader2 className="animate-spin" size={18}/> : <Save size={18}/>} Confirmar
                    </button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default IceCreamModule;
