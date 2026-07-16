import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabaseClient';
import { Survey } from '../../types';
import SurveyResponseForm from './SurveyResponseForm';
import { Loader2, MapPin } from 'lucide-react';
import { getDeviceId } from '../../services/deviceId';

interface Props {
  token: string;
}

const LOGO_URL = 'https://rwwomakjhmglgoowbmsl.supabase.co/storage/v1/object/public/Fotos/logo-real.webp';

const SurveyPublicPage: React.FC<Props> = ({ token }) => {
  const [survey, setSurvey] = useState<Survey | null>(null);
  const [storeName, setStoreName] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isCompleted, setIsCompleted] = useState(false);
  const [error, setError] = useState<boolean>(false);
  const [alreadyResponded, setAlreadyResponded] = useState(false);

  useEffect(() => {
    const fetchSurvey = async () => {
      try {
        const { data, error } = await supabase
          .from('surveys')
          .select('*')
          .eq('public_token', token)
          .eq('is_active', true)
          .single();

        if (error || !data) {
          setError(true);
        } else {
          setSurvey(data as Survey);

          if (data.allow_multiple_responses === false) {
            const deviceId = getDeviceId();
            const { data: existing } = await supabase
              .from('survey_responses')
              .select('id')
              .eq('survey_id', data.id)
              .eq('device_id', deviceId)
              .limit(1);
            if (existing && existing.length > 0) {
              setAlreadyResponded(true);
            }
          }

          // Buscar nome da loja
          if (data.store_id) {
            const { data: storeData } = await supabase
              .from('stores')
              .select('name, city')
              .eq('id', data.store_id)
              .single();
            if (storeData) {
              setStoreName(storeData.name || storeData.city || '');
            }
          } else if (data.target_store_ids && data.target_store_ids.length === 1) {
            const { data: storeData } = await supabase
              .from('stores')
              .select('name, city')
              .eq('id', data.target_store_ids[0])
              .single();
            if (storeData) {
              setStoreName(storeData.name || storeData.city || '');
            }
          }
        }
      } catch (err) {
        console.error('Erro ao carregar pesquisa:', err);
        setError(true);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSurvey();
  }, [token]);

  useEffect(() => {
    if (isCompleted) {
      const timer = setTimeout(() => {
        // Tenta voltar para a página da loja, senão fecha
        const urlParams = new URLSearchParams(window.location.search);
        const lojaNum = urlParams.get('loja');
        if (lojaNum) {
          window.location.href = '/loja/' + lojaNum;
        } else {
          window.location.href = '/';
        }
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [isCompleted]);

  // ── LOADING ──────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="min-h-screen bg-white flex flex-col">
        <PublicHeader storeName="" />
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
          <p className="text-slate-500 text-sm">Carregando pesquisa...</p>
        </div>
      </div>
    );
  }

  // ── ERRO ──────────────────────────────────────────────────
  if (error || !survey) {
    return (
      <div className="min-h-screen bg-white flex flex-col">
        <PublicHeader storeName="" />
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
            <span className="text-3xl">📝</span>
          </div>
          <h2 className="text-lg font-semibold text-slate-800 mb-2">Pesquisa não encontrada</h2>
          <p className="text-slate-500 text-sm max-w-xs">
            Esta pesquisa pode ter sido encerrada ou o link é inválido.
          </p>
        </div>
      </div>
    );
  }

  // ── CONCLUÍDO ─────────────────────────────────────────────
  if (isCompleted) {
    return (
      <div className="min-h-screen bg-white flex flex-col">
        <PublicHeader storeName={storeName} />
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mb-6">
            <svg className="w-10 h-10 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-slate-800 mb-3">
            Obrigado por participar!
          </h2>
          <p className="text-slate-500 text-base leading-relaxed max-w-sm">
            {survey.thank_you_message || 'Sua resposta foi registrada com sucesso. Ela é muito importante para melhorarmos nosso atendimento!'}
          </p>
          <div className="mt-8 pt-6 border-t border-slate-100 w-full max-w-xs flex flex-col items-center gap-2">
            <img src={LOGO_URL} alt="Real Calçados" className="h-8 object-contain opacity-60" />
            {storeName && (
              <p className="text-xs text-slate-400 flex items-center gap-1">
                <MapPin size={10} /> {storeName}
              </p>
            )}
          </div>

          {/* Countdown + botão fechar */}
          <div className="mt-6 flex flex-col items-center gap-3">
            <button
              onClick={() => {
                const urlParams = new URLSearchParams(window.location.search);
                const lojaNum = urlParams.get('loja');
                if (lojaNum) {
                  window.location.href = '/loja/' + lojaNum;
                } else {
                  window.location.href = '/';
                }
              }}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-sm font-semibold transition-all shadow-lg shadow-blue-200"
            >
              Fechar
            </button>
            <p className="text-xs text-slate-400">
              Esta página fechará automaticamente em instantes
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── JÁ RESPONDIDO ─────────────────────────────────────────
  if (alreadyResponded) {
    return (
      <div className="min-h-screen bg-white flex flex-col">
        <PublicHeader storeName={storeName} />
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mb-6">
            <svg className="w-10 h-10 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-slate-800 mb-3">
            Você já respondeu esta pesquisa
          </h2>
          <p className="text-slate-500 text-base leading-relaxed max-w-sm">
            Cada pessoa pode participar apenas uma vez neste aparelho. Obrigado pelo interesse!
          </p>
          <div className="mt-8 pt-6 border-t border-slate-100 w-full max-w-xs flex flex-col items-center gap-2">
            <img src={LOGO_URL} alt="Real Calçados" className="h-8 object-contain opacity-60" />
            {storeName && (
              <p className="text-xs text-slate-400 flex items-center gap-1">
                <MapPin size={10} /> {storeName}
              </p>
            )}
          </div>

          <div className="mt-6 flex flex-col items-center gap-3">
            <button
              onClick={() => {
                const urlParams = new URLSearchParams(window.location.search);
                const lojaNum = urlParams.get('loja');
                if (lojaNum) {
                  window.location.href = '/loja/' + lojaNum;
                } else {
                  window.location.href = '/';
                }
              }}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-sm font-semibold transition-all shadow-lg shadow-blue-200"
            >
              Fechar
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── FORMULÁRIO ────────────────────────────────────────────
  const handleClose = () => {
    const urlParams = new URLSearchParams(window.location.search);
    const lojaNum = urlParams.get('loja');
    if (lojaNum) { window.location.href = `/loja/${lojaNum}`; return; }
    const lojaMatch = window.location.pathname.match(/\/loja\/(\d+)/);
    if (lojaMatch) { window.location.href = `/loja/${lojaMatch[1]}`; return; }
    window.history.back();
  };

  return (
    <div className="min-h-screen bg-white flex flex-col overflow-x-hidden">
      <PublicHeader storeName={storeName} />
      <div className="flex-1">
        <SurveyResponseForm
          survey={survey}
          onClose={handleClose}
          onComplete={() => setIsCompleted(true)}
        />
      </div>
    </div>
  );
};

// ── HEADER PÚBLICO ────────────────────────────────────────────────────────────
const PublicHeader: React.FC<{ storeName: string }> = ({ storeName }) => {
  return (
    <header className="w-full bg-white border-b border-slate-100 px-4 py-2.5 flex items-center gap-3 sticky top-0 z-50 shadow-sm">
      <img
        src={LOGO_URL}
        alt="Real Calçados"
        className="h-8 w-auto object-contain flex-shrink-0"
      />
      {storeName && (
        <>
          <div className="w-px h-6 bg-slate-200 flex-shrink-0" />
          <div className="flex items-center gap-1.5 min-w-0">
            <MapPin size={12} className="text-slate-400 flex-shrink-0" />
            <span className="text-sm text-slate-600 truncate">{storeName}</span>
          </div>
        </>
      )}
    </header>
  );
};

export default SurveyPublicPage;