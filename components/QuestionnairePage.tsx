
import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { Questionnaire, QuestionnaireProduct } from '../types';
import { Star, Loader2, CheckCircle, AlertCircle, Package, ArrowLeft } from 'lucide-react';

interface QuestionnairePageProps {
    questionnaireId: string;
    userId: string;
    onBack?: () => void;
    onSuccess?: () => void;
}

interface AnswerState {
    product_id: string;
    rating: number;
    suggested_quantity: number;
    comment: string;
}

const QuestionnairePage: React.FC<QuestionnairePageProps> = ({ questionnaireId, userId, onBack, onSuccess }) => {
    const [questionnaire, setQuestionnaire] = useState<Questionnaire | null>(null);
    const [products, setProducts] = useState<QuestionnaireProduct[]>([]);
    const [answers, setAnswers] = useState<Record<string, AnswerState>>({});
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');

    useEffect(() => {
        const loadData = async () => {
            setIsLoading(true);
            try {
                const [qRes, pRes] = await Promise.all([
                    supabase.from('questionnaires').select('*').eq('id', questionnaireId).single(),
                    supabase.from('questionnaire_products').select('*').eq('questionnaire_id', questionnaireId)
                ]);

                if (qRes.error) throw qRes.error;
                if (pRes.error) throw pRes.error;

                setQuestionnaire(qRes.data);
                setProducts(pRes.data || []);

                // Initialize answers state
                const initialAnswers: Record<string, AnswerState> = {};
                (pRes.data || []).forEach(p => {
                    initialAnswers[p.id] = {
                        product_id: p.id,
                        rating: 0,
                        suggested_quantity: 0,
                        comment: ''
                    };
                });
                setAnswers(initialAnswers);
            } catch (error) {
                console.error('Error loading questionnaire:', error);
                setSubmitStatus('error');
            } finally {
                setIsLoading(false);
            }
        };

        if (questionnaireId) {
            loadData();
        }
    }, [questionnaireId]);

    const handleRatingChange = (productId: string, rating: number) => {
        setAnswers(prev => ({
            ...prev,
            [productId]: { ...prev[productId], rating }
        }));
    };

    const handleQtyChange = (productId: string, qty: number) => {
        setAnswers(prev => ({
            ...prev,
            [productId]: { ...prev[productId], suggested_quantity: qty }
        }));
    };

    const handleCommentChange = (productId: string, comment: string) => {
        setAnswers(prev => ({
            ...prev,
            [productId]: { ...prev[productId], comment }
        }));
    };

    const handleSubmit = async () => {
        // Validation: check if all products have a rating
        const unanswered = products.filter(p => answers[p.id].rating === 0);
        if (unanswered.length > 0) {
            alert(`Por favor, avalie todos os produtos antes de enviar. (${unanswered.length} pendentes)`);
            return;
        }

        setIsSubmitting(true);
        setSubmitStatus('idle');

        try {
            const bulkAnswers = (Object.values(answers) as AnswerState[]).map(ans => ({
                questionnaire_id: questionnaireId,
                product_id: ans.product_id,
                user_id: userId,
                rating: ans.rating,
                suggested_quantity: ans.suggested_quantity,
                comment: ans.comment
            }));

            const { error } = await supabase
                .from('questionnaire_answers')
                .insert(bulkAnswers);

            if (error) throw error;

            setSubmitStatus('success');
            if (onSuccess) {
                setTimeout(onSuccess, 2000);
            }
        } catch (error) {
            console.error('Error submitting answers:', error);
            setSubmitStatus('error');
            alert("Erro ao enviar respostas. Tente novamente.");
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-4">
                <Loader2 className="animate-spin text-blue-600 mb-4" size={48} />
                <p className="text-sm font-black uppercase text-gray-400 tracking-widest">Carregando formulário...</p>
            </div>
        );
    }

    if (submitStatus === 'success') {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-4 animate-in fade-in zoom-in duration-500">
                <div className="bg-white p-12 rounded-[40px] shadow-xl text-center max-w-md w-full border border-green-100">
                    <div className="w-20 h-20 bg-green-50 text-green-500 rounded-full flex items-center justify-center mx-auto mb-6">
                        <CheckCircle size={48} />
                    </div>
                    <h2 className="text-2xl font-black text-blue-950 uppercase italic tracking-tighter mb-2">Enviado com Sucesso!</h2>
                    <p className="text-gray-500 text-sm font-medium mb-8">Suas avaliações foram registradas e serão analisadas pelo setor de compras.</p>
                    {onBack && (
                        <button 
                            onClick={onBack}
                            className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black uppercase text-xs shadow-lg border-b-4 border-blue-800 active:scale-95 transition-all"
                        >
                            Voltar ao Início
                        </button>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#f0ebf8] pb-20 font-sans">
            {/* Top Banner (Optional, but Google Forms often has a header image or color) */}
            <div className="h-3 w-full bg-purple-700 sticky top-0 z-50"></div>

            <div className="max-w-3xl mx-auto px-4 pt-4 space-y-4">
                {/* Header Card (Title & Description) */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                    <div className="h-2.5 w-full bg-purple-700"></div>
                    <div className="p-6 md:p-8">
                        <div className="flex justify-between items-start mb-4">
                            <h1 className="text-3xl font-normal text-gray-900 leading-tight">
                                {questionnaire?.title || 'Questionário'}
                            </h1>
                            {onBack && (
                                <button onClick={onBack} className="p-2 text-gray-500 hover:bg-gray-100 rounded-full transition-colors">
                                    <ArrowLeft size={20} />
                                </button>
                            )}
                        </div>
                        <div className="h-px w-full bg-gray-200 mb-4"></div>
                        <p className="text-sm text-gray-700 whitespace-pre-wrap">
                            {questionnaire?.description || 'Por favor, preencha as avaliações abaixo para cada produto.'}
                        </p>
                        <div className="mt-6 pt-4 border-t border-gray-100 flex items-center gap-2 text-red-600 text-xs font-medium">
                            * Indica uma pergunta obrigatória
                        </div>
                    </div>
                </div>

                {/* Products List */}
                <div className="space-y-4">
                    {products.map((product, index) => (
                        <div 
                            key={product.id} 
                            className="bg-white p-6 md:p-8 rounded-lg shadow-sm border border-gray-200 animate-in fade-in slide-in-from-bottom-4 duration-500" 
                            style={{ animationDelay: `${index * 100}ms` }}
                        >
                            <div className="flex flex-col md:flex-row gap-8">
                                {/* Product Info & Image */}
                                <div className="w-full md:w-48 shrink-0">
                                    <div className="aspect-square bg-gray-50 rounded-lg flex items-center justify-center p-4 mb-4 border border-gray-100">
                                        <img 
                                            src={product.one_drive_image_url} 
                                            alt={product.product_name} 
                                            className="max-w-full max-h-full object-contain"
                                            referrerPolicy="no-referrer"
                                            onError={(e) => {
                                                (e.target as HTMLImageElement).src = `https://picsum.photos/seed/${product.id}/400/400`;
                                            }}
                                        />
                                    </div>
                                    <h4 className="text-lg font-medium text-gray-900 mb-1">
                                        {product.product_name} <span className="text-red-600">*</span>
                                    </h4>
                                    <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">
                                        {product.brand} • {product.category}
                                    </p>
                                </div>

                                {/* Form Inputs */}
                                <div className="flex-1 space-y-8">
                                    {/* Rating Section */}
                                    <div className="space-y-4">
                                        <label className="text-base text-gray-900 font-normal">
                                            Qual sua nota para este produto?
                                        </label>
                                        <div className="flex flex-wrap gap-3">
                                            {[1, 2, 3, 4, 5].map(star => (
                                                <button 
                                                    key={star}
                                                    onClick={() => handleRatingChange(product.id, star)}
                                                    className={`group relative flex flex-col items-center gap-2 p-2 transition-all`}
                                                >
                                                    <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${answers[product.id]?.rating === star ? 'bg-purple-100 text-purple-700 ring-2 ring-purple-700' : 'bg-gray-50 text-gray-400 hover:bg-gray-100'}`}>
                                                        <Star size={24} fill={answers[product.id]?.rating >= star ? 'currentColor' : 'none'} className={answers[product.id]?.rating >= star ? 'text-yellow-500' : ''} />
                                                    </div>
                                                    <span className={`text-xs font-medium ${answers[product.id]?.rating === star ? 'text-purple-700' : 'text-gray-500'}`}>{star}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Quantity Section */}
                                    <div className="space-y-2">
                                        <label className="text-base text-gray-900 font-normal">
                                            Quantidade Sugerida (Pares)
                                        </label>
                                        <div className="relative group max-w-xs">
                                            <input 
                                                type="number"
                                                value={answers[product.id]?.suggested_quantity || ''}
                                                onChange={e => handleQtyChange(product.id, parseInt(e.target.value) || 0)}
                                                className="w-full py-2 bg-transparent text-gray-900 text-base outline-none border-b border-gray-300 focus:border-b-2 focus:border-purple-700 transition-all placeholder:text-gray-400"
                                                placeholder="Sua resposta"
                                            />
                                        </div>
                                    </div>

                                    {/* Comment Section */}
                                    <div className="space-y-2">
                                        <label className="text-base text-gray-900 font-normal">
                                            Comentário ou Observação
                                        </label>
                                        <div className="relative group">
                                            <textarea 
                                                value={answers[product.id]?.comment || ''}
                                                onChange={e => handleCommentChange(product.id, e.target.value)}
                                                className="w-full py-2 bg-transparent text-gray-900 text-base outline-none border-b border-gray-300 focus:border-b-2 focus:border-purple-700 transition-all placeholder:text-gray-400 min-h-[40px] resize-none"
                                                placeholder="Sua resposta"
                                                rows={1}
                                                onInput={(e) => {
                                                    const target = e.target as HTMLTextAreaElement;
                                                    target.style.height = 'auto';
                                                    target.style.height = target.scrollHeight + 'px';
                                                }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Footer Actions */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-6 pt-4">
                    <button 
                        onClick={handleSubmit}
                        disabled={isSubmitting}
                        className="w-full sm:w-auto px-8 py-2.5 bg-purple-700 text-white rounded font-medium text-sm shadow hover:bg-purple-800 active:bg-purple-900 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {isSubmitting ? (
                            <>
                                <Loader2 className="animate-spin" size={18} />
                                Enviando...
                            </>
                        ) : (
                            'Enviar'
                        )}
                    </button>
                    
                    <div className="flex items-center gap-4">
                        <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div 
                                className="h-full bg-purple-700 transition-all duration-500" 
                                style={{ width: `${((Object.values(answers) as AnswerState[]).filter(a => a.rating > 0).length / products.length) * 100}%` }}
                            ></div>
                        </div>
                        <span className="text-xs text-gray-500 font-medium uppercase tracking-wider">
                            Página 1 de 1
                        </span>
                    </div>
                </div>

                <div className="text-center pt-8 pb-12">
                    <p className="text-[11px] text-gray-500">
                        Este formulário foi criado em Real Admin.
                    </p>
                    <p className="text-[11px] font-bold text-gray-600 mt-1 uppercase tracking-widest">
                        Google Forms Style
                    </p>
                </div>
            </div>
        </div>
    );
};

export default QuestionnairePage;
