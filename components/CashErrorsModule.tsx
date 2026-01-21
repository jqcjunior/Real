
import React, { useState, useMemo } from 'react';
import { User, Store, CashError, UserRole } from '../types';
import { formatCurrency } from '../constants';
import { AlertOctagon, TrendingUp, TrendingDown, Plus, Trash2, Calendar, Edit, X, Filter, Search, Printer, Loader2 } from 'lucide-react';

interface CashErrorsModuleProps {
  user: User;
  store?: Store;
  stores: Store[];
  errors: CashError[];
  onAddError: (error: any) => Promise<void>;
  onUpdateError: (error: CashError) => Promise<void>;
  onDeleteError: (id: string) => Promise<void>;
}

const MONTHS = [
  { value: 1, label: 'Janeiro' }, { value: 2, label: 'Fevereiro' }, { value: 3, label: 'Março' },
  { value: 4, label: 'Abril' }, { value: 5, label: 'Maio' }, { value: 6, label: 'Junho' },
  { value: 7, label: 'Julho' }, { value: 8, label: 'Agosto' }, { value: 9, label: 'Setembro' },
  { value: 10, label: 'Outubro' }, { value: 11, label: 'Novembro' }, { value: 12, label: 'Dezembro' }
];

const CashErrorsModule: React.FC<CashErrorsModuleProps> = ({ user, store, stores, errors, onAddError, onUpdateError, onDeleteError }) => {
  const [activeTab, setActiveTab] = useState<'list' | 'new'>('list');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const currentDate = new Date();
  const [filterMonth, setFilterMonth] = useState(currentDate.getMonth() + 1);
  const [filterYear, setFilterYear] = useState(currentDate.getFullYear());
  const [filterStoreId, setFilterStoreId] = useState<string>('all');

  const [formData, setFormData] = useState<{
      date: string;
      type: 'surplus' | 'shortage';
      value: string;
      reason: string;
      storeId: string;
  }>({
      date: new Date().toISOString().split('T')[0],
      type: 'shortage',
      value: '',
      reason: '',
      storeId: store?.id || (stores.length > 0 ? stores[0].id : '')
  });

  const isAdmin = user.role === UserRole.ADMIN;
  const isManager = user.role === UserRole.MANAGER;
  const canEdit = !isManager;

  const availableYears = useMemo(() => {
      const years = new Set<number>();
      years.add(new Date().getFullYear());
      errors.forEach(e => {
          const y = parseInt(e.date?.split('-')[0] || '');
          if (!isNaN(y)) years.add(y);
      });
      return Array.from(years).sort((a,b) => b - a);
  }, [errors]);

  const filteredErrors = useMemo(() => {
      return errors.filter(e => {
          if (!isAdmin && e.storeId !== user.storeId) return false;
          if (isAdmin && filterStoreId !== 'all' && e.storeId !== filterStoreId) return false;
          const dateParts = (e.date || '').split('-');
          if (dateParts.length < 2) return false;
          const y = parseInt(dateParts[0]);
          const m = parseInt(dateParts[1]);
          if (y !== filterYear || m !== filterMonth) return false;
          return true;
      }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [errors, isAdmin, user.storeId, filterStoreId, filterMonth, filterYear]);

  const summary = useMemo(() => {
      let surplus = 0, shortage = 0;
      filteredErrors.forEach(e => {
          if (e.type === 'surplus') surplus += e.value;
          else shortage += e.value;
      });
      return { surplus, shortage, balance: surplus - shortage };
  }, [filteredErrors]);

  const handleSave = async (e: React.FormEvent) => {
      e.preventDefault();
      const val = parseFloat(formData.value.replace(/\./g, '').replace(',', '.'));
      if (isNaN(val) || val <= 0 || !formData.reason) return;

      setIsSubmitting(true);
      try {
          if (editingId) {
              const original = errors.find(err => err.id === editingId);
              if (original) {
                  await onUpdateError({ ...original, date: formData.date, type: formData.type, value: val, reason: formData.reason, storeId: formData.storeId });
              }
              setEditingId(null);
          } else {
              // ✅ POR ISSO (modelo banco-safe)
              await onAddError({
                store_id: formData.storeId,
                user_id: user.id,
                error_date: formData.date, // YYYY-MM-DD
                type: formData.type,
                value: val,
                reason: formData.reason
              });
          }
          setFormData(prev => ({ ...prev, value: '', reason: '' }));
          setActiveTab('list');
      } catch (error) {
          alert("Erro ao salvar ocorrência.");
      } finally {
          setIsSubmitting(false);
      }
  };

  const handleEdit = (err: CashError) => {
      setEditingId(err.id);
      setFormData({ date: err.date, type: err.type, value: err.value.toFixed(2).replace('.', ','), reason: err.reason || '', storeId: err.storeId });
      setActiveTab('new');
  };

  const handlePrintReport = () => {
      const printWindow = window.open('', '_blank', 'width=900,height=1200');
      if (!printWindow) return;
      const htmlContent = `<html><body style="font-family:sans-serif;padding:20px"><h1>Relatório de Quebra de Caixa</h1></body></html>`;
      printWindow.document.write(htmlContent);
      printWindow.document.close();
      printWindow.print();
  };

  return (
    <div className="p-6 md:p-8 max-w-[1600px] mx-auto space-y-8">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div>
                <h2 className="text-3xl font-bold text-gray-800 flex items-center gap-3"><AlertOctagon className="text-red-600" size={32} /> Controle de Quebra de Caixa</h2>
                <p className="text-gray-500 mt-1">Lançamentos de sobras e faltas no fechamento.</p>
            </div>
            <div className="flex bg-white p-1 rounded-lg border">
                {canEdit && <button onClick={() => setActiveTab('new')} className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${activeTab === 'new' ? 'bg-green-600 text-white' : 'text-gray-500'}`}>+ Lançar</button>}
                <button onClick={() => { setActiveTab('list'); setEditingId(null); }} className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${activeTab === 'list' ? 'bg-purple-100 text-purple-800' : 'text-gray-500'}`}>Histórico</button>
            </div>
        </div>

        {activeTab === 'new' && canEdit && (
            <div className="bg-white p-6 rounded-xl shadow-lg border max-w-2xl mx-auto animate-in zoom-in duration-200">
                <form onSubmit={handleSave} className="space-y-5">
                    {isAdmin && (
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Loja</label>
                            <select value={formData.storeId} onChange={e => setFormData({...formData, storeId: e.target.value})} className="w-full p-3 border rounded-lg outline-none">
                                {stores.map(s => <option key={s.id} value={s.id}>{s.number} - {s.name}</option>)}
                            </select>
                        </div>
                    )}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Data</label>
                            <input type="date" required value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} className="w-full p-3 border rounded-lg outline-none" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Tipo</label>
                            <div className="flex bg-gray-100 p-1 rounded-lg">
                                <button type="button" onClick={() => setFormData({...formData, type: 'shortage'})} className={`flex-1 py-2 rounded-md text-sm font-bold ${formData.type === 'shortage' ? 'bg-white text-red-600 shadow-sm' : 'text-gray-500'}`}>Falta</button>
                                <button type="button" onClick={() => setFormData({...formData, type: 'surplus'})} className={`flex-1 py-2 rounded-md text-sm font-bold ${formData.type === 'surplus' ? 'bg-white text-green-600 shadow-sm' : 'text-gray-500'}`}>Sobra</button>
                            </div>
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Valor (R$)</label>
                        <input required value={formData.value} onChange={e => setFormData({...formData, value: e.target.value})} placeholder="0,00" className="w-full p-3 border rounded-lg text-xl font-bold outline-none" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Motivo</label>
                        <textarea required value={formData.reason} onChange={e => setFormData({...formData, reason: e.target.value})} className="w-full p-3 border rounded-lg h-24 outline-none" />
                    </div>
                    <button type="submit" disabled={isSubmitting} className="w-full py-3 bg-red-600 text-white rounded-lg font-bold">
                        {isSubmitting ? <Loader2 className="animate-spin mx-auto" /> : (editingId ? 'Atualizar' : 'Registrar')}
                    </button>
                </form>
            </div>
        )}

        {activeTab === 'list' && (
            <div className="space-y-6">
                <div className="bg-white p-4 rounded-xl border flex justify-between items-center">
                    <div className="flex gap-3">
                        <select value={filterMonth} onChange={e => setFilterMonth(Number(e.target.value))} className="p-2 border rounded-lg outline-none">
                            {MONTHS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                        </select>
                        <select value={filterYear} onChange={e => setFilterYear(Number(e.target.value))} className="p-2 border rounded-lg outline-none">
                            {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                    </div>
                    <button onClick={handlePrintReport} className="bg-blue-700 text-white px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2"><Printer size={16} /> Relatório</button>
                </div>

                <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gray-50 text-gray-500 border-b">
                            <tr>
                                <th className="p-4">Data</th>
                                <th className="p-4">Tipo</th>
                                <th className="p-4 text-right">Valor</th>
                                <th className="p-4">Motivo</th>
                                <th className="p-4">Responsável</th>
                                <th className="p-4 text-center">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {filteredErrors.map((err) => (
                                <tr key={err.id} className="hover:bg-gray-50">
                                    <td className="p-4">{new Date(err.date + 'T12:00:00').toLocaleDateString('pt-BR')}</td>
                                    <td className="p-4"><span className={`px-2 py-1 rounded text-[10px] font-bold ${err.type === 'surplus' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{err.type === 'surplus' ? 'SOBRA' : 'FALTA'}</span></td>
                                    <td className={`p-4 text-right font-bold ${err.type === 'surplus' ? 'text-green-700' : 'text-red-700'}`}>{formatCurrency(err.value)}</td>
                                    <td className="p-4 truncate max-w-xs">{err.reason}</td>
                                    <td className="p-4 text-xs">{err.userName}</td>
                                    <td className="p-4 text-center">
                                        {canEdit && <div className="flex justify-center gap-2"><button onClick={() => handleEdit(err)} className="text-blue-500"><Edit size={16}/></button><button onClick={() => onDeleteError(err.id)} className="text-red-400"><Trash2 size={16}/></button></div>}
                                    </td>
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

export default CashErrorsModule;
