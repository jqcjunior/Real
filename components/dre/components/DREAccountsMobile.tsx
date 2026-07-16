import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Menu,
  X,
  Search,
  Plus,
  Upload,
  ChevronDown,
  ChevronRight,
  MoreVertical,
  Moon,
  Sun,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Loader2,
  FileSpreadsheet,
  AlertCircle,
  FileDown,
  Settings,
  BarChart3,
  GitCompare,
  Circle,
  Maximize2,
  Minimize2,
  Info
} from 'lucide-react';
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

import { useDREAccounts, type DREAccount } from '../hooks/useDREAccounts';
import { useDREAccountsImport } from '../hooks/useDREAccountsImport';
import { DREImportModal } from './Dreimportmodal';
import { importDREToSupabase } from '../utils/importDREToSupabase';

// ============================================================================
// TIPOS
// ============================================================================

interface AccountWithChildren extends DREAccount {
  children?: AccountWithChildren[];
}

type FilterType = 'all' | 'receita' | 'despesa' | 'resultado' | 'active' | 'inactive';

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const DREAccountsMobile: React.FC = () => {
  const { 
    accounts, 
    allAccounts,
    loading, 
    error: fetchError, 
    searchTerm,
    setSearchTerm,
    filterType,
    setFilterType,
    expandedCodes,
    toggleExpand,
    expandAll,
    collapseAll,
    refresh 
  } = useDREAccounts();

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

  // UI States
  const [darkMode, setDarkMode] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [statsExpanded, setStatsExpanded] = useState(false);

  // ✅ CONTROLE DE SCROLL (OBRIGATÓRIO)
  useEffect(() => {
    if (importModalOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'auto';
    }

    return () => {
      document.body.style.overflow = 'auto';
    };
  }, [importModalOpen]);

  // =========================================================================
  // TREE BUILDING
  // =========================================================================

  const accountTree = React.useMemo(() => {
    const tree: AccountWithChildren[] = [];
    const map = new Map<string, AccountWithChildren>();

    accounts.forEach(acc => {
      map.set(acc.code, { ...acc, children: [] });
    });

    accounts.forEach(acc => {
      const node = map.get(acc.code);
      if (!node) return;

      if (acc.parent_code && map.has(acc.parent_code)) {
        const parent = map.get(acc.parent_code);
        if (parent) {
          parent.children = parent.children || [];
          parent.children.push(node);
        }
      } else {
        tree.push(node);
      }
    });

    return tree;
  }, [accounts]);

  // =========================================================================
  // HANDLERS
  // =========================================================================

  const handleRefresh = async () => {
    await refresh();
    toast({ 
      title: 'Atualizado', 
      description: `${allAccounts.length} contas carregadas` 
    });
  };

  const handleImportClick = async () => {
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
        description: `${importPreview.length} contas importadas com sucesso.`
      });
      setImportModalOpen(false);
      resetImport();
      refresh();
    } else {
      toast({
        title: 'Erro na Importação',
        description: result.error || 'Ocorreu um erro ao importar',
        variant: 'destructive'
      });
    }
  };

  // =========================================================================
  // HELPERS
  // =========================================================================

  const getTypeInfo = (type: string) => {
    switch (type) {
      case 'RECEITA':
        return {
          icon: TrendingUp,
          color: 'text-green-600',
          bg: 'bg-green-50',
          label: 'Receita'
        };
      case 'DESPESA':
        return {
          icon: TrendingDown,
          color: 'text-red-600',
          bg: 'bg-red-50',
          label: 'Despesa'
        };
      case 'RESULTADO':
        return {
          icon: BarChart3,
          color: 'text-blue-600',
          bg: 'bg-blue-50',
          label: 'Resultado'
        };
      default:
        return {
          icon: Circle,
          color: 'text-gray-600',
          bg: 'bg-gray-50',
          label: 'Outro'
        };
    }
  };

  // =========================================================================
  // RENDER CARD
  // =========================================================================

  const renderAccountCard = (account: AccountWithChildren, depth = 0) => {
    const hasChildren = account.children && account.children.length > 0;
    const isExpanded = expandedCodes.has(account.code);
    const typeInfo = getTypeInfo(account.type);
    const TypeIcon = typeInfo.icon;

    return (
      <div key={account.code} className="mb-2 w-full">
        <div style={{ paddingLeft: `${depth * 8}px` }}>
          <Card
            className={`border-l-4 w-full max-w-full ${
              account.type === 'RECEITA'
                ? 'border-l-green-500'
                : account.type === 'DESPESA'
                ? 'border-l-red-500'
                : 'border-l-blue-500'
            }`}
          >
            <CardContent className="p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    {hasChildren && (
                      <button
                        onClick={() => toggleExpand(account.code)}
                        className="p-0.5 hover:bg-gray-100 rounded transition-colors flex-shrink-0"
                      >
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4 text-gray-600" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-gray-600" />
                        )}
                      </button>
                    )}

                    <span className="text-xs font-mono font-semibold text-gray-700 flex-shrink-0">
                      {account.code}
                    </span>

                    {account.is_active ? (
                      <CheckCircle2 className="w-3 h-3 text-green-600 flex-shrink-0" />
                    ) : (
                      <XCircle className="w-3 h-3 text-gray-400 flex-shrink-0" />
                    )}
                  </div>

                  <h4 className="text-sm font-medium text-gray-900 mb-2 line-clamp-2 break-words">
                    {account.name}
                  </h4>

                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge
                      variant="outline"
                      className={`${typeInfo.bg} ${typeInfo.color} border-0 text-xs flex-shrink-0`}
                    >
                      <TypeIcon className="w-3 h-3 mr-1" />
                      {typeInfo.label}
                    </Badge>

                    <Badge variant="secondary" className="text-xs flex-shrink-0">
                      Nível {account.level}
                    </Badge>

                    {!account.is_active && (
                      <Badge variant="destructive" className="text-xs flex-shrink-0">
                        Inativa
                      </Badge>
                    )}

                    {hasChildren && (
                      <Badge variant="outline" className="text-xs flex-shrink-0">
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
                    <DropdownMenuItem
                      onClick={() => toast({ title: `Editar ${account.name}` })}
                    >
                      <Settings className="w-4 h-4 mr-2" />
                      Editar
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() =>
                        toast({
                          title: account.is_active ? 'Inativando...' : 'Ativando...'
                        })
                      }
                    >
                      {account.is_active ? (
                        <XCircle className="w-4 h-4 mr-2" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4 mr-2" />
                      )}
                      {account.is_active ? 'Inativar' : 'Ativar'}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </CardContent>
          </Card>
        </div>

        <AnimatePresence initial={false}>
          {hasChildren && isExpanded && account.children && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ 
                height: 'auto', 
                opacity: 1,
                transition: {
                  height: { duration: 0.3, ease: [0.4, 0, 0.2, 1] },
                  opacity: { duration: 0.2, ease: 'easeInOut' }
                }
              }}
              exit={{ 
                height: 0, 
                opacity: 0,
                transition: {
                  height: { duration: 0.25, ease: [0.4, 0, 0.2, 1] },
                  opacity: { duration: 0.15, ease: 'easeInOut' }
                }
              }}
              className="overflow-hidden w-full"
            >
              <div className="mt-2 space-y-2">
                {account.children.map(child => renderAccountCard(child, depth + 1))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  // =========================================================================
  // RENDER LOADING
  // =========================================================================

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

  // =========================================================================
  // RENDER MAIN
  // =========================================================================

  return (
    <div className={`min-h-screen ${darkMode ? 'dark bg-gray-900' : 'bg-gray-50'}`}>
      {/* HEADER */}
      <header className="sticky top-0 z-40 bg-white border-b shadow-sm">
        {/* Linha 1: Título + Dark Mode */}
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div>
              <h1 className="text-lg font-black uppercase italic tracking-tighter text-gray-900">
                Contas DRE
              </h1>
              <p className="text-[10px] uppercase font-black tracking-widest text-gray-500">
                Sistema Real Calçados
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

        {/* Linha 2: Busca */}
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

        {/* ✅ TOOLBAR DE AÇÕES (SUBSTITUI O MENU LATERAL) */}
        <div className="px-4 pb-3 border-t border-gray-100 pt-3">
          <div className="grid grid-cols-4 gap-2">
            {/* Importar */}
            <button
              onClick={() => setImportModalOpen(true)}
              className="flex flex-col items-center gap-1.5 p-3 hover:bg-blue-50 rounded-xl transition-all group border border-transparent hover:border-blue-100"
            >
              <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                <Upload className="w-5 h-5 text-blue-600" />
              </div>
              <span className="text-[9px] font-black uppercase tracking-widest text-gray-600">
                Importar
              </span>
            </button>

            {/* Expandir Todas */}
            <button
              onClick={expandAll}
              className="flex flex-col items-center gap-1.5 p-3 hover:bg-gray-50 rounded-xl transition-all group"
            >
              <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                <Maximize2 className="w-5 h-5 text-gray-600" />
              </div>
              <span className="text-[9px] font-black uppercase tracking-widest text-gray-600">
                Expandir
              </span>
            </button>

            {/* Recolher Todas */}
            <button
              onClick={collapseAll}
              className="flex flex-col items-center gap-1.5 p-3 hover:bg-gray-50 rounded-xl transition-all group"
            >
              <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                <Minimize2 className="w-5 h-5 text-gray-600" />
              </div>
              <span className="text-[9px] font-black uppercase tracking-widest text-gray-600">
                Recolher
              </span>
            </button>

            {/* Estatísticas */}
            <button
              onClick={() => setStatsExpanded(!statsExpanded)}
              className="flex flex-col items-center gap-1.5 p-3 hover:bg-purple-50 rounded-xl transition-all group border border-transparent hover:border-purple-100"
            >
              <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                <Info className="w-5 h-5 text-purple-600" />
              </div>
              <span className="text-[9px] font-black uppercase tracking-widest text-gray-600">
                Info
              </span>
            </button>
          </div>
        </div>

        {/* ✅ CARD DE ESTATÍSTICAS EXPANSÍVEL */}
        <AnimatePresence>
          {statsExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
              className="overflow-hidden border-t border-gray-100"
            >
              <div className="p-4 bg-gradient-to-br from-gray-50 to-white">
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
            </motion.div>
          )}
        </AnimatePresence>

        {/* Linha 3: Filtros */}
        <div className="px-4 pb-3">
          <ScrollArea className="w-full whitespace-nowrap">
            <div className="flex gap-2 pb-2">
              <Badge
                variant={filterType === 'ALL' ? 'default' : 'outline'}
                className="cursor-pointer px-4 py-1.5 rounded-full uppercase text-[10px] font-black tracking-widest"
                onClick={() => setFilterType('ALL')}
              >
                Todas ({allAccounts.length})
              </Badge>
              <Badge
                variant={filterType === 'RECEITA' ? 'default' : 'outline'}
                className="cursor-pointer px-4 py-1.5 rounded-full uppercase text-[10px] font-black tracking-widest bg-green-50 border-green-100 text-green-700"
                onClick={() => setFilterType('RECEITA')}
              >
                Receitas
              </Badge>
              <Badge
                variant={filterType === 'DESPESA' ? 'default' : 'outline'}
                className="cursor-pointer px-4 py-1.5 rounded-full uppercase text-[10px] font-black tracking-widest bg-red-50 border-red-100 text-red-700"
                onClick={() => setFilterType('DESPESA')}
              >
                Despesas
              </Badge>
            </div>
          </ScrollArea>
        </div>
      </header>

      {/* CONTENT */}
      <div className="p-4 pb-24 overflow-x-hidden">
        {accounts.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="p-12 text-center">
              <Search className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-black uppercase italic tracking-tighter mb-2">
                Sem resultados
              </h3>
              <p className="text-xs text-gray-500 mb-6">
                Nenhuma conta corresponde aos seus filtros.
              </p>
              <Button
                variant="outline"
                onClick={() => {
                  setSearchTerm('');
                  setFilterType('ALL');
                }}
                className="uppercase text-[10px] font-black tracking-widest rounded-xl"
              >
                Limpar Filtros
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2 max-w-full">
            {accountTree.map(acc => renderAccountCard(acc))}
          </div>
        )}
      </div>

      {/* FAB */}
      <button
        className="fixed bottom-20 right-4 w-14 h-14 bg-blue-600 text-white rounded-full shadow-2xl hover:scale-105 active:scale-95 transition-all flex items-center justify-center z-40 border-4 border-white"
        onClick={() => fileInputRef.current?.click()}
      >
        <Plus className="w-6 h-6" />
      </button>

      {/* DRE Import Responsive Modal */}
      <DREImportModal
        isOpen={importModalOpen}
        onClose={() => {
          if (!importing) {
            setImportModalOpen(false);
            resetImport();
          }
        }}
        onConfirm={handleImportClick}
        preview={importPreview}
        mesReferencia={mesReferencia}
        importing={importing}
        progress={importProgress}
        statusMessage={statusMessage}
        errors={importErrors}
        stats={importStats}
      />


      {/* BOTTOM NAV */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-6 py-2 flex justify-around items-center z-50 shadow-[0_-4px_20px_-10px_rgba(0,0,0,0.1)]">
        <Button variant="ghost" className="flex-col gap-1 h-auto py-2 text-blue-600">
          <Circle className="w-5 h-5 fill-current" />
          <span className="text-[9px] font-black uppercase tracking-widest italic">
            Início
          </span>
        </Button>
        <Button
          variant="ghost"
          className="flex-col gap-1 h-auto py-2 text-gray-400"
          onClick={() => toast({ title: 'Gráficos coming soon' })}
        >
          <BarChart3 className="w-5 h-5" />
          <span className="text-[9px] font-black uppercase tracking-widest">Analytics</span>
        </Button>
        <Button
          variant="ghost"
          className="flex-col gap-1 h-auto py-2 text-gray-400"
          onClick={() => setStatsExpanded(!statsExpanded)}
        >
          <MoreVertical className="w-5 h-5" />
          <span className="text-[9px] font-black uppercase tracking-widest">Mais</span>
        </Button>
      </nav>
    </div>
  );
};

export default DREAccountsMobile;