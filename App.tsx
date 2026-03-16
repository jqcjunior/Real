import React, { useState, useEffect } from 'react';
import { 
    User, Store, MonthlyPerformance, UserRole, Cota, CotaSettings, CotaDebts, QuotaCategory, QuotaMixParameter,
    IceCreamItem, IceCreamDailySale, CashRegisterClosure, ProductPerformance, Receipt, IceCreamStock, IceCreamPromissoryNote, AgendaItem, DownloadItem, CashError, SystemLog, MonthlyGoal, CreditCardSale,
    Sale, SalePayment, IceCreamSangria, IceCreamSangriaCategory,
    IceCreamStockMovement, StoreProfitPartner, AdminUser
} from './types';
import { supabase } from './services/supabaseClient';
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
import LoginScreen from './components/LoginScreen';

// Ícones
import { 
    LayoutDashboard, Target, ShoppingBag, Calculator, IceCream as IceCreamIcon, 
    DollarSign, AlertCircle, Calendar, LogOut, Loader2, Menu, X, ClipboardList, Shield, UserCog, Users, ShieldAlert, Settings, FileSignature, FileText, Download
} from 'lucide-react';

const App: React.FC = () => {
    const [user, setUser] = useState<User | null>(null);
    const [currentView, setCurrentView] = useState<string>(''); 
    const [isLoading, setIsLoading] = useState(true);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    useEffect(() => {
        if (window.innerWidth >= 1024) {
            setIsSidebarOpen(true);
        }
    }, []);

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
            const [
                {data: s}, {data: p}, {data: pur}, {data: c}, {data: cs}, {data: cd}, {data: cat}, {data: mix},
                {data: ici}, {data: ics}, {data: icst}, {data: icp}, {data: r}, {data: ce}, {data: ag}, {data: dl}, {data: cl}, {data: lg},
                {data: g}, {data: cds}, {data: sls}, {data: slsp},
                {data: sangCat}, {data: sang}, {data: movements}, {data: part}, {data: ausers}
            ] = await Promise.all([
                supabase.from('stores').select('*'),
                supabase.from('monthly_performance').select('*'), 
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
                supabase.from('monthly_goals').select('*'),
                fetchAllRows('financial_card_sales', 'created_at'),
                fetchAllRows('ice_cream_sales', 'created_at'),
                fetchAllRows('ice_cream_daily_sales_payments', 'created_at'),
                supabase.from('ice_cream_sangria_categoria').select('*'),
                fetchAllRows('ice_cream_sangria', 'created_at'),
                fetchAllRows('ice_cream_stock_movements', 'created_at'),
                supabase.from('store_profit_distribution').select('*'),
                supabase.from('admin_users').select('*')
            ]);

            if(s) setStores(s);
            if(sls) setSales(sls);
            if(slsp) setSalePayments(slsp.map(x => ({ ...x, amount: Number(x.amount || 0) })));
            if(p) setPerformanceData(p.map(x => ({ 
                ...x, 
                storeId: x.store_id, 
                revenueActual: Number(x.revenue_actual || 0), 
                revenueTarget: Number(x.revenue_target || 0), 
                itemsActual: Number(x.items_actual || 0), 
                itemsTarget: Number(x.items_target || 0), 
                salesActual: Number(x.sales_actual || 0), 
                paActual: Number(x.pa_actual || 0), 
                puActual: Number(x.pu_actual || 0), 
                averageTicket: Number(x.ticket_actual || x.average_ticket || 0), 
                percentMeta: Number(x.percent_meta || 0), 
                paTarget: Number(x.pa_target || 0), 
                puTarget: Number(x.pu_target || 0), 
                ticketTarget: Number(x.ticket_target || 0), 
                businessDays: Number(x.business_days || 26) 
            })));
            if(g) setGoalsData(g.map(x => ({ id: x.id, storeId: x.store_id, year: Number(x.year), month: Number(x.month), revenueTarget: Number(x.revenue_target || 0), itemsTarget: Number(x.items_target || 0), paTarget: Number(x.pa_target || 0), puTarget: Number(x.pu_target || 0), ticketTarget: Number(x.ticket_target || 0), delinquencyTarget: Number(x.delinquency_target || 2.0), businessDays: Number(x.business_days || 26), trend: x.trend || 'stable' })));
            if(pur) setPurchasingData(pur.map(x => ({...x, storeId: x.store_id, pairsSold: x.pairs_sold})));
            if(c) setCotas(c.map(x => ({ ...x, id: x.id, storeId: x.store_id, totalValue: Number(x.total_value || 0), shipmentDate: x.shipment_date, paymentTerms: x.payment_terms, createdByRole: x.created_by_role, category_id: x.category_id, category_name: x.category_name || x.classification, createdAt: new Date(x.created_at) })));
            if(cs) setCotaSettings(cs.map(x => ({...x, storeId: x.store_id, budgetValue: x.budget_value, managerPercent: x.manager_percent})));
            if(cd) setCotaDebts(cd.map(x => ({...x, storeId: x.store_id})));
            if(cat) setQuotaCategories(cat);
            if(mix) setQuotaMixParams(mix.map(x => ({ ...x, storeId: x.store_id, category_name: x.parent_category, percentage: Number(x.mix_percentage || 0) })));
            if(ici) setIceCreamItems(ici.map(x => ({ id: x.id, storeId: x.store_id, name: x.name, category: x.category, price: Number(x.price || 0), flavor: x.flavor, active: x.active, consumption_per_sale: x.consumption_per_sale || 0, recipe: typeof x.recipe === 'string' ? JSON.parse(x.recipe) : (x.recipe || []), image_url: x.image_url })));
            if(ics) setIceCreamSales(ics.map(x => ({ id: x.id, storeId: x.store_id, itemId: x.item_id, productName: x.product_name, category: x.category, flavor: x.flavor, unitsSold: Number(x.units_sold || 0), unitPrice: Number(x.unit_price || 0), totalValue: Number(x.total_value || 0), paymentMethod: x.payment_method, saleCode: x.sale_code, buyer_name: x.buyer_name, createdAt: x.created_at, status: x.status })));
            if(cds) setCardSales(cds.map(x => ({ id: x.id, storeId: x.store_id, userId: x.user_id, userName: x.user_name, date: x.date, brand: x.brand, value: Number(x.value || 0), authorizationCode: x.authorization_code, saleCode: x.sale_code, createdAt: x.created_at })));
            if(icst) setIceCreamStock(icst.map(item => ({ ...item, stock_id: item.id })));
            if(icp) setIcPromissories(icp);
            if(r) setReceipts(r.map(x => ({ id: x.id, storeId: x.store_id, issuerName: x.issuer_name, payer: x.payer, recipient: x.recipient, value: Number(x.value || 0), valueInWords: x.value_in_words, date: x.receipt_date, reference: x.reference, createdAt: new Date(x.created_at) })));
            if(ce) setCashErrors(ce.map(x => ({...x, id: x.id, storeId: x.store_id, userId: x.user_id, userName: x.user_name || 'Usuário', date: x.error_date || x.date, value: Number(x.value || 0), type: x.type, reason: x.reason, createdAt: new Date(x.created_at)})));
            if(ag) setAgenda(ag.map(x => ({...x, userId: x.user_id, title: x.title, description: x.description, dueDate: x.due_date ? x.due_date.split('T')[0] : '', dueTime: x.due_time, priority: x.priority, isCompleted: x.is_completed})));
            if(dl) setDownloads(dl.map(x => ({...x, fileName: x.file_name, createdBy: x.created_by})));
            if(cl) setClosures(cl.map(x => ({...x, storeId: x.store_id, closedBy: x.closed_by})));
            if(lg) setLogs(lg);
            if(sangCat) setIcSangriaCategories(sangCat);
            if(sang) setIcSangrias(sang);
            if(movements) setIcStockMovements(movements);
            if(part) setPartners(part);
            if(ausers) setAdminUsers(ausers);
        } catch (err) { console.error("Erro Sincronismo:", err); }
        finally { setIsLoading(false); }
    };

    useEffect(() => {
        const channel = supabase.channel('online-sync-global')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'financial_receipts' }, () => fetchData())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'financial_card_sales' }, () => fetchData())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'cash_errors' }, () => fetchData())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'ice_cream_daily_sales_payments' }, () => fetchData())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'ice_cream_sales' }, () => fetchData())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'ice_cream_daily_sales' }, () => fetchData())
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, []);

    const handleLogin = async (email: string, pass: string, remember: boolean) => {
        try {
            const normalizedEmail = email.trim().toLowerCase();
            const { data: userCheck, error: checkError } = await supabase
                .from('admin_users')
                .select('id, status, password')
                .eq('email', normalizedEmail)
                .maybeSingle();

            if (checkError || !userCheck) return { success: false, error: 'Usuário não encontrado.' };
            if (userCheck.status !== 'active') return { success: false, error: 'Acesso inativo.' };
            if (userCheck.password !== pass) return { success: false, error: 'Senha incorreta.' };

            const { data, error } = await supabase.from('admin_users').select('*').eq('id', userCheck.id).single();
            if (error || !data) return { success: false, error: 'Erro ao recuperar perfil.' };
            
            const rawRole = data.role_level.toUpperCase();
            const mappedRole = rawRole === 'SORVETE' ? 'ICE_CREAM' : rawRole;
            await fetchPermissions(mappedRole);

            const loggedUser: User = { id: data.id, name: data.name, role: mappedRole as UserRole, email: data.email, storeId: data.store_id };
            setUser(loggedUser);
            setCurrentView(loggedUser.role === UserRole.ADMIN ? 'dashboard_rede' : loggedUser.role === UserRole.ICE_CREAM ? 'pdv_gelateria' : 'dashboard_loja');
            return { success: true, user: loggedUser };
        } catch (err: any) { 
            return { success: false, error: 'Falha na conexão.' }; 
        }
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
        <div className="flex h-screen bg-gray-950 text-white overflow-hidden font-sans relative">
            {/* Overlay for mobile/tablet */}
            {isSidebarOpen && ( 
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[90] lg:hidden" onClick={() => setIsSidebarOpen(false)} /> 
            )}
            
            <aside className={`
                fixed inset-y-0 left-0 z-[100] w-72 bg-gray-950 border-r border-white/5 flex flex-col p-6 transition-all duration-300 transform
                ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
                lg:relative lg:translate-x-0 ${!isSidebarOpen ? 'lg:hidden' : 'lg:flex'}
            `}>
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-4">
                        <img src={BRAND_LOGO} alt="Logo" className="h-10 w-auto object-contain" />
                        <h1 className="text-xl font-black italic uppercase">ADMIN</h1>
                    </div>
                    <button onClick={() => setIsSidebarOpen(false)} className="p-2 text-gray-500 hover:text-white lg:hidden">
                        <X size={24} />
                    </button>
                </div>
                <nav className="flex-1 space-y-6 overflow-y-auto no-scrollbar">
                    {[
                        { title: 'Inteligência', items: [ { id: 'dashboard_rede', label: 'Dashboard Rede', icon: LayoutDashboard, perm: 'MODULE_DASHBOARD_ADMIN' }, { id: 'dashboard_loja', label: 'Dashboard Loja', icon: LayoutDashboard, perm: 'MODULE_DASHBOARD_MANAGER' }, { id: 'metas', label: 'Metas', icon: Target, perm: 'MODULE_METAS' }, { id: 'cotas', label: 'Cotas OTB', icon: Calculator, perm: 'MODULE_COTAS' }, { id: 'compras', label: 'Compras', icon: ShoppingBag, perm: 'MODULE_PURCHASES' } ] },
                        { title: 'Operacional', items: [ { id: 'pdv_gelateria', label: 'PDV Gelateria', icon: IceCreamIcon, perm: 'MODULE_ICECREAM', requiredFeature: stores.find(s => s.id === user.storeId)?.has_gelateria || user.role === UserRole.ICE_CREAM }, { id: 'caixa', label: 'Caixa', icon: ClipboardList, perm: 'MODULE_CASH_REGISTER' }, { id: 'agenda', label: 'Agenda Semanal', icon: Calendar, perm: 'MODULE_AGENDA' } ] },
                        { title: 'Documentos', items: [ { id: 'autoriz_compra', label: 'Autoriz. Compra', icon: FileSignature, perm: 'MODULE_AUTORIZ_COMPRA' }, { id: 'termo_condicional', label: 'Termo Condicional', icon: FileText, perm: 'MODULE_TERMO_CONDICIONAL' }, { id: 'downloads', label: 'Downloads', icon: Download, perm: 'MODULE_DOWNLOADS' } ] },
                        { title: 'Administração', items: [ { id: 'users', label: 'Usuários', icon: Users, perm: 'MODULE_ADMIN_USERS' }, { id: 'access', label: 'Acessos', icon: ShieldAlert, perm: 'MODULE_ACCESS_CONTROL' }, { id: 'audit', label: 'Auditoria', icon: Shield, perm: 'MODULE_AUDIT' }, { id: 'settings', label: 'Configurações', icon: Settings, perm: 'MODULE_SETTINGS' } ] }
                    ].map(section => {
                        const visibleItems = section.items.filter(i => can(i.perm) && (i.requiredFeature === undefined || i.requiredFeature === true));
                        if (visibleItems.length === 0) return null;
                        return (
                            <div key={section.title} className="space-y-1">
                                <h3 className="px-4 text-[10px] font-black uppercase text-gray-600 tracking-widest mb-2">{section.title}</h3>
                                {visibleItems.map(item => (
                                    <button key={item.id} onClick={() => { setCurrentView(item.id); setIsSidebarOpen(false); }} className={`w-full text-left py-2.5 px-4 rounded-xl font-black uppercase text-[10px] flex items-center gap-4 transition-all ${currentView === item.id ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-500 hover:text-white hover:bg-white/5'}`}><item.icon size={20} /> {item.label}</button>
                                ))}
                            </div>
                        );
                    })}
                </nav>
                <button onClick={() => window.location.reload()} className="mt-8 flex items-center gap-4 p-4 text-red-500 font-black uppercase text-[10px] hover:bg-red-500/10 rounded-xl transition-all border border-red-500/20"><LogOut size={18} /> Sair</button>
            </aside>
            <div className="flex-1 flex flex-col h-full bg-[#f3f4f6] overflow-hidden text-blue-950">
                <header className="h-16 border-b border-gray-100 bg-white items-center justify-between px-4 md:px-6 flex shrink-0 z-50">
                    <div className="flex items-center gap-2 md:gap-4">
                        <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 text-blue-900">
                            <Menu size={24} />
                        </button>
                        <span className="text-[10px] md:text-xs font-black uppercase text-gray-400 flex items-center gap-2 md:gap-3">
                            <UserCog size={18} className="hidden xs:block"/> Sessão: <span className="text-blue-950 italic truncate max-w-[100px] md:max-w-none">{user?.name}</span>
                        </span>
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
                        if (currentView === 'dashboard_loja' && can('MODULE_DASHBOARD_MANAGER')) return <DashboardManager user={user!} stores={stores} performanceData={performanceData} purchasingData={purchasingData} sangrias={icSangrias} stockMovements={icStockMovements} stock={iceCreamStock} />;
                        if (currentView === 'metas' && can('MODULE_METAS')) return <GoalRegistration stores={stores} goalsData={goalsData} onSaveGoals={async (data) => { for(const row of data) { await supabase.from('monthly_goals').upsert({ store_id: row.storeId, year: row.year, month: row.month, revenue_target: row.revenueTarget, pa_target: row.paTarget, pu_target: row.puTarget, ticket_target: row.ticketTarget, items_target: row.itemsTarget, business_days: row.businessDays, delinquency_target: row.delinquencyTarget, trend: row.trend }, { onConflict: 'store_id, year, month' }); } fetchData(); }} />;
                        if (currentView === 'cotas' && can('MODULE_COTAS')) return <CotasManagement user={user!} stores={stores} cotas={cotas} cotaSettings={cotaSettings} cotaDebts={cotaDebts} performanceData={performanceData} productCategories={quotaCategories} mixParameters={quotaMixParams} onAddCota={async (c) => { await supabase.from('cotas').insert([{ store_id: c.storeId, brand: c.brand, category_id: c.category_id, total_value: c.totalValue, shipment_date: `${c.shipmentDate}-01`, payment_terms: c.paymentTerms, pairs: c.pairs, installments: c.installments, status: 'ABERTA' }]); fetchData(); }} onUpdateCota={async (id, u) => { await supabase.from('cotas').update(u).eq('id', id); fetchData(); }} onDeleteCota={async (id) => { await supabase.from('cotas').delete().eq('id', id); fetchData(); }} onSaveSettings={async (s) => { await supabase.from('cota_settings').upsert({ store_id: s.storeId, budget_value: s.budgetValue, manager_percent: s.managerPercent }, { onConflict: 'store_id' }); fetchData(); }} onSaveDebts={async (d) => { await supabase.from('cota_debts').upsert({ store_id: d.storeId, month: d.month, value: d.value }, { onConflict: 'store_id, month' }); fetchData(); }} onDeleteDebt={async (id) => { await supabase.from('cota_debts').delete().eq('id', id); fetchData(); }} onUpdateMixParameter={async (id, sId, cat, pct, sem) => { if (id) { await supabase.from('quota_mix_parameters').update({ mix_percentage: pct }).eq('id', id); } else { await supabase.from('quota_mix_parameters').insert([{ store_id: sId, parent_category: cat, mix_percentage: pct, semester: sem }]); } fetchData(); }} />;
                        if (currentView === 'compras' && can('MODULE_PURCHASES')) return <DashboardPurchases user={user!} stores={stores} data={purchasingData} adminUsers={adminUsers} onImport={async (d) => { await supabase.from('product_performance').insert(d.map(x => ({ store_id: x.storeId, month: x.month, brand: x.brand, category: x.category, pairs_sold: x.pairsSold, revenue: x.revenue }))); fetchData(); }} onOpenSpreadsheetModule={() => setCurrentView('spreadsheet_order')} />;
                        if (currentView === 'pdv_gelateria' && can('MODULE_ICECREAM')) return <IceCreamModule 
                            user={user!} stores={stores} items={iceCreamItems} sales={iceCreamSales} salesHeaders={sales} salePayments={salePayments}
                            stock={iceCreamStock} promissories={icPromissories} can={can}
                            sangriaCategories={icSangriaCategories}
                            sangrias={icSangrias}
                            stockMovements={icStockMovements}
                            partners={partners}
                            adminUsers={adminUsers}
                            onAddSangria={async (s) => { await supabase.from('ice_cream_sangria').insert([s]); fetchData(); }}
                            onAddSangriaCategory={async (c) => { await supabase.from('ice_cream_sangria_categoria').insert([c]); fetchData(); }}
                            onDeleteSangriaCategory={async (id) => { await supabase.from('ice_cream_sangria_categoria').delete().eq('id', id); fetchData(); }}
                            onAddStockMovement={async (m) => { await supabase.from('ice_cream_stock_movements').insert([m]); fetchData(); }}
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
                            onCancelSale={async (code, reason) => { 
                                await supabase.from('ice_cream_daily_sales').update({ status: 'canceled', cancel_reason: reason }).eq('sale_code', code); 
                                await supabase.from('ice_cream_sales').update({ status: 'canceled' }).eq('sale_code', code);
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
                        if (currentView === 'caixa' && can('MODULE_CASH_REGISTER')) return <CashRegisterModule user={user!} stores={stores} sales={iceCreamSales} closures={closures} receipts={receipts} errors={cashErrors} onAddClosure={async (c) => { await supabase.from('cash_register_closures').insert([{ store_id: c.storeId || user?.storeId, closed_by: user?.name, total_sales: c.totalSales, total_expenses: c.totalExpenses, balance: c.balance, notes: c.notes, date: c.date }]); addLog('FECHAMENTO CAIXA', `Fechamento da loja ${c.storeId} no valor de ${c.balance}`); fetchData(); }} onAddReceipt={async (r) => { await supabase.from('financial_receipts').insert([{ id: r.id, store_id: r.storeId || user?.storeId, issuer_name: user?.name, payer: r.payer, recipient: r.recipient, value: r.value, value_in_words: r.valueInWords, reference: r.reference, receipt_date: r.date }]); addLog('EMISSÃO RECIBO', `Recibo #${r.id} para ${r.recipient} no valor de ${r.value}`); fetchData(); }} onAddError={async (e) => { await supabase.from('cash_errors').insert([e]); addLog('REGISTRO QUEBRA', `${e.type === 'shortage' ? 'Falta' : 'Sobra'} de ${e.value} na loja ${e.store_id}`); fetchData(); }} onDeleteError={async (id) => { await supabase.from('cash_errors').delete().eq('id', id); addLog('EXCLUSÃO QUEBRA', `Remoção do registro de quebra ID: ${id}`); fetchData(); }} onAddLog={addLog} />;
                        if (currentView === 'agenda' && can('MODULE_AGENDA')) return <AgendaSystem user={user!} tasks={agenda} onAddTask={async (t) => { await supabase.from('agenda_tasks').insert([{ user_id: user?.id, title: t.title, description: t.description, due_date: t.dueDate, due_time: t.dueTime, priority: t.priority, is_completed: false }]); fetchData(); }} onUpdateTask={async (t) => { await supabase.from('agenda_tasks').update({ is_completed: t.isCompleted }).eq('id', t.id); fetchData(); }} onDeleteTask={async (id) => { await supabase.from('agenda_tasks').delete().eq('id', id); fetchData(); }} />;
                        if (currentView === 'autoriz_compra' && can('MODULE_AUTORIZ_COMPRA')) return <PurchaseAuthorization />;
                        if (currentView === 'termo_condicional' && can('MODULE_TERMO_CONDICIONAL')) return <TermoAutorizacao user={user!} store={stores.find(s => s.id === user?.storeId)} />;
                        if (currentView === 'downloads' && can('MODULE_DOWNLOADS')) return <DownloadsModule user={user!} items={downloads} onUpload={async (i) => { await supabase.from('downloads').insert([i]); fetchData(); }} onDelete={async (id) => { await supabase.from('downloads').delete().eq('id', id); fetchData(); }} />;
                        if (currentView === 'users' && can('MODULE_ADMIN_USERS')) return <AdminUsersManagement currentUser={user} stores={stores} />;
                        if (currentView === 'access' && can('MODULE_ACCESS_CONTROL')) return <AccessControlManagement />;
                        if (currentView === 'audit' && can('MODULE_AUDIT')) return <SystemAudit currentUser={user!} logs={logs} receipts={receipts} cashErrors={cashErrors} iceCreamSales={iceCreamSales} icPromissories={icPromissories} cardSales={cardSales} closures={closures} stores={stores} />;
                        if (currentView === 'settings' && can('MODULE_SETTINGS')) return <AdminSettings stores={stores} onAddStore={async (s) => { await supabase.from('stores').insert([s]); fetchData(); }} onUpdateStore={async (s) => { await supabase.from('stores').update(s).eq('id', s.id); fetchData(); }} onDeleteStore={async (id) => { await supabase.from('stores').delete().eq('id', id); fetchData(); }} />;
                        if (currentView === 'spreadsheet_order' && can('MODULE_PURCHASES')) return <SpreadsheetOrderModule user={user!} onClose={() => setCurrentView('compras')} />;
                        return <div className="flex items-center justify-center h-full text-gray-400 uppercase tracking-widest font-black text-sm">Selecione um módulo no menu</div>;
                    })()}
                </main>
            </div>
        </div>
    );
};

export default App;
