import { 
    User, Store, IceCreamItem, IceCreamStock, IceCreamDailySale, 
    IceCreamPaymentMethod, IceCreamPromissoryNote, IceCreamRecipeItem, 
    StoreProfitPartner, Sale, IceCreamSangria, IceCreamSangriaCategory, 
    IceCreamStockMovement, AdminUser, IceCreamFutureDebt, IceCreamCategory 
} from '../../../types';

export interface IceCreamModuleProps {
  user: User;
  stores: Store[];
  items: IceCreamItem[];
  stock: IceCreamStock[];
  sales: IceCreamDailySale[];
  salesHeaders?: Sale[];
  salePayments: any[];
  promissories: IceCreamPromissoryNote[];
  can: (permissionKey: string) => boolean;
  onAddSales: (sale: IceCreamDailySale[]) => Promise<void>;
  onAddSaleAtomic: (saleData: any, items: IceCreamDailySale[], payments: { method: IceCreamPaymentMethod, amount: number }[]) => Promise<void>;
  onCancelSale: (id: string, reason?: string) => Promise<void>;
  onUpdatePrice: (id: string, price: number) => Promise<void>;
  onAddItem: (name: string, category: string, price: number, flavor?: string, stockInitial?: number, unit?: string, consumptionPerSale?: number, targetStoreId?: string, recipe?: IceCreamRecipeItem[]) => Promise<void>;
  onSaveProduct: (product: Partial<IceCreamItem>) => Promise<void>;
  onDeleteItem: (id: string) => Promise<void>;
  onUpdateStock: (storeId: string, base: string, value: number, unit: string, type: 'production' | 'adjustment' | 'purchase' | 'inventory', stockId?: string) => Promise<void>;
  liquidatePromissory: (id: string) => Promise<void>;
  onDeleteStockItem: (id: string) => Promise<void>;
  sangriaCategories: IceCreamSangriaCategory[];
  sangrias: IceCreamSangria[];
  stockMovements: IceCreamStockMovement[];
  partners: StoreProfitPartner[];
  adminUsers: AdminUser[];
  onAddSangria: (sangria: Partial<IceCreamSangria>) => Promise<void>;
  onAddSangriaCategory: (cat: Partial<IceCreamSangriaCategory>) => Promise<void>;
  onDeleteSangriaCategory: (id: string) => Promise<void>;
  onAddStockMovement: (movement: Partial<IceCreamStockMovement>) => Promise<void>;
  futureDebts: IceCreamFutureDebt[];
  onAddFutureDebt: (debt: Partial<IceCreamFutureDebt>) => Promise<void>;
  onPayFutureDebt: (debtId: string, paymentDate: string) => Promise<void>;
  fetchData?: () => Promise<void>;
}
