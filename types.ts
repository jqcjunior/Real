

/* =========================
   ROLES / USUÁRIOS
========================= */
export enum UserRole {
  ADMIN = 'ADMIN',
  MANAGER = 'MANAGER',
  CASHIER = 'CASHIER',
  ICE_CREAM = 'ICE_CREAM'
}

export interface User {
  id: string;
  name: string;
  role: UserRole;
  storeId?: string;
  email: string;
  password?: string;
  photo?: string;
}

/* =========================
   CATEGORIAS / COTAS
========================= */
export interface QuotaCategory {
  id: string;
  parent_category: string;
  category_name: string;
  is_active?: boolean;
  created_at?: string;
}

export interface QuotaMixParameter {
  id: string;
  category_name: string;
  percentage: number;
  semester?: 1 | 2;
  created_at?: string;
  store_id?: string;
  storeId?: string;
}

// Fixed: Added missing interface Cota
export interface Cota {
  id: string;
  storeId: string;
  brand: string;
  category_id: string;
  category_name?: string;
  classification?: string;
  totalValue: number;
  shipmentDate: string;
  paymentTerms: string;
  pairs: number;
  installments: any;
  status: string;
  createdByRole?: string;
  createdAt: Date;
}

// Fixed: Added missing interface CotaSettings
export interface CotaSettings {
  storeId: string;
  budgetValue: number;
  managerPercent: number;
}

// Fixed: Added missing interface CotaDebts
export interface CotaDebts {
  id?: string;
  storeId: string;
  month: string;
  value: number;
}

/* =========================
   ESTOQUE / SORVETERIA
========================= */
export interface IceCreamStock {
  id: string;
  stock_id: string; 
  store_id: string;
  product_base: string;
  stock_initial: number;
  stock_current: number;
  unit: string;
  is_active: boolean;
  created_at?: string;
}

export interface IceCreamRecipeItem {
  stock_base_name: string;
  quantity: number;
}

export interface IceCreamItem {
  id: string;
  storeId: string;
  name: string;
  category: IceCreamCategory;
  price: number;
  flavor?: string;
  active: boolean;
  consumptionPerSale: number;
  recipe?: IceCreamRecipeItem[];
  image_url?: string;
  created_at?: string;
}

export interface IceCreamDailySale {
  id: string;
  storeId: string;
  itemId: string;
  productName: string;
  category: string;
  flavor: string;
  unitsSold: number;
  unitPrice: number;
  totalValue: number;
  paymentMethod: IceCreamPaymentMethod;
  buyer_name?: string;
  createdAt?: string;
  saleCode?: string;
  status?: 'active' | 'canceled';
  cancel_reason?: string;
  canceled_by?: string;
  ml?: string;
}

export type IceCreamPaymentMethod =
  | 'Pix'
  | 'Cartão'
  | 'Dinheiro'
  | 'Fiado'
  | 'Misto';

export type IceCreamCategory =
  | 'Sundae'
  | 'Milkshake'
  | 'Casquinha'
  | 'Cascão'
  | 'Cascão Trufado'
  | 'Copinho'
  | 'Bebidas'
  | 'Adicionais';

// Fixed: Added missing interface IceCreamPromissoryNote
export interface IceCreamPromissoryNote {
  id: string;
  storeId: string;
  buyer_name: string;
  value: number;
  date: string;
  status: 'pending' | 'paid';
  createdAt: Date;
}

// Fixed: Added missing interface StoreProfitPartner
export interface StoreProfitPartner {
  id: string;
  store_id: string;
  partner_name: string;
  percentage: number;
  active: boolean;
  created_at?: string;
}

/* =========================
   TRANSAÇÕES
========================= */
export interface IceCreamTransaction {
  id: string;
  storeId: string;
  date: string;
  type: 'entry' | 'exit';
  category: string;
  value: number;
  description?: string;
  createdAt: Date;
}

