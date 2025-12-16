
import React, { useState, useMemo } from 'react';
import { User, Store, CashError, UserRole } from '../types';
import { formatCurrency } from '../constants';
import { AlertOctagon, TrendingUp, TrendingDown, Plus, Trash2, Calendar, Edit, X, Filter, Search, Printer } from 'lucide-react';

interface CashErrorsModuleProps {
  user: User;
  store?: Store;
  stores: Store[];
  errors: CashError[];
  onAddError: (error: CashError) => void;
  onUpdateError: (error: CashError) => void;
  onDeleteError: (id: string) => void;
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
  
  // Filters State
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
      type: 'shortage', // Default to shortage as it's more critical
      value: '',
      reason: '',
      storeId: store?.id || (stores.length > 0 ? stores[0].id : '')
  });

  const isAdmin = user.role === UserRole.ADMIN;
  const isManager = user.role === UserRole.MANAGER;
  const canEdit = !isManager; // Only Admin and Cashier can edit/add

  // Determine available years for filter
  const availableYears = useMemo(() => {
      const years = new Set<number>();
      years.add(new Date().getFullYear());
      errors.forEach(e => {
          const y = parseInt(e.date.split('-')[0]);
          if (!isNaN(y)) years.add(y);
      });
      return Array.from(years).sort((a,b) => b - a);
  }, [errors]);

  // Filter errors based on role AND UI filters
  const filteredErrors = useMemo(() => {
      return errors.filter(e => {
          // 1. Role Security Filter
          if (!isAdmin && e.storeId !== user.storeId) return false;

          // 2. UI Store Filter (Admin only)
          if (isAdmin && filterStoreId !== 'all' && e.storeId !== filterStoreId) return false;

          // 3. Date Filter (Month/Year)
          const [y, m, d] = e.date.split('-').map(Number);
          if (y !== filterYear) return false;
          if (m !== filterMonth) return false;

          return true;
      }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()); // Sort ascending for report reading
  }, [errors, isAdmin, user.storeId, filterStoreId, filterMonth, filterYear]);

  // Calculate Totals for the filtered view
  const summary = useMemo(() => {
      let surplus = 0;
      let shortage = 0;
      filteredErrors.forEach(e => {
          if (e.type === 'surplus') surplus += e.value;
          else shortage += e.value;
      });
      return { surplus, shortage, balance: surplus - shortage };
  }, [filteredErrors]);

  const handleSave = (e: React.FormEvent) => {
      e.preventDefault();
      const val = parseFloat(formData.value.replace(/\./g, '').replace(',', '.'));
      
      if (isNaN(val) || val <= 0) {
          alert("Valor inválido.");
          return;
      }

      if (!formData.reason) {
          alert("Informe o motivo.");
          return;
      }

      if (editingId) {
          const original = errors.find(err => err.id === editingId);
          if (original) {
              onUpdateError({
                  ...original,
                  date: formData.date,
                  type: formData.type,
                  value: val,
                  reason: formData.reason,
                  storeId: formData.storeId
              });
          }
          setEditingId(null);
      } else {
          const newError: CashError = {
              id: `err-${Date.now()}-${Math.random()}`,
              storeId: formData.storeId,
              userId: user.id,
              userName: user.name,
              date: formData.date,
              type: formData.type,
              value: val,
              reason: formData.reason,
              createdAt: new Date()
          };
          onAddError(newError);
      }
      
      // Reset form
      setFormData(prev => ({ ...prev, value: '', reason: '' }));
      setActiveTab('list');
  };

  const handleEdit = (err: CashError) => {
      setEditingId(err.id);
      setFormData({
          date: err.date,
          type: err.type,
          value: err.value.toFixed(2).replace('.', ','),
          reason: err.reason || '',
          storeId: err.storeId
      });
      setActiveTab('new');
  };

  const handlePrintReport = () => {
      const printWindow = window.open('', '_blank', 'width=900,height=1200');
      if (!printWindow) {
          alert("Permita pop-ups para imprimir.");
          return;
      }

      const monthName = MONTHS.find(m => m.value === filterMonth)?.label;
      
      // Determine Context Info for Header
      let storeName = store ? store.name : 'Todas as Lojas';
      let managerName = store ? store.managerName : 'Gerente Responsável';
      
      if (isAdmin && filterStoreId !== 'all') {
          const s = stores.find(st => st.id === filterStoreId);
          if (s) {
              storeName = s.name;
              managerName = s.managerName;
          }
      }

      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Relatório de Quebra de Caixa</title>
            <style>
                body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 30px; font-size: 12px; color: #333; }
                .header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #000; pb: 10px; }
                h1 { margin: 0; font-size: 20px; text-transform: uppercase; font-weight: 800; }
                .subtitle { font-size: 14px; margin-top: 5px; }
                
                .info-box { 
                    border: 1px solid #ccc; 
                    padding: 10px; 
                    margin-bottom: 20px; 
                    background-color: #f9fafb;
                    border-radius: 4px;
                }
                .info-row { display: flex; justify-content: space-between; margin-bottom: 5px; }
                .info-label { font-weight: bold; color: #555; }
                
                table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
                th { background-color: #e5e7eb; padding: 10px 8px; text-align: left; border-bottom: 2px solid #999; font-size: 11px; text-transform: uppercase; }
                td { padding: 8px; border-bottom: 1px solid #eee; font-size: 11px; }
                .text-right { text-align: right; }
                .text-center { text-align: center; }
                .text-red { color: #dc2626; font-weight: bold; }
                .text-green { color: #16a34a; font-weight: bold; }
                
                .summary-container {
                    display: flex;
                    justify-content: flex-end;
                    margin-top: 10px;
                }
                .summary-table { width: 300px; border: 1px solid #000; }
                .summary-row { display: flex; justify-content: space-between; padding: 8px; border-bottom: 1px solid #ccc; }
                .summary-row:last-child { border-bottom: none; background-color: #f3f4f6; }
                .sum-label { font-weight: bold; }
                
                /* Termo de Reconhecimento */
                .term-box {
                    margin-top: 40px;
                    border: 2px solid #dc2626;
                    background-color: #fff5f5;
                    padding: 20px;
                    border-radius: 8px;
                }
                .term-title {
                    font-weight: bold;
                    text-transform: uppercase;
                    text-align: center;
                    margin-bottom: 15px;
                    color: #991b1b;
                    font-size: 14px;
                }
                .term-text {
                    font-size: 12px;
                    line-height: 1.6;
                    text-align: justify;
                    margin-bottom: 10px;
                }
                .term-value {
                    font-size: 16px;
                    font-weight: bold;
                    color: #dc2626;
                    text-decoration: underline;
                }

                .signatures {
                    margin-top: 60px;
                    display: flex;
                    justify-content: space-between;
                    gap: 40px;
                }
                .sig-line {
                    flex: 1;
                    border-top: 1px solid #000;
                    text-align: center;
                    padding-top: 5px;
                }
                .sig-name { font-weight: bold; text-transform: uppercase; font-size: 11px; }
                .sig-role { font-size: 10px; color: #666; }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>REAL CALÇADOS</h1>
                <p class="subtitle">Relatório de Controle de Quebra de Caixa</p>
            </div>

            <div class="info-box">
                <div class="info-row">
                    <span><span class="info-label">Unidade:</span> ${storeName}</span>
                    <span><span class="info-label">Período:</span> ${monthName}/${filterYear}</span>
                </div>
                <div class="info-row">
                    <span><span class="info-label">Responsável pelo Caixa:</span> ${user.name}</span>
                    <span><span class="info-label">Data Emissão:</span> ${new Date().toLocaleDateString('pt-BR')}</span>
                </div>
            </div>

            <table>
                <thead>
                    <tr>
                        <th style="width: 15%">Data</th>
                        <th style="width: 15%">Tipo</th>
                        <th style="width: 40%">Motivo / Observação</th>
                        <th style="width: 15%">Responsável</th>
                        <th style="width: 15%" class="text-right">Valor</th>
                    </tr>
                </thead>
                <tbody>
                    ${filteredErrors.map(err => {
                        const [y, m, d] = err.date.split('-').map(Number);
                        const dateStr = new Date(y, m - 1, d).toLocaleDateString('pt-BR');
                        const isSurplus = err.type === 'surplus';
                        return `
                            <tr>
                                <td>${dateStr}</td>
                                <td class="${isSurplus ? 'text-green' : 'text-red'}">
                                    ${isSurplus ? 'SOBRA (+)' : 'FALTA (-)'}
                                </td>
                                <td>${err.reason}</td>
                                <td>${err.userName.split(' ')[0]}</td>
                                <td class="text-right ${isSurplus ? 'text-green' : 'text-red'}">
                                    ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(err.value)}
                                </td>
                            </tr>
                        `;
                    }).join('')}
                    ${filteredErrors.length === 0 ? '<tr><td colspan="5" class="text-center">Nenhum registro encontrado.</td></tr>' : ''}
                </tbody>
            </table>

            <div class="summary-container">
                <div class="summary-table">
                    <div class="summary-row">
                        <span class="sum-label text-green">Total Sobras (+)</span>
                        <span class="text-green">${formatCurrency(summary.surplus)}</span>
                    </div>
                    <div class="summary-row">
                        <span class="sum-label text-red">Total Faltas (-)</span>
                        <span class="text-red">${formatCurrency(summary.shortage)}</span>
                    </div>
                    <div class="summary-row">
                        <span class="sum-label">Saldo do Período</span>
                        <span style="font-weight:bold">${formatCurrency(summary.balance)}</span>
                    </div>
                </div>
            </div>

            ${summary.shortage > 0 ? `
            <div class="term-box">
                <div class="term-title">TERMO DE RECONHECIMENTO DE DIFERENÇA DE CAIXA</div>
                <div class="term-text">
                    Eu, <b>${user.name.toUpperCase()}</b>, declaro ter acompanhado a conferência dos valores acima descritos e RECONHEÇO a existência de diferença de caixa (FALTA) no valor total de:
                </div>
                <div style="text-align: center; margin: 15px 0;">
                    <span class="term-value">${formatCurrency(summary.shortage)}</span>
                </div>
                <div class="term-text">
                    Estou ciente de que a responsabilidade pela guarda e conferência dos valores é inerente à minha função, autorizando, se necessário, o desconto conforme previsto no Art. 462 da CLT e no regulamento interno da empresa.
                </div>
            </div>
            ` : ''}

            <div class="signatures">
                <div class="sig-line">
                    <div class="sig-name">${user.name}</div>
                    <div class="sig-role">Operador de Caixa / Responsável</div>
                </div>
                <div class="sig-line">
                    <div class="sig-name">${managerName}</div>
                    <div class="sig-role">Gerente da Loja</div>
                </div>
            </div>

            <script>
                window.onload = function() { setTimeout(function() { window.print(); }, 500); }
            </script>
        </body>
        </html>
      `;

      printWindow.document.write(htmlContent);
      printWindow.document.close();
  };

  return (
    <div className="p-6 md:p-8 max-w-[1600px] mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div>
                <h2 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
                    <AlertOctagon className="text-red-600" size={32} />
                    Controle de Quebra de Caixa
                </h2>
                <p className="text-gray-500 mt-1">
                    {isManager ? 'Histórico de ocorrências da sua loja.' : 'Registro de sobras e faltas no fechamento.'}
                </p>
            </div>
            
            <div className="flex bg-white p-1 rounded-lg border border-gray-200 shadow-sm">
                <button 
                    onClick={() => { setActiveTab('list'); setEditingId(null); }} 
                    className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${activeTab === 'list' ? 'bg-gray-800 text-white shadow' : 'text-gray-500 hover:text-gray-800'}`}
                >
                    Histórico
                </button>
                {canEdit && (
                    <button 
                        onClick={() => setActiveTab('new')} 
                        className={`px-4 py-2 rounded-md text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'new' ? 'bg-red-600 text-white shadow' : 'text-gray-500 hover:text-gray-800'}`}
                    >
                        <Plus size={16} /> Lançar Ocorrência
                    </button>
                )}
            </div>
        </div>

        {/* FORM VIEW (Restricted to Non-Managers) */}
        {activeTab === 'new' && canEdit && (
            <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200 max-w-2xl mx-auto animate-in fade-in zoom-in duration-200">
                <div className="flex justify-between items-center mb-6 border-b border-gray-100 pb-4">
                    <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                        {editingId ? <Edit className="text-blue-600" size={24}/> : <Plus className="text-red-600" size={24}/>}
                        {editingId ? 'Editar Ocorrência' : 'Nova Ocorrência'}
                    </h3>
                    <button onClick={() => { setActiveTab('list'); setEditingId(null); }} className="text-gray-400 hover:text-gray-600">
                        <X size={24} />
                    </button>
                </div>

                <form onSubmit={handleSave} className="space-y-5">
                    {/* Admin Store Selection */}
                    {isAdmin && (
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Loja</label>
                            <select 
                                value={formData.storeId}
                                onChange={e => setFormData({...formData, storeId: e.target.value})}
                                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white text-gray-900"
                            >
                                {stores.map(s => <option key={s.id} value={s.id}>{s.number} - {s.name}</option>)}
                            </select>
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Data</label>
                            <div className="relative">
                                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={18} />
                                <input 
                                    type="date"
                                    required
                                    value={formData.date}
                                    onChange={e => setFormData({...formData, date: e.target.value})}
                                    className="w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white text-gray-900"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Tipo</label>
                            <div className="flex bg-gray-100 p-1 rounded-lg">
                                <button 
                                    type="button"
                                    onClick={() => setFormData({...formData, type: 'shortage'})}
                                    className={`flex-1 py-2 rounded-md text-sm font-bold flex items-center justify-center gap-1 transition-all ${formData.type === 'shortage' ? 'bg-white text-red-600 shadow-sm' : 'text-gray-500'}`}
                                >
                                    <TrendingDown size={16}/> Falta
                                </button>
                                <button 
                                    type="button"
                                    onClick={() => setFormData({...formData, type: 'surplus'})}
                                    className={`flex-1 py-2 rounded-md text-sm font-bold flex items-center justify-center gap-1 transition-all ${formData.type === 'surplus' ? 'bg-white text-green-600 shadow-sm' : 'text-gray-500'}`}
                                >
                                    <TrendingUp size={16}/> Sobra
                                </button>
                            </div>
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Valor (R$)</label>
                        <input 
                            required
                            value={formData.value}
                            onChange={e => setFormData({...formData, value: e.target.value})}
                            placeholder="0,00"
                            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-xl font-bold text-gray-900 bg-white"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Motivo / Justificativa</label>
                        <textarea 
                            required
                            value={formData.reason}
                            onChange={e => setFormData({...formData, reason: e.target.value})}
                            placeholder="Descreva o motivo da diferença..."
                            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none h-24 resize-none bg-white text-gray-900"
                        />
                    </div>

                    <button 
                        type="submit"
                        className={`w-full py-3 rounded-lg font-bold text-white shadow-md transition-colors flex items-center justify-center gap-2 ${editingId ? 'bg-blue-600 hover:bg-blue-700' : 'bg-red-600 hover:bg-red-700'}`}
                    >
                        {editingId ? 'Atualizar Registro' : 'Registrar Ocorrência'}
                    </button>
                </form>
            </div>
        )}

        {/* LIST VIEW */}
        {activeTab === 'list' && (
            <div className="space-y-6">
                
                {/* FILTERS BAR */}
                <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex flex-col md:flex-row gap-4 items-center justify-between">
                    <div className="flex items-center gap-2 text-gray-700 font-bold">
                        <Filter size={20} className="text-blue-600"/>
                        <span>Filtros:</span>
                    </div>

                    <div className="flex flex-wrap gap-3 w-full md:w-auto items-center">
                        {/* Store Filter (Admin Only) */}
                        {isAdmin && (
                            <div className="relative">
                                <select 
                                    value={filterStoreId}
                                    onChange={(e) => setFilterStoreId(e.target.value)}
                                    className="appearance-none pl-3 pr-8 py-2 bg-gray-50 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer min-w-[200px]"
                                >
                                    <option value="all">Todas as Lojas</option>
                                    {stores.filter(s => s.status === 'active').map(s => (
                                        <option key={s.id} value={s.id}>{s.number} - {s.name}</option>
                                    ))}
                                </select>
                                <div className="absolute right-3 top-2.5 pointer-events-none text-gray-500">
                                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                                </div>
                            </div>
                        )}

                        {/* Month Filter */}
                        <div className="relative">
                            <select 
                                value={filterMonth}
                                onChange={(e) => setFilterMonth(parseInt(e.target.value))}
                                className="appearance-none pl-3 pr-8 py-2 bg-gray-50 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer"
                            >
                                {MONTHS.map(m => (
                                    <option key={m.value} value={m.value}>{m.label}</option>
                                ))}
                            </select>
                            <div className="absolute right-3 top-2.5 pointer-events-none text-gray-500">
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                            </div>
                        </div>

                        {/* Year Filter */}
                        <div className="relative">
                            <select 
                                value={filterYear}
                                onChange={(e) => setFilterYear(parseInt(e.target.value))}
                                className="appearance-none pl-3 pr-8 py-2 bg-gray-50 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer"
                            >
                                {availableYears.map(y => (
                                    <option key={y} value={y}>{y}</option>
                                ))}
                            </select>
                            <div className="absolute right-3 top-2.5 pointer-events-none text-gray-500">
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                            </div>
                        </div>

                        {/* PRINT BUTTON */}
                        <button 
                            onClick={handlePrintReport}
                            className="flex items-center gap-2 bg-blue-700 text-white px-4 py-2 rounded-lg font-bold text-sm shadow-md hover:bg-blue-800 transition-colors ml-2"
                        >
                            <Printer size={16} /> Imprimir Relatório
                        </button>
                    </div>
                </div>

                {/* SUMMARY CARDS */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-red-50 border border-red-100 p-4 rounded-xl flex justify-between items-center">
                        <div>
                            <p className="text-xs text-red-600 font-bold uppercase">Total de Faltas</p>
                            <p className="text-xl font-bold text-red-800">{formatCurrency(summary.shortage)}</p>
                        </div>
                        <div className="p-2 bg-red-100 rounded-lg text-red-600"><TrendingDown size={20}/></div>
                    </div>
                    <div className="bg-green-50 border border-green-100 p-4 rounded-xl flex justify-between items-center">
                        <div>
                            <p className="text-xs text-green-600 font-bold uppercase">Total de Sobras</p>
                            <p className="text-xl font-bold text-green-800">{formatCurrency(summary.surplus)}</p>
                        </div>
                        <div className="p-2 bg-green-100 rounded-lg text-green-600"><TrendingUp size={20}/></div>
                    </div>
                    <div className={`border p-4 rounded-xl flex justify-between items-center ${summary.balance >= 0 ? 'bg-blue-50 border-blue-100' : 'bg-orange-50 border-orange-100'}`}>
                        <div>
                            <p className={`text-xs font-bold uppercase ${summary.balance >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>Saldo do Período</p>
                            <p className={`text-xl font-bold ${summary.balance >= 0 ? 'text-blue-800' : 'text-orange-800'}`}>{formatCurrency(summary.balance)}</p>
                        </div>
                        <div className={`p-2 rounded-lg ${summary.balance >= 0 ? 'bg-blue-100 text-blue-600' : 'bg-orange-100 text-orange-600'}`}>
                            {summary.balance >= 0 ? <TrendingUp size={20}/> : <TrendingDown size={20}/>}
                        </div>
                    </div>
                </div>

                {/* TABLE */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gray-50 text-gray-500 font-semibold border-b border-gray-100">
                            <tr>
                                <th className="p-4 w-32">Data</th>
                                <th className="p-4 w-32">Tipo</th>
                                <th className="p-4 w-32 text-right">Valor</th>
                                <th className="p-4">Motivo</th>
                                <th className="p-4">Responsável</th>
                                <th className="p-4 w-24 text-center">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {filteredErrors.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="p-12 text-center text-gray-400">
                                        Nenhuma ocorrência encontrada para os filtros selecionados.
                                    </td>
                                </tr>
                            ) : (
                                filteredErrors.map((err) => (
                                    <tr key={err.id} className="hover:bg-blue-50/30 transition-colors group">
                                        <td className="p-4 text-gray-600 font-mono text-xs">
                                            {/* Fix: construct date from parts to avoid timezone offset issues */}
                                            {(() => {
                                                if (!err.date) return '-';
                                                const [y, m, d] = err.date.split('-').map(Number);
                                                return new Date(y, m - 1, d).toLocaleDateString('pt-BR');
                                            })()}
                                        </td>
                                        <td className="p-4">
                                            {err.type === 'surplus' ? (
                                                <span className="inline-flex items-center gap-1 bg-green-100 text-green-700 px-2 py-1 rounded text-[10px] font-bold border border-green-200">
                                                    <TrendingUp size={10}/> SOBRA
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 bg-red-100 text-red-700 px-2 py-1 rounded text-[10px] font-bold border border-red-200">
                                                    <TrendingDown size={10}/> FALTA
                                                </span>
                                            )}
                                        </td>
                                        <td className={`p-4 text-right font-bold ${err.type === 'surplus' ? 'text-green-700' : 'text-red-700'}`}>
                                            {formatCurrency(err.value)}
                                        </td>
                                        <td className="p-4 text-gray-700 max-w-md truncate" title={err.reason}>
                                            {err.reason}
                                        </td>
                                        <td className="p-4 text-gray-600 text-xs">
                                            {err.userName}
                                        </td>
                                        <td className="p-4 text-center">
                                            {canEdit && (
                                                <div className="flex justify-center gap-2 opacity-60 group-hover:opacity-100 transition-opacity">
                                                    <button 
                                                        onClick={() => handleEdit(err)}
                                                        className="p-1.5 text-blue-500 hover:bg-blue-100 rounded-md transition-colors"
                                                        title="Editar"
                                                    >
                                                        <Edit size={16} />
                                                    </button>
                                                    <button 
                                                        onClick={() => onDeleteError(err.id)}
                                                        className="p-1.5 text-red-400 hover:bg-red-100 rounded-md transition-colors"
                                                        title="Excluir"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        )}
    </div>
  );
};

export default CashErrorsModule;
