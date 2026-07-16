import React, {
  useState,
  useEffect,
  useRef,
  Dispatch,
  SetStateAction,
} from "react";
import { Pencil, X, Plus } from "lucide-react";
import { toast } from "sonner";
import ProductPhotoUpload from "./ProductPhotoUpload";
import { supabase } from "../../services/supabaseClient";
import { fetchPreviousPrice } from "./buyOrderItems.utils";
import { OrderItem, Cabecalho } from "./BuyOrderStepPedidos";
import {
  calcularPrecoVenda,
  fmtBRL,
  getCategoryBadge,
} from "./BuyOrderModule";

function classificarModelo(tipo: string, modeloAtual?: string): string {
  const t = (tipo || '').toUpperCase().trim();
  if (!t) return '';

  // 1) Acessório (maior prioridade)
  const KEYWORDS_ACES = [
    'RELOGIO', 'RELÓGIO', 'WATCH',
    'MEIA',
    'BOLA',
    'BERMUDA', 'CALCA', 'CALCAO', 'SHORT', 'TOP',
    'LUVA', 'CANELEI',
    'OCULO', 'OCULOS',
    'CALIBRA',
    'PORTA ', 'MINI ',
    'CINTO', 'BOLSA', 'BONE', 'BONÉ',
    'CARTEIRA', 'MOCHILA', 'MALA',
    'POCHETE', 'POLCHETE',
    'CROSSBODY', 'CROOSBODY',
    'TIRACOLO', 'TOTE',
    'SHOPPING BAG', 'CAMERA BAG',
    'KIT CARTEIRA',
    'ACESSORIO', 'ACESSÓRIO',
  ];
  if (KEYWORDS_ACES.some(kw => t.includes(kw)) || t === 'ACES') {
    return 'ACES';
  }

  // 2) Infantil (antes de FEM/MASC, pois pode ter "INFANTIL FEMININO")
  if (t.includes('INFANTIL') || t.includes('KIDS') || t.includes('BABY') || t.includes('BEBE') || t.includes('BEBÊ') || t === 'INF') {
    return 'INF';
  }

  // 3) Feminino
  if (t.includes('FEMININO') || t.includes('FEMININA') || t.includes(' FEM') || t === 'FEM') {
    return 'FEM';
  }

  // 4) Masculino
  if (t.includes('MASCULINO') || t.includes('MASCULINA') || t.includes(' MASC') || t === 'MASC') {
    return 'MASC';
  }

  return modeloAtual || '';
}

