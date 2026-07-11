import React from 'react';
import { Lock, Image as ImageIcon, File as FileIcon, Download } from 'lucide-react';
import { format } from 'date-fns';
import { DemandMessageV2 } from '../../types';

interface ChamadoMessageBubbleProps {
    msg: DemandMessageV2;
    isMe: boolean;
}

const ChamadoMessageBubble: React.FC<ChamadoMessageBubbleProps> = ({ msg, isMe }) => {
    const isSystem = msg.message_type === 'status_change' || msg.message_type === 'assignment';

    if (isSystem) {
        return (
            <div className="flex justify-center">
                <div className="px-4 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-full border border-slate-200 dark:border-slate-700">
                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{msg.message}</p>
                </div>
            </div>
        );
    }

    return (
        <div className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] sm:max-w-[70%] flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                <div className="flex items-center gap-2 mb-1 px-1">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{msg.sender_name}</span>
                    <span className="text-[8px] font-bold text-slate-300">{format(new Date(msg.created_at), 'HH:mm')}</span>
                    {/* @ts-ignore */}
                    {msg.is_private && <Lock size={10} className="text-slate-400" />}
                </div>
                <div className={`p-4 rounded-2xl shadow-sm ${isMe ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white rounded-tl-none border border-slate-200 dark:border-slate-700'}`}>
                    <p className="text-xs font-medium leading-relaxed">{msg.message}</p>
                    {msg.attachments && msg.attachments.length > 0 && (
                        <div className="mt-3 space-y-2">
                            {msg.attachments.map(att => (
                                <a
                                    key={att.id}
                                    href={att.file_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className={`flex items-center gap-3 p-2 rounded-xl border transition-all ${isMe ? 'bg-blue-700/50 border-blue-500/30 hover:bg-blue-700' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 hover:border-blue-500'}`}
                                >
                                    <div className={`p-2 rounded-lg ${isMe ? 'bg-blue-500' : 'bg-blue-50 dark:bg-blue-900/30 text-blue-600'}`}>
                                        {att.file_type.startsWith('image/') ? <ImageIcon size={16} /> : <FileIcon size={16} />}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className={`text-[10px] font-black uppercase truncate ${isMe ? 'text-white' : 'text-slate-700 dark:text-slate-300'}`}>{att.file_name}</p>
                                        <p className={`text-[8px] font-bold ${isMe ? 'text-blue-200' : 'text-slate-400'}`}>{(att.file_size / 1024).toFixed(0)} KB {att.is_compressed && '• Comprimido'}</p>
                                    </div>
                                    <Download size={14} className={isMe ? 'text-blue-200' : 'text-slate-400'} />
                                </a>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default React.memo(ChamadoMessageBubble);
