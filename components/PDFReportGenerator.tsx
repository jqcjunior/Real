import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { supabase } from '../services/supabaseClient';

export const generateDashboardPDF = async (year: number, month: number) => {
  // 1. Buscar dados
  const { data, error } = await supabase.rpc('generate_quota_report', {
    p_year: year,
    p_month: month
  });
  
  if (error) {
    console.error("Error generating pdf", error);
    throw error;
  }

  if (!data) return;

  // 2. Criar PDF
  const doc = new jsPDF();
  
  // 3. Cabeçalho
  doc.setFontSize(20);
  doc.setTextColor(24, 95, 165); // #185FA5
  doc.text('Dashboard Executivo - Cotas OTB', 20, 20);
  doc.setFontSize(12);
  doc.setTextColor(100, 100, 100);
  doc.text(`Período: ${data.periodo.periodo_completo}`, 20, 30);
  
  // 4. Resumo (cards)
  doc.setFontSize(14);
  doc.setTextColor(0, 0, 0);
  doc.text('Resumo Geral', 20, 45);
  doc.setFontSize(11);
  doc.text(`Total de Lojas: ${data.resumo_geral.total_lojas}`, 20, 55);
  doc.text(`Cota Total Inicial: R$ ${data.resumo_geral.cota_total_inicial?.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`, 20, 62);
  doc.text(`Cota Total Utilizada: R$ ${data.resumo_geral.cota_total_utilizada?.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`, 20, 69);
  doc.text(`Cota Total Disponível: R$ ${data.resumo_geral.cota_total_disponivel?.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`, 20, 76);
  doc.text(`Uso Médio Global: ${data.resumo_geral.percentual_medio}%`, 20, 83);
  
  let currentY = 95;

  // 5. Tabela de lojas críticas
  const lojasCriticas = data.por_loja.filter((l: any) => l.percentual_utilizado >= 75).slice(0, 10);
  
  if (lojasCriticas.length > 0) {
      doc.setFontSize(14);
      doc.text('Lojas Críticas / Atenção (Top 10)', 20, currentY);
      
      autoTable(doc, {
        startY: currentY + 5,
        headStyles: { fillColor: [24, 95, 165] },
        head: [['Loja', 'Nome', '% Utilizado', 'Status', 'Cota Disp.']],
        body: lojasCriticas.map((l: any) => [
          l.store_number,
          l.store_name,
          `${l.percentual_utilizado}%`,
          l.status,
          `R$ ${l.cota_disponivel?.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`
        ]),
        didParseCell: function(data) {
            if (data.section === 'body' && data.column.index === 3) {
                if (data.cell.raw === 'CRÍTICO' || data.cell.raw === 'ESGOTADO') {
                    data.cell.styles.textColor = [240, 149, 149]; // Vermelho #F09595
                    data.cell.styles.fontStyle = 'bold';
                } else if (data.cell.raw === 'ATENÇÃO') {
                    data.cell.styles.textColor = [250, 199, 117]; // Laranja #FAC775
                    data.cell.styles.fontStyle = 'bold';
                }
            }
        }
      });
      // @ts-ignore
      currentY = doc.lastAutoTable.finalY + 15;
  } else {
      doc.setFontSize(12);
      doc.setTextColor(30, 150, 30);
      doc.text('Nenhuma loja em estado crítico ou de atenção.', 20, currentY);
      currentY += 15;
  }

  // Rodapé
  doc.setFontSize(9);
  doc.setTextColor(150, 150, 150);
  doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, 20, 280);
  
  // 6. Salvar
  doc.save(`Dashboard_Executivo_${year}_${month}.pdf`);
};
