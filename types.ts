
export enum UserRole {
  ADMIN = 'ADMIN',
  MANAGER = 'MANAGER',
  CASHIER = 'CASHIER'
}

// Níveis de privilégio para Administradores de Sistema
export type AdminRoleLevel = 'super_admin' | 'admin' | 'auditor';

export interface User {
  id: string;
  name: string;
  role: UserRole;
  storeId?: string;
  email: string;
  password?: string;
  photo?: string;
}

export interface PagePermission {
    id: string;
    page_key: string;
    label: string;
    module_group: string;
    icon_name?: string;
    allow_admin: boolean;
    allow_manager: boolean;
    allow_cashier: boolean;
    sort_order: number;
}

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  password?: string;
  status: 'active' | 'inactive';
  role_level: AdminRoleLevel;
  last_activity?: string;
  created_at?: string;
}

export interface Store {
  id: string;
  number: string;
  name: string;
  city: string;
  managerName: string;
  managerEmail: string;
  managerPhone: string;
  password?: string;
  status?: 'active' | 'pending' | 'inactive';
  role?: UserRole;
  passwordResetRequested?: boolean;
}

export interface MonthlyPerformance {
  id?: string;
  storeId: string;
  month: string;
  revenueTarget: number;
  revenueActual: number;
  percentMeta: number;
  itemsTarget?: number;
  itemsActual?: number;
  itemsPerTicket: number;
  unitPriceAverage: number;
  averageTicket: number;
  delinquencyRate: number;
  paTarget?: number;
  ticketTarget?: number;
  puTarget?: number;
  delinquencyTarget?: number;
  trend: 'up' | 'down' | 'stable';
  correctedDailyGoal: number;
  businessDays?: number;
}

// Add: ProductPerformance interface for brand and category analysis
export interface ProductPerformance {
  storeId: string;
  month: string;
  brand: string;
  category: string;
  pairsSold: number;
  revenue: number;
}

export interface SellerGoal {
  id?: string;
  storeId: string;
  sellerName: string;
  month: string;
  revenueTarget: number;
  revenueActual: number;
  itemsActual?: number;
  paActual?: number;
  commissionRate?: number;
}

export interface SystemLog {
  id: string;
  timestamp: Date;
  userId: string;
  userName: string;
  userRole: UserRole;
  action: string;
  details: string;
}

export interface Cota {
    id: string;
    storeId: string;
    brand: string;
    classification?: string;
    totalValue: number;
    shipmentDate: string;
    paymentTerms: string;
    pairs?: number;
    installments: Record<string, number>;
    createdAt: Date;
    createdByRole?: UserRole;
    status?: 'pending' | 'validated';
}

export interface CotaSettings {
  storeId: string;
  budgetValue: number;
  managerPercent: number;
}

export interface CotaDebt {
  id?: string;
  storeId: string;
  month: string;
  value: number;
}

export interface IceCreamDailySale {
  id: string;
  itemId: string;
  productName: string;
  category: string;
  flavor: string;
  ml?: string;
  unitsSold: number;
  unitPrice: number; 
  totalValue: number;
  paymentMethod: IceCreamPaymentMethod;
  createdAt?: string; 
}

export type IceCreamPaymentMethod = 'Pix' | 'Cartão' | 'Dinheiro';
export type IceCreamCategory = 'Sundae' | 'Milkshake' | 'Casquinha' | 'Cascão' | 'Bebidas' | 'Adicionais';

export interface IceCreamItem {
  id: string;
  name: string;
  price: number;
  flavor?: string; 
  costPrice?: number; 
  category: IceCreamCategory;
  active: boolean;
}

export type IceCreamExpenseCategory = 'Vale Funcionário' | 'Pagamento Funcionário' | 'Fornecedor' | 'Material/Consumo' | 'Aluguel' | 'Energia' | 'Outros';

export interface IceCreamTransaction {
  id: string;
  date: string;
  type: 'entry' | 'exit';
  category: IceCreamExpenseCategory | 'Venda_Dinheiro' | 'Venda_Cartao';
  value: number;
  employeeName?: string;
  description?: string;
  createdAt: Date;
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

// Add: TaskPriority type for Agenda System
export type TaskPriority = 'lowest' | 'low' | 'medium' | 'high' | 'highest';

export interface AgendaItem {
    id: string;
    userId: string;
    title: string;
    description: string;
    dueDate: string;
    priority: TaskPriority;
    isCompleted: boolean;
    createdAt: Date;
}

// Add: DownloadCategory type for Downloads Module
export type DownloadCategory = 'spreadsheet' | 'video' | 'image' | 'audio';

export interface DownloadItem {
    id: string;
    title: string;
    description: string;
    category: DownloadCategory;
    url: string;
    fileName?: string;
    size?: string;
    campaign?: string;
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

// Add: Receipt interface for Financial and Audit Modules
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

// Add: CreditCardSale interface for Financial Module
export interface CreditCardSale {
  id: string;
  storeId?: string;
  userId: string;
  date: string;
  brand: string;
  value: number;
  authorizationCode?: string;
}
