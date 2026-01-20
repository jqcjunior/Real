
import React, { useState, useMemo, useRef } from 'react';
import { Store, ProductPerformance, User } from '../types';
import { formatCurrency } from '../constants';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { ShoppingBag, TrendingUp, Upload, Filter, Calendar, Package, DollarSign, Award, ArrowUpRight, CheckCircle, Loader2, TrendingDown, FileSpreadsheet, Plus } from 'lucide-react';
import * as XLSX from 'xlsx';

interface DashboardPurchasesProps {
  user: User;
  stores: Store[];
  data: ProductPerformance[];
  onImport: (newData: ProductPerformance[]) => Promise<void>;
  onOpenSpreadsheetModule: () => void;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

const MONTHS = [
  { value: 1, label: 'Janeiro' }, { value: 2, label: 'Fevereiro' }, { value: 3, label: 'Março' },
  { value: 4, label: 'Abril' }, { value: 5, label: 'Maio' }, { value: 6, label: 'Junho' },
  { value: 7, label: 'Julho' }, { value: 8, label: 'Agosto' }, { value: 9, label: 'Setembro' },
  { value: 10, label: 'Outubro' }, { value: 11, label: 'Novembro' }, { value: 12, label: 'Dezembro' }
];

const DashboardPurchases: React.FC<DashboardPurchasesProps> = ({ stores, data, onImport, user, onOpenSpreadsheetModule }) => {
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
     const uniqueMonths = Array.from(new Set(data.map(d => d.month))).sort();
     return uniqueMonths.length > 0 ? uniqueMonths[uniqueMonths.length - 1] : new Date().toISOString().slice(0, 7);
  });
  
  const [showImportModal, setShowImportModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleMonthYearChange = (type: 'month' | 'year', value: number) => {
      const [currentY, currentM] = selectedMonth.split('-');
      let newY = parseInt(currentY);
      let newM = parseInt(currentM);
      if (type === 'month') newM = value;
      if (type === 'year') newY = value;
      setSelectedMonth(`${newY}-${String(newM).padStart(2, '0')}`);
  };

  const availableYears = useMemo(() => {
      const years = new Set<number>();
      years.add(new Date().getFullYear());
      data.forEach(d => years.add(parseInt(d.month.split('-')[0])));
      return Array.from(years).sort((a,b) => b-a);
  }, [data]);

  const currentData = useMemo(() => data.filter(d => d.month === selectedMonth), [data, selectedMonth]);

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
      if (!selectedFile) return;
      setIsProcessing(true);
      try {
        const arrayBuffer = await selectedFile.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer);
        const jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { header: 1 }) as any[][];
        let headerRowIndex = -1;
        for (let i = 0; i < 20 && i < jsonData.length; i++) {
            const rowStr = jsonData[i].join(' ').toLowerCase();
            if (rowStr.includes('loja') && (rowStr.includes('marca') || rowStr.includes('produto'))) { headerRowIndex = i; break; }
        }
        if (headerRowIndex === -1) throw new Error("Cabeçalho não encontrado.");
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
                    storeId: store.id,
                    month: selectedMonth,
                    brand: String(row[idxMarca] || 'Geral').trim(),
                    category: String(row[idxCat] || 'Geral').trim(),
                    pairsSold: parseFloat(String(row[idxPares]).replace(',', '.')) || 0,
                    revenue: parseFloat(String(row[idxValor]).replace(',', '.')) || 0
                });
            }
        }
        if (newRecords.length > 0) { await onImport(newRecords); alert("Importação concluída!"); setShowImportModal(false); }
      } catch (err: any) { alert(`Erro: ${err.message}`); } finally { setIsProcessing(false); }
  };

  return (
    <div className="p-8 space-y-8 max-w-[1600px] mx-auto animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
         <div>
            <h2 className="text-3xl font-black text-gray-900 flex items-center gap-4 uppercase italic tracking-tighter">
               <ShoppingBag className="text-blue-700" size={36} />
               Gestão <span className="text-red-600">de Compras</span>
            </h2>
            <p className="text-gray-500 font-bold text-[10px] uppercase tracking-widest mt-2">Inteligência Comercial & Geração de Pedidos</p>
         </div>

         <div className="flex items-center gap-3">
             <button 
                onClick={onOpenSpreadsheetModule}
                className="flex items-center gap-2 bg-gray-900 text-white px-6 py-3 rounded-2xl hover:bg-black transition-all shadow-xl font-black uppercase text-[10px] tracking-widest border-b-4 border-blue-600"
             >
                 <FileSpreadsheet size={18} /> Incluir Pedido via Planilha
             </button>
             <button 
                onClick={() => setShowImportModal(true)}
                className="flex items-center gap-2 bg-green-600 text-white px-6 py-3 rounded-2xl hover:bg-green-700 transition-all shadow-xl font-black uppercase text-[10px] tracking-widest border-b-4 border-green-800"
             >
                 <Upload size={18} /> Importar Vendas
             </button>
         </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white p-8 rounded-[40px] shadow-sm border border-gray-100 flex items-center justify-between group overflow-hidden relative">
              <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity"><Package size={80}/></div>
              <div className="relative z-10">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Volume Total</p>
                  <p className="text-3xl font-black text-gray-900 italic">
                      {currentData.reduce((acc, curr) => acc + curr.pairsSold, 0).toLocaleString()} <span className="text-xs text-gray-400 not-italic uppercase font-bold">pares</span>
                  </p>
              </div>
          </div>
          <div className="bg-white p-8 rounded-[40px] shadow-sm border border-gray-100 flex items-center justify-between group overflow-hidden relative">
              <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity"><DollarSign size={80}/></div>
              <div className="relative z-10">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Venda Marcas</p>
                  <p className="text-3xl font-black text-blue-900 italic">
                      {formatCurrency(currentData.reduce((acc, curr) => acc + curr.revenue, 0))}
                  </p>
              </div>
          </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 bg-white p-8 rounded-[48px] shadow-sm border border-gray-100">
              <h3 className="font-black text-lg text-gray-900 uppercase italic tracking-tighter mb-8 flex items-center gap-3">
                  <TrendingUp size={24} className="text-blue-600"/> Desempenho <span className="text-blue-600">Top 10 Marcas</span>
              </h3>
              <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={brandPerformance}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis dataKey="brand" fontSize={10} fontWeight="900" tickLine={false} axisLine={false} />
                          <YAxis fontSize={10} fontWeight="900" tickFormatter={(val) => `R$${val/1000}k`} />
                          <Tooltip cursor={{fill: '#f8fafc'}} />
                          <Bar dataKey="revenue" name="Venda (R$)" fill="#1e3a8a" radius={[12, 12, 0, 0]} barSize={40} />
                      </BarChart>
                  </ResponsiveContainer>
              </div>
          </div>

          <div className="bg-white p-8 rounded-[48px] shadow-sm border border-gray-100 flex flex-col">
              <h3 className="font-black text-lg text-gray-900 uppercase italic tracking-tighter mb-8">Mix de <span className="text-red-600">Categorias</span></h3>
              <div className="flex-1 h-80">
                  <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                          <Pie data={categoryData} cx="50%" cy="50%" innerRadius={70} outerRadius={100} paddingAngle={8} dataKey="value">
                              {categoryData.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="none" />
                              ))}
                          </Pie>
                          <Tooltip />
                      </PieChart>
                  </ResponsiveContainer>
              </div>
          </div>
      </div>

      {showImportModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-[40px] p-10 max-w-md w-full shadow-2xl border-t-8 border-green-600 animate-in zoom-in duration-300">
                  <h3 className="text-2xl font-black text-gray-900 uppercase italic tracking-tighter mb-6">Importar Vendas</h3>
                  <input type="file" ref={fileInputRef} className="hidden" accept=".xlsx, .xls" onChange={e => setSelectedFile(e.target.files?.[0] || null)} />
                  <div onClick={() => !isProcessing && fileInputRef.current?.click()} className={`border-4 border-dashed rounded-[32px] p-12 flex flex-col items-center justify-center mb-8 cursor-pointer transition-all ${selectedFile ? 'border-green-300 bg-green-50' : 'border-gray-100 bg-gray-50 hover:bg-white hover:border-blue-300'}`}>
                      {selectedFile ? <CheckCircle size={48} className="text-green-500 mb-2" /> : <Upload size={48} className="text-gray-200 mb-2" />}
                      <span className="text-[10px] font-black uppercase text-gray-500">{selectedFile ? selectedFile.name : 'Selecionar Planilha'}</span>
                  </div>
                  <div className="flex gap-4">
                      <button onClick={() => setShowImportModal(false)} className="flex-1 py-4 bg-gray-100 rounded-2xl font-black uppercase text-[10px] text-gray-500 hover:bg-gray-200 transition-all">Cancelar</button>
                      <button onClick={handleProcessImport} disabled={!selectedFile || isProcessing} className="flex-1 py-4 bg-green-600 text-white rounded-2xl font-black uppercase text-[10px] shadow-lg disabled:opacity-50 hover:bg-green-700 transition-all">
                        {isProcessing ? <Loader2 className="animate-spin mx-auto" /> : 'Processar'}
                      </button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default DashboardPurchases;
