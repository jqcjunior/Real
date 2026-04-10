
import React, { useState, useEffect } from 'react';
import { AdminUser, AdminRoleLevel, User, UserRole, Store } from '../types';
import { UserPlus, Search, Edit3, Trash2, ShieldCheck, Mail, Lock, X, Save, Loader2, Power, ShieldAlert, BadgeCheck, Eye, UserCog, History, Users as UsersIcon, Wallet, Briefcase, Shield, ChevronRight, IceCream, Building2 } from 'lucide-react';
import { supabase } from '../services/supabaseClient';

interface AdminUsersManagementProps {
    currentUser: User | null;
    stores: Store[];
}

const AdminUsersManagement: React.FC<AdminUsersManagementProps> = ({ currentUser, stores }) => {
    const [admins, setAdmins] = useState<AdminUser[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedRole, setSelectedRole] = useState<AdminRoleLevel | 'all'>('all');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    const [formData, setFormData] = useState<Partial<AdminUser>>({
        name: '', email: '', password: '', status: 'active', role_level: 'admin', store_id: null
    });
    const [editingId, setEditingId] = useState<string | null>(null);
    const [isResetModalOpen, setIsResetModalOpen] = useState(false);
    const [resetUser, setResetUser] = useState<AdminUser | null>(null);
    const [newResetPassword, setNewResetPassword] = useState('');

    const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'blocked'>('all');
    const [pendingUsers, setPendingUsers] = useState<AdminUser[]>([]);

    const filteredAdmins = admins
        .filter(admin => {
            const matchesSearch = (admin.name || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
                                 (admin.email || '').toLowerCase().includes(searchTerm.toLowerCase());
            const matchesRole = selectedRole === 'all' || admin.role_level === selectedRole;
            return matchesSearch && matchesRole;
        })
        .sort((a, b) => a.name.localeCompare(b.name));

    const fetchAdmins = async () => {
        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from('admin_users')
                .select('*')
                .neq('status', 'pending')
                .order('name', { ascending: true });
            if (error) throw error;
            if (data) setAdmins(data as AdminUser[]);
        } catch (err) {
            console.error("Erro ao carregar admins:", err);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchPendingUsers = async () => {
        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from('admin_users')
                .select('*')
                .eq('status', 'pending')
                .order('created_at', { ascending: false });
            if (error) throw error;
            setPendingUsers(data || []);
        } catch (err) {
            console.error("Erro ao buscar usuários pendentes:", err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (activeTab === 'all' || activeTab === 'blocked') {
            fetchAdmins();
        } else if (activeTab === 'pending') {
            fetchPendingUsers();
        }
    }, [activeTab]);

    const handleApprove = async (userId: string) => {
        try {
            const { data, error } = await supabase.rpc('admin_approve_user', {
                p_user_id: userId
            });
            
            if (error) throw error;
            
            if (data.success) {
                alert('Usuário aprovado!');
                fetchPendingUsers();
            } else {
                alert('Erro ao aprovar: ' + data.error);
            }
        } catch (err: any) {
            alert('Erro ao aprovar: ' + err.message);
        }
    };

    const handleReject = async (userId: string) => {
        const reason = prompt('Motivo da rejeição (opcional):');
        try {
            const { data, error } = await supabase.rpc('admin_reject_user', {
                p_user_id: userId,
                p_reason: reason
            });
            
            if (error) throw error;
            
            if (data.success) {
                alert('Usuário rejeitado!');
                fetchPendingUsers();
            } else {
                alert('Erro ao rejeitar: ' + data.error);
            }
        } catch (err: any) {
            alert('Erro ao rejeitar: ' + err.message);
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        const isNonAdmin = formData.role_level !== 'admin';
        if (isNonAdmin && !formData.store_id) {
            alert("Vínculo de Unidade obrigatório para este perfil.");
            return;
        }

        setIsSubmitting(true);
        try {
            const cleanStoreId = (formData.store_id && formData.store_id !== '') ? formData.store_id : null;
            const payload: any = { 
                name: formData.name?.toUpperCase().trim(), 
                email: formData.email?.trim().toLowerCase(), 
                status: formData.status,
                role_level: formData.role_level,
                store_id: cleanStoreId
            };
            if (formData.password && formData.password.trim() !== '') payload.password = formData.password.trim();

            if (editingId) {
                const { error } = await supabase.from('admin_users').update(payload).eq('id', editingId);
                if (error) throw error;
            } else {
                const { error } = await supabase.from('admin_users').insert([payload]);
                if (error) throw error;
            }
            
            await fetchAdmins();
            setIsModalOpen(false);
            setEditingId(null);
            setFormData({ name: '', email: '', password: '', status: 'active', role_level: 'admin', store_id: null });
            alert("Usuário atualizado!");
        } catch (err: any) {
            alert("Erro ao processar: " + err.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleResetPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!resetUser || !newResetPassword) return;
        setIsSubmitting(true);
        try {
            const { error } = await supabase
                .from('admin_users')
                .update({ password: newResetPassword.trim() })
                .eq('id', resetUser.id);
            if (error) throw error;
            alert(`Senha de ${resetUser.name} atualizada com sucesso!`);
            setIsResetModalOpen(false);
            setResetUser(null);
            setNewResetPassword('');
        } catch (err: any) {
            alert("Erro ao resetar senha: " + err.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async (id: string, name: string) => {
        if (id === currentUser?.id) { alert("Você não pode remover seu próprio acesso."); return; }
        if (!window.confirm(`Deseja remover o acesso de ${name.toUpperCase()}?`)) return;
        try {
            await supabase.from('admin_users').delete().eq('id', id);
            fetchAdmins();
        } catch (err) { alert("Erro ao deletar."); }
    };

    const getRoleBadge = (level: AdminRoleLevel) => {
        switch(level) {
            case 'admin': return { label: 'Administrador', class: 'bg-red-100 text-red-700 border-red-200', icon: Shield };
            case 'manager': return { label: 'Gerente', class: 'bg-blue-100 text-blue-700 border-blue-200', icon: Briefcase };
            case 'cashier': return { label: 'Caixa', class: 'bg-green-100 text-green-700 border-green-200', icon: Wallet };
            case 'sorvete': return { label: 'Sorvete', class: 'bg-purple-100 text-purple-700 border-purple-200', icon: IceCream };
            default: return { label: 'Usuário', class: 'bg-gray-100 text-gray-700 border-gray-200', icon: UserCog };
        }
    };

    return (
        <div className="p-4 md:p-10 space-y-6 md:space-y-8 max-w-7xl mx-auto animate-in fade-in duration-500 bg-slate-50 dark:bg-slate-950 min-h-full">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-white dark:bg-slate-900 p-6 md:p-8 rounded-[32px] md:rounded-[40px] shadow-sm border border-gray-100 dark:border-slate-800">
                <div className="flex items-center gap-4">
                    <div className="p-4 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 rounded-2xl"><UsersIcon size={32} /></div>
                    <div>
                        <h2 className="text-2xl md:text-3xl font-black text-gray-900 dark:text-white uppercase italic tracking-tighter leading-none">Gestão de <span className="text-red-600">Usuários</span></h2>
                        <p className="text-gray-400 dark:text-slate-500 font-bold text-[9px] uppercase tracking-widest mt-1">Matriz de Acessos Corporativos</p>
                    </div>
                </div>
                <button onClick={() => { setEditingId(null); setIsModalOpen(true); }} className="w-full md:w-auto bg-gray-950 dark:bg-slate-800 text-white px-8 py-4 rounded-2xl font-black uppercase text-[10px] shadow-xl hover:bg-black dark:hover:bg-slate-700 transition-all active:scale-95 border-b-4 border-red-700 flex items-center justify-center gap-2">
                    <UserPlus size={18} /> Novo Usuário
                </button>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-[32px] md:rounded-[40px] shadow-sm border border-gray-100 dark:border-slate-800 overflow-hidden">
                <div className="p-6 border-b dark:border-slate-800 bg-gray-50/30 dark:bg-slate-800/30 space-y-6">
                    <div className="flex border-b dark:border-slate-700">
                        <button 
                            onClick={() => setActiveTab('all')}
                            className={`px-6 py-3 text-xs font-black uppercase tracking-widest transition-all border-b-2 ${activeTab === 'all' ? 'border-red-600 text-red-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
                        >
                            Ativos / Bloqueados
                        </button>
                        <button 
                            onClick={() => setActiveTab('pending')}
                            className={`px-6 py-3 text-xs font-black uppercase tracking-widest transition-all border-b-2 ${activeTab === 'pending' ? 'border-red-600 text-red-600' : 'border-transparent text-gray-400 hover:text-gray-600'} flex items-center gap-2`}
                        >
                            Pendentes {pendingUsers.length > 0 && <span className="bg-red-600 text-white text-[10px] px-2 py-0.5 rounded-full">{pendingUsers.length}</span>}
                        </button>
                    </div>

                    {activeTab === 'all' && (
                        <>
                            <div className="flex flex-wrap gap-2">
                                <button 
                                    onClick={() => setSelectedRole('all')}
                                    className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all border ${selectedRole === 'all' ? 'bg-gray-950 text-white border-gray-950 shadow-md' : 'bg-white text-gray-400 border-gray-200 hover:border-gray-400'}`}
                                >
                                    Todos
                                </button>
                                <button 
                                    onClick={() => setSelectedRole('admin')}
                                    className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all border ${selectedRole === 'admin' ? 'bg-red-600 text-white border-red-600 shadow-md' : 'bg-white text-gray-400 border-gray-200 hover:border-red-200'}`}
                                >
                                    Admin
                                </button>
                                <button 
                                    onClick={() => setSelectedRole('manager')}
                                    className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all border ${selectedRole === 'manager' ? 'bg-blue-600 text-white border-blue-600 shadow-md' : 'bg-white text-gray-400 border-gray-200 hover:border-blue-200'}`}
                                >
                                    Gerente
                                </button>
                                <button 
                                    onClick={() => setSelectedRole('cashier')}
                                    className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all border ${selectedRole === 'cashier' ? 'bg-green-600 text-white border-green-600 shadow-md' : 'bg-white text-gray-400 border-gray-200 hover:border-green-200'}`}
                                >
                                    Caixa
                                </button>
                                <button 
                                    onClick={() => setSelectedRole('sorvete')}
                                    className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all border ${selectedRole === 'sorvete' ? 'bg-purple-600 text-white border-purple-600 shadow-md' : 'bg-white text-gray-400 border-gray-200 hover:border-purple-200'}`}
                                >
                                    Sorvete
                                </button>
                            </div>
                            <div className="relative max-w-md">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                <input type="text" placeholder="Pesquisar profissionais..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-12 pr-6 py-3 bg-white border border-gray-200 rounded-xl text-sm font-bold text-gray-700 focus:ring-4 focus:ring-blue-50 outline-none shadow-inner" />
                            </div>
                        </>
                    )}
                </div>

                <div className="overflow-x-auto no-scrollbar">
                    {activeTab === 'all' ? (
                        <table className="w-full text-left min-w-[900px]">
                            <thead>
                                <tr className="bg-white border-b border-gray-100 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                                    <th className="px-8 py-5">Perfil</th>
                                    <th className="px-8 py-5">Nome do Profissional</th>
                                    <th className="px-8 py-5">Unidade</th>
                                    <th className="px-8 py-5 text-right">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {isLoading ? (
                                    <tr><td colSpan={4} className="py-20 text-center"><Loader2 className="animate-spin mx-auto text-red-600" /></td></tr>
                                ) : filteredAdmins.map(admin => {
                                    const role = getRoleBadge(admin.role_level);
                                    const assignedStore = stores.find(s => s.id === admin.store_id);
                                    return (
                                        <tr key={admin.id} className="hover:bg-gray-50 transition-colors group">
                                            <td className="px-8 py-5">
                                                <div className={`w-fit flex items-center gap-1.5 px-2 py-1 rounded-lg border font-black uppercase text-[8px] ${role.class}`}>
                                                    <role.icon size={12} /> {role.label}
                                                </div>
                                            </td>
                                            <td className="px-8 py-5">
                                                <div className="font-black text-gray-900 uppercase italic text-sm tracking-tighter leading-none">{admin.name}</div>
                                                <div className="text-[9px] font-bold text-gray-400 uppercase mt-1">{admin.email}</div>
                                            </td>
                                            <td className="px-8 py-5 text-[10px] font-black uppercase italic text-blue-900">
                                                {admin.role_level === 'admin' ? 'Rede Real' : (assignedStore ? `UNID. ${assignedStore.number}` : '-')}
                                            </td>
                                            <td className="px-8 py-5 text-right">
                                                <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all">
                                                    <button 
                                                        onClick={() => { setResetUser(admin); setIsResetModalOpen(true); }} 
                                                        className="p-2 text-amber-600 hover:bg-amber-50 rounded-xl transition-all"
                                                        title="Resetar Senha"
                                                    >
                                                        <Lock size={18} />
                                                    </button>
                                                    <button onClick={() => { setEditingId(admin.id); setFormData(admin); setIsModalOpen(true); }} className="p-2 text-blue-600 hover:bg-blue-50 rounded-xl transition-all"><Edit3 size={18} /></button>
                                                    <button onClick={() => handleDelete(admin.id, admin.name)} className="p-2 text-red-300 hover:text-red-500 rounded-xl transition-all"><Trash2 size={18} /></button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    ) : (
                        <div className="p-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {isLoading ? (
                                <div className="col-span-full py-20 text-center"><Loader2 className="animate-spin mx-auto text-red-600" /></div>
                            ) : pendingUsers.length === 0 ? (
                                <div className="col-span-full py-20 text-center text-gray-400 font-bold uppercase tracking-widest text-xs">Nenhum usuário pendente</div>
                            ) : pendingUsers.map(user => (
                                <div key={user.id} className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 p-6 rounded-[32px] shadow-sm hover:shadow-md transition-all">
                                    <div className="flex justify-between items-start mb-4">
                                        <div>
                                            <h3 className="font-black text-gray-900 dark:text-white uppercase italic tracking-tighter text-lg leading-none">{user.name}</h3>
                                            <p className="text-[10px] font-bold text-gray-400 uppercase mt-1">{user.email}</p>
                                        </div>
                                        <div className={`px-2 py-1 rounded-lg border font-black uppercase text-[8px] ${getRoleBadge(user.role_level).class}`}>
                                            {getRoleBadge(user.role_level).label}
                                        </div>
                                    </div>
                                    <div className="space-y-2 mb-6">
                                        <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">
                                            Cadastrado em: {new Date(user.created_at).toLocaleDateString()}
                                        </p>
                                        <p className="text-[9px] font-black text-blue-600 uppercase tracking-widest">
                                            Unidade: {stores.find(s => s.id === user.store_id)?.name || 'NÃO DEFINIDA'}
                                        </p>
                                    </div>
                                    <div className="flex gap-3">
                                        <button 
                                            onClick={() => handleApprove(user.id)}
                                            className="flex-1 bg-green-600 text-white py-3 rounded-2xl font-black uppercase text-[10px] shadow-lg shadow-green-100 hover:bg-green-700 transition-all active:scale-95 flex items-center justify-center gap-2"
                                        >
                                            <BadgeCheck size={16} /> Aprovar
                                        </button>
                                        <button 
                                            onClick={() => handleReject(user.id)}
                                            className="flex-1 bg-red-50 text-red-600 py-3 rounded-2xl font-black uppercase text-[10px] hover:bg-red-100 transition-all active:scale-95 flex items-center justify-center gap-2 border border-red-100"
                                        >
                                            <X size={16} /> Rejeitar
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {isModalOpen && (
                <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-[120] p-4">
                    <div className="bg-white rounded-[48px] shadow-2xl w-full max-w-xl overflow-hidden animate-in zoom-in duration-300">
                        <div className="p-8 bg-gray-50 border-b flex justify-between items-center">
                            <h3 className="text-2xl font-black text-gray-900 uppercase italic tracking-tighter leading-none">{editingId ? 'Editar' : 'Novo'} <span className="text-red-600">Usuário</span></h3>
                            <button onClick={() => setIsModalOpen(false)} className="bg-white p-2 rounded-full text-gray-400 hover:text-red-600 shadow-sm border"><X size={20} /></button>
                        </div>
                        <form onSubmit={handleSave} className="p-10 space-y-6">
                            <div className="space-y-2">
                                <label className="text-[9px] font-black text-gray-400 uppercase ml-2 tracking-widest">Nome Completo</label>
                                <input required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full p-4 bg-gray-50 border-none rounded-2xl font-black text-gray-800 uppercase italic outline-none focus:ring-4 focus:ring-blue-50 transition-all" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-[9px] font-black text-gray-400 uppercase ml-2 tracking-widest">Papel</label>
                                    <select value={formData.role_level} onChange={e => setFormData({...formData, role_level: e.target.value as AdminRoleLevel})} className="w-full p-4 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl font-black uppercase text-xs text-slate-900 dark:text-white outline-none cursor-pointer">
                                        <option value="admin">Administrador</option>
                                        <option value="manager">Gerente</option>
                                        <option value="cashier">Caixa</option>
                                        <option value="sorvete">Sorvete</option>
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[9px] font-black text-gray-400 uppercase ml-2 tracking-widest">Unidade</label>
                                    <select value={formData.store_id || ''} onChange={e => setFormData({...formData, store_id: e.target.value || null})} className="w-full p-4 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl font-black uppercase text-xs text-slate-900 dark:text-white outline-none cursor-pointer">
                                        <option value="">TODAS AS LOJAS</option>
                                        {[...stores].sort((a, b) => (parseInt(a.number) || 0) - (parseInt(b.number) || 0)).map(s => <option key={s.id} value={s.id}>#{s.number} - {s.name}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[9px] font-black text-gray-400 uppercase ml-2 tracking-widest">E-mail Corporativo</label>
                                <input required type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full p-4 bg-gray-50 border-none rounded-2xl font-bold text-gray-700 outline-none" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[9px] font-black text-gray-400 uppercase ml-2 tracking-widest">Senha</label>
                                <input required={!editingId} type="password" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} className="w-full p-4 bg-gray-50 border-none rounded-2xl font-bold text-gray-700 outline-none" placeholder="••••••••" />
                            </div>
                            <button type="submit" disabled={isSubmitting} className="w-full py-5 bg-red-600 text-white rounded-[28px] font-black uppercase text-xs shadow-xl active:scale-95 transition-all border-b-4 border-red-900 flex items-center justify-center gap-2">
                                {isSubmitting ? <Loader2 className="animate-spin" /> : <Save size={18}/>} EFETIVAR USUÁRIO
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {isResetModalOpen && resetUser && (
                <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-[120] p-4">
                    <div className="bg-white rounded-[48px] shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in duration-300">
                        <div className="p-8 bg-amber-50 border-b flex justify-between items-center">
                            <h3 className="text-xl font-black text-gray-900 uppercase italic tracking-tighter leading-none">Resetar <span className="text-amber-600">Senha</span></h3>
                            <button onClick={() => setIsResetModalOpen(false)} className="bg-white p-2 rounded-full text-gray-400 hover:text-red-600 shadow-sm border"><X size={20} /></button>
                        </div>
                        <form onSubmit={handleResetPassword} className="p-10 space-y-6">
                            <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Usuário</p>
                                <p className="text-sm font-black text-blue-950 uppercase italic">{resetUser.name}</p>
                                <p className="text-[10px] font-bold text-gray-500">{resetUser.email}</p>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[9px] font-black text-gray-400 uppercase ml-2 tracking-widest">Nova Senha Temporária</label>
                                <input 
                                    required 
                                    type="password" 
                                    value={newResetPassword} 
                                    onChange={e => setNewResetPassword(e.target.value)} 
                                    className="w-full p-4 bg-gray-50 border-none rounded-2xl font-bold text-gray-700 outline-none focus:ring-4 focus:ring-amber-50 transition-all" 
                                    placeholder="••••••••"
                                />
                            </div>
                            <button type="submit" disabled={isSubmitting} className="w-full py-5 bg-amber-600 text-white rounded-[28px] font-black uppercase text-xs shadow-xl active:scale-95 transition-all border-b-4 border-amber-900 flex items-center justify-center gap-2">
                                {isSubmitting ? <Loader2 className="animate-spin" /> : <Save size={18}/>} CONFIRMAR RESET
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminUsersManagement;
