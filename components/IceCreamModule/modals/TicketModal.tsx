import React from 'react';
import { X, Printer } from 'lucide-react';
import { formatCurrency } from '../../../constants';

interface TicketModalProps {
    isOpen: boolean;
    onClose: () => void;
    ticketData: any;
    stores: any[];
    effectiveStoreId: string;
    handlePrintTicket: (items: any[], saleCode: string, method: string, buyer?: string) => void;
}

const TicketModal: React.FC<TicketModalProps> = ({
    isOpen,
    onClose,
    ticketData,
    stores,
    effectiveStoreId,
    handlePrintTicket
}) => {
    if (!isOpen || !ticketData) return null;

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[200] p-4">
            <div className="bg-white rounded-[40px] w-full max-sm max-h-[90vh] shadow-2xl animate-in zoom-in duration-300 overflow-hidden flex flex-col">
                <div className="p-5 border-b flex justify-between items-center bg-gray-50/50 shrink-0">
                    <h3 className="font-black text-blue-950 uppercase italic text-xs flex items-center gap-2">
                        <Printer size={16} className="text-blue-600"/> Prévia do Ticket
                    </h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-red-600 p-1"><X size={24}/></button>
                </div>
                
                <div className="flex-1 overflow-y-auto p-4 flex justify-center bg-gray-100 no-scrollbar">
                    <div className="bg-white w-[58mm] min-h-[100mm] h-fit shadow-lg p-3 text-black font-mono text-[9px] relative border-l border-r border-gray-200 mx-auto">
                        <div className="text-center font-black text-[11px] mb-2">SORVETERIA REAL</div>
                        <div className="border-t border-dashed border-black my-2"></div>
                        
                        <div className="flex justify-between">
                            <span className="font-black uppercase">CÓDIGO:</span>
                            <span className="font-black">#{ticketData.saleCode}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="uppercase">DATA:</span>
                            <span>{new Date().toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        
                        <div className="border-t border-dashed border-black my-2"></div>
                        <div className="font-black mb-1 uppercase">ITENS:</div>
                        {ticketData.items.map((i: any, idx: number) => (
                            <div key={idx} className="flex justify-between mb-0.5">
                                <span className="flex-1 truncate pr-1">{i.unitsSold}x {i.productName}</span>
                                <span className="shrink-0">{formatCurrency(i.totalValue)}</span>
                            </div>
                        ))}
                        
                        <div className="border-t border-dashed border-black my-2"></div>
                        <div className="flex justify-between font-black text-[10px]">
                            <span className="uppercase">TOTAL</span>
                            <span>{formatCurrency(ticketData.items.reduce((acc: number, c: any) => acc + c.totalValue, 0))}</span>
                        </div>
                        
                        <div className="mt-3 flex justify-between">
                            <span className="uppercase">PAGTO:</span>
                            <span className="font-black">{(ticketData.method || 'MISTO').toUpperCase()}</span>
                        </div>
                        {ticketData.buyer && (
                            <div className="flex justify-between">
                                <span className="uppercase">FUNC:</span>
                                <span className="font-black truncate max-w-[30mm]">{ticketData.buyer}</span>
                            </div>
                        )}

                        {(ticketData.method?.toUpperCase().includes('FIADO') || ticketData.buyer) && (
                            <div className="mt-4">
                                <div className="border-t border-black pt-1 text-center font-bold" style={{ fontSize: '7px' }}>ASSINATURA DO CLIENTE</div>
                                <div className="text-center" style={{ fontSize: '6px' }}>AUTORIZO O LANÇAMENTO NO MEU DÉBITO</div>
                            </div>
                        )}
                        
                        <div className="border-t border-dashed border-black my-2"></div>
                        <div className="text-center mt-3 leading-tight opacity-70 italic" style={{ fontSize: '8px' }}>
                            Aguarde ser atendido<br/>
                            Real Admin v6.5<br/>
                            Unid: {stores.find(s => s.id === effectiveStoreId)?.number || '---'}
                        </div>
                    </div>
                </div>

                <div className="p-4 bg-white border-t flex flex-col gap-2 shrink-0">
                    <button 
                        onClick={() => handlePrintTicket(ticketData.items, ticketData.saleCode, ticketData.method, ticketData.buyer)}
                        className="w-full py-4 bg-blue-900 text-white rounded-[20px] font-black uppercase text-[10px] shadow-xl active:scale-95 border-b-4 border-blue-950 flex items-center justify-center gap-2 transition-all"
                    >
                        <Printer size={16}/> Imprimir Agora
                    </button>
                    <button 
                        onClick={onClose}
                        className="w-full py-3 bg-gray-100 text-gray-500 rounded-[20px] font-black uppercase text-[9px] active:scale-95"
                    >
                        Fechar Prévia
                    </button>
                </div>
            </div>
        </div>
    );
};

export default TicketModal;
