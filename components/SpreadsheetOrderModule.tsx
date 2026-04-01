import React, { useState, useEffect, useMemo } from "react";
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
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

const calcularColunaExcelPorTamanho = (tam: string) => {
  const t = parseInt(tam);
  if (!isNaN(t)) {
    // I=8 (16), J=9 (17)...
    return 8 + (t - 16);
  }
  const acessMap: Record<string, number> = { 
    "UN": 3, "P": 4, "M": 5, "G": 6, "GG": 7 
  };
  return acessMap[tam] || -1;
};

const SpreadsheetOrderModule = ({ user, onClose }: { user: any, onClose: () => void }) => {
  const [etapa, setEtapa] = useState(1);
  const [verLotes, setVerLotes] = useState(false);
  const [pedidoExpandido, setPedidoExpandido] = useState<string | null>(null);
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
    numero_pedido: "",
    marca: "", 
    fornecedor: "", 
    representante: "",
    telefone: "",
    email: "",
    comprador: user?.name || "",
    embarqueInicio: "", 
    embarqueFim: "", 
    desconto: 0, 
    markup: 2.6, 
    prazos: "" 
  });

  const [itens, setItens] = useState<any[]>([]);
  const [itemAtual, setItemAtual] = useState({
    referencia: "",
    tipo: "",
    modelo: "Fem",
    cor1: "",
    cor2: "",
    cor3: "",
    valorCompra: 0,
    precoVenda: 0,
    color1_id: null,
    color2_id: null,
    color3_id: null,
    type_id: null,
    reference_id: null
  });
  const [isSaving, setIsSaving] = useState(false);
  const [dbSuggestions, setDbSuggestions] = useState({
    marcas: [] as string[],
    fornecedores: [] as string[],
    tipos: [] as string[],
    cores: [] as string[],
    referencias: [] as string[]
  });

  const formatPhone = (v: string) => {
    if (!v) return "";
    v = v.replace(/\D/g, "");
    if (v.length > 11) v = v.slice(0, 11);
    if (v.length > 10) {
      return `(${v.slice(0, 2)}) ${v.slice(2, 7)}-${v.slice(7)}`;
    } else if (v.length > 5) {
      return `(${v.slice(0, 2)}) ${v.slice(2, 6)}-${v.slice(6)}`;
    } else if (v.length > 2) {
      return `(${v.slice(0, 2)}) ${v.slice(2)}`;
    }
    return v;
  };

  const [localTemplate, setLocalTemplate] = useState<ArrayBuffer | null>(null);

  const handleTemplateUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const buffer = await file.arrayBuffer();
        // Validação obrigatória do header do arquivo (PK)
        const bytes = new Uint8Array(buffer.slice(0, 4));
        if (bytes[0] !== 0x50 || bytes[1] !== 0x4B) {
          alert("Arquivo inválido: selecione um arquivo Excel (.xlsx) válido.");
          return;
        }
        setLocalTemplate(buffer);
        alert("✅ Template carregado com sucesso! Agora o sistema usará este arquivo local para as exportações.");
      } catch (err) {
        console.error("Erro ao carregar template:", err);
        alert("Erro ao carregar arquivo local.");
      }
    }
  };

  // CORRIGIDO: Consolidado useEffect de auto-fill da marca priorizando Supabase com fallback para localStorage
  useEffect(() => {
    const autoFillBrand = async () => {
      if (!pedido.marca) return;
      try {
        // 1. Prioridade: Supabase (último pedido)
        const { data: lastOrder } = await supabase
          .from('Pedido_Header')
          .select('fornecedor, representante, telefone, email')
          .ilike('marca', pedido.marca)
          .order('created_at', { ascending: false })
          .limit(1);

        if (lastOrder && lastOrder.length > 0) {
          const last = lastOrder[0];
          setPedido(prev => ({
            ...prev,
            fornecedor: last.fornecedor || prev.fornecedor,
            representante: last.representante || prev.representante,
            telefone: last.telefone || prev.telefone,
            email: last.email || prev.email
          }));
          return;
        }

        // 2. Fallback: localStorage cache
        const savedBrands = localStorage.getItem("order_brands_cache");
        if (savedBrands) {
          const brandsMap = JSON.parse(savedBrands);
          const brandDetails = brandsMap[pedido.marca.toUpperCase()];
          if (brandDetails) {
            setPedido(prev => ({
              ...prev,
              fornecedor: prev.fornecedor || brandDetails.fornecedor || "",
              representante: prev.representante || brandDetails.representante || "",
              telefone: prev.telefone || brandDetails.telefone || "",
              email: prev.email || brandDetails.email || ""
            }));
          }
        }
      } catch (err) {
        console.error("Erro no auto-fill:", err);
      }
    };
    
    const timer = setTimeout(autoFillBrand, 600);
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
        marcas: [...new Set((brands.data || []).map(i => i.name))].sort((a, b) => a.localeCompare(b)),
        fornecedores: [...new Set((suppliers.data || []).map(i => i.name))].sort((a, b) => a.localeCompare(b)),
        tipos: [...new Set((types.data || []).map(i => i.name))].sort((a, b) => a.localeCompare(b)),
        cores: [...new Set((colors.data || []).map(i => i.name))].sort((a, b) => a.localeCompare(b)),
        referencias: [...new Set((refs.data || []).map(i => i.name))].sort((a, b) => a.localeCompare(b))
      });
    } catch (error) {
      console.error("Erro ao buscar sugestões:", error);
    }
  };

  // --- FUNÇÃO PARA RESOLVER ID (EVITA ERRO 409/500 E DUPLICIDADE) ---
  const resolveId = async (table: string, value: string, extraFilter = {}) => {
    if (!value) return null;
    const normalized = value.trim().toUpperCase();

    try {
      // 1. TENTA BUSCAR PRIMEIRO (Evita tentar inserir e dar erro 500)
      let query = supabase.from(table).select('id').eq('name', normalized);
      Object.entries(extraFilter).forEach(([key, val]) => {
        query = query.eq(key, val);
      });

      const { data: existing } = await query.maybeSingle();
      if (existing) return existing.id;

      // 2. SE NÃO EXISTIR, TENTA INSERIR (Com tratamento de erro de conflito)
      const payload = { name: normalized, ...extraFilter };
      const { data: inserted, error: insError } = await supabase
        .from(table)
        .upsert(payload, { onConflict: table === 'Pedido_Types' ? 'name,publico' : 'name' })
        .select('id')
        .maybeSingle();

      if (insError) {
        // Se der erro 409 ou 500 por duplicidade, busca de novo por segurança
        const { data: retry } = await query.maybeSingle();
        return retry?.id || null;
      }

      return inserted?.id || null;
    } catch (error) {
      console.error(`Erro crítico em ${table}:`, error);
      return null;
    }
  };

  // Resolve o erro 'upsertValue is not defined' no onBlur das linhas 773/785
  const upsertValue = async (table: string, value: string) => {
    if (!value) return;
    await resolveId(table, value);
    fetchSuggestions(); // Atualiza a lista de sugestões (datalist) imediatamente
  };

  const resolveColorId = async (colorName: string): Promise<string | null> => {
    return resolveId('Pedido_Colors', colorName);
  };

  const handleIncluirItem = async () => {
    if (!itemAtual.referencia || !itemAtual.cor1) {
      alert("Preencha ao menos Referência e Cor 1");
      return;
    }

    setIsSaving(true);
    try {
      // Resolve os IDs de forma segura
      const [refId, c1, c2, c3, typeId] = await Promise.all([
        resolveId('Pedido_References', itemAtual.referencia),
        resolveId('Pedido_Colors', itemAtual.cor1),
        itemAtual.cor2 ? resolveId('Pedido_Colors', itemAtual.cor2) : Promise.resolve(null),
        itemAtual.cor3 ? resolveId('Pedido_Colors', itemAtual.cor3) : Promise.resolve(null),
        resolveId('Pedido_Types', itemAtual.tipo, { publico: itemAtual.modelo })
      ]);

      const novoItem = {
        ...itemAtual,
        id: crypto.randomUUID(),
        reference_id: refId,
        color1_id: c1,
        color2_id: c2,
        color3_id: c3,
        type_id: typeId
      };

      setItens(prev => [...prev, novoItem]);
      
      // Limpa os campos para o próximo item
      setItemAtual(prev => ({
        ...prev, 
        referencia: "", 
        cor1: "", 
        cor2: "", 
        cor3: "", 
        valorCompra: 0,
        color1_id: null,
        color2_id: null,
        color3_id: null
      }));
      fetchSuggestions();
    } finally {
      setIsSaving(false);
    }
  };

  useEffect(() => {
    fetchSuggestions();
  }, [itemAtual.modelo]);

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

  const toExcelDate = (dateStr: string): Date | null => {
    if (!dateStr) return null;
    const parts = dateStr.split('-');
    if (parts.length !== 3) return null;
    return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
  };

  const setCell = (ws: any, addr: string, value: any) => {
    if (value === null || value === undefined) return;
    if (!ws[addr]) return;
    if (ws[addr].f) return;
    ws[addr].v = value;
    if (ws[addr].w) delete ws[addr].w;
  };

  const forcedSetCell = (ws: any, addr: string, value: any, isDate = false) => {
    if (value === null || value === undefined || value === "") return;
    if (ws[addr]?.f) return; // nunca sobrescreve fórmulas
    if (!ws[addr]) {
      ws[addr] = {};
    }
    if (isDate && value instanceof Date) {
      ws[addr].t = 'd';
      ws[addr].v = value;
      ws[addr].z = 'DD/MM/YYYY';
    } else if (typeof value === 'number') {
      ws[addr].t = 'n';
      ws[addr].v = value;
    } else {
      ws[addr].t = 's';
      ws[addr].v = String(value);
    }
    if (ws[addr].w) delete ws[addr].w;
  };

  const fetchTemplate = () => fetch("https://rwwomakjhmglgoowbmsl.supabase.co/storage/v1/object/public/template/Template.xlsx");

  useEffect(() => {
    const prefetch = async () => {
      if (!localTemplate) {
        try {
          const response = await fetchTemplate();
          const buffer = await response.arrayBuffer();
          const bytes = new Uint8Array(buffer.slice(0, 4));
          if (bytes[0] === 0x50 && bytes[1] === 0x4B) {
            setLocalTemplate(buffer);
          }
        } catch (err) {
          console.error("Erro no prefetch do template:", err);
        }
      }
    };
    prefetch();
  }, []);

  // CORRIGIDO: downloadWorkbook com try-catch e setTimeout para evitar erro de permissão
  const downloadWorkbook = async (wb: any, fileName: string) => {
    const XLSX = (await import('xlsx')).default;
    try {
      const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
      const blob = new Blob([wbout], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      // CORRIGIDO: Adicionado setTimeout de 1500ms antes do revokeObjectURL
      setTimeout(() => {
        window.URL.revokeObjectURL(url);
      }, 1500);
    } catch (err) {
      console.error("Erro ao baixar planilha:", err);
      alert("Erro ao realizar o download do arquivo Excel. Tente novamente.");
    }
  };

  const exportarPlanilhaFinal = async (hD?: any) => {
    if (lotesFinalizados.length === 0) {
      alert("Adicione itens e distribua nas lojas primeiro.");
      return;
    }

    try {
      const dataHeader = hD || pedido;
      const templateUrl = "https://rwwomakjhmglgoowbmsl.supabase.co/storage/v1/object/public/template/Template.xlsx";
      
      let arrayBuffer: ArrayBuffer;
      if (localTemplate) {
        arrayBuffer = localTemplate;
      } else {
        const response = await fetch(templateUrl);
        arrayBuffer = await response.arrayBuffer();
      }

      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(arrayBuffer);
      const worksheet = workbook.getWorksheet(1); // Pega a primeira aba (PEDIDO)

      if (!worksheet) {
        throw new Error("Aba 'PEDIDO' não encontrada no template.");
      }

      const comprador = dataHeader.comprador || pedido.comprador;
      const marca = dataHeader.marca || pedido.marca;
      const representante = dataHeader.representante || pedido.representante;
      const telefone = dataHeader.telefone || pedido.telefone;
      const fornecedor = dataHeader.fornecedor || pedido.fornecedor;
      const email = dataHeader.email || pedido.email;
      const embInicio = dataHeader.embarqueInicio || dataHeader.embarque_inicio || pedido.embarqueInicio;
      const embFim = dataHeader.embarqueFim || dataHeader.embarque_fim || pedido.embarqueFim;
      const prazos = dataHeader.prazos || pedido.prazos;
      const numPedido = dataHeader.numero_pedido || pedido.numero_pedido;

      // Helper to set value only if not a formula
      const safeSet = (addr: string, value: any) => {
        const cell = worksheet.getCell(addr);
        if (cell.formula) return;
        cell.value = value;
      };

      // Helper for vencimentos
      const getVencimentoTexto = (dataBase: string, prazoDias: number) => {
        if (!dataBase) return "";
        const date = new Date(dataBase + "T12:00:00");
        if (prazoDias % 30 === 0) {
          date.setMonth(date.getMonth() + (prazoDias / 30));
        } else {
          date.setDate(date.getDate() + prazoDias);
        }
        const meses = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
        return `${meses[date.getMonth()]}/${date.getFullYear().toString().slice(-2)}`;
      };

      // --- 1. CABEÇALHO ---
      if (numPedido) safeSet('N2', numPedido);
      if (marca) safeSet('N3', marca.toUpperCase());
      if (fornecedor) safeSet('N4', fornecedor.toUpperCase());
      if (comprador) safeSet('AA2', comprador.toUpperCase());
      if (representante) safeSet('AA3', representante.toUpperCase());
      if (telefone) safeSet('AN3', telefone);
      if (email) safeSet('AA4', email.toLowerCase());
      
      if (embInicio) {
        const d = toExcelDate(embInicio);
        if (d) {
          const cell = worksheet.getCell('AA5');
          cell.value = d;
          cell.numFmt = 'DD/MM/YYYY';
        }
      }
      if (embFim) {
        const d = toExcelDate(embFim);
        if (d) {
          const cell = worksheet.getCell('AH5');
          cell.value = d;
          cell.numFmt = 'DD/MM/YYYY';
        }
      }
      
      safeSet('Z6', (dataHeader.desconto || pedido.desconto || 0) / 100);
      safeSet('AF6', (dataHeader.markup || pedido.markup || 0));
      
      const todayCell = worksheet.getCell('AN2');
      todayCell.value = new Date();
      todayCell.numFmt = 'DD/MM/YYYY';
      
      safeSet('AN4', "CIF");

      // Prazos e Vencimentos
      if (prazos) {
        const pArray = prazos.split('/');
        const colPrazos = ['N', 'Q', 'T'];
        pArray.forEach((p: string, i: number) => {
          if (i > 2) return;
          const col = colPrazos[i];
          const dias = parseInt(p.trim());
          if (!isNaN(dias)) {
            safeSet(`${col}5`, dias);
            if (embFim) {
              safeSet(`${col}6`, getVencimentoTexto(embFim, dias));
            }
          }
        });
      }

      // --- 2. CONSTANTES FISCAIS ---
      safeSet('BF21', 49);         // IPI
      safeSet('BF22', 70);         // PIS
      safeSet('BF23', 70);         // COFINS
      safeSet('BF24', "000");      // ICMS
      safeSet('BF26', "UN");       // Unidade
      safeSet('BF27', "64042000"); // NCM
      safeSet('BF29', "2805900");  // CEST
      safeSet('BE37', "T");        // IPPT e FAIXA

      // --- 3. GRADES (LINHAS 14-18) ---
      const allPossibleSizes = ["UN","P","M","G","GG","15","16","17","18","19","20","21","22","23","24","25","26","27","28","29","30","31","32","33","34","35","36","37","38","39","40","41","42","43","44","45","46","47","48"];
      
      const lotesIds = Array.from(new Set(lotesFinalizados.map(l => l.idVinculo)));
      lotesIds.slice(0, 5).forEach((idV, idx) => {
        const rowNum = 14 + idx;
        const primeiroItemDoLote = lotesFinalizados.find(l => l.idVinculo === idV);
        if (primeiroItemDoLote) {
          safeSet(`B${rowNum}`, primeiroItemDoLote.gradeLetra);
          const gradeInfo = gradesSalvas.find(g => g.letra === primeiroItemDoLote.gradeLetra);
          if (gradeInfo) {
            Object.entries(gradeInfo.valores).forEach(([tam, qtd]) => {
              const sIdx = allPossibleSizes.indexOf(tam === "17/18" ? "18" : tam);
              if (sIdx !== -1 && (qtd as any) > 0) {
                // Column D is 4th column
                const colNum = 4 + sIdx;
                const cell = worksheet.getRow(rowNum).getCell(colNum);
                if (!cell.formula) cell.value = qtd as any;
              }
            });
          }
        }
      });

      // --- 4. LOJAS POR LOTE (LINHAS 23-27) ---
      lotesIds.slice(0, 5).forEach((idV, idx) => {
        const rowNum = 23 + idx;
        const lojasDoLote = [...new Set(lotesFinalizados.filter(l => l.idVinculo === idV).map(l => l.loja))];
        lojasDoLote.forEach((numLoja, lIdx) => {
          const colNum = 4 + lIdx;
          const cell = worksheet.getRow(rowNum).getCell(colNum);
          if (!cell.formula) cell.value = numLoja as any;
        });
      });

      // --- 5. ITENS (LINHA 36+) ---
      const itensUnicos = lotesFinalizados.reduce((acc: any[], curr) => {
        const exists = acc.find(it => it.referencia === curr.referencia && it.corEscolhida === curr.corEscolhida);
        if (!exists) acc.push(curr);
        return acc;
      }, []);

      itensUnicos.forEach((it, idx) => {
        if (!it) return;
        const rowNum = 36 + idx;
        if (rowNum > 166) return;

        const row = worksheet.getRow(rowNum);
        
        // B = Seq
        const cellB = row.getCell(2);
        if (!cellB.formula) cellB.value = idx + 1;

        // C = Referência
        const cellC = row.getCell(3);
        if (!cellC.formula) cellC.value = it.referencia.trim().toUpperCase();

        // H = Tipo
        const cellH = row.getCell(8);
        if (!cellH.formula) cellH.value = it.tipo.trim().toUpperCase();

        // R = Cor 1
        const cellR = row.getCell(18);
        if (!cellR.formula) cellR.value = (it.corEscolhida || it.cor1).trim().toUpperCase();

        // U = Modelo
        const cellU = row.getCell(21);
        if (!cellU.formula) cellU.value = it.modelo;

        // AL = Preço Custo
        const cellAL = row.getCell(38);
        if (!cellAL.formula) cellAL.value = it.valorCompra;

        // AO = Preço Venda
        const cellAO = row.getCell(41);
        if (!cellAO.formula) cellAO.value = it.precoVenda || it.valorVenda;

        // X, AA, AD, AG, AJ = Letra da Grade do Lote
        lotesIds.slice(0, 5).forEach((idV, lIdx) => {
          const loteItem = lotesFinalizados.find(l => l.idVinculo === idV && l.referencia === it.referencia && l.corEscolhida === it.corEscolhida);
          if (loteItem) {
            const colGradeNum = [24, 27, 30, 33, 36][lIdx]; // X, AA, AD, AG, AJ
            const cellGrade = row.getCell(colGradeNum);
            if (!cellGrade.formula) cellGrade.value = loteItem.gradeLetra;
          }
        });

        // Mapeamento das Grades por Loja (AT+)
        // As lojas começam na coluna 46 (AT)
        const lotesDesteItem = lotesFinalizados.filter(l => l.referencia === it.referencia && l.corEscolhida === it.corEscolhida);
        lotesDesteItem.forEach(l => {
          const lojaNum = parseInt(l.loja);
          if (!isNaN(lojaNum)) {
            const colDestino = 45 + lojaNum; 
            const cellLoja = row.getCell(colDestino);
            if (!cellLoja.formula) cellLoja.value = l.gradeLetra as any;
          }
        });

        row.commit();
      });

      if (marca) {
        const savedBrands = localStorage.getItem("order_brands_cache");
        const brandsMap = savedBrands ? JSON.parse(savedBrands) : {};
        brandsMap[marca.toUpperCase()] = {
          fornecedor: fornecedor,
          representante: representante,
          telefone: telefone,
          email: email
        };
        localStorage.setItem("order_brands_cache", JSON.stringify(brandsMap));
      }

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      saveAs(blob, `Pedido_Final_${(marca || "CONSOLIDADO")}_${new Date().getTime()}.xlsx`);

    } catch (err) {
      console.error("Erro na exportação ExcelJS:", err);
      alert("Erro ao gerar planilha: " + (err instanceof Error ? err.message : "Erro desconhecido"));
    }
  };

  // CORRIGIDO: exportarPedidosPorLoja refatorado para usar JSZip e evitar bloqueio de múltiplos downloads
  const exportarPedidosPorLoja = async () => {
    const XLSX = (await import('xlsx')).default;
    if (lotesFinalizados.length === 0) {
      alert("Nenhum lote encontrado.");
      return;
    }

    try {
      let templateBuffer: ArrayBuffer;

      if (localTemplate) {
        templateBuffer = localTemplate;
      } else {
        try {
          const response = await fetchTemplate();
          templateBuffer = await response.arrayBuffer();
        } catch (fetchErr: any) {
          console.error("Erro ao buscar template:", fetchErr);
          alert(`Erro ao baixar template: ${fetchErr.message}. Tente carregar o arquivo .xlsx manualmente.`);
          return;
        }
      }

      // Validação obrigatória do header do arquivo (PK)
      const bytes = new Uint8Array(templateBuffer.slice(0, 4));
      if (bytes[0] !== 0x50 || bytes[1] !== 0x4B) {
        throw new Error("Arquivo inválido: não é um Excel válido (PK não encontrada)");
      }

      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();
      const lojasUnicas = [...new Set(lotesFinalizados.map((l) => l.loja))].sort();

      // Helper for vencimentos
      const getVencimentoTexto = (dataBase: string, prazoDias: number) => {
        if (!dataBase) return "";
        const date = new Date(dataBase + "T12:00:00");
        if (prazoDias % 30 === 0) {
          date.setMonth(date.getMonth() + (prazoDias / 30));
        } else {
          date.setDate(date.getDate() + prazoDias);
        }
        const meses = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
        return `${meses[date.getMonth()]}/${date.getFullYear().toString().slice(-2)}`;
      };

      for (const loja of lojasUnicas as string[]) {
        const wb = XLSX.read(templateBuffer, {
          type: "array",
          cellStyles: true,
          cellNF: true,
          cellDates: true,
          cellText: false
        });
        
        const sheetName = wb.SheetNames.find(n => n.trim().toUpperCase() === "PEDIDO");

        if (!sheetName) continue;
        const ws = wb.Sheets[sheetName];

        // --- 1. CABEÇALHO (Aba PEDIDO) ---
        if (pedido.numero_pedido) forcedSetCell(ws, 'N2', pedido.numero_pedido);
        if (pedido.marca) forcedSetCell(ws, 'N3', pedido.marca.toUpperCase());
        if (pedido.fornecedor) forcedSetCell(ws, 'N4', pedido.fornecedor.toUpperCase());
        if (pedido.comprador) forcedSetCell(ws, 'AA2', pedido.comprador.toUpperCase());
        if (pedido.representante) forcedSetCell(ws, 'AA3', pedido.representante.toUpperCase());
        if (pedido.telefone) forcedSetCell(ws, 'AN3', pedido.telefone);
        if (pedido.email) forcedSetCell(ws, 'AA4', pedido.email.toLowerCase());
        
        forcedSetCell(ws, 'AN2', new Date(), true);
        forcedSetCell(ws, 'AN4', "CIF");

        if (pedido.embarqueInicio) {
          forcedSetCell(ws, 'AA5', toExcelDate(pedido.embarqueInicio), true);
        }

        if (pedido.embarqueFim) {
          forcedSetCell(ws, 'AH5', toExcelDate(pedido.embarqueFim), true);
        }

        forcedSetCell(ws, 'Z6', (pedido.desconto || 0) / 100);
        forcedSetCell(ws, 'AF6', (pedido.markup || 0));

        // Prazos e Vencimentos
        if (pedido.prazos) {
          const prazosArr = pedido.prazos.split('/');
          const colPrazos = ['N', 'Q', 'T'];
          prazosArr.forEach((p, i) => {
            if (i > 2) return;
            const val = parseInt(p.trim());
            if (!isNaN(val)) {
              const col = colPrazos[i];
              forcedSetCell(ws, `${col}5`, val);
              if (pedido.embarqueFim) {
                forcedSetCell(ws, `${col}6`, getVencimentoTexto(pedido.embarqueFim, val));
              }
            }
          });
        }

        // --- 2. CONSTANTES FISCAIS (Aba PEDIDO) ---
        forcedSetCell(ws, 'BF21', 49);
        forcedSetCell(ws, 'BF22', 70);
        forcedSetCell(ws, 'BF23', 70);
        forcedSetCell(ws, 'BF24', "000");
        forcedSetCell(ws, 'BF26', "UN");
        forcedSetCell(ws, 'BF27', "64042000");
        forcedSetCell(ws, 'BF29', "2805900");
        forcedSetCell(ws, 'BE37', "T");

        // --- 3. GRADES (LINHAS 14-18) ---
        const allPossibleSizes = ["UN","P","M","G","GG","15","16","17","18","19","20","21","22","23","24","25","26","27","28","29","30","31","32","33","34","35","36","37","38","39","40","41","42","43","44","45","46","47","48"];
        const colSizes = ["D","E","F","G","H","I","J","K","L","M","N","O","P","Q","R","S","T","U","V","W","X","Y","Z","AA","AB","AC","AD","AE","AF","AG","AH","AI","AJ","AK","AL","AM","AN","AO","AP","AQ"];
        
        const idsVinculosGrades = [...new Set(lotesFinalizados.map(l => l.idVinculo))].slice(0, 5);
        idsVinculosGrades.forEach((idV, idx) => {
          const row = 14 + idx;
          const l = lotesFinalizados.find(item => item.idVinculo === idV);
          if (l) {
            forcedSetCell(ws, `B${row}`, l.gradeLetra);
            const gradeInfo = gradesSalvas.find(g => g.letra === l.gradeLetra);
            if (gradeInfo) {
              Object.entries(gradeInfo.valores).forEach(([tam, qtd]) => {
                const sIdx = allPossibleSizes.indexOf(tam === "17/18" ? "18" : tam);
                if (sIdx !== -1 && (qtd as any) > 0) {
                  forcedSetCell(ws, `${colSizes[sIdx]}${row}`, qtd);
                }
              });
            }
          }
        });

        // --- 4. LOJAS POR LOTE (LINHAS 23-27) ---
        idsVinculosGrades.forEach((idV, idx) => {
          const row = 23 + idx;
          const lojasDoLote = [...new Set(lotesFinalizados.filter(l => l.idVinculo === idV).map(l => l.loja))];
          lojasDoLote.forEach((numLoja, lIdx) => {
            if (lIdx < colSizes.length) {
              const colLetter = colSizes[lIdx];
              forcedSetCell(ws, `${colLetter}${row}`, numLoja);
            }
          });
        });

        // --- 5. ITENS (LINHA 36+) ---
        const lotesDaLoja = lotesFinalizados.filter((l) => l.loja === loja);
        
        lotesDaLoja.forEach((l, idx) => {
          const r = 36 + idx;
          if (r > 166) return;

          forcedSetCell(ws, `B${r}`, idx + 1); // Número sequencial
          if (l.referencia) forcedSetCell(ws, `C${r}`, l.referencia.trim().toUpperCase());
          if (l.tipo) forcedSetCell(ws, `H${r}`, l.tipo.trim().toUpperCase());
          if (l.corEscolhida || l.cor1) forcedSetCell(ws, `R${r}`, (l.corEscolhida || l.cor1).trim().toUpperCase());
          if (l.modelo) forcedSetCell(ws, `U${r}`, l.modelo);
          if (l.valorCompra) forcedSetCell(ws, `AL${r}`, l.valorCompra);
          if (l.precoVenda) forcedSetCell(ws, `AO${r}`, l.precoVenda);

          const loteIndex = idsVinculosGrades.indexOf(l.idVinculo);
          if (loteIndex !== -1) {
            const colGrade = ['X', 'AA', 'AD', 'AG', 'AJ'][loteIndex];
            forcedSetCell(ws, `${colGrade}${r}`, l.gradeLetra);
          }

          // Mapeamento da Grade para esta Loja (AT+)
          const lojaNum = parseInt(loja as string);
          if (!isNaN(lojaNum)) {
            const colLetter = XLSX.utils.encode_col(45 + lojaNum);
            forcedSetCell(ws, `${colLetter}${r}`, l.gradeLetra);
          }
        });

        // --- 6. IDENTIFICAÇÃO DA LOJA ---
        forcedSetCell(ws, 'D25', loja);


        const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
        zip.file(`Pedido_Loja_${loja}_${(pedido.marca || "FINAL")}.xlsx`, wbout);
      }

      const zipContent = await zip.generateAsync({ type: "blob" });
      const url = window.URL.createObjectURL(zipContent);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Pedidos_Por_Loja_${pedido.marca || "FINAL"}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => window.URL.revokeObjectURL(url), 1500);

    } catch (err) {
      console.error("Erro ao exportar pedidos por loja:", err);
      alert(`Erro ao exportar pedidos por loja: ${err instanceof Error ? err.message : "Erro desconhecido"}`);
    }
  };

  const salvarPedidoCompleto = async () => {
    if (lotesFinalizados.length === 0) return alert("Não há dados para salvar.");
    setIsSaving(true);
    try {
      console.log("Iniciando salvamento seguro...");

      // PROCESSAMENTO SEGURO DE TIPOS E CORES (Um por um para não travar)
      for (const it of itens) {
        it.type_id = await resolveId('Pedido_Types', it.tipo, { publico: it.modelo });
        it.color1_id = await resolveId('Pedido_Colors', it.cor1);
        it.color2_id = it.cor2 ? await resolveId('Pedido_Colors', it.cor2) : null;
        it.color3_id = it.cor3 ? await resolveId('Pedido_Colors', it.cor3) : null;
        it.reference_id = await resolveId('Pedido_References', it.referencia);
      }

      // 1. Salvar Cabeçalho (Pedido_Header) - Onde entra o PEDIDO 8
      const { data: hD, error: hE } = await supabase.from('Pedido_Header').insert([{
        numero_pedido: pedido.numero_pedido || null,
        marca: pedido.marca.trim().toUpperCase(),
        fornecedor: pedido.fornecedor.trim().toUpperCase(),
        representante: pedido.representante.trim().toUpperCase(),
        telefone: pedido.telefone,
        email: pedido.email.trim().toLowerCase(),
        comprador: pedido.comprador.trim().toUpperCase(),
        desconto: pedido.desconto,
        markup: pedido.markup,
        // Correção de data vazia para NULL
        embarque_inicio: pedido.embarqueInicio || null,
        embarque_fim: pedido.embarqueFim || null,
        prazos: pedido.prazos,
        user_id: user?.id
      }]).select().single();

      if (hE) throw hE;

      // 2. Agrupar Itens por Referência e Cor (Pedido_Items)
      const itensMap = new Map();
      lotesFinalizados.forEach(l => {
        const key = `${l.referencia}-${l.color1_id}-${l.color2_id}-${l.color3_id}`; 
        if (!itensMap.has(key)) {
          itensMap.set(key, { 
            pedido_id: hD.id, 
            referencia: l.referencia, 
            tipo: l.tipo,
            modelo: l.modelo,
            color1_id: l.color1_id,
            color2_id: l.color2_id,
            color3_id: l.color3_id,
            valor_compra: l.valorCompra,
            preco_venda: l.precoVenda,
            lotes_originais: [] 
          });
        }
        itensMap.get(key).lotes_originais.push(l);
      });

      // 3. Salvar Itens
      const itemsToInsert = Array.from(itensMap.values()).map(({ lotes_originais, ...rest }) => ({
        pedido_id: rest.pedido_id,
        referencia: rest.referencia.trim().toUpperCase(),
        tipo: rest.tipo.trim().toUpperCase(),
        modelo: rest.modelo,
        color1_id: rest.color1_id,
        color2_id: rest.color2_id,
        color3_id: rest.color3_id,
        valor_compra: rest.valor_compra,
        preco_venda: rest.preco_venda
      }));

      const { data: sI, error: iE } = await supabase
        .from('Pedido_Items')
        .insert(itemsToInsert)
        .select();

      if (iE) throw iE;

      // 4. Salvar Distribuição (Pedido_Distribuicao)
      const distFinal = sI.flatMap((item, idx) => 
        Array.from(itensMap.values())[idx].lotes_originais.map((l: any) => ({
          item_id: item.id,
          loja: l.loja,
          grade_letra: l.gradeLetra
        }))
      );
      
      const { error: dE } = await supabase.from('Pedido_Distribuicao').insert(distFinal);
      if (dE) throw dE;

      return hD;
    } catch (error: any) {
      console.error("Erro ao salvar pedido:", error);
      alert("Erro ao salvar: " + (error.message || "Erro desconhecido"));
      return null;
    } finally {
      setIsSaving(false);
    }
  };

  useEffect(() => {
    const fetchNextOrderNumber = async () => {
      try {
        const { data, error } = await supabase
          .from('Pedido_Header')
          .select('numero_pedido')
          .order('numero_pedido', { ascending: false })
          .limit(1);
        
        if (error) throw error;

        let nextNumber = 10002;
        if (data && data.length > 0 && data[0].numero_pedido) {
          const lastNumber = parseInt(data[0].numero_pedido);
          if (!isNaN(lastNumber)) {
            nextNumber = Math.max(10002, lastNumber + 1);
          }
        }
        setPedido(prev => ({ ...prev, numero_pedido: nextNumber.toString() }));
      } catch (err) {
        console.error("Erro ao buscar último número de pedido:", err);
      }
    };

    fetchNextOrderNumber();
  }, []);

  // Auto-preenchimento de fornecedor baseado na marca (Removido por redundância)

  // Salvar dados da marca no cache ao sair do campo
  const salvarCacheMarca = () => {
    if (pedido.marca) {
      const savedBrands = localStorage.getItem("order_brands_cache");
      const brandsMap = savedBrands ? JSON.parse(savedBrands) : {};
      brandsMap[pedido.marca.toUpperCase()] = {
        fornecedor: pedido.fornecedor,
        representante: pedido.representante,
        telefone: pedido.telefone,
        email: pedido.email
      };
      localStorage.setItem("order_brands_cache", JSON.stringify(brandsMap));
    }
  };

  const lotesAgrupados = useMemo(() => {
    const res: Record<string, { idVinculo: string, grade: string, items: { ref: string, tipo: string, cor: string, custo: number, venda: number, pares: number }[], lojas: Set<string>, valBruto: number, valLiquido: number, pares: number }> = {};
    lotesFinalizados.forEach(l => {
      if (!res[l.idVinculo]) res[l.idVinculo] = { idVinculo: l.idVinculo, grade: l.gradeLetra, items: [], lojas: new Set(), valBruto: 0, valLiquido: 0, pares: 0 };
      
      const itemOriginal = itens.find(it => it.referencia === l.referencia);
      const g = gradesSalvas.find(x => x.letra === l.gradeLetra);
      const paresLote = g?.total || 0;
      
      if (!res[l.idVinculo].items.find(i => i.ref === l.referencia)) {
        res[l.idVinculo].items.push({
          ref: l.referencia,
          tipo: itemOriginal?.tipo || "",
          cor: `${itemOriginal?.cor1 || ""} ${itemOriginal?.cor2 || ""} ${itemOriginal?.cor3 || ""}`.trim(),
          custo: l.valorCompra || 0,
          venda: itemOriginal?.valorVenda || 0,
          pares: paresLote
        });
      }

      res[l.idVinculo].lojas.add(l.loja);
      const bruto = paresLote * (l.valorCompra || 0);
      const liquido = bruto * (1 - (pedido.desconto / 100));
      
      res[l.idVinculo].pares += paresLote;
      res[l.idVinculo].valBruto += bruto;
      res[l.idVinculo].valLiquido += liquido;
    });
    return Object.values(res);
  }, [lotesFinalizados, gradesSalvas, itens, pedido.desconto]);

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
        <div className="flex bg-white px-4 py-2 gap-1 border-b border-slate-100 shrink-0 flex-row overflow-x-auto no-scrollbar">
          {[1, 2, 3, 4].map(n => {
            const label = n === 1 ? 'Pedido' : n === 2 ? 'Produtos' : n === 3 ? 'Grades' : 'Lojas';
            return (
              <button 
                key={n} 
                onClick={() => setEtapa(n)} 
                className={`flex-1 min-w-[70px] py-2 rounded-xl transition-all border-b-2 flex flex-col items-center justify-center gap-1 ${etapa === n ? 'bg-blue-50 text-blue-700 border-blue-600' : 'text-slate-400 border-transparent hover:bg-slate-50'}`}
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
                    onBlur={salvarCacheMarca}
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
                    onBlur={salvarCacheMarca}
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
                    onBlur={salvarCacheMarca}
                    placeholder="NOME DO REPRESENTANTE" 
                  />
                </div>
                <div className="col-span-2 md:col-span-1 space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase ml-2">Telefone</label>
                  <input 
                    className="w-full p-3 bg-slate-50 rounded-xl font-bold outline-none min-h-[44px]" 
                    value={pedido.telefone} 
                    onChange={e => setPedido({...pedido, telefone: formatPhone(e.target.value)})} 
                    onBlur={salvarCacheMarca}
                    placeholder="(00) 00000-0000" 
                  />
                </div>
                <div className="col-span-2 md:col-span-1 space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase ml-2">Email</label>
                  <input 
                    className="w-full p-3 bg-slate-50 rounded-xl font-bold outline-none min-h-[44px]" 
                    value={pedido.email} 
                    onChange={e => setPedido({...pedido, email: e.target.value.toLowerCase()})} 
                    onBlur={salvarCacheMarca}
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
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-blue-500 uppercase ml-2 flex items-center gap-1"><Zap size={10}/> Markup</label>
                    <input type="number" step="0.1" className="w-full p-3 bg-blue-50/50 rounded-xl font-black text-center text-blue-900 outline-none min-h-[44px] text-xs" value={pedido.markup || ""} onChange={e => setPedido({...pedido, markup: e.target.value})} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-red-500 uppercase ml-2 flex items-center gap-1"><Percent size={10}/> Desconto %</label>
                    <input type="number" className="w-full p-3 bg-red-50/50 rounded-xl font-black text-center text-red-900 outline-none min-h-[44px] text-xs" value={pedido.desconto || ""} onChange={e => setPedido({...pedido, desconto: e.target.value})} />
                  </div>
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
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-in slide-in-from-right-4 duration-300">
              <div className="lg:col-span-7 space-y-4 bg-white p-4 sm:p-6 rounded-3xl shadow-sm border border-slate-100">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase ml-2">Referência</label>
                    <input list="refs" className="w-full p-3 bg-slate-50 rounded-xl font-bold uppercase text-[10px] outline-none min-h-[44px]" value={itemAtual.referencia} onChange={e => setItemAtual({...itemAtual, referencia: e.target.value.toUpperCase()})} placeholder="EX: 1234" />
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
                  <div className="space-y-1">
                    <input 
                      list="colors"
                      className="w-full p-2.5 bg-slate-50 rounded-xl text-[9px] font-bold uppercase outline-none border border-transparent focus:border-blue-200 min-h-[44px]" 
                      placeholder="COR1" 
                      value={itemAtual.cor1} 
                      onChange={e => {
                        const val = e.target.value.toUpperCase();
                        setItemAtual({
                          ...itemAtual, 
                          cor1: val,
                          cor2: val, // Replicação automática
                          cor3: val  // Replicação automática
                        });
                      }} 
                    />
                    <datalist id="colors">{dbSuggestions.cores.map(co => <option key={co} value={co} />)}</datalist>
                  </div>
                  <div className="space-y-1">
                    <input 
                      list="colors"
                      className="w-full p-2.5 bg-slate-50 rounded-xl text-[9px] font-bold uppercase outline-none border border-transparent focus:border-blue-200 min-h-[44px]" 
                      placeholder="COR2" 
                      value={itemAtual.cor2} 
                      onChange={e => setItemAtual({...itemAtual, cor2: e.target.value.toUpperCase()})} 
                    />
                  </div>
                  <div className="space-y-1">
                    <input 
                      list="colors"
                      className="w-full p-2.5 bg-slate-50 rounded-xl text-[9px] font-bold uppercase outline-none border border-transparent focus:border-blue-200 min-h-[44px]" 
                      placeholder="COR3" 
                      value={itemAtual.cor3} 
                      onChange={e => setItemAtual({...itemAtual, cor3: e.target.value.toUpperCase()})} 
                    />
                  </div>
                </div>
                <div className="bg-slate-900 p-4 sm:p-6 rounded-3xl text-white flex justify-between items-center shadow-lg border-b-4 border-blue-600">
                  <div><p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Custo Fábrica</p><div className="flex items-center font-black text-lg sm:text-xl"><span className="text-blue-500 mr-1">R$</span><input type="number" className="bg-transparent w-20 outline-none min-h-[44px] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" value={itemAtual.valorCompra || ""} onChange={e => setItemAtual({...itemAtual, valorCompra: e.target.value})} /></div></div>
                  <div className="text-right border-l border-white/10 pl-4 sm:pl-6"><p className="text-[8px] font-black text-blue-400 uppercase mb-1">Valor de Venda</p><p className="text-xl sm:text-3xl font-black text-yellow-400 italic leading-none">R$ {itemAtual.precoVenda.toFixed(2)}</p></div>
                </div>
                <button 
                  onClick={handleIncluirItem} 
                  disabled={isSaving}
                  className={`w-full py-4 bg-blue-600 text-white rounded-2xl font-black text-[10px] uppercase shadow-md transition-all min-h-[44px] ${isSaving ? 'opacity-50 cursor-not-allowed' : 'hover:bg-blue-700'}`}
                >
                  {isSaving ? 'PROCESSANDO...' : '+ ADICIONAR ITEM'}
                </button>
              </div>
              <div className="lg:col-span-5 space-y-3 flex flex-col h-full overflow-hidden">
                <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-2">Carrinho ({itens.length})</h4>
                <div className="flex-1 overflow-y-auto space-y-2 no-scrollbar pr-1 max-h-[300px] lg:max-h-full">
                  {itens.map(it => (
                    <div key={it.id} className="bg-white p-3 sm:p-4 rounded-2xl border border-slate-100 flex justify-between items-center group shadow-sm">
                      <div><p className="text-[9px] sm:text-[10px] font-black text-slate-800 uppercase italic leading-none">{it.referencia} • {it.tipo}</p><p className="text-[7px] sm:text-[8px] font-bold text-blue-500 uppercase mt-1">Venda: {formatCurrency(it.precoVenda)}</p></div>
                      <button onClick={() => setItens(itens.filter(x => x.id !== it.id))} className="text-slate-300 hover:text-red-500 transition-colors"><Trash2 size={14}/></button>
                    </div>
                  ))}
                  {itens.length === 0 && <div className="h-full flex flex-col items-center justify-center opacity-30 grayscale py-12"><ShoppingBag size={32}/><p className="text-[8px] font-black uppercase mt-2">Vazio</p></div>}
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

                    <div className={`grid gap-1.5 max-h-[40vh] overflow-y-auto no-scrollbar p-1 ${itemAtual.modelo === "Inf" ? 'grid-cols-4' : 'grid-cols-3'}`}>
                      {(TAMANHOS[itemAtual.modelo] || []).map(tam => (
                        <div key={tam} className="bg-slate-50 rounded-xl border border-slate-100 p-1.5 flex flex-col items-center gap-1.5">
                          <span className="text-[8px] font-black text-slate-400 uppercase">{tam}</span>
                          <div className="flex flex-col items-center gap-1 w-full">
                            <button 
                              onClick={() => setGradeEditando({...gradeEditando, [tam]: (gradeEditando[tam] || 0) + 1})}
                              className="w-6 h-6 bg-blue-600 rounded-md flex items-center justify-center text-white shadow-sm active:scale-90 transition-all text-lg font-bold"
                            >
                              +
                            </button>
                            <div className="w-full py-0.5 bg-white border border-slate-200 rounded-md flex items-center justify-center">
                              <span className="font-black text-[10px] text-slate-900">
                                {gradeEditando[tam] || 0}
                              </span>
                            </div>
                            <button 
                              onClick={() => setGradeEditando({...gradeEditando, [tam]: Math.max(0, (gradeEditando[tam] || 0) - 1)})}
                              className="w-6 h-6 bg-red-500 rounded-md flex items-center justify-center text-white shadow-sm active:scale-90 transition-all text-lg font-bold"
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
               <div className="lg:col-span-4 bg-white p-4 rounded-3xl shadow-sm border border-slate-100 flex flex-col">
                  <span className="text-[9px] font-black text-blue-600 uppercase mb-4 text-center tracking-widest border-b pb-2">1. Selecionar & Vincular</span>
                  <div className="flex-1 overflow-y-auto space-y-2 pr-1 no-scrollbar max-h-[35vh] lg:max-h-full">
                    {itens.map(it => {
                      const isSel = selecaoLote.itensIds.includes(it.id);
                      const assignment = persistAssignments[it.id] || { gradeLetra: "", corSelecionada: it.cor1 || "" };
                      return (
                        <div key={it.id} className={`p-3 rounded-2xl border transition-all ${isSel ? 'bg-blue-50 border-blue-400 shadow-sm' : 'bg-slate-50 border-transparent opacity-80'}`}>
                          <div className="flex justify-between items-start gap-2">
                            <label className="flex items-start gap-2 cursor-pointer flex-1 min-w-0">
                              <div className="pt-0.5 shrink-0">
                                <input 
                                  type="checkbox" 
                                  className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" 
                                  checked={isSel} 
                                  onChange={() => setSelecaoLote({...selecaoLote, itensIds: isSel ? selecaoLote.itensIds.filter(x => x !== it.id) : [...selecaoLote.itensIds, it.id]})} 
                                />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-[9px] font-black uppercase text-slate-800 break-words leading-tight">
                                  {it.referencia}
                                </p>
                                <p className="text-[7px] font-bold text-slate-400 uppercase truncate">{it.tipo}</p>
                              </div>
                            </label>
                            <div className="flex gap-1 shrink-0">
                                {[...new Set([it.cor1, it.cor2, it.cor3].filter(Boolean))].map((cName) => (
                                  <button 
                                    key={`btn-${it.id}-${cName}`} // Chave única garantida: ID do item + Nome da Cor
                                    onClick={(e) => {
                                      e.preventDefault();
                                      const assignment = persistAssignments[it.id] || { gradeLetra: "", corSelecionada: it.cor1 || "" };
                                      setPersistAssignments({...persistAssignments, [it.id]: {...assignment, corSelecionada: cName}});
                                    }} 
                                    className={`px-1.5 py-0.5 rounded-md text-[6px] font-black uppercase transition-all ${assignment.corSelecionada === cName ? 'bg-blue-600 text-white' : 'bg-white border border-slate-200 text-slate-400'}`}
                                  >
                                    {cName}
                                  </button>
                                ))}
                            </div>
                          </div>
                          {isSel && (
                            <div className="mt-3 pt-3 border-t border-blue-100 space-y-2">
                              <div className="flex flex-wrap gap-1">
                                {gradesSalvas.map(gr => (
                                  <button 
                                    key={gr.letra}
                                    onClick={() => setPersistAssignments({...persistAssignments, [it.id]: {...assignment, gradeLetra: gr.letra}})}
                                    className={`w-7 h-7 rounded-lg text-[9px] font-black flex items-center justify-center transition-all ${assignment.gradeLetra === gr.letra ? 'bg-blue-600 text-white shadow-md' : 'bg-white border border-slate-200 text-slate-400'}`}
                                  >
                                    {gr.letra}
                                  </button>
                                ))}
                              </div>
                              {assignment.gradeLetra && (
                                <div className="bg-blue-600/5 p-2 rounded-xl border border-blue-100">
                                  <p className="text-[9px] font-black text-blue-900 italic leading-tight text-center">
                                    {(() => {
                                      const g = gradesSalvas.find(x => x.letra === assignment.gradeLetra);
                                      if (!g) return null;
                                      return Object.entries(g.valores)
                                        .filter(([_, v]) => Number(v) > 0)
                                        .map(([tam, qtd]) => `${tam}-${qtd}`)
                                        .join(' ');
                                    })()}
                                  </p>
                                </div>
                              )}
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
                    
                    const numLotesAtuais = new Set(lotesFinalizados.map(l => l.idVinculo)).size;
                    if (numLotesAtuais >= 5) {
                      return alert("O máximo são 5 pedidos por carga.");
                    }

                    const idVinculo = crypto.randomUUID();
                    const novos = selecaoLote.itensIds.flatMap(id => {
                      const it = itens.find(i => i.id === id);
                      const cfg = persistAssignments[it.id];
                      if (!cfg?.gradeLetra) {
                        alert(`Vincule grade para a referência ${it.referencia}`);
                        throw new Error(`Vincule grade para ${it.referencia}`);
                      }
                      return selecaoLote.lojasIds.map(loja => ({ ...it, loja, gradeLetra: cfg.gradeLetra, corEscolhida: cfg.corSelecionada || it.cor1, idVinculo }));
                    });
                    setLotesFinalizados([...lotesFinalizados, ...novos]);
                    setSelecaoLote({ itensIds: [], lojasIds: [] });
                    alert("Pedido gerado com sucesso!");
                  }} className="w-full py-4 bg-slate-950 text-white rounded-2xl font-black uppercase text-[10px] shadow-xl border-b-4 border-slate-800 hover:bg-blue-600 transition-all flex items-center justify-center gap-2 min-h-[44px]"><Layers size={14}/> GERAR PEDIDO</button>
               </div>
            </div>
          )}
        </div>

        {/* FOOTER - MINIMALIST */}
        <div className="px-6 py-4 bg-white border-t border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4 shrink-0">
          <button onClick={() => setVerLotes(!verLotes)} className={`w-full md:w-auto px-6 py-2.5 rounded-xl font-black text-[9px] uppercase transition-all flex items-center justify-center gap-2 border min-h-[44px] ${verLotes ? 'bg-blue-600 text-white border-blue-700 shadow-md' : 'bg-slate-50 text-blue-700 border-slate-200'}`}>
            <ListFilter size={16}/> Pedidos Ativos ({lotesAgrupados.length})
          </button>
          <div className="flex flex-col gap-1 w-full md:w-auto">
            <div className="flex gap-2 w-full md:w-auto">
              <label className={`flex-1 md:flex-none md:w-48 px-4 py-3 rounded-xl font-black text-[9px] uppercase shadow-sm transition-all border cursor-pointer flex items-center justify-center gap-2 min-h-[44px] ${localTemplate ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100' : 'bg-blue-600 text-white border-blue-700 hover:bg-blue-700 animate-pulse'}`}>
                <Plus size={18}/> {localTemplate ? 'Template OK' : 'Carregar Template'}
                <input type="file" accept=".xlsx" onChange={handleTemplateUpload} className="hidden" />
              </label>
            <button 
              onClick={async () => {
                const res = await salvarPedidoCompleto();
                if (res) {
                  alert("✅ Pedido salvo com sucesso!");
                  setEtapa(1);
                }
              }} 
              disabled={isSaving}
              className={`flex-1 md:flex-none md:w-48 bg-slate-900 text-white px-4 py-3 rounded-xl font-black text-[9px] uppercase shadow-lg transition-all border-b-4 border-slate-700 active:scale-95 flex items-center justify-center gap-2 min-h-[44px] ${isSaving ? 'opacity-50 cursor-not-allowed' : 'hover:bg-slate-800'}`}
            >
              <Layers size={18}/> {isSaving ? 'Salvando...' : '💾 Salvar Pedido'}
            </button>
            <button 
              onClick={() => exportarPlanilhaFinal()} 
              className="flex-1 md:flex-none md:w-48 bg-red-600 text-white px-4 py-3 rounded-xl font-black text-[9px] uppercase shadow-lg hover:bg-red-700 transition-all border-b-4 border-red-900 active:scale-95 flex items-center justify-center gap-2 min-h-[44px]"
            >
              <Download size={18}/> Exportar Excel
            </button>
            <button
              onClick={() => exportarPedidosPorLoja()}
              className="flex-1 md:flex-none md:w-48 bg-blue-700 text-white px-4 py-3 rounded-xl font-black text-[9px] uppercase shadow-lg hover:bg-blue-800 transition-all border-b-4 border-blue-900 active:scale-95 flex items-center justify-center gap-2 min-h-[44px]"
            >
              <Download size={18}/> Pedidos por Loja
            </button>
          </div>
        </div>
      </div>

        {/* OVERLAY RESUMO LOTES */}
        {verLotes && (
            <div className="absolute inset-x-0 bottom-16 bg-white border-t border-slate-200 shadow-2xl p-6 max-h-[50vh] overflow-y-auto animate-in slide-in-from-bottom duration-300 z-50 rounded-t-[32px]">
                <div className="max-w-4xl mx-auto">
                    <div className="flex justify-between items-center mb-6">
                      <h4 className="text-xs font-black uppercase italic text-blue-950">Resumo do Pedido</h4>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-4 mr-4 px-4 py-2 bg-blue-50 rounded-xl border border-blue-100">
                          <div className="text-right">
                            <p className="text-[7px] text-blue-400 font-black uppercase">Total Pares Geral</p>
                            <p className="text-xs font-black text-blue-900 italic">
                              {lotesFinalizados.reduce((acc, l) => {
                                const g = gradesSalvas.find(x => x.letra === l.gradeLetra);
                                return acc + (g?.total || 0);
                              }, 0)}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-[7px] text-blue-400 font-black uppercase">Total Valor Geral</p>
                            <p className="text-xs font-black text-blue-900 italic">
                              {formatCurrency(lotesFinalizados.reduce((acc, l) => {
                                const g = gradesSalvas.find(x => x.letra === l.gradeLetra);
                                return acc + ((g?.total || 0) * (l.valorCompra || 0));
                              }, 0))}
                            </p>
                          </div>
                        </div>
                        <button onClick={() => setLotesFinalizados([])} className="text-red-500 text-[9px] font-black uppercase border border-red-100 px-3 py-1.5 rounded-lg hover:bg-red-50 transition-all">Limpar Pedido</button>
                        <button onClick={() => setVerLotes(false)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-all">
                          <X size={18} />
                        </button>
                      </div>
                    </div>
                    <div className="space-y-4">
                        {lotesAgrupados.map((l, i) => {
                            const isExpanded = pedidoExpandido === l.idVinculo;
                            const itensDoLote = lotesFinalizados.filter(x => x.idVinculo === l.idVinculo);
                            const refsNoLote = [...new Set(itensDoLote.map(x => x.referencia))];
                            const gradeInfo = gradesSalvas.find(g => g.letra === l.grade);
                            const classificacao = gradeInfo ? getClassificacao(gradeInfo.modelo, gradeInfo.valores) : "";
                            const descClassificacao = classificacao ? ` - ${classificacao}` : "";
                            
                            return (
                                <div key={l.idVinculo} className="bg-slate-50 rounded-2xl border border-slate-100 overflow-hidden shadow-sm">
                                    <button 
                                      onClick={() => setPedidoExpandido(isExpanded ? null : l.idVinculo)}
                                      className="w-full p-4 flex items-center justify-between hover:bg-slate-100 transition-all"
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center font-black text-lg text-white shadow-md">
                                                {i + 1}
                                            </div>
                                            <div className="text-left">
                                                <p className="text-[10px] font-black text-slate-800 uppercase leading-none">Pedido {i + 1} (Grade {l.grade}{descClassificacao})</p>
                                                <p className="text-[8px] font-bold text-slate-400 uppercase mt-1">Lojas: {Array.from(l.lojas).sort().join(', ')}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <div className="text-right">
                                                <p className="text-[7px] text-gray-400 font-black uppercase">Total Pares</p>
                                                <p className="text-sm font-black text-slate-900 italic">{l.pares}</p>
                                            </div>
                                            <ChevronRight size={20} className={`text-slate-300 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                                        </div>
                                    </button>

                                    {isExpanded && (
                                        <div className="p-4 bg-white border-t border-slate-100 space-y-4 animate-in slide-in-from-top-2 duration-200">
                                            <div className="space-y-3">
                                                {(() => {
                                                    // Agrupa itens por referência e cor para evitar duplicatas visuais no resumo
                                                    const itemsUnicos = new Map();
                                                    itensDoLote.forEach(it => {
                                                        const key = `${it.referencia}-${it.corEscolhida}`;
                                                        if (!itemsUnicos.has(key)) itemsUnicos.set(key, it);
                                                    });
                                                    
                                                    return Array.from(itemsUnicos.values()).map((itemLote, idx) => {
                                                        const totalParesItem = (gradeInfo?.total || 0) * l.lojas.size;
                                                        const totalFinanceiro = (itemLote?.valorCompra || 0) * totalParesItem;

                                                        return (
                                                            <div key={`${itemLote.referencia}-${itemLote.corEscolhida}-${idx}`} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 shadow-sm space-y-3">
                                                                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                                                                    <div className="col-span-1 flex items-center justify-center">
                                                                        <span className="w-6 h-6 bg-slate-200 rounded-md flex items-center justify-center text-[10px] font-black text-slate-600">{idx + 1}</span>
                                                                    </div>
                                                                    <div className="col-span-2">
                                                                        <p className="text-[7px] font-black text-slate-400 uppercase">Referência</p>
                                                                        <p className="text-[10px] font-black text-slate-900 uppercase">{itemLote.referencia}</p>
                                                                    </div>
                                                                    <div className="col-span-3">
                                                                        <p className="text-[7px] font-black text-slate-400 uppercase">Descrição / Cor</p>
                                                                        <p className="text-[10px] font-black text-slate-900 uppercase truncate">{itemLote.tipo} - {itemLote.corEscolhida}</p>
                                                                    </div>
                                                                    <div className="col-span-1">
                                                                        <p className="text-[7px] font-black text-slate-400 uppercase">Grade</p>
                                                                        <p className="text-[10px] font-black text-blue-600 uppercase">{l.grade}</p>
                                                                    </div>
                                                                    <div className="col-span-1">
                                                                        <p className="text-[7px] font-black text-slate-400 uppercase">Custo</p>
                                                                        <p className="text-[10px] font-black text-slate-900">{formatCurrency(itemLote.valorCompra)}</p>
                                                                    </div>
                                                                    <div className="col-span-1">
                                                                        <p className="text-[7px] font-black text-slate-400 uppercase">Venda</p>
                                                                        <p className="text-[10px] font-black text-slate-900">{formatCurrency(itemLote.precoVenda)}</p>
                                                                    </div>
                                                                    <div className="col-span-1">
                                                                        <p className="text-[7px] font-black text-slate-400 uppercase">Qtd Total</p>
                                                                        <p className="text-[10px] font-black text-slate-900">{totalParesItem} prs</p>
                                                                    </div>
                                                                    <div className="col-span-2 text-right">
                                                                        <p className="text-[7px] font-black text-slate-400 uppercase">Subtotal</p>
                                                                        <p className="text-[10px] font-black text-blue-600">{formatCurrency(totalFinanceiro)}</p>
                                                                    </div>
                                                                </div>
                                                                
                                                                {gradeInfo && (
                                                                    <div className="flex flex-wrap gap-1 mt-2 pt-2 border-t border-slate-200/50">
                                                                        <span className="text-[7px] font-black text-slate-400 uppercase mr-2 self-center">Distribuição:</span>
                                                                        {Object.entries(gradeInfo.valores)
                                                                            .filter(([_, v]) => Number(v) > 0)
                                                                            .map(([tam, qtd]) => (
                                                                                <div key={`${itemLote.referencia}-${tam}`} className="flex items-center border border-blue-100 rounded-md overflow-hidden bg-white shadow-xs">
                                                                                    <span className="bg-blue-50 px-1.5 py-0.5 text-[8px] font-black text-blue-700 border-r border-blue-50">{tam}</span>
                                                                                    <span className="px-1.5 py-0.5 text-[8px] font-black text-slate-900">{qtd}</span>
                                                                                </div>
                                                                            ))}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    });
                                                })()}
                                            </div>
                                            
                                            <div className="pt-4 border-t border-slate-100 flex justify-between items-center">
                                                <div className="text-left flex gap-6">
                                                    <div>
                                                        <p className="text-[8px] font-black text-slate-400 uppercase">Total de Pares</p>
                                                        <p className="text-sm font-black text-blue-600">{l.pares} Pares</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-[8px] font-black text-slate-400 uppercase">Lojas Atendidas</p>
                                                        <p className="text-sm font-black text-slate-700">{l.lojas.size} Lojas</p>
                                                    </div>
                                                </div>
                                                <div className="text-right flex gap-6 text-right justify-end">
                                                    <div>
                                                        <p className="text-[8px] font-black text-slate-400 uppercase">Valor Por Loja</p>
                                                        <p className="text-lg font-black text-slate-700 italic">{formatCurrency(l.lojas.size > 0 ? l.valBruto / l.lojas.size : 0)}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-[8px] font-black text-slate-400 uppercase">Valor Total do Pedido</p>
                                                        <p className="text-xl font-black text-slate-900 italic">{formatCurrency(l.valBruto)}</p>
                                                        {pedido.desconto > 0 && (
                                                            <p className="text-[10px] font-black text-green-600 uppercase">Líquido (-{pedido.desconto}%): {formatCurrency(l.valLiquido)}</p>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                        {lotesAgrupados.length === 0 && (
                            <div className="py-20 flex flex-col items-center justify-center opacity-20 grayscale">
                                <ShoppingBag size={48} />
                                <p className="text-[10px] font-black uppercase mt-4">Nenhum lote gerado</p>
                            </div>
                        )}
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