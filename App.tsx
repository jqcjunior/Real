
import React, { useState, useEffect, useMemo } from 'react';
import { LayoutDashboard, ShoppingBag, Calculator, DollarSign, Instagram, Download, AlertOctagon, FileSignature, LogOut, Menu, Calendar, Settings, X, FileText, UserCog, History, Sliders, Banknote, Target, Loader2, ShieldCheck, ShieldAlert, IceCream, Info, BarChart3, Wifi, AlertTriangle, Clock } from 'lucide-react';
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
  const [agendaTasks, setAgendaTasks] = useState<AgendaItem[]>([]);

  // Agenda Reminders States
  const [showLevel1Popup, setShowLevel1Popup] = useState(false);
  const [level1Task, setLevel1Task] = useState<AgendaItem | null>(null);
  const [justification, setJustification] = useState('');
  const [isProcessingTask, setIsProcessingTask] = useState(false);

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
      { data: clData },
      { data: agData }
    ] = await Promise.all([
      supabase.from('monthly_performance').select('*'),
      supabase.from('product_performance').select('*'),
      supabase.from('cotas').select('*'),
      supabase.from('cota_settings').select('*'),
      supabase.from('cota_debts').select('*'),
      supabase.from('downloads').select('*'),
      supabase.from('cash_errors').select('*'),
      supabase.from('system_logs').select('*').order('created_at', { ascending: false }),
      supabase.from('receipts').select('*'),
      supabase.from('cash_register_closures').select('*'),
      supabase.from('agenda_tasks').select('*')
    ]);

    if (pData) setPerformanceData(pData.map(p => ({
        id: p.id, storeId: p.store_id, month: p.month, revenueTarget: Number(p.revenue_target || 0), revenueActual: Number(p.revenue_actual || 0), percentMeta: Number(p.percent_meta || 0), itemsTarget: Number(p.items_target || 0), itemsActual: Number(p.items_actual || 0), itemsPerTicket: Number(p.pa_actual || 0), unitPriceAverage: Number(p.pu_actual || 0), averageTicket: Number(p.ticket_actual || 0), delinquencyRate: Number(p.delinquency_actual || 0), paTarget: Number(p.pa_target || 0), ticketTarget: Number(p.ticket_target || 0), puTarget: Number(p.pu_target || 0), delinquencyTarget: Number(p.delinquency_target || 0), businessDays: Number(p.business_days || 26), trend: p.trend || 'stable', correctedDailyGoal: Number(p.corrected_daily_goal || 0)
    })));
    
    if (purData) setPurchasingData(purData);
    
    if (cData) setCotas(cData.map(c => ({
        id: c.id, storeId: c.store_id, brand: c.brand, totalValue: Number(c.total_value), shipmentDate: String(c.shipment_date), paymentTerms: c.payment_terms, pairs: Number(c.pairs || 0), classification: c.classification, installments: typeof c.installments === 'string' ? JSON.parse(c.installments) : c.installments, createdByRole: c.created_by_role, status: c.status, createdAt: new Date(c.created_at)
    })));

    if (csData) setCotaSettings(csData.map(s => ({ storeId: s.store_id, budgetValue: Number(s.budget_value), managerPercent: Number(s.manager_percent) })));
    if (cdData) setCotaDebts(cdData.map(d => ({ id: d.id, storeId: d.store_id, month: d.month, value: Number(d.value), description: d.description })));
    if (dData) setDownloads(dData);
    if (eData) setCashErrors(eData);
    if (lData) setLogs(lData);
    if (rData) setReceipts(rData);
    if (clData) setClosures(clData);
    if (agData) {
        const mappedTasks = agData.map(t => ({
            id: t.id,
            userId: t.user_id,
            title: t.title,
            description: t.description,
            dueDate: t.due_date,
            priority: t.priority,
            isCompleted: t.is_completed,
            createdAt: new Date(t.created_at),
            reminder_level: t.reminder_level || 1,
            reminded_at: t.reminded_at,
            completed_note: t.completed_note
        }));
        setAgendaTasks(mappedTasks);
        
        // Logic for Level 1 Popup (only if user logged in and not seen in session)
        if (user) {
            const pendingLevel1 = mappedTasks.find(t => 
                !t.isCompleted && 
                t.reminder_level === 1 && 
                t.userId === user.id &&
                (!t.reminded_at || new Date(t.reminded_at) <= new Date())
            );
            if (pendingLevel1 && !showLevel1Popup) {
                setLevel1Task(pendingLevel1);
                setShowLevel1Popup(true);
            }
        }
    }
  };

  useEffect(() => { fetchData(); }, [user?.id]);

  const handleTaskAction = async (taskId: string, action: 'complete' | 'postpone', note?: string) => {
    setIsProcessingTask(true);
    try {
        if (action === 'complete') {
            await supabase.from('agenda_tasks').update({
                is_completed: true,
                completed_note: note || ''
            }).eq('id', taskId);
        } else {
            const nextReminder = new Date();
            nextReminder.setHours(nextReminder.getHours() + 1);
            await supabase.from('agenda_tasks').update({
                reminded_at: nextReminder.toISOString()
            }).eq('id', taskId);
        }
        setJustification('');
        setShowLevel1Popup(false);
        fetchData();
    } catch (e) {
        alert("Erro ao processar tarefa.");
    } finally {
        setIsProcessingTask(false);
    }
  };

  const level2Task = useMemo(() => {
      if (!user) return null;
      return agendaTasks.find(t => 
        !t.isCompleted && 
        t.reminder_level === 2 && 
        t.userId === user.id &&
        (!t.reminded_at || new Date(t.reminded_at) <= new Date())
      );
  }, [agendaTasks, user]);

  const level3Task = useMemo(() => {
    if (!user) return null;
    return agendaTasks.find(t => 
      !t.isCompleted && 
      t.reminder_level === 3 && 
      t.userId === user.id &&
      (!t.reminded_at || new Date(t.reminded_at) <= new Date())
    );
}, [agendaTasks, user]);

  const logSystemAction = async (action: string, details: string) => {
    if (!user) return;
    await supabase.from('system_logs').insert([{
        created_at: new Date().toISOString(),
        userId: user.id,
        userName: user.name,
        userRole: user.role,
        action: action,
        details: details
    }]);
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
    }]).select().single();
    
    if (!error) {
        await logSystemAction('ISSUE_RECEIPT', `Recibo #${r.id} emitido para ${r.recipient} no valor de ${r.value}`);
    }
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
    <div className="flex h-screen bg-gray-900 text-white overflow-hidden font-sans relative">
      
      {/* LEVEL 3 BLOCKING MODAL */}
      {level3Task && (
          <div className="fixed inset-0 z-[9999] bg-[#FFD1D1] flex items-center justify-center p-4">
              <div className="bg-white p-10 rounded-[48px] shadow-2xl max-w-xl w-full border-t-8 border-red-600 text-center space-y-6">
                  <AlertTriangle className="text-red-600 mx-auto" size={80} />
                  <h2 className="text-3xl font-black uppercase italic text-gray-900">Bloqueio de Auditoria</h2>
                  <p className="text-gray-600 font-bold uppercase text-xs tracking-widest">Ação Obrigatória Pendente</p>
                  <div className="p-6 bg-red-50 rounded-3xl border border-red-100">
                      <p className="font-black text-red-900 text-lg uppercase italic">{level3Task.title}</p>
                      <p className="text-red-700 text-xs mt-2 font-medium">{level3Task.description}</p>
                  </div>
                  <div className="space-y-2">
                      <label className="text-[10px] font-black text-gray-400 uppercase text-left block ml-4">Justificativa de Execução</label>
                      <textarea value={justification} onChange={e => setJustification(e.target.value)} className="w-full p-4 bg-gray-50 rounded-2xl border-2 border-red-100 outline-none text-gray-900 font-bold" placeholder="Digite a justificativa para liberação..." />
                  </div>
                  <button 
                    disabled={!justification || isProcessingTask} 
                    onClick={() => handleTaskAction(level3Task.id, 'complete', justification)}
                    className="w-full py-5 bg-red-600 text-white rounded-[24px] font-black uppercase text-xs shadow-xl active:scale-95 transition-all disabled:opacity-50"
                  >
                      {isProcessingTask ? <Loader2 className="animate-spin mx-auto"/> : 'Confirmar e Liberar Sistema'}
                  </button>
              </div>
          </div>
      )}

      {/* LEVEL 1 POPUP */}
      {showLevel1Popup && level1Task && (
          <div className="fixed inset-0 z-[5000] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-[#FFF6BF] p-8 rounded-[40px] shadow-2xl max-w-md w-full border-b-8 border-yellow-600 animate-in zoom-in duration-300">
                  <div className="flex justify-between items-start mb-6">
                      <div className="p-3 bg-white/50 rounded-2xl text-yellow-800"><Calendar size={24}/></div>
                      <button onClick={() => setShowLevel1Popup(false)} className="text-yellow-900/40 hover:text-red-600"><X size={24}/></button>
                  </div>
                  <h3 className="text-xl font-black text-yellow-950 uppercase italic tracking-tighter mb-2">{level1Task.title}</h3>
                  <p className="text-yellow-900/70 text-sm font-medium leading-relaxed mb-6">{level1Task.description}</p>
                  <input value={justification} onChange={e => setJustification(e.target.value)} placeholder="Nota de conclusão..." className="w-full p-3 bg-white/60 rounded-xl mb-4 text-sm font-bold border-none outline-none focus:ring-2 focus:ring-yellow-500" />
                  <div className="flex gap-3">
                      <button onClick={() => handleTaskAction(level1Task.id, 'postpone')} className="flex-1 py-3 bg-white/40 hover:bg-white/60 text-yellow-900 font-black uppercase text-[10px] rounded-xl transition-all">Lembrar em 1h</button>
                      <button onClick={() => handleTaskAction(level1Task.id, 'complete', justification)} className="flex-1 py-3 bg-yellow-900 text-white font-black uppercase text-[10px] rounded-xl shadow-lg transition-all">OK / Concluído</button>
                  </div>
              </div>
          </div>
      )}

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
            <NavButton view="agenda" icon={Calendar} label="Agenda Semanal" active={currentView === 'agenda'} onClick={() => setCurrentView('agenda')} />
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
        
        {/* LEVEL 2 STICKY BANNER */}
        {level2Task && (
            <div className="bg-[#FFE1A8] px-8 py-3 flex justify-between items-center shadow-md animate-in slide-in-from-top duration-500 border-b-2 border-orange-200">
                <div className="flex items-center gap-4">
                    <Clock className="text-orange-900" size={18} />
                    <div>
                        <span className="text-[10px] font-black uppercase tracking-widest text-orange-900/60">Aviso Nível 2:</span>
                        <p className="font-black text-orange-950 text-xs uppercase italic">{level2Task.title}</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <input value={justification} onChange={e => setJustification(e.target.value)} placeholder="Nota rápida..." className="bg-white/50 border-none rounded-lg px-4 py-1.5 text-xs font-bold outline-none focus:ring-2 focus:ring-orange-500 w-48" />
                    <button onClick={() => handleTaskAction(level2Task.id, 'postpone')} className="px-4 py-2 bg-orange-900/10 hover:bg-orange-900/20 text-orange-900 font-black uppercase text-[9px] rounded-lg transition-all">Lembrar em 1h</button>
                    <button onClick={() => handleTaskAction(level2Task.id, 'complete', justification)} className="px-4 py-2 bg-orange-900 text-white font-black uppercase text-[9px] rounded-lg shadow-lg transition-all">Concluir Agora</button>
                </div>
            </div>
        )}

        <div className="flex-1 overflow-y-auto no-scrollbar relative">
          {currentView === 'dashboard' && (user.role === UserRole.ADMIN ? <DashboardAdmin stores={stores} performanceData={performanceData} onImportData={async (d) => { await supabase.from('monthly_performance').insert(d); fetchData(); }} /> : <DashboardManager user={user} stores={stores} performanceData={performanceData} purchasingData={purchasingData} />)}
          {currentView === 'cotas' && (
            <CotasManagement 
              user={user} stores={stores} cotas={cotas} cotaSettings={cotaSettings} cotaDebts={cotaDebts} performanceData={performanceData}
              onAddCota={async (c) => { await supabase.from('cotas').insert([c]); fetchData(); }} onUpdateCota={async (id, u) => { await supabase.from('cotas').update(u).eq('id', id); fetchData(); }} onDeleteCota={async (id) => { await supabase.from('cotas').delete().eq('id', id); fetchData(); }}
              onSaveSettings={async (s) => { await supabase.from('cota_settings').upsert({ store_id: s.storeId, budget_value: s.budgetValue, manager_percent: s.managerPercent }, { onConflict: 'store_id' }); fetchData(); }} onSaveDebts={async (d) => { await supabase.from('cota_debts').upsert({ store_id: d.storeId, month: d.month, value: d.value, description: d.description }, { onConflict: 'store_id,month' }); fetchData(); }} onDeleteDebt={async (id) => { await supabase.from('cota_debts').delete().eq('id', id); fetchData(); }}
            />
          )}
          {currentView === 'metas' && <GoalRegistration stores={stores} performanceData={performanceData} onUpdateData={async (d) => { await supabase.from('monthly_performance').upsert(d, { onConflict: 'store_id,month' }); fetchData(); }} />}
          {currentView === 'purchases' && <DashboardPurchases stores={stores} data={purchasingData} onImport={async (d) => { await supabase.from('product_performance').insert(d); fetchData(); }} />}
          {currentView === 'icecream' && <IceCreamModule user={user} stores={stores} items={[]} stock={[]} sales={[]} finances={[]} profitPartners={[]} onAddSales={async () => {}} onCancelSale={async () => {}} onUpdateItem={async () => {}} onAddTransaction={async () => {}} onDeleteTransaction={async () => {}} onAddItem={async () => {}} onDeleteItem={async () => {}} onUpdateStock={async () => {}} onAddProfitPartner={async () => {}} onUpdateProfitPartner={async () => {}} onDeleteProfitPartner={async () => {}} onUpdatePrice={async () => {}} />}
          {currentView === 'cash_register' && <CashRegisterModule user={user} sales={[]} finances={[]} closures={closures} onAddClosure={async (c) => { await supabase.from('cash_register_closures').insert([{ ...c, store_id: user.storeId, closed_by: user.name }]); fetchData(); }} />}
          {currentView === 'financial' && <FinancialModule user={user} store={stores.find(s => s.id === user.storeId)} sales={[]} receipts={receipts} onAddSale={async () => {}} onDeleteSale={async () => {}} onAddReceipt={handleSaveReceipt} />}
          {currentView === 'cash_errors' && <CashErrorsModule user={user} stores={stores} errors={cashErrors} onAddError={async (e) => { await supabase.from('cash_errors').insert([e]); await logSystemAction('CASH_ERROR', `Quebra: ${e.value}`); fetchData(); }} onUpdateError={async (e) => { await supabase.from('cash_errors').update(e).eq('id', e.id); fetchData(); }} onDeleteError={async (id) => { await supabase.from('cash_errors').delete().eq('id', id); fetchData(); }} />}
          {currentView === 'agenda' && <AgendaSystem user={user} tasks={agendaTasks} onAddTask={async (t) => { await supabase.from('agenda_tasks').insert([{ user_id: t.userId, title: t.title, description: t.description, due_date: t.dueDate, priority: t.priority, reminder_level: t.reminder_level }]); fetchData(); }} onUpdateTask={async (t) => { await supabase.from('agenda_tasks').update({ title: t.title, description: t.description, due_date: t.dueDate, priority: t.priority, is_completed: t.isCompleted, completed_note: t.completed_note, reminder_level: t.reminder_level }).eq('id', t.id); fetchData(); }} onDeleteTask={async (id) => { await supabase.from('agenda_tasks').delete().eq('id', id); fetchData(); }} />}
          {currentView === 'downloads' && <DownloadsModule user={user} items={downloads} onUpload={async (i) => { await supabase.from('downloads').insert([i]); fetchData(); }} onDelete={async (id) => { await supabase.from('downloads').delete().eq('id', id); fetchData(); }} />}
          {currentView === 'marketing' && <InstagramMarketing user={user} store={stores.find(s => s.id === user.storeId)} />}
          {currentView === 'auth_print' && <PurchaseAuthorization />}
          {currentView === 'termo_print' && <TermoAutorizacao user={user} store={stores.find(s => s.id === user.storeId)} />}
          {currentView === 'admin_users' && <AdminUsersManagement currentUser={user} />}
          {currentView === 'access_control' && <AccessControlManagement />}
          {currentView === 'audit' && <SystemAudit logs={logs} receipts={receipts} cashErrors={cashErrors} onLogAction={logSystemAction} />}
          {currentView === 'settings' && <AdminSettings stores={stores} onAddStore={async (s) => { await supabase.from('stores').insert([s]); fetchData(); }} onUpdateStore={async (s) => { await supabase.from('stores').update(s).eq('id', s.id); fetchData(); }} onDeleteStore={async (id) => { await supabase.from('stores').delete().eq('id', id); fetchData(); }} />}
        </div>
      </div>
    </div>
  );
};

export default App;
