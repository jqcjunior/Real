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
  if (data.resumo_geral) {
    const wsResumo = XLSX.utils.json_to_sheet([data.resumo_geral]);
    XLSX.utils.book_append_sheet(wb, wsResumo, 'Resumo');
  }
  
  // 4. Aba "Por Loja"
  if (data.por_loja && data.por_loja.length > 0) {
    const wsLojas = XLSX.utils.json_to_sheet(data.por_loja);
    XLSX.utils.book_append_sheet(wb, wsLojas, 'Por Loja');
  }
  
  // 5. Aba "Alertas"
  if (data.alertas_criticos && data.alertas_criticos.length > 0) {
    const wsAlertas = XLSX.utils.json_to_sheet(data.alertas_criticos);
    XLSX.utils.book_append_sheet(wb, wsAlertas, 'Alertas');
  }
  
  // 6. Gerar arquivo
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
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
  
  if (data.resumo) {
    const wsResumo = XLSX.utils.json_to_sheet([data.resumo]);
    XLSX.utils.book_append_sheet(wb, wsResumo, 'Resumo');
  }
  
  if (data.execucoes && data.execucoes.length > 0) {
    const wsExec = XLSX.utils.json_to_sheet(data.execucoes);
    XLSX.utils.book_append_sheet(wb, wsExec, 'Execuções');
  }
  
  if (data.por_loja && data.por_loja.length > 0) {
    const wsPorLoja = XLSX.utils.json_to_sheet(data.por_loja);
    XLSX.utils.book_append_sheet(wb, wsPorLoja, 'Por Loja');
  }

  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  saveAs(blob, `Relatorio_Cron_${year}_${month}.xlsx`);
};
