import React, { useState, useMemo, useEffect } from 'react';
import { User, IceCreamDailySale, Receipt, CashError, UserRole, Store } from '../types';
import { formatCurrency, BRAND_LOGO } from '../constants';
import { 
    DollarSign, Save, Calendar, FileText, CreditCard, AlertTriangle, 
    Plus, Trash2, Printer, Loader2, CreditCard as CardIcon, Trash, CheckCircle2, User as UserIcon, PenTool, Edit3, X, Check, Settings, Settings2, XCircle
} from 'lucide-react';
import { supabase } from '../services/supabaseClient';

interface CardEntry {
    id: string;
    brand: string;
    value: number;
    ticket: string;
}

interface CardBrand {
    id: string;
    name: string;
}

interface CashRegisterModuleProps {
    user: User;
    stores: Store[];
    sales: IceCreamDailySale[];
    pixSales: any[];
    closures: any[];
    receipts: Receipt[];
    errors: CashError[];
    finances?: any[];
    onAddClosure: (closure: any) => Promise<void>;
    onAddReceipt: (receipt: any) => Promise<void>;
    onAddError: (error: any) => Promise<void>;
    onDeleteError: (id: string) => Promise<void>;
    onAddLog?: (action: string, details: string) => Promise<void>;
}

// Mapeador de Ícones de Bandeiras - Atualizado com Elo Oficial
export const getCardFlagIcon = (brandName: string) => {
    const name = (brandName || '').toLowerCase();
    // Bandeira Elo (Oficial Colorida)
    if (name.includes('elo')) return 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e3/Elo_logo.svg/1024px-Elo_logo.svg.png';
    if (name.includes('visa')) return 'https://img.icons8.com/color/48/visa.png';
    if (name.includes('master')) return 'https://img.icons8.com/color/48/mastercard.png';
    if (name.includes('amex') || name.includes('american')) return 'https://img.icons8.com/color/48/amex.png';
    if (name.includes('diners')) return 'https://img.icons8.com/color/48/diners-club.png';
    if (name.includes('hiper')) return 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b8/Hipercard_logo.svg/1280px-Hipercard_logo.svg.png';
    if (name.includes('alelo')) return 'https://img.icons8.com/color/48/alelo.png';
    if (name.includes('sodexo')) return 'https://img.icons8.com/color/48/sodexo.png';
    if (name.includes('cielo')) return 'https://img.icons8.com/color/48/cielo.png';
    return 'https://img.icons8.com/color/48/credit-card.png';
};

const numberToWords = (value: number): string => {
    if (value === 0) return "ZERO REAIS";
    const unidades = ["", "UM", "DOIS", "TRÊS", "QUATRO", "CINCO", "SEIS", "SETE", "OITO", "NOVE"];
    const dez_vinte = ["DEZ", "ONZE", "DOZE", "TREZE", "QUATORZE", "QUINZE", "DEZESSEIS", "DEZESSETE", "DEZOITO", "DEZENOVE"];
    const dezenas = ["", "DEZ", "VINTE", "TRINTA", "QUARENTA", "CINQUENTA", "SESSENTA", "SETENTA", "OITENTA", "NOVENTA"];
    const centenas = ["", "CENTO", "DUZENTOS", "TREZENTOS", "QUATROCENTOS", "QUINHENTOS", "SEISCENTOS", "SETECENTOS", "OITOCENTOS", "NOVECENTOS"];
    const convertGroup = (n: number): string => {
        if (n < 10) return unidades[n];
        if (n < 20) return dez_vinte[n - 10];
        if (n < 100) { const u = n % 10; const d = Math.floor(n / 10); return dezenas[d] + (u > 0 ? " E " + unidades[u] : ""); }
        if (n === 100) return "CEM";
        if (n < 1000) { const c = Math.floor(n / 100); const rest = n % 100; return centenas[c] + (rest > 0 ? " E " + convertGroup(rest) : ""); }
        return "";
    };
    const integerPart = Math.floor(value);
    const decimalPart = Math.round((value - integerPart) * 100);
    let text = "";
    if (integerPart > 0) {
        if (integerPart === 1) text += "UM REAL";
        else if (integerPart < 1000) text += convertGroup(integerPart) + " REAIS";
        else if (integerPart < 1000000) {
            const mil = Math.floor(integerPart / 1000); const rest = integerPart % 1000;
            text += (mil === 1 ? "UM MIL" : convertGroup(mil) + " MIL");
            if (rest > 0) text += (rest < 100 || rest % 100 === 0 ? " E " : ", ") + convertGroup(rest);
            text += " REAIS";
        }
    }
    if (decimalPart > 0) { if (integerPart > 0) text += " E "; text += convertGroup(decimalPart) + (decimalPart === 1 ? " CENTAVO" : " CENTAVOS"); }
    return text.trim();
};

