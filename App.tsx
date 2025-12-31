
import React, { useState, useEffect, useMemo } from 'react';
import { LayoutDashboard, ShoppingBag, Calculator, DollarSign, Instagram, Download, AlertOctagon, FileSignature, LogOut, Menu, Calendar, Settings, X, FileText, UserCog, History, Sliders, Banknote } from 'lucide-react';
import LoginScreen from './components/LoginScreen';
import DashboardAdmin from './components/DashboardAdmin';
import DashboardManager from './components/DashboardManager';
import CotasManagement from './components/CotasManagement';
import GoalRegistration from './components/GoalRegistration';
import AgendaSystem from './components/AgendaSystem';
import FinancialModule from './components/FinancialModule';
import InstagramMarketing from './components/InstagramMarketing';
import DownloadsModule from './components/DownloadsModule';
import SystemAudit from './components/SystemAudit';
import CashErrorsModule from './components/CashErrorsModule';
import AdminSettings from './components/AdminSettings';
import PurchaseAuthorization from './components/PurchaseAuthorization';
import TermoAutorizacao from './components/TermoAutorizacao';
import IceCreamModule from './components/IceCreamModule';
import CashRegisterModule from './components/CashRegisterModule';
import AdminUsersManagement from './components/AdminUsersManagement';
import AccessControlManagement from './components/AccessControlManagement';
import DashboardPurchases from './components/DashboardPurchases';
import { User, Store, MonthlyPerformance, UserRole, Cota, AgendaItem, DownloadItem, SystemLog, CashError, CotaSettings, CotaDebt, IceCreamItem, IceCreamDailySale, IceCreamTransaction, PagePermission, CashRegisterClosure, ProductPerformance, CreditCardSale, Receipt } from './types';
import { supabase } from './services/supabaseClient';

const ICON_MAP: Record<string, React.ElementType> = {
    dashboard: LayoutDashboard,
    purchases: ShoppingBag,
    cotas: Calculator,
    agenda: Calendar,
    financial: DollarSign,
    cash_errors: AlertOctagon,
    marketing: Instagram,
    downloads: Download,
    auth_print: FileSignature,
    termo_print: FileText,
    admin_users: UserCog,
    audit: History,
    settings: Settings,
    icecream: ShoppingBag,
    access_control: Sliders,
    cash_register: Banknote,
    metas_registration: Target
};

import { Target } from 'lucide-react';

interface NavButtonProps {
  view: string;
  icon: React.ElementType;
  label: string;
  active?: boolean;
  onClick?: () => void;
}

