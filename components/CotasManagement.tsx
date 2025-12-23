
import React, { useState, useMemo, useEffect } from 'react';
import { Store, User, Cota, UserRole, SystemLog, CotaSettings, CotaDebt } from '../types';
import { formatCurrency } from '../constants';
import { Calculator, Plus, Save, Trash2, Filter, Settings, CheckSquare, Square, X, AlertCircle, Wallet, TrendingDown, Store as StoreIcon, LayoutGrid, PieChart, UserCheck, Briefcase, Search, BarChart2, CheckCircle, RefreshCcw, PackageCheck, Loader2, Info, Target, Shield } from 'lucide-react';

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
      if (activeStores.length > 0 && !activeTab) {
          setActiveTab(activeStores[0].id);
          setBudgetForm(prev => ({...prev, storeId: activeStores[0].id}));
          setDebtFormStoreId(activeStores[0].id);
      }
  }, [activeStores, activeTab]);

  useEffect(() => {
      if (selectedStoreFilter !== 'all' && selectedStoreFilter !== 'all_stores') {
          setActiveTab(selectedStoreFilter);
      }
  }, [selectedStoreFilter]);

  const uniqueBrands = useMemo(() => {
      const brands = new Set<string>();
      if (Array.isArray(cotas)) {
        cotas.forEach(c => { if (c.brand) brands.add(c.brand); });
      }
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
      if (!dateStr || typeof dateStr !== 'string' || !dateStr.includes('-')) return '---';
      try {
        const [y, m] = dateStr.split('-');
        const date = new Date(parseInt(y), parseInt(m)-1, 1);
        const monthName = date.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
        return `${monthName.charAt(0).toUpperCase() + monthName.slice(1)}/${y.slice(2)}`;
      } catch (e) {
        return 'Erro';
      }
  };

  function calculateInstallments({
    totalValue,
    paymentTerms
  }: {
    totalValue: number;
    paymentTerms: number[];
  }) {
    if (
      !totalValue ||
      !Array.isArray(paymentTerms) ||
      paymentTerms.length === 0
    ) {
      return {};
    }

    const installments: Record<string, number> = {};
    const parcelaValor = totalValue / paymentTerms.length;

    paymentTerms.forEach((dias) => {
      const meses = Math.round(dias / 30);
      const targetIndex = meses.toString();
      installments[targetIndex] =
        (installments[targetIndex] || 0) + parcelaValor;
    });

    return installments;
  }

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
      if (onUpdateCota) {
          await onUpdateCota({ ...cota, status: 'validated' });
      }
  };

  const handleReactivateOrder = async (cota: Cota) => {
      if (onUpdateCota) {
          await onUpdateCota({ ...cota, status: 'pending' });
      }
  };

  const resetForm = () => {
    setNewCota({
        brand: '',
        classification: '',
        value: '',
        shipmentDate: new Date().toISOString().slice(0, 7),
        paymentTerms: '90/120/150',
        pairs: ''
    });
    setSelectedStoreIds([]);
  };

  const handleAdd = async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement;
      const targetRole = submitter?.getAttribute('data-role') as UserRole || UserRole.ADMIN;

      if (selectedStoreIds.length === 0) {
          alert("Nenhuma loja selecionada.");
          return;
      }

      const cleanValueStr = newCota.value.replace(/\./g, '').replace(',', '.');
      const numValue = parseFloat(cleanValueStr);
      const numPairs = parseInt(newCota.pairs) || 0;

      if (!newCota.brand || isNaN(numValue) || numValue <= 0) {
          alert("Preencha marca e valor corretamente.");
          return;
      }

      setIsSubmitting(true);
      try {
          const termsArray = newCota.paymentTerms.split(/[\/\,\-\s]+/).map(t => parseInt(t.trim())).filter(p => !isNaN(p));
          if (termsArray.length === 0) {
             alert("Defina os prazos do pedido (Ex: 90/120/150).");
             setIsSubmitting(false);
             return;
          }

          const calculatedInstallments = calculateInstallments({
              totalValue: numValue,
              paymentTerms: termsArray
          });
          
          const safeInstallments = Object.freeze({...calculatedInstallments});

          for (const storeId of selectedStoreIds) {
              await onAddCota({
                  id: '', 
                  storeId: storeId,
                  brand: newCota.brand.toUpperCase(),
                  classification: newCota.classification,
                  totalValue: numValue,
                  shipmentDate: newCota.shipmentDate,
                  paymentTerms: termsArray.join('/'),
                  pairs: numPairs,
                  installments: safeInstallments as Record<string, number>,
                  createdAt: new Date(),
                  createdByRole: targetRole,
                  status: 'pending'
              });
          }
          
          alert("PEDIDO(S) REGISTRADO(S) COM SUCESSO");
          resetForm();
      } catch (err: any) {
          alert(`Erro: ${err.message}`);
      } finally {
          setIsSubmitting(false);
      }
  };

  const effectiveStoreId = activeTab;

  const filteredCotas = useMemo(() => {
      if (!effectiveStoreId || !Array.isArray(cotas)) return [];
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

  const getCotaInstallmentForMonth = (cota: Cota, tableMonthStr: string) => {
    if (!cota.installments || !tableMonthStr || !cota.shipmentDate) return 0;
    const [ty, tm] = tableMonthStr.split('-').map(Number);
    const [sy, sm] = cota.shipmentDate.split('-').map(Number);
    const diffMonths = (ty - sy) * 12 + (tm - sm);
    if (diffMonths < 0) return 0;
    return cota.installments[diffMonths.toString()] || 0;
  };

  const getMonthTotalPending = (month: string) => pendingCotas.reduce((acc, c) => acc + getCotaInstallmentForMonth(c, month), 0);
  const getMonthTotalValidated = (month: string) => validatedCotas.reduce((acc, c) => acc + getCotaInstallmentForMonth(c, month), 0);

  const handleOpenDebtModal = () => {
    setReferenceDate(new Date());
    const initialStoreId = effectiveStoreId || activeStores[0]?.id || '';
    setDebtFormStoreId(initialStoreId);
    const initialTemp: Record<string, string> = {};
    tableMonths.forEach(m => {
        const val = getDebtValue(initialStoreId, m);
        initialTemp[m] = val > 0 ? val.toFixed(2).replace('.', ',') : '';
    });
    setTempDebts(initialTemp);
    setIsDebtModalOpen(true);
  };

  const handleSaveDebts = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanDebts: Record<string, number> = {};
    Object.entries(tempDebts).forEach(([month, valStr]) => {
        const val = parseFloat((valStr as string).replace(/\./g, '').replace(',', '.'));
        if (!isNaN(val) && val > 0) {
            cleanDebts[month] = val;
        }
    });
    setIsSubmitting(true);
    try {
      await onSaveDebts(debtFormStoreId, cleanDebts);
      setIsDebtModalOpen(false);
    } catch (e: any) {
      alert("Erro ao salvar dívidas: " + e.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveBudget = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(budgetForm.value.replace(/\./g, '').replace(',', '.'));
    if (budgetForm.storeId && !isNaN(val)) {
        setIsSubmitting(true);
        try {
          await onSaveSettings({
              storeId: budgetForm.storeId,
              budgetValue: val,
              managerPercent: budgetForm.managerPercent
          });
          setIsBudgetModalOpen(false);
        } catch (e: any) {
          alert("Erro ao salvar budget: " + e.message);
        } finally {
          setIsSubmitting(false);
        }
    }
  };

  return (
    <div className="p-3 md:p-6 max-w-full mx-auto space-y-4 bg-gray-50 min-h-screen">
        {/* HEADER */}
        <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-3 border-b border-gray-200 pb-3">
            <div>
                <h2 className="text-2xl font-black text-gray-900 flex items-center gap-3 uppercase italic tracking-tighter">
                    <Calculator className="text-blue-700" size={32} /> Gestão de Cotas
                </h2>
            </div>
            <div className="flex flex-wrap gap-2 items-center w-full xl:w-auto">
                <div className="bg-white border border-gray-300 rounded-xl p-1.5 flex items-center gap-2 shadow-sm">
                    <Filter size={16} className="text-gray-400 ml-1" />
                    <select value={selectedStoreFilter} onChange={(e) => setSelectedStoreFilter(e.target.value)} className="bg-transparent text-xs font-black outline-none text-blue-900 cursor-pointer uppercase tracking-tight">
                        {!isManager && <option value="all">Filtro de Unidade</option>}
                        {activeStores.map(s => <option key={s.id} value={s.id}>{s.number} - {s.name}</option>)}
                    </select>
                </div>
                {!isManager && (
                    <div className="flex gap-2">
                        <button type="button" onClick={() => {
                            const info = getBudgetInfo(effectiveStoreId);
                            setBudgetForm({ storeId: effectiveStoreId, value: info.value > 0 ? info.value.toString() : '', managerPercent: info.managerPercent });
                            setIsBudgetModalOpen(true);
                        }} className="flex items-center gap-2 bg-yellow-500 text-white px-4 py-2 rounded-xl hover:bg-yellow-600 shadow-md font-black text-[11px] uppercase transition-all"><Settings size={14} /> Budget</button>
                        <button type="button" onClick={handleOpenDebtModal} className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-xl hover:bg-red-700 shadow-md font-black text-[11px] uppercase transition-all"><Wallet size={14} /> Dívidas</button>
                        <button type="button" onClick={() => setIsReceivedModalOpen(true)} className="flex items-center gap-2 bg-gray-900 text-white px-4 py-2 rounded-xl hover:bg-black shadow-md font-black text-[11px] uppercase transition-all"><PackageCheck size={14} /> Recebidos</button>
                    </div>
                )}
            </div>
        </div>

        {/* INCLUSION FORM — REDESIGNED FOR COMPACTNESS AND READABILITY */}
        {!isManager && (
            <div className="bg-white rounded-[24px] shadow-md border border-gray-200 p-4 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1.5 h-full bg-blue-700"></div>
                <form className="flex flex-col gap-4" onSubmit={handleAdd}>
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-end">
                        {/* Store Tags Selection */}
                        <div className="lg:col-span-2">
                            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Unidades Selecionadas</label>
                            <div className="flex flex-wrap gap-1 max-h-[80px] overflow-y-auto no-scrollbar p-1 bg-gray-50 rounded-xl border border-gray-100 shadow-inner">
                                {activeStores.map(s => (
                                    <button 
                                        key={s.id} 
                                        type="button"
                                        onClick={() => handleToggleStoreSelection(s.id)} 
                                        className={`px-2 py-1 rounded-md text-[9px] font-black transition-all border ${selectedStoreIds.includes(s.id) ? 'bg-blue-700 border-blue-800 text-white shadow-sm' : 'bg-white border-gray-200 text-gray-400 hover:border-blue-300'}`}
                                    >
                                        L{s.number}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Order Details */}
                        <div className="lg:col-span-10 grid grid-cols-2 md:grid-cols-5 gap-3">
                            <div className="space-y-1">
                                <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Marca</label>
                                <input list="brand-list" required value={newCota.brand} onChange={e => setNewCota({...newCota, brand: e.target.value})} className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-black text-gray-900 outline-none uppercase placeholder:text-gray-300 focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-all" placeholder="EX: BEIRA RIO" />
                                <datalist id="brand-list">{uniqueBrands.map(b => <option key={b} value={b} />)}</datalist>
                            </div>
                            <div className="space-y-1">
                                <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Classificação</label>
                                <select value={newCota.classification} onChange={e => setNewCota({...newCota, classification: e.target.value})} className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-[11px] font-black text-gray-800 outline-none appearance-none cursor-pointer uppercase transition-all">
                                    <option value="">SELECIONE...</option>
                                    {Object.entries(CLASSIFICATION_OPTIONS).map(([grp, opts]) => (
                                        <optgroup key={grp} label={grp}>{opts.map(o => <option key={o} value={`${grp} - ${o}`}>{grp} {o}</option>)}</optgroup>
                                    ))}
                                </select>
                            </div>
                            <div className="space-y-1">
                                <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Mês Embarque</label>
                                <input type="month" value={newCota.shipmentDate} onChange={e => setNewCota({...newCota, shipmentDate: e.target.value})} className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-[11px] font-black text-gray-800 outline-none cursor-pointer" />
                            </div>
                            <div className="space-y-1">
                                <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Pares e Valor Total</label>
                                <div className="flex gap-1.5">
                                    <input type="number" value={newCota.pairs} onChange={e => setNewCota({...newCota, pairs: e.target.value})} className="w-16 px-2 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-black text-gray-900 text-center" placeholder="PARES" />
                                    <input value={newCota.value} onChange={e => setNewCota({...newCota, value: e.target.value})} placeholder="0,00" className="flex-1 px-3 py-2.5 bg-blue-50 border border-blue-100 rounded-xl text-xs font-black text-blue-900 outline-none text-right" />
                                </div>
                            </div>
                            <div className="flex flex-col gap-2 justify-end">
                                <button type="submit" data-role={UserRole.ADMIN} disabled={isSubmitting} className="w-full py-2.5 bg-blue-700 hover:bg-blue-800 text-white font-black rounded-xl shadow-md text-[10px] flex items-center justify-center gap-2 uppercase tracking-widest transition-all active:scale-95">
                                    {isSubmitting ? <Loader2 size={12} className="animate-spin" /> : <PackageCheck size={14}/>} Pedido Comprador
                                </button>
                                <button type="submit" data-role={UserRole.MANAGER} disabled={isSubmitting} className="w-full py-2.5 bg-purple-700 hover:bg-purple-800 text-white font-black rounded-xl shadow-md text-[10px] flex items-center justify-center gap-2 uppercase tracking-widest transition-all active:scale-95">
                                    {isSubmitting ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle size={14}/>} Pedido Gerente
                                </button>
                            </div>
                        </div>
                    </div>
                </form>
            </div>
        )}

        {/* STORE TABS */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
            {activeStores.map(store => (
                <button 
                    key={store.id} 
                    type="button"
                    onClick={() => setActiveTab(store.id)} 
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-full font-black text-[11px] uppercase tracking-widest transition-all italic border-2 ${activeTab === store.id ? 'bg-white text-blue-800 border-blue-700 shadow-md' : 'bg-gray-100 text-gray-400 border-transparent hover:bg-gray-200'}`}
                >
                    Loja {store.number}
                </button>
            ))}
        </div>

        {/* MAIN TABLE — OPTIMIZED FOR READABILITY */}
        <div className="bg-white rounded-[32px] shadow-xl border border-gray-200 overflow-hidden flex flex-col">
            <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-gray-300">
                <table className="w-full border-collapse text-sm min-w-[1500px] table-fixed">
                    <thead>
                        <tr className="bg-gray-950 text-white uppercase text-[10px] font-black tracking-widest">
                            <th className="p-3 border-r border-gray-800 text-left w-[280px] sticky left-0 bg-gray-950 z-20 italic">Identificação / Especificação</th>
                            <th className="p-3 border-r border-gray-800 text-center w-[120px]">Total Pedido</th>
                            <th className="p-3 border-r border-gray-800 text-center w-[80px]">Emb.</th>
                            {tableMonths.map(month => <th key={month} className="p-3 border-r border-gray-800 text-center w-[100px]">{formatMonthHeader(month)}</th>)}
                            <th className="p-3 w-16 text-center">Ações</th>
                        </tr>
                    </thead>
                    <tbody key={`body-${activeTab}`} className="divide-y divide-gray-100 bg-white">
                        {/* SUMMARY ROWS — INCREASED LEGIBILITY */}
                        <tr className="bg-blue-50/70 text-blue-950 border-b border-blue-100 font-black italic">
                            <td className="p-2.5 border-r border-blue-100 sticky left-0 bg-[#f0f9ff] z-10 text-[11px] uppercase tracking-tighter pl-6">COTA COMPRADOR (FIXO)</td>
                            <td className="p-2.5 border-r border-blue-100 text-center text-[9px] text-blue-700">VALOR PADRÃO</td>
                            <td className="p-2.5 border-r border-blue-100"></td>
                            {tableMonths.map(m => <td key={`bb-${m}`} className="p-2.5 text-center border-r border-blue-100 text-blue-800 font-black text-xs">{formatCurrency(budgetSplit.buyer)}</td>)}
                            <td></td>
                        </tr>
                        <tr className="bg-purple-50/70 text-purple-950 border-b border-purple-100 font-black italic">
                            <td className="p-2.5 border-r border-purple-100 sticky left-0 bg-[#faf5ff] z-10 text-[11px] uppercase tracking-tighter pl-6">COTA GERENTE (FIXO)</td>
                            <td className="p-2.5 border-r border-purple-100 text-center text-[9px] text-purple-700">VALOR PADRÃO</td>
                            <td className="p-2.5 border-r border-purple-100"></td>
                            {tableMonths.map(m => <td key={`bm-${m}`} className="p-2.5 text-center border-r border-purple-100 text-purple-800 font-black text-xs">{formatCurrency(budgetSplit.manager)}</td>)}
                            <td></td>
                        </tr>
                        <tr className="bg-red-50 text-red-950 border-b border-red-200 font-black relative z-10">
                            <td className="p-2.5 border-r border-red-200 font-black sticky left-0 bg-red-50 z-10 text-[11px] uppercase tracking-tighter pl-6">DÍVIDAS MENSAL PROJETADAS</td>
                            <td className="p-2.5 border-r border-red-200"></td>
                            <td className="p-2.5 border-r border-red-200"></td>
                            {tableMonths.map(m => {
                                const d = getDebtValue(effectiveStoreId, m);
                                return <td key={`d-${m}`} className="p-2.5 text-center border-r border-red-200 font-black text-red-700 text-xs">{d > 0 ? `(${formatCurrency(d).replace('R$', '')})` : '-'}</td>;
                            })}
                            <td></td>
                        </tr>
                        <tr className="bg-green-100/50 text-green-950 border-b border-green-200 font-black relative z-10">
                            <td className="p-2.5 border-r border-green-200 sticky left-0 bg-[#f0fdf4] z-10 text-[11px] uppercase tracking-tighter pl-6">RECEBIDOS / VALIDADOS</td>
                            <td className="p-2.5 border-r border-green-200 text-center text-[8px] font-black uppercase opacity-60 italic">ACUMULADO</td>
                            <td className="p-2.5 border-r border-green-200"></td>
                            {tableMonths.map(m => {
                                const v = getMonthTotalValidated(m);
                                return <td key={`v-${m}`} className="p-2.5 text-center border-r border-green-200 font-black text-green-800 text-xs">{v > 0 ? `(${formatCurrency(v).replace('R$', '')})` : '-'}</td>;
                            })}
                            <td></td>
                        </tr>
                        <tr className="bg-gray-100/60 text-blue-900 border-b border-gray-200">
                            <td className="p-2.5 border-r border-gray-200 font-black sticky left-0 bg-gray-50 z-10 text-[11px] uppercase tracking-tighter pl-6">PROJEÇÃO PENDENTE</td>
                            <td className="p-2.5 border-r border-gray-200"></td>
                            <td className="p-2.5 border-r border-gray-200"></td>
                            {tableMonths.map(m => {
                                const p = getMonthTotalPending(m);
                                return <td key={`pb-${m}`} className="p-2.5 text-center border-r border-gray-200 font-black text-blue-600 text-xs">{p > 0 ? `(${formatCurrency(p).replace('R$', '')})` : '-'}</td>;
                            })}
                            <td></td>
                        </tr>
                        <tr className="bg-gray-900 text-white border-b border-gray-800 font-black italic">
                            <td className="p-3 border-r border-gray-800 sticky left-0 bg-gray-900 z-10 text-[12px] uppercase tracking-widest pl-6">DISPONIBILIDADE LÍQUIDA</td>
                            <td className="p-3 border-r border-gray-800"></td>
                            <td className="p-3 border-r border-gray-800"></td>
                            {tableMonths.map(m => {
                                const totalUso = getDebtValue(effectiveStoreId, m) + getMonthTotalValidated(m) + getMonthTotalPending(m);
                                const bal = budgetSplit.total - totalUso;
                                return <td key={`b-${m}`} className={`p-3 text-center border-r border-gray-800 font-black text-xs ${bal < 0 ? 'text-red-500' : 'text-green-400'}`}>{formatCurrency(bal)}</td>;
                            })}
                            <td></td>
                        </tr>

                        {/* LIST OF ORDERS */}
                        {filteredCotas.map(c => (
                            <tr key={c.id} className={`hover:bg-gray-50 border-b border-gray-100 group transition-colors ${c.status === 'validated' ? 'bg-green-50/30' : ''}`}>
                                <td className={`p-3 border-r border-gray-100 sticky left-0 z-10 leading-tight ${c.status === 'validated' ? 'bg-[#f0fdf4]' : 'bg-white'}`}>
                                    <div className="flex flex-col gap-1 pl-3">
                                        <div className="flex items-center gap-2">
                                            <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${c.status === 'validated' ? 'bg-green-600 shadow-[0_0_8px_rgba(22,163,74,0.4)]' : (c.createdByRole === UserRole.MANAGER ? 'bg-purple-600' : 'bg-blue-600')}`}></span>
                                            <span className="font-black uppercase italic text-[13px] text-gray-900 tracking-tight truncate">{c.brand}</span>
                                        </div>
                                        <span className="text-[10px] text-gray-400 font-black uppercase italic truncate opacity-90 pl-4.5">
                                            {c.classification} • <span className="text-gray-600 font-black">{c.pairs || 0} PARES</span>
                                        </span>
                                    </div>
                                </td>
                                <td className="p-3 text-center font-black border-r border-gray-100 text-xs text-gray-800 italic">{formatCurrency(c.totalValue)}</td>
                                <td className="p-3 text-center text-gray-400 border-r border-gray-100 text-[10px] font-black uppercase">{formatMonthHeader(c.shipmentDate)}</td>
                                {tableMonths.map(m => {
                                    const val = getCotaInstallmentForMonth(c, m);
                                    return <td key={`${c.id}-${m}`} className={`p-3 text-center border-r border-gray-100 text-[11px] font-bold ${val > 0 ? 'text-gray-950 bg-gray-50/60 font-black scale-105' : 'text-gray-200'}`}>{val > 0 ? formatCurrency(val).replace('R$', '') : '-'}</td>;
                                })}
                                <td className="p-3 text-center">
                                    {!isManager && (
                                        <div className="flex justify-center gap-2 opacity-30 group-hover:opacity-100 transition-all">
                                            {c.status !== 'validated' ? (
                                                <button type="button" onClick={(e) => handleValidateOrder(e, c)} className="p-1.5 text-green-600 hover:bg-green-600 hover:text-white rounded-lg transition-all" title="Validar Recebimento"><CheckCircle size={18}/></button>
                                            ) : (
                                                <button type="button" onClick={() => handleReactivateOrder(c)} className="p-1.5 text-blue-600 hover:bg-blue-600 hover:text-white rounded-lg transition-all" title="Reabrir Pedido"><RefreshCcw size={18}/></button>
                                            )}
                                            <button type="button" onClick={() => onDeleteCota(c.id)} className="text-gray-400 hover:text-red-600 p-1.5 rounded-lg transition-all" title="Excluir"><Trash2 size={18}/></button>
                                        </div>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {/* FOOTER INFO BAR */}
            <div className="px-6 py-2 bg-gray-950 text-white flex justify-between items-center text-[10px] font-black uppercase tracking-widest border-t border-gray-800">
                <div className="flex items-center gap-6">
                    <span className="flex items-center gap-2 text-blue-400"><Target size={12}/> AMBIENTE SEGURO</span>
                    <span className="flex items-center gap-2 text-green-400"><Shield size={12}/> DADOS PROTEGIDOS</span>
                </div>
                <div className="opacity-40 italic tracking-tight">GESTÃO ESTRATÉGICA DE COMPRAS REAL ADMIN v8.0 • FOCO EM LEGIBILIDADE</div>
            </div>
        </div>

        {/* MODAL BUDGET */}
        {isBudgetModalOpen && (
            <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-md">
                <form onSubmit={handleSaveBudget} className="bg-white rounded-[40px] shadow-2xl w-full max-w-xs overflow-hidden animate-in zoom-in duration-200 p-8 space-y-6">
                    <div className="flex items-center gap-3 border-b pb-4"><Settings className="text-yellow-600" size={24}/><h3 className="text-lg font-black text-gray-900 uppercase italic tracking-tighter">Budget Mensal</h3></div>
                    <div className="space-y-4">
                        <div><label className="text-[10px] font-black uppercase text-gray-400 mb-2 block tracking-widest">Loja Selecionada</label><select value={budgetForm.storeId} onChange={e => { const newId = e.target.value; const info = getBudgetInfo(newId); setBudgetForm({ storeId: newId, value: info.value > 0 ? info.value.toString() : '', managerPercent: info.managerPercent }); }} className="w-full p-3 bg-gray-50 border-2 border-gray-100 rounded-2xl font-black text-gray-800 text-xs focus:border-yellow-500 outline-none">{activeStores.map(s => <option key={s.id} value={s.id}>{s.number} - {s.name}</option>)}</select></div>
                        <div><label className="text-[10px] font-black uppercase text-gray-400 mb-2 block tracking-widest">Valor da Cota (R$)</label><input value={budgetForm.value} onChange={e => setBudgetForm({...budgetForm, value: e.target.value})} placeholder="0,00" className="w-full p-4 bg-gray-50 border-2 border-gray-100 rounded-2xl text-2xl font-black text-gray-900 outline-none focus:border-yellow-500 transition-all" /></div>
                        <div className="bg-gray-50 p-6 rounded-3xl border border-gray-200 shadow-inner">
                            <div className="flex justify-between text-[10px] font-black mb-4 uppercase tracking-tighter text-gray-500"><span>COMPRADOR</span><span>GERENTE</span></div>
                            <input type="range" min="0" max="100" step="5" value={budgetForm.managerPercent} onChange={e => setBudgetForm({...budgetForm, managerPercent: parseInt(e.target.value)})} className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-yellow-500"/>
                            <p className="text-center mt-4 text-xs font-black text-yellow-600 uppercase italic">{budgetForm.managerPercent}% PARA GERÊNCIA</p>
                        </div>
                    </div>
                    <div className="flex gap-3 pt-2">
                        <button type="button" onClick={() => setIsBudgetModalOpen(false)} className="flex-1 py-4 bg-gray-100 rounded-2xl font-black uppercase text-[11px] text-gray-400 hover:bg-gray-200 transition-all">Sair</button>
                        <button type="submit" disabled={isSubmitting} className="flex-1 py-4 bg-yellow-500 text-white rounded-2xl font-black uppercase text-[11px] shadow-xl flex items-center justify-center gap-2 border-b-4 border-yellow-700 active:translate-y-1 transition-all">{isSubmitting ? <Loader2 size={14} className="animate-spin"/> : <Save size={16}/>} Salvar</button>
                    </div>
                </form>
            </div>
        )}

        {/* MODAL RECEBIDOS */}
        {isReceivedModalOpen && (
            <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-md">
                <div className="bg-white rounded-[48px] shadow-2xl w-full max-w-4xl overflow-hidden animate-in zoom-in duration-200 flex flex-col max-h-[85vh]">
                    <div className="bg-gray-950 p-8 flex justify-between items-center text-white border-b border-gray-800">
                        <div>
                            <h3 className="font-black uppercase italic tracking-tighter text-2xl">Pedidos <span className="text-green-500">Consolidados</span></h3>
                            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-1">Histórico de compras já integradas ao estoque</p>
                        </div>
                        <button onClick={() => setIsReceivedModalOpen(false)} className="bg-white/10 p-3 rounded-full hover:bg-white/20 transition-all"><X size={24}/></button>
                    </div>
                    <div className="p-6 overflow-y-auto no-scrollbar bg-gray-50">
                        <table className="w-full text-left text-sm border-separate border-spacing-y-2">
                            <thead>
                                <tr className="bg-white font-black text-[10px] text-gray-400 uppercase tracking-widest shadow-sm rounded-xl">
                                    <th className="p-4 rounded-l-xl">Identificação da Marca</th>
                                    <th className="p-4 text-right">Valor Total</th>
                                    <th className="p-4 text-center">Embarque</th>
                                    <th className="p-4 text-center">Status</th>
                                    <th className="p-4 text-right rounded-r-xl">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y-0">
                                {validatedCotas.map(c => (
                                    <tr key={c.id} className="bg-white hover:bg-green-50/20 transition-all shadow-sm rounded-2xl group">
                                        <td className="p-4 rounded-l-2xl font-black text-gray-900 uppercase italic text-base tracking-tight">{c.brand}</td>
                                        <td className="p-4 text-right font-black text-blue-800 italic text-base">{formatCurrency(c.totalValue)}</td>
                                        <td className="p-4 text-center text-[11px] font-black text-gray-400 uppercase">{formatMonthHeader(c.shipmentDate)}</td>
                                        <td className="p-4 text-center"><span className="bg-green-100 text-green-700 px-4 py-1.5 rounded-full text-[10px] font-black uppercase border border-green-200 shadow-inner">VALIDADO</span></td>
                                        <td className="p-4 text-right rounded-r-2xl"><button type="button" onClick={() => handleReactivateOrder(c)} className="text-blue-600 font-black text-[10px] uppercase border-2 border-blue-100 px-4 py-2 rounded-xl hover:bg-blue-600 hover:text-white transition-all shadow-sm">Desfazer</button></td>
                                    </tr>
                                ))}
                                {validatedCotas.length === 0 && <tr><td colSpan={5} className="p-20 text-center text-[12px] font-black text-gray-300 uppercase tracking-[0.3em]">Nenhum pedido validado até o momento</td></tr>}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        )}
        
        {/* MODAL DÍVIDAS */}
        {isDebtModalOpen && (
            <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-md">
                <form onSubmit={handleSaveDebts} className="bg-white rounded-[48px] shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in duration-200 flex flex-col max-h-[90vh]">
                    <div className="bg-red-600 p-8 flex justify-between items-center text-white border-b-4 border-red-900">
                        <div>
                            <h3 className="font-black uppercase italic tracking-tighter text-2xl flex items-center gap-3"><Wallet size={28}/> Projeção de Dívidas</h3>
                            <p className="text-[10px] text-red-200 font-bold uppercase tracking-widest mt-1">Lançamento de compromissos financeiros prévios</p>
                        </div>
                        <button type="button" onClick={() => setIsDebtModalOpen(false)} className="bg-white/20 p-3 rounded-full hover:bg-white/30 transition-all"><X size={24}/></button>
                    </div>
                    <div className="p-8 overflow-y-auto no-scrollbar bg-gray-50">
                        <div className="mb-8"><label className="text-[10px] font-black uppercase text-gray-500 mb-2 block tracking-widest ml-1">Selecione a Loja</label><select value={debtFormStoreId} onChange={e => {
                             setDebtFormStoreId(e.target.value);
                             const initialTemp: Record<string, string> = {};
                             tableMonths.forEach(m => {
                                 const val = getDebtValue(e.target.value, m);
                                 initialTemp[m] = val > 0 ? val.toFixed(2).replace('.', ',') : '';
                             });
                             setTempDebts(initialTemp);
                        }} className="w-full p-4 bg-white border-2 border-red-50 rounded-2xl font-black text-gray-900 text-sm focus:ring-4 focus:ring-red-100 outline-none uppercase italic shadow-sm">{activeStores.map(s => <option key={s.id} value={s.id}>{s.number} - {s.name}</option>)}</select></div>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                            {tableMonths.map(m => {
                                const [y, mo] = m.split('-');
                                const label = new Date(parseInt(y), parseInt(mo)-1).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' });
                                return <div key={m} className="bg-white p-5 rounded-[28px] border-2 border-gray-50 shadow-sm hover:border-red-200 transition-all"><label className="block text-[9px] font-black text-gray-400 mb-2 uppercase tracking-widest italic">{label}</label><input value={tempDebts[m] || ''} onChange={e => setTempDebts({...tempDebts, [m]: e.target.value})} placeholder="0,00" className="w-full p-2 bg-gray-50 border-none rounded-xl font-black text-gray-900 text-base outline-none focus:bg-red-50 text-right transition-all"/></div>;
                            })}
                        </div>
                    </div>
                    <div className="p-8 border-t border-gray-100 bg-white flex justify-end gap-4">
                        <button type="button" onClick={() => setIsDebtModalOpen(false)} className="px-8 py-4 bg-gray-100 text-gray-400 rounded-2xl font-black uppercase text-[11px] hover:bg-gray-200 transition-all">Cancelar</button>
                        <button type="submit" disabled={isSubmitting} className="px-10 py-4 bg-red-600 text-white rounded-2xl font-black uppercase text-[11px] shadow-xl flex items-center justify-center gap-3 active:scale-95 border-b-4 border-red-900 transition-all">{isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Save size={18} />} Efetivar Projeções</button>
                    </div>
                </form>
            </div>
        )}
    </div>
  );
};

export default CotasManagement;
