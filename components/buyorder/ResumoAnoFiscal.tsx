import React, { useState } from 'react';
import { TrendingUp, AlertCircle, Calendar, UserCheck, Package, Flame } from 'lucide-react';
import { supabase } from '../../services/supabaseClient';
import { toast } from 'sonner';

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
  
  // ✅ NOVOS CAMPOS: Saldo Reserva
  saldo_reserva_gerente?: number;
  saldo_reserva_comprador?: number;
  
  // ✅ NOVOS CAMPOS: Percentuais
  percentual_comprador?: number;
  percentual_gerente?: number;

  // ✅ NOVOS CAMPOS: Pedidos emitidos no mês (por tipo)
  pedidos_futuros_comprador?: number;
  pedidos_futuros_gerente?: number;
  qtd_pedidos_comprador?: number;
  qtd_pedidos_gerente?: number;

  // ✅ NOVOS CAMPOS PARA CORREÇÃO
  cota_do_mes?: number;
  cota_futuro_total?: number;
}

interface ResumoAnoFiscalProps {
  quotas: QuotaMes[];
  storeNumber: string;
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

export default function ResumoAnoFiscal({ quotas, storeNumber, onVerPedidos }: ResumoAnoFiscalProps) {
  const [expandedMonth, setExpandedMonth] = useState<number | null>(null);
  
  // Estados para o modal de pedidos
  const [showPedidosModal, setShowPedidosModal] = useState(false);
  const [pedidosMes, setPedidosMes] = useState<any[]>([]);
  const [mesSelecionado, setMesSelecionado] = useState({ mes: 0, ano: 0 });
  const [loadingPedidos, setLoadingPedidos] = useState(false);

  const getMesNome = (mes: number) => {
    const meses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    return meses[mes - 1] || '';
  };

  const handleVerPedidos = async (mes: number, ano: number) => {
    setLoadingPedidos(true);
    setMesSelecionado({ mes, ano });
    setShowPedidosModal(true);
    
    try {
      // Buscar pedidos do mês
      const { data, error } = await supabase
        .from('buy_orders')
        .select(`
          id,
          numero_pedido,
          marca,
          fornecedor,
          fat_inicio,
          fat_fim,
          prazos,
          vencimentos,
          user_name,
          user_role,
          desconto,
          buy_order_items (
            id,
            total_pares,
            custo,
            grades
          ),
          buy_order_sub_orders (
            id,
            sub_order_num,
            lojas_numeros,
            total_pares,
            valor_bruto
          )
        `)
        .gte('fat_inicio', `${ano}-${String(mes).padStart(2, '0')}-01`)
        .lt('fat_inicio', mes === 12 ? `${ano + 1}-01-01` : `${ano}-${String(mes + 1).padStart(2, '0')}-01`)
        .eq('status', 'confirmado')
        .order('numero_pedido', { ascending: true });

      if (error) throw error;

      // FILTRAR: Apenas pedidos que incluem a loja atual
      const pedidosLoja = (data || []).filter(pedido => {
        if (pedido.buy_order_sub_orders && pedido.buy_order_sub_orders.length > 0) {
          return pedido.buy_order_sub_orders.some((sub: any) => 
            sub.lojas_numeros?.includes(parseInt(storeNumber))
          );
        }
        return false;
      });

      // Query separada: grade_letra por item por sub_order
      const itemIds = pedidosLoja.flatMap(o => (o.buy_order_items || []).map((i: any) => i.id)).filter(Boolean);
      let allItemSubGrades: any[] = [];
      if (itemIds.length > 0) {
        const { data: subGradesData, error: subGradesError } = await supabase
          .from('buy_order_item_suborder_grades')
          .select('item_id, sub_order_num, grade_letra')
          .in('item_id', itemIds);
        if (subGradesError) throw subGradesError;
        if (subGradesData) {
          allItemSubGrades = subGradesData;
        }
      }

      // Criar lookup: item_id -> Map<sub_order_num, grade_letra>
      const gradeMap = new Map<string, Map<number, string>>();
      (allItemSubGrades || []).forEach((g: any) => {
        if (!gradeMap.has(g.item_id)) gradeMap.set(g.item_id, new Map());
        gradeMap.get(g.item_id)!.set(Number(g.sub_order_num), g.grade_letra);
      });
      
      // Calcular totais de cada pedido de forma correta e sem inflar
      const pedidosComTotais = pedidosLoja.map(pedido => {
        const desconto = pedido.desconto || 0;
        const fatorDesconto = 1 - (desconto / 100);
        const items = (pedido.buy_order_items as any[]) || [];
        const subOrders = (pedido.buy_order_sub_orders as any[]) || [];
        
        let totalParesLoja = 0;
        let totalCustoBrutoLoja = 0;

        for (const item of items) {
          const itemGrades = gradeMap.get(item.id);
          if (!itemGrades) continue;

          for (const sub of subOrders) {
            // Verificar se ESTA loja está neste sub_order
            const lojas = (sub.lojas_numeros || []).map(Number);
            if (!lojas.includes(parseInt(storeNumber))) continue;

            const gradLetra = itemGrades.get(Number(sub.sub_order_num));
            if (!gradLetra) continue;

            // Extrair quantidade da grade específica
            const gradeEntry = (item.grades || []).find((g: any) => g.letra === gradLetra);
            if (!gradeEntry || !gradeEntry.tamanhos) continue;

            const qtd = Object.values(gradeEntry.tamanhos as Record<string, number>)
              .reduce((sum: number, v: number) => sum + (typeof v === 'number' ? v : 0), 0);

            totalParesLoja += qtd;
            totalCustoBrutoLoja += qtd * Number(item.custo || 0);
          }
        }

        const totalPares = totalParesLoja;
        const totalCusto = totalCustoBrutoLoja * fatorDesconto;
        
        // Agrupar vencimentos por mês
        const vencimentosPorMes: Record<string, number> = {};
        const numParcelas = pedido.prazos?.length || 1;
        const valorParcela = totalCusto / numParcelas;
        
        pedido.vencimentos?.forEach((venc: string) => {
          const [vAno, vMes] = venc.split('-');
          const mesesAbrev = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];
          const mesNome = mesesAbrev[parseInt(vMes) - 1];
          vencimentosPorMes[mesNome] = (vencimentosPorMes[mesNome] || 0) + valorParcela;
        });
        
        return {
          ...pedido,
          totalPares,
          totalCusto,
          vencimentosPorMes
        };
      });
      
      setPedidosMes(pedidosComTotais);
    } catch (error) {
      console.error('Erro ao buscar pedidos:', error);
      toast.error('Erro ao carregar pedidos');
    } finally {
      setLoadingPedidos(false);
    }
  };
  
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

