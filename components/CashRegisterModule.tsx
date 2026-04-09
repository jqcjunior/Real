import React, { useState, useMemo, useEffect } from 'react';
import { User, IceCreamDailySale, Receipt, CashError, UserRole, Store } from '../types';
import { formatCurrency, BRAND_LOGO } from '../constants';
import { 
    DollarSign, Save, Calendar, FileText, CreditCard, AlertTriangle, 
    Plus, Trash2, Printer, Loader2, CreditCard as CardIcon, Trash, CheckCircle2, User as UserIcon, PenTool, Edit3, X, Check, Settings, Settings2, XCircle
} from 'lucide-react';
import { supabase } from '../services/supabaseClient';
import apiService from '../services/apiService';
import CashErrorsModule from './CashErrorsModule';
 
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
    can: (perm: string) => boolean;
    onAddClosure: (closure: any) => Promise<void>;
    onAddReceipt: (receipt: any) => Promise<any>;
    onAddError: (error: any) => Promise<void>;
    onDeleteError: (id: string) => Promise<void>;
    onAddLog?: (action: string, details: string) => Promise<void>;
}
 
// ============================================
// SOLUÇÃO: Logos de Bandeiras de Cartão
// Com múltiplas fontes e fallback automático
// ============================================

export const getCardFlagIcon = (brandName: string): string => {
    const name = (brandName || '').toLowerCase();
    
    if (name.includes('visa')) {
        return 'https://raw.githubusercontent.com/aaronfagan/svg-credit-card-payment-icons/main/flat/visa.svg';
    }
    
    if (name.includes('master')) {
        return 'https://raw.githubusercontent.com/aaronfagan/svg-credit-card-payment-icons/main/flat/mastercard.svg';
    }
    
    if (name.includes('elo')) {
        return 'https://raw.githubusercontent.com/aaronfagan/svg-credit-card-payment-icons/main/flat/elo.svg';
    }
    
    if (name.includes('hiper')) {
        return 'https://raw.githubusercontent.com/aaronfagan/svg-credit-card-payment-icons/main/flat/hipercard.svg';
    }
    
    if (name.includes('amex') || name.includes('american')) {
        return 'https://raw.githubusercontent.com/aaronfagan/svg-credit-card-payment-icons/main/flat/amex.svg';
    }
    
    if (name.includes('diners')) {
        return 'https://raw.githubusercontent.com/aaronfagan/svg-credit-card-payment-icons/main/flat/diners.svg';
    }
    
    if (name.includes('discover')) {
        return 'https://raw.githubusercontent.com/aaronfagan/svg-credit-card-payment-icons/main/flat/discover.svg';
    }
    
    if (name.includes('jcb')) {
        return 'https://raw.githubusercontent.com/aaronfagan/svg-credit-card-payment-icons/main/flat/jcb.svg';
    }
    
    if (name.includes('aura')) {
        return 'https://raw.githubusercontent.com/aaronfagan/svg-credit-card-payment-icons/main/flat/aura.svg';
    }
    
    // 🔄 FALLBACK: Ícone genérico de cartão
    return 'https://raw.githubusercontent.com/aaronfagan/svg-credit-card-payment-icons/main/flat/generic.svg';
};

export const getCardFlagIconSimpleIcons = (brandName: string): string => {
    const name = (brandName || '').toLowerCase();
    const baseUrl = 'https://cdn.simpleicons.org';
    
    if (name.includes('visa')) {
        return `${baseUrl}/visa/1A1F71`;
    }
    
    if (name.includes('master')) {
        return `${baseUrl}/mastercard/EB001B`;
    }
    
    if (name.includes('amex') || name.includes('american')) {
        return `${baseUrl}/americanexpress/006FCF`;
    }
    
    if (name.includes('discover')) {
        return `${baseUrl}/discover/FF6000`;
    }
    
    if (name.includes('diners')) {
        return `${baseUrl}/dinersclub/0079BE`;
    }
    
    // Fallback genérico
    return 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="%23666" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"%3E%3Crect x="1" y="4" width="22" height="16" rx="2" ry="2"%3E%3C/rect%3E%3Cline x1="1" y1="10" x2="23" y2="10"%3E%3C/line%3E%3C/svg%3E';
};

