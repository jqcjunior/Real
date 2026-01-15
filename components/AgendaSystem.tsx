
import React, { useState, useMemo } from 'react';
import { AgendaItem, User, TaskPriority } from '../types';
import { Calendar, Plus, Trash2, ChevronLeft, ChevronRight, Check, X, Loader2, Clock, AlertCircle } from 'lucide-react';

interface AgendaSystemProps {
  user: User;
  tasks: AgendaItem[];
  onAddTask: (task: Partial<AgendaItem>) => Promise<void>; 
  onUpdateTask: (task: AgendaItem) => Promise<void>;
  onDeleteTask: (id: string) => Promise<void>;
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
      const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Monday
      return new Date(now.setDate(diff));
  });

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedTaskForComplete, setSelectedTaskForComplete] = useState<AgendaItem | null>(null);
  const [completeNote, setCompleteNote] = useState('');

  const [formData, setFormData] = useState<Partial<AgendaItem>>({
      title: '',
      description: '',
      dueDate: new Date().toISOString().split('T')[0],
      dueTime: '08:00',
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
          if (grouped[task.dueDate]) grouped[task.dueDate].push(task);
      });
      // Sort tasks within each day by time
      Object.keys(grouped).forEach(date => {
          grouped[date].sort((a, b) => (a.dueTime || '00:00').localeCompare(b.dueTime || '00:00'));
      });
      return grouped;
  }, [tasks, weekDates, user.id]);

  const handleSaveTask = async (e: React.FormEvent) => {
      e.preventDefault();
      setIsSubmitting(true);
      try {
          await onAddTask({ ...formData, userId: user.id });
          setIsModalOpen(false);
          setFormData({ title: '', description: '', dueDate: new Date().toISOString().split('T')[0], dueTime: '08:00', priority: 'medium', reminder_level: 1 });
      } catch (err) {
          alert("Erro ao salvar tarefa.");
      } finally {
          setIsSubmitting(false);
      }
  };

  const handleCompleteTask = async () => {
      if (!selectedTaskForComplete) return;
      if (!completeNote && selectedTaskForComplete.reminder_level >= 2) {
          alert("Justificativa obrigatória para tarefas de nível superior.");
          return;
      }
      setIsSubmitting(true);
      try {
          await onUpdateTask({ 
              ...selectedTaskForComplete, 
              isCompleted: true, 
              completed_note: completeNote 
          });
          setSelectedTaskForComplete(null);
          setCompleteNote('');
      } catch (e) {
          alert("Erro ao concluir tarefa.");
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
        
        {/* Agenda Toolbar */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-6 bg-white p-6 rounded-[32px] shadow-sm border border-gray-100">
            <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-100 text-blue-700 rounded-2xl shadow-inner"><Calendar size={28} /></div>
                <div>
                    <h2 className="text-2xl font-black text-gray-900 uppercase italic tracking-tighter leading-none">Minha <span className="text-red-600">Agenda</span></h2>
                    <p className="text-gray-400 text-[9px] font-black uppercase tracking-widest mt-1">Controle Semanal de Compromissos</p>
                </div>
            </div>
            
            <div className="flex items-center gap-3">
                <div className="flex bg-gray-100 p-1 rounded-2xl border border-gray-200 items-center">
                    <button onClick={() => changeWeek(-1)} className="p-2 hover:bg-white hover:text-blue-600 rounded-xl transition-all"><ChevronLeft size={18}/></button>
                    <div className="px-4 py-1 text-[9px] font-black uppercase text-gray-600 text-center">
                        <span className="block text-blue-900">{new Date(weekDates[0]).toLocaleDateString('pt-BR', {day:'2-digit', month:'2-digit'})} - {new Date(weekDates[6]).toLocaleDateString('pt-BR', {day:'2-digit', month:'2-digit'})}</span>
                    </div>
                    <button onClick={() => changeWeek(1)} className="p-2 hover:bg-white hover:text-blue-600 rounded-xl transition-all"><ChevronRight size={18}/></button>
                </div>
                <button onClick={() => setIsModalOpen(true)} className="bg-gray-900 text-white px-6 py-3.5 rounded-2xl font-black uppercase text-xs shadow-xl active:scale-95 transition-all border-b-4 border-blue-600 flex items-center gap-2">
                    <Plus size={18} /> Agendar
                </button>
            </div>
        </div>

        {/* Weekly Calendar Grid (7 Columns) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
            {weekDates.map((date, idx) => {
                const dayTasks = tasksByDay[date] || [];
                const isToday = date === new Date().toISOString().split('T')[0];
                return (
                    <div key={date} className={`bg-white rounded-[28px] shadow-sm border-2 min-h-[450px] flex flex-col overflow-hidden transition-all ${isToday ? 'border-blue-200 ring-4 ring-blue-50' : 'border-gray-50'}`}>
                        <div className={`p-4 text-center border-b ${isToday ? 'bg-blue-600 text-white' : 'bg-gray-50 text-gray-900'}`}>
                            <p className="text-[10px] font-black uppercase tracking-widest">{WEEK_DAYS[idx]}</p>
                            <p className="text-xl font-black italic leading-none mt-1">{date.split('-')[2]}</p>
                        </div>
                        
                        <div className="flex-1 p-3 space-y-3 overflow-y-auto no-scrollbar">
                            {dayTasks.map(task => (
                                <div key={task.id} className={`p-3 rounded-2xl border transition-all relative group ${task.isCompleted ? 'bg-gray-50 border-gray-100 opacity-60 grayscale' : 'bg-white shadow-sm hover:border-blue-300'}`}>
                                    <div className="flex justify-between items-start mb-2">
                                        <div className={`w-2 h-2 rounded-full ${PRIORITY_COLORS[task.priority]}`}></div>
                                        <div className="flex flex-col items-end">
                                            <span className="text-[8px] font-black text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded uppercase flex items-center gap-1">
                                                <Clock size={8}/> {task.dueTime.substring(0,5)}
                                            </span>
                                            {!task.isCompleted && (
                                                <span className={`text-[7px] font-black uppercase tracking-tighter mt-1 px-1 rounded ${task.reminder_level === 3 ? 'text-red-600 bg-red-50' : 'text-gray-400'}`}>
                                                    Nível {task.reminder_level}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <h4 className="font-black text-[11px] uppercase italic text-gray-900 leading-tight mb-1">{task.title}</h4>
                                    <p className="text-[9px] text-gray-400 font-medium line-clamp-2 leading-relaxed">{task.description}</p>
                                    
                                    <div className="mt-3 flex justify-between items-center opacity-0 group-hover:opacity-100 transition-opacity">
                                        {!task.isCompleted ? (
                                            <button onClick={() => setSelectedTaskForComplete(task)} className="p-1.5 bg-green-50 text-green-600 rounded-lg hover:bg-green-600 hover:text-white transition-all shadow-sm">
                                                <Check size={12} strokeWidth={4}/>
                                            </button>
                                        ) : (
                                            <div className="text-[8px] font-black uppercase text-green-600 italic">Efetuado</div>
                                        )}
                                        <button onClick={() => onDeleteTask(task.id)} className="p-1.5 text-gray-200 hover:text-red-500 transition-all"><Trash2 size={12}/></button>
                                    </div>
                                </div>
                            ))}
                            {dayTasks.length === 0 && (
                                <div className="h-full flex items-center justify-center opacity-10 py-10">
                                    <Calendar size={32} className="text-gray-300" />
                                </div>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>

        {/* Conclusion Note Modal */}
        {selectedTaskForComplete && (
            <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                <div className="bg-white p-8 rounded-[40px] shadow-2xl max-w-md w-full border-t-8 border-green-600 animate-in zoom-in duration-300">
                    <h3 className="text-xl font-black text-gray-900 uppercase italic mb-2">Finalizar Tarefa</h3>
                    <p className="text-gray-400 text-xs font-bold uppercase mb-6 tracking-widest">{selectedTaskForComplete.title}</p>
                    <div className="space-y-4">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block ml-2">Justificativa / Nota de Execução</label>
                        <textarea 
                            required={selectedTaskForComplete.reminder_level >= 2} 
                            value={completeNote} 
                            onChange={e => setCompleteNote(e.target.value)} 
                            className="w-full p-4 bg-gray-50 rounded-2xl border-none outline-none text-sm font-bold text-gray-900 h-32 focus:ring-2 focus:ring-green-100 shadow-inner" 
                            placeholder="O que foi realizado nesta tarefa?..." 
                        />
                        <div className="flex gap-3">
                            <button onClick={() => { setSelectedTaskForComplete(null); setCompleteNote(''); }} className="flex-1 py-4 bg-gray-100 text-gray-500 font-black uppercase text-[10px] rounded-xl">Voltar</button>
                            <button 
                                onClick={handleCompleteTask} 
                                disabled={(selectedTaskForComplete.reminder_level >= 2 && !completeNote) || isSubmitting} 
                                className="flex-1 py-4 bg-green-600 text-white font-black uppercase text-[10px] rounded-xl shadow-lg disabled:opacity-50"
                            >
                                {isSubmitting ? <Loader2 size={16} className="animate-spin mx-auto"/> : 'Confirmar Conclusão'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        )}

        {/* Create Task Modal */}
        {isModalOpen && (
            <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                <div className="bg-white p-10 rounded-[48px] shadow-2xl max-w-2xl w-full border-t-8 border-blue-600 animate-in zoom-in duration-300">
                    <div className="flex justify-between items-center mb-8">
                        <h3 className="text-2xl font-black text-gray-900 uppercase italic tracking-tighter">Novo <span className="text-blue-600">Compromisso</span></h3>
                        <button onClick={() => setIsModalOpen(false)} className="text-gray-300 hover:text-red-600 transition-colors"><X size={32}/></button>
                    </div>
                    <form onSubmit={handleSaveTask} className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block ml-2">Título da Atividade</label>
                            <input required value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} className="w-full p-4 bg-gray-50 rounded-2xl border-none font-bold uppercase italic text-sm outline-none focus:ring-4 focus:ring-blue-50" placeholder="EX: REUNIÃO COM A EQUIPE" />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block ml-2">Descrição / Contexto</label>
                            <textarea value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="w-full p-4 bg-gray-50 rounded-2xl border-none font-medium text-sm outline-none focus:ring-4 focus:ring-blue-50 h-24 resize-none" placeholder="Detalhes importantes..." />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block ml-2">Data</label>
                                <input type="date" required value={formData.dueDate} onChange={e => setFormData({...formData, dueDate: e.target.value})} className="w-full p-4 bg-gray-50 rounded-2xl border-none font-black text-blue-900 text-xs shadow-inner" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block ml-2">Hora</label>
                                <input type="time" required value={formData.dueTime} onChange={e => setFormData({...formData, dueTime: e.target.value})} className="w-full p-4 bg-gray-50 rounded-2xl border-none font-black text-blue-900 text-xs shadow-inner" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block ml-2">Nível de Aviso</label>
                                <select value={formData.reminder_level} onChange={e => setFormData({...formData, reminder_level: parseInt(e.target.value) as any})} className="w-full p-4 bg-gray-50 rounded-2xl border-none font-black text-xs appearance-none shadow-inner cursor-pointer">
                                    <option value={1}>Nível 1 (Popup)</option>
                                    <option value={2}>Nível 2 (Banner Topo)</option>
                                    <option value={3}>Nível 3 (Bloqueante)</option>
                                </select>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block ml-2">Prioridade Visual</label>
                            <div className="flex gap-2 bg-gray-100 p-1.5 rounded-2xl">
                                {Object.keys(PRIORITY_COLORS).map(p => (
                                    <button key={p} type="button" onClick={() => setFormData({...formData, priority: p as TaskPriority})} className={`flex-1 py-3 text-[9px] font-black uppercase rounded-xl transition-all ${formData.priority === p ? 'bg-white shadow-md text-gray-900' : 'text-gray-400'}`}>{p}</button>
                                ))}
                            </div>
                        </div>
                        <button type="submit" disabled={isSubmitting} className="w-full py-5 bg-blue-600 text-white rounded-[24px] font-black uppercase text-xs shadow-xl active:scale-95 transition-all mt-4 border-b-4 border-blue-900">
                            {isSubmitting ? <Loader2 className="animate-spin mx-auto"/> : 'Finalizar Agendamento'}
                        </button>
                    </form>
                </div>
            </div>
        )}

    </div>
  );
};

export default AgendaSystem;
