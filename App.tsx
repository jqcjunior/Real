import React, { useState, useEffect, lazy, Suspense } from 'react';
import {
    User, Store, MonthlyPerformance, UserRole,
    IceCreamItem, IceCreamDailySale, CashRegisterClosure, Receipt, IceCreamStock, IceCreamPromissoryNote, AgendaItem, DownloadItem, CashError, SystemLog, MonthlyGoal, CreditCardSale, PixSale,
    Sale, SalePayment, IceCreamSangria, IceCreamSangriaCategory,
    IceCreamStockMovement, StoreProfitPartner, AdminUser, IceCreamFutureDebt,
    Survey
} from './types';
import { supabase } from './services/supabaseClient';
import apiService from './services/apiService';
import { ensureSession } from './services/authService';
import { setUserSession } from './utils/authSession';
import { BRAND_LOGO } from './constants';

// Módulos com Lazy Loading
const DashboardAdmin = lazy(() => {
    return import('./components/DashboardAdmin').catch(err => {
        console.error("Erro ao carregar DashboardAdmin:", err);
        // Tenta recarregar a página se o erro for de carregamento de módulo
        if (err.message.includes('fetch') || err.message.includes('dynamically imported module')) {
            window.location.reload();
        }
        throw err;
    });
});
const DashboardManager = lazy(() => import('./components/DashboardManager'));
const GoalRegistration = lazy(() => import('./components/GoalRegistration'));
const IceCreamModule = lazy(() => import('./components/IceCreamModule'));
const CashRegisterModule = lazy(() => import('./components/CashRegisterModule'));
const AgendaSystem = lazy(() => import('./components/AgendaSystem'));
const DownloadsModule = lazy(() => import('./components/DownloadsModule'));
const AdminSettings = lazy(() => import('./components/AdminSettings'));
const AdminUsersManagement = lazy(() => import('./components/AdminUsersManagement'));
const AccessControlManagement = lazy(() => import('./components/AccessControlManagement'));
const PurchaseAuthorization = lazy(() => import('./components/PurchaseAuthorization'));
const TermoAutorizacao = lazy(() => import('./components/TermoAutorizacao'));
const SystemAudit = lazy(() => import('./components/SystemAudit'));
const OSDemandsModule = lazy(() => import('./components/OSDemandsModule'));
const DemandsSystemV2 = lazy(() => import('./components/DemandsSystemV2'));
const DashboardPAModule = lazy(() => import('./components/dashboardPA/DashboardPAModule'));
const DashboardPAGerente = lazy(() => import('./components/dashboardPA/DashboardPAGerente'));
import BuyOrderModule from './components/buyorder/BuyOrderModule.tsx';
import BuyOrderParams from './components/buyorder/BuyOrderParams.tsx';
import BuyOrderDashboard from './components/buyorder/BuyOrderDashboard.tsx';
import StockForecastDashboard from './components/StockForecastDashboard.tsx';
import BuyOrderQuotaView from './components/buyorder/BuyOrderQuotaView.tsx';
import { BuyOrderPhotos } from './components/buyorder/BuyOrderPhotos.tsx';
const ReportsPage = lazy(() => import('./components/ReportsPage'));
const AdminQuotaExtraApprovals = lazy(() => import('./components/buyorder/AdminQuotaExtraApprovals'));
const BuyOrderAnalytic = lazy(() => import('./components/buyorder/BuyOrderAnalytic'));
const AdminSurveyManagement = lazy(() => import('./components/Pesquisa/AdminSurveyManagement_v3'));
const MySurveysComponent = lazy(() => import('./components/Pesquisa/MySurveysComponent'));
const SurveyResultsViewer = lazy(() => import('./components/Pesquisa/SurveyResultsViewer'));
import SurveyPublicPage from './components/Pesquisa/SurveyPublicPage';
import StoreNfcPublicPage from './components/Pesquisa/StoreNfcPublicPage';
// DRE Analytics imports removed as requested for cleanup
const DREAccounts = lazy(() => import('./components/dre/components/DREAccountsResponsive'));

import LoginScreen from './components/LoginScreen';
import NotificationHeader from './components/NotificationHeader';
import ChangePasswordModal from './components/ChangePasswordModal';
import ErrorBoundary from './components/ErrorBoundary';
import { printReceipt } from './services/thermalPrinterService';

// Ícones
import {
    LayoutDashboard, Target, ShoppingBag, Calculator, IceCream as IceCreamIcon,
    DollarSign, AlertCircle, Calendar, LogOut, Loader2, Menu, X, ClipboardList, Shield, UserCog, Users, ShieldAlert, Settings, FileSignature, FileText, Download, Lock,
    Sun, Moon, Trophy, BarChart3, ArrowRight, TrendingUp, ShoppingCart, CheckCircle, Camera
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Toaster } from 'sonner';

const getTodayBrazil = (): string => {
    return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
};

const PageLoader = () => (
    <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-slate-500 dark:text-slate-400 text-xs font-black uppercase tracking-widest">Carregando módulo...</p>
        </div>
    </div>
);

// Estilos CSS para animações
const styles = `
  @keyframes fade-in {
    from {
      opacity: 0;
      transform: translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @keyframes fade-in-up {
    from {
      opacity: 0;
      transform: translateY(30px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @keyframes spin-slow {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }

  .animate-fade-in {
    animation: fade-in 0.6s ease-out;
  }

  .animate-fade-in-up {
    animation: fade-in-up 0.8s ease-out;
  }

  .animate-spin-slow {
    animation: spin-slow 3s linear infinite;
  }
`;

