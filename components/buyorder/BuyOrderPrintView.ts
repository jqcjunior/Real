import { SupabaseClient } from '@supabase/supabase-js';

export const printOrder = async (order: any, supabase: SupabaseClient) => {
  // 1. Buscar itens do pedido
  const { data: items } = await supabase
    .from('buy_order_items').select('*').eq('order_id', order.id).order('item_order');

  // 2. Buscar sub-orders (para listar lojas)
  const { data: subOrders } = await supabase
    .from('buy_order_sub_orders').select('*').eq('order_id', order.id);

  // 3. Para cada item, buscar foto do catálogo
  const itemsWithPhotos = await Promise.all(
    (items || []).map(async (item) => {
      const { data: catalog } = await supabase
        .from('product_catalog').select('image_url')
        .eq('marca', order.marca).eq('referencia', item.referencia)
        .eq('cor1', item.cor1 || '').maybeSingle();
      return { ...item, image_url: catalog?.image_url || null };
    })
  );

  // 4. Calcular totais
  const totalPares = itemsWithPhotos.reduce((s, i) => s + (i.total_pares || 0), 0);
  const totalBruto = itemsWithPhotos.reduce((s, i) => s + ((Number(i.custo) || 0) * (i.total_pares || 0)), 0);
  const desconto = Number(order.desconto) || 0;
  const totalLiquido = totalBruto * (1 - desconto / 100);
  const lojas = [...new Set((subOrders || []).map((s: any) => s.store_number))].sort().join(', ');

  const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  // 5. Abrir janela de impressão
  const printWindow = window.open('', '_blank');
  if (!printWindow) return;

  printWindow.document.write(`<!DOCTYPE html>
  <html><head><title>Pedido #${order.numero_pedido} - ${order.marca}</title>
  <style>
    @page { size: A4; margin: 12mm; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, sans-serif; padding: 16px; color: #333; font-size: 10px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #1e40af; padding-bottom: 10px; margin-bottom: 10px; }
    .header h1 { font-size: 16px; color: #1e40af; font-weight: 600; }
    .header-sub { font-size: 10px; color: #555; margin-top: 4px; }
    .header-right { text-align: right; }
    .header-right p:first-child { font-size: 11px; font-weight: 600; color: #333; }
    .header-right p:last-child { font-size: 9px; color: #888; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; border: 0.5px solid #ddd; border-radius: 4px; margin-bottom: 10px; overflow: hidden; }
    .info-cell { padding: 5px 10px; border-right: 0.5px solid #ddd; border-bottom: 0.5px solid #ddd; }
    .info-cell:nth-child(2n) { border-right: none; }
    .info-cell:nth-last-child(-n+2) { border-bottom: none; }
    .info-label { font-size: 7px; color: #888; text-transform: uppercase; letter-spacing: 0.5px; }
    .info-value { font-size: 10px; font-weight: 600; margin-top: 1px; }
    .info-sub { font-size: 9px; color: #555; margin-top: 1px; }
    table { width: 100%; border-collapse: collapse; }
    th { background: #1e40af; color: white; padding: 5px 4px; font-size: 8px; text-align: left; font-weight: 500; }
    td { border-bottom: 0.5px solid #e5e7eb; padding: 4px; font-size: 9px; vertical-align: middle; }
    .photo { width: 44px; height: 44px; object-fit: cover; border-radius: 3px; border: 0.5px solid #e5e7eb; }
    .no-photo { width: 44px; height: 44px; background: #f3f4f6; border-radius: 3px; display: flex; align-items: center; justify-content: center; color: #9ca3af; font-size: 7px; text-align: center; line-height: 1.2; }
    .ref { font-weight: 600; font-size: 10px; }
    .venda { font-weight: 600; color: #1e40af; }
    .pares { font-weight: 600; font-size: 10px; text-align: center; }
    .grades { font-size: 8px; color: #666; }
    .totals-grid { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; border: 0.5px solid #ddd; border-radius: 4px; margin-top: 10px; overflow: hidden; }
    .total-cell { padding: 6px 10px; text-align: center; border-right: 0.5px solid #ddd; }
    .total-cell:last-child { border-right: none; background: #f0f7ff; }
    .total-label { font-size: 7px; color: #888; text-transform: uppercase; }
    .total-value { font-size: 13px; font-weight: 600; color: #333; margin-top: 2px; }
    .total-cell:last-child .total-label { color: #1e40af; font-weight: 600; }
    .total-cell:last-child .total-value { color: #1e40af; }
    .footer { margin-top: 10px; text-align: center; font-size: 8px; color: #aaa; }
    @media print { body { padding: 0; } }
  </style></head><body>

    <div class="header">
      <div>
        <h1>PEDIDO #${order.numero_pedido} — ${order.marca}</h1>
        <p class="header-sub">Fornecedor: <b>${order.fornecedor || '-'}</b></p>
      </div>
      <div class="header-right">
        <p>REAL CALÇADOS</p>
        <p>Gestão de compras</p>
      </div>
    </div>

    <div class="info-grid">
      <div class="info-cell">
        <div class="info-label">Data</div>
        <div class="info-value">${new Date(order.created_at).toLocaleDateString('pt-BR')}</div>
      </div>
      <div class="info-cell">
        <div class="info-label">Lojas</div>
        <div class="info-value">${lojas}</div>
      </div>
      <div class="info-cell">
        <div class="info-label">Representante</div>
        <div class="info-value">${order.representante || '-'}</div>
        <div class="info-sub">${order.telefone_representante || order.telefone || '-'}</div>
      </div>
      <div class="info-cell">
        <div class="info-label">Comprador</div>
        <div class="info-value">${order.user_name || '-'}</div>
        <div class="info-sub">${order.user_role || '-'}</div>
      </div>
      <div class="info-cell">
        <div class="info-label">Markup</div>
        <div class="info-value">${order.markup}x</div>
      </div>
      <div class="info-cell">
        <div class="info-label">Prazos</div>
        <div class="info-value">${order.prazos ? (Array.isArray(order.prazos) ? order.prazos.join(' / ') : order.prazos) : '-'} dias</div>
      </div>
    </div>

    <table>
      <thead><tr>
        <th style="width:48px">Foto</th><th>Ref</th><th>Tipo</th><th>Cor</th>
        <th style="text-align:right">Custo</th><th style="text-align:right">Venda</th>
        <th style="text-align:center">Pares</th><th>Grades</th>
      </tr></thead>
      <tbody>
        ${itemsWithPhotos.map(item => {
          const gradesStr = item.grades
            ? Object.entries(item.grades as Record<string, number>)
                .filter(([_, v]) => v > 0)
                .map(([k, v]) => k + ':' + v).join(' | ')
            : '-';
          return '<tr>' +
            '<td>' + (item.image_url
              ? '<img class="photo" src="' + item.image_url + '" />'
              : '<div class="no-photo">Sem<br>foto</div>') + '</td>' +
            '<td class="ref">' + item.referencia + '</td>' +
            '<td>' + (item.tipo || '-') + '</td>' +
            '<td>' + (item.cor1 || '-') + '</td>' +
            '<td style="text-align:right">R$ ' + Number(item.custo).toFixed(2) + '</td>' +
            '<td style="text-align:right" class="venda">R$ ' + Number(item.preco_venda).toFixed(2) + '</td>' +
            '<td class="pares">' + (item.total_pares || 0) + '</td>' +
            '<td class="grades">' + gradesStr + '</td></tr>';
        }).join('')}
      </tbody>
    </table>

    <div class="totals-grid">
      <div class="total-cell">
        <div class="total-label">Itens</div>
        <div class="total-value">${itemsWithPhotos.length}</div>
      </div>
      <div class="total-cell">
        <div class="total-label">Total pares</div>
        <div class="total-value">${totalPares}</div>
      </div>
      <div class="total-cell">
        <div class="total-label">Total bruto</div>
        <div class="total-value">${fmt(totalBruto)}</div>
      </div>
      <div class="total-cell">
        <div class="total-label">Total líquido${desconto > 0 ? ' (-' + desconto + '%)' : ''}</div>
        <div class="total-value">${fmt(totalLiquido)}</div>
      </div>
    </div>

    <div class="footer">RealAdmin — Gerado em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} — Folha A4</div>

    <script>setTimeout(() => window.print(), 500);</script>
  </body></html>`);
  printWindow.document.close();
};
