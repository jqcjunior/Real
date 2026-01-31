import React, { useState, useEffect } from 'react';
import {
  User, Store, MonthlyPerformance, UserRole, Cota, CotaSettings, CotaDebts,
  QuotaCategory, QuotaMixParameter, IceCreamItem, IceCreamDailySale,
  IceCreamTransaction, CashRegisterClosure, ProductPerformance, Receipt,
  IceCreamStock, IceCreamPromissoryNote, AgendaItem, DownloadItem, CashError, SystemLog
} from '../types';

import { supabase } from '../services/supabaseClient';
import { useAuthorization } from '../security/useAuthorization';
import { BRAND_LOGO } from '../constants';

/* MÓDULOS */
import DashboardAdmin from './DashboardAdmin';
import DashboardManager from './DashboardManager';
import GoalRegistration from './GoalRegistration';
import DashboardPurchases from './DashboardPurchases';
import { CotasManagement } from './CotasManagement';
import IceCreamModule from './IceCreamModule';
import CashErrorsModule from './CashErrorsModule';
import DownloadsModule from './DownloadsModule';
import PurchaseAuthorization from './PurchaseAuthorization';
import TermoAutorizacao from './TermoAutorizacao';

/* ÍCONES */
import {
  LayoutDashboard, Target, ShoppingBag, Calculator, IceCream as IceCreamIcon,
  DollarSign, AlertCircle, Calendar, Download, Settings, Users,
  ShieldAlert, LogOut, Loader2, FileSignature, FileText, ClipboardList,
  Shield, UserCog
} from 'lucide-react';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [currentView, setCurrentView] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const [stores, setStores] = useState<Store[]>([]);
  const [performanceData, setPerformanceData] = useState<MonthlyPerformance[]>([]);
  const [purchasingData, setPurchasingData] = useState<ProductPerformance[]>([]);
  const [cotas, setCotas] = useState<Cota[]>([]);
  const [cotaSettings, setCotaSettings] = useState<CotaSettings[]>([]);
  const [cotaDebts, setCotaDebts] = useState<CotaDebts[]>([]);
  const [quotaCategories, setQuotaCategories] = useState<QuotaCategory[]>([]);
  const [quotaMixParams, setQuotaMixParams] = useState<QuotaMixParameter[]>([]);
  const [iceCreamItems, setIceCreamItems] = useState<IceCreamItem[]>([]);
  const [iceCreamSales, setIceCreamSales] = useState<IceCreamDailySale[]>([]);
  const [iceCreamFinances, setIceCreamFinances] = useState<IceCreamTransaction[]>([]);
  const [iceCreamStock, setIceCreamStock] = useState<IceCreamStock[]>([]);
  const [icPromissories, setIcPromissories] = useState<IceCreamPromissoryNote[]>([]);
  const [downloads, setDownloads] = useState<DownloadItem[]>([]);
  const [cashErrors, setCashErrors] = useState<CashError[]>([]);

  const { can } = useAuthorization(user?.role);

  /* =========================
     LOAD DADOS
  ========================= */
  const fetchData = async () => {
    try {
      const [{ data: s }, { data: p }, { data: pur }] = await Promise.all([
        supabase.from('stores').select('*'),
        supabase.from('monthly_performance').select('*'),
        supabase.from('product_performance').select('*')
      ]);

      if (s) setStores(s);

      if (p) {
        setPerformanceData(
          p.map(x => ({
            ...x,
            storeId: x.store_id,
            revenueTarget: Number(x.revenue_target || 0),
            revenueActual: Number(x.revenue_actual || 0),
            paTarget: Number(x.pa_target || 0),
            ticketTarget: Number(x.ticket_target || 0),
            puTarget: Number(x.pu_target || 0),
            delinquencyTarget: Number(x.delinquency_target || 0),
            itemsTarget: Number(x.items_target || 0),
            itemsActual: Number(x.items_actual || 0),
            itemsPerTicket: Number(x.items_per_ticket || 0),
            unitPriceAverage: Number(x.unit_price_average || 0),
            averageTicket: Number(x.average_ticket || 0),
            delinquencyRate: Number(x.delinquency_rate || 0),
            businessDays: x.business_days,
            percentMeta: Number(x.percent_meta || 0)
          }))
        );
      }

      if (pur) {
        setPurchasingData(
          pur.map(x => ({
            ...x,
            storeId: x.store_id,
            pairsSold: x.pairs_sold
          }))
        );
      }
    } catch (err) {
      console.error('Erro ao carregar dados:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    setUser({
      id: '0',
      name: 'ADMINISTRADOR',
      role: UserRole.ADMIN,
      email: 'admin@real.com'
    });
  }, []);

  useEffect(() => {
    if (user && !currentView) {
      setCurrentView(user.role === UserRole.ADMIN ? 'dashboard_rede' : 'dashboard_loja');
    }
  }, [user, currentView]);

  if (isLoading || !currentView) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-950">
        <Loader2 className="animate-spin text-red-600" size={48} />
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-950">
      {/* MENU */}
      <aside className="w-72 bg-gray-950 p-8 text-white">
        <img src={BRAND_LOGO} className="w-12 mb-10" />
        <button onClick={() => setCurrentView('dashboard_rede')} className="menu-btn"><LayoutDashboard /> Dashboard Rede</button>
        <button onClick={() => setCurrentView('dashboard_loja')} className="menu-btn"><LayoutDashboard /> Dashboard Loja</button>
        <button onClick={() => setCurrentView('metas')} className="menu-btn"><Target /> Metas</button>
        <button onClick={() => setCurrentView('compras')} className="menu-btn"><ShoppingBag /> Compras</button>
        <button onClick={() => window.location.reload()} className="menu-btn text-red-500"><LogOut /> Sair</button>
      </aside>

      {/* CONTEÚDO */}
      <main className="flex-1 bg-gray-100 overflow-y-auto">
        {currentView === 'dashboard_rede' && (
          <DashboardAdmin
            stores={stores}
            performanceData={performanceData}
            onImportData={fetchData}
          />
        )}

        {currentView === 'dashboard_loja' && (
          <DashboardManager
            user={user!}
            stores={stores}
            performanceData={performanceData}
            purchasingData={purchasingData}
          />
        )}

        {currentView === 'metas' && (
          <GoalRegistration
            stores={stores}
            performanceData={performanceData}
            onUpdateData={async data => {
              for (const row of data) {
                await supabase.from('monthly_performance').upsert({
                  store_id: row.storeId,
                  month: row.month,
                  revenue_target: row.revenueTarget,
                  items_target: row.itemsTarget,
                  pa_target: row.paTarget,
                  ticket_target: row.ticketTarget,
                  pu_target: row.puTarget,
                  delinquency_target: row.delinquencyTarget,
                  business_days: row.businessDays,
                  trend: row.trend
                });
              }
              fetchData();
            }}
          />
        )}

        {currentView === 'compras' && (
          <DashboardPurchases
            user={user!}
            stores={stores}
            data={purchasingData}
            onImport={async d => {
              await supabase.from('product_performance').insert(
                d.map(x => ({
                  store_id: x.storeId,
                  month: x.month,
                  brand: x.brand,
                  category: x.category,
                  pairs_sold: x.pairsSold,
                  revenue: x.revenue
                }))
              );
              fetchData();
            }}
            onOpenSpreadsheetModule={() => {}}
          />
        )}
      </main>
    </div>
  );
};

export default App;
