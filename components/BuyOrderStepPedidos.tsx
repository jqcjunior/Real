import { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { User } from '../types';
 
// ─── Tipos ────────────────────────────────────────────────────────────────────
 
interface GradeItem {
  letter: string;
  cat: 'MASC' | 'FEM' | 'INF' | 'ACESS';
  qtds: Record<string, number>;
}
 
interface ItemComGrades {
  itemIdx: number;
  grades: GradeItem[];
}
 
interface OrderItem {
  ref: string;
  tipo: string;
  cor1: string;
  cor2: string;
  cor3: string;
  modelo: string;
  custo: number;
  preco_venda: number;
}
 
interface SubOrder {
  num: number;
  pedido_numero: string;
  itensComGrades: ItemComGrades[];
  lojas: number[];
  lojaMode: 'sub' | 'all' | null;
}
 
// ─── Constantes ───────────────────────────────────────────────────────────────
 
const SUBGRUPO = [5,8,9,26,31,34,40,43,44,45,50,56,72,88,96,100,102,109];
const ALL_LOJAS = Array.from({ length: 120 }, (_, i) => i + 1);
const GRADE_LETTERS = 'ABCDEFGH';
 
const CATS: Record<string, { label: string; sizes: string[] }> = {
  MASC:  { label: 'Masc',  sizes: [37,38,39,40,41,42,43,44,45,46,47,48].map(String) },
  FEM:   { label: 'Fem',   sizes: [33,34,35,36,37,38,39,40,41,42].map(String) },
  INF:   { label: 'Inf',   sizes: [16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36].map(String) },
  ACESS: { label: 'Acess', sizes: ['UN', 'P', 'M', 'G', 'GG'] },
};
 
const CATS_COMPATIVEIS: Record<string, string[]> = {
  'FEM': ['FEM', 'INF'],
  'MASC': ['MASC', 'INF'],
  'INF': ['INF'],
  'ACESS': ['ACESS']
};
 
// ─── Helpers ──────────────────────────────────────────────────────────────────
 
function fmtBRL(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
 
function totPares(qtds: Record<string, number>): number {
  return Object.values(qtds).reduce((s, v) => s + (v || 0), 0);
}
 
function gerarNumeroPedido(): string {
  const now = new Date();
  const ano = now.getFullYear();
  const mes = String(now.getMonth() + 1).padStart(2, '0');
  const dia = String(now.getDate()).padStart(2, '0');
  const hora = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  const seg = String(now.getSeconds()).padStart(2, '0');
  return `${ano}${mes}${dia}-${hora}${min}${seg}`;
}
 
// ─── Props ────────────────────────────────────────────────────────────────────
 
interface StepPedidosProps {
  items: OrderItem[];
  pedidos: SubOrder[];
  setPedidos: React.Dispatch<React.SetStateAction<SubOrder[]>>;
  user?: User;
  brandId?: string; // Receber brandId do cabeçalho para evitar erro RLS
}
 
// ─── Componente Principal ─────────────────────────────────────────────────────
 
export default function StepPedidos({ items, pedidos, setPedidos, user, brandId }: StepPedidosProps) {
  const isGerente = user?.role === 'MANAGER';
  const userStoreId = user?.storeId ? parseInt(user.storeId) : null;
  
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());
  const [tempPedidoItens, setTempPedidoItens] = useState<ItemComGrades[]>([]);
  const [gradesGlobais, setGradesGlobais] = useState<Set<string>>(new Set()); // Grades criadas globalmente
  const [gradeExpandida, setGradeExpandida] = useState<string | null>(null); // Qual grade está com grid aberto
  const [selectedLojas, setSelectedLojas] = useState<number[]>([]);
  const [lojaMode, setLojaMode] = useState<'sub' | 'all' | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [editingPedido, setEditingPedido] = useState<number | null>(null);
 
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
 
  useEffect(() => {
    if (pedidos.length === 0) {
      const initialStore = isGerente && userStoreId ? [userStoreId] : [];
      setPedidos([{ 
        num: 1, 
        pedido_numero: '', 
        itensComGrades: [], 
        lojas: initialStore, 
        lojaMode: isGerente ? 'all' : null 
      }]);
    }
    
    // NÃO pré-selecionar lojas - deixar vazio para o usuário escolher
    // REMOVIDO: setLojaMode('sub'); setSelectedLojas(SUBGRUPO);
  }, [pedidos.length, isGerente, userStoreId, setPedidos]);
 
  function toggleItem(itemIdx: number) {
    setSelectedItems(prev => {
      const next = new Set(prev);
      if (next.has(itemIdx)) {
        next.delete(itemIdx);
      } else {
        next.add(itemIdx);
      }
      return next;
    });
  }
 
  function adicionarGrade() {
    const usadas = Array.from(gradesGlobais);
    const proxima = GRADE_LETTERS.split('').find(l => !usadas.includes(l));
    if (proxima) {
      setGradesGlobais(prev => new Set([...prev, proxima]));
      setGradeExpandida(proxima);
    }
  }
 
  function vincularAoPedido() {
    if (selectedItems.size === 0 || !gradeExpandida) {
      alert('Selecione pelo menos um item e preencha a grade');
      return;
    }
 
    const novosItens: ItemComGrades[] = [];
    let itensJaVinculados: string[] = [];
 
    selectedItems.forEach(itemIdx => {
      const gradeData = getGradeData(itemIdx, gradeExpandida);
      if (!gradeData || totPares(gradeData.qtds) === 0) {
        return;
      }
 
      const existingIdx = tempPedidoItens.findIndex(x => x.itemIdx === itemIdx);
      
      if (existingIdx >= 0) {
        // Item já existe no pedido temporário
        const existing = tempPedidoItens[existingIdx];
        
        // Verificar se a grade já foi vinculada
        if (existing.grades.some(g => g.letter === gradeExpandida)) {
          itensJaVinculados.push(items[itemIdx].ref);
          return; // Não adiciona grade duplicada
        }
        
        // Adicionar nova grade ao item existente
        const updatedItens = [...tempPedidoItens];
        updatedItens[existingIdx].grades.push(gradeData);
        setTempPedidoItens(updatedItens);
      } else {
        // Novo item
        novosItens.push({
          itemIdx,
          grades: [gradeData]
        });
      }
    });
 
    if (itensJaVinculados.length > 0) {
      alert(`A grade ${gradeExpandida} já foi vinculada para: ${itensJaVinculados.join(', ')}`);
    }
 
    if (novosItens.length > 0) {
      setTempPedidoItens(prev => [...prev, ...novosItens]);
    }
    
    // Resetar seleção de items
    setSelectedItems(new Set());
    // NÃO recolher a grade - manter expandida para reutilização
    // setGradeExpandida(null); REMOVIDO
  }
 
  function criarPedido() {
    if (tempPedidoItens.length === 0) {
      alert('Vincule ao menos um item com grade antes de criar o pedido');
      return;
    }
 
    if (selectedLojas.length === 0 && !isGerente) {
      alert('Selecione ao menos uma loja');
      return;
    }
 
    const lojasParaPedido = isGerente && userStoreId ? [userStoreId] : selectedLojas;
    const numeroPedido = gerarNumeroPedido();
 
    setPedidos(ps => [...ps, {
      num: ps.length + 1,
      pedido_numero: numeroPedido,
      itensComGrades: tempPedidoItens,
      lojas: lojasParaPedido,
      lojaMode: isGerente ? 'all' : lojaMode
    }]);
 
    // Limpar pedido temporário (MAS MANTER GRADES GLOBAIS E EXPANDIDA)
    setTempPedidoItens([]);
    setSelectedItems(new Set());
    // NÃO resetar gradesGlobais - manter para reutilização
    // NÃO resetar gradeExpandida - manter a última grade aberta
    
    // NÃO resetar lojas - manter selecionadas para próximo pedido
  }
 
  function delPedido(idx: number) {
    setPedidos(ps => ps.filter((_, i) => i !== idx).map((p, i) => ({ ...p, num: i + 1 })));
  }
 
  function getGradeData(itemIdx: number, letter: string): GradeItem | null {
    const tempKey = `temp-grade-${itemIdx}-${letter}`;
    const stored = sessionStorage.getItem(tempKey);
    if (stored) return JSON.parse(stored);
    return null;
  }
 
  function setGradeData(itemIdx: number, letter: string, data: GradeItem) {
    const tempKey = `temp-grade-${itemIdx}-${letter}`;
    sessionStorage.setItem(tempKey, JSON.stringify(data));
  }
 
  function setGradeQtd(size: string, qtd: number) {
    if (selectedItems.size === 0 || !gradeExpandida) return;
    
    selectedItems.forEach(itemIdx => {
      const item = items[itemIdx];
      let currentGrade = getGradeData(itemIdx, gradeExpandida);
      
      if (!currentGrade) {
        currentGrade = {
          letter: gradeExpandida,
          cat: (item.modelo || 'FEM') as any,
          qtds: {}
        };
      }
 
      currentGrade.qtds[size] = Math.max(0, qtd);
      setGradeData(itemIdx, gradeExpandida, currentGrade);
    });
    
    setTempPedidoItens(prev => [...prev]);
  }
 
  function toggleLoja(n: number) {
    setSelectedLojas(prev => 
      prev.includes(n) ? prev.filter(x => x !== n) : [...prev, n]
    );
  }
 
  function selectLojaMode(mode: 'sub' | 'all') {
    if (lojaMode === mode) {
      // Se já está ativo, desativa
      setLojaMode(null);
      setSelectedLojas([]);
    } else {
      // Ativa o modo MAS NÃO pré-seleciona as lojas
      setLojaMode(mode);
      // REMOVIDO: setSelectedLojas(...) - usuário escolhe manualmente
    }
  }
 
  const pool = lojaMode === 'sub' ? SUBGRUPO : lojaMode === 'all' ? ALL_LOJAS : [];
 
  // CÁLCULO CORRETO: Total considerando todas as lojas
  function calcPedidoTotals(ped: SubOrder | { itensComGrades: ItemComGrades[] }, lojas?: number[]) {
    let totalParesPorLoja = 0;
    let totalValorPorLoja = 0;
 
    ped.itensComGrades.forEach(icg => {
      const item = items[icg.itemIdx];
      icg.grades.forEach(g => {
        const pares = totPares(g.qtds);
        totalParesPorLoja += pares;
        totalValorPorLoja += pares * item.preco_venda;
      });
    });
 
    const numLojas = lojas ? lojas.length : ('lojas' in ped ? ped.lojas.length : 1);
    
    return { 
      totalParesPorLoja,
      totalValorPorLoja,
      totalParesGeral: totalParesPorLoja * numLojas,
      totalValorGeral: totalValorPorLoja * numLojas,
      numLojas
    };
  }
 
  const catsPermitidas = (() => {
    if (selectedItems.size === 0) return Object.keys(CATS);
    const modelos = Array.from(selectedItems).map(idx => items[idx].modelo);
    const unico = new Set(modelos);
    if (unico.size === 1) {
      return CATS_COMPATIVEIS[Array.from(unico)[0]] || Object.keys(CATS);
    }
    const sets = Array.from(unico).map(m => new Set(CATS_COMPATIVEIS[m] || []));
    const intersecao = sets.reduce((acc, set) => 
      new Set([...acc].filter(x => set.has(x)))
    );
    return Array.from(intersecao);
  })();
 
  const totaisPedidoTemp = calcPedidoTotals(
    { itensComGrades: tempPedidoItens }, 
    isGerente && userStoreId ? [userStoreId] : selectedLojas
  );
 
  return (
    <div className="p-4">
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-3 rounded-t-lg">
        <h3 className="text-sm font-bold uppercase tracking-wide">
          📦 Montagem de Pedidos
        </h3>
        <p className="text-xs opacity-90 mt-0.5">
          Selecione: Item → Grade → Lojas → Criar Pedido
        </p>
      </div>
 
      <div className={`grid ${isMobile ? 'grid-cols-1 gap-4' : 'grid-cols-4 gap-0'} bg-white border border-slate-200 rounded-b-lg overflow-hidden`}>
        
        {/* COLUNA 1: ITENS */}
        <div className={`p-3 ${!isMobile && 'border-r border-slate-200'} bg-slate-50`}>
          <div className="flex items-center gap-2 mb-2">
            <span className="bg-blue-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold">1</span>
            <h4 className="text-xs font-bold text-slate-700 uppercase flex-1">Itens</h4>
          </div>
          
          {/* Botões Selecionar/Desmarcar Todos */}
          <div className="flex gap-1.5 mb-2">
            <button
              onClick={() => setSelectedItems(new Set(items.map((_, idx) => idx)))}
              className="flex-1 px-2 py-1 text-[8px] font-bold bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors shadow-sm active:scale-95">
              ✓ Todos
            </button>
            <button
              onClick={() => setSelectedItems(new Set())}
              className="flex-1 px-2 py-1 text-[8px] font-bold bg-slate-400 text-white rounded-md hover:bg-slate-500 transition-colors shadow-sm active:scale-95">
              ✕ Limpar
            </button>
          </div>
 
          <div className="space-y-2 max-h-[500px] overflow-y-auto">
            {items.map((item, idx) => {
              const isSelected = selectedItems.has(idx);
              const jaVinculado = tempPedidoItens.some(icg => icg.itemIdx === idx);
              
              return (
                <div
                  key={idx}
                  onClick={() => toggleItem(idx)}
                  className={`p-2 rounded-lg border cursor-pointer transition-all ${
                    jaVinculado
                      ? 'bg-green-50 border-green-300 shadow-sm'
                      : isSelected
                      ? 'bg-blue-50 border-blue-400 shadow-sm'
                      : 'bg-white border-slate-200 hover:border-blue-300'
                  }`}>
                  <div className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => {}}
                      className="mt-0.5"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <div className="text-xs font-bold text-slate-800">
                          {item.ref}
                        </div>
                        {jaVinculado && (
                          <span className="bg-green-600 text-white text-[7px] font-bold px-1.5 py-0.5 rounded uppercase">
                            Vinculado
                          </span>
                        )}
                      </div>
                      <div className="text-[9px] text-slate-600">
                        {item.tipo} · {item.modelo}
                      </div>
                      <div className="text-xs font-bold text-green-700">
                        {fmtBRL(item.preco_venda)}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
 
        {/* COLUNA 2: GRADES */}
        <div className={`p-3 ${!isMobile && 'border-r border-slate-200'}`}>
          <div className="flex items-center gap-2 mb-3">
            <span className="bg-blue-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold">2</span>
            <h4 className="text-xs font-bold text-slate-700 uppercase flex-1">Grades</h4>
            {selectedItems.size > 0 && gradesGlobais.size < 8 && (
              <button
                onClick={adicionarGrade}
                className="px-2 py-1 text-[9px] font-bold bg-green-600 text-white rounded hover:bg-green-700">
                + Grade
              </button>
            )}
          </div>
 
          {selectedItems.size === 0 && gradesGlobais.size === 0 ? (
            <div className="text-center py-12 text-slate-400 text-[10px]">
              ← Selecione itens e<br/>clique em "+ Grade"
            </div>
          ) : gradesGlobais.size === 0 ? (
            <div className="text-center py-12 text-slate-400 text-[10px]">
              Clique em "+ Grade"
            </div>
          ) : (
            <div className="space-y-2 max-h-[500px] overflow-y-auto">
              {Array.from(gradesGlobais).map(letter => {
                const isExpanded = gradeExpandida === letter;
                const firstItemIdx = Array.from(selectedItems)[0] ?? 0;
                const gradeData = getGradeData(firstItemIdx, letter);
                const currentCat = gradeData?.cat || (items[firstItemIdx]?.modelo as any);
                const sizes = CATS[currentCat]?.sizes || [];
                const totalPares = gradeData ? totPares(gradeData.qtds) : 0;
 
                return (
                  <div 
                    key={letter}
                    className="border rounded-lg p-2 bg-white">
                    
                    {/* Header da Grade (sempre visível) */}
                    <div 
                      className="flex items-center gap-2 cursor-pointer"
                      onClick={() => setGradeExpandida(isExpanded ? null : letter)}>
                      <div className="w-6 h-6 bg-blue-600 text-white rounded font-bold flex items-center justify-center text-xs">
                        {letter}
                      </div>
                      <div className="flex-1">
                        {totalPares > 0 && (
                          <div className="text-[9px] text-slate-500">
                            {Object.entries(gradeData?.qtds || {})
                              .filter(([_, v]) => v > 0)
                              .map(([sz, v]) => `${sz}-${v}`)
                              .join(' * ')}
                          </div>
                        )}
                      </div>
                      <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-[10px] font-bold">
                        {totalPares}p
                      </span>
                      <span className="text-slate-400 text-xs">{isExpanded ? '▼' : '▶'}</span>
                    </div>
 
                    {/* Grid Expandido */}
                    {isExpanded && (
                      <div className="mt-2 pt-2 border-t">
                        {/* Seletor de categoria */}
                        <div className="flex flex-wrap gap-1 mb-2">
                          {catsPermitidas.map(k => {
                            const v = CATS[k];
                            return (
                              <button
                                key={k}
                                onClick={() => {
                                  selectedItems.forEach(itemIdx => {
                                    const newGrade: GradeItem = {
                                      letter,
                                      cat: k as any,
                                      qtds: {}
                                    };
                                    setGradeData(itemIdx, letter, newGrade);
                                  });
                                  setTempPedidoItens(prev => [...prev]);
                                }}
                                className={`px-2 py-0.5 text-[8px] font-bold rounded border ${
                                  currentCat === k
                                    ? 'bg-blue-600 text-white border-blue-600'
                                    : 'bg-white border-slate-200 text-slate-500'
                                }`}>
                                {v.label}
                              </button>
                            );
                          })}
                        </div>
 
                        {/* Grid de numeração COMPACTO */}
                        <div className="grid grid-cols-6 gap-1">
                          {sizes.map(sz => {
                            const qtd = gradeData?.qtds[sz] || 0;
                            return (
                              <div key={sz} className="text-center">
                                <div className="text-[7px] text-slate-400 font-bold mb-0.5">{sz}</div>
                                {isMobile ? (
                                  // Mobile: Botões +/-
                                  <div className="flex flex-col gap-0.5">
                                    <button
                                      onClick={() => setGradeQtd(sz, qtd + 1)}
                                      className="w-full h-5 bg-green-500 text-white rounded text-[10px] font-bold active:bg-green-600">
                                      +
                                    </button>
                                    <div className={`text-[9px] font-bold ${qtd > 0 ? 'text-green-700' : 'text-slate-300'}`}>
                                      {qtd}
                                    </div>
                                    <button
                                      onClick={() => setGradeQtd(sz, qtd - 1)}
                                      className="w-full h-5 bg-red-500 text-white rounded text-[10px] font-bold active:bg-red-600">
                                      −
                                    </button>
                                  </div>
                                ) : (
                                  // Desktop: Input
                                  <input
                                    type="number"
                                    min={0}
                                    value={qtd || ''}
                                    onChange={e => setGradeQtd(sz, parseInt(e.target.value) || 0)}
                                    className={`w-full h-6 text-center text-[10px] border rounded ${
                                      qtd > 0
                                        ? 'bg-green-50 border-green-300 text-green-700 font-bold'
                                        : 'bg-white border-slate-200'
                                    }`}
                                  />
                                )}
                              </div>
                            );
                          })}
                        </div>
 
                        <button
                          onClick={vincularAoPedido}
                          className="mt-2 w-full px-2 py-1 bg-blue-600 text-white text-[9px] font-bold rounded hover:bg-blue-700">
                          ✓ Vincular
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
 
        {/* COLUNA 3: LOJAS */}
        <div className={`p-3 ${!isMobile && 'border-r border-slate-200'} bg-slate-50`}>
          <div className="flex items-center gap-2 mb-3">
            <span className="bg-blue-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold">3</span>
            <h4 className="text-xs font-bold text-slate-700 uppercase">Lojas</h4>
          </div>
 
          {isGerente ? (
            <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 p-2 rounded-lg">
              <div className="w-10 h-10 flex items-center justify-center bg-blue-600 text-white rounded-lg font-bold">
                {userStoreId}
              </div>
              <div>
                <div className="text-xs font-bold text-blue-900">Sua Loja</div>
                <div className="text-[9px] text-blue-600">Automático</div>
              </div>
            </div>
          ) : (
            <>
              <div className="flex gap-2 mb-2">
                <button
                  onClick={() => selectLojaMode('sub')}
                  className={`px-2 py-1 text-[10px] rounded font-medium ${
                    lojaMode === 'sub'
                      ? 'bg-blue-600 text-white'
                      : 'bg-white border border-slate-300 text-slate-600'
                  }`}>
                  Sub
                </button>
                <button
                  onClick={() => selectLojaMode('all')}
                  className={`px-2 py-1 text-[10px] rounded font-medium ${
                    lojaMode === 'all'
                      ? 'bg-blue-600 text-white'
                      : 'bg-white border border-slate-300 text-slate-600'
                  }`}>
                  Todas
                </button>
                <span className="text-[9px] text-slate-500 self-center ml-auto">
                  {selectedLojas.length} sel.
                </span>
              </div>
 
              {pool.length > 0 && (
                <div className="max-h-[400px] overflow-y-auto">
                  <div className="flex flex-wrap gap-1.5">
                    {pool.map(n => (
                      <div
                        key={n}
                        onClick={() => toggleLoja(n)}
                        className={`w-9 h-9 flex items-center justify-center text-[10px] font-bold rounded border cursor-pointer ${
                          selectedLojas.includes(n)
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-white border-slate-200 text-slate-500'
                        }`}>
                        {n}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
 
        {/* COLUNA 4: FINALIZAÇÃO COM LISTA DE PEDIDOS */}
        <div className="p-3 flex flex-col">
          <div className="flex items-center gap-2 mb-3">
            <span className="bg-green-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold">4</span>
            <h4 className="text-xs font-bold text-slate-700 uppercase flex-1">Pedidos</h4>
          </div>
 
          {/* Pedido Temporário */}
          {tempPedidoItens.length > 0 && (
            <div className="bg-amber-50 border border-amber-300 rounded-lg p-2 mb-3">
              <div className="text-xs font-bold text-amber-900 mb-2">Pedido Temporário</div>
              <div className="text-[9px] text-amber-700 space-y-0.5 mb-2">
                <div>Pares/Loja: <strong>{totaisPedidoTemp.totalParesPorLoja}</strong></div>
                <div>Lojas: <strong>{totaisPedidoTemp.numLojas}</strong></div>
                <div className="pt-1 border-t border-amber-200">
                  <div className="text-blue-700">Total Geral: <strong>{totaisPedidoTemp.totalParesGeral} pares</strong></div>
                  <div className="text-green-700">Investimento: <strong>{fmtBRL(totaisPedidoTemp.totalValorGeral)}</strong></div>
                </div>
              </div>
              <button
                onClick={criarPedido}
                className="w-full px-2 py-1.5 bg-green-600 text-white text-[10px] font-bold rounded hover:bg-green-700">
                ✓ Criar Pedido
              </button>
            </div>
          )}
 
          {/* Lista de Pedidos Criados */}
          <div className="flex-1 overflow-y-auto space-y-2">
            {pedidos.filter(p => p.itensComGrades.length > 0).map((ped) => {
              const totals = calcPedidoTotals(ped);
              const pedidoIndex = pedidos.findIndex(p => p.num === ped.num);
              
              return (
                <div
                  key={ped.num}
                  onClick={() => setEditingPedido(pedidoIndex)}
                  className="bg-white border border-slate-200 rounded-lg p-2 cursor-pointer hover:border-blue-400 transition-all">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="text-xs font-bold text-slate-800">
                      Pedido {ped.num}
                    </div>
                    <div className="text-[8px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-600 font-mono">
                      {ped.pedido_numero}
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); delPedido(pedidoIndex); }}
                      className="ml-auto text-red-500 text-xs">
                      ✕
                    </button>
                  </div>
                  <div className="text-[9px] text-slate-600 space-y-0.5">
                    <div>Pares Total: <strong className="text-green-700">{totals.totalParesGeral}</strong></div>
                    <div>Valor Total: <strong className="text-green-700">{fmtBRL(totals.totalValorGeral)}</strong></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
 
      {/* POPUP DE EDIÇÃO */}
      {editingPedido !== null && (
        <EditPedidoPopup
          pedido={pedidos[editingPedido]}
          items={items}
          onClose={() => setEditingPedido(null)}
          onSave={(updated) => {
            setPedidos(ps => ps.map((p, i) => i === editingPedido ? updated : p));
            setEditingPedido(null);
          }}
        />
      )}
    </div>
  );
}
 
// ─── Popup de Edição ──────────────────────────────────────────────────────────
 
function EditPedidoPopup({ pedido, items, onClose, onSave }: {
  pedido: SubOrder;
  items: OrderItem[];
  onClose: () => void;
  onSave: (updated: SubOrder) => void;
}) {
  const [localPedido, setLocalPedido] = useState({ ...pedido });
 
  function removeItem(itemIdx: number) {
    setLocalPedido(p => ({
      ...p,
      itensComGrades: p.itensComGrades.filter(icg => icg.itemIdx !== itemIdx)
    }));
  }
 
  function removeLoja(loja: number) {
    setLocalPedido(p => ({
      ...p,
      lojas: p.lojas.filter(l => l !== loja)
    }));
  }
 
  const totals = (() => {
    let totalParesPorLoja = 0;
    let totalValorPorLoja = 0;
    localPedido.itensComGrades.forEach(icg => {
      const item = items[icg.itemIdx];
      icg.grades.forEach(g => {
        const pares = totPares(g.qtds);
        totalParesPorLoja += pares;
        totalValorPorLoja += pares * item.preco_venda;
      });
    });
    return {
      totalParesPorLoja,
      totalValorPorLoja,
      totalParesGeral: totalParesPorLoja * localPedido.lojas.length,
      totalValorGeral: totalValorPorLoja * localPedido.lojas.length
    };
  })();
 
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-4 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold">Pedido {pedido.num}</h3>
            <p className="text-xs opacity-90">
              {totals.totalParesGeral} pares · {fmtBRL(totals.totalValorGeral)} · {localPedido.lojas.length} lojas
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:bg-white/20 rounded-lg w-8 h-8 flex items-center justify-center text-xl">
            ✕
          </button>
        </div>
 
        <div className="p-4 overflow-y-auto max-h-[calc(90vh-140px)]">
          <div className="mb-4">
            <label className="text-xs font-bold text-slate-700 uppercase mb-2 block">
              Código (Automático)
            </label>
            <div className="w-full h-9 px-3 border border-slate-300 rounded-lg text-sm font-mono bg-slate-50 flex items-center">
              {localPedido.pedido_numero}
            </div>
          </div>
 
          <div className="mb-4">
            <div className="text-xs font-bold text-slate-700 uppercase mb-2">
              Itens ({localPedido.itensComGrades.length})
            </div>
            <div className="space-y-2">
              {localPedido.itensComGrades.map(icg => {
                const item = items[icg.itemIdx];
                const totalItem = icg.grades.reduce((s, g) => s + totPares(g.qtds), 0);
                return (
                  <div key={icg.itemIdx} className="bg-slate-50 border border-slate-200 rounded-lg p-3 flex items-start justify-between">
                    <div className="flex-1">
                      <div className="text-sm font-bold text-slate-800">{item.ref}</div>
                      <div className="text-xs text-slate-600 mb-2">{item.tipo}</div>
                      <div className="space-y-1">
                        {icg.grades.map(g => (
                          <div key={g.letter} className="text-[10px] text-slate-500">
                            <strong>Grade {g.letter}</strong> ({CATS[g.cat]?.label}): {Object.entries(g.qtds).filter(([_, v]) => v > 0).map(([sz, v]) => `${sz}-${v}`).join(' * ')}
                            <span className="ml-2 text-green-700 font-bold">({totPares(g.qtds)}p)</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="ml-3">
                      <div className="text-xs font-bold text-green-700 mb-1">{totalItem}p</div>
                      <button
                        onClick={() => removeItem(icg.itemIdx)}
                        className="text-red-500 hover:text-red-700 text-xs">
                        Remover
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
 
          <div>
            <div className="text-xs font-bold text-slate-700 uppercase mb-2">
              Lojas ({localPedido.lojas.length})
            </div>
            <div className="flex flex-wrap gap-2">
              {localPedido.lojas.map(loja => (
                <div
                  key={loja}
                  className="bg-blue-50 border border-blue-300 px-3 py-1.5 rounded-lg flex items-center gap-2">
                  <span className="text-sm font-bold text-blue-800">{loja}</span>
                  <button
                    onClick={() => removeLoja(loja)}
                    className="text-red-500 hover:text-red-700 text-xs">
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
 
        <div className="border-t border-slate-200 p-4 flex justify-between items-center bg-slate-50">
          <div className="text-xs text-slate-600">
            <div>Por Loja: <strong>{totals.totalParesPorLoja}p</strong> · <strong>{fmtBRL(totals.totalValorPorLoja)}</strong></div>
            <div className="text-green-700">Total Geral: <strong>{totals.totalParesGeral}p</strong> · <strong>{fmtBRL(totals.totalValorGeral)}</strong></div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm border border-slate-300 rounded-lg hover:bg-slate-100">
              Cancelar
            </button>
            <button
              onClick={() => onSave(localPedido)}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">
              Salvar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}