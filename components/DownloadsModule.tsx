
import React, { useState, useRef, useMemo } from 'react';
import { DownloadItem, DownloadCategory, User, UserRole } from '../types';
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
}

const DownloadsModule: React.FC<DownloadsModuleProps> = ({ user, items, onUpload, onDelete }) => {
  const [filterCategory, setFilterCategory] = useState<'all' | 'spreadsheet' | 'media'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  const isAdmin = user?.role === UserRole.ADMIN;

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6 md:space-y-8 animate-in fade-in duration-500">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="text-center md:text-left">
                <h2 className="text-3xl md:text-4xl font-black text-gray-900 uppercase italic tracking-tighter leading-none flex items-center justify-center md:justify-start gap-4">
                    <Download className="text-blue-600" size={32} /> Central de <span className="text-red-600">Downloads</span>
                </h2>
                <p className="text-gray-400 font-bold text-[9px] md:text-[10px] uppercase tracking-widest mt-2">Documentos e Mídias Corporativas</p>
            </div>
            {isAdmin && (
                <button onClick={() => setIsModalOpen(true)} className="w-full md:w-auto bg-gray-950 text-white px-8 py-4 rounded-[24px] font-black uppercase text-xs shadow-xl active:scale-95 flex items-center justify-center gap-3 border-b-4 border-blue-600">
                    <Plus size={20} /> Adicionar
                </button>
            )}
        </div>

        {/* Grade de Materiais - Responsiva */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
            {(items || []).map(item => (
                <div key={item.id} className="bg-white rounded-[32px] shadow-sm border border-gray-100 overflow-hidden flex flex-col group hover:shadow-xl transition-all duration-300">
                    <div className="h-32 md:h-40 bg-gray-50 flex items-center justify-center relative overflow-hidden">
                        <div className="absolute inset-0 opacity-5 group-hover:scale-110 transition-transform duration-500 flex items-center justify-center">
                            {item.category === 'spreadsheet' ? <FileSpreadsheet size={100}/> : <ImageIcon size={100}/>}
                        </div>
                        <div className="z-10 p-4 bg-white rounded-2xl shadow-lg border border-gray-100 text-blue-600">
                            {item.category === 'spreadsheet' ? <FileSpreadsheet size={24}/> : <ImageIcon size={24}/>}
                        </div>
                        <div className="absolute inset-0 bg-gray-950/60 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center gap-2 backdrop-blur-[2px]">
                            <button className="px-5 py-2 bg-white text-gray-950 rounded-xl font-black uppercase text-[10px] shadow-xl flex items-center gap-2 active:scale-95 transition-all"><Download size={14}/> Baixar</button>
                        </div>
                    </div>
                    <div className="p-5 flex-1 flex flex-col">
                        <h4 className="font-black text-gray-900 uppercase italic text-[11px] md:text-xs truncate">{item.title}</h4>
                        <p className="text-[9px] text-gray-400 mt-2 line-clamp-2 leading-relaxed">{item.description || 'Material oficial Real Calçados.'}</p>
                    </div>
                </div>
            ))}
        </div>
    </div>
  );
};

export default DownloadsModule;
