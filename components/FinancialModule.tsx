
import React, { useState } from 'react';
import { User, CreditCardSale, Store, Receipt } from '../types';
import { formatCurrency } from '../constants';
import { Printer, CreditCard, FileText, Plus, Trash2, Calendar, DollarSign, PenTool, Loader2, Save } from 'lucide-react';

interface FinancialModuleProps {
  user: User;
  store?: Store;
  sales: CreditCardSale[];
  receipts: Receipt[];
  onAddSale: (sale: CreditCardSale) => Promise<void>;
  onDeleteSale: (id: string) => Promise<void>;
  onAddReceipt: (receipt: Receipt) => Promise<void>;
}

const CARD_BRANDS = ['Visa', 'Mastercard', 'Elo', 'Hipercard', 'Amex', 'Alelo', 'Sodexo', 'Outros'];

// Helper: Number to Words (PT-BR)
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
        } else text += "Valor muito alto"; 
    }
    if (decimalPart > 0) {
        if (integerPart > 0) text += " e ";
        text += convertGroup(decimalPart) + (decimalPart === 1 ? " centavo" : " centavos");
    }
    return text;
};

const FinancialModule: React.FC<FinancialModuleProps> = ({ user, store, sales, receipts, onAddSale, onDeleteSale, onAddReceipt }) => {
  const [activeTab, setActiveTab] = useState<'receipt' | 'cards'>('receipt');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Receipt State
  const [receiptData, setReceiptData] = useState({
      value: '',
      payer: '',
      date: new Date().toISOString().split('T')[0],
      reference: 'compra de mercadorias'
  });

  const receiptValueNum = parseFloat(receiptData.value.replace(/\./g, '').replace(',', '.')) || 0;
  const valueInWords = numberToWords(receiptValueNum);
  const city = store?.city.split(' - ')[0] || 'Cidade';

  // Card Sales Form State
  const [newSale, setNewSale] = useState({
      date: new Date().toISOString().split('T')[0],
      brand: 'Visa',
      value: ''
  });

  const handlePrint = () => {
      window.print();
  };

  const handlePrintAndSave = async () => {
      if (receiptValueNum <= 0 || !receiptData.payer) {
          alert("Preencha todos os campos obrigatórios (Valor e Pagador).");
          return;
      }

      setIsSubmitting(true);
      try {
          const newReceipt: Receipt = {
              id: `rec-${Date.now()}`, 
              storeId: store?.id,
              issuerName: user.name,
              payer: receiptData.payer, 
              recipient: user.name, 
              value: receiptValueNum,
              valueInWords: valueInWords,
              reference: receiptData.reference,
              date: receiptData.date,
              createdAt: new Date()
          };

          await onAddReceipt(newReceipt);
          
          // Trigger Print after saving
          setTimeout(() => handlePrint(), 500);
          
          setReceiptData(prev => ({ ...prev, value: '', reference: 'compra de mercadorias' }));
      } catch (error) {
          alert("Erro ao salvar recibo.");
      } finally {
          setIsSubmitting(false);
      }
  };

  const handleAddSale = async (e: React.FormEvent) => {
      e.preventDefault();
      const val = parseFloat(newSale.value.replace(/\./g, '').replace(',', '.'));
      if (!isNaN(val) && val > 0) {
          setIsSubmitting(true);
          try {
              const sale: CreditCardSale = {
                  id: `card-${Date.now()}`,
                  storeId: store?.id,
                  userId: user.id,
                  date: newSale.date,
                  brand: newSale.brand,
                  value: val
              };
              await onAddSale(sale);
              setNewSale(prev => ({ ...prev, value: '' }));
          } catch (error) {
              alert("Erro ao registrar venda.");
          } finally {
              setIsSubmitting(false);
          }
      }
  };

  const handleDeleteSale = async (id: string) => {
      if (window.confirm("Deseja realmente excluir este lançamento?")) {
          setIsSubmitting(true); // Global loader effect
          await onDeleteSale(id);
          setIsSubmitting(false);
      }
  }

  const filteredSales = sales.filter(s => {
      if (store?.id && s.storeId !== store.id) return false;
      return true;
  }).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const totalCardSales = filteredSales.reduce((acc, curr) => acc + curr.value, 0);

  return (
    <div className="p-6 md:p-8 max-w-[1600px] mx-auto min-h-screen flex flex-col">
        {/* HEADER (Hidden on Print) */}
        <div className="flex flex-col md:flex-row justify-between items-center mb-8 print:hidden">
            <div>
                <h2 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
                    <DollarSign className="text-green-600" size={32} />
                    Caixa & Financeiro
                </h2>
                <p className="text-gray-500 mt-1">Emissão de recibos e controle de cartões.</p>
            </div>
            <div className="flex bg-white p-1 rounded-lg border border-gray-200 shadow-sm mt-4 md:mt-0">
                <button onClick={() => setActiveTab('receipt')} className={`flex items-center gap-2 px-6 py-2.5 rounded-md text-sm font-bold transition-all ${activeTab === 'receipt' ? 'bg-blue-600 text-white shadow' : 'text-gray-500 hover:text-gray-800'}`}><FileText size={18} /> Recibos</button>
                <button onClick={() => setActiveTab('cards')} className={`flex items-center gap-2 px-6 py-2.5 rounded-md text-sm font-bold transition-all ${activeTab === 'cards' ? 'bg-blue-600 text-white shadow' : 'text-gray-500 hover:text-gray-800'}`}><CreditCard size={18} /> Vendas Cartão</button>
            </div>
        </div>

        {/* --- RECEIPT GENERATOR --- */}
        {activeTab === 'receipt' && (
            <div className="flex flex-col lg:flex-row gap-8">
                {/* Controls */}
                <div className="w-full lg:w-1/3 bg-white p-6 rounded-xl shadow-sm border border-gray-200 h-fit print:hidden">
                    <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2"><PenTool size={18} className="text-blue-600"/> Dados do Recibo</h3>
                    <div className="space-y-4">
                        <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Valor (R$)</label><input value={receiptData.value} onChange={e => setReceiptData({...receiptData, value: e.target.value})} placeholder="0,00" className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-bold text-gray-800"/></div>
                        <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Pagador</label><input value={receiptData.payer} onChange={e => setReceiptData({...receiptData, payer: e.target.value})} placeholder="Nome de quem pagou" className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"/></div>
                        <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Referente a</label><input value={receiptData.reference} onChange={e => setReceiptData({...receiptData, reference: e.target.value})} placeholder="Ex: Compra de mercadorias" className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"/></div>
                        <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Data</label><input type="date" value={receiptData.date} onChange={e => setReceiptData({...receiptData, date: e.target.value})} className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"/></div>
                        <button 
                            onClick={handlePrintAndSave} 
                            disabled={isSubmitting}
                            className="w-full mt-4 bg-gray-800 text-white py-3 rounded-lg font-bold hover:bg-black transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                            {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : <Printer size={18} />} 
                            Salvar e Imprimir
                        </button>
                    </div>
                </div>

                {/* Receipt Preview */}
                <div className="flex-1 flex justify-center items-start">
                    <div className="w-full max-w-[800px] bg-white p-10 border-2 border-dashed border-gray-300 shadow-sm print:border-2 print:border-black print:shadow-none print:w-full print:max-w-none print:absolute print:top-0 print:left-0 print:m-0 print:h-auto">
                        <div className="flex justify-between items-start mb-8 border-b-2 border-gray-800 pb-6">
                            <div className="flex items-center gap-4">
                                <div className="text-2xl font-black text-gray-900 tracking-tighter uppercase italic">Real <span className="text-red-600 print:text-black">Calçados</span></div>
                            </div>
                            <div className="text-right">
                                <h2 className="text-3xl font-black text-gray-200 print:text-gray-300 uppercase tracking-widest">RECIBO</h2>
                                <div className="mt-2 bg-gray-100 print:bg-transparent border border-gray-300 rounded px-4 py-2"><span className="text-sm font-bold text-gray-500 mr-2">VALOR</span><span className="text-xl font-bold text-gray-900">{formatCurrency(receiptValueNum)}</span></div>
                            </div>
                        </div>
                        <div className="space-y-6 text-gray-800 leading-relaxed text-lg font-serif">
                            <p>Recebi(emos) de <span className="font-bold border-b border-gray-400 px-2 min-w-[200px] inline-block">{receiptData.payer || '_______________________'}</span></p>
                            <p>a quantia de <span className="font-bold italic bg-gray-50 print:bg-transparent px-2 py-1 rounded w-full block mt-1 border border-gray-200 print:border-none uppercase text-sm">{valueInWords || '_______________________________________'}</span></p>
                            <p>referente a <span className="border-b border-gray-400 px-2">{receiptData.reference}</span>.</p>
                        </div>
                        <div className="mt-16 pt-8 flex flex-col items-center justify-center text-center">
                            <div className="text-gray-800 font-medium mb-12">{city}, {new Date().toLocaleDateString('pt-BR')}</div>
                            <div className="w-2/3 border-t border-black pt-2 mt-8">
                                <p className="font-bold text-gray-900 uppercase">{user.name}</p>
                                <p className="text-xs text-gray-500 uppercase">Emissor / Responsável</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        )}

        {/* --- CREDIT CARD SALES --- */}
        {activeTab === 'cards' && (
            <div className="flex flex-col lg:flex-row gap-8 print:hidden">
                <div className="w-full lg:w-1/3 bg-white p-6 rounded-xl shadow-sm border border-gray-200 h-fit">
                    <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2"><Plus size={18} className="text-green-600"/> Registrar Venda</h3>
                    <form onSubmit={handleAddSale} className="space-y-4">
                        <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Data</label><input type="date" required value={newSale.date} onChange={e => setNewSale({...newSale, date: e.target.value})} className="w-full p-3 border border-gray-300 rounded-lg outline-none"/></div>
                        <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Bandeira</label><select value={newSale.brand} onChange={e => setNewSale({...newSale, brand: e.target.value})} className="w-full p-3 border border-gray-300 rounded-lg outline-none bg-white">{CARD_BRANDS.map(b => <option key={b} value={b}>{b}</option>)}</select></div>
                        <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Valor (R$)</label><input required value={newSale.value} onChange={e => setNewSale({...newSale, value: e.target.value})} placeholder="0,00" className="w-full p-3 border border-gray-300 rounded-lg outline-none font-bold text-gray-800"/></div>
                        <button 
                            type="submit" 
                            disabled={isSubmitting}
                            className="w-full mt-2 bg-green-600 text-white py-3 rounded-lg font-bold hover:bg-green-700 shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                            {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />} 
                            Adicionar Venda
                        </button>
                    </form>
                </div>

                <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
                    <div className="p-6 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
                        <h3 className="font-bold text-gray-800">Vendas Registradas</h3>
                        <div className="text-right"><span className="text-xs font-bold text-gray-500 uppercase block">Total Acumulado</span><span className="text-2xl font-black text-blue-700">{formatCurrency(totalCardSales)}</span></div>
                    </div>
                    <div className="flex-1 overflow-auto max-h-[500px]">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-white sticky top-0 shadow-sm z-10 text-xs text-gray-500 uppercase font-bold">
                                <tr><th className="p-4">Data</th><th className="p-4">Bandeira</th><th className="p-4 text-right">Valor</th><th className="p-4 w-10"></th></tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {filteredSales.length === 0 ? (
                                    <tr><td colSpan={4} className="p-12 text-center text-gray-400">Nenhuma venda lançada.</td></tr>
                                ) : (
                                    filteredSales.map((sale) => (
                                        <tr key={sale.id} className="hover:bg-blue-50 transition-colors group">
                                            <td className="p-4 text-gray-600">{new Date(sale.date).toLocaleDateString('pt-BR')}</td>
                                            <td className="p-4 font-medium text-gray-800">{sale.brand}</td>
                                            <td className="p-4 text-right font-bold text-green-700">{formatCurrency(sale.value)}</td>
                                            <td className="p-4 text-center">
                                                <button 
                                                    onClick={() => handleDeleteSale(sale.id)} 
                                                    className="text-gray-300 hover:text-red-500 transition-colors p-1" 
                                                    title="Excluir"
                                                    disabled={isSubmitting}
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};

export default FinancialModule;
