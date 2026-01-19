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
  const effectiveStoreId = manualStoreId || user.storeId || (stores.length > 0 ? stores[0].id : '');
  
  const cartTotal = useMemo(() => cart.reduce((acc, curr) => acc + curr.totalValue, 0), [cart]);

  const changeDue = useMemo(() => {
    const received = parseFloat(amountReceived.replace(',', '.')) || 0;
    return Math.max(0, received - cartTotal);
  }, [amountReceived, cartTotal]);

  const fetchPartners = async () => {
    const { data } = await supabase
        .from('store_profit_distribution')
        .select('*')
        .eq('store_id', effectiveStoreId)
        .eq('active', true)
        .order('created_at', { ascending: true });
    if (data) setPartners(data);
  };

  const fetchExpenseCategories = async () => {
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
              const value = parseFloat(valueStr.replace(',', '.'));
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

  return (
    <div className="flex flex-col h-full bg-gray-50 overflow-hidden font-sans relative">
        <div className="bg-white border-b px-4 md:px-6 py-2 flex flex-col md:flex-row justify-between items-center gap-2 z-40 shadow-sm shrink-0">
            <div className="flex items-center gap-2">
                <div className="p-1.5 bg-blue-900 rounded-xl text-white shadow-lg shrink-0"><IceCream size={18} /></div>
                <div className="truncate">
                    <h2 className="text-sm md:text-base font-black uppercase italic tracking-tighter text-blue-950 leading-none">Gelateria <span className="text-red-600">Real</span></h2>
                    <div className="flex items-center gap-1 mt-0.5">
                        <p className="text-[7px] font-black text-gray-400 uppercase tracking-widest leading-none">Unidade</p>
                        <select 
                            value={effectiveStoreId} 
                            onChange={(e) => setManualStoreId(e.target.value)}
                            className="bg-transparent border-none text-[8px] font-black text-blue-600 uppercase outline-none cursor-pointer focus:ring-0 p-0 h-auto min-h-0"
                        >
                            {[...stores].sort((a, b) => parseInt(a.number || '0') - parseInt(b.number || '0')).map(s => (
                                <option key={s.id} value={s.id}>{s.number} - {s.city}</option>
                            ))}
                        </select>
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
                        <PDVMobileView user={user} items={filteredItems} cart={cart} setCart={setCart} selectedCategory={selectedCategory} setSelectedCategory={setSelectedCategory} selectedProductName={null} setSelectedProductName={() => {}} selectedItem={null} setSelectedItem={() => {}} selectedMl="" setSelectedMl={() => {}} quantity={1} setQuantity={() => {}} paymentMethod={paymentMethod} setPaymentMethod={setPaymentMethod} buyerName={buyerName} setBuyerName={setBuyerName} onAddSales={onAddSales} onCancelSale={onCancelSale} onAddTransaction={onAddTransaction} dailyData={dreStats} handlePrintTicket={printThermalTicket} isSubmitting={isSubmitting} setIsSubmitting={setIsSubmitting} />
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

            {activeTab === 'dre_diario' && (
                <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-6 animate-in fade-in duration-500">
                    <div className="flex justify-between items-center bg-white p-6 rounded-[32px] shadow-sm border border-gray-100">
                        <div><h3 className="text-xl font-black uppercase italic tracking-tighter text-blue-950">Fechamento <span className="text-red-600">do Dia</span></h3><p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{new Date().toLocaleDateString('pt-BR')}</p></div>
                        <button onClick={() => setShowTransactionModal(true)} className="bg-red-600 text-white px-5 py-3 rounded-2xl font-black uppercase text-[10px] shadow-lg flex items-center gap-2 hover:bg-red-700 transition-all border-b-4 border-red-900"><ArrowDownCircle size={16}/> Lançar Sangria</button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="md:col-span-2 bg-white p-8 rounded-[40px] shadow-sm border border-gray-100">
                            <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-6">Faturamento por Forma de Pagamento</h4>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-5 bg-green-50 rounded-3xl border border-green-100"><div className="flex items-center gap-2 mb-2 text-green-600"><Zap size={14}/><span className="text-[10px] font-black uppercase">Pix</span></div><p className="text-xl font-black text-green-700 italic">{formatCurrency(dreStats.dayMethods.pix)}</p></div>
                                <div className="p-5 bg-blue-50 rounded-3xl border border-blue-100"><div className="flex items-center gap-2 mb-2 text-blue-600"><Banknote size={14}/><span className="text-[10px] font-black uppercase">Dinheiro</span></div><p className="text-xl font-black text-blue-700 italic">{formatCurrency(dreStats.dayMethods.money)}</p></div>
                                <div className="p-5 bg-orange-50 rounded-3xl border border-orange-100"><div className="flex items-center gap-2 mb-2 text-orange-600"><CreditCard size={14}/><span className="text-[10px] font-black uppercase">Cartão</span></div><p className="text-xl font-black text-orange-700 italic">{formatCurrency(dreStats.dayMethods.card)}</p></div>
                                <div className="p-5 bg-red-50 rounded-3xl border border-red-100"><div className="flex items-center gap-2 mb-2 text-red-600"><UsersIcon size={14}/><span className="text-[10px] font-black uppercase">Fiado</span></div><p className="text-xl font-black text-red-700 italic">{formatCurrency(dreStats.dayMethods.fiado)}</p></div>
                            </div>
                        </div>
                        <div className="space-y-6"><div className="bg-gray-900 p-8 rounded-[40px] shadow-2xl text-white border-b-8 border-green-500"><p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Entrada Líquida Hoje</p><h3 className="text-4xl font-black italic tracking-tighter">{formatCurrency(dreStats.dayIn - dreStats.dayOut)}</h3></div></div>
                    </div>
                </div>
            )}

            {activeTab === 'dre_mensal' && (
                <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500 pb-20">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-[32px] border shadow-sm">
                        <div><h3 className="text-2xl font-black uppercase italic tracking-tighter flex items-center gap-3"><Calculator className="text-blue-900" size={32}/> DRE Mensal <span className="text-red-600">Gelateria</span></h3><p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1 ml-11">Relatório Consolidado de Unidade</p></div>
                        <div className="flex flex-wrap gap-2 items-center">
                            <div className="flex bg-gray-50 p-1 rounded-2xl border border-gray-200 shadow-inner"><select value={selectedMonth} onChange={e => setSelectedMonth(Number(e.target.value))} className="bg-transparent text-gray-700 font-black px-4 py-2 outline-none uppercase text-xs cursor-pointer">{MONTHS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}</select><div className="w-px h-6 bg-gray-300 self-center"></div><select value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))} className="bg-transparent text-gray-700 font-black px-4 py-2 outline-none text-xs cursor-pointer">{[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}</select></div>
                            <button onClick={() => handlePrintDRE(false)} className="bg-blue-600 text-white min-w-[120px] h-11 rounded-2xl font-black uppercase text-[10px] shadow-xl hover:bg-blue-700 transition-all flex items-center justify-center gap-2 border-b-4 border-blue-800"><Printer size={16}/> Resumo</button>
                            <button onClick={() => handlePrintDRE(true)} className="bg-emerald-600 text-white min-w-[120px] h-11 rounded-2xl font-black uppercase text-[10px] shadow-xl hover:bg-emerald-700 transition-all flex items-center justify-center gap-2 border-b-4 border-emerald-800"><FileText size={16}/> Detalhado</button>
                            <button onClick={() => setShowPartnersModal(true)} className="bg-blue-950 text-white min-w-[120px] h-11 rounded-2xl font-black uppercase text-[10px] shadow-xl flex items-center justify-center gap-2 hover:bg-black transition-all border-b-4 border-blue-800"><Users size={16}/> Sócios</button>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-white p-8 rounded-[40px] shadow-sm border border-gray-100 relative group overflow-hidden"><p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Faturamento Bruto (+)</p><h3 className="text-3xl font-black text-green-600 italic">{formatCurrency(dreStats.monthIn)}</h3><div className="mt-4 grid grid-cols-2 gap-2 border-t pt-4"><div><p className="text-[8px] font-black text-gray-400 uppercase">Pix</p><p className="text-xs font-black text-gray-700">{formatCurrency(dreStats.monthMethods.pix)}</p></div><div><p className="text-[8px] font-black text-gray-400 uppercase">Cartão</p><p className="text-xs font-black text-gray-700">{formatCurrency(dreStats.monthMethods.card)}</p></div><div><p className="text-[8px] font-black text-gray-400 uppercase">Dinheiro</p><p className="text-xs font-black text-gray-700">{formatCurrency(dreStats.monthMethods.money)}</p></div><div><p className="text-[8px] font-black text-gray-400 uppercase">Fiado</p><p className="text-xs font-black text-gray-700">{formatCurrency(dreStats.monthMethods.fiado)}</p></div></div></div>
                        <div className="bg-white p-8 rounded-[40px] shadow-sm border border-gray-100 relative group overflow-hidden"><p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Total Despesas (-)</p><h3 className="text-3xl font-black text-red-600 italic">{formatCurrency(dreStats.monthOut)}</h3><p className="text-[9px] font-bold text-gray-400 uppercase mt-4 italic">Baseado em sangrias lançadas</p></div>
                        <div className="bg-blue-900 p-8 rounded-[40px] shadow-2xl text-white relative overflow-hidden"><div className="absolute top-0 right-0 p-6 opacity-10"><DollarSign size={80}/></div><p className="text-[10px] font-black text-blue-300 uppercase tracking-widest mb-2">Lucro Líquido Real</p><h3 className={`text-4xl font-black italic tracking-tighter ${dreStats.profit >= 0 ? 'text-white' : 'text-red-400'}`}>{formatCurrency(dreStats.profit)}</h3></div>
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        <div className="bg-white p-8 rounded-[48px] border shadow-sm flex flex-col h-[500px]"><h4 className="text-sm font-black text-gray-900 uppercase italic tracking-tighter mb-6 flex items-center gap-2"><ListChecks size={20} className="text-blue-600"/> Detalhamento de Saídas</h4><div className="overflow-y-auto flex-1 pr-2 no-scrollbar"><table className="w-full text-left text-[10px]"><thead className="sticky top-0 bg-white border-b z-10 font-black text-gray-400 uppercase"><tr><th className="py-3">Data</th><th className="py-3">Categoria</th><th className="py-3 text-right">Valor</th></tr></thead><tbody className="divide-y font-bold uppercase italic text-gray-600">{(dreStats.monthExits ?? []).map(ex => (<tr key={ex.id} className="hover:bg-gray-50"><td className="py-4">{new Date(ex.date + 'T00:00:00').toLocaleDateString('pt-BR')}</td><td className="py-4">{ex.category} <span className="block text-[8px] not-italic text-gray-400">{ex.description}</span></td><td className="py-4 text-right text-red-600">{formatCurrency(ex.value)}</td></tr>))}{(!dreStats.monthExits || dreStats.monthExits.length === 0) && (<tr><td colSpan={3} className="py-20 text-center text-gray-300 uppercase">Nenhuma despesa no período</td></tr>)}</tbody></table></div></div>
                        <div className="bg-gray-900 p-8 rounded-[48px] shadow-2xl text-white border-t-8 border-red-600 flex flex-col h-[500px]"><div className="flex justify-between items-center mb-8 border-b border-white/10 pb-6"><h3 className="text-xl font-black uppercase italic tracking-tighter flex items-center gap-3"><Handshake className="text-red-500" size={28}/> Partilha de Resultados</h3></div><div className="flex-1 overflow-y-auto pr-2 no-scrollbar space-y-8">{(partners ?? []).length > 0 ? partners.map(p => (<div key={p.id} className="space-y-4"><div className="flex justify-between items-end"><div><p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">{p.partner_name} ({p.percentage}%)</p><p className="text-3xl font-black italic text-white leading-none">{formatCurrency(dreStats.profit > 0 ? (dreStats.profit * p.percentage) / 100 : 0)}</p></div><UsersIcon className="text-blue-500/30" size={32} /></div><div className="w-full h-2 bg-white/10 rounded-full overflow-hidden"><div className="h-full bg-blue-500" style={{ width: `${p.percentage}%` }}></div></div></div>)) : (<div className="py-20 text-center opacity-30 uppercase italic font-black text-xs tracking-widest">Defina o quadro societário em "Config. Sócios"</div>)}</div></div>
                    </div>
                </div>
            )}

            {activeTab === 'estoque' && (
                <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-6 animate-in fade-in duration-500">
                    <div className="bg-white rounded-[40px] shadow-sm border border-gray-100 overflow-hidden">
                        <div className="p-6 md:p-8 border-b bg-gray-50 flex flex-col lg:flex-row justify-between items-center gap-4"><div className="text-center lg:text-left"><h3 className="text-xl font-black uppercase italic tracking-tighter">Gestão de <span className="text-blue-600">Estoque</span></h3><p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mt-1">Insumos e Matérias-Primas</p></div><div className="flex flex-row flex-nowrap items-center gap-2 justify-center lg:justify-end overflow-x-auto no-scrollbar pb-1"><button onClick={handlePrintStock} className="bg-gray-100 text-gray-600 px-3 py-2.5 rounded-xl font-black uppercase text-[9px] flex items-center gap-1.5 hover:bg-gray-200 transition-all border border-gray-200 shrink-0"><Clipboard size={14}/> Conferência</button><button onClick={() => { setBulkStockData({}); setShowInventoryModal(true); }} className="bg-orange-500 text-white px-3 py-2.5 rounded-xl font-black uppercase text-[9px] shadow-lg flex items-center gap-1.5 hover:bg-orange-600 transition-all border-b-4 border-orange-700 shrink-0"><Edit3 size={14}/> Inventário</button><button onClick={() => { setBulkStockData({}); setShowInwardStockModal(true); }} className="bg-green-600 text-white px-3 py-2.5 rounded-xl font-black uppercase text-[9px] shadow-lg flex items-center gap-1.5 hover:bg-green-700 transition-all border-b-4 border-green-800 shrink-0"><PackagePlus size={14}/> Entrada</button><button onClick={() => { setEditingStockItem(null); setShowNewStockModal(true); }} className="bg-blue-900 text-white px-3 py-2.5 rounded-xl font-black uppercase text-[9px] shadow-lg flex items-center gap-1.5 hover:bg-black transition-all border-b-4 border-blue-950 shrink-0"><Plus size={14}/> Criar Base</button></div></div>
                        <div className="divide-y divide-gray-50">{(filteredStock ?? []).map(st => (<div key={st.id} className="p-4 flex justify-between items-center hover:bg-blue-50/20 transition-all group"><div className="flex items-center gap-3"><div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center text-gray-400"><Package size={20}/></div><div><p className="font-black uppercase text-gray-900 text-[11px] italic tracking-tight">{st.product_base}</p><p className="text-[7px] font-bold text-gray-400 uppercase tracking-widest leading-none">Insumo Operacional</p></div></div><div className="flex items-center gap-4"><div className="text-right"><span className={`text-xl font-black italic ${st.stock_current <= 50 ? 'text-red-600' : 'text-blue-900'}`}>{st.stock_current}</span><span className="ml-1 text-[8px] font-bold text-gray-400 uppercase">{st.unit}</span></div><div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity"><button onClick={() => { setEditingStockItem(st); setShowNewStockModal(true); }} className="p-2 text-blue-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"><Edit3 size={16}/></button><button onClick={() => handleDeleteStockItem(st.id)} className="p-2 text-red-300 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"><Trash2 size={16}/></button></div></div></div>))}</div>
                    </div>
                </div>
            )}

            {activeTab === 'audit' && (
                <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
                    <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-8 rounded-[40px] shadow-sm border border-gray-100">
                        <div>
                            <h3 className="text-xl font-black uppercase italic tracking-tighter">Central de <span className="text-red-600">Auditoria</span></h3>
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Sincronização de Vendas e Fiados</p>
                        </div>
                        <div className="flex gap-2">
                             <div className="flex bg-gray-100 p-1 rounded-2xl border border-gray-200 shadow-inner">
                                <select value={selectedMonth} onChange={e => setSelectedMonth(Number(e.target.value))} className="bg-transparent text-gray-700 font-black px-4 py-2 outline-none uppercase text-xs cursor-pointer">{MONTHS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}</select>
                                <div className="w-px h-6 bg-gray-300 self-center"></div>
                                <select value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))} className="bg-transparent text-gray-700 font-black px-4 py-2 outline-none text-xs cursor-pointer">{[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}</select>
                            </div>
                            <button onClick={handlePrintFiado} className="bg-blue-900 text-white px-6 py-3 rounded-2xl font-black uppercase text-[10px] shadow-lg flex items-center gap-2 hover:bg-black transition-all border-b-4 border-blue-950">
                                <Printer size={16}/> Imprimir Fiados (A4)
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        <div className="lg:col-span-2 bg-white rounded-[40px] shadow-sm border border-gray-100 overflow-hidden">
                            <div className="p-6 border-b bg-gray-50 flex justify-between items-center">
                                <h4 className="text-xs font-black uppercase text-gray-900 italic">Histórico Geral de Vendas</h4>
                                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{(sales ?? []).filter(s => s.storeId === effectiveStoreId).length} REGISTROS</span>
                            </div>
                            <div className="overflow-x-auto max-h-[600px] no-scrollbar">
                                <table className="w-full text-left">
                                    <thead className="bg-white text-[9px] font-black text-gray-400 uppercase tracking-widest border-b">
                                        <tr><th className="px-6 py-4">Cod. / Data</th><th className="px-6 py-4">Itens</th><th className="px-6 py-4">Pagamento</th><th className="px-6 py-4 text-right">Valor</th><th className="px-6 py-4 text-center">Status</th></tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                        {(sales ?? []).filter(s => s.storeId === effectiveStoreId).sort((a,b) => (b.createdAt || '').localeCompare(a.createdAt || '')).map(s => (
                                            <tr key={s.id} className={`hover:bg-blue-50/20 transition-colors ${s.status === 'canceled' ? 'opacity-40 grayscale' : ''}`}>
                                                <td className="px-6 py-4"><div className="font-black text-[11px] text-blue-900 italic">#{s.saleCode}</div><div className="text-[8px] text-gray-400 font-bold uppercase">{new Date(s.createdAt!).toLocaleString('pt-BR')}</div></td>
                                                <td className="px-6 py-4 font-black text-[11px] uppercase italic text-gray-700">{s.unitsSold}x {s.productName}{s.buyer_name && <p className="text-[8px] text-red-500 not-italic mt-1">Ref: ${s.buyer_name}</p>}</td>
                                                <td className="px-6 py-4"><span className={`px-2 py-1 rounded-lg text-[8px] font-black uppercase border ${s.paymentMethod === 'Fiado' ? 'bg-red-50 text-red-700 border-red-100' : 'bg-green-50 text-green-700 border-green-100'}`}>{s.paymentMethod}</span></td>
                                                <td className="px-6 py-4 text-right font-black text-blue-900 italic text-[11px]">{formatCurrency(s.totalValue)}</td>
                                                <td className="px-6 py-4 text-center">{s.status === 'canceled' ? (<span className="text-[7px] font-black text-red-600 bg-red-100 px-2 py-1 rounded-full uppercase">Cancelado</span>) : (<button onClick={() => setShowCancelModal({ code: s.saleCode! })} className="p-1.5 text-gray-300 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all" title="Cancelar Venda"><Ban size={14}/></button>)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div className="bg-gray-900 rounded-[40px] shadow-2xl text-white border-t-8 border-blue-600 flex flex-col h-[700px]">
                            <div className="p-8 border-b border-white/10">
                                <h4 className="text-base font-black uppercase italic tracking-tighter flex items-center gap-3">
                                    <UsersIcon className="text-blue-500" size={24}/> Acúmulo Fiado <span className="text-blue-300 opacity-50">Mensal</span>
                                </h4>
                                <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest mt-2 italic">Ref: {MONTHS.find(m=>m.value===selectedMonth)?.label}</p>
                            </div>
                            <div className="flex-1 overflow-y-auto p-6 space-y-4 no-scrollbar">
                                {fiadoReport.map(f => (
                                    <div key={f.name} className="bg-white/5 p-5 rounded-3xl border border-white/10 hover:bg-white/10 transition-all group">
                                        <div className="flex justify-between items-end">
                                            <div>
                                                <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1 group-hover:text-blue-400 transition-colors">{f.name}</p>
                                                <p className="text-2xl font-black italic text-white leading-none tracking-tighter">{formatCurrency(f.total)}</p>
                                            </div>
                                            <div className="p-2 bg-blue-600/20 text-blue-400 rounded-xl group-hover:scale-110 transition-transform"><ArrowRight size={16}/></div>
                                        </div>
                                    </div>
                                ))}
                                {fiadoReport.length === 0 && (
                                    <div className="py-20 text-center opacity-30 uppercase italic font-black text-[10px] tracking-widest">Nenhuma compra fiado neste mês</div>
                                )}
                            </div>
                            <div className="p-8 bg-blue-600 rounded-b-[40px]">
                                <p className="text-[9px] font-black text-blue-100 uppercase tracking-widest mb-1">Total Consolidado Fiados</p>
                                <p className="text-3xl font-black italic">{formatCurrency(fiadoReport.reduce((a,b)=>a+b.total, 0))}</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'produtos' && (
                <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-6 animate-in fade-in duration-500">
                    <div className="flex justify-between items-center bg-white p-6 rounded-[32px] shadow-sm border border-gray-100">
                        <div><h3 className="text-xl font-black uppercase italic tracking-tighter text-blue-950">Catálogo de <span className="text-blue-600">Produtos</span></h3><p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{(filteredItems ?? []).length} Itens Ativos</p></div>
                        <button onClick={() => { setEditingProduct(null); setNewProd({name: '', category: 'Copinho', price: '', flavor: ''}); setTempRecipe([]); setShowProductModal(true); }} className="bg-blue-900 text-white px-5 py-3 rounded-2xl font-black uppercase text-[10px] shadow-lg flex items-center gap-2 hover:bg-black transition-all border-b-4 border-blue-950"><Plus size={16}/> Novo Produto</button>
                    </div>
                    <div className="bg-white rounded-[40px] shadow-sm border border-gray-100 overflow-hidden">
                        <table className="w-full text-left">
                            <thead className="bg-gray-50 text-[9px] font-black text-gray-400 uppercase tracking-widest border-b"><tr><th className="px-8 py-5">Produto</th><th className="px-8 py-5">Categoria</th><th className="px-8 py-5 text-right">Preço</th><th className="px-8 py-5 text-right">Ações</th></tr></thead>
                            <tbody className="divide-y divide-gray-50">{(filteredItems ?? []).map(item => (<tr key={item.id} className="hover:bg-blue-50/20 transition-all group"><td className="px-8 py-5 flex items-center gap-4"><div className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center text-gray-300 shrink-0">{item.image_url ? <img src={item.image_url} className="w-full h-full object-cover rounded-2xl" /> : <ImageIcon size={20}/>}</div><div><p className="font-black uppercase italic text-sm text-gray-900">{item.name}</p>{item.recipe && (typeof item.recipe === 'string' ? JSON.parse(item.recipe) : item.recipe).length > 0 && (<p className="text-[7px] font-bold text-blue-500 uppercase tracking-widest mt-1">Composição: {(typeof item.recipe === 'string' ? JSON.parse(item.recipe) : item.recipe).map((r: any) => `${r.quantity}x ${r.stock_base_name}`).join(', ')}</p>)}</div></td><td className="px-8 py-5"><span className="px-3 py-1.5 rounded-xl bg-blue-50 text-blue-700 text-[9px] font-black uppercase border border-blue-100">{item.category}</span></td><td className="px-8 py-5 text-right font-black text-blue-900 italic">{formatCurrency(item.price)}</td><td className="px-8 py-5 text-right"><div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all"><button onClick={() => handleEditProduct(item)} className="p-2 text-blue-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all" title="Editar Produto"><Edit3 size={18}/></button><button onClick={() => onDeleteItem(item.id)} className="p-2 text-red-300 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all" title="Remover"><Trash2 size={18}/></button></div></td></tr>))}</tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>

        {/* MODAL: NOVO / EDITAR PRODUTO */}
        {showProductModal && (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[120] p-4">
                <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in duration-300 border-t-8 border-blue-900 max-h-[95vh] flex flex-col">
                    <div className="p-8 bg-gray-50 border-b flex justify-between items-center shrink-0"><h3 className="text-xl font-black uppercase italic tracking-tighter">{editingProduct ? 'Editar' : 'Novo'} <span className="text-blue-600">Produto</span></h3><button onClick={() => {setShowProductModal(false); setEditingProduct(null);}} className="bg-white p-2 rounded-full text-gray-400 hover:text-red-600 transition-all shadow-sm"><X size={24}/></button></div>
                    <form onSubmit={handleSaveProduct} className="flex-1 overflow-y-auto p-10 space-y-8 no-scrollbar"><div className="grid grid-cols-1 md:grid-cols-2 gap-6"><div className="space-y-2"><label className="text-[10px] font-black text-gray-400 uppercase ml-2 tracking-widest">Identificação</label><input required value={newProd.name} onChange={e => setNewProd({...newProd, name: e.target.value})} className="w-full p-4 bg-gray-50 border-none rounded-2xl text-sm font-black uppercase italic outline-none focus:ring-4 focus:ring-blue-100 shadow-inner" placeholder="EX: CASCÃO MODERNO" /></div><div className="space-y-2"><label className="text-[10px] font-black text-gray-400 uppercase ml-2 tracking-widest">Preço de Venda (R$)</label><input required value={newProd.price} onChange={e => setNewProd({...newProd, price: e.target.value})} className="w-full p-4 bg-gray-50 border-none rounded-2xl text-lg font-black text-blue-900 italic outline-none focus:ring-4 focus:ring-blue-100 shadow-inner" placeholder="0,00" /></div></div><div className="grid grid-cols-1 md:grid-cols-2 gap-6"><div className="space-y-2"><label className="text-[10px] font-black text-gray-400 uppercase ml-2 tracking-widest">Categoria</label><select value={newProd.category} onChange={e => setNewProd({...newProd, category: e.target.value as any})} className="w-full p-4 bg-gray-50 border-none rounded-2xl text-xs font-black uppercase outline-none shadow-inner cursor-pointer">{PRODUCT_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}</select></div><div className="space-y-2"><label className="text-[10px] font-black text-gray-400 uppercase ml-2 tracking-widest">Sabor / Detalhe</label><input value={newProd.flavor} onChange={e => setNewProd({...newProd, flavor: e.target.value})} className="w-full p-4 bg-gray-50 border-none rounded-2xl text-xs font-black uppercase italic outline-none focus:ring-4 focus:ring-blue-100 shadow-inner" placeholder="Padrão / Misto / etc" /></div></div><div className="bg-blue-50/50 p-6 rounded-[32px] border-2 border-blue-100 space-y-4"><div className="flex items-center gap-2 mb-2"><Beaker size={18} className="text-blue-600"/><h4 className="text-[10px] font-black text-blue-900 uppercase tracking-widest">Composição (Receita / Baixa de Estoque)</h4></div><div className="flex flex-col md:flex-row gap-2"><select value={newRecipeItem.stock_base_name} onChange={e => setNewRecipeItem({...newRecipeItem, stock_base_name: e.target.value})} className="flex-1 p-4 bg-white border border-blue-100 rounded-2xl text-[10px] font-black uppercase italic outline-none"><option value="">Selecione um insumo...</option>{(filteredStock ?? []).map(s => <option key={s.id} value={s.product_base}>{s.product_base} ({s.unit})</option>)}</select><input type="number" value={newRecipeItem.quantity} onChange={e => setNewRecipeItem({...newRecipeItem, quantity: e.target.value})} className="w-20 p-4 bg-white border border-blue-100 rounded-2xl text-center font-black" /><button type="button" onClick={() => { if(!newRecipeItem.stock_base_name) return; setTempRecipe([...tempRecipe, { stock_base_name: newRecipeItem.stock_base_name, quantity: Number(newRecipeItem.quantity) }]); setNewRecipeItem({ stock_base_name: '', quantity: '1' }); }} className="bg-blue-900 text-white p-4 rounded-2xl hover:bg-black transition-all shadow-md"><Plus size={18}/></button></div><div className="space-y-2">{tempRecipe.map((ri, idx) => (<div key={idx} className="bg-white p-3 rounded-xl border border-blue-50 flex justify-between items-center group"><p className="text-[10px] font-black uppercase text-blue-900 italic">{ri.quantity}x {ri.stock_base_name}</p><button type="button" onClick={() => setTempRecipe(tempRecipe.filter((_, i) => i !== idx))} className="p-1.5 text-red-300 hover:text-red-600 transition-colors"><Trash2 size={14}/></button></div>))}</div></div><button type="submit" disabled={isSubmitting} className="w-full py-5 bg-blue-900 text-white rounded-[24px] font-black uppercase text-xs shadow-xl active:scale-95 transition-all border-b-4 border-blue-950">{isSubmitting ? <Loader2 className="animate-spin" /> : <Save size={18}/>} Efetivar Dados</button></form>
                </div>
            </div>
        )}

        {/* MODAL: SANGRIAS */}
        {showTransactionModal && (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[120] p-4">
                <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-lg overflow-hidden border-t-8 border-red-600">
                    <div className="p-8 bg-gray-50 border-b flex justify-between items-center"> 
                        <h3 className="text-xl font-black uppercase italic tracking-tighter">Lançar <span className="text-red-600">Sangria</span></h3> 
                        <button onClick={() => setShowTransactionModal(false)} className="bg-white p-2 rounded-full text-gray-400 hover:text-red-600 transition-all shadow-sm"><X size={24}/></button> 
                    </div>
                    <form onSubmit={handleSaveTransaction} className="p-10 space-y-6"> 
                        <div className="grid grid-cols-2 gap-4"> 
                            <div className="space-y-2"> 
                                <label className="text-[10px] font-black text-gray-400 uppercase ml-2 tracking-widest">Valor (R$)</label> 
                                <input required value={txForm.value} onChange={e => setTxForm({...txForm, value: e.target.value})} className="w-full p-4 bg-red-50 border-none rounded-2xl text-2xl font-black text-red-600 italic outline-none shadow-inner" placeholder="0,00" /> </div> <div className="space-y-2"> <label className="text-[10px] font-black text-gray-400 uppercase ml-2 tracking-widest flex justify-between"> Categoria <button type="button" onClick={() => setShowCategoryModal(true)} className="text-blue-600 hover:text-blue-800 transition-colors"><Settings size={12}/></button> </label> <select value={txForm.category} onChange={e => setTxForm({...txForm, category: e.target.value})} className="w-full p-4 bg-gray-50 border-none rounded-2xl text-xs font-black uppercase outline-none shadow-inner cursor-pointer"> {expenseCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)} </select> </div> </div> <div className="space-y-2"> <label className="text-[10px] font-black text-gray-400 uppercase ml-2 tracking-widest">Descrição</label> <input required value={txForm.description} onChange={e => setTxForm({...txForm, description: e.target.value})} className="w-full p-4 bg-gray-50 border-none rounded-2xl text-sm font-black uppercase italic outline-none focus:ring-4 focus:ring-red-100 shadow-inner" placeholder="EX: COMPRA DE LEITE" /> </div> <button type="submit" disabled={isSubmitting} className="w-full py-5 bg-red-600 text-white rounded-[24px] font-black uppercase text-xs shadow-xl active:scale-95 transition-all border-b-4 border-red-900"> {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : <Save size={18}/>} Confirmar Sangria </button> </form></div>
            </div>
        )}

        {/* MODAL: GERENCIAR CATEGORIAS DE DESPESA */}
        {showCategoryModal && (
            <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-[130] p-4">
                <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-md overflow-hidden border-t-8 border-blue-600">
                    <div className="p-8 bg-gray-50 border-b flex justify-between items-center"> 
                        <h3 className="text-lg font-black uppercase italic tracking-tighter">Categorias de <span className="text-blue-600">Despesa</span></h3> 
                        <button onClick={() => setShowCategoryModal(false)} className="bg-white p-2 rounded-full text-gray-400 hover:text-red-600 transition-all shadow-sm"><X size={20}/></button> 
                    </div>
                    <div className="p-8 space-y-6">
                        <div className="flex gap-2">
                            <input 
                                value={newCategoryName} 
                                onChange={e => setNewCategoryName(e.target.value)} 
                                className="flex-1 p-4 bg-gray-50 rounded-2xl text-xs font-black uppercase outline-none shadow-inner border border-gray-100" 
                                placeholder="NOVA CATEGORIA..." 
                            />
                            <button onClick={handleAddExpenseCategory} disabled={isSubmitting} className="bg-blue-600 text-white p-4 rounded-2xl shadow-lg hover:bg-blue-700 active:scale-95 transition-all">
                                <Plus size={20}/>
                            </button>
                        </div>
                        <div className="max-h-60 overflow-y-auto no-scrollbar divide-y divide-gray-100 border rounded-2xl">
                            {expenseCategories.map(cat => (
                                <div key={cat} className="p-4 flex justify-between items-center hover:bg-gray-50">
                                    <span className="text-[10px] font-black uppercase text-gray-700 italic">{cat}</span>
                                    <button onClick={() => handleDeleteExpenseCategory(cat)} className="text-red-300 hover:text-red-600 transition-colors p-1">
                                        <Trash2 size={14}/>
                                    </button>
                                </div>
                            ))}
                        </div>
                        <button onClick={() => setShowCategoryModal(false)} className="w-full py-4 bg-gray-900 text-white rounded-2xl font-black uppercase text-[10px] shadow-lg active:scale-95 transition-all">Concluir</button>
                    </div>
                </div>
            </div>
        )}

        {/* MODAL: SÓCIOS */}
        {showPartnersModal && (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[110] p-4"><div className="bg-white rounded-[40px] w-full max-w-xl shadow-2xl overflow-hidden border-t-8 border-blue-950"><div className="p-8 border-b bg-gray-50 flex justify-between items-center"> <div><h3 className="text-xl font-black uppercase italic tracking-tighter">Configuração de <span className="text-red-600">Sócios</span></h3></div> <button onClick={() => setShowPartnersModal(false)} className="text-gray-400 hover:text-red-600 transition-all"><X size={32}/></button> </div><div className="p-10 space-y-8"> <div className="bg-blue-50 p-6 rounded-[32px] space-y-4 border border-blue-100"> <label className="text-[10px] font-black text-blue-900 uppercase ml-2 tracking-widest">Novo Sócio</label> <div className="flex gap-2"><input value={newPartner.name} onChange={e => setNewPartner({...newPartner, name: e.target.value})} placeholder="NOME DO SÓCIO" className="flex-1 p-4 bg-white rounded-2xl font-black text-xs uppercase outline-none shadow-sm" /><input value={newPartner.percentage} onChange={e => setNewPartner({...newPartner, percentage: e.target.value})} placeholder="%" className="w-20 p-4 bg-white rounded-2xl text-center font-black text-xs outline-none shadow-sm" /><button onClick={handleAddPartner} disabled={isSubmitting} className="bg-blue-950 text-white p-4 rounded-2xl hover:bg-black transition-all shadow-md">{isSubmitting ? <Loader2 className="animate-spin" size={20}/> : <Plus size={20}/>}</button></div> </div> <div className="space-y-3"> <p className="text-[10px] font-black text-gray-400 uppercase ml-2 tracking-widest">Sócios Atuais</p> <div className="divide-y divide-gray-50 border border-gray-100 rounded-[32px] overflow-hidden"> {(partners ?? []).map(p => (<div key={p.id} className="p-4 bg-white flex justify-between items-center group"><div><p className="font-black text-gray-900 uppercase italic text-[11px] leading-none">{p.partner_name}</p><p className="text-[9px] font-bold text-blue-600 mt-1 uppercase tracking-widest">{p.percentage}% de participação</p></div><button onClick={() => handleRemovePartner(p.id)} className="p-2 text-red-300 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"><Trash2 size={16}/></button></div>))} </div> </div> <button onClick={() => setShowPartnersModal(false)} className="w-full py-5 bg-blue-950 text-white rounded-[24px] font-black uppercase text-xs shadow-2xl transition-all hover:bg-black">Concluir</button> </div></div></div>
        )}
    </div>
  );
};

export default IceCreamModule;