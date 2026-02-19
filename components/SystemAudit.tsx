import React, { useState, useMemo } from 'react';
import { SystemLog, Receipt, Store, CashError, IceCreamDailySale, IceCreamPromissoryNote, UserRole, User, IceCreamTransaction, CreditCardSale } from '../types';
import { formatCurrency, BRAND_LOGO } from '../constants';
import { Shield, Search, Printer, IceCream, FileText, AlertTriangle, History, ChevronRight, CheckCircle2, UserCheck, Calendar, Trash2, Edit3, Filter, X, DollarSign, User as UserIcon, CreditCard, ArrowRight } from 'lucide-react';
import { printReceiptDoc, getCardFlagIcon } from './CashRegisterModule';
import { supabase } from '../services/supabaseClient';

interface SystemAuditProps {
  logs: SystemLog[];
  receipts: Receipt[];
  store?: Store;
  cashErrors: CashError[];
  iceCreamSales: IceCreamDailySale[];
  icPromissories: IceCreamPromissoryNote[];
  finances?: IceCreamTransaction[];
  cardSales?: CreditCardSale[];
  currentUser?: User;
}

const SystemAudit: React.FC<SystemAuditProps> = ({ logs, receipts, store, cashErrors, iceCreamSales, icPromissories, finances = [], cardSales = [], currentUser }) => {
  const [activeTab, setActiveTab] = useState<'logs' | 'receipts' | 'cash_errors' | 'vendas_cartao' | 'conferencia' | 'financeiro'>('logs');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Estados para Intervalo de Datas - Por padrão traz o mês atual
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  });
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  
  const [filterUser, setFilterUser] = useState('all');

  const isManagement = currentUser?.role === UserRole.ADMIN || currentUser?.role === UserRole.MANAGER;

  // Lista de usuários únicos para filtro
  const auditUsers = useMemo(() => {
    const users = new Set<string>();
    logs.forEach(l => { if(l.userName) users.add(l.userName); });
    cardSales.forEach(c => { if(c.userName) users.add(c.userName); });
    return Array.from(users).sort();
  }, [logs, cardSales]);

  const handleDeleteFinance = async (id: string, table: 'ice_cream_finances' | 'financial_card_sales') => {
      if (!isManagement) return;
      if (!window.confirm("Deseja realmente EXCLUIR este registro permanentemente?")) return;
      try {
          const { error } = await supabase.from(table).delete().eq('id', id);
          if (error) throw error;
          alert("Registro removido com sucesso!");
      } catch (e) { alert("Erro ao excluir."); }
  };

  const checkDateInRange = (dateStr: string) => {
    if (!dateStr) return false;
    const d = dateStr.split('T')[0];
    return (!startDate || d >= startDate) && (!endDate || d <= endDate);
  };

  const filteredFinances = useMemo(() => {
      return finances.filter(f => {
          const matchesDate = checkDateInRange(String(f.date));
          const matchesUser = filterUser === 'all' || f.description?.includes(filterUser);
          const matchesSearch = searchTerm === '' || f.description?.toLowerCase().includes(searchTerm.toLowerCase()) || f.category.toLowerCase().includes(searchTerm.toLowerCase());
          return matchesDate && matchesUser && matchesSearch;
      });
  }, [finances, startDate, endDate, filterUser, searchTerm]);

  const filteredCardSales = useMemo(() => {
      return (cardSales || []).filter(c => {
          const saleDate = String(c.date || '').split('T')[0];
          const matchesDate = checkDateInRange(saleDate);
          const matchesUser = filterUser === 'all' || c.userName === filterUser;
          const matchesSearch = searchTerm === '' || 
                                (c.brand || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
                                (c.saleCode || '').toLowerCase().includes(searchTerm.toLowerCase());
          
          const matchesStore = currentUser?.role === UserRole.ADMIN || c.storeId === currentUser?.storeId;
          
          return matchesDate && matchesUser && matchesSearch && matchesStore;
      });
  }, [cardSales, startDate, endDate, filterUser, searchTerm, currentUser]);

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
            <button onClick={() => setActiveTab('financeiro')} className={`flex-1 lg:flex-none px-6 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all whitespace-nowrap flex items-center justify-center gap-2 ${activeTab === 'financeiro' ? 'bg-green-600 text-white shadow-lg' : 'text-gray-400 hover:text-gray-900'}`}><DollarSign size={14}/> Sangrias/DRE</button>
            <button onClick={() => setActiveTab('receipts')} className={`flex-1 lg:flex-none px-6 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all whitespace-nowrap ${activeTab === 'receipts' ? 'bg-gray-900 text-white shadow-lg' : 'text-gray-400 hover:text-gray-900'}`}>Recibos</button>
            <button onClick={() => setActiveTab('cash_errors')} className={`flex-1 lg:flex-none px-6 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all whitespace-nowrap ${activeTab === 'cash_errors' ? 'bg-red-600 text-white shadow-lg' : 'text-gray-400 hover:text-gray-900'}`}>Quebras</button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 bg-white p-6 rounded-[32px] shadow-sm border border-gray-100 items-center">
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
                                        <img src={getCardFlagIcon(c.brand)} className="w-5 h-5 object-contain" alt="" />
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

        {activeTab === 'financeiro' && (
            <div className="overflow-x-auto">
                <table className="w-full text-left min-w-[1000px]">
                    <thead className="bg-gray-50/80 text-[10px] font-black text-gray-400 uppercase tracking-widest border-b">
                        <tr><th className="px-8 py-5">Data / Ref</th><th className="px-8 py-5">Tipo / Categoria</th><th className="px-8 py-5">Descrição</th><th className="px-8 py-5 text-right">Valor</th>{isManagement && <th className="px-8 py-5 text-center">Gestão</th>}</tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 font-bold text-xs">
                        {filteredFinances.map(f => (
                            <tr key={f.id} className="hover:bg-gray-50 transition-colors">
                                <td className="px-8 py-5">
                                  <div className="text-[10px] font-black text-gray-900">{new Date(f.date + 'T12:00:00').toLocaleDateString('pt-BR')}</div>
                                  <div className="text-[8px] text-gray-400 mt-1">{f.createdAt ? new Date(f.createdAt).toLocaleTimeString() : 'ID: ' + f.id.slice(-8)}</div>
                                </td>
                                <td className="px-8 py-5"><span className={`px-2 py-1 rounded text-[9px] font-black border ${f.type === 'entry' ? 'bg-green-50 text-green-700 border-green-100' : 'bg-red-50 text-red-700 border-red-100'}`}>{f.category}</span></td>
                                <td className="px-8 py-5 text-xs text-gray-500 max-w-xs truncate">{f.description}</td>
                                <td className={`px-8 py-5 text-right font-black italic text-sm ${f.type === 'entry' ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(f.value)}</td>
                                {isManagement && (
                                    <td className="px-8 py-5 text-center">
                                        <button onClick={() => handleDeleteFinance(f.id, 'ice_cream_finances')} className="p-2 text-red-300 hover:text-red-600 transition-all"><Trash2 size={16}/></button>
                                    </td>
                                )}
                            </tr>
                        ))}
                        {filteredFinances.length === 0 && <tr><td colSpan={5} className="py-20 text-center text-gray-400 uppercase font-black text-xs italic tracking-widest">Nenhum registro financeiro no período selecionado.</td></tr>}
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
                        {receipts.filter(r => checkDateInRange(String(r.date))).map(r => (
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
                        {cashErrors.filter(e => checkDateInRange(String(e.date))).map(err => (
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
    </div>
  );
};

export default SystemAudit;