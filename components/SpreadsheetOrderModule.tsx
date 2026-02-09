import React, { useState, useEffect, useMemo } from "react";
import * as XLSX from "xlsx";
import { 
  Download, Trash2, X, ShoppingBag, ListFilter, Layers, Calendar, Zap, Percent, Hash, Info, Plus, ChevronRight
} from "lucide-react";
import { supabase } from "../services/supabaseClient";

/* --- CONSTANTES FISCAIS --- */
const VALORES_FISCAIS = {
  IPPT: "T", NCM: "64042000", CEST: "2805900", UNIDADE: "UN", IPI: "49", PIS: "70", COFINS: "70", ICMS: "000", FAIXA: "T"
};

const MAPA_GRADE = { LETRA: 162, UN: 163, NUM_INICIO: 164, P: 199, M: 200, G: 201, GG: 202 };
const SUBGRUPO_LOJAS = ["05","08","09","26","31","34","40","43","44","45","50","56","72","88","96","100","102","109"];
const TAMANHOS = {
  Fem: ["33","34","35","36","37","38","39","40","41","42"],
  Masc: ["36","37","38","39","40","41","42","43","44","45","46","47","48","49"],
  Inf: ["15","16","17","18","19","20","21","22","23","24","25","26","27","28","29","30","31","32","33","34","35","36"],
  Acess: ["UN","P","M","G","GG"]
};
const LETRAS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

