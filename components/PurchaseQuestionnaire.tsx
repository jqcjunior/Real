
import React, { useState, useEffect, useMemo } from 'react';
import { Questionnaire, QuestionnaireProduct, QuestionnaireAnswer, User, AdminUser, Store } from '../types';
import { supabase } from '../services/supabaseClient';
import { 
    Plus, Trash2, Edit3, CheckCircle2, XCircle, Star, 
    MessageSquare, Package, Tag, Image as ImageIcon, 
    ChevronRight, ArrowLeft, Save, Loader2, BarChart3,
    Users, Eye, Send
} from 'lucide-react';
import { formatCurrency } from '../constants';

interface PurchaseQuestionnaireProps {
    user: User;
    stores: Store[];
    adminUsers: AdminUser[];
    can: (perm: string) => boolean;
}

const PurchaseQuestionnaire: React.FC<PurchaseQuestionnaireProps> = ({ user, stores, adminUsers, can }) => {
    const [questionnaires, setQuestionnaires] = useState<Questionnaire[]>([]);
    const [products, setProducts] = useState<QuestionnaireProduct[]>([]);
    const [answers, setAnswers] = useState<QuestionnaireAnswer[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [view, setView] = useState<'list' | 'create' | 'answer' | 'report' | 'edit'>('list');
    const [selectedQuestionnaire, setSelectedQuestionnaire] = useState<Questionnaire | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Form states
    const [qId, setQId] = useState<string | null>(null);
    const [qTitle, setQTitle] = useState('');
    const [qDesc, setQDesc] = useState('');
    const [qProducts, setQProducts] = useState<Partial<QuestionnaireProduct>[]>([]);

    const isAdmin = user.role === 'ADMIN';

    const fetchAllData = async () => {
        setIsLoading(true);
        try {
            const [qRes, pRes, aRes] = await Promise.all([
                supabase.from('questionnaires').select('*').order('created_at', { ascending: false }),
                supabase.from('questionnaire_products').select('*'),
                supabase.from('questionnaire_answers').select('*')
            ]);

            if (qRes.data) setQuestionnaires(qRes.data);
            if (pRes.data) setProducts(pRes.data);
            if (aRes.data) setAnswers(aRes.data);
        } catch (error) {
            console.error('Error fetching questionnaire data:', error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchAllData();
    }, []);

    const handleCreateQuestionnaire = async () => {
        if (!qTitle || qProducts.length === 0) {
            alert("Preencha o título e adicione pelo menos um produto.");
            return;
        }

        setIsSubmitting(true);
        try {
            let questionnaireId = qId;

            if (qId) {
                // Update existing
                const { error: qError } = await supabase
                    .from('questionnaires')
                    .update({
                        title: qTitle.toUpperCase(),
                        description: qDesc,
                        is_active: true
                    })
                    .eq('id', qId);

                if (qError) throw qError;

                // Delete old products and insert new ones (simplest way to handle updates)
                await supabase.from('questionnaire_products').delete().eq('questionnaire_id', qId);
            } else {
                // Create new
                const { data: qData, error: qError } = await supabase
                    .from('questionnaires')
                    .insert([{
                        title: qTitle.toUpperCase(),
                        description: qDesc,
                        created_by: user.id,
                        is_active: true
                    }])
                    .select()
                    .single();

                if (qError) throw qError;
                questionnaireId = qData.id;
            }

            const productsToInsert = qProducts.map(p => ({
                questionnaire_id: questionnaireId,
                product_name: p.product_name?.toUpperCase(),
                brand: p.brand?.toUpperCase(),
                category: p.category?.toUpperCase(),
                one_drive_image_url: p.one_drive_image_url
            }));

            const { error: pError } = await supabase
                .from('questionnaire_products')
                .insert(productsToInsert);

            if (pError) throw pError;

            alert(qId ? "Questionário atualizado com sucesso!" : "Questionário criado com sucesso!");
            setQId(null);
            setQTitle('');
            setQDesc('');
            setQProducts([]);
            setView('list');
            fetchAllData();
        } catch (error: any) {
            alert("Erro ao salvar questionário: " + error.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleEditQuestionnaire = (q: Questionnaire) => {
        const qProds = products.filter(p => p.questionnaire_id === q.id);
        setQId(q.id);
        setQTitle(q.title);
        setQDesc(q.description || '');
        setQProducts(qProds.map(p => ({
            product_name: p.product_name,
            brand: p.brand,
            category: p.category,
            one_drive_image_url: p.one_drive_image_url
        })));
        setView('edit');
    };

    const handleToggleActive = async (id: string, currentStatus: boolean) => {
        try {
            await supabase.from('questionnaires').update({ is_active: !currentStatus }).eq('id', id);
            fetchAllData();
        } catch (error) {
            console.error('Error toggling status:', error);
        }
    };

    const handleDeleteQuestionnaire = async (id: string) => {
        if (!confirm("Deseja realmente excluir este questionário e todos os seus dados?")) return;
        try {
            await supabase.from('questionnaires').delete().eq('id', id);
            fetchAllData();
        } catch (error) {
            console.error('Error deleting questionnaire:', error);
        }
    };

    const handleSaveAnswer = async (productId: string, rating: number, qty: number, comment: string) => {
        if (!selectedQuestionnaire) return;
        
        try {
            const { error } = await supabase
                .from('questionnaire_answers')
                .upsert({
                    questionnaire_id: selectedQuestionnaire.id,
                    product_id: productId,
                    user_id: user.id,
                    rating,
                    suggested_quantity: qty,
                    comment
                }, { onConflict: 'questionnaire_id,product_id,user_id' });

            if (error) throw error;
            fetchAllData();
        } catch (error: any) {
            alert("Erro ao salvar resposta: " + error.message);
        }
    };

    const questionnaireStats = useMemo(() => {
        if (!selectedQuestionnaire) return null;
        const qProducts = products.filter(p => p.questionnaire_id === selectedQuestionnaire.id);
        const qAnswers = answers.filter(a => a.questionnaire_id === selectedQuestionnaire.id);
        
        return qProducts.map(p => {
            const productAnswers = qAnswers.filter(a => a.product_id === p.id);
            const avgRating = productAnswers.length > 0 
                ? productAnswers.reduce((acc, curr) => acc + curr.rating, 0) / productAnswers.length 
                : 0;
            const totalQty = productAnswers.reduce((acc, curr) => acc + curr.suggested_quantity, 0);
            
            return {
                ...p,
                avgRating,
                totalQty,
                responsesCount: productAnswers.length,
                comments: productAnswers.filter(a => a.comment).map(a => ({
                    user: adminUsers.find(u => u.id === a.user_id)?.name || 'Anônimo',
                    text: a.comment,
                    rating: a.rating,
                    qty: a.suggested_quantity
                }))
            };
        });
    }, [selectedQuestionnaire, products, answers, adminUsers]);

    if (isLoading) return (
        <div className="flex flex-col items-center justify-center h-64 gap-4">
            <Loader2 className="animate-spin text-blue-600" size={48} />
            <p className="text-xs font-black uppercase text-gray-400 animate-pulse">Carregando Questionários...</p>
        </div>
    );

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {view === 'list' && (
                <div className="space-y-6">
                    <div className="flex justify-between items-center bg-white p-6 rounded-[32px] shadow-sm border border-gray-100">
                        <div>
                            <h3 className="text-xl font-black uppercase italic text-blue-950 flex items-center gap-3">
                                <Package className="text-blue-600" /> Questionários de <span className="text-blue-600">Compras</span>
                            </h3>
                            <p className="text-[10px] font-bold text-gray-400 uppercase mt-1">Avaliação de produtos para novos pedidos</p>
                        </div>
                        {isAdmin && (
                            <button 
                                onClick={() => setView('create')}
                                className="px-6 py-3 bg-blue-600 text-white rounded-xl font-black uppercase text-[10px] shadow-lg flex items-center gap-2 border-b-4 border-blue-800 active:scale-95 transition-all"
                            >
                                <Plus size={16} /> Novo Questionário
                            </button>
                        )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {questionnaires.map(q => {
                            const qProducts = products.filter(p => p.questionnaire_id === q.id);
                            const qAnswers = answers.filter(a => a.questionnaire_id === q.id);
                            const uniqueResponders = new Set(qAnswers.map(a => a.user_id)).size;
                            
                            return (
                                <div key={q.id} className={`bg-white p-6 rounded-[40px] shadow-sm border border-gray-100 flex flex-col group transition-all hover:shadow-xl ${!q.is_active ? 'opacity-60' : ''}`}>
                                    <div className="flex justify-between items-start mb-4">
                                        <div className={`px-3 py-1 rounded-full text-[8px] font-black uppercase border ${q.is_active ? 'bg-green-50 text-green-700 border-green-100' : 'bg-red-50 text-red-700 border-red-100'}`}>
                                            {q.is_active ? 'Ativo' : 'Inativo'}
                                        </div>
                                        {isAdmin && (
                                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                                                <button onClick={() => handleEditQuestionnaire(q)} className="p-2 text-gray-400 hover:text-blue-600"><Edit3 size={16}/></button>
                                                <button onClick={() => handleToggleActive(q.id, q.is_active)} className="p-2 text-gray-400 hover:text-blue-600"><CheckCircle2 size={16}/></button>
                                                <button onClick={() => handleDeleteQuestionnaire(q.id)} className="p-2 text-gray-400 hover:text-red-600"><Trash2 size={16}/></button>
                                            </div>
                                        )}
                                    </div>

                                    <h4 className="text-lg font-black text-blue-950 uppercase italic tracking-tighter mb-2">{q.title}</h4>
                                    <p className="text-[10px] text-gray-500 font-medium mb-6 line-clamp-2">{q.description}</p>

                                    <div className="grid grid-cols-2 gap-4 mb-8">
                                        <div className="p-3 bg-gray-50 rounded-2xl border border-gray-100">
                                            <p className="text-[8px] font-black text-gray-400 uppercase">Produtos</p>
                                            <p className="text-xl font-black text-blue-900 italic">{qProducts.length}</p>
                                        </div>
                                        <div className="p-3 bg-gray-50 rounded-2xl border border-gray-100">
                                            <p className="text-[8px] font-black text-gray-400 uppercase">Respostas</p>
                                            <p className="text-xl font-black text-orange-600 italic">{uniqueResponders}</p>
                                        </div>
                                    </div>

                                    <div className="mt-auto pt-4 border-t flex gap-2">
                                        {isAdmin ? (
                                            <button 
                                                onClick={() => { setSelectedQuestionnaire(q); setView('report'); }}
                                                className="flex-1 py-3 bg-gray-100 text-gray-600 rounded-xl font-black uppercase text-[9px] hover:bg-gray-200 transition-all flex items-center justify-center gap-2"
                                            >
                                                <BarChart3 size={14} /> Ver Relatório
                                            </button>
                                        ) : (
                                            q.is_active && (
                                                <button 
                                                    onClick={() => { setSelectedQuestionnaire(q); setView('answer'); }}
                                                    className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-black uppercase text-[9px] shadow-lg hover:bg-blue-700 transition-all flex items-center justify-center gap-2"
                                                >
                                                    <Send size={14} /> Responder
                                                </button>
                                            )
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                        {questionnaires.length === 0 && (
                            <div className="col-span-full py-20 text-center bg-white rounded-[40px] border-2 border-dashed border-gray-100">
                                <Package className="mx-auto text-gray-200 mb-4" size={48} />
                                <p className="text-xs font-black uppercase text-gray-400 italic">Nenhum questionário disponível</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {(view === 'create' || view === 'edit') && (
                <div className="max-w-4xl mx-auto space-y-6">
                    <div className="bg-white p-8 rounded-[40px] shadow-sm border border-gray-100">
                        <div className="flex items-center gap-4 mb-8">
                            <button onClick={() => { setView('list'); setQId(null); setQTitle(''); setQDesc(''); setQProducts([]); }} className="p-3 bg-gray-50 text-gray-400 rounded-2xl hover:text-blue-600"><ArrowLeft size={20}/></button>
                            <h3 className="text-2xl font-black uppercase italic text-blue-950">{view === 'edit' ? 'Editar' : 'Novo'} <span className="text-blue-600">Questionário</span></h3>
                        </div>

                        <div className="space-y-6">
                            <div className="grid grid-cols-1 gap-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-gray-400 uppercase ml-4">Título da Pesquisa</label>
                                    <input 
                                        value={qTitle}
                                        onChange={e => setQTitle(e.target.value)}
                                        className="w-full p-4 bg-gray-50 rounded-2xl font-black uppercase text-xs outline-none border-2 border-transparent focus:border-blue-600 transition-all"
                                        placeholder="EX: LANÇAMENTOS INVERNO 2026..."
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-gray-400 uppercase ml-4">Descrição / Instruções</label>
                                    <textarea 
                                        value={qDesc}
                                        onChange={e => setQDesc(e.target.value)}
                                        className="w-full p-4 bg-gray-50 rounded-2xl font-bold text-xs outline-none border-2 border-transparent focus:border-blue-600 transition-all min-h-[100px]"
                                        placeholder="Explique o objetivo da pesquisa para os gerentes..."
                                    />
                                </div>
                            </div>

                            <div className="pt-8 border-t">
                                <div className="flex justify-between items-center mb-6">
                                    <h4 className="text-xs font-black uppercase italic text-blue-950">Produtos na Pesquisa</h4>
                                    <button 
                                        onClick={() => setQProducts([...qProducts, { product_name: '', brand: '', category: '', one_drive_image_url: '' }])}
                                        className="p-2 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 transition-all"
                                    >
                                        <Plus size={20} />
                                    </button>
                                </div>

                                <div className="space-y-4">
                                    {qProducts.map((p, idx) => (
                                        <div key={idx} className="p-6 bg-gray-50 rounded-3xl border border-gray-100 space-y-4 relative group">
                                            <button 
                                                onClick={() => setQProducts(qProducts.filter((_, i) => i !== idx))}
                                                className="absolute top-4 right-4 text-gray-300 hover:text-red-600 transition-all"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                <div className="space-y-1">
                                                    <label className="text-[8px] font-black text-gray-400 uppercase ml-2">Nome do Produto</label>
                                                    <input 
                                                        value={p.product_name}
                                                        onChange={e => {
                                                            const newProducts = [...qProducts];
                                                            newProducts[idx].product_name = e.target.value;
                                                            setQProducts(newProducts);
                                                        }}
                                                        className="w-full p-3 bg-white rounded-xl font-black uppercase text-[10px] outline-none"
                                                        placeholder="NOME..."
                                                    />
                                                </div>
                                                <div className="space-y-1">
                                                    <label className="text-[8px] font-black text-gray-400 uppercase ml-2">Marca</label>
                                                    <input 
                                                        value={p.brand}
                                                        onChange={e => {
                                                            const newProducts = [...qProducts];
                                                            newProducts[idx].brand = e.target.value;
                                                            setQProducts(newProducts);
                                                        }}
                                                        className="w-full p-3 bg-white rounded-xl font-black uppercase text-[10px] outline-none"
                                                        placeholder="MARCA..."
                                                    />
                                                </div>
                                                <div className="space-y-1">
                                                    <label className="text-[8px] font-black text-gray-400 uppercase ml-2">Categoria</label>
                                                    <input 
                                                        value={p.category}
                                                        onChange={e => {
                                                            const newProducts = [...qProducts];
                                                            newProducts[idx].category = e.target.value;
                                                            setQProducts(newProducts);
                                                        }}
                                                        className="w-full p-3 bg-white rounded-xl font-black uppercase text-[10px] outline-none"
                                                        placeholder="CATEGORIA..."
                                                    />
                                                </div>
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-[8px] font-black text-gray-400 uppercase ml-2">URL da Imagem (OneDrive)</label>
                                                <div className="flex gap-2">
                                                    <div className="p-3 bg-white rounded-xl text-gray-300"><ImageIcon size={16}/></div>
                                                    <input 
                                                        value={p.one_drive_image_url}
                                                        onChange={e => {
                                                            const newProducts = [...qProducts];
                                                            newProducts[idx].one_drive_image_url = e.target.value;
                                                            setQProducts(newProducts);
                                                        }}
                                                        className="flex-1 p-3 bg-white rounded-xl font-medium text-[10px] outline-none"
                                                        placeholder="https://onedrive.live.com/embed?..."
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                    {qProducts.length === 0 && (
                                        <div className="py-10 text-center bg-gray-50 rounded-3xl border-2 border-dashed border-gray-200">
                                            <p className="text-[10px] font-black uppercase text-gray-400 italic">Clique no + para adicionar produtos</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="pt-8">
                                <button 
                                    onClick={handleCreateQuestionnaire}
                                    disabled={isSubmitting}
                                    className="w-full py-5 bg-blue-600 text-white rounded-2xl font-black uppercase text-xs shadow-xl flex items-center justify-center gap-3 border-b-4 border-blue-800 active:scale-95 transition-all disabled:opacity-50"
                                >
                                    {isSubmitting ? <Loader2 className="animate-spin" size={20}/> : <Save size={20}/>}
                                    Salvar Questionário
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {view === 'answer' && selectedQuestionnaire && (
                <div className="max-w-4xl mx-auto space-y-6">
                    <div className="bg-white p-8 rounded-[40px] shadow-sm border border-gray-100">
                        <div className="flex items-center gap-4 mb-8">
                            <button onClick={() => setView('list')} className="p-3 bg-gray-50 text-gray-400 rounded-2xl hover:text-blue-600"><ArrowLeft size={20}/></button>
                            <div>
                                <h3 className="text-2xl font-black uppercase italic text-blue-950">{selectedQuestionnaire.title}</h3>
                                <p className="text-[10px] font-bold text-gray-400 uppercase mt-1">{selectedQuestionnaire.description}</p>
                            </div>
                        </div>

                        <div className="space-y-8">
                            {products.filter(p => p.questionnaire_id === selectedQuestionnaire.id).map(p => {
                                const existingAnswer = answers.find(a => a.product_id === p.id && a.user_id === user.id);
                                return (
                                    <ProductAnswerCard 
                                        key={p.id} 
                                        product={p} 
                                        existingAnswer={existingAnswer}
                                        onSave={(rating, qty, comment) => handleSaveAnswer(p.id, rating, qty, comment)}
                                    />
                                );
                            })}
                        </div>

                        <div className="pt-10 flex justify-center">
                            <button 
                                onClick={() => setView('list')}
                                className="px-10 py-4 bg-gray-950 text-white rounded-2xl font-black uppercase text-xs shadow-xl border-b-4 border-blue-600 active:scale-95 transition-all"
                            >
                                Finalizar Avaliação
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {view === 'report' && selectedQuestionnaire && questionnaireStats && (
                <div className="max-w-6xl mx-auto space-y-6">
                    <div className="bg-white p-8 rounded-[40px] shadow-sm border border-gray-100">
                        <div className="flex items-center justify-between mb-8">
                            <div className="flex items-center gap-4">
                                <button onClick={() => setView('list')} className="p-3 bg-gray-50 text-gray-400 rounded-2xl hover:text-blue-600"><ArrowLeft size={20}/></button>
                                <div>
                                    <h3 className="text-2xl font-black uppercase italic text-blue-950">Relatório: <span className="text-blue-600">{selectedQuestionnaire.title}</span></h3>
                                    <p className="text-[10px] font-bold text-gray-400 uppercase mt-1">Análise consolidada das avaliações dos gerentes</p>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 gap-8">
                            {questionnaireStats.map(p => (
                                <div key={p.id} className="bg-gray-50 rounded-[40px] border border-gray-100 overflow-hidden flex flex-col md:flex-row">
                                    <div className="w-full md:w-64 h-64 bg-white p-4 flex items-center justify-center border-r border-gray-100 shrink-0">
                                        <img 
                                            src={p.one_drive_image_url} 
                                            alt={p.product_name} 
                                            className="max-w-full max-h-full object-contain"
                                            referrerPolicy="no-referrer"
                                            onError={(e) => {
                                                (e.target as HTMLImageElement).src = 'https://picsum.photos/seed/product/400/400';
                                            }}
                                        />
                                    </div>
                                    <div className="flex-1 p-8 space-y-6">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <h4 className="text-xl font-black text-blue-950 uppercase italic tracking-tighter">{p.product_name}</h4>
                                                <p className="text-[10px] font-bold text-gray-400 uppercase">{p.brand} | {p.category}</p>
                                            </div>
                                            <div className="text-right">
                                                <div className="flex items-center gap-1 justify-end text-yellow-500 mb-1">
                                                    <Star size={20} fill="currentColor" />
                                                    <span className="text-2xl font-black italic">{p.avgRating.toFixed(1)}</span>
                                                </div>
                                                <p className="text-[8px] font-black text-gray-400 uppercase">{p.responsesCount} Avaliações</p>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="p-4 bg-white rounded-2xl border border-gray-100">
                                                <p className="text-[9px] font-black text-gray-400 uppercase mb-1">Quant. Sugerida Total</p>
                                                <p className="text-2xl font-black text-blue-900 italic">{p.totalQty} <span className="text-[10px] not-italic text-gray-400">Pares</span></p>
                                            </div>
                                            <div className="p-4 bg-white rounded-2xl border border-gray-100">
                                                <p className="text-[9px] font-black text-gray-400 uppercase mb-1">Média por Loja</p>
                                                <p className="text-2xl font-black text-orange-600 italic">{(p.totalQty / (p.responsesCount || 1)).toFixed(1)}</p>
                                            </div>
                                        </div>

                                        <div className="space-y-3">
                                            <h5 className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                                <MessageSquare size={14} /> Comentários dos Gerentes
                                            </h5>
                                            <div className="space-y-2 max-h-40 overflow-y-auto no-scrollbar">
                                                {p.comments.map((c, idx) => (
                                                    <div key={idx} className="p-4 bg-white rounded-2xl border border-gray-100">
                                                        <div className="flex justify-between items-baseline mb-2">
                                                            <span className="text-[9px] font-black text-blue-950 uppercase italic">{c.user}</span>
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-[8px] font-bold text-gray-400 uppercase">Qtd: {c.qty}</span>
                                                                <div className="flex items-center gap-0.5 text-yellow-500">
                                                                    <Star size={10} fill="currentColor" />
                                                                    <span className="text-[10px] font-black">{c.rating}</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <p className="text-[10px] text-gray-600 font-medium italic">"{c.text}"</p>
                                                    </div>
                                                ))}
                                                {p.comments.length === 0 && (
                                                    <p className="text-[10px] text-gray-400 italic text-center py-4">Nenhum comentário registrado</p>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

interface ProductAnswerCardProps {
    product: QuestionnaireProduct;
    existingAnswer?: QuestionnaireAnswer;
    onSave: (rating: number, qty: number, comment: string) => Promise<void>;
}

const ProductAnswerCard: React.FC<ProductAnswerCardProps> = ({ product, existingAnswer, onSave }) => {
    const [rating, setRating] = useState(existingAnswer?.rating || 0);
    const [qty, setQty] = useState<string>(existingAnswer?.suggested_quantity.toString() || '');
    const [comment, setComment] = useState(existingAnswer?.comment || '');
    const [isSaving, setIsSaving] = useState(false);
    const [hasChanged, setHasChanged] = useState(false);

    const handleSave = async () => {
        if (rating === 0) {
            alert("Por favor, selecione uma nota de 1 a 5.");
            return;
        }
        setIsSaving(true);
        try {
            await onSave(rating, parseInt(qty) || 0, comment);
            setHasChanged(false);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="bg-gray-50 rounded-[40px] border border-gray-100 overflow-hidden flex flex-col md:flex-row transition-all hover:shadow-md">
            <div className="w-full md:w-64 h-64 bg-white p-4 flex items-center justify-center border-r border-gray-100 shrink-0">
                <img 
                    src={product.one_drive_image_url} 
                    alt={product.product_name} 
                    className="max-w-full max-h-full object-contain"
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                        (e.target as HTMLImageElement).src = 'https://picsum.photos/seed/product/400/400';
                    }}
                />
            </div>
            <div className="flex-1 p-8 space-y-6">
                <div>
                    <h4 className="text-xl font-black text-blue-950 uppercase italic tracking-tighter">{product.product_name}</h4>
                    <p className="text-[10px] font-bold text-gray-400 uppercase">{product.brand} | {product.category}</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-3">
                        <label className="text-[10px] font-black text-gray-400 uppercase ml-2">Sua Avaliação (1 a 5)</label>
                        <div className="flex gap-2">
                            {[1, 2, 3, 4, 5].map(star => (
                                <button 
                                    key={star}
                                    onClick={() => { setRating(star); setHasChanged(true); }}
                                    className={`p-3 rounded-2xl transition-all ${rating >= star ? 'bg-yellow-100 text-yellow-600' : 'bg-white text-gray-200 hover:text-gray-300'}`}
                                >
                                    <Star size={24} fill={rating >= star ? 'currentColor' : 'none'} />
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="space-y-3">
                        <label className="text-[10px] font-black text-gray-400 uppercase ml-2">Qtd Sugerida (Pares)</label>
                        <input 
                            type="number"
                            value={qty}
                            onChange={e => { setQty(e.target.value); setHasChanged(true); }}
                            className="w-full p-4 bg-white rounded-2xl font-black text-lg outline-none border-2 border-transparent focus:border-blue-600 transition-all"
                            placeholder="0"
                        />
                    </div>
                </div>

                <div className="space-y-3">
                    <label className="text-[10px] font-black text-gray-400 uppercase ml-2">Comentário / Observação</label>
                    <textarea 
                        value={comment}
                        onChange={e => { setComment(e.target.value); setHasChanged(true); }}
                        className="w-full p-4 bg-white rounded-2xl font-bold text-xs outline-none border-2 border-transparent focus:border-blue-600 transition-all min-h-[80px]"
                        placeholder="O que você achou deste produto? Vale a pena comprar?"
                    />
                </div>

                <div className="flex justify-end">
                    <button 
                        onClick={handleSave}
                        disabled={!hasChanged || isSaving}
                        className={`px-8 py-3 rounded-xl font-black uppercase text-[10px] shadow-lg flex items-center gap-2 transition-all active:scale-95 ${hasChanged ? 'bg-blue-600 text-white border-b-4 border-blue-800' : 'bg-gray-200 text-gray-400 cursor-default'}`}
                    >
                        {isSaving ? <Loader2 className="animate-spin" size={16}/> : <Save size={16}/>}
                        {existingAnswer ? 'Atualizar Avaliação' : 'Salvar Avaliação'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PurchaseQuestionnaire;
