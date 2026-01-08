

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

export interface IceCreamStock {
  id: string;
  store_id: string;
  product_base: string;
  stock_initial: number;
  stock_current: number;
  unit: string;
  created_at?: string;
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
  created_at?: string;
}

// Fixed: Added 'ml' property to support mobile PDV attributes to resolve error in PDVMobileView.tsx
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
  createdAt?: string;
  saleCode?: string;
  status?: 'active' | 'canceled';
  cancelReason?: string;
  canceledBy?: string;
  ml?: string;
}

export type IceCreamPaymentMethod = 'Pix' | 'Cartão' | 'Dinheiro';
export type IceCreamCategory = 'Sundae' | 'Milkshake' | 'Casquinha' | 'Cascão' | 'Bebidas' | 'Adicionais';

export interface IceCreamTransaction {
  id: string;
  storeId: string;
  date: string;
  type: 'entry' | 'exit';
  category: IceCreamExpenseCategory | string;
  value: number;
  employeeName?: string;
  description?: string;
  createdAt: Date;
}

export type IceCreamExpenseCategory = 'Vale Funcionário' | 'Pagamento Funcionário' | 'Fornecedor' | 'Material/Consumo' | 'Aluguel' | 'Energia' | 'Outros';

// Restante das interfaces mantidas para não quebrar outros módulos
export interface PagePermission { id: string; page_key: string; label: string; module_group: string; allow_admin: boolean; allow_manager: boolean; allow_cashier: boolean; sort_order: number; }
export interface Store { id: string; number: string; name: string; city: string; managerName: string; managerEmail: string; managerPhone: string; status?: 'active' | 'pending' | 'inactive'; role?: UserRole; }
export interface MonthlyPerformance { id?: string; storeId: string; month: string; revenueTarget: number; revenueActual: number; percentMeta: number; itemsTarget?: number; itemsActual?: number; itemsPerTicket: number; unitPriceAverage: number; averageTicket: number; delinquencyRate: number; paTarget?: number; ticketTarget?: number; puTarget?: number; delinquencyTarget?: number; trend: 'up' | 'down' | 'stable'; correctedDailyGoal: number; businessDays?: number; }
export interface ProductPerformance { storeId: string; month: string; brand: string; category: string; pairsSold: number; revenue: number; }
export interface StoreProfitPartner { id: string; store_id: string; partner_name: string; percentage: number; active: boolean; created_at?: string; }
export interface CashRegisterClosure { id: string; storeId: string; closedBy: string; date: string; totalSales: number; totalExpenses: number; balance: number; notes?: string; createdAt: string; }
export interface SystemLog { id?: string; created_at: string; userId: string; userName: string; userRole: UserRole; action: string; details: string; }
// Fixed: Added pairs and classification to Cota interface
export interface Cota { id: string; storeId: string; brand: string; totalValue: number; shipmentDate: string; paymentTerms: string; installments: Record<string, number>; createdAt: Date; createdByRole?: UserRole; status?: 'pending' | 'validated'; pairs?: number; classification?: string; }
export interface CotaSettings { storeId: string; budgetValue: number; managerPercent: number; }
export interface CotaDebt { id?: string; storeId: string; month: string; value: number; }

// Fixed: Added missing TaskPriority type and updated AgendaItem to resolve error in AgendaSystem.tsx
export type TaskPriority = 'highest' | 'high' | 'medium' | 'low' | 'lowest';
export interface AgendaItem { id: string; userId: string; title: string; description: string; dueDate: string; priority: TaskPriority; isCompleted: boolean; createdAt: Date; }

// Fixed: Added missing DownloadCategory type and updated DownloadItem to resolve error in DownloadsModule.tsx
export type DownloadCategory = 'spreadsheet' | 'video' | 'image' | 'audio' | 'other';
export interface DownloadItem { id: string; title: string; description: string; category: DownloadCategory; url: string; fileName?: string; size?: string; campaign?: string; createdAt: Date; createdBy: string; }

export interface CashError { id: string; storeId: string; userId: string; userName: string; date: string; type: 'surplus' | 'shortage'; value: number; reason?: string; createdAt: Date; }
export interface Receipt { id: string; storeId?: string; issuerName: string; payer: string; recipient: string; value: number; valueInWords: string; reference: string; date: string; createdAt: Date; }
export interface CreditCardSale { id: string; storeId?: string; userId: string; date: string; brand: string; value: number; authorizationCode?: string; }
// Fixed: Added missing itemsActual and paActual to SellerGoal interface
export interface SellerGoal { storeId: string; sellerName: string; month: string; revenueTarget: number; revenueActual: number; commissionRate?: number; itemsActual?: number; paActual?: number; }

// Fixed: Added missing AdminUser and AdminRoleLevel types to resolve errors in AdminUsersManagement.tsx
export type AdminRoleLevel = 'super_admin' | 'admin' | 'auditor';
export interface AdminUser {
  id: string;
  name: string;
  email: string;
  password?: string;
  status: 'active' | 'inactive';
  role_level: AdminRoleLevel;
  last_activity?: string;
}
