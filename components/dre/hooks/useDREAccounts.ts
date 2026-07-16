import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/services/supabaseClient';

export interface DREAccount {
  id: string;
  code: string;
  name: string;
  type: 'RECEITA' | 'DESPESA' | 'RESULTADO';
  category?: string;
  level: number;
  parent_code: string | null;
  sort_order: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
  expanded?: boolean;
}

const CACHE_KEY = 'dre_accounts_cache';

export function useDREAccounts() {
  const [accounts, setAccounts] = useState<DREAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [expandedCodes, setExpandedCodes] = useState<Set<string>>(new Set());

  const fetchAccounts = useCallback(async (force = false) => {
    setLoading(true);
    
    if (!force) {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          setAccounts(parsed);
          setLoading(false);
        } catch (e) {
          localStorage.removeItem(CACHE_KEY);
        }
      }
    }

    try {
      const { data, error: sbError } = await supabase
        .from('chart_of_accounts')
        .select('*')
        .order('code', { ascending: true});

      if (sbError) throw sbError;

      if (data) {
        setAccounts(data);
        localStorage.setItem(CACHE_KEY, JSON.stringify(data));
      }
    } catch (err: any) {
      console.error('Erro ao buscar contas DRE:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  const filteredAccounts = useMemo(() => {
    let result = accounts;

    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      result = result.filter(acc => 
        acc.name.toLowerCase().includes(lower) || 
        acc.code.toLowerCase().includes(lower)
      );
    }

    if (filterType !== 'ALL') {
      result = result.filter(acc => acc.type === filterType);
    }

    if (filterStatus !== 'ALL') {
      const isActive = filterStatus === 'ACTIVE';
      result = result.filter(acc => acc.is_active === isActive);
    }

    return result;
  }, [accounts, searchTerm, filterType, filterStatus]);

  const toggleExpand = (code: string) => {
    setExpandedCodes(prev => {
      const next = new Set(prev);
      if (next.has(code)) {
        next.delete(code);
      } else {
        next.add(code);
      }
      return next;
    });
  };

  const expandAll = () => {
    const allCodes = new Set(accounts.filter(a => !!a.code).map(a => a.code));
    setExpandedCodes(allCodes);
  };

  const collapseAll = () => {
    setExpandedCodes(new Set());
  };

  return {
    accounts: filteredAccounts,
    allAccounts: accounts,
    loading,
    error,
    searchTerm,
    setSearchTerm,
    filterType,
    setFilterType,
    filterStatus,
    setFilterStatus,
    expandedCodes,
    toggleExpand,
    expandAll,
    collapseAll,
    refresh: () => fetchAccounts(true)
  };
}