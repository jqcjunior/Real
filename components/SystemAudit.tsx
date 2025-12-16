import React, { useState } from 'react';
import { SystemLog, Receipt, Store, CashError } from '../types';
import { formatCurrency } from '../constants';
import { Shield, Search, TrendingUp, TrendingDown } from 'lucide-react';

interface SystemAuditProps {
  logs: SystemLog[];
  receipts: Receipt[];
  store?: Store;
  cashErrors: CashError[];
}

const SystemAudit: React.FC<SystemAuditProps> = ({ logs, receipts, store, cashErrors }) => {
  const [activeTab, setActiveTab] = useState<'logs' | 'receipts' | 'cash_errors'>('logs');
  const [searchTerm, setSearchTerm] = useState('');

  const filteredLogs = logs.filter(log => 
    log.details.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.userName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredReceipts = receipts.filter(r => 
    r.payer.toLowerCase().includes(searchTerm.toLowerCase()) || 
    r.recipient.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Sorting cash errors by date descending
  const sortedCashErrors = cashErrors.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // Filter cash errors by search term as well if needed, though mostly logs/receipts are searched
  const filteredCashErrors = sortedCashErrors.filter(e => 
      e.reason?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.userName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-6 md:p-8 max-w-[1600px] mx-auto space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
            <Shield className="text-red-600" size={32} />
            Auditoria do Sistema
          </h2>
          <p className="text-gray-500 mt-1">Monitore logs, recibos emitidos e ocorrências de caixa.</p>
        </div>
        
        <div className="flex bg-white p-1 rounded-lg border border-gray-200 shadow-sm">
            <button onClick={() => setActiveTab('logs')} className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${activeTab === 'logs' ? 'bg-gray-800 text-white shadow' : 'text-gray-500 hover:text-gray-800'}`}>Logs de Sistema</button>
            <button onClick={() => setActiveTab('receipts')} className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${activeTab === 'receipts' ? 'bg-blue-600 text-white shadow' : 'text-gray-500 hover:text-gray-800'}`}>Recibos</button>
            <button onClick={() => setActiveTab('cash_errors')} className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${activeTab === 'cash_errors' ? 'bg-red-600 text-white shadow' : 'text-gray-500 hover:text-gray-800'}`}>Erros de Caixa</button>
        </div>
      </div>

      <div className="relative">
          <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
          <input 
              type="text"
              placeholder="Buscar registros..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none shadow-sm"
          />
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {activeTab === 'logs' && (
            <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 text-gray-500 font-semibold border-b border-gray-100">
                    <tr>
                        <th className="p-4">Data/Hora</th>
                        <th className="p-4">Usuário</th>
                        <th className="p-4">Ação</th>
                        <th className="p-4">Detalhes</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                    {filteredLogs.map(log => (
                        <tr key={log.id} className="hover:bg-gray-50">
                            <td className="p-4 text-gray-500 font-mono text-xs">
                                {new Date(log.timestamp).toLocaleString('pt-BR')}
                            </td>
                            <td className="p-4 font-medium text-gray-900">{log.userName}</td>
                            <td className="p-4">
                                <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs font-bold border border-gray-200">
                                    {log.action}
                                </span>
                            </td>
                            <td className="p-4 text-gray-600">{log.details}</td>
                        </tr>
                    ))}
                    {filteredLogs.length === 0 && (
                        <tr><td colSpan={4} className="p-8 text-center text-gray-400">Nenhum log encontrado.</td></tr>
                    )}
                </tbody>
            </table>
        )}

        {activeTab === 'receipts' && (
            <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 text-gray-500 font-semibold border-b border-gray-100">
                    <tr>
                        <th className="p-4">Data</th>
                        <th className="p-4">Número</th>
                        <th className="p-4">Pagador</th>
                        <th className="p-4">Recebedor</th>
                        <th className="p-4 text-right">Valor</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                    {filteredReceipts.map(receipt => (
                        <tr key={receipt.id} className="hover:bg-gray-50">
                            <td className="p-4 text-gray-500 font-mono text-xs">
                                {new Date(receipt.createdAt).toLocaleDateString('pt-BR')}
                            </td>
                            <td className="p-4 font-bold text-gray-800">#{receipt.id}</td>
                            <td className="p-4 text-gray-600">{receipt.payer}</td>
                            <td className="p-4 text-gray-600">{receipt.recipient}</td>
                            <td className="p-4 text-right font-bold text-green-700">{formatCurrency(receipt.value)}</td>
                        </tr>
                    ))}
                    {filteredReceipts.length === 0 && (
                        <tr><td colSpan={5} className="p-8 text-center text-gray-400">Nenhum recibo encontrado.</td></tr>
                    )}
                </tbody>
            </table>
        )}

        {activeTab === 'cash_errors' && (
            <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 text-gray-500 font-semibold border-b border-gray-100">
                    <tr>
                        <th className="p-4">Data</th>
                        <th className="p-4">Responsável</th>
                        <th className="p-4">Loja</th>
                        <th className="p-4">Tipo</th>
                        <th className="p-4 text-right">Valor</th>
                        <th className="p-4">Motivo</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                    {filteredCashErrors.map(error => (
                        <tr key={error.id} className="hover:bg-gray-50 transition-colors">
                            <td className="p-4 font-mono text-xs text-gray-500">
                                {(() => {
                                    if (!error.date) return '-';
                                    const [y, m, d] = error.date.split('-').map(Number);
                                    return new Date(y, m - 1, d).toLocaleDateString('pt-BR');
                                })()}
                            </td>
                            <td className="p-4 font-medium text-gray-900">{error.userName}</td>
                            <td className="p-4 text-gray-500 text-xs font-mono">{error.storeId}</td>
                            <td className="p-4">
                                {error.type === 'surplus' ? (
                                    <span className="inline-flex items-center gap-1 bg-green-100 text-green-700 px-2 py-1 rounded text-[10px] font-bold border border-green-200">
                                        <TrendingUp size={10}/> SOBRA
                                    </span>
                                ) : (
                                    <span className="inline-flex items-center gap-1 bg-red-100 text-red-700 px-2 py-1 rounded text-[10px] font-bold border border-red-200">
                                        <TrendingDown size={10}/> FALTA
                                    </span>
                                )}
                            </td>
                            <td className={`p-4 text-right font-bold ${error.type === 'surplus' ? 'text-green-700' : 'text-red-700'}`}>
                                {formatCurrency(error.value)}
                            </td>
                            <td className="p-4 text-gray-600 italic max-w-xs truncate" title={error.reason}>
                                {error.reason || '-'}
                            </td>
                        </tr>
                    ))}
                    {filteredCashErrors.length === 0 && (
                        <tr><td colSpan={6} className="p-8 text-center text-gray-400">Nenhum registro de erro de caixa encontrado.</td></tr>
                    )}
                </tbody>
            </table>
        )}
      </div>
    </div>
  );
};

export default SystemAudit;