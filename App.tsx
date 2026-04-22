import React, { useState, useEffect, lazy, Suspense } from 'react';
import {
    User, Store, MonthlyPerformance, UserRole, Cota, CotaSettings, CotaDebts, QuotaCategory, QuotaMixParameter,
    IceCreamItem, IceCreamDailySale, CashRegisterClosure, ProductPerformance, Receipt, IceCreamStock, IceCreamPromissoryNote, AgendaItem, DownloadItem, CashError, SystemLog, MonthlyGoal, CreditCardSale, PixSale,
    Sale, SalePayment, IceCreamSangria, IceCreamSangriaCategory,
    IceCreamStockMovement, StoreProfitPartner, AdminUser, PurchasingManagement, IceCreamFutureDebt,
    Survey
} from './types';
import { supabase } from './services/supabaseClient';
import apiService from './services/apiService';
import { ensureSession } from './services/authService';
import { BRAND_LOGO } from './constants';

// Módulos com Lazy Loading
const CotasManagement = lazy(() => import('./components/CotasManagement').then(m => ({ default: m.CotasManagement })));
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
const DashboardPurchases = lazy(() => import('./components/DashboardPurchases'));
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
const SpreadsheetOrderModule = lazy(() => import('./components/SpreadsheetOrderModule'));
const OSDemandsModule = lazy(() => import('./components/OSDemandsModule'));
const DemandsSystemV2 = lazy(() => import('./components/DemandsSystemV2'));
const DashboardPAModule = lazy(() => import('./components/dashboardPA/DashboardPAModule'));
const DashboardPAGerente = lazy(() => import('./components/dashboardPA/DashboardPAGerente'));
const AdminSurveyManagement = lazy(() => import('./components/AdminSurveyManagement_v3'));
const MySurveysComponent = lazy(() => import('./components/MySurveysComponent'));
const SurveyResultsViewer = lazy(() => import('./components/SurveyResultsViewer'));
// DRE Analytics imports removed as requested for cleanup
const DREAccounts = lazy(() => import('./modules/dre/components/DREAccountsResponsive'));

import LoginScreen from './components/LoginScreen';
import NotificationHeader from './components/NotificationHeader';
import ChangePasswordModal from './components/ChangePasswordModal';
import ErrorBoundary from './components/ErrorBoundary';

