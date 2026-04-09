
import React, { useState, useMemo, useRef } from 'react';
import { Store, ProductPerformance, User, AdminUser, PurchasingManagement } from '../types';
import { formatCurrency } from '../constants';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { ShoppingBag, TrendingUp, Upload, Filter, Calendar, Package, DollarSign, Award, ArrowUpRight, CheckCircle, Loader2, TrendingDown, FileSpreadsheet, Plus, ArrowRight, ClipboardList, X, AlertTriangle } from 'lucide-react';
import PurchaseQuestionnaire from './PurchaseQuestionnaire';

interface DashboardPurchasesProps {
  user: User;
  stores: Store[];
  data: ProductPerformance[];
  managementData: PurchasingManagement[];
  adminUsers: AdminUser[];
  onImport: (newData: ProductPerformance[]) => Promise<void>;
  onImportManagement: (newData: PurchasingManagement[], shouldFetch?: boolean) => Promise<void>;
  onOpenSpreadsheetModule: () => void;
  can: (perm: string) => boolean;
}

const COLORS = ['#1e3a8a', '#dc2626', '#fbbf24', '#10b981', '#6366f1', '#ec4899', '#8b5cf6', '#f43f5e', '#06b6d4', '#f97316'];

const MONTHS = [
  { value: 1, label: 'Janeiro' }, { value: 2, label: 'Fevereiro' }, { value: 3, label: 'Março' },
  { value: 4, label: 'Abril' }, { value: 5, label: 'Maio' }, { value: 6, label: 'Junho' },
  { value: 7, label: 'Julho' }, { value: 8, label: 'Agosto' }, { value: 9, label: 'Setembro' },
  { value: 10, label: 'Outubro' }, { value: 11, label: 'Novembro' }, { value: 12, label: 'Dezembro' }
];

