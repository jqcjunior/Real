
import React, { useState, useEffect, useMemo } from 'react';
import { 
  LayoutDashboard, ShoppingBag, Calculator, DollarSign, Instagram, Download, 
  AlertOctagon, FileSignature, LogOut, Menu, Calendar, Settings, X, 
  FileText, UserCog, History, Sliders, Banknote, Target, Loader2, 
  IceCream, Info, BarChart3, Wifi, AlertTriangle, Clock, ShieldAlert,
  ChevronRight, MonitorPlay, Users as UsersIcon, ShieldCheck, Shield
} from 'lucide-react';
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
import { User, Store, MonthlyPerformance, UserRole, Cota, AgendaItem, DownloadItem, SystemLog, CashError, CotaSettings, CotaDebts, IceCreamItem, IceCreamDailySale, IceCreamPaymentMethod, IceCreamTransaction, PagePermission, CashRegisterClosure, ProductPerformance, Receipt, IceCreamStock, IceCreamPromissoryNote, IceCreamRecipeItem } from './types';
import { supabase } from './services/supabaseClient';
import { useAuthorization } from './security/useAuthorization';
import { PermissionKey } from './security/permissions';

// Componente de botão de navegação otimizado
const NavButton: React.FC<{ 
  view: string; 
  icon: React.ElementType; 
  label: string; 
  active?: boolean; 
  onClick?: () => void; 
  permission: PermissionKey;
  can: (p: PermissionKey) => boolean;
}> = ({ icon: Icon, label, active, onClick, permission, can }) => {
  if (!can(permission)) return null;
  
  return (
    <button 
      onClick={onClick} 
      className={`w-full flex items-center gap-3 px-4 py-3.5 text-left transition-all border-l-4 group ${
        active 
          ? 'bg-white/10 border-red-500 text-white shadow-inner' 
          : 'border-transparent text-blue-100/60 hover:bg-white/5 hover:text-white'
      }`}
    >
      <Icon 
        size={18} 
        className={`${active ? 'text-red-400' : 'text-blue-300 group-hover:text-white'}`} 
      />
      <span className="text-[11px] font-black uppercase tracking-widest leading-none truncate">
        {label}
      </span>
    </button>
  );
};

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [currentView, setCurrentView] = useState('dashboard_manager');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { can } = useAuthorization(user?.role);

  // States de Dados
  const [stores, setStores] = useState<Store[]>([]);
  const [performanceData, setPerformanceData] = useState<MonthlyPerformance[]>([]);
  const [purchasingData, setPurchasingData] = useState<ProductPerformance[]>([]);
  const [cotas, setCotas] = useState<Cota[]>([]);
  const [cotaSettings, setCotaSettings] = useState<CotaSettings[]>([]);
  const [cotaDebts, setCotaDebts] = useState<CotaDebts[]>([]);
  const [downloads, setDownloads] = useState<DownloadItem[]>([]);
  const [cashErrors, setCashErrors] = useState<CashError[]>([]);
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [closures, setClosures] = useState<CashRegisterClosure[]>([]);
  const [agendaTasks, setAgendaTasks] = useState<AgendaItem[]>([]);
  
  // Gelateria States
  const [iceCreamItems, setIceCreamItems] = useState<IceCreamItem[]>([]);
  const [iceCreamStock, setIceCreamStock] = useState<IceCreamStock[]>([]);
  const [iceCreamSales, setIceCreamSales] = useState<IceCreamDailySale[]>([]);
  const [iceCreamFinances, setIceCreamFinances] = useState<IceCreamTransaction[]>([]);
  const [iceCreamPromissories, setIceCreamPromissories] = useState<IceCreamPromissoryNote[]>([]);

  const fetchData = async () => {
    try {
      const { data: sData } = await supabase.from('stores').select('*');
      if (sData) {
        const mappedStores: Store[] = sData.map(s => ({
          id: s.id, number: s.number, name: s.name, city: s.city, managerName: s.manager_name || '', managerEmail: s.manager_email || '', managerPhone: s.manager_phone || '', status: s.status, role: s.role as UserRole, passwordResetRequested: s.password_reset_requested
        }));
        setStores(mappedStores);
      }
      loadModuleData();
    } catch (error) { console.error("Erro no carregamento:", error); }
  };

  const loadModuleData = async () => {
    const [
      { data: perf }, { data: pur }, { data: cData }, { data: cs }, { data: cd },
      { data: dl }, { data: ce }, { data: sl }, { data: rc }, { data: cl }, { data: ag },
      { data: icI }, { data: icSt }, { data: icSa }, { data: icF }, { data: icP }
    ] = await Promise.all([
      supabase.from('monthly_performance').select('*'),
      supabase.from('product_performance').select('*'),
      supabase.from('cotas').select('*'),
      supabase.from('cota_settings').select('*'),
      supabase.from('cota_debts').select('*'),
      supabase.from('downloads').select('*'),
      supabase.from('cash_errors').select('*'),
      supabase.from('system_logs').select('*').order('created_at', { ascending: false }).limit(100),
      supabase.from('receipts').select('*'),
      supabase.from('cash_register_closures').select('*'),
      supabase.from('agenda_tasks').select('*'),
      supabase.from('ice_cream_items').select('*'),
      supabase.from('ice_cream_stock').select('*'),
      supabase.from('ice_cream_daily_sales').select('*').order('created_at', { ascending: false }),
      supabase.from('ice_cream_finances').select('*').order('date', { ascending: false }),
      supabase.from('ice_cream_promissory_notes').select('*')
    ]);

    if (perf) setPerformanceData(perf.map(p => ({
        id: p.id, storeId: p.store_id, month: p.month, revenueTarget: Number(p.revenue_target || 0), revenueActual: Number(p.revenue_actual || 0), percentMeta: Number(p.percent_meta || 0), itemsTarget: Number(p.items_target || 0), itemsActual: Number(p.items_actual || 0), itemsPerTicket: Number(p.pa_actual || 0), unitPriceAverage: Number(p.pu_actual || 0), averageTicket: Number(p.ticket_actual || 0), delinquencyRate: Number(p.delinquency_actual || 0), paTarget: Number(p.pa_target || 0), ticketTarget: Number(p.ticket_target || 0), puTarget: Number(p.pu_target || 0), delinquencyTarget: Number(p.delinquency_target || 0), businessDays: Number(p.business_days || 26), trend: p.trend || 'stable', correctedDailyGoal: Number(p.corrected_daily_goal || 0)
    })));
    
    if (pur) setPurchasingData(pur);
    if (cData) setCotas(cData.map(c => ({ id: c.id, storeId: c.store_id, brand: c.brand, totalValue: Number(c.total_value), shipmentDate: String(c.shipment_date), paymentTerms: c.payment_terms, pairs: Number(c.pairs || 0), classification: c.classification, installments: typeof c.installments === 'string' ? JSON.parse(c.installments) : c.installments, createdByRole: c.created_by_role, status: c.status, createdAt: new Date(c.created_at) })));
    if (cs) setCotaSettings(cs.map(s => ({ storeId: s.store_id, budgetValue: Number(s.budget_value), managerPercent: Number(s.manager_percent) })));
    if (cd) setCotaDebts(cd.map(d => ({ id: d.id, storeId: d.store_id, month: d.month, value: Number(d.value), description: d.description })));
    if (dl) setDownloads(dl);
    if (ce) setCashErrors(ce);
    if (sl) setLogs(sl);
    if (rc) setReceipts(rc);
    if (cl) setClosures(cl);
    
    if (icI) setIceCreamItems(icI.map(i => ({ 
        id: i.id, storeId: i.store_id, name: i.name, category: i.category as any, price: Number(i.price), flavor: i.flavor, active: i.active, consumptionPerSale: Number(i.consumption_per_sale), image_url: i.image_url, 
        recipe: typeof i.recipe === 'string' ? JSON.parse(i.recipe) : (i.recipe || []) 
    })));
    if (icSt) setIceCreamStock(icSt);
    // Fix: Updated mapping keys to match IceCreamDailySale interface camelCase property names
    if (icSa) setIceCreamSales(icSa.map(s => ({ 
        id: s.id, storeId: s.store_id, itemId: s.item_id, productName: s.product_name, category: s.category, flavor: s.flavor, unitsSold: Number(s.units_sold || 0), unitPrice: Number(s.unit_price || 0), totalValue: Number(s.total_value || 0), paymentMethod: s.payment_method as IceCreamPaymentMethod, createdAt: s.created_at, saleCode: s.sale_code, status: s.status, buyer_name: s.buyer_name 
    })));
    if (icF) setIceCreamFinances(icF.map(f => ({ 
        id: f.id, storeId: f.store_id, date: f.date, type: f.type as any, category: f.category, value: Number(f.value), description: f.description, createdAt: new Date(f.created_at) 
    })));
    if (icP) setIceCreamPromissories(icP);

    if (ag) setAgendaTasks(ag.map(t => ({ 
        id: t.id, userId: t.user_id, title: t.title, description: t.description, dueDate: t.due_date, due_time: t.due_time || '00:00:00', priority: t.priority, isCompleted: t.is_completed, createdAt: new Date(t.created_at), reminder_level: t.reminder_level || 1, reminded_at: t.reminded_at, completed_note: t.completed_note 
    })));
  };

  useEffect(() => { fetchData(); }, [user?.id]);

  useEffect(() => {
    if (user?.role === UserRole.ADMIN) { setCurrentView('dashboard_admin'); } 
    else if (user?.role === UserRole.ICE_CREAM) { setCurrentView('icecream'); } 
    else { setCurrentView('dashboard_manager'); }
  }, [user]);

  const handlePerformanceImport = async (incomingData: MonthlyPerformance[]) => {
      const snakeData = incomingData.map(newItem => {
          const existing = performanceData.find(p => p.storeId === newItem.storeId && p.month === newItem.month);
          const mergeVal = (newVal: any, oldVal: any) => { const n = Number(newVal); const o = Number(oldVal); return n > 0 ? n : (o || 0); };
          return {
              store_id: newItem.storeId, month: newItem.month, revenue_target: mergeVal(newItem.revenueTarget, existing?.revenueTarget), revenue_actual: mergeVal(newItem.revenueActual, existing?.revenueActual), items_target: Math.round(mergeVal(newItem.itemsTarget, existing?.itemsTarget)), items_actual: Math.round(mergeVal(newItem.itemsActual, existing?.itemsActual)), pa_actual: mergeVal(newItem.itemsPerTicket, existing?.itemsPerTicket), pu_actual: mergeVal(newItem.unitPriceAverage, existing?.unitPriceAverage), ticket_actual: mergeVal(newItem.averageTicket, existing?.averageTicket), delinquency_actual: mergeVal(newItem.delinquencyRate, existing?.delinquencyRate), percent_meta: mergeVal(newItem.percentMeta, existing?.percentMeta), business_days: Math.round(mergeVal(newItem.businessDays, existing?.businessDays || 26)), corrected_daily_goal: mergeVal(newItem.correctedDailyGoal, existing?.correctedDailyGoal), trend: newItem.trend || existing?.trend || 'stable'
          };
      });
      const { error } = await supabase.from('monthly_performance').upsert(snakeData, { onConflict: 'store_id,month' });
      if (error) throw error;
      await fetchData();
  };

  // LOGICA DE VENDA COM ABATIMENTO DE RECEITA (MULTI-ITEM)
  const handleIceCreamSale = async (salesList: IceCreamDailySale[]) => {
      for (const sale of salesList) {
          // Fix: Corrected property access from sale.product_name to sale.productName
          const { data: savedSale, error } = await supabase.from('ice_cream_daily_sales').insert([{
              store_id: sale.storeId, item_id: sale.itemId, product_name: sale.productName, category: sale.category, flavor: sale.flavor, units_sold: sale.unitsSold, unit_price: sale.unitPrice, total_value: sale.totalValue, payment_method: sale.paymentMethod, buyer_name: sale.buyer_name, sale_code: sale.saleCode
          }]).select().single();
          if (error) throw error;

          if (sale.paymentMethod === 'Fiado') {
              await supabase.from('ice_cream_promissory_notes').insert([{ store_id: sale.storeId, sale_id: savedSale.id, buyer_name: sale.buyer_name, value: sale.totalValue, status: 'pending' }]);
          }

          // Processamento da Receita (Ficha Técnica)
          const item = iceCreamItems.find(i => i.id === sale.itemId);
          if (item && item.recipe && item.recipe.length > 0) {
              for (const recipePart of item.recipe) {
                  const { data: stockItem } = await supabase.from('ice_cream_stock')
                    .select('*')
                    .eq('store_id', sale.storeId)
                    .eq('product_base', recipePart.stock_base_name)
                    .maybeSingle();

                  if (stockItem) {
                      const reduction = Number(recipePart.quantity) * sale.unitsSold;
                      await supabase.from('ice_cream_stock')
                        .update({ stock_current: stockItem.stock_current - reduction })
                        .eq('id', stockItem.id);
                  }
              }
          }
      }
      fetchData();
  };

  const logSystemAction = async (action: string, details: string) => {
    if (!user) return;
    try {
      await supabase.from('system_logs').insert([{ created_at: new Date().toISOString(), userId: user.id, userName: user.name, userRole: user.role, action: action, details: details }]);
      const { data: sl } = await supabase.from('system_logs').select('*').order('created_at', { ascending: false }).limit(100);
      if (sl) setLogs(sl);
    } catch (error) { console.error("Erro ao registrar log:", error); }
  };

  if (!user) {
    return (
      <LoginScreen onLoginAttempt={async (email, password) => {
        const { data: admin } = await supabase.from('admin_users').select('*').eq('email', email.toLowerCase()).eq('password', password).single();
        if (admin) {
          let roleMapped: UserRole = UserRole.MANAGER;
          if (admin.role_level === 'admin') roleMapped = UserRole.ADMIN;
          else if (admin.role_level === 'manager') roleMapped = UserRole.MANAGER;
          else if (admin.role_level === 'cashier') roleMapped = UserRole.CASHIER;
          else if (admin.role_level === 'sorvete') roleMapped = UserRole.ICE_CREAM;
          const u: User = { id: admin.id, name: admin.name, email: admin.email, role: roleMapped, storeId: admin.store_id || '' };
          setUser(u);
          return { success: true, user: u };
        }
        return { success: false, error: 'Credenciais inválidas.' };
      }} />
    );
  }

  return (
    <div className="flex h-screen bg-gray-900 text-white overflow-hidden font-sans relative">
      {/* MENU LATERAL COM OVERLAY MOBILE */}
      {isSidebarOpen && (
          <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[45] lg:hidden"
            onClick={() => setIsSidebarOpen(false)}
          />
      )}
      
      <div className={`fixed lg:relative z-50 w-64 h-full bg-gray-950 border-r border-white/5 flex flex-col shadow-2xl transition-transform duration-300 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="p-8 border-b border-white/5 mb-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-black italic uppercase tracking-tighter leading-none">Real <span className="text-red-600">Admin</span></h1>
            <p className="text-[8px] font-black text-blue-400 uppercase tracking-widest mt-2 opacity-50">Enterprise v28.1</p>
          </div>
          <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden text-gray-500 hover:text-white p-2"><X size={24}/></button>
        </div>

        <div className="flex-1 overflow-y-auto no-scrollbar space-y-6 px-2 pb-10">
          <div>
            <p className="px-4 mb-2 text-[9px] font-black uppercase tracking-widest text-gray-600">Inteligência</p>
            <NavButton view="dashboard_admin" icon={LayoutDashboard} label="Dashboard Rede" active={currentView === 'dashboard_admin'} onClick={() => { setCurrentView('dashboard_admin'); setIsSidebarOpen(false); }} permission="MODULE_DASHBOARD_ADMIN" can={can} />
            <NavButton view="dashboard_manager" icon={MonitorPlay} label="Dashboard Loja" active={currentView === 'dashboard_manager'} onClick={() => { setCurrentView('dashboard_manager'); setIsSidebarOpen(false); }} permission="MODULE_DASHBOARD_MANAGER" can={can} />
            <NavButton view="metas" icon={Target} label="Metas" active={currentView === 'metas'} onClick={() => { setCurrentView('metas'); setIsSidebarOpen(false); }} permission="MODULE_METAS" can={can} />
            <NavButton view="cotas" icon={Calculator} label="Cotas OTB" active={currentView === 'cotas'} onClick={() => { setCurrentView('cotas'); setIsSidebarOpen(false); }} permission="MODULE_COTAS" can={can} />
            <NavButton view="purchases" icon={ShoppingBag} label="Compras" active={currentView === 'purchases'} onClick={() => { setCurrentView('purchases'); setIsSidebarOpen(false); }} permission="MODULE_PURCHASES" can={can} />
          </div>
          <div>
            <p className="px-4 mb-2 text-[9px] font-black uppercase tracking-widest text-gray-600">Operacional</p>
            <NavButton view="icecream" icon={IceCream} label="PDV Gelateria" active={currentView === 'icecream'} onClick={() => { setCurrentView('icecream'); setIsSidebarOpen(false); }} permission="MODULE_ICECREAM" can={can} />
            <NavButton view="cash_register" icon={Banknote} label="Caixa" active={currentView === 'cash_register'} onClick={() => { setCurrentView('cash_register'); setIsSidebarOpen(false); }} permission="MODULE_CASH_REGISTER" can={can} />
            <NavButton view="financial" icon={DollarSign} label="Financeiro" active={currentView === 'financial'} onClick={() => { setCurrentView('financial'); setIsSidebarOpen(false); }} permission="MODULE_FINANCIAL" can={can} />
            <NavButton view="cash_errors" icon={AlertOctagon} label="Quebras" active={currentView === 'cash_errors'} onClick={() => { setCurrentView('cash_errors'); setIsSidebarOpen(false); }} permission="MODULE_CASH_ERRORS" can={can} />
            <NavButton view="agenda" icon={Calendar} label="Agenda Semanal" active={currentView === 'agenda'} onClick={() => { setCurrentView('agenda'); setIsSidebarOpen(false); }} permission="MODULE_AGENDA" can={can} />
            <NavButton view="downloads" icon={Download} label="Downloads" active={currentView === 'downloads'} onClick={() => { setCurrentView('downloads'); setIsSidebarOpen(false); }} permission="MODULE_DOWNLOADS" can={can} />
          </div>
          <div>
            <p className="px-4 mb-2 text-[9px] font-black uppercase tracking-widest text-gray-600">Marketing</p>
            <NavButton view="marketing" icon={Instagram} label="Studio Real" active={currentView === 'marketing'} onClick={() => { setCurrentView('marketing'); setIsSidebarOpen(false); }} permission="MODULE_MARKETING" can={can} />
          </div>
          <div>
            <p className="px-4 mb-2 text-[9px] font-black uppercase tracking-widest text-gray-600">Administração</p>
            <NavButton view="admin_users" icon={UsersIcon} label="Usuários" active={currentView === 'admin_users'} onClick={() => { setCurrentView('admin_users'); setIsSidebarOpen(false); }} permission="MODULE_ADMIN_USERS" can={can} />
            <NavButton view="access_control" icon={ShieldCheck} label="Acessos" active={currentView === 'access_control'} onClick={() => { setCurrentView('access_control'); setIsSidebarOpen(false); }} permission="MODULE_ACCESS_CONTROL" can={can} />
            <NavButton view="audit" icon={History} label="Auditoria" active={currentView === 'audit'} onClick={() => { setCurrentView('audit'); setIsSidebarOpen(false); }} permission="MODULE_AUDIT" can={can} />
            <NavButton view="settings" icon={Settings} label="Configurações" active={currentView === 'settings'} onClick={() => { setCurrentView('settings'); setIsSidebarOpen(false); }} permission="MODULE_SETTINGS" can={can} />
          </div>
        </div>

        <div className="p-4 bg-black/40 border-t border-white/5">
            <button onClick={() => setUser(null)} className="w-full py-3 bg-white/5 hover:bg-red-900/20 text-gray-400 hover:text-red-400 rounded-xl text-[10px] font-black uppercase transition-all flex items-center justify-center gap-2"><LogOut size={14} /> Desconectar</button>
        </div>
      </div>

      <div className="flex-1 flex flex-col h-full bg-[#f8fafc] overflow-hidden text-blue-950 relative">
        <header className="lg:hidden flex items-center justify-between p-4 bg-white border-b shrink-0 z-40 shadow-sm">
           <button onClick={() => setIsSidebarOpen(true)} className="p-2.5 bg-gray-100 rounded-xl text-gray-600 active:scale-95 transition-transform"><Menu size={24}/></button>
           <h1 className="text-xl font-black uppercase italic tracking-tighter">Real <span className="text-red-600">Admin</span></h1>
           <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl"><Wifi size={20}/></div>
        </header>

        <main className="flex-1 overflow-y-auto no-scrollbar relative">
            {(() => {
                if (currentView === 'dashboard_admin' && can('MODULE_DASHBOARD_ADMIN')) return <DashboardAdmin stores={stores} performanceData={performanceData} onImportData={handlePerformanceImport} />;
                if (currentView === 'dashboard_manager' && can('MODULE_DASHBOARD_MANAGER')) return <DashboardManager user={user} stores={stores} performanceData={performanceData} purchasingData={purchasingData} />;
                if (currentView === 'metas' && can('MODULE_METAS')) return <GoalRegistration stores={stores} performanceData={performanceData} onUpdateData={handlePerformanceImport} />;
                if (currentView === 'cotas' && can('MODULE_COTAS')) return <CotasManagement user={user} stores={stores} cotas={cotas} cotaSettings={cotaSettings} cotaDebts={cotaDebts} performanceData={performanceData} onAddCota={async (c) => { await supabase.from('cotas').insert([c]); fetchData(); }} onUpdateCota={async (id, u) => { await supabase.from('cotas').update(u).eq('id', id); fetchData(); }} onDeleteCota={async (id) => { await supabase.from('cotas').delete().eq('id', id); fetchData(); }} onSaveSettings={async (s) => { await supabase.from('cota_settings').upsert({ store_id: s.storeId, budget_value: s.budget_value, manager_percent: s.manager_percent }, { onConflict: 'store_id' }); fetchData(); }} onSaveDebts={async (d) => { await supabase.from('cota_debts').upsert({ store_id: d.store_id, month: d.month, value: d.value, description: d.description }, { onConflict: 'store_id,month' }); fetchData(); }} onDeleteDebt={async (id) => { await supabase.from('cota_debts').delete().eq('id', id); fetchData(); }} />;
                if (currentView === 'purchases' && can('MODULE_PURCHASES')) return <DashboardPurchases stores={stores} data={purchasingData} onImport={async (d) => { await supabase.from('product_performance').insert(d); fetchData(); }} />;
                if (currentView === 'icecream' && can('MODULE_ICECREAM')) return <IceCreamModule user={user} stores={stores} items={iceCreamItems} stock={iceCreamStock} sales={iceCreamSales} finances={iceCreamFinances} promissories={iceCreamPromissories} can={can} onAddSales={handleIceCreamSale} onAddTransaction={async (tx) => { await supabase.from('ice_cream_finances').insert([tx]); fetchData(); }} onDeleteItem={async (id) => { await supabase.from('ice_cream_items').delete().eq('id', id); fetchData(); }} onAddItem={async (name, cat, price, flavor, initialStock, unit, cons, target, recipe) => { 
                    const storeId = target || user.storeId;
                    const { error: itemError } = await supabase.from('ice_cream_items').insert([{ name, category: cat, price, flavor, consumption_per_sale: cons, store_id: storeId, recipe: JSON.stringify(recipe || []) }]); 
                    if (itemError) throw itemError;
                    fetchData(); 
                }} onUpdatePrice={async (id, p) => { await supabase.from('ice_cream_items').update({ price: p }).eq('id', id); fetchData(); }} onCancelSale={async (code, reason) => { await supabase.from('ice_cream_daily_sales').update({ status: 'canceled', cancel_reason: reason, canceled_by: user.name }).eq('sale_code', code); fetchData(); }} onUpdateStock={async (sid, base, val, unit, type) => { const existing = iceCreamStock.find(s => s.store_id === sid && s.product_base === base); if (existing) await supabase.from('ice_cream_stock').update({ stock_current: type === 'production' ? existing.stock_current + val : val }).eq('id', existing.id); else await supabase.from('ice_cream_stock').insert([{ store_id: sid, product_base: base, stock_initial: val, stock_current: val, unit }]); fetchData(); }} liquidatePromissory={async (id) => { await supabase.from('ice_cream_promissory_notes').update({ status: 'paid' }).eq('id', id); fetchData(); }} />;
                if (currentView === 'cash_register' && can('MODULE_CASH_REGISTER')) return <CashRegisterModule user={user} sales={iceCreamSales} finances={iceCreamFinances} closures={closures} onAddClosure={async (c) => { await supabase.from('cash_register_closures').insert([{ ...c, store_id: user.storeId, closed_by: user.name }]); fetchData(); }} />;
                if (currentView === 'financial' && can('MODULE_FINANCIAL')) return <FinancialModule user={user} store={stores.find(s => s.id === user.storeId)} sales={[]} receipts={receipts} onAddSale={async () => {}} onDeleteSale={async () => {}} onAddReceipt={async (r) => { await supabase.from('receipts').insert([r]); fetchData(); }} />;
                if (currentView === 'cash_errors' && can('MODULE_CASH_ERRORS')) return <CashErrorsModule user={user} stores={stores} errors={cashErrors} onAddError={async (e) => { await supabase.from('cash_errors').insert([e]); fetchData(); }} onUpdateError={async (e) => { await supabase.from('cash_errors').update(e).eq('id', e.id); fetchData(); }} onDeleteError={async (id) => { await supabase.from('cash_errors').delete().eq('id', id); fetchData(); }} />;
                if (currentView === 'agenda' && can('MODULE_AGENDA')) return <AgendaSystem user={user} tasks={agendaTasks} onAddTask={async (t) => { await supabase.from('agenda_tasks').insert([{ user_id: t.userId, title: t.title, description: t.description, due_date: t.due_date, due_time: t.due_time || '00:00:00', priority: t.priority, reminder_level: t.reminder_level }]); fetchData(); }} onUpdateTask={async (t) => { await supabase.from('agenda_tasks').update({ title: t.title, description: t.description, due_date: t.dueDate, due_time: t.dueTime, priority: t.priority, is_completed: t.is_completed, completed_note: t.completed_note, reminder_level: t.reminder_level }).eq('id', t.id); fetchData(); }} onDeleteTask={async (id) => { await supabase.from('agenda_tasks').delete().eq('id', id); fetchData(); }} />;
                if (currentView === 'downloads' && can('MODULE_DOWNLOADS')) return <DownloadsModule user={user} items={downloads} onUpload={async (i) => { await supabase.from('downloads').insert([i]); fetchData(); }} onDelete={async (id) => { await supabase.from('downloads').delete().eq('id', id); fetchData(); }} />;
                if (currentView === 'marketing' && can('MODULE_MARKETING')) return <InstagramMarketing user={user} store={stores.find(s => s.id === user.storeId)} />;
                if (currentView === 'admin_users' && can('MODULE_ADMIN_USERS')) return <AdminUsersManagement currentUser={user} />;
                if (currentView === 'access_control' && can('MODULE_ACCESS_CONTROL')) return <AccessControlManagement />;
                if (currentView === 'audit' && can('MODULE_AUDIT')) return <SystemAudit logs={logs} receipts={receipts} cashErrors={cashErrors} iceCreamSales={iceCreamSales} icPromissories={iceCreamPromissories} onLogAction={logSystemAction} />;
                if (currentView === 'settings' && can('MODULE_SETTINGS')) return <AdminSettings stores={stores} onAddStore={async (s) => { const payload = { number: String(s.number || ''), name: s.name || '', city: s.city || '', manager_name: s.managerName || '', manager_email: (s.managerEmail || '').toLowerCase().trim(), manager_phone: s.managerPhone || '', password: s.password || 'Real1234', status: s.status || 'active', role: s.role || 'MANAGER' }; await supabase.from('stores').insert([payload]); fetchData(); }} onUpdateStore={async (s) => { const payload: any = {}; if (s.name) payload.name = s.name.trim(); if (s.city) payload.city = s.city.trim(); if (s.managerName) payload.manager_name = s.managerName.trim(); if (s.managerEmail) payload.manager_email = s.managerEmail.trim().toLowerCase(); if (s.managerPhone) payload.manager_phone = s.managerPhone.trim(); if (s.password) payload.password = s.password; if (s.status) payload.status = s.status; if (s.role) payload.role = s.role; await supabase.from('stores').update(payload).eq('id', s.id); fetchData(); }} onDeleteStore={async (id) => { if(window.confirm("Confirmar exclusão?")) { await supabase.from('stores').delete().eq('id', id); fetchData(); } }} />;
                return <div className="p-20 text-center text-gray-300 font-black uppercase italic tracking-widest opacity-20">Módulo Não Selecionado ou Sem Acesso</div>;
            })()}
        </main>
      </div>
    </div>
  );
};

export default App;
