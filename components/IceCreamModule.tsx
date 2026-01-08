import React, { useState, useMemo, useEffect } from 'react';
import { IceCreamItem, IceCreamDailySale, IceCreamTransaction, IceCreamCategory, IceCreamExpenseCategory, IceCreamPaymentMethod, User, UserRole } from '../types';
import { formatCurrency } from '../constants';
import { 
    IceCream, Plus, DollarSign, Save, Trash2, X, Calculator, Edit3, Package, 
    Loader2, ShoppingCart, CheckCircle2, Hash, CreditCard, 
    Banknote, Users, Search, Filter, Calendar, TrendingUp, TrendingDown, ChevronRight, Printer, ArrowDownCircle, ArrowUpCircle, FileText, List, PieChart, Ticket, Ban, Info, Boxes, AlertTriangle, RefreshCw, BarChart3, ChevronLeft, CalendarDays, Wallet, Briefcase
} from 'lucide-react';
import PDVMobileView from './PDVMobileView';

interface IceCreamModuleProps {
  initialTab?: 'vendas' | 'estoque' | 'dre_diario' | 'dre_mensal' | 'financeiro' | 'products';
  user: User;
  items: IceCreamItem[];
  sales: IceCreamDailySale[];
  finances: IceCreamTransaction[];
  onAddSales: (sale: IceCreamDailySale[]) => Promise<void>;
  onCancelSale: (saleCode: string, reason: string) => Promise<void>;
  onUpdatePrice: (id: string, price: number) => Promise<void>;
  onUpdateItem: (item: IceCreamItem) => Promise<void>;
  onAddTransaction: (tx: IceCreamTransaction) => Promise<void>;
  onDeleteTransaction: (id: string) => Promise<void>;
  onAddItem: (name: string, category: IceCreamCategory, price: number, flavor?: string, stockInitial?: number, unit?: string, consumptionPerSale?: number) => Promise<void>;
  onDeleteItem: (id: string) => Promise<void>;
  onUpdateStock: (itemId: string, qty: number, type: 'adjustment' | 'restock', reason: string) => Promise<void>;
}

const EXPENSE_CATEGORIES: IceCreamExpenseCategory[] = ['Vale Funcionário', 'Pagamento Funcionário', 'Fornecedor', 'Material/Consumo', 'Aluguel', 'Energia', 'Outros'];
const PRODUCT_CATEGORIES: IceCreamCategory[] = ['Sundae', 'Milkshake', 'Casquinha', 'Cascão', 'Bebidas', 'Adicionais'].sort() as IceCreamCategory[];
const ML_OPTIONS = ['180ml', '300ml', '400ml', '500ml', '700ml'];

const MONTHS = [
  { value: '01', label: 'Janeiro' }, { value: '02', label: 'Fevereiro' }, { value: '03', label: 'Março' },
  { value: '04', label: 'Abril' }, { value: '05', label: 'Maio' }, { value: '06', label: 'Junho' },
  { value: '07', label: 'Julho' }, { value: '08', label: 'Agosto' }, { value: '09', label: 'Setembro' },
  { value: '10', label: 'Outubro' }, { value: '11', label: 'Novembro' }, { value: '12', label: 'Dezembro' }
];