// Ícones
import {
    LayoutDashboard, Target, ShoppingBag, Calculator, IceCream as IceCreamIcon,
    DollarSign, AlertCircle, Calendar, LogOut, Loader2, Menu, X, ClipboardList, Shield, UserCog, Users, ShieldAlert, Settings, FileSignature, FileText, Download, Lock,
    Sun, Moon, Trophy, BarChart3, ArrowRight, TrendingUp
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Toaster } from 'sonner';

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
    const [user, setUser] = useState<User | null>(null);
    const isAdmin = user?.role === UserRole.ADMIN;
    const [currentView, setCurrentView] = useState<string>('welcome');
    const [isLoading, setIsLoading] = useState(true);
    const [permissionsLoaded, setPermissionsLoaded] = useState(false);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
    const [sessionWarning, setSessionWarning] = useState(false); // aviso de sessão prestes a expirar
    const [theme, setTheme] = useState<'light' | 'dark'>(() => {
        const saved = localStorage.getItem('theme');
        return (saved as 'light' | 'dark') || 'light';
    });

    // ─── SEGURANÇA: Sempre exige login — nunca restaura sessão salva ──────────
    useEffect(() => {
        if (window.innerWidth >= 1024) {
            setIsSidebarOpen(true);
        }

        const init = async () => {
            setIsLoading(true);
            try {
                await ensureSession();
                await bootstrapPermissions();
                await bootstrapParameters();

                // ✅ SEGURANÇA: O bloco de restauração automática de sessão foi
                // removido intencionalmente. O sistema NÃO restaura mais o usuário
                // salvo — isso garante que o login seja sempre exigido ao abrir o app.
                // Não chamamos apiService.logout() aqui pois isso causaria uma
                // condição de corrida: o init é assíncrono e demorado
                // (bootstrapPermissions faz ~24 chamadas ao banco), e o logout
                // poderia ser executado DEPOIS que o usuário já fez login, desfazendo-o.

            } catch (error) {
                console.error("Erro crítico na carga do sistema:", error);
            } finally {
                setIsLoading(false);
            }
        };

        init();
    }, []);

    // ─── SEGURANÇA: Auto-logout após 1 hora + aviso 5 min antes ──────────────
    useEffect(() => {
        if (!user) {
            setSessionWarning(false);
            return;
        }

        const HORA_EM_MS = 60 * 60 * 1000;        // 60 minutos
        const AVISO_EM_MS = 55 * 60 * 1000;        // 55 minutos (5 min antes)

        // Aviso aos 55 minutos
        const timerAviso = setTimeout(() => {
            setSessionWarning(true);
        }, AVISO_EM_MS);

        // Logout automático ao completar 1 hora
        const timerLogout = setTimeout(async () => {
            setSessionWarning(false);
            if (user) localStorage.removeItem(`realcalcados_lastView_${user.id}`);
            await apiService.logout();
            setUser(null);
            setCurrentView('welcome');
            window.location.reload();
        }, HORA_EM_MS);

        return () => {
            clearTimeout(timerAviso);
            clearTimeout(timerLogout);
        };
    }, [user]); // reinicia o contador sempre que o usuário muda (login/logout)
    // ─────────────────────────────────────────────────────────────────────────

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
                { key: 'MODULE_DASHBOARD_ADMIN', label: 'Dashboard Rede', group: 'Inteligência' },
                { key: 'MODULE_DASHBOARD_MANAGER', label: 'Dashboard Loja', group: 'Inteligência' },
                { key: 'MODULE_DASHBOARD_PA', label: 'Dashboard P.A.', group: 'Inteligência' },
                { key: 'MODULE_DASHBOARD_PA_MANAGER', label: 'Dashboard P.A. (Gerente)', group: 'Inteligência' },
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
                    .select('id, allow_admin')
                    .eq('page_key', p.key)
                    .maybeSingle();

                if (!existing) {
                    await supabase.from('page_permissions').insert([{
                        page_key: p.key,
                        label: p.label,
                        module_group: p.group,
                        allow_admin: true,
                        allow_manager: false,
                        allow_cashier: false,
                        allow_sorvete: p.key === 'MODULE_ICECREAM' || p.key === 'MODULE_AGENDA' || p.key === 'MODULE_DASHBOARD_MANAGER',
                        sort_order: 100
                    }]);
                } else if (!existing.allow_admin) {
                    await supabase.from('page_permissions')
                        .update({ allow_admin: true })
                        .eq('page_key', p.key);
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
    const [purchasingData, setPurchasingData] = useState<ProductPerformance[]>([]);
    const [cotas, setCotas] = useState<Cota[]>([]);
    const [cotaSettings, setCotaSettings] = useState<CotaSettings[]>([]);
    const [cotaDebts, setCotaDebts] = useState<CotaDebts[]>([]);
    const [quotaCategories, setQuotaCategories] = useState<QuotaCategory[]>([]);
    const [quotaMixParams, setQuotaMixParams] = useState<QuotaMixParameter[]>([]);
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
    const [purchasingManagement, setPurchasingManagement] = useState<PurchasingManagement[]>([]);
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
            else if (roleUpper === 'CASHIER' || roleUpper === 'CAIXA') columnToCheck = 'allow_cashier';
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

    const fetchData = async () => {
        try {
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
            const now = new Date();
            const today = now.toISOString().split('T')[0];
            const currentMonth = now.getMonth() + 1;
            const currentYear = now.getFullYear();
            const isEarlyMonth = now.getDate() <= 10;
            
            const userRole = user?.role?.toUpperCase() || '';
            const userStoreId = user?.storeId || '';
            
            // 🔒 CONSTRUIR FILTROS COM ISOLAMENTO POR LOJA
            let salesQuery = supabase.from('ice_cream_daily_sales').select('*');
            let salesHeadersQuery = supabase.from('ice_cream_sales').select('*');
            let cardSalesQuery = supabase.from('financial_card_sales').select('*');
            let pixSalesQuery = supabase.from('financial_pix_sales').select('*');
            let movementsQuery = supabase.from('ice_cream_stock_movements').select('*');
            let wastageQuery = supabase.from('ice_cream_wastage').select('*');
            
            if (userRole === 'ICE_CREAM' || userRole === 'SORVETE') {
                // SORVETE: HOJE + MÊS ATUAL (cancelamentos/avarias)
                const monthStart = `${currentYear}-${String(currentMonth).padStart(2, '0')}-01T00:00:00`;
                
                salesQuery = salesQuery
                    .eq('store_id', userStoreId)
                    .or(`and(created_at.gte.${today}T00:00:00,status.neq.canceled),and(created_at.gte.${monthStart},status.eq.canceled)`);
                
                salesHeadersQuery = salesHeadersQuery
                    .eq('store_id', userStoreId)
                    .gte('created_at', `${today}T00:00:00`);
                
                cardSalesQuery = cardSalesQuery
                    .eq('store_id', userStoreId)
                    .gte('created_at', `${today}T00:00:00`);
                
                pixSalesQuery = pixSalesQuery
                    .eq('store_id', userStoreId)
                    .gte('created_at', `${today}T00:00:00`);
                
                movementsQuery = movementsQuery
                    .eq('store_id', userStoreId)
                    .gte('created_at', monthStart);

                wastageQuery = wastageQuery
                    .eq('store_id', userStoreId)
                    .gte('created_at', monthStart);
                    
            } else if (userRole === 'MANAGER' || userRole === 'GERENTE') {
                // GERENTE: MÊS ATUAL + ANTERIOR (se dia ≤ 10)
                let startMonth = currentMonth;
                let startYear = currentYear;
                
                if (isEarlyMonth) {
                    if (currentMonth === 1) {
                        startMonth = 12;
                        startYear = currentYear - 1;
                    } else {
                        startMonth = currentMonth - 1;
                    }
                }
                
                const salesStart = `${startYear}-${String(startMonth).padStart(2, '0')}-01T00:00:00`;
                
                // Cancelamentos/avarias: 3 meses
                const threeMonthsAgo = new Date(now);
                threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
                const cancelStart = threeMonthsAgo.toISOString();
                
                salesQuery = salesQuery
                    .eq('store_id', userStoreId)
                    .or(`and(created_at.gte.${salesStart},status.neq.canceled),and(created_at.gte.${cancelStart},status.eq.canceled)`);
                
                salesHeadersQuery = salesHeadersQuery
                    .eq('store_id', userStoreId)
                    .gte('created_at', salesStart);
                
                cardSalesQuery = cardSalesQuery
                    .eq('store_id', userStoreId)
                    .gte('created_at', salesStart);
                
                pixSalesQuery = pixSalesQuery
                    .eq('store_id', userStoreId)
                    .gte('created_at', salesStart);
                
                movementsQuery = movementsQuery
                    .eq('store_id', userStoreId)
                    .gte('created_at', cancelStart);

                wastageQuery = wastageQuery
                    .eq('store_id', userStoreId)
                    .gte('created_at', cancelStart);
                    
            } else {
                // ADMIN: 90 DIAS vendas, 6 MESES cancelamentos (TODAS as lojas)
                const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString();
                const sixMonthsAgo = new Date(now);
                sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
                const cancelStart = sixMonthsAgo.toISOString();
                
                salesQuery = salesQuery
                    .or(`and(created_at.gte.${ninetyDaysAgo},status.neq.canceled),and(created_at.gte.${cancelStart},status.eq.canceled)`);
                
                salesHeadersQuery = salesHeadersQuery.gte('created_at', ninetyDaysAgo);
                cardSalesQuery = cardSalesQuery.gte('created_at', ninetyDaysAgo);
                pixSalesQuery = pixSalesQuery.gte('created_at', ninetyDaysAgo);
                movementsQuery = movementsQuery.gte('created_at', cancelStart);
                wastageQuery = wastageQuery.gte('created_at', cancelStart);
            }
 
            const [
                {data: pur}, {data: c}, {data: cs}, {data: cd}, {data: cat}, {data: mix},
                {data: ici}, {data: ics}, {data: icst}, {data: icp}, {data: r}, {data: ce}, {data: ag}, {data: dl}, {data: cl}, {data: lg},
                {data: cds}, {data: pxs}, {data: sls}, {data: slsp},
                {data: sangCat}, {data: sang}, {data: movements}, {data: part}, {data: ausers},
                {data: pm}, {data: fd}, {data: wst}
            ] = await Promise.all([
                supabase.from('product_performance').select('*'),
                supabase.from('cotas_with_category').select('*'),
                supabase.from('cota_settings').select('*'),
                supabase.from('cota_debts').select('*'),
                supabase.from('quota_product_categories').select('*'),
                supabase.from('quota_mix_parameters').select('*'),
                supabase.from('ice_cream_items').select('*'),
                salesQuery.order('created_at', { ascending: false }),
                supabase.from('ice_cream_stock').select('*'),
                supabase.from('ice_cream_promissory_notes').select('*'),
                supabase.from('financial_receipts').select('*').order('created_at', { ascending: true }),
                supabase.from('cash_errors').select('*').order('created_at', { ascending: false }),
                supabase.from('agenda_tasks').select('*').order('due_time', { ascending: true }),
                supabase.from('downloads').select('*'),
                supabase.from('cash_register_closures').select('*'),
                supabase.from('system_logs').select('*').order('created_at', { ascending: false }).limit(200),
                cardSalesQuery.order('created_at', { ascending: false }),
                pixSalesQuery.order('created_at', { ascending: false }),
                salesHeadersQuery.order('created_at', { ascending: false }),
                supabase.from('ice_cream_daily_sales_payments').select('*').order('created_at', { ascending: false }).limit(2000),
                supabase.from('ice_cream_sangria_categoria').select('*'),
                supabase.from('ice_cream_sangria').select('*').order('created_at', { ascending: false }).limit(500),
                movementsQuery.order('created_at', { ascending: false }),
                supabase.from('store_profit_distribution').select('*'),
                supabase.from('admin_users').select('*'),
                supabase.from('gestao_compras').select('*'),
                supabase.from('ice_cream_future_debts').select('*').order('due_date', { ascending: true }),
                wastageQuery.order('created_at', { ascending: false })
            ]);
 
            if(wst) setIcWastage(wst);
            if(fd) setFutureDebts(fd);
            if(sls) setSales(sls);
            if(slsp) setSalePayments(slsp.map(x => ({ ...x, amount: Number(x.amount || 0) })));
            if(pur) setPurchasingData(pur.map(x => ({...x, storeId: x.store_id, pairsSold: x.pairs_sold})));
            if(c) setCotas(c.map(x => ({ ...x, id: x.id, storeId: x.store_id, totalValue: Number(x.total_value || 0), shipmentDate: x.shipment_date, paymentTerms: x.payment_terms, createdByRole: x.created_by_role, category_id: x.category_id, category_name: x.category_name || x.classification, createdAt: new Date(x.created_at) })));
            if(cs) setCotaSettings(cs.map(x => ({
                storeId: x.store_id,
                budgetValue: Number(x.budget_value || 0),
                managerPercent: Number(x.manager_percent || 0)
            })));
            if(cd) setCotaDebts(cd.map(x => ({...x, storeId: x.store_id})));
            if(cat) setQuotaCategories(cat);
            if(mix) setQuotaMixParams(mix.map(x => ({ ...x, storeId: x.store_id, category_name: x.parent_category, percentage: Number(x.mix_percentage || 0) })));
            if(ici) setIceCreamItems(ici.map(x => ({ id: x.id, storeId: x.store_id, name: x.name, category: x.category, price: Number(x.price || 0), flavor: x.flavor, active: x.active, consumption_per_sale: x.consumption_per_sale || 0, recipe: typeof x.recipe === 'string' ? JSON.parse(x.recipe) : (x.recipe || []), image_url: x.image_url })));
            if(ics) setIceCreamSales(ics.map(x => ({ id: x.id, storeId: x.store_id, itemId: x.item_id, productName: x.product_name, category: x.category, flavor: x.flavor, unitsSold: Number(x.units_sold || 0), unitPrice: Number(x.unit_price || 0), totalValue: Number(x.total_value || 0), paymentMethod: x.payment_method, saleCode: x.sale_code, buyer_name: x.buyer_name, createdAt: x.created_at, status: x.status, cancel_reason: x.cancel_reason, canceled_by: x.canceled_by })));
            if(cds) setCardSales(cds.map(x => ({ id: x.id, storeId: x.store_id, userId: x.user_id, userName: x.user_name, date: x.date, brand: x.brand, value: Number(x.value || 0), authorizationCode: x.authorization_code, saleCode: x.sale_code, createdAt: x.created_at })));
            if(pxs) setPixSales(pxs.map(x => ({ id: x.id, storeId: x.store_id, userId: x.user_id, userName: x.user_name, date: x.date, saleCode: x.sale_code, value: Number(x.value || 0), clientName: x.payer_name, createdAt: x.created_at })));
            if(icst) setIceCreamStock(icst.map(item => ({ ...item, stock_id: item.id })));
            if(icp) setIcPromissories(icp);
            if(r) setReceipts(r.map(x => ({ id: x.id, storeId: x.store_id, issuerName: x.issuer_name, payer: x.payer, recipient: x.recipient, value: Number(x.value || 0), valueInWords: x.value_in_words, date: x.receipt_date, reference: x.reference, createdAt: new Date(x.created_at) })));
            if(ce) setCashErrors(ce.map(x => ({...x, id: x.id, storeId: x.store_id, userId: x.user_id, userName: x.user_name || 'Usuário', date: x.error_date || x.date, value: Number(x.value || 0), type: x.type, reason: x.reason, createdAt: new Date(x.created_at)})));
            if(ag) setAgenda(ag.map(x => ({...x, userId: x.user_id, title: x.title, description: x.description, dueDate: x.due_date ? x.due_date.split('T')[0] : '', dueTime: x.due_time, priority: x.priority, isCompleted: x.is_completed})));
            if(dl) setDownloads(dl.map(x => ({...x, fileName: x.file_name, createdBy: x.created_by})));
            if(cl) setClosures(cl.map(x => ({...x, storeId: x.store_id, closedBy: x.closed_by})));
            if(lg) setLogs(lg.map((x: any) => ({
                id: x.id,
                userId: x.user_id,
                userName: x.user_name,
                userRole: x.user_role as UserRole,
                action: x.action,
                details: x.details,
                created_at: x.created_at
            })));
            if(sangCat) setIcSangriaCategories(sangCat);
            if(sang) setIcSangrias(sang);
            if(movements) setIcStockMovements(movements);
            if(part) setPartners(part);
            if(ausers) setAdminUsers(ausers);

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
                    const pending = activeSurveys.filter(s => !respondedIds.includes(s.id));
                    setPendingSurveys(pending);
                }
            }

            if(pm) setPurchasingManagement(pm.map(x => ({
                id: x.id,
                storeId: x.store_id,
                brand: x.brand,
                productType: x.product_type,
                stockQty: Number(x.stock_qty || 0),
                buyQty: Number(x.buy_qty || 0),
                sellQty: Number(x.sell_qty || 0),
                sellPrice: Number(x.sell_price || 0),
                lastBuyDate: x.last_buy_date,
                year: Number(x.year || 0),
                month: Number(x.month || 0),
                updatedAt: x.updated_at
            })));
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
            .on('postgres_changes', { event: '*', schema: 'public', table: 'gestao_compras' }, () => fetchData())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'monthly_performance_actual' }, () => fetchData())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'monthly_goals' }, () => fetchData())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'stores' }, () => fetchData())
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, []);

    const WelcomeScreen = () => {
        const userName = user?.name?.split(' ')[0] || 'Usuário';
        const userRole = user?.role || UserRole.CASHIER;

        const getQuickAccessButtons = () => {
            const buttons = [];

            if (userRole === UserRole.ADMIN) {
                buttons.push(
                    { key: 'dashboard_rede', label: 'Dashboard Rede', icon: '📊', color: 'from-blue-500 to-blue-600' },
                    { key: 'users', label: 'Usuários', icon: '👥', color: 'from-purple-500 to-purple-600' },
                    { key: 'compras', label: 'Compras', icon: '🛒', color: 'from-green-500 to-green-600' },
                    { key: 'surveys', label: 'Pesquisas', icon: '📋', color: 'from-orange-500 to-orange-600' }
                );
            } else if (userRole === UserRole.MANAGER) {
                buttons.push(
                    { key: 'dashboard_loja', label: 'Dashboard', icon: '📊', color: 'from-blue-500 to-blue-600' },
                    { key: 'dashboard_pa_manager', label: 'Dashboard PA', icon: '📈', color: 'from-purple-500 to-purple-600' },
                    { key: 'caixa', label: 'Caixa', icon: '💰', color: 'from-green-500 to-green-600' },
                    { key: 'my_surveys', label: 'Pesquisas', icon: '📝', color: 'from-orange-500 to-orange-600' }
                );
            } else if (userRole === UserRole.CASHIER) {
                buttons.push(
                    { key: 'caixa', label: 'Caixa', icon: '💰', color: 'from-green-500 to-green-600' },
                    { key: 'agenda', label: 'Agenda', icon: '📅', color: 'from-purple-500 to-purple-600' },
                    { key: 'dashboard_loja', label: 'Dashboard', icon: '📊', color: 'from-blue-500 to-blue-600' },
                    { key: 'my_surveys', label: 'Pesquisas', icon: '📝', color: 'from-orange-500 to-orange-600' }
                );
            } else if (userRole === UserRole.ICE_CREAM) {
                buttons.push(
                    { key: 'pdv_sorveteria', label: 'Gelateria', icon: '🍦', color: 'from-pink-500 to-pink-600' },
                    { key: 'agenda', label: 'Agenda', icon: '📅', color: 'from-purple-500 to-purple-600' },
                    { key: 'dashboard_loja', label: 'Dashboard', icon: '📊', color: 'from-blue-500 to-blue-600' },
                    { key: 'my_surveys', label: 'Pesquisas', icon: '📝', color: 'from-orange-500 to-orange-600' }
                );
            }

            return buttons;
        };

        const quickAccess = getQuickAccessButtons();

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

                {quickAccess.length > 0 && (
                    <div className="mb-12 animate-fade-in-up flex flex-col items-center px-4">
                        <p className="text-sm text-gray-500 mb-6 text-center font-medium uppercase tracking-widest">ACESSO RÁPIDO</p>
                        <div className="grid grid-cols-2 md:flex md:gap-6 gap-4 justify-center items-center max-w-4xl">
                            {quickAccess.map((item, index) => (
                                <button
                                    key={item.key}
                                    onClick={() => setCurrentView(item.key)}
                                    className={`
                                        group relative flex flex-col items-center justify-center gap-3
                                        p-6 md:p-8
                                        bg-gradient-to-br ${item.color}
                                        rounded-2xl shadow-lg hover:shadow-2xl
                                        transition-all duration-300 hover:scale-105
                                        border-2 border-white/20
                                        min-w-[120px] md:min-w-[140px] max-w-[180px]
                                    `}
                                    style={{ animationDelay: `${index * 100}ms` }}
                                >
                                    <span className="text-4xl md:text-5xl filter drop-shadow-lg group-hover:scale-110 transition-transform duration-300">
                                        {item.icon}
                                    </span>
                                    <span className="text-xs md:text-sm font-bold text-white text-center leading-tight">
                                        {item.label}
                                    </span>
                                    <div className="absolute inset-0 bg-white/0 group-hover:bg-white/10 rounded-2xl transition-colors duration-300"></div>
                                </button>
                            ))}
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

            const rawRole = (result.user.role || '').toUpperCase().trim();

            let mappedRole: UserRole = UserRole.CASHIER;
            if (rawRole === 'ADMIN') mappedRole = UserRole.ADMIN;
            else if (rawRole === 'MANAGER' || rawRole === 'GERENTE') mappedRole = UserRole.MANAGER;
            else if (rawRole === 'CAIXA' || rawRole === 'CASHIER') mappedRole = UserRole.CASHIER;
            else if (rawRole === 'SORVETE' || rawRole === 'SORVETERIA' || rawRole === 'ICE_CREAM') mappedRole = UserRole.ICE_CREAM;

            const loggedUser: User = {
                id: result.user.id,
                name: result.user.name,
                role: mappedRole,
                email: result.user.email,
                storeId: result.user.storeId
            };

            setUser(loggedUser);
            await fetchPermissions(mappedRole, loggedUser.name);

            // ✅ CORREÇÃO: fetchData() roda em background sem bloquear a navegação.
            // NÃO use "await fetchData()" aqui seguido de setCurrentView('welcome'),
            // pois isso resetaria a tela mesmo que o usuário já tivesse navegado
            // para outro módulo durante o carregamento dos dados.
            fetchData(); // sem await — deixa rodar em background

            return { success: true, user: loggedUser };
        } catch (err: any) {
            return { success: false, error: err.message || 'Falha na conexão.' };
        }
    };

    const handleLogout = async () => {
        if (user) {
            localStorage.removeItem(`realcalcados_lastView_${user.id}`);
        }
        await apiService.logout();
        setUser(null);
        setCurrentView('welcome');
        window.location.reload();
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
                    <div className="flex items-center gap-4">
                        <img src={BRAND_LOGO} alt="Logo" referrerPolicy="no-referrer" className="h-10 w-auto object-contain dark:brightness-125" />
                        <h1 className="text-xl font-black italic uppercase text-slate-900 dark:text-white">ADMIN</h1>
                    </div>
                    <button onClick={() => setIsSidebarOpen(false)} className="p-2 text-slate-400 hover:text-slate-900 dark:hover:text-white">
                        <X size={24} />
                    </button>
                </div>
                <nav className="flex-1 space-y-6 overflow-y-auto no-scrollbar">
                    {[
                        { title: 'Inteligência', items: [
                            { id: 'dashboard_rede', label: 'Dashboard Rede', icon: LayoutDashboard, perm: 'MODULE_DASHBOARD_ADMIN', roles: ['admin'] },
                            { id: 'dashboard_loja', label: 'Dashboard Loja', icon: LayoutDashboard, perm: 'MODULE_DASHBOARD_MANAGER', roles: ['manager'] },
                            { id: 'dashboard_pa', label: 'Dashboard P.A.', icon: Trophy, perm: 'MODULE_DASHBOARD_PA', roles: ['admin'] },
                            { id: 'dashboard_pa_manager', label: 'Dashboard P.A.', icon: Trophy, perm: 'MODULE_DASHBOARD_PA_MANAGER', roles: ['manager'] },
                            { id: 'dre_accounts', label: 'Plano de Contas DRE', icon: ClipboardList, perm: 'MODULE_DRE_ACCOUNTS', roles: ['admin'] },
                            { id: 'metas', label: 'Metas', icon: Target, perm: 'MODULE_METAS', roles: ['admin'] },
                            { id: 'cotas', label: 'Cotas OTB', icon: Calculator, perm: 'MODULE_COTAS', roles: ['admin'] },
                            { id: 'compras', label: 'Compras', icon: ShoppingBag, perm: 'MODULE_PURCHASES', roles: ['admin'] },
                            { id: 'os_demandas', label: 'Chamado', icon: ClipboardList, perm: 'MODULE_DEMANDS', roles: ['admin'] }
                        ] },
                        { title: 'Operacional', items: [
                            { id: 'pdv_sorveteria', label: 'Sorveteria Real', icon: IceCreamIcon, perm: 'MODULE_ICECREAM', roles: ['admin', 'manager', 'sorvete'] },
                            { id: 'caixa', label: 'Caixa', icon: ClipboardList, perm: 'MODULE_CASH_REGISTER', roles: ['admin', 'manager', 'cashier'] },
                            { id: 'agenda', label: 'Agenda Semanal', icon: Calendar, perm: 'MODULE_AGENDA', roles: ['admin', 'manager'] },
                            { id: 'my_surveys', label: 'Minhas Pesquisas', icon: ClipboardList, perm: 'ALWAYS', roles: ['admin', 'manager'] }
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
                            const userRole = String(user?.role || '').toLowerCase();
                            const hasRole = (i as any).roles ? (i as any).roles.includes(userRole) : true;
                            return hasRole && can(i.perm);
                        });
                        if (visibleItems.length === 0) return null;
                        return (
                            <div key={section.title} className="space-y-1">
                                <h3 className="px-4 text-[10px] font-black uppercase text-slate-400 dark:text-slate-400 tracking-widest mb-2">{section.title}</h3>
                                {visibleItems.map(item => (
                                    <button
                                        key={item.id}
                                        onClick={() => { setCurrentView(item.id); setIsSidebarOpen(false); }}
                                        className={`w-full text-left py-2.5 px-4 rounded-xl font-black uppercase text-[10px] flex items-center gap-4 transition-all ${
                                            currentView === item.id
                                                ? 'bg-blue-600 text-white shadow-lg shadow-blue-200 dark:shadow-blue-900/20'
                                                : 'text-slate-500 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800'
                                        }`}
                                    >
                                        <item.icon size={20} /> {item.label}
                                    </button>
                                ))}
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
                        if (currentView === 'dashboard_rede' && can('MODULE_DASHBOARD_ADMIN')) return <DashboardAdmin stores={stores} performanceData={performanceData} goalsData={goalsData} sangrias={icSangrias} initialWeightRevenue={goalsRankingParams?.weight_revenue ?? 70} initialWeightPA={goalsRankingParams?.weight_pa ?? 30} onSaveWeights={async (wRev, wPA) => {
                            const payload = {
                                weight_revenue: wRev,
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
                            const { error } = await supabase.from('monthly_performance_actual').upsert(upsertData, { onConflict: 'store_id, month' });
                            if (error) {
                                console.error("Erro ao salvar monthly_performance_actual:", error);
                                alert("Erro ao salvar dados no banco: " + error.message);
                            } else {
                                fetchData();
                            }
                        }} />;
                        if (currentView === 'dashboard_loja' && can('MODULE_DASHBOARD_MANAGER')) return <DashboardManager user={user!} stores={stores} performanceData={performanceData} goalsData={goalsData} purchasingData={purchasingData} sangrias={icSangrias} stockMovements={icStockMovements} stock={iceCreamStock} weightRevenue={goalsRankingParams?.weight_revenue ?? 70} weightPA={goalsRankingParams?.weight_pa ?? 30} />;
                        if (currentView === 'metas' && can('MODULE_METAS')) return <GoalRegistration user={user!} stores={isAdmin ? stores : stores.filter(s => s.id === user?.storeId)} goalsData={goalsData} onRefresh={fetchData} onSaveGoals={async (data) => { for(const row of data) { await supabase.from('monthly_goals').upsert({ store_id: row.storeId, year: row.year, month: row.month, revenue_target: row.revenueTarget, pa_target: row.paTarget, pu_target: row.puTarget, ticket_target: row.ticketTarget, items_target: row.itemsTarget, business_days: row.businessDays, delinquency_target: row.delinquencyTarget, trend: row.trend }, { onConflict: 'store_id, year, month' }); } fetchData(); }} />;
                        if (currentView === 'cotas' && can('MODULE_COTAS')) return <CotasManagement user={user!} stores={isAdmin ? stores : stores.filter(s => s.id === user?.storeId)} cotas={cotas} cotaSettings={cotaSettings} cotaDebts={cotaDebts} performanceData={performanceData} productCategories={quotaCategories} mixParameters={quotaMixParams} onAddCota={async (c) => { await supabase.from('cotas').insert([{ store_id: c.storeId, brand: c.brand, category_id: c.category_id, total_value: c.totalValue, shipment_date: `${c.shipmentDate}-01`, payment_terms: c.paymentTerms, pairs: c.pairs, installments: c.installments, status: 'ABERTA' }]); fetchData(); }} onUpdateCota={async (id, u) => { await supabase.from('cotas').update(u).eq('id', id); fetchData(); }} onDeleteCota={async (id) => { await supabase.from('cotas').delete().eq('id', id); fetchData(); }} onSaveSettings={async (s) => { await supabase.from('cota_settings').upsert({ store_id: s.storeId, budget_value: s.budgetValue, manager_percent: s.managerPercent }, { onConflict: 'store_id' }); fetchData(); }} onSaveDebts={async (d) => { await supabase.from('cota_debts').upsert({ store_id: d.storeId, month: d.month, value: d.value }, { onConflict: 'store_id, month' }); fetchData(); }} onDeleteDebt={async (id) => { await supabase.from('cota_debts').delete().eq('id', id); fetchData(); }} onUpdateMixParameter={async (id, sId, cat, pct, sem) => { if (id) { await supabase.from('quota_mix_parameters').update({ mix_percentage: pct }).eq('id', id); } else { await supabase.from('quota_mix_parameters').insert([{ store_id: sId, parent_category: cat, mix_percentage: pct, semester: sem }]); } fetchData(); }} can={can} />;
                        if (currentView === 'compras' && can('MODULE_PURCHASES')) return <DashboardPurchases
                            user={user!}
                            stores={stores}
                            data={purchasingData}
                            managementData={purchasingManagement}
                            adminUsers={adminUsers}
                            onImport={async (d) => { await supabase.from('product_performance').insert(d.map(x => ({ store_id: x.storeId, month: x.month, brand: x.brand, category: x.category, pairs_sold: x.pairsSold, revenue: x.revenue }))); fetchData(); }}
                            onImportManagement={async (d, shouldFetch = true) => {
                                const { error } = await supabase.from('gestao_compras').upsert(d.map(x => ({
                                    store_id: x.storeId,
                                    brand: x.brand,
                                    product_type: x.productType,
                                    stock_qty: x.stockQty,
                                    buy_qty: x.buyQty,
                                    sell_qty: x.sellQty,
                                    sell_price: x.sellPrice,
                                    last_buy_date: x.lastBuyDate,
                                    year: x.year,
                                    month: x.month
                                })), { onConflict: 'store_id, brand, product_type, year, month' });
                                if (error) {
                                    console.error("Erro Supabase (gestao_compras):", error);
                                    throw error;
                                }
                                if (shouldFetch) fetchData();
                            }}
                            onOpenSpreadsheetModule={() => setCurrentView('spreadsheet_order')}
                            can={can}
                        />;
                        if (currentView === 'dre_accounts' && can('MODULE_DRE_ACCOUNTS')) return <DREAccounts />;
                        if (currentView === 'pdv_sorveteria' && can('MODULE_ICECREAM')) return <IceCreamModule
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
                            onUpdateStock={async (sId, b, v, u, type) => {
                                const { data: current } = await supabase.from('ice_cream_stock').select('stock_current').eq('store_id', sId).eq('product_base', b).maybeSingle();
                                let finalVal = v;
                                if (current && (type === 'purchase' || type === 'adjustment' || type === 'production')) { finalVal = Number(current.stock_current || 0) + v; }
                                await supabase.from('ice_cream_stock').upsert({ store_id: sId, product_base: b, stock_current: finalVal, unit: u, is_active: true }, { onConflict: 'store_id, product_base' });
                                await fetchData();
                            }}
                            liquidatePromissory={async (id) => { await supabase.from('ice_cream_promissory_notes').update({ status: 'paid' }).eq('id', id); await fetchData(); }}
                            onDeleteStockItem={async (id) => { if (can('MODULE_ADMIN_STOCK_DELETE')) { await supabase.from('ice_cream_stock').update({ is_active: false }).eq('id', id); await fetchData(); } }}
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
                        if (currentView === 'surveys' && can('MODULE_ADMIN_SURVEYS')) {
                            if (selectedSurveyForResults) {
                                return <SurveyResultsViewer survey={selectedSurveyForResults} currentUser={user!} stores={stores} onBack={() => setSelectedSurveyForResults(null)} />;
                            }
                            return <AdminSurveyManagement currentUser={user!} stores={stores} />;
                        }
                        if (currentView === 'my_surveys') return <MySurveysComponent user={user!} />;
                        if (currentView === 'access' && can('MODULE_ACCESS_CONTROL')) return <AccessControlManagement />;
                        if (currentView === 'audit' && can('MODULE_AUDIT')) return <SystemAudit currentUser={user!} logs={logs} receipts={receipts} cashErrors={cashErrors} iceCreamSales={iceCreamSales} icPromissories={icPromissories} cardSales={cardSales} pixSales={pixSales} closures={closures} stores={isAdmin ? stores : stores.filter(s => s.id === user?.storeId)} can={can} />;
                        if (currentView === 'settings' && can('MODULE_SETTINGS')) return <AdminSettings stores={stores} onAddStore={async (s) => { await supabase.from('stores').insert([s]); fetchData(); }} onUpdateStore={async (s) => { await supabase.from('stores').update(s).eq('id', s.id); fetchData(); }} onDeleteStore={async (id) => { await supabase.from('stores').delete().eq('id', id); fetchData(); }} />;
                        if (currentView === 'spreadsheet_order' && can('MODULE_PURCHASES')) return <SpreadsheetOrderModule user={user!} onClose={() => setCurrentView('compras')} />;
                        if (currentView === 'os_demandas' && can('MODULE_DEMANDS')) return <DemandsSystemV2 user={user!} stores={stores} />;
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
                                const SurveyResponseForm = lazy(() => import('./components/SurveyResponseForm'));
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

export default App;