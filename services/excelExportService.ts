import { createClient } from '@supabase/supabase-js';
import XlsxPopulate from 'xlsx-populate';
import fetch from 'node-fetch';

const supabaseUrl = process.env.SUPABASE_URL ?? '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY ?? '';

const supabase = createClient(supabaseUrl || 'https://placeholder.supabase.co', supabaseServiceKey || 'placeholder');

function buildExportFilename(
  numeroPedido: number,
  marca: string,
  exportCount: number
): string {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const dateStr = `${yy}${mm}${dd}`;

  const slug = marca
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '');

  return `Ped_${numeroPedido}_${slug}_${dateStr}-${exportCount}`;
}

/**
 * SERVIÇO DE EXPORTAÇÃO DE PEDIDO DE COMPRA (BACKEND)
 * 
 * Versão Corrigida - 02/05/2026
 * Correções aplicadas:
 * ✅ 1. Prazos separados em colunas distintas (N5, Q5, T5)
 * ✅ 2. Vencimentos calculados (N6, Q6, T6)
 * ✅ 3. Número da loja preenchido (D23) para pedidos de gerente
 * ✅ 4. Quantidades das grades consolidadas na coluna D (UN)
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

        // 1.1 INCREMENTAR CONTADOR DE EXPORTAÇÃO
        const { data: exportInfo, error: exportError } = await supabase
            .from('buy_orders')
            .update({ export_count: (order.export_count || 0) + 1 })
            .eq('id', orderId)
            .select('export_count, numero_pedido, marca')
            .single();

        if (exportError || !exportInfo) {
            console.error('[Export] Erro ao registrar exportação:', exportError);
            throw new Error('Falha ao registrar exportação: ' + exportError?.message);
        }

        const exportFilename = buildExportFilename(
            exportInfo.numero_pedido,
            exportInfo.marca,
            exportInfo.export_count
        );

        // 2. BAIXAR TEMPLATE DO SUPABASE STORAGE
        const TEMPLATE_URL = 'https://rwwomakjhmglgoowbmsl.supabase.co/storage/v1/object/public/template/buy_order_template.xlsx';
        console.log(`[Export] Baixando template: ${TEMPLATE_URL}`);
        
        const response = await fetch(TEMPLATE_URL);
        if (!response.ok) throw new Error(`Erro ao baixar template: ${response.statusText}`);
        
        const arrayBuffer = await response.arrayBuffer();

        // 3. CARREGAR WORKBOOK COM xlsx-populate
        const workbook = await XlsxPopulate.fromDataAsync(Buffer.from(arrayBuffer));
        const sheet = workbook.sheet('PEDIDO');
        
        if (!sheet) {
            throw new Error('Aba "PEDIDO" não encontrada no template.');
        }

        console.log('[Export] Preenchendo cabeçalho...');

        // 4. PREENCHER CABEÇALHO
        const setVal = (cell: string, val: any) => {
            if (val !== undefined && val !== null) {
                sheet.cell(cell).value(val);
            }
        };

        setVal('N2', order.numero_pedido);
        setVal('AA2', (order.user_name || '').toUpperCase());
        
        if (order.created_at) setVal('AN2', new Date(order.created_at));

        setVal('N3', (order.marca || '').toUpperCase());
        setVal('AA3', (order.representante || '').toUpperCase());
        setVal('AN3', order.telefone_representante || order.telefone || '');

        setVal('N4', (order.fornecedor || '').toUpperCase());
        setVal('AA4', (order.email_representante || order.email || '').toLowerCase());

        // Observações na célula mesclada B11:AQ11
        if (order.observacoes) {
          setVal('B11', order.observacoes);
        }

        // ✅ CORREÇÃO 1: PRAZOS E VENCIMENTOS SEPARADOS
        const prazosArray = Array.isArray(order.prazos) 
            ? order.prazos 
            : (order.prazos || '').toString().split(/[\/,;\s]+/).filter(Boolean);

        const vencimentosArray = Array.isArray(order.vencimentos) 
            ? order.vencimentos 
            : [];

        const PRAZO_COLS = ['N', 'Q', 'T']; 
        const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

        // Preencher prazos (linha 5)
        prazosArray.forEach((prazo: any, idx: number) => {
            if (idx < PRAZO_COLS.length) {
                const col = PRAZO_COLS[idx];
                setVal(`${col}5`, Number(prazo) || 0);
            }
        });

        // Preencher vencimentos (linha 6)
        vencimentosArray.forEach((vencimento: any, idx: number) => {
            if (idx < PRAZO_COLS.length) {
                const col = PRAZO_COLS[idx];
                const vencDate = new Date(vencimento);
                const mes = MESES[vencDate.getMonth()];
                const ano = vencDate.getFullYear().toString().slice(-2);
                setVal(`${col}6`, `${mes}/${ano}`);
            }
        });
        
        if (order.fat_inicio) setVal('AA5', new Date(order.fat_inicio));
        if (order.fat_fim) setVal('AH5', new Date(order.fat_fim));

        // ✅ CORREÇÃO 2: LOJAS VINCULADAS POR SUB-PEDIDO (com fallback para gerente)
        const subOrders = order.buy_order_sub_orders || [];

        if (subOrders && subOrders.length > 0) {
            // Pedido de ADMIN com múltiplas lojas
            subOrders.forEach((subOrder: any, subIdx: number) => {
                const rowNum = 23 + subIdx;
                
                if (subIdx >= 5) return;
                
                const lojasArray = subOrder.lojas_numeros || [];
                
                if (Array.isArray(lojasArray)) {
                    lojasArray.forEach((lojaNum: any, lojaIdx: number) => {
                        const colNum = 4 + lojaIdx;
                        sheet.row(rowNum).cell(colNum).value(Number(lojaNum));
                    });
                }
            });
        } else {
            // ✅ Pedido de GERENTE - preencher apenas D23
            const lojaId = order.loja_id || order.store_id;
            if (lojaId) {
                const { data: loja } = await supabase
                    .from('stores')
                    .select('store_number')
                    .eq('id', lojaId)
                    .single();
                
                if (loja && loja.store_number) {
                    setVal('D23', Number(loja.store_number));
                }
            }
        }

        // Números
        sheet.cell('Z6').value(Number(order.desconto || 0) / 100);
        sheet.cell('AF6').value(Number(order.markup || 0));

        // 5. ✅ PREENCHER TABELA DE GRADES
        console.log('[Export] Preenchendo tabela de grades...');

        const GRADE_MAP: Record<string, number> = { 
            A: 14, B: 15, C: 16, D: 17, E: 18, F: 19, G: 20, H: 21
        };

        // Mapeamento completo: tamanho → índice de coluna no xlsx-populate
        const COL_MAP: Record<string, number> = {
            // ACESSÓRIOS (D-H)
            'UN': 4, 'P': 5, 'M': 6, 'G': 7, 'GG': 8,
            
            // CALÇADOS NUMÉRICOS (I-AO: tamanhos 16-48)
            '16': 9,  '17': 10, '18': 11, '19': 12, '20': 13,
            '21': 14, '22': 15, '23': 16, '24': 17, '25': 18,
            '26': 19, '27': 20, '28': 21, '29': 22, '30': 23,
            '31': 24, '32': 25, '33': 26, '34': 27, '35': 28,
            '36': 29, '37': 30, '38': 31, '39': 32, '40': 33,
            '41': 34, '42': 35, '43': 36, '44': 37, '45': 38,
            '46': 39, '47': 40, '48': 41
        };

        // Consolidar grades únicas — 1 template por letra, prioridade MASC > FEM > INF
        const items = order.buy_order_items || [];

        const _getCat = (tipo: string, modelo: string): number => {
            const t = (tipo || '').toUpperCase();
            const m = (modelo || '').toUpperCase();
            if (t.includes('INFANT') || m === 'INFANTIL') return 2;
            if (t.includes('FEMININ') || m === 'FEMININO') return 1;
            return 0;
        };

        const sortedItems = [...items].sort((a: any, b: any) =>
            _getCat(a.tipo || '', a.modelo || '') - _getCat(b.tipo || '', b.modelo || '')
        );

        const gradesUnicas: Record<string, Record<string, number>> = {};

        sortedItems.forEach((item: any) => {
            const gradesArray = item.grades || [];
            if (!Array.isArray(gradesArray)) return;

            gradesArray.forEach((gradeObj: any) => {
                const letra = gradeObj.letra;
                if (!letra || !GRADE_MAP[letra]) return;
                if (gradesUnicas[letra]) return; // já tem template para esta letra — pula

                const tamanhos: Record<string, number> = {};
                Object.entries(gradeObj.tamanhos || {}).forEach(([sz, qty]: any) => {
                    const q = Number(qty) || 0;
                    if (q > 0) tamanhos[sz] = q;
                });
                if (Object.keys(tamanhos).length > 0) {
                    gradesUnicas[letra] = tamanhos;
                }
            });
        });

        // Preencher quantidades no Excel (SEM modificar layout)
        Object.entries(gradesUnicas).forEach(([letra, tamanhos]) => {
            const rowNum = GRADE_MAP[letra];
            if (!rowNum) return;
            
            Object.entries(tamanhos).forEach(([tamanho, qtd]: any) => {
                const colNum = COL_MAP[tamanho];
                const qtdNum = Number(qtd) || 0;
                
                if (colNum && qtdNum > 0) {
                    sheet.row(rowNum).cell(colNum).value(qtdNum);
                }
            });
        });

        console.log('[Export] Tabela de grades finalizada.');

        // 6. BUSCAR GRADES POR SUB-PEDIDO
        console.log('[Export] Buscando grades por sub-pedido...');

        const { data: gradesSubOrders } = await supabase
            .from('buy_order_item_suborder_grades')
            .select('item_id, grade_letra, sub_order_num')
            .in('item_id', items.map((i: any) => i.id));

        // Mapa: item_id → Map<sub_order_num, { letra, pares }>
        // pares = calculado da grade específica, não o total do item
        const itemGradeMap = new Map<string, Map<number, { letra: string; pares: number }>>();

        (gradesSubOrders || []).forEach((g: any) => {
            if (!itemGradeMap.has(g.item_id)) {
                itemGradeMap.set(g.item_id, new Map());
            }
            // Guardar apenas a primeira ocorrência por sub_order_num
            if (!itemGradeMap.get(g.item_id)!.has(g.sub_order_num)) {
                // ✅ Calcular pares APENAS desta grade específica
                const item = items.find((i: any) => i.id === g.item_id);
                const gradeObj = (item?.grades || []).find((gr: any) => gr.letra === g.grade_letra);
                const paresGrade = gradeObj
                    ? Object.values(gradeObj.tamanhos as Record<string, number>)
                        .reduce((s: number, v: any) => s + Number(v || 0), 0)
                    : 0;

                itemGradeMap.get(g.item_id)!.set(g.sub_order_num, {
                    letra: g.grade_letra,
                    pares: paresGrade
                });
            }
        });

        // Colunas do template por sub-pedido (confirmadas no template xlsx):
        // sub 1 → pares col23, grade col24, valor col45
        // sub 2 → pares col26, grade col27, valor col46
        // sub 3 → pares col29, grade col30, valor col47
        // sub 4 → pares col32, grade col33, valor col48
        // sub 5 → pares col35, grade col36, valor col49
        const SUB_ORDER_COLS: Record<number, { pares: number; grade: number }> = {
            1: { pares: 23, grade: 24 },
            2: { pares: 26, grade: 27 },
            3: { pares: 29, grade: 30 },
            4: { pares: 32, grade: 33 },
            5: { pares: 35, grade: 36 },
        };

        // Mapeamento modelo: INF→INFANTIL, MASC→MASCULINO, FEM→FEMININO, ACES→ACESSÓRIO
        const MODELO_MAP: Record<string, string> = {
            'INF': 'INFANTIL',
            'MASC': 'MASCULINO',
            'FEM': 'FEMININO',
            'ACES': 'ACESSÓRIO',
        };

        // Mapear sub_order_num → posição 1-based (para evitar shift quando não há sub_order 1)
        const sortedSubOrders = [...subOrders].sort((a: any, b: any) => a.sub_order_num - b.sub_order_num);
        const subNumToPosition = new Map<number, number>();
        sortedSubOrders.forEach((sub: any, idx: number) => {
            subNumToPosition.set(sub.sub_order_num, idx + 1);
        });

        // 6. PREENCHER ITENS (A partir da linha 36)
        console.log('[Export] Preenchendo itens...');
        const START_ROW = 36;

        items.forEach((item: any, idx: number) => {
            const row = START_ROW + idx;
            if (row > 500) return;

            // Dados básicos do item
            const modelo = item.modelo ? (MODELO_MAP[item.modelo.toUpperCase()] || item.modelo.toUpperCase()) : '';

            sheet.row(row).cell(3).value((item.referencia || '').toUpperCase());   // col3 = REFERÊNCIA
            sheet.row(row).cell(8).value((item.tipo || '').toUpperCase());          // col8 = TIPO
            sheet.row(row).cell(18).value((item.cor1 || '').toUpperCase());         // col18 = COR 1
            sheet.row(row).cell(19).value((item.cor2 || '').toUpperCase());         // col19 = COR 2
            sheet.row(row).cell(20).value((item.cor3 || '').toUpperCase());         // col20 = COR 3
            sheet.row(row).cell(21).value(modelo);                                  // col21 = MODELO
            sheet.row(row).cell(38).value(Number(item.custo || 0));                 // col38 = CUSTO
            sheet.row(row).cell(41).value(Number(item.preco_venda || 0));           // col41 = VENDA

            // Preencher pares e grade por sub-pedido
            const gradesPorSub = itemGradeMap.get(item.id);
            if (gradesPorSub) {
                gradesPorSub.forEach((gradeInfo, subNum) => {
                    const position = subNumToPosition.get(subNum);
                    if (!position) return;
                    const cols = SUB_ORDER_COLS[position];
                    if (!cols) return;
                    sheet.row(row).cell(cols.pares).value(gradeInfo.pares);
                    sheet.row(row).cell(cols.grade).value(gradeInfo.letra);
                });
            }
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
            filename: exportFilename
        };
    } catch (err) {
        console.error('[Export] Erro fatal no serviço de exportação:', err);
        throw err;
    }
}