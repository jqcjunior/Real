import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { supabase } from '../services/supabaseClient';

export const generateQuotaExcelReport = async (year: number, month: number) => {
  // 1. Buscar dados via RPC
  const { data, error } = await supabase.rpc('generate_quota_report', {
    p_year: year,
    p_month: month
  });
  
  if (error) {
    console.error("Error generating quota report", error);
    throw error;
  }
  
  if (!data) return;

  // 2. Criar workbook
  const wb = XLSX.utils.book_new();
  
  // 3. Aba "Resumo"
  // Transform the single object into an array for xlsx
  const resumoWs = XLSX.utils.json_to_sheet([data.resumo_geral]);
  XLSX.utils.book_append_sheet(wb, resumoWs, 'Resumo');
  
  // 4. Aba "Por Loja"
  if (data.por_loja && data.por_loja.length > 0) {
      const lojasWs = XLSX.utils.json_to_sheet(data.por_loja);
      applyConditionalFormatting(lojasWs);
      XLSX.utils.book_append_sheet(wb, lojasWs, 'Por Loja');
  }
  
  // 5. Aba "Alertas"
  if (data.alertas_criticos && data.alertas_criticos.length > 0) {
    const alertasWs = XLSX.utils.json_to_sheet(data.alertas_criticos);
    XLSX.utils.book_append_sheet(wb, alertasWs, 'Alertas');
  }
  
  // 6. Gerar arquivo
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([wbout], { type: 'application/octet-stream' });
  saveAs(blob, `Relatorio_Cotas_${year}_${month}.xlsx`);
};

export const generateCronExcelReport = async (year: number, month: number) => {
  const { data, error } = await supabase.rpc('generate_cron_report', {
    p_year: year,
    p_month: month
  });

  if (error) {
    console.error("Error generating cron report", error);
    throw error;
  }

  if (!data) return;

  const wb = XLSX.utils.book_new();
  
  const resumoWs = XLSX.utils.json_to_sheet([data.resumo]);
  XLSX.utils.book_append_sheet(wb, resumoWs, 'Resumo');
  
  if (data.execucoes && data.execucoes.length > 0) {
      const logsWs = XLSX.utils.json_to_sheet(data.execucoes);
      XLSX.utils.book_append_sheet(wb, logsWs, 'Execuções');
  }
  
  if (data.por_loja && data.por_loja.length > 0) {
      const byStoreWs = XLSX.utils.json_to_sheet(data.por_loja);
      XLSX.utils.book_append_sheet(wb, byStoreWs, 'Por Loja');
  }

  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([wbout], { type: 'application/octet-stream' });
  saveAs(blob, `Relatorio_Cron_${year}_${month}.xlsx`);
};

const applyConditionalFormatting = (ws: XLSX.WorkSheet) => {
  if(!ws['!ref']) return;
  const range = XLSX.utils.decode_range(ws['!ref']);
  for (let R = range.s.r + 1; R <= range.e.r; ++R) {
    // Assuming status is in the 10th column (J, index 9) based on the view
    const statusCell = ws[XLSX.utils.encode_cell({ r: R, c: 9 })];
    if (statusCell) {
        if (statusCell.v === 'CRÍTICO' || statusCell.v === 'ESGOTADO') {
            statusCell.s = { fill: { fgColor: { rgb: 'FFF09595' } } };
        } else if (statusCell.v === 'ATENÇÃO') {
            statusCell.s = { fill: { fgColor: { rgb: 'FFFAC775' } } };
        } else if (statusCell.v === 'OK') {
            statusCell.s = { fill: { fgColor: { rgb: 'FF97C459' } } };
        }
    }
  }
};
