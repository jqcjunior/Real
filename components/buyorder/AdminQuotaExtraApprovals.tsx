import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabaseClient';
import { CheckCircle, XCircle, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface QuotaExtra {
  id: string;
  store_number: string;
  month: number;
  year: number;
  tipo_comprador: string;
  valor_extra: number;
  motivo: string;
  status: string;
  created_at: string;
  solicitante: { name: string };
}

const AdminQuotaExtraApprovals: React.FC<{ userId: string }> = ({ userId }) => {
  const [solicitacoes, setSolicitacoes] = useState<QuotaExtra[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadSolicitacoes();
  }, []);

  const loadSolicitacoes = async () => {
    setIsLoading(true);
    const { data } = await supabase
      .from('buyorder_quota_extra')
      .select(`*, solicitante:admin_users!solicitado_por(name)`)
      .eq('status', 'pendente')
      .order('created_at', { ascending: false });
    
    setSolicitacoes(data || []);
    setIsLoading(false);
  };

  const handleAprovar = async (id: string) => {
    if (!confirm('Aprovar esta solicitação?')) return;

    await supabase.rpc('approve_reject_quota_extra', {
      p_extra_id: id,
      p_admin_id: userId,
      p_action: 'aprovar'
    });

    alert('✅ Aprovado!');
    loadSolicitacoes();
  };

  const handleRejeitar = async (id: string) => {
    const motivo = prompt('Motivo da rejeição (opcional mas recomendado):');
    if (motivo === null) return; // User cancelled

    await supabase.rpc('approve_reject_quota_extra', {
      p_extra_id: id,
      p_admin_id: userId,
      p_action: 'rejeitar'
    });

    // We can potentially add the rejection reason to a note/history here, 
    // but the schema doesn't have it explicitly right now, so we just reject.
    
    alert('❌ Rejeitado!');
    loadSolicitacoes();
  };

  if (isLoading) return (
    <div className="flex justify-center items-center h-32">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
    </div>
  );

  return (
    <div className="p-6">
      <h2 className="text-2xl font-black mb-6 text-slate-800 dark:text-white flex items-center gap-2">
        <Clock className="text-blue-600" />
        Solicitações de Cota Extra
      </h2>
      
      {solicitacoes.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 text-center text-slate-500">
            <CheckCircle className="mx-auto mb-3 text-emerald-500 opacity-50" size={48} />
            <p className="font-bold">Nenhuma solicitação pendente no momento</p>
            <p className="text-sm">Todas as cotas extras foram analisadas.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {solicitacoes.map(sol => (
            <div key={sol.id} className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="font-black text-lg text-slate-900 dark:text-white">
                    Loja {sol.store_number} 
                    <span className="text-slate-400 text-sm font-bold ml-2 bg-slate-100 dark:bg-slate-900 px-2 py-1 rounded-md">
                        {sol.month}/{sol.year}
                    </span>
                  </h3>
                  <p className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest mt-1">
                    {sol.solicitante?.name || 'Usuário Desconhecido'} • {sol.tipo_comprador}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    Solicitado em: {format(new Date(sol.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </p>
                </div>
                <div className="text-right">
                    <p className="text-2xl font-black text-red-600">
                        R$ {sol.valor_extra.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                    <p className="text-[10px] text-red-500 font-bold uppercase text-right mt-1">Falta solicitada</p>
                </div>
              </div>

              <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30 rounded-xl p-4 mb-5 flex-1">
                <p className="text-[10px] font-black text-amber-600 dark:text-amber-500 uppercase tracking-widest mb-1.5 flex items-center gap-1">
                    <Clock size={12} />
                    Justificativa
                </p>
                <p className="text-sm text-slate-700 dark:text-slate-300 italic">{sol.motivo}</p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => handleRejeitar(sol.id)}
                  className="flex-1 py-2.5 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/40 text-red-700 dark:text-red-400 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors border border-transparent hover:border-red-200 dark:hover:border-red-800"
                >
                  <XCircle size={18} /> Rejeitar
                </button>
                <button
                  onClick={() => handleAprovar(sol.id)}
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-600/20 rounded-xl font-bold flex items-center justify-center gap-2 transition-all"
                >
                  <CheckCircle size={18} /> Aprovar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminQuotaExtraApprovals;
