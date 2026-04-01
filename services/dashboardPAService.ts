import { supabase } from './supabaseClient';
import { PAParameters, PAWeek, PASale, PAAward, PAStoreSummary } from '../types';

export const dashboardPAService = {
  // Parameters
  async getParameters(): Promise<PAParameters | null> {
    const { data, error } = await supabase
      .from('pa_parameters')
      .select('*')
      .single();
    
    if (error && error.code !== 'PGRST116') throw error;
    return data;
  },

  async updateParameters(params: Partial<PAParameters>): Promise<void> {
    const existing = await this.getParameters();
    
    if (existing) {
      const { error } = await supabase
        .from('pa_parameters')
        .update({ ...params, updated_at: new Date().toISOString() })
        .eq('id', existing.id);
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from('pa_parameters')
        .insert([{ ...params }]);
      if (error) throw error;
    }
  },

  // Weeks
  async getWeeks(year: number, month: number): Promise<PAWeek[]> {
    const { data, error } = await supabase
      .from('pa_weeks')
      .select('*')
      .eq('year', year)
      .eq('month', month)
      .order('week_number', { ascending: true });
    
    if (error) throw error;
    return data || [];
  },

  async createWeek(week: Omit<PAWeek, 'id' | 'created_at'>): Promise<void> {
    const { error } = await supabase
      .from('pa_weeks')
      .insert([week]);
    if (error) throw error;
  },

  // Sales & Awards
  async importSales(weekId: string, storeId: string, salesData: any[]): Promise<void> {
    const params = await this.getParameters();
    if (!params) throw new Error('Parâmetros do P.A. não configurados.');

    const salesToInsert = salesData.map(sale => {
      const isEligible = sale.pa_value >= params.min_pa;
      const awardAmount = isEligible ? params.award_value : 0;

      return {
        week_id: weekId,
        store_id: storeId,
        seller_name: sale.seller_name,
        total_sales: sale.total_sales,
        pa_value: sale.pa_value,
        items_sold: sale.items_sold,
        is_eligible: isEligible,
        award_amount: awardAmount
      };
    });

    // Delete existing sales for this week/store to avoid duplicates
    await supabase
      .from('pa_sales')
      .delete()
      .eq('week_id', weekId)
      .eq('store_id', storeId);

    const { data: insertedSales, error: salesError } = await supabase
      .from('pa_sales')
      .insert(salesToInsert)
      .select();

    if (salesError) throw salesError;

    // Create awards for eligible sellers
    const awardsToInsert = insertedSales
      .filter(s => s.is_eligible)
      .map(s => ({
        sale_id: s.id,
        store_id: storeId,
        seller_name: s.seller_name,
        amount: s.award_amount,
        status: 'PENDENTE'
      }));

    if (awardsToInsert.length > 0) {
      const { error: awardsError } = await supabase
        .from('pa_awards')
        .insert(awardsToInsert);
      if (awardsError) throw awardsError;
    }
  },

  async getStoreSales(weekId: string, storeId: string): Promise<PASale[]> {
    const { data, error } = await supabase
      .from('pa_sales')
      .select('*')
      .eq('week_id', weekId)
      .eq('store_id', storeId)
      .order('pa_value', { ascending: false });
    
    if (error) throw error;
    return data || [];
  },

  async getAdminSummary(weekId: string): Promise<PAStoreSummary[]> {
    const { data, error } = await supabase
      .from('pa_sales')
      .select(`
        store_id,
        stores (name),
        total_sales,
        pa_value,
        award_amount,
        is_eligible
      `)
      .eq('week_id', weekId);

    if (error) throw error;

    const summaryMap = new Map<string, PAStoreSummary>();

    data.forEach((item: any) => {
      const storeId = item.store_id;
      const storeName = item.stores?.name || 'Loja Desconhecida';

      if (!summaryMap.has(storeId)) {
        summaryMap.set(storeId, {
          store_id: storeId,
          store_name: storeName,
          total_sales: 0,
          avg_pa: 0,
          total_awards: 0,
          eligible_sellers: 0
        });
      }

      const summary = summaryMap.get(storeId)!;
      summary.total_sales += Number(item.total_sales);
      summary.total_awards += Number(item.award_amount);
      if (item.is_eligible) summary.eligible_sellers += 1;
      
      // We'll calculate avg_pa later or keep a count
    });

    // Finalize averages
    return Array.from(summaryMap.values());
  },

  async markAwardAsPaid(awardId: string): Promise<void> {
    const { error } = await supabase
      .from('pa_awards')
      .update({ status: 'PAGO', paid_at: new Date().toISOString() })
      .eq('id', awardId);
    if (error) throw error;
  }
};
