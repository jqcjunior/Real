
import React, { useState } from 'react';
import { User, CreditCardSale, Store, Receipt } from '../types';
import { formatCurrency, BRAND_LOGO } from '../constants';
import { Printer, CreditCard, FileText, Plus, Trash2, Calendar, DollarSign, PenTool, Loader2, Save } from 'lucide-react';

const CARD_BRANDS = ['Visa', 'Mastercard', 'Elo', 'Hipercard', 'Amex', 'Alelo', 'Sodexo', 'Outros'];

interface FinancialModuleProps {
  user: User;
  store?: Store;
  sales: CreditCardSale[];
  receipts: Receipt[];
  onAddSale: (sale: CreditCardSale) => Promise<void>;
  onDeleteSale: (id: string) => Promise<void>;
  onAddReceipt: (receipt: Receipt) => Promise<void>;
}

const FinancialModule: React.FC<FinancialModuleProps> = ({ user, store, sales, receipts, onAddSale, onDeleteSale, onAddReceipt }) => {
  const [activeTab, setActiveTab] = useState<'receipt' | 'cards'>('receipt');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const filteredSales = (sales || []).filter(s => {
      if (store?.id && s.storeId !== store.id) return false;
      return true;
  }).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const totalCardSales = filteredSales.reduce((acc, curr) => acc + (Number(curr.value) || 0), 0);

  return (
    <div className="p-6 md:p-8 max-w-[1600px] mx-auto min-h-screen">
        <div className="flex justify-between items-center mb-8">
            <h2 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
                <DollarSign className="text-green-600" size={32} /> Financeiro
            </h2>
            <div className="flex bg-white p-1 rounded-lg border">
                <button onClick={() => setActiveTab('receipt')} className={`px-6 py-2.5 rounded-md text-sm font-bold ${activeTab === 'receipt' ? 'bg-blue-600 text-white' : ''}`}>Recibos</button>
                <button onClick={() => setActiveTab('cards')} className={`px-6 py-2.5 rounded-md text-sm font-bold ${activeTab === 'cards' ? 'bg-blue-600 text-white' : ''}`}>Cartões</button>
            </div>
        </div>

        {activeTab === 'cards' && (
            <div className="flex flex-col lg:flex-row gap-8">
                <div className="flex-1 bg-white rounded-xl shadow-sm border overflow-hidden">
                    <div className="p-6 border-b flex justify-between items-center">
                        <h3 className="font-bold">Vendas Cartão</h3>
                        <span className="text-2xl font-black text-blue-700">{formatCurrency(totalCardSales)}</span>
                    </div>
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gray-50">
                            <tr><th className="p-4">Data</th><th className="p-4">Bandeira</th><th className="p-4 text-right">Valor</th></tr>
                        </thead>
                        <tbody className="divide-y">
                            {(filteredSales || []).map((sale) => (
                                <tr key={sale.id}>
                                    <td className="p-4">{new Date(sale.date).toLocaleDateString('pt-BR')}</td>
                                    <td className="p-4">{sale.brand}</td>
                                    <td className="p-4 text-right font-bold text-green-700">{formatCurrency(Number(sale.value) || 0)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        )}
    </div>
  );
};

export default FinancialModule;
