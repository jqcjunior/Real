import { IceCreamCategory } from '../../types';

export const PRODUCT_CATEGORIES: IceCreamCategory[] = [
    'Sundae', 'Milkshake', 'Casquinha', 'Cascão', 'Cascão Trufado', 
    'Copinho', 'Bebidas', 'Adicionais'
].sort() as IceCreamCategory[];

export const MONTHS = [
  { value: 1, label: 'Janeiro' }, { value: 2, label: 'Fevereiro' }, { value: 3, label: 'Março' },
  { value: 4, label: 'Abril' }, { value: 5, label: 'Maio' }, { value: 6, label: 'Junho' },
  { value: 7, label: 'Julho' }, { value: 8, label: 'Agosto' }, { value: 9, label: 'Setembro' },
  { value: 10, label: 'Outubro' }, { value: 11, label: 'Novembro' }, { value: 12, label: 'Dezembro' }
];

export const getCategoryIconEdit = (category: string, name: string = '') => {
    const itemName = (name || '').toLowerCase();
    if (category === 'Sundae') return 'https://img.icons8.com/color/144/ice-cream-bowl.png';
    if (['Casquinha', 'Cascão', 'Cascão Trufado'].includes(category)) return 'https://img.icons8.com/color/144/ice-cream-cone.png';
    if (category === 'Milkshake') return 'https://img.icons8.com/color/144/milkshake.png';
    if (category === 'Copinho') return 'https://img.icons8.com/color/144/ice-cream-bowl.png';
    if (category === 'Bebidas') return 'https://img.icons8.com/color/144/soda-bottle.png';
    if (category === 'Adicionais' || itemName.includes('nutella') || itemName.includes('chocolate')) return 'https://img.icons8.com/color/144/chocolate-spread.png';
    return 'https://img.icons8.com/color/144/ice-cream.png';
};
