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

  // 1. Fetch items
  const { data: items } = await supabase
    .from('buy_order_items')
    .select('*')
    .eq('order_id', order.id)
    .order('referencia');

  const loadedItems = items || [];

  // 2. Fetch sub-orders
  const { data: subOrders } = await supabase
    .from('buy_order_sub_orders')
    .select('*')
    .eq('order_id', order.id)
    .order('sub_order_num', { ascending: true });

  const loadedSubOrders = subOrders || [];

  // 3. Fetch sub-order item grades
  const { data: itemGrades } = await supabase
    .from('buy_order_item_suborder_grades')
    .select('*')
    .in('item_id', loadedItems.map(i => i.id));

  // Memory index of sub-order grades by item ID
  const itemGradeMap = new Map<string, { grade_letra: string; sub_order_num: number }[]>();
  (itemGrades || []).forEach((ig: any) => {
    if (!itemGradeMap.has(ig.item_id)) {
      itemGradeMap.set(ig.item_id, []);
    }
    itemGradeMap.get(ig.item_id)!.push(ig);
  });

  // 4. Fetch product catalog photos at once to avoid loop queries
  const catalogMap = new Map<string, string>();
  if (loadedItems.length > 0) {
    const references = loadedItems.map(i => i.referencia).filter(Boolean);
    const brandsAndSuppliers = [order.marca, order.fornecedor].filter(Boolean);
    
    let catalogQuery = supabase.from('product_catalog').select('referencia, image_url, cor1');
    if (brandsAndSuppliers.length > 0) {
      catalogQuery = catalogQuery.in('marca', brandsAndSuppliers);
    }
    const { data: catalogData } = await catalogQuery.in('referencia', references);

    (catalogData || []).forEach((c: any) => {
      if (c.image_url) {
        const fullKey = `${c.referencia}_${(c.cor1 || '').toLowerCase()}`;
        catalogMap.set(fullKey, c.image_url);
        if (!catalogMap.has(c.referencia)) {
          catalogMap.set(c.referencia, c.image_url);
        }
      }
    });
  }

  // 5. Gather unique sizes and build grades table values
  const gradesByLetter: Record<string, Record<string, number>> = {};
  const allLetters = new Set<string>();

  loadedItems.forEach((item: any) => {
    if (Array.isArray(item.grades)) {
      item.grades.forEach((g: any) => {
        const letra = g.letra || 'A';
        allLetters.add(letra);
        if (!gradesByLetter[letra]) {
          gradesByLetter[letra] = {};
        }
        const tamanhos = g.tamanhos || {};
        Object.entries(tamanhos).forEach(([size, qty]) => {
          const qtyNum = Number(qty) || 0;
          if (qtyNum > 0) {
            // Keep first valid sizes configuration mapped
            if (!gradesByLetter[letra][size]) {
              gradesByLetter[letra][size] = qtyNum;
            }
          }
        });
      });
    }
  });

  const sortedLetters = Array.from(allLetters).sort();
  const uniqueSizes = new Set<string>();
  sortedLetters.forEach(letra => {
    Object.keys(gradesByLetter[letra] || {}).forEach(sz => uniqueSizes.add(sz));
  });

  const sortedSizes = Array.from(uniqueSizes).sort((a, b) => {
    const numA = parseFloat(a.replace(/[^0-9.]/g, '')) || 0;
    const numB = parseFloat(b.replace(/[^0-9.]/g, '')) || 0;
    return numA - numB;
  });

  // Render Grade table HTML
  let gradesTableHtml = '';
  if (sortedLetters.length > 0) {
    gradesTableHtml += `
      <table class="grades-tbl">
        <thead>
          <tr>
            <th>GRADE</th>
            ${sortedSizes.map(sz => `<th>${sz}</th>`).join('')}
            <th>TOT</th>
          </tr>
        </thead>
        <tbody>
    `;
    sortedLetters.forEach(letra => {
      const sizes = gradesByLetter[letra] || {};
      const totalParesGrade = Object.values(sizes).reduce((s, q) => s + q, 0);
      gradesTableHtml += `
        <tr>
          <td class="grade-cell-letter"><b>${letra}</b></td>
          ${sortedSizes.map(sz => `<td>${sizes[sz] !== undefined ? sizes[sz] : ''}</td>`).join('')}
          <td class="grade-cell-tot"><b>${totalParesGrade}</b></td>
        </tr>
      `;
    });
    gradesTableHtml += `
        </tbody>
      </table>
    `;
  } else {
    gradesTableHtml = `<p style="font-size: 9px; color: #888; text-align: center; padding: 12px 0;">Nenhuma grade configurada no pedido.</p>`;
  }

  // 6. Calculate Financial totals per sub-order and grand totals
  const desconto = Number(order.desconto) || 0;
  
  const subTotals = loadedSubOrders.map((sub: any) => {
    let subPares = 0;
    let subBruto = 0;
    let subVenda = 0;

    loadedItems.forEach((item: any) => {
      const igList = itemGradeMap.get(item.id) || [];
      const match = igList.find(ig => ig.sub_order_num === sub.sub_order_num);
      if (match) {
        const gradeObj = (item.grades || []).find((g: any) => g.letra === match.grade_letra);
        if (gradeObj && gradeObj.tamanhos) {
          const qty: number = Object.values(gradeObj.tamanhos as Record<string, any>).reduce((s: number, v: any) => s + Number(v || 0), 0);
          subPares += qty;
          subBruto += qty * (Number(item.custo) || 0);
          subVenda += qty * (Number(item.preco_venda || 0));
        }
      }
    });

    const subLiquido = subBruto * (1 - desconto / 100);
    const shopsList = (sub.lojas_numeros || []).sort((a: any, b: any) => Number(a) - Number(b)).join(', ');

    return {
      num: sub.sub_order_num,
      pares: subPares,
      bruto: subBruto,
      liquido: subLiquido,
      venda: subVenda,
      lojas: shopsList || '—'
    };
  });

  const grandPares = subTotals.reduce((sum, s) => sum + s.pares, 0);
  const grandBruto = subTotals.reduce((sum, s) => sum + s.bruto, 0);
  const grandLiquido = subTotals.reduce((sum, s) => sum + s.liquido, 0);
  const grandVenda = subTotals.reduce((sum, s) => sum + s.venda, 0);

  const totalShops = [...new Set(loadedSubOrders.flatMap((s: any) => s.lojas_numeros || []))].length;
  const shopsTotalText = `${totalShops} loja${totalShops !== 1 ? 's' : ''}`;
  const uniqueLojas = [...new Set(loadedSubOrders.flatMap((s: any) => s.lojas_numeros || []))].map(Number).sort((a, b) => a - b);
  const lojasDisplay = uniqueLojas.length > 0 ? uniqueLojas.join(', ') : '—';

  const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  // Format simple Date
  const formatDateSimple = (dStr: string) => {
    if (!dStr) return '';
    const dateObj = new Date(dStr + 'T00:00:00');
    if (isNaN(dateObj.getTime())) return '';
    const day = String(dateObj.getDate()).padStart(2, '0');
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const year = dateObj.getFullYear();
    return `${day}/${month}/${year}`;
  };
  
  const formatDateDayMonth = (dStr: string) => {
    if (!dStr) return '';
    const dateObj = new Date(dStr + 'T00:00:00');
    if (isNaN(dateObj.getTime())) return '';
    const day = String(dateObj.getDate()).padStart(2, '0');
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    return `${day}/${month}`;
  };

  const getEmbarqueDisplay = () => {
    if (!order.fat_inicio && !order.fat_fim) return '—';
    if (order.fat_inicio && order.fat_fim) {
      const start = formatDateDayMonth(order.fat_inicio);
      const endSimple = formatDateSimple(order.fat_fim);
      if (start && endSimple) {
        return `${start} a ${endSimple}`;
      }
    }
    const startFormatted = order.fat_inicio ? formatDateSimple(order.fat_inicio) : '';
    const endFormatted = order.fat_fim ? formatDateSimple(order.fat_fim) : '';
    if (startFormatted && endFormatted) return `${startFormatted} a ${endFormatted}`;
    return startFormatted || endFormatted || '—';
  };

  const printWindow = window.open('', '_blank');
  if (!printWindow) return;

  printWindow.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Pedido #${order.numero_pedido} - ${order.marca}</title>
  <style>
    @page { size: A4 portrait; margin: 10mm; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      color: #0f172a;
      font-size: 9px;
      line-height: 1.3;
      background: #fff;
      padding: 5px;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    
    /* Close Button */
    .btn-fechar {
      position: fixed;
      top: 15px;
      right: 15px;
      z-index: 9999;
      background: #1e40af;
      color: white;
      border: none;
      border-radius: 6px;
      padding: 8px 14px;
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      transition: background 0.15s;
    }
    .btn-fechar:hover {
      background: #1e3a8a;
    }

    /* Header Accent Layout */
    .header-container {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 10px;
      padding-bottom: 6px;
      border-bottom: 2px solid #1e40af;
    }
    .badge-accent {
      background: #1e40af;
      color: #ffffff;
      font-weight: 800;
      font-size: 11px;
      padding: 3px 6px;
      border-radius: 4px;
      margin-right: 8px;
      display: inline-block;
    }
    .header-title {
      font-size: 14px;
      color: #0f172a;
      font-weight: 800;
      display: inline-block;
      vertical-align: middle;
      text-transform: uppercase;
      letter-spacing: -0.2px;
    }
    .header-forn {
      font-size: 9.5px;
      color: #475569;
      margin-top: 2px;
    }
    .brand-title {
      font-size: 14px;
      font-weight: 800;
      color: #1e40af;
      letter-spacing: 0.5px;
      text-align: right;
    }
    .brand-sub {
      font-size: 8px;
      font-weight: 600;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 1px;
      text-align: right;
    }

    /* Core Info Block Table */
    .info-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 12px;
      border: 0.5px solid #cbd5e1;
      border-radius: 4px;
      overflow: hidden;
    }
    .info-table th, .info-table td {
      padding: 4px 8px;
      font-size: 9px;
      border: 0.5px solid #cbd5e1;
    }
    .info-table th {
      background: #f1f5f9;
      color: #475569;
      font-weight: 700;
      text-align: left;
      width: 12%;
    }
    .info-table td {
      color: #0f172a;
      font-weight: 600;
      width: 21.3%;
    }

    /* Section 2 Column Side-by-Side Grid */
    .sec2-container {
      display: flex;
      gap: 15px;
      margin-bottom: 12px;
    }
    .sec2-grades {
      flex: 2;
      border: 0.5px solid #cbd5e1;
      border-radius: 4px;
      padding: 6px;
      background: #fff;
    }
    .sec2-suborders {
      flex: 1;
      border: 0.5px solid #cbd5e1;
      border-radius: 4px;
      padding: 6px;
      background: #fff;
    }
    .sec2-title {
      font-size: 8px;
      color: #475569;
      font-weight: 700;
      text-transform: uppercase;
      margin-bottom: 5px;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 2px;
      letter-spacing: 0.5px;
    }
    .grades-tbl {
      width: 100%;
      border-collapse: collapse;
    }
    .grades-tbl th, .grades-tbl td {
      border: 0.5px solid #cbd5e1;
      text-align: center;
      padding: 3px;
      font-size: 8.5px;
    }
    .grades-tbl th {
      background: #f8fafc;
      font-weight: 700;
      color: #475569;
    }
    .grade-cell-letter {
      background: #f1f5f9;
      color: #1e3a8a;
    }
    .grade-cell-tot {
      background: #f1f5f9;
      font-weight: 700;
      color: #1e3a8a;
    }
    .suborder-list {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .suborder-item {
      font-size: 8.5px;
      font-weight: 600;
      color: #334155;
      padding: 3px 6px;
      background: #f8fafc;
      border-radius: 3px;
      border: 0.5px solid #e2e8f0;
    }

    /* Section 3 Financial Overview (Before items) */
    .financial-tbl {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 12px;
      border: 0.5px solid #cbd5e1;
      border-radius: 4px;
      overflow: hidden;
    }
    .financial-tbl th, .financial-tbl td {
      border: 0.5px solid #cbd5e1;
      padding: 4px 8px;
      font-size: 9px;
      text-align: right;
    }
    .financial-tbl th {
      background: #e2e8f0;
      font-weight: 700;
      color: #334155;
      text-align: center;
    }
    .financial-tbl td:first-child, .financial-tbl th:first-child {
      text-align: left;
      font-weight: 700;
      background: #f1f5f9;
      color: #334155;
      width: 130px;
    }
    .financial-tbl tr:nth-child(even) {
      background: #fcfdfe;
    }
    .financial-total-col {
      font-weight: 700;
      background: #f0fdf4 !important;
      color: #166534;
    }

    /* Section 4 Items Table Grid Layout */
    .items-tbl {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 15px;
    }
    .items-tbl th, .items-tbl td {
      border: 0.5px solid #cbd5e1;
      padding: 4px 6px;
      vertical-align: top;
      font-size: 9px;
    }
    .items-tbl th {
      background: #1e40af;
      color: white;
      font-weight: 700;
      text-align: center;
      padding: 5px;
    }
    .items-tbl tr:nth-child(even) {
      background: #f8fafc;
    }
    
    /* Columns & Photo Sizing */
    .cell-foto {
      text-align: center;
      width: 54px;
    }
    .item-img {
      width: 44px;
      height: 44px;
      object-fit: contain;
      border-radius: 4px;
      border: 0.5px solid #cbd5e1;
      background: #f8fafc;
    }
    .item-no-img {
      width: 44px;
      height: 44px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 4px;
      border: 0.5px dashed #cbd5e1;
      background: #f1f5f9;
      color: #94a3b8;
      font-size: 7px;
      font-weight: 700;
      text-align: center;
      line-height: 1.1;
      text-transform: uppercase;
    }
    
    /* Alignment of Lines inside item row cells */
    .cell-info {
      line-height: normal;
    }
    .cell-sub {
      text-align: center;
    }
    .cell-cost {
      text-align: right;
    }
    .cell-sale {
      text-align: right;
    }

    /* Height constraints to perfectly sync matching lines */
    .items-tbl td .line-1,
    .items-tbl td .line-2,
    .items-tbl td .line-3 {
      height: 15px;
      line-height: 15px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .items-tbl td .line-1 {
      font-size: 9.5px;
    }
    .items-tbl td .line-2 {
      color: #475569;
    }
    .items-tbl td .line-3 {
      color: #64748b;
    }

    /* Badges */
    .badge-grade-letter {
      display: inline-block;
      color: white;
      font-weight: 850;
      padding: 0 4.5px;
      border-radius: 2.5px;
      font-size: 8.5px;
      line-height: 12px;
      height: 12px;
      text-align: center;
    }

    /* Footers */
    .footer {
      border-top: 1px solid #cbd5e1;
      padding-top: 6px;
      margin-top: 15px;
      text-align: center;
      font-size: 8px;
      color: #94a3b8;
      letter-spacing: 0.3px;
    }

    /* Print settings overrides */
    @media print {
      .btn-fechar { display: none; }
      body { padding: 0; }
    }
  </style>
</head>
<body>

  <button class="btn-fechar" onclick="window.close()">✕ Fechar Impressão</button>

  <!-- SEÇÃO 1: CABEÇALHO ACCENT -->
  <div class="header-container">
    <div>
      <span class="badge-accent">GED</span>
      <h1 class="header-title">PEDIDO #${order.numero_pedido || 'S/N'} — ${order.marca || 'SEM MARCA'}</h1>
      <p class="header-forn">Fornecedor: <b>${order.fornecedor || '—'}</b></p>
    </div>
    <div>
      <div class="brand-title">REAL CALÇADOS</div>
      <div class="brand-sub">Gestão de Compras</div>
    </div>
  </div>

  <table class="info-table">
    <tr>
      <th>DATA:</th>
      <td>${new Date(order.created_at).toLocaleDateString('pt-BR')}</td>
      <th>LOJAS:</th>
      <td>${lojasDisplay}</td>
      <th>DESCONTO:</th>
      <td>${desconto > 0 ? desconto.toFixed(1).replace('.', ',') + '%' : '—'}</td>
    </tr>
    <tr>
      <th>REPR:</th>
      <td>${order.representante || '—'} ${order.telefone_representante || order.telefone ? `(${order.telefone_representante || order.telefone})` : ''}</td>
      <th>COMPRADOR:</th>
      <td>${order.user_name || '—'}</td>
      <th>MARKUP:</th>
      <td>${order.markup ? Number(order.markup).toFixed(2).replace('.', ',') + 'x' : '—'}</td>
    </tr>
    <tr>
      <th>EMBARQUE:</th>
      <td>${getEmbarqueDisplay()}</td>
      <th>PRAZOS:</th>
      <td colspan="3">${order.prazos ? (Array.isArray(order.prazos) ? order.prazos.join(' / ') : order.prazos) : '—'} dias</td>
    </tr>
  </table>

  <!-- SEÇÃO 2: TABELA DE GRADES + MAPA DE SUB-PEDIDOS -->
  <div class="sec2-container">
    <div class="sec2-grades">
      <div class="sec2-title">Grades Únicas do Pedido</div>
      ${gradesTableHtml}
    </div>
    
    <div class="sec2-suborders">
      <div class="sec2-title">Mapa de Sub-pedidos</div>
      <div class="suborder-list">
        ${loadedSubOrders.length > 0 ? loadedSubOrders.map(sub => `
          <div class="suborder-item">
            <strong>PED ${sub.sub_order_num}:</strong> Loja(s) ${(sub.lojas_numeros || []).sort((a: any, b: any) => Number(a) - Number(b)).join(', ')}
          </div>
        `).join('') : '<div style="font-size: 8.5px; color: #888; padding: 4px;">Nenhum sub-pedido cadastrado.</div>'}
      </div>
    </div>
  </div>

  <!-- SEÇÃO 3: RESUMO FINANCEIRO POR SUB-PEDIDO -->
  <table class="financial-tbl">
    <thead>
      <tr>
        <th>RESUMO</th>
        ${subTotals.map(s => `<th>PED ${s.num}</th>`).join('')}
        <th class="financial-total-col">TOTAL</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><b>PARES</b></td>
        ${subTotals.map(s => `<td>${s.pares}</td>`).join('')}
        <td class="financial-total-col"><b>${grandPares}</b></td>
      </tr>
      <tr>
        <td><b>VL. BRUTO</b></td>
        ${subTotals.map(s => `<td>${fmt(s.bruto)}</td>`).join('')}
        <td class="financial-total-col"><b>${fmt(grandBruto)}</b></td>
      </tr>
      <tr>
        <td><b>VL. LÍQUIDO</b></td>
        ${subTotals.map(s => `<td>${fmt(s.liquido)}</td>`).join('')}
        <td class="financial-total-col"><b>${fmt(grandLiquido)}</b></td>
      </tr>
      ${incluirVenda ? `
        <tr>
          <td><b>VL. VENDA (EST.)</b></td>
          ${subTotals.map(s => `<td>${fmt(s.venda)}</td>`).join('')}
          <td class="financial-total-col"><b>${fmt(grandVenda)}</b></td>
        </tr>
      ` : ''}
      <tr>
        <td><b>LOJAS</b></td>
        ${subTotals.map(s => `<td>${s.lojas}</td>`).join('')}
        <td class="financial-total-col"><b>${shopsTotalText}</b></td>
      </tr>
    </tbody>
  </table>

  <!-- SEÇÃO 4: TABELA DE ITENS COM FOTOS (3 LINHAS CONTRATADAS) -->
  <table class="items-tbl">
    <thead>
      <tr>
        <th style="width: 54px;">FOTO</th>
        <th>REF / TIPO / CORES</th>
        ${loadedSubOrders.map(sub => `<th>PED ${sub.sub_order_num}</th>`).join('')}
        <th style="width: 80px; text-align: right;">CUSTO (R$)</th>
        ${incluirVenda ? `<th style="width: 80px; text-align: right;">VENDA (R$)</th>` : ''}
      </tr>
    </thead>
    <tbody>
      ${loadedItems.map(item => {
        const fullKey = `${item.referencia}_${(item.cor1 || '').toLowerCase()}`;
        const itemImageUrl = catalogMap.get(fullKey) || catalogMap.get(item.referencia) || null;
        const cores = [item.cor1, item.cor2, item.cor3].filter(Boolean).join(' / ');

        return `
          <tr>
            <!-- Coluna Foto -->
            <td class="cell-foto">
              ${itemImageUrl ? `
                <img class="item-img" src="${itemImageUrl}" referrerpolicy="no-referrer" />
              ` : `
                <div class="item-no-img">Sem<br>Foto</div>
              `}
            </td>

            <!-- Coluna Informações Principais -->
            <td class="cell-info">
              <div class="line-1"><b>${item.referencia}</b></div>
              <div class="line-2" style="font-weight: 600;">${item.tipo || 'TIPO NÃO DEFINIDO'}</div>
              <div class="line-3">${cores || '—'}</div>
            </td>

            <!-- Colunas de Sub-pedidos Dinâmicas -->
            ${loadedSubOrders.map(sub => {
              const igList = itemGradeMap.get(item.id) || [];
              const match = igList.find(ig => ig.sub_order_num === sub.sub_order_num);

              if (match) {
                const gradeObj = (item.grades || []).find((g: any) => g.letra === match.grade_letra);
                let subParesQty = 0;
                if (gradeObj && gradeObj.tamanhos) {
                  subParesQty = Object.values(gradeObj.tamanhos as Record<string, any>).reduce((s: number, v: any) => s + Number(v || 0), 0);
                }
                const colorsDef = gradeColors[match.grade_letra] || { bg: '#4f46e5', light: '#e0e7ff' };

                return `
                  <td class="cell-sub">
                    <div class="line-1"><b>${subParesQty}</b></div>
                    <div class="line-2" style="color: #cbd5e1;">&nbsp;</div>
                    <div class="line-3">
                      <span class="badge-grade-letter" style="background: ${colorsDef.bg};">${match.grade_letra}</span>
                    </div>
                  </td>
                `;
              } else {
                return `
                  <td class="cell-sub text-slate-300">
                    <div class="line-1">—</div>
                    <div class="line-2">&nbsp;</div>
                    <div class="line-3">&nbsp;</div>
                  </td>
                `;
              }
            }).join('')}

            <!-- Coluna Custo -->
            <td class="cell-cost">
              <div class="line-1">&nbsp;</div>
              <div class="line-2" style="font-weight: 700; color: #1e293b;">
                ${Number(item.custo || 0).toFixed(2).replace('.', ',')}
              </div>
              <div class="line-3">&nbsp;</div>
            </td>

            <!-- Coluna Venda (Condicional) -->
            ${incluirVenda ? `
              <td class="cell-sale">
                <div class="line-1">&nbsp;</div>
                <div class="line-2" style="font-weight: 800; color: #15803d;">
                  ${Number(item.preco_venda || 0).toFixed(2).replace('.', ',')}
                </div>
                <div class="line-3">&nbsp;</div>
              </td>
            ` : ''}
          </tr>
        `;
      }).join('')}
    </tbody>
  </table>

  <!-- SEÇÃO 5: RODAPÉ -->
  <div class="footer">
    Real Calçados — Gestão de Compras • ${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
  </div>

  <script>
    (function() {
      var imgs = document.querySelectorAll('img');
      var total = imgs.length;
      if (total === 0) { setTimeout(function() { window.print(); }, 350); return; }
      var loaded = 0;
      function check() { loaded++; if (loaded >= total) setTimeout(function() { window.print(); }, 350); }
      imgs.forEach(function(img) {
        if (img.complete) { check(); } else { img.onload = check; img.onerror = check; }
      });
      setTimeout(function() { window.print(); }, 6000);
    })();
  </script>
</body>
</html>`);

  printWindow.document.close();
};
