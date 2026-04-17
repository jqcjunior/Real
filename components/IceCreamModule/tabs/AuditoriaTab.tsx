import React from 'react';
import { 
    History, Search, X, Wallet, Zap, Printer, Ban, Trash2
} from 'lucide-react';
import { formatCurrency } from '../../../constants';
import { MONTHS } from '../constants';
 
interface AuditoriaTabProps {
    auditSubTab: 'vendas' | 'avarias' | 'cancelamentos';
    setAuditSubTab: (tab: 'vendas' | 'avarias' | 'cancelamentos') => void;
    showDaySummary: boolean;
    setShowDaySummary: (show: boolean) => void;
    auditDay: string;
    setAuditDay: (day: string) => void;
    auditMonth: string;
    setAuditMonth: (month: string) => void;
    auditYear: string;
    setAuditYear: (year: string) => void;
    auditSearch: string;
    setAuditSearch: (search: string) => void;
    auditSummary: any;
    groupedAuditSales: any[];
    filteredAuditWastage: any[];
    filteredCancelations: any[];
    handleOpenPrintPreview: (items: any[], saleCode: string, method: string, buyer?: string) => void;
    onCancelSale: (saleId: string, saleCode: string) => void;
    items: any[];
    stock: any[];
    isSorvete: boolean;
}
 
