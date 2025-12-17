
import React, { useState } from 'react';
import { User, Store, UserRole } from '../types';
import { Mail, Lock, UserPlus, X, Store as StoreIcon, MapPin, Phone, User as UserIcon, Send, KeyRound, AlertTriangle, Loader2 } from 'lucide-react';
import { APP_NAME } from '../constants';

interface LoginScreenProps {
  onLogin: (user: User) => void;
  users: User[];
  stores?: Store[];
  onRegisterRequest?: (store: Store) => void;
  onPasswordResetRequest?: (email: string) => void;
}

const BRAZIL_STATES = [
    'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 
    'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
  ];

const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin, users, stores = [], onRegisterRequest, onPasswordResetRequest }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [logoError, setLogoError] = useState(false);
  
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

    // Simulating a small network delay for UX
    await new Promise(resolve => setTimeout(resolve, 500));

    const cleanEmail = email.trim().toLowerCase();
    const cleanPass = password.trim();

    // 1. First check against static/admin users (MOCK_USERS)
    const adminUser = users.find(u => u.email.toLowerCase() === cleanEmail);

    if (adminUser) {
      if (adminUser.password && adminUser.password !== cleanPass) {
         setError('Senha de administrador incorreta.');
         setIsLoading(false);
         return;
      }
      onLogin(adminUser);
      return;
    } 

    // 2. If not an admin, check against Stores (Managers) loaded from Supabase
    // Note: App.tsx loads stores with the 'password' column included
    const linkedStore = stores.find(s => 
        s.managerEmail.toLowerCase() === cleanEmail && 
        s.password === cleanPass
    );

    if (linkedStore) {
        if (linkedStore.status === 'pending') {
            if (linkedStore.passwordResetRequested) {
                setError('Sua solicitação de nova senha está em análise.');
            } else {
                setError('Seu cadastro aguarda aprovação do administrador.');
            }
            setIsLoading(false);
            return;
        }
        if (linkedStore.status === 'inactive') {
            setError('O acesso desta loja foi desativado.');
            setIsLoading(false);
            return;
        }

        const assignedRole = linkedStore.role || UserRole.MANAGER;

        const managerUser: User = {
            id: linkedStore.id,
            name: linkedStore.managerName,
            email: linkedStore.managerEmail,
            role: assignedRole,
            storeId: linkedStore.id,
            photo: undefined // Optional: Add photo column later if needed
        };

        onLogin(managerUser);
        return;
    }

    // 3. If neither
    setError('E-mail ou senha inválidos.');
    setIsLoading(false);
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
      // Clear form
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
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl overflow-hidden p-8 md:p-10 border border-gray-100 relative">
        
        {/* Header Logo Section */}
        <div className="flex flex-col items-center mb-8">
          {!logoError ? (
             <img 
                src="/logo.png" 
                alt="Real Calçados" 
                className="max-w-[340px] w-full h-auto object-contain drop-shadow-2xl hover:scale-105 transition-transform duration-500 mb-2"
                onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    if (target.src.includes('logo.png')) {
                        target.src = '/logo.jpg';
                    } else {
                        setLogoError(true);
                    }
                }}
             />
          ) : (
            <div className="w-full flex justify-center items-center py-4">
                <div className="flex flex-col items-center relative">
                    <div className="text-center">
                        <h1 className="text-4xl font-black bg-gradient-to-r from-blue-600 via-blue-400 to-red-500 bg-clip-text text-transparent italic tracking-tight mb-1">
                            {APP_NAME}
                        </h1>
                        <p className="text-xs text-blue-400 uppercase tracking-[0.2em] font-bold">Gestão Estratégica</p>
                    </div>
                </div>
            </div>
          )}
          {!logoError && (
              <div className="text-center mt-2">
                  <p className="text-xs text-blue-300 uppercase tracking-[0.3em] font-bold">Gestão Estratégica</p>
              </div>
          )}
        </div>

        {/* Form Section */}
        <div className="mb-4 text-center">
            <h2 className="text-lg font-semibold text-gray-500 uppercase tracking-wide text-xs">Acesso ao Sistema</h2>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
            {error && (
                <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg text-center border border-red-200 animate-pulse font-medium">
                    {error}
                </div>
            )}

            <div className="space-y-1.5">
                <label className="block text-sm font-medium text-gray-700 ml-1">E-mail</label>
                <div className="relative group">
                    <span className="absolute left-3 top-3 text-gray-400 group-focus-within:text-blue-600 transition-colors">
                        <Mail size={18} />
                    </span>
                    <input 
                        type="email" 
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-blue-600 outline-none transition-all text-gray-700 placeholder-gray-400"
                        placeholder="seu@email.com"
                    />
                </div>
            </div>

            <div className="space-y-1.5">
                <label className="block text-sm font-medium text-gray-700 ml-1">Senha</label>
                <div className="relative group">
                    <span className="absolute left-3 top-3 text-gray-400 group-focus-within:text-blue-600 transition-colors">
                        <Lock size={18} />
                    </span>
                    <input 
                        type="password" 
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-blue-600 outline-none transition-all text-gray-700 placeholder-gray-400"
                        placeholder="........"
                    />
                </div>
            </div>

            <button 
                type="submit"
                disabled={isLoading}
                className="w-full bg-gradient-to-r from-blue-700 to-blue-900 hover:from-blue-800 hover:to-blue-950 text-white font-bold py-3.5 rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 mt-4 active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
            >
                {isLoading ? <Loader2 className="animate-spin" size={20}/> : 'Entrar'}
            </button>
        </form>

        {/* Footer Actions */}
        <div className="mt-8 text-center space-y-4">
            <button 
                type="button"
                onClick={() => setShowForgotModal(true)}
                className="text-sm text-gray-500 hover:text-blue-700 transition-colors underline decoration-transparent hover:decoration-blue-700 underline-offset-4 bg-transparent border-none cursor-pointer"
            >
                Esqueceu a senha?
            </button>
            
            <div className="flex items-center justify-center gap-2 opacity-50">
                <div className="h-px bg-gray-300 w-12"></div>
                <span className="text-xs text-gray-400 uppercase font-medium">OU</span>
                <div className="h-px bg-gray-300 w-12"></div>
            </div>

            <button 
                onClick={() => setShowRegisterModal(true)}
                className="flex items-center justify-center gap-2 w-full py-2.5 text-blue-800 font-semibold hover:bg-green-600 hover:text-white rounded-lg transition-all border border-transparent hover:border-green-700 group"
            >
                <UserPlus size={18} className="text-blue-600 group-hover:text-white transition-colors" />
                Solicitar Cadastro
            </button>
        </div>
      </div>

      {/* Forgot Password Modal */}
      {showForgotModal && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[110] p-4 backdrop-blur-sm">
             <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in duration-200">
                <div className="bg-blue-900 p-6 flex justify-between items-center">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <KeyRound size={20} className="text-blue-300"/> Recuperar Acesso
                    </h3>
                    <button onClick={() => setShowForgotModal(false)} className="text-blue-200 hover:text-white transition-colors">
                        <X size={20} />
                    </button>
                </div>
                
                <form onSubmit={handleSendRecovery} className="p-6">
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4 flex gap-3">
                        <AlertTriangle className="text-yellow-600 flex-shrink-0" size={20} />
                        <p className="text-xs text-yellow-800">
                            Ao solicitar a recuperação, o administrador será notificado para redefinir sua senha manualmente.
                        </p>
                    </div>

                    <p className="text-gray-600 text-sm mb-4">
                        Informe o e-mail cadastrado na sua loja:
                    </p>

                    <div className="space-y-4">
                        <div className="relative group">
                            <span className="absolute left-3 top-2.5 text-gray-400 group-focus-within:text-blue-600 transition-colors">
                                <Mail size={18} />
                            </span>
                            <input 
                                type="email"
                                required
                                value={recoveryEmail}
                                onChange={(e) => setRecoveryEmail(e.target.value)}
                                className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none text-gray-700"
                                placeholder="seu@email.com"
                            />
                        </div>
                        <button 
                            type="submit"
                            className="w-full py-3 rounded-lg text-white font-bold transition-all flex items-center justify-center gap-2 shadow-md bg-blue-700 hover:bg-blue-800"
                        >
                            Solicitar ao Admin
                        </button>
                    </div>
                </form>
             </div>
          </div>
      )}

      {/* Registration Modal */}
      {showRegisterModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] p-4 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200 h-[90vh] flex flex-col">
                <div className="bg-gradient-to-r from-blue-800 to-blue-900 p-6 flex justify-between items-center flex-shrink-0">
                    <div>
                        <h3 className="text-xl font-bold text-white flex items-center gap-2">
                           <UserPlus size={24} className="text-green-400" /> Solicitar Acesso
                        </h3>
                        <p className="text-blue-200 text-xs mt-1">Preencha os dados da loja e gerente</p>
                    </div>
                    <button onClick={() => setShowRegisterModal(false)} className="text-blue-200 hover:text-white transition-colors">
                        <X size={24} />
                    </button>
                </div>

                <form onSubmit={handleRegisterSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
                    {/* Store Data */}
                    <div className="space-y-4">
                        <h4 className="text-sm font-bold text-gray-800 uppercase tracking-wider border-b pb-2">Dados da Loja</h4>
                        
                        <div className="grid grid-cols-4 gap-4">
                            <div className="col-span-1">
                                <label className="block text-xs font-semibold text-gray-500 mb-1">Número</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-2.5 text-gray-400"><StoreIcon size={16}/></span>
                                    <input 
                                        required
                                        value={regStoreNumber}
                                        onChange={(e) => setRegStoreNumber(e.target.value)}
                                        className="w-full pl-9 pr-3 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-gray-600" 
                                        placeholder="000"
                                    />
                                </div>
                            </div>
                            <div className="col-span-3">
                                <label className="block text-xs font-semibold text-gray-500 mb-1">Nome da Loja</label>
                                <input 
                                    required
                                    value={regStoreName}
                                    onChange={(e) => setRegStoreName(e.target.value)}
                                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-gray-600" 
                                    placeholder="Ex: Loja Real Calçados Centro"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-4 gap-4">
                            <div className="col-span-3">
                                <label className="block text-xs font-semibold text-gray-500 mb-1">Cidade</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-2.5 text-gray-400"><MapPin size={16}/></span>
                                    <input 
                                        required
                                        value={regCity}
                                        onChange={(e) => setRegCity(e.target.value)}
                                        className="w-full pl-9 pr-3 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-gray-600" 
                                        placeholder="Cidade"
                                    />
                                </div>
                            </div>
                            <div className="col-span-1">
                                <label className="block text-xs font-semibold text-gray-500 mb-1">Estado</label>
                                <select 
                                    required
                                    value={regUF}
                                    onChange={(e) => setRegUF(e.target.value)}
                                    className="w-full px-2 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-gray-600"
                                >
                                    {BRAZIL_STATES.map(uf => (
                                        <option key={uf} value={uf}>{uf}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Manager Data */}
                    <div className="space-y-4 pt-2">
                        <h4 className="text-sm font-bold text-gray-800 uppercase tracking-wider border-b pb-2">Dados do Gerente</h4>

                        <div>
                            <label className="block text-xs font-semibold text-gray-500 mb-1">Nome Completo</label>
                            <div className="relative">
                                <span className="absolute left-3 top-2.5 text-gray-400"><UserIcon size={16}/></span>
                                <input 
                                    required
                                    value={regManagerName}
                                    onChange={(e) => setRegManagerName(e.target.value)}
                                    className="w-full pl-9 pr-3 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-gray-600" 
                                    placeholder="Nome do Gerente"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-semibold text-gray-500 mb-1">Email</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-2.5 text-gray-400"><Mail size={16}/></span>
                                    <input 
                                        required
                                        type="email"
                                        value={regEmail}
                                        onChange={(e) => setRegEmail(e.target.value)}
                                        className="w-full pl-9 pr-3 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-gray-600" 
                                        placeholder="email@exemplo.com"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-500 mb-1">Telefone</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-2.5 text-gray-400"><Phone size={16}/></span>
                                    <input 
                                        required
                                        value={regPhone}
                                        onChange={(e) => setRegPhone(e.target.value)}
                                        className="w-full pl-9 pr-3 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-gray-600" 
                                        placeholder="(00) 00000-0000"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Password Data */}
                    <div className="space-y-4 pt-2">
                        <h4 className="text-sm font-bold text-green-700 uppercase tracking-wider border-b border-green-200 pb-2">Segurança</h4>
                         <div>
                            <label className="block text-xs font-semibold text-gray-500 mb-1">Definir Senha de Acesso</label>
                            <div className="relative">
                                <span className="absolute left-3 top-2.5 text-gray-400"><Lock size={16}/></span>
                                <input 
                                    required
                                    type="password"
                                    value={regPassword}
                                    onChange={(e) => setRegPassword(e.target.value)}
                                    className="w-full pl-9 pr-3 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition-all text-gray-600" 
                                    placeholder="Crie sua senha"
                                />
                            </div>
                            <p className="text-[10px] text-gray-400 mt-1">Esta senha será usada para acessar o sistema após aprovação do admin.</p>
                        </div>
                    </div>

                    <div className="pt-4 flex gap-3">
                         <button 
                            type="button"
                            onClick={() => setShowRegisterModal(false)}
                            className="flex-1 px-4 py-3 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 font-medium transition-colors"
                        >
                            Cancelar
                        </button>
                        <button 
                            type="submit"
                            className="flex-1 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-bold shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2"
                        >
                            <Send size={18} />
                            Enviar Solicitação
                        </button>
                    </div>
                </form>
            </div>
        </div>
      )}
    </div>
  );
};

export default LoginScreen;
