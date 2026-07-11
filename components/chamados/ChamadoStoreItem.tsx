import React from 'react';
import { Store as StoreIcon } from 'lucide-react';
import { Store } from '../../types';

interface ChamadoStoreItemProps {
    store: Store;
    isSelected: boolean;
    count: { total: number; urgent: number; unread: number };
    onSelect: (storeId: string) => void;
}

const ChamadoStoreItem: React.FC<ChamadoStoreItemProps> = ({ store, isSelected, count, onSelect }) => {
    let statusColor = "bg-slate-100 dark:bg-slate-800 text-slate-400";
    if (count.urgent > 0) statusColor = "bg-red-500 text-white animate-pulse";
    else if (count.total > 5) statusColor = "bg-orange-500 text-white";
    else if (count.total > 0) statusColor = "bg-emerald-500 text-white";

    return (
        <button
            onClick={() => onSelect(store.id)}
            className={`w-full p-3 rounded-2xl flex items-center gap-3 transition-all group relative ${
                isSelected ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-100 dark:border-blue-800' : 'hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
        >
            {count.unread > 0 && (
                <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-600 rounded-full flex items-center justify-center animate-bounce">
                    <span className="text-[9px] font-black text-white">{count.unread > 9 ? '9+' : count.unread}</span>
                </div>
            )}

            <div className={`p-2 rounded-xl transition-colors ${statusColor}`}>
                <StoreIcon size={18} />
            </div>

            <div className="flex-1 text-left min-w-0">
                <p className={`text-[11px] font-black uppercase truncate ${isSelected ? 'text-blue-900 dark:text-blue-100' : 'text-slate-600 dark:text-slate-400'}`}>
                    Loja {store.number}
                </p>
                <p className="text-[9px] font-bold text-slate-400 truncate">{store.city}</p>
            </div>

            {count.total > 0 && (
                <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className={`px-1.5 py-0.5 text-[8px] font-black rounded-md ${count.urgent > 0 ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>
                        {count.total}
                    </span>
                    {count.urgent > 0 && <span className="text-[7px] font-black text-red-500 uppercase">Urgente</span>}
                </div>
            )}
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
