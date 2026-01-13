
import React, { useState, useEffect, useMemo } from 'react';
import { LayoutDashboard, ShoppingBag, Calculator, DollarSign, Instagram, Download, AlertOctagon, FileSignature, LogOut, Menu, Calendar, Settings, X, FileText, UserCog, History, Sliders, Banknote, Target, Loader2, ShieldCheck, ShieldAlert, IceCream, Info } from 'lucide-react';
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
import { User, Store, MonthlyPerformance, UserRole, Cota, AgendaItem, DownloadItem, SystemLog, CashError, CotaSettings, CotaDebt, IceCreamItem, IceCreamDailySale, IceCreamTransaction, PagePermission, CashRegisterClosure, ProductPerformance, CreditCardSale, Receipt, StoreProfitPartner, IceCreamStock } from './types';
import { supabase } from './services/supabaseClient';
import { useAuthorization } from './security/useAuthorization';
import { PermissionKey } from './security/permissions';

const ICON_MAP: Record<string, React.ElementType> = {
    dashboard: LayoutDashboard, metas_registration: Target, purchases: ShoppingBag, cotas: Calculator, 
    icecream: IceCream, cash_register: Banknote, financial: DollarSign, cash_errors: AlertOctagon, 
    agenda: Calendar, marketing: Instagram, downloads: Download, auth_print: FileSignature, 
    termo_print: FileText, admin_users: UserCog, access_control: Sliders, audit: History, settings: Settings
};

const ROUTE_PERMISSIONS: Record<string, PermissionKey> = {
    dashboard: 'MODULE_DASHBOARD', metas_registration: 'MODULE_METAS', purchases: 'MODULE_PURCHASES', 
    cotas: 'MODULE_COTAS', icecream: 'MODULE_ICECREAM', cash_register: 'MODULE_CASH_REGISTER', 
    financial: 'MODULE_FINANCIAL', cash_errors: 'MODULE_CASH_ERRORS', agenda: 'MODULE_AGENDA', 
    marketing: 'MODULE_MARKETING', downloads: 'MODULE_DOWNLOADS', auth_print: 'MODULE_DOCUMENTS', 
    termo_print: 'MODULE_DOCUMENTS', admin_users: 'MODULE_ADMIN_USERS', access_control: 'MODULE_ACCESS_CONTROL', 
    audit: 'MODULE_AUDIT', settings: 'MODULE_SETTINGS'
};

