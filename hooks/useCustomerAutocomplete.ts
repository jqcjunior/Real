import { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';

export function useCustomerAutocomplete(searchTerm: string, minChars = 2) {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (searchTerm.length < minChars) {
      setSuggestions([]);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('ice_cream_sales')
          .select('buyer_name')
          .ilike('buyer_name', `%${searchTerm}%`)
          .not('buyer_name', 'is', null)
          .order('created_at', { ascending: false })
          .limit(50);

        if (error) throw error;

        // Pegar nomes únicos (case-insensitive)
        const uniqueNames = Array.from(
          new Set(
            (data || [])
              .map(item => item.buyer_name?.trim())
              .filter(name => name && name.length > 0)
          )
        ).slice(0, 8);

        setSuggestions(uniqueNames);
      } catch (err) {
        console.error('Erro ao buscar nomes:', err);
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    }, 300); // Debounce de 300ms

    return () => clearTimeout(timer);
  }, [searchTerm, minChars]);

  return { suggestions, loading };
}
