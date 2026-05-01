import { supabase } from './supabaseClient';
import { PAParameters, PAWeek, PASale, PAStoreSummary } from '../types/pa';

export const dashboardPAService = {
  // Parameters
  async getParameters(storeId: string): Promise<PAParameters | null> {
    const { data, error } = await supabase
      .from('Dashboard_PA_Parametros')
      .select('*')
      .eq('store_id', storeId)
      .maybeSingle();
    
    if (error) throw error;
    return data;
  },

  async upsertParameters(params: PAParameters): Promise<void> {
    const { error } = await supabase
      .from('Dashboard_PA_Parametros')
      .upsert({
        ...params,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'store_id'
      });
    
    if (error) throw error;
  },

  // Weeks
  async getWeeks(storeId: string, year: number, month: number): Promise<PAWeek[]> {
    const { data, error } = await supabase
      .from('Dashboard_PA_Semanas')
      .select('*')
      .eq('store_id', storeId)
      .eq('ano_ref', year)
      .eq('mes_ref', month)
      .order('data_inicio', { ascending: true });
    
    if (error) throw error;
    return data || [];
  },

  async createWeek(week: Omit<PAWeek, 'id'>): Promise<PAWeek> {
    const { data, error } = await supabase
      .from('Dashboard_PA_Semanas')
      .insert([week])
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async updateWeekStatus(weekId: string, status: 'aberta' | 'bloqueada' | 'recibos_impressos' | 'reaberta'): Promise<void> {
    const { error } = await supabase
      .from('Dashboard_PA_Semanas')
      .update({ status })
      .eq('id', weekId);
    
    if (error) throw error;
  },

  async marcarRecibosImpressos(weekId: string, impressoPor: string): Promise<void> {
    const { error } = await supabase
      .from('Dashboard_PA_Semanas')
      .update({
        status: 'recibos_impressos',
        recibos_impressos_em: new Date().toISOString(),
        recibos_impressos_por: impressoPor
      })
      .eq('id', weekId);
    if (error) throw error;
  },

  // Sales & Awards
  async getStoreSales(weekId: string, storeId: string): Promise<PASale[]> {
    // Query 1: busca vendas
    const { data: vendas, error: vendasError } = await supabase
      .from('Dashboard_PA_Vendas')
      .select('*')
      .eq('semana_id', weekId)
      .eq('store_id', storeId)
      .order('pa', { ascending: false });

    if (vendasError) throw vendasError;
    if (!vendas || vendas.length === 0) return [];

    // Query 2: busca premiações pelos IDs das vendas
    const vendaIds = vendas.map(v => v.id);
    const { data: premiacoes, error: premiacoesError } = await supabase
      .from('Dashboard_PA_Premiacoes')
      .select('*')
      .in('venda_id', vendaIds);

    if (premiacoesError) throw premiacoesError;

    // Mapeia premiação para cada venda
    const premiacaoMap = new Map(
      (premiacoes || []).map(p => [p.venda_id, p])
    );

    return vendas.map(venda => {
      const premiacao = premiacaoMap.get(venda.id);
      return {
        ...venda,
        atingiu_meta: premiacao?.atingiu_meta || false,
        valor_premio: premiacao?.valor_premio || 0,
        faixas_acima: premiacao?.faixas_acima || 0,
        pa_atingido: premiacao?.pa_atingido || venda.pa,
        pa_meta: premiacao?.pa_meta || 0,
        valor_premio_pa: premiacao?.valor_premio_pa || 0,
        valor_premio_vendas: premiacao?.valor_premio_vendas || 0,
        valor_premio_ticket: premiacao?.valor_premio_ticket || 0,
        valor_premio_total: premiacao?.valor_premio_total || premiacao?.valor_premio || 0,
        atingiu_meta_vendas: !!premiacao?.atingiu_meta_vendas,
        atingiu_meta_ticket: !!premiacao?.atingiu_meta_ticket
      };
    });
  },

  async importSales(weekId: string, storeId: string, rows: any[], importadoPor: string): Promise<void> {
    // 1. Get parameters for the store
    const params = await this.getParameters(storeId);
    if (!params) throw new Error('Parâmetros do P.A. não configurados para esta loja.');

    // 2. Prepare sales data
    const salesToUpsert = rows.map(row => ({
      semana_id: weekId,
      store_id: storeId,
      cod_vendedor: String(row.cod_vendedor),
      nome_vendedor: row.nome_vendedor,
      dias_trabalhados: row.dias_trabalhados || 0,
      qtde_vendas: row.qtde_vendas || 0,
      perc_vendas: row.perc_vendas || '0%',
      qtde_itens: row.qtde_itens || 0,
      perc_itens: row.perc_itens || '0%',
      pa: Number(row.pa) || 0,
      total_vendas: Number(row.total_vendas) || 0,
      perc_total: row.perc_total || '0%',
      trocas: row.trocas ?? null,
      bonus_baixados: row.bonus_baixados ?? null,
      ticket_medio: row.ticket_medio ?? null,
      preco_medio: row.preco_medio ?? null,
      total_vista: row.total_vista ?? null,
      perc_vista: row.perc_vista ?? null,
      total_prazo: row.total_prazo ?? null,
      perc_prazo: row.perc_prazo ?? null,
      importado_por: importadoPor,
      importado_em: new Date().toISOString()
    }));

    // 3. Upsert sales
    const { data: insertedSales, error: salesError } = await supabase
      .from('Dashboard_PA_Vendas')
      .upsert(salesToUpsert, { onConflict: 'semana_id,cod_vendedor' })
      .select();

    if (salesError) throw salesError;

    // 4. Calculate and upsert awards
    const awardsToUpsert = insertedSales.map(venda => {
      const pa           = Number(venda.pa);
      const totalVendas  = Number(venda.total_vendas);
      const ticketMedio  = Number(venda.ticket_medio) || 0;

      // ── PA ──
      const pa_inicial     = Number(params.pa_inicial);
      const incremento_pa  = Number(params.incremento_pa);
      const valor_base     = Number(params.valor_base);
      const incremento_valor = Number(params.incremento_valor);

      let atingiu_meta = false;
      let faixas_acima = 0;
      let valor_premio_pa = 0;

      if (pa >= pa_inicial && incremento_pa > 0) {
        atingiu_meta = true;
        faixas_acima = Math.floor((pa - pa_inicial) / incremento_pa);
        valor_premio_pa = valor_base + (faixas_acima * incremento_valor);
      }

      // ── VENDAS (valor total R$) ──
      let atingiu_meta_vendas = false;
      let valor_premio_vendas = 0;

      if (params.vendas_minimo && params.vendas_incremento && params.vendas_valor_base) {
        const vMin  = Number(params.vendas_minimo);
        const vInc  = Number(params.vendas_incremento);
        const vBase = Number(params.vendas_valor_base);
        const vIncV = Number(params.vendas_inc_valor || 0);

        if (totalVendas >= vMin && vInc > 0) {
          atingiu_meta_vendas = true;
          const faixas = Math.floor((totalVendas - vMin) / vInc);
          valor_premio_vendas = vBase + (faixas * vIncV);
        }
      }

      // ── TICKET MÉDIO ──
      let atingiu_meta_ticket = false;
      let valor_premio_ticket = 0;

      if (params.ticket_minimo && params.ticket_incremento && params.ticket_valor_base) {
        const tMin  = Number(params.ticket_minimo);
        const tInc  = Number(params.ticket_incremento);
        const tBase = Number(params.ticket_valor_base);
        const tIncV = Number(params.ticket_inc_valor || 0);

        if (ticketMedio >= tMin && tInc > 0) {
          atingiu_meta_ticket = true;
          const faixas = Math.floor((ticketMedio - tMin) / tInc);
          valor_premio_ticket = tBase + (faixas * tIncV);
        }
      }

      const valor_premio_total = valor_premio_pa + valor_premio_vendas + valor_premio_ticket;

      return {
        venda_id:             venda.id,
        semana_id:            weekId,
        store_id:             storeId,
        cod_vendedor:         venda.cod_vendedor,
        nome_vendedor:        venda.nome_vendedor,
        pa_atingido:          pa,
        pa_meta:              pa_inicial,
        faixas_acima:         faixas_acima,
        valor_premio:         valor_premio_total,
        atingiu_meta:         atingiu_meta || atingiu_meta_vendas || atingiu_meta_ticket,
        calculado_em:         new Date().toISOString(),
        valor_premio_pa,
        valor_premio_vendas,
        valor_premio_ticket,
        valor_premio_total,
        atingiu_meta_vendas,
        atingiu_meta_ticket,
      };
    });

    const { error: awardsError } = await supabase
      .from('Dashboard_PA_Premiacoes')
      .upsert(awardsToUpsert, { onConflict: 'venda_id' });

    if (awardsError) throw awardsError;
  },

  async getAdminSummary(weekId: string): Promise<PAStoreSummary[]> {
    // Query 1: busca vendas com nome da loja
    const { data: vendas, error } = await supabase
      .from('Dashboard_PA_Vendas')
      .select('*, stores(name)')
      .eq('semana_id', weekId);

    if (error) throw error;
    if (!vendas || vendas.length === 0) return [];

    // Query 2: busca premiações
    const vendaIds = vendas.map(v => v.id);
    const { data: premiacoes } = await supabase
      .from('Dashboard_PA_Premiacoes')
      .select('venda_id, valor_premio, atingiu_meta')
      .in('venda_id', vendaIds);

    const premiacaoMap = new Map(
      (premiacoes || []).map(p => [p.venda_id, p])
    );

    const summaryMap = new Map<string, any>();

    vendas.forEach((item: any) => {
      const sid = item.store_id;
      const storeName = item.stores?.name || 'Loja Desconhecida';
      const premiacao = premiacaoMap.get(item.id);

      if (!summaryMap.has(sid)) {
        summaryMap.set(sid, {
          store_id: sid,
          store_name: storeName,
          total_sales: 0,
          total_pa: 0,
          count: 0,
          total_awards: 0,
          eligible_sellers: 0
        });
      }

      const s = summaryMap.get(sid)!;
      s.total_sales += Number(item.total_vendas || 0);
      s.total_pa += Number(item.pa || 0);
      s.count += 1;
      s.total_awards += Number(premiacao?.valor_premio || 0);
      if (premiacao?.atingiu_meta) s.eligible_sellers += 1;
    });

    return Array.from(summaryMap.values()).map(s => ({
      store_id: s.store_id,
      store_name: s.store_name,
      total_sales: s.total_sales,
      avg_pa: s.count > 0 ? s.total_pa / s.count : 0,
      eligible_sellers: s.eligible_sellers,
      total_awards: s.total_awards
    }));
  },

  async getAllWeeks(year: number, month: number): Promise<PAWeek[]> {
    const { data, error } = await supabase
      .from('Dashboard_PA_Semanas')
      .select('*')
      .eq('ano_ref', year)
      .eq('mes_ref', month)
      .order('data_inicio', { ascending: true });
    
    if (error) throw error;
    return data || [];
  }
};