const NavButton: React.FC<NavButtonProps> = ({ icon: Icon, label, active, onClick }) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center justify-between px-4 py-3 text-sm font-bold transition-all border-l-4 group ${
      active 
        ? 'bg-blue-800/60 border-red-500 text-white shadow-inner translate-x-1' 
        : 'border-transparent text-blue-100 hover:bg-blue-800/30 hover:text-white hover:translate-x-1'
    }`}
  >
    <div className="flex items-center gap-3">
        <Icon size={18} className={active ? 'text-red-400' : 'text-blue-300 group-hover:text-white'} />
        <span className="uppercase tracking-tight">{label}</span>
    </div>
  </button>
);

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [currentView, setCurrentView] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  const [pagePermissions, setPagePermissions] = useState<PagePermission[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [performanceData, setPerformanceData] = useState<MonthlyPerformance[]>([]);
  const [purchasingData, setPurchasingData] = useState<ProductPerformance[]>([]);
  const [cotas, setCotas] = useState<Cota[]>([]);
  const [cotaSettings, setCotaSettings] = useState<CotaSettings[]>([]); 
  const [cotaDebts, setCotaDebts] = useState<CotaDebt[]>([]); 
  const [iceCreamItems, setIceCreamItems] = useState<IceCreamItem[]>([]);
  const [iceCreamSales, setIceCreamSales] = useState<IceCreamDailySale[]>([]);
  const [iceCreamFinances, setIceCreamFinances] = useState<IceCreamTransaction[]>([]);
  const [cashClosures, setCashClosures] = useState<CashRegisterClosure[]>([]);
  const [tasks, setTasks] = useState<AgendaItem[]>([]);
  const [downloads, setDownloads] = useState<DownloadItem[]>([]);
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [cardSales, setCardSales] = useState<CreditCardSale[]>([]);
  const [cashErrors, setCashErrors] = useState<CashError[]>([]);
  
  const loadAllData = async () => {
      try {
        const { data: dbPerms } = await supabase.from('page_permissions').select('*').order('sort_order', { ascending: true });
        if (dbPerms) setPagePermissions(dbPerms as PagePermission[]);

        const { data: dbStores } = await supabase.from('stores').select('*');
        if (dbStores) setStores(dbStores.map((s: any) => ({ id: s.id, number: s.number, name: s.name, city: s.city, managerName: s.manager_name, managerEmail: s.manager_email, managerPhone: s.manager_phone, status: s.status, role: s.role || UserRole.MANAGER, passwordResetRequested: s.password_reset_requested, password: s.password })));

        // Load Ice Cream Data
        const { data: dbIcItems } = await supabase.from('ice_cream_items').select('*');
        if (dbIcItems) setIceCreamItems(dbIcItems as IceCreamItem[]);

        const { data: dbIcSales } = await supabase.from('ice_cream_daily_sales').select('*').order('created_at', { ascending: false });
        if (dbIcSales) setIceCreamSales(dbIcSales.map((s: any) => ({
            id: s.id, itemId: s.item_id, productName: s.product_name, category: s.category, flavor: s.flavor, ml: s.ml, unitsSold: s.units_sold, unitPrice: Number(s.unit_price), totalValue: Number(s.total_value), paymentMethod: s.payment_method, createdAt: s.created_at
        })));

        const { data: dbIcFinances } = await supabase.from('ice_cream_finances').select('*').order('date', { ascending: false });
        if (dbIcFinances) setIceCreamFinances(dbIcFinances.map((f: any) => ({
            id: f.id, date: f.date, type: f.type, category: f.category, value: Number(f.value), employeeName: f.employee_name, description: f.description, createdAt: new Date(f.created_at)
        })));

        const { data: dbClosures } = await supabase.from('cash_register_closure').select('*').order('created_at', { ascending: false });
        if (dbClosures) setCashClosures(dbClosures.map((c: any) => ({
            id: c.id, storeId: c.store_id, closedBy: c.closed_by, date: c.date, totalSales: Number(c.total_sales), totalExpenses: Number(c.total_expenses), balance: Number(c.balance), notes: c.notes, createdAt: c.created_at
        })));

        // Performance & Cotas
        const { data: dbPerf } = await supabase.from('monthly_performance').select('*');
        if (dbPerf) setPerformanceData(dbPerf.map((p: any) => ({ id: p.id, storeId: p.store_id, month: p.month, revenueTarget: Number(p.revenue_target), revenueActual: Number(p.revenue_actual), itemsTarget: p.items_target, itemsActual: p.items_actual, paTarget: Number(p.pa_target), itemsPerTicket: Number(p.pa_actual), ticketTarget: Number(p.ticket_target), averageTicket: Number(p.ticket_actual), puTarget: Number(p.pu_target), unitPriceAverage: Number(p.pu_actual), delinquencyTarget: Number(p.delinquency_target), delinquencyRate: Number(p.delinquency_actual), percentMeta: p.revenue_target > 0 ? (p.revenue_actual / p.revenue_target) * 100 : 0, trend: 'stable', correctedDailyGoal: 0 })));

        const { data: dbCotas } = await supabase.from('cotas').select('*').order('created_at', { ascending: false });
        if (dbCotas) setCotas(dbCotas.map((c: any) => ({ id: c.id, storeId: c.store_id, brand: c.brand, classification: c.classification, totalValue: Number(c.total_value), shipmentDate: c.shipment_date, paymentTerms: c.payment_terms, pairs: c.pairs, installments: c.installments, createdAt: new Date(c.created_at), createdByRole: c.created_by_role, status: c.status })));

      } catch (error) {
          console.error("Erro ao carregar dados:", error);
      } finally {
          setIsLoading(false);
      }
  };

  // --- HANDLERS (RESUMIDOS PARA O COMPACTO) ---
  const handleAddIcSales = async (newSales: IceCreamDailySale[]) => {
      const payload = newSales.map(s => ({
          item_id: s.itemId, product_name: s.productName, category: s.category, flavor: s.flavor,
          ml: parseInt(s.ml?.replace(/\D/g, '') || '0'), units_sold: Number(s.unitsSold),
          unit_price: Number(s.unitPrice), total_value: Number(s.totalValue),
          payment_method: s.paymentMethod, created_at: new Date().toISOString()
      }));
      const { error } = await supabase.from('ice_cream_daily_sales').insert(payload);
      if (!error) await loadAllData();
  };

  const handleAddCashClosure = async (closure: Partial<CashRegisterClosure>) => {
      const { error } = await supabase.from('cash_register_closure').insert([{
          store_id: user?.storeId, closed_by: user?.name, date: closure.date,
          total_sales: Number(closure.totalSales), total_expenses: Number(closure.totalExpenses),
          balance: Number(closure.balance), notes: closure.notes
      }]);
      if (!error) await loadAllData();
  };

  const allowedPages = useMemo(() => {
    if (!user) return [];
    return pagePermissions.filter(p => {
        if (user.role === UserRole.ADMIN) return p.allow_admin;
        if (user.role === UserRole.MANAGER) return p.allow_manager;
        if (user.role === UserRole.CASHIER) return p.allow_cashier;
        return false;
    });
  }, [user, pagePermissions]);

  const menuGroups = useMemo(() => {
    const grps: Record<string, PagePermission[]> = {};
    allowedPages.forEach(p => {
        if (!grps[p.module_group]) grps[p.module_group] = [];
        grps[p.module_group].push(p);
    });
    return grps;
  }, [allowedPages]);

  const handleLogin = (u: User, rememberMe: boolean) => {
    if (rememberMe) localStorage.setItem('rc_user', JSON.stringify(u));
    else sessionStorage.setItem('rc_user', JSON.stringify(u));
    setUser(u);
    loadAllData();
    if (u.role === UserRole.CASHIER) setCurrentView('icecream');
    else setCurrentView('dashboard');
  };

  useEffect(() => {
    const saved = localStorage.getItem('rc_user') || sessionStorage.getItem('rc_user');
    if (saved) { try { setUser(JSON.parse(saved)); loadAllData(); } catch(e) { localStorage.clear(); } }
  }, []);

  const renderView = () => {
    if (!user) return <LoginScreen onLoginAttempt={async (e, p, r) => {
        const { data } = await supabase.from('admin_users').select('*').eq('email', e).eq('password', p).maybeSingle();
        if (data) { handleLogin({ id: data.id, name: data.name, email: data.email, role: UserRole.ADMIN }, r); return { success: true }; }
        const { data: sData } = await supabase.from('stores').select('*').eq('manager_email', e).eq('password', p).maybeSingle();
        if (sData) { handleLogin({ id: sData.id, name: sData.manager_name, email: sData.manager_email, role: sData.role as UserRole, storeId: sData.id }, r); return { success: true }; }
        return { success: false, error: 'Credenciais inválidas' };
    }} />;

    const currentStore = stores.find(s => s.id === user.storeId);

    // MAPEAMENTO EXAUSTIVO DE ROTAS CONFORME PAGE_PERMISSIONS
    switch (currentView) {
      case 'dashboard':
        return user.role === UserRole.MANAGER 
          ? <DashboardManager user={user} stores={stores} performanceData={performanceData} purchasingData={purchasingData} />
          : <DashboardAdmin stores={stores} performanceData={performanceData} onImportData={async (d) => { await supabase.from('monthly_performance').upsert(d.map(item => ({ store_id: item.storeId, month: item.month, revenue_target: item.revenueTarget, revenue_actual: item.revenueActual, items_actual: item.itemsActual, pa_actual: item.itemsPerTicket, ticket_actual: item.averageTicket, pu_actual: item.unitPriceAverage, delinquency_actual: item.delinquencyRate }))); await loadAllData(); }} />;
      
      case 'metas_registration':
        return <GoalRegistration stores={stores} performanceData={performanceData} onUpdateData={async (d) => { await supabase.from('monthly_performance').upsert(d.map(i => ({ store_id: i.storeId, month: i.month, revenue_target: i.revenueTarget, revenue_actual: i.revenueActual, items_target: i.itemsTarget, items_actual: i.itemsActual, pa_target: i.paTarget, pa_actual: i.itemsPerTicket, ticket_target: i.ticketTarget, ticket_actual: i.averageTicket, pu_target: i.puTarget, pu_actual: i.unitPriceAverage, delinquency_target: i.delinquencyTarget, delinquency_actual: i.delinquencyRate, business_days: i.businessDays }))); await loadAllData(); }} />;
      
      case 'purchases':
        return <DashboardPurchases stores={stores} data={purchasingData} onImport={async (d) => { await loadAllData(); }} />;
      
      case 'cotas':
        return <CotasManagement user={user} stores={stores} cotas={cotas} cotaSettings={cotaSettings} cotaDebts={cotaDebts} onAddCota={async (c) => { await supabase.from('cotas').insert([{ store_id: c.storeId, brand: c.brand, classification: c.classification, total_value: c.totalValue, shipment_date: c.shipmentDate, payment_terms: c.paymentTerms, pairs: c.pairs, installments: c.installments, created_by_role: c.createdByRole, status: c.status }]); await loadAllData(); }} onDeleteCota={async (id) => { await supabase.from('cotas').delete().eq('id', id); await loadAllData(); }} onSaveSettings={async (s) => { await supabase.from('cota_settings').upsert({ store_id: s.storeId, budget_value: s.budgetValue, manager_percent: s.managerPercent }); await loadAllData(); }} onSaveDebts={async (sid, d) => { for(const [m, v] of Object.entries(d)) { await supabase.from('cota_debts').upsert({ store_id: sid, month: m, value: v }, { onConflict: 'store_id,month' }); } await loadAllData(); }} />;
      
      case 'icecream':
        return <IceCreamModule user={user} items={iceCreamItems} sales={iceCreamSales} finances={iceCreamFinances} onAddSales={handleAddIcSales} onUpdatePrice={async () => {}} onUpdateItem={async (i) => { await supabase.from('ice_cream_items').update({ name: i.name, category: i.category, price: i.price, flavor: i.flavor, active: i.active }).eq('id', i.id); await loadAllData(); }} onAddTransaction={async (t) => { await supabase.from('ice_cream_finances').insert([{ date: t.date, type: t.type, category: t.category, value: t.value, employee_name: t.employeeName, description: t.description }]); await loadAllData(); }} onDeleteTransaction={async (id) => { await supabase.from('ice_cream_finances').delete().eq('id', id); await loadAllData(); }} onAddItem={async (n, c, p, f) => { await supabase.from('ice_cream_items').insert([{ name: n, category: c, price: p, flavor: f, active: true }]); await loadAllData(); }} onDeleteItem={async (id) => { await supabase.from('ice_cream_items').delete().eq('id', id); await loadAllData(); }} />;
      
      case 'cash_register':
        return <CashRegisterModule user={user} sales={iceCreamSales} finances={iceCreamFinances} closures={cashClosures} onAddClosure={handleAddCashClosure} />;
      
      case 'agenda':
        return <AgendaSystem user={user} tasks={tasks} onAddTask={async (t) => { await supabase.from('agenda_items').insert([{ user_id: t.userId, title: t.title, description: t.description, due_date: t.dueDate, priority: t.priority, is_completed: false }]); await loadAllData(); }} onUpdateTask={async (t) => { await supabase.from('agenda_items').update({ title: t.title, description: t.description, due_date: t.dueDate, priority: t.priority, is_completed: t.isCompleted }).eq('id', t.id); await loadAllData(); }} onDeleteTask={async (id) => { await supabase.from('agenda_items').delete().eq('id', id); await loadAllData(); }} />;
      
      case 'financial':
        return <FinancialModule user={user} store={currentStore} sales={cardSales} receipts={receipts} onAddSale={async (s) => { await supabase.from('card_sales').insert([{ store_id: s.storeId, user_id: s.userId, date: s.date, brand: s.brand, value: s.value }]); await loadAllData(); }} onDeleteSale={async (id) => { await supabase.from('card_sales').delete().eq('id', id); await loadAllData(); }} onAddReceipt={async (r) => { await supabase.from('receipts').insert([{ store_id: r.storeId, issuer_name: r.issuerName, payer: r.payer, recipient: r.recipient, value: r.value, reference: r.reference, date: r.date }]); await loadAllData(); }} />;
      
      case 'cash_errors':
        return <CashErrorsModule user={user} store={currentStore} stores={stores} errors={cashErrors} onAddError={async (e) => { await supabase.from('cash_errors').insert([{ store_id: e.storeId, user_id: e.userId, user_name: e.userName, date: e.date, type: e.type, value: e.value, reason: e.reason }]); await loadAllData(); }} onUpdateError={async (e) => { await supabase.from('cash_errors').update({ date: e.date, type: e.type, value: e.value, reason: e.reason }).eq('id', e.id); await loadAllData(); }} onDeleteError={async (id) => { await supabase.from('cash_errors').delete().eq('id', id); await loadAllData(); }} />;
      
      case 'marketing':
        return <InstagramMarketing user={user} store={currentStore} />;
      
      case 'downloads':
        return <DownloadsModule user={user} items={downloads} onUpload={async (i) => { await supabase.from('downloads').insert([{ title: i.title, description: i.description, category: i.category, url: i.url, file_name: i.fileName, size: i.size, campaign: i.campaign, created_by: i.createdBy }]); await loadAllData(); }} onDelete={async (id) => { await supabase.from('downloads').delete().eq('id', id); await loadAllData(); }} />;
      
      case 'auth_print':
        return <PurchaseAuthorization />;
      
      case 'termo_print':
        return <TermoAutorizacao user={user} store={currentStore} />;
      
      case 'admin_users':
        return <AdminUsersManagement currentUser={user} />;
      
      case 'audit':
        return <SystemAudit logs={logs} receipts={receipts} store={currentStore} cashErrors={cashErrors} />;
      
      case 'settings':
        return <AdminSettings stores={stores} onAddStore={async (s) => { await supabase.from('stores').insert([{ number: s.number, name: s.name, city: s.city, manager_name: s.managerName, manager_email: s.managerEmail, manager_phone: s.managerPhone, password: s.password, status: s.status, role: s.role }]); await loadAllData(); }} onUpdateStore={async (s) => { await supabase.from('stores').update({ number: s.number, name: s.name, city: s.city, manager_name: s.managerName, manager_email: s.managerEmail, manager_phone: s.managerPhone, status: s.status, role: s.role }).eq('id', s.id); await loadAllData(); }} onDeleteStore={async (id) => { await supabase.from('stores').delete().eq('id', id); await loadAllData(); }} onImportStores={async (ss) => { await supabase.from('stores').upsert(ss.map(s => ({ number: s.number, name: s.name, city: s.city, manager_name: s.managerName, manager_email: s.managerEmail, manager_phone: s.managerPhone, status: 'active', role: UserRole.MANAGER })), { onConflict: 'number' }); await loadAllData(); }} />;
      
      case 'access_control':
        return <AccessControlManagement />;

      default:
        return <div className="p-10 text-gray-500 font-bold uppercase tracking-widest text-center">Acesso restrito ou funcionalidade em desenvolvimento.</div>;
    }
  };

  return (
    <div className="flex h-screen bg-gray-100 font-sans overflow-hidden">
      {user && (
      <>
        <header className="fixed top-0 border-gray-200 left-0 right-0 h-16 bg-white border-b z-[60] flex items-center justify-between px-6 shadow-sm">
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full overflow-hidden border border-gray-200 bg-white">
                    <img src="/branding/logo-real.png" alt="Logo" className="w-full h-full object-cover" />
                </div>
                <div className="hidden md:block">
                   <span className="font-black italic text-blue-950 tracking-tighter uppercase leading-none text-xl">REAL <span className="text-red-600">ADMIN</span></span>
                   <p className="text-[7px] text-gray-400 font-black uppercase tracking-widest mt-0.5">ESTRATÉGIA & OPERAÇÃO</p>
                </div>
                <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="md:hidden p-2 text-gray-600"><Menu size={24} /></button>
            </div>
            <div className="flex items-center gap-4">
                <div className="px-4 py-1.5 bg-gray-50 rounded-full border border-gray-100 flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center font-bold text-xs text-white uppercase">{user.name.charAt(0)}</div>
                    <div className="text-left hidden sm:block">
                        <p className="text-[10px] font-black uppercase text-gray-900 leading-none">{user.name}</p>
                        <p className="text-[8px] font-bold text-blue-400 uppercase italic">{user.role}</p>
                    </div>
                </div>
                <button onClick={() => { localStorage.clear(); sessionStorage.clear(); window.location.reload(); }} className="p-2.5 text-gray-400 hover:text-red-600 transition-all"><LogOut size={20}/></button>
            </div>
        </header>

        <div className={`fixed md:sticky top-16 left-0 h-[calc(100vh-64px)] w-64 bg-gradient-to-b from-blue-950 to-blue-900 text-white shadow-2xl z-50 transition-transform duration-300 border-r border-blue-800 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
            <div className="p-6 flex flex-col h-full">
            <nav className="flex-1 space-y-1 overflow-y-auto no-scrollbar pr-1 pt-4">
                {Object.entries(menuGroups).map(([groupName, items]) => (
                    <div key={groupName} className="mb-4">
                        <div className="px-4 py-2 text-[10px] font-black uppercase tracking-widest text-blue-400 opacity-50">{groupName}</div>
                        {(items as PagePermission[]).map(item => (
                            <NavButton key={item.page_key} view={item.page_key} icon={ICON_MAP[item.page_key] || LayoutDashboard} label={item.label} active={currentView === item.page_key} onClick={() => { setCurrentView(item.page_key); setIsSidebarOpen(false); }} />
                        ))}
                    </div>
                ))}
            </nav>
            </div>
        </div>
      </>
      )}

      <div className="flex-1 flex flex-col h-screen overflow-hidden">
         <main className={`flex-1 overflow-auto relative scroll-smooth no-scrollbar ${user ? 'pt-16' : ''}`}>
            {renderView()}
         </main>
      </div>
    </div>
  );
};

export default App;
