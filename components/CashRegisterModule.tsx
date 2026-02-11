import React, { useState, useMemo } from 'react';
import { User, IceCreamDailySale, IceCreamTransaction, Receipt, CashError, UserRole } from '../types';
import { formatCurrency, BRAND_LOGO } from '../constants';
import { 
    DollarSign, Save, Calendar, FileText, CreditCard, AlertTriangle, 
    Plus, Trash2, Printer, Loader2, CreditCard as CardIcon, Trash, CheckCircle2, User as UserIcon, PenTool
} from 'lucide-react';
import { supabase } from '../services/supabaseClient';

interface CashRegisterModuleProps {
    user: User;
    sales: IceCreamDailySale[];
    finances: IceCreamTransaction[];
    closures: any[];
    receipts: Receipt[];
    errors: CashError[];
    onAddClosure: (closure: any) => Promise<void>;
    onAddReceipt: (receipt: any) => Promise<void>;
    onAddError: (error: any) => Promise<void>;
    onDeleteError: (id: string) => Promise<void>;
}

const CARD_BRANDS = [
    'Visa Débito', 'Visa Crédito', 'Master Débito', 'Master Crédito', 
    'American Express', 'Diners', 'Elo Débito', 'Elo Crédito'
];

const numberToWords = (value: number): string => {
    if (value === 0) return "ZERO REAIS";
    const unidades = ["", "UM", "DOIS", "TRÊS", "QUATRO", "CINCO", "SEIS", "SETE", "OITO", "NOVE"];
    const dez_vinte = ["DEZ", "ONZE", "DOZE", "TREZE", "QUATORZE", "QUINZE", "DEZESSEIS", "DEZESSETE", "DEZOITO", "DEZENOVE"];
    const dezenas = ["", "DEZ", "VINTE", "TRINTA", "QUARENTA", "CINQUENTA", "SESSENTA", "SETENTA", "OITENTA", "NOVENTA"];
    const centenas = ["", "CENTO", "DUZENTOS", "TREZENTOS", "QUATROCENTOS", "QUINHENTOS", "SEISCENTOS", "SETECENTOS", "OITOCENTOS", "NOVECENTOS"];

    const convertGroup = (n: number): string => {
        if (n < 10) return unidades[n];
        if (n < 20) return dez_vinte[n - 10];
        if (n < 100) {
            const u = n % 10;
            const d = Math.floor(n / 10);
            return dezenas[d] + (u > 0 ? " E " + unidades[u] : "");
        }
        if (n === 100) return "CEM";
        if (n < 1000) {
            const c = Math.floor(n / 100);
            const rest = n % 100;
            return centenas[c] + (rest > 0 ? " E " + convertGroup(rest) : "");
        }
        return "";
    };

    const integerPart = Math.floor(value);
    const decimalPart = Math.round((value - integerPart) * 100);
    let text = "";
    if (integerPart > 0) {
        if (integerPart === 1) text += "UM REAL";
        else if (integerPart < 1000) text += convertGroup(integerPart) + " REAIS";
        else if (integerPart < 1000000) {
            const mil = Math.floor(integerPart / 1000);
            const rest = integerPart % 1000;
            text += (mil === 1 ? "UM MIL" : convertGroup(mil) + " MIL");
            if (rest > 0) text += (rest < 100 || rest % 100 === 0 ? " E " : ", ") + convertGroup(rest);
            text += " REAIS";
        }
    }
    if (decimalPart > 0) {
        if (integerPart > 0) text += " E ";
        text += convertGroup(decimalPart) + (decimalPart === 1 ? " CENTAVO" : " CENTAVOS");
    }
    return text.trim();
};

