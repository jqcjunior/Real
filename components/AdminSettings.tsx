
import React, { useState, useMemo, useRef } from 'react';
import { Store, UserRole } from '../types';
import { Plus, Edit, Trash2, Save, X, Store as StoreIcon, User, MapPin, Phone, Mail, AlertTriangle, Lock, CheckCircle, XCircle, Power, Shield, User as UserIcon, Wallet, ChevronDown, ChevronRight, Upload, FileSpreadsheet, Loader2, IceCream } from 'lucide-react';
import * as XLSX from 'xlsx';

interface AdminSettingsProps {
  stores: Store[];
  onAddStore: (store: Store) => Promise<void>;
  onUpdateStore: (store: Store) => Promise<void>;
  onDeleteStore: (id: string) => Promise<void>;
  onImportStores?: (stores: Store[]) => Promise<void>;
}

const BRAZIL_STATES = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 
  'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
];

const AdminSettings: React.FC<AdminSettingsProps> = ({ stores, onAddStore, onUpdateStore, onDeleteStore, onImportStores }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStore, setEditingStore] = useState<Partial<Store>>({});
  const [isEditing, setIsEditing] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const [storeToDelete, setStoreToDelete] = useState<Store | null>(null);
  const [cityInput, setCityInput] = useState('');
  const [ufInput, setUfInput] = useState('BA'); 

  const [expandedStores, setExpandedStores] = useState<Set<string>>(new Set());

  const pendingStores = useMemo(() => stores.filter(s => s.status === 'pending'), [stores]);
  
  const groupedStores = useMemo(() => {
    const mainStores = stores.filter(s => s.status === 'active' || s.status === 'inactive' || (!s.status));
    const groups: Record<string, { manager?: Store, cashiers: Store[] }> = {};
    
    mainStores.forEach(s => {
        const num = s.number || '0';
        if (!groups[num]) groups[num] = { cashiers: [] };
        if (s.role === UserRole.MANAGER || s.role === UserRole.ADMIN) {
            if (!groups[num].manager) {
                groups[num].manager = s;
            } else {
                groups[num].cashiers.push(s);
            }
        } else {
            groups[num].cashiers.push(s);
        }
    });

    Object.keys(groups).forEach(num => {
        if (!groups[num].manager && groups[num].cashiers.length > 0) {
            groups[num].manager = groups[num].cashiers.shift();
        }
    });

    return Object.entries(groups).sort((a, b) => {
        const numA = parseInt(a[0].replace(/\D/g, ''), 10) || 0;
        const numB = parseInt(b[0].replace(/\D/g, ''), 10) || 0;
        return numA - numB;
    });
  }, [stores]);

  const toggleExpand = (storeNum: string) => {
      const newSet = new Set(expandedStores);
      if (newSet.has(storeNum)) newSet.delete(storeNum);
      else newSet.add(storeNum);
      setExpandedStores(newSet);
  };

  const handleEdit = (store: Store) => {
    setEditingStore({ ...store });
    if (store.city && store.city.includes(' - ')) {
      const parts = store.city.split(' - ');
      setCityInput(parts[0]);
      setUfInput(parts[1]);
    } else {
      setCityInput(store.city || '');
      setUfInput('BA'); 
    }
    setIsEditing(true);
    setIsModalOpen(true);
  };

  const handleAdd = () => {
    setEditingStore({
      number: '',
      name: '',
      managerName: '',
      managerEmail: '',
      managerPhone: '',
      password: '', 
      status: 'active',
      role: UserRole.MANAGER
    });
    setCityInput('');
    setUfInput('BA'); 
    setIsEditing(false);
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);
    const fullCity = `${cityInput} - ${ufInput}`;
    const cleanNumber = editingStore.number ? String(parseInt(editingStore.number.replace(/\D/g, ''), 10)) : '';
    
    const storeData: any = { ...editingStore, city: fullCity, number: cleanNumber };
    
    if (!storeData.password) delete storeData.password;

    try {
        if (isEditing && editingStore.id) {
          await onUpdateStore(storeData as Store);
        } else {
          await onAddStore({ ...storeData } as Store);
        }
        setIsModalOpen(false);
    } catch (err) {
        console.error(err);
    } finally {
        setIsProcessing(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setEditingStore({ ...editingStore, [e.target.name]: e.target.value });
  };

  const toggleStatus = async (store: Store) => {
      const newStatus = store.status === 'active' ? 'inactive' : 'active';
      await onUpdateStore({ ...store, status: newStatus });
  };

  const cycleRole = async (store: Store) => {
      const currentRole = store.role || UserRole.MANAGER;
      let newRole: UserRole;
      if (currentRole === UserRole.MANAGER) newRole = UserRole.ADMIN;
      else if (currentRole === UserRole.ADMIN) newRole = UserRole.CASHIER;
      else if (currentRole === UserRole.CASHIER) newRole = UserRole.ICE_CREAM;
      else newRole = UserRole.MANAGER;
      await onUpdateStore({ ...store, role: newRole });
  };

  const renderStoreRow = (store: Store, isChild: boolean = false, hasChildren: boolean = false, expanded: boolean = false) => {
      const isActive = store.status === 'active';
      const isAdmin = store.role === UserRole.ADMIN;
      const isCashier = store.role === UserRole.CASHIER;
      const isIceCream = store.role === UserRole.ICE_CREAM;

      return (
        <tr key={store.id} className={`transition-colors border-b border-gray-100 ${isActive ? 'hover:bg-gray-50' : 'bg-gray-50/50 grayscale opacity-70 hover:opacity-100'} ${isChild ? 'bg-gray-50/30' : ''}`}>
            <td className="p-4 pl-4">
                <button onClick={() => toggleStatus(store)} className={`w-10 h-6 flex items-center rounded-full p-1 duration-300 cursor-pointer ${isActive ? 'bg-green-500 justify-end' : 'bg-gray-300 justify-start'}`}>
                    <div className="bg-white w-4 h-4 rounded-full shadow-md transform"></div>
                </button>
            </td>
            <td className="p-4 text-gray-500 font-mono font-bold">
                {isChild ? '' : (store.number || '-')}
            </td>
            <td className="p-4">
                <div className={`flex items-center gap-2 ${isChild ? 'pl-8' : ''}`}>
                    {hasChildren && !isChild && (
                        <button onClick={() => toggleExpand(store.number)} className="p-1 rounded hover:bg-gray-200 text-gray-500 transition-colors">
                            {expanded ? <ChevronDown size={16}/> : <ChevronRight size={16}/>}
                        </button>
                    )}
                    {!hasChildren && !isChild && <div className="w-6"></div>}
                    {isChild && <div className="w-4 h-px bg-gray-300 mr-2"></div>}
                    <div>
                        <div className="font-medium text-gray-900">{store.name}</div>
                        <div className="text-xs text-gray-500">{store.city}</div>
                    </div>
                </div>
            </td>
            <td className="p-4">
                    <div className="text-gray-900 font-medium">{store.managerName}</div>
                    <div className="text-xs text-gray-500">{store.managerEmail}</div>
            </td>
            <td className="p-4 text-center">
                <button onClick={() => cycleRole(store)} className={`p-2 rounded-lg transition-colors border shadow-sm flex items-center gap-2 mx-auto min-w-[120px] justify-center ${
                    isAdmin ? 'bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-200' : 
                    isCashier ? 'bg-green-100 text-green-700 border-green-200 hover:bg-green-200' : 
                    isIceCream ? 'bg-purple-100 text-purple-700 border-purple-200 hover:bg-purple-200' :
                    'bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-200'
                }`}>
                    {isAdmin && <><Shield size={16} /> ADMIN</>}
                    {isCashier && <><Wallet size={16} /> CAIXA</>}
                    {isIceCream && <><IceCream size={16} /> SORVETE</>}
                    {!isAdmin && !isCashier && !isIceCream && <><UserIcon size={16} /> GERENTE</>}
                </button>
            </td>
            <td className="p-4 text-right">
                <div className="flex justify-end gap-2">
                    <button onClick={() => handleEdit(store)} className="p-2 text-blue-600 hover:bg-blue-50 rounded transition-colors"><Edit size={18} /></button>
                    <button onClick={() => setStoreToDelete(store)} className="p-2 text-red-400 hover:bg-red-50 rounded transition-colors"><Trash2 size={18} /></button>
                </div>
            </td>
        </tr>
      );
  };

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      {pendingStores.length > 0 && (
          <div className="bg-yellow-50 border-2 border-yellow-200 rounded-xl overflow-hidden shadow-sm p-4">
              <h3 className="text-lg font-bold text-yellow-800 mb-2 flex items-center gap-2"><AlertTriangle size={20}/> Solicitações Pendentes</h3>
              {pendingStores.map(s => <div key={s.id} className="p-2 border-b last:border-0 flex justify-between items-center text-sm font-medium text-gray-700">{s.name} - {s.managerName} <button onClick={() => handleEdit(s)} className="text-blue-600 font-bold">Gerenciar</button></div>)}
          </div>
      )}

      <div className="flex justify-between items-center">
          <h2 className="text-3xl font-bold text-gray-800 tracking-tight">Lojas e Gerentes</h2>
          <button onClick={handleAdd} className="bg-gray-900 text-white px-6 py-3 rounded-xl flex items-center gap-2 hover:bg-black font-black uppercase text-xs tracking-widest border-b-4 border-red-600"><Plus size={16} /> Novo Cadastro</button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead className="bg-gray-50 text-gray-600 text-[10px] font-black uppercase tracking-widest border-b">
                <tr><th className="p-4">Status</th><th className="p-4">Nº</th><th className="p-4">Unidade</th><th className="p-4">Responsável</th><th className="p-4 text-center">Acesso</th><th className="p-4 text-right">Ações</th></tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm">
                {groupedStores.map(([num, group]) => {
                    const manager = group.manager;
                    const cashiers = group.cashiers;
                    const isExpanded = expandedStores.has(num);
                    const rows = [];
                    if (manager) rows.push(renderStoreRow(manager, false, cashiers.length > 0, isExpanded));
                    if (isExpanded || !manager) cashiers.forEach(cashier => rows.push(renderStoreRow(cashier, true, false, false)));
                    return rows;
                })}
            </tbody>
          </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[100] p-4 backdrop-blur-md">
          <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-xl max-h-[95vh] overflow-hidden animate-in fade-in zoom-in duration-300 border border-gray-200 flex flex-col">
            <div className="bg-gray-100/50 p-6 md:p-8 border-b flex justify-between items-center shrink-0">
                <div>
                    <h3 className="text-2xl font-black text-gray-900 uppercase italic tracking-tighter">
                        {isEditing ? 'Editar' : 'Nova'} <span className="text-red-600">Unidade</span>
                    </h3>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1">Configuração de Credenciais e Localização</p>
                </div>
                <button onClick={() => setIsModalOpen(false)} className="bg-white p-2 rounded-full text-gray-400 hover:text-red-600 shadow-sm border border-gray-100 transition-all"><X size={24} /></button>
            </div>
            
            <div className="overflow-y-auto no-scrollbar flex-1">
                <form onSubmit={handleSave} className="p-6 md:p-10 space-y-6">
                    <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-1.5">
                            <label className="block text-[10px] font-black text-blue-900 uppercase ml-2 tracking-widest">Nº Loja</label>
                            <input required name="number" value={editingStore.number || ''} onChange={handleChange} className="w-full p-4 bg-gray-50 border-2 border-gray-200 rounded-2xl focus:border-blue-600 focus:bg-white outline-none transition-all font-bold text-gray-900 shadow-sm" placeholder="Ex: 01" />
                        </div>
                        <div className="space-y-1.5">
                            <label className="block text-[10px] font-black text-blue-900 uppercase ml-2 tracking-widest">Identificação</label>
                            <input required name="name" value={editingStore.name || ''} onChange={handleChange} className="w-full p-4 bg-gray-50 border-2 border-gray-200 rounded-2xl focus:border-blue-600 focus:bg-white outline-none transition-all font-bold text-gray-900 shadow-sm" placeholder="Ex: Loja Centro" />
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-6">
                        <div className="col-span-2 space-y-1.5">
                            <label className="block text-[10px] font-black text-blue-900 uppercase ml-2 tracking-widest">Cidade</label>
                            <input required value={cityInput} onChange={e => setCityInput(e.target.value)} className="w-full p-4 bg-gray-50 border-2 border-gray-200 rounded-2xl focus:border-blue-600 focus:bg-white outline-none transition-all font-bold text-gray-900 shadow-sm" placeholder="Nome da cidade" />
                        </div>
                        <div className="space-y-1.5">
                            <label className="block text-[10px] font-black text-blue-900 uppercase ml-2 tracking-widest">UF</label>
                            <select value={ufInput} onChange={e => setUfInput(e.target.value)} className="w-full p-4 bg-gray-50 border-2 border-gray-200 rounded-2xl focus:border-blue-600 focus:bg-white outline-none transition-all font-bold text-gray-900 shadow-sm cursor-pointer">
                                {BRAZIL_STATES.map(u => <option key={u} value={u}>{u}</option>)}
                            </select>
                        </div>
                    </div>

                    <div className="border-t border-gray-100 pt-6 space-y-6">
                        <div className="space-y-1.5">
                            <label className="block text-[10px] font-black text-blue-900 uppercase ml-2 tracking-widest">Nome Responsável</label>
                            <input required name="managerName" value={editingStore.managerName || ''} onChange={handleChange} className="w-full p-4 bg-gray-50 border-2 border-gray-200 rounded-2xl focus:border-blue-600 focus:bg-white outline-none transition-all font-bold text-gray-900 shadow-sm" placeholder="Nome completo do gerente" />
                        </div>
                        
                        <div className="grid grid-cols-2 gap-6">
                            <div className="space-y-1.5">
                                <label className="block text-[10px] font-black text-blue-900 uppercase ml-2 tracking-widest">E-mail de Acesso</label>
                                <input required name="managerEmail" value={editingStore.managerEmail || ''} onChange={handleChange} className="w-full p-4 bg-gray-50 border-2 border-gray-200 rounded-2xl focus:border-blue-600 focus:bg-white outline-none transition-all font-bold text-gray-900 shadow-sm" placeholder="exemplo@real.com" />
                            </div>
                            <div className="space-y-1.5">
                                <label className="block text-[10px] font-black text-blue-900 uppercase ml-2 tracking-widest">Telefone</label>
                                <input required name="managerPhone" value={editingStore.managerPhone || ''} onChange={handleChange} className="w-full p-4 bg-gray-50 border-2 border-gray-200 rounded-2xl focus:border-blue-600 focus:bg-white outline-none transition-all font-bold text-gray-900 shadow-sm" placeholder="(00) 00000-0000" />
                            </div>
                        </div>
                    </div>

                    <div className="border-t border-gray-100 pt-6 bg-red-50/50 -mx-10 px-10 pb-8">
                        <label className="block text-[10px] font-black text-red-600 uppercase mb-2 ml-2 tracking-widest">Segurança: Redefinir Senha</label>
                        <div className="relative">
                            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-red-200" size={18} />
                            <input name="password" type="password" value={editingStore.password || ''} onChange={handleChange} placeholder={isEditing ? "Deixe vazio para manter atual" : "Defina uma senha padrão"} className="w-full pl-12 pr-4 py-4 bg-white border-2 border-red-100 rounded-2xl focus:border-red-600 outline-none transition-all font-bold text-gray-900 shadow-sm" />
                        </div>
                        <p className="text-[9px] font-bold text-gray-400 mt-2 ml-2 uppercase italic tracking-tighter">Atenção: A nova senha entra em vigor imediatamente após salvar.</p>
                    </div>

                    <div className="pt-4 shrink-0 sticky bottom-0 bg-white -mx-10 px-10 pb-4">
                        <button type="submit" disabled={isProcessing} className="w-full py-5 bg-blue-950 hover:bg-black text-white font-black uppercase text-xs rounded-2xl shadow-2xl flex items-center justify-center gap-3 transition-all active:scale-95 border-b-4 border-blue-900">
                            {isProcessing ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />} 
                            {isEditing ? 'Salvar Alterações' : 'Efetivar Novo Cadastro'}
                        </button>
                    </div>
                </form>
            </div>
          </div>
        </div>
      )}

      {storeToDelete && (
         <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[110] p-4 backdrop-blur-sm">
             <div className="bg-white rounded-[40px] p-10 max-w-sm text-center shadow-2xl border border-gray-100 animate-in zoom-in duration-200">
                <div className="p-5 bg-red-50 text-red-600 rounded-full w-fit mx-auto mb-6">
                    <AlertTriangle size={48} />
                </div>
                <h3 className="text-2xl font-black text-gray-900 uppercase italic mb-2 tracking-tighter">Remover <span className="text-red-600">Unidade?</span></h3>
                <p className="text-gray-500 text-sm font-medium mb-8 leading-relaxed">Esta ação removerá o acesso do responsável e os dados da loja definitivamente.</p>
                <div className="flex gap-4">
                    <button onClick={() => setStoreToDelete(null)} className="flex-1 py-4 bg-gray-100 hover:bg-gray-200 rounded-2xl font-black uppercase text-[10px] text-gray-600 transition-all">Cancelar</button>
                    <button onClick={async () => { await onDeleteStore(storeToDelete.id); setStoreToDelete(null); }} className="flex-1 py-4 bg-red-600 hover:bg-red-700 text-white rounded-2xl font-black uppercase text-[10px] shadow-lg transition-all active:scale-95">Excluir Agora</button>
                </div>
             </div>
         </div>
      )}
    </div>
  );
};

export default AdminSettings;
