
import React, { useState } from 'react';
import { User, Store, Receipt } from '../types';
import { formatCurrency } from '../constants';
import { Printer, FileText, PenTool } from 'lucide-react';

interface ReceiptsModuleProps {
  user: User;
  store?: Store;
  receipts: Receipt[];
  onAddReceipt: (receipt: Receipt) => void;
  nextReceiptNumber: number;
}

// --- HELPER: Number to Words (PT-BR) ---
const numberToWords = (value: number): string => {
    if (value === 0) return "zero reais";

    const unidades = ["", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove"];
    const dez_vinte = ["dez", "onze", "doze", "treze", "quatorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove"];
    const dezenas = ["", "dez", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"];
    const centenas = ["", "cento", "duzentos", "trezentos", "quatrocentos", "quinhentos", "seiscentos", "setecentos", "oitocentos", "novecentos"];

    const convertGroup = (n: number): string => {
        if (n < 10) return unidades[n];
        if (n < 20) return dez_vinte[n - 10];
        if (n < 100) {
            const u = n % 10;
            const d = Math.floor(n / 10);
            return dezenas[d] + (u > 0 ? " e " + unidades[u] : "");
        }
        if (n === 100) return "cem";
        if (n < 1000) {
            const c = Math.floor(n / 100);
            const rest = n % 100;
            return centenas[c] + (rest > 0 ? " e " + convertGroup(rest) : "");
        }
        return "";
    };

    const integerPart = Math.floor(value);
    const decimalPart = Math.round((value - integerPart) * 100);

    let text = "";

    // Integer part
    if (integerPart > 0) {
        if (integerPart === 1) text += "um real";
        else if (integerPart < 1000) text += convertGroup(integerPart) + " reais";
        else if (integerPart < 1000000) {
            const mil = Math.floor(integerPart / 1000);
            const rest = integerPart % 1000;
            text += (mil === 1 ? "um mil" : convertGroup(mil) + " mil");
            if (rest > 0) {
                text += (rest < 100 || rest % 100 === 0 ? " e " : ", ") + convertGroup(rest);
            }
            text += " reais";
        } else {
            text += "Valor muito alto"; 
        }
    }

    // Decimal part
    if (decimalPart > 0) {
        if (integerPart > 0) text += " e ";
        text += convertGroup(decimalPart) + (decimalPart === 1 ? " centavo" : " centavos");
    }

    return text;
};

const ReceiptsModule: React.FC<ReceiptsModuleProps> = ({ user, store, receipts, onAddReceipt, nextReceiptNumber }) => {
  // --- RECEIPT FORM STATE ---
  const [receiptData, setReceiptData] = useState({
      value: '',
      payer: store ? `Real Calçados - ${store.city}` : '', // Default to store name if available
      recipient: '',
      date: new Date().toISOString().split('T')[0],
      reference: 'pagamento de serviços'
  });

  const receiptValueNum = parseFloat(receiptData.value.replace(/\./g, '').replace(',', '.')) || 0;
  const valueInWords = numberToWords(receiptValueNum);
  const city = store?.city.split(' - ')[0] || 'Cidade';
  
  // Format Receipt Number (e.g. 0001)
  const formattedNumber = String(nextReceiptNumber).padStart(4, '0');

  // --- PRINT FUNCTION (18cm x 12cm) ---
  const printReceipt = (receipt: Receipt, receiptNumber: string) => {
      const printWindow = window.open('', '_blank', 'width=800,height=600');
      if (!printWindow) {
          alert("Permita pop-ups para imprimir o recibo.");
          return;
      }

      // Use root path which works in most development environments
      const logoUrl = window.location.origin + '/logo.png';
      const cityPrint = store?.city.split(' - ')[0] || 'Cidade';
      
      // FIX: Date parsing to avoid timezone shift. Treat as YYYY-MM-DD literal.
      const [y, m, d] = receipt.date.split('-').map(Number);
      // Construct date using local time arguments (Month is 0-indexed)
      const dateObj = new Date(y, m - 1, d);
      const formattedDate = dateObj.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });
      
      const formattedValue = formatCurrency(receipt.value);

      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Recibo #${receiptNumber}</title>
            <script src="https://cdn.tailwindcss.com"></script>
            <style>
                @page { 
                    size: portrait;
                    margin: 0; 
                }
                body { 
                    margin: 0; 
                    padding: 10mm; /* Padding to position on A4 */
                    background: white; 
                    font-family: 'Times New Roman', serif;
                    -webkit-print-color-adjust: exact;
                }
                .custom-page {
                    width: 180mm;
                    height: 120mm;
                    /* Removed margin auto to fit top-left context */
                    position: relative;
                    box-sizing: border-box;
                    display: flex;
                    flex-direction: column;
                    justify-content: space-between;
                    /* border: 1px solid #ccc; removed outer helper border for clean print */
                }
                .handwritten {
                    font-family: 'Courier New', Courier, monospace;
                    font-weight: bold;
                    letter-spacing: 0px;
                }
            </style>
        </head>
        <body>
            <div class="custom-page">
                
                <!-- BORDER CONTAINER -->
                <div class="border-2 border-double border-gray-800 h-full p-4 flex flex-col justify-between relative bg-white">
                    
                    <!-- Background Texture -->
                    <div class="absolute inset-0 opacity-5 pointer-events-none z-0" style="background-image: url('https://www.transparenttextures.com/patterns/cream-paper.png');"></div>

                    <div class="relative z-10 flex flex-col h-full">
                        <!-- HEADER -->
                        <div class="w-full flex justify-between items-center mb-2 border-b border-gray-800 pb-2">
                            <div class="flex items-center gap-3">
                                <img src="${logoUrl}" alt="Real Calçados" style="height: 80px; width: auto; object-fit: contain;" />
                                <div>
                                    <h1 class="text-xl font-black text-gray-900 tracking-tighter uppercase italic leading-none">Real <span class="text-red-600">Calçados</span></h1>
                                    <p class="text-[9px] text-gray-600 mt-0.5 font-bold">Comprovante de Pagamento</p>
                                </div>
                            </div>
                            <div class="text-right">
                                <div class="flex items-center justify-end gap-2">
                                    <h2 class="text-xl font-black text-gray-400 uppercase tracking-widest leading-none">RECIBO</h2>
                                    <p class="text-sm font-bold text-red-600 leading-none">Nº ${receiptNumber}</p>
                                </div>
                                <div class="mt-1 border border-gray-300 rounded px-2 py-1 bg-gray-50 inline-block">
                                    <span class="text-[10px] font-bold text-gray-500 mr-2">VALOR</span>
                                    <span class="text-lg font-bold text-gray-900 handwritten leading-none">${formattedValue}</span>
                                </div>
                            </div>
                        </div>

                        <!-- BODY -->
                        <div class="w-full space-y-2 text-gray-800 text-sm flex-1">
                            <p class="leading-tight">
                                Recebi(emos) de <span class="font-bold border-b border-dotted border-gray-400 px-2 inline-block min-w-[150px] handwritten text-black text-xs">${receipt.payer}</span>
                            </p>
                            <p class="leading-tight">
                                a quantia de <span class="font-bold italic bg-gray-100 px-2 py-0.5 rounded border border-gray-200 uppercase text-[10px] text-gray-900 tracking-wide">${receipt.valueInWords}</span>
                            </p>
                            <p class="leading-tight">
                                referente a <span class="border-b border-dotted border-gray-400 px-2 font-medium handwritten text-black text-xs">${receipt.reference}</span>.
                            </p>
                            
                            <div className="mt-2 text-center text-[10px] leading-tight text-gray-600 italic font-serif">
                                "E para maior clareza firmo o presente recibo para que produza os seus efeitos, dando plena, rasa e irrevogável quitação, pelo valor recebido e descrito neste termo."
                            </div>
                        </div>

                        <!-- FOOTER -->
                        <div class="w-full mt-2 flex flex-col items-center justify-center text-center">
                            <div class="text-gray-800 font-medium mb-6 text-xs">
                                ${cityPrint}, ${formattedDate}
                            </div>
                            
                            <div class="w-3/4 border-t border-black pt-1">
                                <p class="font-bold text-black uppercase text-sm leading-none">${receipt.recipient}</p>
                                <p class="text-[8px] text-gray-500 uppercase font-bold tracking-wider mt-0.5">Recebedor / Assinatura</p>
                            </div>
                        </div>
                    </div>
                
                </div>

            </div>
            <script>
                // Auto print after small delay to ensure image loads
                window.onload = function() {
                    setTimeout(function() {
                        window.print();
                    }, 800); // Increased delay slightly for logo load
                }
            </script>
        </body>
        </html>
      `;

      printWindow.document.write(htmlContent);
      printWindow.document.close();
  };

  const handlePrintAndSave = () => {
      if (receiptValueNum <= 0 || !receiptData.payer || !receiptData.recipient) {
          alert("Preencha todos os campos (Valor, Sua Empresa e Recebedor).");
          return;
      }

      // Save to History
      const newReceipt: Receipt = {
          id: formattedNumber, // Store the number ID
          storeId: user.storeId,
          issuerName: user.name, // The system user who created it
          payer: receiptData.payer, // The company paying
          recipient: receiptData.recipient, // The person receiving
          value: receiptValueNum,
          valueInWords: valueInWords,
          reference: receiptData.reference,
          date: receiptData.date,
          createdAt: new Date()
      };

      onAddReceipt(newReceipt);
      
      // Trigger Print in new window
      printReceipt(newReceipt, formattedNumber);
      
      // Reset form somewhat
      setReceiptData(prev => ({ 
          ...prev, 
          value: '', 
          recipient: '', 
          reference: 'pagamento de serviços' 
      }));
  };

  return (
    <div className="p-6 md:p-8 max-w-[1600px] mx-auto min-h-screen flex flex-col">
        
        {/* HEADER */}
        <div className="flex flex-col md:flex-row justify-between items-center mb-8">
            <div>
                <h2 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
                    <FileText className="text-blue-600" size={32} />
                    Emissão de Recibos
                </h2>
                <p className="text-gray-500 mt-1">Preencha os dados abaixo para gerar o documento.</p>
            </div>
            <div className="bg-white px-4 py-2 rounded-lg border border-gray-200 shadow-sm text-center">
                <p className="text-xs text-gray-500 uppercase font-bold">Próximo Recibo</p>
                <p className="text-2xl font-black text-red-600">#{formattedNumber}</p>
            </div>
        </div>

        {/* --- GENERATOR --- */}
        <div className="flex flex-col lg:flex-row gap-8">
            {/* Controls */}
            <div className="w-full lg:w-1/3 bg-white p-6 rounded-xl shadow-sm border border-gray-200 h-fit">
                <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                    <PenTool size={18} className="text-blue-600"/> Dados do Recibo
                </h3>
                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Valor (R$)</label>
                        <input 
                            value={receiptData.value}
                            onChange={e => setReceiptData({...receiptData, value: e.target.value})}
                            placeholder="0,00"
                            className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-bold text-white text-lg placeholder-gray-500"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Sua Empresa (Pagador)</label>
                        <input 
                            value={receiptData.payer}
                            onChange={e => setReceiptData({...receiptData, payer: e.target.value})}
                            placeholder="Ex: Real Calçados..."
                            className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-white placeholder-gray-500"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nome do Recebedor (Quem recebe)</label>
                        <input 
                            value={receiptData.recipient}
                            onChange={e => setReceiptData({...receiptData, recipient: e.target.value})}
                            placeholder="Nome de quem vai assinar"
                            className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-medium text-white placeholder-gray-500"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Referente a</label>
                        <input 
                            value={receiptData.reference}
                            onChange={e => setReceiptData({...receiptData, reference: e.target.value})}
                            placeholder="Ex: Prestação de serviços"
                            className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-white placeholder-gray-500"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Data</label>
                        <input 
                            type="date"
                            value={receiptData.date}
                            onChange={e => setReceiptData({...receiptData, date: e.target.value})}
                            className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-white [color-scheme:dark]"
                        />
                    </div>
                    <button 
                        onClick={handlePrintAndSave}
                        className="w-full mt-4 bg-gray-800 text-white py-3 rounded-lg font-bold hover:bg-black transition-colors flex items-center justify-center gap-2 shadow-lg"
                    >
                        <Printer size={18} /> Salvar e Imprimir (PDF)
                    </button>
                </div>
                <div className="mt-6 bg-blue-50 p-4 rounded-lg border border-blue-100 text-xs text-blue-800">
                    <p><strong>Nota:</strong> O nome inserido no campo "Recebedor" aparecerá na linha de assinatura.</p>
                </div>
            </div>

            {/* VISUAL PREVIEW (Static - Just for user confirmation, not for print) */}
            <div className="flex-1 flex justify-center items-start overflow-hidden">
                <div className="w-full max-w-[650px] bg-[#fffdf5] p-8 border-4 border-double border-gray-300 shadow-xl scale-95 origin-top relative">
                    {/* Texture effect */}
                    <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'url("https://www.transparenttextures.com/patterns/cream-paper.png")' }}></div>
                    
                    <div className="relative z-10">
                        <div className="flex justify-between items-center mb-8 border-b-2 border-gray-800 pb-4">
                            <div className="flex items-center gap-3">
                                {/* Preview Logo Size Adjusted */}
                                <img src="/logo.png" alt="Logo" className="h-16 object-contain" />
                                <div>
                                    <div className="text-2xl font-black text-gray-900 uppercase italic tracking-tighter">Real <span className="text-red-600">Calçados</span></div>
                                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Comprovante de Pagamento</p>
                                </div>
                            </div>
                            <div className="text-right">
                                <h2 className="text-3xl font-black text-gray-400 uppercase tracking-widest">RECIBO</h2>
                                <p className="text-sm font-bold text-red-600">Nº {formattedNumber}</p>
                                <div className="text-2xl font-mono font-bold text-gray-900 mt-1 border-2 border-gray-300 px-2 bg-white inline-block">{formatCurrency(receiptValueNum)}</div>
                            </div>
                        </div>
                        
                        <div className="space-y-6 text-gray-800 text-base font-serif leading-relaxed">
                            <p>
                                Recebi(emos) de <span className="font-bold border-b border-gray-400 px-1 font-mono text-lg">{receiptData.payer || '_________________'}</span>
                            </p>
                            <p>
                                a quantia de <span className="font-bold italic bg-white px-2 py-1 border border-gray-200 shadow-sm block w-full mt-1 text-gray-600">{valueInWords || 'ZERO REAIS'}</span>
                            </p>
                            <p>
                                referente a <span className="border-b border-gray-400 px-1 font-mono">{receiptData.reference}</span>.
                            </p>
                            
                            <div className="mt-4 text-center text-xs leading-tight text-gray-600 italic font-serif">
                                "E para maior clareza firmo o presente recibo para que produza os seus efeitos, dando plena, rasa e irrevogável quitação, pelo valor recebido e descrito neste termo."
                            </div>
                        </div>

                        <div className="mt-12 text-center text-xs">
                            <p className="mb-8 font-mono">{city}, {new Date().toLocaleDateString('pt-BR')}</p>
                            <div className="border-t border-black w-2/3 mx-auto pt-2">
                                <p className="font-bold uppercase text-base text-black">{receiptData.recipient || '___________________'}</p>
                                <p className="font-bold uppercase tracking-wider text-gray-500">Recebedor / Assinatura</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
  );
};

export default ReceiptsModule;
