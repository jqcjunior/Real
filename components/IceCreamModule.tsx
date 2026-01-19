
import React, { useState, useMemo, useEffect } from 'react';
import { IceCreamItem, IceCreamDailySale, IceCreamTransaction, IceCreamCategory, IceCreamPaymentMethod, User, UserRole, Store, IceCreamStock, IceCreamPromissoryNote, IceCreamRecipeItem, StoreProfitPartner } from '../types';
import { formatCurrency, BRAND_LOGO } from '../constants';
import { 
    IceCream, Plus, Package, ShoppingCart, CheckCircle2, 
    Trash2, X, History, PieChart, ArrowDownCircle, ArrowUpCircle, 
    Loader2, Search, Trash, ChevronRight, Calculator, FileText, Ban, UserCheck, Save, Image as ImageIcon, Sliders, Settings, Calendar, BarChart3, ListChecks, TrendingUp, TrendingDown, DollarSign, Wallet, CreditCard, Banknote, PackagePlus, Printer, ClipboardList, AlertCircle, Info, ToggleLeft, ToggleRight, Receipt, ArrowRight,
    Users as UsersIcon, ShieldCheck, UserCog, Clock, FileBarChart, Users, Handshake, AlertTriangle, Zap, Beaker, Layers, Clipboard, Edit3, Filter, ChevronDown, FilePieChart
} from 'lucide-react';
import PDVMobileView from './PDVMobileView';
import { supabase } from '../services/supabaseClient';
import { PermissionKey } from '../security/permissions';

interface IceCreamModuleProps {
  user: User;
  stores: Store[];
  items: IceCreamItem[];
  stock: IceCreamStock[];
  sales: IceCreamDailySale[];
  finances: IceCreamTransaction[];
  promissories: IceCreamPromissoryNote[];
  can: (p: PermissionKey) => boolean;
  onAddSales: (sale: IceCreamDailySale[]) => Promise<void>;
  onCancelSale: (saleCode: string, reason: string) => Promise<void>;
  onUpdatePrice: (id: string, price: number) => Promise<void>;
  onAddTransaction: (tx: IceCreamTransaction) => Promise<void>;
  onAddItem: (name: string, category: string, price: number, flavor?: string, stockInitial?: number, unit?: string, consumptionPerSale?: number, targetStoreId?: string, recipe?: IceCreamRecipeItem[]) => Promise<void>;
  onDeleteItem: (id: string) => Promise<void>;
  onUpdateStock: (storeId: string, base: string, value: number, unit: string, type: 'production' | 'adjustment') => Promise<void>;
  liquidatePromissory: (id: string) => Promise<void>;
}

const PRODUCT_CATEGORIES: IceCreamCategory[] = ['Sundae', 'Milkshake', 'Casquinha', 'Cascão', 'Cascão Trufado', 'Copinho', 'Bebidas', 'Adicionais'].sort() as IceCreamCategory[];
const STOCK_UNITS = ['Unidade', 'Litro', 'Pacote', 'Caixa', 'Balde'];
const MONTHS = [
  { value: 1, label: 'Janeiro' }, { value: 2, label: 'Fevereiro' }, { value: 3, label: 'Março' },
  { value: 4, label: 'Abril' }, { value: 5, label: 'Maio' }, { value: 6, label: 'Junho' },
  { value: 7, label: 'Julho' }, { value: 8, label: 'Agosto' }, { value: 9, label: 'Setembro' },
  { value: 10, label: 'Outubro' }, { value: 11, label: 'Novembro' }, { value: 12, label: 'Dezembro' }
];

