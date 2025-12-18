
import React, { useState, useEffect, useMemo } from 'react';
import { LayoutDashboard, ShoppingBag, Target, Calculator, DollarSign, Instagram, Download, Shield, AlertOctagon, FileSignature, LogOut, Menu, Users, Calendar, Settings, X, Camera, User as UserIcon, FileText, IceCream, UserCog, History, ShieldAlert, Sliders } from 'lucide-react';
import LoginScreen from './components/LoginScreen';
import DashboardAdmin from './components/DashboardAdmin';
import DashboardManager from './components/DashboardManager';
import DashboardPurchases from './components/DashboardPurchases';
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
import AdminUsersManagement from './components/AdminUsersManagement';
import AccessControlManagement from './components/AccessControlManagement';
import { User, Store, MonthlyPerformance, UserRole, ProductPerformance, Cota, AgendaItem, DownloadItem, SystemLog, CashError, CreditCardSale, Receipt, CotaSettings, CotaDebt, IceCreamItem, IceCreamDailySale, IceCreamTransaction, IceCreamCategory, AdminUser, PagePermission } from './types';
import { supabase } from './services/supabaseClient';

// Mapeamento de ícones para Escalabilidade
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
    icecream: IceCream,
    access_control: Sliders
};

interface NavButtonProps {
  view: string;
  icon: React.ElementType;
  label: string;
  active?: boolean;
  onClick?: () => void;
  badge?: string;
}

