import React, { useState, useEffect, useMemo, useCallback, Suspense, lazy } from 'react';
import { 
    LayoutDashboard, History, Package, TrendingUp, 
    Settings, Users, ShoppingCart, DollarSign, Clock,
    Printer, Search, Plus, Filter, AlertTriangle, Loader2,
    Calendar, ExternalLink
} from 'lucide-react';
import { supabase } from '../../services/supabaseClient';
import { 
    IceCreamDailySale, IceCreamPaymentMethod, IceCreamItem, 
    IceCreamCategory, IceCreamStock, IceCreamSangria,
    IceCreamSangriaCategory, IceCreamFutureDebt, StoreProfitPartner,
    AdminUser, Sale, IceCreamStockMovement, IceCreamRecipeItem,
    UserRole
} from '../../types';
import { formatCurrency } from '../../constants';
import { MONTHS } from './constants';
import { useDREStats } from './hooks/useDREStats';

// Tab imports (main ones stay direct)
import PDVTab from './tabs/PDVTab';
import DREDiarioTab from './tabs/DREDiarioTab';

// Lazy Tab imports
const DREMensalTab = lazy(() => import('./tabs/DREMensalTab'));
const DespesasTab = lazy(() => import('./tabs/DespesasTab'));
const EstoqueTab = lazy(() => import('./tabs/EstoqueTab'));
const AuditoriaTab = lazy(() => import('./tabs/AuditoriaTab'));
const ProdutosTab = lazy(() => import('./tabs/ProdutosTab'));

// Lazy Modal imports
const NewInsumoModal = lazy(() => import('./modals/NewInsumoModal'));
const PurchaseModal = lazy(() => import('./modals/PurchaseModal'));
const InventoryModal = lazy(() => import('./modals/InventoryModal'));
const WastageModal = lazy(() => import('./modals/WastageModal'));
const PartnersModal = lazy(() => import('./modals/PartnersModal'));
const ProductModal = lazy(() => import('./modals/ProductModal'));
const CancelSaleModal = lazy(() => import('./modals/CancelSaleModal'));
const TicketModal = lazy(() => import('./modals/TicketModal'));
const SangriaDetailModal = lazy(() => import('./modals/SangriaDetailModal'));
const EditSangriaModal = lazy(() => import('./modals/EditSangriaModal'));

import { IceCreamModuleProps } from './types';

