
import React, { useState, useMemo } from 'react';
import { User, UserRole } from '../types';
import { X, FileSpreadsheet, DollarSign, ChevronRight, Loader2, Download, Package, ArrowLeft, Send, CheckCircle2, Building2, Layers } from 'lucide-react';
import * as XLSX from 'xlsx';
import { formatCurrency } from '../constants';

interface SpreadsheetOrderModuleProps {
  user: User;
  onClose: () => void;
}

// Definição de Grades (15-49 + P, M, G, GG)
const SIZE_LABELS = [
  '15', '16', '17', '18', '19', '20', '21', '22', '23', '24', '25', '26', '27', '28', '29', '30', '31', '32', '33', '34', '35', '36', '37', '38', '39', '40', '41', '42', '43', '44', '45', '46', '47', '48', '49', 
  'P', 'M', 'G', 'GG'
];

const SpreadsheetOrderModule: React.FC<SpreadsheetOrderModuleProps> = ({ user, onClose }) => {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [isExporting, setIsExporting] = useState(false);

  // Step 1: Cabeçalho (Header)
  const [headerData, setHeaderData] = useState({
    provider: '',
    brand: '',
    billingDate: new Date().toISOString().split('T')[0],
    deadlineDate: new Date().toISOString().split('T')[0],
    discount: '0',
    markup: '2.6',
    collection: 'Verão'
  });

  // Step 2: Detalhes do Item
  const [itemData, setItemData] = useState({
    ref: '',
    type: 'SAPATO',
    model: '',
    color1: '',
    color2: '',
    color3: '',
    cost: '0'
  });

  // Step 3: Grade e Lojas
  const [grade, setGrade] = useState<Record<string, number>>({});
  const [selectedStores, setSelectedStores] = useState<number[]>([]);

  // Regra de Cálculo OBRIGATÓRIA
  const suggestedPrice = useMemo(() => {
    const cost = parseFloat(String(itemData.cost).replace(',', '.')) || 0;
    const disc = parseFloat(String(headerData.discount).replace(',', '.')) || 0;
    const mkp = parseFloat(String(headerData.markup).replace(',', '.')) || 1;
    
    if (cost <= 0) return 0;
    
    const custoFinal = cost - (cost * disc / 100);
    const valorBase = custoFinal * mkp;
    
    // Arredondar para terminar em 9,99 (Ex: 130.00 -> 129.99)
    return Math.floor(valorBase - 0.01) + 0.99;
  }, [itemData.cost, headerData.discount, headerData.markup]);

  const totalPairsPerStore = useMemo(() => {
    // Fix: Explicitly type acc and val as numbers to avoid "unknown" type errors in reduce
    return Object.values(grade).reduce((acc: number, val: number) => acc + (val || 0), 0);
  }, [grade]);

  const totalOrderPairs = useMemo(() => {
    return totalPairsPerStore * selectedStores.length;
  }, [totalPairsPerStore, selectedStores]);

  const handleFinalize = async () => {
    if (user.role === UserRole.ADMIN) {
      handleExport();
    } else {
      handleSendEmail();
    }
  };

  const handleSendEmail = () => {
    const subject = encodeURIComponent(`Loja ${user.storeId || 'UNID'} – Marca ${headerData.brand}`);
    const body = encodeURIComponent(`Pedido finalizado por ${user.name}.\nTotal de Pares: ${totalOrderPairs}\nMarca: ${headerData.brand}`);
    window.location.href = `mailto:subpedido@gmail.com?subject=${subject}&body=${body}`;
    alert("Solicitação de finalização enviada para a central.");
    onClose();
  };

  const handleExport = () => {
    setIsExporting(true);
    try {
      const wb = XLSX.utils.book_new();
      const ws_data: any[][] = [];

      // Criar cabeçalho da planilha se necessário (usando AOA para precisão de colunas)
      const row: any[] = [];
      row[0] = `PED-${Date.now().toString().slice(-6)}`; // A: Pedido
      row[1] = headerData.provider.toUpperCase(); // B: Fornecedor
      row[2] = user.name.toUpperCase(); // C: Comprador
      row[3] = headerData.billingDate; // D: Data Fat
      row[4] = headerData.deadlineDate; // E: Data Limite
      row[5] = totalOrderPairs; // F: Itens
      row[6] = `${headerData.brand} ${itemData.type} ${itemData.ref}`.toUpperCase(); // G: Descrição
      row[7] = itemData.ref; // H: Referência
      row[8] = itemData.type; // I: Tipo
      row[9] = itemData.model.toUpperCase(); // J: Modelo
      row[10] = headerData.brand.toUpperCase(); // K: Marca
      row[11] = itemData.color1.toUpperCase(); // L: Cor 1
      row[12] = itemData.color2.toUpperCase(); // M: Cor 2
      row[13] = itemData.color3.toUpperCase(); // N: Cor 3
      row[14] = headerData.collection; // O: Coleção
      row[15] = "NUMERICO"; // P: Tipo Grade
      row[16] = "T"; // Q: IPPT
      row[19] = "64042000"; // T: NCM
      row[20] = "2805900"; // U: CEST
      row[21] = "UN"; // V: Unidade
      row[24] = "49"; // Y: IPI
      row[25] = "70"; // Z: PIS
      row[26] = "70"; // AA: COFINS
      row[27] = "000"; // AB: ICMS
      row[29] = parseFloat(itemData.cost.replace(',', '.')); // AD: Valor Compra
      row[38] = suggestedPrice; // AM: Preço Venda

      // Lojas (AT a FE) -> Colunas 45 a 160
      selectedStores.forEach(storeNum => {
        const colIdx = 45 + (storeNum - 1);
        if (colIdx <= 160) {
          row[colIdx] = totalPairsPerStore;
        }
      });

      ws_data.push(row);

      const ws = XLSX.utils.aoa_to_sheet(ws_data);
      XLSX.utils.book_append_sheet(wb, ws, "PEDIDO");

      const fileName = `Pedido_Sub_R2JR_${headerData.brand.replace(/\s/g, '_')}.xlsx`;
      XLSX.writeFile(wb, fileName);
      alert("Planilha exportada com sucesso!");
    } catch (error) {
      alert("Erro ao gerar arquivo.");
    } finally {
      setIsExporting(false);
    }
  };

  const toggleStore = (num: number) => {
    setSelectedStores(prev => prev.includes(num) ? prev.filter(n => n !== num) : [...prev, num]);
  };

  return (
    <div className="fixed inset-0 bg-gray-950/95 backdrop-blur-xl z-[100] flex items-center justify-center p-4 font-sans overflow-hidden">
      <div className="bg-white rounded-[48px] w-full max-w-6xl h-[90vh] shadow-2xl flex flex-col overflow-hidden border border-white/20">
        
        {/* Step Header */}
        <div className="p-8 border-b bg-gray-50/50 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-6">
            <div className="p-4 bg-blue-900 text-white rounded-3xl shadow-xl shadow-blue-100">
              <FileSpreadsheet size={32} />
            </div>
            <div>
              <h2 className="text-3xl font-black text-blue-950 uppercase italic tracking-tighter leading-none">
                Máscara <span className="text-red-600">de Pedido</span>
              </h2>
              <div className="flex items-center gap-3 mt-2">
                {[1, 2, 3].map(s => (
                  <div key={s} className="flex items-center gap-2">
                    <span className={`w-3 h-3 rounded-full transition-all duration-500 ${step >= s ? 'bg-blue-600 scale-110 shadow-[0_0_10px_rgba(37,99,235,0.5)]' : 'bg-gray-200'}`}></span>
                    {s < 3 && <div className={`w-8 h-0.5 rounded-full ${step > s ? 'bg-blue-600' : 'bg-gray-200'}`}></div>}
                  </div>
                ))}
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-4">Etapa {step} de 3</span>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-4 bg-white text-gray-400 hover:text-red-600 rounded-full shadow-lg border border-gray-100 transition-all active:scale-90"><X size={24} /></button>
        </div>

        {/* Form Content */}
        <div className="flex-1 overflow-y-auto p-10 md:p-14 no-scrollbar">
          
          {step === 1 && (
            <div className="max-w-4xl mx-auto space-y-12 animate-in fade-in duration-700">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] ml-2">Fornecedor (Razão Social)</label>
                  <input value={headerData.provider} onChange={e => setHeaderData({...headerData, provider: e.target.value.toUpperCase()})} className="w-full p-6 bg-gray-50 border-2 border-transparent focus:border-blue-500 focus:bg-white rounded-3xl font-black text-blue-950 outline-none shadow-inner transition-all uppercase" placeholder="EX: CALCADOS BEIRA RIO S.A." />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] ml-2">Marca</label>
                  <input value={headerData.brand} onChange={e => setHeaderData({...headerData, brand: e.target.value.toUpperCase()})} className="w-full p-6 bg-gray-50 border-2 border-transparent focus:border-blue-500 focus:bg-white rounded-3xl font-black text-blue-950 outline-none shadow-inner transition-all uppercase" placeholder="EX: VIZZANO" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] ml-2">Data Faturamento Inicial</label>
                  <input type="date" value={headerData.billingDate} onChange={e => setHeaderData({...headerData, billingDate: e.target.value})} className="w-full p-6 bg-gray-50 border-2 border-transparent focus:border-blue-500 rounded-3xl font-black text-blue-950 outline-none shadow-inner transition-all" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] ml-2">Data Limite</label>
                  <input type="date" value={headerData.deadlineDate} onChange={e => setHeaderData({...headerData, deadlineDate: e.target.value})} className="w-full p-6 bg-gray-50 border-2 border-transparent focus:border-blue-500 rounded-3xl font-black text-blue-950 outline-none shadow-inner transition-all" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] ml-2">Desconto (%)</label>
                  <input type="number" value={headerData.discount} onChange={e => setHeaderData({...headerData, discount: e.target.value})} className="w-full p-6 bg-blue-50/50 border-2 border-transparent focus:border-blue-500 rounded-3xl font-black text-blue-900 outline-none shadow-inner" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] ml-2">Markup</label>
                  <input type="number" step="0.1" value={headerData.markup} onChange={e => setHeaderData({...headerData, markup: e.target.value})} className="w-full p-6 bg-blue-50/50 border-2 border-transparent focus:border-blue-500 rounded-3xl font-black text-blue-900 outline-none shadow-inner" />
                </div>
              </div>
              <div className="flex justify-end">
                <button onClick={() => setStep(2)} className="bg-blue-900 text-white px-14 py-6 rounded-[32px] font-black uppercase text-xs shadow-2xl hover:bg-black transition-all flex items-center gap-4 border-b-8 border-blue-950 active:scale-95 group">
                  Dados do Produto <ChevronRight size={20} className="group-hover:translate-x-2 transition-transform" />
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="max-w-4xl mx-auto space-y-12 animate-in slide-in-from-right duration-700">
               <div className="bg-blue-950 p-12 rounded-[56px] text-white shadow-2xl relative overflow-hidden group">
                  <div className="absolute -top-10 -right-10 opacity-5 group-hover:opacity-10 transition-opacity"><DollarSign size={240} /></div>
                  <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 gap-12">
                    <div className="space-y-8">
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-blue-300 uppercase tracking-[0.2em] ml-2">Referência de Fábrica</label>
                          <input value={itemData.ref} onChange={e => setItemData({...itemData, ref: e.target.value.toUpperCase()})} className="w-full bg-white/10 border-2 border-white/10 focus:border-blue-400 focus:bg-white/20 rounded-3xl p-6 font-black text-white outline-none transition-all placeholder-white/20 text-xl" placeholder="EX: 1234.567" />
                        </div>
                        <div className="grid grid-cols-2 gap-6">
                          <div className="space-y-2">
                            <label className="text-[10px] font-black text-blue-300 uppercase tracking-[0.2em] ml-2">Tipo</label>
                            <select value={itemData.type} onChange={e => setItemData({...itemData, type: e.target.value})} className="w-full bg-white/10 border-none rounded-3xl p-6 font-black text-white outline-none appearance-none cursor-pointer">
                              {['SAPATO', 'SANDALIA', 'TENIS', 'BOTA', 'CHINELO', 'BOLSA', 'OUTROS'].map(t => <option key={t} value={t} className="bg-blue-900">{t}</option>)}
                            </select>
                          </div>
                          <div className="space-y-2">
                            <label className="text-[10px] font-black text-blue-300 uppercase tracking-[0.2em] ml-2">Modelo</label>
                            <input value={itemData.model} onChange={e => setItemData({...itemData, model: e.target.value.toUpperCase()})} className="w-full bg-white/10 border-none rounded-3xl p-6 font-black text-white outline-none" placeholder="EX: SALTO BLOCO" />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-blue-300 uppercase tracking-[0.2em] ml-2">Valor de Compra (Custo)</label>
                          <input value={itemData.cost} onChange={e => setItemData({...itemData, cost: e.target.value})} className="w-full bg-white border-none rounded-3xl p-6 font-black text-blue-950 text-4xl outline-none shadow-2xl" placeholder="0,00" />
                        </div>
                    </div>
                    <div className="flex flex-col justify-center items-center text-center p-10 bg-white/5 rounded-[48px] border border-white/10 backdrop-blur-sm">
                        <div className="p-4 bg-blue-500/20 text-blue-400 rounded-full mb-6"><Package size={40}/></div>
                        <p className="text-[10px] font-black text-blue-300 uppercase tracking-[0.4em] mb-4">Engenharia de Venda</p>
                        <h3 className="text-7xl font-black italic tracking-tighter text-white drop-shadow-2xl">{formatCurrency(suggestedPrice)}</h3>
                        <div className="mt-8 flex gap-4">
                           <div className="bg-white/10 px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest text-blue-200">Markup: {headerData.markup}</div>
                           <div className="bg-white/10 px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest text-blue-200">Arred: .99</div>
                        </div>
                    </div>
                  </div>
               </div>
               <div className="flex justify-between items-center">
                  <button onClick={() => setStep(1)} className="text-gray-400 hover:text-blue-950 font-black uppercase text-xs flex items-center gap-3 transition-all"><ArrowLeft size={20}/> Voltar ao Cabeçalho</button>
                  <button onClick={() => setStep(3)} className="bg-blue-900 text-white px-14 py-6 rounded-[32px] font-black uppercase text-xs shadow-2xl hover:bg-black transition-all flex items-center gap-4 border-b-8 border-blue-950 active:scale-95">Definir Grade e Lojas <ChevronRight size={20}/></button>
               </div>
            </div>
          )}

          {step === 3 && (
            <div className="max-w-6xl mx-auto space-y-10 animate-in slide-in-from-bottom duration-700 h-full flex flex-col">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 flex-1">
                   
                   {/* Grade Selection */}
                   <div className="lg:col-span-8 space-y-6">
                      <div className="bg-white rounded-[40px] border border-gray-100 shadow-xl overflow-hidden flex flex-col">
                         <div className="p-6 bg-gray-50 border-b flex justify-between items-center">
                            <h3 className="text-[11px] font-black uppercase tracking-[0.3em] text-gray-500 flex items-center gap-4"><Layers size={18} className="text-blue-600"/> Composição da Grade de Tamanhos</h3>
                            <div className="bg-blue-900 text-white px-5 py-2 rounded-2xl text-[10px] font-black uppercase italic tracking-tighter shadow-lg shadow-blue-100">Pares / Loja: {totalPairsPerStore}</div>
                         </div>
                         <div className="p-8 grid grid-cols-4 sm:grid-cols-6 md:grid-cols-10 gap-3 max-h-[300px] overflow-y-auto no-scrollbar">
                            {SIZE_LABELS.map(s => (
                              <div key={s} className="space-y-1.5 flex flex-col items-center">
                                <label className="text-[9px] font-black text-gray-400">{s}</label>
                                <input 
                                  type="number" 
                                  min="0"
                                  value={grade[s] || ''} 
                                  onChange={e => setGrade({...grade, [s]: parseInt(e.target.value) || 0})}
                                  className="w-12 h-12 bg-gray-50 border-2 border-transparent focus:border-blue-500 focus:bg-white rounded-2xl text-center font-black text-blue-950 outline-none transition-all shadow-inner" 
                                />
                              </div>
                            ))}
                         </div>
                      </div>

                      <div className="bg-white rounded-[40px] border border-gray-100 shadow-xl p-8 flex justify-between items-center">
                         <div className="flex items-center gap-6">
                            <div className="p-5 bg-red-50 text-red-600 rounded-[32px]"><Package size={28}/></div>
                            <div>
                               <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Resumo Consolidado do Pedido</p>
                               <h4 className="text-3xl font-black text-blue-950 italic tracking-tighter">{totalOrderPairs} <span className="text-sm not-italic uppercase font-black text-gray-300 ml-2">Pares Totais</span></h4>
                            </div>
                         </div>
                         <div className="text-right">
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Distribuição</p>
                            <h4 className="text-xl font-black text-blue-900 uppercase italic tracking-tighter">{selectedStores.length} Lojas Atendidas</h4>
                         </div>
                      </div>
                   </div>

                   {/* Store Selection */}
                   <div className="lg:col-span-4 bg-blue-950 rounded-[48px] p-8 flex flex-col shadow-2xl relative overflow-hidden">
                      <div className="absolute top-0 right-0 p-8 opacity-10"><Building2 size={100} /></div>
                      <h3 className="text-sm font-black text-blue-300 uppercase tracking-[0.3em] mb-6 flex items-center gap-3"><CheckCircle2 size={18}/> Selecionar Unidades</h3>
                      <div className="flex-1 overflow-y-auto pr-2 space-y-2 no-scrollbar">
                         <div className="grid grid-cols-4 gap-2">
                           {Array.from({length: 120}, (_, i) => i + 1).map(num => (
                             <button 
                                key={num}
                                onClick={() => toggleStore(num)}
                                className={`h-10 rounded-xl font-black text-[10px] flex items-center justify-center transition-all ${selectedStores.includes(num) ? 'bg-blue-400 text-white shadow-lg' : 'bg-white/5 text-blue-300 hover:bg-white/10'}`}
                             >
                                {String(num).padStart(2, '0')}
                             </button>
                           ))}
                         </div>
                      </div>
                   </div>

                </div>

                <div className="mt-10 flex flex-col md:flex-row justify-between items-center gap-8 shrink-0 pb-10">
                    <button onClick={() => setStep(2)} className="text-gray-400 hover:text-blue-950 font-black uppercase text-xs flex items-center gap-3 transition-all"><ArrowLeft size={20}/> Voltar ao Produto</button>
                    
                    <div className="flex gap-6 w-full md:w-auto">
                        {user.role === UserRole.ADMIN ? (
                          <button 
                            onClick={handleFinalize} 
                            disabled={isExporting || totalOrderPairs === 0} 
                            className="flex-1 md:flex-none px-16 py-6 bg-green-600 text-white rounded-[32px] font-black uppercase text-xs shadow-2xl flex items-center justify-center gap-4 hover:bg-green-700 transition-all active:scale-95 border-b-8 border-green-800 disabled:opacity-30 disabled:grayscale"
                          >
                            {isExporting ? <Loader2 className="animate-spin" size={24}/> : <Download size={24} />} 
                            Gerar Planilha OTB
                          </button>
                        ) : (
                          <button 
                            onClick={handleFinalize}
                            disabled={totalOrderPairs === 0}
                            className="flex-1 md:flex-none px-16 py-6 bg-blue-600 text-white rounded-[32px] font-black uppercase text-xs shadow-2xl flex items-center justify-center gap-4 hover:bg-blue-700 transition-all active:scale-95 border-b-8 border-blue-800 disabled:opacity-30"
                          >
                            <Send size={24} /> Finalizar Pedido
                          </button>
                        )}
                    </div>
                </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default SpreadsheetOrderModule;
