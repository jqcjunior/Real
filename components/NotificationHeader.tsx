import React, { useState, useMemo } from 'react';
import { toast } from 'sonner';
import { 
    Bell, 
    X, 
    ChevronRight, 
    AlertTriangle, 
    MessageSquare, 
    ClipboardList, 
    ShoppingCart, 
    Target, 
    Calendar, 
    CheckCircle2, 
    TrendingUp, 
    Users,
    Activity,
    Info
} from 'lucide-react';
import { Store, AgendaItem, User } from '../types';
import { useNotifications, UnifiedActionItem, CentralCategory } from '../hooks/useNotifications';

const formatBRL = (val: number) => {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(val);
};

const formatShortDate = (dateStr: string) => {
    const parts = dateStr.split('-');
    if (parts.length < 3) return dateStr;
    return `${parts[2]}/${parts[1]}`;
};

const formatAckDate = (isoStr?: string) => {
    if (!isoStr) return '';
    const d = new Date(isoStr);
    return d.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    }).replace(', ', ' às ');
};

interface NotificationHeaderProps {
    user: User;
    stores: Store[];
    agenda: AgendaItem[];
    onNavigate: (view: string, params?: any) => void;
    can: (perm: string) => boolean;
}

const CATEGORY_INFO: Record<CentralCategory, { label: string; color: string; icon: React.ReactNode }> = {
    pedidos: { 
        label: 'Pedidos', 
        color: 'text-amber-600 bg-amber-50 border-amber-100',
        icon: <ShoppingCart size={14} className="text-amber-600" />
    },
    chamados: { 
        label: 'Chamados', 
        color: 'text-blue-600 bg-blue-50 border-blue-100',
        icon: <MessageSquare size={14} className="text-blue-600" />
    },
    pesquisas: { 
        label: 'Pesquisas', 
        color: 'text-purple-600 bg-purple-50 border-purple-100',
        icon: <ClipboardList size={14} className="text-purple-600" />
    },
    metas: { 
        label: 'Metas e OTB', 
        color: 'text-emerald-600 bg-emerald-50 border-emerald-100',
        icon: <Target size={14} className="text-emerald-600" />
    },
    agenda: { 
        label: 'Agenda e Tarefas', 
        color: 'text-indigo-600 bg-indigo-50 border-indigo-100',
        icon: <Calendar size={14} className="text-indigo-600" />
    }
};

const PRIORITY_BADGES = {
    critical: {
        label: 'Crítica',
        classes: 'bg-rose-50 text-rose-700 border-rose-100 animate-pulse',
        dot: 'bg-rose-500'
    },
    high: {
        label: 'Alta',
        classes: 'bg-amber-50 text-amber-700 border-amber-100',
        dot: 'bg-amber-500'
    },
    medium: {
        label: 'Média',
        classes: 'bg-blue-50 text-blue-700 border-blue-100',
        dot: 'bg-blue-500'
    },
    low: {
        label: 'Baixa',
        classes: 'bg-slate-50 text-slate-700 border-slate-100',
        dot: 'bg-slate-500'
    }
};

