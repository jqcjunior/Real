
import { MonthlyPerformance, Store, User, UserRole, ProductPerformance, Cota, AgendaItem, DownloadItem, CashError } from './types';

export const APP_NAME = "Real Calçados";

// Mock Users
export const MOCK_USERS: User[] = [
  { 
    id: 'u1', 
    name: 'Administrador Geral', 
    role: UserRole.ADMIN, 
    email: 'admin@realcalcados.com',
    password: 'admin' 
  },
  { 
    id: 'u2', 
    name: 'Carlos Gerente (Loja 1)', 
    role: UserRole.MANAGER, 
    storeId: 's1', 
    email: 'carlos@loja1.com',
    password: '123' 
  },
  { 
    id: 'u3', 
    name: 'Ana Gerente (Loja 2)', 
    role: UserRole.MANAGER, 
    storeId: 's2', 
    email: 'ana@loja2.com',
    password: '123' 
  },
  { 
    id: 'u4', 
    name: 'Junior Cardoso', 
    role: UserRole.ADMIN, 
    email: 'juniorcardoso@me.com',
    password: 'Solazul1981*' 
  },
  {
    id: 'u5',
    name: 'Operador de Caixa',
    role: UserRole.CASHIER,
    email: 'caixa@realcalcados.com',
    password: '123',
    storeId: 's1'
  }
];

// Mock Stores (Numbers normalized to integers without leading zeros)
export const MOCK_STORES: Store[] = [
  { id: 's1', number: '1', name: 'Shopping Center Norte', city: 'São Paulo', managerName: 'Carlos Silva', managerEmail: 'carlos@loja1.com', managerPhone: '(11) 99999-0001', status: 'active' },
  { id: 's2', number: '2', name: 'Barra Shopping', city: 'Rio de Janeiro', managerName: 'Ana Souza', managerEmail: 'ana@loja2.com', managerPhone: '(21) 99999-0002', status: 'active' },
  { id: 's3', number: '3', name: 'Pátio Savassi', city: 'Belo Horizonte', managerName: 'Roberto Dias', managerEmail: 'beto@loja3.com', managerPhone: '(31) 99999-0003', status: 'active' },
  { id: 's4', number: '4', name: 'Iguatemi Brasília', city: 'Brasília', managerName: 'Fernanda Lima', managerEmail: 'fer@loja4.com', managerPhone: '(61) 99999-0004', status: 'active' },
  { id: 's5', number: '5', name: 'Shopping Recife', city: 'Recife', managerName: 'Paulo Coelho', managerEmail: 'paulo@loja5.com', managerPhone: '(81) 99999-0005', status: 'active' },
];

// Mock Performance Data (History)
export const MOCK_PERFORMANCE: MonthlyPerformance[] = [
  // --- OUTUBRO 2023 ---
  {
    storeId: 's1',
    month: '2023-10',
    revenueTarget: 150000,
    revenueActual: 142000,
    percentMeta: 94.6,
    itemsPerTicket: 2.5,
    unitPriceAverage: 89.90,
    averageTicket: 224.75,
    delinquencyRate: 1.2,
    trend: 'up',
    correctedDailyGoal: 5000
  },
  {
    storeId: 's2',
    month: '2023-10',
    revenueTarget: 200000,
    revenueActual: 215000,
    percentMeta: 107.5,
    itemsPerTicket: 3.1,
    unitPriceAverage: 75.50,
    averageTicket: 234.05,
    delinquencyRate: 0.8,
    trend: 'up',
    correctedDailyGoal: 0
  },
  {
    storeId: 's3',
    month: '2023-10',
    revenueTarget: 120000,
    revenueActual: 98000,
    percentMeta: 81.6,
    itemsPerTicket: 2.1,
    unitPriceAverage: 95.00,
    averageTicket: 199.50,
    delinquencyRate: 2.5,
    trend: 'down',
    correctedDailyGoal: 6500
  },
  {
    storeId: 's4',
    month: '2023-10',
    revenueTarget: 180000,
    revenueActual: 175000,
    percentMeta: 97.2,
    itemsPerTicket: 2.8,
    unitPriceAverage: 82.00,
    averageTicket: 229.60,
    delinquencyRate: 1.0,
    trend: 'stable',
    correctedDailyGoal: 2000
  },
  {
    storeId: 's5',
    month: '2023-10',
    revenueTarget: 160000,
    revenueActual: 168000,
    percentMeta: 105.0,
    itemsPerTicket: 3.0,
    unitPriceAverage: 78.00,
    averageTicket: 234.00,
    delinquencyRate: 1.5,
    trend: 'up',
    correctedDailyGoal: 0
  },
];

