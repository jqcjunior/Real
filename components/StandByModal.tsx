import React, { useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '../services/supabaseClient';
import { X, Clock, FileText } from 'lucide-react';

interface StandByFormData {
  reason: string;
  expectedDate: string;
}

interface StandByModalProps {
  orderId: string;
  userId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function StandByModal({ orderId, userId, onClose, onSuccess }: StandByModalProps) {
  const [formData, setFormData] = useState<StandByFormData>({
    reason: '',
    expectedDate: ''
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (formData.reason.length < 10) {
      toast.error('O motivo deve ter pelo menos 10 caracteres');
      return;
    }

    if (formData.expectedDate) {
      const selectedDate = new Date(formData.expectedDate + 'T00:00:00');
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      if (selectedDate < today) {
        toast.error('A data esperada não pode ser no passado');
        return;
      }
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.rpc('transition_order_to_stand_by', {
        p_order_id: orderId,
        p_user_id: userId,
        p_reason: formData.reason,
        p_expected_date: formData.expectedDate || null
      });

      if (error) throw error;

      if (!data.success) {
        toast.error(data.error || 'Erro ao salvar em Stand By');
        return;
      }

      toast.success('Pedido salvo em Stand By com sucesso!');
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Erro ao salvar em Stand By:', err);
      toast.error(err?.message || 'Erro ao salvar em Stand By');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] px-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden flex flex-col">
        <div className="bg-amber-50 border-b border-amber-200 px-5 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2 text-amber-800">
            <Clock size={20} className="text-amber-600" />
            <h3 className="font-bold text-lg">Salvar em Stand By</h3>
          </div>
          <button 
            onClick={onClose}
            className="text-amber-800 hover:text-amber-900 transition-colors p-1 rounded-md hover:bg-amber-200/50"
          >
            <X size={20} />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-4">
          <div className="bg-blue-50 text-blue-800 text-xs p-3 rounded-lg border border-blue-200 flex gap-2">
            <FileText size={16} className="shrink-0 mt-0.5" />
            <p>
              Pedidos em <strong>Stand By</strong> não consumirão suas cotas disponíveis até que sejam confirmados posteriormente.
            </p>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">
              Motivo da Espera <span className="text-red-500">*</span>
            </label>
            <textarea
              required
              minLength={10}
              rows={3}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
              placeholder="Ex: Aguardando confirmação de estoque do fornecedor..."
              value={formData.reason}
              onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
            />
            <p className="text-[10px] text-slate-500 mt-1">Mínimo de 10 caracteres.</p>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">
              Prazo Esperado <span className="text-slate-400 font-normal">(Opcional)</span>
            </label>
            <input
              type="date"
              className="w-full h-10 px-3 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              value={formData.expectedDate}
              onChange={(e) => setFormData({ ...formData, expectedDate: e.target.value })}
              min={new Date().toISOString().split('T')[0]}
            />
          </div>

          <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 text-sm font-medium hover:bg-slate-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || formData.reason.length < 10}
              className="px-4 py-2 bg-amber-500 text-white rounded-lg text-sm font-bold hover:bg-amber-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Clock size={16} />
                  Salvar em Stand By
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
