// ============================================
// MONTHLY WEEKLY BREAKDOWN - Dashboard PA
// Componente de detalhamento semanal de performance
// ============================================

import React from 'react';
import { Calendar, TrendingUp, DollarSign, Award, ArrowRight } from 'lucide-react';
import { format } from 'date-fns';

interface WeeklyBreakdownItem {
  semanaId: string;
  dataInicio: string;
  dataFim: string;
  pa: number;
  vendas: number;
  ticket: number;
  premioCalc: number;
  paMeta: number;
}

interface MonthlyWeeklyBreakdownProps {
  weeklyBreakdown: WeeklyBreakdownItem[];
}

const parseLocalDate = (dateStr: string): Date => {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
};

export const MonthlyWeeklyBreakdown: React.FC<MonthlyWeeklyBreakdownProps> = ({ weeklyBreakdown }) => {
  if (!weeklyBreakdown || weeklyBreakdown.length === 0) {
    return (
      <div className="p-4 text-center text-xs text-slate-400 font-bold uppercase italic">
        Nenhum detalhamento disponível para este período
      </div>
    );
  }

  const sortedBreakdown = [...weeklyBreakdown].sort((a, b) => a.dataInicio.localeCompare(b.dataInicio));

  return (
    <div className="mt-4 pt-4 border-t border-slate-150 dark:border-slate-800/80 animate-in fade-in slide-in-from-top-2 duration-300">
      <div className="flex items-center gap-2 mb-3">
        <Calendar size={14} className="text-orange-500" />
        <h4 className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">
          Detalhamento de Performance por Semana
        </h4>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200/60 dark:border-slate-800 bg-white/50 dark:bg-slate-900/40">
        {/* Desktop View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 dark:bg-slate-800/30 border-b border-slate-100 dark:border-slate-800">
                <th className="px-4 py-2.5 text-[9px] font-black text-slate-400 uppercase tracking-wider">Período</th>
                <th className="px-4 py-2.5 text-[9px] font-black text-slate-400 uppercase tracking-wider text-center">P.A Médio / Meta</th>
                <th className="px-4 py-2.5 text-[9px] font-black text-slate-400 uppercase tracking-wider text-right">Vendas</th>
                <th className="px-4 py-2.5 text-[9px] font-black text-slate-400 uppercase tracking-wider text-right">Ticket</th>
                <th className="px-4 py-2.5 text-[9px] font-black text-slate-400 uppercase tracking-wider text-right">Prêmio Calculado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
              {sortedBreakdown.map((item, idx) => {
                const reachedMeta = item.pa >= item.paMeta && item.pa > 0;
                return (
                  <tr key={item.semanaId || idx} className="hover:bg-slate-50/30 dark:hover:bg-slate-800/10 transition-colors">
                    <td className="px-4 py-3 text-xs font-bold text-slate-700 dark:text-slate-300 whitespace-nowrap">
                      {format(parseLocalDate(item.dataInicio), 'dd/MM')} a {format(parseLocalDate(item.dataFim), 'dd/MM')}
                    </td>
                    <td className="px-4 py-3 text-xs text-center whitespace-nowrap">
                      <span className={`font-black ${reachedMeta ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500'}`}>
                        {item.pa.toFixed(2)}
                      </span>
                      <span className="text-[10px] text-slate-400 font-bold"> / {item.paMeta.toFixed(2)}</span>
                    </td>
                    <td className="px-4 py-3 text-xs font-bold text-slate-600 dark:text-slate-400 text-right whitespace-nowrap">
                      R$ {item.vendas.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 text-xs font-bold text-slate-600 dark:text-slate-400 text-right whitespace-nowrap">
                      R$ {item.ticket.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <span className={`text-xs font-black px-2 py-0.5 rounded-md ${
                        item.premioCalc > 0 
                          ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/30' 
                          : 'text-slate-400'
                      }`}>
                        {item.premioCalc > 0 
                          ? `R$ ${item.premioCalc.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` 
                          : '—'
                        }
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Mobile View */}
        <div className="block md:hidden divide-y divide-slate-100 dark:divide-slate-800/50">
          {sortedBreakdown.map((item, idx) => {
            const reachedMeta = item.pa >= item.paMeta && item.pa > 0;
            return (
              <div key={item.semanaId || idx} className="p-3 space-y-2 hover:bg-slate-50/30 dark:hover:bg-slate-800/10">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                    {format(parseLocalDate(item.dataInicio), 'dd/MM')} a {format(parseLocalDate(item.dataFim), 'dd/MM')}
                  </span>
                  <span className={`text-xs font-black ${
                    item.premioCalc > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'
                  }`}>
                    {item.premioCalc > 0 ? `R$ ${item.premioCalc.toFixed(0)}` : 'R$ 0'}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center text-[10px] font-bold text-slate-500">
                  <div className="bg-slate-50/50 dark:bg-slate-800/20 p-1.5 rounded-lg">
                    <p className="text-[8px] uppercase text-slate-400 leading-none mb-1">P.A</p>
                    <p className={reachedMeta ? 'text-emerald-600 font-black' : 'text-slate-600'}>
                      {item.pa.toFixed(2)}
                    </p>
                  </div>
                  <div className="bg-slate-50/50 dark:bg-slate-800/20 p-1.5 rounded-lg">
                    <p className="text-[8px] uppercase text-slate-400 leading-none mb-1">Vendas</p>
                    <p className="text-blue-600 font-black">
                      R$ {(item.vendas / 1000).toFixed(0)}k
                    </p>
                  </div>
                  <div className="bg-slate-50/50 dark:bg-slate-800/20 p-1.5 rounded-lg">
                    <p className="text-[8px] uppercase text-slate-400 leading-none mb-1">Ticket</p>
                    <p className="text-purple-600 font-black">
                      R$ {item.ticket.toFixed(0)}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
