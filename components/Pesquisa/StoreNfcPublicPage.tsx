import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabaseClient';
import { BRAND_LOGO } from '../../constants';
import { MessageCircle, ExternalLink, MessageSquare, PhoneCall, Loader2 } from 'lucide-react';

interface StoreNfcPublicPageProps {
  storeNumber: string;
}

const StoreNfcPublicPage: React.FC<StoreNfcPublicPageProps> = ({ storeNumber }) => {
  const [data, setData] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const fetchStoreData = async () => {
      try {
        const { data: storeData, error: storeError } = await supabase
          .from('stores')
          .select('id, name, city, number')
          .eq('number', Number(storeNumber))
          .single();

        if (storeError) throw storeError;

        const { data: nfcPage, error: nfcError } = await supabase
          .from('store_nfc_pages')
          .select('*, surveys(public_token)')
          .eq('store_id', storeData.id)
          .eq('is_active', true)
          .single();

        if (nfcError) throw nfcError;

        setData({
          store: storeData,
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
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 bg-slate-200 rounded-full flex items-center justify-center mb-6">
          <span className="text-2xl">⚠️</span>
        </div>
        <h2 className="text-xl font-black text-slate-800 uppercase tracking-tighter mb-2">Ops!</h2>
        <p className="text-slate-500 font-medium">Página não encontrada ou desativada.</p>
      </div>
    );
  }

  const { store, nfcPage } = data;
  const surveyUrl = nfcPage.surveys?.public_token ? `/pesquisa/${nfcPage.surveys.public_token}` : null;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-md mx-auto min-h-screen flex flex-col bg-white shadow-xl shadow-slate-200/50">
        
        {/* Header Cover */}
        <div className="relative h-64 flex-shrink-0">
          <div 
            className="absolute inset-0 bg-cover bg-center"
            style={{ 
              backgroundImage: `url(${nfcPage.cover_image_url || 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=800&q=80'})`
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/60 to-slate-900/40" />
          
          <div className="absolute inset-0 p-8 flex flex-col items-center justify-center text-center">
             <img src={BRAND_LOGO} alt="Real Calçados" className="h-12 mb-6 drop-shadow-md z-10" />
             <h1 className="text-3xl font-black italic uppercase tracking-tighter text-white leading-none z-10">
               {store.name}
             </h1>
             <p className="text-xs font-bold uppercase tracking-widest text-slate-300 mt-2 z-10">
               {store.city}
             </p>
          </div>
        </div>

        {/* Links Section */}
        <div className="flex-1 p-6 flex flex-col gap-4 -mt-6 z-20">
          {nfcPage.instagram && (
            <a 
              href={`https://instagram.com/${nfcPage.instagram}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-4 p-4 bg-gradient-to-r from-purple-600 to-pink-500 text-white rounded-3xl shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-transform"
            >
              <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm">
                <ExternalLink size={24} />
              </div>
              <div>
                <h3 className="font-black uppercase tracking-widest text-sm leading-none">Instagram</h3>
                <p className="text-[10px] font-bold text-white/80 uppercase tracking-widest mt-1">Conheça Nossas Novidades</p>
              </div>
            </a>
          )}

          {surveyUrl && (
            <a 
              href={surveyUrl}
              className="flex items-center gap-4 p-4 bg-blue-600 text-white rounded-3xl shadow-lg shadow-blue-600/30 hover:scale-[1.02] active:scale-[0.98] transition-transform"
            >
              <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm">
                <MessageSquare size={24} />
              </div>
              <div>
                <h3 className="font-black uppercase tracking-widest text-sm leading-none">Pesquisa de Satisfação</h3>
                <p className="text-[10px] font-bold text-white/80 uppercase tracking-widest mt-1">Deixe Sua Opinião</p>
              </div>
            </a>
          )}

          {nfcPage.whatsapp_store && (
            <a 
              href={`https://wa.me/55${nfcPage.whatsapp_store}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-4 p-4 bg-[#25D366] text-white rounded-3xl shadow-lg shadow-[#25D366]/30 hover:scale-[1.02] active:scale-[0.98] transition-transform"
            >
              <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm">
                <MessageCircle size={24} />
              </div>
              <div>
                <h3 className="font-black uppercase tracking-widest text-sm leading-none">WhatsApp da Loja</h3>
                <p className="text-[10px] font-bold text-white/80 uppercase tracking-widest mt-1">Compre Sem Sair de Casa</p>
              </div>
            </a>
          )}

          {nfcPage.whatsapp_manager && (
            <a 
              href={`https://wa.me/55${nfcPage.whatsapp_manager}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-4 p-4 bg-emerald-500 text-white rounded-3xl hover:scale-[1.02] active:scale-[0.98] transition-transform"
            >
              <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm">
                <PhoneCall size={24} />
              </div>
              <div>
                <h3 className="font-black uppercase tracking-widest text-sm leading-none">Falar com o Gerente</h3>
                <p className="text-[10px] font-bold text-white/80 uppercase tracking-widest mt-1">Sugestões e Parcerias</p>
              </div>
            </a>
          )}

          {nfcPage.whatsapp_central && (
            <a 
              href={`https://wa.me/55${nfcPage.whatsapp_central}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-4 p-4 bg-teal-700 text-white rounded-3xl hover:scale-[1.02] active:scale-[0.98] transition-transform mb-4"
            >
              <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm">
                <MessageCircle size={24} />
              </div>
              <div>
                <h3 className="font-black uppercase tracking-widest text-sm leading-none">WhatsApp Central</h3>
                <p className="text-[10px] font-bold text-white/80 uppercase tracking-widest mt-1">Dúvidas Frequentes</p>
              </div>
            </a>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 text-center border-t border-slate-100 bg-slate-50 mt-auto">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
            Real Calçados &copy; {new Date().getFullYear()}
          </p>
        </div>

      </div>
    </div>
  );
};

export default StoreNfcPublicPage;
