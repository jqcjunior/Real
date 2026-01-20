
import React, { useState, useMemo } from 'react';
import { User } from '../types';
import { X, Save, FileSpreadsheet, Plus, Trash2, Building2, UserCog, DollarSign, Calendar, Info, Loader2, Download, AlertTriangle, Layers, ChevronRight } from 'lucide-react';
import { supabase } from '../services/supabaseClient';
import * as XLSX from 'xlsx';
import { formatCurrency } from '../constants';

interface SpreadsheetOrderModuleProps {
  user: User;
  onClose: () => void;
}

const GRADES_KEYS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'] as const;
type GradeKey = typeof GRADES_KEYS[number];

const SIZE_LABELS = ['UN', 'P', 'M', 'G', 'GG', ...Array.from({ length: 33 }, (_, i) => String(16 + i))];

const SpreadsheetOrderModule: React.FC<SpreadsheetOrderModuleProps> = ({ user, onClose }) => {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [isExporting, setIsExporting] = useState(false);

  const [headerData, setHeaderData] = useState({
      brand: '', provider: '', buyer: user.name, repName: '', repEmail: '', repPhone: '',
      term1: '', term2: '', term3: '',
      billingDate: new Date().toISOString().split('T')[0],
      deadlineDate: new Date().toISOString().split('T')[0],
      discount: '0', markup: '2.6'
  });

  const [itemData, setItemData] = useState({ ref: '', type: '', color1: '', color2: '', color3: '', model: '', cost: '0' });

  const [grades, setGrades] = useState<Record<GradeKey, Record<string, string>>>(() => {
      const initial: any = {};
      GRADES_KEYS.forEach(k => {
          initial[k] = {};
          SIZE_LABELS.forEach(s => initial[k][s] = '');
      });
      return initial;
  });

  const [distributions, setDistributions] = useState<Array<{ store: string, grade: GradeKey | '' }>>([
      { store: '', grade: '' }, { store: '', grade: '' }, { store: '', grade: '' }, { store: '', grade: '' }, { store: '', grade: '' }
  ]);

  const suggestedSalePrice = useMemo(() => {
      const cost = parseFloat(itemData.cost.replace(',', '.')) || 0;
      const mkp = parseFloat(headerData.markup.replace(',', '.')) || 1;
      const disc = parseFloat(headerData.discount.replace(',', '.')) || 0;
      if (cost <= 0) return 0;
      const costAfterDiscount = cost * (1 - (disc / 100));
      const rawVenda = costAfterDiscount * mkp;
      return Math.floor(rawVenda) + 0.99;
  }, [itemData.cost, headerData.markup, headerData.discount]);

  const activeGrades = useMemo(() => {
      return GRADES_KEYS.filter(k => Object.values(grades[k]).some(v => parseInt(v as string) > 0));
  }, [grades]);

  const handleExport = async () => {
      setIsExporting(true);
      try {
          const { data: dl } = await supabase.from('downloads')
            .select('url')
            .eq('category', 'spreadsheet')
            .limit(1)
            .single() as { data: any, error: any };

          if (!dl?.url) throw new Error("Template oficial não encontrado.");

          const response = await fetch(dl.url as string);
          const arrayBuffer = await response.arrayBuffer();
          const workbook = XLSX.read(arrayBuffer, { type: 'array' });
          
          const sheet = workbook.Sheets['PEDIDO'];
          if (!sheet) throw new Error("A aba 'PEDIDO' não foi localizada.");

          const write = (cell: string, val: any) => { 
              const type = typeof val === 'number' ? 'n' : 's';
              if (!sheet[cell]) sheet[cell] = { v: val, t: type };
              else {
                  sheet[cell].v = val;
                  sheet[cell].t = type;
              }
          };
          
          write('N3', headerData.brand.toUpperCase());
          write('N4', headerData.provider.toUpperCase());
          write('AA2', headerData.buyer.toUpperCase());
          write('AA3', headerData.repName.toUpperCase());
          write('AA4', headerData.repEmail.toLowerCase());
          write('AN3', headerData.repPhone);
          write('N5', headerData.term1);
          write('Q5', headerData.term2);
          write('T5', headerData.term3);
          write('AA5', headerData.billingDate);
          write('AH5', headerData.deadlineDate);
          write('Z6', parseFloat(headerData.discount.replace(',', '.')) || 0);
          write('AF6', parseFloat(headerData.markup.replace(',', '.')) || 0);

          GRADES_KEYS.forEach((k, idx) => {
              const row = 14 + idx;
              SIZE_LABELS.forEach((size, sIdx) => {
                  const colCode = XLSX.utils.encode_col(3 + sIdx); 
                  const cellAddress = `${colCode}${row}`;
                  const val = parseInt(grades[k][size] as string) || 0;
                  if (val > 0) write(cellAddress, val);
              });
          });

          write('C36', itemData.ref.toUpperCase());
          write('H36', itemData.type.toUpperCase());
          write('R36', itemData.color1.toUpperCase());
          write('S36', itemData.color2.toUpperCase());
          write('T36', itemData.color3.toUpperCase());
          write('U36', itemData.model.toUpperCase());
          write('AL36', parseFloat(itemData.cost.replace(',', '.')) || 0);
          write('AO36', suggestedSalePrice);

          const distCells = ['X36', 'AA36', 'AD36', 'AG36', 'AJ36'];
          distributions.forEach((d, i) => { if (d.store) write(distCells[i], d.store); });

          const out = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });
          const blob = new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `PEDIDO_PLANILHA_${headerData.brand.toUpperCase()}_${new Date().getTime()}.xlsx`;
          a.click();
          onClose();
      } catch (e: any) { 
          alert(`Erro na exportação: ${e.message}`); 
      } finally { 
          setIsExporting(false); 
      }
  };

  return (
    <div className="p-4 md:p-8 space-y-8 animate-in fade-in duration-500 bg-[#f8fafc] min-h-full">
        <div className="bg-white rounded-[48px] shadow-sm border border-gray-100 overflow-hidden flex flex-col">
            <div className="p-10 border-b bg-gray-50/50 flex justify-between items-center">
                <div className="flex items-center gap-8">
                    <div className="bg-gray-900 text-white w-20 h-20 rounded-[32px] flex items-center justify-center shadow-2xl border-t-4 border-red-600">
                        <FileSpreadsheet size={40} />
                    </div>
                    <div>
                        <h2 className="text-4xl font-black text-gray-900 uppercase italic tracking-tighter leading-none">
                            Máscara Digital <span className="text-red-600">de Pedido</span>
                        </h2>
                        <p className="text-gray-400 font-bold text-[10px] uppercase tracking-[0.3em] mt-3">Geração de Documento Oficial Corporativo</p>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <div className="flex gap-2 p-2 bg-gray-200 rounded-[28px] shadow-inner">
                        {[1, 2, 3].map(s => (
                            <div key={s} className={`w-12 h-12 rounded-full flex items-center justify-center text-sm font-black transition-all ${step === s ? 'bg-blue-900 text-white shadow-xl' : 'text-gray-400'}`}>{s}</div>
                        ))}
                    </div>
                    <button onClick={onClose} className="p-4 bg-white border border-gray-100 text-gray-400 hover:text-red-600 rounded-full transition-all shadow-sm"><X size={32}/></button>
                </div>
            </div>

            <div className="p-12">
                {step === 1 && (
                    <div className="space-y-12 animate-in slide-in-from-right duration-300">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                            <div className="space-y-8">
                                <h3 className="text-xs font-black text-blue-900 uppercase tracking-[0.2em] flex items-center gap-4 border-l-4 border-blue-900 pl-4">
                                    <Building2 size={20}/> Identificação do Pedido
                                </h3>
                                <div className="grid grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-gray-400 uppercase ml-2 tracking-widest">Marca (Célula N3)</label>
                                        <input value={headerData.brand} onChange={e => setHeaderData({...headerData, brand: e.target.value})} className="w-full p-5 bg-gray-50 rounded-3xl font-black uppercase text-base outline-none focus:ring-4 focus:ring-blue-50 border border-gray-100 shadow-inner" placeholder="EX: VIZZANO" />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-gray-400 uppercase ml-2 tracking-widest">Fornecedor (Célula N4)</label>
                                        <input value={headerData.provider} onChange={e => setHeaderData({...headerData, provider: e.target.value})} className="w-full p-5 bg-gray-50 rounded-3xl font-black uppercase text-base outline-none focus:ring-4 focus:ring-blue-50 border border-gray-100 shadow-inner" placeholder="FORNECEDOR LTDA" />
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-8">
                                <h3 className="text-xs font-black text-red-600 uppercase tracking-[0.2em] flex items-center gap-4 border-l-4 border-red-600 pl-4">
                                    <UserCog size={20}/> Comercial & Logística
                                </h3>
                                <div className="grid grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-gray-400 uppercase ml-2 tracking-widest">Faturamento (AA5)</label>
                                        <input type="date" value={headerData.billingDate} onChange={e => setHeaderData({...headerData, billingDate: e.target.value})} className="w-full p-5 bg-gray-50 rounded-3xl font-black text-base outline-none border border-gray-100 shadow-inner" />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-gray-400 uppercase ml-2 tracking-widest">Limite Embarque (AH5)</label>
                                        <input type="date" value={headerData.deadlineDate} onChange={e => setHeaderData({...headerData, deadlineDate: e.target.value})} className="w-full p-5 bg-gray-50 rounded-3xl font-black text-base outline-none border border-gray-100 shadow-inner" />
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="bg-gray-900 rounded-[48px] p-10 text-white flex flex-col md:flex-row gap-10 items-center justify-between shadow-2xl">
                             <div className="flex items-center gap-8">
                                <div className="p-6 bg-white/10 rounded-[32px] text-green-400"><DollarSign size={48}/></div>
                                <div>
                                    <h4 className="text-3xl font-black uppercase italic leading-none tracking-tighter">Cálculo Comercial</h4>
                                    <p className="text-gray-400 text-[10px] font-black uppercase mt-2 tracking-widest">Markup e Desconto</p>
                                </div>
                             </div>
                             <div className="flex gap-6">
                                <div className="space-y-2 w-40">
                                    <label className="text-[9px] font-black text-gray-400 uppercase ml-3 tracking-widest">MARKUP (AF6)</label>
                                    <input value={headerData.markup} onChange={e => setHeaderData({...headerData, markup: e.target.value})} className="w-full p-4 bg-white/10 border-2 border-white/20 rounded-[24px] font-black text-center text-2xl outline-none focus:border-white transition-all" />
                                </div>
                             </div>
                        </div>
                    </div>
                )}

                {step === 2 && (
                    <div className="space-y-12 animate-in slide-in-from-right duration-300">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 bg-gray-50 p-8 rounded-[48px] border border-gray-100 shadow-inner">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-gray-400 uppercase ml-2 tracking-widest">Referência (C36)</label>
                                <input value={itemData.ref} onChange={e => setItemData({...itemData, ref: e.target.value})} className="w-full p-5 bg-white border-none rounded-3xl font-black text-gray-900 uppercase shadow-sm text-lg outline-none" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-gray-400 uppercase ml-2 tracking-widest">Custo (AL36)</label>
                                <input value={itemData.cost} onChange={e => setItemData({...itemData, cost: e.target.value})} className="w-full p-5 bg-blue-50 rounded-3xl font-black text-blue-900 border-2 border-blue-100 text-2xl shadow-inner outline-none" placeholder="0,00" />
                            </div>
                        </div>
                        <div className="space-y-6 overflow-x-auto no-scrollbar pb-6">
                             <table className="w-full border-separate border-spacing-2">
                                <thead>
                                    <tr className="text-[9px] font-black text-gray-400 uppercase">
                                        <th className="w-16 bg-gray-100 rounded-xl py-3">Grade</th>
                                        {SIZE_LABELS.map(s => <th key={s} className="w-12 text-center">{s}</th>)}
                                    </tr>
                                </thead>
                                <tbody>
                                    {GRADES_KEYS.map(k => (
                                        <tr key={k}>
                                            <td className="bg-gray-900 text-white text-base font-black text-center rounded-2xl h-12 shadow-lg">{k}</td>
                                            {SIZE_LABELS.map(s => (
                                                <td key={s}>
                                                    <input 
                                                        type="text" 
                                                        value={grades[k][s]} 
                                                        onChange={e => {
                                                            const val = e.target.value.replace(/\D/g, '');
                                                            setGrades({...grades, [k]: {...grades[k], [s]: val}});
                                                        }}
                                                        className={`w-12 h-12 border-2 rounded-2xl text-center font-black text-[13px] outline-none transition-all ${parseInt(grades[k][s] as string) > 0 ? 'bg-blue-600 border-blue-700 text-white shadow-xl scale-110' : 'bg-white border-gray-100 text-gray-200'}`}
                                                    />
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {step === 3 && (
                    <div className="space-y-12 animate-in slide-in-from-right duration-300">
                        <div className="max-w-4xl mx-auto space-y-6">
                            {distributions.map((d, i) => (
                                <div key={i} className="flex items-center gap-8 bg-white p-8 rounded-[40px] border border-gray-100 shadow-xl group hover:border-blue-300 transition-all">
                                    <div className="w-20 h-20 rounded-[28px] bg-gray-50 border border-gray-100 flex flex-col items-center justify-center font-black text-gray-300 shrink-0">
                                        <span className="text-[10px] uppercase leading-none mb-1">Slot</span>
                                        <span className="text-2xl font-black leading-none">{i+1}</span>
                                    </div>
                                    <div className="flex-1 space-y-2">
                                        <label className="text-[11px] font-black text-gray-400 uppercase ml-2 tracking-widest">Nº da Loja (EX: 01)</label>
                                        <input value={d.store} onChange={e => {
                                            const newDist = [...distributions];
                                            newDist[i].store = e.target.value.replace(/\D/g, '');
                                            setDistributions(newDist);
                                        }} className="w-full bg-gray-50 border-none rounded-[28px] p-6 font-black text-blue-950 shadow-inner outline-none focus:ring-8 focus:ring-blue-50 text-xl" />
                                    </div>
                                    <div className="w-72 space-y-2">
                                        <label className="text-[11px] font-black text-gray-400 uppercase ml-2 tracking-widest">Grade Utilizada</label>
                                        <select value={d.grade} onChange={e => {
                                            const newDist = [...distributions];
                                            newDist[i].grade = e.target.value as GradeKey;
                                            setDistributions(newDist);
                                        }} className="w-full bg-gray-50 border-none rounded-[28px] p-6 font-black text-blue-900 shadow-inner outline-none appearance-none">
                                            <option value="">SELECIONE...</option>
                                            {activeGrades.map(k => <option key={k} value={k}>GRADE {k}</option>)}
                                        </select>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            <div className="p-10 border-t bg-gray-100/30 flex justify-between items-center">
                <button 
                  onClick={() => setStep(step > 1 ? (step - 1 as any) : 1)}
                  disabled={step === 1}
                  className="px-16 py-6 bg-white border border-gray-200 rounded-[32px] font-black uppercase text-sm text-gray-400 hover:bg-gray-50 transition-all disabled:opacity-30 shadow-sm"
                >
                    Voltar
                </button>
                {step < 3 ? (
                    <button 
                      onClick={() => setStep(step + 1 as any)}
                      className="px-20 py-6 bg-gray-950 text-white rounded-[32px] font-black uppercase text-sm shadow-2xl hover:bg-black transition-all flex items-center gap-6 border-b-8 border-red-700"
                    >
                        Próximo Passo <ChevronRight size={24}/>
                    </button>
                ) : (
                    <button 
                      onClick={handleExport}
                      disabled={isExporting || !headerData.brand || activeGrades.length === 0}
                      className="px-24 py-8 bg-green-600 text-white rounded-[40px] font-black uppercase text-base shadow-2xl hover:bg-green-700 transition-all border-b-8 border-green-900 disabled:opacity-30 flex items-center gap-4"
                    >
                        {isExporting ? <Loader2 className="animate-spin" /> : <Download />} Exportar Planilha
                    </button>
                )}
            </div>
        </div>
    </div>
  );
};

export default SpreadsheetOrderModule;
