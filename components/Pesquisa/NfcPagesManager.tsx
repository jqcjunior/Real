import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabaseClient';
import { ensureSession } from '../../services/authService';
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
  const [localStores, setLocalStores] = useState<Store[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingPage, setEditingPage] = useState<any | null>(null);

  const [storeId, setStoreId] = useState('');
  const [formData, setFormData] = useState({
    survey_id: '',
    payment_url: '',
    show_payment: false,
    cover_image_url: '',
    instagram: '',
    whatsapp_store: '',
    whatsapp_manager: '',
    whatsapp_central: '75999999999',
    whatsapp_beneficios: '',
    is_active: true,
    pix_key: '',
    pix_qrcode_url: '',
    show_instagram: true,
    show_pix: true,
    show_survey: true,
    show_whatsapp_store: true,
    show_whatsapp_manager: true,
    show_whatsapp_central: true,
    show_whatsapp_beneficios: false,
    google_review_url: '',
    payment_qrcode_url: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    await ensureSession();
    try {
      const { data: storesData, error: storesError } = await supabase
        .from('stores')
        .select('*')
        .order('number');
      if (storesError) throw storesError;

      const { data: pagesData, error: pagesError } = await supabase
        .from('store_nfc_pages')
        .select('*, surveys(title, public_token), stores(name, number)');
      if (pagesError) throw pagesError;

      const { data: surveysData, error: surveysError } = await supabase
        .from('surveys')
        .select('*')
        .eq('is_active', true);
      if (surveysError) throw surveysError;

      setLocalStores(storesData || []);
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
      setFormData({
        survey_id: existingPage.survey_id || '',
        cover_image_url: existingPage.cover_image_url || '',
        instagram: existingPage.instagram || '',
        whatsapp_store: existingPage.whatsapp_store || '',
        whatsapp_manager: existingPage.whatsapp_manager || '',
        whatsapp_central: existingPage.whatsapp_central || '75999999999',
        whatsapp_beneficios: existingPage.whatsapp_beneficios || '',
        is_active: existingPage.is_active ?? true,
        pix_key: existingPage.pix_key || '',
        pix_qrcode_url: existingPage.pix_qrcode_url || '',
        show_instagram: existingPage.show_instagram ?? true,
        show_pix: existingPage.show_pix ?? true,
        show_survey: existingPage.show_survey ?? true,
        show_whatsapp_store: existingPage.show_whatsapp_store ?? true,
        show_whatsapp_manager: existingPage.show_whatsapp_manager ?? true,
        show_whatsapp_central: existingPage.show_whatsapp_central ?? true,
        show_whatsapp_beneficios: existingPage.show_whatsapp_beneficios ?? false,
        google_review_url: existingPage.google_review_url || '',
        payment_url: existingPage.payment_url || '',
        show_payment: existingPage.show_payment ?? false,
        payment_qrcode_url: existingPage.payment_qrcode_url || ''
      });
    } else {
      setEditingPage(null);
      setFormData({
        survey_id: '',
        cover_image_url: '',
        instagram: '',
        whatsapp_store: '',
        whatsapp_manager: store.managerPhone || '',
        whatsapp_central: '75999999999',
        whatsapp_beneficios: '',
        is_active: true,
        pix_key: '',
        pix_qrcode_url: '',
        show_instagram: true,
        show_pix: true,
        show_survey: true,
        show_whatsapp_store: true,
        show_whatsapp_manager: true,
        show_whatsapp_central: true,
        show_whatsapp_beneficios: false,
        google_review_url: '',
        payment_url: '',
        show_payment: false,
        payment_qrcode_url: ''
      });
    }
  };

  const handleCloseModal = () => {
    setStoreId('');
    setEditingPage(null);
  };

  const handleSave = async () => {
    if (!formData.survey_id) {
      toast.error('Selecione uma pesquisa.');
      return;
    }
    
    try {
      await ensureSession();
      const payload = {
        store_id: storeId,
        ...formData
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
          {localStores.map(store => {
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
                    Loja selecionada: {localStores.find(s => s.id === storeId)?.name}
                  </p>
                </div>
              </div>

              <div className="p-8 overflow-y-auto bg-white dark:bg-slate-900">
                
                {/* Capa */}
                <div style={{ background: '#F8F9FA', borderRadius: '16px', padding: '16px 20px', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.5px', color: '#6B7280' }}>
                      URL DA FOTO DE CAPA
                    </label>
                  </div>
                  <input
                    type="url"
                    placeholder="https://..."
                    value={formData.cover_image_url}
                    onChange={(e) => setFormData({...formData, cover_image_url: e.target.value})}
                    className="w-full px-4 py-3 bg-white dark:bg-slate-800 rounded-xl text-sm font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 border border-slate-200 dark:border-slate-700 placeholder:text-slate-400"
                  />
                </div>

                {/* Instagram */}
                <div style={{ background: '#F8F9FA', borderRadius: '16px', padding: '16px 20px', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.5px', color: '#6B7280' }}>
                      INSTAGRAM (@)
                    </label>
                    <label className="relative cursor-pointer">
                      <input type="checkbox" className="sr-only" checked={formData.show_instagram} onChange={(e) => setFormData({...formData, show_instagram: e.target.checked})} />
                      <div className={`block w-12 h-6 rounded-full transition-colors ${formData.show_instagram ? 'bg-green-500' : 'bg-slate-300 dark:bg-slate-600'}`}></div>
                      <div className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${formData.show_instagram ? 'translate-x-6' : ''}`}></div>
                    </label>
                  </div>
                  <input
                    type="text"
                    placeholder="realcalcadoscruzdasalmas"
                    value={formData.instagram}
                    onChange={(e) => setFormData({...formData, instagram: e.target.value.replace('@', '')})}
                    className="w-full px-4 py-3 bg-white dark:bg-slate-800 rounded-xl text-sm font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 border border-slate-200 dark:border-slate-700 placeholder:text-slate-400"
                  />
                </div>

                {/* Chave Pix */}
                <div style={{ background: '#F8F9FA', borderRadius: '16px', padding: '16px 20px', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.5px', color: '#6B7280' }}>
                      CHAVE PIX
                    </label>
                    <label className="relative cursor-pointer">
                      <input type="checkbox" className="sr-only" checked={formData.show_pix} onChange={(e) => setFormData({...formData, show_pix: e.target.checked})} />
                      <div className={`block w-12 h-6 rounded-full transition-colors ${formData.show_pix ? 'bg-green-500' : 'bg-slate-300 dark:bg-slate-600'}`}></div>
                      <div className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${formData.show_pix ? 'translate-x-6' : ''}`}></div>
                    </label>
                  </div>
                  <input
                    type="text"
                    placeholder="CNPJ, E-mail, Celular ou Aleatória"
                    value={formData.pix_key}
                    onChange={(e) => setFormData({...formData, pix_key: e.target.value})}
                    className="w-full px-4 py-3 bg-white dark:bg-slate-800 rounded-xl text-sm font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 border border-slate-200 dark:border-slate-700 placeholder:text-slate-400"
                  />
                </div>

                {/* QR Code Pix */}
                <div style={{ background: '#F8F9FA', borderRadius: '16px', padding: '16px 20px', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.5px', color: '#6B7280' }}>
                      URL DO QR CODE PIX
                    </label>
                  </div>
                  <input
                    type="url"
                    placeholder="https://..."
                    value={formData.pix_qrcode_url}
                    onChange={(e) => setFormData({...formData, pix_qrcode_url: e.target.value})}
                    className="w-full px-4 py-3 bg-white dark:bg-slate-800 rounded-xl text-sm font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 border border-slate-200 dark:border-slate-700 placeholder:text-slate-400"
                  />
                </div>

                {/* Pesquisa Vinculada */}
                <div style={{ background: '#F8F9FA', borderRadius: '16px', padding: '16px 20px', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.5px', color: '#6B7280' }}>
                      PESQUISA DE SATISFAÇÃO
                    </label>
                    <label className="relative cursor-pointer">
                      <input type="checkbox" className="sr-only" checked={formData.show_survey} onChange={(e) => setFormData({...formData, show_survey: e.target.checked})} />
                      <div className={`block w-12 h-6 rounded-full transition-colors ${formData.show_survey ? 'bg-green-500' : 'bg-slate-300 dark:bg-slate-600'}`}></div>
                      <div className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${formData.show_survey ? 'translate-x-6' : ''}`}></div>
                    </label>
                  </div>
                  <select
                    value={formData.survey_id}
                    onChange={(e) => setFormData({...formData, survey_id: e.target.value})}
                    className="w-full px-4 py-3 bg-white dark:bg-slate-800 rounded-xl text-xs font-black text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 appearance-none uppercase tracking-widest border border-slate-200 dark:border-slate-700"
                  >
                    <option value="">SELECIONE UMA PESQUISA...</option>
                    {surveys.map(s => (
                      <option key={s.id} value={s.id}>{s.title}</option>
                    ))}
                  </select>
                </div>

                {/* WhatsApp da Loja */}
                <div style={{ background: '#F8F9FA', borderRadius: '16px', padding: '16px 20px', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.5px', color: '#6B7280' }}>
                      WHATSAPP DA LOJA
                    </label>
                    <label className="relative cursor-pointer">
                      <input type="checkbox" className="sr-only" checked={formData.show_whatsapp_store} onChange={(e) => setFormData({...formData, show_whatsapp_store: e.target.checked})} />
                      <div className={`block w-12 h-6 rounded-full transition-colors ${formData.show_whatsapp_store ? 'bg-green-500' : 'bg-slate-300 dark:bg-slate-600'}`}></div>
                      <div className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${formData.show_whatsapp_store ? 'translate-x-6' : ''}`}></div>
                    </label>
                  </div>
                  <input
                    type="text"
                    placeholder="Ex: 75999999999"
                    value={formData.whatsapp_store}
                    onChange={(e) => setFormData({...formData, whatsapp_store: e.target.value})}
                    className="w-full px-4 py-3 bg-white dark:bg-slate-800 rounded-xl text-sm font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 border border-slate-200 dark:border-slate-700 placeholder:text-slate-400"
                  />
                </div>

                {/* WhatsApp do Gerente */}
                <div style={{ background: '#F8F9FA', borderRadius: '16px', padding: '16px 20px', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.5px', color: '#6B7280' }}>
                      WHATSAPP DO GERENTE
                    </label>
                    <label className="relative cursor-pointer">
                      <input type="checkbox" className="sr-only" checked={formData.show_whatsapp_manager} onChange={(e) => setFormData({...formData, show_whatsapp_manager: e.target.checked})} />
                      <div className={`block w-12 h-6 rounded-full transition-colors ${formData.show_whatsapp_manager ? 'bg-green-500' : 'bg-slate-300 dark:bg-slate-600'}`}></div>
                      <div className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${formData.show_whatsapp_manager ? 'translate-x-6' : ''}`}></div>
                    </label>
                  </div>
                  <input
                    type="text"
                    placeholder="Ex: 75999999999"
                    value={formData.whatsapp_manager}
                    onChange={(e) => setFormData({...formData, whatsapp_manager: e.target.value})}
                    className="w-full px-4 py-3 bg-white dark:bg-slate-800 rounded-xl text-sm font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 border border-slate-200 dark:border-slate-700 placeholder:text-slate-400"
                  />
                </div>

                {/* WhatsApp Central */}
                <div style={{ background: '#F8F9FA', borderRadius: '16px', padding: '16px 20px', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.5px', color: '#6B7280' }}>
                      WHATSAPP CENTRAL
                    </label>
                    <label className="relative cursor-pointer">
                      <input type="checkbox" className="sr-only" checked={formData.show_whatsapp_central} onChange={(e) => setFormData({...formData, show_whatsapp_central: e.target.checked})} />
                      <div className={`block w-12 h-6 rounded-full transition-colors ${formData.show_whatsapp_central ? 'bg-green-500' : 'bg-slate-300 dark:bg-slate-600'}`}></div>
                      <div className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${formData.show_whatsapp_central ? 'translate-x-6' : ''}`}></div>
                    </label>
                  </div>
                  <input
                    type="text"
                    placeholder="Ex: 75999999999"
                    value={formData.whatsapp_central}
                    onChange={(e) => setFormData({...formData, whatsapp_central: e.target.value})}
                    className="w-full px-4 py-3 bg-white dark:bg-slate-800 rounded-xl text-sm font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 border border-slate-200 dark:border-slate-700 placeholder:text-slate-400"
                  />
                </div>

                {/* WhatsApp Real Benefícios */}
                <div style={{ background: '#F8F9FA', borderRadius: '16px', padding: '16px 20px', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.5px', color: '#6B7280' }}>
                      WHATSAPP REAL BENEFÍCIOS
                    </label>
                    <label className="relative cursor-pointer">
                      <input type="checkbox" className="sr-only" checked={formData.show_whatsapp_beneficios} onChange={(e) => setFormData({...formData, show_whatsapp_beneficios: e.target.checked})} />
                      <div className={`block w-12 h-6 rounded-full transition-colors ${formData.show_whatsapp_beneficios ? 'bg-green-500' : 'bg-slate-300 dark:bg-slate-600'}`}></div>
                      <div className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${formData.show_whatsapp_beneficios ? 'translate-x-6' : ''}`}></div>
                    </label>
                  </div>
                  <input
                    type="text"
                    placeholder="Ex: 5575999999999"
                    value={formData.whatsapp_beneficios}
                    onChange={(e) => setFormData({...formData, whatsapp_beneficios: e.target.value})}
                    className="w-full px-4 py-3 bg-white dark:bg-slate-800 rounded-xl text-sm font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 border border-slate-200 dark:border-slate-700 placeholder:text-slate-400"
                  />
                </div>

                {/* Link Pagamento Online */}
                <div style={{ background: '#F8F9FA', borderRadius: '16px', padding: '16px 20px', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.5px', color: '#6B7280' }}>
                      LINK PAGAMENTO ONLINE
                    </label>
                    <label className="relative cursor-pointer">
                      <input type="checkbox" className="sr-only" checked={formData.show_payment} onChange={(e) => setFormData({...formData, show_payment: e.target.checked})} />
                      <div className={`block w-12 h-6 rounded-full transition-colors ${formData.show_payment ? 'bg-green-500' : 'bg-slate-300 dark:bg-slate-600'}`}></div>
                      <div className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${formData.show_payment ? 'translate-x-6' : ''}`}></div>
                    </label>
                  </div>
                  <input
                    type="url"
                    placeholder="https://link-de-pagamento..."
                    value={formData.payment_url}
                    onChange={(e) => setFormData({...formData, payment_url: e.target.value})}
                    className="w-full px-4 py-3 bg-white dark:bg-slate-800 rounded-xl text-sm font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 border border-slate-200 dark:border-slate-700 placeholder:text-slate-400"
                  />
                </div>

                {/* QR Code Pagamento Online */}
                <div style={{ background: '#F8F9FA', borderRadius: '16px', padding: '16px 20px', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.5px', color: '#6B7280' }}>
                      URL DO QR CODE PAGAMENTO
                    </label>
                  </div>
                  <input
                    type="url"
                    placeholder="https://..."
                    value={formData.payment_qrcode_url}
                    onChange={(e) => setFormData({...formData, payment_qrcode_url: e.target.value})}
                    className="w-full px-4 py-3 bg-white dark:bg-slate-800 rounded-xl text-sm font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 border border-slate-200 dark:border-slate-700 placeholder:text-slate-400"
                  />
                </div>

                {/* Google Reviews */}
                <div style={{ background: '#F8F9FA', borderRadius: '16px', padding: '16px 20px', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.5px', color: '#6B7280' }}>
                      LINK AVALIAÇÃO GOOGLE
                    </label>
                  </div>
                  <input
                    type="url"
                    placeholder="https://g.page/r/..."
                    value={formData.google_review_url}
                    onChange={(e) => setFormData({...formData, google_review_url: e.target.value})}
                    className="w-full px-4 py-3 bg-white dark:bg-slate-800 rounded-xl text-sm font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 border border-slate-200 dark:border-slate-700 placeholder:text-slate-400"
                  />
                </div>

                {/* Página Ativa */}
                <div style={{ background: '#F8F9FA', borderRadius: '16px', padding: '16px 20px' }}>
                   <label className="flex items-center justify-between cursor-pointer">
                     <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.5px', color: '#6B7280' }}>
                       PÁGINA ATIVA
                     </span>
                     <div className="relative">
                       <input 
                         type="checkbox" 
                         className="sr-only" 
                         checked={formData.is_active} 
                         onChange={(e) => setFormData({...formData, is_active: e.target.checked})} 
                       />
                       <div className={`block w-12 h-6 rounded-full transition-colors ${formData.is_active ? 'bg-green-500' : 'bg-slate-300 dark:bg-slate-600'}`}></div>
                       <div className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${formData.is_active ? 'translate-x-6' : ''}`}></div>
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