function StepItens({
  items,
  setItems,
  cab,
  roundBase,
  selectedLojas,
  isMobile,
  setStep2State,
  setPedidos,
  user,
}: {
  items: OrderItem[];
  setItems: Dispatch<SetStateAction<OrderItem[]>>;
  cab: Cabecalho;
  roundBase: number;
  selectedLojas: number[];
  isMobile?: boolean;
  setStep2State?: Dispatch<SetStateAction<any>>;
  setPedidos?: Dispatch<SetStateAction<any[]>>;
  user?: any;
}) {
  const isAdmin = String(user?.role || "").toUpperCase() === "ADMIN";
  const [showPopup, setShowPopup] = useState(false);
  const [editIdx, setEditIdx] = useState(-1);
  const [form, setForm] = useState({
    ref: "",
    tipo: "",
    cor1: "",
    cor2: "",
    cor3: "",
    modelo: "",
    custo: "",
    vendaManual: "",
    vendaEditadaManualmente: false,
  });
  const [showAutoFilledMessage, setShowAutoFilledMessage] = useState(false);

  const checkAndFillReference = (refVal: string) => {
    // Only check if we are creating a new item (editIdx === -1)
    if (editIdx !== -1) return;
    
    const cleanedRef = refVal.trim().toUpperCase();
    if (!cleanedRef) {
      setShowAutoFilledMessage(false);
      return;
    }
    const existente = items.find(
      (item) => item.ref && item.ref.trim().toUpperCase() === cleanedRef
    );
    if (existente) {
      setForm({
        ref: cleanedRef,
        tipo: (existente.tipo || "").trim().toUpperCase(),
        cor1: "",
        cor2: "",
        cor3: "",
        modelo: existente.modelo || "",
        custo: existente.custo !== undefined ? String(existente.custo) : "",
        vendaManual: "",
        vendaEditadaManualmente: false,
      });
      setCor2Manual(false);
      setCor3Manual(false);
      setModeloManual(true);
      setShowAutoFilledMessage(true);
    }
  };

  const [historicPrice, setHistoricPrice] = useState<number | null>(null);
  const listContainerRef = useRef<HTMLDivElement>(null);
  const lastTouchY = useRef<number | null>(null);

  const handleOverlayWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget && listContainerRef.current) {
      listContainerRef.current.scrollTop += e.deltaY;
    }
  };

  const handleOverlayTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget && e.touches.length === 1) {
      lastTouchY.current = e.touches[0].clientY;
    }
  };

  const handleOverlayTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget && e.touches.length === 1 && lastTouchY.current !== null && listContainerRef.current) {
      const currentY = e.touches[0].clientY;
      const deltaY = lastTouchY.current - currentY;
      listContainerRef.current.scrollTop += deltaY;
      lastTouchY.current = currentY;
    }
  };

  const handleOverlayTouchEnd = () => {
    lastTouchY.current = null;
  };

  // Scroll to bottom of items list on adding a new item
  useEffect(() => {
    if (items.length > 0 && listContainerRef.current) {
      setTimeout(() => {
        listContainerRef.current?.scrollTo({
          top: listContainerRef.current.scrollHeight,
          behavior: "smooth",
        });
      }, 100);
    }
  }, [items.length]);

  useEffect(() => {
    if (form.ref && form.ref.length >= 5) {
      const timer = setTimeout(async () => {
        const preco = await fetchPreviousPrice(form.ref);
        if (preco) {
          setHistoricPrice(preco);
        } else {
          setHistoricPrice(null);
        }
      }, 500);
      return () => clearTimeout(timer);
    } else {
      setHistoricPrice(null);
    }
  }, [form.ref]);
  const [cor2Manual, setCor2Manual] = useState(false);
  const [cor3Manual, setCor3Manual] = useState(false);
  const [modeloManual, setModeloManual] = useState(false);
  const [isCalculating, setIsCalculating] = useState(false);

  const [tipoSuggestions, setTipoSuggestions] = useState<string[]>([]);
  const [showTipoDropdown, setShowTipoDropdown] = useState(false);
  const [corSuggestions, setCorSuggestions] = useState<string[]>([]);
  const [showCorDropdown, setShowCorDropdown] = useState<{
    field: "cor1" | "cor2" | "cor3" | null;
  }>({ field: null });

  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);

  const refInputRef = useRef<HTMLInputElement>(null);
  const tipoInputRef = useRef<HTMLInputElement>(null);
  const cor1InputRef = useRef<HTMLInputElement>(null);
  const cor2InputRef = useRef<HTMLInputElement>(null);
  const cor3InputRef = useRef<HTMLInputElement>(null);
  const modeloInputRef = useRef<HTMLSelectElement>(null);
  const custoInputRef = useRef<HTMLInputElement>(null);
  const btnSalvarRef = useRef<HTMLButtonElement>(null);

  function handleEnterKey(
    e: React.KeyboardEvent,
    nextRef: React.RefObject<any>,
    ignoreDropdown = false,
  ) {
    if (
      e.key === "Enter" &&
      (ignoreDropdown || selectedSuggestionIndex === -1)
    ) {
      e.preventDefault();
      nextRef.current?.focus();
    }
  }

  async function searchTipos(query: string) {
    if (query.length < 3) {
      setTipoSuggestions([]);
      setShowTipoDropdown(false);
      return;
    }
    const { data } = await supabase
      .from("buy_item_types")
      .select("tipo")
      .ilike("tipo", `%${query}%`)
      .order("uso_count", { ascending: false })
      .order("tipo", { ascending: true })
      .limit(10);
    setTipoSuggestions(data?.map((t) => t.tipo) || []);
    setShowTipoDropdown(true);
  }

  async function searchCores(query: string, field: "cor1" | "cor2" | "cor3") {
    if (query.length < 2) {
      setCorSuggestions([]);
      setShowCorDropdown({ field: null });
      return;
    }
    const { data } = await supabase
      .from("buy_item_colors")
      .select("cor")
      .ilike("cor", `%${query}%`)
      .order("uso_count", { ascending: false })
      .order("cor", { ascending: true })
      .limit(10);
    setCorSuggestions(data?.map((c) => c.cor) || []);
    setShowCorDropdown({ field });
  }

  function selectTipo(tipo: string) {
    const tu = tipo.toUpperCase();
    setForm((f) => {
      const novoModelo = modeloManual ? f.modelo : classificarModelo(tu, f.modelo);
      return {
        ...f,
        tipo: tu,
        modelo: novoModelo,
      };
    });
    setShowTipoDropdown(false);
    supabase.rpc("increment_tipo_usage", { tipo_name: tu });
  }

  function selectCor(cor: string, field: "cor1" | "cor2" | "cor3") {
    const cu = cor.toUpperCase();
    if (field === "cor1") {
      setForm((f) => ({
        ...f,
        cor1: cu,
        cor2: cor2Manual ? f.cor2 : cu,
        cor3: cor3Manual ? f.cor3 : cu,
      }));
    } else if (field === "cor2") {
      setCor2Manual(true);
      setForm((f) => ({ ...f, cor2: cu }));
    } else {
      setCor3Manual(true);
      setForm((f) => ({ ...f, cor3: cu }));
    }
    setShowCorDropdown({ field: null });
    supabase.rpc("increment_color_usage", { color_name: cu });
  }

  function openNew() {
    setForm({
      ref: "",
      tipo: "",
      cor1: "",
      cor2: "",
      cor3: "",
      modelo: "",
      custo: "",
      vendaManual: "",
      vendaEditadaManualmente: false,
    });
    setEditIdx(-1);
    setCor2Manual(false);
    setCor3Manual(false);
    setModeloManual(false);
    setCorSuggestions([]);
    setTipoSuggestions([]);
    setShowAutoFilledMessage(false);
    setShowPopup(true);
  }
  function openEdit(i: number) {
    const it = items[i];
    const initialModelo = it.modelo || classificarModelo(it.tipo || "");
    setForm({
      ref: it.ref,
      tipo: it.tipo,
      cor1: it.cor1,
      cor2: it.cor2,
      cor3: it.cor3,
      modelo: initialModelo,
      custo: String(it.custo),
      vendaManual: isAdmin ? String(it.preco_venda) : "",
      vendaEditadaManualmente: isAdmin ? true : false,
    });
    setEditIdx(i);
    setCor2Manual(!!it.cor2);
    setCor3Manual(!!it.cor3);
    setModeloManual(!!it.modelo);
    setCorSuggestions([]);
    setTipoSuggestions([]);
    setShowAutoFilledMessage(false);
    setShowPopup(true);
  }

  function onCor1(v: string) {
    const vu = v.toUpperCase();
    setForm((f) => ({
      ...f,
      cor1: vu,
      cor2: cor2Manual ? f.cor2 : vu,
      cor3: cor3Manual ? f.cor3 : vu,
    }));
  }

  async function saveItem(manterAberto: boolean = false) {
    setIsCalculating(true);
    const custo = parseFloat(form.custo) || 0;
    const preco_venda = (isAdmin && form.vendaEditadaManualmente && form.vendaManual !== "") 
      ? parseFloat(form.vendaManual) 
      : estVenda;

    const savedTipo = (form.tipo || "").trim().toUpperCase();

    const item: OrderItem = {
      ref: form.ref,
      tipo: savedTipo,
      cor1: form.cor1,
      cor2: form.cor2,
      cor3: form.cor3,
      modelo: form.modelo,
      custo,
      preco_venda,
      historico_preco_venda: historicPrice || undefined,
      _catalogImageUrl: editIdx >= 0 ? items[editIdx]._catalogImageUrl : undefined,
    };
    if (editIdx >= 0)
      setItems((its) => its.map((it, i) => (i === editIdx ? item : it)));
    else setItems((its) => [...its, item]);

    if (manterAberto && editIdx === -1) {
      // Mantém Referência/Tipo/Modelo/Custo — limpa só as cores para a próxima variante
      setForm((f) => ({
        ...f,
        cor1: "",
        cor2: "",
        cor3: "",
      }));
      setCor2Manual(false);
      setCor3Manual(false);
      setIsCalculating(false);
      setTimeout(() => cor1InputRef.current?.focus(), 50);
    } else {
      setShowPopup(false);
      setIsCalculating(false);
    }
  }

  function delItem(i: number) {
    setItems((its) => its.filter((_, idx) => idx !== i));
    
    if (setStep2State) {
      setStep2State((prev: any) => {
        const nextTemp = (prev.tempPedidoItens || [])
          .filter((icg: any) => icg.itemIdx !== i)
          .map((icg: any) => {
            if (icg.itemIdx > i) {
              return { ...icg, itemIdx: icg.itemIdx - 1 };
            }
            return icg;
          });

        const nextSelected = new Set<number>();
        if (prev.selectedItems instanceof Set) {
          prev.selectedItems.forEach((idx: number) => {
            if (idx < i) nextSelected.add(idx);
            else if (idx > i) nextSelected.add(idx - 1);
          });
        }

        return {
          ...prev,
          tempPedidoItens: nextTemp,
          selectedItems: nextSelected,
        };
      });
    }

    if (setPedidos) {
      setPedidos((prev: any[]) => {
        return (prev || []).map((ped) => {
          const nextItens = (ped.itensComGrades || [])
            .filter((icg: any) => icg.itemIdx !== i)
            .map((icg: any) => {
              if (icg.itemIdx > i) {
                return { ...icg, itemIdx: icg.itemIdx - 1 };
              }
              return icg;
            });
          return {
            ...ped,
            itensComGrades: nextItens,
          };
        });
      });
    }
  }

  const estVenda = calcularPrecoVenda(
    parseFloat(form.custo) || 0,
    cab.desconto,
    cab.markup,
  );

  return (
    <div className="flex flex-col h-full relative">
      <div
        style={{
          padding: "6px 18px",
          background: "#f9fafb",
          borderBottom: "0.5px solid #e5e7eb",
          fontSize: 10,
          fontWeight: 500,
          color: "#6b7280",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span>Itens do pedido</span>
      </div>

      <div 
        ref={listContainerRef} 
        className="overflow-auto flex-1 animate-fadeIn" 
        style={{ paddingBottom: "80px" }}
      >
        {items.length === 0 ? (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '80px 20px',
            gap: 12,
          }}>
            <p style={{ color: '#9ca3af', fontSize: 14 }}>Nenhum item adicionado</p>
            <button
              onClick={openNew}
              style={{
                background: '#185FA5',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                padding: '12px 24px',
                fontSize: 15,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                animation: 'pulse 2s ease-in-out infinite',
              }}
            >
              + Adicionar Primeiro Item
            </button>
          </div>
        ) : isMobile ? (
          <div className="space-y-2 p-3">
            {items.map((item, idx) => {
              const cat = getCategoryBadge(item.modelo);
              return (
                <div key={idx} className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm">
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className="text-[10px] font-black text-slate-400 bg-slate-100 rounded px-1">#{idx+1}</span>
                    <span className="text-[11px] font-black text-slate-800">{item.ref}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${cat.color} ml-auto`}>
                      {cat.label}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-600 mb-1">
                    {item.tipo}
                    {(() => {
                      const coresTexto = [item.cor1, item.cor2, item.cor3]
                        .filter(Boolean)
                        .join(' - ');
                      return coresTexto ? ` - ${coresTexto}` : '';
                    })()}
                  </div>
                  <div className="grid grid-cols-2 gap-2 mb-1">
                    <div>
                      <label className="text-xs text-gray-500 block">Custo</label>
                      <span className="text-[10px] text-slate-600 font-bold">{fmtBRL(item.custo)}</span>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 block">Preço Venda</label>
                      <span className="text-[11px] text-[#185FA5] font-black">{fmtBRL(item.preco_venda)}</span>
                    </div>
                  </div>
                  {(item.cor1 || item.cor2 || item.cor3) && (
                    <div className="text-xs text-gray-500 truncate mb-1">
                      {[item.cor1, item.cor2, item.cor3].filter(Boolean).join(" / ")}
                    </div>
                  )}
                  <div className="flex justify-end items-center gap-3 border-t border-slate-100 pt-2 mt-2">
                    <ProductPhotoUpload
                      supabase={supabase}
                      marca={cab.marca}
                      referencia={item.ref}
                      cor1={item.cor1 || ''}
                      tipo={item.tipo}
                      modelo={item.modelo}
                      existingImageUrl={item._catalogImageUrl}
                      onPhotoUploaded={(url) => {
                        const updated = [...items];
                        updated[idx]._catalogImageUrl = url;
                        setItems(updated);
                      }}
                    />
                    <button onClick={() => openEdit(idx)} className="text-[#185FA5] flex items-center gap-1 text-[10px] font-bold">
                      <Pencil size={12}/> Editar
                    </button>
                    <button onClick={() => delItem(idx)} className="text-red-500 flex items-center gap-1 text-[10px] font-bold">
                      <X size={12}/> Excluir
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <table className="w-full border-collapse table-fixed">
            <thead>
              <tr style={{ background: "#f9fafb" }}>
                <th
                  className="w-6"
                  style={{
                    padding: "6px 2px",
                    textAlign: "left",
                    fontWeight: 500,
                    color: "#6b7280",
                    borderBottom: "0.5px solid #e5e7eb",
                    whiteSpace: "nowrap",
                  }}
                >
                  #
                </th>
                <th
                  className="w-10"
                  style={{
                    padding: "6px 0px",
                    borderBottom: "0.5px solid #e5e7eb",
                  }}
                ></th>
                <th
                  className="w-28"
                  style={{
                    padding: "6px 4px",
                    textAlign: "left",
                    fontWeight: 500,
                    color: "#6b7280",
                    borderBottom: "0.5px solid #e5e7eb",
                    whiteSpace: "nowrap",
                  }}
                >
                  Referência
                </th>
                <th
                  className="w-48 text-xs"
                  style={{
                    padding: "6px 4px",
                    textAlign: "left",
                    fontWeight: 500,
                    color: "#6b7280",
                    borderBottom: "0.5px solid #e5e7eb",
                    whiteSpace: "nowrap",
                  }}
                >
                  Tipo
                </th>
                <th
                  className="w-16 text-xs"
                  style={{
                    padding: "6px 4px",
                    textAlign: "left",
                    fontWeight: 500,
                    color: "#6b7280",
                    borderBottom: "0.5px solid #e5e7eb",
                    whiteSpace: "nowrap",
                  }}
                >
                  Cat
                </th>
                <th
                  className="w-20 text-xs"
                  style={{
                    padding: "6px 4px",
                    textAlign: "left",
                    fontWeight: 500,
                    color: "#6b7280",
                    borderBottom: "0.5px solid #e5e7eb",
                    whiteSpace: "nowrap",
                  }}
                >
                  Cor 1
                </th>
                <th
                  className="w-20 text-xs"
                  style={{
                    padding: "6px 4px",
                    textAlign: "left",
                    fontWeight: 500,
                    color: "#6b7280",
                    borderBottom: "0.5px solid #e5e7eb",
                    whiteSpace: "nowrap",
                  }}
                >
                  Cor 2
                </th>
                <th
                  className="w-20 text-xs"
                  style={{
                    padding: "6px 4px",
                    textAlign: "left",
                    fontWeight: 500,
                    color: "#6b7280",
                    borderBottom: "0.5px solid #e5e7eb",
                    whiteSpace: "nowrap",
                  }}
                >
                  Cor 3
                </th>
                <th
                  className="w-24 text-right"
                  style={{
                    padding: "6px 8px",
                    fontWeight: 500,
                    color: "#6b7280",
                    borderBottom: "0.5px solid #e5e7eb",
                    whiteSpace: "nowrap",
                  }}
                >
                  Custo
                </th>
                <th
                  className="w-24 text-right"
                  style={{
                    padding: "6px 12px",
                    fontWeight: 500,
                    color: "#6b7280",
                    borderBottom: "0.5px solid #e5e7eb",
                    whiteSpace: "nowrap",
                  }}
                >
                  Venda
                </th>
                <th
                  className="w-16 text-right"
                  style={{
                    padding: "6px 12px",
                    fontWeight: 500,
                    color: "#6b7280",
                    borderBottom: "0.5px solid #e5e7eb",
                    whiteSpace: "nowrap",
                  }}
                >
                  Ações
                </th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && (
                <tr>
                  <td
                    colSpan={11}
                    style={{
                      textAlign: "center",
                      padding: "20px 0",
                      color: "#9ca3af",
                      fontSize: 12,
                    }}
                  >
                    Nenhum item. Clique em "+ Item" para adicionar.
                  </td>
                </tr>
              )}
              {items.map((it, i) => {
                const cat = getCategoryBadge(it.modelo);
                return (
                  <tr key={i} style={{ borderBottom: "0.5px solid #f3f4f6" }}>
                    <td
                      className="text-[10px]"
                      style={{ padding: "5px 2px", color: "#9ca3af", textAlign: "left" }}
                    >
                      {i + 1}
                    </td>
                    <td style={{ padding: "5px 0px", textAlign: "center" }}>
                      <ProductPhotoUpload
                        supabase={supabase}
                        marca={cab.marca}
                        referencia={it.ref}
                        cor1={it.cor1 || ''}
                        tipo={it.tipo}
                        modelo={it.modelo}
                        existingImageUrl={it._catalogImageUrl}
                        onPhotoUploaded={(url) => {
                          const updated = [...items];
                          updated[i]._catalogImageUrl = url;
                          setItems(updated);
                        }}
                      />
                    </td>
                    <td
                      className="text-xs"
                      style={{ padding: "5px 4px", fontWeight: 500, textAlign: "left" }}
                    >
                      {it.ref || "—"}
                    </td>
                    <td className="text-[10px]" style={{ padding: "5px 4px", textAlign: "left" }}>
                      {it.tipo || "—"}
                      {(() => {
                        const coresTexto = [it.cor1, it.cor2, it.cor3]
                          .filter(Boolean)
                          .join(' - ');
                        return coresTexto ? (
                          <div style={{ fontSize: '9px', color: '#6b7280', fontWeight: 'bold', marginTop: '1px' }}>
                            {coresTexto}
                          </div>
                        ) : null;
                      })()}
                    </td>
                    <td className="text-[10px]" style={{ padding: "5px 4px", textAlign: "left" }}>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${cat.color}`}>
                        {cat.label}
                      </span>
                    </td>
                    <td className="text-[10px]" style={{ padding: "5px 4px", textAlign: "left" }}>
                      {it.cor1 || "—"}
                    </td>
                    <td
                      className="text-[10px]"
                      style={{ padding: "5px 4px", color: "#9ca3af", textAlign: "left" }}
                    >
                      {it.cor2 || "—"}
                    </td>
                    <td
                      className="text-[10px]"
                      style={{ padding: "5px 4px", color: "#9ca3af", textAlign: "left" }}
                    >
                      {it.cor3 || "—"}
                    </td>
                    <td
                      className="text-[11px] text-right font-medium"
                      style={{ padding: "5px 8px", color: "#64748b" }}
                    >
                      {fmtBRL(it.custo)}
                    </td>
                    <td
                      className={`text-xs text-right font-semibold ${it.historico_preco_venda && it.preco_venda > it.historico_preco_venda ? "text-emerald-600 animate-pulse" : it.historico_preco_venda && it.preco_venda < it.historico_preco_venda ? "text-amber-500 animate-pulse" : "text-[#185FA5]"}`}
                      style={{ padding: "5px 12px" }}
                    >
                      {fmtBRL(it.preco_venda)}
                    </td>
                    <td className="text-right" style={{ padding: "5px 12px" }}>
                      <button
                        onClick={() => openEdit(i)}
                        style={{
                          border: "none",
                          background: "transparent",
                          cursor: "pointer",
                          color: "#185FA5",
                          marginRight: 8,
                        }}
                        title="Editar"
                      >
                        <Pencil size={12} strokeWidth={2.5} />
                      </button>
                      <button
                        onClick={() => delItem(i)}
                        style={{
                          border: "none",
                          background: "transparent",
                          cursor: "pointer",
                          color: "#dc2626",
                        }}
                        title="Excluir"
                      >
                        <X size={14} strokeWidth={2.5} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Floating Action Button (FAB) for adding new items */}
      {items.length > 0 && (
        <div className="animate-fab-entrance group fixed md:bottom-[80px] bottom-[72px] md:right-[24px] right-[16px] z-50 flex items-center">
          {/* Tooltip (visible on hover on desktop md or larger) */}
          <span className="hidden md:block absolute right-[68px] opacity-0 group-hover:opacity-100 bg-slate-800 text-white text-xs px-2.5 py-1.5 rounded-lg shadow-lg whitespace-nowrap transition-all duration-200 pointer-events-none transform translate-x-2 group-hover:translate-x-0 font-medium z-50">
            Adicionar item
          </span>
          
          <button
            onClick={() => {
              openNew();
            }}
            className="w-12 h-12 md:w-14 md:h-14 rounded-full bg-[#185FA5] text-white flex items-center justify-center shadow-[0_4px_12px_rgba(0,0,0,0.25)] transition-all duration-200 hover:brightness-90 active:scale-95 cursor-pointer transform hover:scale-105 active:scale-95"
            style={{ border: "none" }}
            aria-label="Adicionar novo item ao pedido"
          >
            <Plus size={24} className="text-white" />
          </button>
        </div>
      )}

      <style>{`
        @keyframes fab-entrance {
          0% { transform: scale(0); opacity: 0; }
          70% { transform: scale(1.1); }
          100% { transform: scale(1); opacity: 1; }
        }
        .animate-fab-entrance {
          animation: fab-entrance 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }
        @keyframes pulse {
          0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(24,95,165,0.4); }
          50% { transform: scale(1.05); box-shadow: 0 0 0 10px rgba(24,95,165,0); }
        }
      `}</style>

      {/* Popup item */}
      {showPopup && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowPopup(false);
            }
          }}
          onWheel={handleOverlayWheel}
          onTouchStart={handleOverlayTouchStart}
          onTouchMove={handleOverlayTouchMove}
          onTouchEnd={handleOverlayTouchEnd}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            display: "flex",
            alignItems: isMobile ? "stretch" : "center",
            justifyContent: "center",
            background: "rgba(0,0,0,0.5)",
            padding: isMobile ? 0 : 16,
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: isMobile ? "100%" : 550,
              height: isMobile ? "100%" : "auto",
              maxHeight: isMobile ? "100%" : "90vh",
              borderRadius: isMobile ? 0 : 12,
              background: "white",
              boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)",
              margin: isMobile ? 0 : "auto",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "12px 16px",
                borderBottom: "1px solid #e5e7eb",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                position: "sticky",
                top: 0,
                background: "#fff",
                zIndex: 10,
              }}
            >
              <span style={{ fontSize: 14, fontWeight: 700 }}>
                {editIdx >= 0 ? `Editar item ${editIdx + 1}` : "Novo item"}
              </span>
              <button
                onClick={() => setShowPopup(false)}
                style={{
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                  fontSize: 22,
                  color: "#374151",
                  padding: "4px 8px",
                }}
              >
                ✕
              </button>
            </div>
            <div style={{ padding: 16, flex: 1, overflowY: "auto" }}>
              {/* LINHA 1: Referência ocupa linha inteira */}
              <div style={{ marginBottom: 10 }}>
                <label
                  style={{
                    fontSize: 10,
                    fontWeight: 500,
                    color: "#6b7280",
                    textTransform: "uppercase",
                    display: "block",
                    marginBottom: 3,
                  }}
                >
                  Referência *
                </label>
                <input
                  ref={refInputRef}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === "Tab") {
                      checkAndFillReference(form.ref);
                    }
                    handleEnterKey(e, tipoInputRef, true);
                  }}
                  onBlur={() => {
                    checkAndFillReference(form.ref);
                  }}
                  value={form.ref}
                  onChange={(e) => {
                    setForm((f) => ({
                      ...f,
                      ref: e.target.value.toUpperCase(),
                    }));
                    setShowAutoFilledMessage(false);
                  }}
                  placeholder="REF-001"
                  style={{
                    height: 30,
                    width: "100%",
                    padding: "0 8px",
                    border: "0.5px solid #d1d5db",
                    borderRadius: 5,
                    fontSize: 12,
                    outline: "none",
                    textTransform: "uppercase",
                  }}
                  autoFocus
                />
                {showAutoFilledMessage && (
                  <div style={{ color: "#475569", fontSize: "11px", marginTop: "4px", fontWeight: 500 }}>
                    Ref. encontrada no pedido — campos preenchidos automaticamente
                  </div>
                )}
              </div>

              {/* LINHA 2: Tipo com AUTOCOMPLETE */}
              <div style={{ marginBottom: 10, position: "relative" }}>
                <label
                  style={{
                    fontSize: 10,
                    fontWeight: 500,
                    color: "#6b7280",
                    textTransform: "uppercase",
                    display: "block",
                    marginBottom: 3,
                  }}
                >
                  Tipo
                </label>
                <input
                  ref={tipoInputRef}
                  value={form.tipo}
                  onChange={(e) => {
                    const v = e.target.value.toUpperCase();
                    setForm((f) => {
                      const novoModelo = modeloManual ? f.modelo : classificarModelo(v, f.modelo);
                      return {
                        ...f,
                        tipo: v,
                        modelo: novoModelo,
                      };
                    });
                    searchTipos(v);
                    setSelectedSuggestionIndex(-1);
                    setShowAutoFilledMessage(false);
                  }}
                  onKeyDown={(e) => {
                    if (isMobile) {
                      handleEnterKey(e, cor1InputRef, true);
                      return;
                    }
                    if (showTipoDropdown && tipoSuggestions.length > 0) {
                      if (e.key === "ArrowDown") {
                        e.preventDefault();
                        setSelectedSuggestionIndex((prev) =>
                          prev < tipoSuggestions.length - 1 ? prev + 1 : prev,
                        );
                        return;
                      } else if (e.key === "ArrowUp") {
                        e.preventDefault();
                        setSelectedSuggestionIndex((prev) =>
                          prev > 0 ? prev - 1 : -1,
                        );
                        return;
                      } else if (
                        e.key === "Enter" &&
                        selectedSuggestionIndex >= 0
                      ) {
                        e.preventDefault();
                        selectTipo(tipoSuggestions[selectedSuggestionIndex]);
                        setSelectedSuggestionIndex(-1);
                        cor1InputRef.current?.focus();
                        return;
                      } else if (e.key === "Escape") {
                        setShowTipoDropdown(false);
                        setSelectedSuggestionIndex(-1);
                        return;
                      }
                    }
                    handleEnterKey(e, cor1InputRef);
                  }}
                  onBlur={() =>
                    setTimeout(() => {
                      setShowTipoDropdown(false);
                      setSelectedSuggestionIndex(-1);
                    }, 200)
                  }
                  placeholder="Digite o tipo do produto"
                  style={{
                    height: 30,
                    width: "100%",
                    padding: "0 8px",
                    border: "0.5px solid #d1d5db",
                    borderRadius: 5,
                    fontSize: 12,
                    outline: "none",
                    textTransform: "uppercase",
                  }}
                />
                {showTipoDropdown && tipoSuggestions.length > 0 && (
                  <div
                    style={{
                      position: "absolute",
                      top: "100%",
                      left: 0,
                      right: 0,
                      background: "#fff",
                      border: "0.5px solid #d1d5db",
                      borderRadius: 5,
                      zIndex: 110,
                      marginTop: 2,
                      boxShadow: "0 4px 12px rgba(0,0,0,.1)",
                    }}
                  >
                    {tipoSuggestions.map((tipo, idx) => {
                      const isSelected =
                        !isMobile && idx === selectedSuggestionIndex;
                      return (
                        <div
                          key={tipo}
                          onMouseDown={() => selectTipo(tipo)}
                          style={{
                            padding: "7px 10px",
                            fontSize: 12,
                            cursor: "pointer",
                            borderBottom: "0.5px solid #f3f4f6",
                            background: isSelected ? "#1d4ed8" : "",
                            color: isSelected ? "#fff" : "",
                          }}
                          onMouseEnter={() => {
                            if (!isMobile) setSelectedSuggestionIndex(idx);
                          }}
                        >
                          {tipo}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr 1fr",
                  gap: 10,
                  marginBottom: 10,
                }}
              >
                {[
                  {
                    key: "cor1",
                    label: "Cor 1 *",
                    ref: cor1InputRef,
                    nextRef: cor2InputRef,
                    onChange: (v: string) => {
                      const vu = v.toUpperCase();
                      onCor1(vu);
                      searchCores(vu, "cor1");
                      setSelectedSuggestionIndex(-1);
                      setShowAutoFilledMessage(false);
                    },
                  },
                  {
                    key: "cor2",
                    label: "Cor 2",
                    ref: cor2InputRef,
                    nextRef: cor3InputRef,
                    onChange: (v: string) => {
                      const vu = v.toUpperCase();
                      setCor2Manual(true);
                      setForm((f) => ({ ...f, cor2: vu }));
                      searchCores(vu, "cor2");
                      setSelectedSuggestionIndex(-1);
                      setShowAutoFilledMessage(false);
                    },
                  },
                  {
                    key: "cor3",
                    label: "Cor 3",
                    ref: cor3InputRef,
                    nextRef: modeloInputRef,
                    onChange: (v: string) => {
                      const vu = v.toUpperCase();
                      setCor3Manual(true);
                      setForm((f) => ({ ...f, cor3: vu }));
                      searchCores(vu, "cor3");
                      setSelectedSuggestionIndex(-1);
                      setShowAutoFilledMessage(false);
                    },
                  },
                ].map((f) => (
                  <div key={f.key} style={{ position: "relative" }}>
                    <label
                      style={{
                        fontSize: 10,
                        fontWeight: 500,
                        color: "#6b7280",
                        textTransform: "uppercase",
                        display: "block",
                        marginBottom: 3,
                      }}
                    >
                      {f.label}
                    </label>
                    <input
                      ref={f.ref}
                      value={(form as any)[f.key]}
                      onChange={(e) => f.onChange(e.target.value.toUpperCase())}
                      onKeyDown={(e) => {
                        if (isMobile) {
                          handleEnterKey(e, f.nextRef, true);
                          return;
                        }
                        if (
                          showCorDropdown.field === f.key &&
                          corSuggestions.length > 0
                        ) {
                          if (e.key === "ArrowDown") {
                            e.preventDefault();
                            setSelectedSuggestionIndex((prev) =>
                              prev < corSuggestions.length - 1
                                ? prev + 1
                                : prev,
                            );
                            return;
                          } else if (e.key === "ArrowUp") {
                            e.preventDefault();
                            setSelectedSuggestionIndex((prev) =>
                              prev > 0 ? prev - 1 : -1,
                            );
                            return;
                          } else if (
                            e.key === "Enter" &&
                            selectedSuggestionIndex >= 0
                          ) {
                            e.preventDefault();
                            selectCor(
                              corSuggestions[selectedSuggestionIndex],
                              f.key as any,
                            );
                            setSelectedSuggestionIndex(-1);
                            f.nextRef.current?.focus();
                            return;
                          } else if (e.key === "Escape") {
                            setShowCorDropdown({ field: null });
                            setSelectedSuggestionIndex(-1);
                            return;
                          }
                        }
                        handleEnterKey(e, f.nextRef);
                      }}
                      onBlur={() =>
                        setTimeout(() => {
                          setShowCorDropdown({ field: null });
                          setSelectedSuggestionIndex(-1);
                        }, 200)
                      }
                      placeholder="—"
                      style={{
                        height: 30,
                        width: "100%",
                        padding: "0 8px",
                        border: "0.5px solid #d1d5db",
                        borderRadius: 5,
                        fontSize: 12,
                        outline: "none",
                        textTransform: "uppercase",
                      }}
                    />
                    {showCorDropdown.field === f.key &&
                      corSuggestions.length > 0 && (
                        <div
                          style={{
                            position: "absolute",
                            top: "100%",
                            left: 0,
                            right: 0,
                            background: "#fff",
                            border: "0.5px solid #d1d5db",
                            borderRadius: 5,
                            zIndex: 110,
                            marginTop: 2,
                            boxShadow: "0 4px 12px rgba(0,0,0,.1)",
                          }}
                        >
                          {corSuggestions.map((cor, idx) => {
                            const isSelected =
                              !isMobile && idx === selectedSuggestionIndex;
                            return (
                              <div
                                key={cor}
                                onMouseDown={() => selectCor(cor, f.key as any)}
                                style={{
                                  padding: "7px 10px",
                                  fontSize: 12,
                                  cursor: "pointer",
                                  borderBottom: "0.5px solid #f3f4f6",
                                  background: isSelected ? "#1d4ed8" : "",
                                  color: isSelected ? "#fff" : "",
                                }}
                                onMouseEnter={() => {
                                  if (!isMobile)
                                    setSelectedSuggestionIndex(idx);
                                }}
                              >
                                {cor}
                              </div>
                            );
                          })}
                        </div>
                      )}
                  </div>
                ))}
              </div>

              {/* Linha 4: Modelo (dropdown) */}
              <div style={{ marginBottom: 10 }}>
                <label
                  style={{
                    fontSize: 10,
                    fontWeight: 500,
                    color: "#6b7280",
                    textTransform: "uppercase",
                    display: "block",
                    marginBottom: 3,
                  }}
                >
                  Modelo *
                </label>
                <select
                  ref={modeloInputRef}
                  value={form.modelo}
                  onKeyDown={(e) => handleEnterKey(e, custoInputRef, true)}
                  onChange={(e) => {
                    setModeloManual(true);
                    setForm((f) => ({ ...f, modelo: e.target.value }));
                    setShowAutoFilledMessage(false);
                  }}
                  style={{
                    height: 30,
                    width: "100%",
                    padding: "0 8px",
                    border: "0.5px solid #d1d5db",
                    borderRadius: 5,
                    fontSize: 12,
                    outline: "none",
                    background: "#fff",
                  }}
                >
                  <option value="">Selecione...</option>
                  <option value="MASC">Masculino</option>
                  <option value="FEM">Feminino</option>
                  <option value="INF">Infantil</option>
                  <option value="ACES">Acessório</option>
                </select>
              </div>

              <div style={{ marginBottom: 10 }}>
                <label
                  style={{
                    fontSize: 10,
                    fontWeight: 500,
                    color: "#6b7280",
                    textTransform: "uppercase",
                    display: "block",
                    marginBottom: 3,
                  }}
                >
                  Custo (R$)
                </label>
                <input
                  ref={custoInputRef}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (!form.custo || parseFloat(form.custo) <= 0)) {
                      e.preventDefault();
                      return;
                    }
                    handleEnterKey(e, btnSalvarRef, true);
                  }}
                  type="number"
                  step={0.01}
                  value={form.custo}
                  onChange={(e) => {
                    setForm((f) => ({ ...f, custo: e.target.value }));
                    setShowAutoFilledMessage(false);
                  }}
                  placeholder="0,00"
                  style={{
                    height: 30,
                    width: "100%",
                    padding: "0 8px",
                    border: "0.5px solid #d1d5db",
                    borderRadius: 5,
                    fontSize: 12,
                    outline: "none",
                  }}
                />
              </div>

              <div
                style={{
                  background: "#f9fafb",
                  border: "0.5px solid #e5e7eb",
                  borderRadius: 6,
                  padding: "8px 12px",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  flexWrap: "wrap",
                }}
              >
                <span style={{ fontSize: 11, color: "#6b7280" }}>
                  Desconto {cab.desconto}% → Markup {cab.markup}x → Venda:
                </span>
                {isAdmin ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <input
                      type="number"
                      step="0.01"
                      value={form.vendaEditadaManualmente ? form.vendaManual : (form.custo ? String(estVenda) : "")}
                      onChange={(e) => {
                        setForm((f) => ({
                          ...f,
                          vendaManual: e.target.value,
                          vendaEditadaManualmente: true,
                        }));
                      }}
                      placeholder="0,00"
                      style={{
                        height: 30,
                        width: 100,
                        padding: "0 8px",
                        border: "0.5px solid #d1d5db",
                        borderRadius: 5,
                        fontSize: 12,
                        outline: "none",
                        fontWeight: "bold",
                        color: "#185FA5",
                      }}
                    />
                    <span style={{ fontSize: 10, color: "#9ca3af" }}>
                      Sugestão: {form.custo ? fmtBRL(estVenda) : "—"}
                    </span>
                  </div>
                ) : (
                  <span
                    className={`text-[15px] font-medium ${historicPrice && estVenda > historicPrice ? "text-emerald-600 animate-pulse" : historicPrice && estVenda < historicPrice ? "text-amber-500 animate-pulse" : "text-[#185FA5]"}`}
                  >
                    {form.custo ? fmtBRL(estVenda) : "—"}
                  </span>
                )}
                {historicPrice && form.custo && (
                  <span className="text-[10px] text-slate-400 ml-auto italic">
                    Último: {fmtBRL(historicPrice)}
                  </span>
                )}
              </div>
            </div>
            <div
              style={{
                position: "sticky",
                bottom: 0,
                background: "white",
                padding: "16px",
                borderTop: "1px solid #e5e7eb",
                display: "flex",
                justifyContent: "flex-end",
                gap: 8,
              }}
            >
              <button
                onClick={() => setShowPopup(false)}
                style={{
                  height: isMobile ? 38 : 30,
                  padding: "0 16px",
                  borderRadius: 6,
                  fontSize: 13,
                  cursor: "pointer",
                  border: "1px solid #d1d5db",
                  background: "transparent",
                  color: "#374151",
                  flex: isMobile ? 1 : "initial",
                }}
              >
                Cancelar
              </button>
              {editIdx === -1 && (
                <button
                  onClick={() => saveItem(true)}
                  disabled={isCalculating || !form.ref || !form.cor1}
                  title="Salva este item e mantém Referência/Tipo/Modelo/Custo preenchidos para cadastrar a próxima cor rapidamente"
                  style={{
                    height: isMobile ? 38 : 30,
                    padding: "0 16px",
                    borderRadius: 6,
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                    border: "1px solid #185FA5",
                    background: "#fff",
                    color: (isCalculating || !form.ref || !form.cor1) ? "#9ca3af" : "#185FA5",
                    flex: isMobile ? 1 : "initial",
                    whiteSpace: "nowrap",
                  }}
                >
                  + Nova Cor
                </button>
              )}
              <button
                ref={btnSalvarRef}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveItem(false);
                }}
                onClick={() => saveItem(false)}
                disabled={isCalculating}
                style={{
                  height: isMobile ? 38 : 30,
                  padding: "0 16px",
                  borderRadius: 6,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  border: "none",
                  background: isCalculating ? "#9ca3af" : "#185FA5",
                  color: "#fff",
                  flex: isMobile ? 1 : "initial",
                }}
              >
                {isCalculating
                  ? "Calculando..."
                  : editIdx >= 0
                    ? "Salvar"
                    : "Adicionar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default StepItens;
