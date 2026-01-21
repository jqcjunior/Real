
import React, { useState, useMemo, useRef } from 'react';
import { Store, UserRole } from '../types';
import { Plus, Edit, Trash2, Save, X, Store as StoreIcon, User, MapPin, Phone, Mail, AlertTriangle, Lock, Eye, EyeOff, CheckCircle, XCircle, Power, Shield, User as UserIcon, Wallet, ChevronDown, ChevronRight, Upload, FileSpreadsheet, Loader2, IceCream } from 'lucide-react';
import * as XLSX from 'xlsx';

interface AdminSettingsProps {
  stores: Store[];
  onAddStore: (store: Store) => Promise<void>;
  onUpdateStore: (store: Store) => Promise<void>;
  onDeleteStore: (id: string) => Promise<void>;
}

const AdminSettings: React.FC<AdminSettingsProps> = ({ stores, onAddStore, onUpdateStore, onDeleteStore }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStore, setEditingStore] = useState<Partial<Store>>({});
  const [isEditing, setIsEditing] = useState(false);

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-6 md:space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <h2 className="text-2xl md:text-3xl font-black text-gray-800 uppercase italic tracking-tighter leading-none">Unidades <span className="text-red-600">Operacionais</span></h2>
          <button onClick={() => { setEditingStore({}); setIsEditing(false); setIsModalOpen(true); }} className="w-full md:w-auto bg-gray-950 text-white px-6 py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-black font-black uppercase text-[10px] tracking-widest border-b-4 border-red-600 active:scale-95">
              <Plus size={16} /> Novo Cadastro
          </button>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto no-scrollbar">
              <table className="w-full text-left min-w-[800px]">
                <thead className="bg-gray-50 text-gray-500 text-[9px] font-black uppercase tracking-widest border-b">
                    <tr><th className="p-4">Status</th><th className="p-4">Nº</th><th className="p-4">Unidade</th><th className="p-4">Responsável</th><th className="p-4 text-right">Ações</th></tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-[11px] font-bold">
                    {stores.map(s => (
                        <tr key={s.id} className="hover:bg-gray-50 transition-all">
                            <td className="p-4">
                                <div className={`w-3 h-3 rounded-full ${s.status === 'active' ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                            </td>
                            <td className="p-4 text-blue-900">{s.number}</td>
                            <td className="p-4 uppercase italic">{s.name} <span className="block text-[8px] text-gray-400 not-italic font-bold">{s.city}</span></td>
                            <td className="p-4 uppercase text-gray-500">{s.managerName}</td>
                            <td className="p-4 text-right">
                                <div className="flex justify-end gap-1">
                                    <button className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"><Edit size={16}/></button>
                                    <button className="p-2 text-red-300 hover:text-red-500 rounded-lg"><Trash2 size={16}/></button>
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
              </table>
          </div>
      </div>

      {isModalOpen && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[200] flex items-center justify-center p-3 md:p-6">
              <div className="bg-white rounded-[40px] w-full max-w-xl max-h-[90vh] overflow-y-auto no-scrollbar shadow-2xl animate-in zoom-in duration-300 border-t-8 border-blue-600">
                  <div className="p-6 md:p-8 border-b flex justify-between items-center">
                      <h3 className="text-xl font-black uppercase italic text-blue-900 leading-none">Unidade <span className="text-red-600">Real</span></h3>
                      <button onClick={() => setIsModalOpen(false)} className="p-2 text-gray-400 hover:text-red-600 transition-all"><X size={24}/></button>
                  </div>
                  <div className="p-6 md:p-10 space-y-6">
                      {/* Form simplificado responsivo */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-1"><label className="text-[9px] font-black text-gray-400 uppercase ml-2">Nº Loja</label><input className="w-full p-4 bg-gray-50 rounded-2xl font-black outline-none border-none shadow-inner" placeholder="01" /></div>
                          <div className="space-y-1"><label className="text-[9px] font-black text-gray-400 uppercase ml-2">Cidade</label><input className="w-full p-4 bg-gray-50 rounded-2xl font-black outline-none border-none shadow-inner" placeholder="Salvador" /></div>
                      </div>
                      <div className="space-y-1"><label className="text-[9px] font-black text-gray-400 uppercase ml-2">Responsável</label><input className="w-full p-4 bg-gray-50 rounded-2xl font-black outline-none border-none shadow-inner" placeholder="Nome do Gerente" /></div>
                      <button className="w-full py-5 bg-blue-900 text-white rounded-[28px] font-black uppercase text-xs shadow-xl active:scale-95 transition-all border-b-4 border-blue-950">Efetivar Operação</button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default AdminSettings;
