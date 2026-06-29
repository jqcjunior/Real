import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabaseClient';
import apiService from '../../services/apiService';
import SurveyVotingScreen from './SurveyVotingScreen';
import { BRAND_LOGO } from '../../constants';
import { Loader2, Lock, CheckCircle2, AlertTriangle, LogOut } from 'lucide-react';

interface SurveyVotingPageProps {
  orderId: string;
}

export default function SurveyVotingPage({ orderId }: SurveyVotingPageProps) {
  const [user, setUser] = useState<any>(null);
  const [authChecking, setAuthChecking] = useState(true);
  const [loadingOrder, setLoadingOrder] = useState(false);
  const [order, setOrder] = useState<any>(null);
  const [orderError, setOrderError] = useState<string | null>(null);
  
  // Login form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  // Completion state
  const [hasCompleted, setHasCompleted] = useState(false);
  const [subOrderNum, setSubOrderNum] = useState<number>(1);
  const setError = setOrderError;

  function findSubOrder(store: any, subOrders: any[]) {
    if (!store || !store.number) {
      setError('Sua loja não pôde ser identificada.');
      return;
    }

    const storeNum = parseInt(store.number);

    // Validar se a loja pertence ao grupo autorizado (18 lojas Real Calçados)
    const LOJAS_AUTORIZADAS = [5, 8, 9, 26, 31, 34, 40, 43, 44, 45, 50, 56, 72, 88, 96, 100, 102, 109];
    if (!LOJAS_AUTORIZADAS.includes(storeNum)) {
      setError('Sua loja não está autorizada a participar desta pesquisa no momento.');
      return;
    }

    const matched = (subOrders || []).find(
      s => (s.lojas_numeros || []).includes(storeNum)
    );

    if (!matched) {
      setError(`Sua loja (${store.number}) não está incluída nesta pesquisa de compra.`);
      return;
    }

    setSubOrderNum(matched.sub_order_num);
  }

  // 1. Restore/Check Session on Mount
  useEffect(() => {
    async function checkSession() {
      try {
        setAuthChecking(true);
        const saved = localStorage.getItem('realcalcados_user');
        if (saved) {
          const parsed = JSON.parse(saved);
          const userId = parsed.user_id || parsed.id;
          if (userId) {
            // Re-establish session
            await supabase.rpc('set_user_session', { p_user_id: String(userId) });
            setUser(parsed);
          }
        }
      } catch (err) {
        console.error('Erro ao restaurar sessão na pesquisa:', err);
      } finally {
        setAuthChecking(false);
      }
    }
    checkSession();
  }, []);

  // 2. Load order details if user is logged in
  useEffect(() => {
    if (!user) return;

    async function loadOrder() {
      try {
        setLoadingOrder(true);
        setOrderError(null);

        // Set session for safety
        const userId = user.user_id || user.id;
        await supabase.rpc('set_user_session', { p_user_id: String(userId) });

        const { data, error } = await supabase
          .from('buy_orders')
          .select('id, numero_pedido, marca, status, created_at, survey_params')
          .eq('id', orderId)
          .maybeSingle();

        if (error) throw error;
        if (!data) {
          setOrderError('Pedido de compra não localizado.');
          return;
        }

        setOrder(data);

        if (data.status !== 'aguardando_pesquisa') {
          setOrderError(`Esta pesquisa já foi encerrada ou o pedido mudou de status (Status atual: ${data.status.replace('_', ' ').toUpperCase()}).`);
          return;
        }

        // Verificar prazo expirado
        const prazoHoras = data.survey_params?.prazo_horas || 24;
        const createdAt = new Date(data.created_at).getTime();
        const deadline = createdAt + prazoHoras * 60 * 60 * 1000;
        if (Date.now() > deadline) {
          setOrderError(`O prazo desta pesquisa encerrou. Duração: ${prazoHoras}h a partir de ${new Date(createdAt).toLocaleString('pt-BR')}. Entre em contato com o comprador.`);
          return;
        }

        // Fetch store details
        let storeObj = null;
        if (user.storeId) {
          const { data: storeData, error: sErr } = await supabase
            .from('stores')
            .select('number, city')
            .eq('id', user.storeId)
            .maybeSingle();
          if (!sErr && storeData) {
            storeObj = storeData;
          }
        }

        if (!storeObj) {
          setOrderError('Sua loja não pôde ser identificada no seu cadastro.');
          return;
        }

        // Fetch sub-orders
        const { data: subOrdersData, error: subErr } = await supabase
          .from('buy_order_sub_orders')
          .select('*')
          .eq('order_id', orderId);

        if (subErr) throw subErr;

        findSubOrder(storeObj, subOrdersData || []);
      } catch (err: any) {
        console.error('Erro ao carregar pedido para pesquisa:', err);
        setOrderError(err.message || 'Erro ao carregar detalhes do pedido.');
      } finally {
        setLoadingOrder(false);
      }
    }

    loadOrder();
  }, [user, orderId]);

  // 3. Handle Submit Login
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loginLoading) return;
    setLoginError('');

    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(email.trim())) {
      setLoginError('Por favor, insira um e-mail válido.');
      return;
    }

    setLoginLoading(true);
    try {
      const result = await apiService.login(email.trim(), password.trim());
      if (result && result.user) {
        const userId = result.user.user_id || result.user.id || (result.user as any).userId;
        const rawRole = (result.user.role || result.user.role_level || '').toUpperCase().trim();

        // Check permission: manager, gerente, admin or comprador
        const isAllowed = ['ADMIN', 'COMPRADOR', 'GERENTE', 'MANAGER'].includes(rawRole);
        if (!isAllowed) {
          setLoginError('Apenas administradores, compradores e gerentes podem votar nesta pesquisa.');
          setLoginLoading(false);
          return;
        }

        const loggedUser = {
          id: userId,
          name: result.user.name,
          role: rawRole,
          email: result.user.email,
          storeId: result.user.storeId || result.user.store_id
        };

        setUser(loggedUser);
        localStorage.setItem('realcalcados_user', JSON.stringify(loggedUser));
        localStorage.setItem('auth_token', 'session_active');
      } else {
        setLoginError('Credenciais inválidas.');
      }
    } catch (err: any) {
      console.error('Login error details:', err);
      setLoginError(err.message || 'Falha na comunicação com o servidor.');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      localStorage.removeItem('realcalcados_user');
      localStorage.removeItem('auth_token');
      setUser(null);
      setOrder(null);
    } catch (err) {
      console.error('Erro ao deslogar:', err);
    }
  };

  if (authChecking) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4">
        <Loader2 className="w-10 h-10 text-purple-600 animate-spin mb-4" />
        <p className="text-xs font-black uppercase text-slate-500 tracking-widest animate-pulse">Verificando acesso...</p>
      </div>
    );
  }

  // ─── LOGIN SCREEN ───
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 font-sans p-4">
        <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-[32px] shadow-2xl overflow-hidden p-8 border border-slate-100 dark:border-slate-800">
          
          <div className="flex justify-center mb-6">
            <div className="w-full h-20 flex items-center justify-center overflow-hidden">
              <img 
                src={BRAND_LOGO} 
                alt="Real Admin Logo"
                referrerPolicy="no-referrer"
                className="max-h-full w-auto object-contain"
              />
            </div>
          </div>

          <div className="text-center mb-6">
            <h1 className="text-xl font-black text-slate-900 dark:text-white uppercase italic tracking-tighter leading-none">
              PESQUISA DE <span className="text-purple-600">COMPRAS</span>
            </h1>
            <p className="text-[9px] text-purple-500 uppercase tracking-[0.4em] font-black mt-2 opacity-80">
              Votação de Pedidos de Grade
            </p>
          </div>

          <form onSubmit={handleLoginSubmit} className="space-y-4">
            {loginError && (
              <div className="bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 text-xs p-4 rounded-2xl text-center border border-red-100 dark:border-red-900/50 font-black uppercase">
                {loginError}
              </div>
            )}
            
            <div className="space-y-1">
              <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1">
                E-mail Corporativo
              </label>
              <input 
                type="email" 
                required 
                value={email} 
                onChange={(e) => setEmail(e.target.value)} 
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl focus:bg-white focus:border-purple-500 outline-none transition-all text-slate-900 dark:text-white font-bold text-sm" 
                placeholder="usuario@realcalcados.com.br" 
              />
            </div>

            <div className="space-y-1">
              <div className="flex justify-between items-center ml-1">
                <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                  Senha
                </label>
                <button 
                  type="button" 
                  onClick={() => setShowPassword(!showPassword)}
                  className="text-[9px] font-bold text-purple-600 uppercase tracking-tighter hover:underline"
                >
                  {showPassword ? 'Ocultar' : 'Mostrar'}
                </button>
              </div>
              <div className="relative">
                <input 
                  type={showPassword ? "text" : "password"} 
                  required 
                  value={password} 
                  onChange={(e) => setPassword(e.target.value)} 
                  autoComplete="off" 
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl focus:bg-white focus:border-purple-500 outline-none transition-all text-slate-900 dark:text-white font-bold text-sm pr-12" 
                  placeholder="••••••••" 
                />
                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                  <Lock size={16} />
                </div>
              </div>
            </div>

            <button 
              type="submit" 
              disabled={loginLoading} 
              className="w-full bg-purple-600 hover:bg-purple-700 text-white font-black uppercase text-xs tracking-[0.2em] py-4 rounded-2xl shadow-xl transition-all border-b-4 border-purple-800 disabled:opacity-50 mt-4 flex items-center justify-center gap-2"
            >
              {loginLoading ? <Loader2 className="animate-spin" size={18}/> : 'Acessar Pesquisa'}
            </button>
          </form>
          
          <div className="mt-6 text-center text-[10px] text-slate-400 dark:text-slate-500">
            Acesso exclusivo para Gerentes, Compradores e Administradores.
          </div>
        </div>
      </div>
    );
  }

  // ─── ERROR STATE ───
  if (orderError) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-[32px] shadow-xl p-8 border border-slate-100 dark:border-slate-800 text-center relative">
          <button 
            onClick={handleLogout}
            className="absolute top-6 right-6 text-slate-400 hover:text-red-500 transition-colors flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider"
          >
            <LogOut size={14} /> Sair
          </button>
          
          <div className="w-16 h-16 bg-amber-50 dark:bg-amber-950/20 rounded-full flex items-center justify-center mx-auto mb-6 text-amber-500">
            <AlertTriangle size={32} />
          </div>
          <h3 className="text-xl font-black uppercase italic tracking-tighter text-slate-900 dark:text-white mb-2">
            Pesquisa Indisponível
          </h3>
          <p className="text-slate-500 dark:text-slate-400 text-sm font-medium mb-8">
            {orderError}
          </p>
          <div className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">
            Logado como: <span className="text-slate-600 dark:text-slate-300">{user.name} ({user.email})</span>
          </div>
        </div>
      </div>
    );
  }

  // ─── LOADING ORDER ───
  if (loadingOrder) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4">
        <Loader2 className="w-10 h-10 text-purple-600 animate-spin mb-4" />
        <p className="text-xs font-black uppercase text-slate-500 tracking-widest animate-pulse">Carregando detalhes do pedido...</p>
      </div>
    );
  }

  // ─── SUCCESS COMPLETED SCREEN ───
  if (hasCompleted) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-[32px] shadow-2xl p-8 border border-slate-100 dark:border-slate-800 text-center relative">
          <div className="w-20 h-20 bg-green-50 dark:bg-green-950/20 rounded-full flex items-center justify-center mx-auto mb-6 text-green-500 animate-bounce">
            <CheckCircle2 size={44} className="stroke-[2.5]" />
          </div>
          <h3 className="text-2xl font-black uppercase italic tracking-tighter text-slate-900 dark:text-white mb-2">
            Votação Concluída!
          </h3>
          <p className="text-slate-500 dark:text-slate-400 text-sm font-medium mb-8">
            Seus votos e escolhas de grade foram registrados com sucesso para o pedido{' '}
            <span className="font-bold text-slate-700 dark:text-slate-200">
              #{order?.numero_pedido} - {order?.marca}
            </span>.
            <br />
            Muito obrigado por sua participação!
          </p>
          <p className="text-xs text-slate-400 font-medium italic mb-2">
            Você já pode fechar esta página com segurança.
          </p>
          <button
            onClick={handleLogout}
            className="mt-6 px-6 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl text-xs font-black uppercase tracking-wider transition-all"
          >
            Sair da Conta
          </button>
        </div>
      </div>
    );
  }

  // ─── ACTIVE VOTING SCREEN ───
  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950">
      {/* Mini header showing user info & exit option */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 py-3 flex justify-between items-center text-xs">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 bg-green-500 rounded-full animate-ping"></span>
          <span className="font-medium text-slate-600 dark:text-slate-300">
            Sessão Ativa: <strong className="font-black text-slate-800 dark:text-white uppercase">{user.name}</strong>
          </span>
        </div>
        <button 
          onClick={handleLogout}
          className="text-slate-400 hover:text-red-500 transition-colors flex items-center gap-1 text-[10px] font-black uppercase tracking-wider"
        >
          <LogOut size={13} /> Sair
        </button>
      </div>

      {/* Main active voting flow */}
      <div className="p-4 md:p-6 max-w-7xl mx-auto h-[calc(100vh-45px)] flex flex-col justify-stretch">
        <SurveyVotingScreen 
          user={user} 
          orderId={orderId} 
          subOrderNum={subOrderNum} 
          storeId={user.storeId} 
          gradesPredefinidas={order?.survey_params?.gradesPredefinidas || ['A','B','C','D']}
          onClose={handleLogout} 
          onComplete={() => setHasCompleted(true)} 
        />
      </div>
    </div>
  );
}
