import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../services/supabaseClient';
import { User } from '../types';
import StepPedidos from './BuyOrderStepPedidos';
 
// ─── Tipos ────────────────────────────────────────────────────────────────────
 
interface Brand {
  id: string;
  marca: string;
  fornecedor: string;
  representante: string;
  telefone: string;
  email: string;
}
 
interface GradeItem {
  letter: string;
  cat: 'MASC' | 'FEM' | 'INF' | 'ACESS';
  qtds: Record<string, number>;
}
 
interface ItemComGrades {
  itemIdx: number;
  grades: GradeItem[];
}

interface OrderItem {
  ref: string;
  tipo: string;
  cor1: string;
  cor2: string;
  cor3: string;
  modelo: string;
  custo: number;
  preco_venda: number;
}

interface SubOrder {
  num: number;
  pedido_numero: string;
  itensComGrades: ItemComGrades[];
  lojas: number[];
  lojaMode: 'sub' | 'all' | null;
}
 
interface Cabecalho {
  role: 'comprador' | 'gerente';
  brand_id: string | null;
  marca: string;
  fornecedor: string;
  representante: string;
  telefone: string;
  email: string;
  fat_inicio: string;
  fat_fim: string;
  prazos: number[];
  markup: number;
  desconto: number;
}
 
// ─── Constantes ───────────────────────────────────────────────────────────────
 
const SUBGRUPO = [5,8,9,26,31,34,40,43,44,45,50,56,72,88,96,100,102,109];
const ALL_LOJAS = Array.from({ length: 120 }, (_, i) => i + 1);
const GRADE_LETTERS = 'ABCDEFG';
 
const CATS: Record<string, { label: string; sizes: string[] }> = {
  MASC:  { label: 'Masc',  sizes: [37,38,39,40,41,42,43,44,45,46,47,48].map(String) },
  FEM:   { label: 'Fem',   sizes: [33,34,35,36,37,38,39,40,41,42].map(String) },
  INF:   { label: 'Inf',   sizes: [16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32].map(String) },
  ACESS: { label: 'Acess', sizes: ['UN', 'P', 'M', 'G', 'GG'] },
};
 
// ─── Helpers ──────────────────────────────────────────────────────────────────
 
function parsePrazos(raw: string): number[] {
  return raw.split('/').map(s => parseInt(s.trim())).filter(n => !isNaN(n) && n > 0).slice(0, 7);
}
 
function addDays(dateStr: string, days: number): string {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return d.toLocaleDateString('pt-BR');
}
 
function calcPrecoVenda(custo: number, desconto: number, markup: number): number {
  const liq = custo * (1 - desconto / 100);
  if (liq <= 0 || markup <= 0) return 0;
  
  const bruto = liq * markup;
  const brutoMais10 = bruto + 10;
  const dezena = Math.ceil(brutoMais10 / 10);
  const precoFinal = (dezena * 10) - 0.01;
  
  return Math.round(precoFinal * 100) / 100;
}
 
