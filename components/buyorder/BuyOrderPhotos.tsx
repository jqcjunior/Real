import React, { useState, useEffect, useRef } from 'react';
import { Camera, Upload, Trash2, Loader2, ArrowRight, CheckCircle2 } from 'lucide-react';
import { supabase } from '../../services/supabaseClient';
import { User } from '../../types';

// Helper to resize and convert image to WebP
const resizeImage = (file: File, maxSize = 600): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let { width, height } = img;
      if (width > height) {
        if (width > maxSize) {
          height = (height * maxSize) / width;
          width = maxSize;
        }
      } else {
        if (height > maxSize) {
          width = (width * maxSize) / height;
          height = maxSize;
        }
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height); // background default white
        ctx.drawImage(img, 0, 0, width, height);
      }
      canvas.toBlob(
        (blob) => {
          URL.revokeObjectURL(img.src);
          blob ? resolve(blob) : reject(new Error('Falha ao redimensionar'));
        },
        'image/webp',
        0.80
      );
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
};

// Slug helper to create clean paths
function sanitizeSlug(str: string): string {
  return (str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

interface BuyOrder {
  id: string;
  numero_pedido: number | null;
  fornecedor: string | null;
  marca: string | null;
  status: string;
  item_count?: number;
}

interface BuyOrderItem {
  id: string;
  referencia: string;
  tipo: string;
  modelo: string;
  cor1: string;
  cor2?: string;
  cor3?: string;
  custo: number;
  preco_venda: number;
}

interface BuyOrderPhotosProps {
  currentUser: User;
}

export const BuyOrderPhotos: React.FC<BuyOrderPhotosProps> = ({ currentUser }) => {
  const isAdmin   = String(currentUser?.role || '').toUpperCase() === 'ADMIN';
  const isGerente = String(currentUser?.role || '').toUpperCase() === 'MANAGER';

  const [pedidos, setPedidos] = useState<BuyOrder[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState<string>('');
  const [pedidoSelecionado, setPedidoSelecionado] = useState<BuyOrder | null>(null);
  
  const [itens, setItens] = useState<BuyOrderItem[]>([]);
  const [fotoMap, setFotoMap] = useState<Map<string, string>>(new Map());
  const [loadingOrders, setLoadingOrders] = useState<boolean>(true);
  const [loadingItems, setLoadingItems] = useState<boolean>(false);
  const [uploadingIds, setUploadingIds] = useState<Record<string, boolean>>({});

  const [searchTerm, setSearchTerm] = useState('');
  const [matchedByReferencia, setMatchedByReferencia] = useState<string[]>([]);
  const [searchingReferencia, setSearchingReferencia] = useState(false);
  const [highlightReference, setHighlightReference] = useState<string>('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const suggestionsContainerRef = useRef<HTMLDivElement>(null);

  // Número da loja do gerente (ex: "50")
  const [storeNumber, setStoreNumber] = useState<string | null>(null);

  // Busca por referência — independente de pedido selecionado
  const [refSearchTerm, setRefSearchTerm]       = useState('');
  const [refSearchResults, setRefSearchResults] = useState<any[]>([]);
  const [refSearchLoading, setRefSearchLoading] = useState(false);
  const [refSearchDone, setRefSearchDone]       = useState(false);

  const getPedidoLabel = (p: BuyOrder) => {
    return `#${p.numero_pedido || 'S/N'} - ${p.marca || p.fornecedor || 'Sem Fornecedor'}`;
  };

  const getPedidoLabelFull = (p: BuyOrder) => {
    const numero = p.numero_pedido || 'S/N';
    const marca = p.marca || '';
    const forn = p.fornecedor || '';
    if (marca && forn && marca.toLowerCase() !== forn.toLowerCase()) {
      return `#${numero} - ${marca} · ${forn}`;
    }
    return `#${numero} - ${marca || forn || 'Sem Fornecedor'}`;
  };

  // Click outside listener to close search suggestions
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        suggestionsContainerRef.current && 
        !suggestionsContainerRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Async search for references when standard search yields no matches
  useEffect(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term || term.length < 2) {
      setMatchedByReferencia([]);
      return;
    }

    // Check if there are matches in standard fields (numero_pedido, fornecedor, marca)
    const hasStandardMatches = pedidos.some(p => {
      const numStr = p.numero_pedido ? String(p.numero_pedido) : '';
      const fornStr = (p.fornecedor || '').toLowerCase();
      const brandStr = (p.marca || '').toLowerCase();
      return numStr.includes(term) || fornStr.includes(term) || brandStr.includes(term);
    });

    if (hasStandardMatches) {
      setMatchedByReferencia([]);
      return;
    }

    let active = true;
    const fetchMatches = async () => {
      setSearchingReferencia(true);
      try {
        const { data: itemMatches } = await supabase
          .from('buy_order_items')
          .select('order_id')
          .ilike('referencia', `%${term}%`);

        if (active && itemMatches && itemMatches.length > 0) {
          const matchedOrderIds = [...new Set(itemMatches.map(m => m.order_id))];
          setMatchedByReferencia(matchedOrderIds);
        } else if (active) {
          setMatchedByReferencia([]);
        }
      } catch (err) {
        console.error('Erro ao buscar referências:', err);
      } finally {
        if (active) setSearchingReferencia(false);
      }
    };

    const handler = setTimeout(() => {
      fetchMatches();
    }, 300);

    return () => {
      active = false;
      clearTimeout(handler);
    };
  }, [searchTerm, pedidos]);

  // Scroll and highlight effect for matched reference
  useEffect(() => {
    if (highlightReference && itens.length > 0) {
      const lowerRef = highlightReference.toLowerCase();
      const matchedItem = itens.find(i => (i.referencia || '').toLowerCase().includes(lowerRef));
      if (matchedItem) {
        const timer = setTimeout(() => {
          const element = document.getElementById(`card-${matchedItem.id}`);
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            element.classList.add('ring-4', 'ring-indigo-500', 'bg-indigo-50/50', 'dark:bg-indigo-950/25', 'scale-[1.02]', 'z-10');
            // Remove highlight after a few seconds
            setTimeout(() => {
              element.classList.remove('ring-4', 'ring-indigo-500', 'bg-indigo-50/50', 'dark:bg-indigo-950/25', 'scale-[1.02]', 'z-10');
            }, 5000);
          }
        }, 300);
        return () => clearTimeout(timer);
      }
    }
  }, [itens, highlightReference]);

  const filteredPedidos = React.useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) return pedidos.slice(0, 10); // Show top 10 if nothing typed
    
    const stdFiltered = pedidos.filter((p) => {
      const numStr = p.numero_pedido ? String(p.numero_pedido) : '';
      const fornStr = (p.fornecedor || '').toLowerCase();
      const brandStr = (p.marca || '').toLowerCase();
      return numStr.includes(term) || fornStr.includes(term) || brandStr.includes(term);
    });

    if (stdFiltered.length > 0) {
      return stdFiltered.slice(0, 10);
    }

    if (matchedByReferencia.length > 0) {
      return pedidos
        .filter(p => matchedByReferencia.includes(p.id))
        .slice(0, 10);
    }

    return [];
  }, [pedidos, searchTerm, matchedByReferencia]);

  const handleKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const term = searchTerm.trim();
      if (!term) return;

      if (/^\d+$/.test(term)) {
        const exactMatch = pedidos.find(p => String(p.numero_pedido) === term);
        if (exactMatch) {
          setSelectedOrderId(exactMatch.id);
          setShowSuggestions(false);
          setSearchTerm('');
          setHighlightReference('');
          return;
        }
      }

      setLoadingItems(true);
      try {
        const { data: itemMatches } = await supabase
          .from('buy_order_items')
          .select('order_id')
          .ilike('referencia', `%${term}%`)
          .limit(1);

        if (itemMatches && itemMatches.length > 0) {
          const matchedOrderId = itemMatches[0].order_id;
          setSelectedOrderId(matchedOrderId);
          setHighlightReference(term);
          setShowSuggestions(false);
          setSearchTerm('');
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingItems(false);
      }
    }
  };

  // Refs dynamically managed per item for camera and upload
  const cameraInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    if (isGerente && currentUser?.storeId) {
      fetchStoreNumber();
    }
  }, []);

  const fetchStoreNumber = async () => {
    try {
      const { data } = await supabase
        .from('stores')
        .select('number')
        .eq('id', currentUser.storeId)
        .single();
      if (data?.number) setStoreNumber(data.number);
    } catch (err) {
      console.error('Erro ao buscar número da loja:', err);
    }
  };

  // Fetch orders
  const loadOrders = async () => {
    setLoadingOrders(true);
    try {
      let orderIds: string[] | null = null;

      // GERENTE: filtrar apenas pedidos que contêm a loja dele
      if (isGerente && storeNumber) {
        const numericStore = parseInt(storeNumber, 10);
        const { data: subOrders } = await supabase
          .from('buy_order_sub_orders')
          .select('order_id')
          .contains('lojas_numeros', [numericStore]);

        orderIds = [...new Set((subOrders || []).map((s: any) => s.order_id))];

        if (orderIds.length === 0) {
          setPedidos([]);
          setLoadingOrders(false);
          return;
        }
      }

      // Montar query base
      let query = supabase
        .from('buy_orders')
        .select('id, numero_pedido, fornecedor, marca, status, buy_order_items(id)')
        .in('status', ['confirmado', 'stand_by', 'rascunho', 'exportado'])
        .order('numero_pedido', { ascending: false });

      // Aplicar filtro de IDs apenas para gerente
      if (isGerente && orderIds) {
        query = query.in('id', orderIds);
      }

      const { data, error } = await query;
      if (error) throw error;

      const formatted = (data || []).map((o: any) => ({
        id: o.id,
        numero_pedido: o.numero_pedido,
        fornecedor: o.fornecedor,
        marca: o.marca,
        status: o.status,
        item_count: o.buy_order_items ? o.buy_order_items.length : 0,
      }));

      setPedidos(formatted);
      if (formatted.length > 0) {
        setSelectedOrderId(formatted[0].id);
      }
    } catch (err) {
      console.error('Erro ao buscar pedidos:', err);
    } finally {
      setLoadingOrders(false);
    }
  };

  useEffect(() => {
    // Admin: carrega imediatamente
    // Gerente: aguarda storeNumber ser resolvido
    if (isAdmin) {
      loadOrders();
    } else if (isGerente && storeNumber !== null) {
      loadOrders();
    }
  }, [storeNumber]);

  const searchByReference = async () => {
    const term = refSearchTerm.trim();
    if (!term || term.length < 2) return;

    setRefSearchLoading(true);
    setRefSearchDone(false);
    try {
      const { data, error } = await supabase
        .from('product_catalog')
        .select('referencia, marca, cor1, tipo, modelo, image_url')
        .ilike('referencia', `%${term}%`)
        .order('referencia', { ascending: true })
        .limit(24);

      if (error) throw error;
      setRefSearchResults(data || []);
      setRefSearchDone(true);
    } catch (err) {
      console.error('Erro na busca por referência:', err);
    } finally {
      setRefSearchLoading(false);
    }
  };

  const clearRefSearch = () => {
    setRefSearchTerm('');
    setRefSearchResults([]);
    setRefSearchDone(false);
  };

  // Fetch items for specific order
  const loadItemsAndCatalog = async (orderId: string) => {
    if (!orderId) return;
    setLoadingItems(true);
    try {
      const orderObj = pedidos.find(p => p.id === orderId) || null;
      setPedidoSelecionado(orderObj);

      // Load items
      const { data: itemsData, error: itemsError } = await supabase
        .from('buy_order_items')
        .select('id, referencia, tipo, modelo, cor1, cor2, cor3, custo, preco_venda')
        .eq('order_id', orderId)
        .order('referencia');

      if (itemsError) throw itemsError;

      const orderItems = itemsData || [];
      setItens(orderItems);

      // Load catalog image_urls
      const references = orderItems.map(i => i.referencia).filter(Boolean);
      if (references.length > 0) {
        const { data: fotosData, error: fotosError } = await supabase
          .from('product_catalog')
          .select('referencia, image_url, cor1, marca')
          .in('referencia', references);

        if (fotosError) throw fotosError;

        const newFotoMap = new Map<string, string>();
        (fotosData || []).forEach(f => {
          if (f.image_url) {
            newFotoMap.set(`${f.referencia}_${f.cor1 || ''}`, f.image_url);
            newFotoMap.set(f.referencia, f.image_url); // Fallback reference matching
          }
        });
        setFotoMap(newFotoMap);
      } else {
        setFotoMap(new Map());
      }
    } catch (err) {
      console.error('Erro ao buscar itens:', err);
    } finally {
      setLoadingItems(false);
    }
  };

  useEffect(() => {
    if (selectedOrderId) {
      loadItemsAndCatalog(selectedOrderId);
    } else {
      setItens([]);
      setPedidoSelecionado(null);
    }
  }, [selectedOrderId, pedidos]);

  // Handle Photo input (Cam or File)
  const handlePhotoUpload = async (file: File, item: BuyOrderItem) => {
    if (!file || !pedidoSelecionado) return;

    // Loading status
    setUploadingIds(prev => ({ ...prev, [item.id]: true }));

    try {
      // 1. Prepare file WebP resize
      const resizedBlob = await resizeImage(file, 800);
      const convertedFile = new File([resizedBlob], `${item.referencia}.webp`, { type: 'image/webp' });

      const brandSlug = sanitizeSlug(pedidoSelecionado.marca || pedidoSelecionado.fornecedor || 'sem-marca');
      const corSlug = sanitizeSlug(item.cor1 || 'sem-cor');
      const fileName = `${item.referencia}_${corSlug}.webp`;
      const filePath = `catalogo/${brandSlug}/${fileName}`;

      // 2. Upload to Supabase Storage bucket 'Fotos'
      const { error: uploadError } = await supabase.storage
        .from('Fotos')
        .upload(filePath, convertedFile, {
          cacheControl: '3600',
          upsert: true,
          contentType: 'image/webp'
        });

      if (uploadError) throw new Error('Falha no upload para o Storage: ' + uploadError.message);

      // 3. Mount public URL
      const imageUrl = `https://rwwomakjhmglgoowbmsl.supabase.co/storage/v1/object/public/Fotos/${filePath}`;

      // 4. Upsert in product_catalog
      const { error: dbError } = await supabase
        .from('product_catalog')
        .upsert({
          referencia: item.referencia,
          marca: pedidoSelecionado.marca || pedidoSelecionado.fornecedor || '',
          tipo: item.tipo,
          modelo: item.modelo,
          cor1: item.cor1 || '',
          image_url: imageUrl
        }, {
          onConflict: 'marca,referencia,cor1'
        });

      if (dbError) throw new Error('Falha ao salvar no catálogo do banco: ' + dbError.message);

      // 5. Update local state
      const updatedFotoMap = new Map(fotoMap);
      updatedFotoMap.set(`${item.referencia}_${item.cor1 || ''}`, imageUrl);
      updatedFotoMap.set(item.referencia, imageUrl);
      setFotoMap(updatedFotoMap);

    } catch (err: any) {
      console.error(err);
      alert('Erro ao enviar foto: ' + err.message);
    } finally {
      setUploadingIds(prev => ({ ...prev, [item.id]: false }));
    }
  };

  const handleRemoverFoto = async (item: BuyOrderItem) => {
    if (!pedidoSelecionado) return;
    if (!confirm(`Remover foto do item Referência ${item.referencia}?`)) return;

    setUploadingIds(prev => ({ ...prev, [item.id]: true }));

    try {
      const brandSlug = sanitizeSlug(pedidoSelecionado.marca || pedidoSelecionado.fornecedor || 'sem-marca');
      const corSlug = sanitizeSlug(item.cor1 || 'sem-cor');
      const filePath = `catalogo/${brandSlug}/${item.referencia}_${corSlug}.webp`;

      // 1. Storage remove
      await supabase.storage.from('Fotos').remove([filePath]);

      // 2. Database update url = null
      const { error } = await supabase
        .from('product_catalog')
        .update({ image_url: null })
        .eq('referencia', item.referencia)
        .eq('marca', pedidoSelecionado.marca || pedidoSelecionado.fornecedor || '')
        .eq('cor1', item.cor1 || '');

      if (error) throw error;

      // 3. Update local state map
      const updatedFotoMap = new Map(fotoMap);
      updatedFotoMap.delete(`${item.referencia}_${item.cor1 || ''}`);
      
      // If none remains with this reference, remove fallback
      const stillHasFallback = Array.from(updatedFotoMap.keys()).some(k => k.startsWith(`${item.referencia}_`));
      if (!stillHasFallback) {
        updatedFotoMap.delete(item.referencia);
      }
      setFotoMap(updatedFotoMap);

    } catch (err: any) {
      console.error('Erro ao remover foto:', err);
      alert('Erro ao remover foto: ' + err.message);
    } finally {
      setUploadingIds(prev => ({ ...prev, [item.id]: false }));
    }
  };

  // Check which items have photo and sort (MISSING FIRST)
  const itemsWithPhotoCount = itens.filter(i => {
    const key = `${i.referencia}_${i.cor1 || ''}`;
    return fotoMap.has(key) || fotoMap.has(i.referencia);
  }).length;

  const totalItems = itens.length;
  const progressPercent = totalItems > 0 ? Math.round((itemsWithPhotoCount / totalItems) * 100) : 0;

  // Items sorted: missing photo first, then with photo
  const sortedItens = [...itens].sort((a, b) => {
    const aHas = fotoMap.has(`${a.referencia}_${a.cor1 || ''}`) || fotoMap.has(a.referencia);
    const bHas = fotoMap.has(`${b.referencia}_${b.cor1 || ''}`) || fotoMap.has(b.referencia);
    if (!aHas && bHas) return -1;
    if (aHas && !bHas) return 1;
    return a.referencia.localeCompare(b.referencia);
  });

  return (
    <div id="buy-order-photos-module" className="flex flex-col h-full bg-slate-50 dark:bg-slate-900 overflow-hidden">
      {/* HEADER SECTION */}
      <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0 shadow-sm">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-800 dark:text-white flex items-center gap-2">
            <Camera className="text-indigo-600 dark:text-indigo-400" size={24} />
            Fotos do Pedido
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Gerenciamento e vinculo de fotos rápidas dos itens dos pedidos de compra
          </p>
        </div>

        {/* Action controls / Autocomplete Search Input */}
        <div className="flex flex-col md:flex-row gap-4 w-full md:w-auto items-start md:items-start z-30">
          <div id="order-selector-container" className="flex flex-col gap-2 w-full md:w-80 relative select-none z-30">
            <div className="flex items-center gap-2 w-full">
              <span className="text-sm font-bold text-slate-600 dark:text-slate-300 shrink-0">
                Pedido:
              </span>
              {loadingOrders ? (
                <div className="flex items-center gap-2 text-sm text-slate-400">
                  <Loader2 className="animate-spin text-indigo-500" size={16} />
                  Buscando...
                </div>
              ) : (
                <div ref={suggestionsContainerRef} className="relative flex-1">
                  <input
                    type="text"
                    placeholder="Nº Pedido, Fornecedor/Marca ou Referência..."
                    className="w-full text-sm bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-white font-semibold py-2 px-3 pr-8 rounded-lg border border-slate-200 dark:border-slate-600 outline-none focus:ring-2 focus:ring-indigo-500 transition-all cursor-pointer"
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      setShowSuggestions(true);
                    }}
                    onFocus={() => setShowSuggestions(true)}
                    onKeyDown={handleKeyDown}
                  />
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 pointer-events-none">
                    🔍
                  </span>
                  
                  {/* Suggestions List */}
                  {showSuggestions && (
                    <div className="absolute left-0 right-0 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-2xl rounded-xl max-h-64 overflow-y-auto z-40 py-1 divide-y divide-slate-100 dark:divide-slate-700">
                      {filteredPedidos.length === 0 ? (
                        <div className="p-3 text-xs text-slate-400 text-center">
                          Nenhum pedido encontrado
                        </div>
                      ) : (
                        filteredPedidos.map(p => (
                          <div
                            key={p.id}
                            className={`p-2.5 hover:bg-slate-100 dark:hover:bg-slate-700/50 cursor-pointer transition-colors flex items-center justify-between text-xs font-semibold ${
                              p.id === selectedOrderId ? 'bg-indigo-50/70 dark:bg-indigo-950/20 text-indigo-700 dark:text-indigo-400' : 'text-slate-700 dark:text-slate-200'
                            }`}
                            onClick={() => {
                              setSelectedOrderId(p.id);
                              setShowSuggestions(false);
                              if (searchTerm.trim()) {
                                setHighlightReference(searchTerm.trim());
                              }
                              setSearchTerm('');
                            }}
                          >
                            <div className="flex flex-col text-left mr-2 min-w-0">
                              <span className="truncate">
                                {getPedidoLabelFull(p)}
                              </span>
                            </div>
                            <span className="bg-slate-200/60 dark:bg-slate-700/60 text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded-full text-[9px] font-bold shrink-0">
                              {p.item_count} itens
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
            
            {/* Badge indicator representing the current selected order, visible below the search */}
            {pedidoSelecionado && (
              <div className="flex items-center gap-1.5 self-start bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/40 text-indigo-700 dark:text-indigo-300 px-2.5 py-1 rounded-full text-[11px] font-bold shadow-xs">
                <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-pulse" />
                <span className="truncate max-w-[260px]" title={getPedidoLabel(pedidoSelecionado)}>
                  Ativo: <strong>#{pedidoSelecionado.numero_pedido || 'S/N'}</strong> - {pedidoSelecionado.marca || pedidoSelecionado.fornecedor || 'Sem Fornecedor'}
                </span>
              </div>
            )}
          </div>

          {/* ── Busca por Referência ── */}
          <div className="flex flex-col gap-1 w-full md:w-80">
            <span className="text-sm font-bold text-slate-600 dark:text-slate-300">
              Referência:
              <span className="text-[10px] font-normal text-slate-400 ml-1">(busca global no catálogo)</span>
            </span>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  placeholder="Ex: CE356, KV881..."
                  className="w-full text-sm bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-white font-semibold py-2 px-3 pr-8 rounded-lg border border-slate-200 dark:border-slate-600 outline-none focus:ring-2 focus:ring-indigo-500 transition-all cursor-pointer"
                  value={refSearchTerm}
                  onChange={(e) => setRefSearchTerm(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') searchByReference(); }}
                />
                {refSearchTerm && (
                  <button
                    onClick={clearRefSearch}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    ✕
                  </button>
                )}
              </div>
              <button
                onClick={searchByReference}
                disabled={refSearchLoading || refSearchTerm.trim().length < 2}
                className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white rounded-lg text-xs font-bold flex items-center gap-1 transition-all"
              >
                {refSearchLoading
                  ? <Loader2 size={14} className="animate-spin" />
                  : '🔍'}
              </button>
            </div>

            {/* Badge da loja — exibido apenas para gerente */}
            {isGerente && storeNumber && (
              <div className="flex items-center gap-1.5 self-start bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400 px-2.5 py-1 rounded-full text-[10px] font-bold">
                🏪 Loja {storeNumber} — Modo Gerente
              </div>
            )}
          </div>
        </div>
      </header>

      {/* CONTENT & GRID VIEW */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Resultados da busca por referência */}
        {refSearchDone && (
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-black uppercase text-slate-600 dark:text-slate-300 tracking-widest">
                Resultado para "{refSearchTerm.trim()}" — {refSearchResults.length} {refSearchResults.length === 1 ? 'item encontrado' : 'itens encontrados'} no catálogo
              </span>
              <button
                onClick={clearRefSearch}
                className="text-[10px] text-slate-400 hover:text-red-500 font-bold uppercase transition-colors"
              >
                ✕ Limpar busca
              </button>
            </div>

            {refSearchResults.length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                <Camera size={32} className="mx-auto mb-2 opacity-30" />
                <p className="text-xs font-semibold">Nenhuma foto cadastrada para esta referência no catálogo.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {refSearchResults.map((item, idx) => (
                  <div key={idx} className="flex flex-col bg-slate-50 dark:bg-slate-900 rounded-xl p-2 border border-slate-200 dark:border-slate-700">
                    <div className="aspect-square w-full rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-700 mb-2 flex items-center justify-center">
                      {item.image_url ? (
                        <img
                          src={item.image_url}
                          alt={item.referencia}
                          className="w-full h-full object-contain"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="flex flex-col items-center text-slate-300">
                          <Camera size={24} strokeWidth={1.5} />
                          <span className="text-[8px] mt-1 uppercase font-bold">Sem foto</span>
                        </div>
                      )}
                    </div>
                    <span className="text-[10px] font-black text-slate-800 dark:text-slate-100 select-all">
                      {item.referencia}
                    </span>
                    <span className="text-[9px] text-slate-500 dark:text-slate-400 truncate">{item.marca}</span>
                    <span className="text-[9px] text-slate-400 dark:text-slate-500 uppercase truncate">COR: {item.cor1 || '—'}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {!selectedOrderId ? (
          <div className="flex flex-col items-center justify-center p-12 bg-white dark:bg-slate-800 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 shadow-md max-w-sm mx-auto mt-12 text-center">
            <Camera className="w-12 h-12 text-slate-300 mb-3 animate-pulse" />
            <h3 className="text-base font-bold text-slate-700 dark:text-slate-200">Nenhum Pedido Selecionado</h3>
            <p className="text-xs text-slate-400 mt-1">Selecione um pedido ativo na barra superior para vincular fotos aos seus itens.</p>
          </div>
        ) : loadingItems ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 className="animate-spin text-indigo-500 w-10 h-10" />
            <span className="text-xs font-semibold text-slate-400">Buscando itens do pedido...</span>
          </div>
        ) : (
          <>
            {/* PROGRESS BAR */}
            <div id="photo-progress-card" className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col gap-3">
              <div className="flex justify-between items-center text-xs md:text-sm font-semibold text-slate-700 dark:text-slate-200">
                <span className="flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-green-500" />
                  Fotos Vinculadas no Catálogo
                </span>
                <span className="bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded-full text-xs font-bold">
                  {itemsWithPhotoCount} de {totalItems} ({progressPercent}%)
                </span>
              </div>
              <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-3.5 overflow-hidden border border-slate-200/50 dark:border-slate-650">
                <div
                  className="bg-indigo-600 h-full rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>

            {/* ERROR HANDLER / EMPTY ITEMS DISPLAY */}
            {itens.length === 0 ? (
              <div className="p-12 text-center bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                <p className="text-sm font-medium text-slate-500">Este pedido não possui itens cadastrados.</p>
              </div>
            ) : (
              /* GRID VIEW OF CARDS */
              <div id="buy-order-photos-grid" className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {sortedItens.map((item) => {
                  const key = `${item.referencia}_${item.cor1 || ''}`;
                  const fotoUrl = fotoMap.get(key) || fotoMap.get(item.referencia);
                  const isUploading = uploadingIds[item.id] || false;

                  return (
                    <div
                      key={item.id}
                      id={`card-${item.id}`}
                      className={`relative flex flex-col justify-between bg-white dark:bg-slate-800 rounded-xl p-3 transition-all duration-200 hover:shadow-lg select-none ${
                        fotoUrl
                          ? 'border border-solid border-slate-200 dark:border-slate-700'
                          : 'border-2 border-dashed border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40'
                      }`}
                    >
                      {/* CARD COVER / HOLDER */}
                      <div className="relative aspect-square w-full rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 mb-3 flex items-center justify-center">
                        {isUploading ? (
                          <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 dark:bg-slate-800/80 z-10">
                            <Loader2 className="animate-spin text-indigo-500 text-3xl mb-1" size={24} />
                            <span className="text-[10px] font-black uppercase text-indigo-600 dark:text-indigo-400">Enviando...</span>
                          </div>
                        ) : null}

                        {fotoUrl ? (
                          <img
                            src={fotoUrl}
                            alt={`Referência ${item.referencia}`}
                            className="w-full h-full object-contain hover:scale-105 transition-transform"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="text-center flex flex-col items-center p-2 text-slate-400 dark:text-slate-500">
                            <Camera size={28} strokeWidth={1.5} />
                            <span className="text-[9px] font-bold tracking-wider mt-1.5 uppercase">Falta Foto</span>
                          </div>
                        )}
                      </div>

                      {/* CARD DETAILS */}
                      <div className="space-y-1 mb-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-black tracking-semibold text-slate-800 dark:text-slate-100 select-all">
                            Ref: {item.referencia || '—'}
                          </span>
                          <span className="text-[8px] bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 px-1.5 py-0.5 font-bold uppercase rounded">
                            {item.modelo || 'OUT'}
                          </span>
                        </div>
                        <p className="text-[10px] font-medium text-slate-600 dark:text-slate-300 truncate" title={item.tipo}>
                          {item.tipo || 'TIPO NÃO DEFINIDO'}
                        </p>
                        <div className="flex items-center justify-between text-[10px] font-bold">
                          <span className="text-slate-400 dark:text-slate-500 uppercase truncate max-w-[60%]" title={item.cor1}>
                            COR: {item.cor1 || '—'}
                          </span>
                          <span className="text-emerald-700 dark:text-emerald-400 font-extrabold select-all shrink-0">
                            R$ {Number(item.preco_venda || 0).toFixed(2).replace('.', ',')}
                          </span>
                        </div>
                      </div>

                      {/* BOTÕES DE AÇÃO / UPLOAD */}
                      <div className="flex flex-col gap-1.5">
                        {/* Hidden native input files custom refs */}
                        <input
                          type="file"
                          accept="image/*"
                          capture="environment"
                          style={{ display: 'none' }}
                          onChange={(e) => {
                            const specFile = e.target.files?.[0];
                            if (specFile) handlePhotoUpload(specFile, item);
                          }}
                          ref={(el) => { cameraInputRefs.current[item.id] = el; }}
                        />
                        <input
                          type="file"
                          accept="image/*"
                          style={{ display: 'none' }}
                          onChange={(e) => {
                            const specFile = e.target.files?.[0];
                            if (specFile) handlePhotoUpload(specFile, item);
                          }}
                          ref={(el) => { fileInputRefs.current[item.id] = el; }}
                        />

                        {/* Native upload action buttons */}
                        <div className="grid grid-cols-2 gap-1">
                          <button
                            type="button"
                            title="Tirar foto com câmera"
                            onClick={() => cameraInputRefs.current[item.id]?.click()}
                            disabled={isUploading}
                            className="p-1.5 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-900/50 dark:hover:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 rounded-lg text-[9px] font-black uppercase tracking-wider flex items-center justify-center gap-1 transition-all cursor-pointer hover:shadow-sm"
                          >
                            <Camera size={11} />
                            Câmera
                          </button>
                          <button
                            type="button"
                            title="Escolher arquivo local"
                            onClick={() => fileInputRefs.current[item.id]?.click()}
                            disabled={isUploading}
                            className="p-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-lg text-[9px] font-black uppercase tracking-wider flex items-center justify-center gap-1 transition-all cursor-pointer hover:shadow-sm"
                          >
                            <Upload size={11} />
                            Upload
                          </button>
                        </div>

                        {fotoUrl ? (
                          <button
                            type="button"
                            onClick={() => handleRemoverFoto(item)}
                            disabled={isUploading}
                            className="w-full py-1 bg-red-50 hover:bg-red-100 text-red-600 dark:bg-red-950/20 dark:hover:bg-red-950/40 dark:text-red-400 rounded-lg text-[8px] font-bold uppercase transition-all tracking-widest flex items-center justify-center gap-1 cursor-pointer"
                          >
                            <Trash2 size={10} />
                            Remover Foto
                          </button>
                        ) : null}
                      </div>

                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
