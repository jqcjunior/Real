
import React, { useState, useMemo, useEffect } from 'react';
import { Store, User, Cota, CotaPayment, UserRole, SystemLog } from '../types';
import { formatCurrency } from '../constants';
import { Calculator, Plus, Save, Trash2, Filter, Settings, CheckSquare, Square, X, AlertCircle, Wallet, TrendingDown, Store as StoreIcon, LayoutGrid, PieChart, UserCheck, Briefcase, Search, BarChart2, CheckCircle, RefreshCcw, PackageCheck } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend, ComposedChart, Line, LabelList } from 'recharts';

interface CotasManagementProps {
  user: User;
  stores: Store[];
  cotas: Cota[];
  onAddCota: (cota: Cota) => void;
  onDeleteCota: (id: string) => void;
  onUpdateCota?: (cota: Cota) => void; // Added for status update
  onLogAction?: (action: SystemLog['action'], details: string) => void;
}

// Options sorted alphabetically within groups as requested
const CLASSIFICATION_OPTIONS = {
  'Feminino': [
    'Birken',
    'Bota',
    'Casual',
    'Chinelo',
    'Conforto',
    'Esportivo',
    'Moda',
    'Rasteira',
    'Salto',
    'Sandália',
    'Sapatilha'
  ],
  'Masculino': [
    'Botas',
    'Casual',
    'Chinelo',
    'Esportivo',
    'Sandália',
    'Sapatênis',
    'Sapato Social'
  ],
  'Infantil': [
    'Bebê',
    'Esportivo',
    'Feminino',
    'Masculino',
    'Sandália',
    'Unissex'
  ],
  'Acessórios': [
    'Bolas',
    'Bolsas',
    'Bonés',
    'Carteiras',
    'Cintos',
    'Esportivos',
    'Malas',
    'Material Escolar',
    'Meias',
    'Mochilas',
    'Perfumes',
    'Relógios'
  ]
};

interface BudgetConfig {
    value: number;
    managerPercent: number; // 0 to 100
}

// Extended palette for stacked bars
const STACK_COLORS = [
    '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', 
    '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1',
    '#14b8a6', '#d946ef', '#e11d48', '#22c55e', '#3b82f6'
];