const SpreadsheetOrderModule = ({ user, onClose }: { user: any, onClose: () => void }) => {
  const [etapa, setEtapa] = useState(1);
  const [verLotes, setVerLotes] = useState(false);
  
  // Pedido
  const [pedido, setPedido] = useState({ 
    marca: "", fornecedor: "", embarqueInicio: "", embarqueFim: "", desconto: 0, markup: 2.6 
  });

  const [itens, setItens] = useState<any[]>([]);
  const [itemAtual, setItemAtual] = useState({ 
    referencia: "", tipo: "", cor1: "", cor2: "", cor3: "", 
    modelo: "Fem" as keyof typeof TAMANHOS, valorCompra: 0, precoVenda: 0 
  });
  
  const [dbSuggestions, setDbSuggestions] = useState({ tipos: [] as string[], cores: [] as string[] });
  const [gradeEditando, setGradeEditando] = useState<Record<string, number>>({});
  const [gradesSalvas, setGradesSalvas] = useState<any[]>([]);
  const [lotesFinalizados, setLotesFinalizados] = useState<any[]>([]);
  const [modoLojas, setModoLojas] = useState<'subgrupo' | 'todas'>('subgrupo');
  const [selecaoLote, setSelecaoLote] = useState({ itensIds: [] as string[], lojasIds: [] as string[] });

  const [persistAssignments, setPersistAssignments] = useState<Record<string, { gradeLetra: string, corSelecionada: string }>>(() => {
    const saved = localStorage.getItem("order_assignments_cache");
    return saved ? JSON.parse(saved) : {};
  });

  useEffect(() => {
    const fetchHistory = async () => {
      const { data } = await supabase.from('product_performance').select('category, brand').limit(1000);
      if (data) {
        const cats = Array.from(new Set(data.map(i => String(i.category || "").toUpperCase()))) as string[];
        setDbSuggestions(prev => ({ ...prev, tipos: cats }));
      }
    };
    fetchHistory();
  }, []);

  // FÓRMULA DE CÁLCULO .99
  useEffect(() => {
    if (itemAtual.valorCompra > 0) {
      const custoReal = itemAtual.valorCompra * (1 - (pedido.desconto / 100));
      const precoSugerido = custoReal * pedido.markup;
      const finalPrice = (Math.floor(precoSugerido / 10) + 1) * 10 + 9.99;
      setItemAtual(prev => ({ ...prev, precoVenda: finalPrice }));
    } else {
      setItemAtual(prev => ({ ...prev, precoVenda: 0 }));
    }
  }, [itemAtual.valorCompra, pedido.markup, pedido.desconto]);

  const setCell = (sheet: XLSX.WorkSheet, r: number, c: number, value: any, type: "s" | "n" = "s") => {
    const ref = XLSX.utils.encode_cell({ r, c });
    sheet[ref] = { t: type, v: value };
  };

  const exportarPlanilhaFinal = async () => {
    if (lotesFinalizados.length === 0) return alert("Adicione itens e distribua nas lojas primeiro.");
    try {
      const response = await fetch("/Pedido_Sub_R2J_.xlsx");
      if (!response.ok) throw new Error("Template não encontrado no servidor.");
      const buffer = await response.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      
      setCell(sheet, 1, 3, pedido.embarqueInicio); // Col D
      setCell(sheet, 1, 4, pedido.embarqueFim);    // Col E
      setCell(sheet, 2, 8, pedido.marca);          // Col I

      gradesSalvas.forEach((grade, idx) => {
        const r = 1 + idx;
        setCell(sheet, r, MAPA_GRADE.LETRA, grade.letra);
        Object.entries(grade.valores).forEach(([tam, qtd]) => {
          if (tam === "UN") setCell(sheet, r, MAPA_GRADE.UN, Number(qtd), "n");
          else if (["P","M","G","GG"].includes(tam)) setCell(sheet, r, MAPA_GRADE[tam as keyof typeof MAPA_GRADE], Number(qtd), "n");
          else {
            const num = parseInt(tam);
            if (!isNaN(num) && num >= 15) setCell(sheet, r, 164 + (num - 15), Number(qtd), "n");
          }
        });
      });

      const itemsUnicos = Array.from(new Set(lotesFinalizados.map(l => `${l.referencia}-${l.corEscolhida}`)));
      itemsUnicos.forEach((key, idx) => {
        const lotes = lotesFinalizados.filter(l => `${l.referencia}-${l.corEscolhida}` === key);
        const refObj = lotes[0];
        const r = 25 + idx;

        setCell(sheet, r, 1, idx + 1, "n");
        setCell(sheet, r, 2, refObj.referencia);
        setCell(sheet, r, 8, `${pedido.marca} ${refObj.tipo} ${refObj.referencia}`.toUpperCase());
        setCell(sheet, r, 9, refObj.tipo);
        setCell(sheet, r, 10, refObj.corEscolhida);
        setCell(sheet, r, 13, refObj.modelo);

        setCell(sheet, r, 16, VALORES_FISCAIS.IPPT);
        setCell(sheet, r, 19, VALORES_FISCAIS.NCM);
        setCell(sheet, r, 20, VALORES_FISCAIS.CEST);
        setCell(sheet, r, 21, VALORES_FISCAIS.UNIDADE);
        setCell(sheet, r, 24, VALORES_FISCAIS.IPI);
        setCell(sheet, r, 25, VALORES_FISCAIS.PIS);
        setCell(sheet, r, 26, VALORES_FISCAIS.COFINS);
        setCell(sheet, r, 27, VALORES_FISCAIS.ICMS);
        setCell(sheet, r, 44, VALORES_FISCAIS.FAIXA);

        setCell(sheet, r, 29, Number(refObj.valorCompra), "n"); // AD
        setCell(sheet, r, 41, Number(refObj.valorCompra), "n"); // AP
        setCell(sheet, r, 42, Number(refObj.precoVenda), "n");  // AQ

        lotes.forEach(l => {
          const col = 44 + parseInt(l.loja);
          if (col >= 45 && col <= 161) setCell(sheet, r, col, l.gradeLetra);
        });
      });

      XLSX.writeFile(workbook, `PEDIDO_${pedido.marca || 'SEM_NOME'}.xlsx`);
    } catch (e: any) { alert(e.message); }
  };

  const lotesAgrupados = useMemo(() => {
    const res: Record<string, any> = {};
    lotesFinalizados.forEach(l => {
      if (!res[l.idVinculo]) res[l.idVinculo] = { grade: l.gradeLetra, items: new Set(), lojas: new Set(), val: 0, pares: 0 };
      res[l.idVinculo].items.add(l.referencia);
      res[l.idVinculo].lojas.add(l.loja);
      const g = gradesSalvas.find(x => x.letra === l.gradeLetra);
      res[l.idVinculo].pares += g?.total || 0;
      res[l.idVinculo].val += (g?.total || 0) * (l.valorCompra || 0);
    });
    return Object.values(res);
  }, [lotesFinalizados, gradesSalvas]);

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-[100] font-sans">
      <div className="bg-[#F8FAFC] w-full max-w-5xl h-[90vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-white">
        
        {/* HEADER - CLEAN & MINIMALIST */}
        <div className="px-6 py-4 flex justify-between items-center bg-white border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg"><ShoppingBag size={20} /></div>
            <div>
              <h1 className="text-lg font-black text-slate-900 uppercase tracking-tight italic leading-none">Carga de Pedido <span className="text-blue-600">Real</span></h1>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">Gestão Logística Integrada</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-full transition-all"><X size={20} /></button>
        </div>

        {/* STEPPER - TIGHTER */}
        <div className="flex bg-white px-6 py-2 gap-2 border-b border-slate-100 shrink-0">
          {[1, 2, 3, 4].map(n => (
            <button key={n} onClick={() => setEtapa(n)} className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase transition-all border-b-2 ${etapa === n ? 'bg-blue-50 text-blue-700 border-blue-600' : 'text-slate-400 border-transparent hover:bg-slate-50'}`}>
              {n}. {n === 1 ? 'Cabeçalho' : n === 2 ? 'Produtos' : n === 3 ? 'Grades' : 'Distribuição'}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-6 no-scrollbar">
          {etapa === 1 && (
            <div className="max-w-2xl mx-auto space-y-4 animate-in fade-in zoom-in duration-300">
              <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 grid grid-cols-2 gap-4">
                <div className="col-span-2 md:col-span-1 space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase ml-2">Marca</label>
                  <input className="w-full p-3 bg-slate-50 rounded-xl font-bold uppercase outline-none focus:ring-2 focus:ring-blue-100" value={pedido.marca} onChange={e => setPedido({...pedido, marca: e.target.value.toUpperCase()})} placeholder="EX: BEBECE" />
                </div>
                <div className="col-span-2 md:col-span-1 space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase ml-2">Razão Social</label>
                  <input className="w-full p-3 bg-slate-50 rounded-xl font-bold uppercase outline-none" value={pedido.fornecedor} onChange={e => setPedido({...pedido, fornecedor: e.target.value.toUpperCase()})} placeholder="EX: CALCADOS BEBECE LTDA" />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-orange-500 uppercase ml-2 flex items-center gap-1"><Calendar size={10}/> Embarque Início</label>
                  <input type="date" className="w-full p-3 bg-orange-50/50 rounded-xl font-bold outline-none" value={pedido.embarqueInicio} onChange={e => setPedido({...pedido, embarqueInicio: e.target.value})} />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-orange-500 uppercase ml-2 flex items-center gap-1"><Calendar size={10}/> Embarque Fim</label>
                  <input type="date" className="w-full p-3 bg-orange-50/50 rounded-xl font-bold outline-none" value={pedido.embarqueFim} onChange={e => setPedido({...pedido, embarqueFim: e.target.value})} />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-blue-500 uppercase ml-2 flex items-center gap-1"><Zap size={10}/> Markup</label>
                  <input type="number" step="0.1" className="w-full p-3 bg-blue-50/50 rounded-xl font-black text-center text-blue-900 outline-none" value={pedido.markup || ""} onChange={e => setPedido({...pedido, markup: Number(e.target.value)})} />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-red-500 uppercase ml-2 flex items-center gap-1"><Percent size={10}/> Desconto %</label>
                  <input type="number" className="w-full p-3 bg-red-50/50 rounded-xl font-black text-center text-red-900 outline-none" value={pedido.desconto || ""} onChange={e => setPedido({...pedido, desconto: Number(e.target.value)})} />
                </div>
              </div>
            </div>
          )}

          {etapa === 2 && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full animate-in slide-in-from-right duration-300">
              <div className="lg:col-span-7 bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col gap-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase ml-2">Referência</label>
                    <input className="w-full p-3 bg-slate-50 rounded-xl font-black text-lg outline-none uppercase" value={itemAtual.referencia} onChange={e => setItemAtual({...itemAtual, referencia: e.target.value.toUpperCase()})} placeholder="REF" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase ml-2">Público</label>
                    <select className="w-full p-3 bg-slate-50 rounded-xl font-bold uppercase text-[10px] outline-none" value={itemAtual.modelo} onChange={e => setItemAtual({...itemAtual, modelo: e.target.value as any})}><option value="Fem">Feminino</option><option value="Masc">Masculino</option><option value="Inf">Infantil</option><option value="Acess">Acessório</option></select>
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase ml-2">Tipo de Produto</label>
                  <input list="types" className="w-full p-3 bg-slate-50 rounded-xl font-bold uppercase text-[10px] outline-none" value={itemAtual.tipo} onChange={e => setItemAtual({...itemAtual, tipo: e.target.value.toUpperCase()})} placeholder="EX: SANDALIA, TENIS" />
                  <datalist id="types">{dbSuggestions.tipos.map(t => <option key={t} value={t} />)}</datalist>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {['cor1','cor2','cor3'].map(c => <input key={c} className="p-2.5 bg-slate-50 rounded-xl text-[9px] font-bold uppercase outline-none border border-transparent focus:border-blue-200" placeholder={c.toUpperCase()} value={itemAtual[c as keyof typeof itemAtual] as string} onChange={e => setItemAtual({...itemAtual, [c]: e.target.value.toUpperCase()})} />)}
                </div>
                <div className="bg-slate-900 p-6 rounded-3xl text-white flex justify-between items-center shadow-lg border-b-4 border-blue-600">
                  <div><p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Custo Fábrica</p><div className="flex items-center font-black text-xl"><span className="text-blue-500 mr-1">R$</span><input type="number" className="bg-transparent w-20 outline-none" value={itemAtual.valorCompra || ""} onChange={e => setItemAtual({...itemAtual, valorCompra: Number(e.target.value)})} /></div></div>
                  <div className="text-right border-l border-white/10 pl-6"><p className="text-[8px] font-black text-blue-400 uppercase mb-1">Venda Real (.99)</p><p className="text-3xl font-black text-yellow-400 italic leading-none">R$ {itemAtual.precoVenda.toFixed(2)}</p></div>
                </div>
                <button onClick={() => { if(!itemAtual.referencia || !itemAtual.valorCompra) return; setItens([...itens, {...itemAtual, id: crypto.randomUUID()}]); setItemAtual({...itemAtual, referencia: "", valorCompra: 0, cor1: "", cor2: "", cor3: ""}); }} className="w-full py-3.5 bg-blue-600 text-white rounded-2xl font-black text-[10px] uppercase shadow-md hover:bg-blue-700 transition-all">+ ADICIONAR ITEM</button>
              </div>
              <div className="lg:col-span-5 space-y-3 flex flex-col h-full overflow-hidden">
                <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-2">Carrinho ({itens.length})</h4>
                <div className="flex-1 overflow-y-auto space-y-2 no-scrollbar pr-1">
                  {itens.map(it => (
                    <div key={it.id} className="bg-white p-4 rounded-2xl border border-slate-100 flex justify-between items-center group shadow-sm">
                      <div><p className="text-[10px] font-black text-slate-800 uppercase italic leading-none">{it.referencia} • {it.tipo}</p><p className="text-[8px] font-bold text-blue-500 uppercase mt-1">Venda: {formatCurrency(it.precoVenda)}</p></div>
                      <button onClick={() => setItens(itens.filter(x => x.id !== it.id))} className="text-slate-300 hover:text-red-500 transition-colors"><Trash2 size={16}/></button>
                    </div>
                  ))}
                  {itens.length === 0 && <div className="h-full flex flex-col items-center justify-center opacity-30 grayscale py-12"><ShoppingBag size={40}/><p className="text-[9px] font-black uppercase mt-2">Vazio</p></div>}
                </div>
              </div>
            </div>
          )}

          {etapa === 3 && (
            <div className="max-w-xl mx-auto space-y-4 animate-in zoom-in duration-300 text-center">
              <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 relative">
                <div className="absolute -top-3 right-6 bg-red-600 text-white px-4 py-1.5 rounded-full font-black text-[10px] shadow-lg">{Object.values(gradeEditando).reduce((a,b)=>a+Number(b),0)} PARES</div>
                <h3 className="text-sm font-black text-slate-800 uppercase italic mb-8">Definir Grade <span className="text-blue-600">{LETRAS[gradesSalvas.length]}</span></h3>
                <div className="grid grid-cols-4 sm:grid-cols-5 gap-3 mb-8">
                  {(TAMANHOS[itemAtual.modelo] || []).map(tam => (
                    <div key={tam} className="bg-slate-50 p-2 rounded-xl border border-slate-100 focus-within:border-blue-400 transition-all">
                      <label className="text-[9px] font-black text-slate-400 block mb-1">{tam}</label>
                      <input type="number" className="w-full text-center bg-transparent font-black text-lg outline-none text-blue-950" value={gradeEditando[tam] || ""} onChange={e => setGradeEditando({...gradeEditando, [tam]: Number(e.target.value)})} />
                    </div>
                  ))}
                </div>
                <button onClick={() => { 
                  const total = Object.values(gradeEditando).reduce((a,b)=>a+Number(b),0);
                  if(total === 0) return;
                  setGradesSalvas([...gradesSalvas, { letra: LETRAS[gradesSalvas.length], modelo: itemAtual.modelo, valores: {...gradeEditando}, total }]); 
                  setGradeEditando({});
                }} className="w-full py-4 bg-slate-950 text-white rounded-2xl font-black uppercase text-[10px] shadow-lg border-b-4 border-slate-800 hover:bg-blue-600 transition-all">SALVAR GRADE {LETRAS[gradesSalvas.length]}</button>
              </div>
              <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                {gradesSalvas.map(g => <div key={g.letra} className="bg-white px-4 py-2 rounded-xl border border-blue-100 text-[10px] font-black text-blue-600 shadow-sm">{g.letra}: {g.total}pr</div>)}
              </div>
            </div>
          )}

          {etapa === 4 && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full animate-in slide-in-from-bottom duration-300">
               <div className="lg:col-span-4 bg-white p-5 rounded-3xl shadow-sm border border-slate-100 flex flex-col">
                  <span className="text-[9px] font-black text-blue-600 uppercase mb-4 text-center tracking-widest border-b pb-2">1. Selecionar & Vincular</span>
                  <div className="flex-1 overflow-y-auto space-y-2 pr-1 no-scrollbar">
                    {itens.map(it => {
                      const isSel = selecaoLote.itensIds.includes(it.id);
                      const assignment = persistAssignments[it.referencia] || { gradeLetra: "", corSelecionada: it.cor1 || "" };
                      return (
                        <div key={it.id} className={`p-3 rounded-2xl border transition-all ${isSel ? 'bg-blue-50 border-blue-400 shadow-sm' : 'bg-slate-50 border-transparent opacity-80'}`}>
                          <label className="flex items-center gap-3 cursor-pointer">
                            <input type="checkbox" className="w-5 h-5 rounded border-slate-300 text-blue-600" checked={isSel} onChange={() => setSelecaoLote({...selecaoLote, itensIds: isSel ? selecaoLote.itensIds.filter(x => x !== it.id) : [...selecaoLote.itensIds, it.id]})} />
                            <div className="flex-1"><p className="text-[10px] font-black uppercase text-slate-800 truncate">{it.referencia}</p></div>
                          </label>
                          {isSel && (
                            <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-blue-100">
                              <select value={assignment.gradeLetra} onChange={e => setPersistAssignments({...persistAssignments, [it.referencia]: {...assignment, gradeLetra: e.target.value}})} className="p-1.5 bg-white border border-blue-200 rounded-lg text-[9px] font-black text-blue-700 outline-none">
                                <option value="">GRADE?</option>
                                {gradesSalvas.map(gr => <option key={gr.letra} value={gr.letra}>{gr.letra} ({gr.total} pr)</option>)}
                              </select>
                              <select value={assignment.corSelecionada} onChange={e => setPersistAssignments({...persistAssignments, [it.referencia]: {...assignment, corSelecionada: e.target.value}})} className="p-1.5 bg-white border border-blue-200 rounded-lg text-[9px] font-black text-blue-700 uppercase outline-none">
                                <option value={it.cor1}>{it.cor1}</option>
                                {it.cor2 && <option value={it.cor2}>{it.cor2}</option>}
                                {it.cor3 && <option value={it.cor3}>{it.cor3}</option>}
                              </select>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
               </div>

               <div className="lg:col-span-8 flex flex-col gap-4">
                  <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 flex-1 flex flex-col">
                    <div className="flex justify-between items-center mb-4 border-b pb-2">
                       <span className="text-[9px] font-black text-blue-600 uppercase tracking-widest">2. Destinos (01-120)</span>
                       <div className="flex bg-slate-100 p-0.5 rounded-lg">
                          <button onClick={() => setModoLojas('subgrupo')} className={`px-3 py-1 rounded-md text-[8px] font-black uppercase transition-all ${modoLojas === 'subgrupo' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}>Especial</button>
                          <button onClick={() => setModoLojas('todas')} className={`px-3 py-1 rounded-md text-[8px] font-black uppercase transition-all ${modoLojas === 'todas' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}>Tudo</button>
                       </div>
                    </div>
                    <div className="grid grid-cols-6 sm:grid-cols-10 gap-1.5 overflow-y-auto no-scrollbar content-start">
                      {(modoLojas === 'subgrupo' ? SUBGRUPO_LOJAS : Array.from({length: 120}, (_, i) => (i+1).toString().padStart(2, '0'))).map(loja => (
                        <button key={loja} onClick={() => setSelecaoLote({...selecaoLote, lojasIds: selecaoLote.lojasIds.includes(loja) ? selecaoLote.lojasIds.filter(x => x !== loja) : [...selecaoLote.lojasIds, loja]})} className={`py-2 rounded-lg text-[10px] font-black transition-all border ${selecaoLote.lojasIds.includes(loja) ? 'bg-blue-600 border-blue-700 text-white shadow-md' : 'bg-slate-50 border-transparent text-slate-400 hover:bg-slate-100'}`}>{loja}</button>
                      ))}
                    </div>
                  </div>
                  <button onClick={() => {
                    if (selecaoLote.itensIds.length === 0 || selecaoLote.lojasIds.length === 0) return alert("Faltam itens ou lojas!");
                    const idVinculo = crypto.randomUUID();
                    const novos = selecaoLote.itensIds.flatMap(id => {
                      const it = itens.find(i => i.id === id);
                      const cfg = persistAssignments[it.referencia];
                      if (!cfg?.gradeLetra) throw new Error(`Vincule grade para ${it.referencia}`);
                      return selecaoLote.lojasIds.map(loja => ({ ...it, loja, gradeLetra: cfg.gradeLetra, corEscolhida: cfg.corSelecionada || it.cor1, idVinculo }));
                    });
                    setLotesFinalizados([...lotesFinalizados, ...novos]);
                    setSelecaoLote({ itensIds: [], lojasIds: [] });
                    alert("Carga gerada com sucesso!");
                  }} className="w-full py-4 bg-slate-950 text-white rounded-2xl font-black uppercase text-[10px] shadow-xl border-b-4 border-slate-800 hover:bg-blue-600 transition-all flex items-center justify-center gap-2"><Layers size={14}/> GERAR CARGA DE LOTES</button>
               </div>
            </div>
          )}
        </div>

        {/* FOOTER - MINIMALIST */}
        <div className="px-6 py-4 bg-white border-t border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4 shrink-0">
          <button onClick={() => setVerLotes(!verLotes)} className={`w-full md:w-auto px-6 py-2.5 rounded-xl font-black text-[9px] uppercase transition-all flex items-center justify-center gap-2 border ${verLotes ? 'bg-blue-600 text-white border-blue-700 shadow-md' : 'bg-slate-50 text-blue-700 border-slate-200'}`}>
            <ListFilter size={16}/> Lotes Ativos ({lotesAgrupados.length})
          </button>
          <div className="flex gap-2 w-full md:w-auto">
            <button onClick={exportarPlanilhaFinal} className="flex-1 md:flex-none bg-red-600 text-white px-8 py-3 rounded-xl font-black text-[9px] uppercase shadow-lg hover:bg-red-700 transition-all border-b-4 border-red-900 active:scale-95 flex items-center justify-center gap-2">
              <Download size={18}/> Exportar Excel
            </button>
          </div>
        </div>

        {/* OVERLAY RESUMO LOTES */}
        {verLotes && (
            <div className="absolute inset-x-0 bottom-16 bg-white border-t border-slate-200 shadow-2xl p-6 max-h-[50vh] overflow-y-auto animate-in slide-in-from-bottom duration-300 z-50 rounded-t-[32px]">
                <div className="max-w-4xl mx-auto">
                    <div className="flex justify-between items-center mb-6">
                      <h4 className="text-xs font-black uppercase italic text-blue-950">Resumo da Carga</h4>
                      <button onClick={() => setLotesFinalizados([])} className="text-red-500 text-[9px] font-black uppercase border border-red-100 px-3 py-1.5 rounded-lg hover:bg-red-50 transition-all">Limpar Carga</button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {lotesAgrupados.map((l, i) => (
                            <div key={i} className="bg-slate-50 p-4 rounded-2xl border border-slate-100 relative group">
                                <div className="flex items-center gap-3 mb-3">
                                    <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center font-black text-lg text-blue-600 shadow-sm border border-blue-50">{l.grade}</div>
                                    <div><p className="text-[10px] font-black text-slate-800 uppercase leading-none">Lote #{i+1}</p><p className="text-[8px] font-bold text-slate-400 uppercase mt-1">{l.items.size} Itens • {l.lojas.size} Lojas</p></div>
                                </div>
                                <div className="flex justify-between items-end border-t pt-2 mt-2">
                                    <div><p className="text-[7px] text-gray-400 font-black uppercase">Pares</p><p className="text-lg font-black text-slate-900 leading-none italic">{l.pares}</p></div>
                                    <div className="text-right"><p className="text-[7px] text-gray-400 font-black uppercase">Volume</p><p className="text-base font-black text-green-600 leading-none italic">{formatCurrency(l.val)}</p></div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        )}
      </div>
    </div>
  );
};

const formatCurrency = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

export default SpreadsheetOrderModule;