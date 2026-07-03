import React, { useMemo } from 'react';
import { X, DollarSign, Loader2, Save, Calendar, FileText } from 'lucide-react';
import { IceCreamSangriaCategory } from '../../../types';

interface SangriaModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: () => Promise<void>;
    form: { amount: string; categoryId: string; description: string };
    setForm: (form: any) => void;
    date: string;
    setDate: (date: string) => void;
    categories: IceCreamSangriaCategory[];
    isSubmitting: boolean;
    onManageCategories: () => void;
}

const SangriaModal: React.FC<SangriaModalProps> = ({
    isOpen, onClose, onSubmit, form, setForm, date, setDate, categories, isSubmitting, onManageCategories
}) => {
    const sortedCategories = useMemo(() => {
        return [...categories].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
    }, [categories]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[140] p-3 md:p-4">
            <div className="bg-white rounded-[28px] md:rounded-[32px] w-full max-w-sm md:max-w-md shadow-2xl animate-in zoom-in duration-300 border-t-4 md:border-t-8 border-red-600 overflow-hidden flex flex-col max-h-[92vh]">
                <div className="p-4 md:p-6 border-b bg-gray-50/50 flex justify-between items-center shrink-0">
                    <h3 className="text-base md:text-lg font-black uppercase italic text-blue-950 flex items-center gap-2">
                        <DollarSign className="text-red-600" size={20} /> Efetuar <span className="text-red-600">Sangria</span>
                    </h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-red-600"><X size={20}/></button>
                </div>

                <div className="p-5 md:p-6 space-y-4 overflow-y-auto flex-1">
                    <div className="bg-red-50 p-4 md:p-5 rounded-2xl border-2 border-red-100">
                        <label className="text-[9px] font-black text-red-400 uppercase tracking-widest mb-1 block ml-1">Valor da Saída</label>
                        <input 
                            value={form.amount} 
                            onChange={e => setForm({...form, amount: e.target.value})} 
                            className="w-full bg-transparent border-none text-3xl font-black text-red-700 outline-none placeholder:text-red-200 text-center" 
                            placeholder="0,00" 
                            autoFocus
                        />
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-[9px] font-black text-gray-400 uppercase ml-1 flex items-center gap-1.5"><Calendar size={11}/> Data da Sangria</label>
                        <input 
                            type="date" 
                            value={date} 
                            onChange={e => setDate(e.target.value)} 
                            className="w-full p-3 bg-gray-50 rounded-xl font-black text-xs outline-none border-2 border-transparent focus:border-red-100 transition-all" 
                        />
                    </div>

                    <div className="space-y-1.5">
                        <div className="flex justify-between items-center ml-1">
                            <label className="text-[9px] font-black text-gray-400 uppercase flex items-center gap-1.5"><DollarSign size={11}/> Categoria</label>
                            <p className="text-[8px] font-black text-blue-500 uppercase">Aba Despesas</p>
                        </div>
                        <select 
                            value={form.categoryId} 
                            onChange={e => setForm({...form, categoryId: e.target.value})} 
                            className="w-full p-3 bg-gray-50 rounded-xl font-black uppercase text-[10px] outline-none border-2 border-transparent focus:border-red-100 transition-all"
                        >
                            <option value="">SELECIONE UMA CATEGORIA</option>
                            {sortedCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-[9px] font-black text-gray-400 uppercase ml-1 flex items-center gap-1.5"><FileText size={11}/> Descrição / Observação</label>
                        <textarea 
                            value={form.description} 
                            onChange={e => setForm({...form, description: e.target.value})} 
                            className="w-full p-3 bg-gray-50 rounded-xl font-black uppercase text-[9px] outline-none border-2 border-transparent focus:border-red-100 transition-all h-14 resize-none" 
                            placeholder="DETALHES DA DESPESA..."
                        />
                    </div>

                    <button 
                        onClick={onSubmit} 
                        disabled={isSubmitting || !form.amount || !form.categoryId} 
                        className="w-full py-4 bg-red-600 text-white rounded-2xl font-black uppercase text-[11px] shadow-xl shadow-red-200 flex items-center justify-center gap-2 active:scale-95 transition-all border-b-4 border-red-800 disabled:opacity-50"
                    >
                        {isSubmitting ? <Loader2 className="animate-spin" size={16} /> : <Save size={16}/>} EFETIVAR SANGRIA
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SangriaModal;
