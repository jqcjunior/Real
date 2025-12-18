
export enum UserRole {
  ADMIN = 'ADMIN',
  MANAGER = 'MANAGER',
  CASHIER = 'CASHIER'
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
}

export interface ProductPerformance {
  id?: string;
  storeId: string;
  month: string;
  brand: string;
  category: string;
  pairsSold: number;
  revenue: number;
  reference?: string;
  stockQuantity?: number;
  purchaseQuantity?: number;
  consumption?: number;
  pendingOrder?: number;
  costPrice?: number;
  salePrice?: number;
  lastPurchaseDate?: string;
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

export type CotaPayment = { month: string; value: number };

export interface Cota {
    id: string;
    storeId: string;
    brand: string;
    classification?: string;
    totalValue: number;
    shipmentDate: string;
    paymentTerms: string;
    pairs?: number;
    installments: CotaPayment[];
    createdAt: Date;
    createdByRole?: UserRole;
    status?: 'pending' | 'validated';
}

export interface CotaSettings {
  storeId: string;
  budgetValue: number;
  managerPercent: number;
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

export interface CreditCardSale {
    id: string;
    storeId?: string;
    userId?: string;
    date: string;
    brand: string;
    authorizationCode?: string;
    value: number;
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

export type IceCreamPaymentMethod = 'Pix' | 'Cartão' | 'Dinheiro';

export interface IceCreamDailySale {
  id: string;
  itemId: string;
  productName: string;
  category: string;
  flavor: string;
  unitsSold: number;
  unitPrice: number; 
  totalValue: number;
  paymentMethod: IceCreamPaymentMethod;
  createdAt?: string; // Gerado pelo servidor
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

// --- ICE CREAM MODULE TYPES (V2) ---
export type IceCreamCategory = 'Adicionais' | 'Bebidas' | 'Cascão' | 'Casquinha' | 'Milkshake' | 'Sundae';

export interface IceCreamItem {
  id: string;
  name: string;
  price: number;
  flavor?: string; 
  costPrice?: number; 
  category: IceCreamCategory;
  active: boolean; // Novo campo
}

export type IceCreamExpenseCategory = 'Vale Funcionário' | 'Pagamento Funcionário' | 'Fornecedor' | 'Material/Consumo' | 'Aluguel' | 'Energia' | 'Outros';

export interface IceCreamTransaction {
  id: string;
  date: string;
  type: 'entry' | 'exit';
  category: IceCreamExpenseCategory | 'Venda_Dinheiro' | 'Venda_Cartao';
  value: number;
  employeeName?: string; // Nome do funcionário para vales e pagamentos
  description?: string;
  createdAt: Date;
}
