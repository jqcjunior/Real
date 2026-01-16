
import { Role } from './roles';
import { PERMISSIONS_MAP, PermissionKey } from './permissions';

/**
 * Verifica se um papel tem acesso a uma permissão específica.
 * ADMIN possui acesso total e irrestrito (God Mode).
 */
export const canAccess = (role: Role | string | undefined | null, permission: PermissionKey): boolean => {
  if (!role) return false;
  
  // ADMIN tem acesso a TUDO, independente do mapa
  if (role.toUpperCase() === 'ADMIN') return true;

  const allowedRoles = PERMISSIONS_MAP[permission];
  if (!allowedRoles) {
    console.warn(`Permissão não mapeada: ${permission}`);
    return false;
  }

  return allowedRoles.includes(role.toUpperCase() as Role);
};
