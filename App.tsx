import React, { useState, useEffect } from 'react';
import { 
    User, Store, MonthlyPerformance, UserRole, Cota, CotaSettings, CotaDebts, QuotaCategory, QuotaMixParameter,
    IceCreamItem, IceCreamDailySale, CashRegisterClosure, ProductPerformance, Receipt, IceCreamStock, IceCreamPromissoryNote, AgendaItem, DownloadItem, CashError, SystemLog, MonthlyGoal, CreditCardSale, PixSale,
    Sale, SalePayment, IceCreamSangria, IceCreamSangriaCategory,
    IceCreamStockMovement, StoreProfitPartner, AdminUser, PurchasingManagement, IceCreamFutureDebt
} from './types';
import { supabase } from './services/supabaseClient';
import apiService from './services/apiService';
import { BRAND_LOGO } from './constants';

// Módulos
import { CotasManagement } from './components/CotasManagement';
import DashboardAdmin from './components/DashboardAdmin';
import DashboardManager from './components/DashboardManager';
import GoalRegistration from './components/GoalRegistration';
import DashboardPurchases from './components/DashboardPurchases';
import IceCreamModule from './components/IceCreamModule';
import CashRegisterModule from './components/CashRegisterModule';
import AgendaSystem from './components/AgendaSystem';
import DownloadsModule from './components/DownloadsModule';
import AdminSettings from './components/AdminSettings';
import AdminUsersManagement from './components/AdminUsersManagement';
import AccessControlManagement from './components/AccessControlManagement';
import PurchaseAuthorization from './components/PurchaseAuthorization';
import TermoAutorizacao from './components/TermoAutorizacao';
import SystemAudit from './components/SystemAudit';
import SpreadsheetOrderModule from './components/SpreadsheetOrderModule';
import OSDemandsModule from './components/OSDemandsModule';
import DashboardPAModule from './components/dashboardPA/DashboardPAModule';
import LoginScreen from './components/LoginScreen';
import NotificationHeader from './components/NotificationHeader';
import ChangePasswordModal from './components/ChangePasswordModal';

// Ícones
import { 
    LayoutDashboard, Target, ShoppingBag, Calculator, IceCream as IceCreamIcon, 
    DollarSign, AlertCircle, Calendar, LogOut, Loader2, Menu, X, ClipboardList, Shield, UserCog, Users, ShieldAlert, Settings, FileSignature, FileText, Download, Lock,
    Sun, Moon, Trophy
} from 'lucide-react';

