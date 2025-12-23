
import { MonthlyPerformance, Store, User, ProductPerformance, Cota, AgendaItem, DownloadItem, CashError } from './types';

export const APP_NAME = "REAL ADMIN";

// URL do Logo Profissional (SVG para alta fidelidade)
export const LOGO_URL = "https://img.logoipsum.com/280.svg";

// Em produção, as listas iniciam vazias e são populadas via Supabase
export const MOCK_USERS: User[] = [];
export const MOCK_STORES: Store[] = [];
export const MOCK_PERFORMANCE: MonthlyPerformance[] = [];
export const MOCK_PRODUCT_PERFORMANCE: ProductPerformance[] = [];
export const MOCK_COTAS: Cota[] = [];
export const MOCK_AGENDA: AgendaItem[] = [];
export const MOCK_DOWNLOADS: DownloadItem[] = [];
export const MOCK_CASH_ERRORS: CashError[] = [];

export const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
};

export const formatPercent = (value: number) => {
  return new Intl.NumberFormat('pt-BR', { style: 'percent', minimumFractionDigits: 1 }).format((value || 0) / 100);
};

export const formatDecimal = (value: number) => {
  return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value || 0);
};
