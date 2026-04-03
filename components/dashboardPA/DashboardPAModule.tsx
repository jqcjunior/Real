import React from 'react';
import { User, UserRole, Store } from '../../types';
import DashboardPAAdmin from './DashboardPAAdmin';
import DashboardPAGerente from './DashboardPAGerente';
 
interface DashboardPAModuleProps {
  user: User;
  stores: Store[];
  onRefresh: () => Promise<void>;
}
 
const DashboardPAModule: React.FC<DashboardPAModuleProps> = ({ 
  user, 
  stores,
  onRefresh
}) => {
  const isAdmin = user.role === UserRole.ADMIN;
  const userStore = stores.find(s => s.id === user.storeId);
 
  if (isAdmin) {
    return (
      <DashboardPAAdmin 
        user={user}
        stores={stores}
        onRefresh={onRefresh}
      />
    );
  }
 
  if (userStore) {
    return <DashboardPAGerente user={user} store={userStore} />;
  }
 
  return (
    <div className="flex items-center justify-center h-screen bg-slate-50 dark:bg-slate-950">
      <div className="text-center space-y-4">
        <div className="p-6 rounded-[32px] bg-red-500/10 text-red-500 inline-block">
          <span className="font-black italic uppercase tracking-tighter text-2xl">Acesso Negado</span>
        </div>
        <p className="text-slate-500 dark:text-slate-400 font-black italic uppercase tracking-tighter text-sm">
          Você não possui uma loja vinculada ao seu usuário.
        </p>
      </div>
    </div>
  );
};
 
export default DashboardPAModule;