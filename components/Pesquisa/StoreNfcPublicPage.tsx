import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabaseClient';
import { MessageCircle, ExternalLink, MessageSquare, PhoneCall, Loader2, QrCode, Instagram, Facebook, Star, Award, ShieldCheck, CreditCard, ChevronRight, CheckCircle2, MapPin, Check } from 'lucide-react';

interface StoreNfcPublicPageProps {
  storeNumber: string;
}

const StoreNfcPublicPage: React.FC<StoreNfcPublicPageProps> = ({ storeNumber }) => {
  const [data, setData] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);
  const [showPix, setShowPix] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const fetchStoreData = async () => {
      try {
        const { data: nfcPage, error: nfcError } = await supabase
          .from('store_nfc_pages')
          .select('*, surveys(public_token), stores!inner(name, city, number, state)')
          .eq('stores.number', Number(storeNumber))
          .eq('is_active', true)
          .single();

        if (nfcError) throw nfcError;

        setData({
          store: nfcPage.stores,
          nfcPage: nfcPage
        });
      } catch (err) {
        console.error("Erro ao buscar página NFC:", err);
        setError(true);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStoreData();
  }, [storeNumber]);

  if (isLoading) {
    return (
      <div style={{ minHeight: '100vh', background: '#F7F5F2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{ minHeight: '100vh', background: '#F7F5F2', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px', textAlign: 'center' }}>
        <div style={{ width: '64px', height: '64px', background: '#EAE6DF', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '24px' }}>
          <span style={{ fontSize: '24px' }}>⚠️</span>
        </div>
        <h2 style={{ fontSize: '20px', fontWeight: 900, color: '#4A4540', textTransform: 'uppercase', marginBottom: '8px', fontFamily: "'Inter', sans-serif" }}>Ops!</h2>
        <p style={{ color: '#9B9189', fontWeight: 500, fontFamily: "'Inter', sans-serif" }}>Página não encontrada ou desativada.</p>
      </div>
    );
  }

  const { store, nfcPage } = data;
  const surveyUrl = nfcPage.surveys?.public_token ? `/pesquisa/${nfcPage.surveys.public_token}?loja=${store.number}` : null;

  // ESTILOS
  const pageStyle: React.CSSProperties = { fontFamily: "'Inter', sans-serif", maxWidth: '390px', margin: '0 auto', background: '#F7F5F2', minHeight: '100vh' };
  const heroStyle: React.CSSProperties = { background: 'linear-gradient(160deg, #C8102E 0%, #8B0A1F 40%, #1B2A6B 100%)', padding: '56px 28px 48px' };

  const contentStyle: React.CSSProperties = { padding: '28px 20px 40px', display: 'flex', flexDirection: 'column', gap: '12px' };
  const sectionLabelStyle: React.CSSProperties = { fontSize: '10px', fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', color: '#9B9189', marginTop: '16px', marginBottom: '4px', paddingLeft: '4px' };
  
  const actionCardStyle: React.CSSProperties = { background: 'white', borderRadius: '18px', padding: '18px 20px', display: 'flex', alignItems: 'center', gap: '16px', border: '1px solid rgba(0,0,0,0.06)', width: '100%', cursor: 'pointer', textDecoration: 'none', color: 'inherit', outline: 'none' };
  const iconWrapStyle: React.CSSProperties = { width: '48px', height: '48px', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 };
  
  const cardPixStyle: React.CSSProperties = { ...actionCardStyle, background: 'linear-gradient(135deg, #32BCAD, #1A8F83)', border: 'none', color: 'white' };
  const cardPesquisaStyle: React.CSSProperties = { ...actionCardStyle, background: 'linear-gradient(135deg, #1B2A6B, #2E47B0)', border: 'none', color: 'white' };

  const cardTitleStyle: React.CSSProperties = { fontSize: '15px', fontWeight: 800, marginBottom: '2px', color: '#1A1815' };
  const cardDescStyle: React.CSSProperties = { fontSize: '12px', fontWeight: 500, color: '#9B9189' };

  const footerStyle: React.CSSProperties = { padding: '32px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', marginTop: '24px' };

  return (
    <div style={{fontFamily:"'Inter',sans-serif",maxWidth:'480px',margin:'0 auto',background:'#F7F7F7',minHeight:'100vh',position:'relative'}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        @keyframes fadeUp{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:translateY(0)}}
        .f1{animation:fadeUp .5s ease both}
        .f2{animation:fadeUp .5s .1s ease both}
        .f3{animation:fadeUp .5s .18s ease both}
        .f4{animation:fadeUp .5s .26s ease both}
        .f5{animation:fadeUp .5s .34s ease both}
        .f6{animation:fadeUp .5s .42s ease both}
        .tap{transition:transform .15s,opacity .15s;cursor:pointer}
        .tap:active{transform:scale(0.97);opacity:0.9}
        .whatsapp-pattern {
            background-image: url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.03'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E");
        }
      `}</style>

      {/* ── HERO ── */}
      <div className="f1" style={{position:'relative',borderRadius:'0 0 48px 48px',overflow:'hidden',paddingBottom:'40px',background:'#1a0005',marginBottom:'-24px', zIndex: 1, boxShadow:'0 10px 30px rgba(0,0,0,0.1)'}}>
        <img
          src="https://rwwomakjhmglgoowbmsl.supabase.co/storage/v1/object/public/Fotos/fachada-loja.jpg"
          alt="Loja Real Calçados"
          style={{position:'absolute',top:0,left:0,width:'100%',height:'100%',objectFit:'cover',opacity:0.5,display:'block'}}
          onError={(e:any)=>{e.target.style.display='none'}}
        />
        <div style={{position:'absolute',inset:0,background:'linear-gradient(180deg, rgba(200,16,46,0.55) 0%, rgba(0,0,0,0.60) 100%)'}}/>
        <div style={{position:'relative',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:'12px',padding:'48px 24px 24px'}}>
          <img
            src="https://rwwomakjhmglgoowbmsl.supabase.co/storage/v1/object/public/Fotos/logo-real.webp"
            alt="Real Calçados"
            style={{width:'110px',height:'110px',objectFit:'contain',filter:'brightness(0) invert(1)',marginBottom:'0px'}}
          />
          <h1 style={{fontSize:'28px',fontWeight:900,color:'white',letterSpacing:'-0.5px',textAlign:'center',margin:0}}>Real Calçados</h1>
          
          <div style={{display:'flex',alignItems:'center',gap:'8px',background:'#C8102E',border:'1px solid rgba(255,255,255,0.1)',borderRadius:'20px',padding:'6px 16px',marginTop:'4px',boxShadow:'0 4px 15px rgba(200,16,46,0.5)'}}>
            <CheckCircle2 color="white" size={16} fill="transparent" strokeWidth={3} />
            <span style={{fontSize:'12px',fontWeight:800,color:'white',letterSpacing:'1px',textTransform:'uppercase'}}>Loja Oficial</span>
          </div>
          
          <div style={{display:'flex',alignItems:'center',gap:'6px',background:'transparent',borderRadius:'20px',padding:'6px 16px',marginTop:'4px'}}>
            <MapPin size={14} color="white" />
            <span style={{fontSize:'12px',fontWeight:600,color:'rgba(255,255,255,0.95)'}}>
              {store.city} • {store.state === 'BA' ? 'Bahia' : store.state === 'PE' ? 'Pernambuco' : store.state}
            </span>
          </div>
        </div>
      </div>

      <div style={{padding:'0 18px 48px',display:'flex',flexDirection:'column',gap:'14px',position:'relative',zIndex:2}}>

        {/* ── CARD PROMO ── */}
        <div className="f2 tap" style={{borderRadius:'16px',overflow:'hidden',background:'linear-gradient(90deg, #9b0000 0%, #d30000 50%, #9b0000 100%)',padding:'24px 20px',display:'flex',alignItems:'center',gap:'16px',position:'relative',boxShadow:'0 10px 20px rgba(180,10,30,0.3)'}}>
          <div style={{position:'absolute',top:0,left:0,bottom:0,right:0,background:'radial-gradient(circle at 100% 50%, rgba(255,255,255,0.15) 0%, transparent 60%)'}}/>
          
          <div style={{fontSize:'50px',flexShrink:0,filter:'drop-shadow(2px 4px 6px rgba(0,0,0,0.4))', position:'relative', zIndex: 1}}>🛍️</div>
          
          <div style={{flex:1, position:'relative', zIndex: 1, display:'flex', flexDirection:'column', justifyContent:'center'}}>
            <p style={{fontSize:'12px',fontWeight:800,color:'white',textTransform:'uppercase',margin:'0 0 2px'}}>Tudo em até</p>
            <div style={{display:'flex', alignItems:'center', gap:'12px', marginTop:'4px', marginBottom:'4px'}}>
               <span style={{fontSize:'64px',fontWeight:900,color:'white',lineHeight:0.8,letterSpacing:'-3px'}}>10X</span>
               <div style={{display:'flex', flexDirection:'column', justifyContent:'center'}}>
                 <span style={{color:'#FCD34D',fontSize:'18px',fontWeight:900,lineHeight:1}}>SEM</span>
                 <span style={{color:'#FCD34D',fontSize:'22px',fontWeight:900,lineHeight:1}}>JUROS</span>
               </div>
            </div>
            <p style={{fontSize:'10px',color:'rgba(255,255,255,0.9)',fontWeight:500,margin:'4px 0 0'}}>As melhores marcas e condições da região!</p>
          </div>
          
          <div style={{flexShrink:0,width:'60px',height:'60px',background:'linear-gradient(135deg,#FFD700,#FFA500)',borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'28px',fontWeight:900, color:'white',boxShadow:'0 0 15px rgba(255,165,0,0.6), inset 0 0 10px rgba(255,255,255,0.5)', position:'relative', zIndex: 1, border: '2px solid rgba(255,255,255,0.3)', textShadow:'0 2px 4px rgba(0,0,0,0.2)'}}>%</div>
        </div>

        {/* ── GRID ATALHOS ── */}
        <div className="f3" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'12px'}}>
          {nfcPage.show_instagram && nfcPage.instagram && (
            <a href={`https://instagram.com/${nfcPage.instagram}`} target="_blank" rel="noopener noreferrer" className="tap" style={{background:'white',borderRadius:'16px',padding:'16px',display:'flex',alignItems:'center',gap:'12px',textDecoration:'none',boxShadow:'0 4px 15px rgba(0,0,0,0.04)'}}>
              <div style={{width:'60px',height:'60px',borderRadius:'12px',background:'linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                 <Instagram color="white" size={28} />
              </div>
              <div style={{flex:1}}>
                <p style={{fontSize:'18px',fontWeight:800,color:'#1A1815',margin:'0 0 2px'}}>Instagram</p>
                <p style={{fontSize:'10px',color:'#7A7570',fontWeight:500,margin:0,lineHeight:1.3}}>Siga nosso perfil e fique por dentro!</p>
              </div>
              <ChevronRight size={16} color="#ccc" />
            </a>
          )}
          {nfcPage.show_pix && nfcPage.pix_key && (
            <button onClick={()=>setShowPix(!showPix)} className="tap" style={{background:'white',borderRadius:'16px',padding:'16px',display:'flex',alignItems:'center',gap:'12px',border:'none',cursor:'pointer',textAlign:'left',boxShadow:'0 4px 15px rgba(0,0,0,0.04)',width:'100%'}}>
              <div style={{width:'60px',height:'60px',borderRadius:'12px',background:'#32BCAD',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                 <QrCode color="white" size={28} />
              </div>
              <div style={{flex:1}}>
                <p style={{fontSize:'18px',fontWeight:800,color:'#1A1815',margin:'0 0 2px'}}>Pagar com Pix</p>
                <p style={{fontSize:'10px',color:'#7A7570',fontWeight:500,margin:0,lineHeight:1.3}}>Pagamento rápido, prático e seguro</p>
              </div>
              <ChevronRight size={16} color="#ccc" />
            </button>
          )}
          {nfcPage.google_review_url && (
            <a href={nfcPage.google_review_url} target="_blank" rel="noopener noreferrer" className="tap" style={{background:'white',borderRadius:'16px',padding:'16px',display:'flex',alignItems:'center',gap:'12px',textDecoration:'none',boxShadow:'0 4px 15px rgba(0,0,0,0.04)'}}>
              <div style={{width:'60px',height:'60px',borderRadius:'12px',background:'#FFC107',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                 <Star color="white" size={28} fill="white" />
              </div>
              <div style={{flex:1}}>
                <p style={{fontSize:'18px',fontWeight:800,color:'#1A1815',margin:'0 0 2px'}}>Avaliar no Google</p>
                <p style={{fontSize:'10px',color:'#7A7570',fontWeight:500,margin:0,lineHeight:1.3}}>Sua opinião faz toda a diferença!</p>
              </div>
              <ChevronRight size={16} color="#ccc" />
            </a>
          )}
          {nfcPage.show_survey && surveyUrl && (
            <button onClick={()=>{window.location.href=surveyUrl}} className="tap" style={{background:'white',borderRadius:'16px',padding:'16px',display:'flex',alignItems:'center',gap:'12px',border:'none',cursor:'pointer',textAlign:'left',boxShadow:'0 4px 15px rgba(0,0,0,0.04)',width:'100%'}}>
              <div style={{width:'60px',height:'60px',borderRadius:'12px',background:'#1B2A6B',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                 <MessageSquare color="white" size={28} fill="white" />
              </div>
              <div style={{flex:1}}>
                <p style={{fontSize:'18px',fontWeight:800,color:'#1A1815',margin:'0 0 2px'}}>Sua Experiência</p>
                <p style={{fontSize:'10px',color:'#7A7570',fontWeight:500,margin:0,lineHeight:1.3}}>Conte pra gente como foi sua experiência</p>
              </div>
              <ChevronRight size={16} color="#ccc" />
            </button>
          )}
        </div>

        {/* PIX EXPANDIDO */}
        {showPix && nfcPage.pix_key && (
          <div style={{background:'white',borderRadius:'16px',padding:'24px',boxShadow:'0 4px 15px rgba(0,0,0,0.04)',display:'flex',flexDirection:'column',alignItems:'center',gap:'16px'}}>
            {nfcPage.pix_qrcode_url && <img src={nfcPage.pix_qrcode_url} alt="QR Code" style={{width:'200px',height:'200px',borderRadius:'12px'}}/>}
            <div style={{background:'#F7F5F2',borderRadius:'12px',padding:'12px 16px',width:'100%',display:'flex',alignItems:'center',gap:'8px'}}>
              <span style={{fontSize:'12px',color:'#4A4540',fontWeight:500,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',flex:1}}>{nfcPage.pix_key}</span>
              <button onClick={()=>{navigator.clipboard.writeText(nfcPage.pix_key);setCopied(true);setTimeout(()=>setCopied(false),2000)}} style={{background:copied?'#32BCAD':'#1B2A6B',color:'white',border:'none',borderRadius:'8px',padding:'8px 12px',fontSize:'12px',fontWeight:700,cursor:'pointer',whiteSpace:'nowrap'}}>
                {copied?'Copiado ✓':'Copiar chave'}
              </button>
            </div>
          </div>
        )}

        {/* ── DIFERENCIAIS ── */}
        <div className="f4" style={{background:'white',borderRadius:'16px',padding:'20px 16px',boxShadow:'0 4px 15px rgba(0,0,0,0.04)',display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'12px'}}>
          <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:'8px',textAlign:'center'}}>
            <Award color="#C8102E" size={28} />
            <div>
              <p style={{fontSize:'11px',fontWeight:800,color:'#1A1815',lineHeight:1.1,marginBottom:'4px'}}>+30 anos de tradição</p>
              <p style={{fontSize:'9px',color:'#7A7570',fontWeight:500,lineHeight:1.2}}>Calçando famílias baianas</p>
            </div>
          </div>
          <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:'8px',textAlign:'center'}}>
            <ShieldCheck color="#C8102E" size={28} />
            <div>
              <p style={{fontSize:'11px',fontWeight:800,color:'#1A1815',lineHeight:1.1,marginBottom:'4px'}}>Marcas Originais</p>
              <p style={{fontSize:'9px',color:'#7A7570',fontWeight:500,lineHeight:1.2}}>Qualidade e procedência garantida</p>
            </div>
          </div>
          <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:'8px',textAlign:'center'}}>
            <CreditCard color="#C8102E" size={28} />
            <div>
              <p style={{fontSize:'11px',fontWeight:800,color:'#1A1815',lineHeight:1.1,marginBottom:'4px'}}>Até 10x sem juros</p>
              <p style={{fontSize:'9px',color:'#7A7570',fontWeight:500,lineHeight:1.2}}>Condições especiais pra você</p>
            </div>
          </div>
        </div>

        {/* ── WHATSAPP ── */}
        {nfcPage.show_whatsapp_store && nfcPage.whatsapp_store && (
          <div className="f5 whatsapp-pattern" style={{backgroundColor:'#161719',borderRadius:'24px',padding:'24px',display:'flex',flexDirection:'column',gap:'16px',boxShadow:'0 8px 20px rgba(0,0,0,0.1)'}}>
            <div style={{display:'flex',alignItems:'center',gap:'16px'}}>
              <div style={{flexShrink:0}}>
                <MessageCircle color="white" size={48} strokeWidth={1.5} />
              </div>
              <div style={{flex:1}}>
                <p style={{fontSize:'12px',color:'rgba(255,255,255,0.7)',fontWeight:500,margin:'0 0 2px'}}>Dúvidas? Fale conosco!</p>
                <p style={{fontSize:'18px',fontWeight:800,color:'white',margin:'0 0 2px',letterSpacing:'-0.3px'}}>Atendimento via WhatsApp</p>
                <p style={{fontSize:'12px',color:'rgba(255,255,255,0.5)',margin:0,lineHeight:1.1}}>Estamos prontos para te atender</p>
              </div>
            </div>
            <a href={`https://wa.me/55${nfcPage.whatsapp_store}`} target="_blank" rel="noopener noreferrer" className="tap" style={{background:'#25D366',borderRadius:'16px',padding:'16px',display:'flex',alignItems:'center',justifyContent:'center',gap:'8px',textDecoration:'none',width:'100%',boxShadow:'0 4px 15px rgba(37,211,102,0.4)'}}>
              <MessageCircle color="white" size={20} />
              <span style={{fontSize:'16px',fontWeight:900,color:'white',letterSpacing:'0.5px'}}>FALAR AGORA</span>
            </a>
          </div>
        )}

        {/* ── REAL BENEFÍCIOS (Opcional, mantido parecido) ── */}
        {nfcPage.show_whatsapp_beneficios && nfcPage.whatsapp_beneficios && (
          <div className="f6" style={{background:'linear-gradient(135deg,#00A86B,#16A34A)',borderRadius:'24px',padding:'24px',display:'flex',flexDirection:'column',gap:'16px',position:'relative',overflow:'hidden',boxShadow:'0 8px 20px rgba(0,168,107,0.2)'}}>
            <div style={{position:'absolute',top:-30,right:-30,width:'120px',height:'120px',background:'rgba(255,255,255,0.07)',borderRadius:'50%'}}/>
            <div>
              <div style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'6px'}}>
                <span style={{fontSize:'20px'}}>💚</span>
                <p style={{fontSize:'20px',fontWeight:900,color:'white',margin:0,letterSpacing:'-0.5px'}}>REAL BENEFÍCIOS</p>
              </div>
              <p style={{fontSize:'14px',color:'rgba(255,255,255,0.9)',fontWeight:600,margin:0,lineHeight:1.3}}>Assistência Saúde<br/>para você e sua família</p>
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:'8px',marginTop:'4px'}}>
              {['Consultas','Exames','Benefícios Exclusivos'].map(item=>(
                <div key={item} style={{display:'flex',alignItems:'center',gap:'10px'}}>
                  <div style={{width:'20px',height:'20px',background:'rgba(255,255,255,0.3)',borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'12px',flexShrink:0,color:'white',fontWeight:800}}>✓</div>
                  <span style={{fontSize:'14px',fontWeight:700,color:'white'}}>{item}</span>
                </div>
              ))}
            </div>
            <a href={`https://wa.me/55${nfcPage.whatsapp_beneficios}`} target="_blank" rel="noopener noreferrer" className="tap" style={{background:'white',borderRadius:'16px',padding:'16px',textAlign:'center',textDecoration:'none',display:'block',marginTop:'8px',boxShadow:'0 4px 15px rgba(0,0,0,0.1)'}}>
              <span style={{fontSize:'15px',fontWeight:900,color:'#16A34A'}}>CONHECER BENEFÍCIOS</span>
            </a>
          </div>
        )}

        {/* ── FOOTER ── */}
        <div style={{padding:'24px 0 16px',display:'flex',flexDirection:'column',alignItems:'center',gap:'8px'}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'center',marginBottom:'8px'}}>
            <img 
              src="https://rwwomakjhmglgoowbmsl.supabase.co/storage/v1/object/public/Fotos/logo-real.webp" 
              alt="Real Calçados" 
              style={{width:'50px',height:'50px',objectFit:'contain', filter:'brightness(0.2) sepia(1) saturate(100) hue-rotate(330deg)'}}
            />
          </div>
          <p style={{fontSize:'15px',fontWeight:800,color:'#1A1815',margin:0,letterSpacing:'-0.3px'}}>Real Calçados</p>
          <p style={{fontSize:'12px',color:'#7A7570',margin:0,fontWeight:600}}>Desde 19XX <span style={{color:'#C8102E'}}>❤️</span></p>
          
          <div style={{display:'flex',gap:'12px',marginTop:'12px'}}>
            {nfcPage.instagram && (
              <a href={`https://instagram.com/${nfcPage.instagram}`} target="_blank" rel="noopener noreferrer" style={{width:'32px',height:'32px',background:'#1A1815',borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center'}}>
                <Instagram color="white" size={16} />
              </a>
            )}
            {nfcPage.whatsapp_store && (
              <a href={`https://wa.me/55${nfcPage.whatsapp_store}`} target="_blank" rel="noopener noreferrer" style={{width:'32px',height:'32px',background:'#1A1815',borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center'}}>
                <MessageCircle color="white" size={16} />
              </a>
            )}
            <a href="#" style={{width:'32px',height:'32px',background:'#1A1815',borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center'}}>
                <Facebook color="white" size={16} />
            </a>
          </div>
          <p style={{fontSize:'10px',color:'#C0BAB3',marginTop:'8px'}}>© 2026 · Todos os direitos reservados</p>
        </div>

      </div>
    </div>
  );
};

export default StoreNfcPublicPage;