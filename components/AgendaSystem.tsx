
import React, { useState, useEffect } from 'react';
import { AgendaItem, User, TaskPriority, SystemLog } from '../types';
import { Calendar, Plus, CheckCircle, Circle, Trash2, Bell, AlertTriangle, Clock, AlignLeft, Flag, Edit, X, Loader2, Save } from 'lucide-react';

interface AgendaSystemProps {
  user: User;
  tasks: AgendaItem[];
  onAddTask: (task: AgendaItem) => Promise<void>; // Updated to Promise for loading state
  onUpdateTask: (task: AgendaItem) => Promise<void>;
  onDeleteTask: (id: string) => Promise<void>;
  onLogAction?: (action: SystemLog['action'], details: string) => void;
}

const AgendaSystem: React.FC<AgendaSystemProps> = ({ user, tasks, onAddTask, onUpdateTask, onDeleteTask, onLogAction }) => {
  const [showModal, setShowModal] = useState(false);
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed'>('all');
  const [editingId, setEditingId] = useState<string | null>(null); 
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  useEffect(() => {
      if (onLogAction) {
          onLogAction('USE_AGENDA', 'Consultou sua agenda de tarefas');
      }
  }, []);

  const [formData, setFormData] = useState<{
      title: string;
      description: string;
      dueDate: string;
      priority: TaskPriority;
  }>({
      title: '',
      description: '',
      dueDate: new Date().toISOString().split('T')[0],
      priority: 'medium'
  });

  const myTasks = tasks.filter(t => t.userId === user.id).sort((a, b) => {
      if (a.isCompleted !== b.isCompleted) return a.isCompleted ? 1 : -1;
      
      const priorityWeight: Record<TaskPriority, number> = { 
          highest: 5, high: 4, medium: 3, low: 2, lowest: 1 
      };
      
      if (priorityWeight[b.priority] !== priorityWeight[a.priority]) {
          return priorityWeight[b.priority] - priorityWeight[a.priority];
      }
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
  });

  const filteredTasks = myTasks.filter(t => {
      if (filter === 'pending') return !t.isCompleted;
      if (filter === 'completed') return t.isCompleted;
      return true;
  });

  // Function to open modal for NEW task
  const handleOpenNewTask = () => {
      setFormData({ 
          title: '', 
          description: '', 
          dueDate: new Date().toISOString().split('T')[0], 
          priority: 'medium' 
      });
      setEditingId(null);
      setShowModal(true);
  };

  const handleEditClick = (task: AgendaItem) => {
      setFormData({
          title: task.title,
          description: task.description,
          dueDate: task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
          priority: task.priority
      });
      setEditingId(task.id);
      setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setIsSubmitting(true);
      
      try {
          if (editingId) {
              const originalTask = tasks.find(t => t.id === editingId);
              if (originalTask) {
                  const updatedTask: AgendaItem = {
                      ...originalTask,
                      title: formData.title,
                      description: formData.description,
                      dueDate: formData.dueDate,
                      priority: formData.priority
                  };
                  await onUpdateTask(updatedTask);
              }
          } else {
              const newTask: AgendaItem = {
                  id: `temp-${Date.now()}`, // Temporary ID, backend will assign real one if applicable
                  userId: user.id,
                  title: formData.title,
                  description: formData.description,
                  dueDate: formData.dueDate,
                  priority: formData.priority,
                  isCompleted: false,
                  createdAt: new Date()
              };
              await onAddTask(newTask);
          }
          setShowModal(false);
      } catch (error) {
          console.error("Erro ao salvar tarefa:", error);
          alert("Não foi possível salvar a tarefa. Tente novamente.");
      } finally {
          setIsSubmitting(false);
      }
  };

  const toggleComplete = async (task: AgendaItem) => {
      await onUpdateTask({ ...task, isCompleted: !task.isCompleted });
  };

  const getPriorityColor = (p: TaskPriority) => {
      switch(p) {
          case 'highest': return 'bg-red-100 text-red-700 border-red-200';
          case 'high': return 'bg-orange-100 text-orange-800 border-orange-200';
          case 'medium': return 'bg-green-100 text-green-800 border-green-200';
          case 'low': return 'bg-blue-100 text-blue-700 border-blue-200';
          case 'lowest': return 'bg-gray-100 text-gray-600 border-gray-200';
          default: return 'bg-gray-100';
      }
  };

  const getPriorityLabel = (p: TaskPriority) => {
      switch(p) {
          case 'highest': return 'Urgente';
          case 'high': return 'Alta';
          case 'medium': return 'Normal';
          case 'low': return 'Baixa';
          case 'lowest': return 'Mínima';
      }
  };

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto space-y-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
                <h2 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
                    <Calendar className="text-purple-600" size={32} />
                    Minha Agenda
                </h2>
                <p className="text-gray-500 mt-1">Organize suas tarefas e receba alertas de prioridade.</p>
            </div>
            <button 
                onClick={handleOpenNewTask}
                className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg hover:shadow-xl transition-all active:scale-95"
            >
                <Plus size={20} /> Nova Tarefa
            </button>
        </div>

        <div className="flex gap-2 border-b border-gray-200 pb-1">
            <button onClick={() => setFilter('all')} className={`px-4 py-2 rounded-t-lg text-sm font-bold transition-all border-b-2 ${filter === 'all' ? 'border-purple-600 text-purple-700 bg-purple-50' : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}>Todas</button>
            <button onClick={() => setFilter('pending')} className={`px-4 py-2 rounded-t-lg text-sm font-bold transition-all border-b-2 ${filter === 'pending' ? 'border-purple-600 text-purple-700 bg-purple-50' : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}>Pendentes</button>
            <button onClick={() => setFilter('completed')} className={`px-4 py-2 rounded-t-lg text-sm font-bold transition-all border-b-2 ${filter === 'completed' ? 'border-purple-600 text-purple-700 bg-purple-50' : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}>Concluídas</button>
        </div>

        <div className="space-y-3">
            {filteredTasks.map(task => (
                <div 
                    key={task.id} 
                    className={`bg-white p-5 rounded-2xl border transition-all flex items-start gap-4 ${task.isCompleted ? 'opacity-60 border-gray-100 bg-gray-50' : 'border-gray-200 shadow-sm hover:shadow-md hover:border-purple-200'}`}
                >
                    <button onClick={() => toggleComplete(task)} className={`mt-1 flex-shrink-0 transition-colors ${task.isCompleted ? 'text-green-500' : 'text-gray-300 hover:text-green-500'}`}>
                        {task.isCompleted ? <CheckCircle size={26} className="fill-green-100" /> : <Circle size={26} />}
                    </button>
                    <div className="flex-1">
                        <div className="flex flex-wrap justify-between items-start gap-2">
                            <h3 className={`font-bold text-lg ${task.isCompleted ? 'line-through text-gray-400' : 'text-gray-800'}`}>{task.title}</h3>
                            <span className={`text-[10px] px-2 py-1 rounded border font-bold uppercase tracking-wider ${getPriorityColor(task.priority)}`}>{getPriorityLabel(task.priority)}</span>
                        </div>
                        <p className={`text-sm mt-1 leading-relaxed ${task.isCompleted ? 'text-gray-400' : 'text-gray-600'}`}>{task.description}</p>
                        <div className="flex items-center gap-4 mt-3 text-xs text-gray-400 font-medium">
                            <span className={`flex items-center gap-1 px-2 py-1 rounded ${new Date(task.dueDate) < new Date() && !task.isCompleted ? 'bg-red-50 text-red-600' : 'bg-gray-100'}`}>
                                <Clock size={14} /> {new Date(task.dueDate).toLocaleDateString('pt-BR')}
                            </span>
                        </div>
                    </div>
                    <div className="flex flex-col gap-1">
                        <button onClick={() => handleEditClick(task)} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Editar"><Edit size={18} /></button>
                        <button onClick={() => onDeleteTask(task.id)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Excluir"><Trash2 size={18} /></button>
                    </div>
                </div>
            ))}
            {filteredTasks.length === 0 && (
                <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-gray-300 text-gray-400">
                    <div className="inline-block p-4 bg-gray-50 rounded-full mb-3 shadow-sm"><Bell size={28} className="text-gray-300" /></div>
                    <p className="font-medium">Nenhuma tarefa encontrada.</p>
                    <button onClick={handleOpenNewTask} className="mt-4 text-purple-600 font-bold text-sm hover:underline">Criar nova tarefa</button>
                </div>
            )}
        </div>

        {/* ADD/EDIT MODAL */}
        {showModal && (
            <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in duration-200">
                    <div className="bg-purple-600 p-6 flex justify-between items-center">
                        <h3 className="text-white font-bold text-xl flex items-center gap-2">
                            {editingId ? <Edit size={24} /> : <Plus size={24} />} 
                            {editingId ? 'Editar Tarefa' : 'Nova Tarefa'}
                        </h3>
                        <button onClick={() => setShowModal(false)} className="text-purple-200 hover:text-white transition-colors bg-white/10 rounded-full p-1"><X size={20} /></button>
                    </div>
                    
                    <form onSubmit={handleSubmit} className="p-6 space-y-5">
                        <div className="space-y-1">
                            <label className="block text-xs font-bold text-gray-500 uppercase">Título da Tarefa</label>
                            <input 
                                required
                                value={formData.title}
                                onChange={e => setFormData({...formData, title: e.target.value})}
                                className="w-full p-3 border border-gray-300 rounded-xl outline-none focus:border-purple-500 focus:ring-4 focus:ring-purple-100 bg-white text-gray-900 font-medium transition-all"
                                placeholder="Ex: Pagar fornecedor"
                            />
                        </div>
                        
                        <div className="space-y-1">
                            <label className="block text-xs font-bold text-gray-500 uppercase">Descrição Detalhada</label>
                            <div className="relative">
                                <AlignLeft size={18} className="absolute left-3 top-3 text-gray-400" />
                                <textarea 
                                    value={formData.description}
                                    onChange={e => setFormData({...formData, description: e.target.value})}
                                    className="w-full pl-10 pr-3 py-3 border border-gray-300 rounded-xl outline-none focus:border-purple-500 focus:ring-4 focus:ring-purple-100 h-28 resize-none bg-white text-gray-900 transition-all"
                                    placeholder="Detalhes da tarefa..."
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <label className="block text-xs font-bold text-gray-500 uppercase">Vencimento</label>
                                <div className="relative">
                                    <Calendar size={18} className="absolute left-3 top-3 text-gray-400 pointer-events-none" />
                                    <input 
                                        type="date"
                                        required
                                        value={formData.dueDate}
                                        onChange={e => setFormData({...formData, dueDate: e.target.value})}
                                        className="w-full pl-10 pr-3 py-3 border border-gray-300 rounded-xl outline-none focus:border-purple-500 focus:ring-4 focus:ring-purple-100 bg-white text-gray-900 transition-all cursor-pointer"
                                    />
                                </div>
                            </div>
                            <div className="space-y-1">
                                <label className="block text-xs font-bold text-gray-500 uppercase">Prioridade</label>
                                <div className="relative">
                                    <Flag size={18} className="absolute left-3 top-3 text-gray-400 pointer-events-none" />
                                    <select 
                                        value={formData.priority}
                                        onChange={e => setFormData({...formData, priority: e.target.value as TaskPriority})}
                                        className="w-full pl-10 pr-8 py-3 border border-gray-300 rounded-xl outline-none focus:border-purple-500 focus:ring-4 focus:ring-purple-100 bg-white text-gray-900 appearance-none cursor-pointer transition-all"
                                    >
                                        <option value="lowest">1 - Mínima</option>
                                        <option value="low">2 - Baixa</option>
                                        <option value="medium">3 - Normal</option>
                                        <option value="high">4 - Alta</option>
                                        <option value="highest">5 - Urgente</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-3 pt-4">
                            <button 
                                type="button" 
                                onClick={() => setShowModal(false)} 
                                disabled={isSubmitting}
                                className="flex-1 py-3 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-colors disabled:opacity-70"
                            >
                                Cancelar
                            </button>
                            <button 
                                type="submit" 
                                disabled={isSubmitting}
                                className="flex-1 py-3 bg-purple-600 text-white font-bold rounded-xl hover:bg-purple-700 shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                            >
                                {isSubmitting ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />}
                                {editingId ? 'Atualizar' : 'Salvar'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        )}
    </div>
  );
};

export default AgendaSystem;
