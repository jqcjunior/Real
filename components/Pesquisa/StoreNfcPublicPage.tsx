import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabaseClient';
import {
  MessageCircle, MessageSquare, Loader2,
  QrCode, Instagram, Star,
  CreditCard, ChevronRight
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

  const surveyUrl = nfcPage.surveys?.public_token
    ? `/pesquisa/${nfcPage.surveys.public_token}?loja=${store.number}`
    : null;

  const heroImage = 'https://rwwomakjhmglgoowbmsl.supabase.co/storage/v1/object/public/Fotos/layout.Nfc.png';

  return (
    <div style={{ fontFamily: "'Inter',sans-serif", maxWidth: 480, margin: '0 auto', background: '#fff', minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        .tap { transition: transform .15s, opacity .15s; cursor: pointer; }
        .tap:active { transform: scale(0.97); opacity: 0.9; }
      `}</style>

      {/* CONTAINER RELATIVO — imagem de fundo como template */}
      <div
        style={{
          position: "relative",
          width: "100%",
          aspectRatio: "864 / 1821",
          overflow: "hidden"
        }}
      >
        <img
          src={heroImage}
          alt=""
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "contain"
          }}
          onError={(e: any) => { e.currentTarget.style.display = 'none'; }}
        />

        {/* PAGAMENTO ONLINE - Posicionado na faixa branca entre a fachada da loja e o banner vermelho */}
        {nfcPage.show_payment && nfcPage.payment_url && (
          <a
            href={nfcPage.payment_url}
            target="_blank"
            rel="noopener noreferrer"
            className="tap"
            style={{
              position: 'absolute',
              top: '21.5%',
              left: '50%',
              transform: 'translateX(-50%)',
              width: '62%',
              height: '2.5%',
              background: 'white',
              borderRadius: 999,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              textDecoration: 'none',
              boxShadow: '0 4px 14px rgba(0,0,0,0.15)',
              border: '1px solid rgba(0,0,0,0.05)'
            }}
          >
            <CreditCard size={14} color="#1B2A6B" />
            <span style={{ fontSize: 12, fontWeight: 900, color: '#1B2A6B', letterSpacing: '0.5px' }}>PAGAR AGORA</span>
          </a>
        )}

        {/* INSTAGRAM - Posicionado na primeira linha de atalhos na grande área branca abaixo dos cards */}
        {nfcPage.show_instagram && nfcPage.instagram && (
          <a
            href={`https://instagram.com/${nfcPage.instagram}`}
            target="_blank"
            rel="noopener noreferrer"
            className="tap"
            style={{
              position: 'absolute',
              top: '51%',
              left: '15%',
              width: '24%',
              height: '6%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4,
              textDecoration: 'none'
            }}
          >
            <Instagram size={28} color="#E1306C" />
            <span style={{ fontSize: 11, fontWeight: 800, color: '#1A1815' }}>Instagram</span>
          </a>
        )}

        {/* PIX - Posicionado na primeira linha de atalhos na grande área branca abaixo dos cards */}
        {nfcPage.show_pix && nfcPage.pix_key && (
          <button
            onClick={() => setShowPix(!showPix)}
            className="tap"
            style={{
              position: 'absolute',
              top: '51%',
              left: '61%',
              width: '24%',
              height: '6%',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4
            }}
          >
            <QrCode size={28} color="#32BCAD" />
            <span style={{ fontSize: 11, fontWeight: 800, color: '#1A1815' }}>Pagar com Pix</span>
          </button>
        )}

        {/* GOOGLE - Posicionado na segunda linha de atalhos na grande área branca abaixo dos cards */}
        {nfcPage.google_review_url && (
          <a
            href={nfcPage.google_review_url}
            target="_blank"
            rel="noopener noreferrer"
            className="tap"
            style={{
              position: 'absolute',
              top: '60%',
              left: '15%',
              width: '24%',
              height: '6%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4,
              textDecoration: 'none'
            }}
          >
            <Star size={28} color="#FFC107" fill="#FFC107" />
            <span style={{ fontSize: 11, fontWeight: 800, color: '#1A1815', textAlign: 'center' }}>Avaliar no Google</span>
          </a>
        )}

        {/* PESQUISA / EXPERIÊNCIA - Posicionado na segunda linha de atalhos na grande área branca abaixo dos cards */}
        {nfcPage.show_survey && surveyUrl && (
          <button
            onClick={() => { window.location.href = surveyUrl!; }}
            className="tap"
            style={{
              position: 'absolute',
              top: '60%',
              left: '61%',
              width: '24%',
              height: '6%',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4
            }}
          >
            <MessageSquare size={28} color="#1B2A6B" />
            <span style={{ fontSize: 11, fontWeight: 800, color: '#1A1815' }}>Sua Experiência</span>
          </button>
        )}

        {/* WHATSAPP - Posicionado abaixo da segunda linha de atalhos na grande área branca */}
        {nfcPage.show_whatsapp_store && nfcPage.whatsapp_store && (
          <a
            href={`https://wa.me/55${nfcPage.whatsapp_store}`}
            target="_blank"
            rel="noopener noreferrer"
            className="tap"
            style={{
              position: 'absolute',
              top: '69%',
              left: '50%',
              transform: 'translateX(-50%)',
              width: '42%',
              height: '3.6%',
              background: '#25D366',
              borderRadius: 999,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              textDecoration: 'none',
              boxShadow: '0 4px 14px rgba(37,211,102,0.4)'
            }}
          >
            <MessageCircle size={18} color="white" />
            <span style={{ fontSize: 13, fontWeight: 900, color: 'white' }}>FALAR AGORA</span>
          </a>
        )}

        {/* CONHECER BENEFÍCIOS - Posicionado abaixo do WhatsApp na grande área branca */}
        {nfcPage.show_whatsapp_beneficios && nfcPage.whatsapp_beneficios && (
          <a
            href={`https://wa.me/55${nfcPage.whatsapp_beneficios}`}
            target="_blank"
            rel="noopener noreferrer"
            className="tap"
            style={{
              position: 'absolute',
              top: '78%',
              left: '50%',
              transform: 'translateX(-50%)',
              width: '82%',
              height: '3.6%',
              background: 'white',
              borderRadius: 999,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              textDecoration: 'none',
              boxShadow: '0 4px 14px rgba(0,0,0,0.1)',
              border: '1px solid rgba(0,0,0,0.05)'
            }}
          >
            <span style={{ fontSize: 14, fontWeight: 900, color: '#16A34A' }}>CONHECER BENEFÍCIOS</span>
            <ChevronRight size={16} color="#16A34A" />
          </a>
        )}

        {/* MODAL DO PIX EXPANDIDO */}
        {showPix && nfcPage.pix_key && (
          <div style={{
            position: 'absolute',
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
                style={{
                  position: 'absolute',
                  top: 12,
                  right: 12,
                  border: 'none',
                  background: '#EAE6DF',
                  color: '#4A4540',
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  fontSize: 14,
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                ✕
              </button>

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
    </div>
  );
};

export default StoreNfcPublicPage;