
import React, { useState, useRef, useEffect } from 'react';
import { User, Store } from '../types';
import { Upload, Instagram, Download, Type, Image as ImageIcon, DollarSign, LayoutTemplate, Layers, Palette, RefreshCw, Sliders, Move, Sun, Contrast, Droplet, MoveHorizontal, MoveVertical, MousePointer2, Stamp, Globe, Shuffle, ChevronLeft, ChevronRight, Copy, Hexagon, Circle, Square, Star, ZoomIn, Hand, MousePointerClick, PaintBucket } from 'lucide-react';

interface InstagramMarketingProps {
  user: User;
  store?: Store; // The store linked to the manager
  onRegisterDownload?: (details?: string) => string; // Function to trigger log and get ID
}

type AspectRatio = '1:1' | '9:16';
type Mode = 'standard' | 'promo';
type BackgroundStyle = 'blur' | 'brand' | 'white' | 'dark' | 'abs1' | 'abs2' | 'abs3' | 'abs4' | 'art1' | 'art2' | 'art3' | 'art4' | 'art5' | 'art6' | 'art7' | 'art8' | 'web';
type FormatType = 'single' | 'carousel';

type RibbonShape = 'classic' | 'modern' | 'minimal';
type BadgeShape = 'circle' | 'burst' | 'tag';

const WEB_BACKGROUNDS = [
    "https://images.unsplash.com/photo-1550684848-fac1c5b4e853?q=80&w=1080&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1579546929518-9e396f3cc809?q=80&w=1080&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1558591710-4b4a1ae0f04d?q=80&w=1080&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1541701494587-cb58502866ab?q=80&w=1080&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=1080&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1614850523459-c2f4c699c52e?q=80&w=1080&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1504333638930-c8787321eee0?q=80&w=1080&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1557683316-973673baf926?q=80&w=1080&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1604076913837-52ab5629fba9?q=80&w=1080&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?q=80&w=1080&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1634152962476-4b8a00e1915c?q=80&w=1080&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1507608869274-2e6660092212?q=80&w=1080&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1533090161767-e6ffed986c88?q=80&w=1080&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1563089145-599997674d42?q=80&w=1080&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?q=80&w=1080&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?q=80&w=1080&auto=format&fit=crop",
];

const PROMO_FONTS = [
    'Arial Black', 
    'Impact', 
    'Montserrat', 
    'Oswald', 
    'Roboto', 
    'Poppins', 
    'Open Sans', 
    'Playfair Display', 
    'Verdana', 
    'Georgia', 
    'Courier New', 
    'Trebuchet MS',
    'Brush Script MT'
];

const PROMO_COLORS = [
    { name: 'Amarelo (Padrão)', from: '#fef08a', to: '#eab308', text: '#1e3a8a' },
    { name: 'Vermelho', from: '#ef4444', to: '#991b1b', text: 'white' },
    { name: 'Azul', from: '#3b82f6', to: '#1e3a8a', text: 'white' },
    { name: 'Roxo', from: '#9333ea', to: '#581c87', text: 'white' },
    { name: 'Verde', from: '#22c55e', to: '#14532d', text: 'white' },
    { name: 'Laranja', from: '#f97316', to: '#c2410c', text: 'white' },
    { name: 'Preto', from: '#374151', to: '#111827', text: 'white' },
];

