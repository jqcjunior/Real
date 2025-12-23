
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
    <div className="p-2 md:p-3 max-w-full mx-auto space-y-2 bg-gray-50 min-h-screen">
        <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-1 border-b border-gray-200 pb-1">
            <div>
                <h2 className="text-lg font-black text-gray-900 flex items-center gap-2 uppercase italic tracking-tighter"><Calculator className="text-blue-700" size={20} /> Gestão de Cotas</h2>
            </div>
            <div className="flex flex-wrap gap-1 items-center w-full xl:w-auto">
                <div className="bg-white border border-gray-300 rounded p-0.5 flex items-center gap-1 shadow-sm">
                    <Filter size={10} className="text-gray-400 ml-1" />
                    <select value={selectedStoreFilter} onChange={(e) => setSelectedStoreFilter(e.target.value)} className="bg-transparent text-[9px] font-black outline-none text-blue-800 cursor-pointer uppercase tracking-tight">
                        {!isManager && <option value="all">Filtro Rápido</option>}
                        {activeStores.map(s => <option key={s.id} value={s.id}>{s.number} - {s.name}</option>)}
                    </select>
                </div>
                {!isManager && (
                    <div className="flex gap-1">
                        <button type="button" onClick={() => {
                            const info = getBudgetInfo(effectiveStoreId);
                            setBudgetForm({ storeId: effectiveStoreId, value: info.value > 0 ? info.value.toString() : '', managerPercent: info.managerPercent });
                            setIsBudgetModalOpen(true);
                        }} className="flex items-center gap-1 bg-yellow-500 text-white px-2 py-1 rounded hover:bg-yellow-600 shadow-sm font-black text-[8px] uppercase transition-all"><Settings size={10} /> Cota</button>
                        <button type="button" onClick={handleOpenDebtModal} className="flex items-center gap-1 bg-red-600 text-white px-2 py-1 rounded hover:bg-red-700 shadow-sm font-black text-[8px] uppercase transition-all"><Wallet size={10} /> Dívidas</button>
                        <button type="button" onClick={() => setIsReceivedModalOpen(true)} className="flex items-center gap-1 bg-gray-800 text-white px-2 py-1 rounded hover:bg-black shadow-sm font-black text-[8px] uppercase transition-all"><PackageCheck size={10} /> Recebidos</button>
                    </div>
                )}
            </div>
        </div>

        {!isManager && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-2 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-blue-700"></div>
                <form className="flex flex-col gap-2" onSubmit={handleAdd}>
                    <div className="grid grid-cols-1 md:grid-cols-8 gap-2 items-start">
                        <div className="md:col-span-1">
                            <label className="block text-[7px] font-black text-gray-400 uppercase tracking-widest mb-0.5 ml-1">Lojas</label>
                            <div className="border border-gray-200 rounded p-0.5 h-20 overflow-y-auto bg-gray-50 space-y-0.5 shadow-inner no-scrollbar">
                                {activeStores.map(s => (
                                    <div key={s.id} onClick={() => handleToggleStoreSelection(s.id)} className={`flex items-center gap-1 p-0.5 rounded cursor-pointer text-[7px] transition-all ${selectedStoreIds.includes(s.id) ? 'bg-blue-700 text-white' : 'hover:bg-gray-200 text-gray-500'}`}>
                                        {selectedStoreIds.includes(s.id) ? <CheckSquare size={8}/> : <Square size={8} className="text-gray-300"/>}
                                        <span className="font-black uppercase truncate leading-none">L{s.number}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="md:col-span-7 grid grid-cols-2 md:grid-cols-5 gap-1.5">
                            <div className="col-span-1">
                                <label className="block text-[7px] font-black text-gray-400 uppercase tracking-widest mb-0.5">Marca / Fornecedor</label>
                                <input list="brand-list" required value={newCota.brand} onChange={e => setNewCota({...newCota, brand: e.target.value})} className="w-full p-1 bg-[#001f3f] border border-blue-900 rounded text-[9px] font-black text-white outline-none uppercase italic" placeholder="MARCA" />
                                <datalist id="brand-list">{uniqueBrands.map(b => <option key={b} value={b} />)}</datalist>
                            </div>
                            <div className="col-span-1">
                                <label className="block text-[7px] font-black text-gray-400 uppercase tracking-widest mb-0.5">Classificação</label>
                                <select value={newCota.classification} onChange={e => setNewCota({...newCota, classification: e.target.value})} className="w-full p-1 bg-[#001f3f] border border-blue-900 rounded text-[9px] font-black text-white outline-none appearance-none cursor-pointer uppercase italic">
                                    <option value="">Selecione...</option>
                                    {Object.entries(CLASSIFICATION_OPTIONS).map(([grp, opts]) => (
                                        <optgroup key={grp} label={grp}>{opts.map(o => <option key={o} value={`${grp} - ${o}`}>{grp} {o}</option>)}</optgroup>
                                    ))}
                                </select>
                            </div>
                            <div className="col-span-1">
                                <label className="block text-[7px] font-black text-gray-400 uppercase tracking-widest mb-0.5">Embarque</label>
                                <input type="month" value={newCota.shipmentDate} onChange={e => setNewCota({...newCota, shipmentDate: e.target.value})} className="w-full p-1 bg-[#001f3f] border border-blue-900 rounded text-[9px] font-black text-white outline-none [color-scheme:dark]" />
                            </div>
                            <div className="col-span-1">
                                <label className="block text-[7px] font-black text-gray-400 uppercase tracking-widest mb-0.5">Prazo</label>
                                <input value={newCota.paymentTerms} onChange={e => setNewCota({...newCota, paymentTerms: e.target.value})} className="w-full p-1 bg-[#001f3f] border border-blue-900 rounded text-[9px] font-black text-white outline-none" placeholder="90/120/150" />
                            </div>
                            <div className="col-span-1">
                                <label className="block text-[7px] font-black text-gray-400 uppercase tracking-widest mb-0.5">Pares / Valor</label>
                                <div className="flex gap-0.5">
                                    <input type="number" value={newCota.pairs} onChange={e => setNewCota({...newCota, pairs: e.target.value})} className="w-10 p-1 bg-[#001f3f] border border-blue-900 rounded text-[9px] font-black text-white text-center" placeholder="P" />
                                    <input value={newCota.value} onChange={e => setNewCota({...newCota, value: e.target.value})} placeholder="0,00" className="flex-1 p-1 bg-[#001f3f] border border-blue-600 rounded text-[9px] font-black text-white outline-none text-right" />
                                </div>
                            </div>
                            <div className="col-span-5 flex gap-1 justify-end pt-0.5">
                                <button type="submit" data-role={UserRole.ADMIN} disabled={isSubmitting} className="px-3 py-1 bg-blue-700 hover:bg-blue-800 text-white font-black rounded shadow-md text-[8px] flex items-center gap-1 uppercase tracking-widest transition-all active:scale-95">
                                    {isSubmitting ? <Loader2 size={8} className="animate-spin" /> : <PackageCheck size={10}/>} Incluir Comprador
                                </button>
                                <button type="submit" data-role={UserRole.MANAGER} disabled={isSubmitting} className="px-3 py-1 bg-purple-700 hover:bg-purple-800 text-white font-black rounded shadow-md text-[8px] flex items-center gap-1 uppercase tracking-widest transition-all active:scale-95">
                                    {isSubmitting ? <Loader2 size={8} className="animate-spin" /> : <CheckCircle size={10}/>} Incluir Gerente
                                </button>
                            </div>
                        </div>
                    </div>
                </form>
            </div>
        )}

        <div className="flex items-center gap-0.5 overflow-x-auto pb-0.5 no-scrollbar border-b border-gray-200">
            {activeStores.map(store => (
                <button 
                    key={store.id} 
                    type="button"
                    onClick={() => setActiveTab(store.id)} 
                    className={`flex items-center gap-1 px-2 py-1 rounded-t font-black text-[8px] uppercase tracking-widest transition-all italic border-t border-x ${activeTab === store.id ? 'bg-white text-blue-800 border-gray-200 shadow-sm' : 'bg-gray-100 text-gray-400 border-transparent hover:bg-gray-200'}`}
                >
                    L{store.number}
                </button>
            ))}
        </div>

        <div className="bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden flex flex-col">
            <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-gray-300">
                <table className="w-full border-collapse text-[9px] min-w-[1400px] table-fixed">
                    <thead>
                        <tr className="bg-gray-950 text-white uppercase text-[7px] font-black tracking-widest">
                            <th className="p-1.5 border-r border-gray-800 text-left w-[240px] sticky left-0 bg-gray-950 z-20 italic">Identificação / Especificação</th>
                            <th className="p-1.5 border-r border-gray-800 text-center w-[100px]">Total</th>
                            <th className="p-1.5 border-r border-gray-800 text-center w-[60px]">Emb.</th>
                            {tableMonths.map(month => <th key={month} className="p-1.5 border-r border-gray-800 text-center w-[85px]">{formatMonthHeader(month)}</th>)}
                            <th className="p-1.5 w-14 text-center">Ações</th>
                        </tr>
                    </thead>
                    <tbody key={`body-${activeTab}`} className="divide-y divide-gray-100 bg-white">
                        <tr className="bg-blue-50/60 text-blue-950 border-b border-blue-100 font-black italic">
                            <td className="p-1 border-r border-blue-100 sticky left-0 bg-[#f0f9ff] z-10 text-[8px] uppercase tracking-tighter pl-2">COTA COMPRADOR (FIXO)</td>
                            <td className="p-1 border-r border-blue-100 text-center text-[7px] text-blue-700">PADRÃO</td>
                            <td className="p-1 border-r border-blue-100"></td>
                            {tableMonths.map(m => <td key={`bb-${m}`} className="p-1 text-center border-r border-blue-100 text-blue-800 font-black text-[8px]">{formatCurrency(budgetSplit.buyer)}</td>)}
                            <td></td>
                        </tr>
                        <tr className="bg-purple-50/60 text-purple-950 border-b border-purple-100 font-black italic">
                            <td className="p-1 border-r border-purple-100 sticky left-0 bg-[#faf5ff] z-10 text-[8px] uppercase tracking-tighter pl-2">COTA GERENTE (FIXO)</td>
                            <td className="p-1 border-r border-purple-100 text-center text-[7px] text-purple-700">PADRÃO</td>
                            <td className="p-1 border-r border-purple-100"></td>
                            {tableMonths.map(m => <td key={`bm-${m}`} className="p-1 text-center border-r border-purple-100 text-purple-800 font-black text-[8px]">{formatCurrency(budgetSplit.manager)}</td>)}
                            <td></td>
                        </tr>
                        <tr className="bg-red-50/80 text-red-950 border-b border-red-200 font-black relative z-10">
                            <td className="p-1 border-r border-red-200 font-black sticky left-0 bg-red-50 z-10 text-[8px] uppercase tracking-tighter pl-2">PREVISÃO DÍVIDA MENSAL</td>
                            <td className="p-1 border-r border-red-200"></td>
                            <td className="p-1 border-r border-red-200"></td>
                            {tableMonths.map(m => {
                                const d = getDebtValue(effectiveStoreId, m);
                                return <td key={`d-${m}`} className="p-1 text-center border-r border-red-200 font-black text-red-700 text-[8px]">{d > 0 ? `(${formatCurrency(d).replace('R$', '')})` : '-'}</td>;
                            })}
                            <td></td>
                        </tr>
                        <tr className="bg-green-50 text-green-950 border-b border-green-200 font-black relative z-10">
                            <td className="p-1 border-r border-green-200 sticky left-0 bg-[#f0fdf4] z-10 text-[8px] uppercase tracking-tighter pl-2">VALOR RECEBIDOS / VALIDADOS</td>
                            <td className="p-1 border-r border-green-200 text-center text-[6px] font-black uppercase opacity-60">ACUMULADO</td>
                            <td className="p-1 border-r border-green-200"></td>
                            {tableMonths.map(m => {
                                const v = getMonthTotalValidated(m);
                                return <td key={`v-${m}`} className="p-1 text-center border-r border-green-200 font-black text-green-800 text-[8px]">{v > 0 ? `(${formatCurrency(v).replace('R$', '')})` : '-'}</td>;
                            })}
                            <td></td>
                        </tr>
                        <tr className="bg-gray-100/40 text-blue-900 border-b border-gray-200">
                            <td className="p-1 border-r border-gray-200 font-black sticky left-0 bg-gray-50 z-10 text-[8px] uppercase tracking-tighter pl-2">PROJEÇÃO PARCELAS PENDENTES</td>
                            <td className="p-1 border-r border-gray-200"></td>
                            <td className="p-1 border-r border-gray-200"></td>
                            {tableMonths.map(m => {
                                const p = getMonthTotalPending(m);
                                return <td key={`pb-${m}`} className="p-1 text-center border-r border-gray-200 font-black text-blue-600 text-[8px]">{p > 0 ? `(${formatCurrency(p).replace('R$', '')})` : '-'}</td>;
                            })}
                            <td></td>
                        </tr>
                        <tr className="bg-gray-900 text-white border-b border-gray-800 font-black italic">
                            <td className="p-1.5 border-r border-gray-800 sticky left-0 bg-gray-900 z-10 text-[8px] uppercase tracking-widest pl-2">DISPONIBILIDADE LÍQUIDA</td>
                            <td className="p-1.5 border-r border-gray-800"></td>
                            <td className="p-1.5 border-r border-gray-800"></td>
                            {tableMonths.map(m => {
                                const totalUso = getDebtValue(effectiveStoreId, m) + getMonthTotalValidated(m) + getMonthTotalPending(m);
                                const bal = budgetSplit.total - totalUso;
                                return <td key={`b-${m}`} className={`p-1.5 text-center border-r border-gray-800 font-black text-[8px] ${bal < 0 ? 'text-red-500' : 'text-green-400'}`}>{formatCurrency(bal)}</td>;
                            })}
                            <td></td>
                        </tr>
                        {filteredCotas.map(c => (
                            <tr key={c.id} className={`hover:bg-gray-50 border-b border-gray-100 group transition-colors ${c.status === 'validated' ? 'bg-green-50/20' : ''}`}>
                                <td className={`p-1.5 border-r border-gray-100 sticky left-0 z-10 leading-tight ${c.status === 'validated' ? 'bg-[#f0fdf4]' : 'bg-white'}`}>
                                    <div className="flex flex-col gap-0.5 pl-1">
                                        <div className="flex items-center gap-1">
                                            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${c.status === 'validated' ? 'bg-green-600' : (c.createdByRole === UserRole.MANAGER ? 'bg-purple-600' : 'bg-blue-600')}`}></span>
                                            <span className="font-black uppercase italic text-[9px] text-gray-900 tracking-tighter truncate">{c.brand}</span>
                                        </div>
                                        <span className="text-[7px] text-gray-400 font-black uppercase italic truncate opacity-80 pl-2.5">
                                            {c.classification} • {c.pairs || 0} PARES
                                        </span>
                                    </div>
                                </td>
                                <td className="p-1.5 text-center font-black border-r border-gray-100 text-[9px] text-gray-800 italic">{formatCurrency(c.totalValue)}</td>
                                <td className="p-1.5 text-center text-gray-400 border-r border-gray-100 text-[7px] font-black uppercase">{formatMonthHeader(c.shipmentDate)}</td>
                                {tableMonths.map(m => {
                                    const val = getCotaInstallmentForMonth(c, m);
                                    return <td key={`${c.id}-${m}`} className={`p-1.5 text-center border-r border-gray-100 text-[8px] font-bold ${val > 0 ? 'text-gray-900 bg-gray-50/40' : 'text-gray-100'}`}>{val > 0 ? formatCurrency(val).replace('R$', '') : '-'}</td>;
                                })}
                                <td className="p-1.5 text-center">
                                    {!isManager && (
                                        <div className="flex justify-center gap-1 opacity-20 group-hover:opacity-100 transition-all">
                                            {c.status !== 'validated' ? (
                                                <button type="button" onClick={(e) => handleValidateOrder(e, c)} className="p-0.5 text-green-600 hover:bg-green-600 hover:text-white rounded transition-all"><CheckCircle size={12}/></button>
                                            ) : (
                                                <button type="button" onClick={() => handleReactivateOrder(c)} className="p-0.5 text-blue-600 hover:bg-blue-600 hover:text-white rounded transition-all"><RefreshCcw size={12}/></button>
                                            )}
                                            <button type="button" onClick={() => onDeleteCota(c.id)} className="text-gray-400 hover:text-red-600 p-0.5 rounded transition-all"><Trash2 size={12}/></button>
                                        </div>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <div className="px-3 py-1 bg-gray-950 text-white flex justify-between items-center text-[7px] font-black uppercase tracking-widest border-t border-gray-800 opacity-60">
                <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1 text-blue-400"><Target size={8}/> SSL ATIVO</span>
                    <span className="flex items-center gap-1 text-green-400"><Shield size={8}/> DADOS CRIPTOGRAFADOS</span>
                </div>
                <div className="italic">GESTÃO ESTRATÉGICA REAL ADMIN v7.0 • ALTA DENSIDADE</div>
            </div>
        </div>

        {/* MODAL BUDGET */}
        {isBudgetModalOpen && (
            <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-2 backdrop-blur-md">
                <form onSubmit={handleSaveBudget} className="bg-white rounded-2xl shadow-2xl w-full max-w-xs overflow-hidden animate-in zoom-in duration-200 p-4 space-y-3">
                    <div className="flex items-center gap-2 border-b pb-2"><Settings className="text-yellow-600" size={16}/><h3 className="text-xs font-black text-gray-900 uppercase italic">Cota Mensal</h3></div>
                    <div className="space-y-2">
                        <div><label className="text-[8px] font-black uppercase text-gray-400 mb-0.5 block tracking-widest">Loja</label><select value={budgetForm.storeId} onChange={e => { const newId = e.target.value; const info = getBudgetInfo(newId); setBudgetForm({ storeId: newId, value: info.value > 0 ? info.value.toString() : '', managerPercent: info.managerPercent }); }} className="w-full p-1.5 bg-gray-50 border-none rounded font-black text-gray-800 text-[10px]">{activeStores.map(s => <option key={s.id} value={s.id}>{s.number} - {s.name}</option>)}</select></div>
                        <div><label className="text-[8px] font-black uppercase text-gray-400 mb-0.5 block tracking-widest">Valor (R$)</label><input value={budgetForm.value} onChange={e => setBudgetForm({...budgetForm, value: e.target.value})} placeholder="0,00" className="w-full p-2 bg-gray-50 border-none rounded text-lg font-black text-gray-900 outline-none" /></div>
                        <div className="bg-gray-50 p-2 rounded border border-gray-100 shadow-inner">
                            <div className="flex justify-between text-[7px] font-black mb-1 uppercase tracking-tighter"><span>COMPRADOR</span><span>GERENTE</span></div>
                            <input type="range" min="0" max="100" step="5" value={budgetForm.managerPercent} onChange={e => setBudgetForm({...budgetForm, managerPercent: parseInt(e.target.value)})} className="w-full h-1 bg-gray-200 rounded appearance-none cursor-pointer accent-yellow-500"/>
                        </div>
                    </div>
                    <div className="flex gap-2 pt-1">
                        <button type="button" onClick={() => setIsBudgetModalOpen(false)} className="flex-1 py-2 bg-gray-100 rounded font-black uppercase text-[9px] text-gray-400">Cancelar</button>
                        <button type="submit" disabled={isSubmitting} className="flex-1 py-2 bg-yellow-500 text-white rounded font-black uppercase text-[9px] shadow-lg flex items-center justify-center gap-1 border-b-2 border-yellow-700">{isSubmitting ? <Loader2 size={10} className="animate-spin"/> : <Save size={10}/>} Salvar</button>
                    </div>
                </form>
            </div>
        )}

        {/* MODAL RECEBIDOS */}
        {isReceivedModalOpen && (
            <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-2 backdrop-blur-md">
                <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in duration-200 flex flex-col max-h-[70vh]">
                    <div className="bg-gray-900 p-4 flex justify-between items-center text-white"><h3 className="font-black uppercase italic tracking-tighter text-sm">Pedidos <span className="text-green-500">Recebidos</span></h3><button onClick={() => setIsReceivedModalOpen(false)} className="bg-white/10 p-1.5 rounded-full hover:bg-white/20 transition-all"><X size={16}/></button></div>
                    <div className="p-2 overflow-y-auto no-scrollbar">
                        <table className="w-full text-left text-[9px] border-separate border-spacing-y-0.5">
                            <thead><tr className="bg-gray-50 font-black text-[7px] text-gray-400 uppercase tracking-widest border-b"><th className="p-2">Marca</th><th className="p-2">Valor</th><th className="p-2">Embarque</th><th className="p-2 text-center">Status</th><th className="p-2 text-right">Ação</th></tr></thead>
                            <tbody className="divide-y-0">
                                {validatedCotas.map(c => (
                                    <tr key={c.id} className="bg-gray-50 hover:bg-white transition-all shadow-sm rounded">
                                        <td className="p-2 font-black text-gray-900 uppercase italic tracking-tight">{c.brand}</td>
                                        <td className="p-2 font-black text-blue-700 italic">{formatCurrency(c.totalValue)}</td>
                                        <td className="p-2 text-[8px] font-bold text-gray-500 uppercase">{formatMonthHeader(c.shipmentDate)}</td>
                                        <td className="p-2 text-center"><span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full text-[7px] font-black uppercase border border-green-200">OK</span></td>
                                        <td className="p-2 text-right"><button type="button" onClick={() => handleReactivateOrder(c)} className="text-blue-600 font-black text-[7px] uppercase border border-blue-100 px-2 py-0.5 rounded hover:bg-blue-600 hover:text-white transition-all">Reativar</button></td>
                                    </tr>
                                ))}
                                {validatedCotas.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-[8px] font-black text-gray-300 uppercase tracking-widest">Nenhum pedido recebido</td></tr>}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        )}
        
        {/* MODAL DÍVIDAS */}
        {isDebtModalOpen && (
            <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-2 backdrop-blur-md">
                <form onSubmit={handleSaveDebts} className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in duration-200 flex flex-col max-h-[80vh]">
                    <div className="bg-red-600 p-4 flex justify-between items-center text-white"><h3 className="font-black uppercase italic tracking-tighter text-sm flex items-center gap-1"><Wallet size={16}/> Lançar Dívidas</h3><button type="button" onClick={() => setIsDebtModalOpen(false)} className="bg-white/10 p-1.5 rounded-full hover:bg-white/20 transition-all"><X size={16}/></button></div>
                    <div className="p-4 overflow-y-auto no-scrollbar">
                        <div className="mb-4"><label className="text-[8px] font-black uppercase text-gray-400 mb-1 block tracking-widest">Loja</label><select value={debtFormStoreId} onChange={e => {
                             setDebtFormStoreId(e.target.value);
                             const initialTemp: Record<string, string> = {};
                             tableMonths.forEach(m => {
                                 const val = getDebtValue(e.target.value, m);
                                 initialTemp[m] = val > 0 ? val.toFixed(2).replace('.', ',') : '';
                             });
                             setTempDebts(initialTemp);
                        }} className="w-full p-2 bg-gray-50 border-none rounded font-black text-gray-800 text-[10px] outline-none uppercase italic">{activeStores.map(s => <option key={s.id} value={s.id}>{s.number} - {s.name}</option>)}</select></div>
                        <div className="grid grid-cols-2 gap-2">
                            {tableMonths.map(m => {
                                const [y, mo] = m.split('-');
                                const label = new Date(parseInt(y), parseInt(mo)-1).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' });
                                return <div key={m} className="bg-gray-50 p-2 rounded border border-gray-100 shadow-sm"><label className="block text-[7px] font-black text-gray-400 mb-0.5 uppercase tracking-widest italic">{label}</label><input value={tempDebts[m] || ''} onChange={e => setTempDebts({...tempDebts, [m]: e.target.value})} placeholder="0,00" className="w-full p-1 bg-white border border-gray-200 rounded font-black text-gray-900 text-xs outline-none focus:border-red-500 transition-all"/></div>;
                            })}
                        </div>
                    </div>
                    <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-2">
                        <button type="button" onClick={() => setIsDebtModalOpen(false)} className="px-4 py-2 bg-white text-gray-400 rounded font-black uppercase text-[9px] border border-gray-200">Voltar</button>
                        <button type="submit" disabled={isSubmitting} className="px-6 py-2 bg-red-600 text-white rounded font-black uppercase text-[9px] shadow-lg flex items-center justify-center gap-1 border-b-2 border-red-900">{isSubmitting ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />} Salvar</button>
                    </div>
                </form>
            </div>
        )}
    </div>
  );
};

export default CotasManagement;
