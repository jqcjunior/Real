import React, { useState } from 'react';
import { supabase } from '../services/supabaseClient';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  deficit: number;
  mesEntrega: number;
  anoEntrega: number;
  storeNumber: string;
  userRole: 'gerente' | 'comprador';
  orderId: string | null;
  userId: string;
  onSuccess: () => void;
}

const SolicitarCotaExtraModal: React.FC<Props> = ({
  isOpen, onClose, deficit, mesEntrega, anoEntrega,
  storeNumber, userRole, orderId, userId, onSuccess
}) => {
  const [motivo, setMotivo] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSolicitar = async () => {
    if (!motivo.trim() || motivo.length < 20) {
      alert('Justificativa deve ter pelo menos 20 caracteres');
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.rpc('request_quota_extra', {
        p_store_number: storeNumber,
        p_month: mesEntrega,
        p_year: anoEntrega,
        p_tipo_comprador: userRole,
        p_valor_extra: deficit,
        p_motivo: motivo.trim(),
        p_order_id: orderId,
        p_user_id: userId
      });

      if (error) throw error;
      
      alert('✅ Solicitação enviada! Aguarde aprovação do admin.');
      setMotivo('');
      onSuccess();
      onClose();
    } catch (err: any) {
      alert('Erro: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full p-6 shadow-2xl">
        
        <h3 className="text-2xl font-black text-red-600 dark:text-red-500 mb-4 flex items-center gap-2">
          🚫 Cota Insuficiente
        </h3>

        <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-4 mb-4 border border-red-100 dark:border-red-900/30">
          <p className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
            Mês: <span className="text-slate-900 dark:text-white font-black">{mesEntrega}/{anoEntrega}</span> | <span className="uppercase">{userRole}</span>
          </p>
          <p className="text-2xl font-black text-red-600 dark:text-red-500">
            Falta: R$ {deficit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
        </div>

        <div className="mb-4">
          <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">
            Justificativa * (mín. 20 caracteres)
          </label>
          <textarea
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Ex: Oportunidade especial com desconto de 30% no volume..."
            rows={4}
            className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500 dark:text-slate-100"
          />
          <p className={`text-xs mt-1 font-medium ${motivo.length < 20 ? 'text-amber-500' : 'text-emerald-500'}`}>
            {motivo.length} caracteres
          </p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl font-bold transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSolicitar}
            disabled={isLoading || motivo.length < 20}
            className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/20 rounded-xl font-bold disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {isLoading ? 'Enviando...' : 'Solicitar'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SolicitarCotaExtraModal;