const App: React.FC = () => {
    const [user, setUser] = useState<User | null>(null);
    const [currentView, setCurrentView] = useState<string>(''); 
    const [isLoading, setIsLoading] = useState(true);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
    const [theme, setTheme] = useState<'light' | 'dark'>(() => {
        const saved = localStorage.getItem('theme');
        return (saved as 'light' | 'dark') || 'light';
    });

    useEffect(() => {
        if (window.innerWidth >= 1024) {
            setIsSidebarOpen(true);
        }
        
        const init = async () => {
            await bootstrapPermissions();
            
            // Recuperar sessão do apiService (Desativado para sempre solicitar senha)
            const savedUser = null; // apiService.getUser();
            if (false && savedUser && apiService.isAuthenticated()) {
                const rawRole = (savedUser.role_level || savedUser.role || '').toUpperCase();
                const mappedRole = rawRole === 'SORVETE' ? 'ICE_CREAM' : rawRole;
                
                const loggedUser: User = {
                    id: savedUser.id,
                    name: savedUser.name,
                    role: mappedRole as UserRole,
                    email: savedUser.email,
                    storeId: savedUser.store_id || savedUser.storeId
                };
                
                setUser(loggedUser);
                await fetchPermissions(loggedUser.role);
                setCurrentView(loggedUser.role === UserRole.ADMIN ? 'dashboard_rede' : loggedUser.role === UserRole.ICE_CREAM ? 'pdv_sorveteria' : 'dashboard_loja');
            } else {
                // Se não houver usuário, precisamos garantir que isLoading seja false para mostrar o login
                setIsLoading(false);
            }
        };
        
        init();
    }, []);

    useEffect(() => {
        const root = window.document.documentElement;
        if (theme === 'dark') {
            root.classList.add('dark');
        } else {
            root.classList.remove('dark');
        }
        localStorage.setItem('theme', theme);
    }, [theme]);

    const bootstrapPermissions = async () => {
        try {
            const { data: existing } = await supabase
                .from('page_permissions')
                .select('id')
                .eq('page_key', 'MODULE_DEMANDS')
                .single();

            if (!existing) {
                await supabase.from('page_permissions').insert([{
                    page_key: 'MODULE_DEMANDS',
                    label: 'Demanda OS',
                    module_group: 'Inteligência',
                    allow_admin: true,
                    allow_manager: false,
                    allow_cashier: false,
                    allow_sorvete: false,
                    sort_order: 55
                }]);
            }

            const { data: existingPA } = await supabase
                .from('page_permissions')
                .select('id')
                .eq('page_key', 'MODULE_DASHBOARD_PA')
                .single();

            if (!existingPA) {
                await supabase.from('page_permissions').insert([{
                    page_key: 'MODULE_DASHBOARD_PA',
                    label: 'Dashboard P.A.',
                    module_group: 'Inteligência',
                    allow_admin: true,
                    allow_manager: true,
                    allow_cashier: false,
                    allow_sorvete: false,
                    sort_order: 56
                }]);
            }

            const { data: existingDespesas } = await supabase
                .from('page_permissions')
                .select('id')
                .eq('page_key', 'MODULE_ICECREAM_DESPESAS')
                .single();

            if (!existingDespesas) {
                await supabase.from('page_permissions').insert([{
                    page_key: 'MODULE_ICECREAM_DESPESAS',
                    label: 'Sorveteria: Aba Despesas',
                    module_group: 'Sorveteria',
                    allow_admin: true,
                    allow_manager: true,
                    allow_cashier: false,
                    allow_sorvete: false,
                    sort_order: 60
                }]);
            }

        } catch (err) {
            console.error("Erro ao registrar permissão Demanda OS:", err);
        }
    };

    const [userPermissions, setUserPermissions] = useState<string[]>([]);
    const [userCount, setUserCount] = useState<number | null>(null);
    const [connectionError, setConnectionError] = useState<string | null>(null);

    const [stores, setStores] = useState<Store[]>([]);
    const [performanceData, setPerformanceData] = useState<MonthlyPerformance[]>([]);
    const [goalsData, setGoalsData] = useState<MonthlyGoal[]>([]);
    const [purchasingData, setPurchasingData] = useState<ProductPerformance[]>([]);
    const [cotas, setCotas] = useState<Cota[]>([]);
    const [cotaSettings, setCotaSettings] = useState<CotaSettings[]>([]);
    const [cotaDebts, setCotaDebts] = useState<CotaDebts[]>([]);
    const [quotaCategories, setQuotaCategories] = useState<QuotaCategory[]>([]);
    const [quotaMixParams, setQuotaMixParams] = useState<QuotaMixParameter[]>([]);
    const [iceCreamItems, setIceCreamItems] = useState<IceCreamItem[]>([]);
    const [iceCreamSales, setIceCreamSales] = useState<IceCreamDailySale[]>([]);
    const [sales, setSales] = useState<Sale[]>([]);
    const [salePayments, setSalePayments] = useState<SalePayment[]>([]);
    const [cardSales, setCardSales] = useState<CreditCardSale[]>([]);
    const [pixSales, setPixSales] = useState<PixSale[]>([]);
    const [iceCreamStock, setIceCreamStock] = useState<IceCreamStock[]>([]);
    const [icPromissories, setIcPromissories] = useState<IceCreamPromissoryNote[]>([]);
    const [receipts, setReceipts] = useState<Receipt[]>([]);
    const [cashErrors, setCashErrors] = useState<CashError[]>([]);
    const [agenda, setAgenda] = useState<AgendaItem[]>([]);
    const [downloads, setDownloads] = useState<DownloadItem[]>([]);
    const [closures, setClosures] = useState<CashRegisterClosure[]>([]);
    const [logs, setLogs] = useState<SystemLog[]>([]);
    const [icSangriaCategories, setIcSangriaCategories] = useState<IceCreamSangriaCategory[]>([]);
    const [icSangrias, setIcSangrias] = useState<IceCreamSangria[]>([]);
    const [icStockMovements, setIcStockMovements] = useState<IceCreamStockMovement[]>([]);
    const [partners, setPartners] = useState<StoreProfitPartner[]>([]);
    const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
    const [purchasingManagement, setPurchasingManagement] = useState<PurchasingManagement[]>([]);
    const [futureDebts, setFutureDebts] = useState<IceCreamFutureDebt[]>([]);

    const can = (permissionKey: string) => {
        if (user?.role === UserRole.ADMIN) return true;
        if (!userPermissions || userPermissions.length === 0) return false;
        return userPermissions.includes(permissionKey);
    };

    const fetchPermissions = async (role: string) => {
        const roleUpper = String(role || '').toUpperCase().trim();
        if (roleUpper === 'ADMIN') { setUserPermissions([]); return; }
        let columnToCheck = '';
        if (roleUpper === 'GERENTE' || roleUpper === 'MANAGER') columnToCheck = 'allow_manager';
        else if (roleUpper === 'CAIXA' || roleUpper === 'CASHIER') columnToCheck = 'allow_cashier';
        else if (roleUpper === 'SORVETE' || roleUpper === 'SORVETERIA' || roleUpper === 'ICE_CREAM') columnToCheck = 'allow_sorvete'; 
        if (!columnToCheck) return;
        const { data } = await supabase.from('page_permissions').select('page_key').eq(columnToCheck, true);
        if (data) setUserPermissions(data.map(p => p.page_key));
    };

    const fetchAllRows = async (table: string, orderBy: string) => {
        let allData: any[] = [];
        let from = 0;
        const step = 999;
        let hasMore = true;
        while (hasMore) {
            const { data, error } = await supabase.from(table).select('*').order(orderBy, { ascending: false }).range(from, from + step);
            if (error) break;
            if (data && data.length > 0) {
                allData = [...allData, ...data];
                from += step + 1;
                if (data.length <= step) hasMore = false;
            } else {
                hasMore = false;
            }
        }
        return { data: allData };
    };

    const addLog = async (action: string, details: string) => {
        if (!user) return;
        try {
            await supabase.from('system_logs').insert([{
                user_id: user.id,
                user_name: user.name,
                user_role: user.role,
                action,
                details
            }]);
            fetchData();
        } catch (err) {
            console.error("Erro ao criar log:", err);
        }
    };

    const fetchData = async () => {
        try {
            // Fase 1 — Dados críticos do dashboard
            const [
                {data: s}, {data: p}, {data: g}
            ] = await Promise.all([
                supabase.from('stores').select('*'),
                supabase.from('monthly_performance_actual').select('*'),
                supabase.from('monthly_goals').select('*')
            ]);

            if(s) setStores(s.map(x => ({
                ...x,
                managerName: x.manager_name,
                managerEmail: x.manager_email,
                managerPhone: x.manager_phone
            })).sort((a, b) => Number(a.number) - Number(b.number)));

            if(p) setPerformanceData(p.map(x => ({ 
                ...x, 
                storeId: x.store_id, 
                revenueActual: Number(x.revenue_actual || 0), 
                revenueTarget: Number(x.revenue_target || 0), 
                itemsActual: Number(x.items_actual || 0), 
                itemsTarget: Number(x.items_target || 0), 
                salesActual: Number(x.sales_actual || 0), 
                paActual: Number(x.pa_actual || x.items_per_ticket || 0), 
                puActual: Number(x.pu_actual || x.unit_price_average || 0), 
                averageTicket: Number(x.ticket_actual || x.average_ticket || 0), 
                percentMeta: Number(x.percent_meta || 0), 
                paTarget: Number(x.pa_target || 0), 
                puTarget: Number(x.pu_target || 0), 
                ticketTarget: Number(x.ticket_target || 0), 
                businessDays: Number(x.business_days || 26) 
            })));

            if(g) setGoalsData(g.map(x => ({ id: x.id, storeId: x.store_id, year: Number(x.year), month: Number(x.month), revenueTarget: Number(x.revenue_target || 0), itemsTarget: Number(x.items_target || 0), paTarget: Number(x.pa_target || 0), puTarget: Number(x.pu_target || 0), ticketTarget: Number(x.ticket_target || 0), delinquencyTarget: Number(x.delinquency_target || 2.0), businessDays: Number(x.business_days || 26), trend: x.trend || 'stable' })));

            // Chama setIsLoading(false) imediatamente após a Fase 1
            setIsLoading(false);

            // Fase 2 — Carrega em background
            const [
                {data: pur}, {data: c}, {data: cs}, {data: cd}, {data: cat}, {data: mix},
                {data: ici}, {data: ics}, {data: icst}, {data: icp}, {data: r}, {data: ce}, {data: ag}, {data: dl}, {data: cl}, {data: lg},
                {data: cds}, {data: pxs}, {data: sls}, {data: slsp},
                {data: sangCat}, {data: sang}, {data: movements}, {data: part}, {data: ausers},
                {data: pm}, {data: fd}
            ] = await Promise.all([
                supabase.from('product_performance').select('*'),
                supabase.from('cotas_with_category').select('*'),
                supabase.from('cota_settings').select('*'),
                supabase.from('cota_debts').select('*'),
                supabase.from('quota_product_categories').select('*'),
                supabase.from('quota_mix_parameters').select('*'),
                supabase.from('ice_cream_items').select('*'),
                fetchAllRows('ice_cream_daily_sales', 'created_at'),
                supabase.from('ice_cream_stock').select('*'),
                supabase.from('ice_cream_promissory_notes').select('*'),
                supabase.from('financial_receipts').select('*').order('created_at', { ascending: true }),
                supabase.from('cash_errors').select('*').order('created_at', { ascending: false }),
                supabase.from('agenda_tasks').select('*').order('due_time', { ascending: true }),
                supabase.from('downloads').select('*'),
                supabase.from('cash_register_closures').select('*'),
                supabase.from('system_logs').select('*').order('created_at', { ascending: false }).limit(200),
                fetchAllRows('financial_card_sales', 'created_at'),
                fetchAllRows('financial_pix_sales', 'created_at'),
                fetchAllRows('ice_cream_sales', 'created_at'),
                fetchAllRows('ice_cream_daily_sales_payments', 'created_at'),
                supabase.from('ice_cream_sangria_categoria').select('*'),
                fetchAllRows('ice_cream_sangria', 'created_at'),
                fetchAllRows('ice_cream_stock_movements', 'created_at'),
                supabase.from('store_profit_distribution').select('*'),
                supabase.from('admin_users').select('*'),
                supabase.from('gestao_compras').select('*'),
                supabase.from('ice_cream_future_debts').select('*').order('due_date', { ascending: true })
            ]);

            if(fd) setFutureDebts(fd);

            if(sls) setSales(sls);
            if(slsp) setSalePayments(slsp.map(x => ({ ...x, amount: Number(x.amount || 0) })));
            if(pur) setPurchasingData(pur.map(x => ({...x, storeId: x.store_id, pairsSold: x.pairs_sold})));
            if(c) setCotas(c.map(x => ({ ...x, id: x.id, storeId: x.store_id, totalValue: Number(x.total_value || 0), shipmentDate: x.shipment_date, paymentTerms: x.payment_terms, createdByRole: x.created_by_role, category_id: x.category_id, category_name: x.category_name || x.classification, createdAt: new Date(x.created_at) })));
            if(cs) setCotaSettings(cs.map(x => ({...x, storeId: x.store_id, budgetValue: x.budget_value, managerPercent: x.manager_percent})));
            if(cd) setCotaDebts(cd.map(x => ({...x, storeId: x.store_id})));
            if(cat) setQuotaCategories(cat);
            if(mix) setQuotaMixParams(mix.map(x => ({ ...x, storeId: x.store_id, category_name: x.parent_category, percentage: Number(x.mix_percentage || 0) })));
            if(ici) setIceCreamItems(ici.map(x => ({ id: x.id, storeId: x.store_id, name: x.name, category: x.category, price: Number(x.price || 0), flavor: x.flavor, active: x.active, consumption_per_sale: x.consumption_per_sale || 0, recipe: typeof x.recipe === 'string' ? JSON.parse(x.recipe) : (x.recipe || []), image_url: x.image_url })));
            if(ics) setIceCreamSales(ics.map(x => ({ id: x.id, storeId: x.store_id, itemId: x.item_id, productName: x.product_name, category: x.category, flavor: x.flavor, unitsSold: Number(x.units_sold || 0), unitPrice: Number(x.unit_price || 0), totalValue: Number(x.total_value || 0), paymentMethod: x.payment_method, saleCode: x.sale_code, buyer_name: x.buyer_name, createdAt: x.created_at, status: x.status, cancel_reason: x.cancel_reason, canceled_by: x.canceled_by })));
            if(cds) setCardSales(cds.map(x => ({ id: x.id, storeId: x.store_id, userId: x.user_id, userName: x.user_name, date: x.date, brand: x.brand, value: Number(x.value || 0), authorizationCode: x.authorization_code, saleCode: x.sale_code, createdAt: x.created_at })));
            if(pxs) setPixSales(pxs.map(x => ({ id: x.id, storeId: x.store_id, userId: x.user_id, userName: x.user_name, date: x.date, saleCode: x.sale_code, value: Number(x.value || 0), clientName: x.payer_name, createdAt: x.created_at })));
            if(icst) setIceCreamStock(icst.map(item => ({ ...item, stock_id: item.id })));
            if(icp) setIcPromissories(icp);
            if(r) setReceipts(r.map(x => ({ id: x.id, storeId: x.store_id, issuerName: x.issuer_name, payer: x.payer, recipient: x.recipient, value: Number(x.value || 0), valueInWords: x.value_in_words, date: x.receipt_date, reference: x.reference, createdAt: new Date(x.created_at) })));
            if(ce) setCashErrors(ce.map(x => ({...x, id: x.id, storeId: x.store_id, userId: x.user_id, userName: x.user_name || 'Usuário', date: x.error_date || x.date, value: Number(x.value || 0), type: x.type, reason: x.reason, createdAt: new Date(x.created_at)})));
            if(ag) setAgenda(ag.map(x => ({...x, userId: x.user_id, title: x.title, description: x.description, dueDate: x.due_date ? x.due_date.split('T')[0] : '', dueTime: x.due_time, priority: x.priority, isCompleted: x.is_completed})));
            if(dl) setDownloads(dl.map(x => ({...x, fileName: x.file_name, createdBy: x.created_by})));
            if(cl) setClosures(cl.map(x => ({...x, storeId: x.store_id, closedBy: x.closed_by})));
            if(lg) setLogs(lg.map((x: any) => ({
                id: x.id,
                userId: x.user_id,
                userName: x.user_name,
                userRole: x.user_role as UserRole,
                action: x.action,
                details: x.details,
                created_at: x.created_at
            })));
            if(sangCat) setIcSangriaCategories(sangCat);
            if(sang) setIcSangrias(sang);
            if(movements) setIcStockMovements(movements);
            if(part) setPartners(part);
            if(ausers) setAdminUsers(ausers);
            if(pm) setPurchasingManagement(pm.map(x => ({
                id: x.id,
                storeId: x.store_id,
                brand: x.brand,
                productType: x.product_type,
                stockQty: Number(x.stock_qty || 0),
                buyQty: Number(x.buy_qty || 0),
                sellQty: Number(x.sell_qty || 0),
                sellPrice: Number(x.sell_price || 0),
                lastBuyDate: x.last_buy_date,
                year: Number(x.year || 0),
                month: Number(x.month || 0),
                updatedAt: x.updated_at
            })));
        } catch (err) { console.error("Erro Sincronismo:", err); }
        finally { setIsLoading(false); }
    };

    useEffect(() => {
        const channel = supabase.channel('online-sync-global')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'financial_receipts' }, () => fetchData())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'financial_card_sales' }, () => fetchData())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'financial_pix_sales' }, () => fetchData())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'cash_errors' }, () => fetchData())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'ice_cream_daily_sales_payments' }, () => fetchData())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'ice_cream_sales' }, () => fetchData())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'ice_cream_daily_sales' }, () => fetchData())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'gestao_compras' }, () => fetchData())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'monthly_performance_actual' }, () => fetchData())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'monthly_goals' }, () => fetchData())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'stores' }, () => fetchData())
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, []);

    const handleLogin = async (email: string, pass: string, remember: boolean) => {
        try {
            const result = await apiService.login(email, pass);
            
            const rawRole = result.user.role_level.toUpperCase();
            const mappedRole = rawRole === 'SORVETE' ? 'ICE_CREAM' : rawRole;
            await fetchPermissions(mappedRole);

            const loggedUser: User = { 
                id: result.user.id, 
                name: result.user.name, 
                role: mappedRole as UserRole, 
                email: result.user.email, 
                storeId: result.user.store_id 
            };
            
            setUser(loggedUser);
            setCurrentView(loggedUser.role === UserRole.ADMIN ? 'dashboard_rede' : loggedUser.role === UserRole.ICE_CREAM ? 'pdv_sorveteria' : 'dashboard_loja');
            return { success: true, user: loggedUser };
        } catch (err: any) { 
            return { success: false, error: err.message || 'Falha na conexão.' }; 
        }
    };

    const handleLogout = async () => {
        await apiService.logout();
        setUser(null);
        setCurrentView('');
        window.location.reload();
    };

    useEffect(() => { 
        fetchData(); 
        const checkUsers = async () => {
            const { count } = await supabase.from('admin_users').select('*', { count: 'exact', head: true });
            setUserCount(count);
        };
        checkUsers();
    }, []);

    const handleCreateFirstAdmin = async () => {
        const email = prompt("Digite o e-mail do primeiro administrador:");
        const password = prompt("Digite a senha:");
        const name = prompt("Digite o nome:");
        
        if (!email || !password || !name) return;

        try {
            const { error } = await supabase.from('admin_users').insert([{
                name: name.toUpperCase(),
                email: email.toLowerCase().trim(),
                password: password.trim(),
                role_level: 'admin',
                status: 'active'
            }]);
            if (error) throw error;
            alert("Administrador criado com sucesso! Agora você pode fazer login.");
            setUserCount(1);
        } catch (err: any) {
            alert("Erro ao criar administrador: " + err.message);
        }
    };

    const handleSaveIceCreamProduct = async (product: Partial<IceCreamItem>) => {
        const payload = { 
            store_id: product.storeId, name: product.name, category: product.category, price: product.price, 
            flavor: product.flavor, active: product.active ?? true, consumption_per_sale: product.consumptionPerSale || 0, 
            recipe: JSON.stringify(product.recipe || []), image_url: product.image_url 
        };
        if (product.id) await supabase.from('ice_cream_items').update(payload).eq('id', product.id);
        else await supabase.from('ice_cream_items').insert([payload]);
        await fetchData();
    };

    const handleRegisterRequest = async (store: Partial<Store>) => {
        try {
            const { error } = await supabase.from('stores').insert([{
                number: store.number,
                name: store.name,
                city: store.city,
                manager_name: store.managerName,
                manager_email: store.managerEmail,
                manager_phone: store.managerPhone,
                status: 'pending'
            }]);
            if (error) throw error;
        } catch (err: any) {
            console.error("Register Error:", err);
            throw err;
        }
    };

    if (!user) return (
        <div className="relative">
            <LoginScreen onLoginAttempt={handleLogin} onRegisterRequest={handleRegisterRequest} />
            {userCount === 0 && (
                <div className="fixed bottom-4 right-4 z-[300] flex flex-col gap-2 items-end">
                    <button 
                        onClick={handleCreateFirstAdmin}
                        className="bg-red-600 text-white px-6 py-3 rounded-full font-black uppercase text-[10px] shadow-2xl hover:bg-black transition-all border-b-4 border-red-900"
                    >
                        Forçar Criação de Admin
                    </button>
                </div>
            )}
        </div>
    );
    
    return (
        <div className="flex h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 overflow-hidden font-sans relative transition-colors duration-300">
            {/* Overlay for mobile/tablet */}
            {isSidebarOpen && ( 
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[90]" onClick={() => setIsSidebarOpen(false)} /> 
            )}
            
            <aside className={`
                fixed inset-y-0 left-0 z-[100] w-72 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col p-6 transition-all duration-300 transform
                ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
            `}>
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-4">
                        <img src={BRAND_LOGO} alt="Logo" referrerPolicy="no-referrer" className="h-10 w-auto object-contain dark:brightness-125" />
                        <h1 className="text-xl font-black italic uppercase text-slate-900 dark:text-white">ADMIN</h1>
                    </div>
                    <button onClick={() => setIsSidebarOpen(false)} className="p-2 text-slate-400 hover:text-slate-900 dark:hover:text-white">
                        <X size={24} />
                    </button>
                </div>
                <nav className="flex-1 space-y-6 overflow-y-auto no-scrollbar">
                    {[
                        { title: 'Inteligência', items: [ { id: 'dashboard_rede', label: 'Dashboard Rede', icon: LayoutDashboard, perm: 'MODULE_DASHBOARD_ADMIN' }, { id: 'dashboard_loja', label: 'Dashboard Loja', icon: LayoutDashboard, perm: 'MODULE_DASHBOARD_MANAGER' }, { id: 'dashboard_pa', label: 'Dashboard P.A.', icon: Trophy, perm: 'MODULE_DASHBOARD_PA' }, { id: 'metas', label: 'Metas', icon: Target, perm: 'MODULE_METAS' }, { id: 'cotas', label: 'Cotas OTB', icon: Calculator, perm: 'MODULE_COTAS' }, { id: 'compras', label: 'Compras', icon: ShoppingBag, perm: 'MODULE_PURCHASES' }, { id: 'os_demandas', label: 'Demanda OS', icon: ClipboardList, perm: 'MODULE_DEMANDS' } ] },
                        { title: 'Operacional', items: [ { id: 'pdv_sorveteria', label: 'PDV Sorveteria Real', icon: IceCreamIcon, perm: 'MODULE_ICECREAM', requiredFeature: stores.find(s => s.id === user.storeId)?.has_gelateria || user.role === UserRole.ICE_CREAM }, { id: 'caixa', label: 'Caixa', icon: ClipboardList, perm: 'MODULE_CASH_REGISTER' }, { id: 'agenda', label: 'Agenda Semanal', icon: Calendar, perm: 'MODULE_AGENDA' } ] },
                        { title: 'Documentos', items: [ { id: 'autoriz_compra', label: 'Autoriz. Compra', icon: FileSignature, perm: 'MODULE_AUTORIZ_COMPRA' }, { id: 'termo_condicional', label: 'Termo Condicional', icon: FileText, perm: 'MODULE_TERMO_CONDICIONAL' }, { id: 'downloads', label: 'Downloads', icon: Download, perm: 'MODULE_DOWNLOADS' } ] },
                        { title: 'Administração', items: [ { id: 'users', label: 'Usuários', icon: Users, perm: 'MODULE_ADMIN_USERS' }, { id: 'access', label: 'Acessos', icon: ShieldAlert, perm: 'MODULE_ACCESS_CONTROL' }, { id: 'audit', label: 'Auditoria', icon: Shield, perm: 'MODULE_AUDIT' }, { id: 'settings', label: 'Configurações', icon: Settings, perm: 'MODULE_SETTINGS' } ] }
                    ].map(section => {
                        const visibleItems = section.items.filter(i => can(i.perm) && (i.requiredFeature === undefined || i.requiredFeature === true));
                        if (visibleItems.length === 0) return null;
                        return (
                            <div key={section.title} className="space-y-1">
                                <h3 className="px-4 text-[10px] font-black uppercase text-slate-400 dark:text-slate-400 tracking-widest mb-2">{section.title}</h3>
                                {visibleItems.map(item => (
                                    <button 
                                        key={item.id} 
                                        onClick={() => { setCurrentView(item.id); setIsSidebarOpen(false); }} 
                                        className={`w-full text-left py-2.5 px-4 rounded-xl font-black uppercase text-[10px] flex items-center gap-4 transition-all ${
                                            currentView === item.id 
                                                ? 'bg-blue-600 text-white shadow-lg shadow-blue-200 dark:shadow-blue-900/20' 
                                                : 'text-slate-500 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800'
                                        }`}
                                    >
                                        <item.icon size={20} /> {item.label}
                                    </button>
                                ))}
                            </div>
                        );
                    })}
                </nav>
                <div className="mt-8 space-y-2">
                    <button 
                        onClick={() => setIsChangePasswordOpen(true)}
                        className="w-full flex items-center gap-4 p-4 text-slate-500 dark:text-slate-300 font-black uppercase text-[10px] hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white rounded-xl transition-all border border-slate-100 dark:border-slate-800"
                    >
                        <Lock size={18} /> Alterar Senha
                    </button>
                    <button 
                        onClick={handleLogout} 
                        className="w-full flex items-center gap-4 p-4 text-red-500 font-black uppercase text-[10px] hover:bg-red-50/50 dark:hover:bg-red-900/20 rounded-xl transition-all border border-red-100 dark:border-red-900/30"
                    >
                        <LogOut size={18} /> Sair
                    </button>
                </div>
            </aside>
            <div className="flex-1 flex flex-col h-full bg-slate-50 dark:bg-slate-950 overflow-hidden text-slate-900 dark:text-slate-100 transition-colors duration-300">
                <header className="h-16 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 items-center justify-between px-4 md:px-6 flex shrink-0 z-50 transition-colors duration-300">
                    <div className="flex items-center gap-2 md:gap-4">
                        <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 text-slate-400 hover:text-slate-900 dark:hover:text-white">
                            <Menu size={24} />
                        </button>
                        <span className="text-[10px] md:text-xs font-black uppercase text-slate-400 dark:text-slate-400 flex items-center gap-2 md:gap-3">
                            <UserCog size={18} className="hidden xs:block"/> Sessão: <span className="text-slate-900 dark:text-white italic truncate max-w-[100px] md:max-w-none">{user?.name}</span>
                            <button 
                                onClick={() => setIsChangePasswordOpen(true)}
                                className="p-1.5 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-300 rounded-lg hover:bg-blue-600 hover:text-white transition-all shadow-sm border border-slate-200 dark:border-slate-700"
                                title="Alterar Senha"
                            >
                                <Lock size={14} />
                            </button>
                        </span>
                    </div>
                    <div className="flex items-center gap-2 md:gap-4">
                        <button 
                            onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
                            className="p-2.5 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-300 rounded-xl hover:bg-blue-600 hover:text-white transition-all shadow-sm border border-slate-200 dark:border-slate-700 flex items-center gap-2"
                            title={theme === 'light' ? 'Modo Escuro' : 'Modo Claro'}
                        >
                            {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
                            <span className="hidden sm:inline text-[10px] font-black uppercase">{theme === 'light' ? 'Escuro' : 'Claro'}</span>
                        </button>
                        <NotificationHeader user={user!} stores={stores} agenda={agenda} onNavigate={setCurrentView} />
                    </div>
                </header>
                <main className="flex-1 overflow-y-auto no-scrollbar p-3 md:p-6 lg:p-8">
                    {(() => {
                        if (currentView === 'dashboard_rede' && can('MODULE_DASHBOARD_ADMIN')) return <DashboardAdmin stores={stores} performanceData={performanceData} goalsData={goalsData} sangrias={icSangrias} onImportPerformance={async (d) => { 
                            const upsertData = d.map(row => {
                                const [y, m] = row.month.split('-');
                                return { 
                                    store_id: row.storeId, 
                                    month: row.month, 
                                    year: parseInt(y),
                                    month_num: parseInt(m),
                                    revenue_actual: row.revenueActual, 
                                    items_actual: row.itemsActual, 
                                    sales_actual: row.salesActual, 
                                    items_per_ticket: row.paActual,
                                    unit_price_average: row.puActual,
                                    average_ticket: row.averageTicket,
                                    pa_actual: row.paActual,
                                    pu_actual: row.puActual,
                                    ticket_actual: row.averageTicket,
                                    delinquency_rate: row.delinquencyRate, 
                                    delinquency_actual: row.delinquencyRate,
                                    business_days: row.businessDays,
                                    percent_meta: row.percentMeta,
                                    trend: row.trend,
                                    last_import_by: user?.name
                                };
                            });
                            const { error } = await supabase.from('monthly_performance_actual').upsert(upsertData, { onConflict: 'store_id, month' });
                            if (error) {
                                console.error("Erro ao salvar monthly_performance_actual:", error);
                                alert("Erro ao salvar dados no banco: " + error.message);
                            } else {
                                fetchData(); 
                            }
                        }} onRefresh={fetchData} />;
                        if (currentView === 'dashboard_loja' && can('MODULE_DASHBOARD_MANAGER')) return <DashboardManager user={user!} stores={stores} performanceData={performanceData} goalsData={goalsData} purchasingData={purchasingData} sangrias={icSangrias} stockMovements={icStockMovements} stock={iceCreamStock} />;
                        if (currentView === 'metas' && can('MODULE_METAS')) return <GoalRegistration stores={stores} goalsData={goalsData} onSaveGoals={async (data) => { for(const row of data) { await supabase.from('monthly_goals').upsert({ store_id: row.storeId, year: row.year, month: row.month, revenue_target: row.revenueTarget, pa_target: row.paTarget, pu_target: row.puTarget, ticket_target: row.ticketTarget, items_target: row.itemsTarget, business_days: row.businessDays, delinquency_target: row.delinquencyTarget, trend: row.trend }, { onConflict: 'store_id, year, month' }); } fetchData(); }} />;
                        if (currentView === 'cotas' && can('MODULE_COTAS')) return <CotasManagement user={user!} stores={stores} cotas={cotas} cotaSettings={cotaSettings} cotaDebts={cotaDebts} performanceData={performanceData} productCategories={quotaCategories} mixParameters={quotaMixParams} onAddCota={async (c) => { await supabase.from('cotas').insert([{ store_id: c.storeId, brand: c.brand, category_id: c.category_id, total_value: c.totalValue, shipment_date: `${c.shipmentDate}-01`, payment_terms: c.paymentTerms, pairs: c.pairs, installments: c.installments, status: 'ABERTA' }]); fetchData(); }} onUpdateCota={async (id, u) => { await supabase.from('cotas').update(u).eq('id', id); fetchData(); }} onDeleteCota={async (id) => { await supabase.from('cotas').delete().eq('id', id); fetchData(); }} onSaveSettings={async (s) => { await supabase.from('cota_settings').upsert({ store_id: s.storeId, budget_value: s.budgetValue, manager_percent: s.managerPercent }, { onConflict: 'store_id' }); fetchData(); }} onSaveDebts={async (d) => { await supabase.from('cota_debts').upsert({ store_id: d.storeId, month: d.month, value: d.value }, { onConflict: 'store_id, month' }); fetchData(); }} onDeleteDebt={async (id) => { await supabase.from('cota_debts').delete().eq('id', id); fetchData(); }} onUpdateMixParameter={async (id, sId, cat, pct, sem) => { if (id) { await supabase.from('quota_mix_parameters').update({ mix_percentage: pct }).eq('id', id); } else { await supabase.from('quota_mix_parameters').insert([{ store_id: sId, parent_category: cat, mix_percentage: pct, semester: sem }]); } fetchData(); }} />;
                        if (currentView === 'compras' && can('MODULE_PURCHASES')) return <DashboardPurchases 
                            user={user!} 
                            stores={stores} 
                            data={purchasingData} 
                            managementData={purchasingManagement}
                            adminUsers={adminUsers} 
                            onImport={async (d) => { await supabase.from('product_performance').insert(d.map(x => ({ store_id: x.storeId, month: x.month, brand: x.brand, category: x.category, pairs_sold: x.pairsSold, revenue: x.revenue }))); fetchData(); }} 
                            onImportManagement={async (d, shouldFetch = true) => {
                                const { error } = await supabase.from('gestao_compras').upsert(d.map(x => ({
                                    store_id: x.storeId,
                                    brand: x.brand,
                                    product_type: x.productType,
                                    stock_qty: x.stockQty,
                                    buy_qty: x.buyQty,
                                    sell_qty: x.sellQty,
                                    sell_price: x.sellPrice,
                                    last_buy_date: x.lastBuyDate,
                                    year: x.year,
                                    month: x.month
                                })), { onConflict: 'store_id, brand, product_type, year, month' });
                                if (error) {
                                    console.error("Erro Supabase (gestao_compras):", error);
                                    throw error;
                                }
                                if (shouldFetch) fetchData();
                            }}
                            onOpenSpreadsheetModule={() => setCurrentView('spreadsheet_order')} 
                        />;
                        if (currentView === 'pdv_sorveteria' && can('MODULE_ICECREAM')) return <IceCreamModule 
                            user={user!} stores={stores} items={iceCreamItems} sales={iceCreamSales} salesHeaders={sales} salePayments={salePayments}
                            stock={iceCreamStock} promissories={icPromissories} can={can}
                            sangriaCategories={icSangriaCategories}
                            sangrias={icSangrias}
                            stockMovements={icStockMovements}
                            partners={partners}
                            adminUsers={adminUsers}
                            futureDebts={futureDebts}
                            onAddSangria={async (s) => { const { error } = await supabase.from('ice_cream_sangria').insert([s]); if (error) throw error; await fetchData(); }}
                            onAddSangriaCategory={async (c) => { const { error } = await supabase.from('ice_cream_sangria_categoria').insert([c]); if (error) throw error; await fetchData(); }}
                            onDeleteSangriaCategory={async (id) => { const { error } = await supabase.from('ice_cream_sangria_categoria').delete().eq('id', id); if (error) throw error; await fetchData(); }}
                            onAddStockMovement={async (m) => { const { error } = await supabase.from('ice_cream_stock_movements').insert([m]); if (error) throw error; await fetchData(); }}
                            onAddFutureDebt={async (debtData) => {
                                await supabase.rpc('create_installment_debt', {
                                    p_store_id: debtData.store_id,
                                    p_supplier_name: debtData.supplier_name,
                                    p_total_amount: debtData.total_amount,
                                    p_total_installments: debtData.total_installments,
                                    p_first_due_date: debtData.due_date,
                                    p_category_id: debtData.category_id,
                                    p_description: debtData.description,
                                    p_created_by: user?.id
                                });
                                await fetchData();
                            }}
                            onPayFutureDebt={async (debtId, paymentDate) => {
                                await supabase.rpc('pay_installment_debt', {
                                    p_debt_id: debtId,
                                    p_payment_date: paymentDate
                                });
                                await fetchData();
                            }}
                            fetchData={fetchData}
                            onAddSales={async (s) => { 
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
                                    sale_code: x.saleCode, 
                                    buyer_name: x.buyer_name, 
                                    status: 'completed' 
                                }))); 
                                fetchData(); 
                            }} 
                            onAddSaleAtomic={async (saleData, items, payments) => {
                                const totalPayments = payments.reduce((acc, p) => acc + p.amount, 0);
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
                                    const { error: itemsError } = await supabase.from('ice_cream_daily_sales').insert(items.map(x => ({ 
                                        sale_id: saleId,
                                        store_id: saleData.store_id, 
                                        item_id: x.itemId, 
                                        product_name: x.productName, 
                                        category: x.category, 
                                        flavor: x.flavor, 
                                        units_sold: Math.round(x.unitsSold), 
                                        unit_price: x.unitPrice, 
                                        total_value: x.totalValue, 
                                        payment_method: payments.length > 1 ? 'Misto' : payments[0].method, 
                                        sale_code: saleData.sale_code, 
                                        buyer_name: buyerName, 
                                        status: 'completed' 
                                    })));

                                    if (itemsError) {
                                        await supabase.from('ice_cream_sales').delete().eq('id', saleId);
                                        throw itemsError;
                                    }

                                    const { error: paymentsError } = await supabase.from('ice_cream_daily_sales_payments').insert(payments.map(p => ({
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
                                fetchData(); 
                            }}
                            onCancelSale={async (idOrCode, reason) => { 
                                // Tenta identificar se recebemos um ID (UUID) ou um Código (String)
                                const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrCode);
                                
                                let saleCode = idOrCode;
                                let saleId = isUUID ? idOrCode : null;

                                if (isUUID) {
                                    // Se for UUID, buscamos o sale_code para limpar as outras tabelas
                                    const { data: sale } = await supabase.from('ice_cream_sales').select('sale_code').eq('id', idOrCode).maybeSingle();
                                    if (sale) saleCode = sale.sale_code;
                                } else {
                                    // Se for Código, buscamos o ID para garantir a limpeza por ID onde possível
                                    const { data: sale } = await supabase.from('ice_cream_sales').select('id').eq('sale_code', idOrCode).maybeSingle();
                                    if (sale) saleId = sale.id;
                                }

                                // Atualiza as tabelas principais
                                if (saleId) {
                                    await supabase.from('ice_cream_sales').update({ status: 'canceled', cancel_reason: reason, canceled_by_name: user?.name }).eq('id', saleId); 
                                    await supabase.from('ice_cream_daily_sales').update({ status: 'canceled', cancel_reason: reason, canceled_by: user?.name }).eq('sale_id', saleId);
                                } else {
                                    await supabase.from('ice_cream_sales').update({ status: 'canceled', cancel_reason: reason, canceled_by_name: user?.name }).eq('sale_code', saleCode); 
                                    await supabase.from('ice_cream_daily_sales').update({ status: 'canceled', cancel_reason: reason, canceled_by: user?.name }).eq('sale_code', saleCode);
                                }
                                
                                // Limpeza financeira (essencial para integridade do DRE)
                                await Promise.all([
                                    supabase.from('financial_card_sales').delete().eq('sale_code', saleCode),
                                    supabase.from('financial_pix_sales').delete().eq('sale_code', saleCode),
                                    supabase.from('ice_cream_daily_sales_payments').delete().eq('sale_code', saleCode)
                                ]);
                                
                                await fetchData(); 
                            }} 
                            onUpdatePrice={async (id, p) => { await supabase.from('ice_cream_items').update({ price: p }).eq('id', id); await fetchData(); }} 
                            onAddItem={async (n, c, p, f, si, u, cps, tsId, r) => { await handleSaveIceCreamProduct({ storeId: tsId, name: n, category: c as any, price: p, flavor: f, recipe: r }); }} 
                            onSaveProduct={handleSaveIceCreamProduct} 
                            onDeleteItem={async (id) => { await supabase.from('ice_cream_items').delete().eq('id', id); await fetchData(); }} 
                            onUpdateStock={async (sId, b, v, u, type) => { 
                                const { data: current } = await supabase.from('ice_cream_stock').select('stock_current').eq('store_id', sId).eq('product_base', b).maybeSingle(); 
                                let finalVal = v; 
                                if (current && (type === 'purchase' || type === 'adjustment' || type === 'production')) { finalVal = Number(current.stock_current || 0) + v; } 
                                await supabase.from('ice_cream_stock').upsert({ store_id: sId, product_base: b, stock_current: finalVal, unit: u, is_active: true }, { onConflict: 'store_id, product_base' }); 
                                await fetchData(); 
                            }} 
                            liquidatePromissory={async (id) => { await supabase.from('ice_cream_promissory_notes').update({ status: 'paid' }).eq('id', id); await fetchData(); }} 
                            onDeleteStockItem={async (id) => { if (user?.role === UserRole.ADMIN) { await supabase.from('ice_cream_stock').update({ is_active: false }).eq('id', id); await fetchData(); } }} 
                        />;
                        if (currentView === 'caixa' && can('MODULE_CASH_REGISTER')) return (
                            <CashRegisterModule 
                                user={user!} 
                                stores={stores} 
                                sales={iceCreamSales} 
                                pixSales={pixSales} 
                                closures={closures} 
                                receipts={receipts} 
                                errors={cashErrors} 
                                onAddClosure={async (c) => { 
                                    await supabase.from('cash_register_closures').insert([{ 
                                        store_id: c.storeId || user?.storeId, 
                                        closed_by: user?.name, 
                                        total_sales: c.totalSales, 
                                        total_expenses: c.totalExpenses, 
                                        balance: c.balance, 
                                        notes: c.notes, 
                                        date: c.date 
                                    }]); 
                                    addLog('FECHAMENTO CAIXA', `Fechamento da loja ${c.storeId} no valor de ${c.balance}`); 
                                    fetchData(); 
                                }} 
                                onAddReceipt={async (r) => { 
                                    const saved = await apiService.createReceipt({
                                        payer: r.payer,
                                        recipient: r.recipient,
                                        value: r.value,
                                        value_in_words: r.valueInWords,
                                        reference: r.reference,
                                        receipt_date: r.date
                                    });
                                    addLog('EMISSÃO RECIBO', `Recibo #${saved.receipt_number} para ${saved.recipient} no valor de ${saved.value}`); 
                                    fetchData(); 
                                    return saved;
                                }} 
                                onAddError={async (e) => { 
                                    if (e && Object.keys(e).length > 0) {
                                        await supabase.from('cash_errors').insert([e]); 
                                        addLog('REGISTRO QUEBRA', `${e.type === 'shortage' ? 'Falta' : 'Sobra'} de ${e.value} na loja ${e.store_id}`); 
                                    }
                                    fetchData(); 
                                }} 
                                onDeleteError={async (id) => { 
                                    await supabase.from('cash_errors').delete().eq('id', id); 
                                    addLog('EXCLUSÃO QUEBRA', `Remoção do registro de quebra ID: ${id}`); 
                                    fetchData(); 
                                }} 
                                onAddLog={addLog} 
                            />
                        );
                        if (currentView === 'agenda' && can('MODULE_AGENDA')) return <AgendaSystem user={user!} tasks={agenda} onAddTask={async (t) => { await supabase.from('agenda_tasks').insert([{ user_id: user?.id, title: t.title, description: t.description, due_date: t.dueDate, due_time: t.dueTime, priority: t.priority, is_completed: false }]); fetchData(); }} onUpdateTask={async (t) => { await supabase.from('agenda_tasks').update({ is_completed: t.isCompleted }).eq('id', t.id); fetchData(); }} onDeleteTask={async (id) => { await supabase.from('agenda_tasks').delete().eq('id', id); fetchData(); }} />;
                        if (currentView === 'autoriz_compra' && can('MODULE_AUTORIZ_COMPRA')) return <PurchaseAuthorization />;
                        if (currentView === 'termo_condicional' && can('MODULE_TERMO_CONDICIONAL')) return <TermoAutorizacao user={user!} store={stores.find(s => s.id === user?.storeId)} />;
                        if (currentView === 'downloads' && can('MODULE_DOWNLOADS')) return <DownloadsModule user={user!} items={downloads} onUpload={async (i) => { await supabase.from('downloads').insert([i]); fetchData(); }} onDelete={async (id) => { await supabase.from('downloads').delete().eq('id', id); fetchData(); }} />;
                        if (currentView === 'users' && can('MODULE_ADMIN_USERS')) return <AdminUsersManagement currentUser={user} stores={stores} />;
                        if (currentView === 'access' && can('MODULE_ACCESS_CONTROL')) return <AccessControlManagement />;
                        if (currentView === 'audit' && can('MODULE_AUDIT')) return <SystemAudit currentUser={user!} logs={logs} receipts={receipts} cashErrors={cashErrors} iceCreamSales={iceCreamSales} icPromissories={icPromissories} cardSales={cardSales} pixSales={pixSales} closures={closures} stores={stores} />;
                        if (currentView === 'settings' && can('MODULE_SETTINGS')) return <AdminSettings stores={stores} onAddStore={async (s) => { await supabase.from('stores').insert([s]); fetchData(); }} onUpdateStore={async (s) => { await supabase.from('stores').update(s).eq('id', s.id); fetchData(); }} onDeleteStore={async (id) => { await supabase.from('stores').delete().eq('id', id); fetchData(); }} />;
                        if (currentView === 'spreadsheet_order' && can('MODULE_PURCHASES')) return <SpreadsheetOrderModule user={user!} onClose={() => setCurrentView('compras')} />;
                        if (currentView === 'os_demandas' && can('MODULE_DEMANDS')) return <OSDemandsModule user={user!} stores={stores} />;
                        if (currentView === 'dashboard_pa' && can('MODULE_DASHBOARD_PA')) return <DashboardPAModule 
                            user={user!} 
                            stores={stores} 
                            onRefresh={fetchData}
                        />;
                        return <div className="flex items-center justify-center h-full text-gray-400 uppercase tracking-widest font-black text-sm">Selecione um módulo no menu</div>;
                    })()}
                </main>
            </div>
            {isChangePasswordOpen && (
                <ChangePasswordModal user={user!} onClose={() => setIsChangePasswordOpen(false)} />
            )}
        </div>
    );
};

export default App;