const IceCreamModule: React.FC<IceCreamModuleProps> = ({
    user,
    stores = [],
    items = [],
    stock = [],
    sales = [],
    salesHeaders = [],
    salePayments = [],
    promissories = [],
    can,
    onAddSales,
    onAddSaleAtomic,
    onCancelSale,
    onUpdatePrice,
    onAddItem,
    onSaveProduct,
    onDeleteItem,
    onUpdateStock,
    liquidatePromissory,
    onDeleteStockItem,
    sangriaCategories = [],
    sangrias = [],
    stockMovements = [],
    wastage = [],
    partners = [],
    adminUsers = [],
    onAddSangria,
    onAddSangriaCategory,
    onDeleteSangriaCategory,
    onAddStockMovement,
    futureDebts = [],
    onAddFutureDebt,
    onPayFutureDebt,
    fetchData
}) => {
    const [activeTab, setActiveTab] = useState<'pdv' | 'dre' | 'dre_mensal' | 'stock' | 'audit' | 'produtos' | 'despesas'>('pdv');
    const [effectiveStoreId, setEffectiveStoreId] = useState(user?.storeId || (stores.length > 0 ? stores[0].id : ''));
    const isAdmin = user?.role === UserRole.ADMIN;
    const canManage = can('MODULE_ICECREAM_MANAGE');
    const isSorvete = user?.role === UserRole.ICE_CREAM;

    // 🔍 DEBUG: Verificar permissões
    console.log('=== DEBUG PERMISSÕES DROPDOWN ===');
    console.log('user.role:', user?.role);
    console.log('user.name:', user?.name);
    console.log('isAdmin:', isAdmin);
    console.log('canManage:', canManage);
    console.log('isSorvete:', isSorvete);
    console.log('UserRole.ICE_CREAM:', UserRole.ICE_CREAM);
    console.log('can(ALWAYS):', can('ALWAYS'));
    console.log('================================');

    // ✅ FIX: Auto-selecionar loja para usuários SORVETE
    useEffect(() => {
        if (user?.role === UserRole.ICE_CREAM && user?.storeId && effectiveStoreId !== user.storeId) {
            console.log('🔧 Auto-selecionando loja do usuário SORVETE:', user.storeId);
            setEffectiveStoreId(user.storeId);
        }
    }, [user]);

    // 🔍 DEBUG: Verificar dados recebidos
    useEffect(() => {
        console.log('=== DEBUG DADOS ===');
        console.log('items total:', items.length);
        console.log('items da loja:', items.filter(i => i.storeId === effectiveStoreId).length);
        console.log('stock total:', stock.length);
        console.log('stock da loja:', stock.filter(s => s.store_id === effectiveStoreId).length);
        console.log('effectiveStoreId:', effectiveStoreId);
        console.log('==================');
    }, [items, stock, effectiveStoreId]);

    // Dates
    const [displayDate, setDisplayDate] = useState(new Date().toISOString().split('T')[0]);
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

    // Modals Visibility
    const [showNewInsumoModal, setShowNewInsumoModal] = useState(false);
    const [showPurchaseModal, setShowPurchaseModal] = useState(false);
    const [showInventoryModal, setShowInventoryModal] = useState(false);
    const [showWastageModal, setShowWastageModal] = useState(false);
    const [showPartnersModal, setShowPartnersModal] = useState(false);
    const [showProductModal, setShowProductModal] = useState(false);
    const [showCancelModal, setShowCancelModal] = useState<{id: string, code: string} | null>(null);
    const [showTicketModal, setShowTicketModal] = useState(false);
    const [showSangriaDetailModal, setShowSangriaDetailModal] = useState<'day' | 'month' | null>(null);
    const [showEditSangriaModal, setShowEditSangriaModal] = useState(false);

    // Audit State
    const [auditSubTab, setAuditSubTab] = useState<'vendas' | 'avarias' | 'cancelamentos'>('vendas');
    const [showDaySummary, setShowDaySummary] = useState(false);
    const [auditDay, setAuditDay] = useState(new Date().getDate().toString());
    const [auditMonth, setAuditMonth] = useState((new Date().getMonth() + 1).toString());
    const [auditYear, setAuditYear] = useState(new Date().getFullYear().toString());
    const [auditSearch, setAuditSearch] = useState('');

    // Form States
    const [editingProduct, setEditingProduct] = useState<IceCreamItem | null>(null);
    const [editingSangria, setEditingSangria] = useState<IceCreamSangria | null>(null);
    const [editSangriaForm, setEditSangriaForm] = useState({ amount: '', categoryId: '', description: '', transactionDate: '', notes: '' });
    const [cancelReason, setCancelReason] = useState('');
    const [ticketData, setTicketData] = useState<{items: IceCreamDailySale[], saleCode: string, method: string | null, buyer?: string} | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Filtered Partners by store
    const filteredPartners = useMemo(() => {
        return partners.filter(p => p.store_id === effectiveStoreId);
    }, [partners, effectiveStoreId]);

    // DRE Stats Hook
    const dreStats = useDREStats({
        user,
        sales,
        salePayments,
        salesHeaders: salesHeaders || [],
        sangrias,
        stockMovements,
        futureDebts,
        sangriaCategories,
        adminUsers: adminUsers || [],
        selectedYear,
        selectedMonth,
        displayDate,
        effectiveStoreId
    });

    // Month Fiado Grouped
    const monthFiadoGrouped = useMemo(() => {
        const grouped: Record<string, { name: string, total: number, items: any[] }> = {};
        
        dreStats.monthFiadoDetails.forEach((f: any) => {
            if (!grouped[f.buyer_name]) {
                grouped[f.buyer_name] = { name: f.buyer_name, total: 0, items: [] };
            }
            grouped[f.buyer_name].total += f.totalValue;
            grouped[f.buyer_name].items.push(f);
        });

        return Object.values(grouped).sort((a, b) => b.total - a.total);
    }, [dreStats.monthFiadoDetails]);

    const selectedAuditDate = useMemo(() => {
        if (!auditDay || !auditMonth || !auditYear) return '';
        const d = auditDay.padStart(2, '0');
        const m = auditMonth.padStart(2, '0');
        return `${auditYear}-${m}-${d}`;
    }, [auditDay, auditMonth, auditYear]);

    const auditSummary = useMemo(() => {
        const filteredSales = sales.filter(s => {
            if (!s.createdAt) return false;
            const d = new Date(s.createdAt);
            const dateStr = d.toISOString().split('T')[0];
            const matchesStore = s.storeId === effectiveStoreId;
            return dateStr === selectedAuditDate && matchesStore;
        });

        const resumoItens: Record<string, { qtd: number, total: number }> = {};
        let totalItens = 0;
        
        let totalCanceledCount = 0;
        let totalCanceledValue = 0;

        filteredSales.forEach(s => {
            if (s.status === 'canceled') {
                totalCanceledCount++;
                totalCanceledValue += Number(s.totalValue || 0);
                return;
            }

            if (!resumoItens[s.productName]) resumoItens[s.productName] = { qtd: 0, total: 0 };
            resumoItens[s.productName].qtd += Number(s.unitsSold || 0);
            resumoItens[s.productName].total += Number(s.totalValue || 0);
            
            totalItens += Number(s.unitsSold || 0);
        });

        const resumoPagamentos: Record<string, number> = { 'Pix': 0, 'Dinheiro': 0, 'Cartão': 0, 'Fiado': 0 };
        const resumoPagamentosQtd: Record<string, number> = { 'Pix': 0, 'Dinheiro': 0, 'Cartão': 0, 'Fiado': 0 };

        const dayHeaders = (salesHeaders || []).filter(h => {
            if (!h.created_at) return false;
            const d = new Date(h.created_at);
            const dateStr = d.toISOString().split('T')[0];
            const matchesStore = h.store_id === effectiveStoreId;
            return dateStr === selectedAuditDate && matchesStore && h.status === 'completed';
        });

        dayHeaders.forEach(h => {
            const payments = (salePayments || []).filter(p => p.sale_id === h.id);
            payments.forEach(p => {
                const method = p.payment_method;
                if (resumoPagamentos[method] !== undefined) {
                    resumoPagamentos[method] += Number(p.amount || 0);
                    resumoPagamentosQtd[method]++;
                }
            });
        });

        // ✅ CORREÇÃO: Calcular total a partir da SOMA DOS PAGAMENTOS, não dos headers
        const totalGeral = Object.values(resumoPagamentos).reduce((acc, val) => acc + val, 0);

        return {
            resumoItens: Object.entries(resumoItens),
            totalGeral,  // ← AGORA USA A SOMA DOS PAGAMENTOS
            totalItens,
            resumoPagamentos,
            resumoPagamentosQtd,
            totalCanceledCount,
            totalCanceledValue
        };
    }, [sales, selectedAuditDate, effectiveStoreId, salesHeaders, salePayments]);

    const groupedAuditSales = useMemo(() => {
        const filteredSales = sales.filter(s => {
            if (!s.createdAt) return false;
            const d = new Date(s.createdAt);
            const dateStr = d.toISOString().split('T')[0];
            const matchesSearch = s.saleCode?.toLowerCase().includes(auditSearch.toLowerCase()) || 
                                 s.buyer_name?.toLowerCase().includes(auditSearch.toLowerCase());
            const matchesStore = s.storeId === effectiveStoreId;
            return dateStr === selectedAuditDate && matchesStore && matchesSearch;
        });

        const grouped: Record<string, any> = {};
        filteredSales.forEach(s => {
            if (!grouped[s.saleCode]) {
                grouped[s.saleCode] = {
                    id: s.id,
                    saleCode: s.saleCode,
                    createdAt: s.createdAt,
                    buyer_name: s.buyer_name,
                    paymentMethods: [],
                    totalValue: 0,
                    items: [],
                    status: s.status
                };
            }
            grouped[s.saleCode].totalValue += Number(s.totalValue || 0);
            grouped[s.saleCode].items.push(s);
            
            // Add payment method if not already present
            if (s.paymentMethod && !grouped[s.saleCode].paymentMethods.includes(s.paymentMethod)) {
                grouped[s.saleCode].paymentMethods.push(s.paymentMethod);
            }
        });

        // Refine payment methods from salesHeaders/salePayments for accuracy
        Object.values(grouped).forEach((group: any) => {
            const header = (salesHeaders || []).find(h => h.sale_code === group.saleCode);
            if (header) {
                const payments = (salePayments || []).filter(p => p.sale_id === header.id);
                if (payments.length > 0) {
                    group.paymentMethods = payments.map(p => p.payment_method);
                }
            }
        });

        return Object.values(grouped).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }, [sales, selectedAuditDate, effectiveStoreId, auditSearch, salesHeaders, salePayments]);

    const filteredAuditWastage = useMemo(() => {
        // Combinar stockMovements (tipo AVARIA) com a nova tabela ice_cream_wastage
        const legacyWastage = stockMovements.filter(m => {
            if (!m.created_at) return false;
            const d = new Date(m.created_at);
            const dateStr = d.toISOString().split('T')[0];
            return dateStr === selectedAuditDate && m.store_id === effectiveStoreId && m.movement_type === 'AVARIA';
        }).map(m => ({
            id: m.id,
            store_id: m.store_id,
            stock_base_name: stock.find(s => s.stock_id === m.stock_id)?.product_base || '?',
            quantity: m.quantity,
            reason: m.reason,
            created_by: 'Sistema',
            created_at: m.created_at
        }));

        const currentWastage = wastage.filter(w => {
            if (!w.created_at) return false;
            const d = new Date(w.created_at);
            const dateStr = d.toISOString().split('T')[0];
            return dateStr === selectedAuditDate && w.store_id === effectiveStoreId;
        });

        return [...legacyWastage, ...currentWastage].sort((a, b) => 
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
    }, [stockMovements, wastage, selectedAuditDate, effectiveStoreId, stock]);

    const filteredCancelations = useMemo(() => {
        const month = parseInt(auditMonth);
        const year = parseInt(auditYear);
        
        return sales.filter(s => {
            if (s.status !== 'canceled' || !s.createdAt) return false;
            
            const d = new Date(s.createdAt);
            const saleMonth = d.getMonth() + 1;
            const saleYear = d.getFullYear();
            
            const matchesMonth = !month || saleMonth === month;
            const matchesYear = !year || saleYear === year;
            const matchesStore = s.storeId === effectiveStoreId;
            const matchesSearch = !auditSearch || 
                s.saleCode?.toLowerCase().includes(auditSearch.toLowerCase()) ||
                s.cancel_reason?.toLowerCase().includes(auditSearch.toLowerCase()) ||
                s.canceled_by?.toLowerCase().includes(auditSearch.toLowerCase());
            
            return matchesMonth && matchesYear && matchesStore && matchesSearch;
        }).sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime());
    }, [sales, auditMonth, auditYear, effectiveStoreId, auditSearch]);

    // Handlers
    const handleOpenPrintPreview = (items: any[], saleCode: string, method: string, buyer?: string) => {
        const printWindow = window.open('', '_blank');
        if (!printWindow) { alert("Pop-up bloqueado!"); return; }
        const store = stores.find(s => s.id === effectiveStoreId);
        
        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Cupom de Venda - #${saleCode}</title>
                <style>
                    body { font-family: 'Courier New', Courier, monospace; width: 80mm; padding: 5mm; margin: 0; font-size: 12px; }
                    .header { text-align: center; margin-bottom: 10px; border-bottom: 1px dashed #000; padding-bottom: 5px; }
                    .header h2 { margin: 0; font-size: 16px; }
                    .info { margin-bottom: 10px; }
                    .items { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
                    .items th { text-align: left; border-bottom: 1px dashed #000; }
                    .items td { padding: 2px 0; }
                    .total { border-top: 1px dashed #000; padding-top: 5px; font-weight: bold; text-align: right; font-size: 14px; }
                    .footer { text-align: center; margin-top: 20px; font-size: 10px; }
                    .no-print { display: flex; justify-content: center; margin-top: 20px; }
                    .close-btn { background: #ef4444; color: white; border: none; padding: 10px 20px; border-radius: 8px; font-weight: bold; cursor: pointer; font-size: 12px; }
                    @media print { .no-print { display: none; } }
                </style>
            </head>
            <body>
                <div class="header">
                    <h2>SORVETERIA REAL</h2>
                    <p>${store?.name || '---'}</p>
                    <p>${store?.city || ''}</p>
                </div>
                <div class="info">
                    <p>DATA: ${new Date().toLocaleString('pt-BR')}</p>
                    <p>CUPOM: #${saleCode}</p>
                    <p>CLIENTE: ${buyer || 'CONSUMIDOR'}</p>
                    <p>PAGAMENTO: ${method}</p>
                </div>
                <table class="items">
                    <thead>
                        <tr><th>ITEM</th><th style="text-align:right">QTD</th><th style="text-align:right">VALOR</th></tr>
                    </thead>
                    <tbody>
                        ${items.map(i => `
                            <tr>
                                <td>${i.productName}</td>
                                <td style="text-align:right">${i.unitsSold}</td>
                                <td style="text-align:right">${formatCurrency(i.totalValue)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                <div class="total">
                    TOTAL: ${formatCurrency(items.reduce((acc, i) => acc + Number(i.totalValue || 0), 0))}
                </div>
                <div class="footer">
                    Obrigado pela preferência!<br>
                    Real Admin v6.5
                </div>

                <div class="no-print">
                    <button class="close-btn" onclick="window.close()">FECHAR CUPOM</button>
                </div>

                <script>window.onload = () => { window.print(); setTimeout(() => window.close(), 500); };</script>
            </body>
            </html>
        `;
        printWindow.document.write(html);
        printWindow.document.close();
    };

    const handlePrintDRE = () => {
        const printWindow = window.open('', '_blank');
        if (!printWindow) return;

        const store = stores.find(s => s.id === effectiveStoreId);
        const dateStr = new Date(displayDate + 'T00:00:00').toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

        const html = `
          <html>
            <head>
              <title>DRE DIÁRIO - ${store?.name || '---'}</title>
              <style>
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap');
                @page { size: A4; margin: 8mm; }
                body { font-family: 'Inter', Arial, sans-serif; margin: 0; padding: 0; color: #1a1a1a; line-height: 1.2; font-size: 10px; }
                .header { text-align: center; margin-bottom: 15px; border-bottom: 2px solid #eee; padding-bottom: 10px; }
                .header h1 { margin: 0; font-size: 18px; font-weight: 900; text-transform: uppercase; letter-spacing: -1px; }
                .header h2 { margin: 3px 0; font-size: 16px; color: #666; font-weight: 700; }
                .header p { margin: 3px 0; font-size: 12px; color: #999; text-transform: capitalize; }
                .section { margin-bottom: 10px; page-break-inside: avoid; }
                .section-title { font-size: 11px; font-weight: 900; text-transform: uppercase; color: #666; margin-bottom: 8px; display: flex; align-items: center; gap: 8px; border-left: 4px solid #3b82f6; padding-left: 10px; }
                .product-table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
                .product-table tr:nth-child(even) { background-color: #f9f9f9; }
                .product-table td { padding: 4px; font-size: 9px; border-bottom: 1px solid #eee; }
                .product-name { font-weight: 700; text-transform: uppercase; }
                .product-qty { text-align: right; color: #3b82f6; font-weight: 900; }
                .product-total { text-align: right; font-weight: 900; }
                .canceled-box { background-color: #fef2f2; border: 1px solid #fee2e2; padding: 10px; border-radius: 8px; margin-bottom: 15px; }
                .canceled-box p { margin: 0; font-size: 11px; font-weight: 900; color: #991b1b; }
                .payment-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
                .payment-box { border: 1px solid #eee; padding: 10px; border-radius: 8px; }
                .payment-box h5 { margin: 0 0 5px 0; font-size: 9px; font-weight: 900; text-transform: uppercase; color: #666; }
                .payment-box .row { display: flex; justify-content: space-between; font-size: 10px; margin-bottom: 2px; }
                .payment-box .total { font-size: 12px; font-weight: 900; color: #1a1a1a; margin-top: 5px; border-top: 1px dashed #eee; padding-top: 5px; }
                .grand-total { text-align: center; padding: 15px; background: #f8fafc; border-radius: 15px; margin: 20px 0; border: 2px solid #e2e8f0; }
                .grand-total p { margin: 0; font-size: 9px; font-weight: 900; color: #64748b; text-transform: uppercase; letter-spacing: 1px; }
                .grand-total h3 { margin: 5px 0 0 0; font-size: 24px; font-weight: 900; color: #1e293b; font-style: italic; }
                .signatures { display: flex; justify-content: space-between; margin-top: 40px; gap: 30px; }
                .sig-block { flex: 1; text-align: center; }
                .sig-line { border-top: 1px solid #000; margin-bottom: 5px; }
                .sig-label { font-size: 9px; font-weight: 700; text-transform: uppercase; color: #666; }
                .footer { margin-top: 20px; text-align: center; font-size: 8px; color: #999; border-top: 1px solid #eee; padding-top: 10px; }
                .no-print { display: flex; justify-content: center; margin-top: 20px; }
                .close-btn { background: #ef4444; color: white; border: none; padding: 10px 20px; border-radius: 8px; font-weight: bold; cursor: pointer; font-size: 12px; }
                @media print { .no-print { display: none; } }
              </style>
            </head>
            <body>
              <div class="header">
                <h1>🍦 DRE DIÁRIO - SORVETERIA REAL</h1>
                <h2>${store?.name || '---'}</h2>
                <p>${dateStr}</p>
              </div>
              
              <div class="section">
                <div class="section-title">Detalhamento de Vendas do Período</div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                  ${dreStats.resumoItensRodape.map(([name, data]: [string, any]) => `
                    <div style="background: #f8fafc; padding: 6px; border-radius: 6px; border: 1px solid #e2e8f0;">
                      <div style="font-weight: 900; text-transform: uppercase; color: #1e293b; font-size: 9px; margin-bottom: 2px;">${name}</div>
                      <div style="font-weight: 700; color: #64748b; font-size: 8px;">QTD: ${data.qtd}</div>
                      <div style="font-weight: 900; color: #3b82f6; font-size: 10px; margin-top: 1px;">R$ ${data.total.toFixed(2).replace('.', ',')}</div>
                    </div>
                  `).join('')}
                </div>
                ${dreStats.resumoItensRodape.length === 0 ? '<div style="text-align: center; padding: 10px; color: #94a3b8; font-style: italic;">Nenhuma venda registrada</div>' : ''}
              </div>
              
              ${dreStats.dayCanceledCount > 0 ? `
                <div class="canceled-box">
                  <p style="margin-bottom: 5px;">❌ VENDAS CANCELADAS: ${dreStats.dayCanceledCount} vendas | TOTAL: R$ ${dreStats.dayCanceledTotal.toFixed(2).replace('.', ',')}</p>
                  ${dreStats.dayCanceledDetails.map((c: any) => `
                    <div style="font-size: 9px; margin: 2px 0; padding: 3px; background: white; border-radius: 4px;">
                      <strong>#${c.saleCode}</strong> - R$ ${c.totalValue.toFixed(2).replace('.', ',')} 
                      <span style="color: #991b1b; font-size: 8px;">• ${c.cancelReason}</span>
                    </div>
                  `).join('')}
                </div>
              ` : ''}
              
              <div class="section">
                <div class="section-title">Resumo por Método de Pagamento</div>
                <div class="payment-grid">
                  ${Object.entries(dreStats.dayMethods).map(([method, data]: [string, any]) => {
                    const label = method === 'pix' ? 'Pix' : method === 'money' ? 'Dinheiro' : method === 'card' ? 'Cartão' : 'Fiado';
                    return `
                      <div class="payment-box">
                        <h5>${label} (${data.count})</h5>
                        <div class="total" style="margin: 0; padding: 0; border: none; font-size: 12px;">
                          <span style="color: #059669;">R$ ${data.total.toFixed(2).replace('.', ',')}</span>
                        </div>
                      </div>
                    `;
                  }).join('')}
                </div>
              </div>
              
              <div class="grand-total">
                <p>Total Financeiro Geral</p>
                <h3>R$ ${dreStats.dayIn.toFixed(2).replace('.', ',')}</h3>
              </div>
              
              <div class="signatures">
                <div class="sig-block">
                  <div class="sig-line" style="margin-top: 40px;"></div>
                  <div class="sig-label">Balconista</div>
                </div>
                <div class="sig-block">
                  <div class="sig-line" style="margin-top: 40px;"></div>
                  <div class="sig-label">${user.name} (Gerente)</div>
                </div>
              </div>
              
              <div class="footer">
                Gerado em: ${new Date().toLocaleString('pt-BR')} | Sistema de Gestão Sorveteria Real
              </div>

              <div class="no-print">
                <button class="close-btn" onclick="window.close()">FECHAR RELATÓRIO</button>
              </div>
              
              <script>
                window.onload = () => {
                  setTimeout(() => {
                    window.print();
                    setTimeout(() => window.close(), 500);
                  }, 500);
                };
              </script>
            </body>
          </html>
        `;

        printWindow.document.write(html);
        printWindow.document.close();
    };

    const handlePrintDreMensal = () => {
        const printWindow = window.open('', '_blank');
        if (!printWindow) { alert("Pop-up bloqueado!"); return; }
        const store = stores.find(s => s.id === effectiveStoreId);
        const monthLabel = MONTHS.find(m => m.value === selectedMonth)?.label;
        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>DRE Mensal - Sorveteria Real</title>
                <style>
                    @page { size: A4; margin: 15mm; }
                    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 0; color: #1e293b; line-height: 1.4; }
                    .header { border-bottom: 3px solid #1e3a8a; padding-bottom: 10px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: flex-end; }
                    .header h2 { color: #1e3a8a; margin: 0; text-transform: uppercase; font-style: italic; font-weight: 900; font-size: 24px; }
                    .header p { margin: 0; font-size: 12px; font-weight: bold; color: #64748b; }
                    .section { margin-bottom: 20px; padding: 15px; border: 1px solid #e2e8f0; border-radius: 12px; background: #fff; }
                    .section-title { font-size: 11px; font-weight: 900; color: #1e3a8a; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 10px; border-bottom: 1px solid #e2e8f0; padding-bottom: 5px; }
                    .kpi { display: flex; justify-content: space-between; font-weight: bold; font-size: 14px; padding: 5px 0; }
                    .total-row { border-top: 2px solid #1e3a8a; margin-top: 5px; padding-top: 5px; font-size: 18px; color: #1e3a8a; }
                    table { width: 100%; border-collapse: collapse; margin-top: 5px; }
                    th { text-align: left; padding: 8px; border-bottom: 2px solid #cbd5e1; font-size: 10px; text-transform: uppercase; color: #64748b; }
                    td { padding: 8px; border-bottom: 1px solid #f1f5f9; font-size: 11px; font-weight: 600; }
                    .text-right { text-align: right; }
                    .footer { margin-top: 30px; text-align: center; font-size: 9px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 10px; }
                    .no-print { display: flex; justify-content: center; margin-top: 20px; }
                    .close-btn { background: #ef4444; color: white; border: none; padding: 10px 20px; border-radius: 8px; font-weight: bold; cursor: pointer; font-size: 12px; }
                    @media print { .no-print { display: none; } }
                </style>
            </head>
            <body>
                <div class="header">
                    <div>
                        <h2>SORVETERIA REAL</h2>
                        <p>Relatório Gerencial de Resultados</p>
                    </div>
                    <div class="text-right">
                        <p>UNIDADE: ${store?.number || '---'} | ${store?.city || ''}</p>
                        <p>REFERÊNCIA: ${monthLabel} / ${selectedYear}</p>
                    </div>
                </div>
    
                <div class="section">
                    <div class="section-title">Resumo Financeiro</div>
                    <div class="kpi"><span>Faturamento Bruto (+)</span> <span style="color:#059669">${formatCurrency(dreStats.monthIn)}</span></div>
                    <div class="kpi"><span>Sangrias / Saídas (-)</span> <span style="color:#dc2626">${formatCurrency(dreStats.monthSangriaTotal)}</span></div>
                    <div class="kpi total-row"><span>LUCRO LÍQUIDO (=)</span> <span>${formatCurrency(dreStats.profit)}</span></div>
                </div>
    
                <div class="section">
                    <div class="section-title">RESUMO OPERACIONAL DO PERÍODO</div>
                    <div class="kpi"><span>Total de Sangrias</span> <span>${formatCurrency(dreStats.monthSangriaTotal)}</span></div>
                    <div class="kpi"><span>Total de Avarias</span> <span>${dreStats.monthWastageTotal.toFixed(2)}</span></div>
                    <div class="kpi"><span>Vendas Canceladas</span> <span>${formatCurrency(dreStats.monthCanceledTotal)}</span></div>
                    <div class="kpi"><span>Margem Líquida (%)</span> <span>${dreStats.monthIn > 0 ? ((dreStats.profit / dreStats.monthIn) * 100).toFixed(1) : '0.0'}%</span></div>
                </div>
    
                <div class="section">
                    <div class="section-title">Detalhamento de Vendas do Período</div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px;">
                        ${dreStats.monthSalesDetail.map((item: any) => `
                            <div style="background: #f8fafc; padding: 10px; border-radius: 8px; border: 1px solid #e2e8f0;">
                                <div style="font-weight: 900; text-transform: uppercase; color: #1e293b; font-size: 9px; margin-bottom: 4px; line-height: 1.2;">${item.productName}</div>
                                <div style="font-weight: 700; color: #64748b; font-size: 8px;">QTD: ${item.quantity}</div>
                                <div style="font-weight: 900; color: #3b82f6; font-size: 10px; margin-top: 2px;">R$ ${item.totalValue.toFixed(2).replace('.', ',')}</div>
                            </div>
                        `).join('')}
                    </div>
                    ${dreStats.monthSalesDetail.length === 0 ? '<div style="text-align: center; padding: 20px; color: #94a3b8; font-style: italic;">Nenhuma venda registrada no período</div>' : ''}
                </div>

                <div class="section">
                    <div class="section-title">Resumo por Método de Pagamento</div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 10px;">
                        <div style="background: #f0fdf4; padding: 10px; border-radius: 8px; border: 1px solid #dcfce7;">
                            <div style="font-weight: 900; color: #166534; font-size: 9px; text-transform: uppercase;">Pix (${dreStats.monthMethodsCount.pix})</div>
                            <div style="font-weight: 900; color: #15803d; font-size: 11px; margin-top: 4px;">R$ ${dreStats.monthMethods.pix.toFixed(2).replace('.', ',')}</div>
                        </div>
                        <div style="background: #f0fdf4; padding: 10px; border-radius: 8px; border: 1px solid #dcfce7;">
                            <div style="font-weight: 900; color: #166534; font-size: 9px; text-transform: uppercase;">Dinheiro (${dreStats.monthMethodsCount.money})</div>
                            <div style="font-weight: 900; color: #15803d; font-size: 11px; margin-top: 4px;">R$ ${dreStats.monthMethods.money.toFixed(2).replace('.', ',')}</div>
                        </div>
                        <div style="background: #f0fdf4; padding: 10px; border-radius: 8px; border: 1px solid #dcfce7;">
                            <div style="font-weight: 900; color: #166534; font-size: 9px; text-transform: uppercase;">Cartão (${dreStats.monthMethodsCount.card})</div>
                            <div style="font-weight: 900; color: #15803d; font-size: 11px; margin-top: 4px;">R$ ${dreStats.monthMethods.card.toFixed(2).replace('.', ',')}</div>
                        </div>
                        <div style="background: #f0fdf4; padding: 10px; border-radius: 8px; border: 1px solid #dcfce7;">
                            <div style="font-weight: 900; color: #166534; font-size: 9px; text-transform: uppercase;">Fiado (${dreStats.monthMethodsCount.fiado})</div>
                            <div style="font-weight: 900; color: #15803d; font-size: 11px; margin-top: 4px;">R$ ${dreStats.monthMethods.fiado.toFixed(2).replace('.', ',')}</div>
                        </div>
                    </div>
                </div>

                <div class="section">
                    <div class="section-title">Partilha de Lucros (Sócios/Parceiros)</div>
                    <table>
                        <thead>
                            <tr><th>Nome do Parceiro</th><th>Porcentagem</th><th class="text-right">Valor Repasse</th></tr>
                        </thead>
                        <tbody>
                            ${filteredPartners.length > 0 
                                ? filteredPartners.map(p => `<tr><td>${p.partner_name}</td><td>${p.percentage}%</td><td class="text-right">${formatCurrency((dreStats.profit * p.percentage) / 100)}</td></tr>`).join('')
                                : '<tr><td colspan="3" style="text-align:center; color:#94a3b8; font-style:italic;">Nenhuma partilha configurada</td></tr>'
                            }
                        </tbody>
                    </table>
                </div>
    
                <div class="section">
                    <div class="section-title">Débitos de Funcionários (Vendas Fiado)</div>
                    <table>
                        <thead>
                            <tr>
                                <th>Colaborador</th>
                                <th class="text-right">Total Acumulado</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${monthFiadoGrouped.length > 0 
                                ? monthFiadoGrouped.map(f => `<tr><td>${f.name}</td><td class="text-right">${formatCurrency(f.total)}</td></tr>`).join('')
                                : '<tr><td colspan="2" style="text-align:center; color:#94a3b8; font-style:italic;">Nenhum débito registrado no período</td></tr>'
                            }
                        </tbody>
                    </table>
                </div>
    
                <div class="section">
                    <div class="section-title">Detalhamento de Vendas Canceladas</div>
                    <table>
                        <thead>
                            <tr><th>Código</th><th>Data</th><th>Cancelado Por</th><th>Motivo</th><th class="text-right">Valor</th></tr>
                        </thead>
                        <tbody>
                            ${dreStats.monthCanceledDetails.length > 0 
                                ? dreStats.monthCanceledDetails.map((c: any) => `<tr><td>#${c.saleCode}</td><td>${new Date(c.createdAt).toLocaleDateString()}</td><td>${c.canceledBy}</td><td>${c.cancelReason}</td><td class="text-right">${formatCurrency(c.totalValue)}</td></tr>`).join('')
                                : '<tr><td colspan="5" style="text-align:center; color:#94a3b8; font-style:italic;">Nenhuma venda cancelada no período</td></tr>'
                            }
                        </tbody>
                    </table>
                </div>
    
                <div class="footer">
                    Documento gerado em ${new Date().toLocaleString('pt-BR')} por Sorveteria Real
                </div>

                <div class="no-print">
                    <button class="close-btn" onclick="window.close()">FECHAR RELATÓRIO</button>
                </div>
    
                <script>
                    window.onload = () => {
                        window.print();
                        setTimeout(() => window.close(), 1000);
                    };
                </script>
            </body>
            </html>
        `;
        printWindow.document.write(html); printWindow.document.close();
    };

    const handleCancelSale = async () => {
        if (!showCancelModal) return;
        setIsSubmitting(true);
        try {
            const saleCode = showCancelModal.code;
            
            // 1️⃣ Buscar o sale_id do header
            const { data: headerData } = await supabase
                .from('ice_cream_sales')
                .select('id, total_value')
                .eq('sale_code', saleCode)
                .maybeSingle();
            
            const saleId = headerData?.id;
            
            // 2️⃣ Atualizar header (ice_cream_sales)
            if (saleId) {
                await supabase
                    .from('ice_cream_sales')
                    .update({
                        status: 'canceled',
                        cancel_reason: cancelReason.toUpperCase(),
                        canceled_by_name: user.name,
                        canceled_at: new Date().toISOString()
                    })
                    .eq('id', saleId);
            }
            
            // 3️⃣ Atualizar itens (ice_cream_daily_sales)
            await supabase
                .from('ice_cream_daily_sales')
                .update({
                    status: 'canceled',
                    cancel_reason: cancelReason.toUpperCase(),
                    canceled_by: user.name,
                    canceled_at: new Date().toISOString()
                })
                .eq('sale_code', saleCode);
            
            // 4️⃣ CRÍTICO: REMOVER PAGAMENTOS
            await supabase
                .from('ice_cream_daily_sales_payments')
                .delete()
                .eq('sale_code', saleCode);
            
            // 5️⃣ Remover registros de cartão/pix se existirem
            await Promise.all([
                supabase.from('financial_card_sales').delete().eq('sale_code', saleCode),
                supabase.from('financial_pix_sales').delete().eq('sale_code', saleCode)
            ]);
            
            setShowCancelModal(null);
            setCancelReason('');
            if (fetchData) await fetchData();
        } catch (e: any) {
            alert("Erro ao estornar venda: " + e.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleUpdateStock = async (storeId: string, base: string, value: number, unit: string, type: any, stockId?: string) => {
        await onUpdateStock(storeId, base, value, unit, type, stockId);
    };

    const handleUpdateStockBase = async (id: string, base: string, unit: string) => {
        try {
            const { error } = await supabase
                .from('ice_cream_stock')
                .update({
                    product_base: base,
                    unit: unit
                })
                .eq('id', id);
            
            if (error) throw error;
            await fetchData();
        } catch (err: any) {
            console.error("Erro ao atualizar insumo:", err);
            throw err;
        }
    };

    const handleUpdatePartner = async (partner: any) => {
        setIsSubmitting(true);
        try {
            const { error } = await supabase.from('store_profit_distribution').update({
                partner_name: partner.partner_name.toUpperCase(),
                percentage: partner.percentage,
                active: partner.active
            }).eq('id', partner.id);
            if (error) throw error;
            if (fetchData) await fetchData();
        } catch (e: any) {
            alert("Erro ao atualizar sócio: " + e.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleSavePartner = async (partner: { partner_name: string, percentage: number }) => {
        setIsSubmitting(true);
        try {
            const { error } = await supabase.from('store_profit_distribution').insert([{
                store_id: effectiveStoreId,
                partner_name: partner.partner_name.toUpperCase(),
                percentage: partner.percentage,
                active: true
            }]);
            if (error) throw error;
            if (fetchData) await fetchData();
        } catch (e: any) {
            alert("Erro ao salvar sócio: " + e.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleTogglePartner = async (id: string, active: boolean) => {
        try {
            const { error } = await supabase.from('store_profit_distribution').update({ active }).eq('id', id);
            if (error) throw error;
            if (fetchData) await fetchData();
        } catch (e: any) {
            alert("Erro ao atualizar sócio: " + e.message);
        }
    };

    const handleDeletePartner = async (id: string) => {
        if (!confirm("Excluir sócio?")) return;
        try {
            const { error } = await supabase.from('store_profit_distribution').delete().eq('id', id);
            if (error) throw error;
            if (fetchData) await fetchData();
        } catch (e: any) {
            alert("Erro ao excluir sócio: " + e.message);
        }
    };

    const handleUpdateSangria = async (id: string, data: any) => {
        try {
            const { error } = await supabase.from('ice_cream_sangria').update({
                amount: data.amount,
                description: data.description,
                category_id: data.category_id,
                transaction_date: data.transaction_date,
                notes: data.notes
            }).eq('id', id);
            if (error) throw error;
            if (fetchData) await fetchData();
        } catch (e: any) {
            alert("Erro ao atualizar sangria: " + e.message);
        }
    };

    const handleDeleteSangria = async (id: string) => {
        if (!confirm("Excluir sangria?")) return;
        try {
            const { error } = await supabase.from('ice_cream_sangria').delete().eq('id', id);
            if (error) throw error;
            if (fetchData) await fetchData();
        } catch (e: any) {
            alert("Erro ao excluir sangria: " + e.message);
        }
    };

    const handleSaveEditSangria = async () => {
        if (!editingSangria) return;
        setIsSubmitting(true);
        try {
            await handleUpdateSangria(editingSangria.id, {
                amount: parseFloat(editSangriaForm.amount.replace(',', '.')),
                description: editSangriaForm.description.toUpperCase(),
                category_id: editSangriaForm.categoryId,
                transaction_date: editSangriaForm.transactionDate,
                notes: editSangriaForm.notes
            });
            setShowEditSangriaModal(false);
            if (fetchData) await fetchData();
        } catch (e: any) {
            alert("Erro ao salvar: " + e.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handlePayFutureDebt = async (debtId: string) => {
        const paymentDate = new Date().toISOString().split('T')[0];
        try {
            await onPayFutureDebt(debtId, paymentDate);
            if (fetchData) await fetchData();
        } catch (e: any) {
            alert("Erro ao pagar dívida: " + e.message);
        }
    };

    const handleAddSangriaCategory = async (name: string, storeId: string) => {
        try {
            await onAddSangriaCategory({ name, store_id: storeId, is_active: true });
            if (fetchData) await fetchData();
        } catch (e: any) {
            alert("Erro ao adicionar categoria: " + e.message);
        }
    };

    return (
        <div className="min-h-screen bg-[#f8fafc] text-slate-900 font-sans selection:bg-blue-100 selection:text-blue-900">
            {/* TOP NAVIGATION */}
            <nav className="bg-white/90 backdrop-blur-xl border-b border-slate-200/60 px-4 md:px-8 py-3 md:py-4 mb-6">
                <div className="max-w-7xl mx-auto flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div className="flex items-center justify-between w-full md:w-auto">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-600 rounded-xl shadow-lg shadow-blue-200">
                                <LayoutDashboard className="text-white" size={20} />
                            </div>
                            <div>
                                <h1 className="text-lg font-black uppercase italic tracking-tighter text-slate-900 leading-none">
                                    Real <span className="text-blue-600">Admin</span>
                                </h1>
                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">Sorveteria Real</p>
                            </div>
                        </div>
 
                        {/* Store Selector Mobile */}
                        <div className="md:hidden">
                            {isAdmin ? (
                                <select 
                                    value={effectiveStoreId} 
                                    onChange={e => setEffectiveStoreId(e.target.value)}
                                    className="bg-slate-100 border-none rounded-xl px-3 py-2 text-[9px] font-black uppercase text-slate-600 outline-none cursor-pointer"
                                >
                                    {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                </select>
                            ) : (
                                <div className="bg-slate-100 rounded-xl px-3 py-2 text-[9px] font-black uppercase text-slate-600 border border-slate-200">
                                    {stores.find(s => s.id === effectiveStoreId)?.name || user?.name || 'LOJA'}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center gap-1.5 bg-slate-100/80 p-1.5 rounded-2xl overflow-x-auto no-scrollbar max-w-full touch-pan-x">
                        <button onClick={() => setActiveTab('pdv')} className={`px-3 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-2 whitespace-nowrap shrink-0 ${activeTab === 'pdv' ? 'bg-white text-blue-600 shadow-md ring-1 ring-slate-200/50' : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'}`}>
                            <ShoppingCart size={15} /> PDV
                        </button>
                        <button onClick={() => setActiveTab('dre')} className={`px-3 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-2 whitespace-nowrap shrink-0 ${activeTab === 'dre' ? 'bg-white text-blue-600 shadow-md ring-1 ring-slate-200/50' : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'}`}>
                            <TrendingUp size={15} /> DRE Diário
                        </button>
                        {canManage && (
                            <button onClick={() => setActiveTab('dre_mensal')} className={`px-3 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-2 whitespace-nowrap shrink-0 ${activeTab === 'dre_mensal' ? 'bg-white text-blue-600 shadow-md ring-1 ring-slate-200/50' : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'}`}>
                                <Calendar size={15} /> DRE Mensal
                            </button>
                        )}
                        {canManage && can('MODULE_ICECREAM_DESPESAS') && (
                            <button onClick={() => setActiveTab('despesas')} className={`px-3 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-2 whitespace-nowrap shrink-0 ${activeTab === 'despesas' ? 'bg-white text-red-600 shadow-md ring-1 ring-slate-200/50' : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'}`}>
                                <DollarSign size={15} /> Despesas
                            </button>
                        )}
                        <button onClick={() => setActiveTab('stock')} className={`px-3 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-2 whitespace-nowrap shrink-0 ${activeTab === 'stock' ? 'bg-white text-blue-600 shadow-md ring-1 ring-slate-200/50' : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'}`}>
                            <Package size={15} /> Estoque
                        </button>
                        {(canManage || isSorvete) && (
                            <button onClick={() => setActiveTab('audit')} className={`px-3 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-2 whitespace-nowrap shrink-0 ${activeTab === 'audit' ? 'bg-white text-blue-600 shadow-md ring-1 ring-slate-200/50' : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'}`}>
                                <History size={15} /> Auditoria
                            </button>
                        )}
                        {canManage && (
                            <button onClick={() => setActiveTab('produtos')} className={`px-3 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-2 whitespace-nowrap shrink-0 ${activeTab === 'produtos' ? 'bg-white text-blue-600 shadow-md ring-1 ring-slate-200/50' : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'}`}>
                                <Settings size={15} /> Produtos
                            </button>
                        )}
                    </div>
                    <div className="hidden md:flex items-center gap-3">
                        {isAdmin ? (
                            <select 
                                value={effectiveStoreId} 
                                onChange={e => setEffectiveStoreId(e.target.value)}
                                className="bg-slate-100 border-none rounded-xl px-4 py-2.5 text-[10px] font-black uppercase text-slate-600 outline-none cursor-pointer hover:bg-slate-200 transition-all"
                            >
                                {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                            </select>
                        ) : (
                            <div className="bg-slate-100 rounded-xl px-4 py-2.5 text-[10px] font-black uppercase text-slate-600 border border-slate-200">
                                {stores.find(s => s.id === effectiveStoreId)?.name || user?.name || 'LOJA'}
                            </div>
                        )}
                    </div>
                </div>
            </nav>

            {/* TAB CONTENT */}
            <main className="max-w-7xl mx-auto">
                {activeTab === 'pdv' && (
                    <PDVTab 
                        user={user}
                        items={items}
                        effectiveStoreId={effectiveStoreId}
                        onAddSales={onAddSales}
                        onAddSaleAtomic={onAddSaleAtomic}
                        onUpdateStock={handleUpdateStock}
                        handleOpenPrintPreview={handleOpenPrintPreview}
                        existingBuyerNames={Array.from(new Set(sales.map(s => s.buyer_name).filter(Boolean) as string[]))}
                        iceCreamSales={sales}
                    />
                )}

                {activeTab === 'dre' && (
                    <DREDiarioTab 
                        displayDate={displayDate}
                        setDisplayDate={setDisplayDate}
                        dreStats={dreStats}
                        effectiveStoreId={effectiveStoreId}
                        handlePrintDRE={handlePrintDRE}
                        sangriaCategories={sangriaCategories}
                        onAddSangria={onAddSangria}
                        onUpdateStock={handleUpdateStock}
                        filteredStock={stock.filter(s => s.store_id === effectiveStoreId)}
                        fetchData={fetchData}
                        onAddSangriaCategory={handleAddSangriaCategory}
                        onShowSangriaDetail={() => setShowSangriaDetailModal('day')}
                        user={user}
                    />
                )}

                {activeTab === 'dre_mensal' && (
                    <Suspense fallback={<div className="p-20 text-center"><Loader2 className="animate-spin mx-auto text-blue-600 mb-4" size={40}/><p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Carregando DRE Mensal...</p></div>}>
                        <DREMensalTab 
                            selectedMonth={selectedMonth}
                            setSelectedMonth={setSelectedMonth}
                            selectedYear={selectedYear}
                            setSelectedYear={setSelectedYear}
                            dreStats={dreStats}
                            monthFiadoGrouped={monthFiadoGrouped}
                            handlePrintDreMensal={handlePrintDreMensal}
                            sangrias={sangrias}
                            sangriaCategories={sangriaCategories}
                            adminUsers={adminUsers}
                            stores={stores}
                            partners={filteredPartners}
                            effectiveStoreId={effectiveStoreId}
                            can={can}
                            onAddFutureDebt={onAddFutureDebt}
                            onUpdatePartner={handleUpdatePartner}
                            onAddPartner={handleSavePartner}
                            onDeletePartner={handleDeletePartner}
                            onTogglePartner={handleTogglePartner}
                            fetchData={fetchData}
                        />
                    </Suspense>
                )}

                {activeTab === 'despesas' && (
                    <Suspense fallback={<div className="p-20 text-center"><Loader2 className="animate-spin mx-auto text-blue-600 mb-4" size={40}/><p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Carregando Despesas...</p></div>}>
                        <DespesasTab 
                            sangrias={sangrias}
                            futureDebts={futureDebts}
                            sangriaCategories={sangriaCategories}
                            onAddSangria={onAddSangria}
                            onAddFutureDebt={onAddFutureDebt}
                            onPayFutureDebt={handlePayFutureDebt}
                            onDeleteSangria={handleDeleteSangria}
                            onUpdateSangria={handleUpdateSangria}
                            onAddSangriaCategory={handleAddSangriaCategory}
                            onDeleteSangriaCategory={onDeleteSangriaCategory}
                            effectiveStoreId={effectiveStoreId}
                            adminUsers={adminUsers}
                            stores={stores}
                            user={user}
                            can={can}
                            fetchData={fetchData}
                        />
                    </Suspense>
                )}

                {activeTab === 'stock' && (
                    <Suspense fallback={<div className="p-20 text-center"><Loader2 className="animate-spin mx-auto text-blue-600 mb-4" size={40}/><p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Carregando Estoque...</p></div>}>
                        <EstoqueTab 
                            filteredStock={stock.filter(s => s.store_id === effectiveStoreId)}
                            isAdmin={canManage && !isSorvete}
                            onUpdateStock={handleUpdateStock}
                            onAddStockBase={isSorvete ? async () => {} : (base, unit, storeId) => onAddItem(base, 'INSUMO', 0, '', 0, unit, 0, storeId, [])}
                            onUpdateStockBase={handleUpdateStockBase}
                            onDeleteStockBase={isSorvete ? async () => {} : onDeleteStockItem}
                            onToggleFreezeStock={async (id, active) => {
                                if (isSorvete) return;
                                const { error } = await supabase.from('ice_cream_stock').update({ is_active: active }).eq('id', id);
                                if (error) throw error;
                            }}
                            effectiveStoreId={effectiveStoreId}
                            fetchData={fetchData}
                            onOpenPurchaseModal={() => setShowPurchaseModal(true)}
                            onOpenInventoryModal={() => setShowInventoryModal(true)}
                            onOpenWastageModal={() => setShowWastageModal(true)}
                        />
                    </Suspense>
                )}

                {activeTab === 'audit' && (
                    <Suspense fallback={<div className="p-20 text-center"><Loader2 className="animate-spin mx-auto text-blue-600 mb-4" size={40}/><p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Carregando Auditoria...</p></div>}>
                        <AuditoriaTab 
                            auditSubTab={auditSubTab}
                            setAuditSubTab={setAuditSubTab}
                            showDaySummary={showDaySummary}
                            setShowDaySummary={setShowDaySummary}
                            auditDay={auditDay}
                            setAuditDay={setAuditDay}
                            auditMonth={auditMonth}
                            setAuditMonth={setAuditMonth}
                            auditYear={auditYear}
                            setAuditYear={setAuditYear}
                            auditSearch={auditSearch}
                            setAuditSearch={setAuditSearch}
                            auditSummary={auditSummary}
                            groupedAuditSales={groupedAuditSales}
                            filteredAuditWastage={filteredAuditWastage}
                            filteredCancelations={filteredCancelations}
                            handleOpenPrintPreview={handleOpenPrintPreview}
                            onCancelSale={(id, code) => setShowCancelModal({id, code})}
                            items={items}
                            stock={stock}
                            isSorvete={isSorvete}
                        />
                    </Suspense>
                )}

                {activeTab === 'produtos' && (
                    <Suspense fallback={<div className="p-20 text-center"><Loader2 className="animate-spin mx-auto text-blue-600 mb-4" size={40}/><p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Carregando Produtos...</p></div>}>
                        <ProdutosTab 
                            filteredItems={items.filter(i => i.storeId === effectiveStoreId)}
                            onDeleteItem={onDeleteItem}
                            onSaveProduct={onSaveProduct}
                            stock={stock}
                            effectiveStoreId={effectiveStoreId}
                            fetchData={fetchData}
                        />
                    </Suspense>
                )}
            </main>

            {/* MODALS */}
            {showNewInsumoModal && (
                <NewInsumoModal 
                    isOpen={showNewInsumoModal}
                    onClose={() => setShowNewInsumoModal(false)}
                    onAdd={(base, unit, storeId) => onAddItem(base, 'INSUMO', 0, '', 0, unit, 0, storeId, [])}
                    effectiveStoreId={effectiveStoreId}
                    fetchData={fetchData}
                />
            )}

            {showPurchaseModal && (
                <PurchaseModal 
                    isOpen={showPurchaseModal}
                    onClose={() => setShowPurchaseModal(false)}
                    onUpdateStock={handleUpdateStock}
                    filteredStock={stock.filter(s => s.store_id === effectiveStoreId)}
                    effectiveStoreId={effectiveStoreId}
                    fetchData={fetchData}
                />
            )}

            {showInventoryModal && (
                <InventoryModal 
                    isOpen={showInventoryModal}
                    onClose={() => setShowInventoryModal(false)}
                    onUpdateStock={handleUpdateStock}
                    filteredStock={stock.filter(s => s.store_id === effectiveStoreId)}
                    effectiveStoreId={effectiveStoreId}
                    fetchData={fetchData}
                    initialInventory={stock.filter(s => s.store_id === effectiveStoreId).reduce((acc, s) => ({...acc, [s.stock_id]: s.stock_current.toString()}), {})}
                />
            )}

            {showWastageModal && (
                <WastageModal 
                    isOpen={showWastageModal}
                    onClose={() => setShowWastageModal(false)}
                    onUpdateStock={handleUpdateStock}
                    filteredStock={stock.filter(s => s.store_id === effectiveStoreId)}
                    effectiveStoreId={effectiveStoreId}
                    fetchData={fetchData}
                    user={user}
                />
            )}

            {showPartnersModal && (
                <PartnersModal 
                    isOpen={showPartnersModal}
                    onClose={() => setShowPartnersModal(false)}
                    partners={filteredPartners}
                    onUpdatePartner={handleUpdatePartner}
                    onAddPartner={handleSavePartner}
                    onDeletePartner={handleDeletePartner}
                    onTogglePartner={handleTogglePartner}
                    effectiveStoreId={effectiveStoreId}
                    fetchData={fetchData}
                />
            )}

            {showProductModal && (
                <ProductModal 
                    isOpen={showProductModal}
                    onClose={() => setShowProductModal(false)}
                    editingProduct={editingProduct}
                    form={{}} // This modal handles its own form now in ProdutosTab
                    setForm={() => {}} 
                    onSave={onSaveProduct}
                    stock={stock}
                    effectiveStoreId={effectiveStoreId}
                    fetchData={fetchData}
                />
            )}

            {showCancelModal && (
                <CancelSaleModal 
                    isOpen={!!showCancelModal}
                    onClose={() => setShowCancelModal(null)}
                    onConfirm={handleCancelSale}
                    reason={cancelReason}
                    setReason={setCancelReason}
                    isSubmitting={isSubmitting}
                />
            )}

            {showTicketModal && ticketData && (
                <TicketModal 
                    isOpen={showTicketModal}
                    onClose={() => setShowTicketModal(false)}
                    ticketData={ticketData}
                    stores={stores}
                    effectiveStoreId={effectiveStoreId}
                    handlePrintTicket={() => handleOpenPrintPreview(ticketData.items, ticketData.saleCode, ticketData.method || 'MISTO', ticketData.buyer)}
                />
            )}

            {showSangriaDetailModal && (
                <SangriaDetailModal 
                    isOpen={!!showSangriaDetailModal}
                    onClose={() => setShowSangriaDetailModal(null)}
                    title={showSangriaDetailModal === 'day' ? 'Sangrias do Dia' : 'Sangrias do Mês'}
                    sangrias={showSangriaDetailModal === 'day' ? dreStats.dayExits : dreStats.monthExits}
                    categories={sangriaCategories}
                    isAdmin={isAdmin}
                    onEditSangria={(s) => {
                        setEditingSangria(s);
                        setEditSangriaForm({
                            amount: s.amount.toString(),
                            transactionDate: s.transaction_date,
                            categoryId: s.category_id,
                            description: s.description || '',
                            notes: s.notes || ''
                        });
                        setShowEditSangriaModal(true);
                    }}
                    onDeleteSangria={handleDeleteSangria}
                />
            )}

            {showEditSangriaModal && (
                <EditSangriaModal 
                    isOpen={showEditSangriaModal}
                    onClose={() => setShowEditSangriaModal(false)}
                    onSubmit={handleSaveEditSangria}
                    form={editSangriaForm}
                    setForm={setEditSangriaForm}
                    categories={sangriaCategories.filter(c => c.store_id === effectiveStoreId && c.is_active)}
                    isSubmitting={isSubmitting}
                />
            )}
        </div>
    );
};

export default IceCreamModule;