const DashboardPurchases: React.FC<DashboardPurchasesProps> = ({ stores, data, managementData, onImport, onImportManagement, user, onOpenSpreadsheetModule, adminUsers, can }) => {
  const [activeTab, setActiveTab] = useState<'management' | 'questionnaire'>('management');
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
     const now = new Date();
     return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  
  const [showImportModal, setShowImportModal] = useState(false);
  const [showManagementImportModal, setShowManagementImportModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mgmtFileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedManagementFile, setSelectedManagementFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Filtro de dados por loja (se não for admin) e por mês selecionado
  const filteredManagementData = useMemo(() => {
      const [year, month] = selectedMonth.split('-').map(Number);
      let base = managementData.filter(d => d.year === year && d.month === month);
      if (can('ALWAYS')) return base; // Admin or Always access
      return base.filter(d => d.storeId === user.storeId);
  }, [managementData, user, selectedMonth, can]);

  const currentData = useMemo(() => data.filter(d => d.month === selectedMonth), [data, selectedMonth]);

  // Dashboards Gestão Compras
  const topSoldBrands = useMemo(() => {
      const stats: Record<string, number> = {};
      filteredManagementData.forEach(item => {
          if (!stats[item.brand]) stats[item.brand] = 0;
          stats[item.brand] += item.sellQty;
      });
      return Object.entries(stats)
        .map(([brand, qty]) => ({ brand, qty }))
        .sort((a, b) => b.qty - a.qty)
        .slice(0, 10);
  }, [filteredManagementData]);

  const topBoughtBrands = useMemo(() => {
      const stats: Record<string, number> = {};
      filteredManagementData.forEach(item => {
          if (!stats[item.brand]) stats[item.brand] = 0;
          stats[item.brand] += item.buyQty;
      });
      return Object.entries(stats)
        .map(([brand, qty]) => ({ brand, qty }))
        .sort((a, b) => b.qty - a.qty)
        .slice(0, 10);
  }, [filteredManagementData]);

  const lowStockBrands = useMemo(() => {
      const stats: Record<string, number> = {};
      filteredManagementData.forEach(item => {
          if (!stats[item.brand]) stats[item.brand] = 0;
          stats[item.brand] += item.stockQty;
      });
      return Object.entries(stats)
        .map(([brand, qty]) => ({ brand, qty }))
        .sort((a, b) => a.qty - b.qty) // Menor estoque primeiro
        .slice(0, 10);
  }, [filteredManagementData]);

  const brandMixDetails = useMemo(() => {
      const brands = [...new Set(filteredManagementData.map(d => d.brand))];
      const mix = brands.map(brand => {
          const items = filteredManagementData.filter(d => d.brand === brand);
          const totalSell = items.reduce((acc, curr) => acc + curr.sellQty, 0);
          return { brand, totalSell, items };
      }).sort((a, b) => b.totalSell - a.totalSell).slice(0, 10);
      return mix;
  }, [filteredManagementData]);

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
        .slice(0, 10); 
  }, [currentData]);

  const categoryData = useMemo(() => {
      const stats: Record<string, number> = {};
      currentData.forEach(item => {
          if (!stats[item.category]) stats[item.category] = 0;
          stats[item.category] += item.revenue;
      });
      return Object.entries(stats).map(([name, value]) => ({ name, value }));
  }, [currentData]);

  const handleProcessImport = async () => {
      const XLSX = await import('xlsx');
      if (!selectedFile) return;
      setIsProcessing(true);
      try {
        const arrayBuffer = await selectedFile.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        const jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { header: 1 }) as any[][];
        let headerRowIndex = -1;
        for (let i = 0; i < 20 && i < jsonData.length; i++) {
            const rowStr = jsonData[i].join(' ').toLowerCase();
            if (rowStr.includes('loja') && (rowStr.includes('marca') || rowStr.includes('produto'))) { headerRowIndex = i; break; }
        }
        if (headerRowIndex === -1) throw new Error("Estrutura não reconhecida.");
        const headerRow = jsonData[headerRowIndex].map(h => String(h).toLowerCase().trim());
        const findCol = (keywords: string[]) => headerRow.findIndex(h => keywords.some(k => h.includes(k)));
        const idxLoja = findCol(['loja', 'filial']);
        const idxMarca = findCol(['marca', 'fabricante']);
        const idxCat = findCol(['categoria', 'grupo']);
        const idxPares = findCol(['pares', 'qtde']);
        const idxValor = findCol(['valor', 'total', 'faturamento']);
        const newRecords: ProductPerformance[] = [];
        for (let i = headerRowIndex + 1; i < jsonData.length; i++) {
            const row = jsonData[i];
            if (!row || !row[idxLoja]) continue;
            const storeNum = String(row[idxLoja]).replace(/\D/g, '').replace(/^0+/, '');
            const store = stores.find(s => s.number === storeNum);
            if (store) {
                newRecords.push({
                    storeId: store.id, month: selectedMonth,
                    brand: String(row[idxMarca] || 'Geral').trim().toUpperCase(),
                    category: String(row[idxCat] || 'Geral').trim().toUpperCase(),
                    pairsSold: parseFloat(String(row[idxPares]).replace(',', '.')) || 0,
                    revenue: parseFloat(String(row[idxValor]).replace(',', '.')) || 0
                });
            }
        }
        if (newRecords.length > 0) { await onImport(newRecords); setShowImportModal(false); alert("Importação finalizada!"); }
      } catch (err: any) { alert(`Erro: ${err.message}`); } finally { setIsProcessing(false); }
  };

  const brandShareData = useMemo(() => {
      const totalRevenue = currentData.reduce((acc, curr) => acc + curr.revenue, 0);
      if (totalRevenue === 0) return [];

      const stats: Record<string, number> = {};
      currentData.forEach(item => {
          if (!stats[item.brand]) stats[item.brand] = 0;
          stats[item.brand] += item.revenue;
      });

      return Object.entries(stats)
        .map(([brand, revenue]) => ({
            name: brand,
            value: (revenue / totalRevenue) * 100,
            revenue
        }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 3);
  }, [currentData]);

  const managementBrandShareData = useMemo(() => {
      const totalSellQty = filteredManagementData.reduce((acc, curr) => acc + curr.sellQty, 0);
      if (totalSellQty === 0) return [];

      const stats: Record<string, { qty: number, revenue: number }> = {};
      filteredManagementData.forEach(item => {
          if (!stats[item.brand]) stats[item.brand] = { qty: 0, revenue: 0 };
          stats[item.brand].qty += item.sellQty;
          stats[item.brand].revenue += item.sellQty * item.sellPrice;
      });

      return Object.entries(stats)
        .map(([brand, val]) => ({
            name: brand,
            value: (val.qty / totalSellQty) * 100,
            revenue: val.revenue
        }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 3);
  }, [filteredManagementData]);

  const handleProcessManagementImport = async () => {
      const XLSX = await import('xlsx');
      if (!selectedManagementFile) return;
      setIsProcessing(true);
      try {
          const arrayBuffer = await selectedManagementFile.arrayBuffer();
          const workbook = XLSX.read(arrayBuffer, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1 }) as any[][];
          
          let headerRowIndex = -1;
          for (let i = 0; i < 20 && i < jsonData.length; i++) {
              const rowStr = jsonData[i].join(' ').toLowerCase();
              if (rowStr.includes('loja') && (rowStr.includes('marca') || rowStr.includes('brand'))) {
                  headerRowIndex = i;
                  break;
              }
          }

          if (headerRowIndex === -1) {
              // Se não encontrar cabeçalho, assume que começa na linha 1 (como antes)
              headerRowIndex = 0;
          }

          const headerRow = jsonData[headerRowIndex].map(h => String(h || '').toLowerCase().trim());
          const findCol = (keywords: string[]) => headerRow.findIndex(h => keywords.some(k => h.includes(k)));

          const idxLoja = findCol(['loja', 'filial', 'store']);
          const idxMarca = findCol(['marca', 'brand', 'fabricante']);
          const idxTipo = findCol(['tipo', 'product', 'type', 'descrição']);
          const idxEstoque = findCol(['estoque', 'stock', 'saldo']);
          const idxCompra = findCol(['compra', 'buy', 'entrada']);
          const idxVenda = findCol(['venda', 'sell', 'saída']);
          const idxPreco = findCol(['preço', 'price', 'valor']);
          const idxData = findCol(['data', 'ultima', 'last', 'buy']);

          const [yearStr, monthStr] = selectedMonth.split('-');
          const year = parseInt(yearStr);
          const month = parseInt(monthStr);

          if (isNaN(year) || isNaN(month)) {
              throw new Error("Mês selecionado inválido.");
          }

          const parseBrFloat = (val: any) => {
              if (val === undefined || val === null || val === '') return 0;
              if (typeof val === 'number') return val;
              const s = String(val).trim();
              return parseFloat(s.replace(/\./g, '').replace(',', '.')) || 0;
          };

          const parseBrInt = (val: any) => {
              if (val === undefined || val === null || val === '') return 0;
              if (typeof val === 'number') return Math.floor(val);
              const s = String(val).trim();
              return parseInt(s.replace(/\./g, '').replace(',', '.')) || 0;
          };

          const normalizeStoreNum = (val: any) => {
              const s = String(val || '').trim();
              if (!s) return '';
              return s.replace(/^0+/, '').replace(/\D/g, '');
          };

          const parseExcelDate = (val: any) => {
              if (!val) return null;
              try {
                  let d: Date;
                  if (typeof val === 'number') {
                      d = new Date((val - 25569) * 86400 * 1000);
                  } else {
                      d = new Date(val);
                  }
                  if (isNaN(d.getTime())) return null;
                  return d.toISOString().split('T')[0];
              } catch {
                  return null;
              }
          };

          const aggregationMap: Record<string, PurchasingManagement> = {};
          
          console.log("Processando planilha:", jsonData.length, "linhas");

          for (let i = headerRowIndex + 1; i < jsonData.length; i++) {
              const row = jsonData[i];
              if (!row || row.length < 3) continue;
              
              const rawStoreNum = idxLoja !== -1 ? row[idxLoja] : row[0];
              const storeNum = normalizeStoreNum(rawStoreNum);
              if (!storeNum) continue;

              const store = stores.find(s => normalizeStoreNum(s.number) === storeNum);
              
              if (store) {
                  const brand = String((idxMarca !== -1 ? row[idxMarca] : row[1]) || 'GERAL').trim().toUpperCase();
                  const productType = String((idxTipo !== -1 ? row[idxTipo] : row[2]) || 'GERAL').trim().toUpperCase();
                  const key = `${store.id}-${brand}-${productType}-${year}-${month}`;

                  if (!aggregationMap[key]) {
                      aggregationMap[key] = {
                          storeId: store.id,
                          brand,
                          productType,
                          stockQty: 0,
                          buyQty: 0,
                          sellQty: 0,
                          sellPrice: 0,
                          lastBuyDate: null,
                          year,
                          month
                      };
                  }

                  const record = aggregationMap[key];
                  record.stockQty += parseBrInt(idxEstoque !== -1 ? row[idxEstoque] : row[3]);
                  record.buyQty += parseBrInt(idxCompra !== -1 ? row[idxCompra] : row[4]);
                  record.sellQty += parseBrInt(idxVenda !== -1 ? row[idxVenda] : row[5]);
                  
                  const price = parseBrFloat(idxPreco !== -1 ? row[idxPreco] : row[9]);
                  if (price > 0) record.sellPrice = price;
                  
                  const date = parseExcelDate(idxData !== -1 ? row[idxData] : row[21]);
                  if (date) record.lastBuyDate = date;
              }
          }

          const newRecords = Object.values(aggregationMap);
          console.log("Registros agregados para envio:", newRecords.length);

          if (newRecords.length > 0) {
              const chunkSize = 200;
              for (let i = 0; i < newRecords.length; i += chunkSize) {
                  const chunk = newRecords.slice(i, i + chunkSize);
                  const isLast = i + chunkSize >= newRecords.length;
                  await onImportManagement(chunk, isLast);
              }
              setShowManagementImportModal(false);
              setSelectedManagementFile(null);
              alert(`Sucesso! ${newRecords.length} registros únicos processados para ${selectedMonth}.`);
          } else {
              alert("Nenhum dado compatível encontrado. Verifique se os números das lojas na planilha coincidem com os cadastrados.");
          }
      } catch (err: any) {
          console.error("Erro detalhado na importação:", err);
          const errorMsg = err.details || err.hint || err.message || JSON.stringify(err);
          alert(`Erro na importação: ${errorMsg}`);
      } finally {
          setIsProcessing(false);
      }
  };

  return (
    <div className="p-4 md:p-10 space-y-6 md:space-y-8 max-w-[1600px] mx-auto animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 bg-white p-6 md:p-8 rounded-[32px] md:rounded-[40px] shadow-sm border border-gray-100">
         <div>
            <h2 className="text-2xl md:text-3xl font-black text-gray-900 flex items-center gap-4 uppercase italic tracking-tighter leading-none">
               <ShoppingBag className="text-blue-700" size={36} />
               Gestão <span className="text-red-600">de Compras</span>
            </h2>
            <p className="text-gray-400 font-bold text-[9px] uppercase tracking-widest mt-2 ml-1">Engenharia Comercial & OTB Pro v6.5</p>
         </div>

         <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
             <div className="flex bg-gray-100 p-1.5 rounded-2xl mr-4 overflow-x-auto no-scrollbar">
                 <button 
                    onClick={() => setActiveTab('management')}
                    className={`px-6 py-3 rounded-xl font-black uppercase text-[10px] transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === 'management' ? 'bg-white text-blue-900 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                 >
                     <Package size={16}/> Gestão Marcas
                 </button>
                 <button 
                    onClick={() => setActiveTab('questionnaire')}
                    className={`px-6 py-3 rounded-xl font-black uppercase text-[10px] transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === 'questionnaire' ? 'bg-white text-blue-900 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                 >
                     <ClipboardList size={16}/> Pesquisas
                 </button>
             </div>
             {activeTab === 'management' && (
                 <div className="flex flex-col sm:flex-row gap-3">
                    <button 
                      onClick={onOpenSpreadsheetModule}
                      className="flex-1 lg:flex-none flex items-center justify-center gap-2 bg-slate-900 text-white px-8 py-4 rounded-2xl hover:bg-slate-800 transition-all shadow-xl font-black uppercase text-[10px] tracking-widest border-b-4 border-slate-700"
                    >
                       <FileSpreadsheet size={18} /> Gerar Pedido
                    </button>
                    <button onClick={() => setShowManagementImportModal(true)} className="flex-1 lg:flex-none flex items-center justify-center gap-2 bg-blue-600 text-white px-8 py-4 rounded-2xl hover:bg-blue-700 transition-all shadow-xl font-black uppercase text-[10px] tracking-widest border-b-4 border-blue-800">
                       <Upload size={18} /> Importar Gestão Compras
                    </button>
                 </div>
             )}
         </div>
      </div>

      {activeTab === 'management' && (
          <div className="space-y-12">
            <div className="text-center space-y-2">
                <h3 className="text-3xl font-black text-gray-900 uppercase italic tracking-tighter">Market Share das <span className="text-blue-700">Principais Marcas</span></h3>
                <p className="text-gray-400 font-bold text-xs uppercase tracking-[0.3em]">Distribuição de participação no mix de vendas</p>
            </div>

            {/* Market Share Layout (Image Inspiration) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {managementBrandShareData.map((brand, idx) => {
                    const brandColors = ['#1e3a8a', '#0d9488', '#f59e0b'];
                    const currentColor = brandColors[idx % brandColors.length];
                    
                    return (
                        <div key={brand.name} className="flex flex-col items-center">
                            {/* Percentage Above */}
                            <div className="mb-4">
                                <span className="text-5xl font-black italic tracking-tighter" style={{ color: currentColor }}>
                                    {brand.value.toFixed(0)}%
                                </span>
                            </div>

                            {/* Radial Chart */}
                            <div className="relative w-56 h-56 mb-8 bg-white rounded-full shadow-inner flex items-center justify-center border-8 border-gray-50">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={[
                                                { value: brand.value },
                                                { value: 100 - brand.value }
                                            ]}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={70}
                                            outerRadius={95}
                                            startAngle={90}
                                            endAngle={-270}
                                            dataKey="value"
                                            stroke="none"
                                            paddingAngle={0}
                                        >
                                            <Cell fill={currentColor} />
                                            <Cell fill="#f8fafc" />
                                        </Pie>
                                    </PieChart>
                                </ResponsiveContainer>
                                <div className="absolute w-2 h-2 rounded-full bg-blue-900 bottom-4"></div>
                            </div>
                            
                            {/* Brand Card */}
                            <div className="w-full bg-white p-8 rounded-[40px] shadow-sm border border-gray-100 flex flex-col items-center text-center">
                                <h4 className="text-xl font-black text-gray-900 uppercase italic tracking-tighter mb-6 pb-4 border-b-2 border-gray-50 w-full">{brand.name}</h4>
                                
                                <div className="w-full space-y-4 text-left">
                                    {(() => {
                                        const itemsByProductType: Record<string, number> = {};
                                        const brandData = filteredManagementData.filter(d => d.brand === brand.name);
                                        const totalBrandQty = brandData.reduce((acc, curr) => acc + curr.sellQty, 0);
                                        
                                        brandData.forEach(d => {
                                            itemsByProductType[d.productType] = (itemsByProductType[d.productType] || 0) + d.sellQty;
                                        });
                                        
                                        const aggregatedItems = Object.entries(itemsByProductType)
                                            .map(([productType, sellQty]) => ({ productType, sellQty }))
                                            .sort((a, b) => b.sellQty - a.sellQty)
                                            .slice(0, 4);

                                        return (
                                            <>
                                                {aggregatedItems.map(item => {
                                                    const pct = totalBrandQty > 0 ? (item.sellQty / totalBrandQty) * 100 : 0;
                                                    return (
                                                        <div key={item.productType} className="flex items-center gap-3">
                                                            <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: currentColor }}></div>
                                                            <div className="flex-1 flex justify-between items-center">
                                                                <span className="text-[10px] font-bold text-gray-500 uppercase truncate pr-4">{item.productType}</span>
                                                                <span className="text-[10px] font-black text-gray-900">{pct.toFixed(1)}%</span>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                                {/* Placeholder if less than 4 items to maintain layout height */}
                                                {Array.from({ length: Math.max(0, 4 - aggregatedItems.length) }).map((_, i) => (
                                                    <div key={`empty-${i}`} className="flex items-center gap-3 opacity-20">
                                                        <div className="w-1.5 h-1.5 rounded-full bg-gray-300"></div>
                                                        <div className="flex-1 flex justify-between items-center">
                                                            <span className="text-[10px] font-bold text-gray-300 uppercase truncate pr-4">-</span>
                                                            <span className="text-[10px] font-black text-gray-300">0.0%</span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </>
                                        );
                                    })()}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-8 rounded-[40px] shadow-sm border border-gray-100">
                    <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-8 flex items-center gap-3">
                        <TrendingUp size={18} className="text-green-600"/> Top 10 Mais Vendidas
                    </h4>
                    <div className="space-y-4">
                        {topSoldBrands.map((b, i) => (
                            <div key={b.brand} className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl hover:bg-gray-100 transition-all group">
                                <div className="flex items-center gap-4">
                                    <span className="text-lg font-black text-gray-200 italic group-hover:text-green-200 transition-colors">#{i+1}</span>
                                    <span className="text-xs font-black text-gray-700 uppercase italic tracking-tighter">{b.brand}</span>
                                </div>
                                <span className="text-xs font-black text-blue-900">{b.qty.toLocaleString()} <span className="text-[8px] text-gray-400 uppercase tracking-widest ml-1">Pares</span></span>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="bg-white p-8 rounded-[40px] shadow-sm border border-gray-100">
                    <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-8 flex items-center gap-3">
                        <ShoppingBag size={18} className="text-blue-600"/> Top 10 Mais Compradas
                    </h4>
                    <div className="space-y-4">
                        {topBoughtBrands.map((b, i) => (
                            <div key={b.brand} className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl hover:bg-gray-100 transition-all group">
                                <div className="flex items-center gap-4">
                                    <span className="text-lg font-black text-gray-200 italic group-hover:text-blue-200 transition-colors">#{i+1}</span>
                                    <span className="text-xs font-black text-gray-700 uppercase italic tracking-tighter">{b.brand}</span>
                                </div>
                                <span className="text-xs font-black text-blue-900">{b.qty.toLocaleString()} <span className="text-[8px] text-gray-400 uppercase tracking-widest ml-1">Pares</span></span>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="bg-white p-8 rounded-[40px] shadow-sm border border-gray-100">
                    <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-8 flex items-center gap-3">
                        <AlertTriangle size={18} className="text-red-600"/> Top 10 Menor Estoque
                    </h4>
                    <div className="space-y-4">
                        {lowStockBrands.map((b, i) => (
                            <div key={b.brand} className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl hover:bg-gray-100 transition-all group">
                                <div className="flex items-center gap-4">
                                    <span className="text-lg font-black text-gray-200 italic group-hover:text-red-200 transition-colors">#{i+1}</span>
                                    <span className="text-xs font-black text-gray-700 uppercase italic tracking-tighter">{b.brand}</span>
                                </div>
                                <span className="text-xs font-black text-red-700">{b.qty.toLocaleString()} <span className="text-[8px] text-gray-400 uppercase tracking-widest ml-1">Pares</span></span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div className="bg-white p-8 rounded-[40px] shadow-sm border border-gray-100">
                <h3 className="font-black text-lg text-gray-900 uppercase italic tracking-tighter mb-8">Mix Detalhado por <span className="text-red-600">Marca</span></h3>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {brandMixDetails.map(mix => (
                        <div key={mix.brand} className="border border-gray-100 rounded-3xl overflow-hidden">
                            <div className="bg-gray-50 p-4 border-b flex justify-between items-center">
                                <span className="font-black text-sm uppercase italic text-blue-900">{mix.brand}</span>
                                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{mix.totalSell} Pares Vendidos</span>
                            </div>
                            <div className="p-4 overflow-x-auto">
                                <table className="w-full text-left text-[10px]">
                                    <thead>
                                        <tr className="text-gray-400 uppercase font-black border-b border-gray-50">
                                            <th className="pb-2">Tipo</th>
                                            <th className="pb-2 text-center">Estoque</th>
                                            <th className="pb-2 text-center">Compra</th>
                                            <th className="pb-2 text-center">Venda</th>
                                            <th className="pb-2 text-right">Preço</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                        {mix.items.map((item, idx) => (
                                            <tr key={idx} className="hover:bg-gray-50/50">
                                                <td className="py-2 font-bold text-gray-600 uppercase">{item.productType}</td>
                                                <td className="py-2 text-center font-black">{item.stockQty}</td>
                                                <td className="py-2 text-center font-black text-blue-600">{item.buyQty}</td>
                                                <td className="py-2 text-center font-black text-green-600">{item.sellQty}</td>
                                                <td className="py-2 text-right font-black text-gray-900">{formatCurrency(item.sellPrice)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
          </div>
      )}

      {activeTab === 'questionnaire' && (
          <PurchaseQuestionnaire user={user} stores={stores} adminUsers={adminUsers} can={can} />
      )}

      {/* Modais de Importação */}
      {showImportModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
              <div className="bg-white rounded-[40px] p-8 max-w-md w-full shadow-2xl animate-in zoom-in duration-300">
                  <div className="flex justify-between items-center mb-6">
                      <h3 className="text-xl font-black text-gray-900 uppercase italic tracking-tighter">Importar <span className="text-green-600">Vendas</span></h3>
                      <button onClick={() => setShowImportModal(false)} className="p-2 hover:bg-gray-100 rounded-full"><X size={20}/></button>
                  </div>
                  <div className="space-y-4">
                      <p className="text-xs text-gray-500 font-bold leading-relaxed">Selecione o arquivo Excel exportado do sistema para atualizar o desempenho das marcas.</p>
                      <input 
                        type="file" 
                        accept=".xlsx, .xls" 
                        onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                        className="w-full text-xs file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-black file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                      />
                      <button 
                        disabled={!selectedFile || isProcessing}
                        onClick={handleProcessImport}
                        className="w-full py-4 bg-green-600 text-white rounded-2xl font-black uppercase text-xs shadow-xl hover:bg-green-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                          {isProcessing ? <Loader2 className="animate-spin" size={18}/> : <CheckCircle size={18}/>}
                          {isProcessing ? 'Processando...' : 'Confirmar Importação'}
                      </button>
                  </div>
              </div>
          </div>
      )}

      {showManagementImportModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
              <div className="bg-white rounded-[40px] p-8 max-w-md w-full shadow-2xl animate-in zoom-in duration-300">
                  <div className="flex justify-between items-center mb-6">
                      <h3 className="text-xl font-black text-gray-900 uppercase italic tracking-tighter">Importar <span className="text-blue-600">Gestão Compras</span></h3>
                      <button onClick={() => { setShowManagementImportModal(false); setSelectedManagementFile(null); }} className="p-2 hover:bg-gray-100 rounded-full"><X size={20}/></button>
                  </div>
                  <div className="space-y-4">
                      <p className="text-xs text-gray-500 font-bold leading-relaxed">
                        Importe a planilha <strong>GestaoCompras</strong> com as colunas:<br/>
                        A: Loja, B: Marca, C: Tipo, D: Estoque, E: Compra, F: Venda, J: Preço, V: Última Compra.
                      </p>
                      <input 
                        type="file" 
                        accept=".xlsx, .xls" 
                        onChange={(e) => setSelectedManagementFile(e.target.files?.[0] || null)}
                        className="w-full text-xs file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-black file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                      />
                      <button 
                        disabled={!selectedManagementFile || isProcessing}
                        onClick={handleProcessManagementImport}
                        className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black uppercase text-xs shadow-xl hover:bg-blue-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                          {isProcessing ? <Loader2 className="animate-spin" size={18}/> : <CheckCircle size={18}/>}
                          {isProcessing ? 'Processando...' : 'Confirmar Importação'}
                      </button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default DashboardPurchases;
