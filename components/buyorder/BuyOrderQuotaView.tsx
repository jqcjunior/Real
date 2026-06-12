import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabaseClient';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { User } from '../../types';
import ResumoAnoFiscal from './ResumoAnoFiscal.tsx';

interface Store {
  id: string;
  number: string;
  name: string;
  city: string;
  status?: string;
}

export default function BuyOrderQuotaView({ user }: { user: User }) {
  const [lojas, setLojas] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    carregarLojas();
  }, [user]);

  const carregarLojas = async () => {
    try {
      setLoading(true);
      // 1. Buscar permissões do usuário para esta página
      const { data: permissions, error: permError } = await supabase
        .from('user_store_permissions')
        .select('can_view_all_stores, allowed_store_ids')
        .eq('user_id', user.id)
        .eq('page_id', 'cotas_compra')
        .single();

      if (permError) {
        console.error('Erro ao buscar permissões:', permError);
        toast.error('Erro ao verificar permissões de acesso');
        setLoading(false);
        return;
      }

      let lojasData: Store[] = [];

      // 2. Carregar lojas baseado nas permissões
      if (permissions?.can_view_all_stores) {
        // ADMIN/COMPRADOR: Todas as lojas
        const { data, error } = await supabase
          .from('stores')
          .select('id, number, name, city, status')
          .eq('status', 'active');

        if (error) throw error;
        lojasData = data || [];

      } else if (permissions?.allowed_store_ids && permissions.allowed_store_ids.length > 0) {
        // GERENTE: Apenas lojas permitidas
        const { data, error } = await supabase
          .from('stores')
          .select('id, number, name, city, status')
          .in('id', permissions.allowed_store_ids)
          .eq('status', 'active');

        if (error) throw error;
        lojasData = data || [];

      } else {
        // SEM PERMISSÃO
        toast.error('Você não tem permissão para acessar este módulo');
        setLojas([]);
        setLoading(false);
        return;
      }

      // 3. Ordenar lojas numericamente
      const lojasOrdenadas = lojasData.sort((a, b) => {
        const numA = parseInt(a.number) || 0;
        const numB = parseInt(b.number) || 0;
        return numA - numB;
      });

      setLojas(lojasOrdenadas);
    } catch (err: any) {
      console.error('Erro ao carregar lojas:', err);
      toast.error('Erro ao carregar lojas autorizadas');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Loader2 size={40} className="animate-spin text-blue-500" />
        <p className="text-xs font-black text-slate-400 uppercase tracking-widest">
          Carregando permissões e lojas...
        </p>
      </div>
    );
  }

  if (lojas.length === 0) {
    return (
      <div className="max-w-md mx-auto text-center py-12 px-6 bg-slate-50 border border-slate-200 rounded-2xl my-8">
        <p className="text-sm font-black text-slate-500 uppercase tracking-wide">
          Permissão Negada
        </p>
        <p className="text-xs text-slate-400 mt-2">
          Nenhuma loja ativa ou vinculada à sua conta pôde ser encontrada para este módulo.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-7xl mx-auto p-4 sm:p-6 bg-white border border-slate-100 rounded-3xl shadow-sm space-y-6">
      <ResumoAnoFiscal 
        user={user} 
        stores={lojas} 
        supabase={supabase} 
      />
    </div>
  );
}
