// components/ProductGrid.tsx
import React from 'react';
import { formatCurrency } from '../constants';

// Lógica de imagens trazida para cá para ficar independente
const getCategoryImage = (category: string, name: string) => {
    const itemName = name.toLowerCase();
    if (['Sundae', 'Casquinha', 'Cascão', 'Cascão Trufado'].includes(category)) {
        return 'https://img.icons8.com/color/144/ice-cream-cone.png';
    }
    if (itemName.includes('nutella') || itemName.includes('calda') || itemName.includes('chocolate')) {
        return 'https://img.icons8.com/color/144/chocolate-spread.png';
    }
    if (itemName.includes('água') || itemName.includes('agua')) {
        return 'https://img.icons8.com/color/144/water-bottle.png';
    }
    const icons: Record<string, string> = {
        'Milkshake': 'https://img.icons8.com/color/144/milkshake.png',
        'Copinho': 'https://img.icons8.com/color/144/ice-cream-bowl.png',
        'Bebidas': 'https://img.icons8.com/color/144/natural-food.png',
        'Adicionais': 'https://img.icons8.com/color/144/sugar-bowl.png'
    };
    return icons[category] || 'https://img.icons8.com/color/144/ice-cream.png';
};

interface ProductGridProps {
    items: any[];
    selectedCategory: string | null;
    onAddToCart: (item: any) => void;
}

export const ProductGrid: React.FC<ProductGridProps> = ({ items, selectedCategory, onAddToCart }) => {
    // Filtra os itens aqui para limpar o código da tela principal
    const displayItems = items.filter(i => (!selectedCategory || i.category === selectedCategory) && i.active);

    return (
        // AQUI ESTÁ A MÁGICA DA RESPONSIVIDADE (2 colunas no celular -> até 7 em telas gigantes)
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-3 overflow-y-auto no-scrollbar pr-2 pb-10 content-start">
            {displayItems.map(item => (
                <button 
                    key={item.id} 
                    onClick={() => onAddToCart(item)} 
                    className="bg-white p-2 rounded-2xl border border-gray-100 hover:border-blue-600 hover:shadow-md transition-all flex flex-col items-center text-center group shadow-sm h-full min-h-[140px]"
                >
                    <div className="w-full aspect-square bg-gray-50 rounded-xl mb-2 flex items-center justify-center overflow-hidden relative">
                        <img 
                            src={item.image_url || getCategoryImage(item.category, item.name)} 
                            className="w-full h-full object-contain p-1 transition-transform duration-300 group-hover:scale-110" 
                            alt={item.name}
                            onError={(e) => {
                                (e.target as HTMLImageElement).src = 'https://img.icons8.com/color/144/ice-cream.png';
                            }}
                        />
                    </div>
                    
                    <div className="flex flex-col justify-between flex-1 w-full">
                        <h4 className="font-black text-gray-900 uppercase text-[9px] leading-tight line-clamp-2 min-h-[2.5em] flex items-center justify-center">
                            {item.name}
                        </h4>
                        <p className="text-sm font-black text-blue-900 italic leading-none mt-1">
                            {formatCurrency(item.price)}
                        </p>
                    </div>
                </button>
            ))}
        </div>
    );
};