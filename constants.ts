
import { MonthlyPerformance, Store, User, ProductPerformance, Cota, AgendaItem, DownloadItem, CashError } from './types';

export const APP_NAME = "REAL ADMIN";

/**
 * BRANDING DEFINITIVO
 * Configurações de identidade visual via repositório remoto conforme solicitado.
 */
export const BRAND_LOGO = "https://raw.githubusercontent.com/jqcjunior/Real/main/Real_PNG.png";

export const BRANDING = {
  logo: BRAND_LOGO,
  appName: "Real Admin"
};

// Mantido para compatibilidade de módulos legados
export const LOGO_URL = BRAND_LOGO; 

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