const NavButton: React.FC<NavButtonProps> = ({ view, icon: Icon, label, active, onClick, badge }) => (
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
    {badge && <span className="bg-red-600 text-white text-[9px] px-1.5 py-0.5 rounded-full font-black animate-pulse">{badge}</span>}
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
  const [productData, setProductData] = useState<ProductPerformance[]>([]);
  const [cotas, setCotas] = useState<Cota[]>([]);
  const [cotaSettings, setCotaSettings] = useState<CotaSettings[]>([]); 
  const [cotaDebts, setCotaDebts] = useState<CotaDebt[]>([]); 
  const [tasks, setTasks] = useState<AgendaItem[]>([]);
  const [downloads, setDownloadItems] = useState<DownloadItem[]>([]);
  const [cashErrors, setCashErrors] = useState<CashError[]>([]);
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [creditCardSales, setCreditCardSales] = useState<CreditCardSale[]>([]);
  const [receipts, setReceipts] = useState<Receipt[]>([]);

  // Ice Cream States
  const [iceCreamItems, setIceCreamItems] = useState<IceCreamItem[]>([]);
  const [iceCreamSales, setIceCreamSales] = useState<IceCreamDailySale[]>([]);
  const [iceCreamFinances, setIceCreamFinances] = useState<IceCreamTransaction[]>([]);
  
  const loadAllData = async () => {
      try {
        // Carrega Permissões primeiro para escalabilidade do menu
        const { data: dbPerms } = await supabase.from('page_permissions').select('*').order('sort_order', { ascending: true });
        if (dbPerms) setPagePermissions(dbPerms as PagePermission[]);

        const { data: dbStores } = await supabase.from('stores').select('*');
        if (dbStores) setStores(dbStores.map((s: any) => ({ id: s.id, number: s.number, name: s.name, city: s.city, managerName: s.manager_name, managerEmail: s.manager_email, managerPhone: s.manager_phone, status: s.status, role: s.role || UserRole.MANAGER, passwordResetRequested: s.password_reset_requested, password: s.password })));

        const { data: dbPerf } = await supabase.from('monthly_performance').select('*').order('month', { ascending: false });
        if (dbPerf) {
            setPerformanceData(dbPerf.map((p: any) => ({ 
                id: p.id, storeId: p.store_id, month: p.month, revenueTarget: Number(p.revenue_target || 0), revenueActual: Number(p.revenue_actual || 0), itemsTarget: Number(p.items_target || 0), itemsActual: Number(p.items_actual || 0), paTarget: Number(p.pa_target || 0), ticketTarget: Number(p.ticket_target || 0), puTarget: Number(p.pu_target || 0), delinquencyTarget: Number(p.delinquency_target || 0), itemsPerTicket: Number(p.pa_actual || 0), averageTicket: Number(p.ticket_actual || 0), unitPriceAverage: Number(p.pu_actual || 0), delinquencyRate: Number(p.delinquency_actual || 0), percentMeta: p.revenue_target > 0 ? (p.revenue_actual / p.revenue_target) * 100 : 0, trend: 'stable', correctedDailyGoal: 0 
            })));
        }

        const { data: dbIceItems } = await supabase.from('products').select('*').order('name', { ascending: true });
        if (dbIceItems) setIceCreamItems(dbIceItems.map((i: any) => ({ id: String(i.id), name: String(i.name || 'Sem nome'), price: Number(i.price || 0), flavor: String(i.flavor || ''), category: (i.category || 'Milkshake') as IceCreamCategory, active: i.active ?? true })));

        const { data: dbIceSales } = await supabase.from('ice_cream_daily_sales').select('*').order('created_at', { ascending: false });
        if (dbIceSales) setIceCreamSales(dbIceSales.map((s: any) => ({ id: String(s.id), itemId: String(s.item_id), productName: String(s.product_name || ''), category: String(s.category || ''), flavor: String(s.flavor || ''), unitsSold: Number(s.units_sold), unitPrice: Number(s.unit_price || 0), totalValue: Number(s.total_value || 0), paymentMethod: s.payment_method, createdAt: s.created_at })));

        const { data: dbIceFinances } = await supabase.from('ice_cream_finances').select('*').order('date', { ascending: false });
        if (dbIceFinances) setIceCreamFinances(dbIceFinances.map((f: any) => ({ id: String(f.id), date: f.date, type: f.type, category: f.category, value: Number(f.value), employeeName: f.employee_name || '', description: f.description, createdAt: new Date(f.created_at) })));

      } catch (error) {
          console.error("Erro ao carregar dados:", error);
      } finally {
          setIsLoading(false);
      }
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

  const handleUpdateGoals = async (data: MonthlyPerformance[]) => {
      try {
          const payload = data.map(item => ({ store_id: item.storeId, month: item.month, revenue_target: item.revenueTarget, revenue_actual: item.revenueActual, items_target: item.itemsTarget, items_actual: item.itemsActual, pa_target: item.paTarget, pa_actual: item.itemsPerTicket, ticket_target: item.ticketTarget, ticket_actual: item.averageTicket, pu_target: item.puTarget, pu_actual: item.unitPriceAverage, delinquency_target: item.delinquencyTarget, delinquency_actual: item.delinquencyRate }));
          const { error } = await supabase.from('monthly_performance').upsert(payload, { onConflict: 'store_id,month' });
          if (error) throw new Error(error.message);
          await loadAllData();
      } catch (err: any) {
          console.error("Erro ao salvar metas:", err.message);
          throw err;
      }
  };

  const authenticateUser = async (email: string, password: string): Promise<{ success: boolean; user?: User; error?: string }> => {
      try {
          const cleanEmail = email.trim().toLowerCase();
          const { data: adminUser } = await supabase.from('admin_users').select('*').eq('email', cleanEmail).eq('password', password).eq('status', 'active').maybeSingle();
          if (adminUser) {
              await supabase.from('admin_users').update({ last_activity: new Date().toISOString() }).eq('id', adminUser.id);
              const u: User = { id: adminUser.id, name: adminUser.name, email: adminUser.email, role: UserRole.ADMIN, storeId: '' };
              handleLogin(u);
              return { success: true, user: u };
          }
          const { data: storeUser } = await supabase.from('stores').select('*').eq('manager_email', cleanEmail).eq('password', password).maybeSingle();
          if (storeUser) {
              const authenticatedUser: User = { id: storeUser.id, name: storeUser.manager_name, email: storeUser.manager_email, role: storeUser.role as UserRole || UserRole.MANAGER, storeId: storeUser.id };
              handleLogin(authenticatedUser);
              return { success: true, user: authenticatedUser };
          }
          return { success: false, error: 'E-mail ou senha incorretos.' };
      } catch (err) {
          return { success: false, error: 'Erro ao conectar ao servidor.' };
      }
  };

  const handleLogin = (u: User) => {
    localStorage.setItem('rc_user', JSON.stringify(u));
    setUser(u);
    loadAllData();
    if (u.role === UserRole.CASHIER) setCurrentView('agenda');
    else setCurrentView('dashboard');
  };

  const handleLogout = () => {
    localStorage.removeItem('rc_user');
    setUser(null);
    setCurrentView('dashboard');
  };

  useEffect(() => {
    const savedUser = localStorage.getItem('rc_user');
    if (savedUser) { try { const parsedUser = JSON.parse(savedUser); setUser(parsedUser); } catch (e) { localStorage.removeItem('rc_user'); } }
    loadAllData();
    const handleViewChange = (e: any) => setCurrentView(e.detail);
    window.addEventListener('changeView', handleViewChange);
    return () => window.removeEventListener('changeView', handleViewChange);
  }, []);

  const renderView = () => {
    if (!user) return <LoginScreen onLoginAttempt={authenticateUser} />;

    switch (currentView) {
      case 'dashboard':
        return user.role === UserRole.MANAGER 
          ? <DashboardManager user={user} stores={stores} performanceData={performanceData} purchasingData={productData} />
          : <DashboardAdmin stores={stores} performanceData={performanceData} onImportData={async (d) => { await handleUpdateGoals(d); }} onSaveGoals={handleUpdateGoals} />;
      case 'metas_registration':
        return <GoalRegistration stores={stores} performanceData={performanceData} onUpdateData={handleUpdateGoals} />;
      case 'purchases':
        return <DashboardPurchases stores={stores} data={productData} onImport={async (d) => { await supabase.from('product_performance').upsert(d.map(item => ({ store_id: item.storeId, month: item.month, brand: item.brand, category: item.category, pairs_sold: item.pairsSold, revenue: item.revenue }))); await loadAllData(); }} />;
      case 'cotas':
        return <CotasManagement user={user} stores={stores} cotas={cotas} cotaSettings={cotaSettings} cotaDebts={cotaDebts} onAddCota={async (c) => { await supabase.from('cotas').insert({ store_id: c.storeId, brand: c.brand, classification: c.classification, total_value: c.totalValue, shipment_date: c.shipmentDate, payment_terms: c.paymentTerms, pairs: c.pairs, installments: c.installments, created_by_role: c.createdByRole }); await loadAllData(); }} onDeleteCota={async (id) => { await supabase.from('cotas').delete().eq('id', id); await loadAllData(); }} onSaveSettings={async (s) => { await supabase.from('cota_settings').upsert({ store_id: s.storeId, budget_value: s.budgetValue, manager_percent: s.managerPercent }); await loadAllData(); }} onSaveDebts={async (id, d) => { const payload = Object.entries(d).map(([month, value]) => ({ store_id: id, month, value })); await supabase.from('cota_debts').delete().eq('store_id', id); await supabase.from('cota_debts').insert(payload); await loadAllData(); }} />;
      case 'agenda':
        return <AgendaSystem user={user} tasks={tasks} onAddTask={async (t) => { await supabase.from('agenda_tasks').insert({ user_id: t.userId, title: t.title, description: t.description, due_date: t.dueDate, priority: t.priority }); await loadAllData(); }} onUpdateTask={async (t) => { await supabase.from('agenda_tasks').update({ title: t.title, description: t.description, due_date: t.dueDate, priority: t.priority, is_completed: t.isCompleted }).eq('id', t.id); await loadAllData(); }} onDeleteTask={async (id) => { await supabase.from('agenda_tasks').delete().eq('id', id); await loadAllData(); }} />;
      case 'financial':
        return <FinancialModule user={user} store={stores.find(s => s.id === user.storeId)} sales={creditCardSales} receipts={receipts} onAddSale={async (s) => { await supabase.from('credit_card_sales').insert({ store_id: s.storeId, user_id: s.userId, date: s.date, brand: s.brand, value: s.value }); await loadAllData(); }} onDeleteSale={async (id) => { await supabase.from('credit_card_sales').delete().eq('id', id); await loadAllData(); }} onAddReceipt={async (r) => { await supabase.from('receipts').insert({ store_id: r.storeId, issuer_name: r.issuerName, payer: r.payer, recipient: r.recipient, value: r.value, value_in_words: r.valueInWords, reference: r.reference, date: r.date }); await loadAllData(); }} />;
      case 'marketing':
        return <InstagramMarketing user={user} store={stores.find(s => s.id === user.storeId)} />;
      case 'downloads':
        return <DownloadsModule user={user} items={downloads} onUpload={async (i) => { await supabase.from('downloads').insert({ title: i.title, description: i.description, category: i.category, url: i.url, file_name: i.fileName, size: i.size, campaign: i.campaign, created_by: i.createdBy }); await loadAllData(); }} onDelete={async (id) => { await supabase.from('downloads').delete().eq('id', id); await loadAllData(); }} />;
      case 'cash_errors':
        return <CashErrorsModule user={user} store={stores.find(s => s.id === user.storeId)} stores={stores} errors={cashErrors} onAddError={async (e) => { await supabase.from('cash_errors').insert({ store_id: e.storeId, user_id: e.userId, user_name: e.userName, date: e.date, type: e.type, value: e.value, reason: e.reason }); await loadAllData(); }} onUpdateError={async (e) => { await supabase.from('cash_errors').update({ date: e.date, type: e.type, value: e.value, reason: e.reason }).eq('id', e.id); await loadAllData(); }} onDeleteError={async (id) => { await supabase.from('cash_errors').delete().eq('id', id); await loadAllData(); }} />;
      case 'icecream':
        return <IceCreamModule items={iceCreamItems} sales={iceCreamSales} finances={iceCreamFinances} onAddSales={async (s) => { await supabase.from('ice_cream_daily_sales').insert(s); await loadAllData(); }} onUpdatePrice={async (id, p) => { await supabase.from('products').update({ price: p }).eq('id', id); await loadAllData(); }} onUpdateItem={async (i) => { await supabase.from('products').update(i).eq('id', i.id); await loadAllData(); }} onAddTransaction={async (tx) => { await supabase.from('ice_cream_finances').insert({ date: tx.date, type: tx.type, category: tx.category, value: tx.value, employee_name: tx.employeeName, description: tx.description }); await loadAllData(); }} onDeleteTransaction={async (id) => { await supabase.from('ice_cream_finances').delete().eq('id', id); await loadAllData(); }} onAddItem={async (n, c, p, f) => { await supabase.from('products').insert({ name: n, category: c, price: p, flavor: f }); await loadAllData(); }} onDeleteItem={async (id) => { await supabase.from('products').delete().eq('id', id); await loadAllData(); }} />;
      case 'admin_users':
          return <AdminUsersManagement currentUser={user} />;
      case 'audit':
        return <SystemAudit logs={logs} receipts={receipts} cashErrors={cashErrors} />;
      case 'auth_print':
        return <PurchaseAuthorization />;
      case 'termo_print':
        return <TermoAutorizacao user={user} store={stores.find(s => s.id === user.storeId)} />;
      case 'settings':
        return <AdminSettings stores={stores} onAddStore={async (s) => { await supabase.from('stores').insert({ number: s.number, name: s.name, city: s.city, manager_name: s.managerName, manager_email: s.managerEmail, manager_phone: s.managerPhone, password: s.password, status: s.status, role: s.role }); await loadAllData(); }} onUpdateStore={async (s) => { await supabase.from('stores').update({ number: s.number, name: s.name, city: s.city, manager_name: s.managerName, manager_email: s.managerEmail, manager_phone: s.managerPhone, password: s.password, status: s.status, role: s.role }).eq('id', s.id); await loadAllData(); }} onDeleteStore={async (id) => { await supabase.from('stores').delete().eq('id', id); await loadAllData(); }} />;
      case 'access_control':
        return <AccessControlManagement />;
      default:
        return <div className="p-10">Página não encontrada</div>;
    }
  };

  return (
    <div className="flex h-screen bg-gray-100 font-sans overflow-hidden">
      {user && (
      <div className={`fixed md:sticky top-0 left-0 h-screen w-64 bg-gradient-to-b from-blue-950 to-blue-900 text-white shadow-2xl z-50 transition-transform duration-300 border-r border-blue-800 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        <div className="p-6 flex flex-col h-full">
          <div className="flex items-center gap-3 mb-8 pb-6 border-b border-blue-800/50">
             <div className="relative">
                <div className="w-10 h-10 bg-red-600 rounded-xl flex items-center justify-center font-black text-xl italic shadow-lg rotate-3 tracking-tighter">R</div>
                <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 border-2 border-blue-950 rounded-full"></div>
             </div>
             <div>
                <h1 className="text-xl font-black italic tracking-tighter leading-none uppercase">REAL <span className="text-red-600">ADMIN</span></h1>
                <p className="text-[9px] text-blue-300 uppercase tracking-widest font-black mt-1">Ecosystem v2.0</p>
             </div>
             <button className="md:hidden ml-auto text-blue-300" onClick={() => setIsSidebarOpen(false)}><X size={20}/></button>
          </div>

          <nav className="flex-1 space-y-1 overflow-y-auto no-scrollbar pr-1">
            {Object.entries(menuGroups).map(([groupName, items]) => (
                <div key={groupName} className="mb-4">
                    <div className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest opacity-50 ${groupName === 'Administração' ? 'text-red-400 opacity-80' : 'text-blue-400'}`}>
                        {groupName}
                    </div>
                    {items.map(item => (
                        <NavButton 
                            key={item.page_key}
                            view={item.page_key} 
                            icon={ICON_MAP[item.page_key] || LayoutDashboard} 
                            label={item.label.split('(')[0]} 
                            active={currentView === item.page_key} 
                            onClick={() => { setCurrentView(item.page_key); setIsSidebarOpen(false); }} 
                        />
                    ))}
                </div>
            ))}
          </nav>

          <div className="pt-4 mt-4 border-t border-blue-800">
            <div className="flex items-center gap-3 px-4 py-4 bg-black/20 rounded-2xl mb-4">
                <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center font-bold text-xs uppercase shadow-inner border border-blue-400">{user.name.charAt(0)}</div>
                <div className="flex-1 overflow-hidden">
                    <p className="text-[10px] font-black uppercase truncate leading-none">{user.name}</p>
                    <p className="text-[8px] font-bold text-blue-400 uppercase mt-1 tracking-tighter italic">{user.role}</p>
                </div>
            </div>
            <button onClick={handleLogout} className="w-full flex items-center justify-center gap-2 py-3 bg-red-600/10 text-red-500 hover:bg-red-600 hover:text-white rounded-xl transition-all text-[10px] font-black uppercase tracking-widest border border-red-600/20"><LogOut size={14} /> Sair do Sistema</button>
          </div>
        </div>
      </div>
      )}

      <div className="flex-1 flex flex-col h-screen overflow-hidden bg-gray-100">
         {user && (
         <div className="md:hidden bg-white shadow-md p-4 flex justify-between items-center z-40 border-b border-gray-200">
            <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-red-600 rounded-lg flex items-center justify-center font-black text-white italic">R</div>
                <h1 className="text-lg font-black italic text-blue-900 tracking-tighter uppercase">REAL <span className="text-red-600 font-black">ADMIN</span></h1>
            </div>
            <button onClick={() => setIsSidebarOpen(true)} className="p-2 bg-gray-50 rounded-lg text-blue-900 shadow-sm border border-gray-100"><Menu size={20}/></button>
         </div>
         )}
         <main className="flex-1 overflow-auto relative scroll-smooth no-scrollbar">{renderView()}</main>
      </div>
    </div>
  );
};

export default App;
