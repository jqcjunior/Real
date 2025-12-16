
import React, { useState, useRef } from 'react';
import { DownloadItem, DownloadCategory, User, UserRole, SystemLog } from '../types';
import { Download, FileSpreadsheet, Image as ImageIcon, Video, Trash2, Plus, Upload, X, Search, FileText, ExternalLink, Music, FolderOpen, ChevronRight, Folder } from 'lucide-react';

interface DownloadsModuleProps {
  user: User;
  items: DownloadItem[];
  onUpload: (item: DownloadItem) => void;
  onDelete: (id: string) => void;
  onLogAction?: (action: SystemLog['action'], details: string) => void;
}

const CAMPAIGNS = [
    'Aniversário Loja',
    'Carnaval',
    'Dia das Crianças',
    'Dia das Mães',
    'Dia dos Pais',
    'Finados',
    'Independência',
    'Natal',
    'Proclamação da República',
    'Promoção',
    'São João',
    'Tiradentes'
].sort();

const DownloadsModule: React.FC<DownloadsModuleProps> = ({ user, items, onUpload, onDelete, onLogAction }) => {
  const [filterCategory, setFilterCategory] = useState<'all' | DownloadCategory>('all');
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null); // For image campaigns
  
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Upload Form State
  const [newItem, setNewItem] = useState<{
      title: string;
      description: string;
      category: DownloadCategory;
      url: string; // Base64 or Link
      fileName: string;
      size: string;
      campaign: string;
  }>({
      title: '',
      description: '',
      category: 'spreadsheet',
      url: '',
      fileName: '',
      size: '',
      campaign: ''
  });
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isAdmin = user.role === UserRole.ADMIN;

  // Logic:
  // If Category != Image: Show items normally
  // If Category == Image:
  //    If no folder selected: Show folders list
  //    If folder selected: Show items in that folder
  const filteredItems = items.filter(item => {
      const matchesCategory = filterCategory === 'all' || item.category === filterCategory;
      const matchesSearch = item.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            item.description.toLowerCase().includes(searchTerm.toLowerCase());
      
      let matchesFolder = true;
      if (filterCategory === 'image' && selectedFolder) {
          matchesFolder = item.campaign === selectedFolder;
      }

      return matchesCategory && matchesSearch && matchesFolder;
  });

  const getIcon = (category: DownloadCategory) => {
      switch(category) {
          case 'spreadsheet': return <FileSpreadsheet className="text-green-600" size={32} />;
          case 'video': return <Video className="text-red-600" size={32} />;
          case 'image': return <ImageIcon className="text-purple-600" size={32} />;
          case 'audio': return <Music className="text-orange-600" size={32} />;
          default: return <FileText className="text-gray-600" size={32} />;
      }
  };

  const getColor = (category: DownloadCategory) => {
      switch(category) {
          case 'spreadsheet': return 'bg-green-50 border-green-200 text-green-800';
          case 'video': return 'bg-red-50 border-red-200 text-red-800';
          case 'image': return 'bg-purple-50 border-purple-200 text-purple-800';
          case 'audio': return 'bg-orange-50 border-orange-200 text-orange-800';
          default: return 'bg-gray-50 border-gray-200 text-gray-800';
      }
  };

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

  const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      
      // Basic validation
      if (!newItem.title || !newItem.url) {
          alert("Preencha o título e selecione um arquivo ou insira uma URL.");
          return;
      }

      if (newItem.category === 'image' && !newItem.campaign) {
          alert("Selecione a campanha para esta imagem.");
          return;
      }

      const downloadItem: DownloadItem = {
          id: `dl-${Date.now()}`,
          title: newItem.title,
          description: newItem.description,
          category: newItem.category,
          url: newItem.url,
          fileName: newItem.fileName || 'Link Externo',
          size: newItem.size || 'N/A',
          campaign: newItem.campaign,
          createdAt: new Date(),
          createdBy: user.name
      };

      onUpload(downloadItem);
      if (onLogAction) onLogAction('UPLOAD_FILE', `Adicionou arquivo: ${downloadItem.title}`);
      
      // Reset
      setIsModalOpen(false);
      setNewItem({ title: '', description: '', category: 'spreadsheet', url: '', fileName: '', size: '', campaign: '' });
  };

  const handleDownload = (item: DownloadItem) => {
      if (item.url.startsWith('data:')) {
          // It's a file (Base64)
          const link = document.createElement('a');
          link.href = item.url;
          link.download = item.fileName || 'download';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
      } else {
          // It's a URL
          window.open(item.url, '_blank');
      }
  };

  const getAcceptType = () => {
      switch(newItem.category) {
          case 'image': return "image/*";
          case 'audio': return "audio/*,.mp3,.wav,.ogg";
          case 'video': return "video/*";
          default: return ".xlsx,.xls,.pdf,.csv,.doc,.docx";
      }
  };

  // Helper to count items in a campaign
  const getCampaignCount = (campaign: string) => {
      return items.filter(i => i.category === 'image' && i.campaign === campaign).length;
  };

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div>
                <h2 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
                    <Download className="text-blue-600" size={32} />
                    Central de Downloads
                </h2>
                <p className="text-gray-500 mt-1">Acesse materiais, planilhas, áudios e mídias importantes.</p>
            </div>
            
            {isAdmin && (
                <button 
                    onClick={() => setIsModalOpen(true)}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg font-bold flex items-center gap-2 shadow-md transition-all"
                >
                    <Plus size={20} /> Adicionar Arquivo
                </button>
            )}
        </div>

        {/* Filters & Search */}
        <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-gray-100">
            {/* UPDATED: flex-wrap instead of overflow-x-auto to prevent scrollbars and allow adjustment */}
            <div className="flex flex-wrap gap-2 w-full md:w-auto justify-center md:justify-start">
                <button onClick={() => { setFilterCategory('all'); setSelectedFolder(null); }} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${filterCategory === 'all' ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>Todos</button>
                <button onClick={() => setFilterCategory('spreadsheet')} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${filterCategory === 'spreadsheet' ? 'bg-green-600 text-white' : 'bg-green-50 text-green-700 hover:bg-green-100'}`}><FileSpreadsheet size={16}/> Planilhas</button>
                <button onClick={() => setFilterCategory('video')} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${filterCategory === 'video' ? 'bg-red-600 text-white' : 'bg-red-50 text-red-700 hover:bg-red-100'}`}><Video size={16}/> Vídeos</button>
                <button onClick={() => { setFilterCategory('image'); setSelectedFolder(null); }} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${filterCategory === 'image' ? 'bg-purple-600 text-white' : 'bg-purple-50 text-purple-700 hover:bg-purple-100'}`}><ImageIcon size={16}/> Imagens</button>
                <button onClick={() => setFilterCategory('audio')} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${filterCategory === 'audio' ? 'bg-orange-600 text-white' : 'bg-orange-50 text-orange-700 hover:bg-orange-100'}`}><Music size={16}/> Áudios</button>
            </div>
            
            <div className="relative w-full md:w-64">
                <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
                <input 
                    type="text"
                    placeholder="Buscar arquivo..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                />
            </div>
        </div>

        {/* FOLDER VIEW FOR IMAGES */}
        {filterCategory === 'image' && !selectedFolder && !searchTerm && (
            <div className="space-y-4">
                <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                    <FolderOpen size={16}/> Campanhas
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                    {CAMPAIGNS.map(campaign => (
                        <div 
                            key={campaign}
                            onClick={() => setSelectedFolder(campaign)}
                            className="bg-purple-50 border-2 border-purple-100 hover:border-purple-300 rounded-xl p-4 cursor-pointer transition-all hover:-translate-y-1 group"
                        >
                            <Folder size={32} className="text-purple-400 group-hover:text-purple-600 mb-2 transition-colors" fill="currentColor" fillOpacity={0.2} />
                            <h4 className="font-bold text-purple-900 text-sm leading-tight">{campaign}</h4>
                            <span className="text-xs text-purple-500 mt-1 block">{getCampaignCount(campaign)} arquivos</span>
                        </div>
                    ))}
                </div>
            </div>
        )}

        {/* BREADCRUMB IF FOLDER SELECTED */}
        {filterCategory === 'image' && selectedFolder && (
            <div className="flex items-center gap-2 text-sm">
                <button onClick={() => setSelectedFolder(null)} className="text-gray-500 hover:text-purple-600 font-medium">Campanhas</button>
                <ChevronRight size={14} className="text-gray-400" />
                <span className="font-bold text-purple-800 bg-purple-50 px-2 py-0.5 rounded">{selectedFolder}</span>
            </div>
        )}

        {/* Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {(filterCategory === 'image' && !selectedFolder && !searchTerm) ? null : ( // Hide grid if showing folder list
                filteredItems.map(item => (
                    <div key={item.id} className="bg-white rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-all group overflow-hidden flex flex-col h-full animate-in fade-in zoom-in duration-300">
                        {/* Preview Area - UPDATED to allow Http links for images */}
                        <div className={`h-32 flex items-center justify-center relative ${getColor(item.category)} bg-opacity-20 overflow-hidden`}>
                            {item.category === 'image' && (item.url.startsWith('data:') || item.url.startsWith('http')) ? (
                                <img src={item.url} alt={item.title} className="w-full h-full object-cover" />
                            ) : (
                                <div className="transform group-hover:scale-110 transition-transform duration-300">
                                    {getIcon(item.category)}
                                </div>
                            )}
                            
                            {/* Overlay Actions */}
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                <button 
                                    onClick={() => handleDownload(item)}
                                    className="p-2 bg-white text-gray-800 rounded-full hover:scale-110 transition-transform"
                                    title="Baixar / Visualizar"
                                >
                                    {item.url.startsWith('data:') ? <Download size={20}/> : <ExternalLink size={20}/>}
                                </button>
                                {isAdmin && (
                                    <button 
                                        onClick={() => {
                                            if (window.confirm("Tem certeza que deseja excluir este arquivo?")) {
                                                onDelete(item.id);
                                                if (onLogAction) onLogAction('DELETE_FILE', `Excluiu arquivo: ${item.title}`);
                                            }
                                        }}
                                        className="p-2 bg-red-500 text-white rounded-full hover:scale-110 transition-transform"
                                        title="Excluir"
                                    >
                                        <Trash2 size={20}/>
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Content */}
                        <div className="p-4 flex-1 flex flex-col">
                            <div className="flex justify-between items-start mb-2">
                                <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${getColor(item.category)}`}>
                                    {item.category === 'spreadsheet' ? 'Planilha' : item.category === 'image' ? 'Imagem' : item.category === 'audio' ? 'Áudio' : 'Vídeo'}
                                </span>
                                <span className="text-[10px] text-gray-400">{item.size}</span>
                            </div>
                            <h3 className="font-bold text-gray-800 leading-tight mb-2 line-clamp-2" title={item.title}>
                                {item.title}
                            </h3>
                            <p className="text-xs text-gray-500 line-clamp-3 mb-4 flex-1">
                                {item.description || 'Sem descrição.'}
                            </p>
                            
                            {item.campaign && (
                                <div className="mb-2">
                                    <span className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full flex items-center gap-1 w-fit">
                                        <Folder size={10}/> {item.campaign}
                                    </span>
                                </div>
                            )}

                            <div className="pt-3 border-t border-gray-100 text-[10px] text-gray-400 flex justify-between">
                                <span>{new Date(item.createdAt).toLocaleDateString('pt-BR')}</span>
                                <span>Por: {item.createdBy.split(' ')[0]}</span>
                            </div>
                        </div>
                    </div>
                ))
            )}
        </div>

        {filteredItems.length === 0 && (selectedFolder || filterCategory !== 'image') && (
            <div className="text-center py-20 bg-gray-50 rounded-xl border border-dashed border-gray-300">
                <div className="inline-block p-4 bg-white rounded-full mb-3 shadow-sm text-gray-300">
                    <Download size={32} />
                </div>
                <h3 className="text-lg font-bold text-gray-600">Nenhum arquivo encontrado</h3>
                <p className="text-gray-400 text-sm">
                    {filterCategory === 'image' && selectedFolder ? `A pasta "${selectedFolder}" está vazia.` : 'Tente mudar o filtro ou adicione novos conteúdos.'}
                </p>
            </div>
        )}

        {/* Upload Modal */}
        {isModalOpen && (
            <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
                <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-in zoom-in duration-200 max-h-[90vh] overflow-y-auto">
                    <div className="bg-blue-600 p-6 flex justify-between items-center sticky top-0 z-10">
                        <h3 className="text-white font-bold text-xl flex items-center gap-2">
                            <Upload size={24} /> Adicionar Novo Arquivo
                        </h3>
                        <button onClick={() => setIsModalOpen(false)} className="text-blue-200 hover:text-white transition-colors">
                            <X size={20} />
                        </button>
                    </div>
                    
                    <form onSubmit={handleSubmit} className="p-6 space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Título do Arquivo</label>
                            <input 
                                required
                                value={newItem.title}
                                onChange={e => setNewItem({...newItem, title: e.target.value})}
                                className="w-full p-2.5 border border-gray-300 rounded-lg outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                                placeholder="Ex: Planilha de Metas 2024"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Categoria</label>
                            <div className="grid grid-cols-4 gap-2">
                                <button type="button" onClick={() => setNewItem({...newItem, category: 'spreadsheet'})} className={`py-2 rounded-lg text-xs font-bold border transition-all ${newItem.category === 'spreadsheet' ? 'bg-green-50 border-green-500 text-green-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>Planilha</button>
                                <button type="button" onClick={() => setNewItem({...newItem, category: 'video'})} className={`py-2 rounded-lg text-xs font-bold border transition-all ${newItem.category === 'video' ? 'bg-red-50 border-red-500 text-red-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>Vídeo</button>
                                <button type="button" onClick={() => setNewItem({...newItem, category: 'image'})} className={`py-2 rounded-lg text-xs font-bold border transition-all ${newItem.category === 'image' ? 'bg-purple-50 border-purple-500 text-purple-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>Imagem</button>
                                <button type="button" onClick={() => setNewItem({...newItem, category: 'audio'})} className={`py-2 rounded-lg text-xs font-bold border transition-all ${newItem.category === 'audio' ? 'bg-orange-50 border-orange-500 text-orange-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>Áudio</button>
                            </div>
                        </div>

                        {/* CAMPAIGN SELECTOR FOR IMAGES */}
                        {newItem.category === 'image' && (
                            <div className="bg-purple-50 p-3 rounded-lg border border-purple-100 animate-in fade-in slide-in-from-top-2">
                                <label className="block text-xs font-bold text-purple-800 uppercase mb-1">Campanha (Obrigatório)</label>
                                <select
                                    required
                                    value={newItem.campaign}
                                    onChange={e => setNewItem({...newItem, campaign: e.target.value})}
                                    className="w-full p-2.5 border border-purple-300 rounded-lg text-sm bg-white text-gray-900 focus:ring-2 focus:ring-purple-500 outline-none"
                                >
                                    <option value="">Selecione a pasta...</option>
                                    {CAMPAIGNS.map(c => (
                                        <option key={c} value={c}>{c}</option>
                                    ))}
                                </select>
                            </div>
                        )}

                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Descrição</label>
                            <textarea 
                                value={newItem.description}
                                onChange={e => setNewItem({...newItem, description: e.target.value})}
                                className="w-full p-2.5 border border-gray-300 rounded-lg outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 h-20 resize-none"
                                placeholder="Detalhes sobre o conteúdo..."
                            />
                        </div>

                        {/* File Upload Logic */}
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Arquivo ou Link</label>
                            
                            {newItem.category === 'video' ? (
                                <div>
                                    <input 
                                        type="url"
                                        value={newItem.url}
                                        onChange={e => setNewItem({...newItem, url: e.target.value, fileName: 'Link de Vídeo', size: 'Externo'})}
                                        className="w-full p-2.5 border border-gray-300 rounded-lg outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 mb-2"
                                        placeholder="Cole o link do YouTube/Drive aqui..."
                                    />
                                    <p className="text-[10px] text-gray-400">Para vídeos, recomendamos usar links externos (YouTube, Vimeo, Drive).</p>
                                </div>
                            ) : (
                                <div 
                                    onClick={() => fileInputRef.current?.click()}
                                    className={`border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center cursor-pointer transition-colors ${newItem.fileName ? 'border-green-400 bg-green-50' : 'border-gray-300 hover:bg-gray-50 hover:border-blue-400'}`}
                                >
                                    {newItem.fileName ? (
                                        <>
                                            <FileText className="text-green-600 mb-2" size={24} />
                                            <span className="text-sm font-bold text-green-800 break-all">{newItem.fileName}</span>
                                            <span className="text-xs text-green-600">{newItem.size}</span>
                                        </>
                                    ) : (
                                        <>
                                            <Upload className="text-gray-400 mb-2" size={24} />
                                            <span className="text-sm text-gray-600">Clique para selecionar arquivo</span>
                                            <span className="text-xs text-gray-400">(Max 5MB simulado)</span>
                                        </>
                                    )}
                                    <input 
                                        type="file" 
                                        ref={fileInputRef} 
                                        className="hidden" 
                                        accept={getAcceptType()}
                                        onChange={handleFileSelect}
                                    />
                                </div>
                            )}
                        </div>

                        <button 
                            type="submit"
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl shadow-md transition-colors mt-2"
                        >
                            Salvar Arquivo
                        </button>
                    </form>
                </div>
            </div>
        )}

    </div>
  );
};

export default DownloadsModule;
