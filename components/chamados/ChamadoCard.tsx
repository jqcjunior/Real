import React from 'react';
import { AlertCircle, Clock, Pause, CheckCircle2, XCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { DemandV2, DemandV2Priority, DemandV2Status } from '../../types';

const getPriorityBadge = (priority: DemandV2Priority) => {
    switch (priority) {
        case 'urgente': return <span className="px-2 py-0.5 bg-red-100 text-red-600 rounded-full text-[10px] font-black uppercase animate-pulse border border-red-200">Urgente</span>;
        case 'alta': return <span className="px-2 py-0.5 bg-orange-100 text-orange-600 rounded-full text-[10px] font-black uppercase border border-orange-200">Alta</span>;
        case 'media': return <span className="px-2 py-0.5 bg-blue-100 text-blue-600 rounded-full text-[10px] font-black uppercase border border-blue-200">Média</span>;
        case 'baixa': return <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full text-[10px] font-black uppercase border border-slate-200">Baixa</span>;
    }
};

const getStatusIcon = (status: DemandV2Status) => {
    switch (status) {
        case 'aberta': return <AlertCircle size={16} className="text-blue-500" />;
        case 'em_andamento': return <Clock size={16} className="text-amber-500" />;
        case 'pausada': return <Pause size={16} className="text-slate-500" />;
        case 'resolvida': return <CheckCircle2 size={16} className="text-emerald-500" />;
        case 'cancelada': return <XCircle size={16} className="text-rose-500" />;
    }
};

interface ChamadoCardProps {
    demand: DemandV2;
    isSelected: boolean;
    onSelect: (demand: DemandV2) => void;
    compact?: boolean;
}

const ChamadoCard: React.FC<ChamadoCardProps> = ({ demand, isSelected, onSelect, compact }) => {
    return (
        <button
            onClick={() => onSelect(demand)}
            className={`w-full p-4 rounded-2xl border transition-all text-left group relative overflow-hidden active:scale-98 ${
                isSelected
                    ? 'bg-white dark:bg-slate-900 border-blue-200 dark:border-blue-800 shadow-xl'
                    : 'bg-white/50 dark:bg-slate-900/50 border-transparent hover:border-slate-200 dark:hover:border-slate-800'
            }`}
        >
            {demand.unread_count > 0 && (
                <div className="absolute top-0 right-0 w-8 h-8 bg-blue-600 flex items-center justify-center rounded-bl-2xl shadow-lg">
                    <span className="text-[10px] font-black text-white">{demand.unread_count}</span>
                </div>
            )}

            <div className="flex justify-between items-start mb-2">
                <span className="text-[9px] font-black text-blue-600 dark:text-blue-400 font-mono">{demand.ticket_number}</span>
                {getPriorityBadge(demand.priority)}
            </div>

            <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase mb-1 line-clamp-1">{demand.title}</h4>
            {!compact && (
                <p className="text-[10px] font-medium text-slate-400 line-clamp-2 mb-3">{demand.description}</p>
            )}

            <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                    {getStatusIcon(demand.status)}
                    <span className="text-[8px] font-black uppercase text-slate-500">{demand.status.replace('_', ' ')}</span>
                </div>
                <span className="text-[8px] font-bold text-slate-300 uppercase">
                    {formatDistanceToNow(new Date(demand.created_at), { addSuffix: true, locale: ptBR })}
                </span>
            </div>
        </button>
    );
};

export { getPriorityBadge, getStatusIcon };
export default React.memo(ChamadoCard, (prev, next) =>
    prev.demand.id === next.demand.id &&
    prev.demand.status === next.demand.status &&
    prev.demand.unread_count === next.demand.unread_count &&
    prev.isSelected === next.isSelected
);
