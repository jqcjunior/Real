import { createClient } from '@supabase/supabase-js';
import * as XLSX from 'xlsx';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Importante: No ambiente Node, process.env já contém as variáveis carregadas
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || '';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

/**
 * Busca dados completos do pedido no banco
 */
async function fetchOrderData(orderId: string) {
    console.log(`🔍 Buscando dados do pedido ${orderId}...`);

    // 1. Buscar header do pedido
    const { data: order, error: orderError } = await supabase
        .from('buy_orders')
        .select('*')
        .eq('id', orderId)
        .single();

    if (orderError) throw new Error(`Erro ao buscar pedido: ${orderError.message}`);
    if (!order) throw new Error(`Pedido ${orderId} não encontrado`);

    // 2. Buscar sub-pedidos
    const { data: subOrders } = await supabase
        .from('buy_order_sub_orders')
        .select('*')
        .eq('order_id', orderId);

    // 3. Buscar itens
    const { data: items } = await supabase
        .from('buy_order_items')
        .select('*')
        .eq('order_id', orderId)
        .order('item_order', { ascending: true });

    console.log(`✅ Pedido encontrado: #${order.numero_pedido} - ${order.marca}`);
    console.log(`   - ${items?.length || 0} itens`);
    console.log(`   - ${subOrders?.length || 0} sub-pedidos`);

    return {
        order,
        subOrders: subOrders || [],
        items: items || []
    };
}

/**
 * Mapeia tamanhos para colunas do Excel
 */
const TAMANHO_COLS: Record<string, number> = {
    '20': 12, '21': 13, '22': 14, '23': 15, '24': 16, '25': 17, '26': 18, '27': 19,
    '28': 20, '29': 21, '30': 22, '31': 23, '32': 24, '33': 25, '34': 26, '35': 27
};

/**
 * Mapeia grades para linhas do Excel
 */
const GRADE_ROWS: Record<string, number> = {
    'A': 14, 'B': 15, 'C': 16, 'D': 17, 'E': 18, 'F': 19, 'G': 20, 'H': 21
};

/**
 * Gera arquivo Excel do pedido
 */
export async function exportBuyOrderToExcel(orderId: string) {
    // Buscar dados
    const { order, subOrders, items } = await fetchOrderData(orderId);

    // Carregar template
    const templatePath = path.join(process.cwd(), 'templates', 'Template.xlsx');
    const altTemplatePath = path.join(process.cwd(), 'public', 'templates', 'buy_order_template.xlsx');
    
    let finalTemplatePath = templatePath;
    if (!fs.existsSync(templatePath) && fs.existsSync(altTemplatePath)) {
        finalTemplatePath = altTemplatePath;
    }

    if (!fs.existsSync(finalTemplatePath)) {
        throw new Error(`Template não encontrado em ${finalTemplatePath}`);
    }

    const arrayBuffer = fs.readFileSync(finalTemplatePath);
    const wb = XLSX.read(arrayBuffer, { type: 'buffer' });
    const ws = wb.Sheets['PEDIDO'];
    if (!ws) {
        throw new Error('Aba PEDIDO não encontrada no template');
    }

    const safeSet = (addr: string, value: any, numFmt?: string) => {
        if (value === null || value === undefined) return;
        if (!ws[addr]) ws[addr] = { t: 's', v: '' };
        if (ws[addr].f) return;
        
        if (typeof value === 'number') {
            ws[addr].t = 'n';
            ws[addr].v = value;
        } else if (value instanceof Date) {
            ws[addr].t = 'd';
            ws[addr].v = value;
            if (!ws[addr].z) ws[addr].z = 'dd/mm/yyyy';
        } else {
            ws[addr].t = 's';
            ws[addr].v = value.toString();
        }
        if (numFmt) ws[addr].z = numFmt;
    };

    console.log('✏️ Preenchendo template...');

    // Cabeçalho
    safeSet('N2', order.numero_pedido);
    safeSet('AA2', order.user_name);
    if (order.created_at) safeSet('AN2', new Date(order.created_at));

    safeSet('N3', order.marca);
    safeSet('AA3', order.representante);
    safeSet('AN3', order.telefone_representante || order.telefone);

    safeSet('N4', order.fornecedor);
    safeSet('AA4', order.email_representante || order.email);

    safeSet('N5', order.prazos?.[0] || 0);
    if (order.fat_inicio) safeSet('AA5', new Date(order.fat_inicio));
    if (order.fat_fim) safeSet('AH5', new Date(order.fat_fim));

    safeSet('Z6', parseFloat(order.desconto || 0) / 100, '0.00%');
    safeSet('AF6', parseFloat(order.markup || 0), '0.0');

    if (subOrders.length > 0 && subOrders[0].lojas_numeros?.length > 0) {
        safeSet('D23', subOrders[0].lojas_numeros[0]);
    }

    // Grades
    items.forEach(item => {
        if (!item.grades || !Array.isArray(item.grades) || item.grades.length === 0) return;
        const grade = item.grades[0];
        const gradeLetra = grade.letra;
        if (!gradeLetra || !GRADE_ROWS[gradeLetra]) return;
        
        const rowNum = GRADE_ROWS[gradeLetra];
        const tamanhos = grade.tamanhos || {};

        Object.entries(tamanhos).forEach(([tamanho, qtd]) => {
            if (TAMANHO_COLS[tamanho]) {
                const colIdx = TAMANHO_COLS[tamanho];
                const addr = XLSX.utils.encode_cell({ r: rowNum - 1, c: colIdx });
                safeSet(addr, Number(qtd));
            }
        });
    });

    // Itens
    items.forEach((item, index) => {
        const row = 36 + index;
        const gradeLetra = (item.grades && Array.isArray(item.grades) && item.grades.length > 0) 
            ? item.grades[0].letra 
            : '';

        safeSet(`C${row}`, item.referencia);
        safeSet(`H${row}`, item.tipo);
        safeSet(`R${row}`, item.cor1);
        safeSet(`U${row}`, item.modelo);
        safeSet(`X${row}`, gradeLetra);
        safeSet(`AL${row}`, parseFloat(item.custo || 0), '"R$" #,##0.00');
        safeSet(`AO${row}`, parseFloat(item.preco_venda || 0), '"R$" #,##0.00');
    });

    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}
