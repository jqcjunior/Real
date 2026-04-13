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
        // Usamos localStorage para suportar auto-login e consistência com ensureSession
        localStorage.setItem('user', JSON.stringify(mappedUser));
        localStorage.setItem('auth_token', 'session_' + user.user_id);

        return { success: true, user: mappedUser };
    } catch (error: any) {
      console.error('Erro no login:', error);
      throw error;
    }
  }

  async logout() {
    localStorage.clear();
    sessionStorage.clear();
    window.location.reload(); 
  }

  getUser() {
    try {
      const userStr = localStorage.getItem('user');
      return userStr ? JSON.parse(userStr) : null;
    } catch (error) {
      return null;
    }
  }

  getToken() {
    return localStorage.getItem('auth_token');
  }

  isAuthenticated(): boolean {
    return !!localStorage.getItem('user');
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
      receipt_number: receiptData.receipt_number,
      formatted_number: receiptData.formatted_number
    }]).select().single();

    if (error) throw error;
    return data;
  }

  /**
   * Buscar próximo número de recibo
   */
  async getNextReceiptNumber() {
    try {
      await this.ensureRLS();
      const { data, error } = await supabase.rpc('fn_get_next_receipt_number', {
        p_token: this.getToken()
      });

      if (error) throw error;

      if (data.success) {
        return {
          next_number: data.next_number,
          formatted: data.formatted
        };
      } else {
        throw new Error(data.error);
      }
    } catch (error: any) {
      console.error('Erro ao buscar próximo número:', error);
      throw error;
    }
  }

  /**
   * Listar recibos
   */
  async listReceipts(limit: number = 50) {
    try {
      await this.ensureRLS();
      const { data, error } = await supabase.rpc('fn_list_receipts', {
        p_token: this.getToken(),
        p_limit: limit
      });

      if (error) throw error;

      if (data.success) {
        return data.receipts;
      } else {
        throw new Error(data.error);
      }
    } catch (error: any) {
      console.error('Erro ao listar recibos:', error);
      throw error;
    }
  }
}

export const apiService = new ApiService();
export default apiService;