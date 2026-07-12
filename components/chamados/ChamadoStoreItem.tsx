import React from 'react';
import { ChevronRight } from 'lucide-react';
import { Store } from '../../types';

interface ChamadoStoreItemProps {
    store: Store;
    isSelected: boolean;
    count: { total: number; urgent: number; unread: number };
    onSelect: (storeId: string) => void;
}

const ChamadoStoreItem: React.FC<ChamadoStoreItemProps> = ({ store, isSelected, count, onSelect }) => {
    let dotColor = 'bg-slate-300 dark:bg-slate-700';
    if (count.urgent > 0) dotColor = 'bg-red-500 animate-pulse';
    else if (count.total > 5) dotColor = 'bg-amber-500';
    else if (count.total > 0) dotColor = 'bg-emerald-500';

    return (
        <button
            onClick={() => onSelect(store.id)}
            className={`w-full px-3 py-2.5 rounded-xl flex items-center gap-3 transition-all border ${
                isSelected ? 'bg-white dark:bg-slate-900 border-blue-200 dark:border-blue-800' : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 hover:border-slate-200'
            }`}
        >
            <span className={`w-2 h-2 rounded-full shrink-0 ${dotColor}`} />
            <div className="flex-1 text-left min-w-0">
                <p className="text-[12px] font-semibold text-slate-700 dark:text-slate-300 truncate">Loja {store.number}</p>
                <p className="text-[10px] text-slate-400 truncate">{store.city}</p>
            </div>
            {count.total > 0 && <span className="text-[11px] text-slate-400 shrink-0">{count.total}</span>}
            <ChevronRight size={14} className="text-slate-300 shrink-0" />
        </button>
    );
};

export default React.memo(ChamadoStoreItem, (prev, next) =>
    prev.store.id === next.store.id &&
    prev.isSelected === next.isSelected &&
    prev.count.total === next.count.total &&
    prev.count.urgent === next.count.urgent &&
    prev.count.unread === next.count.unread
);
