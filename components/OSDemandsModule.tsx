import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../services/supabaseClient';
import { Demand, DemandMessage, DemandPriority, DemandStatus, User, Store } from '../types';
import { 
    AlertCircle, Clock, Store as StoreIcon, Filter, Search, 
    Send, CheckCircle, XCircle, MessageSquare, ChevronRight,
    ArrowLeft, Loader2, Calendar, Plus, Edit2, Trash2, Check, X, ClipboardList
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface OSDemandsModuleProps {
    user: User;
    stores: Store[];
}

const OSDemandsModule: React.FC<OSDemandsModuleProps> = ({ user, stores }) => {
    const [demands, setDemands] = useState<Demand[]>([]);
    const [selectedDemand, setSelectedDemand] = useState<Demand | null>(null);
    const [messages, setMessages] = useState<DemandMessage[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isSending, setIsSending] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showMobileDetails, setShowMobileDetails] = useState(false);
    
    // Form state
    const [editingDemand, setEditingDemand] = useState<Demand | null>(null);
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        category: 'Manutenção',
        priority: 'media' as DemandPriority,
        store_id: user.storeId || ''
    });
    
    // Filters
    const [statusFilter, setStatusFilter] = useState<DemandStatus | 'todos'>('todos');
    const [categoryFilter, setCategoryFilter] = useState<string>('todos');
    const [searchTerm, setSearchTerm] = useState('');

    const chatEndRef = useRef<HTMLDivElement>(null);

    const categories = ['todos', ...new Set(demands.map(d => d.category))];

    useEffect(() => {
        fetchDemands();
    }, []);

    useEffect(() => {
        if (selectedDemand) {
            fetchMessages(selectedDemand.id);
            // Subscribe to new messages for this demand
            const channel = supabase.channel(`demand-${selectedDemand.id}`)
                .on('postgres_changes', { 
                    event: 'INSERT', 
                    schema: 'public', 
                    table: 'demand_messages',
                    filter: `demand_id=eq.${selectedDemand.id}`
                }, (payload) => {
                    setMessages(prev => [...prev, payload.new as DemandMessage]);
                })
                .subscribe();

            return () => {
                supabase.removeChannel(channel);
            };
        }
    }, [selectedDemand]);

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const scrollToBottom = () => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    const fetchDemands = async () => {
        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from('demands')
                .select(`
                    *,
                    stores (name, number)
                `)
                .order('created_at', { ascending: false });

            if (error) throw error;

            const mappedDemands = data.map((d: any) => ({
                ...d,
                store_name: d.stores?.name,
                store_number: d.stores?.number
            }));

            setDemands(mappedDemands);
        } catch (err) {
            console.error('Erro ao buscar demandas:', err);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchMessages = async (demandId: string) => {
        try {
            const { data, error } = await supabase
                .from('demand_messages')
                .select('*')
                .eq('demand_id', demandId)
                .order('created_at', { ascending: true });

            if (error) throw error;
            setMessages(data || []);
        } catch (err) {
            console.error('Erro ao buscar mensagens:', err);
        }
    };

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMessage.trim() || !selectedDemand || isSending) return;

        setIsSending(true);
        try {
            const isAdmin = user.role === 'ADMIN';
            
            // 1. Insert message
            const { error: msgError } = await supabase
                .from('demand_messages')
                .insert([{
                    demand_id: selectedDemand.id,
                    sender_name: user.name,
                    message: newMessage.trim(),
                    is_admin: isAdmin,
                    read: false
                }]);

            if (msgError) throw msgError;

            // 2. Automation: If Admin sends message in 'aberta' OS, change to 'em_andamento'
            if (isAdmin && selectedDemand.status === 'aberta') {
                await handleUpdateStatus(selectedDemand.id, 'em_andamento');
            }

            setNewMessage('');
        } catch (err) {
            console.error('Erro ao enviar mensagem:', err);
        } finally {
            setIsSending(false);
        }
    };

    const handleUpdateStatus = async (id: string, status: DemandStatus) => {
        try {
            const { error } = await supabase
                .from('demands')
                .update({ status })
                .eq('id', id);

            if (error) throw error;

            if (selectedDemand?.id === id) {
                setSelectedDemand(prev => prev ? { ...prev, status } : null);
            }
            setDemands(prev => prev.map(d => d.id === id ? { ...d, status } : d));
            
            // Add a system message about status change
            await supabase.from('demand_messages').insert([{
                demand_id: id,
                sender_name: 'Sistema',
                message: `Status alterado para: ${getStatusLabel(status)}`,
                is_admin: true,
                read: true
            }]);
        } catch (err) {
            console.error('Erro ao atualizar status:', err);
        }
    };

    const handleSaveDemand = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.title || !formData.description || !formData.store_id || isSubmitting) return;

        setIsSubmitting(true);
        try {
            if (editingDemand) {
                const { error } = await supabase
                    .from('demands')
                    .update({
                        title: formData.title,
                        description: formData.description,
                        category: formData.category,
                        priority: formData.priority,
                        store_id: formData.store_id
                    })
                    .eq('id', editingDemand.id);

                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from('demands')
                    .insert([{
                        ...formData,
                        status: 'aberta',
                        created_by: user.id,
                        sla_hours: formData.priority === 'urgente' ? 4 : formData.priority === 'alta' ? 24 : 48
                    }]);

                if (error) throw error;
            }

            setIsModalOpen(false);
            setEditingDemand(null);
            setFormData({
                title: '',
                description: '',
                category: 'Manutenção',
                priority: 'media',
                store_id: user.storeId || ''
            });
            fetchDemands();
        } catch (err) {
            console.error('Erro ao salvar demanda:', err);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeleteDemand = async (id: string) => {
        if (!window.confirm('Tem certeza que deseja excluir esta demanda?')) return;

        try {
            const { error } = await supabase
                .from('demands')
                .delete()
                .eq('id', id);

            if (error) throw error;

            if (selectedDemand?.id === id) setSelectedDemand(null);
            setDemands(prev => prev.filter(d => d.id !== id));
        } catch (err) {
            console.error('Erro ao excluir demanda:', err);
        }
    };

    const openEditModal = (demand: Demand) => {
        setEditingDemand(demand);
        setFormData({
            title: demand.title,
            description: demand.description,
            category: demand.category,
            priority: demand.priority,
            store_id: demand.store_id
        });
        setIsModalOpen(true);
    };

    const handleFinalizeDemand = () => {
        if (!selectedDemand) return;
        if (window.confirm('Deseja marcar esta demanda como resolvida?')) {
            handleUpdateStatus(selectedDemand.id, 'resolvida');
        }
    };

    const handleCancelDemand = () => {
        if (!selectedDemand) return;
        if (window.confirm('Deseja realmente cancelar esta demanda?')) {
            handleUpdateStatus(selectedDemand.id, 'cancelada');
        }
    };

    // KPIs
    const criticalCount = demands.filter(d => d.status === 'aberta' && d.priority === 'urgente').length;
    
    // Simple average response time (mock logic or based on first admin message)
    const avgResponseTime = "1.5h"; // Placeholder for actual calculation logic if needed

    const storeActivity = demands.reduce((acc: any, d) => {
        const storeKey = d.store_name || 'Desconhecida';
        acc[storeKey] = (acc[storeKey] || 0) + 1;
        return acc;
    }, {});
    const mostActiveStore = Object.entries(storeActivity).sort((a: any, b: any) => b[1] - a[1])[0]?.[0] || 'N/A';

    const filteredDemands = demands.filter(d => {
        const matchesStatus = statusFilter === 'todos' || d.status === statusFilter;
        const matchesCategory = categoryFilter === 'todos' || d.category === categoryFilter;
        const matchesSearch = d.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            (d.store_name && d.store_name.toLowerCase().includes(searchTerm.toLowerCase()));
        return matchesStatus && matchesCategory && matchesSearch;
    });

    const getPriorityColor = (priority: DemandPriority) => {
        switch (priority) {
            case 'urgente': return '#E05C5C';
            case 'alta': return '#e8b86d';
            case 'media': return '#3b82f6';
            case 'baixa': return '#10b981';
            default: return '#9ca3af';
        }
    };

    const getStatusLabel = (status: DemandStatus) => {
        switch (status) {
            case 'aberta': return 'Aberta';
            case 'em_andamento': return 'Em Andamento';
            case 'resolvida': return 'Resolvida';
            case 'cancelada': return 'Cancelada';
            default: return status;
        }
    };

    return (
        <section id="modulo-os-demandas" className="os-module-container">
            <style>{`
                .os-module-container {
                    --bg: #f8fafc;
                    --surface: #ffffff;
                    --card: #ffffff;
                    --accent: #e8b86d;
                    --text: #1e293b;
                    --text-muted: #64748b;
                    --border: #e2e8f0;
                    --chat-bg: #f1f5f9;
                    
                    background: var(--bg);
                    color: var(--text);
                    height: 100%;
                    display: flex;
                    flex-direction: column;
                    font-family: 'Inter', sans-serif;
                    transition: all 0.3s ease;
                }

                .dark .os-module-container {
                    --bg: #0f172a;
                    --surface: #1e293b;
                    --card: #334155;
                    --accent: #fbbf24;
                    --text: #f1f5f9;
                    --text-muted: #94a3b8;
                    --border: #475569;
                    --chat-bg: #0f172a;
                }

                .os-header {
                    padding: 24px;
                    border-bottom: 1px solid var(--border);
                    background: var(--surface);
                }

                .kpi-grid {
                    display: grid;
                    grid-template-columns: repeat(3, 1fr);
                    gap: 16px;
                    margin-bottom: 0;
                }

                .kpi-card {
                    background: var(--card);
                    border: 1px solid var(--border);
                    padding: 20px;
                    border-radius: 16px;
                    display: flex;
                    align-items: center;
                    gap: 16px;
                    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
                }

                .kpi-icon {
                    width: 48px;
                    height: 48px;
                    border-radius: 12px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: rgba(232, 184, 109, 0.15);
                    color: var(--accent);
                }

                .kpi-info h4 {
                    font-size: 11px;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                    color: var(--text-muted);
                    margin: 0;
                    font-weight: 700;
                }

                .kpi-info p {
                    font-size: 22px;
                    font-weight: 800;
                    margin: 2px 0 0 0;
                    color: var(--text);
                }

                .os-main-content {
                    flex: 1;
                    display: grid;
                    grid-template-columns: 240px 1fr 400px;
                    overflow: hidden;
                }

                @media (max-width: 1023px) {
                    .os-main-content {
                        grid-template-columns: 1fr;
                    }
                    .os-sidebar {
                        display: none;
                    }
                    .os-details-panel {
                        position: fixed;
                        top: 0;
                        left: 0;
                        right: 0;
                        bottom: 0;
                        z-index: 100;
                        transform: translateX(100%);
                        transition: transform 0.3s ease;
                    }
                    .os-details-panel.mobile-open {
                        transform: translateX(0);
                    }
                }

                .os-sidebar {
                    border-right: 1px solid var(--border);
                    padding: 20px;
                    display: flex;
                    flex-direction: column;
                    gap: 24px;
                    background: var(--surface);
                }

                .new-demand-btn {
                    width: 100%;
                    background: var(--accent);
                    color: #000;
                    border: none;
                    padding: 14px;
                    border-radius: 12px;
                    font-size: 12px;
                    font-weight: 900;
                    text-transform: uppercase;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                    transition: all 0.2s;
                    box-shadow: 0 4px 12px rgba(232, 184, 109, 0.2);
                    margin-bottom: 8px;
                }

                .new-demand-btn:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 6px 16px rgba(232, 184, 109, 0.3);
                }

                .filter-group h5 {
                    font-size: 10px;
                    text-transform: uppercase;
                    color: var(--text-muted);
                    margin-bottom: 12px;
                    font-weight: 800;
                    letter-spacing: 0.1em;
                }

                .filter-btn {
                    width: 100%;
                    text-align: left;
                    padding: 10px 12px;
                    border-radius: 10px;
                    font-size: 13px;
                    background: transparent;
                    color: var(--text-muted);
                    border: none;
                    cursor: pointer;
                    transition: all 0.2s;
                    font-weight: 600;
                }

                .filter-btn:hover {
                    background: rgba(0, 0, 0, 0.03);
                    color: var(--text);
                }

                .filter-btn.active {
                    background: rgba(232, 184, 109, 0.15);
                    color: #b48a4d;
                    font-weight: 700;
                }

                .os-list-container {
                    display: flex;
                    flex-direction: column;
                    background: var(--bg);
                }

                .os-list-header {
                    padding: 16px 20px;
                    border-bottom: 1px solid var(--border);
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    background: var(--surface);
                }

                .search-wrapper {
                    flex: 1;
                    position: relative;
                }

                .search-wrapper input {
                    width: 100%;
                    background: var(--bg);
                    border: 1px solid var(--border);
                    border-radius: 10px;
                    padding: 10px 12px 10px 40px;
                    color: var(--text);
                    font-size: 13px;
                    outline: none;
                    transition: all 0.2s;
                }

                .search-wrapper input:focus {
                    border-color: var(--accent);
                    background: var(--surface);
                    box-shadow: 0 0 0 3px rgba(232, 184, 109, 0.1);
                }

                .search-wrapper svg {
                    position: absolute;
                    left: 14px;
                    top: 50%;
                    transform: translateY(-50%);
                    color: var(--text-muted);
                }

                .os-list {
                    flex: 1;
                    overflow-y: auto;
                    padding: 20px;
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                }

                .demand-card {
                    background: var(--card);
                    border: 1px solid var(--border);
                    border-radius: 16px;
                    padding: 16px;
                    cursor: pointer;
                    transition: all 0.2s;
                    position: relative;
                    overflow: hidden;
                    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.02);
                }

                .demand-card:hover {
                    border-color: var(--accent);
                    transform: translateY(-2px);
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
                }

                .demand-card.active {
                    border-color: var(--accent);
                    background: rgba(232, 184, 109, 0.03);
                    box-shadow: 0 4px 12px rgba(232, 184, 109, 0.1);
                }

                .priority-indicator {
                    position: absolute;
                    left: 0;
                    top: 0;
                    bottom: 0;
                    width: 4px;
                }

                .demand-card-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    margin-bottom: 8px;
                }

                .demand-card-header h3 {
                    font-size: 14px;
                    font-weight: 700;
                    margin: 0;
                    color: var(--text);
                    line-height: 1.4;
                }

                .demand-meta {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    font-size: 11px;
                    color: var(--text-muted);
                    font-weight: 500;
                }

                .demand-meta span {
                    display: flex;
                    align-items: center;
                    gap: 4px;
                }

                .status-badge {
                    font-size: 9px;
                    padding: 3px 10px;
                    border-radius: 100px;
                    text-transform: uppercase;
                    font-weight: 800;
                    letter-spacing: 0.05em;
                }

                .status-aberta { background: rgba(59, 130, 246, 0.1); color: #2563eb; }
                .status-em_andamento { background: rgba(232, 184, 109, 0.15); color: #b48a4d; }
                .status-resolvida { background: rgba(16, 185, 129, 0.1); color: #059669; }
                .status-cancelada { background: rgba(239, 68, 68, 0.1); color: #dc2626; }

                .os-details-panel {
                    background: var(--surface);
                    border-left: 1px solid var(--border);
                    display: flex;
                    flex-direction: column;
                    overflow: hidden;
                }

                .details-header {
                    padding: 24px;
                    border-bottom: 1px solid var(--border);
                }

                .details-header h2 {
                    font-size: 20px;
                    font-weight: 800;
                    margin: 0 0 12px 0;
                    color: var(--text);
                    line-height: 1.2;
                }

                .chat-container {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    overflow: hidden;
                    background: var(--chat-bg);
                }

                .messages-list {
                    flex: 1;
                    overflow-y: auto;
                    padding: 20px;
                    display: flex;
                    flex-direction: column;
                    gap: 16px;
                }

                .message-bubble {
                    max-width: 85%;
                    padding: 12px 16px;
                    border-radius: 16px;
                    font-size: 13px;
                    line-height: 1.5;
                    position: relative;
                    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
                }

                .message-admin {
                    align-self: flex-end;
                    background: var(--accent);
                    color: #000;
                    border-bottom-right-radius: 4px;
                    font-weight: 500;
                }

                .message-store {
                    align-self: flex-start;
                    background: var(--surface);
                    color: var(--text);
                    border-bottom-left-radius: 4px;
                    border: 1px solid var(--border);
                }

                .message-info {
                    font-size: 10px;
                    margin-bottom: 4px;
                    opacity: 0.7;
                    display: block;
                    font-weight: 700;
                    text-transform: uppercase;
                }

                .message-time {
                    font-size: 9px;
                    margin-top: 4px;
                    display: block;
                    text-align: right;
                    opacity: 0.6;
                }

                .chat-input-area {
                    padding: 20px;
                    background: var(--surface);
                    border-top: 1px solid var(--border);
                }

                .chat-form {
                    display: flex;
                    gap: 12px;
                }

                .chat-form input {
                    flex: 1;
                    background: var(--bg);
                    border: 1px solid var(--border);
                    border-radius: 12px;
                    padding: 12px 16px;
                    color: var(--text);
                    font-size: 13px;
                    outline: none;
                }

                .chat-form input:focus {
                    border-color: var(--accent);
                    background: var(--surface);
                }

                .send-btn {
                    background: var(--accent);
                    color: #000;
                    border: none;
                    border-radius: 12px;
                    width: 44px;
                    height: 44px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    transition: all 0.2s;
                    box-shadow: 0 2px 4px rgba(232, 184, 109, 0.2);
                }

                .send-btn:hover {
                    transform: scale(1.05);
                    filter: brightness(1.05);
                    box-shadow: 0 4px 8px rgba(232, 184, 109, 0.3);
                }

                .finalize-btn {
                    width: 100%;
                    background: #10b981;
                    color: white;
                    border: none;
                    padding: 12px;
                    border-radius: 12px;
                    font-size: 12px;
                    font-weight: 800;
                    text-transform: uppercase;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                    transition: all 0.2s;
                    box-shadow: 0 4px 12px rgba(16, 185, 129, 0.2);
                }

                .finalize-btn:hover {
                    background: #059669;
                    transform: translateY(-1px);
                    box-shadow: 0 6px 16px rgba(16, 185, 129, 0.3);
                }

                .action-btn-group {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 8px;
                    margin-top: 16px;
                }

                .action-btn-secondary {
                    background: var(--bg);
                    color: var(--text);
                    border: 1px solid var(--border);
                    padding: 10px;
                    border-radius: 10px;
                    font-size: 11px;
                    font-weight: 700;
                    text-transform: uppercase;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 6px;
                    transition: all 0.2s;
                }

                .action-btn-secondary:hover {
                    background: var(--border);
                }

                .action-btn-danger {
                    background: rgba(239, 68, 68, 0.1);
                    color: #ef4444;
                    border: 1px solid rgba(239, 68, 68, 0.2);
                    padding: 10px;
                    border-radius: 10px;
                    font-size: 11px;
                    font-weight: 700;
                    text-transform: uppercase;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 6px;
                    transition: all 0.2s;
                }

                .action-btn-danger:hover {
                    background: #ef4444;
                    color: white;
                }

                .modal-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0, 0, 0, 0.6);
                    backdrop-filter: blur(4px);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 1000;
                    padding: 20px;
                }

                .modal-content {
                    background: var(--surface);
                    width: 100%;
                    max-width: 500px;
                    border-radius: 24px;
                    padding: 32px;
                    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
                    border: 1px solid var(--border);
                }

                .modal-content h2 {
                    margin: 0 0 24px 0;
                    font-size: 24px;
                    font-weight: 800;
                    color: var(--text);
                }

                .form-group {
                    margin-bottom: 20px;
                }

                .form-group label {
                    display: block;
                    font-size: 12px;
                    font-weight: 700;
                    text-transform: uppercase;
                    color: var(--text-muted);
                    margin-bottom: 8px;
                    letter-spacing: 0.05em;
                }

                .form-group select {
                    width: 100%;
                    background: var(--bg);
                    border: 1px solid var(--border);
                    border-radius: 12px;
                    padding: 12px 16px;
                    color: var(--text);
                    font-size: 14px;
                    outline: none;
                    transition: all 0.2s;
                    cursor: pointer;
                }

                .form-group input:focus, 
                .form-group textarea:focus, 
                .form-group select:focus {
                    border-color: var(--accent);
                    box-shadow: 0 0 0 3px rgba(232, 184, 109, 0.1);
                }

                .empty-state {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    color: var(--text-muted);
                    gap: 16px;
                    text-align: center;
                    padding: 40px;
                }

                .empty-state h3 {
                    color: var(--text);
                    font-weight: 800;
                    margin: 0;
                }

                .no-scrollbar::-webkit-scrollbar { display: none; }
                .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
            `}</style>

            <div className="os-header">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-amber-600 dark:text-amber-400">
                            <ClipboardList size={24} />
                        </div>
                        <div>
                            <h1 className="text-xl font-black uppercase tracking-tight">Demanda OS</h1>
                            <p className="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase">Gerenciamento de Ordens de Serviço</p>
                        </div>
                    </div>
                    <button 
                        className="new-demand-btn sm:w-auto"
                        onClick={() => {
                            setEditingDemand(null);
                            setFormData({
                                title: '',
                                description: '',
                                category: 'Manutenção',
                                priority: 'media',
                                store_id: user.storeId || ''
                            });
                            setIsModalOpen(true);
                        }}
                    >
                        <Plus size={18} /> Nova Demanda
                    </button>
                </div>
                <div className="kpi-grid">
                    <div className="kpi-card">
                        <div className="kpi-icon" style={{ background: 'rgba(224, 92, 92, 0.1)', color: '#E05C5C' }}>
                            <AlertCircle size={24} />
                        </div>
                        <div className="kpi-info">
                            <h4>Críticos (Urgentes)</h4>
                            <p>{criticalCount}</p>
                        </div>
                    </div>
                    <div className="kpi-card">
                        <div className="kpi-icon">
                            <Clock size={24} />
                        </div>
                        <div className="kpi-info">
                            <h4>Tempo Médio Resposta</h4>
                            <p>{avgResponseTime}</p>
                        </div>
                    </div>
                    <div className="kpi-card">
                        <div className="kpi-icon">
                            <StoreIcon size={24} />
                        </div>
                        <div className="kpi-info">
                            <h4>Loja mais Ativa</h4>
                            <p>{mostActiveStore}</p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="os-main-content">
                {/* Coluna Esquerda: Filtros */}
                <div className="os-sidebar">
                    <button 
                        className="new-demand-btn"
                        onClick={() => {
                            setEditingDemand(null);
                            setFormData({
                                title: '',
                                description: '',
                                category: 'Manutenção',
                                priority: 'media',
                                store_id: user.storeId || ''
                            });
                            setIsModalOpen(true);
                        }}
                    >
                        <Plus size={18} /> Nova Demanda
                    </button>

                    <div className="filter-group">
                        <h5>Status</h5>
                        <button 
                            className={`filter-btn ${statusFilter === 'todos' ? 'active' : ''}`}
                            onClick={() => setStatusFilter('todos')}
                        >
                            Todos os Chamados
                        </button>
                        <button 
                            className={`filter-btn ${statusFilter === 'aberta' ? 'active' : ''}`}
                            onClick={() => setStatusFilter('aberta')}
                        >
                            Abertos
                        </button>
                        <button 
                            className={`filter-btn ${statusFilter === 'em_andamento' ? 'active' : ''}`}
                            onClick={() => setStatusFilter('em_andamento')}
                        >
                            Em Andamento
                        </button>
                        <button 
                            className={`filter-btn ${statusFilter === 'resolvida' ? 'active' : ''}`}
                            onClick={() => setStatusFilter('resolvida')}
                        >
                            Resolvidos
                        </button>
                    </div>

                    <div className="filter-group">
                        <h5>Categorias</h5>
                        {categories.map(cat => (
                            <button 
                                key={cat}
                                className={`filter-btn ${categoryFilter === cat ? 'active' : ''}`}
                                onClick={() => setCategoryFilter(cat)}
                                style={{ textTransform: 'capitalize' }}
                            >
                                {cat}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Coluna Central: Lista */}
                <div className="os-list-container">
                    <div className="os-list-header">
                        <div className="search-wrapper">
                            <Search size={16} />
                            <input 
                                type="text" 
                                placeholder="Buscar por título ou loja..." 
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="os-list no-scrollbar">
                        <button 
                            className="new-demand-btn lg:hidden w-full"
                            style={{ margin: '0 0 16px 0' }}
                            onClick={() => {
                                setEditingDemand(null);
                                setFormData({
                                    title: '',
                                    description: '',
                                    category: 'Manutenção',
                                    priority: 'media',
                                    store_id: user.storeId || ''
                                });
                                setIsModalOpen(true);
                            }}
                        >
                            <Plus size={18} /> Nova Demanda
                        </button>

                        {isLoading ? (
                            <div className="empty-state">
                                <Loader2 className="animate-spin" size={32} />
                                <p>Carregando demandas...</p>
                            </div>
                        ) : filteredDemands.length === 0 ? (
                            <div className="empty-state">
                                <AlertCircle size={48} />
                                <p>Nenhuma demanda encontrada.</p>
                            </div>
                        ) : (
                            filteredDemands.map(demand => (
                                <div 
                                    key={demand.id} 
                                    className={`demand-card ${selectedDemand?.id === demand.id ? 'active' : ''}`}
                                    onClick={() => {
                                        setSelectedDemand(demand);
                                        setShowMobileDetails(true);
                                    }}
                                >
                                    <div 
                                        className="priority-indicator" 
                                        style={{ background: getPriorityColor(demand.priority) }}
                                    />
                                    <div className="demand-card-header">
                                        <h3>{demand.title}</h3>
                                        <span className={`status-badge status-${demand.status}`}>
                                            {getStatusLabel(demand.status)}
                                        </span>
                                    </div>
                                    <div className="demand-meta">
                                        <span><StoreIcon size={12} /> {demand.store_name || 'Loja ' + demand.store_id}</span>
                                        <span><Clock size={12} /> {formatDistanceToNow(new Date(demand.created_at), { addSuffix: true, locale: ptBR })}</span>
                                        {demand.sla_hours > 0 && (
                                            <span style={{ color: 'var(--accent)' }}><AlertCircle size={12} /> SLA: {demand.sla_hours}h</span>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Coluna Direita: Detalhes e Chat */}
                <div className={`os-details-panel ${showMobileDetails ? 'mobile-open' : ''}`}>
                    {selectedDemand ? (
                        <>
                            <div className="details-header">
                                <div className="flex items-center justify-between mb-4 lg:hidden">
                                    <button 
                                        className="p-2 -ml-2 text-slate-400 hover:text-slate-900 dark:hover:text-white flex items-center gap-2 font-bold text-xs uppercase"
                                        onClick={() => setShowMobileDetails(false)}
                                    >
                                        <ArrowLeft size={18} /> Voltar
                                    </button>
                                    <span className={`status-badge status-${selectedDemand.status}`}>
                                        {getStatusLabel(selectedDemand.status)}
                                    </span>
                                </div>

                                <div className="demand-meta" style={{ marginBottom: '8px' }}>
                                    <span style={{ color: getPriorityColor(selectedDemand.priority), fontWeight: 700, textTransform: 'uppercase' }}>
                                        Prioridade {selectedDemand.priority}
                                    </span>
                                    <span>•</span>
                                    <span>{selectedDemand.category}</span>
                                </div>
                                <h2>{selectedDemand.title}</h2>
                                <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '8px 0' }}>
                                    {selectedDemand.description}
                                </p>
                                
                                {selectedDemand.status !== 'resolvida' && selectedDemand.status !== 'cancelada' && (
                                    <div className="action-btn-group">
                                        <button 
                                            className="finalize-btn" 
                                            style={{ gridColumn: 'span 2' }} 
                                            onClick={handleFinalizeDemand}
                                        >
                                            <CheckCircle size={18} /> Resolvido Demanda
                                        </button>
                                        
                                        {(user.role === 'ADMIN' || user.id === selectedDemand.created_by) && (
                                            <button 
                                                className="action-btn-secondary" 
                                                onClick={() => openEditModal(selectedDemand)}
                                            >
                                                <Edit2 size={16} /> Editar Demanda
                                            </button>
                                        )}
                                        
                                        {(user.role === 'ADMIN' || user.id === selectedDemand.created_by) && (
                                            <button 
                                                className="action-btn-danger" 
                                                onClick={handleCancelDemand}
                                            >
                                                <X size={16} /> Finalizar Demanda
                                            </button>
                                        )}

                                        {user.role === 'ADMIN' && (
                                            <button 
                                                className="action-btn-danger" 
                                                style={{ gridColumn: 'span 2', marginTop: '4px' }} 
                                                onClick={() => handleDeleteDemand(selectedDemand.id)}
                                            >
                                                <Trash2 size={16} /> Excluir Permanentemente
                                            </button>
                                        )}
                                    </div>
                                )}

                                {(selectedDemand.status === 'resolvida' || selectedDemand.status === 'cancelada') && user.role === 'ADMIN' && (
                                    <div className="mt-4">
                                        <button className="action-btn-secondary w-full" onClick={() => handleUpdateStatus(selectedDemand.id, 'aberta')}>
                                            <Plus size={14} /> Reabrir Chamado
                                        </button>
                                    </div>
                                )}
                            </div>

                            <div className="chat-container">
                                <div className="messages-list no-scrollbar">
                                    {messages.map(msg => (
                                        <div 
                                            key={msg.id} 
                                            className={`message-bubble ${msg.is_admin ? 'message-admin' : 'message-store'}`}
                                        >
                                            <span className="message-info">
                                                {msg.sender_name} {msg.is_admin && '(Admin)'}
                                            </span>
                                            {msg.message}
                                            <span className="message-time">
                                                {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </div>
                                    ))}
                                    <div ref={chatEndRef} />
                                </div>

                                <div className="chat-input-area">
                                    <form className="chat-form" onSubmit={handleSendMessage}>
                                        <input 
                                            type="text" 
                                            placeholder="Digite sua mensagem..." 
                                            value={newMessage}
                                            onChange={(e) => setNewMessage(e.target.value)}
                                            disabled={selectedDemand.status === 'resolvida' || selectedDemand.status === 'cancelada'}
                                        />
                                        <button 
                                            type="submit" 
                                            className="send-btn"
                                            disabled={!newMessage.trim() || isSending || selectedDemand.status === 'resolvida'}
                                        >
                                            {isSending ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} />}
                                        </button>
                                    </form>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="empty-state">
                            <MessageSquare size={64} style={{ opacity: 0.2 }} />
                            <h3>Selecione uma demanda</h3>
                            <p>Clique em um card na lista para ver os detalhes e o histórico de mensagens.</p>
                        </div>
                    )}
                </div>
            </div>

            {isModalOpen && (
                <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <h2>{editingDemand ? 'Editar Demanda' : 'Nova Demanda'}</h2>
                        <form onSubmit={handleSaveDemand}>
                            <div className="form-group">
                                <label>Título</label>
                                <input 
                                    type="text" 
                                    value={formData.title}
                                    onChange={e => setFormData({...formData, title: e.target.value})}
                                    placeholder="Ex: Ar condicionado quebrado"
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label>Descrição</label>
                                <textarea 
                                    value={formData.description}
                                    onChange={e => setFormData({...formData, description: e.target.value})}
                                    placeholder="Descreva o problema em detalhes..."
                                    rows={4}
                                    required
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="form-group">
                                    <label>Categoria</label>
                                    <select 
                                        value={formData.category}
                                        onChange={e => setFormData({...formData, category: e.target.value})}
                                    >
                                        <option value="Manutenção">Manutenção</option>
                                        <option value="TI / Sistemas">TI / Sistemas</option>
                                        <option value="Financeiro">Financeiro</option>
                                        <option value="RH">RH</option>
                                        <option value="Outros">Outros</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>Prioridade</label>
                                    <select 
                                        value={formData.priority}
                                        onChange={e => setFormData({...formData, priority: e.target.value as DemandPriority})}
                                    >
                                        <option value="baixa">Baixa</option>
                                        <option value="media">Média</option>
                                        <option value="alta">Alta</option>
                                        <option value="urgente">Urgente</option>
                                    </select>
                                </div>
                            </div>
                            {user.role === 'ADMIN' && (
                                <div className="form-group">
                                    <label>Loja</label>
                                    <select 
                                        value={formData.store_id}
                                        onChange={e => setFormData({...formData, store_id: e.target.value})}
                                        required
                                    >
                                        <option value="">Selecione uma loja</option>
                                        {stores.map(s => (
                                            <option key={s.id} value={s.id}>Loja {s.number} - {s.name}</option>
                                        ))}
                                    </select>
                                </div>
                            )}
                            <div className="flex gap-3 mt-8">
                                <button 
                                    type="button" 
                                    className="filter-btn" 
                                    style={{ flex: 1, textAlign: 'center' }}
                                    onClick={() => setIsModalOpen(false)}
                                >
                                    Cancelar
                                </button>
                                <button 
                                    type="submit" 
                                    className="new-demand-btn" 
                                    style={{ flex: 2, marginBottom: 0 }}
                                    disabled={isSubmitting}
                                >
                                    {isSubmitting ? <Loader2 className="animate-spin" /> : editingDemand ? 'Salvar Alterações' : 'Criar Demanda'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </section>
    );
};

export default OSDemandsModule;
