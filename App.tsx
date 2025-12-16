
import React, { useState } from 'react';
import { LayoutDashboard, ShoppingBag, Target, Calculator, DollarSign, Instagram, Download, Shield, AlertOctagon, FileSignature, LogOut, Menu, Users, Calendar, Settings, X, Camera, User as UserIcon, FileText } from 'lucide-react';
import LoginScreen from './components/LoginScreen';
import DashboardAdmin from './components/DashboardAdmin';
import DashboardManager from './components/DashboardManager';
import DashboardPurchases from './components/DashboardPurchases';
import GoalRegistration from './components/GoalRegistration';
import CotasManagement from './components/CotasManagement';
import AgendaSystem from './components/AgendaSystem';
import FinancialModule from './components/FinancialModule';
import InstagramMarketing from './components/InstagramMarketing';
import DownloadsModule from './components/DownloadsModule';
import SystemAudit from './components/SystemAudit';
import CashErrorsModule from './components/CashErrorsModule';
import AdminSettings from './components/AdminSettings';
import PurchaseAuthorization from './components/PurchaseAuthorization';
import TermoAutorizacao from './components/TermoAutorizacao';
import { User, Store, MonthlyPerformance, UserRole, ProductPerformance, Cota, AgendaItem, DownloadItem, SystemLog, CashError } from './types';
import { MOCK_USERS, MOCK_STORES, MOCK_PERFORMANCE, MOCK_PRODUCT_PERFORMANCE, MOCK_COTAS, MOCK_AGENDA, MOCK_DOWNLOADS } from './constants';

