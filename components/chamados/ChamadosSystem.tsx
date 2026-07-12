import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
    Store, User as UserType, AdminUser, DemandV2, DemandMessageV2, DemandV2Priority, DemandV2Status
} from '../../types';
import { supabase } from '../../services/supabaseClient';
import { ensureSession } from '../../services/authService';
import {
    Search, Plus, MessageSquare, ChevronRight, Loader2, Filter,
    PanelRightOpen, PanelRightClose, Users2, BarChart3
} from 'lucide-react';
import imageCompression from 'browser-image-compression';
import { useChamadosRealtime } from './hooks/useChamadosRealtime';
import ChamadoCard, { getPriorityBadge, getStatusIcon } from './ChamadoCard';
import ChamadoStoreItem from './ChamadoStoreItem';
import ChamadoMessageBubble from './ChamadoMessageBubble';
import ChamadoMessageInput from './ChamadoMessageInput';
import ChamadoStatsPanel from './ChamadoStatsPanel';
import ChamadoAssignPanel from './ChamadoAssignPanel';
import NovoChamadoModal from './NovoChamadoModal';

const MESSAGES_PAGE_SIZE = 40;

interface ChamadosSystemProps {
    user: UserType;
    stores: Store[];
    onUnreadUpdate?: () => void;
}

