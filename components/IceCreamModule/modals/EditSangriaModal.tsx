import React, { useMemo } from 'react';
import { X, PencilLine, Loader2, Save, Calendar, FileText, DollarSign } from 'lucide-react';
import { IceCreamSangriaCategory } from '../../../types';

interface EditSangriaModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: () => Promise<void>;
    form: { amount: string; categoryId: string; description: string; transactionDate: string; notes: string };
    setForm: (form: any) => void;
    categories: IceCreamSangriaCategory[];
    isSubmitting: boolean;
}

const EditSangriaModal: React.FC<EditSangriaModalProps> = ({
    isOpen,
    onClose,
    onSubmit,
    form,
    setForm,
    categories,
    isSubmitting
}) => {
    const sortedCategories = useMemo(() => {
        return [...categories].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
    }, [categories]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[140] p-4">
            <div className="bg-white rounded-[40px] w-full max-w-md shadow-2xl animate-in zoom-in duration-300 border-t-8 border-blue-600 overflow-hidden">
                <div className="p-8 border-b bg-gray-50/50 flex justify-between items-center">
                    <h3 className="text-xl font-black uppercase italic text-blue-950 flex items-center gap-3">
                        <PencilLine className="text-blue-600" /> Editar <span className="text-blue-600">Sangria</span>
                    </h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-red-600"><X size={24}/></button>
                </div>
                <div className="p-10 space-y-6">
                    <div className="bg-blue-50 p-6 rounded-3xl border-2 border-blue-100">
                        <label className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-2 block ml-2">Valor da Saída</label>
                        <input 
                            value={form.amount} 
                            onChange={e => setForm({...form, amount: e.target.value})} 
                            className="w-full bg-transparent border-none text-4xl font-black text-blue-700 outline-none placeholder:text-blue-200 text-center" 
                            placeholder="0,00" 
                        />
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-400 uppercase ml-2 flex items-center gap-2"><Calendar size={12}/> Data da Sangria</label>
                            <input 
                                type="date" 
                                value={form.transactionDate} 
                                onChange={e => setForm({...form, transactionDate: e.target.value})} 
                                className="w-full p-4 bg-gray-50 rounded-2xl font-black outline-none border-2 border-transparent focus:border-blue-100 transition-all" 
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-400 uppercase ml-2 flex items-center gap-2"><DollarSign size={12}/> Categoria</label>
                            <select 
                                value={form.categoryId} 
                                onChange={e => setForm({...form, categoryId: e.target.value})} 
                                className="w-full p-4 bg-gray-50 rounded-2xl font-black uppercase text-xs outline-none border-2 border-transparent focus:border-blue-100 transition-all"
                            >
                                <option value="">SELECIONE UMA CATEGORIA</option>
                                {sortedCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-400 uppercase ml-2 flex items-center gap-2"><FileText size={12}/> Descrição</label>
                            <input 
                                value={form.description} 
                                onChange={e => setForm({...form, description: e.target.value})} 
                                className="w-full p-4 bg-gray-50 rounded-2xl font-black uppercase text-[10px] outline-none border-2 border-transparent focus:border-blue-100 transition-all" 
                                placeholder="DETALHES DA DESPESA..."
                            />
                        </div>
                    </div>

                    <button 
                        onClick={onSubmit} 
                        disabled={isSubmitting || !form.amount || !form.categoryId} 
                        className="w-full py-5 bg-blue-600 text-white rounded-[28px] font-black uppercase text-xs shadow-xl shadow-blue-200 flex items-center justify-center gap-3 active:scale-95 transition-all border-b-4 border-blue-800 disabled:opacity-50"
                    >
                        {isSubmitting ? <Loader2 className="animate-spin" /> : <Save size={18}/>} SALVAR ALTERAÇÕES
                    </button>
                </div>
            </div>
        </div>
    );
};

export default EditSangriaModal;
