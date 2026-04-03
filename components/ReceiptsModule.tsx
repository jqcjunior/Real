import React, { useState, useEffect, useMemo } from 'react';
import { User, Store, Receipt } from '../types';
import { formatCurrency, BRAND_LOGO } from '../constants';
import { Printer, FileText, PenTool } from 'lucide-react';
import apiService from '../services/apiService';

interface ReceiptsModuleProps {
  user: User;
  stores: Store[];
  receipts: Receipt[];
  onAddReceipt: (receipt: any) => Promise<any>;
}

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
    
    if (integerPart > 0) {
        if (integerPart === 1) text += "um real";
        else if (integerPart < 1000) text += convertGroup(integerPart) + " reais";
        else if (integerPart < 1000000) {
            const mil = Math.floor(integerPart / 1000);
            const rest = integerPart % 1000;
            text += (mil === 1 ? "um mil" : convertGroup(mil) + " mil");
            if (rest > 0) text += (rest < 100 || rest % 100 === 0 ? " e " : ", ") + convertGroup(rest);
            text += " reais";
        }
    }
    
    if (decimalPart > 0) {
        if (integerPart > 0) text += " e ";
        text += convertGroup(decimalPart) + (decimalPart === 1 ? " centavo" : " centavos");
    }
    
    return text;
};

