
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
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    const [formData, setFormData] = useState<Partial<AdminUser>>({
        name: '', email: '', password: '', status: 'active', role_level: 'admin', store_id: null
    });
    const [editingId, setEditingId] = useState<string | null>(null);

    const filteredAdmins = admins.filter(admin => 
        admin.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        admin.email.toLowerCase().includes(searchTerm.toLowerCase())
    );

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

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        const isNonAdmin = formData.role_level !== 'admin';
        if (isNonAdmin && !formData.store_id) {
            alert("Vínculo de Unidade obrigatório para este perfil.");
            return;
        }

        setIsSubmitting(true);
        try {
            const cleanStoreId = (isNonAdmin && formData.store_id && formData.store_id !== '') ? formData.store_id : null;
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
        <div className="p-4 md:p-10 space-y-6 md:space-y-8 max-w-7xl mx-auto animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-white p-6 md:p-8 rounded-[32px] md:rounded-[40px] shadow-sm border border-gray-100">
                <div className="flex items-center gap-4">
                    <div className="p-4 bg-blue-50 text-blue-700 rounded-2xl"><UsersIcon size={32} /></div>
                    <div>
                        <h2 className="text-2xl md:text-3xl font-black text-gray-900 uppercase italic tracking-tighter leading-none">Gestão de <span className="text-red-600">Usuários</span></h2>
                        <p className="text-gray-400 font-bold text-[9px] uppercase tracking-widest mt-1">Matriz de Acessos Corporativos</p>
                    </div>
                </div>
                <button onClick={() => { setEditingId(null); setIsModalOpen(true); }} className="w-full md:w-auto bg-gray-950 text-white px-8 py-4 rounded-2xl font-black uppercase text-[10px] shadow-xl hover:bg-black transition-all active:scale-95 border-b-4 border-red-700 flex items-center justify-center gap-2">
                    <UserPlus size={18} /> Novo Usuário
                </button>
            </div>

            <div className="bg-white rounded-[32px] md:rounded-[40px] shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-6 border-b bg-gray-50/30">
                    <div className="relative max-w-md">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input type="text" placeholder="Pesquisar profissionais..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-12 pr-6 py-3 bg-white border border-gray-200 rounded-xl text-sm font-bold text-gray-700 focus:ring-4 focus:ring-blue-50 outline-none shadow-inner" />
                    </div>
                </div>

                <div className="overflow-x-auto no-scrollbar">
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
                                                <button onClick={() => { setEditingId(admin.id); setFormData(admin); setIsModalOpen(true); }} className="p-2 text-blue-600 hover:bg-blue-50 rounded-xl transition-all"><Edit3 size={18} /></button>
                                                <button onClick={() => handleDelete(admin.id, admin.name)} className="p-2 text-red-300 hover:text-red-500 rounded-xl transition-all"><Trash2 size={18} /></button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
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
                                    <select value={formData.role_level} onChange={e => setFormData({...formData, role_level: e.target.value as AdminRoleLevel})} className="w-full p-4 bg-gray-50 rounded-2xl font-black uppercase text-xs outline-none cursor-pointer">
                                        <option value="admin">Administrador</option>
                                        <option value="manager">Gerente</option>
                                        <option value="cashier">Caixa</option>
                                        <option value="sorvete">Sorvete</option>
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[9px] font-black text-gray-400 uppercase ml-2 tracking-widest">Unidade</label>
                                    <select value={formData.store_id || ''} onChange={e => setFormData({...formData, store_id: e.target.value || null})} className="w-full p-4 bg-gray-50 rounded-2xl font-black uppercase text-xs outline-none cursor-pointer">
                                        <option value="">TODAS AS LOJAS</option>
                                        {stores.map(s => <option key={s.id} value={s.id}>#{s.number} - {s.city}</option>)}
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
        </div>
    );
};

export default AdminUsersManagement;
