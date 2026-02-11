import React, { useState, useMemo } from 'react';
import { SystemLog, Receipt, Store, CashError, IceCreamDailySale, IceCreamPromissoryNote, UserRole, User } from '../types';
import { formatCurrency, BRAND_LOGO } from '../constants';
import { Shield, Search, Printer, IceCream, FileText, AlertTriangle, History, ChevronRight, CheckCircle2 } from 'lucide-react';
import { printReceiptDoc } from './CashRegisterModule';

interface SystemAuditProps {
  logs: SystemLog[];
  receipts: Receipt[];
  store?: Store;
  cashErrors: CashError[];
  iceCreamSales: IceCreamDailySale[];
  icPromissories: IceCreamPromissoryNote[];
  currentUser?: User;
}

const SystemAudit: React.FC<SystemAuditProps> = ({ logs, receipts, store, cashErrors, iceCreamSales, icPromissories, currentUser }) => {
  const [activeTab, setActiveTab] = useState<'logs' | 'receipts' | 'cash_errors' | 'sorvetes'>('logs');
  const [searchTerm, setSearchTerm] = useState('');

  const isManagement = currentUser?.role === UserRole.ADMIN || currentUser?.role === UserRole.MANAGER;

  const filteredLogs = logs.filter(log => 
    log.details.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.userName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredIceCream = iceCreamSales.filter(s => 
      s.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.buyer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.saleCode?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredReceipts = receipts.filter(r => 
      r.recipient.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.payer.toLowerCase().includes(searchTerm.toLowerCase()) ||
      String(r.id).includes(searchTerm)
  );

  const filteredErrors = cashErrors.filter(e => 
      e.reason?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.userName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-4 md:p-8 max-w-[1600px] mx-auto space-y-6 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
        <div>
          <h2 className="text-2xl md:text-3xl font-black text-gray-900 flex items-center gap-4 uppercase italic tracking-tighter leading-none">
            <Shield className="text-red-600" size={36} />
            Central de <span className="text-blue-700">Conformidade</span>
          </h2>
          <p className="text-gray-400 font-bold text-[10px] uppercase tracking-widest mt-2 ml-1">Monitoramento Operacional v6.5</p>
        </div>
        
        <div className="flex bg-white p-1 rounded-2xl border border-gray-200 shadow-sm overflow-x-auto no-scrollbar w-full lg:w-auto">
            <button onClick={() => setActiveTab('logs')} className={`flex-1 lg:flex-none px-6 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all whitespace-nowrap ${activeTab === 'logs' ? 'bg-gray-950 text-white shadow-lg' : 'text-gray-400 hover:text-gray-900'}`}>Atividade</button>
            <button onClick={() => setActiveTab('receipts')} className={`flex-1 lg:flex-none px-6 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all whitespace-nowrap ${activeTab === 'receipts' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-400 hover:text-gray-900'}`}>Recibos</button>
            <button onClick={() => setActiveTab('cash_errors')} className={`flex-1 lg:flex-none px-6 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all whitespace-nowrap ${activeTab === 'cash_errors' ? 'bg-red-600 text-white shadow-lg' : 'text-gray-400 hover:text-gray-900'}`}>Quebras</button>
            <button onClick={() => setActiveTab('sorvetes')} className={`flex-1 lg:flex-none px-6 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all whitespace-nowrap flex items-center justify-center gap-2 ${activeTab === 'sorvetes' ? 'bg-blue-900 text-white shadow-lg' : 'text-gray-400 hover:text-gray-900'}`}><IceCream size={14}/> Sorvetes</button>
        </div>
      </div>

      <div className="relative group">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-300 group-focus-within:text-blue-600 transition-colors" size={20} />
          <input type="text" placeholder="Filtrar registros históricos em qualquer coluna..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-14 pr-6 py-4 bg-white border border-gray-200 rounded-[24px] focus:ring-8 focus:ring-blue-50 outline-none shadow-sm font-bold text-gray-700 placeholder-gray-300 transition-all" />
      </div>

      <div className="bg-white rounded-[40px] shadow-xl border border-gray-100 overflow-hidden min-h-[500px]">
        <div className="overflow-x-auto no-scrollbar">
            {activeTab === 'sorvetes' && (
                <table className="w-full text-left min-w-[1000px]">
                    <thead>
                        <tr className="bg-gray-50/50 text-[10px] font-black text-gray-400 uppercase tracking-widest border-b">
                            <th className="px-8 py-5">Cod. Venda / Data</th>
                            <th className="px-8 py-5">Produto</th>
                            <th className="px-8 py-5">Pagamento</th>
                            <th className="px-8 py-5">Comprador</th>
                            <th className="px-8 py-5 text-right">Valor</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 font-bold">
                        {filteredIceCream.map(sale => (
                            <tr key={sale.id} className="hover:bg-blue-50/30 transition-colors">
                                <td className="px-8 py-5">
                                    <div className="text-blue-900 font-black text-xs italic tracking-tighter">#{sale.saleCode}</div>
                                    <div className="text-[9px] text-gray-400 uppercase mt-0.5">{new Date(sale.createdAt!).toLocaleString('pt-BR')}</div>
                                </td>
                                <td className="px-8 py-5 uppercase italic text-sm text-gray-900 leading-tight">{sale.unitsSold}x {sale.productName}</td>
                                <td className="px-8 py-5">
                                    <span className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase border ${sale.paymentMethod === 'Fiado' ? 'bg-red-50 text-red-700 border-red-100' : 'bg-green-50 text-green-700 border-green-100'}`}>{sale.paymentMethod}</span>
                                </td>
                                <td className="px-8 py-5 text-gray-500 uppercase italic text-xs truncate max-w-[150px]">{sale.buyer_name || '-'}</td>
                                <td className="px-8 py-5 text-right font-black text-blue-900 text-base italic tracking-tighter">{formatCurrency(sale.totalValue)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
            
            {activeTab === 'logs' && (
                <table className="w-full text-left min-w-[1000px]">
                    <thead className="bg-gray-50/50 text-[10px] font-black text-gray-400 uppercase tracking-widest border-b">
                        <tr><th className="px-8 py-5 w-48">Data/Hora</th><th className="px-8 py-5">Usuário</th><th className="px-8 py-5">Ação</th><th className="px-8 py-5">Detalhes</th></tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 font-bold">
                        {filteredLogs.map(log => (
                            <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                                <td className="px-8 py-5 text-gray-400 font-mono text-[10px]">{new Date(log.created_at).toLocaleString('pt-BR')}</td>
                                <td className="px-8 py-5 text-gray-900 uppercase italic text-xs tracking-tighter">{log.userName}</td>
                                <td className="px-8 py-5"><span className="bg-blue-50 text-blue-700 px-3 py-1 rounded-lg text-[9px] font-black uppercase border border-blue-100">{log.action}</span></td>
                                <td className="px-8 py-5 text-gray-500 text-xs leading-relaxed">{log.details}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}

            {activeTab === 'receipts' && (
                <table className="w-full text-left min-w-[1000px]">
                    <thead className="bg-gray-50/50 text-[10px] font-black text-gray-400 uppercase tracking-widest border-b">
                        <tr><th className="px-8 py-5">Nº / Data</th><th className="px-8 py-5">Payer (Loja)</th><th className="px-8 py-5">Recipient</th><th className="px-8 py-5 text-right">Valor</th><th className="px-8 py-5 text-center">Ações</th></tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 font-bold">
                        {filteredReceipts.map(r => (
                            <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                                <td className="px-8 py-5 font-black text-blue-900 text-xs tracking-tighter italic">#{String(r.id).padStart(4, '0')} <span className="block text-[9px] text-gray-400 mt-1 not-italic font-bold">{new Date(r.date + 'T12:00:00').toLocaleDateString('pt-BR')}</span></td>
                                <td className="px-8 py-5 text-gray-900 uppercase italic text-xs truncate max-w-[200px]">{r.payer}</td>
                                <td className="px-8 py-5 text-gray-900 uppercase italic text-xs truncate max-w-[200px]">{r.recipient}</td>
                                <td className="px-8 py-5 text-right font-black text-blue-900 text-base italic tracking-tighter">{formatCurrency(r.value)}</td>
                                <td className="px-8 py-5 text-center">
                                    {isManagement && (
                                        <button 
                                            onClick={() => printReceiptDoc({...r})} 
                                            className="p-2.5 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-600 hover:text-white transition-all shadow-sm flex items-center gap-2 mx-auto"
                                        >
                                            <Printer size={16} /> <span className="text-[10px] font-black uppercase">Reimprimir</span>
                                        </button>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}

            {activeTab === 'cash_errors' && (
                <table className="w-full text-left min-w-[1000px]">
                    <thead className="bg-gray-50/50 text-[10px] font-black text-gray-400 uppercase tracking-widest border-b">
                        <tr><th className="px-8 py-5">Data / Hora</th><th className="px-8 py-5">Tipo</th><th className="px-8 py-5">Operador</th><th className="px-8 py-5">Motivo</th><th className="px-8 py-5 text-right">Valor</th></tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 font-bold">
                        {filteredErrors.map(err => (
                            <tr key={err.id} className="hover:bg-red-50/30 transition-colors">
                                <td className="px-8 py-5">
                                    <div className="text-gray-900 text-xs font-black">{new Date(err.date + 'T12:00:00').toLocaleDateString('pt-BR')}</div>
                                    <div className="text-[8px] text-gray-400 uppercase mt-0.5">{new Date(err.createdAt).toLocaleTimeString()}</div>
                                </td>
                                <td className="px-8 py-5">
                                    <span className={`px-3 py-1 rounded-lg text-[9px] font-black border ${err.type === 'shortage' ? 'bg-red-50 text-red-700 border-red-100' : 'bg-green-50 text-green-700 border-green-100'}`}>
                                        {err.type === 'shortage' ? 'FALTA (-)' : 'SOBRA (+)'}
                                    </span>
                                </td>
                                <td className="px-8 py-5 text-blue-950 uppercase italic text-xs tracking-tighter">{err.userName}</td>
                                <td className="px-8 py-5 text-gray-500 text-xs leading-relaxed max-w-xs truncate">{err.reason}</td>
                                <td className={`px-8 py-5 text-right font-black text-base italic tracking-tighter ${err.type === 'shortage' ? 'text-red-600' : 'text-green-600'}`}>
                                    {formatCurrency(err.value)}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </div>
      </div>
      
      {isManagement && (
          <div className="bg-gray-950 p-8 rounded-[40px] text-white flex flex-col md:flex-row justify-between items-center shadow-2xl border-t-4 border-red-600 gap-6">
              <div className="flex items-center gap-5">
                  <div className="p-4 bg-white/5 rounded-3xl"><CheckCircle2 className="text-red-500" size={32}/></div>
                  <div>
                      <h4 className="text-lg font-black uppercase italic tracking-tighter leading-none">Relatórios <span className="text-red-600">de Auditoria</span></h4>
                      <p className="text-[9px] font-bold text-gray-400 uppercase mt-2 tracking-widest leading-none">Exportação e conferência definitiva do período</p>
                  </div>
              </div>
              <div className="flex gap-3">
                  <button className="px-8 py-4 bg-white/5 border border-white/10 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-white/10 transition-all flex items-center gap-2"><FileText size={18}/> Exportar Log</button>
                  <button className="px-8 py-4 bg-red-600 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl active:scale-95 transition-all flex items-center gap-2 border-b-4 border-red-900"><Printer size={18}/> Imprimir Quebras do Dia</button>
              </div>
          </div>
      )}
    </div>
  );
};

export default SystemAudit;