const App: React.FC = () => {
    const [user, setUser] = useState<User | null>(() => {
        try {
            const saved = localStorage.getItem('realcalcados_user');
            if (saved) {
                const parsed = JSON.parse(saved);
                const userId = parsed.user_id || parsed.id;
                
                if (userId) {
                    // ✅ Session será estabelecida por useEffect
                    if (!parsed.id) parsed.id = userId;
                    return parsed;
                }
            }
        } catch (e) {
            console.error("Erro ao restaurar usuário:", e);
        }
        return null;
    });

    // ✅ useEffect para estabelecer sessão APÓS mount
    useEffect(() => {
        const restoreSession = async () => {
            if (user) {
                const userId = user.user_id || user.id;
                if (userId) {
                    try {
                        const { error } = await supabase.rpc('set_user_session', { 
                            p_user_id: String(userId) // ✅ usar p_user_id consistente com a DB
                        });
                        if (error) {
                            console.warn('⚠️ Erro ao restaurar sessão RLS:', error);
                        }
                    } catch (err) {
                        console.warn('⚠️ Falha ao disparar set_user_session:', err);
                    }
                }
            }
        };
        restoreSession();
    }, []); // Executa apenas uma vez
    const isAdmin = user?.role === UserRole.ADMIN;
    const [currentView, setCurrentView] = useState<string>('welcome');
    const [activeMenu, setActiveMenu] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [permissionsLoaded, setPermissionsLoaded] = useState(false);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
    const [sessionWarning, setSessionWarning] = useState(false);
    const [hasUnreadDemands, setHasUnreadDemands] = useState(false);
    const [theme, setTheme] = useState<'light' | 'dark'>(() => {
        const saved = localStorage.getItem('theme');
        return (saved as 'light' | 'dark') || 'light';
    });

    const checkUnreadDemands = async () => {
        if (!user) return;
        try {
            let query = supabase
                .from('demands_v2')
                .select('unread_count')
                .gt('unread_count', 0)
                .eq('is_archived', false);
            
            // @ts-ignore
            const userStoreId = user.store_id || user.storeId;
            if (user?.role !== UserRole.ADMIN && userStoreId) {
                query = query.eq('store_id', userStoreId);
            }

            const { data, error } = await query;
            if (error) throw error;
            
            setHasUnreadDemands(data && data.length > 0);
        } catch (err) {
            console.error("Erro ao checar novos chamados:", err);
        }
    };

    useEffect(() => {
        if (user) {
            checkUnreadDemands();
            const interval = setInterval(checkUnreadDemands, 30000); // Checa a cada 30 segundos
            return () => clearInterval(interval);
        }
    }, [user, user?.storeId]);

    // ─── INICIALIZAÇÃO E SESSÃO ──────────
    useEffect(() => {
        if (window.innerWidth >= 1024) {
            setIsSidebarOpen(true);
        }
        setIsLoading(false);
    }, []);

    // ─── SEGURANÇA: Auto-logout por INATIVIDADE (não por tempo fixo) ──────────
    useEffect(() => {
        if (!user) {
            setSessionWarning(false);
            return;
        }

        const INATIVIDADE_LOGOUT_MS = 60 * 60 * 1000;  // 60 min sem atividade
        const INATIVIDADE_AVISO_MS  = 55 * 60 * 1000;  // aviso aos 55 min

        let timerAviso: ReturnType<typeof setTimeout>;
        let timerLogout: ReturnType<typeof setTimeout>;

        const resetTimers = () => {
            clearTimeout(timerAviso);
            clearTimeout(timerLogout);
            setSessionWarning(false);

            timerAviso = setTimeout(() => {
                setSessionWarning(true);
            }, INATIVIDADE_AVISO_MS);

            timerLogout = setTimeout(async () => {
                setSessionWarning(false);
                if (user) localStorage.removeItem(`realcalcados_lastView_${user.id}`);
                await apiService.logout();
                setUser(null);
                setCurrentView('welcome');
                window.location.reload();
            }, INATIVIDADE_LOGOUT_MS);
        };

        // Eventos que reiniciam o contador de inatividade
        const eventos = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click'];
        eventos.forEach(e => window.addEventListener(e, resetTimers, { passive: true }));

        resetTimers(); // inicia os timers pela primeira vez

        return () => {
            clearTimeout(timerAviso);
            clearTimeout(timerLogout);
            eventos.forEach(e => window.removeEventListener(e, resetTimers));
        };
    }, [user]);
    // ──────────────────────────────────────────────────────────────────────────

    useEffect(() => {
        if (user && currentView && currentView !== 'welcome') {
            localStorage.setItem(`realcalcados_lastView_${user.id}`, currentView);
        }
    }, [currentView, user]);

    useEffect(() => {
        const root = window.document.documentElement;
        if (theme === 'dark') {
            root.classList.add('dark');
        } else {
            root.classList.remove('dark');
        }
        localStorage.setItem('theme', theme);
    }, [theme]);

    const bootstrapPermissions = async () => {
        try {
            const perms = [
                { key: 'MODULE_DASHBOARD_ADMIN', label: 'Meta da Rede', group: 'Inteligência' },
                { key: 'MODULE_DASHBOARD_MANAGER', label: 'Meta da Loja', group: 'Inteligência' },
                { key: 'MODULE_DASHBOARD_PA', label: 'Meta Semanal Admin', group: 'Inteligência' },
                { key: 'MODULE_DASHBOARD_PA_MANAGER', label: 'Meta Semanal Gerente', group: 'Inteligência' },
                { key: 'MODULE_BUY_ORDERS', label: 'Pedidos de Compra', group: 'Inteligência' },
                { key: 'MODULE_METAS', label: 'Metas', group: 'Inteligência' },
                { key: 'MODULE_COTAS', label: 'Cotas OTB', group: 'Inteligência' },
                { key: 'MODULE_PURCHASES', label: 'Compras', group: 'Inteligência' },
                { key: 'MODULE_DEMANDS', label: 'Chamado', group: 'Inteligência' },
                { key: 'MODULE_DRE_ACCOUNTS', label: 'Plano de Contas DRE', group: 'Inteligência' },
                { key: 'MODULE_ICECREAM', label: 'PDV Gelateria', group: 'Operacional' },
                { key: 'MODULE_CASH_REGISTER', label: 'Caixa', group: 'Operacional' },
                { key: 'MODULE_AGENDA', label: 'Agenda Semanal', group: 'Operacional' },
                { key: 'MODULE_AUTORIZ_COMPRA', label: 'Autoriz. Compra', group: 'Documentos' },
                { key: 'MODULE_TERMO_CONDICIONAL', label: 'Termo Condicional', group: 'Documentos' },
                { key: 'MODULE_DOWNLOADS', label: 'Downloads', group: 'Documentos' },
                { key: 'MODULE_ADMIN_USERS', label: 'Usuários', group: 'Administração' },
                { key: 'MODULE_ADMIN_SURVEYS', label: 'Pesquisas', group: 'Administração' },
                { key: 'MODULE_ACCESS_CONTROL', label: 'Acessos', group: 'Administração' },
                { key: 'MODULE_AUDIT', label: 'Auditoria', group: 'Administração' },
                { key: 'MODULE_SETTINGS', label: 'Configurações', group: 'Administração' },
                { key: 'MODULE_CASH_ERRORS_EDIT', label: 'Editar Quebras de Caixa', group: 'Financeiro' },
                { key: 'MODULE_ICECREAM_MANAGE', label: 'Gelateria: Gestão', group: 'Gelateria' },
                { key: 'MODULE_ICECREAM_DESPESAS', label: 'Gelateria: Despesas', group: 'Gelateria' },
                { key: 'MODULE_AUDIT_MANAGE', label: 'Auditoria: Gestão', group: 'Auditoria' },
                { key: 'admin_settings', label: 'Configurações Avançadas', group: 'Administração' }
            ];

            for (const p of perms) {
                const { data: existing } = await supabase
                    .from('page_permissions')
                    .select('id, allow_admin, allow_manager')
                    .eq('page_key', p.key)
                    .maybeSingle();

                if (!existing) {
                    await supabase.from('page_permissions').insert([{
                        page_key: p.key,
                        label: p.label,
                        module_group: p.group,
                        allow_admin: true,
                        allow_manager: p.key === 'MODULE_DEMANDS' || p.key === 'MODULE_DASHBOARD_ADMIN',
                        allow_cashier: p.key === 'MODULE_DEMANDS',
                        allow_sorvete: p.key === 'MODULE_ICECREAM' || p.key === 'MODULE_AGENDA' || p.key === 'MODULE_DASHBOARD_MANAGER' || p.key === 'MODULE_DEMANDS',
                        sort_order: 100
                    }]);
                } else {
                    const updates: any = {};
                    if (!existing.allow_admin) updates.allow_admin = true;
                    if (p.key === 'MODULE_DASHBOARD_ADMIN' && !existing.allow_manager) updates.allow_manager = true;

                    if (Object.keys(updates).length > 0) {
                        await supabase.from('page_permissions')
                            .update(updates)
                            .eq('page_key', p.key);
                    }
                }
                
                // ✅ GARANTIR QUE TODOS VEJAM CHAMADOS
                if (existing && p.key === 'MODULE_DEMANDS') {
                    await supabase.from('page_permissions')
                        .update({ allow_manager: true, allow_cashier: true, allow_sorvete: true })
                        .eq('page_key', 'MODULE_DEMANDS');
                }
            }
        } catch (err) {
            console.error("Erro no bootstrap de permissões:", err);
        }
    };

    const bootstrapParameters = async () => {
        try {
            const { data, error } = await supabase.from('pa_parameters').select('*').limit(1);
            if (!data || data.length === 0) {
                await supabase.from('pa_parameters').insert([{
                    min_pa: 1.80,
                    max_pa: 2.50,
                    award_value: 50.00,
                    weight_revenue: 50,
                    weight_pa: 50
                }]);
            }
        } catch (err) {
            console.error("Erro no bootstrap de parâmetros:", err);
        }
    };

    const [userPermissions, setUserPermissions] = useState<string[]>([]);
    const [connectionError, setConnectionError] = useState<string | null>(null);

    const [stores, setStores] = useState<Store[]>([]);
    const [performanceData, setPerformanceData] = useState<MonthlyPerformance[]>([]);
    const [goalsData, setGoalsData] = useState<MonthlyGoal[]>([]);
    const [iceCreamItems, setIceCreamItems] = useState<IceCreamItem[]>([]);
    const [iceCreamSales, setIceCreamSales] = useState<IceCreamDailySale[]>([]);
    const [sales, setSales] = useState<Sale[]>([]);
    const [salePayments, setSalePayments] = useState<SalePayment[]>([]);
    const [cardSales, setCardSales] = useState<CreditCardSale[]>([]);
    const [pixSales, setPixSales] = useState<PixSale[]>([]);
    const [iceCreamStock, setIceCreamStock] = useState<IceCreamStock[]>([]);
    const [icPromissories, setIcPromissories] = useState<IceCreamPromissoryNote[]>([]);
    const [receipts, setReceipts] = useState<Receipt[]>([]);
    const [cashErrors, setCashErrors] = useState<CashError[]>([]);
    const [agenda, setAgenda] = useState<AgendaItem[]>([]);
    const [downloads, setDownloads] = useState<DownloadItem[]>([]);
    const [closures, setClosures] = useState<CashRegisterClosure[]>([]);
    const [logs, setLogs] = useState<SystemLog[]>([]);
    const [icSangriaCategories, setIcSangriaCategories] = useState<IceCreamSangriaCategory[]>([]);
    const [icSangrias, setIcSangrias] = useState<IceCreamSangria[]>([]);
    const [icStockMovements, setIcStockMovements] = useState<IceCreamStockMovement[]>([]);
    const [icWastage, setIcWastage] = useState<any[]>([]);
    const [partners, setPartners] = useState<StoreProfitPartner[]>([]);
    const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
    const [paParameters, setPaParameters] = useState<any>(null);
    const [goalsRankingParams, setGoalsRankingParams] = useState<any>(null);
    const [futureDebts, setFutureDebts] = useState<IceCreamFutureDebt[]>([]);
    const [selectedSurveyForResults, setSelectedSurveyForResults] = useState<Survey | null>(null);
    const [pendingSurveys, setPendingSurveys] = useState<Survey[]>([]);
    const [isSurveyModalOpen, setIsSurveyModalOpen] = useState(false);
    const [showSurveyAlert, setShowSurveyAlert] = useState(false);
    const [selectedSurvey, setSelectedSurvey] = useState<Survey | null>(null);

    const can = (permissionKey: string) => {
        if (!user) return false;
        const role = String(user.role || '').toUpperCase().trim();
        if (permissionKey === 'ALWAYS') return true;
        if (!permissionsLoaded) return false;
        if (role === 'ADMIN') return true;
        return userPermissions.includes(permissionKey);
    };

    const fetchPermissions = async (role: string, userName?: string) => {
        try {
            setPermissionsLoaded(false);
            const roleUpper = String(role || '').toUpperCase().trim();

            let columnToCheck = '';
            if (roleUpper === 'ADMIN') columnToCheck = 'allow_admin';
            else if (roleUpper === 'MANAGER' || roleUpper === 'GERENTE') columnToCheck = 'allow_manager';
            else if (roleUpper === 'CASHIER' || roleUpper === 'CAIXA' || roleUpper === 'CASHIER') columnToCheck = 'allow_cashier';
            else if (roleUpper === 'ICE_CREAM' || roleUpper === 'SORVETE' || roleUpper === 'SORVETERIA') columnToCheck = 'allow_sorvete';

            if (!columnToCheck) {
                console.warn(`Role ${roleUpper} não mapeada para colunas de permissão.`);
                setUserPermissions([]);
                setPermissionsLoaded(true);
                return;
            }

            const { data, error } = await supabase
                .from('page_permissions')
                .select('page_key')
                .eq(columnToCheck, true);

            if (error) throw error;

            const perms = data?.map(p => p.page_key) || [];
            setUserPermissions(perms);
            setPermissionsLoaded(true);

            console.log('--- DEBUG PERMISSÕES ---');
            console.log('USUÁRIO:', userName || user?.name);
            console.log('ROLE:', roleUpper);
            console.log('PERMISSÕES CARREGADAS:', perms);
            console.log('------------------------');

        } catch (err) {
            console.error("Erro ao buscar permissões:", err);
            setUserPermissions([]);
            setPermissionsLoaded(true);
        }
    };

    useEffect(() => {
        if (user && !permissionsLoaded) {
            fetchPermissions(user.role, user.name);
        }
    }, [user, permissionsLoaded]);

    const fetchAllRows = async (table: string, orderBy: string) => {
        let allData: any[] = [];
        let from = 0;
        const step = 999;
        let hasMore = true;
        while (hasMore) {
            const { data, error } = await supabase.from(table).select('*').order(orderBy, { ascending: false }).range(from, from + step);
            if (error) break;
            if (data && data.length > 0) {
                allData = [...allData, ...data];
                from += step + 1;
                if (data.length <= step) hasMore = false;
            } else {
                hasMore = false;
            }
        }
        return { data: allData };
    };

    const addLog = async (action: string, details: string) => {
        if (!user) return;
        try {
            await supabase.from('system_logs').insert([{
                user_id: user.id,
                user_name: user.name,
                user_role: user.role,
                action,
                details
            }]);
            fetchData();
        } catch (err) {
            console.error("Erro ao criar log:", err);
        }
    };

    const fetchData = async (optionsOrUser?: { role: string; storeId?: string } | boolean) => {
        const isSilent = optionsOrUser === true;
        const overrideUser = typeof optionsOrUser === 'object' ? optionsOrUser : undefined;

        try {
            if (!isSilent) {
                // Se não for silencioso, podemos mostrar um loading se desejado
                // Mas o sistema parece gerenciar isLoading de forma global
            }
            await ensureSession();
            const [
                {data: s}, {data: p}, {data: g}, {data: pap}, {data: grp}
            ] = await Promise.all([
                supabase.from('stores').select('*'),
                supabase.from('monthly_performance_actual').select('*'),
                supabase.from('monthly_goals').select('*'),
                supabase.from('pa_parameters').select('*').maybeSingle(),
                supabase.from('goals_ranking_parameters').select('*').limit(1).maybeSingle()
            ]);

            if (pap) setPaParameters(pap);
            if (grp) setGoalsRankingParams(grp);

            if(s) setStores(s.map(x => ({
                ...x,
                managerName: x.manager_name,
                managerEmail: x.manager_email,
                managerPhone: x.manager_phone
            })).sort((a, b) => Number(a.number) - Number(b.number)));

            if(p) setPerformanceData(p.map(x => ({
                ...x,
                storeId: x.store_id,
                revenueActual: Number(x.revenue_actual || 0),
                revenueTarget: Number(x.revenue_target || 0),
                itemsActual: Number(x.items_actual || 0),
                itemsTarget: Number(x.items_target || 0),
                salesActual: Number(x.sales_actual || 0),
                paActual: Number(x.pa_actual || x.items_per_ticket || 0),
                puActual: Number(x.pu_actual || x.unit_price_average || 0),
                averageTicket: Number(x.ticket_actual || x.average_ticket || 0),
                percentMeta: Number(x.percent_meta || 0),
                paTarget: Number(x.pa_target || 0),
                puTarget: Number(x.pu_target || 0),
                ticketTarget: Number(x.ticket_target || 0),
                businessDays: Number(x.business_days || 26)
            })));

            if(g) setGoalsData(g.map(x => ({ 
                id: x.id, 
                storeId: x.store_id, 
                year: Number(x.year), 
                month: Number(x.month), 
                revenueTarget: Number(x.revenue_target || 0), 
                itemsTarget: Number(x.items_target || 0), 
                paTarget: Number(x.pa_target || 0), 
                puTarget: Number(x.pu_target || 0), 
                ticketTarget: Number(x.ticket_target || 0), 
                delinquencyTarget: Number(x.delinquency_target || 2.0), 
                businessDays: Number(x.business_days || 26), 
                trend: x.trend || 'stable' 
            })));

            setIsLoading(false);

            // 🚀 FILTROS INTELIGENTES POR PAPEL + LOJA
            console.log('🍦 Iniciando carregamento módulo sorvete...');
            console.log('overrideUser:', overrideUser);
            console.log('user:', user);
            
            // Normalizar role para comparação case-insensitive
            const userRole = (overrideUser?.role || user?.role)?.toString().toUpperCase() || '';
            const userRoleLevel = ((overrideUser as any)?.role_level || (user as any)?.role_level)?.toString().toUpperCase() || '';
            const userStoreId = overrideUser?.storeId || user?.storeId || '';

            const isSorvete = userRole === 'ICE_CREAM' || userRole === 'SORVETE' || 
                              userRoleLevel === 'ICE_CREAM' || userRoleLevel === 'SORVETE';
            const isGerente = userRole === 'MANAGER' || userRole === 'GERENTE' || 
                              userRoleLevel === 'MANAGER' || userRoleLevel === 'GERENTE';
            const isAdmin = userRole === 'ADMIN' || userRoleLevel === 'ADMIN';

            console.log('Roles detectadas:', { isSorvete, isGerente, isAdmin });

            const now = new Date();
            const today = getTodayBrazil();
            const currentMonth = now.getMonth() + 1;
            const currentYear = now.getFullYear();
            const isEarlyMonth = now.getDate() <= 10;

            // Determinar filtros de data para as queries
            let dateFilter = null;
            let cancelStart = null;
            let adminStart = null;

            if (isSorvete) {
                // Role SORVETE: apenas mês atual
                const startOfMonth = new Date();
                startOfMonth.setDate(1);
                startOfMonth.setHours(0, 0, 0, 0);
                dateFilter = startOfMonth.toISOString();
                console.log('Filtro SORVETE: desde', dateFilter);
            } else if (isGerente) {
                // Role GERENTE: mês atual + anterior se dia <= 10
                if (isEarlyMonth) {
                    const startDate = new Date();
                    startDate.setMonth(startDate.getMonth() - 1);
                    startDate.setDate(1);
                    startDate.setHours(0, 0, 0, 0);
                    dateFilter = startDate.toISOString();
                    console.log('Filtro GERENTE (dia <= 10): desde', dateFilter);
                } else {
                    const startOfMonth = new Date();
                    startOfMonth.setDate(1);
                    startOfMonth.setHours(0, 0, 0, 0);
                    dateFilter = startOfMonth.toISOString();
                    console.log('Filtro GERENTE (dia > 10): desde', dateFilter);
                }

                // Cancelamentos/avarias: 3 meses
                const threeMonthsAgo = new Date(now);
                threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
                cancelStart = threeMonthsAgo.toISOString();
            } else {
                // ADMIN: últimos 3 meses (evita limite de 1000 linhas do Supabase)
                const threeMonthsAgo = new Date(now);
                threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
                adminStart = threeMonthsAgo.toISOString();
            }

            // 1. CONSTRUIR QUERIES PARA CARREGAMENTO
            
            // --- INÍCIO BLOCO SEQUENCIAL SORVETE ---
            const ICE_CREAM_STORE_IDS = [
              '0eef2f53-4732-4824-84a5-2092234efaef', // Loja 26 - Cruz das Almas
              'cbeeb1ea-911f-4d3a-87a9-3c38aafa0673'  // Loja 109 - Conceição do Jacuípe
            ];

            const tmpStart = new Date();
            tmpStart.setDate(1);
            tmpStart.setHours(0, 0, 0, 0);
            const sqnStartOfMonth = tmpStart.toISOString();

            const tmpEnd = new Date(tmpStart);
            tmpEnd.setMonth(tmpEnd.getMonth() + 1);
            const sqnEndOfMonth = tmpEnd.toISOString();

            const saved = localStorage.getItem('realcalcados_user');
            const savedUser = saved ? JSON.parse(saved) : null;
            const p_user_id = savedUser?.id || savedUser?.user_id || user?.id || '';

            // 1. ice_cream_sales
            if(p_user_id) await supabase.rpc('set_user_session', { p_user_id });
            const { data: salesData } = await supabase
              .from('ice_cream_sales')
              .select('*')
              .in('store_id', ICE_CREAM_STORE_IDS)
              .gte('created_at', sqnStartOfMonth)
              .lt('created_at', sqnEndOfMonth)
              .order('created_at', { ascending: false });

            // 2. ice_cream_daily_sales
            if(p_user_id) await supabase.rpc('set_user_session', { p_user_id });
            const { data: rawDailySalesData } = await supabase
              .from('ice_cream_daily_sales')
              .select('*')
              .in('store_id', ICE_CREAM_STORE_IDS)
              .gte('created_at', sqnStartOfMonth)
              .lt('created_at', sqnEndOfMonth);
            const dailySalesData = rawDailySalesData || [];

            // 3. ice_cream_daily_sales_payments
            if(p_user_id) await supabase.rpc('set_user_session', { p_user_id });
            const { data: rawPaymentsData } = await supabase
              .from('ice_cream_daily_sales_payments')
              .select('*')
              .in('store_id', ICE_CREAM_STORE_IDS)
              .gte('created_at', sqnStartOfMonth)
              .lt('created_at', sqnEndOfMonth);
            const paymentsData = rawPaymentsData || [];

            // 4. ice_cream_sangria
            if(p_user_id) await supabase.rpc('set_user_session', { p_user_id });
            const { data: sangriaData } = await supabase
              .from('ice_cream_sangria')
              .select('*')
              .in('store_id', ICE_CREAM_STORE_IDS);

            // 5. ice_cream_stock
            if(p_user_id) await supabase.rpc('set_user_session', { p_user_id });
            const { data: icst } = await supabase
              .from('ice_cream_stock')
              .select('*')
              .in('store_id', ICE_CREAM_STORE_IDS);

            // 6. ice_cream_stock_movements
            if(p_user_id) await supabase.rpc('set_user_session', { p_user_id });
            const { data: movementsData } = await supabase
              .from('ice_cream_stock_movements')
              .select('*')
              .in('store_id', ICE_CREAM_STORE_IDS);

            // 7. ice_cream_wastage
            if(p_user_id) await supabase.rpc('set_user_session', { p_user_id });
            const { data: wst } = await supabase
              .from('ice_cream_wastage')
              .select('*')
              .in('store_id', ICE_CREAM_STORE_IDS);

            // 8. ice_cream_future_debts
            if(p_user_id) await supabase.rpc('set_user_session', { p_user_id });
            const { data: fd } = await supabase
              .from('ice_cream_future_debts')
              .select('*')
              .in('store_id', ICE_CREAM_STORE_IDS);
            // --- FIM BLOCO SEQUENCIAL SORVETE ---

            // B. financial_card_sales
            let cardSalesQuery = supabase.from('financial_card_sales').select('*');
            if (isSorvete || isGerente) {
                cardSalesQuery = cardSalesQuery.eq('store_id', userStoreId);
            }
            if (isSorvete) {
                cardSalesQuery = cardSalesQuery.gte('created_at', `${today}T00:00:00`);
            } else if (isGerente && dateFilter) {
                cardSalesQuery = cardSalesQuery.gte('created_at', dateFilter);
            }

            // C. financial_pix_sales
            let pixSalesQuery = supabase.from('financial_pix_sales').select('*');
            if (isSorvete || isGerente) {
                pixSalesQuery = pixSalesQuery.eq('store_id', userStoreId);
            }
            if (isSorvete) {
                pixSalesQuery = pixSalesQuery.gte('created_at', `${today}T00:00:00`);
            } else if (isGerente && dateFilter) {
                pixSalesQuery = pixSalesQuery.gte('created_at', dateFilter);
            }

            // Executar primeira leva em Promise.all
            const [
                {data: ici}, 
                {data: icp}, 
                {data: r}, 
                {data: ce}, 
                {data: ag}, 
                {data: dl}, 
                {data: cl}, 
                {data: lg},
                {data: cds}, 
                {data: pxs}, 
                {data: sangCat}, 
                {data: part}, 
                {data: ausers}
            ] = await Promise.all([
                supabase.from('ice_cream_items').select('*'),
                supabase.from('ice_cream_promissory_notes').select('*'),
                supabase.from('financial_receipts').select('*').order('created_at', { ascending: true }),
                supabase.from('cash_errors').select('*').order('created_at', { ascending: false }),
                supabase.from('agenda_tasks').select('*').order('due_time', { ascending: true }),
                supabase.from('downloads').select('*'),
                supabase.from('cash_register_closures').select('*'),
                supabase.from('system_logs').select('*').order('created_at', { ascending: false }).limit(200),
                cardSalesQuery.order('created_at', { ascending: false }),
                pixSalesQuery.order('created_at', { ascending: false }),
                supabase.from('ice_cream_sangria_categoria').select('*'),
                supabase.from('store_profit_distribution').select('*'),
                supabase.from('admin_users').select('*')
            ]);

            // * daily_sales e payments carregados sequencialmente acima

            // 3. MAPEAR DADOS PARA CAMELCASE (ice_cream_daily_sales → sales prop)
            const mappedSales = dailySalesData.map(item => ({
                id: item.id,
                saleId: item.sale_id,
                storeId: item.store_id,
                itemId: item.item_id,
                productName: item.product_name,
                category: item.category,
                flavor: item.flavor,
                unitsSold: Number(item.units_sold || 0),
                unitPrice: Number(item.unit_price || 0),
                totalValue: Number(item.total_value || 0),
                paymentMethod: item.payment_method,
                saleCode: item.sale_code,
                buyer_name: item.buyer_name,
                createdAt: item.created_at,
                canceledAt: item.canceled_at,
                canceledBy: item.canceled_by,
                status: item.status,
                cancel_reason: item.cancel_reason
            }));

            console.log('=== DIAGNÓSTICO DO MÓDULO SORVETE ===');
            console.log('Vendas Headers (salesData) length:', salesData?.length);
            console.log('Vendas Daily Mapped (mappedSales) length:', mappedSales.length);
            console.log('Payments (paymentsData) length:', paymentsData.length);
            console.log('Sangrias length:', sangriaData?.length);
            console.log('Movements length:', movementsData?.length);
            console.log('=====================================');

            // 4. ATUALIZAR ESTADOS
            if (wst) setIcWastage(wst);
            if (fd) setFutureDebts(fd);
            if (salesData) setSales(salesData);
            setSalePayments(paymentsData.map(x => ({ ...x, amount: Number(x.amount || 0) })));
            if (ici) setIceCreamItems(ici.map(x => ({ id: x.id, storeId: x.store_id, name: x.name, category: x.category, price: Number(x.price || 0), flavor: x.flavor, active: x.active, consumption_per_sale: x.consumption_per_sale || 0, recipe: typeof x.recipe === 'string' ? JSON.parse(x.recipe) : (x.recipe || []), image_url: x.image_url })));
            setIceCreamSales(mappedSales);
            if (cds) setCardSales(cds.map(x => ({ id: x.id, storeId: x.store_id, userId: x.user_id, userName: x.user_name, date: x.date, brand: x.brand, value: Number(x.value || 0), authorizationCode: x.authorization_code, saleCode: x.sale_code, createdAt: x.created_at })));
            if (pxs) setPixSales(pxs.map(x => ({ id: x.id, storeId: x.store_id, userId: x.user_id, userName: x.user_name, date: x.date, saleCode: x.sale_code, value: Number(x.value || 0), clientName: x.payer_name, createdAt: x.created_at })));
            if (icst) setIceCreamStock(icst.map(item => ({ ...item, stock_id: item.id })));
            if (icp) setIcPromissories(icp);
            if (r) setReceipts(r.map(x => ({ 
                id: x.id, 
                storeId: x.store_id, 
                receiptNumber: x.receipt_number,
                formattedNumber: x.formatted_number,
                issuerName: x.issuer_name, 
                payer: x.payer, 
                recipient: x.recipient, 
                value: Number(x.value || 0), 
                valueInWords: x.value_in_words, 
                date: x.receipt_date, 
                reference: x.reference, 
                createdAt: new Date(x.created_at) 
            })));
            if (ce) setCashErrors(ce.map(x => ({...x, id: x.id, storeId: x.store_id, userId: x.user_id, userName: x.user_name || 'Usuário', date: x.error_date || x.date, value: Number(x.value || 0), type: x.type, reason: x.reason, createdAt: new Date(x.created_at)})));
            if (ag) setAgenda(ag.map(x => ({...x, userId: x.user_id, title: x.title, description: x.description, dueDate: x.due_date ? x.due_date.split('T')[0] : '', dueTime: x.due_time, priority: x.priority, isCompleted: x.is_completed})));
            if (dl) setDownloads(dl.map(x => ({...x, fileName: x.file_name, createdBy: x.created_by})));
            if (cl) setClosures(cl.map(x => ({...x, storeId: x.store_id, closedBy: x.closed_by})));
            if (lg) setLogs(lg.map((x: any) => ({
                id: x.id,
                userId: x.user_id,
                userName: x.user_name,
                userRole: x.user_role as UserRole,
                action: x.action,
                details: x.details,
                created_at: x.created_at
            })));
            if (sangCat) setIcSangriaCategories(sangCat);
            if (sangriaData) setIcSangrias(sangriaData);
            if (movementsData) setIcStockMovements(movementsData);
            if (part) setPartners(part);
            if (ausers) setAdminUsers(ausers);

            if (user) {
                const { data: activeSurveys } = await supabase
                    .from('surveys')
                    .select('*')
                    .eq('is_active', true);

                const { data: myResponses } = await supabase
                    .from('survey_responses')
                    .select('survey_id')
                    .eq('user_id', user.id);

                if (activeSurveys) {
                    const respondedIds = myResponses?.map(r => r.survey_id) || [];
                    
                    // Aplicar Filtro de Targeting
                    let surveysVisiveis = activeSurveys;
                    if ((user as any).role_level !== 'admin') {
                        surveysVisiveis = activeSurveys.filter(survey => {
                            if (survey.target_type === 'external') return false;

                            const semRestricaoLoja = !survey.target_store_ids || survey.target_store_ids.length === 0;
                            const userStoreId = user.storeId || (user as any).store_id;
                            const lojaDoUsuario = survey.target_store_ids?.includes(userStoreId || '');
                            if (!semRestricaoLoja && !lojaDoUsuario) return false;

                            if (survey.target_type === 'internal') {
                                const roleLevel = (user as any).role_level;
                                if (survey.target_category === 'all_managers') {
                                    if (roleLevel !== 'manager') return false;
                                }
                                if (survey.target_category === 'all_cashiers') {
                                    if (roleLevel !== 'cashier') return false;
                                }
                                if (survey.target_category === 'specific_users') {
                                    if (!survey.target_user_ids?.includes(user.id)) return false;
                                }
                            }
                            return true;
                        });
                    }

                    const pending = surveysVisiveis.filter(s => !respondedIds.includes(s.id));
                    setPendingSurveys(pending);
                }
            }
        } catch (err) { 
            console.error("Erro Sincronismo:", err); 
        }
        finally { 
            setIsLoading(false); 
        }
    };

    useEffect(() => {
        const channel = supabase.channel('online-sync-global')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'financial_receipts' }, () => fetchData())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'financial_card_sales' }, () => fetchData())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'financial_pix_sales' }, () => fetchData())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'cash_errors' }, () => fetchData())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'ice_cream_daily_sales_payments' }, () => fetchData())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'ice_cream_sales' }, () => fetchData())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'ice_cream_daily_sales' }, () => fetchData())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'ice_cream_future_debts' }, () => fetchData())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'monthly_performance_actual' }, () => fetchData())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'monthly_goals' }, () => fetchData())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'stores' }, () => fetchData())
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, []);

    const WelcomeScreen = () => {
        const userName = user?.name?.split(' ')[0] || 'Usuário';
        const userRole = user?.role || UserRole.CASHIER;

        const roleUpper = String(user?.role || '').toUpperCase();
        const isAdminUser  = roleUpper === 'ADMIN';
        const isManagerUser = roleUpper === 'MANAGER' || roleUpper === 'GERENTE';
        const isSorveteUser = roleUpper === 'ICE_CREAM' || roleUpper === 'SORVETE';

        // Cards do GERENTE (e também do ADMIN — mesmo layout)
        const quickAccessCards = isAdminUser || isManagerUser ? [
          {
            label: 'Meta Loja',
            view: 'dashboard_manager',
            color: 'bg-blue-600',
            icon: <LayoutDashboard size={32} />,
            permission: 'MODULE_DASHBOARD_MANAGER',
          },
          {
            label: 'Meta Semanal',
            view: 'dashboard_pa_manager',
            color: 'bg-purple-600',
            icon: <Target size={32} />,
            permission: 'MODULE_DASHBOARD_PA_MANAGER',
          },
          {
            label: 'Pedido Compra',
            view: 'buy_orders',
            color: 'bg-green-600',
            icon: <ShoppingCart size={32} />,
            permission: 'MODULE_BUY_ORDERS',
          },
          {
            label: 'Chamado',
            view: 'demands_v2',
            color: 'bg-orange-500',
            icon: <ClipboardList size={32} />,
            permission: 'MODULE_DEMANDS',
          },
          {
            label: 'Sorvete',
            view: 'ice_cream',
            color: 'bg-pink-500',
            icon: <IceCreamIcon size={32} />,
            permission: 'MODULE_ICECREAM',
          },
          {
            label: 'Pesquisa',
            view: isAdminUser ? 'admin_surveys' : 'my_surveys',
            color: 'bg-amber-500',
            icon: <ClipboardList size={32} />,
            permission: 'MODULE_ADMIN_SURVEYS',
          },
        ] : isSorveteUser ? [
          {
            label: 'Sorvete',
            view: 'ice_cream',
            color: 'bg-pink-500',
            icon: <IceCreamIcon size={32} />,
            permission: 'MODULE_ICECREAM',
          },
          {
            label: 'Chamado',
            view: 'demands_v2',
            color: 'bg-orange-500',
            icon: <ClipboardList size={32} />,
            permission: 'MODULE_DEMANDS',
          },
        ] : [
          // Cashier e outros — apenas chamado
          {
            label: 'Chamado',
            view: 'demands_v2',
            color: 'bg-orange-500',
            icon: <ClipboardList size={32} />,
            permission: 'MODULE_DEMANDS',
          },
        ];

        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
                <div className="mb-12">
                    <div className="w-48 h-48 bg-white rounded-full shadow-2xl flex items-center justify-center overflow-hidden border-4 border-white">
                        <img
                            src={BRAND_LOGO}
                            alt="Real Calçados"
                            className="w-[70%] h-[70%] object-contain"
                            referrerPolicy="no-referrer"
                        />
                    </div>
                </div>

                <div className="text-center mb-8 animate-fade-in">
                    <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-blue-800 bg-clip-text text-transparent mb-2">
                        Olá, {userName}! 👋
                    </h1>
                    <p className="text-lg text-gray-600 dark:text-slate-400">
                        Bem-Vindo ao Sistema Real Calçados Gerencial
                    </p>
                </div>

                {quickAccessCards.length > 0 && (
                    <div className="mb-12 animate-fade-in-up flex flex-col items-center px-4">
                        <p className="text-sm text-gray-500 mb-6 text-center font-medium uppercase tracking-widest">ACESSO RÁPIDO</p>
                        <div className={`grid gap-4 justify-center ${
                          quickAccessCards.length <= 3 
                            ? 'grid-cols-' + quickAccessCards.length 
                            : 'grid-cols-3'
                        } max-w-lg mx-auto`}>
                          {quickAccessCards
                            .filter(card => can(card.permission))
                            .map((card, idx) => (
                              <button
                                key={idx}
                                onClick={() => setCurrentView(card.view)}
                                className={`${card.color} hover:opacity-90 active:scale-95 transition-all text-white rounded-2xl p-5 flex flex-col items-center justify-center gap-3 shadow-lg aspect-square`}
                              >
                                {card.icon}
                                <span className="text-xs font-black uppercase tracking-wide text-center leading-tight">
                                  {card.label}
                                </span>
                              </button>
                            ))
                          }
                        </div>
                    </div>
                )}

                <div className="flex items-center justify-center gap-3 text-gray-500 bg-white dark:bg-slate-800 px-8 py-4 rounded-full shadow-md border border-gray-100 dark:border-slate-700 animate-fade-in-up">
                    <AlertCircle size={20} className="text-blue-500" />
                    <span className="text-sm font-medium">Use o menu lateral para navegar entre os módulos</span>
                </div>

                <div className="mt-12 text-center text-xs text-gray-400 w-full">
                    <p className="font-medium">Sistema Real Calçados Sub Grupo ARRJ © 2026</p>
                    <p className="mt-2 text-gray-400">Versão 2.0</p>
                </div>
            </div>
        );
    };

    const handleLogin = async (email: string, pass: string, remember: boolean) => {
        try {
            const result = await apiService.login(email, pass);

            if (!result || !result.user) {
                throw new Error('Resposta de login inválida');
            }

            // ✅ Aceitar múltiplos formatos de ID
            const userId = result.user.user_id || result.user.id || (result.user as any).userId;
            
            if (!userId) {
                console.error('❌ Debug - result.user:', result.user);
                throw new Error('ID do usuário não encontrado na resposta de login');
            }

            // ✅ Mapear role (banco retorna role_level, mas pode vir como role também)
            const rawRole = (result.user.role || result.user.role_level || '').toUpperCase().trim();

            let mappedRole: UserRole = UserRole.CASHIER;
            if (rawRole === 'ADMIN' || rawRole === 'ADMINISTRADOR') mappedRole = UserRole.ADMIN;
            else if (rawRole === 'MANAGER' || rawRole === 'GERENTE') mappedRole = UserRole.MANAGER;
            else if (rawRole === 'CAIXA' || rawRole === 'CASHIER') mappedRole = UserRole.CASHIER;
            else if (rawRole === 'SORVETE' || rawRole === 'SORVETERIA' || rawRole === 'ICE_CREAM') mappedRole = UserRole.ICE_CREAM;

            const loggedUser: User = {
                id: userId,
                name: result.user.name,
                role: mappedRole,
                email: result.user.email,
                storeId: result.user.storeId || result.user.store_id
            };

            setUser(loggedUser);
            localStorage.setItem('realcalcados_user', JSON.stringify(loggedUser));
            localStorage.setItem('auth_token', 'session_active');
            
            await fetchPermissions(mappedRole, loggedUser.name);
            fetchData({ role: mappedRole, storeId: loggedUser.storeId });

            return { success: true, user: loggedUser };
        } catch (err: any) {
            console.error('❌ Erro no login:', err);
            return { success: false, error: err.message || 'Falha na conexão.' };
        }
    };

    const handleLogout = async () => {
        await apiService.logout();
        localStorage.clear();
        setUser(null);
        setCurrentView('welcome');
    };

    const handleSaveIceCreamProduct = async (product: Partial<IceCreamItem>) => {
        const payload = {
            store_id: product.storeId, name: product.name, category: product.category, price: product.price,
            flavor: product.flavor, active: product.active ?? true, consumption_per_sale: product.consumptionPerSale || 0,
            recipe: JSON.stringify(product.recipe || []), image_url: product.image_url
        };
        if (product.id) await supabase.from('ice_cream_items').update(payload).eq('id', product.id);
        else await supabase.from('ice_cream_items').insert([payload]);
        await fetchData();
    };

    const handleRegisterRequest = async (store: Partial<Store>) => {
        try {
            const { error } = await supabase.from('stores').insert([{
                number: store.number,
                name: store.name,
                city: store.city,
                manager_name: store.managerName,
                manager_email: store.managerEmail,
                manager_phone: store.managerPhone,
                status: 'pending'
            }]);
            if (error) throw error;
        } catch (err: any) {
            console.error("Register Error:", err);
            throw err;
        }
    };

    if (!user) return (
        <div className="relative">
            <LoginScreen onLoginAttempt={handleLogin} onRegisterRequest={handleRegisterRequest} />
        </div>
    );

    return (
        <>
            <style>{styles}</style>
            <div className="flex h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 overflow-hidden font-sans relative transition-colors duration-300">
            {isSidebarOpen && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[90]" onClick={() => setIsSidebarOpen(false)} />
            )}

            <aside className={`
                fixed inset-y-0 left-0 z-[100] w-72 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col p-6 transition-all duration-300 transform
                ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
            `}>
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <img src={BRAND_LOGO} alt="Logo" referrerPolicy="no-referrer" className="h-[52px] w-auto object-contain dark:brightness-125" />
                        </div>
                        <div className="flex flex-col justify-center">
                            <h2 style={{ 
                                fontWeight: 950, 
                                fontSize: '18px', 
                                color: '#1B2A6B', 
                                margin: 0, 
                                lineHeight: 1,
                                letterSpacing: '-0.03em',
                                textTransform: 'uppercase'
                            }}>
                                Administrativo
                            </h2>
                            <p style={{ 
                                fontWeight: 700, 
                                fontSize: '10px', 
                                color: '#64748b', 
                                margin: '3px 0 0 0',
                                letterSpacing: '0.08em',
                                textTransform: 'uppercase'
                            }}>
                                Grupo Real Calçados
                            </p>
                        </div>
                    </div>
                    <button onClick={() => setIsSidebarOpen(false)} className="p-2 text-slate-400 hover:text-slate-900 dark:hover:text-white">
                        <X size={24} />
                    </button>
                </div>
                <nav className="flex-1 space-y-6 overflow-y-auto no-scrollbar">
                    {[
                        { title: 'Inteligência', items: [
                            {
                                id: 'gestao-metas',
                                label: 'Gestão de Metas',
                                icon: Trophy,
                                isGroup: true,
                                subItems: [
                                    { id: 'dashboard_rede', label: 'Meta da Rede', icon: LayoutDashboard, perm: 'MODULE_DASHBOARD_ADMIN', roles: ['admin'] },
                                    { id: 'dashboard_loja', label: 'Meta da Loja', icon: LayoutDashboard, perm: 'MODULE_DASHBOARD_MANAGER', roles: ['manager', 'admin'] },
                                    { id: 'dashboard_pa', label: 'Meta Semanal Admin', icon: Trophy, perm: 'MODULE_DASHBOARD_PA', roles: ['admin'] },
                                    { id: 'dashboard_pa_manager', label: 'Meta Semanal Gerente', icon: Trophy, perm: 'MODULE_DASHBOARD_PA_MANAGER', roles: ['manager'] }
                                ]
                            },
                            { 
                                id: 'gestao-compras', 
                                label: 'Gestão de Compras', 
                                icon: ShoppingCart, 
                                isGroup: true, 
                                subItems: [
                                    { id: 'buy_order_dashboard', label: 'Dashboard Compras', icon: BarChart3, perm: 'MODULE_BUY_ORDERS', roles: ['admin', 'manager'] },
                                    { id: 'buy_order_analytic', label: 'ANÁLISE FORNECEDORES', icon: BarChart3, perm: 'MODULE_BUY_ORDERS', roles: ['admin'] },
                                    { id: 'buy_orders', label: 'Pedido de Compra', icon: ShoppingBag, perm: 'MODULE_BUY_ORDERS', roles: ['admin', 'manager'] },
                                    { id: 'buy_order_quota', label: 'COTA DE COMPRA', icon: DollarSign, perm: 'MODULE_BUY_ORDERS', roles: ['admin', 'manager'] },
                                    { id: 'admin_quota_extra', label: 'APROVAÇÃO COTA EXTRA', icon: CheckCircle, perm: 'MODULE_BUY_ORDERS', roles: ['admin'] },
                                    { id: 'purchase_params', label: 'PARÂMETROS DE COMPRA', icon: Settings, perm: 'MODULE_PURCHASES', roles: ['admin'] },
                                    { id: 'buy_order_photos', label: 'FOTOS DO PEDIDO', icon: Camera, perm: 'MODULE_BUY_ORDERS', roles: ['admin', 'manager'] }
                                ] 
                            },
                            { id: 'reports_dashboard', label: 'Gestão de Relatórios', icon: BarChart3, perm: 'MODULE_BUY_ORDERS', roles: ['admin', 'manager'] },
                            { id: 'dre_accounts', label: 'Plano de Contas DRE', icon: ClipboardList, perm: 'MODULE_DRE_ACCOUNTS', roles: ['admin'] },
                            { id: 'metas', label: 'Metas', icon: Target, perm: 'MODULE_METAS', roles: ['admin'] },
                            { id: 'os_demandas', label: 'Chamado', icon: ClipboardList, perm: 'MODULE_DEMANDS' }
                        ] },
                        { title: 'Operacional', items: [
                            { id: 'pdv_sorveteria', label: 'Sorveteria Real', icon: IceCreamIcon, perm: 'MODULE_ICECREAM', roles: ['admin', 'manager', 'sorvete', 'ice_cream'] },
                            { id: 'caixa', label: 'Caixa', icon: ClipboardList, perm: 'MODULE_CASH_REGISTER', roles: ['admin', 'manager', 'cashier', 'caixa'] },
                            { id: 'agenda', label: 'Agenda Semanal', icon: Calendar, perm: 'MODULE_AGENDA', roles: ['admin', 'manager', 'sorvete', 'ice_cream'] },
                            { id: 'my_surveys', label: 'Minhas Pesquisas', icon: ClipboardList, perm: 'ALWAYS', roles: ['admin', 'manager', 'cashier', 'caixa', 'sorvete', 'ice_cream'] }
                        ] },
                        { title: 'Documentos', items: [ { id: 'autoriz_compra', label: 'Autoriz. Compra', icon: FileSignature, perm: 'MODULE_AUTORIZ_COMPRA' }, { id: 'termo_condicional', label: 'Termo Condicional', icon: FileText, perm: 'MODULE_TERMO_CONDICIONAL' }, { id: 'downloads', label: 'Downloads', icon: Download, perm: 'MODULE_DOWNLOADS' } ] },
                        { title: 'Administração', items: [
                            { id: 'users', label: 'Usuários', icon: Users, perm: 'MODULE_ADMIN_USERS' },
                            { id: 'surveys', label: 'Pesquisas', icon: BarChart3, perm: 'MODULE_ADMIN_SURVEYS' },
                            { id: 'access', label: 'Acessos', icon: ShieldAlert, perm: 'MODULE_ACCESS_CONTROL' },
                            { id: 'audit', label: 'Auditoria', icon: Shield, perm: 'MODULE_AUDIT' },
                            { id: 'settings', label: 'Configurações', icon: Settings, perm: 'MODULE_SETTINGS' }
                        ] }
                    ].map(section => {
                        const visibleItems = section.items.filter(i => {
                            // Submenu sempre visível
                            if ((i as any).isGroup) return true;
                            
                            // ✅ ADMIN vê TUDO
                            if (user?.role === UserRole.ADMIN) return true;
                            
                            // Para outros usuários
                            const userRole = String(user?.role || '').toLowerCase();
                            const itemRoles = (i as any).roles || [];
                            const hasRole = itemRoles.length === 0 || itemRoles.map((r: string) => r.toLowerCase()).includes(userRole);
                            
                            return hasRole && can(i.perm);
                        });
                        if (visibleItems.length === 0) return null;
                        return (
                            <div key={section.title} className="space-y-1">
                                <h3 className="px-4 text-[10px] font-black uppercase text-slate-400 dark:text-slate-400 tracking-widest mb-2">{section.title}</h3>
                                {visibleItems.map((item: any) => {
                                    if (item.isGroup) {
                                        const visibleSubItems = item.subItems!.filter((sub: any) => {
                                            // ✅ ADMIN vê TODOS os sub-itens
                                            if (user?.role === UserRole.ADMIN) return true;
                                            
                                            // Para outros usuários
                                            const userRole = String(user?.role || '').toLowerCase();
                                            const subRoles = sub.roles || [];
                                            const hasRole = subRoles.length === 0 || subRoles.map((r: string) => r.toLowerCase()).includes(userRole);
                                            
                                            return hasRole && can(sub.perm);
                                        });
                                        if (visibleSubItems.length === 0) return null;
                                        const isActiveGroup = visibleSubItems.some((sub: any) => sub.id === currentView || (sub.id === 'dashboard_loja' && currentView === 'dashboard_manager'));
                                        return (
                                            <div key={item.id} className="space-y-1 mt-2">
                                                <button
                                                    onClick={() => {
                                                        setActiveMenu(prev => prev === item.id ? null : item.id);
                                                        if (item.id === 'gestao-compras') {
                                                            setCurrentView('buy_order_dashboard');
                                                        }
                                                        if (window.innerWidth < 768) setIsSidebarOpen(false);
                                                    }}
                                                    className={`w-full text-left py-2.5 px-4 rounded-xl font-black uppercase text-[10px] flex items-center gap-4 transition-all relative ${
                                                        isActiveGroup
                                                            ? 'bg-blue-600/10 text-blue-600 dark:text-blue-400'
                                                            : 'text-slate-500 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800'
                                                    }`}
                                                >
                                                    <item.icon size={20} /> 
                                                    <span>{item.label}</span>
                                                    <span className="ml-auto text-[8px]">{activeMenu === item.id ? '▼' : '▶️'}</span>
                                                </button>
                                                {(activeMenu === item.id) && (
                                                    <div className="pl-6 space-y-1 mt-1 border-l-2 border-slate-200 dark:border-slate-700 ml-6">
                                                        {visibleSubItems.map((subItem: any) => (
                                                            <button
                                                                key={subItem.id}
                                                                onClick={() => { setCurrentView(subItem.id); setIsSidebarOpen(false); }}
                                                                className={`w-full text-left py-2 px-4 rounded-lg font-bold uppercase text-[9px] flex items-center gap-3 transition-all relative ${
                                                                    (currentView === subItem.id || (subItem.id === 'pdv_sorveteria' && currentView === 'ice_cream') || (subItem.id === 'os_demandas' && currentView === 'demands_v2') || (subItem.id === 'surveys' && currentView === 'admin_surveys') || (subItem.id === 'dashboard_loja' && currentView === 'dashboard_manager'))
                                                                        ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20'
                                                                        : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-50/50 dark:hover:bg-slate-800/50'
                                                                }`}
                                                            >
                                                                <subItem.icon size={14} /> 
                                                                <span>{subItem.label}</span>
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    }
                                    return (
                                        <button
                                            key={item.id}
                                            onClick={() => { setCurrentView(item.id); setIsSidebarOpen(false); }}
                                            className={`w-full text-left py-2.5 px-4 rounded-xl font-black uppercase text-[10px] flex items-center gap-4 transition-all relative ${
                                                (currentView === item.id || (item.id === 'pdv_sorveteria' && currentView === 'ice_cream') || (item.id === 'os_demandas' && currentView === 'demands_v2') || (item.id === 'surveys' && currentView === 'admin_surveys') || (item.id === 'dashboard_loja' && currentView === 'dashboard_manager'))
                                                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-200 dark:shadow-blue-900/20'
                                                    : 'text-slate-500 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800'
                                            }`}
                                        >
                                            <item.icon size={20} /> 
                                            <span>{item.label}</span>
                                            {item.id === 'os_demandas' && hasUnreadDemands && (
                                                <span className="ml-auto flex h-2 w-2">
                                                    <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-green-400 opacity-75"></span>
                                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.8)]"></span>
                                                </span>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        );
                    })}
                </nav>
                <div className="mt-8 space-y-2">
                    <button
                        onClick={() => setIsChangePasswordOpen(true)}
                        className="w-full flex items-center gap-4 p-4 text-slate-500 dark:text-slate-300 font-black uppercase text-[10px] hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white rounded-xl transition-all border border-slate-100 dark:border-slate-800"
                    >
                        <Lock size={18} /> Alterar Senha
                    </button>
                    <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-4 p-4 text-red-500 font-black uppercase text-[10px] hover:bg-red-50/50 dark:hover:bg-red-900/20 rounded-xl transition-all border border-red-100 dark:border-red-900/30"
                    >
                        <LogOut size={18} /> Sair
                    </button>
                </div>
            </aside>
            <div className="flex-1 flex flex-col h-full bg-slate-50 dark:bg-slate-950 overflow-hidden text-slate-900 dark:text-slate-100 transition-colors duration-300">
                <header className="h-16 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 items-center justify-between px-4 md:px-6 flex shrink-0 z-50 transition-colors duration-300">
                    <div className="flex items-center gap-2 md:gap-4">
                        <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 text-slate-400 hover:text-slate-900 dark:hover:text-white">
                            <Menu size={24} />
                        </button>
                        <span className="text-[10px] md:text-xs font-black uppercase text-slate-400 dark:text-slate-400 flex items-center gap-2 md:gap-3">
                            <UserCog size={18} className="hidden xs:block"/> Sessão: <span className="text-slate-900 dark:text-white italic truncate max-w-[100px] md:max-w-none">{user?.name}</span>
                            <button
                                onClick={() => setIsChangePasswordOpen(true)}
                                className="p-1.5 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-300 rounded-lg hover:bg-blue-600 hover:text-white transition-all shadow-sm border border-slate-200 dark:border-slate-700"
                                title="Alterar Senha"
                            >
                                <Lock size={14} />
                            </button>
                        </span>
                    </div>
                    <div className="flex items-center gap-2 md:gap-4">
                        <button
                            onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
                            className="p-2.5 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-300 rounded-xl hover:bg-blue-600 hover:text-white transition-all shadow-sm border border-slate-200 dark:border-slate-700 flex items-center gap-2"
                            title={theme === 'light' ? 'Modo Escuro' : 'Modo Claro'}
                        >
                            {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
                            <span className="hidden sm:inline text-[10px] font-black uppercase">{theme === 'light' ? 'Escuro' : 'Claro'}</span>
                        </button>
                        <NotificationHeader user={user!} stores={stores} agenda={agenda} onNavigate={setCurrentView} can={can} />
                    </div>
                </header>

                {/* ── Aviso de sessão prestes a expirar ── */}
                {sessionWarning && (
                    <div className="bg-amber-500 text-white px-6 py-2 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <AlertCircle size={18} />
                            <span className="text-[10px] font-black uppercase tracking-widest">
                                ⚠️ Sua sessão expira em 5 minutos. Salve o que estiver fazendo.
                            </span>
                        </div>
                        <button
                            onClick={() => setSessionWarning(false)}
                            className="text-[10px] font-black uppercase tracking-widest opacity-80 hover:opacity-100 underline"
                        >
                            Ok, entendido
                        </button>
                    </div>
                )}

                {pendingSurveys.length > 0 && (
                    <div className="bg-blue-600 text-white px-6 py-2 flex items-center justify-between animate-pulse cursor-pointer hover:bg-blue-700 transition-colors" onClick={() => setShowSurveyAlert(true)}>
                        <div className="flex items-center gap-3">
                            <ClipboardList size={18} />
                            <span className="text-[10px] font-black uppercase tracking-widest">Você tem {pendingSurveys.length} {pendingSurveys.length === 1 ? 'pesquisa pendente' : 'pesquisas pendentes'} para responder</span>
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2">Clique para visualizar <ArrowRight size={14} /></span>
                    </div>
                )}

                <main className="flex-1 overflow-y-auto no-scrollbar p-3 md:p-6 lg:p-8">
                    <ErrorBoundary fallback={
                        <div className="flex flex-col items-center justify-center h-full p-8 text-center">
                            <AlertCircle size={48} className="text-red-500 mb-4" />
                            <h2 className="text-xl font-bold mb-2">Erro ao carregar módulo</h2>
                            <p className="text-gray-600 mb-4">Não foi possível carregar este componente. Tente recarregar a página.</p>
                            <button 
                                onClick={() => window.location.reload()}
                                className="px-6 py-2 bg-blue-600 text-white rounded-xl font-bold"
                            >
                                Recarregar
                            </button>
                        </div>
                    }>
                    <Suspense fallback={<PageLoader />}>
                        {(() => {
                        if (currentView === 'welcome') return <WelcomeScreen />;
                        if (currentView === 'dashboard_rede' && can('MODULE_DASHBOARD_ADMIN')) return <DashboardAdmin stores={stores} performanceData={performanceData} goalsData={goalsData} sangrias={icSangrias} initialWeightRevenue={goalsRankingParams?.weight_revenue ?? 50} initialWeightTicket={goalsRankingParams?.weight_ticket ?? 30} initialWeightPA={goalsRankingParams?.weight_pa ?? 20} onSaveWeights={async (wRev, wTicket, wPA) => {
                            const payload = {
                                weight_revenue: wRev,
                                weight_ticket: wTicket,
                                weight_pa: wPA,
                                updated_at: new Date().toISOString()
                            };

                            // 🆕 CORRIGIDO: Salva na tabela correta (goals_ranking_parameters)
                            const { data: existingParams } = await supabase
                                .from('goals_ranking_parameters')
                                .select('id')
                                .limit(1)
                                .maybeSingle();

                            let result;
                            if (existingParams?.id) {
                                result = await supabase
                                    .from('goals_ranking_parameters')
                                    .update(payload)
                                    .eq('id', existingParams.id);
                            } else {
                                result = await supabase
                                    .from('goals_ranking_parameters')
                                    .insert([payload]);
                            }

                            if (result.error) {
                                console.error("Erro ao salvar pesos:", result.error);
                                alert("Erro ao salvar pesos: " + result.error.message);
                            } else {
                                fetchData();
                            }
                        }} onRefresh={fetchData} onImportPerformance={async (d) => {
                            const upsertData = d.map(row => {
                                const [y, m] = row.month.split('-');
                                return {
                                    store_id: row.storeId,
                                    month: row.month,
                                    year: parseInt(y),
                                    month_num: parseInt(m),
                                    revenue_actual: row.revenueActual,
                                    items_actual: row.itemsActual,
                                    sales_actual: row.salesActual,
                                    items_per_ticket: row.paActual,
                                    unit_price_average: row.puActual,
                                    average_ticket: row.averageTicket,
                                    pa_actual: row.paActual,
                                    pu_actual: row.puActual,
                                    ticket_actual: row.averageTicket,
                                    delinquency_rate: row.delinquencyRate,
                                    delinquency_actual: row.delinquencyRate,
                                    business_days: row.businessDays,
                                    percent_meta: row.percentMeta,
                                    trend: row.trend,
                                    last_import_by: user?.name
                                };
                            });
                            const { error } = await supabase.from('monthly_performance_actual').upsert(upsertData, { onConflict: 'store_id,month', ignoreDuplicates: false });
                            if (error) {
                                console.error("Erro ao salvar monthly_performance_actual:", error);
                                alert("Erro ao salvar dados no banco: " + error.message);
                            } else {
                                fetchData();
                            }
                        }} />;
                        if ((currentView === 'dashboard_loja' || currentView === 'dashboard_manager') && can('MODULE_DASHBOARD_MANAGER')) return <DashboardManager user={user!} stores={stores} performanceData={performanceData} goalsData={goalsData} sangrias={icSangrias} stockMovements={icStockMovements} stock={iceCreamStock} weightRevenue={goalsRankingParams?.weight_revenue ?? 70} weightPA={goalsRankingParams?.weight_pa ?? 30} />;
                        if (currentView === 'metas' && can('MODULE_METAS')) return <GoalRegistration user={user!} stores={isAdmin ? stores : stores.filter(s => s.id === user?.storeId)} goalsData={goalsData} onRefresh={fetchData} onSaveGoals={async (data) => { for(const row of data) { await supabase.from('monthly_goals').upsert({ store_id: row.storeId, year: row.year, month: row.month, revenue_target: row.revenueTarget, pa_target: row.paTarget, pu_target: row.puTarget, ticket_target: row.ticketTarget, items_target: row.itemsTarget, business_days: row.businessDays, delinquency_target: row.delinquencyTarget, trend: row.trend }, { onConflict: 'store_id, year, month' }); } fetchData(); }} />;
                        if (currentView === 'dre_accounts' && can('MODULE_DRE_ACCOUNTS')) return <DREAccounts />;
                        if (currentView === 'buy_order_photos' && can('MODULE_BUY_ORDERS')) return <BuyOrderPhotos />;
                        if (currentView === 'buy_order_dashboard' && can('MODULE_BUY_ORDERS')) return <BuyOrderDashboard user={user!} />;
                        if (currentView === 'buy_order_analytic' && can('MODULE_BUY_ORDERS')) return <BuyOrderAnalytic user={user!} stores={stores} />;
                        if (currentView === 'buy_order_quota' && can('MODULE_BUY_ORDERS')) return <BuyOrderQuotaView user={user!} />;
                        if (currentView === 'admin_quota_extra' && can('MODULE_BUY_ORDERS')) return <AdminQuotaExtraApprovals userId={user!.id} />;
                        if (currentView === 'purchase_params') return <BuyOrderParams user={user!} />;
                        if (currentView === 'reports_dashboard') return <ReportsPage user={user!} />;
                        if ((currentView === 'pdv_sorveteria' || currentView === 'ice_cream') && can('MODULE_ICECREAM')) return <IceCreamModule
                            user={user!} stores={isAdmin ? stores : stores.filter(s => s.id === user?.storeId)} items={iceCreamItems} sales={iceCreamSales} salesHeaders={sales} salePayments={salePayments}
                            stock={iceCreamStock} promissories={icPromissories} can={can}
                            sangriaCategories={icSangriaCategories}
                            sangrias={icSangrias}
                            stockMovements={icStockMovements}
                            wastage={icWastage}
                            partners={partners}
                            adminUsers={adminUsers}
                            futureDebts={futureDebts}
                            onAddSangria={async (s) => { const { error } = await supabase.from('ice_cream_sangria').insert([s]); if (error) throw error; await fetchData(); }}
                            onAddSangriaCategory={async (c) => { const { error } = await supabase.from('ice_cream_sangria_categoria').insert([c]); if (error) throw error; await fetchData(); }}
                            onDeleteSangriaCategory={async (id) => { const { error } = await supabase.from('ice_cream_sangria_categoria').delete().eq('id', id); if (error) throw error; await fetchData(); }}
                            onAddStockMovement={async (m) => { const { error } = await supabase.from('ice_cream_stock_movements').insert([m]); if (error) throw error; await fetchData(); }}
                            onAddFutureDebt={async (debtData) => {
                                const { error } = await supabase.from('ice_cream_future_debts').insert([
                                    {
                                        store_id: debtData.store_id,
                                        supplier_name: debtData.supplier_name,
                                        total_amount: debtData.total_amount,
                                        installment_number: debtData.installment_number,
                                        total_installments: debtData.total_installments,
                                        installment_amount: debtData.installment_amount,
                                        due_date: debtData.due_date,
                                        status: debtData.status || 'pending',
                                        category_id: debtData.category_id,
                                        description: debtData.description,
                                        created_by: user?.id
                                    }
                                ]);
                                if (error) throw error;
                                await fetchData();
                            }}
                            onPayFutureDebt={async (debtId, paymentDate) => {
                                const { error } = await supabase.from('ice_cream_future_debts').update({
                                    status: 'paid',
                                    payment_date: paymentDate
                                }).eq('id', debtId);
                                if (error) throw error;
                                await fetchData();
                            }}
                            fetchData={fetchData}
                            onAddSales={async (s) => {
                                await supabase.from('ice_cream_daily_sales').insert(s.map(x => ({
                                    store_id: x.storeId,
                                    item_id: x.itemId,
                                    product_name: x.productName,
                                    category: x.category,
                                    flavor: x.flavor,
                                    units_sold: Math.round(x.unitsSold),
                                    unit_price: x.unitPrice,
                                    total_value: x.totalValue,
                                    payment_method: x.paymentMethod,
                                    sale_code: x.saleCode,
                                    buyer_name: x.buyer_name,
                                    status: 'completed'
                                })));
                                fetchData();
                            }}
                            onAddSaleAtomic={async (saleData, items, payments) => {
                                const totalPayments = payments.reduce((acc, p) => acc + p.amount, 0);
                                if (Math.abs(totalPayments - saleData.total) > 0.01) {
                                    throw new Error("A soma dos pagamentos não confere com o total da venda.");
                                }

                                const buyerName = saleData.buyer_name?.trim() || null;

                                const { data: header, error: headerError } = await supabase
                                    .from('ice_cream_sales')
                                    .insert([{
                                        store_id: saleData.store_id,
                                        total_value: saleData.total,
                                        sale_code: saleData.sale_code,
                                        buyer_name: buyerName,
                                        status: 'completed',
                                        created_at: new Date().toISOString()
                                    }])
                                    .select().single();

                                if (headerError) throw headerError;
                                const saleId = header.id;

                                try {
                                    const { error: itemsError } = await supabase.from('ice_cream_daily_sales').insert(items.map(x => ({
                                        sale_id: saleId,
                                        store_id: saleData.store_id,
                                        item_id: x.itemId,
                                        product_name: x.productName,
                                        category: x.category,
                                        flavor: x.flavor,
                                        units_sold: Math.round(x.unitsSold),
                                        unit_price: x.unitPrice,
                                        total_value: x.totalValue,
                                        payment_method: payments.length > 1 ? 'Misto' : payments[0].method,
                                        sale_code: saleData.sale_code,
                                        buyer_name: buyerName,
                                        status: 'completed'
                                    })));

                                    if (itemsError) {
                                        await supabase.from('ice_cream_sales').delete().eq('id', saleId);
                                        throw itemsError;
                                    }

                                    const { error: paymentsError } = await supabase.from('ice_cream_daily_sales_payments').insert(payments.map(p => ({
                                        sale_id: saleId,
                                        store_id: header.store_id,
                                        payment_method: p.method,
                                        amount: p.amount,
                                        sale_code: saleData.sale_code,
                                        buyer_name: buyerName,
                                        created_at: new Date().toISOString()
                                    })));

                                    if (paymentsError) {
                                        await supabase.from('ice_cream_daily_sales').delete().eq('sale_id', saleId);
                                        await supabase.from('ice_cream_sales').delete().eq('id', saleId);
                                        throw paymentsError;
                                    }

                                    // === IMPRESSÃO AUTOMÁTICA VIA THERMAL PRINTER (RAWBT CLASSIC) ===
                                    try {
                                        const store = stores.find(s => s.id === saleData.store_id);
                                        const isFiado = payments.some(p => p.method === 'Fiado');
                                        
                                        printReceipt({
                                            storeName: 'REAL CALCADOS',
                                            storeSubtitle: `Sorveteria - ${store?.name || 'Geral'}`,
                                            orderNumber: header.order_number || 1,
                                            date: new Date().toLocaleString('pt-BR'),
                                            attendantName: user?.name || user?.email || '',
                                            items: items.map(item => ({
                                                product_name: item.productName || '',
                                                units_sold: Math.round(item.unitsSold || 1),
                                                unit_price: Number(item.unitPrice || 0),
                                                total_value: Number(item.totalValue || 0),
                                            })),
                                            total: saleData.total,
                                            isFiado,
                                            buyerName: buyerName || undefined
                                        });
                                        console.log('[Printer] Cupom enviado para impressora.');
                                    } catch (printErr) {
                                        console.error('[Printer] Erro na impressão automática:', printErr);
                                    }
                                } catch (err) {
                                    console.error("Erro na transação de venda (Rollback manual):", err);
                                    throw err;
                                }
                                fetchData();
                            }}
                            onCancelSale={async (idOrCode, reason) => {
                                const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrCode);

                                let saleCode = idOrCode;
                                let saleId = isUUID ? idOrCode : null;

                                if (isUUID) {
                                    const { data: sale } = await supabase.from('ice_cream_sales').select('sale_code').eq('id', idOrCode).maybeSingle();
                                    if (sale) saleCode = sale.sale_code;
                                } else {
                                    const { data: sale } = await supabase.from('ice_cream_sales').select('id').eq('sale_code', idOrCode).maybeSingle();
                                    if (sale) saleId = sale.id;
                                }

                                // ✅ NOVO: Registrar quem cancelou e quando
                                const cancelData = {
                                    status: 'canceled',
                                    cancel_reason: reason,
                                    canceled_by: user?.name,
                                    canceled_at: new Date().toISOString()
                                };

                                if (saleId) {
                                    await supabase.from('ice_cream_sales').update({ ...cancelData, canceled_by_name: user?.name }).eq('id', saleId);
                                    await supabase.from('ice_cream_daily_sales').update(cancelData).eq('sale_id', saleId);
                                } else {
                                    await supabase.from('ice_cream_sales').update({ ...cancelData, canceled_by_name: user?.name }).eq('sale_code', saleCode);
                                    await supabase.from('ice_cream_daily_sales').update(cancelData).eq('sale_code', saleCode);
                                }

                                await Promise.all([
                                    supabase.from('financial_card_sales').delete().eq('sale_code', saleCode),
                                    supabase.from('financial_pix_sales').delete().eq('sale_code', saleCode),
                                    supabase.from('ice_cream_daily_sales_payments').delete().eq('sale_code', saleCode)
                                ]);

                                await fetchData();
                            }}
                            onUpdatePrice={async (id, p) => { await supabase.from('ice_cream_items').update({ price: p }).eq('id', id); await fetchData(); }}
                            onAddItem={async (n, c, p, f, si, u, cps, tsId, r) => { await handleSaveIceCreamProduct({ storeId: tsId, name: n, category: c as any, price: p, flavor: f, recipe: r }); }}
                            onSaveProduct={handleSaveIceCreamProduct}
                            onDeleteItem={async (id) => { await supabase.from('ice_cream_items').delete().eq('id', id); await fetchData(); }}
                            onUpdateStock={async (sId, b, v, u, type, stockId) => {
                                if (type === 'INVENTARIO' && stockId) {
                                    const { error } = await supabase.rpc('perform_inventory', {
                                        p_stock_id:     stockId,
                                        p_new_quantity: v,
                                        p_user_id:      null,
                                        p_notes:        'Inventário manual'
                                    });
                                    if (error) throw error;
                                } else {
                                    const { data: current } = await supabase.from('ice_cream_stock').select('stock_current').eq('store_id', sId).eq('product_base', b).maybeSingle();
                                    let finalVal = v;
                                    if (current) { finalVal = Number(current.stock_current || 0) + v; }
                                    await supabase.from('ice_cream_stock').upsert({ store_id: sId, product_base: b, stock_current: finalVal, unit: u, is_active: true }, { onConflict: 'store_id, product_base' });
                                }
                                await fetchData();
                            }}
                            liquidatePromissory={async (id) => { await supabase.from('ice_cream_promissory_notes').update({ status: 'paid' }).eq('id', id); await fetchData(); }}
                            onDeleteStockItem={async (id) => { if (can('MODULE_ADMIN_STOCK_DELETE') || can('MODULE_ADMIN')) { await supabase.from('ice_cream_stock').delete().eq('id', id); await fetchData(); } }}
                        />;
                        if (currentView === 'caixa' && can('MODULE_CASH_REGISTER')) return (
                            <CashRegisterModule
                                user={user!}
                                stores={isAdmin ? stores : stores.filter(s => s.id === user?.storeId)}
                                sales={iceCreamSales}
                                pixSales={pixSales}
                                closures={closures}
                                receipts={receipts}
                                errors={cashErrors}
                                can={can}
                                onAddClosure={async (c) => {
                                    await supabase.from('cash_register_closures').insert([{
                                        store_id: c.storeId || user?.storeId,
                                        closed_by: user?.name,
                                        total_sales: c.totalSales,
                                        total_expenses: c.totalExpenses,
                                        balance: c.balance,
                                        notes: c.notes,
                                        date: c.date
                                    }]);
                                    addLog('FECHAMENTO CAIXA', `Fechamento da loja ${c.storeId} no valor de ${c.balance}`);
                                    fetchData();
                                }}
                                onAddReceipt={async (r) => {
                                    const saved = await apiService.createReceipt({
                                        payer: r.payer,
                                        recipient: r.recipient,
                                        value: r.value,
                                        value_in_words: r.valueInWords,
                                        reference: r.reference,
                                        receipt_date: r.date
                                    });
                                    addLog('EMISSÃO RECIBO', `Recibo #${saved.formatted_number} para ${saved.recipient} no valor de ${saved.value}`);
                                    fetchData();
                                    return saved;
                                }}
                                onAddError={async (e) => {
                                    if (e && Object.keys(e).length > 0) {
                                        await supabase.from('cash_errors').insert([e]);
                                        addLog('REGISTRO QUEBRA', `${e.type === 'shortage' ? 'Falta' : 'Sobra'} de ${e.value} na loja ${e.store_id}`);
                                    }
                                    fetchData();
                                }}
                                onDeleteError={async (id) => {
                                    await supabase.from('cash_errors').delete().eq('id', id);
                                    addLog('EXCLUSÃO QUEBRA', `Remoção do registro de quebra ID: ${id}`);
                                    fetchData();
                                }}
                                onAddLog={addLog}
                            />
                        );
                        if (currentView === 'agenda' && can('MODULE_AGENDA')) return <AgendaSystem user={user!} tasks={agenda} onAddTask={async (t) => { await supabase.from('agenda_tasks').insert([{ user_id: user?.id, title: t.title, description: t.description, due_date: t.dueDate, due_time: t.dueTime, priority: t.priority, is_completed: false }]); fetchData(); }} onUpdateTask={async (t) => { await supabase.from('agenda_tasks').update({ is_completed: t.isCompleted }).eq('id', t.id); fetchData(); }} onDeleteTask={async (id) => { await supabase.from('agenda_tasks').delete().eq('id', id); fetchData(); }} />;
                        if (currentView === 'autoriz_compra' && can('MODULE_AUTORIZ_COMPRA')) return <PurchaseAuthorization />;
                        if (currentView === 'termo_condicional' && can('MODULE_TERMO_CONDICIONAL')) return <TermoAutorizacao user={user!} store={stores.find(s => s.id === user?.storeId)} />;
                        if (currentView === 'downloads' && can('MODULE_DOWNLOADS')) return <DownloadsModule user={user!} items={downloads} onUpload={async (i) => { await supabase.from('downloads').insert([i]); fetchData(); }} onDelete={async (id) => { await supabase.from('downloads').delete().eq('id', id); fetchData(); }} can={can} />;
                        if (currentView === 'users' && can('MODULE_ADMIN_USERS')) return <AdminUsersManagement currentUser={user} stores={stores} />;
                        if ((currentView === 'surveys' || currentView === 'admin_surveys') && can('MODULE_ADMIN_SURVEYS')) {
                            if (selectedSurveyForResults) {
                                return <SurveyResultsViewer survey={selectedSurveyForResults} currentUser={user!} stores={stores} onBack={() => setSelectedSurveyForResults(null)} />;
                            }
                            return <AdminSurveyManagement currentUser={user!} stores={stores} onShowResults={setSelectedSurveyForResults} />;
                        }
                        if (currentView === 'my_surveys') return <MySurveysComponent user={user!} />;
                        if (currentView === 'access' && can('MODULE_ACCESS_CONTROL')) return <AccessControlManagement />;
                        if (currentView === 'audit' && can('MODULE_AUDIT')) return <SystemAudit currentUser={user!} logs={logs} receipts={receipts} cashErrors={cashErrors} iceCreamSales={iceCreamSales} icPromissories={icPromissories} cardSales={cardSales} pixSales={pixSales} closures={closures} stores={isAdmin ? stores : stores.filter(s => s.id === user?.storeId)} can={can} />;
                        if (currentView === 'settings' && can('MODULE_SETTINGS')) return <AdminSettings stores={stores} onAddStore={async (s) => { await supabase.from('stores').insert([s]); fetchData(); }} onUpdateStore={async (s) => { const { id, ...updates } = s; await supabase.from('stores').update(updates).eq('id', id); fetchData(); }} onDeleteStore={async (id) => { await supabase.from('stores').delete().eq('id', id); fetchData(); }} />;
                        if ((currentView === 'os_demandas' || currentView === 'demands_v2') && can('MODULE_DEMANDS')) return (
                            <DemandsSystemV2 
                                user={user!} 
                                stores={stores} 
                                onUnreadUpdate={checkUnreadDemands}
                            />
                        );
                        if (currentView === 'dashboard_pa' && can('MODULE_DASHBOARD_PA')) return <DashboardPAModule
                            user={user!}
                            stores={stores}
                            onRefresh={fetchData}
                            can={can}
                        />;
                        if (currentView === 'dashboard_pa_manager' && can('MODULE_DASHBOARD_PA_MANAGER')) return <DashboardPAGerente
                            user={user!}
                            store={stores.find(s => s.id === user?.storeId)}
                        />;
                        if (currentView === 'buy_orders' && can('MODULE_BUY_ORDERS')) return <BuyOrderModule user={user} />;
                        return <div className="flex items-center justify-center h-full text-gray-400 uppercase tracking-widest font-black text-sm">Selecione um módulo no menu</div>;
                    })()}
                    </Suspense>
                    </ErrorBoundary>
                </main>
            </div>
            {isChangePasswordOpen && (
                <ChangePasswordModal user={user!} onClose={() => setIsChangePasswordOpen(false)} />
            )}

            <AnimatePresence>
                {showSurveyAlert && (
                    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="bg-white dark:bg-slate-900 rounded-[40px] p-8 max-w-md w-full shadow-2xl border border-slate-100 dark:border-slate-800 text-center"
                        >
                            <div className="w-20 h-20 bg-blue-50 dark:bg-blue-900/20 rounded-full flex items-center justify-center mx-auto mb-6 text-blue-600">
                                <ClipboardList size={40} />
                            </div>
                            <h3 className="text-2xl font-black italic uppercase tracking-tighter text-slate-900 dark:text-white mb-2">Pesquisa Pendente</h3>
                            <p className="text-slate-500 dark:text-slate-400 text-sm font-medium mb-8">
                                Identificamos que você possui pesquisas pendentes. Sua colaboração é muito importante para nós. Deseja responder agora?
                            </p>
                            <div className="flex flex-col gap-3">
                                <button
                                    onClick={() => {
                                        setShowSurveyAlert(false);
                                        setSelectedSurvey(pendingSurveys[0]);
                                        setIsSurveyModalOpen(true);
                                    }}
                                    className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-blue-700 shadow-lg shadow-blue-200 dark:shadow-none transition-all"
                                >
                                    Sim, responder agora
                                </button>
                                <button
                                    onClick={() => setShowSurveyAlert(false)}
                                    className="w-full py-4 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
                                >
                                    Depois
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {isSurveyModalOpen && selectedSurvey && (
                    <div className="fixed inset-0 z-[210] overflow-y-auto bg-white dark:bg-slate-950">
                        <Suspense fallback={<PageLoader />}>
                            {(() => {
                                const SurveyResponseForm = lazy(() => import('./components/Pesquisa/SurveyResponseForm'));
                                return (
                                    <SurveyResponseForm
                                        survey={selectedSurvey}
                                        user={user!}
                                        onClose={() => {
                                            setIsSurveyModalOpen(false);
                                            setSelectedSurvey(null);
                                        }}
                                        onComplete={() => {
                                            setIsSurveyModalOpen(false);
                                            setSelectedSurvey(null);
                                            fetchData();
                                        }}
                                    />
                                );
                            })()}
                        </Suspense>
                    </div>
                )}
            </AnimatePresence>
            <Toaster richColors position="top-center" />
        </div>
        </>
    );
};

const AppRouter: React.FC = () => {
    const pathParts = window.location.pathname.split('/');
    if (pathParts[1] === 'pesquisa' && pathParts[2]) {
        return <SurveyPublicPage token={pathParts[2]} />;
    }
    if (pathParts[1] === 'loja' && pathParts[2]) {
        return <StoreNfcPublicPage storeNumber={pathParts[2]} />;
    }
    if (pathParts[1] === 'nfc' && pathParts[2]) {
        return <StoreNfcPublicPage storeNumber={pathParts[2]} />;
    }
    return <App />;
};

export default AppRouter;