const AuditoriaTab: React.FC<AuditoriaTabProps> = ({
    auditSubTab,
    setAuditSubTab,
    showDaySummary,
    setShowDaySummary,
    auditDay,
    setAuditDay,
    auditMonth,
    setAuditMonth,
    auditYear,
    setAuditYear,
    auditSearch,
    setAuditSearch,
    auditSummary,
    groupedAuditSales,
    filteredAuditWastage,
    filteredCancelations,
    handleOpenPrintPreview,
    onCancelSale,
    items,
    stock,
    isSorvete
}) => {
    return (
        <div className="p-4 md:p-8 space-y-6 animate-in fade-in duration-300 max-w-6xl mx-auto pb-20">
            <div className="bg-white p-6 rounded-[40px] shadow-sm border border-gray-100 flex flex-col gap-6">
                <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                    <div>
                        <h3 className="text-xl font-black uppercase italic text-blue-950 tracking-tighter flex items-center gap-3">
                            <History className="text-blue-700" size={28}/> Auditoria <span className="text-red-600">Geral</span>
                        </h3>
                        <div className="flex bg-gray-100 p-1 rounded-xl mt-3">
                            <button onClick={() => setAuditSubTab('vendas')} className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${auditSubTab === 'vendas' ? 'bg-white text-blue-900 shadow-sm' : 'text-gray-400'}`}>
                                Vendas Operacionais
                            </button>
                            <button onClick={() => setAuditSubTab('avarias')} className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${auditSubTab === 'avarias' ? 'bg-white text-blue-900 shadow-sm' : 'text-gray-400'}`}>
                                Baixas / Avarias
                            </button>
                            <button onClick={() => setAuditSubTab('cancelamentos')} className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${auditSubTab === 'cancelamentos' ? 'bg-white text-red-900 shadow-sm' : 'text-gray-400'}`}>
                                Cancelamentos
                            </button>
                        </div>
                    </div>
                    {auditSubTab !== 'cancelamentos' && (
                        <div className="flex items-center gap-3">
                            <button 
                                onClick={() => setShowDaySummary(!showDaySummary)}
                                className="px-6 py-3 bg-blue-600 text-white rounded-2xl font-black uppercase text-[10px] shadow-lg flex items-center gap-2 hover:bg-blue-700 transition-all"
                            >
                                📊 Resumo do Dia
                            </button>
                        </div>
                    )}
                </div>
                
                {auditSubTab === 'cancelamentos' ? (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        <select value={auditMonth} onChange={e => setAuditMonth(e.target.value)} className="bg-gray-50 border-none rounded-xl p-3 text-[10px] font-black uppercase text-slate-900 outline-none shadow-inner">
                            <option value="">MÊS</option>
                            {MONTHS.map(m => <option key={m.value} value={String(m.value)}>{m.label}</option>)}
                        </select>
                        <select value={auditYear} onChange={e => setAuditYear(e.target.value)} className="bg-gray-50 border-none rounded-xl p-3 text-[10px] font-black uppercase text-slate-900 outline-none shadow-inner">
                            <option value="">ANO</option>
                            {[2024, 2025, 2026].map(y => <option key={y} value={String(y)}>{y}</option>)}
                        </select>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" size={14}/>
                            <input value={auditSearch} onChange={e => setAuditSearch(e.target.value)} placeholder="CÓDIGO OU FUNCIONÁRIO..." className="w-full bg-gray-50 border-none rounded-xl pl-10 pr-4 py-3 text-[10px] font-black uppercase outline-none shadow-inner" />
                        </div>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                        <select value={auditDay} onChange={e => setAuditDay(e.target.value)} className="bg-gray-50 border-none rounded-xl p-3 text-[10px] font-black uppercase text-slate-900 outline-none shadow-inner">
                            <option value="">DIA</option>
                            {Array.from({length: 31}, (_, i) => <option key={i+1} value={String(i+1)}>{i+1}</option>)}
                        </select>
                        <select value={auditMonth} onChange={e => setAuditMonth(e.target.value)} className="bg-gray-50 border-none rounded-xl p-3 text-[10px] font-black uppercase text-slate-900 outline-none shadow-inner">
                            <option value="">MÊS</option>
                            {MONTHS.map(m => <option key={m.value} value={String(m.value)}>{m.label}</option>)}
                        </select>
                        <select value={auditYear} onChange={e => setAuditYear(e.target.value)} className="bg-gray-50 border-none rounded-xl p-3 text-[10px] font-black uppercase text-slate-900 outline-none shadow-inner">
                            <option value="">ANO</option>
                            {[2024, 2025, 2026].map(y => <option key={y} value={String(y)}>{y}</option>)}
                        </select>
                        <div className="col-span-2 relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" size={14}/>
                            <input value={auditSearch} onChange={e => setAuditSearch(e.target.value)} placeholder="PRODUTO, CÓDIGO OU FUNCIONÁRIO..." className="w-full bg-gray-50 border-none rounded-xl pl-10 pr-4 py-3 text-[10px] font-black uppercase outline-none shadow-inner" />
                        </div>
                    </div>
                )}
            </div>
 
            {showDaySummary && auditSubTab !== 'cancelamentos' && (
                <div className="bg-white p-8 rounded-[40px] shadow-2xl border-2 border-blue-100 animate-in slide-in-from-top duration-500">
                    <div className="flex items-center justify-between mb-6">
                        <h4 className="text-xl font-black uppercase italic text-blue-950 flex items-center gap-3">
                            📊 Resumo do Dia
                        </h4>
                        <button onClick={() => setShowDaySummary(false)} className="text-gray-400 hover:text-red-500 transition-all"><X size={24}/></button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                        {auditSummary.resumoItens.map(([name, data]: any) => (
                            <div key={name} className="bg-gray-50 p-4 rounded-3xl border border-gray-100">
                                <p className="text-xs font-black text-blue-900 uppercase italic truncate mb-1">{name}</p>
                                <div className="flex justify-between items-end">
                                    <p className="text-[10px] font-bold text-gray-400 uppercase">{data.qtd} unidades</p>
                                    <p className="text-sm font-black text-blue-600">{formatCurrency(data.total)}</p>
                                </div>
                            </div>
                        ))}
                        <div className="bg-red-50 p-4 rounded-3xl border border-red-100">
                            <p className="text-xs font-black text-red-900 uppercase italic truncate mb-1">Vendas Canceladas</p>
                            <div className="flex justify-between items-end">
                                <p className="text-[10px] font-bold text-red-400 uppercase">{auditSummary.totalCanceledCount} vendas</p>
                                <p className="text-sm font-black text-red-600">{formatCurrency(auditSummary.totalCanceledValue)}</p>
                            </div>
                        </div>
                    </div>
                    <div className="mt-8 pt-6 border-t border-dashed border-gray-200">
                        <h5 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                            <Wallet size={14} className="text-blue-600" /> Resumo Financeiro por Método
                        </h5>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                            {Object.entries(auditSummary.resumoPagamentos).map(([method, total]) => (
                                <div key={method} className="bg-blue-50/50 p-4 rounded-2xl border border-blue-100">
                                    <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-1">
                                        {method === 'Dinheiro' ? 'À Vista' : method}
                                    </p>
                                    <div className="flex justify-between items-end mt-2">
                                        <div className="flex flex-col">
                                            <span className="text-[8px] font-bold text-gray-400 uppercase">Recebimentos</span>
                                            <span className="text-xs font-black text-blue-950">{auditSummary.resumoPagamentosQtd[method]}</span>
                                        </div>
                                        <div className="flex flex-col items-end">
                                            <span className="text-[8px] font-bold text-gray-400 uppercase">Total</span>
                                            <span className="text-sm font-black text-blue-900">{formatCurrency(total as number)}</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="flex justify-between items-center bg-blue-950 p-6 rounded-3xl text-white shadow-xl">
                            <div className="flex flex-col">
                                <p className="text-[10px] font-black text-blue-300 uppercase tracking-widest">Total Financeiro</p>
                                <p className="text-[9px] text-blue-400 mt-1">Soma de todos os recebimentos</p>
                            </div>
                            <p className="text-3xl font-black italic">{formatCurrency(auditSummary.totalGeral)}</p>
                        </div>
                    </div>
                </div>
            )}
 
            {auditSubTab !== 'cancelamentos' && (
                <div className="flex flex-wrap gap-6 px-4 py-2 bg-blue-50/50 rounded-2xl border border-blue-100/50">
                    <div className="flex items-center gap-2">
                        <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Total vendido no período:</span>
                        <span className="text-xs font-black text-blue-700">{formatCurrency(auditSummary.totalGeral)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Total de itens vendidos:</span>
                        <span className="text-xs font-black text-blue-700">{auditSummary.totalItens} itens</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-[9px] font-black text-red-400 uppercase tracking-widest">Vendas Canceladas:</span>
                        <span className="text-xs font-black text-red-700">{auditSummary.totalCanceledCount} ({formatCurrency(auditSummary.totalCanceledValue)})</span>
                    </div>
                </div>
            )}
 
            {auditSubTab === 'vendas' ? (
                <div className="bg-white rounded-[40px] shadow-xl border border-gray-100 overflow-hidden">
                    <table className="w-full text-left">
                        <thead className="bg-gray-50 text-[9px] font-black text-gray-400 uppercase border-b">
                            <tr>
                                <th className="px-8 py-5">Cod / Data</th>
                                <th className="px-8 py-5">Produtos / Baixas</th>
                                <th className="px-8 py-5">Pagamento</th>
                                <th className="px-8 py-5 text-right">Total</th>
                                {!isSorvete && <th className="px-8 py-5 text-center">Ações</th>}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50 font-bold text-[10px]">
                            {groupedAuditSales.map((saleGroup: any) => (
                                <tr key={saleGroup.saleCode} className={`hover:bg-blue-50/30 transition-all ${saleGroup.status === 'canceled' ? 'opacity-50 grayscale italic line-through' : ''}`}>
                                    <td className="px-8 py-5">
                                        <div className="text-xs font-black text-blue-950">#{saleGroup.saleCode}</div>
                                        <div className="text-[8px] text-gray-400 uppercase mt-0.5">{new Date(saleGroup.createdAt).toLocaleString('pt-BR')}</div>
                                    </td>
                                    <td className="px-8 py-5">
                                        {saleGroup.items.map((item: any, idx: number) => {
                                            const itemDef = items.find(it => it.id === item.itemId) || items.find(it => it.name === item.productName);
                                            return (
                                                <div key={idx} className="mb-3 last:mb-0">
                                                    <div className="text-[10px] font-black text-gray-900 uppercase italic tracking-tighter">{item.unitsSold}x {item.productName}</div>
                                                    {itemDef?.recipe?.map((r: any, i: number) => (
                                                        <div key={i} className="text-[8px] text-orange-600 font-black flex items-center gap-1 ml-2 uppercase">
                                                            <Zap size={8} /> Abate: {(r.quantity * item.unitsSold).toFixed(3)} - {r.stock_base_name}
                                                        </div>
                                                    ))}
                                                </div>
                                            );
                                        })}
                                    </td>
                                    <td className="px-8 py-5">
                                        <div className="flex flex-wrap gap-1">
                                            {saleGroup.paymentMethods.map((pm: any, idx: number) => (
                                                <span key={idx} className="px-2 py-0.5 rounded text-[8px] font-black uppercase border bg-green-50 text-green-700 border-green-100">{pm}</span>
                                            ))}
                                        </div>
                                        {saleGroup.buyer_name && <div className="text-[8px] text-gray-400 uppercase mt-1 truncate">Comprador: {saleGroup.buyer_name}</div>}
                                    </td>
                                    <td className="px-8 py-5 text-right font-black text-sm">{formatCurrency(saleGroup.totalValue)}</td>
                                    {!isSorvete && (
                                        <td className="px-8 py-5 text-center">
                                            <div className="flex items-center justify-center gap-2">
                                                {saleGroup.status !== 'canceled' && (
                                                    <>
                                                        <button 
                                                            onClick={() => handleOpenPrintPreview(saleGroup.items, saleGroup.saleCode, saleGroup.paymentMethods.join(' + '), saleGroup.buyer_name)} 
                                                            className="p-2 text-blue-400 hover:text-blue-600 transition-all"
                                                            title="Reimprimir Ticket"
                                                        >
                                                            <Printer size={18}/>
                                                        </button>
                                                        <button 
                                                            onClick={() => onCancelSale(saleGroup.id, saleGroup.saleCode)} 
                                                            className="p-2 text-red-400 hover:text-red-600 transition-all"
                                                            title="Cancelar Venda"
                                                        >
                                                            <Trash2 size={18}/>
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </td>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : auditSubTab === 'avarias' ? (
                <div className="bg-white rounded-[40px] shadow-xl border border-gray-100 overflow-hidden">
                    <table className="w-full text-left">
                        <thead className="bg-gray-50 text-[9px] font-black text-gray-400 uppercase border-b">
                            <tr>
                                <th className="px-8 py-5">Cod / Data</th>
                                <th className="px-8 py-5">Produtos / Baixas</th>
                                <th className="px-8 py-5 text-right">Total</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50 font-bold text-[10px]">
                            {filteredAuditWastage.map((f: any) => (
                                <tr key={f.id} className="hover:bg-orange-50/20 transition-all">
                                    <td className="px-8 py-5">
                                        <div className="text-[10px] font-black text-gray-900 uppercase">{new Date(f.created_at).toLocaleDateString('pt-BR')}</div>
                                        <div className="text-[8px] text-gray-400 uppercase mt-0.5">{new Date(f.created_at).toLocaleTimeString('pt-BR')}</div>
                                    </td>
                                    <td className="px-8 py-5">
                                        <div className="text-[10px] font-black text-orange-700 uppercase italic tracking-tighter">BAIXA DE AVARIA / DEFEITO</div>
                                        <div className="text-[9px] text-gray-600 font-medium uppercase mt-1 leading-relaxed">
                                            {f.stock_base_name} - {Math.abs(f.quantity)} {stock.find(s => s.product_base === f.stock_base_name)?.unit || ''}
                                            {f.created_by && (
                                                <span className="ml-2 px-2 py-0.5 bg-gray-100 text-gray-500 rounded lowercase text-[7px] font-normal italic">por {f.created_by}</span>
                                            )}
                                            <br/>
                                            <span className="text-[8px] text-gray-400 italic">Motivo: {f.reason}</span>
                                        </div>
                                    </td>
                                    <td className="px-8 py-5 text-right">
                                        <span className="px-3 py-1 rounded-full text-[8px] font-black uppercase border bg-red-50 text-red-700 border-red-100">STOCK_OUT</span>
                                    </td>
                                </tr>
                            ))}
                            {filteredAuditWastage.length === 0 && (
                                <tr><td colSpan={3} className="px-8 py-10 text-center text-gray-400 uppercase font-black tracking-widest italic">Nenhuma baixa de avaria encontrada para os filtros selecionados</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            ) : (
                <div className="bg-white rounded-[40px] shadow-xl border border-gray-100 overflow-hidden">
                    <table className="w-full text-left">
                        <thead className="bg-gray-50 text-[9px] font-black text-gray-400 uppercase border-b">
                            <tr>
                                <th className="px-8 py-5">Código</th>
                                <th className="px-8 py-5">Data / Hora</th>
                                <th className="px-8 py-5">Cancelado Por</th>
                                <th className="px-8 py-5">Justificativa</th>
                                <th className="px-8 py-5 text-right">Valor</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50 font-bold text-[10px]">
                            {filteredCancelations.map((c: any) => (
                                <tr key={c.id} className="hover:bg-red-50/20 transition-all">
                                    <td className="px-8 py-5">
                                        <div className="flex items-center gap-2">
                                            <Ban size={14} className="text-red-500" />
                                            <span className="text-xs font-black text-red-900">#{c.saleCode}</span>
                                        </div>
                                    </td>
                                    <td className="px-8 py-5">
                                        <div className="text-[10px] font-black text-gray-900 uppercase">{new Date(c.createdAt).toLocaleDateString('pt-BR')}</div>
                                        <div className="text-[8px] text-gray-400 uppercase mt-0.5">{new Date(c.createdAt).toLocaleTimeString('pt-BR')}</div>
                                    </td>
                                    <td className="px-8 py-5">
                                        <span className="px-3 py-1 rounded-full text-[8px] font-black uppercase bg-gray-100 text-gray-700 border border-gray-200">
                                            {c.canceled_by || 'NÃO REGISTRADO'}
                                        </span>
                                    </td>
                                    <td className="px-8 py-5">
                                        <div className="text-[9px] text-gray-600 font-medium italic max-w-md">
                                            {c.cancel_reason || 'Sem justificativa'}
                                        </div>
                                    </td>
                                    <td className="px-8 py-5 text-right">
                                        <span className="text-sm font-black text-red-700">{formatCurrency(c.totalValue)}</span>
                                    </td>
                                </tr>
                            ))}
                            {filteredCancelations.length === 0 && (
                                <tr><td colSpan={5} className="px-8 py-10 text-center text-gray-400 uppercase font-black tracking-widest italic">Nenhum cancelamento encontrado para o período selecionado</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};
 
export default AuditoriaTab;