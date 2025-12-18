
import React, { useState, useEffect } from 'react';
import { PagePermission, UserRole } from '../types';
import { ShieldCheck, Search, Plus, Save, Loader2, X, Check, CheckSquare, Square, LayoutGrid, Sliders, Info, Trash2, ShieldAlert, ChevronRight, Settings } from 'lucide-react';
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
        if (!window.confirm(`ATENÇÃO: Remover o módulo "${label}" impedirá que todos os usuários o acessem. Confirmar?`)) return;
        const { error } = await supabase.from('page_permissions').delete().eq('id', id);
        if (!error) fetchPermissions();
    };

    const filteredPermissions = permissions.filter(p => 
        p.label.toLowerCase().includes(searchTerm.toLowerCase()) || 
        p.module_group.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="p-6 md:p-10 space-y-8 max-w-6xl mx-auto animate-in fade-in duration-700">
            {/* Header Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-white p-10 rounded-[40px] shadow-sm border border-gray-100">
                <div className="flex items-center gap-6">
                    <div className="p-5 bg-gray-950 rounded-[28px] text-white shadow-2xl rotate-3"><ShieldAlert size={42} /></div>
                    <div>
                        <h2 className="text-4xl font-black text-gray-900 uppercase italic tracking-tighter leading-none">
                            Controle de <span className="text-red-600">Acessos</span>
                        </h2>
                        <p className="text-gray-400 font-bold text-[10px] uppercase tracking-widest mt-3 flex items-center gap-2">
                           <Settings size={14} className="animate-spin-slow" /> Configuração da Infraestrutura de Permissões
                        </p>
                    </div>
                </div>
                <button 
                    onClick={() => setIsModalOpen(true)}
                    className="bg-gray-950 text-white px-10 py-5 rounded-[24px] font-black uppercase text-xs shadow-2xl hover:bg-black transition-all active:scale-95 flex items-center gap-3 border-b-4 border-red-700"
                >
                    <Plus size={20} /> Registrar Novo Módulo
                </button>
            </div>

            {/* Matrix Card - Modern Dark Table */}
            <div className="bg-[#0a0a0a] rounded-[56px] shadow-2xl border border-white/10 overflow-hidden">
                <div className="p-10 border-b border-white/5 flex flex-col md:flex-row justify-between items-center gap-8 bg-black/40">
                    <div className="relative flex-1 max-w-xl">
                        <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-500" size={24} />
                        <input 
                            type="text" 
                            placeholder="Buscar funcionalidade por nome ou grupo..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-16 pr-8 py-5 bg-white/5 border border-white/10 rounded-[28px] text-base font-bold text-white focus:ring-4 focus:ring-red-600/20 transition-all outline-none"
                        />
                    </div>
                    <div className="flex items-center gap-4 text-white/30 text-[10px] font-black uppercase tracking-[0.3em]">
                        <Sliders size={18} /> Matrix de Controle v2.5
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-black/60 text-[11px] font-black text-white/40 uppercase tracking-widest border-b border-white/10">
                                <th className="px-12 py-8">Funcionalidade / Módulo</th>
                                <th className="px-8 py-8 text-center bg-blue-600/5">Administrador</th>
                                <th className="px-8 py-8 text-center bg-purple-600/5">Gerente</th>
                                <th className="px-8 py-8 text-center bg-green-600/5">Caixa</th>
                                <th className="px-8 py-8 text-right opacity-0 w-20">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={5} className="py-40 text-center">
                                        <Loader2 className="animate-spin mx-auto text-red-600" size={64} />
                                        <p className="mt-8 text-[10px] font-black text-white/30 uppercase tracking-[0.4em] animate-pulse">Estabelecendo Canais de Segurança...</p>
                                    </td>
                                </tr>
                            ) : filteredPermissions.map(perm => (
                                <tr key={perm.id} className="hover:bg-white/5 transition-all group">
                                    <td className="px-12 py-8">
                                        <div className="flex items-center gap-6">
                                            <div className="w-2 h-14 bg-red-600 rounded-full shadow-[0_0_15px_rgba(220,38,38,0.5)]"></div>
                                            <div>
                                                <div className="font-black text-white uppercase italic text-lg tracking-tighter leading-none">{perm.label}</div>
                                                <div className="text-[10px] font-black text-red-500 uppercase tracking-[0.2em] mt-2 opacity-60 flex items-center gap-2">
                                                    <ChevronRight size={10} /> {perm.module_group}
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    
                                    <td className="px-8 py-8 text-center bg-blue-600/5 border-x border-white/5">
                                        <button onClick={() => togglePermission(perm, 'allow_admin')} className={`p-4 rounded-3xl transition-all active:scale-90 border-2 ${perm.allow_admin ? 'bg-blue-600 text-white border-blue-400 shadow-[0_0_25px_rgba(37,99,235,0.4)]' : 'bg-white/5 text-white/10 border-white/10 hover:border-white/20'}`}>
                                            {perm.allow_admin ? <Check size={28} /> : <X size={28} />}
                                        </button>
                                    </td>

                                    <td className="px-8 py-8 text-center bg-purple-600/5">
                                        <button onClick={() => togglePermission(perm, 'allow_manager')} className={`p-4 rounded-3xl transition-all active:scale-90 border-2 ${perm.allow_manager ? 'bg-purple-600 text-white border-purple-400 shadow-[0_0_25px_rgba(147,51,234,0.4)]' : 'bg-white/5 text-white/10 border-white/10 hover:border-white/20'}`}>
                                            {perm.allow_manager ? <Check size={28} /> : <X size={28} />}
                                        </button>
                                    </td>

                                    <td className="px-8 py-8 text-center bg-green-600/5 border-x border-white/5">
                                        <button onClick={() => togglePermission(perm, 'allow_cashier')} className={`p-4 rounded-3xl transition-all active:scale-90 border-2 ${perm.allow_cashier ? 'bg-green-600 text-white border-green-400 shadow-[0_0_25px_rgba(22,163,74,0.4)]' : 'bg-white/5 text-white/10 border-white/10 hover:border-white/20'}`}>
                                            {perm.allow_cashier ? <Check size={28} /> : <X size={28} />}
                                        </button>
                                    </td>

                                    <td className="px-8 py-8 text-right">
                                        <button onClick={() => handleDeletePage(perm.id, perm.label)} className="p-4 text-white/10 hover:text-red-500 transition-all opacity-0 group-hover:opacity-100 hover:scale-125">
                                            <Trash2 size={22} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* INFO PANEL */}
            <div className="bg-blue-950 border-2 border-blue-800/30 p-10 rounded-[48px] flex items-start gap-8 shadow-2xl relative overflow-hidden group">
                <div className="absolute inset-0 bg-blue-600/5 group-hover:bg-blue-600/10 transition-colors"></div>
                <div className="p-5 bg-blue-800 rounded-[28px] text-white shadow-xl relative z-10"><Info size={32}/></div>
                <div className="relative z-10">
                    <h4 className="font-black text-white text-xl uppercase italic tracking-tighter">Motor de Escalabilidade Real Admin</h4>
                    <p className="text-blue-300/80 text-base font-bold mt-2 leading-relaxed">Sempre que uma nova funcionalidade for desenvolvida, ela aparecerá automaticamente nesta matriz. <br/>As alterações são propagadas instantaneamente para todos os usuários logados no ecossistema.</p>
                </div>
            </div>

            {/* MODAL NEW MODULE */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/95 backdrop-blur-2xl flex items-center justify-center z-[130] p-4">
                    <div className="bg-white rounded-[60px] shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in duration-300">
                        <div className="p-12 bg-gray-50 border-b flex justify-between items-center">
                            <div>
                                <h3 className="text-4xl font-black text-gray-900 uppercase italic tracking-tighter leading-none">Registrar <span className="text-blue-700">Módulo</span></h3>
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-4">Expanda as funcionalidades do sistema</p>
                            </div>
                            <button onClick={() => setIsModalOpen(false)} className="bg-white p-4 rounded-full text-gray-400 hover:text-red-600 shadow-2xl border border-gray-100 transition-all hover:rotate-90"><X size={32} /></button>
                        </div>
                        
                        <form onSubmit={handleSaveNewPage} className="p-16 space-y-10">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-3">
                                    <label className="text-[10px] font-black text-gray-500 uppercase block tracking-widest ml-2">ID do Módulo (Page Key) *</label>
                                    <input required value={formData.page_key} onChange={e => setFormData({...formData, page_key: e.target.value})} className="w-full px-8 py-6 bg-gray-100 border-none rounded-[32px] font-black text-gray-800 uppercase italic text-sm focus:ring-4 focus:ring-blue-100 transition-all outline-none" placeholder="EX: inventario_real" />
                                </div>
                                <div className="space-y-3">
                                    <label className="text-[10px] font-black text-gray-500 uppercase block tracking-widest ml-2">Nome de Exibição *</label>
                                    <input required value={formData.label} onChange={e => setFormData({...formData, label: e.target.value})} className="w-full px-8 py-6 bg-gray-100 border-none rounded-[32px] font-black text-gray-800 uppercase italic text-sm focus:ring-4 focus:ring-blue-100 transition-all outline-none" placeholder="EX: GESTÃO DE ESTOQUE" />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-3">
                                    <label className="text-[10px] font-black text-gray-500 uppercase block tracking-widest ml-2">Agrupamento Comercial</label>
                                    <select value={formData.module_group} onChange={e => setFormData({...formData, module_group: e.target.value})} className="w-full px-8 py-6 bg-gray-100 border-none rounded-[32px] font-black text-gray-800 uppercase text-xs focus:ring-4 focus:ring-blue-100 transition-all outline-none appearance-none cursor-pointer">
                                        <option value="Inteligência">Inteligência</option>
                                        <option value="Operação">Operação</option>
                                        <option value="Marketing">Marketing</option>
                                        <option value="Documentos">Documentos</option>
                                        <option value="Administração">Administração</option>
                                    </select>
                                </div>
                                <div className="space-y-3">
                                    <label className="text-[10px] font-black text-gray-500 uppercase block tracking-widest ml-2">Prioridade (Ordenação)</label>
                                    <input type="number" value={formData.sort_order} onChange={e => setFormData({...formData, sort_order: parseInt(e.target.value)})} className="w-full px-8 py-6 bg-gray-100 border-none rounded-[32px] font-black text-gray-800 uppercase italic text-sm focus:ring-4 focus:ring-blue-100 transition-all outline-none" />
                                </div>
                            </div>

                            <div className="p-12 bg-gray-50 -mx-16 -mb-16 flex gap-8 mt-12">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-6 bg-white border-2 border-gray-200 rounded-[32px] font-black text-gray-500 uppercase text-xs hover:bg-gray-100 transition-all active:scale-95">CANCELAR</button>
                                <button type="submit" disabled={isSaving} className="flex-1 py-6 bg-red-600 text-white rounded-[32px] font-black uppercase text-xs shadow-2xl shadow-red-200 flex items-center justify-center gap-4 hover:bg-red-700 transition-all active:scale-95">
                                    {isSaving ? <Loader2 className="animate-spin" size={24} /> : <Save size={24} />}
                                    CONFIRMAR REGISTRO
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
