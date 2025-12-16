
import React, { useRef } from 'react';
import { Printer, FileSignature } from 'lucide-react';

const AuthorizationForm = () => {
  return (
    <div className="border-2 border-black p-4 bg-white text-black font-sans relative box-border h-[32%] flex flex-col justify-between form-instance">
      {/* Header */}
      <div className="bg-black text-white text-center font-bold uppercase py-1 text-base mb-2 border-2 border-black">
        AUTORIZAÇÃO DE COMPRA
      </div>

      {/* Content */}
      <div className="mb-2">
        <p className="text-xs text-justify leading-snug font-medium px-1">
          <strong className="text-sm">AUTORIZO</strong> a pessoa qualificada abaixo a comprar mercadorias em meu nome no crediário na <strong className="uppercase">Real Calçados</strong>. Declaro que, estando o comprovante de compras devidamente assinado pelo comprador autorizado, assumo <strong>inteira responsabilidade</strong> pelo débito:
        </p>
      </div>

      {/* Manual Input Lines */}
      <div className="space-y-2 text-xs font-bold uppercase flex-1">
        <div className="flex items-end">
          <span className="whitespace-nowrap mr-2 w-10">NOME:</span>
          <div className="flex-1 border-b-2 border-black h-4 bg-gray-50/30"></div>
        </div>

        <div className="flex items-end gap-3">
          <div className="flex items-end flex-[3]">
            <span className="whitespace-nowrap mr-2 w-10">C.P.F:</span>
            <div className="flex-1 border-b-2 border-black h-4 bg-gray-50/30"></div>
          </div>
          <div className="flex items-end flex-[2]">
            <span className="whitespace-nowrap mr-2">RG:</span>
            <div className="flex-1 border-b-2 border-black h-4 bg-gray-50/30"></div>
          </div>
        </div>

        <div className="flex items-end gap-3">
          <div className="flex items-end flex-1">
            <span className="whitespace-nowrap mr-2">NASC.:</span>
            <div className="w-8 border-b-2 border-black h-4 text-center bg-gray-50/30"></div>
            <span className="mx-1">/</span>
            <div className="w-8 border-b-2 border-black h-4 text-center bg-gray-50/30"></div>
            <span className="mx-1">/</span>
            <div className="flex-1 border-b-2 border-black h-4 text-center bg-gray-50/30"></div>
          </div>
          <div className="flex items-end flex-[1.5]">
            <span className="whitespace-nowrap mr-2">PARENTESCO:</span>
            <div className="flex-1 border-b-2 border-black h-4 bg-gray-50/30"></div>
          </div>
        </div>
      </div>

      {/* Signature & Disclaimer */}
      <div className="mt-4 mb-2">
        <div className="w-3/4 mx-auto border-t-2 border-black pt-1 text-center text-[10px] font-bold uppercase">
          Assinatura do Titular do Crediário
        </div>
        <div className="text-[9px] text-justify font-normal mt-1 leading-tight text-gray-800 px-1 italic">
          A presente autorização tem validade por tempo indeterminado, até minha ordem expressa em contrário, por escrito, e torna sem efeito eventuais autorizações anteriores.
        </div>
      </div>

      {/* Footer Grid */}
      <div className="text-[10px] font-bold grid grid-cols-2 gap-x-4 gap-y-1 border-t-2 border-black pt-2">
        {/* Left Col */}
        <div className="space-y-1">
           <div className="flex items-end">
              <span className="whitespace-nowrap mr-2">Data:</span>
              <div className="w-6 border-b-2 border-black h-3"></div>
              <span className="mx-1">/</span>
              <div className="w-6 border-b-2 border-black h-3"></div>
              <span className="mx-1">/</span>
              <div className="flex-1 border-b-2 border-black h-3"></div>
           </div>
           <div className="flex items-center pl-1 mt-1">
              <div className="w-3 h-3 border-2 border-black mr-2"></div>
              <span className="uppercase text-[9px]">Única Compra</span>
           </div>
        </div>

        {/* Right Col */}
        <div className="space-y-1">
            <div className="flex items-end">
                <span className="whitespace-nowrap mr-2">Ficha:</span>
                <div className="flex-1 border-b-2 border-black h-3"></div>
            </div>
            <div className="flex items-center pl-1 mt-1">
              <div className="w-3 h-3 border-2 border-black mr-2"></div>
              <span className="uppercase text-[9px]">Mais de uma Compra</span>
            </div>
        </div>
      </div>
      
      {/* Bottom Row */}
      <div className="mt-1 grid grid-cols-2 gap-4 text-[10px] font-bold">
          <div className="flex items-end">
              <span className="whitespace-nowrap mr-1">Ficha Autorizado:</span>
              <div className="flex-1 border-b-2 border-black h-3"></div>
          </div>
          <div className="flex items-end">
              <span className="whitespace-nowrap mr-1">Crediarista:</span>
              <div className="flex-1 border-b-2 border-black h-3"></div>
          </div>
      </div>
    </div>
  );
};

