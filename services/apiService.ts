import { supabase } from './supabaseClient';

/**
 * Serviço de API usando Database Functions do Supabase
 * Backend completo sem precisar de servidor Node.js!
 */

class ApiService {
  /**
   * Login do usuário
   */
  async login(email: string, password: string) {
    try {
      const { data, error } = await supabase.rpc('fn_login', {
        p_email: email,
        p_password: password
      });

      if (error) throw error;

      if (data.success) {
        // Salvar token no localStorage
        localStorage.setItem('auth_token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        return data;
      } else {
        throw new Error(data.error);
      }
    } catch (error: any) {
      console.error('Erro no login:', error);
      throw error;
    }
  }

  /**
   * Logout
   */
  async logout() {
    try {
      const token = this.getToken();
      if (token) {
        await supabase.rpc('fn_logout', { p_token: token });
      }
      localStorage.removeItem('auth_token');
      localStorage.removeItem('user');
    } catch (error) {
      console.error('Erro no logout:', error);
      localStorage.removeItem('auth_token');
      localStorage.removeItem('user');
    }
  }

  /**
   * Pegar token do localStorage
   */
  getToken(): string | null {
    return localStorage.getItem('auth_token');
  }

  /**
   * Pegar usuário do localStorage
   */
  getUser() {
    try {
      const userStr = localStorage.getItem('user');
      return userStr ? JSON.parse(userStr) : null;
    } catch (error) {
      console.error('Erro ao ler usuário do localStorage:', error);
      localStorage.removeItem('user');
      return null;
    }
  }

  /**
   * Verificar se está autenticado
   */
  isAuthenticated(): boolean {
    return !!this.getToken();
  }

  /**
   * Criar recibo
   */
  async createReceipt(receiptData: {
    payer: string;
    recipient: string;
    value: number;
    value_in_words: string;
    reference: string;
    receipt_date: string;
  }) {
    try {
      const token = this.getToken();
      if (!token) throw new Error('Não autenticado');

      const { data, error } = await supabase.rpc('fn_create_receipt', {
        p_token: token,
        p_payer: receiptData.payer,
        p_recipient: receiptData.recipient,
        p_value: receiptData.value,
        p_value_in_words: receiptData.value_in_words,
        p_reference: receiptData.reference,
        p_receipt_date: receiptData.receipt_date
      });

      if (error) throw error;

      if (data.success) {
        return data.receipt;
      } else {
        throw new Error(data.error);
      }
    } catch (error: any) {
      console.error('Erro ao criar recibo:', error);
      throw error;
    }
  }

  /**
   * Buscar próximo número de recibo
   */
  async getNextReceiptNumber() {
    try {
      const token = this.getToken();
      if (!token) throw new Error('Não autenticado');

      const { data, error } = await supabase.rpc('fn_get_next_receipt_number', {
        p_token: token
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
      const token = this.getToken();
      if (!token) throw new Error('Não autenticado');

      const { data, error } = await supabase.rpc('fn_list_receipts', {
        p_token: token,
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
