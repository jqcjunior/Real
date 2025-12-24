
import React, { useState, useEffect, useMemo } from 'react';
import { LayoutDashboard, ShoppingBag, Calculator, DollarSign, Instagram, Download, AlertOctagon, FileSignature, LogOut, Menu, Calendar, Settings, X, FileText, UserCog, History, Sliders } from 'lucide-react';
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
import AdminUsersManagement from './components/AdminUsersManagement';
import AccessControlManagement from './components/AccessControlManagement';
import { User, Store, MonthlyPerformance, UserRole, Cota, AgendaItem, DownloadItem, SystemLog, CashError, CreditCardSale, Receipt, CotaSettings, CotaDebt, IceCreamItem, IceCreamDailySale, IceCreamTransaction, PagePermission } from './types';
import { supabase } from './services/supabaseClient';
import { BRAND_LOGO } from './constants';

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
    access_control: Sliders
};

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
  const [cotas, setCotas] = useState<Cota[]>([]);
  const [cotaSettings, setCotaSettings] = useState<CotaSettings[]>([]); 
  const [cotaDebts, setCotaDebts] = useState<CotaDebt[]>([]); 
  const [tasks, setTask] = useState<AgendaItem[]>([]);
  const [downloads, setDownloadItems] = useState<DownloadItem[]>([]);
  const [cashErrors, setCashErrors] = useState<CashError[]>([]);
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [creditCardSales, setCreditCardSales] = useState<CreditCardSale[]>([]);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [iceCreamItems, setIceCreamItems] = useState<IceCreamItem[]>([]);
  const [iceCreamSales, setIceCreamSales] = useState<IceCreamDailySale[]>([]);
  const [iceCreamFinances, setIceCreamFinances] = useState<IceCreamTransaction[]>([]);
  
  const loadAllData = async () => {
      try {
        const { data: dbPerms } = await supabase.from('page_permissions').select('*').order('sort_order', { ascending: true });
        if (dbPerms) setPagePermissions(dbPerms as PagePermission[]);

        const { data: dbStores } = await supabase.from('stores').select('*');
        if (dbStores) setStores(dbStores.map((s: any) => ({ id: s.id, number: s.number, name: s.name, city: s.city, managerName: s.manager_name, managerEmail: s.manager_email, managerPhone: s.manager_phone, status: s.status, role: s.role || UserRole.MANAGER, passwordResetRequested: s.password_reset_requested, password: s.password })));

        const { data: dbPerf } = await supabase.from('monthly_performance').select('*').order('month', { ascending: false });
        if (dbPerf) {
            setPerformanceData(dbPerf.map((p: any) => ({ 
                id: p.id, storeId: p.store_id, month: p.month, revenueTarget: Number(p.revenue_target || 0), revenueActual: Number(p.revenue_actual || 0), itemsTarget: Number(p.items_target || 0), itemsActual: Number(p.items_actual || 0), paTarget: Number(p.pa_target || 0), itemsPerTicket: Number(p.pa_actual || 0), ticketTarget: Number(p.ticket_target || 0), averageTicket: Number(p.ticket_actual || 0), puTarget: Number(p.pu_target || 0), unitPriceAverage: Number(p.pu_actual || 0), delinquencyTarget: Number(p.delinquency_target || 0), delinquencyRate: Number(p.delinquency_actual || 0), percentMeta: p.revenue_target > 0 ? (p.revenue_actual / p.revenue_target) * 100 : 0, trend: 'stable', correctedDailyGoal: 0 
            })));
        }
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

  const authenticateUser = async (email: string, password: string, rememberMe: boolean): Promise<{ success: boolean; user?: User; error?: string }> => {
      try {
          const cleanEmail = email.trim().toLowerCase();
          const { data: adminUser } = await supabase.from('admin_users').select('*').eq('email', cleanEmail).eq('password', password).eq('status', 'active').maybeSingle();
          if (adminUser) {
              const u: User = { id: adminUser.id, name: adminUser.name, email: adminUser.email, role: UserRole.ADMIN, storeId: '' };
              handleLogin(u, rememberMe);
              return { success: true, user: u };
          }
          const { data: storeUser } = await supabase.from('stores').select('*').eq('manager_email', cleanEmail).eq('password', password).maybeSingle();
          if (storeUser) {
              const authenticatedUser: User = { id: storeUser.id, name: storeUser.manager_name, email: storeUser.manager_email, role: storeUser.role as UserRole || UserRole.MANAGER, storeId: storeUser.id };
              handleLogin(authenticatedUser, rememberMe);
              return { success: true, user: authenticatedUser };
          }
          return { success: false, error: 'E-mail ou senha incorretos.' };
      } catch (err) {
          return { success: false, error: 'Erro ao conectar ao servidor.' };
      }
  };

  const handleLogin = (u: User, rememberMe: boolean) => {
    if (rememberMe) {
        localStorage.setItem('rc_user', JSON.stringify(u));
        sessionStorage.removeItem('rc_user');
    } else {
        sessionStorage.setItem('rc_user', JSON.stringify(u));
        localStorage.removeItem('rc_user');
    }
    setUser(u);
    loadAllData();
    if (u.role === UserRole.CASHIER) setCurrentView('agenda');
    else setCurrentView('dashboard');
  };

  const handleLogout = () => {
    localStorage.removeItem('rc_user');
    sessionStorage.removeItem('rc_user');
    setUser(null);
    setCurrentView('dashboard');
  };

  useEffect(() => {
    const savedLocal = localStorage.getItem('rc_user');
    const savedSession = sessionStorage.getItem('rc_user');
    const savedUser = savedLocal || savedSession;
    if (savedUser) { 
        try { 
            const parsedUser = JSON.parse(savedUser); 
            setUser(parsedUser); 
            loadAllData();
        } catch (e) { 
            localStorage.removeItem('rc_user'); 
            sessionStorage.removeItem('rc_user');
        } 
    }
  }, []);

  const renderView = () => {
    if (!user) return <LoginScreen onLoginAttempt={authenticateUser} />;

    switch (currentView) {
      case 'dashboard':
        return user.role === UserRole.MANAGER 
          ? <DashboardManager user={user} stores={stores} performanceData={performanceData} purchasingData={[]} />
          : <DashboardAdmin stores={stores} performanceData={performanceData} onImportData={async () => {}} />;
      case 'metas_registration':
        return <GoalRegistration stores={stores} performanceData={performanceData} onUpdateData={async () => {}} />;
      case 'cotas':
        return <CotasManagement user={user} stores={stores} cotas={cotas} cotaSettings={cotaSettings} cotaDebts={cotaDebts} onAddCota={async () => {}} onDeleteCota={async () => {}} onSaveSettings={async () => {}} onSaveDebts={async () => {}} />;
      case 'agenda':
        return <AgendaSystem user={user} tasks={tasks} onAddTask={async () => {}} onUpdateTask={async () => {}} onDeleteTask={async () => {}} />;
      case 'financial':
        return <FinancialModule user={user} store={stores.find(s => s.id === user.storeId)} sales={creditCardSales} receipts={receipts} onAddSale={async () => {}} onDeleteSale={async () => {}} onAddReceipt={async () => {}} />;
      case 'marketing':
        return <InstagramMarketing user={user} store={stores.find(s => s.id === user.storeId)} />;
      case 'downloads':
        return <DownloadsModule user={user} items={downloads} onUpload={async () => {}} onDelete={async () => {}} />;
      case 'cash_errors':
        return <CashErrorsModule user={user} store={stores.find(s => s.id === user.storeId)} stores={stores} errors={cashErrors} onAddError={async () => {}} onUpdateError={async () => {}} onDeleteError={async () => {}} />;
      case 'icecream':
        return <IceCreamModule items={iceCreamItems} sales={iceCreamSales} finances={iceCreamFinances} onAddSales={async () => {}} onUpdatePrice={async () => {}} onUpdateItem={async () => {}} onAddTransaction={async () => {}} onDeleteTransaction={async () => {}} onAddItem={async () => {}} onDeleteItem={async () => {}} />;
      case 'admin_users':
          return <AdminUsersManagement currentUser={user} />;
      case 'access_control':
        return <AccessControlManagement />;
      case 'audit':
        return <SystemAudit logs={logs} receipts={receipts} cashErrors={cashErrors} />;
      case 'auth_print':
        return <PurchaseAuthorization />;
      case 'termo_print':
        return <TermoAutorizacao user={user} store={stores.find(s => s.id === user.storeId)} />;
      case 'settings':
        return <AdminSettings stores={stores} onAddStore={async () => {}} onUpdateStore={async () => {}} onDeleteStore={async () => {}} />;
      default:
        return <div className="p-10 text-gray-500 font-bold uppercase tracking-widest">Funcionalidade em desenvolvimento...</div>;
    }
  };

  return (
    <div className="flex h-screen bg-gray-100 font-sans overflow-hidden">
      {user && (
      <>
        {/* HEADER SUPERIOR FIXO - IDENTIDADE CORPORATIVA REFORÇADA */}
        <header className="fixed top-0 left-0 right-0 h-16 bg-white border-b border-gray-200 z-[60] flex items-center justify-between px-6 shadow-sm">
            <div className="flex items-center">
                <div className="w-10 h-10 rounded-full overflow-hidden border border-gray-100 shadow-sm flex items-center justify-center bg-white mr-4">
                    <img 
                        src={BRAND_LOGO} 
                        className="w-full h-full object-contain" 
                        alt="Logo"
                    />
                </div>
                <div className="hidden md:block">
                   <span className="font-black italic text-blue-950 tracking-tighter uppercase leading-none text-xl">REAL <span className="text-red-600">ADMIN</span></span>
                   <p className="text-[7px] text-gray-400 font-black uppercase tracking-widest mt-0.5">SISTEMA DE GESTÃO ESTRATÉGICA</p>
                </div>
            </div>
            
            <div className="flex items-center gap-4">
                <div className="flex items-center gap-3 px-4 py-1.5 bg-gray-50 rounded-full border border-gray-100">
                    <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center font-bold text-xs text-white uppercase shadow-inner">{user.name.charAt(0)}</div>
                    <div className="text-left hidden sm:block">
                        <p className="text-[10px] font-black uppercase text-gray-900 leading-none">{user.name}</p>
                        <p className="text-[8px] font-bold text-blue-400 uppercase tracking-tighter italic">{user.role}</p>
                    </div>
                </div>
                <button onClick={handleLogout} className="p-2.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all border border-transparent hover:border-red-100" title="Sair do Sistema">
                    <LogOut size={20}/>
                </button>
            </div>
        </header>

        {/* Sidebar com margem superior para o cabeçalho */}
        <div className={`fixed md:sticky top-16 left-0 h-[calc(100vh-64px)] w-64 bg-gradient-to-b from-blue-950 to-blue-900 text-white shadow-2xl z-50 transition-transform duration-300 border-r border-blue-800 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
            <div className="p-6 flex flex-col h-full">
            <nav className="flex-1 space-y-1 overflow-y-auto no-scrollbar pr-1 pt-4">
                {Object.entries(menuGroups).map(([groupName, items]) => (
                    <div key={groupName} className="mb-4">
                        <div className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest opacity-50 ${groupName === 'Administração' ? 'text-red-400 opacity-80' : 'text-blue-400'}`}>
                            {groupName}
                        </div>
                        {(items as PagePermission[]).map(item => (
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
            <div className="pt-4 border-t border-blue-800">
                <p className="text-center text-[8px] font-black text-blue-400 uppercase tracking-widest opacity-50">Enterprise Edition v5.2</p>
            </div>
            </div>
        </div>
      </>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
         <main className={`flex-1 overflow-auto relative scroll-smooth no-scrollbar ${user ? 'pt-16' : ''}`}>
            {renderView()}
         </main>
      </div>
      
      {/* Botão flutuante menu Mobile */}
      {user && (
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="md:hidden fixed bottom-6 right-6 w-14 h-14 bg-blue-950 text-white rounded-full shadow-2xl flex items-center justify-center z-[70] border-4 border-white transition-transform active:scale-90"
          >
              {isSidebarOpen ? <X size={24}/> : <Menu size={24}/>}
          </button>
      )}
    </div>
  );
};

export default App;
