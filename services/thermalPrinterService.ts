// thermalPrinterService.ts
// Impressão térmica via RawBT (Android) para KP-1025
// Bluetooth 2.0 Classic / ESC/POS / 58mm (48mm útil)
//
// PRÉ-REQUISITO: "RawBT inkless print service" instalado e pareado com KP-1025

// ============================================================
// TIPOS (espelho do banco ice_cream_sales + ice_cream_daily_sales)
// ============================================================
export interface SaleItem {
  product_name: string;
  units_sold: number;
  unit_price: number;
  total_value: number;
}

export interface PrintData {
  storeName: string;        // ex: "REAL CALCADOS"
  storeSubtitle: string;    // ex: "Sorveteria - Loja 26"
  orderNumber: number;      // order_number do banco (senha)
  date: string;             // created_at formatado
  attendantName: string;    // attendant_name do banco
  items: SaleItem[];        // itens da venda
  total: number;            // total_value do ice_cream_sales
  isFiado: boolean;         // payment_method === 'Fiado'
  buyerName?: string;       // buyer_name (só fiado)
}

// ============================================================
// CONSTANTES DO LAYOUT (KP-1025: 48mm útil = 32 chars monospace)
// ============================================================
const WIDTH = 384;          // 48mm * 203dpi / 25.4
const LINE_H = 24;
const FONT = '20px monospace';
const FONT_B = 'bold 20px monospace';
const FONT_L = 'bold 28px monospace';
const MAX_CHARS = 32;
const SEP = '-'.repeat(MAX_CHARS);

// ============================================================
// GERAR IMAGEM DO CUPOM
// ============================================================
function generateReceiptImage(data: PrintData): string {
  // --- calcular altura ---
  let lines = 0;
  lines += 3;  // cabeçalho
  lines += 1;  // separador
  lines += 2;  // label + senha grande
  lines += 1;  // separador
  lines += 2;  // data + operador
  lines += 1;  // separador
  lines += 1;  // header itens
  lines += 1;  // separador
  lines += data.items.length;
  lines += 1;  // separador
  lines += 2;  // total grande
  lines += 1;  // separador
  if (data.isFiado) {
    lines += 3; // "FIADO" + nome
    lines += 4; // assinatura
    lines += 1; // separador
  }
  lines += 2;  // rodapé
  lines += 3;  // margem

  const HEIGHT = lines * LINE_H + 20;
  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.fillStyle = '#000000';

  let y = LINE_H;

  // --- helpers ---
  const center = (text: string, font = FONT) => {
    ctx.font = font;
    const w = ctx.measureText(text).width;
    ctx.fillText(text, (WIDTH - w) / 2, y);
    y += LINE_H;
  };

  const left = (text: string, font = FONT) => {
    ctx.font = font;
    ctx.fillText(text, 4, y);
    y += LINE_H;
  };

  const leftRight = (l: string, r: string, font = FONT) => {
    ctx.font = font;
    ctx.fillText(l, 4, y);
    const w = ctx.measureText(r).width;
    ctx.fillText(r, WIDTH - w - 4, y);
    y += LINE_H;
  };

  const sep = () => center(SEP);

  const money = (v: number) =>
    v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const pad3 = (n: number) => String(n).padStart(3, '0');

  // === CABEÇALHO ===
  center(data.storeName, FONT_L);
  center(data.storeSubtitle);
  y += LINE_H * 0.3;
  sep();

  // === SENHA DE ATENDIMENTO ===
  center('SENHA DE ATENDIMENTO');
  y += LINE_H * 0.2;
  center(pad3(data.orderNumber), 'bold 40px monospace');
  y += LINE_H * 0.2;
  sep();

  // === DATA + OPERADOR ===
  left(`Data: ${data.date}`);
  left(`Operador: ${data.attendantName}`);
  sep();

  // === ITENS ===
  leftRight('ITEM', 'QTD  VALOR', FONT_B);
  sep();

  for (const item of data.items) {
    const name = item.product_name.length > 18
      ? item.product_name.substring(0, 18)
      : item.product_name;
    const r = `${item.units_sold}x ${money(item.total_value)}`;
    leftRight(name, r);
  }

  sep();

  // === TOTAL ===
  ctx.font = FONT_L;
  const totalTxt = `TOTAL R$ ${money(data.total)}`;
  const tw = ctx.measureText(totalTxt).width;
  ctx.fillText(totalTxt, WIDTH - tw - 4, y);
  y += LINE_H * 1.5;

  sep();

  // === FIADO (só se for) ===
  if (data.isFiado) {
    y += LINE_H * 0.3;
    center('*** FIADO ***', FONT_B);
    y += LINE_H * 0.2;
    left(`Cliente: ${data.buyerName || ''}`, FONT_B);
    y += LINE_H * 0.5;

    // Linha de assinatura
    ctx.beginPath();
    ctx.moveTo(20, y);
    ctx.lineTo(WIDTH - 20, y);
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1;
    ctx.stroke();
    y += LINE_H * 0.4;
    center('Assinatura do cliente', 'italic 16px monospace');
    y += LINE_H * 0.5;

    sep();
  }

  // === RODAPÉ ===
  center('Obrigado pela preferencia!');
  y += LINE_H * 0.2;
  center('Aguarde sua senha ser chamada', 'italic 16px monospace');
  y += LINE_H;

  return canvas.toDataURL('image/png');
}

