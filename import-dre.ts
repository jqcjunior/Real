
import * as XLSX from 'xlsx';
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

// Configuração Supabase (Dados colhidos do projeto)
const supabaseUrl = 'https://rwwomakjhmglgoowbmsl.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ3d29tYWtqaG1nbGdvb3dibXNsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU5NzM3NzUsImV4cCI6MjA4MTU0OTc3NX0.f-FbwrnnlUFermnqLUyPHpT-EoUEc1dzXTlV4cXyQ28';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  console.log('🚀 Iniciando Script de Importação DRE...');

  const fileName = 'Total_2025.xlsx';

  if (!fs.existsSync(fileName)) {
    console.error(`❌ ERRO: Arquivo ${fileName} NÃO ENCONTRADO na raiz do projeto.`);
    console.log('Por favor, faça o upload do arquivo usando o botão de "+" no explorador de arquivos à esquerda.');
    return;
  }

  console.log(`📖 Lendo arquivo ${fileName}...`);
  const workbook = XLSX.readFile(fileName, { cellDates: true });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

  console.log(`📊 Total de linhas detectadas: ${rawData.length}`);

  // 1. Extrair meses do cabeçalho (Linha 1, Colunas E a P -> índices 4 a 15)
  const headerRow = rawData[0];
  const mesesDatas: string[] = [];
  
  for (let col = 4; col <= 15; col++) {
    const cellValue = headerRow[col];
    if (cellValue) {
        if (cellValue instanceof Date) {
            mesesDatas.push(cellValue.toISOString().split('T')[0]);
        } else if (typeof cellValue === 'number') {
            // Excel Serial Date to ISO
            const date = new Date((cellValue - 25569) * 86400 * 1000);
            mesesDatas.push(date.toISOString().split('T')[0]);
        } else {
            // Tentar parse manual ou string
            const date = new Date(cellValue);
            if (!isNaN(date.getTime())) {
                mesesDatas.push(date.toISOString().split('T')[0]);
            }
        }
    }
  }

  if (mesesDatas.length === 0) {
      console.error('❌ ERRO: Nenhum mês detectado no cabeçalho (Coluna E em diante).');
      return;
  }

  console.log(`📅 Meses detectados (${mesesDatas.length}): ${mesesDatas.join(', ')}`);

  // 2. Processar dados
  const recordsToInsert: any[] = [];
  let descAtual: string | null = null;
  const lojasDetectadas = new Set<number>();

  for (let i = 1; i < rawData.length; i++) {
    const row = rawData[i];
    if (!row || row.length < 4) continue;

    const grupo = row[1]; // Coluna B
    const desc = row[2];  // Coluna C
    const lojaVal = row[3];  // Coluna D (Lj)

    if (desc && String(desc).trim() !== '' && String(desc).toLowerCase() !== 'null') {
      descAtual = String(desc).trim();
    }

    // Se não tem descrição acumulada ou a coluna de loja é total/nulo, pula
    if (!descAtual || !lojaVal || ['tot', 'total', 'total rede'].includes(String(lojaVal).toLowerCase().trim())) {
      continue;
    }

    const lojaId = parseInt(String(lojaVal).replace(/\D/g, ''), 10);
    if (isNaN(lojaId) || lojaId === 999) continue;
    
    lojasDetectadas.add(lojaId);

    // Mapear cada mês da linha para um registro
    for (let j = 0; j < mesesDatas.length; j++) {
      const colIndex = 4 + j; // Inicia em E
      const val = row[colIndex];
      const valor = typeof val === 'number' ? val : 0.0;
      
      recordsToInsert.push({
        loja_id: lojaId,
        mes_referencia: mesesDatas[j],
        grupo: grupo ? String(grupo).trim() : null,
        descricao: descAtual,
        valor: valor
      });
    }
  }

  console.log(`✅ ${recordsToInsert.length} registros preparados para inserção (${lojasDetectadas.size} lojas).`);

  // 3. Limpar banco (conforme pedido pelo usuário)
  console.log('🧹 Limpando dados antigos da tabela dre_data...');
  // Nota: RLS deve estar desativado para o delete funcionar via anon key
  const { error: deleteError } = await supabase.from('dre_data').delete().not('loja_id', 'is', null);
  
  if (deleteError) {
      console.error('❌ Erro ao limpar banco:', deleteError.message);
      console.log('Dica: Verifique se o RLS está desabilitado ou se as permissões GRANT ALL foram aplicadas.');
      // Opcional: retornar caso queira evitar duplicatas no erro
  }

  // 4. Inserir em lotes
  const BATCH_SIZE = 500;
  console.log(`📤 Iniciando inserção em lotes de ${BATCH_SIZE}...`);

  for (let i = 0; i < recordsToInsert.length; i += BATCH_SIZE) {
    const batch = recordsToInsert.slice(i, i + BATCH_SIZE);
    
    const { error: insertError } = await supabase.from('dre_data').insert(batch);
    
    const loteNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalLotes = Math.ceil(recordsToInsert.length / BATCH_SIZE);

    if (insertError) {
      console.error(`❌ Erro no Lote ${loteNum}/${totalLotes}:`, insertError.message);
    } else {
      console.log(`✅ Lote ${loteNum}/${totalLotes} - ${batch.length} registros inseridos.`);
    }
  }

  console.log(`\n🎉 IMPORTAÇÃO CONCLUÍDA: ${recordsToInsert.length} registros processados!`);
}

run().catch(err => {
    console.error('🔥 ERRO FATAL NO SCRIPT:', err);
});