const ChamadosSystem: React.FC<ChamadosSystemProps> = ({ user, stores, onUnreadUpdate }) => {
    // @ts-ignore
    const currentUserId = user.user_id || user.id;
    // @ts-ignore
    const currentUserName = user.name || user.nome;
    // @ts-ignore
    const currentUserRole = user.role_level || user.role || 'COLABORADOR';
    const isAdmin = user.role === 'ADMIN';

    const [selectedStoreId, setSelectedStoreId] = useState<string | null>(isAdmin ? null : user.storeId || null);
    const [demands, setDemands] = useState<DemandV2[]>([]);
    const [selectedDemand, setSelectedDemand] = useState<DemandV2 | null>(null);
    const [messages, setMessages] = useState<DemandMessageV2[]>([]);
    const [hasMoreMessages, setHasMoreMessages] = useState(false);
    const [loadingMoreMessages, setLoadingMoreMessages] = useState(false);
    const [activeTab, setActiveTab] = useState<'abertas' | 'pausadas' | 'resolvidas'>('abertas');
    const [isLoading, setIsLoading] = useState(false);
    const [isSending, setIsSending] = useState(false);
    const [showNewDemandModal, setShowNewDemandModal] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [storeCounts, setStoreCounts] = useState<Record<string, { total: number; urgent: number; unread: number }>>({});
    const [stats, setStats] = useState({ resolved: 0, paused: 0, avgTime: '0h' });
    const [storeUsers, setStoreUsers] = useState<AdminUser[]>([]);
    const [selectedTargetUser, setSelectedTargetUser] = useState<string | null>(null);
    const [mobileView, setMobileView] = useState<'stores' | 'list' | 'chat'>(isAdmin ? 'stores' : 'list');
    const [showSidePanel, setShowSidePanel] = useState(false); // painel deslizante no notebook (1024–1280px)
    const [sidePanelTab, setSidePanelTab] = useState<'stats' | 'assign'>('stats');

    const messageEndRef = useRef<HTMLDivElement>(null);
    const messagesScrollRef = useRef<HTMLDivElement>(null);

    // ─── Sessão customizada ───
    useEffect(() => {
        const initSession = async () => {
            try {
                const { error } = await supabase.rpc('set_user_session', { p_user_id: user.id });
                if (error) console.error('Erro ao configurar sessão RPC:', error);
            } catch (err) {
                console.error('Erro ao configurar sessão:', err);
            }
        };
        initSession();
    }, [user.id]);

    const filteredStores = useMemo(() => {
        if (!isAdmin) return stores.filter(s => s.id === user.storeId);
        return stores
            .filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase()) || s.number.includes(searchTerm))
            .sort((a, b) => Number(a.number) - Number(b.number));
    }, [stores, searchTerm, user, isAdmin]);

    const loadStoreCounts = useCallback(async () => {
        try {
            await ensureSession();
            const { data, error } = await supabase.rpc('fn_get_store_demand_counts');
            if (error) throw error;
            const counts: Record<string, { total: number; urgent: number; unread: number }> = {};
            data?.forEach((d: any) => {
                counts[d.store_id] = { total: d.total_open || 0, urgent: d.urgent_count || 0, unread: d.unread_messages || 0 };
            });
            setStoreCounts(counts);
        } catch (err) {
            console.error('Erro ao carregar contadores:', err);
        }
    }, []);

    const calculateStats = useCallback(async () => {
        try {
            await ensureSession();
            const { data, error } = await supabase.from('demands_v2').select('status, resolution_time_minutes').eq('is_archived', false);
            if (error) throw error;
            const resolved = data.filter((d: any) => d.status === 'resolvida').length;
            const paused = data.filter((d: any) => d.status === 'pausada').length;
            const resolvedDemands = data.filter((d: any) => d.status === 'resolvida' && d.resolution_time_minutes);
            const totalMinutes = resolvedDemands.reduce((acc: number, curr: any) => acc + curr.resolution_time_minutes, 0);
            const avg = resolvedDemands.length > 0 ? (totalMinutes / resolvedDemands.length / 60).toFixed(1) : '0';
            setStats({ resolved, paused, avgTime: `${avg}h` });
        } catch (err) {
            console.error('Erro ao calcular estatísticas:', err);
        }
    }, []);

    const loadStoreUsers = useCallback(async (storeId: string) => {
        try {
            await ensureSession();
            const { data, error } = await supabase.from('admin_users').select('*').eq('store_id', storeId).eq('status', 'active').order('name');
            if (error) throw error;
            if (data) setStoreUsers(data);
        } catch (err) {
            console.error('Erro ao carregar usuários da loja:', err);
        }
    }, []);

    const loadDemands = useCallback(async (storeId: string | null) => {
        setIsLoading(true);
        try {
            await ensureSession();
            let query = supabase.from('demands_v2').select('*').eq('is_archived', false);
            if (storeId) query = query.eq('store_id', storeId);

            if (currentUserRole === 'ADMIN' || currentUserRole === 'TÉCNICO') {
                // visão total
            } else {
                // @ts-ignore
                const userStoreId = user.store_id || user.storeId;
                if (userStoreId) query = query.eq('store_id', userStoreId);
            }

            if (activeTab === 'abertas') query = query.in('status', ['aberta', 'em_andamento']);
            else if (activeTab === 'pausadas') query = query.eq('status', 'pausada');
            else query = query.in('status', ['resolvida', 'cancelada']);

            const { data, error } = await query.order('created_at', { ascending: false });
            if (error) throw error;
            setDemands(data || []);
        } catch (err) {
            console.error('Erro ao carregar demandas:', err);
        } finally {
            setIsLoading(false);
        }
    }, [activeTab, currentUserRole, user]);

    // ─── Mensagens com paginação (últimas 40, botão "carregar mais antigas") ───
    const loadMessages = useCallback(async (demandId: string, initial = true) => {
        try {
            await ensureSession();

            let query = supabase
                .from('demands_messages_v2')
                .select('*')
                .eq('demand_id', demandId)
                .order('created_at', { ascending: false })
                .limit(MESSAGES_PAGE_SIZE);

            if (!initial && messages.length > 0) {
                query = query.lt('created_at', messages[0].created_at);
            }

            const { data: msgs, error: msgsError } = await query;
            if (msgsError) throw msgsError;

            const ordered = [...(msgs || [])].reverse();
            const ids = ordered.map(m => m.id);

            const { data: atts, error: attsError } = ids.length > 0
                ? await supabase.from('demands_attachments_v2').select('*').in('message_id', ids)
                : { data: [], error: null };
            if (attsError) throw attsError;

            const withAttachments = ordered.map(m => ({ ...m, attachments: atts?.filter((a: any) => a.message_id === m.id) || [] }));

            if (initial) {
                setMessages(withAttachments);
                setHasMoreMessages((msgs || []).length === MESSAGES_PAGE_SIZE);
                await supabase.from('demands_v2').update({ unread_count: 0 }).eq('id', demandId);
                onUnreadUpdate?.();
                if (isAdmin) loadStoreCounts();
            } else {
                setMessages(prev => [...withAttachments, ...prev]);
                setHasMoreMessages((msgs || []).length === MESSAGES_PAGE_SIZE);
            }
        } catch (err) {
            console.error('Erro ao carregar mensagens:', err);
        }
    }, [messages, isAdmin, onUnreadUpdate, loadStoreCounts]);

    const handleLoadMoreMessages = useCallback(async () => {
        if (!selectedDemand || loadingMoreMessages) return;
        setLoadingMoreMessages(true);
        const scrollEl = messagesScrollRef.current;
        const prevHeight = scrollEl?.scrollHeight || 0;
        await loadMessages(selectedDemand.id, false);
        requestAnimationFrame(() => {
            if (scrollEl) scrollEl.scrollTop = scrollEl.scrollHeight - prevHeight;
        });
        setLoadingMoreMessages(false);
    }, [selectedDemand, loadingMoreMessages, loadMessages]);

    // ─── Realtime (canais permanentes — não recriam ao trocar de chamado) ───
    useChamadosRealtime({
        selectedDemandId: selectedDemand?.id || null,
        onDemandInsert: useCallback((d) => setDemands(prev => [d, ...prev]), []),
        onDemandUpdate: useCallback((d) => {
            setDemands(prev => prev.map(x => x.id === d.id ? d : x));
            setSelectedDemand(prev => (prev?.id === d.id ? d : prev));
        }, []),
        onMessageInsert: useCallback((m) => setMessages(prev => [...prev, m]), []),
        onAnyChange: useCallback(() => loadStoreCounts(), [loadStoreCounts]),
    });

    useEffect(() => { loadStoreCounts(); calculateStats(); }, []);
    useEffect(() => { loadDemands(selectedStoreId); }, [selectedStoreId, activeTab]);
    useEffect(() => {
        if (selectedDemand) {
            loadMessages(selectedDemand.id, true);
            setMobileView('chat');
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedDemand?.id]);

    useEffect(() => {
        if (selectedStoreId && isAdmin) {
            setMobileView('list');
        }
    }, [selectedStoreId, isAdmin]);
    useEffect(() => { messageEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages.length]);
    useEffect(() => { if (selectedStoreId) loadStoreUsers(selectedStoreId); }, [selectedStoreId]);

    const slaAlerts = useMemo(() => {
        const now = new Date();
        return demands
            .filter(d => d.status !== 'resolvida' && d.status !== 'cancelada')
            .map(demand => {
                const createdAt = new Date(demand.created_at);
                const hoursElapsed = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);
                let slaStatus: 'ok' | 'warning' | 'critical' = 'ok';
                if (demand.priority === 'urgente') {
                    if (hoursElapsed > 4) slaStatus = 'critical';
                    else if (hoursElapsed > 2) slaStatus = 'warning';
                } else if (demand.priority === 'alta') {
                    if (hoursElapsed > 24) slaStatus = 'critical';
                    else if (hoursElapsed > 12) slaStatus = 'warning';
                } else {
                    if (hoursElapsed > 72) slaStatus = 'critical';
                    else if (hoursElapsed > 48) slaStatus = 'warning';
                }
                return { ...demand, slaStatus, slaMessage: '', hoursElapsed };
            })
            .filter(d => d.slaStatus !== 'ok')
            .slice(0, 5) as any;
    }, [demands]);

    // ─── Handlers ───
    const handleAssign = useCallback(async (assignedToId: string) => {
        if (!selectedDemand) return;
        try {
            await ensureSession();
            const { data, error } = await supabase.rpc('fn_assign_demand_v2', {
                p_demand_id: selectedDemand.id, p_assigned_to: assignedToId,
                p_user_id: currentUserId, p_user_name: currentUserName, p_user_role: currentUserRole
            });
            if (error || !data.success) throw error || new Error(data.error);
            setSelectedDemand(prev => prev ? { ...prev, assigned_to: assignedToId } : prev);
            loadMessages(selectedDemand.id, true);
        } catch (err) {
            console.error('Erro ao atribuir demanda:', err);
            alert('Erro ao direcionar o chamado.');
        }
    }, [selectedDemand, currentUserId, currentUserName, currentUserRole]);

    const handleSendMessage = useCallback(async (text: string) => {
        if (!text.trim() || !selectedDemand) return;
        setIsSending(true);
        try {
            await ensureSession();
            const { data, error } = await supabase.rpc('fn_send_demand_message_v2', {
                p_demand_id: selectedDemand.id, p_sender_id: currentUserId, p_sender_name: currentUserName,
                p_sender_role: currentUserRole, p_message: text.trim(), p_message_type: 'comment',
                p_target_user_id: selectedTargetUser
            });
            if (error || !data.success) throw error || new Error(data.error);
            setSelectedTargetUser(null);
            loadMessages(selectedDemand.id, true);
            loadStoreCounts();
        } catch (err) {
            console.error('Erro ao enviar mensagem:', err);
            alert('Erro ao enviar mensagem.');
        } finally {
            setIsSending(false);
        }
    }, [selectedDemand, currentUserId, currentUserName, currentUserRole, selectedTargetUser, loadStoreCounts]);

    const handleFileUpload = useCallback(async (file: File) => {
        if (!selectedDemand) return;
        setIsSending(true);
        try {
            await ensureSession();
            let finalFile: File = file;
            let isCompressed = false;
            const originalSize = file.size;

            if (file.type.startsWith('image/')) {
                finalFile = await imageCompression(file, { maxSizeMB: 0.5, maxWidthOrHeight: 1920, useWebWorker: true, fileType: 'image/jpeg' });
                isCompressed = true;
            }

            const fileExt = file.name.split('.').pop()?.toLowerCase() || 'bin';
            const fileName = `${Date.now()}-${Math.floor(Math.random() * 1000)}.${fileExt}`;
            const filePath = `demands/${selectedDemand.id}/${fileName}`;

            const { error: uploadError } = await supabase.storage.from('attachments').upload(filePath, finalFile, {
                cacheControl: '3600', upsert: true, contentType: isCompressed ? 'image/jpeg' : (file.type || 'application/octet-stream')
            });
            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage.from('attachments').getPublicUrl(filePath);

            const { data: msgData, error: msgError } = await supabase.rpc('fn_send_demand_message_v2', {
                p_demand_id: selectedDemand.id, p_sender_id: currentUserId, p_sender_name: currentUserName,
                p_sender_role: currentUserRole, p_message: `Anexou um arquivo: ${file.name}`, p_message_type: 'comment',
                p_target_user_id: selectedTargetUser
            });
            if (msgError || !msgData.success) throw msgError || new Error(msgData.error);

            const { data: lastMsg } = await supabase.from('demands_messages_v2').select('id').eq('demand_id', selectedDemand.id).order('created_at', { ascending: false }).limit(1).single();
            if (!lastMsg) throw new Error('Mensagem não encontrada');

            const { error: attError } = await supabase.from('demands_attachments_v2').insert([{
                demand_id: selectedDemand.id, message_id: lastMsg.id, file_name: file.name, file_url: publicUrl,
                file_size: finalFile.size, file_type: file.type, is_compressed: isCompressed, original_size: originalSize,
                compression_ratio: Number((finalFile.size / originalSize).toFixed(2)),
                uploaded_from_mobile: /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
            }]);
            if (attError) throw attError;

            setSelectedTargetUser(null);
            loadMessages(selectedDemand.id, true);
        } catch (err: any) {
            console.error('Erro no upload:', err);
            alert(`Erro ao enviar arquivo: ${err.message || 'Erro desconhecido'}`);
        } finally {
            setIsSending(false);
        }
    }, [selectedDemand, currentUserId, currentUserName, currentUserRole, selectedTargetUser]);

    const handleStatusChange = useCallback(async (newStatus: DemandV2Status) => {
        if (!selectedDemand) return;
        if (newStatus === 'resolvida') {
            try {
                await ensureSession();
                const { data, error } = await supabase.rpc('fn_resolve_demand_v2', {
                    p_demand_id: selectedDemand.id, p_user_id: currentUserId, p_user_name: currentUserName, p_user_role: currentUserRole
                });
                if (error || !data.success) throw error || new Error(data.error);
                setSelectedDemand(null);
                await Promise.all([loadDemands(selectedStoreId), loadStoreCounts(), calculateStats()]);
            } catch (err) {
                console.error('Erro ao resolver demanda:', err);
                alert('Erro ao finalizar o chamado.');
            }
            return;
        }
        try {
            await ensureSession();
            const { error } = await supabase.from('demands_v2').update({
                status: newStatus, updated_at: new Date().toISOString(), resolved_at: null, resolved_by: null,
                paused_at: newStatus === 'pausada' ? new Date().toISOString() : null
            }).eq('id', selectedDemand.id);
            if (error) throw error;

            await supabase.from('demands_messages_v2').insert([{
                demand_id: selectedDemand.id, sender_id: currentUserId, sender_name: currentUserName,
                sender_role: currentUserRole, message: `Alterou o status para: ${newStatus.toUpperCase()}`, message_type: 'status_change'
            }]);

            setSelectedDemand(prev => prev ? { ...prev, status: newStatus } : prev);
            loadDemands(selectedStoreId);
            loadMessages(selectedDemand.id, true);
            calculateStats();
        } catch (err) {
            console.error('Erro ao mudar status:', err);
        }
    }, [selectedDemand, selectedStoreId, currentUserId, currentUserName, currentUserRole, loadDemands, loadStoreCounts, calculateStats]);

    const handleCreateDemand = useCallback(async (data: { title: string; description: string; priority: DemandV2Priority; category: string; storeId: string }) => {
        setIsLoading(true);
        try {
            await ensureSession();
            const { data: created, error } = await supabase.rpc('fn_create_demand_v2', {
                p_store_id: data.storeId, p_title: data.title, p_description: data.description,
                p_priority: data.priority, p_category: data.category, p_created_by: currentUserId, p_status: 'aberta'
            });
            if (error) throw error;
            if (!created.success) throw new Error(created.error);

            const { error: msgError } = await supabase.rpc('fn_send_demand_message_v2', {
                p_demand_id: created.id, p_sender_id: currentUserId, p_sender_name: currentUserName,
                p_sender_role: currentUserRole, p_message: data.description, p_message_type: 'comment'
            });
            if (msgError) throw msgError;

            setShowNewDemandModal(false);
            loadDemands(selectedStoreId);
            loadStoreCounts();
            calculateStats();
        } catch (err) {
            console.error('Erro ao criar demanda:', err);
            alert('Erro ao criar demanda.');
        } finally {
            setIsLoading(false);
        }
    }, [currentUserId, currentUserName, currentUserRole, selectedStoreId, loadDemands, loadStoreCounts, calculateStats]);

    const handleSelectAlert = useCallback((demand: DemandV2) => {
        setSelectedDemand(demand);
        if (window.innerWidth < 1024) setMobileView('chat');
    }, []);

    // ═══════════════════════════════════════════════════════════
    // RENDER
    // ═══════════════════════════════════════════════════════════
    return (
        <div className="flex flex-col h-full min-h-[600px] bg-transparent relative">
            {/* Header */}
            <div className="bg-white dark:bg-slate-900 p-3 lg:p-6 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row justify-between items-center gap-3 lg:gap-4">
                <div className="flex items-center gap-3 lg:gap-4 w-full lg:w-auto">
                    <div className="p-2 lg:p-3 bg-blue-600 rounded-xl lg:rounded-2xl shadow-lg shadow-blue-900/20">
                        <MessageSquare className="text-white" size={20} />
                    </div>
                    <div className="flex-1 lg:flex-none">
                        <h2 className="text-base lg:text-xl font-black text-slate-900 dark:text-white uppercase italic tracking-tighter">
                            Central de Chamados <span className="text-blue-600">V3.0</span>
                        </h2>
                        <p className="text-[9px] lg:text-[10px] font-bold text-slate-400 uppercase tracking-widest hidden sm:block">
                            Sistema com Privacidade por Hierarquia
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2 lg:gap-3 w-full sm:w-auto">
                    {mobileView === 'chat' && (
                        <button onClick={() => { setMobileView('list'); setSelectedDemand(null); }} className="lg:hidden p-2 bg-slate-100 dark:bg-slate-800 text-slate-600 rounded-xl active:scale-95 transition-all">
                            <ChevronRight size={20} className="rotate-180" />
                        </button>
                    )}
                    <div className="relative flex-1 sm:w-48 lg:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input
                            type="text" placeholder="Buscar..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 lg:py-2.5 bg-slate-100 dark:bg-slate-800 border-none rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                        />
                    </div>
                    {/* Botão do painel deslizante — só aparece em telas de notebook (1024–1280px) */}
                    {selectedDemand && (
                        <button
                            onClick={() => setShowSidePanel(v => !v)}
                            className="hidden lg:flex xl:hidden p-2.5 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-xl hover:bg-blue-50 hover:text-blue-600 transition-all active:scale-95"
                            title="Painel de estatísticas e direcionamento"
                        >
                            {showSidePanel ? <PanelRightClose size={20} /> : <PanelRightOpen size={20} />}
                        </button>
                    )}
                    <button onClick={() => setShowNewDemandModal(true)} className="p-2 lg:p-2.5 bg-blue-600 text-white rounded-xl shadow-lg hover:bg-blue-700 transition-all active:scale-95">
                        <Plus size={20} />
                    </button>
                </div>
            </div>

            {/* ═══ MOBILE (<1024px) ═══ */}
            <div className="flex-1 flex lg:hidden flex-col overflow-y-auto">
                {mobileView === 'stores' && isAdmin && (
                    <div className="flex-1 flex flex-col p-3">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Escolha a loja</p>
                        <div className="flex flex-col gap-2">
                            {filteredStores.map(store => (
                                <ChamadoStoreItem key={store.id} store={store} isSelected={selectedStoreId === store.id}
                                    count={storeCounts[store.id] || { total: 0, urgent: 0, unread: 0 }} onSelect={setSelectedStoreId} />
                            ))}
                        </div>
                    </div>
                )}
                {mobileView === 'list' && (
                    <div className="flex-1 flex flex-col overflow-hidden">
                        {isAdmin && (
                            <button
                                onClick={() => setMobileView('stores')}
                                className="flex items-center gap-2 px-3 py-2.5 text-[11px] font-bold text-slate-500 border-b border-slate-200 dark:border-slate-800"
                            >
                                <ChevronRight size={16} className="rotate-180" /> Lojas
                            </button>
                        )}
                        <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md p-2 border-b border-slate-200 dark:border-slate-800 flex gap-1">
                            {(['abertas', 'pausadas', 'resolvidas'] as const).map(tab => (
                                <button key={tab} onClick={() => setActiveTab(tab)} className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === tab ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
                                    {tab}
                                </button>
                            ))}
                        </div>
                        <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-slate-50/50 dark:bg-slate-950/50">
                            {isLoading ? (
                                <div className="flex flex-col items-center justify-center py-20 gap-4">
                                    <Loader2 className="animate-spin text-blue-600" size={32} />
                                    <p className="text-xs font-black text-slate-400 uppercase">Carregando...</p>
                                </div>
                            ) : demands.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-20 text-center px-4">
                                    <div className="p-4 bg-slate-100 dark:bg-slate-800 rounded-full mb-4"><Filter className="text-slate-300" size={32} /></div>
                                    <p className="text-xs font-black text-slate-400 uppercase">Nenhuma demanda encontrada</p>
                                </div>
                            ) : (
                                demands.map(demand => (
                                    <ChamadoCard key={demand.id} demand={demand} isSelected={selectedDemand?.id === demand.id} onSelect={setSelectedDemand} />
                                ))
                            )}
                        </div>
                    </div>
                )}

                {mobileView === 'chat' && selectedDemand && (
                    <div className="flex-1 flex flex-col overflow-hidden bg-white dark:bg-slate-900">
                        <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-950/30">
                            <div className="flex justify-between items-start mb-3 gap-3">
                                <div className="flex-1 min-w-0">
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
                                {isAdmin && selectedDemand.status !== 'resolvida' && (
                                    <button onClick={() => handleStatusChange('resolvida')} className="p-2 bg-emerald-100 text-emerald-600 rounded-lg hover:bg-emerald-200 transition-all active:scale-95 shrink-0" title="Resolver">
                                        {getStatusIcon('resolvida')}
                                    </button>
                                )}
                            </div>
                            <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                                <p className="text-xs font-medium text-slate-600 dark:text-slate-400 leading-relaxed">{selectedDemand.description}</p>
                            </div>
                        </div>

                        <div ref={messagesScrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50 dark:bg-slate-950">
                            {hasMoreMessages && (
                                <div className="flex justify-center">
                                    <button onClick={handleLoadMoreMessages} disabled={loadingMoreMessages} className="text-[10px] font-black text-blue-600 uppercase px-3 py-1.5 bg-blue-50 rounded-full hover:bg-blue-100 transition-all disabled:opacity-50">
                                        {loadingMoreMessages ? 'Carregando...' : 'Carregar mais antigas'}
                                    </button>
                                </div>
                            )}
                            {messages.map((msg) => (
                                // @ts-ignore
                                <ChamadoMessageBubble key={msg.id} msg={msg} isMe={msg.sender_id === currentUserId} />
                            ))}
                            <div ref={messageEndRef} />
                        </div>

                        <ChamadoMessageInput
                            onSend={handleSendMessage} onFileUpload={handleFileUpload} isSending={isSending} isAdmin={isAdmin}
                            storeUsers={storeUsers} selectedTargetUser={selectedTargetUser} onSelectTargetUser={setSelectedTargetUser} mobileVariant
                        />
                    </div>
                )}
            </div>

            {/* ═══ DESKTOP (≥1024px) — 3 colunas no notebook, 5 no monitor grande ═══ */}
            <div className="flex-1 hidden lg:flex overflow-hidden relative">
                {/* Coluna 1: Lojas */}
                <div className="w-[180px] xl:w-[20%] shrink-0 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-y-auto no-scrollbar">
                    <div className="p-4 space-y-2">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Unidades</p>
                        {filteredStores.map(store => (
                            <ChamadoStoreItem key={store.id} store={store} isSelected={selectedStoreId === store.id}
                                count={storeCounts[store.id] || { total: 0, urgent: 0, unread: 0 }} onSelect={setSelectedStoreId} />
                        ))}
                    </div>
                </div>

                {/* Coluna 2: Lista de Chamados */}
                <div className="w-[240px] xl:w-[20%] shrink-0 border-r border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 overflow-y-auto no-scrollbar">
                    <div className="sticky top-0 z-10 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md p-2 border-b border-slate-200 dark:border-slate-800 flex gap-1">
                        {(['abertas', 'pausadas', 'resolvidas'] as const).map(tab => (
                            <button key={tab} onClick={() => setActiveTab(tab)} className={`flex-1 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${activeTab === tab ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
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
                                <div className="p-4 bg-slate-100 dark:bg-slate-800 rounded-full mb-4"><Filter className="text-slate-300" size={32} /></div>
                                <p className="text-[10px] font-black text-slate-400 uppercase">Nenhuma demanda encontrada</p>
                            </div>
                        ) : (
                            demands.map(demand => (
                                <ChamadoCard key={demand.id} demand={demand} isSelected={selectedDemand?.id === demand.id} onSelect={setSelectedDemand} compact />
                            ))
                        )}
                    </div>
                </div>

                {/* Coluna 3: Chat — ocupa o resto do espaço */}
                <div className="flex-1 flex flex-col bg-white dark:bg-slate-900 relative min-w-0">
                    {selectedDemand ? (
                        <>
                            <div className="p-4 sm:p-6 border-b border-slate-200 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-950/30">
                                <div className="flex justify-between items-start mb-4 gap-3">
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-3 mb-2 flex-wrap">
                                            <span className="text-xs font-black text-blue-600 font-mono tracking-tighter">{selectedDemand.ticket_number}</span>
                                            {getPriorityBadge(selectedDemand.priority)}
                                            <div className="flex items-center gap-1.5 px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded-full">
                                                {getStatusIcon(selectedDemand.status)}
                                                <span className="text-[9px] font-black uppercase text-slate-600 dark:text-slate-400">{selectedDemand.status.replace('_', ' ')}</span>
                                            </div>
                                        </div>
                                        <h3 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white uppercase italic leading-none truncate">{selectedDemand.title}</h3>
                                    </div>
                                    <div className="flex gap-2 shrink-0">
                                        {isAdmin && (
                                            <>
                                                {selectedDemand.status !== 'em_andamento' && selectedDemand.status !== 'resolvida' && (
                                                    <button onClick={() => handleStatusChange('em_andamento')} className="p-2 bg-amber-100 text-amber-600 rounded-xl hover:bg-amber-200 transition-all" title="Iniciar Atendimento">{getStatusIcon('em_andamento')}</button>
                                                )}
                                                {selectedDemand.status === 'em_andamento' && (
                                                    <button onClick={() => handleStatusChange('pausada')} className="p-2 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition-all" title="Pausar">{getStatusIcon('pausada')}</button>
                                                )}
                                                {selectedDemand.status !== 'resolvida' && (
                                                    <button onClick={() => handleStatusChange('resolvida')} className="p-2 bg-emerald-100 text-emerald-600 rounded-xl hover:bg-emerald-200 transition-all" title="Resolver">{getStatusIcon('resolvida')}</button>
                                                )}
                                            </>
                                        )}
                                    </div>
                                </div>
                                <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
                                    <p className="text-xs font-medium text-slate-600 dark:text-slate-400 leading-relaxed">{selectedDemand.description}</p>
                                </div>
                            </div>

                            <div ref={messagesScrollRef} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 no-scrollbar">
                                {hasMoreMessages && (
                                    <div className="flex justify-center">
                                        <button onClick={handleLoadMoreMessages} disabled={loadingMoreMessages} className="text-[10px] font-black text-blue-600 uppercase px-3 py-1.5 bg-blue-50 rounded-full hover:bg-blue-100 transition-all disabled:opacity-50">
                                            {loadingMoreMessages ? 'Carregando...' : 'Carregar mais antigas'}
                                        </button>
                                    </div>
                                )}
                                {messages.map((msg) => (
                                    // @ts-ignore
                                    <ChamadoMessageBubble key={msg.id} msg={msg} isMe={msg.sender_id === currentUserId} />
                                ))}
                                <div ref={messageEndRef} />
                            </div>

                            <ChamadoMessageInput
                                onSend={handleSendMessage} onFileUpload={handleFileUpload} isSending={isSending} isAdmin={isAdmin}
                                storeUsers={storeUsers} selectedTargetUser={selectedTargetUser} onSelectTargetUser={setSelectedTargetUser}
                            />
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

                {/* Colunas 4+5 FIXAS — só em monitor grande (≥1280px) */}
                {isAdmin && selectedDemand && (
                    <div className="hidden xl:block w-[10%] shrink-0 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-y-auto no-scrollbar">
                        <ChamadoAssignPanel storeUsers={storeUsers} assignedTo={selectedDemand.assigned_to} onAssign={handleAssign} />
                    </div>
                )}
                <div className="hidden xl:block w-[15%] shrink-0 bg-slate-50 dark:bg-slate-950 p-4 overflow-y-auto no-scrollbar border-l border-slate-200 dark:border-slate-800">
                    <ChamadoStatsPanel slaAlerts={slaAlerts} stats={stats} demands={demands} onSelectAlert={handleSelectAlert} />
                </div>

                {/* Painel DESLIZANTE — só aparece em notebook (1024–1280px), acionado pelo botão do header */}
                {showSidePanel && selectedDemand && (
                    <div className="xl:hidden absolute top-0 right-0 bottom-0 w-[320px] max-w-[85vw] bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-2xl z-20 flex flex-col animate-in slide-in-from-right duration-200">
                        <div className="flex border-b border-slate-200 dark:border-slate-800 shrink-0">
                            <button onClick={() => setSidePanelTab('stats')} className={`flex-1 flex items-center justify-center gap-2 py-3 text-[10px] font-black uppercase transition-all ${sidePanelTab === 'stats' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-400'}`}>
                                <BarChart3 size={14} /> Estatísticas
                            </button>
                            {isAdmin && (
                                <button onClick={() => setSidePanelTab('assign')} className={`flex-1 flex items-center justify-center gap-2 py-3 text-[10px] font-black uppercase transition-all ${sidePanelTab === 'assign' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-400'}`}>
                                    <Users2 size={14} /> Direcionar
                                </button>
                            )}
                        </div>
                        <div className="flex-1 overflow-y-auto p-4">
                            {sidePanelTab === 'stats' ? (
                                <ChamadoStatsPanel slaAlerts={slaAlerts} stats={stats} demands={demands} onSelectAlert={handleSelectAlert} />
                            ) : (
                                <ChamadoAssignPanel storeUsers={storeUsers} assignedTo={selectedDemand.assigned_to} onAssign={handleAssign} />
                            )}
                        </div>
                    </div>
                )}
            </div>

            <NovoChamadoModal
                isOpen={showNewDemandModal} onClose={() => setShowNewDemandModal(false)} isAdmin={isAdmin}
                stores={stores} userStoreId={user.storeId || null} isSubmitting={isLoading} onSubmit={handleCreateDemand}
            />
        </div>
    );
};

export default ChamadosSystem;
