import React, { useState, useMemo } from 'react';
import { User, Store, CashError, UserRole } from '../types';
import { formatCurrency } from '../constants';
import { AlertOctagon, TrendingUp, TrendingDown, Plus, Trash2, Calendar, Edit, X, Filter, Search, Printer, Loader2, FileText, CheckCircle2 } from 'lucide-react';
import { supabase } from '../services/supabaseClient';
 
interface CashErrorsModuleProps {
  user: User;
  store?: Store;
  stores: Store[];
  errors: CashError[];
  can: (perm: string) => boolean;
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
 
const CashErrorsModule: React.FC<CashErrorsModuleProps> = ({ user, store, stores, errors, can, onAddError, onUpdateError, onDeleteError }) => {
  const [activeTab, setActiveTab] = useState<'list' | 'new'>('new');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const currentDate = new Date();
  const [filterMonth, setFilterMonth] = useState(currentDate.getMonth() + 1);
  const [filterYear, setFilterYear] = useState(currentDate.getFullYear());
  const [filterStoreId, setFilterStoreId] = useState<string>(store?.id || 'all');
 
  const [formData, setFormData] = useState({
      date: new Date().toISOString().split('T')[0],
      expectedValue: '',
      foundValue: '',
      reason: '',
      storeId: store?.id || (stores.length > 0 ? stores[0].id : ''),
      witnessName: '',
      witnessRole: ''
  });
 
  const isAdmin = user.role === UserRole.ADMIN;
  const canEdit = can('MODULE_CASH_ERRORS_EDIT');
 
  // Cálculos automáticos
  const expected = parseFloat(formData.expectedValue.replace(/\./g, '').replace(',', '.')) || 0;
  const found = parseFloat(formData.foundValue.replace(/\./g, '').replace(',', '.')) || 0;
  const difference = found - expected;
  const type = difference < 0 ? 'falta' : difference > 0 ? 'sobra' : 'ok';
 
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
          if (!isAdmin && e.userId !== user.id) return false; // ✅ Filter by user
          if (isAdmin && filterStoreId !== 'all' && e.storeId !== filterStoreId) return false;
          const dateParts = (e.date || '').split('-');
          if (dateParts.length < 2) return false;
          const y = parseInt(dateParts[0]);
          const m = parseInt(dateParts[1]);
          if (y !== filterYear || m !== filterMonth) return false;
          return true;
      }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [errors, isAdmin, user.storeId, user.id, filterStoreId, filterMonth, filterYear]);
 
  const handleRegistrarEImprimir = async (e: React.FormEvent) => {
      e.preventDefault();
      if (expected <= 0 || !formData.reason) {
          alert("Preencha todos os campos obrigatórios.");
          return;
      }
 
      setIsSubmitting(true);
      try {
          // Calculamos os valores aqui no frontend já que a RPC está com erro de constraint
          const diff = Math.abs(found - expected);
          const errorType = found < expected ? 'shortage' : 'surplus';
          
          // ✅ CORREÇÃO: Nomes corretos das colunas
          const newRecord = {
              store_id: formData.storeId,
              user_id: user.id,
              user_name: user.name,
              funcao_funcionario: 'OPERADOR DE CAIXA', // ✅ CORRETO
              error_date: formData.date,
              type: errorType,
              value: diff,
              reason: formData.reason,
              testemunha_nome: formData.witnessName || null, // ✅ CORRETO
              testemunha_funcao: formData.witnessRole || null, // ✅ CORRETO
              desconto_aplicado: errorType === 'shortage',
              desconto_valor: errorType === 'shortage' ? diff : 0
          };
 
          const { data: insertedData, error: insertError } = await supabase
              .from('cash_errors')
              .insert([newRecord])
              .select()
              .single();
 
          if (insertError) throw insertError;
 
          if (insertedData) {
              // Imprimir Recibo
              imprimirReciboIndividual({
                  ...formData,
                  id: insertedData.id,
                  difference: diff,
                  type: errorType === 'shortage' ? 'falta' : 'sobra',
                  desconto_aplicado: errorType === 'shortage',
                  desconto_valor: errorType === 'shortage' ? diff : 0,
                  userName: user.name,
                  storeName: stores.find(s => s.id === formData.storeId)?.name || 'LOJA'
              });
 
              // Reset e Atualizar
              setFormData({
                  date: new Date().toISOString().split('T')[0],
                  expectedValue: '',
                  foundValue: '',
                  reason: '',
                  storeId: store?.id || (stores.length > 0 ? stores[0].id : ''),
                  witnessName: '',
                  witnessRole: ''
              });
              
              // Recarregar dados (via prop ou local)
              if (onAddError) await onAddError({}); // Trigger refresh
              
              setActiveTab('list');
          }
      } catch (err: any) {
          console.error(err);
          alert("Erro ao registrar: " + (err.message || "Erro desconhecido"));
      } finally {
          setIsSubmitting(false);
      }
  };
 
  const imprimirReciboIndividual = (data: any) => {
      const printWindow = window.open('', '_blank', 'width=800,height=1000');
      if (!printWindow) return;
 
      const formattedDate = new Date(data.date + 'T12:00:00').toLocaleDateString('pt-BR');
      const isFalta = data.type === 'falta';
      const color = isFalta ? '#dc2626' : '#16a34a';
      const storeName = data.storeName;
 
      const content = `
        <div style="font-family: 'Courier New', Courier, monospace; padding: 20px; max-width: 400px; margin: auto; border: 1px dashed #ccc;">
          <div style="text-align: center; margin-bottom: 20px;">
            <h2 style="margin: 0;">RECIBO DE OCORRÊNCIA</h2>
            <p style="margin: 5px 0;">${storeName}</p>
            <hr/>
          </div>
          
          <p><strong>DATA:</strong> ${formattedDate}</p>
          <p><strong>FUNCIONÁRIO:</strong> ${data.userName}</p>
          <p><strong>OCORRÊNCIA:</strong> <span style="color: ${color}; font-weight: bold;">${data.type.toUpperCase()}</span></p>
          
          <div style="margin: 15px 0; padding: 10px; background: #f9f9f9; border: 1px solid #eee;">
            <p style="margin: 5px 0;">VALOR ESPERADO: ${formatCurrency(parseFloat(data.expectedValue.replace(',','.')))}</p>
            <p style="margin: 5px 0;">VALOR ENCONTRADO: ${formatCurrency(parseFloat(data.foundValue.replace(',','.')))}</p>
            <p style="margin: 5px 0; font-size: 1.2em;"><strong>DIFERENÇA: ${formatCurrency(Math.abs(data.difference))}</strong></p>
          </div>
 
          <p><strong>JUSTIFICATIVA:</strong><br/>${data.reason}</p>
          
          ${data.witnessName ? `<p><strong>TESTEMUNHA:</strong> ${data.witnessName} (${data.witnessRole})</p>` : ''}
 
          <div style="margin-top: 30px; border-top: 1px solid #000; padding-top: 10px; text-align: center;">
            <p style="font-size: 0.8em;">ASSINATURA DO FUNCIONÁRIO</p>
          </div>
 
          <div style="margin-top: 20px; font-size: 0.7em; text-align: center; color: #666;">
            ${isFalta ? 
              '* O valor da falta será descontado conforme política da empresa.' : 
              '* Sobras de caixa são registradas apenas para fins informativos e não são retiradas pelo funcionário.'}
          </div>
          
          <p style="text-align: center; font-size: 0.6em; margin-top: 20px;">ID: ${data.id}</p>
        </div>
      `;
 
      const html = `
        <html>
          <head><title>Recibo de Erro de Caixa</title></head>
          <body onload="window.print(); window.close();">
            ${content}
            <div style="margin-top: 50px; border-top: 2px dashed #000; padding-top: 50px;"></div>
            ${content}
          </body>
        </html>
      `;
 
      printWindow.document.write(html);
      printWindow.document.close();
  };
 
  const gerarRelatorioMensal = async () => {
      try {
          const { data: list, error: errList } = await supabase.rpc('fn_listar_erros_mes', {
              p_store_id: filterStoreId === 'all' ? null : filterStoreId,
              p_mes: filterMonth,
              p_ano: filterYear
          });
 
          const { data: totals, error: errTotals } = await supabase.rpc('fn_calcular_total_mensal_descontos', {
              p_store_id: filterStoreId === 'all' ? null : filterStoreId,
              p_mes: filterMonth,
              p_ano: filterYear
          });
 
          if (errList || errTotals) throw errList || errTotals;
 
          const printWindow = window.open('', '_blank', 'width=900,height=1200');
          if (!printWindow) return;
 
          const mesNome = MONTHS.find(m => m.value === filterMonth)?.label;
          const storeName = filterStoreId === 'all' ? 'TODAS AS LOJAS' : stores.find(s => s.id === filterStoreId)?.name;
 
          const html = `
            <html>
              <head>
                <title>Relatório Mensal de Erros</title>
                <style>
                  body { font-family: sans-serif; padding: 40px; color: #333; }
                  table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                  th, td { padding: 10px; border: 1px solid #ddd; text-align: left; font-size: 12px; }
                  th { background: #f4f4f4; }
                  .header { text-align: center; margin-bottom: 30px; }
                  .summary { margin-top: 30px; padding: 20px; background: #f9f9f9; border-radius: 8px; }
                  .falta { color: #dc2626; font-weight: bold; }
                  .sobra { color: #16a34a; font-weight: bold; }
                </style>
              </head>
              <body onload="window.print()">
                <div class="header">
                  <h2>RELATÓRIO MENSAL DE ERROS DE CAIXA</h2>
                  <p>${storeName} - ${mesNome} / ${filterYear}</p>
                </div>
 
                <table>
                  <thead>
                    <tr>
                      <th>DATA</th>
                      <th>FUNCIONÁRIO</th>
                      <th>TIPO</th>
                      <th>VALOR</th>
                      <th>JUSTIFICATIVA</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${list.map((e: any) => `
                      <tr>
                        <td>${new Date(e.error_date + 'T12:00:00').toLocaleDateString('pt-BR')}</td>
                        <td>${e.user_name}</td>
                        <td class="${e.tipo_diferenca}">${e.tipo_diferenca.toUpperCase()}</td>
                        <td>${formatCurrency(e.diferenca)}</td>
                        <td>${e.reason}</td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
 
                <div class="summary">
                  <h3>RESUMO FINANCEIRO</h3>
                  <p>Total de Faltas: <span class="falta">${formatCurrency(totals.total_faltas)}</span></p>
                  <p>Total de Sobras: <span class="sobra">${formatCurrency(totals.total_sobras)}</span></p>
                  <hr/>
                  <p><strong>TOTAL A DESCONTAR: ${formatCurrency(totals.total_descontos)}</strong></p>
                  <p style="font-size: 0.8em; color: #666;">* Apenas as faltas são consideradas para desconto.</p>
                </div>
              </body>
            </html>
          `;
 
          printWindow.document.write(html);
          printWindow.document.close();
      } catch (err) {
          console.error(err);
          alert("Erro ao gerar relatório.");
      }
  };
 
  return (
    <div className="p-6 md:p-8 max-w-[1600px] mx-auto space-y-8">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div>
                <h2 className="text-3xl font-bold text-gray-800 flex items-center gap-3"><AlertOctagon className="text-red-600" size={32} /> Erros de Caixa</h2>
                <p className="text-gray-500 mt-1">Módulo profissional para registro e controle de quebras.</p>
            </div>
            <div className="flex bg-white p-1 rounded-lg border shadow-sm">
                {canEdit && (
                    <button 
                        onClick={() => setActiveTab('new')} 
                        className={`px-6 py-2 rounded-md text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'new' ? 'bg-red-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'}`}
                    >
                        <Plus size={18} /> Novo Lançamento
                    </button>
                )}
                <button 
                    onClick={() => setActiveTab('list')} 
                    className={`px-6 py-2 rounded-md text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'list' ? 'bg-gray-800 text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'}`}
                >
                    <FileText size={18} /> Histórico e Relatórios
                </button>
            </div>
        </div>
 
        {activeTab === 'new' && canEdit && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
                <div className="lg:col-span-2 bg-white p-8 rounded-2xl shadow-xl border border-gray-100">
                    <form onSubmit={handleRegistrarEImprimir} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {isAdmin && (
                                <div className="md:col-span-2">
                                    <label className="block text-xs font-black text-gray-400 uppercase mb-2 ml-1">Loja Destino</label>
                                    <select 
                                        value={formData.storeId} 
                                        onChange={e => setFormData({...formData, storeId: e.target.value})} 
                                        className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl font-bold text-gray-700 outline-none focus:ring-2 focus:ring-red-500 transition-all"
                                    >
                                        {stores.map(s => <option key={s.id} value={s.id}>{s.number} - {s.name}</option>)}
                                    </select>
                                </div>
                            )}
                            
                            <div>
                                <label className="block text-xs font-black text-gray-400 uppercase mb-2 ml-1">Data da Ocorrência</label>
                                <input 
                                    type="date" 
                                    required 
                                    value={formData.date} 
                                    onChange={e => setFormData({...formData, date: e.target.value})} 
                                    className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl font-bold text-gray-700 outline-none focus:ring-2 focus:ring-red-500 transition-all" 
                                />
                            </div>
 
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-black text-gray-400 uppercase mb-2 ml-1">Valor Esperado</label>
                                    <input 
                                        type="text" 
                                        required 
                                        placeholder="0,00"
                                        value={formData.expectedValue} 
                                        onChange={e => setFormData({...formData, expectedValue: e.target.value})} 
                                        className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl font-bold text-gray-700 outline-none focus:ring-2 focus:ring-red-500 transition-all" 
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-black text-gray-400 uppercase mb-2 ml-1">Valor Encontrado</label>
                                    <input 
                                        type="text" 
                                        required 
                                        placeholder="0,00"
                                        value={formData.foundValue} 
                                        onChange={e => setFormData({...formData, foundValue: e.target.value})} 
                                        className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl font-bold text-gray-700 outline-none focus:ring-2 focus:ring-red-500 transition-all" 
                                    />
                                </div>
                            </div>
                        </div>
 
                        <div>
                            <label className="block text-xs font-black text-gray-400 uppercase mb-2 ml-1">Justificativa / Motivo</label>
                            <textarea 
                                required 
                                value={formData.reason} 
                                onChange={e => setFormData({...formData, reason: e.target.value})} 
                                placeholder="Descreva o motivo da diferença encontrada..."
                                className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl font-bold text-gray-700 h-32 outline-none focus:ring-2 focus:ring-red-500 transition-all resize-none" 
                            />
                        </div>
 
                        <div className="bg-gray-50 p-6 rounded-xl border border-dashed border-gray-300 space-y-4">
                            <h4 className="text-xs font-black text-gray-400 uppercase">Testemunha (Opcional)</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <input 
                                    type="text" 
                                    placeholder="Nome da Testemunha"
                                    value={formData.witnessName} 
                                    onChange={e => setFormData({...formData, witnessName: e.target.value})} 
                                    className="w-full p-3 bg-white border border-gray-200 rounded-lg font-bold text-gray-700 outline-none" 
                                />
                                <input 
                                    type="text" 
                                    placeholder="Função da Testemunha"
                                    value={formData.witnessRole} 
                                    onChange={e => setFormData({...formData, witnessRole: e.target.value})} 
                                    className="w-full p-3 bg-white border border-gray-200 rounded-lg font-bold text-gray-700 outline-none" 
                                />
                            </div>
                        </div>
 
                        <button 
                            type="submit" 
                            disabled={isSubmitting} 
                            className="w-full py-5 bg-red-600 hover:bg-red-700 text-white rounded-2xl font-black text-lg shadow-lg shadow-red-200 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                        >
                            {isSubmitting ? <Loader2 className="animate-spin" /> : <><Printer size={24} /> REGISTRAR E IMPRIMIR RECIBO</>}
                        </button>
                    </form>
                </div>
 
                <div className="space-y-6">
                    <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-100">
                        <h3 className="text-sm font-black text-gray-400 uppercase mb-4">Resumo do Lançamento</h3>
                        <div className="space-y-4">
                            <div className="flex justify-between items-center p-4 bg-gray-50 rounded-xl">
                                <span className="text-gray-500 font-bold">Diferença</span>
                                <span className={`text-xl font-black ${difference < 0 ? 'text-red-600' : difference > 0 ? 'text-green-600' : 'text-gray-400'}`}>
                                    {formatCurrency(Math.abs(difference))}
                                </span>
                            </div>
                            <div className="flex justify-between items-center p-4 bg-gray-50 rounded-xl">
                                <span className="text-gray-500 font-bold">Tipo</span>
                                <span className={`px-3 py-1 rounded-full text-xs font-black uppercase ${difference < 0 ? 'bg-red-100 text-red-600' : difference > 0 ? 'bg-green-100 text-green-600' : 'bg-gray-200 text-gray-500'}`}>
                                    {type === 'falta' ? 'FALTA (DEDUTÍVEL)' : type === 'sobra' ? 'SOBRA (NÃO DEDUTÍVEL)' : 'OK'}
                                </span>
                            </div>
                        </div>
                        {type === 'sobra' && (
                            <div className="mt-4 p-4 bg-green-50 border border-green-100 rounded-xl flex gap-3">
                                <TrendingUp className="text-green-600 shrink-0" size={20} />
                                <p className="text-[10px] text-green-800 font-bold leading-tight">
                                    Sobras de caixa são registradas para fins de auditoria, mas não são retiradas pelo funcionário nem compensam faltas futuras.
                                </p>
                            </div>
                        )}
                        {type === 'falta' && (
                            <div className="mt-4 p-4 bg-red-50 border border-red-100 rounded-xl flex gap-3">
                                <TrendingDown className="text-red-600 shrink-0" size={20} />
                                <p className="text-[10px] text-red-800 font-bold leading-tight">
                                    Faltas de caixa serão descontadas do funcionário responsável conforme a política de quebra de caixa da empresa.
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        )}
 
        {activeTab === 'list' && (
            <div className="space-y-6 animate-in fade-in duration-300">
                <div className="bg-white p-6 rounded-2xl border shadow-sm flex flex-col md:flex-row justify-between items-center gap-4">
                    <div className="flex items-center gap-4 w-full md:w-auto">
                        <div className="flex gap-2">
                            <select 
                                value={filterMonth} 
                                onChange={e => setFilterMonth(Number(e.target.value))} 
                                className="p-3 bg-gray-50 border border-gray-200 rounded-xl font-bold text-sm text-gray-700 outline-none cursor-pointer"
                            >
                                {MONTHS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                            </select>
                            <select 
                                value={filterYear} 
                                onChange={e => setFilterYear(Number(e.target.value))} 
                                className="p-3 bg-gray-50 border border-gray-200 rounded-xl font-bold text-sm text-gray-700 outline-none cursor-pointer"
                            >
                                {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
                            </select>
                        </div>
                        
                        {isAdmin && (
                            <select 
                                value={filterStoreId} 
                                onChange={e => setFilterStoreId(e.target.value)} 
                                className="p-3 bg-gray-50 border border-gray-200 rounded-xl font-bold text-sm text-gray-700 outline-none cursor-pointer min-w-[200px]"
                            >
                                <option value="all">Todas as Lojas</option>
                                {stores.map(s => <option key={s.id} value={s.id}>{s.number} - {s.name}</option>)}
                            </select>
                        )}
                    </div>
                    
                    <button 
                        onClick={gerarRelatorioMensal} 
                        className="w-full md:w-auto bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-xl font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-blue-100 transition-all"
                    >
                        <Printer size={18} /> GERAR RELATÓRIO MENSAL CONSOLIDADO
                    </button>
                </div>
 
                <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="bg-gray-50 border-b border-gray-100">
                                    <th className="p-5 text-xs font-black text-gray-400 uppercase">Data</th>
                                    <th className="p-5 text-xs font-black text-gray-400 uppercase">Funcionário</th>
                                    <th className="p-5 text-xs font-black text-gray-400 uppercase">Tipo</th>
                                    <th className="p-5 text-xs font-black text-gray-400 uppercase text-right">Valor</th>
                                    <th className="p-5 text-xs font-black text-gray-400 uppercase">Motivo</th>
                                    <th className="p-5 text-xs font-black text-gray-400 uppercase text-center">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {filteredErrors.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="p-20 text-center text-gray-400 font-bold">
                                            Nenhuma ocorrência encontrada para este período.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredErrors.map((err) => (
                                        <tr key={err.id} className="hover:bg-gray-50 transition-colors group">
                                            <td className="p-5">
                                                <div className="flex items-center gap-3">
                                                    <Calendar size={16} className="text-gray-400" />
                                                    <span className="font-bold text-gray-700">{new Date(err.date + 'T12:00:00').toLocaleDateString('pt-BR')}</span>
                                                </div>
                                            </td>
                                            <td className="p-5">
                                                <span className="font-bold text-gray-600">{err.userName}</span>
                                            </td>
                                            <td className="p-5">
                                                <span className={`px-3 py-1 rounded-full text-[10px] font-black ${err.type === 'surplus' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                    {err.type === 'surplus' ? 'SOBRA' : 'FALTA'}
                                                </span>
                                            </td>
                                            <td className={`p-5 text-right font-black ${err.type === 'surplus' ? 'text-green-600' : 'text-red-600'}`}>
                                                {formatCurrency(err.value)}
                                            </td>
                                            <td className="p-5">
                                                <p className="text-gray-500 text-xs line-clamp-1 max-w-xs">{err.reason}</p>
                                            </td>
                                            <td className="p-5">
                                                <div className="flex justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button 
                                                        onClick={() => imprimirReciboIndividual({
                                                            date: err.date,
                                                            expectedValue: '0', // Não temos no histórico simplificado, mas o recibo foca na diferença
                                                            foundValue: '0',
                                                            difference: err.value,
                                                            type: err.type === 'surplus' ? 'sobra' : 'falta',
                                                            reason: err.reason,
                                                            userName: err.userName,
                                                            storeName: stores.find(s => s.id === err.storeId)?.name || 'LOJA',
                                                            id: err.id
                                                        })} 
                                                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                        title="Reimprimir Recibo"
                                                    >
                                                        <Printer size={18} />
                                                    </button>
                                                    {isAdmin && (
                                                        <button 
                                                            onClick={() => onDeleteError(err.id)} 
                                                            className="p-2 text-red-400 hover:bg-red-50 rounded-lg transition-colors"
                                                            title="Excluir Registro"
                                                        >
                                                            <Trash2 size={18} />
                                                        </button>
                                                    )}
                                                </div>
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
 
export default CashErrorsModule;