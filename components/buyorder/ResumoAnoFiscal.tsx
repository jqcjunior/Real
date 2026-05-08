import React, { useState } from 'react';
import { TrendingUp, AlertCircle, Calendar } from 'lucide-react';

export interface QuotaMes {
  mes: number;
  ano: number;
  cota_mensal: number;
  cota_utilizada: number;
  cota_disponivel: number;
  cota_gerente_valor: number;
  cota_comprador_valor: number;
  despesas_comprometidas: number;
  pedidos_confirmados: number;
  qtd_pedidos: number;
  
  // ✅ NOVOS CAMPOS: Cotas futuras e OTB
  cota_futura_mes1?: number;
  cota_futura_mes2?: number;
  cota_futura_mes3?: number;
  otb_maximo_compravel_comprador?: number;
  otb_maximo_compravel_gerente?: number;
  
  // ✅ NOVOS CAMPOS: Pedidos emitidos no mês (por tipo)
  pedidos_futuros_comprador?: number;
  pedidos_futuros_gerente?: number;
  qtd_pedidos_comprador?: number;
  qtd_pedidos_gerente?: number;
}

interface ResumoAnoFiscalProps {
  quotas: QuotaMes[];
  onVerPedidos?: (mes: number, ano: number) => void;
}

export function gerarMesesRolling(startMonth: number, startYear: number): { mes: number; ano: number; nome: string }[] {
  const meses = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];
  const resultado = [];
  
  let currentMonth = startMonth;
  let currentYear = startYear;
  
  for (let i = 0; i < 12; i++) {
    resultado.push({
      mes: currentMonth,
      ano: currentYear,
      nome: meses[currentMonth - 1]
    });
    
    currentMonth++;
    if (currentMonth > 12) {
      currentMonth = 1;
      currentYear++;
    }
  }
  
  return resultado;
}