const ReceiptsModule: React.FC<ReceiptsModuleProps> = ({ user, stores, receipts, onAddReceipt }) => {
  const userStore = useMemo(() => stores.find(s => s.id === user.storeId), [stores, user.storeId]);
  
  const [nextNumber, setNextNumber] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  
  const [receiptData, setReceiptData] = useState({
      value: '',
      payer: '',
      recipient: '',
      date: new Date().toISOString().split('T')[0],
      reference: 'pagamento de serviços'
  });

  useEffect(() => {
      if (userStore) {
          setReceiptData(prev => ({
              ...prev,
              payer: `REAL CALÇADOS LOJA ${userStore.number} ${userStore.city?.split(' - ')[0] || ''}`.toUpperCase()
          }));
      }
  }, [userStore]);

  // ✅ Buscar próximo número usando a função do backend
  useEffect(() => {
      async function fetchNextNumber() {
          try {
              const result = await apiService.getNextReceiptNumber();
              setNextNumber(result.next_number);
          } catch (err) {
              console.error('Erro ao buscar próximo número:', err);
              setNextNumber(1);
          }
      }
      
      fetchNextNumber();
  }, []);

  const receiptValueNum = parseFloat(receiptData.value.replace(/\./g, '').replace(',', '.')) || 0;
  const valueInWords = numberToWords(receiptValueNum);
  const city = userStore?.city?.split(' - ')[0] || 'Cidade';
  const formattedNumber = String(nextNumber).padStart(4, '0');

  const printReceipt = (receipt: any, receiptNumber: string) => {
      const printWindow = window.open('', '_blank', 'width=900,height=1200');
      if (!printWindow) return;

      const [y, m, d] = receipt.receipt_date.split('-').map(Number);
      const dateObj = new Date(y, m - 1, d);
      const formattedDate = dateObj.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });
      const formattedValue = formatCurrency(receipt.value);

      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <script src="https://cdn.tailwindcss.com"></script>
            <style>
                @page { size: A4 portrait; margin: 0; }
                body { margin: 0; padding: 0; background: white; font-family: 'Times New Roman', serif; }
                .receipt-page { width: 210mm; height: 148.5mm; padding: 10mm; box-sizing: border-box; display: flex; justify-content: center; }
                .receipt-box { width: 190mm; height: 132mm; border: 4px double #000; padding: 8mm; box-sizing: border-box; display: flex; flex-direction: column; }
                .header-line { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #000; padding-bottom: 4mm; margin-bottom: 6mm; }
                .value-display { border: 2px solid #000; background: #f1f5f9; padding: 2mm 8mm; font-size: 26pt; font-weight: 900; font-style: italic; font-family: sans-serif; }
                .clause { text-align: center; font-size: 10pt; font-style: italic; color: #000; margin: 4mm 0; line-height: 1.4; font-weight: 600; padding: 0 10mm; }
                .handwritten { font-weight: bold; border-bottom: 1px dotted #000; text-transform: uppercase; padding-bottom: 1px; }
            </style>
        </head>
        <body>
            <div class="receipt-page">
                <div class="receipt-box">
                    <div class="header-line">
                        <div class="flex items-center gap-4">
                            <img src="${BRAND_LOGO}" style="height: 65px; width: auto;" />
                            <div>
                                <h1 class="text-3xl font-black uppercase italic leading-none tracking-tighter">Real <span class="text-red-600">Calçados</span></h1>
                                <p class="text-[10px] font-bold uppercase tracking-[0.3em] mt-1 text-gray-500">Gestão de Finanças Corporativas</p>
                            </div>
                        </div>
                        <div class="text-right">
                            <div class="text-2xl font-black text-gray-300">RECIBO Nº <span class="text-red-600">${receiptNumber}</span></div>
                            <div class="value-display mt-2">${formattedValue}</div>
                        </div>
                    </div>
                    <div class="flex-1 space-y-4 text-xl text-gray-900">
                        <p>Recebi(emos) de <span class="handwritten inline-block min-w-[130mm]">${receipt.payer}</span></p>
                        <div class="leading-relaxed">A quantia de <span class="handwritten italic bg-gray-50 border-b border-gray-200 block w-full px-4 py-1.5 mt-2 text-lg uppercase min-h-[1.2em]">${receipt.value_in_words}</span></div>
                        <p>Referente a <span class="handwritten inline-block min-w-[145mm]">${receipt.reference}</span>.</p>
                    </div>
                    <div class="clause">
                        "E para maior clareza firmo o presente recibo para que produza os seus efeitos, dando plena, rasa e irrevogável quitação, pelo valor recebido e descrito neste termo."
                    </div>
                    <div class="mt-auto flex justify-between items-end pt-4">
                        <div class="text-lg font-bold pb-2">${city}, ${formattedDate}</div>
                        <div class="w-[90mm] text-center">
                            <div class="border-t-2 border-black pt-2 mt-8">
                                <p class="font-bold uppercase text-lg leading-none mb-1">${receipt.recipient}</p>
                                <p class="text-[10px] uppercase font-bold text-gray-500 tracking-widest">Assinatura do Recebedor</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <script>window.onload = function() { setTimeout(function() { window.print(); window.close(); }, 800); }</script>
        </body>
        </html>
      `;
      printWindow.document.write(htmlContent); 
      printWindow.document.close();
  };

  // ✅ NOVA FUNÇÃO: Usa o backend do Supabase
  const handlePrintAndSave = async () => {
      if (receiptValueNum <= 0 || !receiptData.payer || !receiptData.recipient) {
          alert("Preencha todos os campos obrigatórios."); 
          return;
      }

      setIsLoading(true);

      try {
          // Criar recibo usando a função centralizada no App.tsx
          const savedReceipt = await onAddReceipt({
              payer: receiptData.payer,
              recipient: receiptData.recipient,
              value: receiptValueNum,
              valueInWords: valueInWords.toUpperCase(),
              reference: receiptData.reference,
              date: receiptData.date
          });

          // Imprimir
          printReceipt(savedReceipt, savedReceipt.formatted_number);

          // Atualizar próximo número
          setNextNumber(savedReceipt.receipt_number + 1);
          
          // Limpar formulário
          setReceiptData(prev => ({ 
              ...prev, 
              value: '', 
              recipient: '', 
              reference: 'pagamento de serviços' 
          }));

          alert(`✅ Recibo #${savedReceipt.formatted_number} salvo com sucesso!`);

      } catch (error: any) {
          console.error('Erro ao salvar recibo:', error);
          alert(`❌ Erro ao salvar recibo: ${error.message || 'Erro desconhecido'}`);
      } finally {
          setIsLoading(false);
      }
  };

  return (
    <div className="p-6 md:p-8 max-w-[1600px] mx-auto min-h-screen flex flex-col">
        <div className="flex flex-col md:flex-row justify-between items-center mb-8">
            <div>
                <h2 className="text-3xl font-bold text-gray-800 flex items-center gap-3"><FileText className="text-blue-600" size={32} /> Emissão de Recibos</h2>
                <p className="text-gray-500 mt-1">Preencha os dados abaixo para gerar o documento (Padrão Meia A4).</p>
            </div>
            <div className="bg-white px-4 py-2 rounded-lg border border-gray-200 shadow-sm text-center">
                <p className="text-xs text-gray-500 uppercase font-bold">Próximo Recibo</p>
                <p className="text-2xl font-black text-red-600">#{formattedNumber}</p>
            </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-8">
            <div className="w-full lg:w-1/3 bg-white p-6 rounded-xl shadow-sm border border-gray-200 h-fit">
                <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2"><PenTool size={18} className="text-blue-600"/> Dados do Recibo</h3>
                <div className="space-y-4">
                    <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Valor (R$)</label><input value={receiptData.value} onChange={e => setReceiptData({...receiptData, value: e.target.value})} placeholder="0,00" className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-bold text-white text-lg" /></div>
                    <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Pagador (Automático)</label><input value={receiptData.payer} onChange={e => setReceiptData({...receiptData, payer: e.target.value})} className="w-full p-3 bg-gray-100 border border-gray-200 rounded-lg outline-none text-gray-800 font-bold uppercase" /></div>
                    <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nome do Recebedor</label><input value={receiptData.recipient} onChange={e => setReceiptData({...receiptData, recipient: e.target.value})} placeholder="Favorecido" className="w-full p-3 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-medium text-gray-900" /></div>
                    <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Referente a</label><input value={receiptData.reference} onChange={e => setReceiptData({...receiptData, reference: e.target.value})} placeholder="Ex: Prestação de serviços" className="w-full p-3 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-gray-900" /></div>
                    <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Data</label><input type="date" value={receiptData.date} onChange={e => setReceiptData({...receiptData, date: e.target.value})} className="w-full p-3 bg-gray-50 border border-gray-300 rounded-lg outline-none" /></div>
                    <button 
                        onClick={handlePrintAndSave} 
                        disabled={isLoading}
                        className="w-full mt-4 bg-blue-900 text-white py-4 rounded-lg font-bold hover:bg-black transition-colors flex items-center justify-center gap-2 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed">
                        <Printer size={18} /> 
                        {isLoading ? 'Salvando...' : 'Salvar e Imprimir (A5 Profissional)'}
                    </button>
                </div>
            </div>

            <div className="flex-1 flex justify-center items-start overflow-hidden bg-gray-200 p-8 rounded-3xl">
                <div className="w-full max-w-[700px] bg-white p-8 border-[8px] border-double border-black shadow-2xl scale-90 origin-top relative font-serif aspect-[1.414/1]">
                    <div className="relative z-10">
                        <div className="flex justify-between items-center mb-8 border-b-2 border-black pb-4">
                            <div className="flex items-center gap-4">
                                <img src={BRAND_LOGO} alt="Logo" className="h-16 w-auto object-contain" />
                                <div><div className="text-2xl font-black text-gray-900 uppercase italic tracking-tighter leading-none">Real <span className="text-red-600">Calçados</span></div><p className="text-[8px] text-gray-500 font-black uppercase tracking-[0.2em] mt-1">Recibo Oficial de Quitação</p></div>
                            </div>
                            <div className="text-right">
                                <h2 className="text-3xl font-black text-gray-200 uppercase leading-none">RECIBO</h2>
                                <p className="text-xs font-bold text-red-600">Nº {formattedNumber}</p>
                                <div className="text-2xl font-bold text-gray-900 mt-2 border-2 border-black px-4 py-1 bg-gray-50 inline-block italic">{formatCurrency(receiptValueNum)}</div>
                            </div>
                        </div>
                        <div className="space-y-8 text-gray-900 text-lg leading-relaxed">
                            <p>Recebi(emos) de <span className="font-bold border-b-2 border-dotted border-black px-2 min-w-[200px] inline-block uppercase italic">{receiptData.payer || '_______________________'}</span></p>
                            <p>a quantia de <span className="font-bold italic bg-gray-50 px-3 py-1 border border-gray-200 shadow-sm block w-full mt-2 text-gray-800 text-sm uppercase leading-tight">{valueInWords || 'ZERO REAIS'}</span></p>
                            <p>referente a <span className="border-b-2 border-dotted border-black px-2 min-w-[250px] inline-block italic">{receiptData.reference}</span>.</p>
                            <div className="py-4 text-center text-[9pt] leading-tight text-gray-700 italic border-y border-gray-100 font-serif px-8">"E para maior clareza firmo o presente recibo para que produza os seus efeitos, dando plena, rasa e irrevogável quitação, pelo valor recebido e descrito neste termo."</div>
                        </div>
                        <div className="mt-12 flex justify-between items-end">
                            <p className="text-base font-bold text-gray-800">{city}, {new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                            <div className="border-t-2 border-black w-[80mm] text-center pt-2">
                                <p className="font-bold uppercase text-base text-black leading-none">{receiptData.recipient || '___________________'}</p>
                                <p className="font-bold uppercase tracking-widest text-[8px] text-gray-400 mt-1">Assinatura do Recebedor</p>
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
