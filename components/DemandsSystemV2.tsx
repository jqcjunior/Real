import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
    Store, 
    User as UserType, 
    AdminUser,
    DemandV2, 
    DemandMessageV2, 
    DemandAttachmentV2, 
    DemandV2Priority, 
    DemandV2Status 
} from '../types';
import { supabase } from '../services/supabaseClient';
import { ensureSession } from '../services/authService';
import { 
    Search, 
    Plus, 
    MessageSquare, 
    Paperclip, 
    Clock, 
    CheckCircle2, 
    AlertCircle, 
    Pause, 
    Play, 
    XCircle, 
    ChevronRight, 
    Store as StoreIcon, 
    User, 
    Send, 
    Image as ImageIcon, 
    File as FileIcon,
    History,
    BarChart3,
    Bell,
    Filter,
    MoreVertical,
    Download,
    Archive,
    Trash2,
    Loader2,
    Camera,
    Lock,
    Users
} from 'lucide-react';
import imageCompression from 'browser-image-compression';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface DemandsSystemV2Props {
    user: UserType;
    stores: Store[];
}

const DemandsSystemV2: React.FC<DemandsSystemV2Props> = ({ user, stores }) => {
    // States
    const [selectedStoreId, setSelectedStoreId] = useState<string | null>(user.role === 'ADMIN' ? null : user.storeId || null);
    const [demands, setDemands] = useState<DemandV2[]>([]);
    const [selectedDemand, setSelectedDemand] = useState<DemandV2 | null>(null);
    const [messages, setMessages] = useState<DemandMessageV2[]>([]);
    const [activeTab, setActiveTab] = useState<'abertas' | 'pausadas' | 'resolvidas'>('abertas');
    const [isLoading, setIsLoading] = useState(false);
    const [isSending, setIsSending] = useState(false);
    const [newMessage, setNewMessage] = useState('');
    const [showNewDemandModal, setShowNewDemandModal] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [storeCounts, setStoreCounts] = useState<Record<string, { total: number, urgent: number, unread: number }>>({});
    const [stats, setStats] = useState({
        resolved: 0,
        paused: 0,
        avgTime: '0h'
    });
    const [storeUsers, setStoreUsers] = useState<AdminUser[]>([]);
    const [selectedTargetUser, setSelectedTargetUser] = useState<string | null>(null);
    const [showTargetUserModal, setShowTargetUserModal] = useState(false);

    // 🔧 FIX: CONFIGURAR SESSÃO CUSTOMIZADA
    useEffect(() => {
        const setupUserSession = async () => {
            try {
                await supabase.rpc('set_user_session', { 
                    user_id: user.id 
                });
                console.log('✅ Sessão configurada:', user.id);
            } catch (error) {
                console.error('❌ Erro ao configurar sessão:', error);
            }
        };
        setupUserSession();
    }, [user.id]);
    
    // Mobile States
    const [mobileView, setMobileView] = useState<'list' | 'chat'>('list');
    const [showMobileMenu, setShowMobileMenu] = useState(false);

    // Refs
    const messageEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Filtered Stores
    const filteredStores = useMemo(() => {
        if (user.role !== 'ADMIN') {
            return stores.filter(s => s.id === user.storeId);
        }
        return stores.filter(s => 
            s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
            s.number.includes(searchTerm)
        ).sort((a, b) => Number(a.number) - Number(b.number));
    }, [stores, searchTerm, user]);

    // Load Store Counts com nova RPC
    const loadStoreCounts = async () => {
        try {
            await ensureSession();
            const { data, error } = await supabase.rpc('fn_get_store_demand_counts');

            if (error) throw error;

            const counts: Record<string, { total: number, urgent: number, unread: number }> = {};
            data?.forEach((d: any) => {
                counts[d.store_id] = {
                    total: d.total_open || 0,
                    urgent: d.urgent_count || 0,
                    unread: d.unread_messages || 0
                };
            });
            setStoreCounts(counts);
        } catch (err) {
            console.error("Erro ao carregar contadores:", err);
        }
    };

    const calculateStats = async () => {
        try {
            await ensureSession();
            const { data, error } = await supabase
                .from('demands_v2')
                .select('*')
                .eq('is_archived', false);

            if (error) throw error;

            const resolved = data.filter(d => d.status === 'resolvida').length;
            const paused = data.filter(d => d.status === 'pausada').length;

            const resolvedDemands = data.filter(d => d.status === 'resolvida' && d.resolution_time_minutes);
            const totalMinutes = resolvedDemands.reduce((acc, curr) => acc + curr.resolution_time_minutes, 0);
            const avg = resolvedDemands.length > 0 ? (totalMinutes / resolvedDemands.length / 60).toFixed(1) : 0;

            setStats({ resolved, paused, avgTime: `${avg}h` });
        } catch (err) {
            console.error("Erro ao calcular estatísticas:", err);
        }
    };

    const loadStoreUsers = async (storeId: string) => {
        try {
            await ensureSession();
            const { data, error } = await supabase
                .from('admin_users')
                .select('*')
                .eq('store_id', storeId)
                .eq('status', 'active')
                .order('name');
            
            if (error) throw error;
            if (data) setStoreUsers(data);
        } catch (err) {
            console.error("Erro ao carregar usuários da loja:", err);
        }
    };

    // Load Demands
    const loadDemands = async (storeId: string | null) => {
        setIsLoading(true);
        try {
            await ensureSession();
            
            // @ts-ignore
            const currentUserId = user.user_id || user.id;
            // @ts-ignore
            const userRole = (user.role_level || user.role)?.toUpperCase();

            let query = supabase
                .from('demands_v2')
                .select('*')
                .eq('is_archived', false);

            if (storeId) {
                query = query.eq('store_id', storeId);
            }

            if (userRole === 'ADMIN' || userRole === 'TÉCNICO') {
                console.log(`Visão TOTAL: Admin/Técnico`);
            } 
            else {
                // @ts-ignore
                const userStoreId = user.store_id || user.storeId;
                if (userStoreId) {
                    query = query.eq('store_id', userStoreId);
                }
                console.log(`Visão RESTRITA (Loja: ${userStoreId})`);
            }

            if (activeTab === 'abertas') {
                query = query.in('status', ['aberta', 'em_andamento']);
            } else if (activeTab === 'pausadas') {
                query = query.eq('status', 'pausada');
            } else {
                query = query.in('status', ['resolvida', 'cancelada']);
            }

            const { data, error } = await query.order('created_at', { ascending: false });
            
            if (error) throw error;
            setDemands(data || []);
        } catch (err) {
            console.error("Erro ao carregar demandas:", err);
        } finally {
            setIsLoading(false);
        }
    };

    // Load Messages (agora com filtro de privacidade automático pelo RLS)
    const loadMessages = async (demandId: string) => {
        try {
            await ensureSession();
            const { data: msgs, error: msgsError } = await supabase
                .from('demands_messages_v2')
                .select('*')
                .eq('demand_id', demandId)
                .order('created_at', { ascending: true });

            if (msgsError) throw msgsError;

            const { data: atts, error: attsError } = await supabase
                .from('demands_attachments_v2')
                .select('*')
                .eq('demand_id', demandId);

            if (attsError) throw attsError;

            const messagesWithAttachments = msgs.map(m => ({
                ...m,
                attachments: atts?.filter(a => a.message_id === m.id) || []
            }));

            setMessages(messagesWithAttachments);
            
            if (user.role === 'ADMIN') {
                await supabase.from('demands_v2').update({ unread_count: 0 }).eq('id', demandId);
                loadStoreCounts();
            }
        } catch (err) {
            console.error("Erro ao carregar mensagens:", err);
        }
    };

    // 🔧 FIX: REALTIME - ATUALIZAÇÃO AUTOMÁTICA
    useEffect(() => {
        console.log('📡 Configurando Realtime...');

        // Canal para chamados
        const demandsChannel = supabase
            .channel('demands-realtime-v2')
            .on('postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'demands_v2'
                },
                (payload) => {
                    console.log('🆕 NOVO CHAMADO:', payload.new);
                    // @ts-ignore
                    setDemands(prev => [payload.new, ...prev]);
                    loadStoreCounts(); // Atualiza contadores
                }
            )
            .on('postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'demands_v2'
                },
                (payload) => {
                    console.log('🔄 CHAMADO ATUALIZADO:', payload.new);
                    // @ts-ignore
                    setDemands(prev => 
                        prev.map(d => d.id === payload.new.id ? payload.new : d)
                    );
                    if (selectedDemand?.id === payload.new.id) {
                        // @ts-ignore
                        setSelectedDemand(payload.new);
                    }
                    loadStoreCounts();
                }
            )
            .subscribe((status) => {
                console.log('📡 Status Realtime (demands):', status);
            });

        // Canal para mensagens
        const messagesChannel = supabase
            .channel('messages-realtime-v2')
            .on('postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'demands_messages_v2'
                },
                (payload) => {
                    console.log('💬 NOVA MENSAGEM:', payload.new);
                    if (selectedDemand?.id === payload.new.demand_id) {
                        // @ts-ignore
                        setMessages(prev => [...prev, payload.new]);
                    }
                    loadStoreCounts();
                }
            )
            .subscribe((status) => {
                console.log('📡 Status Realtime (messages):', status);
            });

        return () => {
            supabase.removeChannel(demandsChannel);
            supabase.removeChannel(messagesChannel);
        };
    }, [selectedDemand]);

    // Effects
    useEffect(() => {
        loadStoreCounts();
        calculateStats();
    }, []);

    useEffect(() => {
        loadDemands(selectedStoreId);
    }, [selectedStoreId, activeTab]);

    useEffect(() => {
        if (selectedDemand) {
            loadMessages(selectedDemand.id);
            // Mudar para view de chat no mobile quando selecionar demanda
            setMobileView('chat');
        }
    }, [selectedDemand]);

    useEffect(() => {
        messageEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    useEffect(() => {
        if (selectedStoreId) {
            loadStoreUsers(selectedStoreId);
        }
    }, [selectedStoreId]);

    // 🔧 FIX: ALERTAS SLA
    const slaAlerts = useMemo(() => {
        const now = new Date();
        
        return demands
            .filter(d => d.status !== 'resolvida' && d.status !== 'cancelada')
            .map(demand => {
                const createdAt = new Date(demand.created_at);
                const hoursElapsed = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);
                
                let slaStatus: 'ok' | 'warning' | 'critical' = 'ok';
                let slaMessage = '';
                
                // SLA por prioridade
                if (demand.priority === 'urgente') {
                    if (hoursElapsed > 4) {
                        slaStatus = 'critical';
                        slaMessage = `🔴 CRÍTICO: ${Math.floor(hoursElapsed)}h sem resposta`;
                    } else if (hoursElapsed > 2) {
                        slaStatus = 'warning';
                        slaMessage = `🟡 Atenção: ${Math.floor(hoursElapsed)}h (SLA: 4h)`;
                    }
                } else if (demand.priority === 'alta') {
                    if (hoursElapsed > 24) {
                        slaStatus = 'critical';
                        slaMessage = `🔴 CRÍTICO: ${Math.floor(hoursElapsed / 24)}d sem resposta`;
                    } else if (hoursElapsed > 12) {
                        slaStatus = 'warning';
                        slaMessage = `🟡 Atenção: ${Math.floor(hoursElapsed)}h (SLA: 24h)`;
                    }
                } else {
                    if (hoursElapsed > 72) {
                        slaStatus = 'critical';
                        slaMessage = `🔴 CRÍTICO: ${Math.floor(hoursElapsed / 24)}d sem resposta`;
                    } else if (hoursElapsed > 48) {
                        slaStatus = 'warning';
                        slaMessage = `🟡 Atenção: ${Math.floor(hoursElapsed / 24)}d (SLA: 72h)`;
                    }
                }
                
                return { ...demand, slaStatus, slaMessage, hoursElapsed };
            })
            .filter(d => d.slaStatus !== 'ok')
            .slice(0, 5); // Top 5 alertas
    }, [demands]);

    // Handlers
    const handleAssign = async (assignedToId: string) => {
        if (!selectedDemand) return;

        try {
            await ensureSession();
            
            // @ts-ignore
            const currentUserId = user.user_id || user.id;
            // @ts-ignore
            const currentUserName = user.name || user.nome;
            // @ts-ignore
            const currentUserRole = user.role_level || user.role || 'COLABORADOR';

            const { data, error } = await supabase.rpc('fn_assign_demand_v2', {
                p_demand_id: selectedDemand.id,
                p_assigned_to: assignedToId,
                p_user_id: currentUserId,
                p_user_name: currentUserName,
                p_user_role: currentUserRole
            });

            if (error || !data.success) throw error || new Error(data.error);

            setSelectedDemand({ ...selectedDemand, assigned_to: assignedToId });
            loadMessages(selectedDemand.id);
        } catch (err) {
            console.error("Erro ao atribuir demanda:", err);
            alert("Erro ao direcionar o chamado.");
        }
    };

    const handleSendMessage = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!newMessage.trim() || !selectedDemand || isSending) return;

        setIsSending(true);
        try {
            await ensureSession();
            
            // @ts-ignore
            const currentUserId = user.user_id || user.id;
            // @ts-ignore
            const currentUserName = user.name || user.nome;
            // @ts-ignore
            const currentUserRole = user.role_level || user.role || 'COLABORADOR';

            // Usar nova RPC com controle de privacidade
            const { data, error } = await supabase.rpc('fn_send_demand_message_v2', {
                p_demand_id: selectedDemand.id,
                p_sender_id: currentUserId,
                p_sender_name: currentUserName,
                p_sender_role: currentUserRole,
                p_message: newMessage.trim(),
                p_message_type: 'comment',
                p_target_user_id: selectedTargetUser // Para mensagens direcionadas de admin
            });

            if (error || !data.success) throw error || new Error(data.error);

            setNewMessage('');
            setSelectedTargetUser(null);
            loadMessages(selectedDemand.id);
            loadStoreCounts();
        } catch (err) {
            console.error("Erro ao enviar mensagem:", err);
            alert("Erro ao enviar mensagem.");
        } finally {
            setIsSending(false);
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !selectedDemand || isSending) return;

        setIsSending(true);
        try {
            await ensureSession();
            let finalFile = file;
            let isCompressed = false;
            let originalSize = file.size;

            if (file.type.startsWith('image/')) {
                const options = {
                    maxSizeMB: 0.5,
                    maxWidthOrHeight: 1920,
                    useWebWorker: true,
                    fileType: 'image/jpeg'
                };
                finalFile = await imageCompression(file, options);
                isCompressed = true;
            }

            const fileExt = file.name.split('.').pop();
            const fileName = `${Math.random()}.${fileExt}`;
            const filePath = `demands/${selectedDemand.id}/${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('attachments')
                .upload(filePath, finalFile);

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('attachments')
                .getPublicUrl(filePath);

            // @ts-ignore
            const currentUserId = user.user_id || user.id;
            // @ts-ignore
            const currentUserName = user.name || user.nome;
            // @ts-ignore
            const currentUserRole = user.role_level || user.role || 'COLABORADOR';

            // Usar nova RPC para enviar mensagem de anexo
            const { data: msgData, error: msgError } = await supabase.rpc('fn_send_demand_message_v2', {
                p_demand_id: selectedDemand.id,
                p_sender_id: currentUserId,
                p_sender_name: currentUserName,
                p_sender_role: currentUserRole,
                p_message: `Anexou um arquivo: ${file.name}`,
                p_message_type: 'comment',
                p_target_user_id: selectedTargetUser
            });

            if (msgError || !msgData.success) throw msgError || new Error(msgData.error);

            // Buscar o ID da mensagem criada
            const { data: lastMsg } = await supabase
                .from('demands_messages_v2')
                .select('id')
                .eq('demand_id', selectedDemand.id)
                .order('created_at', { ascending: false })
                .limit(1)
                .single();

            if (!lastMsg) throw new Error('Mensagem não encontrada');

            const { error: attError } = await supabase.from('demands_attachments_v2').insert([{
                demand_id: selectedDemand.id,
                message_id: lastMsg.id,
                file_name: file.name,
                file_url: publicUrl,
                file_size: finalFile.size,
                file_type: file.type,
                is_compressed: isCompressed,
                original_size: originalSize,
                compression_ratio: Number((finalFile.size / originalSize).toFixed(2)),
                uploaded_from_mobile: /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
            }]);

            if (attError) throw attError;

            setSelectedTargetUser(null);
            loadMessages(selectedDemand.id);
        } catch (err) {
            console.error("Erro no upload:", err);
            alert("Erro ao enviar arquivo.");
        } finally {
            setIsSending(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleStatusChange = async (newStatus: DemandV2Status) => {
        if (!selectedDemand) return;

        // @ts-ignore
        const currentUserId = user.user_id || user.id;
        // @ts-ignore
        const currentUserName = user.name || user.nome;
        // @ts-ignore
        const currentUserRole = user.role_level || user.role || 'COLABORADOR';

        if (newStatus === 'resolvida') {
            try {
                await ensureSession();
                
                const { data, error } = await supabase.rpc('fn_resolve_demand_v2', {
                    p_demand_id: selectedDemand.id,
                    p_user_id: currentUserId,
                    p_user_name: currentUserName,
                    p_user_role: currentUserRole
                });

                if (error || !data.success) throw error || new Error(data.error);

                if (data.success) {
                    setSelectedDemand(null); 
                    
                    await Promise.all([
                        loadDemands(selectedStoreId),
                        loadStoreCounts(),
                        calculateStats()
                    ]);
                }
            } catch (err) {
                console.error("Erro ao resolver demanda:", err);
                alert("Erro ao finalizar o chamado.");
            }
            return;
        }

        try {
            await ensureSession();
            const { error } = await supabase
                .from('demands_v2')
                .update({ 
                    status: newStatus,
                    updated_at: new Date().toISOString(),
                    resolved_at: null,
                    resolved_by: null,
                    paused_at: newStatus === 'pausada' ? new Date().toISOString() : null
                })
                .eq('id', selectedDemand.id);

            if (error) throw error;

            await supabase.from('demands_messages_v2').insert([{
                demand_id: selectedDemand.id,
                sender_id: currentUserId,
                sender_name: currentUserName,
                sender_role: currentUserRole,
                message: `Alterou o status para: ${newStatus.toUpperCase()}`,
                message_type: 'status_change'
            }]);

            setSelectedDemand({ ...selectedDemand, status: newStatus });
            loadDemands(selectedStoreId);
            loadMessages(selectedDemand.id);
            calculateStats();
        } catch (err) {
            console.error("Erro ao mudar status:", err);
        }
    };

    // Render Helpers
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

    return (
        <div className="flex flex-col h-[calc(100vh-120px)] lg:h-[calc(100vh-120px)] bg-slate-50 dark:bg-slate-950 rounded-3xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-2xl">
            {/* Header - Responsivo */}
            <div className="bg-white dark:bg-slate-900 p-3 lg:p-6 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row justify-between items-center gap-3 lg:gap-4">
                <div className="flex items-center gap-3 lg:gap-4 w-full lg:w-auto">
                    <div className="p-2 lg:p-3 bg-blue-600 rounded-xl lg:rounded-2xl shadow-lg shadow-blue-900/20">
                        <MessageSquare className="text-white" size={20} />
                    </div>
                    <div className="flex-1 lg:flex-none">
                        <h2 className="text-base lg:text-xl font-black text-slate-900 dark:text-white uppercase italic tracking-tighter">
                            Central de Chamados <span className="text-blue-600">V2.0</span>
                        </h2>
                        <p className="text-[9px] lg:text-[10px] font-bold text-slate-400 uppercase tracking-widest hidden sm:block">
                            Sistema com Privacidade por Hierarquia
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2 lg:gap-3 w-full sm:w-auto">
                    {/* Mobile: Botão voltar quando estiver no chat */}
                    {mobileView === 'chat' && (
                        <button 
                            onClick={() => {
                                setMobileView('list');
                                setSelectedDemand(null);
                            }}
                            className="lg:hidden p-2 bg-slate-100 dark:bg-slate-800 text-slate-600 rounded-xl active:scale-95 transition-all"
                        >
                            <ChevronRight size={20} className="rotate-180" />
                        </button>
                    )}
                    
                    <div className="relative flex-1 sm:w-48 lg:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input 
                            type="text" 
                            placeholder="Buscar..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 lg:py-2.5 bg-slate-100 dark:bg-slate-800 border-none rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                        />
                    </div>
                    <button 
                        onClick={() => setShowNewDemandModal(true)}
                        className="p-2 lg:p-2.5 bg-blue-600 text-white rounded-xl shadow-lg hover:bg-blue-700 transition-all active:scale-95"
                    >
                        <Plus size={20} />
                    </button>
                </div>
            </div>

            {/* 🚨 ALERTAS SLA */}
            {slaAlerts.length > 0 && (
                <div className="bg-gradient-to-r from-red-50 to-orange-50 dark:from-red-950/20 dark:to-orange-950/20 border-b border-red-200 dark:border-red-900/30 p-4 overflow-y-auto no-scrollbar max-h-48">
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                            <AlertCircle className="text-red-600 animate-pulse" size={20} />
                            <h3 className="text-xs font-black uppercase text-red-900 dark:text-red-100 tracking-widest">
                                Alertas SLA ({slaAlerts.length})
                            </h3>
                        </div>
                    </div>
                    <div className="space-y-2">
                        {slaAlerts.map(alert => (
                            <button
                                key={alert.id}
                                onClick={() => {
                                    setSelectedDemand(alert);
                                    if (window.innerWidth < 1024) setMobileView('chat');
                                }}
                                className={`
                                    w-full p-3 rounded-xl border-2 transition-all text-left
                                    ${alert.slaStatus === 'critical' 
                                        ? 'bg-red-100 dark:bg-red-900/20 border-red-500 hover:bg-red-200' 
                                        : 'bg-amber-100 dark:bg-amber-900/20 border-amber-500 hover:bg-amber-200'
                                    }
                                `}
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3 flex-1">
                                        <Clock 
                                            size={18} 
                                            className={alert.slaStatus === 'critical' ? 'text-red-600' : 'text-amber-600'}
                                        />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs font-black text-slate-900 dark:text-white uppercase truncate">
                                                {alert.ticket_number} - {alert.title}
                                            </p>
                                            <p className={`text-[10px] font-black uppercase ${
                                                alert.slaStatus === 'critical' ? 'text-red-600' : 'text-amber-600'
                                            }`}>
                                                {alert.slaMessage}
                                            </p>
                                        </div>
                                    </div>
                                    {getPriorityBadge(alert.priority)}
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Mobile Layout */}
            <div className="flex-1 flex lg:hidden flex-col overflow-hidden">
                {/* Mobile: Lista de Chamados */}
                {mobileView === 'list' && (
                    <div className="flex-1 flex flex-col overflow-hidden">
                        {/* Tabs */}
                        <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md p-2 border-b border-slate-200 dark:border-slate-800 flex gap-1">
                            {(['abertas', 'pausadas', 'resolvidas'] as const).map(tab => (
                                <button
                                    key={tab}
                                    onClick={() => setActiveTab(tab)}
                                    className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === tab ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                                >
                                    {tab}
                                </button>
                            ))}
                        </div>

                        {/* Lista de Demandas */}
                        <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-slate-50/50 dark:bg-slate-950/50">
                            {isLoading ? (
                                <div className="flex flex-col items-center justify-center py-20 gap-4">
                                    <Loader2 className="animate-spin text-blue-600" size={32} />
                                    <p className="text-xs font-black text-slate-400 uppercase">Carregando...</p>
                                </div>
                            ) : demands.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-20 text-center px-4">
                                    <div className="p-4 bg-slate-100 dark:bg-slate-800 rounded-full mb-4">
                                        <Filter className="text-slate-300" size={32} />
                                    </div>
                                    <p className="text-xs font-black text-slate-400 uppercase">Nenhuma demanda encontrada</p>
                                </div>
                            ) : (
                                demands.map(demand => (
                                    <button
                                        key={demand.id}
                                        onClick={() => setSelectedDemand(demand)}
                                        className="w-full p-4 rounded-2xl border bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-blue-200 dark:hover:border-blue-800 transition-all text-left relative overflow-hidden active:scale-98"
                                    >
                                        {demand.unread_count > 0 && (
                                            <div className="absolute top-2 right-2 w-6 h-6 bg-blue-600 flex items-center justify-center rounded-full shadow-lg">
                                                <span className="text-[10px] font-black text-white">{demand.unread_count}</span>
                                            </div>
                                        )}
                                        
                                        <div className="flex justify-between items-start mb-2">
                                            <span className="text-[10px] font-black text-blue-600 dark:text-blue-400 font-mono">{demand.ticket_number}</span>
                                            {getPriorityBadge(demand.priority)}
                                        </div>
                                        
                                        <h4 className="text-sm font-black text-slate-900 dark:text-white uppercase mb-1 line-clamp-1">{demand.title}</h4>
                                        <p className="text-xs font-medium text-slate-400 line-clamp-2 mb-3">{demand.description}</p>
                                        
                                        <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
                                            <div className="flex items-center gap-2">
                                                {getStatusIcon(demand.status)}
                                                <span className="text-[9px] font-black uppercase text-slate-500">{demand.status.replace('_', ' ')}</span>
                                            </div>
                                            <span className="text-[9px] font-bold text-slate-300 uppercase">{formatDistanceToNow(new Date(demand.created_at), { addSuffix: true, locale: ptBR })}</span>
                                        </div>
                                    </button>
                                ))
                            )}
                        </div>
                    </div>
                )}

                {/* Mobile: Chat */}
                {mobileView === 'chat' && selectedDemand && (
                    <div className="flex-1 flex flex-col overflow-hidden bg-white dark:bg-slate-900">
                        {/* Header do Chamado */}
                        <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-950/30">
                            <div className="flex justify-between items-start mb-3">
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                                        <span className="text-[10px] font-black text-blue-600 font-mono">{selectedDemand.ticket_number}</span>
                                        {getPriorityBadge(selectedDemand.priority)}
                                        <div className="flex items-center gap-1.5 px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded-full">
                                            {getStatusIcon(selectedDemand.status)}
                                            <span className="text-[8px] font-black uppercase text-slate-600 dark:text-slate-400">{selectedDemand.status.replace('_', ' ')}</span>
                                        </div>
                                    </div>
                                    <h3 className="text-base font-black text-slate-900 dark:text-white uppercase italic leading-tight">{selectedDemand.title}</h3>
                                </div>
                                
                                {/* Botões de ação mobile */}
                                {user.role === 'ADMIN' && (
                                    <div className="flex gap-1">
                                        {selectedDemand.status !== 'resolvida' && (
                                            <button 
                                                onClick={() => handleStatusChange('resolvida')}
                                                className="p-2 bg-emerald-100 text-emerald-600 rounded-lg hover:bg-emerald-200 transition-all active:scale-95"
                                                title="Resolver"
                                            >
                                                <CheckCircle2 size={16} />
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                            <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                                <p className="text-xs font-medium text-slate-600 dark:text-slate-400 leading-relaxed">{selectedDemand.description}</p>
                            </div>
                        </div>

                        {/* Mensagens */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50 dark:bg-slate-950">
                            {messages.map((msg) => {
                                // @ts-ignore
                                const isMe = msg.sender_id === (user.user_id || user.id);
                                const isSystem = msg.message_type === 'status_change' || msg.message_type === 'assignment';
                                
                                if (isSystem) {
                                    return (
                                        <div key={msg.id} className="flex justify-center">
                                            <div className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-full border border-slate-200 dark:border-slate-700">
                                                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{msg.message}</p>
                                            </div>
                                        </div>
                                    );
                                }

                                return (
                                    <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                                        <div className={`max-w-[85%] flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                                            <div className="flex items-center gap-2 mb-1 px-1">
                                                <span className="text-[9px] font-black text-slate-400 uppercase">{msg.sender_name}</span>
                                                <span className="text-[8px] font-bold text-slate-300">{format(new Date(msg.created_at), 'HH:mm')}</span>
                                            </div>
                                            <div className={`p-3 rounded-2xl shadow-sm ${isMe ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-tl-none border border-slate-200 dark:border-slate-700'}`}>
                                                <p className="text-xs font-medium leading-relaxed">{msg.message}</p>
                                                
                                                {msg.attachments && msg.attachments.length > 0 && (
                                                    <div className="mt-2 space-y-2">
                                                        {msg.attachments.map(att => (
                                                            <a 
                                                                key={att.id}
                                                                href={att.file_url}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className={`flex items-center gap-2 p-2 rounded-xl border transition-all ${isMe ? 'bg-blue-700/50 border-blue-500/30' : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700'}`}
                                                            >
                                                                <div className={`p-2 rounded-lg ${isMe ? 'bg-blue-500' : 'bg-blue-50 dark:bg-blue-900/30 text-blue-600'}`}>
                                                                    {att.file_type.startsWith('image/') ? <ImageIcon size={14} /> : <FileIcon size={14} />}
                                                                </div>
                                                                <div className="flex-1 min-w-0">
                                                                    <p className={`text-[10px] font-black uppercase truncate ${isMe ? 'text-white' : 'text-slate-700 dark:text-slate-300'}`}>{att.file_name}</p>
                                                                    <p className={`text-[8px] font-bold ${isMe ? 'text-blue-200' : 'text-slate-400'}`}>{(att.file_size / 1024).toFixed(0)} KB</p>
                                                                </div>
                                                            </a>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                            <div ref={messageEndRef} />
                        </div>

                        {/* Input Mobile */}
                        <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 safe-bottom">
                            <form onSubmit={handleSendMessage} className="flex items-center gap-2">
                                <input 
                                    type="file" 
                                    ref={fileInputRef} 
                                    onChange={handleFileUpload} 
                                    className="hidden" 
                                    accept="image/*,application/pdf"
                                />
                                <button 
                                    type="button"
                                    onClick={() => {
                                        if (fileInputRef.current) {
                                            fileInputRef.current.setAttribute('capture', 'environment');
                                            fileInputRef.current.click();
                                        }
                                    }}
                                    className="p-2.5 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-xl hover:bg-blue-50 hover:text-blue-600 transition-all active:scale-95"
                                >
                                    <Camera size={20} />
                                </button>
                                <button 
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    className="p-2.5 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-xl hover:bg-blue-50 hover:text-blue-600 transition-all active:scale-95"
                                >
                                    <Paperclip size={20} />
                                </button>
                                <input 
                                    type="text" 
                                    value={newMessage}
                                    onChange={(e) => setNewMessage(e.target.value)}
                                    placeholder="Digite sua mensagem..."
                                    className="flex-1 px-4 py-2.5 bg-slate-100 dark:bg-slate-800 border-none rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                                />
                                <button 
                                    type="submit"
                                    disabled={!newMessage.trim() || isSending}
                                    className="p-2.5 bg-blue-600 text-white rounded-xl shadow-lg shadow-blue-900/20 hover:bg-blue-700 transition-all active:scale-95 disabled:opacity-50"
                                >
                                    {isSending ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
                                </button>
                            </form>
                        </div>
                    </div>
                )}
            </div>

            {/* Desktop Layout */}
            <div className="flex-1 hidden lg:flex overflow-hidden">
                {/* Coluna 1: Lojas (20%) */}
                <div className="w-[20%] border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-y-auto no-scrollbar hidden lg:block">
                    <div className="p-4 space-y-2">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Unidades</p>
                        {filteredStores.map(store => {
                            const count = storeCounts[store.id] || { total: 0, urgent: 0, unread: 0 };
                            const isSelected = selectedStoreId === store.id;
                            
                            // Semáforo por Grau de Demanda
                            let statusColor = "bg-slate-100 dark:bg-slate-800 text-slate-400";
                            if (count.urgent > 0) statusColor = "bg-red-500 text-white animate-pulse";
                            else if (count.total > 5) statusColor = "bg-orange-500 text-white";
                            else if (count.total > 0) statusColor = "bg-emerald-500 text-white";

                            return (
                                <button
                                    key={store.id}
                                    onClick={() => setSelectedStoreId(store.id)}
                                    className={`w-full p-3 rounded-2xl flex items-center gap-3 transition-all group relative ${isSelected ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-100 dark:border-blue-800' : 'hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                                >
                                    {/* Badge de mensagens não lidas */}
                                    {count.unread > 0 && (
                                        <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-600 rounded-full flex items-center justify-center animate-bounce">
                                            <span className="text-[9px] font-black text-white">{count.unread > 9 ? '9+' : count.unread}</span>
                                        </div>
                                    )}
                                    
                                    {/* Ícone com cor dinâmica */}
                                    <div className={`p-2 rounded-xl transition-colors ${statusColor}`}>
                                        <StoreIcon size={18} />
                                    </div>
                                    
                                    <div className="flex-1 text-left">
                                        <p className={`text-[11px] font-black uppercase ${isSelected ? 'text-blue-900 dark:text-blue-100' : 'text-slate-600 dark:text-slate-400'}`}>
                                            Loja {store.number}
                                        </p>
                                        <p className="text-[9px] font-bold text-slate-400 truncate">{store.city}</p>
                                    </div>

                                    {/* Quantidade de Demandas */}
                                    {count.total > 0 && (
                                        <div className="flex flex-col items-end gap-1">
                                            <span className={`px-1.5 py-0.5 text-[8px] font-black rounded-md ${count.urgent > 0 ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>
                                                {count.total}
                                            </span>
                                            {count.urgent > 0 && (
                                                <span className="text-[7px] font-black text-red-500 uppercase">Urgente</span>
                                            )}
                                        </div>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Coluna 2: Lista de Chamados (20%) */}
                <div className="w-full lg:w-[20%] border-r border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 overflow-y-auto no-scrollbar">
                    {/* Tabs */}
                    <div className="sticky top-0 z-10 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md p-2 border-b border-slate-200 dark:border-slate-800 flex gap-1">
                        {(['abertas', 'pausadas', 'resolvidas'] as const).map(tab => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`flex-1 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${activeTab === tab ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                            >
                                {tab}
                            </button>
                        ))}
                    </div>

                    <div className="p-3 space-y-3">
                        {isLoading ? (
                            <div className="flex flex-col items-center justify-center py-20 gap-4">
                                <Loader2 className="animate-spin text-blue-600" size={32} />
                                <p className="text-[10px] font-black text-slate-400 uppercase">Carregando...</p>
                            </div>
                        ) : demands.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-20 text-center px-4">
                                <div className="p-4 bg-slate-100 dark:bg-slate-800 rounded-full mb-4">
                                    <Filter className="text-slate-300" size={32} />
                                </div>
                                <p className="text-[10px] font-black text-slate-400 uppercase">Nenhuma demanda encontrada</p>
                            </div>
                        ) : (
                            demands.map(demand => (
                                <button
                                    key={demand.id}
                                    onClick={() => setSelectedDemand(demand)}
                                    className={`w-full p-4 rounded-2xl border transition-all text-left group relative overflow-hidden ${selectedDemand?.id === demand.id ? 'bg-white dark:bg-slate-900 border-blue-200 dark:border-blue-800 shadow-xl' : 'bg-white/50 dark:bg-slate-900/50 border-transparent hover:border-slate-200 dark:hover:border-slate-800'}`}
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
                                    <p className="text-[10px] font-medium text-slate-400 line-clamp-2 mb-3">{demand.description}</p>
                                    
                                    <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
                                        <div className="flex items-center gap-2">
                                            {getStatusIcon(demand.status)}
                                            <span className="text-[8px] font-black uppercase text-slate-500">{demand.status.replace('_', ' ')}</span>
                                        </div>
                                        <span className="text-[8px] font-bold text-slate-300 uppercase">{formatDistanceToNow(new Date(demand.created_at), { addSuffix: true, locale: ptBR })}</span>
                                    </div>
                                </button>
                            ))
                        )}
                    </div>
                </div>

                {/* Coluna 3: Detalhes e Chat (35%) */}
                <div className="flex-1 lg:w-[35%] flex flex-col bg-white dark:bg-slate-900 relative">
                    {selectedDemand ? (
                        <>
                            {/* Demand Header */}
                            <div className="p-4 sm:p-6 border-b border-slate-200 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-950/30">
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <div className="flex items-center gap-3 mb-2">
                                            <span className="text-xs font-black text-blue-600 font-mono tracking-tighter">{selectedDemand.ticket_number}</span>
                                            {getPriorityBadge(selectedDemand.priority)}
                                            <div className="flex items-center gap-1.5 px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded-full">
                                                {getStatusIcon(selectedDemand.status)}
                                                <span className="text-[9px] font-black uppercase text-slate-600 dark:text-slate-400">{selectedDemand.status.replace('_', ' ')}</span>
                                            </div>
                                        </div>
                                        <h3 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white uppercase italic leading-none">{selectedDemand.title}</h3>
                                    </div>
                                    <div className="flex gap-2">
                                        {user.role === 'ADMIN' && (
                                            <>
                                                {selectedDemand.status !== 'em_andamento' && selectedDemand.status !== 'resolvida' && (
                                                    <button 
                                                        onClick={() => handleStatusChange('em_andamento')}
                                                        className="p-2 bg-amber-100 text-amber-600 rounded-xl hover:bg-amber-200 transition-all"
                                                        title="Iniciar Atendimento"
                                                    >
                                                        <Play size={18} />
                                                    </button>
                                                )}
                                                {selectedDemand.status === 'em_andamento' && (
                                                    <button 
                                                        onClick={() => handleStatusChange('pausada')}
                                                        className="p-2 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition-all"
                                                        title="Pausar"
                                                    >
                                                        <Pause size={18} />
                                                    </button>
                                                )}
                                                {selectedDemand.status !== 'resolvida' && (
                                                    <button 
                                                        onClick={() => handleStatusChange('resolvida')}
                                                        className="p-2 bg-emerald-100 text-emerald-600 rounded-xl hover:bg-emerald-200 transition-all"
                                                        title="Resolver"
                                                    >
                                                        <CheckCircle2 size={18} />
                                                    </button>
                                                )}
                                            </>
                                        )}
                                    </div>
                                </div>
                                <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
                                    <p className="text-xs font-medium text-slate-600 dark:text-slate-400 leading-relaxed">{selectedDemand.description}</p>
                                </div>
                            </div>

                            {/* Messages Area */}
                            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 no-scrollbar">
                                {messages.map((msg, idx) => {
                                    // @ts-ignore
                                    const isMe = msg.sender_id === (user.user_id || user.id);
                                    const isSystem = msg.message_type === 'status_change' || msg.message_type === 'assignment';
                                    
                                    if (isSystem) {
                                        return (
                                            <div key={msg.id} className="flex justify-center">
                                                <div className="px-4 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-full border border-slate-200 dark:border-slate-700">
                                                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{msg.message}</p>
                                                </div>
                                            </div>
                                        );
                                    }

                                    return (
                                        <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                                            <div className={`max-w-[85%] sm:max-w-[70%] flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                                                <div className="flex items-center gap-2 mb-1 px-1">
                                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{msg.sender_name}</span>
                                                    <span className="text-[8px] font-bold text-slate-300">{format(new Date(msg.created_at), 'HH:mm')}</span>
                                                    {/* @ts-ignore */}
                                                    {msg.is_private && <Lock size={10} className="text-slate-400" />}
                                                </div>
                                                <div className={`p-4 rounded-2xl shadow-sm ${isMe ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white rounded-tl-none border border-slate-200 dark:border-slate-700'}`}>
                                                    <p className="text-xs font-medium leading-relaxed">{msg.message}</p>
                                                    
                                                    {msg.attachments && msg.attachments.length > 0 && (
                                                        <div className="mt-3 space-y-2">
                                                            {msg.attachments.map(att => (
                                                                <a 
                                                                    key={att.id}
                                                                    href={att.file_url}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className={`flex items-center gap-3 p-2 rounded-xl border transition-all ${isMe ? 'bg-blue-700/50 border-blue-500/30 hover:bg-blue-700' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 hover:border-blue-500'}`}
                                                                >
                                                                    <div className={`p-2 rounded-lg ${isMe ? 'bg-blue-500' : 'bg-blue-50 dark:bg-blue-900/30 text-blue-600'}`}>
                                                                        {att.file_type.startsWith('image/') ? <ImageIcon size={16} /> : <FileIcon size={16} />}
                                                                    </div>
                                                                    <div className="flex-1 min-w-0">
                                                                        <p className={`text-[10px] font-black uppercase truncate ${isMe ? 'text-white' : 'text-slate-700 dark:text-slate-300'}`}>{att.file_name}</p>
                                                                        <p className={`text-[8px] font-bold ${isMe ? 'text-blue-200' : 'text-slate-400'}`}>{(att.file_size / 1024).toFixed(0)} KB {att.is_compressed && '• Comprimido'}</p>
                                                                    </div>
                                                                    <Download size={14} className={isMe ? 'text-blue-200' : 'text-slate-400'} />
                                                                </a>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                                <div ref={messageEndRef} />
                            </div>

                            {/* Input Area */}
                            <div className="p-4 sm:p-6 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                                {/* Seletor de destinatário para Admin */}
                                {user.role === 'ADMIN' && selectedTargetUser && (
                                    <div className="mb-3 p-2 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-800 flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <Lock size={14} className="text-blue-600" />
                                            <span className="text-[10px] font-black text-blue-600 uppercase">Mensagem Privada para: {storeUsers.find(u => u.id === selectedTargetUser)?.name}</span>
                                        </div>
                                        <button onClick={() => setSelectedTargetUser(null)} className="text-blue-400 hover:text-blue-600">
                                            <XCircle size={16} />
                                        </button>
                                    </div>
                                )}
                                
                                <form onSubmit={handleSendMessage} className="flex items-center gap-3">
                                    <input 
                                        type="file" 
                                        ref={fileInputRef} 
                                        onChange={handleFileUpload} 
                                        className="hidden" 
                                        accept="image/*,application/pdf"
                                    />
                                    <button 
                                        type="button"
                                        onClick={() => fileInputRef.current?.click()}
                                        className="p-3 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-xl hover:bg-blue-50 hover:text-blue-600 transition-all active:scale-95"
                                    >
                                        <Paperclip size={20} />
                                    </button>
                                    <button 
                                        type="button"
                                        onClick={() => {
                                            if (fileInputRef.current) {
                                                fileInputRef.current.setAttribute('capture', 'environment');
                                                fileInputRef.current.click();
                                            }
                                        }}
                                        className="p-3 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-xl hover:bg-blue-50 hover:text-blue-600 transition-all active:scale-95 sm:hidden"
                                    >
                                        <Camera size={20} />
                                    </button>
                                    {/* Botão para Admin selecionar destinatário */}
                                    {user.role === 'ADMIN' && (
                                        <button 
                                            type="button"
                                            onClick={() => setShowTargetUserModal(true)}
                                            className={`p-3 rounded-xl transition-all active:scale-95 ${selectedTargetUser ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-blue-50 hover:text-blue-600'}`}
                                            title="Enviar mensagem privada"
                                        >
                                            {selectedTargetUser ? <Lock size={20} /> : <Users size={20} />}
                                        </button>
                                    )}
                                    <input 
                                        type="text" 
                                        value={newMessage}
                                        onChange={(e) => setNewMessage(e.target.value)}
                                        placeholder={selectedTargetUser ? "Mensagem privada..." : "Digite sua mensagem..."}
                                        className="flex-1 px-4 py-3 bg-slate-100 dark:bg-slate-800 border-none rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                                    />
                                    <button 
                                        type="submit"
                                        disabled={!newMessage.trim() || isSending}
                                        className="p-3 bg-blue-600 text-white rounded-2xl shadow-lg shadow-blue-900/20 hover:bg-blue-700 transition-all active:scale-95 disabled:opacity-50 disabled:scale-100"
                                    >
                                        {isSending ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
                                    </button>
                                </form>
                            </div>
                        </>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center p-10 text-center">
                            <div className="w-32 h-32 bg-slate-50 dark:bg-slate-800/50 rounded-full flex items-center justify-center mb-8 relative">
                                <div className="absolute inset-0 bg-blue-500/10 rounded-full animate-ping"></div>
                                <MessageSquare size={48} className="text-blue-200 dark:text-slate-700" />
                            </div>
                            <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase italic mb-2">Selecione um Chamado</h3>
                            <p className="text-xs font-medium text-slate-400 max-w-xs">Escolha uma ordem de serviço na lista ao lado para visualizar o histórico e interagir.</p>
                        </div>
                    )}
                </div>

                {/* Coluna 4: Direcionamento (10%) - Apenas para Admin */}
                {user.role === 'ADMIN' && selectedDemand && (
                    <div className="w-[10%] border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-y-auto no-scrollbar hidden lg:block">
                        <div className="p-3">
                            <div className="mb-4 sticky top-0 bg-white dark:bg-slate-900 pb-2">
                                <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Direcionar</h4>
                            </div>
                            
                            {storeUsers.length > 0 ? (
                                <div className="space-y-2">
                                    {storeUsers.map(u => (
                                        <button
                                            key={u.id}
                                            onClick={() => handleAssign(u.id)}
                                            className={`w-full flex flex-col items-center gap-1 p-2 rounded-xl border transition-all text-center ${
                                                selectedDemand?.assigned_to === u.id 
                                                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
                                                : 'border-slate-100 dark:border-slate-800 hover:border-blue-200 hover:bg-slate-50 dark:hover:bg-slate-800'
                                            }`}
                                        >
                                            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs ${
                                                selectedDemand?.assigned_to === u.id
                                                ? 'bg-blue-600 text-white'
                                                : 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                                            }`}>
                                                {u.name.substring(0, 2).toUpperCase()}
                                            </div>
                                            <div className="w-full">
                                                <p className="text-[9px] font-black text-slate-700 dark:text-slate-300 truncate leading-tight">{u.name}</p>
                                                <p className="text-[7px] font-bold text-slate-400 uppercase">{u.role_level}</p>
                                            </div>
                                            {selectedDemand?.assigned_to === u.id && (
                                                <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse"></div>
                                            )}
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
                    </div>
                )}

                {/* Coluna 5: Stats e Info (15%) */}
                <div className="w-[15%] bg-slate-50 dark:bg-slate-950 p-4 overflow-y-auto no-scrollbar hidden lg:block border-l border-slate-200 dark:border-slate-800">
                    <div className="space-y-6">
                        {/* Stats Summary */}
                        <div>
                            <div className="flex items-center gap-2 mb-4">
                                <BarChart3 className="text-blue-600" size={16} />
                                <h4 className="text-[9px] font-black text-slate-900 dark:text-white uppercase tracking-widest">Estatísticas</h4>
                            </div>
                            <div className="grid grid-cols-1 gap-3">
                                <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm">
                                    <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest mb-1">Resolvidas</p>
                                    <h5 className="text-xl font-black text-emerald-600 italic">{stats.resolved}</h5>
                                </div>
                                <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm">
                                    <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest mb-1">Pausadas</p>
                                    <h5 className="text-xl font-black text-amber-600 italic">{stats.paused}</h5>
                                </div>
                                <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm">
                                    <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest mb-1">Tempo Médio</p>
                                    <h5 className="text-xl font-black text-blue-600 italic">{stats.avgTime}</h5>
                                </div>
                            </div>
                        </div>

                        {/* SLA Alerts */}
                        <div>
                            <div className="flex items-center gap-2 mb-4">
                                <AlertCircle className="text-red-500" size={16} />
                                <h4 className="text-[9px] font-black text-slate-900 dark:text-white uppercase tracking-widest">Alertas SLA</h4>
                            </div>
                            <div className="space-y-2">
                                {slaAlerts.length > 0 ? slaAlerts.map(alert => {
                                    const isExpired = new Date(alert.sla_deadline!) < new Date();
                                    const timeLeft = formatDistanceToNow(new Date(alert.sla_deadline!), { locale: ptBR });
                                    
                                    return (
                                        <div key={alert.id} className={`p-2 rounded-lg border ${isExpired ? 'bg-red-50 dark:bg-red-900/10 border-red-100 dark:border-red-900/30' : 'bg-amber-50 dark:bg-amber-900/10 border-amber-100 dark:border-amber-900/30'}`}>
                                            <div className="flex justify-between items-center mb-1">
                                                <span className={`text-[8px] font-black uppercase ${isExpired ? 'text-red-600' : 'text-amber-600'}`}>{alert.ticket_number}</span>
                                                <span className={`text-[7px] font-bold ${isExpired ? 'text-red-400' : 'text-amber-400'}`}>
                                                    {isExpired ? 'EXPIRADO' : timeLeft}
                                                </span>
                                            </div>
                                            <p className="text-[9px] font-bold text-slate-600 dark:text-slate-400 truncate">{alert.title}</p>
                                        </div>
                                    );
                                }) : (
                                    <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl text-center border border-dashed border-slate-200 dark:border-slate-700">
                                        <p className="text-[8px] font-black text-slate-400 uppercase">Nenhum alerta</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Privacy Info */}
                        <div className="p-3 bg-blue-600 rounded-2xl text-white shadow-xl shadow-blue-900/20">
                            <Lock className="mb-2" size={20} />
                            <h5 className="text-[10px] font-black uppercase italic mb-1">Privacidade</h5>
                            <p className="text-[8px] font-medium leading-relaxed opacity-80">
                                Sistema com controle hierárquico de visibilidade de mensagens
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Modal de Seleção de Destinatário (Admin) */}
            {showTargetUserModal && user.role === 'ADMIN' && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
                    <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[40px] shadow-2xl overflow-hidden">
                        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                            <div>
                                <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase italic">Mensagem Privada</h3>
                                <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest">Selecione o Destinatário</p>
                            </div>
                            <button onClick={() => setShowTargetUserModal(false)} className="p-2 bg-slate-100 dark:bg-slate-800 rounded-full text-slate-400 hover:text-rose-500 transition-all">
                                <XCircle size={20} />
                            </button>
                        </div>
                        <div className="p-6 space-y-2 max-h-96 overflow-y-auto">
                            <button
                                onClick={() => {
                                    setSelectedTargetUser(null);
                                    setShowTargetUserModal(false);
                                }}
                                className={`w-full p-3 rounded-xl border transition-all ${!selectedTargetUser ? 'border-blue-500 bg-blue-50' : 'border-slate-100 hover:border-blue-200'}`}
                            >
                                <p className="text-sm font-black text-slate-700">Mensagem Pública (Todos veem)</p>
                            </button>
                            {storeUsers.map(u => (
                                <button
                                    key={u.id}
                                    onClick={() => {
                                        setSelectedTargetUser(u.id);
                                        setShowTargetUserModal(false);
                                    }}
                                    className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all ${selectedTargetUser === u.id ? 'border-blue-500 bg-blue-50' : 'border-slate-100 hover:border-blue-200'}`}
                                >
                                    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold">
                                        {u.name.substring(0, 2).toUpperCase()}
                                    </div>
                                    <div className="flex-1 text-left">
                                        <p className="text-sm font-black text-slate-700">{u.name}</p>
                                        <p className="text-xs font-bold text-slate-400 uppercase">{u.role_level}</p>
                                    </div>
                                    <Lock size={16} className="text-slate-400" />
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* New Demand Modal */}
            {showNewDemandModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
                    <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-[40px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
                        <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                            <div>
                                <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase italic">Novo Chamado</h3>
                                <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest">Abertura de Ordem de Serviço</p>
                            </div>
                            <button onClick={() => setShowNewDemandModal(false)} className="p-2 bg-slate-100 dark:bg-slate-800 rounded-full text-slate-400 hover:text-rose-500 transition-all">
                                <XCircle size={24} />
                            </button>
                        </div>
                        <form className="p-8 space-y-6" onSubmit={async (e) => {
                            e.preventDefault();
                            const formData = new FormData(e.currentTarget);
                            const title = formData.get('title') as string;
                            const description = formData.get('description') as string;
                            const priority = formData.get('priority') as DemandV2Priority;
                            const category = formData.get('category') as string;
                            const storeId = user.role === 'ADMIN' ? formData.get('store_id') as string : user.storeId;

                            if (!title || !description || !storeId) return;

                            setIsLoading(true);
                            try {
                                await ensureSession();
                                
                                // @ts-ignore
                                const currentUserId = user.user_id || user.id;
                                // @ts-ignore
                                const currentUserName = user.name || user.nome;
                                // @ts-ignore
                                const currentUserRole = user.role_level || user.role || 'COLABORADOR';

                                const { data, error } = await supabase.rpc('fn_create_demand_v2', {
                                    p_store_id: storeId,
                                    p_title: title,
                                    p_description: description,
                                    p_priority: priority,
                                    p_category: category,
                                    p_created_by: currentUserId,
                                    p_status: 'aberta'
                                });

                                if (error) throw error;
                                if (!data.success) throw new Error(data.error);

                                const newDemandId = data.id;

                                // Usar nova RPC para criar mensagem inicial
                                const { error: msgError } = await supabase.rpc('fn_send_demand_message_v2', {
                                    p_demand_id: newDemandId,
                                    p_sender_id: currentUserId,
                                    p_sender_name: currentUserName,
                                    p_sender_role: currentUserRole,
                                    p_message: description,
                                    p_message_type: 'comment'
                                });

                                if (msgError) throw msgError;

                                setShowNewDemandModal(false);
                                loadDemands(selectedStoreId);
                                loadStoreCounts();
                                calculateStats();
                            } catch (err) {
                                console.error("Erro ao criar demanda:", err);
                                alert("Erro ao criar demanda.");
                            } finally {
                                setIsLoading(false);
                            }
                        }}>
                            {user.role === 'ADMIN' && (
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Loja Solicitante</label>
                                    <select name="store_id" className="w-full px-4 py-3 bg-slate-100 dark:bg-slate-800 border-none rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500 transition-all appearance-none">
                                        {stores.map(s => <option key={s.id} value={s.id}>Loja {s.number} - {s.city}</option>)}
                                    </select>
                                </div>
                            )}
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Título do Chamado</label>
                                <input name="title" type="text" required placeholder="Ex: Problema no Ar Condicionado" className="w-full px-4 py-3 bg-slate-100 dark:bg-slate-800 border-none rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500 transition-all" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Prioridade</label>
                                    <select name="priority" className="w-full px-4 py-3 bg-slate-100 dark:bg-slate-800 border-none rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500 transition-all appearance-none">
                                        <option value="baixa">Baixa</option>
                                        <option value="media">Média</option>
                                        <option value="alta">Alta</option>
                                        <option value="urgente">Urgente</option>
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Categoria</label>
                                    <select name="category" className="w-full px-4 py-3 bg-slate-100 dark:bg-slate-800 border-none rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500 transition-all appearance-none">
                                        <option value="compra">Compra</option>
                                        <option value="defeito">Defeito</option>
                                        <option value="produto">Produto</option>
                                        <option value="reclamacao">Reclamação</option>
                                        <option value="relatorio">Relatório</option>
                                        <option value="reposicao">Reposição</option>
                                        <option value="sistema">Sistema</option>
                                        <option value="solicitacao">Solicitação</option>
                                        <option value="outro">Outro</option>
                                    </select>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Descrição Detalhada</label>
                                <textarea name="description" required rows={4} placeholder="Descreva o problema com o máximo de detalhes possível..." className="w-full px-4 py-3 bg-slate-100 dark:bg-slate-800 border-none rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500 transition-all resize-none"></textarea>
                            </div>
                            <button 
                                type="submit" 
                                disabled={isLoading}
                                className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black uppercase text-xs shadow-xl shadow-blue-900/20 hover:bg-blue-700 transition-all active:scale-95 disabled:opacity-50"
                            >
                                {isLoading ? <Loader2 className="animate-spin mx-auto" size={20} /> : 'Abrir Chamado Agora'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DemandsSystemV2;