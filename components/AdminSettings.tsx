import React, { useState } from 'react';
import { Store } from '../types';
import { Settings, Plus, Save, Trash2, CheckCircle, XCircle, IceCream } from 'lucide-react';
import { supabase } from '../services/supabaseClient';

interface AdminSettingsProps {
    stores: Store[];
    onAddStore: (store: any) => Promise<void>;
    onUpdateStore: (store: any) => Promise<void>;
    onDeleteStore: (id: string) => Promise<void>;
}

const AdminSettings: React.FC<AdminSettingsProps> = ({ stores, onAddStore, onUpdateStore, onDeleteStore }) => {
    const [newStore, setNewStore] = useState({ number: '', city: '', state: 'BA', status: 'active', has_gelateria: false });
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            await onAddStore(newStore);
            setNewStore({ number: '', city: '', state: 'BA', status: 'active', has_gelateria: false });
            alert('Loja adicionada!');
        } catch (error) { alert('Erro ao adicionar.'); }
        finally { setIsSubmitting(false); }
    };

    const toggleStatus = async (store: Store) => {
        const newStatus = store.status === 'active' ? 'inactive' : 'active';
        await onUpdateStore({ ...store, status: newStatus });
    };

    const toggleGelateria = async (store: Store) => {
        const newValue = !store.has_gelateria;
        // Atualiza direto no banco para garantir
        const { error } = await supabase.from('stores').update({ has_gelateria: newValue }).eq('id', store.id);
        if (!error) {
            // Recarrega a página para atualizar o menu lateral
            window.location.reload(); 
        } else {
            alert("Erro ao atualizar status da Gelateria");
        }
    };

    return (
        <div className="p-8 max-w-6xl mx-auto space-y-8 animate-in fade-in">
            <div className="flex items-center gap-4 mb-8">
                <div className="p-3 bg-gray-900 text-white rounded-2xl shadow-lg">
                    <Settings size={28} />
                </div>
                <div>
                    <h2 className="text-2xl font-black text-blue-950 uppercase italic tracking-tighter">Configuração de Lojas</h2>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Cadastro e Ativação de Recursos</p>
                </div>
            </div>

            <div className="bg-white p-8 rounded-[32px] shadow-sm border border-gray-100">
                <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                    <Plus size={16} /> Nova Unidade
                </h3>
                <form onSubmit={handleAdd} className="flex gap-4 items-end">
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-gray-400 uppercase ml-2">Número</label>
                        <input required value={newStore.number} onChange={e => setNewStore({...newStore, number: e.target.value})} className="p-3 bg-gray-50 rounded-xl font-bold text-blue-900 w-24 outline-none" placeholder="00" />
                    </div>
                    <div className="space-y-1 flex-1">
                        <label className="text-[10px] font-bold text-gray-400 uppercase ml-2">Cidade</label>
                        <input required value={newStore.city} onChange={e => setNewStore({...newStore, city: e.target.value})} className="w-full p-3 bg-gray-50 rounded-xl font-bold text-blue-900 outline-none" placeholder="Nome da Cidade" />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-gray-400 uppercase ml-2">Estado</label>
                        <input required value={newStore.state} onChange={e => setNewStore({...newStore, state: e.target.value})} className="p-3 bg-gray-50 rounded-xl font-bold text-blue-900 w-20 outline-none" />
                    </div>
                    <button type="submit" disabled={isSubmitting} className="p-3 bg-blue-900 text-white rounded-xl shadow-lg hover:bg-black transition-all">
                        <Save size={20} />
                    </button>
                </form>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {stores.sort((a,b) => parseInt(a.number) - parseInt(b.number)).map(store => (
                    <div key={store.id} className={`p-6 rounded-[24px] border transition-all ${store.status === 'active' ? 'bg-white border-gray-100' : 'bg-gray-50 border-gray-200 opacity-75'}`}>
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <h4 className="text-xl font-black text-blue-950 italic">LOJA {store.number}</h4>
                                <p className="text-xs font-bold text-gray-400 uppercase">{store.city} - {store.state}</p>
                            </div>
                            <button onClick={() => toggleStatus(store)} className={`p-2 rounded-lg transition-all ${store.status === 'active' ? 'text-green-600 bg-green-50 hover:bg-green-100' : 'text-gray-400 bg-gray-200 hover:bg-gray-300'}`}>
                                {store.status === 'active' ? <CheckCircle size={20} /> : <XCircle size={20} />}
                            </button>
                        </div>
                        
                        <div className="pt-4 border-t border-gray-50 flex justify-between items-center">
                            <button 
                                onClick={() => toggleGelateria(store)}
                                className={`flex items-center gap-2 px-3 py-2 rounded-xl text-[10px] font-black uppercase transition-all border-2 ${store.has_gelateria ? 'bg-purple-50 text-purple-700 border-purple-200' : 'bg-gray-50 text-gray-400 border-transparent grayscale'}`}
                            >
                                <IceCream size={16} /> 
                                {store.has_gelateria ? 'Gelateria Ativa' : 'Sem Gelateria'}
                            </button>

                            <button onClick={() => onDeleteStore(store.id)} className="text-gray-300 hover:text-red-500 transition-colors">
                                <Trash2 size={18} />
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default AdminSettings;