const InstagramMarketing: React.FC<InstagramMarketingProps> = ({ user, store, onRegisterDownload }) => {
  const [formatType, setFormatType] = useState<FormatType>('single');
  const [carouselPreviews, setCarouselPreviews] = useState<string[]>([]);
  const [activeCarouselIndex, setActiveCarouselIndex] = useState(0);

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  
  const [watermarkFile, setWatermarkFile] = useState<File | null>(null);
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

  const [promoName, setPromoName] = useState('OFERTA RELÂMPAGO');
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
  
  // CACHE REFS
  const productImgRef = useRef<HTMLImageElement | null>(null);
  const logoImgRef = useRef<HTMLImageElement | null>(null);
  const webBgRef = useRef<HTMLImageElement | null>(null);
  
  const [isDragging, setIsDragging] = useState<string | null>(null);
  
  const lastMousePos = useRef<{x: number, y: number} | null>(null);

  const cityName = store?.city.split(' - ')[0] || 'Minha Loja';

  // --- IMAGE LOADERS ---
  useEffect(() => {
    if (imagePreview) {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.src = imagePreview;
        img.onload = () => {
            productImgRef.current = img;
            composeFinalImage(undefined, false);
        };
    } else {
        productImgRef.current = null;
        composeFinalImage(undefined, false);
    }
  }, [imagePreview]);

  useEffect(() => {
      const src = watermarkPreview || '/logo.png';
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = src;
      img.onload = () => {
          logoImgRef.current = img;
          composeFinalImage(undefined, false);
      };
      img.onerror = () => {
           if (src !== '/logo.png') {
               logoImgRef.current = null;
           }
      }
  }, [watermarkPreview]);

  useEffect(() => {
      if (bgStyle === 'web' && webBgUrl) {
          const img = new Image();
          img.crossOrigin = "anonymous";
          img.src = webBgUrl;
          img.onload = () => {
              webBgRef.current = img;
              composeFinalImage(undefined, false);
          };
      }
  }, [bgStyle, webBgUrl]);


  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      if (formatType === 'carousel') {
          const newPreviews: string[] = [];
          Array.from(files).forEach((file: File) => {
              const reader = new FileReader();
              reader.onloadend = () => {
                  if (reader.result) {
                      newPreviews.push(reader.result as string);
                      if (newPreviews.length === files.length) {
                          setCarouselPreviews(prev => [...prev, ...newPreviews]);
                          if (!imagePreview) {
                              setImagePreview(newPreviews[0]);
                              setActiveCarouselIndex(0);
                          }
                      }
                  }
              };
              reader.readAsDataURL(file);
          });
      } else {
          const file = files[0];
          setImageFile(file);
          const reader = new FileReader();
          reader.onloadend = () => {
            setImagePreview(reader.result as string);
            setCarouselPreviews([]); 
            setImgPosX(0);
            setImgPosY(0);
            setScale(100);
          };
          reader.readAsDataURL(file);
      }
    }
  };

  const handleSelectCarouselImage = (index: number) => {
      setActiveCarouselIndex(index);
      setImagePreview(carouselPreviews[index]);
  };

  const handleWatermarkChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setWatermarkFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setWatermarkPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };
  
  const handleRandomWebBackground = () => {
      setBgStyle('web');
      const random = WEB_BACKGROUNDS[Math.floor(Math.random() * WEB_BACKGROUNDS.length)];
      setWebBgUrl(random);
  };

  const handleNextFont = () => setActiveFontIndex(prev => (prev + 1) % PROMO_FONTS.length);
  const handlePrevFont = () => setActiveFontIndex(prev => (prev - 1 + PROMO_FONTS.length) % PROMO_FONTS.length);

  // --- ROBUST DRAG & HIT TESTING ---
  const getCanvasCoordinates = (e: React.MouseEvent | React.TouchEvent, previewEl: HTMLDivElement) => {
    const rect = previewEl.getBoundingClientRect();
    const internalWidth = 1080;
    const internalHeight = aspectRatio === '1:1' ? 1080 : 1920;
    
    let clientX, clientY;
    if ('touches' in e) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
    } else {
        clientX = (e as React.MouseEvent).clientX;
        clientY = (e as React.MouseEvent).clientY;
    }

    const x = (clientX - rect.left) * (internalWidth / rect.width);
    const y = (clientY - rect.top) * (internalHeight / rect.height);
    
    return { x, y, width: internalWidth, height: internalHeight };
  };

  const checkHit = (x: number, y: number, width: number, height: number) => {
      const padding = 50; // Larger Hit Area

      // 1. Badge Hit Test
      if (mode === 'promo' && pricePromo) {
          const bX = (badgePos.x / 100) * width;
          const bY = (badgePos.y / 100) * height;
          // Approximate radius
          const radius = 170 * (badgeScale / 100); 
          if (x >= bX - radius - padding && x <= bX + radius + padding &&
              y >= bY - radius - padding && y <= bY + radius + padding) {
              return 'badge';
          }
      }

      // 2. Ribbon Hit Test
      if (mode === 'promo' && promoName) {
          const rX = (ribbonPos.x / 100) * width;
          const rY = (ribbonPos.y / 100) * height;
          const rw = (width * 0.8) * (ribbonScale / 100);
          const rh = 100 * (ribbonScale / 100);
          if (x >= rX - rw/2 - padding && x <= rX + rw/2 + padding &&
              y >= rY - rh/2 - padding && y <= rY + rh/2 + padding) {
              return 'ribbon';
          }
      }

      // 3. Logo Hit Test
      if (logoImgRef.current) {
          const lX = (wmPos.x / 100) * width;
          const lY = (wmPos.y / 100) * height;
          // Approx width
          const lw = 350 * (wmScale / 100);
          const lh = 150 * (wmScale / 100); // Estimative
          if (x >= lX - lw/2 - padding && x <= lX + lw/2 + padding &&
              y >= lY - lh/2 - padding && y <= lY + lh/2 + padding) {
              return 'watermark';
          }
      }

      return 'background';
  };

  const handleCanvasMouseDown = (e: React.MouseEvent | React.TouchEvent) => {
      if (!previewRef.current) return;
      const { x, y, width, height } = getCanvasCoordinates(e, previewRef.current);
      lastMousePos.current = { x, y };

      const hitTarget = checkHit(x, y, width, height);
      setIsDragging(hitTarget);
  };

  const handleCanvasMouseMove = (e: React.MouseEvent | React.TouchEvent) => {
      if (!previewRef.current) return;
      const { x, y, width, height } = getCanvasCoordinates(e, previewRef.current);

      if (isDragging) {
          e.preventDefault(); 
          const lastX = lastMousePos.current ? lastMousePos.current.x : x;
          const lastY = lastMousePos.current ? lastMousePos.current.y : y;
          const deltaX = x - lastX;
          const deltaY = y - lastY;
          lastMousePos.current = { x, y };

          if (isDragging === 'background') {
             const pctDeltaX = (deltaX / width) * 100;
             const pctDeltaY = (deltaY / height) * 100;
             setImgPosX(prev => Math.min(Math.max(prev + pctDeltaX, -100), 100));
             setImgPosY(prev => Math.min(Math.max(prev + pctDeltaY, -100), 100));
          } else {
             const moveX = (deltaX / width) * 100;
             const moveY = (deltaY / height) * 100;

             if (isDragging === 'watermark') setWmPos(prev => ({ x: prev.x + moveX, y: prev.y + moveY }));
             else if (isDragging === 'ribbon') setRibbonPos(prev => ({ x: prev.x + moveX, y: prev.y + moveY }));
             else if (isDragging === 'badge') setBadgePos(prev => ({ x: prev.x + moveX, y: prev.y + moveY }));
          }
      } else {
          // Change cursor based on hit test (live)
          const hit = checkHit(x, y, width, height);
          if (previewRef.current) {
              previewRef.current.style.cursor = hit !== 'background' ? 'grab' : 'move';
          }
      }
  };

  const handleCanvasMouseUp = () => {
      setIsDragging(null);
      lastMousePos.current = null;
      if (previewRef.current) previewRef.current.style.cursor = 'default';
  };

  const handleWheel = (e: React.WheelEvent) => {
      e.preventDefault(); 
      e.stopPropagation();
      const delta = -Math.sign(e.deltaY) * 5;
      setScale(prev => Math.min(Math.max(prev + delta, 20), 300));
  };

  useEffect(() => {
    if (imagePreview) {
        composeFinalImage(undefined, false);
    }
  }, [
      aspectRatio, mode, bgStyle, webBgUrl,
      brightness, contrast, saturation, scale, imgPosX, imgPosY,
      wmScale, wmOpacity, wmPos,
      promoName, callToAction, priceOriginal, pricePromo, 
      activeFontIndex, activeColorIndex, ribbonShape, badgeShape,
      ribbonPos, badgePos, ribbonScale, badgeScale,
      isDragging, // Redraw during drag
      imagePreview, watermarkPreview
  ]);

  const composeFinalImage = async (overrideImageSrc?: string, cleanMode: boolean = false): Promise<string | null> => {
      const canvas = canvasRef.current;
      if (!canvas) return null;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;

      let productImg: HTMLImageElement;
      
      if (overrideImageSrc) {
           productImg = new Image();
           productImg.crossOrigin = "anonymous";
           productImg.src = overrideImageSrc;
           await new Promise((resolve) => {
               productImg.onload = resolve;
               productImg.onerror = resolve;
           });
      } else {
           if (!productImgRef.current) return null; 
           productImg = productImgRef.current;
      }

      const width = 1080;
      const height = aspectRatio === '1:1' ? 1080 : 1920;
      canvas.width = width;
      canvas.height = height;

      // 0. CLEAR CANVAS
      ctx.clearRect(0, 0, width, height);

      // --- LAYER 1: BACKGROUND ---
      ctx.save();
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);
      
      // ISOLATE BACKGROUND DRAWING
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1.0;
      ctx.filter = 'none';

      if (bgStyle === 'blur') {
          // Create a temporary canvas/context for the background to ensure no leakage
          ctx.save();
          ctx.filter = `blur(50px) brightness(${brightness * 0.6}%) saturate(150%)`;
          // Draw image bigger to cover
          ctx.drawImage(productImg, -100, -100, width + 200, height + 200);
          ctx.restore(); // Removes filter
          
          const gradient = ctx.createRadialGradient(width/2, height/2, 100, width/2, height/2, width);
          gradient.addColorStop(0, 'rgba(255,255,255,0.2)');
          gradient.addColorStop(1, 'rgba(0,0,0,0.3)');
          ctx.fillStyle = gradient;
          ctx.fillRect(0, 0, width, height);
      } else if (bgStyle === 'brand') {
          const gradient = ctx.createLinearGradient(0, 0, width, height);
          gradient.addColorStop(0, '#0f172a');
          gradient.addColorStop(1, '#1e3a8a');
          ctx.fillStyle = gradient;
          ctx.fillRect(0, 0, width, height);
          ctx.strokeStyle = 'rgba(255,255,255,0.05)';
          ctx.lineWidth = 2;
          for(let i=0; i<width; i+=100) {
              ctx.beginPath();
              ctx.moveTo(i, 0);
              ctx.lineTo(i - 200, height);
              ctx.stroke();
          }
      } else if (bgStyle === 'white') {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, width, height);
      } else if (bgStyle === 'dark') {
          ctx.fillStyle = '#111827';
          ctx.fillRect(0, 0, width, height);
      } else if (bgStyle === 'abs1') { 
          const grd = ctx.createLinearGradient(0, 0, width, height);
          grd.addColorStop(0, '#2e1065'); 
          grd.addColorStop(1, '#be185d'); 
          ctx.fillStyle = grd;
          ctx.fillRect(0, 0, width, height);
          ctx.globalCompositeOperation = 'screen';
          const grad1 = ctx.createRadialGradient(width*0.2, height*0.3, 0, width*0.2, height*0.3, 400);
          grad1.addColorStop(0, 'rgba(56, 189, 248, 0.6)'); 
          grad1.addColorStop(1, 'rgba(56, 189, 248, 0)');
          ctx.fillStyle = grad1;
          ctx.fillRect(0, 0, width, height);
          const grad2 = ctx.createRadialGradient(width*0.8, height*0.8, 0, width*0.8, height*0.8, 500);
          grad2.addColorStop(0, 'rgba(234, 179, 8, 0.5)'); 
          grad2.addColorStop(1, 'rgba(234, 179, 8, 0)');
          ctx.fillStyle = grad2;
          ctx.fillRect(0, 0, width, height);
      } else if (bgStyle === 'abs2') { 
          const grd = ctx.createLinearGradient(0, 0, 0, height);
          grd.addColorStop(0, '#c2410c'); 
          grd.addColorStop(0.5, '#db2777'); 
          grd.addColorStop(1, '#4c1d95'); 
          ctx.fillStyle = grd;
          ctx.fillRect(0, 0, width, height);
          ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
          ctx.beginPath();
          ctx.arc(width/2, height, width*0.6, 0, Math.PI, true);
          ctx.fill();
      } else if (bgStyle === 'abs3') { 
          ctx.fillStyle = '#064e3b'; 
          ctx.fillRect(0, 0, width, height);
          const grad1 = ctx.createRadialGradient(width, 0, 0, width, 0, 800);
          grad1.addColorStop(0, '#34d399'); 
          grad1.addColorStop(1, 'transparent');
          ctx.fillStyle = grad1;
          ctx.fillRect(0, 0, width, height);
          const grad2 = ctx.createRadialGradient(0, height, 0, 0, height, 600);
          grad2.addColorStop(0, '#facc15'); 
          grad2.addColorStop(1, 'transparent');
          ctx.fillStyle = grad2;
          ctx.fillRect(0, 0, width, height);
      } else if (bgStyle === 'abs4') { 
          ctx.fillStyle = '#000000';
          ctx.fillRect(0, 0, width, height);
          const grad1 = ctx.createConicGradient(0, width/2, height/2);
          grad1.addColorStop(0, '#312e81');
          grad1.addColorStop(0.25, '#4c1d95');
          grad1.addColorStop(0.5, '#be185d');
          grad1.addColorStop(0.75, '#1e3a8a');
          grad1.addColorStop(1, '#312e81');
          ctx.globalAlpha = 0.6;
          ctx.fillStyle = grad1;
          ctx.fillRect(0,0, width, height);
          ctx.globalAlpha = 1.0;
          ctx.fillStyle = 'rgba(0,0,0,0.3)';
          ctx.fillRect(0,0,width,height);
      } else if (bgStyle === 'art1') {
          const grd = ctx.createLinearGradient(0, 0, width, height);
          grd.addColorStop(0, '#020617');
          grd.addColorStop(1, '#1e1b4b');
          ctx.fillStyle = grd;
          ctx.fillRect(0, 0, width, height);
          ctx.globalCompositeOperation = 'screen';
          ctx.lineWidth = 20;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(0, height * 0.7);
          ctx.bezierCurveTo(width * 0.3, height * 0.5, width * 0.7, height * 0.9, width, height * 0.6);
          ctx.lineTo(width, height);
          ctx.lineTo(0, height);
          ctx.fillStyle = 'rgba(56, 189, 248, 0.4)';
          ctx.fill();
          ctx.beginPath();
          ctx.moveTo(0, height * 0.3);
          ctx.bezierCurveTo(width * 0.4, height * 0.1, width * 0.6, height * 0.6, width, height * 0.3);
          ctx.strokeStyle = '#f472b6';
          ctx.stroke();
      } else if (bgStyle === 'art2') {
          ctx.fillStyle = '#e2e8f0';
          ctx.fillRect(0, 0, width, height);
          const drawOrb = (x: number, y: number, r: number, color: string) => {
              const grd = ctx.createRadialGradient(x, y, 0, x, y, r);
              grd.addColorStop(0, color);
              grd.addColorStop(1, 'rgba(255,255,255,0)');
              ctx.fillStyle = grd;
              ctx.beginPath();
              ctx.arc(x, y, r, 0, Math.PI*2);
              ctx.fill();
          };
          drawOrb(width*0.2, height*0.2, 400, 'rgba(250, 204, 21, 0.6)');
          drawOrb(width*0.8, height*0.8, 500, 'rgba(244, 63, 94, 0.5)');
          drawOrb(width*0.5, height*0.5, 300, 'rgba(59, 130, 246, 0.4)');
          ctx.fillStyle = 'rgba(255,255,255,0.3)';
          ctx.fillRect(0,0,width,height);
      } else if (bgStyle === 'art3') {
          ctx.fillStyle = '#111827';
          ctx.fillRect(0, 0, width, height);
          ctx.save();
          ctx.translate(width/2, height/2);
          ctx.rotate(-Math.PI / 4);
          for(let i = -10; i < 10; i++) {
              ctx.fillStyle = i % 2 === 0 ? '#1f2937' : '#374151';
              ctx.fillRect(-width, i * 150, width*3, 150);
          }
          ctx.restore();
          const spot = ctx.createRadialGradient(width/2, height/2, 0, width/2, height/2, width*0.8);
          spot.addColorStop(0, 'rgba(79, 70, 229, 0.2)');
          spot.addColorStop(1, 'transparent');
          ctx.fillStyle = spot;
          ctx.fillRect(0,0,width,height);
      } else if (bgStyle === 'art4') {
          const grd = ctx.createLinearGradient(0, 0, width, height);
          grd.addColorStop(0, '#f9a8d4');
          grd.addColorStop(0.5, '#c084fc');
          grd.addColorStop(1, '#818cf8');
          ctx.fillStyle = grd;
          ctx.fillRect(0, 0, width, height);
          ctx.globalCompositeOperation = 'overlay';
          const grd2 = ctx.createRadialGradient(width, 0, 0, width, 0, width);
          grd2.addColorStop(0, 'rgba(255,255,255,0.8)');
          grd2.addColorStop(1, 'transparent');
          ctx.fillStyle = grd2;
          ctx.fillRect(0,0,width,height);
      } else if (bgStyle === 'art5') {
          const grd = ctx.createLinearGradient(0, 0, width, height);
          grd.addColorStop(0, '#4f46e5');
          grd.addColorStop(1, '#ec4899');
          ctx.fillStyle = grd;
          ctx.fillRect(0,0,width,height);
          ctx.globalCompositeOperation = 'screen';
          const drawSwirl = (x:number, y:number, r:number, c1:string, c2:string) => {
              const g = ctx.createRadialGradient(x, y, 0, x, y, r);
              g.addColorStop(0, c1);
              g.addColorStop(1, c2);
              ctx.fillStyle = g;
              ctx.beginPath();
              ctx.arc(x,y,r,0,Math.PI*2);
              ctx.fill();
          }
          drawSwirl(0, 0, width*0.8, '#fbbf24', 'transparent');
          drawSwirl(width, height, width*0.7, '#22d3ee', 'transparent');
      } else if (bgStyle === 'art6') {
          ctx.fillStyle = '#0f172a';
          ctx.fillRect(0,0,width,height);
          ctx.globalCompositeOperation = 'lighten';
          const drawBeam = (x:number, y:number, w:number, h:number, color:string, rot: number) => {
              ctx.save();
              ctx.translate(x, y);
              ctx.rotate(rot);
              ctx.fillStyle = color;
              ctx.fillRect(-w/2, -h/2, w, h);
              ctx.restore();
          }
          drawBeam(width*0.2, height*0.2, width, 200, 'rgba(236, 72, 153, 0.2)', Math.PI/4);
          drawBeam(width*0.8, height*0.8, width, 200, 'rgba(6, 182, 212, 0.2)', Math.PI/4);
          drawBeam(width*0.5, height*0.5, width*1.5, 300, 'rgba(99, 102, 241, 0.1)', -Math.PI/6);
      } else if (bgStyle === 'art7') {
          const grd = ctx.createLinearGradient(0, 0, 0, height);
          grd.addColorStop(0, '#f59e0b');
          grd.addColorStop(0.5, '#ef4444');
          grd.addColorStop(1, '#7c3aed');
          ctx.fillStyle = grd;
          ctx.fillRect(0,0,width,height);
          ctx.fillStyle = 'rgba(255,255,255,0.1)';
          ctx.beginPath();
          ctx.moveTo(0, height*0.6);
          ctx.bezierCurveTo(width*0.3, height*0.4, width*0.7, height*0.8, width, height*0.5);
          ctx.lineTo(width, height);
          ctx.lineTo(0, height);
          ctx.fill();
      } else if (bgStyle === 'art8') {
          const grd = ctx.createRadialGradient(width/2, height/2, 0, width/2, height/2, width);
          grd.addColorStop(0, '#1e1b4b');
          grd.addColorStop(1, '#000000');
          ctx.fillStyle = grd;
          ctx.fillRect(0,0,width,height);
          ctx.strokeStyle = '#312e81';
          ctx.lineWidth = 2;
          const size = 100;
          for(let y=0; y<height+size; y+=size*0.86) {
              for(let x=0; x<width+size; x+=size*1.5) {
                  const off = (Math.floor(y/(size*0.86)) % 2) === 0 ? 0 : size*0.75;
                  ctx.beginPath();
                  for (let i = 0; i < 6; i++) {
                    const angle = 2 * Math.PI / 6 * i;
                    const hx = (x + off) + size/2 * Math.cos(angle);
                    const hy = y + size/2 * Math.sin(angle);
                    if (i === 0) ctx.moveTo(hx, hy);
                    else ctx.lineTo(hx, hy);
                  }
                  ctx.closePath();
                  ctx.stroke();
              }
          }
          const glow = ctx.createRadialGradient(width/2, height/2, 0, width/2, height/2, width*0.6);
          glow.addColorStop(0, 'rgba(99, 102, 241, 0.3)');
          glow.addColorStop(1, 'transparent');
          ctx.fillStyle = glow;
          ctx.fillRect(0,0,width,height);
      } else if (bgStyle === 'web') {
           if (webBgRef.current) {
               const bgImg = webBgRef.current;
               const bgAspect = bgImg.width / bgImg.height;
               const canvasAspect = width / height;
               let renderW, renderH, offX, offY;
               
               if (bgAspect > canvasAspect) {
                   renderH = height;
                   renderW = height * bgAspect;
                   offX = (width - renderW) / 2;
                   offY = 0;
               } else {
                   renderW = width;
                   renderH = width / bgAspect;
                   offX = 0;
                   offY = (height - renderH) / 2;
               }
               ctx.drawImage(bgImg, offX, offY, renderW, renderH);
               ctx.fillStyle = 'rgba(0,0,0,0.2)';
               ctx.fillRect(0,0,width,height);
           } else {
               ctx.fillStyle = '#333';
               ctx.fillRect(0,0,width,height);
           }
      }
      ctx.restore(); // END BACKGROUND STATE

      // --- LAYER 2: PRODUCT IMAGE ---
      const imgAspect = productImg.width / productImg.height;
      const basePadding = 100;
      const zoomFactor = scale / 100;
      const availWidth = (width - (basePadding * 2)) * zoomFactor;
      const availHeight = (height - (basePadding * 2) - 150) * zoomFactor; 
      let drawWidth, drawHeight;
      if (imgAspect > (width / height)) {
          drawWidth = availWidth;
          drawHeight = availWidth / imgAspect;
      } else {
          drawHeight = availHeight;
          drawWidth = availHeight * imgAspect;
      }
      let drawX = (width - drawWidth) / 2;
      let drawY = (height - drawHeight) / 2;
      drawX += (imgPosX / 100) * width;
      drawY += (imgPosY / 100) * height;

      ctx.save();
      // CRITICAL: Ensure we are drawing ON TOP of background, opaque.
      ctx.globalCompositeOperation = 'source-over'; 
      ctx.globalAlpha = 1.0;
      ctx.filter = 'none'; // Reset any filters first
      
      let finalBrightness = brightness;
      let finalContrast = contrast;
      if (bgStyle === 'blur' && brightness === 100 && contrast === 100) {
          finalBrightness = 110;
          finalContrast = 115;
      }
      
      // Apply filters only for this draw op
      ctx.filter = `brightness(${finalBrightness}%) contrast(${finalContrast}%) saturate(${saturation}%) drop-shadow(0px 30px 40px rgba(0,0,0,0.5))`;
      
      ctx.drawImage(productImg, drawX, drawY, drawWidth, drawHeight);
      ctx.restore();

      // --- LAYER 3: LOGO ---
      const drawLogo = () => {
          if (!logoImgRef.current) return;
          const logoImg = logoImgRef.current;
          
          ctx.save();
          // Safety Reset
          ctx.globalCompositeOperation = 'source-over';
          ctx.filter = 'none';

          const baseLogoWidth = 350; 
          const currentScale = wmScale / 100;
          const logoWidth = baseLogoWidth * currentScale;
          let logoHeight = 100; 
          
          let logoCenterX = (wmPos.x / 100) * width;
          let logoCenterY = (wmPos.y / 100) * height;

          if (logoImg.width > 0) {
              logoHeight = (logoImg.height / logoImg.width) * logoWidth;
              const logoX = logoCenterX - (logoWidth / 2);
              const logoY = logoCenterY - (logoHeight / 2);

              ctx.globalAlpha = wmOpacity / 100;
              
              if (bgStyle !== 'white') {
                ctx.save();
                ctx.shadowColor = "rgba(255,255,255,0.8)";
                ctx.shadowBlur = 30;
                ctx.drawImage(logoImg, logoX, logoY, logoWidth, logoHeight);
                ctx.restore();
              }
              
              ctx.shadowColor = "rgba(0,0,0,0.3)";
              ctx.shadowBlur = 10;
              ctx.drawImage(logoImg, logoX, logoY, logoWidth, logoHeight);
              ctx.globalAlpha = 1.0;

              ctx.save();
              ctx.shadowColor = "rgba(0,0,0,1)";
              ctx.shadowBlur = 8;
              ctx.fillStyle = '#ffffff';
              ctx.font = `700 ${24 * currentScale}px Inter, sans-serif`;
              ctx.textAlign = 'center';
              ctx.letterSpacing = '1px';
              ctx.fillText(cityName.toUpperCase(), logoCenterX, logoY + logoHeight + (30 * currentScale));
              ctx.restore();
          }
          ctx.restore();
      };

      drawLogo();

      // --- LAYER 4: OVERLAYS (RIBBON/BADGE) ---
      if (mode === 'promo') {
          const activeColor = PROMO_COLORS[activeColorIndex];
          const chosenFont = PROMO_FONTS[activeFontIndex];
          const rX = (ribbonPos.x / 100) * width;
          const rY = (ribbonPos.y / 100) * height;
          const bX = (badgePos.x / 100) * width;
          const bY = (badgePos.y / 100) * height;

          // Ribbon
          if (promoName) {
              ctx.save();
              ctx.globalCompositeOperation = 'source-over';
              ctx.filter = 'none';
              
              ctx.translate(rX, rY);
              const rScale = ribbonScale / 100;
              ctx.scale(rScale, rScale);
              
              const grad = ctx.createLinearGradient(0, 0, 0, 100);
              grad.addColorStop(0, activeColor.from);
              grad.addColorStop(1, activeColor.to);
              ctx.fillStyle = grad;
              
              const rw = width * 0.8;
              const rh = 100;
              const rx = -rw / 2;
              const ry = -rh / 2;

              ctx.shadowColor = "rgba(0,0,0,0.5)";
              ctx.shadowBlur = 20;
              ctx.shadowOffsetY = 10;

              ctx.beginPath();
              if (ribbonShape === 'classic') {
                  ctx.moveTo(rx, ry);
                  ctx.lineTo(rx + rw, ry);
                  ctx.lineTo(rx + rw - 20, ry + rh/2); 
                  ctx.lineTo(rx + rw, ry + rh);
                  ctx.lineTo(rx, ry + rh);
                  ctx.lineTo(rx + 20, ry + rh/2); 
              } else if (ribbonShape === 'modern') {
                  ctx.roundRect(rx, ry, rw, rh, 50);
              } else if (ribbonShape === 'minimal') {
                  ctx.rect(rx, ry, rw, rh);
              }
              ctx.fill();

              ctx.shadowBlur = 0;
              ctx.shadowOffsetY = 0;
              ctx.fillStyle = activeColor.text;
              
              ctx.font = `900 60px "${chosenFont}", sans-serif`;
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.shadowColor = "rgba(0,0,0,0.5)";
              ctx.shadowBlur = 0;
              ctx.shadowOffsetX = 3;
              ctx.shadowOffsetY = 3;
              ctx.fillText(promoName.toUpperCase(), 0, 0 + 5); 
              ctx.restore();
          }

          // Badge
          if (pricePromo) {
              ctx.save();
              ctx.globalCompositeOperation = 'source-over';
              ctx.filter = 'none';

              ctx.translate(bX, bY);
              const bScale = badgeScale / 100;
              ctx.scale(bScale, bScale);

              const radius = 170; 

              ctx.shadowColor = "rgba(0,0,0,0.6)";
              ctx.shadowBlur = 25;
              ctx.shadowOffsetY = 15;

              const badgeGrad = ctx.createRadialGradient(-radius/3, -radius/3, 10, 0, 0, radius);
              badgeGrad.addColorStop(0, activeColor.from); 
              badgeGrad.addColorStop(1, activeColor.to); 

              ctx.beginPath();
              if (badgeShape === 'circle') ctx.arc(0, 0, radius, 0, Math.PI * 2);
              else if (badgeShape === 'tag') ctx.roundRect(-radius, -radius, radius*2, radius*2, 40);
              else if (badgeShape === 'burst') {
                   const spikes = 20;
                   const outerRadius = radius;
                   const innerRadius = radius * 0.85;
                   let rot = Math.PI / 2 * 3;
                   let x = 0, y = 0, step = Math.PI / spikes;
                   ctx.moveTo(0, 0 - outerRadius);
                   for (let i = 0; i < spikes; i++) {
                        x = 0 + Math.cos(rot) * outerRadius;
                        y = 0 + Math.sin(rot) * outerRadius;
                        ctx.lineTo(x, y);
                        rot += step;
                        x = 0 + Math.cos(rot) * innerRadius;
                        y = 0 + Math.sin(rot) * innerRadius;
                        ctx.lineTo(x, y);
                        rot += step;
                    }
                    ctx.lineTo(0, 0 - outerRadius);
                    ctx.closePath();
              }
              ctx.fillStyle = badgeGrad;
              ctx.fill();

              if (badgeShape !== 'burst') {
                ctx.shadowColor = 'transparent';
                ctx.strokeStyle = 'rgba(255,255,255,0.4)'; 
                ctx.lineWidth = 3;
                ctx.setLineDash([10, 8]);
                ctx.beginPath();
                if (badgeShape === 'circle') ctx.arc(0, 0, radius - 15, 0, Math.PI * 2);
                if (badgeShape === 'tag') ctx.roundRect(-radius+15, -radius+15, radius*2-30, radius*2-30, 30);
                ctx.stroke();
                ctx.setLineDash([]); 
              }

              ctx.textAlign = 'center';
              ctx.save();
              ctx.translate(0, -60);
              if (badgeShape !== 'tag') ctx.rotate(-5 * Math.PI / 180); 
              
              ctx.fillStyle = '#ffffff'; 
              ctx.beginPath();
              ctx.roundRect(-120, -25, 240, 50, 10);
              ctx.fill();
              
              ctx.fillStyle = activeColor.to; 
              // UPDATED: Use user-selected font for CTA
              ctx.font = `bold 30px "${chosenFont}", sans-serif`;
              ctx.fillText(callToAction, 0, 10);
              ctx.restore();

              if (priceOriginal) {
                  ctx.fillStyle = 'rgba(255,255,255,0.9)'; 
                  // UPDATED: Use user-selected font for Original Price
                  ctx.font = `bold 26px "${chosenFont}", sans-serif`;
                  ctx.fillText('DE R$ ' + priceOriginal, 0, -100);
                  const w = ctx.measureText('DE R$ ' + priceOriginal).width;
                  ctx.strokeStyle = 'rgba(255,255,255,0.8)';
                  ctx.lineWidth = 4;
                  ctx.beginPath();
                  ctx.moveTo(-w/2 - 5, -108);
                  ctx.lineTo(w/2 + 5, -108);
                  ctx.stroke();
              }

              const priceParts = pricePromo.split(',');
              const mainPrice = priceParts[0];
              const cents = priceParts[1] || '00';

              ctx.textBaseline = 'middle';
              
              // UPDATED: Use user-selected font for Main Price (Bold/900 weight)
              ctx.font = `900 130px "${chosenFont}", sans-serif`; 
              const mainW = ctx.measureText(mainPrice).width;
              
              ctx.font = `900 50px "${chosenFont}", sans-serif`; 
              const centsW = ctx.measureText(','+cents).width;
              
              const totalW = mainW + centsW;
              const startX = -(totalW / 2);
              const textBaseY = 40;

              ctx.fillStyle = '#ffffff'; 
              ctx.font = `900 30px "${chosenFont}", sans-serif`;
              ctx.fillText("R$", startX - 25, textBaseY - 30);

              ctx.font = `900 130px "${chosenFont}", sans-serif`;
              ctx.lineWidth = 8;
              ctx.strokeStyle = 'rgba(0,0,0,0.2)'; 
              ctx.strokeText(mainPrice, startX + mainW/2, textBaseY); 
              ctx.fillStyle = '#ffffff'; 
              ctx.fillText(mainPrice, startX + mainW/2, textBaseY);

              ctx.font = `900 50px "${chosenFont}", sans-serif`;
              ctx.strokeText(',' + cents, startX + mainW + centsW/2, textBaseY - 20);
              ctx.fillStyle = '#ffffff';
              ctx.fillText(',' + cents, startX + mainW + centsW/2, textBaseY - 20);
              ctx.restore();
          }
      }

      const dataUrl = canvas.toDataURL('image/png');
      if (!overrideImageSrc) {
          setGeneratedImage(dataUrl);
      }
      return dataUrl;
  };

  const getAuditDetails = () => {
        const parts = [];
        
        // 1. Core Info
        parts.push(mode === 'promo' ? `[PROMOÇÃO] "${promoName}"` : `[INSTITUCIONAL]`);
        parts.push(`Dimensão: ${aspectRatio}`);
        
        // 2. Background Style
        const styleMap: Record<string, string> = {
            'blur': 'Desfoque', 'brand': 'Marca', 'white': 'Branco', 'dark': 'Escuro',
            'abs1': 'Neon', 'abs2': 'Sunset', 'abs3': 'Fresh', 'abs4': 'Galaxy',
            'art1': 'Liquid', 'art2': 'Orbs', 'art3': 'Geo', 'art4': 'Mesh',
            'art5': 'Candy', 'art6': 'Prism', 'art7': 'Waves', 'art8': 'Hex',
            'web': 'Banco Imagem'
        };
        parts.push(`Estilo: ${styleMap[bgStyle] || bgStyle}`);
        
        // 3. Promo Details
        if (mode === 'promo') {
            if (pricePromo) parts.push(`Preço: R$${pricePromo}`);
            parts.push(`Cor: ${PROMO_COLORS[activeColorIndex].name}`);
            parts.push(`Fonte: ${PROMO_FONTS[activeFontIndex]}`);
            parts.push(`CTA: "${callToAction}"`);
        }
        
        // 4. Composition
        if (watermarkPreview) parts.push(`Logo Personalizada`);
        else parts.push(`Logo Padrão`);
        
        // 5. Format
        if (formatType === 'carousel') {
            parts.push(`Carrossel (${carouselPreviews.length} slides)`);
        } else {
            parts.push(`Imagem Única`);
        }
        
        return parts.join(' | ');
  };

  const handleDownloadCarousel = async () => {
      if (carouselPreviews.length === 0) return;
      const details = getAuditDetails();
      const baseId = onRegisterDownload ? onRegisterDownload(details) : `GEN_${new Date().getTime()}`;

      for (let i = 0; i < carouselPreviews.length; i++) {
          const src = carouselPreviews[i];
          const dataUrl = await composeFinalImage(src, true); 
          
          if (dataUrl) {
              const link = document.createElement('a');
              link.href = dataUrl;
              link.download = `RealCalcados_${baseId}_${i+1}.png`;
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
              await new Promise(r => setTimeout(r, 500));
          }
      }
      alert(`Download de ${carouselPreviews.length} imagens concluído! (Registrado na Auditoria)`);
  };

  const downloadImage = async () => {
      if (formatType === 'carousel') {
          handleDownloadCarousel();
          return;
      }
      const cleanDataUrl = await composeFinalImage(undefined, true);
      if (cleanDataUrl) {
          const details = getAuditDetails();
          const fileId = onRegisterDownload ? onRegisterDownload(details) : `GEN_${new Date().getTime()}`;
          const link = document.createElement('a');
          link.href = cleanDataUrl;
          link.download = `RealCalcados_${fileId}.png`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
      }
  };

  return (
    <div className="flex flex-col md:flex-row h-full overflow-hidden bg-white">
        
        {/* LEFT PANEL: CONTROLS */}
        <div className="w-full md:w-[400px] lg:w-[450px] flex flex-col gap-6 bg-white border-r border-gray-200 overflow-y-auto h-full p-6 shadow-[4px_0_24px_rgba(0,0,0,0.02)] z-10 shrink-0">
            {/* ... Existing UI Controls ... */}
            <div>
                <h2 className="text-2xl font-black bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent flex items-center gap-2">
                    <Instagram /> Marketing Studio
                </h2>
                <p className="text-gray-500 text-sm mt-1">Crie posts profissionais instantaneamente.</p>
            </div>

            {/* 1. Format Selection */}
            <div className="space-y-2">
                <label className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1">
                    <LayoutTemplate size={14}/> 1. Tipo de Mídia
                </label>
                <div className="flex bg-gray-100 p-1 rounded-lg">
                    <button 
                        onClick={() => { setFormatType('single'); setCarouselPreviews([]); setImageFile(null); setImagePreview(null); }}
                        className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${formatType === 'single' ? 'bg-white shadow text-purple-700' : 'text-gray-500'}`}
                    >
                        Única
                    </button>
                    <button 
                        onClick={() => { setFormatType('carousel'); setCarouselPreviews([]); setImageFile(null); setImagePreview(null); }}
                        className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${formatType === 'carousel' ? 'bg-white shadow text-purple-700' : 'text-gray-500'}`}
                    >
                        Carrossel (Múltiplos)
                    </button>
                </div>
            </div>

            {/* 2. Upload */}
            <div className="space-y-3">
                <label className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1">
                    <ImageIcon size={14}/> 2. Foto(s) do Produto
                </label>
                <div 
                    onClick={() => document.getElementById('upload-input')?.click()}
                    className={`border-2 border-dashed rounded-xl h-40 flex flex-col items-center justify-center cursor-pointer transition-all ${imagePreview ? 'border-purple-300 bg-purple-50' : 'border-gray-300 hover:border-purple-400 hover:bg-gray-50'}`}
                >
                    {imagePreview ? (
                        <div className="relative w-full h-full p-2">
                            <img src={imagePreview} alt="Preview" className="h-full w-full object-contain rounded-lg" />
                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity rounded-lg">
                                <span className="text-white text-xs font-bold flex items-center gap-1"><RefreshCw size={12}/> {formatType === 'carousel' ? 'Adicionar/Trocar' : 'Trocar'}</span>
                            </div>
                        </div>
                    ) : (
                        <>
                            <Upload className="text-gray-400 mb-2" size={32} />
                            <span className="text-sm text-gray-500 font-medium">Clique para enviar {formatType === 'carousel' ? 'fotos' : 'foto'}</span>
                        </>
                    )}
                    <input id="upload-input" type="file" accept="image/*" multiple={formatType === 'carousel'} className="hidden" onChange={handleFileChange} />
                </div>
            </div>

            {/* 3. Dimensions & Background */}
            <div className="grid grid-cols-1 gap-4">
                 <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1">
                        <LayoutTemplate size={14}/> Dimensão
                    </label>
                    <div className="flex bg-gray-100 p-1 rounded-lg">
                        <button onClick={() => setAspectRatio('1:1')} className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${aspectRatio === '1:1' ? 'bg-white shadow text-purple-700' : 'text-gray-500'}`}>Feed (1:1)</button>
                        <button onClick={() => setAspectRatio('9:16')} className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${aspectRatio === '9:16' ? 'bg-white shadow text-purple-700' : 'text-gray-500'}`}>Stories (9:16)</button>
                    </div>
                 </div>

                 <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1">
                        <Palette size={14}/> Estilo de Fundo
                    </label>
                    <div className="grid grid-cols-4 gap-2">
                        {/* Row 1: Basics */}
                        <button onClick={() => setBgStyle('blur')} className={`h-10 rounded-md border-2 overflow-hidden relative ${bgStyle === 'blur' ? 'border-purple-600 ring-2 ring-purple-100' : 'border-transparent'}`} title="Desfoque">
                             <div className="absolute inset-0 bg-gray-200 blur-sm scale-110"><img src={imagePreview || ''} className="w-full h-full object-cover opacity-50"/></div>
                        </button>
                        <button onClick={() => setBgStyle('brand')} className={`h-10 rounded-md border-2 bg-gradient-to-r from-blue-800 to-red-700 ${bgStyle === 'brand' ? 'border-purple-600 ring-2 ring-purple-100' : 'border-transparent'}`} title="Marca"></button>
                        <button onClick={() => setBgStyle('white')} className={`h-10 rounded-md border-2 bg-white ${bgStyle === 'white' ? 'border-purple-600 ring-2 ring-purple-100' : 'border-gray-200'}`} title="Branco"></button>
                        <button onClick={() => setBgStyle('dark')} className={`h-10 rounded-md border-2 bg-gray-900 ${bgStyle === 'dark' ? 'border-purple-600 ring-2 ring-purple-100' : 'border-transparent'}`} title="Escuro"></button>
                        
                        {/* Row 2: Abstract Gradients */}
                        <button onClick={() => setBgStyle('abs1')} className={`h-10 rounded-md border-2 bg-gradient-to-br from-purple-600 to-pink-500 ${bgStyle === 'abs1' ? 'border-purple-600 ring-2 ring-purple-100' : 'border-transparent'}`} title="Neon"></button>
                        <button onClick={() => setBgStyle('abs2')} className={`h-10 rounded-md border-2 bg-gradient-to-br from-orange-500 to-purple-800 ${bgStyle === 'abs2' ? 'border-purple-600 ring-2 ring-purple-100' : 'border-transparent'}`} title="Sunset"></button>
                        <button onClick={() => setBgStyle('abs3')} className={`h-10 rounded-md border-2 bg-gradient-to-br from-green-500 to-yellow-400 ${bgStyle === 'abs3' ? 'border-purple-600 ring-2 ring-purple-100' : 'border-transparent'}`} title="Fresh"></button>
                        <button onClick={() => setBgStyle('abs4')} className={`h-10 rounded-md border-2 bg-gradient-to-br from-blue-900 to-black ${bgStyle === 'abs4' ? 'border-purple-600 ring-2 ring-purple-100' : 'border-transparent'}`} title="Galaxy"></button>

                        {/* Row 3: Colorful Shapes (Layer 3) */}
                        <button onClick={() => setBgStyle('art1')} className={`h-10 rounded-md border-2 bg-[#020617] relative overflow-hidden ${bgStyle === 'art1' ? 'border-purple-600 ring-2 ring-purple-100' : 'border-transparent'}`} title="Liquid">
                            <div className="absolute top-0 right-0 w-full h-full bg-gradient-to-br from-cyan-500/50 to-transparent"></div>
                        </button>
                        <button onClick={() => setBgStyle('art2')} className={`h-10 rounded-md border-2 bg-slate-200 relative overflow-hidden ${bgStyle === 'art2' ? 'border-purple-600 ring-2 ring-purple-100' : 'border-transparent'}`} title="Orbs">
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 bg-yellow-400 rounded-full blur-sm"></div>
                        </button>
                        <button onClick={() => setBgStyle('art3')} className={`h-10 rounded-md border-2 bg-gray-900 relative overflow-hidden ${bgStyle === 'art3' ? 'border-purple-600 ring-2 ring-purple-100' : 'border-transparent'}`} title="Geo">
                             <div className="absolute inset-0 bg-[linear-gradient(45deg,transparent_25%,rgba(68,68,68,.2)_50%,transparent_75%,transparent_100%)] bg-[length:10px_10px]"></div>
                        </button>
                        <button onClick={() => setBgStyle('art4')} className={`h-10 rounded-md border-2 bg-gradient-to-r from-pink-300 via-purple-300 to-indigo-400 ${bgStyle === 'art4' ? 'border-purple-600 ring-2 ring-purple-100' : 'border-transparent'}`} title="Mesh"></button>

                        {/* Row 4: New Modern Shapes (Layer 4) */}
                        <button onClick={() => setBgStyle('art5')} className={`h-10 rounded-md border-2 bg-gradient-to-br from-blue-500 to-pink-500 relative overflow-hidden ${bgStyle === 'art5' ? 'border-purple-600 ring-2 ring-purple-100' : 'border-transparent'}`} title="Candy Swirl">
                            <div className="absolute top-0 left-0 w-full h-full mix-blend-screen bg-gradient-to-tr from-yellow-300/50 to-transparent"></div>
                        </button>
                        <button onClick={() => setBgStyle('art6')} className={`h-10 rounded-md border-2 bg-slate-900 relative overflow-hidden ${bgStyle === 'art6' ? 'border-purple-600 ring-2 ring-purple-100' : 'border-transparent'}`} title="Dark Prism">
                             <div className="absolute top-1/2 left-1/2 w-full h-2 bg-cyan-400/30 -translate-x-1/2 rotate-45"></div>
                        </button>
                        <button onClick={() => setBgStyle('art7')} className={`h-10 rounded-md border-2 bg-gradient-to-b from-orange-400 to-red-600 relative overflow-hidden ${bgStyle === 'art7' ? 'border-purple-600 ring-2 ring-purple-100' : 'border-transparent'}`} title="Sunset Waves">
                             <div className="absolute bottom-0 w-full h-1/3 bg-white/10 rounded-t-full"></div>
                        </button>
                        <button onClick={() => setBgStyle('art8')} className={`h-10 rounded-md border-2 bg-indigo-950 relative overflow-hidden ${bgStyle === 'art8' ? 'border-purple-600 ring-2 ring-purple-100' : 'border-transparent'}`} title="Tech Hex">
                             <div className="absolute inset-0 border-2 border-indigo-500/30 m-1"></div>
                        </button>
                    </div>

                    <div className="mt-2 flex gap-2">
                        <button onClick={handleRandomWebBackground} className={`flex-1 h-10 rounded-md border-2 flex items-center justify-center gap-1 text-[10px] font-bold transition-all ${bgStyle === 'web' ? 'border-purple-600 bg-purple-50 text-purple-700' : 'border-gray-200 bg-gray-50 text-gray-500 hover:bg-gray-100'}`}>
                            <Globe size={12}/> Banco de Imagens
                        </button>
                        {bgStyle === 'web' && (
                            <button onClick={handleRandomWebBackground} className="h-10 w-10 rounded-md border border-gray-200 flex items-center justify-center bg-gray-50 hover:bg-gray-100 text-gray-600" title="Sortear Outra"><Shuffle size={14} /></button>
                        )}
                    </div>
                 </div>
            </div>

             {/* 4. Watermark */}
             <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 space-y-4">
                 <label className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1">
                    <Stamp size={14}/> 4. Marca D'água / Logo
                </label>
                <div className="flex items-center gap-4">
                    <div onClick={() => document.getElementById('watermark-input')?.click()} className="w-16 h-16 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center cursor-pointer hover:border-purple-400 bg-white" title="Enviar Logo Personalizada">
                        {watermarkPreview ? (<img src={watermarkPreview} className="w-full h-full object-contain p-1" />) : (<Upload size={20} className="text-gray-400" />)}
                    </div>
                    <div className="flex-1 space-y-1">
                         <span className="text-[10px] text-gray-400 uppercase">Logo Personalizada</span>
                         <input id="watermark-input" type="file" accept="image/*" className="hidden" onChange={handleWatermarkChange} />
                         <p className="text-[9px] text-gray-400 leading-tight">Envie sua logo em PNG (fundo transparente) para melhor resultado.</p>
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                     <div>
                        <span className="text-[10px] text-gray-500 font-bold">Tamanho</span>
                        <input type="range" min="20" max="200" value={wmScale} onChange={(e) => setWmScale(Number(e.target.value))} className="w-full h-1 bg-gray-300 rounded-lg appearance-none cursor-pointer accent-blue-600"/>
                     </div>
                     <div>
                        <span className="text-[10px] text-gray-500 font-bold">Opacidade</span>
                        <input type="range" min="10" max="100" value={wmOpacity} onChange={(e) => setWmOpacity(Number(e.target.value))} className="w-full h-1 bg-gray-300 rounded-lg appearance-none cursor-pointer accent-blue-600"/>
                     </div>
                </div>
                <p className="text-[10px] text-blue-600 font-medium flex items-center gap-1">
                    <Hand size={12} /> Arraste a logo na imagem para posicionar
                </p>
            </div>

            {/* 5. Image Adjustments */}
            {imagePreview && (
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 space-y-4">
                     <label className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1">
                        <Sliders size={14}/> 5. Ajustes de Imagem
                    </label>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <span className="text-[10px] text-gray-500 uppercase flex items-center gap-1"><Sun size={10}/> Brilho</span>
                            <input type="range" min="50" max="150" value={brightness} onChange={(e) => setBrightness(Number(e.target.value))} className="w-full h-1 bg-gray-300 rounded-lg appearance-none cursor-pointer accent-purple-600"/>
                        </div>
                        <div className="space-y-1">
                            <span className="text-[10px] text-gray-500 uppercase flex items-center gap-1"><Contrast size={10}/> Contraste</span>
                            <input type="range" min="50" max="150" value={contrast} onChange={(e) => setContrast(Number(e.target.value))} className="w-full h-1 bg-gray-300 rounded-lg appearance-none cursor-pointer accent-purple-600"/>
                        </div>
                        <div className="space-y-1">
                            <span className="text-[10px] text-gray-500 uppercase flex items-center gap-1"><Move size={10}/> Zoom</span>
                            <input type="range" min="50" max="150" value={scale} onChange={(e) => setScale(Number(e.target.value))} className="w-full h-1 bg-gray-300 rounded-lg appearance-none cursor-pointer accent-purple-600"/>
                        </div>
                        <div className="space-y-1">
                            <span className="text-[10px] text-gray-500 uppercase flex items-center gap-1"><Droplet size={10}/> Saturação</span>
                            <input type="range" min="0" max="200" value={saturation} onChange={(e) => setSaturation(Number(e.target.value))} className="w-full h-1 bg-gray-300 rounded-lg appearance-none cursor-pointer accent-purple-600"/>
                        </div>
                        <div className="space-y-1 col-span-2">
                             <div className="flex gap-4">
                                <div className="flex-1">
                                    <span className="text-[10px] text-gray-500 uppercase flex items-center gap-1"><MoveHorizontal size={10}/> Mover Horizontal</span>
                                    <input type="range" min="-50" max="50" value={imgPosX} onChange={(e) => setImgPosX(Number(e.target.value))} className="w-full h-1 bg-gray-300 rounded-lg appearance-none cursor-pointer accent-blue-600"/>
                                </div>
                                <div className="flex-1">
                                    <span className="text-[10px] text-gray-500 uppercase flex items-center gap-1"><MoveVertical size={10}/> Mover Vertical</span>
                                    <input type="range" min="-50" max="50" value={imgPosY} onChange={(e) => setImgPosY(Number(e.target.value))} className="w-full h-1 bg-gray-300 rounded-lg appearance-none cursor-pointer accent-blue-600"/>
                                </div>
                             </div>
                        </div>
                    </div>
                </div>
            )}

             {/* 6. Mode Selection & Promo Details ... */}
             <div className="space-y-2">
                <label className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1">
                    <Layers size={14}/> 6. Tipo de Post
                </label>
                <div className="flex bg-gray-100 p-1 rounded-lg">
                    <button 
                        onClick={() => setMode('standard')}
                        className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${mode === 'standard' ? 'bg-white shadow text-purple-700' : 'text-gray-500'}`}
                    >
                        Institucional
                    </button>
                    <button 
                        onClick={() => setMode('promo')}
                        className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${mode === 'promo' ? 'bg-white shadow text-purple-700' : 'text-gray-500'}`}
                    >
                        Promoção
                    </button>
                </div>
            </div>

            {/* 7. Promo Details (Conditional) */}
            {mode === 'promo' && (
                <div className="bg-purple-50 p-4 rounded-xl space-y-4 border border-purple-100 animate-in slide-in-from-top-2 duration-300">
                     <div className="flex justify-between items-center">
                        <label className="text-xs font-bold text-purple-800 uppercase tracking-wider flex items-center gap-1">
                            <DollarSign size={14}/> Dados da Promoção
                        </label>
                     </div>
                    
                    {/* ENHANCED STYLE CONTROLS */}
                    <div className="bg-white p-4 rounded-xl border border-purple-100 space-y-4 shadow-sm">
                         <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-wider border-b border-gray-100 pb-2 mb-2 flex items-center gap-1">
                             <PaintBucket size={12}/> Personalização Visual
                         </h4>

                         {/* Font Selector */}
                         <div className="space-y-1">
                             <div className="flex justify-between items-center text-[10px] text-gray-500 font-bold mb-1">
                                 <span>FONTE (TIPOGRAFIA)</span>
                                 <span>{activeFontIndex + 1}/{PROMO_FONTS.length}</span>
                             </div>
                             <div className="flex items-center justify-between bg-gray-50 p-2 rounded-lg border border-gray-200 group">
                                 <button onClick={handlePrevFont} className="p-1.5 hover:bg-white hover:shadow-sm rounded-md text-gray-500 hover:text-purple-700 transition-all"><ChevronLeft size={16} /></button>
                                 <div className="flex-1 text-center">
                                     <span className="text-lg text-gray-800 block leading-tight" style={{ fontFamily: PROMO_FONTS[activeFontIndex] }}>{PROMO_FONTS[activeFontIndex]}</span>
                                     <span className="text-[9px] text-gray-400">Estilo do Texto</span>
                                 </div>
                                 <button onClick={handleNextFont} className="p-1.5 hover:bg-white hover:shadow-sm rounded-md text-gray-500 hover:text-purple-700 transition-all"><ChevronRight size={16} /></button>
                             </div>
                         </div>
                         
                         {/* Colors */}
                         <div className="space-y-1 pt-2 border-t border-gray-50">
                            <span className="text-[10px] font-bold text-gray-500 uppercase block mb-2">PALETA DE CORES</span>
                            <div className="flex gap-2 justify-between px-1">
                                {PROMO_COLORS.map((color, idx) => (
                                    <button 
                                        key={color.name}
                                        onClick={() => setActiveColorIndex(idx)}
                                        className={`w-8 h-8 rounded-full border-2 transition-all relative ${activeColorIndex === idx ? 'scale-110 border-gray-600 shadow-md ring-2 ring-offset-1 ring-purple-200' : 'border-transparent opacity-90 hover:opacity-100 hover:scale-105'}`}
                                        style={{ background: `linear-gradient(135deg, ${color.from}, ${color.to})` }}
                                        title={color.name}
                                    >
                                        {activeColorIndex === idx && <div className="absolute inset-0 flex items-center justify-center"><div className="w-2 h-2 bg-white rounded-full shadow-sm"></div></div>}
                                    </button>
                                ))}
                            </div>
                         </div>

                         {/* Shapes Row */}
                         <div className="grid grid-cols-2 gap-4 pt-3 border-t border-dashed border-gray-200">
                             <div>
                                 <span className="text-[9px] text-gray-400 font-bold block mb-1">FAIXA</span>
                                 <div className="flex bg-gray-100 rounded-md p-0.5">
                                     <button onClick={() => setRibbonShape('classic')} className={`flex-1 p-1.5 flex justify-center rounded transition-all ${ribbonShape === 'classic' ? 'bg-white shadow text-purple-700' : 'text-gray-400 hover:text-gray-600'}`} title="Clássica"><Copy size={14}/></button>
                                     <button onClick={() => setRibbonShape('modern')} className={`flex-1 p-1.5 flex justify-center rounded transition-all ${ribbonShape === 'modern' ? 'bg-white shadow text-purple-700' : 'text-gray-400 hover:text-gray-600'}`} title="Moderna"><Square size={14} className="rounded-sm"/></button>
                                     <button onClick={() => setRibbonShape('minimal')} className={`flex-1 p-1.5 flex justify-center rounded transition-all ${ribbonShape === 'minimal' ? 'bg-white shadow text-purple-700' : 'text-gray-400 hover:text-gray-600'}`} title="Minimalista"><Square size={14}/></button>
                                 </div>
                             </div>
                             <div>
                                 <span className="text-[9px] text-gray-400 font-bold block mb-1">SELO</span>
                                 <div className="flex bg-gray-100 rounded-md p-0.5">
                                     <button onClick={() => setBadgeShape('circle')} className={`flex-1 p-1.5 flex justify-center rounded transition-all ${badgeShape === 'circle' ? 'bg-white shadow text-purple-700' : 'text-gray-400 hover:text-gray-600'}`} title="Círculo"><Circle size={14}/></button>
                                     <button onClick={() => setBadgeShape('burst')} className={`flex-1 p-1.5 flex justify-center rounded transition-all ${badgeShape === 'burst' ? 'bg-white shadow text-purple-700' : 'text-gray-400 hover:text-gray-600'}`} title="Explosão"><Star size={14}/></button>
                                     <button onClick={() => setBadgeShape('tag')} className={`flex-1 p-1.5 flex justify-center rounded transition-all ${badgeShape === 'tag' ? 'bg-white shadow text-purple-700' : 'text-gray-400 hover:text-gray-600'}`} title="Etiqueta"><Hexagon size={14}/></button>
                                 </div>
                             </div>
                         </div>
                    </div>

                    {/* Data Fields */}
                    <div className="space-y-1">
                        <span className="text-xs text-gray-500">Editar Selo</span>
                        <div className="relative">
                            <Type className="absolute left-3 top-2.5 text-purple-400" size={16}/>
                            <input 
                                value={callToAction}
                                onChange={(e) => setCallToAction(e.target.value)}
                                placeholder="POR APENAS" 
                                className="w-full pl-9 px-3 py-2 bg-white border border-purple-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 outline-none text-gray-900 placeholder-gray-400 font-bold" 
                            />
                        </div>
                    </div>

                    <div className="space-y-1">
                        <span className="text-xs text-gray-500">Título da Oferta</span>
                        <div className="relative">
                            <Type className="absolute left-3 top-2.5 text-purple-400" size={16}/>
                            <input 
                                value={promoName}
                                onChange={(e) => setPromoName(e.target.value)}
                                placeholder="Nome da Oferta" 
                                className="w-full pl-9 px-3 py-2 bg-white border border-purple-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 outline-none text-gray-900 placeholder-gray-400 font-bold" 
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                            <span className="text-xs text-gray-500">De (R$)</span>
                            <input 
                                value={priceOriginal}
                                onChange={(e) => setPriceOriginal(e.target.value)}
                                placeholder="0,00" 
                                className="w-full px-3 py-2 bg-white border border-purple-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 outline-none text-gray-900 placeholder-gray-400 font-medium" 
                            />
                        </div>
                        <div className="space-y-1">
                            <span className="text-xs text-gray-500 font-bold">Por (R$)</span>
                            <input 
                                value={pricePromo}
                                onChange={(e) => setPricePromo(e.target.value)}
                                placeholder="0,00" 
                                className="w-full px-3 py-2 bg-white border border-red-200 text-red-600 font-bold rounded-lg text-sm focus:ring-2 focus:ring-red-500 outline-none placeholder-red-200" 
                            />
                        </div>
                    </div>

                    {/* FREE POSITIONING CONTROLS (Removed Pos Sliders, Kept Scale) */}
                    <div className="pt-2 border-t border-purple-200">
                         <label className="text-[10px] font-bold text-purple-800 uppercase mb-2 block flex items-center gap-1">
                             <MousePointer2 size={10} /> Tamanho
                         </label>
                         
                         <div className="space-y-3">
                             {/* Ribbon Controls */}
                             <div>
                                 <div className="flex justify-between items-center mb-1">
                                    <span className="text-[10px] text-gray-500 font-bold">Faixa (Título)</span>
                                    <span className="text-[9px] text-gray-400">{ribbonScale}%</span>
                                 </div>
                                 <div className="flex items-center gap-2 mb-1">
                                    <ZoomIn size={12} className="text-gray-400" />
                                    <input type="range" min="50" max="200" value={ribbonScale} onChange={(e) => setRibbonScale(Number(e.target.value))} className="flex-1 h-1 bg-gray-300 rounded-lg appearance-none cursor-pointer accent-red-500" title="Tamanho"/>
                                 </div>
                             </div>

                             {/* Badge Controls */}
                             <div>
                                 <div className="flex justify-between items-center mb-1">
                                    <span className="text-[10px] text-gray-500 font-bold">Selo (Preço)</span>
                                    <span className="text-[9px] text-gray-400">{badgeScale}%</span>
                                 </div>
                                 <div className="flex items-center gap-2 mb-1">
                                    <ZoomIn size={12} className="text-gray-400" />
                                    <input type="range" min="50" max="200" value={badgeScale} onChange={(e) => setBadgeScale(Number(e.target.value))} className="flex-1 h-1 bg-gray-300 rounded-lg appearance-none cursor-pointer accent-yellow-500" title="Tamanho"/>
                                 </div>
                             </div>
                         </div>
                         <p className="text-[10px] text-blue-600 font-medium flex items-center gap-1 mt-2">
                             <Hand size={12} /> Arraste os elementos na imagem
                         </p>
                    </div>
                </div>
            )}
        </div>

        {/* RIGHT PANEL: PREVIEW */}
        <div className="flex-1 bg-gray-100/50 relative flex flex-col items-center justify-center p-4 md:p-8 overflow-hidden">
          <canvas ref={canvasRef} className="hidden" />

          {/* Preview Container */}
          <div 
             ref={previewRef}
             className={`relative shadow-2xl rounded-sm overflow-hidden bg-white transition-all duration-300 select-none ${isDragging ? 'cursor-grabbing' : 'cursor-default'}`}
             style={{
                 width: aspectRatio === '1:1' ? 'min(500px, 90vw)' : 'min(360px, 90vw)',
                 aspectRatio: aspectRatio === '1:1' ? '1/1' : '9/16'
             }}
             onMouseDown={handleCanvasMouseDown}
             onMouseMove={handleCanvasMouseMove}
             onMouseUp={handleCanvasMouseUp}
             onMouseLeave={handleCanvasMouseUp}
             onTouchStart={handleCanvasMouseDown}
             onTouchMove={handleCanvasMouseMove}
             onTouchEnd={handleCanvasMouseUp}
          >
              {generatedImage ? (
                  <img 
                      src={generatedImage} 
                      alt="Preview" 
                      className="w-full h-full object-contain pointer-events-none" 
                  />
              ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-gray-300 gap-2">
                      <ImageIcon size={48} />
                      <span className="text-xs">Aguardando Imagem...</span>
                  </div>
              )}
          </div>

          <div className="mt-8 flex gap-4 z-20">
              <button 
                  onClick={downloadImage}
                  disabled={!generatedImage}
                  className="bg-purple-600 hover:bg-purple-700 text-white px-8 py-3 rounded-full shadow-lg shadow-purple-200 font-bold flex items-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:scale-105 active:scale-95"
              >
                  <Download size={20} />
                  {formatType === 'carousel' ? 'Baixar Todos' : 'Baixar Arte'}
              </button>
          </div>

          {/* Carousel Navigation */}
          {formatType === 'carousel' && carouselPreviews.length > 0 && (
              <div className="absolute bottom-6 left-0 right-0 flex justify-center gap-2 px-4 overflow-x-auto py-2 z-10">
                  <div className="flex gap-2 bg-white/80 backdrop-blur-md p-2 rounded-xl border border-white/50 shadow-lg">
                    {carouselPreviews.map((src, idx) => (
                        <div 
                           key={idx} 
                           onClick={() => handleSelectCarouselImage(idx)}
                           className={`w-12 h-12 rounded-lg border-2 overflow-hidden cursor-pointer transition-all relative ${activeCarouselIndex === idx ? 'border-purple-600 scale-110 shadow-md ring-2 ring-purple-200' : 'border-transparent opacity-70 hover:opacity-100'}`}
                        >
                            <img src={src} className="w-full h-full object-cover" />
                            <div className="absolute top-0 right-0 bg-black/50 text-white text-[8px] px-1">{idx+1}</div>
                        </div>
                    ))}
                  </div>
              </div>
          )}

          {/* Background decoration */}
          <div className="absolute inset-0 pointer-events-none opacity-30" style={{
              backgroundImage: 'radial-gradient(#cbd5e1 1px, transparent 1px)',
              backgroundSize: '20px 20px'
          }}></div>

        </div>
    </div>
  );
};

export default InstagramMarketing;
