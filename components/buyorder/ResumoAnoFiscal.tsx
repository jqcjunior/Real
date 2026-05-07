// ============================================================================
// RESUMO ANO FISCAL - Cards Mensais (Rolling 12 Months)
// Comprador + Gerente separados | Pedidos Futuros | Ano Móvel
// ============================================================================

import React from 'react';
import { TrendingUp, ShoppingCart, Calendar, ChevronRight } from 'lucide-react';

/**
 * ✅ FUNÇÃO AUXILIAR: Garantir que o valor seja um número válido
 */
const toNumber = (value: any): number => {
  if (value === null || value === undefined || value === '') {
    return 0;
  }
  const num = typeof value === 'string' ? parseFloat(value) : value;
  return isNaN(num) ? 0 : num;
};

export interface QuotaMes {
  mes: number;
  ano: number;
  // Campos vindos da RPC get_cotas_ano_fiscal
  cota_mensal: number;
  cota_utilizada: number;
  cota_disponivel: number;
  cota_gerente_valor: number;
  cota_comprador_valor: number;
  despesas_comprometidas: number;
  pedidos_confirmados: number;
  qtd_pedidos: number;
  // Fallbacks para compatibilidade
  cota_inicial?: number;
  cota_limpa?: number;
  pedidos_futuros_comprador?: number;
  pedidos_futuros_gerente?: number;
  otb_maximo_comprador?: number;
  otb_maximo_gerente?: number;
}

interface Props {
  quotas: QuotaMes[]; // Array com 12 meses (rolling)
  onVerPedidos: (mes: number, ano: number) => void;
}

const MESES_NOMES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

