
import React, { useState, useMemo } from 'react';
import { Store, UserRole } from '../types';
import { Plus, Edit, Trash2, Save, X, Store as StoreIcon, User, MapPin, Phone, Mail, AlertTriangle, Lock, CheckCircle, XCircle, Power, Shield, User as UserIcon, Activity, KeyRound, Wallet, ChevronDown, ChevronRight } from 'lucide-react';

interface AdminSettingsProps {
  stores: Store[];
  onStoreUpdate: (stores: Store[]) => void;
}

const BRAZIL_STATES = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 
  'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
];

const AdminSettings: React.FC<AdminSettingsProps> = ({ stores, onStoreUpdate }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStore, setEditingStore] = useState<Partial<Store>>({});
  const [isEditing, setIsEditing] = useState(false);
  
  // State for Delete Confirmation Modal
  const [storeToDelete, setStoreToDelete] = useState<Store | null>(null);
  
  // Separate states for City/UF handling
  const [cityInput, setCityInput] = useState('');
  const [ufInput, setUfInput] = useState('BA'); // Default updated to BA

  // State to track selected roles for pending requests
  const [pendingRoles, setPendingRoles] = useState<Record<string, UserRole>>({});

  // Group Expansion State
  const [expandedStores, setExpandedStores] = useState<Set<string>>(new Set());

  // Separation of Pending and Active stores
  const pendingStores = useMemo(() => stores.filter(s => s.status === 'pending'), [stores]);
  
  // Group logic for Main List
  const groupedStores = useMemo(() => {
    const mainStores = stores.filter(s => s.status === 'active' || s.status === 'inactive' || (!s.status));
    
    // 1. Group by Store Number
    const groups: Record<string, { manager?: Store, cashiers: Store[] }> = {};
    
    mainStores.forEach(s => {
        const num = s.number || '0';
        if (!groups[num]) groups[num] = { cashiers: [] };
        
        // Determine hierarchy based on Role
        // Managers or Admins are treated as the "Parent" (Store Head)
        // Cashiers are treated as "Children"
        
        // Logic: Try to set Manager. If Manager slot taken, check who has higher priority or if duplicate manager role.
        if (s.role === UserRole.MANAGER || s.role === UserRole.ADMIN) {
            if (!groups[num].manager) {
                groups[num].manager = s;
            } else {
                // Conflict: Multiple managers for same store number? 
                // For now, push subsequent managers to cashiers list visually or treat as secondary
                groups[num].cashiers.push(s);
            }
        } else {
            // Cashiers or undefined roles
            groups[num].cashiers.push(s);
        }
    });

    // Fallback: If a group has only cashiers but no manager, pick first cashier as parent for grouping visual (rare)
    Object.keys(groups).forEach(num => {
        if (!groups[num].manager && groups[num].cashiers.length > 0) {
            groups[num].manager = groups[num].cashiers.shift();
        }
    });

    // 2. Sort groups by number
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
    setEditingStore(store);
    
    // Parse City and State from "City - UF" format
    if (store.city && store.city.includes(' - ')) {
      const parts = store.city.split(' - ');
      setCityInput(parts[0]);
      setUfInput(parts[1]);
    } else {
      setCityInput(store.city || '');
      setUfInput('BA'); // Default updated to BA
    }

    setIsEditing(true);
    setIsModalOpen(true);
  };

  const confirmDelete = () => {
    if (storeToDelete) {
      // SOFT DELETE: Update status to 'inactive' instead of removing from array.
      onStoreUpdate(stores.map(s => s.id === storeToDelete.id ? { ...s, status: 'inactive' } : s));
      setStoreToDelete(null); // Close modal
    }
  };

  const handleAdd = () => {
    setEditingStore({
      number: '',
      name: '',
      // city will be constructed on save
      managerName: '',
      managerEmail: '',
      managerPhone: '',
      password: '', // Initialize password
      status: 'active',
      role: UserRole.MANAGER
    });
    setCityInput('');
    setUfInput('BA'); // Default updated to BA
    setIsEditing(false);
    setIsModalOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Construct full city string
    const fullCity = `${cityInput} - ${ufInput}`;
    
    // NORMALIZE STORE NUMBER: Parse to int then string to remove leading zeros (ex: "005" -> "5")
    const cleanNumber = editingStore.number ? String(parseInt(editingStore.number.replace(/\D/g, ''), 10)) : '';

    const storeData = { ...editingStore, city: fullCity, number: cleanNumber };

    if (isEditing && editingStore.id) {
      // Upon save (Edit), remove passwordResetRequested flag if exists
      const updatedStoreData = { ...storeData, passwordResetRequested: false } as Store;
      onStoreUpdate(stores.map(s => (s.id === editingStore.id ? updatedStoreData : s)));
    } else {
      const newStore = { ...storeData, id: `s${Date.now()}`, status: storeData.status || 'active' } as Store;
      onStoreUpdate([...stores, newStore]);
    }
    setIsModalOpen(false);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setEditingStore({ ...editingStore, [e.target.name]: e.target.value });
  };

  // Actions for Pending Requests
  const approveRequest = (store: Store) => {
      // Determine role from local state or default to MANAGER
      const roleToAssign = pendingRoles[store.id] || UserRole.MANAGER;

      // Change status to active and assign role. Also clear password reset flag.
      const updatedStores = stores.map(s => 
          s.id === store.id 
            ? { ...s, status: 'active', role: roleToAssign, passwordResetRequested: false } as Store 
            : s
      );
      onStoreUpdate(updatedStores);
      alert(`Loja ${store.number} aprovada com acesso de ${roleToAssign === UserRole.ADMIN ? 'ADMINISTRADOR' : 'GERENTE'}.`);
  };

  const rejectRequest = (store: Store) => {
      // SOFT REJECT: Change status to inactive. 
      const updatedStores = stores.map(s => s.id === store.id ? { ...s, status: 'inactive' } as Store : s);
      onStoreUpdate(updatedStores);
  };

  // Toggle Actions for Main List
  const toggleStatus = (store: Store) => {
      const newStatus = store.status === 'active' ? 'inactive' : 'active';
      onStoreUpdate(stores.map(s => s.id === store.id ? { ...s, status: newStatus } : s));
  };

  const cycleRole = (store: Store) => {
      // Cycle: MANAGER -> ADMIN -> CASHIER -> MANAGER
      const currentRole = store.role || UserRole.MANAGER;
      let newRole: UserRole;

      if (currentRole === UserRole.MANAGER) newRole = UserRole.ADMIN;
      else if (currentRole === UserRole.ADMIN) newRole = UserRole.CASHIER;
      else newRole = UserRole.MANAGER;

      onStoreUpdate(stores.map(s => s.id === store.id ? { ...s, role: newRole } : s));
  };

  const renderStoreRow = (store: Store, isChild: boolean = false, hasChildren: boolean = false, expanded: boolean = false) => {
      const isActive = store.status === 'active';
      const isAdmin = store.role === UserRole.ADMIN;
      const isCashier = store.role === UserRole.CASHIER;

      return (
        <tr key={store.id} className={`transition-colors border-b border-gray-100 ${isActive ? 'hover:bg-gray-50' : 'bg-gray-50/50 grayscale opacity-70 hover:opacity-100'} ${isChild ? 'bg-gray-50/30' : ''}`}>
            <td className="p-4 pl-4">
                <button 
                    onClick={() => toggleStatus(store)}
                    className={`w-10 h-6 flex items-center rounded-full p-1 duration-300 cursor-pointer ${isActive ? 'bg-green-500 justify-end' : 'bg-gray-300 justify-start'}`}
                    title={isActive ? "Conta Ativa (Clique para desativar)" : "Conta Inativa (Clique para ativar)"}
                >
                    <div className="bg-white w-4 h-4 rounded-full shadow-md transform"></div>
                </button>
            </td>
            <td className="p-4 text-gray-500 font-mono font-bold">
                {isChild ? '' : (store.number || '-')}
            </td>
            <td className="p-4">
                <div className={`flex items-center gap-2 ${isChild ? 'pl-8' : ''}`}>
                    {/* Expand/Collapse Button for Parents with Children */}
                    {hasChildren && !isChild && (
                        <button 
                            onClick={() => toggleExpand(store.number)}
                            className="p-1 rounded hover:bg-gray-200 text-gray-500 transition-colors"
                        >
                            {expanded ? <ChevronDown size={16}/> : <ChevronRight size={16}/>}
                        </button>
                    )}
                    {/* Spacer for indent if child or no children */}
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
                <button 
                    onClick={() => cycleRole(store)}
                    className={`p-2 rounded-lg transition-colors border shadow-sm flex items-center gap-2 mx-auto min-w-[120px] justify-center ${
                        isAdmin 
                        ? 'bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-200' 
                        : isCashier
                            ? 'bg-green-100 text-green-700 border-green-200 hover:bg-green-200'
                            : 'bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-200'
                    }`}
                    title="Clique para alternar o nível de acesso (Gerente -> Admin -> Caixa)"
                >
                    {isAdmin && <><Shield size={16} /> ADMIN</>}
                    {isCashier && <><Wallet size={16} /> CAIXA</>}
                    {!isAdmin && !isCashier && <><UserIcon size={16} /> GERENTE</>}
                </button>
            </td>
            <td className="p-4 text-right">
                <div className="flex justify-end gap-2">
                    <button onClick={() => handleEdit(store)} className="p-2 text-blue-600 hover:bg-blue-50 rounded transition-colors" title="Editar"><Edit size={18} /></button>
                    <button onClick={() => setStoreToDelete(store)} className="p-2 text-red-400 hover:bg-red-50 rounded transition-colors" title="Excluir"><Trash2 size={18} /></button>
                </div>
            </td>
        </tr>
      );
  };

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      
      {/* PENDING REQUESTS SECTION (Highlighted) */}
      {pendingStores.length > 0 && (
          <div className="bg-yellow-50 border-2 border-yellow-200 rounded-xl overflow-hidden shadow-sm">
              <div className="bg-yellow-100/50 p-4 border-b border-yellow-200 flex justify-between items-center">
                  <h3 className="text-lg font-bold text-yellow-800 flex items-center gap-2">
                      <AlertTriangle size={20} className="text-yellow-600" />
                      Solicitações Pendentes (Aprovação ou Senha)
                  </h3>
                  <span className="bg-yellow-200 text-yellow-800 text-xs font-bold px-2 py-1 rounded-full">
                      {pendingStores.length} pendente(s)
                  </span>
              </div>
              <div className="p-4">
                  <table className="w-full text-left text-sm">
                      <thead>
                          <tr className="text-yellow-800 border-b border-yellow-200">
                              <th className="pb-2 pl-2">Tipo</th>
                              <th className="pb-2">Loja</th>
                              <th className="pb-2">Gerente</th>
                              <th className="pb-2 text-right">Ação / Definição de Acesso</th>
                          </tr>
                      </thead>
                      <tbody>
                          {pendingStores.map(store => (
                              <tr key={store.id} className="hover:bg-yellow-100/30 transition-colors">
                                  <td className="py-3 pl-2">
                                      {store.passwordResetRequested ? (
                                          <span className="inline-flex items-center gap-1 bg-red-100 text-red-700 px-2 py-1 rounded text-[10px] font-bold border border-red-200">
                                              <KeyRound size={12}/> RECUPERAÇÃO DE SENHA
                                          </span>
                                      ) : (
                                          <span className="inline-flex items-center gap-1 bg-green-100 text-green-700 px-2 py-1 rounded text-[10px] font-bold border border-green-200">
                                              <UserIcon size={12}/> NOVO CADASTRO
                                          </span>
                                      )}
                                  </td>
                                  <td className="py-3">
                                      <div className="font-bold text-gray-800">{store.number} - {store.name}</div>
                                      <div className="text-xs text-gray-500">{store.city}</div>
                                  </td>
                                  <td className="py-3">
                                      <div className="font-medium text-gray-800">{store.managerName}</div>
                                      <div className="text-xs text-gray-500">{store.managerEmail}</div>
                                  </td>
                                  <td className="py-3 text-right">
                                      <div className="flex justify-end items-center gap-2">
                                          {store.passwordResetRequested && (
                                              <button 
                                                onClick={() => handleEdit(store)}
                                                className="flex items-center gap-1 bg-blue-100 text-blue-700 px-3 py-1.5 rounded-lg hover:bg-blue-200 border border-blue-200 text-xs font-bold transition-colors mr-2"
                                                title="Clique para definir nova senha"
                                              >
                                                  <Edit size={14} /> Editar Senha
                                              </button>
                                          )}

                                          {/* Role Selector */}
                                          <div className="relative">
                                              <select
                                                  value={pendingRoles[store.id] || UserRole.MANAGER}
                                                  onChange={(e) => setPendingRoles({ ...pendingRoles, [store.id]: e.target.value as UserRole })}
                                                  className={`appearance-none pl-8 pr-8 py-1.5 rounded-lg border text-xs font-bold focus:ring-2 outline-none cursor-pointer ${
                                                      (pendingRoles[store.id] === UserRole.ADMIN) 
                                                        ? 'bg-blue-100 border-blue-300 text-blue-800 focus:ring-blue-400' 
                                                        : 'bg-white border-yellow-300 text-gray-700 focus:ring-yellow-400'
                                                  }`}
                                              >
                                                  <option value={UserRole.MANAGER}>Gerente</option>
                                                  <option value={UserRole.ADMIN}>Administrador</option>
                                              </select>
                                              <div className="absolute left-2 top-1.5 pointer-events-none">
                                                  {pendingRoles[store.id] === UserRole.ADMIN ? (
                                                      <Shield size={14} className="text-blue-600" />
                                                  ) : (
                                                      <User size={14} className="text-gray-500" />
                                                  )}
                                              </div>
                                          </div>

                                          <div className="h-6 w-px bg-yellow-300 mx-1"></div>

                                          <button 
                                            onClick={() => approveRequest(store)}
                                            className="flex items-center gap-1 bg-green-600 text-white px-3 py-1.5 rounded-lg hover:bg-green-700 shadow-sm text-xs font-bold transition-colors"
                                          >
                                              <CheckCircle size={14} /> Aceitar
                                          </button>
                                          <button 
                                            onClick={() => rejectRequest(store)}
                                            className="flex items-center gap-1 bg-red-100 text-red-600 px-3 py-1.5 rounded-lg hover:bg-red-200 border border-red-200 text-xs font-bold transition-colors"
                                          >
                                              <XCircle size={14} /> Rejeitar
                                          </button>
                                      </div>
                                  </td>
                              </tr>
                          ))}
                      </tbody>
                  </table>
              </div>
          </div>
      )}

      {/* MAIN STORES SECTION */}
      <div>
        <div className="flex justify-between items-center mb-6">
            <div>
            <h2 className="text-3xl font-bold text-gray-800">Gerenciamento de Usuários e Lojas</h2>
            <p className="text-gray-500">Cadastre e gerencie as unidades, gerentes e operadores de caixa.</p>
            </div>
            <button 
            onClick={handleAdd}
            className="bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-800 transition-colors shadow-sm"
            >
            <Plus size={20} /> Novo Cadastro
            </button>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <table className="w-full text-left border-collapse">
            <thead className="bg-gray-50 text-gray-600 text-sm font-semibold border-b border-gray-100">
                <tr>
                <th className="p-4">Status</th>
                <th className="p-4">Nº</th>
                <th className="p-4">Loja / Cidade</th>
                <th className="p-4">Usuário</th>
                <th className="p-4 text-center">Nível de Acesso</th>
                <th className="p-4 text-right">Ações</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm">
                {groupedStores.map(([num, group]) => {
                    const manager = group.manager;
                    const cashiers = group.cashiers;
                    const isExpanded = expandedStores.has(num);
                    const rows = [];

                    // Render Manager/Parent Row
                    if (manager) {
                        rows.push(renderStoreRow(manager, false, cashiers.length > 0, isExpanded));
                    }
                    
                    // Render Cashier/Child Rows if expanded (or if no manager exists, just list them flat if logic fell back)
                    if (isExpanded || !manager) {
                        cashiers.forEach(cashier => {
                            rows.push(renderStoreRow(cashier, true, false, false));
                        });
                    }

                    return rows;
                })}
                {groupedStores.length === 0 && (
                    <tr>
                        <td colSpan={6} className="p-8 text-center text-gray-400">
                            Nenhum cadastro encontrado.
                        </td>
                    </tr>
                )}
            </tbody>
            </table>
        </div>
      </div>

      {/* Edit/Add Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="bg-gray-50 p-6 border-b border-gray-100 flex justify-between items-center">
                <h3 className="text-xl font-bold text-gray-800">
                    {isEditing ? 'Editar Cadastro' : 'Novo Cadastro'}
                </h3>
                <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                    <X size={20} />
                </button>
            </div>
            
            <form onSubmit={handleSave} className="p-6 space-y-4">
                <div className="grid grid-cols-4 gap-4">
                     <div className="col-span-1">
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Status</label>
                        <div className="relative">
                            <span className="absolute left-3 top-2.5 text-gray-400"><Power size={16}/></span>
                            <select
                                name="status"
                                value={editingStore.status || 'active'} 
                                onChange={handleChange} 
                                className="w-full pl-9 pr-2 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-gray-600 text-sm appearance-none cursor-pointer" 
                            >
                                <option value="active">Ativa</option>
                                <option value="pending">Pendente</option>
                                <option value="inactive">Inativa</option>
                            </select>
                        </div>
                    </div>
                    <div className="col-span-1">
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Nº (Opcional)</label>
                        <div className="relative">
                            <span className="absolute left-3 top-2.5 text-gray-400"><StoreIcon size={16}/></span>
                            <input 
                                name="number"
                                value={editingStore.number || ''} 
                                onChange={handleChange} 
                                className="w-full pl-9 pr-3 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-gray-600 placeholder-gray-400" 
                                placeholder="000"
                            />
                        </div>
                    </div>
                    <div className="col-span-2">
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Identificação (Loja/Caixa)</label>
                        <input 
                            required
                            name="name"
                            value={editingStore.name || ''} 
                            onChange={handleChange} 
                            className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-gray-600 placeholder-gray-400" 
                            placeholder="Ex: Loja Centro ou Caixa 01"
                        />
                    </div>
                </div>

                <div className="grid grid-cols-4 gap-4">
                    <div className="col-span-3">
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Cidade</label>
                        <div className="relative">
                            <span className="absolute left-3 top-2.5 text-gray-400"><MapPin size={16}/></span>
                            <input 
                                required
                                value={cityInput}
                                onChange={(e) => setCityInput(e.target.value)} 
                                className="w-full pl-9 pr-3 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-gray-600 placeholder-gray-400" 
                                placeholder="Ex: Cruz das Almas"
                            />
                        </div>
                    </div>
                    <div className="col-span-1">
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Estado</label>
                        <select 
                            required
                            value={ufInput}
                            onChange={(e) => setUfInput(e.target.value)}
                            className="w-full px-2 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-gray-600"
                        >
                            {BRAZIL_STATES.map(uf => (
                                <option key={uf} value={uf}>{uf}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="pt-4 border-t border-gray-100">
                    <p className="text-sm font-semibold text-blue-900 mb-3">Dados do Usuário</p>
                    
                    <div className="space-y-3">
                        <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1">Nome Completo</label>
                            <div className="relative">
                                <span className="absolute left-3 top-2.5 text-gray-400"><User size={16}/></span>
                                <input 
                                    required
                                    name="managerName"
                                    value={editingStore.managerName || ''} 
                                    onChange={handleChange} 
                                    className="w-full pl-9 pr-3 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-gray-600 placeholder-gray-400" 
                                    placeholder="Nome do responsável"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-semibold text-gray-600 mb-1">Email (Login)</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-2.5 text-gray-400"><Mail size={16}/></span>
                                    <input 
                                        required
                                        type="email"
                                        name="managerEmail"
                                        value={editingStore.managerEmail || ''} 
                                        onChange={handleChange} 
                                        className="w-full pl-9 pr-3 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-gray-600 placeholder-gray-400" 
                                        placeholder="email@login.com"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-600 mb-1">Telefone</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-2.5 text-gray-400"><Phone size={16}/></span>
                                    <input 
                                        required
                                        name="managerPhone"
                                        value={editingStore.managerPhone || ''} 
                                        onChange={handleChange} 
                                        className="w-full pl-9 pr-3 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-gray-600 placeholder-gray-400" 
                                        placeholder="(00) 00000-0000"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="pt-4 border-t border-gray-100 bg-red-50/50 -mx-6 px-6 pb-2">
                    <p className="text-sm font-semibold text-red-900 mb-3 flex items-center gap-2 mt-4">
                        <Lock size={16} /> Segurança e Acesso
                    </p>
                    
                    <div className="grid grid-cols-1 gap-4">
                        <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1">Senha de Acesso</label>
                            <div className="relative">
                                <span className="absolute left-3 top-2.5 text-gray-400"><Lock size={16}/></span>
                                <input 
                                    type="text"
                                    name="password"
                                    value={editingStore.password || ''} 
                                    onChange={handleChange} 
                                    className="w-full pl-9 pr-3 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none transition-all text-gray-600 placeholder-gray-400" 
                                    placeholder="Definir senha"
                                />
                            </div>
                            <p className="text-[10px] text-gray-400 mt-1">Deixe em branco para manter a senha atual (se houver).</p>
                        </div>
                    </div>
                </div>

                <div className="flex gap-3 pt-4">
                    <button 
                        type="button"
                        onClick={() => setIsModalOpen(false)}
                        className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 font-medium transition-colors"
                    >
                        Cancelar
                    </button>
                    <button 
                        type="submit"
                        className="flex-1 px-4 py-2 bg-blue-700 text-white rounded-lg hover:bg-blue-800 font-medium shadow-md transition-all flex items-center justify-center gap-2"
                    >
                        <Save size={18} />
                        Salvar
                    </button>
                </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {storeToDelete && (
         <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4 backdrop-blur-sm">
             <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in duration-200 border-t-4 border-red-500">
                <div className="p-6 text-center">
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <AlertTriangle size={32} className="text-red-500" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">Desativar Cadastro?</h3>
                    <p className="text-gray-600 mb-6">
                        Você deseja desativar o cadastro de <span className="font-bold text-gray-900">{storeToDelete.name}</span>?
                        <br/>
                        <span className="text-xs text-gray-400 mt-2 block">(O status será alterado para inativo, mas os dados históricos serão mantidos no banco)</span>
                    </p>
                    
                    <div className="flex gap-3">
                         <button 
                            onClick={() => setStoreToDelete(null)}
                            className="flex-1 px-4 py-2.5 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 font-medium transition-colors"
                        >
                            Cancelar
                        </button>
                        <button 
                            onClick={confirmDelete}
                            className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium shadow-md transition-all flex items-center justify-center gap-2"
                        >
                            <Trash2 size={18} />
                            Desativar
                        </button>
                    </div>
                </div>
             </div>
         </div>
      )}
    </div>
  );
};

export default AdminSettings;
