/**
 * buyOrderItems.utils.ts
 * 
 * Utilitários de produção para operações em buy_order_items.
 * Resolve todos os erros 400 identificados:
 *  - grades enviado como objeto ao invés de array
 *  - coluna "ref" inexistente (deve ser "referencia")
 *  - valores null/undefined/NaN em campos NOT NULL
 *  - modelo fora do enum aceito pelo banco
 *  - preco_venda ou custo <= 0
 *  - item_order < 1
 */
 
import { supabase } from '../services/supabaseClient';
 
// ─────────────────────────────────────────────
// TIPOS
// ─────────────────────────────────────────────
 
export type ModeloValido = 'MASC' | 'FEM' | 'INF' | 'ACES';
 
export interface GradeItem {
  letra: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H';
  tamanhos: Record<string, number>;
}
 
export interface BuyOrderItemInput {
  order_id: string;
  item_order: number;
  referencia: string;
  tipo: string;
  cor1: string;
  cor2?: string | null;
  cor3?: string | null;
  modelo: ModeloValido;
  custo: number;
  preco_venda: number;
  grades: GradeItem[] | Record<string, any>;
  total_pares?: number;
  markup_aplicado?: number | null;
}
 
export interface BuyOrderItemRow {
  order_id: string;
  item_order: number;
  referencia: string;
  tipo: string;
  cor1: string;
  cor2: string | null;
  cor3: string | null;
  modelo: ModeloValido;
  custo: number;
  preco_venda: number;
  grades: GradeItem[];
  total_pares: number;
  markup_aplicado: number | null;
}
 
// ─────────────────────────────────────────────
// CONVERSÃO DE GRADES
// ─────────────────────────────────────────────
 
/**
 * Converte qualquer formato de grades para o array exigido pelo banco.
 * 
 * Banco exige:  [{"letra": "A", "tamanhos": {"33": 1, "34": 2}}]
 * Frontend pode enviar: {"A": {"33": 1, "34": 2}} → converte automaticamente
 */
export function normalizeGrades(grades: any): GradeItem[] {
  if (!grades) return [];
 
  // Já é array no formato correto
  if (Array.isArray(grades)) {
    return grades
      .filter(g => g && typeof g === 'object' && g.letra && g.tamanhos)
      .map(g => ({
        letra: String(g.letra).toUpperCase() as GradeItem['letra'],
        tamanhos: normalizeTamanhos(g.tamanhos),
      }));
  }
 
  // É objeto: {"A": {"33": 1, "34": 2}, "B": {"35": 1}}
  if (typeof grades === 'object') {
    return Object.entries(grades)
      .filter(([letra]) => /^[A-H]$/.test(letra))
      .map(([letra, tamanhos]) => ({
        letra: letra as GradeItem['letra'],
        tamanhos: normalizeTamanhos(tamanhos as any),
      }));
  }
 
  return [];
}
 
/**
 * Garante que tamanhos só tem valores numéricos inteiros positivos.
 */
function normalizeTamanhos(tamanhos: any): Record<string, number> {
  if (!tamanhos || typeof tamanhos !== 'object') return {};
 
  return Object.fromEntries(
    Object.entries(tamanhos)
      .map(([k, v]) => [k, Math.max(0, parseInt(String(v), 10) || 0)])
      .filter(([, v]) => (v as number) > 0)
  );
}
 
// ─────────────────────────────────────────────
// SANITIZADOR DE DADOS
// ─────────────────────────────────────────────
 
const MODELOS_VALIDOS: ModeloValido[] = ['MASC', 'FEM', 'INF', 'ACES'];
 
/**
 * Sanitiza e valida um item antes de enviar ao banco.
 * Lança erro descritivo se algo estiver inválido.
 */
export function sanitizeItem(input: BuyOrderItemInput): BuyOrderItemRow {
  const errors: string[] = [];
 
  // order_id
  if (!input.order_id || typeof input.order_id !== 'string') {
    errors.push('order_id é obrigatório');
  }
 
  // item_order (CHECK: item_order >= 1)
  const item_order = parseInt(String(input.item_order), 10);
  if (isNaN(item_order) || item_order < 1) {
    errors.push(`item_order inválido: "${input.item_order}" (mínimo: 1)`);
  }
 
  // referencia (NOT NULL, NOT EMPTY)
  const referencia = String(input.referencia || '').trim();
  if (!referencia) {
    errors.push('referencia é obrigatória');
  }
 
  // tipo (NOT NULL)
  const tipo = String(input.tipo || '').trim();
  if (!tipo) {
    errors.push('tipo é obrigatório');
  }
 
  // cor1 (NOT NULL)
  const cor1 = String(input.cor1 || '').trim();
  if (!cor1) {
    errors.push('cor1 é obrigatória');
  }
 
  // modelo (CHECK: MASC | FEM | INF | ACES)
  const modelo = String(input.modelo || '').trim().toUpperCase() as ModeloValido;
  if (!MODELOS_VALIDOS.includes(modelo)) {
    errors.push(`modelo inválido: "${input.modelo}" (aceitos: ${MODELOS_VALIDOS.join(', ')})`);
  }
 
  // custo (CHECK: custo > 0)
  const custo = parseFloat(String(input.custo));
  if (isNaN(custo) || custo <= 0) {
    errors.push(`custo inválido: "${input.custo}" (deve ser > 0)`);
  }
 
  // preco_venda (CHECK: preco_venda > 0)
  const preco_venda = parseFloat(String(input.preco_venda));
  if (isNaN(preco_venda) || preco_venda <= 0) {
    errors.push(`preco_venda inválido: "${input.preco_venda}" (deve ser > 0)`);
  }
 
  // grades (CHECK: fn_validate_purchase_item_grades)
  const grades = normalizeGrades(input.grades);
  if (grades.length === 0) {
    errors.push('grades não pode ser vazio');
  }
  if (grades.length > 8) {
    errors.push(`grades excede máximo de 8 (enviado: ${grades.length})`);
  }
  const letrasUsadas = new Set<string>();
  for (const g of grades) {
    if (letrasUsadas.has(g.letra)) {
      errors.push(`grade duplicada: "${g.letra}"`);
    }
    letrasUsadas.add(g.letra);
    if (Object.keys(g.tamanhos).length === 0) {
      errors.push(`grade "${g.letra}" sem tamanhos`);
    }
  }
 
  if (errors.length > 0) {
    throw new Error(`Validação falhou para item "${referencia}":\n• ${errors.join('\n• ')}`);
  }
 
  return {
    order_id: input.order_id,
    item_order,
    referencia,
    tipo,
    cor1,
    cor2: input.cor2 ? String(input.cor2).trim() || null : null,
    cor3: input.cor3 ? String(input.cor3).trim() || null : null,
    modelo,
    custo: Math.round(custo * 100) / 100,
    preco_venda: Math.round(preco_venda * 100) / 100,
    grades,
    total_pares: parseInt(String(input.total_pares || 0), 10) || 0,
    markup_aplicado: input.markup_aplicado != null
      ? parseFloat(String(input.markup_aplicado)) || null
      : null,
  };
}
 
