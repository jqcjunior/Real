import React from 'react';
import { User } from 'lucide-react';
import { AdminUser } from '../../types';

interface ChamadoAssignPanelProps {
    storeUsers: AdminUser[];
    assignedTo: string | null | undefined;
    onAssign: (userId: string) => void;
}

const ChamadoAssignPanel: React.FC<ChamadoAssignPanelProps> = ({ storeUsers, assignedTo, onAssign }) => {
    return (
        <div className="p-3">
            <div className="mb-4 sticky top-0 bg-white dark:bg-slate-900 pb-2">
                <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Direcionar</h4>
            </div>
            {storeUsers.length > 0 ? (
                <div className="space-y-2">
                    {storeUsers.map(u => (
                        <button
                            key={u.id}
                            onClick={() => onAssign(u.id)}
                            className={`w-full flex flex-col items-center gap-1 p-2 rounded-xl border transition-all text-center ${
                                assignedTo === u.id ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-slate-100 dark:border-slate-800 hover:border-blue-200 hover:bg-slate-50 dark:hover:bg-slate-800'
                            }`}
                        >
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs ${
                                assignedTo === u.id ? 'bg-blue-600 text-white' : 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                            }`}>
                                {u.name.substring(0, 2).toUpperCase()}
                            </div>
                            <div className="w-full">
                                <p className="text-[9px] font-black text-slate-700 dark:text-slate-300 truncate leading-tight">{u.name}</p>
                                <p className="text-[7px] font-bold text-slate-400 uppercase">{u.role_level}</p>
                            </div>
                            {assignedTo === u.id && <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse"></div>}
                        </button>
                    ))}
                </div>
            ) : (
                <div className="text-center py-8">
                    <User className="mx-auto text-slate-300 mb-2" size={24} />
                    <p className="text-[8px] font-bold text-slate-400 uppercase">Nenhum usuário</p>
                </div>
            )}
        </div>
    );
};

export default React.memo(ChamadoAssignPanel);
