
import React, { useState, useMemo, useEffect } from 'react';
import { Store, User, Cota, CotaPayment, UserRole, SystemLog, CotaSettings, CotaDebt } from '../types';
import { formatCurrency } from '../constants';
// Added missing 'Shield' import to resolve the reference on line 582
import { Calculator, Plus, Save, Trash2, Filter, Settings, CheckSquare, Square, X, AlertCircle, Wallet, TrendingDown, Store as StoreIcon, LayoutGrid, PieChart, UserCheck, Briefcase, Search, BarChart2, CheckCircle, RefreshCcw, PackageCheck, Loader2, Info, Target, Shield } from 'lucide-react';
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
      }
  }, [selectedStoreFilter]);

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
          alert("Selecione pelo menos uma loja para incluir o pedido.");
          return;
      }

      const cleanValueStr = newCota.value.replace(/\./g, '').replace(',', '.');
      const numValue = parseFloat(cleanValueStr);
      const numPairs = parseInt(newCota.pairs) || 0;

      if (!newCota.brand || isNaN(numValue) || numValue <= 0) {
          alert("Preencha a marca e um valor de pedido válido.");
          return;
      }

      setIsSubmitting(true);
      try {
          const installments = calculateInstallments(numValue, newCota.shipmentDate, newCota.paymentTerms);
          
          for (const storeId of selectedStoreIds) {
              const cota: Cota = {
                  id: '', // UUID será omitido na App.tsx no insert
                  storeId: storeId,
                  brand: newCota.brand.toUpperCase(),
                  classification: newCota.classification,
                  totalValue: numValue,
                  shipmentDate: newCota.shipmentDate,
                  paymentTerms: newCota.paymentTerms,
                  pairs: numPairs,
                  installments: installments,
                  createdAt: new Date(),
                  createdByRole: targetRole,
                  status: 'pending'
              };
              await onAddCota(cota);
          }
          
          if (selectedStoreIds.length === 1) {
              setActiveTab(selectedStoreIds[0]);
          }

          // LIMPEZA TOTAL DOS DADOS APÓS SALVAR COM SUCESSO
          setNewCota({
              brand: '',
              classification: '',
              value: '',
              shipmentDate: new Date().toISOString().slice(0, 7),
              paymentTerms: '90/120/150',
              pairs: ''
          });
          setSelectedStoreIds([]); 
          
          alert("Pedido incluído e campos zerados com sucesso!");
      } catch (err: any) {
          console.error("Erro ao incluir cota:", err);
          alert(`Erro técnico ao salvar no banco: ${err.message || 'Verifique sua conexão.'}`);
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

  const effectiveStoreId = activeTab;

  const filteredCotas = useMemo(() => {
      if (!effectiveStoreId) return [];
      let data = cotas.filter(c => c.storeId === effectiveStoreId);
      return data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [cotas, effectiveStoreId]); 

  const pendingCotas = useMemo(() => filteredCotas.filter(c => !c.status || c.status === 'pending'), [filteredCotas]);
  const validatedCotas = useMemo(() => filteredCotas.filter(c => c.status === 'validated'), [filteredCotas]);

  const budgetSplit = useMemo(() => {
      const info = getBudgetInfo(effectiveStoreId);
      const managerVal = info.value * (info.managerPercent / 100);
      const buyerVal = info.value - managerVal;
      return { manager: managerVal, buyer: buyerVal, total: info.value };
  }, [effectiveStoreId, cotaSettings]);

  const getMonthTotalPendingBuyer = (month: string) => pendingCotas.filter(c => c.createdByRole === UserRole.ADMIN).reduce((acc, c) => acc + (c.installments.find(i => i.month === month)?.value || 0), 0);
  const getMonthTotalPendingManager = (month: string) => pendingCotas.filter(c => c.createdByRole === UserRole.MANAGER).reduce((acc, c) => acc + (c.installments.find(i => i.month === month)?.value || 0), 0);
  
  const getMonthTotalValidatedOrders = (month: string) => validatedCotas.reduce((acc, c) => acc + (c.installments.find(i => i.month === month)?.value || 0), 0);

  return (
    <div className="p-4 md:p-8 max-w-[1800px] mx-auto space-y-8 bg-gray-50 min-h-screen">
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
                        }} className="flex items-center gap-2 bg-yellow-500 text-white px-4 py-2.5 rounded-lg hover:bg-yellow-600 shadow-sm font-bold text-sm transition-all active:scale-95"><Settings size={18} /> Definir Cota</button>
                        <button onClick={handleOpenDebtModal} className="flex items-center gap-2 bg-red-500 text-white px-4 py-2.5 rounded-lg hover:bg-red-600 shadow-sm font-bold text-sm transition-all active:scale-95"><Wallet size={18} /> Lançar Dívidas</button>
                        <button onClick={() => setIsReceivedModalOpen(true)} className="flex items-center gap-2 bg-gray-700 text-white px-4 py-2.5 rounded-lg hover:bg-gray-800 shadow-sm font-bold text-sm transition-all active:scale-95"><PackageCheck size={18} /> Recebidos</button>
                    </>
                )}
            </div>
        </div>

        {!isManager && (
            <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-6 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1.5 h-full bg-blue-600"></div>
                <h3 className="text-sm font-black text-gray-700 uppercase tracking-widest mb-6 border-b pb-3 flex items-center gap-2 italic"><Plus size={18} className="text-blue-600"/> Inclusão de Pedido Corporativo</h3>
                <form className="flex flex-col gap-6" onSubmit={(e) => e.preventDefault()}>
                    <div className="grid grid-cols-1 md:grid-cols-6 gap-6 items-start">
                        <div className="md:col-span-2">
                            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-3 ml-1">Selecione as Lojas de Destino</label>
                            <div className="border border-gray-200 rounded-2xl p-3 h-48 overflow-y-auto bg-gray-50 space-y-1 shadow-inner no-scrollbar">
                                {activeStores.map(s => (
                                    <div key={s.id} onClick={() => handleToggleStoreSelection(s.id)} className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer text-xs transition-all ${selectedStoreIds.includes(s.id) ? 'bg-blue-600 text-white shadow-lg' : 'hover:bg-gray-200 text-gray-600'}`}>
                                        {selectedStoreIds.includes(s.id) ? <CheckSquare size={18}/> : <Square size={18} className="text-gray-300"/>}
                                        <span className="font-black uppercase italic tracking-tighter">Loja {s.number} - {s.city}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="md:col-span-4 grid grid-cols-2 md:grid-cols-4 gap-5">
                            <div className="col-span-2 md:col-span-1">
                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Marca / Fornecedor</label>
                                <input 
                                    list="brand-list" 
                                    required 
                                    value={newCota.brand} 
                                    onChange={e => setNewCota({...newCota, brand: e.target.value})} 
                                    className="w-full p-4 bg-[#001f3f] border-2 border-blue-900 rounded-2xl text-lg font-black text-white outline-none shadow-lg placeholder:text-blue-300/30 uppercase italic"
                                    placeholder="NOME DA MARCA"
                                />
                                <datalist id="brand-list">{uniqueBrands.map(b => <option key={b} value={b} />)}</datalist>
                            </div>
                            <div className="col-span-2 md:col-span-1">
                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Classificação</label>
                                <select 
                                    value={newCota.classification} 
                                    onChange={e => setNewCota({...newCota, classification: e.target.value})} 
                                    className="w-full p-4 bg-[#001f3f] border-2 border-blue-900 rounded-2xl text-sm font-black text-white outline-none shadow-lg appearance-none cursor-pointer uppercase italic"
                                >
                                    <option value="" className="text-blue-300">Selecione...</option>
                                    {Object.entries(CLASSIFICATION_OPTIONS).map(([grp, opts]) => (
                                        <optgroup key={grp} label={grp} className="bg-gray-900 text-gray-400 font-black uppercase text-[10px]">
                                            {opts.map(o => <option key={`${grp}-${o}`} value={`${grp} - ${o}`} className="bg-white text-gray-900 font-bold">{grp} {o}</option>)}
                                        </optgroup>
                                    ))}
                                </select>
                            </div>
                            <div className="col-span-1">
                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Embarque</label>
                                <input 
                                    type="month" 
                                    value={newCota.shipmentDate} 
                                    onChange={e => setNewCota({...newCota, shipmentDate: e.target.value})} 
                                    className="w-full p-4 bg-[#001f3f] border-2 border-blue-900 rounded-2xl text-sm font-black text-white outline-none shadow-lg [color-scheme:dark]"
                                />
                            </div>
                            <div className="col-span-1">
                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Prazo (Dias)</label>
                                <input 
                                    value={newCota.paymentTerms} 
                                    onChange={e => setNewCota({...newCota, paymentTerms: e.target.value})} 
                                    className="w-full p-4 bg-[#001f3f] border-2 border-blue-900 rounded-2xl text-sm font-black text-white outline-none shadow-lg placeholder:text-blue-300/30" 
                                    placeholder="90/120/150"
                                />
                            </div>
                            <div className="col-span-1">
                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Total Pares</label>
                                <input 
                                    type="number" 
                                    value={newCota.pairs} 
                                    onChange={e => setNewCota({...newCota, pairs: e.target.value})} 
                                    className="w-full p-4 bg-[#001f3f] border-2 border-blue-900 rounded-2xl text-2xl font-black text-white outline-none shadow-lg text-center"
                                    placeholder="0"
                                />
                            </div>
                            <div className="col-span-1">
                                <label className="block text-[10px] font-black text-blue-950 uppercase tracking-widest mb-1.5 ml-1 italic">Valor Pedido (R$)</label>
                                <input 
                                    value={newCota.value} 
                                    onChange={e => setNewCota({...newCota, value: e.target.value})} 
                                    className="w-full p-4 bg-[#001f3f] border-4 border-blue-600 rounded-2xl text-2xl font-black text-white outline-none shadow-2xl transition-all focus:ring-4 focus:ring-blue-500/20"
                                    placeholder="0,00"
                                />
                            </div>
                            <div className="col-span-2 flex gap-4 items-end">
                                <button type="button" onClick={() => handleAdd(UserRole.ADMIN)} disabled={isSubmitting} className="flex-1 bg-blue-700 hover:bg-blue-800 text-white font-black py-4 rounded-2xl shadow-xl text-[11px] flex items-center justify-center gap-3 uppercase tracking-widest transition-all active:scale-95 border-b-4 border-blue-900">
                                    {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : <PackageCheck size={20}/>} Cota Comprador
                                </button>
                                <button type="button" onClick={() => handleAdd(UserRole.MANAGER)} disabled={isSubmitting} className="flex-1 bg-purple-600 hover:bg-purple-700 text-white font-black py-4 rounded-2xl shadow-xl text-[11px] flex items-center justify-center gap-3 uppercase tracking-widest transition-all active:scale-95 border-b-4 border-purple-900">
                                    {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle size={20}/>} Cota Gerente
                                </button>
                            </div>
                        </div>
                    </div>
                </form>
            </div>
        )}

        {/* ABAS DE TODAS AS LOJAS */}
        {selectedStoreFilter === 'all' && (
            <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-gray-200 no-scrollbar">
                {activeStores.map(store => (
                    <button 
                        key={store.id} 
                        onClick={() => setActiveTab(store.id)} 
                        className={`flex items-center gap-2 px-6 py-3 rounded-t-2xl font-black text-[12px] uppercase tracking-widest whitespace-nowrap transition-all shadow-sm italic ${activeTab === store.id ? 'bg-blue-600 border-x border-t border-blue-200 text-white relative -mb-[1px] z-10 translate-y-[1px]' : 'bg-gray-100 text-gray-400 hover:bg-gray-200 hover:text-gray-600'}`}
                    >
                        LOJA {store.number}
                    </button>
                ))}
            </div>
        )}

        <div className="bg-white rounded-[40px] shadow-2xl border border-gray-200 overflow-hidden flex flex-col min-h-[500px]">
            <div className="overflow-x-auto pb-6">
                <table className="w-full border-collapse text-sm min-w-[1200px] table-fixed">
                    <thead>
                        <tr className="bg-gray-900 text-white uppercase text-[10px] font-black tracking-widest">
                            <th className="p-5 border-r border-gray-800 text-left w-[250px] sticky left-0 bg-gray-900 z-20 shadow-xl italic">Detalhes do Pedido</th>
                            <th className="p-5 border-r border-gray-800 text-center w-[120px]">Valor Total</th>
                            <th className="p-5 border-r border-gray-800 text-center w-[100px]">Embarque</th>
                            {tableMonths.map(month => {
                                const [y, m] = month.split('-');
                                const date = new Date(parseInt(y), parseInt(m)-1, 1);
                                const mName = date.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
                                return <th key={month} className="p-5 border-r border-gray-800 text-center w-[110px]">{mName.toUpperCase()}/{y.slice(2)}</th>;
                            })}
                            <th className="p-5 w-24 text-center">Ação</th>
                        </tr>
                    </thead>
                    <tbody key={`body-${activeTab}`} className="divide-y divide-gray-100 bg-white">
                        <tr className="bg-blue-50/50 text-blue-900 border-b border-blue-100 shadow-sm relative z-10 font-black italic">
                            <td className="p-5 border-r border-blue-100 sticky left-0 bg-[#f0f9ff] z-10 text-[11px] uppercase tracking-tighter">Budget Comprador</td>
                            <td className="p-5 border-r border-blue-100 text-center text-[10px] text-blue-700 italic">FIXO</td>
                            <td className="p-5 border-r border-blue-100"></td>
                            {tableMonths.map(m => <td key={`bb-${m}`} className="p-5 text-center border-r border-blue-100 text-blue-800 text-xs">{formatCurrency(budgetSplit.buyer)}</td>)}
                            <td></td>
                        </tr>
                        <tr className="bg-purple-50/50 text-purple-900 border-b border-purple-100 shadow-sm relative z-10 font-black italic">
                            <td className="p-5 border-r border-purple-100 sticky left-0 bg-[#faf5ff] z-10 text-[11px] uppercase tracking-tighter">Budget Gerente</td>
                            <td className="p-5 border-r border-purple-100 text-center text-[10px] text-purple-700 italic">FIXO</td>
                            <td className="p-5 border-r border-purple-100"></td>
                            {tableMonths.map(m => <td key={`bm-${m}`} className="p-5 text-center border-r border-purple-100 text-purple-800 text-xs">{formatCurrency(budgetSplit.manager)}</td>)}
                            <td></td>
                        </tr>
                        <tr className="bg-gray-50/80 text-blue-900 border-b border-gray-200">
                            <td className="p-5 border-r border-gray-200 font-bold sticky left-0 bg-gray-50 z-10 text-[11px] uppercase tracking-tighter">Pendente Comprador</td>
                            <td className="p-5 border-r border-gray-200"></td>
                            <td className="p-5 border-r border-gray-200"></td>
                            {tableMonths.map(m => <td key={`pb-${m}`} className="p-5 text-center border-r border-gray-200 font-bold text-blue-600 text-xs">{formatCurrency(getMonthTotalPendingBuyer(m))}</td>)}
                            <td></td>
                        </tr>
                        <tr className="bg-gray-50/80 text-purple-900 border-b border-gray-200">
                            <td className="p-5 border-r border-gray-200 font-bold sticky left-0 bg-gray-50 z-10 text-[11px] uppercase tracking-tighter">Pendente Gerente</td>
                            <td className="p-5 border-r border-gray-200"></td>
                            <td className="p-5 border-r border-gray-200"></td>
                            {tableMonths.map(m => <td key={`pm-${m}`} className="p-5 text-center border-r border-gray-200 font-bold text-purple-600 text-xs">{formatCurrency(getMonthTotalPendingManager(m))}</td>)}
                            <td></td>
                        </tr>
                        <tr className="bg-red-50 text-red-900 border-b border-red-200 font-semibold relative z-10">
                            <td className="p-5 border-r border-red-200 font-bold sticky left-0 bg-red-50 z-10 text-[11px] uppercase tracking-tighter">Previsão Dívida (Fixa)</td>
                            <td className="p-5 border-r border-red-200"></td>
                            <td className="p-5 border-r border-red-200"></td>
                            {tableMonths.map(m => {
                                const d = getDebtValue(effectiveStoreId, m);
                                return <td key={`d-${m}`} className="p-5 text-center border-r border-red-200 font-bold text-red-700 text-xs">{d > 0 ? `(${formatCurrency(d)})` : '-'}</td>;
                            })}
                            <td></td>
                        </tr>
                        <tr className="bg-green-100 text-green-900 border-b border-green-200 font-semibold relative z-10">
                            <td className="p-5 border-r border-green-200 font-black sticky left-0 bg-green-100 z-10 text-[11px] uppercase tracking-tighter">Pedidos Validado</td>
                            <td className="p-5 border-r border-green-200 text-center text-[10px] font-black">{formatCurrency(validatedCotas.reduce((a,b)=>a+b.totalValue,0))}</td>
                            <td className="p-5 border-r border-green-200"></td>
                            {tableMonths.map(m => {
                                const v = getMonthTotalValidatedOrders(m);
                                return <td key={`v-${m}`} className="p-5 text-center border-r border-green-200 font-bold text-green-800 text-xs">{v > 0 ? `(${formatCurrency(v)})` : '-'}</td>;
                            })}
                            <td></td>
                        </tr>
                        <tr className="bg-gray-950 text-white border-b border-gray-800 font-black italic shadow-inner">
                            <td className="p-5 border-r border-gray-800 sticky left-0 bg-gray-950 z-10 text-[11px] uppercase tracking-widest">Saldo Disponível</td>
                            <td className="p-5 border-r border-gray-800"></td>
                            <td className="p-5 border-r border-gray-800"></td>
                            {tableMonths.map(m => {
                                const totalUso = getDebtValue(effectiveStoreId, m) + getMonthTotalValidatedOrders(m) + getMonthTotalPendingBuyer(m) + getMonthTotalPendingManager(m);
                                const bal = budgetSplit.total - totalUso;
                                return <td key={`b-${m}`} className={`p-5 text-center border-r border-gray-800 text-xs ${bal < 0 ? 'text-red-500 underline' : 'text-green-500'}`}>{formatCurrency(bal)}</td>;
                            })}
                            <td></td>
                        </tr>
                        {pendingCotas.map(c => (
                            <tr key={c.id} className={`${c.createdByRole === UserRole.MANAGER ? 'bg-purple-50/40' : 'bg-blue-50/20'} hover:bg-gray-50 transition-colors border-b border-gray-100 group`}>
                                <td className={`p-5 border-r border-gray-100 sticky left-0 z-10 text-xs font-black text-gray-900 ${c.createdByRole === UserRole.MANAGER ? 'bg-[#fcfaff]' : 'bg-[#f8faff]'}`}>
                                    <div className="flex items-center gap-2">
                                        <span className={`w-2 h-2 rounded-full ${c.createdByRole === UserRole.MANAGER ? 'bg-purple-500' : 'bg-blue-500'}`}></span>
                                        <span className="font-black underline decoration-blue-600/50 underline-offset-4 text-sm uppercase italic">{c.brand}</span>
                                    </div>
                                    <span className="block text-[10px] text-gray-500 font-bold uppercase mt-1 italic opacity-70 tracking-tighter">{c.classification} • {c.pairs} PARES</span>
                                </td>
                                <td className="p-5 text-center font-black border-r border-gray-100 text-xs text-gray-800 italic">{formatCurrency(c.totalValue)}</td>
                                <td className="p-5 text-center text-gray-500 border-r border-gray-100 text-[10px] font-black uppercase">{formatMonthHeader(c.shipmentDate)}</td>
                                {tableMonths.map(m => {
                                    const p = c.installments.find(i => i.month === m);
                                    return <td key={`${c.id}-${m}`} className={`p-5 text-center border-r border-gray-100 text-[10px] ${p ? 'font-black text-gray-900 bg-gray-50/30' : 'text-gray-300'}`}>{p ? formatCurrency(p.value) : '-'}</td>;
                                })}
                                <td className="p-5 text-center">
                                    {!isManager && (
                                        <div className="flex justify-center gap-2">
                                            <button 
                                                onClick={(e) => handleValidateOrder(e, c)} 
                                                className="bg-green-50 text-green-600 hover:bg-green-600 hover:text-white border border-green-200 rounded-xl p-2.5 transition-all shadow-sm active:scale-90" 
                                                title="Dar OK / Validar"
                                            >
                                                <CheckCircle size={20}/>
                                            </button>
                                            <button 
                                                onClick={() => onDeleteCota(c.id)} 
                                                className="text-gray-300 hover:text-red-600 hover:bg-red-50 rounded-xl p-2.5 transition-all active:scale-90" 
                                                title="Excluir"
                                            >
                                                <Trash2 size={18}/>
                                            </button>
                                        </div>
                                    )}
                                </td>
                            </tr>
                        ))}
                        {pendingCotas.length === 0 && (
                            <tr><td colSpan={15} className="p-20 text-center text-gray-400 font-black uppercase tracking-[0.2em] opacity-40 italic">Nenhum pedido pendente registrado nesta unidade</td></tr>
                        )}
                    </tbody>
                </table>
            </div>

            <div className="px-10 py-5 bg-gray-900 text-white flex justify-between items-center text-[10px] font-black uppercase tracking-widest border-t border-gray-800">
                <div className="flex items-center gap-6">
                    <span className="flex items-center gap-2 text-blue-400"><Target size={14}/> Sincronização HTTPS Ativa</span>
                    <span className="flex items-center gap-2 text-green-400"><Shield size={14}/> Canal de Dados Criptografado</span>
                </div>
                <div className="flex items-center gap-2 opacity-60 italic">Motor de Persistência Supabase DB v1.0</div>
            </div>
        </div>

        {/* MODAL BUDGET */}
        {isBudgetModalOpen && (
            <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-md">
                <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in duration-200 p-8 space-y-6">
                    <div className="flex items-center gap-3 border-b pb-4"><Settings className="text-yellow-600" size={24}/><h3 className="text-xl font-black text-gray-900 uppercase italic">Definir Cota Mensal</h3></div>
                    <div className="space-y-4">
                        <div><label className="text-[10px] font-black uppercase text-gray-400 mb-1 block">Unidade Operacional</label><select value={budgetForm.storeId} onChange={e => { const newId = e.target.value; const info = getBudgetInfo(newId); setBudgetForm({ storeId: newId, value: info.value > 0 ? info.value.toString() : '', managerPercent: info.managerPercent }); }} className="w-full p-4 bg-gray-50 border-none rounded-2xl font-black text-gray-800">{activeStores.map(s => <option key={s.id} value={s.id}>{s.number} - {s.name}</option>)}</select></div>
                        <div><label className="text-[10px] font-black uppercase text-gray-400 mb-1 block">Valor Mensal (R$)</label><input value={budgetForm.value} onChange={e => setBudgetForm({...budgetForm, value: e.target.value})} placeholder="0,00" className="w-full p-4 bg-gray-50 border-none rounded-2xl text-2xl font-black text-gray-900 outline-none focus:ring-4 focus:ring-yellow-100" /></div>
                        <div className="bg-gray-50 p-6 rounded-3xl border border-gray-100 shadow-inner">
                            <div className="flex justify-between text-[10px] font-black mb-4 uppercase tracking-tighter"><span>COMPRADOR ({100 - budgetForm.managerPercent}%)</span><span>GERENTE ({budgetForm.managerPercent}%)</span></div>
                            <input type="range" min="0" max="100" step="5" value={budgetForm.managerPercent} onChange={e => setBudgetForm({...budgetForm, managerPercent: parseInt(e.target.value)})} className="w-full h-3 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-yellow-500"/>
                        </div>
                    </div>
                    <div className="flex gap-4 pt-4">
                        <button onClick={() => setIsBudgetModalOpen(false)} className="flex-1 py-4 bg-gray-100 rounded-2xl font-black uppercase text-xs text-gray-400 transition-all hover:bg-gray-200 active:scale-95">Cancelar</button>
                        <button onClick={handleSaveBudget} disabled={isSubmitting} className="flex-1 py-4 bg-yellow-500 text-white rounded-2xl font-black uppercase text-xs shadow-xl transition-all hover:bg-yellow-600 flex items-center justify-center gap-2 active:scale-95 border-b-4 border-yellow-700">{isSubmitting ? <Loader2 size={16} className="animate-spin"/> : <Save size={16}/>} Salvar</button>
                    </div>
                </div>
            </div>
        )}

        {/* MODAL RECEBIDOS */}
        {isReceivedModalOpen && (
            <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-md">
                <div className="bg-white rounded-[50px] shadow-2xl w-full max-w-4xl overflow-hidden animate-in zoom-in duration-200 flex flex-col max-h-[90vh]">
                    <div className="bg-gray-900 p-8 flex justify-between items-center text-white"><h3 className="font-black uppercase italic tracking-tighter text-2xl">Histórico de <span className="text-green-500">Pedidos Recebidos</span></h3><button onClick={() => setIsReceivedModalOpen(false)} className="bg-white/10 p-3 rounded-full hover:bg-white/20 transition-all"><X size={24}/></button></div>
                    <div className="p-8 overflow-y-auto no-scrollbar">
                        <table className="w-full text-left text-sm border-separate border-spacing-y-2">
                            <thead><tr className="bg-gray-50 font-black text-[10px] text-gray-400 uppercase tracking-widest border-b"><th className="p-4">Marca</th><th className="p-4">Valor Total</th><th className="p-4">Embarque</th><th className="p-4 text-center">Status</th><th className="p-4 text-right">Ação</th></tr></thead>
                            <tbody className="divide-y-0">
                                {validatedCotas.map(c => (
                                    <tr key={c.id} className="bg-gray-50/50 hover:bg-white transition-all shadow-sm rounded-xl">
                                        <td className="p-4 font-black text-gray-900 uppercase italic tracking-tight underline underline-offset-4 decoration-blue-500/30">{c.brand}</td>
                                        <td className="p-4 font-black text-blue-700 italic">{formatCurrency(c.totalValue)}</td>
                                        <td className="p-4 text-[11px] font-bold text-gray-500 uppercase">{formatMonthHeader(c.shipmentDate)}</td>
                                        <td className="p-4 text-center"><span className="bg-green-100 text-green-700 px-4 py-2 rounded-full text-[9px] font-black uppercase border-2 border-green-200 shadow-sm">Recebido / OK</span></td>
                                        <td className="p-4 text-right"><button onClick={() => handleReactivateOrder(c)} className="text-blue-600 font-black text-[10px] uppercase border