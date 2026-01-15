
import React, { useState, useMemo } from 'react';
import { AgendaItem, User, TaskPriority, SystemLog } from '../types';
import { Calendar, Plus, CheckCircle, Circle, Trash2, Bell, AlertTriangle, Clock, AlignLeft, Flag, Edit, X, Loader2, Save, ChevronLeft, ChevronRight, Check } from 'lucide-react';

interface AgendaSystemProps {
  user: User;
  tasks: AgendaItem[];
  onAddTask: (task: Partial<AgendaItem>) => Promise<void>; 
  onUpdateTask: (task: AgendaItem) => Promise<void>;
  onDeleteTask: (id: string) => Promise<void>;
  onLogAction?: (action: string, details: string) => void;
}

const PRIORITY_COLORS = {
  highest: 'bg-red-600',
  high: 'bg-orange-500',
  medium: 'bg-blue-500',
  low: 'bg-green-500',
  lowest: 'bg-gray-400'
};

const WEEK_DAYS = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];

const AgendaSystem: React.FC<AgendaSystemProps> = ({ user, tasks, onAddTask, onUpdateTask, onDeleteTask }) => {
  const [currentWeekStart, setCurrentWeekStart] = useState(() => {
      const now = new Date();
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Adjust to Monday
      return new Date(now.setDate(diff));
  });

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedTask, setSelectedTask] = useState<AgendaItem | null>(null);
  const [completeNote, setCompleteNote] = useState('');

  const [formData, setFormData] = useState<Partial<AgendaItem>>({
      title: '',
      description: '',
      dueDate: new Date().toISOString().split('T')[0],
      priority: 'medium',
      reminder_level: 1
  });

  const weekDates = useMemo(() => {
      return Array.from({ length: 7 }, (_, i) => {
          const d = new Date(currentWeekStart);
          d.setDate(d.getDate() + i);
          return d.toISOString().split('T')[0];
      });
  }, [currentWeekStart]);

  const tasksByDay = useMemo(() => {
      const grouped: Record<string, AgendaItem[]> = {};
      weekDates.forEach(date => grouped[date] = []);
      (tasks || []).filter(t => t.userId === user.id).forEach(task => {
          const dateKey = task.dueDate;
          if (grouped[dateKey]) grouped[dateKey].push(task);
      });
      return grouped;
  }, [tasks, weekDates, user.id]);

  const handleSaveTask = async (e: React.FormEvent) => {
      e.preventDefault();
      setIsSubmitting(true);
      try {
          await onAddTask({ ...formData, userId: user.id });
          setIsModalOpen(false);
          setFormData({ title: '', description: '', dueDate: new Date().toISOString().split('T')[0], priority: 'medium', reminder_level: 1 });
      } catch (err) {
          alert("Erro ao salvar tarefa.");
      } finally {
          setIsSubmitting(false);
      }
  };

  const handleComplete = async (task: AgendaItem) => {
      if (!completeNote) {
          setSelectedTask(task);
          return;
      }
      setIsSubmitting(true);
      try {
          await onUpdateTask({ ...task, isCompleted: true, completed_note: completeNote });
          setSelectedTask(null);
          setCompleteNote('');
      } catch (e) {
          alert("Erro ao concluir.");
      } finally {
          setIsSubmitting(false);
      }
  };

  const changeWeek = (direction: number) => {
      const next = new Date(currentWeekStart);
      next.setDate(next.getDate() + (direction * 7));
      setCurrentWeekStart(next);
  };

  return (
    <div className="p-4 md:p-8 max-w-full mx-auto space-y-6 animate-in fade-in duration-500">
        
        {/* Header Agenda */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-6 bg-white p-8 rounded-[40px] shadow-sm border border-gray-100">
            <div>
                <h2 className="text-3xl font-black text-gray-900 uppercase italic tracking-tighter leading-none flex items-center gap-3">
                    <Calendar className="text-purple-600" size={36} />
                    Agenda <span className="text-blue-700">Semanal</span>
                </h2>
                <p className="text-gray-400 text-[10px] font-black uppercase tracking-[0.3em] mt-2">Gestão de Prioridades e Lembretes por Nível</p>
            </div>
            
            <div className="flex items-center gap-3">
                <div className="flex bg-gray-100 p-1 rounded-2xl border border-gray-200">
                    <button onClick={() => changeWeek(-1)} className="p-3 hover:bg-white hover:text-purple-600 rounded-xl transition-all"><ChevronLeft size={18}/></button>
                    <div className="px-6 py-2.5 text-[10px] font-black uppercase text-gray-600 flex flex-col items-center justify-center">
                        <span>Semana de Referência</span>
                        <span className="text-blue-900">{new Date(weekDates[0]).toLocaleDateString('pt-BR')} - {new Date(weekDates[6]).toLocaleDateString('pt-BR')}</span>
                    </div>
                    <button onClick={() => changeWeek(1)} className="p-3 hover:bg-white hover:text-purple-600 rounded-xl transition-all"><ChevronRight size={18}/></button>
                </div>
                <button onClick={() => setIsModalOpen(true)} className="bg-gray-900 text-white px-8 py-4 rounded-2xl font-black uppercase text-xs shadow-xl active:scale-95 transition-all border-b-4 border-purple-600 flex items-center gap-2">
                    <Plus size={18} /> Nova Tarefa
                </button>
            </div>
        </div>

        {/* Weekly Calendar Grid */}
        <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
            {weekDates.map((date, idx) => {
                const dayTasks = tasksByDay[date] || [];
                const isToday = date === new Date().toISOString().split('T')[0];
                return (
                    <div key={date} className={`bg-white rounded-[32px] shadow-sm border-2 min-h-[500px] flex flex-col overflow-hidden transition-all ${isToday ? 'border-purple-200 bg-purple-50/10 ring-4 ring-purple-100' : 'border-gray-100'}`}>
                        <div className={`p-4 text-center border-b ${isToday ? 'bg-purple-600 text-white' : 'bg-gray-50 text-gray-900'}`}>
                            <p className="text-[10px] font-black uppercase tracking-widest">{WEEK_DAYS[idx]}</p>
                            <p className="text-xl font-black italic mt-1">{date.split('-')[2]}</p>
                        </div>
                        <div className="flex-1 p-3 space-y-3 overflow-y-auto no-scrollbar">
                            {dayTasks.map(task => (
                                <div key={task.id} className={`p-4 rounded-2xl border transition-all group ${task.isCompleted ? 'bg-gray-50 opacity-50 grayscale' : 'bg-white shadow-sm hover:border-purple-300'}`}>
                                    <div className="flex justify-between items-start mb-2">
                                        <div className={`w-2 h-2 rounded-full ${PRIORITY_COLORS[task.priority]}`}></div>
                                        {!task.isCompleted && <span className={`text-[8px] font-black px-1.5 py-0.5 rounded border ${task.reminder_level === 3 ? 'bg-red-50 text-red-600 border-red-200' : 'bg-blue-50 text-blue-600 border-blue-200'}`}>Nível {task.reminder_level}</span>}
                                    </div>
                                    <h4 className="font-black text-[11px] uppercase italic text-gray-900 leading-tight mb-1">{task.title}</h4>
                                    <p className="text-[9px] text-gray-500 font-medium line-clamp-2">{task.description}</p>
                                    
                                    <div className="mt-4 flex justify-between items-center opacity-0 group-hover:opacity-100 transition-opacity">
                                        {!task.isCompleted ? (
                                            <button onClick={() => handleComplete(task)} className="p-2 bg-green-50 text-green-600 rounded-lg hover:bg-green-600 hover:text-white transition-all"><Check size={14} strokeWidth={4}/></button>
                                        ) : (
                                            <div className="text-[8px] font-black uppercase text-green-600 italic">Concluído</div>
                                        )}
                                        <button onClick={() => onDeleteTask(task.id)} className="p-2 text-gray-300 hover:text-red-600 transition-all"><Trash2 size={14}/></button>
                                    </div>
                                </div>
                            ))}
                            {dayTasks.length === 0 && (
                                <div className="h-full flex items-center justify-center">
                                    <p className="text-[9px] font-black uppercase text-gray-300 italic tracking-widest text-center px-4">Livre</p>
                                </div>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>

        {/* MODAL JUSTIFICAÇÃO */}
        {selectedTask && (
            <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                <div className="bg-white p-8 rounded-[40px] shadow-2xl max-w-md w-full border-t-8 border-green-600 animate-in zoom-in duration-300">
                    <h3 className="text-xl font-black text-gray-900 uppercase italic mb-2">Confirmar Execução</h3>
                    <p className="text-gray-500 text-xs font-bold uppercase mb-6 tracking-widest">{selectedTask.title}</p>
                    <div className="space-y-4">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block ml-2">Nota / Justificativa</label>
                        <textarea required value={completeNote} onChange={e => setCompleteNote(e.target.value)} className="w-full p-4 bg-gray-50 rounded-2xl border-none outline-none text-sm font-bold text-gray-900 h-32" placeholder="O que foi feito?..." />
                        <div className="flex gap-3">
                            <button onClick={() => setSelectedTask(null)} className="flex-1 py-4 bg-gray-100 text-gray-500 font-black uppercase text-[10px] rounded-xl">Cancelar</button>
                            <button onClick={() => handleComplete(selectedTask)} disabled={!completeNote || isSubmitting} className="flex-1 py-4 bg-green-600 text-white font-black uppercase text-[10px] rounded-xl shadow-lg disabled:opacity-50">Concluir Tarefa</button>
                        </div>
                    </div>
                </div>
            </div>
        )}

        {/* MODAL CRIAR TAREFA */}
        {isModalOpen && (
            <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                <div className="bg-white p-10 rounded-[48px] shadow-2xl max-w-xl w-full border-t-8 border-purple-600 animate-in zoom-in duration-300">
                    <div className="flex justify-between items-center mb-8">
                        <h3 className="text-2xl font-black text-gray-900 uppercase italic tracking-tighter">Registrar <span className="text-purple-600">Prioridade</span></h3>
                        <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-red-600"><X size={32}/></button>
                    </div>
                    <form onSubmit={handleSaveTask} className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block ml-2">Título da Atividade</label>
                            <input required value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} className="w-full p-4 bg-gray-50 rounded-2xl border-none font-bold uppercase italic text-sm outline-none focus:ring-4 focus:ring-purple-100" />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block ml-2">Contexto / Detalhes</label>
                            <textarea value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="w-full p-4 bg-gray-50 rounded-2xl border-none font-medium text-sm outline-none focus:ring-4 focus:ring-purple-100 h-24" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block ml-2">Data Limite</label>
                                <input type="date" required value={formData.dueDate} onChange={e => setFormData({...formData, dueDate: e.target.value})} className="w-full p-4 bg-gray-50 rounded-2xl border-none font-black text-blue-900 text-xs" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block ml-2">Nível de Alerta</label>
                                <select value={formData.reminder_level} onChange={e => setFormData({...formData, reminder_level: parseInt(e.target.value) as any})} className="w-full p-4 bg-gray-50 rounded-2xl border-none font-black text-xs appearance-none">
                                    <option value={1}>Nível 1 (Popup)</option>
                                    <option value={2}>Nível 2 (Banner)</option>
                                    <option value={3}>Nível 3 (Bloqueio)</option>
                                </select>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block ml-2">Prioridade Visual</label>
                            <div className="flex gap-2 bg-gray-100 p-1.5 rounded-2xl">
                                {Object.keys(PRIORITY_COLORS).map(p => (
                                    <button key={p} type="button" onClick={() => setFormData({...formData, priority: p as TaskPriority})} className={`flex-1 py-2 text-[8px] font-black uppercase rounded-xl transition-all ${formData.priority === p ? 'bg-white shadow-md text-gray-900' : 'text-gray-400'}`}>{p}</button>
                                ))}
                            </div>
                        </div>
                        <button type="submit" disabled={isSubmitting} className="w-full py-5 bg-purple-600 text-white rounded-[24px] font-black uppercase text-xs shadow-xl active:scale-95 transition-all mt-4 border-b-4 border-purple-900">
                            {isSubmitting ? <Loader2 className="animate-spin mx-auto"/> : 'Agendar Atividade'}
                        </button>
                    </form>
                </div>
            </div>
        )}

    </div>
  );
};

export default AgendaSystem;