// NavButton Component
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
  // State
  const [user, setUser] = useState<User | null>(null);
  const [currentView, setCurrentView] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  // Profile Edit State
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [tempProfile, setTempProfile] = useState<{name: string, photo: string}>({ name: '', photo: '' });

  // Data State (initialized with Mocks)
  const [users] = useState<User[]>(MOCK_USERS);
  const [stores, setStores] = useState<Store[]>(MOCK_STORES);
  const [performanceData, setPerformanceData] = useState<MonthlyPerformance[]>(MOCK_PERFORMANCE);
  const [productData, setProductData] = useState<ProductPerformance[]>(MOCK_PRODUCT_PERFORMANCE);
  const [cotas, setCotas] = useState<Cota[]>(MOCK_COTAS);
  const [tasks, setTasks] = useState<AgendaItem[]>(MOCK_AGENDA);
  const [downloads, setDownloads] = useState<DownloadItem[]>(MOCK_DOWNLOADS);
  const [cashErrors, setCashErrors] = useState<CashError[]>([]);
  const [logs, setLogs] = useState<SystemLog[]>([]);
  
  const handleLogin = (u: User) => {
    setUser(u);
    logAction('LOGIN', `Usuário ${u.name} realizou login`, u);
    
    // Set initial view based on role
    if (u.role === UserRole.CASHIER) {
        setCurrentView('agenda');
    } else {
        setCurrentView('dashboard');
    }
  };

  const handleLogout = () => {
    if (user) logAction('LOGOUT', `Usuário ${user.name} realizou logout`);
    setUser(null);
    setCurrentView('dashboard');
  };

  const logAction = (action: SystemLog['action'], details: string, u: User | null = user) => {
    if (!u) return;
    const newLog: SystemLog = {
      id: `log-${Date.now()}`,
      timestamp: new Date(),
      userId: u.id,
      userName: u.name,
      userRole: u.role,
      action,
      details
    };
    setLogs(prev => [newLog, ...prev]);
  };

  // Profile Handlers
  const openProfileModal = () => {
      if (user) {
          setTempProfile({ name: user.name, photo: user.photo || '' });
          setIsProfileModalOpen(true);
      }
  };

  const handleProfileSave = (e: React.FormEvent) => {
      e.preventDefault();
      if (user) {
          const updatedUser = { ...user, name: tempProfile.name, photo: tempProfile.photo };
          setUser(updatedUser);
          setIsProfileModalOpen(false);
          logAction('SYSTEM', `Atualizou perfil de usuário: ${updatedUser.name}`);
      }
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          const reader = new FileReader();
          reader.onloadend = () => {
              setTempProfile(prev => ({ ...prev, photo: reader.result as string }));
          };
          reader.readAsDataURL(file);
      }
  };

  // View Rendering Logic
  const renderView = () => {
    if (!user) return <LoginScreen onLogin={handleLogin} users={users} stores={stores} onRegisterRequest={(s) => setStores(prev => [...prev, s])} />;

    switch (currentView) {
      case 'dashboard':
        // Cashiers should not access dashboard, fallback to agenda if somehow here
        if (user.role === UserRole.CASHIER) return <AgendaSystem user={user} tasks={tasks} onAddTask={(t) => setTasks([...tasks, t])} onUpdateTask={(t) => setTasks(tasks.map(old => old.id === t.id ? t : old))} onDeleteTask={(id) => setTasks(tasks.filter(t => t.id !== id))} onLogAction={(a, d) => logAction(a, d)} />;
        
        return user.role === UserRole.MANAGER 
          ? <DashboardManager user={user} stores={stores} performanceData={performanceData} purchasingData={productData} />
          : <DashboardAdmin stores={stores} performanceData={performanceData} onImportData={setPerformanceData} />;
      case 'purchases':
        return <DashboardPurchases stores={stores} data={productData} onImport={setProductData} />;
      case 'goals':
        return <GoalRegistration stores={stores} performanceData={performanceData} onUpdateData={setPerformanceData} />;
      case 'cotas':
        return <CotasManagement user={user} stores={stores} cotas={cotas} onAddCota={(c) => setCotas([...cotas, c])} onDeleteCota={(id) => setCotas(cotas.filter(c => c.id !== id))} onUpdateCota={(c) => setCotas(cotas.map(old => old.id === c.id ? c : old))} onLogAction={(a, d) => logAction(a, d)} />;
      case 'financial':
        return <FinancialModule user={user} store={stores.find(s => s.id === user.storeId)} />;
      case 'agenda':
        return <AgendaSystem user={user} tasks={tasks} onAddTask={(t) => setTasks([...tasks, t])} onUpdateTask={(t) => setTasks(tasks.map(old => old.id === t.id ? t : old))} onDeleteTask={(id) => setTasks(tasks.filter(t => t.id !== id))} onLogAction={(a, d) => logAction(a, d)} />;
      case 'marketing':
        return <InstagramMarketing user={user} store={stores.find(s => s.id === user.storeId)} onRegisterDownload={(d) => { const id = `DL-${Date.now()}`; logAction('DOWNLOAD_IMAGE', d || 'Download de Imagem'); return id; }} />;
      case 'downloads':
        return <DownloadsModule user={user} items={downloads} onUpload={(i) => setDownloads([...downloads, i])} onDelete={(id) => setDownloads(downloads.filter(d => d.id !== id))} onLogAction={(a, d) => logAction(a, d)} />;
      case 'audit':
        return <SystemAudit logs={logs} receipts={[]} store={stores.find(s => s.id === user.storeId)} cashErrors={cashErrors} />;
      case 'cash_errors':
        return <CashErrorsModule user={user} store={stores.find(s => s.id === user.storeId)} stores={stores} errors={cashErrors} onAddError={(e) => setCashErrors([...cashErrors, e])} onUpdateError={(e) => setCashErrors(cashErrors.map(old => old.id === e.id ? e : old))} onDeleteError={(id) => setCashErrors(cashErrors.filter(e => e.id !== id))} />;
      case 'settings':
        return <AdminSettings stores={stores} onStoreUpdate={setStores} />;
      case 'auth_print':
        return <PurchaseAuthorization />;
      case 'termo_print':
        return <TermoAutorizacao user={user} store={stores.find(s => s.id === user.storeId)} />;
      default:
        return <div className="p-10">Página não encontrada</div>;
    }
  };

  if (!user) {
    return <LoginScreen onLogin={handleLogin} users={users} stores={stores} onRegisterRequest={(s) => setStores([...stores, s])} />;
  }

  return (
    <div className="flex h-screen bg-gray-100 font-sans overflow-hidden">
      {/* Sidebar */}
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
            
            {/* 1. VISÃO GERAL (Hidden for Cashiers) */}
            {user.role !== UserRole.CASHIER && (
                <NavButton view="dashboard" icon={LayoutDashboard} label="Visão Geral" active={currentView === 'dashboard'} onClick={() => { setCurrentView('dashboard'); setIsSidebarOpen(false); }} />
            )}
            
            {/* 2. COMPRAS (Hidden for Cashiers) */}
            {user.role !== UserRole.CASHIER && (
                <NavButton view="purchases" icon={ShoppingBag} label="Compras & Marcas" active={currentView === 'purchases'} onClick={() => { setCurrentView('purchases'); setIsSidebarOpen(false); }} />
            )}
            
            {/* 3. METAS (Admin Only) */}
            {user.role === UserRole.ADMIN && (
               <NavButton view="goals" icon={Target} label="Metas" active={currentView === 'goals'} onClick={() => { setCurrentView('goals'); setIsSidebarOpen(false); }} />
            )}
            
            {/* 4. COTAS (Hidden for Cashiers) */}
            {user.role !== UserRole.CASHIER && (
                <NavButton view="cotas" icon={Calculator} label="Cotas & Pedidos" active={currentView === 'cotas'} onClick={() => { setCurrentView('cotas'); setIsSidebarOpen(false); }} />
            )}
            
            {/* 5. AGENDA (Visible to All) */}
            <NavButton view="agenda" icon={Calendar} label="Agenda" active={currentView === 'agenda'} onClick={() => { setCurrentView('agenda'); setIsSidebarOpen(false); }} />
            
            <div className="pt-4 pb-2 text-xs font-bold text-blue-400 uppercase tracking-wider">Caixas</div>
            <NavButton view="financial" icon={DollarSign} label="Caixa & Recibos" active={currentView === 'financial'} onClick={() => { setCurrentView('financial'); setIsSidebarOpen(false); }} />
            <NavButton view="cash_errors" icon={AlertOctagon} label="Quebra de Caixa" active={currentView === 'cash_errors'} onClick={() => { setCurrentView('cash_errors'); setIsSidebarOpen(false); }} />

            <div className="pt-4 pb-2 text-xs font-bold text-blue-400 uppercase tracking-wider">Marketing</div>
            <NavButton view="marketing" icon={Instagram} label="Marketing Studio" active={currentView === 'marketing'} onClick={() => { setCurrentView('marketing'); setIsSidebarOpen(false); }} />
            
            {/* Downloads (Hidden for Cashiers per request) */}
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
              </>
            )}
          </nav>

          <div className="pt-4 border-t border-blue-800">
            {/* User Profile Section - Clickable for Editing */}
            <div 
                onClick={openProfileModal}
                className="flex items-center gap-3 mb-4 px-2 cursor-pointer hover:bg-blue-800/50 p-2 rounded-lg transition-colors group"
                title="Clique para editar perfil"
            >
               {user.photo ? (
                   <img src={user.photo} alt="Profile" className="w-9 h-9 rounded-full object-cover border-2 border-white/20 group-hover:border-white/50" />
               ) : (
                   <div className="w-9 h-9 rounded-full bg-blue-700 flex items-center justify-center font-bold text-xs border-2 border-white/10 group-hover:border-white/50">
                       {user.name.substring(0,2).toUpperCase()}
                   </div>
               )}
               <div className="overflow-hidden flex-1">
                  <p className="text-sm font-bold truncate group-hover:text-blue-100">{user.name}</p>
                  <p className="text-[10px] text-blue-300 uppercase">
                      {user.role === UserRole.MANAGER ? 'Gerente' : user.role === UserRole.ADMIN ? 'Administrador' : user.role === UserRole.CASHIER ? 'Caixa' : user.role}
                  </p>
               </div>
               <Settings size={14} className="text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>

            <button 
              onClick={handleLogout}
              className="w-full flex items-center gap-2 px-4 py-2 bg-red-600/20 text-red-300 hover:bg-red-600 hover:text-white rounded-lg transition-colors text-sm font-bold"
            >
              <LogOut size={16} /> Sair do Sistema
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
         {/* Mobile Header */}
         <div className="md:hidden bg-white shadow-sm p-4 flex justify-between items-center z-40">
            <h1 className="text-lg font-black italic text-blue-900">REAL <span className="text-red-500">CALÇADOS</span></h1>
            <button onClick={() => setIsSidebarOpen(true)} className="text-gray-600"><Menu size={24}/></button>
         </div>

         <main className="flex-1 overflow-auto bg-gray-50 relative">
            {renderView()}
         </main>
      </div>

      {/* Edit Profile Modal */}
      {isProfileModalOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] p-4 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
                <div className="bg-gradient-to-r from-blue-900 to-blue-800 p-6 flex justify-between items-center">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <UserIcon size={20} /> Editar Perfil
                    </h3>
                    <button onClick={() => setIsProfileModalOpen(false)} className="text-blue-200 hover:text-white transition-colors">
                        <X size={20} />
                    </button>
                </div>
                
                <form onSubmit={handleProfileSave} className="p-6 space-y-6">
                    <div className="flex flex-col items-center">
                        <div 
                            className="w-24 h-24 rounded-full bg-gray-100 mb-3 overflow-hidden border-4 border-blue-50 relative group cursor-pointer shadow-inner" 
                            onClick={() => document.getElementById('profile-upload')?.click()}
                        >
                            {tempProfile.photo ? (
                                <img src={tempProfile.photo} className="w-full h-full object-cover" alt="Preview" />
                            ) : (
                                <UserIcon className="w-10 h-10 text-gray-300 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                            )}
                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <Camera size={24} className="text-white drop-shadow-md" />
                            </div>
                        </div>
                        <input type="file" id="profile-upload" className="hidden" accept="image/*" onChange={handlePhotoUpload} />
                        <span className="text-xs text-blue-600 font-bold cursor-pointer hover:underline" onClick={() => document.getElementById('profile-upload')?.click()}>Alterar Foto</span>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nome de Exibição</label>
                        <input 
                            value={tempProfile.name}
                            onChange={(e) => setTempProfile({...tempProfile, name: e.target.value})}
                            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                            required
                            placeholder="Seu nome"
                        />
                    </div>

                    <div className="flex gap-3 pt-2">
                        <button 
                            type="button" 
                            onClick={() => setIsProfileModalOpen(false)}
                            className="flex-1 py-3 bg-gray-100 text-gray-700 font-bold rounded-lg hover:bg-gray-200 transition-colors"
                        >
                            Cancelar
                        </button>
                        <button 
                            type="submit" 
                            className="flex-1 py-3 bg-blue-700 hover:bg-blue-800 text-white font-bold rounded-lg shadow-md transition-all flex items-center justify-center gap-2"
                        >
                            Salvar Alterações
                        </button>
                    </div>
                </form>
            </div>
        </div>
      )}
    </div>
  );
};

export default App;
