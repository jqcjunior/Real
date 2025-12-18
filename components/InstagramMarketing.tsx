
import React, { useState, useRef, useEffect } from 'react';
import { User, Store } from '../types';
import { Upload, Instagram, Download, Type, Image as ImageIcon, DollarSign, LayoutTemplate, Layers, Palette, RefreshCw, Sliders, Move, Sun, Contrast, Droplet, MoveHorizontal, MoveVertical, MousePointer2, Stamp, Globe, Shuffle, ChevronLeft, ChevronRight, Copy, Hexagon, Circle, Square, Star, ZoomIn, Hand, MousePointerClick, PaintBucket, Wand2, History, Save, Check, Loader2 } from 'lucide-react';
import { generateMarketingImage } from '../services/geminiService';
import { supabase } from '../services/supabaseClient';
import { LOGO_URL } from '../constants';

interface InstagramMarketingProps {
  user: User;
  store?: Store;
}

type AspectRatio = '1:1' | '9:16';
type Mode = 'standard' | 'promo';
type BackgroundStyle = 'blur' | 'brand' | 'white' | 'dark' | 'abs1' | 'abs2' | 'abs3' | 'abs4' | 'art1' | 'art2' | 'art3' | 'art4' | 'web';
type FormatType = 'single' | 'carousel';
type RibbonShape = 'classic' | 'modern' | 'minimal';
type BadgeShape = 'circle' | 'burst' | 'tag';

const WEB_BACKGROUNDS = [
    "https://images.unsplash.com/photo-1550684848-fac1c5b4e853?q=80&w=1080&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1579546929518-9e396f3cc809?q=80&w=1080&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1558591710-4b4a1ae0f04d?q=80&w=1080&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1541701494587-cb58502866ab?q=80&w=1080&auto=format&fit=crop"
];

const PROMO_FONTS = ['Arial Black', 'Impact', 'Montserrat', 'Oswald', 'Roboto', 'Poppins', 'Playfair Display'];

const PROMO_COLORS = [
    { name: 'Amarelo', from: '#fef08a', to: '#eab308', text: '#1e3a8a' },
    { name: 'Vermelho', from: '#ef4444', to: '#991b1b', text: 'white' },
    { name: 'Azul', from: '#3b82f6', to: '#1e3a8a', text: 'white' },
    { name: 'Preto', from: '#374151', to: '#111827', text: 'white' }
];

