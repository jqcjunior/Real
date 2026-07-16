import React from 'react';
import {
  LayoutDashboard,
  PieChart,
  Store,
  Tag,
  Package,
  ClipboardList,
  Target,
  Settings
} from 'lucide-react';

interface BuyOrderDashboardBarraProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const MENU_ITEMS = [
  { id: 'resumo', label: 'Resumo', icon: LayoutDashboard },
  { id: 'por_loja', label: 'Compras por Loja', icon: Store },
  { id: 'por_marca', label: 'Compras por Marca', icon: Tag },
  { id: 'modelos', label: 'Modelos', icon: Package },
  { id: 'relatorios', label: 'Relatórios', icon: ClipboardList },
  { id: 'meta_mix', label: 'Meta de Mix', icon: Target },
  { id: 'config', label: 'Configurações', icon: Settings },
];

export default function BuyOrderDashboardBarra({ activeTab, onTabChange }: BuyOrderDashboardBarraProps) {
  return (
    <div className="w-full md:w-64 bg-white dark:bg-slate-900 border-b md:border-b-0 md:border-r border-slate-200 dark:border-slate-800 flex-shrink-0 flex md:flex-col">
      {/* Menu Title / Branding - only on desktop */}
      <div className="hidden md:block p-6 border-b border-slate-200 dark:border-slate-800">
        <h2 className="text-xs font-black tracking-widest text-slate-400 dark:text-slate-500 uppercase">
          Menu de Navegação
        </h2>
      </div>

      {/* Navigation List */}
      <nav className="flex-1 p-2 md:p-4 flex md:flex-col overflow-x-auto md:overflow-x-visible md:overflow-y-auto gap-1 scrollbar-none whitespace-nowrap">
        {MENU_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              id={`tab-btn-${item.id}`}
              onClick={() => onTabChange(item.id)}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all border-b-4 md:border-b-0 md:border-l-4 flex-shrink-0 ${
                isActive
                  ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border-b-blue-600 md:border-b-transparent md:border-l-blue-600 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-950 dark:hover:text-slate-200 border-b-transparent md:border-l-transparent'
              }`}
            >
              <Icon size={16} className={isActive ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400'} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
