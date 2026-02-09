import React, { useState, useMemo, useRef } from 'react';
import { Upload, FileSpreadsheet, X, Loader2, CheckCircle2, AlertTriangle, AlertCircle, Trophy, Search, Target, TrendingUp, Hash, Zap, Package, ArrowRight } from 'lucide-react';
import * as XLSX from 'xlsx';
import { supabase } from '../services/supabaseClient';
import { Store, MonthlyPerformance, MonthlyGoal } from '../types';

// Utilitários de formatação generosos para legibilidade
const formatCurrency = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
const formatDecimal = (v: number) => new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v || 0);

interface DashboardAdminProps {
  stores: Store[];
  performanceData: MonthlyPerformance[];
  goalsData: MonthlyGoal[];
  onImportData: () => Promise<void>;
}

const OPEN_MONTH = '2026-02';

const DashboardAdmin: React.FC<DashboardAdminProps> = ({ 
  stores = [], 
  performanceData = [], 
  onImportData 
}) => {
  const [selectedMonth, setSelectedMonth] = useState(OPEN_MONTH);
  const [showImportModal, setShowImportModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isMonthLocked = selectedMonth < OPEN_MONTH;

  // Conversão numérica robusta para o padrão Excel/BI
  const parseNumeric = (val: any): number => {
    if (val === null || val === undefined || val === '') return 0;
    if (typeof val === 'number') return val;
    let s = String(val).replace(/[R$\s\u00A0]/g, '').trim();
    if (!s) return 0;
    if (s.includes(',') && s.includes('.')) s = s.replace(/\./g, '').replace(',', '.');
    else if (s.includes(',')) s = s.replace(',', '.');
    const n = parseFloat(s);
    return isNaN(n) ? 0 : n;
  };

  // Mapa de performance indexado por StoreID_Mês para busca ultra-rápida e precisa
  const performanceMap = useMemo(() => {
    const map = new Map<string, MonthlyPerformance>();
    if (!Array.isArray(performanceData)) return map;
    performanceData.forEach(p => {
      const sId = p.storeId;
      if (sId && p.month) {
        map.set(`${sId}_${p.month}`, p);
      }
    });
    return map;
  }, [performanceData]);

  const rankedData = useMemo(() => {
    return stores
      .filter(s => s.status === 'active')
      .map(store => {
        const p = performanceMap.get(`${store.id}_${selectedMonth}`);
        
        // Pega do banco (View) os valores reais e as metas vinculadas
        const revAct = Number(p?.revenueActual ?? 0);
        const itemsAct = Number(p?.itemsActual ?? 0);
        const salesAct = Number(p?.salesActual ?? 0);
        
        // Indicadores: Prioriza os calculados pela View/Banco para bater com o BI
        const paAct = Number(p?.itemsPerTicket ?? 0);
        const puAct = Number(p?.unitPriceAverage ?? 0);
        const ticketAct = Number(p?.averageTicket ?? 0);

        // Metas vindas do cadastro (pelo JOIN da View no Supabase)
        const revTgt = Number(p?.revenueTarget ?? 0);
        const itemsTgt = Number(p?.itemsTarget ?? 0);
        const paTgt = Number(p?.paTarget ?? 0);
        const puTgt = Number(p?.puTarget ?? 0);
        const ticketTgt = Number(p?.ticketTarget ?? 0);

        const ating = revTgt > 0 ? (revAct / revTgt) * 100 : 0;
        const gapRevenue = Math.max(0, revTgt - revAct);

        return { 
          ...store, 
          revAct, revTgt, gapRevenue,
          itemsAct, itemsTgt,
          paAct, paTgt,
          puAct, puTgt,
          ticketAct, ticketTgt,
          ating, 
          score: ating 
        };
      })
      .filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase()) || s.number.includes(searchTerm))
      .sort((a, b) => b.score - a.score);
  }, [performanceMap, stores, selectedMonth, searchTerm]);

  const handleProcessImport = async () => {
    if (!selectedFile || isProcessing || isMonthLocked) return;
    setIsProcessing(true);

    try {
      const dataArr = await selectedFile.arrayBuffer();
      const workbook = XLSX.read(dataArr, { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null }) as any[][];
      
      let headerIndex = -1;
      for (let i = 0; i < Math.min(rawRows.length, 40); i++) {
        const rowStr = (rawRows[i] || []).join('|').toUpperCase();
        if (rowStr.includes('LOJA') && (rowStr.includes('VALOR') || rowStr.includes('VENDIDO'))) {
          headerIndex = i;
          break;
        }
      }

      if (headerIndex === -1) throw new Error("Colunas 'LOJA' e 'VALOR VENDIDO' não encontradas.");

      const headers = rawRows[headerIndex].map(h => String(h || '').toUpperCase().trim());
      const findColIdx = (keywords: string[]) => headers.findIndex(h => keywords.some(k => h.includes(k)));

      const colLoja = headers.findIndex(h => h === 'LOJA' || h === 'FILIAL' || h === 'UNIDADE');
      const colRevenue = findColIdx(['VALOR VENDIDO', 'VENDIDO', 'FATURAMENTO', 'VALOR TOTAL']);
      const colItens = findColIdx(['QTDE ITENS', 'QTD ITENS', 'PARES', 'ITENS']);
      const colVendas = findColIdx(['QTDE VENDAS', 'QTD VENDAS', 'VENDAS', 'CUPONS', 'QUPONS']);

      const { data: { user } } = await supabase.auth.getUser();
      const recordsToUpsert: any[] = [];

      rawRows.slice(headerIndex + 1).forEach((row) => {
        const rawLoja = row[colLoja];
        if (!rawLoja) return;

        const storeNum = String(rawLoja).replace(/\D/g, '').replace(/^0+/, '');
        const store = stores.find(s => String(s.number).replace(/^0+/, '') === storeNum);

        if (store) {
          const rev = parseNumeric(row[colRevenue]);
          const its = parseNumeric(row[colItens]);
          const vds = parseNumeric(row[colVendas]) || 1; // Evita divisão por zero

          // Cálculos explícitos para gravação no banco
          const pa = vds > 0 ? its / vds : 0;
          const pu = its > 0 ? rev / its : 0;
          const tkt = vds > 0 ? rev / vds : 0;

          if (rev > 0) {
            recordsToUpsert.push({
              store_id: store.id,
              month: selectedMonth,
              revenue_actual: rev,
              items_actual: Math.round(its),
              sales_actual: Math.round(vds),
              items_per_ticket: pa,
              unit_price_average: pu,
              average_ticket: tkt,
              last_import_by: user?.email || 'Admin',
              updated_at: new Date().toISOString()
            });
          }
        }
      });

      if (recordsToUpsert.length === 0) throw new Error("Nenhuma loja da planilha foi identificada no sistema.");

      // Limpa dados anteriores do mês e insere os novos
      await supabase.from('monthly_performance_actual').delete().eq('month', selectedMonth);
      const { error } = await supabase.from('monthly_performance_actual').insert(recordsToUpsert);
      
      if (error) throw error;

      alert(`Sucesso! ${recordsToUpsert.length} lojas atualizadas e vinculadas às metas.`);
      setShowImportModal(false);
      setSelectedFile(null);
      await onImportData();
    } catch (e: any) {
      alert("Erro no Processamento: " + e.message);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="p-4 md:p-8 space-y-8 animate-in fade-in duration-500 pb-24">
      
      {/* HEADER PRINCIPAL - ESPAÇOSO */}
      <div className="flex flex-col lg:flex-row justify-between items-center bg-white p-6 md:p-8 rounded-[40px] shadow-sm border border-gray-100 gap-6">
        <div className="flex items-center gap-6">
          <div className="p-4 bg-red-600 text-white rounded-3xl shadow-2xl shadow-red-100">
            <Trophy size={32} />
          </div>
          <div>
            <h2 className="text-2xl md:text-3xl font-black text-gray-900 uppercase italic tracking-tighter leading-none">
              Ranking <span className="text-red-600">Corporativo</span>
            </h2>
            <p className="text-xs font-black text-gray-400 uppercase tracking-widest mt-2">Inteligência de Performance Real</p>
          </div>
        </div>

        <div className="flex items-center gap-4 w-full lg:w-auto">
          <select 
            value={selectedMonth} 
            onChange={e => setSelectedMonth(e.target.value)}
            className="flex-1 lg:flex-none bg-gray-100 px-6 py-3.5 rounded-2xl text-xs font-black uppercase text-blue-900 border-none outline-none cursor-pointer focus:ring-2 focus:ring-blue-200"
          >
            <option value="2026-02">Fevereiro 2026</option>
            <option value="2026-01">Janeiro 2026</option>
          </select>
          <button 
            onClick={() => setShowImportModal(true)}
            className="flex-1 lg:flex-none bg-blue-950 text-white px-8 py-3.5 rounded-2xl font-black uppercase text-xs shadow-xl hover:bg-red-600 transition-all flex items-center justify-center gap-3 border-b-4 border-slate-800"
          >
            <Upload size={18}/> Sincronizar BI
          </button>
        </div>
      </div>

      {/* SEARCH BAR E LEGENDAS */}
      <div className="bg-white p-5 rounded-[32px] shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between items-center gap-5">
          <div className="relative flex-1 max-w-lg w-full">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input 
              type="text" 
              placeholder="Buscar unidade por nome ou número..." 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-14 pr-6 py-4 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-bold outline-none focus:ring-4 focus:ring-blue-50 transition-all shadow-inner"
            />
          </div>
          <div className="flex gap-6">
             <div className="flex items-center gap-2"><div className="w-3 h-3 bg-green-500 rounded-full"></div><span className="text-[10px] font-black uppercase text-gray-400">Meta OK</span></div>
             <div className="flex items-center gap-2"><div className="w-3 h-3 bg-red-500 rounded-full"></div><span className="text-[10px] font-black uppercase text-gray-400">Pendente</span></div>
          </div>
      </div>

      {/* TABELA DE RANKING - ESPAÇOSA E STICKY */}
      <div className="bg-white rounded-[48px] shadow-2xl border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto no-scrollbar">
          <table className="w-full text-left min-w-[1400px] border-separate border-spacing-0">
            <thead>
              <tr className="bg-gray-50 sticky top-0 z-40 border-b">
                <th className="px-8 py-6 text-center w-20 font-black text-xs text-gray-400 uppercase tracking-widest bg-gray-50 sticky left-0 z-50">Pos</th>
                <th className="px-8 py-6 border-b font-black text-xs text-gray-400 uppercase tracking-widest bg-gray-50 sticky left-20 z-50 shadow-[2px_0_5px_rgba(0,0,0,0.02)] min-w-[280px]">Unidade / Localização</th>
                <th className="px-8 py-6 border-b font-black text-xs text-gray-400 uppercase tracking-widest bg-gray-50">Faturamento Real</th>
                <th className="px-8 py-6 border-b font-black text-xs text-gray-400 uppercase tracking-widest bg-gray-50 text-center">Itens (Pares)</th>
                <th className="px-8 py-6 border-b font-black text-xs text-gray-400 uppercase tracking-widest bg-gray-50 text-center">P.A.</th>
                <th className="px-8 py-6 border-b font-black text-xs text-gray-400 uppercase tracking-widest bg-gray-50 text-center">P.U.</th>
                <th className="px-8 py-6 border-b font-black text-xs text-gray-400 uppercase tracking-widest bg-gray-50 text-center">Ticket Médio</th>
                <th className="px-8 py-6 border-b font-black text-xs text-red-600 uppercase tracking-widest bg-gray-50 text-right">Quanto Falta</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {rankedData.map((item, idx) => (
                <tr key={item.id} className="hover:bg-blue-50/50 transition-colors group">
                  <td className="px-8 py-6 text-center sticky left-0 bg-white group-hover:bg-blue-50/50 z-20">
                    <span className={`text-2xl font-black italic ${idx < 3 ? 'text-amber-500' : 'text-gray-300'}`}>#{idx + 1}</span>
                  </td>
                  <td className="px-8 py-6 sticky left-20 bg-white group-hover:bg-blue-50/50 z-20 shadow-[2px_0_5px_rgba(0,0,0,0.02)]">
                    <div className="font-black text-gray-900 uppercase italic text-sm tracking-tighter leading-none mb-1">#{item.number} {item.name}</div>
                    <div className="text-[10px] font-bold text-gray-400 uppercase tracking-tight">{item.city}</div>
                  </td>
                  <td className="px-8 py-6">
                    <div className="flex justify-between items-baseline mb-2">
                        <span className="font-black text-blue-950 text-base italic leading-none">{formatCurrency(item.revAct)}</span>
                        <span className={`text-xs font-black italic ${item.ating >= 100 ? 'text-green-600' : 'text-gray-400'}`}>{item.ating.toFixed(1)}%</span>
                    </div>
                    <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden shadow-inner">
                      <div 
                        className={`h-full transition-all duration-1000 ${item.ating >= 100 ? 'bg-green-500' : item.ating >= 85 ? 'bg-blue-500' : 'bg-red-500'}`} 
                        style={{ width: `${Math.min(item.ating, 100)}%` }} 
                      />
                    </div>
                  </td>
                  <td className="px-8 py-6 text-center">
                    <div className={`font-black text-sm italic leading-none ${item.itemsAct >= item.itemsTgt && item.itemsTgt > 0 ? 'text-green-600' : 'text-slate-800'}`}>{Math.round(item.itemsAct).toLocaleString('pt-BR')} PR</div>
                    <div className="text-[9px] text-gray-400 uppercase font-black mt-1.5">Meta: {Math.round(item.itemsTgt).toLocaleString('pt-BR')}</div>
                  </td>
                  <td className="px-8 py-6 text-center">
                    <div className={`font-black text-sm italic leading-none ${item.paAct >= item.paTgt && item.paTgt > 0 ? 'text-green-600' : 'text-blue-900'}`}>{formatDecimal(item.paAct)}</div>
                    <div className="text-[9px] text-gray-400 uppercase font-black mt-1.5">Meta: {formatDecimal(item.paTgt)}</div>
                  </td>
                  <td className="px-8 py-6 text-center">
                    <div className={`font-black text-sm italic leading-none ${item.puAct >= item.puTgt && item.puTgt > 0 ? 'text-green-600' : 'text-blue-900'}`}>{formatDecimal(item.puAct)}</div>
                    <div className="text-[9px] text-gray-400 uppercase font-black mt-1.5">Meta: {formatDecimal(item.puTgt)}</div>
                  </td>
                  <td className="px-8 py-6 text-center">
                    <div className={`font-black text-sm italic leading-none ${item.ticketAct >= item.ticketTgt && item.ticketTgt > 0 ? 'text-green-600' : 'text-blue-900'}`}>{formatCurrency(item.ticketAct)}</div>
                    <div className="text-[9px] text-gray-400 uppercase font-black mt-1.5">Meta: {formatCurrency(item.ticketTgt)}</div>
                  </td>
                  <td className="px-8 py-6 text-right">
                    <div className={`font-black text-sm italic ${item.gapRevenue > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {item.gapRevenue > 0 ? `-${formatCurrency(item.gapRevenue)}` : 'META ATINGIDA'}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {rankedData.length === 0 && (
            <div className="py-32 text-center">
                <AlertCircle className="mx-auto text-gray-200 mb-4" size={64} />
                <p className="text-sm font-black text-gray-300 uppercase tracking-[0.4em]">Nenhum dado importado para o período</p>
            </div>
          )}
        </div>
      </div>

      {/* MODAL DE IMPORTAÇÃO */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[200] p-4">
          <div className="bg-white rounded-[48px] w-full max-w-md shadow-2xl animate-in zoom-in duration-300 overflow-hidden border border-white/20">
            <div className="p-8 border-b bg-gray-50 flex justify-between items-center">
              <h3 className="text-xl font-black uppercase italic text-blue-950 flex items-center gap-3"><FileSpreadsheet className="text-green-600" /> Sincronizar <span className="text-green-600">BI</span></h3>
              <button onClick={() => setShowImportModal(false)} className="bg-white p-2 rounded-full text-gray-400 hover:text-red-600 shadow-sm border transition-all"><X size={24} /></button>
            </div>
            <div className="p-10 space-y-8">
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="border-4 border-dashed border-gray-100 rounded-[40px] p-16 text-center cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-all group shadow-inner"
              >
                <input type="file" ref={fileInputRef} hidden accept=".xlsx,.xls" onChange={e => setSelectedFile(e.target.files?.[0] || null)} />
                {selectedFile ? (
                  <div className="space-y-4">
                    <CheckCircle2 className="mx-auto text-green-500 animate-bounce" size={56} />
                    <p className="font-black text-gray-900 text-sm uppercase italic truncate px-4">{selectedFile.name}</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <Upload className="mx-auto text-gray-200 group-hover:text-green-500 transition-colors" size={56} />
                    <p className="font-black text-gray-400 text-xs uppercase tracking-widest">Selecionar Planilha Excel</p>
                  </div>
                )}
              </div>
              
              <div className="bg-amber-50 p-6 rounded-3xl border border-amber-100 flex items-start gap-4">
                <AlertTriangle className="text-amber-500 shrink-0 mt-1" size={24}/>
                <p className="text-[11px] font-bold text-amber-800 leading-relaxed uppercase">
                  O sistema recalculará PA, PU e Ticket Médio e sincronizará com as metas cadastradas.
                </p>
              </div>

              <button 
                disabled={!selectedFile || isProcessing} 
                onClick={handleProcessImport}
                className="w-full py-6 bg-red-600 text-white rounded-[32px] font-black uppercase text-sm shadow-2xl active:scale-95 disabled:opacity-50 transition-all flex items-center justify-center gap-4 border-b-8 border-red-800 hover:bg-red-700"
              >
                {isProcessing ? <Loader2 size={24} className="animate-spin" /> : <CheckCircle2 size={24}/>} EFETIVAR NO BANCO
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardAdmin;