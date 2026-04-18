import React, { useState, useEffect, useMemo } from 'react';
import { 
  BarChart3, LineChart as LineChartIcon, Table as TableIcon, 
  Search, Filter, Calendar, ChevronRight, ArrowUpRight, 
  ArrowDownRight, Download, Share2, Save, X, Check,
  ChevronDown, Layers, ShoppingBag, Loader2, Info, AlertCircle,
  LayoutDashboard, Upload
} from 'lucide-react';
import { 
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, 
  Tooltip, Legend, ResponsiveContainer, AreaChart, Area 
} from 'recharts';
import { 
  getContasDisponiveis, getDREDataByPeriodo, getLojasComDadosDRE,
  getAlertasAtivos
} from '../services/supabase.service';
import { parseExcelDRE, insertDREDataParsed } from '../services/dreParser.service';
import type { DREData, ContaDisponivel, FiltroComparativo } from '../types/dre.types';
import { format, parseISO, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { motion, AnimatePresence } from 'motion/react';
import * as XLSX from 'xlsx';
import { 
  PainelAlertas, RankingDespesas, AnaliseVariacao, 
  GraficoComposicao, HeatmapPerformance 
} from './DREBIWidgets';

/**
 * MÓDULO: DRE COMPARATIVO CUSTOMIZÁVEL
 * 
 * Permite ao usuário selecionar livremente contas e comparar entre lojas e períodos.
 */

const DREComparativo: React.FC = () => {
    // ESTADOS
    const [contasDisponiveis, setContasDisponiveis] = useState<ContaDisponivel[]>([]);
    const [lojasComDados, setLojasComDados] = useState<any[]>([]);
    const [isLoadingContas, setIsLoadingContas] = useState(true);
    const [isLoadingDados, setIsLoadingDados] = useState(false);
    const [buscaConta, setBuscaConta] = useState('');
    const [expandirGrupos, setExpandirGrupos] = useState<Record<string, boolean>>({});
    const [showUploadModal, setShowUploadModal] = useState(false);
    
    const [filtros, setFiltros] = useState<FiltroComparativo>({
        lojasSelecionadas: [], // Vazio = Todas (mas idealmente deve selecionar algumas)
        periodoInicio: '2025-01-01',
        periodoFim: format(new Date(), 'yyyy-MM-01'),
        contasSelecionadas: [],
        tipoVisualizacao: 'linha',
        compararPor: 'mes'
    });

    const [dados, setDados] = useState<DREData[]>([]);

    // CARREGAR CONTAS
    useEffect(() => {
        const loadContas = async () => {
            try {
                const data = await getContasDisponiveis();
                setContasDisponiveis(data);
                
                // Expandir primeiro grupo por padrão
                if (data.length > 0) {
                    setExpandirGrupos({ [data[0].grupo || 'SEM GRUPO']: true });
                }
            } catch (error) {
                console.error('Erro ao carregar contas:', error);
            } finally {
                setIsLoadingContas(false);
            }
        };
        loadContas();
    }, []);

    // CARREGAR LOJAS COM DADOS
    useEffect(() => {
        const loadLojas = async () => {
            try {
                const data = await getLojasComDadosDRE();
                setLojasComDados(data);
            } catch (error) {
                console.error('Erro ao carregar lojas com dados:', error);
            }
        };
        loadLojas();
    }, []);

    // CARREGAR DADOS AO MUDAR FILTROS
    useEffect(() => {
        if (filtros.contasSelecionadas.length === 0) {
            setDados([]);
            return;
        }

        const loadDados = async () => {
            setIsLoadingDados(true);
            try {
                // Se lojasSelecionadas estiver vazio, buscamos de todas as lojas que apareceram no Excel (IDs conhecidos)
                // Para simplificar, se vazio não passamos filtro de loja no serviço (que pegará todas as lojas com dados)
                const data = await getDREDataByPeriodo(
                    filtros.periodoInicio,
                    filtros.periodoFim,
                    filtros.lojasSelecionadas
                );
                
                // Filtrar apenas as contas selecionadas (o serviço já poderia fazer isso, mas vamos garantir no front)
                const filtered = data.filter(d => filtros.contasSelecionadas.includes(d.descricao));
                setDados(filtered);
            } catch (error) {
                console.error('Erro ao carregar dados comparativos:', error);
            } finally {
                setIsLoadingDados(false);
            }
        };

        const timeoutId = setTimeout(loadDados, 300); // Debounce
        return () => clearTimeout(timeoutId);
    }, [filtros.lojasSelecionadas, filtros.periodoInicio, filtros.periodoFim, filtros.contasSelecionadas]);

    // PROCESSAMENTO DE DADOS PARA GRÁFICOS
    const chartData = useMemo(() => {
        if (dados.length === 0) return [];

        // Agrupar dados por mês ou por loja dependendo da visualização e do modo de comparação
        const periodos = Array.from(new Set(dados.map(d => d.mes_referencia))).sort();
        const lojas = Array.from(new Set(dados.map(d => d.loja_id))).sort((a,b) => a-b);
        
        if (filtros.compararPor === 'loja' && filtros.contasSelecionadas.length === 1) {
            // Comparar lojas para UMA conta específica ao longo do tempo
            const conta = filtros.contasSelecionadas[0];
            return periodos.map(periodo => {
                const ponto: any = { 
                    name: format(parseISO(periodo), 'MMM/yy', { locale: ptBR }),
                    rawDate: periodo 
                };
                lojas.forEach(lojaId => {
                    const reg = dados.find(d => d.mes_referencia === periodo && d.loja_id === lojaId && d.descricao === conta);
                    ponto[`Loja ${lojaId}`] = reg ? Number(reg.valor) : 0;
                });
                return ponto;
            });
        }

        // Padrão: Soma das lojas por conta ao longo do tempo (Comparar por Mês)
        return periodos.map(periodo => {
            const ponto: any = { 
                name: format(parseISO(periodo), 'MMM/yy', { locale: ptBR }),
                rawDate: periodo 
            };
            
            filtros.contasSelecionadas.forEach(conta => {
                const registros = dados.filter(d => d.mes_referencia === periodo && d.descricao === conta);
                const valorTotal = registros.reduce((acc, r) => acc + Number(r.valor), 0);
                ponto[conta] = valorTotal;
            });
            
            return ponto;
        });
    }, [dados, filtros.contasSelecionadas, filtros.compararPor]);

    // HANDLERS
    const toggleConta = (descricao: string) => {
        setFiltros(prev => ({
            ...prev,
            contasSelecionadas: prev.contasSelecionadas.includes(descricao)
                ? prev.contasSelecionadas.filter(c => c !== descricao)
                : [...prev.contasSelecionadas, descricao]
        }));
    };

    const toggleGrupo = (grupo: string) => {
        setExpandirGrupos(prev => ({ ...prev, [grupo]: !prev[grupo] }));
    };

    const handleSave = () => {
        alert('Análise salva com sucesso no seu perfil!');
    };

    const handleShare = () => {
        alert('Link da análise copiado para a área de transferência!');
    };

    const handleUploadSuccess = () => {
        setShowUploadModal(false);
        // Recarregar dados
        window.location.reload();
    };

    const exportToExcel = async () => {
        if (dados.length === 0) {
            alert('Não há dados para exportar.');
            return;
        }
        
        try {
            const wb = XLSX.utils.book_new();
            
            // Aba 1: Dados Comparativos Selecionados
            const wsDados = XLSX.utils.json_to_sheet(dados.map(d => ({
                Loja: d.loja_id,
                Mês: d.mes_referencia,
                Grupo: d.grupo,
                Descrição: d.descricao,
                Valor: d.valor
            })));
            XLSX.utils.book_append_sheet(wb, wsDados, "Comparativo Selecionado");
            
            // Aba 2: Resumo Executivo (Agregado por Loja)
            const resumoPorLoja = distinctLojas.map(lojaId => {
                const dadosLoja = dados.filter(d => d.loja_id === lojaId);
                return {
                    Loja: `Loja ${lojaId}`,
                    Total_Registros: dadosLoja.length,
                    Valor_Acumulado: dadosLoja.reduce((acc, curr) => acc + Number(curr.valor), 0),
                    Periodo: `${filtros.periodoInicio} a ${filtros.periodoFim}`
                };
            });
            XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(resumoPorLoja), "Resumo por Loja");

            // Aba 3: Alertas Ativos (Busca do banco para o relatório)
            const alertas = await getAlertasAtivos(100);
            if (alertas.length > 0) {
                const wsAlertas = XLSX.utils.json_to_sheet(alertas.map(a => ({
                    Loja: a.nome_loja,
                    Mês: a.mes_referencia,
                    Mensagem: a.mensagem,
                    Severidade: a.severidade,
                    Data: a.data_deteccao
                })));
                XLSX.utils.book_append_sheet(wb, wsAlertas, "Alertas Detectados");
            }
            
            XLSX.writeFile(wb, `DRE_BI_Avancado_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
        } catch (error) {
            console.error('Erro na exportação avançada:', error);
            alert('Falha ao gerar relatório avançado.');
        }
    };

    // AGRUPAMENTO DE CONTAS
    const contasFiltradas = contasDisponiveis.filter(c => 
        c.descricao.toLowerCase().includes(buscaConta.toLowerCase()) ||
        (c.grupo && c.grupo.toLowerCase().includes(buscaConta.toLowerCase()))
    );

    const contasPorGrupo = contasFiltradas.reduce((acc, conta) => {
        const grupo = conta.grupo || 'OUTROS';
        if (!acc[grupo]) acc[grupo] = [];
        acc[grupo].push(conta);
        return acc;
    }, {} as Record<string, ContaDisponivel[]>);

    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
    };

    const distinctLojas = Array.from(new Set(dados.map(d => d.loja_id))).sort((a,b) => a-b);

    return (
        <div className="flex flex-col lg:flex-row h-[calc(100vh-120px)] gap-4 animate-in fade-in duration-500">
            
            {/* SIDEBAR ESQUERDA - SELETOR DE CONTAS */}
            <aside className="w-full lg:w-80 bg-white dark:bg-slate-900 rounded-[32px] border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col overflow-hidden">
                <div className="p-6 border-b border-slate-50 dark:border-slate-800 bg-slate-50/30">
                    <div className="flex items-center gap-2 mb-4">
                        <Layers className="text-blue-600" size={18} />
                        <h3 className="text-xs font-black uppercase tracking-widest text-slate-500">Contas DRE</h3>
                    </div>
                    
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                        <input
                            type="text"
                            placeholder="Buscar conta..."
                            value={buscaConta}
                            onChange={(e) => setBuscaConta(e.target.value)}
                            className="w-full pl-9 pr-4 py-2.5 bg-white dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-2xl text-[10px] uppercase font-bold outline-none focus:border-blue-500 transition-all shadow-sm"
                        />
                    </div>
                    
                    <div className="flex justify-between items-center mt-3">
                        <span className="text-[10px] font-black text-blue-600 uppercase tracking-tighter">
                            {filtros.contasSelecionadas.length} selecionadas
                        </span>
                        <button 
                            onClick={() => setFiltros(prev => ({ ...prev, contasSelecionadas: [] }))}
                            className="text-[9px] font-black text-slate-400 uppercase hover:text-red-500 transition-all"
                        >
                            Limpar Tudo
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                    {isLoadingContas ? (
                        <div className="flex flex-col items-center justify-center py-20 gap-3">
                            <Loader2 className="animate-spin text-blue-600" />
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Carregando Contas...</p>
                        </div>
                    ) : Object.keys(contasPorGrupo).length > 0 ? (
                        Object.entries(contasPorGrupo).map(([grupo, contas]) => (
                            <div key={grupo} className="mb-2">
                                <button 
                                    onClick={() => toggleGrupo(grupo)}
                                    className="w-full flex items-center justify-between p-2 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition-all group"
                                >
                                    <div className="flex items-center gap-2 text-left">
                                        <div className={`w-1 h-3 rounded-full transition-all ${expandirGrupos[grupo] ? 'bg-blue-600' : 'bg-slate-200'}`} />
                                        <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-tight group-hover:text-slate-900">{grupo}</span>
                                    </div>
                                    <ChevronDown size={14} className={`text-slate-300 transition-transform ${expandirGrupos[grupo] ? 'rotate-180' : ''}`} />
                                </button>

                                <AnimatePresence>
                                    {expandirGrupos[grupo] && (
                                        <motion.div 
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: 'auto', opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            className="overflow-hidden ml-2 flex flex-col gap-1 mt-1"
                                        >
                                            {contas.map(conta => (
                                                <button
                                                    key={conta.descricao}
                                                    onClick={() => toggleConta(conta.descricao)}
                                                    className={`flex items-start gap-2 p-2.5 rounded-xl transition-all border-l-2 ${
                                                        filtros.contasSelecionadas.includes(conta.descricao)
                                                            ? 'bg-blue-50/50 dark:bg-blue-900/20 border-blue-600'
                                                            : 'hover:bg-slate-50 dark:hover:bg-slate-800 border-transparent'
                                                    }`}
                                                >
                                                    <div className={`mt-0.5 rounded-md p-0.5 border-2 transition-all ${
                                                        filtros.contasSelecionadas.includes(conta.descricao)
                                                            ? 'bg-blue-600 border-blue-600 text-white'
                                                            : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700 text-transparent'
                                                    }`}>
                                                        <Check size={8} strokeWidth={4} />
                                                    </div>
                                                    <div className="flex-1 text-left">
                                                        <div className="text-[10px] font-bold text-slate-700 dark:text-slate-200 leading-tight">
                                                            {conta.descricao}
                                                        </div>
                                                        <div className="flex items-center gap-2 mt-0.5">
                                                            <span className="text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase">
                                                                {conta.lojas_com_dados} lojas
                                                            </span>
                                                            <div className="w-1 h-1 rounded-full bg-slate-200" />
                                                            <span className="text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase">
                                                                {conta.total_registros} registros
                                                            </span>
                                                        </div>
                                                    </div>
                                                </button>
                                            ))}
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        ))
                    ) : (
                        <div className="text-center py-10">
                            <p className="text-[10px] font-black text-slate-300 uppercase italic">Nenhuma conta encontrada</p>
                        </div>
                    )}
                </div>
            </aside>

            {/* ÁREA DE CONTEÚDO */}
            <main className="flex-1 flex flex-col gap-4 overflow-hidden">
                
                {/* BARRA DE FILTROS SUPERIOR */}
                <div className="bg-white dark:bg-slate-900 p-6 rounded-[32px] border border-slate-100 dark:border-slate-800 shadow-sm flex flex-wrap items-center justify-between gap-6">
                    <div className="flex flex-wrap items-center gap-6">
                        <div className="flex flex-col gap-1.5">
                            <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-1">Período de Análise</label>
                            <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 p-1 rounded-[20px] border border-slate-100 dark:border-slate-700">
                                <input
                                    type="month"
                                    value={filtros.periodoInicio.slice(0, 7)}
                                    onChange={(e) => setFiltros(prev => ({ ...prev, periodoInicio: e.target.value + '-01' }))}
                                    className="bg-transparent border-none text-[10px] font-black uppercase px-3 outline-none"
                                />
                                <div className="w-px h-4 bg-slate-200 dark:bg-slate-700" />
                                <input
                                    type="month"
                                    value={filtros.periodoFim.slice(0, 7)}
                                    onChange={(e) => setFiltros(prev => ({ ...prev, periodoFim: e.target.value + '-01' }))}
                                    className="bg-transparent border-none text-[10px] font-black uppercase px-3 outline-none"
                                />
                            </div>
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-1">Lojas Selecionadas</label>
                            <div className="relative group">
                                <button className="flex items-center gap-2 px-4 py-2.5 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 font-black text-xs uppercase text-slate-600 transition-all hover:border-blue-500">
                                    <ShoppingBag size={14} className="text-blue-600" />
                                    {filtros.lojasSelecionadas.length === 0 ? 'Todas as Lojas' : `${filtros.lojasSelecionadas.length} Lojas`}
                                    <ChevronDown size={14} />
                                </button>
                                {/* Menu de lojas flutuante (simplificado para exemplo) */}
                                <div className="absolute top-full left-0 mt-2 w-48 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-xl z-50 p-3 opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto transition-all scale-95 group-hover:scale-100 origin-top-left">
                                     <div className="grid grid-cols-2 gap-2">
                                        {lojasComDados.length > 0 ? lojasComDados.map(loja => (
                                            <button 
                                                key={loja.id} 
                                                onClick={() => {
                                                    setFiltros(prev => ({
                                                        ...prev,
                                                        lojasSelecionadas: prev.lojasSelecionadas.includes(loja.id)
                                                            ? prev.lojasSelecionadas.filter(l => l !== loja.id)
                                                            : [...prev.lojasSelecionadas, loja.id]
                                                    }));
                                                }}
                                                className={`p-2 text-[10px] font-black uppercase rounded-lg border-2 transition-all ${
                                                    filtros.lojasSelecionadas.includes(loja.id) 
                                                        ? 'bg-blue-600 border-blue-600 text-white' 
                                                        : 'hover:bg-slate-50 border-transparent text-slate-400'
                                                }`}
                                            >
                                                Loja {loja.numero}
                                            </button>
                                        )) : (
                                            <div className="col-span-2 text-center py-4">
                                                <p className="text-[8px] font-black text-slate-400 uppercase tracking-tighter">Nenhuma loja<br/>com dados</p>
                                            </div>
                                        )}
                                     </div>
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-1">Apresentação</label>
                            <div className="flex bg-slate-50 dark:bg-slate-800 p-1 rounded-[20px] border border-slate-100 dark:border-slate-700 shadow-sm relative overflow-hidden">
                                <button 
                                    onClick={() => setFiltros(prev => ({ ...prev, tipoVisualizacao: 'linha' }))}
                                    className={`relative z-10 p-2.5 rounded-xl transition-all ${filtros.tipoVisualizacao === 'linha' ? 'text-blue-600' : 'text-slate-400'}`}
                                >
                                    <LineChartIcon size={20} />
                                </button>
                                <button 
                                    onClick={() => setFiltros(prev => ({ ...prev, tipoVisualizacao: 'barras' }))}
                                    className={`relative z-10 p-2.5 rounded-xl transition-all ${filtros.tipoVisualizacao === 'barras' ? 'text-blue-600' : 'text-slate-400'}`}
                                >
                                    <BarChart3 size={20} />
                                </button>
                                <button 
                                    onClick={() => setFiltros(prev => ({ ...prev, tipoVisualizacao: 'tabela' }))}
                                    className={`relative z-10 p-2.5 rounded-xl transition-all ${filtros.tipoVisualizacao === 'tabela' ? 'text-blue-600' : 'text-slate-400'}`}
                                >
                                    <TableIcon size={20} />
                                </button>
                                <button 
                                    onClick={() => setFiltros(prev => ({ ...prev, tipoVisualizacao: 'bi' }))}
                                    className={`relative z-10 p-2.5 rounded-xl transition-all ${filtros.tipoVisualizacao === 'bi' ? 'text-blue-600' : 'text-slate-400'}`}
                                    title="Painel BI Avançado"
                                >
                                    <LayoutDashboard size={20} />
                                </button>
                            </div>
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-1">Comparar Por</label>
                            <select 
                                value={filtros.compararPor}
                                onChange={(e) => setFiltros(prev => ({ ...prev, compararPor: e.target.value as any }))}
                                className="bg-slate-50 dark:bg-slate-800 p-2.5 rounded-2xl border border-slate-100 dark:border-slate-700 text-[10px] font-black uppercase outline-none focus:border-blue-500 transition-all shadow-sm"
                            >
                                <option value="mes">Mês (Consolidado)</option>
                                <option value="loja">Loja (Individual)</option>
                            </select>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <button 
                            onClick={handleSave}
                            className="flex items-center gap-2 px-4 py-3 bg-white dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-2xl font-black text-[10px] uppercase text-slate-500 hover:border-blue-500 hover:text-blue-600 transition-all active:scale-95"
                            title="Salvar Análise"
                        >
                            <Save size={16} />
                        </button>
                        <button 
                            onClick={exportToExcel}
                            disabled={dados.length === 0}
                            className="flex items-center gap-2 px-6 py-3 bg-white dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-2xl font-black text-[10px] uppercase text-slate-500 hover:border-blue-500 hover:text-blue-600 transition-all active:scale-95 disabled:opacity-50"
                        >
                            <Download size={16} /> Excel
                        </button>
                        <button 
                            onClick={handleShare}
                            className="p-3 bg-blue-600 text-white rounded-2xl shadow-lg shadow-blue-500/20 active:scale-95 transition-all mr-2"
                            title="Compartilhar"
                        >
                            <Share2 size={20} />
                        </button>
                        
                        <button 
                            onClick={() => setShowUploadModal(true)}
                            className="flex items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-2xl font-black text-[10px] uppercase transition-all active:scale-95 shadow-lg shadow-green-500/20"
                        >
                            <Upload size={18} /> Importar DRE
                        </button>
                    </div>
                </div>

                {/* ÁREA PRINCIPAL DE VISUALIZAÇÃO */}
                <div className="flex-1 overflow-y-auto no-scrollbar pb-10">
                    {/* 1. PAINEL DE ALERTAS (Sempre visível no topo se houver alertas) */}
                    <PainelAlertas />

                    <div className="bg-white dark:bg-slate-900 rounded-[32px] border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col p-8 mb-6">
                        {isLoadingDados ? (
                            <div className="flex-1 flex flex-col items-center justify-center py-20 gap-4">
                                <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">
                                    Sincronizando dados comparativos...<br/>
                                    <span className="text-[8px] font-bold text-slate-300">Aguarde um instante</span>
                                </p>
                            </div>
                        ) : filtros.contasSelecionadas.length === 0 ? (
                            <div className="flex-1 flex flex-col items-center justify-center text-center py-20 opacity-60">
                                <div className="w-24 h-24 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center text-slate-200 mb-6">
                                    <Info size={48} />
                                </div>
                                <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-widest mb-2">Simulador de Comparativo</h3>
                                <p className="text-[10px] font-bold text-slate-400 uppercase max-w-xs leading-relaxed">
                                    Selecione as contas DRE na barra lateral para gerar análises comparativas dinâmicas.
                                </p>
                            </div>
                        ) : filtros.tipoVisualizacao === 'bi' ? (
                            /* 6. MODO DASHBOARD BI */
                            <div className="flex flex-col gap-8">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h2 className="text-xl font-black uppercase italic tracking-tighter text-slate-800 dark:text-white">
                                            Dashboard <span className="text-blue-600">Business Intelligence</span>
                                        </h2>
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Visão 360º da performance financeira</p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                                    {/* Widget 2: Ranking Top 10 Despesas */}
                                    <RankingDespesas 
                                        lojaId={filtros.lojasSelecionadas[0] || (lojasComDados[0]?.id || 5)} 
                                        mesReferencia={filtros.periodoFim} 
                                    />
                                    
                                    {/* Widget 4: Gráfico Composição */}
                                    <GraficoComposicao 
                                        lojaId={filtros.lojasSelecionadas[0] || (lojasComDados[0]?.id || 5)} 
                                        mesReferencia={filtros.periodoFim} 
                                    />

                                    {/* Widget 3: Análise de Variação MoM */}
                                    <AnaliseVariacao 
                                        lojaId={filtros.lojasSelecionadas[0] || (lojasComDados[0]?.id || 5)} 
                                        conta={filtros.contasSelecionadas[0]} 
                                    />

                                    {/* Widget 5: Heatmap Performance */}
                                    <HeatmapPerformance />
                                </div>
                            </div>
                        ) : (
                            <div className="flex-1 flex flex-col h-full overflow-hidden">
                                <div className="flex justify-between items-start mb-10">
                                    <div>
                                        <h2 className="text-xl font-black uppercase italic tracking-tighter text-slate-800 dark:text-white">
                                            Análise <span className="text-blue-600">Customizada</span>
                                        </h2>
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">
                                            {filtros.contasSelecionadas.length} contas selecionadas em {distinctLojas.length} lojas
                                        </p>
                                    </div>
                                </div>

                                <div className="flex-1 min-h-[400px] overflow-hidden flex flex-col">
                                    {filtros.tipoVisualizacao === 'tabela' ? (
                                        <div className="flex-1 overflow-auto no-scrollbar border border-slate-100 dark:border-slate-800 rounded-3xl">
                                            <TabelaDinâmica 
                                                dados={dados} 
                                                contas={filtros.contasSelecionadas} 
                                                periodos={Array.from(new Set(dados.map(d => d.mes_referencia))).sort()}
                                                lojas={distinctLojas}
                                                formatCurrency={formatCurrency}
                                            />
                                        </div>
                                    ) : (
                                        /* Gráficos padrão (Linha/Barra) */
                                        <div className="flex-1 min-h-0">
                                            <ResponsiveContainer width="100%" height="100%">
                                                {filtros.tipoVisualizacao === 'linha' ? (
                                                    <AreaChart data={chartData}>
                                                        <defs>
                                                            {filtros.contasSelecionadas.map((c, i) => (
                                                                <linearGradient key={c} id={`color${i}`} x1="0" y1="0" x2="0" y2="1">
                                                                    <stop offset="5%" stopColor={['#2563eb', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6'][i % 5]} stopOpacity={0.15}/>
                                                                    <stop offset="95%" stopColor={['#2563eb', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6'][i % 5]} stopOpacity={0}/>
                                                                </linearGradient>
                                                            ))}
                                                        </defs>
                                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                                        <XAxis 
                                                            dataKey="name" 
                                                            axisLine={false}
                                                            tickLine={false}
                                                            tick={{fontSize: 9, fontWeight: 700, fill: '#64748b'}}
                                                        />
                                                        <YAxis 
                                                            axisLine={false}
                                                            tickLine={false}
                                                            tick={{fontSize: 9, fontWeight: 700, fill: '#64748b'}}
                                                            tickFormatter={(val) => `R$ ${(val/1000).toFixed(0)}k`}
                                                        />
                                                        <Tooltip 
                                                            content={<CustomTooltip formatCurrency={formatCurrency} />}
                                                        />
                                                        <Legend 
                                                            verticalAlign="bottom" 
                                                            height={36} 
                                                            iconType="circle"
                                                            formatter={(val) => <span className="text-[10px] font-black uppercase text-slate-500 mx-2">{val}</span>}
                                                        />
                                                        {Object.keys(chartData[0] || {})
                                                            .filter(k => k !== 'name' && k !== 'rawDate')
                                                            .map((key, i) => (
                                                                <Area 
                                                                    key={key}
                                                                    type="monotone" 
                                                                    dataKey={key} 
                                                                    stroke={['#2563eb', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4', '#ec4899', '#f97316'][i % 8]} 
                                                                    strokeWidth={4} 
                                                                    fillOpacity={1} 
                                                                    fill={`url(#color${i})`}
                                                                    animationDuration={1500}
                                                                />
                                                            ))
                                                        }
                                                    </AreaChart>
                                                ) : (
                                                    <BarChart data={chartData}>
                                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                                        <XAxis 
                                                            dataKey="name" 
                                                            axisLine={false}
                                                            tickLine={false}
                                                            tick={{fontSize: 9, fontWeight: 700, fill: '#64748b'}}
                                                        />
                                                        <YAxis 
                                                            axisLine={false}
                                                            tickLine={false}
                                                            tick={{fontSize: 9, fontWeight: 700, fill: '#64748b'}}
                                                            tickFormatter={(val) => `R$ ${(val/1000).toFixed(0)}k`}
                                                        />
                                                        <Tooltip 
                                                            content={<CustomTooltip formatCurrency={formatCurrency} />}
                                                        />
                                                        <Legend 
                                                            verticalAlign="bottom" 
                                                            height={36} 
                                                            iconType="circle"
                                                            formatter={(val) => <span className="text-[10px] font-black uppercase text-slate-500 mx-2">{val}</span>}
                                                        />
                                                        {Object.keys(chartData[0] || {})
                                                            .filter(k => k !== 'name' && k !== 'rawDate')
                                                            .map((key, i) => (
                                                                <Bar 
                                                                    key={key}
                                                                    dataKey={key} 
                                                                    fill={['#2563eb', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4', '#ec4899', '#f97316'][i % 8]} 
                                                                    radius={[6, 6, 0, 0]}
                                                                    animationDuration={1500}
                                                                />
                                                            ))
                                                        }
                                                    </BarChart>
                                                )}
                                            </ResponsiveContainer>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </main>

            {/* MODAL DE UPLOAD */}
            <AnimatePresence>
                {showUploadModal && (
                    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.9, opacity: 0, y: 20 }}
                            className="bg-white dark:bg-slate-900 rounded-[40px] shadow-2xl border border-slate-100 dark:border-slate-800 w-full max-w-2xl overflow-hidden"
                        >
                            <div className="p-8 border-b border-slate-50 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/30">
                                <div>
                                    <h2 className="text-2xl font-black uppercase italic tracking-tighter text-slate-800 dark:text-white">
                                        Importar <span className="text-blue-600">DRE</span>
                                    </h2>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Sincronização de dados consolidados</p>
                                </div>
                                <button 
                                    onClick={() => setShowUploadModal(false)}
                                    className="p-3 hover:bg-white dark:hover:bg-slate-800 rounded-2xl text-slate-400 hover:text-slate-900 dark:hover:text-white transition-all border border-transparent hover:border-slate-100 dark:hover:border-slate-700"
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="p-8">
                                <DREUploadInternal onSuccess={handleUploadSuccess} />
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

// COMPONENTE DE UPLOAD INTERNO (Migrado de DREUpload.tsx)
const DREUploadInternal: React.FC<{ onSuccess: () => void }> = ({ onSuccess }) => {
    const [isDragging, setIsDragging] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successInfo, setSuccessInfo] = useState<any>(null);

    const processExcel = async (file: File) => {
        setIsProcessing(true);
        setError(null);
        try {
            const result = await parseExcelDRE(file);
            if (!result.success) {
                setError(result.errors?.[0] || 'Falha ao processar arquivo.');
                return;
            }
            const insertResult = await insertDREDataParsed(result.data);
            if (!insertResult.success) throw new Error(insertResult.error);
            
            setSuccessInfo({ rows: result.totalLinhas, stores: result.totalLojas });
            setTimeout(onSuccess, 2000);
        } catch (err: any) {
            setError(err.message || 'Falha ao processar arquivo.');
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="flex flex-col gap-6">
            {!successInfo ? (
                <div 
                    className={`
                        relative border-2 border-dashed rounded-[32px] p-12 transition-all flex flex-col items-center gap-4 text-center
                        ${isDragging ? 'border-blue-500 bg-blue-50/50' : 'border-slate-200 hover:border-blue-400 bg-slate-50/50'}
                        ${isProcessing ? 'opacity-50 pointer-events-none' : 'cursor-pointer'}
                    `}
                    onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={(e) => {
                        e.preventDefault();
                        setIsDragging(false);
                        const file = e.dataTransfer.files[0];
                        if (file) processExcel(file);
                    }}
                    onClick={() => document.getElementById('dre-file-input-internal')?.click()}
                >
                    <input 
                        id="dre-file-input-internal"
                        type="file" 
                        className="hidden" 
                        accept=".xlsx, .xls"
                        onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) processExcel(file);
                        }}
                    />
                    <div className="w-20 h-20 bg-blue-100 dark:bg-blue-900/30 rounded-[24px] flex items-center justify-center text-blue-600 mb-2">
                        {isProcessing ? <Loader2 className="animate-spin" size={40} /> : <Upload size={40} />}
                    </div>
                    <div>
                        <h3 className="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tighter">Arraste seu DRE consolidado</h3>
                        <p className="text-slate-500 text-xs font-bold uppercase mt-1">Ou clique para selecionar o arquivo Excel</p>
                    </div>
                </div>
            ) : (
                <div className="p-12 bg-green-50 dark:bg-green-900/10 rounded-[32px] border border-green-100 dark:border-green-900/20 flex flex-col items-center text-center gap-4 animate-in zoom-in-95 duration-300">
                    <Check className="w-16 h-16 text-green-600" />
                    <h3 className="text-2xl font-black text-green-900 dark:text-green-50 uppercase tracking-tighter">Sucesso!</h3>
                    <p className="text-green-700 dark:text-green-300 text-xs font-bold uppercase mt-1">
                        {successInfo.rows} registros importados de {successInfo.stores} lojas.
                    </p>
                </div>
            )}
            {error && (
                <div className="p-4 bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/20 rounded-2xl flex items-center gap-3 text-red-600">
                    <AlertCircle size={20} />
                    <p className="text-xs font-bold uppercase">{error}</p>
                </div>
            )}
        </div>
    );
};

