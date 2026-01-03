
import React, { useState, useEffect, useMemo } from 'react';
import { LayoutDashboard, ShoppingBag, Calculator, DollarSign, Instagram, Download, AlertOctagon, FileSignature, LogOut, Menu, Calendar, Settings, X, FileText, UserCog, History, Sliders, Banknote, Target } from 'lucide-react';
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

        const { data: dbIcItems } = await supabase.from('ice_cream_items').select('*').order('name', { ascending: true });
        if (dbIcItems) setIceCreamItems(dbIcItems.map((i: any) => ({
            id: i.id, name: i.name, category: i.category, price: Number(i.price), flavor: i.flavor, active: i.active,
            stockInitial: Number(i.stock_initial || 0), stockCurrent: Number(i.stock_current || 0), unit: i.unit || 'un', consumptionPerSale: Number(i.consumption_per_sale || 1)
        })));

        const { data: dbIcSales } = await supabase.from('ice_cream_daily_sales').select('*').order('created_at', { ascending: false });
        if (dbIcSales) setIceCreamSales(dbIcSales.map((s: any) => ({
            id: s.id, itemId: s.item_id, productName: s.product_name, category: s.category, flavor: s.flavor, ml: s.ml, unitsSold: s.units_sold, unitPrice: Number(s.unit_price), totalValue: Number(s.total_value), paymentMethod: s.payment_method, createdAt: s.created_at, saleCode: s.sale_code, status: s.status || 'active', cancelReason: s.cancel_reason, canceledBy: s.canceled_by
        })));

        const { data: dbIcFinances } = await supabase.from('ice_cream_finances').select('*').order('date', { ascending: false });
        if (dbIcFinances) setIceCreamFinances(dbIcFinances.map((f: any) => ({
            id: f.id, date: f.date, type: f.type, category: f.category, value: Number(f.value), employeeName: f.employee_name, description: f.description, createdAt: new Date(f.created_at)
        })));

        const { data: dbClosures } = await supabase.from('cash_register_closure').select('*').order('created_at', { ascending: false });
        if (dbClosures) setCashClosures(dbClosures.map((c: any) => ({
            id: c.id, storeId: c.store_id, closedBy: c.closed_by, date: c.date, total_sales: Number(c.total_sales), totalExpenses: Number(c.total_expenses), balance: Number(c.balance), notes: c.notes, createdAt: c.created_at
        })));

        const { data: dbPerf } = await supabase.from('monthly_performance').select('*');
        if (dbPerf) setPerformanceData(dbPerf.map((p: any) => ({ id: p.id, storeId: p.store_id, month: p.month, revenueTarget: Number(p.revenue_target), revenueActual: Number(p.revenue_actual), itemsTarget: p.items_target, itemsActual: p.items_actual, paTarget: Number(p.pa_target), itemsPerTicket: Number(p.pa_actual), ticketTarget: Number(p.ticket_target), averageTicket: Number(p.ticket_actual), puTarget: Number(p.pu_target), unitPriceAverage: Number(p.pu_actual), delinquencyTarget: Number(p.delinquency_target), delinquencyRate: Number(p.delinquency_actual), percentMeta: p.revenue_target > 0 ? (p.revenue_actual / p.revenue_target) * 100 : 0, trend: 'stable', correctedDailyGoal: 0 })));

        const { data: dbCotas } = await supabase.from('cotas').select('*').order('created_at', { ascending: false });
        if (dbCotas) setCotas(dbCotas.map((c: any) => ({ id: c.id, storeId: c.store_id, brand: c.brand, classification: c.classification, totalValue: Number(c.total_value), shipmentDate: c.shipment_date, paymentTerms: c.payment_terms, pairs: c.pairs, installments: c.installments, createdAt: new Date(c.created_at), createdByRole: c.created_by_role, status: c.status })));

        const { data: dbTasks } = await supabase.from('tasks').select('*');
        if (dbTasks) setTasks(dbTasks.map((t: any) => ({ id: t.id, userId: t.user_id, title: t.title, description: t.description, dueDate: t.due_date, priority: t.priority, isCompleted: t.is_completed, createdAt: new Date(t.created_at) })));

        const { data: dbDownloads } = await supabase.from('downloads').select('*');
        if (dbDownloads) setDownloads(dbDownloads.map((d: any) => ({ id: d.id, title: d.title, description: d.description, category: d.category, url: d.url, fileName: d.file_name, size: d.size, campaign: d.campaign, createdAt: new Date(d.created_at), createdBy: d.created_by })));

        // FIX: Corrigido erro 400 ao buscar logs. Coluna correta para ordenação é 'created_at'.
        const { data: dbLogs } = await supabase.from('system_logs').select('*').order('created_at', { ascending: false }).limit(200);
        if (dbLogs) setLogs(dbLogs.map((l: any) => ({ id: l.id, timestamp: l.created_at, userId: l.userId, userName: l.userName, userRole: l.userRole, action: l.action, details: l.details })));

        const { data: dbReceipts } = await supabase.from('receipts').select('*').order('created_at', { ascending: false });
        if (dbReceipts) setReceipts(dbReceipts.map((r: any) => ({ id: r.id, storeId: r.store_id, issuerName: r.issuer_name, payer: r.payer, recipient: r.recipient, value: Number(r.value), valueInWords: r.value_in_words, reference: r.reference, date: r.date, createdAt: new Date(r.created_at) })));

        const { data: dbCardSales } = await supabase.from('credit_card_sales').select('*').order('date', { ascending: false });
        if (dbCardSales) setCardSales(dbCardSales.map((cs: any) => ({ id: cs.id, storeId: cs.store_id, userId: cs.user_id, date: cs.date, brand: cs.brand, value: Number(cs.value), authorizationCode: cs.authorization_code })));

        const { data: dbCashErrors } = await supabase.from('cash_errors').select('*').order('date', { ascending: false });
        if (dbCashErrors) setCashErrors(dbCashErrors.map((ce: any) => ({ id: ce.id, storeId: ce.store_id, userId: ce.user_id, userName: ce.user_name, date: ce.date, type: ce.type, value: Number(ce.value), reason: ce.reason, createdAt: new Date(ce.created_at) })));

        const { data: dbProdPerf } = await supabase.from('product_performance').select('*');
        if (dbProdPerf) setPurchasingData(dbProdPerf.map((pp: any) => ({ storeId: pp.store_id, month: pp.month, brand: pp.brand, category: pp.category, pairsSold: pp.pairs_sold, revenue: Number(pp.revenue) })));

        const { data: dbCotaSettings } = await supabase.from('cota_settings').select('*');
        if (dbCotaSettings) setCotaSettings(dbCotaSettings.map((cs: any) => ({ storeId: cs.store_id, budgetValue: Number(cs.budget_value), managerPercent: cs.manager_percent })));

        const { data: dbCotaDebts } = await supabase.from('cota_debts').select('*');
        if (dbCotaDebts) setCotaDebts(dbCotaDebts.map((cd: any) => ({ id: cd.id, storeId: cd.store_id, month: cd.month, value: Number(cd.value) })));

      } catch (error) {
          console.error("Erro ao carregar dados:", error);
      } finally {
          setIsLoading(false);
      }
  };

  const handleRegisterRequest = async (storeData: Partial<Store>) => {
      const { error } = await supabase.from('stores').insert([{
          number: storeData.number,
          name: storeData.name,
          city: storeData.city,
          manager_name: storeData.managerName,
          manager_email: storeData.managerEmail?.toLowerCase(),
          manager_phone: storeData.managerPhone,
          password: storeData.password,
          status: 'pending',
          role: storeData.role || UserRole.MANAGER
      }]);
      if (error) throw error;
      await loadAllData();
  };

  /**
   * FLUXO DE VENDA REFORÇADO (GELATERIA)
   * Resolve o erro de casting STRING -> INTEGER no Supabase.
   */
  const handleAddIcSales = async (newSales: IceCreamDailySale[]): Promise<void> => {
      if (!newSales || newSales.length === 0) return;
      
      const now = new Date();
      const datePart = now.toISOString().split('T')[0].replace(/-/g, '');
      const todaySalesCount = iceCreamSales.filter(s => s.createdAt?.startsWith(now.toISOString().split('T')[0])).length;
      const sequence = String(todaySalesCount + 1).padStart(6, '0');
      const saleCode = `GEL-${datePart}-${sequence}`;

      // Utilitário de normalização de ML (String "500ml" -> Integer 500)
      const normalizeML = (ml: string | number | undefined) => {
          if (ml === undefined || ml === null) return null;
          if (typeof ml === "string") {
              const numeric = parseInt(ml.replace(/ml/gi, "").trim(), 10);
              return isNaN(numeric) ? null : numeric;
          }
          return ml;
      };

      // Validação rigorosa do payload para evitar erro 400
      const payload = newSales.map(s => {
          const units = Number(s.unitsSold);
          const price = Number(s.unitPrice);
          const total = units * price;
          const mlInteger = normalizeML(s.ml);

          if (!s.itemId) throw new Error("ID do item inválido.");
          if (isNaN(units) || units <= 0) throw new Error("Quantidade inválida.");
          if (isNaN(price) || price <= 0) throw new Error("Preço unitário inválido.");

          return {
              item_id: s.itemId, 
              product_name: s.productName, 
              category: s.category, 
              flavor: s.flavor,
              ml: mlInteger, // Enviando como INTEGER para o Supabase
              units_sold: units,
              unit_price: price, 
              total_value: total,
              payment_method: s.paymentMethod, 
              created_at: now.toISOString(),
              sale_code: saleCode, 
              status: 'active'
          };
      });

      console.log("🧪 Payload enviado ao Supabase:", JSON.stringify(payload, null, 2));

      const { error: saleError } = await supabase.from('ice_cream_daily_sales').insert(payload);
      if (saleError) {
          console.error("❌ Erro Supabase 400:", saleError);
          throw new Error(`Falha técnica ao salvar venda (400): ${saleError.message}. Verifique os tipos de dados (ml deve ser inteiro).`);
      }

      try {
          for (const sale of newSales) {
              const item = iceCreamItems.find(i => i.id === sale.itemId);
              if (item) {
                  const consumption = Number(item.consumptionPerSale || 1) * Number(sale.unitsSold);
                  const currentStock = Number(item.stockCurrent || 0);
                  const newStock = Math.max(0, currentStock - consumption);
                  await supabase.from('ice_cream_items').update({ stock_current: newStock }).eq('id', item.id);
                  await supabase.from('ice_cream_stock_movements').insert([{
                      item_id: item.id, type: 'sale', quantity: -consumption, reason: `Venda ${saleCode}`, user_name: user?.name
                  }]);
              }
          }
      } catch (err) { console.warn('⚠️ Erro estoque:', err); }
      await loadAllData();
  };

  const handleCancelIcSale = async (saleCode: string, reason: string) => {
      if (!user) return;
      const { error = null } = await supabase.from('ice_cream_daily_sales').update({ status: 'canceled', cancel_reason: reason, canceled_by: user.name }).eq('sale_code', saleCode);
      if (!error) {
          const salesToRestore = iceCreamSales.filter(s => s.saleCode === saleCode);
          for (const s of salesToRestore) {
              const item = iceCreamItems.find(i => i.id === s.itemId);
              if (item) {
                const restoreQty = Number(item.consumptionPerSale || 1) * Number(s.unitsSold);
                await supabase.from('ice_cream_items').update({ stock_current: Number(item.stockCurrent || 0) + restoreQty }).eq('id', item.id);
                await supabase.from('ice_cream_stock_movements').insert([{ item_id: item.id, type: 'adjustment', quantity: restoreQty, reason: `Cancelamento Venda ${saleCode}`, user_name: user.name }]);
              }
          }
          await loadAllData();
      }
  };

  const handleUpdateStock = async (itemId: string, newQty: number, type: 'adjustment' | 'restock', reason: string) => {
      const item = iceCreamItems.find(i => i.id === itemId);
      if (!item) return;
      const finalQty = type === 'restock' ? Number(item.stockCurrent) + newQty : newQty;
      const { error = null } = await supabase.from('ice_cream_items').update({ stock_current: finalQty }).eq('id', itemId);
      if (!error) {
          await supabase.from('ice_cream_stock_movements').insert([{ item_id: itemId, type: type, quantity: type === 'restock' ? newQty : newQty - Number(item.stockCurrent), reason: reason, user_name: user?.name }]);
          await loadAllData();
      }
  };

  const handleAddIceCreamItem = async (name: string, category: string, price: number, flavor?: string, stockInitial?: number, unit?: string, consumptionPerSale?: number) => {
    const { error } = await supabase.from('ice_cream_items').insert([{ name, category, price: Number(price), flavor, active: true, stock_initial: Number(stockInitial || 0), stock_current: Number(stockInitial || 0), unit: unit || '', consumption_per_sale: Number(consumptionPerSale || 0) }]);
    if (error) throw error;
    await loadAllData();
  };

  const handleUpdateIceCreamItem = async (item: IceCreamItem) => {
    const { error } = await supabase.from('ice_cream_items').update({ name: item.name, category: item.category, price: Number(item.price), flavor: item.flavor, active: item.active, stock_initial: Number(item.stockInitial || 0), stock_current: Number(item.stockCurrent || 0), unit: item.unit || '', consumption_per_sale: Number(item.consumptionPerSale || 0) }).eq('id', item.id);
    if (error) throw error;
    await loadAllData();
  };

  const handleAddCashClosure = async (closure: Partial<CashRegisterClosure>) => {
      const { error = null } = await supabase.from('cash_register_closure').insert([{ store_id: user?.storeId, closed_by: user?.name, date: closure.date, total_sales: Number(closure.totalSales), total_expenses: Number(closure.totalExpenses), balance: Number(closure.balance), notes: closure.notes }]);
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
    
    const handleViewChange = (e: any) => setCurrentView(e.detail);
    window.addEventListener('changeView', handleViewChange);
    return () => window.removeEventListener('changeView', handleViewChange);
  }, []);

  const renderView = () => {
    if (!user) return <LoginScreen 
        onRegisterRequest={handleRegisterRequest}
        onLoginAttempt={async (e, p, r) => {
            const { data: adminData } = await supabase.from('admin_users').select('*').eq('email', e).eq('password', p).maybeSingle();
            if (adminData) { 
                if (adminData.status !== 'active') return { success: false, error: 'Acesso administrativo bloqueado.' };
                const u: User = { id: adminData.id, name: adminData.name, email: adminData.email, role: UserRole.ADMIN };
                handleLogin(u, r); 
                return { success: true, user: u }; 
            }
            const { data: sData } = await supabase.from('stores').select('*').eq('manager_email', e).eq('password', p).maybeSingle();
            if (sData) { 
                if (sData.status === 'pending') return { success: false, error: 'Solicitação em análise.' };
                if (sData.status !== 'active') return { success: false, error: 'Acesso inativo.' };
                const u: User = { id: sData.id, name: sData.manager_name, email: sData.manager_email, role: sData.role as UserRole, storeId: sData.id };
                handleLogin(u, r); 
                return { success: true, user: u }; 
            }
            return { success: false, error: 'E-mail ou senha incorretos.' };
        }} 
    />;

    const currentStore = stores.find(s => s.id === user.storeId);

    switch (currentView) {
      case 'dashboard':
        return user.role === UserRole.MANAGER 
          ? <DashboardManager user={user} stores={stores} performanceData={performanceData} purchasingData={purchasingData} />
          : <DashboardAdmin stores={stores} performanceData={performanceData} onImportData={async (d) => { await supabase.from('monthly_performance').upsert(d.map(item => ({ store_id: item.storeId, month: item.month, revenue_target: item.revenueTarget, revenue_actual: item.revenueActual, items_actual: item.itemsActual, pa_actual: item.itemsPerTicket, ticket_actual: item.averageTicket, pu_actual: item.unitPriceAverage, delinquency_actual: item.delinquencyRate }))); await loadAllData(); }} />;
      
      // RESTAURAÇÃO INTEGRAL DAS ROTAS DA GELATERIA COM ALIASES
      case 'icecream':
      case 'icecream_catalog':
      case 'icecream_products':
      case 'produtos':
      case 'icecream_dre_daily':
      case 'dre_diario':
      case 'icecream_dre_monthly':
      case 'dre_mensal':
      case 'icecream_stock':
      case 'estoque':
      case 'icecream_expenses':
      case 'saidas':
        const icTab = (currentView === 'icecream_stock' || currentView === 'estoque') ? 'estoque' : 
                      (currentView === 'icecream_catalog' || currentView === 'icecream_products' || currentView === 'produtos') ? 'products' :
                      (currentView === 'icecream_dre_daily' || currentView === 'dre_diario') ? 'dre_diario' :
                      (currentView === 'icecream_dre_monthly' || currentView === 'dre_mensal') ? 'dre_mensal' :
                      (currentView === 'icecream_expenses' || currentView === 'saidas') ? 'financeiro' : 'vendas';
        return <IceCreamModule initialTab={icTab} user={user} items={iceCreamItems} sales={iceCreamSales} finances={iceCreamFinances} onAddSales={handleAddIcSales} onCancelSale={handleCancelIcSale} onUpdatePrice={async () => {}} onUpdateItem={handleUpdateIceCreamItem} onAddTransaction={async (t) => { await supabase.from('ice_cream_finances').insert([{ date: t.date, type: t.type, category: t.category, value: t.value, employee_name: t.employeeName, description: t.description }]); await loadAllData(); }} onDeleteTransaction={async (id) => { await supabase.from('ice_cream_finances').delete().eq('id', id); await loadAllData(); }} onAddItem={handleAddIceCreamItem} onDeleteItem={async (id) => { await supabase.from('ice_cream_items').delete().eq('id', id); await loadAllData(); }} onUpdateStock={handleUpdateStock} />;
      
      case 'cotas':
        return <CotasManagement user={user} stores={stores} cotas={cotas} cotaSettings={cotaSettings} cotaDebts={cotaDebts} onAddCota={async (c) => { await supabase.from('cotas').insert([{ store_id: c.storeId, brand: c.brand, classification: c.classification, total_value: c.totalValue, shipment_date: c.shipmentDate, payment_terms: c.paymentTerms, pairs: c.pairs, installments: c.installments, created_by_role: c.createdByRole, status: c.status }]); await loadAllData(); }} onDeleteCota={async (id) => { await supabase.from('cotas').delete().eq('id', id); await loadAllData(); }} onUpdateCota={async (c) => { await supabase.from('cotas').update({ status: c.status }).eq('id', c.id); await loadAllData(); }} onSaveSettings={async (s) => { await supabase.from('cota_settings').upsert({ store_id: s.storeId, budget_value: s.budgetValue, manager_percent: s.managerPercent }); await loadAllData(); }} onSaveDebts={async (sid, d) => { for(const [m, v] of Object.entries(d)) { await supabase.from('cota_debts').upsert({ store_id: sid, month: m, value: v }, { onConflict: 'store_id,month' }); } await loadAllData(); }} />;

      case 'metas_registration':
      case 'goals':
        return <GoalRegistration stores={stores} performanceData={performanceData} onUpdateData={async (d) => { await supabase.from('monthly_performance').upsert(d.map(item => ({ store_id: item.storeId, month: item.month, revenue_target: item.revenueTarget, revenue_actual: item.revenueActual, items_target: item.itemsTarget, items_actual: item.itemsActual, pa_target: item.paTarget, pa_actual: item.itemsPerTicket, ticket_target: item.ticketTarget, ticket_actual: item.averageTicket, pu_target: item.puTarget, pu_actual: item.unitPriceAverage, delinquency_target: item.delinquencyTarget, delinquency_actual: item.delinquencyRate, business_days: item.businessDays }))); await loadAllData(); }} />;

      case 'purchases':
      case 'brands':
        return <DashboardPurchases stores={stores} data={purchasingData} onImport={async (d) => { await supabase.from('product_performance').insert(d.map(item => ({ store_id: item.storeId, month: item.month, brand: item.brand, category: item.category, pairs_sold: item.pairsSold, revenue: item.revenue }))); await loadAllData(); }} />;

      case 'agenda':
        return <AgendaSystem user={user} tasks={tasks} onAddTask={async (t) => { await supabase.from('tasks').insert([{ user_id: t.userId, title: t.title, description: t.description, due_date: t.dueDate, priority: t.priority, is_completed: t.isCompleted }]); await loadAllData(); }} onUpdateTask={async (t) => { await supabase.from('tasks').update({ title: t.title, description: t.description, due_date: t.dueDate, priority: t.priority, is_completed: t.isCompleted }).eq('id', t.id); await loadAllData(); }} onDeleteTask={async (id) => { await supabase.from('tasks').delete().eq('id', id); await loadAllData(); }} />;

      case 'financial':
      case 'receipts':
        return <FinancialModule user={user} store={currentStore} sales={cardSales} receipts={receipts} onAddSale={async (s) => { await supabase.from('credit_card_sales').insert([{ store_id: s.storeId, user_id: s.userId, date: s.date, brand: s.brand, value: s.value, authorization_code: s.authorizationCode }]); await loadAllData(); }} onDeleteSale={async (id) => { await supabase.from('credit_card_sales').delete().eq('id', id); await loadAllData(); }} onAddReceipt={async (r) => { await supabase.from('receipts').insert([{ store_id: r.storeId, issuer_name: r.issuerName, payer: r.payer, recipient: r.recipient, value: r.value, value_in_words: r.valueInWords, reference: r.reference, date: r.date }]); await loadAllData(); }} />;

      case 'cash_errors':
      case 'break_cash':
        return <CashErrorsModule user={user} store={currentStore} stores={stores} errors={cashErrors} onAddError={async (e) => { await supabase.from('cash_errors').insert([{ store_id: e.storeId, user_id: e.userId, user_name: e.userName, date: e.date, type: e.type, value: e.value, reason: e.reason }]); await loadAllData(); }} onUpdateError={async (e) => { await supabase.from('cash_errors').update({ date: e.date, type: e.type, value: e.value, reason: e.reason, store_id: e.storeId }).eq('id', e.id); await loadAllData(); }} onDeleteError={async (id) => { await supabase.from('cash_errors').delete().eq('id', id); await loadAllData(); }} />;

      case 'marketing':
        return <InstagramMarketing user={user} store={currentStore} />;

      case 'downloads':
        return <DownloadsModule user={user} items={downloads} onUpload={async (d) => { await supabase.from('downloads').insert([{ title: d.title, description: d.description, category: d.category, url: d.url, file_name: d.fileName, size: d.size, campaign: d.campaign, created_by: d.createdBy }]); await loadAllData(); }} onDelete={async (id) => { await supabase.from('downloads').delete().eq('id', id); await loadAllData(); }} />;

      case 'auth_print':
      case 'authorizations':
        return <PurchaseAuthorization />;

      case 'termo_print':
        return <TermoAutorizacao user={user} store={currentStore} />;

      case 'admin_users':
      case 'users':
        return <AdminUsersManagement currentUser={user} />;

      case 'audit':
        return <SystemAudit logs={logs} receipts={receipts} store={currentStore} cashErrors={cashErrors} />;

      case 'settings':
      case 'stores':
        return <AdminSettings stores={stores} onAddStore={async (s) => { await supabase.from('stores').insert([{ number: s.number, name: s.name, city: s.city, manager_name: s.managerName, manager_email: s.managerEmail, manager_phone: s.managerPhone, password: s.password, status: s.status, role: s.role }]); await loadAllData(); }} onUpdateStore={async (s) => { await supabase.from('stores').update({ number: s.number, name: s.name, city: s.city, manager_name: s.managerName, manager_email: s.managerEmail, manager_phone: s.managerPhone, password: s.password, status: s.status, role: s.role }).eq('id', s.id); await loadAllData(); }} onDeleteStore={async (id) => { await supabase.from('stores').delete().eq('id', id); await loadAllData(); }} onImportStores={async (stList) => { await supabase.from('stores').upsert(stList.map(s => ({ number: s.number, name: s.name, city: s.city, manager_name: s.managerName, manager_email: s.managerEmail, manager_phone: s.managerPhone, status: s.status, role: s.role }))); await loadAllData(); }} />;

      case 'access_control':
        return <AccessControlManagement />;

      case 'icecream_cash_register':
      case 'cash_register':
        return <CashRegisterModule user={user} sales={iceCreamSales} finances={iceCreamFinances} closures={cashClosures} onAddClosure={handleAddCashClosure} />;

      default:
        return <div className="p-10 text-gray-500 font-bold uppercase tracking-widest text-center">Rota em desenvolvimento ou acesso restrito.</div>;
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