const ResumoAnoFiscal: React.FC<Props> = ({ quotas, onVerPedidos }) => {
  
  const formatCurrency = (valor: number) => {
    return toNumber(valor).toLocaleString('pt-BR', { 
      style: 'currency', 
      currency: 'BRL',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-3xl p-4 md:p-6 border border-slate-200 dark:border-slate-800 shadow-lg">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 md:p-3 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shadow-lg">
            <TrendingUp className="text-white" size={20} />
          </div>
          <div>
            <h3 className="text-lg md:text-xl font-black text-slate-900 dark:text-white uppercase italic">
              📊 Resumo Ano Fiscal
            </h3>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
              12 Meses • Comprador + Gerente
            </p>
          </div>
        </div>
        
        <div className="flex items-center self-start md:self-auto gap-2 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/20 rounded-full">
          <Calendar size={14} className="text-blue-600" />
          <span className="text-[10px] md:text-xs font-black text-blue-600 uppercase">
            Rolling 12M
          </span>
        </div>
      </div>

      {/* Grid de Cards Mensais */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-6">
        {quotas.map((quota) => {
          // Proteção contra NaN usando toNumber
          const cotaBruta = toNumber(quota.cota_mensal || quota.cota_inicial);
          const despesasTotal = toNumber(quota.cota_utilizada || quota.despesas_comprometidas);
          const cotaLimpa = toNumber(quota.cota_disponivel || quota.cota_limpa);
          
          const cotaComprador = toNumber(quota.cota_comprador_valor);
          const cotaGerente = toNumber(quota.cota_gerente_valor);
          
          const temPedidos = toNumber(quota.qtd_pedidos) > 0;
          
          // Cores baseadas no saldo total
          let corBorda = 'border-slate-200 dark:border-slate-800';
          if (cotaLimpa < 0) corBorda = 'border-red-500';
          else if (cotaLimpa < 10000) corBorda = 'border-amber-500';

          const mesNome = MESES_NOMES[quota.mes - 1];

          return (
            <div
              key={`${quota.ano}-${quota.mes}`}
              className={`bg-slate-50/50 dark:bg-slate-800/20 rounded-3xl border-2 p-4 md:p-6 flex flex-col transition-all hover:shadow-xl ${corBorda}`}
            >
              {/* HEADER DO CARD */}
              <div className="flex items-center justify-between mb-4 md:mb-6">
                <div>
                  <h4 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white uppercase italic tracking-tight">
                    {mesNome} <span className="text-blue-600 dark:text-blue-400">{quota.ano}</span>
                  </h4>
                </div>
                
                {/* Botão de Pedidos */}
                {temPedidos && (
                  <button
                    onClick={() => onVerPedidos(quota.mes, quota.ano)}
                    className="flex items-center gap-2 px-3 py-1.5 md:px-4 md:py-2 bg-slate-900 text-white rounded-xl hover:bg-black transition-all active:scale-95 shadow-lg flex-shrink-0"
                  >
                    <ShoppingCart size={14} />
                    <span className="text-[10px] md:text-xs font-black uppercase">
                      {quota.qtd_pedidos}
                    </span>
                  </button>
                )}
              </div>

              {/* SECTION: BREAKDOWN FINANCEIRO */}
              <div className="space-y-2 mb-6 p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Cota Bruta</span>
                  <span className="font-bold text-slate-900 dark:text-white">{formatCurrency(cotaBruta)}</span>
                </div>
                <div className="flex justify-between items-center text-red-500">
                  <span className="text-[10px] font-black uppercase tracking-widest">- Despesas/Pedidos</span>
                  <span className="font-bold">{formatCurrency(despesasTotal)}</span>
                </div>
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center">
                  <span className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-tighter">= Cota Limpa (Disponível)</span>
                  <span className={`text-lg font-black ${cotaLimpa < 0 ? 'text-red-600' : 'text-blue-600'}`}>
                    {formatCurrency(cotaLimpa)}
                  </span>
                </div>
              </div>

              {/* SECTION: ROLES (COMPRADOR / GERENTE) */}
              <div className="grid grid-cols-1 gap-4">
                
                {/* COMPRADOR */}
                <div className="p-4 bg-blue-50/50 dark:bg-blue-900/10 rounded-2xl border border-blue-100 dark:border-blue-900/30">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
                        <TrendingUp size={16} className="text-white" />
                      </div>
                      <span className="text-xs font-black text-blue-900 dark:text-blue-300 uppercase italic">Comprador</span>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex flex-col">
                      <span className="text-[9px] font-black text-blue-600 uppercase tracking-widest">Saldo Reserva</span>
                      <span className={`text-xl font-black ${cotaComprador < 0 ? 'text-red-600' : 'text-blue-700 dark:text-blue-300'}`}>
                        {formatCurrency(cotaComprador)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* GERENTE */}
                <div className="p-4 bg-emerald-50/50 dark:bg-emerald-900/10 rounded-2xl border border-emerald-100 dark:border-emerald-900/30">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center">
                        <ShoppingCart size={16} className="text-white" />
                      </div>
                      <span className="text-xs font-black text-emerald-900 dark:text-emerald-300 uppercase italic">Gerente</span>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex flex-col">
                      <span className="text-[9px] font-black text-emerald-600 uppercase tracking-widest">Saldo Reserva</span>
                      <span className={`text-xl font-black ${cotaGerente < 0 ? 'text-red-600' : 'text-emerald-700 dark:text-emerald-300'}`}>
                        {formatCurrency(cotaGerente)}
                      </span>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          );
        })}
      </div>

      {/* Legenda */}
      <div className="mt-6 flex items-center justify-center gap-6 pt-4 border-t border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-emerald-500 rounded-full"></div>
          <span className="text-[9px] font-bold text-slate-600 dark:text-slate-400 uppercase">
            Saudável
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-amber-500 rounded-full"></div>
          <span className="text-[9px] font-bold text-slate-600 dark:text-slate-400 uppercase">
            Atenção (&lt; R$ 10k)
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-red-500 rounded-full"></div>
          <span className="text-[9px] font-bold text-slate-600 dark:text-slate-400 uppercase">
            Negativo
          </span>
        </div>
      </div>
    </div>
  );
};

export default ResumoAnoFiscal;

// ============================================================================
// FUNÇÃO AUXILIAR: Gerar os 12 meses rolling
// ============================================================================
// Usar no componente pai (BuyOrderQuotaView) para gerar os 12 meses

export function gerarMesesRolling(dataBase: Date = new Date()): { mes: number; ano: number }[] {
  const meses: { mes: number; ano: number }[] = [];
  
  for (let i = 0; i < 12; i++) {
    const data = new Date(dataBase.getFullYear(), dataBase.getMonth() + i, 1);
    meses.push({
      mes: data.getMonth() + 1, // 1-12
      ano: data.getFullYear()
    });
  }
  
  return meses;
}

// EXEMPLO DE USO:
// const mesesFiscais = gerarMesesRolling(); // Mai/26 ... Abr/27
// const quotasComDados = mesesFiscais.map(m => ({
//   ...m,
//   cota_limpa: 380000,
//   despesas_comprometidas: 50000,
//   pedidos_futuros_comprador: buscarPedidosFuturos(m.mes, m.ano, 'comprador'),
//   pedidos_futuros_gerente: buscarPedidosFuturos(m.mes, m.ano, 'gerente'),
//   qtd_pedidos: contarPedidos(m.mes, m.ano)
// }));