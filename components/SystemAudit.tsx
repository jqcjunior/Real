
import React, { useState } from 'react';
import { SystemLog, Receipt, Store, CashError } from '../types';
import { formatCurrency, BRAND_LOGO } from '../constants';
import { Shield, Search, TrendingUp, TrendingDown, Printer, FileText, AlertCircle, Clock } from 'lucide-react';

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
    r.recipient.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.id.toLowerCase().includes(searchTerm.toLowerCase())
  ).sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

  const filteredCashErrors = cashErrors.filter(e => 
      e.reason?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.userName.toLowerCase().includes(searchTerm.toLowerCase())
  ).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // --- FUNÇÃO DE REIMPRESSÃO COM TARJA DE AUDITORIA ---
  const handleReprint = (receipt: Receipt) => {
    const printWindow = window.open('', '_blank', 'width=800,height=600');
    if (!printWindow) return;

    const logoUrl = window.location.origin + BRAND_LOGO;
    const [y, m, d] = receipt.date.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    const formattedDate = dateObj.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });
    const formattedValue = formatCurrency(receipt.value);
    const reprintTime = new Date().toLocaleString('pt-BR');

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
          <title>REIMPRESSÃO - Recibo #${receipt.id}</title>
          <script src="https://cdn.tailwindcss.com"></script>
          <style>
              @page { size: portrait; margin: 0; }
              body { margin: 0; padding: 10mm; background: white; font-family: 'Times New Roman', serif; }
              .custom-page { width: 180mm; height: 120mm; position: relative; box-sizing: border-box; display: flex; flex-direction: column; justify-content: space-between; }
              .handwritten { font-family: 'Courier New', Courier, monospace; font-weight: bold; }
              .reprint-watermark { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-30deg); font-size: 80px; font-weight: 900; color: rgba(0,0,0,0.05); pointer-events: none; text-transform: uppercase; white-space: nowrap; z-index: 0; }
          </style>
      </head>
      <body>
          <div class="custom-page">
              <div class="border-2 border-double border-gray-800 h-full p-4 flex flex-col justify-between relative bg-white">
                  <div class="reprint-watermark">REIMPRESSÃO</div>
                  
                  <!-- Tarja de Auditoria -->
                  <div class="absolute -top-1 right-10 bg-black text-white px-4 py-1 text-[8px] font-black uppercase tracking-widest rounded-b-lg">
                      Documento Reimpresso via Auditoria em ${reprintTime}
                  </div>

                  <div class="relative z-10 flex flex-col h-full">
                      <div class="w-full flex justify-between items-center mb-2 border-b border-gray-800 pb-2">
                          <div class="flex items-center gap-3">
                              <img src="${logoUrl}" style="height: 50px; border-radius: 99px;" />
                              <div>
                                  <h1 class="text-xl font-black text-gray-900 uppercase italic leading-none">Real <span class="text-red-600">Calçados</span></h1>
                                  <p class="text-[9px] text-gray-600 font-bold">Comprovante de Pagamento (Auditado)</p>
                              </div>
                          </div>
                          <div class="text-right">
                              <div class="flex items-center justify-end gap-2">
                                  <h2 class="text-xl font-black text-gray-400 uppercase tracking-widest leading-none">RECIBO</h2>
                                  <p class="text-sm font-bold text-red-600 leading-none">Nº ${receipt.id.substring(0, 8).toUpperCase()}</p>
                              </div>
                              <div class="mt-1 border border-gray-300 rounded px-2 py-1 bg-gray-50 inline-block">
                                  <span class="text-[10px] font-bold text-gray-500 mr-2">VALOR</span>
                                  <span class="text-lg font-bold text-gray-900 handwritten">${formattedValue}</span>
                              </div>
                          </div>
                      </div>

                      <div class="w-full space-y-2 text-gray-800 text-sm flex-1 pt-4">
                          <p>Recebi(emos) de <span class="font-bold border-b border-dotted border-gray-400 px-2 handwritten text-black">${receipt.payer}</span></p>
                          <p>a quantia de <span class="font-bold italic bg-gray-100 px-2 py-0.5 rounded border border-gray-200 uppercase text-[10px] text-gray-900">${receipt.valueInWords}</span></p>
                          <p>referente a <span class="border-b border-dotted border-gray-400 px-2 font-medium handwritten text-black">${receipt.reference}</span>.</p>
                      </div>

                      <div class="w-full mt-2 flex flex-col items-center justify-center text-center">
                          <div class="text-gray-800 font-medium mb-6 text-xs italic">Sincronizado em Auditoria - ${formattedDate}</div>
                          <div class="w-3/4 border-t border-black pt-1">
                              <p class="font-bold text-black uppercase text-sm">${receipt.recipient}</p>
                              <p class="text-[8px] text-gray-500 uppercase font-bold tracking-wider">Recebedor / Assinatura</p>
                          </div>
                      </div>
                  </div>
              </div>
          </div>
          <script>window.onload = () => setTimeout(() => window.print(), 500);</script>
      </body>
      </html>
    `;
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  return (
    <div className="p-6 md:p-8 max-w-[1600px] mx-auto space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h2 className="text-3xl font-black text-gray-900 flex items-center gap-3 uppercase italic tracking-tighter">
            <Shield className="text-red-600" size={36} />
            Central de <span className="text-blue-700">Conformidade</span>
          </h2>
          <p className="text-gray-500 font-bold text-xs uppercase tracking-widest mt-1">Auditoria unificada de operações financeiras</p>
        </div>
        
        <div className="flex bg-white p-1.5 rounded-2xl border border-gray-200 shadow-sm">
            <button onClick={() => setActiveTab('logs')} className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase transition-all ${activeTab === 'logs' ? 'bg-gray-900 text-white shadow-lg' : 'text-gray-500 hover:text-gray-900'}`}>Logs de Sistema</button>
            <button onClick={() => setActiveTab('receipts')} className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase transition-all ${activeTab === 'receipts' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-500 hover:text-gray-900'}`}>Recibos Emitidos</button>
            <button onClick={() => setActiveTab('cash_errors')} className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase transition-all ${activeTab === 'cash_errors' ? 'bg-red-600 text-white shadow-lg' : 'text-gray-500 hover:text-gray-900'}`}>Erros de Caixa</button>
        </div>
      </div>

      <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <input 
              type="text"
              placeholder="Buscar por ID, pagador, recebedor ou motivo..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-6 py-4 bg-white border border-gray-200 rounded-2xl focus:ring-4 focus:ring-blue-100 outline-none shadow-inner font-bold text-gray-700"
          />
      </div>

      <div className="bg-white rounded-[40px] shadow-xl border border-gray-100 overflow-hidden">
        {activeTab === 'logs' && (
            <table className="w-full text-left text-sm">
                <thead className="bg-gray-50/50 text-[10px] font-black text-gray-400 uppercase tracking-widest border-b">
                    <tr>
                        <th className="px-8 py-5">Data/Hora</th>
                        <th className="px-8 py-5">Usuário</th>
                        <th className="px-8 py-5">Ação</th>
                        <th className="px-8 py-5">Detalhes da Atividade</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 font-bold">
                    {filteredLogs.map(log => (
                        <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-8 py-5 text-gray-500 font-mono text-xs">
                                {new Date(log.created_at).toLocaleString('pt-BR')}
                            </td>
                            <td className="px-8 py-5 text-gray-900 uppercase italic">{log.userName}</td>
                            <td className="px-8 py-5">
                                <span className="bg-blue-50 text-blue-700 px-3 py-1.5 rounded-xl text-[10px] font-black border border-blue-100 uppercase">
                                    {log.action}
                                </span>
                            </td>
                            <td className="px-8 py-5 text-gray-600">{log.details}</td>
                        </tr>
                    ))}
                    {filteredLogs.length === 0 && (
                        <tr><td colSpan={4} className="p-20 text-center"><AlertCircle className="mx-auto text-gray-200 mb-4" size={48}/><p className="text-gray-400 font-black uppercase text-xs">Sem registros para exibir</p></td></tr>
                    )}
                </tbody>
            </table>
        )}

        {activeTab === 'receipts' && (
            <table className="w-full text-left text-sm">
                <thead className="bg-gray-50/50 text-[10px] font-black text-gray-400 uppercase tracking-widest border-b">
                    <tr>
                        <th className="px-8 py-5">ID / Emissão</th>
                        <th className="px-8 py-5">Pagador</th>
                        <th className="px-8 py-5">Recebedor</th>
                        <th className="px-8 py-5 text-right">Valor</th>
                        <th className="px-8 py-5 text-center">Ações de Auditoria</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 font-bold">
                    {filteredReceipts.map(receipt => (
                        <tr key={receipt.id} className="hover:bg-blue-50/30 transition-colors group">
                            <td className="px-8 py-5">
                                <div className="flex flex-col">
                                    <span className="text-red-600 font-black text-xs">#{receipt.id.substring(0, 8).toUpperCase()}</span>
                                    <span className="text-[10px] text-gray-400 flex items-center gap-1 mt-1"><Clock size={10}/> {new Date(receipt.createdAt).toLocaleDateString('pt-BR')}</span>
                                </div>
                            </td>
                            <td className="px-8 py-5 text-gray-900 uppercase italic">{receipt.payer}</td>
                            <td className="px-8 py-5 text-gray-900 uppercase italic">{receipt.recipient}</td>
                            <td className="px-8 py-5 text-right font-black text-green-700 text-base">{formatCurrency(receipt.value)}</td>
                            <td className="px-8 py-5 text-center">
                                <button 
                                    onClick={() => handleReprint(receipt)}
                                    className="px-4 py-2 bg-gray-100 hover:bg-blue-600 hover:text-white text-gray-600 rounded-xl transition-all font-black text-[10px] uppercase flex items-center gap-2 mx-auto shadow-sm"
                                >
                                    <Printer size={14} /> Reimprimir
                                </button>
                            </td>
                        </tr>
                    ))}
                    {filteredReceipts.length === 0 && (
                        <tr><td colSpan={5} className="p-20 text-center"><FileText className="mx-auto text-gray-200 mb-4" size={48}/><p className="text-gray-400 font-black uppercase text-xs">Nenhum recibo arquivado no banco de dados</p></td></tr>
                    )}
                </tbody>
            </table>
        )}

        {activeTab === 'cash_errors' && (
            <table className="w-full text-left text-sm">
                <thead className="bg-gray-50/50 text-[10px] font-black text-gray-400 uppercase tracking-widest border-b">
                    <tr>
                        <th className="px-8 py-5">Data Operação</th>
                        <th className="px-8 py-5">Responsável / Unidade</th>
                        <th className="px-8 py-5">Tipo</th>
                        <th className="px-8 py-5 text-right">Valor Diferença</th>
                        <th className="px-8 py-5">Motivo Relatado</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 font-bold">
                    {filteredCashErrors.map(error => (
                        <tr key={error.id} className="hover:bg-red-50/30 transition-colors">
                            <td className="px-8 py-5 text-gray-500 font-mono text-xs">
                                {new Date(error.date + 'T12:00:00').toLocaleDateString('pt-BR')}
                            </td>
                            <td className="px-8 py-5">
                                <div className="text-gray-900 uppercase italic">{error.userName}</div>
                                <div className="text-[9px] text-gray-400 mt-1 uppercase tracking-widest font-black">Loja ID: {error.storeId}</div>
                            </td>
                            <td className="px-8 py-5">
                                {error.type === 'surplus' ? (
                                    <span className="inline-flex items-center gap-2 bg-green-50 text-green-700 px-3 py-1.5 rounded-xl text-[10px] font-black border border-green-200 uppercase">
                                        <TrendingUp size={12}/> Sobra (+)
                                    </span>
                                ) : (
                                    <span className="inline-flex items-center gap-2 bg-red-50 text-red-700 px-3 py-1.5 rounded-xl text-[10px] font-black border border-red-200 uppercase">
                                        <TrendingDown size={12}/> Falta (-)
                                    </span>
                                )}
                            </td>
                            <td className={`px-8 py-5 text-right font-black text-base ${error.type === 'surplus' ? 'text-green-700' : 'text-red-700'}`}>
                                {formatCurrency(error.value)}
                            </td>
                            <td className="px-8 py-5 text-gray-600 italic text-xs max-w-xs truncate" title={error.reason}>
                                {error.reason || 'Sem justificativa.'}
                            </td>
                        </tr>
                    ))}
                    {filteredCashErrors.length === 0 && (
                        <tr><td colSpan={5} className="p-20 text-center"><AlertCircle className="mx-auto text-gray-200 mb-4" size={48}/><p className="text-gray-400 font-black uppercase text-xs">Nenhuma quebra registrada para este filtro</p></td></tr>
                    )}
                </tbody>
            </table>
        )}
      </div>
    </div>
  );
};

export default SystemAudit;
