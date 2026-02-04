import { UserRole } from './types';

export const getPermissionColumn = (role: UserRole | string): string => {
  const r = String(role).toUpperCase().trim();
  
  if (r === UserRole.ADMIN) return 'allow_admin';
  if (r === UserRole.MANAGER || r === 'GERENTE') return 'allow_manager';
  if (r === UserRole.CASHIER || r === 'CAIXA') return 'allow_cashier';
  if (r === UserRole.ICE_CREAM || r === 'SORVETE' || r === 'SORVETERIA') return 'allow_sorvete';
  
  return '';
};