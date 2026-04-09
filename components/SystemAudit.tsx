import React, { useState, useMemo } from 'react';
import { SystemLog, Receipt, Store, CashError, IceCreamDailySale, IceCreamPromissoryNote, UserRole, User, CreditCardSale, CashRegisterClosure } from '../types';
import { formatCurrency, BRAND_LOGO } from '../constants';
import { Shield, Search, Printer, IceCream, FileText, AlertTriangle, History, ChevronRight, CheckCircle2, UserCheck, Calendar, Trash2, Edit3, Filter, X, DollarSign, User as UserIcon, CreditCard, ArrowRight, Store as StoreIcon } from 'lucide-react';
import { printReceiptDoc, getCardFlagIcon } from './CashRegisterModule';
import { supabase } from '../services/supabaseClient';

interface SystemAuditProps {
  logs: SystemLog[];
  receipts: Receipt[];
  store?: Store;
  cashErrors: CashError[];
  iceCreamSales: IceCreamDailySale[];
  icPromissories: IceCreamPromissoryNote[];
  cardSales?: CreditCardSale[];
  pixSales?: any[];
  currentUser?: User;
  closures: CashRegisterClosure[];
  stores: Store[];
  can: (permissionKey: string) => boolean;
}

const SystemAudit: React.FC<SystemAuditProps> = ({ logs, receipts, store, cashErrors, iceCreamSales, icPromissories, cardSales = [], pixSales = [], currentUser, closures, stores, can }) => {
  const [activeTab, setActiveTab] = useState<'logs' | 'receipts' | 'cash_errors' | 'vendas_cartao' | 'vendas_pix'>('logs');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStoreId, setSelectedStoreId] = useState('');
  
  // Estados para Intervalo de Datas - Por padrão traz o mês atual
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  });
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  
  const [filterUser, setFilterUser] = useState('all');
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {}
  });
  const [toast, setToast] = useState<{
    show: boolean;
    message: string;
    type: 'success' | 'error';
  }>({
    show: false,
    message: '',
    type: 'success'
  });

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ ...toast, show: false }), 3000);
  };

  const isManagement = can('ALWAYS') || can('MODULE_AUDIT_MANAGE');

  // Lista de usuários únicos para filtro
  const auditUsers = useMemo(() => {
    const users = new Set<string>();
    logs.forEach(l => { if(l.userName) users.add(l.userName); });
    cardSales.forEach(c => { if(c.userName) users.add(c.userName); });
    pixSales.forEach(p => { if(p.userName) users.add(p.userName); });
    return Array.from(users).sort();
  }, [logs, cardSales, pixSales]);

  const handleDeleteFinance = async (id: string, table: 'financial_card_sales' | 'financial_pix_sales') => {
      if (!isManagement) return;
      
      setConfirmModal({
        isOpen: true,
        title: 'Confirmar Exclusão',
        message: 'Deseja realmente EXCLUIR este registro permanentemente?',
        onConfirm: async () => {
          try {
              const { error } = await supabase.from(table).delete().eq('id', id);
              if (error) throw error;
              showToast("Registro removido com sucesso!");
              setConfirmModal(prev => ({ ...prev, isOpen: false }));
          } catch (e) { 
              showToast("Erro ao excluir.", "error");
              setConfirmModal(prev => ({ ...prev, isOpen: false }));
          }
        }
      });
  };

  const checkDateInRange = (dateStr: string) => {
    if (!dateStr) return false;
    const d = dateStr.split('T')[0];
    return (!startDate || d >= startDate) && (!endDate || d <= endDate);
  };

  const filteredCardSales = useMemo(() => {
      return (cardSales || []).filter(c => {
          const saleDate = String(c.date || '').split('T')[0];
          const matchesDate = checkDateInRange(saleDate);
          const matchesUser = filterUser === 'all' || c.userName === filterUser;
          const matchesSearch = searchTerm === '' || 
                                (c.brand || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
                                (c.saleCode || '').toLowerCase().includes(searchTerm.toLowerCase());
          
          const matchesStore = can('ALWAYS') 
            ? (!selectedStoreId || c.storeId === selectedStoreId)
            : c.storeId === currentUser?.storeId;
          
          return matchesDate && matchesUser && matchesSearch && matchesStore;
      });
  }, [cardSales, startDate, endDate, filterUser, searchTerm, currentUser, selectedStoreId]);

  const filteredPixSales = useMemo(() => {
      return (pixSales || []).filter(p => {
          const saleDate = String(p.date || '').split('T')[0];
          const matchesDate = checkDateInRange(saleDate);
          const matchesUser = filterUser === 'all' || p.userName === filterUser;
          const matchesSearch = searchTerm === '' || 
                                (p.clientName || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
                                (p.saleCode || '').toLowerCase().includes(searchTerm.toLowerCase());
          
          const matchesStore = can('ALWAYS') 
            ? (!selectedStoreId || p.storeId === selectedStoreId)
            : p.storeId === currentUser?.storeId;
          
          return matchesDate && matchesUser && matchesSearch && matchesStore;
      });
  }, [pixSales, startDate, endDate, filterUser, searchTerm, currentUser, selectedStoreId]);

  const stats = useMemo(() => {
    const totalCards = filteredCardSales.reduce((acc, curr) => acc + (curr.value || 0), 0);
    const totalPix = filteredPixSales.reduce((acc, curr) => acc + (curr.value || 0), 0);
    const totalReceipts = receipts.filter(r => {
        const matchesDate = checkDateInRange(String(r.date));
        const matchesStore = can('ALWAYS') 
          ? (!selectedStoreId || r.storeId === selectedStoreId)
          : r.storeId === currentUser?.storeId;
        return matchesDate && matchesStore;
    }).reduce((acc, curr) => acc + (curr.value || 0), 0);

    return { 
      totalCards,
      totalPix,
      totalReceipts,
      totalFinance: totalCards + totalPix
    };
  }, [filteredCardSales, filteredPixSales, receipts, startDate, endDate, currentUser, selectedStoreId]);

  return (
    <div className="p-4 md:p-8 max-w-[1600px] mx-auto space-y-6 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
        <div>
          <h2 className="text-2xl md:text-3xl font-black text-gray-900 flex items-center gap-4 uppercase italic tracking-tighter leading-none">
            <Shield className="text-red-600" size={36} />
            Central de <span className="text-blue-700">Auditores</span>
          </h2>
          <p className="text-gray-400 font-bold text-[10px] uppercase tracking-widest mt-2 ml-1">Painel de Conferência Estratégica</p>
        </div>
        
        <div className="flex bg-white p-1 rounded-2xl border border-gray-200 shadow-sm overflow-x-auto no-scrollbar w-full lg:w-auto">
            <button onClick={() => setActiveTab('logs')} className={`flex-1 lg:flex-none px-6 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all whitespace-nowrap ${activeTab === 'logs' ? 'bg-gray-950 text-white shadow-lg' : 'text-gray-400 hover:text-gray-900'}`}>Log de Atividade</button>
            <button onClick={() => setActiveTab('vendas_cartao')} className={`flex-1 lg:flex-none px-6 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all whitespace-nowrap flex items-center justify-center gap-2 ${activeTab === 'vendas_cartao' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-400 hover:text-gray-900'}`}><CreditCard size={14}/> Vendas Cartão</button>
            <button onClick={() => setActiveTab('vendas_pix')} className={`flex-1 lg:flex-none px-6 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all whitespace-nowrap flex items-center justify-center gap-2 ${activeTab === 'vendas_pix' ? 'bg-teal-600 text-white shadow-lg' : 'text-gray-400 hover:text-gray-900'}`}><DollarSign size={14}/> Vendas Pix</button>
            <button onClick={() => setActiveTab('receipts')} className={`flex-1 lg:flex-none px-6 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all whitespace-nowrap ${activeTab === 'receipts' ? 'bg-gray-900 text-white shadow-lg' : 'text-gray-400 hover:text-gray-900'}`}>Recibos</button>
            <button onClick={() => setActiveTab('cash_errors')} className={`flex-1 lg:flex-none px-6 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all whitespace-nowrap ${activeTab === 'cash_errors' ? 'bg-red-600 text-white shadow-lg' : 'text-gray-400 hover:text-gray-900'}`}>Quebras</button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 bg-white p-6 rounded-[32px] shadow-sm border border-gray-100 items-center">
        {/* Totais Rápidos */}
        <div className="md:col-span-12 grid grid-cols-2 md:grid-cols-4 gap-4 mb-2">
            <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100">
                <p className="text-[8px] font-black text-blue-400 uppercase tracking-widest mb-1">Total Cartão (Período)</p>
                <p className="text-xl font-black text-blue-900 italic">{formatCurrency(stats.totalCards)}</p>
            </div>
            <div className="bg-teal-50 p-4 rounded-2xl border border-teal-100">
                <p className="text-[8px] font-black text-teal-400 uppercase tracking-widest mb-1">Total Pix (Período)</p>
                <p className="text-xl font-black text-teal-900 italic">{formatCurrency(stats.totalPix)}</p>
            </div>
            <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100">
                <p className="text-[8px] font-black text-emerald-400 uppercase tracking-widest mb-1">Total Recibos (Período)</p>
                <p className="text-xl font-black text-emerald-900 italic">{formatCurrency(stats.totalReceipts)}</p>
            </div>
            <div className="bg-red-50 p-4 rounded-2xl border border-red-100">
                <p className="text-[8px] font-black text-red-400 uppercase tracking-widest mb-1">Quebras (Período)</p>
                <p className="text-xl font-black text-red-900 italic">
                    {formatCurrency(cashErrors.filter(e => {
                        const matchesDate = checkDateInRange(String(e.date));
                        const matchesStore = can('ALWAYS') 
                          ? (!selectedStoreId || e.storeId === selectedStoreId)
                          : e.storeId === currentUser?.storeId;
                        return matchesDate && matchesStore;
                    }).reduce((acc, curr) => acc + (curr.value || 0), 0))}
                </p>
            </div>
        </div>

        {/* Filtro de Loja (Admin) */}
        {can('ALWAYS') && (
            <div className="md:col-span-12 bg-blue-50/30 px-5 py-4 rounded-[20px] border border-blue-100 shadow-inner flex items-center gap-3 mb-2">
                <StoreIcon size={18} className="text-blue-600" />
                <select value={selectedStoreId} onChange={e => setSelectedStoreId(e.target.value)} className="w-full font-black uppercase text-[10px] outline-none bg-transparent border-none p-0 cursor-pointer">
                    <option value="">TODAS AS LOJAS</option>
                    {[...stores].sort((a, b) => (parseInt(a.number) || 0) - (parseInt(b.number) || 0)).map(s => <option key={s.id} value={s.id}>LOJA {s.number} - {s.name}</option>)}
                </select>
            </div>
        )}

        {/* Busca por texto */}
        <div className="md:col-span-4 relative group">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-300" size={20} />
            <input type="text" placeholder="Filtrar lançamentos..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-14 pr-6 py-4 bg-gray-50 border border-gray-100 rounded-[20px] focus:ring-4 focus:ring-blue-50 outline-none font-bold text-gray-700 shadow-inner" />
        </div>

        {/* Filtro de Operador */}
        <div className="md:col-span-3 bg-gray-50 px-5 py-4 rounded-[20px] border border-gray-100 shadow-inner flex items-center gap-3">
            <UserIcon size={18} className="text-blue-600" />
            <select value={filterUser} onChange={e => setFilterUser(e.target.value)} className="w-full font-black uppercase text-[10px] outline-none bg-transparent border-none p-0 cursor-pointer">
                <option value="all">TODOS OPERADORES</option>
                {auditUsers.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
        </div>

        {/* Filtro de Datas (Intervalo) */}
        <div className="md:col-span-5 flex flex-wrap sm:flex-nowrap gap-2 items-center bg-blue-50/50 p-2 rounded-[24px] border border-blue-100">
            <div className="flex-1 bg-white px-4 py-2 rounded-[18px] border border-blue-100 shadow-sm flex flex-col">
                <span className="text-[7px] font-black text-blue-400 uppercase tracking-widest leading-none mb-1">Início</span>
                <div className="flex items-center gap-2">
                    <Calendar className="text-blue-600" size={14} />
                    <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="font-black uppercase text-[10px] outline-none bg-transparent w-full" />
                </div>
            </div>
            
            <ArrowRight size={16} className="text-blue-300 hidden sm:block" />

            <div className="flex-1 bg-white px-4 py-2 rounded-[18px] border border-blue-100 shadow-sm flex flex-col">
                <span className="text-[7px] font-black text-blue-400 uppercase tracking-widest leading-none mb-1">Término</span>
                <div className="flex items-center gap-2">
                    <Calendar className="text-blue-600" size={14} />
                    <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="font-black uppercase text-[10px] outline-none bg-transparent w-full" />
                </div>
            </div>
        </div>
      </div>

      <div className="bg-white rounded-[40px] shadow-xl border border-gray-100 overflow-hidden min-h-[500px]">
        {activeTab === 'vendas_cartao' && (
            <div className="overflow-x-auto">
                <table className="w-full text-left min-w-[1000px]">
                    <thead className="bg-gray-50/80 text-[10px] font-black text-gray-400 uppercase tracking-widest border-b">
                        <tr><th className="px-8 py-5">Horário / Lote</th><th className="px-8 py-5">Operador</th><th className="px-8 py-5">Bandeira</th><th className="px-8 py-5 text-right">Valor</th>{isManagement && <th className="px-8 py-5 text-center">Gestão</th>}</tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 font-bold text-xs">
                        {filteredCardSales.map(c => (
                            <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                                <td className="px-8 py-5">
                                  <div className="text-[10px] font-black text-blue-900">#{c.saleCode}</div>
                                  <div className="text-[8px] text-gray-400 mt-0.5">
                                    {new Date(c.date + 'T12:00:00').toLocaleDateString('pt-BR')} 
                                    {c.createdAt ? ` às ${new Date(c.createdAt).toLocaleTimeString()}` : ''}
                                  </div>
                                </td>
                                <td className="px-8 py-5 uppercase italic text-gray-700">{c.userName || 'Sistema'}</td>
                                <td className="px-8 py-5">
                                    <div className="flex items-center gap-2">
                                        <img 
                                            src={getCardFlagIcon(c.brand)} 
                                            referrerPolicy="no-referrer" 
                                            className="w-5 h-5 object-contain" 
                                            alt="" 
                                        />
                                        <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded border border-blue-100 font-black uppercase text-[9px]">{c.brand}</span>
                                    </div>
                                </td>
                                <td className="px-8 py-5 text-right font-black text-blue-900 italic text-sm">{formatCurrency(c.value)}</td>
                                {isManagement && (
                                    <td className="px-8 py-5 text-center">
                                        <button onClick={() => handleDeleteFinance(c.id, 'financial_card_sales')} className="p-2 text-red-300 hover:text-red-600 transition-all"><Trash2 size={16}/></button>
                                    </td>
                                )}
                            </tr>
                        ))}
                        {filteredCardSales.length === 0 && <tr><td colSpan={5} className="py-20 text-center text-gray-400 uppercase font-black text-xs italic tracking-widest">Nenhum lançamento de cartão no período selecionado.</td></tr>}
                    </tbody>
                </table>
            </div>
        )}

        {activeTab === 'vendas_pix' && (
            <div className="overflow-x-auto">
                <table className="w-full text-left min-w-[1000px]">
                    <thead className="bg-gray-50/80 text-[10px] font-black text-gray-400 uppercase tracking-widest border-b">
                        <tr><th className="px-8 py-5">Horário / Ficha</th><th className="px-8 py-5">Operador</th><th className="px-8 py-5">Cliente</th><th className="px-8 py-5 text-right">Valor</th>{isManagement && <th className="px-8 py-5 text-center">Gestão</th>}</tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 font-bold text-xs">
                        {filteredPixSales.map(p => (
                            <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                                <td className="px-8 py-5">
                                  <div className="text-[10px] font-black text-teal-900">#{p.saleCode}</div>
                                  <div className="text-[8px] text-gray-400 mt-0.5">
                                    {new Date(p.date + 'T12:00:00').toLocaleDateString('pt-BR')} 
                                    {p.createdAt ? ` às ${new Date(p.createdAt).toLocaleTimeString()}` : ''}
                                  </div>
                                </td>
                                <td className="px-8 py-5 uppercase italic text-gray-700">{p.userName || 'Sistema'}</td>
                                <td className="px-8 py-5 uppercase text-gray-600 italic text-[10px]">{p.clientName || 'NÃO INFORMADO'}</td>
                                <td className="px-8 py-5 text-right font-black text-teal-900 italic text-sm">{formatCurrency(p.value)}</td>
                                {isManagement && (
                                    <td className="px-8 py-5 text-center">
                                        <button onClick={() => handleDeleteFinance(p.id, 'financial_pix_sales')} className="p-2 text-red-300 hover:text-red-600 transition-all"><Trash2 size={16}/></button>
                                    </td>
                                )}
                            </tr>
                        ))}
                        {filteredPixSales.length === 0 && <tr><td colSpan={5} className="py-20 text-center text-gray-400 uppercase font-black text-xs italic tracking-widest">Nenhum lançamento de Pix no período selecionado.</td></tr>}
                    </tbody>
                </table>
            </div>
        )}

        {activeTab === 'logs' && (
            <div className="overflow-x-auto">
                <table className="w-full text-left min-w-[1000px]">
                    <thead className="bg-gray-50/80 text-[10px] font-black text-gray-400 uppercase tracking-widest border-b">
                        <tr><th className="px-8 py-5">Data/Hora</th><th className="px-8 py-5">Usuário</th><th className="px-8 py-5">Ação</th><th className="px-8 py-5">Detalhes</th></tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 font-bold text-[10px]">
                        {logs.filter(l => checkDateInRange(l.created_at)).map(log => (
                            <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                                <td className="px-8 py-5 text-gray-400 font-mono text-[10px]">
                                  {new Date(log.created_at).toLocaleDateString('pt-BR')} 
                                  <span className="block mt-0.5">{new Date(log.created_at).toLocaleTimeString('pt-BR')}</span>
                                </td>
                                <td className="px-8 py-5 text-gray-900 uppercase italic text-xs tracking-tighter">{log.userName}</td>
                                <td className="px-8 py-5"><span className="bg-blue-50 text-blue-700 px-3 py-1 rounded-lg text-[9px] font-black uppercase border border-blue-100">{log.action}</span></td>
                                <td className="px-8 py-5 text-gray-500 text-xs leading-relaxed">{log.details}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        )}

        {activeTab === 'receipts' && (
            <div className="overflow-x-auto">
                <table className="w-full text-left min-w-[1000px]">
                    <thead className="bg-gray-50/80 text-[10px] font-black text-gray-400 uppercase tracking-widest border-b">
                        <tr><th className="px-8 py-5">Nº / Data</th><th className="px-8 py-5">Payer (Loja)</th><th className="px-8 py-5">Recipient</th><th className="px-8 py-5 text-right">Valor</th><th className="px-8 py-5 text-center">Ações</th></tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 font-bold">
                        {receipts.filter(r => {
                            const matchesDate = checkDateInRange(String(r.date));
                            const matchesStore = can('ALWAYS') 
                              ? (!selectedStoreId || r.storeId === selectedStoreId)
                              : r.storeId === currentUser?.storeId;
                            return matchesDate && matchesStore;
                        }).map(r => (
                            <tr key={r.id} className="hover:bg-gray-50">
                                <td className="px-8 py-5">
                                  <div className="font-black text-blue-900 text-xs italic">#{String(r.id).padStart(4, '0')}</div>
                                  <div className="text-[9px] text-gray-400">{new Date(r.date + 'T12:00:00').toLocaleDateString('pt-BR')}</div>
                                </td>
                                <td className="px-8 py-5 text-gray-900 uppercase italic text-xs truncate max-w-[200px]">{r.payer}</td>
                                <td className="px-8 py-5 text-gray-900 uppercase italic text-xs truncate max-w-[200px]">{r.recipient}</td>
                                <td className="px-8 py-5 text-right font-black text-blue-900 text-base">{formatCurrency(r.value)}</td>
                                <td className="px-8 py-5 text-center">
                                    <button onClick={() => printReceiptDoc({...r})} className="p-2.5 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-600 hover:text-white transition-all"><Printer size={16} /></button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        )}

        {activeTab === 'cash_errors' && (
            <div className="overflow-x-auto">
                <table className="w-full text-left min-w-[1000px]">
                    <thead className="bg-gray-50/80 text-[10px] font-black text-gray-400 uppercase tracking-widest border-b">
                        <tr><th className="px-8 py-5">Data / Operador</th><th className="px-8 py-5">Tipo</th><th className="px-8 py-5">Motivo</th><th className="px-8 py-5 text-right">Valor</th></tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 font-bold">
                        {cashErrors.filter(e => {
                            const matchesDate = checkDateInRange(String(e.date));
                            const matchesStore = can('ALWAYS') 
                              ? (!selectedStoreId || e.storeId === selectedStoreId)
                              : e.storeId === currentUser?.storeId;
                            return matchesDate && matchesStore;
                        }).map(err => (
                            <tr key={err.id} className="hover:bg-red-50/30">
                                <td className="px-8 py-5">
                                  <div className="text-blue-950 uppercase italic text-xs leading-none mb-1">{err.userName}</div>
                                  <div className="text-[9px] text-gray-400">{new Date(err.date + 'T12:00:00').toLocaleDateString('pt-BR')}</div>
                                </td>
                                <td className="px-8 py-5"><span className={`px-3 py-1 rounded-lg text-[9px] font-black border ${err.type === 'shortage' ? 'bg-red-50 text-red-700 border-red-100' : 'bg-green-50 text-green-700 border-green-100'}`}>{err.type === 'shortage' ? 'FALTA (-)' : 'SOBRA (+)'}</span></td>
                                <td className="px-8 py-5 text-gray-500 text-xs max-w-xs truncate">{err.reason}</td>
                                <td className={`px-8 py-5 text-right font-black text-base italic ${err.type === 'shortage' ? 'text-red-600' : 'text-green-600'}`}>{formatCurrency(err.value)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        )}
    </div>

      {/* Modal de Confirmação Customizado */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[300] p-4">
          <div className="bg-white rounded-[32px] w-full max-w-sm shadow-2xl animate-in zoom-in duration-200 overflow-hidden">
            <div className="p-8 text-center">
              <div className="w-16 h-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6">
                <AlertTriangle size={32} />
              </div>
              <h3 className="text-xl font-black text-gray-900 uppercase italic tracking-tighter mb-2">{confirmModal.title}</h3>
              <p className="text-sm font-bold text-gray-500 leading-relaxed">{confirmModal.message}</p>
            </div>
            <div className="flex border-t border-gray-100">
              <button 
                onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                className="flex-1 py-6 text-[10px] font-black uppercase text-gray-400 hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={confirmModal.onConfirm}
                className="flex-1 py-6 text-[10px] font-black uppercase text-red-600 hover:bg-red-50 transition-colors border-l border-gray-100"
              >
                Confirmar Exclusão
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast de Notificação */}
      {toast.show && (
        <div className={`fixed bottom-24 left-1/2 -translate-x-1/2 z-[400] px-6 py-3 rounded-2xl shadow-2xl animate-in slide-in-from-bottom-4 duration-300 flex items-center gap-3 border ${
          toast.type === 'success' ? 'bg-emerald-600 border-emerald-500 text-white' : 'bg-red-600 border-red-500 text-white'
        }`}>
          {toast.type === 'success' ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
          <span className="text-[10px] font-black uppercase tracking-widest">{toast.message}</span>
        </div>
      )}
    </div>
  );
};

export default SystemAudit;