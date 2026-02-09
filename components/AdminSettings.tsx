import React, { useState } from 'react';
import { Store } from '../types';
import { Settings, Plus, Save, Trash2, CheckCircle, XCircle, IceCream, Building2, MapPin, Hash, Info, Loader2, AlertTriangle, X } from 'lucide-react';

interface AdminSettingsProps {
    stores: Store[];
    onAddStore: (store: any) => Promise<void>;
    onUpdateStore: (store: any) => Promise<void>;
    onDeleteStore: (id: string) => Promise<void>;
}

const AdminSettings: React.FC<AdminSettingsProps> = ({ stores, onAddStore, onUpdateStore, onDeleteStore }) => {
    const [newStore, setNewStore] = useState({ number: '', name: '', city: '', state: 'BA', status: 'active', has_gelateria: false });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [loadingStoreId, setLoadingStoreId] = useState<string | null>(null);
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newStore.number || !newStore.name) {
            alert("Preencha o número e o nome da loja.");
            return;
        }
        setIsSubmitting(true);
        try {
            await onAddStore(newStore);
            setNewStore({ number: '', name: '', city: '', state: 'BA', status: 'active', has_gelateria: false });
        } catch (error) { 
            console.error(error);
        }
        finally { setIsSubmitting(false); }
    };

    const toggleStatus = async (store: Store) => {
        setLoadingStoreId(store.id);
        const newStatus = store.status === 'active' ? 'inactive' : 'active';
        try {
            await onUpdateStore({ ...store, status: newStatus });
        } catch (err) {
            alert("Erro ao alterar status da loja.");
        } finally {
            setLoadingStoreId(null);
        }
    };

    const toggleGelateria = async (store: Store) => {
        setLoadingStoreId(store.id);
        const newValue = !store.has_gelateria;
        try {
            await onUpdateStore({ ...store, has_gelateria: newValue });
        } catch (err) {
            alert("Erro ao atualizar status da Gelateria");
        } finally {
            setLoadingStoreId(null);
        }
    };

    const confirmDelete = async (id: string) => {
        setLoadingStoreId(id);
        try {
            await onDeleteStore(id);
            setConfirmDeleteId(null);
        } catch (err: any) {
            console.error("Erro capturado no AdminSettings:", err);
        } finally {
            setLoadingStoreId(null);
        }
    };

    return (
        <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in pb-24">
            <div className="flex flex-col md:flex-row justify-between items-center bg-white p-8 rounded-[40px] shadow-sm border border-gray-100 gap-6">
                <div className="flex items-center gap-4">
                    <div className="p-4 bg-gray-950 text-white rounded-3xl shadow-xl shadow-gray-100">
                        <Settings size={32} />
                    </div>
                    <div>
                        <h2 className="text-2xl md:text-3xl font-black text-blue-950 uppercase italic tracking-tighter">Configuração de Lojas</h2>
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1">Cadastro e Ativação de Recursos de Rede</p>
                    </div>
                </div>
            </div>

            <div className="bg-white p-8 rounded-[40px] shadow-sm border border-gray-100">
                <h3 className="text-xs font-black text-gray-400 uppercase tracking-[0.3em] mb-8 flex items-center gap-3">
                    <Plus size={18} className="text-blue-600" /> Registrar Nova Unidade
                </h3>
                <form onSubmit={handleAdd} className="grid grid-cols-1 md:grid-cols-12 gap-6 items-end">
                    <div className="md:col-span-2 space-y-2">
                        <label className="text-[10px] font-black text-gray-500 uppercase ml-2 flex items-center gap-1.5"><Hash size={12}/> Número</label>
                        <input required value={newStore.number} onChange={e => setNewStore({...newStore, number: e.target.value})} className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl font-black text-blue-900 outline-none focus:ring-4 focus:ring-blue-50 transition-all" placeholder="Ex: 01" />
                    </div>
                    <div className="md:col-span-4 space-y-2">
                        <label className="text-[10px] font-black text-gray-500 uppercase ml-2 flex items-center gap-1.5"><Building2 size={12}/> Nome Fantasia</label>
                        <input required value={newStore.name} onChange={e => setNewStore({...newStore, name: e.target.value.toUpperCase()})} className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl font-black text-blue-900 outline-none focus:ring-4 focus:ring-blue-50 transition-all" placeholder="Ex: LOJA CENTRO" />
                    </div>
                    <div className="md:col-span-4 space-y-2">
                        <label className="text-[10px] font-black text-gray-500 uppercase ml-2 flex items-center gap-1.5"><MapPin size={12}/> Cidade</label>
                        <input required value={newStore.city} onChange={e => setNewStore({...newStore, city: e.target.value.toUpperCase()})} className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl font-black text-blue-900 outline-none focus:ring-4 focus:ring-blue-50 transition-all" placeholder="Ex: SALVADOR" />
                    </div>
                    <div className="md:col-span-2">
                        <button type="submit" disabled={isSubmitting} className="w-full py-4 bg-blue-950 text-white rounded-2xl font-black uppercase text-[11px] shadow-xl hover:bg-black transition-all flex items-center justify-center gap-3 border-b-4 border-slate-800 disabled:opacity-50">
                            {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />} Salvar
                        </button>
                    </div>
                </form>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {stores.sort((a,b) => (parseInt(a.number) || 0) - (parseInt(b.number) || 0)).map(store => (
                    <div key={store.id} className={`p-8 rounded-[40px] shadow-sm border transition-all hover:shadow-xl relative overflow-hidden ${store.status === 'active' ? 'bg-white border-gray-100' : 'bg-gray-50 border-gray-200 opacity-75 grayscale'}`}>
                        {loadingStoreId === store.id && (
                            <div className="absolute inset-0 bg-white/60 backdrop-blur-[2px] z-20 rounded-[40px] flex items-center justify-center font-black text-blue-600 uppercase text-[10px] italic">
                                <Loader2 className="animate-spin mr-2" /> Sincronizando...
                            </div>
                        )}

                        {/* OVERLAY DE CONFIRMAÇÃO DE EXCLUSÃO */}
                        {confirmDeleteId === store.id && (
                            <div className="absolute inset-0 bg-red-600 z-30 flex flex-col items-center justify-center p-6 text-center animate-in fade-in zoom-in duration-200">
                                <AlertTriangle className="text-white mb-3" size={40} />
                                <p className="text-white font-black uppercase text-xs tracking-widest leading-tight mb-6">Deseja realmente excluir esta unidade permanentemente?</p>
                                <div className="flex gap-2 w-full">
                                    <button onClick={() => confirmDelete(store.id)} className="flex-1 bg-white text-red-600 py-3 rounded-2xl font-black uppercase text-[10px] shadow-lg active:scale-95 transition-all">Sim, Excluir</button>
                                    <button onClick={() => setConfirmDeleteId(null)} className="flex-1 bg-red-800 text-white py-3 rounded-2xl font-black uppercase text-[10px] active:scale-95 transition-all">Cancelar</button>
                                </div>
                            </div>
                        )}

                        <div className="flex justify-between items-start mb-6">
                            <div className="flex items-center gap-4">
                                <div className={`p-3 rounded-2xl ${store.status === 'active' ? 'bg-blue-50 text-blue-600' : 'bg-gray-200 text-gray-500'}`}>
                                    <Building2 size={24} />
                                </div>
                                <div>
                                    <h4 className="text-xl font-black text-blue-950 italic uppercase tracking-tighter leading-none">LOJA {store.number}</h4>
                                    <p className="text-[10px] font-black text-gray-400 uppercase mt-1">{store.name || '---'}</p>
                                </div>
                            </div>
                            <button onClick={() => toggleStatus(store)} className={`p-2 rounded-xl transition-all shadow-sm border ${store.status === 'active' ? 'text-green-600 bg-white border-green-100 hover:bg-green-50' : 'text-gray-400 bg-gray-100 border-gray-200'}`}>
                                {store.status === 'active' ? <CheckCircle size={20} /> : <XCircle size={20} />}
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div className="flex items-center gap-3 text-gray-500">
                                <MapPin size={16} />
                                <span className="text-xs font-bold uppercase">{store.city} - {store.state || 'BA'}</span>
                            </div>
                            
                            <div className="pt-6 border-t border-gray-100 flex justify-between items-center">
                                <button 
                                    onClick={() => toggleGelateria(store)}
                                    className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-[9px] font-black uppercase transition-all border-b-4 ${store.has_gelateria ? 'bg-purple-600 text-white border-purple-900 shadow-lg' : 'bg-gray-100 text-gray-400 border-gray-300 active:scale-95'}`}
                                >
                                    <IceCream size={14} /> 
                                    {store.has_gelateria ? 'Gelateria Ativa' : 'Ativar Gelateria'}
                                </button>

                                <button 
                                    onClick={() => setConfirmDeleteId(store.id)} 
                                    className="p-3 text-gray-300 hover:text-red-600 transition-all rounded-xl hover:bg-red-50"
                                    title="Remover Unidade"
                                >
                                    <Trash2 size={20} />
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
                {stores.length === 0 && (
                    <div className="col-span-full py-20 text-center bg-gray-50 border-2 border-dashed border-gray-200 rounded-[40px]">
                        <Info className="mx-auto text-gray-300 mb-4" size={48} />
                        <p className="text-sm font-black text-gray-400 uppercase tracking-widest">Nenhuma unidade cadastrada</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AdminSettings;