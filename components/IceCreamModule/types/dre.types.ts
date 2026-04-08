export interface DREMethodCount {
    pix: number;
    money: number;
    card: number;
    fiado: number;
}

export interface SaleDetailItem {
    productName: string;
    quantity: number;
    totalValue: number;
}

export interface DREStats {
    monthIn: number;
    monthMethods: { pix: number; money: number; card: number; fiado: number };
    monthMethodsCount: DREMethodCount;
    monthFiadoDetails: any[];
    monthCanceledTotal: number;
    monthCanceledDetails: any[];
    monthSangriaTotal: number;
    monthSangrias: any[];
    monthWastageTotal: number;
    monthSalesDetail: SaleDetailItem[];
    monthFutureDebts: number;
    dayIn: number;
    dayMethods: any;
    dayCanceledTotal: number;
    dayCanceledDetails: any[];
    dayCanceledCount: number;
    daySangriaTotal: number;
    daySangrias: any[];
    dayExits: any[];
    dayWastageTotal: number;
    daySales: any[];
    resumo: any;
    resumoItensRodape: any[];
    profit: number;
    dayProfit: number;
}
