import { IceCreamSangria, IceCreamSangriaCategory, AdminUser, Store } from '../types';
import { formatCurrency } from '../constants';

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
    sangrias,
    sangriaCategories,
    adminUsers,
    stores,
    effectiveStoreId,
    selectedMonth,
    selectedYear
}: PrintSangriasReportProps) => {
    const store = stores.find(s => s.id === effectiveStoreId);
    const monthName = new Date(Number(selectedYear), Number(selectedMonth) - 1, 1).toLocaleDateString('pt-BR', { month: 'long' }).toUpperCase();
    
    const monthStart = new Date(Number(selectedYear), Number(selectedMonth) - 1, 1, 0, 0, 0);
    const monthEnd = new Date(Number(selectedYear), Number(selectedMonth), 1, 0, 0, 0);

    const filteredSangrias = sangrias
        .filter(s => {
            const dateToUse = s.transaction_date || s.created_at;
            const d = new Date(dateToUse + 'T12:00:00');
            return d >= monthStart && d < monthEnd && s.store_id === effectiveStoreId;
        })
        .sort((a, b) => {
            const dateA = a.transaction_date || a.created_at;
            const dateB = b.transaction_date || b.created_at;
            return new Date(dateA).getTime() - new Date(dateB).getTime();
        });

    const totalAmount = filteredSangrias.reduce((acc, s) => acc + Number(s.amount || 0), 0);

    const printWindow = window.open('', '_blank', 'width=800,height=600');
    if (!printWindow) return;

    const html = `
        <html>
        <head>
            <title>Relatório de Sangrias - ${monthName} ${selectedYear}</title>
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap');
                @page { size: A4; margin: 15mm; }
                body { font-family: 'Inter', sans-serif; margin: 0; padding: 0; color: #1a1a1a; }
                .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #ef4444; padding-bottom: 20px; }
                .header h1 { margin: 0; font-size: 24px; font-weight: 900; color: #ef4444; text-transform: uppercase; font-style: italic; }
                .header p { margin: 5px 0; font-size: 12px; font-weight: 700; color: #666; text-transform: uppercase; }
                
                table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                th { background: #fee2e2; color: #b91c1c; font-size: 10px; font-weight: 900; text-transform: uppercase; padding: 12px 8px; text-align: left; border-bottom: 2px solid #ef4444; }
                td { padding: 10px 8px; font-size: 10px; border-bottom: 1px solid #f3f4f6; font-weight: 600; }
                
                .footer { margin-top: 40px; border-top: 2px solid #ef4444; padding-top: 20px; display: flex; justify-content: space-between; align-items: center; }
                .total-box { background: #ef4444; color: white; padding: 15px 30px; rounded: 10px; text-align: right; }
                .total-label { font-size: 10px; font-weight: 900; text-transform: uppercase; display: block; }
                .total-value { font-size: 20px; font-weight: 900; font-style: italic; }
                
                .signature { margin-top: 60px; text-align: center; border-top: 1px solid #ccc; width: 250px; padding-top: 10px; font-size: 10px; font-weight: 700; text-transform: uppercase; }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>Relatório de Sangrias</h1>
                <p>${store?.name || 'REDE REAL'} — ${monthName} / ${selectedYear}</p>
                <p>Gerado em: ${new Date().toLocaleString('pt-BR')}</p>
            </div>

            <table>
                <thead>
                    <tr>
                        <th>Data</th>
                        <th>Hora</th>
                        <th>Categoria</th>
                        <th>Descrição</th>
                        <th>Responsável</th>
                        <th style="text-align: right;">Valor</th>
                    </tr>
                </thead>
                <tbody>
                    ${filteredSangrias.map(s => {
                        const date = new Date(s.transaction_date || s.created_at);
                        const category = sangriaCategories.find(c => c.id === s.category_id)?.name || 'OUTROS';
                        const user = adminUsers.find(u => u.id === s.user_id)?.name || 'SISTEMA';
                        
                        return `
                            <tr>
                                <td>${date.toLocaleDateString('pt-BR')}</td>
                                <td>${new Date(s.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</td>
                                <td>${category}</td>
                                <td>${s.description || '---'}</td>
                                <td>${user}</td>
                                <td style="text-align: right; font-weight: 900; color: #b91c1c;">${formatCurrency(Number(s.amount))}</td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>

            <div class="footer">
                <div class="signature">Assinatura do Responsável</div>
                <div class="total-box">
                    <span class="total-label">Total de Saídas no Mês</span>
                    <span class="total-value">${formatCurrency(totalAmount)}</span>
                </div>
            </div>

            <script>
                window.onload = () => {
                    setTimeout(() => {
                        window.print();
                        window.close();
                    }, 500);
                };
            </script>
        </body>
        </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
};
