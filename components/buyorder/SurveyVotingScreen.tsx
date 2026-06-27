import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../services/supabaseClient';

// ─── Types ────────────────────────────────────────────────────────────────────

interface GradeTemplate {
  letra: string;
  nome: string;
  categoria: string;
  tamanhos: Record<string, number>;
  total_pares: number;
}

interface BuyOrderItem {
  id: string;
  item_order: number;
  referencia: string;
  tipo: string;
  cor1: string;
  cor2: string;
  cor3: string;
  modelo: 'MASC' | 'FEM' | 'INF' | 'ACES';
  custo: number;
  preco_venda: number;
  markup_aplicado: number;
  foto_url?: string;
}

interface VotoItem {
  item_id: string;
  referencia: string;
  resposta: 'SIM' | 'NAO';
  grade_letra: string | null;
  total_pares: number;
  valor: number;
}

interface SurveyVotingScreenProps {
  user: any;
  orderId: string;
  subOrderNum: number;
  storeId: string;
  onClose: () => void;
  onComplete: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const MODELO_CATEGORIA: Record<string, string> = {
  MASC: 'masculino',
  FEM:  'feminino',
  INF:  'infantil',
  ACES: 'acessorio',
};

const GRADE_LETRAS = ['A', 'B', 'C', 'D'];

function totalPares(tamanhos: Record<string, number>): number {
  return Object.values(tamanhos).reduce((a, b) => a + b, 0);
}

function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function SurveyVotingScreen({
  user,
  orderId,
  subOrderNum,
  storeId,
  onClose,
  onComplete,
}: SurveyVotingScreenProps) {
  const [items, setItems] = useState<BuyOrderItem[]>([]);
  const [templates, setTemplates] = useState<GradeTemplate[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [votos, setVotos] = useState<Record<string, VotoItem>>({});
  const [selectedGrade, setSelectedGrade] = useState<string | null>(null);
  const [voteChoice, setVoteChoice] = useState<'SIM' | 'NAO' | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [storeName, setStoreName] = useState<string>('');
  const [storeNumber, setStoreNumber] = useState<string>('');

  const userId = user?.user_id || user?.id || '';
  const userName = user?.name || user?.email || '';

  // Fetch order items and grade templates
  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [itemsRes, templatesRes] = await Promise.all([
          supabase
            .from('buy_order_items')
            .select('*')
            .eq('order_id', orderId)
            .order('item_order'),
          supabase
            .from('survey_grade_templates')
            .select('*')
            .eq('is_active', true)
            .in('letra', GRADE_LETRAS)
            .order('sort_order'),
        ]);

        if (itemsRes.error) throw itemsRes.error;
        if (templatesRes.error) throw templatesRes.error;

        // Buscar fotos do catálogo pela referência
        const refs = (itemsRes.data ?? [])
          .map(i => i.referencia)
          .filter(Boolean);

        let photoMap: Record<string, string> = {};
        if (refs.length > 0) {
          const { data: photos } = await supabase
            .from('product_catalog')
            .select('referencia, image_url')
            .in('referencia', refs);
          (photos || []).forEach(p => {
            if (p.image_url) photoMap[p.referencia] = p.image_url;
          });
        }

        // Mesclar foto_url nos itens
        const itemsWithPhotos = (itemsRes.data ?? []).map(item => ({
          ...item,
          foto_url: photoMap[item.referencia] || null,
        }));

        setItems(itemsWithPhotos);
        setTemplates(templatesRes.data ?? []);

        // Fetch store name and number if storeId is provided
        if (storeId) {
          const { data: storeData } = await supabase
            .from('stores')
            .select('number, city')
            .eq('id', storeId)
            .maybeSingle();
          if (storeData) {
            setStoreNumber(String(storeData.number));
            setStoreName(`Loja ${storeData.number} - ${storeData.city}`);
          }
        }
      } catch (err: any) {
        setError(err.message ?? 'Erro ao carregar dados.');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [orderId, storeId]);

  // Reset vote state when item changes
  useEffect(() => {
    const existing = items[currentIndex]
      ? votos[items[currentIndex].id]
      : undefined;
    if (existing) {
      setVoteChoice(existing.resposta);
      setSelectedGrade(existing.grade_letra);
    } else {
      setVoteChoice(null);
      setSelectedGrade(null);
    }
  }, [currentIndex, items]);

  const currentItem = items[currentIndex] ?? null;
  const progress = items.length > 0 ? ((currentIndex) / items.length) * 100 : 0;

  // Get available templates for current item's modelo
  const availableTemplates = currentItem
    ? templates.filter(
        t => t.categoria === MODELO_CATEGORIA[currentItem.modelo]
      )
    : [];

  function pickGrade(letra: string) {
    setSelectedGrade(letra);
    setVoteChoice('SIM');
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  function vote(choice: 'SIM' | 'NAO') {
    setVoteChoice(choice);
    if (choice === 'NAO') setSelectedGrade(null);
  }

  const canConfirm =
    voteChoice === 'NAO' || (voteChoice === 'SIM' && selectedGrade !== null);

  function confirm() {
    if (!currentItem || !canConfirm) return;

    const template = availableTemplates.find(t => t.letra === selectedGrade);
    const pares = template ? totalPares(template.tamanhos) : 0;
    const valor = pares * currentItem.custo;

    const voto: VotoItem = {
      item_id:     currentItem.id,
      referencia:  currentItem.referencia,
      resposta:    voteChoice!,
      grade_letra: voteChoice === 'SIM' ? selectedGrade : null,
      total_pares: voteChoice === 'SIM' ? pares : 0,
      valor:       voteChoice === 'SIM' ? valor : 0,
    };

    setVotos(prev => ({ ...prev, [currentItem.id]: voto }));

    if (currentIndex < items.length - 1) {
      setCurrentIndex(i => i + 1);
    } else {
      submitVotes({ ...votos, [currentItem.id]: voto });
    }
  }

  const submitVotes = useCallback(
    async (allVotos: Record<string, VotoItem>) => {
      setSubmitting(true);
      try {
        // Build vote payload for survey_params.votos
        const votosArray = Object.values(allVotos);

        // Upsert into survey_votes table
        const rows = votosArray.map(v => ({
          order_id:    orderId,
          sub_order_num: subOrderNum,
          store_id:    storeId,
          user_id:     userId,
          item_id:     v.item_id,
          resposta:    v.resposta,
          grade_letra: v.grade_letra,
          total_pares: v.total_pares,
          valor:       v.valor,
        }));

        const { error: upsertError } = await supabase
          .from('survey_votes')
          .upsert(rows, {
            onConflict: 'order_id,store_id,item_id',
          });

        if (upsertError) throw upsertError;

        // Append store vote to survey_params.votos in buy_orders
        const storeVotePayload = {
          store_id:     storeId,
          store_number: storeNumber,
          store_name:   storeName,
          user_id:      userId,
          user_name:    userName,
          voted_at:     new Date().toISOString(),
          itens: votosArray.map(v => ({
            ref:         v.referencia,
            item_id:     v.item_id,
            voto:        v.resposta === 'SIM',
            grade_letra: v.grade_letra,
            total_pares: v.total_pares,
            valor:       v.valor,
          })),
        };

        const { error: rpcError } = await supabase.rpc(
          'append_survey_vote',
          {
            p_order_id:  orderId,
            p_store_vote: storeVotePayload,
          }
        );

        if (rpcError) throw rpcError;

        onComplete();
      } catch (err: any) {
        setError(err.message ?? 'Erro ao enviar votos.');
        setSubmitting(false);
      }
    },
    [orderId, storeId, userId, userName, storeName, storeNumber, subOrderNum, onComplete]
  );

  // ─── Render helpers ──────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={styles.centered}>
        <div style={styles.spinner} />
        <p style={styles.loadingText}>Carregando pesquisa…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.centered}>
        <p style={styles.errorText}>{error}</p>
        <button style={styles.retryBtn} onClick={() => window.location.reload()}>
          Tentar novamente
        </button>
      </div>
    );
  }

  if (submitting) {
    return (
      <div style={styles.centered}>
        <div style={styles.spinner} />
        <p style={styles.loadingText}>Enviando votos…</p>
      </div>
    );
  }

  if (!currentItem) return null;

  const votadosSim  = Object.values(votos).filter(v => v.resposta === 'SIM').length;
  const votadosTotal = Object.values(votos).length;

  return (
    <div style={styles.screen}>

      {/* ── Top bar ── */}
      <div style={styles.topbar}>
        <div style={{ flex: 1 }}>
          <div style={styles.topbarTitle}>Pesquisa de Compra</div>
          <div style={styles.topbarSub}>{storeName}</div>
        </div>
        <div style={styles.topbarCounter}>
          <span style={styles.counterNum}>{currentIndex}</span>
          <span style={styles.counterTotal}>/{items.length}</span>
          <div style={styles.counterLabel}>votados</div>
        </div>
      </div>

      {/* ── Progress bar ── */}
      <div style={styles.progressBar}>
        <div style={{ ...styles.progressFill, width: `${progress}%` }} />
      </div>

      {/* ── Item card ── */}
      <div style={styles.itemCard}>
        <div style={styles.itemImg}>
          {currentItem.foto_url ? (
            <img
              src={currentItem.foto_url}
              alt={currentItem.referencia}
              style={styles.itemPhoto}
            />
          ) : (
            <div style={styles.itemPhotoPlaceholder}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ color: '#9ca3af' }}>
                <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
              </svg>
            </div>
          )}
          <div style={styles.itemBadge}>{currentItem.modelo}</div>
        </div>

        <div style={styles.itemInfo}>
          <div style={{ flex: 1 }}>
            <div style={styles.itemRef}>{currentItem.referencia}</div>
            <div style={styles.itemName}>{currentItem.tipo}</div>
            <div style={styles.itemColor}>
              {[currentItem.cor1, currentItem.cor2, currentItem.cor3]
                .filter(Boolean)
                .join(' / ')}
            </div>
          </div>
          <div style={styles.itemPrices}>
            <div style={styles.priceRow}>
              <span style={styles.priceLabel}>Custo</span>
              <span style={styles.priceCusto}>{formatCurrency(currentItem.custo)}</span>
            </div>
            <div style={styles.priceRow}>
              <span style={styles.priceLabel}>Venda</span>
              <span style={styles.priceVenda}>{formatCurrency(currentItem.preco_venda)}</span>
            </div>
            <div style={styles.priceRow}>
              <span style={styles.priceLabel}>Markup</span>
              <span style={styles.priceMarkup}>{currentItem.markup_aplicado?.toFixed(2)}x</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Info strip ── */}
      <div style={styles.infoStrip}>
        <span>Sub-pedido {subOrderNum}</span>
        {selectedGrade ? (
          <span style={{ color: '#2563eb', fontWeight: 500 }}>
            Grade {selectedGrade} · {totalPares(availableTemplates.find(t => t.letra === selectedGrade)?.tamanhos ?? {})} pares
          </span>
        ) : voteChoice === 'NAO' ? (
          <span style={{ color: '#dc2626', fontWeight: 500 }}>Não quer este item</span>
        ) : (
          <span style={{ color: '#9ca3af' }}>Selecione a grade</span>
        )}
      </div>

      {/* ── Grade list ── */}
      <div style={styles.sectionLabel}>Selecione a grade</div>

      <div style={styles.gradeList}>
        {availableTemplates.length === 0 && (
          <p style={{ fontSize: 13, color: '#9ca3af', padding: '8px 0' }}>
            Nenhum template disponível para este modelo.
          </p>
        )}

        {availableTemplates.map(tpl => {
          const isSelected = selectedGrade === tpl.letra;
          const pares = totalPares(tpl.tamanhos);
          const entries = Object.entries(tpl.tamanhos);

          return (
            <button
              key={tpl.letra}
              onClick={() => pickGrade(tpl.letra)}
              style={{
                ...styles.gradeRow,
                ...(isSelected ? styles.gradeRowSelected : {}),
              }}
            >
              {/* Badge */}
              <div style={{
                ...styles.gradeBadge,
                ...(isSelected ? styles.gradeBadgeSelected : {}),
              }}>
                G{tpl.letra}
              </div>

              {/* Sizes horizontal */}
              <div style={styles.sizesWrapper}>
                <div style={styles.sizesRow}>
                  {entries.map(([sz, qty]) => (
                    <div key={sz} style={styles.sizeCol}>
                      <span style={{
                        ...styles.sizeNum,
                        ...(isSelected ? styles.sizeNumSelected : {}),
                      }}>{sz}</span>
                      <span style={{
                        ...styles.sizeQty,
                        ...(isSelected ? styles.sizeQtySelected : {}),
                      }}>{qty}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Total */}
              <div style={styles.gradeTotal}>
                <div style={{
                  ...styles.totalNum,
                  ...(isSelected ? styles.totalNumSelected : {}),
                }}>{pares}</div>
                <div style={{
                  ...styles.totalLabel,
                  ...(isSelected ? styles.totalLabelSelected : {}),
                }}>pares</div>
              </div>

              {/* Check */}
              <div style={{
                ...styles.checkCircle,
                ...(isSelected ? styles.checkCircleSelected : {}),
              }}>
                {isSelected && (
                  <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                    <path d="M2 6l3 3 5-5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* ── Vote buttons ── */}
      <div style={styles.voteRow}>
        <button
          onClick={() => vote('NAO')}
          style={{
            ...styles.btnNao,
            ...(voteChoice === 'NAO' ? styles.btnNaoActive : {}),
          }}
        >
          ✕ Não quero
        </button>
        <button
          onClick={() => vote('SIM')}
          style={{
            ...styles.btnSim,
            ...(voteChoice === 'SIM' ? styles.btnSimActive : {}),
          }}
        >
          ✓ Quero
        </button>
      </div>

      {/* ── Confirm ── */}
      <div style={styles.confirmBar}>
        <button
          onClick={confirm}
          disabled={!canConfirm}
          style={{
            ...styles.btnConfirm,
            ...(canConfirm ? styles.btnConfirmReady : {}),
          }}
        >
          {currentIndex < items.length - 1
            ? 'Confirmar e próximo →'
            : 'Finalizar pesquisa ✓'}
        </button>
      </div>

    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  screen: {
    maxWidth: 420,
    margin: '0 auto',
    backgroundColor: '#f9fafb',
    minHeight: '100dvh',
    display: 'flex',
    flexDirection: 'column',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  },
  centered: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100dvh',
    gap: 12,
    fontFamily: 'system-ui, sans-serif',
  },
  spinner: {
    width: 32,
    height: 32,
    border: '3px solid #e5e7eb',
    borderTopColor: '#2563eb',
    borderRadius: '50%',
    animation: 'spin 0.7s linear infinite',
  },
  loadingText: { fontSize: 14, color: '#6b7280', margin: 0 },
  errorText:   { fontSize: 14, color: '#dc2626', margin: 0, textAlign: 'center', padding: '0 24px' },
  retryBtn: {
    marginTop: 8,
    padding: '10px 24px',
    borderRadius: 8,
    border: '1.5px solid #2563eb',
    background: 'transparent',
    color: '#2563eb',
    fontSize: 14,
    cursor: 'pointer',
  },

  /* Top bar */
  topbar: {
    backgroundColor: '#fff',
    borderBottom: '0.5px solid #e5e7eb',
    padding: '14px 16px 10px',
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    flexShrink: 0,
  },
  topbarTitle: { fontSize: 15, fontWeight: 500, color: '#111827' },
  topbarSub:   { fontSize: 12, color: '#9ca3af', marginTop: 1 },
  topbarCounter: { textAlign: 'right' as const },
  counterNum:  { fontSize: 18, fontWeight: 500, color: '#111827' },
  counterTotal:{ fontSize: 14, color: '#9ca3af' },
  counterLabel:{ fontSize: 11, color: '#9ca3af', marginTop: -2 },

  /* Progress */
  progressBar:  { height: 3, backgroundColor: '#e5e7eb', flexShrink: 0 },
  progressFill: { height: '100%', backgroundColor: '#2563eb', borderRadius: 2, transition: 'width .3s' },

  /* Item card */
  itemCard: {
    backgroundColor: '#fff',
    margin: '10px 10px 0',
    borderRadius: 12,
    border: '0.5px solid #e5e7eb',
    overflow: 'hidden',
    flexShrink: 0,
  },
  itemImg: {
    height: 130,
    backgroundColor: '#f3f4f6',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative' as const,
  },
  itemPhoto: { maxHeight: 110, maxWidth: '100%', objectFit: 'contain' as const },
  itemPhotoPlaceholder: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 100,
    height: 100,
    backgroundColor: '#fff',
    borderRadius: 10,
  },
  itemBadge: {
    position: 'absolute' as const,
    top: 8, left: 8,
    backgroundColor: '#eff6ff',
    color: '#1d4ed8',
    fontSize: 10,
    fontWeight: 500,
    padding: '2px 8px',
    borderRadius: 20,
  },
  itemInfo: {
    padding: '10px 12px',
    display: 'flex',
    gap: 12,
    alignItems: 'flex-start',
  },
  itemRef:  { fontSize: 11, color: '#9ca3af', marginBottom: 1 },
  itemName: { fontSize: 14, fontWeight: 500, color: '#111827', marginBottom: 1 },
  itemColor:{ fontSize: 11, color: '#6b7280' },
  itemPrices: { flexShrink: 0, display: 'flex', flexDirection: 'column' as const, gap: 2 },
  priceRow: { display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline' },
  priceLabel:  { fontSize: 11, color: '#9ca3af' },
  priceCusto:  { fontSize: 12, color: '#374151', fontWeight: 500 },
  priceVenda:  { fontSize: 13, color: '#059669', fontWeight: 500 },
  priceMarkup: { fontSize: 11, color: '#6b7280' },

  /* Info strip */
  infoStrip: {
    margin: '8px 10px 0',
    padding: '7px 12px',
    backgroundColor: '#fff',
    border: '0.5px solid #e5e7eb',
    borderRadius: 8,
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: 12,
    color: '#6b7280',
    flexShrink: 0,
  },

  /* Section label */
  sectionLabel: {
    padding: '10px 10px 5px',
    fontSize: 11,
    fontWeight: 500,
    color: '#9ca3af',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
    flexShrink: 0,
  },

  /* Grade rows */
  gradeList: {
    padding: '0 10px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 6,
    flexShrink: 0,
  },
  gradeRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    borderRadius: 10,
    border: '1.5px solid #e5e7eb',
    backgroundColor: '#fff',
    padding: '10px 12px',
    cursor: 'pointer',
    textAlign: 'left' as const,
    width: '100%',
    transition: 'border-color .15s',
  },
  gradeRowSelected: {
    borderColor: '#2563eb',
    backgroundColor: '#eff6ff',
  },
  gradeBadge: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 13,
    fontWeight: 500,
    color: '#374151',
    flexShrink: 0,
  },
  gradeBadgeSelected: {
    backgroundColor: '#2563eb',
    color: '#fff',
  },
  sizesWrapper: {
    flex: 1,
    overflowX: 'auto' as const,
  },
  sizesRow: {
    display: 'flex',
    gap: 8,
    alignItems: 'flex-start',
  },
  sizeCol: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    minWidth: 24,
  },
  sizeNum: {
    fontSize: 11,
    color: '#9ca3af',
    lineHeight: 1.2,
    marginBottom: 1,
  },
  sizeNumSelected: { color: '#1d4ed8', opacity: 0.7 },
  sizeQty: {
    fontSize: 13,
    fontWeight: 500,
    color: '#111827',
    lineHeight: 1.2,
  },
  sizeQtySelected: { color: '#1d4ed8' },
  gradeTotal: { flexShrink: 0, textAlign: 'right' as const },
  totalNum:   { fontSize: 15, fontWeight: 500, color: '#111827', lineHeight: 1 },
  totalNumSelected: { color: '#1d4ed8' },
  totalLabel: { fontSize: 10, color: '#9ca3af', marginTop: 1 },
  totalLabelSelected: { color: '#1d4ed8', opacity: 0.7 },
  checkCircle: {
    width: 20,
    height: 20,
    borderRadius: '50%',
    border: '1.5px solid #d1d5db',
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'background .15s, border-color .15s',
  },
  checkCircleSelected: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },

  /* Vote buttons */
  voteRow: {
    display: 'flex',
    gap: 8,
    padding: '10px 10px 0',
    flexShrink: 0,
  },
  btnNao: {
    flex: 1,
    padding: '11px',
    borderRadius: 10,
    border: '1.5px solid #fca5a5',
    backgroundColor: 'transparent',
    color: '#dc2626',
    fontSize: 14,
    fontWeight: 500,
    cursor: 'pointer',
  },
  btnNaoActive: { backgroundColor: '#fef2f2' },
  btnSim: {
    flex: 1,
    padding: '11px',
    borderRadius: 10,
    border: '1.5px solid #6ee7b7',
    backgroundColor: 'transparent',
    color: '#059669',
    fontSize: 14,
    fontWeight: 500,
    cursor: 'pointer',
  },
  btnSimActive: { backgroundColor: '#ecfdf5' },

  /* Confirm */
  confirmBar: { padding: '10px 10px 16px', flexShrink: 0 },
  btnConfirm: {
    width: '100%',
    padding: '13px',
    borderRadius: 10,
    border: 'none',
    backgroundColor: '#2563eb',
    color: '#fff',
    fontSize: 15,
    fontWeight: 500,
    cursor: 'pointer',
    opacity: 0.35,
    pointerEvents: 'none' as const,
    transition: 'opacity .2s',
  },
  btnConfirmReady: {
    opacity: 1,
    pointerEvents: 'all' as const,
  },
};