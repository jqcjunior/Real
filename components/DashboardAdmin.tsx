
import React, { useState, useMemo, useRef } from 'react';
import { Store, MonthlyPerformance } from '../types';
import { formatCurrency } from '../constants';
import { TrendingUp, TrendingDown, Target, ShoppingBag, CreditCard, Tag, AlertCircle, Upload, FileSpreadsheet, Loader2, CheckCircle, Search, FileText, X } from 'lucide-react';
import * as XLSX from 'xlsx';
import { extractDataFromDocument } from '../services/geminiService';

interface DashboardAdminProps {
  stores: Store[];
  performanceData: MonthlyPerformance[];
  onImportData: (data: MonthlyPerformance[]) => void;
}

const MONTHS = [
  { value: 1, label: 'Janeiro' }, { value: 2, label: 'Fevereiro' }, { value: 3, label: 'Março' },
  { value: 4, label: 'Abril' }, { value: 5, label: 'Maio' }, { value: 6, label: 'Junho' },
  { value: 7, label: 'Julho' }, { value: 8, label: 'Agosto' }, { value: 9, label: 'Setembro' },
  { value: 10, label: 'Outubro' }, { value: 11, label: 'Novembro' }, { value: 12, label: 'Dezembro' }
];

const DashboardAdmin: React.FC<DashboardAdminProps> = ({ stores, performanceData, onImportData }) => {
  // State
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
     const now = new Date();
     return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  // Import State
  const [showImportModal, setShowImportModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [importStatus, setImportStatus] = useState('');
  const [importType, setImportType] = useState<'excel' | 'pdf'>('excel');

  const handleMonthYearChange = (type: 'month' | 'year', value: number) => {
      const [currentY, currentM] = selectedMonth.split('-');
      let newY = parseInt(currentY);
      let newM = parseInt(currentM);

      if (type === 'month') newM = value;
      if (type === 'year') newY = value;

      const newStr = `${newY}-${String(newM).padStart(2, '0')}`;
      setSelectedMonth(newStr);
  };

  const availableYears = useMemo(() => {
      const years = new Set<number>();
      years.add(new Date().getFullYear());
      performanceData.forEach(d => years.add(parseInt(d.month.split('-')[0])));
      return Array.from(years).sort((a,b) => b - a);
  }, [performanceData]);

  const formatMonthName = (dateStr: string) => {
    if (!dateStr) return '';
    const [year, month] = dateStr.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1, 1);
    const monthName = date.toLocaleString('pt-BR', { month: 'long' });
    return monthName.charAt(0).toUpperCase() + monthName.slice(1);
  };

  const currentMonthData = useMemo(() => {
      return performanceData.filter(p => p.month === selectedMonth);
  }, [performanceData, selectedMonth]);

  // Aggregated Stats
  const networkStats = useMemo(() => {
      const totalRevenue = currentMonthData.reduce((acc, curr) => acc + curr.revenueActual, 0);
      const totalTarget = currentMonthData.reduce((acc, curr) => acc + curr.revenueTarget, 0);
      const avgTicket = currentMonthData.length > 0 ? currentMonthData.reduce((acc, curr) => acc + curr.averageTicket, 0) / currentMonthData.length : 0;
      const avgPA = currentMonthData.length > 0 ? currentMonthData.reduce((acc, curr) => acc + curr.itemsPerTicket, 0) / currentMonthData.length : 0;
      
      const percentMeta = totalTarget > 0 ? (totalRevenue / totalTarget) * 100 : 0;

      return { totalRevenue, totalTarget, percentMeta, avgTicket, avgPA };
  }, [currentMonthData]);

  // Import Logic (Excel)
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setImportStatus('');
    }
  };

  const processExcel = async (file: File) => {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer);
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
      
      // 1. Encontrar linha de cabeçalho
      let startRowIndex = -1;
      for(let i=0; i<30; i++) {
          const rowStr = jsonData[i]?.join(' ').toLowerCase();
          if(rowStr.includes('loja')) {
              startRowIndex = i + 1; 
              break;
          }
      }
      if(startRowIndex === -1) throw new Error("Cabeçalho 'Loja' não encontrado na planilha.");

      const updates: MonthlyPerformance[] = [...performanceData];
      let count = 0;

      // 2. Processar Linhas (Indices 0-based)
      // Col 1 (Loja) -> Index 0
      // Col 3 (Itens) -> Index 2
      // Col 4 (PA) -> Index 3
      // Col 5 (PU) -> Index 4
      // Col 6 (Ticket) -> Index 5
      // Col 7 (Meta) -> Index 6
      // Col 8 (Realizado - Assumido H) -> Index 7
      // Col 15 (Inadimplência - O) -> Index 14
      // Col 16 (Inadimplência - P - Fallback) -> Index 15

      for(let i=startRowIndex; i<jsonData.length; i++) {
          const row = jsonData[i];
          if(!row || row.length === 0) continue;
          
          const rawStore = String(row[0] || ''); // Col 1
          if (rawStore.toLowerCase().includes('total')) continue; 

          const storeNum = rawStore.replace(/\D/g, ''); 
          if (!storeNum) continue;

          const store = stores.find(s => s.number === String(parseInt(storeNum)));
          
          if(store) {
             const parseNum = (val: any) => {
                 if (typeof val === 'number') return val;
                 if (typeof val === 'string') {
                     // Remove % e espaços
                     let clean = val.replace('%', '').trim();
                     if (!clean || clean === '-') return 0;
                     
                     // Lógica PT-BR vs US
                     if (clean.includes(',') && clean.includes('.')) {
                         // Formato 1.200,50
                         clean = clean.replace(/\./g, '').replace(',', '.');
                     } else if (clean.includes(',')) {
                         // Formato 1200,50
                         clean = clean.replace(',', '.');
                     }
                     // Se só tem ponto (2.5), o parseFloat já entende como decimal
                     
                     return parseFloat(clean) || 0;
                 }
                 return 0;
             };

             const qtde = parseNum(row[2]); // Col 3
             const pa = parseNum(row[3]);   // Col 4
             const pu = parseNum(row[4]);   // Col 5
             const ticket = parseNum(row[5]); // Col 6
             const meta = parseNum(row[6]);   // Col 7
             const realizado = parseNum(row[7]); // Col 8
             
             // Inadimplência: Tenta Coluna 15 (Index 14), se zerado tenta Coluna 16 (Index 15/P)
             let inad = parseNum(row[14]); 
             if (inad === 0 && row[15] !== undefined) {
                 inad = parseNum(row[15]);
             }

             // Normalização Inadimplência
             if (inad > 0 && inad < 1) inad = inad * 100; // 0.02 -> 2%

             let percent = 0;
             if (meta > 0) {
                 percent = (realizado / meta) * 100;
             }

             const idx = updates.findIndex(p => p.storeId === store.id && p.month === selectedMonth);
             
             const newData = {
                 revenueTarget: meta,
                 revenueActual: realizado,
                 percentMeta: percent,
                 itemsPerTicket: pa,
                 unitPriceAverage: pu,
                 averageTicket: ticket,
                 itemsActual: qtde,
                 delinquencyRate: inad
             };

             if(idx >= 0) {
                 updates[idx] = { ...updates[idx], ...newData };
             } else {
                 updates.push({
                     storeId: store.id,
                     month: selectedMonth,
                     ...newData,
                     itemsTarget: 0,
                     trend: 'stable',
                     correctedDailyGoal: 0
                 });
             }
             count++;
          }
      }
      onImportData(updates);
      return count;
  };

  const processPDF = async (file: File) => {
      // PDF processing remains generic AI based
      const reader = new FileReader();
      return new Promise<number>((resolve, reject) => {
          reader.onload = async () => {
              try {
                  const base64 = (reader.result as string).split(',')[1];
                  const data = await extractDataFromDocument(base64, file.type);
                  
                  const updates = [...performanceData];
                  let count = 0;
                  
                  data.forEach(item => {
                      const store = stores.find(s => s.number === String(parseInt(item.storeNumber)));
                      if(store) {
                          const targetMonth = item.month || selectedMonth;
                          const idx = updates.findIndex(p => p.storeId === store.id && p.month === targetMonth);
                          
                          if(idx >= 0) {
                              updates[idx] = { 
                                  ...updates[idx], 
                                  itemsPerTicket: item.pa, 
                                  unitPriceAverage: item.pu, 
                                  averageTicket: item.ticket,
                                  percentMeta: item.percentMeta
                              };
                          } else {
                              updates.push({
                                  storeId: store.id,
                                  month: targetMonth,
                                  revenueTarget: 0,
                                  revenueActual: 0,
                                  itemsPerTicket: item.pa,
                                  unitPriceAverage: item.pu,
                                  averageTicket: item.ticket,
                                  delinquencyRate: 0,
                                  percentMeta: item.percentMeta,
                                  trend: 'stable',
                                  correctedDailyGoal: 0
                              });
                          }
                          count++;
                      }
                  });
                  onImportData(updates);
                  resolve(count);
              } catch (e) {
                  reject(e);
              }
          };
          reader.readAsDataURL(file);
      });
  };

  const handleProcessImport = async () => {
      if(!selectedFile) return;
      setIsProcessing(true);
      setImportStatus('Processando arquivo...');
      
      try {
          let count = 0;
          if (importType === 'excel') {
              count = await processExcel(selectedFile);
          } else {
              count = await processPDF(selectedFile);
          }
          alert(`Importação concluída! ${count} lojas atualizadas.`);
          setShowImportModal(false);
          setSelectedFile(null);
      } catch (error: any) {
          alert(`Erro: ${error.message}`);
      } finally {
          setIsProcessing(false);
          setImportStatus('');
      }
  };

  return (
    <div className="p-8 max-w-[1600px] mx-auto space-y-8">
       {/* Header */}
       <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <div>
             <h2 className="text-3xl font-bold text-gray-800">Visão Geral da Rede</h2>
             <p className="text-gray-500">Monitoramento consolidado e comparação Meta x Realizado.</p>
          </div>
          
          <div className="flex items-center gap-3">
             <div className="flex items-center gap-2 bg-white p-2 rounded-lg border border-gray-200 shadow-sm">
                <div className="flex gap-2">
                    <select 
                        value={parseInt(selectedMonth.split('-')[1])}
                        onChange={(e) => handleMonthYearChange('month', parseInt(e.target.value))}
                        className="bg-transparent text-gray-700 font-medium outline-none cursor-pointer"
                    >
                        {MONTHS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                    </select>
                    <select 
                        value={parseInt(selectedMonth.split('-')[0])}
                        onChange={(e) => handleMonthYearChange('year', parseInt(e.target.value))}
                        className="bg-transparent text-gray-700 font-medium outline-none cursor-pointer"
                    >
                        {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                </div>
             </div>

             <button 
                onClick={() => setShowImportModal(true)}
                className="flex items-center gap-2 bg-blue-700 text-white px-4 py-2 rounded-lg hover:bg-blue-800 transition-colors shadow-sm font-bold"
             >
                 <Upload size={18} /> Importar Dados
             </button>
          </div>
       </div>

       {/* Network KPI Cards */}
       <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
           <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
               <div className="flex items-center justify-between mb-4">
                   <h3 className="text-gray-500 text-sm font-bold uppercase">Faturamento Total</h3>
                   <div className="p-2 bg-green-50 rounded-lg text-green-600"><ShoppingBag size={20}/></div>
               </div>
               <p className="text-3xl font-bold text-gray-900">{formatCurrency(networkStats.totalRevenue)}</p>
               <div className="flex items-center gap-2 mt-2">
                   <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                       <div className={`h-full ${networkStats.percentMeta >= 100 ? 'bg-green-500' : 'bg-blue-500'}`} style={{ width: `${Math.min(networkStats.percentMeta, 100)}%` }}></div>
                   </div>
                   <span className="text-xs font-bold text-gray-600">{networkStats.percentMeta.toFixed(1)}% da Meta</span>
               </div>
           </div>

           <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
               <div className="flex items-center justify-between mb-4">
                   <h3 className="text-gray-500 text-sm font-bold uppercase">Meta da Rede</h3>
                   <div className="p-2 bg-blue-50 rounded-lg text-blue-600"><Target size={20}/></div>
               </div>
               <p className="text-3xl font-bold text-gray-900">{formatCurrency(networkStats.totalTarget)}</p>
               <p className="text-xs text-gray-400 mt-2">Somatório de todas as lojas</p>
           </div>

           <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
               <div className="flex items-center justify-between mb-4">
                   <h3 className="text-gray-500 text-sm font-bold uppercase">Ticket Médio (Média)</h3>
                   <div className="p-2 bg-purple-50 rounded-lg text-purple-600"><CreditCard size={20}/></div>
               </div>
               <p className="text-3xl font-bold text-gray-900">{formatCurrency(networkStats.avgTicket)}</p>
               <p className="text-xs text-gray-400 mt-2">Média global da rede</p>
           </div>

           <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
               <div className="flex items-center justify-between mb-4">
                   <h3 className="text-gray-500 text-sm font-bold uppercase">P.A. Global</h3>
                   <div className="p-2 bg-orange-50 rounded-lg text-orange-600"><Tag size={20}/></div>
               </div>
               <p className="text-3xl font-bold text-gray-900">{networkStats.avgPA.toFixed(2)}</p>
               <p className="text-xs text-gray-400 mt-2">Peças por atendimento</p>
           </div>
       </div>

       {/* Detailed Table */}
       <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-100">
              <h3 className="font-bold text-lg text-gray-800">Detalhamento por Loja ({formatMonthName(selectedMonth)})</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-600">
                <thead className="bg-gray-50 text-gray-900 font-semibold">
                    <tr>
                        <th className="p-4">Loja</th>
                        <th className="p-4 text-right">Meta (Col 7)</th>
                        <th className="p-4 text-right">Realizado (Col 8)</th>
                        <th className="p-4 text-center">% Ating.</th>
                        <th className="p-4 text-center">P.A. (Col 4)</th>
                        <th className="p-4 text-center">P.U. (Col 5)</th>
                        <th className="p-4 text-right">Ticket (Col 6)</th>
                        <th className="p-4 text-center">Itens (Col 3)</th>
                        <th className="p-4 text-center">Inad. (Col 15/16)</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                    {currentMonthData.map((data) => {
                         const store = stores.find(s => s.id === data.storeId);
                         return (
                            <tr key={data.storeId} className="hover:bg-gray-50">
                                <td className="p-4 font-medium text-gray-900">{store?.name}</td>
                                <td className="p-4 text-right">{formatCurrency(data.revenueTarget)}</td>
                                <td className="p-4 text-right">{formatCurrency(data.revenueActual)}</td>
                                <td className="p-4 text-center">
                                    <span className={`px-2 py-1 rounded font-bold ${data.percentMeta >= 100 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                        {data.percentMeta.toFixed(1)}%
                                    </span>
                                </td>
                                <td className="p-4 text-center">{data.itemsPerTicket.toFixed(2)}</td>
                                <td className="p-4 text-center">{data.unitPriceAverage.toFixed(2)}</td>
                                <td className="p-4 text-right">{formatCurrency(data.averageTicket)}</td>
                                <td className="p-4 font-medium text-blue-800 text-center">{data.itemsActual || 0}</td>
                                <td className={`p-4 font-bold text-center ${data.delinquencyRate > 2 ? 'text-red-600' : 'text-green-600'}`}>
                                    {data.delinquencyRate ? data.delinquencyRate.toFixed(2) + '%' : '-'}
                                </td>
                            </tr>
                         );
                    })}
                    {currentMonthData.length === 0 && (
                        <tr><td colSpan={9} className="p-8 text-center text-gray-400">Nenhum dado encontrado para este mês.</td></tr>
                    )}
                </tbody>
            </table>
          </div>
       </div>

       {/* Import Modal */}
       {showImportModal && (
           <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
               <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-xl">
                   <div className="flex justify-between items-center mb-6">
                       <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                           <Upload className="text-blue-600" size={24}/> Importar Relatório
                       </h3>
                       <button onClick={() => setShowImportModal(false)} className="text-gray-400 hover:text-gray-600"><X size={20}/></button>
                   </div>

                   <div className="flex bg-gray-100 p-1 rounded-lg mb-6">
                       <button onClick={() => setImportType('excel')} className={`flex-1 py-2 rounded-md text-sm font-bold transition-all flex items-center justify-center gap-2 ${importType === 'excel' ? 'bg-white shadow text-green-700' : 'text-gray-500'}`}>
                           <FileSpreadsheet size={16}/> Excel
                       </button>
                       <button onClick={() => setImportType('pdf')} className={`flex-1 py-2 rounded-md text-sm font-bold transition-all flex items-center justify-center gap-2 ${importType === 'pdf' ? 'bg-white shadow text-red-700' : 'text-gray-500'}`}>
                           <FileText size={16}/> PDF (IA)
                       </button>
                   </div>

                   <div 
                        onClick={() => !isProcessing && fileInputRef.current?.click()}
                        className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center mb-6 cursor-pointer transition-colors group ${
                            selectedFile ? 'border-blue-300 bg-blue-50' : 'border-gray-300 hover:bg-gray-50'
                        } ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
                   >
                        {selectedFile ? (
                            <>
                                <CheckCircle size={32} className="text-blue-500 mb-2" />
                                <span className="text-sm font-bold text-blue-700 break-all text-center">{selectedFile.name}</span>
                                <span className="text-xs text-blue-600 mt-1">Clique para alterar</span>
                            </>
                        ) : (
                            <>
                                <Upload size={32} className="text-gray-400 mb-2 group-hover:text-blue-500 transition-colors" />
                                <span className="text-sm text-gray-500 group-hover:text-gray-700">Clique para selecionar arquivo</span>
                                <span className="text-xs text-gray-400 mt-1">{importType === 'excel' ? '.xlsx, .xls' : '.pdf'}</span>
                            </>
                        )}
                        <input 
                            type="file" 
                            ref={fileInputRef} 
                            className="hidden" 
                            accept={importType === 'excel' ? ".xlsx, .xls" : ".pdf"}
                            onChange={handleFileChange} 
                        />
                   </div>

                   <div className="text-xs text-gray-500 bg-gray-50 p-3 rounded mb-4">
                       <strong>Colunas Esperadas (Excel):</strong><br/>
                       1: Loja | 3: Itens | 4: P.A | 5: P.U | 6: Ticket | 7: Meta | 8: Realizado | 15: Inadimplência
                   </div>

                   {importStatus && (
                        <div className="mb-4 text-center text-sm font-medium text-blue-600 flex items-center justify-center gap-2">
                            {isProcessing && <Loader2 size={16} className="animate-spin"/>}
                            {importStatus}
                        </div>
                   )}

                   <button 
                        onClick={handleProcessImport}
                        disabled={!selectedFile || isProcessing}
                        className={`w-full py-3 rounded-lg font-bold text-white shadow-md transition-all ${!selectedFile || isProcessing ? 'bg-gray-300 cursor-not-allowed' : 'bg-blue-700 hover:bg-blue-800'}`}
                   >
                        Processar Arquivo
                   </button>
               </div>
           </div>
       )}
    </div>
  );
};

export default DashboardAdmin;
