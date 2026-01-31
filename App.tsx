
import React, { useState, useEffect, useMemo } from 'react';
import { 
    User, Store, MonthlyPerformance, UserRole, Cota, CotaSettings, CotaDebts, QuotaCategory, QuotaMixParameter,
    IceCreamItem, IceCreamDailySale, IceCreamDailySale as IceCreamSale, IceCreamTransaction, CashRegisterClosure, ProductPerformance, Receipt, IceCreamStock, IceCreamPromissoryNote, AgendaItem, DownloadItem, CashError, SystemLog
} from './types';
import { supabase } from './services/supabaseClient';
import { useAuthorization } from './security/useAuthorization';
import { BRAND_LOGO } from './constants';

// Módulos
import { CotasManagement } from './components/CotasManagement';
import DashboardAdmin from './components/DashboardAdmin';
import DashboardManager from './components/DashboardManager';
import GoalRegistration from './components/GoalRegistration';
import DashboardPurchases from './components/DashboardPurchases';
import IceCreamModule from './components/IceCreamModule';
import FinancialModule from './components/FinancialModule';
import CashErrorsModule from './components/CashErrorsModule';
import AgendaSystem from './components/AgendaSystem';
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
    Calendar, LogOut, Loader2, Menu, X, ClipboardList, Shield, UserCog, Users, ShieldAlert, Settings, FileSignature, FileText, Download
} from 'lucide-react';

