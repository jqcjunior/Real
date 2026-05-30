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
  const heroImage = 'https://rwwomakjhmglgoowbmsl.supabase.co/storage/v1/object/public/Fotos/layout.Nfc.final.png';
  const surveyUrl = nfcPage.surveys?.public_token
    ? `/pesquisa/${nfcPage.surveys.public_token}?loja=${store.number}`
    : null;

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
              href={`https://instagram.com/${nfcPage.instagram}`}
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
              <div style={{ width: 48, height: 48, borderRadius: 14, background: 'linear-gradient(135deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Instagram size={24} color="white" />
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
              <div style={{ width: 48, height: 48, borderRadius: 14, background: '#F1F3F4', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 28 }}>
                G
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
              <div style={{ width: 48, height: 48, borderRadius: 14, background: '#E8FAF7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <QrCode size={24} color="#32BCAD" />
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
              <div style={{ width: 48, height: 48, borderRadius: 14, background: '#EEF2FF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <MessageSquare size={24} color="#1B2A6B" />
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
      <div style={{ padding: '24px 16px 40px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, borderTop: '1px solid #E5E7EB' }}>
        <img
          src="https://rwwomakjhmglgoowbmsl.supabase.co/storage/v1/object/public/Fotos/logo_r.png"
          alt="Real Calçados"
          style={{ height: 48, objectFit: 'contain' }}
          onError={(e: any) => { e.currentTarget.style.display = 'none'; }}
        />
        <div style={{ fontSize: 16, fontWeight: 800, color: '#1A1815' }}>Real Calçados</div>
        <div style={{ fontSize: 12, color: '#9B9189', fontWeight: 500 }}>Calçando você e sua família sempre ❤️</div>
        <div style={{ display: 'flex', gap: 20, marginTop: 8 }}>
          {nfcPage.instagram && (
            <a href={`https://instagram.com/${nfcPage.instagram}`} target="_blank" rel="noopener noreferrer">
              <Instagram size={24} color="#1A1815" />
            </a>
          )}
          {nfcPage.whatsapp_store && (
            <a href={`https://wa.me/55${nfcPage.whatsapp_store}`} target="_blank" rel="noopener noreferrer">
              <MessageCircle size={24} color="#1A1815" />
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