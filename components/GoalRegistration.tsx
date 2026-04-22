import React, { useState, useEffect, useMemo } from 'react';
import { User, UserRole, Store, MonthlyGoal } from '../types';
import { formatCurrency } from '../constants';
import { Target, Loader2, Save, Calendar, CalendarDays, CheckCircle2, ChevronDown, Activity, Info, Package, DollarSign, FileSpreadsheet, Upload } from 'lucide-react';
import { parseMetasFile, insertMetas } from '../services/metasParser.service';

interface GoalRegistrationProps {
  user: User;
  stores: Store[];
  goalsData: MonthlyGoal[];
  onSaveGoals: (data: MonthlyGoal[]) => Promise<void>;
  onRefresh?: () => void;
}

const GoalRegistration: React.FC<GoalRegistrationProps> = ({
  user,
  stores,
  goalsData,
  onSaveGoals,
  onRefresh
}) => {
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [importing, setImporting] = useState(false);
  const [pendingMetas, setPendingMetas] = useState<any[] | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const months = [
    { value: 1, label: 'Janeiro' }, { value: 2, label: 'Fevereiro' }, { value: 3, label: 'Março' },
    { value: 4, label: 'Abril' }, { value: 5, label: 'Maio' }, { value: 6, label: 'Junho' },
    { value: 7, label: 'Julho' }, { value: 8, label: 'Agosto' }, { value: 9, label: 'Setembro' },
    { value: 10, label: 'Outubro' }, { value: 11, label: 'Novembro' }, { value: 12, label: 'Dezembro' }
  ];

  const isAdmin = user.role === UserRole.ADMIN;

  const activeStores = useMemo(
    () => (stores || [])
      .filter(s => s.status !== 'inactive')
      .filter(s => isAdmin || s.id === user.storeId)
      .sort((a, b) => Number(a.number) - Number(b.number)),
    [stores, isAdmin, user.storeId]
  );

  useEffect(() => {
    const initial: Record<string, any> = {};
    activeStores.forEach(store => {
      const existing = (goalsData || []).find(g => g.storeId === store.id && Number(g.year) === Number(selectedYear) && Number(g.month) === Number(selectedMonth));
      initial[store.id] = existing ? { ...existing, paTarget: String(existing.paTarget || 0).replace('.', ',') } : { storeId: store.id, year: selectedYear, month: selectedMonth, revenueTarget: 0, itemsTarget: 0, paTarget: '0,00', puTarget: 0, ticketTarget: 0, delinquencyTarget: 2, businessDays: 26, trend: 'stable' };
    });
    setFormData(initial);
  }, [activeStores, goalsData, selectedYear, selectedMonth]);

  const handleChange = (storeId: string, field: string, value: any) => {
    setFormData(prev => ({ ...prev, [storeId]: { ...prev[storeId], [field]: value } }));
  };

  const handleSave = async () => {
    setSaveStatus('saving');
    try {
      const dataToSave = Object.values(formData).map((item: any) => ({
          ...item,
          paTarget: parseFloat(String(item.paTarget).replace(',', '.')) || 0,
          revenueTarget: Number(item.revenueTarget) || 0,
          itemsTarget: Number(item.itemsTarget) || 0,
          puTarget: Number(item.puTarget) || 0,
          ticketTarget: Number(item.ticketTarget) || 0,
          delinquencyTarget: Number(item.delinquencyTarget) || 0,
          businessDays: Number(item.businessDays) || 0
      })) as MonthlyGoal[];
      await onSaveGoals(dataToSave);
      setSaveStatus('success');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch { setSaveStatus('error'); }
  };

  const handleMetasUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImporting(true);
    try {
      console.log('🚀 Iniciando importação de metas:', file.name);
      
      const dados = await parseMetasFile(file);
      
      if (dados.length === 0) {
        alert('Nenhum dado válido encontrado no arquivo.');
        setImporting(false);
        return;
      }

      setPendingMetas(dados);
      setShowConfirmModal(true);
      setImporting(false);
      
    } catch (error: any) {
      console.error('❌ Erro na importação:', error);
      alert(`Erro ao importar: ${error.message}`);
      setImporting(false);
    } finally {
      // Reset input
      event.target.value = '';
    }
  };

  const finalizeMetasImport = async () => {
    if (!pendingMetas) return;
    
    setImporting(true);
    setShowConfirmModal(false);
    
    try {
      await insertMetas(pendingMetas);
      alert('✅ Metas importadas com sucesso!');
      if (onRefresh) onRefresh();
    } catch (error: any) {
      console.error('❌ Erro ao salvar metas:', error);
      alert('Erro ao salvar dados no banco.');
    } finally {
      setImporting(false);
      setPendingMetas(null);
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-6 flex flex-col h-full bg-[#F8FAFC] dark:bg-slate-950 pb-24 max-w-[1400px] mx-auto relative">
      
      {/* MODAL DE CONFIRMAÇÃO DE IMPORTAÇÃO DE METAS */}
      {showConfirmModal && pendingMetas && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 rounded-[32px] p-8 border border-slate-100 dark:border-slate-800 shadow-2xl max-w-md w-full">
                <div className="flex items-center gap-4 mb-6">
                    <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/30 rounded-2xl flex items-center justify-center text-emerald-600">
                        <Target size={24} />
                    </div>
                    <div>
                        <h3 className="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tighter">Confirmar Metas</h3>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Valide o carregamento das novas metas</p>
                    </div>
                </div>

                <div className="space-y-4 mb-8 bg-slate-50 dark:bg-slate-800/50 p-6 rounded-2xl border border-slate-100 dark:border-slate-800">
                    <div className="flex justify-between items-center">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Lojas</span>
                        <span className="text-xs font-black text-slate-800 dark:text-white">{pendingMetas.length} lojas</span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Período</span>
                        <span className="text-xs font-black text-emerald-600 uppercase">
                            {months.find(m => m.value === pendingMetas[0]?.month)?.label} / {pendingMetas[0]?.year}
                        </span>
                    </div>
                    <p className="text-[9px] font-bold text-slate-400 uppercase leading-relaxed text-center mt-2 italic">
                        * As metas existentes para estas lojas neste período serão atualizadas.
                    </p>
                </div>

                <div className="flex gap-4">
                    <button 
                        onClick={() => { setShowConfirmModal(false); setPendingMetas(null); }}
                        className="flex-1 py-4 px-6 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-2xl font-black text-[10px] uppercase text-slate-600 dark:text-slate-300 transition-all active:scale-95"
                    >
                        Cancelar
                    </button>
                    <button 
                        onClick={finalizeMetasImport}
                        className="flex-1 py-4 px-6 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black text-[10px] uppercase transition-all shadow-lg shadow-emerald-500/20 active:scale-95"
                    >
                        Confirmar
                    </button>
                </div>
            </div>
        </div>
      )}

      <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-red-600 text-white rounded-2xl shadow-xl shadow-red-100 dark:shadow-red-900/20"><Target size={20} /></div>
          <div>
            <h2 className="text-lg font-black uppercase italic tracking-tighter text-slate-900 dark:text-white leading-none">Cadastro de <span className="text-red-600">Metas</span></h2>
            <p className="text-slate-400 dark:text-slate-500 text-[9px] uppercase font-black tracking-widest mt-1">Definição Estratégica da Rede</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
            <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
                <select 
                    value={selectedMonth} 
                    onChange={e => setSelectedMonth(Number(e.target.value))} 
                    className="bg-white dark:bg-slate-900 px-4 py-2 rounded-lg text-[10px] font-black uppercase text-slate-700 dark:text-white outline-none border-none cursor-pointer appearance-none min-w-[110px]"
                >
                    {months.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
                <select 
                    value={selectedYear} 
                    onChange={e => setSelectedYear(Number(e.target.value))} 
                    className="bg-transparent px-4 py-2 text-[10px] font-black text-slate-400 dark:text-slate-500 outline-none border-none cursor-pointer appearance-none min-w-[70px]"
                >
                    {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
                </select>
            </div>
            
            {isAdmin && (
              <>
                <input 
                  type="file" 
                  id="metas-upload" 
                  accept=".xls,.xlsx" 
                  className="hidden" 
                  onChange={handleMetasUpload}
                />
                <button 
                  onClick={() => document.getElementById('metas-upload')?.click()}
                  disabled={importing}
                  className="bg-emerald-600 text-white px-4 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-xl hover:bg-emerald-700 transition-all active:scale-95 flex items-center gap-2 disabled:opacity-50"
                  title="Importar metas do sistema (XLS ou XLSX)"
                >
                  {importing ? <Loader2 className="animate-spin" size={14} /> : <FileSpreadsheet size={14} />}
                  {importing ? 'Processando...' : 'Importar Metas'}
                </button>
              </>
            )}

            <button onClick={handleSave} disabled={saveStatus === 'saving'} className="bg-slate-950 dark:bg-white dark:text-slate-950 text-white px-6 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-xl hover:bg-blue-600 dark:hover:bg-blue-500 transition-all active:scale-95 border-b-2 border-red-700 disabled:opacity-50 flex items-center gap-2">
                {saveStatus === 'saving' ? <Loader2 className="animate-spin" size={14} /> : (saveStatus === 'success' ? <CheckCircle2 size={14}/> : <Save size={14} />)}
                {saveStatus === 'saving' ? 'Gravando...' : (saveStatus === 'success' ? 'Salvo!' : 'Efetivar Metas')}
            </button>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-[32px] shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden flex-1">
        <div className="overflow-x-auto no-scrollbar h-full">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 bg-white dark:bg-slate-900 z-20">
              <tr className="bg-slate-50 dark:bg-slate-800 text-[8px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-widest border-b dark:border-slate-700">
                <th className="px-6 py-4 w-48 sticky left-0 bg-slate-50 dark:bg-slate-800 border-r dark:border-slate-700">Unidade / Cidade</th>
                <th className="px-4 py-4 text-center">Dias Úteis</th>
                <th className="px-4 py-4 text-center">Faturamento (R$)</th>
                <th className="px-4 py-4 text-center">Itens (PR)</th>
                <th className="px-4 py-4 text-center">P.A (Virg.)</th>
                <th className="px-4 py-4 text-center">P.U Médio</th>
                <th className="px-4 py-4 text-center">Ticket Médio</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
              {activeStores.map((store) => {
                const row = formData[store.id];
                if (!row) return null;
                return (
                  <tr key={store.id} className="hover:bg-blue-50/30 dark:hover:bg-blue-900/10 transition-all group">
                    <td className="px-6 py-3 sticky left-0 bg-white dark:bg-slate-900 group-hover:bg-blue-50/50 dark:group-hover:bg-blue-900/20 z-10 border-r dark:border-slate-800">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-black text-slate-900 dark:text-white uppercase italic leading-none mb-0.5">#{store.number} - {store.name.substring(0,10)}</span>
                        <span className="text-[8px] font-bold text-slate-400 dark:text-slate-500 uppercase truncate">{store.city}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <input type="number" value={row.businessDays || ''} onChange={e => handleChange(store.id, 'businessDays', e.target.value)} className="w-full p-2 bg-slate-50 dark:bg-slate-800 border-none rounded-lg font-black text-slate-900 dark:text-slate-100 text-center text-[11px] outline-none focus:bg-white dark:focus:bg-slate-700 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/30" placeholder="26" />
                    </td>
                    <td className="px-3 py-2">
                      <input type="number" value={row.revenueTarget || ''} onChange={e => handleChange(store.id, 'revenueTarget', e.target.value)} className="w-full p-2 bg-slate-50 dark:bg-slate-800 border-none rounded-lg font-black text-slate-900 dark:text-slate-100 text-center text-[11px] outline-none focus:bg-white dark:focus:bg-slate-700 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/30" placeholder="0" />
                    </td>
                    <td className="px-3 py-2">
                      <input type="number" value={row.itemsTarget || ''} onChange={e => handleChange(store.id, 'itemsTarget', e.target.value)} className="w-full p-2 bg-slate-50 dark:bg-slate-800 border-none rounded-lg font-black text-slate-600 dark:text-slate-400 text-center text-[11px] outline-none focus:bg-white dark:focus:bg-slate-700 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/30" placeholder="0" />
                    </td>
                    <td className="px-3 py-2">
                      <input type="text" value={row.paTarget || ''} onChange={e => handleChange(store.id, 'paTarget', e.target.value)} className="w-full p-2 bg-purple-50 dark:bg-purple-900/20 border-none rounded-lg font-black text-purple-700 dark:text-purple-400 text-center text-[11px] outline-none focus:bg-white dark:focus:bg-slate-700 focus:ring-2 focus:ring-purple-100 dark:focus:ring-purple-900/30" placeholder="0,00" />
                    </td>
                    <td className="px-3 py-2">
                      <input type="number" value={row.puTarget || ''} onChange={e => handleChange(store.id, 'puTarget', e.target.value)} className="w-full p-2 bg-slate-50 dark:bg-slate-800 border-none rounded-lg font-black text-orange-700 dark:text-orange-400 text-center text-[11px] outline-none focus:bg-white dark:focus:bg-slate-700 focus:ring-2 focus:ring-orange-100 dark:focus:ring-orange-900/30" placeholder="0" />
                    </td>
                    <td className="px-3 py-2">
                      <input type="number" value={row.ticketTarget || ''} onChange={e => handleChange(store.id, 'ticketTarget', e.target.value)} className="w-full p-2 bg-emerald-50 dark:bg-emerald-900/20 border-none rounded-lg font-black text-emerald-700 dark:text-emerald-400 text-center text-[11px] outline-none focus:bg-white dark:focus:bg-slate-700 focus:ring-2 focus:ring-emerald-100 dark:focus:ring-emerald-900/30" placeholder="0" />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default GoalRegistration;