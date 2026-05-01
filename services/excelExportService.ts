import { createClient } from '@supabase/supabase-js';
import XlsxPopulate from 'xlsx-populate';
import fetch from 'node-fetch';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || '';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

/**
 * SERVIÇO DE EXPORTAÇÃO DE PEDIDO DE COMPRA (BACKEND)
 * 
 * Abordagem Escolhida: xlsx-populate
 * Por que: Esta biblioteca é superior ao ExcelJS para preenchimento de templates,
 * pois ela trabalha modificando o XML original sem tentar reconstruir todo o 
 * modelo de estilos do zero, preservando 100% das larguras de colunas, 
 * alturas de linhas, células mescladas e formatações complexas que o ExcelJS 
 * muitas vezes perde no ciclo load -> write.
 */
export async function exportBuyOrderToExcel(orderId: string) {
    console.log(`[Export] Iniciando exportação definitiva para ID: ${orderId}`);

    try {
        // 1. BUSCAR DADOS DO PEDIDO
        const { data: order, error } = await supabase
            .from('buy_orders')
            .select(`
                *,
                buy_order_items (*),
                buy_order_sub_orders (*)
            `)
            .eq('id', orderId)
            .single();

        if (error || !order) {
            console.error('[Export] Erro ao buscar pedido:', error);
            throw new Error('Pedido não encontrado no banco de dados.');
        }

        // 2. BAIXAR TEMPLATE DO SUPABASE STORAGE
        const TEMPLATE_URL = 'https://rwwomakjhmglgoowbmsl.supabase.co/storage/v1/object/public/template/buy_order_template.xlsx';
        console.log(`[Export] Baixando template: ${TEMPLATE_URL}`);
        
        const response = await fetch(TEMPLATE_URL);
        if (!response.ok) throw new Error(`Erro ao baixar template: ${response.statusText}`);
        
        const arrayBuffer = await response.arrayBuffer();

        // 3. CARREGAR WORKBOOK COM xlsx-populate
        // fromDataAsync aceita Buffers/ArrayBuffers no Node.js
        const workbook = await XlsxPopulate.fromDataAsync(Buffer.from(arrayBuffer));
        const sheet = workbook.sheet('PEDIDO');
        
        if (!sheet) {
            throw new Error('Aba "PEDIDO" não encontrada no template.');
        }

        console.log('[Export] Preenchendo cabeçalho...');

        // 4. PREENCHER CABEÇALHO
        // Usamos helpers para evitar erros de undefined
        const setVal = (cell: string, val: any) => {
            if (val !== undefined && val !== null) {
                sheet.cell(cell).value(val);
            }
        };

        setVal('N2', order.numero_pedido);
        setVal('AA2', (order.user_name || '').toUpperCase());
        
        // Datas: xlsx-populate lida bem com objetos Date
        if (order.created_at) setVal('AN2', new Date(order.created_at));

        setVal('N3', (order.marca || '').toUpperCase());
        setVal('AA3', (order.representante || '').toUpperCase());
        setVal('AN3', order.telefone_representante || order.telefone || '');

        setVal('N4', (order.fornecedor || '').toUpperCase());
        setVal('AA4', (order.email_representante || order.email || '').toLowerCase());

        // PRAZOS - Cada prazo em sua coluna (N5, Q5, T5)
        const prazosArray = Array.isArray(order.prazos) 
            ? order.prazos 
            : (order.prazos || '').toString().split(/[\/,;\s]+/).filter(Boolean);

        const PRAZO_COLS = ['N', 'Q', 'T']; 

        prazosArray.forEach((prazo: any, idx: number) => {
            if (idx < PRAZO_COLS.length) {
                const col = PRAZO_COLS[idx];
                sheet.cell(`${col}5`).value(Number(prazo) || 0);
            }
        });
        
        if (order.fat_inicio) setVal('AA5', new Date(order.fat_inicio));
        if (order.fat_fim) setVal('AH5', new Date(order.fat_fim));

        // 4.1 LOJAS VINCULADAS (Sub-pedidos) - Linha 23
        const subOrders = order.buy_order_sub_orders || [];
        const LOJA_START_COL = 4; // D = coluna 4

        subOrders.forEach((subOrder: any, idx: number) => {
            const colIdx = LOJA_START_COL + idx;
            
            if (subOrder.loja_id) {
                sheet.row(23).cell(colIdx).value(subOrder.loja_id);
            }
            
            if (subOrder.lojas_numeros && Array.isArray(subOrder.lojas_numeros)) {
                subOrder.lojas_numeros.forEach((loja: any, lojaIdx: number) => {
                    const col = colIdx + lojaIdx;
                    sheet.row(23).cell(col).value(Number(loja));
                });
            }
        });

        // Números
        sheet.cell('Z6').value(Number(order.desconto || 0) / 100);
        sheet.cell('AF6').value(Number(order.markup || 0));

        // 5. PREENCHER ITENS (A partir da linha 36)
        console.log('[Export] Preenchendo itens...');
        const items = order.buy_order_items || [];
        const START_ROW = 36;

        items.forEach((item: any, idx: number) => {
            const row = START_ROW + idx;
            // Limite de segurança do template (exemplo: 500 linhas)
            if (row > 500) return;

            sheet.cell(`C${row}`).value((item.referencia || '').toUpperCase());
            sheet.cell(`H${row}`).value((item.tipo || '').toUpperCase());
            sheet.cell(`R${row}`).value((item.cor1 || '').toUpperCase());
            sheet.cell(`U${row}`).value((item.modelo || item.tipo_footwear || '').toUpperCase());
            
            // Custo e Preço Venda
            sheet.cell(`AL${row}`).value(Number(item.custo || 0));
            sheet.cell(`AO${row}`).value(Number(item.preco_venda || 0));

            // Letra da Grade (Coluna X)
            const grades = item.grades || [];
            if (Array.isArray(grades) && grades.length > 0) {
                sheet.cell(`X${row}`).value(grades[0].letra || '');
            }
        });

        // 6. PREENCHER TABELA DE GRADES (Linhas 14-20)
        console.log('[Export] Preenchendo tabela de grades...');
        const GRADE_MAP: Record<string, number> = { 
            A: 14, B: 15, C: 16, D: 17, E: 18, F: 19, G: 20 
        };
        
        const COL_MAP: Record<string, number> = {
            '20': 12, '21': 13, '22': 14, '23': 15, '24': 16, '25': 17, 
            '26': 18, '27': 19, '28': 20, '29': 21, '30': 22, '31': 23, 
            '32': 24, '33': 25, '34': 26, '35': 27, '36': 28, '37': 29, 
            '38': 30, '39': 31, '40': 32, '41': 33, '42': 34, '43': 35, '44': 36
        };

        // Consolidação ou individuais? 
        // A lógica do usuário pede para preencher a tabela de grades baseada nos itens.
        // Geralmente cada letra representa uma grade fixa.
        items.forEach((item: any) => {
            const gradesArray = item.grades || [];
            if (!Array.isArray(gradesArray)) return;

            gradesArray.forEach((gradeObj: any) => {
                const letra = gradeObj.letra;
                const tamanhos = gradeObj.tamanhos || {};
                
                const rowNum = GRADE_MAP[letra];
                if (!rowNum) return;

                Object.entries(tamanhos).forEach(([tamanho, qtd]: any) => {
                    const colNum = COL_MAP[tamanho];
                    if (!colNum) return;

                    // xlsx-populate usa row, col (1-based) ou endereço A1
                    sheet.row(rowNum).cell(colNum).value(Number(qtd));
                });
            });
        });

        // 7. ATUALIZAR TIMESTAMP DE EXPORTAÇÃO NO BANCO
        await supabase
            .from('buy_orders')
            .update({ exported_at: new Date().toISOString() })
            .eq('id', orderId);

        // 8. GERAR O BUFFER DE SAÍDA
        console.log('[Export] Gerando buffer de saída...');
        return await workbook.outputAsync();

    } catch (err) {
        console.error('[Export] Erro fatal no serviço de exportação:', err);
        throw err;
    }
}