// ─────────────────────────────────────────────
// INSERT ROBUSTO
// ─────────────────────────────────────────────
 
export interface InsertResult {
  success: boolean;
  data?: { id: string; item_order: number }[];
  errors?: { item: number; referencia: string; message: string }[];
}
 
/**
 * Insere múltiplos itens com validação completa.
 * Não envia NADA ao banco se qualquer item for inválido.
 */
export async function insertBuyOrderItems(
  inputs: BuyOrderItemInput[]
): Promise<InsertResult> {
  if (!inputs || inputs.length === 0) {
    return { success: false, errors: [{ item: 0, referencia: '', message: 'Nenhum item para inserir' }] };
  }
 
  // 1. Sanitizar TODOS antes de enviar qualquer um
  const sanitized: BuyOrderItemRow[] = [];
  const validationErrors: InsertResult['errors'] = [];
 
  for (let i = 0; i < inputs.length; i++) {
    try {
      sanitized.push(sanitizeItem(inputs[i]));
    } catch (err: any) {
      validationErrors.push({
        item: i + 1,
        referencia: String(inputs[i]?.referencia || ''),
        message: err.message,
      });
    }
  }
 
  if (validationErrors && validationErrors.length > 0) {
    console.error('❌ Erros de validação:', validationErrors);
    return { success: false, errors: validationErrors };
  }
 
  // 2. Log do payload real antes de enviar
  console.log('📦 INSERT buy_order_items payload:', JSON.stringify(sanitized, null, 2));
 
  // 3. Enviar ao banco
  const { data, error } = await supabase
    .from('buy_order_items')
    .insert(sanitized)
    .select('id, item_order');
 
  if (error) {
    console.error('❌ Erro Supabase:', error);
    return {
      success: false,
      errors: [{ item: 0, referencia: '', message: error.message }],
    };
  }
 
  console.log('✅ Itens inseridos:', data);
  return { success: true, data: data as any };
}
 
// ─────────────────────────────────────────────
// GET SEGURO (sem erros de coluna "ref")
// ─────────────────────────────────────────────
 
/**
 * Busca preço de venda anterior de uma referência.
 * Usa coluna correta "referencia" (não "ref").
 * Só executa se referencia tiver pelo menos 5 caracteres.
 */
export async function fetchPreviousPrice(referencia: string): Promise<number | null> {
  // Guard: não buscar com string parcial ou vazia
  const ref = String(referencia || '').trim();
  if (ref.length < 5) return null;
  if (ref.endsWith('-') || ref.endsWith(' ')) return null;
 
  const { data, error } = await supabase
    .from('buy_order_items')
    .select('preco_venda')
    .eq('referencia', ref)           // ← coluna correta: "referencia"
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
 
  if (error) {
    console.warn(`⚠️ Erro ao buscar preço anterior para "${ref}":`, error.message);
    return null;
  }
 
  return data?.preco_venda ?? null;
}
 
// ─────────────────────────────────────────────
// HELPER: Mapear tipo do frontend para modelo do banco
// ─────────────────────────────────────────────
 
/**
 * Converte tipo legível para código aceito pelo banco.
 * 
 * banco aceita: MASC | FEM | INF | ACES
 */
export function tipoParaModelo(tipo: string): ModeloValido {
  const t = String(tipo || '').toUpperCase().trim();
 
  if (t.includes('MASC') || t.includes('MASCULIN')) return 'MASC';
  if (t.includes('FEM') || t.includes('FEMININ'))   return 'FEM';
  if (t.includes('INF') || t.includes('INFANT'))    return 'INF';
  if (t.includes('ACES') || t.includes('ACESS'))    return 'ACES';
 
  // Infantil feminino/masculino → INF
  if (t.includes('INFANT')) return 'INF';
 
  throw new Error(`Não foi possível mapear tipo "${tipo}" para modelo válido (MASC|FEM|INF|ACES)`);
}
