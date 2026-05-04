import { useState, useCallback } from 'react';
import { supabase } from '@/services/supabaseClient';

// Cache em memória (não busca sempre)
const brandsCache = new Map<string, any>();

// Função debounce custom
function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

// Hook personalizado para autocomplete de marca
export const useBrandAutocomplete = () => {
  const [isLoading, setIsLoading] = useState(false);
  
  const fetchAndFillBrand = useCallback(
    debounce(async (marcaInput: string, setCab: Function) => {
      // Validações
      if (!marcaInput || marcaInput.length < 2) return;
      
      const marcaKey = marcaInput.toUpperCase().trim();
      
      // Verificar cache primeiro
      if (brandsCache.has(marcaKey)) {
        const cached = brandsCache.get(marcaKey);
        setCab((prev: any) => ({
          ...prev,
          brand_id: cached.id,
          fornecedor: cached.fornecedor,
          representante: cached.representante,
          telefone: cached.telefone || '',
          email: cached.email || ''
        }));
        return;
      }
      
      setIsLoading(true);
      
      try {
        const { data, error } = await supabase
          .from('buy_brands')
          .select('*')
          .ilike('marca', `${marcaKey}%`) // Busca que começa com
          .eq('is_active', true)
          .limit(1)
          .maybeSingle();
        
        if (data && !error) {
          // Adicionar ao cache
          brandsCache.set(marcaKey, data);
          
          // Autofill automático
          setCab((prev: any) => ({
            ...prev,
            marca: data.marca, // Completa o nome da marca
            brand_id: data.id,
            fornecedor: data.fornecedor,
            representante: data.representante,
            telefone: data.telefone || '',
            email: data.email || ''
          }));
        }
      } catch (err) {
        console.error('Erro ao buscar marca:', err);
      } finally {
        setIsLoading(false);
      }
    }, 500), // Aguarda 500ms após parar de digitar
    []
  );
  
  return { fetchAndFillBrand, isLoading };
};