export const getCardFlagIconBase64 = (brandName: string): string => {
    const name = (brandName || '').toLowerCase();
    
    const logos: Record<string, string> = {
        visa: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0OCIgaGVpZ2h0PSI0OCI+PHJlY3Qgd2lkdGg9IjQ4IiBoZWlnaHQ9IjQ4IiBmaWxsPSIjMUExRjcxIiByeD0iNiIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTQiIGZvbnQtd2VpZ2h0PSJib2xkIiBmaWxsPSIjZmZmIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+VklTQTwvdGV4dD48L3N2Zz4=',
        mastercard: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0OCIgaGVpZ2h0PSI0OCI+PGRlZnM+PGxpbmVhckdyYWRpZW50IGlkPSJhIj48c3RvcCBvZmZzZXQ9IjAlIiBzdG9wLWNvbG9yPSIjRUIwMDFCIi8+PHN0b3Agb2Zmc2V0PSIxMDAlIiBzdG9wLWNvbG9yPSIjRjc5RTFCIi8+PC9saW5lYXJHcmFkaWVudD48L2RlZnM+PHJlY3Qgd2lkdGg9IjQ4IiBoZWlnaHQ9IjQ4IiBmaWxsPSJ1cmwoI2EpIiByeD0iNiIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTAiIGZvbnQtd2VpZ2h0PSJib2xkIiBmaWxsPSIjZmZmIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+TUFTVEVSPC90ZXh0Pjwvc3ZnPg==',
        elo: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0OCIgaGVpZ2h0PSI0OCI+PHJlY3Qgd2lkdGg9IjQ4IiBoZWlnaHQ9IjQ4IiBmaWxsPSIjRkZEQTAwIiByeD0iNiIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTYiIGZvbnQtd2VpZ2h0PSJib2xkIiBmaWxsPSIjMDAwIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+RUxPPC90ZXh0Pjwvc3ZnPg==',
        hipercard: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0OCIgaGVpZ2h0PSI0OCI+PHJlY3Qgd2lkdGg9IjQ4IiBoZWlnaHQ9IjQ4IiBmaWxsPSIjRUQzMjM3IiByeD0iNiIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTAiIGZvbnQtd2VpZ2h0PSJib2xkIiBmaWxsPSIjZmZmIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+SElQRVI8L3RleHQ+PC9zdmc+',
        amex: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0OCIgaGVpZ2h0PSI0OCI+PHJlY3Qgd2lkdGg9IjQ4IiBoZWlnaHQ9IjQ4IiBmaWxsPSIjMDA2RkNGIiByeD0iNiIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTIiIGZvbnQtd2VpZ2h0PSJib2xkIiBmaWxsPSIjZmZmIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+QU1FWDwvdGV4dD48L3N2Zz4=',
        diners: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0OCIgaGVpZ2h0PSI0OCI+PHJlY3Qgd2lkdGg9IjQ4IiBoZWlnaHQ9IjQ4IiBmaWxsPSIjMDA3OUJFIiByeD0iNiIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iOSIgZm9udC13ZWlnaHQ9ImJvbGQiIGZpbGw9IiNmZmYiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj5ESU5FUlM8L3RleHQ+PC9zdmc+',
        generic: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0OCIgaGVpZ2h0PSI0OCI+PHJlY3Qgd2lkdGg9IjQ4IiBoZWlnaHQ9IjQ4IiBmaWxsPSIjNjY2IiByeD0iNiIvPjxyZWN0IHg9IjgiIHk9IjE4IiB3aWR0aD0iMzIiIGhlaWdodD0iNCIgZmlsbD0iI2ZmZiIvPjxyZWN0IHg9IjgiIHk9IjI2IiB3aWR0aD0iMTYiIGhlaWdodD0iNCIgZmlsbD0iI2ZmZiIvPjwvc3ZnPg=='
    };
    
    if (name.includes('visa')) return logos.visa;
    if (name.includes('master')) return logos.mastercard;
    if (name.includes('elo')) return logos.elo;
    if (name.includes('hiper')) return logos.hipercard;
    if (name.includes('amex') || name.includes('american')) return logos.amex;
    if (name.includes('diners')) return logos.diners;
    
    return logos.generic;
};

interface CardLogoProps {
    brandName: string;
    className?: string;
}

