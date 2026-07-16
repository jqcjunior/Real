import React, { useState, useEffect, useMemo } from 'react';
import { X, Search, Loader2, Check, DollarSign, Calendar, Sliders } from 'lucide-react';
import { supabase } from '../../services/supabaseClient';
import { toast } from 'sonner';

interface Store {
  id: string;
  number: string;
  name: string;
  city: string;
  status?: string;
}

interface IncluirCotaModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  stores: Store[];
}

const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

export default function IncluirCotaModal({ isOpen, onClose, onSuccess, stores }: IncluirCotaModalProps) {
  const [selectedStoreNumber, setSelectedStoreNumber] = useState<string>('');
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [storeSearch, setStoreSearch] = useState<string>('');
  const [showStoreDropdown, setShowStoreDropdown] = useState<boolean>(false);
  
  const [generalValue, setGeneralValue] = useState<number>(0);
  const [generalDisplayValue, setGeneralDisplayValue] = useState<string>('');
  const [applying, setApplying] = useState<boolean>(false);
  const [loadingMonths, setLoadingMonths] = useState<boolean>(false);

  // 12 months state for inline editing
  const [monthsData, setMonthsData] = useState<Array<{
    month: number;
    cota_valor: number;
    displayValue: string;
    original_cota_valor: number;
    saving: boolean;
    hasChanges: boolean;
  }>>(
    Array.from({ length: 12 }, (_, i) => ({
      month: i + 1,
      cota_valor: 0,
      displayValue: '',
      original_cota_valor: 0,
      saving: false,
      hasChanges: false
    }))
  );

  // Filter stores based on search input
  const filteredStores = useMemo(() => {
    return stores.filter(s => 
      s.number.includes(storeSearch) || 
      s.name.toLowerCase().includes(storeSearch.toLowerCase()) ||
      s.city.toLowerCase().includes(storeSearch.toLowerCase())
    );
  }, [stores, storeSearch]);

  // Selected store object
  const selectedStore = useMemo(() => {
    return stores.find(s => s.number === selectedStoreNumber);
  }, [stores, selectedStoreNumber]);

  // Load existing quotas when store/year changes
  useEffect(() => {
    if (selectedStoreNumber) {
      loadExistingQuotas();
    } else {
      // Clear months if no store selected
      setMonthsData(prev => prev.map(m => ({
        ...m,
        cota_valor: 0,
        displayValue: '',
        original_cota_valor: 0,
        hasChanges: false
      })));
    }
  }, [selectedStoreNumber, selectedYear]);

  const loadExistingQuotas = async () => {
    setLoadingMonths(true);
    try {
      const { data, error } = await supabase
        .from('buyorder_parameters_store')
        .select('*')
        .eq('store_number', selectedStoreNumber)
        .eq('year', selectedYear);

      if (error) throw error;

      const existingMap = new Map<number, number>();
      if (data) {
        data.forEach(item => {
          existingMap.set(item.month, Number(item.cota_valor || 0));
        });
      }

      setMonthsData(prev => prev.map(m => {
        const val = existingMap.get(m.month) || 0;
        return {
          ...m,
          cota_valor: val,
          displayValue: val > 0 ? val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '',
          original_cota_valor: val,
          hasChanges: false
        };
      }));
    } catch (err: any) {
      console.error('Erro ao buscar cotas existentes:', err);
      toast.error('Erro ao buscar cotas existentes para a loja');
    } finally {
      setLoadingMonths(false);
    }
  };

  const handleGeneralValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const cleanValue = e.target.value.replace(/\D/g, "");
    if (!cleanValue) {
      setGeneralValue(0);
      setGeneralDisplayValue("");
      return;
    }
    const numericValue = parseFloat(cleanValue) / 100;
    setGeneralValue(numericValue);
    setGeneralDisplayValue(numericValue.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }));
  };

  const handleMonthValueChange = (monthIndex: number, textValue: string) => {
    const cleanValue = textValue.replace(/\D/g, "");
    setMonthsData(prev => {
      const copy = [...prev];
      if (!cleanValue) {
        copy[monthIndex] = {
          ...copy[monthIndex],
          cota_valor: 0,
          displayValue: '',
          hasChanges: copy[monthIndex].original_cota_valor !== 0
        };
      } else {
        const numericValue = parseFloat(cleanValue) / 100;
        copy[monthIndex] = {
          ...copy[monthIndex],
          cota_valor: numericValue,
          displayValue: numericValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
          hasChanges: numericValue !== copy[monthIndex].original_cota_valor
        };
      }
      return copy;
    });
  };

  // Apply general value to all 12 months
  const handleApplyToAllMonths = async () => {
    if (!selectedStoreNumber) {
      toast.error('Por favor, selecione uma loja primeiro.');
      return;
    }
    if (generalValue <= 0) {
      toast.error('Por favor, insira um valor válido maior que zero.');
      return;
    }

    setApplying(true);
    try {
      // 1. Fetch current month records to preserve percentage parameters
      const { data: currentRecords, error: fetchError } = await supabase
        .from('buyorder_parameters_store')
        .select('*')
        .eq('store_number', selectedStoreNumber)
        .eq('year', selectedYear);

      if (fetchError) throw fetchError;

      const recordsMap = new Map<number, any>();
      if (currentRecords) {
        currentRecords.forEach(r => recordsMap.set(r.month, r));
      }

      // 2. Prepare payloads
      const payloads = Array.from({ length: 12 }, (_, i) => {
        const monthNum = i + 1;
        const existing = recordsMap.get(monthNum);

        if (existing) {
          // Keep existing percentages and flags, only update cota_valor
          return {
            ...existing,
            cota_valor: generalValue
          };
        } else {
          // Use standard default parameters for new record
          return {
            store_number: selectedStoreNumber,
            year: selectedYear,
            month: monthNum,
            cota_valor: generalValue,
            feminino_pct: 40,
            masculino_pct: 20,
            infantil_menina_pct: 10,
            infantil_menino_pct: 10,
            acessorio_pct: 20,
            usa_parametros_customizados: true,
            usar_cota_fixa: false,
            cota_gerente_fixa: null
          };
        }
      });

      // 3. Upsert payloads
      const { error: upsertError } = await supabase
        .from('buyorder_parameters_store')
        .upsert(payloads, { onConflict: 'store_number,year,month' });

      if (upsertError) throw upsertError;

      toast.success(`Cota de R$ ${generalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} aplicada aos 12 meses!`);
      
      // Reset general input
      setGeneralValue(0);
      setGeneralDisplayValue('');

      // Reload months
      await loadExistingQuotas();
    } catch (err: any) {
      console.error('Erro ao aplicar cota aos 12 meses:', err);
      toast.error('Erro ao salvar cotas: ' + err.message);
    } finally {
      setApplying(false);
    }
  };

  // Save single month inline
  const handleSaveMonthInline = async (monthIndex: number) => {
    const monthItem = monthsData[monthIndex];
    if (!selectedStoreNumber) return;

    setMonthsData(prev => {
      const copy = [...prev];
      copy[monthIndex].saving = true;
      return copy;
    });

    try {
      // 1. Fetch current month record to preserve details
      const { data: existing, error: fetchError } = await supabase
        .from('buyorder_parameters_store')
        .select('*')
        .eq('store_number', selectedStoreNumber)
        .eq('year', selectedYear)
        .eq('month', monthItem.month)
        .maybeSingle();

      if (fetchError) throw fetchError;

      const payload = existing
        ? { ...existing, cota_valor: monthItem.cota_valor }
        : {
            store_number: selectedStoreNumber,
            year: selectedYear,
            month: monthItem.month,
            cota_valor: monthItem.cota_valor,
            feminino_pct: 40,
            masculino_pct: 20,
            infantil_menina_pct: 10,
            infantil_menino_pct: 10,
            acessorio_pct: 20,
            usa_parametros_customizados: true,
            usar_cota_fixa: false,
            cota_gerente_fixa: null
          };

      // 2. Upsert
      const { error: upsertError } = await supabase
        .from('buyorder_parameters_store')
        .upsert([payload], { onConflict: 'store_number,year,month' });

      if (upsertError) throw upsertError;

      toast.success(`Cota de ${MONTH_NAMES[monthItem.month - 1]} salva!`);

      // Update local state to reflect successful save
      setMonthsData(prev => {
        const copy = [...prev];
        copy[monthIndex] = {
          ...copy[monthIndex],
          saving: false,
          original_cota_valor: monthItem.cota_valor,
          hasChanges: false
        };
        return copy;
      });
    } catch (err: any) {
      console.error('Erro ao salvar cota mensal individual:', err);
      toast.error('Erro ao salvar cota mensal');
      setMonthsData(prev => {
        const copy = [...prev];
        copy[monthIndex].saving = false;
        return copy;
      });
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-50 dark:bg-emerald-950/30 rounded-xl">
              <DollarSign size={18} className="text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">
                Incluir / Ajustar Cota
              </h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                Defina o planejamento orçamentário anual
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* Row 1: Select Store & Year */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            
            {/* Store Autocomplete Search Dropdown */}
            <div className="relative">
              <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 block mb-1.5">
                Filial / Loja
              </label>
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder={selectedStore ? `Loja ${selectedStore.number} · ${selectedStore.city}` : "Digite o número ou cidade..."}
                  value={storeSearch}
                  onFocus={() => setShowStoreDropdown(true)}
                  onChange={(e) => {
                    setStoreSearch(e.target.value);
                    setShowStoreDropdown(true);
                  }}
                  className="w-full bg-slate-50 dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 focus:border-slate-400 rounded-xl pl-9 pr-8 py-2.5 text-xs font-black text-slate-800 dark:text-white outline-none transition-all"
                />
                {selectedStoreNumber && (
                  <button 
                    onClick={() => {
                      setSelectedStoreNumber('');
                      setStoreSearch('');
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 hover:text-red-500"
                  >
                    Limpar
                  </button>
                )}
              </div>

              {/* Stores Dropdown */}
              {showStoreDropdown && (
                <div className="absolute left-0 right-0 z-50 mt-1 max-h-48 overflow-y-auto bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg divide-y divide-slate-50 dark:divide-slate-700">
                  {filteredStores.length === 0 ? (
                    <div className="p-3 text-center text-xs text-slate-400 italic">
                      Nenhuma loja encontrada
                    </div>
                  ) : (
                    filteredStores.map(store => (
                      <button
                        key={store.id}
                        type="button"
                        onClick={() => {
                          setSelectedStoreNumber(store.number);
                          setStoreSearch(`Loja ${store.number} · ${store.city}`);
                          setShowStoreDropdown(false);
                        }}
                        className="w-full text-left px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors flex justify-between items-center"
                      >
                        <span className="text-xs font-black text-slate-800 dark:text-slate-200">
                          Loja {store.number} · {store.name}
                        </span>
                        <span className="text-[10px] text-slate-400 font-bold uppercase">
                          {store.city}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Year Dropdown */}
            <div>
              <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 block mb-1.5">
                Ano de Exercício
              </label>
              <div className="relative">
                <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                  className="w-full bg-slate-50 dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 focus:border-slate-400 rounded-xl pl-9 pr-3 py-2.5 text-xs font-black text-slate-800 dark:text-white outline-none transition-all cursor-pointer appearance-none"
                >
                  {[2025, 2026, 2027, 2028].map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
            </div>

          </div>

          {/* Row 2: General Value and Apply to All 12 Months */}
          {selectedStoreNumber && (
            <div className="bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
                <Sliders size={14} className="text-emerald-500" />
                <h4 className="text-[10px] font-black text-slate-800 dark:text-slate-200 uppercase tracking-widest">
                  Definição em Massa
                </h4>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 items-end">
                <div className="flex-1 w-full">
                  <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 block mb-1">
                    Valor Geral Mensal (Para aplicar a todos os meses)
                  </label>
                  <input
                    type="text"
                    value={generalDisplayValue}
                    onChange={handleGeneralValueChange}
                    placeholder="R$ 0,00"
                    className="w-full bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 focus:border-slate-400 rounded-xl px-3 py-2 text-sm font-mono font-black text-slate-800 dark:text-white outline-none transition-all text-right"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleApplyToAllMonths}
                  disabled={applying || generalValue <= 0}
                  className="w-full sm:w-auto px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-45 text-white font-black text-[11px] uppercase tracking-wider rounded-xl shadow-sm transition-all flex items-center justify-center gap-1.5"
                >
                  {applying ? (
                    <Loader2 size={13} className="animate-spin" />
                  ) : (
                    <Check size={13} />
                  )}
                  Aplicar aos 12 Meses
                </button>
              </div>
            </div>
          )}

          {/* Row 3: 12 Months Inline Table */}
          {selectedStoreNumber && (
            <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
              <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                <h4 className="text-[10px] font-black text-slate-800 dark:text-slate-200 uppercase tracking-widest">
                  Ajuste Mensal Individual ({selectedYear})
                </h4>
                {loadingMonths && (
                  <Loader2 size={12} className="animate-spin text-slate-400" />
                )}
              </div>
              
              {loadingMonths ? (
                <div className="p-12 text-center flex flex-col items-center justify-center gap-2">
                  <Loader2 size={24} className="animate-spin text-slate-300" />
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Buscando orçamento...</span>
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-80 overflow-y-auto">
                  {monthsData.map((item, index) => {
                    return (
                      <div key={item.month} className="px-4 py-3 flex items-center justify-between gap-4 hover:bg-slate-50/50 dark:hover:bg-slate-800/10 transition-colors">
                        <div className="w-24 shrink-0">
                          <span className="text-xs font-black text-slate-700 dark:text-slate-300 uppercase">
                            {MONTH_NAMES[index]}
                          </span>
                        </div>
                        
                        <div className="flex-1 max-w-[200px]">
                          <input
                            type="text"
                            value={item.displayValue}
                            onChange={(e) => handleMonthValueChange(index, e.target.value)}
                            placeholder="R$ 0,00"
                            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:border-slate-400 rounded-lg px-2.5 py-1.5 text-xs font-mono font-black text-slate-800 dark:text-white outline-none transition-all text-right"
                          />
                        </div>

                        <div className="w-16 flex justify-end shrink-0">
                          {item.hasChanges && (
                            <button
                              type="button"
                              onClick={() => handleSaveMonthInline(index)}
                              disabled={item.saving}
                              className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/30 dark:hover:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 text-[10px] font-black uppercase rounded-md transition-all flex items-center gap-1 border border-emerald-200 dark:border-emerald-800"
                            >
                              {item.saving ? (
                                <Loader2 size={11} className="animate-spin" />
                              ) : (
                                "Salvar"
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {!selectedStoreNumber && (
            <div className="py-12 text-center text-slate-400 dark:text-slate-500 italic text-xs space-y-2">
              <p>📍 Selecione uma loja e ano acima para iniciar o planejamento de cotas.</p>
              <p className="text-[10px] font-bold uppercase tracking-widest">Os 12 meses serão carregados automaticamente</p>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-white dark:bg-slate-800 hover:bg-slate-50 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 transition-all"
          >
            Fechar
          </button>
          {selectedStoreNumber && (
            <button
              type="button"
              onClick={() => {
                onSuccess();
                onClose();
              }}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-sm transition-all"
            >
              Concluir
            </button>
          )}
        </div>

      </div>
    </div>
  );
}
