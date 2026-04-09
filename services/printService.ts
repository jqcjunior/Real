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
            <title>Relatório de Despesas - ${monthName} ${selectedYear}</title>
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap');
                @page { size: A4; margin: 10mm; }
                body { font-family: 'Inter', sans-serif; margin: 0; padding: 0; color: #1a1a1a; background: white; }
                .container { width: 100%; max-width: 210mm; margin: 0 auto; padding: 10mm; box-sizing: border-box; }
                
                .header { 
                    display: flex; 
                    justify-content: space-between; 
                    align-items: center; 
                    margin-bottom: 30px; 
                    border-bottom: 3px solid #1e293b; 
                    padding-bottom: 20px; 
                }
                .header-left h1 { 
                    margin: 0; 
                    font-size: 28px; 
                    font-weight: 900; 
                    color: #1e293b; 
                    text-transform: uppercase; 
                    letter-spacing: -1px;
                }
                .header-left p { 
                    margin: 5px 0; 
                    font-size: 14px; 
                    font-weight: 700; 
                    color: #64748b; 
                    text-transform: uppercase; 
                }
                .header-right { text-align: right; }
                .header-right p { margin: 2px 0; font-size: 10px; font-weight: 800; color: #94a3b8; text-transform: uppercase; }
                
                table { width: 100%; border-collapse: collapse; margin-top: 10px; table-layout: fixed; }
                th { 
                    background: #f8fafc; 
                    color: #475569; 
                    font-size: 10px; 
                    font-weight: 900; 
                    text-transform: uppercase; 
                    padding: 12px 10px; 
                    text-align: left; 
                    border-bottom: 2px solid #e2e8f0; 
                }
                td { 
                    padding: 12px 10px; 
                    font-size: 10px; 
                    border-bottom: 1px solid #f1f5f9; 
                    font-weight: 600; 
                    color: #334155;
                    word-wrap: break-word;
                }
                .row-even { background: #fdfdfd; }
                
                .footer { 
                    margin-top: 50px; 
                    display: flex; 
                    justify-content: space-between; 
                    align-items: flex-end; 
                }
                .total-card { 
                    background: #1e293b; 
                    color: white; 
                    padding: 20px 40px; 
                    border-radius: 15px; 
                    text-align: right; 
                    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
                }
                .total-label { font-size: 11px; font-weight: 900; text-transform: uppercase; opacity: 0.7; display: block; margin-bottom: 5px; }
                .total-value { font-size: 24px; font-weight: 900; letter-spacing: -1px; }
                
                .signatures { display: flex; gap: 40px; margin-top: 60px; }
                .signature-box { 
                    flex: 1;
                    border-top: 1px solid #cbd5e1; 
                    padding-top: 10px; 
                    font-size: 9px; 
                    font-weight: 800; 
                    text-transform: uppercase; 
                    color: #64748b;
                    text-align: center;
                }
                
                .badge {
                    display: inline-block;
                    padding: 4px 8px;
                    border-radius: 4px;
                    font-size: 8px;
                    font-weight: 900;
                    text-transform: uppercase;
                    background: #f1f5f9;
                    color: #475569;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <div class="header-left">
                        <h1>Relatório de Despesas</h1>
                        <p>${store?.name || 'REDE REAL'} — ${monthName} / ${selectedYear}</p>
                    </div>
                    <div class="header-right">
                        <p>Documento Oficial</p>
                        <p>Gerado em: ${new Date().toLocaleString('pt-BR')}</p>
                    </div>
                </div>
    
                <table>
                    <thead>
                        <tr>
                            <th style="width: 15%;">Data</th>
                            <th style="width: 20%;">Categoria</th>
                            <th style="width: 35%;">Descrição</th>
                            <th style="width: 15%;">Responsável</th>
                            <th style="width: 15%; text-align: right;">Valor</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${filteredSangrias.map((s, idx) => {
                            const date = new Date(s.transaction_date || s.created_at);
                            const category = sangriaCategories.find(c => c.id === s.category_id)?.name || 'OUTROS';
                            const user = adminUsers.find(u => u.id === s.user_id)?.name || 'SISTEMA';
                            
                            return `
                                <tr class="${idx % 2 === 0 ? '' : 'row-even'}">
                                    <td>
                                        <div style="font-weight: 900;">${date.toLocaleDateString('pt-BR')}</div>
                                        <div style="font-size: 8px; color: #94a3b8;">${new Date(s.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</div>
                                    </td>
                                    <td><span class="badge">${category}</span></td>
                                    <td style="font-style: italic;">${s.description || '---'}</td>
                                    <td style="color: #64748b;">${user}</td>
                                    <td style="text-align: right; font-weight: 900; font-size: 12px; color: #1e293b;">${formatCurrency(Number(s.amount))}</td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
    
                <div class="footer">
                    <div class="signatures">
                        <div class="signature-box">Assinatura do Responsável</div>
                        <div class="signature-box">Conferência Administrativa</div>
                    </div>
                    <div class="total-card">
                        <span class="total-label">Total de Despesas (Mês)</span>
                        <span class="total-value">${formatCurrency(totalAmount)}</span>
                    </div>
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
