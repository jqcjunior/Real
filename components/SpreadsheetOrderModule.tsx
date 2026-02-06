import React, { useState, useEffect, useMemo } from "react";
import * as XLSX from "xlsx";
import { 
  ChevronRight, Download, Trash2, X, ShoppingBag, CheckCircle2, ListFilter, LogOut, Edit3, Layers
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
  const [selecaoLote, setSelecaoLote] = useState({ itensIds: [] as string[], gradeLetra: "", lojasIds: [] as string[] });

  /* --- UTILITÁRIOS EXCEL DINÂMICO --- */
  const setCell = (sheet: XLSX.WorkSheet, r: number, c: number, value: any, type: "s" | "n" = "s") => {
    if (c === undefined) return;
    const ref = XLSX.utils.encode_cell({ r, c });
    sheet[ref] = { t: type, v: value };
  };

  const criarMapaColunas = (sheet: XLSX.WorkSheet) => {
    const mapa: Record<string, number> = {};
    if (!sheet["!ref"]) return mapa;
    const range = XLSX.utils.decode_range(sheet["!ref"]);
    for (let c = range.s.c; c <= range.e.c; c++) {
      const cell = sheet[XLSX.utils.encode_cell({ r: 0, c })];
      if (cell?.v) mapa[String(cell.v).toUpperCase().trim()] = c;
    }
    return mapa;
  };

  const exportarPlanilhaFinal = async () => {
    if (lotesFinalizados.length === 0) return alert("Vincule itens primeiro!");
    try {
      const response = await fetch("/Pedido_Sub_R2J_.xlsx");
      const buffer = await response.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const COL = criarMapaColunas(sheet);
      const numPedidoUnico = Math.floor(1000 + Math.random() * 9000);
      let linhaExcel = 1;

      lotesFinalizados.forEach((lote, idx) => {
        const r = linhaExcel;
        setCell(sheet, r, COL["PED. FORNECEDOR"], numPedidoUnico, "n");
        setCell(sheet, r, COL["FORNECEDOR"], pedido.fornecedor);
        setCell(sheet, r, COL["COMPRADOR"], user.name);
        setCell(sheet, r, COL["PREVISÃO"], pedido.fatInicio);
        setCell(sheet, r, COL["LIMITE ENTREGA"], pedido.fatFim);
        setCell(sheet, r, COL["ITEM"], idx + 1, "n");
        setCell(sheet, r, COL["DESCRICAO"], `${pedido.marca} ${lote.tipo} ${lote.referencia}`.toUpperCase());
        setCell(sheet, r, COL["REFERENCIA"], lote.referencia);
        setCell(sheet, r, COL["TIPO"], lote.tipo);
        setCell(sheet, r, COL["MODELO"], lote.modelo);
        setCell(sheet, r, COL["MARCA"], pedido.marca);
        setCell(sheet, r, COL["COR 1"], lote.cor1);
        setCell(sheet, r, COL["VALOR COMPRA"], Number(lote.valorCompra), "n");
        setCell(sheet, r, COL["PREÇO VENDA"], Number(lote.precoVenda), "n");

        const colLoja = COL[parseInt(lote.loja).toString()];
        if (colLoja !== undefined) setCell(sheet, r, colLoja, lote.gradeLetra);
        linhaExcel++;
      });

      sheet["!ref"] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: linhaExcel + 5, c: 200 } });
      sheet["!views"] = [{ state: "frozen", ySplit: 1 }];
      XLSX.writeFile(workbook, `OTB_R2J_${pedido.marca}_${numPedidoUnico}.xlsx`);
    } catch (e) { alert("Erro ao exportar planilha."); }
  };

  /* --- LOGICA UI --- */
  // Fix: Explicitly type accumulator as number and current value as any to resolve "unknown" type errors in reduce
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

  return (
    <div className="fixed inset-0 bg-slate-200/60 backdrop-blur-xl flex items-center justify-center p-0 md:p-6 z-[100] font-sans text-slate-700 text-[13px]">
      <div className="bg-[#F0F4F8] w-full max-w-5xl h-full md:h-[94vh] md:rounded-[50px] shadow-2xl flex flex-col overflow-hidden border border-white/50 relative">
        
        {/* HEADER */}
        <div className="px-8 py-4 flex justify-between items-center bg-white/30 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg"><ShoppingBag className="text-white" size={20} /></div>
            <h1 className="text-lg font-black text-slate-900 uppercase italic">Real Admin</h1>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center bg-white rounded-full shadow-md"><X size={18} /></button>
        </div>

        {/* PROGRESSO */}
        <div className="flex px-8 gap-2 shrink-0 pb-2">
          {[1, 2, 3, 4].map(n => (
            <button key={n} onClick={() => setEtapa(n)} className={`flex-1 py-2 rounded-xl text-[9px] font-black uppercase transition-all ${etapa === n ? 'bg-blue-600 text-white shadow-md' : 'bg-white/50 text-slate-400'}`}>Passo 0{n}</button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 custom-scrollbar">
          
          {/* PASSO 1 */}
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
              <div className="grid grid-cols-3 gap-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="bg-white p-4 rounded-[25px] shadow-sm border border-white text-center">
                    <input type="number" className="w-full text-center bg-transparent font-black text-xl text-blue-600 outline-none" value={pedido[`prazo${i}` as keyof typeof pedido]} onChange={e => setPedido({...pedido, [`prazo${i}`]: Number(e.target.value)})} />
                    <p className="text-[8px] font-bold text-slate-400 uppercase">{getMesPrazo(Number(pedido[`prazo${i}` as keyof typeof pedido]))}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* PASSO 2 */}
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

          {/* PASSO 3 */}
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
              <div className="flex flex-wrap gap-2 justify-center">
                {gradesSalvas.map(g => <div key={g.letra} className="bg-blue-900 text-white p-2 px-4 rounded-full text-[10px] font-black flex items-center gap-2">GRADE {g.letra} ({g.total} PR) <CheckCircle2 size={12}/></div>)}
              </div>
            </div>
          )}

          {/* PASSO 4: MESA DE DISTRIBUIÇÃO AJUSTADA */}
          {etapa === 4 && (
            <div className="max-w-6xl mx-auto space-y-4 animate-in slide-in-from-bottom">
               <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {/* COLUNA 1: ITENS COM DESCRIÇÃO RICA */}
                  <div className="bg-white p-4 rounded-[35px] shadow-sm border border-slate-100 space-y-3">
                    <span className="text-[9px] font-black text-slate-300 uppercase block text-center">1. Selecionar Itens</span>
                    <div className="space-y-1.5 max-h-64 overflow-y-auto no-scrollbar">
                      {itens.map(it => (
                        <label key={it.id} className={`flex flex-col p-2 rounded-xl border-2 transition-all cursor-pointer text-left ${selecaoLote.itensIds.includes(it.id) ? 'bg-blue-600 border-blue-600 text-white shadow-md' : 'bg-slate-50'}`}>
                          <input type="checkbox" className="hidden" checked={selecaoLote.itensIds.includes(it.id)} onChange={() => setSelecaoLote({...selecaoLote, itensIds: selecaoLote.itensIds.includes(it.id) ? selecaoLote.itensIds.filter(x => x !== it.id) : [...selecaoLote.itensIds, it.id]})} />
                          <span className="text-[9px] font-black uppercase leading-tight">{pedido.marca} {it.tipo}</span>
                          <div className="flex justify-between items-center mt-1">
                            <span className="text-[8px] font-bold opacity-80 uppercase italic">{it.referencia}</span>
                            <span className="text-[9px] font-black text-yellow-500">R$ {it.precoVenda.toFixed(2)}</span>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* COLUNA 2: GRADE MENOR E ELEGANTE */}
                  <div className="bg-white p-4 rounded-[35px] shadow-sm border border-slate-100 space-y-3 text-center">
                    <span className="text-[9px] font-black text-slate-300 uppercase block">2. Escolher Grade</span>
                    <div className="grid grid-cols-2 gap-2">
                      {gradesSalvas.map(gr => (
                        <label key={gr.letra} className={`flex items-center gap-2 p-2 rounded-xl border-2 transition-all cursor-pointer ${selecaoLote.gradeLetra === gr.letra ? 'bg-red-600 border-red-600 text-white shadow-md' : 'bg-slate-50'}`}>
                          <input type="radio" name="gr" className="hidden" checked={selecaoLote.gradeLetra === gr.letra} onChange={() => setSelecaoLote({...selecaoLote, gradeLetra: gr.letra})} />
                          <span className="text-lg font-black italic">{gr.letra}</span>
                          <div className="flex flex-col items-start leading-none">
                             <span className="text-[8px] font-black uppercase">{gr.modelo}</span>
                             <span className="text-[7px] font-bold opacity-70">{gr.total} pares</span>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* COLUNA 3: LOJAS */}
                  <div className="bg-white p-4 rounded-[35px] shadow-sm border border-slate-100 space-y-3 text-center">
                    <div className="flex bg-slate-50 rounded-xl p-1 mb-2">
                       <button onClick={() => setModoLojas('subgrupo')} className={`flex-1 py-1 text-[8px] font-black uppercase rounded-lg transition-all ${modoLojas === 'subgrupo' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400'}`}>Subgrupo</button>
                       <button onClick={() => setModoLojas('todas')} className={`flex-1 py-1 text-[8px] font-black uppercase rounded-lg transition-all ${modoLojas === 'todas' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400'}`}>Todas</button>
                    </div>
                    <div className="grid grid-cols-4 gap-1 max-h-48 overflow-y-auto no-scrollbar">
                      {(modoLojas === 'subgrupo' ? SUBGRUPO_LOJAS : Array.from({length: 120}, (_, i) => (i+1).toString().padStart(2, '0'))).map(loja => (
                        <button key={loja} onClick={() => setSelecaoLote({...selecaoLote, lojasIds: selecaoLote.lojasIds.includes(loja) ? selecaoLote.lojasIds.filter(x => x !== loja) : [...selecaoLote.lojasIds, loja]})} className={`p-1.5 rounded-lg text-[9px] font-black transition-all ${selecaoLote.lojasIds.includes(loja) ? 'bg-blue-700 text-white' : 'bg-slate-50 text-slate-400'}`}>{loja}</button>
                      ))}
                    </div>
                  </div>
               </div>
               
               {/* BOTÃO DE VINCULO AJUSTADO */}
               <button onClick={() => {
                 if (!selecaoLote.gradeLetra || selecaoLote.itensIds.length === 0 || selecaoLote.lojasIds.length === 0) return alert("Selecione tudo!");
                 const idVinculo = crypto.randomUUID();
                 const novos = selecaoLote.itensIds.flatMap(id => {
                   const it = itens.find(i => i.id === id);
                   return selecaoLote.lojasIds.map(loja => ({ ...it, loja, gradeLetra: selecaoLote.gradeLetra, idVinculo }));
                 });
                 setLotesFinalizados([...lotesFinalizados, ...novos]);
                 setSelecaoLote({ itensIds: [], gradeLetra: "", lojasIds: [] });
               }} className="w-full bg-blue-700 text-white p-4 rounded-[25px] font-black shadow-xl uppercase active:scale-95 transition-all flex items-center justify-center gap-3">
                 <Layers size={18}/> VINCULAR LOTE AO PEDIDO FINAL
               </button>
            </div>
          )}
        </div>

        {/* GAVETA DE LOTES COM EDIÇÃO/EXCLUSÃO */}
        {verLotes && (
          <div className="absolute bottom-20 left-6 right-6 bg-white rounded-[40px] shadow-2xl border border-slate-100 z-50 animate-in slide-in-from-bottom max-h-[50vh] flex flex-col">
            <div className="p-6 border-b flex justify-between items-center"><h3 className="font-black text-blue-900 uppercase italic tracking-tighter">Resumo Lotes</h3><button onClick={() => setVerLotes(false)} className="p-2 bg-slate-100 rounded-full"><X size={16}/></button></div>
            <div className="p-6 overflow-y-auto space-y-4 custom-scrollbar">
              {Object.entries(resumoPorLote).map(([chave, grupo]: [string, any]) => (
                <div key={chave} className="bg-slate-50 p-4 rounded-3xl border border-slate-100 relative">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex flex-col">
                      <span className="text-lg font-black italic text-red-600 uppercase leading-none">Grade {grupo.gradeLetra}</span>
                      <span className="text-[10px] font-bold text-slate-400 mt-1 uppercase">{grupo.pares} PR TOTAL</span>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => { setSelecaoLote({ itensIds: grupo.itemIds, gradeLetra: grupo.gradeLetra, lojasIds: grupo.lojas }); setLotesFinalizados(prev => prev.filter(l => l.idVinculo !== grupo.idVinculo)); setVerLotes(false); setEtapa(4); }} className="p-2 bg-blue-100 text-blue-700 rounded-xl"><Edit3 size={16}/></button>
                      <button onClick={() => { if(confirm("Remover lote?")) setLotesFinalizados(prev => prev.filter(l => l.idVinculo !== grupo.idVinculo)); }} className="p-2 bg-red-100 text-red-700 rounded-xl"><Trash2 size={16}/></button>
                    </div>
                  </div>
                  <div className="text-[11px] font-bold text-slate-500 mb-2">Lojas: <span className="text-blue-900 font-black">{grupo.lojas.join(', ')}</span></div>
                  <div className="text-right font-black text-green-600 text-lg italic leading-none">R$ {grupo.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* RODAPÉ */}
        <div className="p-4 md:px-8 bg-white border-t flex justify-between items-center shrink-0">
          <button onClick={() => setVerLotes(!verLotes)} className="bg-blue-50 text-blue-700 px-6 py-3 rounded-2xl font-black text-[10px] uppercase flex items-center gap-2 hover:bg-blue-100 transition-all"><ListFilter size={16}/> VEJA LOTES ({Object.keys(resumoPorLote).length})</button>
          <div className="flex items-center gap-3">
            <button onClick={exportarPlanilhaFinal} className="bg-red-600 text-white px-8 py-3 rounded-2xl font-black text-[10px] uppercase shadow-lg flex items-center gap-2 active:scale-95 animate-pulse"><Download size={16}/> EXPORTAR</button>
            <button onClick={onClose} className="bg-slate-900 text-white px-6 py-3 rounded-2xl font-black text-[10px] uppercase flex items-center gap-2 hover:bg-black transition-all"><LogOut size={16}/> FINALIZAR</button>
          </div>
        </div>
      </div>
      <style dangerouslySetInnerHTML={{ __html: `.custom-scrollbar::-webkit-scrollbar { width: 3px; } .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; } .no-scrollbar::-webkit-scrollbar { display: none; } input[type=number]::-webkit-inner-spin-button, input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; } @keyframes fadeIn { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } } .animate-in { animation: fadeIn 0.3s ease-out; }`}} />
    </div>
  );
};

export default SpreadsheetOrderModule;