const IceCreamModule: React.FC<IceCreamModuleProps> = ({ 
    initialTab, user, items, sales, finances, onAddSales, onCancelSale, onUpdateItem, onAddTransaction, onDeleteTransaction, onAddItem, onDeleteItem, onUpdateStock
}) => {
  const isAdminOrManager = user.role === UserRole.ADMIN || user.role === UserRole.MANAGER;
  
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const [activeTab, setActiveTab] = useState<'vendas' | 'estoque' | 'dre_diario' | 'dre_mensal' | 'financeiro' | 'products'>(initialTab || 'vendas');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  const todayKey = new Date().toISOString().split('T')[0];
  
  const [monthlyFilterMonth, setMonthlyFilterMonth] = useState(String(new Date().getMonth() + 1).padStart(2, '0'));
  const [monthlyFilterYear, setMonthlyFilterYear] = useState(String(new Date().getFullYear()));
  const [expenseFilterMonth, setExpenseFilterMonth] = useState(String(new Date().getMonth() + 1).padStart(2, '0'));
  const [expenseFilterYear, setExpenseFilterYear] = useState(String(new Date().getFullYear()));

  const availableYears = useMemo(() => {
    const yearsSet = new Set<number>();
    const now = new Date();
    yearsSet.add(now.getFullYear());
    yearsSet.add(now.getFullYear() + 1);
    sales.forEach(s => { if (s.createdAt) yearsSet.add(new Date(s.createdAt).getFullYear()); });
    finances.forEach(f => { if (f.date) yearsSet.add(new Date(f.date).getFullYear()); });
    return Array.from(yearsSet).sort((a, b) => b - a);
  }, [sales, finances]);

  const [selectedCategory, setSelectedCategory] = useState<IceCreamCategory | null>(null);
  const [selectedProductName, setSelectedProductName] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<IceCreamItem | null>(null);
  const [selectedMl, setSelectedMl] = useState<string>('300ml');
  const [quantity, setQuantity] = useState(1);
  const [paymentMethod, setPaymentMethod] = useState<IceCreamPaymentMethod | null>(null);
  const [cart, setCart] = useState<IceCreamDailySale[]>([]);

  const [showTicketModal, setShowTicketModal] = useState(false);
  const [lastSoldItems, setLastSoldItems] = useState<IceCreamDailySale[]>([]);
  const [lastSaleTime, setLastSaleTime] = useState('');
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [isStockAdjustmentModalOpen, setIsStockAdjustmentModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<IceCreamItem | null>(null);

  const [financeForm, setFinanceForm] = useState({
    date: todayKey,
    category: 'Vale Funcionário' as IceCreamExpenseCategory,
    value: '',
    employeeName: '',
    description: ''
  });

  const [productForm, setProductForm] = useState({
    name: '',
    category: PRODUCT_CATEGORIES[0] || 'Sundae',
    price: '',
    flavor: '',
    active: true,
    stockInitial: '0',
    unit: 'un',
    consumptionPerSale: '1'
  });

  const [stockForm, setStockForm] = useState({
      itemId: '',
      qty: '',
      type: 'restock' as 'adjustment' | 'restock',
      reason: ''
  });

  const categoryItems = useMemo(() => {
    if (!selectedCategory) return [];
    const names = new Set<string>();
    items.filter(i => i.category === selectedCategory && i.active).forEach(i => names.add(i.name));
    return Array.from(names).sort();
  }, [items, selectedCategory]);

  const itemFlavors = useMemo(() => {
    if (!selectedProductName || !selectedCategory) return [];
    return items.filter(i => i.category === selectedCategory && i.name === selectedProductName && i.active);
  }, [items, selectedCategory, selectedProductName]);

  const dailySummaryData = useMemo(() => {
    const daySales = sales.filter(s => s.createdAt?.startsWith(todayKey) && s.status !== 'canceled');
    const dayExits = finances.filter(f => f.date === todayKey && f.type === 'exit');
    const totalEntries = daySales.reduce((acc, s) => acc + s.totalValue, 0);
    const totalExits = dayExits.reduce((acc, f) => acc + f.value, 0);
    const result = totalEntries - totalExits;
    return { totalEntries, totalExits, result, allDaySales: sales.filter(s => s.createdAt?.startsWith(todayKey)), allDayExits: dayExits };
  }, [sales, finances, todayKey]);

  const monthlySummaryData = useMemo(() => {
    const monthKey = `${monthlyFilterYear}-${monthlyFilterMonth}`;
    const mSales = sales.filter(s => s.createdAt?.startsWith(monthKey) && s.status !== 'canceled');
    const mExits = finances.filter(f => f.date.startsWith(monthKey) && f.type === 'exit');
    const totalEntries = mSales.reduce((acc, s) => acc + s.totalValue, 0);
    const totalExits = mExits.reduce((acc, f) => acc + f.value, 0);
    const result = totalEntries - totalExits;
    return { totalEntries, totalExits, result, filteredSales: mSales, filteredExits: mExits };
  }, [sales, finances, monthlyFilterMonth, monthlyFilterYear]);

  const filteredFinances = useMemo(() => {
    const filterKey = `${expenseFilterYear}-${expenseFilterMonth}`;
    return finances.filter(f => f.date.startsWith(filterKey) && f.type === 'exit');
  }, [finances, expenseFilterMonth, expenseFilterYear]);

  const handlePrintDRE_A4 = (period: 'daily' | 'monthly', type: 'summary' | 'detailed' = 'detailed') => {
    const printWindow = window.open('', '_blank', 'width=900,height=1200');
    if (!printWindow) return;

    const data = period === 'daily' ? dailySummaryData : monthlySummaryData;
    const entries = period === 'daily' ? dailySummaryData.allDaySales : monthlySummaryData.filteredSales;
    const exits = period === 'daily' ? dailySummaryData.allDayExits : monthlySummaryData.filteredExits;

    const title = period === 'daily' 
        ? `DRE DIÁRIO - ${new Date().toLocaleDateString('pt-BR')}` 
        : `DRE MENSAL - ${MONTHS.find(m => m.value === monthlyFilterMonth)?.label} / ${monthlyFilterYear}`;

    const profitShare = period === 'monthly' ? {
        lure: data.result * 0.6333,
        ademir: data.result * 0.2667,
        junior: data.result * 0.10
    } : null;

    const categoryTotals: Record<string, number> = {};
    if (type === 'detailed') {
        entries.forEach(s => {
            categoryTotals[s.category] = (categoryTotals[s.category] || 0) + s.totalValue;
        });
    }

    const html = `
      <html>
        <head>
          <title>${title}</title>
          <style>
            @page { size: A4 portrait; margin: 2cm; }
            body { font-family: 'Inter', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #1a202c; line-height: 1.4; margin: 0; padding: 0; background: #fff; }
            .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #2d3748; padding-bottom: 20px; }
            .header h1 { margin: 0; font-size: 26px; text-transform: uppercase; color: #1a202c; font-weight: 900; letter-spacing: -0.025em; }
            .header p { margin: 5px 0 0; font-size: 14px; color: #4a5568; font-weight: 700; text-transform: uppercase; }
            .section-title { font-size: 13px; font-weight: 900; text-transform: uppercase; background: #2d3748; color: white; padding: 8px 12px; margin: 25px 0 10px; border-radius: 4px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 11px; }
            th { text-align: left; padding: 10px 8px; border-bottom: 2px solid #cbd5e0; color: #2d3748; text-transform: uppercase; font-weight: 800; }
            td { padding: 8px; border-bottom: 1px solid #e2e8f0; }
            .text-right { text-align: right; }
            .bold { font-weight: 800; }
            .summary-box { border: 2px solid #1a202c; border-radius: 8px; padding: 20px; margin-top: 30px; background: #f8fafc; }
            .summary-row { display: flex; justify-content: space-between; font-size: 14px; margin-bottom: 8px; font-weight: 600; }
            .summary-row.total { border-top: 2px solid #1a202c; padding-top: 12px; margin-top: 12px; font-size: 18px; font-weight: 900; color: #1a202c; }
            .distribution-box { margin-top: 30px; border: 1px solid #cbd5e0; border-radius: 8px; padding: 15px; background: #fff; }
            .distribution-title { font-size: 14px; font-weight: 900; margin-bottom: 12px; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; text-transform: uppercase; color: #2d3748; }
            .footer-info { margin-top: 40px; text-align: center; font-size: 9px; color: #a0aec0; border-top: 1px solid #e2e8f0; padding-top: 10px; text-transform: uppercase; letter-spacing: 0.05em; }
            .negative { color: #c53030; }
            .positive { color: #2f855a; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>REAL GELATERIA</h1>
            <p>${title}</p>
            <p style="font-size: 9px; font-weight: normal; margin-top: 8px; color: #718096;">Data de Emissão: ${new Date().toLocaleString('pt-BR')}</p>
          </div>

          ${type === 'detailed' ? `
            <div class="section-title">Detalhamento de Entradas (Vendas)</div>
            <table>
              <thead>
                <tr>
                  <th>Data/Hora ${period === 'daily' ? '' : 'Dia'}</th>
                  <th>Produto / Variação</th>
                  <th class="text-right">Qtd</th>
                  <th class="text-right">Unitário</th>
                  <th class="text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                ${entries.map((s: any) => `
                  <tr style="${s.status === 'canceled' ? 'text-decoration: line-through; opacity: 0.5;' : ''}">
                    <td>${period === 'daily' ? new Date(s.createdAt).toLocaleTimeString('pt-BR') : new Date(s.createdAt).toLocaleDateString('pt-BR')}</td>
                    <td class="bold uppercase">${s.productName} ${s.ml || ''}</td>
                    <td class="text-right">${s.unitsSold}</td>
                    <td class="text-right">${formatCurrency(s.unitPrice)}</td>
                    <td class="text-right bold">${formatCurrency(s.totalValue)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>

            <div class="section-title">Totais por Categoria</div>
            <table style="width: 50%; margin-bottom: 30px;">
                <thead><tr><th>Categoria</th><th class="text-right">Valor Acumulado</th></tr></thead>
                <tbody>
                    ${Object.entries(categoryTotals).map(([cat, val]) => `
                        <tr><td class="bold">${cat}</td><td class="text-right bold">${formatCurrency(val)}</td></tr>
                    `).join('')}
                </tbody>
            </table>

            <div class="section-title">Detalhamento de Saídas (Despesas)</div>
            <table>
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Categoria</th>
                  <th>Descrição / Observação</th>
                  <th class="text-right">Valor</th>
                </tr>
              </thead>
              <tbody>
                ${exits.map((f: any) => `
                  <tr>
                    <td>${new Date(f.date + 'T12:00:00').toLocaleDateString('pt-BR')}</td>
                    <td class="bold uppercase">${f.category}</td>
                    <td>${f.description || '-'}</td>
                    <td class="text-right bold negative">${formatCurrency(f.value)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          ` : `
            <div style="padding: 40px 0; text-align: center; border: 1px dashed #cbd5e0; border-radius: 8px; margin-bottom: 20px;">
                <p style="font-weight: 800; color: #4a5568; margin: 0;">RELATÓRIO RESUMIDO OPERACIONAL</p>
                <p style="font-size: 11px; color: #718096; margin-top: 5px;">Visualização consolidada de indicadores financeiros do período.</p>
            </div>
          `}

          <div class="summary-box">
            <div class="summary-row"><span>Total Bruto de Entradas (Faturamento):</span><span class="positive">${formatCurrency(data.totalEntries)}</span></div>
            <div class="summary-row"><span>Total de Saídas (Despesas/Custos):</span><span class="negative">${formatCurrency(data.totalExits)}</span></div>
            <div class="summary-row total"><span>RESULTADO LÍQUIDO DO PERÍODO:</span><span>${formatCurrency(data.result)}</span></div>
          </div>

          ${profitShare ? `
            <div class="distribution-box">
              <div class="distribution-title">DISTRIBUIÇÃO DE LUCROS (SOCIETÁRIO)</div>
              <div class="summary-row"><span>Luciene + Regis (63,33%):</span><span class="bold">${formatCurrency(profitShare.lure)}</span></div>
              <div class="summary-row"><span>Ademir (26,67%):</span><span class="bold">${formatCurrency(profitShare.ademir)}</span></div>
              <div class="summary-row"><span>Junior (10,00%):</span><span class="bold">${formatCurrency(profitShare.junior)}</span></div>
            </div>
          ` : ''}

          <div class="footer-info">
            Este relatório é um documento interno de controle administrativo. Real Calçados & Estratégia Corporativa.
          </div>

          <script>
            window.onload = () => {
                setTimeout(() => {
                    window.print();
                    window.close();
                }, 500);
            };
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
  };

  const handleCancelSaleConfirmed = async (saleCode: string) => {
    const reason = prompt("Motivo do cancelamento:");
    if (reason) await onCancelSale(saleCode, reason);
  };

  const handlePrintTicket = (items: IceCreamDailySale[], time: string) => {
    const printWindow = window.open('', '_blank', 'width=300,height=600');
    if (!printWindow) return;
    const total = items.reduce((a, b) => a + b.totalValue, 0);
    const saleCode = items[0]?.saleCode || '---';
    const html = `<html><head><title>Ticket Venda ${saleCode}</title><style>@page { margin: 0; } body { font-family: 'Courier New', Courier, monospace; width: 58mm; margin: 0 auto; padding: 5px; font-size: 11px; line-height: 1.2; } .center { text-align: center; } .header { border-bottom: 1px dashed #000; padding-bottom: 5px; margin-bottom: 5px; } .items { width: 100%; border-collapse: collapse; margin-bottom: 5px; } .items td { padding: 2px 0; vertical-align: top; } .footer { border-top: 1px dashed #000; padding-top: 5px; margin-top: 5px; } .bold { font-weight: bold; } .total-box { border: 1px solid #000; padding: 5px; margin-top: 5px; font-size: 14px; } .divider { border-top: 1px dashed #000; margin: 5px 0; } .uppercase { text-transform: uppercase; } @media print { body { width: 58mm; } }</style></head><body><div class="header center"><span class="bold" style="font-size: 14px;">REAL GELATERIA</span><br/><div class="bold" style="margin: 5px 0; border: 1px solid #000; padding: 2px; font-size: 12px; text-align: center;">CÓDIGO DA VENDA: ${saleCode}</div><span>CONTROLE DE PRODUCAO</span><br/><span>${new Date().toLocaleDateString('pt-BR')} ${time}</span></div><table class="items">${items.map(i => `<tr><td colspan="2" class="bold uppercase">${i.productName} ${i.ml || ''}</td></tr><tr><td style="padding-left: 5px;">${i.unitsSold}x ${formatCurrency(i.unitPrice)}</td><td style="text-align: right;">${formatCurrency(i.totalValue)}</td></tr>`).join('')}</table><div class="divider"></div><div class="footer"><div style="display: flex; justify-content: space-between;"><span>PAGAMENTO:</span><span class="bold">${items[0]?.paymentMethod || 'PIX'}</span></div><div class="total-box center bold">TOTAL: ${formatCurrency(total)}</div><div class="center" style="margin-top: 10px;"><span>OP: ${user.name.split(' ')[0]}</span><br/><span class="bold" style="font-size: 10px;">AGUARDE SER CHAMADO</span></div></div><script>window.onload = () => { window.print(); window.close(); };</script></body></html>`;
    printWindow.document.write(html);
    printWindow.document.close();
  };

  if (isMobile) {
    // Fix: Passing selectedItem state instead of setSelectedItem dispatcher to the selectedItem prop
    return <PDVMobileView user={user} items={items} cart={cart} setCart={setCart} selectedCategory={selectedCategory} setSelectedCategory={setSelectedCategory} selectedProductName={selectedProductName} setSelectedProductName={setSelectedProductName} selectedItem={selectedItem} setSelectedItem={setSelectedItem} selectedMl={selectedMl} setSelectedMl={setSelectedMl} quantity={quantity} setQuantity={setQuantity} paymentMethod={paymentMethod} setPaymentMethod={setPaymentMethod} onAddSales={onAddSales} onCancelSale={onCancelSale} onAddTransaction={onAddTransaction} dailyData={dailySummaryData} handlePrintDailyDRE={() => handlePrintDRE_A4('daily', 'detailed')} handlePrintTicket={handlePrintTicket} financeForm={financeForm} setFinanceForm={setFinanceForm} isSubmitting={isSubmitting} setIsSubmitting={setIsSubmitting} setShowTicketModal={setShowTicketModal} setLastSoldItems={setLastSoldItems} setLastSaleTime={setLastSaleTime} />;
  }

  return (
    <div className="p-4 md:p-8 space-y-4 md:space-y-6 max-w-[1600px] mx-auto min-h-full bg-gray-50 pb-20 md:pb-8">
      {/* HEADER DINÂMICO */}
      <div className="flex flex-col lg:flex-row justify-between items-center gap-4 bg-white p-4 md:p-6 rounded-[32px] shadow-sm border border-gray-100">
        <div className="flex items-center gap-3 w-full lg:w-auto">
          <div className="p-4 bg-gradient-to-br from-blue-700 to-blue-900 rounded-2xl text-white shadow-lg"><IceCream size={24} /></div>
          <div>
            <h2 className="text-xl md:text-2xl font-black text-gray-900 uppercase italic tracking-tighter leading-none">REAL <span className="text-red-600">GELATERIA</span></h2>
            <p className="text-gray-400 text-[9px] font-black uppercase tracking-widest mt-1">Gestão de Vendas e Produção</p>
          </div>
        </div>
        
        <div className="flex bg-gray-100 p-1 rounded-2xl overflow-x-auto no-scrollbar shadow-inner w-full lg:w-auto">
          {[
              {id:'vendas',label:'PDV',icon:ShoppingCart, show: true},
              {id:'estoque',label:'Estoque',icon:Boxes, show: true},
              {id:'dre_diario',label:'DRE Diário',icon:FileText, show: true},
              {id:'dre_mensal',label:'DRE Mensal',icon:BarChart3, show: isAdminOrManager},
              {id:'financeiro',label:'Saídas',icon:ArrowDownCircle, show: true},
              {id:'products',label:'Produtos',icon:Package, show: isAdminOrManager}
          ].filter(t => t.show).map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`flex-1 lg:flex-none flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${activeTab === tab.id ? 'bg-white text-blue-700 shadow-md scale-110' : 'text-gray-500 hover:text-gray-700'}`}>
                <tab.icon size={14}/> <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'vendas' && (
          <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 animate-in slide-in-from-bottom-2 duration-400">
              <div className="xl:col-span-3 space-y-4 md:space-y-6">
                  <div className="bg-white p-3 md:p-6 rounded-[24px] shadow-sm border border-gray-100 overflow-x-auto no-scrollbar flex gap-2">
                      {PRODUCT_CATEGORIES.map(cat => (
                          <button key={cat} onClick={() => { setSelectedCategory(cat); setSelectedProductName(null); setSelectedItem(null); }} className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border-2 flex-shrink-0 ${selectedCategory === cat ? 'bg-blue-600 border-blue-600 text-white shadow-lg' : 'bg-white border-gray-100 text-blue-600'}`}>{cat}</button>
                      ))}
                  </div>

                  {selectedCategory && (
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 md:gap-4">
                          {categoryItems.map(name => (
                              <button key={name} onClick={() => { setSelectedProductName(name); setSelectedItem(null); }} className={`p-6 md:p-8 rounded-[32px] border-2 transition-all flex items-center justify-center text-center font-black uppercase italic text-xs leading-tight ${selectedProductName === name ? 'bg-blue-50 border-blue-600 text-blue-700 shadow-md' : 'bg-white border-gray-100 text-gray-400 hover:border-blue-200'}`}>{name}</button>
                          ))}
                      </div>
                  )}

                  {selectedProductName && (
                      <div className="bg-white p-6 md:p-10 rounded-[40px] shadow-xl border border-gray-100 space-y-6">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                              <div>
                                  <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">Sabor & Estoque</h4>
                                  <div className="grid grid-cols-2 gap-2 md:gap-3">
                                      {itemFlavors.map(item => (
                                          <button key={item.id} onClick={() => setSelectedItem(item)} className={`p-4 md:p-5 rounded-2xl border-2 text-left transition-all relative overflow-hidden ${selectedItem?.id === item.id ? 'bg-red-50 border-red-600 shadow-md' : 'bg-gray-50 border-transparent hover:border-red-200'}`}>
                                              <p className="text-[9px] font-black uppercase text-red-600 mb-1">{item.flavor || 'Padrão'}</p>
                                              <p className="text-lg md:text-xl font-black text-gray-900">{formatCurrency(item.price)}</p>
                                              {item.stockCurrent !== undefined && (
                                                  <div className={`mt-2 text-[8px] font-black uppercase ${item.stockCurrent < 5 ? 'text-red-500 animate-pulse' : 'text-gray-400'}`}>Estoque: {item.stockCurrent.toFixed(2)} {item.unit}</div>
                                              )}
                                          </button>
                                      ))}
                                  </div>
                              </div>
                              <div>
                                  <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">Tamanho (ML)</h4>
                                  <div className="grid grid-cols-3 gap-2">
                                      {ML_OPTIONS.map(ml => (
                                          <button key={ml} onClick={() => setSelectedMl(ml)} className={`py-3 rounded-xl text-[10px] font-bold border-2 transition-all ${selectedMl === ml ? 'bg-gray-900 border-gray-900 text-white shadow-md' : 'bg-white border-gray-100 text-gray-400'}`}>{ml}</button>
                                      ))}
                                  </div>
                              </div>
                          </div>

                          {selectedItem && (
                              <div className="pt-8 border-t border-gray-100 flex flex-col lg:flex-row items-center gap-6">
                                  <div className="flex items-center gap-4 bg-gray-100 p-2 rounded-2xl">
                                      <button onClick={() => setQuantity(Math.max(1, quantity - 1))} className="w-12 h-12 rounded-xl bg-white flex items-center justify-center font-black text-xl shadow-sm">-</button>
                                      <span className="text-2xl font-black w-8 text-center">{quantity}</span>
                                      <button onClick={() => setQuantity(quantity + 1)} className="w-12 h-12 rounded-xl bg-white flex items-center justify-center font-black text-xl shadow-sm">+</button>
                                  </div>
                                  <div className="flex-1"></div>
                                  <button onClick={() => {
                                      if (!selectedItem) { alert("Selecione o produto."); return; }
                                      const newItem: IceCreamDailySale = { id: `cart-${Date.now()}`, itemId: selectedItem.id, productName: selectedItem.name, category: selectedCategory!, flavor: selectedItem.flavor || 'Padrão', ml: selectedMl, unitsSold: quantity, unitPrice: selectedItem.price, totalValue: Number((selectedItem.price * quantity).toFixed(2)), paymentMethod: 'Pix', createdAt: new Date().toISOString(), status: 'active' };
                                      setCart(prev => [...prev, newItem]);
                                      setSelectedItem(null);
                                      setQuantity(1);
                                  }} className="w-full lg:w-auto bg-red-600 text-white px-10 py-5 rounded-2xl font-black uppercase text-xs shadow-2xl hover:bg-red-700 flex items-center justify-center gap-3 transition-transform active:scale-95"><Plus size={20}/> Adicionar ao Carrinho</button>
                              </div>
                          )}
                      </div>
                  )}
              </div>

              <div className="bg-gray-900 rounded-[40px] p-6 md:p-8 text-white shadow-2xl flex flex-col h-fit sticky top-6">
                  <h3 className="text-xl font-black uppercase italic tracking-tighter mb-8 text-center border-b border-white/10 pb-4">Checkout Final</h3>
                  
                  <div className="space-y-4 mb-8 max-h-[300px] overflow-y-auto no-scrollbar">
                      {cart.map((item, idx) => (
                          <div key={item.id} className="flex items-center justify-between bg-white/5 p-4 rounded-2xl border border-white/5 animate-in slide-in-from-right duration-300">
                              <div className="flex-1">
                                  <p className="text-[9px] font-black text-red-500 uppercase">{item.category} • {item.ml}</p>
                                  <p className="font-black uppercase italic text-xs leading-none my-1 truncate w-40">{item.productName}</p>
                                  <p className="text-[9px] font-bold text-gray-400">{item.unitsSold}x {formatCurrency(item.unitPrice)}</p>
                              </div>
                              <button onClick={() => setCart(prev => prev.filter((_, i) => i !== idx))} className="p-2 text-gray-600 hover:text-red-500 transition-colors"><Trash2 size={16}/></button>
                          </div>
                      ))}
                      {cart.length === 0 && (
                        <div className="text-center py-10 opacity-20">
                            <ShoppingCart size={40} className="mx-auto mb-2" />
                            <p className="text-[9px] font-black uppercase tracking-widest">Carrinho Vazio</p>
                        </div>
                      )}
                  </div>

                  {cart.length > 0 && (
                    <div className="pt-6 border-t border-white/10 space-y-6">
                        <div className="space-y-3">
                            <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest block text-center">Forma de Pagamento</label>
                            <div className="grid grid-cols-3 gap-2">
                                {(['Pix', 'Cartão', 'Dinheiro'] as IceCreamPaymentMethod[]).map(pm => (
                                    <button key={pm} onClick={() => setPaymentMethod(pm)} className={`py-3 rounded-xl flex flex-col items-center gap-1 border-2 transition-all ${paymentMethod === pm ? 'bg-blue-600 border-blue-600 text-white shadow-lg' : 'bg-white/5 border-white/10 text-gray-500'}`}>
                                        {pm === 'Pix' ? <Hash size={14}/> : pm === 'Cartão' ? <CreditCard size={14}/> : <Banknote size={14}/>}
                                        <span className="text-[8px] font-black uppercase">{pm}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="flex justify-between items-end">
                            <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Total</span>
                            <span className="text-3xl font-black tracking-tighter italic text-white">{formatCurrency(cart.reduce((a, b) => a + b.totalValue, 0))}</span>
                        </div>

                        <button 
                            onClick={async () => {
                                if (cart.length === 0) return;
                                if (!paymentMethod) { alert("Selecione a forma de pagamento."); return; }
                                setIsSubmitting(true);
                                try {
                                    const finalCart = cart.map(item => ({ ...item, paymentMethod }));
                                    await onAddSales(finalCart);
                                    setCart([]); 
                                    alert("Venda realizada!");
                                } finally { setIsSubmitting(false); }
                            }} 
                            disabled={cart.length === 0 || isSubmitting || !paymentMethod} 
                            className="w-full py-5 bg-red-600 hover:bg-red-700 disabled:bg-gray-800 disabled:opacity-50 rounded-2xl font-black uppercase text-xs shadow-2xl flex items-center justify-center gap-3 transition-all active:scale-95 border-b-4 border-red-900"
                        >
                            {isSubmitting ? (
                                <><Loader2 className="animate-spin" size={18}/> Processando...</>
                            ) : (
                                <><CheckCircle2 size={18}/> Finalizar Venda</>
                            )}
                        </button>
                    </div>
                  )}
              </div>
          </div>
      )}

      {activeTab === 'dre_diario' && (
          <div className="space-y-6 animate-in fade-in duration-500">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-white p-8 rounded-[40px] shadow-sm border border-gray-100 flex items-center justify-between">
                      <div>
                          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Vendas Hoje</p>
                          <p className="text-3xl font-black text-green-600 italic">{formatCurrency(dailySummaryData.totalEntries)}</p>
                      </div>
                      <div className="p-4 bg-green-50 text-green-600 rounded-3xl"><ArrowUpCircle size={32}/></div>
                  </div>
                  <div className="bg-white p-8 rounded-[40px] shadow-sm border border-gray-100 flex items-center justify-between">
                      <div>
                          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Saídas Hoje</p>
                          <p className="text-3xl font-black text-red-600 italic">{formatCurrency(dailySummaryData.totalExits)}</p>
                      </div>
                      <div className="p-4 bg-red-50 text-red-600 rounded-3xl"><ArrowDownCircle size={32}/></div>
                  </div>
                  <div className="bg-gray-900 p-8 rounded-[40px] shadow-2xl text-white flex items-center justify-between">
                      <div>
                          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Resultado do Dia</p>
                          <p className="text-3xl font-black italic">{formatCurrency(dailySummaryData.result)}</p>
                      </div>
                      <div className="p-4 bg-white/10 text-white rounded-3xl shadow-inner"><Calculator size={32}/></div>
                  </div>
              </div>

              <div className="bg-white rounded-[40px] shadow-sm border border-gray-100 overflow-hidden">
                  <div className="p-8 border-b flex justify-between items-center bg-gray-50/50">
                      <h3 className="text-xl font-black text-gray-900 uppercase italic tracking-tighter">Movimentação Diária <span className="text-blue-700">Auditada</span></h3>
                      <div className="flex items-center gap-3">
                          <button onClick={() => handlePrintDRE_A4('daily', 'detailed')} className="flex items-center gap-2 bg-gray-950 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase hover:bg-black transition-all shadow-md"><Printer size={16}/> Relatório A4</button>
                      </div>
                  </div>
                  <div className="overflow-x-auto">
                      <table className="w-full text-left">
                          <thead>
                              <tr className="bg-gray-950 text-white text-[10px] font-black uppercase tracking-widest">
                                  <th className="px-8 py-4">Hora</th>
                                  <th className="px-8 py-4">Código</th>
                                  <th className="px-8 py-4">Operação</th>
                                  <th className="px-8 py-4 text-right">Valor</th>
                                  <th className="px-8 py-4">Pagto/Cat</th>
                                  <th className="px-8 py-4">Status</th>
                                  <th className="px-8 py-4 w-10"></th>
                              </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-50">
                              {dailySummaryData.allDaySales.map(s => (
                                  <tr key={s.id} className={`hover:bg-gray-50 transition-colors ${s.status === 'canceled' ? 'opacity-40 grayscale italic' : ''}`}>
                                      <td className="px-8 py-5 text-xs text-gray-500 font-mono">{new Date(s.createdAt!).toLocaleTimeString('pt-BR')}</td>
                                      <td className="px-8 py-5 font-bold text-xs">{s.saleCode}</td>
                                      <td className="px-8 py-5 font-black uppercase text-xs">Venda: {s.productName}</td>
                                      <td className="px-8 py-5 text-right font-black text-xs text-green-600">{formatCurrency(s.totalValue)}</td>
                                      <td className="px-8 py-5 text-[10px] font-black uppercase text-gray-400">{s.paymentMethod}</td>
                                      <td className="px-8 py-5">
                                          {s.status === 'canceled' ? (
                                              <span className="text-[10px] font-black text-red-600 bg-red-50 px-3 py-1 rounded-full uppercase">Cancelada</span>
                                          ) : (
                                              <span className="text-[10px] font-black text-green-600 bg-green-50 px-3 py-1 rounded-full uppercase">Concluída</span>
                                          )}
                                      </td>
                                      <td className="px-8 py-5 text-right">
                                          {isAdminOrManager && s.status !== 'canceled' && (
                                              <button onClick={() => handleCancelSaleConfirmed(s.saleCode || '')} className="p-2 text-gray-300 hover:text-red-500 transition-all"><Trash2 size={16}/></button>
                                          )}
                                      </td>
                                  </tr>
                              ))}
                              {dailySummaryData.allDayExits.map(f => (
                                  <tr key={f.id} className="hover:bg-red-50/20 transition-colors">
                                      <td className="px-8 py-5 text-xs text-gray-500 font-mono">---</td>
                                      <td className="px-8 py-5 font-bold text-xs">SAIDA</td>
                                      <td className="px-8 py-5 font-black uppercase text-xs text-red-700">Despesa: {f.description || 'Geral'}</td>
                                      <td className="px-8 py-5 text-right font-black text-xs text-red-600">({formatCurrency(f.value)})</td>
                                      <td className="px-8 py-5 text-[10px] font-black uppercase text-gray-400">{f.category}</td>
                                      <td className="px-8 py-5"><span className="text-[10px] font-black text-blue-600 bg-blue-50 px-3 py-1 rounded-full uppercase">Lançada</span></td>
                                      <td className="px-8 py-5 text-right">
                                          {isAdminOrManager && (
                                              <button onClick={() => onDeleteTransaction(f.id)} className="p-2 text-gray-200 hover:text-red-500 transition-all"><Trash2 size={16}/></button>
                                          )}
                                      </td>
                                  </tr>
                              ))}
                              {dailySummaryData.allDaySales.length === 0 && dailySummaryData.allDayExits.length === 0 && (
                                  <tr><td colSpan={7} className="px-8 py-20 text-center text-gray-400 font-black uppercase italic tracking-widest">Nenhuma movimentação hoje</td></tr>
                              )}
                          </tbody>
                      </table>
                  </div>
              </div>
          </div>
      )}

      {activeTab === 'dre_mensal' && isAdminOrManager && (
          <div className="space-y-6 animate-in fade-in duration-500">
              <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-6 rounded-[32px] shadow-sm border border-gray-100">
                <div className="flex flex-wrap items-center gap-4">
                    <div className="flex items-center gap-2">
                        <CalendarDays className="text-blue-600" size={20}/>
                        <span className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Período de Referência</span>
                    </div>
                    <select value={monthlyFilterMonth} onChange={e => setMonthlyFilterMonth(e.target.value)} className="bg-gray-50 border-none rounded-xl px-4 py-2 font-black text-xs uppercase focus:ring-2 focus:ring-blue-100 outline-none cursor-pointer">
                        {MONTHS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                    </select>
                    <select value={monthlyFilterYear} onChange={e => setMonthlyFilterYear(e.target.value)} className="bg-gray-50 border-none rounded-xl px-4 py-2 font-black text-xs uppercase focus:ring-2 focus:ring-blue-100 outline-none cursor-pointer">
                        {availableYears.map(y => <option key={y} value={y.toString()}>{y}</option>)}
                    </select>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => handlePrintDRE_A4('monthly', 'summary')} className="flex items-center gap-2 bg-blue-700 text-white px-6 py-3 rounded-xl text-[10px] font-black uppercase hover:bg-blue-800 transition-all shadow-md"><Printer size={16}/> Resumo A4</button>
                    <button onClick={() => handlePrintDRE_A4('monthly', 'detailed')} className="flex items-center gap-2 bg-gray-950 text-white px-6 py-3 rounded-xl text-[10px] font-black uppercase hover:bg-black transition-all shadow-md"><Printer size={16}/> Detalhado A4</button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-white p-8 rounded-[40px] shadow-sm border border-gray-100 flex items-center justify-between">
                      <div>
                          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Vendas do Mês</p>
                          <p className="text-3xl font-black text-gray-900">{formatCurrency(monthlySummaryData.totalEntries)}</p>
                      </div>
                      <div className="p-4 bg-green-50 text-green-600 rounded-3xl"><TrendingUp size={32}/></div>
                  </div>
                  <div className="bg-white p-8 rounded-[40px] shadow-sm border border-gray-100 flex items-center justify-between">
                      <div>
                          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Saídas do Mês</p>
                          <p className="text-3xl font-black text-gray-900">{formatCurrency(monthlySummaryData.totalExits)}</p>
                      </div>
                      <div className="p-4 bg-red-50 text-red-600 rounded-3xl"><TrendingDown size={32}/></div>
                  </div>
                  <div className="bg-gray-900 p-8 rounded-[40px] shadow-2xl text-white flex items-center justify-between">
                      <div>
                          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Resultado Líquido</p>
                          <p className="text-3xl font-black italic">{formatCurrency(monthlySummaryData.result)}</p>
                      </div>
                      <div className="p-4 bg-white/10 text-white rounded-3xl shadow-inner"><DollarSign size={32}/></div>
                  </div>
              </div>

              <div className="bg-white p-8 rounded-[40px] shadow-sm border border-gray-100">
                  <h4 className="text-sm font-black text-gray-400 uppercase tracking-widest mb-6 flex items-center gap-2"><PieChart size={18}/> Distribuição de Lucros do Período</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="p-6 bg-blue-50 rounded-3xl border border-blue-100">
                          <p className="text-[9px] font-black text-blue-400 uppercase mb-1">Luciene + Regis (63,33%)</p>
                          <p className="text-2xl font-black text-blue-900">{formatCurrency(monthlySummaryData.result * 0.6333)}</p>
                      </div>
                      <div className="p-6 bg-purple-50 rounded-3xl border border-purple-100">
                          <p className="text-[9px] font-black text-purple-400 uppercase mb-1">Ademir (26,67%)</p>
                          <p className="text-2xl font-black text-purple-900">{formatCurrency(monthlySummaryData.result * 0.2667)}</p>
                      </div>
                      <div className="p-6 bg-orange-50 rounded-3xl border border-orange-100">
                          <p className="text-[9px] font-black text-orange-400 uppercase mb-1">Junior (10,00%)</p>
                          <p className="text-2xl font-black text-orange-900">{formatCurrency(monthlySummaryData.result * 0.10)}</p>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {activeTab === 'financeiro' && (
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 animate-in fade-in duration-500">
              <div className="xl:col-span-1 bg-white p-8 rounded-[40px] shadow-xl border border-gray-100 h-fit">
                  <h3 className="text-xl font-black text-gray-900 uppercase italic tracking-tighter mb-8 flex items-center gap-3"><ArrowDownCircle className="text-red-600" size={24}/> Registrar Saída</h3>
                  <form onSubmit={async (e) => {
                    e.preventDefault();
                    const val = parseFloat(financeForm.value.replace(/\./g, '').replace(',', '.'));
                    if (!val || isNaN(val)) return;
                    setIsSubmitting(true);
                    try {
                        await onAddTransaction({ id: '', date: financeForm.date, type: 'exit', category: financeForm.category, value: val, employeeName: financeForm.employeeName, description: financeForm.description, createdAt: new Date() });
                        setFinanceForm({ ...financeForm, value: '', employeeName: '', description: '' });
                    } finally { setIsSubmitting(false); }
                  }} className="space-y-5">
                      <div><label className="text-[9px] font-black uppercase text-gray-400 block mb-2">Categoria de Despesa</label><select value={financeForm.category} onChange={e => setFinanceForm({...financeForm, category: e.target.value as any})} className="w-full p-4 bg-gray-50 border-none rounded-2xl font-black text-xs uppercase focus:ring-4 focus:ring-red-100 transition-all shadow-inner">{EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
                      <div><label className="text-[9px] font-black uppercase text-gray-400 block mb-2">Valor (R$)</label><input value={financeForm.value} onChange={e => setFinanceForm({...financeForm, value: e.target.value})} placeholder="0,00" className="w-full p-4 bg-gray-50 border-none rounded-2xl font-black text-2xl text-red-600 focus:ring-4 focus:ring-red-100 transition-all shadow-inner" /></div>
                      <div><label className="text-[9px] font-black uppercase text-gray-400 block mb-2">Nome do Colaborador</label><input value={financeForm.employeeName} onChange={e => setFinanceForm({...financeForm, employeeName: e.target.value})} placeholder="Para quem?" className="w-full p-4 bg-gray-50 border-none rounded-2xl font-bold text-xs uppercase focus:ring-4 focus:ring-red-100 transition-all shadow-inner" /></div>
                      <div><label className="text-[9px] font-black uppercase text-gray-400 block mb-2">Descrição / Observação</label><textarea value={financeForm.description} onChange={e => setFinanceForm({...financeForm, description: e.target.value})} placeholder="Ex: Adiantamento mensal" className="w-full p-4 bg-gray-50 border-none rounded-2xl font-medium text-xs focus:ring-4 focus:ring-red-100 transition-all shadow-inner resize-none h-24" /></div>
                      <button type="submit" disabled={isSubmitting} className="w-full py-5 bg-red-600 hover:bg-red-700 text-white rounded-2xl font-black uppercase text-xs shadow-xl flex items-center justify-center gap-3 transition-all active:scale-95 border-b-4 border-red-900">{isSubmitting ? <Loader2 className="animate-spin" size={20}/> : <Save size={20}/>}</button>
                  </form>
              </div>
              <div className="xl:col-span-2 bg-white rounded-[40px] shadow-sm border border-gray-100 overflow-hidden flex flex-col h-[700px]">
                  <div className="p-8 border-b bg-gray-50/50 flex flex-col gap-4">
                      <div className="flex justify-between items-center">
                        <h3 className="text-xl font-black text-gray-900 uppercase italic tracking-tighter">Histórico de <span className="text-red-600">Saídas</span></h3>
                        <div className="bg-red-50 text-red-700 px-4 py-2 rounded-xl text-xs font-black uppercase italic">Total: {formatCurrency(filteredFinances.reduce((acc,f)=>acc+f.value,0))}</div>
                      </div>
                      
                      <div className="flex items-center gap-3 bg-white p-2 rounded-2xl border border-gray-200 shadow-inner w-fit">
                        <CalendarDays size={18} className="text-gray-400 ml-2" />
                        <select value={expenseFilterMonth} onChange={e => setExpenseFilterMonth(e.target.value)} className="bg-transparent border-none text-[10px] font-black uppercase outline-none cursor-pointer">
                            {MONTHS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                        </select>
                        <select value={expenseFilterYear} onChange={e => setExpenseFilterYear(e.target.value)} className="bg-transparent border-none text-[10px] font-black uppercase outline-none cursor-pointer">
                            {availableYears.map(y => <option key={y} value={y.toString()}>{y}</option>)}
                        </select>
                      </div>
                  </div>
                  <div className="overflow-y-auto no-scrollbar flex-1">
                      <table className="w-full text-left">
                          <thead className="bg-gray-950 text-white text-[9px] font-black uppercase tracking-widest sticky top-0 z-10">
                              <tr>
                                  <th className="px-8 py-4">Data</th>
                                  <th className="px-8 py-4">Categoria</th>
                                  <th className="px-8 py-4">Beneficiário</th>
                                  <th className="px-8 py-4 text-right">Valor</th>
                                  <th className="px-8 py-4 w-16"></th>
                              </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-50">
                              {filteredFinances.map(f => (
                                  <tr key={f.id} className="hover:bg-red-50/30 transition-colors group">
                                      <td className="px-8 py-5 text-xs text-gray-500 font-mono">{new Date(f.date + 'T12:00:00').toLocaleDateString('pt-BR')}</td>
                                      <td className="px-8 py-5 font-black uppercase text-[10px] text-red-600">{f.category}</td>
                                      <td className="px-8 py-5 font-bold text-xs uppercase">{f.employeeName || '-'}</td>
                                      <td className="px-8 py-5 text-right font-black text-xs text-red-600">{formatCurrency(f.value)}</td>
                                      <td className="px-8 py-5 text-right">
                                          <button onClick={() => onDeleteTransaction(f.id)} className="p-2 text-gray-200 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"><Trash2 size={16}/></button>
                                      </td>
                                  </tr>
                              ))}
                          </tbody>
                      </table>
                  </div>
              </div>
          </div>
      )}

      {activeTab === 'products' && isAdminOrManager && (
          <div className="space-y-6 animate-in fade-in duration-500">
              <div className="flex flex-col md:flex-row justify-between items-center gap-6 bg-white p-8 rounded-[40px] shadow-sm border border-gray-100">
                  <div>
                      <h3 className="text-xl font-black text-gray-900 uppercase italic tracking-tighter">Catálogo de <span className="text-blue-700">Produtos</span></h3>
                      <p className="text-gray-400 text-[9px] font-black uppercase tracking-widest mt-1">Configuração de Itens e Preços</p>
                  </div>
                  <button onClick={() => { setEditingItem(null); setProductForm({ name: '', category: 'Sundae', flavor: '', price: '', active: true, stockInitial: '0', unit: 'un', consumptionPerSale: '1' }); setIsProductModalOpen(true); }} className="px-8 py-4 bg-gray-950 text-white rounded-xl font-black uppercase text-[10px] flex items-center gap-2 hover:bg-black shadow-lg shadow-gray-200 transition-all">
                      <Plus size={16}/> Novo Produto
                  </button>
              </div>
              <div className="bg-white rounded-[40px] shadow-sm border border-gray-100 overflow-hidden">
                  <table className="w-full text-left">
                      <thead>
                          <tr className="bg-gray-950 text-white text-[9px] font-black uppercase tracking-widest">
                              <th className="px-8 py-4">Status</th>
                              <th className="px-8 py-4">Categoria</th>
                              <th className="px-8 py-4">Nome do Produto</th>
                              <th className="px-8 py-4">Sabor / Var.</th>
                              <th className="px-8 py-4 text-right">Preço</th>
                              <th className="px-8 py-4 text-center">Estoque</th>
                              <th className="px-8 py-4 text-right">Ações</th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                          {items.map(item => (
                              <tr key={item.id} className={`hover:bg-gray-50 transition-colors ${!item.active ? 'opacity-40 grayscale' : ''}`}>
                                  <td className="px-8 py-5"><div className={`w-3 h-3 rounded-full ${item.active ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]' : 'bg-gray-300'}`}></div></td>
                                  <td className="px-8 py-5 font-black uppercase text-[10px] text-blue-700">{item.category}</td>
                                  <td className="px-8 py-5 font-black uppercase text-xs italic">{item.name}</td>
                                  <td className="px-8 py-5 font-bold text-xs text-gray-400 uppercase">{item.flavor || '-'}</td>
                                  <td className="px-8 py-5 text-right font-black text-xs text-gray-900">{formatCurrency(item.price)}</td>
                                  <td className="px-8 py-5 text-center font-bold text-xs">{item.stockCurrent?.toFixed(2)} {item.unit}</td>
                                  <td className="px-8 py-5 text-right">
                                      <div className="flex justify-end gap-2">
                                          <button onClick={() => { setEditingItem(item); setProductForm({ name: item.name, category: item.category, flavor: item.flavor || '', price: item.price.toString(), active: item.active, stockInitial: item.stockInitial?.toString() || '0', unit: item.unit || 'un', consumptionPerSale: item.consumptionPerSale?.toString() || '1' }); setIsProductModalOpen(true); }} className="p-2 text-blue-600 hover:bg-blue-50 rounded-xl transition-all"><Edit3 size={18}/></button>
                                          <button onClick={() => onDeleteItem(item.id)} className="p-2 text-red-400 hover:bg-red-50 rounded-xl transition-all"><Trash2 size={18}/></button>
                                      </div>
                                  </td>
                              </tr>
                          ))}
                      </tbody>
                  </table>
              </div>
          </div>
      )}

      {activeTab === 'estoque' && (
          <div className="space-y-6 animate-in fade-in duration-500">
             <div className="flex flex-col md:flex-row justify-between items-center gap-6 bg-white p-8 rounded-[40px] shadow-sm border border-gray-100">
                  <div>
                      <h3 className="text-xl font-black text-gray-900 uppercase italic tracking-tighter">Inventário de <span className="text-blue-700">Insumos</span></h3>
                      <p className="text-gray-400 text-[9px] font-black uppercase tracking-widest mt-1">Gestão de Entrada e Saída de Produtos</p>
                  </div>
                  {isAdminOrManager && (
                      <button onClick={() => setIsStockAdjustmentModalOpen(true)} className="px-8 py-4 bg-gray-950 text-white rounded-xl font-black uppercase text-[10px] flex items-center gap-2 hover:bg-black shadow-lg shadow-gray-200 transition-all">
                          <RefreshCw size={16}/> Ajuste de Estoque
                      </button>
                  )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {items.filter(i => i.active).map(item => {
                      const lowStock = (item.stockCurrent || 0) < 5;
                      return (
                          <div key={item.id} className={`p-6 bg-white rounded-[32px] border-2 shadow-sm transition-all group hover:shadow-xl ${lowStock ? 'border-red-100 bg-red-50/20' : 'border-gray-50'}`}>
                              <div className="flex justify-between items-start mb-4">
                                  <div className={`p-3 rounded-2xl ${lowStock ? 'bg-red-100 text-red-600' : 'bg-blue-50 text-blue-600'}`}><Package size={24}/></div>
                                  {lowStock && <AlertTriangle size={20} className="text-red-500 animate-pulse" />}
                              </div>
                              <h4 className="font-black uppercase italic text-xs text-gray-900 truncate">{item.name}</h4>
                              <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">{item.category}</p>
                              <div className="mt-6 flex items-end justify-between">
                                  <div>
                                      <p className="text-[8px] font-black text-gray-400 uppercase">Saldo Atual</p>
                                      <p className={`text-2xl font-black italic tracking-tighter ${lowStock ? 'text-red-600' : 'text-blue-900'}`}>{item.stockCurrent?.toFixed(2)} <span className="text-xs not-italic font-bold uppercase">{item.unit}</span></p>
                                  </div>
                                  <div className="w-16 h-1 bg-gray-100 rounded-full overflow-hidden"><div className={`h-full ${lowStock ? 'bg-red-500' : 'bg-blue-500'}`} style={{ width: `${Math.min(100, ((item.stockCurrent || 0) / (item.stockInitial || 100)) * 100)}%` }} /></div>
                              </div>
                          </div>
                      );
                  })}
              </div>
          </div>
      )}

      {/* MODAL RECIBO (TICKET) */}
      {showTicketModal && (
          <div className="fixed inset-0 bg-black/90 backdrop-blur-xl flex items-center justify-center z-[200] p-4">
              <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in duration-300 flex flex-col items-center">
                  <div className="p-8 text-center bg-green-50 w-full border-b border-green-100">
                      <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center text-white mx-auto mb-4 shadow-lg"><CheckCircle2 size={32} /></div>
                      <h3 className="text-xl font-black text-green-900 uppercase italic tracking-tighter">Sucesso!</h3>
                      <p className="text-[10px] font-black text-green-600 uppercase tracking-widest mt-1">Código: {lastSoldItems[0]?.saleCode}</p>
                  </div>
                  <div className="p-8 w-full">
                      <div className="bg-gray-50 p-6 rounded-2xl border-2 border-dashed border-gray-300 font-mono text-[11px] text-gray-700 space-y-3 shadow-inner">
                          <div style={{ textAlign: 'center', fontWeight: 'bold', borderBottom: '1px solid #ddd', paddingBottom: '4px', marginBottom: '8px' }}>CÓDIGO DA VENDA: {lastSoldItems[0]?.saleCode}</div>
                          {lastSoldItems.map((it, idx) => (
                            <div key={idx} className="flex justify-between font-black uppercase italic">
                                <span className="truncate w-32">{it.unitsSold}x {it.productName}</span>
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
                          <button onClick={() => handlePrintTicket(lastSoldItems, lastSaleTime)} className="w-full py-4 bg-gray-950 text-white rounded-2xl font-black uppercase text-xs flex items-center justify-center gap-3 shadow-xl hover:bg-black transition-all"><Printer size={18} /> Imprimir Cupom</button>
                          <button onClick={() => setShowTicketModal(false)} className="w-full py-4 bg-gray-100 text-gray-400 rounded-2xl font-black uppercase text-xs hover:bg-gray-200 transition-all">Fechar</button>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* MODAL PRODUTO */}
      {isProductModalOpen && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[150] p-4 backdrop-blur-md">
              <div className="bg-white rounded-[48px] shadow-2xl w-full max-w-md p-8 animate-in zoom-in duration-200">
                  <div className="flex justify-between items-center mb-6">
                      <h3 className="text-xl font-black text-gray-900 uppercase italic tracking-tighter">{editingItem ? 'Editar' : 'Novo'} <span className="text-blue-700">Produto</span></h3>
                      <button onClick={() => setIsProductModalOpen(false)} className="text-gray-400 hover:text-red-600 transition-colors"><X size={24}/></button>
                  </div>
                  <form onSubmit={async (e) => {
                      e.preventDefault();
                      setIsSubmitting(true);
                      try {
                          if (editingItem) {
                              await onUpdateItem({ ...editingItem, name: productForm.name, category: productForm.category, flavor: productForm.flavor, price: parseFloat(productForm.price.replace(',','.')), active: productForm.active, stockInitial: parseFloat(productForm.stockInitial), unit: productForm.unit, consumptionPerSale: parseFloat(productForm.consumptionPerSale) });
                          } else {
                              await onAddItem(productForm.name, productForm.category, parseFloat(productForm.price.replace(',','.')), productForm.flavor, parseFloat(productForm.stockInitial), productForm.unit, parseFloat(productForm.consumptionPerSale));
                          }
                          setIsProductModalOpen(false);
                      } finally { setIsSubmitting(false); }
                  }} className="space-y-4">
                      <input required value={productForm.name} onChange={e => setProductForm({...productForm, name: e.target.value})} className="w-full px-4 py-3 bg-gray-50 rounded-xl font-black text-xs uppercase" placeholder="Nome do Produto" />
                      <div className="grid grid-cols-2 gap-4">
                          <select value={productForm.category} onChange={e => setProductForm({...productForm, category: e.target.value as any})} className="w-full px-4 py-3 bg-gray-50 rounded-xl font-black text-[10px] uppercase">
                              {PRODUCT_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                          <input required value={productForm.price} onChange={e => setProductForm({...productForm, price: e.target.value})} className="w-full px-4 py-3 bg-gray-50 rounded-xl font-black text-xs" placeholder="Preço 0,00" />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <input value={productForm.unit} onChange={e => setProductForm({...productForm, unit: e.target.value})} className="w-full px-4 py-3 bg-gray-50 rounded-xl font-black text-xs uppercase" placeholder="Unidade (Ex: un, kg)" />
                        <input value={productForm.stockInitial} onChange={e => setProductForm({...productForm, stockInitial: e.target.value})} className="w-full px-4 py-3 bg-gray-50 rounded-xl font-black text-xs" placeholder="Estoque Inicial" />
                      </div>
                      <button type="submit" disabled={isSubmitting} className="w-full py-4 bg-blue-700 text-white rounded-2xl font-black uppercase text-xs shadow-lg flex items-center justify-center gap-2">{isSubmitting ? <Loader2 className="animate-spin" size={14}/> : <Save size={14}/>} {editingItem ? 'Atualizar' : 'Salvar'} Produto</button>
                  </form>
              </div>
          </div>
      )}

      {/* MODAL AJUSTE ESTOQUE */}
      {isStockAdjustmentModalOpen && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[150] p-4 backdrop-blur-md">
              <div className="bg-white rounded-[48px] shadow-2xl w-full max-w-md p-8 animate-in zoom-in duration-200">
                  <div className="flex justify-between items-center mb-6">
                      <h3 className="text-xl font-black text-gray-900 uppercase italic tracking-tighter">Ajuste de <span className="text-blue-700">Inventário</span></h3>
                      <button onClick={() => setIsStockAdjustmentModalOpen(false)} className="text-gray-400 hover:text-red-600 transition-colors"><X size={24}/></button>
                  </div>
                  <form onSubmit={async (e) => {
                      e.preventDefault();
                      setIsSubmitting(true);
                      try {
                          await onUpdateStock(stockForm.itemId, parseFloat(stockForm.qty.replace(',','.')), stockForm.type, stockForm.reason);
                          setIsStockAdjustmentModalOpen(false);
                          setStockForm({ itemId: '', qty: '', type: 'restock', reason: '' });
                      } finally { setIsSubmitting(false); }
                  }} className="space-y-4">
                      <select required value={stockForm.itemId} onChange={e => setStockForm({...stockForm, itemId: e.target.value})} className="w-full px-4 py-3 bg-gray-50 rounded-xl font-black text-xs uppercase">
                          <option value="">Selecione o Item...</option>
                          {items.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                      </select>
                      <div className="grid grid-cols-2 gap-4">
                        <input required value={stockForm.qty} onChange={e => setStockForm({...stockForm, qty: e.target.value})} className="w-full px-4 py-3 bg-gray-50 rounded-xl font-black text-xs" placeholder="Quantidade" />
                        <select value={stockForm.type} onChange={e => setStockForm({...stockForm, type: e.target.value as any})} className="w-full px-4 py-3 bg-gray-50 rounded-xl font-black text-[10px] uppercase">
                            <option value="restock">Entrada (+)</option>
                            <option value="adjustment">Saldo Real (=)</option>
                        </select>
                      </div>
                      <input required value={stockForm.reason} onChange={e => setStockForm({...stockForm, reason: e.target.value})} className="w-full px-4 py-3 bg-gray-50 rounded-xl font-black text-xs uppercase" placeholder="Motivo / Referência" />
                      <button type="submit" disabled={isSubmitting} className="w-full py-4 bg-gray-900 text-white rounded-2xl font-black uppercase text-xs shadow-lg flex items-center justify-center gap-2">{isSubmitting ? <Loader2 className="animate-spin" size={14}/> : <RefreshCw size={14}/>} Confirmar Ajuste</button>
                  </form>
              </div>
          </div>
      )}
    </div>
  );
};

export default IceCreamModule;