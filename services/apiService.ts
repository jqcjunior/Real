import { supabase } from './supabaseClient';
 
class ApiService {
  /**
   * Login do usuário - Integrado com RLS
   */
  async login(email: string, password: string) {
    try {
      const { data, error } = await supabase.rpc('authenticate_user', {
        p_email: email,
        p_password: password
      });
 
      if (error || !data || data.length === 0) {
        throw new Error('Erro na autenticação');
      }
 
      const user = data[0];
 
      // ✅ VERIFICAR STATUS
      if (!user.is_valid) {
        // Mostrar mensagem específica do erro
        throw new Error(user.error_message || 'Acesso negado');
      }
 
      // DEBUG TEMPORÁRIO - ADICIONAR ESTAS LINHAS
        console.log('=== DEBUG AUTHENTICATE_USER ===');
        console.log('Dados retornados do banco:', user);
        console.log('user.user_id:', user.user_id);
        console.log('user.name:', user.name);
        console.log('user.email:', user.email);
        console.log('user.role_level:', user.role_level);
        console.log('user.store_id:', user.store_id);
        console.log('===============================');
        
        // 1. SETAR SESSÃO NO POSTGRES (Fundamental para o RLS funcionar)
        await supabase.rpc('set_user_session', {
          user_id: user.user_id
        });
 
        // 2. Mapear para o formato que o seu App.tsx já usa
        const mappedUser = {
          id: user.user_id,
          name: user.name,
          email: user.email,
          role: (user.role_level || user.role || 'CASHIER').toUpperCase(),
          storeId: user.store_id
        };
 
        // 3. Persistência Limpa
        // Usamos sessionStorage para garantir que a sessão termine ao fechar o navegador,
        // evitando logins automáticos indesejados.
        sessionStorage.setItem('realcalcados_v3_user', JSON.stringify(mappedUser));
        sessionStorage.setItem('auth_token', 'session_' + user.user_id);
 
        return { success: true, user: mappedUser };
    } catch (error: any) {
      console.error('Erro no login:', error);
      throw error;
    }
  }
 
  async logout() {
    sessionStorage.clear();
    window.location.reload(); 
  }
 
  getUser() {
    try {
      const userStr = sessionStorage.getItem('realcalcados_v3_user');
      return userStr ? JSON.parse(userStr) : null;
    } catch (error) {
      return null;
    }
  }
 
  getToken() {
    return sessionStorage.getItem('auth_token');
  }
 
  isAuthenticated(): boolean {
    return !!sessionStorage.getItem('realcalcados_v3_user');
  }
 
  /**
   * Função para garantir que o RLS está ativo antes de qualquer chamada
   */
  async ensureRLS() {
    const user = this.getUser();
    if (user?.id) {
      await supabase.rpc('set_user_session', { user_id: user.id });
    }
  }
 
  // --- Módulos de Recibo (Ajustados para não depender de token fake se o RLS já resolve) ---
  
  async createReceipt(receiptData: any) {
    await this.ensureRLS();
    const { data, error } = await supabase.from('financial_receipts').insert([{
      store_id: this.getUser()?.storeId,
      payer: receiptData.payer,
      recipient: receiptData.recipient,
      value: receiptData.value,
      value_in_words: receiptData.value_in_words,
      reference: receiptData.reference,
      receipt_date: receiptData.receipt_date,
      issuer_name: receiptData.issuer_name || this.getUser()?.name
      // receipt_number e formatted_number são automáticos no banco
    }]).select().single();
 
    if (error) throw error;
    return data;
  }
 
  /**
   * ✅ CORRIGIDO: Listar recibos com filtro por loja
   */
  async listReceipts(storeId?: string, limit: number = 50) {
    try {
      await this.ensureRLS();
      
      let query = supabase
        .from('financial_receipts')
        .select('*')
        .order('receipt_number', { ascending: false })
        .limit(limit);
 
      // ✅ Se storeId foi passado, filtra por loja
      if (storeId) {
        query = query.eq('store_id', storeId);
      }
 
      const { data, error } = await query;
 
      if (error) throw error;
      return data || [];
    } catch (error: any) {
      console.error('Erro ao listar recibos:', error);
      throw error;
    }
  }

  /**
   * ✅ FUNÇÃO SEGURA: Atualizar pedido com validação
   */
  async updateBuyOrder(orderId: string, updateData: {
    user_name?: string;
    user_role?: string;
    brand_id?: string;
    marca?: string;
    fornecedor?: string;
    representante?: string;
    telefone?: string | null;
    email?: string | null;
    fat_inicio?: string | null;
    fat_fim?: string;
    prazos?: number[];
    vencimentos?: string[];
    desconto?: number;
    markup?: number;
    status?: string;
    total_pares?: number;
    total_valor_bruto?: number;
    total_valor_liquido?: number;
  }) {
    try {
      await this.ensureRLS();

      // ✅ VALIDAÇÃO: Remover campos undefined obratórios
      const cleanData = Object.entries(updateData).reduce((acc, [key, value]) => {
        if (value !== undefined) {
          acc[key as keyof typeof acc] = value;
        }
        return acc;
      }, {} as any);

      // ✅ VALIDAÇÃO: Arrays não podem estar vazios
      if (cleanData.prazos && cleanData.prazos.length === 0) {
        throw new Error('Prazos não podem estar vazios');
      }

      const { data, error } = await supabase
        .from('buy_orders')
        .update(cleanData)
        .eq('id', orderId)
        .single();

      if (error) throw error;
      return data;
    } catch (error: any) {
      console.error('❌ Erro ao atualizar pedido:', error);
      throw error;
    }
  }

  /**
   * ✅ VALIDAÇÃO: Verificar se há cota disponível para o pedido
   */
  async validarCotaDisponivel(
    store_number: string,
    valor_pedido: number,
    role: string,
    mes: number,
    ano: number
  ) {
    try {
      // Usar a RPC que já traz os cálculos do banco
      const { data, error } = await supabase.rpc('get_cotas_ano_fiscal', {
        p_store_number: store_number,
        p_start_year: ano,
        p_start_month: mes
      });

      if (error) throw error;
      
      const quota = data?.find((q: any) => q.mes === mes && q.ano === ano);
      
      if (!quota) {
        return { permitido: true, mensagem: '', excede_em: 0 };
      }

      const isGerente = role.toUpperCase() === 'GERENTE' || role.toUpperCase() === 'MANAGER';
      const cotaDisponivel = isGerente ? Number(quota.cota_gerente_valor || 0) : Number(quota.cota_comprador_valor || 0);
      
      if (valor_pedido > cotaDisponivel) {
        return {
          permitido: false,
          mensagem: `Cota insuficiente para ${isGerente ? 'GERENTE' : 'COMPRADOR'}. Disponível: R$ ${cotaDisponivel.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
          excede_em: valor_pedido - cotaDisponivel
        };
      }

      return { permitido: true, mensagem: '', excede_em: 0 };
    } catch (error) {
      console.error('Erro na validação de cota:', error);
      return { permitido: true, mensagem: '', excede_em: 0 }; 
    }
  }
}

export const apiService = new ApiService();
export default apiService;