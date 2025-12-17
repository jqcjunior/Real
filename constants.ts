import { MonthlyPerformance, Store, User, UserRole, ProductPerformance, Cota, AgendaItem, DownloadItem, CashError } from './types';

export const APP_NAME = "REAL CALÇADOS";

// Production Mode: Empty Initial Arrays
// Data must be loaded from Supabase

export const MOCK_USERS: User[] = [];

export const MOCK_STORES: Store[] = [];

export const MOCK_PERFORMANCE: MonthlyPerformance[] = [];

export const MOCK_PRODUCT_PERFORMANCE: ProductPerformance[] = [];

export const MOCK_COTAS: Cota[] = [];

export const MOCK_AGENDA: AgendaItem[] = [];

export const MOCK_DOWNLOADS: DownloadItem[] = [];

export const MOCK_CASH_ERRORS: CashError[] = [];

export const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

export const formatPercent = (value: number) => {
  return new Intl.NumberFormat('pt-BR', { style: 'percent', minimumFractionDigits: 1 }).format(value / 100);
};