export default function ResumoAnoFiscal({ quotas, onVerPedidos }: ResumoAnoFiscalProps) {
  const [expandedMonth, setExpandedMonth] = useState<number | null>(null);
  
  const formatarMoeda = (valor: number) =>
    valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const mesesRolling = gerarMesesRolling(
    quotas.length > 0 ? quotas[0].mes : new Date().getMonth() + 1,
    quotas.length > 0 ? quotas[0].ano : new Date().getFullYear()
  );

  // Função auxiliar para converter valor numérico em número
  const toNumber = (v: any): number => {
    if (v === null || v === undefined || v === '') return 0;
    const n = typeof v === 'string' ? parseFloat(v) : v;
    return isNaN(n) ? 0 : n;
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-500 to-indigo-600 rounded-2xl p-6 text-white shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
              <TrendingUp size={24} />
            </div>
            <div>
              <h2 className="text-2xl font-black uppercase italic">Resumo Ano Fiscal</h2>
              <p className="text-sm font-bold opacity-90 uppercase tracking-widest">
                12 Meses • Comprador + Gerente
              </p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs font-bold opacity-75 uppercase">Rolling</div>
            <div className="text-2xl font-black">12M</div>
          </div>
        </div>
      </div>

      {/* Grid de Meses */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {mesesRolling.map((mesInfo) => {
          const quota = quotas.find(q => q.mes === mesInfo.mes && q.ano === mesInfo.ano);
          
          if (!quota) {
            return (
              <div
                key={`${mesInfo.mes}-${mesInfo.ano}`}
                className="bg-slate-100 dark:bg-slate-800 rounded-2xl p-5 border-2 border-dashed border-slate-300 dark:border-slate-700"
              >
                <div className="flex items-center justify-center h-40">
                  <div className="text-center">
                    <AlertCircle size={32} className="mx-auto mb-2 text-slate-400" />
                    <p className="text-sm font-bold text-slate-500 uppercase">
                      {mesInfo.nome} {mesInfo.ano}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">Sem parâmetros</p>
                  </div>
                </div>
              </div>
            );
          }

          const cotaLimpa = toNumber(quota.cota_disponivel);
          const despesas = toNumber(quota.despesas_comprometidas);
          const cotaBruta = toNumber(quota.cota_mensal);
          const cotaGerente = toNumber(quota.cota_gerente_valor);
          const cotaComprador = toNumber(quota.cota_comprador_valor);
          
          // ✅ OTB: Valor máximo comprável
          const otbComprador = toNumber(quota.otb_maximo_compravel_comprador);
          const otbGerente = toNumber(quota.otb_maximo_compravel_gerente);
          
          // ✅ Pedidos emitidos no mês
          const pedidosComprador = toNumber(quota.pedidos_futuros_comprador);
          const pedidosGerente = toNumber(quota.pedidos_futuros_gerente);
          const qtdPedidosComprador = toNumber(quota.qtd_pedidos_comprador);
          const qtdPedidosGerente = toNumber(quota.qtd_pedidos_gerente);

          const percentualUtilizado = cotaBruta > 0 ? ((despesas / cotaBruta) * 100) : 0;
          const isExpanded = expandedMonth === quota.mes;

          return (
            <div
              key={`${quota.mes}-${quota.ano}`}
              className={`bg-white dark:bg-slate-800 rounded-2xl border-2 transition-all duration-200 ${
                isExpanded 
                  ? 'border-blue-500 shadow-xl scale-[1.02]' 
                  : 'border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-600 shadow-sm'
              }`}
            >
              {/* Header do Card */}
              <div className="p-5 border-b border-slate-100 dark:border-slate-700">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-2xl font-black text-slate-900 dark:text-white uppercase italic">
                    {mesInfo.nome} <span className="text-blue-600">{mesInfo.ano}</span>
                  </h3>
                  <button
                    onClick={() => setExpandedMonth(isExpanded ? null : quota.mes)}
                    className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                  >
                    <Calendar size={18} className="text-slate-500" />
                  </button>
                </div>

                {/* Resumo Financeiro */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-bold text-slate-500 uppercase">Cota Bruta</span>
                    <span className="font-black text-slate-900 dark:text-white">
                      {formatarMoeda(cotaBruta)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-bold text-red-500 uppercase">- Despesas/Pedidos</span>
                    <span className="font-black text-red-600">
                      {formatarMoeda(despesas)}
                    </span>
                  </div>
                  <div className="pt-2 border-t-2 border-dashed border-slate-200 dark:border-slate-700">
                    <div className="flex items-center justify-between">
                      <span className="font-black text-slate-700 dark:text-slate-300 uppercase text-xs">
                        = Cota Limpa (Disponível)
                      </span>
                      <span className="font-black text-xl text-blue-600">
                        {formatarMoeda(cotaLimpa)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Barra de Progresso */}
                <div className="mt-3">
                  <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-500 ${
                        percentualUtilizado > 90 ? 'bg-red-500' :
                        percentualUtilizado > 70 ? 'bg-orange-500' :
                        'bg-emerald-500'
                      }`}
                      style={{ width: `${Math.min(percentualUtilizado, 100)}%` }}
                    />
                  </div>
                  <p className="text-xs text-slate-500 text-right mt-1 font-bold">
                    {percentualUtilizado.toFixed(1)}% utilizado
                  </p>
                </div>
              </div>

              {/* Divisão Comprador / Gerente */}
              <div className="p-5 space-y-3">
                
                {/* 📊 COMPRADOR */}
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 border border-blue-200 dark:border-blue-800">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
                      <TrendingUp size={16} className="text-white" />
                    </div>
                    <span className="font-black text-blue-900 dark:text-blue-100 uppercase text-sm">
                      Comprador
                    </span>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-blue-700 dark:text-blue-300 uppercase">
                        Saldo Reserva
                      </span>
                      <span className={`text-lg font-black ${cotaComprador < 0 ? 'text-red-600' : 'text-blue-600'}`}>
                        {formatarMoeda(cotaComprador)}
                      </span>
                    </div>

                    {/* ✅ PEDIDOS EMITIDOS */}
                    {qtdPedidosComprador > 0 && (
                      <div className="pt-2 border-t border-blue-200 dark:border-blue-800">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-blue-700 dark:text-blue-300 uppercase">
                            📋 Pedidos Emitidos
                          </span>
                          <button
                            onClick={() => onVerPedidos?.(quota.mes, quota.ano)}
                            className="text-xs font-black text-blue-600 hover:text-blue-800 underline"
                          >
                            {qtdPedidosComprador} {qtdPedidosComprador === 1 ? 'pedido' : 'pedidos'}
                          </button>
                        </div>
                        <div className="text-right mt-1">
                          <span className="text-sm font-bold text-blue-800 dark:text-blue-200">
                            {formatarMoeda(pedidosComprador)}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* ✅ OTB DISPONÍVEL */}
                    {otbComprador > 0 && (
                      <div className="pt-2 border-t border-blue-200 dark:border-blue-800">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300 uppercase">
                            💰 OTB Disponível
                          </span>
                          <span className="text-base font-black text-emerald-600">
                            {formatarMoeda(otbComprador)}
                          </span>
                        </div>
                        <p className="text-[9px] text-slate-500 mt-1 italic">
                          Máx. comprável (mín. 3 meses futuros ÷ 3)
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* 🛒 GERENTE */}
                <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-4 border border-emerald-200 dark:border-emerald-800">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center">
                      <TrendingUp size={16} className="text-white" />
                    </div>
                    <span className="font-black text-emerald-900 dark:text-emerald-100 uppercase text-sm">
                      Gerente
                    </span>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300 uppercase">
                        Saldo Reserva
                      </span>
                      <span className="text-lg font-black text-emerald-600">
                        {formatarMoeda(cotaGerente)}
                      </span>
                    </div>

                    {/* ✅ PEDIDOS EMITIDOS */}
                    {qtdPedidosGerente > 0 && (
                      <div className="pt-2 border-t border-emerald-200 dark:border-emerald-800">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300 uppercase">
                            📋 Pedidos Emitidos
                          </span>
                          <button
                            onClick={() => onVerPedidos?.(quota.mes, quota.ano)}
                            className="text-xs font-black text-emerald-600 hover:text-emerald-800 underline"
                          >
                            {qtdPedidosGerente} {qtdPedidosGerente === 1 ? 'pedido' : 'pedidos'}
                          </button>
                        </div>
                        <div className="text-right mt-1">
                          <span className="text-sm font-bold text-emerald-800 dark:text-emerald-200">
                            {formatarMoeda(pedidosGerente)}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* ✅ OTB DISPONÍVEL */}
                    {otbGerente > 0 && (
                      <div className="pt-2 border-t border-emerald-200 dark:border-emerald-800">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-blue-700 dark:text-blue-300 uppercase">
                            💰 OTB Disponível
                          </span>
                          <span className="text-base font-black text-blue-600">
                            {formatarMoeda(otbGerente)}
                          </span>
                        </div>
                        <p className="text-[9px] text-slate-500 mt-1 italic">
                          Máx. comprável (mín. 3 meses futuros ÷ 3)
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}