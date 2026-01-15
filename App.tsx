
import React, { useState, useEffect, useMemo } from 'react';
import { LayoutDashboard, ShoppingBag, Calculator, DollarSign, Instagram, Download, AlertOctagon, FileSignature, LogOut, Menu, Calendar, Settings, X, FileText, UserCog, History, Sliders, Banknote, Target, Loader2, ShieldCheck, ShieldAlert, IceCream, Info, BarChart3, Wifi } from 'lucide-react';
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

const NavButton: React.FC<{ view: string; icon: React.ElementType; label: string; active?: boolean; onClick?: () => void; }> = ({ icon: Icon, label, active, onClick }) => (
  <button onClick={onClick} className={`w-full flex items-center justify-between px-4 py-3 text-[11px] font-black transition-all border-l-4 group ${active ? 'bg-white/10 border-red-500 text-white shadow-inner' : 'border-transparent text-blue-100/60 hover:bg-white/5 hover:text-white'}`}>
    <div className="flex items-center gap-3">
      <Icon size={16} className={active ? 'text-red-400' : 'text-blue-300 group-hover:text-white'} />
      <span className="uppercase tracking-widest truncate">{label}</span>
    </div>
  </button>
);

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [currentView, setCurrentView] = useState('dashboard');

  const [stores, setStores] = useState<Store[]>([]);
  const [performanceData, setPerformanceData] = useState<MonthlyPerformance[]>([]);
  const [purchasingData, setPurchasingData] = useState<ProductPerformance[]>([]);
  const [cotas, setCotas] = useState<Cota[]>([]);
  const [cotaSettings, setCotaSettings] = useState<CotaSettings[]>([]);
  const [cotaDebts, setCotaDebts] = useState<CotaDebt[]>([]);
  const [downloads, setDownloads] = useState<DownloadItem[]>([]);
  const [cashErrors, setCashErrors] = useState<CashError[]>([]);
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [closures, setClosures] = useState<CashRegisterClosure[]>([]);

  const fetchData = async () => {
    try {
      const { data: sData } = await supabase.from('stores').select('*');
      if (sData) setStores(sData);
      loadModuleData();
    } catch (error) {
      console.error("Erro no carregamento:", error);
    }
  };

  const loadModuleData = async () => {
    const [
      { data: pData },
      { data: purData },
      { data: cData },
      { data: csData },
      { data: cdData },
      { data: dData },
      { data: eData },
      { data: lData },
      { data: rData },
      { data: clData }
    ] = await Promise.all([
      supabase.from('monthly_performance').select('*'),
      supabase.from('product_performance').select('*'),
      supabase.from('cotas').select('*'),
      supabase.from('cota_settings').select('*'),
      supabase.from('cota_debts').select('*'),
      supabase.from('downloads').select('*'),
      supabase.from('cash_errors').select('*'),
      supabase.from('system_logs').select('*'),
      supabase.from('receipts').select('*'),
      supabase.from('cash_closures').select('*')
    ]);

    if (pData) setPerformanceData(pData.map(p => ({
        id: p.id, storeId: p.store_id, month: p.month, revenueTarget: Number(p.revenue_target || 0), revenueActual: Number(p.revenue_actual || 0), percentMeta: Number(p.percent_meta || 0), itemsTarget: Number(p.items_target || 0), itemsActual: Number(p.items_actual || 0), itemsPerTicket: Number(p.pa_actual || 0), unitPriceAverage: Number(p.pu_actual || 0), averageTicket: Number(p.ticket_actual || 0), delinquencyRate: Number(p.delinquency_actual || 0), paTarget: Number(p.pa_target || 0), ticketTarget: Number(p.ticket_target || 0), puTarget: Number(p.pu_target || 0), delinquencyTarget: Number(p.delinquency_target || 0), businessDays: Number(p.business_days || 26), trend: p.trend || 'stable', correctedDailyGoal: Number(p.corrected_daily_goal || 0)
    })));
    
    if (purData) setPurchasingData(purData);
    
    if (cData) setCotas(cData.map(c => ({
        id: c.id, 
        storeId: c.store_id, 
        brand: c.brand, 
        totalValue: Number(c.total_value), 
        shipmentDate: String(c.shipment_date), 
        paymentTerms: c.payment_terms, 
        pairs: Number(c.pairs || 0), 
        classification: c.classification, 
        installments: typeof c.installments === 'string' ? JSON.parse(c.installments) : c.installments, 
        createdByRole: c.created_by_role, 
        status: c.status, 
        createdAt: new Date(c.created_at)
    })));

    if (csData) setCotaSettings(csData.map(s => ({ storeId: s.store_id, budgetValue: Number(s.budget_value), managerPercent: Number(s.manager_percent) })));
    if (cdData) setCotaDebts(cdData.map(d => ({ id: d.id, storeId: d.store_id, month: d.month, value: Number(d.value), description: d.description })));
    if (dData) setDownloads(dData);
    if (eData) setCashErrors(eData);
    if (lData) setLogs(lData);
    if (rData) setReceipts(rData);
    if (clData) setClosures(clData);
  };

  useEffect(() => { fetchData(); }, []);

  const handleUpdatePerformance = async (data: MonthlyPerformance[]) => {
      const payload = data.map(d => ({
          store_id: d.storeId, month: d.month, revenue_target: d.revenueTarget, revenue_actual: d.revenueActual, percent_meta: d.revenueTarget > 0 ? (d.revenueActual / d.revenueTarget) * 100 : 0, items_target: d.itemsTarget, items_actual: d.itemsActual, pa_target: d.paTarget, pa_actual: d.itemsPerTicket, ticket_target: d.ticketTarget, ticket_actual: d.averageTicket, pu_target: d.puTarget, pu_actual: d.unitPriceAverage, delinquency_target: d.delinquencyTarget, delinquency_actual: d.delinquencyRate, business_days: d.businessDays, trend: d.trend, corrected_daily_goal: d.correctedDailyGoal
      }));
      await supabase.from('monthly_performance').upsert(payload, { onConflict: 'store_id,month' });
      fetchData();
  };

  const handleSaveCota = async (c: Cota) => {
      const normalizedDate = c.shipmentDate.length === 7 ? `${c.shipmentDate}-01` : c.shipmentDate;
      const payload = {
          store_id: c.storeId, 
          brand: c.brand, 
          // Fix: Corrected property name from c.total_value to c.totalValue to match the Cota interface
          total_value: c.totalValue, 
          shipment_date: normalizedDate, 
          // Fix: Corrected property name from c.payment_terms to c.paymentTerms to match the Cota interface (line 134 fix)
          payment_terms: c.paymentTerms, 
          pairs: c.pairs, 
          classification: c.classification, 
          installments: c.installments, 
          created_by_role: c.createdByRole, 
          status: 'pending'
      };
      const { error } = await supabase.from('cotas').insert([payload]);
      if (error) console.error("Erro ao salvar pedido na tabela cotas:", error);
      fetchData();
  };

  const handleUpdateCota = async (id: string, updates: Partial<Cota>) => {
      const payload: any = {};
      if (updates.status) payload.status = updates.status;
      if (updates.brand) payload.brand = updates.brand;
      await supabase.from('cotas').update(payload).eq('id', id);
      fetchData();
  };

  const handleSaveCotaSettings = async (s: CotaSettings) => {
      await supabase.from('cota_settings').upsert({
          store_id: s.store_id || s.storeId, budget_value: s.budgetValue, manager_percent: s.managerPercent
      }, { onConflict: 'store_id' });
      fetchData();
  };

  const handleSaveCotaDebt = async (d: CotaDebt) => {
      const { error } = await supabase.from('cota_debts').upsert({
          store_id: d.storeId, 
          month: d.month, 
          value: d.value, 
          description: d.description
      }, { onConflict: 'store_id,month' });
      
      if (error) console.error("Erro ao salvar despesa de cota:", error);
      fetchData();
  };

  const handleSaveReceipt = async (r: Receipt) => {
    const { error } = await supabase.from('receipts').insert([{
        store_id: user?.storeId,
        issuer_name: r.issuerName,
        payer: r.payer,
        recipient: r.recipient,
        value: r.value,
        value_in_words: r.valueInWords,
        reference: r.reference,
        date: r.date
    }]);
    if (error) console.error("Erro ao salvar recibo:", error);
    await fetchData();
  };

  if (!user) {
    return (
      <LoginScreen onLoginAttempt={async (email, password) => {
        const { data: admin } = await supabase.from('admin_users').select('*').eq('email', email.toLowerCase()).eq('password', password).single();
        if (admin) {
          const u: User = { 
            id: admin.id, 
            name: admin.name, 
            email: admin.email, 
            role: admin.role_level === 'super_admin' ? UserRole.ADMIN : admin.role_level === 'admin' ? UserRole.MANAGER : UserRole.CASHIER,
            storeId: admin.store_id || '' 
          };
          setUser(u);
          return { success: true, user: u };
        }
        return { success: false, error: 'Credenciais inválidas.' };
      }} />
    );
  }

  return (
    <div className="flex h-screen bg-gray-900 text-white overflow-hidden font-sans">
      <div className="w-64 flex-none bg-gray-950 border-r border-white/5 flex flex-col shadow-2xl">
        <div className="p-8 border-b border-white/5 mb-4">
          <h1 className="text-2xl font-black italic uppercase tracking-tighter leading-none">Real <span className="text-red-600">Admin</span></h1>
          <p className="text-[8px] font-black text-blue-400 uppercase tracking-widest mt-2 opacity-50">Enterprise v26.7</p>
        </div>
        <div className="flex-1 overflow-y-auto no-scrollbar space-y-6 px-2 pb-10">
          <div>
            <p className="px-4 mb-2 text-[9px] font-black uppercase tracking-widest text-gray-500">Inteligência</p>
            <NavButton view="dashboard" icon={LayoutDashboard} label="Dashboard" active={currentView === 'dashboard'} onClick={() => setCurrentView('dashboard')} />
            <NavButton view="metas" icon={Target} label="Metas" active={currentView === 'metas'} onClick={() => setCurrentView('metas')} />
            <NavButton view="cotas" icon={Calculator} label="Cotas OTB" active={currentView === 'cotas'} onClick={() => setCurrentView('cotas')} />
            <NavButton view="purchases" icon={ShoppingBag} label="Compras" active={currentView === 'purchases'} onClick={() => setCurrentView('purchases')} />
          </div>
          <div>
            <p className="px-4 mb-2 text-[9px] font-black uppercase tracking-widest text-gray-500">Operacional</p>
            <NavButton view="icecream" icon={IceCream} label="Gelateria" active={currentView === 'icecream'} onClick={() => setCurrentView('icecream')} />
            <NavButton view="cash_register" icon={Banknote} label="Caixa" active={currentView === 'cash_register'} onClick={() => setCurrentView('cash_register')} />
            <NavButton view="financial" icon={DollarSign} label="Financeiro" active={currentView === 'financial'} onClick={() => setCurrentView('financial')} />
            <NavButton view="cash_errors" icon={AlertOctagon} label="Quebras" active={currentView === 'cash_errors'} onClick={() => setCurrentView('cash_errors')} />
          </div>
          <div>
            <p className="px-4 mb-2 text-[9px] font-black uppercase tracking-widest text-gray-500">Documentos</p>
            <NavButton view="downloads" icon={Download} label="Central" active={currentView === 'downloads'} onClick={() => setCurrentView('downloads')} />
            <NavButton view="auth_print" icon={FileSignature} label="Autorização" active={currentView === 'auth_print'} onClick={() => setCurrentView('auth_print')} />
            <NavButton view="termo_print" icon={FileText} label="Condicional" active={currentView === 'termo_print'} onClick={() => setCurrentView('termo_print')} />
          </div>
          <div>
            <p className="px-4 mb-2 text-[9px] font-black uppercase tracking-widest text-gray-500">Sistema</p>
            <NavButton view="marketing" icon={Instagram} label="Studio" active={currentView === 'marketing'} onClick={() => setCurrentView('marketing')} />
            <NavButton view="admin_users" icon={UserCog} label="Equipe" active={currentView === 'admin_users'} onClick={() => setCurrentView('admin_users')} />
            <NavButton view="access_control" icon={Sliders} label="Acessos" active={currentView === 'access_control'} onClick={() => setCurrentView('access_control')} />
            <NavButton view="audit" icon={History} label="Auditoria" active={currentView === 'audit'} onClick={() => setCurrentView('audit')} />
            <NavButton view="settings" icon={Settings} label="Unidades" active={currentView === 'settings'} onClick={() => setCurrentView('settings')} />
          </div>
        </div>
        <div className="p-4 bg-black/40 border-t border-white/5">
            <button onClick={() => setUser(null)} className="w-full py-2.5 bg-white/5 hover:bg-red-900/20 text-gray-400 hover:text-red-400 rounded-lg text-[9px] font-black uppercase transition-all flex items-center justify-center gap-2">
                <LogOut size={12} /> Desconectar
            </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col h-full bg-[#f8fafc] overflow-hidden text-blue-950">
        <div className="flex-1 overflow-y-auto no-scrollbar relative">
          {currentView === 'dashboard' && (user.role === UserRole.ADMIN ? <DashboardAdmin stores={stores} performanceData={performanceData} onImportData={async (d) => { await supabase.from('monthly_performance').insert(d); fetchData(); }} /> : <DashboardManager user={user} stores={stores} performanceData={performanceData} purchasingData={purchasingData} />)}
          {currentView === 'cotas' && (
            <CotasManagement 
              user={user} stores={stores} cotas={cotas} cotaSettings={cotaSettings} cotaDebts={cotaDebts} performanceData={performanceData}
              onAddCota={handleSaveCota} onUpdateCota={handleUpdateCota} onDeleteCota={async (id) => { await supabase.from('cotas').delete().eq('id', id); fetchData(); }}
              onSaveSettings={handleSaveCotaSettings} onSaveDebts={handleSaveCotaDebt} onDeleteDebt={async (id) => { await supabase.from('cota_debts').delete().eq('id', id); fetchData(); }}
            />
          )}
          {currentView === 'metas' && <GoalRegistration stores={stores} performanceData={performanceData} onUpdateData={handleUpdatePerformance} />}
          {currentView === 'purchases' && <DashboardPurchases stores={stores} data={purchasingData} onImport={async (d) => { await supabase.from('product_performance').insert(d); fetchData(); }} />}
          {currentView === 'icecream' && <IceCreamModule user={user} stores={stores} items={[]} stock={[]} sales={[]} finances={[]} profitPartners={[]} onAddSales={async () => {}} onCancelSale={async () => {}} onUpdateItem={async () => {}} onAddTransaction={async () => {}} onDeleteTransaction={async () => {}} onAddItem={async () => {}} onDeleteItem={async () => {}} onUpdateStock={async () => {}} onAddProfitPartner={async () => {}} onUpdateProfitPartner={async () => {}} onDeleteProfitPartner={async () => {}} onUpdatePrice={async () => {}} />}
          {currentView === 'cash_register' && <CashRegisterModule user={user} sales={[]} finances={[]} closures={closures} onAddClosure={async (c) => { await supabase.from('cash_closures').insert([{ ...c, store_id: user.storeId, closed_by: user.name }]); fetchData(); }} />}
          {currentView === 'financial' && <FinancialModule user={user} store={stores.find(s => s.id === user.storeId)} sales={[]} receipts={receipts} onAddSale={async () => {}} onDeleteSale={async () => {}} onAddReceipt={handleSaveReceipt} />}
          {currentView === 'cash_errors' && <CashErrorsModule user={user} stores={stores} errors={cashErrors} onAddError={async (e) => { await supabase.from('cash_errors').insert([e]); fetchData(); }} onUpdateError={async (e) => { await supabase.from('cash_errors').update(e).eq('id', e.id); fetchData(); }} onDeleteError={async (id) => { await supabase.from('cash_errors').delete().eq('id', id); fetchData(); }} />}
          {currentView === 'downloads' && <DownloadsModule user={user} items={downloads} onUpload={async (i) => { await supabase.from('downloads').insert([i]); fetchData(); }} onDelete={async (id) => { await supabase.from('downloads').delete().eq('id', id); fetchData(); }} />}
          {currentView === 'marketing' && <InstagramMarketing user={user} store={stores.find(s => s.id === user.storeId)} />}
          {currentView === 'auth_print' && <PurchaseAuthorization />}
          {currentView === 'termo_print' && <TermoAutorizacao user={user} store={stores.find(s => s.id === user.storeId)} />}
          {currentView === 'admin_users' && <AdminUsersManagement currentUser={user} />}
          {currentView === 'access_control' && <AccessControlManagement />}
          {currentView === 'audit' && <SystemAudit logs={logs} receipts={receipts} cashErrors={cashErrors} />}
          {currentView === 'settings' && <AdminSettings stores={stores} onAddStore={async (s) => { await supabase.from('stores').insert([s]); fetchData(); }} onUpdateStore={async (s) => { await supabase.from('stores').update(s).eq('id', s.id); fetchData(); }} onDeleteStore={async (id) => { await supabase.from('stores').delete().eq('id', id); fetchData(); }} />}
        </div>
      </div>
    </div>
  );
};

export default App;
