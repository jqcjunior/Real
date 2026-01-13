
import { Role } from './roles';
import { PERMISSIONS_MAP, PermissionKey } from './permissions';

/**
 * Verifica se um papel tem acesso a uma permissão específica.
 * Blindado contra valores nulos ou indefinidos.
 */
export const canAccess = (role: Role | string | undefined | null, permission: PermissionKey): boolean => {
  if (!role) return false;
  
  const allowedRoles = PERMISSIONS_MAP[permission];
  if (!allowedRoles) {
    console.warn(`Permissão não mapeada: ${permission}`);
    return false;
  }

  return allowedRoles.includes(role as Role);
};