  // Função para determinar status e cores
  const getStatusCores = (saldoReserva: number, valorOriginal: number) => {
    const percentual = valorOriginal > 0 ? (saldoReserva / valorOriginal) * 100 : 0;
    
    if (saldoReserva <= 0) {
      // VERMELHO - Sem cota
      return {
        status: 'sem_cota',
        gradiente: 'linear-gradient(135deg, #FEE2E2 0%, #FECACA 100%)',
        borda: '#EF4444',
        textoPrimario: '#991B1B',
        textoSecundario: '#DC2626',
        icone: '#FEE2E2'
      };
    } else if (percentual <= 30) {
      // AMARELO - Cota acabando
      return {
        status: 'acabando',
        gradiente: 'linear-gradient(135deg, #FEF3C7 0%, #FDE68A 100%)',
        borda: '#F59E0B',
        textoPrimario: '#92400E',
        textoSecundario: '#B45309',
        icone: '#FEF3C7'
      };
    } else {
      // VERDE - Cota disponível
      return {
        status: 'disponivel',
        gradiente: 'linear-gradient(135deg, #EAF3DE 0%, #C0DD97 100%)',
        borda: '#97C459',
        textoPrimario: '#3B6D11',
        textoSecundario: '#639922',
        icone: '#EAF3DE'
      };
    }
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
          const cotaComprador = toNumber(quota.saldo_reserva_comprador);
          const cotaGerente = toNumber(quota.saldo_reserva_gerente);
          
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
                  <div className="flex gap-2">
                    <button 
                      onClick={() => handleVerPedidos(quota.mes, quota.ano)}
                      className="px-3 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors flex items-center gap-1.5"
                      title="Ver pedidos deste mês"
                    >
                      <Package className="w-4 h-4" />
                      <span className="hidden sm:inline">Ver Pedidos</span>
                    </button>
                    <button
                      onClick={() => setExpandedMonth(isExpanded ? null : quota.mes)}
                      className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                    >
                      <Calendar size={18} className="text-slate-500" />
                    </button>
                  </div>
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
                        = Cota do Mês
                      </span>
                      <span className="font-black text-xl text-blue-600">
                        {formatarMoeda(toNumber(quota.cota_do_mes || quota.cota_disponivel))}
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

              {/* CARD ÚNICO - COTA FUTURO */}
              <div className="p-5">
                <div 
                  style={{
                    background: 'linear-gradient(135deg, #EAF3DE 0%, #C0DD97 100%)',
                    border: '1px solid #97C459',
                    borderRadius: '12px',
                    padding: '16px'
                  }}
                >
                  {/* Cabeçalho */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                    <div style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      background: '#639922',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <Flame style={{ width: '16px', height: '16px', color: '#EAF3DE' }} />
                    </div>
                    <div>
                      <div style={{ fontSize: '12px', fontWeight: 600, color: '#3B6D11', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        Cota Futuro
                      </div>
                      <div style={{ fontSize: '10px', color: '#639922' }}>
                        Máx. comprável (mín. 3 meses × 3)
                      </div>
                    </div>
                  </div>
                  
                  {/* Total Disponível */}
                  <div style={{
                    background: 'rgba(255, 255, 255, 0.5)',
                    border: '1px solid rgba(99, 153, 34, 0.2)',
                    borderRadius: '8px',
                    padding: '12px',
                    textAlign: 'center',
                    marginBottom: '12px'
                  }}>
                    <div style={{ fontSize: '11px', fontWeight: 500, color: '#639922', marginBottom: '4px' }}>
                      TOTAL DISPONÍVEL
                    </div>
                    <div style={{ fontSize: '26px', fontWeight: 500, color: '#3B6D11' }}>
                      {formatarMoeda(quota.cota_futuro_total || (toNumber(quota.cota_comprador_valor) + toNumber(quota.cota_gerente_valor)))}
                    </div>
                  </div>
                  
                  {/* Grid Comprador/Gerente */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    
                    {/* Comprador */}
                    <div style={{
                      background: 'rgba(255, 255, 255, 0.7)',
                      border: '1px solid rgba(99, 153, 34, 0.3)',
                      borderRadius: '8px',
                      padding: '10px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                        <TrendingUp style={{ width: '16px', height: '16px', color: '#3B6D11' }} />
                        <span style={{ fontSize: '11px', fontWeight: 500, color: '#639922', textTransform: 'uppercase' }}>
                          Comprador
                        </span>
                      </div>
                      <div style={{ fontSize: '18px', fontWeight: 500, color: '#3B6D11' }}>
                        {formatarMoeda(toNumber(quota.saldo_reserva_comprador ?? quota.cota_comprador_valor))}
                      </div>
                      <div style={{ fontSize: '9px', color: '#639922', marginTop: '2px' }}>
                        {toNumber(quota.percentual_comprador).toFixed(1)}% do total
                      </div>
                    </div>
                    
                    {/* Gerente */}
                    <div style={{
                      background: 'rgba(255, 255, 255, 0.7)',
                      border: '1px solid rgba(99, 153, 34, 0.3)',
                      borderRadius: '8px',
                      padding: '10px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                        <UserCheck style={{ width: '16px', height: '16px', color: '#3B6D11' }} />
                        <span style={{ fontSize: '11px', fontWeight: 500, color: '#639922', textTransform: 'uppercase' }}>
                          Gerente
                        </span>
                      </div>
                      <div style={{ fontSize: '18px', fontWeight: 500, color: '#3B6D11' }}>
                        {formatarMoeda(toNumber(quota.saldo_reserva_gerente ?? quota.cota_gerente_valor))}
                      </div>
                      <div style={{ fontSize: '9px', color: '#639922', marginTop: '2px' }}>
                        {toNumber(quota.percentual_gerente).toFixed(1)}% do total
                      </div>
                    </div>
                    
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* MODAL DE PEDIDOS DO MÊS */}
      {showPedidosModal && (
        <div 
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm"
          onClick={() => setShowPedidosModal(false)}
        >
          <div 
            className="bg-white dark:bg-slate-900 rounded-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl animate-in zoom-in duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* HEADER */}
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-gradient-to-r from-blue-600 to-indigo-700">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-black text-white uppercase italic">
                    📦 Pedidos de {getMesNome(mesSelecionado.mes)} {mesSelecionado.ano}
                  </h3>
                  <p className="text-xs font-bold text-blue-100 mt-0.5 uppercase tracking-widest opacity-80">
                    {pedidosMes.length} {pedidosMes.length === 1 ? 'pedido cadastrado' : 'pedidos cadastrados'}
                  </p>
                </div>
                <button
                  onClick={() => setShowPedidosModal(false)}
                  className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/20 hover:bg-white/30 transition-colors text-white"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* BODY */}
            <div className="flex-1 overflow-y-auto p-6 bg-slate-50 dark:bg-slate-800/50">
              {loadingPedidos ? (
                <div className="flex flex-col items-center justify-center py-20">
                  <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4" />
                  <p className="text-sm font-black text-slate-500 uppercase tracking-widest">Buscando pedidos...</p>
                </div>
              ) : pedidosMes.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                  <Package className="w-20 h-20 mb-4 opacity-20" />
                  <p className="text-xl font-black uppercase italic">Nenhum pedido</p>
                  <p className="text-sm font-bold opacity-60">Não há pedidos confirmados para este mês</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4">
                  {pedidosMes.map((pedido) => {
                    // Verificar se tem múltiplas lojas
                    const todasLojas = pedido.buy_order_sub_orders
                      ?.flatMap((sub: any) => sub.lojas_numeros || []) || [];
                    const temMultiplasLojas = todasLojas.length > 1;

                    return (
                      <div 
                        key={pedido.id}
                        className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden hover:shadow-lg transition-all duration-200"
                      >
                        {/* CABEÇALHO DO PEDIDO */}
                        <div className="bg-slate-50 dark:bg-slate-900/50 px-5 py-4 border-b border-slate-200 dark:border-slate-700">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              <span className="text-2xl font-black text-blue-600 italic">
                                #{pedido.numero_pedido}
                              </span>
                              <div>
                                <div className="text-lg font-black text-slate-900 dark:text-white uppercase italic">
                                  {pedido.marca}
                                </div>
                                <div className="text-xs font-bold text-slate-500 uppercase">
                                  {pedido.fornecedor}
                                </div>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-sm font-black text-slate-700 dark:text-slate-300 uppercase">
                                {pedido.user_name}
                              </div>
                              <div className="text-[10px] font-bold text-slate-500 bg-slate-200 dark:bg-slate-700 px-2 py-0.5 rounded-full inline-block mt-1">
                                {pedido.user_role === 'gerente' ? 'GERENTE' : 'COMPRADOR'}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* SE TEM MÚLTIPLAS LOJAS: MOSTRAR SUB-PEDIDOS */}
                        {temMultiplasLojas ? (
                          <div className="p-4 bg-amber-50 dark:bg-amber-900/10 border-b border-amber-200 dark:border-amber-900/30">
                            <div className="text-xs font-black text-amber-800 dark:text-amber-400 mb-3 flex items-center gap-2 uppercase tracking-widest">
                              <Package className="w-4 h-4" />
                              Pedido com múltiplas lojas:
                            </div>
                            
                            <div className="space-y-2">
                              {pedido.buy_order_sub_orders.map((sub: any) => (
                                <div key={sub.id} className="bg-white dark:bg-slate-900 rounded-xl p-3 border border-slate-200 dark:border-slate-700 shadow-sm">
                                  <div className="flex items-center justify-between">
                                    <div className="font-black text-sm uppercase italic text-slate-700 dark:text-slate-300">
                                      {sub.lojas_numeros?.map((n: number) => `Loja ${n}`).join(', ')}
                                    </div>
                                    <div className="text-[10px] font-bold text-slate-400 uppercase">
                                      Sub-pedido #{sub.sub_order_num}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>

                            <div className="mt-3 pt-3 border-t border-amber-300 dark:border-amber-900/30">
                              <div className="text-xs font-bold text-amber-700 dark:text-amber-500 uppercase tracking-tighter">
                                Total do pedido principal: {pedido.totalPares} pares • {formatarMoeda(pedido.totalCusto)}
                              </div>
                            </div>
                          </div>
                        ) : (
                          /* DETALHES DO PEDIDO SIMPLES */
                          <div className="p-5 grid grid-cols-2 md:grid-cols-4 gap-6">
                            <div>
                              <div className="text-[10px] font-bold text-slate-500 uppercase mb-1">Emissão</div>
                              <div className="font-black text-slate-900 dark:text-white">
                                {new Date(pedido.fat_inicio + 'T00:00:00').toLocaleDateString('pt-BR')}
                              </div>
                            </div>

                            <div>
                              <div className="text-[10px] font-bold text-slate-500 uppercase mb-1">Entrega</div>
                              <div className="font-black text-slate-900 dark:text-white">
                                {new Date(pedido.fat_fim + 'T00:00:00').toLocaleDateString('pt-BR')}
                              </div>
                            </div>

                            <div>
                              <div className="text-[10px] font-bold text-slate-500 uppercase mb-1">Total Pares</div>
                              <div className="font-black text-emerald-600 text-xl">
                                {pedido.totalPares}
                              </div>
                            </div>

                            <div>
                              <div className="text-[10px] font-bold text-slate-500 uppercase mb-1">Investimento</div>
                              <div className="font-black text-blue-600 text-xl">
                                {formatarMoeda(pedido.totalCusto)}
                              </div>
                            </div>
                          </div>
                        )}

                        {/* VENCIMENTOS */}
                        <div className="px-5 pb-5">
                          <div className="text-[10px] font-bold text-slate-500 uppercase mb-2">Vencimentos (Parcelas)</div>
                          <div className="flex flex-wrap gap-2">
                            {Object.entries(pedido.vencimentosPorMes).map(([mes, valor]) => (
                              <div 
                                key={mes}
                                className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-xl px-4 py-2"
                              >
                                <span className="text-xs font-black text-blue-800 dark:text-blue-300 mr-2">{mes}</span>
                                <span className="text-sm font-black text-blue-600">{formatarMoeda(valor as number)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* FOOTER */}
            <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 flex justify-between items-center">
              <div className="flex gap-6">
                <div className="text-center">
                   <div className="text-[10px] font-bold text-slate-400 uppercase">Total Pares</div>
                   <div className="font-black text-slate-900 dark:text-white">
                     {pedidosMes.reduce((sum, p) => sum + p.totalPares, 0)}
                   </div>
                </div>
                <div className="text-center border-l border-slate-200 dark:border-slate-700 pl-6">
                   <div className="text-[10px] font-bold text-slate-400 uppercase">Total Investimento</div>
                   <div className="font-black text-blue-600">
                     {formatarMoeda(pedidosMes.reduce((sum, p) => sum + p.totalCusto, 0))}
                   </div>
                </div>
              </div>
              <button
                onClick={() => setShowPedidosModal(false)}
                className="px-6 py-3 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-white rounded-xl font-black uppercase text-xs transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
