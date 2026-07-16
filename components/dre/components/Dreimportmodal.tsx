import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Upload, AlertCircle, CheckCircle, FileSpreadsheet, Calendar, Building2 } from 'lucide-react';
import type { DREData } from '../types/dre.types';

interface DREImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  preview: DREData[];
  mesReferencia: string | null;
  importing: boolean;
  progress: number;
  statusMessage: string;
  errors: Array<{ row: number; field: string; error: string }>;
  stats: { valid: number; invalid: number };
}

export const DREImportModal: React.FC<DREImportModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  preview,
  mesReferencia,
  importing,
  progress,
  statusMessage,
  errors,
  stats
}) => {
  // ✅ LOCK BODY SCROLL
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'auto';
    }
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, [isOpen]);

  if (!isOpen || typeof document === 'undefined') return null;

  const lojas = Array.from(new Set(preview.map(p => p.loja_id))).sort((a, b) => a - b);
  const meses = Array.from(new Set(preview.map(p => p.mes_referencia))).sort();
  const hasErrors = errors.length > 0;

  const formatMes = (dateStr: string) => {
    const date = new Date(dateStr);
    const months = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
    const month = months[date.getUTCMonth()];
    const year = String(date.getUTCFullYear()).slice(-2);
    return `${month} ${year}`;
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const modalContent = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-4xl max-h-[90vh] bg-white rounded-2xl shadow-2xl flex flex-col animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* HEADER */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-indigo-50 to-white rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 rounded-lg">
              <FileSpreadsheet className="w-6 h-6 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                Prévia de Importação DRE
              </h2>
              <p className="text-sm text-gray-600">
                Confira os dados antes de salvar
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={importing}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* SUMMARY CARDS */}
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 px-6 py-4 bg-gray-50 border-b border-gray-200">
          
          {/* LOJAS (Compacto e Centralizado) */}
          <div className="bg-white rounded-xl p-2 border border-gray-200 shadow-sm sm:col-span-1 flex flex-col items-center justify-center text-center">
            <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1">
              Lojas
            </p>
            <div className="flex items-center gap-1.5 translate-y-0.5">
              <Building2 className="w-3.5 h-3.5 text-blue-500 shrink-0" />
              <p className="text-sm font-black text-gray-900 truncate uppercase tabular-nums leading-none">
                {lojas.length > 0 ? lojas.join(', ') : '-'}
              </p>
            </div>
          </div>

          {/* PERÍODOS (Espaço Principal) */}
          <div className="bg-white rounded-xl p-3 border border-indigo-100 shadow-sm sm:col-span-3 ring-2 ring-indigo-50/50">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-50 rounded-lg shrink-0">
                <Calendar className="w-5 h-5 text-indigo-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider">
                  Meses Identificados
                </p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {meses.length > 0 ? (
                    meses.map((m, i) => (
                      <span key={i} className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded text-[10px] font-black uppercase italic tracking-tighter">
                        {formatMes(m)}
                      </span>
                    ))
                  ) : (
                    <span className="text-sm font-bold text-gray-400">-</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* REGISTROS (Compacto e Centralizado) */}
          <div className="bg-white rounded-xl p-2 border border-gray-200 shadow-sm sm:col-span-1 flex flex-col items-center justify-center text-center">
            <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">
              Registros
            </p>
            <div className={`flex flex-col items-center leading-none ${hasErrors ? 'text-red-600' : 'text-emerald-600'}`}>
              <span className="text-base font-black italic">
                {stats.valid.toLocaleString('pt-BR')}
              </span>
              <span className="text-[9px] font-black uppercase tracking-tighter">
                Válidos
              </span>
            </div>
          </div>
        </div>

        {/* ERRORS SECTION */}
        {hasErrors && (
          <div className="px-6 py-4 bg-red-50 border-b border-red-200">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-red-900 mb-2">
                  {errors.length} erro(s) encontrado(s):
                </h3>
                <div className="space-y-1 max-h-24 overflow-y-auto">
                  {errors.slice(0, 5).map((err, idx) => (
                    <p key={idx} className="text-sm text-red-700">
                      • Linha {err.row}: {err.error}
                    </p>
                  ))}
                  {errors.length > 5 && (
                    <p className="text-xs text-red-600 italic">
                      + {errors.length - 5} erro(s) adicional(is)
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* PREVIEW TABLE */}
        <div className="flex-1 overflow-auto px-6 py-4 max-h-[400px]">
          <div className="overflow-x-auto -mx-6 px-6">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Loja
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Período
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Conta
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider hidden sm:table-cell">
                    Tipo
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Valor
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {preview.slice(0, 20).map((row, idx) => (
                  <tr key={idx} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {row.loja_id}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-gray-600">
                      {formatMes(row.mes_referencia)}
                    </td>
                    <td className="px-4 py-3 text-gray-900 max-w-[200px] truncate">
                      {row.name || row.descricao}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap hidden sm:table-cell">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                        row.type === 'RECEITA' 
                          ? 'bg-green-100 text-green-800'
                          : row.type === 'DESPESA'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {row.type}
                      </span>
                    </td>
                    <td className={`px-4 py-3 text-right font-medium whitespace-nowrap ${
                      row.valor < 0 ? 'text-red-600' : 'text-gray-900'
                    }`}>
                      {formatCurrency(row.valor)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {preview.length > 20 && (
            <div className="mt-4 text-center">
              <p className="text-sm text-gray-500">
                Mostrando 20 de {preview.length.toLocaleString('pt-BR')} registros
              </p>
            </div>
          )}
        </div>

        {/* PROGRESS BAR (quando importando) */}
        {importing && (
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
            <div className="flex items-center gap-3 mb-2">
              <Upload className="w-5 h-5 text-indigo-600 animate-bounce" />
              <p className="text-sm font-medium text-gray-700">
                {statusMessage}
              </p>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
              <div 
                className="bg-gradient-to-r from-indigo-500 to-indigo-600 h-2.5 rounded-full transition-all duration-300 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-xs text-gray-500 mt-1 text-right">
              {progress}%
            </p>
          </div>
        )}

        {/* FOOTER */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-3 px-6 py-4 bg-gray-50 border-t border-gray-200 rounded-b-2xl">
          <button
            onClick={onClose}
            disabled={importing}
            className="px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={importing || hasErrors || preview.length === 0}
            className="px-6 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-indigo-600 to-indigo-700 rounded-lg hover:from-indigo-700 hover:to-indigo-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 shadow-lg shadow-indigo-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
          >
            {importing ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Importando...
              </span>
            ) : (
              `Confirmar Importação (${stats.valid})`
            )}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};