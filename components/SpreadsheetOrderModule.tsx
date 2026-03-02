import React, { useState, useEffect, useMemo } from "react";
import * as XLSX from "xlsx";
import { 
  Download, Trash2, X, ShoppingBag, ListFilter, Layers, Calendar, Zap, Percent, Hash, Info, Plus, ChevronRight, CreditCard
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

const GRADES_PREDEFINIDAS = {
  Inf: [
    { label: "16-22 (BABY)", valores: { "16": 1, "17": 1, "18": 1, "19": 1, "20": 1, "21": 1, "22": 1 } },
    { label: "20-26 (CRIANÇA)", valores: { "20": 1, "21": 1, "22": 1, "23": 1, "24": 1, "25": 1, "26": 1 } },
    { label: "22-28 (CRIANÇA)", valores: { "22": 1, "23": 1, "24": 1, "25": 1, "26": 1, "27": 1, "28": 1 } },
    { label: "28-36 (JUVENIL)", valores: { "28": 1, "29": 1, "30": 1, "31": 1, "32": 1, "33": 1, "34": 1, "35": 1, "36": 1 } },
  ],
  Fem: [
    { label: "34-39", valores: { "34": 1, "35": 2, "36": 3, "37": 3, "38": 2, "39": 1 } },
    { label: "35-40", valores: { "35": 1, "36": 2, "37": 3, "38": 3, "39": 2, "40": 1 } },
    { label: "37-40", valores: { "37": 3, "38": 3, "39": 3, "40": 3 } },
  ],
  Masc: [
    { label: "37-42", valores: { "37": 1, "38": 2, "39": 3, "40": 3, "41": 2, "42": 1 } },
    { label: "38-43", valores: { "38": 1, "39": 2, "40": 3, "41": 3, "42": 2, "43": 1 } },
    { label: "38-44", valores: { "38": 1, "39": 2, "40": 2, "41": 2, "42": 2, "43": 2, "44": 1 } },
  ],
  Acess: [
    { label: "UN/P-GG", valores: { "UN": 1, "P": 1, "M": 1, "G": 1, "GG": 1 } },
  ]
};

const getClassificacao = (modelo: string, valores: Record<string, number>) => {
  if (modelo !== "Inf") return "";
  const tamanhosAtivos = Object.entries(valores)
    .filter(([_, v]) => Number(v) > 0)
    .map(([t, _]) => parseInt(t))
    .filter(n => !isNaN(n));
  
  if (tamanhosAtivos.length === 0) return "";
  
  const max = Math.max(...tamanhosAtivos);

  if (max <= 22) return "BABY";
  if (max <= 28) return "CRIANÇA";
  return "JUVENIL";
};

const SpreadsheetOrderModule = ({ user, onClose }: { user: any, onClose: () => void }) => {
  const [etapa, setEtapa] = useState(1);
  const [verLotes, setVerLotes] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [showGradeModal, setShowGradeModal] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 640);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  
  // Pedido
  const [pedido, setPedido] = useState({ 
    marca: "", 
    fornecedor: "", 
    representante: "",
    telefone: "",
    email: "",
    comprador: user?.user_metadata?.full_name || "",
    embarqueInicio: "", 
    embarqueFim: "", 
    desconto: 0, 
    markup: 2.6, 
    prazos: "" 
  });

  const formatPhone = (val: string) => {
    const digits = val.replace(/\D/g, "");
    if (digits.length <= 2) return digits;
    if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
  };

  const [itens, setItens] = useState<any[]>([]);
  const [itemAtual, setItemAtual] = useState({ 
    referencia: "", tipo: "", cor1: "", cor2: "", cor3: "", 
    modelo: "Fem" as keyof typeof TAMANHOS, valorCompra: 0, precoVenda: 0 
  });
  
  // Auto-preenchimento por Marca
  useEffect(() => {
    const autoFillBrand = async () => {
      if (!pedido.marca) return;
      try {
        const { data, error } = await supabase
          .from('Pedido_Header')
          .select('fornecedor, representante, telefone, email')
          .eq('marca', pedido.marca)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (data && !error) {
          setPedido(prev => ({
            ...prev,
            fornecedor: data.fornecedor || prev.fornecedor,
            representante: data.representante || prev.representante,
            telefone: data.telefone || prev.telefone,
            email: data.email || prev.email
          }));
        }
      } catch (err) {
        console.error("Erro no auto-fill:", err);
      }
    };
    
    const timer = setTimeout(autoFillBrand, 500);
    return () => clearTimeout(timer);
  }, [pedido.marca]);

  const fetchSuggestions = async () => {
    try {
      const [brands, suppliers, types, colors, refs] = await Promise.all([
        supabase.from('Pedido_Brand').select('name'),
        supabase.from('Pedido_Suppliers').select('name'),
        supabase.from('Pedido_Types').select('name').eq('publico', itemAtual.modelo),
        supabase.from('Pedido_Colors').select('name'),
        supabase.from('Pedido_References').select('name')
      ]);

      setDbSuggestions({
        marcas: (brands.data || []).map(i => i.name),
        fornecedores: (suppliers.data || []).map(i => i.name),
        tipos: (types.data || []).map(i => i.name),
        cores: (colors.data || []).map(i => i.name),
        referencias: (refs.data || []).map(i => i.name)
      });
    } catch (error) {
      console.error("Erro ao buscar sugestões:", error);
    }
  };

  useEffect(() => {
    fetchSuggestions();
  }, [itemAtual.modelo]);

  const upsertValue = async (table: string, value: string) => {
    if (!value) return;
    try {
      const { data: existing } = await supabase.from(table).select('name').eq('name', value.toUpperCase()).single();
      if (!existing) {
        await supabase.from(table).insert([{ name: value.toUpperCase() }]);
        fetchSuggestions(); // Refresh
      }
    } catch (error) {
      console.error(`Erro ao salvar em ${table}:`, error);
    }
  };

  const upsertTipo = async (value: string) => {
    if (!value) return;

    const upper = value.toUpperCase();

    try {
      const { data: existing } = await supabase
        .from('Pedido_Types')
        .select('id')
        .eq('name', upper)
        .eq('publico', itemAtual.modelo)
        .single();

      if (!existing) {
        await supabase.from('Pedido_Types').insert([
          {
            name: upper,
            publico: itemAtual.modelo
          }
        ]);
        fetchSuggestions();
      }
    } catch (error) {
      console.error(`Erro ao salvar tipo:`, error);
    }
  };

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
    localStorage.setItem("order_assignments_cache", JSON.stringify(persistAssignments));
  }, [persistAssignments]);

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

  const setCell = (
    sheet: XLSX.WorkSheet,
    r: number,
    c: number,
    value: any,
    type: "s" | "n" = "s"
  ) => {
    const ref = XLSX.utils.encode_cell({ r, c });
    
    if (!sheet[ref]) {
      sheet[ref] = { t: type, v: value };
    } else {
      // Preserva metadados (estilos, bordas, comentários) se existirem no template
      sheet[ref].v = value;
      sheet[ref].t = type;
    }

    // Atualiza o range da planilha para garantir que as novas células sejam incluídas na exportação
    if (!sheet["!ref"]) {
      sheet["!ref"] = XLSX.utils.encode_range({
        s: { r, c },
        e: { r, c }
      });
      return;
    }

    const range = XLSX.utils.decode_range(sheet["!ref"]);
    if (r < range.s.r) range.s.r = r;
    if (c < range.s.c) range.s.c = c;
    if (r > range.e.r) range.e.r = r;
    if (c > range.e.c) range.e.c = c;
    sheet["!ref"] = XLSX.utils.encode_range(range);
  };

  const exportarPlanilhaFinal = async () => {
    if (lotesFinalizados.length === 0) {
      alert("Adicione itens e distribua nas lojas primeiro.");
      return;
    }

    try {
      console.log("Iniciando exportação robusta...");
      
      // 1. Fetch do arquivo template.xlsx diretamente do GitHub
      const response = await fetch(
        "https://raw.githubusercontent.com/jqcjunior/Real/main/Template.xlsx",
        {
          method: "GET",
          cache: "no-store",
        }
      );

      if (!response.ok) {
        throw new Error("Não foi possível baixar o template do GitHub. Verifique sua conexão ou o link.");
      }

      // Validação de Content-Type (GitHub raw costuma retornar binary/octet-stream ou similar)
      const contentType = response.headers.get("content-type");
      // Aceitamos octet-stream ou spreadsheetml para o GitHub
      if (!contentType?.includes("spreadsheetml") && !contentType?.includes("octet-stream")) {
        const text = await response.text();
        console.error("Resposta inválida do GitHub:", text.slice(0, 200));
        throw new Error("O link do GitHub não retornou um arquivo Excel válido.");
      }

      const arrayBuffer = await response.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];

      // 2. Preenchimento do Cabeçalho (COORDENADAS EXATAS)
      setCell(sheet, 2, 13, pedido.marca);          // Marca (N3)
      setCell(sheet, 3, 13, pedido.fornecedor);     // Razão Social (N4)
      setCell(sheet, 2, 26, pedido.representante);  // Representante (AA3)
      setCell(sheet, 2, 39, pedido.telefone);       // Telefone (AN3)
      setCell(sheet, 3, 26, pedido.email);         // Email (AA4)
      setCell(sheet, 1, 26, pedido.comprador);     // Comprador (AA2)
      setCell(sheet, 4, 26, pedido.embarqueInicio); // Embarque Início (AA5)
      setCell(sheet, 4, 33, pedido.embarqueFim);    // Embarque Fim (AH5)
      setCell(sheet, 5, 25, Number(pedido.desconto), "n"); // Desconto (Z6)
      setCell(sheet, 5, 31, Number(pedido.markup), "n");   // Markup (AF6)

      // Lógica de Prazos e Vencimentos (N5, Q5, T5 e N6, Q6, T6)
      if (pedido.embarqueFim && pedido.prazos) {
        const date = new Date(pedido.embarqueFim + "T12:00:00");
        const meses = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
        const prazosArr = pedido.prazos.split('/');
        
        prazosArr.forEach((p, i) => {
          if (i > 2) return; // Apenas os 3 primeiros
          const val = parseInt(p);
          if (isNaN(val)) return;
          
          const col = 13 + (i * 3); // N=13, Q=16, T=19
          setCell(sheet, 4, col, val, "n"); // Dias (Linha 5)
          
          const d = new Date(date);
          if (val % 30 === 0) {
            d.setMonth(d.getMonth() + (val / 30));
          } else {
            d.setDate(d.getDate() + val);
          }
          const mesStr = `${meses[d.getMonth()]}/${String(d.getFullYear()).slice(-2)}`;
          setCell(sheet, 5, col, mesStr); // Mês (Linha 6)
        });
      }

      // 3. Preenchimento dos Itens (Início na Linha 36)
      const itemsUnicos = Array.from(
        new Set(lotesFinalizados.map(l => `${l.referencia}-${l.corEscolhida}`))
      );

      itemsUnicos.forEach((key, idx) => {
        const lotes = lotesFinalizados.filter(
          l => `${l.referencia}-${l.corEscolhida}` === key
        );

        const refObj = lotes[0];
        const r = 35 + idx; // Linha 36

        setCell(sheet, r, 2, refObj.referencia); // Coluna C
        setCell(sheet, r, 7, refObj.tipo);       // Coluna H
        setCell(sheet, r, 17, refObj.cor1);      // R36
        setCell(sheet, r, 18, refObj.cor2);      // S36
        setCell(sheet, r, 19, refObj.cor3);      // T36
        setCell(sheet, r, 37, Number(refObj.valorCompra), "n"); // AL36
        setCell(sheet, r, 40, Number(refObj.precoVenda), "n");  // AO36

        // 4. Grades por Lote (X, AA, AD, AG, AJ)
        const lotesAgrupadosPorVinculo = Array.from(new Set(lotes.map(l => l.idVinculo)));
        lotesAgrupadosPorVinculo.forEach((vid, vIdx) => {
          if (vIdx > 4) return;
          const col = 23 + (vIdx * 3); // X=23, AA=26, AD=29, AG=32, AJ=35
          const loteItem = lotes.find(l => l.idVinculo === vid);
          if (loteItem) {
            setCell(sheet, r, col, loteItem.gradeLetra);
          }
        });
      });

      // 5. Matriz de Distribuição de Lojas (Linhas 23 a 27)
      const vinculosUnicos = Array.from(new Set(lotesFinalizados.map(l => l.idVinculo)));
      vinculosUnicos.forEach((vid, vIdx) => {
        if (vIdx > 4) return;
        const r = 22 + vIdx; // Linha 23
        const lotesDoVinculo = lotesFinalizados.filter(l => l.idVinculo === vid);
        
        // Listar lojas horizontalmente
        const lojasUnicas = Array.from(new Set(lotesDoVinculo.map(l => l.loja))).sort();
        lojasUnicas.forEach((loja, lIdx) => {
          if (lIdx > 37) return; // D até AO
          setCell(sheet, r, 3 + lIdx, loja);
        });
      });

      // 5. Geração do arquivo e disparo do download
      const wbout = XLSX.write(workbook, {
        bookType: "xlsx",
        type: "array"
      });

      const blob = new Blob([wbout], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      });

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      
      const now = new Date();
      const day = String(now.getDate()).padStart(2, '0');
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const year = String(now.getFullYear()).slice(-2);
      const dateStr = `${day}.${month}.${year}`;
      
      a.download = `Pedido_${pedido.marca || "SEM_NOME"}_${dateStr}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      console.log("Exportação concluída com sucesso.");
    } catch (error) {
      console.error("Falha na exportação:", error);
      alert(error instanceof Error ? error.message : "Erro desconhecido ao gerar Excel.");
    }
  };

  const salvarPedidoCompleto = async () => {
    if (lotesFinalizados.length === 0) {
      alert("Não há dados para salvar. Adicione itens e distribua nas lojas primeiro.");
      return;
    }

    try {
      console.log("Iniciando salvamento no Supabase...");
      
      // 1. Salvar Pedido_Header
      const { data: headerData, error: headerError } = await supabase
        .from('Pedido_Header')
        .insert([{
          marca: pedido.marca,
          fornecedor: pedido.fornecedor,
          representante: pedido.representante,
          telefone: pedido.telefone,
          email: pedido.email,
          comprador: pedido.comprador,
          embarque_inicio: pedido.embarqueInicio,
          embarque_fim: pedido.embarqueFim,
          desconto: pedido.desconto,
          markup: pedido.markup,
          prazo: pedido.prazos,
          user_id: user?.id
        }])
        .select()
        .single();

      if (headerError) throw headerError;
      const headerId = headerData.id;

      // 2. Agrupar itens únicos para salvar em Pedido_Items
      // Usamos uma chave composta para identificar itens únicos no pedido
      const itensMap = new Map();
      lotesFinalizados.forEach(l => {
        const key = `${l.referencia}-${l.corEscolhida}`;
        if (!itensMap.has(key)) {
          itensMap.set(key, {
            header_id: headerId,
            referencia: l.referencia,
            tipo: l.tipo,
            cor_escolhida: l.corEscolhida,
            modelo: l.modelo,
            valor_compra: l.valorCompra,
            preco_venda: l.precoVenda,
            original_lotes: [] // Para vincular a distribuição depois
          });
        }
        itensMap.get(key).original_lotes.push(l);
      });

      // Salvar itens um por um para pegar os IDs gerados (ou usar insert().select())
      const itensParaInserir = Array.from(itensMap.values()).map(({ original_lotes, ...rest }) => rest);
      const { data: savedItems, error: itemsError } = await supabase
        .from('Pedido_Items')
        .insert(itensParaInserir)
        .select();

      if (itemsError) throw itemsError;

      // 3. Salvar Pedido_Distribuicao
      const distribuicaoParaInserir: any[] = [];
      
      savedItems.forEach(savedItem => {
        const key = `${savedItem.referencia}-${savedItem.cor_escolhida}`;
        const itemData = itensMap.get(key);
        
        itemData.original_lotes.forEach((l: any) => {
          distribuicaoParaInserir.push({
            item_id: savedItem.id,
            loja: l.loja,
            grade_letra: l.gradeLetra,
            id_vinculo: l.idVinculo
          });
        });
      });

      const { error: distError } = await supabase
        .from('Pedido_Distribuicao')
        .insert(distribuicaoParaInserir);

      if (distError) throw distError;

      alert("Pedido salvo com sucesso no banco de dados!");
    } catch (error: any) {
      console.error("Erro ao salvar pedido:", error);
      alert(`Erro ao salvar: ${error.message || "Erro desconhecido"}`);
    }
  };

  const lotesAgrupados = useMemo(() => {
    const res: Record<string, { grade: string, items: Set<string>, lojas: Set<string>, valBruto: number, valLiquido: number, pares: number }> = {};
    lotesFinalizados.forEach(l => {
      if (!res[l.idVinculo]) res[l.idVinculo] = { grade: l.gradeLetra, items: new Set(), lojas: new Set(), valBruto: 0, valLiquido: 0, pares: 0 };
      res[l.idVinculo].items.add(l.referencia);
      res[l.idVinculo].lojas.add(l.loja);
      const g = gradesSalvas.find(x => x.letra === l.gradeLetra);
      const paresLote = g?.total || 0;
      const bruto = paresLote * (l.valorCompra || 0);
      const liquido = bruto * (1 - (pedido.desconto / 100));
      
      res[l.idVinculo].pares += paresLote;
      res[l.idVinculo].valBruto += bruto;
      res[l.idVinculo].valLiquido += liquido;
    });
    return Object.values(res);
  }, [lotesFinalizados, gradesSalvas, pedido.desconto]);

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-[100] font-sans">
      <div className="bg-[#F8FAFC] w-full max-w-5xl h-[90vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-white">
        
        {/* HEADER - CLEAN & MINIMALIST */}
        <div className="px-6 py-4 flex justify-between items-center bg-white border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg"><ShoppingBag size={20} /></div>
            <div>
              <h1 className="text-lg font-black text-slate-900 uppercase tracking-tight italic leading-none">Cadastro Pedido <span className="text-blue-600">Real</span></h1>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">Gestão Logística Integrada</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-full transition-all"><X size={20} /></button>
        </div>

        {/* STEPPER - TIGHTER */}
        <div className={`flex bg-white px-4 py-2 gap-1 border-b border-slate-100 shrink-0 ${isMobile ? 'flex-col' : 'flex-row overflow-x-auto no-scrollbar'}`}>
          {[1, 2, 3, 4].map(n => {
            const label = n === 1 ? 'Pedido' : n === 2 ? 'Produtos' : n === 3 ? 'Grades' : 'Lojas';
            return (
              <button 
                key={n} 
                onClick={() => setEtapa(n)} 
                className={`flex-1 py-2 rounded-xl transition-all border-b-2 flex flex-col items-center justify-center gap-1 ${etapa === n ? 'bg-blue-50 text-blue-700 border-blue-600' : 'text-slate-400 border-transparent hover:bg-slate-50'}`}
              >
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black transition-all ${etapa === n ? 'bg-blue-600 text-white shadow-md' : 'bg-slate-100 text-slate-400'}`}>
                  {n}
                </div>
                <span className="text-[9px] font-bold uppercase leading-none">{label}</span>
              </button>
            );
          })}
        </div>

        <div className="flex-1 overflow-y-auto p-6 no-scrollbar">
          {etapa === 1 && (
            <div className="max-w-2xl mx-auto space-y-4 animate-in fade-in zoom-in duration-300">
              <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 grid grid-cols-2 gap-4">
                <div className="col-span-2 md:col-span-1 space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase ml-2">Marca</label>
                  <input 
                    list="brands"
                    className="w-full p-3 bg-slate-50 rounded-xl font-bold uppercase outline-none focus:ring-2 focus:ring-blue-100 min-h-[44px]" 
                    value={pedido.marca} 
                    onChange={e => setPedido({...pedido, marca: e.target.value.toUpperCase()})} 
                    onBlur={e => upsertValue('Pedido_Brand', e.target.value)}
                    placeholder="EX: BEBECE" 
                  />
                  <datalist id="brands">{dbSuggestions.marcas.map(m => <option key={m} value={m} />)}</datalist>
                </div>
                <div className="col-span-2 md:col-span-1 space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase ml-2">Razão Social</label>
                  <input 
                    list="suppliers"
                    className="w-full p-3 bg-slate-50 rounded-xl font-bold uppercase outline-none min-h-[44px]" 
                    value={pedido.fornecedor} 
                    onChange={e => setPedido({...pedido, fornecedor: e.target.value.toUpperCase()})} 
                    onBlur={e => upsertValue('Pedido_Suppliers', e.target.value)}
                    placeholder="EX: CALCADOS BEBECE LTDA" 
                  />
                  <datalist id="suppliers">{dbSuggestions.fornecedores.map(s => <option key={s} value={s} />)}</datalist>
                </div>
                <div className="col-span-2 md:col-span-1 space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase ml-2">Representante</label>
                  <input 
                    className="w-full p-3 bg-slate-50 rounded-xl font-bold uppercase outline-none min-h-[44px]" 
                    value={pedido.representante} 
                    onChange={e => setPedido({...pedido, representante: e.target.value.toUpperCase()})} 
                    placeholder="NOME DO REPRESENTANTE" 
                  />
                </div>
                <div className="col-span-2 md:col-span-1 space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase ml-2">Telefone</label>
                  <input 
                    className="w-full p-3 bg-slate-50 rounded-xl font-bold outline-none min-h-[44px]" 
                    value={pedido.telefone} 
                    onChange={e => setPedido({...pedido, telefone: formatPhone(e.target.value)})} 
                    placeholder="(00) 00000-0000" 
                  />
                </div>
                <div className="col-span-2 md:col-span-1 space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase ml-2">Email</label>
                  <input 
                    className="w-full p-3 bg-slate-50 rounded-xl font-bold outline-none min-h-[44px]" 
                    value={pedido.email} 
                    onChange={e => setPedido({...pedido, email: e.target.value.toLowerCase()})} 
                    placeholder="EMAIL@EXEMPLO.COM" 
                  />
                </div>
                <div className="col-span-2 md:col-span-1 space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase ml-2">Comprador</label>
                  <input 
                    className="w-full p-3 bg-slate-50 rounded-xl font-bold uppercase outline-none min-h-[44px] opacity-70" 
                    value={pedido.comprador} 
                    readOnly
                  />
                </div>
                <div className="col-span-2 sm:col-span-1 space-y-1">
                  <label className="text-[9px] font-black text-orange-500 uppercase ml-2 flex items-center gap-1"><Calendar size={10}/> Embarque Início</label>
                  <input type="date" className="w-full p-3 bg-orange-50/50 rounded-xl font-bold outline-none min-h-[44px]" value={pedido.embarqueInicio} onChange={e => setPedido({...pedido, embarqueInicio: e.target.value})} />
                </div>
                <div className="col-span-2 sm:col-span-1 space-y-1">
                  <label className="text-[9px] font-black text-orange-500 uppercase ml-2 flex items-center gap-1"><Calendar size={10}/> Embarque Fim</label>
                  <input type="date" className="w-full p-3 bg-orange-50/50 rounded-xl font-bold outline-none min-h-[44px]" value={pedido.embarqueFim} onChange={e => setPedido({...pedido, embarqueFim: e.target.value})} />
                </div>
                <div className="col-span-2 sm:col-span-1 space-y-1">
                  <label className="text-[9px] font-black text-blue-500 uppercase ml-2 flex items-center gap-1"><Zap size={10}/> Markup</label>
                  <input type="number" step="0.1" className="w-full p-3 bg-blue-50/50 rounded-xl font-black text-center text-blue-900 outline-none min-h-[44px]" value={pedido.markup || ""} onChange={e => setPedido({...pedido, markup: Number(e.target.value)})} />
                </div>
                <div className="col-span-2 sm:col-span-1 space-y-1">
                  <label className="text-[9px] font-black text-red-500 uppercase ml-2 flex items-center gap-1"><Percent size={10}/> Desconto %</label>
                  <input type="number" className="w-full p-3 bg-red-50/50 rounded-xl font-black text-center text-red-900 outline-none min-h-[44px]" value={pedido.desconto || ""} onChange={e => setPedido({...pedido, desconto: Number(e.target.value)})} />
                </div>
                <div className="col-span-2 space-y-2 pt-2 border-t border-slate-50">
                  <label className="text-[9px] font-black text-slate-400 uppercase ml-2 flex items-center gap-1"><CreditCard size={10}/> Prazos de Pagamento</label>
                  <div className="flex flex-wrap gap-2">
                    {["30/60/90", "60/90/120", "90/120/150", "120/150/180"].map(p => (
                      <button 
                        key={p} 
                        onClick={() => setPedido({...pedido, prazos: p})}
                        className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all border ${pedido.prazos === p ? 'bg-blue-600 border-blue-700 text-white shadow-md' : 'bg-slate-50 border-slate-200 text-slate-400 hover:bg-slate-100'}`}
                      >
                        {p}
                      </button>
                    ))}
                    <input 
                      className={`flex-1 min-w-[120px] p-2 bg-slate-50 border rounded-xl text-[10px] font-black uppercase outline-none transition-all ${pedido.prazos && !["30/60/90", "60/90/120", "90/120/150", "120/150/180"].includes(pedido.prazos) ? 'border-blue-400 ring-2 ring-blue-50' : 'border-slate-200'}`}
                      placeholder="OUTRO PRAZO..."
                      value={["30/60/90", "60/90/120", "90/120/150", "120/150/180"].includes(pedido.prazos) ? "" : pedido.prazos}
                      onChange={e => setPedido({...pedido, prazos: e.target.value.toUpperCase()})}
                    />
                  </div>
                  
                  {pedido.embarqueFim && pedido.prazos && (
                    <div className="bg-blue-50/50 p-3 rounded-2xl border border-blue-100/50 flex items-center gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
                      <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center text-blue-600 shadow-sm"><Calendar size={14}/></div>
                      <div>
                        <p className="text-[8px] font-black text-blue-400 uppercase tracking-widest">Vencimentos Estimados</p>
                        <p className="text-[11px] font-black text-blue-700 italic">
                          Vencimentos: {(() => {
                            const date = new Date(pedido.embarqueFim + "T12:00:00");
                            const meses = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
                            return pedido.prazos.split('/').map(p => {
                              const val = parseInt(p);
                              if (isNaN(val)) return "?";
                              const d = new Date(date);
                              if (val % 30 === 0) {
                                d.setMonth(d.getMonth() + (val / 30));
                              } else {
                                d.setDate(d.getDate() + val);
                              }
                              return meses[d.getMonth()];
                            }).join(' / ');
                          })()}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {etapa === 2 && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full animate-in slide-in-from-right duration-300">
              <div className="lg:col-span-7 bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col gap-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase ml-2">Referência</label>
                    <input 
                      list="refs"
                      className="w-full p-3 bg-slate-50 rounded-xl font-black text-lg outline-none uppercase min-h-[44px]" 
                      value={itemAtual.referencia} 
                      onChange={e => setItemAtual({...itemAtual, referencia: e.target.value.toUpperCase()})} 
                      placeholder="REF" 
                    />
                    <datalist id="refs">{dbSuggestions.referencias.map(r => <option key={r} value={r} />)}</datalist>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase ml-2">Público</label>
                    <select className="w-full p-3 bg-slate-50 rounded-xl font-bold uppercase text-[10px] outline-none min-h-[44px]" value={itemAtual.modelo} onChange={e => setItemAtual({...itemAtual, modelo: e.target.value as any})}><option value="Fem">Feminino</option><option value="Masc">Masculino</option><option value="Inf">Infantil</option><option value="Acess">Acessório</option></select>
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase ml-2">Tipo de Produto</label>
                  <input list="types" className="w-full p-3 bg-slate-50 rounded-xl font-bold uppercase text-[10px] outline-none min-h-[44px]" value={itemAtual.tipo} onChange={e => setItemAtual({...itemAtual, tipo: e.target.value.toUpperCase()})} placeholder="EX: SANDALIA, TENIS" />
                  <datalist id="types">{dbSuggestions.tipos.map(t => <option key={t} value={t} />)}</datalist>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {['cor1','cor2','cor3'].map(c => (
                    <div key={c} className="space-y-1">
                      <input 
                        list="colors"
                        className="w-full p-2.5 bg-slate-50 rounded-xl text-[9px] font-bold uppercase outline-none border border-transparent focus:border-blue-200 min-h-[44px]" 
                        placeholder={c.toUpperCase()} 
                        value={itemAtual[c as keyof typeof itemAtual] as string} 
                        onChange={e => setItemAtual({...itemAtual, [c]: e.target.value.toUpperCase()})} 
                      />
                      <datalist id="colors">{dbSuggestions.cores.map(co => <option key={co} value={co} />)}</datalist>
                    </div>
                  ))}
                </div>
                <div className="bg-slate-900 p-6 rounded-3xl text-white flex justify-between items-center shadow-lg border-b-4 border-blue-600">
                  <div><p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Custo Fábrica</p><div className="flex items-center font-black text-xl"><span className="text-blue-500 mr-1">R$</span><input type="number" className="bg-transparent w-20 outline-none min-h-[44px] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" value={itemAtual.valorCompra || ""} onChange={e => setItemAtual({...itemAtual, valorCompra: Number(e.target.value)})} /></div></div>
                  <div className="text-right border-l border-white/10 pl-6"><p className="text-[8px] font-black text-blue-400 uppercase mb-1">Valor de Venda</p><p className="text-3xl font-black text-yellow-400 italic leading-none">R$ {itemAtual.precoVenda.toFixed(2)}</p></div>
                </div>
                <button onClick={async () => { 
                  if(!itemAtual.referencia || !itemAtual.valorCompra) return; 
                  
                  // Upsert automático ao adicionar
                  await Promise.all([
                    upsertValue('Pedido_References', itemAtual.referencia),
                    upsertTipo(itemAtual.tipo),
                    upsertValue('Pedido_Colors', itemAtual.cor1),
                    itemAtual.cor2 && upsertValue('Pedido_Colors', itemAtual.cor2),
                    itemAtual.cor3 && upsertValue('Pedido_Colors', itemAtual.cor3)
                  ]);

                  setItens([...itens, {...itemAtual, id: crypto.randomUUID()}]); 
                  setItemAtual({...itemAtual, referencia: "", valorCompra: 0, cor1: "", cor2: "", cor3: ""}); 
                }} className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black text-[10px] uppercase shadow-md hover:bg-blue-700 transition-all min-h-[44px]">+ ADICIONAR ITEM</button>
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
            <div className="max-w-3xl mx-auto space-y-6 animate-in zoom-in duration-300 text-center">
              <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                <h3 className="text-sm font-black text-slate-800 uppercase italic mb-6">Grades Predefinidas</h3>
                <div className="flex flex-wrap justify-center gap-2 mb-8">
                  {(GRADES_PREDEFINIDAS[itemAtual.modelo] || []).map((p, i) => (
                    <button 
                      key={i}
                      onClick={() => {
                        const total = Object.values(p.valores).reduce((a: number, b) => a + Number(b), 0);
                        const classificacao = getClassificacao(itemAtual.modelo, p.valores);
                        setGradesSalvas([...gradesSalvas, { 
                          letra: LETRAS[gradesSalvas.length], 
                          modelo: itemAtual.modelo, 
                          valores: {...p.valores}, 
                          total,
                          classificacao
                        }]);
                      }}
                      className="px-4 py-2 bg-blue-50 text-blue-700 border border-blue-100 rounded-xl text-[10px] font-black uppercase hover:bg-blue-600 hover:text-white transition-all shadow-sm"
                    >
                      {p.label}
                    </button>
                  ))}
                  <button 
                    onClick={() => setShowGradeModal(true)}
                    className="px-4 py-2 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase hover:bg-blue-600 transition-all shadow-md flex items-center gap-2"
                  >
                    <Plus size={14} /> Incluir Nova Grade
                  </button>
                </div>

                <div className="flex flex-col gap-3">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-left px-2">Grades Salvas</h4>
                  <div className="flex flex-wrap gap-3 no-scrollbar">
                    {gradesSalvas.map((g, idx) => (
                      <div key={idx} className="bg-white p-3 rounded-2xl border border-blue-100 shadow-sm flex flex-col gap-2 min-w-[200px] shrink-0 text-left relative group">
                        <button 
                          onClick={() => {
                            const newGrades = gradesSalvas.filter((_, i) => i !== idx).map((gr, i) => ({
                              ...gr,
                              letra: LETRAS[i]
                            }));
                            setGradesSalvas(newGrades);
                          }}
                          className="absolute -top-2 -right-2 w-6 h-6 bg-red-100 text-red-600 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                        >
                          <Trash2 size={12} />
                        </button>
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center text-white text-[10px] font-black shadow-sm">
                            {g.letra}
                          </div>
                          <span className="text-[10px] font-black text-blue-900 uppercase tracking-tight">
                            Grade {g.letra} {g.classificacao && `- ${g.classificacao}`}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {Object.entries(g.valores)
                            .filter(([_, v]) => Number(v) > 0)
                            .map(([tam, qtd]) => (
                              <div key={tam} className="flex items-center border border-blue-50 rounded-lg overflow-hidden bg-white shadow-sm">
                                <span className="bg-blue-50 px-1.5 py-0.5 text-[9px] font-black text-blue-700 border-r border-blue-50">{tam}</span>
                                <span className="px-1.5 py-0.5 text-[9px] font-black text-slate-900">{qtd}</span>
                              </div>
                            ))}
                        </div>
                      </div>
                    ))}
                    {gradesSalvas.length === 0 && (
                      <div className="w-full py-8 border-2 border-dashed border-slate-100 rounded-2xl flex flex-col items-center justify-center opacity-30">
                        <Layers size={24} />
                        <p className="text-[9px] font-black uppercase mt-2">Nenhuma grade definida</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* MODAL INCLUIR NOVA GRADE */}
              {showGradeModal && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[200] animate-in fade-in duration-200">
                  <div className="bg-white w-full max-w-md rounded-[32px] shadow-2xl p-6 flex flex-col gap-6 animate-in zoom-in duration-300">
                    <div className="flex justify-between items-center">
                      <h3 className="text-sm font-black text-slate-800 uppercase italic">Nova Grade <span className="text-blue-600">{LETRAS[gradesSalvas.length]}</span></h3>
                      <button onClick={() => setShowGradeModal(false)} className="p-2 text-slate-300 hover:text-red-500 transition-colors"><X size={20} /></button>
                    </div>

                    <div className="bg-blue-50/50 p-4 rounded-2xl flex justify-between items-center">
                      <span className="text-[10px] font-black text-blue-900 uppercase">Total de Pares</span>
                      <span className="bg-blue-600 text-white px-3 py-1 rounded-full font-black text-xs shadow-md">
                        {Object.values(gradeEditando).reduce((a: number, b) => a + Number(b), 0)}
                      </span>
                    </div>

                    <div className={`grid gap-2 max-h-[40vh] overflow-y-auto no-scrollbar p-1 ${itemAtual.modelo === "Inf" ? 'grid-cols-4' : 'grid-cols-3'}`}>
                      {(TAMANHOS[itemAtual.modelo] || []).map(tam => (
                        <div key={tam} className="bg-slate-50 rounded-2xl border border-slate-100 p-2 flex flex-col items-center gap-2">
                          <span className="text-[9px] font-black text-slate-400 uppercase">{tam}</span>
                          <div className="flex flex-col items-center gap-1.5 w-full">
                            <button 
                              onClick={() => setGradeEditando({...gradeEditando, [tam]: (gradeEditando[tam] || 0) + 1})}
                              className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white shadow-sm active:scale-90 transition-all text-xl font-bold"
                            >
                              +
                            </button>
                            <div className="w-full py-1 bg-white border border-slate-200 rounded-md flex items-center justify-center">
                              <span className="font-black text-xs text-slate-900">
                                {gradeEditando[tam] || 0}
                              </span>
                            </div>
                            <button 
                              onClick={() => setGradeEditando({...gradeEditando, [tam]: Math.max(0, (gradeEditando[tam] || 0) - 1)})}
                              className="w-8 h-8 bg-red-500 rounded-lg flex items-center justify-center text-white shadow-sm active:scale-90 transition-all text-xl font-bold"
                            >
                              -
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    <button 
                      onClick={() => { 
                        const total = Object.values(gradeEditando).reduce((a: number, b) => a + Number(b), 0);
                        if(total === 0) return;
                        const classificacao = getClassificacao(itemAtual.modelo, gradeEditando);
                        setGradesSalvas([...gradesSalvas, { 
                          letra: LETRAS[gradesSalvas.length], 
                          modelo: itemAtual.modelo, 
                          valores: {...gradeEditando}, 
                          total,
                          classificacao
                        }]); 
                        setGradeEditando({});
                        setShowGradeModal(false);
                      }} 
                      className="w-full py-4 bg-slate-950 text-white rounded-2xl font-black uppercase text-[10px] shadow-xl border-b-4 border-slate-800 hover:bg-blue-600 transition-all"
                    >
                      SALVAR GRADE {LETRAS[gradesSalvas.length]}
                    </button>
                  </div>
                </div>
              )}
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
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3 pt-3 border-t border-blue-100">
                              <select value={assignment.gradeLetra} onChange={e => setPersistAssignments({...persistAssignments, [it.referencia]: {...assignment, gradeLetra: e.target.value}})} className="p-1.5 bg-white border border-blue-200 rounded-lg text-[9px] font-black text-blue-700 outline-none min-h-[44px]">
                                <option value="">GRADE?</option>
                                {gradesSalvas.map(gr => <option key={gr.letra} value={gr.letra}>GRADE {gr.letra}</option>)}
                              </select>
                              <select value={assignment.corSelecionada} onChange={e => setPersistAssignments({...persistAssignments, [it.referencia]: {...assignment, corSelecionada: e.target.value}})} className="p-1.5 bg-white border border-blue-200 rounded-lg text-[9px] font-black text-blue-700 uppercase outline-none min-h-[44px]">
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
                  }} className="w-full py-4 bg-slate-950 text-white rounded-2xl font-black uppercase text-[10px] shadow-xl border-b-4 border-slate-800 hover:bg-blue-600 transition-all flex items-center justify-center gap-2 min-h-[44px]"><Layers size={14}/> GERAR CARGA DE LOTES</button>
               </div>
            </div>
          )}
        </div>

        {/* FOOTER - MINIMALIST */}
        <div className="px-6 py-4 bg-white border-t border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4 shrink-0">
          <button onClick={() => setVerLotes(!verLotes)} className={`w-full md:w-auto px-6 py-2.5 rounded-xl font-black text-[9px] uppercase transition-all flex items-center justify-center gap-2 border min-h-[44px] ${verLotes ? 'bg-blue-600 text-white border-blue-700 shadow-md' : 'bg-slate-50 text-blue-700 border-slate-200'}`}>
            <ListFilter size={16}/> Lotes Ativos ({lotesAgrupados.length})
          </button>
          <div className="flex gap-2 w-full md:w-auto">
            <button onClick={salvarPedidoCompleto} className="flex-1 md:flex-none bg-slate-900 text-white px-6 py-3 rounded-xl font-black text-[9px] uppercase shadow-lg hover:bg-slate-800 transition-all border-b-4 border-slate-700 active:scale-95 flex items-center justify-center gap-2 min-h-[44px]">
              <Layers size={18}/> 💾 Salvar Pedido
            </button>
            <button onClick={exportarPlanilhaFinal} className="flex-1 md:flex-none bg-red-600 text-white px-8 py-3 rounded-xl font-black text-[9px] uppercase shadow-lg hover:bg-red-700 transition-all border-b-4 border-red-900 active:scale-95 flex items-center justify-center gap-2 min-h-[44px]">
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
                      <div className="flex items-center gap-3">
                        <button onClick={() => setLotesFinalizados([])} className="text-red-500 text-[9px] font-black uppercase border border-red-100 px-3 py-1.5 rounded-lg hover:bg-red-50 transition-all">Limpar Carga</button>
                        <button onClick={() => setVerLotes(false)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-all">
                          <X size={18} />
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {lotesAgrupados.map((l, i) => {
                            const gradeInfo = gradesSalvas.find(g => g.letra === l.grade);
                            const classificacao = gradeInfo ? getClassificacao(gradeInfo.modelo, gradeInfo.valores) : "";
                            const descClassificacao = classificacao ? ` - ${classificacao}` : "";
                            
                            return (
                                <div key={i} className="bg-slate-50 p-4 rounded-2xl border border-slate-100 relative group flex flex-col gap-3">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center font-black text-lg text-blue-600 shadow-sm border border-blue-50">{l.grade}</div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[10px] font-black text-slate-800 uppercase leading-none truncate">Grade {l.grade}{descClassificacao}</p>
                                            <p className="text-[8px] font-bold text-slate-400 uppercase mt-1">Lojas {Array.from(l.lojas).sort().join('-')}</p>
                                        </div>
                                    </div>

                                    {gradeInfo && (
                                        <div className="flex flex-wrap gap-1 py-2 border-y border-slate-200/50">
                                            {Object.entries(gradeInfo.valores)
                                                .filter(([_, v]) => Number(v) > 0)
                                                .map(([tam, qtd]) => (
                                                    <div key={tam} className="flex items-center border border-blue-100 rounded-md overflow-hidden bg-white shadow-xs">
                                                        <span className="bg-blue-50 px-1 py-0.5 text-[8px] font-black text-blue-700 border-r border-blue-50">{tam}</span>
                                                        <span className="px-1 py-0.5 text-[8px] font-black text-slate-900">{qtd}</span>
                                                    </div>
                                                ))}
                                        </div>
                                    )}

                                    <div className="flex justify-between items-end mt-auto">
                                        <div><p className="text-[7px] text-gray-400 font-black uppercase">Pares</p><p className="text-lg font-black text-slate-900 leading-none italic">{l.pares}</p></div>
                                        <div className="text-right">
                                            <p className="text-[7px] text-gray-400 font-black uppercase">Bruto</p>
                                            <p className={`font-black italic leading-none ${pedido.desconto > 0 ? 'text-slate-400 text-xs line-through' : 'text-slate-900 text-base'}`}>{formatCurrency(l.valBruto)}</p>
                                            {pedido.desconto > 0 && (
                                                <>
                                                    <p className="text-[7px] text-blue-500 font-black uppercase mt-1">Líquido (-{pedido.desconto}%)</p>
                                                    <p className="text-base font-black text-green-600 leading-none italic">{formatCurrency(l.valLiquido)}</p>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
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