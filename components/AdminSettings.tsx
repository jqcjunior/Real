
import React, { useState, useMemo, useRef } from 'react';
import { Store, UserRole } from '../types';
import { Plus, Edit, Trash2, Save, X, Store as StoreIcon, User, MapPin, Phone, Mail, AlertTriangle, Lock, CheckCircle, XCircle, Power, Shield, User as UserIcon, Wallet, ChevronDown, ChevronRight, Upload, FileSpreadsheet, Loader2 } from 'lucide-react';
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
  
  // State for Delete Confirmation Modal
  const [storeToDelete, setStoreToDelete] = useState<Store | null>(null);
  
  const [cityInput, setCityInput] = useState('');
  const [ufInput, setUfInput] = useState('BA'); 

  const [pendingRoles, setPendingRoles] = useState<Record<string, UserRole>>({});
  const [expandedStores, setExpandedStores] = useState<Set<string>>(new Set());

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isImporting, setIsImporting] = useState(false);

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
    setEditingStore(store);
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

  const confirmDelete = async () => {
    if (storeToDelete) {
      setIsProcessing(true);
      await onDeleteStore(storeToDelete.id);
      setIsProcessing(false);
      setStoreToDelete(null); 
    }
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
    const storeData = { ...editingStore, city: fullCity, number: cleanNumber };

    try {
        if (isEditing && editingStore.id) {
          const updatedStoreData = { ...storeData, passwordResetRequested: false } as Store;
          await onUpdateStore(updatedStoreData);
        } else {
          const newStore = { ...storeData, id: `temp-${Date.now()}`, status: storeData.status || 'active' } as Store;
          await onAddStore(newStore);
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

  const approveRequest = async (store: Store) => {
      const roleToAssign = pendingRoles[store.id] || UserRole.MANAGER;
      const updatedStore = { 
          ...store, 
          status: 'active', 
          role: roleToAssign, 
          passwordResetRequested: false 
      } as Store;
      await onUpdateStore(updatedStore);
      alert(`Loja ${store.number} aprovada.`);
  };

  const rejectRequest = async (store: Store) => {
      if(window.confirm("Deseja realmente rejeitar esta solicitação?")) {
          await onDeleteStore(store.id);
      }
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
      else newRole = UserRole.MANAGER;
      await onUpdateStore({ ...store, role: newRole });
  };

  // --- IMPORT LOGIC ---
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file && onImportStores) {
          setIsImporting(true);
          const reader = new FileReader();
          reader.onload = async (evt) => {
              try {
                  const bstr = evt.target?.result;
                  const wb = XLSX.read(bstr, { type: 'binary' });
                  const wsname = wb.SheetNames[0];
                  const ws = wb.Sheets[wsname];
                  const data = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];
                  
                  let headerIdx = 0;
                  for (let i = 0; i < Math.min(data.length, 10); i++) {
                      const rowStr = data[i].join(' ').toLowerCase();
                      if (rowStr.includes('loja') || rowStr.includes('nome')) {
                          headerIdx = i;
                          break;
                      }
                  }

                  const header = data[headerIdx].map(h => String(h).toLowerCase());
                  const idxNum = header.findIndex(h => h.includes('loja') || h.includes('numero'));
                  const idxName = header.findIndex(h => h.includes('nome') || h.includes('unidade'));
                  const idxCity = header.findIndex(h => h.includes('cidade'));
                  const idxMgr = header.findIndex(h => h.includes('gerente') || h.includes('responsavel'));
                  const idxEmail = header.findIndex(h => h.includes('email'));
                  const idxPhone = header.findIndex(h => h.includes('telefone') || h.includes('celular'));

                  const newStores: Store[] = [];
                  
                  for (let i = headerIdx + 1; i < data.length; i++) {
                      const row = data[i];
                      if (!row || row.length === 0) continue;
                      
                      const num = idxNum > -1 ? String(row[idxNum]).replace(/\D/g, '') : '';
                      const name = idxName > -1 ? String(row[idxName]) : `Loja ${num}`;
                      
                      if (num && name) {
                          newStores.push({
                              id: `s-imp-${Date.now()}-${i}`,
                              number: String(parseInt(num)), // Clean leading zeros
                              name: name,
                              city: idxCity > -1 ? String(row[idxCity]) : 'Cidade - UF',
                              managerName: idxMgr > -1 ? String(row[idxMgr]) : 'Gerente',
                              managerEmail: idxEmail > -1 ? String(row[idxEmail]) : `loja${num}@email.com`,
                              managerPhone: idxPhone > -1 ? String(row[idxPhone]) : '',
                              role: UserRole.MANAGER,
                              status: 'active'
                          });
                      }
                  }

                  if (newStores.length > 0) {
                      await onImportStores(newStores);
                  } else {
                      alert("Nenhuma loja válida encontrada na planilha. Verifique as colunas (Loja, Nome, Cidade, Gerente).");
                  }

              } catch (err) {
                  console.error(err);
                  alert("Erro ao ler arquivo Excel.");
              } finally {
                  setIsImporting(false);
                  if (fileInputRef.current) fileInputRef.current.value = '';
              }
          };
          reader.readAsBinaryString(file);
      }
  };

  const renderStoreRow = (store: Store, isChild: boolean = false, hasChildren: boolean = false, expanded: boolean = false) => {
      const isActive = store.status === 'active';
      const isAdmin = store.role === UserRole.ADMIN;
      const isCashier = store.role === UserRole.CASHIER;

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
                <button onClick={() => cycleRole(store)} className={`p-2 rounded-lg transition-colors border shadow-sm flex items-center gap-2 mx-auto min-w-[120px] justify-center ${isAdmin ? 'bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-200' : isCashier ? 'bg-green-100 text-green-700 border-green-200 hover:bg-green-200' : 'bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-200'}`}>
                    {isAdmin && <><Shield size={16} /> ADMIN</>}
                    {isCashier && <><Wallet size={16} /> CAIXA</>}
                    {!isAdmin && !isCashier && <><UserIcon size={16} /> GERENTE</>}
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
      
      {/* PENDING REQUESTS SECTION */}
      {pendingStores.length > 0 && (
          <div className="bg-yellow-50 border-2 border-yellow-200 rounded-xl overflow-hidden shadow-sm">
              <div className="bg-yellow-100/50 p-4 border-b border-yellow-200 flex justify-between items-center">
                  <h3 className="text-lg font-bold text-yellow-800 flex items-center gap-2"><AlertTriangle size={20} className="text-yellow-600" /> Solicitações Pendentes</h3>
                  <span className="bg-yellow-200 text-yellow-800 text-xs font-bold px-2 py-1 rounded-full">{pendingStores.length} pendente(s)</span>
              </div>
              <div className="p-4">
                  <table className="w-full text-left text-sm">
                      <thead>
                          <tr className="text-yellow-800 border-b border-yellow-200">
                              <th className="pb-2 pl-2">Tipo</th>
                              <th className="pb-2">Loja</th>
                              <th className="pb-2">Gerente</th>
                              <th className="pb-2 text-right">Ação</th>
                          </tr>
                      </thead>
                      <tbody>
                          {pendingStores.map(store => (
                              <tr key={store.id} className="hover:bg-yellow-100/30 transition-colors">
                                  <td className="py-3 pl-2">
                                      {store.passwordResetRequested ? <span className="inline-flex items-center gap-1 bg-red-100 text-red-700 px-2 py-1 rounded text-[10px] font-bold border border-red-200">RECUPERAÇÃO</span> : <span className="inline-flex items-center gap-1 bg-green-100 text-green-700 px-2 py-1 rounded text-[10px] font-bold border border-green-200">NOVO CADASTRO</span>}
                                  </td>
                                  <td className="py-3"><div className="font-bold text-gray-800">{store.number} - {store.name}</div><div className="text-xs text-gray-500">{store.city}</div></td>
                                  <td className="py-3"><div className="font-medium text-gray-800">{store.managerName}</div><div className="text-xs text-gray-500">{store.managerEmail}</div></td>
                                  <td className="py-3 text-right">
                                      <div className="flex justify-end items-center gap-2">
                                          {store.passwordResetRequested && <button onClick={() => handleEdit(store)} className="flex items-center gap-1 bg-blue-100 text-blue-700 px-3 py-1.5 rounded-lg hover:bg-blue-200 border border-blue-200 text-xs font-bold transition-colors mr-2"><Edit size={14} /> Editar Senha</button>}
                                          <div className="relative">
                                              <select value={pendingRoles[store.id] || UserRole.MANAGER} onChange={(e) => setPendingRoles({ ...pendingRoles, [store.id]: e.target.value as UserRole })} className={`appearance-none pl-8 pr-8 py-1.5 rounded-lg border text-xs font-bold focus:ring-2 outline-none cursor-pointer ${pendingRoles[store.id] === UserRole.ADMIN ? 'bg-blue-100 border-blue-300 text-blue-800' : 'bg-white border-yellow-300 text-gray-700'}`}>
                                                  <option value={UserRole.MANAGER}>Gerente</option>
                                                  <option value={UserRole.ADMIN}>Administrador</option>
                                              </select>
                                              <div className="absolute left-2 top-1.5 pointer-events-none">{pendingRoles[store.id] === UserRole.ADMIN ? <Shield size={14} className="text-blue-600" /> : <User size={14} className="text-gray-500" />}</div>
                                          </div>
                                          <button onClick={() => approveRequest(store)} className="flex items-center gap-1 bg-green-600 text-white px-3 py-1.5 rounded-lg hover:bg-green-700 shadow-sm text-xs font-bold transition-colors"><CheckCircle size={14} /> Aceitar</button>
                                          <button onClick={() => rejectRequest(store)} className="flex items-center gap-1 bg-red-100 text-red-600 px-3 py-1.5 rounded-lg hover:bg-red-200 border border-red-200 text-xs font-bold transition-colors"><XCircle size={14} /> Rejeitar</button>
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
            <div className="flex gap-2">
                {onImportStores && (
                    <>
                        <input type="file" ref={fileInputRef} className="hidden" accept=".xlsx, .xls, .csv" onChange={handleFileChange} />
                        <button onClick={() => fileInputRef.current?.click()} disabled={isImporting} className="bg-green-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-green-700 transition-colors shadow-sm disabled:opacity-50">
                            {isImporting ? <Loader2 size={20} className="animate-spin" /> : <FileSpreadsheet size={20} />}
                            Importar Excel
                        </button>
                    </>
                )}
                <button onClick={handleAdd} className="bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-800 transition-colors shadow-sm">
                    <Plus size={20} /> Novo Cadastro
                </button>
            </div>
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
                    if (manager) rows.push(renderStoreRow(manager, false, cashiers.length > 0, isExpanded));
                    if (isExpanded || !manager) cashiers.forEach(cashier => rows.push(renderStoreRow(cashier, true, false, false)));
                    return rows;
                })}
                {groupedStores.length === 0 && (
                    <tr><td colSpan={6} className="p-8 text-center text-gray-400">Nenhum cadastro encontrado.</td></tr>
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
                <h3 className="text-xl font-bold text-gray-800">{isEditing ? 'Editar Cadastro' : 'Novo Cadastro'}</h3>
                <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
                {/* ... existing form fields ... */}
                <div className="grid grid-cols-4 gap-4">
                     <div className="col-span-1">
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Status</label>
                        <div className="relative">
                            <span className="absolute left-3 top-2.5 text-gray-400"><Power size={16}/></span>
                            <select name="status" value={editingStore.status || 'active'} onChange={handleChange} className="w-full pl-9 pr-2 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-gray-600 text-sm appearance-none cursor-pointer">
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
                            <input name="number" value={editingStore.number || ''} onChange={handleChange} className="w-full pl-9 pr-3 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all text-gray-600 placeholder-gray-400" placeholder="000" />
                        </div>
                    </div>
                    <div className="col-span-2">
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Identificação (Loja/Caixa)</label>
                        <input required name="name" value={editingStore.name || ''} onChange={handleChange} className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all text-gray-600 placeholder-gray-400" placeholder="Ex: Loja Centro ou Caixa 01" />
                    </div>
                </div>
                <div className="grid grid-cols-4 gap-4">
                    <div className="col-span-3">
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Cidade</label>
                        <div className="relative">
                            <span className="absolute left-3 top-2.5 text-gray-400"><MapPin size={16}/></span>
                            <input required value={cityInput} onChange={(e) => setCityInput(e.target.value)} className="w-full pl-9 pr-3 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all text-gray-600 placeholder-gray-400" placeholder="Ex: Cruz das Almas" />
                        </div>
                    </div>
                    <div className="col-span-1">
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Estado</label>
                        <select required value={ufInput} onChange={(e) => setUfInput(e.target.value)} className="w-full px-2 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all text-gray-600">
                            {BRAZIL_STATES.map(uf => <option key={uf} value={uf}>{uf}</option>)}
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
                                <input required name="managerName" value={editingStore.managerName || ''} onChange={handleChange} className="w-full pl-9 pr-3 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all text-gray-600 placeholder-gray-400" placeholder="Nome do responsável" />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-semibold text-gray-600 mb-1">Email (Login)</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-2.5 text-gray-400"><Mail size={16}/></span>
                                    <input required type="email" name="managerEmail" value={editingStore.managerEmail || ''} onChange={handleChange} className="w-full pl-9 pr-3 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all text-gray-600 placeholder-gray-400" placeholder="email@login.com" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-600 mb-1">Telefone</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-2.5 text-gray-400"><Phone size={16}/></span>
                                    <input required name="managerPhone" value={editingStore.managerPhone || ''} onChange={handleChange} className="w-full pl-9 pr-3 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all text-gray-600 placeholder-gray-400" placeholder="(00) 00000-0000" />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="pt-4 border-t border-gray-100 bg-red-50/50 -mx-6 px-6 pb-2">
                    <p className="text-sm font-semibold text-red-900 mb-3 flex items-center gap-2 mt-4"><Lock size={16} /> Segurança e Acesso</p>
                    <div className="grid grid-cols-1 gap-4">
                        <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1">Senha de Acesso</label>
                            <div className="relative">
                                <span className="absolute left-3 top-2.5 text-gray-400"><Lock size={16}/></span>
                                <input type="text" name="password" value={editingStore.password || ''} onChange={handleChange} className="w-full pl-9 pr-3 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none transition-all text-gray-600 placeholder-gray-400" placeholder="Definir senha" />
                            </div>
                            <p className="text-[10px] text-gray-400 mt-1">Deixe em branco para manter a senha atual (se houver).</p>
                        </div>
                    </div>
                </div>

                <div className="flex gap-3 pt-4">
                    <button type="button" onClick={() => setIsModalOpen(false)} disabled={isProcessing} className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 font-medium transition-colors disabled:opacity-50">Cancelar</button>
                    <button type="submit" disabled={isProcessing} className="flex-1 px-4 py-2 bg-blue-700 text-white rounded-lg hover:bg-blue-800 font-medium shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                        {isProcessing ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                        Salvar
                    </button>
                </div>
            </form>
          </div>
        </div>
      )}

      {storeToDelete && (
         <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4 backdrop-blur-sm">
             <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in duration-200 border-t-4 border-red-500">
                <div className="p-6 text-center">
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4"><AlertTriangle size={32} className="text-red-500" /></div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">
                        {storeToDelete.status === 'inactive' || storeToDelete.status === 'pending' ? 'Excluir Permanentemente?' : 'Desativar Cadastro?'}
                    </h3>
                    <p className="text-gray-600 mb-6">
                        {storeToDelete.status === 'inactive' || storeToDelete.status === 'pending' 
                            ? <span>Esta ação <strong>não pode ser desfeita</strong>. Todos os dados desta loja serão removidos.</span>
                            : <span>Você deseja desativar o cadastro de <span className="font-bold text-gray-900">{storeToDelete.name}</span>?<br/><span className="text-xs text-gray-400 mt-2 block">(O status será alterado para inativo)</span></span>
                        }
                    </p>
                    <div className="flex gap-3">
                         <button onClick={() => setStoreToDelete(null)} disabled={isProcessing} className="flex-1 px-4 py-2.5 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 font-medium transition-colors">Cancelar</button>
                        <button onClick={confirmDelete} disabled={isProcessing} className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium shadow-md transition-all flex items-center justify-center gap-2">
                            {isProcessing ? <Loader2 size={18} className="animate-spin" /> : <Trash2 size={18} />}
                            {storeToDelete.status === 'inactive' || storeToDelete.status === 'pending' ? 'Excluir' : 'Desativar'}
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
