import React, { useState } from 'react';
import { PackagePlus, Plus, Edit3, Trash, Info } from 'lucide-react';
import { formatCurrency } from '../../../constants';
import { getCategoryIconEdit } from '../constants';
import ProductModal from '../modals/ProductModal';
 
interface ProdutosTabProps {
    filteredItems: any[];
    onDeleteItem: (id: string) => Promise<void>;
    onSaveProduct: (product: any) => Promise<void>;
    stock: any[];
    effectiveStoreId: string;
    fetchData?: () => Promise<void>;
}
 
const ProdutosTab: React.FC<ProdutosTabProps> = ({
    filteredItems,
    onDeleteItem,
    onSaveProduct,
    stock,
    effectiveStoreId,
    fetchData
}) => {
    const [showProductModal, setShowProductModal] = useState(false);
    const [editingProduct, setEditingProduct] = useState<any>(null);
    const [productForm, setProductForm] = useState<any>({ 
        name: '', 
        category: 'Copinho', 
        price: 0, 
        active: true, 
        recipe: [] 
    });
 
    // ✅ FUNÇÃO COM LOGS DE DEBUG
    const handleNewProduct = () => {
        console.log('🆕 [ProdutosTab] Abrindo modal de novo produto');
        console.log('📊 [ProdutosTab] onSaveProduct está definido?', typeof onSaveProduct);
        console.log('🏪 [ProdutosTab] effectiveStoreId:', effectiveStoreId);
        console.log('📦 [ProdutosTab] Stock disponível:', stock.length);
        
        setEditingProduct(null);
        setProductForm({ 
            name: '', 
            category: 'Copinho', 
            price: 0, 
            active: true, 
            recipe: [] 
        });
        setShowProductModal(true);
    };
 
    const handleEditProduct = (item: any) => {
        console.log('✏️ [ProdutosTab] Editando produto:', item.name);
        setEditingProduct(item);
        setProductForm(item);
        setShowProductModal(true);
    };
 
    // ✅ NOVA FUNÇÃO: Wrapper com logs e tratamento de erro
    const handleSaveProduct = async (product: any) => {
        console.log('═══════════════════════════════════════════');
        console.log('🚀 [ProdutosTab] handleSaveProduct CHAMADO');
        console.log('📦 Dados recebidos:', product);
        console.log('🏪 Store ID:', effectiveStoreId);
        console.log('📝 É edição?', editingProduct ? 'SIM - ID: ' + editingProduct.id : 'NÃO - Novo produto');
        
        // Validação básica
        if (!product.name || !product.category || !product.price) {
            console.error('❌ [ProdutosTab] Dados incompletos!');
            alert('Preencha todos os campos obrigatórios!');
            return;
        }
 
        if (!effectiveStoreId) {
            console.error('❌ [ProdutosTab] Store ID não definido!');
            alert('Erro: Loja não identificada!');
            return;
        }
 
        try {
            console.log('⏳ [ProdutosTab] Chamando onSaveProduct...');
            
            // Chamar função original
            await onSaveProduct(product);
            
            console.log('✅ [ProdutosTab] onSaveProduct executado com sucesso!');
            
            // Fechar modal
            setShowProductModal(false);
            console.log('✅ [ProdutosTab] Modal fechado');
            
            // Recarregar dados
            if (fetchData) {
                console.log('🔄 [ProdutosTab] Recarregando dados...');
                await fetchData();
                console.log('✅ [ProdutosTab] Dados recarregados!');
            } else {
                console.warn('⚠️ [ProdutosTab] fetchData não está disponível');
            }
            
            console.log('═══════════════════════════════════════════');
            
        } catch (error: any) {
            console.error('═══════════════════════════════════════════');
            console.error('❌ [ProdutosTab] ERRO ao salvar produto');
            console.error('Erro:', error);
            console.error('Mensagem:', error?.message);
            console.error('Stack:', error?.stack);
            console.error('═══════════════════════════════════════════');
            
            alert('Erro ao salvar produto: ' + (error?.message || 'Erro desconhecido'));
        }
    };
 
    // ✅ LOG ao renderizar
    console.log('🎨 [ProdutosTab] Renderizando. Produtos:', filteredItems.length);
 
    return (
        <div className="p-4 md:p-8 space-y-6 animate-in fade-in duration-300 max-w-6xl mx-auto pb-20">
            <div className="bg-white p-8 rounded-[40px] shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between items-center gap-6">
                <div className="flex items-center gap-4">
                    <div className="p-4 bg-blue-50 text-blue-700 rounded-3xl"><PackagePlus size={32}/></div>
                    <div>
                        <h3 className="text-2xl font-black uppercase italic text-blue-950 tracking-tighter">Gestão de <span className="text-blue-700">Produtos</span></h3>
                        <p className="text-[10px] font-bold text-gray-400 uppercase mt-1">Configuração de preços e composição</p>
                    </div>
                </div>
                <button 
                    onClick={handleNewProduct} 
                    className="px-6 py-3 bg-gray-900 text-white rounded-xl font-black uppercase text-[10px] shadow-lg flex items-center gap-2 border-b-4 border-red-600 active:scale-95"
                >
                    <Plus size={16}/> Novo Produto
                </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredItems.map(item => (
                    <div key={item.id} className="bg-white p-6 rounded-[32px] shadow-sm border border-gray-100 group relative flex flex-col">
                        <div className="absolute top-4 right-4 flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                            <button onClick={() => handleEditProduct(item)} className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100"><Edit3 size={14}/></button>
                            <button onClick={() => onDeleteItem(item.id)} className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100"><Trash size={14}/></button>
                        </div>
                        <div className="w-16 h-16 bg-gray-50 rounded-2xl mb-4 flex items-center justify-center overflow-hidden shrink-0">
                            <img 
                                src={item.image_url || getCategoryIconEdit(item.category, item.name)} 
                                referrerPolicy="no-referrer" 
                                className="w-full h-full object-contain p-2" 
                                alt={item.name}
                            />
                        </div>
                        <h4 className="text-xs font-black text-blue-950 uppercase italic tracking-tighter mb-1 truncate pr-16">{item.name}</h4>
                        <p className="text-[9px] font-bold text-gray-400 uppercase mb-3">{item.category}</p>
                        <div className="mt-auto pt-3 border-t flex justify-between items-center">
                            <span className="text-lg font-black text-blue-900 italic">{formatCurrency(item.price)}</span>
                            <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase border ${item.active ? 'bg-green-50 text-green-700 border-green-100' : 'bg-red-50 text-red-700 border-red-100'}`}>
                                {item.active ? 'Ativo' : 'Inativo'}
                            </span>
                        </div>
                    </div>
                ))}
                {filteredItems.length === 0 && (
                    <div className="col-span-full py-20 text-center bg-gray-50 border-2 border-dashed border-gray-200 rounded-[32px]">
                        <Info className="mx-auto text-gray-300 mb-3" size={40}/>
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Nenhum produto encontrado</p>
                    </div>
                )}
            </div>
 
            <ProductModal 
                isOpen={showProductModal}
                onClose={() => {
                    console.log('❌ [ProdutosTab] Fechando modal sem salvar');
                    setShowProductModal(false);
                }}
                editingProduct={editingProduct}
                form={productForm}
                setForm={setProductForm}
                onSave={handleSaveProduct}  {/* ← AGORA USA A FUNÇÃO COM LOGS */}
                stock={stock}
                effectiveStoreId={effectiveStoreId}
                fetchData={fetchData}
            />
        </div>
    );
};
 
export default ProdutosTab;