
import React, { useState, useMemo, useRef } from 'react';
import { Store, ProductPerformance, User } from '../types';
import { formatCurrency } from '../constants';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { ShoppingBag, TrendingUp, Upload, Filter, Calendar, Package, DollarSign, Award, ArrowUpRight, CheckCircle, Loader2, TrendingDown, FileSpreadsheet, Plus, ArrowRight } from 'lucide-react';
import * as XLSX from 'xlsx';

interface DashboardPurchasesProps {
  user: User;
  stores: Store[];
  data: ProductPerformance[];
  onImport: (newData: ProductPerformance[]) => Promise<void>;
  onOpenSpreadsheetModule: () => void;
}

const COLORS = ['#1e3a8a', '#dc2626', '#fbbf24', '#10b981', '#6366f1', '#ec4899'];

const MONTHS = [
  { value: 1, label: 'Janeiro' }, { value: 2, label: 'Fevereiro' }, { value: 3, label: 'Março' },
  { value: 4, label: 'Abril' }, { value: 5, label: 'Maio' }, { value: 6, label: 'Junho' },
  { value: 7, label: 'Julho' }, { value: 8, label: 'Agosto' }, { value: 9, label: 'Setembro' },
  { value: 10, label: 'Outubro' }, { value: 11, label: 'Novembro' }, { value: 12, label: 'Dezembro' }
];

const DashboardPurchases: React.FC<DashboardPurchasesProps> = ({ stores, data, onImport, user, onOpenSpreadsheetModule }) => {
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
     const now = new Date();
     return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  
  const [showImportModal, setShowImportModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

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
             <button onClick={onOpenSpreadsheetModule} className="flex-1 lg:flex-none flex items-center justify-center gap-2 bg-gray-950 text-white px-8 py-4 rounded-2xl hover:bg-black transition-all shadow-xl font-black uppercase text-[10px] tracking-widest border-b-4 border-blue-600">
                 <FileSpreadsheet size={18} /> Planilha Pedido
             </button>
             <button onClick={() => setShowImportModal(true)} className="flex-1 lg:flex-none flex items-center justify-center gap-2 bg-green-600 text-white px-8 py-4 rounded-2xl hover:bg-green-700 transition-all shadow-xl font-black uppercase text-[10px] tracking-widest border-b-4 border-green-800">
                 <Upload size={18} /> Importar Vendas
             </button>
         </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
          <div className="bg-white p-8 rounded-[40px] shadow-sm border border-gray-100 flex items-center justify-between group overflow-hidden relative">
              <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity"><Package size={80}/></div>
              <div className="relative z-10">
                  <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Volume Consolidado</p>
                  <p className="text-3xl font-black text-gray-900 italic tracking-tighter">
                      {currentData.reduce((acc, curr) => acc + curr.pairsSold, 0).toLocaleString()} <span className="text-[10px] text-gray-400 not-italic uppercase font-black tracking-[0.2em] ml-2">Pares</span>
                  </p>
              </div>
          </div>
          <div className="bg-white p-8 rounded-[40px] shadow-sm border border-gray-100 flex items-center justify-between group overflow-hidden relative">
              <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity"><DollarSign size={80}/></div>
              <div className="relative z-10">
                  <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Venda Direta Marcas</p>
                  <p className="text-3xl font-black text-blue-900 italic tracking-tighter leading-none">
                      {formatCurrency(currentData.reduce((acc, curr) => acc + curr.revenue, 0))}
                  </p>
              </div>
          </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
          <div className="lg:col-span-2 bg-white p-6 md:p-8 rounded-[40px] md:rounded-[48px] shadow-sm border border-gray-100">
              <h3 className="font-black text-lg text-gray-900 uppercase italic tracking-tighter mb-8 flex items-center gap-3">
                  <TrendingUp size={24} className="text-blue-600"/> Desempenho <span className="text-blue-600">Top 10 Marcas</span>
              </h3>
              <div className="h-80 w-full overflow-hidden">
                  <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={brandPerformance}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis dataKey="brand" fontSize={9} fontWeight="900" tickLine={false} axisLine={false} />
                          <YAxis fontSize={9} fontWeight="900" tickFormatter={(val) => `R$${val/1000}k`} />
                          <Tooltip cursor={{fill: '#f8fafc'}} />
                          <Bar dataKey="revenue" name="Venda (R$)" fill="#1e3a8a" radius={[8, 8, 0, 0]} barSize={32} />
                      </BarChart>
                  </ResponsiveContainer>
              </div>
          </div>

          <div className="bg-white p-6 md:p-8 rounded-[40px] md:rounded-[48px] shadow-sm border border-gray-100 flex flex-col">
              <h3 className="font-black text-lg text-gray-900 uppercase italic tracking-tighter mb-8">Mix de <span className="text-red-600">Categorias</span></h3>
              <div className="flex-1 h-80 min-h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                          <Pie data={categoryData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={8} dataKey="value">
                              {categoryData.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="none" />
                              ))}
                          </Pie>
                          <Tooltip />
                      </PieChart>
                  </ResponsiveContainer>
              </div>
              <div className="mt-4 flex flex-wrap gap-2 justify-center">
                  {categoryData.slice(0, 4).map((c, i) => (
                      <div key={c.name} className="flex items-center gap-1.5 px-2 py-1 bg-gray-50 rounded-lg">
                          <div className="w-2 h-2 rounded-full" style={{backgroundColor: COLORS[i % COLORS.length]}}></div>
                          <span className="text-[8px] font-black uppercase text-gray-500">{c.name.substring(0, 10)}</span>
                      </div>
                  ))}
              </div>
          </div>
      </div>
    </div>
  );
};

export default DashboardPurchases;