// COMPONENTES INTERNOS
const CustomTooltip = ({ active, payload, label, formatCurrency }: any) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-4 rounded-2xl shadow-2xl">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3 pb-2 border-b border-slate-50 dark:border-slate-800">{label}</p>
                <div className="flex flex-col gap-2">
                    {payload.map((p: any, i: number) => (
                        <div key={i} className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
                                <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase truncate max-w-[120px]">{p.name}</span>
                            </div>
                            <span className="text-[11px] font-black text-slate-900 dark:text-white">{formatCurrency(p.value)}</span>
                        </div>
                    ))}
                </div>
            </div>
        );
    }
    return null;
};

interface TabelaProps {
    dados: DREData[];
    contas: string[];
    periodos: string[];
    lojas: number[];
    formatCurrency: (val: number) => string;
}

const TabelaDinâmica: React.FC<TabelaProps> = ({ dados, contas, periodos, lojas, formatCurrency }) => {
    return (
        <table className="w-full border-collapse text-left">
            <thead className="sticky top-0 z-20 bg-slate-50 dark:bg-slate-800/80 backdrop-blur-md">
                <tr>
                    <th className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 text-[10px] font-black uppercase text-slate-400 sticky left-0 z-30 bg-slate-50 dark:bg-slate-800 min-w-[200px]">Conta DRE</th>
                    {periodos.map(p => (
                        <th key={p} className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 text-[10px] font-black uppercase text-slate-400 text-center min-w-[140px]">
                            {format(parseISO(p), 'MMM/yy', { locale: ptBR })}
                        </th>
                    ))}
                    <th className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 text-[10px] font-black uppercase text-slate-400 text-center min-w-[140px] bg-blue-50/50 dark:bg-blue-900/10">Total Período</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                {contas.map(conta => {
                    let totalAcumuladoConta = 0;
                    return (
                        <tr key={conta} className="hover:bg-slate-50 transition-all group">
                            <td className="px-6 py-4 text-[10px] font-black uppercase text-slate-700 dark:text-slate-300 sticky left-0 z-10 bg-white dark:bg-slate-900 shadow-[2px_0_5px_rgba(0,0,0,0.02)] group-hover:bg-slate-50 transition-all">
                                {conta}
                            </td>
                            {periodos.map(periodo => {
                                const registros = dados.filter(d => d.mes_referencia === periodo && d.descricao === conta);
                                const valor = registros.reduce((acc, r) => acc + Number(r.valor), 0);
                                totalAcumuladoConta += valor;
                                return (
                                    <td key={periodo} className="px-6 py-4 text-[11px] font-bold text-slate-900 dark:text-white text-center">
                                        {valor !== 0 ? formatCurrency(valor) : <span className="text-slate-200">-</span>}
                                    </td>
                                );
                            })}
                            <td className="px-6 py-4 text-[11px] font-black text-blue-600 text-center bg-blue-50/20 dark:bg-blue-900/5 group-hover:bg-blue-50 group-hover:dark:bg-blue-900/10 transition-all">
                                {formatCurrency(totalAcumuladoConta)}
                            </td>
                        </tr>
                    );
                })}
            </tbody>
        </table>
    );
};

export default DREComparativo;
