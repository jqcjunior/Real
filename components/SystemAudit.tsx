
import React, { useState } from 'react';
import { SystemLog, Receipt, Store, CashError, IceCreamDailySale, IceCreamPromissoryNote } from '../types';
import { formatCurrency, BRAND_LOGO } from '../constants';
import { Shield, Search, TrendingUp, TrendingDown, Printer, FileText, AlertCircle, Clock, IceCream, History, UserCheck, AlertTriangle, ChevronRight } from 'lucide-react';

interface SystemAuditProps {
  logs: SystemLog[];
  receipts: Receipt[];
  store?: Store;
  cashErrors: CashError[];
  iceCreamSales: IceCreamDailySale[];
  icPromissories: IceCreamPromissoryNote[];
  onLogAction?: (action: string, details: string) => Promise<void>;
}

const SystemAudit: React.FC<SystemAuditProps> = ({ logs, receipts, store, cashErrors, iceCreamSales, icPromissories, onLogAction }) => {
  const [activeTab, setActiveTab] = useState<'logs' | 'receipts' | 'cash_errors' | 'sorvetes'>('logs');
  const [searchTerm, setSearchTerm] = useState('');

  const filteredLogs = logs.filter(log => 
    log.details.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.userName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredIceCream = iceCreamSales.filter(s => 
      s.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.buyer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.saleCode?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-4 md:p-8 max-w-[1600px] mx-auto space-y-6 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
        <div>
          <h2 className="text-2xl md:text-3xl font-black text-gray-900 flex items-center gap-4 uppercase italic tracking-tighter leading-none">
            <Shield className="text-red-600" size={36} />
            Central de <span className="text-blue-700">Conformidade</span>
          </h2>
          <p className="text-gray-400 font-bold text-[10px] uppercase tracking-widest mt-2 ml-1">Monitoramento Operacional v6.4</p>
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
          <input type="text" placeholder="Filtrar registros históricos..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-14 pr-6 py-4 bg-white border border-gray-200 rounded-[24px] focus:ring-8 focus:ring-blue-50 outline-none shadow-sm font-bold text-gray-700 placeholder-gray-300 transition-all" />
      </div>

      <div className="bg-white rounded-[40px] shadow-xl border border-gray-100 overflow-hidden">
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
                                    <div className="text-red-600 font-black text-xs italic tracking-tighter">#{sale.saleCode || 'GEL-000'}</div>
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
                        <tr><th className="px-8 py-5">Nº / Data</th><th className="px-8 py-5">Payer (Loja)</th><th className="px-8 py-5">Recipient</th><th className="px-8 py-5 text-right">Valor</th></tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 font-bold">
                        {receipts.map(r => (
                            <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                                <td className="px-8 py-5 font-black text-blue-900 text-xs tracking-tighter italic">#{r.id} <span className="block text-[9px] text-gray-400 mt-1 not-italic font-bold">{new Date(r.date + 'T00:00:00').toLocaleDateString('pt-BR')}</span></td>
                                <td className="px-8 py-5 text-gray-900 uppercase italic text-xs truncate max-w-[200px]">{r.payer}</td>
                                <td className="px-8 py-5 text-gray-900 uppercase italic text-xs truncate max-w-[200px]">{r.recipient}</td>
                                <td className="px-8 py-5 text-right font-black text-blue-900 text-base italic tracking-tighter">{formatCurrency(r.value)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </div>
      </div>
    </div>
  );
};

export default SystemAudit;
