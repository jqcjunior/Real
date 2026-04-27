import { createClient } from '@supabase/supabase-js';
import ExcelJS from 'exceljs';
import path from 'path';
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
const TAMANHO_COLS: Record<string, string> = {
    '20': 'M', '21': 'N', '22': 'O', '23': 'P', '24': 'Q', '25': 'R', '26': 'S', '27': 'T',
    '28': 'U', '29': 'V', '30': 'W', '31': 'X', '32': 'Y', '33': 'Z', '34': 'AA', '35': 'AB'
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
    // Nota: Ajustamos o caminho para a estrutura do projeto
    const templatePath = path.join(process.cwd(), 'templates', 'Template.xlsx');
    
    // Fallback para o template antigo se o novo não existir
    const altTemplatePath = path.join(process.cwd(), 'public', 'templates', 'buy_order_template.xlsx');
    
    let finalTemplatePath = templatePath;
    const fs = await import('fs');
    if (!fs.existsSync(templatePath) && fs.existsSync(altTemplatePath)) {
        finalTemplatePath = altTemplatePath;
    }

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(finalTemplatePath);

    const worksheet = workbook.getWorksheet('PEDIDO');
    if (!worksheet) {
        throw new Error('Aba PEDIDO não encontrada no template');
    }

    console.log('✏️ Preenchendo template...');

    // ========================================
    // CABEÇALHO - Linha 2
    // ========================================
    worksheet.getCell('N2').value = order.numero_pedido;
    worksheet.getCell('AA2').value = order.user_name;
    worksheet.getCell('AN2').value = order.created_at ? new Date(order.created_at) : '';

    // ========================================
    // CABEÇALHO - Linha 3
    // ========================================
    worksheet.getCell('N3').value = order.marca;
    worksheet.getCell('AA3').value = order.representante;
    worksheet.getCell('AN3').value = order.telefone_representante || order.telefone;

    // ========================================
    // CABEÇALHO - Linha 4
    // ========================================
    worksheet.getCell('N4').value = order.fornecedor;
    worksheet.getCell('AA4').value = order.email_representante || order.email;

    // ========================================
    // CABEÇALHO - Linha 5
    // ========================================
    worksheet.getCell('N5').value = order.prazos?.[0] || 0;
    worksheet.getCell('AA5').value = order.fat_inicio ? new Date(order.fat_inicio) : '';
    worksheet.getCell('AH5').value = order.fat_fim ? new Date(order.fat_fim) : '';

    // ========================================
    // CABEÇALHO - Linha 6
    // ========================================
    // Z6 mantém a porcentagem
    worksheet.getCell('Z6').value = parseFloat(order.desconto || 0) / 100;
    worksheet.getCell('AF6').value = parseFloat(order.markup || 0);

    // ========================================
    // LOJA - D23 (primeiro sub-pedido)
    // ========================================
    if (subOrders.length > 0 && subOrders[0].lojas_numeros?.length > 0) {
        worksheet.getCell('D23').value = subOrders[0].lojas_numeros[0];
    }

    // ========================================
    // GRADES - Linhas 14-21
    // ========================================
    console.log('📊 Preenchendo grades...');
    items.forEach(item => {
        if (!item.grades || !Array.isArray(item.grades) || item.grades.length === 0) return;

        const grade = item.grades[0]; // Primeira grade do item
        const gradeLetra = grade.letra;
        
        if (!gradeLetra || !GRADE_ROWS[gradeLetra]) return;
        
        const row = GRADE_ROWS[gradeLetra];
        const tamanhos = grade.tamanhos || {};

        Object.entries(tamanhos).forEach(([tamanho, qtd]) => {
            if (TAMANHO_COLS[tamanho]) {
                const col = TAMANHO_COLS[tamanho];
                worksheet.getCell(`${col}${row}`).value = Number(qtd);
            }
        });
    });

    // ========================================
    // ITENS - Linhas 36+ (DINÂMICO)
    // ========================================
    console.log(`🛍️ Preenchendo ${items.length} itens...`);
    const BASE_ROW = 36;
    
    items.forEach((item, index) => {
        const row = BASE_ROW + index;
        const gradeLetra = (item.grades && Array.isArray(item.grades) && item.grades.length > 0) 
            ? item.grades[0].letra 
            : '';

        worksheet.getCell(`C${row}`).value = item.referencia;
        worksheet.getCell(`H${row}`).value = item.tipo;
        worksheet.getCell(`R${row}`).value = item.cor1;
        worksheet.getCell(`U${row}`).value = item.modelo;
        worksheet.getCell(`X${row}`).value = gradeLetra;
        worksheet.getCell(`AL${row}`).value = parseFloat(item.custo || 0);
        worksheet.getCell(`AO${row}`).value = parseFloat(item.preco_venda || 0);
        
        console.log(`   ✓ Linha ${row}: ${item.referencia} - R$ ${item.custo} / R$ ${item.preco_venda}`);
    });

    console.log(`✅ Template preenchido com ${items.length} itens!`);

    // Gerar buffer
    const buffer = await workbook.xlsx.writeBuffer();
    return buffer as Buffer;
}
