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

        // ✅ CORREÇÃO 1: PRAZOS E VENCIMENTOS - Cada prazo em sua coluna (N5, Q5, T5) e vencimentos (N6, Q6, T6)
        const prazosArray = Array.isArray(order.prazos) 
            ? order.prazos 
            : (order.prazos || '').toString().split(/[\/,;\s]+/).filter(Boolean);

        const vencimentosArray = Array.isArray(order.vencimentos) 
            ? order.vencimentos 
            : [];

        const PRAZO_COLS = ['N', 'Q', 'T']; 
        const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

        prazosArray.forEach((prazo: any, idx: number) => {
            if (idx < PRAZO_COLS.length) {
                const col = PRAZO_COLS[idx];
                // Preencher prazo (linha 5)
                sheet.cell(`${col}5`).value(Number(prazo) || 0);
                
                // Preencher vencimento (linha 6) no formato "mmm/aa"
                if (vencimentosArray[idx]) {
                    const vencDate = new Date(vencimentosArray[idx]);
                    const mes = MESES[vencDate.getMonth()];
                    const ano = vencDate.getFullYear().toString().slice(-2);
                    sheet.cell(`${col}6`).value(`${mes}/${ano}`);
                }
            }
        });
        
        if (order.fat_inicio) setVal('AA5', new Date(order.fat_inicio));
        if (order.fat_fim) setVal('AH5', new Date(order.fat_fim));

        // ✅ CORREÇÃO 2: LOJAS VINCULADAS POR SUB-PEDIDO
        // Cada sub-pedido (1 a 5) ocupa uma linha (23 a 27)
        // Cada loja do sub-pedido ocupa uma coluna a partir da D (coluna 4)
        const subOrders = order.buy_order_sub_orders || [];

        subOrders.forEach((subOrder: any, subIdx: number) => {
            // Linha do sub-pedido: 23 para pedido 1, 24 para pedido 2, etc.
            const rowNum = 23 + subIdx;
            
            // Máximo de 5 sub-pedidos (linhas 23-27)
            if (subIdx >= 5) return;
            
            // lojas_numeros é um array com os números das lojas
            const lojasArray = subOrder.lojas_numeros || [];
            
            if (Array.isArray(lojasArray)) {
                lojasArray.forEach((lojaNum: any, lojaIdx: number) => {
                    // Coluna D = 4, E = 5, F = 6, etc.
                    const colNum = 4 + lojaIdx;
                    
                    // Preencher número da loja
                    sheet.row(rowNum).cell(colNum).value(Number(lojaNum));
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
        const buffer = await workbook.outputAsync();

        return {
            buffer,
            numeroPedido: order.numero_pedido
        };

    } catch (err) {
        console.error('[Export] Erro fatal no serviço de exportação:', err);
        throw err;
    }
}