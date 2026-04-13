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
  const [fraseMotivacional, setFraseMotivacional] = useState<string>('Juntos somos mais fortes. Próxima semana tem mais! 💪');

  // Busca uma frase motivacional aleatória do banco sempre que o relatório é exibido
  useEffect(() => {
    if (!showPreview) return;
    const fetchFrase = async () => {
      const { data, error } = await supabase
        .from('Motivacional_frases')
        .select('phrase')
        .eq('active', true);

      if (data && !error && data.length > 0) {
        // Seleciona aleatoriamente entre as frases ativas
        const random = data[Math.floor(Math.random() * data.length)];
        setFraseMotivacional(random.phrase);
      }
    };
    fetchFrase();
  }, [showPreview, semanaSelecionada]); // Sorteia nova frase ao trocar de semana também

  const parseLocalDate = (dateStr: string): Date => {
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day);
  };

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

  // ─── IMPRESSÃO CORRIGIDA ───────────────────────────────────────────────────
  // Problema anterior: a nova janela não carregava o Tailwind CSS,
  // por isso saía tudo em branco.
  // Solução: injetar o Tailwind via CDN + aguardar carregamento antes de imprimir.
  const handlePrint = () => {
    const printContent = document.getElementById('relatorio-print');
    if (!printContent) {
      alert('Visualize o relatório antes de imprimir.');
      return;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Pop-ups bloqueados!\nPor favor, permita pop-ups para este site e tente novamente.');
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="pt-BR">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>Relatório P.A - ${storeName}</title>

          <!-- Tailwind CSS via CDN: garante que todas as classes funcionem na nova janela -->
          <script src="https://cdn.tailwindcss.com"><\/script>

          <style>
            /* Forçar impressão colorida (fundo + cores) */
            * {
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
              color-adjust: exact !important;
            }
            @page {
              size: A4 portrait;
              margin: 0.7cm;
            }
            body {
              background: white;
              margin: 0;
              padding: 0;
            }
          </style>
        </head>
        <body class="bg-white">
          ${printContent.outerHTML}
        </body>
      </html>
    `);
    printWindow.document.close();

    // Aguarda o Tailwind carregar completamente antes de disparar a impressão
    printWindow.addEventListener('load', () => {
      setTimeout(() => {
        try {
          printWindow.focus();
          printWindow.print();
          // Fecha após o diálogo de impressão fechar
          printWindow.addEventListener('afterprint', () => printWindow.close());
        } catch (e) {
          console.error('Erro ao imprimir:', e);
        }
      }, 800);
    });
  };
  // ──────────────────────────────────────────────────────────────────────────

  const getMedalha = (posicao: number) => {
    if (posicao === 0) return { emoji: '🥇', label: '1º LUGAR', isPodium: true };
    if (posicao === 1) return { emoji: '🥈', label: '2º LUGAR', isPodium: true };
    if (posicao === 2) return { emoji: '🥉', label: '3º LUGAR', isPodium: true };
    return { emoji: '⭐', label: `${posicao + 1}º LUGAR`, isPodium: false };
  };

  const semanaAtual = semanas.find(s => s.id === semanaSelecionada);
  const dataInicio = semanaAtual ? parseLocalDate(semanaAtual.data_inicio).toLocaleDateString('pt-BR') : '';
  const dataFim = semanaAtual ? parseLocalDate(semanaAtual.data_fim).toLocaleDateString('pt-BR') : '';
  const dataPagamento = semanaAtual
    ? (semanaAtual.data_pagamento
        ? parseLocalDate(semanaAtual.data_pagamento).toLocaleDateString('pt-BR')
        : new Date(parseLocalDate(semanaAtual.data_fim).getTime() + 86400000).toLocaleDateString('pt-BR'))
    : '';

  return (
    <div className="p-4 sm:p-6 space-y-4">

      {/* ── Controles (não aparecem na impressão) ── */}
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
                  {parseLocalDate(s.data_inicio).toLocaleDateString('pt-BR')} a {parseLocalDate(s.data_fim).toLocaleDateString('pt-BR')}
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

      {/* ── Relatório Compacto para Impressão A4 ── */}
      {showPreview && vendedores.length > 0 && (
        <div
          id="relatorio-print"
          className="bg-white rounded-2xl shadow-2xl overflow-hidden"
          style={{ maxWidth: '210mm', margin: '0 auto' }}
        >
          {/* Cabeçalho compacto */}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white px-6 py-4 text-center">
            <div className="flex items-center justify-center gap-3 mb-1">
              <Award size={28} className="text-yellow-300 flex-shrink-0" />
              <h1 className="text-2xl font-black uppercase italic leading-none">
                Parabéns aos <span className="text-yellow-300">Campeões!</span>
              </h1>
            </div>
            <p className="text-xs font-bold uppercase tracking-widest opacity-90 mt-1">
              Premiação P.A — Semana {dataInicio} a {dataFim}
            </p>
            <p className="text-xs font-black text-yellow-200 mt-0.5">
              📅 Pagamento: {dataPagamento}
            </p>
            <div className="mt-2 bg-white/20 rounded-xl py-1.5 px-4 inline-block">
              <p className="text-sm font-black uppercase">
                {storeName} — Loja {storeNumber}
              </p>
            </div>
          </div>

          {/* Lista de vendedores — cards compactos horizontais */}
          <div className="p-3 space-y-2">
            {vendedores.map((v, idx) => {
              const { emoji, label, isPodium } = getMedalha(idx);

              return (
                <div
                  key={idx}
                  className={`rounded-xl border-2 p-3 flex items-center gap-3 ${
                    isPodium
                      ? 'bg-gradient-to-r from-yellow-50 to-amber-50 border-yellow-400'
                      : 'bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-300'
                  }`}
                >
                  {/* Medalha + posição */}
                  <div className="flex-shrink-0 text-center w-14">
                    <div className="text-3xl leading-none">{emoji}</div>
                    <div className={`text-[9px] font-black uppercase mt-1 px-1 py-0.5 rounded-full ${
                      isPodium ? 'bg-yellow-400 text-yellow-900' : 'bg-blue-500 text-white'
                    }`}>
                      {label}
                    </div>
                  </div>

                  {/* Nome e código */}
                  <div className="flex-1 min-w-0">
                    <h2 className="text-base font-black text-slate-900 uppercase italic leading-tight">
                      {v.nome_vendedor}
                    </h2>
                    <p className="text-[10px] font-bold text-slate-400 uppercase">
                      Código: {v.cod_vendedor}
                    </p>
                    {v.faixas_acima > 0 && (
                      <span className="inline-flex items-center gap-1 mt-1 bg-gradient-to-r from-amber-400 to-orange-500 text-white text-[9px] font-black px-2 py-0.5 rounded-full">
                        <TrendingUp size={10} />
                        +{v.faixas_acima} {v.faixas_acima === 1 ? 'faixa' : 'faixas'} acima 🔥
                      </span>
                    )}
                  </div>

                  {/* Métricas */}
                  <div className="flex gap-2 flex-shrink-0">
                    {/* P.A */}
                    <div className="bg-white rounded-lg p-2 border-2 border-slate-200 text-center w-20">
                      <p className="text-[9px] font-black text-slate-400 uppercase leading-none mb-1">P.A Ating.</p>
                      <p className="text-base font-black text-green-600 leading-none">{v.pa_atingido.toFixed(2)}</p>
                      <p className="text-[9px] font-bold text-slate-400 mt-0.5">meta {v.pa_meta.toFixed(2)}</p>
                    </div>

                    {/* Vendas */}
                    <div className="bg-white rounded-lg p-2 border-2 border-slate-200 text-center w-24">
                      <p className="text-[9px] font-black text-slate-400 uppercase leading-none mb-1">Vendas</p>
                      <p className="text-sm font-black text-indigo-600 leading-none">
                        R$ {v.total_vendas.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}
                      </p>
                      <p className="text-[9px] font-bold text-slate-400 mt-0.5">{v.qtde_vendas} atend.</p>
                    </div>

                    {/* Itens */}
                    <div className="bg-white rounded-lg p-2 border-2 border-slate-200 text-center w-16">
                      <p className="text-[9px] font-black text-slate-400 uppercase leading-none mb-1">Itens</p>
                      <p className="text-xl font-black text-purple-600 leading-none">{v.qtde_itens}</p>
                      <p className="text-[9px] font-bold text-slate-400 mt-0.5">peças</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Rodapé compacto com frase motivacional aleatória do banco */}
          <div className="mx-3 mb-3 bg-gradient-to-r from-blue-600 to-indigo-700 text-white p-3 rounded-xl text-center">
            <p className="text-base font-black uppercase">🎉 Continue Assim, Time! 🎉</p>
            <p className="text-sm font-bold opacity-95 mt-1 italic">
              "{fraseMotivacional}"
            </p>
            <p className="text-[9px] font-bold opacity-60 mt-2">
              Gerado em {new Date().toLocaleDateString('pt-BR')} às {new Date().toLocaleTimeString('pt-BR')} &nbsp;|&nbsp; Sistema Dashboard P.A — Rede Real Calçados
            </p>
          </div>
        </div>
      )}

      <style>{`
        @media print {
          body * { visibility: hidden; }
          #relatorio-print, #relatorio-print * { visibility: visible; }
          #relatorio-print {
            position: absolute;
            left: 0; top: 0;
            width: 100%;
            background: white !important;
          }
          .no-print { display: none !important; }
          @page { size: A4 portrait; margin: 0.7cm; }
        }
      `}</style>
    </div>
  );
};

export default RelatorioPAImprimivel;