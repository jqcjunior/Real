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

export interface IceCreamStock {
  id: string;
  store_id: string;
  product_base: string;
  stock_initial: number;
  stock_current: number;
  unit: string;
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

export type IceCreamPaymentMethod = 'Pix' | 'Cartão' | 'Dinheiro' | 'Fiado';
export type IceCreamCategory = 'Sundae' | 'Milkshake' | 'Casquinha' | 'Cascão' | 'Cascão Trufado' | 'Copinho' | 'Bebidas' | 'Adicionais';

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

export interface IceCreamPromissoryNote {
    id: string;
    store_id: string;
    sale_id: string;
    buyer_name: string;
    value: number;
    status: 'pending' | 'paid';
    created_at: string;
}

export interface PagePermission { id: string; page_key: string; label: string; module_group: string; allow_admin: boolean; allow_manager: boolean; allow_cashier: boolean; allow_sorvete: boolean; sort_order: number; }
export interface Store { id: string; number: string; name: string; city: string; managerName: string; managerEmail: string; managerPhone: string; status?: 'active' | 'pending' | 'inactive'; role?: UserRole; password?: string; passwordResetRequested?: boolean; }
export interface MonthlyPerformance { id?: string; storeId: string; month: string; revenueTarget: number; revenueActual: number; percentMeta: number; itemsTarget?: number; itemsActual?: number; itemsPerTicket: number; unitPriceAverage: number; averageTicket: number; delinquencyRate: number; paTarget?: number; ticketTarget?: number; puTarget?: number; delinquencyTarget?: number; trend: 'up' | 'down' | 'stable'; correctedDailyGoal: number; businessDays?: number; }
export interface ProductPerformance { storeId: string; month: string; brand: string; category: string; pairsSold: number; revenue: number; }
export interface StoreProfitPartner { id: string; store_id: string; partner_name: string; percentage: number; active: boolean; created_at?: string; }
export interface CashRegisterClosure { id: string; storeId: string; closedBy: string; date: string; totalSales: number; totalExpenses: number; balance: number; notes?: string; createdAt: string; }
export interface SystemLog { id?: string; created_at: string; userId: string; userName: string; userRole: UserRole; action: string; details: string; }

export interface Cota { 
  id: string; 
  storeId: string; 
  brand: string; 
  totalValue: number; 
  shipmentDate: string; 
  paymentTerms: string; 
  installments: Record<string, number>; 
  createdAt: Date; 
  createdByRole?: string; 
  status?: 'pending' | 'validated'; 
  pairs?: number; 
  classification?: string; 
}

export interface CotaSettings { storeId: string; budgetValue: number; managerPercent: number; }
export interface CotaDebts { id?: string; storeId: string; month: string; value: number; description?: string; }

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
  reminder_level: 1 | 2 | 3;
  reminded_at?: string | null;
  completed_note?: string;
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

export interface CashError { id: string; storeId: string; userId: string; userName: string; date: string; type: 'surplus' | 'shortage'; value: number; reason?: string; createdAt: Date; }
export interface Receipt { id: string; storeId?: string; issuerName: string; payer: string; recipient: string; value: number; valueInWords: string; reference: string; date: string; createdAt: Date; }
export interface CreditCardSale { id: string; storeId?: string; userId: string; date: string; brand: string; value: number; authorizationCode?: string; }
export interface SellerGoal { storeId: string; sellerName: string; month: string; revenueTarget: number; revenueActual: number; commissionRate?: number; itemsActual?: number; paActual?: number; }

export type AdminRoleLevel = 'admin' | 'manager' | 'cashier' | 'sorvete';
export interface AdminUser {
  id: string;
  name: string;
  email: string;
  password?: string;
  status: 'active' | 'inactive';
  role_level: AdminRoleLevel;
  last_activity?: string;
}