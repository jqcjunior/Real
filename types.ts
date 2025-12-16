
export enum UserRole {
  ADMIN = 'ADMIN',
  MANAGER = 'MANAGER',
  CASHIER = 'CASHIER'
}

export interface User {
  id: string;
  name: string;
  role: UserRole;
  storeId?: string; // Only for managers
  email: string;
  password?: string; // Senha para validação (mock)
  photo?: string; // Base64 string for profile picture
}

export interface Store {
  id: string;
  number: string;
  name: string;
  city: string;
  managerName: string;
  managerEmail: string;
  managerPhone: string;
  password?: string; // Senha de acesso do gerente
  status?: 'active' | 'pending' | 'inactive'; // Status da loja no sistema (inactive = soft delete/rejeitado)
  role?: UserRole; // Define se este cadastro tem permissão de Admin ou Gerente
  passwordResetRequested?: boolean; // Flag to indicate if the pending status is due to a forgotten password
}

export interface MonthlyPerformance {
  storeId: string;
  month: string; // YYYY-MM
  
  // Financeiro
  revenueTarget: number; // Meta (Valor)
  revenueActual: number; // Realizado (Valor)
  percentMeta: number; // % Atingido
  
  // Físico / Quantidade (NOVO)
  itemsTarget?: number; // Meta de Peças/Pares
  itemsActual?: number; // Realizado de Peças/Pares

  // Operacional - Realizado
  itemsPerTicket: number; // P.A.
  unitPriceAverage: number; // P.U.
  averageTicket: number; // Ticket Médio
  delinquencyRate: number; // Inadimplência %

  // Operacional - Metas (Novos campos)
  paTarget?: number;
  ticketTarget?: number;
  puTarget?: number;
  delinquencyTarget?: number;

  trend: 'up' | 'down' | 'stable';
  correctedDailyGoal: number;
}

// NOVA INTERFACE PARA GESTÃO DE COMPRAS
export interface ProductPerformance {
  id: string;
  storeId: string;
  month: string; // YYYY-MM
  brand: string; // Ex: Nike, Vizzano, Beira Rio
  category: string; // Ex: Esportivo, Casual, Sandália
  pairsSold: number;
  revenue: number;
  // Campos Detalhados Importação
  reference?: string; // Referencia do produto
  stockQuantity?: number; // Estoque Atual
  purchaseQuantity?: number; // Compra
  consumption?: number; // Consumo %
  pendingOrder?: number; // Pedido Pendente
  costPrice?: number; // Preço Custo
  salePrice?: number; // Preço Venda
  lastPurchaseDate?: string; // Data Ultima Compra
}

export interface GamificationStats {
  rank: number;
  points: number;
  medals: {
    gold: number;
    silver: number;
    bronze: number;
  };
  achievements: string[];
}

export interface SystemLog {
  id: string;
  timestamp: Date;
  userId: string;
  userName: string;
  userRole: UserRole;
  action: 'LOGIN' | 'LOGOUT' | 'DOWNLOAD_IMAGE' | 'UPDATE_GOAL' | 'SYSTEM' | 'IMPORT_PURCHASES' | 'OPEN_STUDIO' | 'ADD_COTA' | 'ADD_TASK' | 'GENERATE_RECEIPT' | 'CHECK_COTAS' | 'USE_AGENDA' | 'UPLOAD_FILE' | 'DELETE_FILE' | 'REPORT_CASH_ERROR' | 'VALIDATE_ORDER';
  details: string;
}

// --- NEW TYPES FOR COTAS ---
export interface CotaPayment {
    month: string; // YYYY-MM (Data do vencimento da parcela)
    value: number;
}

export interface Cota {
    id: string;
    storeId: string; // Se for admin, pode ser null ou selecionado
    brand: string;
    classification?: string; // Ex: Feminino Casual
    totalValue: number;
    shipmentDate: string; // YYYY-MM (Data base embarque)
    paymentTerms: string; // Ex: "30/60/90" ou "90/120/150"
    pairs?: number;
    installments: CotaPayment[]; // Array calculado automaticamente
    createdAt: Date;
    createdByRole?: UserRole; // Identifies if added by MANAGER or ADMIN
    status?: 'pending' | 'validated'; // New field: pending (in list) vs validated (received/hidden)
}

// --- NEW TYPES FOR AGENDA (UPDATED TO 5 LEVELS) ---
export type TaskPriority = 'lowest' | 'low' | 'medium' | 'high' | 'highest';

export interface AgendaItem {
    id: string;
    userId: string; // Dono da tarefa
    title: string;
    description: string;
    dueDate: string; // YYYY-MM-DD
    priority: TaskPriority;
    isCompleted: boolean;
    createdAt: Date;
}

// --- NEW TYPE FOR FINANCIAL MODULE ---
export interface CreditCardSale {
    id: string;
    storeId?: string; // Link to store
    userId?: string;  // Link to cashier/manager
    date: string;
    brand: string; // Visa, Master, Elo, etc.
    authorizationCode?: string; // New field
    value: number;
}

// --- NEW TYPE FOR RECEIPTS ---
export interface Receipt {
    id: string;
    storeId?: string;
    issuerName: string; // Quem emitiu no sistema (usuário logado)
    payer: string; // Quem pagou (A Empresa / Loja)
    recipient: string; // Quem recebeu (O Beneficiário / Assinatura)
    value: number;
    valueInWords: string;
    reference: string;
    date: string; // YYYY-MM-DD
    createdAt: Date;
}

// --- NEW TYPE FOR DOWNLOADS ---
export type DownloadCategory = 'spreadsheet' | 'video' | 'image' | 'audio';

export interface DownloadItem {
    id: string;
    title: string;
    description: string;
    category: DownloadCategory;
    url: string; // Base64 data or External URL
    fileName?: string; // Original filename
    size?: string; // File size string (e.g. "2MB")
    campaign?: string; // Folder/Campaign name (e.g. "Natal")
    createdAt: Date;
    createdBy: string;
}

// --- NEW TYPE FOR CASH ERRORS ---
export interface CashError {
    id: string;
    storeId: string;
    userId: string;
    userName: string;
    date: string; // YYYY-MM-DD (Locked to today in UI)
    type: 'surplus' | 'shortage'; // Sobra (+) | Falta (-)
    value: number; // Absolute value stored, sign logic applied in UI
    reason?: string;
    createdAt: Date;
}
