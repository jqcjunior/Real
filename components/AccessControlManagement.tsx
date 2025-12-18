
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

    const togglePermission = async (perm: PagePermission, roleField: 'allow_admin' | 'allow_manager' | 'allow_cashier') => {
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
            setFormData({ page_key: '', label: '', module_group: 'Operação', allow_admin: true, allow_manager: false, allow_cashier: false, sort_order: 100 });
        } catch (err: any) {
            alert("Erro ao adicionar página: " + err.message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeletePage = async (id: string, label: string) => {
        if (!window.confirm(`Remover o módulo "${label}"?`)) return;
        const { error } = await supabase.from('page_permissions').delete().eq('id', id);
        if (!error) fetchPermissions();
    };

    const filteredPermissions = permissions.filter(p => 
        p.label.toLowerCase().includes(searchTerm.toLowerCase()) || 
        p.module_group.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="p-4 md:p-8 space-y-6 max-w-6xl mx-auto animate-in fade-in duration-500">
            {/* Header - Compacto e elegante */}
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-gray-900 rounded-xl flex items-center justify-center text-white shadow-lg">
                        <ShieldAlert size={24} />
                    </div>
                    <div>
                        <h2 className="text-xl font-black text-gray-900 uppercase italic tracking-tighter leading-none">
                            Controle de <span className="text-red-600">Acessos</span>
                        </h2>
                        <p className="text-gray-400 font-bold text-[9px] uppercase tracking-widest mt-1 flex items-center gap-2">
                           <Settings size={10} className="animate-spin-slow opacity-50" /> Matriz de Permissões Corporativas
                        </p>
                    </div>
                </div>
                <button 
                    onClick={() => setIsModalOpen(true)}
                    aria-label="Registrar novo módulo"
                    className="bg-gray-900 text-white px-6 py-3 rounded-xl font-black uppercase text-[10px] shadow-md hover:bg-black transition-all active:scale-95 flex items-center gap-2 border-b-2 border-red-600"
                >
                    <Plus size={16} /> Novo Módulo
                </button>
            </div>

            {/* Matrix - Deep Dark and Refined */}
            <div className="bg-[#0f0f0f] rounded-3xl shadow-xl border border-white/5 overflow-hidden">
                <div className="p-5 border-b border-white/5 flex flex-col md:flex-row justify-between items-center gap-4 bg-black/40">
                    <div className="relative flex-1 max-w-md w-full">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                        <input 
                            type="text" 
                            placeholder="Pesquisar módulo ou grupo..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-xl text-xs font-bold text-white placeholder-white/20 focus:ring-2 focus:ring-red-600/50 transition-all outline-none"
                        />
                    </div>
                    <div className="flex items-center gap-2 text-white/20 text-[9px] font-black uppercase tracking-[0.3em]">
                        <Sliders size={14} /> Sistema RBAC v2.8
                    </div>
                </div>

                <div className="overflow-x-auto no-scrollbar">
                    <table className="w-full text-left min-w-[600px]">
                        <thead>
                            <tr className="bg-black/60 text-[9px] font-black text-white/40 uppercase tracking-widest border-b border-white/10">
                                <th className="px-6 py-4">Módulo / Funcionalidade</th>
                                <th className="px-4 py-4 text-center">Admin</th>
                                <th className="px-4 py-4 text-center">Gerente</th>
                                <th className="px-4 py-4 text-center">Caixa</th>
                                <th className="px-4 py-4 text-right w-16"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={5} className="py-20 text-center">
                                        <Loader2 className="animate-spin mx-auto text-red-600" size={32} />
                                        <p className="mt-4 text-[9px] font-black text-white/20 uppercase tracking-widest animate-pulse">Sincronizando banco...</p>
                                    </td>
                                </tr>
                            ) : filteredPermissions.map(perm => (
                                <tr key={perm.id} className="hover:bg-white/5 transition-all group">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-4">
                                            <div className="w-1 h-8 bg-red-600 rounded-full shadow-[0_0_8px_rgba(220,38,38,0.4)]"></div>
                                            <div>
                                                <div className="font-black text-white uppercase italic text-sm tracking-tight leading-none">{perm.label}</div>
                                                <div className="text-[8px] font-black text-red-500/60 uppercase tracking-widest mt-1.5 flex items-center gap-1">
                                                    <ChevronRight size={8} /> {perm.module_group}
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    
                                    <td className="px-4 py-4 text-center">
                                        <button 
                                            onClick={() => togglePermission(perm, 'allow_admin')} 
                                            aria-pressed={perm.allow_admin}
                                            className={`w-10 h-10 rounded-xl transition-all active:scale-90 flex items-center justify-center border ${perm.allow_admin ? 'bg-blue-600 text-white border-blue-400 shadow-[0_0_15px_rgba(37,99,235,0.3)]' : 'bg-white/5 text-white/10 border-white/5 hover:border-white/10'}`}
                                        >
                                            {perm.allow_admin ? <Check size={20} strokeWidth={3} /> : <X size={18} className="opacity-20" />}
                                        </button>
                                    </td>

                                    <td className="px-4 py-4 text-center">
                                        <button 
                                            onClick={() => togglePermission(perm, 'allow_manager')} 
                                            aria-pressed={perm.allow_manager}
                                            className={`w-10 h-10 rounded-xl transition-all active:scale-90 flex items-center justify-center border ${perm.allow_manager ? 'bg-purple-600 text-white border-purple-400 shadow-[0_0_15px_rgba(147,51,234,0.3)]' : 'bg-white/5 text-white/10 border-white/5 hover:border-white/10'}`}
                                        >
                                            {perm.allow_manager ? <Check size={20} strokeWidth={3} /> : <X size={18} className="opacity-20" />}
                                        </button>
                                    </td>

                                    <td className="px-4 py-4 text-center">
                                        <button 
                                            onClick={() => togglePermission(perm, 'allow_cashier')} 
                                            aria-pressed={perm.allow_cashier}
                                            className={`w-10 h-10 rounded-xl transition-all active:scale-90 flex items-center justify-center border ${perm.allow_cashier ? 'bg-green-600 text-white border-green-400 shadow-[0_0_15px_rgba(22,163,74,0.3)]' : 'bg-white/5 text-white/10 border-white/5 hover:border-white/10'}`}
                                        >
                                            {perm.allow_cashier ? <Check size={20} strokeWidth={3} /> : <X size={18} className="opacity-20" />}
                                        </button>
                                    </td>

                                    <td className="px-4 py-4 text-right">
                                        <button 
                                            onClick={() => handleDeletePage(perm.id, perm.label)} 
                                            title="Excluir módulo"
                                            className="p-2 text-white/5 hover:text-red-500 transition-all opacity-0 group-hover:opacity-100"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Info Card - Estilo Suave */}
            <div className="bg-blue-50 border border-blue-100 p-6 rounded-2xl flex items-start gap-4">
                <div className="p-3 bg-white rounded-xl text-blue-600 shadow-sm"><Info size={20}/></div>
                <div>
                    <h4 className="font-black text-blue-900 text-sm uppercase italic tracking-tight">Arquitetura de Segurança</h4>
                    <p className="text-blue-700/70 text-xs font-medium mt-1 leading-relaxed">As alterações nos privilégios de acesso são aplicadas globalmente e em tempo real para todos os terminais conectados ao ecossistema.</p>
                </div>
            </div>

            {/* Modal - Compacto e focado */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[150] p-4">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in duration-200">
                        <div className="p-6 bg-gray-50 border-b flex justify-between items-center">
                            <div>
                                <h3 className="text-lg font-black text-gray-900 uppercase italic tracking-tighter leading-none">Novo <span className="text-blue-700">Módulo</span></h3>
                                <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mt-1">Registrar rota no controle de acessos</p>
                            </div>
                            <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-red-600 transition-colors"><X size={24} /></button>
                        </div>
                        
                        <form onSubmit={handleSaveNewPage} className="p-8 space-y-6">
                            <div className="space-y-4">
                                <div>
                                    <label className="text-[9px] font-black text-gray-500 uppercase block tracking-widest mb-1.5 ml-1">Chave do Módulo (Page Key)</label>
                                    <input required value={formData.page_key} onChange={e => setFormData({...formData, page_key: e.target.value})} className="w-full px-4 py-3 bg-gray-100 border-none rounded-xl font-bold text-gray-800 text-xs focus:ring-2 focus:ring-blue-500 transition-all outline-none" placeholder="Ex: inventario_real" />
                                </div>
                                <div>
                                    <label className="text-[9px] font-black text-gray-500 uppercase block tracking-widest mb-1.5 ml-1">Título de Exibição</label>
                                    <input required value={formData.label} onChange={e => setFormData({...formData, label: e.target.value})} className="w-full px-4 py-3 bg-gray-100 border-none rounded-xl font-bold text-gray-800 text-xs focus:ring-2 focus:ring-blue-500 transition-all outline-none" placeholder="Ex: GESTÃO DE ESTOQUE" />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-[9px] font-black text-gray-500 uppercase block tracking-widest mb-1.5 ml-1">Grupo</label>
                                        <select value={formData.module_group} onChange={e => setFormData({...formData, module_group: e.target.value})} className="w-full px-4 py-3 bg-gray-100 border-none rounded-xl font-bold text-gray-800 text-xs focus:ring-2 focus:ring-blue-500 transition-all outline-none appearance-none cursor-pointer">
                                            <option value="Inteligência">Inteligência</option>
                                            <option value="Operação">Operação</option>
                                            <option value="Marketing">Marketing</option>
                                            <option value="Documentos">Documentos</option>
                                            <option value="Administração">Administração</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-[9px] font-black text-gray-500 uppercase block tracking-widest mb-1.5 ml-1">Ordem</label>
                                        <input type="number" value={formData.sort_order} onChange={e => setFormData({...formData, sort_order: parseInt(e.target.value)})} className="w-full px-4 py-3 bg-gray-100 border-none rounded-xl font-bold text-gray-800 text-xs focus:ring-2 focus:ring-blue-500 transition-all outline-none" />
                                    </div>
                                </div>
                            </div>

                            <div className="flex gap-3 mt-4">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-3 bg-gray-100 text-gray-500 rounded-xl font-black uppercase text-[10px] hover:bg-gray-200 transition-all">CANCELAR</button>
                                <button type="submit" disabled={isSaving} className="flex-1 py-3 bg-red-600 text-white rounded-xl font-black uppercase text-[10px] shadow-lg hover:bg-red-700 transition-all flex items-center justify-center gap-2">
                                    {isSaving ? <Loader2 className="animate-spin" size={14} /> : <Save size={14} />}
                                    SALVAR MÓDULO
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AccessControlManagement;
