import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabaseClient';
import {
  MessageCircle, MessageSquare, PhoneCall, Loader2,
  QrCode, Instagram, Facebook, Star, Award, ShieldCheck,
  CreditCard, ChevronRight, CheckCircle2, MapPin, CreditCard as CardIcon
} from 'lucide-react';

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

        setData({ store: nfcPage.stores, nfcPage });
      } catch (err) {
        console.error('Erro ao buscar página NFC:', err);
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
        <Loader2 style={{ width: 32, height: 32, color: '#C8102E', animation: 'spin 1s linear infinite' }} />
        <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{ minHeight: '100vh', background: '#F7F5F2', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center', fontFamily: "'Inter',sans-serif" }}>
        <div style={{ width: 64, height: 64, background: '#EAE6DF', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24, fontSize: 28 }}>⚠️</div>
        <h2 style={{ fontSize: 20, fontWeight: 900, color: '#4A4540', textTransform: 'uppercase', marginBottom: 8 }}>Ops!</h2>
        <p style={{ color: '#9B9189', fontWeight: 500 }}>Página não encontrada ou desativada.</p>
      </div>
    );
  }

  const { store, nfcPage } = data;
  const surveyUrl = nfcPage.surveys?.public_token
    ? `/pesquisa/${nfcPage.surveys.public_token}?loja=${store.number}`
    : null;

  const heroImage = (nfcPage.show_whatsapp_beneficios && nfcPage.whatsapp_beneficios)
    ? 'https://rwwomakjhmglgoowbmsl.supabase.co/storage/v1/object/public/Fotos/LayoutNfc.png'
    : 'https://rwwomakjhmglgoowbmsl.supabase.co/storage/v1/object/public/Fotos/LayoutNfc2.png';

  const stateName = store.state === 'BA' ? 'Bahia' : store.state === 'PE' ? 'Pernambuco' : store.state;

  return (
    <div style={{ fontFamily: "'Inter',sans-serif", maxWidth: 480, margin: '0 auto', background: '#F2F2F2', minHeight: '100vh' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        .f1 { animation: fadeUp .4s ease both; }
        .f2 { animation: fadeUp .4s .08s ease both; }
        .f3 { animation: fadeUp .4s .16s ease both; }
        .f4 { animation: fadeUp .4s .24s ease both; }
        .f5 { animation: fadeUp .4s .32s ease both; }
        .f6 { animation: fadeUp .4s .40s ease both; }
        .f7 { animation: fadeUp .4s .48s ease both; }
        .tap { transition: transform .15s, opacity .15s; cursor: pointer; }
        .tap:active { transform: scale(0.97); opacity: 0.9; }
      `}</style>

      {/* ══ HERO ══ */}
      <div className="f1" style={{ position: 'relative', height: 320, overflow: 'hidden', borderRadius: '0 0 40px 40px' }}>
        {/* Imagem de fundo */}
        <img
          src={heroImage}
          alt="Real Calçados"
          style={{
            position: 'absolute',
            top: 0, left: 0,
            width: '100%', height: '100%',
            objectFit: 'cover',
            display: 'block'
          }}
          onError={(e: any) => { e.currentTarget.style.display = 'none'; }}
        />
        {/* Overlay escuro */}
        <div style={{
          position: 'absolute',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'linear-gradient(180deg, rgba(0,0,0,0.25) 0%, rgba(0,0,0,0.60) 100%)'
        }} />
        {/* Conteúdo sobre a imagem */}
        <div style={{
          position: 'absolute',
          top: 0, left: 0, right: 0, bottom: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 10,
          padding: '40px 24px 32px'
        }}>
          <img
            src="https://rwwomakjhmglgoowbmsl.supabase.co/storage/v1/object/public/Fotos/logo-real.webp"
            alt="Logo Real Calçados"
            style={{ width: 90, height: 90, objectFit: 'contain', filter: 'brightness(0) invert(1)' }}
          />
          <h1 style={{ fontSize: 26, fontWeight: 900, color: 'white', letterSpacing: '-0.5px', textAlign: 'center' }}>
            Real Calçados
          </h1>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: '#C8102E',
            borderRadius: 20, padding: '5px 14px',
            boxShadow: '0 4px 12px rgba(200,16,46,0.5)'
          }}>
            <CheckCircle2 size={14} color="white" />
            <span style={{ fontSize: 11, fontWeight: 800, color: 'white', letterSpacing: '1px', textTransform: 'uppercase' }}>
              Loja Oficial
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
            <MapPin size={13} color="rgba(255,255,255,0.85)" />
            <span style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.9)' }}>
              {store.city} • {stateName}
            </span>
          </div>
        </div>
      </div>

      {/* ══ CONTEÚDO ══ */}
      <div style={{ padding: '16px 14px 48px', display: 'flex', flexDirection: 'column', gap: 12 }}>

        {/* CARD PROMO */}
        <div className="f2 tap" style={{
          borderRadius: 20, overflow: 'hidden',
          background: 'linear-gradient(90deg, #9b0000 0%, #d30000 50%, #9b0000 100%)',
          padding: '20px 16px',
          display: 'flex', alignItems: 'center', gap: 12,
          position: 'relative',
          boxShadow: '0 8px 20px rgba(180,10,30,0.3)'
        }}>
          <div style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, background: 'radial-gradient(circle at 90% 50%, rgba(255,255,255,0.12) 0%, transparent 60%)', pointerEvents: 'none' }} />
          <div style={{ fontSize: 44, flexShrink: 0 }}>🛍️</div>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.8)', textTransform: 'uppercase', letterSpacing: 1, margin: '0 0 2px' }}>Tudo em até</p>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span style={{ fontSize: 52, fontWeight: 900, color: 'white', lineHeight: 0.9, letterSpacing: -3 }}>10X</span>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ color: '#FCD34D', fontSize: 16, fontWeight: 900, lineHeight: 1 }}>SEM</span>
                <span style={{ color: '#FCD34D', fontSize: 20, fontWeight: 900, lineHeight: 1 }}>JUROS</span>
              </div>
            </div>
            <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.85)', fontWeight: 500, margin: '4px 0 0' }}>
              As melhores marcas e condições da região!
            </p>
          </div>
          <div style={{
            flexShrink: 0, width: 52, height: 52,
            background: 'linear-gradient(135deg,#FFD700,#FFA500)',
            borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 22, fontWeight: 900, color: 'white',
            boxShadow: '0 0 14px rgba(255,165,0,0.6)',
            border: '2px solid rgba(255,255,255,0.3)'
          }}>%</div>
        </div>

        {/* CARD PAGAMENTO ONLINE */}
        {nfcPage.show_payment && nfcPage.payment_url && (
          <a href={nfcPage.payment_url} target="_blank" rel="noopener noreferrer" className="f3 tap" style={{
            borderRadius: 20, overflow: 'hidden',
            background: 'linear-gradient(135deg, #1B2A6B 0%, #2E47B0 100%)',
            padding: '20px 16px',
            display: 'flex', alignItems: 'center', gap: 14,
            textDecoration: 'none',
            boxShadow: '0 8px 20px rgba(27,42,107,0.3)',
            position: 'relative'
          }}>
            <div style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: '40%', background: 'radial-gradient(circle at 100% 50%, rgba(255,255,255,0.1) 0%, transparent 70%)', pointerEvents: 'none' }} />
            <div style={{ width: 56, height: 56, background: 'rgba(255,255,255,0.15)', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <CardIcon size={28} color="white" />
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: 1, margin: '0 0 3px' }}>Pagamento Online</p>
              <p style={{ fontSize: 18, fontWeight: 900, color: 'white', margin: '0 0 3px', letterSpacing: -0.5 }}>PAGAR AGORA</p>
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)', fontWeight: 500, margin: 0 }}>Rápido, seguro e sem sair de casa</p>
            </div>
            <ChevronRight size={22} color="rgba(255,255,255,0.6)" />
          </a>
        )}

        {/* GRID ATALHOS */}
        {((nfcPage.show_instagram && nfcPage.instagram) ||
          (nfcPage.show_pix && nfcPage.pix_key) ||
          nfcPage.google_review_url ||
          (nfcPage.show_survey && surveyUrl)) && (
          <div className="f3" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>

            {nfcPage.show_instagram && nfcPage.instagram && (
              <a href={`https://instagram.com/${nfcPage.instagram}`} target="_blank" rel="noopener noreferrer" className="tap" style={{ background: 'white', borderRadius: 16, padding: '14px 12px', display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', boxShadow: '0 2px 10px rgba(0,0,0,0.06)' }}>
                <div style={{ width: 52, height: 52, borderRadius: 14, background: 'linear-gradient(45deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Instagram size={24} color="white" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 14, fontWeight: 800, color: '#1A1815', margin: '0 0 2px' }}>Instagram</p>
                  <p style={{ fontSize: 10, color: '#7A7570', fontWeight: 500, margin: 0, lineHeight: 1.3 }}>Siga nosso perfil e fique por dentro!</p>
                </div>
                <ChevronRight size={14} color="#ccc" />
              </a>
            )}

            {nfcPage.show_pix && nfcPage.pix_key && (
              <button onClick={() => setShowPix(!showPix)} className="tap" style={{ background: 'white', borderRadius: 16, padding: '14px 12px', display: 'flex', alignItems: 'center', gap: 10, border: 'none', cursor: 'pointer', textAlign: 'left', boxShadow: '0 2px 10px rgba(0,0,0,0.06)', width: '100%' }}>
                <div style={{ width: 52, height: 52, borderRadius: 14, background: '#32BCAD', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <QrCode size={24} color="white" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 14, fontWeight: 800, color: '#1A1815', margin: '0 0 2px' }}>Pagar com Pix</p>
                  <p style={{ fontSize: 10, color: '#7A7570', fontWeight: 500, margin: 0, lineHeight: 1.3 }}>Pagamento rápido, prático e seguro</p>
                </div>
                <ChevronRight size={14} color="#ccc" />
              </button>
            )}

            {nfcPage.google_review_url && (
              <a href={nfcPage.google_review_url} target="_blank" rel="noopener noreferrer" className="tap" style={{ background: 'white', borderRadius: 16, padding: '14px 12px', display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', boxShadow: '0 2px 10px rgba(0,0,0,0.06)' }}>
                <div style={{ width: 52, height: 52, borderRadius: 14, background: '#FFC107', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Star size={24} color="white" fill="white" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 14, fontWeight: 800, color: '#1A1815', margin: '0 0 2px' }}>Avaliar no Google</p>
                  <p style={{ fontSize: 10, color: '#7A7570', fontWeight: 500, margin: 0, lineHeight: 1.3 }}>Sua opinião faz toda a diferença!</p>
                </div>
                <ChevronRight size={14} color="#ccc" />
              </a>
            )}

            {nfcPage.show_survey && surveyUrl && (
              <button onClick={() => { window.location.href = surveyUrl!; }} className="tap" style={{ background: 'white', borderRadius: 16, padding: '14px 12px', display: 'flex', alignItems: 'center', gap: 10, border: 'none', cursor: 'pointer', textAlign: 'left', boxShadow: '0 2px 10px rgba(0,0,0,0.06)', width: '100%' }}>
                <div style={{ width: 52, height: 52, borderRadius: 14, background: '#1B2A6B', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <MessageSquare size={24} color="white" fill="white" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 14, fontWeight: 800, color: '#1A1815', margin: '0 0 2px' }}>Sua Experiência</p>
                  <p style={{ fontSize: 10, color: '#7A7570', fontWeight: 500, margin: 0, lineHeight: 1.3 }}>Conte pra gente como foi sua experiência</p>
                </div>
                <ChevronRight size={14} color="#ccc" />
              </button>
            )}

          </div>
        )}

        {/* PIX EXPANDIDO */}
        {showPix && nfcPage.pix_key && (
          <div style={{ background: 'white', borderRadius: 16, padding: 20, boxShadow: '0 2px 10px rgba(0,0,0,0.06)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
            {nfcPage.pix_qrcode_url && (
              <img src={nfcPage.pix_qrcode_url} alt="QR Code Pix" style={{ width: 200, height: 200, borderRadius: 12 }} />
            )}
            <div style={{ background: '#F7F5F2', borderRadius: 12, padding: '10px 14px', width: '100%', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, color: '#4A4540', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                {nfcPage.pix_key}
              </span>
              <button
                onClick={() => { navigator.clipboard.writeText(nfcPage.pix_key); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
                style={{ background: copied ? '#32BCAD' : '#1B2A6B', color: 'white', border: 'none', borderRadius: 8, padding: '8px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}
              >
                {copied ? 'Copiado ✓' : 'Copiar chave'}
              </button>
            </div>
            <p style={{ fontSize: 11, color: '#9B9189', textAlign: 'center', fontWeight: 500, margin: 0 }}>
              Abra seu banco, escaneie o QR Code ou cole a chave Pix
            </p>
          </div>
        )}

        {/* DIFERENCIAIS */}
        <div className="f4" style={{ background: 'white', borderRadius: 16, padding: '18px 14px', boxShadow: '0 2px 10px rgba(0,0,0,0.06)', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, textAlign: 'center' }}>
            <Award size={26} color="#C8102E" />
            <p style={{ fontSize: 11, fontWeight: 800, color: '#1A1815', lineHeight: 1.1, margin: '0 0 2px' }}>+30 anos de tradição</p>
            <p style={{ fontSize: 9, color: '#7A7570', fontWeight: 500, lineHeight: 1.2, margin: 0 }}>Calçando famílias baianas</p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, textAlign: 'center' }}>
            <ShieldCheck size={26} color="#C8102E" />
            <p style={{ fontSize: 11, fontWeight: 800, color: '#1A1815', lineHeight: 1.1, margin: '0 0 2px' }}>Marcas Originais</p>
            <p style={{ fontSize: 9, color: '#7A7570', fontWeight: 500, lineHeight: 1.2, margin: 0 }}>Qualidade e procedência garantida</p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, textAlign: 'center' }}>
            <CreditCard size={26} color="#C8102E" />
            <p style={{ fontSize: 11, fontWeight: 800, color: '#1A1815', lineHeight: 1.1, margin: '0 0 2px' }}>Até 10x sem juros</p>
            <p style={{ fontSize: 9, color: '#7A7570', fontWeight: 500, lineHeight: 1.2, margin: 0 }}>Condições especiais pra você</p>
          </div>
        </div>

        {/* WHATSAPP */}
        {nfcPage.show_whatsapp_store && nfcPage.whatsapp_store && (
          <div className="f5" style={{ backgroundColor: '#161719', borderRadius: 20, padding: 20, display: 'flex', flexDirection: 'column', gap: 14, boxShadow: '0 8px 20px rgba(0,0,0,0.12)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <MessageCircle size={40} color="white" strokeWidth={1.5} style={{ flexShrink: 0 }} />
              <div>
                <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', fontWeight: 500, margin: '0 0 2px' }}>Dúvidas? Fale conosco!</p>
                <p style={{ fontSize: 16, fontWeight: 800, color: 'white', margin: '0 0 2px', letterSpacing: -0.3 }}>Atendimento via WhatsApp</p>
                <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', margin: 0 }}>Estamos prontos para te atender</p>
              </div>
            </div>
            <a href={`https://wa.me/55${nfcPage.whatsapp_store}`} target="_blank" rel="noopener noreferrer" className="tap" style={{ background: '#25D366', borderRadius: 14, padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, textDecoration: 'none', boxShadow: '0 4px 14px rgba(37,211,102,0.4)' }}>
              <MessageCircle size={18} color="white" />
              <span style={{ fontSize: 15, fontWeight: 900, color: 'white', letterSpacing: 0.5 }}>FALAR AGORA</span>
            </a>
          </div>
        )}

        {/* REAL BENEFÍCIOS */}
        {nfcPage.show_whatsapp_beneficios && nfcPage.whatsapp_beneficios && (
          <div className="f6" style={{ background: 'linear-gradient(135deg,#00A86B,#16A34A)', borderRadius: 20, padding: 22, display: 'flex', flexDirection: 'column', gap: 14, position: 'relative', overflow: 'hidden', boxShadow: '0 8px 20px rgba(0,168,107,0.25)' }}>
            <div style={{ position: 'absolute', top: -30, right: -30, width: 120, height: 120, background: 'rgba(255,255,255,0.07)', borderRadius: '50%', pointerEvents: 'none' }} />
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 22 }}>💚</span>
                <p style={{ fontSize: 20, fontWeight: 900, color: 'white', margin: 0, letterSpacing: -0.5 }}>REAL BENEFÍCIOS</p>
              </div>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.9)', fontWeight: 600, margin: 0, lineHeight: 1.3 }}>
                Assistência Saúde para você e sua família
              </p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {['Consultas', 'Exames', 'Telemedicina', 'Benefícios Exclusivos'].map(item => (
                <div key={item} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 20, height: 20, background: 'rgba(255,255,255,0.3)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, flexShrink: 0, color: 'white', fontWeight: 800 }}>✓</div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'white' }}>{item}</span>
                </div>
              ))}
            </div>
            <a href={`https://wa.me/55${nfcPage.whatsapp_beneficios}`} target="_blank" rel="noopener noreferrer" className="tap" style={{ background: 'white', borderRadius: 14, padding: '14px 20px', textAlign: 'center', textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: '0 4px 14px rgba(0,0,0,0.1)' }}>
              <span style={{ fontSize: 14, fontWeight: 900, color: '#16A34A' }}>CONHECER BENEFÍCIOS</span>
              <ChevronRight size={16} color="#16A34A" />
            </a>
          </div>
        )}

        {/* FOOTER */}
        <div className="f7" style={{ padding: '20px 0 10px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, borderTop: '1px solid #E8E6E2', marginTop: 8 }}>
          <img
            src="https://rwwomakjhmglgoowbmsl.supabase.co/storage/v1/object/public/Fotos/logo-real.webp"
            alt="Real Calçados"
            style={{ width: 44, height: 44, objectFit: 'contain', filter: 'brightness(0.2) sepia(1) saturate(100) hue-rotate(330deg)', marginBottom: 4 }}
          />
          <p style={{ fontSize: 14, fontWeight: 800, color: '#1A1815', margin: 0 }}>Real Calçados</p>
          <p style={{ fontSize: 12, color: '#7A7570', margin: 0, fontWeight: 600 }}>Desde 19XX <span style={{ color: '#C8102E' }}>❤️</span></p>
          <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
            {nfcPage.instagram && (
              <a href={`https://instagram.com/${nfcPage.instagram}`} target="_blank" rel="noopener noreferrer" style={{ width: 34, height: 34, background: '#1A1815', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Instagram size={16} color="white" />
              </a>
            )}
            {nfcPage.whatsapp_store && (
              <a href={`https://wa.me/55${nfcPage.whatsapp_store}`} target="_blank" rel="noopener noreferrer" style={{ width: 34, height: 34, background: '#1A1815', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <MessageCircle size={16} color="white" />
              </a>
            )}
            <a href="#" style={{ width: 34, height: 34, background: '#1A1815', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Facebook size={16} color="white" />
            </a>
          </div>
          <p style={{ fontSize: 10, color: '#C0BAB3', marginTop: 8 }}>© 2026 · Todos os direitos reservados</p>
        </div>

      </div>
    </div>
  );
};

export default StoreNfcPublicPage;