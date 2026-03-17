
import React, { useState } from 'react';
import { X, Lock, Save, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { supabase } from '../services/supabaseClient';
import { User } from '../types';

interface ChangePasswordModalProps {
    user: User;
    onClose: () => void;
}

const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({ user, onClose }) => {
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (newPassword !== confirmPassword) {
            setError('As senhas não coincidem.');
            return;
        }

        if (newPassword.length < 6) {
            setError('A nova senha deve ter pelo menos 6 caracteres.');
            return;
        }

        setIsLoading(true);

        try {
            // Verify current password first
            const { data: userCheck, error: checkError } = await supabase
                .from('admin_users')
                .select('password')
                .eq('id', user.id)
                .single();

            if (checkError || !userCheck) {
                throw new Error('Erro ao verificar usuário.');
            }

            if (userCheck.password !== currentPassword) {
                setError('Senha atual incorreta.');
                setIsLoading(false);
                return;
            }

            // Update password
            const { error: updateError } = await supabase
                .from('admin_users')
                .update({ password: newPassword })
                .eq('id', user.id);

            if (updateError) throw updateError;

            setSuccess(true);
            setTimeout(() => {
                onClose();
            }, 2000);
        } catch (err: any) {
            setError(err.message || 'Erro ao atualizar senha.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[200] p-4">
            <div className="bg-white rounded-[40px] w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in duration-300 border border-white/20">
                <div className="p-8 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
                    <div>
                        <h2 className="text-2xl font-black text-gray-900 uppercase italic tracking-tighter">Alterar <span className="text-red-600">Senha</span></h2>
                        <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mt-1">Segurança da sua conta</p>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-red-600 bg-white p-2 rounded-full shadow-sm border border-gray-100 transition-all">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-8">
                    {success ? (
                        <div className="flex flex-col items-center justify-center py-10 space-y-4 animate-in fade-in zoom-in duration-500">
                            <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center shadow-inner">
                                <CheckCircle2 size={48} />
                            </div>
                            <h3 className="text-xl font-black text-gray-900 uppercase italic tracking-tighter">Senha Atualizada!</h3>
                            <p className="text-sm font-bold text-gray-500 text-center">Sua nova senha foi salva com sucesso.</p>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-6">
                            {error && (
                                <div className="bg-red-50 text-red-600 text-[10px] p-4 rounded-2xl flex items-center gap-3 border border-red-100 font-black uppercase">
                                    <AlertCircle size={16} />
                                    {error}
                                </div>
                            )}

                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-gray-700 uppercase ml-2 tracking-widest">Senha Atual</label>
                                <div className="relative">
                                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                                    <input 
                                        required 
                                        type="password" 
                                        value={currentPassword} 
                                        onChange={e => setCurrentPassword(e.target.value)} 
                                        className="w-full pl-12 pr-4 py-3.5 bg-gray-50 rounded-2xl text-sm font-bold text-gray-900 border border-gray-200 focus:border-blue-500 focus:bg-white outline-none transition-all placeholder-gray-400" 
                                        placeholder="••••••••"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-gray-700 uppercase ml-2 tracking-widest">Nova Senha</label>
                                <div className="relative">
                                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                                    <input 
                                        required 
                                        type="password" 
                                        value={newPassword} 
                                        onChange={e => setNewPassword(e.target.value)} 
                                        className="w-full pl-12 pr-4 py-3.5 bg-gray-50 rounded-2xl text-sm font-bold text-gray-900 border border-gray-200 focus:border-blue-500 focus:bg-white outline-none transition-all placeholder-gray-400" 
                                        placeholder="••••••••"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-gray-700 uppercase ml-2 tracking-widest">Confirmar Nova Senha</label>
                                <div className="relative">
                                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                                    <input 
                                        required 
                                        type="password" 
                                        value={confirmPassword} 
                                        onChange={e => setConfirmPassword(e.target.value)} 
                                        className="w-full pl-12 pr-4 py-3.5 bg-gray-50 rounded-2xl text-sm font-bold text-gray-900 border border-gray-200 focus:border-blue-500 focus:bg-white outline-none transition-all placeholder-gray-400" 
                                        placeholder="••••••••"
                                    />
                                </div>
                            </div>

                            <button 
                                type="submit" 
                                disabled={isLoading} 
                                className="w-full py-5 bg-blue-900 text-white rounded-[24px] font-black uppercase text-xs shadow-xl active:scale-95 transition-all flex items-center justify-center gap-3 mt-4 border-b-4 border-blue-950 hover:bg-black disabled:opacity-50"
                            >
                                {isLoading ? <Loader2 className="animate-spin" size={20}/> : <Save size={20}/>} Atualizar Senha
                            </button>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ChangePasswordModal;
