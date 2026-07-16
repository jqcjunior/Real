import { IceCreamSangria, IceCreamSangriaCategory, AdminUser, Store } from '../../../types';
import { formatCurrency } from '../../../constants';
import { PRINT_BASE_STYLES, buildPrintHeader, buildPrintFooter, PRINT_AUTOCLOSE_SCRIPT } from './printTheme';

interface PrintSangriasReportProps {
    sangrias: IceCreamSangria[];
    sangriaCategories: IceCreamSangriaCategory[];
    adminUsers: AdminUser[];
    stores: Store[];
    effectiveStoreId: string;
    selectedMonth: string | number;
    selectedYear: string | number;
}

export const printSangriasReport = ({
    sangrias, sangriaCategories, adminUsers, stores, effectiveStoreId, selectedMonth, selectedYear
}: PrintSangriasReportProps) => {
    const store = stores.find(s => s.id === effectiveStoreId);
    const monthName = new Date(Number(selectedYear), Number(selectedMonth) - 1, 1).toLocaleDateString('pt-BR', { month: 'long' });
    const monthStart = new Date(Number(selectedYear), Number(selectedMonth) - 1, 1, 0, 0, 0);
    const monthEnd = new Date(Number(selectedYear), Number(selectedMonth), 1, 0, 0, 0);

    const filteredSangrias = sangrias
        .filter(s => {
            const dateToUse = s.transaction_date || s.created_at;
            const d = new Date(dateToUse + 'T12:00:00');
            return d >= monthStart && d < monthEnd && s.store_id === effectiveStoreId;
        })
        .sort((a, b) => new Date(a.transaction_date || a.created_at).getTime() - new Date(b.transaction_date || b.created_at).getTime());

    const totalAmount = filteredSangrias.reduce((acc, s) => acc + Number(s.amount || 0), 0);

    const printWindow = window.open('', '_blank', 'width=800,height=600');
    if (!printWindow) return;

    const rows = filteredSangrias.map(s => {
        const date = new Date((s.transaction_date || s.created_at) + 'T12:00:00');
        const category = sangriaCategories.find(c => c.id === s.category_id)?.name || 'Outros';
        const user = adminUsers.find(u => u.id === s.user_id)?.name || 'Sistema';
        return `
            <tr>
                <td>${date.toLocaleDateString('pt-BR')}</td>
                <td>${new Date(s.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</td>
                <td>${category}</td>
                <td>${s.description || '—'}</td>
                <td>${user}</td>
                <td style="text-align:right" class="rp-mono">${formatCurrency(Number(s.amount))}</td>
            </tr>`;
    }).join('');

    const html = `
        <html>
        <head>
            <title>Relatório de sangrias — ${monthName} ${selectedYear}</title>
            <style>${PRINT_BASE_STYLES}</style>
        </head>
        <body>
            ${buildPrintHeader({
                eyebrow: 'Sorveteria real',
                title: 'Relatório de sangrias',
                storeLine: store?.name || 'Rede real',
                periodLine: `${monthName} de ${selectedYear}`
            })}
            <div class="rp-section">
                <div class="rp-section-title">Movimentações do período</div>
                <table class="rp-table">
                    <thead>
                        <tr><th>Data</th><th>Hora</th><th>Categoria</th><th>Descrição</th><th>Responsável</th><th style="text-align:right">Valor</th></tr>
                    </thead>
                    <tbody>${rows || '<tr><td colspan="6" style="text-align:center;color:#94A3B8;padding:20px;">Nenhuma sangria no período</td></tr>'}</tbody>
                </table>
            </div>
            <div class="rp-kpi-row total">
                <span>Total de saídas no mês</span>
                <span class="rp-mono">${formatCurrency(totalAmount)}</span>
            </div>
            ${buildPrintFooter()}
            ${PRINT_AUTOCLOSE_SCRIPT}
        </body>
        </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
};