const NotificationHeader: React.FC<NotificationHeaderProps> = ({ user, stores, agenda, onNavigate, can }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [activeFilter, setActiveFilter] = useState<'all' | 'critical' | 'important' | 'info'>('all');

    const {
        totalNotifications,
        pendencies,
        groupedPendencies: originalGroupedPendencies,
        summary,
        centralTitle
    } = useNotifications(user, stores, agenda, can);

    // Filtragem em memória das pendências
    const filteredPendencies = useMemo(() => {
        if (activeFilter === 'all') return pendencies;
        if (activeFilter === 'critical') {
            return pendencies.filter(item => item.priority === 'critical');
        }
        if (activeFilter === 'important') {
            return pendencies.filter(item => item.priority === 'high');
        }
        if (activeFilter === 'info') {
            return pendencies.filter(item => item.priority !== 'critical' && item.priority !== 'high');
        }
        return pendencies;
    }, [pendencies, activeFilter]);

    // Reagrupamento das pendências filtradas
    const groupedPendencies = useMemo(() => {
        const groups: Record<CentralCategory, UnifiedActionItem[]> = {
            pedidos: [],
            chamados: [],
            pesquisas: [],
            metas: [],
            agenda: []
        };

        filteredPendencies.forEach(item => {
            if (groups[item.category]) {
                groups[item.category].push(item);
            }
        });

        return groups;
    }, [filteredPendencies]);

    const handleActionClick = async (item: UnifiedActionItem) => {
        try {
            await item.onAction();
        } catch (err) {
            console.error("Erro ao processar ação da pendência:", err);
        }
        onNavigate(item.target_url, item.target_params);
        setIsOpen(false);
    };

    const toggleFilter = (filter: 'all' | 'critical' | 'important' | 'info') => {
        if (activeFilter === filter) {
            setActiveFilter('all');
        } else {
            setActiveFilter(filter);
        }
    };

    return (
        <div className="relative">
            {/* Botão de Sino de Notificação */}
            <button 
                id="central-operacional-bell-btn"
                onClick={() => setIsOpen(!isOpen)}
                className={`p-2.5 rounded-2xl transition-all relative ${
                    isOpen 
                        ? 'bg-blue-50 text-blue-600 border border-blue-100' 
                        : 'text-gray-500 hover:text-blue-900 hover:bg-gray-50 border border-transparent'
                }`}
            >
                <Bell size={20} />
                {totalNotifications > 0 && (
                    <span className="absolute top-0 right-0 w-5 h-5 bg-red-600 text-white text-[10px] font-black flex items-center justify-center rounded-full border-2 border-white animate-bounce shadow-md">
                        {totalNotifications}
                    </span>
                )}
            </button>

            {isOpen && (
                <>
                    {/* Backdrop para fechar */}
                    <div className="fixed inset-0 z-[60]" onClick={() => setIsOpen(false)} />
                    
                    {/* Painel Central Operacional do Gestor */}
                    <div className="absolute right-0 mt-3 w-[420px] bg-white rounded-[32px] shadow-[0_20px_50px_rgba(0,0,0,0.15)] border border-gray-100 z-[70] overflow-hidden animate-in fade-in slide-in-from-top-4 duration-200">
                        
                        {/* CABEÇALHO DA CENTRAL */}
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gradient-to-r from-gray-50/50 to-white">
                            <div>
                                <h3 className="text-sm font-black text-blue-950 uppercase tracking-wider flex items-center gap-2">
                                    <Activity size={16} className="text-blue-600" /> {centralTitle}
                                </h3>
                                <p className="text-[10px] font-bold text-gray-400 uppercase mt-0.5 tracking-wider">Centro de Ações e Pendências</p>
                            </div>
                            <button 
                                onClick={() => setIsOpen(false)} 
                                className="p-1.5 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        {/* PAINEL RESUMO NO TOPO */}
                        {pendencies.length > 0 && (
                            <div className="px-6 py-4 bg-gray-50/40 border-b border-gray-100">
                                <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-2.5">Painel Resumo (Filtros)</p>
                                <div className="grid grid-cols-4 gap-1.5">
                                    {/* CARD TODOS */}
                                    <div 
                                        onClick={() => toggleFilter('all')}
                                        className={`rounded-2xl p-2 text-center shadow-sm cursor-pointer transition-all border ${
                                            activeFilter === 'all'
                                                ? 'bg-blue-600 border-blue-600 text-white shadow-md scale-105'
                                                : 'bg-gray-100/70 border-gray-200 text-gray-700 hover:bg-gray-100'
                                        }`}
                                    >
                                        <p className={`text-base font-black leading-none ${activeFilter === 'all' ? 'text-white' : 'text-blue-950'}`}>{pendencies.length}</p>
                                        <p className={`text-[8px] font-bold uppercase mt-1 tracking-wider ${activeFilter === 'all' ? 'text-blue-100' : 'text-gray-500'}`}>Todos</p>
                                    </div>

                                    {/* CARD CRÍTICAS */}
                                    <div 
                                        onClick={() => toggleFilter('critical')}
                                        className={`rounded-2xl p-2 text-center shadow-sm cursor-pointer transition-all border ${
                                            activeFilter === 'critical'
                                                ? 'bg-rose-600 border-rose-600 text-white shadow-md scale-105'
                                                : 'bg-rose-50/50 border-rose-100/60 text-rose-700 hover:bg-rose-50'
                                        }`}
                                    >
                                        <p className={`text-base font-black leading-none ${activeFilter === 'critical' ? 'text-white' : 'text-rose-700'}`}>{summary.critical}</p>
                                        <p className={`text-[8px] font-bold uppercase mt-1 tracking-wider ${activeFilter === 'critical' ? 'text-rose-100' : 'text-rose-600'}`}>Críticas</p>
                                    </div>

                                    {/* CARD IMPORTANTES */}
                                    <div 
                                        onClick={() => toggleFilter('important')}
                                        className={`rounded-2xl p-2 text-center shadow-sm cursor-pointer transition-all border ${
                                            activeFilter === 'important'
                                                ? 'bg-amber-600 border-amber-600 text-white shadow-md scale-105'
                                                : 'bg-amber-50/50 border-amber-100/60 text-amber-700 hover:bg-amber-50'
                                        }`}
                                    >
                                        <p className={`text-base font-black leading-none ${activeFilter === 'important' ? 'text-white' : 'text-amber-700'}`}>{summary.important}</p>
                                        <p className={`text-[8px] font-bold uppercase mt-1 tracking-wider ${activeFilter === 'important' ? 'text-amber-100' : 'text-amber-600'}`}>Importantes</p>
                                    </div>

                                    {/* CARD INFORMAÇÕES */}
                                    <div 
                                        onClick={() => toggleFilter('info')}
                                        className={`rounded-2xl p-2 text-center shadow-sm cursor-pointer transition-all border ${
                                            activeFilter === 'info'
                                                ? 'bg-blue-600 border-blue-600 text-white shadow-md scale-105'
                                                : 'bg-blue-50/50 border-blue-100/60 text-blue-700 hover:bg-blue-50'
                                        }`}
                                    >
                                        <p className={`text-base font-black leading-none ${activeFilter === 'info' ? 'text-white' : 'text-blue-700'}`}>{summary.info}</p>
                                        <p className={`text-[8px] font-bold uppercase mt-1 tracking-wider ${activeFilter === 'info' ? 'text-blue-100' : 'text-blue-600'}`}>Informações</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* LISTA DE PENDÊNCIAS POR CATEGORIA */}
                        <div className="max-h-[440px] overflow-y-auto no-scrollbar">
                            {filteredPendencies.length > 0 ? (
                                (Object.entries(groupedPendencies) as [CentralCategory, UnifiedActionItem[]][]).map(([category, items]) => {
                                    if (items.length === 0) return null;
                                    const catInfo = CATEGORY_INFO[category as CentralCategory] || {
                                        label: category,
                                        color: 'bg-gray-50 border-gray-100 text-gray-600',
                                        icon: <Info size={14} />
                                    };

                                    return (
                                        <div key={category} className="p-4 border-b border-gray-50 last:border-0">
                                            {/* Cabeçalho do Grupo */}
                                            <div className="flex items-center gap-2 mb-3 px-1">
                                                <div className={`p-1.5 rounded-lg border ${catInfo.color.split(' ')[1]} ${catInfo.color.split(' ')[2]}`}>
                                                    {catInfo.icon}
                                                </div>
                                                <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">
                                                    {catInfo.label} ({items.length})
                                                </span>
                                            </div>

                                            {/* Itens do Grupo */}
                                            <div className="space-y-2.5">
                                                {items.map(item => {
                                                    const badge = PRIORITY_BADGES[item.priority] || PRIORITY_BADGES.medium;
                                                    return (
                                                        <div 
                                                            key={item.id}
                                                            className={`p-4 rounded-2xl bg-white border border-gray-100 hover:border-blue-100 hover:shadow-md transition-all group flex flex-col gap-2.5 relative ${
                                                                item.isAcknowledged ? 'opacity-60 bg-gray-50/50' : ''
                                                            }`}
                                                        >
                                                            {/* Top Row: Priority Badge & Date */}
                                                            <div className="flex justify-between items-center">
                                                                <div className={`px-2 py-0.5 rounded-full border text-[8px] font-black uppercase flex items-center gap-1.5 ${badge.classes}`}>
                                                                    <span className={`w-1 h-1 rounded-full ${badge.dot}`} />
                                                                    {badge.label}
                                                                </div>
                                                                <span className="text-[8px] font-bold text-gray-300 uppercase">
                                                                    {new Date(item.created_at).toLocaleDateString('pt-BR', {
                                                                        day: '2-digit',
                                                                        month: '2-digit',
                                                                        hour: '2-digit',
                                                                        minute: '2-digit'
                                                                    })}
                                                                </span>
                                                            </div>

                                                            {/* Mid Row: Title & Text */}
                                                            <div>
                                                                {item.category === 'pedidos' ? (
                                                                    <h4 className="text-[10px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-wide flex items-center gap-1.5 mb-1">
                                                                        🛒 {item.title}
                                                                    </h4>
                                                                ) : item.category === 'metas' && item.metaValues ? (
                                                                    <h4 className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-wide flex items-center gap-1.5 mb-1">
                                                                        🎯 {item.title}
                                                                        {item.metaValues.tipo === 'semanal' && item.metaValues.dataInicio && item.metaValues.dataFim && ` — SEMANA DE ${formatShortDate(item.metaValues.dataInicio)} A ${formatShortDate(item.metaValues.dataFim)}`}
                                                                    </h4>
                                                                ) : (
                                                                    <h4 className="text-[10px] font-black text-blue-950 dark:text-slate-200 uppercase tracking-wide">
                                                                        {item.title}
                                                                    </h4>
                                                                )}
                                                                {item.category === 'pedidos' ? (
                                                                    (() => {
                                                                        const lines = item.message.split('\n');
                                                                        const line1 = lines[0] || '';
                                                                        const line2 = lines[1] || '';
                                                                        return (
                                                                            <div className="space-y-0.5">
                                                                                <div className="text-[11px] font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight">
                                                                                    {line1.trim()}
                                                                                </div>
                                                                                {line2 && (
                                                                                    <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">
                                                                                        {line2.trim()}
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        );
                                                                    })()
                                                                ) : (
                                                                    <p className="text-[9px] font-bold text-gray-400 uppercase mt-0.5 leading-relaxed whitespace-pre-line">
                                                                        {item.message}
                                                                    </p>
                                                                )}

                                                                {/* Render grid of 3 weekly goal values if present (Part 4) */}
                                                                {item.category === 'metas' && item.metaValues && (
                                                                    <div className="mt-2.5 bg-gray-50/70 border border-gray-150/70 rounded-2xl overflow-hidden shadow-sm">
                                                                        {item.metaValues.tipo === 'semanal' ? (
                                                                            <div className="grid grid-cols-3 divide-x divide-gray-150 text-center">
                                                                                <div className="p-2 bg-white/40">
                                                                                    <p className="text-[8px] font-black uppercase text-gray-400 tracking-wider">Meta Valor</p>
                                                                                    <p className="text-[11px] font-black text-emerald-600 mt-0.5">
                                                                                        {formatBRL(item.metaValues.metaValor)}
                                                                                    </p>
                                                                                </div>
                                                                                <div className="p-2 bg-white/40">
                                                                                    <p className="text-[8px] font-black uppercase text-gray-400 tracking-wider">Meta PA</p>
                                                                                    <p className="text-[11px] font-black text-blue-950 mt-0.5">
                                                                                        {item.metaValues.paTarget !== undefined ? item.metaValues.paTarget.toFixed(2) : '-'}
                                                                                    </p>
                                                                                </div>
                                                                                <div className="p-2 bg-white/40">
                                                                                    <p className="text-[8px] font-black uppercase text-gray-400 tracking-wider">Meta Ticket</p>
                                                                                    <p className="text-[11px] font-black text-blue-950 mt-0.5">
                                                                                        {item.metaValues.ticketTarget !== undefined ? formatBRL(item.metaValues.ticketTarget) : '-'}
                                                                                    </p>
                                                                                </div>
                                                                            </div>
                                                                        ) : (
                                                                            <div className="text-center">
                                                                                <div className="p-2.5 bg-white/40">
                                                                                    <p className="text-[8px] font-black uppercase text-gray-400 tracking-wider">Meta Valor Da Loja</p>
                                                                                    <p className="text-[12px] font-black text-emerald-600 mt-0.5">
                                                                                        {formatBRL(item.metaValues.metaValor)}
                                                                                    </p>
                                                                                </div>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </div>

                                                            {/* Bottom Row: CTA Button */}
                                                            <div className="flex justify-between items-center pt-2 gap-2 border-t border-slate-150/40 dark:border-slate-800/40 mt-1.5">
                                                                {/* Left side: Acknowledgment status */}
                                                                <div className="flex-1 min-w-0 pr-1">
                                                                    {item.isAcknowledged && (
                                                                        <div className="flex items-center gap-1 text-[8px] font-black text-emerald-600 uppercase tracking-wide">
                                                                            <CheckCircle2 size={12} className="text-emerald-500 shrink-0" />
                                                                            <span className="truncate">Visto em {formatAckDate(item.acknowledgedAt || item.created_at)}</span>
                                                                        </div>
                                                                    )}
                                                                </div>

                                                                {/* Right side: Action buttons */}
                                                                <div className="flex items-center gap-1.5 shrink-0">
                                                                    {item.category === 'pedidos' && (
                                                                        <button
                                                                            onClick={async (e) => {
                                                                                e.stopPropagation();
                                                                                try {
                                                                                    await item.onAction();
                                                                                    toast.success("Pedido arquivado localmente.");
                                                                                } catch (err) {
                                                                                    console.error("Erro ao marcar pedido como OK:", err);
                                                                                    toast.error("Erro ao arquivar pedido.");
                                                                                }
                                                                            }}
                                                                            className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-600 text-emerald-700 hover:text-white rounded-xl text-[8px] font-black uppercase tracking-wider flex items-center gap-1 transition-all border border-emerald-200 hover:border-emerald-600 shadow-sm active:scale-95"
                                                                        >
                                                                            ✓ OK
                                                                        </button>
                                                                    )}

                                                                    {item.category === 'metas' && !item.isAcknowledged && (
                                                                        <button
                                                                            onClick={async (e) => {
                                                                                e.stopPropagation();
                                                                                try {
                                                                                    await item.onAction();
                                                                                    toast.success("Meta confirmada com sucesso.");
                                                                                } catch (err) {
                                                                                    console.error("Erro ao confirmar meta:", err);
                                                                                    toast.error("Erro ao confirmar meta.");
                                                                                }
                                                                            }}
                                                                            className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-600 text-emerald-700 hover:text-white rounded-xl text-[8px] font-black uppercase tracking-wider flex items-center gap-1 transition-all border border-emerald-200 hover:border-emerald-600 shadow-sm active:scale-95"
                                                                        >
                                                                            ✓ OK, CONFIRMAR
                                                                        </button>
                                                                    )}

                                                                    <button
                                                                        onClick={() => handleActionClick(item)}
                                                                        className="px-3 py-1.5 bg-blue-50 hover:bg-blue-600 text-blue-600 hover:text-white rounded-xl text-[8px] font-black uppercase tracking-wider flex items-center gap-1 transition-all border border-blue-100 hover:border-blue-600 shadow-sm active:scale-95"
                                                                    >
                                                                        {item.category === 'pedidos' ? 'VER PEDIDO' : item.action_label}
                                                                        <ChevronRight size={10} />
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    );
                                })
                            ) : (
                                <div className="p-12 text-center">
                                    <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4 border border-blue-100">
                                        <CheckCircle2 size={32} />
                                    </div>
                                    <p className="text-[11px] font-black text-blue-950 uppercase tracking-wider">Tudo Resolvido!</p>
                                    <p className="text-[9px] font-bold text-gray-400 uppercase mt-1 tracking-wide">Nenhuma pendência operacional correspondente ao filtro ativo.</p>
                                </div>
                            )}
                        </div>

                        {/* FOOTER */}
                        <div className="p-4 bg-gray-50/50 border-t border-gray-100 flex justify-between items-center px-6">
                            <span className="text-[8px] font-bold text-gray-400 uppercase tracking-widest">
                                SISTEMA REAL ADMIN
                            </span>
                            <button 
                                onClick={() => setIsOpen(false)}
                                className="px-4 py-2 bg-white border border-gray-200 hover:border-gray-300 rounded-xl text-[9px] font-black text-gray-400 hover:text-gray-600 uppercase transition-all shadow-sm"
                            >
                                Fechar
                            </button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default NotificationHeader;
