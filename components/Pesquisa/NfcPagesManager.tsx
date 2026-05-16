import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabaseClient';
import { Store, Survey } from '../../types';
import { ArrowLeft, Edit3, Plus, Smartphone, Save, CheckCircle2, XCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

interface NfcPagesManagerProps {
  stores: Store[];
  onBack: () => void;
}

const NfcPagesManager: React.FC<NfcPagesManagerProps> = ({ stores, onBack }) => {
  const [storePages, setStorePages] = useState<any[]>([]);
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingPage, setEditingPage] = useState<any | null>(null);

  // Form State
  const [storeId, setStoreId] = useState('');
  const [surveyId, setSurveyId] = useState('');
  const [coverImageUrl, setCoverImageUrl] = useState('');
  const [instagram, setInstagram] = useState('');
  const [whatsappStore, setWhatsappStore] = useState('');
  const [whatsappManager, setWhatsappManager] = useState('');
  const [whatsappCentral, setWhatsappCentral] = useState('75999999999');
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const { data: pagesData, error: pagesError } = await supabase
        .from('store_nfc_pages')
        .select('*, surveys(title, public_token), stores(name, number)');
      if (pagesError) throw pagesError;

      const { data: surveysData, error: surveysError } = await supabase
        .from('surveys')
        .select('*')
        .eq('is_active', true);
      if (surveysError) throw surveysError;

      setStorePages(pagesData || []);
      setSurveys(surveysData || []);
    } catch (err: any) {
      toast.error('Erro ao buscar dados: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenModal = (store: Store, existingPage?: any) => {
    setStoreId(store.id);
    if (existingPage) {
      setEditingPage(existingPage);
      setSurveyId(existingPage.survey_id || '');
      setCoverImageUrl(existingPage.cover_image_url || '');
      setInstagram(existingPage.instagram || '');
      setWhatsappStore(existingPage.whatsapp_store || '');
      setWhatsappManager(existingPage.whatsapp_manager || '');
      setWhatsappCentral(existingPage.whatsapp_central || '75999999999');
      setIsActive(existingPage.is_active);
    } else {
      setEditingPage(null);
      setSurveyId('');
      setCoverImageUrl('');
      setInstagram('');
      setWhatsappStore('');
      setWhatsappManager(store.manager_phone || '');
      setWhatsappCentral('75999999999');
      setIsActive(true);
    }
  };

  const handleCloseModal = () => {
    setStoreId('');
    setEditingPage(null);
  };

  const handleSave = async () => {
    if (!surveyId) {
      toast.error('Selecione uma pesquisa.');
      return;
    }
    
    try {
      const payload = {
        store_id: storeId,
        survey_id: surveyId,
        cover_image_url: coverImageUrl,
        instagram: instagram,
        whatsapp_store: whatsappStore,
        whatsapp_manager: whatsappManager,
        whatsapp_central: whatsappCentral,
        is_active: isActive
      };

      const { error } = await supabase
        .from('store_nfc_pages')
        .upsert(payload, { onConflict: 'store_id' });

      if (error) throw error;
      
      toast.success('Página NFC configurada com sucesso!');
      handleCloseModal();
      fetchData();
    } catch (err: any) {
      toast.error('Erro ao salvar página: ' + err.message);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button 
            onClick={onBack}
            className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl hover:bg-slate-50 transition-all shadow-sm"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h3 className="text-2xl font-black italic uppercase tracking-tighter flex items-center gap-2">
              <Smartphone size={24} className="text-blue-600" /> Páginas NFC das Lojas
            </h3>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
              Configure as páginas públicas de destino para as tags NFC
            </p>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {stores.map(store => {
            const page = storePages.find(p => p.store_id === store.id);
            return (
              <div key={store.id} className="bg-white dark:bg-slate-900 p-6 rounded-[32px] border border-slate-100 dark:border-slate-800 flex flex-col justify-between h-full shadow-sm">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full">
                      LOJA {store.number}
                    </span>
                    {page ? (
                      page.is_active ? (
                        <span className="text-[10px] font-black uppercase text-green-600 tracking-widest bg-green-50 dark:bg-green-900/20 px-3 py-1 rounded-full flex items-center gap-1">
                          <CheckCircle2 size={12} /> Ativa
                        </span>
                      ) : (
                        <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full flex items-center gap-1">
                          <XCircle size={12} /> Inativa
                        </span>
                      )
                    ) : (
                      <span className="text-[10px] font-black uppercase text-amber-600 tracking-widest bg-amber-50 dark:bg-amber-900/20 px-3 py-1 rounded-full">
                        Sem Página
                      </span>
                    )}
                  </div>
                  <h4 className="text-xl font-black uppercase text-slate-900 dark:text-white mb-2">
                    {store.name}
                  </h4>
                  {page && (
                    <div className="space-y-1 mb-4">
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                        Pesquisa: <span className="text-blue-600">{page.surveys?.title || 'Não encontrada'}</span>
                      </p>
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                        Wpp: <span className="text-green-600">{page.whatsapp_store || 'Não definido'}</span>
                      </p>
                    </div>
                  )}
                </div>
                
                <div className="mt-6 flex items-center gap-2">
                  {page ? (
                     <button
                       onClick={() => handleOpenModal(store, page)}
                       className="flex-1 p-3 bg-blue-50 dark:bg-blue-900/20 text-blue-600 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-blue-600 hover:text-white transition-all flex items-center justify-center gap-2"
                     >
                       <Edit3 size={14} /> Editar
                     </button>
                  ) : (
                    <button
                      onClick={() => handleOpenModal(store)}
                      className="flex-1 p-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-blue-600 hover:text-white transition-all flex items-center justify-center gap-2"
                    >
                      <Plus size={14} /> Criar Página
                    </button>
                  )}
                  {page && page.is_active && (
                    <button 
                      onClick={() => {
                        window.open(`https://www.realadmin.com.br/loja/${store.number.toString().padStart(2, '0')}`, '_blank');
                      }}
                      className="p-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-2xl hover:bg-slate-200 transition-all font-bold"
                      title="Testar Link"
                    >
                      Ver
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      <AnimatePresence>
        {storeId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={handleCloseModal}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-[40px] shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
                <div>
                  <h3 className="text-2xl font-black uppercase italic tracking-tighter text-slate-900 dark:text-white leading-none">
                    {editingPage ? 'Editar Página NFC' : 'Nova Página NFC'}
                  </h3>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-2">
                    Loja selecionada: {stores.find(s => s.id === storeId)?.name}
                  </p>
                </div>
              </div>

              <div className="p-8 overflow-y-auto space-y-6">
                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2 ml-1">Pesquisa Vinculada</label>
                  <select
                    value={surveyId}
                    onChange={(e) => setSurveyId(e.target.value)}
                    className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 rounded-2xl text-xs font-black text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 appearance-none uppercase tracking-widest border-none"
                  >
                    <option value="">SELECIONE UMA PESQUISA...</option>
                    {surveys.map(s => (
                      <option key={s.id} value={s.id}>{s.title}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2 ml-1">WhatsApp da Loja</label>
                    <input
                      type="text"
                      placeholder="Ex: 75999999999"
                      value={whatsappStore}
                      onChange={(e) => setWhatsappStore(e.target.value)}
                      className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 rounded-2xl text-sm font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 border-none placeholder:text-slate-300"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2 ml-1">WhatsApp Gerente</label>
                    <input
                      type="text"
                      placeholder="Ex: 75999999999"
                      value={whatsappManager}
                      onChange={(e) => setWhatsappManager(e.target.value)}
                      className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 rounded-2xl text-sm font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 border-none placeholder:text-slate-300"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2 ml-1">WhatsApp Central</label>
                    <input
                      type="text"
                      placeholder="Ex: 75999999999"
                      value={whatsappCentral}
                      onChange={(e) => setWhatsappCentral(e.target.value)}
                      className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 rounded-2xl text-sm font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 border-none placeholder:text-slate-300"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2 ml-1">Instagram (@)</label>
                    <input
                      type="text"
                      placeholder="Ex: realcalcados"
                      value={instagram}
                      onChange={(e) => setInstagram(e.target.value.replace('@', ''))}
                      className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 rounded-2xl text-sm font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 border-none placeholder:text-slate-300"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2 ml-1">URL da Foto de Capa (Opcional)</label>
                  <input
                    type="url"
                    placeholder="https://..."
                    value={coverImageUrl}
                    onChange={(e) => setCoverImageUrl(e.target.value)}
                    className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 rounded-2xl text-sm font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 border-none placeholder:text-slate-300"
                  />
                </div>

                <div>
                   <label className="flex items-center gap-3 cursor-pointer p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl">
                     <span className="text-xs font-black uppercase tracking-widest text-slate-700 dark:text-slate-300">Página Ativa</span>
                     <div className="relative">
                       <input 
                         type="checkbox" 
                         className="sr-only" 
                         checked={isActive} 
                         onChange={(e) => setIsActive(e.target.checked)} 
                       />
                       <div className={`block w-14 h-8 rounded-full transition-colors ${isActive ? 'bg-green-500' : 'bg-slate-300 dark:bg-slate-600'}`}></div>
                       <div className={`absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform ${isActive ? 'translate-x-6' : ''}`}></div>
                     </div>
                   </label>
                </div>
              </div>

              <div className="p-6 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2">
                <button 
                  onClick={handleCloseModal}
                  className="px-6 py-4 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-slate-200 dark:hover:bg-slate-700 transition-all text-slate-500"
                >
                  Cancelar
                </button>
                <button 
                  onClick={handleSave}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-10 py-4 rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl shadow-blue-200 dark:shadow-blue-900/20 transition-all active:scale-95 flex items-center gap-2"
                >
                  <Save size={18} /> Salvar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default NfcPagesManager;