function fmtBRL(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
 
function totPares(qtds: Record<string, number>): number {
  return Object.values(qtds).reduce((s, v) => s + (v || 0), 0);
}
 
// ─── Componente principal ─────────────────────────────────────────────────────
 
export default function BuyOrderModule({ user }: { user?: User }) {
  const [step, setStep] = useState(0);
  const [cab, setCab] = useState<Cabecalho>({
    role: 'comprador', brand_id: null, marca: '', fornecedor: '',
    representante: '', telefone: '', email: '',
    fat_inicio: '', fat_fim: '', prazos: [], markup: 2.60, desconto: 0,
  });

  useEffect(() => {
    if (user) {
      setCab(prev => ({
        ...prev,
        role: user.role === 'ADMIN' ? 'comprador' : 'gerente'
      }));
    }
  }, [user]);

  useEffect(() => {
    async function setupSession() {
      if (user?.id) {
        await supabase.rpc('set_user_session', { user_id: user.id });
      }
    }
    setupSession();
  }, [user]);
  const [prazosRaw, setPrazosRaw] = useState('');
  const [items, setItems] = useState<OrderItem[]>([]);
  const [pedidos, setPedidos] = useState<SubOrder[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [numeroPedidoSalvo, setNumeroPedidoSalvo] = useState<number | null>(null);
 
  const [recentOrders, setRecentOrders] = useState<any[]>([]);
 
  const fetchRecentOrders = useCallback(async () => {
    const { data } = await supabase
      .from('buy_orders')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);
    setRecentOrders(data || []);
  }, []);
 
  useEffect(() => {
    fetchRecentOrders();
  }, [fetchRecentOrders]);
 
  const STEPS = ['Cabeçalho', 'Itens', 'Pedidos'];
 
  // ─── Navegação ──────────────────────────────────────────────────────────────
 
  function navNext() {
    if (step === 0) {
      if (!cab.marca || !cab.fornecedor || !cab.representante || !cab.fat_fim || !cab.markup) {
        setError('Preencha os campos obrigatórios: Marca, Fornecedor, Representante, Fat. Fim e Markup.');
        return;
      }
    }
    if (step === 1 && items.length === 0) {
      setError('Adicione ao menos um item antes de continuar.');
      return;
    }
    if (step === STEPS.length - 1) {
      handleSave();
      return;
    }
    setError('');
    setStep(s => s + 1);
  }
 
  // ─── Salvar no Supabase ──────────────────────────────────────────────────────
 
  async function handleSave() {
    setSaving(true);
    setError('');
    try {
      // ✅ GARANTIR SESSÃO NO POSTGRES PARA RLS
      const userId = user?.id || (await getCurrentAppUserId());
      if (userId && userId !== '00000000-0000-0000-0000-000000000000') {
        await supabase.rpc('set_user_session', { user_id: userId });
      }
 
      // 1. Upsert brand em buy_brands (Preferencialmente via RPC para evitar problemas de RLS)
      let brandId = cab.brand_id;
      if (!brandId) {
        const { data: bId, error: bErr } = await supabase.rpc('upsert_buy_brand', {
          p_marca: cab.marca,
          p_fornecedor: cab.fornecedor,
          p_representante: cab.representante,
          p_telefone: cab.telefone || null,
          p_email: cab.email || null,
        });

        if (bErr) {
          console.warn('RPC upsert_buy_brand falhou, tentando upsert direto (requer RLS configurado):', bErr);
          const { data: bData, error: bErr2 } = await supabase
            .from('buy_brands')
            .upsert({
              marca: cab.marca,
              fornecedor: cab.fornecedor,
              representante: cab.representante,
              telefone: cab.telefone || null,
              email: cab.email || null,
            }, { onConflict: 'marca' })
            .select('id')
            .single();
          if (bErr2) throw bErr2;
          brandId = bData.id;
        } else {
          brandId = bId;
        }
      }
 
      // 2. Calcular vencimentos
      const vencimentos = cab.prazos.map(p => {
        const d = new Date(cab.fat_fim + 'T00:00:00');
        d.setDate(d.getDate() + p);
        return d.toISOString().split('T')[0];
      });
 
      // 3. Insert buy_orders
      const { data: order, error: oErr } = await supabase
        .from('buy_orders')
        .insert({
          user_id: userId,
          user_name: user?.email || 'sistema',
          user_role: cab.role,
          brand_id: brandId,
          marca: cab.marca,
          fornecedor: cab.fornecedor,
          representante: cab.representante,
          telefone: cab.telefone || null,
          email: cab.email || null,
          fat_inicio: cab.fat_inicio || null,
          fat_fim: cab.fat_fim,
          prazos: cab.prazos,
          vencimentos,
          desconto: cab.desconto,
          markup: cab.markup,
          status: 'rascunho',
        })
        .select('id, numero_pedido')
        .single();
      if (oErr) throw oErr;
      const orderId = order.id;
      setNumeroPedidoSalvo(order.numero_pedido);
 
      // 4. Insert buy_order_items
      if (items.length > 0) {
        const itemRows: any[] = items.map((it, idx) => ({
          order_id: orderId,
          item_order: idx + 1,
          referencia: it.ref,
          tipo: it.tipo || null,
          cor1: it.cor1,
          cor2: it.cor2 || null,
          cor3: it.cor3 || null,
          modelo: it.modelo,
          custo: it.custo,
          preco_venda: it.preco_venda,
          grades: {}, // será preenchido abaixo
          total_pares: 0,
          markup_aplicado: cab.markup,
        }));

        // Preencher grades por pedido (agregando todas as grades de todos os pedidos para o item)
        pedidos.forEach(ped => {
          ped.itensComGrades.forEach(icg => {
            const itemRow = itemRows[icg.itemIdx];
            if (!itemRow) return;

            // Converter grades para formato JSONB
            icg.grades.forEach(g => {
              itemRow.grades[g.letter] = {
                cat: g.cat,
                qtds: g.qtds
              };
            });
          });
        });

        // Calcular total de pares após agregar todas as grades, CONSIDERANDO AS LOJAS
        itemRows.forEach((row, rowIdx) => {
          let totalParesItem = 0;
          pedidos.forEach(ped => {
            const icg = ped.itensComGrades.find(x => x.itemIdx === rowIdx);
            if (icg) {
              icg.grades.forEach(g => {
                totalParesItem += totPares(g.qtds) * ped.lojas.length;
              });
            }
          });
          row.total_pares = totalParesItem;
        });

        const { error: iErr } = await supabase.from('buy_order_items').insert(itemRows);
        if (iErr) throw iErr;
      }
 
      // 5. Insert buy_order_sub_orders (um por pedido)
      if (pedidos.length > 0) {
        const subRows = pedidos.map(ped => ({
          order_id: orderId,
          sub_order_num: ped.num,
          pedido_numero: ped.pedido_numero || null,
          lojas_numeros: ped.lojas,
        }));
        const { error: sErr } = await supabase.from('buy_order_sub_orders').insert(subRows);
        if (sErr) throw sErr;
      }

      // 6. Atualizar totais do pedido principal (buy_orders) e processar cotas
      let totalParesGeral = 0;
      let totalValorBrutoGeral = 0;
      
      const transactionsToInsert: any[] = [];
      const fatFimDate = cab.fat_fim ? new Date(cab.fat_fim + 'T00:00:00') : new Date();
      const quotaMonth = fatFimDate.getMonth() + 1;
      const quotaYear = fatFimDate.getFullYear();

      // Identificar tipo de comprador baseado no role
      const roleUpper = (user?.role || 'COMPRADOR').toUpperCase();
      const tipoComprador: 'GERENTE' | 'COMPRADOR' = (roleUpper === 'GERENTE' || roleUpper === 'MANAGER') ? 'GERENTE' : 'COMPRADOR';

      // 6.1 Buscar IDs de controle de cota para as lojas envolvidas
      const allStoreNums = Array.from(new Set(pedidos.flatMap(p => p.lojas)));
      const { data: qcData } = await supabase
        .from('buyorder_quota_control')
        .select('id, store_number')
        .eq('year', quotaYear)
        .eq('month', quotaMonth)
        .in('store_number', allStoreNums);

      pedidos.forEach(ped => {
        let valorBrutoPedido = 0;
        ped.itensComGrades.forEach(icg => {
          const item = items[icg.itemIdx];
          icg.grades.forEach(g => {
            const pairsForItems = totPares(g.qtds);
            const pairsTotal = pairsForItems * ped.lojas.length;
            totalParesGeral += pairsTotal;
            totalValorBrutoGeral += pairsTotal * item.custo;
            valorBrutoPedido += pairsForItems * item.custo;
          });
        });

        const valorLiquidoSub = valorBrutoPedido * (1 - (cab.desconto || 0) / 100);
        
        // Calcular valor abatido por parcela
        const parcelasCount = vencimentos.length > 0 ? vencimentos.length : 1;
        const valorPorParcela = valorLiquidoSub / parcelasCount;

        // Registrar transação de cota para cada loja deste sub-pedido (dividido pelos vencimentos)
        ped.lojas.forEach(storeNum => {
          const qc = qcData?.find(q => q.store_number === storeNum);
          if (qc) {
            if (vencimentos.length > 0) {
              vencimentos.forEach((vencData, idx) => {
                transactionsToInsert.push({
                  quota_control_id: qc.id,
                  order_id: orderId,
                  valor_abatido: valorPorParcela,
                  tipo_comprador: tipoComprador,
                  vencimento_data: vencData,
                  aplicado: false, // O abate ocorre apenas no vencimento
                  descricao: `Pedido ${cab.marca} - Sub ${ped.num} (Parc. ${idx + 1}/${parcelasCount})`
                });
              });
            } else {
              transactionsToInsert.push({
                quota_control_id: qc.id,
                order_id: orderId,
                valor_abatido: valorPorParcela,
                tipo_comprador: tipoComprador,
                vencimento_data: new Date().toISOString().split('T')[0],
                aplicado: false,
                descricao: `Pedido ${cab.marca} - Sub ${ped.num}`
              });
            }
          } else {
            console.warn(`Controle de cota não encontrado para loja ${storeNum} em ${quotaMonth}/${quotaYear}. Tente inicializar cotas.`);
          }
        });
      });

      const totalValorLiquidoGeral = totalValorBrutoGeral * (1 - (cab.desconto || 0) / 100);

      // Atualizar totais no pedido
      await supabase.from('buy_orders')
        .update({
          total_pares: totalParesGeral,
          total_valor_bruto: totalValorBrutoGeral,
          total_valor_liquido: totalValorLiquidoGeral
        })
        .eq('id', orderId);
      
      // 7. Inserir transações de cota
      if (transactionsToInsert.length > 0) {
        const { error: transErr } = await supabase.from('buyorder_quota_transactions').insert(transactionsToInsert);
        if (transErr) {
          console.error("Erro ao registrar transações de cota:", transErr);
        }
      }
 
      alert(`Pedido salvo com sucesso! Nº será gerado automaticamente.`);
      // Reset
      setStep(0);
      setCab({ role: 'comprador', brand_id: null, marca: '', fornecedor: '', representante: '', telefone: '', email: '', fat_inicio: '', fat_fim: '', prazos: [], markup: 2.60, desconto: 0 });
      setItems([]);
      setPedidos([]);
      setPrazosRaw('');
      fetchRecentOrders();
    } catch (e: any) {
      setError('Erro ao salvar: ' + (e?.message ?? JSON.stringify(e)));
    } finally {
      setSaving(false);
    }
  }
 
  async function getCurrentAppUserId(): Promise<string> {
    const { data } = await supabase.rpc('current_app_user_id');
    return data ?? '00000000-0000-0000-0000-000000000000';
  }
 
  // ─── Exportar para Excel ─────────────────────────────────────────────────────
 
  async function handleExportExcel(orderId: string) {
    try {
      // Buscar dados completos do pedido
      const { data: order } = await supabase
        .from('buy_orders')
        .select('*')
        .eq('id', orderId)
        .single();
 
      const { data: orderItems } = await supabase
        .from('buy_order_items')
        .select('*')
        .eq('order_id', orderId)
        .order('item_order');
 
      const { data: subOrders } = await supabase
        .from('buy_order_sub_orders')
        .select('*')
        .eq('order_id', orderId)
        .order('sub_order_num');
 
      if (!order) throw new Error('Pedido não encontrado');
 
      // Chamar API Python para gerar Excel
      const response = await fetch('/api/export-buy-order-excel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order, items: orderItems, subOrders }),
      });
 
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao gerar Excel');
      }
 
      const result = await response.json();
      if (!result.success || !result.downloadId) {
        throw new Error('Falha ao obter ID de download');
      }
 
      // Baixar o arquivo usando o downloadId para evitar problemas de iFrame
      window.location.href = `/api/download-file/${result.downloadId}`;
 
      // Marcar como exportado no Supabase
      await supabase
        .from('buy_orders')
        .update({ 
          exported_at: new Date().toISOString(), 
          exported_by: await getCurrentAppUserId() 
        })
        .eq('id', orderId);
 
    } catch (e: any) {
      alert('Erro ao exportar: ' + (e?.message ?? 'Erro desconhecido'));
    }
  }
 
  // ─── Render ──────────────────────────────────────────────────────────────────
 
  return (
    <div className="max-w-5xl mx-auto p-4 md:p-6">
      {/* Header */}
      <div style={{ background: '#fff', border: '0.5px solid #e5e7eb', borderRadius: 10, overflow: 'hidden' }}>
 
        {/* Título + role */}
        <div className="p-4 md:p-6 border-b flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {numeroPedidoSalvo ? (
              <span style={{ fontSize: 15, fontWeight: 600 }}>Pedido #{numeroPedidoSalvo}</span>
            ) : (
              <span style={{ fontSize: 15, fontWeight: 500 }}>Novo pedido de compra</span>
            )}
            <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: cab.role === 'comprador' ? '#E6F1FB' : '#EAF3DE', color: cab.role === 'comprador' ? '#0C447C' : '#27500A', border: `0.5px solid ${cab.role === 'comprador' ? '#B5D4F4' : '#C0DD97'}` }}>
              {cab.role === 'comprador' ? 'Modo Comprador' : 'Modo Gerente'}
            </span>
          </div>
          {user?.role === 'ADMIN' && (
            <div style={{ display: 'flex', gap: 5 }}>
              {(['comprador', 'gerente'] as const).map(r => (
                <button key={r} onClick={() => setCab(c => ({ ...c, role: r }))}
                  style={{ height: 28, minWidth: 90, padding: '0 12px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: `0.5px solid ${cab.role === r ? '#185FA5' : '#d1d5db'}`, background: cab.role === r ? '#185FA5' : '#fff', color: cab.role === r ? '#fff' : '#64748b', transition: 'all 0.2s', boxShadow: cab.role === r ? '0 2px 4px rgba(24, 95, 165, 0.2)' : 'none' }}>
                  {r.charAt(0).toUpperCase() + r.slice(1)}
                </button>
              ))}
            </div>
          )}
        </div>
 
        {/* Stepper */}
        <div className="flex px-4 md:px-6 border-b">
          {STEPS.map((s, i) => (
            <div key={s} style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6, padding: '9px 0', fontSize: 11, color: i === step ? '#111' : '#9ca3af' }}>
              <div style={{ width: 20, height: 20, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 500, background: i < step ? '#EAF3DE' : i === step ? '#185FA5' : 'transparent', border: `0.5px solid ${i < step ? '#97C459' : i === step ? '#185FA5' : '#d1d5db'}`, color: i < step ? '#27500A' : i === step ? '#fff' : '#9ca3af' }}>
                {i < step ? '✓' : i + 1}
              </div>
              <span>{s}</span>
              {i < STEPS.length - 1 && <div style={{ flex: 1, height: 0.5, background: '#e5e7eb', margin: '0 6px' }} />}
            </div>
          ))}
        </div>
 
        {/* Corpo da etapa */}
        {step === 0 && <StepCabecalho cab={cab} setCab={setCab} prazosRaw={prazosRaw} setPrazosRaw={setPrazosRaw} numeroPedidoSalvo={numeroPedidoSalvo} setNumeroPedidoSalvo={setNumeroPedidoSalvo} />}
        {step === 1 && <StepItens items={items} setItems={setItems} cab={cab} />}
        {step === 2 && <StepPedidos items={items} pedidos={pedidos} setPedidos={setPedidos} user={user} cab={cab} />}
 
        {/* Footer navegação */}
        {error && (
          <div style={{ padding: '8px 18px', background: '#FCEBEB', borderTop: '0.5px solid #F09595', fontSize: 12, color: '#A32D2D' }}>{error}</div>
        )}
        <div className="p-4 md:p-6 border-t flex justify-between items-center">
          <button onClick={() => { setError(''); setStep(s => Math.max(0, s - 1)); }}
            style={{ visibility: step === 0 ? 'hidden' : 'visible', height: 30, padding: '0 14px', borderRadius: 5, fontSize: 12, cursor: 'pointer', border: '0.5px solid #d1d5db', background: 'transparent' }}>
            ← Voltar
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 11, color: '#6b7280' }}>
              {cab.marca && `${cab.marca} · `}{items.length > 0 && `${items.length} itens`}
            </span>
            <button onClick={navNext} disabled={saving}
              style={{ height: 30, padding: '0 18px', borderRadius: 5, fontSize: 12, fontWeight: 500, cursor: 'pointer', border: 'none', background: step === STEPS.length - 1 ? '#27500A' : '#185FA5', color: '#fff', opacity: saving ? 0.7 : 1 }}>
              {saving ? 'Salvando...' : step === STEPS.length - 1 ? 'Salvar pedido' : 'Próximo →'}
            </button>
          </div>
        </div>
      </div>
 
      {/* Lista de Pedidos Recentes */}
      <div style={{ marginTop: 24, background: '#fff', border: '0.5px solid #e5e7eb', borderRadius: 10, overflow: 'hidden' }}>
        <div style={{ padding: '11px 18px', borderBottom: '0.5px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Pedidos Recentes</span>
          <button onClick={fetchRecentOrders} style={{ background: 'none', border: 'none', color: '#185FA5', fontSize: 11, cursor: 'pointer', fontWeight: 500 }}>Atualizar</button>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
            <thead>
              <tr style={{ background: '#f9fafb' }}>
                <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: '#6b7280', borderBottom: '0.5px solid #e5e7eb' }}>Data/Marca</th>
                <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: '#6b7280', borderBottom: '0.5px solid #e5e7eb' }}>Número</th>
                <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: '#6b7280', borderBottom: '0.5px solid #e5e7eb' }}>Status</th>
                <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600, color: '#6b7280', borderBottom: '0.5px solid #e5e7eb' }}>Ação</th>
              </tr>
            </thead>
            <tbody>
              {recentOrders.length === 0 && (
                <tr><td colSpan={4} style={{ padding: '20px', textAlign: 'center', color: '#9ca3af' }}>Nenhum pedido encontrado.</td></tr>
              )}
              {recentOrders.map((o) => (
                <tr key={o.id} style={{ borderBottom: '0.5px solid #f3f4f6' }}>
                  <td style={{ padding: '10px 12px' }}>
                    <div style={{ fontWeight: 600, color: '#111' }}>{o.marca}</div>
                    <div style={{ fontSize: 10, color: '#9ca3af' }}>{new Date(o.created_at).toLocaleDateString('pt-BR')}</div>
                  </td>
                  <td style={{ padding: '10px 12px', color: '#6b7280' }}>
                    {o.numero_pedido || '—'}
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    {o.exported_at ? (
                      <span style={{ fontSize: 9, color: '#27500A', background: '#EAF3DE', padding: '2px 6px', borderRadius: 10, border: '0.5px solid #C0DD97' }}>Exportado</span>
                    ) : (
                      <span style={{ fontSize: 9, color: '#b45309', background: '#fffbeb', padding: '2px 6px', borderRadius: 10, border: '0.5px solid #fde68a' }}>Pendente</span>
                    )}
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                    <button 
                      onClick={() => handleExportExcel(o.id)}
                      style={{ height: 24, padding: '0 10px', background: '#185FA5', color: '#fff', border: 'none', borderRadius: 4, fontSize: 10, fontWeight: 600, cursor: 'pointer' }}
                    >
                      Exportar XLSX
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Step 0: Cabeçalho ────────────────────────────────────────────────────────

function StepCabecalho({ cab, setCab, prazosRaw, setPrazosRaw, numeroPedidoSalvo, setNumeroPedidoSalvo }: {
  cab: Cabecalho; setCab: React.Dispatch<React.SetStateAction<Cabecalho>>;
  prazosRaw: string; setPrazosRaw: (s: string) => void;
  numeroPedidoSalvo: number | null;
  setNumeroPedidoSalvo: (n: number | null) => void;
}) {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [showDrop, setShowDrop] = useState(false);
  const [searching, setSearching] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function onMarcaInput(val: string) {
    const uppercaseVal = val.toUpperCase();
    setCab(c => ({ ...c, marca: uppercaseVal, brand_id: null }));
    if (numeroPedidoSalvo) setNumeroPedidoSalvo(null);
    if (uppercaseVal.length < 4) { setBrands([]); setShowDrop(false); return; }
    clearTimeout(searchTimer.current!);
    setSearching(true);
    setShowDrop(true);
    searchTimer.current = setTimeout(async () => {
      const { data } = await supabase
        .from('buy_brands')
        .select('id,marca,fornecedor,representante,telefone,email')
        .ilike('marca', `%${uppercaseVal}%`)
        .eq('is_active', true)
        .order('marca', { ascending: true })
        .limit(8);
      setBrands(data ?? []);
      setSearching(false);
    }, 300);
  }

  function selectBrand(b: Brand) {
    setCab(c => ({ ...c, brand_id: b.id, marca: b.marca, fornecedor: b.fornecedor, representante: b.representante, telefone: b.telefone ?? '', email: b.email ?? '' }));
    setShowDrop(false);
  }

  const liq = 100 * (1 - (cab.desconto || 0) / 100);
  const exVenda = calcPrecoVenda(100, cab.desconto, cab.markup);

  const inputStyle: React.CSSProperties = { height: 30, padding: '0 8px', border: '0.5px solid #d1d5db', borderRadius: 5, fontSize: 12, outline: 'none', width: '100%', background: 'var(--color-background-primary)', color: 'var(--color-text-primary)' };
  const labelStyle: React.CSSProperties = { fontSize: 10, fontWeight: 500, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 3, display: 'block' };

  return (
    <div>
      {/* Fornecedor */}
      <div style={{ padding: '6px 18px', background: '#f9fafb', borderBottom: '0.5px solid #e5e7eb', fontSize: 10, fontWeight: 500, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Fornecedor</div>
      <div className="p-4 md:p-6 border-b border-slate-200 space-y-4">
        {/* Linha 1: Marca */}
        <div className="grid grid-cols-1 gap-4">
          <div className="relative">
            <label className="block text-xs font-medium text-slate-600 uppercase mb-1">Marca *</label>
            <input 
              value={cab.marca} 
              onChange={e => onMarcaInput(e.target.value)} 
              onBlur={() => setTimeout(() => setShowDrop(false), 200)}
              placeholder="Digite 4+ letras..." 
              autoComplete="off" 
              className="w-full h-9 px-3 border border-slate-300 rounded-lg text-sm uppercase" 
            />
            {showDrop && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-300 rounded-lg shadow-lg z-50">
                {searching && <div className="p-3 text-xs text-slate-500">Buscando...</div>}
                {!searching && brands.length === 0 && <div className="p-3 text-xs text-slate-500">Nenhum resultado</div>}
                {!searching && brands.map(b => (
                  <div key={b.id} onMouseDown={() => selectBrand(b)} className="p-3 text-sm cursor-pointer hover:bg-slate-50 border-b last:border-0">
                    <div className="font-medium">{b.marca}</div>
                    <div className="text-xs text-slate-500 mt-0.5">{b.fornecedor} · {b.representante}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Linha 2: Fornecedor e Representante */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 uppercase mb-1">Fornecedor *</label>
            <input 
              value={cab.fornecedor} 
              onChange={e => setCab(c => ({ ...c, fornecedor: e.target.value.toUpperCase() }))}
              placeholder="Razão social" 
              className="w-full h-9 px-3 border border-slate-300 rounded-lg text-sm uppercase" 
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 uppercase mb-1">Representante *</label>
            <input 
              value={cab.representante} 
              onChange={e => setCab(c => ({ ...c, representante: e.target.value.toUpperCase() }))}
              placeholder="Nome" 
              className="w-full h-9 px-3 border border-slate-300 rounded-lg text-sm uppercase" 
            />
          </div>
        </div>

        {/* Linha 3: Telefone e Email */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 uppercase mb-1">Telefone</label>
            <input 
              value={cab.telefone} 
              onChange={e => setCab(c => ({ ...c, telefone: e.target.value }))}
              placeholder="(00) 00000-0000" 
              className="w-full h-9 px-3 border border-slate-300 rounded-lg text-sm" 
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 uppercase mb-1">E-mail</label>
            <input 
              value={cab.email} 
              onChange={e => setCab(c => ({ ...c, email: e.target.value.toUpperCase() }))}
              placeholder="rep@marca.com" 
              className="w-full h-9 px-3 border border-slate-300 rounded-lg text-sm uppercase" 
            />
          </div>
        </div>
      </div>

      {/* Faturamento */}
      <div style={{ padding: '6px 18px', background: '#f9fafb', borderBottom: '0.5px solid #e5e7eb', fontSize: 10, fontWeight: 500, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Faturamento e condições</div>
      <div className="p-4 border-b">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 uppercase mb-1">Fat. início</label>
            <input type="date" value={cab.fat_inicio} onChange={e => setCab(c => ({ ...c, fat_inicio: e.target.value }))} className="w-full h-9 px-3 border border-slate-300 rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 uppercase mb-1">Fat. fim *</label>
            <input type="date" value={cab.fat_fim} onChange={e => setCab(c => ({ ...c, fat_fim: e.target.value }))} className="w-full h-9 px-3 border border-slate-300 rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 uppercase mb-1">Prazos (separar por /)</label>
            <input value={prazosRaw} onChange={e => { setPrazosRaw(e.target.value); setCab(c => ({ ...c, prazos: parsePrazos(e.target.value) })); }}
              placeholder="Ex: 90/120/150" className="w-full h-9 px-3 border border-slate-300 rounded-lg text-sm" />
            <div className="text-xs text-slate-500 mt-1">máx 7 parcelas</div>
          </div>
          
          {/* VENCIMENTOS - CORRIGIDO */}
          <div>
            <label className="block text-xs font-medium text-slate-600 uppercase mb-1">Vencimentos</label>
            <div className="grid grid-cols-3 gap-1 pt-1">
              {cab.prazos.slice(0, 7).map((p, i) => {
                if (!cab.fat_fim) return null;
                const dataVenc = new Date(cab.fat_fim + 'T00:00:00');
                dataVenc.setDate(dataVenc.getDate() + p);
                const mes = dataVenc.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
                const ano = dataVenc.getFullYear().toString().slice(-2);
                return (
                  <div key={i} className="text-xs px-2 py-1 rounded bg-slate-100 border border-slate-200 text-center whitespace-nowrap">
                    {mes}/{ano}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label style={labelStyle}>Markup (fator) *</label>
            <input type="number" min={1} max={10} step={0.01} value={cab.markup}
              onChange={e => setCab(c => ({ ...c, markup: parseFloat(e.target.value) || 0 }))} style={inputStyle} />
            <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 2 }}>custo líquido × markup = preço venda</div>
          </div>
          <div>
            <label style={labelStyle}>Desconto fornecedor (%)</label>
            <input type="number" min={0} max={100} step={0.1} value={cab.desconto}
              onChange={e => setCab(c => ({ ...c, desconto: parseFloat(e.target.value) || 0 }))} style={inputStyle} />
            <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 2 }}>aplicado sobre custo antes do markup</div>
          </div>
          <div>
            <label style={{ ...labelStyle, visibility: 'hidden' }}>x</label>
            <div style={{ background: '#f9fafb', border: '0.5px solid #e5e7eb', borderRadius: 6, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <div><div style={{ fontSize: 10, color: '#6b7280' }}>Custo bruto</div><div style={{ fontSize: 12, fontWeight: 500 }}>R$ 100,00</div></div>
              <span style={{ fontSize: 12, color: '#9ca3af' }}>− {cab.desconto}%</span>
              <div><div style={{ fontSize: 10, color: '#6b7280' }}>Líquido</div><div style={{ fontSize: 12, fontWeight: 500 }}>R$ {liq.toFixed(2).replace('.', ',')}</div></div>
              <span style={{ fontSize: 12, color: '#9ca3af' }}>× {cab.markup.toFixed(2)}</span>
              <div><div style={{ fontSize: 10, color: '#6b7280' }}>Venda</div><div style={{ fontSize: 14, fontWeight: 500, color: '#185FA5' }}>{fmtBRL(exVenda)}</div></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
 
// ─── Step 1: Itens ────────────────────────────────────────────────────────────
 
function StepItens({ items, setItems, cab }: { items: OrderItem[]; setItems: React.Dispatch<React.SetStateAction<OrderItem[]>>; cab: Cabecalho }) {
  const [showPopup, setShowPopup] = useState(false);
  const [editIdx, setEditIdx] = useState(-1);
  const [form, setForm] = useState({ ref: '', tipo: '', cor1: '', cor2: '', cor3: '', modelo: 'FEM', custo: '' });
  const [cor2Manual, setCor2Manual] = useState(false);
  const [cor3Manual, setCor3Manual] = useState(false);
 
  const [tipoSuggestions, setTipoSuggestions] = useState<string[]>([]);
  const [showTipoDropdown, setShowTipoDropdown] = useState(false);
  const [corSuggestions, setCorSuggestions] = useState<string[]>([]);
  const [showCorDropdown, setShowCorDropdown] = useState<{ field: 'cor1' | 'cor2' | 'cor3' | null }>({ field: null });
  
  const [isMobile, setIsMobile] = useState(false);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);

  useEffect(() => {
    const checkDevice = () => {
      setIsMobile(window.innerWidth < 768 || 'ontouchstart' in window);
    };
    checkDevice();
    window.addEventListener('resize', checkDevice);
    return () => window.removeEventListener('resize', checkDevice);
  }, []);

  async function searchTipos(query: string) {
    if (query.length < 3) { 
      setTipoSuggestions([]); 
      setShowTipoDropdown(false); 
      return; 
    }
    const { data } = await supabase
      .from('buy_item_types')
      .select('tipo')
      .ilike('tipo', `%${query}%`)
      .order('uso_count', { ascending: false })
      .order('tipo', { ascending: true })
      .limit(10);
    setTipoSuggestions(data?.map(t => t.tipo) || []);
    setShowTipoDropdown(true);
  }

  async function searchCores(query: string, field: 'cor1' | 'cor2' | 'cor3') {
    if (query.length < 2) {
      setCorSuggestions([]);
      setShowCorDropdown({ field: null });
      return;
    }
    const { data } = await supabase
      .from('buy_item_colors')
      .select('cor')
      .ilike('cor', `%${query}%`)
      .order('uso_count', { ascending: false })
      .order('cor', { ascending: true })
      .limit(10);
    setCorSuggestions(data?.map(c => c.cor) || []);
    setShowCorDropdown({ field });
  }

  function selectTipo(tipo: string) {
    setForm(f => ({ ...f, tipo }));
    setShowTipoDropdown(false);
    supabase.rpc('increment_tipo_usage', { tipo_name: tipo });
  }

  function selectCor(cor: string, field: 'cor1' | 'cor2' | 'cor3') {
    if (field === 'cor1') {
      setForm(f => ({ ...f, cor1: cor, cor2: cor2Manual ? f.cor2 : cor, cor3: cor3Manual ? f.cor3 : cor }));
    } else if (field === 'cor2') {
      setCor2Manual(true);
      setForm(f => ({ ...f, cor2: cor }));
    } else {
      setCor3Manual(true);
      setForm(f => ({ ...f, cor3: cor }));
    }
    setShowCorDropdown({ field: null });
    supabase.rpc('increment_color_usage', { color_name: cor });
  }

  function openNew() { setForm({ ref: '', tipo: '', cor1: '', cor2: '', cor3: '', modelo: 'FEM', custo: '' }); setEditIdx(-1); setCor2Manual(false); setCor3Manual(false); setCorSuggestions([]); setTipoSuggestions([]); setShowPopup(true); }
  function openEdit(i: number) { const it = items[i]; setForm({ ref: it.ref, tipo: it.tipo, cor1: it.cor1, cor2: it.cor2, cor3: it.cor3, modelo: it.modelo || 'FEM', custo: String(it.custo) }); setEditIdx(i); setCor2Manual(!!it.cor2); setCor3Manual(!!it.cor3); setCorSuggestions([]); setTipoSuggestions([]); setShowPopup(true); }
 
  function onCor1(v: string) {
    const vu = v.toUpperCase();
    setForm(f => ({ ...f, cor1: vu, cor2: cor2Manual ? f.cor2 : vu, cor3: cor3Manual ? f.cor3 : vu }));
  }
 
  function saveItem() {
    const custo = parseFloat(form.custo) || 0;
    const preco_venda = calcPrecoVenda(custo, cab.desconto, cab.markup);
    const item: OrderItem = { 
      ref: form.ref, 
      tipo: form.tipo, 
      cor1: form.cor1, 
      cor2: form.cor2, 
      cor3: form.cor3, 
      modelo: form.modelo,
      custo, 
      preco_venda 
    };
    if (editIdx >= 0) setItems(its => its.map((it, i) => i === editIdx ? item : it));
    else setItems(its => [...its, item]);
    setShowPopup(false);
  }
 
  function delItem(i: number) { setItems(its => its.filter((_, idx) => idx !== i)); }
 
  const estVenda = calcPrecoVenda(parseFloat(form.custo) || 0, cab.desconto, cab.markup);
 
  return (
    <div>
      <div style={{ padding: '6px 18px', background: '#f9fafb', borderBottom: '0.5px solid #e5e7eb', fontSize: 10, fontWeight: 500, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>Itens do pedido</span>
        <button onClick={openNew} style={{ height: 22, padding: '0 10px', borderRadius: 4, fontSize: 11, fontWeight: 500, cursor: 'pointer', border: 'none', background: '#185FA5', color: '#fff' }}>+ Item</button>
      </div>
 
      <div className="overflow-x-auto">
        <table className="w-full border-collapse table-fixed">
          <thead>
            <tr style={{ background: '#f9fafb' }}>
              <th className="w-12" style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 500, color: '#6b7280', borderBottom: '0.5px solid #e5e7eb', whiteSpace: 'nowrap' }}>#</th>
              <th className="w-32" style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 500, color: '#6b7280', borderBottom: '0.5px solid #e5e7eb', whiteSpace: 'nowrap' }}>Referência</th>
              <th className="w-40 text-xs" style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 500, color: '#6b7280', borderBottom: '0.5px solid #e5e7eb', whiteSpace: 'nowrap' }}>Tipo</th>
              <th className="w-24 text-xs" style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 500, color: '#6b7280', borderBottom: '0.5px solid #e5e7eb', whiteSpace: 'nowrap' }}>Cor 1</th>
              <th className="w-24 text-xs" style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 500, color: '#6b7280', borderBottom: '0.5px solid #e5e7eb', whiteSpace: 'nowrap' }}>Cor 2</th>
              <th className="w-24 text-xs" style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 500, color: '#6b7280', borderBottom: '0.5px solid #e5e7eb', whiteSpace: 'nowrap' }}>Cor 3</th>
              <th className="w-24" style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 500, color: '#6b7280', borderBottom: '0.5px solid #e5e7eb', whiteSpace: 'nowrap' }}>Custo</th>
              <th className="w-24" style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 500, color: '#6b7280', borderBottom: '0.5px solid #e5e7eb', whiteSpace: 'nowrap' }}>Venda</th>
              <th className="w-20" style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 500, color: '#6b7280', borderBottom: '0.5px solid #e5e7eb', whiteSpace: 'nowrap' }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr><td colSpan={9} style={{ textAlign: 'center', padding: '20px 0', color: '#9ca3af', fontSize: 12 }}>Nenhum item. Clique em "+ Item" para adicionar.</td></tr>
            )}
            {items.map((it, i) => (
              <tr key={i} style={{ borderBottom: '0.5px solid #f3f4f6' }}>
                <td className="text-xs" style={{ padding: '5px 8px', color: '#9ca3af' }}>{i + 1}</td>
                <td className="text-sm" style={{ padding: '5px 8px', fontWeight: 500 }}>{it.ref || '—'}</td>
                <td className="text-xs" style={{ padding: '5px 8px' }}>{it.tipo || '—'}</td>
                <td className="text-xs" style={{ padding: '5px 8px' }}>{it.cor1 || '—'}</td>
                <td className="text-xs" style={{ padding: '5px 8px', color: '#9ca3af' }}>{it.cor2 || '—'}</td>
                <td className="text-xs" style={{ padding: '5px 8px', color: '#9ca3af' }}>{it.cor3 || '—'}</td>
                <td className="text-sm" style={{ padding: '5px 8px' }}>{fmtBRL(it.custo)}</td>
                <td className="text-sm" style={{ padding: '5px 8px', color: '#185FA5', fontWeight: 500 }}>{fmtBRL(it.preco_venda)}</td>
                <td style={{ padding: '5px 8px' }}>
                  <button onClick={() => openEdit(i)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 11, color: '#185FA5', marginRight: 4 }}>editar</button>
                  <button onClick={() => delItem(i)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 11, color: '#A32D2D' }}>✕</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
 
      {/* Popup item */}
      {showPopup && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: '#fff', borderRadius: 10, border: '0.5px solid #e5e7eb', width: 400, overflow: 'hidden' }}>
            <div style={{ padding: '10px 16px', borderBottom: '0.5px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13, fontWeight: 500 }}>{editIdx >= 0 ? `Editar item ${editIdx + 1}` : 'Novo item'}</span>
              <button onClick={() => setShowPopup(false)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 16, color: '#6b7280' }}>✕</button>
            </div>
            <div style={{ padding: 16 }}>
              {/* LINHA 1: Referência ocupa linha inteira */}
              <div style={{ marginBottom: 10 }}>
                <label style={{ fontSize: 10, fontWeight: 500, color: '#6b7280', textTransform: 'uppercase', display: 'block', marginBottom: 3 }}>Referência *</label>
                <input value={form.ref} onChange={e => setForm(f => ({ ...f, ref: e.target.value.toUpperCase() }))} placeholder="REF-001" style={{ height: 30, width: '100%', padding: '0 8px', border: '0.5px solid #d1d5db', borderRadius: 5, fontSize: 12, outline: 'none', textTransform: 'uppercase' }} autoFocus />
              </div>
 
              {/* LINHA 2: Tipo com AUTOCOMPLETE */}
              <div style={{ marginBottom: 10, position: 'relative' }}>
                <label style={{ fontSize: 10, fontWeight: 500, color: '#6b7280', textTransform: 'uppercase', display: 'block', marginBottom: 3 }}>Tipo</label>
                <input 
                  value={form.tipo}
                  onChange={e => { 
                    const v = e.target.value.toUpperCase();
                    setForm(f => ({ ...f, tipo: v })); 
                    searchTipos(v); 
                    setSelectedSuggestionIndex(-1);
                  }}
                  onKeyDown={!isMobile ? (e) => {
                    if (!showTipoDropdown || tipoSuggestions.length === 0) return;
                    if (e.key === 'ArrowDown') {
                      e.preventDefault();
                      setSelectedSuggestionIndex(prev => prev < tipoSuggestions.length - 1 ? prev + 1 : prev);
                    } else if (e.key === 'ArrowUp') {
                      e.preventDefault();
                      setSelectedSuggestionIndex(prev => prev > 0 ? prev - 1 : -1);
                    } else if (e.key === 'Enter' && selectedSuggestionIndex >= 0) {
                      e.preventDefault();
                      selectTipo(tipoSuggestions[selectedSuggestionIndex]);
                      setSelectedSuggestionIndex(-1);
                    } else if (e.key === 'Escape') {
                      setShowTipoDropdown(false);
                      setSelectedSuggestionIndex(-1);
                    }
                  } : undefined}
                  onBlur={() => setTimeout(() => { setShowTipoDropdown(false); setSelectedSuggestionIndex(-1); }, 200)}
                  placeholder="Digite o tipo do produto"
                  style={{ height: 30, width: '100%', padding: '0 8px', border: '0.5px solid #d1d5db', borderRadius: 5, fontSize: 12, outline: 'none', textTransform: 'uppercase' }}
                />
                {showTipoDropdown && tipoSuggestions.length > 0 && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '0.5px solid #d1d5db', borderRadius: 5, zIndex: 110, marginTop: 2, boxShadow: '0 4px 12px rgba(0,0,0,.1)' }}>
                    {tipoSuggestions.map((tipo, idx) => {
                      const isSelected = !isMobile && idx === selectedSuggestionIndex;
                      return (
                        <div 
                          key={tipo}
                          onMouseDown={() => selectTipo(tipo)}
                          style={{ 
                            padding: '7px 10px', 
                            fontSize: 12, 
                            cursor: 'pointer', 
                            borderBottom: '0.5px solid #f3f4f6',
                            background: isSelected ? '#1d4ed8' : '',
                            color: isSelected ? '#fff' : ''
                          }}
                          onMouseEnter={() => {
                            if (!isMobile) setSelectedSuggestionIndex(idx);
                          }}
                        >
                          {tipo}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
                {[
                  { key: 'cor1', label: 'Cor 1 *', onChange: (v: string) => { const vu = v.toUpperCase(); onCor1(vu); searchCores(vu, 'cor1'); setSelectedSuggestionIndex(-1); } },
                  { key: 'cor2', label: 'Cor 2', onChange: (v: string) => { const vu = v.toUpperCase(); setCor2Manual(true); setForm(f => ({ ...f, cor2: vu })); searchCores(vu, 'cor2'); setSelectedSuggestionIndex(-1); } },
                  { key: 'cor3', label: 'Cor 3', onChange: (v: string) => { const vu = v.toUpperCase(); setCor3Manual(true); setForm(f => ({ ...f, cor3: vu })); searchCores(vu, 'cor3'); setSelectedSuggestionIndex(-1); } },
                ].map(f => (
                  <div key={f.key} style={{ position: 'relative' }}>
                    <label style={{ fontSize: 10, fontWeight: 500, color: '#6b7280', textTransform: 'uppercase', display: 'block', marginBottom: 3 }}>{f.label}</label>
                    <input 
                      value={(form as any)[f.key]} 
                      onChange={e => f.onChange(e.target.value.toUpperCase())} 
                      onKeyDown={!isMobile ? (e) => {
                        if (showCorDropdown.field !== f.key || corSuggestions.length === 0) return;
                        if (e.key === 'ArrowDown') {
                          e.preventDefault();
                          setSelectedSuggestionIndex(prev => prev < corSuggestions.length - 1 ? prev + 1 : prev);
                        } else if (e.key === 'ArrowUp') {
                          e.preventDefault();
                          setSelectedSuggestionIndex(prev => prev > 0 ? prev - 1 : -1);
                        } else if (e.key === 'Enter' && selectedSuggestionIndex >= 0) {
                          e.preventDefault();
                          selectCor(corSuggestions[selectedSuggestionIndex], f.key as any);
                          setSelectedSuggestionIndex(-1);
                        } else if (e.key === 'Escape') {
                          setShowCorDropdown({ field: null });
                          setSelectedSuggestionIndex(-1);
                        }
                      } : undefined}
                      onBlur={() => setTimeout(() => { setShowCorDropdown({ field: null }); setSelectedSuggestionIndex(-1); }, 200)}
                      placeholder="—" 
                      style={{ height: 30, width: '100%', padding: '0 8px', border: '0.5px solid #d1d5db', borderRadius: 5, fontSize: 12, outline: 'none', textTransform: 'uppercase' }} 
                    />
                    {showCorDropdown.field === f.key && corSuggestions.length > 0 && (
                      <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '0.5px solid #d1d5db', borderRadius: 5, zIndex: 110, marginTop: 2, boxShadow: '0 4px 12px rgba(0,0,0,.1)' }}>
                        {corSuggestions.map((cor, idx) => {
                          const isSelected = !isMobile && idx === selectedSuggestionIndex;
                          return (
                            <div 
                              key={cor}
                              onMouseDown={() => selectCor(cor, f.key as any)}
                              style={{ 
                                padding: '7px 10px', 
                                fontSize: 12, 
                                cursor: 'pointer', 
                                borderBottom: '0.5px solid #f3f4f6',
                                background: isSelected ? '#1d4ed8' : '',
                                color: isSelected ? '#fff' : ''
                              }}
                              onMouseEnter={() => {
                                if (!isMobile) setSelectedSuggestionIndex(idx);
                              }}
                            >
                              {cor}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Linha 4: Modelo (dropdown) */}
              <div style={{ marginBottom: 10 }}>
                <label style={{ fontSize: 10, fontWeight: 500, color: '#6b7280', textTransform: 'uppercase', display: 'block', marginBottom: 3 }}>
                  Modelo *
                </label>
                <select
                  value={form.modelo}
                  onChange={e => setForm(f => ({ ...f, modelo: e.target.value }))}
                  style={{ height: 30, width: '100%', padding: '0 8px', border: '0.5px solid #d1d5db', borderRadius: 5, fontSize: 12, outline: 'none', background: '#fff' }}>
                  <option value="MASC">Masculino</option>
                  <option value="FEM">Feminino</option>
                  <option value="INF">Infantil</option>
                  <option value="ACESS">Acessório</option>
                </select>
              </div>

              <div style={{ marginBottom: 10 }}>
                <label style={{ fontSize: 10, fontWeight: 500, color: '#6b7280', textTransform: 'uppercase', display: 'block', marginBottom: 3 }}>Custo (R$)</label>
                <input type="number" step={0.01} value={form.custo} onChange={e => setForm(f => ({ ...f, custo: e.target.value }))} placeholder="0,00" style={{ height: 30, width: 140, padding: '0 8px', border: '0.5px solid #d1d5db', borderRadius: 5, fontSize: 12, outline: 'none' }} />
              </div>

              <div style={{ background: '#f9fafb', border: '0.5px solid #e5e7eb', borderRadius: 6, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 11, color: '#6b7280' }}>Desconto {cab.desconto}% → Markup {cab.markup}x → Venda:</span>
                <span style={{ fontSize: 15, fontWeight: 500, color: '#185FA5' }}>{form.custo ? fmtBRL(estVenda) : '—'}</span>
              </div>
            </div>
            <div style={{ padding: '10px 16px', borderTop: '0.5px solid #e5e7eb', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button onClick={() => setShowPopup(false)} style={{ height: 28, padding: '0 14px', borderRadius: 5, fontSize: 12, cursor: 'pointer', border: '0.5px solid #d1d5db', background: 'transparent' }}>Cancelar</button>
              <button onClick={saveItem} style={{ height: 28, padding: '0 14px', borderRadius: 5, fontSize: 12, fontWeight: 500, cursor: 'pointer', border: 'none', background: '#185FA5', color: '#fff' }}>
                {editIdx >= 0 ? 'Salvar' : 'Adicionar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Step 2: Pedidos ──────────────────────────────────────────────────────────

