import React, { useState, useEffect, useMemo } from 'react';
import { Bell, UserPlus, Calendar, CheckCircle, X, ChevronRight, AlertCircle, MessageSquare } from 'lucide-react';
import { Store, AgendaItem, User } from '../types';
import { supabase } from '../services/supabaseClient'; // Importação necessária para o Real-time

interface NotificationHeaderProps {
    user: User;
    stores: Store[];
    agenda: AgendaItem[];
    onNavigate: (view: string) => void;
    can: (perm: string) => boolean;
}

const NotificationHeader: React.FC<NotificationHeaderProps> = ({ user, stores, agenda, onNavigate, can }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [demandNotifications, setDemandNotifications] = useState<any[]>([]);

    // 1. Efeito para carregar e ouvir notificações de demandas em tempo real
    useEffect(() => {
        const fetchDemandNotifications = async () => {
            const { data, error } = await supabase
                .from('demands_notifications')
                .select('*')
                .eq('user_id', user.id)
                .eq('is_read', false)
                .order('created_at', { ascending: false });
            
            if (data) setDemandNotifications(data);
            if (error) console.error("Erro ao carregar notificações de chamados:", error);
        };

        fetchDemandNotifications();

        // Inscreve no Real-time para o sino atualizar na hora
        const channel = supabase
            .channel('demand-notifications-realtime')
            .on('postgres_changes', 
                { 
                    event: 'INSERT', 
                    schema: 'public', 
                    table: 'demands_notifications', 
                    filter: `user_id=eq.${user.id}` 
                }, 
                (payload) => {
                    setDemandNotifications(prev => [payload.new, ...prev]);
                    // Opcional: Tocar um som ou dar um feedback visual extra aqui
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user.id]);

    const pendingAccessRequests = useMemo(() => {
        if (!can('ALWAYS')) return [];
        return stores.filter(s => s.status === 'pending');
    }, [stores, can]);

    const pendingTasks = useMemo(() => {
        return agenda.filter(t => !t.isCompleted);
    }, [agenda]);

    // 2. Contador Global Atualizado
    const totalNotifications = pendingAccessRequests.length + pendingTasks.length + demandNotifications.length;

    const handleMarkAsRead = async (notificationId: string) => {
        await supabase
            .from('demands_notifications')
            .update({ is_read: true, read_at: new Date().toISOString() })
            .eq('id', notificationId);
        
        setDemandNotifications(prev => prev.filter(n => n.id !== notificationId));
    };

    return (
        <div className="relative">
            <button 
                onClick={() => setIsOpen(!isOpen)}
                className={`p-2 rounded-full transition-all relative ${isOpen ? 'bg-blue-50 text-blue-600' : 'text-gray-500 hover:text-blue-900'}`}
            >
                <Bell size={20} />
                {totalNotifications > 0 && (
                    <span className="absolute top-0 right-0 w-4 h-4 bg-red-600 text-white text-[10px] font-black flex items-center justify-center rounded-full border-2 border-white animate-pulse">
                        {totalNotifications}
                    </span>
                )}
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
                            
                            {/* SEÇÃO: NOVOS CHAMADOS (DEMANDAS) */}
                            {demandNotifications.length > 0 && (
                                <div className="p-4 border-b border-gray-50 bg-blue-50/30">
                                    <h4 className="text-[9px] font-black text-blue-600 uppercase tracking-widest mb-3 px-2">Chamados Urgentes ({demandNotifications.length})</h4>
                                    <div className="space-y-2">
                                        {demandNotifications.map(notification => (
                                            <button 
                                                key={notification.id}
                                                onClick={() => {
                                                    handleMarkAsRead(notification.id);
                                                    onNavigate('demands');
                                                    setIsOpen(false);
                                                }}
                                                className="w-full text-left p-3 rounded-2xl bg-white hover:bg-blue-50 transition-all group flex items-center gap-3 border border-blue-100 shadow-sm"
                                            >
                                                <div className="p-2 bg-blue-600 text-white rounded-xl">
                                                    <MessageSquare size={16} />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-[10px] font-black text-blue-950 uppercase truncate">{notification.title}</p>
                                                    <p className="text-[9px] font-bold text-gray-400 uppercase truncate line-clamp-1">{notification.message}</p>
                                                </div>
                                                <ChevronRight size={14} className="text-gray-300 group-hover:text-blue-600" />
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* SEÇÃO: SOLICITAÇÕES DE ACESSO */}
                            {pendingAccessRequests.length > 0 && (
                                <div className="p-4 border-b border-gray-50">
                                    <h4 className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-3 px-2">Acesso Pendente ({pendingAccessRequests.length})</h4>
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
                                                    <p className="text-[9px] font-bold text-gray-400 uppercase truncate">Loja {store.number}</p>
                                                </div>
                                                <ChevronRight size={14} className="text-gray-300 group-hover:text-blue-600" />
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* SEÇÃO: TAREFAS DA AGENDA */}
                            {pendingTasks.length > 0 && (
                                <div className="p-4">
                                    <h4 className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-3 px-2">Agenda ({pendingTasks.length})</h4>
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
                                    </div>
                                </div>
                            )}

                            {totalNotifications === 0 && (
                                <div className="p-10 text-center">
                                    <CheckCircle size={32} className="mx-auto text-gray-200 mb-3" />
                                    <p className="text-[10px] font-black text-gray-400 uppercase">Tudo em dia!</p>
                                </div>
                            )}
                        </div>

                        <div className="p-4 bg-gray-50/50 border-t border-gray-50">
                            <button 
                                onClick={() => setIsOpen(false)}
                                className="w-full py-3 bg-white border border-gray-200 rounded-2xl text-[9px] font-black text-gray-400 uppercase hover:text-blue-600 hover:border-blue-200 transition-all"
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