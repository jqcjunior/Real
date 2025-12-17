
import React, { useState, useMemo, useEffect } from 'react';
import { Store, User, Cota, CotaPayment, UserRole, SystemLog, CotaSettings, CotaDebt } from '../types';
import { formatCurrency } from '../constants';
import { Calculator, Plus, Save, Trash2, Filter, Settings, CheckSquare, Square, X, AlertCircle, Wallet, TrendingDown, Store as StoreIcon, LayoutGrid, PieChart, UserCheck, Briefcase, Search, BarChart2, CheckCircle, RefreshCcw, PackageCheck, Loader2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend, ComposedChart, Line, LabelList } from 'recharts';

interface CotasManagementProps {
  user: User;
  stores: Store[];
  cotas: Cota[];
  cotaSettings: CotaSettings[]; 
  cotaDebts: CotaDebt[]; 
  onAddCota: (cota: Cota) => Promise<void>;
  onDeleteCota: (id: string) => Promise<void>;
  onUpdateCota?: (cota: Cota) => Promise<void>;
  onSaveSettings: (settings: CotaSettings) => Promise<void>;
  onSaveDebts: (storeId: string, debts: Record<string, number>) => Promise<void>; 
  onLogAction?: (action: SystemLog['action'], details: string) => void;
}

const CLASSIFICATION_OPTIONS = {
  'Feminino': [
    'Birken', 'Bota', 'Casual', 'Chinelo', 'Conforto', 'Esportivo', 'Moda', 'Rasteira', 'Salto', 'Sandália', 'Sapatilha'
  ],
  'Masculino': [
    'Botas', 'Casual', 'Chinelo', 'Esportivo', 'Sandália', 'Sapatênis', 'Sapato Social'
  ],
  'Infantil': [
    'Bebê', 'Esportivo', 'Feminino', 'Masculino', 'Sandália', 'Unissex'
  ],
  'Acessórios': [
    'Bolas', 'Bolsas', 'Bonés', 'Carteiras', 'Cintos', 'Esportivos', 'Malas', 'Material Escolar', 'Meias', 'Mochilas', 'Perfumes', 'Relógios'
  ]
};

const STACK_COLORS = [
    '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', 
    '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1',
    '#14b8a6', '#d946ef', '#e11d48', '#22c55e', '#3b82f6'
];

