import React, { useState, useMemo } from 'react';
import { AgendaItem, User, TaskPriority } from '../types';
import { Calendar, Plus, Trash2, ChevronLeft, ChevronRight, Check, X, Loader2, Clock, AlertCircle, Save, CalendarDays, AlignLeft, BarChart } from 'lucide-react';

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
      const diff = now.getDate() - day + (day === 0 ? -6 : 1);
      return new Date(now.setDate(diff));
  });

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
      title: '',
      description: '',
      dueDate: new Date().toISOString().split('T')[0],
      dueTime: '08:00',
      priority: 'medium' as TaskPriority
  });

  const weekDates = useMemo(() => {
      return Array.from({ length: 7 }, (_, i) => {
          const d = new Date(currentWeekStart);
          d.setDate(d.getDate() + i);
          return d.toISOString().split('T')[0];
      });
  }, [currentWeekStart]);

  // CORREÇÃO: Comparação robusta de ID e data
  const tasksByDay = useMemo(() => {
      const grouped: Record<string, AgendaItem[]> = {};
      weekDates.forEach(date => grouped[date] = []);
      
      (tasks || []).forEach(task => {
          // Garante que comparamos IDs como strings e datas limpas
          const isOwnTask = String(task.userId) === String(user.id);
          const taskDate = task.dueDate ? task.dueDate.split('T')[0] : '';
          
          if (isOwnTask && grouped[taskDate]) {
              grouped[taskDate].push(task);
          }
      });
      return grouped;
  }, [tasks, weekDates, user.id]);

  const handleSaveTask = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!formData.title || isSubmitting) return;
      
      setIsSubmitting(true);
      try {
          await onAddTask({
              ...formData,
              title: formData.title.toUpperCase(),
              isCompleted: false
          });
          setIsModalOpen(false);
          setFormData({
              title: '',
              description: '',
              dueDate: new Date().toISOString().split('T')[0],
              dueTime: '08:00',
              priority: 'medium'
          });
      } catch (error) {
          alert("Erro ao salvar tarefa.");
      } finally {
          setIsSubmitting(false);
      }
  };

  const changeWeek = (direction: 'next' | 'prev') => {
      const newDate = new Date(currentWeekStart);
      newDate.setDate(newDate.getDate() + (direction === 'next' ? 7 : -7));
      setCurrentWeekStart(newDate);
  };

  return (
    <div className="p-8 max-w-full mx-auto space-y-6 animate-in fade-in duration-500 pb-24">
        <div className="flex flex-col md:flex-row justify-between items-center bg-white p-6 rounded-[32px] shadow-sm border border-gray-100 gap-4">
            <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-100 text-blue-700 rounded-2xl shadow-inner"><Calendar size={24} /></div>
                <div>
                    <h2 className="text-2xl font-black text-gray-900 uppercase italic tracking-tighter leading-none">Minha <span className="text-red-600">Agenda Semanal</span></h2>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1 tracking-[0.2em]">Planejamento e Execução Estratégica</p>
                </div>
            </div>

            <div className="flex items-center gap-3">
                <div className="flex bg-gray-100 p-1 rounded-xl mr-4">
                    <button onClick={() => changeWeek('prev')} className="p-2 hover:bg-white hover:text-blue-600 rounded-lg transition-all"><ChevronLeft size={20}/></button>
                    <button onClick={() => setCurrentWeekStart(new Date())} className="px-4 py-2 text-[10px] font-black uppercase text-gray-500 hover:text-blue-600">Hoje</button>
                    <button onClick={() => changeWeek('next')} className="p-2 hover:bg-white hover:text-blue-600 rounded-lg transition-all"><ChevronRight size={20}/></button>
                </div>
                <button onClick={() => setIsModalOpen(true)} className="bg-gray-950 text-white px-8 py-3 rounded-2xl font-black uppercase text-[11px] shadow-xl hover:bg-black transition-all flex items-center gap-3 border-b-4 border-blue-600 active:scale-95">
                    <Plus size={18} /> Novo Agendamento
                </button>
            </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 h-auto lg:h-[calc(100vh-320px)] min-h-[500px]">
            {weekDates.map((date, idx) => {
                const dayTasks = tasksByDay[date] || [];
                const isToday = date === new Date().toISOString().split('T')[0];
                return (
                    <div key={date} className={`bg-white rounded-[32px] shadow-sm border-2 flex flex-col overflow-hidden transition-all ${isToday ? 'border-blue-400 ring-8 ring-blue-50' : 'border-gray-50'}`}>
                        <div className={`p-5 text-center border-b ${isToday ? 'bg-blue-600 text-white shadow-lg' : 'bg-gray-50/50 text-gray-400'}`}>
                            <p className="text-[10px] font-black uppercase tracking-widest mb-1">{WEEK_DAYS[idx]}</p>
                            <p className="text-2xl font-black italic leading-none">{date.split('-')[2]}</p>
                        </div>
                        <div className="flex-1 p-3 space-y-3 overflow-y-auto no-scrollbar bg-gray-50/10">
                            {dayTasks.map(task => (
                                <div key={task.id} className={`p-4 rounded-2xl border transition-all group relative ${task.isCompleted ? 'bg-gray-50 opacity-40 grayscale italic border-dashed' : 'bg-white shadow-sm hover:shadow-md border-gray-100'}`}>
                                    <div className="flex justify-between items-start mb-2">
                                        <div className={`w-2 h-2 rounded-full shadow-sm ${PRIORITY_COLORS[task.priority]}`}></div>
                                        <span className="text-[8px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full uppercase tracking-tighter">{task.dueTime.substring(0,5)}</span>
                                    </div>
                                    <h4 className="font-black text-[11px] uppercase italic text-gray-900 leading-tight mb-2">{task.title}</h4>
                                    {!task.isCompleted && (
                                        <button onClick={() => onUpdateTask({...task, isCompleted: true})} className="w-full py-2 mt-2 bg-blue-50 text-blue-700 rounded-xl text-[9px] font-black uppercase hover:bg-blue-600 hover:text-white transition-all">Concluir</button>
                                    )}
                                    <button onClick={() => onDeleteTask(task.id)} className="absolute top-2 right-2 p-1 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"><Trash2 size={12}/></button>
                                </div>
                            ))}
                            {dayTasks.length === 0 && (
                                <div className="h-full flex flex-col items-center justify-center opacity-5 grayscale py-10">
                                    <CalendarDays size={48}/>
                                </div>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>

        {/* MODAL DE CADASTRO */}
        {isModalOpen && (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[200] p-4">
                <div className="bg-white rounded-[40px] w-full max-w-md shadow-2xl animate-in zoom-in duration-300 overflow-hidden border-t-8 border-blue-600">
                    <div className="p-8 border-b bg-gray-50 flex justify-between items-center">
                        <h3 className="text-xl font-black uppercase italic text-blue-950 flex items-center gap-3">
                            <Plus className="text-blue-600" size={20} /> Novo <span className="text-blue-600">Agendamento</span>
                        </h3>
                        <button onClick={() => setIsModalOpen(false)} className="bg-white p-2 rounded-full text-gray-400 hover:text-red-600 shadow-sm border"><X size={20} /></button>
                    </div>
                    
                    <form onSubmit={handleSaveTask} className="p-8 space-y-6">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-400 uppercase ml-2 tracking-widest flex items-center gap-2"><AlignLeft size={12}/> Título da Tarefa</label>
                            <input 
                                required 
                                value={formData.title} 
                                onChange={e => setFormData({...formData, title: e.target.value})} 
                                className="w-full p-4 bg-gray-50 border-none rounded-2xl font-black text-gray-800 uppercase italic outline-none focus:ring-4 focus:ring-blue-50 transition-all shadow-inner" 
                                placeholder="EX: REUNIÃO DE METAS"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-gray-400 uppercase ml-2 tracking-widest flex items-center gap-2"><CalendarDays size={12}/> Data</label>
                                <input 
                                    type="date" 
                                    required 
                                    value={formData.dueDate} 
                                    onChange={e => setFormData({...formData, dueDate: e.target.value})} 
                                    className="w-full p-4 bg-gray-50 border-none rounded-2xl font-bold text-gray-700 outline-none shadow-inner" 
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-gray-400 uppercase ml-2 tracking-widest flex items-center gap-2"><Clock size={12}/> Horário</label>
                                <input 
                                    type="time" 
                                    required 
                                    value={formData.dueTime} 
                                    onChange={e => setFormData({...formData, dueTime: e.target.value})} 
                                    className="w-full p-4 bg-gray-50 border-none rounded-2xl font-bold text-gray-700 outline-none shadow-inner" 
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-400 uppercase ml-2 tracking-widest flex items-center gap-2"><BarChart size={12}/> Prioridade</label>
                            <div className="grid grid-cols-5 gap-2">
                                {(['lowest', 'low', 'medium', 'high', 'highest'] as TaskPriority[]).map(p => (
                                    <button 
                                        key={p} 
                                        type="button" 
                                        onClick={() => setFormData({...formData, priority: p})} 
                                        className={`h-10 rounded-xl transition-all border-2 flex items-center justify-center ${formData.priority === p ? `${PRIORITY_COLORS[p]} border-transparent scale-110 shadow-lg` : 'bg-gray-50 border-gray-100 hover:border-gray-200'}`}
                                    >
                                        <div className={`w-3 h-3 rounded-full ${formData.priority === p ? 'bg-white' : PRIORITY_COLORS[p]}`}></div>
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-400 uppercase ml-2 tracking-widest">Descrição (Opcional)</label>
                            <textarea 
                                value={formData.description} 
                                onChange={e => setFormData({...formData, description: e.target.value})} 
                                className="w-full p-4 bg-gray-50 border-none rounded-2xl font-medium text-gray-700 outline-none shadow-inner h-24 no-scrollbar resize-none" 
                                placeholder="Detalhes do que deve ser feito..."
                            />
                        </div>

                        <button 
                            type="submit" 
                            disabled={isSubmitting} 
                            className="w-full py-5 bg-blue-900 text-white rounded-[28px] font-black uppercase text-xs shadow-xl active:scale-95 transition-all border-b-4 border-blue-950 flex items-center justify-center gap-2 hover:bg-black"
                        >
                            {isSubmitting ? <Loader2 className="animate-spin" /> : <Save size={18}/>} AGENDAR TAREFA
                        </button>
                    </form>
                </div>
            </div>
        )}
    </div>
  );
};

export default AgendaSystem;