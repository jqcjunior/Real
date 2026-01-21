
import React, { useState, useEffect, useMemo } from 'react';
import { 
    User, Store, MonthlyPerformance, UserRole, Cota, CotaSettings, CotaDebts, QuotaCategory, QuotaMixParameter,
    IceCreamItem, IceCreamDailySale, IceCreamTransaction, CashRegisterClosure, ProductPerformance, Receipt, IceCreamStock, IceCreamPromissoryNote, AgendaItem, DownloadItem, CashError, SystemLog
} from './types';
import { supabase } from './services/supabaseClient';
import { useAuthorization } from './security/useAuthorization';
import { BRAND_LOGO } from './constants';

// Módulos
import CotasManagement from './components/CotasManagement';
import DashboardAdmin from './components/DashboardAdmin';
import DashboardManager from './components/DashboardManager';
import GoalRegistration from './components/GoalRegistration';
import DashboardPurchases from './components/DashboardPurchases';
import IceCreamModule from './components/IceCreamModule';
import FinancialModule from './components/FinancialModule';
import CashErrorsModule from './components/CashErrorsModule';
import AgendaSystem from './components/AgendaSystem';
import InstagramMarketing from './components/InstagramMarketing';
import DownloadsModule from './components/DownloadsModule';
import AdminSettings from './components/AdminSettings';
import AdminUsersManagement from './components/AdminUsersManagement';
import AccessControlManagement from './components/AccessControlManagement';
import CashRegisterModule from './components/CashRegisterModule';
import PurchaseAuthorization from './components/PurchaseAuthorization';
import TermoAutorizacao from './components/TermoAutorizacao';
import SystemAudit from './components/SystemAudit';
import SpreadsheetOrderModule from './components/SpreadsheetOrderModule';
import LoginScreen from './components/LoginScreen';

// Ícones
import { 
    LayoutDashboard, Target, ShoppingBag, Calculator, IceCream as IceCreamIcon, DollarSign, AlertCircle, 
    Calendar, Wand2, Download, Settings, Users, ShieldAlert, LogOut, Loader2, Menu, X, FileSignature, FileText, ClipboardList, Shield, UserCog
} from 'lucide-react';

