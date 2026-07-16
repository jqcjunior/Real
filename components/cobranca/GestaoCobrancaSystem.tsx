import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../services/supabaseClient';
import { useUserStorePermissions } from '../../hooks/useUserStorePermissions';
import { User as UserType } from '../../types';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import {
  LayoutDashboard, Link, Upload, History, MessageSquare, Ban, Plus, Trash2,
  Search, Eye, RefreshCw, Play, Check, AlertTriangle, ChevronRight, Sparkles,
  CheckCircle2, XCircle, Clock, Smartphone, User as UserIcon, FileText, Send, ArrowRight
} from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, PieChart, Pie, Cell, Legend
} from 'recharts';

// ═══════════════════════════════════════════════════════════════════════════
// TIPOS E CONTEXTOS
// ═══════════════════════════════════════════════════════════════════════════

interface GestaoCobrancaSystemProps {
  user: UserType;
  currentTab: string;
  onTabChange: (tab: string) => void;
}

interface WhatsAppNumber {
  id: string;
  store_id: string;
  phone_number: string;
  bsp_phone_id: string;
  status: string;
  quality_rating: string;
  daily_limit: number;
  sent_today: number;
}

interface CollectionBatch {
  id: string;
  store_id: string;
  nome: string;
  status: string;
  total_contatos: number;
  total_enviados: number;
  total_entregues: number;
  total_lidos: number;
  total_falhas: number;
  created_at: string;
}

interface CollectionContact {
  id: string;
  batch_id: string;
  nome: string;
  telefone: string;
  telefone_original: string;
  status_validacao: string;
  status_envio: string;
  error_message?: string;
}

interface OptOutContact {
  telefone: string;
  nome: string;
  store_id: string;
  motivo: string;
  created_at: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════
export default function GestaoCobrancaSystem({ user, currentTab, onTabChange }: GestaoCobrancaSystemProps) {
  // 1. Hook de permissões de loja para MODULE_COBRANCA
  const {
    loading: permLoading,
    stores,
    canViewAllStores,
    hasAccess,
    allowedStoreIds
  } = useUserStorePermissions(user, 'MODULE_COBRANCA');

  const [selectedStoreId, setSelectedStoreId] = useState<string>('');

  // 2. Sincronizar storeID padrão quando as lojas carregam
  useEffect(() => {
    if (stores && stores.length > 0) {
      if (!selectedStoreId) {
        setSelectedStoreId(stores[0].id || '');
      }
    }
  }, [stores, selectedStoreId]);

  // Se estiver carregando permissões
  if (permLoading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center p-8">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-600 dark:text-slate-400 font-bold">Verificando permissões de acesso...</p>
        </div>
      </div>
    );
  }

