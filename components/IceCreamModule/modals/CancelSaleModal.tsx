import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface CancelSaleModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    reason: string;
    setReason: (reason: string) => void;
    isSubmitting: boolean;
}

const CancelSaleModal: React.FC<CancelSaleModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
    reason,
    setReason,
    isSubmitting
}) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[130] p-4">
            <div className="bg-white rounded-[40px] p-10 max-sm w-full text-center shadow-2xl animate-in zoom-in duration-200">
                <div className="p-5 bg-red-50 text-red-600 rounded-full w-fit mx-auto mb-6">
                    <AlertTriangle size={48} />
                </div>
                <h3 className="text-2xl font-black text-gray-900 uppercase italic mb-2 tracking-tighter">
                    Estornar <span className="text-red-600">Venda?</span>
                </h3>
                <input 
                    value={reason} 
                    onChange={e => setReason(e.target.value)} 
                    placeholder="Motivo do estorno..." 
                    className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl text-[10px] font-black uppercase outline-none focus:ring-4 focus:ring-red-50 mb-6 shadow-inner" 
                />
                <div className="flex gap-3">
                    <button 
                        onClick={onClose} 
                        className="flex-1 py-4 bg-gray-100 text-gray-500 rounded-2xl font-black uppercase text-[10px]"
                    >
                        Voltar
                    </button>
                    <button 
                        onClick={onConfirm} 
                        disabled={isSubmitting || !reason} 
                        className="flex-1 py-4 bg-red-600 text-white rounded-2xl font-black uppercase text-[10px] shadow-lg active:scale-95 disabled:opacity-30"
                    >
                        Confirmar Estorno
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CancelSaleModal;
