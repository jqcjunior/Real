import React from 'react';
import { X, AlertTriangle, ShieldAlert } from 'lucide-react';

interface QuotaInsufficientModalProps {
  available: number;
  required: number;
  deficit: number;
  buyerType: 'GERENTE' | 'COMPRADOR' | string;
  onClose: () => void;
}

export function QuotaInsufficientModal({
  available,
  required,
  deficit,
  buyerType,
  onClose
}: QuotaInsufficientModalProps) {
  const formatMoney = (val: number) => {
    return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] px-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden flex flex-col">
        <div className="bg-red-50 border-b border-red-200 px-5 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2 text-red-800">
            <ShieldAlert size={20} className="text-red-600" />
            <h3 className="font-bold text-lg">Cota Insuficiente</h3>
          </div>
          <button 
            onClick={onClose}
            className="text-red-800 hover:text-red-900 transition-colors p-1 rounded-md hover:bg-red-200/50"
          >
            <X size={20} />
          </button>
        </div>
        
        <div className="p-6 flex flex-col gap-5">
          <p className="text-sm text-slate-700 leading-relaxed text-center">
            Não há cota suficiente para confirmar este pedido neste momento.
          </p>

          <div className="bg-slate-50 border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 flex justify-between items-center bg-white">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Tipo Comprador</span>
              <span className="text-sm font-bold text-slate-800">{buyerType || 'N/A'}</span>
            </div>
            
            <div className="px-4 py-3 border-b border-slate-200 flex justify-between items-center">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Cota Disponível</span>
              <span className="text-base font-bold text-green-600">{formatMoney(available)}</span>
            </div>

            <div className="px-4 py-3 border-b border-slate-200 flex justify-between items-center bg-white">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Valor do Pedido</span>
              <span className="text-base font-bold text-slate-800">{formatMoney(required)}</span>
            </div>

            <div className="px-4 py-3 flex justify-between items-center bg-red-50">
              <span className="text-xs font-black text-red-700 uppercase tracking-wider">Déficit</span>
              <span className="text-lg font-black text-red-600">-{formatMoney(deficit)}</span>
            </div>
          </div>

          <div className="bg-amber-50 text-amber-800 text-xs p-3 rounded-lg border border-amber-200 flex gap-2">
            <AlertTriangle size={24} className="shrink-0 text-amber-600" />
            <p>
              Você pode manter este pedido em <strong>Stand By</strong> enquanto aguarda a liberação de mais cota ou solicita aumento ao administrador.
            </p>
          </div>

          <div className="flex justify-end pt-2">
            <button
              onClick={onClose}
              className="w-full px-4 py-3 bg-slate-800 text-white rounded-lg text-sm font-bold hover:bg-slate-900 transition-colors shadow-sm"
            >
              Entendi
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
