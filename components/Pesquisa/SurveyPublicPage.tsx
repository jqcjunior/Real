import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabaseClient';
import { Survey } from '../../types';
import SurveyResponseForm from './SurveyResponseForm';
import { Loader2 } from 'lucide-react';

interface Props {
  token: string;
}

const SurveyPublicPage: React.FC<Props> = ({ token }) => {
  const [survey, setSurvey] = useState<Survey | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCompleted, setIsCompleted] = useState(false);
  const [error, setError] = useState<boolean>(false);

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
          console.error("Survey not found or error:", error);
          setError(true);
        } else {
          setSurvey(data as Survey);
        }
      } catch (err) {
        console.error("Error fetching survey:", err);
        setError(true);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSurvey();
  }, [token]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-4">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin mb-4" />
        <p className="text-slate-500 font-medium text-sm">Carregando pesquisa...</p>
      </div>
    );
  }

  if (error || !survey) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-6">
          <span className="text-2xl">📝</span>
        </div>
        <h2 className="text-xl font-black text-slate-800 mb-2">Ops!</h2>
        <p className="text-slate-500">Pesquisa não encontrada ou encerrada.</p>
      </div>
    );
  }

  if (isCompleted) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 text-center">
        <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mb-6">
           <svg className="w-10 h-10 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
           </svg>
        </div>
        <h2 className="text-2xl font-black text-slate-800 mb-4 tracking-tight">Obrigado!</h2>
        <p className="text-slate-500 text-lg leading-relaxed">
          {survey.thank_you_message || 'Sua resposta foi registrada com sucesso.'}
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white overflow-x-hidden">
      <SurveyResponseForm 
        survey={survey} 
        onClose={() => {}} 
        onComplete={() => setIsCompleted(true)} 
      />
    </div>
  );
};

export default SurveyPublicPage;