const NavButton: React.FC<{ view: string; icon: React.ElementType; label: string; active?: boolean; onClick?: () => void; }> = ({ icon: Icon, label, active, onClick }) => (
  <button onClick={onClick} className={`w-full flex items-center justify-between px-4 py-2.5 text-[11px] font-bold transition-all border-l-4 group ${active ? 'bg-white/10 border-red-500 text-white shadow-inner' : 'border-transparent text-blue-100 hover:bg-white/5 hover:text-white'}`}>
    <div className="flex items-center gap-3">
      <Icon size={16} className={active ? 'text-red-400' : 'text-blue-300 group-hover:text-white'} />
      <span className="uppercase tracking-tight truncate">{label}</span>
    </div>
  </button>
);

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [currentView, setCurrentView] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { can } = useAuthorization(user?.role);

  // Estados Globais
  const [stores, setStores] = useState<Store[]>([]);
  const [performanceData, setPerformanceData] = useState<MonthlyPerformance[]>([]);
  const [purchasingData, setPurchasingData] = useState<ProductPerformance[]>([]);
  const [cotas, setCotas] = useState<Cota[]>([]);
  const [cotaSettings, setCotaSettings] = useState<CotaSettings[]>([]);
  const [cotaDebts, setCotaDebts] = useState<CotaDebt[]>([]);
  const [tasks, setTasks] = useState<AgendaItem[]>([]);
  const [downloadItems, setDownloadItems] = useState<DownloadItem[]>([]);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [cashErrors, setCashErrors] = useState<CashError[]>([]);
  const [closures, setClosures] = useState<CashRegisterClosure[]>([]);
  const [logs, setLogs] = useState<SystemLog[]>([]);
  
  // Estados Gelateria
  const [iceCreamItems, setIceCreamItems] = useState<IceCreamItem[]>([]);
  const [iceCreamStock, setIceCreamStock] = useState<IceCreamStock[]>([]);
  const [iceCreamSales, setIceCreamSales] = useState<IceCreamDailySale[]>([]);
  const [iceCreamFinances, setIceCreamFinances] = useState<IceCreamTransaction[]>([]);
  const [profitPartners, setProfitPartners] = useState<StoreProfitPartner[]>([]);

  const loadAllData = async () => {
      if (!user) return;
      setIsLoading(true);
      try {
        const [
          resStores, resPerf, resPurch, resCotas, resCotaSettings, resCotaDebts, 
          resTasks, resDownloads, resReceipts, resCashErrors, resClosures, resLogs,
          resIceItems, resIceStock, resIceSales, resIceFin, resPartners
        ] = await Promise.all([
          supabase.from('stores').select('*'),
          supabase.from('monthly_performance').select('*'),
          supabase.from('purchasing_performance').select('*'),
          supabase.from('cotas').select('*').order('created_at', { ascending: false }),
          supabase.from('cota_settings').select('*'),
          supabase.from('cota_debts').select('*').order('created_at', { ascending: false }),
          supabase.from('agenda_items').select('*').order('dueDate', { ascending: true }),
          supabase.from('downloads').select('*').order('createdAt', { ascending: false }),
          supabase.from('receipts').select('*').order('createdAt', { ascending: false }),
          supabase.from('cash_errors').select('*').order('date', { ascending: false }),
          supabase.from('cash_register_closures').select('*').order('created_at', { ascending: false }),
          supabase.from('system_logs').select('*').order('created_at', { ascending: false }).limit(50),
          supabase.from('ice_cream_items').select('*'),
          supabase.from('ice_cream_stock').select('*'),
          supabase.from('ice_cream_daily_sales').select('*').order('created_at', { ascending: false }),
          supabase.from('ice_cream_transactions').select('*'),
          supabase.from('store_profit_partners').select('*')
        ]);

        if (resStores.data) setStores(resStores.data.map((s: any) => ({ ...s, role: s.role || UserRole.MANAGER })));
        if (resPerf.data) setPerformanceData(resPerf.data as any[]);
        if (resPurch.data) setPurchasingData(resPurch.data as any[]);
        
        if (resCotas.data) setCotas(resCotas.data.map((d: any) => ({
            id: d.id, 
            storeId: d.store_id, 
            brand: d.brand, 
            classification: d.classification,
            totalValue: Number(d.total_value), 
            shipmentDate: d.shipment_date ? d.shipment_date.substring(0, 7) : '', 
            paymentTerms: d.payment_terms,
            pairs: d.pairs, 
            installments: typeof d.installments === 'string' ? JSON.parse(d.installments) : (d.installments || {}), 
            status: d.status, 
            createdByRole: d.created_by_role || 'COMPRADOR',
            createdAt: new Date(d.created_at)
        })));

        if (resCotaSettings.data) setCotaSettings(resCotaSettings.data.map((s: any) => ({
            storeId: s.store_id, budgetValue: Number(s.budget_value), managerPercent: Number(s.manager_percent)
        })));
        if (resCotaDebts.data) setCotaDebts(resCotaDebts.data.map((d: any) => ({ 
            id: d.id, storeId: d.store_id, month: d.month, value: Number(d.value), description: d.description 
        })));
        
        if (resTasks.data) setTasks(resTasks.data as any[]);
        if (resDownloads.data) setDownloadItems(resDownloads.data as any[]);
        if (resReceipts.data) setReceipts(resReceipts.data as any[]);
        if (resCashErrors.data) setCashErrors(resCashErrors.data as any[]);
        if (resClosures.data) setClosures(resClosures.data as any[]);
        if (resLogs.data) setLogs(resLogs.data as any[]);
        
        if (resIceItems.data) setIceCreamItems(resIceItems.data as any[]);
        if (resIceStock.data) setIceCreamStock(resIceStock.data as any[]);
        if (resIceSales.data) setIceCreamSales(resIceSales.data as any[]);
        if (resIceFin.data) setIceCreamFinances(resIceFin.data as any[]);
        if (resPartners.data) setProfitPartners(resPartners.data as any[]);

      } catch (error) { console.error("Erro no carregamento mestre:", error); } finally { setIsLoading(false); }
  };

  useEffect(() => { if (user) loadAllData(); }, [user]);

  // Fix Erro 400 - Normalização
  const normalizeDateForDB = (val: string) => {
    if (!val) return null;
    if (/^\d{4}-\d{2}$/.test(val)) return `${val}-01`;
    return val;
  };

  const handleAddCota = async (cota: Cota) => {
    const { error } = await supabase.from('cotas').insert([{
      store_id: cota.storeId, 
      brand: cota.brand, 
      classification: cota.classification,
      total_value: cota.totalValue, 
      shipment_date: normalizeDateForDB(cota.shipmentDate), 
      payment_terms: cota.paymentTerms,
      pairs: cota.pairs || 0, 
      installments: cota.installments, 
      status: cota.status || 'pending', 
      created_by_role: cota.createdByRole || 'COMPRADOR'
    }]);
    if (!error) await loadAllData();
    else alert(`Erro: ${error.message}`);
  };

  const renderView = () => {
    if (!user) return <LoginScreen onLoginAttempt={async (e, p) => { 
        const { data: admin } = await supabase.from('admin_users').select('*').eq('email', e).eq('password', p).maybeSingle();
        if (admin) { const u = { id: admin.id, name: admin.name, email: admin.email, role: UserRole.ADMIN }; setUser(u); return { success: true, user: u }; }
        const { data: store } = await supabase.from('stores').select('*').eq('manager_email', e).eq('password', p).maybeSingle();
        if (store) { const u = { id: store.id, name: store.manager_name, email: store.manager_email, role: store.role as UserRole, storeId: store.id }; setUser(u); return { success: true, user: u }; }
        return { success: false, error: 'Credenciais inválidas' };
    }} onRegisterRequest={async (s) => { await supabase.from('stores').insert([{ ...s, status: 'pending' }]); }} />;

    switch (currentView) {
      // INTELIGÊNCIA
      case 'dashboard': return user.role === UserRole.MANAGER ? <DashboardManager user={user} stores={stores} performanceData={performanceData} purchasingData={purchasingData} /> : <DashboardAdmin stores={stores} performanceData={performanceData} onImportData={async (d) => { await supabase.from('monthly_performance').upsert(d); loadAllData(); }} />;
      case 'metas_registration': return <GoalRegistration stores={stores} performanceData={performanceData} onUpdateData={async (d) => { await supabase.from('monthly_performance').upsert(d); loadAllData(); }} />;
      case 'purchases': return <DashboardPurchases stores={stores} data={purchasingData} onImport={async (d) => { await supabase.from('purchasing_performance').insert(d); loadAllData(); }} />;
      case 'cotas': return <CotasManagement user={user} stores={stores} cotas={cotas} cotaSettings={cotaSettings} cotaDebts={cotaDebts} performanceData={performanceData} onAddCota={handleAddCota} onUpdateCota={async (id, upd) => { await supabase.from('cotas').update(upd).eq('id', id); loadAllData(); }} onDeleteCota={async (id) => { await supabase.from('cotas').delete().eq('id', id); loadAllData(); }} onSaveSettings={async (s) => { await supabase.from('cota_settings').upsert({ store_id: s.storeId, budget_value: s.budgetValue, manager_percent: s.managerPercent }); loadAllData(); }} onSaveDebts={async (d) => { await supabase.from('cota_debts').insert([{ store_id: d.storeId, month: d.month, value: d.value, description: d.description }]); loadAllData(); }} onDeleteDebt={async (id) => { await supabase.from('cota_debts').delete().eq('id', id); loadAllData(); }} />;
      
      // OPERAÇÃO
      case 'icecream': return <IceCreamModule user={user} stores={stores} items={iceCreamItems} stock={iceCreamStock} sales={iceCreamSales} finances={iceCreamFinances} profitPartners={profitPartners} onAddSales={async (s) => { await supabase.from('ice_cream_daily_sales').insert(s); loadAllData(); }} onCancelSale={async (code, r) => { await supabase.from('ice_cream_daily_sales').update({ status: 'canceled', cancel_reason: r, canceled_by: user.name }).eq('sale_code', code); loadAllData(); }} onUpdatePrice={async (id, p) => { await supabase.from('ice_cream_items').update({ price: p }).eq('id', id); loadAllData(); }} onUpdateItem={async (i) => { await supabase.from('ice_cream_items').update(i).eq('id', i.id); loadAllData(); }} onAddTransaction={async (t) => { await supabase.from('ice_cream_transactions').insert([t]); loadAllData(); }} onDeleteTransaction={async (id) => { await supabase.from('ice_cream_transactions').delete().eq('id', id); loadAllData(); }} onAddItem={async (n, c, p, f, s, u, cons, t) => { await supabase.from('ice_cream_items').insert([{ name: n, category: c, price: p, flavor: f, store_id: t || user.storeId }]); loadAllData(); }} onDeleteItem={async (id) => { await supabase.from('ice_cream_items').delete().eq('id', id); loadAllData(); }} onUpdateStock={async (sid, b, v, u, type) => { await supabase.from('ice_cream_stock').upsert({ store_id: sid, product_base: b, stock_current: v, unit: u }); loadAllData(); }} onAddProfitPartner={async (p) => { await supabase.from('store_profit_partners').insert([p]); loadAllData(); }} onUpdateProfitPartner={async (p) => { await supabase.from('store_profit_partners').update(p).eq('id', p.id); loadAllData(); }} onDeleteProfitPartner={async (id) => { await supabase.from('store_profit_partners').delete().eq('id', id); loadAllData(); }} />;
      case 'cash_register': return <CashRegisterModule user={user} sales={iceCreamSales} finances={iceCreamFinances} closures={closures} onAddClosure={async (c) => { await supabase.from('cash_register_closures').insert([{ ...c, storeId: user.storeId, closedBy: user.name }]); loadAllData(); }} />;
      case 'financial': return <FinancialModule user={user} store={stores.find(s => s.id === user.storeId)} sales={[]} receipts={receipts} onAddSale={async () => {}} onDeleteSale={async () => {}} onAddReceipt={async (r) => { await supabase.from('receipts').insert([r]); loadAllData(); }} />;
      case 'cash_errors': return <CashErrorsModule user={user} stores={stores} errors={cashErrors} onAddError={async (e) => { await supabase.from('cash_errors').insert([e]); loadAllData(); }} onUpdateError={async (e) => { await supabase.from('cash_errors').update(e).eq('id', e.id); loadAllData(); }} onDeleteError={async (id) => { await supabase.from('cash_errors').delete().eq('id', id); loadAllData(); }} />;
      case 'agenda': return <AgendaSystem user={user} tasks={tasks} onAddTask={async (t) => { await supabase.from('agenda_items').insert([t]); loadAllData(); }} onUpdateTask={async (t) => { await supabase.from('agenda_items').update(t).eq('id', t.id); loadAllData(); }} onDeleteTask={async (id) => { await supabase.from('agenda_items').delete().eq('id', id); loadAllData(); }} />;
      
      // MARKETING
      case 'marketing': return <InstagramMarketing user={user} store={stores.find(s => s.id === user.storeId)} />;
      
      // DOCUMENTOS
      case 'downloads': return <DownloadsModule user={user} items={downloadItems} onUpload={async (i) => { await supabase.from('downloads').insert([i]); loadAllData(); }} onDelete={async (id) => { await supabase.from('downloads').delete().eq('id', id); loadAllData(); }} />;
      case 'auth_print': return <PurchaseAuthorization />;
      case 'termo_print': return <TermoAutorizacao user={user} store={stores.find(s => s.id === user.storeId)} />;
      
      // ADMINISTRAÇÃO
      case 'admin_users': return <AdminUsersManagement currentUser={user} />;
      case 'access_control': return <AccessControlManagement />;
      case 'audit': return <SystemAudit logs={logs} receipts={receipts} cashErrors={cashErrors} />;
      case 'settings': return <AdminSettings stores={stores} onAddStore={async (s) => { await supabase.from('stores').insert([s]); loadAllData(); }} onUpdateStore={async (s) => { await supabase.from('stores').update(s).eq('id', s.id); loadAllData(); }} onDeleteStore={async (id) => { await supabase.from('stores').delete().eq('id', id); loadAllData(); }} />;
      
      default: return <DashboardAdmin stores={stores} performanceData={performanceData} onImportData={async () => {}} />;
    }
  };

  return (
    <div className="flex h-screen bg-gray-100 font-sans overflow-hidden">
      {user && (
      <>
        <header className="fixed top-0 left-0 right-0 h-16 bg-white border-b z-[60] flex items-center justify-between px-6 shadow-sm">
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full border bg-white overflow-hidden flex items-center justify-center font-black text-blue-900 italic">RC</div>
                <div>
                   <span className="font-black italic text-blue-950 uppercase tracking-tighter text-xl">REAL <span className="text-red-600">ADMIN</span></span>
                   <p className="text-[7px] text-gray-400 font-black uppercase tracking-widest mt-0.5">PLATAFORMA CORPORATIVA</p>
                </div>
                <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="md:hidden p-2 text-gray-600 ml-4"><Menu size={24} /></button>
            </div>
            <div className="flex items-center gap-4 text-right">
                {isLoading && <Loader2 size={16} className="animate-spin text-blue-600" />}
                <div className="hidden sm:block text-right">
                   <p className="text-[10px] font-black uppercase text-gray-900 leading-none">{user.name}</p>
                   <p className="text-[8px] font-bold text-blue-400 uppercase italic mt-1">{user.role}</p>
                </div>
                <button onClick={() => { setUser(null); window.location.reload(); }} className="p-2.5 text-gray-400 hover:text-red-600 transition-all ml-2"><LogOut size={20}/></button>
            </div>
        </header>

        <div className={`fixed md:sticky top-16 left-0 h-[calc(100vh-64px)] w-64 bg-gradient-to-b from-[#0f172a] to-[#1e3a8a] text-white shadow-2xl z-50 transition-transform duration-300 border-r border-blue-900 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
            <div className="p-4 flex flex-col h-full overflow-y-auto no-scrollbar">
                {[
                  { group: 'Operação', items: ['icecream', 'cash_register', 'financial', 'cash_errors', 'agenda'] },
                  { group: 'Inteligência', items: ['dashboard', 'metas_registration', 'purchases', 'cotas'] },
                  { group: 'Marketing', items: ['marketing'] },
                  { group: 'Documentos', items: ['downloads', 'auth_print', 'termo_print'] },
                  { group: 'Administração', items: ['admin_users', 'access_control', 'audit', 'settings'] }
                ].map(group => (
                  <div key={group.group} className="mb-6">
                    <div className="px-4 py-2 text-[9px] font-black uppercase tracking-[0.2em] text-blue-400 opacity-60 mb-1">{group.group}</div>
                    {group.items.map(key => {
                        const perm = ROUTE_PERMISSIONS[key];
                        if (!perm || !can(perm)) return null;
                        const labelMap: Record<string, string> = {
                          icecream: 'PDV Gelateria', cash_register: 'Fechamento Caixa', financial: 'Financeiro', cash_errors: 'Erros de Caixa', agenda: 'Agenda',
                          dashboard: 'Performance', metas_registration: 'Registro Metas', purchases: 'Gestão Compras', cotas: 'Gestão Cotas',
                          marketing: 'Marketing Real', downloads: 'Downloads', auth_print: 'Autorizações', termo_print: 'Termos',
                          admin_users: 'Usuários', access_control: 'Acessos', audit: 'Auditoria', settings: 'Configurações'
                        };
                        return <NavButton key={key} view={key} icon={ICON_MAP[key] || Info} label={labelMap[key] || key} active={currentView === key} onClick={() => { setCurrentView(key); setIsSidebarOpen(false); }} />;
                    })}
                  </div>
                ))}
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
