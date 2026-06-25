import { supabase } from './supabaseClient';
 
class ApiService {
  /**
   * Login do usuário - Integrado com RLS
   */
  async login(email: string, password: string) {
    try {
      const { data, error } = await supabase.rpc('authenticate_user', {
        p_email: email.trim(),
        p_password: password.trim()
      });

      if (error || !data || data.length === 0) {
        throw new Error('Credenciais inválidas');
      }

      const userData = data[0];

      // Aceitar id ou user_id
      const userId = userData.id || userData.user_id || userData.userId;

      if (!userId) {
        throw new Error('Erro interno: ID do usuário não encontrado');
      }

      // 🔥 CRÍTICO: Setar sessão ANTES de retornar
      const { error: sessionError } = await supabase.rpc('set_user_session', {
        p_user_id: String(userId)  // ← Parâmetro correto é p_user_id, NÃO user_id
      });

      if (sessionError) {
        console.error('❌ ERRO AO SETAR SESSÃO:', sessionError);
        throw new Error('Falha ao estabelecer sessão');
      }

      console.log('✅ Sessão setada com sucesso para user_id:', userId);

      // Persistir no localStorage para auto-login
      const mappedUser = {
        id: userId,
        user_id: userId,
        name: userData.name,
        email: userData.email,
        role: (userData.role_level || userData.role || 'CASHIER').toUpperCase(),
        role_level: (userData.role_level || userData.role || 'CASHIER').toUpperCase(),
        storeId: userData.store_id || userData.storeId,
        store_id: userData.store_id || userData.storeId
      };
      localStorage.setItem('realcalcados_user', JSON.stringify(mappedUser));
      localStorage.setItem('auth_token', 'session_' + userId);

      return { user: mappedUser };
    } catch (error: any) {
      console.error('❌ Erro no login:', error);
      throw error;
    }
  }
 
  async logout() {
    console.log('👋 Logout: limpando dados locais');
    localStorage.removeItem('realcalcados_user');
    localStorage.removeItem('auth_token');
    localStorage.clear();
    window.location.reload(); 
  }

  getUser() {
    try {
      const userStr = localStorage.getItem('realcalcados_user');
      return userStr ? JSON.parse(userStr) : null;
    } catch (error) {
      console.error('Erro ao ler usuário do localStorage:', error);
      return null;
    }
  }

  getToken() {
    return localStorage.getItem('auth_token');
  }

  isAuthenticated(): boolean {
    return !!localStorage.getItem('realcalcados_user');
  }

  /**
   * ✅ FUNÇÃO CORRIGIDA: Garantir que o RLS está ativo antes de qualquer chamada
   */
  async ensureRLS() {
    const user = this.getUser();
    
    if (!user) {
      console.warn('⚠️ ensureRLS: sem usuário logado');
      return;
    }

    const userId = user.id || user.user_id || user.userId;
    
    if (!userId) {
      console.error('❌ ensureRLS: usuário sem ID válido');
      return;
    }

    try {
      const { error } = await supabase.rpc('set_user_session', { 
        p_user_id: String(userId) // ✅ usar p_user_id consistente com a DB
      });
      
      if (error) {
        console.error('❌ Erro ao reestabelecer RLS:', error);
      }
    } catch (err) {
      console.error('❌ Exceção em ensureRLS:', err);
    }
  }
 
  // --- Módulos de Recibo ---
  
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
    }]).select().single();
 
    if (error) throw error;
    return data;
  }
 
  async listReceipts(storeId?: string, limit: number = 50) {
    try {
      await this.ensureRLS();
      
      let query = supabase
        .from('financial_receipts')
        .select('*')
        .order('receipt_number', { ascending: false })
        .limit(limit);
 
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

  async updateBuyOrder(orderId: string, updateData: {
    user_name?: string;
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
    order_type?: string;
    confirmed_at?: string;
    edited_by?: string;
    edited_at?: string;
    modo_pesquisa?: boolean;
    survey_params?: any;
  }) {
    try {
      await this.ensureRLS();

      const cleanData = Object.entries(updateData).reduce((acc, [key, value]) => {
        if (value !== undefined) {
          acc[key as keyof typeof acc] = value;
        }
        return acc;
      }, {} as any);

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

  async validarCotaDisponivel(
    store_number: string,
    valor_pedido: number,
    role: string,
    mes: number,
    ano: number
  ) {
    try {
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
      const cotaDisponivel = isGerente 
        ? Number(quota.otb_maximo_compravel_gerente || 0) 
        : Number(quota.otb_maximo_compravel_comprador || 0);
      
      if (valor_pedido > cotaDisponivel) {
        return {
          permitido: false,
          mensagem: `Cota OTB insuficiente para ${isGerente ? 'GERENTE' : 'COMPRADOR'}. Disponível: R$ ${cotaDisponivel.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
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