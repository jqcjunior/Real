import React, { useState, useCallback } from 'react';
import { Upload, FileText, CheckCircle, AlertCircle, X, Loader2, AlertTriangle } from 'lucide-react';
import { parseExcelDRE, insertDREDataParsed } from '../services/dreParser.service';

interface DREUploadProps {
  onSuccess: () => void;
}

const DREUpload: React.FC<DREUploadProps> = ({ onSuccess }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorList, setErrorList] = useState<string[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [successInfo, setSuccessInfo] = useState<{
    rows: number;
    stores: number;
    monthsInvolved: string[];
  } | null>(null);

  const processExcel = async (file: File) => {
    setIsProcessing(true);
    setError(null);
    setErrorList([]);
    setWarnings([]);

    try {
      const result = await parseExcelDRE(file);
      
      if (!result.success) {
        if (result.errors && result.errors.length > 0) {
          setError(result.errors[0]);
          setErrorList(result.errors);
        } else {
          setError('Falha ao processar arquivo.');
        }
        return;
      }

      if (result.warnings) {
        setWarnings(result.warnings);
      }

      // Inserir no Supabase
      const insertResult = await insertDREDataParsed(result.data);
      
      if (!insertResult.success) {
        throw new Error(insertResult.error);
      }

      setSuccessInfo({
        rows: result.totalLinhas,
        stores: result.totalLojas,
        monthsInvolved: result.mesesEncontrados
      });

      // Notificar sucesso após breve delay
      setTimeout(() => {
        onSuccess();
      }, 3000);

    } catch (err: any) {
      console.error('[DRE Upload] Erro:', err);
      setError(err.message || 'Falha ao processar arquivo.');
    } finally {
      setIsProcessing(false);
    }
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files[0];
    if (file && (file.name.endsWith('.xlsx') || file.name.endsWith('.xls'))) {
      processExcel(file);
    } else {
      setError('Por favor, envie um arquivo Excel (.xlsx ou .xls)');
    }
  }, []);

  const onFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processExcel(file);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {!successInfo ? (
        <div 
          className={`
            relative border-2 border-dashed rounded-[32px] p-12 transition-all flex flex-col items-center gap-4 text-center
            ${isDragging ? 'border-blue-500 bg-blue-50/50' : 'border-slate-200 hover:border-blue-400 bg-slate-50/50'}
            ${isProcessing ? 'opacity-50 pointer-events-none' : 'cursor-pointer'}
          `}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={onDrop}
          onClick={() => document.getElementById('dre-file-input')?.click()}
        >
          <input 
            id="dre-file-input"
            type="file" 
            className="hidden" 
            accept=".xlsx, .xls"
            onChange={onFileInputChange}
          />

          <div className="w-20 h-20 bg-blue-100 dark:bg-blue-900/30 rounded-[24px] flex items-center justify-center text-blue-600 mb-2">
            {isProcessing ? <Loader2 className="animate-spin" size={40} /> : <Upload size={40} />}
          </div>

          <div>
             <h3 className="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tighter">
               Arraste seu DRE consolidado
             </h3>
             <p className="text-slate-500 text-xs font-bold uppercase mt-1">Ou clique para selecionar o arquivo Excel</p>
          </div>

          <div className="flex flex-wrap gap-2 justify-center mt-4">
             {['B: Grupo', 'C: Descrição', 'D: Lj', 'E-P: Jan-Dez'].map(col => (
               <span key={col} className="px-3 py-1 bg-white dark:bg-slate-800 rounded-lg text-[9px] font-black text-slate-400 border border-slate-100 dark:border-slate-700">
                 {col}
               </span>
             ))}
          </div>

          {isProcessing && (
            <div className="absolute inset-x-12 bottom-8">
              <p className="text-[9px] font-black text-blue-600 uppercase tracking-widest mt-2 animate-pulse">Sincronizando com Banco de Dados...</p>
            </div>
          )}
        </div>
      ) : (
        <div className="p-12 bg-green-50 dark:bg-green-900/10 rounded-[32px] border border-green-100 dark:border-green-900/20 flex flex-col items-center text-center gap-4 animate-in zoom-in-95 duration-300">
          <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center text-white shadow-xl shadow-green-200 dark:shadow-green-900/20 mt-[-20px]">
            <CheckCircle size={40} />
          </div>
          <div>
            <h3 className="text-2xl font-black text-green-900 dark:text-green-50 uppercase tracking-tighter">Upload Concluído!</h3>
            <p className="text-green-700 dark:text-green-300 text-xs font-bold uppercase mt-1">
              {successInfo.rows} registros importados de {successInfo.stores} lojas.
            </p>
          </div>
          <p className="text-[10px] font-black text-green-600 dark:text-green-400 uppercase tracking-widest bg-white/50 dark:bg-slate-900/50 px-4 py-2 rounded-full border border-green-200 dark:border-green-800">
            Sincronizando Dashboard...
          </p>
        </div>
      )}

      {warnings.length > 0 && !successInfo && (
        <div className="p-4 bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/20 rounded-2xl flex flex-col gap-2 animate-in slide-in-from-top-2 duration-300">
          <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
            <AlertTriangle size={18} />
            <p className="text-[10px] font-black uppercase tracking-tight">Atenção (Importação Parcial)</p>
          </div>
          <ul className="space-y-1 ml-6">
            {warnings.map((w, i) => (
              <li key={i} className="text-[9px] font-bold text-amber-700 dark:text-amber-300 uppercase leading-tight">• {w}</li>
            ))}
          </ul>
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/20 rounded-2xl flex flex-col gap-3 text-red-600 dark:text-red-400 animate-in slide-in-from-top-2 duration-300">
          <div className="flex items-center gap-3">
            <AlertCircle size={20} />
            <p className="text-xs font-bold uppercase tracking-tight">{error}</p>
            <button onClick={() => { setError(null); setErrorList([]); }} className="ml-auto p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg">
              <X size={16} />
            </button>
          </div>
          
          {errorList.length > 1 && (
            <div className="pl-8 flex flex-col gap-1 border-t border-red-200/30 pt-2">
              {errorList.slice(1).map((err, i) => (
                <p key={i} className="text-[9px] font-bold uppercase italic opacity-80 leading-tight">• {err}</p>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="bg-slate-100 dark:bg-slate-800/50 p-6 rounded-3xl">
        <h4 className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
          <FileText size={14} /> Dicas para o arquivo
        </h4>
        <ul className="space-y-2">
          {[
            'Utilize o modelo consolidado (Total_2025.xlsx).',
            'O cabeçalho com os meses deve estar na linha 4.',
            'A coluna C deve conter a descrição da conta.',
            'A coluna D (Lj) define a loja para aquela linha.',
            'As colunas de E até P representam os meses de Janeiro a Dezembro.'
          ].map((tip, i) => (
            <li key={i} className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase flex items-start gap-2 leading-relaxed">
              <div className="w-3 h-3 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-[7px] shrink-0 mt-0.5">{i+1}</div>
              {tip}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default DREUpload;