const CotasManagement: React.FC<CotasManagementProps> = ({ user, stores, cotas, onAddCota, onDeleteCota, onUpdateCota, onLogAction }) => {
  // --- STATE ---
  // FIX: Memoize activeStores to prevent reference instability on every render
  const activeStores = useMemo(() => {
      return stores.filter(s => s.status === 'active').sort((a, b) => parseInt(a.number) - parseInt(b.number));
  }, [stores]);

  const isManager = user.role === UserRole.MANAGER;
  
  // Filter State
  const [selectedStoreFilter, setSelectedStoreFilter] = useState<string>('all');
  
  // Local Tab State - Initialize with the first active store
  const [activeTab, setActiveTab] = useState<string>('');

  // Budget State: Now stores object with split info
  const [storeBudgets, setStoreBudgets] = useState<Record<string, BudgetConfig>>({});
  
  const [isBudgetModalOpen, setIsBudgetModalOpen] = useState(false);
  const [budgetForm, setBudgetForm] = useState({ 
      storeId: '', 
      value: '',
      managerPercent: 30 // Default 30%
  });

  // Debt Forecast State (StoreId -> Month -> Value)
  const [debtForecasts, setDebtForecasts] = useState<Record<string, Record<string, number>>>({});
  const [isDebtModalOpen, setIsDebtModalOpen] = useState(false);
  const [debtFormStoreId, setDebtFormStoreId] = useState<string>('');
  // Temporary state for editing debts in modal
  const [tempDebts, setTempDebts] = useState<Record<string, string>>({}); 

  // Received Orders Modal
  const [isReceivedModalOpen, setIsReceivedModalOpen] = useState(false);

  // New Cota Form State
  const [selectedStoreIds, setSelectedStoreIds] = useState<string[]>([]);
  const [newCota, setNewCota] = useState<{
      brand: string;
      classification: string;
      value: string;
      shipmentDate: string;
      paymentTerms: string;
      pairs: string;
  }>({
      brand: '',
      classification: '',
      value: '',
      shipmentDate: new Date().toISOString().slice(0, 7), // YYYY-MM
      paymentTerms: '90/120/150', // Set default as requested
      pairs: ''
  });

  // LOGGING: On Mount
  useEffect(() => {
      if (onLogAction) {
          onLogAction('CHECK_COTAS', 'Acessou o painel de gerenciamento de cotas');
      }
  }, []);

  // LOGGING: On Filter Change
  useEffect(() => {
      if (onLogAction && selectedStoreFilter !== 'all') {
          const store = activeStores.find(s => s.id === selectedStoreFilter);
          if (store) {
              onLogAction('CHECK_COTAS', `Buscou informações de cotas da Loja ${store.number}`);
          }
      }
  }, [selectedStoreFilter, activeStores, onLogAction]);

  // Initialize Active Tab safely
  useEffect(() => {
      if (activeStores.length > 0 && !activeTab) {
          setActiveTab(activeStores[0].id);
          setBudgetForm(prev => ({...prev, storeId: activeStores[0].id}));
          setDebtFormStoreId(activeStores[0].id);
      }
  }, [activeStores, activeTab]);

  // Handle Tab Synchronization with Filter
  useEffect(() => {
      if (selectedStoreFilter !== 'all') {
          // If a specific store is selected in global filter, switch tab to it
          setActiveTab(selectedStoreFilter);
      } else {
          // If All, ensure current activeTab is valid, otherwise reset to first
          const isValid = activeStores.some(s => s.id === activeTab);
          if (!isValid && activeStores.length > 0) {
              setActiveTab(activeStores[0].id);
          }
      }
  }, [selectedStoreFilter, activeStores]); // Removed activeTab from dependency to avoid loop

  // --- HELPERS ---

  // Generate unique brands for autocomplete from existing data
  const uniqueBrands = useMemo(() => {
      const brands = new Set<string>();
      cotas.forEach(c => {
          if (c.brand) brands.add(c.brand);
      });
      return Array.from(brands).sort();
  }, [cotas]);

  // State to hold the reference date for month generation. 
  // This allows us to refresh the table columns when the user interacts with "Lançar Dívidas".
  const [referenceDate, setReferenceDate] = useState(new Date());

  // Generate 12 months starting from reference month
  const tableMonths = useMemo(() => {
      const months = [];
      // Start from reference month (1st day)
      const current = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 1);

      for (let i = 0; i < 12; i++) {
          const y = current.getFullYear();
          const m = String(current.getMonth() + 1).padStart(2, '0');
          months.push(`${y}-${m}`);
          current.setMonth(current.getMonth() + 1);
      }
      return months;
  }, [referenceDate]);

  const formatMonthHeader = (dateStr: string) => {
      const [y, m] = dateStr.split('-');
      const date = new Date(parseInt(y), parseInt(m)-1, 1);
      const monthName = date.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
      // Example: Dez/25
      return `${monthName.charAt(0).toUpperCase() + monthName.slice(1)}/${y.slice(2)}`;
  };

  const calculateInstallments = (totalValue: number, shipmentDate: string, terms: string): CotaPayment[] => {
      // Split by slash, comma, dash, or space to support various input formats
      const parts = terms.split(/[\/\,\-\s]+/).map(t => parseInt(t.trim()));
      const validParts = parts.filter(p => !isNaN(p) && p > 0);
      
      if (validParts.length === 0) return [];

      const installmentValue = totalValue / validParts.length;
      
      // Parse YYYY-MM explicitly to avoid timezone issues
      const [yearStr, monthStr] = shipmentDate.split('-');
      const startYear = parseInt(yearStr);
      const startMonthIndex = parseInt(monthStr) - 1; // JS Months are 0-11

      // Group installments by month to handle cases where multiple installments fall in the same month (e.g. "30/30")
      const installmentsMap: Record<string, number> = {};

      validParts.forEach(days => {
          // Logic: Treat every 30 days as 1 month forward (Commercial Month)
          const monthsToAdd = Math.round(days / 30);
          
          // Set date to the 15th to avoid end-of-month rollover issues
          const dueDate = new Date(startYear, startMonthIndex + monthsToAdd, 15);
          
          const y = dueDate.getFullYear();
          const m = String(dueDate.getMonth() + 1).padStart(2, '0');
          const monthKey = `${y}-${m}`;

          installmentsMap[monthKey] = (installmentsMap[monthKey] || 0) + installmentValue;
      });

      return Object.entries(installmentsMap).map(([month, value]) => ({
          month,
          value
      }));
  };

  // Helper to get budget info safely
  const getBudgetInfo = (storeId: string) => {
      const config = storeBudgets[storeId];
      if (config) {
          // Handle case where it might be legacy (just a number) or new object
          if (typeof config === 'number') return { value: config, managerPercent: 30 };
          return config;
      }
      return { value: 0, managerPercent: 30 };
  };

  // --- HANDLERS ---

  const handleToggleStoreSelection = (storeId: string) => {
      setSelectedStoreIds(prev => 
          prev.includes(storeId) ? prev.filter(id => id !== storeId) : [...prev, storeId]
      );
  };

  const handleValidateOrder = (e: React.MouseEvent, cota: Cota) => {
      e.preventDefault();
      e.stopPropagation(); // Critical: Prevent event bubbling
      
      if (onUpdateCota) {
          // Create a completely new object reference to ensure React detects the state change
          const updatedCota: Cota = { 
              ...cota, 
              status: 'validated' 
          };
          onUpdateCota(updatedCota);
          
          if (onLogAction) {
              onLogAction('VALIDATE_ORDER', `Validou pedido: ${cota.brand} (${formatCurrency(cota.totalValue)})`);
          }
      }
  };

  const handleReactivateOrder = (cota: Cota) => {
      if (onUpdateCota) {
          // Explicitly set back to pending, preserving storeId
          const updatedCota: Cota = {
              ...cota,
              status: 'pending'
          };
          onUpdateCota(updatedCota);
          if (onLogAction) onLogAction('VALIDATE_ORDER', `Reativou pedido: ${cota.brand}`);
      }
  };

  // Updated to accept targetRole - simplified signature
  const handleAdd = (targetRole: UserRole) => {
      if (selectedStoreIds.length === 0) {
          alert("Selecione pelo menos uma loja para lançar a cota.");
          return;
      }

      // Check for Missing Budgets FIRST
      const storesWithoutBudget = selectedStoreIds.filter(id => {
          const info = getBudgetInfo(id);
          return info.value <= 0;
      });

      if (storesWithoutBudget.length > 0) {
          const storeNumbers = storesWithoutBudget.map(id => {
              const s = activeStores.find(st => st.id === id);
              return s ? s.number : id;
          }).join(', ');

          // Custom Alert Message as requested
          alert(`( Alerta ) o sistema não consegue cadastrar o pedido pois a loja ( ${storeNumbers} ) encontra-se sem cota cadastrada.`);
          return;
      }

      const numValue = parseFloat(newCota.value.replace(/\./g, '').replace(',', '.'));
      if (!newCota.brand || isNaN(numValue) || numValue <= 0) {
          alert("Preencha a marca e um valor válido.");
          return;
      }

      // --- FINANCIAL VALIDATION ---
      const installmentsToCheck = calculateInstallments(numValue, newCota.shipmentDate, newCota.paymentTerms);
      let warningMessages: string[] = [];
      let isBlocked = false;

      for (const storeId of selectedStoreIds) {
          const store = activeStores.find(s => s.id === storeId);
          const storeName = store ? `Loja ${store.number}` : storeId;
          const storeBudgetInfo = getBudgetInfo(storeId);
          const totalBudget = storeBudgetInfo.value;

          for (const inst of installmentsToCheck) {
              const month = inst.month;
              
              // 1. Calculate Current Usage for this Month/Store (Existing Orders + Debts)
              const existingOrdersVal = cotas
                  .filter(c => c.storeId === storeId)
                  .reduce((acc, c) => {
                      const cInst = c.installments.find(i => i.month === month);
                      return acc + (cInst ? cInst.value : 0);
                  }, 0);
              
              const debtVal = debtForecasts[storeId]?.[month] || 0;
              const currentUsage = existingOrdersVal + debtVal;
              
              // 2. Calculate New Projected Usage
              const newUsage = currentUsage + inst.value;
              const balance = totalBudget - newUsage;
              const negativeLimit = totalBudget * 0.10; // 10% of budget

              // 3. BLOCKING CONDITION: Exceeds Budget + 10% tolerance
              if (totalBudget > 0 && newUsage > (totalBudget + negativeLimit)) {
                  alert(`⛔ BLOQUEADO: O lançamento excede o limite de 10% negativo.\n\n${storeName} - Mês: ${month}\nCota: ${formatCurrency(totalBudget)}\nUso Projetado: ${formatCurrency(newUsage)}\nSaldo Final: ${formatCurrency(balance)}\n\nO sistema não permite exceder 10% do valor da cota negativamente.`);
                  isBlocked = true;
                  break; 
              }

              // 4. WARNING CONDITION
              if (balance < 0) {
                  warningMessages.push(`${storeName} (${month}): Saldo ficará negativo em ${formatCurrency(balance)} (Cota: ${formatCurrency(totalBudget)})`);
              }
          }
          if (isBlocked) break;
      }

      if (isBlocked) return;

      if (warningMessages.length > 0) {
          const confirmMsg = `⚠️ ATENÇÃO: O saldo ficará NEGATIVO com este lançamento:\n\n${warningMessages.join('\n')}\n\nDeseja continuar mesmo assim?`;
          if (!window.confirm(confirmMsg)) {
              return; // User cancelled
          }
      }
      // --- END VALIDATION ---

      // Create one entry per selected store
      selectedStoreIds.forEach(storeId => {
          const installments = calculateInstallments(numValue, newCota.shipmentDate, newCota.paymentTerms);
          
          const cota: Cota = {
              id: `cota-${Date.now()}-${Math.random()}`,
              storeId: storeId,
              brand: newCota.brand,
              classification: newCota.classification,
              totalValue: numValue,
              shipmentDate: newCota.shipmentDate,
              paymentTerms: newCota.paymentTerms,
              pairs: parseInt(newCota.pairs) || 0,
              installments: installments,
              createdAt: new Date(),
              createdByRole: targetRole, // Use the role passed from the button to properly tag the order
              status: 'pending' // Default status
          };
          onAddCota(cota);
      });
      
      // Reset form (keep date)
      setNewCota(prev => ({
          ...prev,
          brand: '',
          classification: '',
          value: '',
          pairs: '',
          paymentTerms: '90/120/150' // Reset to default
      }));
      setSelectedStoreIds([]); 
      alert(`${selectedStoreIds.length} lançamento(s) realizado(s) com sucesso na cota de ${targetRole === UserRole.MANAGER ? 'GERENTE' : 'COMPRADOR'}!`);
  };

  const handleSaveBudget = () => {
      const val = parseFloat(budgetForm.value.replace(/\./g, '').replace(',', '.'));
      if (budgetForm.storeId && !isNaN(val)) {
          setStoreBudgets(prev => ({
              ...prev,
              [budgetForm.storeId]: {
                  value: val,
                  managerPercent: budgetForm.managerPercent
              }
          }));
          setIsBudgetModalOpen(false);
          // Reset form to first store default
          setBudgetForm({ storeId: activeStores[0]?.id || '', value: '', managerPercent: 30 });
      }
  };

  const handleOpenDebtModal = () => {
      setReferenceDate(new Date());
      const initialStoreId = selectedStoreFilter !== 'all' ? selectedStoreFilter : activeStores[0]?.id || '';
      setDebtFormStoreId(initialStoreId);
      
      const months = [];
      const current = new Date(); 
      current.setDate(1); 
      for (let i = 0; i < 12; i++) {
          const y = current.getFullYear();
          const m = String(current.getMonth() + 1).padStart(2, '0');
          months.push(`${y}-${m}`);
          current.setMonth(current.getMonth() + 1);
      }

      const existingDebts = debtForecasts[initialStoreId] || {};
      const initialTemp: Record<string, string> = {};
      months.forEach(m => {
          initialTemp[m] = existingDebts[m] ? existingDebts[m].toFixed(2).replace('.', ',') : '';
      });
      setTempDebts(initialTemp);
      
      setIsDebtModalOpen(true);
  };

  const handleStoreChangeInDebtModal = (newStoreId: string) => {
      setDebtFormStoreId(newStoreId);
      const existingDebts = debtForecasts[newStoreId] || {};
      const initialTemp: Record<string, string> = {};
      tableMonths.forEach(m => {
          initialTemp[m] = existingDebts[m] ? existingDebts[m].toFixed(2).replace('.', ',') : '';
      });
      setTempDebts(initialTemp);
  };

  const handleSaveDebts = () => {
      const cleanDebts: Record<string, number> = {};
      Object.entries(tempDebts).forEach(([month, valStr]) => {
          // Explicit cast to string to satisfy TS
          const val = parseFloat((valStr as string).replace(/\./g, '').replace(',', '.'));
          if (!isNaN(val) && val > 0) {
              cleanDebts[month] = val;
          }
      });

      setDebtForecasts(prev => ({
          ...prev,
          [debtFormStoreId]: cleanDebts
      }));
      setIsDebtModalOpen(false);
  };

  // --- FILTERED DATA CALCULATIONS ---

  // Calculate the "Effective Scope" - if specific filter is set, use it, otherwise use TAB
  const effectiveStoreId = useMemo(() => {
      if (selectedStoreFilter !== 'all') return selectedStoreFilter;
      return activeTab; // Tabs are now mandatory store selectors, 'overview' removed
  }, [selectedStoreFilter, activeTab]);

  const filteredCotas = useMemo(() => {
      let data = cotas;
      
      // 1. Filter by Store
      if (effectiveStoreId) {
          data = cotas.filter(c => c.storeId === effectiveStoreId);
      } else {
          // Fallback if no tab/store selected (shouldn't happen with default logic)
          return [];
      }
      
      // SORT: Manager first, then Admin. Secondary sort by Date (Newest first)
      return data.sort((a, b) => {
          // Priority to MANAGER
          const roleA = a.createdByRole === UserRole.MANAGER ? 0 : 1;
          const roleB = b.createdByRole === UserRole.MANAGER ? 0 : 1;
          
          if (roleA !== roleB) return roleA - roleB;
          
          // Then Date Descending
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
  }, [cotas, effectiveStoreId]); 

  // Split into Pending (List) and Validated (Hidden/Summary)
  // Logic: Items in the Main List MUST be pending.
  const pendingCotas = useMemo(() => filteredCotas.filter(c => !c.status || c.status === 'pending'), [filteredCotas]);
  
  // Logic: Items in the Summary Line MUST be validated.
  const validatedCotas = useMemo(() => filteredCotas.filter(c => c.status === 'validated'), [filteredCotas]);

  // Data specifically for the "Recebidos" Modal
  // FIXED: This now respects the `effectiveStoreId` strictly.
  // This means the modal will only show items for the STORE CURRENTLY BEING VIEWED in the tab.
  const modalValidatedCotas = useMemo(() => {
      let data = cotas.filter(c => c.status === 'validated');

      // Strict filter by the currently active store scope
      if (effectiveStoreId) {
          data = data.filter(c => c.storeId === effectiveStoreId);
      }

      // Sort by latest
      return data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [cotas, effectiveStoreId]);

  // STACKED CHART DATA PREPARATION
  const { chartData, subCategoryKeys } = useMemo(() => {
      // Use filteredCotas (both pending and validated) to show total volume per category.
      const dataMap: Record<string, Record<string, number>> = {
          'Feminino': { total: 0 },
          'Masculino': { total: 0 },
          'Infantil': { total: 0 },
          'Acessórios': { total: 0 }
      };

      const keysSet = new Set<string>();

      filteredCotas.forEach(c => {
          // c.classification format: "Group - SubGroup" (e.g. "Feminino - Sandália")
          const parts = c.classification.split(' - ');
          const rootCategory = parts[0];
          const subCategory = parts[1] || 'Geral';

          if (dataMap[rootCategory]) {
              // Accumulate value for specific sub-category
              dataMap[rootCategory][subCategory] = (dataMap[rootCategory][subCategory] || 0) + c.totalValue;
              // Accumulate total for sorting/scaling if needed
              dataMap[rootCategory].total += c.totalValue;
              
              keysSet.add(subCategory);
          }
      });

      // Convert map to array for Recharts
      const finalData = Object.entries(dataMap).map(([name, values]) => ({
          name,
          ...values,
          totalValue: values.total // Added explicit total for the label line
      }));

      return {
          chartData: finalData,
          subCategoryKeys: Array.from(keysSet).sort()
      };
  }, [filteredCotas]);

  const getMonthTotalPendingOrders = (month: string) => {
      return pendingCotas.reduce((acc, c) => {
          const inst = c.installments.find(i => i.month === month);
          return acc + (inst ? inst.value : 0);
      }, 0);
  };

  const getMonthTotalValidatedOrders = (month: string) => {
      return validatedCotas.reduce((acc, c) => {
          const inst = c.installments.find(i => i.month === month);
          return acc + (inst ? inst.value : 0);
      }, 0);
  };

  // Calculate Aggregated Budgets considering individual splits
  const getMonthBudgetSplit = () => {
      const info = getBudgetInfo(effectiveStoreId);
      const managerVal = info.value * (info.managerPercent / 100);
      const buyerVal = info.value - managerVal;
      return { manager: managerVal, buyer: buyerVal, total: info.value };
  };

  const budgetSplit = getMonthBudgetSplit();

  const getMonthDebt = (month: string) => {
      return debtForecasts[effectiveStoreId]?.[month] || 0;
  };

  return (
    <div className="p-4 md:p-8 max-w-[1800px] mx-auto space-y-8">
        
        {/* HEADER & FILTER */}
        <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 border-b border-gray-200 pb-6">
            <div>
                <h2 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
                    <Calculator className="text-blue-600" size={32} />
                    Gestão de Cotas e Pedidos
                </h2>
                <p className="text-gray-500 mt-1">Controle de compras futuras com divisão Gerente/Comprador.</p>
            </div>

            <div className="flex flex-wrap gap-3 items-center w-full xl:w-auto">
                <div className="bg-white border border-gray-300 rounded-lg p-2 flex items-center gap-2 shadow-sm flex-1 xl:flex-none">
                    <Filter size={18} className="text-gray-500 ml-1" />
                    <span className="text-sm font-bold text-gray-700 whitespace-nowrap">Filtro Global:</span>
                    <select 
                        value={selectedStoreFilter}
                        onChange={(e) => setSelectedStoreFilter(e.target.value)}
                        className="bg-transparent text-sm font-medium outline-none text-blue-700 cursor-pointer w-full min-w-[150px]"
                    >
                        {!isManager && <option value="all">Todas as Lojas</option>}
                        {activeStores.map(s => (
                            <option key={s.id} value={s.id}>{s.number} - {s.name}</option>
                        ))}
                    </select>
                </div>

                {!isManager && (
                    <>
                        <button 
                            onClick={() => {
                                const storeId = effectiveStoreId; // Use current effective store
                                const currentInfo = getBudgetInfo(storeId);
                                setBudgetForm({ 
                                    storeId: storeId, 
                                    value: currentInfo.value > 0 ? currentInfo.value.toString() : '',
                                    managerPercent: currentInfo.managerPercent
                                });
                                setIsBudgetModalOpen(true);
                            }}
                            className="flex items-center gap-2 bg-yellow-500 text-white px-4 py-2.5 rounded-lg hover:bg-yellow-600 transition-colors shadow-sm font-bold text-sm whitespace-nowrap"
                        >
                            <Settings size={18} />
                            Definir Cota
                        </button>

                        <button 
                            onClick={handleOpenDebtModal}
                            className="flex items-center gap-2 bg-red-500 text-white px-4 py-2.5 rounded-lg hover:bg-red-600 transition-colors shadow-sm font-bold text-sm whitespace-nowrap"
                        >
                            <Wallet size={18} />
                            Lançar Dívidas
                        </button>

                        <button 
                            onClick={() => setIsReceivedModalOpen(true)}
                            className="flex items-center gap-2 bg-gray-700 text-white px-4 py-2.5 rounded-lg hover:bg-gray-800 transition-colors shadow-sm font-bold text-sm whitespace-nowrap"
                        >
                            <PackageCheck size={18} />
                            Recebidos
                        </button>
                    </>
                )}
            </div>
        </div>

        {/* INPUT FORM - Hidden for Managers (Only Admins can launch on behalf of anyone) */}
        {!isManager && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-blue-600"></div>
                <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider mb-4 border-b pb-2 flex items-center gap-2">
                    <Plus size={16} className="text-blue-600"/> Inclusão de Pedido (Projeção) - <span className="text-blue-800 bg-blue-100 px-2 rounded">Acesso: {user.role === UserRole.ADMIN ? 'Comprador' : 'Gerente'}</span>
                </h3>
                
                <form className="flex flex-col gap-6" onSubmit={(e) => e.preventDefault()}>
                    <div className="grid grid-cols-1 md:grid-cols-6 gap-4 items-start">
                        
                        {/* Multi-Store Selector */}
                        <div className="md:col-span-2">
                            <label className="block text-xs font-semibold text-gray-500 mb-2">Selecione as Lojas (Múltipla Escolha)</label>
                            <div className="border border-gray-300 rounded-lg p-2 h-32 overflow-y-auto bg-gray-50 space-y-1">
                                {activeStores.map(s => {
                                    const isSelected = selectedStoreIds.includes(s.id);
                                    return (
                                        <div 
                                            key={s.id} 
                                            onClick={() => handleToggleStoreSelection(s.id)}
                                            className={`flex items-center gap-2 p-2 rounded cursor-pointer text-xs transition-colors ${isSelected ? 'bg-blue-100 text-blue-800' : 'hover:bg-gray-100 text-gray-600'}`}
                                        >
                                            {isSelected ? <CheckSquare size={16} className="text-blue-600"/> : <Square size={16} className="text-gray-400"/>}
                                            <span className="font-medium">Loja {s.number} - {s.city}</span>
                                        </div>
                                    );
                                })}
                            </div>
                            <p className="text-[10px] text-gray-400 mt-1 text-right">{selectedStoreIds.length} loja(s) selecionada(s)</p>
                        </div>

                        {/* Inputs */}
                        <div className="md:col-span-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="col-span-2 md:col-span-1">
                                <label className="block text-xs font-semibold text-gray-500 mb-1">Marca</label>
                                <input 
                                    required
                                    list="brand-list"
                                    value={newCota.brand}
                                    onChange={e => setNewCota({...newCota, brand: e.target.value})}
                                    placeholder="Ex: Vizzano"
                                    className="w-full p-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                                <datalist id="brand-list">
                                    {uniqueBrands.map(b => <option key={b} value={b} />)}
                                </datalist>
                            </div>
                            <div className="col-span-2 md:col-span-1">
                                <label className="block text-xs font-semibold text-gray-500 mb-1">Classificação</label>
                                <div className="relative">
                                    <select
                                        value={newCota.classification}
                                        onChange={e => setNewCota({...newCota, classification: e.target.value})}
                                        className="w-full p-3 border-2 border-gray-300 rounded-lg text-sm font-bold text-gray-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white cursor-pointer appearance-none shadow-sm hover:border-blue-400 transition-colors"
                                    >
                                        <option value="" className="text-gray-400 font-normal">Selecione...</option>
                                        {Object.entries(CLASSIFICATION_OPTIONS).map(([group, options]) => (
                                            <optgroup key={group} label={group} className="font-bold text-blue-800 bg-gray-50">
                                                {options.map(opt => (
                                                    <option key={`${group}-${opt}`} value={`${group} - ${opt}`} className="text-gray-700 font-medium bg-white pl-4">
                                                        {group} {opt}
                                                    </option>
                                                ))}
                                            </optgroup>
                                        ))}
                                    </select>
                                    <div className="absolute right-3 top-3.5 pointer-events-none text-gray-500">
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                                    </div>
                                </div>
                            </div>
                            <div className="col-span-1">
                                <label className="block text-xs font-semibold text-gray-500 mb-1">Embarque</label>
                                <input 
                                    type="month"
                                    required
                                    value={newCota.shipmentDate}
                                    onChange={e => setNewCota({...newCota, shipmentDate: e.target.value})}
                                    className="w-full p-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>
                            <div className="col-span-1">
                                <label className="block text-xs font-semibold text-gray-500 mb-1">Prazo (Dias)</label>
                                <input 
                                    required
                                    value={newCota.paymentTerms}
                                    onChange={e => setNewCota({...newCota, paymentTerms: e.target.value})}
                                    placeholder="90/120/150"
                                    className="w-full p-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>
                            <div className="col-span-1">
                                <label className="block text-xs font-semibold text-gray-500 mb-1">Pares</label>
                                <input 
                                    type="number"
                                    value={newCota.pairs}
                                    onChange={e => setNewCota({...newCota, pairs: e.target.value})}
                                    placeholder="0"
                                    className="w-full p-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>
                            <div className="col-span-1">
                                <label className="block text-xs font-bold text-blue-900 mb-1">Valor Total (R$)</label>
                                <input 
                                    required
                                    value={newCota.value}
                                    onChange={e => setNewCota({...newCota, value: e.target.value})}
                                    placeholder="0,00"
                                    className="w-full p-2.5 border-2 border-blue-300 bg-blue-50/50 rounded-lg text-2xl font-black text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>
                            <div className="col-span-2 flex gap-3 items-end">
                                <button 
                                    type="button"
                                    onClick={() => handleAdd(UserRole.ADMIN)}
                                    className="flex-1 bg-blue-700 hover:bg-blue-800 text-white font-bold py-2.5 rounded-lg shadow-md transition-colors flex items-center justify-center gap-2 text-xs"
                                >
                                    <Briefcase size={16} /> Lançar na Cota Comprador
                                </button>
                                <button 
                                    type="button"
                                    onClick={() => handleAdd(UserRole.MANAGER)}
                                    className="flex-1 bg-purple-600 hover:bg-purple-700 text-white font-bold py-2.5 rounded-lg shadow-md transition-colors flex items-center justify-center gap-2 text-xs"
                                >
                                    <UserCheck size={16} /> Lançar na Cota Gerente
                                </button>
                            </div>
                        </div>
                    </div>
                </form>
            </div>
        )}

        {/* STORE TABS (Mandatory Selection) */}
        {selectedStoreFilter === 'all' && (
            <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-gray-200">
                {/* REMOVED VISÃO GERAL BUTTON */}
                {activeStores.map(store => (
                    <button
                        key={store.id}
                        onClick={() => setActiveTab(store.id)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-t-lg font-bold text-sm transition-all whitespace-nowrap ${
                            activeTab === store.id
                            ? 'bg-green-100 border-x border-t border-green-200 text-green-800 shadow-sm relative -mb-[1px] z-10' 
                            : 'bg-gray-50 text-gray-500 hover:bg-gray-100 hover:text-gray-700'
                        }`}
                    >
                        <StoreIcon size={16} /> Loja {store.number}
                    </button>
                ))}
            </div>
        )}

        {/* PROJECTION TABLE */}
        <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden flex flex-col rounded-tl-none min-h-[500px]">
            <div className="overflow-x-auto pb-4">
                <table className="w-full border-collapse text-sm min-w-[1200px] table-fixed">
                    <thead>
                        {/* 1. Header Months - Optimized for Visual */}
                        <tr className="bg-gray-800 text-white uppercase text-xs tracking-wider">
                            <th className="p-3 border-r border-gray-700 text-left w-[250px] sticky left-0 bg-gray-800 z-20">Detalhes</th>
                            <th className="p-3 border-r border-gray-700 text-center w-[100px]">Total</th>
                            <th className="p-3 border-r border-gray-700 text-center w-[80px]">Mês Emb.</th>
                            
                            {tableMonths.map(month => {
                                const [y, m] = month.split('-');
                                const date = new Date(parseInt(y), parseInt(m)-1, 1);
                                const monthName = date.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
                                return (
                                    <th key={month} className="p-2 border-r border-gray-700 text-center w-[100px]">
                                        <div className="flex flex-col items-center leading-tight">
                                            <span className="text-sm font-bold">{monthName.charAt(0).toUpperCase() + monthName.slice(1)}</span>
                                            <span className="text-[10px] text-gray-400 font-normal">{y}</span>
                                        </div>
                                    </th>
                                );
                            })}
                            <th className="p-3 w-16 text-center">Ações</th>
                        </tr>
                    </thead>
                    
                    {/* KEY PROP ADDED TO TBODY TO TRIGGER ANIMATION ON TAB CHANGE */}
                    <tbody key={`summary-${activeTab}`} className="divide-y divide-gray-100 bg-white animate-in fade-in slide-in-from-bottom-2 duration-300">
                        
                        {/* 2a. Budget Row (Buyer) */}
                        <tr className="bg-blue-50/50 text-blue-900 border-b border-blue-100 shadow-sm relative z-10">
                            <td className="p-3 border-r border-blue-100 font-bold sticky left-0 bg-[#f0f9ff] z-10 flex items-center justify-between text-xs">
                                <span>COTA COMPRADOR ({(100 - (getBudgetInfo(effectiveStoreId)?.managerPercent || 30))}%)</span>
                                <Briefcase size={14} className="text-blue-600"/>
                            </td>
                            <td className="p-3 border-r border-blue-100 text-center text-[10px] text-blue-700 font-medium">FIXO</td>
                            <td className="p-3 border-r border-blue-100"></td>
                            {tableMonths.map(month => (
                                <td key={`bud-b-${month}`} className="p-3 text-center border-r border-blue-100 font-bold text-blue-800 text-xs">
                                    {formatCurrency(budgetSplit.buyer)}
                                </td>
                            ))}
                            <td></td>
                        </tr>

                        {/* 2b. Budget Row (Manager) */}
                        <tr className="bg-purple-50/50 text-purple-900 border-b border-purple-100 shadow-sm relative z-10">
                            <td className="p-3 border-r border-purple-100 font-bold sticky left-0 bg-[#faf5ff] z-10 flex items-center justify-between text-xs">
                                <span>COTA GERENTE ({(getBudgetInfo(effectiveStoreId)?.managerPercent || 30)}%)</span>
                                <UserCheck size={14} className="text-purple-600"/>
                            </td>
                            <td className="p-3 border-r border-purple-100 text-center text-[10px] text-purple-700 font-medium">FIXO</td>
                            <td className="p-3 border-r border-purple-100"></td>
                            {tableMonths.map(month => (
                                <td key={`bud-m-${month}`} className="p-3 text-center border-r border-purple-100 font-bold text-purple-800 text-xs">
                                    {formatCurrency(budgetSplit.manager)}
                                </td>
                            ))}
                            <td></td>
                        </tr>

                        {/* 3. Previsão de Dívida Row (Shared) */}
                        <tr className="bg-red-50 text-red-900 border-b border-red-200 font-semibold relative z-10">
                            <td className="p-3 border-r border-red-200 font-bold sticky left-0 bg-red-50 z-10 flex items-center justify-between text-xs">
                                <span>PREVISÃO DE DÍVIDA</span>
                                <TrendingDown size={14} className="text-red-600"/>
                            </td>
                            <td className="p-3 border-r border-red-200 text-center text-[10px] text-red-700">-</td>
                            <td className="p-3 border-r border-red-200"></td>
                            {tableMonths.map(month => {
                                const debt = getMonthDebt(month);
                                return (
                                    <td key={`debt-${month}`} className="p-3 text-center border-r border-red-200 font-bold text-red-700 text-xs">
                                        {debt > 0 ? `(${formatCurrency(debt)})` : '-'}
                                    </td>
                                );
                            })}
                            <td></td>
                        </tr>

                        {/* 4. Pedidos Recebidos/Cadastrados (Aggregated Validated Orders) */}
                        <tr className="bg-green-100 text-green-900 border-b border-green-200 font-semibold relative z-10 border-t-2 border-t-green-300">
                            <td className="p-3 border-r border-green-200 font-bold sticky left-0 bg-green-100 z-10 flex items-center justify-between text-xs">
                                <span>PEDIDOS CADASTRADOS</span>
                                <CheckCircle size={14} className="text-green-700"/>
                            </td>
                            <td className="p-3 border-r border-green-200 text-center text-[10px] text-green-800">
                                {formatCurrency(validatedCotas.reduce((a,b) => a + b.totalValue, 0))}
                            </td>
                            <td className="p-3 border-r border-green-200"></td>
                            {tableMonths.map(month => {
                                const val = getMonthTotalValidatedOrders(month);
                                return (
                                    <td key={`val-${month}`} className="p-3 text-center border-r border-green-200 font-bold text-green-800 text-xs">
                                        {val > 0 ? `(${formatCurrency(val)})` : '-'}
                                    </td>
                                );
                            })}
                            <td></td>
                        </tr>

                        {/* 5. Total Orders (Pending) Row */}
                        <tr className="bg-gray-100 text-gray-900 border-b border-gray-200 font-semibold">
                            <td className="p-3 border-r border-gray-200 sticky left-0 bg-gray-100 z-10 text-xs">PEDIDOS PENDENTES (PROJEÇÃO)</td>
                            <td className="p-3 border-r border-gray-200 text-center font-bold text-xs">
                                {formatCurrency(pendingCotas.reduce((a,b) => a + b.totalValue, 0))}
                            </td>
                            <td className="p-3 border-r border-gray-200"></td>
                            {tableMonths.map(month => (
                                <td key={`tot-${month}`} className="p-3 text-center border-r border-gray-200 font-bold text-xs">
                                    {formatCurrency(getMonthTotalPendingOrders(month))}
                                </td>
                            ))}
                            <td></td>
                        </tr>

                        {/* 6. Balance Row (Saldo) */}
                        <tr className="bg-gray-800 text-white border-b border-gray-700 font-bold italic">
                            <td className="p-3 border-r border-gray-700 sticky left-0 bg-gray-800 z-10 text-xs">SALDO DISPONÍVEL (GERAL)</td>
                            <td className="p-3 border-r border-gray-700 text-center text-[10px] text-gray-400">-</td>
                            <td className="p-3 border-r border-gray-700"></td>
                            {tableMonths.map(month => {
                                const totalPendingOrders = getMonthTotalPendingOrders(month);
                                const totalValidatedOrders = getMonthTotalValidatedOrders(month);
                                const debt = getMonthDebt(month);
                                
                                // Balance combines Budget - Debt - Validated - Pending
                                const balance = budgetSplit.total - debt - totalValidatedOrders - totalPendingOrders;
                                const isNegative = balance < 0;
                                return (
                                    <td key={`bal-${month}`} className={`p-3 text-center border-r border-gray-700 text-xs ${isNegative ? 'text-red-400' : 'text-green-400'}`}>
                                        {formatCurrency(balance)}
                                    </td>
                                );
                            })}
                            <td></td>
                        </tr>

                        {/* DATA ROWS (Pending Orders Only) */}
                        {pendingCotas.map(cota => {
                            const store = stores.find(s => s.id === cota.storeId);
                            const shipVisual = formatMonthHeader(cota.shipmentDate);
                            
                            // Check Role for Styling
                            const isManagerRow = cota.createdByRole === UserRole.MANAGER;
                            const rowBg = isManagerRow ? 'bg-purple-50/60' : 'bg-white';
                            const stickyBg = isManagerRow ? 'bg-[#fcfaff]' : 'bg-white'; // Slightly different for sticky to cover

                            return (
                                <tr key={cota.id} className={`${rowBg} hover:bg-gray-100 transition-colors group border-b border-gray-100`}>
                                    <td className={`p-3 border-r border-gray-100 sticky left-0 ${stickyBg} group-hover:bg-gray-100 z-10 border-l-4 ${isManagerRow ? 'border-l-purple-400' : 'border-l-transparent'}`}>
                                        <div className="font-bold text-gray-800 text-xs flex items-center gap-2" title={cota.brand}>
                                            {isManagerRow ? (
                                                <span title="Lançado por Gerente" className="inline-flex">
                                                    <UserCheck size={14} className="text-purple-600 min-w-[14px]" />
                                                </span>
                                            ) : (
                                                <span title="Lançado por Comprador" className="inline-flex">
                                                    <Briefcase size={14} className="text-blue-600 min-w-[14px]" />
                                                </span>
                                            )}
                                            <span className="truncate">{cota.brand}</span>
                                        </div>
                                        <div className="text-[10px] text-gray-600 mt-1 whitespace-normal break-words leading-tight">
                                            {cota.classification}
                                        </div>
                                        {(selectedStoreFilter === 'all' && activeTab === 'overview') && (
                                            <div className="text-[9px] text-blue-600 font-mono mt-1">Loja {store?.number}</div>
                                        )}
                                    </td>
                                    <td className="p-3 text-center font-medium text-gray-900 border-r border-gray-100 text-[10px]">
                                        {formatCurrency(cota.totalValue)}
                                    </td>
                                    <td className="p-3 text-center text-gray-600 border-r border-gray-100">
                                        <span className="bg-blue-50 text-blue-800 px-2 py-1 rounded text-[10px] font-bold whitespace-nowrap">{shipVisual}</span>
                                    </td>

                                    {tableMonths.map(month => {
                                        const payment = cota.installments.find(i => i.month === month);
                                        return (
                                            <td key={`${cota.id}-${month}`} className={`p-3 text-center border-r border-gray-100 text-[10px] ${payment ? (isManagerRow ? 'bg-purple-100 text-purple-800 font-medium' : 'bg-green-50 text-green-700 font-medium') : 'text-gray-300'}`}>
                                                {payment ? formatCurrency(payment.value) : '-'}
                                            </td>
                                        );
                                    })}
                                    
                                    <td className="p-3 text-center">
                                        <div className="flex items-center justify-center gap-2">
                                            {!isManager && (
                                                <>
                                                    <button 
                                                        onClick={(e) => handleValidateOrder(e, cota)}
                                                        className="text-green-500 hover:text-green-700 hover:bg-green-50 rounded p-1.5 transition-colors shadow-sm border border-transparent hover:border-green-200 transform active:scale-95"
                                                        title="Validar Pedido (Mover para Recebidos)"
                                                    >
                                                        <CheckCircle size={18} />
                                                    </button>
                                                    <button 
                                                        onClick={() => onDeleteCota(cota.id)}
                                                        className="text-gray-400 hover:text-red-500 hover:bg-red-50 rounded p-1.5 transition-colors shadow-sm border border-transparent hover:border-red-200"
                                                        title="Excluir Pedido"
                                                    >
                                                        <Trash2 size={18} />
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                        {pendingCotas.length === 0 && (
                            <tr>
                                <td colSpan={5 + tableMonths.length} className="p-12 text-center text-gray-400 text-sm">
                                    Nenhum pedido pendente encontrado para o filtro selecionado.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>

        {/* CATEGORY BREAKDOWN CHART (Vertical Stacked Bars - Moved below table) */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                    <BarChart2 size={20} className="text-blue-600" />
                    Resumo por Categoria
                </h3>
            </div>
            <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart 
                        data={chartData} 
                        margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                        barSize={60}
                    >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="name" fontSize={12} fontWeight="bold" />
                        <YAxis tickFormatter={(val) => `R$${val/1000}k`} fontSize={12} />
                        <Tooltip 
                            formatter={(value: number, name: string) => [formatCurrency(value), name === 'totalValue' ? 'Total' : name]}
                            cursor={{ fill: 'rgba(0,0,0,0.05)' }}
                        />
                        <Legend />
                        
                        {/* Dynamically create bars for each sub-category */}
                        {subCategoryKeys.map((key, index) => (
                            <Bar 
                                key={key} 
                                dataKey={key} 
                                stackId="a" 
                                fill={STACK_COLORS[index % STACK_COLORS.length]} 
                            />
                        ))}

                        {/* Invisible line to hold the Total Label on top of the stack */}
                        <Line type="monotone" dataKey="totalValue" stroke="none" isAnimationActive={false}>
                            <LabelList 
                                dataKey="totalValue" 
                                position="top" 
                                formatter={(value: number) => formatCurrency(value)} 
                                style={{ fontWeight: 'bold', fontSize: '12px', fill: '#374151' }}
                            />
                        </Line>
                    </ComposedChart>
                </ResponsiveContainer>
            </div>
            <p className="text-[10px] text-gray-400 text-center mt-2">Distribuição detalhada de classificações por categoria.</p>
        </div>

        {/* BUDGET MODAL */}
        {isBudgetModalOpen && (
            <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
                <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in duration-200">
                    <div className="bg-yellow-400 p-4 flex justify-between items-center">
                        <h3 className="text-yellow-900 font-bold text-lg flex items-center gap-2">
                            <Settings size={20} /> Definir Cota Mensal
                        </h3>
                        <button onClick={() => setIsBudgetModalOpen(false)} className="text-yellow-800 hover:text-white transition-colors">
                            <X size={20} />
                        </button>
                    </div>
                    <div className="p-6 space-y-5">
                        <p className="text-sm text-gray-600 leading-relaxed">
                            Defina o valor total e a distribuição percentual entre Comprador e Gerente.
                        </p>
                        
                        <div>
                            <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Selecione a Loja</label>
                            <div className="relative">
                                <select 
                                    value={budgetForm.storeId}
                                    onChange={e => {
                                        const newId = e.target.value;
                                        const info = getBudgetInfo(newId);
                                        setBudgetForm({
                                            storeId: newId,
                                            value: info.value > 0 ? info.value.toString() : '',
                                            managerPercent: info.managerPercent
                                        });
                                    }}
                                    className="w-full p-3 border border-gray-300 rounded-lg text-gray-900 font-bold focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 outline-none bg-white appearance-none cursor-pointer"
                                >
                                    {activeStores.map(s => (
                                        <option key={s.id} value={s.id} className="text-gray-900">
                                            {s.number} - {s.name}
                                        </option>
                                    ))}
                                </select>
                                <div className="absolute right-3 top-3.5 pointer-events-none text-gray-500">
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                                </div>
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Valor Total da Cota (R$)</label>
                            <div className="relative">
                                <span className="absolute left-3 top-3 text-gray-400 font-bold">R$</span>
                                <input 
                                    value={budgetForm.value}
                                    onChange={e => setBudgetForm({...budgetForm, value: e.target.value})}
                                    placeholder="0,00"
                                    className="w-full pl-10 p-3 border border-gray-300 rounded-lg text-xl font-bold text-gray-800 focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 outline-none"
                                />
                            </div>
                        </div>

                        <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                            <div className="flex justify-between text-xs font-bold text-gray-500 mb-2">
                                <span>COMPRADOR ({(100 - budgetForm.managerPercent)}%)</span>
                                <span>GERENTE ({budgetForm.managerPercent}%)</span>
                            </div>
                            <input 
                                type="range" 
                                min="0" 
                                max="100" 
                                step="5"
                                value={budgetForm.managerPercent}
                                onChange={e => setBudgetForm({...budgetForm, managerPercent: parseInt(e.target.value)})}
                                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-yellow-500"
                            />
                            
                            {/* Preview Calculation */}
                            {budgetForm.value && !isNaN(parseFloat(budgetForm.value)) && (
                                <div className="flex justify-between mt-3 text-xs font-medium">
                                    <div className="text-blue-700">
                                        {formatCurrency(parseFloat(budgetForm.value) * ((100 - budgetForm.managerPercent)/100))}
                                    </div>
                                    <div className="text-purple-700">
                                        {formatCurrency(parseFloat(budgetForm.value) * (budgetForm.managerPercent/100))}
                                    </div>
                                </div>
                            )}
                        </div>

                        <button 
                            onClick={handleSaveBudget}
                            className="w-full bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-3 rounded-xl shadow-md transition-colors mt-2 text-lg"
                        >
                            Salvar Definições
                        </button>
                    </div>
                </div>
            </div>
        )}

        {/* DEBT MODAL */}
        {isDebtModalOpen && (
            <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
                <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in duration-200 flex flex-col max-h-[90vh]">
                    <div className="bg-red-500 p-4 flex justify-between items-center flex-shrink-0">
                        <h3 className="text-white font-bold text-lg flex items-center gap-2">
                            <Wallet size={20} /> Previsão de Dívidas (Passivo)
                        </h3>
                        <button onClick={() => setIsDebtModalOpen(false)} className="text-red-200 hover:text-white transition-colors">
                            <X size={20} />
                        </button>
                    </div>
                    <div className="p-6 overflow-y-auto">
                        <p className="text-sm text-gray-600 mb-4">
                            Lance os valores de dívida (boletos, aluguel, etc.) para cada mês. Estes valores serão subtraídos do saldo disponível da cota.
                        </p>
                        
                        <div className="mb-4">
                            <label className="block text-xs font-bold text-gray-500 mb-1">Loja Selecionada</label>
                            <div className="relative">
                                <select 
                                    value={debtFormStoreId}
                                    onChange={e => handleStoreChangeInDebtModal(e.target.value)}
                                    className="w-full p-3 border border-gray-300 rounded-lg text-gray-900 font-bold bg-white outline-none focus:ring-2 focus:ring-red-500 appearance-none cursor-pointer"
                                >
                                    {activeStores.map(s => <option key={s.id} value={s.id}>{s.number} - {s.name}</option>)}
                                </select>
                                <div className="absolute right-3 top-3.5 pointer-events-none text-gray-500">
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                            {tableMonths.map(month => {
                                const [y, m] = month.split('-');
                                const date = new Date(parseInt(y), parseInt(m)-1, 1);
                                const label = date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
                                
                                return (
                                    <div key={month}>
                                        <label className="block text-xs font-bold text-gray-400 mb-1 capitalize">{label}</label>
                                        <div className="relative">
                                            <span className="absolute left-2 top-2 text-gray-400 text-xs">R$</span>
                                            <input 
                                                value={tempDebts[month] || ''}
                                                onChange={e => setTempDebts({...tempDebts, [month]: e.target.value})}
                                                placeholder="0,00"
                                                className="w-full pl-7 pr-2 py-1.5 border border-gray-300 rounded text-sm text-red-700 font-medium focus:border-red-500 focus:ring-1 focus:ring-red-200 outline-none"
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                    <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-2 flex-shrink-0">
                        <button 
                             onClick={() => setIsDebtModalOpen(false)}
                             className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-bold transition-colors"
                        >
                            Cancelar
                        </button>
                        <button 
                            onClick={handleSaveDebts}
                            className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg shadow-md transition-colors"
                        >
                            Salvar Dívidas
                        </button>
                    </div>
                </div>
            </div>
        )}

        {/* RECEIVED ORDERS MODAL */}
        {isReceivedModalOpen && (
            <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
                <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl overflow-hidden animate-in fade-in zoom-in duration-200 flex flex-col max-h-[90vh]">
                    <div className="bg-gray-800 p-4 flex justify-between items-center flex-shrink-0">
                        <h3 className="text-white font-bold text-lg flex items-center gap-2">
                            <PackageCheck size={20} /> Histórico de Pedidos Recebidos
                        </h3>
                        <button onClick={() => setIsReceivedModalOpen(false)} className="text-gray-400 hover:text-white transition-colors">
                            <X size={20} />
                        </button>
                    </div>
                    <div className="p-6 overflow-y-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-gray-100 text-gray-600 font-semibold border-b border-gray-200">
                                <tr>
                                    <th className="p-3">Marca</th>
                                    <th className="p-3">Valor</th>
                                    <th className="p-3">Data Embarque</th>
                                    <th className="p-3 text-center">Status</th>
                                    <th className="p-3 text-right">Ação</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {modalValidatedCotas.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="p-8 text-center text-gray-400">
                                            Nenhum pedido marcado como recebido para a loja atual.
                                        </td>
                                    </tr>
                                ) : (
                                    modalValidatedCotas.map(cota => (
                                        <tr key={cota.id} className="hover:bg-gray-50">
                                            <td className="p-3">
                                                <div className="font-bold text-gray-800">{cota.brand}</div>
                                                <div className="text-xs text-gray-500">{cota.classification}</div>
                                            </td>
                                            <td className="p-3 font-medium text-gray-900">
                                                {formatCurrency(cota.totalValue)}
                                            </td>
                                            <td className="p-3 text-gray-600">
                                                {formatMonthHeader(cota.shipmentDate)}
                                            </td>
                                            <td className="p-3 text-center">
                                                <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-bold">
                                                    VALIDADO
                                                </span>
                                            </td>
                                            <td className="p-3 text-right">
                                                <button 
                                                    onClick={() => handleReactivateOrder(cota)}
                                                    className="flex items-center gap-1 bg-white border border-gray-300 text-gray-700 hover:text-blue-600 hover:border-blue-300 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ml-auto"
                                                >
                                                    <RefreshCcw size={14} /> Reativar
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};

export default CotasManagement;
