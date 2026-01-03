
import React, { useState, useEffect } from 'react';
import { AdminUser, AdminRoleLevel, User, UserRole } from '../types';
// Fix: Added missing ChevronRight import from lucide-react
import { UserPlus, Search, Edit3, Trash2, ShieldCheck, Mail, Lock, X, Save, Loader2, Power, ShieldAlert, BadgeCheck, Eye, UserCog, History, Users, Wallet, Briefcase, Shield, ChevronRight } from 'lucide-react';
import { supabase } from '../services/supabaseClient';

interface AdminUsersManagementProps {
    currentUser: User | null;
}

const AdminUsersManagement: React.FC<AdminUsersManagementProps> = ({ currentUser }) => {
    const [admins, setAdmins] = useState<AdminUser[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    const [formData, setFormData] = useState<Partial<AdminUser>>({
        name: '',
        email: '',
        password: '',
        status: 'active',
        role_level: 'admin'
    });
    const [editingId, setEditingId] = useState<string | null>(null);

    const fetchAdmins = async () => {
        setIsLoading(true);
        try {
            const { data, error } = await supabase.from('admin_users').select('*').order('name', { ascending: true });
            if (error) throw error;
            if (data) setAdmins(data as AdminUser[]);
        } catch (err) {
            console.error("Erro ao carregar admins:", err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchAdmins();
    }, []);

    const logAction = async (action: string, details: string) => {
        if (!currentUser) return;
        // FIX: Alterada a coluna 'timestamp' para 'created_at' conforme schema atual.
        await supabase.from('system_logs').insert([{
            created_at: new Date().toISOString(),
            userId: currentUser.id,
            userName: currentUser.name,
            userRole: currentUser.role,
            action: action,
            details: details
        }]);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            const payload = { 
                name: formData.name, 
                email: formData.email?.trim().toLowerCase(), 
                status: formData.status,
                role_level: formData.role_level
            };
            
            if (formData.password) {
                Object.assign(payload, { password: formData.password });
            }

            if (editingId) {
                const { error } = await supabase.from('admin_users').update(payload).eq('id', editingId);
                if (error) throw error;
                await logAction('UPDATE_ADMIN', `Atualizou dados do admin ${payload.name}`);
            } else {
                const { error } = await supabase.from('admin_users').insert([payload]);
                if (error) throw error;
                await logAction('CREATE_ADMIN', `Criou novo admin ${payload.name} com nível ${payload.role_level}`);
            }
            await fetchAdmins();
            setIsModalOpen(false);
            resetForm();
        } catch (err: any) {
            alert("Erro ao processar requisição: " + (err.message || "E-mail possivelmente já cadastrado."));
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async (id: string, name: string) => {
        if (id === currentUser?.id) {
            alert("Operação bloqueada: Você não pode remover seu próprio acesso administrativo.");
            return;
        }

        if (!window.confirm(`ATENÇÃO: Deseja remover permanentemente o acesso de ${name.toUpperCase()}?`)) return;
        
        try {
            const { error } = await supabase.from('admin_users').delete().eq('id', id);
            if (error) throw error;
            await logAction('DELETE_ADMIN', `Removeu o administrador ${name}`);
            fetchAdmins();
        } catch (err) {
            alert("Erro ao deletar administrador.");
        }
    };

    const toggleStatus = async (user: AdminUser) => {
        if (user.id === currentUser?.id) {
            alert("Você não pode desativar sua própria conta.");
            return;
        }
        const newStatus = user.status === 'active' ? 'inactive' : 'active';
        const { error } = await supabase.from('admin_users').update({ status: newStatus }).eq('id', user.id);
        if (!error) {
            await logAction('TOGGLE_ADMIN_STATUS', `Alterou status de ${user.name} para ${newStatus}`);
            fetchAdmins();
        }
    };

    const openEdit = (user: AdminUser) => {
        setEditingId(user.id);
        setFormData({ 
            name: user.name, 
            email: user.email, 
            password: '', 
            status: user.status,
            role_level: user.role_level || 'admin'
        });
        setIsModalOpen(true);
    };

    const resetForm = () => {
        setEditingId(null);
        setFormData({ name: '', email: '', password: '', status: 'active', role_level: 'admin' });
    };

    const filteredAdmins = admins.filter(a => 
        a.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        a.email.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const getRoleBadge = (level: AdminRoleLevel) => {
        switch(level) {
            case 'super_admin': return { label: 'Administrador Global', class: 'bg-red-100 text-red-700 border-red-200', icon: Shield };
            case 'admin': return { label: 'Gerente Administrativo', class: 'bg-blue-100 text-blue-700 border-blue-200', icon: Briefcase };
            case 'auditor': return { label: 'Caixa / Operacional', class: 'bg-green-100 text-green-700 border-green-200', icon: Wallet };
            default: return { label: 'Usuário', class: 'bg-gray-100 text-gray-700 border-gray-200', icon: UserCog };
        }
    };

    return (
        <div className="p-6 md:p-10 space-y-8 max-w-7xl mx-auto animate-in fade-in duration-500">
            {/* Stats Header */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-4">
                <div className="bg-white p-8 rounded-[32px] shadow-sm border border-gray-100 flex items-center justify-between group hover:border-blue-200 transition-all">
                    <div>
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Acessos Ativos</p>
                        <p className="text-4xl font-black text-gray-900 italic tracking-tighter">{admins.filter(a => a.status === 'active').length}</p>
                    </div>
                    <div className="p-4 bg-blue-50 text-blue-600 rounded-3xl group-hover:scale-110 transition-transform"><Users size={32}/></div>
                </div>
                <div className="bg-white p-8 rounded-[32px] shadow-sm border border-gray-100 flex items-center justify-between group hover:border-red-200 transition-all">
                    <div>
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Nível Admin</p>
                        <p className="text-4xl font-black text-gray-900 italic tracking-tighter">{admins.filter(a => a.role_level === 'super_admin').length}</p>
                    </div>
                    <div className="p-4 bg-red-50 text-red-600 rounded-3xl group-hover:scale-110 transition-transform"><Shield size={32}/></div>
                </div>
                <div className="bg-white p-8 rounded-[32px] shadow-sm border border-gray-100 flex items-center justify-between group hover:border-green-200 transition-all">
                    <div>
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Auditado por IA</p>
                        <p className="text-4xl font-black text-gray-900 italic tracking-tighter">Sinc</p>
                    </div>
                    <div className="p-4 bg-green-50 text-green-600 rounded-3xl group-hover:scale-110 transition-transform"><History size={32}/></div>
                </div>
            </div>

            {/* Header Main */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-white p-8 rounded-[40px] shadow-sm border border-gray-100">
                <div>
                    <h2 className="text-4xl font-black text-gray-900 uppercase italic tracking-tighter leading-none flex items-center gap-3">
                        <ShieldCheck className="text-blue-700" size={42} />
                        Gestão de <span className="text-red-600">Papéis</span>
                    </h2>
                    <p className="text-gray-400 font-bold text-xs uppercase tracking-widest mt-3">Configuração de permissões e hierarquia de acesso</p>
                </div>
                <button 
                    onClick={() => { resetForm(); setIsModalOpen(true); }}
                    className="bg-gray-950 text-white px-10 py-5 rounded-[24px] font-black uppercase text-xs shadow-2xl hover:bg-black transition-all active:scale-95 flex items-center gap-3 border-b-4 border-red-700"
                >
                    <UserPlus size={20} /> Novo Operador de Sistema
                </button>
            </div>

            {/* Content Table */}
            <div className="bg-white rounded-[40px] shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-8 border-b border-gray-50 flex items-center px-10 bg-gray-50/30">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                        <input 
                            type="text" 
                            placeholder="Pesquisar por nome ou e-mail corporativo..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-14 pr-6 py-4 bg-white border border-gray-200 rounded-2xl text-sm font-bold text-gray-700 focus:ring-4 focus:ring-blue-100 transition-all outline-none shadow-inner"
                        />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-white border-b border-gray-100 text-[11px] font-black text-gray-400 uppercase tracking-widest">
                                <th className="px-10 py-6">Papel / Nível de Acesso</th>
                                <th className="px-10 py-6">Identificação Profissional</th>
                                <th className="px-10 py-6">Acesso (E-mail)</th>
                                <th className="px-10 py-6">Último Login</th>
                                <th className="px-10 py-6 text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={5} className="py-24 text-center">
                                        <Loader2 className="animate-spin mx-auto text-red-600" size={48} />
                                        <p className="mt-6 text-xs font-black text-gray-400 uppercase tracking-widest animate-pulse">Sincronizando permissões globais...</p>
                                    </td>
                                </tr>
                            ) : filteredAdmins.map(admin => {
                                const role = getRoleBadge(admin.role_level);
                                return (
                                    <tr key={admin.id} className={`hover:bg-gray-50 transition-colors group ${admin.status === 'inactive' ? 'opacity-40 grayscale' : ''}`}>
                                        <td className="px-10 py-6">
                                            <div className="flex flex-col gap-3">
                                                <div className={`w-fit flex items-center gap-2 px-3 py-1.5 rounded-xl border-2 font-black uppercase text-[10px] ${role.class}`}>
                                                    <role.icon size={14} />
                                                    {role.label}
                                                </div>
                                                <button 
                                                    onClick={() => toggleStatus(admin)}
                                                    className={`w-fit flex items-center gap-2 px-2 py-0.5 rounded-lg text-[9px] font-black uppercase border transition-all ${admin.status === 'active' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-100 text-gray-400 border-gray-200'}`}
                                                >
                                                    <Power size={10} />
                                                    {admin.status === 'active' ? 'Ativo' : 'Inativo'}
                                                </button>
                                            </div>
                                        </td>
                                        <td className="px-10 py-6">
                                            <div className="font-black text-gray-900 uppercase italic text-base tracking-tighter">{admin.name}</div>
                                            {admin.id === currentUser?.id && <span className="bg-blue-100 text-blue-700 text-[8px] font-black px-1.5 py-0.5 rounded uppercase mt-1 inline-block">Sua Conta</span>}
                                        </td>
                                        <td className="px-10 py-6 text-sm font-bold text-gray-500">
                                            {admin.email}
                                        </td>
                                        <td className="px-10 py-6 text-xs text-gray-400 font-black uppercase">
                                            {admin.last_activity ? new Date(admin.last_activity).toLocaleString('pt-BR') : 'Aguardando Login'}
                                        </td>
                                        <td className="px-10 py-6 text-right">
                                            <div className="flex justify-end gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button onClick={() => openEdit(admin)} className="p-3 bg-white text-blue-600 border-2 border-blue-50 hover:bg-blue-600 hover:text-white rounded-2xl shadow-sm transition-all"><Edit3 size={20} /></button>
                                                <button 
                                                    onClick={() => handleDelete(admin.id, admin.name)} 
                                                    disabled={admin.id === currentUser?.id}
                                                    className={`p-3 border-2 rounded-2xl shadow-sm transition-all ${admin.id === currentUser?.id ? 'bg-gray-50 text-gray-200 border-gray-100 cursor-not-allowed' : 'bg-white text-red-400 border-red-50 hover:bg-red-600 hover:text-white'}`}
                                                >
                                                    <Trash2 size={20} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* MODAL CRUD */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/90 backdrop-blur-xl flex items-center justify-center z-[120] p-4">
                    <div className="bg-white rounded-[60px] shadow-2xl w-full max-w-xl overflow-hidden animate-in zoom-in duration-300">
                        <div className="p-10 bg-gray-50 border-b flex justify-between items-center">
                            <div>
                                <h3 className="text-3xl font-black text-gray-900 uppercase italic tracking-tighter leading-none">
                                    {editingId ? 'Editar' : 'Novo'} <span className="text-red-600">Operador</span>
                                </h3>
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-2">Defina o nível de acesso ao ecossistema</p>
                            </div>
                            <button onClick={() => setIsModalOpen(false)} className="bg-white p-3 rounded-full text-gray-400 hover:text-red-600 shadow-xl transition-all border border-gray-100"><X size={24} /></button>
                        </div>
                        
                        <form onSubmit={handleSave} className="p-12 space-y-8">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-gray-500 uppercase block ml-1 tracking-widest">Nome do Profissional *</label>
                                    <input 
                                        required
                                        value={formData.name}
                                        onChange={e => setFormData({...formData, name: e.target.value})}
                                        className="w-full px-6 py-5 bg-gray-50 border-none rounded-[24px] font-black text-gray-800 uppercase italic text-sm focus:ring-4 focus:ring-blue-100 transition-all outline-none"
                                        placeholder="EX: JOÃO DA SILVA"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-gray-500 uppercase block ml-1 tracking-widest">Papel no Sistema (Role)</label>
                                    <div className="relative">
                                        <select 
                                            value={formData.role_level}
                                            onChange={e => setFormData({...formData, role_level: e.target.value as AdminRoleLevel})}
                                            className="w-full px-6 py-5 bg-gray-50 border-none rounded-[24px] font-black text-gray-800 uppercase text-xs focus:ring-4 focus:ring-blue-100 transition-all outline-none appearance-none cursor-pointer shadow-inner"
                                        >
                                            <option value="super_admin">Administrador Global (Total)</option>
                                            <option value="admin">Gerente de Sistema</option>
                                            <option value="auditor">Operador / Caixa</option>
                                        </select>
                                        <ChevronRight className="absolute right-5 top-1/2 -translate-y-1/2 rotate-90 text-gray-400 pointer-events-none" size={18} />
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-gray-500 uppercase block ml-1 tracking-widest">E-mail Corporativo (Acesso) *</label>
                                <div className="relative">
                                    <Mail className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-300" size={20} />
                                    <input 
                                        required
                                        type="email"
                                        value={formData.email}
                                        onChange={e => setFormData({...formData, email: e.target.value})}
                                        className="w-full pl-16 pr-6 py-5 bg-gray-50 border-none rounded-[24px] font-bold text-gray-800 focus:ring-4 focus:ring-blue-100 transition-all outline-none"
                                        placeholder="exemplo@realcalcados.com.br"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-gray-500 uppercase block ml-1 tracking-widest">Senha de Segurança Privada</label>
                                <div className="relative">
                                    <Lock className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-300" size={20} />
                                    <input 
                                        required={!editingId}
                                        type="password"
                                        value={formData.password}
                                        onChange={e => setFormData({...formData, password: e.target.value})}
                                        className="w-full pl-16 pr-6 py-5 bg-gray-50 border-none rounded-[24px] font-bold text-gray-800 focus:ring-4 focus:ring-blue-100 transition-all outline-none"
                                        placeholder={editingId ? "DEIXE EM BRANCO PARA MANTER ATUAL" : "••••••••"}
                                    />
                                </div>
                                <p className="text-[9px] text-gray-400 font-bold uppercase tracking-tighter mt-1 ml-1">Utilize pelo menos 8 caracteres com letras e números.</p>
                            </div>

                            <div className="p-10 bg-gray-50 -mx-12 -mb-12 flex gap-5 mt-10">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-5 bg-white border-2 border-gray-200 rounded-[28px] font-black text-gray-500 uppercase text-xs hover:bg-gray-100 transition-all active:scale-95">CANCELAR</button>
                                <button 
                                    type="submit" 
                                    disabled={isSubmitting}
                                    className="flex-1 py-5 bg-red-600 text-white rounded-[28px] font-black uppercase text-xs shadow-2xl shadow-red-200 flex items-center justify-center gap-3 hover:bg-red-700 transition-all active:scale-95"
                                >
                                    {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                                    CONFIRMAR ACESSO
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminUsersManagement;
