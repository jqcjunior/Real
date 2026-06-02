import { SupabaseClient } from '@supabase/supabase-js';

const gradeColors: Record<string, { bg: string; light: string }> = {
  A: { bg: '#1e3a8a', light: '#dbeafe' },
  B: { bg: '#0f6e56', light: '#e1f5ee' },
  C: { bg: '#993c1d', light: '#faece7' },
  D: { bg: '#534ab7', light: '#eeedfe' },
  E: { bg: '#854f0b', light: '#faeeda' },
  F: { bg: '#993556', light: '#fbeaf0' },
  G: { bg: '#5f5e5a', light: '#f1efe8' },
  H: { bg: '#a32d2d', light: '#fcebeb' },
};

export const printOrder = async (order: any, supabase: SupabaseClient) => {
  const incluirVenda = window.confirm('Incluir preço de venda na impressão?');

  const { data: items } = await supabase
    .from('buy_order_items').select('*').eq('order_id', order.id).order('item_order');

  const { data: subOrders } = await supabase
    .from('buy_order_sub_orders').select('*').eq('order_id', order.id);

  const itemsWithPhotos = await Promise.all(
    (items || []).map(async (item) => {
      const { data: catalog } = await supabase
        .from('product_catalog').select('image_url')
        .eq('marca', order.marca).eq('referencia', item.referencia)
        .eq('cor1', item.cor1 || '').maybeSingle();
      return { ...item, image_url: catalog?.image_url || null };
    })
  );

  const totalPares = itemsWithPhotos.reduce((s, i) => s + (i.total_pares || 0), 0);
  const totalBruto = itemsWithPhotos.reduce((s, i) => s + ((Number(i.custo) || 0) * (i.total_pares || 0)), 0);
  const desconto = Number(order.desconto) || 0;
  const totalLiquido = totalBruto * (1 - desconto / 100);
  const totalBrutoVenda = itemsWithPhotos.reduce((s, i) => s + ((Number(i.preco_venda) || 0) * (i.total_pares || 0)), 0);
  const lojas = [...new Set((subOrders || []).flatMap((s: any) => s.lojas_numeros || []))].sort((a, b) => a - b).join(', ');

  const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const printWindow = window.open('', '_blank');
  if (!printWindow) return;

  printWindow.document.write(`<!DOCTYPE html>
<html><head><title>Pedido #${order.numero_pedido} - ${order.marca}</title>
<style>
  @page { size: A4; margin: 12mm; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Arial, sans-serif; padding: 16px; color: #333; font-size: 10px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
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
  .item-row { display: flex; align-items: flex-start; gap: 8px; padding: 8px 4px; border-bottom: 0.5px solid #e5e7eb; }
  .photo { width: 48px; height: 48px; object-fit: contain; background: #f9fafb; border-radius: 3px; border: 0.5px solid #e5e7eb; flex-shrink: 0; }
  .no-photo { width: 48px; height: 48px; background: #f3f4f6; border-radius: 3px; display: flex; align-items: center; justify-content: center; color: #9ca3af; font-size: 7px; text-align: center; line-height: 1.2; flex-shrink: 0; }
  .item-content { flex: 1; min-width: 0; }
  .item-line1 { display: flex; align-items: baseline; gap: 6px; margin-bottom: 4px; }
  .item-ref { font-size: 11px; font-weight: 700; color: #111; }
  .item-tipo { font-size: 9px; color: #555; }
  .item-cores { font-size: 9px; color: #888; }
  .item-line2 { display: flex; align-items: center; justify-content: space-between; }
  .item-grades { display: flex; align-items: center; gap: 3px; flex-wrap: wrap; flex: 1; }
  .item-prices { display: flex; gap: 8px; align-items: baseline; flex-shrink: 0; margin-left: 8px; }
  .item-custo-label { font-size: 8px; color: #888; }
  .item-custo-val { font-size: 10px; font-weight: 600; color: #333; }
  .item-venda-label { font-size: 8px; color: #1e40af; }
  .item-venda-val { font-size: 10px; font-weight: 700; color: #1e40af; }
  .item-pares { font-size: 9px; font-weight: 600; color: #666; white-space: nowrap; }
  .grade-letra { padding: 1px 5px; border-radius: 2px; font-size: 10px; font-weight: 700; color: white; min-width: 14px; text-align: center; line-height: 1.4; }
  .grade-pair { display: inline-flex; border-radius: 2px; overflow: hidden; }
  .grade-tam { padding: 1px 4px; font-size: 9px; font-weight: 600; color: white; }
  .grade-qty { padding: 1px 4px; font-size: 9px; font-weight: 600; }
  .totals-grid { display: grid; grid-template-columns: ${incluirVenda ? '1fr 1fr 1fr 1fr' : '1fr 1fr 1fr 1fr'}; border: 0.5px solid #ddd; border-radius: 4px; margin-top: 10px; overflow: hidden; }
  .total-cell { padding: 6px 10px; text-align: center; border-right: 0.5px solid #ddd; }
  .total-cell:last-child { border-right: none; background: #f0f7ff; }
  .total-label { font-size: 7px; color: #888; text-transform: uppercase; }
  .total-value { font-size: 13px; font-weight: 600; color: #333; margin-top: 2px; }
  .total-cell:last-child .total-label { color: #1e40af; font-weight: 600; }
  .total-cell:last-child .total-value { color: #1e40af; }
  .footer { margin-top: 10px; text-align: center; font-size: 8px; color: #aaa; }
  .btn-fechar { position: fixed; top: 12px; right: 12px; z-index: 999; background: #1e40af; color: white; border: none; border-radius: 8px; padding: 10px 18px; font-size: 14px; font-weight: 600; cursor: pointer; box-shadow: 0 2px 8px rgba(0,0,0,0.3); }
  @media print { .btn-fechar { display: none; } body { padding: 0; } }
</style></head><body>

  <button class="btn-fechar" onclick="window.close()">✕ Fechar</button>

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

  <div style="border-top:2px solid #1e40af;">
    ${itemsWithPhotos.map(item => {
      const gradesHtml = Array.isArray(item.grades) && item.grades.length > 0
        ? item.grades.map((g: any) => {
            const letra = g.letra || 'A';
            const c = gradeColors[letra] || gradeColors['A'];
            const pairs = Object.entries(g.tamanhos || {})
              .filter(([_, qty]) => (Number(qty) || 0) > 0)
              .sort(([a], [b]) => (parseInt(a.split('-')[0]) || 0) - (parseInt(b.split('-')[0]) || 0))
              .map(([sizeKey, qty]) => {
                const tam = sizeKey.split('-')[0];
                return '<span class="grade-pair"><span class="grade-tam" style="background:' + c.bg + '">' + tam + '</span><span class="grade-qty" style="background:' + c.light + ';color:' + c.bg + '">' + qty + '</span></span>';
              }).join(' ');
            return '<span class="grade-letra" style="background:' + c.bg + '">' + letra + '</span> ' + pairs;
          }).join('  ')
        : '';
      const cores = [item.cor1, item.cor2, item.cor3].filter(Boolean).join(' - ');
      return '<div class="item-row">' +
        (item.image_url
          ? '<img class="photo" src="' + item.image_url + '" />'
          : '<div class="no-photo">Sem<br>foto</div>') +
        '<div class="item-content">' +
          '<div class="item-line1">' +
            '<span class="item-ref">' + item.referencia + '</span>' +
            '<span class="item-tipo">— ' + (item.tipo || '-') + ' —</span>' +
            '<span class="item-cores">' + (cores || '-') + '</span>' +
          '</div>' +
          '<div class="item-line2">' +
            '<div class="item-grades">' + gradesHtml + '</div>' +
            '<div class="item-prices">' +
              '<span><span class="item-custo-label">Custo </span><span class="item-custo-val">R$ ' + Number(item.custo).toFixed(2).replace('.', ',') + '</span></span>' +
              (incluirVenda ? '<span><span class="item-venda-label">Venda </span><span class="item-venda-val">R$ ' + Number(item.preco_venda).toFixed(2).replace('.', ',') + '</span></span>' : '') +
              '<span class="item-pares">' + (item.total_pares || 0) + ' prs</span>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>';
    }).join('')}
  </div>

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
      <div class="total-label">Total custo${desconto > 0 ? ' (-' + desconto + '%)' : ''}</div>
      <div class="total-value">${fmt(totalLiquido)}</div>
    </div>
    ${incluirVenda ? `<div class="total-cell">
      <div class="total-label">Total venda</div>
      <div class="total-value">${fmt(totalBrutoVenda)}</div>
    </div>` : `<div class="total-cell">
      <div class="total-label">Custo bruto</div>
      <div class="total-value">${fmt(totalBruto)}</div>
    </div>`}
  </div>

  <div class="footer">Real Calçados — Gestão de Compras • ${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</div>

  <script>
    (function() {
      var imgs = document.querySelectorAll('img');
      var total = imgs.length;
      if (total === 0) { setTimeout(function() { window.print(); }, 300); return; }
      var loaded = 0;
      function check() { loaded++; if (loaded >= total) setTimeout(function() { window.print(); }, 300); }
      imgs.forEach(function(img) {
        if (img.complete) { check(); } else { img.onload = check; img.onerror = check; }
      });
      setTimeout(function() { window.print(); }, 5000);
    })();
  </script>
</body></html>`);
  printWindow.document.close();
};