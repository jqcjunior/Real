import React, { useState, useEffect, useMemo } from "react";
import * as XLSX from "xlsx";
import { 
  ChevronRight, Download, Trash2, X, ShoppingBag, CheckCircle2, ListFilter, LogOut, Edit3, Layers, Palette, Hash
} from "lucide-react";

/* --- CONSTANTES FISCAIS --- */
const FISCAL_PADRAO = {
  ESTACAO: "VERÃO", REF_TIPO: "NUMERICO", IPPT: "T", NCM: "64042000",
  CEST: "2805900", UNIDADE: "UN", IPI: "49", PIS: "70", COFINS: "70", ICMS: "000"
};

const SUBGRUPO_LOJAS = ["05","08","09","26","31","34","40","43","44","45","50","56","72","88","96","100","102","109"];
const TAMANHOS = {
  Fem: ["33","34","35","36","37","38","39","40","41","42"],
  Masc: ["36","37","38","39","40","41","42","43","44","45","46","47","48","49"],
  Inf: ["15","16","17","18","19","20","21","22","23","24","25","26","27","28","29","30","31","32","33","34","35","36"],
  Acess: ["UN","P","M","G","G1"]
};
const LETRAS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

const SpreadsheetOrderModule = ({ user, onClose }: { user: any, onClose: () => void }) => {
  const [etapa, setEtapa] = useState(1);
  const [verLotes, setVerLotes] = useState(false);
  const [pedido, setPedido] = useState({ marca: "", fornecedor: "", fatInicio: "", fatFim: "", desconto: 0, markup: 2.6, prazo1: 90, prazo2: 120, prazo3: 150 });
  const [itens, setItens] = useState<any[]>([]);
  const [itemAtual, setItemAtual] = useState({ referencia: "", tipo: "", cor1: "", cor2: "", cor3: "", modelo: "Fem" as keyof typeof TAMANHOS, valorCompra: 0, precoVenda: 0 });
  const [gradeEditando, setGradeEditando] = useState<Record<string, number>>({});
  const [gradesSalvas, setGradesSalvas] = useState<any[]>([]);
  const [lotesFinalizados, setLotesFinalizados] = useState<any[]>([]);
  const [modoLojas, setModoLojas] = useState<'subgrupo' | 'todas'>('subgrupo');
  const [selecaoLote, setSelecaoLote] = useState({ itensIds: [] as string[], lojasIds: [] as string[] });

  // Persistência: Memoriza Grade e Cor por Referência
  const [persistAssignments, setPersistAssignments] = useState<Record<string, { gradeLetra: string, corSelecionada: string }>>(() => {
    const saved = localStorage.getItem("real_admin_item_assignments");
    return saved ? JSON.parse(saved) : {};
  });

  useEffect(() => {
    localStorage.setItem("real_admin_item_assignments", JSON.stringify(persistAssignments));
  }, [persistAssignments]);

  /* --- UTILITÁRIOS EXCEL DINÂMICO --- */
  const setCell = (sheet: XLSX.WorkSheet, r: number, c: number, value: any, type: "s" | "n" = "s") => {
    if (c === undefined || c < 0) return;
    const ref = XLSX.utils.encode_cell({ r, c });
    sheet[ref] = { t: type, v: value };
  };

  const criarMapaColunas = (sheet: XLSX.WorkSheet) => {
    const mapa: Record<string, number> = {};
    if (!sheet["!ref"]) return mapa;
    const range = XLSX.utils.decode_range(sheet["!ref"]);
    for (let c = range.s.c; c <= range.e.c; c++) {
      const cell = sheet[XLSX.utils.encode_cell({ r: 0, c })];
      if (cell && cell.v) {
        const val = String(cell.v).toUpperCase().trim();
        mapa[val] = c;
        if (!isNaN(parseInt(val))) {
          mapa[parseInt(val).toString()] = c;
          mapa[parseInt(val).toString().padStart(2, '0')] = c;
        }
      }
    }
    return mapa;
  };

  const exportarPlanilhaFinal = async () => {
    if (lotesFinalizados.length === 0) return alert("Não há itens vinculados para exportar. Realize o vínculo no Passo 4.");
    
    try {
      const response = await fetch("/Pedido_Sub_R2J_.xlsx");
      if (!response.ok) throw new Error("Template não encontrado no servidor.");
      
      const buffer = await response.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const COL = criarMapaColunas(sheet);
      
      const numPedidoUnico = Math.floor(1000 + Math.random() * 9000);
      let linhaExcel = 1;

      const getCol = (names: string[]) => {
        for (const name of names) {
          if (COL[name.toUpperCase()] !== undefined) return COL[name.toUpperCase()];
        }
        return undefined;
      };

      lotesFinalizados.forEach((lote, idx) => {
        const r = linhaExcel;
        
        setCell(sheet, r, getCol(["PED. FORNECEDOR", "PEDIDO"]), numPedidoUnico, "n");
        setCell(sheet, r, getCol(["FORNECEDOR"]), pedido.fornecedor);
        setCell(sheet, r, getCol(["COMPRADOR"]), user.name);
        setCell(sheet, r, getCol(["PREVISÃO", "DATA INICIO"]), pedido.fatInicio);
        setCell(sheet, r, getCol(["LIMITE ENTREGA", "DATA FIM"]), pedido.fatFim);
        
        setCell(sheet, r, getCol(["ITEM"]), idx + 1, "n");
        setCell(sheet, r, getCol(["DESCRICAO", "DESCRIÇÃO"]), `${pedido.marca} ${lote.tipo} ${lote.referencia}`.toUpperCase());
        setCell(sheet, r, getCol(["REFERENCIA", "REF"]), lote.referencia);
        setCell(sheet, r, getCol(["TIPO"]), lote.tipo);
        setCell(sheet, r, getCol(["MODELO"]), lote.modelo);
        setCell(sheet, r, getCol(["MARCA"]), pedido.marca);
        setCell(sheet, r, getCol(["COR 1", "COR"]), lote.corEscolhida || lote.cor1);
        setCell(sheet, r, getCol(["VALOR COMPRA", "CUSTO"]), Number(lote.valorCompra), "n");
        setCell(sheet, r, getCol(["PREÇO VENDA", "VENDA"]), Number(lote.precoVenda), "n");

        const colLoja = COL[lote.loja] ?? COL[parseInt(lote.loja).toString()];
        if (colLoja !== undefined) {
          setCell(sheet, r, colLoja, lote.gradeLetra);
        }
        
        linhaExcel++;
      });

      const range = XLSX.utils.decode_range(sheet["!ref"] || "A1:Z100");
      range.e.r = Math.max(range.e.r, linhaExcel + 10);
      sheet["!ref"] = XLSX.utils.encode_range(range);

      XLSX.writeFile(workbook, `PEDIDO_${pedido.marca || 'REAL'}_${numPedidoUnico}.xlsx`);
      alert("Planilha gerada com sucesso!");
    } catch (e: any) { 
      alert("Erro ao exportar planilha: " + e.message); 
    }
  };

  const paresGradeAtual = useMemo(() => Object.values(gradeEditando).reduce((a: number, b: any) => a + (Number(b) || 0), 0), [gradeEditando]);
  
  const getMesPrazo = (dias: number) => {
    if (!pedido.fatFim) return "MÊS";
    const data = new Date(pedido.fatFim);
    data.setDate(data.getDate() + (Number(dias) || 0));
    return data.toLocaleDateString('pt-BR', { month: 'short' }).toUpperCase();
  };

  useEffect(() => {
    const custo = Number(itemAtual.valorCompra) * (1 - (pedido.desconto || 0) / 100);
    const dezena = Math.floor((custo * (pedido.markup || 2.6)) / 10) * 10;
    setItemAtual(prev => ({ ...prev, precoVenda: dezena + 9.99 }));
  }, [itemAtual.valorCompra, pedido.desconto, pedido.markup]);

  const resumoPorLote = useMemo(() => {
    const grupos: Record<string, any> = {};
    lotesFinalizados.forEach(l => {
      if (!grupos[l.idVinculo]) grupos[l.idVinculo] = { idVinculo: l.idVinculo, gradeLetra: l.gradeLetra, lojas: [], valor: 0, pares: 0, itemIds: [] };
      const grade = gradesSalvas.find(g => g.letra === l.gradeLetra);
      if (!grupos[l.idVinculo].lojas.includes(l.loja)) grupos[l.idVinculo].lojas.push(l.loja);
      if (!grupos[l.idVinculo].itemIds.includes(l.id)) grupos[l.idVinculo].itemIds.push(l.id);
      grupos[l.idVinculo].pares += grade?.total || 0;
      grupos[l.idVinculo].valor += (grade?.total || 0) * (l.valorCompra * (1 - (pedido.desconto || 0) / 100));
    });
    return grupos;
  }, [lotesFinalizados, gradesSalvas, pedido.desconto]);

  const updateItemAssignment = (ref: string, field: 'gradeLetra' | 'corSelecionada', value: string) => {
    setPersistAssignments(prev => ({
      ...prev,
      [ref]: {
        ...(prev[ref] || { gradeLetra: "", corSelecionada: "" }),
        [field]: value
      }
    }));
  };

  return (
    <div className="fixed inset-0 bg-slate-200/60 backdrop-blur-xl flex items-center justify-center p-0 md:p-6 z-[100] font-sans text-slate-700 text-[13px]">
      <div className="bg-[#F0F4F8] w-full max-w-5xl h-full md:h-[94vh] md:rounded-[50px] shadow-2xl flex flex-col overflow-hidden border border-white/50 relative">
        
        <div className="px-8 py-4 flex justify-between items-center bg-white/30 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg"><ShoppingBag className="text-white" size={20} /></div>
            <h1 className="text-lg font-black text-slate-900 uppercase italic">Real Admin</h1>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center bg-white rounded-full shadow-md"><X size={18} /></button>
        </div>

        <div className="flex px-8 gap-2 shrink-0 pb-2">
          {[1, 2, 3, 4].map(n => (
            <button key={n} onClick={() => setEtapa(n)} className={`flex-1 py-2 rounded-xl text-[9px] font-black uppercase transition-all ${etapa === n ? 'bg-blue-600 text-white shadow-md' : 'bg-white/50 text-slate-400'}`}>Passo 0{n}</button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 custom-scrollbar">
          {etapa === 1 && (
            <div className="max-w-xl mx-auto space-y-6 animate-in fade-in">
              <div className="bg-white/80 p-6 rounded-[35px] shadow-sm border border-white space-y-4">
                <input className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-black text-slate-900 outline-none uppercase" placeholder="MARCA" value={pedido.marca} onChange={e => setPedido({...pedido, marca: e.target.value.toUpperCase()})} />
                <input className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-black text-slate-900 outline-none uppercase" placeholder="FORNECEDOR" value={pedido.fornecedor} onChange={e => setPedido({...pedido, fornecedor: e.target.value.toUpperCase()})} />
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-blue-50/50 p-2 rounded-[20px] border border-blue-100 text-center"><span className="text-[8px] font-black text-blue-400 uppercase">Desc %</span><input type="number" className="w-full text-center bg-transparent font-black text-xl outline-none" value={pedido.desconto || ""} onChange={e => setPedido({...pedido, desconto: Number(e.target.value)})} /></div>
                  <div className="bg-blue-50/50 p-2 rounded-[20px] border border-blue-100 text-center"><span className="text-[8px] font-black text-blue-400 uppercase">Markup</span><input type="number" step="0.1" className="w-full text-center bg-transparent font-black text-xl outline-none" value={pedido.markup || ""} onChange={e => setPedido({...pedido, markup: Number(e.target.value)})} /></div>
                </div>
                <div className="flex gap-4 pt-2 border-t border-slate-100 justify-center">
                  <div className="text-center flex-1"><span className="text-[7px] font-black text-slate-400 uppercase mb-1 block">Início</span><input type="date" className="w-full p-3 bg-slate-50 rounded-2xl font-bold text-xs outline-none text-center" value={pedido.fatInicio} onChange={e => setPedido({...pedido, fatInicio: e.target.value})} /></div>
                  <div className="text-center flex-1"><span className="text-[7px] font-black text-slate-400 uppercase mb-1 block">Limite</span><input type="date" className="w-full p-3 bg-slate-50 rounded-2xl font-bold text-xs outline-none text-center" value={pedido.fatFim} onChange={e => setPedido({...pedido, fatFim: e.target.value})} /></div>
                </div>
              </div>
            </div>
          )}

          {etapa === 2 && (
            <div className="max-w-xl mx-auto space-y-4 animate-in slide-in-from-right">
              <div className="bg-white p-6 rounded-[40px] shadow-sm border border-white space-y-4">
                <div className="grid grid-cols-2 gap-3">
                   <input className="p-4 bg-slate-50 rounded-2xl font-black text-xl outline-none shadow-inner" placeholder="REFERÊNCIA" value={itemAtual.referencia} onChange={e => setItemAtual({...itemAtual, referencia: e.target.value.toUpperCase()})} />
                   <select className="p-4 bg-slate-50 rounded-2xl font-black text-xs outline-none uppercase" value={itemAtual.modelo} onChange={e => setItemAtual({...itemAtual, modelo: e.target.value as any})}>
                      <option value="Fem">Feminino</option><option value="Inf">Infantil</option><option value="Masc">Masculino</option><option value="Acess">Acessório</option>
                   </select>
                </div>
                <input className="w-full p-3 bg-slate-50 rounded-xl font-bold text-xs outline-none uppercase" placeholder="TIPO / DESCRIÇÃO" value={itemAtual.tipo} onChange={e => setItemAtual({...itemAtual, tipo: e.target.value.toUpperCase()})} />
                <div className="grid grid-cols-3 gap-2">
                   {["cor1", "cor2", "cor3"].map(c => (
                     <input key={c} className="p-3 bg-slate-50 rounded-xl font-bold text-[9px] outline-none uppercase" placeholder={c.toUpperCase()} value={itemAtual[c as keyof typeof itemAtual]} onChange={e => setItemAtual({...itemAtual, [c]: e.target.value.toUpperCase()})} />
                   ))}
                </div>
                <div className="bg-slate-900 p-5 rounded-[30px] text-white flex justify-between items-center shadow-xl border-b-4 border-blue-600">
                  <div className="text-center"><span className="text-[7px] font-black text-slate-500 uppercase">CUSTO</span><input type="number" className="bg-white/10 p-2 rounded-xl font-black text-xl outline-none w-20 text-center" value={itemAtual.valorCompra || ""} onChange={e => setItemAtual({...itemAtual, valorCompra: Number(e.target.value)})} /></div>
                  <div className="text-right text-yellow-400 font-black"><span className="text-[8px] text-blue-400 block uppercase">Venda Sugerida</span>R$ {itemAtual.precoVenda.toFixed(2)}</div>
                </div>
                <button onClick={() => { if(!itemAtual.referencia) return; setItens([...itens, {...itemAtual, id: crypto.randomUUID()}]); setItemAtual({...itemAtual, referencia: "", valorCompra: 0, cor1: "", cor2: "", cor3: ""}); }} className="w-full bg-blue-600 text-white p-4 rounded-[25px] font-black text-[10px] uppercase shadow-lg hover:bg-blue-700">+ ADICIONAR ITEM</button>
              </div>
              <div className="space-y-2">
                {itens.map(it => (
                  <div key={it.id} className="bg-white/80 p-3 rounded-[20px] border border-white flex justify-between items-center shadow-sm uppercase">
                    <div className="flex flex-col"><span className="font-black text-xs text-slate-800">{it.referencia} • {it.tipo}</span><span className="text-[8px] text-blue-500 font-bold italic">Custo R$ {it.valorCompra.toFixed(2)} | Venda R$ {it.precoVenda.toFixed(2)}</span></div>
                    <button onClick={() => setItens(itens.filter(x => x.id !== it.id))} className="text-red-400 p-2"><Trash2 size={16}/></button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {etapa === 3 && (
            <div className="max-w-2xl mx-auto space-y-6 animate-in zoom-in text-center">
              <div className="bg-white p-8 rounded-[40px] shadow-sm border border-slate-100 space-y-6 relative">
                <div className="absolute -top-4 right-8 bg-red-600 text-white px-4 py-2 rounded-full font-black text-xs shadow-xl animate-pulse">{paresGradeAtual} PARES</div>
                <h3 className="text-sm font-black text-slate-800 uppercase italic">Montando Grade <span className="text-blue-600">{LETRAS[gradesSalvas.length]}</span></h3>
                <div className="grid grid-cols-5 md:grid-cols-8 gap-2">
                  {(TAMANHOS[itemAtual.modelo] || []).map(tam => (
                    <div key={tam} className="text-center bg-slate-50 rounded-xl p-2 border border-slate-100">
                      <label className="text-[8px] font-black text-slate-400 block mb-1">{tam}</label>
                      <input type="number" className="w-full text-center bg-transparent font-black text-sm outline-none" value={gradeEditando[tam] || ""} onChange={e => setGradeEditando({...gradeEditando, [tam]: Number(e.target.value)})} />
                    </div>
                  ))}
                </div>
                <button onClick={() => { 
                  if(paresGradeAtual === 0) return alert("Insira as quantidades!");
                  setGradesSalvas([...gradesSalvas, { letra: LETRAS[gradesSalvas.length], modelo: itemAtual.modelo, valores: {...gradeEditando}, total: paresGradeAtual }]); 
                  setGradeEditando({}); alert("Grade salva!"); 
                }} className="w-full bg-blue-700 text-white p-4 rounded-[25px] font-black shadow-lg uppercase text-[10px]">Confirmar Grade {LETRAS[gradesSalvas.length]}</button>
              </div>
            </div>
          )}

          {etapa === 4 && (
            <div className="max-w-6xl mx-auto space-y-4 animate-in slide-in-from-bottom">
               <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="bg-white p-4 rounded-[35px] shadow-sm border border-slate-100 flex flex-col">
                    <span className="text-[9px] font-black text-slate-300 uppercase block text-center mb-2">1. Itens & Grades Individuais</span>
                    <div className="space-y-2 flex-1 max-h-[450px] overflow-y-auto no-scrollbar">
                      {itens.map(it => {
                        const isSelected = selecaoLote.itensIds.includes(it.id);
                        const assignment = persistAssignments[it.referencia] || { gradeLetra: "", corSelecionada: it.cor1 || "" };
                        return (
                          <div key={it.id} className={`flex flex-col p-3 rounded-2xl border-2 transition-all ${isSelected ? 'bg-blue-50 border-blue-600 shadow-sm' : 'bg-slate-50 border-transparent opacity-80'}`}>
                            <label className="flex items-start gap-3 cursor-pointer mb-1">
                              <input type="checkbox" className="w-4 h-4 rounded border-slate-300 text-blue-600 mt-1" checked={isSelected} onChange={() => setSelecaoLote({...selecaoLote, itensIds: isSelected ? selecaoLote.itensIds.filter(x => x !== it.id) : [...selecaoLote.itensIds, it.id]})} />
                              <div className="flex flex-col flex-1">
                                <span className="text-[10px] font-black uppercase text-slate-900 leading-tight">{pedido.marca} {it.tipo}</span>
                                <span className="text-[8px] font-bold text-slate-400 uppercase italic">{it.referencia}</span>
                              </div>
                            </label>
                            {isSelected && (
                              <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-blue-100">
                                <select value={assignment.gradeLetra} onChange={(e) => updateItemAssignment(it.referencia, 'gradeLetra', e.target.value)} className="p-1.5 bg-white border border-blue-200 rounded-lg text-[9px] font-black text-blue-700">
                                  <option value="">GRADE?</option>
                                  {gradesSalvas.map(gr => <option key={gr.letra} value={gr.letra}>Grade {gr.letra}</option>)}
                                </select>
                                <select value={assignment.corSelecionada} onChange={(e) => updateItemAssignment(it.referencia, 'corSelecionada', e.target.value)} className="p-1.5 bg-white border border-blue-200 rounded-lg text-[9px] font-black text-blue-700 uppercase">
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
                  <div className="bg-white p-4 rounded-[35px] shadow-sm border border-slate-100 space-y-3">
                    <span className="text-[9px] font-black text-slate-300 uppercase block text-center mb-2">2. Resumo das Grades</span>
                    <div className="space-y-2 max-h-[450px] overflow-y-auto no-scrollbar">
                      {gradesSalvas.map(gr => (
                        <div key={gr.letra} className="bg-slate-50 p-3 rounded-2xl border border-slate-100 flex items-center gap-3">
                            <span className="text-xl font-black italic text-blue-600">{gr.letra}</span>
                            <span className="text-[10px] font-black text-slate-700">{gr.total} PARES</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="bg-white p-4 rounded-[35px] shadow-sm border border-slate-100 text-center">
                    <div className="flex bg-slate-50 rounded-xl p-1 mb-2">
                       <button onClick={() => setModoLojas('subgrupo')} className={`flex-1 py-1 text-[8px] font-black uppercase rounded-lg transition-all ${modoLojas === 'subgrupo' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400'}`}>Subgrupo</button>
                       <button onClick={() => setModoLojas('todas')} className={`flex-1 py-1 text-[8px] font-black uppercase rounded-lg transition-all ${modoLojas === 'todas' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400'}`}>Todas</button>
                    </div>
                    <div className="grid grid-cols-4 gap-1 max-h-64 overflow-y-auto no-scrollbar">
                      {(modoLojas === 'subgrupo' ? SUBGRUPO_LOJAS : Array.from({length: 120}, (_, i) => (i+1).toString().padStart(2, '0'))).map(loja => (
                        <button key={loja} onClick={() => setSelecaoLote({...selecaoLote, lojasIds: selecaoLote.lojasIds.includes(loja) ? selecaoLote.lojasIds.filter(x => x !== loja) : [...selecaoLote.lojasIds, loja]})} className={`p-1.5 rounded-lg text-[9px] font-black transition-all ${selecaoLote.lojasIds.includes(loja) ? 'bg-blue-700 text-white' : 'bg-slate-50 text-slate-400'}`}>{loja}</button>
                      ))}
                    </div>
                  </div>
               </div>
               <button onClick={() => {
                 const invalid = selecaoLote.itensIds.some(id => !persistAssignments[itens.find(i => i.id === id).referencia]?.gradeLetra);
                 if (selecaoLote.itensIds.length === 0 || selecaoLote.lojasIds.length === 0) return alert("Selecione itens e lojas!");
                 if (invalid) return alert("Vincule uma grade aos itens marcados!");
                 const idVinculo = crypto.randomUUID();
                 const novos = selecaoLote.itensIds.flatMap(id => {
                   const it = itens.find(i => i.id === id);
                   const cfg = persistAssignments[it.referencia];
                   return selecaoLote.lojasIds.map(loja => ({ ...it, loja, gradeLetra: cfg.gradeLetra, corEscolhida: cfg.corSelecionada || it.cor1, idVinculo }));
                 });
                 setLotesFinalizados([...lotesFinalizados, ...novos]);
                 setSelecaoLote({ itensIds: [], lojasIds: [] });
                 alert("Lote vinculado!");
               }} className="w-full bg-blue-700 text-white p-4 rounded-[25px] font-black shadow-xl uppercase flex items-center justify-center gap-3">
                 <Layers size={18}/> GERAR VÍNCULOS DE LOTE (INDIVIDUALIZADO)
               </button>
            </div>
          )}
        </div>

        <div className="p-4 md:px-8 bg-white border-t flex justify-between items-center shrink-0">
          <button onClick={() => setVerLotes(!verLotes)} className={`px-6 py-3 rounded-2xl font-black text-[10px] uppercase flex items-center gap-2 transition-all ${verLotes ? 'bg-blue-600 text-white shadow-lg' : 'bg-blue-50 text-blue-700 hover:bg-blue-100'}`}><ListFilter size={16}/> VER LOTES ({Object.keys(resumoPorLote).length})</button>
          <div className="flex items-center gap-3">
            <button onClick={exportarPlanilhaFinal} className="bg-red-600 text-white px-8 py-3 rounded-2xl font-black text-[10px] uppercase shadow-lg flex items-center gap-2 animate-pulse"><Download size={16}/> EXPORTAR PEDIDO FINAL</button>
            <button onClick={onClose} className="bg-slate-900 text-white px-6 py-3 rounded-2xl font-black text-[10px] uppercase flex items-center gap-2 hover:bg-black transition-all shadow-md"><LogOut size={16}/> FECHAR</button>
          </div>
        </div>
      </div>
    </div>
  );
};

const formatCurrency = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

export default SpreadsheetOrderModule;