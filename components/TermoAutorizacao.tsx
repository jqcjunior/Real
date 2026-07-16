
import React, { useRef } from 'react';
import { Printer, FileText } from 'lucide-react';
import { Store, User } from '../types';
import { BRAND_LOGO } from '../constants';

interface TermoAutorizacaoProps {
  user: User;
  store?: Store;
}

interface SingleTermProps {
  storeName: string;
  city: string;
}

const SingleTerm: React.FC<SingleTermProps> = ({ storeName, city }) => {
  return (
    <div className="border border-black p-2 flex flex-col justify-between h-full bg-white text-black relative overflow-hidden">
      <div>
        <div className="flex items-center justify-center gap-2 mb-3 border-b border-black pb-1">
             <img src={BRAND_LOGO} alt="Logo" className="h-6 w-6 object-contain rounded-full" />
             <div className="text-center">
                 <h1 className="text-[10px] font-black leading-none uppercase italic">Real <span className="text-red-600">Calçados</span></h1>
                 <h3 className="font-extrabold text-[9px] uppercase leading-none mt-0.5">TERMO AUTORIZAÇÃO</h3>
             </div>
        </div>
        
        <p className="text-[10px] text-justify leading-snug mb-2 font-semibold">
          Autorizo a loja <strong className="uppercase">{storeName} - {city}</strong> lançar as mercadorias que estou levando em condicional no meu crediário, caso eu não compareça na loja para devolução da mesma no prazo descrito abaixo:
        </p>

        <div className="space-y-2 text-[9px] font-bold">
            <div className="flex items-end">
                <span className="whitespace-nowrap mr-1">Ficha do Cliente Nº :</span>
                <div className="flex-1 border-b border-black h-3"></div>
            </div>

            <div className="flex flex-wrap items-end align-bottom">
                <span className="mr-1 whitespace-nowrap">Sendo o prazo de 3 Dias a partir de:</span>
                <div className="flex-1 flex items-end min-w-[100px]">
                    <div className="flex-1 border-b border-black h-3 text-center"></div>
                    <span className="mx-0.5">/</span>
                    <div className="flex-1 border-b border-black h-3 text-center"></div>
                    <span className="mx-0.5">/</span>
                    <div className="flex-1 border-b border-black h-3 text-center"></div>
                    <span>.</span>
                </div>
            </div>

            <div className="flex items-end">
                <span className="whitespace-nowrap mr-1">Lançar em</span>
                <div className="w-16 border-b border-black h-3"></div>
                <span className="ml-1">vezes.</span>
            </div>
        </div>
      </div>

      <div className="mt-2">
          <div className="w-3/4 mx-auto border-t border-black pt-1 text-center text-[8px] font-bold uppercase">
              Assinatura do cliente
          </div>
      </div>
    </div>
  );
};

const TermoAutorizacao: React.FC<TermoAutorizacaoProps> = ({ user, store }) => {
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    if (!printRef.current) return;

    const content = printRef.current.innerHTML;
    const printWindow = window.open('', '_blank', 'width=900,height=1200');
    
    if (!printWindow) {
        alert("Por favor, permita popups para imprimir.");
        return;
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
          <meta charset="UTF-8">
          <title>Termo de Autorização - Condicional</title>
          <script src="https://cdn.tailwindcss.com"></script>
          <style>
              @media print {
                  @page {
                      size: A4 portrait;
                      margin: 0;
                  }
                  body {
                      margin: 0;
                      padding: 0;
                      -webkit-print-color-adjust: exact;
                      height: 100%;
                      overflow: hidden;
                  }
                  #print-container {
                      width: 210mm;
                      height: 297mm;
                      padding: 5mm;
                      box-sizing: border-box;
                      /* Ajuste de escala para garantir que caiba nas margens da impressora */
                      transform: scale(0.96);
                      transform-origin: top center;
                      margin: 0 auto;
                  }
              }
              body {
                  background-color: white;
              }
          </style>
      </head>
      <body>
          <div id="print-container">
            ${content}
          </div>
          <script>
              window.onload = () => {
                  setTimeout(() => {
                      window.print();
                  }, 500);
              };
          </script>
      </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  // Determine Display Data
  const displayStoreName = store ? store.name : "Real Calçados";
  const displayCity = store ? store.city.split(' - ')[0] : "Cidade";

  // Create array of 12 items for the 3x4 grid
  const items = Array.from({ length: 12 });

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      
      {/* Header Controls */}
      <div className="p-6 bg-white shadow-sm border-b border-gray-200 flex justify-between items-center print:hidden">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
            <FileText className="text-blue-600" size={32} />
            Termo de Autorização (Condicional)
          </h2>
          <p className="text-gray-500 mt-1">Imprima os termos para controle de condicional (12 por folha).</p>
        </div>
        <button 
          onClick={handlePrint}
          className="flex items-center gap-2 bg-blue-700 text-white px-6 py-3 rounded-lg font-bold hover:bg-blue-800 shadow-lg transition-all"
        >
          <Printer size={20} /> Imprimir Termos
        </button>
      </div>

      {/* Preview Area */}
      <div className="flex-1 p-8 overflow-auto flex justify-center bg-gray-500 print:p-0 print:bg-white print:block">
        
        {/* A4 Sheet Container */}
        <div 
          ref={printRef}
          className="bg-white shadow-2xl w-[210mm] h-[297mm] mx-auto p-[5mm] box-border print:shadow-none print:w-full print:h-full print:p-0"
        >
            <div className="grid grid-cols-3 grid-rows-4 gap-1 h-full">
                {items.map((_, index) => (
                    <SingleTerm 
                        key={index} 
                        storeName={displayStoreName} 
                        city={displayCity}
                    />
                ))}
            </div>
        </div>
      </div>
    </div>
  );
};

export default TermoAutorizacao;
