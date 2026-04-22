import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { Search } from 'lucide-react';
import {
  Menu,
  X,
  Plus,
  Filter,
  Download,
  BarChart3,
  GitCompare,
  Settings,
  HelpCircle,
  ChevronDown,
  ChevronRight,
  MoreVertical,
  Upload,
  Moon,
  Sun,
  TrendingUp,
  TrendingDown,
  Circle,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Loader2,
  FileSpreadsheet,
  AlertTriangle,
  Check,
  Info,
  FileDown,
  AlertCircle,
  Maximize2,
  Minimize2,
  Zap
} from 'lucide-react';
import { supabase } from '@/services/supabaseClient';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useDREAccountsImport } from '../hooks/useDREAccountsImport';
import { useDREAccounts } from '../hooks/useDREAccounts';
import { DREImportModal } from './Dreimportmodal';
import { importDREToSupabase } from '../utils/importDREToSupabase';
import { DREAnalyticsComponent } from './DREAnalyticsComponent';
import { DREMaisComponent } from './DREMaisComponent';
import { DREGraficosComponent } from './DREGraficosComponent';
import { DRETabelaComparativaComponent } from './DRETabelaComparativaComponent';
import { DRERelatoriosComponent } from './DRERelatoriosComponent';

// ============================================================================
// TYPES
// ============================================================================

interface AccountDRE {
  id?: string;
  code: string;
  name: string;
  type: 'RECEITA' | 'DESPESA' | 'RESULTADO';
  level: number;
  parent_code?: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

interface ImportError {
  row: number;
  field: string;
  error: string;
}

type FilterType = 'all' | 'receita' | 'despesa' | 'resultado' | 'active' | 'inactive';
type ViewMode = 'tree' | 'flat' | 'grouped';

// ============================================================================
// PULL TO REFRESH COMPONENT
// ============================================================================

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: React.ReactNode;
}

const PullToRefresh: React.FC<PullToRefreshProps> = ({ onRefresh, children }) => {
  const [pulling, setPulling] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const startY = useRef(0);
  const currentY = useRef(0);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (window.scrollY === 0) {
      startY.current = e.touches[0].clientY;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (startY.current === 0 || window.scrollY > 0) return;

    currentY.current = e.touches[0].clientY;
    const distance = currentY.current - startY.current;

    if (distance > 0) {
      setPulling(true);
      setPullDistance(Math.min(distance, 100));
    }
  };

  const handleTouchEnd = async () => {
    if (pullDistance > 60 && !refreshing) {
      setRefreshing(true);
      try {
        await onRefresh();
      } finally {
        setRefreshing(false);
      }
    }
    
    setPulling(false);
    setPullDistance(0);
    startY.current = 0;
    currentY.current = 0;
  };

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className="relative"
    >
      {/* Pull indicator */}
      {(pulling || refreshing) && (
        <div
          className="absolute top-0 left-0 right-0 flex items-center justify-center transition-all"
          style={{ height: `${Math.min(pullDistance, 60)}px` }}
        >
          {refreshing ? (
            <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
          ) : (
            <RefreshCw
              className="w-5 h-5 text-blue-600 transition-transform"
              style={{ transform: `rotate(${pullDistance * 3}deg)` }}
            />
          )}
        </div>
      )}

      <div
        className="transition-transform"
        style={{
          transform: `translateY(${pulling || refreshing ? '60px' : '0'})`,
        }}
      >
        {children}
      </div>
    </div>
  );
};

// ============================================================================
// MAIN COMPONENT - DREAccountsMobileEnhanced
// ============================================================================

