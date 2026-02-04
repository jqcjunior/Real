import { getPermissionColumn } from './permissions.utils';

export const GELATERIA_PERMISSIONS_MAP: Record<string, string> = {
  PDV: 'MODULE_GELATERIA_PDV',
  ESTOQUE: 'MODULE_GELATERIA_ESTOQUE',
  DRE_DIARIO: 'MODULE_GELATERIA_DRE_DIARIO',
  DRE_MENSAL: 'MODULE_GELATERIA_DRE_MENSAL',
  CONFIG: 'MODULE_GELATERIA_CONFIG',
  AUDIT: 'MODULE_GELATERIA_AUDIT'
};

/**
 * Resolve as abas visíveis filtrando o array de abas da Gelateria.
 * @param pagePermissions Array de objetos de permissão vindos do banco.
 * @param userRole Role do usuário logado.
 * @returns Array de strings (visibleTabs) contendo apenas as abas permitidas.
 */
export const getVisibleTabs = (pagePermissions: any[], userRole: string): string[] => {
  const column = getPermissionColumn(userRole);
  
  // 1. Criar um Set de page_key permitidos com base no banco
  const allowedPageKeys = new Set(
    pagePermissions
      .filter(p => p[column] === true)
      .map(p => p.page_key)
  );

  // 2. Filtrar o array de abas (chaves do mapa) usando GELATERIA_PERMISSIONS_MAP
  // 3. Retornar um novo array chamado visibleTabs
  const visibleTabs = Object.keys(GELATERIA_PERMISSIONS_MAP).filter(aba => 
    allowedPageKeys.has(GELATERIA_PERMISSIONS_MAP[aba])
  );

  return visibleTabs;
};