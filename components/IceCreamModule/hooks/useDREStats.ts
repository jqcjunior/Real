import { useMemo } from 'react';
import { 
    IceCreamDailySale, Sale, SalePayment, IceCreamSangria, 
    IceCreamStockMovement, IceCreamFutureDebt, SaleDetailItem, DREMethodCount 
} from '../../../types';

interface UseDREStatsProps {
    user: any;
    sales: IceCreamDailySale[];
    salePayments: SalePayment[];
    salesHeaders: Sale[];
    sangrias: IceCreamSangria[];
    stockMovements: IceCreamStockMovement[];
    futureDebts: IceCreamFutureDebt[];
    sangriaCategories: any[];
    selectedYear: string | number;
    selectedMonth: string | number;
    displayDate: string;
    effectiveStoreId: string;
}

export const useDREStats = ({
    user,
    sales,
    salePayments,
    salesHeaders,
    sangrias,
    stockMovements,
    futureDebts,
    sangriaCategories,
    selectedYear,
    selectedMonth,
    displayDate,
    effectiveStoreId
}: UseDREStatsProps) => {
    const isAdmin = user?.role === 'ADMIN';

    return useMemo(() => {
        const dDate = new Date(displayDate + 'T00:00:00');
        const currentYear = dDate.getFullYear();
        const currentMonth = dDate.getMonth();
        const currentDate = dDate.getDate();

        const monthStart = new Date(Number(selectedYear), Number(selectedMonth) - 1, 1, 0, 0, 0);
        const monthEnd = new Date(Number(selectedYear), Number(selectedMonth), 1, 0, 0, 0);

        const dayStart = new Date(currentYear, currentMonth, currentDate, 0, 0, 0);
        const dayEnd = new Date(currentYear, currentMonth, currentDate + 1, 0, 0, 0);

        let monthIn = 0;
        const monthMethods = { pix: 0, money: 0, card: 0, fiado: 0 };
        const monthMethodsCount: DREMethodCount = { pix: 0, money: 0, card: 0, fiado: 0 };
        const monthFiadoDetails: any[] = [];
        
        let monthCanceledTotal = 0;
        const monthCanceledDetails: any[] = [];

        let dayCanceledTotal = 0;
        const dayCanceledDetails: any[] = [];

        let dayIn = 0;
        const dayMethods = { 
            pix: { count: 0, total: 0 }, 
            money: { count: 0, total: 0 }, 
            card: { count: 0, total: 0 }, 
            fiado: { count: 0, total: 0 } 
        };

        const monthSalesHeaders = (salesHeaders ?? []).filter(s => {
            if (!s.created_at) return false;
            const d = new Date(s.created_at);
            const matchesStore = s.store_id === effectiveStoreId;
            return d >= monthStart && d < monthEnd && matchesStore;
        });

        monthSalesHeaders.forEach(sale => {
            const d = new Date(sale.created_at);
            const isDaySale = d >= dayStart && d < dayEnd;

            if (sale.status === 'canceled') {
                const val = Number(sale.total_value || 0);
                monthCanceledTotal += val;
                monthCanceledDetails.push({
                    id: sale.id,
                    saleCode: sale.sale_code,
                    createdAt: sale.created_at,
                    totalValue: val,
                    canceledBy: sale.canceled_by_name || 'N/A',
                    cancelReason: sale.cancel_reason || 'N/A'
                });
                
                if (isDaySale) {
                    dayCanceledTotal += val;
                    dayCanceledDetails.push({
                        id: sale.id,
                        saleCode: sale.sale_code,
                        createdAt: sale.created_at,
                        totalValue: val,
                        canceledBy: sale.canceled_by_name || 'N/A',
                        cancelReason: sale.cancel_reason || 'N/A'
                    });
                }
                return;
            }

            if (sale.status !== 'completed') return;

            const payments = (salePayments ?? []).filter(p => p.sale_id === sale.id);
            
            if (payments.length > 0) {
                payments.forEach(p => {
                    const val = Number(p.amount || 0);
                    monthIn += val;
                    if (isDaySale) dayIn += val;

                    const method = p.payment_method?.toLowerCase();
                    if (method === 'pix') {
                        monthMethods.pix += val;
                        monthMethodsCount.pix++;
                        if (isDaySale) {
                            dayMethods.pix.total += val;
                            dayMethods.pix.count++;
                        }
                    } else if (method === 'dinheiro') {
                        monthMethods.money += val;
                        monthMethodsCount.money++;
                        if (isDaySale) {
                            dayMethods.money.total += val;
                            dayMethods.money.count++;
                        }
                    } else if (method === 'cartão') {
                        monthMethods.card += val;
                        monthMethodsCount.card++;
                        if (isDaySale) {
                            dayMethods.card.total += val;
                            dayMethods.card.count++;
                        }
                    } else if (method === 'fiado') {
                        monthMethods.fiado += val;
                        monthMethodsCount.fiado++;
                        if (isDaySale) {
                            dayMethods.fiado.total += val;
                            dayMethods.fiado.count++;
                        }
                        monthFiadoDetails.push({
                            buyer_name: sale.buyer_name || 'NÃO INFORMADO',
                            totalValue: p.amount,
                            saleCode: sale.sale_code || '---',
                            createdAt: p.created_at,
                            productName: 'Venda Diversa'
                        });
                    }
                });
            } else {
                const items = (sales ?? []).filter(i => i.saleCode === sale.sale_code && i.status === 'completed');
                items.forEach(i => {
                    const val = Number(i.totalValue || 0);
                    monthIn += val;
                    if (isDaySale) dayIn += val;

                    const method = i.paymentMethod?.toLowerCase();
                    if (method === 'pix') {
                        monthMethods.pix += val;
                        monthMethodsCount.pix++;
                        if (isDaySale) {
                            dayMethods.pix.total += val;
                            dayMethods.pix.count++;
                        }
                    } else if (method === 'dinheiro') {
                        monthMethods.money += val;
                        monthMethodsCount.money++;
                        if (isDaySale) {
                            dayMethods.money.total += val;
                            dayMethods.money.count++;
                        }
                    } else if (method === 'cartão') {
                        monthMethods.card += val;
                        monthMethodsCount.card++;
                        if (isDaySale) {
                            dayMethods.card.total += val;
                            dayMethods.card.count++;
                        }
                    } else if (method === 'fiado') {
                        monthMethods.fiado += val;
                        monthMethodsCount.fiado++;
                        if (isDaySale) {
                            dayMethods.fiado.total += val;
                            dayMethods.fiado.count++;
                        }
                        monthFiadoDetails.push({
                            buyer_name: i.buyer_name || 'NÃO INFORMADO',
                            totalValue: i.totalValue,
                            saleCode: i.saleCode || '---',
                            createdAt: i.createdAt,
                            productName: i.productName || 'Venda Diversa'
                        });
                    }
                });
            }
        });

        const monthSalesDetail: SaleDetailItem[] = [];
        const salesByProduct: Record<string, { quantity: number; totalValue: number }> = {};

        const monthSalesItems = (sales ?? []).filter(s => {
            if (!s.createdAt) return false;
            const d = new Date(s.createdAt);
            const matchesStore = s.storeId === effectiveStoreId;
            return d >= monthStart && d < monthEnd && s.status === 'completed' && matchesStore;
        });

        monthSalesItems.forEach(item => {
            if (!salesByProduct[item.productName]) {
                salesByProduct[item.productName] = { quantity: 0, totalValue: 0 };
            }
            salesByProduct[item.productName].quantity += Number(item.unitsSold || 0);
            salesByProduct[item.productName].totalValue += Number(item.totalValue || 0);
        });

        Object.entries(salesByProduct).forEach(([productName, data]) => {
            monthSalesDetail.push({ productName, ...data });
        });

        const monthFutureDebts = (futureDebts ?? []).filter(d => {
            if (!d.due_date) return false;
            const date = new Date(d.due_date + 'T12:00:00');
            const matchesStore = d.store_id === effectiveStoreId;
            return date >= monthStart && date < monthEnd && matchesStore && d.status !== 'paid';
        }).reduce((acc, d) => acc + Number(d.installment_amount || 0), 0);

        const monthSangrias = (sangrias ?? []).filter(s => {
            if (!s.transaction_date && !s.created_at) return false;
            const dateToUse = s.transaction_date || s.created_at;
            const d = new Date(dateToUse + 'T00:00:00');
            const matchesStore = s.store_id === effectiveStoreId;
            return d >= monthStart && d < monthEnd && matchesStore;
        });
        const monthSangriaTotal = monthSangrias.reduce((acc, s) => acc + Number(s.amount || 0), 0);

        const daySangrias = (sangrias ?? []).filter(s => {
            if (!s.transaction_date && !s.created_at) return false;
            const dateToUse = s.transaction_date || s.created_at;
            const d = new Date(dateToUse + 'T00:00:00');
            const matchesStore = s.store_id === effectiveStoreId;
            return d >= dayStart && d < dayEnd && matchesStore;
        });
        const daySangriaTotal = daySangrias.reduce((acc, s) => acc + Number(s.amount || 0), 0);

        const monthWastage = (stockMovements ?? []).filter(m => {
            if (!m.created_at) return false;
            const d = new Date(m.created_at);
            const matchesStore = m.store_id === effectiveStoreId;
            return d >= monthStart && d < monthEnd && matchesStore && m.movement_type === 'AVARIA';
        });
        const monthWastageTotal = monthWastage.reduce((acc, m) => acc + Math.abs(Number(m.quantity || 0)), 0);

        const dayWastage = (stockMovements ?? []).filter(m => {
            if (!m.created_at) return false;
            const d = new Date(m.created_at);
            const matchesStore = m.store_id === effectiveStoreId;
            return d >= dayStart && d < dayEnd && matchesStore && m.movement_type === 'AVARIA';
        });
        const dayWastageTotal = dayWastage.reduce((acc, m) => acc + Math.abs(Number(m.quantity || 0)), 0);

        const daySales = (sales ?? []).filter(s => {
            if (!s.createdAt) return false;
            const d = new Date(s.createdAt);
            const matchesStore = s.storeId === effectiveStoreId;
            return d >= dayStart && d < dayEnd && s.status === 'completed' && matchesStore;
        });

        const resumo: Record<string, { qtd: number; total: number }> = {};
        daySales.forEach(venda => {
            if (!resumo[venda.productName]) {
                resumo[venda.productName] = { qtd: 0, total: 0 };
            }
            resumo[venda.productName].qtd += Number(venda.unitsSold || 0);
            resumo[venda.productName].total += Number(venda.totalValue || 0);
        });

        const profit = monthIn - monthSangriaTotal - monthFutureDebts;
        const dayProfit = dayIn - daySangriaTotal;

        return {
            monthIn,
            monthMethods,
            monthMethodsCount,
            monthFiadoDetails,
            monthCanceledTotal,
            monthCanceledDetails,
            monthSangriaTotal,
            monthSangrias,
            monthWastageTotal,
            monthSalesDetail,
            monthFutureDebts,
            dayIn,
            dayMethods,
            dayCanceledTotal,
            dayCanceledDetails,
            dayCanceledCount: dayCanceledDetails.length,
            daySangriaTotal,
            daySangrias,
            dayExits: daySangrias.map(s => ({
                id: s.id,
                description: s.description,
                category: sangriaCategories.find(c => c.id === s.category_id)?.name || 'OUTROS',
                value: s.amount
            })),
            monthExits: monthSangrias.map(s => ({
                id: s.id,
                description: s.description,
                category: sangriaCategories.find(c => c.id === s.category_id)?.name || 'OUTROS',
                value: s.amount
            })),
            dayWastageTotal,
            daySales,
            resumo,
            resumoItensRodape: Object.entries(resumo),
            profit,
            dayProfit
        };
    }, [
        sales, salePayments, salesHeaders, sangrias, stockMovements, 
        futureDebts, sangriaCategories, selectedYear, selectedMonth, displayDate, effectiveStoreId
    ]);
};
