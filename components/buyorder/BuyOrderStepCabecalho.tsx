import React, {
  useState,
  useEffect,
  useRef,
  Dispatch,
  SetStateAction,
} from "react";
import { supabase } from "../../services/supabaseClient";
import { useBrandAutocomplete } from "../../hooks/useBrandAutocomplete";
import { Cabecalho } from "./BuyOrderStepPedidos";
import { Brand, parsePrazos, calcularPrecoVenda, fmtBRL } from "./BuyOrderModule";

function StepCabecalho({
  cab,
  setCab,
  prazosRaw,
  setPrazosRaw,
  numeroPedidoSalvo,
  setNumeroPedidoSalvo,
  roundBase,
  isMobile,
  user,
  prazosInputRef,
}: {
  cab: Cabecalho;
  setCab: Dispatch<SetStateAction<Cabecalho>>;
  prazosRaw: string;
  setPrazosRaw: (s: string) => void;
  numeroPedidoSalvo: number | null;
  setNumeroPedidoSalvo: (n: number | null) => void;
  roundBase: number;
  isMobile?: boolean;
  user?: any;
  prazosInputRef: React.RefObject<HTMLInputElement | null>;
}) {
  const dataInicialRef = useRef<HTMLInputElement>(null);
  const dataFinalRef = useRef<HTMLInputElement>(null);
  const markupInputRef = useRef<HTMLInputElement>(null);
  const descontoInputRef = useRef<HTMLInputElement>(null);

  function handleEnterKey(e: React.KeyboardEvent, nextRef: React.RefObject<HTMLInputElement | null>) {
    if (e.key === "Enter") {
      e.preventDefault();
      nextRef.current?.focus();
      nextRef.current?.select?.();
    }
  }

  const { fetchAndFillBrand, isLoading } = useBrandAutocomplete();
  const [brands, setBrands] = useState<Brand[]>([]);
  const [showDrop, setShowDrop] = useState(false);
  const [searching, setSearching] = useState(false);
  const [activeSearchField, setActiveSearchField] = useState<string | null>(
    null,
  );
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [vencimentosCalculados, setVencimentosCalculados] = useState<string[]>(
    [],
  );

  const calculateVencimentos = (dataFinal: string, prazosStr: string) => {
    if (!dataFinal || !prazosStr) return [];

    // Configura 12:00 UTC para evitar que a conversão por fuso decaia para o dia anterior
    const data = new Date(dataFinal + "T12:00:00");
    const prazos = prazosStr
      .split(/[,;\/\s]+/)
      .map((p) => parseInt(p.trim()))
      .filter((p) => !isNaN(p));

    return prazos.map((prazo) => {
      const venc = new Date(data);
      venc.setDate(venc.getDate() + prazo);
      const meses = [
        "JAN",
        "FEV",
        "MAR",
        "ABR",
        "MAI",
        "JUN",
        "JUL",
        "AGO",
        "SET",
        "OUT",
        "NOV",
        "DEZ",
      ];
      return `${meses[venc.getMonth()]}/${venc.getFullYear().toString().slice(-2)}`;
    });
  };

  useEffect(() => {
    if (cab.fat_fim && prazosRaw) {
      setVencimentosCalculados(calculateVencimentos(cab.fat_fim, prazosRaw));
    } else {
      setVencimentosCalculados([]);
    }
  }, [cab.fat_fim, prazosRaw]);

  function onFieldInput(field: keyof Cabecalho, val: string) {
    const uppercaseVal = val.toUpperCase();
    setCab((c) => ({
      ...c,
      [field]: uppercaseVal,
      brand_id: field === "marca" ? null : c.brand_id,
    }));

    if (field === "marca" && numeroPedidoSalvo) setNumeroPedidoSalvo(null);

    // ✅ Autocomplete otimizado para marca
    if (field === "marca") {
      fetchAndFillBrand(uppercaseVal, setCab);
      return;
    }

    if (["fornecedor", "representante"].includes(field as string)) {
      if (uppercaseVal.length < 3) {
        setBrands([]);
        setShowDrop(false);
        return;
      }

      clearTimeout(searchTimer.current!);
      setSearching(true);
      setShowDrop(true);
      setActiveSearchField(field as string);

      searchTimer.current = setTimeout(async () => {
        const { data } = await supabase
          .from("buy_brands")
          .select("id,marca,fornecedor,representante,telefone,email")
          .ilike(field as string, `%${uppercaseVal}%`)
          .eq("is_active", true)
          .order(field as string, { ascending: true })
          .limit(8);
        setBrands(data ?? []);
        setSearching(false);
      }, 300);
    }
  }

  function selectBrand(b: Brand) {
    setCab((c) => ({
      ...c,
      brand_id: b.id,
      marca: b.marca,
      fornecedor: b.fornecedor,
      representante: b.representante,
      telefone: b.telefone ?? "",
      email: b.email ?? "",
    }));
    setShowDrop(false);
    setActiveSearchField(null);
  }

  const liq = 100 * (1 - (cab.desconto || 0) / 100);
  const exVenda = calcularPrecoVenda(100, cab.desconto, cab.markup);

  const labelStyle: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 600,
    color: "#475569",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    marginBottom: 4,
    display: "block",
  };

  return (
    <div>
      {/* SEÇÃO 1: DADOS DO FORNECEDOR */}
      <div
        style={{
          padding: "10px 18px",
          background: "#f8fafc",
          borderBottom: "1px solid #e2e8f0",
          fontSize: 11,
          fontWeight: 800,
          color: "#1e293b",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
        }}
      >
        📦 Dados do Fornecedor
      </div>
      <div className="p-4 md:p-6 border-b border-slate-200 space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="relative">
            <label style={labelStyle}>Marca *</label>
            <input
              value={cab.marca}
              onChange={(e) => onFieldInput("marca", e.target.value)}
              onBlur={() => setTimeout(() => setShowDrop(false), 250)}
              placeholder="Digite a marca..."
              autoComplete="off"
              className={`w-full h-10 px-3 border rounded-lg text-sm uppercase font-bold focus:ring-2 focus:ring-blue-500 outline-none transition-all ${!cab.marca ? "border-red-300 bg-red-50/30" : "border-slate-300"}`}
            />
            {showDrop && activeSearchField === "marca" && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-300 rounded-lg shadow-xl z-50 max-h-60 overflow-y-auto">
                {searching && (
                  <div className="p-4 text-xs text-slate-500 italic">
                    Buscando marca...
                  </div>
                )}
                {!searching && brands.length === 0 && (
                  <div className="p-4 text-xs text-slate-500 italic">
                    Marca nova
                  </div>
                )}
                {!searching &&
                  brands.map((b) => (
                    <div
                      key={b.id}
                      onMouseDown={() => selectBrand(b)}
                      className="p-3 text-sm cursor-pointer hover:bg-blue-50 border-b border-slate-50 last:border-0 transition-colors"
                    >
                      <div className="font-bold text-blue-900">{b.marca}</div>
                      <div className="text-[10px] text-slate-500 mt-1 uppercase">
                        {b.fornecedor} • {b.representante}
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
          <div className="relative">
            <label style={labelStyle}>Fornecedor *</label>
            <input
              value={cab.fornecedor}
              onChange={(e) => onFieldInput("fornecedor", e.target.value)}
              onBlur={() => setTimeout(() => setShowDrop(false), 250)}
              placeholder="Razão social"
              autoComplete="off"
              className={`w-full h-10 px-3 border rounded-lg text-sm uppercase focus:ring-2 focus:ring-blue-500 outline-none transition-all ${!cab.fornecedor ? "border-red-300 bg-red-50/30" : "border-slate-300"}`}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="relative">
            <label style={labelStyle}>Representante *</label>
            <input
              value={cab.representante}
              onChange={(e) => onFieldInput("representante", e.target.value)}
              onBlur={() => setTimeout(() => setShowDrop(false), 250)}
              placeholder="Nome do representante"
              autoComplete="off"
              className={`w-full h-10 px-3 border rounded-lg text-sm uppercase focus:ring-2 focus:ring-blue-500 outline-none transition-all ${!cab.representante ? "border-red-300 bg-red-50/30" : "border-slate-300"}`}
            />
          </div>
          <div>
            <label style={labelStyle}>Telefone Rep. *</label>
            <input
              value={cab.telefone}
              onChange={(e) =>
                setCab((c) => ({ ...c, telefone: e.target.value }))
              }
              placeholder="(00) 00000-0000"
              className={`w-full h-10 px-3 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all ${!cab.telefone ? "border-red-300 bg-red-50/30" : "border-slate-300"}`}
            />
          </div>
          <div>
            <label style={labelStyle}>Email Rep. *</label>
            <input
              value={cab.email}
              onChange={(e) =>
                setCab((c) => ({ ...c, email: e.target.value.toUpperCase() }))
              }
              placeholder="vendas@fornecedor.com.br"
              className={`w-full h-10 px-3 border rounded-lg text-sm uppercase focus:ring-2 focus:ring-blue-500 outline-none transition-all ${!cab.email ? "border-red-300 bg-red-50/30" : "border-slate-300"}`}
            />
          </div>
        </div>
      </div>

      {/* SEÇÃO 2: FATURAMENTO */}
      <div
        style={{
          padding: "10px 18px",
          background: "#f8fafc",
          borderBottom: "1px solid #e2e8f0",
          fontSize: 11,
          fontWeight: 800,
          color: "#1e293b",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
        }}
      >
        📅 Faturamento
      </div>
      <div className="p-4 md:p-6 border-b border-slate-200">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
          <div>
            <label style={labelStyle}>Data Inicial *</label>
            <input
              ref={dataInicialRef}
              type="date"
              value={cab.fat_inicio}
              onChange={(e) =>
                setCab((c) => ({ ...c, fat_inicio: e.target.value }))
              }
              onKeyDown={(e) => handleEnterKey(e, dataFinalRef)}
              className={`w-full h-10 px-3 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all ${!cab.fat_inicio || (cab.fat_fim && (new Date(cab.fat_inicio + "T00:00:00").getMonth() !== new Date(cab.fat_fim + "T00:00:00").getMonth() || new Date(cab.fat_inicio + "T00:00:00").getFullYear() !== new Date(cab.fat_fim + "T00:00:00").getFullYear())) ? "border-red-300 bg-red-50/30" : "border-slate-300"}`}
            />
          </div>
          <div>
            <label style={labelStyle}>Data Final *</label>
            <input
              ref={dataFinalRef}
              type="date"
              value={cab.fat_fim}
              onChange={(e) =>
                setCab((c) => ({ ...c, fat_fim: e.target.value }))
              }
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (cab.fat_fim && !prazosRaw.trim()) {
                    const defaultPrazos = "90/120/150";
                    setPrazosRaw(defaultPrazos);
                    setCab((c) => ({ ...c, prazos: parsePrazos(defaultPrazos) }));
                  }
                  setTimeout(() => {
                    prazosInputRef.current?.focus();
                    prazosInputRef.current?.select?.();
                  }, 50);
                }
              }}
              onBlur={() => {
                // Preenche automaticamente 90/120/150 ao terminar de digitar a Data Final —
                // só se o campo Prazos ainda estiver vazio. Vale para Gerente e Admin igualmente,
                // e continua 100% editável depois (mesmo padrão do preço sugerido).
                if (cab.fat_fim && !prazosRaw.trim()) {
                  const defaultPrazos = "90/120/150";
                  setPrazosRaw(defaultPrazos);
                  setCab((c) => ({ ...c, prazos: parsePrazos(defaultPrazos) }));
                }
              }}
              className={`w-full h-10 px-3 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all ${!cab.fat_fim || (cab.fat_inicio && (new Date(cab.fat_inicio + "T00:00:00").getMonth() !== new Date(cab.fat_fim + "T00:00:00").getMonth() || new Date(cab.fat_inicio + "T00:00:00").getFullYear() !== new Date(cab.fat_fim + "T00:00:00").getFullYear())) ? "border-red-300 bg-red-50/30" : "border-slate-300"}`}
            />
          </div>
          <div>
            <label style={labelStyle}>Prazos * (ex: 90/120/150)</label>
            <input
              ref={prazosInputRef}
              value={prazosRaw}
              onChange={(e) => {
                setPrazosRaw(e.target.value);
                setCab((c) => ({ ...c, prazos: parsePrazos(e.target.value) }));
              }}
              onKeyDown={(e) => handleEnterKey(e, markupInputRef)}
              placeholder="Ex: 90/120/150 cada parcela"
              className={`w-full h-10 px-3 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all ${!prazosRaw ? "border-red-300 bg-red-50/30" : "border-slate-300"}`}
            />
            {vencimentosCalculados.length > 0 && (
              <div className="flex gap-2 flex-wrap mt-2">
                {vencimentosCalculados.map((v, idx) => (
                  <span
                    key={idx}
                    className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-full text-[10px] font-bold"
                  >
                    {v}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* SEÇÃO 3: PRECIFICAÇÃO */}
      <div
        style={{
          padding: "10px 18px",
          background: "#f8fafc",
          borderBottom: "1px solid #e2e8f0",
          fontSize: 11,
          fontWeight: 800,
          color: "#1e293b",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
        }}
      >
        💰 Precificação
      </div>
      <div className="p-4 md:p-6 border-b border-slate-200">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
          <div className="grid grid-cols-2 gap-4">
            <div className="w-full">
              <label style={labelStyle} className="text-left w-full block">
                Markup (%) *
              </label>
              <input
                ref={markupInputRef}
                type="number"
                min={0}
                max={10}
                step={0.01}
                value={cab.markup === 0 ? "" : cab.markup}
                onChange={(e) =>
                  setCab((c) => ({
                    ...c,
                    markup: parseFloat(e.target.value) || 0,
                  }))
                }
                onKeyDown={(e) => handleEnterKey(e, descontoInputRef)}
                className={`w-full h-10 px-3 text-center font-bold text-blue-600 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all ${cab.markup === 0 ? "border-amber-300 bg-amber-50/30" : "border-slate-300"}`}
              />
              <div className="text-[10px] text-slate-400 mt-1 italic text-left">
                Fator multiplicador (ex: 2.60)
              </div>
            </div>
            <div className="w-full">
              <label style={labelStyle} className="text-left w-full block">
                Desconto (%)
              </label>
              <input
                ref={descontoInputRef}
                type="number"
                min={0}
                max={100}
                step={0.1}
                value={cab.desconto === 0 ? "" : cab.desconto}
                onChange={(e) =>
                  setCab((c) => ({
                    ...c,
                    desconto: parseFloat(e.target.value) || 0,
                  }))
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    (e.target as HTMLInputElement).blur();
                  }
                }}
                className="w-full h-10 px-3 text-center font-bold text-blue-600 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              />
            </div>
          </div>
          <div className="w-full pt-0 md:pt-[18px]">
            <div className="flex flex-wrap items-center justify-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-lg">
              <div className="flex items-center gap-2">
                <div
                  style={{
                    fontSize: 10,
                    color: "#64748b",
                    fontWeight: 700,
                    textTransform: "uppercase",
                  }}
                >
                  Custo
                </div>
                <div style={{ fontSize: 13, fontWeight: 700 }}>R$ 100,00</div>
              </div>
              <div className="flex items-center gap-2">
                <div
                  style={{
                    fontSize: 10,
                    color: "#64748b",
                    fontWeight: 700,
                    textTransform: "uppercase",
                  }}
                >
                  Desc.
                </div>
                <div
                  style={{ fontSize: 12, fontWeight: 700, color: "#dc2626" }}
                >
                  {cab.desconto.toFixed(1)}%
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div
                  style={{
                    fontSize: 10,
                    color: "#1d4ed8",
                    fontWeight: 700,
                    textTransform: "uppercase",
                  }}
                >
                  Venda Est.
                </div>
                <div
                  style={{ fontSize: 15, fontWeight: 800, color: "#1d4ed8" }}
                >
                  {fmtBRL(exVenda)}
                </div>
              </div>
            </div>
            <div className="text-[10px] text-slate-400 mt-1 italic text-right">
              Marcação do markup e desconto estimado
            </div>
          </div>
        </div>
      </div>

      {/* Toggle Modo Pesquisa — somente admin/comprador */}
      {(String(user?.role || '').toLowerCase() === 'admin' ||
        String(user?.role || '').toLowerCase() === 'comprador') && (
        <div className="p-4 md:p-6 border-b border-slate-200">
          <div
            onClick={() => setCab((prev) => ({ ...prev, modo_pesquisa: !prev.modo_pesquisa }))}
            className={`flex items-center justify-between p-4 rounded-xl border-2 cursor-pointer transition-all select-none ${
              cab.modo_pesquisa
                ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-slate-300"
            }`}
          >
            <div className="flex items-center gap-3">
              <span className="text-xl">🔬</span>
              <div>
                <p className={`text-sm font-black ${cab.modo_pesquisa ? "text-blue-800 dark:text-blue-300" : "text-slate-700 dark:text-slate-300"}`}>
                  Modo Pesquisa
                </p>
                <p className="text-[11px] text-slate-400">
                  Gerentes votam nos itens e escolhem as grades
                </p>
              </div>
            </div>
            <div className={`w-12 h-6 rounded-full transition-all relative ${
              cab.modo_pesquisa ? "bg-blue-600" : "bg-slate-300 dark:bg-slate-600"
            }`}>
              <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${
                cab.modo_pesquisa ? "left-7" : "left-1"
              }`} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default StepCabecalho;