  // Se não tem acesso
  if (!hasAccess) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center p-8">
        <div className="max-w-md w-full bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-xl text-center border border-red-100 dark:border-red-950/20">
          <div className="w-16 h-16 bg-red-100 dark:bg-red-950/30 text-red-600 dark:text-red-400 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <XCircle size={32} />
          </div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase mb-2">Acesso Restrito</h2>
          <p className="text-slate-600 dark:text-slate-400 mb-6">
            Seu usuário não possui permissões associadas para acessar as lojas no módulo de Cobrança. Entre em contato com o administrador do sistema.
          </p>
        </div>
      </div>
    );
  }

  const activeStore = stores.find(s => s.id === selectedStoreId);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100">
      {/* HEADER PREMIUM */}
      <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700/50 shadow-sm sticky top-0 z-10 transition-all duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-600/10 text-blue-600 dark:text-blue-400 rounded-xl flex items-center justify-center shadow-inner">
              <MessageSquare size={24} />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Gestão Cobrança</h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Lotes de Notificação Automática por WhatsApp</p>
            </div>
          </div>

          {/* SELETOR DE LOJA INTEGRADO */}
          <div className="flex items-center gap-3 w-full sm:w-auto">
            {canViewAllStores ? (
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full sm:w-auto">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Unidade Ativa:</span>
                <select
                  value={selectedStoreId}
                  onChange={(e) => setSelectedStoreId(e.target.value)}
                  className="bg-slate-50 hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl py-2 px-4 text-sm font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer shadow-sm transition-all"
                >
                  {stores.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.number} - {s.name} ({s.city})
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="bg-slate-100 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700/50 rounded-xl py-2 px-4 flex items-center gap-2">
                <div className="w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-xs font-black text-slate-600 dark:text-slate-300 uppercase">
                  Loja: {activeStore ? `${activeStore.number} - ${activeStore.name}` : 'Carregando...'}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* TABS MENU HORIZONTAL COM ANIMATION */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex overflow-x-auto no-scrollbar gap-2 py-2">
            {[
              { id: 'cobranca_dashboard', label: 'Painel Geral', icon: LayoutDashboard },
              { id: 'cobranca_vinculo', label: 'Contas de Disparo', icon: Link },
              { id: 'cobranca_importar', label: 'Importar Lote', icon: Upload },
              { id: 'cobranca_historico', label: 'Histórico de Envios', icon: History },
              { id: 'cobranca_template', label: 'Template WhatsApp', icon: MessageSquare },
              { id: 'cobranca_optout', label: 'Não Perturbe (Opt-out)', icon: Ban }
            ].map(tab => {
              const isActive = currentTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => onTabChange(tab.id)}
                  className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-300 relative shrink-0 ${
                    isActive
                      ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/10 shadow-sm border border-blue-100 dark:border-blue-950/20'
                      : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/40 border border-transparent'
                  }`}
                >
                  <tab.icon size={16} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ÁREA DE CONTEÚDO PRINCIPAL COM TRANSIÇÕES */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {selectedStoreId ? (
          <AnimatePresence mode="wait">
            <motion.div
              key={currentTab + '_' + selectedStoreId}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.25 }}
            >
              {currentTab === 'cobranca_dashboard' && <CobrancaDashboard storeId={selectedStoreId} />}
              {currentTab === 'cobranca_vinculo' && <CobrancaVinculo storeId={selectedStoreId} stores={stores} canViewAllStores={canViewAllStores} />}
              {currentTab === 'cobranca_importar' && <CobrancaImportar storeId={selectedStoreId} user={user} onTabChange={onTabChange} />}
              {currentTab === 'cobranca_historico' && <CobrancaHistorico storeId={selectedStoreId} />}
              {currentTab === 'cobranca_template' && <CobrancaTemplate storeId={selectedStoreId} />}
              {currentTab === 'cobranca_optout' && <CobrancaOptOut storeId={selectedStoreId} />}
            </motion.div>
          </AnimatePresence>
        ) : (
          <div className="text-center py-16">
            <p className="text-slate-500 dark:text-slate-400 font-bold">Nenhuma unidade disponível ou selecionada.</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB 1: DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════
function CobrancaDashboard({ storeId }: { storeId: string }) {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalLotes: 0,
    totalContatos: 0,
    totalEnviados: 0,
    totalEntregues: 0,
    totalLidos: 0,
    totalFalhas: 0
  });
  const [batchesData, setBatchesData] = useState<any[]>([]);

  useEffect(() => {
    loadDashboardData();
  }, [storeId]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const { data: batches, error } = await supabase
        .from('collection_batches')
        .select('*')
        .eq('store_id', storeId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      if (batches && batches.length > 0) {
        let contactsCount = 0;
        let enviados = 0;
        let entregues = 0;
        let lidos = 0;
        let falhas = 0;

        batches.forEach(b => {
          contactsCount += (b.total_contatos || 0);
          enviados += (b.total_enviados || 0);
          entregues += (b.total_entregues || 0);
          lidos += (b.total_lidos || 0);
          falhas += (b.total_falhas || 0);
        });

        setStats({
          totalLotes: batches.length,
          totalContatos: contactsCount,
          totalEnviados: enviados,
          totalEntregues: entregues,
          totalLidos: lidos,
          totalFalhas: falhas
        });

        // Formatar dados dos últimos 7 lotes para o gráfico
        const chartData = batches.slice(-7).map(b => ({
          name: b.nome.length > 15 ? b.nome.substring(0, 15) + '...' : b.nome,
          'Contatos': b.total_contatos || 0,
          'Entregues': b.total_entregues || 0,
          'Falhas': b.total_falhas || 0
        }));
        setBatchesData(chartData);
      } else {
        setStats({
          totalLotes: 0,
          totalContatos: 0,
          totalEnviados: 0,
          totalEntregues: 0,
          totalLidos: 0,
          totalFalhas: 0
        });
        setBatchesData([]);
      }
    } catch (err) {
      console.error('Erro ao buscar dados do painel:', err);
      toast.error('Erro ao carregar métricas de cobrança');
    } finally {
      setLoading(false);
    }
  };

  const deliveryRate = stats.totalEnviados > 0 ? Math.round((stats.totalEntregues / stats.totalEnviados) * 100) : 0;
  const readRate = stats.totalEnviados > 0 ? Math.round((stats.totalLidos / stats.totalEnviados) * 100) : 0;
  const failureRate = stats.totalEnviados > 0 ? Math.round((stats.totalFalhas / stats.totalEnviados) * 100) : 0;

  if (loading) {
    return <DashboardSkeleton />;
  }

  // Cores do gráfico de rosca
  const pieData = [
    { name: 'Lidos', value: stats.totalLidos, color: '#10B981' },
    { name: 'Entregues (Não Lidos)', value: Math.max(0, stats.totalEntregues - stats.totalLidos), color: '#3B82F6' },
    { name: 'Falhas', value: stats.totalFalhas, color: '#EF4444' },
    { name: 'Pendentes', value: Math.max(0, stats.totalContatos - stats.totalEnviados), color: '#94A3B8' }
  ].filter(item => item.value > 0);

  return (
    <div className="space-y-6">
      {/* STATS CARDS GRID */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
        {[
          { label: 'Lotes Criados', value: stats.totalLotes, color: 'blue', icon: History },
          { label: 'Contatos Totais', value: stats.totalContatos, color: 'indigo', icon: UserIcon },
          { label: 'Envios Feitos', value: stats.totalEnviados, color: 'sky', icon: Send },
          { label: 'Taxa Entrega', value: `${deliveryRate}%`, color: 'emerald', icon: CheckCircle2 },
          { label: 'Taxa Leitura', value: `${readRate}%`, color: 'green', icon: Sparkles },
          { label: 'Taxa Falhas', value: `${failureRate}%`, color: 'red', icon: XCircle }
        ].map((card, idx) => (
          <div key={idx} className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200/60 dark:border-slate-700/50 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest leading-none">{card.label}</span>
              <card.icon size={16} className={`text-${card.color}-500 dark:text-${card.color}-400 opacity-85`} />
            </div>
            <p className="text-xl font-black text-slate-900 dark:text-white mt-1 leading-none">{card.value}</p>
          </div>
        ))}
      </div>

      {stats.totalLotes === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-12 text-center border border-slate-200/50 dark:border-slate-700/50 shadow-sm">
          <div className="w-16 h-16 bg-slate-100 dark:bg-slate-900/60 text-slate-400 dark:text-slate-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <LayoutDashboard size={32} />
          </div>
          <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase">Nenhum envio registrado</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 max-w-sm mx-auto">
            Não há lotes de cobrança enviados para esta loja ainda. Crie um lote importando um arquivo de contatos!
          </p>
        </div>
      ) : (
        /* CHARTS CONTAINER */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* GRÁFICO BARRA EVOLUÇÃO */}
          <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200/60 dark:border-slate-700/50 shadow-sm lg:col-span-2">
            <h3 className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-6">Desempenho dos Últimos Lotes</h3>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={batchesData} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                  <XAxis dataKey="name" tick={{ fill: '#64748B', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#64748B', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1E293B',
                      borderRadius: '12px',
                      border: 'none',
                      color: '#F8FAFC'
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11, fontWeight: 'bold' }} />
                  <Bar dataKey="Contatos" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Entregues" fill="#10B981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Falhas" fill="#EF4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* STATUS DISTRIBUIÇÃO PIE */}
          <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200/60 dark:border-slate-700/50 shadow-sm flex flex-col justify-between">
            <h3 className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-4">Status de Distribuição</h3>
            {pieData.length > 0 ? (
              <>
                <div className="h-56 relative flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                  {/* Central Overlay percentage */}
                  <div className="absolute text-center">
                    <p className="text-3xl font-black text-slate-900 dark:text-white leading-none">{deliveryRate}%</p>
                    <p className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase mt-1 leading-none">Entregues</p>
                  </div>
                </div>
                <div className="space-y-2 mt-4">
                  {pieData.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between text-xs font-bold text-slate-600 dark:text-slate-400">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></div>
                        <span>{item.name}</span>
                      </div>
                      <span>{item.value} ({Math.round((item.value / stats.totalContatos) * 100)}%)</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-slate-400">
                <AlertTriangle size={24} className="mb-2" />
                <span className="text-xs font-bold uppercase">Sem registros de envios para consolidar gráfico</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="bg-white dark:bg-slate-800 h-24 rounded-2xl border border-slate-200/50 dark:border-slate-700/50"></div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-slate-800 h-80 rounded-2xl border border-slate-200/50 dark:border-slate-700/50 lg:col-span-2"></div>
        <div className="bg-white dark:bg-slate-800 h-80 rounded-2xl border border-slate-200/50 dark:border-slate-700/50"></div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB 2: VÍNCULO NÚMERO
// ═══════════════════════════════════════════════════════════════════════════
interface CobrancaVinculoProps {
  storeId: string;
  stores: any[];
  canViewAllStores: boolean;
}

function CobrancaVinculo({ storeId, stores, canViewAllStores }: CobrancaVinculoProps) {
  const [loading, setLoading] = useState(true);
  const [numbers, setNumbers] = useState<WhatsAppNumber[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  // Form states
  const [targetStoreId, setTargetStoreId] = useState(storeId);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [bspPhoneId, setBspPhoneId] = useState('');
  const [dailyLimit, setDailyLimit] = useState(1000);

  useEffect(() => {
    loadNumbers();
    setTargetStoreId(storeId);
  }, [storeId]);

  const loadNumbers = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('whatsapp_numbers')
        .select('*')
        .eq('store_id', storeId);

      if (error) throw error;
      setNumbers(data || []);
    } catch (err) {
      console.error('Erro ao buscar números:', err);
      toast.error('Erro ao carregar números de disparo');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneNumber || !bspPhoneId) {
      toast.error('Por favor, preencha todos os campos obrigatórios.');
      return;
    }

    try {
      const { error } = await supabase
        .from('whatsapp_numbers')
        .insert([{
          store_id: targetStoreId,
          phone_number: phoneNumber.trim(),
          bsp_phone_id: bspPhoneId.trim(),
          daily_limit: Number(dailyLimit) || 1000,
          sent_today: 0,
          status: 'active',
          quality_rating: 'Green'
        }]);

      if (error) throw error;

      toast.success('Número vinculado com sucesso!');
      setPhoneNumber('');
      setBspPhoneId('');
      setDailyLimit(1000);
      setIsOpen(false);
      loadNumbers();
    } catch (err) {
      console.error('Erro ao cadastrar número:', err);
      toast.error('Erro ao cadastrar número');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja realmente remover este vínculo de número de disparo?')) return;

    try {
      const { error } = await supabase
        .from('whatsapp_numbers')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast.success('Vínculo removido!');
      loadNumbers();
    } catch (err) {
      console.error('Erro ao remover número:', err);
      toast.error('Erro ao remover vínculo');
    }
  };

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        {[...Array(2)].map((_, i) => (
          <div key={i} className="bg-white dark:bg-slate-800 h-28 rounded-2xl border border-slate-200/50 dark:border-slate-700/50"></div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ACTION TOPBAR */}
      <div className="flex justify-between items-center bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200/60 dark:border-slate-700/50 shadow-sm">
        <div>
          <h3 className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Contas de Disparo Disponíveis</h3>
          <p className="text-xs text-slate-500 mt-1">Gerencie os números do WhatsApp Cloud API vinculados a esta unidade</p>
        </div>
        <button
          onClick={() => setIsOpen(true)}
          className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 px-4 rounded-xl text-xs uppercase tracking-wider flex items-center gap-2 shadow-sm transition-all"
        >
          <Plus size={16} />
          <span>Vincular Conta</span>
        </button>
      </div>

      {numbers.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-12 text-center border border-slate-200/50 dark:border-slate-700/50 shadow-sm">
          <div className="w-16 h-16 bg-slate-100 dark:bg-slate-900/60 text-slate-400 dark:text-slate-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <Link size={32} />
          </div>
          <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase">Nenhum número vinculado</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 max-w-sm mx-auto">
            Não há contas do WhatsApp Business API vinculadas a esta unidade de negócio. Vincule uma nova conta clicando no botão acima!
          </p>
        </div>
      ) : (
        /* DISPARO CARDS LIST */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {numbers.map((num) => {
            const usagePercent = Math.min(100, Math.round(((num.sent_today || 0) / (num.daily_limit || 1000)) * 100));
            return (
              <div
                key={num.id}
                className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200/60 dark:border-slate-700/50 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col justify-between gap-4 relative"
              >
                {/* TOP CARDS ROW */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-green-500/10 text-green-500 rounded-xl flex items-center justify-center shadow-inner">
                      <Smartphone size={20} />
                    </div>
                    <div>
                      <p className="text-sm font-black text-slate-900 dark:text-white">{num.phone_number}</p>
                      <p className="text-[10px] font-bold text-slate-400 mt-0.5 font-mono">ID: {num.bsp_phone_id}</p>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <span className="bg-green-500/10 text-green-500 font-black text-[9px] uppercase tracking-wider py-1 px-2.5 rounded-full border border-green-500/10">
                      {num.status === 'active' ? 'Ativo' : num.status}
                    </span>
                    <span className={`font-black text-[9px] uppercase tracking-wider py-1 px-2.5 rounded-full border ${
                      num.quality_rating === 'Green' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/10' :
                      num.quality_rating === 'Yellow' ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/10' :
                      'bg-red-500/10 text-red-500 border-red-500/10'
                    }`}>
                      Qualidade: {num.quality_rating}
                    </span>
                  </div>
                </div>

                {/* LIMIT DISPLAY */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs font-bold text-slate-500">
                    <span>Cota de Envio Diária</span>
                    <span>{num.sent_today || 0} / {num.daily_limit || 1000} ({usagePercent}%)</span>
                  </div>
                  <div className="w-full bg-slate-100 dark:bg-slate-900 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-blue-600 h-full transition-all duration-500"
                      style={{ width: `${usagePercent}%` }}
                    ></div>
                  </div>
                </div>

                {/* BOTTOM ROW */}
                <div className="border-t border-slate-100 dark:border-slate-700/50 pt-3 flex justify-end">
                  <button
                    onClick={() => handleDelete(num.id)}
                    className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-xl transition-all"
                    title="Excluir Vínculo"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* CREATE MODAL */}
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-slate-800 max-w-md w-full p-6 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700"
            >
              <h3 className="text-md font-black text-slate-900 dark:text-white uppercase mb-4">Vincular Conta WhatsApp</h3>
              <form onSubmit={handleCreate} className="space-y-4">
                {canViewAllStores && (
                  <div>
                    <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Selecione a Unidade</label>
                    <select
                      value={targetStoreId}
                      onChange={(e) => setTargetStoreId(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-sm font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {stores.map(s => (
                        <option key={s.id} value={s.id}>{s.number} - {s.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Número de Telefone</label>
                  <input
                    type="text"
                    required
                    placeholder="+55 75 99999-9999"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-sm font-bold text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-1">ID do Telefone Cloud API (BSP)</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: 10928374910293"
                    value={bspPhoneId}
                    onChange={(e) => setBspPhoneId(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-sm font-bold text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Limite Diário de Disparos</label>
                  <input
                    type="number"
                    value={dailyLimit}
                    onChange={(e) => setDailyLimit(Number(e.target.value))}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-sm font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="flex-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-100 font-bold py-2.5 rounded-xl text-xs uppercase tracking-wider transition-all"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-bold py-2.5 rounded-xl text-xs uppercase tracking-wider transition-all"
                  >
                    Vincular
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB 3: IMPORTAR LOTE (TXT / CSV)
// ═══════════════════════════════════════════════════════════════════════════
interface CobrancaImportarProps {
  storeId: string;
  user: UserType;
  onTabChange: (tab: string) => void;
}

interface ParsedContact {
  nome: string;
  telefoneOriginal: string;
  telefoneSanitizado: string;
  status: 'ok' | 'corrigido' | 'erro';
  obs: string;
}

function CobrancaImportar({ storeId, user, onTabChange }: CobrancaImportarProps) {
  const [fileContent, setFileContent] = useState<string>('');
  const [dragActive, setDragActive] = useState(false);
  const [contacts, setContacts] = useState<ParsedContact[]>([]);
  const [batchName, setBatchName] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Formatar nome inicial do lote baseado no dia
  useEffect(() => {
    const today = new Date();
    const formattedDate = today.toLocaleDateString('pt-BR');
    const formattedTime = today.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    setBatchName(`Lote Cobrança - ${formattedDate} ${formattedTime}`);
  }, [storeId]);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleFile = (file: File) => {
    const isTxt = file.type === "text/plain" || file.name.endsWith(".txt");
    const isCsv = file.type === "text/csv" || file.name.endsWith(".csv");

    if (!isTxt && !isCsv) {
      toast.error('Formato inválido! Por favor, faça upload de arquivos TXT ou CSV.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      setFileContent(text);
      parseFileContent(text);
    };
    reader.readAsText(file);
  };

  const parseFileContent = (text: string) => {
    const lines = text.split(/\r?\n/);
    const parsed: ParsedContact[] = [];

    lines.forEach(line => {
      if (!line.trim()) return;

      // Suporta separação por vírgula, ponto e vírgula ou tab
      let parts = line.split(/[;,]/);
      if (parts.length < 2) {
        // Tenta separar por espaço se for um nome e telefone juntos
        const match = line.trim().match(/(.+)\s+(\d+)$/);
        if (match) {
          parts = [match[1], match[2]];
        } else {
          parts = [line, ''];
        }
      }

      const foneRaw = parts[0]?.trim() || '';
      const nomeRaw = parts[1]?.trim() || '';

      if (!nomeRaw && !foneRaw) return;

      // Sanitizar telefone: remove tudo exceto números
      let cleanFone = foneRaw.replace(/\D/g, '');

      let status: 'ok' | 'corrigido' | 'erro' = 'ok';
      let obs = 'Número válido';

      if (!cleanFone) {
        status = 'erro';
        obs = 'Número ausente ou inválido';
      } else {
        // Auto-correção padrão do Brasil (inserir ddd e prefixo 55 se necessário)
        if (cleanFone.length === 8 || cleanFone.length === 9) {
          status = 'corrigido';
          obs = 'DDD ausente (Dica: Use com DDD)';
        } else if (cleanFone.length === 10 || cleanFone.length === 11) {
          // Ex: 75999999999 -> adiciona 55 no início
          cleanFone = '55' + cleanFone;
          status = 'corrigido';
          obs = 'Prependido código do país +55';
        } else if (cleanFone.startsWith('0')) {
          cleanFone = cleanFone.substring(1);
          if (cleanFone.length === 10 || cleanFone.length === 11) {
            cleanFone = '55' + cleanFone;
          }
          status = 'corrigido';
          obs = 'Removido zero à esquerda e prependido +55';
        } else if (cleanFone.length === 12 || cleanFone.length === 13) {
          if (!cleanFone.startsWith('55')) {
            status = 'erro';
            obs = 'Código do país não suportado (exclusivo Brasil)';
          }
        } else {
          status = 'erro';
          obs = 'Formato incorreto de caracteres';
        }
      }

      parsed.push({
        nome: nomeRaw || 'Contato Sem Nome',
        telefoneOriginal: foneRaw,
        telefoneSanitizado: cleanFone,
        status,
        obs
      });
    });

    setContacts(parsed);
    toast.success(`${parsed.length} contatos lidos!`);
  };

  const handleConfirmImport = async () => {
    const validContacts = contacts.filter(c => c.status !== 'erro');

    if (validContacts.length === 0) {
      toast.error('Nenhum contato válido disponível para importação.');
      return;
    }

    if (!batchName.trim()) {
      toast.error('Por favor, informe um nome para o lote.');
      return;
    }

    try {
      setIsProcessing(true);

      // 1. Inserir lote
      const { data: batch, error: batchError } = await supabase
        .from('collection_batches')
        .insert([{
          store_id: storeId,
          nome: batchName.trim(),
          status: 'pendente',
          total_contatos: validContacts.length,
          total_enviados: 0,
          total_entregues: 0,
          total_lidos: 0,
          total_falhas: 0,
          created_by: user.id
        }])
        .select()
        .single();

      if (batchError) throw batchError;

      // 2. Inserir contatos do lote em bulk
      const contactsToInsert = validContacts.map(c => ({
        batch_id: batch.id,
        nome: c.nome,
        telefone: c.telefoneSanitizado,
        telefone_original: c.telefoneOriginal,
        status_validacao: c.status,
        status_envio: 'pendente'
      }));

      const { error: contactsError } = await supabase
        .from('collection_contacts')
        .insert(contactsToInsert);

      if (contactsError) throw contactsError;

      toast.success('Lote de cobrança criado com sucesso!');
      onTabChange('cobranca_historico');
    } catch (err) {
      console.error('Erro ao salvar lote no banco:', err);
      toast.error('Erro ao salvar lote de cobrança.');
    } finally {
      setIsProcessing(false);
    }
  };

  const totalOk = contacts.filter(c => c.status === 'ok').length;
  const totalCorrected = contacts.filter(c => c.status === 'corrigido').length;
  const totalError = contacts.filter(c => c.status === 'erro').length;

  return (
    <div className="space-y-6">
      {/* EXPLAINER TOP PANEL */}
      <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200/60 dark:border-slate-700/50 shadow-sm">
        <h3 className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Importar Lista de Clientes</h3>
        <p className="text-xs text-slate-500 mt-1">Carregue um arquivo para gerar o lote de disparo. A unidade receptora do lote será associada de forma segura.</p>

        {/* GUIDE CONTAINER */}
        <div className="mt-4 p-4 bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/30 rounded-xl flex items-start gap-3">
          <FileText size={18} className="text-blue-500 shrink-0 mt-0.5" />
          <div className="text-xs text-slate-600 dark:text-slate-400 space-y-1">
            <span className="font-bold text-slate-800 dark:text-slate-200">Requisito de Formato:</span>
            <p>Arquivo contendo uma linha por contato, separando nome e número com vírgula ou ponto-e-vírgula. Exemplo:</p>
            <p className="font-mono bg-slate-100 dark:bg-slate-900/80 p-1 rounded inline-block text-[10px]">Maria Conceição, 75991234567</p>
          </div>
        </div>
      </div>

      {contacts.length === 0 ? (
        /* DRAG AND DROP ZONE */
        <div
          onDragEnter={handleDrag}
          onDragOver={handleDrag}
          onDragLeave={handleDrag}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-3xl p-16 text-center cursor-pointer transition-all duration-300 ${
            dragActive
              ? 'border-blue-500 bg-blue-50/20 dark:bg-blue-950/10'
              : 'border-slate-300 dark:border-slate-700 hover:border-slate-400 bg-white dark:bg-slate-800/50'
          }`}
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileInput}
            accept=".txt,.csv"
            className="hidden"
          />
          <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-inner">
            <Upload size={32} />
          </div>
          <h3 className="text-sm font-black text-slate-800 dark:text-slate-200 uppercase">Arraste seu arquivo aqui</h3>
          <p className="text-xs text-slate-500 mt-1">Ou clique para navegar do computador (TXT ou CSV)</p>
        </div>
      ) : (
        /* VALIDATION & PREVIEW ZONE */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* CONTROL BOX */}
          <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200/60 dark:border-slate-700/50 shadow-sm h-fit space-y-6">
            <div>
              <h3 className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3">Definições do Lote</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Nome de Identificação</label>
                  <input
                    type="text"
                    required
                    value={batchName}
                    onChange={(e) => setBatchName(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-sm font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* RESULTS STATISTICS */}
            <div className="border-t border-slate-100 dark:border-slate-700/50 pt-4">
              <h4 className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3">Resultado da Validação</h4>
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-bold text-slate-600 dark:text-slate-400">
                  <span className="flex items-center gap-2"><CheckCircle2 size={14} className="text-emerald-500" /> Prontos para Envio</span>
                  <span>{totalOk}</span>
                </div>
                <div className="flex justify-between text-xs font-bold text-slate-600 dark:text-slate-400">
                  <span className="flex items-center gap-2"><Sparkles size={14} className="text-blue-500" /> Auto-corrigidos</span>
                  <span>{totalCorrected}</span>
                </div>
                <div className="flex justify-between text-xs font-bold text-slate-600 dark:text-slate-400">
                  <span className="flex items-center gap-2"><AlertTriangle size={14} className="text-red-500" /> Formato Inválido</span>
                  <span>{totalError}</span>
                </div>
              </div>
            </div>

            {/* CONFIRM BUTTON */}
            <div className="flex gap-3">
              <button
                onClick={() => setContacts([])}
                className="flex-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-100 font-bold py-2.5 rounded-xl text-xs uppercase tracking-wider transition-all"
              >
                Limpar
              </button>
              <button
                onClick={handleConfirmImport}
                disabled={isProcessing}
                className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-400 text-white font-bold py-2.5 rounded-xl text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-sm"
              >
                {isProcessing ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <>
                    <Check size={16} />
                    <span>Confirmar</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* SCROLLABLE TABLE PREVIEW */}
          <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200/60 dark:border-slate-700/50 shadow-sm lg:col-span-2 flex flex-col h-[400px]">
            <h3 className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-4">Pré-visualização da Importação</h3>
            <div className="flex-1 overflow-y-auto no-scrollbar border border-slate-100 dark:border-slate-700 rounded-xl">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50 dark:bg-slate-900 text-[10px] font-black text-slate-400 uppercase tracking-wider sticky top-0 z-10">
                  <tr>
                    <th className="p-3 pl-4">Status</th>
                    <th className="p-3">Nome</th>
                    <th className="p-3">Num. Original</th>
                    <th className="p-3">Num. Sanitizado</th>
                    <th className="p-3 pr-4">Observação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50 text-xs font-bold text-slate-600 dark:text-slate-300">
                  {contacts.map((contact, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="p-3 pl-4">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] uppercase tracking-wider font-black ${
                          contact.status === 'ok' ? 'bg-emerald-100/50 text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-400' :
                          contact.status === 'corrigido' ? 'bg-blue-100/50 text-blue-600 dark:bg-blue-950/20 dark:text-blue-400' :
                          'bg-red-100/50 text-red-600 dark:bg-red-950/20 dark:text-red-400'
                        }`}>
                          {contact.status === 'ok' ? 'Válido' : contact.status === 'corrigido' ? 'Corrigido' : 'Erro'}
                        </span>
                      </td>
                      <td className="p-3 max-w-[120px] truncate">{contact.nome}</td>
                      <td className="p-3 font-mono text-[10px]">{contact.telefoneOriginal || '—'}</td>
                      <td className="p-3 font-mono text-[10px] text-slate-500 dark:text-slate-400">{contact.telefoneSanitizado || '—'}</td>
                      <td className="p-3 pr-4 text-[10px] font-medium text-slate-400 truncate max-w-[150px]" title={contact.obs}>{contact.obs}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB 4: HISTÓRICO DE ENVIO + SIMULADOR REAL-TIME
// ═══════════════════════════════════════════════════════════════════════════
function CobrancaHistorico({ storeId }: { storeId: string }) {
  const [loading, setLoading] = useState(true);
  const [batches, setBatches] = useState<CollectionBatch[]>([]);

  // Batch details drawer/modal states
  const [selectedBatch, setSelectedBatch] = useState<CollectionBatch | null>(null);
  const [contacts, setContacts] = useState<CollectionContact[]>([]);
  const [contactsLoading, setContactsLoading] = useState(false);

  // Simulated dispatcher background states
  const [isSimulatingId, setIsSimulatingId] = useState<string | null>(null);

  useEffect(() => {
    loadBatches();
  }, [storeId]);

  const loadBatches = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('collection_batches')
        .select('*')
        .eq('store_id', storeId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setBatches(data || []);
    } catch (err) {
      console.error('Erro ao buscar histórico:', err);
      toast.error('Erro ao carregar lotes de cobrança');
    } finally {
      setLoading(false);
    }
  };

  const loadContacts = async (batchId: string) => {
    try {
      setContactsLoading(true);
      const { data, error } = await supabase
        .from('collection_contacts')
        .select('*')
        .eq('batch_id', batchId)
        .order('status_envio', { ascending: true });

      if (error) throw error;
      setContacts(data || []);
    } catch (err) {
      console.error('Erro ao buscar contatos do lote:', err);
      toast.error('Erro ao buscar detalhes de destinatários');
    } finally {
      setContactsLoading(false);
    }
  };

  const handleOpenDetails = (batch: CollectionBatch) => {
    setSelectedBatch(batch);
    loadContacts(batch.id);
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // SIMULADOR DE ENVIO EM TEMPO REAL (Atualiza o Supabase linha a linha)
  // ═══════════════════════════════════════════════════════════════════════════
  const runDispatchSimulation = async (batch: CollectionBatch) => {
    if (isSimulatingId) {
      toast.warning('Já existe um processo de envio em andamento.');
      return;
    }

    try {
      setIsSimulatingId(batch.id);
      toast.info('Iniciando simulador de envio para este lote!');

      // 1. Atualizar o lote para status='processando'
      await supabase
        .from('collection_batches')
        .update({ status: 'processando' })
        .eq('id', batch.id);

      // 2. Buscar contatos com envio pendente ou falhado no banco
      const { data: contactsToDispatch, error } = await supabase
        .from('collection_contacts')
        .select('*')
        .eq('batch_id', batch.id)
        .in('status_envio', ['pendente', 'falhou']);

      if (error) throw error;

      if (!contactsToDispatch || contactsToDispatch.length === 0) {
        // Se nenhum estiver pendente, simular tudo de novo para demonstrar!
        const { data: allContacts } = await supabase
          .from('collection_contacts')
          .select('*')
          .eq('batch_id', batch.id);

        if (allContacts) {
          for (const c of allContacts) {
            await supabase
              .from('collection_contacts')
              .update({ status_envio: 'pendente' })
              .eq('id', c.id);
          }
          await supabase
            .from('collection_batches')
            .update({
              status: 'processando',
              total_enviados: 0,
              total_entregues: 0,
              total_lidos: 0,
              total_falhas: 0
            })
            .eq('id', batch.id);

          // Recarregar os lotes na tela para atualizar os contadores
          loadBatches();
          toast.info('Reiniciando contadores para demonstração completa.');
        }
      }

      // Buscar os contatos ativos novamente para processar
      const { data: activeContacts } = await supabase
        .from('collection_contacts')
        .select('*')
        .eq('batch_id', batch.id)
        .eq('status_envio', 'pendente');

      if (!activeContacts) return;

      let enviados = batch.total_enviados || 0;
      let entregues = batch.total_entregues || 0;
      let lidos = batch.total_lidos || 0;
      let falhas = batch.total_falhas || 0;

      // Loop assíncrono simulando disparo com delay natural de API
      for (let i = 0; i < activeContacts.length; i++) {
        const contact = activeContacts[i];

        // 5% de chance de erro de envio simulado
        const isFailure = Math.random() < 0.05;
        let finalStatus = 'lido'; // por padrão, simula lido
        if (isFailure) {
          finalStatus = 'falhou';
        } else {
          // 20% de chance de ser apenas entregue mas não lido ainda
          if (Math.random() < 0.2) {
            finalStatus = 'entregue';
          }
        }

        // Delay dinâmico para simular API REST real
        await new Promise(resolve => setTimeout(resolve, 800));

        // Atualizar contato no banco
        await supabase
          .from('collection_contacts')
          .update({
            status_envio: finalStatus,
            error_message: isFailure ? 'Número de telefone sem WhatsApp ativo' : null
          })
          .eq('id', contact.id);

        if (isFailure) {
          falhas++;
        } else {
          enviados++;
          entregues++;
          if (finalStatus === 'lido') lidos++;
        }

        // Atualizar estatísticas agregadas do lote no Supabase
        await supabase
          .from('collection_batches')
          .update({
            total_enviados: enviados,
            total_entregues: entregues,
            total_lidos: lidos,
            total_falhas: falhas
          })
          .eq('id', batch.id);

        // Atualizar visualmente o progresso na lista de lotes principal
        setBatches(prev => prev.map(b => b.id === batch.id ? {
          ...b,
          total_enviados: enviados,
          total_entregues: entregues,
          total_lidos: lidos,
          total_falhas: falhas
        } : b));

        // Se a tela de detalhes estiver aberta para este lote, recarregar contatos do drawer
        if (selectedBatch?.id === batch.id) {
          loadContacts(batch.id);
        }
      }

      // Finalizar status do lote
      await supabase
        .from('collection_batches')
        .update({ status: 'concluido' })
        .eq('id', batch.id);

      toast.success('Envios concluídos com sucesso!');
      loadBatches();
    } catch (err) {
      console.error('Erro na simulação:', err);
      toast.error('Erro ao simular disparo de mensagens');
    } finally {
      setIsSimulatingId(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="bg-white dark:bg-slate-800 h-24 rounded-2xl border border-slate-200/50 dark:border-slate-700/50"></div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200/60 dark:border-slate-700/50 shadow-sm flex justify-between items-center">
        <div>
          <h3 className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Histórico de Disparos de Cobrança</h3>
          <p className="text-xs text-slate-500 mt-1">Monitore e simule o disparo automático das mensagens em tempo real no banco</p>
        </div>
      </div>

      {batches.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-12 text-center border border-slate-200/50 dark:border-slate-700/50 shadow-sm">
          <div className="w-16 h-16 bg-slate-100 dark:bg-slate-900/60 text-slate-400 dark:text-slate-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <History size={32} />
          </div>
          <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase">Histórico vazio</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 max-w-sm mx-auto">
            Não há lotes criados para esta unidade de negócio. Crie um lote fazendo upload na aba Importar Lote!
          </p>
        </div>
      ) : (
        /* LIST OF BATCHES */
        <div className="space-y-4">
          {batches.map((batch) => {
            const isSimulating = isSimulatingId === batch.id;
            const progressPercent = batch.total_contatos > 0
              ? Math.round(((batch.total_enviados + batch.total_falhas) / batch.total_contatos) * 100)
              : 0;

            return (
              <div
                key={batch.id}
                className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200/60 dark:border-slate-700/50 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                {/* META INFO */}
                <div className="space-y-1 md:w-1/4">
                  <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 font-mono">
                    {new Date(batch.created_at).toLocaleDateString('pt-BR')} {new Date(batch.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <h4 className="text-sm font-black text-slate-800 dark:text-white uppercase truncate">{batch.nome}</h4>
                  <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] uppercase tracking-wider font-black ${
                    batch.status === 'concluido' ? 'bg-green-100/60 text-green-600 dark:bg-green-950/20 dark:text-green-400' :
                    batch.status === 'processando' ? 'bg-blue-100/60 text-blue-600 dark:bg-blue-950/20 dark:text-blue-400 animate-pulse' :
                    'bg-slate-100 text-slate-600 dark:bg-slate-900 dark:text-slate-400'
                  }`}>
                    {batch.status === 'concluido' ? 'Concluído' : batch.status === 'processando' ? 'Enviando...' : 'Pendente'}
                  </span>
                </div>

                {/* PROGRESS COUNTER DISPLAY */}
                <div className="flex-1 space-y-2">
                  <div className="flex justify-between text-xs font-bold text-slate-500">
                    <span>Progresso dos Disparos</span>
                    <span>{batch.total_enviados + batch.total_falhas} / {batch.total_contatos} contatos ({progressPercent}%)</span>
                  </div>
                  <div className="w-full bg-slate-100 dark:bg-slate-900 h-2.5 rounded-full overflow-hidden flex">
                    <div className="bg-emerald-500 h-full transition-all duration-300" style={{ width: `${(batch.total_enviados / batch.total_contatos) * 100}%` }}></div>
                    <div className="bg-red-500 h-full transition-all duration-300" style={{ width: `${(batch.total_falhas / batch.total_contatos) * 100}%` }}></div>
                  </div>
                  {/* Detailed metrics counters row */}
                  <div className="flex gap-4 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                    <span>Enviados: <strong className="text-slate-700 dark:text-slate-200">{batch.total_enviados}</strong></span>
                    <span>Lidos: <strong className="text-emerald-500">{batch.total_lidos}</strong></span>
                    <span>Falhas: <strong className="text-red-500">{batch.total_falhas}</strong></span>
                  </div>
                </div>

                {/* ACTIONS */}
                <div className="flex items-center gap-2 md:w-1/4 justify-end">
                  <button
                    onClick={() => handleOpenDetails(batch)}
                    className="p-2.5 bg-slate-50 hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 flex items-center gap-1.5 transition-all"
                  >
                    <Eye size={14} />
                    <span>Ver</span>
                  </button>

                  <button
                    onClick={() => runDispatchSimulation(batch)}
                    disabled={isSimulating}
                    className={`p-2.5 rounded-xl text-xs font-bold uppercase tracking-wider text-white flex items-center gap-1.5 transition-all shadow-sm ${
                      isSimulating
                        ? 'bg-blue-400 cursor-not-allowed'
                        : 'bg-blue-600 hover:bg-blue-500'
                    }`}
                  >
                    {isSimulating ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      <>
                        <Play size={14} />
                        <span>Disparar</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* DETAILS MODAL DRAWER */}
      <AnimatePresence>
        {selectedBatch && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-end z-50">
            <motion.div
              initial={{ x: 100, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 100, opacity: 0 }}
              className="bg-white dark:bg-slate-800 max-w-lg w-full h-full p-6 shadow-2xl border-l border-slate-200 dark:border-slate-700 flex flex-col justify-between"
            >
              <div>
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 font-mono">Lote de Destinatários</span>
                    <h3 className="text-md font-black text-slate-900 dark:text-white uppercase mt-0.5">{selectedBatch.nome}</h3>
                  </div>
                  <button
                    onClick={() => setSelectedBatch(null)}
                    className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-xl bg-slate-100 dark:bg-slate-900"
                  >
                    ✕
                  </button>
                </div>

                {/* DETAILED STATS COUNTER BENTO */}
                <div className="grid grid-cols-4 gap-3 mb-6">
                  <div className="bg-slate-50 dark:bg-slate-900 p-3 rounded-xl border border-slate-100 dark:border-slate-700">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">Total</p>
                    <p className="text-lg font-black text-slate-900 dark:text-white mt-1 leading-none">{selectedBatch.total_contatos}</p>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-900 p-3 rounded-xl border border-slate-100 dark:border-slate-700">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">Entregue</p>
                    <p className="text-lg font-black text-slate-900 dark:text-white mt-1 leading-none">{selectedBatch.total_entregues}</p>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-900 p-3 rounded-xl border border-slate-100 dark:border-slate-700">
                    <p className="text-[9px] font-black text-emerald-500 uppercase tracking-widest leading-none">Lido</p>
                    <p className="text-lg font-black text-emerald-500 mt-1 leading-none">{selectedBatch.total_lidos}</p>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-900 p-3 rounded-xl border border-slate-100 dark:border-slate-700">
                    <p className="text-[9px] font-black text-red-500 uppercase tracking-widest leading-none">Falha</p>
                    <p className="text-lg font-black text-red-500 mt-1 leading-none">{selectedBatch.total_falhas}</p>
                  </div>
                </div>

                <div className="border border-slate-100 dark:border-slate-700 rounded-2xl overflow-hidden h-[420px] flex flex-col">
                  <div className="flex-1 overflow-y-auto no-scrollbar">
                    {contactsLoading ? (
                      <div className="flex flex-col items-center justify-center h-full gap-2">
                        <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                        <span className="text-xs text-slate-400 font-bold">Carregando contatos...</span>
                      </div>
                    ) : (
                      <table className="w-full text-left border-collapse">
                        <thead className="bg-slate-50 dark:bg-slate-900 text-[9px] font-black text-slate-400 uppercase tracking-wider sticky top-0 z-10">
                          <tr>
                            <th className="p-3 pl-4">Nome</th>
                            <th className="p-3">Telefone</th>
                            <th className="p-3 pr-4">Status Envio</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50 text-xs font-bold text-slate-600 dark:text-slate-300">
                          {contacts.map((contact) => (
                            <tr key={contact.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                              <td className="p-3 pl-4 max-w-[130px] truncate" title={contact.nome}>{contact.nome}</td>
                              <td className="p-3 font-mono text-[10px]">{contact.telefone}</td>
                              <td className="p-3 pr-4">
                                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[8px] uppercase tracking-wider font-black ${
                                  contact.status_envio === 'lido' ? 'bg-emerald-100/50 text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-400' :
                                  contact.status_envio === 'entregue' ? 'bg-blue-100/50 text-blue-600 dark:bg-blue-950/20 dark:text-blue-400' :
                                  contact.status_envio === 'falhou' ? 'bg-red-100/50 text-red-600 dark:bg-red-950/20 dark:text-red-400' :
                                  'bg-slate-100 text-slate-500 dark:bg-slate-900/60'
                                }`}>
                                  {contact.status_envio === 'lido' ? 'Lido' : contact.status_envio === 'entregue' ? 'Entregue' : contact.status_envio === 'falhou' ? 'Falhou' : 'Pendente'}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 dark:border-slate-700 flex gap-3">
                <button
                  onClick={() => setSelectedBatch(null)}
                  className="w-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-100 font-bold py-2.5 rounded-xl text-xs uppercase tracking-wider transition-all"
                >
                  Fechar Painel
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB 5: TEMPLATE DE MENSAGEM (EDITOR COM PREVIEW WHATSAPP)
// ═══════════════════════════════════════════════════════════════════════════
function CobrancaTemplate({ storeId }: { storeId: string }) {
  const [template, setTemplate] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Carregar do LocalStorage do navegador ao montar
  useEffect(() => {
    const saved = localStorage.getItem(`cobranca_template_${storeId}`);
    if (saved) {
      setTemplate(saved);
    } else {
      // Template padrão de vendas/faturamento
      setTemplate('Olá, {{nome}}!\n\nIdentificamos uma pendência em aberto na Real Calçados referente à sua última compra.\n\nEvite restrições no seu cadastro. Acesse sua fatura e regularize de forma rápida e segura através do link:\n{{link}}\n\nQualquer dúvida, estamos à disposição!\nEquipe Real Calçados');
    }
  }, [storeId]);

  const handleSave = () => {
    try {
      setIsSaving(true);
      localStorage.setItem(`cobranca_template_${storeId}`, template);
      toast.success('Template de mensagem salvo com sucesso!');
    } catch (err) {
      toast.error('Erro ao salvar template');
    } finally {
      setIsSaving(false);
    }
  };

  const insertVariable = (variable: string) => {
    setTemplate(prev => prev + ` {{${variable}}}`);
  };

  // Processar texto para a pré-visualização realista do WhatsApp
  const renderMockMessage = () => {
    if (!template) return 'Digite seu template para visualizar...';

    return template
      .replace(/{{nome}}/g, 'Maria Oliveira')
      .replace(/{{valor}}/g, 'R$ 180,00')
      .replace(/{{link}}/g, 'realcalcados.co/fat/maria-oliveira')
      .split('\n')
      .map((str, i) => <p key={i} className="min-h-[1em]">{str}</p>);
  };

  const getWhatsAppTime = () => {
    const today = new Date();
    return today.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      {/* EDITOR PANE */}
      <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200/60 dark:border-slate-700/50 shadow-sm space-y-6">
        <div>
          <h3 className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Editor de Mensagem</h3>
          <p className="text-xs text-slate-500 mt-1">Configure o texto automático que os contatos deste lote irão receber</p>
        </div>

        {/* HELPER INSERT VARIABLES ROW */}
        <div className="space-y-2">
          <span className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Inserir Variáveis</span>
          <div className="flex flex-wrap gap-2">
            {[
              { id: 'nome', label: 'Nome Cliente' },
              { id: 'valor', label: 'Valor Devido' },
              { id: 'link', label: 'Link Fatura' }
            ].map(v => (
              <button
                key={v.id}
                type="button"
                onClick={() => insertVariable(v.id)}
                className="bg-slate-50 hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-850 border border-slate-200 dark:border-slate-700 py-1.5 px-3 rounded-lg text-xs font-bold text-slate-600 dark:text-slate-300 transition-all flex items-center gap-1"
              >
                <Plus size={12} />
                <span>{v.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Corpo da Mensagem</label>
          <textarea
            value={template}
            onChange={(e) => setTemplate(e.target.value)}
            rows={10}
            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 text-sm font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 leading-relaxed placeholder:text-slate-400"
            placeholder="Olá, {{nome}}..."
          ></textarea>
        </div>

        <button
          onClick={handleSave}
          disabled={isSaving}
          className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-sm"
        >
          {isSaving ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
          ) : (
            <>
              <Check size={16} />
              <span>Salvar Alterações</span>
            </>
          )}
        </button>
      </div>

      {/* WHATSAPP HIGH-FIDELITY PREVIEW PANE */}
      <div className="flex flex-col items-center justify-center">
        <span className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-3 self-start lg:ml-8">Visualização em Tempo Real (WhatsApp)</span>
        {/* MOCKPHONE CONTAINER */}
        <div className="w-[320px] h-[540px] bg-[#E5DDD5] dark:bg-slate-950 rounded-[38px] shadow-2xl border-[8px] border-slate-900 dark:border-slate-800 overflow-hidden flex flex-col relative">
          {/* CAMERA NOTCH */}
          <div className="absolute top-2 left-1/2 -translate-x-1/2 w-28 h-4 bg-slate-900 dark:bg-slate-800 rounded-full z-20"></div>

          {/* CHAT HEADER MOCK */}
          <div className="bg-[#075E54] dark:bg-emerald-950 text-white px-4 py-3 pt-6 flex items-center gap-2 z-10">
            <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-850 flex items-center justify-center text-[#075E54] dark:text-emerald-400 font-black text-xs">
              RC
            </div>
            <div>
              <p className="text-xs font-black leading-none uppercase">Real Calçados Cobrança</p>
              <p className="text-[9px] text-emerald-200 font-bold mt-0.5 leading-none">Online</p>
            </div>
          </div>

          {/* CHAT BODY MOCK */}
          <div className="flex-1 p-4 overflow-y-auto no-scrollbar bg-[url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')] bg-repeat bg-center bg-opacity-10 dark:bg-none relative flex flex-col justify-end">
            {/* WHATSAPP BUBBLE */}
            <div className="bg-white dark:bg-slate-800 max-w-[85%] rounded-2xl rounded-tl-none p-3 shadow-md border-l-4 border-emerald-500 relative self-start flex flex-col gap-1 text-[11px] font-bold text-slate-800 dark:text-slate-100 leading-normal">
              <div className="space-y-1">
                {renderMockMessage()}
              </div>
              <span className="text-[8px] text-slate-400 dark:text-slate-500 font-mono font-bold uppercase self-end mt-1.5">{getWhatsAppTime()}</span>
            </div>
          </div>

          {/* CHAT INPUT BAR MOCK */}
          <div className="bg-slate-100 dark:bg-slate-900/80 px-3 py-2 flex items-center gap-2 border-t border-slate-200/50 dark:border-slate-800">
            <div className="flex-1 bg-white dark:bg-slate-850 h-8 rounded-full px-3 flex items-center text-slate-400 dark:text-slate-500 font-semibold text-[10px]">
              Mensagem...
            </div>
            <div className="w-8 h-8 bg-[#075E54] dark:bg-emerald-800 rounded-full flex items-center justify-center text-white">
              <Send size={12} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB 6: OPTOUT / NÃO PERTURBE
// ═══════════════════════════════════════════════════════════════════════════
function CobrancaOptOut({ storeId }: { storeId: string }) {
  const [loading, setLoading] = useState(true);
  const [list, setList] = useState<OptOutContact[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Form states
  const [telefone, setTelefone] = useState('');
  const [nome, setNome] = useState('');
  const [motivo, setMotivo] = useState('');

  useEffect(() => {
    loadOptOut();
  }, [storeId]);

  const loadOptOut = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('whatsapp_opt_out')
        .select('*')
        .eq('store_id', storeId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setList(data || []);
    } catch (err) {
      console.error('Erro ao buscar lista optout:', err);
      toast.error('Erro ao carregar lista de restrição de disparos');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!telefone) {
      toast.error('O número de telefone é obrigatório.');
      return;
    }

    try {
      // Limpar telefone
      const cleanTelefone = telefone.replace(/\D/g, '');

      const { error } = await supabase
        .from('whatsapp_opt_out')
        .insert([{
          telefone: cleanTelefone,
          nome: nome.trim() || 'Desconhecido',
          store_id: storeId,
          motivo: motivo.trim() || 'Cliente solicitou não perturbe'
        }]);

      if (error) throw error;

      toast.success('Número adicionado ao Não Perturbe!');
      setTelefone('');
      setNome('');
      setMotivo('');
      setIsOpen(false);
      loadOptOut();
    } catch (err) {
      console.error('Erro ao adicionar optout:', err);
      toast.error('Erro ao adicionar contato à restrição');
    }
  };

  const handleDelete = async (tel: string) => {
    if (!confirm('Deseja realmente retirar este número do Não Perturbe? Ele voltará a receber notificações.')) return;

    try {
      const { error } = await supabase
        .from('whatsapp_opt_out')
        .delete()
        .eq('telefone', tel);

      if (error) throw error;

      toast.success('Número removido do bloqueio!');
      loadOptOut();
    } catch (err) {
      console.error('Erro ao remover optout:', err);
      toast.error('Erro ao liberar contato');
    }
  };

  const filteredList = list.filter(item => {
    const s = searchTerm.toLowerCase();
    return item.nome.toLowerCase().includes(s) || item.telefone.includes(s) || item.motivo.toLowerCase().includes(s);
  });

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="bg-white dark:bg-slate-800 h-16 rounded-2xl border border-slate-200/50 dark:border-slate-700/50"></div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* FILTER & TOPBAR */}
      <div className="flex flex-col md:flex-row gap-4 justify-between bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200/60 dark:border-slate-700/50 shadow-sm">
        {/* SEARCH INPUT */}
        <div className="relative flex-1 max-w-md">
          <input
            type="text"
            placeholder="Pesquisar por nome, telefone ou motivo..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl py-2 px-10 text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-slate-400"
          />
          <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
        </div>

        <button
          onClick={() => setIsOpen(true)}
          className="bg-red-600 hover:bg-red-500 text-white font-bold py-2 px-4 rounded-xl text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-sm transition-all"
        >
          <Plus size={16} />
          <span>Bloquear Número</span>
        </button>
      </div>

      {filteredList.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-12 text-center border border-slate-200/50 dark:border-slate-700/50 shadow-sm">
          <div className="w-16 h-16 bg-slate-100 dark:bg-slate-900/60 text-slate-400 dark:text-slate-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <Ban size={32} />
          </div>
          <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase">Lista de restrição vazia</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 max-w-sm mx-auto">
            Não há contatos cadastrados no Não Perturbe para esta unidade. Caso algum cliente solicite, adicione-o clicando no botão acima!
          </p>
        </div>
      ) : (
        /* TABLE OF BLOCKED NUMBERS */
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/60 dark:border-slate-700/50 shadow-sm overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 dark:bg-slate-900 text-[10px] font-black text-slate-400 uppercase tracking-wider">
              <tr>
                <th className="p-4 pl-6">Cliente</th>
                <th className="p-4">Telefone</th>
                <th className="p-4">Motivo de Bloqueio</th>
                <th className="p-4">Data Registro</th>
                <th className="p-4 pr-6 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50 text-xs font-bold text-slate-600 dark:text-slate-300">
              {filteredList.map((item) => (
                <tr key={item.telefone} className="hover:bg-slate-50 dark:hover:bg-slate-850/40">
                  <td className="p-4 pl-6">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 bg-red-100 dark:bg-red-950/20 text-red-500 dark:text-red-400 rounded-full flex items-center justify-center text-[10px] font-black uppercase">
                        {item.nome.charAt(0)}
                      </div>
                      <span className="uppercase">{item.nome}</span>
                    </div>
                  </td>
                  <td className="p-4 font-mono">{item.telefone}</td>
                  <td className="p-4 text-slate-400 dark:text-slate-500 text-[11px] font-medium max-w-[200px] truncate" title={item.motivo}>
                    {item.motivo}
                  </td>
                  <td className="p-4 font-mono text-[10px] text-slate-400 dark:text-slate-500">
                    {new Date(item.created_at).toLocaleDateString('pt-BR')}
                  </td>
                  <td className="p-4 pr-6 text-right">
                    <button
                      onClick={() => handleDelete(item.telefone)}
                      className="p-1.5 bg-slate-50 hover:bg-red-50 dark:bg-slate-900 dark:hover:bg-red-950/20 text-slate-400 hover:text-red-500 rounded-xl transition-all border border-slate-200 dark:border-slate-750"
                      title="Desbloquear Cliente"
                    >
                      Desbloquear
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* CREATE BLOCK DIALOG */}
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-slate-800 max-w-md w-full p-6 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700"
            >
              <h3 className="text-md font-black text-slate-900 dark:text-white uppercase mb-4">Adicionar ao Não Perturbe</h3>
              <form onSubmit={handleCreate} className="space-y-4">
                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Telefone do Cliente</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: 75999999999"
                    value={telefone}
                    onChange={(e) => setTelefone(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-sm font-bold text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Nome do Cliente</label>
                  <input
                    type="text"
                    placeholder="Ex: João Silva"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-sm font-bold text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Motivo do Bloqueio</label>
                  <textarea
                    placeholder="Descreva o motivo..."
                    value={motivo}
                    onChange={(e) => setMotivo(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-sm font-bold text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 h-20"
                  ></textarea>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="flex-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-100 font-bold py-2.5 rounded-xl text-xs uppercase tracking-wider transition-all"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="flex-1 bg-red-600 hover:bg-red-500 text-white font-bold py-2.5 rounded-xl text-xs uppercase tracking-wider transition-all"
                  >
                    Bloquear
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
