
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
import { User, Store, MonthlyPerformance, UserRole, Cota, AgendaItem, DownloadItem, SystemLog, CashError, CotaSettings, CotaDebt, IceCreamItem, IceCreamDailySale, IceCreamTransaction, PagePermission, CashRegisterClosure, ProductPerformance, CreditCardSale, Receipt, StoreProfitPartner, IceCreamCategory, IceCreamStock } from './types';
import { supabase } from './services/supabaseClient';

const ICON_MAP: Record<string, React.ElementType> = {
    dashboard: LayoutDashboard, purchases: ShoppingBag, cotas: Calculator, agenda: Calendar, financial: DollarSign, cash_errors: AlertOctagon, marketing: Instagram, downloads: Download, auth_print: FileSignature, termo_print: FileText, admin_users: UserCog, audit: History, settings: Settings, icecream: ShoppingBag, access_control: Sliders, cash_register: Banknote, metas_registration: Target
};

interface NavButtonProps { view: string; icon: React.ElementType; label: string; active?: boolean; onClick?: () => void; }
const NavButton: React.FC<NavButtonProps> = ({ icon: Icon, label, active, onClick }) => (
  <button onClick={onClick} className={`w-full flex items-center justify-between px-4 py-3 text-sm font-bold transition-all border-l-4 group ${active ? 'bg-blue-800/60 border-red-500 text-white shadow-inner translate-x-1' : 'border-transparent text-blue-100 hover:bg-blue-800/30 hover:text-white hover:translate-x-1'}`}><div className="flex items-center gap-3"><Icon size={18} className={active ? 'text-red-400' : 'text-blue-300 group-hover:text-white'} /><span className="uppercase tracking-tight">{label}</span></div></button>
);

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [currentView, setCurrentView] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [stores, setStores] = useState<Store[]>([]);
  const [pagePermissions, setPagePermissions] = useState<PagePermission[]>([]);
  const [performanceData, setPerformanceData] = useState<MonthlyPerformance[]>([]);
  const [iceCreamItems, setIceCreamItems] = useState<IceCreamItem[]>([]);
  const [iceCreamStock, setIceCreamStock] = useState<IceCreamStock[]>([]);
  const [iceCreamSales, setIceCreamSales] = useState<IceCreamDailySale[]>([]);
  const [iceCreamFinances, setIceCreamFinances] = useState<IceCreamTransaction[]>([]);
  const [profitPartners, setProfitPartners] = useState<StoreProfitPartner[]>([]);
  const [logs, setLogs] = useState<SystemLog[]>([]);

  const logSystemEvent = async (action: string, details: string) => {
    if (!user) return;
    await supabase.from('system_logs').insert([{ userId: user.id, userName: user.name, userRole: user.role, action, details }]);
  };

  const loadAllData = async () => {
      if (!user) return;
      try {
        const isAdmin = user.role === UserRole.ADMIN;
        const { data: dbStores } = await supabase.from('stores').select('*');
        if (dbStores) setStores(dbStores.map((s: any) => ({ id: s.id, number: s.number, name: s.name, city: s.city, managerName: s.manager_name, managerEmail: s.manager_email, managerPhone: s.manager_phone, status: s.status, role: s.role || UserRole.MANAGER })));
        
        const { data: dbPerms } = await supabase.from('page_permissions').select('*').order('sort_order', { ascending: true });
        if (dbPerms) setPagePermissions(dbPerms as PagePermission[]);

        // GELATERIA: Estoque
        let stockQuery = supabase.from('ice_cream_stock').select('*');
        if (!isAdmin && user.storeId) stockQuery = stockQuery.eq('store_id', user.storeId);
        const { data: dbStock } = await stockQuery;
        if (dbStock) setIceCreamStock(dbStock as IceCreamStock[]);

        // GELATERIA: Itens
        let itemsQuery = supabase.from('ice_cream_items').select('*');
        if (!isAdmin && user.storeId) itemsQuery = itemsQuery.eq('store_id', user.storeId);
        const { data: dbItems } = await itemsQuery;
        if (dbItems) setIceCreamItems(dbItems.map((i: any) => ({ id: i.id, storeId: i.store_id, name: i.name, category: i.category, price: Number(i.price), flavor: i.flavor, active: i.active, consumptionPerSale: Number(i.consumption_per_sale || 1) })));

        // GELATERIA: Vendas
        let salesQuery = supabase.from('ice_cream_daily_sales').select('*').order('created_at', { ascending: false });
        if (!isAdmin && user.storeId) salesQuery = salesQuery.eq('store_id', user.storeId);
        const { data: dbSales } = await salesQuery;
        if (dbSales) setIceCreamSales(dbSales.map((s: any) => ({ id: s.id, storeId: s.store_id, itemId: s.item_id, productName: s.product_name, category: s.category, flavor: s.flavor, unitsSold: s.units_sold, unitPrice: Number(s.unit_price), totalValue: Number(s.total_value), paymentMethod: s.payment_method, createdAt: s.created_at, saleCode: s.sale_code, status: s.status })));

        // GELATERIA: Finanças
        let financeQuery = supabase.from('ice_cream_finances').select('*').order('date', { ascending: false });
        if (!isAdmin && user.storeId) financeQuery = financeQuery.eq('store_id', user.storeId);
        const { data: dbFinance } = await financeQuery;
        if (dbFinance) setIceCreamFinances(dbFinance.map((f: any) => ({ id: f.id, storeId: f.store_id, date: f.date, type: f.type, category: f.category, value: Number(f.value), employeeName: f.employee_name, description: f.description, createdAt: new Date(f.created_at) })));

        const { data: dbPartners } = await supabase.from('store_profit_distribution').select('*');
        if (dbPartners) setProfitPartners(dbPartners as StoreProfitPartner[]);

        const { data: dbLogs } = await supabase.from('system_logs').select('*').order('created_at', { ascending: false }).limit(100);
        if (dbLogs) setLogs(dbLogs as SystemLog[]);

      } catch (error) { console.error("Load Error:", error); } finally { setIsLoading(false); }
  };

  // HANDLER: REGISTRAR VENDA COM ABATIMENTO DE ESTOQUE BASE
  const handleAddIcSales = async (newSales: IceCreamDailySale[]): Promise<void> => {
      if (!newSales.length) return;
      const now = new Date();
      const saleCode = `GEL-${now.getTime()}`;

      // 1. Grava a Venda
      const payload = newSales.map(s => ({ store_id: s.storeId, item_id: s.itemId, product_name: s.productName, category: s.category, flavor: s.flavor, units_sold: s.unitsSold, unit_price: s.unitPrice, total_value: s.totalValue, payment_method: s.paymentMethod, sale_code: saleCode }));
      const { error } = await supabase.from('ice_cream_daily_sales').insert(payload);
      if (error) throw error;

      // 2. Abate Estoque por Base
      for (const sale of newSales) {
          const item = iceCreamItems.find(i => i.id === sale.itemId);
          if (item) {
              const stockEntry = iceCreamStock.find(st => st.store_id === sale.storeId && st.product_base === item.category);
              if (stockEntry) {
                  const consumption = Number(item.consumptionPerSale) * Number(sale.unitsSold);
                  const newBalance = Math.max(0, Number(stockEntry.stock_current) - consumption);
                  await supabase.from('ice_cream_stock').update({ stock_current: newBalance }).eq('id', stockEntry.id);
              }
          }
      }

      await logSystemEvent('SALE_GELATERIA', `Venda ${saleCode} realizada no valor de ${newSales.reduce((a,b)=>a+b.totalValue, 0)}`);
      await loadAllData();
  };

  const handleUpdateStock = async (storeId: string, base: string, initial: number, current: number, unit: string) => {
      const existing = iceCreamStock.find(s => s.store_id === storeId && s.product_base === base);
      if (existing) {
          await supabase.from('ice_cream_stock').update({ stock_initial: initial, stock_current: current, unit }).eq('id', existing.id);
      } else {
          await supabase.from('ice_cream_stock').insert([{ store_id: storeId, product_base: base, stock_initial: initial, stock_current: initial, unit }]);
      }
      await logSystemEvent('STOCK_UPDATE', `Estoque base ${base} atualizado para ${current} ${unit}`);
      await loadAllData();
  };

  const handleAddIceCreamItem = async (item: Partial<IceCreamItem>) => {
      const { error } = await supabase.from('ice_cream_items').insert([{ store_id: item.storeId, name: item.name, category: item.category, price: item.price, flavor: item.flavor, active: true, consumption_per_sale: item.consumptionPerSale }]);
      if (!error) {
          await logSystemEvent('PRODUCT_ADD', `Produto ${item.name} adicionado ao catálogo`);
          await loadAllData();
      }
  };

  const handleAddIcFinance = async (tx: IceCreamTransaction) => {
      const { error } = await supabase.from('ice_cream_finances').insert([{ store_id: tx.storeId, date: tx.date, type: tx.type, category: tx.category, value: tx.value, employee_name: tx.employeeName, description: tx.description }]);
      if (!error) {
          await logSystemEvent('FINANCE_GELATERIA', `Saída registrada: ${tx.category} - R$ ${tx.value}`);
          await loadAllData();
      }
  };

  useEffect(() => { if (user) loadAllData(); }, [user]);

  const renderView = () => {
    if (!user) return <LoginScreen onLoginAttempt={async (e, p) => { 
        const { data: admin } = await supabase.from('admin_users').select('*').eq('email', e).eq('password', p).maybeSingle();
        if (admin) { const u = { id: admin.id, name: admin.name, email: admin.email, role: UserRole.ADMIN }; setUser(u); return { success: true, user: u }; }
        const { data: store } = await supabase.from('stores').select('*').eq('manager_email', e).eq('password', p).maybeSingle();
        if (store) { const u = { id: store.id, name: store.manager_name, email: store.manager_email, role: store.role as UserRole, storeId: store.id }; setUser(u); return { success: true, user: u }; }
        return { success: false, error: 'Credenciais inválidas' };
    }} onRegisterRequest={async (s) => { await supabase.from('stores').insert([{ ...s, status: 'pending' }]); }} />;

    switch (currentView) {
      case 'dashboard': return user.role === UserRole.MANAGER ? <DashboardManager user={user} stores={stores} performanceData={performanceData} purchasingData={[]} /> : <DashboardAdmin stores={stores} performanceData={performanceData} onImportData={async () => {}} />;
      case 'icecream':
      case 'produtos':
      case 'estoque':
      case 'dre_diario':
      case 'dre_mensal':
      case 'saidas':
        const initialTab = currentView === 'estoque' ? 'estoque' : currentView === 'produtos' ? 'products' : currentView === 'dre_diario' ? 'dre_diario' : currentView === 'dre_mensal' ? 'dre_mensal' : currentView === 'saidas' ? 'financeiro' : 'vendas';
        return <IceCreamModule 
                initialTab={initialTab} user={user} stores={stores} 
                items={iceCreamItems} stock={iceCreamStock} sales={iceCreamSales} finances={iceCreamFinances} profitPartners={profitPartners}
                onAddSales={handleAddIcSales} 
                onAddTransaction={handleAddIcFinance} 
                onAddItem={async (n,c,p,f,si,u,cps,tsid) => handleAddIceCreamItem({name:n, category:c as IceCreamCategory, price:p, flavor:f, consumptionPerSale:cps, storeId:tsid})}
                onUpdateStock={handleUpdateStock}
                onDeleteTransaction={async (id) => { await supabase.from('ice_cream_finances').delete().eq('id', id); loadAllData(); }}
                onDeleteItem={async (id) => { await supabase.from('ice_cream_items').delete().eq('id', id); loadAllData(); }}
                onUpdateItem={async (i) => { await supabase.from('ice_cream_items').update({ name: i.name, price: i.price, flavor: i.flavor, active: i.active }).eq('id', i.id); loadAllData(); }}
                onCancelSale={async (sc, r) => { await supabase.from('ice_cream_daily_sales').update({ status: 'canceled', cancel_reason: r, canceled_by: user.name }).eq('sale_code', sc); loadAllData(); }}
                onAddProfitPartner={async (p) => { await supabase.from('store_profit_distribution').insert([p]); loadAllData(); }}
                onUpdateProfitPartner={async (p) => { await supabase.from('store_profit_distribution').update(p).eq('id', p.id); loadAllData(); }}
                onDeleteProfitPartner={async (id) => { await supabase.from('store_profit_distribution').delete().eq('id', id); loadAllData(); }}
                onUpdatePrice={async () => {}}
               />;
      case 'audit': return <SystemAudit logs={logs} receipts={[]} cashErrors={[]} />;
      case 'settings': return <AdminSettings stores={stores} onAddStore={async () => {}} onUpdateStore={async () => {}} onDeleteStore={async () => {}} />;
      default: return <div className="p-20 text-center font-black uppercase opacity-20">Módulo em Construção</div>;
    }
  };

  return (
    <div className="flex h-screen bg-gray-100 font-sans overflow-hidden">
      {user && (
      <>
        <header className="fixed top-0 border-gray-200 left-0 right-0 h-16 bg-white border-b z-[60] flex items-center justify-between px-6 shadow-sm">
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full overflow-hidden border border-gray-200 bg-white"><img src="/branding/logo-real.png" alt="Logo" className="w-full h-full object-cover" /></div>
                <div className="hidden md:block">
                   <span className="font-black italic text-blue-950 tracking-tighter uppercase leading-none text-xl">REAL <span className="text-red-600">ADMIN</span></span>
                   <p className="text-[7px] text-gray-400 font-black uppercase tracking-widest mt-0.5">ESTRATÉGIA & OPERAÇÃO</p>
                </div>
                <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="md:hidden p-2 text-gray-600"><Menu size={24} /></button>
            </div>
            <div className="flex items-center gap-4">
                <div className="px-4 py-1.5 bg-gray-50 rounded-full border border-gray-100 flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center font-bold text-xs text-white uppercase">{user.name.charAt(0)}</div>
                    <div className="text-left hidden sm:block"><p className="text-[10px] font-black uppercase text-gray-900 leading-none">{user.name}</p><p className="text-[8px] font-bold text-blue-400 uppercase italic">{user.role}</p></div>
                </div>
                <button onClick={() => { setUser(null); window.location.reload(); }} className="p-2.5 text-gray-400 hover:text-red-600 transition-all"><LogOut size={20}/></button>
            </div>
        </header>
        <div className={`fixed md:sticky top-16 left-0 h-[calc(100vh-64px)] w-64 bg-gradient-to-b from-blue-950 to-blue-900 text-white shadow-2xl z-50 transition-transform duration-300 border-r border-blue-800 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
            <div className="p-6 flex flex-col h-full"><nav className="flex-1 space-y-1 overflow-y-auto no-scrollbar pr-1 pt-4">{Object.entries({
                "Operação": pagePermissions.filter(p=>p.module_group==="Operação"),
                "Inteligência": pagePermissions.filter(p=>p.module_group==="Inteligência"),
                "Administração": pagePermissions.filter(p=>p.module_group==="Administração")
            }).map(([groupName, items]) => ( <div key={groupName} className="mb-4"> <div className="px-4 py-2 text-[10px] font-black uppercase tracking-widest text-blue-400 opacity-50">{groupName}</div> {items.map(item => ( <NavButton key={item.page_key} view={item.page_key} icon={ICON_MAP[item.page_key] || LayoutDashboard} label={item.label} active={currentView === item.page_key} onClick={() => { setCurrentView(item.page_key); setIsSidebarOpen(false); }} /> ))} </div> ))}</nav></div>
        </div>
      </>
      )}
      <div className="flex-1 flex flex-col h-screen overflow-hidden"><main className={`flex-1 overflow-auto relative scroll-smooth no-scrollbar ${user ? 'pt-16' : ''}`}>{renderView()}</main></div>
    </div>
  );
};

export default App;
