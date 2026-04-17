import React, { useState } from 'react';
import { 
    Clock, DollarSign, AlertTriangle, Printer, ExternalLink, 
    XCircle, ChevronUp, ChevronDown, Wallet, Package 
} from 'lucide-react';
import { formatCurrency } from '../../../constants';
import { User } from '../../../types';
import WastageModal from '../modals/WastageModal';
import SangriaModal from '../modals/SangriaModal';

interface DREDiarioTabProps {
    dreStats: any;
    displayDate: string;
    setDisplayDate: (date: string) => void;
    effectiveStoreId: string;
    handlePrintDRE: () => void;
    sangriaCategories: any[];
    onAddSangria: (sangria: any) => Promise<void>;
    onUpdateStock: (storeId: string, base: string, value: number, unit: string, type: any, stockId?: string) => Promise<void>;
    filteredStock: any[];
    fetchData?: () => Promise<void>;
    onAddSangriaCategory: (name: string, storeId: string) => Promise<void>;
    onShowSangriaDetail: () => void;
    user: User;
}

const DREDiarioTab: React.FC<DREDiarioTabProps> = ({
    dreStats,
    displayDate,
    setDisplayDate,
    effectiveStoreId,
    handlePrintDRE,
    sangriaCategories,
    onAddSangria,
    onUpdateStock,
    filteredStock,
    fetchData,
    onAddSangriaCategory,
    onShowSangriaDetail,
    user
}) => {
    const [dreSubTab, setDreSubTab] = useState<'resumo' | 'detalhado'>('resumo');
    const [showSangriaModal, setShowSangriaModal] = useState(false);
    const [showWastageModal, setShowWastageModal] = useState(false);
    const [showCanceledDetails, setShowCanceledDetails] = useState(false);
    const [sangriaForm, setSangriaForm] = useState({ amount: '', categoryId: '', description: '' });
    const [sangriaDate, setSangriaDate] = useState(new Date().toISOString().split('T')[0]);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSaveSangria = async () => {
        if (!sangriaForm.amount || !sangriaForm.categoryId) return;
        setIsSubmitting(true);
        try {
            await onAddSangria({
                amount: parseFloat(sangriaForm.amount.replace(',', '.')),
                category_id: sangriaForm.categoryId,
                description: sangriaForm.description.toUpperCase(),
                transaction_date: sangriaDate,
                store_id: effectiveStoreId
            });
            setShowSangriaModal(false);
            setSangriaForm({ amount: '', categoryId: '', description: '' });
            if (fetchData) await fetchData();
        } catch (e: any) {
            alert("Erro: " + e.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="p-4 md:p-8 space-y-6 animate-in fade-in duration-300 max-w-5xl mx-auto pb-20">
            <div className="bg-white p-8 rounded-[40px] shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between items-center gap-6">
                <div className="flex items-center gap-4">
                    <div className="p-4 bg-blue-50 text-blue-700 rounded-3xl"><Clock size={32}/></div>
                    <div>
                        <h3 className="text-2xl font-black uppercase italic text-blue-950 tracking-tighter">Fluxo de Caixa <span className="text-blue-700">Diário</span></h3>
                        <div className="flex items-center gap-2 mt-2">
                            <input 
                                type="date" 
                                value={displayDate} 
                                onChange={e => setDisplayDate(e.target.value)} 
                                className="bg-transparent border-none text-[10px] font-black uppercase text-gray-400 outline-none cursor-pointer hover:text-blue-600 transition-all"
                            />
                            <span className="text-[10px] font-bold text-gray-300 uppercase tracking-widest">• {new Date(displayDate + 'T00:00:00').toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
                        </div>
                        <div className="flex bg-gray-100 p-1 rounded-lg mt-2">
                            <button onClick={() => setDreSubTab('resumo')} className={`px-4 py-1.5 rounded-md text-[9px] font-black uppercase transition-all ${dreSubTab === 'resumo' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-400'}`}>Resumo</button>
                            <button onClick={() => setDreSubTab('detalhado')} className={`px-4 py-1.5 rounded-md text-[9px] font-black uppercase transition-all ${dreSubTab === 'detalhado' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-400'}`}>Detalhado</button>
                        </div>
                    </div>
                </div>
                <div className="flex flex-col items-end gap-3">
                    {dreStats.user?.role !== 'ICE_CREAM' && (
                        <div className="flex gap-2">
                            <button onClick={() => setShowSangriaModal(true)} className="px-6 py-2.5 bg-red-500 text-white rounded-xl font-black uppercase text-[10px] shadow-lg flex items-center gap-2 border-b-4 border-red-700 active:scale-95"><DollarSign size={14}/> Sangria</button>
                            <button onClick={() => setShowWastageModal(true)} className="px-6 py-2.5 bg-orange-500 text-white rounded-xl font-black uppercase text-[10px] shadow-lg flex items-center gap-2 border-b-4 border-orange-700 active:scale-95"><AlertTriangle size={14}/> Baixa Avaria</button>
                        </div>
                    )}
                    <button
                        onClick={handlePrintDRE}
                        className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-2xl font-black uppercase text-xs hover:bg-blue-700 transition-all shadow-lg active:scale-95 w-full justify-center"
                    >
                        <Printer size={20} />
                        Imprimir DRE
                    </button>
                </div>
            </div>

            {dreSubTab === 'resumo' && (
                <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-white p-6 rounded-[32px] border-2 border-green-100 shadow-sm space-y-4">
                            <span className="text-[9px] font-black text-green-600 uppercase tracking-widest">Resumo por Método de Pagamento</span>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="p-3 bg-green-50/50 rounded-2xl border border-green-100">
                                    <p className="text-[8px] font-black text-green-600 uppercase">Pix ({dreStats.dayMethods.pix.count})</p>
                                    <p className="text-xs font-black text-green-900 mt-1">{formatCurrency(dreStats.dayMethods.pix.total)}</p>
                                </div>
                                <div className="p-3 bg-green-50/50 rounded-2xl border border-green-100">
                                    <p className="text-[8px] font-black text-green-600 uppercase">Dinheiro ({dreStats.dayMethods.money.count})</p>
                                    <p className="text-xs font-black text-green-900 mt-1">{formatCurrency(dreStats.dayMethods.money.total)}</p>
                                </div>
                                <div className="p-3 bg-green-50/50 rounded-2xl border border-green-100">
                                    <p className="text-[8px] font-black text-green-600 uppercase">Cartão ({dreStats.dayMethods.card.count})</p>
                                    <p className="text-xs font-black text-green-900 mt-1">{formatCurrency(dreStats.dayMethods.card.total)}</p>
                                </div>
                                <div className="p-3 bg-green-50/50 rounded-2xl border border-green-100">
                                    <p className="text-[8px] font-black text-green-600 uppercase">Fiado ({dreStats.dayMethods.fiado.count})</p>
                                    <p className="text-xs font-black text-green-900 mt-1">{formatCurrency(dreStats.dayMethods.fiado.total)}</p>
                                </div>
                            </div>
                            <div className="pt-3 border-t-2 border-green-50 flex justify-between items-baseline">
                                <span className="text-[9px] font-black text-gray-400 uppercase">Total Entradas</span>
                                <p className="text-2xl font-black text-green-700 italic">{formatCurrency(dreStats.dayIn)}</p>
                            </div>
                        </div>
                        <div 
                            className="bg-white p-6 rounded-[32px] border-2 border-red-100 shadow-sm flex flex-col justify-between cursor-pointer hover:bg-red-50 transition-all"
                            onClick={onShowSangriaDetail}
                        >
                            <div>
                                <span className="text-[9px] font-black text-red-600 uppercase tracking-widest flex items-center gap-2">Resumo Saídas (-) <ExternalLink size={10}/></span>
                                <p className="text-3xl font-black text-red-700 italic mt-4">{formatCurrency(dreStats.daySangriaTotal)}</p>
                            </div>
                        </div>
                        <div className="bg-gray-950 p-6 rounded-[32px] text-white shadow-xl flex flex-col justify-between">
                            <div>
                                <span className="text-[9px] font-black text-blue-400 uppercase tracking-widest">Saldo Líquido</span>
                                <p className="text-3xl font-black italic mt-4">{formatCurrency(dreStats.dayProfit)}</p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white p-8 rounded-[40px] border border-gray-100 shadow-sm">
                        <h4 className="text-[10px] font-black text-blue-500 uppercase tracking-widest mb-6 flex items-center gap-2">
                            <Package size={16} /> Detalhamento de Vendas do Período
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                            {dreStats.resumoItensRodape.map(([name, data]: any) => (
                                <div key={name} className="p-4 bg-gray-50 rounded-2xl border border-gray-100 hover:bg-blue-50 transition-all">
                                    <p className="text-[10px] font-black text-blue-950 uppercase italic truncate">{name}</p>
                                    <div className="flex justify-between items-center mt-2">
                                        <span className="text-[9px] font-bold text-gray-400 uppercase">QTD: {data.qtd}</span>
                                        <span className="text-[10px] font-black text-blue-700">{formatCurrency(data.total)}</span>
                                    </div>
                                </div>
                            ))}
                            {dreStats.resumoItensRodape.length === 0 && (
                                <p className="col-span-full text-center py-10 text-gray-400 uppercase text-[10px] font-black italic">Nenhuma venda registrada hoje</p>
                            )}
                        </div>
                    </div>

                    <div className="bg-white p-8 rounded-[40px] border border-gray-100 shadow-sm">
                        <div className="flex justify-between items-center mb-6">
                            <h4 className="text-[10px] font-black text-red-500 uppercase tracking-widest flex items-center gap-2">
                                <XCircle size={16} /> Vendas Canceladas no Dia ({dreStats.dayCanceledCount})
                            </h4>
                            <button 
                                onClick={() => setShowCanceledDetails(!showCanceledDetails)}
                                className="px-4 py-2 bg-gray-50 rounded-xl text-[10px] font-black uppercase hover:bg-gray-100 transition-all flex items-center gap-2"
                            >
                                {showCanceledDetails ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}
                                {showCanceledDetails ? 'Ocultar Detalhes' : 'Ver Detalhes'}
                            </button>
                        </div>
                        
                        {showCanceledDetails && (
                            <div className="space-y-3 animate-in slide-in-from-top-2 duration-300">
                                {dreStats.dayCanceledDetails.map((c: any) => (
                                    <div key={c.id} className="flex justify-between items-center p-4 bg-red-50/50 rounded-2xl border border-red-100">
                                        <div className="flex flex-col">
                                            <span className="text-[10px] font-black text-red-900 uppercase">#{c.saleCode} - {new Date(c.createdAt).toLocaleTimeString()}</span>
                                            <span className="text-[9px] font-bold text-gray-500 uppercase mt-1">Motivo: <span className="text-red-600 italic">{c.cancelReason}</span></span>
                                            <span className="text-[8px] font-black text-gray-400 uppercase">Por: {c.canceledBy}</span>
                                        </div>
                                        <span className="text-xs font-black text-red-700">{formatCurrency(c.totalValue)}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {dreSubTab === 'detalhado' && (
                <div className="bg-white p-8 rounded-[40px] border border-gray-100 shadow-sm space-y-6">
                    <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest border-b pb-4">Detalhamento de Saídas</h4>
                    <div className="space-y-4">
                        {dreStats.dayExits.map((exit: any) => (
                            <div key={exit.id} className="flex justify-between items-center p-4 bg-gray-50 rounded-2xl border border-gray-100">
                                <div>
                                    <p className="text-[10px] font-black text-blue-950 uppercase italic">{exit.description || 'SEM DESCRIÇÃO'}</p>
                                    <p className="text-[8px] font-bold text-gray-400 uppercase mt-1">{exit.category}</p>
                                </div>
                                <span className="text-sm font-black text-red-600 italic">{formatCurrency(exit.value)}</span>
                            </div>
                        ))}
                        {dreStats.dayExits.length === 0 && (
                            <p className="text-center py-10 text-gray-400 uppercase text-[10px] font-black italic">Nenhuma saída registrada hoje</p>
                        )}
                    </div>
                </div>
            )}

            <SangriaModal 
                isOpen={showSangriaModal}
                onClose={() => setShowSangriaModal(false)}
                onSubmit={handleSaveSangria}
                form={sangriaForm}
                setForm={setSangriaForm}
                date={sangriaDate}
                setDate={setSangriaDate}
                categories={sangriaCategories}
                isSubmitting={isSubmitting}
                onManageCategories={() => {}}
            />

            <WastageModal 
                isOpen={showWastageModal}
                onClose={() => setShowWastageModal(false)}
                onUpdateStock={onUpdateStock}
                filteredStock={filteredStock}
                effectiveStoreId={effectiveStoreId}
                fetchData={fetchData}
                user={user}
            />
        </div>
    );
};

export default DREDiarioTab;
