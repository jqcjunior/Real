import React, { useState, useRef } from 'react';
import { Paperclip, Camera, Send, Loader2, Lock, Users, XCircle } from 'lucide-react';
import { AdminUser } from '../../types';

interface ChamadoMessageInputProps {
    onSend: (text: string) => Promise<void>;
    onFileUpload: (file: File) => Promise<void>;
    isSending: boolean;
    isAdmin: boolean;
    storeUsers: AdminUser[];
    selectedTargetUser: string | null;
    onSelectTargetUser: (userId: string | null) => void;
    mobileVariant?: boolean;
}

/**
 * Estado do texto digitado fica ISOLADO aqui — digitar não re-renderiza
 * a lista de mensagens nem o resto da tela (era a causa do travamento ao digitar).
 */
const ChamadoMessageInput: React.FC<ChamadoMessageInputProps> = ({
    onSend, onFileUpload, isSending, isAdmin, storeUsers, selectedTargetUser, onSelectTargetUser, mobileVariant
}) => {
    const [text, setText] = useState('');
    const [showTargetPicker, setShowTargetPicker] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleSubmit = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!text.trim() || isSending) return;
        const toSend = text;
        setText('');
        await onSend(toSend);
    };

    const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        await onFileUpload(file);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    return (
        <div className={mobileVariant ? "p-3 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 safe-bottom" : "p-4 sm:p-6 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"}>
            {isAdmin && selectedTargetUser && (
                <div className="mb-3 p-2 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-800 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Lock size={14} className="text-blue-600" />
                        <span className="text-[10px] font-black text-blue-600 uppercase">
                            Privada para: {storeUsers.find(u => u.id === selectedTargetUser)?.name}
                        </span>
                    </div>
                    <button onClick={() => onSelectTargetUser(null)} className="text-blue-400 hover:text-blue-600">
                        <XCircle size={16} />
                    </button>
                </div>
            )}

            <form onSubmit={handleSubmit} className="flex items-center gap-2 sm:gap-3">
                <input type="file" ref={fileInputRef} onChange={handleFile} className="hidden" accept="image/*,application/pdf" />
                <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="p-2.5 sm:p-3 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-xl hover:bg-blue-50 hover:text-blue-600 transition-all active:scale-95"
                >
                    <Paperclip size={20} />
                </button>
                {mobileVariant && (
                    <button
                        type="button"
                        onClick={() => {
                            if (fileInputRef.current) {
                                fileInputRef.current.setAttribute('capture', 'environment');
                                fileInputRef.current.click();
                            }
                        }}
                        className="p-2.5 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-xl hover:bg-blue-50 hover:text-blue-600 transition-all active:scale-95"
                    >
                        <Camera size={20} />
                    </button>
                )}
                {isAdmin && !mobileVariant && (
                    <button
                        type="button"
                        onClick={() => setShowTargetPicker(true)}
                        className={`p-3 rounded-xl transition-all active:scale-95 ${selectedTargetUser ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-blue-50 hover:text-blue-600'}`}
                        title="Enviar mensagem privada"
                    >
                        {selectedTargetUser ? <Lock size={20} /> : <Users size={20} />}
                    </button>
                )}
                <input
                    type="text"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder={selectedTargetUser ? "Mensagem privada..." : "Digite sua mensagem..."}
                    className="flex-1 px-4 py-2.5 sm:py-3 bg-slate-100 dark:bg-slate-800 border-none rounded-xl sm:rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                />
                <button
                    type="submit"
                    disabled={!text.trim() || isSending}
                    className="p-2.5 sm:p-3 bg-blue-600 text-white rounded-xl sm:rounded-2xl shadow-lg shadow-blue-900/20 hover:bg-blue-700 transition-all active:scale-95 disabled:opacity-50 disabled:scale-100"
                >
                    {isSending ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
                </button>
            </form>

            {showTargetPicker && isAdmin && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm" onClick={() => setShowTargetPicker(false)}>
                    <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[40px] shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
                        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                            <div>
                                <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase italic">Mensagem Privada</h3>
                                <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest">Selecione o Destinatário</p>
                            </div>
                            <button onClick={() => setShowTargetPicker(false)} className="p-2 bg-slate-100 dark:bg-slate-800 rounded-full text-slate-400 hover:text-rose-500 transition-all">
                                <XCircle size={20} />
                            </button>
                        </div>
                        <div className="p-6 space-y-2 max-h-96 overflow-y-auto">
                            <button
                                onClick={() => { onSelectTargetUser(null); setShowTargetPicker(false); }}
                                className={`w-full p-3 rounded-xl border transition-all ${!selectedTargetUser ? 'border-blue-500 bg-blue-50' : 'border-slate-100 hover:border-blue-200'}`}
                            >
                                <p className="text-sm font-black text-slate-700">Mensagem Pública (Todos veem)</p>
                            </button>
                            {storeUsers.map(u => (
                                <button
                                    key={u.id}
                                    onClick={() => { onSelectTargetUser(u.id); setShowTargetPicker(false); }}
                                    className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all ${selectedTargetUser === u.id ? 'border-blue-500 bg-blue-50' : 'border-slate-100 hover:border-blue-200'}`}
                                >
                                    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold">
                                        {u.name.substring(0, 2).toUpperCase()}
                                    </div>
                                    <div className="flex-1 text-left">
                                        <p className="text-sm font-black text-slate-700">{u.name}</p>
                                        <p className="text-xs font-bold text-slate-400 uppercase">{u.role_level}</p>
                                    </div>
                                    <Lock size={16} className="text-slate-400" />
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ChamadoMessageInput;
