import React, { useState } from 'react';
import { User, Store, CreditCardSale } from '../types';
import { formatCurrency } from '../constants';
import { CreditCard, Trash2, Calendar, Plus, Save } from 'lucide-react';

interface CreditCardsModuleProps {
  user: User;
  store?: Store;
  sales: CreditCardSale[];
  onAddSale: (sale: CreditCardSale) => void;
  onUpdateSale: (sale: CreditCardSale) => void;
  onDeleteSale: (id: string) => void;
}

const CARD_BRANDS = ['Visa', 'Mastercard', 'Elo', 'Hipercard', 'Amex', 'Alelo', 'Sodexo', 'Outros'];

const CreditCardsModule: React.FC<CreditCardsModuleProps> = ({ user, store, sales, onAddSale, onUpdateSale, onDeleteSale }) => {
  const [formData, setFormData] = useState({
      date: new Date().toISOString().split('T')[0],
      brand: 'Visa',
      value: '',
      authorizationCode: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      const val = parseFloat(formData.value.replace(/\./g, '').replace(',', '.'));
      
      if (!isNaN(val) && val > 0) {
          const newSale: CreditCardSale = {
              id: `card-${Date.now()}`,
              storeId: store?.id,
              userId: user.id,
              date: formData.date,
              brand: formData.brand,
              value: val,
              authorizationCode: formData.authorizationCode
          };
          onAddSale(newSale);
          setFormData(prev => ({ ...prev, value: '', authorizationCode: '' }));
      }
  };

  const totalSales = sales.reduce((acc, curr) => acc + curr.value, 0);

  return (
    <div className="p-6 md:p-8 max-w-[1600px] mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div>
                <h2 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
                    <CreditCard className="text-blue-600" size={32} />
                    Vendas em Cartão
                </h2>
                <p className="text-gray-500 mt-1">Registre as vendas realizadas no crédito/débito.</p>
            </div>
            <div className="bg-white px-6 py-3 rounded-xl border border-gray-200 shadow-sm text-right">
                <p className="text-xs text-gray-500 uppercase font-bold">Total Acumulado</p>
                <p className="text-3xl font-black text-green-600">{formatCurrency(totalSales)}</p>
            </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-8">
            {/* Form */}
            <div className="w-full lg:w-1/3 bg-white p-6 rounded-xl shadow-lg border border-gray-200 h-fit">
                <h3 className="font-bold text-gray-800 mb-6 flex items-center gap-2 text-lg">
                    <Plus size={20} className="text-green-600"/> Nova Venda
                </h3>
                
                <form onSubmit={handleSubmit} className="space-y-5">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Data</label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"><Calendar size={18}/></span>
                                <input 
                                    type="date"
                                    required
                                    value={formData.date}
                                    onChange={(e) => setFormData({...formData, date: e.target.value})}
                                    className="w-full pl-10 pr-3 py-3 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-gray-800 font-medium"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Bandeira</label>
                            <select 
                                value={formData.brand}
                                onChange={(e) => setFormData({...formData, brand: e.target.value})}
                                className="w-full p-3 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-gray-800 font-medium appearance-none"
                            >
                                {CARD_BRANDS.map(b => <option key={b} value={b}>{b}</option>)}
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Cód. Autorização (Opcional)</label>
                        <input 
                            value={formData.authorizationCode}
                            onChange={(e) => setFormData({...formData, authorizationCode: e.target.value})}
                            placeholder="Ex: 123456"
                            className="w-full p-3 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-gray-800"
                        />
                    </div>

                    {/* Value */}
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Valor (R$)</label>
                        <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-green-500 font-bold text-xl">R$</span>
                            <input 
                                required
                                value={formData.value}
                                onChange={(e) => setFormData({...formData, value: e.target.value})}
                                placeholder="0,00"
                                className="w-full pl-14 pr-4 py-4 bg-gray-800 border-2 border-gray-700 rounded-xl focus:border-green-500 focus:ring-0 outline-none font-black text-4xl text-white placeholder-gray-600 shadow-inner transition-all"
                            />
                        </div>
                    </div>

                    <button 
                        type="submit"
                        className="w-full py-4 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl shadow-lg hover:shadow-xl transition-all transform active:scale-[0.98] flex items-center justify-center gap-2 text-lg"
                    >
                        <Save size={20} /> Registrar Venda
                    </button>
                </form>
            </div>

            {/* List */}
            <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col h-[600px]">
                <div className="p-4 bg-gray-50 border-b border-gray-200 font-semibold text-gray-600 text-sm uppercase tracking-wider">
                    Histórico de Lançamentos
                </div>
                <div className="overflow-y-auto flex-1 p-0">
                    <table className="w-full text-left">
                        <thead className="bg-white sticky top-0 shadow-sm z-10 text-xs text-gray-500 uppercase font-bold">
                            <tr>
                                <th className="p-4 bg-gray-50/90 backdrop-blur">Data</th>
                                <th className="p-4 bg-gray-50/90 backdrop-blur">Bandeira</th>
                                <th className="p-4 bg-gray-50/90 backdrop-blur">Autorização</th>
                                <th className="p-4 bg-gray-50/90 backdrop-blur text-right">Valor</th>
                                <th className="p-4 bg-gray-50/90 backdrop-blur w-10"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 text-sm">
                            {sales.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="p-12 text-center text-gray-400">
                                        Nenhuma venda registrada.
                                    </td>
                                </tr>
                            ) : (
                                sales.slice().reverse().map((sale) => (
                                    <tr key={sale.id} className="hover:bg-blue-50 transition-colors group">
                                        <td className="p-4 text-gray-600 font-medium">
                                            {new Date(sale.date).toLocaleDateString('pt-BR')}
                                        </td>
                                        <td className="p-4">
                                            <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs font-bold border border-gray-200">
                                                {sale.brand}
                                            </span>
                                        </td>
                                        <td className="p-4 text-gray-500 font-mono text-xs">
                                            {sale.authorizationCode || '-'}
                                        </td>
                                        <td className="p-4 text-right font-bold text-green-700 text-base">
                                            {formatCurrency(sale.value)}
                                        </td>
                                        <td className="p-4 text-center">
                                            <button 
                                                onClick={() => onDeleteSale(sale.id)}
                                                className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors opacity-0 group-hover:opacity-100"
                                                title="Excluir"
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
    </div>
  );
};

export default CreditCardsModule;