export const printReceiptDoc = (r: any) => {
    const printWindow = window.open('', '_blank', 'width=900,height=1200');
    if (!printWindow) return;
    const html = `
        <html>
        <head>
            <script src="https://cdn.tailwindcss.com"></script>
            <style>
                @page { size: A4 portrait; margin: 0; }
                body { margin: 0; padding: 0; background: #eee; font-family: 'Times New Roman', Times, serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                .receipt-page { width: 210mm; height: 148.5mm; padding: 10mm; box-sizing: border-box; display: flex; justify-content: center; align-items: flex-start; background: white; }
                .receipt-container { 
                    width: 190mm; 
                    height: 130mm; 
                    border: 4px double #000; 
                    padding: 8mm; 
                    display: flex; 
                    flex-direction: column; 
                    position: relative; 
                    background: #fff;
                }
                .logo-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #000; padding-bottom: 3mm; margin-bottom: 4mm; }
                .value-box { border: 2px solid #000; padding: 1mm 6mm; background: #f1f5f9; font-size: 24pt; font-weight: 900; font-style: italic; }
                .clause { font-size: 9pt; text-align: center; line-height: 1.2; font-style: italic; color: #000; margin-top: 4mm; font-weight: 600; padding: 0 4mm; }
                .line-fill { border-bottom: 1px dotted #000; flex: 1; margin-left: 2mm; font-weight: bold; text-transform: uppercase; font-size: 14pt; padding-bottom: 1px; }
                .footer-sign { margin-top: auto; display: flex; justify-content: space-between; align-items: flex-end; padding-top: 4mm; }
            </style>
        </head>
        <body>
            <div class="receipt-page">
                <div class="receipt-container">
                    <div class="logo-header">
                        <div class="flex items-center gap-3">
                            <img src="${BRAND_LOGO}" class="h-14 w-auto" />
                            <div>
                                <h1 class="text-2xl font-black uppercase italic leading-none tracking-tighter">Real <span class="text-red-600">Calçados</span></h1>
                                <p class="text-[8px] font-bold uppercase tracking-[0.3em] mt-1 text-gray-400">Recibo Profissional de Quitação</p>
                            </div>
                        </div>
                        <div class="text-right">
                            <div class="text-xl font-black text-gray-300 mb-1">Nº <span class="text-red-600">${String(r.id).padStart(4, '0')}</span></div>
                            <div class="value-box">${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(r.value)}</div>
                        </div>
                    </div>
                    <div class="space-y-4 flex-1 text-lg">
                        <div class="flex items-baseline">
                            <span class="whitespace-nowrap font-medium">Recebi(emos) de:</span>
                            <div class="line-fill">${r.payer}</div>
                        </div>
                        <div class="flex flex-col">
                            <span class="whitespace-nowrap font-medium">A quantia de:</span>
                            <div class="w-full bg-gray-50 border-b border-gray-200 px-4 py-1.5 mt-1 text-base font-bold italic uppercase leading-tight min-h-[1.2em]">
                                ${r.valueInWords}
                            </div>
                        </div>
                        <div class="flex items-baseline">
                            <span class="whitespace-nowrap font-medium">Referente a:</span>
                            <div class="line-fill" style="font-size: 12pt;">${r.reference}</div>
                        </div>
                    </div>
                    <div class="clause">
                        "E para maior clareza firmo o presente recibo para que produza os seus efeitos, dando plena, rasa e irrevogável quitação, pelo valor recebido e descrito neste termo."
                    </div>
                    <div class="footer-sign">
                        <div class="text-base font-bold pb-2">
                            ${new Date(r.date + 'T12:00:00').toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })}
                        </div>
                        <div class="w-[90mm] text-center">
                            <div class="border-t-2 border-black pt-2 mt-8">
                                <p class="font-bold uppercase text-base leading-none mb-1">${r.recipient}</p>
                                <p class="text-[9px] uppercase font-bold text-gray-500 tracking-[0.2em]">Assinatura do Recebedor</p>
                            </div>
                        </div>
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

export const printCardSummaryDoc = (date: string, storeName: string, cards: any[], operator: string) => {
    const printWindow = window.open('', '_blank', 'width=400,height=600');
    if (!printWindow) return;
    
    const totalValue = cards.reduce((a, b) => a + b.value, 0);
    
    // Agrupar por bandeira para o resumo
    const totalsByBrand: Record<string, number> = {};
    cards.forEach(c => { totalsByBrand[c.brand] = (totalsByBrand[c.brand] || 0) + c.value; });

    const html = `
        <html>
        <head>
            <script src="https://cdn.tailwindcss.com"></script>
            <style>
                @page { size: 80mm auto; margin: 0; }
                body { 
                    margin: 0; 
                    padding: 4mm; 
                    font-family: 'Courier New', Courier, monospace; 
                    -webkit-print-color-adjust: exact; 
                    print-color-adjust: exact;
                    width: 80mm;
                    box-sizing: border-box;
                    background: white;
                    font-size: 10px;
                }
                .dashed-line { border-top: 1px dashed #000; margin: 4px 0; }
                .grid-container {
                    display: grid;
                    grid-template-columns: repeat(2, 1fr);
                    gap: 4px;
                }
                @media print {
                    body { width: 80mm; }
                }
            </style>
        </head>
        <body>
            <div class="text-center mb-2">
                <h1 class="text-[12px] font-black uppercase">Resumo de Cartões</h1>
                <p class="text-[9px] font-bold">Conferência de Lançamentos</p>
            </div>
            <div class="dashed-line"></div>
            <div class="text-[9px] space-y-0.5">
                <p><strong>DATA:</strong> ${new Date(date + 'T12:00:00').toLocaleDateString('pt-BR')}</p>
                <p><strong>LOJA:</strong> ${storeName}</p>
                <p><strong>OPERADOR:</strong> ${operator}</p>
            </div>
            <div class="dashed-line"></div>
            
            <div class="mt-2">
                <p class="text-[9px] font-black uppercase mb-1">Detalhamento (Ficha | Valor):</p>
                <div class="grid-container">
                    ${cards.map((c, idx) => `
                        <div class="flex justify-between border-b border-gray-100 pb-0.5">
                            <span class="font-bold">#${c.ticket || (idx + 1)}</span>
                            <span>${new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2 }).format(c.value)}</span>
                        </div>
                    `).join('')}
                </div>
            </div>

            <div class="dashed-line"></div>
            <div class="mt-2">
                <p class="text-[9px] font-black uppercase mb-1">Totais por Bandeira:</p>
                <div class="space-y-0.5">
                    ${Object.entries(totalsByBrand).map(([brand, val]) => `
                        <div class="flex justify-between">
                            <span>${brand}</span>
                            <span class="font-bold">${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val)}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
            
            <div class="dashed-line"></div>
            <div class="flex justify-between items-center mt-1">
                <span class="text-[11px] font-black">TOTAL GERAL:</span>
                <span class="text-[13px] font-black">${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalValue)}</span>
            </div>
            <div class="dashed-line"></div>
            <div class="mt-4 text-center">
                <div class="border-t border-black pt-1 text-[8px] font-bold uppercase">Assinatura do Operador</div>
            </div>
            <script>window.onload = () => { setTimeout(() => { window.print(); window.close(); }, 500); }</script>
        </body>
        </html>
    `;
    printWindow.document.write(html);
    printWindow.document.close();
};

export const printPixSummaryDoc = (date: string, storeName: string, pixEntries: any[], operator: string) => {
    const printWindow = window.open('', '_blank', 'width=400,height=600');
    if (!printWindow) return;
    
    const totalValue = pixEntries.reduce((a, b) => a + b.value, 0);

    const html = `
        <html>
        <head>
            <script src="https://cdn.tailwindcss.com"></script>
            <style>
                @page { size: 80mm auto; margin: 0; }
                body { 
                    margin: 0; 
                    padding: 4mm; 
                    font-family: 'Courier New', Courier, monospace; 
                    -webkit-print-color-adjust: exact; 
                    print-color-adjust: exact;
                    width: 80mm;
                    box-sizing: border-box;
                    background: white;
                    font-size: 10px;
                }
                .dashed-line { border-top: 1px dashed #000; margin: 4px 0; }
                .grid-container {
                    display: grid;
                    grid-template-columns: repeat(2, 1fr);
                    gap: 4px;
                }
                @media print {
                    body { width: 80mm; }
                }
            </style>
        </head>
        <body>
            <div class="text-center mb-2">
                <h1 class="text-[12px] font-black uppercase">Resumo de Pix</h1>
                <p class="text-[9px] font-bold">Conferência de Lançamentos</p>
            </div>
            <div class="dashed-line"></div>
            <div class="text-[9px] space-y-0.5">
                <p><strong>DATA:</strong> ${new Date(date + 'T12:00:00').toLocaleDateString('pt-BR')}</p>
                <p><strong>LOJA:</strong> ${storeName}</p>
                <p><strong>OPERADOR:</strong> ${operator}</p>
            </div>
            <div class="dashed-line"></div>
            
            <div class="mt-2">
                <p class="text-[9px] font-black uppercase mb-1">Detalhamento (Ficha | Valor):</p>
                <div class="grid-container">
                    ${pixEntries.map((p) => `
                        <div class="flex justify-between border-b border-gray-100 pb-0.5">
                            <span class="font-bold">#${p.ticket}</span>
                            <span>${new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2 }).format(p.value)}</span>
                        </div>
                    `).join('')}
                </div>
            </div>

            <div class="dashed-line"></div>
            <div class="flex justify-between items-center mt-1">
                <span class="text-[11px] font-black">TOTAL GERAL:</span>
                <span class="text-[13px] font-black">${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalValue)}</span>
            </div>
            <div class="dashed-line"></div>
            <div class="mt-4 text-center">
                <div class="border-t border-black pt-1 text-[8px] font-bold uppercase">Assinatura do Operador</div>
            </div>
            <script>window.onload = () => { setTimeout(() => { window.print(); window.close(); }, 500); }</script>
        </body>
        </html>
    `;
    printWindow.document.write(html);
    printWindow.document.close();
};

export const printErrorsDoc = (title: string, dateInfo: string, storeName: string, errors: CashError[], operator: string) => {
    const printWindow = window.open('', '_blank', 'width=600,height=800');
    if (!printWindow) return;

    // Apenas valores negativos contam como erro real
    const realErrors = errors.filter(e => e.value < 0 || e.type === 'shortage');
    const samplingSurplus = errors.filter(e => e.value > 0 || e.type === 'surplus');
    
    const totalRealError = realErrors.reduce((acc, e) => acc + Math.abs(e.value), 0);
    const totalSurplus = samplingSurplus.reduce((acc, e) => acc + e.value, 0);

    const html = `
        <html>
        <head>
            <script src="https://cdn.tailwindcss.com"></script>
            <style>
                @page { size: A4; margin: 10mm; }
                body { font-family: 'Courier New', Courier, monospace; background: white; padding: 10px; }
                .dashed-line { border-top: 1px dashed #000; margin: 10px 0; }
            </style>
        </head>
        <body>
            <div class="text-center mb-4">
                <h1 class="text-xl font-black uppercase">${title}</h1>
                <p class="text-sm font-bold">Relatório de Divergências de Caixa</p>
            </div>
            
            <div class="dashed-line"></div>
            <div class="text-xs space-y-1 mb-4">
                <p><strong>LOJA:</strong> ${storeName}</p>
                <p><strong>PERÍODO:</strong> ${dateInfo}</p>
                <p><strong>EMISSÃO:</strong> ${new Date().toLocaleString('pt-BR')}</p>
                <p><strong>OPERADOR:</strong> ${operator}</p>
            </div>
            <div class="dashed-line"></div>

            <div class="mb-6">
                <h2 class="text-sm font-black bg-gray-100 p-1 mb-2">ERROS REAIS (FALTAS)</h2>
                <table class="w-full text-[10px]">
                    <thead>
                        <tr class="border-b border-black">
                            <th class="text-left py-1">DATA</th>
                            <th class="text-left py-1">MOTIVO</th>
                            <th class="text-right py-1">VALOR</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${realErrors.length > 0 ? realErrors.map(e => `
                            <tr>
                                <td class="py-1">${new Date(e.date + 'T12:00:00').toLocaleDateString('pt-BR')}</td>
                                <td class="py-1 uppercase">${e.reason}</td>
                                <td class="py-1 text-right font-bold">-${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Math.abs(e.value))}</td>
                            </tr>
                        `).join('') : '<tr><td colspan="3" class="text-center py-2">NENHUMA FALTA REGISTRADA</td></tr>'}
                    </tbody>
                </table>
                <div class="dashed-line"></div>
                <div class="flex justify-between text-sm font-black">
                    <span>TOTAL ERRO REAL:</span>
                    <span>${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalRealError)}</span>
                </div>
            </div>

            <div class="mb-6">
                <h2 class="text-sm font-black bg-gray-100 p-1 mb-2">AMOSTRAGEM (SOBRAS)</h2>
                <table class="w-full text-[10px]">
                    <thead>
                        <tr class="border-b border-black">
                            <th class="text-left py-1">DATA</th>
                            <th class="text-left py-1">MOTIVO</th>
                            <th class="text-right py-1">VALOR</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${samplingSurplus.length > 0 ? samplingSurplus.map(e => `
                            <tr>
                                <td class="py-1">${new Date(e.date + 'T12:00:00').toLocaleDateString('pt-BR')}</td>
                                <td class="py-1 uppercase">${e.reason}</td>
                                <td class="py-1 text-right font-bold">+${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(e.value)}</td>
                            </tr>
                        `).join('') : '<tr><td colspan="3" class="text-center py-2">NENHUMA SOBRA REGISTRADA</td></tr>'}
                    </tbody>
                </table>
                <div class="dashed-line"></div>
                <div class="flex justify-between text-xs font-bold text-gray-600">
                    <span>TOTAL SOBRAS (AMOSTRAGEM):</span>
                    <span>${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalSurplus)}</span>
                </div>
            </div>

            <div class="mt-12 text-center">
                <div class="border-t border-black pt-2 text-[10px] font-bold uppercase">Assinatura do Responsável</div>
            </div>

            <script>window.onload = () => { setTimeout(() => { window.print(); window.close(); }, 800); }</script>
        </body>
        </html>
    `;
    printWindow.document.write(html);
    printWindow.document.close();
};

