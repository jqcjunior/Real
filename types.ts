
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

export interface CotaSettings {
  storeId: string;
  budgetValue: number;
  managerPercent: number;
}

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
  consumptionPerSale?: number;
  consumption_per_sale?: number;
  recipe?: IceCreamRecipeItem[];
  image_url?: string;
  created_at?: string;
}

export interface IceCreamStockMovement {
  id: string;
  stock_id: string;
  store_id: string;
  user_id: string;
  quantity: number;
  movement_type: string;
  reason: string;
  created_at: string;
}

export interface IceCreamSangriaCategory {
  id: string;
  store_id: string;
  name: string;
  is_active: boolean;
  created_at: string;
}

export interface IceCreamSangria {
  id: string;
  store_id: string;
  user_id: string;
  category_id: string;
  amount: number;
  description: string;
  transaction_date?: string;
  notes?: string;
  metadata?: any;
  created_at: string;
}

export interface IceCreamDailySale {
  id: string;
  sale_id?: string;
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
  status?: 'active' | 'canceled' | 'completed';
  cancel_reason?: string;
  canceled_by?: string;
  ml?: string;
}

export interface Sale {
  id: string;
  store_id: string;
  total_value: number;
  total_amount?: number;
  status: 'active' | 'canceled' | 'completed';
  canceled_by_name?: string;
  cancel_reason?: string;
  created_at: string;
  sale_code: string;
  buyer_name?: string;
}

export type IceCreamSale = Sale;

export interface SalePayment {
  id: string;
  sale_id: string;
  store_id: string;
  payment_method: IceCreamPaymentMethod;
  amount: number;
  created_at: string;
  sale_code?: string;
  status?: string;
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

export interface IceCreamPromissoryNote {
  id: string;
  storeId: string;
  buyer_name: string;
  value: number;
  date: string;
  status: 'pending' | 'paid';
  createdAt: Date;
}

export interface IceCreamFutureDebt {
  id: string;
  store_id: string;
  supplier_name: string;
  total_amount: number;
  installment_number: number;
  total_installments: number;
  installment_amount: number;
  due_date: string;
  payment_date?: string;
  status: 'pending' | 'paid' | 'overdue';
  category_id?: string;
  description?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface DREMethodSummary {
  pix: number;
  money: number;
  card: number;
  fiado: number;
}

export interface DREMethodCount {
  pix: number;
  money: number;
  card: number;
  fiado: number;
}

export interface SaleDetailItem {
  productName: string;
  quantity: number;
  totalValue: number;
}

export interface StoreProfitPartner {
  id: string;
  store_id: string;
  partner_name: string;
  percentage: number;
  active: boolean;
  created_at?: string;
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
   🔹 PERFORMANCE ATUALIZADA
========================= */
export interface MonthlyPerformance {
  id?: string;
  storeId: string;
  month: string;

  revenueActual: number;
  itemsActual: number;
  salesActual: number;
  delinquencyRate: number;

  itemsPerTicket: number;
  unitPriceAverage: number;
  averageTicket: number;
  percentMeta: number;

  revenueTarget: number;
  itemsTarget: number;
  paTarget: number;
  puTarget: number;
  ticketTarget: number;
  delinquencyTarget: number;

  trend: 'up' | 'down' | 'stable';
  businessDays: number;
}

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

export type DownloadCategory = 'spreadsheet' | 'media' | 'video' | 'image' | 'audio' | 'other';

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
  receiptNumber?: number;
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
  storeId: string;
  userId: string;
  userName: string;
  date: string;
  brand: string;
  value: number;
  authorizationCode?: string;
  saleCode: string;
  createdAt?: string;
}

export interface PixSale {
  id: string;
  storeId: string;
  userId: string;
  userName: string;
  date: string;
  saleCode: string; // Número da Ficha
  value: number;
  clientName: string;
  createdAt?: string;
}

export type AdminRoleLevel = 'admin' | 'manager' | 'cashier' | 'sorvete';

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  password?: string;
  status: 'active' | 'inactive' | 'pending' | 'blocked' | 'rejected';
  role_level: AdminRoleLevel;
  store_id: string | null;
  last_activity?: string;
  created_at: string;
}

export interface PurchasingManagement {
  id?: string;
  storeId: string;
  brand: string;
  productType: string;
  stockQty: number;
  buyQty: number;
  sellQty: number;
  sellPrice: number;
  lastBuyDate: string | null;
  year: number;
  month: number;
  updatedAt?: string;
}

/* =========================
   🔹 DEMANDAS (OS)
========================= */
export type DemandPriority = 'urgente' | 'alta' | 'media' | 'baixa';
export type DemandStatus = 'aberta' | 'em_andamento' | 'resolvida' | 'cancelada';

export interface Demand {
  id: string;
  store_id: string;
  title: string;
  description: string;
  category: string;
  priority: DemandPriority;
  status: DemandStatus;
  sla_hours: number;
  created_at: string;
  created_by: string;
  // Join fields
  store_name?: string;
  store_number?: string;
}

export interface DemandMessage {
  id: string;
  demand_id: string;
  sender_name: string;
  message: string;
  is_admin: boolean;
  read: boolean;
  created_at: string;
}

export interface DemandCategory {
  id: string;
  name: string;
  label: string;
  is_active: boolean;
  created_at?: string;
}

/* =========================
   🔹 QUESTIONÁRIOS DE COMPRAS
========================= */
export interface Questionnaire {
  id: string;
  store_id: string | null;
  title: string;
  description: string;
  created_by: string;
  created_at: string;
  is_active: boolean;
}

export interface QuestionnaireProduct {
  id: string;
  questionnaire_id: string;
  product_name: string;
  brand: string;
  category: string;
  one_drive_image_url: string;
  created_at: string;
}

export interface QuestionnaireAnswer {
  id: string;
  questionnaire_id: string;
  product_id: string;
  user_id: string;
  rating: number;
  suggested_quantity: number;
  comment: string;
  created_at: string;
}

/* =========================
   DASHBOARD PA
========================= */
export interface PAParameters {
  id: string;
  min_pa: number;
  max_pa: number;
  award_value: number;
  created_at: string;
  updated_at: string;
}

export interface PAWeek {
  id: string;
  week_number: number;
  month: number;
  year: number;
  start_date: string;
  end_date: string;
  is_active: boolean;
  created_at: string;
}

export interface PASale {
  id: string;
  week_id: string;
  store_id: string;
  seller_name: string;
  total_sales: number;
  pa_value: number;
  items_sold: number;
  is_eligible: boolean;
  award_amount: number;
  created_at: string;
}

export interface PAAward {
  id: string;
  week_id: string;
  store_id: string;
  seller_name: string;
  amount: number;
  status: 'pending' | 'paid';
  paid_at?: string;
  created_at: string;
}

export interface PAStoreSummary {
  store_id: string;
  store_name: string;
  total_sales: number;
  avg_pa: number;
  total_awards: number;
  eligible_sellers: number;
}

export interface DetailedAdvice {
  prioridade: string;
  meta: string;
  indicadores: string[];
  ranking: string;
  acoes: string[];
  frase?: string;
}

export interface MotivationalPhrase {
  id: string;
  frase: string;
  categoria: 'atraso' | 'pressao' | 'meta_batida' | 'vendas';
  created_at?: string;
}