export const DREAccountsMobileEnhanced: React.FC = () => {
  const { accounts, loading, error: fetchError, refresh } = useDREAccounts();
  const { 
    importPreview, 
    importing, 
    importProgress, 
    statusMessage, 
    importStats, 
    importErrors, 
    mesReferencia,
    fileInputRef, 
    handleFileSelect, 
    resetImport,
    setImporting,
    setImportProgress,
    setStatusMessage
  } = useDREAccountsImport();
  
  const { toast } = useToast();

  // Primary States
  const [activeTab, setActiveTab] = useState<'contas' | 'analytics' | 'graficos' | 'comparativo' | 'relatorios' | 'mais'>('contas');
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('tree');
  const [expandedCodes, setExpandedCodes] = useState<Set<string>>(new Set());
  const [darkMode, setDarkMode] = useState(false);
  const [statsExpanded, setStatsExpanded] = useState(false);

  // Import UI State
  const [importModalOpen, setImportModalOpen] = useState(false);

  // Debounce search effect
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Open modal when import data is ready
  useEffect(() => {
    if ((importPreview.length > 0 || importErrors.length > 0) && !importing && !importModalOpen) {
      setImportModalOpen(true);
    }
  }, [importPreview, importErrors, importing, importModalOpen]);

  // Combined logic for filtering and searching
  const filteredAccounts = useMemo(() => {
    let filtered = accounts;

    if (filterType === 'receita') {
      filtered = filtered.filter(acc => acc.type === 'RECEITA');
    } else if (filterType === 'despesa') {
      filtered = filtered.filter(acc => acc.type === 'DESPESA');
    } else if (filterType === 'resultado') {
      filtered = filtered.filter(acc => acc.type === 'RESULTADO');
    } else if (filterType === 'active') {
      filtered = filtered.filter(acc => acc.is_active);
    } else if (filterType === 'inactive') {
      filtered = filtered.filter(acc => !acc.is_active);
    }

    if (debouncedSearch.trim()) {
      const term = debouncedSearch.toLowerCase();
      filtered = filtered.filter(
        acc =>
          acc.code.toLowerCase().includes(term) ||
          acc.name.toLowerCase().includes(term)
      );
    }

    return filtered;
  }, [accounts, filterType, debouncedSearch]);

  // Hierarchical view logic
  const accountTree = useMemo(() => {
    const tree: (AccountDRE & { children: any[] })[] = [];
    const map = new Map<string, AccountDRE & { children: any[] }>();

    filteredAccounts.forEach(acc => {
      map.set(acc.code, { ...acc, children: [] });
    });

    filteredAccounts.forEach(acc => {
      const node = map.get(acc.code);
      if (!node) return;

      if (acc.parent_code && map.has(acc.parent_code)) {
        map.get(acc.parent_code)!.children.push(node);
      } else {
        tree.push(node);
      }
    });

    return tree;
  }, [filteredAccounts]);

  const toggleExpand = (code: string) => {
    setExpandedCodes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(code)) newSet.delete(code);
      else newSet.add(code);
      return newSet;
    });
  };

  const expandAll = () => setExpandedCodes(new Set(accounts.map(a => a.code)));
  const collapseAll = () => setExpandedCodes(new Set());

  const getTypeInfo = (type: string) => {
    switch (type) {
      case 'RECEITA': return { icon: TrendingUp, color: 'text-green-600', bg: 'bg-green-50', label: 'Receita' };
      case 'DESPESA': return { icon: TrendingDown, color: 'text-red-600', bg: 'bg-red-50', label: 'Despesa' };
      case 'RESULTADO': return { icon: BarChart3, color: 'text-blue-600', bg: 'bg-blue-50', label: 'Resultado' };
      default: return { icon: Circle, color: 'text-gray-600', bg: 'bg-gray-50', label: 'Outro' };
    }
  };

  const handleRefresh = async () => {
    await refresh();
    toast({ title: 'Atualizado', description: `${accounts.length} contas carregadas` });
  };

  // ============================================================================
  // IMPORT ACTIONS
  // ============================================================================

  const handleConfirmImport = async () => {
    if (importPreview.length === 0 || importErrors.length > 0) return;

    setImporting(true);
    const result = await importDREToSupabase(
      importPreview,
      (progress, message) => {
        setImportProgress(progress);
        setStatusMessage(message);
      }
    );

    setImporting(false);

    if (result.success) {
      toast({ 
        title: 'Sucesso!', 
        description: `${importPreview.length} registros (loja/conta) importados para dre_data.` 
      });
      setImportModalOpen(false);
      resetImport();
      refresh();
    } else {
      toast({ 
        title: 'Erro na Importação', 
        description: result.error || 'Ocorreu um erro ao salvar os dados no banco.', 
        variant: 'destructive' 
      });
    }
  };

  const downloadTemplate = () => {
    const data = [
      ['DRE - Março/2025'], // Row 0
      ['Código', 'Descrição', 'Loja 5', 'Loja 26', 'Loja 31'], // Row 1
      ['1', 'RECEITA BRUTA', 150000, 180000, 120000],
      ['1.1', '(-) IMPOSTOS', -15000, -18000, -12000],
      ['1.2', 'RECEITA LÍQUIDA', 135000, 162000, 108000],
      ['2', 'CUSTO DE MERCADORIAS', -70000, -85000, -60000],
      ['3', 'LUCRO BRUTO', 65000, 77000, 48000],
      ['4', 'DESPESAS OPERACIONAIS', -30000, -35000, -25000],
      ['5', 'RESULTADO LÍQUIDO', 35000, 42000, 23000]
    ];
    
    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Modelo DRE");
    XLSX.writeFile(wb, "Modelo_Importacao_DRE.xlsx");
  };

  // ============================================================================
  // UI RENDERERS
  // ============================================================================

  const renderUnifiedHeader = () => (
    <header className="sticky top-0 z-40 bg-white border-b shadow-sm">
      {/* Linha 1: Título + Dark Mode */}
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-lg font-black uppercase italic tracking-tighter text-gray-900">
              {activeTab === 'analytics' ? 'DRE Analytics' : 
               activeTab === 'graficos' ? 'DRE Gráficos' :
               activeTab === 'comparativo' ? 'DRE Comparativo' :
               activeTab === 'relatorios' ? 'DRE Relatórios' :
               activeTab === 'mais' ? 'DRE Inteligência' : 'Contas DRE'}
            </h1>
            <p className="text-[10px] uppercase font-black tracking-widest text-gray-500">
              {activeTab === 'analytics' ? 'Desempenho Consolidado' : 
               activeTab === 'graficos' ? 'Visualização de Dados' :
               activeTab === 'comparativo' ? 'Análise entre Lojas' :
               activeTab === 'relatorios' ? 'Exportação e Impressão' :
               activeTab === 'mais' ? 'Insights & IA' : 'Sistema Real Calçados'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setDarkMode(!darkMode)}
            className="hover:bg-gray-100"
          >
            {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </Button>
        </div>
      </div>

      {/* Linha 2: Busca (Apenas na aba de Contas) */}
      {activeTab === 'contas' && (
        <div className="px-4 pb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              type="text"
              placeholder="Buscar por código ou nome..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-10 h-10 rounded-xl bg-gray-50 border-gray-100"
            />
          </div>
        </div>
      )}

      {/* ✅ TOOLBAR UNIFICADA (7 BOTÕES) */}
      <div className="px-4 pb-4 border-t border-gray-100 pt-3">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          
          {/* GRUPO 1: AÇÕES (ESQUERDA NO DESKTOP, GRID NO MOBILE) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 lg:flex lg:flex-nowrap">
            {/* Importar */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex flex-col lg:flex-row items-center justify-center gap-1.5 p-2 lg:px-4 lg:py-2 hover:bg-blue-50 rounded-xl transition-all group border border-transparent hover:border-blue-100 min-h-[56px] lg:min-h-0"
            >
              <div className="w-8 h-8 lg:w-6 lg:h-6 bg-blue-100 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform shrink-0">
                <Upload className="w-4 h-4 text-blue-600" />
              </div>
              <span className="text-[8px] lg:text-[10px] font-black uppercase tracking-widest text-gray-600">
                Importar
              </span>
            </button>

            {/* Expandir Todas */}
            <button
              onClick={expandAll}
              className="flex flex-col lg:flex-row items-center justify-center gap-1.5 p-2 lg:px-4 lg:py-2 hover:bg-gray-50 rounded-xl transition-all group min-h-[56px] lg:min-h-0"
            >
              <div className="w-8 h-8 lg:w-6 lg:h-6 bg-gray-100 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform shrink-0">
                <Maximize2 className="w-4 h-4 text-gray-600" />
              </div>
              <span className="text-[8px] lg:text-[10px] font-black uppercase tracking-widest text-gray-600">
                Expandir
              </span>
            </button>

            {/* Recolher Todas */}
            <button
              onClick={collapseAll}
              className="flex flex-col lg:flex-row items-center justify-center gap-1.5 p-2 lg:px-4 lg:py-2 hover:bg-gray-50 rounded-xl transition-all group min-h-[56px] lg:min-h-0"
            >
              <div className="w-8 h-8 lg:w-6 lg:h-6 bg-gray-100 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform shrink-0">
                <Minimize2 className="w-4 h-4 text-gray-600" />
              </div>
              <span className="text-[8px] lg:text-[10px] font-black uppercase tracking-widest text-gray-600">
                Recolher
              </span>
            </button>

            {/* Estatísticas / Info */}
            <button
              onClick={() => setStatsExpanded(!statsExpanded)}
              className={`flex flex-col lg:flex-row items-center justify-center gap-1.5 p-2 lg:px-4 lg:py-2 rounded-xl transition-all group border border-transparent min-h-[56px] lg:min-h-0 ${statsExpanded ? 'bg-purple-50 border-purple-100' : 'hover:bg-purple-50 hover:border-purple-100'}`}
            >
              <div className={`w-8 h-8 lg:w-6 lg:h-6 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform shrink-0 ${statsExpanded ? 'bg-purple-200' : 'bg-purple-100'}`}>
                <Info className={`w-4 h-4 ${statsExpanded ? 'text-purple-700' : 'text-purple-600'}`} />
              </div>
              <span className="text-[8px] lg:text-[10px] font-black uppercase tracking-widest text-gray-600">
                Info
              </span>
            </button>
          </div>

          {/* DIVIDER MOBILE */}
          <div className="h-px bg-gray-100 lg:hidden" />

          {/* GRUPO 2: NAVEGAÇÃO (DIREITA NO DESKTOP, GRID NO MOBILE) */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 lg:flex lg:flex-nowrap w-full">
            {/* Início (Contas) */}
            <button
              onClick={() => setActiveTab('contas')}
              className={`flex flex-col lg:flex-row items-center justify-center gap-1.5 p-2 lg:px-4 lg:py-2 rounded-xl transition-all group border border-transparent min-h-[56px] lg:min-h-0 ${activeTab === 'contas' ? 'bg-indigo-50 border-indigo-100' : 'hover:bg-indigo-50 hover:border-indigo-100'}`}
            >
              <div className={`w-8 h-8 lg:w-6 lg:h-6 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform shrink-0 ${activeTab === 'contas' ? 'bg-indigo-600' : 'bg-indigo-100'}`}>
                <Circle className={`w-4 h-4 ${activeTab === 'contas' ? 'text-white fill-current' : 'text-indigo-600'}`} />
              </div>
              <span className={`text-[8px] lg:text-[10px] font-black uppercase tracking-widest italic ${activeTab === 'contas' ? 'text-indigo-700' : 'text-gray-600'}`}>
                Início
              </span>
            </button>

            {/* Analytics */}
            <button
              onClick={() => setActiveTab('analytics')}
              className={`flex flex-col lg:flex-row items-center justify-center gap-1.5 p-2 lg:px-4 lg:py-2 rounded-xl transition-all group border border-transparent min-h-[56px] lg:min-h-0 ${activeTab === 'analytics' ? 'bg-blue-50 border-blue-100' : 'hover:bg-blue-50 hover:border-blue-100'}`}
            >
              <div className={`w-8 h-8 lg:w-6 lg:h-6 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform shrink-0 ${activeTab === 'analytics' ? 'bg-blue-600' : 'bg-blue-100'}`}>
                <BarChart3 className={`w-4 h-4 ${activeTab === 'analytics' ? 'text-white fill-current' : 'text-blue-600'}`} />
              </div>
              <span className={`text-[8px] lg:text-[10px] font-black uppercase tracking-widest italic ${activeTab === 'analytics' ? 'text-blue-700' : 'text-gray-600'}`}>
                Resumo
              </span>
            </button>

            {/* Gráficos */}
            <button
              onClick={() => setActiveTab('graficos')}
              className={`flex flex-col lg:flex-row items-center justify-center gap-1.5 p-2 lg:px-4 lg:py-2 rounded-xl transition-all group border border-transparent min-h-[56px] lg:min-h-0 ${activeTab === 'graficos' ? 'bg-green-50 border-green-100' : 'hover:bg-green-50 hover:border-green-100'}`}
            >
              <div className={`w-8 h-8 lg:w-6 lg:h-6 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform shrink-0 ${activeTab === 'graficos' ? 'bg-green-600' : 'bg-green-100'}`}>
                <TrendingUp className={`w-4 h-4 ${activeTab === 'graficos' ? 'text-white' : 'text-green-600'}`} />
              </div>
              <span className={`text-[8px] lg:text-[10px] font-black uppercase tracking-widest italic ${activeTab === 'graficos' ? 'text-green-700' : 'text-gray-600'}`}>
                Gráficos
              </span>
            </button>

            {/* Comparativo */}
            <button
              onClick={() => setActiveTab('comparativo')}
              className={`flex flex-col lg:flex-row items-center justify-center gap-1.5 p-2 lg:px-4 lg:py-2 rounded-xl transition-all group border border-transparent min-h-[56px] lg:min-h-0 ${activeTab === 'comparativo' ? 'bg-amber-50 border-amber-100' : 'hover:bg-amber-50 hover:border-amber-100'}`}
            >
              <div className={`w-8 h-8 lg:w-6 lg:h-6 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform shrink-0 ${activeTab === 'comparativo' ? 'bg-amber-600' : 'bg-amber-100'}`}>
                <Filter className={`w-4 h-4 ${activeTab === 'comparativo' ? 'text-white' : 'text-amber-600'}`} />
              </div>
              <span className={`text-[8px] lg:text-[10px] font-black uppercase tracking-widest italic ${activeTab === 'comparativo' ? 'text-amber-700' : 'text-gray-600'}`}>
                Compara
              </span>
            </button>

            {/* Relatórios */}
            <button
              onClick={() => setActiveTab('relatorios')}
              className={`flex flex-col lg:flex-row items-center justify-center gap-1.5 p-2 lg:px-4 lg:py-2 rounded-xl transition-all group border border-transparent min-h-[56px] lg:min-h-0 ${activeTab === 'relatorios' ? 'bg-red-50 border-red-100' : 'hover:bg-red-50 hover:border-red-100'}`}
            >
              <div className={`w-8 h-8 lg:w-6 lg:h-6 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform shrink-0 ${activeTab === 'relatorios' ? 'bg-red-600' : 'bg-red-100'}`}>
                <FileSpreadsheet className={`w-4 h-4 ${activeTab === 'relatorios' ? 'text-white' : 'text-red-600'}`} />
              </div>
              <span className={`text-[8px] lg:text-[10px] font-black uppercase tracking-widest italic ${activeTab === 'relatorios' ? 'text-red-700' : 'text-gray-600'}`}>
                PDF/Print
              </span>
            </button>

            {/* Mais (Extender Menu) */}
            <button
              onClick={() => setActiveTab('mais')}
              className={`flex flex-col lg:flex-row items-center justify-center gap-1.5 p-2 lg:px-4 lg:py-2 rounded-xl transition-all group border border-transparent min-h-[56px] lg:min-h-0 ${activeTab === 'mais' ? 'bg-purple-50 border-purple-100' : 'hover:bg-purple-50 hover:border-purple-100'}`}
            >
              <div className={`w-8 h-8 lg:w-6 lg:h-6 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform shrink-0 ${activeTab === 'mais' ? 'bg-purple-600' : 'bg-gray-100'}`}>
                <Zap className={`w-4 h-4 ${activeTab === 'mais' ? 'text-white' : 'text-gray-600'}`} />
              </div>
              <span className={`text-[8px] lg:text-[10px] font-black uppercase tracking-widest ${activeTab === 'mais' ? 'text-purple-700' : 'text-gray-600'}`}>
                Insights
              </span>
            </button>
          </div>

        </div>
      </div>

      {/* ✅ CARD DE ESTATÍSTICAS EXPANSÍVEL */}
      {statsExpanded && (
        <div className="border-t border-gray-100 p-4 bg-gradient-to-br from-gray-50 to-white">
          <div className="grid grid-cols-2 gap-3">
            <div className="p-4 bg-white border border-gray-100 rounded-2xl shadow-sm">
              <p className="text-[9px] font-black uppercase text-gray-400 tracking-widest mb-1">
                Total de Contas
              </p>
              <p className="text-3xl font-black text-gray-900 italic font-mono">
                {accounts.length}
              </p>
            </div>
            <div className="p-4 bg-white border border-gray-100 rounded-2xl shadow-sm">
              <p className="text-[9px] font-black uppercase text-blue-600 tracking-widest mb-1">
                Ativas
              </p>
              <p className="text-3xl font-black text-blue-600 italic font-mono">
                {accounts.filter(a => a.is_active).length}
              </p>
            </div>
            <div className="p-4 bg-green-50 border border-green-100 rounded-2xl">
              <p className="text-[9px] font-black uppercase text-green-600 tracking-widest mb-1">
                Receitas
              </p>
              <p className="text-2xl font-black text-green-700 italic font-mono">
                {accounts.filter(a => a.type === 'RECEITA').length}
              </p>
            </div>
            <div className="p-4 bg-red-50 border border-red-100 rounded-2xl">
              <p className="text-[9px] font-black uppercase text-red-600 tracking-widest mb-1">
                Despesas
              </p>
              <p className="text-2xl font-black text-red-700 italic font-mono">
                {accounts.filter(a => a.type === 'DESPESA').length}
              </p>
            </div>
          </div>
        </div>
      )}
    </header>
  );

  const renderAccountCard = (account: AccountDRE & { children?: AccountDRE[] }, depth = 0) => {
    const hasChildren = account.children && account.children.length > 0;
    const isExpanded = expandedCodes.has(account.code);
    const typeInfo = getTypeInfo(account.type);
    const TypeIcon = typeInfo.icon;

    return (
      <div key={account.code} className="mb-2">
        <Card
          className={`border-l-4 ${
            account.type === 'RECEITA'
              ? 'border-l-green-500'
              : account.type === 'DESPESA'
              ? 'border-l-red-500'
              : 'border-l-blue-500'
          }`}
          style={{ marginLeft: `${depth * 12}px` }}
        >
          <CardContent className="p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  {hasChildren && (
                    <button
                      onClick={() => toggleExpand(account.code)}
                      className="p-0.5 hover:bg-gray-100 rounded transition-colors"
                    >
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4 text-gray-600" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-gray-600" />
                      )}
                    </button>
                  )}
                  
                  <span className="text-xs font-mono font-semibold text-gray-700">
                    {account.code}
                  </span>

                  {account.is_active ? (
                    <CheckCircle2 className="w-3 h-3 text-green-600" />
                  ) : (
                    <XCircle className="w-3 h-3 text-gray-400" />
                  )}
                </div>

                <h4 className="text-sm font-medium text-gray-900 mb-2 line-clamp-2">
                  {account.name}
                </h4>

                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge variant="outline" className={`${typeInfo.bg} ${typeInfo.color} border-0 text-xs`}>
                    <TypeIcon className="w-3 h-3 mr-1" />
                    {typeInfo.label}
                  </Badge>

                  <Badge variant="secondary" className="text-xs">
                    Nivel {account.level}
                  </Badge>

                  {!account.is_active && (
                    <Badge variant="destructive" className="text-xs">
                      Inativa
                    </Badge>
                  )}

                  {hasChildren && (
                    <Badge variant="outline" className="text-xs">
                      {account.children!.length} subcontas
                    </Badge>
                  )}
                </div>
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                      <MoreVertical className="w-4 h-4" />
                    </Button>
                  }
                />
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => toast({ title: `Editar ${account.name}` })}>
                    <Settings className="w-4 h-4 mr-2" />
                    Editar
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => toast({ title: account.is_active ? 'Inativando...' : 'Ativando...' })}>
                    {account.is_active ? <XCircle className="w-4 h-4 mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                    {account.is_active ? 'Bloquear/Liberar' : 'Ativar'}
                  </DropdownMenuItem>
                  {hasChildren && (
                    <DropdownMenuItem onClick={() => toggleExpand(account.code)}>
                      {isExpanded ? 'Recolher' : 'Expandir'} Subcontas
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </CardContent>
        </Card>

        {hasChildren && isExpanded && account.children && (
          <div className="mt-2">
            {account.children.map(child => renderAccountCard(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="space-y-3">
          {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
            <Card key={i}>
              <CardContent className="p-3">
                <Skeleton className="h-4 w-24 mb-2" />
                <Skeleton className="h-5 w-full mb-2" />
                <div className="flex gap-2">
                  <Skeleton className="h-6 w-20" />
                  <Skeleton className="h-6 w-16" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (activeTab !== 'contas') {
    return (
      <div className={`min-h-screen ${darkMode ? 'dark bg-gray-900' : 'bg-gray-50'}`}>
        {renderUnifiedHeader()}
        <div className="pb-10 p-4">
          {activeTab === 'analytics' && <DREAnalyticsComponent />}
          {activeTab === 'graficos' && <DREGraficosComponent />}
          {activeTab === 'comparativo' && <DRETabelaComparativaComponent />}
          {activeTab === 'relatorios' && <DRERelatoriosComponent />}
          {activeTab === 'mais' && <DREMaisComponent />}
        </div>
      </div>
    );
  }

  return (
    <PullToRefresh onRefresh={handleRefresh}>
      <div className={`min-h-screen ${darkMode ? 'dark bg-gray-900' : 'bg-gray-50'}`}>
        {renderUnifiedHeader()}

        {/* Content Area */}
        <div className="pb-10">
          {/* Filtros (Apenas na aba de Contas) */}
          <div className="px-4 py-3 bg-white/50 backdrop-blur-sm border-b border-gray-100 sticky top-[var(--header-height)] z-30">
            <ScrollArea className="w-full whitespace-nowrap">
              <div className="flex gap-2 pb-2">
                <Badge
                  variant={filterType === 'all' ? 'default' : 'outline'}
                  className="cursor-pointer px-4 py-1.5 rounded-full uppercase text-[10px] font-black tracking-widest"
                  onClick={() => setFilterType('all')}
                >
                  Todas ({accounts.length})
                </Badge>
                <Badge
                  variant={filterType === 'receita' ? 'default' : 'outline'}
                  className="cursor-pointer px-4 py-1.5 rounded-full uppercase text-[10px] font-black tracking-widest bg-green-50 border-green-100 text-green-700"
                  onClick={() => setFilterType('receita')}
                >
                  Receitas
                </Badge>
                <Badge
                  variant={filterType === 'despesa' ? 'default' : 'outline'}
                  className="cursor-pointer px-4 py-1.5 rounded-full uppercase text-[10px] font-black tracking-widest bg-red-50 border-red-100 text-red-700"
                  onClick={() => setFilterType('despesa')}
                >
                  Despesas
                </Badge>
                <Badge
                  variant={filterType === 'active' ? 'default' : 'outline'}
                  className="cursor-pointer px-4 py-1.5 rounded-full uppercase text-[10px] font-black tracking-widest"
                  onClick={() => setFilterType('active')}
                >
                  Ativas
                </Badge>
              </div>
            </ScrollArea>
          </div>

          {/* List Content */}
          <div className="p-4">
            {filteredAccounts.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="p-12 text-center">
                  <Search className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-black uppercase italic tracking-tighter mb-2">Sem resultados</h3>
                  <p className="text-xs text-gray-500 mb-6">Nenhuma conta corresponde aos seus filtros.</p>
                  <Button variant="outline" onClick={() => { setSearchTerm(''); setFilterType('all'); }} className="uppercase text-[10px] font-black tracking-widest rounded-xl">
                    Limpar Filtros
                  </Button>
                </CardContent>
              </Card>
            ) : viewMode === 'tree' ? (
              <div className="space-y-1">{accountTree.map(acc => renderAccountCard(acc))}</div>
            ) : (
              <div className="space-y-1">{filteredAccounts.map(acc => renderAccountCard(acc))}</div>
            )}
          </div>
        </div>

        {/* FAB */}
        <button
          className="fixed bottom-6 right-6 w-14 h-14 bg-blue-600 text-white rounded-full shadow-2xl hover:scale-105 active:scale-95 transition-all flex items-center justify-center z-40 border-4 border-white"
          onClick={() => fileInputRef.current?.click()}
        >
          <Plus className="w-6 h-6" />
        </button>

        {/* Hidden file input for import */}
        <input 
          type="file" 
          ref={fileInputRef} 
          className="hidden" 
          accept=".xlsx,.xls,.csv" 
          onChange={handleFileSelect}
        />

        {/* DRE Import Responsive Modal */}
        <DREImportModal
          isOpen={importModalOpen}
          onClose={() => {
            if (!importing) {
              setImportModalOpen(false);
              resetImport();
            }
          }}
          onConfirm={handleConfirmImport}
          preview={importPreview}
          mesReferencia={mesReferencia}
          importing={importing}
          progress={importProgress}
          statusMessage={statusMessage}
          errors={importErrors}
          stats={importStats}
        />
      </div>
    </PullToRefresh>
  );
};

export default DREAccountsMobileEnhanced;