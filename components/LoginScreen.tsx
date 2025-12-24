
import React, { useState } from 'react';
import { User, Store, UserRole } from '../types';
import { Mail, Lock, Loader2, CheckCircle2 } from 'lucide-react';
import { BRAND_LOGO } from '../constants';

interface LoginScreenProps {
  onLoginAttempt: (email: string, password: string, rememberMe: boolean) => Promise<{ success: boolean; user?: User; error?: string }>;
  onRegisterRequest?: (store: Store) => void;
  onPasswordResetRequest?: (email: string) => void;
}

const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginAttempt, onRegisterRequest }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const [showRegisterModal, setShowRegisterModal] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
        const result = await onLoginAttempt(email.trim(), password.trim(), rememberMe);
        if (!result.success) {
            setError(result.error || 'Credenciais inválidas.');
            setIsLoading(false);
        }
    } catch (err) {
        setError('Erro de conexão. Tente novamente.');
        setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 font-sans p-4">
      <div className="w-full max-w-md bg-white rounded-[40px] shadow-2xl overflow-hidden p-8 md:p-12 border border-gray-100 relative">
        
        {/* LOGO INTEGRADA AO PAINEL - CONFORME REQUISITOS OBRIGATÓRIOS */}
        <div className="flex justify-center mb-8">
          <div className="w-28 h-28 rounded-full overflow-hidden shadow-xl border-4 border-white bg-white">
            <img 
              src="/branding/logo-real.png" 
              alt="Real Admin"
              className="w-full h-full object-cover"
            />
          </div>
        </div>

        <div className="text-center mb-10">
            <h1 className="text-3xl font-black text-blue-950 uppercase italic tracking-tighter leading-none">
                REAL <span className="text-red-600">ADMIN</span>
            </h1>
            <p className="text-[9px] text-blue-400 uppercase tracking-[0.5em] font-black mt-2 opacity-80">Acesso Corporativo</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
                <div className="bg-red-50 text-red-600 text-[11px] p-4 rounded-2xl text-center border border-red-100 font-black uppercase">
                    {error}
                </div>
            )}

            <div className="space-y-2">
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">E-mail</label>
                <div className="relative">
                    <input 
                        type="email" 
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full px-5 py-4 bg-gray-50 border-2 border-transparent rounded-[24px] focus:bg-white focus:border-blue-100 focus:ring-4 focus:ring-blue-50/50 outline-none transition-all text-gray-700 font-bold text-sm shadow-inner"
                        placeholder="acesso@realcalcados.com.br"
                    />
                </div>
            </div>

            <div className="space-y-2">
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Senha</label>
                <div className="relative">
                    <input 
                        type="password" 
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full px-5 py-4 bg-gray-50 border-2 border-transparent rounded-[24px] focus:bg-white focus:border-blue-100 focus:ring-4 focus:ring-blue-50/50 outline-none transition-all text-gray-700 font-bold text-sm shadow-inner"
                        placeholder="••••••••"
                    />
                </div>
            </div>

            <div className="flex items-center justify-between px-1">
                <label className="flex items-center gap-2 cursor-pointer group">
                    <input 
                        type="checkbox" 
                        className="sr-only" 
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                    />
                    <div className={`w-5 h-5 rounded-lg border-2 transition-all flex items-center justify-center ${rememberMe ? 'bg-blue-600 border-blue-600 shadow-lg' : 'bg-white border-gray-200 group-hover:border-blue-400'}`}>
                        {rememberMe && <CheckCircle2 size={12} className="text-white" strokeWidth={4} />}
                    </div>
                    <span className="text-[11px] font-black text-gray-400 uppercase tracking-wider">Manter Conectado</span>
                </label>
            </div>

            <button 
                type="submit"
                disabled={isLoading}
                className="w-full bg-blue-950 hover:bg-black text-white font-black uppercase text-xs tracking-[0.2em] py-5 rounded-[24px] shadow-2xl transition-all duration-300 active:scale-95 flex items-center justify-center gap-3 border-b-4 border-red-700"
            >
                {isLoading ? <Loader2 className="animate-spin" size={18}/> : 'Acessar Ecossistema'}
            </button>
        </form>

        <div className="mt-10 text-center">
            <button 
                onClick={() => setShowRegisterModal(true)}
                className="text-blue-900 font-black uppercase text-[10px] tracking-widest hover:bg-blue-50 px-6 py-3 rounded-xl transition-all"
            >
                Solicitar Credenciamento
            </button>
        </div>
      </div>
    </div>
  );
};

export default LoginScreen;