const App: React.FC = () => {
    const [user, setUser] = useState<User | null>(null);
    const [currentView, setCurrentView] = useState<string>(''); 
    const [isLoading, setIsLoading] = useState(true);

    // States de Dados Consolidados
    const [stores, setStores] = useState<Store[]>([]);
    const [performanceData, setPerformanceData] = useState<MonthlyPerformance[]>([]);
    const [purchasingData, setPurchasingData] = useState<ProductPerformance[]>([]);
    const [cotas, setCotas] = useState<Cota[]>([]);
    const [cotaSettings, setCotaSettings] = useState<CotaSettings[]>([]);
    const [cotaDebts, setCotaDebts] = useState<CotaDebts[]>([]);
    const [quotaCategories, setQuotaCategories] = useState<QuotaCategory[]>([]);
    const [quotaMixParams, setQuotaMixParams] = useState<QuotaMixParameter[]>([]);
    const [iceCreamItems, setIceCreamItems] = useState<IceCreamItem[]>([]);
    const [iceCreamSales, setIceCreamSales] = useState<IceCreamDailySale[]>([]);
    const [iceCreamFinances, setIceCreamFinances] = useState<IceCreamTransaction[]>([]);
    const [iceCreamStock, setIceCreamStock] = useState<IceCreamStock[]>([]);
    const [icPromissories, setIcPromissories] = useState<IceCreamPromissoryNote[]>([]);
    const [receipts, setReceipts] = useState<Receipt[]>([]);
    const [cashErrors, setCashErrors] = useState<CashError[]>([]);
    const [agenda, setAgenda] = useState<AgendaItem[]>([]);
    const [downloads, setDownloads] = useState<DownloadItem[]>([]);
    const [closures, setClosures] = useState<CashRegisterClosure[]>([]);
    const [logs, setLogs] = useState<SystemLog[]>([]);

    const { can } = useAuthorization(user?.role);

    const fetchData = async () => {
        try {
            const [
                {data: s}, {data: p}, {data: pur}, {data: c}, {data: cs}, {data: cd}, {data: cat}, {data: mix},
                {data: ici}, {data: ics}, {data: icf}, {data: icst}, {data: icp}, {data: r}, {data: ce}, {data: ag}, {data: dl}, {data: cl}, {data: lg}
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
                supabase.from('ice_cream_sales').select('*'),
                supabase.from('ice_cream_finances').select('*'),
                supabase.from('ice_cream_stock').select('*'),
                supabase.from('ice_cream_promissories').select('*'),
                supabase.from('receipts').select('*'),
                supabase.from('cash_errors').select('*'),
                supabase.from('agenda_items').select('*'),
                supabase.from('downloads').select('*'),
                supabase.from('cash_register_closures').select('*'),
                supabase.from('system_logs').select('*').order('created_at', { ascending: false }).limit(200)
            ]);

            if(s) setStores(s);
            if(p) setPerformanceData(p.map(x => ({
                ...x, 
                storeId: x.store_id, 
                revenueTarget: Number(x.revenue_target || 0), 
                revenueActual: Number(x.revenue_actual || 0), 
                paTarget: Number(x.pa_target || 0), 
                ticketTarget: Number(x.ticket_target || 0), 
                puTarget: Number(x.pu_target || 0), 
                delinquencyTarget: Number(x.delinquency_target || 0), 
                itemsTarget: Number(x.items_target || 0), 
                itemsActual: Number(x.items_actual || 0), 
                itemsPerTicket: Number(x.items_per_ticket || 0), 
                unitPriceAverage: Number(x.unit_price_average || 0), 
                averageTicket: Number(x.average_ticket || 0), 
                delinquencyRate: Number(x.delinquency_rate || 0), 
                businessDays: x.business_days, 
                percentMeta: Number(x.percent_meta || 0)
            })));
            if(pur) setPurchasingData(pur.map(x => ({...x, storeId: x.store_id, pairsSold: x.pairs_sold})));
            if(c) setCotas(c.map(x => ({
                id: x.id, 
                storeId: x.store_id, 
                brand: x.brand,
                totalValue: x.total_value, 
                shipmentDate: x.shipment_date, 
                paymentTerms: x.payment_terms, 
                createdByRole: x.created_by_role, 
                installments: x.installments, 
                category_id: x.category_id,
                category_name: x.classification || x.category_name,
                classification: x.classification,
                parent_category: x.parent_category,
                pairs: x.pairs,
                status: x.status,
                createdAt: new Date(x.created_at)
            })));
            if(cs) setCotaSettings(cs.map(x => ({...x, storeId: x.store_id, budgetValue: x.budget_value, managerPercent: x.manager_percent})));
            if(cd) setCotaDebts(cd.map(x => ({...x, storeId: x.store_id})));
            if(cat) setQuotaCategories(cat);
            if(mix) setQuotaMixParams(mix);
            if(ici) setIceCreamItems(ici.map(x => ({...x, storeId: x.store_id, image_url: x.image_url})));
            if(ics) setIceCreamSales(ics.map(x => ({...x, storeId: x.store_id, productName: x.product_name, units_sold: x.units_sold, total_value: x.total_value, payment_method: x.payment_method, sale_code: x.sale_code, buyer_name: x.buyer_name, createdAt: x.created_at})));
            if(icf) setIceCreamFinances(icf.map(x => ({...x, storeId: x.store_id})));
            if(icst) setIceCreamStock(icst);
            if(icp) setIcPromissories(icp);
            if(r) setReceipts(r.map(x => ({...x, storeId: x.store_id, issuerName: x.issuer_name, valueInWords: x.value_in_words})));
            if(ce) setCashErrors(ce.map(x => ({...x, storeId: x.store_id, userId: x.user_id, userName: x.user_name})));
            if(ag) setAgenda(ag.map(x => ({...x, userId: x.user_id, dueDate: x.due_date, dueTime: x.due_time, isCompleted: x.is_completed})));
            if(dl) setDownloads(dl.map(x => ({...x, fileName: x.file_name, createdBy: x.created_by})));
            if(cl) setClosures(cl.map(x => ({...x, storeId: x.store_id, closedBy: x.closed_by})));
            if(lg) setLogs(lg);

        } catch (err) { console.error("Erro Geral de Sincronismo:", err); }
        finally { setIsLoading(false); }
    };

    useEffect(() => {
        fetchData();
        // REMOVIDO LOGIN AUTOMÁTICO: Agora o sistema sempre exige credenciais.
    }, []);

    useEffect(() => {
        if (user && !currentView) {
            if (user.role === UserRole.ADMIN) setCurrentView('dashboard_rede');
            else setCurrentView('dashboard_loja');
        }
    }, [user, currentView]);

    const handleLoginAttempt = async (email: string, password: string): Promise<{ success: boolean; user?: User; error?: string }> => {
        try {
            const { data, error } = await supabase
                .from('admin_users')
                .select('*')
                .eq('email', email.trim().toLowerCase())
                .eq('password', password.trim())
                .eq('status', 'active')
                .single();

            if (error || !data) {
                return { success: false, error: 'E-mail ou senha incorretos ou conta inativa.' };
            }

            const mappedRole = (role: string): UserRole => {
                switch(role.toLowerCase()) {
                    case 'admin': return UserRole.ADMIN;
                    case 'manager': return UserRole.MANAGER;
                    case 'cashier': return UserRole.CASHIER;
                    case 'sorvete': return UserRole.ICE_CREAM;
                    default: return UserRole.MANAGER;
                }
            };

            const loggedUser: User = {
                id: data.id,
                name: data.name,
                email: data.email,
                role: mappedRole(data.role_level),
                storeId: data.store_id
            };

            setUser(loggedUser);
            return { success: true, user: loggedUser };
        } catch (err) {
            return { success: false, error: 'Falha na comunicação com o servidor de acesso.' };
        }
    };

    const handleLogout = () => {
        setUser(null);
        setCurrentView('');
        window.location.reload();
    };

    const menuSections = [
        {
            title: 'Inteligência',
            items: [
                { id: 'dashboard_rede', label: 'Dashboard Rede', icon: LayoutDashboard, perm: 'MODULE_DASHBOARD_ADMIN' },
                { id: 'dashboard_loja', label: 'Dashboard Loja', icon: LayoutDashboard, perm: 'MODULE_DASHBOARD_MANAGER' },
                { id: 'metas', label: 'Metas', icon: Target, perm: 'MODULE_METAS' },
                { id: 'cotas', label: 'Cotas OTB', icon: Calculator, perm: 'MODULE_COTAS' },
                { id: 'compras', label: 'Compras', icon: ShoppingBag, perm: 'MODULE_PURCHASES' }
            ]
        },
        {
            title: 'Operacional',
            items: [
                { id: 'pdv_gelateria', label: 'PDV Gelateria', icon: IceCreamIcon, perm: 'MODULE_ICECREAM' },
                { id: 'caixa', label: 'Caixa', icon: ClipboardList, perm: 'MODULE_CASH_REGISTER' },
                { id: 'financeiro', label: 'Financeiro', icon: DollarSign, perm: 'MODULE_FINANCIAL' },
                { id: 'quebras', label: 'Quebras', icon: AlertCircle, perm: 'MODULE_CASH_ERRORS' },
                { id: 'agenda', label: 'Agenda Semanal', icon: Calendar, perm: 'MODULE_AGENDA' }
            ]
        },
        {
            title: 'Documentos',
            items: [
                { id: 'downloads', label: 'Downloads', icon: Download, perm: 'MODULE_DOWNLOADS' },
                { id: 'autoriz_compra', label: 'Autoriz. Compra', icon: FileSignature, perm: 'MODULE_DOCUMENTS' },
                { id: 'termo_condicional', label: 'Termo Condicional', icon: FileText, perm: 'MODULE_DOCUMENTS' }
            ]
        },
        {
            title: 'Administração',
            items: [
                { id: 'users', label: 'Usuários', icon: Users, perm: 'MODULE_ADMIN_USERS' },
                { id: 'access', label: 'Acessos', icon: ShieldAlert, perm: 'MODULE_ACCESS_CONTROL' },
                { id: 'audit', label: 'Auditoria', icon: Shield, perm: 'MODULE_AUDIT' },
                { id: 'settings', label: 'Configurações', icon: Settings, perm: 'MODULE_SETTINGS' }
            ]
        }
    ];

    if (!user) return <LoginScreen onLoginAttempt={handleLoginAttempt} />;

    if (isLoading || !currentView) return <div className="h-screen flex flex-col items-center justify-center bg-gray-950"><Loader2 className="animate-spin text-red-600 mb-4" size={48} /><p className="text-white font-black uppercase text-[10px] tracking-widest animate-pulse">Sincronizando Ecossistema Real...</p></div>;

    return (
        <div className="flex h-screen bg-gray-950 text-white overflow-hidden font-sans">
            {/* SIDEBAR FIXA - ENTERPRISE v6.3 */}
            <aside className="w-72 bg-gray-950 border-r border-white/5 flex flex-col p-8 overflow-y-auto no-scrollbar shrink-0">
                <div className="flex items-center gap-4 mb-12 shrink-0">
                    <img src={BRAND_LOGO} alt="Logo" className="w-12 h-12 object-contain" />
                    <h1 className="text-2xl font-black italic tracking-tighter uppercase leading-none">REAL <span className="text-red-600">ADMIN</span></h1>
                </div>
                <nav className="flex-1 space-y-10">
                    {menuSections.map(section => {
                        const visibleItems = section.items.filter(i => can(i.perm as any));
                        if (visibleItems.length === 0) return null;
                        return (
                            <div key={section.title} className="space-y-4">
                                <h3 className="px-4 text-[10px] font-black uppercase text-gray-600 tracking-[0.4em] mb-4">{section.title}</h3>
                                {section.items.map(item => can(item.perm as any) && (
                                    <button 
                                        key={item.id} 
                                        onClick={() => setCurrentView(item.id)} 
                                        className={`w-full text-left p-4 rounded-[20px] font-black uppercase text-[10px] tracking-widest flex items-center gap-4 transition-all duration-300 ${currentView === item.id ? 'bg-blue-600 text-white shadow-[0_15px_30px_rgba(37,99,235,0.3)]' : 'text-gray-500 hover:text-white hover:bg-white/5'}`}
                                    >
                                        <item.icon size={20} /> {item.label}
                                    </button>
                                ))}
                            </div>
                        );
                    })}
                </nav>
                <button onClick={handleLogout} className="mt-12 flex items-center gap-4 p-5 text-red-500 font-black uppercase text-[10px] tracking-widest hover:bg-red-500/10 rounded-2xl transition-all border border-red-500/20"><LogOut size={18} /> Sair do Sistema</button>
            </aside>

            {/* AREA DE CONTEÚDO PRINCIPAL */}
            <div className="flex-1 flex flex-col h-full bg-[#f3f4f6] overflow-hidden text-blue-950">
                <header className="h-16 border-b border-gray-100 bg-white items-center justify-between px-12 flex shrink-0 z-50">
                    <span className="text-xs font-black uppercase text-gray-400 tracking-widest flex items-center gap-3">
                        <UserCog className="text-blue-900" size={18}/> Sessão Ativa: <span className="text-blue-950 italic">{user?.name}</span>
                    </span>
                    <div className="flex items-center gap-6">
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                            <span className="text-[10px] font-black text-gray-400 uppercase">Rede Sincronizada</span>
                        </div>
                        <span className="text-[10px] font-black text-gray-300 uppercase italic tracking-widest">Enterprise v6.3 Stable</span>
                    </div>
                </header>

                <main className="flex-1 overflow-y-auto relative no-scrollbar">
                    {(() => {
                        if (currentView === 'dashboard_rede') return <DashboardAdmin stores={stores} performanceData={performanceData} onImportData={fetchData} />;
                        if (currentView === 'dashboard_loja') return <DashboardManager user={user!} stores={stores} performanceData={performanceData} purchasingData={purchasingData} />;
                        if (currentView === 'metas') return <GoalRegistration stores={stores} performanceData={performanceData} onUpdateData={async (data) => { for(const row of data) { await supabase.from('monthly_performance').upsert({ store_id: row.storeId, month: row.month, revenue_target: row.revenueTarget, pa_target: row.paTarget, ticket_target: row.ticketTarget, pu_target: row.puTarget, items_target: row.itemsTarget, business_days: row.businessDays }); } fetchData(); }} />;
                        if (currentView === 'cotas') return <CotasManagement user={user!} stores={stores} cotas={cotas} cotaSettings={cotaSettings} cotaDebts={cotaDebts} performanceData={performanceData} productCategories={quotaCategories} mixParameters={quotaMixParams} onAddCota={async (c) => { await supabase.from('cotas').insert([{ store_id: c.storeId, brand: c.brand, category_id: c.category_id, total_value: c.totalValue, shipment_date: `${c.shipmentDate}-01`, payment_terms: c.paymentTerms, pairs: c.pairs, installments: c.installments, status: 'ABERTA' }]); fetchData(); }} onUpdateCota={async (id, u) => { await supabase.from('cotas').update(u).eq('id', id); fetchData(); }} onDeleteCota={async (id) => { await supabase.from('cotas').delete().eq('id', id); fetchData(); }} onSaveSettings={async (s) => { await supabase.from('cota_settings').upsert({ store_id: s.storeId, budget_value: s.budgetValue, manager_percent: s.managerPercent }, { onConflict: 'store_id' }); fetchData(); }} onSaveDebts={async (d) => { await supabase.from('cota_debts').upsert({ store_id: d.storeId, month: d.month, value: d.value }, { onConflict: 'store_id, month' }); fetchData(); }} onDeleteDebt={async (id) => { await supabase.from('cota_debts').delete().eq('id', id); fetchData(); }} />;
                        if (currentView === 'compras') return <DashboardPurchases user={user!} stores={stores} data={purchasingData} onImport={async (d) => { await supabase.from('product_performance').insert(d.map(x => ({ store_id: x.storeId, month: x.month, brand: x.brand, category: x.category, pairs_sold: x.pairsSold, revenue: x.revenue }))); fetchData(); }} onOpenSpreadsheetModule={() => setCurrentView('spreadsheet_order')} />;
                        if (currentView === 'pdv_gelateria') return <IceCreamModule user={user!} stores={stores} items={iceCreamItems} sales={iceCreamSales} finances={iceCreamFinances} stock={iceCreamStock} promissories={icPromissories} can={can} onAddSales={async (s) => { await supabase.from('ice_cream_sales').insert(s.map(x => ({ store_id: x.storeId, product_name: x.productName, units_sold: x.unitsSold, total_value: x.totalValue, payment_method: x.paymentMethod, sale_code: x.saleCode, buyer_name: x.buyer_name, item_id: x.itemId, flavor: x.flavor }))); fetchData(); }} onCancelSale={async (code, r) => { await supabase.from('ice_cream_sales').update({ status: 'canceled', cancel_reason: r }).eq('sale_code', code); fetchData(); }} onUpdatePrice={async (id, p) => { await supabase.from('ice_cream_items').update({ price: p }).eq('id', id); fetchData(); }} onAddTransaction={async (t) => { await supabase.from('ice_cream_finances').insert([{ store_id: t.storeId, date: t.date, type: t.type, category: t.category, value: t.value, description: t.description }]); fetchData(); }} onAddItem={async (n, c, p, f, si, u, cps, tsId, r) => { await supabase.from('ice_cream_items').insert([{ store_id: tsId, name: n, category: c, price: p, flavor: f, active: true, consumption_per_sale: cps, recipe: r }]); fetchData(); }} onDeleteItem={async (id) => { await supabase.from('ice_cream_items').delete().eq('id', id); fetchData(); }} onUpdateStock={async (sId, b, v, u, t) => { await supabase.from('ice_cream_stock_moves').insert([{ store_id: sId, product_base: b, quantity: v, unit: u, move_type: t }]); fetchData(); } } liquidatePromissory={async (id) => { await supabase.from('ice_cream_promissories').update({ status: 'paid' }).eq('id', id); fetchData(); }} />;
                        if (currentView === 'caixa') return <CashRegisterModule user={user!} sales={iceCreamSales} finances={iceCreamFinances} closures={closures} onAddClosure={async (c) => { await supabase.from('cash_register_closures').insert([{ store_id: user?.storeId, closed_by: user?.name, total_sales: c.totalSales, total_expenses: c.totalExpenses, balance: c.balance, notes: c.notes, date: c.date }]); fetchData(); }} />;
                        if (currentView === 'financeiro') return <FinancialModule user={user!} store={stores.find(s => s.id === user?.storeId)} sales={[]} receipts={receipts} onAddReceipt={async (r) => { await supabase.from('receipts').insert([{ store_id: r.storeId, issuer_name: r.issuerName, payer: r.payer, recipient: r.recipient, value: r.value, value_in_words: r.valueInWords, reference: r.reference, date: r.date }]); fetchData(); }} onAddSale={async () => {}} onDeleteSale={async () => {}} />;
                        if (currentView === 'quebras') return <CashErrorsModule user={user!} stores={stores} errors={cashErrors} onAddError={async (e) => { await supabase.from('cash_errors').insert([{ store_id: e.storeId, user_id: e.userId, user_name: e.userName, date: e.date, type: e.type, value: e.value, reason: e.reason }]); fetchData(); }} onUpdateError={async (e) => { await supabase.from('cash_errors').update(e).eq('id', e.id); fetchData(); }} onDeleteError={async (id) => { await supabase.from('cash_errors').delete().eq('id', id); fetchData(); }} />;
                        if (currentView === 'agenda') return <AgendaSystem user={user!} tasks={agenda} onAddTask={async (t) => { await supabase.from('agenda_items').insert([{ user_id: t.userId, title: t.title, description: t.description, due_date: t.dueDate, due_time: t.dueTime, priority: t.priority, reminder_level: t.reminder_level }]); fetchData(); }} onUpdateTask={async (t) => { await supabase.from('agenda_items').update({ is_completed: t.isCompleted, completed_note: t.completed_note }).eq('id', t.id); fetchData(); }} onDeleteTask={async (id) => { await supabase.from('agenda_items').delete().eq('id', id); fetchData(); }} />;
                        if (currentView === 'autoriz_compra') return <PurchaseAuthorization />;
                        if (currentView === 'termo_condicional') return <TermoAutorizacao user={user!} store={stores.find(s => s.id === user?.storeId)} />;
                        if (currentView === 'downloads') return <DownloadsModule user={user!} items={downloads} onUpload={async (i) => { await supabase.from('downloads').insert([{ title: i.title, description: i.description, category: i.category, url: i.url, file_name: i.fileName, size: i.size, campaign: i.campaign, created_by: i.createdBy }]); fetchData(); }} onDelete={async (id) => { await supabase.from('downloads').delete().eq('id', id); fetchData(); }} />;
                        if (currentView === 'studio_real') return <InstagramMarketing user={user!} store={stores.find(s => s.id === user?.storeId)} />;
                        if (currentView === 'users') return <AdminUsersManagement currentUser={user!} stores={stores} />;
                        if (currentView === 'access') return <AccessControlManagement />;
                        if (currentView === 'audit') return <SystemAudit logs={logs} receipts={receipts} cashErrors={cashErrors} iceCreamSales={iceCreamSales} icPromissories={icPromissories} store={stores.find(s => s.id === user?.storeId)} />;
                        if (currentView === 'settings') return <AdminSettings stores={stores} onAddStore={async (s) => { await supabase.from('stores').insert([s]); fetchData(); }} onUpdateStore={async (s) => { await supabase.from('stores').update(s).eq('id', s.id); fetchData(); }} onDeleteStore={async (id) => { await supabase.from('stores').delete().eq('id', id); fetchData(); }} />;
                        if (currentView === 'spreadsheet_order') return <SpreadsheetOrderModule user={user!} onClose={() => setCurrentView('compras')} />;
                        return <DashboardAdmin stores={stores} performanceData={performanceData} onImportData={fetchData} />;
                    })()}
                </main>
            </div>
        </div>
    );
};

export default App;
