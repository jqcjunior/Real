import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabaseClient';
import { Printer, Trophy, Medal, Star, Award, TrendingUp } from 'lucide-react';
 
interface VendedorPremio {
  cod_vendedor: string;
  nome_vendedor: string;
  pa_atingido: number;
  pa_meta: number;
  valor_premio: number;
  faixas_acima: number;
  total_vendas: number;
  qtde_vendas: number;
  qtde_itens: number;
}
 
interface RelatorioProps {
  storeId: string;
  storeName: string;
  storeNumber: string;
}
 
const RelatorioPAImprimivel: React.FC<RelatorioProps> = ({ storeId, storeName, storeNumber }) => {
  const [semanas, setSemanas] = useState<any[]>([]);
  const [semanaSelecionada, setSemanaSelecionada] = useState<string>('');
  const [vendedores, setVendedores] = useState<VendedorPremio[]>([]);
  const [parametros, setParametros] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
 
  useEffect(() => {
    const fetchSemanas = async () => {
      const { data, error } = await supabase
        .from('Dashboard_PA_Semanas')
        .select('*')
        .eq('store_id', storeId)
        .order('data_inicio', { ascending: false })
        .limit(10);
 
      if (data && !error) {
        setSemanas(data);
        if (data.length > 0) setSemanaSelecionada(data[0].id);
      }
    };
    fetchSemanas();
  }, [storeId]);
 
  useEffect(() => {
    const fetchParametros = async () => {
      const { data } = await supabase
        .from('Dashboard_PA_Parametros')
        .select('*')
        .eq('store_id', storeId)
        .single();
      if (data) setParametros(data);
    };
    fetchParametros();
  }, [storeId]);
 
  useEffect(() => {
    if (!semanaSelecionada) return;
    const fetchVendedores = async () => {
      setLoading(true);
      const { data: premios } = await supabase
        .from('Dashboard_PA_Premiacoes')
        .select(`
          *,
          venda:Dashboard_PA_Vendas!venda_id (
            total_vendas,
            qtde_vendas,
            qtde_itens
          )
        `)
        .eq('semana_id', semanaSelecionada)
        .eq('atingiu_meta', true)
        .order('pa_atingido', { ascending: false });
 
      if (premios) {
        const vendedoresPremio: VendedorPremio[] = premios.map((p: any) => ({
          cod_vendedor: p.cod_vendedor,
          nome_vendedor: p.nome_vendedor,
          pa_atingido: Number(p.pa_atingido || 0),
          pa_meta: Number(p.pa_meta || 0),
          valor_premio: Number(p.valor_premio || 0),
          faixas_acima: Number(p.faixas_acima || 0),
          total_vendas: Number(p.venda?.total_vendas || 0),
          qtde_vendas: Number(p.venda?.qtde_vendas || 0),
          qtde_itens: Number(p.venda?.qtde_itens || 0),
        }));
        setVendedores(vendedoresPremio);
      }
      setLoading(false);
    };
    fetchVendedores();
  }, [semanaSelecionada]);
 
  const handlePrint = () => {
    const printContent = document.getElementById('relatorio-print');
    if (!printContent) return;
    
    // Em ambientes de iframe (como o preview), window.print() costuma ser bloqueado.
    // A melhor prática é abrir em uma nova janela para imprimir.
    handlePrintFallback();
  };
 
  const handlePrintFallback = () => {
    const printContent = document.getElementById('relatorio-print');
    if (!printContent) return;
    
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      console.error('Pop-ups bloqueados. Por favor, permita pop-ups para imprimir.');
      return;
    }

    // Copiar estilos para a nova janela para garantir que o Tailwind funcione
    const styles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
      .map(style => style.outerHTML)
      .join('\n');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <title>Relatório P.A - ${storeName}</title>
          ${styles}
          <style>
            @media print {
              @page { size: A4; margin: 1cm; }
              body { padding: 0 !important; background: white !important; }
              .no-print { display: none !important; }
            }
            body { background: white !important; }
          </style>
        </head>
        <body class="bg-white p-8">${printContent.innerHTML}</body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    
    // Pequeno delay para garantir que os estilos e imagens carreguem
    setTimeout(() => { 
      try {
        printWindow.print(); 
        printWindow.close(); 
      } catch (e) {
        console.error('Erro ao imprimir:', e);
      }
    }, 500);
  };
 
  const getMedalha = (posicao: number) => {
    if (posicao === 0) return { icon: <Trophy className="text-yellow-400" size={48} />, label: '🥇 1º LUGAR' };
    if (posicao === 1) return { icon: <Medal className="text-slate-400" size={48} />, label: '🥈 2º LUGAR' };
    if (posicao === 2) return { icon: <Medal className="text-orange-600" size={48} />, label: '🥉 3º LUGAR' };
    return { icon: <Star className="text-blue-500" size={40} />, label: '⭐ DESTAQUE' };
  };
 
  const semanaAtual = semanas.find(s => s.id === semanaSelecionada);
  const dataInicio = semanaAtual ? new Date(semanaAtual.data_inicio + 'T00:00:00').toLocaleDateString('pt-BR') : '';
  const dataFim = semanaAtual ? new Date(semanaAtual.data_fim + 'T00:00:00').toLocaleDateString('pt-BR') : '';
  const dataPagamento = semanaAtual ? new Date(new Date(semanaAtual.data_fim + 'T00:00:00').getTime() + 86400000).toLocaleDateString('pt-BR') : '';
 
  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Controles — não aparecem na impressão */}
      <div className="no-print bg-white dark:bg-slate-900 p-4 sm:p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 space-y-4">
        <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white uppercase italic">
          📄 Relatório de <span className="text-blue-600">Premiação P.A</span>
        </h2>
 
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2 block">
              Selecionar Semana
            </label>
            <select
              value={semanaSelecionada}
              onChange={(e) => setSemanaSelecionada(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 dark:text-white"
            >
              {semanas.map(s => (
                <option key={s.id} value={s.id}>
                  {new Date(s.data_inicio + 'T00:00:00').toLocaleDateString('pt-BR')} a {new Date(s.data_fim + 'T00:00:00').toLocaleDateString('pt-BR')}
                </option>
              ))}
            </select>
          </div>
 
          <div className="flex items-end gap-2">
            <button
              onClick={() => setShowPreview(!showPreview)}
              className="flex-1 bg-blue-600 text-white px-4 py-3 rounded-xl font-black uppercase text-xs shadow-lg hover:bg-blue-700 transition-all active:scale-95"
            >
              {showPreview ? 'Ocultar' : 'Visualizar'} Relatório
            </button>
            <button
              onClick={handlePrint}
              disabled={vendedores.length === 0}
              className="flex items-center gap-2 bg-green-600 text-white px-4 py-3 rounded-xl font-black uppercase text-xs shadow-lg hover:bg-green-700 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Printer size={16} />
              Imprimir
            </button>
          </div>
        </div>
 
        {loading && (
          <div className="text-center py-8">
            <p className="text-sm font-bold text-slate-500">Carregando dados...</p>
          </div>
        )}
 
        {!loading && vendedores.length === 0 && showPreview && (
          <div className="text-center py-12 bg-slate-50 dark:bg-slate-800 rounded-xl">
            <Trophy className="mx-auto mb-4 text-slate-300" size={48} />
            <p className="text-sm font-bold text-slate-500">
              Nenhum vendedor atingiu a meta nesta semana
            </p>
          </div>
        )}
      </div>
 
      {/* Relatório para Impressão */}
      {showPreview && vendedores.length > 0 && (
        <div className="print-area bg-white p-8 sm:p-12 rounded-2xl shadow-2xl" id="relatorio-print">
          
          {/* Cabeçalho */}
          <div className="text-center mb-12 pb-8 border-b-4 border-blue-600">
            <div className="flex items-center justify-center gap-4 mb-4">
              <Award size={48} className="text-blue-600" />
              <div>
                <h1 className="text-3xl sm:text-4xl font-black text-slate-900 uppercase italic leading-none">
                  Parabéns aos <span className="text-blue-600">Campeões!</span>
                </h1>
                <p className="text-sm font-bold text-slate-500 uppercase tracking-widest mt-2">
                  Premiação P.A — Semana {dataInicio} a {dataFim}
                </p>
                <p className="text-[10px] font-black text-blue-600 uppercase tracking-[0.2em] mt-1">
                  📅 Data de Pagamento: {dataPagamento}
                </p>
              </div>
            </div>
            <div className="mt-6 bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-3 px-6 rounded-2xl inline-block">
              <p className="text-lg font-black uppercase">
                {storeName} — Loja {storeNumber}
              </p>
            </div>
          </div>
 
          {/* Lista de Vendedores */}
          <div className="space-y-6">
            {vendedores.map((v, idx) => {
              const medalha = getMedalha(idx);
              const isPodium = idx < 3;
 
              return (
                <div
                  key={idx}
                  className={`relative overflow-hidden rounded-3xl border-4 ${
                    isPodium
                      ? 'bg-gradient-to-r from-yellow-50 to-amber-50 border-yellow-400 shadow-2xl'
                      : 'bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-300 shadow-lg'
                  } p-6 sm:p-8`}
                >
                  {/* Posição e Nome */}
                  <div className="flex items-start gap-6 mb-6">
                    <div className="flex-shrink-0">{medalha.icon}</div>
                    <div className="flex-1">
                      <div className={`inline-block px-4 py-1 rounded-full text-xs font-black uppercase mb-2 ${
                        isPodium ? 'bg-yellow-400 text-yellow-900' : 'bg-blue-500 text-white'
                      }`}>
                        {medalha.label}
                      </div>
                      <h2 className="text-2xl sm:text-3xl font-black text-slate-900 uppercase italic leading-none">
                        {v.nome_vendedor}
                      </h2>
                      <p className="text-sm font-bold text-slate-500 uppercase tracking-widest mt-1">
                        Código: {v.cod_vendedor}
                      </p>
                    </div>
                  </div>
 
                  {/* Métricas — SEM o card de Prêmio */}
                  <div className="grid grid-cols-3 gap-4 mb-6">
                    <div className="bg-white rounded-2xl p-4 border-2 border-slate-200">
                      <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">P.A Atingido</p>
                      <p className="text-2xl font-black text-green-600">{v.pa_atingido.toFixed(2)}</p>
                      <p className="text-[10px] font-bold text-slate-500">Meta: {v.pa_meta.toFixed(2)}</p>
                    </div>
 
                    <div className="bg-white rounded-2xl p-4 border-2 border-slate-200">
                      <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Vendas</p>
                      <p className="text-2xl font-black text-indigo-600">
                        R$ {v.total_vendas.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}
                      </p>
                      <p className="text-[10px] font-bold text-slate-500">{v.qtde_vendas} atendimentos</p>
                    </div>
 
                    <div className="bg-white rounded-2xl p-4 border-2 border-slate-200">
                      <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Itens</p>
                      <p className="text-2xl font-black text-purple-600">{v.qtde_itens}</p>
                      <p className="text-[10px] font-bold text-slate-500">peças vendidas</p>
                    </div>
                  </div>
 
                  {/* Banner de destaque para quem superou a meta */}
                  {v.faixas_acima > 0 && (
                    <div className="bg-gradient-to-r from-amber-400 to-orange-500 text-white px-6 py-3 rounded-xl flex items-center gap-3">
                      <TrendingUp size={24} />
                      <p className="font-black uppercase text-sm">
                        Superou a meta em {v.faixas_acima} {v.faixas_acima === 1 ? 'faixa' : 'faixas'}! 🔥
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
 
          {/* Rodapé */}
          <div className="mt-12 pt-8 border-t-2 border-slate-200">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-6 rounded-2xl text-center">
              <p className="text-2xl font-black uppercase mb-2">🎉 Continue Assim, Time! 🎉</p>
              <p className="text-sm font-bold opacity-90">Juntos somos mais fortes. Próxima semana tem mais! 💪</p>
            </div>
            <div className="text-center mt-6">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                Gerado em {new Date().toLocaleDateString('pt-BR')} às {new Date().toLocaleTimeString('pt-BR')}
              </p>
              <p className="text-[10px] font-bold text-slate-300 mt-1">
                Sistema Dashboard P.A — Rede Real Calçados
              </p>
            </div>
          </div>
        </div>
      )}
 
      {/* Estilos de Impressão */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #relatorio-print, #relatorio-print * { visibility: visible; }
          #relatorio-print {
            position: absolute;
            left: 0; top: 0;
            width: 100%;
            background: white !important;
            padding: 2rem;
          }
          .no-print { display: none !important; }
          @page { size: A4; margin: 1cm; }
        }
        body.printing-mode .no-print { display: none !important; }
        .print-area { max-width: 210mm; margin: 0 auto; }
      `}</style>
    </div>
  );
};
 
export default RelatorioPAImprimivel;