
import React, { useState, useMemo } from 'react';
import { Bell, UserPlus, Calendar, CheckCircle, X, ChevronRight, AlertCircle } from 'lucide-react';
import { Store, AgendaItem, User, UserRole } from '../types';

interface NotificationHeaderProps {
    user: User;
    stores: Store[];
    agenda: AgendaItem[];
    onNavigate: (view: string) => void;
}

const NotificationHeader: React.FC<NotificationHeaderProps> = ({ user, stores, agenda, onNavigate }) => {
    const [isOpen, setIsOpen] = useState(false);

    const pendingAccessRequests = useMemo(() => {
        if (user.role !== UserRole.ADMIN) return [];
        return stores.filter(s => s.status === 'pending');
    }, [stores, user.role]);

    const pendingTasks = useMemo(() => {
        // Only show tasks for the current user or all if admin? 
        // Usually agenda is user-specific but let's see.
        // In App.tsx, agenda is fetched for all? No, let's check App.tsx fetch.
        return agenda.filter(t => !t.isCompleted);
    }, [agenda]);

    const totalNotifications = pendingAccessRequests.length + pendingTasks.length;

    if (totalNotifications === 0) {
        return (
            <div className="relative">
                <button className="p-2 text-gray-400 hover:text-blue-900 transition-colors">
                    <Bell size={20} />
                </button>
            </div>
        );
    }

    return (
        <div className="relative">
            <button 
                onClick={() => setIsOpen(!isOpen)}
                className={`p-2 rounded-full transition-all relative ${isOpen ? 'bg-blue-50 text-blue-600' : 'text-gray-500 hover:text-blue-900'}`}
            >
                <Bell size={20} />
                <span className="absolute top-0 right-0 w-4 h-4 bg-red-600 text-white text-[10px] font-black flex items-center justify-center rounded-full border-2 border-white animate-pulse">
                    {totalNotifications}
                </span>
            </button>

            {isOpen && (
                <>
                    <div className="fixed inset-0 z-[60]" onClick={() => setIsOpen(false)} />
                    <div className="absolute right-0 mt-3 w-80 bg-white rounded-[32px] shadow-2xl border border-gray-100 z-[70] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                        <div className="p-6 border-b border-gray-50 flex justify-between items-center bg-gray-50/50">
                            <h3 className="text-xs font-black text-blue-950 uppercase tracking-widest flex items-center gap-2">
                                <AlertCircle size={14} className="text-blue-600" /> Notificações
                            </h3>
                            <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-gray-600">
                                <X size={16} />
                            </button>
                        </div>

                        <div className="max-h-[400px] overflow-y-auto no-scrollbar">
                            {pendingAccessRequests.length > 0 && (
                                <div className="p-4 border-b border-gray-50">
                                    <h4 className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-3 px-2">Solicitações de Acesso ({pendingAccessRequests.length})</h4>
                                    <div className="space-y-2">
                                        {pendingAccessRequests.map(store => (
                                            <button 
                                                key={store.id}
                                                onClick={() => {
                                                    onNavigate('settings');
                                                    setIsOpen(false);
                                                }}
                                                className="w-full text-left p-3 rounded-2xl hover:bg-blue-50 transition-all group flex items-center gap-3 border border-transparent hover:border-blue-100"
                                            >
                                                <div className="p-2 bg-blue-100 text-blue-600 rounded-xl group-hover:bg-blue-600 group-hover:text-white transition-colors">
                                                    <UserPlus size={16} />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-[10px] font-black text-blue-950 uppercase truncate">Nova Unidade: {store.name}</p>
                                                    <p className="text-[9px] font-bold text-gray-400 uppercase truncate">Loja {store.number} - {store.city}</p>
                                                </div>
                                                <ChevronRight size={14} className="text-gray-300 group-hover:text-blue-600" />
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {pendingTasks.length > 0 && (
                                <div className="p-4">
                                    <h4 className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-3 px-2">Tarefas Pendentes ({pendingTasks.length})</h4>
                                    <div className="space-y-2">
                                        {pendingTasks.slice(0, 5).map(task => (
                                            <button 
                                                key={task.id}
                                                onClick={() => {
                                                    onNavigate('agenda');
                                                    setIsOpen(false);
                                                }}
                                                className="w-full text-left p-3 rounded-2xl hover:bg-green-50 transition-all group flex items-center gap-3 border border-transparent hover:border-green-100"
                                            >
                                                <div className="p-2 bg-green-100 text-green-600 rounded-xl group-hover:bg-green-600 group-hover:text-white transition-colors">
                                                    <Calendar size={16} />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-[10px] font-black text-blue-950 uppercase truncate">{task.title}</p>
                                                    <p className="text-[9px] font-bold text-gray-400 uppercase truncate">Prazo: {task.dueDate}</p>
                                                </div>
                                                <ChevronRight size={14} className="text-gray-300 group-hover:text-green-600" />
                                            </button>
                                        ))}
                                        {pendingTasks.length > 5 && (
                                            <button 
                                                onClick={() => {
                                                    onNavigate('agenda');
                                                    setIsOpen(false);
                                                }}
                                                className="w-full py-2 text-center text-[9px] font-black text-blue-600 uppercase hover:underline"
                                            >
                                                Ver mais {pendingTasks.length - 5} tarefas...
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="p-4 bg-gray-50/50 border-t border-gray-50">
                            <button 
                                onClick={() => setIsOpen(false)}
                                className="w-full py-3 bg-white border border-gray-200 rounded-2xl text-[9px] font-black text-gray-400 uppercase hover:text-blue-600 hover:border-blue-200 transition-all"
                            >
                                Fechar Notificações
                            </button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default NotificationHeader;
