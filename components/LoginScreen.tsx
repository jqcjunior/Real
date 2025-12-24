
import React, { useState } from 'react';
import { User, Store, UserRole } from '../types';
import { Mail, Lock, UserPlus, X, Store as StoreIcon, MapPin, Phone, User as UserIcon, Send, KeyRound, AlertTriangle, Loader2, CheckCircle2 } from 'lucide-react';
import { APP_NAME, LOGO_URL } from '../constants';

interface LoginScreenProps {
  onLoginAttempt: (email: string, password: string, rememberMe: boolean) => Promise<{ success: boolean; user?: User; error?: string }>;
  onRegisterRequest?: (store: Store) => void;
  onPasswordResetRequest?: (email: string) => void;
}

const BRAZIL_STATES = [
    'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 
    'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
  ];

const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginAttempt, onRegisterRequest, onPasswordResetRequest }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // Registration Modal State
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [regStoreNumber, setRegStoreNumber] = useState('');
  const [regStoreName, setRegStoreName] = useState('');
  const [regCity, setRegCity] = useState('');
  const [regUF, setRegUF] = useState('BA');
  const [regManagerName, setRegManagerName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regPassword, setRegPassword] = useState('');

  // Forgot Password State
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [recoveryEmail, setRecoveryEmail] = useState('');

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
        console.error(err);
        setError('Erro de conexão. Tente novamente.');
        setIsLoading(false);
    }
  };

  const handleSendRecovery = (e: React.FormEvent) => {
      e.preventDefault();
      if (!recoveryEmail) {
          alert("Por favor, preencha o e-mail.");
          return;
      }
      if (onPasswordResetRequest) {
          onPasswordResetRequest(recoveryEmail);
          setShowForgotModal(false);
          setRecoveryEmail('');
          alert("Solicitação enviada! Entre em contato com o suporte para agilizar.");
      } else {
          alert("Erro ao processar solicitação.");
      }
  };

  const handleRegisterSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if (onRegisterRequest) {
          const cleanNumber = regStoreNumber ? String(parseInt(regStoreNumber.replace(/\D/g, ''), 10)) : '';
          const newStoreRequest: Store = {
              id: `req-${Date.now()}`,
              number: cleanNumber,
              name: regStoreName,
              city: `${regCity} - ${regUF}`,
              managerName: regManagerName,
              managerEmail: regEmail,
              managerPhone: regPhone,
              password: regPassword,
              status: 'pending',
              role: UserRole.MANAGER
          };
          onRegisterRequest(newStoreRequest);
          alert("Solicitação enviada com sucesso! Aguarde a aprovação do administrador.");
      } else {
          alert("Erro: Funcionalidade indisponível no momento.");
      }
      setShowRegisterModal(false);
      setRegStoreNumber('');
      setRegStoreName('');
      setRegCity('');
      setRegManagerName('');
      setRegEmail('');
      setRegPhone('');
      setRegPassword('');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 font-sans">
      <div className="w-full max-w-md bg-white rounded-[40px] shadow-2xl overflow-hidden p-8 md:p-12 border border-gray-100 relative">
        
        {/* Header Logo Section - Refined for 3D Logo */}
        <div className="flex flex-col items-center mb-10">
             <div className="relative mb-4">
                <div className="w-48 h-48 flex items-center justify-center transition-all duration-700 hover:scale-110">
                    <img 
                        src={LOGO_URL} 
                        alt="Real Calçados e Confecções" 
                        className="w-full h-full object-contain drop-shadow-[0_20px_30px_rgba(0,0,0,0.15)]"
                    />
                </div>
                <div className="absolute bottom-4 right-4 w-5 h-5 bg-green-500 border-4 border-white rounded-full shadow-lg"></div>
             </div>
             
             <div className="text-center">
                <h1 className="text-3xl font-black text-blue-950 uppercase italic tracking-tighter leading-none">
                    REAL <span className="text-red-600">ADMIN</span>
                </h1>
                <p className="text-[10px] text-blue-400 uppercase tracking-[0.4em] font-black mt-2 opacity-80">Gestão Estratégica</p>
             </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
                <div className="bg-red-50 text-red-600 text-[11px] p-4 rounded-2xl text-center border border-red-100 animate-in fade-in slide-in-from-top-1 font-black uppercase tracking-wider">
                    {error}
                </div>
            )}

            <div className="space-y-1.5">
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">E-mail de Acesso</label>
                <div className="relative group">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300 group-focus-within:text-blue-600 transition-colors">
                        <Mail size={18} />
                    </span>
                    <input 
                        type="email" 
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full pl-12 pr-4 py-4 bg-gray-50 border-none rounded-2xl focus:ring-4 focus:ring-blue-100 outline-none transition-all text-gray-700 font-bold text-sm placeholder-gray-300 shadow-inner"
                        placeholder="exemplo@realcalcados.com.br"
                    />
                </div>
            </div>

            <div className="space-y-1.5">
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Chave de Segurança</label>
                <div className="relative group">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300 group-focus-within:text-blue-600 transition-colors">
                        <Lock size={18} />
                    </span>
                    <input 
                        type="password" 
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full pl-12 pr-4 py-4 bg-gray-50 border-none rounded-2xl focus:ring-4 focus:ring-blue-100 outline-none transition-all text-gray-700 font-bold text-sm placeholder-gray-300 shadow-inner"
                        placeholder="••••••••"
                    />
                </div>
            </div>

            {/* Remember Me Checkbox */}
            <div className="flex items-center justify-between px-1 pt-1">
                <label className="flex items-center gap-2 cursor-pointer group select-none">
                    <div className="relative">
                        <input 
                            type="checkbox" 
                            className="sr-only" 
                            checked={rememberMe}
                            onChange={(e) => setRememberMe(e.target.checked)}
                        />
                        <div className={`w-5 h-5 rounded-lg border-2 transition-all flex items-center justify-center ${rememberMe ? 'bg-blue-600 border-blue-600 shadow-md shadow-blue-100' : 'bg-white border-gray-200 group-hover:border-blue-400'}`}>
                            {rememberMe && <CheckCircle2 size={12} className="text-white" strokeWidth={4} />}
                        </div>
                    </div>
                    <span className="text-[11px] font-black text-gray-400 uppercase tracking-wider group-hover:text-blue-600 transition-colors">Manter Conectado</span>
                </label>
                
                <button 
                    type="button"
                    onClick={() => setShowForgotModal(true)}
                    className="text-[10px] text-blue-600 hover:text-blue-800 font-black uppercase tracking-wider transition-colors"
                >
                    Esqueci minha senha
                </button>
            </div>

            <button 
                type="submit"
                disabled={isLoading}
                className="w-full bg-blue-900 hover:bg-black text-white font-black uppercase text-xs tracking-[0.2em] py-5 rounded-2xl shadow-xl shadow-blue-100 hover:shadow-2xl transition-all duration-300 mt-4 active:scale-[0.98] flex items-center justify-center gap-3 disabled:opacity-70 disabled:cursor-not-allowed border-b-4 border-red-700"
            >
                {isLoading ? <Loader2 className="animate-spin" size={18}/> : 'Acessar Ecossistema'}
            </button>
        </form>

        {/* Footer Actions */}
        <div className="mt-12 text-center space-y-4">
            <div className="flex items-center justify-center gap-4 opacity-20">
                <div className="h-px bg-gray-400 flex-1"></div>
                <span className="text-[9px] text-gray-500 font-black uppercase tracking-widest">Acesso Restrito</span>
                <div className="h-px bg-gray-400 flex-1"></div>
            </div>

            <button 
                onClick={() => setShowRegisterModal(true)}
                className="flex items-center justify-center gap-2 w-full py-4 text-blue-900 font-black uppercase text-[10px] tracking-widest hover:bg-blue-50 rounded-2xl transition-all border-2 border-transparent hover:border-blue-100"
            >
                <UserPlus size={16} />
                Solicitar Credenciamento
            </button>
        </div>
      </div>

      {/* Forgot Password Modal */}
      {showForgotModal && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[110] p-4 backdrop-blur-md">
             <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in duration-200">
                <div className="bg-blue-950 p-8 flex justify-between items-center">
                    <h3 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2">
                        <KeyRound size={20} className="text-red-500"/> Recuperar Acesso
                    </h3>
                    <button onClick={() => setShowForgotModal(false)} className="text-blue-300 hover:text-white transition-colors bg-white/5 p-2 rounded-full">
                        <X size={20} />
                    </button>
                </div>
                
                <form onSubmit={handleSendRecovery} className="p-8">
                    <div className="bg-orange-50 border border-orange-100 rounded-2xl p-4 mb-6 flex gap-3">
                        <AlertTriangle className="text-orange-600 flex-shrink-0" size={20} />
                        <p className="text-[10px] text-orange-800 font-bold leading-relaxed uppercase tracking-tight">
                            Uma notificação de redefinição será enviada à diretoria administrativa para validação manual.
                        </p>
                    </div>
                    <div className="space-y-5">
                        <div>
                            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 ml-1">E-mail Cadastrado</label>
                            <div className="relative group">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300 group-focus-within:text-blue-600 transition-colors">
                                    <Mail size={18} />
                                </span>
                                <input 
                                    type="email"
                                    required
                                    value={recoveryEmail}
                                    onChange={(e) => setRecoveryEmail(e.target.value)}
                                    className="w-full pl-12 pr-4 py-4 bg-gray-50 border-none rounded-2xl focus:ring-4 focus:ring-blue-100 outline-none text-gray-700 font-bold"
                                    placeholder="seu@email.com"
                                />
                            </div>
                        </div>
                        <button type="submit" className="w-full py-5 rounded-2xl text-white font-black uppercase text-[10px] tracking-widest transition-all flex items-center justify-center gap-2 shadow-xl bg-blue-700 hover:bg-blue-800 border-b-4 border-blue-900">Solicitar Redefinição</button>
                    </div>
                </form>
             </div>
          </div>
      )}

      {/* Registration Modal */}
      {showRegisterModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-4 backdrop-blur-md">
            <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200 h-[90vh] flex flex-col">
                <div className="bg-gradient-to-r from-blue-900 to-blue-950 p-8 flex justify-between items-center flex-shrink-0">
                    <div>
                        <h3 className="text-xl font-black text-white uppercase italic tracking-tighter flex items-center gap-3">
                           <UserPlus size={28} className="text-red-600" /> Solicitar <span className="text-blue-400 ml-1">Credenciamento</span>
                        </h3>
                        <p className="text-blue-300 text-[10px] font-black uppercase tracking-widest mt-1 opacity-70">Acesso à infraestrutura de gestão corporativa</p>
                    </div>
                    <button onClick={() => setShowRegisterModal(false)} className="text-blue-200 hover:text-white transition-colors bg-white/5 p-2 rounded-full">
                        <X size={24} />
                    </button>
                </div>
                <form onSubmit={handleRegisterSubmit} className="p-8 space-y-6 overflow-y-auto flex-1 no-scrollbar">
                    <div className="space-y-5">
                        <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] border-b border-gray-100 pb-3 flex items-center gap-2"><StoreIcon size={14} /> Unidade Operacional</h4>
                        <div className="grid grid-cols-4 gap-4">
                            <div className="col-span-1">
                                <label className="block text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Número</label>
                                <input required value={regStoreNumber} onChange={(e) => setRegStoreNumber(e.target.value)} className="w-full px-4 py-3 bg-gray-50 border-none rounded-xl focus:ring-4 focus:ring-blue-100 outline-none text-gray-700 font-bold" placeholder="000" />
                            </div>
                            <div className="col-span-3">
                                <label className="block text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Nome da Loja</label>
                                <input required value={regStoreName} onChange={(e) => setRegStoreName(e.target.value)} className="w-full px-4 py-3 bg-gray-50 border-none rounded-xl focus:ring-4 focus:ring-blue-100 outline-none text-gray-700 font-bold uppercase italic" placeholder="EX: REAL CALÇADOS CENTRO" />
                            </div>
                        </div>
                        <div className="grid grid-cols-4 gap-4">
                            <div className="col-span-3">
                                <label className="block text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Cidade</label>
                                <input required value={regCity} onChange={(e) => setRegCity(e.target.value)} className="w-full px-4 py-3 bg-gray-50 border-none rounded-xl focus:ring-4 focus:ring-blue-100 outline-none text-gray-700 font-bold" placeholder="Cidade" />
                            </div>
                            <div className="col-span-1">
                                <label className="block text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">UF</label>
                                <select required value={regUF} onChange={(e) => setRegUF(e.target.value)} className="w-full px-3 py-3 bg-gray-50 border-none rounded-xl focus:ring-4 focus:ring-blue-100 outline-none text-gray-700 font-bold">
                                    {BRAZIL_STATES.map(uf => <option key={uf} value={uf}>{uf}</option>)}
                                </select>
                            </div>
                        </div>
                    </div>
                    
                    <div className="space-y-5 pt-4">
                        <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] border-b border-gray-100 pb-3 flex items-center gap-2"><UserIcon size={14} /> Gestor Responsável</h4>
                        <div>
                            <label className="block text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Nome Completo</label>
                            <input required value={regManagerName} onChange={(e) => setRegManagerName(e.target.value)} className="w-full px-4 py-3 bg-gray-50 border-none rounded-xl focus:ring-4 focus:ring-blue-100 outline-none text-gray-700 font-bold uppercase" placeholder="Nome do Gerente" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Email Profissional</label>
                                <input required type="email" value={regEmail} onChange={(e) => setRegEmail(e.target.value)} className="w-full px-4 py-3 bg-gray-50 border-none rounded-xl focus:ring-4 focus:ring-blue-100 outline-none text-gray-700 font-bold" placeholder="email@realcalcados.com.br" />
                            </div>
                            <div>
                                <label className="block text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">WhatsApp</label>
                                <input required value={regPhone} onChange={(e) => setRegPhone(e.target.value)} className="w-full px-4 py-3 bg-gray-50 border-none rounded-xl focus:ring-4 focus:ring-blue-100 outline-none text-gray-700 font-bold" placeholder="(00) 00000-0000" />
                            </div>
                        </div>
                    </div>

                    <div className="space-y-5 pt-4">
                        <h4 className="text-[10px] font-black text-red-500 uppercase tracking-[0.2em] border-b border-red-50 pb-3 flex items-center gap-2"><Lock size={14} /> Credenciais Provisórias</h4>
                         <div>
                            <label className="block text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Senha de Acesso</label>
                            <input required type="password" value={regPassword} onChange={(e) => setRegPassword(e.target.value)} className="w-full px-4 py-3 bg-gray-50 border-none rounded-xl focus:ring-4 focus:ring-red-100 outline-none transition-all text-gray-700 font-bold" placeholder="Crie sua senha" />
                            <p className="text-[8px] text-gray-400 font-bold uppercase mt-2 tracking-tighter opacity-70">A senha será validada após autorização da diretoria.</p>
                        </div>
                    </div>

                    <div className="pt-8 flex gap-4">
                        <button type="button" onClick={() => setShowRegisterModal(false)} className="flex-1 px-4 py-4 text-gray-400 bg-gray-50 rounded-2xl hover:bg-gray-100 font-black uppercase text-[10px] tracking-widest transition-all">Cancelar</button>
                        <button type="submit" className="flex-1 px-4 py-4 bg-blue-700 text-white rounded-2xl hover:bg-blue-800 font-black uppercase text-[10px] tracking-widest shadow-xl shadow-blue-100 transition-all flex items-center justify-center gap-2 border-b-4 border-blue-900"><Send size={16} />Enviar Requisição</button>
                    </div>
                </form>
            </div>
        </div>
      )}
    </div>
  );
};

export default LoginScreen;