const PurchaseAuthorization: React.FC = () => {
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
          <title>Autorização de Compra</title>
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
                  }
              }
              html, body {
                  width: 210mm;
                  height: 297mm;
                  background-color: white;
                  margin: 0;
                  padding: 0;
                  -webkit-print-color-adjust: exact;
                  print-color-adjust: exact;
              }
              .page-container {
                  width: 210mm;
                  height: 296mm; /* 297mm minus tiny buffer */
                  padding: 8mm 12mm; /* Safe print margins */
                  box-sizing: border-box;
                  display: flex;
                  flex-direction: column;
                  justify-content: space-between;
                  overflow: hidden;
                  /* Slight zoom to ensure it fits perfectly within print borders */
                  zoom: 0.98;
              }
              
              /* Override element styles for print perfection */
              .form-instance {
                  height: auto !important;
                  flex: 1;
                  margin-bottom: 0;
                  border-width: 1px !important;
              }
              
              .separator {
                  margin: 4mm 0;
                  flex: 0 0 auto;
                  border-top: 1px dashed #999;
                  height: 1px;
                  width: 100%;
                  opacity: 0.5;
              }
              
              /* Force clean backgrounds */
              * {
                  print-color-adjust: exact !important;
                  -webkit-print-color-adjust: exact !important;
              }
          </style>
      </head>
      <body>
          <div class="page-container">
              ${content}
          </div>
          <script>
              window.onload = () => {
                  setTimeout(() => {
                      window.print();
                  }, 600);
              };
          </script>
      </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      
      {/* Header Controls */}
      <div className="p-6 bg-white shadow-sm border-b border-gray-200 flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
            <FileSignature className="text-blue-600" size={32} />
            Autorização de Compra
          </h2>
          <p className="text-gray-500 mt-1">Imprima o formulário para preenchimento manual (3 vias por página).</p>
        </div>
        <button 
          onClick={handlePrint}
          className="flex items-center gap-2 bg-blue-700 text-white px-6 py-3 rounded-lg font-bold hover:bg-blue-800 shadow-lg transition-all"
        >
          <Printer size={20} /> Imprimir Autorização
        </button>
      </div>

      {/* Preview Area */}
      <div className="flex-1 p-8 overflow-auto flex justify-center bg-gray-500">
        
        {/* A4 Sheet Container (Source for Print) */}
        <div 
          ref={printRef}
          className="bg-white shadow-2xl p-[5mm] w-[210mm] h-[297mm] flex flex-col justify-between"
          style={{ boxSizing: 'border-box' }}
        >
            <AuthorizationForm />
            
            <div className="separator border-t-2 border-dashed border-gray-300 w-full"></div>
            
            <AuthorizationForm />
            
            <div className="separator border-t-2 border-dashed border-gray-300 w-full"></div>
            
            <AuthorizationForm />

        </div>
      </div>
    </div>
  );
};

export default PurchaseAuthorization;
