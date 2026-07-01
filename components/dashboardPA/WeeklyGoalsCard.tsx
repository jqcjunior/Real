import React, { useState, useEffect } from 'react';
import { TrendingUp, DollarSign, Trophy, Target, Zap, Award } from 'lucide-react';
import { motion } from 'framer-motion';
import { supabase } from '../../services/supabaseClient';

interface WeeklyGoalsCardProps {
  storeId: string;
  storeName: string;
  storeNumber: string;
  selectedMonth?: number;
  selectedYear?: number;
  semanaId?: string;
}

interface GoalParameters {
  // Vendas
  vendas_minimo: number | null;
  vendas_valor_base: number | null;
  vendas_incremento: number | null;
  vendas_inc_valor: number | null;
  
  // Ticket
  ticket_minimo: number | null;
  ticket_valor_base: number | null;
  ticket_incremento: number | null;
  ticket_inc_valor: number | null;
  
  // P.A
  pa_inicial: number;
  valor_base: number;
  incremento_pa: number;
  incremento_valor: number;
}

const WeeklyGoalsCard: React.FC<WeeklyGoalsCardProps> = ({ storeId, storeName, storeNumber, selectedMonth, selectedYear, semanaId }) => {
  const [params, setParams] = useState<GoalParameters | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchParameters();
  }, [storeId, selectedMonth, selectedYear, semanaId]);

  const fetchParameters = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('Dashboard_PA_Parametros')
        .select('*')
        .eq('store_id', storeId);

      if (semanaId) {
        query = query.eq('semana_id', semanaId);
      } else {
        if (selectedMonth) {
          query = query.eq('mes_ref', selectedMonth);
        }
        if (selectedYear) {
          query = query.eq('ano_ref', selectedYear);
        }
      }

      const { data, error } = await query;

      if (error) throw error;

      if (data && data.length > 0) {
        const row = data[0];
        setParams({
          vendas_minimo: row.vendas_minimo,
          vendas_valor_base: row.vendas_valor_base,
          vendas_incremento: row.vendas_incremento,
          vendas_inc_valor: row.vendas_inc_valor,
          ticket_minimo: row.ticket_minimo,
          ticket_valor_base: row.ticket_valor_base,
          ticket_incremento: row.ticket_incremento,
          ticket_inc_valor: row.ticket_inc_valor,
          pa_inicial: Number(row.pa_inicial),
          valor_base: Number(row.valor_base),
          incremento_pa: Number(row.incremento_pa),
          incremento_valor: Number(row.incremento_valor),
        });
      } else {
        setParams(null);
      }
    } catch (err) {
      console.error('Erro ao carregar parâmetros:', err);
    } finally {
      setLoading(false);
    }
  };

  // Função para calcular premiação em cada faixa
  const calcularFaixas = (
    meta: number,
    valorBase: number,
    incremento: number,
    incrementoValor: number,
    maxFaixas: number = 3
  ) => {
    const faixas = [];
    for (let i = 0; i <= maxFaixas; i++) {
      const nivel = meta + (incremento * i);
      const premio = valorBase + (incrementoValor * i);
      faixas.push({ nivel, premio });
    }
    return faixas;
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-[32px] p-8 border border-slate-100 dark:border-slate-800 shadow-sm">
        <div className="flex items-center justify-center h-48">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full"
          />
        </div>
      </div>
    );
  }

  if (!params) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-[32px] p-8 border border-slate-100 dark:border-slate-800 shadow-sm">
        <div className="flex flex-col items-center justify-center h-48 text-center gap-4 opacity-30">
          <Target className="w-12 h-12" />
          <p className="text-xs font-black italic uppercase tracking-tighter">
            Nenhuma meta configurada para esta loja
          </p>
        </div>
      </div>
    );
  }

  const faixasVendas = params.vendas_minimo && params.vendas_incremento
    ? calcularFaixas(params.vendas_minimo, params.vendas_valor_base || 0, params.vendas_incremento, params.vendas_inc_valor || 0)
    : null;

  const faixasTicket = params.ticket_minimo && params.ticket_incremento
    ? calcularFaixas(params.ticket_minimo, params.ticket_valor_base || 0, params.ticket_incremento, params.ticket_inc_valor || 0)
    : null;

  const faixasPA = calcularFaixas(params.pa_inicial, params.valor_base, params.incremento_pa, params.incremento_valor);

  return (
    <div className="bg-gradient-to-br from-slate-50 to-white dark:from-slate-900 dark:to-slate-800 rounded-[40px] border border-slate-100 dark:border-slate-800 shadow-xl overflow-hidden mb-8">
      {/* Header */}
      <div className="bg-gradient-to-r from-orange-500 to-red-500 p-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-sm">
                <Trophy className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-2xl font-black italic uppercase tracking-tighter text-white leading-none">
                  Metas Semanais
                </h3>
                <p className="text-orange-100 font-black italic uppercase tracking-tighter text-[10px] mt-1">
                  Loja {storeNumber} — Sistema de Premiação
                </p>
              </div>
            </div>
          </div>
          <div className="hidden md:block px-4 py-2 bg-white/20 rounded-full backdrop-blur-sm">
            <span className="text-white font-black italic uppercase tracking-tighter text-xs">
              {storeName}
            </span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        {/* 1. META DE VENDAS */}
        {faixasVendas && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-3"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-100 dark:bg-emerald-900/20 rounded-xl">
                <TrendingUp className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <h4 className="text-sm font-black italic uppercase tracking-tighter text-slate-900 dark:text-white">
                  💰 VENDAS
                </h4>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {faixasVendas.map((faixa, idx) => (
                <div
                  key={idx}
                  className={`relative p-3 rounded-xl border-2 flex flex-col justify-between transition-all ${
                    idx === 0
                      ? 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800'
                      : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 hover:border-emerald-300 dark:hover:border-emerald-700'
                  }`}
                >
                  {idx > 0 && (
                    <div className="absolute -top-1.5 -right-1.5 px-1.5 py-0.5 bg-emerald-500 text-white rounded-full text-[8px] font-black uppercase">
                      +{idx}
                    </div>
                  )}
                  <p className="text-[9px] font-black text-slate-400 uppercase mb-1">
                    {idx === 0 ? 'BASE' : `BÔNUS +${idx}`}
                  </p>
                  <div className="flex items-center gap-1 font-black text-sm tabular-nums">
                    <span className="text-emerald-700 dark:text-emerald-400">
                      R$ {(faixa.nivel / 1000).toFixed(0)}k
                    </span>
                    <span className="text-slate-300">→</span>
                    <span className="text-emerald-600 dark:text-emerald-300">
                      💵 {faixa.premio.toFixed(0)}
                    </span>
                  </div>
                </div>
              ))}
            </div>

          </motion.div>
        )}

        {/* 2. META DE TICKET */}
        {faixasTicket && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="space-y-3"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded-xl">
                <DollarSign className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h4 className="text-sm font-black italic uppercase tracking-tighter text-slate-900 dark:text-white">
                  🎫 TICKET MÉDIO
                </h4>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {faixasTicket.map((faixa, idx) => (
                <div
                  key={idx}
                  className={`relative p-3 rounded-xl border-2 flex flex-col justify-between transition-all ${
                    idx === 0
                      ? 'bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800'
                      : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-700'
                  }`}
                >
                  {idx > 0 && (
                    <div className="absolute -top-1.5 -right-1.5 px-1.5 py-0.5 bg-blue-500 text-white rounded-full text-[8px] font-black uppercase">
                      +{idx}
                    </div>
                  )}
                  <p className="text-[9px] font-black text-slate-400 uppercase mb-1">
                    {idx === 0 ? 'BASE' : `BÔNUS +${idx}`}
                  </p>
                  <div className="flex items-center gap-1 font-black text-sm tabular-nums">
                    <span className="text-blue-700 dark:text-blue-400">
                      R$ {faixa.nivel.toFixed(0)}
                    </span>
                    <span className="text-slate-300">→</span>
                    <span className="text-blue-600 dark:text-blue-300">
                      💵 {faixa.premio.toFixed(0)}
                    </span>
                  </div>
                </div>
              ))}
            </div>

          </motion.div>
        )}

        {/* 3. META DE P.A */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="space-y-3"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 dark:bg-orange-900/20 rounded-xl">
              <Trophy className="w-5 h-5 text-orange-600 dark:text-orange-400" />
            </div>
            <div>
              <h4 className="text-sm font-black italic uppercase tracking-tighter text-slate-900 dark:text-white">
                📊 P.A
              </h4>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {faixasPA.map((faixa, idx) => (
              <div
                key={idx}
                className={`relative p-3 rounded-xl border-2 flex flex-col justify-between transition-all ${
                  idx === 0
                    ? 'bg-orange-50 dark:bg-orange-900/10 border-orange-200 dark:border-orange-800'
                    : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 hover:border-orange-300 dark:hover:border-orange-700'
                }`}
              >
                {idx > 0 && (
                  <div className="absolute -top-1.5 -right-1.5 px-1.5 py-0.5 bg-orange-500 text-white rounded-full text-[8px] font-black uppercase">
                    +{idx}
                  </div>
                )}
                <p className="text-[9px] font-black text-slate-400 uppercase mb-1">
                  {idx === 0 ? 'BASE' : `BÔNUS +${idx}`}
                </p>
                <div className="flex items-center gap-1 font-black text-sm tabular-nums">
                  <span className="text-orange-700 dark:text-orange-400">
                    {faixa.nivel.toFixed(2)}
                  </span>
                  <span className="text-slate-300">→</span>
                  <span className="text-orange-600 dark:text-orange-300">
                    💵 {faixa.premio.toFixed(0)}
                  </span>
                </div>
              </div>
            ))}
          </div>

        </motion.div>

        {/* Footer com Resumo */}
        <div className="pt-4 border-t-2 border-slate-200 dark:border-slate-800 flex items-center justify-center">
          <span className="text-[10px] font-black italic uppercase tracking-tighter text-slate-400">
            ⚡ Sistema de premiação semanal ativo
          </span>
        </div>
      </div>
    </div>
  );
};

export default WeeklyGoalsCard;
