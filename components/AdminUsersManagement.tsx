
import React, { useState, useEffect } from 'react';
import { AdminUser, AdminRoleLevel, User } from '../types';
// Add missing 'Users' icon import from lucide-react.
import { UserPlus, Search, Edit3, Trash2, ShieldCheck, Mail, Lock, X, Save, Loader2, Power, ShieldAlert, BadgeCheck, Eye, UserCog, History, Users } from 'lucide-react';
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
        await supabase.from('system_logs').insert([{
            timestamp: new Date().toISOString(),
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
            
            // Adiciona senha apenas se preenchida (útil no update)
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
            password: '', // Senha não é retornada por segurança
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
            case 'super_admin': return { label: 'Super Admin', class: 'bg-purple-100 text-purple-700 border-purple-200', icon: ShieldCheck };
            case 'auditor': return { label: 'Auditor (Leitura)', class: 'bg-blue-100 text-blue-700 border-blue-200', icon: Eye };
            default: return { label: 'Admin', class: 'bg-gray-100 text-gray-700 border-gray-200', icon: UserCog };
        }
    };

    return (
        <div className="p-6 md:p-10 space-y-8 max-w-7xl mx-auto animate-in fade-in duration-500">
            {/* Stats Header */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-4">
                <div className="bg-white p-6 rounded-[32px] shadow-sm border border-gray-100">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl"><Users size={24}/></div>
                        <div><p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Total Gestores</p><p className="text-2xl font-black text-gray-900">{admins.length}</p></div>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-[32px] shadow-sm border border-gray-100">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-green-50 text-green-600 rounded-2xl"><BadgeCheck size={24}/></div>
                        <div><p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Ativos Agora</p><p className="text-2xl font-black text-gray-900">{admins.filter(a => a.status === 'active').length}</p></div>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-[32px] shadow-sm border border-gray-100">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-purple-50 text-purple-600 rounded-2xl"><History size={24}/></div>
                        <div><p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Ações Auditadas</p><p className="text-2xl font-black text-gray-900">100%</p></div>
                    </div>
                </div>
            </div>

            {/* Header Main */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-white p-8 rounded-[40px] shadow-sm border border-gray-100">
                <div>
                    <h2 className="text-3xl font-black text-gray-900 uppercase italic tracking-tighter leading-none flex items-center gap-3">
                        <ShieldCheck className="text-blue-700" size={36} />
                        Usuários <span className="text-red-600">Admin</span>
                    </h2>
                    <p className="text-gray-400 font-bold text-[10px] uppercase tracking-widest mt-2">Gestão de acessos globais e níveis de permissão</p>
                </div>
                <button 
                    onClick={() => { resetForm(); setIsModalOpen(true); }}
                    className="bg-gray-900 text-white px-8 py-4 rounded-3xl font-black uppercase text-xs shadow-xl hover:bg-black transition-all active:scale-95 flex items-center gap-2"
                >
                    <UserPlus size={18} /> Novo Administrador
                </button>
            </div>

            {/* Content Table */}
            <div className="bg-white rounded-[40px] shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-6 border-b border-gray-50 flex items-center px-8">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                        <input 
                            type="text" 
                            placeholder="Buscar por nome ou e-mail..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-12 pr-4 py-3 bg-gray-50 border-none rounded-2xl text-sm font-bold text-gray-700 focus:ring-4 focus:ring-blue-100 transition-all outline-none"
                        />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-gray-50 text-[10px] font-black text-gray-400 uppercase tracking-widest border-b">
                                <th className="px-8 py-5">Status / Nível</th>
                                <th className="px-8 py-5">Nome do Administrador</th>
                                <th className="px-8 py-5">E-mail de Acesso</th>
                                <th className="px-8 py-5">Última Atividade</th>
                                <th className="px-8 py-5 text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={5} className="py-20 text-center">
                                        <Loader2 className="animate-spin mx-auto text-blue-600" size={40} />
                                        <p className="mt-4 text-xs font-black text-gray-400 uppercase tracking-widest">Sincronizando com Supabase...</p>
                                    </td>
                                </tr>
                            ) : filteredAdmins.map(admin => {
                                const role = getRoleBadge(admin.role_level);
                                return (
                                    <tr key={admin.id} className={`hover:bg-gray-50 transition-colors group ${admin.status === 'inactive' ? 'opacity-60' : ''}`}>
                                        <td className="px-8 py-5">
                                            <div className="flex flex-col gap-2">
                                                <button 
                                                    onClick={() => toggleStatus(admin)}
                                                    className={`w-fit flex items-center gap-2 px-3 py-1 rounded-full text-[9px] font-black uppercase border transition-all ${admin.status === 'active' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-100 text-gray-400 border-gray-200'}`}
                                                >
                                                    <Power size={10} />
                                                    {admin.status === 'active' ? 'Ativo' : 'Inativo'}
                                                </button>
                                                <div className={`w-fit flex items-center gap-1.5 px-2 py-0.5 rounded border text-[8px] font-black uppercase ${role.class}`}>
                                                    <role.icon size={10} />
                                                    {role.label}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-8 py-5">
                                            <div className="font-black text-gray-900 uppercase italic text-sm">{admin.name}</div>
                                            {admin.id === currentUser?.id && <span className="text-[8px] font-black text-blue-500 uppercase tracking-tighter">(Você)</span>}
                                        </td>
                                        <td className="px-8 py-5 text-sm font-bold text-gray-500">
                                            {admin.email}
                                        </td>
                                        <td className="px-8 py-5 text-xs text-gray-400 font-medium">
                                            {admin.last_activity ? new Date(admin.last_activity).toLocaleString('pt-BR') : 'Sem registros'}
                                        </td>
                                        <td className="px-8 py-5 text-right">
                                            <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button onClick={() => openEdit(admin)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-xl transition-all"><Edit3 size={18} /></button>
                                                <button 
                                                    onClick={() => handleDelete(admin.id, admin.name)} 
                                                    disabled={admin.id === currentUser?.id}
                                                    className={`p-2 rounded-xl transition-all ${admin.id === currentUser?.id ? 'text-gray-200 cursor-not-allowed' : 'text-red-400 hover:bg-red-50'}`}
                                                >
                                                    <Trash2 size={18} />
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
                <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[120] p-4">
                    <div className="bg-white rounded-[48px] shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in duration-200">
                        <div className="p-8 bg-gray-50 border-b flex justify-between items-center">
                            <h3 className="text-2xl font-black text-gray-900 uppercase italic tracking-tighter">
                                {editingId ? 'Configurar' : 'Novo'} <span className="text-blue-700">Administrador</span>
                            </h3>
                            <button onClick={() => setIsModalOpen(false)} className="bg-white p-2 rounded-full text-gray-400 hover:text-gray-600 shadow-sm transition-colors"><X size={20} /></button>
                        </div>
                        
                        <form onSubmit={handleSave} className="p-10 space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-gray-400 uppercase block ml-1">Nome Completo *</label>
                                    <input 
                                        required
                                        value={formData.name}
                                        onChange={e => setFormData({...formData, name: e.target.value})}
                                        className="w-full px-4 py-4 bg-gray-50 border-none rounded-3xl font-bold text-gray-800 focus:ring-4 focus:ring-blue-100 transition-all outline-none"
                                        placeholder="Nome do gestor"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-gray-400 uppercase block ml-1">Nível de Acesso</label>
                                    <select 
                                        value={formData.role_level}
                                        onChange={e => setFormData({...formData, role_level: e.target.value as AdminRoleLevel})}
                                        className="w-full px-4 py-4 bg-gray-50 border-none rounded-3xl font-black text-gray-800 uppercase text-xs focus:ring-4 focus:ring-blue-100 transition-all outline-none appearance-none"
                                    >
                                        <option value="super_admin">Super Admin</option>
                                        <option value="admin">Admin</option>
                                        <option value="auditor">Auditor (Read Only)</option>
                                    </select>
                                </div>
                            </div>

                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-gray-400 uppercase block ml-1">E-mail Corporativo *</label>
                                <div className="relative">
                                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
                                    <input 
                                        required
                                        type="email"
                                        value={formData.email}
                                        onChange={e => setFormData({...formData, email: e.target.value})}
                                        className="w-full pl-12 pr-4 py-4 bg-gray-50 border-none rounded-3xl font-bold text-gray-800 focus:ring-4 focus:ring-blue-100 transition-all outline-none"
                                        placeholder="exemplo@me.com"
                                    />
                                </div>
                            </div>

                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-gray-400 uppercase block ml-1">Senha de Segurança</label>
                                <div className="relative">
                                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
                                    <input 
                                        required={!editingId}
                                        type="password"
                                        value={formData.password}
                                        onChange={e => setFormData({...formData, password: e.target.value})}
                                        className="w-full pl-12 pr-4 py-4 bg-gray-50 border-none rounded-3xl font-bold text-gray-800 focus:ring-4 focus:ring-blue-100 transition-all outline-none"
                                        placeholder={editingId ? "Deixe em branco para manter atual" : "••••••••"}
                                    />
                                </div>
                            </div>

                            <div className="p-8 bg-gray-50 -mx-10 -mb-10 flex gap-4 mt-8">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-5 bg-white border border-gray-200 rounded-3xl font-black text-gray-400 uppercase text-xs hover:bg-gray-100 transition-colors">Cancelar</button>
                                <button 
                                    type="submit" 
                                    disabled={isSubmitting}
                                    className="flex-1 py-5 bg-blue-700 text-white rounded-3xl font-black uppercase text-xs shadow-xl shadow-blue-200 flex items-center justify-center gap-2 hover:bg-blue-800 transition-all active:scale-95"
                                >
                                    {isSubmitting ? <Loader2 className="animate-spin" size={16} /> : <Save size={18} />}
                                    Salvar Credenciais
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
