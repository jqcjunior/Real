
import { useMemo } from 'react';
import { Role } from './roles';
import { PermissionKey } from './permissions';
import { canAccess } from './authorization';

export const useAuthorization = (userRole: Role | string | undefined | null) => {
  /**
   * Função can: Retorna true se o usuário atual puder acessar a funcionalidade.
   * Uso: if (can('MODULE_METAS')) { ... }
   */
  const can = useMemo(() => (permission: PermissionKey): boolean => {
    return canAccess(userRole, permission);
  }, [userRole]);

  return { can };
};
