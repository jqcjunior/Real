import React, { useState, useEffect, useMemo } from 'react';
import { Store, MonthlyGoal } from '../types';
import {
  Target,
  Loader2,
  Save,
  Calendar,
  Copy,
  CheckCircle2,
  ArrowUpRight,
  ArrowDownRight,
  Minus
} from 'lucide-react';

interface GoalRegistrationProps {
  stores: Store[];
  goalsData: MonthlyGoal[];
  onSaveGoals: (data: MonthlyGoal[]) => Promise<void>;
}

const GoalRegistration: React.FC<GoalRegistrationProps> = ({
  stores,
  goalsData,
  onSaveGoals
}) => {
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);

  const [formData, setFormData] = useState<Record<string, MonthlyGoal>>({});
  const [saveStatus, setSaveStatus] =
    useState<'idle' | 'saving' | 'success' | 'error'>('idle');

  const months = [
    { value: 1, label: 'Janeiro' },
    { value: 2, label: 'Fevereiro' },
    { value: 3, label: 'Março' },
    { value: 4, label: 'Abril' },
    { value: 5, label: 'Maio' },
    { value: 6, label: 'Junho' },
    { value: 7, label: 'Julho' },
    { value: 8, label: 'Agosto' },
    { value: 9, label: 'Setembro' },
    { value: 10, label: 'Outubro' },
    { value: 11, label: 'Novembro' },
    { value: 12, label: 'Dezembro' }
  ];

  const activeStores = useMemo(
    () =>
      (stores || [])
        .filter(s => s.status === 'active')
        .sort((a, b) => parseInt(a.number) - parseInt(b.number)),
    [stores]
  );

  /* =========================
     LOAD METAS
  ========================= */
  useEffect(() => {
    const initial: Record<string, MonthlyGoal> = {};

    activeStores.forEach(store => {
      const existing = goalsData.find(
        g =>
          g.storeId === store.id &&
          g.year === selectedYear &&
          g.month === selectedMonth
      );

      initial[store.id] =
        existing || {
          storeId: store.id,
          year: selectedYear,
          month: selectedMonth,
          revenueTarget: 0,
          itemsTarget: 0,
          paTarget: 0,
          puTarget: 0,
          delinquencyTarget: 2,
          businessDays: 26,
          trend: 'stable'
        };
    });

    setFormData(initial);
  }, [activeStores, goalsData, selectedYear, selectedMonth]);

  /* =========================
     INPUT HANDLER
  ========================= */
  const handleChange = (
    storeId: string,
    field: keyof MonthlyGoal,
    value: any
  ) => {
    const parsed =
      typeof value === 'string' && field !== 'trend'
        ? parseFloat(value.replace(/\./g, '').replace(',', '.')) || 0
        : value;

    setFormData(prev => ({
      ...prev,
      [storeId]: { ...prev[storeId], [field]: parsed }
    }));
  };

  /* =========================
     CLONE LAST MONTH
  ========================= */
  const handleCloneLastMonth = () => {
    const prevMonth = selectedMonth === 1 ? 12 : selectedMonth - 1;
    const prevYear = selectedMonth === 1 ? selectedYear - 1 : selectedYear;

    if (!window.confirm(`Clonar metas de ${prevMonth}/${prevYear}?`)) return;

    const cloned: Record<string, MonthlyGoal> = {};

    activeStores.forEach(store => {
      const last = goalsData.find(
        g =>
          g.storeId === store.id &&
          g.year === prevYear &&
          g.month === prevMonth
      );

      cloned[store.id] = last
        ? { ...last, year: selectedYear, month: selectedMonth }
        : formData[store.id];
    });

    setFormData(cloned);
  };

  /* =========================
     SAVE METAS
  ========================= */
  const handleSave = async () => {
    setSaveStatus('saving');
    try {
      await onSaveGoals(Object.values(formData));
      setSaveStatus('success');
      setTimeout(() => setSaveStatus('idle'), 2500);
    } catch {
      setSaveStatus('error');
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-4 flex flex-col h-full pb-20">
      {/* HEADER */}
      <div className="flex flex-col lg:flex-row justify-between items-center gap-4 bg-white p-6 rounded-3xl shadow-sm border">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-red-600 text-white rounded-2xl">
            <Target size={24} />
          </div>
          <div>
            <h2 className="text-xl font-black uppercase italic">
              Planejamento <span className="text-red-600">de Metas</span>
            </h2>
            <p className="text-gray-400 text-[9px] uppercase font-bold">
              Definição mensal por loja
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 bg-gray-50 p-1.5 rounded-xl border">
            <Calendar size={14} />
            <select
              value={selectedMonth}
              onChange={e => setSelectedMonth(Number(e.target.value))}
              className="bg-transparent font-black text-[10px]"
            >
              {months.map(m => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
            <select
              value={selectedYear}
              onChange={e => setSelectedYear(Number(e.target.value))}
              className="bg-transparent font-black text-[10px]"
            >
              {[2024, 2025, 2026].map(y => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={handleCloneLastMonth}
            className="bg-blue-50 px-4 py-2 rounded-xl font-black text-[9px]"
          >
            <Copy size={14} /> Clonar
          </button>

          <button
            onClick={handleSave}
            disabled={saveStatus === 'saving'}
            className="bg-gray-950 text-white px-6 py-2.5 rounded-xl font-black text-[9px]"
          >
            {saveStatus === 'saving' ? (
              <Loader2 className="animate-spin" size={14} />
            ) : (
              <Save size={14} />
            )}
            Efetivar
          </button>
        </div>
      </div>

      {/* TABLE */}
      <div className="flex-1 bg-white rounded-3xl border overflow-auto">
        <table className="w-full min-w-[1100px] text-left">
          <thead className="bg-gray-50 text-[9px] font-black uppercase text-gray-400">
            <tr>
              <th className="px-6 py-4">Unidade</th>
              <th className="text-center">Faturamento</th>
              <th className="text-center">Peças</th>
              <th className="text-center">P.A</th>
              <th className="text-center">P.U</th>
              <th className="text-center">Dias</th>
              <th className="text-center">Inad (%)</th>
              <th className="text-center">Trend</th>
            </tr>
          </thead>
          <tbody>
            {activeStores.map(store => {
              const row = formData[store.id];
              if (!row) return null;

              return (
                <tr key={store.id} className="border-t">
                  <td className="px-6 py-2 font-black">
                    LOJA {store.number}
                  </td>
                  <td>
                    <input
                      value={row.revenueTarget}
                      onChange={e =>
                        handleChange(store.id, 'revenueTarget', e.target.value)
                      }
                    />
                  </td>
                  <td>
                    <input
                      value={row.itemsTarget}
                      onChange={e =>
                        handleChange(store.id, 'itemsTarget', e.target.value)
                      }
                    />
                  </td>
                  <td>
                    <input
                      value={row.paTarget}
                      onChange={e =>
                        handleChange(store.id, 'paTarget', e.target.value)
                      }
                    />
                  </td>
                  <td>
                    <input
                      value={row.puTarget}
                      onChange={e =>
                        handleChange(store.id, 'puTarget', e.target.value)
                      }
                    />
                  </td>
                  <td>
                    <input
                      value={row.businessDays}
                      onChange={e =>
                        handleChange(store.id, 'businessDays', e.target.value)
                      }
                    />
                  </td>
                  <td>
                    <input
                      value={row.delinquencyTarget}
                      onChange={e =>
                        handleChange(
                          store.id,
                          'delinquencyTarget',
                          e.target.value
                        )
                      }
                    />
                  </td>
                  <td>
                    <div className="flex justify-center gap-1">
                      <button
                        onClick={() =>
                          handleChange(store.id, 'trend', 'up')
                        }
                        className={
                          row.trend === 'up'
                            ? 'text-green-600'
                            : 'text-gray-300'
                        }
                      >
                        <ArrowUpRight size={14} />
                      </button>
                      <button
                        onClick={() =>
                          handleChange(store.id, 'trend', 'stable')
                        }
                        className={
                          row.trend === 'stable'
                            ? 'text-blue-600'
                            : 'text-gray-300'
                        }
                      >
                        <Minus size={14} />
                      </button>
                      <button
                        onClick={() =>
                          handleChange(store.id, 'trend', 'down')
                        }
                        className={
                          row.trend === 'down'
                            ? 'text-red-600'
                            : 'text-gray-300'
                        }
                      >
                        <ArrowDownRight size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {saveStatus === 'success' && (
        <div className="fixed bottom-4 right-4 bg-green-600 text-white px-6 py-3 rounded-2xl text-[10px] font-black">
          <CheckCircle2 size={16} /> Metas salvas com sucesso
        </div>
      )}
    </div>
  );
};

export default GoalRegistration;
