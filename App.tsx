
import React, { useState, useEffect } from 'react';
import { LayoutDashboard, ShoppingBag, Target, Calculator, DollarSign, Instagram, Download, Shield, AlertOctagon, FileSignature, LogOut, Menu, Users, Calendar, Settings, X, Camera, User as UserIcon, FileText, IceCream } from 'lucide-react';
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
import { User, Store, MonthlyPerformance, UserRole, ProductPerformance, Cota, AgendaItem, DownloadItem, SystemLog, CashError, CreditCardSale, Receipt, CotaSettings, CotaDebt, IceCreamItem, IceCreamDailySale, IceCreamTransaction, IceCreamCategory } from './types';
import { supabase } from './services/supabaseClient';

interface NavButtonProps {
  view: string;
  icon: React.ElementType;
  label: string;
  active?: boolean;
  onClick?: () => void;
}

const NavButton: React.FC<NavButtonProps> = ({ view, icon: Icon, label, active, onClick }) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors border-l-4 ${
      active 
        ? 'bg-blue-800/50 border-blue-400 text-white shadow-inner' 
        : 'border-transparent text-blue-100 hover:bg-blue-800/30 hover:text-white'
    }`}
  >
    <Icon size={20} />
    <span className="md:inline">{label}</span>
  </button>
);

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [currentView, setCurrentView] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  const [stores, setStores] = useState<Store[]>([]);
  const [performanceData, setPerformanceData] = useState<MonthlyPerformance[]>([]);
  const [productData, setProductData] = useState<ProductPerformance[]>([]);
  const [cotas, setCotas] = useState<Cota[]>([]);
  const [cotaSettings, setCotaSettings] = useState<CotaSettings[]>([]); 
  const [cotaDebts, setCotaDebts] = useState<CotaDebt[]>([]); 
  const [tasks, setTasks] = useState<AgendaItem[]>([]);
  const [downloads, setDownloads] = useState<DownloadItem[]>([]);
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
        const { data: dbStores } = await supabase.from('stores').select('*');
        if (dbStores) setStores(dbStores.map((s: any) => ({ id: s.id, number: s.number, name: s.name, city: s.city, managerName: s.manager_name, managerEmail: s.manager_email, managerPhone: s.manager_phone, status: s.status, role: s.role || UserRole.MANAGER, passwordResetRequested: s.password_reset_requested, password: s.password })));

        const { data: dbPerf } = await supabase.from('monthly_performance').select('*');
        if (dbPerf) setPerformanceData(dbPerf.map((p: any) => ({ id: p.id, storeId: p.store_id, month: p.month, revenueTarget: Number(p.revenue_target), revenueActual: Number(p.revenue_actual), itemsTarget: Number(p.items_target), itemsActual: Number(p.items_actual), paTarget: Number(p.pa_target), ticketTarget: Number(p.ticket_target), puTarget: Number(p.pu_target), delinquencyTarget: Number(p.delinquency_target), itemsPerTicket: Number(p.pa_actual), averageTicket: Number(p.ticket_actual), unitPriceAverage: Number(p.pu_actual), delinquencyRate: Number(p.delinquency_actual), percentMeta: p.revenue_target > 0 ? (p.revenue_actual / p.revenue_target) * 100 : 0, trend: 'stable', correctedDailyGoal: 0 })));

        // SORVETE - CARGA SEGURA V2
        const { data: dbIceItems } = await supabase.from('ice_cream_items').select('*').order('name', { ascending: true });
        if (dbIceItems) setIceCreamItems(dbIceItems.map((i: any) => ({ 
            id: String(i.id), 
            name: String(i.name || 'Sem nome'), 
            price: Number(i.price || 0), 
            category: (i.category || 'Milkshake') as IceCreamCategory 
        })));

        const { data: dbIceSales } = await supabase.from('ice_cream_daily_sales').select('*');
        if (dbIceSales) setIceCreamSales(dbIceSales.map((s: any) => ({ id: s.id, date: s.date, itemId: String(s.item_id), unitsSold: Number(s.units_sold) })));

        const { data: dbIceFinances } = await supabase.from('ice_cream_finances').select('*');
        if (dbIceFinances) setIceCreamFinances(dbIceFinances.map((f: any) => ({ 
            id: f.id, date: f.date, type: f.type, category: f.category, value: Number(f.value), description: f.description, createdAt: new Date(f.created_at) 
        })));

        // Carregar logs e outros
        const { data: dbLogs } = await supabase.from('system_logs').select('*').order('created_at', { ascending: false }).limit(100);
        if (dbLogs) setLogs(dbLogs.map((l: any) => ({ id: l.id, timestamp: new Date(l.created_at), userId: l.user_id, userName: l.user_name, userRole: l.user_role as UserRole, action: l.action, details: l.details })));

      } catch (error) {
          console.error("Erro ao carregar dados:", error);
      } finally {
          setIsLoading(false);
      }
  };

  // SORVETE HANDLERS V2
  const handleIceCreamPriceUpdate = async (id: string, price: number) => {
    await supabase.from('ice_cream_items').update({ price: Number(price) }).eq('id', id);
    await loadAllData();
  };

  const handleUpdateIceCreamItem = async (item: IceCreamItem) => {
      await supabase.from('ice_cream_items').update({ name: String(item.name), category: String(item.category), price: Number(item.price) }).eq('id', item.id);
      await loadAllData();
  };

  const handleAddIceCreamItem = async (name: string, category: IceCreamCategory, price: number) => {
      await supabase.from('ice_cream_items').insert([{ name: String(name), category: String(category), price: Number(price) }]);
      await loadAllData();
  };

  const handleDeleteIceCreamItem = async (id: string) => {
      await supabase.from('ice_cream_items').delete().eq('id', id);
      await loadAllData();
  };

  const handleAddIceCreamSales = async (newSales: IceCreamDailySale[]) => {
    const payload = newSales.map(s => ({ date: s.date, item_id: s.itemId, units_sold: s.unitsSold }));
    await supabase.from('ice_cream_daily_sales').insert(payload);
    await loadAllData();
  };

  const handleAddIceCreamTransaction = async (tx: IceCreamTransaction) => {
    await supabase.from('ice_cream_finances').insert({ date: tx.date, type: tx.type, category: tx.category, value: Number(tx.value), description: tx.description });
    await loadAllData();
  };

  const handleDeleteIceCreamTransaction = async (id: string) => {
    await supabase.from('ice_cream_finances').delete().eq('id', id);
    await loadAllData();
  };

  // --- AUTHENTICATION ---
  const authenticateUser = async (email: string, password: string): Promise<{ success: boolean; user?: User; error?: string }> => {
      try {
          const cleanEmail = email.trim().toLowerCase();
          if (cleanEmail === 'juniorcardoso@me.com' && password === 'Solazul1981*') {
              const bootstrapUser: User = { id: 'admin-1', name: 'Junior Cardoso', email: cleanEmail, role: UserRole.ADMIN, storeId: '' };
              handleLogin(bootstrapUser);
              return { success: true, user: bootstrapUser };
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
    if (savedUser) {
        try {
            const parsedUser = JSON.parse(savedUser);
            setUser(parsedUser);
        } catch (e) {
            localStorage.removeItem('rc_user');
        }
    }
    loadAllData();
  }, []);

  const renderView = () => {
    if (!user) return <LoginScreen onLoginAttempt={authenticateUser} />;

    switch (currentView) {
      case 'dashboard':
        if (user.role === UserRole.CASHIER) return <AgendaSystem user={user} tasks={tasks} onAddTask={async () => {}} onUpdateTask={async () => {}} onDeleteTask={async () => {}} />;
        return user.role === UserRole.MANAGER 
          ? <DashboardManager user={user} stores={stores} performanceData={performanceData} purchasingData={productData} />
          : <DashboardAdmin stores={stores} performanceData={performanceData} onImportData={async () => {}} onSaveGoals={async () => {}} />;
      case 'metas_registration':
        return <GoalRegistration stores={stores} performanceData={performanceData} onUpdateData={async () => {}} />;
      case 'purchases':
        return <DashboardPurchases stores={stores} data={productData} onImport={async () => {}} />;
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
        return <IceCreamModule 
            items={iceCreamItems} 
            sales={iceCreamSales} 
            finances={iceCreamFinances} 
            onAddSales={handleAddIceCreamSales} 
            onUpdatePrice={handleIceCreamPriceUpdate} 
            onUpdateItem={handleUpdateIceCreamItem}
            onAddTransaction={handleAddIceCreamTransaction} 
            onDeleteTransaction={handleDeleteIceCreamTransaction}
            onAddItem={handleAddIceCreamItem}
            onDeleteItem={handleDeleteIceCreamItem}
        />;
      case 'audit':
        return <SystemAudit logs={logs} receipts={receipts} cashErrors={cashErrors} />;
      case 'settings':
        return <AdminSettings stores={stores} onAddStore={async () => {}} onUpdateStore={async () => {}} onDeleteStore={async () => {}} />;
      case 'auth_print':
        return <PurchaseAuthorization />;
      case 'termo_print':
        return <TermoAutorizacao user={user} store={stores.find(s => s.id === user.storeId)} />;
      default:
        return <div className="p-10">Página não encontrada</div>;
    }
  };

  return (
    <div className="flex h-screen bg-gray-100 font-sans overflow-hidden">
      {user && (
      <div className={`fixed md:sticky top-0 left-0 h-screen w-64 bg-gradient-to-b from-blue-950 to-blue-900 text-white shadow-xl z-50 transition-transform duration-300 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        <div className="p-6 flex flex-col h-full">
          <div className="flex items-center gap-3 mb-8">
             <div>
                <h1 className="text-2xl font-black italic tracking-tighter leading-none">REAL <span className="text-red-500">CALÇADOS</span></h1>
                <p className="text-[10px] text-blue-300 uppercase tracking-widest">Sistema de Gestão</p>
             </div>
             <button className="md:hidden ml-auto" onClick={() => setIsSidebarOpen(false)}><LogOut size={20}/></button>
          </div>

          <nav className="flex-1 space-y-1 overflow-y-auto no-scrollbar">
            {user.role !== UserRole.CASHIER && (
                <NavButton view="dashboard" icon={LayoutDashboard} label="Visão Geral" active={currentView === 'dashboard'} onClick={() => { setCurrentView('dashboard'); setIsSidebarOpen(false); }} />
            )}
            {user.role === UserRole.ADMIN && (
                <NavButton view="metas_registration" icon={Target} label="Definir Metas" active={currentView === 'metas_registration'} onClick={() => { setCurrentView('metas_registration'); setIsSidebarOpen(false); }} />
            )}
            {user.role !== UserRole.CASHIER && (
                <NavButton view="purchases" icon={ShoppingBag} label="Compras & Marcas" active={currentView === 'purchases'} onClick={() => { setCurrentView('purchases'); setIsSidebarOpen(false); }} />
            )}
            {user.role !== UserRole.CASHIER && (
                <NavButton view="cotas" icon={Calculator} label="Cotas & Pedidos" active={currentView === 'cotas'} onClick={() => { setCurrentView('cotas'); setIsSidebarOpen(false); }} />
            )}
            <NavButton view="agenda" icon={Calendar} label="Agenda" active={currentView === 'agenda'} onClick={() => { setCurrentView('agenda'); setIsSidebarOpen(false); }} />
            
            <div className="pt-4 pb-2 text-xs font-bold text-blue-400 uppercase tracking-wider">Caixas</div>
            <NavButton view="financial" icon={DollarSign} label="Caixa & Recibos" active={currentView === 'financial'} onClick={() => { setCurrentView('financial'); setIsSidebarOpen(false); }} />
            <NavButton view="cash_errors" icon={AlertOctagon} label="Quebra de Caixa" active={currentView === 'cash_errors'} onClick={() => { setCurrentView('cash_errors'); setIsSidebarOpen(false); }} />

            <div className="pt-4 pb-2 text-xs font-bold text-blue-400 uppercase tracking-wider">Marketing</div>
            <NavButton view="marketing" icon={Instagram} label="Marketing Studio" active={currentView === 'marketing'} onClick={() => { setCurrentView('marketing'); setIsSidebarOpen(false); }} />
            {user.role !== UserRole.CASHIER && (
                <NavButton view="downloads" icon={Download} label="Downloads" active={currentView === 'downloads'} onClick={() => { setCurrentView('downloads'); setIsSidebarOpen(false); }} />
            )}
            
            <div className="pt-4 pb-2 text-xs font-bold text-blue-400 uppercase tracking-wider">Impressos</div>
            <NavButton view="auth_print" icon={FileSignature} label="Autorização Compra" active={currentView === 'auth_print'} onClick={() => { setCurrentView('auth_print'); setIsSidebarOpen(false); }} />
            <NavButton view="termo_print" icon={FileText} label="Termo Autorização" active={currentView === 'termo_print'} onClick={() => { setCurrentView('termo_print'); setIsSidebarOpen(false); }} />

            {user.role === UserRole.ADMIN && (
              <>
                <div className="pt-4 pb-2 text-xs font-bold text-blue-400 uppercase tracking-wider">Administração</div>
                <NavButton view="audit" icon={Shield} label="Auditoria" active={currentView === 'audit'} onClick={() => { setCurrentView('audit'); setIsSidebarOpen(false); }} />
                <NavButton view="settings" icon={Users} label="Lojas & Usuários" active={currentView === 'settings'} onClick={() => { setCurrentView('settings'); setIsSidebarOpen(false); }} />
                <NavButton view="icecream" icon={IceCream} label="Sorvete" active={currentView === 'icecream'} onClick={() => { setCurrentView('icecream'); setIsSidebarOpen(false); }} />
              </>
            )}
          </nav>

          <div className="pt-4 border-t border-blue-800">
            <button onClick={handleLogout} className="w-full flex items-center gap-2 px-4 py-2 bg-red-600/20 text-red-300 hover:bg-red-600 hover:text-white rounded-lg transition-colors text-sm font-bold"><LogOut size={16} /> Sair do Sistema</button>
          </div>
        </div>
      </div>
      )}

      <div className="flex-1 flex flex-col h-screen overflow-hidden">
         {user && (
         <div className="md:hidden bg-white shadow-sm p-4 flex justify-between items-center z-40">
            <h1 className="text-lg font-black italic text-blue-900">REAL <span className="text-red-500">CALÇADOS</span></h1>
            <button onClick={() => setIsSidebarOpen(true)} className="text-gray-600"><Menu size={24}/></button>
         </div>
         )}
         <main className="flex-1 overflow-auto bg-gray-50 relative">{renderView()}</main>
      </div>
    </div>
  );
};

export default App;
