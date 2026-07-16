import { SupabaseClient } from '@supabase/supabase-js';

export async function cleanupOrphanPhotos(supabase: SupabaseClient): Promise<{ deleted: number; errors: string[] }> {
  const errors: string[] = [];

  // 1. Buscar fotos órfãs via RPC
  const { data: orphans, error } = await supabase.rpc('fn_get_orphan_catalog_photos');

  if (error || !orphans || orphans.length === 0) {
    return { deleted: 0, errors: error ? [error.message] : [] };
  }

  // 2. Deletar arquivos do Storage (bucket Fotos)
  const storagePaths = orphans.map((o: any) => o.storage_path).filter(Boolean);

  if (storagePaths.length > 0) {
    const { error: storageError } = await supabase.storage
      .from('Fotos')
      .remove(storagePaths);

    if (storageError) {
      errors.push(`Storage: ${storageError.message}`);
    }
  }

  // 3. Deletar registros órfãos do catálogo
  const { data: deletedCount, error: dbError } = await supabase.rpc('fn_delete_orphan_catalog');

  if (dbError) {
    errors.push(`DB: ${dbError.message}`);
  }

  return { deleted: deletedCount || 0, errors };
}