// MOCK PRODUCT DATA (COMPRAS)
export const MOCK_PRODUCT_PERFORMANCE: ProductPerformance[] = [
    // Loja 1
    { id: '1', storeId: 's1', month: '2023-10', brand: 'Vizzano', category: 'Feminino', pairsSold: 150, revenue: 15000 },
    { id: '2', storeId: 's1', month: '2023-10', brand: 'Beira Rio', category: 'Conforto', pairsSold: 120, revenue: 10800 },
    { id: '3', storeId: 's1', month: '2023-10', brand: 'Nike', category: 'Esportivo', pairsSold: 45, revenue: 18000 },
    { id: '4', storeId: 's1', month: '2023-10', brand: 'Olympikus', category: 'Esportivo', pairsSold: 80, revenue: 12000 },
    
    // Loja 2
    { id: '5', storeId: 's2', month: '2023-10', brand: 'Vizzano', category: 'Feminino', pairsSold: 200, revenue: 20000 },
    { id: '6', storeId: 's2', month: '2023-10', brand: 'Moleca', category: 'Jovem', pairsSold: 300, revenue: 15000 },
    { id: '7', storeId: 's2', month: '2023-10', brand: 'Nike', category: 'Esportivo', pairsSold: 60, revenue: 24000 },
    
    // Loja 3
    { id: '8', storeId: 's3', month: '2023-10', brand: 'Pegada', category: 'Masculino', pairsSold: 50, revenue: 9000 },
    { id: '9', storeId: 's3', month: '2023-10', brand: 'Vizzano', category: 'Feminino', pairsSold: 80, revenue: 8000 },
];

export const MOCK_COTAS: Cota[] = [];

export const MOCK_AGENDA: AgendaItem[] = [
    {
        id: 'a1',
        userId: 'u1',
        title: 'Revisar Metas de Natal',
        description: 'Ajustar as metas com base no estoque recebido.',
        dueDate: new Date().toISOString().split('T')[0], // Hoje
        priority: 'highest', // Was 'high'
        isCompleted: false,
        createdAt: new Date()
    },
    {
        id: 'a2',
        userId: 'u1',
        title: 'Reunião com Gerentes',
        description: 'Apresentação dos resultados de Outubro.',
        dueDate: '2023-12-10',
        priority: 'medium',
        isCompleted: false,
        createdAt: new Date()
    },
    {
        id: 'a3',
        userId: 'u2', // Carlos
        title: 'Enviar Relatório de Defeitos',
        description: 'Planilha de devolução para a Vizzano.',
        dueDate: new Date().toISOString().split('T')[0],
        priority: 'high',
        isCompleted: false,
        createdAt: new Date()
    },
    {
        id: 'a4',
        userId: 'u1',
        title: 'Comprar Material de Escritório',
        description: 'Canetas e Papel A4',
        dueDate: '2023-12-15',
        priority: 'lowest',
        isCompleted: true,
        createdAt: new Date()
    }
];

export const MOCK_DOWNLOADS: DownloadItem[] = [
    {
        id: 'd1',
        title: 'Tabela de Preços - Verão 2024',
        description: 'Lista completa de preços sugeridos para a nova coleção.',
        category: 'spreadsheet',
        url: '#', // In a real app this would be a URL
        fileName: 'tabela_verao_2024.xlsx',
        size: '1.2 MB',
        createdAt: new Date('2023-11-01'),
        createdBy: 'Admin'
    },
    {
        id: 'd2',
        title: 'Treinamento de Vendas - Abordagem',
        description: 'Vídeo explicativo sobre técnicas de abordagem ao cliente.',
        category: 'video',
        url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', // Example external link
        fileName: 'treinamento_abordagem.mp4',
        size: 'External',
        createdAt: new Date('2023-10-20'),
        createdBy: 'Admin'
    },
    {
        id: 'd3',
        title: 'Campanha Black Friday - Post Instagram',
        description: 'Arte oficial para divulgação nas redes sociais.',
        category: 'image',
        url: 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?q=80&w=1080&auto=format&fit=crop',
        fileName: 'black_friday_post.jpg',
        size: '2.5 MB',
        campaign: 'Promoção',
        createdAt: new Date('2023-11-10'),
        createdBy: 'Admin'
    },
    {
        id: 'd4',
        title: 'Jingle Promocional - Natal',
        description: 'Áudio para carro de som e rádio.',
        category: 'audio',
        url: '#', 
        fileName: 'jingle_natal.mp3',
        size: '4.5 MB',
        campaign: 'Natal',
        createdAt: new Date('2023-11-15'),
        createdBy: 'Admin'
    }
];

export const MOCK_CASH_ERRORS: CashError[] = [];

export const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

export const formatPercent = (value: number) => {
  return new Intl.NumberFormat('pt-BR', { style: 'percent', minimumFractionDigits: 1 }).format(value / 100);
};
