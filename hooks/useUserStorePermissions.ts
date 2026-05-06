import { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { toast } from 'sonner';
import { User } from '../types';

// ═══════════════════════════════════════════════════════════════════════════
// TIPOS
// ═══════════════════════════════════════════════════════════════════════════

interface Store {
  id?: string;
  number: string;
  name: string;
  city: string;
}

interface StorePermissions {
  loading: boolean;
  stores: Store[];
  canViewAllStores: boolean;
  hasAccess: boolean;
  allowedStoreIds: string[];
  refetch: () => Promise<void>;
}

// ═══════════════════════════════════════════════════════════════════════════
// HOOK: useUserStorePermissions
// ═══════════════════════════════════════════════════════════════════════════
/**
 * Hook reutilizável para controle de acesso a lojas por módulo
 * 
 * @param user - Usuário logado (tipo User)
 * @param pageId - Identificador único do módulo (ex: 'buy_order_module', 'cotas_compra')
 * @returns Objeto com loading, stores, canViewAllStores, hasAccess
 * 
 * @example
 * const { loading, stores, canViewAllStores, hasAccess } = useUserStorePermissions(user, 'buy_order_module');
 * 
 * if (loading) return <Loader />;
 * if (!hasAccess) return <SemPermissao />;
 */
export function useUserStorePermissions(user: User, pageId: string): StorePermissions {
  const [loading, setLoading] = useState(true);
  const [stores, setStores] = useState<Store[]>([]);
  const [canViewAllStores, setCanViewAllStores] = useState(false);
  const [hasAccess, setHasAccess] = useState(false);
  const [allowedStoreIds, setAllowedStoreIds] = useState<string[]>([]);

  useEffect(() => {
    if (user?.id && pageId) {
      loadStores();
    }
  }, [user?.id, pageId]);

  const loadStores = async () => {
    if (!user?.id) {
      console.error('useUserStorePermissions: user.id é obrigatório');
      setHasAccess(false);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      // 1. Buscar permissões do usuário para esta página
      const { data: permissions, error: permError } = await supabase
        .from('user_store_permissions')
        .select('can_view_all_stores, allowed_store_ids')
        .eq('user_id', user.id)
        .eq('page_id', pageId)
        .single();

      if (permError) {
        // Se não encontrou permissões, usuário não tem acesso
        if (permError.code === 'PGRST116') {
          console.warn(`Usuário ${user.id} não tem permissões para página '${pageId}'`);
          toast.error(`Você não tem permissão para acessar este módulo`);
        } else {
          console.error('Erro ao buscar permissões:', permError);
          toast.error('Erro ao verificar permissões de acesso');
        }
        setHasAccess(false);
        setStores([]);
        return;
      }

      let storesData: Store[] = [];

      // 2. Carregar lojas baseado nas permissões
      if (permissions?.can_view_all_stores) {
        // ADMIN/COMPRADOR: Todas as lojas
        const { data, error } = await supabase
          .from('stores')
          .select('id, number, name, city')
          .eq('status', 'active');

        if (error) throw error;
        storesData = data || [];
        setCanViewAllStores(true);
        setAllowedStoreIds([]);

      } else if (permissions?.allowed_store_ids && permissions.allowed_store_ids.length > 0) {
        // GERENTE: Apenas lojas permitidas
        const { data, error } = await supabase
          .from('stores')
          .select('id, number, name, city')
          .in('id', permissions.allowed_store_ids)
          .eq('status', 'active');

        if (error) throw error;
        storesData = data || [];
        setCanViewAllStores(false);
        setAllowedStoreIds(permissions.allowed_store_ids);

      } else {
        // SEM PERMISSÃO
        console.warn(`Usuário ${user.id} sem lojas permitidas para página '${pageId}'`);
        toast.error('Você não tem permissão para acessar este módulo');
        setHasAccess(false);
        setStores([]);
        return;
      }

      // 3. Ordenar lojas numericamente
      const sortedStores = storesData.sort((a, b) => {
        const numA = parseInt(a.number) || 0;
        const numB = parseInt(b.number) || 0;
        return numA - numB;
      });

      setStores(sortedStores);
      setHasAccess(true);

    } catch (err) {
      console.error('Erro ao carregar lojas:', err);
      toast.error('Erro ao carregar lojas');
      setHasAccess(false);
      setStores([]);
    } finally {
      setLoading(false);
    }
  };

  return { 
    loading, 
    stores, 
    canViewAllStores, 
    hasAccess,
    allowedStoreIds,
    refetch: loadStores
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPER: Verificar se usuário pode acessar loja específica
// ═══════════════════════════════════════════════════════════════════════════
/**
 * Verifica se o usuário tem permissão para acessar uma loja específica
 * 
 * @param storeId - ID da loja (UUID)
 * @param permissions - Retorno do hook useUserStorePermissions
 * @returns true se tiver acesso, false caso contrário
 */
export function canAccessStore(
  storeId: string, 
  permissions: Pick<StorePermissions, 'canViewAllStores' | 'allowedStoreIds'>
): boolean {
  if (permissions.canViewAllStores) return true;
  return permissions.allowedStoreIds.includes(storeId);
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPER: Filtrar lista de lojas por permissões
// ═══════════════════════════════════════════════════════════════════════════
/**
 * Filtra uma lista de lojas baseado nas permissões do usuário
 * 
 * @param allStores - Lista completa de lojas
 * @param permissions - Retorno do hook useUserStorePermissions
 * @returns Lista filtrada de lojas que o usuário pode acessar
 */
export function filterStoresByPermissions<T extends { id: string }>(
  allStores: T[],
  permissions: Pick<StorePermissions, 'canViewAllStores' | 'allowedStoreIds'>
): T[] {
  if (permissions.canViewAllStores) return allStores;
  return allStores.filter(store => permissions.allowedStoreIds.includes(store.id));
}