const IceCreamModule: React.FC<IceCreamModuleProps> = ({ 
    user, stores = [], items = [], stock = [], sales = [], finances = [], promissories = [], can,
    onAddSales, onCancelSale, onUpdatePrice, onAddTransaction, onAddItem, onDeleteItem, onUpdateStock,
    liquidatePromissory
}) => {
  const [activeTab, setActiveTab] = useState<'pdv' | 'estoque' | 'dre_diario' | 'dre_mensal' | 'audit' | 'produtos'>('pdv');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cart, setCart] = useState<IceCreamDailySale[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<IceCreamCategory | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<IceCreamPaymentMethod | null>(null);
  const [buyerName, setBuyerName] = useState('');
  const [amountReceived, setAmountReceived] = useState('');
  
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const [showProductModal, setShowProductModal] = useState(false);
  const [showTransactionModal, setShowTransactionModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showNewStockModal, setShowNewStockModal] = useState(false);
  const [showInwardStockModal, setShowInwardStockModal] = useState(false);
  const [showInventoryModal, setShowInventoryModal] = useState(false);
  const [showPartnersModal, setShowPartnersModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState<{code: string} | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  
  const [partners, setPartners] = useState<StoreProfitPartner[]>([]);
  const [newPartner, setNewPartner] = useState({ name: '', percentage: '' });
  const [bulkStockData, setBulkStockData] = useState<Record<string, string>>({});
  const [editingStockItem, setEditingStockItem] = useState<IceCreamStock | null>(null);
  const [editingProduct, setEditingProduct] = useState<IceCreamItem | null>(null);

  const [expenseCategories, setExpenseCategories] = useState<string[]>(['Despesa Operacional', 'Sangria Direção', 'Pagamento Fornecedor', 'Manutenção']);
  const [newCategoryName, setNewCategoryName] = useState('');

  const [newProd, setNewProd] = useState({
      name: '',
      category: 'Copinho' as IceCreamCategory,
      price: '',
      flavor: ''
  });
  
  const [tempRecipe, setTempRecipe] = useState<IceCreamRecipeItem[]>([]);
  const [newRecipeItem, setNewRecipeItem] = useState({ stock_base_name: '', quantity: '1' });

  const [txForm, setTxForm] = useState({
      date: new Date().toLocaleDateString('en-CA'),
      category: 'Despesa Operacional',
      value: '',
      description: ''
  });
  
  const [manualStoreId, setManualStoreId] = useState('');
  
  // LOGICA DE SEGURANÇA: Se não for ADMIN, força o storeId do usuário logado
  const isAdmin = user.role === UserRole.ADMIN;
  const effectiveStoreId = isAdmin 
    ? (manualStoreId || user.storeId || (stores.length > 0 ? stores[0].id : ''))
    : (user.storeId || (stores.length > 0 ? stores[0].id : ''));
  
  const cartTotal = useMemo(() => cart.reduce((acc, curr) => acc + curr.totalValue, 0), [cart]);

  const changeDue = useMemo(() => {
    const received = parseFloat(amountReceived.replace(',', '.')) || 0;
    return Math.max(0, received - cartTotal);
  }, [amountReceived, cartTotal]);

  const fetchPartners = async () => {
    if (!effectiveStoreId) return;
    const { data } = await supabase
        .from('store_profit_distribution')
        .select('*')
        .eq('store_id', effectiveStoreId)
        .eq('active', true)
        .order('created_at', { ascending: true });
    if (data) setPartners(data);
  };

  const fetchExpenseCategories = async () => {
      if (!effectiveStoreId) return;
      const { data } = await supabase
          .from('ice_cream_expense_categories')
          .select('name')
          .eq('store_id', effectiveStoreId)
          .order('name', { ascending: true });
      if (data && data.length > 0) {
          setExpenseCategories(data.map(c => c.name));
      } else {
          setExpenseCategories(['Despesa Operacional', 'Sangria Direção', 'Pagamento Fornecedor', 'Manutenção']);
      }
  };

  useEffect(() => {
    fetchPartners();
    fetchExpenseCategories();
  }, [effectiveStoreId]);

  const filteredItems = useMemo(() => (items ?? []).filter(i => i.storeId === effectiveStoreId), [items, effectiveStoreId]);
  const filteredStock = useMemo(() => (stock ?? []).filter(s => s.store_id === effectiveStoreId).sort((a,b) => a.product_base.localeCompare(b.product_base)), [stock, effectiveStoreId]);
  
  const todayKey = new Date().toLocaleDateString('en-CA');
  const periodKey = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`;

  const dreStats = useMemo(() => {
      const daySales = (sales ?? []).filter(s => s.createdAt?.startsWith(todayKey) && s.status !== 'canceled' && s.storeId === effectiveStoreId);
      const dayExits = (finances ?? []).filter(f => f.date === todayKey && (f.type === 'exit' || (f.type as string) === 'saida') && f.storeId === effectiveStoreId);
      
      const monthSales = (sales ?? []).filter(s => s.createdAt?.startsWith(periodKey) && s.status !== 'canceled' && s.storeId === effectiveStoreId);
      const monthExits = (finances ?? []).filter(f => f.date?.startsWith(periodKey) && (f.type === 'exit' || (f.type as string) === 'saida') && f.storeId === effectiveStoreId);

      const byMethod = (list: IceCreamDailySale[]) => {
          return {
              pix: list.filter(s => s.paymentMethod === 'Pix').reduce((a,b) => a + b.totalValue, 0),
              money: list.filter(s => s.paymentMethod === 'Dinheiro').reduce((a,b) => a + b.totalValue, 0),
              card: list.filter(s => s.paymentMethod === 'Cartão').reduce((a,b) => a + b.totalValue, 0),
              fiado: list.filter(s => s.paymentMethod === 'Fiado').reduce((a,b) => a + b.totalValue, 0)
          };
      };

      const monthIn = monthSales.reduce((a,b) => a + b.totalValue, 0);
      const monthOut = monthExits.reduce((a,b) => a + Number(b.value), 0);
      const profit = monthIn - monthOut;

      return {
          dayIn: daySales.reduce((a,b) => a + b.totalValue, 0),
          dayOut: dayExits.reduce((a,b) => a + Number(b.value), 0),
          dayMethods: byMethod(daySales),
          monthMethods: byMethod(monthSales),
          monthIn,
          monthOut,
          profit,
          monthExits: monthExits.sort((a,b) => b.date.localeCompare(a.date)),
          distribution: {
              investor: profit > 0 ? profit * 0.7 : 0,
              manager: profit > 0 ? profit * 0.3 : 0
          }
      };
  }, [sales, finances, todayKey, periodKey, effectiveStoreId]);

  const fiadoReport = useMemo(() => {
    const periodSales = (sales ?? []).filter(s => s.createdAt?.startsWith(periodKey) && s.status !== 'canceled' && s.storeId === effectiveStoreId && s.paymentMethod === 'Fiado');
    const grouped: Record<string, number> = {};
    periodSales.forEach(s => {
      const name = s.buyer_name || 'DESCONHECIDO';
      grouped[name] = (grouped[name] || 0) + s.totalValue;
    });
    return Object.entries(grouped).map(([name, total]) => ({ name, total })).sort((a,b) => b.total - a.total);
  }, [sales, periodKey, effectiveStoreId]);

  const getUnitAbbr = (unit: string) => {
    const u = unit.toLowerCase();
    if (u === 'balde') return 'bd';
    if (u === 'unidade') return 'un';
    if (u === 'litro') return 'lt';
    if (u === 'pacote') return 'pct';
    if (u === 'caixa') return 'cx';
    return unit;
  };

  const handlePrintDRE = (detailed: boolean) => {
    const printWindow = window.open('', '_blank', 'width=1000,height=1200');
    if (!printWindow) return;
    const store = stores.find(s => s.id === effectiveStoreId);
    const dateStr = new Date().toLocaleString('pt-BR');
    const monthLabel = MONTHS.find(m => m.value === selectedMonth)?.label;
    
    let exitsHtml = '';
    if (detailed) {
        exitsHtml = `
            <div style="margin-top: 30px;">
                <h3 style="font-size: 16px; border-bottom: 2px solid #333; padding-bottom: 5px; margin-bottom: 15px; text-transform: uppercase;">Detalhamento de Saídas (Sangrias)</h3>
                <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
                    <thead>
                        <tr style="background: #f4f4f4; text-align: left;">
                            <th style="padding: 10px; border: 1px solid #ddd;">Data</th>
                            <th style="padding: 10px; border: 1px solid #ddd;">Categoria</th>
                            <th style="padding: 10px; border: 1px solid #ddd;">Descrição</th>
                            <th style="padding: 10px; border: 1px solid #ddd; text-right;">Valor</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${dreStats.monthExits.map(ex => `
                            <tr>
                                <td style="padding: 10px; border: 1px solid #ddd;">${new Date(ex.date + 'T00:00:00').toLocaleDateString('pt-BR')}</td>
                                <td style="padding: 10px; border: 1px solid #ddd;">${ex.category}</td>
                                <td style="padding: 10px; border: 1px solid #ddd;">${ex.description || '-'}</td>
                                <td style="padding: 10px; border: 1px solid #ddd; text-align: right; font-weight: bold; color: #d32f2f;">${formatCurrency(ex.value)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }

    const partnersHtml = `
        <div style="margin-top: 30px;">
            <h3 style="font-size: 16px; border-bottom: 2px solid #333; padding-bottom: 5px; margin-bottom: 15px; text-transform: uppercase;">Partilha de Resultados</h3>
            <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                <thead>
                    <tr style="background: #f4f4f4; text-align: left;">
                        <th style="padding: 10px; border: 1px solid #ddd;">Sócio</th>
                        <th style="padding: 10px; border: 1px solid #ddd;">Participação (%)</th>
                        <th style="padding: 10px; border: 1px solid #ddd; text-right;">Valor a Receber</th>
                    </tr>
                </thead>
                <tbody>
                    ${partners.map(p => {
                        const share = dreStats.profit > 0 ? (dreStats.profit * p.percentage) / 100 : 0;
                        return `
                            <tr>
                                <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold;">${p.partner_name}</td>
                                <td style="padding: 10px; border: 1px solid #ddd;">${p.percentage}%</td>
                                <td style="padding: 10px; border: 1px solid #ddd; text-align: right; font-weight: bold; color: #1b5e20;">${formatCurrency(share)}</td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        </div>
    `;

    const html = `
        <html>
        <head>
            <title>Relatório DRE Mensal - Profissional A4</title>
            <style>
                @page { size: A4; margin: 20mm; }
                body { font-family: 'Segoe UI', Arial, sans-serif; color: #333; line-height: 1.5; padding: 0; margin: 0; }
                .header-container { display: flex; justify-content: space-between; align-items: center; border-bottom: 4px solid #1a237e; padding-bottom: 20px; margin-bottom: 30px; }
                .company-info h1 { margin: 0; font-size: 28px; font-weight: 900; color: #1a237e; font-style: italic; }
                .company-info h1 span { color: #d32f2f; }
                .report-title { text-align: right; }
                .report-title h2 { margin: 0; font-size: 20px; text-transform: uppercase; color: #555; }
                .summary-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-bottom: 30px; }
                .stat-box { background: #f8f9fa; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px; text-align: center; }
                .stat-box p { margin: 0; font-size: 10px; font-weight: bold; text-transform: uppercase; color: #777; }
                .stat-box h3 { margin: 5px 0 0; font-size: 22px; font-weight: 900; }
                .profit-box { background: #e8f5e9; border-color: #a5d6a7; color: #2e7d32; }
                .expense-box { background: #ffebee; border-color: #ef9a9a; color: #c62828; }
                .footer { margin-top: 50px; text-align: center; font-size: 10px; color: #999; border-top: 1px solid #eee; padding-top: 20px; }
            </style>
        </head>
        <body>
            <div class="header-container">
                <div class="company-info">
                    <h1>GELATERIA <span>REAL</span></h1>
                    <p style="margin: 5px 0 0; font-weight: bold; color: #666; font-size: 12px;">UNIDADE ${store?.number || '---'} - ${store?.city || ''}</p>
                </div>
                <div class="report-title">
                    <h2>Demonstrativo de Resultados</h2>
                    <p style="margin: 5px 0 0; font-weight: bold; color: #1a237e;">REF: ${monthLabel?.toUpperCase()} / ${selectedYear}</p>
                </div>
            </div>

            <div class="summary-grid">
                <div class="stat-box">
                    <p>Faturamento Bruto</p>
                    <h3>${formatCurrency(dreStats.monthIn)}</h3>
                </div>
                <div class="stat-box expense-box">
                    <p>Total de Despesas</p>
                    <h3>${formatCurrency(dreStats.monthOut)}</h3>
                </div>
                <div class="stat-box profit-box">
                    <p>Lucro Líquido Real</p>
                    <h3>${formatCurrency(dreStats.profit)}</h3>
                </div>
            </div>

            <div style="margin-bottom: 30px;">
                <h3 style="font-size: 16px; border-bottom: 2px solid #333; padding-bottom: 5px; margin-bottom: 15px; text-transform: uppercase;">Receita por Forma de Pagamento</h3>
                <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px;">
                    <div style="padding: 10px; border: 1px solid #ddd; text-align: center;">
                        <p style="margin:0; font-size: 9px; color: #999;">PIX</p>
                        <b style="font-size: 14px;">${formatCurrency(dreStats.monthMethods.pix)}</b>
                    </div>
                    <div style="padding: 10px; border: 1px solid #ddd; text-align: center;">
                        <p style="margin:0; font-size: 9px; color: #999;">CARTÃO</p>
                        <b style="font-size: 14px;">${formatCurrency(dreStats.monthMethods.card)}</b>
                    </div>
                    <div style="padding: 10px; border: 1px solid #ddd; text-align: center;">
                        <p style="margin:0; font-size: 9px; color: #999;">DINHEIRO</p>
                        <b style="font-size: 14px;">${formatCurrency(dreStats.monthMethods.money)}</b>
                    </div>
                    <div style="padding: 10px; border: 1px solid #ddd; text-align: center;">
                        <p style="margin:0; font-size: 9px; color: #999;">FIADO</p>
                        <b style="font-size: 14px;">${formatCurrency(dreStats.monthMethods.fiado)}</b>
                    </div>
                </div>
            </div>

            ${partnersHtml}
            ${exitsHtml}

            <div class="footer">
                Relatório Gerencial Emitido em ${dateStr} - Real Admin Enterprise v28.4<br/>
                Os dados aqui contidos são de caráter confidencial e restrito à administração.
            </div>
            
            <script>window.onload = function() { window.print(); setTimeout(window.close, 1000); }</script>
        </body>
        </html>
    `;
    printWindow.document.write(html);
    printWindow.document.close();
  };

  const handlePrintFiado = () => {
    const printWindow = window.open('', '_blank', 'width=1000,height=1200');
    if (!printWindow) return;
    const store = stores.find(s => s.id === effectiveStoreId);
    const dateStr = new Date().toLocaleString('pt-BR');
    const monthLabel = MONTHS.find(m => m.value === selectedMonth)?.label;
    const totalGeral = fiadoReport.reduce((a,b) => a + b.total, 0);

    const html = `
        <html>
        <head>
            <title>Relatório de Fiados - Profissional A4</title>
            <style>
                @page { size: A4; margin: 20mm; }
                body { font-family: 'Segoe UI', Arial, sans-serif; color: #333; line-height: 1.5; padding: 0; margin: 0; }
                .header-container { display: flex; justify-content: space-between; align-items: center; border-bottom: 4px solid #c62828; padding-bottom: 20px; margin-bottom: 30px; }
                .company-info h1 { margin: 0; font-size: 28px; font-weight: 900; color: #1a237e; font-style: italic; }
                .company-info h1 span { color: #d32f2f; }
                .report-title { text-align: right; }
                .report-title h2 { margin: 0; font-size: 20px; text-transform: uppercase; color: #555; }
                table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                th { background: #f4f4f4; padding: 12px; border: 1px solid #ddd; text-align: left; text-transform: uppercase; font-size: 11px; }
                td { padding: 12px; border: 1px solid #ddd; font-size: 13px; }
                .total-row { background: #ffebee; font-weight: 900; font-size: 18px; }
                .footer { margin-top: 50px; text-align: center; font-size: 10px; color: #999; border-top: 1px solid #eee; padding-top: 20px; }
            </style>
        </head>
        <body>
            <div class="header-container">
                <div class="company-info">
                    <h1>GELATERIA <span>REAL</span></h1>
                    <p style="margin: 5px 0 0; font-weight: bold; color: #666; font-size: 12px;">UNIDADE ${store?.number || '---'} - ${store?.city || ''}</p>
                </div>
                <div class="report-title">
                    <h2>Relatório de Débitos (Fiado)</h2>
                    <p style="margin: 5px 0 0; font-weight: bold; color: #d32f2f;">REF: ${monthLabel?.toUpperCase()} / ${selectedYear}</p>
                </div>
            </div>

            <p style="font-size: 14px; font-weight: bold; background: #eee; padding: 10px; border-radius: 4px;">Este relatório consolida todas as vendas realizadas na modalidade "Fiado" no período selecionado, agrupadas por nome do funcionário/comprador.</p>

            <table>
                <thead>
                    <tr>
                        <th style="width: 50px; text-align: center;">Item</th>
                        <th>Funcionário / Comprador</th>
                        <th style="text-align: right;">Total do Débito</th>
                    </tr>
                </thead>
                <tbody>
                    ${fiadoReport.map((f, i) => `
                        <tr>
                            <td style="text-align: center; color: #999;">${i + 1}</td>
                            <td style="font-weight: bold; text-transform: uppercase;">${f.name}</td>
                            <td style="text-align: right; font-weight: 900; color: #1a237e;">${formatCurrency(f.total)}</td>
                        </tr>
                    `).join('')}
                    <tr class="total-row">
                        <td colspan="2" style="text-align: right; padding-right: 20px;">VALOR TOTAL CONSOLIDADO</td>
                        <td style="text-align: right; color: #d32f2f;">${formatCurrency(totalGeral)}</td>
                    </tr>
                </tbody>
            </table>

            <div style="margin-top: 40px; border: 1px solid #ddd; padding: 20px; border-radius: 8px; background: #fafafa;">
                <h4 style="margin: 0 0 10px; font-size: 12px; text-transform: uppercase; color: #666;">Termo de Conferência</h4>
                <p style="font-size: 11px; margin: 0;">Eu, responsável pela conferência, atesto que os valores listados acima conferem com os registros do sistema de PDV Gelateria Real para o período de referência citado.</p>
                <div style="display: flex; justify-content: space-between; margin-top: 40px;">
                    <div style="width: 250px; border-top: 1px solid #333; text-align: center; font-size: 10px; padding-top: 5px;">ASSINATURA RESPONSÁVEL</div>
                    <div style="width: 250px; border-top: 1px solid #333; text-align: center; font-size: 10px; padding-top: 5px;">DATA DA CONFERÊNCIA</div>
                </div>
            </div>

            <div class="footer">
                Relatório Gerencial Emitido em ${dateStr} - Real Admin Enterprise v28.4<br/>
                Real Calçados & Gelateria Real - Todos os direitos reservados.
            </div>
            
            <script>window.onload = function() { window.print(); setTimeout(window.close, 1000); }</script>
        </body>
        </html>
    `;
    printWindow.document.write(html);
    printWindow.document.close();
  };

  const printThermalTicket = (saleItems: IceCreamDailySale[], saleCode: string, isFiado: boolean, buyer?: string) => {
    const printWindow = window.open('', '_blank', 'width=400,height=600');
    if (!printWindow) return;
    const store = stores.find(s => s.id === effectiveStoreId);
    const dateStr = new Date().toLocaleString('pt-BR');
    const total = saleItems.reduce((a, b) => a + b.totalValue, 0);
    const rows = saleItems.map(item => `<div style="display: flex; justify-content: space-between; border-bottom: 1px dashed #eee; padding: 5px 0;"><span style="flex: 1; text-align: left;">${item.unitsSold}x ${item.productName}</span><span style="font-weight: bold; width: 80px; text-align: right;">${formatCurrency(item.totalValue)}</span></div>`).join('');
    const html = `<html><head><style>@page { margin: 0; } body { font-family: 'Courier New', monospace; width: 72mm; padding: 5mm; margin: 0; font-size: 12px; line-height: 1.2; color: #000; background: white; } .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 10px; } .store-name { font-size: 16px; font-weight: bold; text-transform: uppercase; } .code-box { border: 2px solid #000; margin: 10px 0; padding: 10px; text-align: center; font-size: 24px; font-weight: bold; } .footer { margin-top: 15px; border-top: 1px solid #000; padding-top: 10px; text-align: center; } .signature-box { margin-top: 40px; border-top: 1px solid #000; text-align: center; font-size: 10px; padding-top: 5px; } .label { font-weight: bold; text-transform: uppercase; font-size: 10px; }</style></head><body><div class="header"><div class="store-name">GELATERIA REAL</div><div>Unidade ${store?.number || '---'} - ${store?.city || ''}</div><div style="font-size: 9px; margin-top: 5px;">${dateStr}</div></div><div class="code-box">${isFiado ? 'PROMISSÓRIA' : 'SENHA: ' + saleCode.slice(-4)}</div>${isFiado ? `<div style="margin-bottom: 10px;"><span class="label">FUNCIONÁRIO:</span><br/><b>${buyer?.toUpperCase() || 'NÃO INFORMADO'}</b></div>` : ''}<div style="margin-bottom: 5px;"><span class="label">PEDIDO:</span></div>${rows}<div style="display: flex; justify-content: space-between; font-size: 14px; font-weight: bold; margin-top: 10px; border-top: 1px solid #000; padding-top: 5px;"><span>TOTAL:</span><span>${formatCurrency(total)}</span></div>${isFiado ? `<div class="signature-box">ASSINATURA DO FUNCIONÁRIO<br/><br/>RECONHEÇO O DÉBITO ACIMA DESCRITO</div>` : `<div class="footer"><b>AGUARDE SEU ATENDIMENTO</b><br/>Obrigado pela preferência!</div>`}<div style="font-size: 8px; text-align: center; margin-top: 10px; opacity: 0.5;">Real Admin v28 - Emissão Digital</div><script>window.onload = function() { window.print(); setTimeout(window.close, 1000); }</script></body></html>`;
    printWindow.document.write(html); printWindow.document.close();
  };

  const handleAddToCart = (item: IceCreamItem) => {
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
  };

  const finalizeSale = async () => {
      if (cart.length === 0 || !paymentMethod) return;
      if (paymentMethod === 'Fiado' && !buyerName) { alert("Nome do funcionário obrigatório."); return; }
      if (paymentMethod === 'Dinheiro') {
        const received = parseFloat(amountReceived.replace(',', '.')) || 0;
        if (received < cartTotal) { alert("Valor recebido insuficiente."); return; }
      }
      setIsSubmitting(true);
      try {
          const saleCode = `GEL-${Date.now().toString().slice(-6)}`;
          const salesToSave = cart.map(c => ({ ...c, paymentMethod: paymentMethod!, buyer_name: paymentMethod === 'Fiado' ? buyerName.toUpperCase() : undefined, saleCode }));
          await onAddSales(salesToSave);
          printThermalTicket(salesToSave, saleCode, paymentMethod === 'Fiado', buyerName);
          setCart([]); setPaymentMethod(null); setBuyerName(''); setAmountReceived('');
      } catch (e) { alert("Falha ao registrar venda."); } finally { setIsSubmitting(false); }
  };

  const handleSaveTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
        const formData = {
            storeId: effectiveStoreId,
            date: txForm.date,
            type: 'exit',
            category: txForm.category,
            value: txForm.value.replace(',', '.'),
            description: txForm.description
        };

        // Envia para o prop que trata a persistência via App.tsx com o mapper
        await onAddTransaction(formData as any);
        
        setTxForm({ ...txForm, value: '', description: '' });
        setShowTransactionModal(false);
    } catch (err) { alert("Erro ao lançar despesa."); } finally { setIsSubmitting(false); }
  };

  // CRUD DE CATEGORIAS
  const handleAddExpenseCategory = async () => {
      if (!newCategoryName.trim()) return;
      setIsSubmitting(true);
      const { error } = await supabase
          .from('ice_cream_expense_categories')
          .insert([{ store_id: effectiveStoreId, name: newCategoryName.toUpperCase().trim() }]);
      if (!error) {
          setNewCategoryName('');
          await fetchExpenseCategories();
      } else {
          alert("Erro ao salvar categoria.");
      }
      setIsSubmitting(false);
  };

  const handleDeleteExpenseCategory = async (name: string) => {
      if (!window.confirm(`Deseja remover a categoria "${name}"?`)) return;
      setIsSubmitting(true);
      const { error } = await supabase
          .from('ice_cream_expense_categories')
          .delete()
          .eq('store_id', effectiveStoreId)
          .eq('name', name);
      if (!error) await fetchExpenseCategories();
      setIsSubmitting(false);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
      e.preventDefault();
      setIsSubmitting(true);
      try {
          const price = Number(newProd.price.replace(',', '.'));
          const payload = { store_id: effectiveStoreId, name: newProd.name.toUpperCase().trim(), category: newProd.category, price: price, flavor: newProd.flavor || 'Padrão', active: true, consumption_per_sale: 0, recipe: JSON.stringify(tempRecipe ?? []) };
          if (editingProduct) {
              const { error } = await supabase.from('ice_cream_items').update(payload).eq('id', editingProduct.id);
              if (error) throw error;
          } else {
              const { error } = await supabase.from('ice_cream_items').insert([payload]);
              if (error) throw error;
          }
          setNewProd({ name: '', category: 'Copinho', price: '', flavor: '' });
          setTempRecipe([]); setEditingProduct(null); setShowProductModal(false);
          alert("Produto salvo!"); window.location.reload();
      } catch (err) { alert("Erro ao salvar produto."); } finally { setIsSubmitting(false); }
  };

  const handleEditProduct = (item: IceCreamItem) => {
      setEditingProduct(item);
      setNewProd({ name: item.name, category: item.category, price: item.price.toFixed(2).replace('.', ','), flavor: item.flavor || '' });
      setTempRecipe(item.recipe ?? []); setShowProductModal(true);
  };

  const handleBulkStockUpdate = async (type: 'production' | 'adjustment') => {
      setIsSubmitting(true);
      try {
          for (const [productBase, valueStr] of Object.entries(bulkStockData)) {
              const value = parseFloat((valueStr as string).replace(',', '.'));
              if (isNaN(value) || value === 0) continue;
              const item = filteredStock.find(s => s.product_base === productBase);
              await onUpdateStock(effectiveStoreId, productBase, value, item?.unit || 'Unidade', type);
          }
          setBulkStockData({}); setShowInwardStockModal(false); setShowInventoryModal(false);
          alert("Estoque atualizado!");
      } catch (e) { alert("Erro ao processar estoque."); } finally { setIsSubmitting(false); }
  };

  const handleDeleteStockItem = async (id: string) => {
      if (!window.confirm("Deseja excluir este insumo? Isso afetará receitas que o utilizam.")) return;
      setIsSubmitting(true);
      try {
          const { error } = await supabase.from('ice_cream_stock').delete().eq('id', id);
          if (error) throw error;
          alert("Insumo excluído com sucesso."); window.location.reload();
      } catch (e) { alert("Erro ao excluir insumo."); } finally { setIsSubmitting(false); }
  };

  const handleCancelSale = async () => {
      if (!showCancelModal || !cancelReason) return;
      setIsSubmitting(true);
      try {
          await onCancelSale(showCancelModal.code, cancelReason);
          setShowCancelModal(null); setCancelReason('');
          alert("Venda cancelada.");
      } catch (e) { alert("Erro ao cancelar."); } finally { setIsSubmitting(false); }
  };

  const handleAddPartner = async () => {
      const pct = parseFloat(newPartner.percentage.replace(',', '.'));
      if (!newPartner.name || isNaN(pct)) return alert("Dados inválidos.");
      const currentTotal = (partners ?? []).reduce((a,b) => a + Number(b.percentage), 0);
      if (currentTotal + pct > 100.01) return alert("Soma dos percentuais excede 100%.");
      setIsSubmitting(true);
      const payload = { store_id: effectiveStoreId, partner_name: newPartner.name.toUpperCase().trim(), percentage: pct, active: true };
      const { error } = await supabase.from('store_profit_distribution').insert([payload]);
      if (!error) { setNewPartner({ name: '', percentage: '' }); await fetchPartners(); alert("Sócio salvo!"); } else { alert("Erro ao salvar sócio."); }
      setIsSubmitting(false);
  };

  const handleRemovePartner = async (id: string) => {
      if (!window.confirm("Remover este sócio?")) return;
      const { error } = await supabase.from('store_profit_distribution').delete().eq('id', id);
      if (!error) fetchPartners();
  };

  const handlePrintStock = () => {
      const printWindow = window.open('', '_blank', 'width=900,height=1200');
      if (!printWindow) return;
      const store = stores.find(s => s.id === effectiveStoreId);
      const rows = filteredStock.map(st => `<tr class="border-b"><td class="p-3 text-[11px] font-black uppercase italic">${st.product_base}</td><td class="p-3 text-[11px] font-black text-center">${st.stock_current} ${getUnitAbbr(st.unit)}</td><td class="p-3 border-l border-r w-24"></td><td class="p-3 w-24"></td></tr>`).join('');
      const html = `<html><head><title>Conferência de Estoque</title><script src="https://cdn.tailwindcss.com"></script></head><body class="p-10 font-sans"><div class="flex justify-between items-center border-b-4 border-black pb-4 mb-8"><div><h1 class="text-2xl font-black uppercase italic">GELATERIA <span class="text-red-600">REAL</span></h1><p class="text-xs font-bold text-gray-500 uppercase">UNIDADE ${store?.number} - ${store?.city}</p></div><div class="text-right"><h2 class="text-xl font-bold uppercase">FOLHA DE CONFERÊNCIA</h2><p class="text-[10px] font-medium text-gray-400">Emissão: ${new Date().toLocaleString('pt-BR')}</p></div></div><table class="w-full text-left border border-black"><thead><tr class="bg-gray-100 border-b border-black text-[10px] font-black uppercase tracking-widest"><th class="p-3">Insumo</th><th class="p-3 text-center">Saldo Sistema</th><th class="p-3 text-center">Físico</th><th class="p-3 text-center">Dif.</th></tr></thead><tbody>${rows}</tbody></table></body></html>`;
      printWindow.document.write(html); printWindow.document.close();
      setTimeout(() => printWindow.print(), 500);
  };

  const activeStoreObj = stores.find(s => s.id === effectiveStoreId);

  return (
    <div className="flex flex-col h-full bg-gray-50 overflow-hidden font-sans relative">
        <div className="bg-white border-b px-4 md:px-6 py-2 flex flex-col md:flex-row justify-between items-center gap-2 z-40 shadow-sm shrink-0">
            <div className="flex items-center gap-2">
                <div className="p-1.5 bg-blue-900 rounded-xl text-white shadow-lg shrink-0"><IceCream size={18} /></div>
                <div className="truncate">
                    <h2 className="text-sm md:text-base font-black uppercase italic tracking-tighter text-blue-950 leading-none">Gelateria <span className="text-red-600">Real</span></h2>
                    <div className="flex items-center gap-1 mt-0.5">
                        <p className="text-[7px] font-black text-gray-400 uppercase tracking-widest leading-none">Unidade</p>
                        {isAdmin ? (
                            <select 
                                value={effectiveStoreId} 
                                onChange={(e) => setManualStoreId(e.target.value)}
                                className="bg-transparent border-none text-[8px] font-black text-blue-600 uppercase outline-none cursor-pointer focus:ring-0 p-0 h-auto min-h-0"
                            >
                                {[...stores].sort((a, b) => parseInt(a.number || '0') - parseInt(b.number || '0')).map(s => (
                                    <option key={s.id} value={s.id}>{s.number} - {s.city}</option>
                                ))}
                            </select>
                        ) : (
                            <span className="text-[8px] font-black text-blue-600 uppercase">
                                {activeStoreObj?.number} - {activeStoreObj?.city}
                            </span>
                        )}
                    </div>
                </div>
            </div>
            <div className="flex bg-gray-100 p-0.5 rounded-xl overflow-x-auto no-scrollbar w-full md:w-auto max-w-full">
                <button onClick={() => setActiveTab('pdv')} className={`flex-1 md:flex-none px-3 py-2 rounded-lg text-[8px] md:text-[9px] font-black uppercase transition-all flex items-center justify-center gap-1.5 whitespace-nowrap ${activeTab === 'pdv' ? 'bg-white text-blue-700 shadow-md' : 'text-gray-500'}`}><ShoppingCart size={12}/> PDV</button>
                <button onClick={() => setActiveTab('estoque')} className={`flex-1 md:flex-none px-3 py-2 rounded-lg text-[8px] md:text-[9px] font-black uppercase transition-all flex items-center justify-center gap-1.5 whitespace-nowrap ${activeTab === 'estoque' ? 'bg-white text-blue-700 shadow-md' : 'text-gray-500'}`}><Package size={12}/> Estoque</button>
                {can('MODULE_GELATERIA_DRE_DIARIO') && (<button onClick={() => setActiveTab('dre_diario')} className={`flex-1 md:flex-none px-3 py-2 rounded-lg text-[8px] md:text-[9px] font-black uppercase transition-all flex items-center justify-center gap-1.5 whitespace-nowrap ${activeTab === 'dre_diario' ? 'bg-white text-blue-700 shadow-md' : 'text-gray-500'}`}><Clock size={12}/> DRE Diário</button>)}
                {can('MODULE_GELATERIA_DRE_MENSAL') && (<button onClick={() => setActiveTab('dre_mensal')} className={`flex-1 md:flex-none px-3 py-2 rounded-lg text-[8px] md:text-[9px] font-black uppercase transition-all flex items-center justify-center gap-1.5 whitespace-nowrap ${activeTab === 'dre_mensal' ? 'bg-white text-blue-700 shadow-md' : 'text-gray-500'}`}><FileBarChart size={12}/> DRE Mensal</button>)}
                <button onClick={() => setActiveTab('audit')} className={`flex-1 md:flex-none px-3 py-2 rounded-lg text-[8px] md:text-[9px] font-black uppercase transition-all flex items-center justify-center gap-1.5 whitespace-nowrap ${activeTab === 'audit' ? 'bg-white text-blue-700 shadow-md' : 'text-gray-500'}`}><History size={12}/> Auditoria</button>
                {can('MODULE_GELATERIA_CONFIG') && (<button onClick={() => setActiveTab('produtos')} className={`flex-1 md:flex-none px-3 py-2 rounded-lg text-[8px] md:text-[9px] font-black uppercase transition-all flex items-center justify-center gap-1.5 whitespace-nowrap ${activeTab === 'produtos' ? 'bg-white text-blue-700 shadow-md' : 'text-gray-500'}`}><PackagePlus size={12}/> Produtos</button>)}
            </div>
        </div>

        <div className="flex-1 overflow-y-auto no-scrollbar relative">
            {activeTab === 'pdv' && (
                <div className="h-full">
                    <div className="lg:hidden h-full">
                        <PDVMobileView user={user} items={filteredItems} cart={cart} setCart={setCart} selectedCategory={selectedCategory} setSelectedCategory={setSelectedCategory} selectedProductName={null} setSelectedProductName={() => {}} selectedItem={null} setSelectedItem={() => {}} selectedMl="" setSelectedMl={() => {}} quantity={1} setQuantity={() => {}} paymentMethod={paymentMethod} setPaymentMethod={setPaymentMethod} buyerName={buyerName} setBuyerName={setBuyerName} onAddSales={onAddSales} onCancelSale={onCancelSale} onAddTransaction={onAddTransaction} dailyData={dreStats} handlePrintTicket={printThermalTicket} isSubmitting={isSubmitting} setIsSubmitting={setIsSubmitting} effectiveStoreId={effectiveStoreId} />
                    </div>
                    <div className="hidden lg:grid grid-cols-12 gap-4 p-6 max-w-[1500px] mx-auto h-full overflow-hidden">
                        <div className="col-span-8 flex flex-col h-full overflow-hidden">
                            <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-3">
                                <button onClick={() => setSelectedCategory(null)} className={`px-5 py-2 rounded-xl font-black uppercase text-[10px] border-2 transition-all ${!selectedCategory ? 'bg-blue-900 text-white border-blue-900 shadow-lg' : 'bg-white text-gray-400 border-gray-100'}`}>Tudo</button>
                                {PRODUCT_CATEGORIES.map(cat => (<button key={cat} onClick={() => setSelectedCategory(cat)} className={`px-5 py-2 rounded-xl font-black uppercase text-[10px] border-2 transition-all whitespace-nowrap ${selectedCategory === cat ? 'bg-blue-900 text-white border-blue-900 shadow-lg' : 'bg-white text-gray-400 border-gray-100'}`}>{cat}</button>))}
                            </div>
                            <div className="grid grid-cols-3 xl:grid-cols-4 gap-4 overflow-y-auto no-scrollbar pr-2 pb-10">
                                {filteredItems.filter(i => (!selectedCategory || i.category === selectedCategory) && i.active).map(item => (
                                    <button key={item.id} onClick={() => handleAddToCart(item)} className="bg-white p-4 rounded-[32px] border-2 border-gray-100 hover:border-blue-600 transition-all flex flex-col items-center text-center group shadow-sm">
                                        <div className="w-full aspect-square bg-gray-50 rounded-[24px] mb-3 flex items-center justify-center text-blue-100 group-hover:scale-105 transition-transform overflow-hidden">
                                            {item.image_url ? <img src={item.image_url} className="w-full h-full object-cover" /> : <IceCream size={40} />}
                                        </div>
                                        <h4 className="font-black text-gray-900 uppercase text-[10px] truncate w-full mb-1">{item.name}</h4>
                                        <p className="text-lg font-black text-blue-900 italic leading-none">{formatCurrency(item.price)}</p>
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="col-span-4 bg-white rounded-[40px] shadow-2xl border border-gray-100 p-8 flex flex-col h-full sticky top-0 overflow-hidden">
                            <h3 className="text-lg font-black uppercase italic mb-6 flex items-center gap-3 border-b pb-4"><ShoppingCart className="text-red-600" size={20} /> Venda <span className="text-gray-300 ml-auto font-bold text-xs">{cart.length} ITENS</span></h3>
                            <div className="flex-1 overflow-y-auto mb-6 space-y-2 no-scrollbar">
                                {cart.map((c) => (
                                    <div key={c.id} className="flex justify-between items-center p-4 bg-gray-50 rounded-2xl border border-gray-100">
                                        <div className="flex-1 min-w-0 pr-4"><p className="font-black text-gray-900 uppercase text-[10px] truncate">{c.productName}</p><p className="text-[9px] text-gray-400 font-bold uppercase">{formatCurrency(c.unitPrice)}</p></div>
                                        <div className="flex items-center gap-3"><span className="font-black text-blue-900 text-xs">{formatCurrency(c.totalValue)}</span><button onClick={() => setCart(cart.filter(item => item.id !== c.id))} className="p-1.5 text-red-300 hover:text-red-600"><Trash2 size={14}/></button></div>
                                    </div>
                                ))}
                            </div>
                            <div className="pt-4 border-t space-y-4 shrink-0">
                                <div className="flex justify-between items-baseline"><span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Subtotal</span><span className="text-3xl font-black text-blue-950 italic">{formatCurrency(cartTotal)}</span></div>
                                <div className="grid grid-cols-2 gap-2">{['Pix', 'Dinheiro', 'Cartão', 'Fiado'].map((m: any) => (<button key={m} onClick={() => { setPaymentMethod(m); }} className={`py-3 rounded-xl font-black uppercase text-[10px] border-2 transition-all ${paymentMethod === m ? 'bg-blue-900 text-white border-blue-900 shadow-xl' : 'bg-white text-gray-400 border-gray-100'}`}>{m}</button>))}</div>
                                {paymentMethod === 'Dinheiro' && (
                                    <div className="bg-green-50 p-4 rounded-2xl border-2 border-green-200 animate-in zoom-in duration-300 space-y-3">
                                        <div className="flex justify-between items-center"><label className="text-[10px] font-black text-green-700 uppercase">Valor Recebido</label><input autoFocus value={amountReceived} onChange={e => setAmountReceived(e.target.value)} placeholder="0,00" className="w-32 text-right bg-white border-none rounded-xl p-3 font-black text-green-700 outline-none text-lg shadow-inner" /></div>
                                        <div className="flex justify-between items-baseline border-t border-green-100 pt-2"><span className="text-[10px] font-black text-green-600 uppercase">Troco a Devolver</span><span className="text-2xl font-black text-green-700 italic">{formatCurrency(changeDue)}</span></div>
                                    </div>
                                )}
                                {paymentMethod === 'Fiado' && (
                                    <div className="animate-in fade-in duration-300">
                                        <label className="text-[9px] font-black text-red-600 uppercase mb-1 block ml-1">Funcionário Comprador</label>
                                        <input value={buyerName} onChange={e => setBuyerName(e.target.value.toUpperCase())} className="w-full p-4 bg-red-50 border-2 border-red-100 rounded-2xl font-black uppercase text-sm outline-none focus:ring-4 focus:ring-red-100 shadow-inner" placeholder="NOME DO FUNCIONÁRIO..." />
                                    </div>
                                )}
                                <button onClick={finalizeSale} disabled={isSubmitting || cart.length === 0 || !paymentMethod || (paymentMethod === 'Fiado' && !buyerName)} className="w-full py-5 bg-red-600 hover:bg-red-700 disabled:opacity-30 text-white rounded-[24px] font-black uppercase text-xs shadow-2xl flex items-center justify-center gap-3 transition-all border-b-4 border-red-900 active:scale-95">{isSubmitting ? <Loader2 className="animate-spin" /> : <CheckCircle2 size={18}/>} {paymentMethod === 'Fiado' ? 'Gerar Promissória' : 'Finalizar Venda'}</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            
            {activeTab === 'dre_diario' && can('MODULE_GELATERIA_DRE_DIARIO') && (
                <div className="p-4 md:p-8 space-y-6 animate-in fade-in duration-300 max-w-5xl mx-auto">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="bg-white p-6 rounded-[32px] shadow-sm border border-gray-100">
                            <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Entradas (Hoje)</p>
                            <h3 className="text-2xl font-black text-green-600 italic tracking-tighter">{formatCurrency(dreStats.dayIn)}</h3>
                        </div>
                        <div className="bg-white p-6 rounded-[32px] shadow-sm border border-gray-100">
                            <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Saídas (Hoje)</p>
                            <h3 className="text-2xl font-black text-red-600 italic tracking-tighter">{formatCurrency(dreStats.dayOut)}</h3>
                        </div>
                        <div className="bg-blue-900 p-6 rounded-[32px] shadow-xl text-white">
                            <p className="text-[9px] font-black text-blue-300 uppercase tracking-widest mb-1">Saldo do Dia</p>
                            <h3 className="text-2xl font-black italic tracking-tighter">{formatCurrency(dreStats.dayIn - dreStats.dayOut)}</h3>
                        </div>
                        <button onClick={() => setShowTransactionModal(true)} className="bg-red-600 hover:bg-red-700 text-white rounded-[32px] flex flex-col items-center justify-center gap-2 font-black uppercase text-[10px] shadow-lg transition-all active:scale-95 border-b-4 border-red-950">
                            <ArrowDownCircle size={24}/> Registrar Saída
                        </button>
                    </div>

                    <div className="bg-white rounded-[40px] shadow-sm border border-gray-100 overflow-hidden">
                        <div className="p-6 border-b flex justify-between items-center bg-gray-50/50">
                            <h3 className="text-sm font-black uppercase italic tracking-tighter flex items-center gap-3"><Clock className="text-blue-700" size={20}/> Vendas por Pagamento (Hoje)</h3>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-gray-100 border-b">
                            <div className="p-6 text-center"><p className="text-[8px] font-black text-gray-400 uppercase mb-1">Pix</p><p className="text-lg font-black text-blue-950">{formatCurrency(dreStats.dayMethods.pix)}</p></div>
                            <div className="p-6 text-center"><p className="text-[8px] font-black text-gray-400 uppercase mb-1">Cartão</p><p className="text-lg font-black text-blue-950">{formatCurrency(dreStats.dayMethods.card)}</p></div>
                            <div className="p-6 text-center"><p className="text-[8px] font-black text-gray-400 uppercase mb-1">Dinheiro</p><p className="text-lg font-black text-blue-950">{formatCurrency(dreStats.dayMethods.money)}</p></div>
                            <div className="p-6 text-center"><p className="text-[8px] font-black text-gray-400 uppercase mb-1">Fiado</p><p className="text-lg font-black text-red-600">{formatCurrency(dreStats.dayMethods.fiado)}</p></div>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'dre_mensal' && can('MODULE_GELATERIA_DRE_MENSAL') && (
                <div className="p-4 md:p-8 space-y-6 animate-in fade-in duration-300 max-w-6xl mx-auto">
                    <div className="bg-white p-8 rounded-[40px] shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between items-center gap-6">
                        <div className="flex items-center gap-4">
                            <div className="p-4 bg-blue-50 text-blue-700 rounded-3xl"><FilePieChart size={32}/></div>
                            <div>
                                <h3 className="text-2xl font-black uppercase italic text-blue-950 tracking-tighter">Demonstrativo <span className="text-red-600">Mensal</span></h3>
                                <p className="text-gray-400 text-[10px] font-black uppercase tracking-widest mt-1">Gestão de Lucratividade e Partilha</p>
                            </div>
                        </div>
                        <div className="flex gap-2">
                             <div className="flex items-center gap-2 bg-gray-100 p-1.5 rounded-2xl border shadow-inner">
                                <select value={selectedMonth} onChange={e => setSelectedMonth(Number(e.target.value))} className="bg-transparent font-black text-[10px] uppercase outline-none px-2">{MONTHS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}</select>
                                <select value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))} className="bg-transparent font-black text-[10px] uppercase outline-none px-2">{[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}</select>
                             </div>
                             <button onClick={() => setShowPartnersModal(true)} className="p-3 bg-gray-900 text-white rounded-2xl hover:bg-black transition-all shadow-md"><Users size={20}/></button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-white p-8 rounded-[40px] shadow-sm border border-gray-100">
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Faturamento Bruto</p>
                            <h3 className="text-3xl font-black text-blue-950 italic tracking-tighter">{formatCurrency(dreStats.monthIn)}</h3>
                            <div className="mt-4 grid grid-cols-2 gap-2 text-[9px] font-bold text-gray-500 uppercase">
                                <span>Pix: {formatCurrency(dreStats.monthMethods.pix)}</span>
                                <span>Card: {formatCurrency(dreStats.monthMethods.card)}</span>
                            </div>
                        </div>
                        <div className="bg-white p-8 rounded-[40px] shadow-sm border border-gray-100">
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Total de Despesas</p>
                            <h3 className="text-3xl font-black text-red-600 italic tracking-tighter">{formatCurrency(dreStats.monthOut)}</h3>
                            <p className="text-[9px] font-bold text-gray-400 uppercase mt-4">Sangrias e Lançamentos de Saída</p>
                        </div>
                        <div className="bg-gradient-to-br from-green-600 to-green-700 p-8 rounded-[40px] shadow-xl text-white">
                            <p className="text-[10px] font-black text-green-100 uppercase tracking-widest mb-2">Lucro Líquido Real</p>
                            <h3 className="text-3xl font-black italic tracking-tighter">{formatCurrency(dreStats.profit)}</h3>
                            <div className="mt-6 flex gap-2">
                                <button onClick={() => handlePrintDRE(false)} className="flex-1 py-2 bg-white/20 hover:bg-white/30 rounded-xl text-[9px] font-black uppercase flex items-center justify-center gap-2"><Printer size={14}/> Simples</button>
                                <button onClick={() => handlePrintDRE(true)} className="flex-1 py-2 bg-white/20 hover:bg-white/30 rounded-xl text-[9px] font-black uppercase flex items-center justify-center gap-2"><FileText size={14}/> Detalhado</button>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="bg-white rounded-[40px] shadow-sm border border-gray-100 overflow-hidden flex flex-col">
                            <div className="p-6 border-b flex justify-between items-center bg-gray-50/50">
                                <h3 className="text-xs font-black uppercase italic tracking-tighter flex items-center gap-3"><Handshake className="text-green-600" size={20}/> Partilha de Resultados</h3>
                                <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest bg-gray-100 px-3 py-1 rounded-full">Automático</span>
                            </div>
                            <div className="p-6 space-y-4 flex-1">
                                {partners.map(p => (
                                    <div key={p.id} className="flex justify-between items-center p-4 bg-gray-50 rounded-2xl border border-gray-100 shadow-inner">
                                        <div className="flex flex-col">
                                            <span className="text-[10px] font-black text-gray-900 uppercase italic leading-none">{p.partner_name}</span>
                                            <span className="text-[8px] font-bold text-gray-400 uppercase mt-1 tracking-widest">Participação: {p.percentage}%</span>
                                        </div>
                                        <span className="text-lg font-black text-green-700 italic tracking-tighter">
                                            {formatCurrency(dreStats.profit > 0 ? (dreStats.profit * p.percentage) / 100 : 0)}
                                        </span>
                                    </div>
                                ))}
                                {partners.length === 0 && <p className="text-center py-10 text-gray-300 font-bold uppercase text-[10px] italic">Configure os sócios nas definições</p>}
                            </div>
                        </div>

                        <div className="bg-white rounded-[40px] shadow-sm border border-gray-100 overflow-hidden flex flex-col">
                            <div className="p-6 border-b flex justify-between items-center bg-gray-50/50">
                                <h3 className="text-xs font-black uppercase italic tracking-tighter flex items-center gap-3"><AlertTriangle className="text-red-600" size={20}/> Débitos (Fiado Acumulado)</h3>
                                <button onClick={handlePrintFiado} className="p-2 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition-all"><Printer size={16}/></button>
                            </div>
                            <div className="p-6 space-y-3 flex-1 overflow-y-auto max-h-[400px] no-scrollbar">
                                {fiadoReport.map(f => (
                                    <div key={f.name} className="flex justify-between items-center p-4 bg-red-50/30 rounded-2xl border border-red-100/50">
                                        <span className="text-[10px] font-black text-gray-800 uppercase italic">{f.name}</span>
                                        <span className="text-sm font-black text-red-700">{formatCurrency(f.total)}</span>
                                    </div>
                                ))}
                                {fiadoReport.length === 0 && <p className="text-center py-10 text-gray-300 font-bold uppercase text-[10px] italic">Nenhum débito no período</p>}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'estoque' && (
                <div className="p-4 md:p-8 space-y-6 animate-in fade-in duration-300 max-w-6xl mx-auto">
                    <div className="bg-white p-8 rounded-[40px] shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between items-center gap-6">
                        <div className="flex items-center gap-4">
                            <div className="p-4 bg-orange-50 text-orange-600 rounded-3xl"><Package size={32}/></div>
                            <div>
                                <h3 className="text-2xl font-black uppercase italic text-blue-950 tracking-tighter">Controle de <span className="text-orange-600">Insumos</span></h3>
                                <p className="text-gray-400 text-[10px] font-black uppercase tracking-widest mt-1">Gestão de Saldos e Produção Diária</p>
                            </div>
                        </div>
                        <div className="flex flex-wrap justify-center gap-2">
                            <button onClick={() => setShowInwardStockModal(true)} className="px-6 py-3 bg-orange-600 text-white rounded-2xl font-black uppercase text-[10px] shadow-lg hover:bg-orange-700 transition-all active:scale-95 border-b-4 border-orange-900 flex items-center gap-2"><ArrowUpCircle size={16}/> Produção</button>
                            <button onClick={() => setShowInventoryModal(true)} className="px-6 py-3 bg-blue-900 text-white rounded-2xl font-black uppercase text-[10px] shadow-lg hover:bg-black transition-all active:scale-95 border-b-4 border-blue-950 flex items-center gap-2"><Zap size={16}/> Inventário</button>
                            <button onClick={handlePrintStock} className="p-3 bg-white border-2 border-gray-100 text-gray-400 rounded-2xl hover:text-blue-600 transition-all shadow-sm"><Printer size={20}/></button>
                            <button onClick={() => setShowNewStockModal(true)} className="p-3 bg-gray-900 text-white rounded-2xl hover:bg-black transition-all shadow-md"><Plus size={20}/></button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {filteredStock.map(st => (
                            <div key={st.id} className="bg-white p-6 rounded-[32px] shadow-sm border border-gray-100 relative group overflow-hidden">
                                <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity"><Layers size={60}/></div>
                                <div className="flex justify-between items-start mb-4">
                                    <div className={`p-2 rounded-xl text-white ${st.stock_current <= 5 ? 'bg-red-500 animate-pulse' : 'bg-orange-500'}`}><Package size={16}/></div>
                                    <button onClick={() => handleDeleteStockItem(st.id)} className="text-gray-200 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"><Trash2 size={14}/></button>
                                </div>
                                <h4 className="text-[10px] font-black text-blue-950 uppercase italic leading-none mb-2 truncate pr-4">{st.product_base}</h4>
                                <div className="flex items-baseline gap-1">
                                    <span className={`text-2xl font-black italic tracking-tighter ${st.stock_current <= 5 ? 'text-red-600' : 'text-gray-900'}`}>{st.stock_current}</span>
                                    <span className="text-[8px] font-bold text-gray-400 uppercase tracking-widest">{getUnitAbbr(st.unit)}</span>
                                </div>
                                <div className="mt-4 pt-4 border-t border-gray-50 flex justify-between items-center">
                                    <span className="text-[8px] font-black text-gray-300 uppercase">Saldo Sistema</span>
                                    <div className={`w-12 h-1 rounded-full ${st.stock_current <= 5 ? 'bg-red-100' : 'bg-green-100'}`}>
                                        <div className={`h-full rounded-full ${st.stock_current <= 5 ? 'bg-red-500' : 'bg-green-500'}`} style={{width: `${Math.min((st.stock_current / 20) * 100, 100)}%`}}></div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {activeTab === 'audit' && (
                <div className="p-4 md:p-8 space-y-6 animate-in fade-in duration-300 max-w-5xl mx-auto">
                    <div className="bg-white rounded-[40px] shadow-xl border border-gray-100 overflow-hidden">
                        <div className="p-8 border-b bg-gray-50/50 flex justify-between items-center">
                            <div>
                                <h3 className="text-xl font-black uppercase italic text-blue-950 tracking-tighter flex items-center gap-3"><History className="text-blue-700" size={28}/> Registro de <span className="text-red-600">Vendas</span></h3>
                                <p className="text-gray-400 text-[9px] font-black uppercase tracking-widest mt-1">Histórico completo e cancelamentos</p>
                            </div>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" size={16}/>
                                <input placeholder="FILTRAR..." className="bg-white border-2 border-gray-100 rounded-xl pl-10 pr-4 py-2 text-[10px] font-black uppercase focus:border-blue-600 outline-none shadow-sm" />
                            </div>
                        </div>
                        <div className="overflow-x-auto no-scrollbar">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-white text-[9px] font-black text-gray-400 uppercase tracking-widest border-b">
                                        <th className="px-8 py-5">Cod / Horário</th>
                                        <th className="px-8 py-5">Produto / Qtd</th>
                                        <th className="px-8 py-5">Pagamento</th>
                                        <th className="px-8 py-5 text-right">Valor Total</th>
                                        <th className="px-8 py-5 text-center">Ações</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50 font-bold">
                                    {(sales ?? []).filter(s => s.storeId === effectiveStoreId).slice(0, 50).map(sale => (
                                        <tr key={sale.id} className={`hover:bg-blue-50/30 transition-all ${sale.status === 'canceled' ? 'opacity-30 grayscale italic line-through' : ''}`}>
                                            <td className="px-8 py-5">
                                                <div className="text-xs font-black text-blue-950">#{sale.saleCode || 'GEL-000'}</div>
                                                <div className="text-[8px] text-gray-400 uppercase mt-0.5">{new Date(sale.createdAt!).toLocaleTimeString('pt-BR')}</div>
                                            </td>
                                            <td className="px-8 py-5">
                                                <div className="text-[10px] font-black text-gray-900 uppercase tracking-tighter italic">{sale.unitsSold}x {sale.productName}</div>
                                                <div className="text-[8px] text-gray-400 uppercase mt-0.5">{sale.flavor}</div>
                                            </td>
                                            <td className="px-8 py-5">
                                                <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase border ${sale.paymentMethod === 'Fiado' ? 'bg-red-50 text-red-600 border-red-100' : 'bg-green-50 text-green-600 border-green-100'}`}>{sale.paymentMethod}</span>
                                            </td>
                                            <td className="px-8 py-5 text-right font-black text-blue-950 text-sm">{formatCurrency(sale.totalValue)}</td>
                                            <td className="px-8 py-5 text-center">
                                                {sale.status !== 'canceled' && (
                                                    <button onClick={() => setShowCancelModal({code: sale.saleCode || ''})} className="p-2 text-gray-300 hover:text-red-600 transition-all"><Ban size={16}/></button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'produtos' && can('MODULE_GELATERIA_CONFIG') && (
                <div className="p-4 md:p-8 space-y-6 animate-in fade-in duration-300 max-w-6xl mx-auto">
                    <div className="bg-white p-8 rounded-[40px] shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between items-center gap-6">
                        <div className="flex items-center gap-4">
                            <div className="p-4 bg-purple-50 text-purple-600 rounded-3xl"><PackagePlus size={32}/></div>
                            <div>
                                <h3 className="text-2xl font-black uppercase italic text-blue-950 tracking-tighter">Gestão de <span className="text-purple-600">Produtos</span></h3>
                                <p className="text-gray-400 text-[10px] font-black uppercase tracking-widest mt-1">Configuração de Catálogo e Precificação</p>
                            </div>
                        </div>
                        <div className="flex gap-2">
                             <button onClick={() => setShowCategoryModal(true)} className="px-6 py-3 bg-white border-2 border-gray-100 text-gray-400 hover:text-blue-600 rounded-2xl font-black uppercase text-[10px] shadow-sm transition-all flex items-center gap-2"><Sliders size={16}/> Categorias</button>
                             <button onClick={() => { setEditingProduct(null); setNewProd({ name: '', category: 'Copinho', price: '', flavor: '' }); setTempRecipe([]); setShowProductModal(true); }} className="px-6 py-3 bg-gray-950 text-white rounded-2xl font-black uppercase text-[10px] shadow-lg hover:bg-black transition-all active:scale-95 border-b-4 border-red-600 flex items-center gap-2"><Plus size={16}/> Novo Produto</button>
                        </div>
                    </div>

                    <div className="bg-white rounded-[40px] shadow-sm border border-gray-100 overflow-hidden">
                        <table className="w-full text-left">
                            <thead className="bg-gray-50/50 text-[10px] font-black text-gray-400 uppercase tracking-widest border-b">
                                <tr>
                                    <th className="px-8 py-5">Produto</th>
                                    <th className="px-8 py-5">Categoria</th>
                                    <th className="px-8 py-5 text-right">Preço</th>
                                    <th className="px-8 py-5 text-center">Receita</th>
                                    <th className="px-8 py-5 text-right">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {filteredItems.map(item => (
                                    <tr key={item.id} className="hover:bg-gray-50 transition-all group">
                                        <td className="px-8 py-5 font-black text-blue-950 uppercase italic text-sm">{item.name}</td>
                                        <td className="px-8 py-5"><span className="text-[9px] font-black text-gray-400 border border-gray-200 px-3 py-1 rounded-full uppercase">{item.category}</span></td>
                                        <td className="px-8 py-5 text-right font-black text-blue-900">{formatCurrency(item.price)}</td>
                                        <td className="px-8 py-5 text-center">
                                            <div className="flex flex-wrap justify-center gap-1">
                                                {(item.recipe ?? []).map((r, idx) => <span key={idx} className="bg-blue-50 text-blue-600 text-[7px] font-black px-1.5 py-0.5 rounded uppercase">{r.stock_base_name}</span>)}
                                                {(item.recipe ?? []).length === 0 && <span className="text-[7px] text-gray-300 font-bold uppercase italic">Sem Receita</span>}
                                            </div>
                                        </td>
                                        <td className="px-8 py-5 text-right">
                                            <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all">
                                                <button onClick={() => handleEditProduct(item)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-xl transition-all"><Edit3 size={18}/></button>
                                                <button onClick={() => onDeleteItem(item.id)} className="p-2 text-red-300 hover:text-red-600 transition-all"><Trash size={18}/></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>

        {/* MODAL: NOVO PRODUTO */}
        {showProductModal && (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[100] p-4">
                <div className="bg-white rounded-[48px] w-full max-w-2xl shadow-2xl animate-in zoom-in duration-300 overflow-hidden border-t-8 border-purple-600 max-h-[90vh] flex flex-col">
                    <div className="p-8 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                        <div>
                            <h3 className="text-2xl font-black uppercase italic text-blue-950 tracking-tighter">{editingProduct ? 'Editar' : 'Novo'} <span className="text-purple-600">Produto</span></h3>
                            <p className="text-gray-400 text-[10px] font-black uppercase tracking-widest mt-1">Configurações de Venda e Composição</p>
                        </div>
                        <button onClick={() => setShowProductModal(false)} className="bg-white p-2 rounded-full text-gray-400 hover:text-red-600 transition-all border border-gray-100 shadow-sm"><X size={24}/></button>
                    </div>
                    <div className="overflow-y-auto no-scrollbar flex-1">
                        <form onSubmit={handleSaveProduct} className="p-10 space-y-8">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-gray-400 uppercase ml-2 tracking-widest">Nome do Produto</label>
                                    <input required value={newProd.name} onChange={e => setNewProd({...newProd, name: e.target.value})} className="w-full p-4 bg-gray-50 border-none rounded-2xl font-black text-gray-900 uppercase italic shadow-inner outline-none focus:ring-4 focus:ring-purple-50" placeholder="EX: SUNDAE DE MORANGO" />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-gray-400 uppercase ml-2 tracking-widest">Categoria</label>
                                    <select value={newProd.category} onChange={e => setNewProd({...newProd, category: e.target.value as IceCreamCategory})} className="w-full p-4 bg-gray-50 border-none rounded-2xl font-black text-gray-900 uppercase outline-none focus:ring-4 focus:ring-purple-50 cursor-pointer">
                                        {PRODUCT_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-gray-400 uppercase ml-2 tracking-widest">Preço de Venda</label>
                                    <input required value={newProd.price} onChange={e => setNewProd({...newProd, price: e.target.value})} className="w-full p-4 bg-purple-50/50 border-none rounded-2xl font-black text-purple-900 text-xl shadow-inner outline-none focus:ring-4 focus:ring-purple-100" placeholder="0,00" />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-gray-400 uppercase ml-2 tracking-widest">Sabor / Obs</label>
                                    <input value={newProd.flavor} onChange={e => setNewProd({...newProd, flavor: e.target.value})} className="w-full p-4 bg-gray-50 border-none rounded-2xl font-black text-gray-900 uppercase shadow-inner outline-none" placeholder="EX: MORANGO" />
                                </div>
                            </div>

                            <div className="bg-gray-900 rounded-[32px] p-8 space-y-6 shadow-2xl">
                                <div className="flex justify-between items-center border-b border-white/10 pb-4">
                                    <h4 className="text-white font-black uppercase text-xs tracking-widest flex items-center gap-3"><Beaker size={20} className="text-purple-400" /> Receita / Insumos</h4>
                                    <span className="text-[9px] font-black text-gray-400 uppercase">Dedução Automática</span>
                                </div>
                                <div className="space-y-4">
                                    <div className="flex gap-3">
                                        <select value={newRecipeItem.stock_base_name} onChange={e => setNewRecipeItem({...newRecipeItem, stock_base_name: e.target.value})} className="flex-1 p-3 bg-white/5 border border-white/10 rounded-xl font-black text-[10px] text-white uppercase outline-none focus:border-purple-500 transition-all">
                                            <option value="" className="text-black">SELECIONE O INSUMO...</option>
                                            {filteredStock.map(s => <option key={s.id} value={s.product_base} className="text-black">{s.product_base}</option>)}
                                        </select>
                                        <input type="number" step="0.01" value={newRecipeItem.quantity} onChange={e => setNewRecipeItem({...newRecipeItem, quantity: e.target.value})} className="w-20 p-3 bg-white/5 border border-white/10 rounded-xl font-black text-[10px] text-white text-center outline-none focus:border-purple-500" placeholder="QTD" />
                                        <button type="button" onClick={() => { if(newRecipeItem.stock_base_name && Number(newRecipeItem.quantity) > 0) { setTempRecipe([...tempRecipe, { stock_base_name: newRecipeItem.stock_base_name, quantity: Number(newRecipeItem.quantity) }]); setNewRecipeItem({ stock_base_name: '', quantity: '1' }); } }} className="p-3 bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition-all"><Plus size={20}/></button>
                                    </div>
                                    <div className="space-y-2 max-h-40 overflow-y-auto no-scrollbar">
                                        {tempRecipe.map((r, idx) => (
                                            <div key={idx} className="flex justify-between items-center p-3 bg-white/5 rounded-xl border border-white/5 group">
                                                <span className="text-[10px] font-black text-gray-300 uppercase italic">{r.stock_base_name}</span>
                                                <div className="flex items-center gap-4">
                                                    <span className="text-[10px] font-black text-purple-400">{r.quantity} {getUnitAbbr(filteredStock.find(s => s.product_base === r.stock_base_name)?.unit || 'un')}</span>
                                                    <button type="button" onClick={() => setTempRecipe(tempRecipe.filter((_, i) => i !== idx))} className="text-white/20 hover:text-red-500 transition-all"><X size={14}/></button>
                                                </div>
                                            </div>
                                        ))}
                                        {tempRecipe.length === 0 && <p className="text-center py-4 text-[9px] font-black text-white/20 uppercase tracking-[0.2em] italic">Nenhum insumo vinculado</p>}
                                    </div>
                                </div>
                            </div>

                            <div className="p-8 bg-gray-50 -mx-10 -mb-10 flex gap-4 mt-6">
                                <button type="button" onClick={() => setShowProductModal(false)} className="flex-1 py-5 bg-white border-2 border-gray-200 rounded-[28px] font-black text-gray-400 uppercase text-xs active:scale-95 transition-all">CANCELAR</button>
                                <button type="submit" disabled={isSubmitting} className="flex-1 py-5 bg-purple-600 text-white rounded-[28px] font-black uppercase text-xs shadow-2xl active:scale-95 transition-all border-b-4 border-purple-900 flex items-center justify-center gap-3">
                                    {isSubmitting ? <Loader2 className="animate-spin" /> : <Save size={18}/>} SALVAR PRODUTO
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        )}

        {/* MODAL: NOVO INSUMO */}
        {showNewStockModal && (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[100] p-4">
                <div className="bg-white rounded-[40px] w-full max-w-md shadow-2xl animate-in zoom-in duration-300 overflow-hidden border-t-8 border-orange-600">
                    <div className="p-8 border-b bg-gray-50/50 flex justify-between items-center">
                        <h3 className="text-xl font-black uppercase italic text-blue-950 flex items-center gap-3"><Package size={24} className="text-orange-600"/> Cadastrar Insumo</h3>
                        <button onClick={() => setShowNewStockModal(false)} className="text-gray-400 hover:text-red-600 transition-all"><X size={24}/></button>
                    </div>
                    <form onSubmit={async (e) => {
                        e.preventDefault();
                        const f = new FormData(e.currentTarget);
                        const base = String(f.get('base')).toUpperCase().trim();
                        const val = Number(f.get('val'));
                        const unit = String(f.get('unit'));
                        if(!base || isNaN(val)) return;
                        setIsSubmitting(true);
                        await onUpdateStock(effectiveStoreId, base, val, unit, 'adjustment');
                        setIsSubmitting(false); setShowNewStockModal(false); window.location.reload();
                    }} className="p-8 space-y-6">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-400 uppercase ml-2 tracking-widest">Nome do Insumo</label>
                            <input name="base" required className="w-full p-4 bg-gray-50 border-none rounded-2xl font-black text-gray-900 uppercase italic shadow-inner outline-none focus:ring-4 focus:ring-orange-50" placeholder="EX: COPO 300ML" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                             <div className="space-y-2">
                                <label className="text-[10px] font-black text-gray-400 uppercase ml-2 tracking-widest">Saldo Inicial</label>
                                <input name="val" type="number" required className="w-full p-4 bg-gray-50 border-none rounded-2xl font-black text-gray-900 shadow-inner outline-none" placeholder="0" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-gray-400 uppercase ml-2 tracking-widest">Unidade</label>
                                <select name="unit" className="w-full p-4 bg-gray-50 border-none rounded-2xl font-black text-gray-900 uppercase outline-none cursor-pointer">
                                    {STOCK_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                                </select>
                            </div>
                        </div>
                        <button type="submit" disabled={isSubmitting} className="w-full py-5 bg-orange-600 text-white rounded-[24px] font-black uppercase text-xs shadow-xl active:scale-95 transition-all border-b-4 border-orange-900 flex items-center justify-center gap-3">
                            {isSubmitting ? <Loader2 className="animate-spin" /> : <Save size={18}/>} REGISTRAR INSUMO
                        </button>
                    </form>
                </div>
            </div>
        )}

        {/* MODAL: PRODUÇÃO DIÁRIA (ENTRADA EM MASSA) */}
        {showInwardStockModal && (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[100] p-4">
                <div className="bg-white rounded-[48px] w-full max-w-4xl shadow-2xl animate-in zoom-in duration-300 overflow-hidden border-t-8 border-orange-600 max-h-[90vh] flex flex-col">
                    <div className="p-8 border-b bg-gray-50/50 flex justify-between items-center">
                        <div>
                            <h3 className="text-2xl font-black uppercase italic text-blue-950 tracking-tighter">Produção <span className="text-orange-600">Diária</span></h3>
                            <p className="text-gray-400 text-[10px] font-black uppercase tracking-widest mt-1">Incentive o lançamento de entradas de insumos (Ex: Baldes, Caldas)</p>
                        </div>
                        <button onClick={() => setShowInwardStockModal(false)} className="bg-white p-2 rounded-full text-gray-400 hover:text-red-600 transition-all border border-gray-100 shadow-sm"><X size={24}/></button>
                    </div>
                    <div className="p-8 overflow-y-auto no-scrollbar flex-1">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {filteredStock.map(st => (
                                <div key={st.id} className="bg-gray-50 p-6 rounded-[32px] border border-gray-100 shadow-inner group transition-all focus-within:ring-4 focus-within:ring-orange-100">
                                    <div className="flex justify-between items-start mb-4">
                                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Insumo</span>
                                        <span className="text-[9px] font-bold text-orange-600 uppercase italic">Saldo: {st.stock_current} {getUnitAbbr(st.unit)}</span>
                                    </div>
                                    <p className="text-[11px] font-black text-blue-950 uppercase italic leading-none mb-3 truncate">{st.product_base}</p>
                                    <div className="relative">
                                        <input 
                                            type="text" 
                                            placeholder="ADICIONAR..." 
                                            onChange={e => setBulkStockData({...bulkStockData, [st.product_base]: e.target.value})}
                                            className="w-full p-4 bg-white border-none rounded-2xl font-black text-orange-700 placeholder-gray-200 outline-none shadow-sm text-lg"
                                        />
                                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[9px] font-black text-gray-300 uppercase">{getUnitAbbr(st.unit)}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="p-8 bg-gray-50 border-t flex gap-4">
                         <button onClick={() => setShowInwardStockModal(false)} className="flex-1 py-5 bg-white border-2 border-gray-200 rounded-[28px] font-black text-gray-400 uppercase text-xs transition-all active:scale-95">CANCELAR</button>
                         <button onClick={() => handleBulkStockUpdate('production')} disabled={isSubmitting} className="flex-1 py-5 bg-orange-600 text-white rounded-[28px] font-black uppercase text-xs shadow-2xl active:scale-95 transition-all border-b-4 border-orange-900 flex items-center justify-center gap-3">
                             {isSubmitting ? <Loader2 className="animate-spin" /> : <CheckCircle2 size={18}/>} EFETIVAR PRODUÇÃO
                         </button>
                    </div>
                </div>
            </div>
        )}

        {/* MODAL: INVENTÁRIO (AJUSTE EM MASSA) */}
        {showInventoryModal && (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[100] p-4">
                <div className="bg-white rounded-[48px] w-full max-w-4xl shadow-2xl animate-in zoom-in duration-300 overflow-hidden border-t-8 border-blue-900 max-h-[90vh] flex flex-col">
                    <div className="p-8 border-b bg-gray-50/50 flex justify-between items-center">
                        <div>
                            <h3 className="text-2xl font-black uppercase italic text-blue-950 tracking-tighter">Folha de <span className="text-blue-600">Inventário</span></h3>
                            <p className="text-gray-400 text-[10px] font-black uppercase tracking-widest mt-1">Ajuste de saldos físicos conforme conferência real</p>
                        </div>
                        <button onClick={() => setShowInventoryModal(false)} className="bg-white p-2 rounded-full text-gray-400 hover:text-red-600 transition-all border border-gray-100 shadow-sm"><X size={24}/></button>
                    </div>
                    <div className="p-8 overflow-y-auto no-scrollbar flex-1">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {filteredStock.map(st => (
                                <div key={st.id} className="bg-blue-50/50 p-6 rounded-[32px] border border-blue-100 shadow-inner group transition-all focus-within:ring-4 focus-within:ring-blue-100">
                                    <div className="flex justify-between items-start mb-4">
                                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Insumo</span>
                                        <span className="text-[9px] font-bold text-blue-600 uppercase italic">Sist: {st.stock_current} {getUnitAbbr(st.unit)}</span>
                                    </div>
                                    <p className="text-[11px] font-black text-blue-950 uppercase italic leading-none mb-3 truncate">{st.product_base}</p>
                                    <div className="relative">
                                        <input 
                                            type="text" 
                                            placeholder="SALDO FÍSICO..." 
                                            onChange={e => setBulkStockData({...bulkStockData, [st.product_base]: e.target.value})}
                                            className="w-full p-4 bg-white border-none rounded-2xl font-black text-blue-900 placeholder-blue-100 outline-none shadow-sm text-lg"
                                        />
                                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[9px] font-black text-gray-300 uppercase">{getUnitAbbr(st.unit)}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="p-8 bg-gray-50 border-t flex gap-4">
                         <button onClick={() => setShowInventoryModal(false)} className="flex-1 py-5 bg-white border-2 border-gray-200 rounded-[28px] font-black text-gray-400 uppercase text-xs transition-all active:scale-95">CANCELAR</button>
                         <button onClick={() => handleBulkStockUpdate('adjustment')} disabled={isSubmitting} className="flex-1 py-5 bg-blue-900 text-white rounded-[28px] font-black uppercase text-xs shadow-2xl active:scale-95 transition-all border-b-4 border-blue-950 flex items-center justify-center gap-3">
                             {isSubmitting ? <Loader2 className="animate-spin" /> : <Save size={18}/>} EFETIVAR INVENTÁRIO
                         </button>
                    </div>
                </div>
            </div>
        )}

        {/* MODAL: SANGRIAS E CATEGORIAS */}
        {showTransactionModal && (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[100] p-4">
                <div className="bg-white rounded-[40px] w-full max-w-md shadow-2xl animate-in zoom-in duration-300 overflow-hidden border-t-8 border-red-600">
                    <div className="p-8 border-b bg-gray-50/50 flex justify-between items-center">
                        <h3 className="text-xl font-black uppercase italic text-blue-950 flex items-center gap-3"><ArrowDownCircle className="text-red-600" size={24}/> Registrar Saída</h3>
                        <button onClick={() => setShowTransactionModal(false)} className="text-gray-400 hover:text-red-600 transition-all"><X size={24}/></button>
                    </div>
                    <form onSubmit={handleSaveTransaction} className="p-8 space-y-6">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-400 uppercase ml-2 tracking-widest">Categoria da Saída</label>
                            <select value={txForm.category} onChange={e => setTxForm({...txForm, category: e.target.value})} className="w-full p-4 bg-gray-50 border-none rounded-2xl font-black text-gray-900 uppercase italic shadow-inner outline-none focus:ring-4 focus:ring-red-50 cursor-pointer">
                                {expenseCategories.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-400 uppercase ml-2 tracking-widest">Valor da Sangria</label>
                            <input value={txForm.value} onChange={e => setTxForm({...txForm, value: e.target.value})} className="w-full p-4 bg-red-50/50 border-none rounded-2xl font-black text-red-700 text-2xl shadow-inner outline-none focus:ring-4 focus:ring-red-100" placeholder="0,00" />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-400 uppercase ml-2 tracking-widest">Descrição / Motivo</label>
                            <input value={txForm.description} onChange={e => setTxForm({...txForm, description: e.target.value})} className="w-full p-4 bg-gray-50 border-none rounded-2xl font-black text-gray-900 uppercase italic shadow-inner outline-none" placeholder="EX: PAGAMENTO ENERGIA" />
                        </div>
                        <button type="submit" disabled={isSubmitting} className="w-full py-5 bg-red-600 text-white rounded-[24px] font-black uppercase text-xs shadow-xl active:scale-95 transition-all border-b-4 border-red-900 flex items-center justify-center gap-3">
                            {isSubmitting ? <Loader2 className="animate-spin" /> : <Save size={18}/>} EFETIVAR SANGRIA
                        </button>
                    </form>
                </div>
            </div>
        )}

        {/* MODAL: SÓCIOS E PARTILHA */}
        {showPartnersModal && (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[100] p-4">
                <div className="bg-white rounded-[40px] w-full max-w-lg shadow-2xl animate-in zoom-in duration-300 overflow-hidden border-t-8 border-gray-900">
                    <div className="p-8 border-b bg-gray-50/50 flex justify-between items-center">
                        <h3 className="text-xl font-black uppercase italic text-blue-950 flex items-center gap-3"><Users className="text-blue-900" size={24}/> Configurar Sócios</h3>
                        <button onClick={() => setShowPartnersModal(false)} className="text-gray-400 hover:text-red-600 transition-all"><X size={24}/></button>
                    </div>
                    <div className="p-8 space-y-6">
                        <div className="space-y-4">
                            <div className="flex gap-2">
                                <input value={newPartner.name} onChange={e => setNewPartner({...newPartner, name: e.target.value})} className="flex-1 p-3 bg-gray-50 rounded-xl font-black text-[10px] uppercase outline-none" placeholder="NOME DO SÓCIO" />
                                <input value={newPartner.percentage} onChange={e => setNewPartner({...newPartner, percentage: e.target.value})} className="w-20 p-3 bg-gray-50 rounded-xl font-black text-[10px] text-center outline-none" placeholder="%" />
                                <button onClick={handleAddPartner} disabled={isSubmitting} className="p-3 bg-gray-900 text-white rounded-xl hover:bg-black transition-all shadow-md"><Plus size={18}/></button>
                            </div>
                            <div className="space-y-2">
                                {partners.map(p => (
                                    <div key={p.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-xl border border-gray-100 group">
                                        <span className="text-[10px] font-black text-blue-950 uppercase italic">{p.partner_name} ({p.percentage}%)</span>
                                        <button onClick={() => handleRemovePartner(p.id)} className="text-gray-200 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-all"><Trash2 size={16}/></button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        )}

        {/* MODAL: CANCELAR VENDA */}
        {showCancelModal && (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[110] p-4">
                <div className="bg-white rounded-[40px] p-10 max-w-sm w-full text-center shadow-2xl animate-in zoom-in duration-200">
                    <div className="p-5 bg-red-50 text-red-600 rounded-full w-fit mx-auto mb-6"><AlertTriangle size={48} /></div>
                    <h3 className="text-2xl font-black text-gray-900 uppercase italic mb-2 tracking-tighter">Estornar <span className="text-red-600">Venda?</span></h3>
                    <p className="text-gray-400 text-xs font-bold uppercase mb-8">Esta ação irá anular a entrada de caixa e devolver os insumos ao estoque.</p>
                    <div className="space-y-4">
                        <input value={cancelReason} onChange={e => setCancelReason(e.target.value.toUpperCase())} className="w-full p-4 bg-gray-50 border-2 border-gray-100 rounded-2xl text-[10px] font-black uppercase outline-none focus:border-red-600 mb-4 shadow-inner" placeholder="MOTIVO DO ESTORNO..." />
                        <div className="flex gap-3">
                            <button onClick={() => setShowCancelModal(null)} className="flex-1 py-4 bg-gray-100 text-gray-500 rounded-2xl font-black uppercase text-[10px]">Voltar</button>
                            <button onClick={handleCancelSale} disabled={!cancelReason || isSubmitting} className="flex-1 py-4 bg-red-600 text-white rounded-2xl font-black uppercase text-[10px] shadow-lg active:scale-95 disabled:opacity-30">Confirmar</button>
                        </div>
                    </div>
                </div>
            </div>
        )}

        {/* MODAL: CATEGORIAS DE DESPESA */}
        {showCategoryModal && (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[100] p-4">
                <div className="bg-white rounded-[40px] w-full max-w-md shadow-2xl animate-in zoom-in duration-300 overflow-hidden border-t-8 border-gray-100">
                    <div className="p-8 border-b bg-gray-50/50 flex justify-between items-center">
                        <h3 className="text-xl font-black uppercase italic text-blue-950 flex items-center gap-3"><Sliders className="text-gray-400" size={24}/> Categorias Sangria</h3>
                        <button onClick={() => setShowCategoryModal(false)} className="text-gray-400 hover:text-red-600 transition-all"><X size={24}/></button>
                    </div>
                    <div className="p-8 space-y-6">
                        <div className="flex gap-2">
                            <input value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)} className="flex-1 p-3 bg-gray-50 rounded-xl font-black text-[10px] uppercase outline-none" placeholder="NOVA CATEGORIA..." />
                            <button onClick={handleAddExpenseCategory} disabled={isSubmitting} className="p-3 bg-gray-900 text-white rounded-xl hover:bg-black transition-all shadow-md"><Plus size={18}/></button>
                        </div>
                        <div className="space-y-2 max-h-60 overflow-y-auto no-scrollbar">
                            {expenseCategories.map(cat => (
                                <div key={cat} className="flex justify-between items-center p-3 bg-gray-50 rounded-xl border border-gray-100 group">
                                    <span className="text-[10px] font-black text-gray-700 uppercase italic">{cat}</span>
                                    <button onClick={() => handleDeleteExpenseCategory(cat)} className="text-gray-200 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-all"><Trash size={16}/></button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};

export default IceCreamModule;