const CotasManagement: React.FC<CotasManagementProps> = ({ user, stores, cotas, cotaSettings, cotaDebts, onAddCota, onDeleteCota, onUpdateCota, onSaveSettings, onSaveDebts, onLogAction }) => {
  const activeStores = useMemo(() => {
      let filtered = stores.filter(s => s.status === 'active');
      if (user.role === UserRole.MANAGER && user.storeId) {
          filtered = filtered.filter(s => s.id === user.storeId);
      }
      return filtered.sort((a, b) => parseInt(a.number) - parseInt(b.number));
  }, [stores, user]);

  const isManager = user.role === UserRole.MANAGER;
  const [selectedStoreFilter, setSelectedStoreFilter] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<string>('');

  const [isBudgetModalOpen, setIsBudgetModalOpen] = useState(false);
  const [budgetForm, setBudgetForm] = useState({ 
      storeId: '', 
      value: '',
      managerPercent: 30 
  });

  const [isDebtModalOpen, setIsDebtModalOpen] = useState(false);
  const [debtFormStoreId, setDebtFormStoreId] = useState<string>('');
  const [tempDebts, setTempDebts] = useState<Record<string, string>>({}); 
  const [isReceivedModalOpen, setIsReceivedModalOpen] = useState(false);

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
      shipmentDate: new Date().toISOString().slice(0, 7), 
      paymentTerms: '90/120/150',
      pairs: ''
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
      if (onLogAction) onLogAction('CHECK_COTAS', 'Acessou o painel de gerenciamento de cotas');
  }, []);

  useEffect(() => {
      if (activeStores.length > 0 && !activeTab) {
          setActiveTab(activeStores[0].id);
          setBudgetForm(prev => ({...prev, storeId: activeStores[0].id}));
          setDebtFormStoreId(activeStores[0].id);
      }
  }, [activeStores, activeTab]);

  useEffect(() => {
      if (selectedStoreFilter !== 'all') {
          setActiveTab(selectedStoreFilter);
      } else {
          const isValid = activeStores.some(s => s.id === activeTab);
          if (!isValid && activeStores.length > 0) {
              setActiveTab(activeStores[0].id);
          }
      }
  }, [selectedStoreFilter, activeStores]);

  const uniqueBrands = useMemo(() => {
      const brands = new Set<string>();
      cotas.forEach(c => { if (c.brand) brands.add(c.brand); });
      return Array.from(brands).sort();
  }, [cotas]);

  const [referenceDate, setReferenceDate] = useState(new Date());

  const tableMonths = useMemo(() => {
      const months = [];
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
      return `${monthName.charAt(0).toUpperCase() + monthName.slice(1)}/${y.slice(2)}`;
  };

  const calculateInstallments = (totalValue: number, shipmentDate: string, terms: string): CotaPayment[] => {
      const parts = terms.split(/[\/\,\-\s]+/).map(t => parseInt(t.trim()));
      const validParts = parts.filter(p => !isNaN(p) && p > 0);
      if (validParts.length === 0) return [];

      const installmentValue = totalValue / validParts.length;
      const [yearStr, monthStr] = shipmentDate.split('-');
      const startYear = parseInt(yearStr);
      const startMonthIndex = parseInt(monthStr) - 1; 

      const installmentsMap: Record<string, number> = {};
      validParts.forEach(days => {
          const monthsToAdd = Math.round(days / 30);
          const dueDate = new Date(startYear, startMonthIndex + monthsToAdd, 15);
          const y = dueDate.getFullYear();
          const m = String(dueDate.getMonth() + 1).padStart(2, '0');
          const monthKey = `${y}-${m}`;
          installmentsMap[monthKey] = (installmentsMap[monthKey] || 0) + installmentValue;
      });

      return Object.entries(installmentsMap).map(([month, value]) => ({ month, value }));
  };

  const getBudgetInfo = (storeId: string) => {
      const setting = cotaSettings.find(s => s.storeId === storeId);
      if (setting) return { value: setting.budgetValue, managerPercent: setting.managerPercent };
      return { value: 0, managerPercent: 30 };
  };

  const getDebtValue = (storeId: string, month: string) => {
      const debt = cotaDebts.find(d => d.storeId === storeId && d.month === month);
      return debt ? debt.value : 0;
  };

  const handleToggleStoreSelection = (storeId: string) => {
      setSelectedStoreIds(prev => prev.includes(storeId) ? prev.filter(id => id !== storeId) : [...prev, storeId]);
  };

  const handleValidateOrder = async (e: React.MouseEvent, cota: Cota) => {
      e.preventDefault();
      e.stopPropagation();
      if (onUpdateCota) {
          const updatedCota: Cota = { ...cota, status: 'validated' };
          await onUpdateCota(updatedCota);
          if (onLogAction) onLogAction('VALIDATE_ORDER', `Validou pedido: ${cota.brand} (${formatCurrency(cota.totalValue)})`);
      }
  };

  const handleReactivateOrder = async (cota: Cota) => {
      if (onUpdateCota) {
          const updatedCota: Cota = { ...cota, status: 'pending' };
          await onUpdateCota(updatedCota);
          if (onLogAction) onLogAction('VALIDATE_ORDER', `Reativou pedido: ${cota.brand}`);
      }
  };

  const handleAdd = async (targetRole: UserRole) => {
      if (selectedStoreIds.length === 0) {
          alert("Selecione pelo menos uma loja.");
          return;
      }

      const storesWithoutBudget = selectedStoreIds.filter(id => getBudgetInfo(id).value <= 0);
      if (storesWithoutBudget.length > 0) {
          const storeNumbers = storesWithoutBudget.map(id => {
              const s = activeStores.find(st => st.id === id);
              return s ? s.number : id;
          }).join(', ');
          alert(`( Alerta ) o sistema não consegue cadastrar o pedido pois a loja ( ${storeNumbers} ) encontra-se sem cota cadastrada.`);
          return;
      }

      const numValue = parseFloat(newCota.value.replace(/\./g, '').replace(',', '.'));
      if (!newCota.brand || isNaN(numValue) || numValue <= 0) {
          alert("Preencha a marca e um valor válido.");
          return;
      }

      const installmentsToCheck = calculateInstallments(numValue, newCota.shipmentDate, newCota.paymentTerms);
      let warningMessages: string[] = [];
      let isBlocked = false;

      // Validation Loop
      for (const storeId of selectedStoreIds) {
          const store = activeStores.find(s => s.id === storeId);
          const storeName = store ? `Loja ${store.number}` : storeId;
          const storeBudgetInfo = getBudgetInfo(storeId);
          const totalBudget = storeBudgetInfo.value;

          for (const inst of installmentsToCheck) {
              const month = inst.month;
              const existingOrdersVal = cotas
                  .filter(c => c.storeId === storeId)
                  .reduce((acc, c) => {
                      const cInst = c.installments.find(i => i.month === month);
                      return acc + (cInst ? cInst.value : 0);
                  }, 0);
              
              const debtVal = getDebtValue(storeId, month);
              const currentUsage = existingOrdersVal + debtVal;
              const newUsage = currentUsage + inst.value;
              const balance = totalBudget - newUsage;
              const negativeLimit = totalBudget * 0.10;

              if (totalBudget > 0 && newUsage > (totalBudget + negativeLimit)) {
                  alert(`⛔ BLOQUEADO: O lançamento excede o limite de 10% negativo.\n\n${storeName} - Mês: ${month}\nCota: ${formatCurrency(totalBudget)}\nUso Projetado: ${formatCurrency(newUsage)}\nSaldo Final: ${formatCurrency(balance)}\n\nO sistema não permite exceder 10% do valor da cota negativamente.`);
                  isBlocked = true;
                  break; 
              }
              if (balance < 0) {
                  warningMessages.push(`${storeName} (${month}): Saldo ficará negativo em ${formatCurrency(balance)} (Cota: ${formatCurrency(totalBudget)})`);
              }
          }
          if (isBlocked) break;
      }

      if (isBlocked) return;
      if (warningMessages.length > 0) {
          if (!window.confirm(`⚠️ ATENÇÃO: O saldo ficará NEGATIVO com este lançamento:\n\n${warningMessages.join('\n')}\n\nDeseja continuar mesmo assim?`)) {
              return;
          }
      }

      setIsSubmitting(true);
      try {
          for (const storeId of selectedStoreIds) {
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
                  createdByRole: targetRole,
                  status: 'pending'
              };
              await onAddCota(cota);
          }
          setNewCota(prev => ({ ...prev, brand: '', classification: '', value: '', pairs: '', paymentTerms: '90/120/150' }));
          setSelectedStoreIds([]); 
          alert("Lançamento realizado com sucesso!");
      } catch (err) {
          alert("Erro ao lançar pedido.");
      } finally {
          setIsSubmitting(false);
      }
  };

  const handleSaveBudget = async () => {
      const val = parseFloat(budgetForm.value.replace(/\./g, '').replace(',', '.'));
      if (budgetForm.storeId && !isNaN(val)) {
          setIsSubmitting(true);
          await onSaveSettings({
              storeId: budgetForm.storeId,
              budgetValue: val,
              managerPercent: budgetForm.managerPercent
          });
          setIsSubmitting(false);
          setIsBudgetModalOpen(false);
      }
  };

  const handleOpenDebtModal = () => {
      setReferenceDate(new Date());
      const initialStoreId = selectedStoreFilter !== 'all' ? selectedStoreFilter : activeStores[0]?.id || '';
      setDebtFormStoreId(initialStoreId);
      
      const initialTemp: Record<string, string> = {};
      tableMonths.forEach(m => {
          const val = getDebtValue(initialStoreId, m);
          initialTemp[m] = val > 0 ? val.toFixed(2).replace('.', ',') : '';
      });
      setTempDebts(initialTemp);
      setIsDebtModalOpen(true);
  };

  const handleStoreChangeInDebtModal = (newStoreId: string) => {
      setDebtFormStoreId(newStoreId);
      const initialTemp: Record<string, string> = {};
      tableMonths.forEach(m => {
          const val = getDebtValue(newStoreId, m);
          initialTemp[m] = val > 0 ? val.toFixed(2).replace('.', ',') : '';
      });
      setTempDebts(initialTemp);
  };

  const handleSaveDebts = async () => {
      const cleanDebts: Record<string, number> = {};
      Object.entries(tempDebts).forEach(([month, valStr]) => {
          const val = parseFloat((valStr as string).replace(/\./g, '').replace(',', '.'));
          if (!isNaN(val) && val > 0) {
              cleanDebts[month] = val;
          }
      });
      setIsSubmitting(true);
      await onSaveDebts(debtFormStoreId, cleanDebts);
      setIsSubmitting(false);
      setIsDebtModalOpen(false);
  };

  const effectiveStoreId = useMemo(() => selectedStoreFilter !== 'all' ? selectedStoreFilter : activeTab, [selectedStoreFilter, activeTab]);

  const filteredCotas = useMemo(() => {
      if (!effectiveStoreId) return [];
      let data = cotas.filter(c => c.storeId === effectiveStoreId);
      return data.sort((a, b) => {
          const roleA = a.createdByRole === UserRole.MANAGER ? 0 : 1;
          const roleB = b.createdByRole === UserRole.MANAGER ? 0 : 1;
          if (roleA !== roleB) return roleA - roleB;
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
  }, [cotas, effectiveStoreId]); 

  const pendingCotas = useMemo(() => filteredCotas.filter(c => !c.status || c.status === 'pending'), [filteredCotas]);
  const validatedCotas = useMemo(() => filteredCotas.filter(c => c.status === 'validated'), [filteredCotas]);

  const modalValidatedCotas = useMemo(() => {
      let data = cotas.filter(c => c.status === 'validated');
      if (effectiveStoreId) data = data.filter(c => c.storeId === effectiveStoreId);
      return data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [cotas, effectiveStoreId]);

  const { chartData, subCategoryKeys } = useMemo(() => {
      const dataMap: Record<string, Record<string, number>> = {
          'Feminino': { total: 0 }, 'Masculino': { total: 0 }, 'Infantil': { total: 0 }, 'Acessórios': { total: 0 }
      };
      const keysSet = new Set<string>();
      filteredCotas.forEach(c => {
          const parts = c.classification.split(' - ');
          const rootCategory = parts[0];
          const subCategory = parts[1] || 'Geral';
          if (dataMap[rootCategory]) {
              dataMap[rootCategory][subCategory] = (dataMap[rootCategory][subCategory] || 0) + c.totalValue;
              dataMap[rootCategory].total += c.totalValue;
              keysSet.add(subCategory);
          }
      });
      const finalData = Object.entries(dataMap).map(([name, values]) => ({ name, ...values, totalValue: values.total }));
      return { chartData: finalData, subCategoryKeys: Array.from(keysSet).sort() };
  }, [filteredCotas]);

  const getMonthTotalPendingOrders = (month: string) => pendingCotas.reduce((acc, c) => acc + (c.installments.find(i => i.month === month)?.value || 0), 0);
  const getMonthTotalValidatedOrders = (month: string) => validatedCotas.reduce((acc, c) => acc + (c.installments.find(i => i.month === month)?.value || 0), 0);

  const budgetSplit = useMemo(() => {
      const info = getBudgetInfo(effectiveStoreId);
      const managerVal = info.value * (info.managerPercent / 100);
      const buyerVal = info.value - managerVal;
      return { manager: managerVal, buyer: buyerVal, total: info.value };
  }, [effectiveStoreId, cotaSettings]);

  return (
    <div className="p-4 md:p-8 max-w-[1800px] mx-auto space-y-8">
        <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 border-b border-gray-200 pb-6">
            <div>
                <h2 className="text-3xl font-bold text-gray-800 flex items-center gap-3"><Calculator className="text-blue-600" size={32} /> Gestão de Cotas e Pedidos</h2>
                <p className="text-gray-500 mt-1">Controle de compras futuras com divisão Gerente/Comprador.</p>
            </div>
            <div className="flex flex-wrap gap-3 items-center w-full xl:w-auto">
                <div className="bg-white border border-gray-300 rounded-lg p-2 flex items-center gap-2 shadow-sm flex-1 xl:flex-none">
                    <Filter size={18} className="text-gray-500 ml-1" />
                    <select value={selectedStoreFilter} onChange={(e) => setSelectedStoreFilter(e.target.value)} className="bg-transparent text-sm font-medium outline-none text-blue-700 cursor-pointer w-full min-w-[150px]">
                        {!isManager && <option value="all">Todas as Lojas</option>}
                        {activeStores.map(s => <option key={s.id} value={s.id}>{s.number} - {s.name}</option>)}
                    </select>
                </div>
                {!isManager && (
                    <>
                        <button onClick={() => { 
                            const info = getBudgetInfo(effectiveStoreId);
                            setBudgetForm({ storeId: effectiveStoreId, value: info.value > 0 ? info.value.toString() : '', managerPercent: info.managerPercent });
                            setIsBudgetModalOpen(true);
                        }} className="flex items-center gap-2 bg-yellow-500 text-white px-4 py-2.5 rounded-lg hover:bg-yellow-600 shadow-sm font-bold text-sm"><Settings size={18} /> Definir Cota</button>
                        <button onClick={handleOpenDebtModal} className="flex items-center gap-2 bg-red-500 text-white px-4 py-2.5 rounded-lg hover:bg-red-600 shadow-sm font-bold text-sm"><Wallet size={18} /> Lançar Dívidas</button>
                        <button onClick={() => setIsReceivedModalOpen(true)} className="flex items-center gap-2 bg-gray-700 text-white px-4 py-2.5 rounded-lg hover:bg-gray-800 shadow-sm font-bold text-sm"><PackageCheck size={18} /> Recebidos</button>
                    </>
                )}
            </div>
        </div>

        {!isManager && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-blue-600"></div>
                <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider mb-4 border-b pb-2 flex items-center gap-2"><Plus size={16} className="text-blue-600"/> Inclusão de Pedido</h3>
                <form className="flex flex-col gap-6" onSubmit={(e) => e.preventDefault()}>
                    <div className="grid grid-cols-1 md:grid-cols-6 gap-4 items-start">
                        <div className="md:col-span-2">
                            <label className="block text-xs font-semibold text-gray-500 mb-2">Selecione as Lojas</label>
                            <div className="border border-gray-300 rounded-lg p-2 h-32 overflow-y-auto bg-gray-50 space-y-1">
                                {activeStores.map(s => (
                                    <div key={s.id} onClick={() => handleToggleStoreSelection(s.id)} className={`flex items-center gap-2 p-2 rounded cursor-pointer text-xs ${selectedStoreIds.includes(s.id) ? 'bg-blue-100 text-blue-800' : 'hover:bg-gray-100 text-gray-600'}`}>
                                        {selectedStoreIds.includes(s.id) ? <CheckSquare size={16} className="text-blue-600"/> : <Square size={16} className="text-gray-400"/>}
                                        <span className="font-medium">Loja {s.number} - {s.city}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="md:col-span-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="col-span-2 md:col-span-1">
                                <label className="block text-xs font-semibold text-gray-500 mb-1">Marca</label>
                                <input list="brand-list" required value={newCota.brand} onChange={e => setNewCota({...newCota, brand: e.target.value})} className="w-full p-2.5 border border-gray-300 rounded-lg text-sm outline-none"/>
                                <datalist id="brand-list">{uniqueBrands.map(b => <option key={b} value={b} />)}</datalist>
                            </div>
                            <div className="col-span-2 md:col-span-1">
                                <label className="block text-xs font-semibold text-gray-500 mb-1">Classificação</label>
                                <select value={newCota.classification} onChange={e => setNewCota({...newCota, classification: e.target.value})} className="w-full p-2.5 border border-gray-300 rounded-lg text-sm outline-none bg-white">
                                    <option value="">Selecione...</option>
                                    {Object.entries(CLASSIFICATION_OPTIONS).map(([grp, opts]) => (
                                        <optgroup key={grp} label={grp}>{opts.map(o => <option key={`${grp}-${o}`} value={`${grp} - ${o}`}>{grp} {o}</option>)}</optgroup>
                                    ))}
                                </select>
                            </div>
                            <div className="col-span-1"><label className="block text-xs font-semibold text-gray-500 mb-1">Embarque</label><input type="month" value={newCota.shipmentDate} onChange={e => setNewCota({...newCota, shipmentDate: e.target.value})} className="w-full p-2.5 border border-gray-300 rounded-lg text-sm outline-none"/></div>
                            <div className="col-span-1"><label className="block text-xs font-semibold text-gray-500 mb-1">Prazo</label><input value={newCota.paymentTerms} onChange={e => setNewCota({...newCota, paymentTerms: e.target.value})} className="w-full p-2.5 border border-gray-300 rounded-lg text-sm outline-none"/></div>
                            <div className="col-span-1"><label className="block text-xs font-semibold text-gray-500 mb-1">Pares</label><input type="number" value={newCota.pairs} onChange={e => setNewCota({...newCota, pairs: e.target.value})} className="w-full p-2.5 border border-gray-300 rounded-lg text-sm outline-none"/></div>
                            <div className="col-span-1"><label className="block text-xs font-bold text-blue-900 mb-1">Valor (R$)</label><input value={newCota.value} onChange={e => setNewCota({...newCota, value: e.target.value})} className="w-full p-2.5 border-2 border-blue-300 bg-blue-50/50 rounded-lg text-xl font-bold outline-none"/></div>
                            <div className="col-span-2 flex gap-3 items-end">
                                <button onClick={() => handleAdd(UserRole.ADMIN)} disabled={isSubmitting} className="flex-1 bg-blue-700 text-white font-bold py-2.5 rounded-lg shadow-md text-xs flex items-center justify-center gap-2">
                                    {isSubmitting && <Loader2 size={12} className="animate-spin" />} Cota Comprador
                                </button>
                                <button onClick={() => handleAdd(UserRole.MANAGER)} disabled={isSubmitting} className="flex-1 bg-purple-600 text-white font-bold py-2.5 rounded-lg shadow-md text-xs flex items-center justify-center gap-2">
                                    {isSubmitting && <Loader2 size={12} className="animate-spin" />} Cota Gerente
                                </button>
                            </div>
                        </div>
                    </div>
                </form>
            </div>
        )}

        {selectedStoreFilter === 'all' && (
            <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-gray-200">
                {activeStores.map(store => (
                    <button key={store.id} onClick={() => setActiveTab(store.id)} className={`flex items-center gap-2 px-4 py-2 rounded-t-lg font-bold text-sm whitespace-nowrap ${activeTab === store.id ? 'bg-green-100 border-x border-t border-green-200 text-green-800 shadow-sm relative -mb-[1px] z-10' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'}`}>
                        <StoreIcon size={16} /> Loja {store.number}
                    </button>
                ))}
            </div>
        )}

        <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden flex flex-col rounded-tl-none min-h-[500px]">
            <div className="overflow-x-auto pb-4">
                <table className="w-full border-collapse text-sm min-w-[1200px] table-fixed">
                    <thead>
                        <tr className="bg-gray-800 text-white uppercase text-xs tracking-wider">
                            <th className="p-3 border-r border-gray-700 text-left w-[250px] sticky left-0 bg-gray-800 z-20">Detalhes</th>
                            <th className="p-3 border-r border-gray-700 text-center w-[100px]">Total</th>
                            <th className="p-3 border-r border-gray-700 text-center w-[80px]">Emb.</th>
                            {tableMonths.map(month => {
                                const [y, m] = month.split('-');
                                const date = new Date(parseInt(y), parseInt(m)-1, 1);
                                const mName = date.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
                                return <th key={month} className="p-2 border-r border-gray-700 text-center w-[100px]">{mName.toUpperCase()}/{y.slice(2)}</th>;
                            })}
                            <th className="p-3 w-16 text-center">Ações</th>
                        </tr>
                    </thead>
                    <tbody key={`summary-${activeTab}`} className="divide-y divide-gray-100 bg-white">
                        <tr className="bg-blue-50/50 text-blue-900 border-b border-blue-100 shadow-sm relative z-10">
                            <td className="p-3 border-r border-blue-100 font-bold sticky left-0 bg-[#f0f9ff] z-10 text-xs">COTA COMPRADOR</td>
                            <td className="p-3 border-r border-blue-100 text-center text-[10px] text-blue-700">FIXO</td>
                            <td className="p-3 border-r border-blue-100"></td>
                            {tableMonths.map(m => <td key={`bb-${m}`} className="p-3 text-center border-r border-blue-100 font-bold text-blue-800 text-xs">{formatCurrency(budgetSplit.buyer)}</td>)}
                            <td></td>
                        </tr>
                        <tr className="bg-purple-50/50 text-purple-900 border-b border-purple-100 shadow-sm relative z-10">
                            <td className="p-3 border-r border-purple-100 font-bold sticky left-0 bg-[#faf5ff] z-10 text-xs">COTA GERENTE</td>
                            <td className="p-3 border-r border-purple-100 text-center text-[10px] text-purple-700">FIXO</td>
                            <td className="p-3 border-r border-purple-100"></td>
                            {tableMonths.map(m => <td key={`bm-${m}`} className="p-3 text-center border-r border-purple-100 font-bold text-purple-800 text-xs">{formatCurrency(budgetSplit.manager)}</td>)}
                            <td></td>
                        </tr>
                        <tr className="bg-red-50 text-red-900 border-b border-red-200 font-semibold relative z-10">
                            <td className="p-3 border-r border-red-200 font-bold sticky left-0 bg-red-50 z-10 text-xs">PREVISÃO DÍVIDA</td>
                            <td className="p-3 border-r border-red-200 text-center text-[10px]">-</td>
                            <td className="p-3 border-r border-red-200"></td>
                            {tableMonths.map(m => {
                                const d = getDebtValue(effectiveStoreId, m);
                                return <td key={`d-${m}`} className="p-3 text-center border-r border-red-200 font-bold text-red-700 text-xs">{d > 0 ? `(${formatCurrency(d)})` : '-'}</td>;
                            })}
                            <td></td>
                        </tr>
                        <tr className="bg-green-100 text-green-900 border-b border-green-200 font-semibold relative z-10">
                            <td className="p-3 border-r border-green-200 font-bold sticky left-0 bg-green-100 z-10 text-xs">PEDIDOS CADASTRADOS</td>
                            <td className="p-3 border-r border-green-200 text-center text-[10px]">{formatCurrency(validatedCotas.reduce((a,b)=>a+b.totalValue,0))}</td>
                            <td className="p-3 border-r border-green-200"></td>
                            {tableMonths.map(m => {
                                const v = getMonthTotalValidatedOrders(m);
                                return <td key={`v-${m}`} className="p-3 text-center border-r border-green-200 font-bold text-green-800 text-xs">{v > 0 ? `(${formatCurrency(v)})` : '-'}</td>;
                            })}
                            <td></td>
                        </tr>
                        <tr className="bg-gray-100 text-gray-900 border-b border-gray-200 font-semibold">
                            <td className="p-3 border-r border-gray-200 sticky left-0 bg-gray-100 z-10 text-xs">PROJEÇÃO (PENDENTE)</td>
                            <td className="p-3 border-r border-gray-200 text-center font-bold text-xs">{formatCurrency(pendingCotas.reduce((a,b)=>a+b.totalValue,0))}</td>
                            <td className="p-3 border-r border-gray-200"></td>
                            {tableMonths.map(m => <td key={`t-${m}`} className="p-3 text-center border-r border-gray-200 font-bold text-xs">{formatCurrency(getMonthTotalPendingOrders(m))}</td>)}
                            <td></td>
                        </tr>
                        <tr className="bg-gray-800 text-white border-b border-gray-700 font-bold italic">
                            <td className="p-3 border-r border-gray-700 sticky left-0 bg-gray-800 z-10 text-xs">SALDO DISPONÍVEL</td>
                            <td className="p-3 border-r border-gray-700 text-center text-[10px]">-</td>
                            <td className="p-3 border-r border-gray-700"></td>
                            {tableMonths.map(m => {
                                const bal = budgetSplit.total - getDebtValue(effectiveStoreId, m) - getMonthTotalValidatedOrders(m) - getMonthTotalPendingOrders(m);
                                return <td key={`b-${m}`} className={`p-3 text-center border-r border-gray-700 text-xs ${bal < 0 ? 'text-red-400' : 'text-green-400'}`}>{formatCurrency(bal)}</td>;
                            })}
                            <td></td>
                        </tr>
                        {pendingCotas.map(c => (
                            <tr key={c.id} className={`${c.createdByRole === UserRole.MANAGER ? 'bg-purple-50/60' : 'bg-white'} hover:bg-gray-100 transition-colors border-b border-gray-100`}>
                                <td className={`p-3 border-r border-gray-100 sticky left-0 z-10 text-xs font-bold text-gray-800 ${c.createdByRole === UserRole.MANAGER ? 'bg-[#fcfaff]' : 'bg-white'}`}>
                                    {c.brand} <span className="block text-[10px] text-gray-500 font-normal">{c.classification}</span>
                                </td>
                                <td className="p-3 text-center font-medium border-r border-gray-100 text-[10px]">{formatCurrency(c.totalValue)}</td>
                                <td className="p-3 text-center text-gray-600 border-r border-gray-100 text-[10px]">{formatMonthHeader(c.shipmentDate)}</td>
                                {tableMonths.map(m => {
                                    const p = c.installments.find(i => i.month === m);
                                    return <td key={`${c.id}-${m}`} className={`p-3 text-center border-r border-gray-100 text-[10px] ${p ? 'font-medium' : 'text-gray-300'}`}>{p ? formatCurrency(p.value) : '-'}</td>;
                                })}
                                <td className="p-3 text-center flex justify-center gap-2">
                                    {!isManager && (
                                        <>
                                            <button onClick={(e) => handleValidateOrder(e, c)} className="text-green-500 hover:bg-green-50 rounded p-1"><CheckCircle size={16}/></button>
                                            <button onClick={() => onDeleteCota(c.id)} className="text-gray-400 hover:text-red-500 hover:bg-red-50 rounded p-1"><Trash2 size={16}/></button>
                                        </>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>

        {/* ... Rest of modals ... */}
        {isBudgetModalOpen && (
            <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
                <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden animate-in zoom-in duration-200 p-6 space-y-5">
                    <h3 className="text-lg font-bold text-yellow-900 flex items-center gap-2"><Settings size={20}/> Definir Cota</h3>
                    <select value={budgetForm.storeId} onChange={e => {
                        const newId = e.target.value;
                        const info = getBudgetInfo(newId);
                        setBudgetForm({ storeId: newId, value: info.value > 0 ? info.value.toString() : '', managerPercent: info.managerPercent });
                    }} className="w-full p-3 border border-gray-300 rounded-lg">{activeStores.map(s => <option key={s.id} value={s.id}>{s.number} - {s.name}</option>)}</select>
                    <input value={budgetForm.value} onChange={e => setBudgetForm({...budgetForm, value: e.target.value})} placeholder="Valor Total (R$)" className="w-full p-3 border border-gray-300 rounded-lg text-xl font-bold"/>
                    <div className="bg-gray-50 p-4 rounded-lg">
                        <div className="flex justify-between text-xs font-bold mb-2"><span>COMPRADOR ({100 - budgetForm.managerPercent}%)</span><span>GERENTE ({budgetForm.managerPercent}%)</span></div>
                        <input type="range" min="0" max="100" step="5" value={budgetForm.managerPercent} onChange={e => setBudgetForm({...budgetForm, managerPercent: parseInt(e.target.value)})} className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-yellow-500"/>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={() => setIsBudgetModalOpen(false)} disabled={isSubmitting} className="flex-1 py-3 bg-gray-100 rounded-lg font-bold disabled:opacity-50">Cancelar</button>
                        <button onClick={handleSaveBudget} disabled={isSubmitting} className="flex-1 py-3 bg-yellow-500 text-white rounded-lg font-bold disabled:opacity-50 flex items-center justify-center gap-2">
                            {isSubmitting && <Loader2 size={16} className="animate-spin"/>} Salvar
                        </button>
                    </div>
                </div>
            </div>
        )}

        {/* ... Received Modal ... */}
        {isReceivedModalOpen && (
            <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
                <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl overflow-hidden animate-in zoom-in duration-200 flex flex-col max-h-[90vh]">
                    <div className="bg-gray-800 p-4 flex justify-between items-center"><h3 className="text-white font-bold text-lg">Pedidos Recebidos</h3><button onClick={() => setIsReceivedModalOpen(false)} className="text-white"><X size={20}/></button></div>
                    <div className="p-6 overflow-y-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-gray-100 font-semibold"><tr><th className="p-3">Marca</th><th className="p-3">Valor</th><th className="p-3">Data</th><th className="p-3 text-center">Status</th><th className="p-3 text-right">Ação</th></tr></thead>
                            <tbody className="divide-y divide-gray-100">
                                {modalValidatedCotas.map(c => (
                                    <tr key={c.id}>
                                        <td className="p-3">{c.brand}</td><td className="p-3">{formatCurrency(c.totalValue)}</td><td className="p-3">{formatMonthHeader(c.shipmentDate)}</td>
                                        <td className="p-3 text-center"><span className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-bold">VALIDADO</span></td>
                                        <td className="p-3 text-right"><button onClick={() => handleReactivateOrder(c)} className="text-blue-600 border border-blue-200 px-3 py-1 rounded hover:bg-blue-50">Reativar</button></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        )}
        
        {isDebtModalOpen && (
            <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
                <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden animate-in zoom-in duration-200 flex flex-col max-h-[90vh]">
                    <div className="bg-red-500 p-4 flex justify-between items-center"><h3 className="text-white font-bold text-lg">Previsão de Dívidas</h3><button onClick={() => setIsDebtModalOpen(false)} className="text-white"><X size={20}/></button></div>
                    <div className="p-6 overflow-y-auto">
                        <select value={debtFormStoreId} onChange={e => handleStoreChangeInDebtModal(e.target.value)} className="w-full p-3 border border-gray-300 rounded-lg mb-4">{activeStores.map(s => <option key={s.id} value={s.id}>{s.number} - {s.name}</option>)}</select>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                            {tableMonths.map(m => {
                                const [y, mo] = m.split('-');
                                const label = new Date(parseInt(y), parseInt(mo)-1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
                                return <div key={m}><label className="block text-xs font-bold text-gray-400 mb-1 capitalize">{label}</label><input value={tempDebts[m] || ''} onChange={e => setTempDebts({...tempDebts, [m]: e.target.value})} placeholder="0,00" className="w-full p-2 border border-gray-300 rounded text-sm"/></div>;
                            })}
                        </div>
                    </div>
                    <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-2">
                        <button onClick={() => setIsDebtModalOpen(false)} disabled={isSubmitting} className="px-4 py-2 bg-gray-200 rounded-lg font-bold disabled:opacity-50">Cancelar</button>
                        <button onClick={handleSaveDebts} disabled={isSubmitting} className="px-6 py-2 bg-red-600 text-white rounded-lg font-bold disabled:opacity-50 flex items-center gap-2">
                            {isSubmitting && <Loader2 size={16} className="animate-spin" />} Salvar
                        </button>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};

export default CotasManagement;
