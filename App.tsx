
import React, { useState, useEffect } from 'react';
import { LayoutDashboard, ShoppingBag, Target, Calculator, DollarSign, Instagram, Download, Shield, AlertOctagon, FileSignature, LogOut, Menu, Users, Calendar, Settings, X, Camera, User as UserIcon, FileText } from 'lucide-react';
import LoginScreen from './components/LoginScreen';
import DashboardAdmin from './components/DashboardAdmin';
import DashboardManager from './components/DashboardManager';
import DashboardPurchases from './components/DashboardPurchases';
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
import { User, Store, MonthlyPerformance, UserRole, ProductPerformance, Cota, AgendaItem, DownloadItem, SystemLog, CashError, CreditCardSale, Receipt, CotaSettings, CotaDebt } from './types';
import { MOCK_USERS } from './constants';
import { supabase } from './services/supabaseClient';

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
  const [isLoading, setIsLoading] = useState(true);
  
  // Profile Edit State
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [tempProfile, setTempProfile] = useState<{name: string, photo: string}>({ name: '', photo: '' });

  // Data State
  const [users] = useState<User[]>(MOCK_USERS);
  const [stores, setStores] = useState<Store[]>([]);
  const [performanceData, setPerformanceData] = useState<MonthlyPerformance[]>([]);
  const [productData, setProductData] = useState<ProductPerformance[]>([]);
  const [cotas, setCotas] = useState<Cota[]>([]);
  const [cotaSettings, setCotaSettings] = useState<CotaSettings[]>([]); // New State
  const [cotaDebts, setCotaDebts] = useState<CotaDebt[]>([]); // New State
  const [tasks, setTasks] = useState<AgendaItem[]>([]);
  const [downloads, setDownloads] = useState<DownloadItem[]>([]);
  const [cashErrors, setCashErrors] = useState<CashError[]>([]);
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [creditCardSales, setCreditCardSales] = useState<CreditCardSale[]>([]);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  
  // --- SUPABASE DATA LOADING ---
  const loadAllData = async () => {
      setIsLoading(true);
      try {
        const { data: dbStores } = await supabase.from('stores').select('*');
        if (dbStores) {
            setStores(dbStores.map((s: any) => ({
                id: s.id,
                number: s.number,
                name: s.name,
                city: s.city,
                managerName: s.manager_name,
                managerEmail: s.manager_email,
                managerPhone: s.manager_phone,
                status: s.status,
                role: UserRole.MANAGER,
                password: s.password // Fetches password column (must exist in DB)
            })));
        }

        const { data: dbPerf } = await supabase.from('monthly_performance').select('*');
        if (dbPerf) {
            setPerformanceData(dbPerf.map((p: any) => ({
                id: p.id,
                storeId: p.store_id,
                month: p.month,
                revenueTarget: p.revenue_target,
                revenueActual: p.revenue_actual,
                itemsTarget: p.items_target,
                itemsActual: p.items_actual,
                paTarget: p.pa_target,
                ticketTarget: p.ticket_target,
                puTarget: p.pu_target,
                delinquencyTarget: p.delinquency_target,
                itemsPerTicket: p.pa_actual,
                averageTicket: p.ticket_actual,
                unitPriceAverage: p.pu_actual,
                delinquencyRate: p.delinquency_actual,
                percentMeta: p.revenue_target > 0 ? (p.revenue_actual / p.revenue_target) * 100 : 0,
                trend: 'stable',
                correctedDailyGoal: 0
            })));
        }

        const { data: dbProds } = await supabase.from('product_performance').select('*');
        if (dbProds) {
            setProductData(dbProds.map((p: any) => ({
                id: p.id,
                storeId: p.store_id,
                month: p.month,
                brand: p.brand,
                category: p.category,
                pairsSold: p.pairs_sold,
                revenue: p.revenue
            })));
        }

        const { data: dbCotas } = await supabase.from('cotas').select('*');
        if (dbCotas) {
            setCotas(dbCotas.map((c: any) => ({
                id: c.id,
                storeId: c.store_id,
                brand: c.brand,
                classification: c.classification,
                totalValue: c.total_value,
                shipmentDate: c.shipment_date,
                paymentTerms: c.payment_terms,
                pairs: c.pairs,
                installments: c.installments || [],
                createdAt: new Date(c.created_at),
                createdByRole: c.created_by_role as UserRole,
                status: c.status
            })));
        }

        // New Cota Tables
        const { data: dbCotaSettings } = await supabase.from('cota_settings').select('*');
        if (dbCotaSettings) {
            setCotaSettings(dbCotaSettings.map((s: any) => ({
                storeId: s.store_id,
                budgetValue: s.budget_value,
                managerPercent: s.manager_percent
            })));
        }

        const { data: dbCotaDebts } = await supabase.from('cota_debts').select('*');
        if (dbCotaDebts) {
            setCotaDebts(dbCotaDebts.map((d: any) => ({
                id: d.id,
                storeId: d.store_id,
                month: d.month,
                value: d.value
            })));
        }

        const { data: dbTasks } = await supabase.from('agenda_tasks').select('*');
        if (dbTasks) {
            setTasks(dbTasks.map((t: any) => ({
                id: t.id,
                userId: t.user_id,
                title: t.title,
                description: t.description,
                dueDate: t.due_date,
                priority: t.priority,
                isCompleted: t.is_completed,
                createdAt: new Date(t.created_at)
            })));
        }

        const { data: dbCards } = await supabase.from('financial_card_sales').select('*');
        if (dbCards) {
            setCreditCardSales(dbCards.map((c: any) => ({
                id: c.id,
                storeId: c.store_id,
                userId: c.user_id,
                date: c.sale_date,
                brand: c.brand,
                authorizationCode: c.authorization_code,
                value: c.value
            })));
        }

        const { data: dbReceipts } = await supabase.from('financial_receipts').select('*');
        if (dbReceipts) {
            setReceipts(dbReceipts.map((r: any) => ({
                id: r.id,
                storeId: r.store_id,
                issuerName: r.issuer_name,
                payer: r.payer,
                recipient: r.recipient,
                value: r.value,
                valueInWords: r.value_in_words,
                reference: r.reference,
                date: r.receipt_date,
                createdAt: new Date(r.created_at)
            })));
        }

        const { data: dbErrors } = await supabase.from('cash_errors').select('*, profiles(name)');
        if (dbErrors) {
            setCashErrors(dbErrors.map((e: any) => ({
                id: e.id,
                storeId: e.store_id,
                userId: e.user_id,
                userName: e.profiles?.name || 'Usuário',
                date: e.error_date,
                type: e.type,
                value: e.value,
                reason: e.reason,
                createdAt: new Date(e.created_at)
            })));
        }

        const { data: dbDownloads } = await supabase.from('marketing_downloads').select('*');
        if (dbDownloads) {
            setDownloads(dbDownloads.map((d: any) => ({
                id: d.id,
                title: d.title,
                description: d.description,
                category: d.category,
                url: d.url,
                fileName: d.file_name,
                size: d.file_size,
                campaign: d.campaign,
                createdAt: new Date(d.created_at),
                createdBy: d.created_by
            })));
        }

        const { data: dbLogs } = await supabase.from('system_logs').select('*').order('created_at', { ascending: false }).limit(100);
        if (dbLogs) {
            setLogs(dbLogs.map((l: any) => ({
                id: l.id,
                timestamp: new Date(l.created_at),
                userId: l.user_id,
                userName: l.user_name,
                userRole: l.user_role as UserRole,
                action: l.action,
                details: l.details
            })));
        }

      } catch (error) {
          console.error("Erro ao carregar dados do Supabase:", error);
      } finally {
          setIsLoading(false);
      }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  // --- CRUD HANDLERS ---

  const logAction = async (action: SystemLog['action'], details: string, u: User | null = user) => {
    if (!u) return;
    await supabase.from('system_logs').insert({
        user_id: u.id,
        user_name: u.name,
        user_role: u.role,
        action: action,
        details: details
    });
    setLogs(prev => [{
      id: `log-${Date.now()}`,
      timestamp: new Date(),
      userId: u.id,
      userName: u.name,
      userRole: u.role,
      action,
      details
    }, ...prev]);
  };

  const handleSaveGoalsToSupabase = async (goals: MonthlyPerformance[]) => {
      for (const goal of goals) {
          const payload = {
              store_id: goal.storeId,
              month: goal.month,
              revenue_target: goal.revenueTarget,
              revenue_actual: goal.revenueActual,
              items_target: goal.itemsTarget,
              items_actual: goal.itemsActual,
              pa_target: goal.paTarget,
              pa_actual: goal.itemsPerTicket,
              ticket_target: goal.ticketTarget,
              ticket_actual: goal.averageTicket,
              pu_target: goal.puTarget,
              pu_actual: goal.unitPriceAverage,
              delinquency_target: goal.delinquencyTarget,
              delinquency_actual: goal.delinquencyRate
          };

          if (goal.id) {
              await supabase.from('monthly_performance').update(payload).eq('id', goal.id);
          } else {
              const { data: existing } = await supabase.from('monthly_performance').select('id').eq('store_id', goal.storeId).eq('month', goal.month).single();
              if (existing) {
                  await supabase.from('monthly_performance').update(payload).eq('id', existing.id);
              } else {
                  await supabase.from('monthly_performance').insert(payload);
              }
          }
      }
      loadAllData();
  };

  const handleSaveProductPerformance = async (newData: ProductPerformance[]) => {
      // 1. Identify impacted months
      const monthsAffected = Array.from(new Set(newData.map(d => d.month)));
      
      // 2. Clean old data for impacted months
      if (monthsAffected.length > 0) {
          await supabase.from('product_performance').delete().in('month', monthsAffected);
      }

      // 3. Insert new batch
      const payload = newData.map(d => ({
          store_id: d.storeId,
          month: d.month,
          brand: d.brand,
          category: d.category,
          pairs_sold: d.pairsSold,
          revenue: d.revenue
      }));

      const { error } = await supabase.from('product_performance').insert(payload);
      
      if (!error) {
          loadAllData();
          logAction('IMPORT_PURCHASES', `Importou compras para: ${monthsAffected.join(', ')}`);
      } else {
          console.error(error);
          alert("Erro ao salvar dados de compras no banco.");
      }
  };

  const handleAddCota = async (cota: Cota) => {
      const { data } = await supabase.from('cotas').insert({
          store_id: cota.storeId,
          brand: cota.brand,
          classification: cota.classification,
          total_value: cota.totalValue,
          shipment_date: cota.shipmentDate,
          payment_terms: cota.paymentTerms,
          pairs: cota.pairs,
          installments: cota.installments,
          created_by_role: cota.createdByRole,
          status: 'pending'
      }).select().single();

      if (data) {
          setCotas(prev => [...prev, { ...cota, id: data.id, createdAt: new Date(data.created_at) }]);
          logAction('ADD_COTA', `Lançou cota: ${cota.brand} (${cota.totalValue})`);
      }
  };

  const handleDeleteCota = async (id: string) => {
      await supabase.from('cotas').delete().eq('id', id);
      setCotas(prev => prev.filter(c => c.id !== id));
  };

  const handleUpdateCota = async (cota: Cota) => {
      await supabase.from('cotas').update({ status: cota.status }).eq('id', cota.id);
      setCotas(prev => prev.map(c => c.id === cota.id ? cota : c));
  };

  const handleSaveCotaSettings = async (settings: CotaSettings) => {
      const payload = {
          store_id: settings.storeId,
          budget_value: settings.budgetValue,
          manager_percent: settings.managerPercent
      };
      // Upsert
      await supabase.from('cota_settings').upsert(payload, { onConflict: 'store_id' });
      
      // Update local state
      setCotaSettings(prev => {
          const idx = prev.findIndex(s => s.storeId === settings.storeId);
          if (idx >= 0) {
              const newArr = [...prev];
              newArr[idx] = settings;
              return newArr;
          }
          return [...prev, settings];
      });
      logAction('UPDATE_GOAL', `Atualizou cota da Loja ${stores.find(s => s.id === settings.storeId)?.number}`);
  };

  const handleSaveCotaDebts = async (storeId: string, debts: Record<string, number>) => {
      // 1. Delete existing for store
      await supabase.from('cota_debts').delete().eq('store_id', storeId);
      
      // 2. Insert new
      const payload = Object.entries(debts).map(([month, value]) => ({
          store_id: storeId,
          month,
          value
      }));
      
      if (payload.length > 0) {
          await supabase.from('cota_debts').insert(payload);
      }

      // Reload
      const { data: dbCotaDebts } = await supabase.from('cota_debts').select('*');
      if (dbCotaDebts) {
          setCotaDebts(dbCotaDebts.map((d: any) => ({
              id: d.id,
              storeId: d.store_id,
              month: d.month,
              value: d.value
          })));
      }
  };

  const handleAddTask = async (task: AgendaItem) => {
      const { data } = await supabase.from('agenda_tasks').insert({
          user_id: task.userId,
          title: task.title,
          description: task.description,
          due_date: task.dueDate,
          priority: task.priority,
          is_completed: task.isCompleted
      }).select().single();

      if (data) {
          setTasks(prev => [...prev, { ...task, id: data.id }]);
          logAction('ADD_TASK', `Nova tarefa: ${task.title}`);
      }
  };

  const handleUpdateTask = async (task: AgendaItem) => {
      await supabase.from('agenda_tasks').update({
          title: task.title,
          description: task.description,
          due_date: task.dueDate,
          priority: task.priority,
          is_completed: task.isCompleted
      }).eq('id', task.id);
      
      setTasks(prev => prev.map(t => t.id === task.id ? task : t));
  };

  const handleDeleteTask = async (id: string) => {
      await supabase.from('agenda_tasks').delete().eq('id', id);
      setTasks(prev => prev.filter(t => t.id !== id));
  };

  const handleAddCardSale = async (sale: CreditCardSale) => {
      const { data } = await supabase.from('financial_card_sales').insert({
          store_id: sale.storeId,
          user_id: sale.userId,
          sale_date: sale.date,
          brand: sale.brand,
          authorization_code: sale.authorizationCode,
          value: sale.value
      }).select().single();

      if (data) {
          setCreditCardSales(prev => [...prev, { ...sale, id: data.id }]);
      }
  };

  const handleDeleteCardSale = async (id: string) => {
      await supabase.from('financial_card_sales').delete().eq('id', id);
      setCreditCardSales(prev => prev.filter(s => s.id !== id));
  };

  const handleAddReceipt = async (receipt: Receipt) => {
      const { data } = await supabase.from('financial_receipts').insert({
          store_id: receipt.storeId,
          issuer_name: receipt.issuerName,
          payer: receipt.payer,
          recipient: receipt.recipient,
          value: receipt.value,
          value_in_words: receipt.valueInWords,
          reference: receipt.reference,
          receipt_date: receipt.date
      }).select().single();

      if (data) {
          setReceipts(prev => [...prev, { ...receipt, id: data.id, createdAt: new Date(data.created_at) }]);
          logAction('GENERATE_RECEIPT', `Recibo emitido: R$${receipt.value} para ${receipt.recipient}`);
      }
  };

  const handleAddCashError = async (error: CashError) => {
      const { data } = await supabase.from('cash_errors').insert({
          store_id: error.storeId,
          user_id: error.userId,
          error_date: error.date,
          type: error.type,
          value: error.value,
          reason: error.reason
      }).select().single();

      if (data) {
          setCashErrors(prev => [...prev, { ...error, id: data.id }]);
          logAction('REPORT_CASH_ERROR', `Quebra de caixa: ${error.type} de R$${error.value}`);
      }
  };

  const handleUpdateCashError = async (error: CashError) => {
      await supabase.from('cash_errors').update({
          error_date: error.date,
          type: error.type,
          value: error.value,
          reason: error.reason
      }).eq('id', error.id);
      setCashErrors(prev => prev.map(e => e.id === error.id ? error : e));
  };

  const handleDeleteCashError = async (id: string) => {
      await supabase.from('cash_errors').delete().eq('id', id);
      setCashErrors(prev => prev.filter(e => e.id !== id));
  };

  const handleUploadDownload = async (item: DownloadItem) => {
      const { data } = await supabase.from('marketing_downloads').insert({
          title: item.title,
          description: item.description,
          category: item.category,
          url: item.url,
          file_name: item.fileName,
          file_size: item.size,
          campaign: item.campaign,
          created_by: item.createdBy
      }).select().single();

      if (data) {
          setDownloads(prev => [...prev, { ...item, id: data.id }]);
      }
  };

  const handleDeleteDownload = async (id: string) => {
      await supabase.from('marketing_downloads').delete().eq('id', id);
      setDownloads(prev => prev.filter(d => d.id !== id));
  };

  const handleStoreUpdate = async (updatedStores: Store[]) => {
      for (const s of updatedStores) {
          if (s.id.startsWith('s') || s.id.startsWith('req')) {
              const payload = {
                  number: s.number,
                  name: s.name,
                  city: s.city,
                  manager_name: s.managerName,
                  manager_email: s.managerEmail,
                  manager_phone: s.managerPhone,
                  status: s.status,
                  password: s.password
              };
              
              if (s.id.includes('-') && !s.id.startsWith('req')) {
                  await supabase.from('stores').update(payload).eq('id', s.id);
              } else {
                  await supabase.from('stores').insert(payload);
              }
          }
      }
      loadAllData();
  };

  const handleLogin = (u: User) => {
    setUser(u);
    logAction('LOGIN', `Usuário ${u.name} realizou login`, u);
    
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

  const openProfileModal = () => {
      if (user) {
          setTempProfile({ name: user.name, photo: user.photo || '' });
          setIsProfileModalOpen(true);
      }
  };

  const handleProfileSave = async (e: React.FormEvent) => {
      e.preventDefault();
      if (user) {
          const updatedUser = { ...user, name: tempProfile.name, photo: tempProfile.photo };
          await supabase.from('profiles').update({ name: tempProfile.name, photo_url: tempProfile.photo }).eq('id', user.id);
          setUser(updatedUser);
          setIsProfileModalOpen(false);
          logAction('SYSTEM', `Atualizou perfil de usuário: ${updatedUser.name}`);
      }
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          const reader = new FileReader();
          reader.onload = () => {
              setTempProfile(prev => ({ ...prev, photo: reader.result as string }));
          };
          reader.readAsDataURL(file);
      }
  };

  const renderView = () => {
    if (!user) return <LoginScreen onLogin={handleLogin} users={users} stores={stores} onRegisterRequest={(s) => setStores(prev => [...prev, s])} />;

    switch (currentView) {
      case 'dashboard':
        if (user.role === UserRole.CASHIER) return <AgendaSystem user={user} tasks={tasks} onAddTask={handleAddTask} onUpdateTask={handleUpdateTask} onDeleteTask={handleDeleteTask} onLogAction={logAction} />;
        return user.role === UserRole.MANAGER 
          ? <DashboardManager user={user} stores={stores} performanceData={performanceData} purchasingData={productData} />
          : <DashboardAdmin stores={stores} performanceData={performanceData} onImportData={setPerformanceData} onSaveGoals={handleSaveGoalsToSupabase} />;
      case 'purchases':
        return <DashboardPurchases stores={stores} data={productData} onImport={handleSaveProductPerformance} />;
      case 'cotas':
        return <CotasManagement 
                  user={user} 
                  stores={stores} 
                  cotas={cotas} 
                  cotaSettings={cotaSettings} 
                  cotaDebts={cotaDebts} 
                  onAddCota={handleAddCota} 
                  onDeleteCota={handleDeleteCota} 
                  onUpdateCota={handleUpdateCota} 
                  onSaveSettings={handleSaveCotaSettings} 
                  onSaveDebts={handleSaveCotaDebts}
                  onLogAction={logAction} 
                />;
      case 'financial':
        return <FinancialModule user={user} store={stores.find(s => s.id === user.storeId)} />;
      case 'agenda':
        return <AgendaSystem user={user} tasks={tasks} onAddTask={handleAddTask} onUpdateTask={handleUpdateTask} onDeleteTask={handleDeleteTask} onLogAction={logAction} />;
      case 'marketing':
        return <InstagramMarketing user={user} store={stores.find(s => s.id === user.storeId)} onRegisterDownload={(d) => { const id = `DL-${Date.now()}`; logAction('DOWNLOAD_IMAGE', d || 'Download de Imagem'); return id; }} />;
      case 'downloads':
        return <DownloadsModule user={user} items={downloads} onUpload={handleUploadDownload} onDelete={handleDeleteDownload} onLogAction={logAction} />;
      case 'audit':
        return <SystemAudit logs={logs} receipts={receipts} store={stores.find(s => s.id === user.storeId)} cashErrors={cashErrors} />;
      case 'cash_errors':
        return <CashErrorsModule user={user} store={stores.find(s => s.id === user.storeId)} stores={stores} errors={cashErrors} onAddError={handleAddCashError} onUpdateError={handleUpdateCashError} onDeleteError={handleDeleteCashError} />;
      case 'settings':
        return <AdminSettings stores={stores} onStoreUpdate={handleStoreUpdate} />;
      case 'auth_print':
        return <PurchaseAuthorization />;
      case 'termo_print':
        return <TermoAutorizacao user={user} store={stores.find(s => s.id === user.storeId)} />;
      default:
        return <div className="p-10">Página não encontrada</div>;
    }
  };

  if (!user) {
    if (isLoading) return <div className="min-h-screen flex items-center justify-center bg-gray-100"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-900"></div></div>;
    return <LoginScreen onLogin={handleLogin} users={users} stores={stores} onRegisterRequest={(s) => setStores([...stores, s])} />;
  }

  return (
    <div className="flex h-screen bg-gray-100 font-sans overflow-hidden">
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
              </>
            )}
          </nav>

          <div className="pt-4 border-t border-blue-800">
            <div onClick={openProfileModal} className="flex items-center gap-3 mb-4 px-2 cursor-pointer hover:bg-blue-800/50 p-2 rounded-lg transition-colors group" title="Clique para editar perfil">
               {user.photo ? <img src={user.photo} alt="Profile" className="w-9 h-9 rounded-full object-cover border-2 border-white/20 group-hover:border-white/50" /> : <div className="w-9 h-9 rounded-full bg-blue-700 flex items-center justify-center font-bold text-xs border-2 border-white/10 group-hover:border-white/50">{user.name.substring(0,2).toUpperCase()}</div>}
               <div className="overflow-hidden flex-1">
                  <p className="text-sm font-bold truncate group-hover:text-blue-100">{user.name}</p>
                  <p className="text-[10px] text-blue-300 uppercase">{user.role === UserRole.MANAGER ? 'Gerente' : user.role === UserRole.ADMIN ? 'Administrador' : user.role === UserRole.CASHIER ? 'Caixa' : user.role}</p>
               </div>
               <Settings size={14} className="text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <button onClick={handleLogout} className="w-full flex items-center gap-2 px-4 py-2 bg-red-600/20 text-red-300 hover:bg-red-600 hover:text-white rounded-lg transition-colors text-sm font-bold"><LogOut size={16} /> Sair do Sistema</button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
         <div className="md:hidden bg-white shadow-sm p-4 flex justify-between items-center z-40">
            <h1 className="text-lg font-black italic text-blue-900">REAL <span className="text-red-500">CALÇADOS</span></h1>
            <button onClick={() => setIsSidebarOpen(true)} className="text-gray-600"><Menu size={24}/></button>
         </div>
         <main className="flex-1 overflow-auto bg-gray-50 relative">{renderView()}</main>
      </div>

      {isProfileModalOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] p-4 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
                <div className="bg-gradient-to-r from-blue-900 to-blue-800 p-6 flex justify-between items-center">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2"><UserIcon size={20} /> Editar Perfil</h3>
                    <button onClick={() => setIsProfileModalOpen(false)} className="text-blue-200 hover:text-white transition-colors"><X size={20} /></button>
                </div>
                <form onSubmit={handleProfileSave} className="p-6 space-y-6">
                    <div className="flex flex-col items-center">
                        <div className="w-24 h-24 rounded-full bg-gray-100 mb-3 overflow-hidden border-4 border-blue-50 relative group cursor-pointer shadow-inner" onClick={() => document.getElementById('profile-upload')?.click()}>
                            {tempProfile.photo ? <img src={tempProfile.photo} className="w-full h-full object-cover" alt="Preview" /> : <UserIcon className="w-10 h-10 text-gray-300 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />}
                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><Camera size={24} className="text-white drop-shadow-md" /></div>
                        </div>
                        <input type="file" id="profile-upload" className="hidden" accept="image/*" onChange={handlePhotoUpload} />
                        <span className="text-xs text-blue-600 font-bold cursor-pointer hover:underline" onClick={() => document.getElementById('profile-upload')?.click()}>Alterar Foto</span>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nome de Exibição</label>
                        <input value={tempProfile.name} onChange={(e) => setTempProfile({...tempProfile, name: e.target.value})} className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all" required placeholder="Seu nome" />
                    </div>
                    <div className="flex gap-3 pt-2">
                        <button type="button" onClick={() => setIsProfileModalOpen(false)} className="flex-1 py-3 bg-gray-100 text-gray-700 font-bold rounded-lg hover:bg-gray-200 transition-colors">Cancelar</button>
                        <button type="submit" className="flex-1 py-3 bg-blue-700 hover:bg-blue-800 text-white font-bold rounded-lg shadow-md transition-all flex items-center justify-center gap-2">Salvar Alterações</button>
                    </div>
                </form>
            </div>
        </div>
      )}
    </div>
  );
};

export default App;
