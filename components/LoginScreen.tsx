
import React, { useState } from 'react';
import { User, Store, UserRole } from '../types';
import { Store as StoreIcon, MapPin, Mail, Phone, Lock, X, CheckCircle2, Loader2, ChevronDown } from 'lucide-react';
import { BRAND_LOGO } from '../constants';

interface LoginScreenProps {
  onLoginAttempt: (email: string, password: string, rememberMe: boolean) => Promise<{ success: boolean; user?: User; error?: string }>;
  onRegisterRequest?: (store: Partial<Store>) => Promise<void>;
  onPasswordResetRequest?: (email: string) => void;
}

const BRAZIL_STATES = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'];

const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginAttempt, onRegisterRequest }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showRegisterModal, setShowRegisterModal] = useState(false);

  const [regForm, setRegForm] = useState({
      number: '', name: '', city: '', uf: 'BA', managerName: '', managerEmail: '', managerPhone: '', password: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;
    setError('');
    setIsLoading(true);
    try {
        const result = await onLoginAttempt(email.trim(), password.trim(), rememberMe);
        if (!result.success) {
            setError(result.error || 'Credenciais inválidas.');
            setIsLoading(false);
        }
    } catch (err) {
        setError('Falha na comunicação com o servidor.');
        setIsLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!onRegisterRequest) return;
      setIsLoading(true);
      try {
          const newStore: Partial<Store> = {
              ...regForm,
              city: `${regForm.city} - ${regForm.uf}`,
              status: 'pending',
              role: UserRole.MANAGER
          };
          await onRegisterRequest(newStore);
          alert("Solicitação enviada! Aguarde a aprovação do administrador para realizar login.");
          setShowRegisterModal(false);
      } catch (err) {
          alert("Erro ao enviar solicitação. Verifique os dados.");
      } finally {
          setIsLoading(false);
      }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 font-sans p-4">
      <div className="w-full max-w-md bg-white rounded-[40px] shadow-2xl overflow-hidden p-8 md:p-12 border border-gray-100 relative">
        
        <div className="flex justify-center mb-8">
          <div className="w-28 h-28 min-w-[112px] min-h-[112px] rounded-full overflow-hidden shadow-xl border-4 border-white bg-white flex items-center justify-center">
            <img 
              src={BRAND_LOGO} 
              alt="Real Admin Logo"
              loading="eager"
              className="w-full h-full object-contain p-2"
            />
          </div>
        </div>

        <div className="text-center mb-10">
            <h1 className="text-3xl font-black text-blue-950 uppercase italic tracking-tighter leading-none">REAL <span className="text-red-600">ADMIN</span></h1>
            <p className="text-[9px] text-blue-400 uppercase tracking-[0.5em] font-black mt-2 opacity-80">Segurança & Inteligência</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
            {error && <div className="bg-red-50 text-red-600 text-[11px] p-4 rounded-2xl text-center border border-red-100 font-black uppercase">{error}</div>}
            <div className="space-y-2">
                <label className="block text-[10px] font-black text-gray-700 uppercase tracking-widest ml-1">E-mail Corporativo</label>
                <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-5 py-4 bg-gray-50 border border-gray-200 rounded-[24px] focus:bg-white focus:border-blue-500 outline-none transition-all text-gray-900 font-bold text-sm shadow-inner placeholder-gray-400" placeholder="usuario@realcalcados.com.br" />
            </div>
            <div className="space-y-2">
                <label className="block text-[10px] font-black text-gray-700 uppercase tracking-widest ml-1">Senha de Acesso</label>
                <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="w-full px-5 py-4 bg-gray-50 border border-gray-200 rounded-[24px] focus:bg-white focus:border-blue-500 outline-none transition-all text-gray-900 font-bold text-sm shadow-inner placeholder-gray-400" placeholder="••••••••" />
            </div>
            <div className="flex items-center justify-between px-1">
                <label className="flex items-center gap-2 cursor-pointer group">
                    <input type="checkbox" className="sr-only" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} />
                    <div className={`w-5 h-5 rounded-lg border-2 transition-all flex items-center justify-center ${rememberMe ? 'bg-blue-600 border-blue-600 shadow-lg' : 'bg-white border-gray-200 group-hover:border-blue-400'}`}>
                        {rememberMe && <CheckCircle2 size={12} className="text-white" strokeWidth={4} />}
                    </div>
                    <span className="text-[11px] font-black text-gray-700 uppercase tracking-wider">Manter Conectado</span>
                </label>
            </div>
            <button type="submit" disabled={isLoading} className="w-full bg-blue-950 hover:bg-black text-white font-black uppercase text-xs tracking-[0.2em] py-5 rounded-[24px] shadow-2xl transition-all border-b-4 border-red-700 disabled:opacity-50">
                {isLoading ? <Loader2 className="animate-spin" size={18}/> : 'Validar Credenciais'}
            </button>
        </form>

        <div className="mt-10 text-center">
            <button type="button" onClick={() => setShowRegisterModal(true)} className="text-blue-900 font-black uppercase text-[10px] tracking-widest hover:bg-blue-50 px-6 py-3 rounded-xl transition-all">Solicitar Acesso</button>
        </div>
      </div>

      {showRegisterModal && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[200] p-4 backdrop-blur-md">
              <div className="bg-white rounded-[40px] w-full max-w-xl max-h-[90vh] shadow-2xl overflow-hidden animate-in zoom-in duration-300 border border-white/20 flex flex-col">
                  <div className="p-8 bg-gray-50 border-b border-gray-200 flex justify-between items-center shrink-0">
                      <div>
                          <h2 className="text-2xl font-black text-gray-900 uppercase italic tracking-tighter">Solicitar <span className="text-red-600">Novo Acesso</span></h2>
                          <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mt-1">Preencha os dados da unidade para auditoria</p>
                      </div>
                      <button onClick={() => setShowRegisterModal(false)} className="text-gray-400 hover:text-red-600 bg-white p-2 rounded-full shadow-sm border border-gray-100 transition-all"><X size={20} /></button>
                  </div>
                  
                  <div className="overflow-y-auto no-scrollbar flex-1">
                    <form onSubmit={handleRegisterSubmit} className="p-8 md:p-10 space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-gray-700 uppercase ml-2 tracking-widest">Nº da Loja</label>
                                <div className="relative">
                                  <StoreIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={16}/>
                                  <input required value={regForm.number} onChange={e => setRegForm({...regForm, number: e.target.value})} className="w-full pl-12 pr-4 py-3.5 bg-gray-50 rounded-2xl text-sm font-bold text-gray-900 border border-gray-200 focus:border-blue-500 focus:bg-white outline-none transition-all placeholder-gray-400" placeholder="Ex: 10"/>
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-gray-700 uppercase ml-2 tracking-widest">Nome da Unidade</label>
                                <input required value={regForm.name} onChange={e => setRegForm({...regForm, name: e.target.value})} className="w-full px-4 py-3.5 bg-gray-50 rounded-2xl text-sm font-bold text-gray-900 border border-gray-200 focus:border-blue-500 focus:bg-white outline-none transition-all placeholder-gray-400" placeholder="Ex: Loja Centro"/>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                            <div className="md:col-span-2 space-y-1.5">
                                <label className="text-[10px] font-black text-gray-700 uppercase ml-2 tracking-widest">Cidade</label>
                                <div className="relative">
                                  <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={16}/>
                                  <input required value={regForm.city} onChange={e => setRegForm({...regForm, city: e.target.value})} className="w-full pl-12 pr-4 py-3.5 bg-gray-50 rounded-2xl text-sm font-bold text-gray-900 border border-gray-200 focus:border-blue-500 focus:bg-white outline-none transition-all placeholder-gray-400" placeholder="Ex: Salvador"/>
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-gray-700 uppercase ml-2 tracking-widest">UF</label>
                                <div className="relative">
                                  <select value={regForm.uf} onChange={e => setRegForm({...regForm, uf: e.target.value})} className="w-full px-4 py-3.5 bg-gray-50 rounded-2xl text-sm font-bold text-gray-900 border border-gray-200 focus:border-blue-500 focus:bg-white outline-none appearance-none cursor-pointer">
                                      {BRAZIL_STATES.map(uf => <option key={uf} value={uf}>{uf}</option>)}
                                  </select>
                                  <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={14} />
                                </div>
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-gray-700 uppercase ml-2 tracking-widest">Nome do Responsável / Gerente</label>
                            <div className="relative">
                              <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={16}/>
                              <input required value={regForm.managerName} onChange={e => setRegForm({...regForm, managerName: e.target.value})} className="w-full pl-12 pr-4 py-3.5 bg-gray-50 rounded-2xl text-sm font-bold text-gray-900 border border-gray-200 focus:border-blue-500 focus:bg-white outline-none transition-all placeholder-gray-400" placeholder="Nome completo do solicitante"/>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-gray-700 uppercase ml-2 tracking-widest">E-mail Corporativo</label>
                                <div className="relative">
                                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={16}/>
                                  <input required type="email" value={regForm.managerEmail} onChange={e => setRegForm({...regForm, managerEmail: e.target.value})} className="w-full pl-12 pr-4 py-3.5 bg-gray-50 rounded-2xl text-sm font-bold text-gray-900 border border-gray-200 focus:border-blue-500 focus:bg-white outline-none transition-all placeholder-gray-400" placeholder="Ex: gerencia@loja.com"/>
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-gray-700 uppercase ml-2 tracking-widest">Telefone de Contato</label>
                                <div className="relative">
                                  <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={16}/>
                                  <input required value={regForm.managerPhone} onChange={e => setRegForm({...regForm, managerPhone: e.target.value})} className="w-full pl-12 pr-4 py-3.5 bg-gray-50 rounded-2xl text-sm font-bold text-gray-900 border border-gray-200 focus:border-blue-500 focus:bg-white outline-none transition-all placeholder-gray-400" placeholder="(00) 00000-0000"/>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-gray-700 uppercase ml-2 tracking-widest">Defina sua Senha</label>
                            <div className="relative">
                              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={16}/>
                              <input required type="password" value={regForm.password} onChange={e => setRegForm({...regForm, password: e.target.value})} className="w-full pl-12 pr-4 py-3.5 bg-gray-50 rounded-2xl text-sm font-bold text-gray-900 border border-gray-200 focus:border-blue-500 focus:bg-white outline-none transition-all placeholder-gray-400" placeholder="••••••••"/>
                            </div>
                            <p className="text-[9px] text-gray-400 font-bold ml-2 italic">Dica: Use pelo menos 8 caracteres</p>
                        </div>

                        <button type="submit" disabled={isLoading} className="w-full py-5 bg-blue-900 text-white rounded-[24px] font-black uppercase text-xs shadow-xl active:scale-95 transition-all flex items-center justify-center gap-3 mt-4 border-b-4 border-blue-950 hover:bg-black">
                            {isLoading ? <Loader2 className="animate-spin" size={20}/> : <CheckCircle2 size={20}/>} Enviar para Auditoria
                        </button>
                    </form>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default LoginScreen;