export const printReceiptDoc = (r: any) => {
    const printWindow = window.open('', '_blank', 'width=800,height=600');
    if (!printWindow) return;
    const html = `
        <html>
        <head>
            <script src="https://cdn.tailwindcss.com"></script>
            <style>
                @page { size: 150mm 100mm; margin: 0; }
                body { padding: 5mm; font-family: serif; background: white; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                .border-box { border: 2px solid #000; height: 90mm; padding: 10px; display: flex; flex-direction: column; position: relative; }
                .logo-header { display: flex; flex-direction: column; align-items: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 15px; }
            </style>
        </head>
        <body>
            <div class="border-box">
                <div class="logo-header">
                    <img src="${BRAND_LOGO}" class="h-14 w-auto mb-2" />
                    <h1 class="text-xl font-black uppercase italic leading-none">Real Calçados</h1>
                    <p class="text-[10px] font-bold uppercase tracking-widest mt-1">Comprovante de Pagamento</p>
                </div>
                
                <div class="flex justify-between items-baseline mb-6">
                    <div class="text-2xl font-black text-gray-400">RECIBO Nº <span class="text-red-600">${String(r.id).padStart(4, '0')}</span></div>
                    <div class="border-2 border-black px-6 py-2 bg-gray-50 text-3xl font-black italic">${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(r.value)}</div>
                </div>

                <div class="space-y-4 flex-1 text-base">
                    <p class="leading-relaxed">Recebi(emos) de: <span class="font-bold border-b border-dotted border-black px-2">${r.payer}</span></p>
                    <p class="leading-relaxed">A quantia de: <span class="font-bold italic bg-gray-50 border border-gray-200 px-2 block w-full mt-1 text-sm">${r.valueInWords}</span></p>
                    <p class="leading-relaxed">Referente a: <span class="font-bold border-b border-dotted border-black px-2">${r.reference}</span></p>
                </div>

                <div class="mt-4 text-center">
                    <div class="text-sm font-bold mb-6">${new Date(r.date + 'T12:00:00').toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
                    <div class="w-3/4 mx-auto border-t-2 border-black pt-1">
                        <p class="font-bold uppercase text-sm">${r.recipient}</p>
                        <p class="text-[9px] uppercase font-bold text-gray-400 tracking-tighter">Assinatura do Recebedor</p>
                    </div>
                </div>
            </div>
            <script>window.onload = () => { setTimeout(() => { window.print(); window.close(); }, 800); }</script>
        </body>
        </html>
    `;
    printWindow.document.write(html);
    printWindow.document.close();
};

