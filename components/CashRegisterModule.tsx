
import React, { useState, useMemo } from 'react';
import { User, CashRegisterClosure, IceCreamDailySale, IceCreamTransaction } from '../types';
import { formatCurrency } from '../constants';
import { Banknote, Save, Loader2, History, Calculator, ClipboardCheck, Info } from 'lucide-react';

interface CashRegisterModuleProps {
  user: User;
  sales: IceCreamDailySale[];
  finances: IceCreamTransaction[];
  closures: CashRegisterClosure[];
  onAddClosure: (closure: Partial<CashRegisterClosure>) => Promise<void>;
}

const CashRegisterModule: React.FC<CashRegisterModuleProps> = ({ 
    user, sales, finances, closures, onAddClosure 
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notes, setNotes] = useState('');
  
  // Resumo do Dia Atual
  const today = new Date().toISOString().split('T')[0];
  
  const dailySummary = useMemo(() => {
      const todaySales = sales.filter(s => s.createdAt?.startsWith(today));
      const todayFinances = finances.filter(f => f.date === today);
      
      const totalSales = todaySales.reduce((a, b) => a + b.totalValue, 0);
      const totalExpenses = todayFinances.filter(f => f.type === 'exit').reduce((a, b) => a + b.value, 0);
      const balance = totalSales - totalExpenses;
      
      return { totalSales, totalExpenses, balance };
  }, [sales, finances, today]);

  const handleCloseRegister = async () => {
      if (window.confirm(`Confirma o fechamento do caixa com saldo de ${formatCurrency(dailySummary.balance)}?`)) {
          setIsSubmitting(true);
          try {
              await onAddClosure({
                  totalSales: dailySummary.totalSales,
                  totalExpenses: dailySummary.totalExpenses,
                  balance: dailySummary.balance,
                  notes: notes
              });
              setNotes('');
              alert("Caixa fechado com sucesso!");
          } catch (e) {
              alert("Erro ao fechar caixa.");
          } finally {
              setIsSubmitting(false);
          }
      }
  };

  return (
    <div className="p-4 md:p-8 space-y-8 max-w-5xl mx-auto animate-in fade-in duration-500">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6 bg-white p-8 rounded-[40px] shadow-sm border border-gray-100">
            <div className="flex items-center gap-4">
                <div className="p-5 bg-gray-900 rounded-3xl text-white shadow-xl"><Banknote size={32} /></div>
                <div>
                    <h2 className="text-2xl font-black text-gray-900 uppercase italic tracking-tighter leading-none">Fechamento <span className="text-red-600">de Caixa</span></h2>
                    <p className="text-gray-400 text-[10px] font-black uppercase tracking-widest mt-2">Apuração Diária de Entradas e Saídas</p>
                </div>
            </div>
            <div className="bg-blue-50 px-6 py-3 rounded-2xl border border-blue-100 text-center">
                <p className="text-[9px] font-black text-blue-400 uppercase tracking-widest mb-1">Data da Operação</p>
                <p className="text-lg font-black text-blue-900">{new Date().toLocaleDateString('pt-BR')}</p>
            </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Form de Fechamento */}
            <div className="bg-white p-10 rounded-[48px] shadow-xl border border-gray-100 space-y-8">
                <h3 className="text-xl font-black uppercase italic tracking-tighter flex items-center gap-3">
                    <Calculator className="text-blue-700" size={24}/> Resumo <span className="text-red-600">Financeiro</span>
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="p-6 bg-green-50 rounded-[32px] border border-green-100">
                        <span className="text-[9px] font-black text-green-600 uppercase tracking-widest block mb-2">Total Vendas (+)</span>
                        <p className="text-2xl font-black text-green-700">{formatCurrency(dailySummary.totalSales)}</p>
                    </div>
                    <div className="p-6 bg-red-50 rounded-[32px] border border-red-100">
                        <span className="text-[9px] font-black text-red-600 uppercase tracking-widest block mb-2">Total Despesas (-)</span>
                        <p className="text-2xl font-black text-red-700">{formatCurrency(dailySummary.totalExpenses)}</p>
                    </div>
                </div>

                <div className="p-8 bg-gray-900 rounded-[40px] text-white">
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">Saldo Final para Sangria/Depósito</span>
                    <p className="text-4xl font-black italic tracking-tighter">{formatCurrency(dailySummary.balance)}</p>
                </div>

                <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block ml-2">Observações do Turno</label>
                    <textarea 
                        value={notes} 
                        onChange={e => setNotes(e.target.value)}
                        placeholder="Alguma ocorrência ou detalhe sobre o caixa de hoje?"
                        className="w-full p-6 bg-gray-50 border-none rounded-[28px] font-medium text-sm h-32 resize-none outline-none focus:ring-4 focus:ring-blue-100"
                    />
                </div>

                <button 
                    onClick={handleCloseRegister}
                    disabled={isSubmitting}
                    className="w-full py-6 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white rounded-[32px] font-black uppercase text-sm shadow-2xl flex items-center justify-center gap-4 transition-all"
                >
                    {isSubmitting ? <Loader2 className="animate-spin" size={24}/> : <ClipboardCheck size={24}/>}
                    Finalizar e Gravar Fechamento
                </button>
            </div>

            {/* Histórico Recente */}
            <div className="space-y-6">
                <div className="bg-white p-8 rounded-[48px] shadow-sm border border-gray-100 flex flex-col h-full">
                    <h3 className="text-lg font-black uppercase italic tracking-tighter flex items-center gap-3 mb-6">
                        <History className="text-blue-700" size={24}/> Últimos <span className="text-blue-700">Fechamentos</span>
                    </h3>
                    
                    <div className="space-y-4 overflow-y-auto max-h-[600px] pr-2 no-scrollbar">
                        {closures.map(c => (
                            <div key={c.id} className="p-6 bg-gray-50 rounded-[32px] border border-gray-100 hover:border-blue-200 transition-all group">
                                <div className="flex justify-between items-start mb-3">
                                    <div>
                                        <p className="text-[10px] font-black text-blue-600 uppercase">{new Date(c.createdAt).toLocaleDateString('pt-BR')} {new Date(c.createdAt).toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'})}</p>
                                        <p className="text-xs font-black uppercase text-gray-900 mt-1">{c.userName}</p>
                                    </div>
                                    <p className="text-lg font-black text-gray-900 italic">{formatCurrency(c.balance)}</p>
                                </div>
                                {c.notes && (
                                    <div className="pt-3 border-t border-gray-200 mt-3">
                                        <p className="text-[10px] italic text-gray-500 leading-relaxed">"{c.notes}"</p>
                                    </div>
                                )}
                            </div>
                        ))}
                        {closures.length === 0 && (
                            <div className="text-center py-20 text-gray-300">
                                <Info size={40} className="mx-auto mb-4 opacity-20" />
                                <p className="text-[10px] font-black uppercase tracking-widest">Nenhum registro encontrado</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    </div>
  );
};

export default CashRegisterModule;
