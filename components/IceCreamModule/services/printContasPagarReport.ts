import { formatCurrency } from '../../../constants';
import { PRINT_BASE_STYLES, buildPrintHeader, buildPrintFooter, PRINT_AUTOCLOSE_SCRIPT } from './printTheme';

interface DebtRow {
    due_date: string;
    supplier_name: string;
    category_id?: string;
    installment_number: number;
    total_installments: number;
    installment_amount: number;
    computedStatus: 'overdue' | 'due_soon' | 'ok' | 'paid';
}

interface PrintContasPagarProps {
    debts: DebtRow[];
    categories: { id: string; name: string }[];
    storeName: string;
    monthLabel: string;
    year: number | string;
    totals: { vencido: number; aVencer: number; mes: number; pago: number };
}

const STATUS_LABEL: Record<string, string> = { overdue: 'Vencido', due_soon: 'A vencer', ok: 'Em dia', paid: 'Pago' };
const STATUS_CLASS: Record<string, string> = { overdue: 'rp-status-vencido', due_soon: 'rp-status-avencer', ok: 'rp-status-emdia', paid: 'rp-status-pago' };

export const printContasAPagarReport = ({ debts, categories, storeName, monthLabel, year, totals }: PrintContasPagarProps) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) { alert('Pop-up bloqueado!'); return; }

    const sorted = [...debts].sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());

    const rows = sorted.map(d => {
        const category = categories.find(c => c.id === d.category_id)?.name || 'Outros';
        return `
            <tr>
                <td>${new Date(d.due_date + 'T12:00:00').toLocaleDateString('pt-BR')}</td>
                <td><span class="rp-status-pill ${STATUS_CLASS[d.computedStatus]}">${STATUS_LABEL[d.computedStatus]}</span></td>
                <td>${d.supplier_name}</td>
                <td>${category}</td>
                <td>${d.installment_number}/${d.total_installments}</td>
                <td style="text-align:right" class="rp-mono">${formatCurrency(Number(d.installment_amount))}</td>
            </tr>`;
    }).join('');

    const html = `
        <html>
        <head>
            <title>Contas a pagar — ${monthLabel} ${year}</title>
            <style>${PRINT_BASE_STYLES}</style>
        </head>
        <body>
            ${buildPrintHeader({
                eyebrow: 'Sorveteria real',
                title: 'Contas a pagar',
                storeLine: storeName,
                periodLine: `${monthLabel} de ${year}`
            })}
            <div class="rp-section">
                <div class="rp-section-title">Resumo</div>
                <div class="rp-kpi-row"><span>Vencido</span><span class="rp-mono" style="color:#791F1F">${formatCurrency(totals.vencido)}</span></div>
                <div class="rp-kpi-row"><span>A vencer (7 dias)</span><span class="rp-mono" style="color:#633806">${formatCurrency(totals.aVencer)}</span></div>
                <div class="rp-kpi-row"><span>Total do mês</span><span class="rp-mono" style="color:#3C3489">${formatCurrency(totals.mes)}</span></div>
                <div class="rp-kpi-row total"><span>Pago no mês</span><span class="rp-mono">${formatCurrency(totals.pago)}</span></div>
            </div>
            <div class="rp-section">
                <div class="rp-section-title">Contas do período</div>
                <table class="rp-table">
                    <thead><tr><th>Vencimento</th><th>Status</th><th>Fornecedor</th><th>Categoria</th><th>Parcela</th><th style="text-align:right">Valor</th></tr></thead>
                    <tbody>${rows || '<tr><td colspan="6" style="text-align:center;color:#94A3B8;padding:20px;">Nenhuma conta no período</td></tr>'}</tbody>
                </table>
            </div>
            ${buildPrintFooter()}
            ${PRINT_AUTOCLOSE_SCRIPT}
        </body>
        </html>
    `;
    printWindow.document.write(html);
    printWindow.document.close();
};
