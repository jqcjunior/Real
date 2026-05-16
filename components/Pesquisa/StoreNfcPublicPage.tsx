import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabaseClient';
import { MessageCircle, ExternalLink, MessageSquare, PhoneCall, Loader2, QrCode } from 'lucide-react';
import { BRAND_LOGO } from '../../constants';

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
    <div style={pageStyle}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700;800;900&display=swap');
        * { box-sizing: border-box; }
      `}</style>

      {/* Hero */}
      <div style={heroStyle}>
        <img
          src="https://rwwomakjhmglgoowbmsl.supabase.co/storage/v1/object/public/Fotos/logo-real.webp"
          alt="Real Calçados"
          style={{
            width: '165px',
            height: 'auto',
            objectFit: 'contain',
            filter: 'brightness(0) invert(1)',
            marginBottom: '20px',
            display: 'block'
          }}
        />
        <p style={{ fontSize: '18px', fontWeight: 900, color: 'white', margin: '0 0 4px', letterSpacing: '-0.3px' }}>
          Real Calçados
        </p>
        <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.65)', margin: 0, fontWeight: 500 }}>
          {store.city} - {store.state === 'BA' ? 'Bahia' : store.state === 'PE' ? 'Pernambuco' : store.state}
        </p>
      </div>

      {/* Content */}
      <div style={contentStyle}>

        {/* Redes sociais */}
        {nfcPage.show_instagram && nfcPage.instagram && (
          <>
            <div style={sectionLabelStyle}>Redes sociais</div>
            <a href={`https://instagram.com/${nfcPage.instagram}`} target="_blank" rel="noopener noreferrer" style={actionCardStyle}>
              <div style={{ ...iconWrapStyle, background: 'linear-gradient(135deg, #E1306C, #833AB4)' }}>
                <ExternalLink size={20} color="white" />
              </div>
              <div style={{ flex: 1 }}>
                <div style={cardTitleStyle}>Instagram</div>
                <div style={cardDescStyle}>Conheça nossas novidades</div>
              </div>
            </a>
          </>
        )}

        {/* Pagamento Pix */}
        {nfcPage.show_pix && nfcPage.pix_key && (
          <>
            <div style={sectionLabelStyle}>Pagamento</div>
            <button onClick={() => setShowPix(!showPix)} style={{ ...cardPixStyle, textAlign: 'left' }}>
              <div style={{ ...iconWrapStyle, background: 'rgba(255,255,255,0.2)' }}>
                <QrCode size={20} color="white" />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ ...cardTitleStyle, color: 'white' }}>Pagar com Pix</div>
                <div style={{ ...cardDescStyle, color: 'rgba(255,255,255,0.8)' }}>Rápido e seguro</div>
              </div>
            </button>

            {showPix && (
              <div style={{
                background: 'white',
                borderRadius: '18px',
                padding: '24px 20px',
                border: '1px solid rgba(0,0,0,0.06)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '16px'
              }}>
                {nfcPage.pix_qrcode_url && (
                  <img
                    src={nfcPage.pix_qrcode_url}
                    alt="QR Code Pix"
                    style={{ width: '200px', height: '200px', borderRadius: '12px' }}
                  />
                )}
                <div style={{
                  background: '#F7F5F2',
                  borderRadius: '12px',
                  padding: '12px 16px',
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '8px'
                }}>
                  <span style={{
                    fontSize: '12px',
                    color: '#4A4540',
                    fontWeight: 500,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    flex: 1
                  }}>
                    {nfcPage.pix_key}
                  </span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(nfcPage.pix_key);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }}
                    style={{
                      background: copied ? '#32BCAD' : '#1B2A6B',
                      color: 'white',
                      border: 'none',
                      borderRadius: '10px',
                      padding: '8px 14px',
                      fontSize: '12px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      flexShrink: 0,
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {copied ? 'Copiado ✓' : 'Copiar chave'}
                  </button>
                </div>
                <p style={{ fontSize: '11px', color: '#9B9189', textAlign: 'center', fontWeight: 500, margin: 0 }}>
                  Abra seu banco, escaneie o QR Code ou cole a chave Pix
                </p>
              </div>
            )}
          </>
        )}

        {/* Sua experiência */}
        {nfcPage.show_survey && surveyUrl && (
          <>
            <div style={sectionLabelStyle}>Sua experiência</div>
            <button onClick={() => { window.location.href = surveyUrl; }} style={{ ...cardPesquisaStyle, textAlign: 'left' }}>
              <div style={{ ...iconWrapStyle, background: 'rgba(255,255,255,0.2)' }}>
                <MessageSquare size={20} color="white" />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ ...cardTitleStyle, color: 'white' }}>Sua Experiência Real</div>
                <div style={{ ...cardDescStyle, color: 'rgba(255,255,255,0.8)' }}>Deixe sua opinião sobre a loja</div>
              </div>
            </button>
          </>
        )}

        {/* Fale com a gente */}
        {(nfcPage.show_whatsapp_store || nfcPage.show_whatsapp_manager || nfcPage.show_whatsapp_central) && (
          <>
            {(nfcPage.whatsapp_store || nfcPage.whatsapp_manager || nfcPage.whatsapp_central) && (
              <div style={sectionLabelStyle}>Fale com a gente</div>
            )}

            {nfcPage.show_whatsapp_store && nfcPage.whatsapp_store && (
              <a href={`https://wa.me/55${nfcPage.whatsapp_store}`} target="_blank" rel="noopener noreferrer" style={actionCardStyle}>
                <div style={{ ...iconWrapStyle, background: '#DFF6E9' }}>
                  <MessageCircle size={20} color="#25D366" />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={cardTitleStyle}>WhatsApp da Loja</div>
                  <div style={cardDescStyle}>Compre sem sair de casa</div>
                </div>
              </a>
            )}

            {nfcPage.show_whatsapp_manager && nfcPage.whatsapp_manager && (
              <a href={`https://wa.me/55${nfcPage.whatsapp_manager}`} target="_blank" rel="noopener noreferrer" style={actionCardStyle}>
                <div style={{ ...iconWrapStyle, background: '#E6F4F1' }}>
                  <PhoneCall size={20} color="#0D9488" />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={cardTitleStyle}>Falar com o Gerente</div>
                  <div style={cardDescStyle}>Sugestões e Parcerias</div>
                </div>
              </a>
            )}

            {nfcPage.show_whatsapp_central && nfcPage.whatsapp_central && (
              <a href={`https://wa.me/55${nfcPage.whatsapp_central}`} target="_blank" rel="noopener noreferrer" style={actionCardStyle}>
                <div style={{ ...iconWrapStyle, background: '#EAE6DF' }}>
                  <MessageCircle size={20} color="#4A4540" />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={cardTitleStyle}>WhatsApp Central</div>
                  <div style={cardDescStyle}>Dúvidas Frequentes</div>
                </div>
              </a>
            )}

            {nfcPage.show_whatsapp_beneficios && nfcPage.whatsapp_beneficios && (
              <a href={`https://wa.me/${nfcPage.whatsapp_beneficios}`} target="_blank" rel="noopener noreferrer" style={actionCardStyle}>
                <div style={{ ...iconWrapStyle, background: '#DFF6E9' }}>
                  <MessageCircle size={20} color="#25D366" />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={cardTitleStyle}>💚 Real Benefícios</div>
                  <div style={cardDescStyle}>Seus benefícios exclusivos</div>
                </div>
              </a>
            )}
          </>
        )}

        {/* Footer */}
        <div style={footerStyle}>
          <div style={{ width: '28px', height: '28px', background: '#C8102E', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 900, fontSize: '14px' }}>
            R
          </div>
          <div style={{ fontSize: '12px', fontWeight: 800, color: '#1A1815' }}>Real Calçados</div>
          <div style={{ fontSize: '10px', fontWeight: 500, color: '#9B9189' }}>© 2026 · Todos os direitos reservados</div>
        </div>

      </div>
    </div>
  );
};

export default StoreNfcPublicPage;