const CashRegisterModule: React.FC<CashRegisterModuleProps> = ({ 
    user, receipts, errors, onAddReceipt, onAddError, onDeleteError 
}) => {
    const [activeTab, setActiveTab] = useState<'recibos' | 'cartoes' | 'quebras'>('recibos');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

    const nextReceiptNumber = useMemo(() => {
        if (!receipts || receipts.length === 0) return 1;
        const maxId = receipts.reduce((max, r) => {
            const idNum = parseInt(String(r.id).replace(/\D/g, ''));
            return isNaN(idNum) ? max : Math.max(max, idNum);
        }, 0);
        return maxId + 1;
    }, [receipts]);

    const [receiptForm, setReceiptForm] = useState({ payer: '', recipient: '', value: '', reference: '' });
    const [selectedCardBrand, setSelectedCardBrand] = useState(CARD_BRANDS[0]);
    const [cardEntries, setCardEntries] = useState<string[]>(['']);
    const [errorForm, setErrorForm] = useState({ value: '', reason: '', type: 'shortage' as 'shortage' | 'surplus' });

    const handleSaveReceipt = async (e: React.FormEvent) => {
        e.preventDefault();
        const numericVal = parseFloat(receiptForm.value.replace(',', '.')) || 0;
        if (numericVal <= 0 || !receiptForm.recipient) return;
        setIsSubmitting(true);
        try {
            const receiptId = String(nextReceiptNumber);
            const rData = {
                id: receiptId,
                payer: receiptForm.payer.toUpperCase(),
                recipient: receiptForm.recipient.toUpperCase(),
                value: numericVal,
                valueInWords: numberToWords(numericVal).toUpperCase(),
                reference: receiptForm.reference.toUpperCase(),
                date: selectedDate
            };
            await onAddReceipt(rData);
            printReceiptDoc(rData);
            setReceiptForm({ payer: '', recipient: '', value: '', reference: '' });
            alert(`Recibo #${receiptId} emitido com sucesso!`);
        } catch (error) { alert("Erro ao emitir recibo."); }
        finally { setIsSubmitting(false); }
    };

    const handleSaveCards = async () => {
        const values = cardEntries.map(v => parseFloat(v.replace(',', '.'))).filter(v => !isNaN(v) && v > 0);
        if (values.length === 0) return;
        setIsSubmitting(true);
        try {
            for (const val of values) {
                await supabase.from('ice_cream_finances').insert([{
                    store_id: user.storeId, date: selectedDate, type: 'entry', category: 'RECEITA CARTÃO', value: val,
                    description: `Lançamento ${selectedCardBrand} - Titular: ${user.name}`
                }]);
            }
            alert(`${values.length} lançamentos de cartão realizados!`);
            setCardEntries(['']);
        } catch (e) { alert("Erro ao salvar cartões."); } 
        finally { setIsSubmitting(false); }
    };

    return (
        <div className="flex flex-col h-full bg-gray-50 font-sans overflow-hidden">
            <div className="bg-white px-6 py-4 border-b border-gray-200 flex flex-col md:flex-row justify-between items-center gap-4 shrink-0 shadow-sm">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-blue-900 text-white rounded-xl shadow-lg"><DollarSign size={24} /></div>
                    <div><h1 className="text-xl font-black text-blue-950 uppercase italic tracking-tighter">Gestão de Caixa</h1><p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Finanças e Auditoria Rede Real</p></div>
                </div>
                <div className="flex bg-gray-100 p-1 rounded-2xl overflow-x-auto no-scrollbar">
                    {[{ id: 'recibos', label: 'Recibos', icon: FileText }, { id: 'cartoes', label: 'Cartões', icon: CreditCard }, { id: 'quebras', label: 'Quebra de Caixa', icon: AlertTriangle }].map(tab => (
                        <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`flex items-center gap-2 px-8 py-3 rounded-xl text-[10px] font-black uppercase transition-all whitespace-nowrap ${activeTab === tab.id ? 'bg-white text-blue-900 shadow-md border border-blue-50' : 'text-gray-400 hover:text-gray-600'}`}>
                            <tab.icon size={14} /> {tab.label}
                        </button>
                    ))}
                </div>
                <div className="flex items-center gap-2 bg-gray-50 px-4 py-2 rounded-xl border border-gray-100 shadow-inner">
                    <Calendar size={16} className="text-blue-600" /><input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="bg-transparent border-none text-xs font-black text-gray-700 outline-none p-1" />
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 md:p-8 no-scrollbar bg-[#F8FAFC]">
                {activeTab === 'recibos' && (
                    <div className="max-w-xl mx-auto space-y-6 animate-in fade-in duration-300">
                        <div className="bg-white p-8 rounded-[40px] shadow-sm border border-gray-100 relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-8">
                                <div className="text-center bg-blue-50 px-4 py-2 rounded-2xl border border-blue-100 shadow-sm"><p className="text-[8px] font-black text-blue-400 uppercase tracking-widest mb-1">Próximo</p><p className="text-2xl font-black text-blue-900 leading-none">#{String(nextReceiptNumber).padStart(4, '0')}</p></div>
                            </div>
                            <h3 className="text-sm font-black text-gray-900 uppercase italic tracking-tighter mb-8 flex items-center gap-3"><PenTool className="text-blue-600" size={18} /> Novo Recibo</h3>
                            <form onSubmit={handleSaveReceipt} className="space-y-5">
                                <div className="space-y-1"><label className="text-[10px] font-black text-gray-400 uppercase ml-2 tracking-widest">Recebedor</label><input required value={receiptForm.recipient} onChange={e => setReceiptForm({...receiptForm, recipient: e.target.value})} className="w-full p-4 bg-gray-50 border-none rounded-2xl font-black text-blue-950 uppercase outline-none focus:ring-4 shadow-inner" placeholder="NOME DO FAVORECIDO" /></div>
                                <div className="space-y-1"><label className="text-[10px] font-black text-gray-400 uppercase ml-2 tracking-widest">Pagador (Loja)</label><input required value={receiptForm.payer} onChange={e => setReceiptForm({...receiptForm, payer: e.target.value})} className="w-full p-4 bg-gray-50 border-none rounded-2xl font-black text-blue-950 uppercase outline-none focus:ring-4 shadow-inner" placeholder="UNIDADE REAL CALÇADOS" /></div>
                                <div className="space-y-1"><label className="text-[10px] font-black text-gray-400 uppercase ml-2 tracking-widest">Valor (R$)</label><input required value={receiptForm.value} onChange={e => setReceiptForm({...receiptForm, value: e.target.value})} className="w-full p-4 bg-blue-50 border-none rounded-2xl font-black text-blue-900 text-xl outline-none shadow-inner text-center" placeholder="0,00" /></div>
                                <div className="space-y-1"><label className="text-[10px] font-black text-gray-400 uppercase ml-2 tracking-widest">Referência</label><input required value={receiptForm.reference} onChange={e => setReceiptForm({...receiptForm, reference: e.target.value})} className="w-full p-4 bg-gray-50 border-none rounded-2xl font-black text-blue-950 uppercase outline-none shadow-inner" placeholder="DESCRIÇÃO DO SERVIÇO" /></div>
                                <button type="submit" disabled={isSubmitting} className="w-full py-5 bg-blue-900 text-white rounded-[28px] font-black uppercase text-xs shadow-xl active:scale-95 transition-all border-b-4 border-blue-950 flex items-center justify-center gap-3">{isSubmitting ? <Loader2 className="animate-spin" /> : <Printer size={18}/>} EMITIR RECIBO (15x10cm)</button>
                            </form>
                        </div>
                        <div className="bg-orange-50 p-6 rounded-[32px] border border-orange-100"><p className="text-[10px] font-bold text-orange-800 uppercase italic text-center leading-relaxed">Para ver o histórico ou reimprimir recibos antigos, utilize o módulo de AUDITORIA (Admin/Gerente).</p></div>
                    </div>
                )}

                {activeTab === 'cartoes' && (
                    <div className="max-w-4xl mx-auto space-y-6 animate-in slide-in-from-right-4 duration-300">
                        <div className="bg-white p-10 rounded-[48px] shadow-sm border border-gray-100">
                            <div className="flex justify-between items-start mb-10 border-b pb-6">
                                <div><h3 className="text-2xl font-black text-gray-900 uppercase italic tracking-tighter flex items-center gap-3"><CardIcon className="text-green-600" size={28} /> Vendas <span className="text-green-600">Cartão</span></h3><p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-2">Lançamento em lote para fechamento de caixa</p></div>
                                <div className="bg-gray-950 px-6 py-3 rounded-2xl text-white shadow-xl flex items-center gap-4"><UserIcon size={18} className="text-blue-400" /><div><p className="text-[7px] font-black text-blue-400 uppercase tracking-widest mb-1">Titular</p><p className="text-xs font-black uppercase italic leading-none">{user.name}</p></div></div>
                            </div>
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                                <div className="space-y-6"><label className="text-[10px] font-black text-gray-400 uppercase ml-2 tracking-widest">1. Bandeira</label><div className="grid grid-cols-2 gap-3">{CARD_BRANDS.map(brand => (<button key={brand} onClick={() => setSelectedCardBrand(brand)} className={`p-4 rounded-2xl text-[10px] font-black uppercase transition-all border-2 flex items-center justify-between ${selectedCardBrand === brand ? 'bg-green-600 border-green-600 text-white shadow-lg scale-[1.02]' : 'bg-gray-50 border-gray-100 text-gray-400 hover:border-green-200'}`}>{brand}{selectedCardBrand === brand && <CheckCircle2 size={16} />}</button>))}</div></div>
                                <div className="space-y-6"><label className="text-[10px] font-black text-gray-400 uppercase ml-2 tracking-widest">2. Valores (R$)</label><div className="space-y-3 max-h-[350px] overflow-y-auto no-scrollbar pr-3">{cardEntries.map((val, idx) => (<div key={idx} className="flex gap-3 animate-in slide-in-from-top-2 duration-300"><div className="flex-1 relative"><span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300 font-black text-xs">R$</span><input value={val} onChange={e => setCardEntries(prev => { const n = [...prev]; n[idx] = e.target.value; return n; })} className="w-full pl-10 pr-4 py-4 bg-gray-50 border-none rounded-2xl font-black text-blue-950 text-right outline-none shadow-inner" placeholder="0,00" /></div>{idx === cardEntries.length - 1 ? (<button onClick={() => setCardEntries([...cardEntries, ''])} className="p-4 bg-blue-100 text-blue-600 rounded-2xl active:scale-95"><Plus size={20}/></button>) : (<button onClick={() => setCardEntries(cardEntries.filter((_, i) => i !== idx))} className="p-4 bg-red-50 text-red-400 rounded-2xl active:scale-95"><Trash size={20}/></button>)}</div>))}</div><div className="pt-8 border-t border-gray-100"><button onClick={handleSaveCards} disabled={isSubmitting} className="w-full py-5 bg-gray-900 text-white rounded-[28px] font-black uppercase text-xs shadow-2xl border-b-4 border-green-600 active:scale-95 flex items-center justify-center gap-3">{isSubmitting ? <Loader2 className="animate-spin" /> : <Save size={18}/>} EFETIVAR LANÇAMENTOS</button></div></div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'quebras' && (
                    <div className="max-w-xl mx-auto space-y-6 animate-in slide-in-from-bottom-4 duration-300">
                        <div className="bg-white p-8 rounded-[48px] shadow-sm border border-gray-100">
                            <h3 className="text-sm font-black text-gray-900 uppercase italic tracking-tighter mb-8 flex items-center gap-3"><AlertTriangle className="text-red-600" size={20} /> Registrar Divergência</h3>
                            <form onSubmit={async (e) => { e.preventDefault(); setIsSubmitting(true); try { await onAddError({ store_id: user.storeId, user_id: user.id, user_name: user.name, error_date: selectedDate, value: parseFloat(errorForm.value.replace(',', '.')), type: errorForm.type, reason: errorForm.reason.toUpperCase() }); setErrorForm({ value: '', reason: '', type: 'shortage' }); alert("Divergência registrada com sucesso!"); } catch { alert("Erro ao registrar."); } finally { setIsSubmitting(false); } }} className="space-y-6">
                                <div className="space-y-2"><label className="text-[10px] font-black text-gray-400 uppercase ml-2">Tipo</label><div className="flex bg-gray-100 p-1 rounded-2xl"><button type="button" onClick={() => setErrorForm({...errorForm, type: 'shortage'})} className={`flex-1 py-4 rounded-xl text-[10px] font-black uppercase transition-all ${errorForm.type === 'shortage' ? 'bg-red-600 text-white shadow-lg' : 'text-gray-400'}`}>Falta (-)</button><button type="button" onClick={() => setErrorForm({...errorForm, type: 'surplus'})} className={`flex-1 py-4 rounded-xl text-[10px] font-black uppercase transition-all ${errorForm.type === 'surplus' ? 'bg-green-600 text-white shadow-lg' : 'text-gray-400'}`}>Sobra (+)</button></div></div>
                                <div className="space-y-2"><label className="text-[10px] font-black text-gray-400 uppercase ml-2">Valor</label><input required value={errorForm.value} onChange={e => setErrorForm({...errorForm, value: e.target.value})} className="w-full p-5 bg-gray-50 border-none rounded-[24px] font-black text-2xl text-center text-blue-950 shadow-inner" placeholder="0,00" /></div>
                                <div className="space-y-2"><label className="text-[10px] font-black text-gray-400 uppercase ml-2">Motivo</label><textarea required value={errorForm.reason} onChange={e => setErrorForm({...errorForm, reason: e.target.value})} className="w-full p-5 bg-gray-50 border-none rounded-[24px] font-bold text-xs text-gray-700 h-32 shadow-inner no-scrollbar" placeholder="JUSTIFICATIVA DO OPERADOR..." /></div>
                                <button type="submit" disabled={isSubmitting} className="w-full py-5 bg-gray-950 text-white rounded-[28px] font-black uppercase text-xs shadow-xl active:scale-95 border-b-4 border-slate-700 flex items-center justify-center gap-3">{isSubmitting ? <Loader2 className="animate-spin" /> : <Save size={18}/>} REGISTRAR OCORRÊNCIA</button>
                            </form>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default CashRegisterModule;