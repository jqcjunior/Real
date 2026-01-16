
import React, { useState, useRef, useMemo } from 'react';
import { DownloadItem, DownloadCategory, User, UserRole } from '../types';
// Fix: Added missing Save import from lucide-react
import { 
  Download, FileSpreadsheet, Image as ImageIcon, Video, Trash2, 
  Plus, Upload, X, Search, FileText, ExternalLink, Music, 
  Loader2, Filter, Info, Inbox, AlertCircle, Save 
} from 'lucide-react';

interface DownloadsModuleProps {
  user: User;
  items: DownloadItem[] | null | undefined;
  onUpload: (item: DownloadItem) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onLogAction?: (action: string, details: string) => void;
}

const DownloadsModule: React.FC<DownloadsModuleProps> = ({ user, items, onUpload, onDelete, onLogAction }) => {
  const [filterCategory, setFilterCategory] = useState<'all' | 'spreadsheet' | 'media'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isAdmin = user?.role === UserRole.ADMIN;

  // Form State Defensivo
  const [newItem, setNewItem] = useState({
      title: '',
      description: '',
      category: 'spreadsheet' as DownloadCategory,
      url: '',
      fileName: '',
      size: '',
      campaign: ''
  });

  // Função de extração de nome com prioridade
  const getDisplayName = (item: DownloadItem) => {
      if (item.fileName && typeof item.fileName === 'string') return item.fileName;
      if (item.title && typeof item.title === 'string') return item.title;
      return 'arquivo';
  };

  // Função de extração de extensão segura
  const getExtension = (item: DownloadItem) => {
      const name = getDisplayName(item);
      if (typeof name === 'string' && name.includes('.')) {
          const parts = name.split('.');
          return parts.length > 1 ? parts.pop()?.toUpperCase() || '' : '';
      }
      return '';
  };

  // Filtragem Defensiva
  const filteredItems = useMemo(() => {
    if (!Array.isArray(items)) return [];

    return items.filter(item => {
      if (!item) return false;

      // Filtro de Categoria
      const matchesCategory = 
        filterCategory === 'all' || 
        item.category === filterCategory;

      // Filtro de Busca
      const search = (searchTerm || '').toLowerCase();
      const titleMatch = (item.title || '').toLowerCase().includes(search);
      const descMatch = (item.description || '').toLowerCase().includes(search);
      const fileMatch = (item.fileName || '').toLowerCase().includes(search);
      
      return matchesCategory && (titleMatch || descMatch || fileMatch);
    });
  }, [items, filterCategory, searchTerm]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          const reader = new FileReader();
          reader.onload = () => {
              setNewItem(prev => ({
                  ...prev,
                  url: reader.result as string,
                  fileName: file.name,
                  size: `${(file.size / 1024 / 1024).toFixed(2)} MB`
              }));
          };
          reader.readAsDataURL(file);
      }
  };

  const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!newItem.title || !newItem.url) {
          alert("Título e arquivo são obrigatórios.");
          return;
      }

      setIsSubmitting(true);
      try {
          const downloadItem: DownloadItem = {
              id: `dl-${Date.now()}`,
              title: newItem.title,
              description: newItem.description || null,
              category: newItem.category,
              url: newItem.url,
              fileName: newItem.fileName || 'arquivo',
              size: newItem.size || null,
              campaign: newItem.campaign || null,
              createdAt: new Date(),
              createdBy: user?.name || 'Sistema'
          };

          await onUpload(downloadItem);
          if (onLogAction) onLogAction('UPLOAD_FILE', `Adicionou arquivo: ${downloadItem.title}`);
          
          setIsModalOpen(false);
          setNewItem({ title: '', description: '', category: 'spreadsheet', url: '', fileName: '', size: '', campaign: '' });
      } catch (error) {
          alert("Erro ao salvar arquivo.");
      } finally {
          setIsSubmitting(false);
      }
  };

  const handleDownloadAction = (item: DownloadItem) => {
      if (!item.url) return;
      if (item.url.startsWith('data:')) {
          const link = document.createElement('a');
          link.href = item.url;
          link.download = getDisplayName(item);
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
      } else {
          window.open(item.url, '_blank');
      }
  };

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
        
        {/* Header Estratégico */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div>
                <h2 className="text-4xl font-black text-gray-900 flex items-center gap-4 uppercase italic tracking-tighter leading-none">
                    <Download className="text-blue-600" size={40} />
                    Central de <span className="text-red-600">Downloads</span>
                </h2>
                <p className="text-gray-500 font-bold text-xs uppercase tracking-widest mt-3 flex items-center gap-2">
                    Acesse materiais, planilhas, áudios e mídias importantes.
                </p>
            </div>
            
            {isAdmin && (
                <button 
                    onClick={() => setIsModalOpen(true)}
                    className="bg-gray-900 text-white px-8 py-4 rounded-[24px] font-black uppercase text-xs shadow-2xl hover:bg-black transition-all active:scale-95 flex items-center gap-3 border-b-4 border-blue-600"
                >
                    <Plus size={20} /> Adicionar Arquivo
                </button>
            )}
        </div>

        {/* Toolbar de Filtros */}
        <div className="bg-white p-6 rounded-[32px] shadow-sm border border-gray-100 flex flex-col md:flex-row gap-6 justify-between items-center">
            <div className="flex bg-gray-100 p-1.5 rounded-2xl w-full md:w-auto">
                <button 
                  onClick={() => setFilterCategory('all')} 
                  className={`flex-1 md:flex-none px-6 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all ${filterCategory === 'all' ? 'bg-white text-gray-900 shadow-md' : 'text-gray-400 hover:text-gray-600'}`}
                >
                  Todos
                </button>
                <button 
                  onClick={() => setFilterCategory('spreadsheet')} 
                  className={`flex-1 md:flex-none px-6 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all flex items-center justify-center gap-2 ${filterCategory === 'spreadsheet' ? 'bg-white text-green-700 shadow-md' : 'text-gray-400 hover:text-gray-600'}`}
                >
                  <FileSpreadsheet size={14}/> Planilhas
                </button>
                <button 
                  onClick={() => setFilterCategory('media')} 
                  className={`flex-1 md:flex-none px-6 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all flex items-center justify-center gap-2 ${filterCategory === 'media' ? 'bg-white text-purple-700 shadow-md' : 'text-gray-400 hover:text-gray-600'}`}
                >
                  <ImageIcon size={14}/> Mídias
                </button>
            </div>
            
            <div className="relative w-full md:w-80">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
                <input 
                    type="text"
                    placeholder="Localizar material..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-12 pr-6 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-bold text-gray-700 focus:ring-4 focus:ring-blue-50 outline-none transition-all shadow-inner"
                />
            </div>
        </div>

        {/* Grade de Conteúdo com Fallbacks */}
        {!items ? (
            <div className="py-32 flex flex-col items-center justify-center gap-4 text-gray-300">
                <Loader2 className="animate-spin text-blue-600" size={48} />
                <p className="text-[10px] font-black uppercase tracking-[0.3em]">Sincronizando arquivos...</p>
            </div>
        ) : filteredItems.length === 0 ? (
            <div className="py-32 bg-white rounded-[48px] border-2 border-dashed border-gray-100 flex flex-col items-center justify-center text-center px-10">
                <div className="p-8 bg-gray-50 rounded-full mb-6">
                    <Inbox size={64} className="text-gray-200" />
                </div>
                <h3 className="text-xl font-black text-gray-400 uppercase italic tracking-tighter">Nenhum arquivo disponível</h3>
                <p className="text-gray-300 text-[10px] font-bold uppercase mt-2 tracking-widest">Tente alterar os filtros ou pesquisar por outro termo</p>
            </div>
        ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
                {filteredItems.map(item => {
                    const ext = getExtension(item);
                    return (
                        <div key={item.id} className="bg-white rounded-[40px] shadow-sm border border-gray-100 overflow-hidden flex flex-col group hover:shadow-xl hover:border-blue-200 transition-all duration-300 animate-in zoom-in-95">
                            {/* Área de Visualização/Tipo */}
                            <div className={`h-40 flex items-center justify-center relative bg-gray-50 overflow-hidden`}>
                                <div className="absolute inset-0 opacity-10 flex items-center justify-center transform group-hover:scale-110 transition-transform duration-500">
                                    {item.category === 'spreadsheet' ? <FileSpreadsheet size={120}/> : <ImageIcon size={120}/>}
                                </div>

                                <div className="z-10 flex flex-col items-center gap-2">
                                    {item.category === 'spreadsheet' ? (
                                        <div className="p-5 bg-green-500 text-white rounded-3xl shadow-lg border-2 border-white"><FileSpreadsheet size={32}/></div>
                                    ) : (
                                        <div className="p-5 bg-purple-500 text-white rounded-3xl shadow-lg border-2 border-white"><ImageIcon size={32}/></div>
                                    )}
                                    {ext && <span className="bg-gray-900 text-white text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest">{ext}</span>}
                                </div>

                                {/* Overlay de Ações */}
                                <div className="absolute inset-0 bg-gray-900/60 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center gap-4 backdrop-blur-sm">
                                    <button 
                                        onClick={() => handleDownloadAction(item)}
                                        className="p-4 bg-white text-gray-900 rounded-2xl hover:scale-110 transition-transform shadow-xl flex items-center gap-2 font-black text-[10px] uppercase"
                                    >
                                        <Download size={18}/> Baixar
                                    </button>
                                    {isAdmin && (
                                        <button 
                                            onClick={() => onDelete(item.id)}
                                            className="p-4 bg-red-600 text-white rounded-2xl hover:scale-110 transition-transform shadow-xl"
                                            title="Excluir"
                                        >
                                            <Trash2 size={18}/>
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Informações */}
                            <div className="p-6 flex-1 flex flex-col">
                                <h3 className="font-black text-gray-900 uppercase italic leading-tight mb-2 line-clamp-1 text-sm">{item.title || 'Sem título'}</h3>
                                <p className="text-[10px] text-gray-400 font-medium line-clamp-2 mb-4 leading-relaxed flex-1">
                                    {item.description || 'Nenhuma descrição fornecida para este material.'}
                                </p>
                                
                                <div className="flex items-center justify-between pt-4 border-t border-gray-50">
                                    <div className="flex flex-col">
                                        <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Enviado por</span>
                                        <span className="text-[10px] font-black text-blue-600 uppercase">
                                            {(item.createdBy || 'Sistema').split(' ')[0]}
                                        </span>
                                    </div>
                                    {item.size && (
                                        <div className="text-right">
                                            <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest block">Tamanho</span>
                                            <span className="text-[10px] font-black text-gray-900 uppercase">{item.size}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        )}

        {/* Modal de Upload Defensivo */}
        {isModalOpen && (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[100] p-4">
                <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in duration-300 border-t-8 border-blue-600">
                    <div className="p-8 bg-gray-50 border-b flex justify-between items-center">
                        <div>
                            <h3 className="text-2xl font-black text-gray-900 uppercase italic tracking-tighter">Novo <span className="text-blue-600">Material</span></h3>
                            <p className="text-[10px] font-black text-gray-400 uppercase mt-1 tracking-widest">Adicionar arquivo à rede corporativa</p>
                        </div>
                        <button onClick={() => setIsModalOpen(false)} className="bg-white p-2 rounded-full text-gray-400 hover:text-red-600 shadow-sm border border-gray-100 transition-all"><X size={24} /></button>
                    </div>
                    
                    <form onSubmit={handleSubmit} className="p-10 space-y-6">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-400 uppercase ml-1 tracking-widest">Título do Arquivo *</label>
                            <input 
                                required
                                value={newItem.title}
                                onChange={e => setNewItem({...newItem, title: e.target.value})}
                                className="w-full p-4 bg-gray-50 border-none rounded-2xl text-sm font-bold text-gray-800 outline-none focus:ring-4 focus:ring-blue-50 transition-all"
                                placeholder="Ex: Planilha de Metas Fevereiro"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-400 uppercase ml-1 tracking-widest">Categoria de Uso</label>
                            <div className="grid grid-cols-2 gap-3">
                                <button type="button" onClick={() => setNewItem({...newItem, category: 'spreadsheet'})} className={`py-4 rounded-2xl text-[10px] font-black uppercase transition-all flex items-center justify-center gap-2 border-2 ${newItem.category === 'spreadsheet' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-white text-gray-400 border-gray-100'}`}><FileSpreadsheet size={16}/> Planilha</button>
                                <button type="button" onClick={() => setNewItem({...newItem, category: 'media'})} className={`py-4 rounded-2xl text-[10px] font-black uppercase transition-all flex items-center justify-center gap-2 border-2 ${newItem.category === 'media' ? 'bg-purple-50 text-purple-700 border-purple-200' : 'bg-white text-gray-400 border-gray-100'}`}><ImageIcon size={16}/> Mídia</button>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-400 uppercase ml-1 tracking-widest">Descrição Breve (Opcional)</label>
                            <textarea 
                                value={newItem.description}
                                onChange={e => setNewItem({...newItem, description: e.target.value})}
                                className="w-full p-4 bg-gray-50 border-none rounded-2xl text-sm font-medium text-gray-700 outline-none focus:ring-4 focus:ring-blue-50 h-24 resize-none"
                                placeholder="Para que serve este material?"
                            />
                        </div>

                        <div className="pt-2">
                            <div 
                                onClick={() => !isSubmitting && fileInputRef.current?.click()}
                                className={`border-4 border-dashed rounded-[32px] p-8 flex flex-col items-center justify-center transition-all cursor-pointer ${newItem.fileName ? 'border-green-200 bg-green-50' : 'border-gray-100 bg-gray-50 hover:bg-white hover:border-blue-200'}`}
                            >
                                {newItem.fileName ? (
                                    <>
                                        <div className="p-3 bg-green-500 text-white rounded-2xl mb-3 shadow-lg"><FileText size={24}/></div>
                                        <span className="text-[10px] font-black text-green-900 uppercase truncate max-w-full px-4">{newItem.fileName}</span>
                                        <span className="text-[8px] font-black text-green-600 uppercase mt-1 tracking-widest">{newItem.size}</span>
                                    </>
                                ) : (
                                    <>
                                        <Upload className="text-gray-300 mb-2" size={32} />
                                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Selecionar Arquivo</span>
                                    </>
                                )}
                                <input 
                                    type="file" 
                                    ref={fileInputRef} 
                                    className="hidden" 
                                    onChange={handleFileSelect}
                                />
                            </div>
                        </div>

                        <button 
                            type="submit"
                            disabled={isSubmitting}
                            className="w-full py-5 bg-blue-600 hover:bg-blue-700 text-white rounded-[24px] font-black uppercase text-xs shadow-2xl flex items-center justify-center gap-3 border-b-4 border-blue-900 active:scale-95 transition-all disabled:opacity-50"
                        >
                            {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : <Save size={18}/>}
                            Confirmar Envio
                        </button>
                    </form>
                </div>
            </div>
        )}
    </div>
  );
};

export default DownloadsModule;
