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
import { printSaleReceipt } from '@/services/thermalPrinterService';
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

const ICE_CREAM_STORE_IDS = [
    '0eef2f53-4732-4824-84a5-2092234efaef', // Loja 26 - Cruz das Almas
    'cbeeb1ea-911f-4d3a-87a9-3c38aafa0673'  // Loja 109 - Conceição do Jacuípe
];

const getTodayBrazil = (): string => {
    return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
};

const IceCreamModule: React.FC<IceCreamModuleProps> = ({
    user,
    stores = [],
    can,
    partners = [],
    adminUsers = []
}) => {
    const [activeTab, setActiveTab] = useState<'pdv' | 'dre' | 'dre_mensal' | 'stock' | 'audit' | 'produtos' | 'despesas'>('pdv');

    // ═══════════════════════════════════════════════════════════════
    // ⚙️ INTERNAL STATES (Ice Cream Module)
    // ═══════════════════════════════════════════════════════════════
    const [salesHeaders, setSalesHeaders] = useState<any[]>([]);
    const [sales, setSales] = useState<any[]>([]);
    const [salePayments, setSalePayments] = useState<any[]>([]);
    const [sangrias, setSangrias] = useState<any[]>([]);
    const [stock, setStock] = useState<any[]>([]);
    const [stockMovements, setStockMovements] = useState<any[]>([]);
    const [wastage, setWastage] = useState<any[]>([]);
    const [futureDebts, setFutureDebts] = useState<any[]>([]);
    const [items, setItems] = useState<any[]>([]);
    const [promissories, setPromissories] = useState<any[]>([]);
    const [sangriaCategories, setSangriaCategories] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const LOJA_26_ID = '0eef2f53-4732-4824-84a5-2092234efaef';

    const [effectiveStoreId, setEffectiveStoreId] = useState(() => {
        if (user?.storeId && user.storeId !== "") return user.storeId;
        const loja26 = stores.find(s => s.id === LOJA_26_ID);
        if (loja26) return loja26.id;
        if (stores.length > 0) return stores[0].id;
        return '';
    });

    // Quando stores carregam e effectiveStoreId está vazio, definir default
    useEffect(() => {
        if (stores && stores.length > 0 && !effectiveStoreId) {
            // Ice cream stores IDs
            const ICE_CREAM_STORES = [
                '0eef2f53-4732-4824-84a5-2092234efaef', // Loja 26
                'cbeeb1ea-911f-4d3a-87a9-3c38aafa0673'  // Loja 109
            ];
            
            // Se admin sem storeId, default para Loja 26
            const defaultStore = stores.find(s => s.id === ICE_CREAM_STORES[0]);
            if (defaultStore) {
                setEffectiveStoreId(defaultStore.id);
            } else if (stores.length > 0) {
                setEffectiveStoreId(stores[0].id);
            }
        }
    }, [stores, effectiveStoreId]);

    const isAdmin = user?.role === UserRole.ADMIN || user?.role === UserRole.SUPER_ADMIN || String(user?.role).toUpperCase() === 'ADMIN' || String(user?.role).toUpperCase() === 'SUPER_ADMIN';
    const canManage = can('MODULE_ICECREAM_MANAGE');
    const isSorvete = user?.role === UserRole.ICE_CREAM;
    const isGerente = user?.role === UserRole.MANAGER || String(user?.role).toUpperCase() === 'MANAGER' || String(user?.role).toUpperCase() === 'GERENTE';

    // ✅ FIX: Auto-selecionar loja para usuários SORVETE
    useEffect(() => {
        if (user?.role === UserRole.ICE_CREAM && user?.storeId && effectiveStoreId !== user.storeId) {
            console.log('🔧 Auto-selecionando loja do usuário SORVETE:', user.storeId);
            setEffectiveStoreId(user.storeId);
        }
    }, [user]);

    // ═══════════════════════════════════════════════════════════════
    // 🔄 LOAD DATA FOR THE USER PROFILE
    // ═══════════════════════════════════════════════════════════════
    const loadIceCreamData = async (silent = false) => {
        if (!silent) setIsLoading(true);
        try {
            const now = new Date();
            const isSorveteRole = user?.role === UserRole.ICE_CREAM;
            const isGerente = user?.role === UserRole.MANAGER;

            // Determinar range de datas
            let startDate: string;
            let endDate: string;

            if (isSorveteRole) {
                // SORVETE: apenas HOJE
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                startDate = today.toISOString();
                const tomorrow = new Date(today);
                tomorrow.setDate(tomorrow.getDate() + 1);
                endDate = tomorrow.toISOString();
            } else if (isGerente) {
                // GERENTE: mês atual + anterior se dia <= 10
                const start = new Date();
                if (now.getDate() <= 10) {
                    start.setMonth(start.getMonth() - 1);
                }
                start.setDate(1);
                start.setHours(0, 0, 0, 0);
                startDate = start.toISOString();
                const end = new Date();
                end.setMonth(end.getMonth() + 1);
                end.setDate(1);
                end.setHours(0, 0, 0, 0);
                endDate = end.toISOString();
            } else {
                // ADMIN: mês atual
                const start = new Date();
                start.setDate(1);
                start.setHours(0, 0, 0, 0);
                startDate = start.toISOString();
                const end = new Date(start);
                end.setMonth(end.getMonth() + 1);
                endDate = end.toISOString();
            }

            // Filtro de loja para SORVETE - se as lojas estão selecionadas, use effectiveStoreId se disponível
            const storeFilter = (isSorveteRole && user?.storeId)
                ? [user.storeId]
                : (effectiveStoreId && effectiveStoreId !== 'all' ? [effectiveStoreId] : ICE_CREAM_STORE_IDS);

            // TODAS as queries em PARALELO com Promise.all
            const [
                { data: headers },
                { data: dailySales },
                { data: payments },
                { data: sangriaData },
                { data: stockData },
                { data: movements },
                { data: wastageData },
                { data: debts },
                { data: itemsData },
                { data: promissoryData },
                { data: sangriaCategoriesData }
            ] = await Promise.all([
                // 1. ice_cream_sales (headers)
                supabase.from('ice_cream_sales').select('*')
                    .in('store_id', storeFilter)
                    .gte('created_at', startDate)
                    .lt('created_at', endDate)
                    .order('created_at', { ascending: false }),
                
                // 2. ice_cream_daily_sales (itens)
                supabase.from('ice_cream_daily_sales').select('*')
                    .in('store_id', storeFilter)
                    .gte('created_at', startDate)
                    .lt('created_at', endDate),
                
                // 3. ice_cream_daily_sales_payments
                supabase.from('ice_cream_daily_sales_payments').select('*')
                    .in('store_id', storeFilter)
                    .gte('created_at', startDate)
                    .lt('created_at', endDate),
                
                // 4. ice_cream_sangria (filtrar por data também!)
                supabase.from('ice_cream_sangria').select('*')
                    .in('store_id', storeFilter)
                    .gte('created_at', startDate)
                    .lt('created_at', endDate),
                
                // 5. ice_cream_stock (sem filtro de data, é estado atual)
                supabase.from('ice_cream_stock').select('*')
                    .in('store_id', storeFilter),
                
                // 6. ice_cream_stock_movements (COM filtro de data!)
                supabase.from('ice_cream_stock_movements').select('*')
                    .in('store_id', storeFilter)
                    .gte('created_at', startDate)
                    .lt('created_at', endDate),
                
                // 7. ice_cream_wastage
                supabase.from('ice_cream_wastage').select('*')
                    .in('store_id', storeFilter)
                    .gte('created_at', startDate)
                    .lt('created_at', endDate),
                
                // 8. ice_cream_future_debts (sem filtro de data)
                supabase.from('ice_cream_future_debts').select('*')
                    .in('store_id', storeFilter),
                
                // 9. ice_cream_items (catálogo, sem filtro)
                supabase.from('ice_cream_items').select('*'),

                // 10. ice_cream_promissory_notes
                supabase.from('ice_cream_promissory_notes').select('*'),

                // 11. ice_cream_sangria_categoria
                supabase.from('ice_cream_sangria_categoria').select('*')
            ]);

            setSalesHeaders(headers || []);
            setSales(
                (dailySales || []).map((x: any) => ({
                    id: x.id,
                    saleId: x.sale_id,
                    storeId: x.store_id,
                    itemId: x.item_id,
                    productName: x.product_name,
                    category: x.category,
                    flavor: x.flavor,
                    unitsSold: Number(x.units_sold || 0),
                    unitPrice: Number(x.unit_price || 0),
                    totalValue: Number(x.total_value || 0),
                    paymentMethod: x.payment_method,
                    saleCode: x.sale_code,
                    buyer_name: x.buyer_name,
                    createdAt: x.created_at,
                    canceledAt: x.canceled_at,
                    canceledBy: x.canceled_by,
                    status: x.status,
                    cancel_reason: x.cancel_reason
                }))
            );
            setSalePayments((payments || []).map((x: any) => ({ ...x, amount: Number(x.amount || 0) })));
            setSangrias(sangriaData || []);
            setStock((stockData || []).map((item: any) => ({ ...item, stock_id: item.id })));
            setStockMovements(movements || []);
            setWastage(wastageData || []);
            setFutureDebts(debts || []);
            setItems(
                (itemsData || []).map((x: any) => ({
                    id: x.id,
                    storeId: x.store_id,
                    name: x.name,
                    category: x.category,
                    price: Number(x.price || 0),
                    flavor: x.flavor,
                    active: x.active,
                    consumption_per_sale: x.consumption_per_sale || 0,
                    recipe: typeof x.recipe === 'string' ? JSON.parse(x.recipe) : (x.recipe || []),
                    image_url: x.image_url
                }))
            );
            setPromissories(promissoryData || []);
            setSangriaCategories(sangriaCategoriesData || []);
        } catch (e) {
            console.error('❌ Erro carregando dados de Sorvete:', e);
        } finally {
            if (!silent) setIsLoading(false);
        }
    };

    // Chamar no mount e nas dependências apropriadas
    useEffect(() => {
        loadIceCreamData();
    }, [effectiveStoreId]);

    const fetchData = useCallback(async (silent = false) => {
        await loadIceCreamData(silent);
    }, [effectiveStoreId]);

    // ═══════════════════════════════════════════════════════════════
    // 🔄 AUTO-REFRESH SILENCIOSO - Atualiza dados a cada 30 segundos
    // ═══════════════════════════════════════════════════════════════
    useEffect(() => {
        let isFetching = false;
        
        console.log('🔄 Auto-refresh iniciado (atualiza a cada 30s)');
        
        const interval = setInterval(async () => {
            const needsRefresh = ['dre', 'audit', 'dre_mensal', 'despesas'].includes(activeTab);
            
            if (!needsRefresh) return;
            if (isFetching) return;
            
            console.log('⏰ Auto-refresh silencioso às', new Date().toLocaleTimeString());
            
            isFetching = true;
            try {
                await fetchData(true);
            } catch (error) {
                console.error('❌ Erro no auto-refresh:', error);
            } finally {
                isFetching = false;
            }
        }, 30000);
        
        const handleVisibilityChange = () => {
            if (document.hidden) clearInterval(interval);
        };
        
        document.addEventListener('visibilitychange', handleVisibilityChange);
        
        return () => {
            console.log('🛑 Auto-refresh parado');
            clearInterval(interval);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [activeTab, fetchData]);

    // Dates
    const [displayDate, setDisplayDate] = useState(getTodayBrazil());
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

    // Audit State
    const [auditSubTab, setAuditSubTab] = useState<'vendas' | 'avarias' | 'cancelamentos'>('vendas');
    const [showDaySummary, setShowDaySummary] = useState(false);
    const [auditDay, setAuditDay] = useState(new Date().getDate().toString());
    const [auditMonth, setAuditMonth] = useState((new Date().getMonth() + 1).toString());
    const [auditYear, setAuditYear] = useState(new Date().getFullYear().toString());
    const [auditSearch, setAuditSearch] = useState('');

    const selectedAuditDate = useMemo(() => {
        if (isSorvete) {
            return getTodayBrazil();
        }
        if (!auditDay || !auditMonth || !auditYear) return '';
        const d = auditDay.padStart(2, '0');
        const m = auditMonth.padStart(2, '0');
        return `${auditYear}-${m}-${d}`;
    }, [auditDay, auditMonth, auditYear, isSorvete]);

    // ─── FETCH SOB DEMANDA — DRE DIÁRIO ─────────────────────────────────────────
    // Dados extras buscados quando o usuário navega para uma data fora do mês atual
    const [extraSales, setExtraSales] = useState<any[]>([]);
    const [extraHeaders, setExtraHeaders] = useState<any[]>([]);
    const [extraPayments, setExtraPayments] = useState<any[]>([]);
    const [extraSangrias, setExtraSangrias] = useState<any[]>([]);
    const [extraStockMovements, setExtraStockMovements] = useState<any[]>([]);
    const [extraWastage, setExtraWastage] = useState<any[]>([]);
    const [isDRELoading, setIsDRELoading] = useState(false);
    
    // Detecta mudança de data e busca dados extras se necessário
    useEffect(() => {
        if (!effectiveStoreId) return;

        // Se a aba ativa for DRE Mensal, o mês de referência vem do seletor 
        // selectedMonth/selectedYear. Nas outras abas (DRE Diário, Auditoria), 
        // o mês de referência vem de displayDate.
        const referenceDate = activeTab === 'dre_mensal'
            ? new Date(Number(selectedYear), Number(selectedMonth) - 1, 1)
            : (displayDate ? new Date(displayDate + 'T00:00:00') : null);

        if (!referenceDate) return;

        const now = new Date();
        const selected = referenceDate;
        const selectedMonthStart = new Date(selected.getFullYear(), selected.getMonth(), 1).getTime();
        const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    
        // Se for no mês atual e o usuário for ADMIN ou GERENTE, ele já tem os dados carregados localmente
        if (selectedMonthStart === currentMonthStart) {
            setExtraSales([]);
            setExtraHeaders([]);
            setExtraPayments([]);
            setExtraSangrias([]);
            setExtraStockMovements([]);
            setExtraWastage([]);
            return;
        }
    
        // Fora desses casos, buscamos o mês selecionado no Supabase (DRE completo para o mês selecionado)
        const fetchOnDemandData = async () => {
            if (!effectiveStoreId || effectiveStoreId === 'all') {
                setExtraSales([]);
                setExtraHeaders([]);
                setExtraPayments([]);
                setExtraSangrias([]);
                setExtraStockMovements([]);
                setExtraWastage([]);
                setIsDRELoading(false);
                return;
            }

            setIsDRELoading(true);
            try {
                const start = new Date(selected.getFullYear(), selected.getMonth(), 1);
                const startDate = start.toISOString();
                const end = new Date(start);
                end.setMonth(end.getMonth() + 1);
                const endDate = end.toISOString();

                const storeFilter = [effectiveStoreId];
    
                const [
                    { data: hdrs },
                    { data: sngs },
                    { data: itms },
                    { data: pays },
                    { data: mvmts },
                    { data: wstg }
                ] = await Promise.all([
                    supabase
                        .from('ice_cream_sales')
                        .select('*')
                        .in('store_id', storeFilter)
                        .gte('created_at', startDate)
                        .lt('created_at', endDate),
                    supabase
                        .from('ice_cream_sangria')
                        .select('*')
                        .in('store_id', storeFilter)
                        .gte('created_at', startDate)
                        .lt('created_at', endDate),
                    supabase
                        .from('ice_cream_daily_sales')
                        .select('*')
                        .in('store_id', storeFilter)
                        .gte('created_at', startDate)
                        .lt('created_at', endDate),
                    supabase
                        .from('ice_cream_daily_sales_payments')
                        .select('*')
                        .in('store_id', storeFilter)
                        .gte('created_at', startDate)
                        .lt('created_at', endDate),
                    supabase
                        .from('ice_cream_stock_movements')
                        .select('*')
                        .in('store_id', storeFilter)
                        .gte('created_at', startDate)
                        .lt('created_at', endDate),
                    supabase
                        .from('ice_cream_wastage')
                        .select('*')
                        .in('store_id', storeFilter)
                        .gte('created_at', startDate)
                        .lt('created_at', endDate)
                ]);
    
                setExtraHeaders(hdrs || []);
                setExtraSales(
                    (itms || []).map((x: any) => ({
                        id: x.id,
                        saleId: x.sale_id,
                        storeId: x.store_id,
                        itemId: x.item_id,
                        productName: x.product_name,
                        category: x.category,
                        flavor: x.flavor,
                        unitsSold: Number(x.units_sold || 0),
                        unitPrice: Number(x.unit_price || 0),
                        totalValue: Number(x.total_value || 0),
                        paymentMethod: x.payment_method,
                        saleCode: x.sale_code,
                        buyer_name: x.buyer_name,
                        createdAt: x.created_at,
                        status: x.status,
                        cancel_reason: x.cancel_reason,
                        canceled_by: x.canceled_by
                    }))
                );
                setExtraPayments(
                    (pays || []).map((x: any) => ({ ...x, amount: Number(x.amount || 0) }))
                );
                setExtraSangrias(sngs || []);
                setExtraStockMovements(mvmts || []);
                setExtraWastage(wstg || []);
            } catch (e) {
                console.error('[On Demand] Erro ao buscar dados do mês selecionado:', e);
            } finally {
                setIsDRELoading(false);
            }
        };
    
        fetchOnDemandData();
    }, [displayDate, effectiveStoreId, activeTab, selectedMonth, selectedYear]);

    // ✅ Sync displayDate with audit date when tab is audit
    useEffect(() => {
        if (activeTab === 'audit' && selectedAuditDate && displayDate !== selectedAuditDate) {
            setDisplayDate(selectedAuditDate);
        }
    }, [selectedAuditDate, activeTab]);

    // ═══════════════════════════════════════════════════════════════
    // 📡 SUPABASE REALTIME (Atualização automática)
    // ═══════════════════════════════════════════════════════════════
    useEffect(() => {
        const storeFilter = isSorvete && user?.storeId 
            ? [user.storeId] 
            : ICE_CREAM_STORE_IDS;

        const channel = supabase
            .channel('ice-cream-realtime-channel')
            .on('postgres_changes', 
                { event: '*', schema: 'public', table: 'ice_cream_sales' },
                (payload) => {
                    const rec = payload.eventType === 'DELETE' ? payload.old : payload.new;
                    if (!rec || !storeFilter.includes(rec.store_id)) return;

                    if (payload.eventType === 'INSERT') {
                        setSalesHeaders(prev => {
                            if (prev.some(x => x.id === rec.id)) return prev;
                            return [rec, ...prev];
                        });
                    }
                    if (payload.eventType === 'UPDATE') {
                        setSalesHeaders(prev => prev.map(h => h.id === rec.id ? rec : h));
                    }
                    if (payload.eventType === 'DELETE') {
                        setSalesHeaders(prev => prev.filter(h => h.id !== rec.id));
                    }
                }
            )
            .on('postgres_changes',
                { event: '*', schema: 'public', table: 'ice_cream_daily_sales' },
                (payload) => {
                    const rec = payload.eventType === 'DELETE' ? payload.old : payload.new;
                    if (!rec || !storeFilter.includes(rec.store_id)) return;

                    const mapped = payload.eventType === 'DELETE' ? null : {
                        id: rec.id,
                        saleId: rec.sale_id,
                        storeId: rec.store_id,
                        itemId: rec.item_id,
                        productName: rec.product_name,
                        category: rec.category,
                        flavor: rec.flavor,
                        unitsSold: Number(rec.units_sold || 0),
                        unitPrice: Number(rec.unit_price || 0),
                        totalValue: Number(rec.total_value || 0),
                        paymentMethod: rec.payment_method,
                        saleCode: rec.sale_code,
                        buyer_name: rec.buyer_name,
                        createdAt: rec.created_at,
                        canceledAt: rec.canceled_at,
                        canceledBy: rec.canceled_by,
                        status: rec.status,
                        cancel_reason: rec.cancel_reason
                    };

                    if (payload.eventType === 'INSERT' && mapped) {
                        setSales(prev => {
                            if (prev.some(x => x.id === mapped.id)) return prev;
                            return [...prev, mapped];
                        });
                    }
                    if (payload.eventType === 'UPDATE' && mapped) {
                        setSales(prev => prev.map(s => s.id === mapped.id ? mapped : s));
                    }
                    if (payload.eventType === 'DELETE') {
                        setSales(prev => prev.filter(s => s.id !== rec.id));
                    }
                }
            )
            .on('postgres_changes',
                { event: '*', schema: 'public', table: 'ice_cream_daily_sales_payments' },
                (payload) => {
                    const rec = payload.eventType === 'DELETE' ? payload.old : payload.new;
                    if (!rec || !storeFilter.includes(rec.store_id)) return;

                    const mapped = payload.eventType === 'DELETE' ? null : {
                        ...rec,
                        amount: Number(rec.amount || 0)
                    };

                    if (payload.eventType === 'INSERT' && mapped) {
                        setSalePayments(prev => {
                            if (prev.some(x => (x as any).id === (mapped as any).id)) return prev;
                            return [...prev, mapped];
                        });
                    }
                    if (payload.eventType === 'UPDATE' && mapped) {
                        setSalePayments(prev => prev.map(p => (p as any).id === (mapped as any).id ? mapped : p));
                    }
                    if (payload.eventType === 'DELETE') {
                        setSalePayments(prev => prev.filter(p => (p as any).id !== rec.id));
                    }
                }
            )
            .on('postgres_changes',
                { event: '*', schema: 'public', table: 'ice_cream_stock' },
                (payload) => {
                    const rec = payload.eventType === 'DELETE' ? payload.old : payload.new;
                    if (!rec || !storeFilter.includes(rec.store_id)) return;

                    const mapped = payload.eventType === 'DELETE' ? null : {
                        ...rec,
                        stock_id: rec.id
                    };

                    if (payload.eventType === 'INSERT' && mapped) {
                        setStock(prev => {
                            if (prev.some(x => (x as any).id === (mapped as any).id)) return prev;
                            return [...prev, mapped];
                        });
                    }
                    if (payload.eventType === 'UPDATE' && mapped) {
                        setStock(prev => prev.map(s => (s as any).id === (mapped as any).id ? mapped : s));
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user, effectiveStoreId]);

    // ═══════════════════════════════════════════════════════════════
    // 💾 LOCAL DATABASE-ACTION HANDLERS
    // ═══════════════════════════════════════════════════════════════
    const onAddSangria = async (s: Partial<IceCreamSangria>) => {
        const { error } = await supabase.from('ice_cream_sangria').insert([s]);
        if (error) throw error;
        await fetchData();
    };

    const onAddSangriaCategory = async (c: Partial<IceCreamSangriaCategory>) => {
        const { error } = await supabase.from('ice_cream_sangria_categoria').insert([c]);
        if (error) throw error;
        await fetchData();
    };

    const onDeleteSangriaCategory = async (id: string) => {
        const { error } = await supabase.from('ice_cream_sangria_categoria').delete().eq('id', id);
        if (error) throw error;
        await fetchData();
    };

    const onAddStockMovement = async (m: Partial<IceCreamStockMovement>) => {
        const { error } = await supabase.from('ice_cream_stock_movements').insert([m]);
        if (error) throw error;
        await fetchData();
    };

    const onAddFutureDebt = async (debtData: Partial<IceCreamFutureDebt>) => {
        const { error } = await supabase.from('ice_cream_future_debts').insert([
            {
                store_id: debtData.store_id,
                supplier_name: debtData.supplier_name,
                total_amount: debtData.total_amount,
                installment_number: debtData.installment_number,
                total_installments: debtData.total_installments,
                installment_amount: debtData.installment_amount,
                due_date: debtData.due_date,
                status: debtData.status || 'pending',
                category_id: debtData.category_id,
                description: debtData.description,
                created_by: user?.id
            }
        ]);
        if (error) throw error;
        await fetchData();
    };

    const onPayFutureDebt = async (debtId: string, paymentDate: string) => {
        const { error } = await supabase.from('ice_cream_future_debts').update({
            status: 'paid',
            payment_date: paymentDate
        }).eq('id', debtId);
        if (error) throw error;
        await fetchData();
    };

    const onAddSales = async (s: IceCreamDailySale[]) => {
        await supabase.from('ice_cream_daily_sales').insert(s.map(x => ({
            store_id: x.storeId,
            item_id: x.itemId,
            product_name: x.productName,
            category: x.category,
            flavor: x.flavor,
            units_sold: Math.round(x.unitsSold),
            unit_price: x.unitPrice,
            total_value: x.totalValue,
            payment_method: x.paymentMethod,
            sale_code: x.saleCode || (x as any).sale_code,
            buyer_name: x.buyer_name || (x as any).buyerName,
            status: 'completed'
        })));
        await fetchData();
    };

    const onAddSaleAtomic = async (saleData: any, itemsList: IceCreamDailySale[], paymentsList: { method: string, amount: number }[]) => {
        const totalPayments = paymentsList.reduce((acc, p) => acc + p.amount, 0);
        if (Math.abs(totalPayments - saleData.total) > 0.01) {
            throw new Error("A soma dos pagamentos não confere com o total da venda.");
        }

        const buyerName = saleData.buyer_name?.trim() || null;

        const { data: header, error: headerError } = await supabase
            .from('ice_cream_sales')
            .insert([{
                store_id: saleData.store_id,
                total_value: saleData.total,
                sale_code: saleData.sale_code,
                buyer_name: buyerName,
                status: 'completed',
                created_at: new Date().toISOString()
            }])
            .select().single();

        if (headerError) throw headerError;
        const saleId = header.id;

        try {
            const { error: itemsError } = await supabase.from('ice_cream_daily_sales').insert(itemsList.map(x => ({
                sale_id: saleId,
                store_id: saleData.store_id,
                item_id: x.itemId,
                product_name: x.productName,
                category: x.category,
                flavor: x.flavor,
                units_sold: Math.round(x.unitsSold),
                unit_price: x.unitPrice,
                total_value: x.totalValue,
                payment_method: paymentsList.length > 1 ? 'Misto' : paymentsList[0].method,
                sale_code: saleData.sale_code,
                buyer_name: buyerName,
                status: 'completed'
            })));

            if (itemsError) {
                await supabase.from('ice_cream_sales').delete().eq('id', saleId);
                throw itemsError;
            }

            const { error: paymentsError } = await supabase.from('ice_cream_daily_sales_payments').insert(paymentsList.map(p => ({
                sale_id: saleId,
                store_id: header.store_id,
                payment_method: p.method,
                amount: p.amount,
                sale_code: saleData.sale_code,
                buyer_name: buyerName,
                created_at: new Date().toISOString()
            })));

            if (paymentsError) {
                await supabase.from('ice_cream_daily_sales').delete().eq('sale_id', saleId);
                await supabase.from('ice_cream_sales').delete().eq('id', saleId);
                throw paymentsError;
            }
        } catch (err) {
            console.error("Erro na transação de venda (Rollback manual):", err);
            throw err;
        }
        await fetchData();
    };

    const onCancelSale = async (idOrCode: string, reason?: string) => {
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrCode);

        let saleCode = idOrCode;
        let saleId = isUUID ? idOrCode : null;

        if (isUUID) {
            const { data: sale } = await supabase.from('ice_cream_sales').select('sale_code').eq('id', idOrCode).maybeSingle();
            if (sale) saleCode = sale.sale_code;
        } else {
            const { data: sale } = await supabase.from('ice_cream_sales').select('id').eq('sale_code', idOrCode).maybeSingle();
            if (sale) saleId = sale.id;
        }

        const cancelData = {
            status: 'canceled',
            cancel_reason: reason || null,
            canceled_by: user?.name,
            canceled_at: new Date().toISOString()
        };

        if (saleId) {
            await supabase.from('ice_cream_sales').update({ ...cancelData, canceled_by_name: user?.name }).eq('id', saleId);
            await supabase.from('ice_cream_daily_sales').update(cancelData).eq('sale_id', saleId);
        } else {
            await supabase.from('ice_cream_sales').update({ ...cancelData, canceled_by_name: user?.name }).eq('sale_code', saleCode);
            await supabase.from('ice_cream_daily_sales').update(cancelData).eq('sale_code', saleCode);
        }

        await Promise.all([
            supabase.from('financial_card_sales').delete().eq('sale_code', saleCode),
            supabase.from('financial_pix_sales').delete().eq('sale_code', saleCode),
            supabase.from('ice_cream_daily_sales_payments').delete().eq('sale_code', saleCode)
        ]);

        await fetchData();
    };

    const onUpdatePrice = async (id: string, price: number) => {
        await supabase.from('ice_cream_items').update({ price }).eq('id', id);
        await fetchData();
    };

    const onSaveProduct = async (product: Partial<IceCreamItem>) => {
        const payload = {
            store_id: product.storeId, name: product.name, category: product.category, price: product.price,
            flavor: product.flavor, active: product.active ?? true, consumption_per_sale: product.consumptionPerSale || 0,
            recipe: JSON.stringify(product.recipe || []), image_url: product.image_url
        };
        if (product.id) await supabase.from('ice_cream_items').update(payload).eq('id', product.id);
        else await supabase.from('ice_cream_items').insert([payload]);
        await fetchData();
    };

    const onAddItem = async (name: string, category: string, price: number, flavor?: string, stockInitial?: number, unit?: string, consumptionPerSale?: number, targetStoreId?: string, recipe?: IceCreamRecipeItem[]) => {
        await onSaveProduct({ storeId: targetStoreId, name, category: category as any, price, flavor, recipe });
    };

    const onDeleteItem = async (id: string) => {
        await supabase.from('ice_cream_items').delete().eq('id', id);
        await fetchData();
    };

    const onUpdateStock = async (storeId: string, base: string, value: number, unit: string, type: string, stockId?: string) => {
        if (type === 'INVENTARIO' && stockId) {
            const { error } = await supabase.rpc('perform_inventory', {
                p_stock_id:     stockId,
                p_new_quantity: value,
                p_user_id:      null,
                p_notes:        'Inventário manual'
            });
            if (error) throw error;
        } else {
            const { data: current } = await supabase.from('ice_cream_stock').select('stock_current').eq('store_id', storeId).eq('product_base', base).maybeSingle();
            let finalVal = value;
            if (current) { finalVal = Number(current.stock_current || 0) + value; }
            await supabase.from('ice_cream_stock').upsert({ store_id: storeId, product_base: base, stock_current: finalVal, unit: unit, is_active: true }, { onConflict: 'store_id, product_base' });
        }
        await fetchData();
    };

    const liquidatePromissory = async (id: string) => {
        await supabase.from('ice_cream_promissory_notes').update({ status: 'paid' }).eq('id', id);
        await fetchData();
    };

    const onDeleteStockItem = async (id: string) => {
        if (can('MODULE_ADMIN_STOCK_DELETE') || can('MODULE_ADMIN')) {
            await supabase.from('ice_cream_stock').delete().eq('id', id);
            await fetchData();
        }
    };

    // Fonte de dados ativa: extras (mês específico) ou normais (período selecionado pela função de carga principal)
    const activeSales    = extraSales.length > 0    ? extraSales    : sales;
    const activeHeaders  = extraHeaders.length > 0  ? extraHeaders  : salesHeaders;
    const activePayments = extraPayments.length > 0 ? extraPayments : salePayments;
    const activeSangrias = extraSangrias.length > 0 ? extraSangrias : sangrias;
    const activeStockMovements = extraStockMovements.length > 0 ? extraStockMovements : stockMovements;
    const activeWastage        = extraWastage.length > 0        ? extraWastage        : wastage;

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
        sales: activeSales,
        salePayments: activePayments,
        salesHeaders: activeHeaders,
        sangrias: activeSangrias,
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

    const auditSummary = useMemo(() => {
        const filteredSales = activeSales.filter(s => {
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

        const dayHeaders = (activeHeaders || []).filter(h => {
            if (!h.created_at) return false;
            const d = new Date(h.created_at);
            const dateStr = d.toISOString().split('T')[0];
            const matchesStore = h.store_id === effectiveStoreId;
            return dateStr === selectedAuditDate && matchesStore && h.status === 'completed';
        });

        dayHeaders.forEach(h => {
            const payments = (activePayments || []).filter(p => p.sale_id === h.id);
            payments.forEach(p => {
                const method = p.payment_method;
                if (resumoPagamentos[method] !== undefined) {
                    resumoPagamentos[method] += Number(p.amount || 0);
                    resumoPagamentosQtd[method]++;
                }
            });
        });

        // ✅ USAR SEMPRE OS HEADERS COMO FONTE DA VERDADE
        const totalGeral = dayHeaders.reduce((sum, h) => sum + Number(h.total_value || 0), 0);

        return {
            resumoItens: Object.entries(resumoItens),
            totalGeral,
            totalItens,
            resumoPagamentos,
            resumoPagamentosQtd,
            totalCanceledCount,
            totalCanceledValue
        };
    }, [activeSales, selectedAuditDate, effectiveStoreId, activeHeaders, activePayments]);


    const groupedAuditSales = useMemo(() => {
        const filteredSales = activeSales.filter(s => {
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

        // Refine payment methods from activeHeaders/activePayments for accuracy
        Object.values(grouped).forEach((group: any) => {
            const header = (activeHeaders || []).find(h => h.sale_code === group.saleCode);
            if (header) {
                const payments = (activePayments || []).filter(p => p.sale_id === header.id);
                if (payments.length > 0) {
                    group.paymentMethods = payments.map(p => p.payment_method);
                }
            }
        });

        return Object.values(grouped).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }, [activeSales, selectedAuditDate, effectiveStoreId, auditSearch, activeHeaders, activePayments]);


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
        
        return activeSales.filter(s => {
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
    }, [activeSales, auditMonth, auditYear, effectiveStoreId, auditSearch]);

    // Handlers
    const handleOpenPrintPreview = (items: any[], saleCode: string, method: string, buyer?: string) => {
        const store = stores.find(s => s.id === effectiveStoreId);

        // Imprimir automaticamente via RawBT (Android) se disponível (Sem janela pop-up)
        try {
            printSaleReceipt({
                storeName: 'REAL CALCADOS',
                storeSubtitle: 'Sorveteria ' + (store?.name || ''),
                date: new Date().toLocaleString('pt-BR'),
                saleCode: saleCode,
                operator: user?.name || user?.email || '',
                items: items.map(i => ({
                    name: i.productName || i.product_name,
                    quantity: i.unitsSold || i.units_sold || 1,
                    unitPrice: Number(i.unitPrice || i.unit_price || 0),
                    total: Number(i.totalValue || i.total_value || 0),
                })),
                total: items.reduce((acc, i) => acc + Number(i.totalValue || 0), 0),
                paymentMethod: method,
            });
        } catch (printErr) {
            console.error('Erro de impressão RawBT:', printErr);
        }

        const printWindow = window.open('', '_blank');
        if (!printWindow) { alert("Pop-up bloqueado!"); return; }
        
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
        const hoje = getTodayBrazil();
        const input = window.prompt(
            'Data do pagamento (AAAA-MM-DD):\nDeixe a data de hoje ou altere para uma data retroativa.',
            hoje
        );
        if (input === null) return; // cancelou
        const paymentDate = input.trim() || hoje;
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

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px] h-96 bg-[#f8fafc] w-full">
                <Loader2 className="animate-spin text-blue-600 mb-4" size={48} />
                <span className="text-sm font-black uppercase text-slate-400 tracking-widest animate-pulse">Carregando dados...</span>
            </div>
        );
    }

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
                            {(isAdmin || isGerente) ? (
                                <select 
                                    key={`store-select-mobile-${stores.length}`}
                                    value={effectiveStoreId} 
                                    onChange={e => setEffectiveStoreId(e.target.value)}
                                    className="bg-slate-100 border-none rounded-xl px-3 py-2 text-[9px] font-black uppercase text-slate-600 outline-none cursor-pointer"
                                >
                                    {stores
                                        .filter(s => [
                                            '0eef2f53-4732-4824-84a5-2092234efaef',
                                            'cbeeb1ea-911f-4d3a-87a9-3c38aafa0673'
                                        ].includes(s.id))
                                        .map(s => <option key={s.id} value={s.id}>{s.name}</option>)
                                    }
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
                        {(isAdmin || isGerente) ? (
                            <select 
                                key={`store-select-desktop-${stores.length}`}
                                value={effectiveStoreId} 
                                onChange={e => setEffectiveStoreId(e.target.value)}
                                className="bg-slate-100 border-none rounded-xl px-4 py-2.5 text-[10px] font-black uppercase text-slate-600 outline-none cursor-pointer hover:bg-slate-200 transition-all"
                            >
                                {stores
                                    .filter(s => [
                                        '0eef2f53-4732-4824-84a5-2092234efaef',
                                        'cbeeb1ea-911f-4d3a-87a9-3c38aafa0673'
                                    ].includes(s.id))
                                    .map(s => <option key={s.id} value={s.id}>{s.name}</option>)
                                }
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
                    <>
                        {isDRELoading && (
                            <div className="flex items-center justify-center gap-3 py-3 text-blue-600 animate-pulse">
                                <Loader2 className="animate-spin" size={18}/>
                                <span className="text-[10px] font-black uppercase tracking-widest">
                                    Buscando dados do dia...
                                </span>
                            </div>
                        )}
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
                    </>
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
                            onAddStockBase={isSorvete ? async () => {} : (base, unit, storeId) => handleUpdateStock(storeId, base, 0, unit, 'CADASTRO')}
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
                            isLoading={isDRELoading}
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