export const CardLogo: React.FC<CardLogoProps> = ({ brandName, className = "w-6 h-6" }) => {
    const [imgError, setImgError] = useState(false);
    
    // Se imagem externa falhar, usa base64
    const primarySrc = getCardFlagIcon(brandName);
    const fallbackSrc = getCardFlagIconBase64(brandName);
    
    return (
        <img 
            src={imgError ? fallbackSrc : primarySrc}
            onError={() => setImgError(true)}
            referrerPolicy="no-referrer" 
            className={`${className} object-contain`}
            alt={brandName}
        />
    );
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
 
    // Mapeamento robusto de campos (banco vs objeto local)
    const receiptNumber = r.receipt_number || r.id;
    const finalNumber = r.formatted_number || (r.receipt_number ? `#${String(r.receipt_number).padStart(4, '0')}` : `#${String(r.id).padStart(4, '0')}`);
    const valueInWords = r.value_in_words || r.valueInWords || 'UNDEFINED';
    const dateStr = r.receipt_date || r.date;
    
    // Formatação de data robusta (evita fuso horário)
    let formattedDate = 'Invalid Date';
    if (dateStr && typeof dateStr === 'string') {
        const [y, m, d] = dateStr.split('-').map(Number);
        formattedDate = new Date(y, m - 1, d).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });
    }
 
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
                            <img src="${BRAND_LOGO}" referrerPolicy="no-referrer" class="h-14 w-auto" />
                            <div>
                                <h1 class="text-2xl font-black uppercase italic leading-none tracking-tighter">Real <span class="text-red-600">Calçados</span></h1>
                                <p class="text-[8px] font-bold uppercase tracking-[0.3em] mt-1 text-gray-400">Recibo Profissional de Quitação</p>
                            </div>
                        </div>
                        <div class="text-right">
                            <div class="text-xl font-black text-gray-300 mb-1">Nº <span class="text-red-600">${finalNumber}</span></div>
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
                                ${valueInWords}
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
                            ${formattedDate}
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
    user, stores, receipts, errors, finances, can, onAddReceipt, onAddError, onDeleteError, onAddClosure, onAddLog 
}) => {
    const isAdmin = can('ALWAYS');
    const [activeTab, setActiveTab] = useState<'recibos' | 'cartoes' | 'pix' | 'quebras'>('recibos');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [selectedStoreId, setSelectedStoreId] = useState(user.storeId || '');
    const [dailyTotals, setDailyTotals] = useState<Record<string, number>>({});
    const [manualCards, setManualCards] = useState<any[]>([]);
    const [manualPix, setManualPix] = useState<any[]>([]);
    const [canceledSales, setCanceledSales] = useState<any[]>([]);
    const [isLoadingTotals, setIsLoadingTotals] = useState(false);
    
    const [availableBrands, setAvailableBrands] = useState<CardBrand[]>([]);
    const [cardValueInput, setCardValueInput] = useState('');
    const [cardTicketInput, setCardTicketInput] = useState('');
    const [cardBrandInput, setCardBrandInput] = useState('');
    const [showBrandManager, setShowBrandManager] = useState(false);
    const [newBrandName, setNewBrandName] = useState('');
 
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
 
    // 🔒 CORREÇÃO 1: Filtrar bandeiras por loja/usuário (se necessário ter bandeiras separadas por loja)
    const fetchBrands = async () => {
        try {
            // ✅ OPÇÃO A: Se bandeiras são GLOBAIS (todas lojas veem as mesmas)
            const { data, error } = await supabase
                .from('financial_card_brands')
                .select('*')
                .order('name', { ascending: true });
 
            // ✅ OPÇÃO B: Se bandeiras são POR LOJA (descomente se for o caso)
            // const { data, error } = await supabase
            //     .from('financial_card_brands')
            //     .select('*')
            //     .eq('store_id', selectedStoreId) // Filtra por loja
            //     .order('name', { ascending: true });
            
            if (error) throw error;
            
            const requiredDefaults = ['VISA DÉBITO', 'VISA CRÉDITO', 'MASTER DÉBITO', 'MASTER CRÉDITO', 'ELO DÉBITO', 'ELO CRÉDITO', 'AMEX', 'HIPERCARD'];
            
            if (data && data.length > 0) {
                // Garantir que as bandeiras solicitadas (Elo e Hipercard) estejam sempre disponíveis
                const existingNames = data.map(b => b.name.toUpperCase());
                const missingDefaults = requiredDefaults.filter(d => !existingNames.includes(d));
                
                const merged = [
                    ...data,
                    ...missingDefaults.map((n, i) => ({ id: `def-${i}`, name: n }))
                ].sort((a, b) => a.name.localeCompare(b.name));
                
                setAvailableBrands(merged);
                if (!cardBrandInput) setCardBrandInput(merged[0].name);
            } else {
                setAvailableBrands(requiredDefaults.map((n, i) => ({ id: i.toString(), name: n })));
                if (!cardBrandInput) setCardBrandInput(requiredDefaults[0]);
            }
        } catch (e) {
            const defaults = ['VISA DÉBITO', 'VISA CRÉDITO', 'MASTER DÉBITO', 'MASTER CRÉDITO', 'ELO DÉBITO', 'ELO CRÉDITO', 'AMEX', 'HIPERCARD'];
            setAvailableBrands(defaults.map((n, i) => ({ id: i.toString(), name: n })));
            if (!cardBrandInput) setCardBrandInput(defaults[0]);
        }
    };
 
    // 🔒 CORREÇÃO 2: CRÍTICA - Filtrar cartões e PIX por loja E data (sem filtro de usuário, pois admin pode ver todos da loja)
    const fetchDailyTotals = async () => {
        if (!selectedStoreId) return;
        setIsLoadingTotals(true);
        try {
            // Busca pagamentos de sorvete
            let iceCreamQuery = supabase
                .from('ice_cream_daily_sales_payments')
                .select('amount, payment_method, ice_cream_sales!inner(store_id, status, created_at)')
                .eq('ice_cream_sales.store_id', selectedStoreId)
                .eq('ice_cream_sales.status', 'completed');

            const { data: iceCreamPayments, error: iceCreamError } = await iceCreamQuery;
 
            if (iceCreamError) throw iceCreamError;
 
            // ✅ CORREÇÃO: Busca lançamentos de cartões filtrados por loja E data E usuário (se não for admin)
            let cardQuery = supabase
                .from('financial_card_sales')
                .select('*')
                .eq('store_id', selectedStoreId)  // ✅ Filtra por loja
                .eq('date', selectedDate);         // ✅ Filtra por data

            if (!isAdmin) {
                cardQuery = cardQuery.eq('user_id', user.id);
            }

            const { data: manualCards, error: cardError } = await cardQuery;
 
            if (cardError) throw cardError;
 
            // ✅ CORREÇÃO: Busca lançamentos de PIX filtrados por loja E data E usuário (se não for admin)
            let pixQuery = supabase
                .from('financial_pix_sales')
                .select('*')
                .eq('store_id', selectedStoreId)  // ✅ Filtra por loja
                .eq('date', selectedDate);         // ✅ Filtra por data

            if (!isAdmin) {
                pixQuery = pixQuery.eq('user_id', user.id);
            }

            const { data: manualPixData, error: pixError } = await pixQuery;
 
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
            showToast("Erro ao carregar dados!", "error");
        } finally {
            setIsLoadingTotals(false);
        }
    };
 
    useEffect(() => {
        fetchBrands();
    }, []);
 
    useEffect(() => {
        if (activeTab === 'cartoes' || activeTab === 'pix') {
            fetchDailyTotals();
        }
    }, [activeTab, selectedDate, selectedStoreId]);
 
    const handleAddBrand = async () => {
        if (!newBrandName.trim()) return;
        const name = newBrandName.toUpperCase().trim();
        setIsSubmitting(true);
        try {
            // ✅ Se bandeiras são POR LOJA, adicione store_id:
            // const { error } = await supabase.from('financial_card_brands').insert([{ name, store_id: selectedStoreId }]);
            
            // ✅ Se bandeiras são GLOBAIS:
            const { error } = await supabase.from('financial_card_brands').insert([{ name }]);
            
            if (error) throw error;
            setNewBrandName('');
            await fetchBrands();
            showToast("Bandeira adicionada!");
        } catch (e: any) { 
            showToast("Erro: " + e.message, "error"); 
        } finally { 
            setIsSubmitting(false); 
        }
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
                } catch (e) { 
                    showToast("Erro ao remover bandeira.", "error"); 
                }
                setConfirmModal(prev => ({ ...prev, isOpen: false }));
            }
        });
    };
 
    const [nextNumber, setNextNumber] = useState(1);
 
    const fetchNextNumber = async () => {
        try {
            const result = await apiService.getNextReceiptNumber();
            setNextNumber(result.next_number);
        } catch (err) {
            console.error('Erro ao buscar próximo número:', err);
            setNextNumber(1);
        }
    };
 
    useEffect(() => {
        fetchNextNumber();
    }, []);
 
    const handleAddCard = async (e: React.FormEvent) => {
        e.preventDefault();
        const val = parseFloat(cardValueInput.replace(',', '.'));
        if (isNaN(val) || val <= 0 || !selectedStoreId) return;
        setIsSubmitting(true);
        try {
            const { error } = await supabase.from('financial_card_sales').insert([{
                store_id: selectedStoreId,
                user_id: user.id,
                user_name: user.name,
                date: selectedDate,
                brand: cardBrandInput,
                value: val,
                sale_code: cardTicketInput || null
            }]);
            if (error) throw error;
            setCardValueInput('');
            setCardTicketInput('');
            await fetchDailyTotals();
            showToast('Lançamento salvo!');
            if (onAddLog) await onAddLog('LANÇAMENTO CARTÃO', `Cartão ${cardBrandInput} ${formatCurrency(val)} na loja ${selectedStoreId}`);
        } catch (e: any) { 
            showToast('Erro: ' + e.message, 'error'); 
        } finally { 
            setIsSubmitting(false); 
        }
    };
 
    // 🔒 CORREÇÃO 3: Autocomplete de Clientes PIX filtrado por loja
    useEffect(() => {
        const timer = setTimeout(async () => {
            if (pixClientInput.length < 2 || !selectedStoreId) {
                setClientSuggestions([]);
                return;
            }
            try {
                // ✅ CORREÇÃO: Filtrar clientes PIX por loja
                const { data, error } = await supabase
                    .from('financial_pix_sales')
                    .select('payer_name')
                    .eq('store_id', selectedStoreId)  // ✅ Filtra por loja
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
    }, [pixClientInput, selectedStoreId]);
 
    // Fechar sugestões ao clicar fora
    useEffect(() => {
        const handleClickOutside = () => setShowSuggestions(false);
        window.addEventListener('click', handleClickOutside);
        return () => window.removeEventListener('click', handleClickOutside);
    }, []);
 
    const handleAddPix = async (e: React.FormEvent) => {
        e.preventDefault();
        const clientName = pixClientInput.trim().toUpperCase();
        if (!clientName) { 
            showToast('Nome do cliente obrigatório.', 'error'); 
            return; 
        }
        const val = parseFloat(pixValueInput.replace(',', '.'));
        if (isNaN(val) || val <= 0 || !selectedStoreId) return;
        setIsSubmitting(true);
        try {
            const { error } = await supabase.from('financial_pix_sales').insert([{
                store_id: selectedStoreId,
                user_id: user.id,
                user_name: user.name,
                date: selectedDate,
                sale_code: pixTicketInput || null,
                value: val,
                payer_name: clientName
            }]);
            if (error) throw error;
            setPixValueInput('');
            setPixTicketInput('');
            setPixClientInput('');
            setClientSuggestions([]);
            await fetchDailyTotals();
            showToast('Pix lançado!');
            if (onAddLog) await onAddLog('LANÇAMENTO PIX', `Pix ${formatCurrency(val)} de ${clientName} na loja ${selectedStoreId}`);
        } catch (e: any) { 
            showToast('Erro: ' + e.message, 'error'); 
        } finally { 
            setIsSubmitting(false); 
        }
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
        } catch (e: any) { 
            showToast("Erro: " + e.message, "error"); 
        } finally { 
            setIsSubmitting(false); 
        }
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
        } catch (e: any) { 
            showToast("Erro: " + e.message, "error"); 
        } finally { 
            setIsSubmitting(false); 
        }
    };
 
    const [errorForm, setErrorForm] = useState({ value: '', reason: '', type: 'shortage' as 'shortage' | 'surplus' });
 
    const handleSaveReceipt = async (e: React.FormEvent) => {
        e.preventDefault();
        const numericVal = parseFloat(receiptForm.value.replace(',', '.')) || 0;
        if (numericVal <= 0 || !receiptForm.recipient || !selectedStoreId) return;
        setIsSubmitting(true);
        try {
            const rData = { 
                storeId: selectedStoreId,
                payer: payerName, 
                recipient: receiptForm.recipient.toUpperCase(), 
                value: numericVal, 
                valueInWords: numberToWords(numericVal).toUpperCase(), 
                reference: receiptForm.reference.toUpperCase(), 
                date: selectedDate 
            };
            const saved = await onAddReceipt(rData);
            printReceiptDoc(saved || rData);
            setReceiptForm({ recipient: '', value: '', reference: '' });
            fetchNextNumber();
            showToast("Recibo emitido!");
        } catch (error) { 
            showToast("Erro ao emitir recibo.", "error"); 
        } finally { 
            setIsSubmitting(false); 
        }
    };
 
    return (
        <div className="flex flex-col h-full bg-gray-50 font-sans overflow-hidden">
            <div className="bg-white px-6 py-4 border-b border-gray-200 flex flex-col md:flex-row justify-between items-center gap-4 shrink-0 shadow-sm">
                <div className="flex flex-col md:flex-row items-center gap-6">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-blue-900 text-white rounded-xl shadow-lg"><DollarSign size={24} /></div>
                        <div><h1 className="text-xl font-black text-blue-950 uppercase italic tracking-tighter">Gestão de Caixa</h1><p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Finanças e Auditoria Rede Real</p></div>
                    </div>
 
                    {can('ALWAYS') && (
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
                        { id: 'quebras', label: 'Quebra', icon: AlertTriangle }
                    ].map(tab => (
                        <button 
                            key={tab.id} 
                            onClick={() => setActiveTab(tab.id as any)} 
                            className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 md:px-6 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all whitespace-nowrap ${
                                activeTab === tab.id 
                                    ? tab.id === 'quebras' 
                                        ? 'bg-red-600 text-white shadow-lg shadow-red-100 border border-red-500' 
                                        : 'bg-white text-blue-900 shadow-md border border-blue-50' 
                                    : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'
                            }`}
                        >
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
                            <div className="absolute top-0 right-0 p-8"><div className="text-center bg-blue-50 px-4 py-2 rounded-2xl border border-blue-100 shadow-sm"><p className="text-[8px] font-black text-blue-400 uppercase tracking-widest mb-1">Próximo</p><p className="text-2xl font-black text-blue-900 leading-none">#{String(nextNumber).padStart(4, '0')}</p></div></div>
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
                                    <button onClick={() => setShowBrandManager(true)} className="p-2 bg-gray-100 text-gray-400 hover:text-blue-600 rounded-xl transition-all shadow-sm" title="Gerenciar Bandeiras"><Settings2 size={16}/></button>
                                </div>
                                <form onSubmit={handleAddCard} className="space-y-4">
                                    <div className="space-y-2">
                                        <label className="text-[9px] font-black text-gray-400 uppercase ml-2">Bandeira / Modalidade</label>
                                        <div className="grid grid-cols-2 gap-1.5">
                                            {availableBrands.map(b => (
                                                <button key={b.id} type="button" onClick={() => setCardBrandInput(b.name)} className={`p-2.5 rounded-xl text-[8px] font-black uppercase transition-all border-2 text-left flex items-center gap-2 ${cardBrandInput === b.name ? 'bg-green-600 border-green-600 text-white shadow-md' : 'bg-gray-50 border-gray-100 text-gray-400 hover:border-gray-200'}`}>
                                                    <CardLogo brandName={b.name} className="w-6 h-6 shrink-0" />
                                                    <span className="truncate">{b.name}</span>
                                                    {cardBrandInput === b.name && <Check size={10} className="ml-auto shrink-0"/>}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[9px] font-black text-gray-400 uppercase ml-2">Número da Ficha</label>
                                        <input value={cardTicketInput} onChange={e => setCardTicketInput(e.target.value)} className="w-full p-4 bg-gray-50 border-none rounded-[20px] font-black text-lg outline-none focus:ring-4 focus:ring-green-500/20" placeholder="0000" />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[9px] font-black text-gray-400 uppercase ml-2">Valor do Comprovante</label>
                                        <input required value={cardValueInput} onChange={e => setCardValueInput(e.target.value)} className="w-full p-4 bg-gray-950 text-white border-none rounded-[20px] font-black text-2xl text-center outline-none focus:ring-4 focus:ring-green-500/20" placeholder="0,00" />
                                    </div>
                                    <button type="submit" disabled={isSubmitting || !selectedStoreId} className="w-full py-4 bg-green-600 text-white rounded-[20px] font-black uppercase text-[10px] shadow-xl active:scale-95 transition-all border-b-4 border-green-800 flex items-center justify-center gap-2 disabled:opacity-50">
                                        {isSubmitting ? <Loader2 className="animate-spin" size={16}/> : <Plus size={16}/>} LANÇAR AGORA
                                    </button>
                                </form>
                            </div>
                            <div className="lg:col-span-8 bg-white rounded-[32px] shadow-xl border border-gray-100 flex flex-col overflow-hidden" style={{minHeight: '500px'}}>
                                <div className="px-6 py-4 border-b flex justify-between items-center bg-gray-50/50">
                                    <div>
                                        <h3 className="text-base font-black text-blue-950 uppercase italic tracking-tighter flex items-center gap-2">
                                            <CreditCard size={16} className="text-blue-600" /> Lançamentos <span className="text-blue-600">Confirmados</span>
                                        </h3>
                                        <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest leading-none mt-1">{new Date(selectedDate + 'T12:00:00').toLocaleDateString('pt-BR')} — Adicione quantos quiser</p>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        {manualCards.length > 0 && (
                                            <button onClick={() => printCardSummaryDoc(selectedDate, payerName, manualCards.map(c => ({brand: c.brand, value: Number(c.value), ticket: c.sale_code})), user.name)} className="p-2 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-600 hover:text-white transition-all flex items-center gap-2 text-[9px] font-black uppercase shadow-sm">
                                                <Printer size={14} /> Imprimir
                                            </button>
                                        )}
                                        <div className="text-right">
                                            <p className="text-[7px] font-black text-gray-400 uppercase leading-none">Total do Dia</p>
                                            <p className="text-xl font-black text-green-700 italic leading-none mt-1">{formatCurrency(manualCards.reduce((a, b) => a + Number(b.value), 0))}</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex-1 overflow-y-auto no-scrollbar overflow-x-auto">
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
                                                    <td className="px-6 py-3">
                                                        <div className="flex items-center gap-2">
                                                            <CardLogo brandName={c.brand} className="w-6 h-6" />
                                                            <span className="uppercase text-blue-950">{c.brand}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-3 text-gray-400 uppercase">{c.user_name}</td>
                                                    <td className="px-6 py-3 text-right text-blue-900 font-black">{formatCurrency(Number(c.value))}</td>
                                                    <td className="px-6 py-3 text-center">
                                                        <div className="flex items-center justify-center gap-2">
                                                            <button onClick={() => setEditingCard(c)} className="p-1 text-blue-300 hover:text-blue-600 transition-all"><Edit3 size={14} /></button>
                                                            <button onClick={() => { setConfirmModal({ isOpen: true, title: 'Excluir', message: 'Excluir este lançamento?', onConfirm: async () => { try { await supabase.from('financial_card_sales').delete().eq('id', c.id); fetchDailyTotals(); showToast('Excluído!'); } catch (e: any) { showToast('Erro: ' + e.message, 'error'); } setConfirmModal(p => ({...p, isOpen: false})); } }); }} className="p-1 text-red-300 hover:text-red-600 transition-all"><Trash2 size={14} /></button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                            {manualCards.length === 0 && (
                                                <tr><td colSpan={5} className="px-6 py-16 text-center">
                                                    <CardIcon size={32} className="mx-auto mb-3 text-gray-200" />
                                                    <p className="text-gray-400 uppercase italic text-[9px] tracking-widest">Nenhum lançamento para esta data</p>
                                                    <p className="text-gray-300 text-[8px] mt-1">Use o formulário ao lado para adicionar</p>
                                                </td></tr>
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
                                <form onSubmit={handleAddPix} className="space-y-4">
                                    <div className="space-y-1">
                                        <label className="text-[9px] font-black text-gray-400 uppercase ml-2">Número da Ficha</label>
                                        <input value={pixTicketInput} onChange={e => setPixTicketInput(e.target.value)} className="w-full p-4 bg-gray-50 border-none rounded-[20px] font-black text-lg outline-none focus:ring-4 focus:ring-teal-500/20" placeholder="0000" />
                                    </div>
                                    <div className="space-y-1 relative" onClick={e => e.stopPropagation()}>
                                        <label className="text-[9px] font-black text-gray-400 uppercase ml-2">Nome do Cliente</label>
                                        <input 
                                            required 
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
                                        <input required value={pixValueInput} onChange={e => setPixValueInput(e.target.value)} className="w-full p-4 bg-gray-950 text-white border-none rounded-[20px] font-black text-2xl text-center outline-none focus:ring-4 focus:ring-teal-500/20" placeholder="0,00" />
                                    </div>
                                    <button type="submit" disabled={isSubmitting || !selectedStoreId} className="w-full py-4 bg-teal-600 text-white rounded-[20px] font-black uppercase text-[10px] shadow-xl active:scale-95 transition-all border-b-4 border-teal-800 flex items-center justify-center gap-2 disabled:opacity-50">
                                        {isSubmitting ? <Loader2 className="animate-spin" size={16}/> : <Plus size={16}/>} LANÇAR AGORA
                                    </button>
                                </form>
                            </div>
                            <div className="lg:col-span-8 bg-white rounded-[32px] shadow-xl border border-gray-100 flex flex-col overflow-hidden" style={{minHeight: '500px'}}>
                                <div className="px-6 py-4 border-b flex justify-between items-center bg-gray-50/50">
                                    <div>
                                        <h3 className="text-base font-black text-blue-950 uppercase italic tracking-tighter flex items-center gap-2">
                                            <DollarSign size={16} className="text-teal-600" /> Lançamentos <span className="text-teal-600">Pix Confirmados</span>
                                        </h3>
                                        <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest leading-none mt-1">{new Date(selectedDate + 'T12:00:00').toLocaleDateString('pt-BR')} — Adicione quantos quiser</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[7px] font-black text-gray-400 uppercase leading-none">Total do Dia</p>
                                        <p className="text-xl font-black text-teal-700 italic leading-none mt-1">{formatCurrency(manualPix.reduce((a, b) => a + Number(b.value), 0))}</p>
                                    </div>
                                </div>
                                <div className="flex-1 overflow-y-auto no-scrollbar overflow-x-auto">
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
                                                    <td className="px-6 py-3 text-blue-950 font-black">#{p.sale_code || '---'}</td>
                                                    <td className="px-6 py-3 text-gray-600 uppercase">{p.payer_name || '---'}</td>
                                                    <td className="px-6 py-3 text-gray-400 uppercase">{p.user_name}</td>
                                                    <td className="px-6 py-3 text-right text-teal-700 font-black">{formatCurrency(Number(p.value))}</td>
                                                    <td className="px-6 py-3 text-center">
                                                        <div className="flex items-center justify-center gap-2">
                                                            <button onClick={() => setEditingPix(p)} className="p-1 text-blue-300 hover:text-blue-600 transition-all"><Edit3 size={14} /></button>
                                                            <button onClick={() => { setConfirmModal({ isOpen: true, title: 'Excluir', message: 'Excluir este lançamento?', onConfirm: async () => { try { await supabase.from('financial_pix_sales').delete().eq('id', p.id); fetchDailyTotals(); showToast('Excluído!'); } catch (e: any) { showToast('Erro: ' + e.message, 'error'); } setConfirmModal(prev => ({...prev, isOpen: false})); } }); }} className="p-1 text-red-300 hover:text-red-600 transition-all"><Trash2 size={14} /></button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                            {manualPix.length === 0 && (
                                                <tr><td colSpan={5} className="px-6 py-16 text-center">
                                                    <DollarSign size={32} className="mx-auto mb-3 text-gray-200" />
                                                    <p className="text-gray-400 uppercase italic text-[9px] tracking-widest">Nenhum lançamento para esta data</p>
                                                    <p className="text-gray-300 text-[8px] mt-1">Use o formulário ao lado para adicionar</p>
                                                </td></tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
 
                {activeTab === 'quebras' && (
                    <CashErrorsModule 
                        user={user}
                        store={stores.find(s => s.id === selectedStoreId)}
                        stores={stores}
                        errors={errors}
                        onAddError={onAddError}
                        onUpdateError={async (e) => { await supabase.from('cash_errors').update(e).eq('id', e.id); }}
                        onDeleteError={onDeleteError}
                        can={can}
                    />
                )}
            </div>
 
            {showBrandManager && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[200] p-4">
                    <div className="bg-white rounded-[40px] w-full max-w-sm shadow-2xl animate-in zoom-in duration-300 border-t-8 border-blue-600 overflow-hidden">
                        <div className="p-6 border-b flex justify-between items-center bg-gray-50/50"><h3 className="text-lg font-black uppercase italic text-blue-950 flex items-center gap-3"><Settings size={20} /> Configurar <span className="text-blue-600">Bandeiras</span></h3><button onClick={() => setShowBrandManager(false)} className="text-gray-400 hover:text-red-600"><X size={24}/></button></div>
                        <div className="p-8 space-y-6">
                            <div className="flex gap-2"><input value={newBrandName} onChange={e => setNewBrandName(e.target.value)} placeholder="NOVA BANDEIRA..." className="flex-1 p-3 bg-gray-50 rounded-xl font-black uppercase text-[10px] outline-none border border-gray-200" /><button onClick={handleAddBrand} disabled={isSubmitting} className="bg-blue-600 text-white p-3 rounded-xl hover:bg-blue-700 transition-all flex items-center justify-center min-w-[48px]">{isSubmitting ? <Loader2 className="animate-spin" size={18} /> : <Plus size={18}/>}</button></div>
                            <div className="space-y-2 max-h-[300px] overflow-y-auto no-scrollbar">
                                {availableBrands.map(b => (
                                    <div key={b.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-xl border border-gray-100 group">
                                        <div className="flex items-center gap-3">
                                            <CardLogo brandName={b.name} className="w-5 h-5" />
                                            <span className="text-[10px] font-black text-gray-700 uppercase">{b.name}</span>
                                        </div>
                                        <button onClick={() => handleDeleteBrand(b.id)} className="text-red-300 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-all"><Trash2 size={14}/></button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}
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