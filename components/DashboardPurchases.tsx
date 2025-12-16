import React, { useState, useMemo, useRef } from 'react';
import { Store, ProductPerformance } from '../types';
import { formatCurrency } from '../constants';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { ShoppingBag, TrendingUp, Upload, Filter, Calendar, Package, DollarSign, Award, ArrowUpRight, CheckCircle, Loader2, TrendingDown, FileSpreadsheet } from 'lucide-react';
import * as XLSX from 'xlsx';

interface DashboardPurchasesProps {
  stores: Store[];
  data: ProductPerformance[];
  onImport: (newData: ProductPerformance[]) => void;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

const MONTHS = [
  { value: 1, label: 'Janeiro' }, { value: 2, label: 'Fevereiro' }, { value: 3, label: 'Março' },
  { value: 4, label: 'Abril' }, { value: 5, label: 'Maio' }, { value: 6, label: 'Junho' },
  { value: 7, label: 'Julho' }, { value: 8, label: 'Agosto' }, { value: 9, label: 'Setembro' },
  { value: 10, label: 'Outubro' }, { value: 11, label: 'Novembro' }, { value: 12, label: 'Dezembro' }
];

const DashboardPurchases: React.FC<DashboardPurchasesProps> = ({ stores, data, onImport }) => {
  // State for Filters
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
     // Default to last month in data or current
     const uniqueMonths = Array.from(new Set(data.map(d => d.month))).sort();
     return uniqueMonths.length > 0 ? uniqueMonths[uniqueMonths.length - 1] : new Date().toISOString().slice(0, 7);
  });
  
  // Import State
  const [showImportModal, setShowImportModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [importStatus, setImportStatus] = useState('');

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
      data.forEach(d => years.add(parseInt(d.month.split('-')[0])));
      return Array.from(years).sort((a,b) => b-a);
  }, [data]);

  // FILTERED DATA
  const currentData = useMemo(() => {
      return data.filter(d => d.month === selectedMonth);
  }, [data, selectedMonth]);

  // --- ANALYSIS LOGIC ---

  // 1. Brand Performance (Aggregated)
  const brandPerformance = useMemo(() => {
      const stats: Record<string, { revenue: number, pairs: number }> = {};
      currentData.forEach(item => {
          if (!stats[item.brand]) stats[item.brand] = { revenue: 0, pairs: 0 };
          stats[item.brand].revenue += item.revenue;
          stats[item.brand].pairs += item.pairsSold;
      });
      return Object.entries(stats)
        .map(([brand, val]) => ({ brand, ...val }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 10); // Top 10
  }, [currentData]);

  // 2. Category Distribution
  const categoryData = useMemo(() => {
      const stats: Record<string, number> = {};
      currentData.forEach(item => {
          if (!stats[item.category]) stats[item.category] = 0;
          stats[item.category] += item.revenue;
      });
      return Object.entries(stats).map(([name, value]) => ({ name, value }));
  }, [currentData]);

  // 3. Detailed Ranking per Store (Top Brands)
  const storeRankings = useMemo(() => {
      const activeStores = stores.filter(s => s.status === 'active');
      return activeStores.map(store => {
          const storeItems = currentData.filter(d => d.storeId === store.id);
          // Group by Brand
          const brandStats: Record<string, { pairs: number, revenue: number }> = {};
          storeItems.forEach(item => {
              if(!brandStats[item.brand]) brandStats[item.brand] = { pairs: 0, revenue: 0 };
              brandStats[item.brand].pairs += item.pairsSold;
              brandStats[item.brand].revenue += item.revenue;
          });
          
          const topBrands = Object.entries(brandStats)
              .map(([brand, val]) => ({ brand, ...val }))
              .sort((a,b) => b.revenue - a.revenue)
              .slice(0, 5); // Top 5 per store

          return {
              storeName: store.name,
              number: store.number,
              topBrands
          };
      }).filter(s => s.topBrands.length > 0);
  }, [currentData, stores]);

  // 4. Future Purchase Recommendations (Simple Heuristic: High Volume = Buy More)
  const purchaseRecommendations = useMemo(() => {
      // Logic: If a brand sells more than 50 pairs in a month in a store, it's a "High Rotativity" item.
      const recommendations: { store: string, brand: string, reason: string, status: string }[] = [];
      
      currentData.forEach(item => {
          if (item.pairsSold >= 50) {
              const store = stores.find(s => s.id === item.storeId);
              recommendations.push({
                  store: store ? `${store.number} - ${store.name}` : 'Loja Desconhecida',
                  brand: item.brand,
                  reason: `Alto Giro (${item.pairsSold} pares vendidos)`,
                  status: 'Reposição Urgente'
              });
          } else if (item.pairsSold >= 20) {
               const store = stores.find(s => s.id === item.storeId);
               recommendations.push({
                  store: store ? `${store.number} - ${store.name}` : 'Loja Desconhecida',
                  brand: item.brand,
                  reason: `Giro Constante (${item.pairsSold} pares)`,
                  status: 'Manter Estoque'
              });
          }
      });
      return recommendations.sort((a,b) => a.status === 'Reposição Urgente' ? -1 : 1).slice(0, 20);
  }, [currentData, stores]);

  // --- IMPORT LOGIC HELPERS ---
  const parseNumber = (val: any): number => {
    if (typeof val === 'number') return val;
    if (typeof val === 'string') {
        // Handle "1.200,00" -> 1200.00
        const clean = val.replace(/\./g, '').replace(',', '.');
        return parseFloat(clean) || 0;
    }
    return 0;
  };

  const parseExcelDate = (val: any): string | null => {
      if (!val) return null;
      if (typeof val === 'number') {
          // Excel Serial Date
          const date = new Date(Math.round((val - 25569) * 86400 * 1000));
          const y = date.getFullYear();
          const m = String(date.getMonth() + 1).padStart(2, '0');
          return `${y}-${m}`;
      }
      if (typeof val === 'string') {
          // YYYY-MM
          if (/^\d{4}-\d{2}$/.test(val)) return val;
          // MM/YYYY or MM-YYYY
          if (/^\d{2}[\/\-]\d{4}$/.test(val)) {
             const parts = val.split(/[\/\-]/);
             return `${parts[1]}-${parts[0]}`;
          }
      }
      return null;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setImportStatus('');
    }
  };

  const handleProcessImport = async () => {
      if (!selectedFile) return;

      setIsProcessing(true);
      setImportStatus('Lendo arquivo...');

      try {
        const arrayBuffer = await selectedFile.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer);
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        
        // Get Raw Data (Array of Arrays)
        const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];

        if (!jsonData || jsonData.length === 0) {
            throw new Error("Arquivo vazio ou formato inválido.");
        }

        // 1. Dynamic Header Detection
        let headerRowIndex = -1;
        // Scan first 20 rows for keywords
        for (let i = 0; i < 20 && i < jsonData.length; i++) {
            const rowStr = jsonData[i].join(' ').toLowerCase();
            if (rowStr.includes('loja') && (rowStr.includes('marca') || rowStr.includes('produto') || rowStr.includes('pares'))) {
                headerRowIndex = i;
                break;
            }
        }

        if (headerRowIndex === -1) {
            throw new Error("Não foi possível identificar o cabeçalho. O arquivo deve conter colunas como: 'Loja', 'Marca', 'Pares', 'Valor'.");
        }

        const headerRow = jsonData[headerRowIndex].map(h => String(h).toLowerCase().trim());
        console.log("Cabeçalho detectado:", headerRow);

        // 2. Map Columns dynamically
        const findCol = (keywords: string[]) => headerRow.findIndex(h => keywords.some(k => h.includes(k)));

        const idxLoja = findCol(['loja', 'filial', 'unidade']);
        const idxMarca = findCol(['marca', 'fabricante', 'fornecedor']);
        const idxCat = findCol(['categoria', 'grupo', 'departamento', 'genero']);
        const idxPares = findCol(['pares', 'qtde', 'quantidade', 'venda qtde', 'peças']);
        const idxValor = findCol(['valor', 'total', 'venda', 'faturamento', 'liquido']);
        const idxMes = findCol(['mes', 'data', 'periodo']);

        // Check required columns
        const missingCols = [];
        if (idxLoja === -1) missingCols.push('Loja');
        if (idxMarca === -1) missingCols.push('Marca');
        if (idxPares === -1 && idxValor === -1) missingCols.push('Pares ou Valor');

        if (missingCols.length > 0) {
            throw new Error(`Colunas obrigatórias não encontradas: ${missingCols.join(', ')}.`);
        }

        const newRecords: ProductPerformance[] = [];
        let successCount = 0;
        let unknownStoreCount = 0;
        let processedRows = 0;

        // 3. Process Data Rows
        for (let i = headerRowIndex + 1; i < jsonData.length; i++) {
            const row = jsonData[i];
            if (!row || row.length === 0) continue; // Skip empty rows

            // Get Store Number
            const rawStore = row[idxLoja];
            if (!rawStore) continue;
            
            // Normalize Store Number (remove zeros and non-digits)
            const storeNum = String(rawStore).replace(/\D/g, '').replace(/^0+/, ''); 
            if (!storeNum) continue; // Invalid store number

            const store = stores.find(s => s.number === storeNum);

            // Get Values
            const brand = idxMarca !== -1 ? String(row[idxMarca] || 'Outros').trim() : 'Outros';
            const category = idxCat !== -1 ? String(row[idxCat] || 'Geral').trim() : 'Geral';
            
            const pairs = idxPares !== -1 ? parseNumber(row[idxPares]) : 0;
            const revenue = idxValor !== -1 ? parseNumber(row[idxValor]) : 0;

            // Determine Month (Row specific > Global Selected)
            let rowMonth = idxMes !== -1 ? parseExcelDate(row[idxMes]) : null;
            if (!rowMonth) rowMonth = selectedMonth;

            if (store && (pairs > 0 || revenue > 0)) {
                newRecords.push({
                    id: `prod-${Date.now()}-${i}`,
                    storeId: store.id,
                    month: rowMonth,
                    brand: brand || 'Não Informado',
                    category: category || 'Geral',
                    pairsSold: pairs,
                    revenue: revenue
                });
                successCount++;
            } else if (!store) {
                unknownStoreCount++;
            }
            processedRows++;
        }

        if (successCount > 0) {
            // REPLACE LOGIC: Remove existing records for the same month/store to avoid duplicates, or just append?
            // "O sistema informa se deu certo"
            // Let's filter out old data for the impacted months to ensure "Snapshot" behavior
            const importedMonths = new Set(newRecords.map(r => r.month));
            
            // Keep data that is NOT in the imported months (clean replace for those months)
            // Or simplified: Just append and let user manage. 
            // Prompt says: "Sempre que importar novos dados tornar este o ultimo dados... apagando os dados anteriores"
            const keptData = data.filter(d => !importedMonths.has(d.month));
            
            onImport([...keptData, ...newRecords]);

            let msg = `✅ Sucesso! ${successCount} registros importados.`;
            if (unknownStoreCount > 0) {
                msg += `\n⚠️ ${unknownStoreCount} linhas ignoradas (Loja não cadastrada).`;
            }
            alert(msg);
            
            setShowImportModal(false);
            setSelectedFile(null);
            
            // Switch view to imported month
            if (newRecords[0]?.month) setSelectedMonth(newRecords[0].month);

        } else {
            if (processedRows === 0) {
                throw new Error("O arquivo parece estar vazio ou não contém dados abaixo do cabeçalho.");
            } else {
                throw new Error("Nenhum registro válido foi gerado. Verifique os números das lojas na planilha.");
            }
        }

      } catch (err: any) {
          console.error(err);
          alert(`❌ Erro na Importação:\n${err.message || 'Erro desconhecido.'}`);
      } finally {
          setIsProcessing(false);
          setImportStatus('');
          if (fileInputRef.current) fileInputRef.current.value = '';
      }
  };

  return (
    <div className="p-8 space-y-8 max-w-[1600px] mx-auto">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
         <div>
            <h2 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
               <ShoppingBag className="text-blue-700" size={32} />
               Gestão de Compras & Marcas
            </h2>
            <p className="text-gray-500 mt-1">Análise de desempenho de produtos e indicação de reposição.</p>
         </div>

         <div className="flex items-center gap-3">
             <div className="flex items-center gap-2 bg-white p-2 rounded-lg border border-gray-200 shadow-sm">
                <Calendar size={18} className="text-blue-600 ml-2" />
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
                className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors shadow-sm font-medium"
             >
                 <Upload size={18} /> Importar Vendas
             </button>
         </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
              <div>
                  <p className="text-sm text-gray-500 font-medium">Volume Total</p>
                  <p className="text-3xl font-bold text-gray-900">
                      {currentData.reduce((acc, curr) => acc + curr.pairsSold, 0).toLocaleString()} <span className="text-sm text-gray-400 font-normal">pares</span>
                  </p>
              </div>
              <div className="p-3 bg-blue-50 text-blue-600 rounded-lg"><Package size={24}/></div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
              <div>
                  <p className="text-sm text-gray-500 font-medium">Faturamento Marcas</p>
                  <p className="text-3xl font-bold text-gray-900">
                      {formatCurrency(currentData.reduce((acc, curr) => acc + curr.revenue, 0))}
                  </p>
              </div>
              <div className="p-3 bg-green-50 text-green-600 rounded-lg"><DollarSign size={24}/></div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
              <div>
                  <p className="text-sm text-gray-500 font-medium">Melhor Marca (Valor)</p>
                  <p className="text-xl font-bold text-gray-900 truncate max-w-[150px]">
                      {brandPerformance[0]?.brand || '-'}
                  </p>
                  <p className="text-xs text-green-600 font-medium">{formatCurrency(brandPerformance[0]?.revenue || 0)}</p>
              </div>
              <div className="p-3 bg-yellow-50 text-yellow-600 rounded-lg"><Award size={24}/></div>
          </div>
          
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
              <div>
                  <p className="text-sm text-gray-500 font-medium">Marcas Ativas</p>
                  <p className="text-3xl font-bold text-gray-900">
                      {brandPerformance.length}
                  </p>
              </div>
              <div className="p-3 bg-purple-50 text-purple-600 rounded-lg"><Filter size={24}/></div>
          </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Brand Performance Chart */}
          <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <h3 className="font-bold text-lg text-gray-800 mb-6 flex items-center gap-2">
                  <TrendingUp size={20} className="text-blue-600"/> Desempenho por Marca (Top 10)
              </h3>
              <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={brandPerformance}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} />
                          <XAxis dataKey="brand" fontSize={12} tickLine={false} axisLine={false} />
                          <YAxis yAxisId="left" orientation="left" stroke="#8884d8" fontSize={12} tickFormatter={(val) => `R$${val/1000}k`} />
                          <YAxis yAxisId="right" orientation="right" stroke="#82ca9d" fontSize={12} />
                          <Tooltip formatter={(value, name) => name === 'revenue' ? formatCurrency(value as number) : value} />
                          <Legend />
                          <Bar yAxisId="left" dataKey="revenue" name="Venda (R$)" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={30} />
                          <Bar yAxisId="right" dataKey="pairs" name="Pares" fill="#10b981" radius={[4, 4, 0, 0]} barSize={30} />
                      </BarChart>
                  </ResponsiveContainer>
              </div>
          </div>

          {/* Category Pie Chart */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <h3 className="font-bold text-lg text-gray-800 mb-6">Mix de Categorias</h3>
              <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                          <Pie
                              data={categoryData}
                              cx="50%"
                              cy="50%"
                              innerRadius={60}
                              outerRadius={100}
                              paddingAngle={5}
                              dataKey="value"
                          >
                              {categoryData.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                              ))}
                          </Pie>
                          <Tooltip formatter={(val) => formatCurrency(val as number)} />
                          <Legend />
                      </PieChart>
                  </ResponsiveContainer>
              </div>
          </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Detailed Ranking Table per Store */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-6 border-b border-gray-100">
                  <h3 className="font-bold text-lg text-gray-800 flex items-center gap-2">
                      <Award className="text-yellow-500" size={20} /> Ranking de Marcas por Loja
                  </h3>
                  <p className="text-xs text-gray-500 mt-1">As 5 marcas mais vendidas em cada unidade.</p>
              </div>
              <div className="overflow-y-auto max-h-[500px]">
                  {storeRankings.map((store, idx) => (
                      <div key={idx} className="border-b border-gray-100 last:border-0">
                          <div className="bg-gray-50 px-6 py-2 font-bold text-sm text-gray-700">
                              Loja {store.number} - {store.storeName}
                          </div>
                          <table className="w-full text-left text-sm">
                              <thead className="text-gray-500 bg-white">
                                  <tr>
                                      <th className="px-6 py-2 font-medium">Marca</th>
                                      <th className="px-6 py-2 font-medium text-right">Pares</th>
                                      <th className="px-6 py-2 font-medium text-right">Valor</th>
                                  </tr>
                              </thead>
                              <tbody>
                                  {store.topBrands.map((b, i) => (
                                      <tr key={i} className="hover:bg-gray-50">
                                          <td className="px-6 py-2 border-b border-gray-50 flex items-center gap-2">
                                              <span className="text-xs font-mono text-gray-400 w-4">{i+1}</span>
                                              {b.brand}
                                          </td>
                                          <td className="px-6 py-2 border-b border-gray-50 text-right">{b.pairs}</td>
                                          <td className="px-6 py-2 border-b border-gray-50 text-right font-medium text-blue-900">
                                              {formatCurrency(b.revenue)}
                                          </td>
                                      </tr>
                                  ))}
                              </tbody>
                          </table>
                      </div>
                  ))}
                  {storeRankings.length === 0 && (
                      <div className="p-8 text-center text-gray-400">Nenhum dado disponível.</div>
                  )}
              </div>
          </div>

          {/* AI/Heuristic Recommendations */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
              <div className="p-6 border-b border-gray-100 bg-blue-900 text-white">
                  <h3 className="font-bold text-lg flex items-center gap-2">
                      <ArrowUpRight size={20} className="text-green-400" /> Indicação de Compra Futura
                  </h3>
                  <p className="text-xs text-blue-200 mt-1">Sugestões baseadas no giro de estoque (Vendas {'>'} 20 pares/mês).</p>
              </div>
              <div className="overflow-y-auto max-h-[500px] flex-1">
                  <table className="w-full text-left text-sm">
                      <thead className="bg-gray-50 text-gray-600">
                          <tr>
                              <th className="p-4">Loja / Marca</th>
                              <th className="p-4">Motivo</th>
                              <th className="p-4 text-center">Status</th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                          {purchaseRecommendations.map((rec, idx) => (
                              <tr key={idx} className="hover:bg-gray-50">
                                  <td className="p-4">
                                      <div className="font-bold text-gray-800">{rec.brand}</div>
                                      <div className="text-xs text-gray-500">{rec.store}</div>
                                  </td>
                                  <td className="p-4 text-gray-600">{rec.reason}</td>
                                  <td className="p-4 text-center">
                                      <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                                          rec.status.includes('Urgente') 
                                            ? 'bg-red-100 text-red-700 animate-pulse' 
                                            : 'bg-green-100 text-green-700'
                                      }`}>
                                          {rec.status}
                                      </span>
                                  </td>
                              </tr>
                          ))}
                          {purchaseRecommendations.length === 0 && (
                              <tr>
                                  <td colSpan={3} className="p-8 text-center text-gray-400">
                                      Nenhuma indicação de compra no momento.
                                  </td>
                              </tr>
                          )}
                      </tbody>
                  </table>
              </div>
          </div>
      </div>

      {/* IMPORT MODAL */}
      {showImportModal && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
              <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl">
                  <div className="flex justify-between items-center mb-4">
                        <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                            <Upload size={24} className="text-blue-600"/> Importar Dados
                        </h3>
                         <button onClick={() => {setShowImportModal(false); setSelectedFile(null); setImportStatus('');}} className="text-gray-400 hover:text-gray-600">
                            <TrendingDown size={20} className="rotate-45" />
                        </button>
                  </div>
                  
                  <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 mb-6">
                      <p className="text-sm text-blue-800 font-semibold mb-2 flex items-center gap-2">
                          <FileSpreadsheet size={16}/> Instruções:
                      </p>
                      <ul className="text-xs text-blue-700 space-y-1 list-disc list-inside">
                          <li>O arquivo deve conter cabeçalho (ex: Linha 1).</li>
                          <li>Colunas Obrigatórias: <strong>Loja</strong> e <strong>Marca</strong>.</li>
                          <li>Dados Obrigatórios: <strong>Pares</strong> ou <strong>Valor</strong>.</li>
                          <li>Outras colunas: Categoria, Mês (Opcional).</li>
                      </ul>
                  </div>

                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    className="hidden" 
                    accept=".xlsx, .xls"
                    onChange={handleFileChange} 
                  />
                  
                  <div 
                    onClick={() => !isProcessing && fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center mb-6 cursor-pointer transition-colors group ${
                        selectedFile ? 'border-green-300 bg-green-50' : 'border-gray-300 hover:bg-gray-50'
                    } ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                      {selectedFile ? (
                          <>
                             <CheckCircle size={32} className="text-green-500 mb-2" />
                             <span className="text-sm font-bold text-green-700 break-all text-center">{selectedFile.name}</span>
                             <span className="text-xs text-green-600 mt-1">Clique para alterar</span>
                          </>
                      ) : (
                          <>
                             <Upload size={32} className="text-gray-400 mb-2 group-hover:text-blue-500 transition-colors" />
                             <span className="text-sm text-gray-500 group-hover:text-gray-700">Clique para selecionar arquivo</span>
                             <span className="text-xs text-gray-400 mt-1">Excel (.xlsx ou .xls)</span>
                          </>
                      )}
                  </div>

                  {importStatus && (
                        <div className="mb-4 text-center text-sm font-medium text-blue-600 flex items-center justify-center gap-2">
                            {isProcessing && <Loader2 size={16} className="animate-spin"/>}
                            {importStatus}
                        </div>
                   )}

                  <div className="flex gap-3">
                      <button 
                        onClick={() => { setShowImportModal(false); setSelectedFile(null); setImportStatus(''); }}
                        disabled={isProcessing}
                        className="flex-1 py-2 bg-gray-100 rounded-lg text-gray-700 hover:bg-gray-200 font-medium"
                      >
                          Cancelar
                      </button>
                       <button 
                         onClick={handleProcessImport}
                         disabled={!selectedFile || isProcessing}
                         className={`flex-1 px-4 py-2 rounded-lg font-medium shadow-md transition-all ${
                             !selectedFile || isProcessing
                                ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                                : 'bg-blue-700 text-white hover:bg-blue-800 hover:shadow-lg'
                         }`}
                       >
                         Processar
                       </button>
                  </div>
              </div>
          </div>
      )}

    </div>
  );
};

export default DashboardPurchases;