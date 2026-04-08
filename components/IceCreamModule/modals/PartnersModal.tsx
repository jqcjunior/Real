import React, { useState } from 'react';
import { X, Users, Save, Loader2, Plus, Trash2, ToggleLeft, ToggleRight } from 'lucide-react';

interface PartnersModalProps {
    isOpen: boolean;
    onClose: () => void;
    partners: any[];
    onUpdatePartner: (partner: any) => Promise<void>;
    onAddPartner: (partner: any) => Promise<void>;
    onDeletePartner: (id: string) => Promise<void>;
    onTogglePartner: (id: string, active: boolean) => Promise<void>;
    effectiveStoreId: string;
    fetchData?: () => Promise<void>;
}

const PartnersModal: React.FC<PartnersModalProps> = ({
    isOpen,
    onClose,
    partners,
    onUpdatePartner,
    onAddPartner,
    onDeletePartner,
    onTogglePartner,
    effectiveStoreId,
    fetchData
}) => {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [partnerForm, setPartnerForm] = useState({ partner_name: '', percentage: '' });

    if (!isOpen) return null;

    const handleSavePartner = async () => {
        if (!partnerForm.partner_name || !partnerForm.percentage || !effectiveStoreId) return;
        
        const newPercent = parseFloat(partnerForm.percentage.replace(',', '.'));
        
        // Calcular apenas sócios ATIVOS DA MESMA LOJA
        const activeTotal = partners
          .filter(p => p.active && p.store_id === effectiveStoreId)
          .reduce((acc, p) => acc + p.percentage, 0);
        
        if (activeTotal + newPercent > 100.01) {
          alert(`A soma dos percentuais ativos (${(activeTotal + newPercent).toFixed(1)}%) não pode ultrapassar 100%.`);
          return;
        }
       
        setIsSubmitting(true);
        try {
          await onAddPartner({
            partner_name: partnerForm.partner_name,
            percentage: newPercent
          });
          
          setPartnerForm({ partner_name: '', percentage: '' });
          alert("Sócio adicionado!");
        } catch (e: any) {
          alert("Erro ao salvar sócio: " + e.message);
        } finally {
          setIsSubmitting(false);
        }
    };

    const handleTogglePartner = async (id: string, active: boolean) => {
        if (active) {
          const pToToggle = partners.find(p => p.id === id);
          
          // Calcular apenas sócios ATIVOS DA MESMA LOJA
          const activeTotal = partners
            .filter(p => p.active && p.id !== id && p.store_id === effectiveStoreId)
            .reduce((acc, p) => acc + p.percentage, 0);
          
          if (activeTotal + (pToToggle?.percentage || 0) > 100.01) {
            alert("Ativar este sócio faria a soma ultrapassar 100%.");
            return;
          }
        }
        
        try {
          await onTogglePartner(id, active);
        } catch (e: any) {
          alert("Erro ao atualizar status: " + e.message);
        }
    };

    const handleUpdatePercentage = async (id: string, name: string, percentage: number) => {
        setIsSubmitting(true);
        try {
            await onUpdatePartner({ id, partner_name: name, percentage });
        } catch (e: any) {
            alert("Erro ao atualizar: " + e.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[130] p-4">
            <div className="bg-white rounded-[40px] w-full max-w-lg shadow-2xl animate-in zoom-in duration-300 border-t-8 border-blue-950 overflow-hidden flex flex-col max-h-[90vh]">
                <div className="p-8 border-b bg-gray-50/50 flex justify-between items-center shrink-0">
                    <h3 className="text-xl font-black uppercase italic text-blue-950 flex items-center gap-3">
                        <Users className="text-blue-900" /> Gestão de <span className="text-blue-900">Sócios</span>
                    </h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-red-600"><X size={24}/></button>
                </div>

                <div className="p-8 border-b bg-blue-50/30 shrink-0">
                    <h4 className="text-[10px] font-black text-blue-900 uppercase mb-4 flex items-center gap-2">
                        <Plus size={14} /> Adicionar Novo Sócio
                    </h4>
                    <div className="grid grid-cols-2 gap-3">
                        <input 
                            value={partnerForm.partner_name}
                            onChange={e => setPartnerForm({...partnerForm, partner_name: e.target.value})}
                            placeholder="NOME DO SÓCIO"
                            className="p-4 bg-white rounded-2xl font-black uppercase text-[10px] outline-none shadow-sm border border-blue-100"
                        />
                        <div className="flex gap-2">
                            <input 
                                value={partnerForm.percentage}
                                onChange={e => setPartnerForm({...partnerForm, percentage: e.target.value})}
                                placeholder="%"
                                className="w-20 p-4 bg-white rounded-2xl font-black text-[10px] outline-none shadow-sm border border-blue-100 text-center"
                            />
                            <button 
                                onClick={handleSavePartner}
                                disabled={isSubmitting || !partnerForm.partner_name || !partnerForm.percentage}
                                className="flex-1 bg-blue-900 text-white rounded-2xl font-black uppercase text-[10px] shadow-lg hover:bg-blue-950 transition-all active:scale-95 disabled:opacity-50"
                            >
                                {isSubmitting ? <Loader2 className="animate-spin mx-auto" size={18} /> : 'ADICIONAR'}
                            </button>
                        </div>
                    </div>
                </div>

                <div className="p-8 space-y-4 overflow-y-auto flex-1 no-scrollbar">
                    <h4 className="text-[10px] font-black text-gray-400 uppercase mb-4 tracking-widest">Sócios Cadastrados</h4>
                    {partners.map(p => (
                        <div key={p.id} className={`p-4 rounded-3xl border transition-all flex items-center justify-between ${p.active ? 'bg-white border-blue-100 shadow-sm' : 'bg-gray-50 border-gray-100 opacity-60'}`}>
                            <div className="flex-1">
                                <div className="flex items-center gap-3">
                                    <span className="text-xs font-black uppercase text-blue-950 italic">{p.partner_name}</span>
                                    {!p.active && <span className="text-[8px] font-black bg-gray-200 text-gray-500 px-2 py-0.5 rounded-full uppercase">Inativo</span>}
                                </div>
                                <div className="flex items-center gap-2 mt-1">
                                    <input 
                                        type="number" 
                                        defaultValue={p.percentage} 
                                        onBlur={(e) => handleUpdatePercentage(p.id, p.partner_name, parseFloat(e.target.value))}
                                        className="w-16 bg-transparent font-black text-blue-900 text-sm outline-none" 
                                    />
                                    <span className="text-[10px] font-bold text-gray-400">% de participação</span>
                                </div>
                            </div>
                            
                            <div className="flex items-center gap-2">
                                <button 
                                    onClick={() => handleTogglePartner(p.id, !p.active)}
                                    className={`p-2 rounded-xl transition-all ${p.active ? 'text-green-600 hover:bg-green-50' : 'text-gray-400 hover:bg-gray-200'}`}
                                    title={p.active ? "Desativar" : "Ativar"}
                                >
                                    {p.active ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
                                </button>
                                <button 
                                    onClick={() => onDeletePartner(p.id)}
                                    className="p-2 text-gray-300 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                                    title="Excluir"
                                >
                                    <Trash2 size={20} />
                                </button>
                            </div>
                        </div>
                    ))}
                    {partners.length === 0 && (
                        <div className="text-center py-10 opacity-20">
                            <Users size={48} className="mx-auto mb-2" />
                            <p className="text-[10px] font-black uppercase italic">Nenhum sócio cadastrado</p>
                        </div>
                    )}
                </div>

                <div className="p-8 border-t bg-gray-50 shrink-0">
                    <button onClick={onClose} className="w-full py-5 bg-blue-950 text-white rounded-[28px] font-black uppercase text-xs shadow-xl active:scale-95 transition-all flex items-center justify-center gap-3">
                        FECHAR
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PartnersModal;
