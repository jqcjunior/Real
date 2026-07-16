import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabaseClient';
import { MessageCircle, QrCode, Instagram, Star, MessageSquare, CreditCard, ChevronRight, Lock } from 'lucide-react';

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
        <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
        <div style={{ width: 32, height: 32, border: '4px solid #C8102E', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
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
  const heroImage = 'https://rwwomakjhmglgoowbmsl.supabase.co/storage/v1/object/public/Fotos/layout.Nfc.final.webp';
  const surveyUrl = nfcPage.surveys?.public_token
    ? `/pesquisa/${nfcPage.surveys.public_token}?loja=${store.number}`
    : null;
  const instagramUrl = nfcPage.instagram
    ? (nfcPage.instagram.startsWith('http') 
      ? nfcPage.instagram 
      : `https://www.instagram.com/${nfcPage.instagram}`)
    : '';

  return (
    <div style={{ fontFamily: "'Inter',sans-serif", maxWidth: 480, margin: '0 auto', background: '#F4F6F9', minHeight: '100vh' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        .tap { transition: transform .15s, opacity .15s; cursor: pointer; }
        .tap:active { transform: scale(0.97); opacity: 0.9; }
      `}</style>

      {/* HERO — imagem de fundo completa */}
      <div style={{ width: '100%', background: '#fff' }}>
        <img
          src={heroImage}
          alt="Real Calçados"
          style={{ width: '100%', display: 'block' }}
          onError={(e: any) => { e.currentTarget.style.display = 'none'; }}
        />
      </div>

      {/* CONTEÚDO DINÂMICO */}
      <div style={{ padding: '16px 16px 32px', display: 'flex', flexDirection: 'column', gap: 12 }}>

        {/* CARD AZUL — PAGAMENTO ONLINE */}
        {nfcPage.show_payment && nfcPage.payment_url && (
          <a
            href={nfcPage.payment_url}
            target="_blank"
            rel="noopener noreferrer"
            className="tap"
            style={{
              display: 'flex',
              alignItems: 'center',
              background: 'linear-gradient(135deg, #1B2A6B 0%, #2341A8 100%)',
              borderRadius: 20,
              padding: '20px 20px',
              textDecoration: 'none',
              gap: 16,
              boxShadow: '0 8px 24px rgba(27,42,107,0.3)'
            }}
          >
            <div style={{ fontSize: 40, flexShrink: 0 }}>💳</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 18, fontWeight: 900, color: 'white', letterSpacing: '-0.5px' }}>PAGAMENTO ONLINE</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', fontWeight: 500, marginTop: 2 }}>Pague de forma rápida, segura e sem sair de casa.</div>
              <div style={{
                marginTop: 12,
                background: 'white',
                borderRadius: 999,
                padding: '10px 20px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8
              }}>
                <Lock size={14} color="#1B2A6B" />
                <span style={{ fontSize: 13, fontWeight: 900, color: '#1B2A6B' }}>PAGAR AGORA</span>
                <ChevronRight size={14} color="#1B2A6B" />
              </div>
            </div>
          </a>
        )}

        {/* GRID 2x2 — AÇÕES */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>

          {/* INSTAGRAM */}
          {nfcPage.show_instagram && nfcPage.instagram && (
            <a
              href={instagramUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="tap"
              style={{
                background: 'white',
                borderRadius: 20,
                padding: '20px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                textDecoration: 'none',
                boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
              }}
            >
              <div style={{ width: 48, height: 48, borderRadius: 14, flexShrink: 0, overflow: 'hidden' }}>
                <svg viewBox="0 0 48 48" width="48" height="48" xmlns="http://www.w3.org/2000/svg">
                  <defs>
                    <radialGradient id="ig_grad" cx="30%" cy="107%" r="150%">
                      <stop offset="0%" stopColor="#fdf497"/>
                      <stop offset="10%" stopColor="#fdf497"/>
                      <stop offset="50%" stopColor="#fd5949"/>
                      <stop offset="68%" stopColor="#d6249f"/>
                      <stop offset="100%" stopColor="#285AEB"/>
                    </radialGradient>
                  </defs>
                  <rect width="48" height="48" rx="14" fill="url(#ig_grad)"/>
                  <rect x="13" y="13" width="22" height="22" rx="6" fill="none" stroke="white" strokeWidth="2.2"/>
                  <circle cx="24" cy="24" r="5.5" fill="none" stroke="white" strokeWidth="2.2"/>
                  <circle cx="33.5" cy="14.5" r="1.8" fill="white"/>
                </svg>
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 800, color: '#1A1815' }}>Instagram</div>
                <div style={{ fontSize: 11, color: '#9B9189', fontWeight: 500, marginTop: 2 }}>Siga nosso perfil!</div>
              </div>
              <ChevronRight size={16} color="#C8C0B8" style={{ marginLeft: 'auto' }} />
            </a>
          )}

          {/* AVALIAR NO GOOGLE */}
          {nfcPage.google_review_url && (
            <a
              href={nfcPage.google_review_url}
              target="_blank"
              rel="noopener noreferrer"
              className="tap"
              style={{
                background: 'white',
                borderRadius: 20,
                padding: '20px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                textDecoration: 'none',
                boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
              }}
            >
              <div style={{ width: 48, height: 48, borderRadius: 14, background: 'white', border: '1.5px solid #E5E7EB', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
                <svg viewBox="0 0 24 24" width="30" height="30" xmlns="http://www.w3.org/2000/svg">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 800, color: '#1A1815' }}>Avaliar no Google</div>
                <div style={{ fontSize: 11, color: '#9B9189', fontWeight: 500, marginTop: 2 }}>Sua opinião importa!</div>
              </div>
              <ChevronRight size={16} color="#C8C0B8" style={{ marginLeft: 'auto' }} />
            </a>
          )}

          {/* PIX */}
          {nfcPage.show_pix && nfcPage.pix_key && (
            <button
              onClick={() => setShowPix(true)}
              className="tap"
              style={{
                background: 'white',
                borderRadius: 20,
                padding: '20px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                border: 'none',
                cursor: 'pointer',
                textAlign: 'left',
                boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
              }}
            >
              <div style={{ width: 48, height: 48, borderRadius: 14, flexShrink: 0, background: 'linear-gradient(135deg, #32BCAD 0%, #1a9e8f 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 8 }}>
                <img
                  src="https://upload.wikimedia.org/wikipedia/commons/a/a2/Logo%E2%80%94pix_powered_by_Banco_Central_%28Brazil%2C_2020%29.svg"
                  alt="Pix"
                  style={{ width: 32, height: 32, objectFit: 'contain', filter: 'brightness(0) invert(1)' }}
                />
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 800, color: '#1A1815' }}>Pagar com Pix</div>
                <div style={{ fontSize: 11, color: '#9B9189', fontWeight: 500, marginTop: 2 }}>Rápido e seguro</div>
              </div>
              <ChevronRight size={16} color="#C8C0B8" style={{ marginLeft: 'auto' }} />
            </button>
          )}

          {/* SUA EXPERIÊNCIA */}
          {nfcPage.show_survey && surveyUrl && (
            <button
              onClick={() => { window.location.href = surveyUrl!; }}
              className="tap"
              style={{
                background: 'white',
                borderRadius: 20,
                padding: '20px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                border: 'none',
                cursor: 'pointer',
                textAlign: 'left',
                boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
              }}
            >
              <div style={{ width: 48, height: 48, borderRadius: 14, flexShrink: 0, background: 'linear-gradient(135deg, #1B2A6B 0%, #2341A8 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg viewBox="0 0 24 24" width="26" height="26" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" fill="white" opacity="0.95"/>
                  <circle cx="9" cy="10" r="1.2" fill="#2341A8"/>
                  <circle cx="12" cy="10" r="1.2" fill="#2341A8"/>
                  <circle cx="15" cy="10" r="1.2" fill="#2341A8"/>
                </svg>
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 800, color: '#1A1815' }}>Sua Experiência</div>
                <div style={{ fontSize: 11, color: '#9B9189', fontWeight: 500, marginTop: 2 }}>Conte como foi!</div>
              </div>
              <ChevronRight size={16} color="#C8C0B8" style={{ marginLeft: 'auto' }} />
            </button>
          )}

        </div>

        {/* BANNER PRETO — WHATSAPP */}
        {nfcPage.show_whatsapp_store && nfcPage.whatsapp_store && (
          <a
            href={`https://wa.me/55${nfcPage.whatsapp_store}`}
            target="_blank"
            rel="noopener noreferrer"
            className="tap"
            style={{
              display: 'flex',
              alignItems: 'center',
              background: '#111',
              borderRadius: 20,
              padding: '20px 20px',
              textDecoration: 'none',
              gap: 16,
              boxShadow: '0 4px 16px rgba(0,0,0,0.2)'
            }}
          >
            <div style={{ fontSize: 40, flexShrink: 0 }}>💬</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px' }}>Dúvidas? Fale conosco!</div>
              <div style={{ fontSize: 16, fontWeight: 900, color: 'white', marginTop: 2 }}>Atendimento via WhatsApp</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', fontWeight: 500, marginTop: 2 }}>Estamos prontos para te atender</div>
            </div>
            <div style={{
              background: '#25D366',
              borderRadius: 14,
              padding: '12px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              flexShrink: 0
            }}>
              <MessageCircle size={18} color="white" />
              <span style={{ fontSize: 12, fontWeight: 900, color: 'white', whiteSpace: 'nowrap' }}>FALAR AGORA</span>
            </div>
          </a>
        )}

        {/* BANNER VERDE — REAL BENEFÍCIOS */}
        {nfcPage.show_whatsapp_beneficios && nfcPage.whatsapp_beneficios && (
          <a
            href={`https://wa.me/55${nfcPage.whatsapp_beneficios}`}
            target="_blank"
            rel="noopener noreferrer"
            className="tap"
            style={{
              display: 'flex',
              flexDirection: 'column',
              background: 'linear-gradient(135deg, #14532D 0%, #166534 100%)',
              borderRadius: 20,
              padding: '20px 20px',
              textDecoration: 'none',
              gap: 12,
              boxShadow: '0 4px 16px rgba(20,83,45,0.3)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ fontSize: 36, flexShrink: 0 }}>💚</div>
              <div>
                <div style={{ fontSize: 18, fontWeight: 900, color: 'white', letterSpacing: '-0.5px' }}>REAL BENEFÍCIOS</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', fontWeight: 500, marginTop: 2 }}>Assistência Saúde para você e sua família</div>
              </div>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {['Consultas', 'Exames', 'Telemedicina', 'Benefícios Exclusivos'].map(item => (
                <div key={item} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ color: '#86EFAC', fontSize: 12 }}>✔</span>
                  <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.85)', fontWeight: 600 }}>{item}</span>
                </div>
              ))}
            </div>
            <div style={{
              background: 'white',
              borderRadius: 12,
              padding: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8
            }}>
              <span style={{ fontSize: 14, fontWeight: 900, color: '#14532D' }}>CONHECER BENEFÍCIOS</span>
              <ChevronRight size={16} color="#14532D" />
            </div>
          </a>
        )}

      </div>

      {/* FOOTER */}
      <div style={{ padding: '24px 16px 40px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, borderTop: '1px solid #E5E7EB', background: '#fff' }}>
        <img
          src="https://rwwomakjhmglgoowbmsl.supabase.co/storage/v1/object/public/Fotos/logo_r.png"
          alt="Real Calçados"
          style={{ height: 48, objectFit: 'contain' }}
          onError={(e: any) => { e.currentTarget.style.display = 'none'; }}
        />
        <div style={{ fontSize: 16, fontWeight: 800, color: '#1A1815' }}>Real Calçados</div>
        <div style={{ fontSize: 12, color: '#9B9189', fontWeight: 500 }}>Calçando você e sua família sempre ❤️</div>

        <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>

          {/* Instagram */}
          {nfcPage.instagram && (
            <a href={instagramUrl} target="_blank" rel="noopener noreferrer"
              style={{ width: 44, height: 44, borderRadius: 12, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg viewBox="0 0 48 48" width="44" height="44" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <radialGradient id="igf_grad" cx="30%" cy="107%" r="150%">
                    <stop offset="0%" stopColor="#fdf497"/>
                    <stop offset="10%" stopColor="#fdf497"/>
                    <stop offset="50%" stopColor="#fd5949"/>
                    <stop offset="68%" stopColor="#d6249f"/>
                    <stop offset="100%" stopColor="#285AEB"/>
                  </radialGradient>
                </defs>
                <rect width="48" height="48" rx="12" fill="url(#igf_grad)"/>
                <rect x="13" y="13" width="22" height="22" rx="6" fill="none" stroke="white" strokeWidth="2.2"/>
                <circle cx="24" cy="24" r="5.5" fill="none" stroke="white" strokeWidth="2.2"/>
                <circle cx="33.5" cy="14.5" r="1.8" fill="white"/>
              </svg>
            </a>
          )}

          {/* WhatsApp */}
          {nfcPage.whatsapp_store && (
            <a href={`https://wa.me/55${nfcPage.whatsapp_store}`} target="_blank" rel="noopener noreferrer"
              style={{ width: 44, height: 44, borderRadius: 12, background: '#25D366', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg viewBox="0 0 24 24" width="26" height="26" fill="white" xmlns="http://www.w3.org/2000/svg">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                <path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.558 4.126 1.534 5.855L.054 23.447a.5.5 0 0 0 .609.61l5.592-1.48A11.945 11.945 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.808 9.808 0 0 1-5.001-1.368l-.358-.214-3.718.984.993-3.626-.234-.373A9.808 9.808 0 0 1 2.182 12C2.182 6.57 6.57 2.182 12 2.182S21.818 6.57 21.818 12 17.43 21.818 12 21.818z"/>
              </svg>
            </a>
          )}

          {/* Pagamento */}
          {nfcPage.show_payment && nfcPage.payment_url && (
            <a href={nfcPage.payment_url} target="_blank" rel="noopener noreferrer"
              style={{ width: 44, height: 44, borderRadius: 12, background: '#1B2A6B', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" xmlns="http://www.w3.org/2000/svg">
                <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/>
                <line x1="1" y1="10" x2="23" y2="10"/>
              </svg>
            </a>
          )}

          {/* Google */}
          {nfcPage.google_review_url && (
            <a href={nfcPage.google_review_url} target="_blank" rel="noopener noreferrer"
              style={{ width: 44, height: 44, borderRadius: 12, background: 'white', border: '1px solid #E5E7EB', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg viewBox="0 0 24 24" width="26" height="26" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
            </a>
          )}

        </div>
      </div>

      {/* MODAL PIX */}
      {showPix && nfcPage.pix_key && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.6)',
          zIndex: 100,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
        }}>
          <div style={{
            background: 'white',
            borderRadius: 24,
            padding: 24,
            width: '90%',
            maxWidth: 360,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 16,
            boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
            position: 'relative'
          }}>
            <button
              onClick={() => setShowPix(false)}
              style={{ position: 'absolute', top: 12, right: 12, border: 'none', background: '#EAE6DF', color: '#4A4540', width: 28, height: 28, borderRadius: '50%', fontSize: 14, fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >✕</button>
            <span style={{ fontSize: 16, fontWeight: 800, color: '#1B2A6B', marginTop: 8 }}>Pagar com Pix</span>
            {nfcPage.pix_qrcode_url && (
              <img src={nfcPage.pix_qrcode_url} alt="QR Code Pix" style={{ width: 180, height: 180, borderRadius: 12 }} />
            )}
            <div style={{ background: '#F7F5F2', borderRadius: 12, padding: '10px 14px', width: '100%', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, color: '#4A4540', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                {nfcPage.pix_key}
              </span>
              <button
                onClick={() => { navigator.clipboard.writeText(nfcPage.pix_key); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
                style={{ background: copied ? '#32BCAD' : '#1B2A6B', color: 'white', border: 'none', borderRadius: 8, padding: '8px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}
              >
                {copied ? 'Copiado ✓' : 'Copiar'}
              </button>
            </div>
            <p style={{ fontSize: 11, color: '#9B9189', textAlign: 'center', fontWeight: 500, margin: 0 }}>
              Abra seu banco, escaneie o QR Code ou cole a chave Pix
            </p>
          </div>
        </div>
      )}

    </div>
  );
};

export default StoreNfcPublicPage;