const CashRegisterModule: React.FC<CashRegisterModuleProps> = ({ 
    user, stores, receipts, errors, finances, onAddReceipt, onAddError, onDeleteError, onAddClosure, onAddLog 
}) => {
    const [activeTab, setActiveTab] = useState<'recibos' | 'cartoes' | 'pix' | 'quebras' | 'fechamento'>('recibos');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [selectedStoreId, setSelectedStoreId] = useState(user.storeId || '');
    const [dailyTotals, setDailyTotals] = useState<Record<string, number>>({});
    const [manualCards, setManualCards] = useState<any[]>([]);
    const [manualPix, setManualPix] = useState<any[]>([]);
    const [canceledSales, setCanceledSales] = useState<any[]>([]);
    const [isLoadingTotals, setIsLoadingTotals] = useState(false);
    
    const [availableBrands, setAvailableBrands] = useState<CardBrand[]>([]);
    const [stagedCards, setStagedCards] = useState<CardEntry[]>([]);
    const [cardValueInput, setCardValueInput] = useState('');
    const [cardTicketInput, setCardTicketInput] = useState('');
    const [cardBrandInput, setCardBrandInput] = useState('');
    const [showBrandManager, setShowBrandManager] = useState(false);
    const [newBrandName, setNewBrandName] = useState('');

    const [stagedPix, setStagedPix] = useState<any[]>([]);
    const [pixValueInput, setPixValueInput] = useState('');
    const [pixTicketInput, setPixTicketInput] = useState('');
    const [pixClientInput, setPixClientInput] = useState('');
    const [clientSuggestions, setClientSuggestions] = useState<string[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);

    const [receiptForm, setReceiptForm] = useState({ recipient: '', value: '', reference: '' });
    const [confirmModal, setConfirmModal] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        onConfirm: () => void;
    }>({
        isOpen: false,
        title: '',
        message: '',
        onConfirm: () => {}
    });
    const [toast, setToast] = useState<{
        show: boolean;
        message: string;
        type: 'success' | 'error';
    }>({
        show: false,
        message: '',
        type: 'success'
    });

    const showToast = (message: string, type: 'success' | 'error' = 'success') => {
        setToast({ show: true, message, type });
        setTimeout(() => setToast(prev => ({ ...prev, show: false })), 3000);
    };

    const selectedStore = useMemo(() => stores.find(s => s.id === selectedStoreId), [stores, selectedStoreId]);
    const payerName = useMemo(() => {
        if (!selectedStore) return "REAL CALÇADOS";
        return `REAL CALÇADOS LOJA ${selectedStore.number} ${selectedStore.city.split(' - ')[0]}`.toUpperCase();
    }, [selectedStore]);

    const fetchBrands = async () => {
        try {
            const { data, error } = await supabase.from('financial_card_brands').select('*').order('name', { ascending: true });
            if (error) throw error;
            if (data && data.length > 0) {
                setAvailableBrands(data);
                if (!cardBrandInput) setCardBrandInput(data[0].name);
            } else {
                // Default fixado conforme solicitado pelo usuário
                const defaults = ['VISA DÉBITO', 'VISA CRÉDITO', 'MASTER DÉBITO', 'MASTER CRÉDITO', 'ELO DÉBITO', 'ELO CRÉDITO', 'AMEX', 'HIPERCARD'];
                setAvailableBrands(defaults.map((n, i) => ({ id: i.toString(), name: n })));
                if (!cardBrandInput) setCardBrandInput(defaults[0]);
            }
        } catch (e) {
            const defaults = ['VISA DÉBITO', 'VISA CRÉDITO', 'MASTER DÉBITO', 'MASTER CRÉDITO', 'ELO DÉBITO', 'ELO CRÉDITO', 'AMEX', 'HIPERCARD'];
            setAvailableBrands(defaults.map((n, i) => ({ id: i.toString(), name: n })));
            if (!cardBrandInput) setCardBrandInput(defaults[0]);
        }
    };

    const fetchDailyTotals = async () => {
        if (!selectedStoreId) return;
        setIsLoadingTotals(true);
        try {
            // Busca pagamentos de sorvete
            const { data: iceCreamPayments, error: iceCreamError } = await supabase
                .from('ice_cream_daily_sales_payments')
                .select('amount, payment_method, ice_cream_sales!inner(store_id, status, created_at)')
                .eq('ice_cream_sales.store_id', selectedStoreId)
                .eq('ice_cream_sales.status', 'completed');

            if (iceCreamError) throw iceCreamError;

            // Busca lançamentos manuais de cartões
            const { data: manualCards, error: cardError } = await supabase
                .from('financial_card_sales')
                .select('value, date')
                .eq('store_id', selectedStoreId)
                .eq('date', selectedDate);

            if (cardError) throw cardError;

            // Busca lançamentos manuais de PIX
            const { data: manualPixData, error: pixError } = await supabase
                .from('financial_pix_sales')
                .select('*')
                .eq('store_id', selectedStoreId)
                .eq('date', selectedDate);

            if (pixError) throw pixError;

            // Busca vendas canceladas
            const { data: canceledData, error: canceledError } = await supabase
                .from('ice_cream_sales')
                .select('*')
                .eq('store_id', selectedStoreId)
                .eq('status', 'canceled');

            if (canceledError) throw canceledError;

            setManualCards(manualCards || []);
            setManualPix(manualPixData || []);
            
            const filteredCanceled = canceledData?.filter(s => {
                const saleDate = String(s.created_at || '').split('T')[0];
                return saleDate === selectedDate;
            }) || [];
            setCanceledSales(filteredCanceled);

            // Filtrar pagamentos de sorvete por data
            const filteredIceCream = iceCreamPayments?.filter(p => {
                const saleDate = String((p as any).ice_cream_sales.created_at || '').split('T')[0];
                return saleDate === selectedDate;
            });

            const totals: Record<string, number> = {
                'Pix': 0,
                'Dinheiro': 0,
                'Cartão': 0,
                'Fiado': 0,
                'Voucher': 0
            };

            // Soma sorvete
            filteredIceCream?.forEach(p => {
                const method = p.payment_method;
                if (totals[method] !== undefined) {
                    totals[method] += Number(p.amount);
                }
            });

            // Soma cartões manuais
            manualCards?.forEach(c => {
                totals['Cartão'] += Number(c.value);
            });

            // Soma PIX manuais
            manualPix?.forEach(p => {
                totals['Pix'] += Number(p.value);
            });

            setDailyTotals(totals);
        } catch (e) {
            console.error("Erro ao buscar totais diários:", e);
        } finally {
            setIsLoadingTotals(false);
        }
    };

    useEffect(() => {
        fetchBrands();
    }, []);

    useEffect(() => {
        if (activeTab === 'fechamento') {
            fetchDailyTotals();
        }
    }, [activeTab, selectedDate, selectedStoreId]);

    const handleAddBrand = async () => {
        if (!newBrandName.trim()) return;
        const name = newBrandName.toUpperCase().trim();
        setIsSubmitting(true);
        try {
            const { error } = await supabase.from('financial_card_brands').insert([{ name }]);
            if (error) throw error;
            setNewBrandName('');
            await fetchBrands();
        } catch (e: any) { showToast("Erro: " + e.message, "error"); } 
        finally { setIsSubmitting(false); }
    };

    const handleDeleteBrand = async (id: string) => {
        setConfirmModal({
            isOpen: true,
            title: 'Remover Bandeira',
            message: 'Deseja remover esta bandeira?',
            onConfirm: async () => {
                try {
                    await supabase.from('financial_card_brands').delete().eq('id', id);
                    await fetchBrands();
                    showToast("Bandeira removida!");
                } catch (e) { showToast("Erro ao remover bandeira.", "error"); }
                setConfirmModal(prev => ({ ...prev, isOpen: false }));
            }
        });
    };

    const nextReceiptNumber = useMemo(() => {
        const storeReceipts = receipts.filter(r => r.storeId === selectedStoreId);
        if (!storeReceipts || storeReceipts.length === 0) return 1;
        const maxId = storeReceipts.reduce((max, r) => {
            const idNum = parseInt(String(r.id).replace(/\D/g, ''));
            return isNaN(idNum) ? max : Math.max(max, idNum);
        }, 0);
        return maxId + 1;
    }, [receipts, selectedStoreId]);

    const totalsByBrand = useMemo(() => {
        const res: Record<string, number> = {};
        stagedCards.forEach(c => { res[c.brand] = (res[c.brand] || 0) + c.value; });
        return res;
    }, [stagedCards]);

    const totalStagedValue = stagedCards.reduce((a, b) => a + b.value, 0);

    const handleAddStagedCard = (e: React.FormEvent) => {
        e.preventDefault();
        const val = parseFloat(cardValueInput.replace(',', '.'));
        if (isNaN(val) || val <= 0) return;
        setStagedCards(prev => [{ id: `stg-${Date.now()}-${Math.random()}`, brand: cardBrandInput, value: val, ticket: cardTicketInput }, ...prev]);
        setCardValueInput('');
        setCardTicketInput('');
    };

    const handleValidateAndSaveCards = async () => {
        if (stagedCards.length === 0) return;
        setIsSubmitting(true);
        try {
            const saleCode = `CARD-${Date.now().toString().slice(-6)}`;
            const entries = stagedCards.map(c => ({ 
                store_id: selectedStoreId, 
                user_id: user.id, 
                user_name: user.name, 
                date: selectedDate, 
                brand: c.brand, 
                value: c.value, 
                sale_code: c.ticket || saleCode 
            }));
            const { error } = await supabase.from('financial_card_sales').insert(entries);
            if (error) throw error;
            if (onAddLog) await onAddLog('VALIDAÇÃO CARTÕES', `Lançamento de ${entries.length} cartões na loja ${selectedStoreId} totalizando ${formatCurrency(totalStagedValue)}`);
            
            setConfirmModal({
                isOpen: true,
                title: 'Vendas Validadas',
                message: 'Vendas validadas! Deseja imprimir o resumo de conferência?',
                onConfirm: () => {
                    printCardSummaryDoc(selectedDate, payerName, stagedCards, user.name);
                    setConfirmModal(prev => ({ ...prev, isOpen: false }));
                }
            });

            setStagedCards([]);
            fetchDailyTotals();
            showToast("Sucesso!");
        } catch (e: any) { showToast("Erro: " + e.message, "error"); } 
        finally { setIsSubmitting(false); }
    };

    // Autocomplete de Clientes PIX
    useEffect(() => {
        const timer = setTimeout(async () => {
            if (pixClientInput.length < 2) {
                setClientSuggestions([]);
                return;
            }
            try {
                const { data, error } = await supabase
                    .from('financial_pix_sales')
                    .select('payer_name')
                    .ilike('payer_name', `%${pixClientInput}%`)
                    .limit(10);
                
                if (error) throw error;
                if (data) {
                    const unique = [...new Set(data.map(item => item.payer_name).filter(Boolean))];
                    setClientSuggestions(unique as string[]);
                }
            } catch (e) {
                console.error("Erro ao buscar clientes:", e);
            }
        }, 300);

        return () => clearTimeout(timer);
    }, [pixClientInput]);

    // Fechar sugestões ao clicar fora
    useEffect(() => {
        const handleClickOutside = () => setShowSuggestions(false);
        window.addEventListener('click', handleClickOutside);
        return () => window.removeEventListener('click', handleClickOutside);
    }, []);

    const today = new Date().toISOString().split('T')[0];

    const handleAddStagedPix = (e: React.FormEvent) => {
        e.preventDefault();
        if (selectedDate !== today) {
            showToast("Lançamentos Pix só podem ser feitos na data de hoje.", "error");
            return;
        }
        const clientName = pixClientInput.trim().toUpperCase();
        if (!clientName) {
            showToast("O nome do cliente é obrigatório.", "error");
            return;
        }
        const val = parseFloat(pixValueInput.replace(',', '.'));
        if (isNaN(val) || val <= 0) return;
        setStagedPix(prev => [{ 
            id: `stg-pix-${Date.now()}-${Math.random()}`, 
            ticket: pixTicketInput, 
            value: val, 
            client: clientName 
        }, ...prev]);
        setPixValueInput('');
        setPixTicketInput('');
        setPixClientInput('');
        setClientSuggestions([]);
        setShowSuggestions(false);
    };

    const handleValidateAndSavePix = async () => {
        if (stagedPix.length === 0) return;
        if (selectedDate !== today) {
            showToast("Lançamentos Pix só podem ser feitos na data de hoje.", "error");
            return;
        }
        setIsSubmitting(true);
        try {
            const entries = stagedPix.map(p => ({ 
                store_id: selectedStoreId, 
                user_id: user.id, 
                user_name: user.name, 
                // date: selectedDate, // Removido para ser definido exclusivamente pelo backend
                sale_code: p.ticket, // Número da Ficha
                value: p.value, 
                payer_name: p.client
            }));
            const { error } = await supabase.from('financial_pix_sales').insert(entries);
            if (error) throw error;
            const totalPix = stagedPix.reduce((a, b) => a + b.value, 0);
            if (onAddLog) await onAddLog('VALIDAÇÃO PIX', `Lançamento de ${entries.length} Pix na loja ${selectedStoreId} totalizando ${formatCurrency(totalPix)}`);
            
            setConfirmModal({
                isOpen: true,
                title: 'Vendas Validadas',
                message: 'Vendas validadas! Deseja imprimir o resumo de conferência?',
                onConfirm: () => {
                    printPixSummaryDoc(selectedDate, payerName, stagedPix, user.name);
                    setConfirmModal(prev => ({ ...prev, isOpen: false }));
                }
            });

            setStagedPix([]);
            fetchDailyTotals();
            showToast("Vendas Pix validadas!");
        } catch (e: any) { showToast("Erro: " + e.message, "error"); } 
        finally { setIsSubmitting(false); }
    };
    const [editingCard, setEditingCard] = useState<any | null>(null);
    const [editingPix, setEditingPix] = useState<any | null>(null);

    const handleUpdateCard = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingCard) return;
        setIsSubmitting(true);
        try {
            const val = parseFloat(String(editingCard.value).replace(',', '.'));
            const { error } = await supabase
                .from('financial_card_sales')
                .update({ 
                    brand: editingCard.brand, 
                    value: val, 
                    sale_code: editingCard.sale_code 
                })
                .eq('id', editingCard.id);
            if (error) throw error;
            showToast("Lançamento atualizado!");
            setEditingCard(null);
            fetchDailyTotals();
        } catch (e: any) { showToast("Erro: " + e.message, "error"); }
        finally { setIsSubmitting(false); }
    };

    const handleUpdatePix = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingPix) return;
        setIsSubmitting(true);
        try {
            const val = parseFloat(String(editingPix.value).replace(',', '.'));
            const { error } = await supabase
                .from('financial_pix_sales')
                .update({ 
                    payer_name: editingPix.payer_name, 
                    value: val, 
                    sale_code: editingPix.sale_code 
                })
                .eq('id', editingPix.id);
            if (error) throw error;
            showToast("Lançamento atualizado!");
            setEditingPix(null);
            fetchDailyTotals();
        } catch (e: any) { showToast("Erro: " + e.message, "error"); }
        finally { setIsSubmitting(false); }
    };

    const [errorForm, setErrorForm] = useState({ value: '', reason: '', type: 'shortage' as 'shortage' | 'surplus' });

    const handleSaveReceipt = async (e: React.FormEvent) => {
        e.preventDefault();
        const numericVal = parseFloat(receiptForm.value.replace(',', '.')) || 0;
        if (numericVal <= 0 || !receiptForm.recipient || !selectedStoreId) return;
        setIsSubmitting(true);
        try {
            const receiptId = String(nextReceiptNumber);
            const rData = { 
                id: receiptId, 
                storeId: selectedStoreId,
                payer: payerName, 
                recipient: receiptForm.recipient.toUpperCase(), 
                value: numericVal, 
                valueInWords: numberToWords(numericVal).toUpperCase(), 
                reference: receiptForm.reference.toUpperCase(), 
                date: selectedDate 
            };
            await onAddReceipt(rData);
            printReceiptDoc(rData);
            setReceiptForm({ recipient: '', value: '', reference: '' });
            showToast("Recibo emitido!");
        } catch (error) { showToast("Erro.", "error"); }
        finally { setIsSubmitting(false); }
    };

    return (
        <div className="flex flex-col h-full bg-gray-50 font-sans overflow-hidden">
            <div className="bg-white px-6 py-4 border-b border-gray-200 flex flex-col md:flex-row justify-between items-center gap-4 shrink-0 shadow-sm">
                <div className="flex flex-col md:flex-row items-center gap-6">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-blue-900 text-white rounded-xl shadow-lg"><DollarSign size={24} /></div>
                        <div><h1 className="text-xl font-black text-blue-950 uppercase italic tracking-tighter">Gestão de Caixa</h1><p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Finanças e Auditoria Rede Real</p></div>
                    </div>

                    {user.role === UserRole.ADMIN && (
                        <div className="flex items-center gap-2 bg-gray-50 dark:bg-slate-800 px-4 py-2 rounded-2xl border border-gray-200 dark:border-slate-700 shadow-inner">
                            <Settings2 size={16} className="text-blue-600" />
                            <select 
                                value={selectedStoreId} 
                                onChange={(e) => setSelectedStoreId(e.target.value)}
                                className="bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl px-4 py-2 text-[10px] font-black text-gray-700 dark:text-white uppercase outline-none cursor-pointer min-w-[150px] appearance-none"
                            >
                                <option value="">SELECIONE UMA LOJA</option>
                                {[...stores].sort((a, b) => (parseInt(a.number) || 0) - (parseInt(b.number) || 0)).map(s => (
                                    <option key={s.id} value={s.id}>LOJA {s.number} - {s.name}</option>
                                ))}
                            </select>
                        </div>
                    )}
                </div>
                <div className="flex flex-wrap bg-gray-100 p-1 rounded-2xl w-full md:w-auto">
                    {[
                        { id: 'recibos', label: 'Recibos', icon: FileText }, 
                        { id: 'cartoes', label: 'Cartões', icon: CreditCard }, 
                        { id: 'pix', label: 'Pix', icon: DollarSign },
                        { id: 'quebras', label: 'Quebra', icon: AlertTriangle },
                        { id: 'fechamento', label: 'Fechamento', icon: CheckCircle2 }
                    ].map(tab => (
                        <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 md:px-6 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all whitespace-nowrap ${activeTab === tab.id ? 'bg-white text-blue-900 shadow-md border border-blue-50' : 'text-gray-400 hover:text-gray-600'}`}>
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
                    <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in duration-300">
                        <div className="bg-white p-8 rounded-[40px] shadow-sm border border-gray-100 relative overflow-hidden h-fit flex flex-col">
                            <div className="absolute top-0 right-0 p-8"><div className="text-center bg-blue-50 px-4 py-2 rounded-2xl border border-blue-100 shadow-sm"><p className="text-[8px] font-black text-blue-400 uppercase tracking-widest mb-1">Próximo</p><p className="text-2xl font-black text-blue-900 leading-none">#{String(nextReceiptNumber).padStart(4, '0')}</p></div></div>
                            <h3 className="text-sm font-black text-gray-900 uppercase italic tracking-tighter mb-8 flex items-center gap-3"><PenTool className="text-blue-600" size={18} /> Novo Recibo Profissional</h3>
                            <form onSubmit={handleSaveReceipt} className="space-y-5">
                                <div className="space-y-1"><label className="text-[10px] font-black text-gray-400 uppercase ml-2 tracking-widest">Recebedor (Favorecido)</label><input required value={receiptForm.recipient} onChange={e => setReceiptForm({...receiptForm, recipient: e.target.value})} className="w-full p-4 bg-gray-50 border-none rounded-2xl font-black text-blue-950 uppercase italic outline-none focus:ring-4 shadow-inner" placeholder="NOME DE QUEM RECEBE" /></div>
                                <div className="space-y-1"><label className="text-[10px] font-black text-gray-400 uppercase ml-2 tracking-widest">Pagador (Automático)</label><input readOnly value={payerName} className="w-full p-4 bg-gray-100 border-none rounded-2xl font-black text-gray-400 uppercase outline-none" /></div>
                                <div className="space-y-1"><label className="text-[10px] font-black text-gray-400 uppercase ml-2 tracking-widest">Valor (R$)</label><input required value={receiptForm.value} onChange={e => setReceiptForm({...receiptForm, value: e.target.value})} className="w-full p-4 bg-blue-50 border-none rounded-2xl font-black text-blue-900 text-xl outline-none shadow-inner text-center" placeholder="0,00" /></div>
                                <div className="space-y-1"><label className="text-[10px] font-black text-gray-400 uppercase ml-2 tracking-widest">Referente a</label><input required value={receiptForm.reference} onChange={e => setReceiptForm({...receiptForm, reference: e.target.value})} className="w-full p-4 bg-gray-50 border-none rounded-2xl font-black text-blue-950 uppercase outline-none shadow-inner" placeholder="DESCRIÇÃO DO SERVIÇO" /></div>
                                <button type="submit" disabled={isSubmitting} className="w-full py-5 bg-blue-900 text-white rounded-[28px] font-black uppercase text-xs shadow-xl active:scale-95 transition-all border-b-4 border-blue-950 flex items-center justify-center gap-3 mt-4">{isSubmitting ? <Loader2 className="animate-spin" /> : <Printer size={18}/>} EMITIR RECIBO (A5)</button>
                            </form>
                        </div>
                    </div>
                )}

                {activeTab === 'cartoes' && (
                    <div className="max-w-7xl mx-auto space-y-6 animate-in slide-in-from-right-4 duration-300">
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                            <div className="lg:col-span-4 bg-white p-6 rounded-[32px] shadow-sm border border-gray-100 flex flex-col h-fit">
                                <div className="flex justify-between items-center mb-6">
                                    <h3 className="text-base font-black text-gray-900 uppercase italic tracking-tighter flex items-center gap-2"><CardIcon className="text-green-600" size={20} /> Novo <span className="text-green-600">Lançamento</span></h3>
                                    <button onClick={() => setShowBrandManager(true)} className="p-2 bg-gray-100 text-gray-400 hover:text-blue-600 rounded-xl transition-all shadow-sm"><Settings2 size={16}/></button>
                                </div>
                                <form onSubmit={handleAddStagedCard} className="space-y-4">
                                    <div className="space-y-2">
                                        <label className="text-[9px] font-black text-gray-400 uppercase ml-2">Bandeira / Modalidade</label>
                                        <div className="grid grid-cols-2 gap-1.5">
                                            {availableBrands.map(b => (
                                                <button key={b.id} type="button" onClick={() => setCardBrandInput(b.name)} className={`p-2.5 rounded-xl text-[8px] font-black uppercase transition-all border-2 text-left flex items-center gap-2 ${cardBrandInput === b.name ? 'bg-green-600 border-green-600 text-white shadow-md' : 'bg-gray-50 border-gray-100 text-gray-400 hover:border-gray-200'}`}>
                                                    <img src={getCardFlagIcon(b.name)} className="w-4 h-4 object-contain shrink-0" alt="" />
                                                    <span className="truncate">{b.name}</span>
                                                    {cardBrandInput === b.name && <Check size={10} className="ml-auto shrink-0"/>}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[9px] font-black text-gray-400 uppercase ml-2">Número da Ficha</label>
                                        <input 
                                            value={cardTicketInput} 
                                            onChange={e => setCardTicketInput(e.target.value)} 
                                            className="w-full p-4 bg-gray-50 border-none rounded-[20px] font-black text-lg outline-none focus:ring-4 focus:ring-green-500/20" 
                                            placeholder="0000" 
                                        />
                                    </div>
                                    <div className="space-y-1"><label className="text-[9px] font-black text-gray-400 uppercase ml-2">Valor do Comprovante</label><input required value={cardValueInput} onChange={e => setCardValueInput(e.target.value)} className="w-full p-4 bg-gray-950 text-white border-none rounded-[20px] font-black text-2xl text-center outline-none focus:ring-4 focus:ring-green-500/20" placeholder="0,00" /></div>
                                    <button type="submit" className="w-full py-4 bg-green-600 text-white rounded-[20px] font-black uppercase text-[10px] shadow-xl active:scale-95 transition-all border-b-4 border-green-800 flex items-center justify-center gap-2"><Plus size={16}/> ADICIONAR</button>
                                </form>
                            </div>
                            <div className="lg:col-span-8 bg-white rounded-[32px] shadow-xl border border-gray-100 flex flex-col min-h-[500px] overflow-hidden">
                                <div className="px-6 py-4 border-b flex justify-between items-center bg-gray-50/50">
                                    <div>
                                        <h3 className="text-base font-black text-blue-950 uppercase italic tracking-tighter flex items-center gap-2">
                                            Mesa de <span className="text-blue-600">Conferência</span>
                                        </h3>
                                        <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest leading-none mt-1">Role para conferir os itens lançados</p>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        {stagedCards.length > 0 && (
                                            <button 
                                                onClick={() => printCardSummaryDoc(selectedDate, stores.find(s => s.id === selectedStoreId)?.city || 'N/A', stagedCards, user.name)}
                                                className="p-2 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-600 hover:text-white transition-all flex items-center gap-2 text-[9px] font-black uppercase shadow-sm"
                                            >
                                                <Printer size={14} /> Imprimir
                                            </button>
                                        )}
                                        <div className="text-right">
                                            <p className="text-[7px] font-black text-gray-400 uppercase leading-none">Total na Mesa</p>
                                            <p className="text-xl font-black text-green-700 italic leading-none mt-1">{formatCurrency(totalStagedValue)}</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex-1 overflow-y-auto no-scrollbar p-3 space-y-1 bg-[#fcfdfe] max-h-[400px]">
                                    {stagedCards.map((c) => (
                                        <div key={c.id} className="flex items-center justify-between px-4 py-2 bg-white rounded-xl border border-gray-100 group hover:border-blue-200 hover:shadow-sm transition-all animate-in slide-in-from-left-2 duration-200">
                                            <div className="flex items-center gap-3">
                                                <img src={getCardFlagIcon(c.brand)} className="w-5 h-5 object-contain opacity-80" alt="" />
                                                <div><p className="text-[9px] font-black text-blue-950 uppercase italic leading-none">{c.brand}</p><p className="text-[7px] text-gray-400 uppercase font-bold mt-1">Conferência Pendente</p></div>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <span className="text-xs font-black text-gray-900">{formatCurrency(c.value)}</span>
                                                <button onClick={() => setStagedCards(stagedCards.filter(x => x.id !== c.id))} className="p-1.5 text-red-200 hover:text-red-500 transition-all opacity-0 group-hover:opacity-100"><Trash2 size={14}/></button>
                                            </div>
                                        </div>
                                    ))}
                                    {stagedCards.length === 0 && (<div className="h-full flex flex-col items-center justify-center opacity-10 grayscale py-32"><CardIcon size={48} className="mb-2" /><p className="text-[10px] font-black uppercase tracking-widest">Mesa Vazia</p></div>)}
                                </div>
                                {stagedCards.length > 0 && (
                                    <div className="p-4 bg-blue-50/50 border-t border-blue-50">
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                            {Object.entries(totalsByBrand).map(([brand, val]) => (
                                                <div key={brand} className="bg-white p-2 rounded-lg border border-blue-50 flex justify-between items-center shadow-sm">
                                                    <span className="text-[7px] font-black text-gray-400 uppercase truncate pr-1">{brand}</span>
                                                    <span className="text-[9px] font-black text-blue-900">{formatCurrency(val as number)}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                <div className="p-4 bg-white border-t grid grid-cols-2 gap-3 shadow-inner">
                                    <button onClick={() => setStagedCards([])} className="py-3 bg-gray-100 text-gray-400 rounded-xl font-black uppercase text-[9px] hover:bg-gray-200 transition-all">Limpar</button>
                                    <button onClick={handleValidateAndSaveCards} disabled={isSubmitting || stagedCards.length === 0} className="py-3 bg-blue-900 text-white rounded-xl font-black uppercase text-[9px] shadow-lg active:scale-95 border-b-4 border-blue-950 flex items-center justify-center gap-2 hover:bg-blue-800 transition-all">
                                        {isSubmitting ? <Loader2 className="animate-spin" size={14}/> : <CheckCircle2 size={14}/>} VALIDAR & LANÇAR
                                    </button>
                                </div>
                            </div>

                            {/* Lista de Lançamentos do Dia */}
                            <div className="lg:col-span-12 bg-white rounded-[32px] shadow-sm border border-gray-100 overflow-hidden">
                                <div className="px-6 py-4 border-b bg-gray-50/50 flex justify-between items-center">
                                    <h3 className="text-xs font-black uppercase italic text-blue-950 flex items-center gap-2">
                                        <CreditCard size={16} className="text-blue-600" /> Lançamentos de Cartão Confirmados ({new Date(selectedDate + 'T12:00:00').toLocaleDateString('pt-BR')})
                                    </h3>
                                    <span className="text-xs font-black text-blue-600">{formatCurrency(manualCards.reduce((a, b) => a + Number(b.value), 0))}</span>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left">
                                        <thead className="bg-gray-50 text-[9px] font-black text-gray-400 uppercase tracking-widest border-b">
                                            <tr>
                                                <th className="px-6 py-3">Ficha</th>
                                                <th className="px-6 py-3">Bandeira</th>
                                                <th className="px-6 py-3">Usuário</th>
                                                <th className="px-6 py-3 text-right">Valor</th>
                                                <th className="px-6 py-3 text-center">Ações</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-50 font-bold text-[10px]">
                                            {manualCards.map((c) => (
                                                <tr key={c.id} className="hover:bg-gray-50/50 transition-all">
                                                    <td className="px-6 py-3 text-blue-600 font-black">#{c.sale_code || '---'}</td>
                                                    <td className="px-6 py-3 flex items-center gap-2">
                                                        <img src={getCardFlagIcon(c.brand)} className="w-4 h-4 object-contain" alt="" />
                                                        <span className="uppercase text-blue-950">{c.brand}</span>
                                                    </td>
                                                    <td className="px-6 py-3 text-gray-400 uppercase">{c.user_name}</td>
                                                    <td className="px-6 py-3 text-right text-blue-900 font-black">{formatCurrency(c.value)}</td>
                                                    <td className="px-6 py-3 text-center flex items-center justify-center gap-2">
                                                        <button 
                                                            onClick={() => setEditingCard(c)}
                                                            className="p-1 text-blue-300 hover:text-blue-600 transition-all"
                                                        >
                                                            <Edit3 size={14} />
                                                        </button>
                                                        <button 
                                                            onClick={() => {
                                                                setConfirmModal({
                                                                    isOpen: true,
                                                                    title: 'Excluir Lançamento',
                                                                    message: 'Deseja excluir este lançamento?',
                                                                    onConfirm: async () => {
                                                                        try {
                                                                            const { error } = await supabase.from('financial_card_sales').delete().eq('id', c.id);
                                                                            if (error) throw error;
                                                                            fetchDailyTotals();
                                                                            showToast("Lançamento excluído!");
                                                                        } catch (e: any) { showToast("Erro: " + e.message, "error"); }
                                                                        setConfirmModal(prev => ({ ...prev, isOpen: false }));
                                                                    }
                                                                });
                                                            }}
                                                            className="p-1 text-red-300 hover:text-red-600 transition-all"
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                            {manualCards.length === 0 && (
                                                <tr>
                                                    <td colSpan={4} className="px-6 py-12 text-center text-gray-400 uppercase italic text-[9px] tracking-widest">Nenhum lançamento manual hoje</td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'pix' && (
                    <div className="max-w-7xl mx-auto space-y-6 animate-in slide-in-from-right-4 duration-300">
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                            <div className="lg:col-span-4 bg-white p-6 rounded-[32px] shadow-sm border border-gray-100 flex flex-col h-fit">
                                <div className="flex justify-between items-center mb-6">
                                    <h3 className="text-base font-black text-gray-900 uppercase italic tracking-tighter flex items-center gap-2"><DollarSign className="text-teal-600" size={20} /> Novo Lançamento <span className="text-teal-600">Pix</span></h3>
                                </div>
                                <form onSubmit={handleAddStagedPix} className="space-y-4">
                                    {selectedDate !== today && (
                                        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-2 text-amber-700 text-[10px] font-bold uppercase italic">
                                            <AlertTriangle size={14} /> Lançamentos Pix bloqueados para datas retroativas.
                                        </div>
                                    )}
                                    <div className="space-y-1">
                                        <label className="text-[9px] font-black text-gray-400 uppercase ml-2">Número da Ficha</label>
                                        <input required disabled={selectedDate !== today} value={pixTicketInput} onChange={e => setPixTicketInput(e.target.value)} className="w-full p-4 bg-gray-50 border-none rounded-[20px] font-black text-lg outline-none focus:ring-4 focus:ring-teal-500/20 disabled:opacity-50" placeholder="0000" />
                                    </div>
                                    <div className="space-y-1 relative" onClick={e => e.stopPropagation()}>
                                        <label className="text-[9px] font-black text-gray-400 uppercase ml-2">Nome do Cliente</label>
                                        <input 
                                            required 
                                            disabled={selectedDate !== today} 
                                            value={pixClientInput} 
                                            onChange={e => {
                                                setPixClientInput(e.target.value);
                                                setShowSuggestions(true);
                                            }} 
                                            onFocus={(e) => {
                                                e.stopPropagation();
                                                setShowSuggestions(true);
                                            }}
                                            className="w-full p-4 bg-gray-50 border-none rounded-[20px] font-black text-lg uppercase outline-none focus:ring-4 focus:ring-teal-500/20 disabled:opacity-50" 
                                            placeholder="NOME DO CLIENTE" 
                                            autoComplete="off"
                                        />
                                        {showSuggestions && clientSuggestions.length > 0 && (
                                            <div className="absolute z-50 w-full mt-1 bg-white border border-gray-100 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                                                {clientSuggestions.map((name, idx) => (
                                                    <button
                                                        key={idx}
                                                        type="button"
                                                        onClick={() => {
                                                            setPixClientInput(name);
                                                            setClientSuggestions([]);
                                                            setShowSuggestions(false);
                                                        }}
                                                        className="w-full px-4 py-3 text-left text-[10px] font-black uppercase text-blue-950 hover:bg-teal-50 transition-colors border-b border-gray-50 last:border-none"
                                                    >
                                                        {name}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[9px] font-black text-gray-400 uppercase ml-2">Valor do Pix</label>
                                        <input required disabled={selectedDate !== today} value={pixValueInput} onChange={e => setPixValueInput(e.target.value)} className="w-full p-4 bg-gray-950 text-white border-none rounded-[20px] font-black text-2xl text-center outline-none focus:ring-4 focus:ring-teal-500/20 disabled:opacity-50" placeholder="0,00" />
                                    </div>
                                    <button type="submit" disabled={selectedDate !== today} className="w-full py-4 bg-teal-600 text-white rounded-[20px] font-black uppercase text-[10px] shadow-xl active:scale-95 transition-all border-b-4 border-teal-800 flex items-center justify-center gap-2 disabled:bg-gray-400 disabled:border-gray-500 disabled:cursor-not-allowed"><Plus size={16}/> ADICIONAR</button>
                                </form>
                            </div>
                            <div className="lg:col-span-8 bg-white rounded-[32px] shadow-xl border border-gray-100 flex flex-col min-h-[500px] overflow-hidden">
                                <div className="px-6 py-4 border-b flex justify-between items-center bg-gray-50/50">
                                    <div>
                                        <h3 className="text-base font-black text-blue-950 uppercase italic tracking-tighter flex items-center gap-2">
                                            Mesa de <span className="text-teal-600">Conferência Pix</span>
                                        </h3>
                                        <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest leading-none mt-1">Role para conferir os itens lançados</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[7px] font-black text-gray-400 uppercase leading-none">Total na Mesa</p>
                                        <p className="text-xl font-black text-teal-700 italic leading-none mt-1">{formatCurrency(stagedPix.reduce((a, b) => a + b.value, 0))}</p>
                                    </div>
                                </div>
                                <div className="flex-1 overflow-y-auto no-scrollbar p-3 space-y-1 bg-[#fcfdfe] max-h-[400px]">
                                    {stagedPix.map((p) => (
                                        <div key={p.id} className="flex items-center justify-between px-4 py-2 bg-white rounded-xl border border-gray-100 group hover:border-teal-200 hover:shadow-sm transition-all animate-in slide-in-from-left-2 duration-200">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-teal-50 flex items-center justify-center text-teal-600 font-black text-[10px]">PX</div>
                                                <div>
                                                    <p className="text-[9px] font-black text-blue-950 uppercase italic leading-none">Ficha: {p.ticket}</p>
                                                    <p className="text-[7px] text-gray-400 uppercase font-bold mt-1">{p.client}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <span className="text-xs font-black text-gray-900">{formatCurrency(p.value)}</span>
                                                <button onClick={() => setStagedPix(stagedPix.filter(x => x.id !== p.id))} className="p-1.5 text-red-200 hover:text-red-500 transition-all opacity-0 group-hover:opacity-100"><Trash2 size={14}/></button>
                                            </div>
                                        </div>
                                    ))}
                                    {stagedPix.length === 0 && (<div className="h-full flex flex-col items-center justify-center opacity-10 grayscale py-32"><DollarSign size={48} className="mb-2" /><p className="text-[10px] font-black uppercase tracking-widest">Mesa Vazia</p></div>)}
                                </div>
                                <div className="p-4 bg-white border-t grid grid-cols-2 gap-3 shadow-inner">
                                    <button onClick={() => setStagedPix([])} className="py-3 bg-gray-100 text-gray-400 rounded-xl font-black uppercase text-[9px] hover:bg-gray-200 transition-all">Limpar</button>
                                    <button onClick={handleValidateAndSavePix} disabled={isSubmitting || stagedPix.length === 0} className="py-3 bg-teal-600 text-white rounded-xl font-black uppercase text-[9px] shadow-lg active:scale-95 border-b-4 border-teal-950 flex items-center justify-center gap-2 hover:bg-teal-700 transition-all">
                                        {isSubmitting ? <Loader2 className="animate-spin" size={14}/> : <CheckCircle2 size={14}/>} VALIDAR & LANÇAR
                                    </button>
                                </div>
                            </div>

                            {/* Lista de Lançamentos do Dia */}
                            <div className="lg:col-span-12 bg-white rounded-[32px] shadow-sm border border-gray-100 overflow-hidden">
                                <div className="px-6 py-4 border-b bg-gray-50/50 flex justify-between items-center">
                                    <h3 className="text-xs font-black uppercase italic text-blue-950 flex items-center gap-2">
                                        <DollarSign size={16} className="text-teal-600" /> Lançamentos de Pix Confirmados ({new Date(selectedDate + 'T12:00:00').toLocaleDateString('pt-BR')})
                                    </h3>
                                    <span className="text-xs font-black text-teal-600">{formatCurrency(manualPix.reduce((a, b) => a + Number(b.value), 0))}</span>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left">
                                        <thead className="bg-gray-50 text-[9px] font-black text-gray-400 uppercase tracking-widest border-b">
                                            <tr>
                                                <th className="px-6 py-3">Ficha</th>
                                                <th className="px-6 py-3">Cliente</th>
                                                <th className="px-6 py-3">Usuário</th>
                                                <th className="px-6 py-3 text-right">Valor</th>
                                                <th className="px-6 py-3 text-center">Ações</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-50 font-bold text-[10px]">
                                            {manualPix.map((p) => (
                                                <tr key={p.id} className="hover:bg-gray-50/50 transition-all">
                                                    <td className="px-6 py-3 text-blue-950 font-black">#{p.sale_code}</td>
                                                    <td className="px-6 py-3 text-gray-600 uppercase">{p.payer_name || '---'}</td>
                                                    <td className="px-6 py-3 text-gray-400 uppercase">{p.user_name}</td>
                                                    <td className="px-6 py-3 text-right text-teal-700 font-black">{formatCurrency(p.value)}</td>
                                                    <td className="px-6 py-3 text-center flex items-center justify-center gap-2">
                                                        <button 
                                                            onClick={() => setEditingPix(p)}
                                                            className="p-1 text-blue-300 hover:text-blue-600 transition-all"
                                                        >
                                                            <Edit3 size={14} />
                                                        </button>
                                                        <button 
                                                            onClick={() => {
                                                                setConfirmModal({
                                                                    isOpen: true,
                                                                    title: 'Excluir Lançamento',
                                                                    message: 'Deseja excluir este lançamento?',
                                                                    onConfirm: async () => {
                                                                        try {
                                                                            const { error } = await supabase.from('financial_pix_sales').delete().eq('id', p.id);
                                                                            if (error) throw error;
                                                                            fetchDailyTotals();
                                                                            showToast("Lançamento excluído!");
                                                                        } catch (e: any) { showToast("Erro: " + e.message, "error"); }
                                                                        setConfirmModal(prev => ({ ...prev, isOpen: false }));
                                                                    }
                                                                });
                                                            }}
                                                            className="p-1 text-red-300 hover:text-red-600 transition-all"
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                            {manualPix.length === 0 && (
                                                <tr>
                                                    <td colSpan={5} className="px-6 py-12 text-center text-gray-400 uppercase italic text-[9px] tracking-widest">Nenhum lançamento manual hoje</td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'quebras' && (
                    <div className="max-w-xl mx-auto space-y-6 animate-in slide-in-from-bottom-4 duration-300">
                        <div className="bg-white p-8 rounded-[48px] shadow-sm border border-gray-100">
                            <div className="flex justify-between items-center mb-8">
                                <h3 className="text-sm font-black text-gray-900 uppercase italic tracking-tighter flex items-center gap-3"><AlertTriangle className="text-red-600" size={20} /> Registrar Divergência</h3>
                                <div className="flex gap-2">
                                    <button 
                                        onClick={() => {
                                            const dailyErrors = errors.filter(e => e.storeId === selectedStoreId && e.date === selectedDate);
                                            printErrorsDoc('RELATÓRIO DIÁRIO', new Date(selectedDate + 'T12:00:00').toLocaleDateString('pt-BR'), payerName, dailyErrors, user.name);
                                        }}
                                        className="p-2 bg-gray-100 text-gray-600 rounded-xl hover:bg-blue-600 hover:text-white transition-all shadow-sm"
                                        title="Imprimir Erros do Dia"
                                    >
                                        <Printer size={16} />
                                    </button>
                                    <button 
                                        onClick={() => {
                                            const [year, month] = selectedDate.split('-');
                                            const monthlyErrors = errors.filter(e => {
                                                const [eYear, eMonth] = e.date.split('-');
                                                return e.storeId === selectedStoreId && eYear === year && eMonth === month;
                                            });
                                            const monthName = new Date(parseInt(year), parseInt(month) - 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
                                            printErrorsDoc('RELATÓRIO MENSAL', monthName.toUpperCase(), payerName, monthlyErrors, user.name);
                                        }}
                                        className="p-2 bg-gray-100 text-gray-600 rounded-xl hover:bg-blue-600 hover:text-white transition-all shadow-sm"
                                        title="Imprimir Erros do Mês"
                                    >
                                        <Calendar size={16} />
                                    </button>
                                </div>
                            </div>
                            <form onSubmit={async (e) => { 
                                e.preventDefault(); 
                                if (!selectedStoreId) { showToast("Selecione uma loja primeiro.", "error"); return; }
                                setIsSubmitting(true); 
                                try { 
                                    await onAddError({ 
                                        store_id: selectedStoreId, 
                                        user_id: user.id, 
                                        user_name: user.name, 
                                        error_date: selectedDate, 
                                        value: parseFloat(errorForm.value.replace(',', '.')), 
                                        type: errorForm.type, 
                                        reason: errorForm.reason.toUpperCase() 
                                    }); 
                                    setErrorForm({ value: '', reason: '', type: 'shortage' }); 
                                    showToast("Sucesso!"); 
                                } catch { showToast("Erro.", "error"); } 
                                finally { setIsSubmitting(false); } 
                            }} className="space-y-6">
                                <div className="space-y-2"><label className="text-[10px] font-black text-gray-400 uppercase ml-2">Tipo</label><div className="flex bg-gray-100 p-1 rounded-2xl"><button type="button" onClick={() => setErrorForm({...errorForm, type: 'shortage'})} className={`flex-1 py-4 rounded-xl text-[10px] font-black uppercase transition-all ${errorForm.type === 'shortage' ? 'bg-red-600 text-white shadow-lg' : 'text-gray-400'}`}>Falta (-)</button><button type="button" onClick={() => setErrorForm({...errorForm, type: 'surplus'})} className={`flex-1 py-4 rounded-xl text-[10px] font-black uppercase transition-all ${errorForm.type === 'surplus' ? 'bg-green-600 text-white shadow-lg' : 'text-gray-400'}`}>Sobra (+)</button></div></div>
                                <div className="space-y-2"><label className="text-[10px] font-black text-gray-400 uppercase ml-2">Valor</label><input required value={errorForm.value} onChange={e => setErrorForm({...errorForm, value: e.target.value})} className="w-full p-5 bg-gray-50 border-none rounded-[24px] font-black text-2xl text-center text-blue-950 shadow-inner" placeholder="0,00" /></div>
                                <div className="space-y-2"><label className="text-[10px] font-black text-gray-400 uppercase ml-2">Motivo</label><textarea required value={errorForm.reason} onChange={e => setErrorForm({...errorForm, reason: e.target.value})} className="w-full p-5 bg-gray-50 border-none rounded-[24px] font-bold text-xs text-gray-700 h-32 shadow-inner no-scrollbar" placeholder="MOTIVO DA DIVERGÊNCIA..." /></div>
                                <button type="submit" disabled={isSubmitting} className="w-full py-5 bg-gray-950 text-white rounded-[28px] font-black uppercase text-xs shadow-xl active:scale-95 border-b-4 border-slate-700 flex items-center justify-center gap-3">{isSubmitting ? <Loader2 className="animate-spin" /> : <Save size={18}/>} REGISTRAR</button>
                            </form>
                        </div>
                    </div>
                )}
                {activeTab === 'fechamento' && (
                    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-300">
                        <div className="bg-white p-8 rounded-[40px] shadow-sm border border-gray-100">
                            <div className="flex justify-between items-center mb-8">
                                <div>
                                    <h3 className="text-sm font-black text-gray-900 uppercase italic tracking-tighter flex items-center gap-3">
                                        <CheckCircle2 className="text-blue-600" size={20} /> Conferência de Caixa Diário
                                    </h3>
                                    <p className="text-[10px] text-gray-400 font-bold uppercase mt-1">Valores consolidados por forma de pagamento</p>
                                </div>
                                <button 
                                    onClick={fetchDailyTotals}
                                    className="p-2 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 transition-all"
                                >
                                    <Loader2 className={isLoadingTotals ? 'animate-spin' : ''} size={20} />
                                </button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {Object.entries(dailyTotals).map(([method, total]) => (
                                    <div key={method} className="bg-gray-50 p-6 rounded-3xl border border-gray-100 flex flex-col gap-2">
                                        <div className="flex items-center gap-2">
                                            {method === 'Pix' && <div className="w-2 h-2 rounded-full bg-teal-400" />}
                                            {method === 'Dinheiro' && <div className="w-2 h-2 rounded-full bg-green-400" />}
                                            {method === 'Cartão' && <div className="w-2 h-2 rounded-full bg-blue-400" />}
                                            {method === 'Fiado' && <div className="w-2 h-2 rounded-full bg-red-400" />}
                                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{method}</span>
                                        </div>
                                        <span className="text-2xl font-black text-blue-950 italic">{formatCurrency(total as number)}</span>
                                    </div>
                                ))}
                                <div className="bg-blue-900 p-6 rounded-3xl border border-blue-950 flex flex-col gap-2 shadow-xl md:col-span-2 lg:col-span-1">
                                    <span className="text-[10px] font-black text-blue-300 uppercase tracking-widest">Total Geral</span>
                                    <span className="text-2xl font-black text-white italic">
                                        {formatCurrency((Object.values(dailyTotals) as number[]).reduce((acc: number, val: number) => acc + val, 0))}
                                    </span>
                                </div>
                            </div>

                            {/* Vendas Canceladas */}
                            {canceledSales.length > 0 && (
                                <div className="mt-8 bg-red-50 rounded-[32px] border border-red-100 overflow-hidden">
                                    <div className="px-6 py-4 border-b border-red-100 flex justify-between items-center bg-red-100/30">
                                        <h4 className="text-[10px] font-black text-red-700 uppercase tracking-widest flex items-center gap-2">
                                            <XCircle size={16} /> Vendas Canceladas no Dia ({canceledSales.length})
                                        </h4>
                                        <span className="text-xs font-black text-red-700">{formatCurrency(canceledSales.reduce((a, b) => a + Number(b.total_amount), 0))}</span>
                                    </div>
                                    <div className="p-4 space-y-2">
                                        {canceledSales.map(s => (
                                            <div key={s.id} className="flex justify-between items-center p-3 bg-white rounded-xl border border-red-50 shadow-sm">
                                                <div className="flex flex-col">
                                                    <span className="text-[10px] font-black text-red-900 uppercase">#{s.sale_code} - {new Date(s.created_at).toLocaleTimeString()}</span>
                                                    <span className="text-[9px] font-bold text-gray-400 uppercase mt-1">Motivo: <span className="text-red-600 italic">{s.cancel_reason}</span></span>
                                                    <span className="text-[8px] font-black text-gray-400 uppercase">Por: {s.canceled_by_name || s.canceled_by}</span>
                                                </div>
                                                <span className="font-black text-red-700 text-sm">{formatCurrency(s.total_amount)}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="mt-12 p-6 bg-amber-50 rounded-3xl border border-amber-100 flex gap-4 items-start">
                                <AlertTriangle className="text-amber-600 shrink-0" size={24} />
                                <div>
                                    <p className="text-xs font-black text-amber-900 uppercase italic">Atenção Auditoria</p>
                                    <p className="text-[10px] text-amber-700 font-medium leading-relaxed mt-1">
                                        Os valores acima são extraídos diretamente da tabela de pagamentos atômicos. 
                                        Qualquer divergência com o valor físico deve ser registrada na aba "Quebra" para fins de auditoria.
                                    </p>
                                </div>
                            </div>

                            <button 
                                onClick={() => {
                                    if (!selectedStoreId) return;
                                    setConfirmModal({
                                        isOpen: true,
                                        title: 'Fechar Caixa',
                                        message: 'Deseja realizar o fechamento do caixa para esta data?',
                                        onConfirm: async () => {
                                            setIsSubmitting(true);
                                            try {
                                                const totalSales = (Object.values(dailyTotals) as number[]).reduce((acc, val) => acc + val, 0);
                                                await onAddClosure({
                                                    storeId: selectedStoreId,
                                                    totalSales,
                                                    totalExpenses: 0,
                                                    balance: totalSales,
                                                    notes: `Fechamento automático via sistema em ${selectedDate}`,
                                                    date: selectedDate
                                                });
                                                showToast("Caixa fechado com sucesso!");
                                            } catch {
                                                showToast("Erro ao fechar caixa.", "error");
                                            } finally {
                                                setIsSubmitting(false);
                                            }
                                            setConfirmModal(prev => ({ ...prev, isOpen: false }));
                                        }
                                    });
                                }}
                                disabled={isSubmitting || Object.keys(dailyTotals).length === 0}
                                className="w-full mt-6 py-5 bg-blue-900 text-white rounded-[28px] font-black uppercase text-xs shadow-xl active:scale-95 border-b-4 border-blue-950 flex items-center justify-center gap-3"
                            >
                                {isSubmitting ? <Loader2 className="animate-spin" /> : <CheckCircle2 size={18}/>} FECHAR CAIXA & SALVAR
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {showBrandManager && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[200] p-4">
                    <div className="bg-white rounded-[40px] w-full max-w-sm shadow-2xl animate-in zoom-in duration-300 border-t-8 border-blue-600 overflow-hidden">
                        <div className="p-6 border-b flex justify-between items-center bg-gray-50/50"><h3 className="text-lg font-black uppercase italic text-blue-950 flex items-center gap-3"><Settings size={20} /> Configurar <span className="text-blue-600">Bandeiras</span></h3><button onClick={() => setShowBrandManager(false)} className="text-gray-400 hover:text-red-600"><X size={24}/></button></div>
                        <div className="p-8 space-y-6">
                            <div className="flex gap-2"><input value={newBrandName} onChange={e => setNewBrandName(e.target.value)} placeholder="NOVA BANDEIRA..." className="flex-1 p-3 bg-gray-50 rounded-xl font-black uppercase text-[10px] outline-none border border-gray-200" /><button onClick={handleAddBrand} disabled={isSubmitting} className="bg-blue-600 text-white p-3 rounded-xl hover:bg-blue-700 transition-all flex items-center justify-center min-w-[48px]">{isSubmitting ? <Loader2 className="animate-spin" size={18} /> : <Plus size={18}/>}</button></div>
                            <div className="space-y-2 max-h-[300px] overflow-y-auto no-scrollbar">
                                {availableBrands.map(b => (<div key={b.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-xl border border-gray-100 group"><div className="flex items-center gap-3"><img src={getCardFlagIcon(b.name)} className="w-5 h-5 object-contain" alt="" /><span className="text-[10px] font-black text-gray-700 uppercase">{b.name}</span></div><button onClick={() => handleDeleteBrand(b.id)} className="text-red-300 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-all"><Trash2 size={14}/></button></div>))}
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {/* Modal de Confirmação Customizado */}
            {/* Modais de Edição */}
            {editingCard && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white w-full max-w-md rounded-[32px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="bg-blue-900 px-8 py-6 flex justify-between items-center">
                            <h3 className="text-white font-black uppercase italic tracking-tighter flex items-center gap-2"><Edit3 size={20}/> Editar Cartão</h3>
                            <button onClick={() => setEditingCard(null)} className="text-white/60 hover:text-white transition-all"><X size={24}/></button>
                        </div>
                        <form onSubmit={handleUpdateCard} className="p-8 space-y-6">
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-gray-400 uppercase ml-2">Ficha</label>
                                <input 
                                    value={editingCard.sale_code} 
                                    onChange={e => setEditingCard({...editingCard, sale_code: e.target.value})} 
                                    className="w-full p-4 bg-gray-50 border-none rounded-2xl font-black text-blue-950 uppercase outline-none focus:ring-4 focus:ring-blue-500/20" 
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-gray-400 uppercase ml-2">Bandeira</label>
                                <select 
                                    value={editingCard.brand} 
                                    onChange={e => setEditingCard({...editingCard, brand: e.target.value})}
                                    className="w-full p-4 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl font-black text-blue-950 dark:text-white uppercase outline-none focus:ring-4 focus:ring-blue-500/20"
                                >
                                    {availableBrands.map(b => <option key={b.id} value={b.name}>{b.name}</option>)}
                                </select>
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-gray-400 uppercase ml-2">Valor</label>
                                <input 
                                    value={editingCard.value} 
                                    onChange={e => setEditingCard({...editingCard, value: e.target.value})} 
                                    className="w-full p-4 bg-blue-50 border-none rounded-2xl font-black text-blue-900 text-xl text-center outline-none focus:ring-4 focus:ring-blue-500/20" 
                                />
                            </div>
                            <button type="submit" disabled={isSubmitting} className="w-full py-5 bg-blue-900 text-white rounded-[24px] font-black uppercase text-xs shadow-xl active:scale-95 transition-all flex items-center justify-center gap-3">
                                {isSubmitting ? <Loader2 className="animate-spin" /> : <Save size={18}/>} SALVAR ALTERAÇÕES
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {editingPix && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white w-full max-w-md rounded-[32px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="bg-teal-900 px-8 py-6 flex justify-between items-center">
                            <h3 className="text-white font-black uppercase italic tracking-tighter flex items-center gap-2"><Edit3 size={20}/> Editar Pix</h3>
                            <button onClick={() => setEditingPix(null)} className="text-white/60 hover:text-white transition-all"><X size={24}/></button>
                        </div>
                        <form onSubmit={handleUpdatePix} className="p-8 space-y-6">
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-gray-400 uppercase ml-2">Ficha</label>
                                <input 
                                    value={editingPix.sale_code} 
                                    onChange={e => setEditingPix({...editingPix, sale_code: e.target.value})} 
                                    className="w-full p-4 bg-gray-50 border-none rounded-2xl font-black text-blue-950 uppercase outline-none focus:ring-4 focus:ring-teal-500/20" 
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-gray-400 uppercase ml-2">Cliente</label>
                                <input 
                                    value={editingPix.payer_name} 
                                    onChange={e => setEditingPix({...editingPix, payer_name: e.target.value})} 
                                    className="w-full p-4 bg-gray-50 border-none rounded-2xl font-black text-blue-950 uppercase outline-none focus:ring-4 focus:ring-teal-500/20" 
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-gray-400 uppercase ml-2">Valor</label>
                                <input 
                                    value={editingPix.value} 
                                    onChange={e => setEditingPix({...editingPix, value: e.target.value})} 
                                    className="w-full p-4 bg-teal-50 border-none rounded-2xl font-black text-teal-900 text-xl text-center outline-none focus:ring-4 focus:ring-teal-500/20" 
                                />
                            </div>
                            <button type="submit" disabled={isSubmitting} className="w-full py-5 bg-teal-900 text-white rounded-[24px] font-black uppercase text-xs shadow-xl active:scale-95 transition-all flex items-center justify-center gap-3">
                                {isSubmitting ? <Loader2 className="animate-spin" /> : <Save size={18}/>} SALVAR ALTERAÇÕES
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {confirmModal.isOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[300] p-4">
                    <div className="bg-white rounded-[32px] w-full max-w-sm shadow-2xl animate-in zoom-in duration-200 overflow-hidden">
                        <div className="p-8 text-center">
                            <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-6">
                                <AlertTriangle size={32} />
                            </div>
                            <h3 className="text-xl font-black text-gray-900 uppercase italic tracking-tighter mb-2">{confirmModal.title}</h3>
                            <p className="text-sm font-bold text-gray-500 leading-relaxed">{confirmModal.message}</p>
                        </div>
                        <div className="flex border-t border-gray-100">
                            <button 
                                onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                                className="flex-1 py-6 text-[10px] font-black uppercase text-gray-400 hover:bg-gray-50 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button 
                                onClick={confirmModal.onConfirm}
                                className="flex-1 py-6 text-[10px] font-black uppercase text-blue-600 hover:bg-blue-50 transition-colors border-l border-gray-100"
                            >
                                Confirmar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Toast de Notificação */}
            {toast.show && (
                <div className={`fixed bottom-24 left-1/2 -translate-x-1/2 z-[400] px-6 py-3 rounded-2xl shadow-2xl animate-in slide-in-from-bottom-4 duration-300 flex items-center gap-3 border ${
                    toast.type === 'success' ? 'bg-emerald-600 border-emerald-500 text-white' : 'bg-red-600 border-red-500 text-white'
                }`}>
                    {toast.type === 'success' ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
                    <span className="text-[10px] font-black uppercase tracking-widest">{toast.message}</span>
                </div>
            )}
        </div>
    );
};

export default CashRegisterModule;