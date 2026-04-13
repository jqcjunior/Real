import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { ensureSession } from '../services/authService';
import { 
  Plus, 
  Search, 
  Edit3, 
  Trash2, 
  Users, 
  Store as StoreIcon, 
  Globe, 
  Eye, 
  ChevronRight, 
  CheckCircle2, 
  XCircle, 
  MoreVertical,
  BarChart3,
  Send,
  UserCheck,
  Building2,
  Settings2,
  Save,
  X,
  PlusCircle,
  GripVertical,
  Trash,
  ShieldAlert
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Survey, 
  SurveyQuestion, 
  SurveyTargetType, 
  SurveyTargetCategory, 
  SurveyResultVisibility,
  Store,
  AdminUser,
  User
} from '../types';

interface AdminSurveyManagementProps {
  currentUser: User;
  stores: Store[];
}

const AdminSurveyManagement: React.FC<AdminSurveyManagementProps> = ({ currentUser, stores }) => {
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSurvey, setEditingSurvey] = useState<Survey | null>(null);
  const [allUsers, setAllUsers] = useState<any[]>([]);

  // Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [targetType, setTargetType] = useState<SurveyTargetType>('internal');
  const [targetCategory, setTargetCategory] = useState<SurveyTargetCategory>('all_managers');
  const [targetStoreIds, setTargetStoreIds] = useState<string[]>([]);
  const [targetUserIds, setTargetUserIds] = useState<string[]>([]);
  const [resultsVisibleTo, setResultsVisibleTo] = useState<SurveyResultVisibility[]>(['admin']);
  const [isActive, setIsActive] = useState(true);
  const [questions, setQuestions] = useState<Partial<SurveyQuestion>[]>([]);

  useEffect(() => {
    fetchSurveys();
    fetchAllUsers();
  }, []);

  const fetchSurveys = async () => {
    setIsLoading(true);
    try {
      await ensureSession();
      const { data, error } = await supabase
        .from('surveys')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) {
        console.error('Erro ao buscar pesquisas (Supabase):', error);
        throw error;
      }
      setSurveys(data || []);
    } catch (err: any) {
      console.error('Erro ao buscar pesquisas:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchAllUsers = async () => {
    try {
      await ensureSession();
      const { data, error } = await supabase
        .from('admin_users')
        .select('id, name, role_level, email, status, store_id, created_at')
        .eq('status', 'active');
      if (error) throw error;
      setAllUsers(data || []);
    } catch (err) {
      console.error('Erro ao buscar usuários:', err);
    }
  };

  const handleOpenModal = (survey?: Survey) => {
    if (survey) {
      setEditingSurvey(survey);
      setTitle(survey.title);
      setDescription(survey.description || '');
      setTargetType(survey.target_type);
      setTargetCategory(survey.target_category || 'all_managers');
      setTargetStoreIds(survey.target_store_ids || []);
      setTargetUserIds(survey.target_user_ids || []);
      setResultsVisibleTo(survey.results_visible_to);
      setIsActive(survey.is_active);
      fetchQuestions(survey.id);
    } else {
      setEditingSurvey(null);
      setTitle('');
      setDescription('');
      setTargetType('internal');
      setTargetCategory('all_managers');
      setTargetStoreIds([]);
      setTargetUserIds([]);
      setResultsVisibleTo(['admin']);
      setIsActive(true);
      setQuestions([{ question_text: '', question_type: 'text', is_required: true, sort_order: 0, options: [] }]);
    }
    setIsModalOpen(true);
  };

  const fetchQuestions = async (surveyId: string) => {
    try {
      const { data, error } = await supabase
        .from('survey_questions')
        .select('*')
        .eq('survey_id', surveyId)
        .order('sort_order', { ascending: true });
      if (error) throw error;
      setQuestions(data || []);
    } catch (err) {
      console.error('Erro ao buscar perguntas:', err);
    }
  };

  const handleAddQuestion = () => {
    setQuestions([...questions, { 
      question_text: '', 
      question_type: 'text', 
      is_required: true, 
      sort_order: questions.length,
      options: []
    }]);
  };

  const handleRemoveQuestion = (index: number) => {
    const newQuestions = [...questions];
    newQuestions.splice(index, 1);
    setQuestions(newQuestions);
  };

  const handleQuestionChange = (index: number, field: keyof SurveyQuestion, value: any) => {
    const newQuestions = [...questions];
    newQuestions[index] = { ...newQuestions[index], [field]: value };
    setQuestions(newQuestions);
  };

  const handleSave = async () => {
    if (!title) return alert('Título é obrigatório');
    if (questions.length === 0) return alert('Adicione pelo menos uma pergunta');

    try {
      await ensureSession();
      const surveyData = {
        title,
        description,
        target_type: targetType,
        target_category: targetType === 'internal' ? targetCategory : null,
        target_store_ids: targetStoreIds.length > 0 ? targetStoreIds : null,
        target_user_ids: targetUserIds.length > 0 ? targetUserIds : null,
        results_visible_to: resultsVisibleTo,
        is_active: isActive,
        created_by: currentUser.id
      };

      let surveyId = editingSurvey?.id;

      if (editingSurvey) {
        const { error } = await supabase
          .from('surveys')
          .update(surveyData)
          .eq('id', editingSurvey.id);
        if (error) {
          console.error('Erro ao atualizar pesquisa:', error);
          throw error;
        }
      } else {
        const { data, error } = await supabase
          .from('surveys')
          .insert([surveyData])
          .select()
          .single();
        if (error) {
          console.error('Erro ao inserir pesquisa:', error);
          throw error;
        }
        surveyId = data.id;
      }

      // Save Questions
      // For simplicity, we delete and re-insert questions on edit
      if (editingSurvey) {
        const { error: delError } = await supabase.from('survey_questions').delete().eq('survey_id', surveyId);
        if (delError) console.warn('Erro ao deletar perguntas antigas:', delError);
      }

      const questionsToInsert = questions.map((q, idx) => ({
        survey_id: surveyId,
        question_text: q.question_text,
        question_type: q.question_type,
        options: q.options || [],
        is_required: q.is_required,
        sort_order: idx
      }));

      const { error: qError } = await supabase.from('survey_questions').insert(questionsToInsert);
      if (qError) {
        console.error('Erro ao inserir perguntas:', qError);
        throw qError;
      }

      alert('Pesquisa salva com sucesso!');
      setIsModalOpen(false);
      fetchSurveys();
    } catch (err: any) {
      console.error('Erro completo no handleSave:', err);
      alert('Erro ao salvar pesquisa: ' + (err.message || 'Erro desconhecido'));
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta pesquisa?')) return;
    try {
      await ensureSession();
      const { error } = await supabase.from('surveys').delete().eq('id', id);
      if (error) throw error;
      fetchSurveys();
    } catch (err: any) {
      alert('Erro ao excluir: ' + err.message);
    }
  };

  const filteredSurveys = surveys.filter(s => 
    s.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-4 md:p-8 space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black italic uppercase tracking-tighter text-slate-900 dark:text-white leading-none">
            Gestão de Pesquisas
          </h2>
          <p className="text-slate-500 dark:text-slate-400 font-bold uppercase text-[10px] tracking-widest mt-2">
            Crie e gerencie pesquisas direcionadas para funcionários e clientes
          </p>
        </div>
        <button 
          onClick={() => handleOpenModal()}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-2xl font-black uppercase text-xs tracking-widest shadow-lg shadow-blue-200 dark:shadow-blue-900/20 transition-all active:scale-95 flex items-center justify-center gap-2"
        >
          <Plus size={18} /> Nova Pesquisa
        </button>
      </div>

      {/* Stats/Filters */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 p-6 rounded-[32px] border border-slate-100 dark:border-slate-800 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-2xl text-blue-600">
              <PlusCircle size={24} />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Total</p>
              <h3 className="text-2xl font-black text-slate-900 dark:text-white">{surveys.length}</h3>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 p-6 rounded-[32px] border border-slate-100 dark:border-slate-800 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-2xl text-green-600">
              <CheckCircle2 size={24} />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Ativas</p>
              <h3 className="text-2xl font-black text-slate-900 dark:text-white">{surveys.filter(s => s.is_active).length}</h3>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 p-6 rounded-[32px] border border-slate-100 dark:border-slate-800 shadow-sm md:col-span-2">
          <div className="relative h-full flex items-center">
            <Search className="absolute left-4 text-slate-400" size={20} />
            <input 
              type="text" 
              placeholder="PESQUISAR PESQUISAS..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-6 py-3 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl text-xs font-black uppercase tracking-widest text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 transition-all"
            />
          </div>
        </div>
      </div>

      {/* Surveys List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <AnimatePresence mode="popLayout">
          {isLoading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-white dark:bg-slate-900 h-64 rounded-[40px] animate-pulse border border-slate-100 dark:border-slate-800" />
            ))
          ) : filteredSurveys.length === 0 ? (
            <div className="col-span-full py-20 text-center">
              <div className="bg-slate-100 dark:bg-slate-800 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Search size={32} className="text-slate-400" />
              </div>
              <h3 className="text-lg font-black uppercase text-slate-900 dark:text-white tracking-widest">Nenhuma pesquisa encontrada</h3>
              <p className="text-slate-500 text-xs font-bold uppercase mt-2">Tente mudar os filtros ou crie uma nova pesquisa</p>
            </div>
          ) : filteredSurveys.map(survey => (
            <motion.div
              key={survey.id}
              layout
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white dark:bg-slate-900 rounded-[40px] border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-xl hover:shadow-blue-500/5 transition-all group overflow-hidden flex flex-col"
            >
              <div className="p-8 flex-1">
                <div className="flex justify-between items-start mb-6">
                  <div className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest border ${
                    survey.target_type === 'internal' 
                      ? 'bg-blue-50 text-blue-600 border-blue-100 dark:bg-blue-900/20 dark:border-blue-800' 
                      : 'bg-purple-50 text-purple-600 border-purple-100 dark:bg-purple-900/20 dark:border-purple-800'
                  }`}>
                    {survey.target_type === 'internal' ? 'Interna' : 'Externa'}
                  </div>
                  <div className={`w-3 h-3 rounded-full ${survey.is_active ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]' : 'bg-slate-300'}`} />
                </div>

                <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase italic tracking-tighter leading-tight mb-2 group-hover:text-blue-600 transition-colors">
                  {survey.title}
                </h3>
                <p className="text-slate-500 dark:text-slate-400 text-[10px] font-bold uppercase line-clamp-2 mb-6">
                  {survey.description || 'Sem descrição'}
                </p>

                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-slate-400">
                    <Users size={14} />
                    <span className="text-[9px] font-black uppercase tracking-widest">
                      {survey.target_category === 'all_managers' && 'Todos os Gerentes'}
                      {survey.target_category === 'all_cashiers' && 'Todos os Caixas'}
                      {survey.target_category === 'all_sellers' && 'Todos os Vendedores'}
                      {survey.target_category === 'all_ice_cream' && 'Toda a Gelateria'}
                      {survey.target_category === 'specific_stores' && 'Lojas Específicas'}
                      {survey.target_category === 'specific_users' && 'Usuários Específicos'}
                      {survey.target_type === 'external' && 'Clientes das Lojas'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-400">
                    <StoreIcon size={14} />
                    <span className="text-[9px] font-black uppercase tracking-widest">
                      {survey.target_store_ids && survey.target_store_ids.length > 0 
                        ? `${survey.target_store_ids.length} Lojas Selecionadas` 
                        : 'Todas as Lojas'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="p-6 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                <div className="flex gap-2">
                  <button 
                    onClick={() => handleOpenModal(survey)}
                    className="p-3 bg-white dark:bg-slate-800 text-blue-600 rounded-2xl border border-slate-100 dark:border-slate-700 hover:bg-blue-600 hover:text-white transition-all shadow-sm"
                  >
                    <Edit3 size={18} />
                  </button>
                  <button 
                    onClick={() => handleDelete(survey.id)}
                    className="p-3 bg-white dark:bg-slate-800 text-red-500 rounded-2xl border border-slate-100 dark:border-slate-700 hover:bg-red-500 hover:text-white transition-all shadow-sm"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
                <button className="flex-1 bg-slate-900 dark:bg-white text-white dark:text-slate-900 py-3 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-blue-600 dark:hover:bg-blue-600 hover:text-white transition-all flex items-center justify-center gap-2">
                  <BarChart3 size={16} /> Resultados
                </button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Modal Pesquisa */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 md:p-8">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-5xl bg-white dark:bg-slate-900 rounded-[48px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/50">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-blue-600 text-white rounded-2xl shadow-lg shadow-blue-200 dark:shadow-blue-900/20">
                    <Settings2 size={24} />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-slate-900 dark:text-white uppercase italic tracking-tighter leading-none">
                      {editingSurvey ? 'Editar Pesquisa' : 'Nova Pesquisa'}
                    </h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                      Configure o direcionamento e as perguntas
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="p-3 text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white dark:hover:bg-slate-800 rounded-2xl transition-all"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-8 no-scrollbar">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                  {/* Left Column: Config */}
                  <div className="space-y-8">
                    <section className="space-y-4">
                      <h4 className="text-xs font-black uppercase text-blue-600 tracking-widest flex items-center gap-2">
                        <ChevronRight size={14} /> Informações Básicas
                      </h4>
                      <div className="space-y-4">
                        <div>
                          <label className="block text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2 ml-1">Título da Pesquisa</label>
                          <input 
                            type="text" 
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="EX: PESQUISA DE CLIMA ORGANIZACIONAL"
                            className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl text-xs font-black uppercase tracking-widest text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2 ml-1">Descrição (Opcional)</label>
                          <textarea 
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="DESCREVA O OBJETIVO DESTA PESQUISA..."
                            rows={3}
                            className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl text-xs font-black uppercase tracking-widest text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 transition-all resize-none"
                          />
                        </div>
                      </div>
                    </section>

                    <section className="space-y-4">
                      <h4 className="text-xs font-black uppercase text-blue-600 tracking-widest flex items-center gap-2">
                        <ChevronRight size={14} /> Direcionamento (Target)
                      </h4>
                      <div className="space-y-6">
                        <div className="flex gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl">
                          <button 
                            onClick={() => setTargetType('internal')}
                            className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${targetType === 'internal' ? 'bg-white dark:bg-slate-700 text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                          >
                            Interno (Funcionários)
                          </button>
                          <button 
                            onClick={() => setTargetType('external')}
                            className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${targetType === 'external' ? 'bg-white dark:bg-slate-700 text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                          >
                            Externo (Clientes)
                          </button>
                        </div>

                        {targetType === 'internal' && (
                          <div>
                            <label className="block text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2 ml-1">Categoria de Público</label>
                            <select 
                              value={targetCategory}
                              onChange={(e) => setTargetCategory(e.target.value as SurveyTargetCategory)}
                              className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl text-xs font-black uppercase tracking-widest text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 transition-all appearance-none"
                            >
                              <option value="all_managers">Todos os Gerentes</option>
                              <option value="all_cashiers">Todos os Caixas</option>
                              <option value="all_sellers">Todos os Vendedores</option>
                              <option value="all_ice_cream">Toda a Gelateria</option>
                              <option value="specific_stores">Funcionários de Lojas Específicas</option>
                              <option value="specific_users">Usuários Específicos</option>
                            </select>
                          </div>
                        )}

                        {targetCategory !== 'specific_users' && (
                          <div>
                            <label className="block text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2 ml-1">
                              Lojas Alvo {targetType === 'internal' && targetCategory !== 'specific_stores' && '(Vazio = Todas)'}
                            </label>
                            <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto p-2 bg-slate-50 dark:bg-slate-800 rounded-2xl no-scrollbar">
                              {stores.map(store => (
                                <button
                                  key={store.id}
                                  onClick={() => {
                                    if (targetStoreIds.includes(store.id)) {
                                      setTargetStoreIds(targetStoreIds.filter(id => id !== store.id));
                                    } else {
                                      setTargetStoreIds([...targetStoreIds, store.id]);
                                    }
                                  }}
                                  className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all flex items-center justify-between ${
                                    targetStoreIds.includes(store.id)
                                      ? 'bg-blue-600 text-white border-blue-600'
                                      : 'bg-white dark:bg-slate-700 text-slate-400 border-slate-100 dark:border-slate-600'
                                  }`}
                                >
                                  LOJA {store.number} {targetStoreIds.includes(store.id) && <CheckCircle2 size={12} />}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {targetCategory === 'specific_users' && (
                          <div>
                            <label className="block text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2 ml-1">Selecionar Usuários</label>
                            <div className="space-y-2 max-h-40 overflow-y-auto p-2 bg-slate-50 dark:bg-slate-800 rounded-2xl no-scrollbar">
                              {allUsers.map(user => (
                                <button
                                  key={user.id}
                                  onClick={() => {
                                    if (targetUserIds.includes(user.id)) {
                                      setTargetUserIds(targetUserIds.filter(id => id !== user.id));
                                    } else {
                                      setTargetUserIds([...targetUserIds, user.id]);
                                    }
                                  }}
                                  className={`w-full px-4 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all flex items-center justify-between ${
                                    targetUserIds.includes(user.id)
                                      ? 'bg-blue-600 text-white border-blue-600'
                                      : 'bg-white dark:bg-slate-700 text-slate-400 border-slate-100 dark:border-slate-600'
                                  }`}
                                >
                                  <div className="flex flex-col items-start">
                                    <span>{user.name}</span>
                                    <span className="text-[7px] opacity-60">{user.role_level}</span>
                                  </div>
                                  {targetUserIds.includes(user.id) && <CheckCircle2 size={14} />}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </section>

                    <section className="space-y-4">
                      <h4 className="text-xs font-black uppercase text-blue-600 tracking-widest flex items-center gap-2">
                        <ChevronRight size={14} /> Visibilidade de Resultados
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {[
                          { id: 'admin', label: 'Administradores', icon: ShieldAlert },
                          { id: 'store_manager', label: 'Gerente da Loja', icon: UserCheck },
                          { id: 'respondent', label: 'Respondente', icon: Users }
                        ].map(item => (
                          <button
                            key={item.id}
                            disabled={item.id === 'admin'}
                            onClick={() => {
                              if (resultsVisibleTo.includes(item.id as SurveyResultVisibility)) {
                                setResultsVisibleTo(resultsVisibleTo.filter(v => v !== item.id));
                              } else {
                                setResultsVisibleTo([...resultsVisibleTo, item.id as SurveyResultVisibility]);
                              }
                            }}
                            className={`px-4 py-3 rounded-2xl text-[9px] font-black uppercase tracking-widest border transition-all flex items-center gap-2 ${
                              resultsVisibleTo.includes(item.id as SurveyResultVisibility)
                                ? 'bg-slate-900 text-white border-slate-900'
                                : 'bg-white dark:bg-slate-700 text-slate-400 border-slate-100 dark:border-slate-600'
                            } ${item.id === 'admin' ? 'opacity-50 cursor-not-allowed' : ''}`}
                          >
                            <item.icon size={14} /> {item.label}
                          </button>
                        ))}
                      </div>
                    </section>
                  </div>

                  {/* Right Column: Questions */}
                  <div className="space-y-8">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-black uppercase text-blue-600 tracking-widest flex items-center gap-2">
                        <ChevronRight size={14} /> Perguntas da Pesquisa
                      </h4>
                      <button 
                        onClick={handleAddQuestion}
                        className="text-blue-600 hover:text-blue-700 font-black uppercase text-[10px] tracking-widest flex items-center gap-1"
                      >
                        <PlusCircle size={16} /> Adicionar Pergunta
                      </button>
                    </div>

                    <div className="space-y-6">
                      {questions.map((q, idx) => (
                        <motion.div 
                          key={idx}
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-[32px] border border-slate-100 dark:border-slate-800 relative group"
                        >
                          <div className="absolute -left-3 top-1/2 -translate-y-1/2 p-2 bg-white dark:bg-slate-700 rounded-xl border border-slate-100 dark:border-slate-600 text-slate-300 group-hover:text-blue-600 cursor-grab active:cursor-grabbing">
                            <GripVertical size={16} />
                          </div>
                          
                          <button 
                            onClick={() => handleRemoveQuestion(idx)}
                            className="absolute -right-2 -top-2 p-2 bg-white dark:bg-slate-700 text-red-500 rounded-xl border border-slate-100 dark:border-slate-600 shadow-sm opacity-0 group-hover:opacity-100 transition-all"
                          >
                            <Trash size={14} />
                          </button>

                          <div className="space-y-4">
                            <div className="flex gap-4">
                              <div className="flex-1">
                                <label className="block text-[8px] font-black uppercase text-slate-400 tracking-widest mb-1 ml-1">Pergunta {idx + 1}</label>
                                <input 
                                  type="text" 
                                  value={q.question_text}
                                  onChange={(e) => handleQuestionChange(idx, 'question_text', e.target.value)}
                                  placeholder="DIGITE A PERGUNTA..."
                                  className="w-full px-4 py-3 bg-white dark:bg-slate-700 border-none rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                                />
                              </div>
                              <div className="w-40">
                                <label className="block text-[8px] font-black uppercase text-slate-400 tracking-widest mb-1 ml-1">Tipo</label>
                                <select 
                                  value={q.question_type}
                                  onChange={(e) => handleQuestionChange(idx, 'question_type', e.target.value)}
                                  className="w-full px-4 py-3 bg-white dark:bg-slate-700 border-none rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 transition-all appearance-none"
                                >
                                  <option value="text">Texto</option>
                                  <option value="rating">Avaliação (1-5)</option>
                                  <option value="multiple_choice">Múltipla Escolha</option>
                                  <option value="boolean">Sim / Não</option>
                                </select>
                              </div>
                            </div>

                            {q.question_type === 'multiple_choice' && (
                              <div>
                                <label className="block text-[8px] font-black uppercase text-slate-400 tracking-widest mb-1 ml-1">Opções (Separadas por vírgula)</label>
                                <input 
                                  type="text" 
                                  value={q.options?.join(', ')}
                                  onChange={(e) => handleQuestionChange(idx, 'options', e.target.value.split(',').map(s => s.trim()))}
                                  placeholder="OPÇÃO 1, OPÇÃO 2, OPÇÃO 3..."
                                  className="w-full px-4 py-3 bg-white dark:bg-slate-700 border-none rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                                />
                              </div>
                            )}

                            <div className="flex items-center gap-4">
                              <label className="flex items-center gap-2 cursor-pointer">
                                <input 
                                  type="checkbox" 
                                  checked={q.is_required}
                                  onChange={(e) => handleQuestionChange(idx, 'is_required', e.target.checked)}
                                  className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                />
                                <span className="text-[9px] font-black uppercase text-slate-500 tracking-widest">Obrigatória</span>
                              </label>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-8 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <div className={`w-12 h-6 rounded-full transition-all relative ${isActive ? 'bg-green-500' : 'bg-slate-300'}`}>
                      <input 
                        type="checkbox" 
                        checked={isActive}
                        onChange={(e) => setIsActive(e.target.checked)}
                        className="hidden"
                      />
                      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${isActive ? 'left-7' : 'left-1'}`} />
                    </div>
                    <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Pesquisa Ativa</span>
                  </label>
                </div>
                <div className="flex gap-4">
                  <button 
                    onClick={() => setIsModalOpen(false)}
                    className="px-8 py-4 rounded-2xl font-black uppercase text-xs tracking-widest text-slate-500 hover:text-slate-900 dark:hover:text-white transition-all"
                  >
                    Cancelar
                  </button>
                  <button 
                    onClick={handleSave}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-10 py-4 rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl shadow-blue-200 dark:shadow-blue-900/20 transition-all active:scale-95 flex items-center gap-2"
                  >
                    <Save size={18} /> Salvar Pesquisa
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AdminSurveyManagement;