const InstagramMarketing: React.FC<InstagramMarketingProps> = ({ user, store }) => {
  const [activeView, setActiveView] = useState<'editor' | 'gallery'>('editor');
  const [galleryItems, setGalleryItems] = useState<any[]>([]);
  const [isGalleryLoading, setIsGalleryLoading] = useState(false);

  const [formatType, setFormatType] = useState<FormatType>('single');
  const [carouselPreviews, setCarouselPreviews] = useState<string[]>([]);
  const [activeCarouselIndex, setActiveCarouselIndex] = useState(0);

  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [isAiGenerating, setIsAiGenerating] = useState(false);
  
  const [watermarkPreview, setWatermarkPreview] = useState<string | null>(null);
  const [wmScale, setWmScale] = useState(100);
  const [wmOpacity, setWmOpacity] = useState(100);
  const [wmPos, setWmPos] = useState({ x: 50, y: 90 });

  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('1:1');
  const [mode, setMode] = useState<Mode>('standard');
  const [bgStyle, setBgStyle] = useState<BackgroundStyle>('blur');
  const [webBgUrl, setWebBgUrl] = useState<string>(WEB_BACKGROUNDS[0]);

  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [saturation, setSaturation] = useState(100);
  const [scale, setScale] = useState(100);
  const [imgPosX, setImgPosX] = useState(0); 
  const [imgPosY, setImgPosY] = useState(0); 

  const [promoName, setPromoName] = useState('OFERTA EXCLUSIVA');
  const [callToAction, setCallToAction] = useState('POR APENAS');
  const [priceOriginal, setPriceOriginal] = useState('');
  const [pricePromo, setPricePromo] = useState('');
  
  const [activeFontIndex, setActiveFontIndex] = useState(0);
  const [activeColorIndex, setActiveColorIndex] = useState(0);
  const [ribbonShape, setRibbonShape] = useState<RibbonShape>('classic');
  const [badgeShape, setBadgeShape] = useState<BadgeShape>('circle');
  const [ribbonPos, setRibbonPos] = useState({ x: 50, y: 15 });
  const [ribbonScale, setRibbonScale] = useState(100);
  const [badgePos, setBadgePos] = useState({ x: 80, y: 80 });
  const [badgeScale, setBadgeScale] = useState(100);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const productImgRef = useRef<HTMLImageElement | null>(null);
  const logoImgRef = useRef<HTMLImageElement | null>(null);
  const webBgRef = useRef<HTMLImageElement | null>(null);
  const [isDragging, setIsDragging] = useState<string | null>(null);
  const lastMousePos = useRef<{x: number, y: number} | null>(null);

  const fetchGallery = async () => {
      setIsGalleryLoading(true);
      const { data } = await supabase.from('marketing_materials').select('*').order('created_at', { ascending: false });
      if (data) setGalleryItems(data);
      setIsGalleryLoading(false);
  };

  useEffect(() => {
      if (activeView === 'gallery') fetchGallery();
  }, [activeView]);

  const handleAiGenerate = async () => {
    if (!imagePreview) {
        alert("Envie uma foto do produto primeiro!");
        return;
    }
    
    // Check if API Key is selected
    const hasKey = await (window as any).aistudio.hasSelectedApiKey();
    if (!hasKey) {
        await (window as any).aistudio.openSelectKey();
    }

    setIsAiGenerating(true);
    try {
        const base64 = imagePreview.split(',')[1];
        const result = await generateMarketingImage(base64, 'image/png', aspectRatio, mode === 'promo' ? 'promo' : 'lifestyle');
        if (result) {
            const dataUrl = `data:image/png;base64,${result}`;
            setImagePreview(dataUrl);
            setBgStyle('white'); // Clear background style as AI already provides one
            alert("Cenário gerado com sucesso pela IA!");
        }
    } catch (e) {
        alert("Erro na geração por IA. Tente novamente.");
    } finally {
        setIsAiGenerating(false);
    }
  };

  const handleSaveToGallery = async () => {
      const dataUrl = await composeFinalImage(undefined, true);
      if (!dataUrl) return;

      setIsAiGenerating(true); // Reusing loader
      try {
          const { error } = await supabase.from('marketing_materials').insert({
              title: promoName || 'Nova Arte',
              description: `Arte de ${mode === 'promo' ? 'Promoção' : 'Institucional'} - Loja ${store?.number || 'Geral'}`,
              image_url: dataUrl,
              store_id: store?.id,
              created_by: user.id
          });
          if (!error) alert("Salvo na Galeria Corporativa!");
      } catch (e) {
          alert("Erro ao salvar.");
      } finally {
          setIsAiGenerating(false);
      }
  };

  useEffect(() => {
    if (imagePreview) {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.src = imagePreview;
        img.onload = () => {
            productImgRef.current = img;
            composeFinalImage(undefined, false);
        };
    }
  }, [imagePreview]);

  useEffect(() => {
      const src = watermarkPreview || LOGO_URL;
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = src;
      img.onload = () => {
          logoImgRef.current = img;
          composeFinalImage(undefined, false);
      };
  }, [watermarkPreview]);

  useEffect(() => {
    composeFinalImage(undefined, false);
  }, [aspectRatio, mode, bgStyle, webBgUrl, brightness, contrast, saturation, scale, imgPosX, imgPosY, wmScale, wmOpacity, wmPos, promoName, callToAction, priceOriginal, pricePromo, activeFontIndex, activeColorIndex, ribbonShape, badgeShape, ribbonPos, badgePos, ribbonScale, badgeScale]);

  const composeFinalImage = async (overrideImageSrc?: string, cleanMode: boolean = false): Promise<string | null> => {
      const canvas = canvasRef.current;
      if (!canvas) return null;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;

      const width = 1080;
      const height = aspectRatio === '1:1' ? 1080 : 1920;
      canvas.width = width;
      canvas.height = height;

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);

      // Backgrounds... (Simplified for brevity, kept essential ones)
      if (bgStyle === 'blur' && productImgRef.current) {
          ctx.save();
          ctx.filter = `blur(50px) brightness(60%)`;
          ctx.drawImage(productImgRef.current, -100, -100, width + 200, height + 200);
          ctx.restore();
      } else if (bgStyle === 'brand') {
          const grd = ctx.createLinearGradient(0, 0, width, height);
          grd.addColorStop(0, '#0f172a'); grd.addColorStop(1, '#1e3a8a');
          ctx.fillStyle = grd;
          ctx.fillRect(0, 0, width, height);
      }

      // Product
      if (productImgRef.current) {
          ctx.save();
          const pImg = productImgRef.current;
          const zoom = scale / 100;
          const drawW = (width * 0.8) * zoom;
          const drawH = (pImg.height / pImg.width) * drawW;
          const dX = (width - drawW) / 2 + (imgPosX / 100) * width;
          const dY = (height - drawH) / 2 + (imgPosY / 100) * height;
          ctx.filter = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%) drop-shadow(0px 30px 40px rgba(0,0,0,0.5))`;
          ctx.drawImage(pImg, dX, dY, drawW, drawH);
          ctx.restore();
      }

      // Logo
      if (logoImgRef.current) {
          ctx.save();
          const lImg = logoImgRef.current;
          const lScale = wmScale / 100;
          const lW = 350 * lScale;
          const lH = (lImg.height / lImg.width) * lW;
          ctx.globalAlpha = wmOpacity / 100;
          ctx.drawImage(lImg, (wmPos.x / 100) * width - lW/2, (wmPos.y / 100) * height - lH/2, lW, lH);
          ctx.restore();
      }

      // Overlays
      if (mode === 'promo') {
          const color = PROMO_COLORS[activeColorIndex];
          const font = PROMO_FONTS[activeFontIndex];
          
          if (promoName) {
              ctx.save();
              ctx.translate((ribbonPos.x / 100) * width, (ribbonPos.y / 100) * height);
              ctx.scale(ribbonScale/100, ribbonScale/100);
              ctx.fillStyle = color.to;
              ctx.fillRect(-width*0.4, -50, width*0.8, 100);
              ctx.fillStyle = color.text;
              ctx.font = `bold 60px ${font}`;
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.fillText(promoName.toUpperCase(), 0, 0);
              ctx.restore();
          }

          if (pricePromo) {
              ctx.save();
              ctx.translate((badgePos.x / 100) * width, (badgePos.y / 100) * height);
              ctx.scale(badgeScale/100, badgeScale/100);
              ctx.beginPath(); ctx.arc(0, 0, 150, 0, Math.PI*2);
              ctx.fillStyle = color.to; ctx.fill();
              ctx.fillStyle = '#fff'; ctx.font = `bold 40px ${font}`; ctx.textAlign = 'center';
              ctx.fillText(callToAction, 0, -40);
              ctx.font = `black 110px ${font}`;
              ctx.fillText(pricePromo, 0, 60);
              ctx.restore();
          }
      }

      const dataUrl = canvas.toDataURL('image/png');
      setGeneratedImage(dataUrl);
      return dataUrl;
  };

  const handleDownload = () => {
      const link = document.createElement('a');
      link.download = `arte_real_${Date.now()}.png`;
      link.href = generatedImage || '';
      link.click();
  };

  return (
    <div className="flex h-screen bg-gray-900 text-white overflow-hidden font-sans">
        
        {/* Sidebar Controls */}
        <div className="w-[450px] bg-gray-950 border-r border-white/5 p-8 flex flex-col gap-6 overflow-y-auto no-scrollbar">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-black italic uppercase tracking-tighter flex items-center gap-2">
                    <Wand2 className="text-red-600" /> Studio <span className="text-blue-500">Real</span>
                </h2>
                <div className="flex bg-white/5 p-1 rounded-xl">
                    <button onClick={() => setActiveView('editor')} className={`p-2 rounded-lg transition-all ${activeView === 'editor' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-500'}`}><PaintBucket size={18}/></button>
                    <button onClick={() => setActiveView('gallery')} className={`p-2 rounded-lg transition-all ${activeView === 'gallery' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-500'}`}><History size={18}/></button>
                </div>
            </div>

            {activeView === 'editor' ? (
                <>
                    <div className="space-y-4">
                        <label className="text-[10px] font-black uppercase text-gray-500 tracking-widest flex items-center gap-2">
                            <ImageIcon size={14}/> 1. Foto Base
                        </label>
                        <div 
                            onClick={() => document.getElementById('main-upload')?.click()}
                            className="border-2 border-dashed border-white/10 rounded-3xl h-48 flex flex-col items-center justify-center cursor-pointer hover:border-blue-500 hover:bg-blue-500/5 transition-all group overflow-hidden"
                        >
                            {imagePreview ? (
                                <img src={imagePreview} className="w-full h-full object-contain" />
                            ) : (
                                <>
                                    <Upload size={32} className="text-gray-600 group-hover:text-blue-500 mb-2" />
                                    <span className="text-xs font-bold text-gray-500">Enviar foto do calçado</span>
                                </>
                            )}
                            <input id="main-upload" type="file" hidden onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                    const r = new FileReader();
                                    r.onload = () => setImagePreview(r.result as string);
                                    r.readAsDataURL(file);
                                }
                            }} />
                        </div>
                        {imagePreview && (
                            <button 
                                onClick={handleAiGenerate}
                                disabled={isAiGenerating}
                                className="w-full py-4 bg-gradient-to-r from-purple-600 to-blue-600 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50"
                            >
                                {isAiGenerating ? <Loader2 size={16} className="animate-spin" /> : <Wand2 size={16} />}
                                Gerar Cenário Publicitário por IA
                            </button>
                        )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase text-gray-500 tracking-widest">Dimensão</label>
                            <div className="flex bg-white/5 p-1 rounded-xl">
                                <button onClick={() => setAspectRatio('1:1')} className={`flex-1 py-2 text-[10px] font-black rounded-lg ${aspectRatio === '1:1' ? 'bg-white text-black' : 'text-gray-500'}`}>FEED</button>
                                <button onClick={() => setAspectRatio('9:16')} className={`flex-1 py-2 text-[10px] font-black rounded-lg ${aspectRatio === '9:16' ? 'bg-white text-black' : 'text-gray-500'}`}>STORY</button>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase text-gray-500 tracking-widest">Estilo</label>
                            <div className="flex bg-white/5 p-1 rounded-xl">
                                <button onClick={() => setMode('standard')} className={`flex-1 py-2 text-[10px] font-black rounded-lg ${mode === 'standard' ? 'bg-white text-black' : 'text-gray-500'}`}>INST</button>
                                <button onClick={() => setMode('promo')} className={`flex-1 py-2 text-[10px] font-black rounded-lg ${mode === 'promo' ? 'bg-white text-black' : 'text-gray-500'}`}>PROMO</button>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                         <label className="text-[10px] font-black uppercase text-gray-500 tracking-widest">Fundo & Design</label>
                         <div className="grid grid-cols-5 gap-2">
                             {['blur', 'brand', 'white', 'dark', 'abs1'].map(s => (
                                 <button key={s} onClick={() => setBgStyle(s as any)} className={`h-10 rounded-lg border-2 ${bgStyle === s ? 'border-blue-500 bg-blue-500/20' : 'border-white/5 bg-white/5'}`}></button>
                             ))}
                         </div>
                    </div>

                    {mode === 'promo' && (
                        <div className="bg-white/5 p-6 rounded-[32px] space-y-4 border border-white/5">
                            <label className="text-[10px] font-black uppercase text-red-500 tracking-widest flex items-center gap-2"><DollarSign size={14}/> Detalhes da Oferta</label>
                            <input value={promoName} onChange={e => setPromoName(e.target.value)} placeholder="Título da Promoção" className="w-full bg-black/40 border-none rounded-xl p-3 text-sm font-bold focus:ring-2 focus:ring-red-500" />
                            <div className="grid grid-cols-2 gap-2">
                                <input value={pricePromo} onChange={e => setPricePromo(e.target.value)} placeholder="Preço (ex: 99,90)" className="w-full bg-black/40 border-none rounded-xl p-3 text-sm font-black text-green-400" />
                                <select onChange={e => setActiveColorIndex(parseInt(e.target.value))} className="w-full bg-black/40 border-none rounded-xl p-3 text-xs font-bold uppercase tracking-tight">
                                    {PROMO_COLORS.map((c, i) => <option key={c.name} value={i}>{c.name}</option>)}
                                </select>
                            </div>
                        </div>
                    )}
                </>
            ) : (
                <div className="space-y-4 flex-1 overflow-y-auto no-scrollbar">
                    {isGalleryLoading ? (
                        <div className="flex justify-center py-20"><Loader2 className="animate-spin text-blue-500" /></div>
                    ) : galleryItems.map(item => (
                        <div key={item.id} className="bg-white/5 rounded-2xl overflow-hidden border border-white/5 group">
                            <div className="aspect-square relative">
                                <img src={item.image_url} className="w-full h-full object-cover" />
                                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all">
                                    <button onClick={() => { setImagePreview(item.image_url); setActiveView('editor'); }} className="p-3 bg-blue-600 rounded-full text-white shadow-xl hover:scale-110 transition-transform"><PaintBucket size={20}/></button>
                                </div>
                            </div>
                            <div className="p-3">
                                <p className="text-[10px] font-black uppercase truncate">{item.title}</p>
                                <p className="text-[8px] text-gray-500 mt-1 uppercase">{new Date(item.created_at).toLocaleDateString()}</p>
                            </div>
                        </div>
                    ))}
                    {galleryItems.length === 0 && !isGalleryLoading && <p className="text-center text-gray-500 py-10 text-xs font-bold uppercase">Nenhuma arte salva</p>}
                </div>
            )}
        </div>

        {/* Viewport */}
        <div className="flex-1 bg-[#111] relative flex flex-col items-center justify-center p-12">
            <canvas ref={canvasRef} hidden />
            
            <div 
                ref={previewRef}
                className="bg-white shadow-[0_0_100px_rgba(0,0,0,0.5)] relative overflow-hidden"
                style={{ 
                    width: aspectRatio === '1:1' ? '500px' : '360px', 
                    height: aspectRatio === '1:1' ? '500px' : '640px' 
                }}
            >
                {generatedImage ? (
                    <img src={generatedImage} className="w-full h-full object-contain" />
                ) : (
                    <div className="flex flex-col items-center justify-center h-full text-gray-200">
                        <ImageIcon size={64} className="opacity-10 mb-4" />
                        <span className="text-[10px] font-black uppercase tracking-[0.3em] opacity-20">Aguardando Design</span>
                    </div>
                )}
            </div>

            <div className="mt-12 flex gap-4">
                <button 
                    onClick={handleDownload}
                    disabled={!generatedImage}
                    className="px-12 py-4 bg-white text-black rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl flex items-center gap-2 hover:bg-gray-200 transition-all active:scale-95 disabled:opacity-20"
                >
                    <Download size={18}/> Baixar Arte
                </button>
                <button 
                    onClick={handleSaveToGallery}
                    disabled={!generatedImage || isAiGenerating}
                    className="px-12 py-4 bg-blue-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl flex items-center gap-2 hover:bg-blue-700 transition-all active:scale-95 disabled:opacity-20"
                >
                    {isAiGenerating ? <Loader2 size={18} className="animate-spin"/> : <Save size={18}/>}
                    Salvar na Galeria
                </button>
            </div>
            
            {/* Context Helper */}
            <div className="absolute top-8 right-8 flex items-center gap-3 bg-black/40 px-4 py-2 rounded-full border border-white/5">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-[9px] font-black uppercase tracking-widest text-gray-400">Motor Gemini 3.0 Ativo</span>
            </div>
        </div>

    </div>
  );
};

export default InstagramMarketing;