// ============================================================
// ENVIAR PRO RAWBT
// ============================================================
function printViaRawbt(base64DataUrl: string): void {
  window.location.href = 'rawbt:' + base64DataUrl;
}

function printViaIntent(base64DataUrl: string): void {
  window.location.href =
    'intent:' +
    encodeURI(base64DataUrl) +
    '#Intent;' +
    'component=ru.a402d.rawbtprinter.activity.PrintDownloadActivity;' +
    'package=ru.a402d.rawbtprinter;end;';
}

// ============================================================
// API PÚBLICA
// ============================================================

/**
 * Imprime cupom de venda. Chame DEPOIS do insert no Supabase,
 * passando o order_number retornado.
 *
 * Se for FIADO, imprime 2 vias (1 pro cliente, 1 pra loja).
 */
export function printReceipt(data: PrintData): boolean {
  try {
    const img = generateReceiptImage(data);
    printViaRawbt(img);

    // Se fiado, imprime 2ª via após 3 segundos
    if (data.isFiado) {
      setTimeout(() => {
        const img2 = generateReceiptImage(data);
        printViaRawbt(img2);
      }, 3000);
    }

    console.log(`[Printer] Cupom #${data.orderNumber} enviado`);
    return true;
  } catch (error) {
    console.error('[Printer] Erro:', error);
    try {
      const img = generateReceiptImage(data);
      printViaIntent(img);
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Legado / Compatibilidade wrapper de printSaleReceipt para compatibilidade
 */
export function printSaleReceipt(sale: any): boolean {
  const isFiado = sale.paymentMethod?.toLowerCase().includes('fiado') || false;
  // Extrai número do saleCode como orderNumber de fallback caso não fornecido
  const orderNumber = Number(sale.saleCode?.replace(/[^0-9]/g, '')) || 1;

  return printReceipt({
    storeName: sale.storeName || 'REAL CALCADOS',
    storeSubtitle: sale.storeSubtitle || 'Sorveteria',
    orderNumber: orderNumber,
    date: sale.date || new Date().toLocaleString('pt-BR'),
    attendantName: sale.operator || '',
    items: (sale.items || []).map((item: any) => ({
      product_name: item.name || item.product_name || '',
      units_sold: Number(item.quantity || item.units_sold || 0),
      unit_price: Number(item.unitPrice || item.unit_price || 0),
      total_value: Number(item.total || item.total_value || 0),
    })),
    total: Number(sale.total || 0),
    isFiado: isFiado,
    buyerName: sale.paymentMethod?.split('-')[1]?.trim() || sale.buyerName || undefined
  });
}

/**
 * Teste rápido de impressão
 */
export function printTest(): boolean {
  return printReceipt({
    storeName: 'REAL CALCADOS',
    storeSubtitle: 'Sorveteria - Loja 26',
    orderNumber: 1,
    date: new Date().toLocaleString('pt-BR'),
    attendantName: 'Teste',
    items: [
      { product_name: 'Acai 500ml', units_sold: 1, unit_price: 18, total_value: 18 },
      { product_name: 'Picole Morango', units_sold: 2, unit_price: 5, total_value: 10 },
    ],
    total: 28,
    isFiado: false,
  });
}

export function printTestFiado(): boolean {
  return printReceipt({
    storeName: 'REAL CALCADOS',
    storeSubtitle: 'Sorveteria - Loja 26',
    orderNumber: 2,
    date: new Date().toLocaleString('pt-BR'),
    attendantName: 'Teste',
    items: [
      { product_name: 'Sundae Chocolate', units_sold: 1, unit_price: 15, total_value: 15 },
    ],
    total: 15,
    isFiado: true,
    buyerName: 'Joao Silva',
  });
}

export default { printReceipt, printSaleReceipt, printTest, printTestFiado };
