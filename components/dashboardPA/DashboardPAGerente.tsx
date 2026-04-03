import React, { useState, useEffect, useRef } from 'react';
import { 
  Trophy, 
  TrendingUp, 
  Users, 
  Upload, 
  ChevronRight,
  ArrowUpRight,
  DollarSign,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Printer,
  Calendar,
  X,
  FileText,
  BarChart3
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { dashboardPAService } from '../../services/dashboardPAService';
import { supabase } from '../../services/supabaseClient';
import { PAWeek, PASale, PAParameters } from '../../types/pa';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import RelatorioPAImprimivel from './RelatorioPAImprimivel';
 
interface DashboardPAGerenteProps {
  user: any;
  store: any;
}
 
const parseLocalDate = (dateStr: string): Date => {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
};
 
const isDiaElegivel = (date: Date): boolean => {
  const d = date.getDate();
  const m = date.getMonth() + 1;
  const y = date.getFullYear();
  const dayOfWeek = date.getDay();
 
  const feriados = [
    '1-1', '21-4', '1-5', '7-9', '12-10', '2-11', '15-11', '25-12'
  ];
 
  if (feriados.includes(`${d}-${m}`)) return false;
  if (dayOfWeek === 6) return false;
  if (dayOfWeek >= 1 && dayOfWeek <= 5) return true;
 
  if (dayOfWeek === 0) {
    if (m === 6) {
      const saoJoao = new Date(y, 5, 24);
      const diff = saoJoao.getDay() === 0 ? 7 : saoJoao.getDay();
      const primeiroDomingoAntes = new Date(y, 5, 24 - diff);
      if (d === primeiroDomingoAntes.getDate()) return true;
    }
 
    if (m === 12) {
      const natal = new Date(y, 11, 25);
      const diff = natal.getDay() === 0 ? 7 : natal.getDay();
      const primeiroDomingoAntes = new Date(y, 11, 25 - diff);
      const segundoDomingoAntes = new Date(y, 11, 25 - diff - 7);
      if (d === primeiroDomingoAntes.getDate() || d === segundoDomingoAntes.getDate()) return true;
    }
  }
 
  return false;
};
 
const contarDiasElegiveis = (inicio: string, fim: string): number => {
  let count = 0;
  let d = parseLocalDate(inicio);
  const fimDate = parseLocalDate(fim);
  
  while (d <= fimDate) {
    if (isDiaElegivel(d)) {
      count++;
    }
    d.setDate(d.getDate() + 1);
  }
  return count;
};
 
const metaSemanaPorDias = (week: PAWeek, goal: { revenue_target: number; business_days: number } | null) => {
  if (!goal || goal.business_days === 0) return 0;
  const diasElegiveisSemana = contarDiasElegiveis(week.data_inicio, week.data_fim);
  return (goal.revenue_target / goal.business_days) * diasElegiveisSemana;
};
 
const DashboardPAGerente: React.FC<DashboardPAGerenteProps> = ({ user, store }) => {
  // 🆕 NOVO: Estado para controle de abas
  const [activeTab, setActiveTab] = useState<'dashboard' | 'relatorio'>('dashboard');
  
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [weeks, setWeeks] = useState<PAWeek[]>([]);
  const [selectedWeek, setSelectedWeek] = useState<string | null>(null);
  const [sales, setSales] = useState<PASale[]>([]);
  const [params, setParams] = useState<PAParameters | null>(null);
  const [monthlyGoal, setMonthlyGoal] = useState<{ revenue_target: number; business_days: number } | null>(null);
  const [weeksSalesCache, setWeeksSalesCache] = useState<Record<string, { total: number; pa: number; count: number }>>({});
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
 
  useEffect(() => {
    loadInitialData();
  }, [selectedMonth, selectedYear]);
 
  useEffect(() => {
    if (selectedWeek) {
      loadSales(selectedWeek);
    }
  }, [selectedWeek]);
 
  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };
 
  const loadInitialData = async () => {
    try {
      setLoading(true);
      const [paramsData, weeksData] = await Promise.all([
        dashboardPAService.getParameters(store.id),
        dashboardPAService.getWeeks(store.id, selectedYear, selectedMonth)
      ]);
      
      setParams(paramsData);
      setWeeks(weeksData);
 
      const { data: goalData } = await supabase
        .from('monthly_goals')
        .select('revenue_target, business_days')
        .eq('store_id', store.id)
        .eq('year', selectedYear)
        .eq('month', selectedMonth)
        .maybeSingle();
 
      setMonthlyGoal(goalData);
 
      const cache: Record<string, { total: number; pa: number; count: number }> = {};
      await Promise.all(weeksData.map(async (w) => {
        const weekSales = await dashboardPAService.getStoreSales(w.id, store.id);
        if (weekSales.length > 0) {
          const total = weekSales.reduce((acc, s) => acc + s.total_vendas, 0);
          const paSum = weekSales.reduce((acc, s) => acc + s.pa, 0);
          cache[w.id] = { total, pa: paSum / weekSales.length, count: weekSales.length };
        }
      }));
      setWeeksSalesCache(cache);
      
      if (weeksData.length > 0) {
        const activeWeek = weeksData.find(w => w.status === 'aberta') || weeksData[0];
        setSelectedWeek(activeWeek.id);
      } else {
        setSelectedWeek(null);
        setSales([]);
      }
    } catch (error) {
      console.error('Error loading initial data:', error);
    } finally {
      setLoading(false);
    }
  };
 
  const loadSales = async (weekId: string) => {
    try {
      const salesData = await dashboardPAService.getStoreSales(weekId, store.id);
      setSales(salesData);
    } catch (error) {
      console.error('Error loading sales:', error);
    }
  };
 
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedWeek) return;
 
    setImporting(true);
    try {
        const XLSX = await import('xlsx');
        const arrayBuffer = await file.arrayBuffer();
        const wb = XLSX.read(arrayBuffer, { type: 'array' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
 
        const rawData: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });
 
        const headerRowIndex = rawData.findIndex(row =>
          row.some(cell => String(cell || '').trim().toLowerCase() === 'vendedor')
        );
 
        if (headerRowIndex === -1) {
          throw new Error('Formato inválido: coluna "Vendedor" não encontrada no arquivo.');
        }
 
        const headers = rawData[headerRowIndex];
        const dataRows = rawData.slice(headerRowIndex + 1);
 
        const week = weeks.find(w => w.id === selectedWeek);
        if (week) {
          const titleRow = rawData.find(row => 
            row.some(cell => String(cell || '').toUpperCase().includes('PERÍODO'))
          );
          
          if (titleRow) {
            const titleText = titleRow.find(cell => String(cell || '').toUpperCase().includes('PERÍODO'));
            const dates = titleText.match(/(\d{2}\/\d{2}\/\d{4})/g);
            
            if (dates && dates.length >= 2) {
              const [d1, m1, y1] = dates[0].split('/');
              const [d2, m2, y2] = dates[1].split('/');
              const arquivoInicio = parseLocalDate(y1 + '-' + m1 + '-' + d1).toISOString().split('T')[0];
              const arquivoFim = parseLocalDate(y2 + '-' + m2 + '-' + d2).toISOString().split('T')[0];
              
              const dataFimSexta = week.data_fim;
              const dataFimSabado = new Date(parseLocalDate(week.data_fim).getTime() + 86400000).toISOString().split('T')[0];
 
              if (arquivoInicio !== week.data_inicio || (arquivoFim !== dataFimSexta && arquivoFim !== dataFimSabado)) {
                throw new Error(`As datas do arquivo (${dates[0]} a ${dates[1]}) não coincidem com a semana selecionada.`);
              }
            }
          }
        }
 
        const colIdx = (name: string) =>
          headers.findIndex((h: any) => String(h || '').trim().toLowerCase() === name.toLowerCase());
 
        const iVendedor   = colIdx('Vendedor');
        const iDias       = colIdx('Dias');
        const iVendas     = colIdx('Vendas');
        const iItens      = colIdx('Itens');
        const iPA         = colIdx('P.A.');
        const iTotalVenda = colIdx('Total Vendas');
 
        const mappedData = dataRows.map(row => {
          const vendedor = String(row[iVendedor] || '');
          const partes = vendedor.match(/^\d+-(\d+)\s+(.+)$/);
          return {
            cod_vendedor:     partes ? partes[1] : vendedor,
            nome_vendedor:    partes ? partes[2].trim() : vendedor,
            dias_trabalhados: Number(row[iDias]       || 0),
            qtde_vendas:      Number(row[iVendas]     || 0),
            perc_vendas:      '0%',
            qtde_itens:       Number(row[iItens]      || 0),
            perc_itens:       '0%',
            pa:               Number(row[iPA]         || 0),
            total_vendas:     Number(row[iTotalVenda] || 0),
            perc_total:       '0%'
          };
        }).filter(s =>
          s.nome_vendedor &&
          s.nome_vendedor.toUpperCase() !== 'TOTAL' &&
          !isNaN(s.pa) &&
          s.pa > 0
        );
 
        if (mappedData.length === 0) {
          throw new Error('Nenhum dado válido encontrado no arquivo.');
        }
 
        await dashboardPAService.importSales(selectedWeek, store.id, mappedData, user.email || user.name);
        await loadSales(selectedWeek);
        setShowImportModal(false);
        showToast('Importação concluída com sucesso!', 'success');
      } catch (error: any) {
        console.error('Error importing XLS:', error);
        showToast(error.message || 'Erro ao importar arquivo. Verifique o formato.', 'error');
      } finally {
        setImporting(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
  };
 
  const imprimirRecibos = async () => {
    const week = weeks.find(w => w.id === selectedWeek);
    if (!week) return;
 
    const premiados = sales.filter(s => s.atingiu_meta);
    if (premiados.length === 0) return;
 
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(gerarHTMLRecibos(premiados, week, store));
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 500);
 
    try {
      await dashboardPAService.marcarRecibosImpressos(week.id, user.name || user.email);
      showToast('Recibos impressos! Semana encerrada.', 'success');
      await loadInitialData();
    } catch (error) {
      showToast('Erro ao encerrar semana.', 'error');
    }
  };
 
  const gerarHTMLRecibos = (vendedores: PASale[], week: PAWeek, store: any): string => {
    const paginas: PASale[][] = [];
    for (let i = 0; i < vendedores.length; i += 3) {
      paginas.push(vendedores.slice(i, i + 3));
    }
 
    const dataPagamento = new Date(parseLocalDate(week.data_fim).getTime() + 86400000);
    
    return `
      <html>
        <head>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap');
            body { font-family: 'Inter', sans-serif; margin: 0; padding: 0; background: #fff; }
            .pagina { width: 210mm; height: 297mm; padding: 10mm; box-sizing: border-box; page-break-after: always; }
            .recibo { 
              width: 100%; 
              height: 85mm; 
              border: 2px solid #000; 
              margin-bottom: 5mm; 
              padding: 8mm; 
              box-sizing: border-box;
              display: flex;
              flex-direction: column;
              position: relative;
            }
            .header { display: flex; justify-between; align-items: flex-start; border-bottom: 2px solid #000; padding-bottom: 4mm; margin-bottom: 4mm; }
            .titulo { font-size: 24px; font-weight: 900; font-style: italic; text-transform: uppercase; letter-spacing: -1px; }
            .valor { font-size: 28px; font-weight: 900; font-style: italic; }
            .corpo { flex: 1; font-size: 14px; line-height: 1.4; }
            .linha { display: flex; gap: 20px; margin-bottom: 2mm; }
            .campo { display: flex; flex-direction: column; }
            .campo span { font-size: 10px; font-weight: 900; text-transform: uppercase; color: #666; font-style: italic; }
            .campo b { font-size: 16px; font-weight: 900; font-style: italic; text-transform: uppercase; }
            .declaracao {
              font-size: 9px;
              color: #555;
              font-style: italic;
              text-align: center;
              margin-bottom: 20mm;
            }
            .assinaturas {
              display: flex;
              gap: 10mm;
              width: 100%;
            }
            .ass {
              flex: 1;
              text-align: center;
              display: flex;
              flex-direction: column;
              align-items: center;
              gap: 3px;
            }
            .linha-ass {
              width: 100%;
              border-top: 1.5px solid #000;
              margin-bottom: 4px;
            }
            .ass span {
              font-size: 10px;
              font-weight: bold;
            }
            .ass small {
              font-size: 8px;
              color: #666;
              text-transform: uppercase;
              letter-spacing: 0.5px;
            }
            @media print { body { background: none; } .pagina { margin: 0; border: none; } }
          </style>
        </head>
        <body>
          ${paginas.map(pagina => `
            <div class="pagina">
              ${pagina.map(vendedor => `
                <div class="recibo">
                  <div class="header" style="display: flex; justify-content: space-between; align-items: center;">
                    <div class="titulo">Recibo de Premiação P.A.</div>
                    <div class="valor">R$ ${vendedor.valor_premio?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                  </div>
                  
                  <div class="corpo">
                    <div class="linha">
                      <div class="campo"><span>Vendedor</span><b>${vendedor.nome_vendedor}</b></div>
                      <div class="campo"><span>Loja</span><b>${store.name}</b></div>
                    </div>
                    <div class="linha">
                      <div class="campo"><span>Período de Vendas</span><b>${format(parseLocalDate(week.data_inicio), 'dd/MM/yyyy')} a ${format(parseLocalDate(week.data_fim), 'dd/MM/yyyy')}</b></div>
                      <div class="campo"><span>Data de Pagamento</span><b>${format(dataPagamento, 'dd/MM/yyyy')}</b></div>
                    </div>
                    <div class="linha">
                      <div class="campo"><span>P.A. Atingido</span><b>${vendedor.pa.toFixed(2)}</b></div>
                      <div class="campo"><span>Meta Base</span><b>${vendedor.pa_meta?.toFixed(2)}</b></div>
                    </div>
                    <div class="declaracao">
                      Declaro que recebi o valor acima referente à premiação por P.A. atingido no período indicado.
                      <br>
                      ${format(dataPagamento, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                    </div>
 
                    <div class="assinaturas">
                      <div class="ass">
                        <div class="linha-ass"></div>
                        <span>${vendedor.nome_vendedor}</span>
                        <small>Vendedor(a)</small>
                      </div>
                      <div class="ass">
                        <div class="linha-ass"></div>
                        <span>${store.manager_name || 'Gerente'}</span>
                        <small>Gerente</small>
                      </div>
                    </div>
                  </div>
                </div>
              `).join('')}
            </div>
          `).join('')}
        </body>
      </html>
    `;
  };
 
  const totalStoreSales = sales.reduce((acc, curr) => acc + curr.total_vendas, 0);
  const totalAwards = sales.reduce((acc, curr) => acc + (curr.valor_premio || 0), 0);
  const avgPA = sales.length > 0 ? sales.reduce((acc, curr) => acc + curr.pa, 0) / sales.length : 0;
 
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50 dark:bg-slate-950">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full"
        />
      </div>
    );
  }
 
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 md:p-8 space-y-8">
      {/* Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`fixed top-8 left-1/2 -translate-x-1/2 z-[100] px-8 py-4 rounded-[24px] font-black italic uppercase tracking-tighter text-sm shadow-2xl ${
              toast.type === 'success' ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'
            }`}
          >
            {toast.message}
          </motion.div>
        )}
      </AnimatePresence>
 
      {/* Header Section */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-3 text-orange-500">
            <Trophy className="w-8 h-8" />
            <span className="font-black italic uppercase tracking-tighter text-xl">{store.name}</span>
          </div>
          <h1 className="text-4xl md:text-6xl font-black italic uppercase tracking-tighter text-slate-900 dark:text-white leading-none">
            Performance <span className="text-orange-500">P.A.</span>
          </h1>
          <p className="text-slate-500 dark:text-slate-400 font-medium uppercase tracking-widest text-xs italic">
            Acompanhamento Semanal de Vendedores
          </p>
        </div>
 
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2 bg-white dark:bg-slate-900 p-2 rounded-[24px] border border-slate-100 dark:border-slate-800 shadow-sm">
            <select 
              value={selectedMonth} 
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              className="bg-transparent border-none px-4 py-2 font-black italic uppercase tracking-tighter text-xs outline-none"
            >
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i + 1} value={i + 1}>
                  {format(new Date(2024, i, 1), 'MMMM', { locale: ptBR })}
                </option>
              ))}
            </select>
            <select 
              value={selectedYear} 
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="bg-transparent border-none px-4 py-2 font-black italic uppercase tracking-tighter text-xs outline-none"
            >
              {[2024, 2025, 2026].map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
 
          <select 
            value={selectedWeek || ''} 
            onChange={(e) => setSelectedWeek(e.target.value)}
            className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[24px] px-6 py-4 font-black italic uppercase tracking-tighter text-sm outline-none focus:border-orange-500 transition-all shadow-sm"
          >
            {weeks.length === 0 && <option value="">Nenhuma semana encontrada</option>}
            {weeks.map(w => {
              const dataPagamento = new Date(parseLocalDate(w.data_fim).getTime() + 86400000);
              return (
                <option key={w.id} value={w.id}>
                  {format(parseLocalDate(w.data_inicio), 'dd/MM', { locale: ptBR })} a {format(parseLocalDate(w.data_fim), 'dd/MM', { locale: ptBR })} — Pagamento: {format(dataPagamento, 'dd/MM', { locale: ptBR })} ({w.status})
                </option>
              );
            })}
          </select>
          
          {(() => {
            const week = weeks.find(w => w.id === selectedWeek);
            const podeImprimir = week && (week.status === 'aberta' || week.status === 'importada');
            const jaImprimiu = week?.status === 'recibos_impressos';
            const premiados = sales.filter(s => s.atingiu_meta);
 
            if (jaImprimiu) return (
              <div className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 rounded-[20px] font-black italic uppercase tracking-tighter text-[10px] text-slate-400">
                <CheckCircle2 className="w-4 h-4" />
                <span>Recibos impressos — contate o admin para reimprimir</span>
              </div>
            );
 
            if (!podeImprimir || premiados.length === 0) return null;
 
            return (
              <button
                onClick={imprimirRecibos}
                className="flex items-center gap-2 px-6 py-3 bg-emerald-500 text-white rounded-[20px] font-black italic uppercase tracking-tighter text-xs shadow-lg shadow-emerald-500/20 hover:bg-emerald-600 transition-all"
              >
                <Printer className="w-4 h-4" />
                <span>Imprimir Recibos ({premiados.length})</span>
              </button>
            );
          })()}
          
          <button 
            onClick={() => setShowImportModal(true)}
            disabled={!selectedWeek}
            className="flex items-center gap-3 px-8 py-4 bg-orange-500 text-white rounded-[24px] font-black italic uppercase tracking-tighter text-sm shadow-lg shadow-orange-500/20 hover:bg-orange-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Upload className="w-5 h-5" />
            <span>Importar XLS</span>
          </button>
        </div>
      </header>
 
      {/* 🆕 NAVEGAÇÃO COM ABAS */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-2">
        <div className="flex gap-2 overflow-x-auto">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-black uppercase text-xs transition-all whitespace-nowrap ${
              activeTab === 'dashboard'
                ? 'bg-gradient-to-r from-orange-600 to-red-600 text-white shadow-lg'
                : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
            }`}
          >
            <BarChart3 size={16} />
            Dashboard
          </button>
 
          <button
            onClick={() => setActiveTab('relatorio')}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-black uppercase text-xs transition-all whitespace-nowrap ${
              activeTab === 'relatorio'
                ? 'bg-gradient-to-r from-green-600 to-emerald-600 text-white shadow-lg'
                : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
            }`}
          >
            <FileText size={16} />
            Relatório p/ Mural
          </button>
        </div>
      </div>
 
      {/* 🔄 CONTEÚDO DAS ABAS */}
      {activeTab === 'dashboard' && (
        <div className="space-y-8">
          {/* Active Week Info */}
          {selectedWeek && weeks.find(w => w.id === selectedWeek) && (
            <motion.div 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-orange-500 rounded-[32px] p-8 text-white shadow-xl shadow-orange-500/20"
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                  <div className="p-4 bg-white/20 rounded-[24px] backdrop-blur-sm">
                    <Calendar className="w-8 h-8" />
                  </div>
                  <div>
                    <p className="text-orange-100 font-black italic uppercase tracking-tighter text-xs">Semana Ativa</p>
                    <h2 className="text-2xl font-black italic uppercase tracking-tighter">
                      {format(parseLocalDate(weeks.find(w => w.id === selectedWeek)!.data_inicio), 'dd/MM/yyyy')} a {format(parseLocalDate(weeks.find(w => w.id === selectedWeek)!.data_fim), 'dd/MM/yyyy')}
                    </h2>
                    <p className="text-orange-100 font-black italic uppercase tracking-tighter text-[10px] mt-1">
                      Pagamento (Sábado): {format(new Date(parseLocalDate(weeks.find(w => w.id === selectedWeek)!.data_fim).getTime() + 86400000), 'dd/MM/yyyy')}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3 bg-white/10 px-6 py-3 rounded-[20px] backdrop-blur-sm">
                  <div className={`w-3 h-3 rounded-full ${
                    weeks.find(w => w.id === selectedWeek)?.status === 'aberta' ? 'bg-emerald-400 animate-pulse' : 
                    weeks.find(w => w.id === selectedWeek)?.status === 'recibos_impressos' ? 'bg-blue-400' :
                    'bg-white/40'
                  }`} />
                  <span className="font-black italic uppercase tracking-tighter text-sm">
                    Status: {weeks.find(w => w.id === selectedWeek)?.status === 'recibos_impressos' ? 'RECIBOS IMPRESSOS' : weeks.find(w => w.id === selectedWeek)?.status.toUpperCase()}
                  </span>
                </div>
              </div>
            </motion.div>
          )}
 
          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {(() => {
              const currentWeek = weeks.find(w => w.id === selectedWeek);
              const metaVendasSemana = currentWeek ? metaSemanaPorDias(currentWeek, monthlyGoal) : 0;
              const metaPA = params?.pa_inicial || 0;
              
              const vendasPercent = metaVendasSemana > 0 ? Math.min((totalStoreSales / metaVendasSemana) * 100, 150) : 0;
              const paPercent = metaPA > 0 ? Math.min((avgPA / metaPA) * 100, 150) : 0;
 
              return [
                { 
                  label: 'Vendas da Semana', 
                  value: `R$ ${totalStoreSales.toLocaleString()}`, 
                  target: metaVendasSemana > 0 ? `Meta: R$ ${metaVendasSemana.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : 'Sem meta definida',
                  percent: vendasPercent,
                  icon: TrendingUp, 
                  color: 'orange' 
                },
                { 
                  label: 'P.A. Médio', 
                  value: avgPA.toFixed(2), 
                  target: metaPA > 0 ? `Meta: ${metaPA.toFixed(2)}` : 'Sem meta definida',
                  percent: paPercent,
                  icon: Trophy, 
                  color: 'blue' 
                },
                { 
                  label: 'Premiação Total', 
                  value: `R$ ${totalAwards.toLocaleString()}`, 
                  icon: DollarSign, 
                  color: 'emerald' 
                }
              ].map((stat, i) => (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                  key={stat.label}
                  className="bg-white dark:bg-slate-900 p-8 rounded-[40px] border border-slate-100 dark:border-slate-800 shadow-sm"
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className={`p-4 rounded-[24px] bg-${stat.color}-500/10 text-${stat.color}-500`}>
                      <stat.icon className="w-6 h-6" />
                    </div>
                    {stat.percent !== undefined && (
                      <div className={`px-4 py-2 rounded-full font-black italic uppercase tracking-tighter text-[10px] ${
                        stat.percent >= 100 ? 'bg-emerald-500/10 text-emerald-500' : 'bg-orange-500/10 text-orange-500'
                      }`}>
                        {stat.percent.toFixed(0)}%
                      </div>
                    )}
                  </div>
                  <div className="space-y-1">
                    <p className="text-slate-400 font-black italic uppercase tracking-tighter text-xs">{stat.label}</p>
                    <p className="text-3xl font-black italic uppercase tracking-tighter text-slate-900 dark:text-white">
                      {stat.value}
                    </p>
                    {stat.target && (
                      <div className="mt-4 space-y-2">
                        <p className="text-[10px] text-slate-400 font-black italic uppercase tracking-tighter">{stat.target}</p>
                        <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${stat.percent}%` }}
                            className={`h-full rounded-full ${stat.percent >= 100 ? 'bg-emerald-500' : 'bg-orange-500'}`}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              ));
            })()}
          </div>
 
          {/* Weeks Summary */}
          <div className="space-y-6">
            <h2 className="text-2xl font-black italic uppercase tracking-tighter text-slate-900 dark:text-white">
              Resumo das <span className="text-orange-500">Semanas</span>
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {weeks.map((w, i) => {
                const cache = weeksSalesCache[w.id];
                const metaVendas = metaSemanaPorDias(w, monthlyGoal);
                const percentVendas = metaVendas > 0 ? Math.min(((cache?.total || 0) / metaVendas) * 100, 150) : 0;
                const metaPA = params?.pa_inicial || 0;
                const percentPA = metaPA > 0 ? Math.min(((cache?.pa || 0) / metaPA) * 100, 150) : 0;
                const isSelected = selectedWeek === w.id;
 
                return (
                  <motion.button
                    key={w.id}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.05 }}
                    onClick={() => setSelectedWeek(w.id)}
                    className={`p-6 rounded-[32px] border text-left transition-all ${
                      isSelected 
                        ? 'bg-orange-500 border-orange-500 text-white shadow-lg shadow-orange-500/20' 
                        : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 hover:border-orange-200 dark:hover:border-orange-900/30'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div className={`p-2 rounded-xl ${isSelected ? 'bg-white/20' : 'bg-slate-100 dark:bg-slate-800'}`}>
                        <Calendar className={`w-4 h-4 ${isSelected ? 'text-white' : 'text-slate-400'}`} />
                      </div>
                      <div className={`w-2 h-2 rounded-full ${
                        w.status === 'aberta' ? 'bg-emerald-400 animate-pulse' : 
                        w.status === 'recibos_impressos' ? 'bg-blue-400' :
                        'bg-slate-300'
                      }`} />
                    </div>
                    
                    <p className={`text-[10px] font-black italic uppercase tracking-tighter mb-1 ${isSelected ? 'text-orange-100' : 'text-slate-400'}`}>
                      {format(parseLocalDate(w.data_inicio), 'dd/MM')} a {format(parseLocalDate(w.data_fim), 'dd/MM')}
                    </p>
                    
                    <div className="space-y-3">
                      <div>
                        <div className="flex justify-between text-[10px] font-black italic uppercase tracking-tighter mb-1">
                          <span className={isSelected ? 'text-orange-100' : 'text-slate-400'}>Vendas</span>
                          <span>{percentVendas.toFixed(0)}%</span>
                        </div>
                        <div className={`h-1 w-full rounded-full overflow-hidden ${isSelected ? 'bg-white/20' : 'bg-slate-100 dark:bg-slate-800'}`}>
                          <div 
                            className={`h-full rounded-full ${isSelected ? 'bg-white' : 'bg-orange-500'}`}
                            style={{ width: `${percentVendas}%` }}
                          />
                        </div>
                      </div>
 
                      <div>
                        <div className="flex justify-between text-[10px] font-black italic uppercase tracking-tighter mb-1">
                          <span className={isSelected ? 'text-orange-100' : 'text-slate-400'}>P.A.</span>
                          <span>{percentPA.toFixed(0)}%</span>
                        </div>
                        <div className={`h-1 w-full rounded-full overflow-hidden ${isSelected ? 'bg-white/20' : 'bg-slate-100 dark:bg-slate-800'}`}>
                          <div 
                            className={`h-full rounded-full ${isSelected ? 'bg-white' : 'bg-blue-500'}`}
                            style={{ width: `${percentPA}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </motion.button>
                );
              })}
            </div>
          </div>
 
          {/* Sellers Table */}
          <div className="space-y-6">
            <h2 className="text-2xl font-black italic uppercase tracking-tighter text-slate-900 dark:text-white">
              Performance dos <span className="text-orange-500">Vendedores</span>
            </h2>
 
            <div className="bg-white dark:bg-slate-900 rounded-[48px] border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
              {/* Mobile: cards */}
              <div className="md:hidden space-y-3 p-4">
                {sales.map((row, i) => (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    key={row.id}
                    className="bg-slate-50 dark:bg-slate-800/50 rounded-[24px] p-4 space-y-2"
                  >
                    <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-700 pb-2">
                      <span className="font-black italic uppercase tracking-tighter text-slate-900 dark:text-white">{row.nome_vendedor}</span>
                      <span className="px-3 py-1 rounded-full bg-orange-500/10 text-orange-500 font-black italic uppercase tracking-tighter text-[10px]">
                        PA: {row.pa.toFixed(2)}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-[10px]">
                      <div>
                        <p className="text-slate-400 font-black italic uppercase tracking-tighter">Vendas</p>
                        <p className="text-slate-900 dark:text-white font-black italic uppercase tracking-tighter">R$ {row.total_vendas.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-slate-400 font-black italic uppercase tracking-tighter">Itens</p>
                        <p className="text-slate-900 dark:text-white font-black italic uppercase tracking-tighter">{row.qtde_itens}</p>
                      </div>
                      <div>
                        <p className="text-slate-400 font-black italic uppercase tracking-tighter">Prêmio</p>
                        <p className="text-emerald-500 font-black italic uppercase tracking-tighter">R$ {row.valor_premio?.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '-'}</p>
                      </div>
                      <div>
                        <p className="text-slate-400 font-black italic uppercase tracking-tighter">Status</p>
                        <p className={`${row.atingiu_meta ? 'text-emerald-500' : 'text-red-500'} font-black italic uppercase tracking-tighter`}>
                          {row.atingiu_meta ? 'Premiado' : 'Não Atingiu'}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
 
              {/* Desktop: table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-bottom border-slate-50 dark:border-slate-800/50">
                      <th className="p-6 font-black italic uppercase tracking-tighter text-xs text-slate-400">Vendedor</th>
                      <th className="p-6 font-black italic uppercase tracking-tighter text-xs text-slate-400">Total Vendas</th>
                      <th className="p-6 font-black italic uppercase tracking-tighter text-xs text-slate-400 text-center">P.A.</th>
                      <th className="p-6 font-black italic uppercase tracking-tighter text-xs text-slate-400 text-center">Itens</th>
                      <th className="p-6 font-black italic uppercase tracking-tighter text-xs text-slate-400 text-center">Status</th>
                      <th className="p-6 font-black italic uppercase tracking-tighter text-xs text-slate-400 text-right">Prêmio</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sales.map((row, i) => (
                      <motion.tr 
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.05 }}
                        key={row.id} 
                        className="group hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all"
                      >
                        <td className="p-6">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-[16px] bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 font-black italic uppercase tracking-tighter text-xs">
                              {row.nome_vendedor.substring(0, 2)}
                            </div>
                            <div className="flex flex-col">
                              <span className="font-black italic uppercase tracking-tighter text-slate-900 dark:text-white leading-none">{row.nome_vendedor}</span>
                              <span className="text-[10px] text-slate-400 font-bold uppercase italic tracking-tighter">COD: {row.cod_vendedor}</span>
                            </div>
                          </div>
                        </td>
                        <td className="p-6 font-black italic uppercase tracking-tighter text-slate-900 dark:text-white">
                          R$ {row.total_vendas.toLocaleString()}
                        </td>
                        <td className="p-6 text-center">
                          <span className={`px-4 py-1 rounded-full font-black italic uppercase tracking-tighter text-xs ${
                            row.pa >= (params?.pa_inicial || 0) 
                              ? 'bg-emerald-500/10 text-emerald-500' 
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                          }`}>
                            {row.pa.toFixed(2)}
                          </span>
                        </td>
                        <td className="p-6 text-center font-black italic uppercase tracking-tighter text-slate-900 dark:text-white">
                          {row.qtde_itens}
                        </td>
                        <td className="p-6 text-center">
                          {row.atingiu_meta ? (
                            <div className="flex flex-col items-center justify-center text-emerald-500">
                              <div className="flex items-center gap-2">
                                <CheckCircle2 className="w-4 h-4" />
                                <span className="font-black italic uppercase tracking-tighter text-[10px]">PREMIADO</span>
                              </div>
                              {row.faixas_acima && row.faixas_acima > 0 ? (
                                <span className="text-[8px] font-bold uppercase italic tracking-tighter">+{row.faixas_acima} faixas</span>
                              ) : null}
                            </div>
                          ) : (
                            <div className="flex items-center justify-center gap-2 text-slate-400">
                              <AlertCircle className="w-4 h-4" />
                              <span className="font-black italic uppercase tracking-tighter text-[10px]">NÃO ATINGIU</span>
                            </div>
                          )}
                        </td>
                        <td className="p-6 text-right font-black italic uppercase tracking-tighter text-emerald-500">
                          {row.atingiu_meta 
                            ? `R$ ${row.valor_premio?.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` 
                            : '-'}
                        </td>
                      </motion.tr>
                    ))}
                    {sales.length === 0 && (
                      <tr>
                        <td colSpan={6} className="p-20 text-center">
                          <div className="flex flex-col items-center gap-4 opacity-20">
                            <FileSpreadsheet className="w-16 h-16" />
                            <p className="font-black italic uppercase tracking-tighter">Nenhum dado importado para esta semana.</p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
 
      {/* 🆕 ABA RELATÓRIO */}
      {activeTab === 'relatorio' && (
        <RelatorioPAImprimivel 
          storeId={store.id}
          storeName={store.name}
          storeNumber={store.number}
        />
      )}
 
      {/* Import Modal */}
      <AnimatePresence>
        {showImportModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowImportModal(false)}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-xl bg-white dark:bg-slate-900 rounded-[32px] md:rounded-[48px] p-6 md:p-12 shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto"
            >
              <button 
                onClick={() => setShowImportModal(false)}
                className="absolute top-8 right-8 p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-all"
              >
                <X className="w-6 h-6" />
              </button>
 
              <div className="space-y-8">
                <div className="space-y-2">
                  <h3 className="text-3xl font-black italic uppercase tracking-tighter text-slate-900 dark:text-white leading-none">
                    Importar <span className="text-orange-500">Relatório XLS</span>
                  </h3>
                  <p className="text-slate-500 dark:text-slate-400 font-black italic uppercase tracking-tighter text-xs">
                    Selecione o arquivo exportado do sistema de vendas.
                  </p>
                </div>
 
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="border-4 border-dashed border-slate-100 dark:border-slate-800 rounded-[40px] p-12 flex flex-col items-center gap-4 cursor-pointer hover:border-orange-500/50 hover:bg-orange-500/5 transition-all group"
                >
                  <div className="p-6 rounded-[32px] bg-orange-500/10 text-orange-500 group-hover:scale-110 transition-all">
                    <Upload className="w-10 h-10" />
                  </div>
                  <div className="text-center">
                    <p className="font-black italic uppercase tracking-tighter text-slate-900 dark:text-white">Clique para selecionar</p>
                    <p className="text-slate-400 font-black italic uppercase tracking-tighter text-[10px]">Formatos aceitos: .xls, .xlsx</p>
                  </div>
                  <input 
                    ref={fileInputRef}
                    type="file" 
                    accept=".xls,.xlsx"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </div>
 
                <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-[32px] space-y-3">
                  <p className="font-black italic uppercase tracking-tighter text-[10px] text-slate-400">Instruções de Formato:</p>
                  <ul className="space-y-1">
                    {['Código', 'Vendedor', 'Qtde Vendas', 'PA', 'Total'].map(col => (
                      <li key={col} className="flex items-center gap-2 text-xs font-black italic uppercase tracking-tighter text-slate-600 dark:text-slate-300">
                        <div className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                        <span>Coluna: {col}</span>
                      </li>
                    ))}
                  </ul>
                </div>
 
                {importing && (
                  <div className="flex items-center justify-center gap-3 text-orange-500 font-black italic uppercase tracking-tighter">
                    <motion.div 
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                      className="w-5 h-5 border-2 border-orange-500 border-t-transparent rounded-full"
                    />
                    <span>Processando arquivo...</span>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
 
export default DashboardPAGerente;