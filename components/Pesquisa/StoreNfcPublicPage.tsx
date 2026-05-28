import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabaseClient';
import { MessageCircle, ExternalLink, MessageSquare, PhoneCall, Loader2, QrCode } from 'lucide-react';

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
    <div style={{fontFamily:"'Inter',sans-serif",maxWidth:'430px',margin:'0 auto',background:'#F2F2F2',minHeight:'100vh'}}>
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
      `}</style>

      {/* ── HERO ── */}
      <div className="f1" style={{position:'relative',borderRadius:'0 0 32px 32px',overflow:'hidden',minHeight:'300px',background:'#1a0005'}}>
        <img
          src="https://rwwomakjhmglgoowbmsl.supabase.co/storage/v1/object/public/Fotos/fachada-loja.jpg"
          alt="Loja Real Calçados"
          style={{width:'100%',height:'300px',objectFit:'cover',opacity:0.45,display:'block'}}
          onError={(e:any)=>{e.target.style.display='none'}}
        />
        <div style={{position:'absolute',inset:0,background:'linear-gradient(180deg,rgba(180,10,30,0.45) 0%,rgba(10,0,5,0.82) 100%)'}}/>
        <div style={{position:'absolute',inset:0,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:'10px',padding:'32px 24px'}}>
          <img
            src="https://rwwomakjhmglgoowbmsl.supabase.co/storage/v1/object/public/Fotos/logo-real.webp"
            alt="Real Calçados"
            style={{width:'90px',height:'90px',objectFit:'contain',filter:'brightness(0) invert(1)',marginBottom:'4px'}}
          />
          <h1 style={{fontSize:'26px',fontWeight:900,color:'white',letterSpacing:'-0.5px',textAlign:'center',margin:0}}>Real Calçados</h1>
          <div style={{display:'flex',alignItems:'center',gap:'6px',background:'rgba(255,255,255,0.15)',border:'1px solid rgba(255,255,255,0.3)',borderRadius:'20px',padding:'5px 14px'}}>
            <span style={{fontSize:'14px'}}>✅</span>
            <span style={{fontSize:'11px',fontWeight:700,color:'white',letterSpacing:'1px',textTransform:'uppercase'}}>Loja Oficial</span>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:'6px',background:'rgba(0,0,0,0.3)',border:'1px solid rgba(255,255,255,0.15)',borderRadius:'20px',padding:'5px 14px'}}>
            <span style={{fontSize:'13px'}}>📍</span>
            <span style={{fontSize:'12px',fontWeight:600,color:'rgba(255,255,255,0.85)'}}>
              {store.city} • {store.state === 'BA' ? 'Bahia' : store.state === 'PE' ? 'Pernambuco' : store.state}
            </span>
          </div>
        </div>
      </div>

      <div style={{padding:'16px 14px 48px',display:'flex',flexDirection:'column',gap:'12px'}}>

        {/* ── CARD PROMO ── */}
        <div className="f2 tap" style={{borderRadius:'24px',overflow:'hidden',background:'linear-gradient(135deg,#C8102E 0%,#8B0A1F 100%)',padding:'24px 20px',display:'flex',alignItems:'center',gap:'16px',position:'relative'}}>
          <div style={{position:'absolute',top:-20,right:-20,width:'100px',height:'100px',background:'rgba(255,255,255,0.05)',borderRadius:'50%'}}/>
          <div style={{fontSize:'56px',flexShrink:0}}>🛍️</div>
          <div style={{flex:1}}>
            <p style={{fontSize:'11px',fontWeight:700,color:'rgba(255,255,255,0.7)',letterSpacing:'1.5px',textTransform:'uppercase',margin:'0 0 4px'}}>Tudo em até</p>
            <p style={{fontSize:'38px',fontWeight:900,color:'white',lineHeight:0.95,margin:'0 0 2px',letterSpacing:'-2px'}}>10X <span style={{color:'#FFD700',fontSize:'32px'}}>SEM<br/>JUROS</span></p>
            <p style={{fontSize:'12px',color:'rgba(255,255,255,0.7)',fontWeight:500,margin:'6px 0 0'}}>As melhores marcas e condições da região!</p>
          </div>
          <div style={{flexShrink:0,width:'56px',height:'56px',background:'linear-gradient(135deg,#FFD700,#FFA500)',borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'24px',boxShadow:'0 4px 12px rgba(255,165,0,0.4)'}}>%</div>
        </div>

        {/* ── GRID ATALHOS ── */}
        <div className="f3" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px'}}>
          {nfcPage.show_instagram && nfcPage.instagram && (
            <a href={`https://instagram.com/${nfcPage.instagram}`} target="_blank" rel="noopener noreferrer" className="tap" style={{background:'white',borderRadius:'20px',padding:'16px',display:'flex',alignItems:'center',gap:'12px',textDecoration:'none',border:'1px solid rgba(0,0,0,0.06)'}}>
              <div style={{width:'52px',height:'52px',borderRadius:'14px',background:'linear-gradient(135deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'24px',flexShrink:0}}>📸</div>
              <div>
                <p style={{fontSize:'14px',fontWeight:800,color:'#1A1815',margin:'0 0 2px'}}>Instagram</p>
                <p style={{fontSize:'11px',color:'#9B9189',fontWeight:500,margin:0,lineHeight:1.3}}>Siga nosso perfil e fique por dentro!</p>
              </div>
              <span style={{marginLeft:'auto',color:'#ccc',fontSize:'18px'}}>›</span>
            </a>
          )}
          {nfcPage.show_pix && nfcPage.pix_key && (
            <button onClick={()=>setShowPix(!showPix)} className="tap" style={{background:'white',borderRadius:'20px',padding:'16px',display:'flex',alignItems:'center',gap:'12px',border:'1px solid rgba(0,0,0,0.06)',cursor:'pointer',textAlign:'left'}}>
              <div style={{width:'52px',height:'52px',borderRadius:'14px',background:'linear-gradient(135deg,#32BCAD,#1A8F83)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'24px',flexShrink:0}}>💠</div>
              <div>
                <p style={{fontSize:'14px',fontWeight:800,color:'#1A1815',margin:'0 0 2px'}}>Pagar com Pix</p>
                <p style={{fontSize:'11px',color:'#9B9189',fontWeight:500,margin:0,lineHeight:1.3}}>Pagamento rápido, prático e seguro</p>
              </div>
              <span style={{marginLeft:'auto',color:'#ccc',fontSize:'18px'}}>›</span>
            </button>
          )}
          {nfcPage.google_review_url && (
            <a href={nfcPage.google_review_url} target="_blank" rel="noopener noreferrer" className="tap" style={{background:'white',borderRadius:'20px',padding:'16px',display:'flex',alignItems:'center',gap:'12px',textDecoration:'none',border:'1px solid rgba(0,0,0,0.06)'}}>
              <div style={{width:'52px',height:'52px',borderRadius:'14px',background:'linear-gradient(135deg,#FFC107,#FF8F00)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'24px',flexShrink:0}}>⭐</div>
              <div>
                <p style={{fontSize:'14px',fontWeight:800,color:'#1A1815',margin:'0 0 2px'}}>Avaliar no Google</p>
                <p style={{fontSize:'11px',color:'#9B9189',fontWeight:500,margin:0,lineHeight:1.3}}>Sua opinião faz toda a diferença!</p>
              </div>
              <span style={{marginLeft:'auto',color:'#ccc',fontSize:'18px'}}>›</span>
            </a>
          )}
          {nfcPage.show_survey && surveyUrl && (
            <button onClick={()=>{window.location.href=surveyUrl}} className="tap" style={{background:'white',borderRadius:'20px',padding:'16px',display:'flex',alignItems:'center',gap:'12px',border:'1px solid rgba(0,0,0,0.06)',cursor:'pointer',textAlign:'left'}}>
              <div style={{width:'52px',height:'52px',borderRadius:'14px',background:'linear-gradient(135deg,#1B2A6B,#2E47B0)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'24px',flexShrink:0}}>💬</div>
              <div>
                <p style={{fontSize:'14px',fontWeight:800,color:'#1A1815',margin:'0 0 2px'}}>Sua Experiência</p>
                <p style={{fontSize:'11px',color:'#9B9189',fontWeight:500,margin:0,lineHeight:1.3}}>Conte pra gente como foi sua experiência</p>
              </div>
              <span style={{marginLeft:'auto',color:'#ccc',fontSize:'18px'}}>›</span>
            </button>
          )}
        </div>

        {/* PIX EXPANDIDO */}
        {showPix && nfcPage.pix_key && (
          <div style={{background:'white',borderRadius:'20px',padding:'24px',border:'1px solid rgba(0,0,0,0.06)',display:'flex',flexDirection:'column',alignItems:'center',gap:'16px'}}>
            {nfcPage.pix_qrcode_url && <img src={nfcPage.pix_qrcode_url} alt="QR Code" style={{width:'200px',height:'200px',borderRadius:'12px'}}/>}
            <div style={{background:'#F7F5F2',borderRadius:'12px',padding:'12px 16px',width:'100%',display:'flex',alignItems:'center',gap:'8px'}}>
              <span style={{fontSize:'12px',color:'#4A4540',fontWeight:500,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',flex:1}}>{nfcPage.pix_key}</span>
              <button onClick={()=>{navigator.clipboard.writeText(nfcPage.pix_key);setCopied(true);setTimeout(()=>setCopied(false),2000)}} style={{background:copied?'#32BCAD':'#1B2A6B',color:'white',border:'none',borderRadius:'10px',padding:'8px 14px',fontSize:'12px',fontWeight:700,cursor:'pointer',whiteSpace:'nowrap'}}>
                {copied?'Copiado ✓':'Copiar chave'}
              </button>
            </div>
          </div>
        )}

        {/* ── DIFERENCIAIS ── */}
        <div className="f4" style={{background:'white',borderRadius:'20px',padding:'20px',border:'1px solid rgba(0,0,0,0.06)',display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'12px'}}>
          {[
            {icon:'🏅',title:'Há mais de 30 anos',desc:'Calçando famílias baianas'},
            {icon:'🛡️',title:'Marcas Originais',desc:'Qualidade e procedência garantida'},
            {icon:'💳',title:'Até 10x sem juros',desc:'Condições especiais pra você'}
          ].map(item=>(
            <div key={item.title} style={{display:'flex',flexDirection:'column',alignItems:'center',gap:'6px',textAlign:'center'}}>
              <span style={{fontSize:'28px'}}>{item.icon}</span>
              <p style={{fontSize:'11px',fontWeight:800,color:'#1A1815',lineHeight:1.2}}>{item.title}</p>
              <p style={{fontSize:'10px',color:'#9B9189',fontWeight:500,lineHeight:1.3}}>{item.desc}</p>
            </div>
          ))}
        </div>

        {/* ── WHATSAPP ── */}
        {nfcPage.show_whatsapp_store && nfcPage.whatsapp_store && (
          <div className="f5" style={{background:'#111',borderRadius:'24px',padding:'20px',display:'flex',alignItems:'center',gap:'16px'}}>
            <div style={{width:'52px',height:'52px',background:'rgba(255,255,255,0.08)',borderRadius:'16px',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'28px',flexShrink:0}}>📱</div>
            <div style={{flex:1}}>
              <p style={{fontSize:'11px',color:'rgba(255,255,255,0.4)',fontWeight:600,margin:'0 0 2px'}}>Dúvidas? Fale conosco!</p>
              <p style={{fontSize:'16px',fontWeight:800,color:'white',margin:'0 0 2px'}}>Atendimento via WhatsApp</p>
              <p style={{fontSize:'11px',color:'rgba(255,255,255,0.5)',margin:0}}>Estamos prontos para te atender</p>
            </div>
            <a href={`https://wa.me/55${nfcPage.whatsapp_store}`} target="_blank" rel="noopener noreferrer" className="tap" style={{background:'#25D366',borderRadius:'16px',padding:'12px 16px',display:'flex',alignItems:'center',gap:'8px',textDecoration:'none',flexShrink:0}}>
              <span style={{fontSize:'18px'}}>📲</span>
              <div>
                <p style={{fontSize:'12px',fontWeight:800,color:'white',margin:0,whiteSpace:'nowrap'}}>FALAR AGORA</p>
              </div>
              <span style={{color:'white',fontSize:'16px'}}>›</span>
            </a>
          </div>
        )}

        {/* ── REAL BENEFÍCIOS ── */}
        {nfcPage.show_whatsapp_beneficios && nfcPage.whatsapp_beneficios && (
          <div className="f6" style={{background:'linear-gradient(135deg,#00A86B,#16A34A)',borderRadius:'24px',padding:'24px',display:'flex',flexDirection:'column',gap:'16px',position:'relative',overflow:'hidden'}}>
            <div style={{position:'absolute',top:-30,right:-30,width:'120px',height:'120px',background:'rgba(255,255,255,0.07)',borderRadius:'50%'}}/>
            <div>
              <p style={{fontSize:'22px',margin:'0 0 6px'}}>💚</p>
              <p style={{fontSize:'20px',fontWeight:900,color:'white',margin:'0 0 4px'}}>Real Benefícios</p>
              <p style={{fontSize:'13px',color:'rgba(255,255,255,0.8)',fontWeight:500,margin:0}}>Assistência Saúde para você e sua família</p>
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:'8px'}}>
              {['Consultas médicas','Exames laboratoriais','Benefícios exclusivos'].map(item=>(
                <div key={item} style={{display:'flex',alignItems:'center',gap:'10px'}}>
                  <div style={{width:'22px',height:'22px',background:'rgba(255,255,255,0.25)',borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'11px',flexShrink:0,color:'white',fontWeight:700}}>✓</div>
                  <span style={{fontSize:'13px',fontWeight:600,color:'white'}}>{item}</span>
                </div>
              ))}
            </div>
            <a href={`https://wa.me/55${nfcPage.whatsapp_beneficios}`} target="_blank" rel="noopener noreferrer" className="tap" style={{background:'white',borderRadius:'16px',padding:'16px',textAlign:'center',textDecoration:'none',display:'block'}}>
              <span style={{fontSize:'14px',fontWeight:800,color:'#16A34A'}}>CONHECER BENEFÍCIOS</span>
            </a>
          </div>
        )}

        {/* ── FOOTER ── */}
        <div style={{padding:'24px 0 8px',display:'flex',flexDirection:'column',alignItems:'center',gap:'8px',borderTop:'1px solid #E8E6E2',marginTop:'8px'}}>
          <img src="https://rwwomakjhmglgoowbmsl.supabase.co/storage/v1/object/public/Fotos/logo-real.webp" alt="Real Calçados" style={{width:'40px',height:'40px',objectFit:'contain'}}/>
          <p style={{fontSize:'14px',fontWeight:800,color:'#1A1815',margin:0}}>Real Calçados</p>
          <p style={{fontSize:'12px',color:'#9B9189',margin:0}}>Desde 19XX ❤️</p>
          <div style={{display:'flex',gap:'20px',marginTop:'4px'}}>
            {nfcPage.instagram && <a href={`https://instagram.com/${nfcPage.instagram}`} target="_blank" rel="noopener noreferrer" style={{fontSize:'22px',textDecoration:'none'}}>📸</a>}
            {nfcPage.whatsapp_store && <a href={`https://wa.me/55${nfcPage.whatsapp_store}`} target="_blank" rel="noopener noreferrer" style={{fontSize:'22px',textDecoration:'none'}}>💬</a>}
          </div>
          <p style={{fontSize:'10px',color:'#C0BAB3',marginTop:'8px'}}>© 2026 · Todos os direitos reservados</p>
        </div>

      </div>
    </div>
  );
};

export default StoreNfcPublicPage;