
import React, { useState, useEffect } from 'react';
import { AgendaItem, User, TaskPriority, SystemLog } from '../types';
import { Calendar, Plus, CheckCircle, Circle, Trash2, Bell, AlertTriangle, Clock, AlignLeft, Flag, Edit, X } from 'lucide-react';

interface AgendaSystemProps {
  user: User;
  tasks: AgendaItem[];
  onAddTask: (task: AgendaItem) => void;
  onUpdateTask: (task: AgendaItem) => void;
  onDeleteTask: (id: string) => void;
  onLogAction?: (action: SystemLog['action'], details: string) => void;
}

const AgendaSystem: React.FC<AgendaSystemProps> = ({ user, tasks, onAddTask, onUpdateTask, onDeleteTask, onLogAction }) => {
  const [showModal, setShowModal] = useState(false);
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed'>('all');
  const [editingId, setEditingId] = useState<string | null>(null); 
  
  useEffect(() => {
      if (onLogAction) {
          onLogAction('USE_AGENDA', 'Consultou sua agenda de tarefas');
      }
  }, []);

  const [newTask, setNewTask] = useState<{
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
      setNewTask({ title: '', description: '', dueDate: new Date().toISOString().split('T')[0], priority: 'medium' });
      setEditingId(null);
      setShowModal(true);
  };

  const resetForm = () => {
      setNewTask({ title: '', description: '', dueDate: new Date().toISOString().split('T')[0], priority: 'medium' });
      setEditingId(null);
      setShowModal(false);
  };

  const handleEditClick = (task: AgendaItem) => {
      setNewTask({
          title: task.title,
          description: task.description,
          dueDate: task.dueDate,
          priority: task.priority
      });
      setEditingId(task.id);
      setShowModal(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      
      if (editingId) {
          const originalTask = tasks.find(t => t.id === editingId);
          if (originalTask) {
              const updatedTask: AgendaItem = {
                  ...originalTask,
                  title: newTask.title,
                  description: newTask.description,
                  dueDate: newTask.dueDate,
                  priority: newTask.priority
              };
              onUpdateTask(updatedTask);
          }
      } else {
          const task: AgendaItem = {
              id: `task-${Date.now()}`,
              userId: user.id,
              title: newTask.title,
              description: newTask.description,
              dueDate: newTask.dueDate,
              priority: newTask.priority,
              isCompleted: false,
              createdAt: new Date()
          };
          onAddTask(task);
      }
      resetForm();
  };

  const toggleComplete = (task: AgendaItem) => {
      onUpdateTask({ ...task, isCompleted: !task.isCompleted });
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
        <div className="flex justify-between items-center">
            <div>
                <h2 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
                    <Calendar className="text-purple-600" size={32} />
                    Minha Agenda
                </h2>
                <p className="text-gray-500 mt-1">Organize suas tarefas e receba alertas de prioridade.</p>
            </div>
            <button 
                onClick={handleOpenNewTask}
                className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 shadow-md transition-all"
            >
                <Plus size={20} /> Nova Tarefa
            </button>
        </div>

        <div className="flex gap-2">
            <button onClick={() => setFilter('all')} className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${filter === 'all' ? 'bg-gray-800 text-white' : 'bg-white text-gray-600 border border-gray-200'}`}>Todas</button>
            <button onClick={() => setFilter('pending')} className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${filter === 'pending' ? 'bg-gray-800 text-white' : 'bg-white text-gray-600 border border-gray-200'}`}>Pendentes</button>
            <button onClick={() => setFilter('completed')} className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${filter === 'completed' ? 'bg-gray-800 text-white' : 'bg-white text-gray-600 border border-gray-200'}`}>Concluídas</button>
        </div>

        <div className="space-y-3">
            {filteredTasks.map(task => (
                <div 
                    key={task.id} 
                    className={`bg-white p-4 rounded-xl border transition-all flex items-start gap-4 ${task.isCompleted ? 'opacity-60 border-gray-100' : 'border-gray-200 shadow-sm hover:shadow-md'}`}
                >
                    <button onClick={() => toggleComplete(task)} className={`mt-1 flex-shrink-0 transition-colors ${task.isCompleted ? 'text-green-500' : 'text-gray-300 hover:text-green-500'}`}>
                        {task.isCompleted ? <CheckCircle size={24} /> : <Circle size={24} />}
                    </button>
                    <div className="flex-1">
                        <div className="flex justify-between items-start">
                            <h3 className={`font-bold text-lg ${task.isCompleted ? 'line-through text-gray-400' : 'text-gray-800'}`}>{task.title}</h3>
                            <span className={`text-[10px] px-2 py-1 rounded border font-bold uppercase ${getPriorityColor(task.priority)}`}>{getPriorityLabel(task.priority)}</span>
                        </div>
                        <p className={`text-sm mt-1 ${task.isCompleted ? 'text-gray-400' : 'text-gray-600'}`}>{task.description}</p>
                        <div className="flex items-center gap-4 mt-3 text-xs text-gray-400">
                            <span className="flex items-center gap-1"><Clock size={12} /> Vence em: {new Date(task.dueDate).toLocaleDateString('pt-BR')}</span>
                        </div>
                    </div>
                    <div className="flex flex-col gap-2">
                        <button onClick={() => handleEditClick(task)} className="p-2 text-blue-400 hover:text-blue-600 transition-colors rounded-full hover:bg-blue-50" title="Editar"><Edit size={18} /></button>
                        <button onClick={() => onDeleteTask(task.id)} className="p-2 text-gray-300 hover:text-red-500 transition-colors rounded-full hover:bg-red-50" title="Excluir"><Trash2 size={18} /></button>
                    </div>
                </div>
            ))}
            {filteredTasks.length === 0 && (
                <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-300 text-gray-400">
                    <div className="inline-block p-4 bg-white rounded-full mb-3 shadow-sm"><Bell size={24} className="text-gray-300" /></div>
                    <p>Nenhuma tarefa encontrada.</p>
                </div>
            )}
        </div>

        {showModal && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
                <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in duration-200">
                    <div className="bg-purple-600 p-6 flex justify-between items-center">
                        <h3 className="text-white font-bold text-xl flex items-center gap-2">{editingId ? <Edit size={24} /> : <Plus size={24} />} {editingId ? 'Editar Tarefa' : 'Nova Tarefa'}</h3>
                        <button onClick={resetForm} className="text-purple-200 hover:text-white transition-colors"><X size={20} /></button>
                    </div>
                    <form onSubmit={handleSubmit} className="p-6 space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Título</label>
                            <input required value={newTask.title} onChange={e => setNewTask({...newTask, title: e.target.value})} className="w-full p-2 border border-gray-300 rounded-lg outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-200 bg-white text-gray-900" placeholder="Ex: Pagar fornecedor" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Descrição</label>
                            <textarea value={newTask.description} onChange={e => setNewTask({...newTask, description: e.target.value})} className="w-full p-2 border border-gray-300 rounded-lg outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-200 h-24 resize-none bg-white text-gray-900" placeholder="Detalhes da tarefa..." />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Data Vencimento</label>
                                <input type="date" required value={newTask.dueDate} onChange={e => setNewTask({...newTask, dueDate: e.target.value})} className="w-full p-2 border border-gray-300 rounded-lg outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-200 bg-white text-gray-900" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Prioridade</label>
                                <select value={newTask.priority} onChange={e => setNewTask({...newTask, priority: e.target.value as TaskPriority})} className="w-full p-2 border border-gray-300 rounded-lg outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-200 bg-white text-gray-900 appearance-none">
                                    <option value="lowest">1 - Mínima</option>
                                    <option value="low">2 - Baixa</option>
                                    <option value="medium">3 - Normal</option>
                                    <option value="high">4 - Alta</option>
                                    <option value="highest">5 - Urgente</option>
                                </select>
                            </div>
                        </div>
                        <div className="flex gap-3 pt-2">
                            <button type="button" onClick={resetForm} className="flex-1 py-2 bg-gray-100 text-gray-700 font-bold rounded-lg hover:bg-gray-200">Cancelar</button>
                            <button type="submit" className="flex-1 py-2 bg-purple-600 text-white font-bold rounded-lg hover:bg-purple-700 shadow-md">{editingId ? 'Atualizar' : 'Salvar'}</button>
                        </div>
                    </form>
                </div>
            </div>
        )}
    </div>
  );
};

export default AgendaSystem;
