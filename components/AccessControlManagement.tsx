
import React, { useState, useEffect } from 'react';
import { PagePermission } from '../types';
import { ShieldCheck, Search, Plus, Save, Loader2, X, Check, Sliders, Info, Trash2, ShieldAlert, ChevronRight, Settings } from 'lucide-react';
import { supabase } from '../services/supabaseClient';

const AccessControlManagement: React.FC = () => {
    const [permissions, setPermissions] = useState<PagePermission[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    
    const [formData, setFormData] = useState<Partial<PagePermission>>({
        page_key: '',
        label: '',
        module_group: 'Operação',
        allow_admin: true,
        allow_manager: false,
        allow_cashier: false,
        allow_sorvete: false,
        sort_order: 100
    });

    const fetchPermissions = async () => {
        setIsLoading(true);
        try {
            const { data, error } = await supabase.from('page_permissions').select('*').order('sort_order', { ascending: true });
            if (error) throw error;
            if (data) setPermissions(data as PagePermission[]);
        } catch (err) {
            console.error("Erro ao carregar permissões:", err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchPermissions();
    }, []);

    const togglePermission = async (perm: PagePermission, roleField: 'allow_admin' | 'allow_manager' | 'allow_cashier' | 'allow_sorvete') => {
        const newValue = !perm[roleField];
        const { error } = await supabase.from('page_permissions').update({ [roleField]: newValue }).eq('id', perm.id);
        if (!error) {
            setPermissions(prev => prev.map(p => p.id === perm.id ? { ...p, [roleField]: newValue } : p));
        }
    };

    const handleSaveNewPage = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            const { error } = await supabase.from('page_permissions').insert([formData]);
            if (error) throw error;
            await fetchPermissions();
            setIsModalOpen(false);
            setFormData({ page_key: '', label: '', module_group: 'Operação', allow_admin: true, allow_manager: false, allow_cashier: false, allow_sorvete: false, sort_order: 100 });
        } catch (err: any) {
            alert("Erro ao adicionar página: " + err.message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeletePage = async (id: string, label: string) => {
        if (!window.confirm(`ATENÇÃO: Deseja remover o módulo "${label.toUpperCase()}" do sistema permanentemente?`)) return;
        const { error } = await supabase.from('page_permissions').delete().eq('id', id);
        if (!error) fetchPermissions();
    };

    const filteredPermissions = permissions.filter(p => 
        p.label.toLowerCase().includes(searchTerm.toLowerCase()) || 
        p.module_group.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="p-6 md:p-10 space-y-8 max-w-7xl mx-auto animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row justify-between items-center gap-6 bg-white p-10 rounded-[48px] shadow-sm border border-gray-100">
                <div className="flex items-center gap-6">
                    <div className="w-16 h-16 bg-gray-950 rounded-3xl flex items-center justify-center text-white shadow-2xl border-t-4 border-red-600">
                        <ShieldAlert size={32} />
                    </div>
                    <div>
                        <h2 className="text-3xl font-black text-gray-900 uppercase italic tracking-tighter leading-none">
                            Controle de <span className="text-red-600">Governança</span>
                        </h2>
                        <p className="text-gray-400 font-bold text-[10px] uppercase tracking-[0.3em] mt-3 flex items-center gap-2">
                           <Settings size={12} className="animate-spin-slow opacity-50" /> Matriz de Privilégios Corporativos
                        </p>
                    </div>
                </div>
                <button 
                    onClick={() => setIsModalOpen(true)}
                    className="bg-gray-950 text-white px-10 py-5 rounded-[24px] font-black uppercase text-xs shadow-2xl hover:bg-black transition-all active:scale-95 flex items-center gap-3 border-b-4 border-red-600"
                >
                    <Plus size={20} /> Registrar Novo Módulo
                </button>
            </div>

            <div className="bg-white rounded-[48px] shadow-xl border border-gray-100 overflow-hidden">
                <div className="p-8 border-b border-gray-50 flex flex-col md:flex-row justify-between items-center gap-6 bg-gray-50/30">
                    <div className="relative flex-1 max-w-lg w-full">
                        <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                        <input 
                            type="text" 
                            placeholder="Localizar funcionalidade ou grupo de módulos..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-14 pr-6 py-4 bg-white border border-gray-200 rounded-2xl text-sm font-bold text-gray-700 focus:ring-4 focus:ring-blue-100 transition-all outline-none shadow-inner"
                        />
                    </div>
                    <div className="flex items-center gap-3 text-gray-300 text-[10px] font-black uppercase tracking-[0.3em]">
                        <Sliders size={18} /> RBAC ENGINE v3.0
                    </div>
                </div>

                <div className="overflow-x-auto no-scrollbar">
                    <table className="w-full text-left min-w-[1000px]">
                        <thead>
                            <tr className="bg-white text-[11px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100">
                                <th className="px-10 py-6">Módulo / Título</th>
                                <th className="px-6 py-6 text-center bg-red-50/30">Administrador</th>
                                <th className="px-6 py-6 text-center bg-blue-50/30">Gerente</th>
                                <th className="px-6 py-6 text-center bg-green-50/30">Caixa</th>
                                <th className="px-6 py-6 text-center bg-purple-50/30">Sorvete</th>
                                <th className="px-6 py-6 text-right w-20"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={6} className="py-24 text-center">
                                        <Loader2 className="animate-spin mx-auto text-red-600" size={48} />
                                        <p className="mt-6 text-[10px] font-black text-gray-400 uppercase tracking-widest animate-pulse">Sincronizando Matriz de Acessos...</p>
                                    </td>
                                </tr>
                            ) : filteredPermissions.map(perm => (
                                <tr key={perm.id} className="hover:bg-gray-50 transition-all group">
                                    <td className="px-10 py-6">
                                        <div className="flex items-center gap-5">
                                            <div className="w-1 h-10 bg-red-600 rounded-full shadow-[0_0_10px_rgba(220,38,38,0.4)]"></div>
                                            <div>
                                                <div className="font-black text-gray-900 uppercase italic text-base tracking-tighter leading-none">{perm.label}</div>
                                                <div className="text-[9px] font-black text-blue-500 uppercase tracking-widest mt-2 flex items-center gap-1 opacity-70">
                                                    <ChevronRight size={10} /> {perm.module_group} <span className="mx-2 text-gray-200">|</span> KEY: {perm.page_key}
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    
                                    <td className="px-6 py-6 text-center bg-red-50/10">
                                        <button 
                                            onClick={() => togglePermission(perm, 'allow_admin')} 
                                            className={`w-12 h-12 rounded-2xl transition-all active:scale-90 flex items-center justify-center border-2 ${perm.allow_admin ? 'bg-red-600 text-white border-red-500 shadow-xl shadow-red-100' : 'bg-white text-gray-200 border-gray-100 hover:border-red-200 hover:text-red-200'}`}
                                        >
                                            {perm.allow_admin ? <Check size={24} strokeWidth={4} /> : <X size={20} />}
                                        </button>
                                    </td>

                                    <td className="px-6 py-6 text-center bg-blue-50/10">
                                        <button 
                                            onClick={() => togglePermission(perm, 'allow_manager')} 
                                            className={`w-12 h-12 rounded-2xl transition-all active:scale-90 flex items-center justify-center border-2 ${perm.allow_manager ? 'bg-blue-600 text-white border-blue-500 shadow-xl shadow-blue-100' : 'bg-white text-gray-200 border-gray-100 hover:border-blue-200 hover:text-blue-200'}`}
                                        >
                                            {perm.allow_manager ? <Check size={24} strokeWidth={4} /> : <X size={20} />}
                                        </button>
                                    </td>

                                    <td className="px-6 py-6 text-center bg-green-50/10">
                                        <button 
                                            onClick={() => togglePermission(perm, 'allow_cashier')} 
                                            className={`w-12 h-12 rounded-2xl transition-all active:scale-90 flex items-center justify-center border-2 ${perm.allow_cashier ? 'bg-green-600 text-white border-green-500 shadow-xl shadow-green-100' : 'bg-white text-gray-200 border-gray-100 hover:border-green-200 hover:text-green-200'}`}
                                        >
                                            {perm.allow_cashier ? <Check size={24} strokeWidth={4} /> : <X size={20} />}
                                        </button>
                                    </td>

                                    <td className="px-6 py-6 text-center bg-purple-50/10">
                                        <button 
                                            onClick={() => togglePermission(perm, 'allow_sorvete')} 
                                            className={`w-12 h-12 rounded-2xl transition-all active:scale-90 flex items-center justify-center border-2 ${perm.allow_sorvete ? 'bg-purple-600 text-white border-purple-500 shadow-xl shadow-purple-100' : 'bg-white text-gray-200 border-gray-100 hover:border-purple-200 hover:text-purple-200'}`}
                                        >
                                            {perm.allow_sorvete ? <Check size={24} strokeWidth={4} /> : <X size={20} />}
                                        </button>
                                    </td>

                                    <td className="px-10 py-6 text-right">
                                        <button 
                                            onClick={() => handleDeletePage(perm.id, perm.label)} 
                                            className="p-3 text-gray-200 hover:text-red-600 hover:bg-red-50 rounded-2xl transition-all opacity-0 group-hover:opacity-100"
                                        >
                                            <Trash2 size={20} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default AccessControlManagement;