/* =========================
   PERMISSÕES / LOJAS
========================= */
export interface PagePermission {
  id: string;
  page_key: string;
  label: string;
  module_group: string;
  allow_admin: boolean;
  allow_manager: boolean;
  allow_cashier: boolean;
  allow_sorvete: boolean;
  sort_order: number;
}

export interface Store {
  id: string;
  number: string;
  name: string;
  city: string;
  managerName: string;
  managerEmail: string;
  managerPhone: string;
  status?: 'active' | 'pending' | 'inactive';
  role?: UserRole;
  password?: string;
  passwordResetRequested?: boolean;
  has_gelateria?: boolean;
  state?: string;
}

/* =========================
   🔹 METAS MENSAIS
========================= */
export interface MonthlyGoal {
  id?: string;
  storeId: string;
  year: number;
  month: number;

  revenueTarget: number;
  itemsTarget: number;
  paTarget: number;
  puTarget: number;
  ticketTarget: number;
  delinquencyTarget: number;

  businessDays: number;
  trend: 'up' | 'stable' | 'down';
}

/* =========================
   🔹 PERFORMANCE ATUALIZADA (OPÇÃO A)
========================= */
export interface MonthlyPerformance {
  id?: string;
  storeId: string;
  month: string;

  // Realizado (Raw Data)
  revenueActual: number;
  itemsActual: number;
  salesActual: number; // Qtde Vendas
  delinquencyRate: number;

  // Calculados (Vêm da View)
  itemsPerTicket: number; // P.A.
  unitPriceAverage: number; // P.U.
  averageTicket: number; // Ticket Médio
  percentMeta: number;

  // Metas (Targets)
  revenueTarget: number;
  itemsTarget: number;
  paTarget: number;
  puTarget: number;
  ticketTarget: number;
  delinquencyTarget: number;

  trend: 'up' | 'down' | 'stable';
  businessDays: number;
}

/* =========================
   OUTROS
========================= */
export interface ProductPerformance {
  storeId: string;
  month: string;
  brand: string;
  category: string;
  pairsSold: number;
  revenue: number;
}

export interface CashRegisterClosure {
  id: string;
  storeId: string;
  closedBy: string;
  date: string;
  totalSales: number;
  totalExpenses: number;
  balance: number;
  notes?: string;
  createdAt: string;
}

export interface SystemLog {
  id?: string;
  created_at: string;
  userId: string;
  userName: string;
  userRole: UserRole;
  action: string;
  details: string;
}

export type TaskPriority = 'highest' | 'high' | 'medium' | 'low' | 'lowest';

export interface AgendaItem {
  id: string;
  userId: string;
  title: string;
  description: string;
  dueDate: string;
  dueTime: string;
  priority: TaskPriority;
  isCompleted: boolean;
  createdAt: Date;
}

export type DownloadCategory =
  | 'spreadsheet'
  | 'media'
  | 'video'
  | 'image'
  | 'audio'
  | 'other';

export interface DownloadItem {
  id: string;
  title: string;
  description: string | null;
  category: DownloadCategory;
  url: string;
  fileName: string | null;
  size: string | null;
  campaign: string | null;
  createdAt: Date;
  createdBy: string;
}

export interface CashError {
  id: string;
  storeId: string;
  userId: string;
  userName: string;
  date: string;
  type: 'surplus' | 'shortage';
  value: number;
  reason?: string;
  createdAt: Date;
}

export interface Receipt {
  id: string;
  storeId?: string;
  issuerName: string;
  payer: string;
  recipient: string;
  value: number;
  valueInWords: string;
  reference: string;
  date: string;
  createdAt: Date;
}

export interface CreditCardSale {
  id: string;
  storeId?: string;
  userId: string;
  date: string;
  brand: string;
  value: number;
  authorizationCode?: string;
}

export type AdminRoleLevel = 'admin' | 'manager' | 'cashier' | 'sorvete';

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  password?: string;
  status: 'active' | 'inactive';
  role_level: AdminRoleLevel;
  store_id: string | null;
  last_activity?: string;
}