const App: React.FC = () => {
    const [user, setUser] = useState<User | null>(null);
    const [currentView, setCurrentView] = useState<string>(''); 
    const [isLoading, setIsLoading] = useState(true);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

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
                supabase.from('ice_cream_daily_sales').select('*').order('created_at', { ascending: false }),
                supabase.from('ice_cream_finances').select('*').order('date', { ascending: false }),
                supabase.from('ice_cream_stock').select('*'),
                supabase.from('ice_cream_promissory_notes').select('*'),
                supabase.from('receipts').select('*'),
                supabase.from('cash_errors').select('*'),
                supabase.from('agenda_items').select('*'),
                supabase.from('downloads').select('*'),
                supabase.from('cash_register_closures').select('*'),
                supabase.from('system_logs').select('*').order('created_at', { ascending: false }).limit(200)
            ]);

            if(s) setStores(s);
            if(p) setPerformanceData(p.map(x => ({ ...x, storeId: x.store_id, revenueTarget: Number(x.revenue_target || 0), revenueActual: Number(x.revenue_actual || 0), paTarget: Number(x.pa_target || 0), ticketTarget: Number(x.ticket_target || 0), puTarget: Number(x.pu_target || 0), delinquencyTarget: Number(x.delinquency_target || 0), itemsTarget: Number(x.items_target || 0), itemsActual: Number(x.items_actual || 0), itemsPerTicket: Number(x.items_per_ticket || 0), unitPriceAverage: Number(x.unit_price_average || 0), averageTicket: Number(x.average_ticket || 0), delinquencyRate: Number(x.delinquency_rate || 0), businessDays: x.business_days, percentMeta: Number(x.percent_meta || 0), growthTarget: Number(x.growth_target || 0), rewardValue: Number(x.reward_value || 0) })));
            if(pur) setPurchasingData(pur.map(x => ({...x, storeId: x.store_id, pairsSold: x.pairs_sold})));
            if(c) setCotas(c.map(x => ({ ...x, id: x.id, storeId: x.store_id, totalValue: Number(x.total_value || 0), shipmentDate: x.shipment_date, paymentTerms: x.payment_terms, createdByRole: x.created_by_role, category_id: x.category_id, category_name: x.category_name || x.classification, createdAt: new Date(x.created_at) })));
            if(cs) setCotaSettings(cs.map(x => ({...x, storeId: x.store_id, budgetValue: x.budget_value, managerPercent: x.manager_percent})));
            if(cd) setCotaDebts(cd.map(x => ({...x, storeId: x.store_id})));
            if(cat) setQuotaCategories(cat);
            if(mix) setQuotaMixParams(mix);
            
            if(ici) setIceCreamItems(ici.map(x => {
                let recipeParsed = [];
                try { recipeParsed = typeof x.recipe === 'string' ? JSON.parse(x.recipe) : (x.recipe || []); } catch(e) { recipeParsed = []; }
                return { id: x.id, storeId: x.store_id, name: x.name, category: x.category, price: Number(x.price || 0), flavor: x.flavor, active: x.active, consumptionPerSale: x.consumption_per_sale || 0, recipe: recipeParsed, image_url: x.image_url };
            }));

            if(ics) setIceCreamSales(ics.map(x => ({ id: x.id, storeId: x.store_id, itemId: x.item_id, productName: x.product_name, category: x.category, flavor: x.flavor, units_sold: Number(x.units_sold || 0), unit_price: Number(x.unit_price || 0), totalValue: Number(x.total_value || 0), paymentMethod: x.payment_method, saleCode: x.sale_code, buyer_name: x.buyer_name, createdAt: x.created_at, status: x.status, cancel_reason: x.cancel_reason, canceled_by: x.canceled_by })));
            if(icf) setIceCreamFinances(icf.map(x => ({ id: x.id, storeId: x.store_id, date: x.date ? x.date.split('T')[0] : '', type: x.type, category: x.category, value: Number(x.value || 0), description: x.description, createdAt: new Date(x.created_at) })));
            if(icst) setIceCreamStock(icst);
            if(icp) setIcPromissories(icp);
            if(r) setReceipts(r.map(x => ({...x, storeId: x.store_id, issuerName: x.issuer_name, payer: x.payer, recipient: x.recipient, value: x.value, valueInWords: x.value_in_words})));
            if(ce) setCashErrors(ce.map(x => ({...x, id: x.id, storeId: x.store_id, userId: x.user_id, userName: x.user_name || 'Usuário', date: x.error_date || x.date, value: Number(x.value || 0), type: x.type, reason: x.reason, createdAt: new Date(x.created_at)})));
            if(ag) setAgenda(ag.map(x => ({...x, userId: x.user_id, dueDate: x.due_date, dueTime: x.due_time, isCompleted: x.is_completed})));
            if(dl) setDownloads(dl.map(x => ({...x, fileName: x.file_name, createdBy: x.created_by})));
            if(cl) setClosures(cl.map(x => ({...x, storeId: x.store_id, closedBy: x.closed_by})));
            if(lg) setLogs(lg);
        } catch (err) { console.error("Erro Sincronismo:", err); }
        finally { setIsLoading(false); }
    };

    const handleLogin = async (email: string, pass: string, remember: boolean) => {
        try {
            const { data, error } = await supabase.from('admin_users').select('*').eq('email', email).eq('password', pass).eq('status', 'active').single();
            if (error || !data) return { success: false, error: 'Credenciais inválidas ou acesso inativo.' };

            const loggedUser: User = { 
                id: data.id, 
                name: data.name, 
                role: data.role_level.toUpperCase() as UserRole, 
                email: data.email,
                storeId: data.store_id 
            };

            await supabase.from('system_logs').insert([{
                userId: loggedUser.id,
                userName: loggedUser.name,
                userRole: loggedUser.role,
                action: 'LOGIN_SISTEMA',
                details: `Profissional realizou acesso via terminal. Unidade: ${data.store_id || 'REDE'}`
            }]);

            setUser(loggedUser);
            if (loggedUser.role === UserRole.ADMIN) setCurrentView('dashboard_rede');
            else setCurrentView('dashboard_loja');
            
            return { success: true, user: loggedUser };
        } catch (err) {
            return { success: false, error: 'Falha na conexão.' };
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleSaveIceCreamProduct = async (product: Partial<IceCreamItem>) => {
        try {
            const payload = { store_id: product.storeId, name: product.name?.toUpperCase().trim(), category: product.category, price: product.price, flavor: product.flavor || 'Padrão', active: product.active ?? true, consumption_per_sale: 0, recipe: JSON.stringify(product.recipe || []) };
            if (product.id) { await supabase.from('ice_cream_items').update(payload).eq('id', product.id); } 
            else { await supabase.from('ice_cream_items').insert([payload]); }
            await fetchData();
        } catch (err) { console.error("Erro ao salvar produto:", err); throw err; }
    };

    if (!user) return <LoginScreen onLoginAttempt={handleLogin} />;

    return (
        <div className="flex h-screen bg-gray-950 text-white overflow-hidden font-sans relative">
            {isSidebarOpen && ( <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[90] transition-opacity duration-300" onClick={() => setIsSidebarOpen(false)} /> )}
            <aside className={`fixed inset-y-0 left-0 z-[100] w-72 bg-gray-950 border-r border-white/5 flex flex-col p-6 transition-transform duration-300 transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} shrink-0 overflow-y-auto no-scrollbar shadow-2xl`}>
                <button onClick={() => setIsSidebarOpen(false)} className="absolute top-6 right-6 text-gray-400 hover:text-white transition-colors"><X size={28} /></button>
                <div className="flex items-center gap-4 mb-8 shrink-0">
                    <img src={BRAND_LOGO} alt="Logo" className="h-10 w-auto max-w-[180px] object-contain" />
                    <h1 className="text-xl font-black italic tracking-tighter uppercase leading-none">ADMIN</h1>
                </div>
                <nav className="flex-1 space-y-6">
                    {[
                        { title: 'Inteligência', items: [ { id: 'dashboard_rede', label: 'Dashboard Rede', icon: LayoutDashboard, perm: 'MODULE_DASHBOARD_ADMIN' }, { id: 'dashboard_loja', label: 'Dashboard Loja', icon: LayoutDashboard, perm: 'MODULE_DASHBOARD_MANAGER' }, { id: 'metas', label: 'Metas', icon: Target, perm: 'MODULE_METAS' }, { id: 'cotas', label: 'Cotas OTB', icon: Calculator, perm: 'MODULE_COTAS' }, { id: 'compras', label: 'Compras', icon: ShoppingBag, perm: 'MODULE_PURCHASES' } ] },
                        { title: 'Operacional', items: [ { id: 'pdv_gelateria', label: 'PDV Gelateria', icon: IceCreamIcon, perm: 'MODULE_ICECREAM' }, { id: 'caixa', label: 'Caixa', icon: ClipboardList, perm: 'MODULE_CASH_REGISTER' }, { id: 'financeiro', label: 'Financeiro', icon: DollarSign, perm: 'MODULE_FINANCIAL' }, { id: 'quebras', label: 'Quebras', icon: AlertCircle, perm: 'MODULE_CASH_ERRORS' }, { id: 'agenda', label: 'Agenda Semanal', icon: Calendar, perm: 'MODULE_AGENDA' } ] },
                        { title: 'Documentos', items: [ { id: 'autoriz_compra', label: 'Autoriz. Compra', icon: FileSignature, perm: 'MODULE_AUTORIZ_COMPRA' }, { id: 'termo_condicional', label: 'Termo Condicional', icon: FileText, perm: 'MODULE_TERMO_CONDICIONAL' }, { id: 'downloads', label: 'Downloads', icon: Download, perm: 'MODULE_DOWNLOADS' } ] },
                        { title: 'Administração', items: [ { id: 'users', label: 'Usuários', icon: Users, perm: 'MODULE_ADMIN_USERS' }, { id: 'access', label: 'Acessos', icon: ShieldAlert, perm: 'MODULE_ACCESS_CONTROL' }, { id: 'audit', label: 'Auditoria', icon: Shield, perm: 'MODULE_AUDIT' }, { id: 'settings', label: 'Configurações', icon: Settings, perm: 'MODULE_SETTINGS' } ] }
                    ].map(section => {
                        const visibleItems = section.items.filter(i => can(i.perm as any));
                        if (visibleItems.length === 0) return null;
                        return (
                            <div key={section.title} className="space-y-1">
                                <h3 className="px-4 text-[10px] font-black uppercase text-gray-600 tracking-[0.4em] mb-2">{section.title}</h3>
                                {section.items.map(item => can(item.perm as any) && (
                                    <button key={item.id} onClick={() => { setCurrentView(item.id); setIsSidebarOpen(false); }} className={`w-full text-left py-2.5 px-4 rounded-xl font-black uppercase text-[10px] tracking-widest flex items-center gap-4 transition-all duration-300 ${currentView === item.id ? 'bg-blue-600 text-white shadow-[0_15px_30px_rgba(37,99,235,0.3)]' : 'text-gray-500 hover:text-white hover:bg-white/5'}`}><item.icon size={20} /> {item.label}</button>
                                ))}
                            </div>
                        );
                    })}
                </nav>
                <button onClick={() => window.location.reload()} className="mt-8 flex items-center gap-4 p-4 text-red-500 font-black uppercase text-[10px] tracking-widest hover:bg-red-500/10 rounded-xl transition-all border border-red-500/20 shrink-0"><LogOut size={18} /> Sair do Sistema</button>
            </aside>
            <div className="flex-1 flex flex-col h-full bg-[#f3f4f6] overflow-hidden text-blue-950">
                <header className="h-16 border-b border-gray-100 bg-white items-center justify-between px-6 lg:px-12 flex shrink-0 z-50">
                    <div className="flex items-center gap-4">
                        <button onClick={() => setIsSidebarOpen(true)} className="p-2 text-blue-900 -ml-2 hover:bg-gray-100 rounded-xl transition-all"><Menu size={24} /></button>
                        <span className="text-xs font-black uppercase text-gray-400 tracking-widest hidden sm:flex items-center gap-3"><UserCog className="text-blue-900" size={18}/> Sessão: <span className="text-blue-950 italic">{user?.name}</span></span>
                    </div>
                    <div className="flex items-center gap-6"><div className="hidden md:flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div><span className="text-[10px] font-black text-gray-400 uppercase">Rede Sincronizada</span></div><span className="text-[10px] font-black text-gray-300 uppercase italic tracking-widest">v6.9 Stable</span></div>
                </header>
                <main className="flex-1 overflow-y-auto relative no-scrollbar">
                    {(() => {
                        if (currentView === 'dashboard_rede') return <DashboardAdmin stores={stores} performanceData={performanceData} onImportData={fetchData} />;
                        if (currentView === 'dashboard_loja') return <DashboardManager user={user!} stores={stores} performanceData={performanceData} purchasingData={purchasingData} />;
                        if (currentView === 'metas') return <GoalRegistration stores={stores} performanceData={performanceData} onUpdateData={async (data) => { for(const row of data) { await supabase.from('monthly_performance').upsert({ store_id: row.storeId, month: row.month, revenue_target: row.revenueTarget, pa_target: row.paTarget, ticket_target: row.ticketTarget, pu_target: row.puTarget, items_target: row.itemsTarget, business_days: row.businessDays, growth_target: row.growthTarget, reward_value: row.rewardValue }); } fetchData(); }} />;
                        if (currentView === 'cotas') return <CotasManagement user={user!} stores={stores} cotas={cotas} cotaSettings={cotaSettings} cotaDebts={cotaDebts} performanceData={performanceData} productCategories={quotaCategories} mixParameters={quotaMixParams} onAddCota={async (c) => { await supabase.from('cotas').insert([{ store_id: c.storeId, brand: c.brand, category_id: c.category_id, total_value: c.totalValue, shipment_date: `${c.shipmentDate}-01`, payment_terms: c.paymentTerms, pairs: c.pairs, installments: c.installments, status: 'ABERTA' }]); fetchData(); }} onUpdateCota={async (id, u) => { await supabase.from('cotas').update(u).eq('id', id); fetchData(); }} onDeleteCota={async (id) => { await supabase.from('cotas').delete().eq('id', id); fetchData(); }} onSaveSettings={async (s) => { /* Fix: Property 'store_id' does not exist on type 'CotaSettings'. Did you mean 'storeId'? */ await supabase.from('cota_settings').upsert({ store_id: s.storeId, budget_value: s.budgetValue, manager_percent: s.managerPercent }, { onConflict: 'store_id' }); fetchData(); }} onSaveDebts={async (d) => { await supabase.from('cota_debts').upsert({ store_id: d.storeId, month: d.month, value: d.value }, { onConflict: 'store_id, month' }); fetchData(); }} onDeleteDebt={async (id) => { await supabase.from('cota_debts').delete().eq('id', id); fetchData(); }} />;
                        /* Fix: Access correct property name pairsSold instead of pairs_sold on ProductPerformance type */
                        if (currentView === 'compras') return <DashboardPurchases user={user!} stores={stores} data={purchasingData} onImport={async (d) => { await supabase.from('product_performance').insert(d.map(x => ({ store_id: x.storeId, month: x.month, brand: x.brand, category: x.category, pairs_sold: x.pairsSold, revenue: x.revenue }))); fetchData(); }} onOpenSpreadsheetModule={() => setCurrentView('spreadsheet_order')} />;
                        if (currentView === 'quebras') return <CashErrorsModule user={user!} stores={stores} store={stores.find(s => s.id === user?.storeId)} errors={cashErrors} onAddError={async (e: any) => { await supabase.from('cash_errors').insert([e]); fetchData(); }} onUpdateError={async (e) => { await supabase.from('cash_errors').update(e).eq('id', e.id); fetchData(); }} onDeleteError={async (id) => { await supabase.from('cash_errors').delete().eq('id', id); fetchData(); }} />;
                        if (currentView === 'autoriz_compra') return <PurchaseAuthorization />;
                        if (currentView === 'termo_condicional') return <TermoAutorizacao user={user!} store={stores.find(s => s.id === user?.storeId)} />;
                        if (currentView === 'downloads') return <DownloadsModule user={user!} items={downloads} onUpload={async (i) => { await supabase.from('downloads').insert([{ title: i.title, description: i.description, category: i.category, url: i.url, file_name: i.fileName, size: i.size, campaign: i.campaign, created_by: i.createdBy }]); fetchData(); }} onDelete={async (id) => { await supabase.from('downloads').delete().eq('id', id); fetchData(); }} />;
                        if (currentView === 'pdv_gelateria') return (
                            <IceCreamModule 
                                user={user!} stores={stores} items={iceCreamItems} sales={iceCreamSales} finances={iceCreamFinances} stock={iceCreamStock} promissories={icPromissories} can={can} 
                                onAddSales={async (s) => { 
                                    const { error } = await supabase.from('ice_cream_daily_sales').insert(s.map(x => ({ store_id: x.storeId, item_id: x.itemId, product_name: x.productName, category: x.category, flavor: x.flavor, units_sold: Math.round(x.unitsSold), unit_price: x.unitPrice, total_value: x.totalValue, payment_method: x.paymentMethod, sale_code: x.saleCode, buyer_name: x.buyer_name, status: 'active' })));
                                    if (error) throw error;
                                    
                                    const fiados = s.filter(x => x.paymentMethod === 'Fiado' || (x.paymentMethod === 'Misto' && x.buyer_name));
                                    if (fiados.length > 0) {
                                        await supabase.from('ice_cream_promissory_notes').insert(fiados.map(f => ({
                                            store_id: f.storeId,
                                            buyer_name: f.buyer_name,
                                            value: f.totalValue,
                                            status: 'pending',
                                            sale_id: f.id || f.saleCode
                                        })));
                                    }
                                    await fetchData(); 
                                }} 
                                onCancelSale={async (code: string, r?: string) => { 
                                    await supabase.from('ice_cream_daily_sales').update({ status: 'canceled', cancel_reason: r, canceled_by: user?.name }).eq('sale_code', code); 
                                    const { data: financeEntries } = await supabase.from('ice_cream_finances').select('*').ilike('description', `%Ref. ${code}%`);
                                    if (financeEntries && financeEntries.length > 0) {
                                        const reversals = financeEntries.map(f => ({ store_id: f.store_id, date: new Date().toLocaleDateString('en-CA'), type: 'exit', category: 'ESTORNO DE VENDA', value: f.value, description: `Reversão financeira: ${f.description}` }));
                                        await supabase.from('ice_cream_finances').insert(reversals);
                                    }
                                    await fetchData(); 
                                }} 
                                onUpdatePrice={async (id, p) => { await supabase.from('ice_cream_items').update({ price: p }).eq('id', id); await fetchData(); }} 
                                onAddTransaction={async (t) => { await supabase.from('ice_cream_finances').insert([{ store_id: t.storeId, date: t.date, type: t.type, category: t.category, value: Number(t.value), description: t.description }]); await fetchData(); }} 
                                onAddItem={async (n, c, p, f, si, u, cps, tsId, r) => { await handleSaveIceCreamProduct({ storeId: tsId, name: n, category: c as any, price: p, flavor: f, recipe: r }); }} 
                                onSaveProduct={handleSaveIceCreamProduct}
                                onDeleteItem={async (id) => { await supabase.from('ice_cream_items').delete().eq('id', id); await fetchData(); }} 
                                onUpdateStock={async (sId, b, v, u, t) => { 
                                    const normalizedBase = String(b || '').trim().toUpperCase();
                                    const { data: currentStockItem } = await supabase.from('ice_cream_stock').select('id, stock_current').eq('store_id', sId).eq('product_base', normalizedBase).single();
                                    
                                    if (currentStockItem) {
                                        const newStockValue = (Number(currentStockItem.stock_current) || 0) + v;
                                        await supabase.from('ice_cream_stock').update({ stock_current: newStockValue }).eq('id', currentStockItem.id);
                                    } else {
                                        if (v > 0) await supabase.from('ice_cream_stock').insert([{ store_id: sId, product_base: normalizedBase, stock_initial: v, stock_current: v, unit: u || 'un' }]);
                                    }
                                    await fetchData(); 
                                }} 
                                liquidatePromissory={async (id) => { await supabase.from('ice_cream_promissory_notes').update({ status: 'paid' }).eq('id', id); await fetchData(); }} 
                            />
                        );
                        return <DashboardAdmin stores={stores} performanceData={performanceData} onImportData={fetchData} />;
                    })()}
                </main>
            </div>
        </div>
    );
};

export default App;
