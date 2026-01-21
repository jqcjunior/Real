
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
      const diff = now.getDate() - day + (day === 0 ? -6 : 1);
      return new Date(now.setDate(diff));
  });

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
      return grouped;
  }, [tasks, weekDates, user.id]);

  return (
    <div className="p-8 max-w-full mx-auto space-y-6 animate-in fade-in duration-500 pb-24">
        <div className="flex justify-between items-center bg-white p-6 rounded-[32px] shadow-sm border border-gray-100">
            <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-100 text-blue-700 rounded-2xl shadow-inner"><Calendar size={24} /></div>
                <div>
                    <h2 className="text-2xl font-black text-gray-900 uppercase italic tracking-tighter leading-none">Minha <span className="text-red-600">Agenda Semanal</span></h2>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1 tracking-[0.2em]">Planejamento e Execução Estratégica</p>
                </div>
            </div>
            <div className="flex items-center gap-3">
                <button onClick={() => setIsModalOpen(true)} className="bg-gray-950 text-white px-8 py-3 rounded-2xl font-black uppercase text-[11px] shadow-xl hover:bg-black transition-all flex items-center gap-3 border-b-4 border-blue-600 active:scale-95">
                    <Plus size={18} /> Novo Agendamento
                </button>
            </div>
        </div>

        {/* Grade de Dias da Semana Lado a Lado */}
        <div className="grid grid-cols-7 gap-3 h-[calc(100vh-320px)] min-h-[500px]">
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
                                <div key={task.id} className={`p-4 rounded-2xl border transition-all ${task.isCompleted ? 'bg-gray-50 opacity-40 grayscale italic border-dashed' : 'bg-white shadow-sm hover:shadow-md border-gray-100'}`}>
                                    <div className="flex justify-between items-start mb-2">
                                        <div className={`w-2 h-2 rounded-full shadow-sm ${PRIORITY_COLORS[task.priority]}`}></div>
                                        <span className="text-[8px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full uppercase tracking-tighter">{task.dueTime.substring(0,5)}</span>
                                    </div>
                                    <h4 className="font-black text-[11px] uppercase italic text-gray-900 leading-tight mb-2">{task.title}</h4>
                                    {!task.isCompleted && (
                                        <button onClick={() => onUpdateTask({...task, isCompleted: true})} className="w-full py-2 mt-2 bg-blue-50 text-blue-700 rounded-xl text-[9px] font-black uppercase hover:bg-blue-600 hover:text-white transition-all">Concluir</button>
                                    )}
                                </div>
                            ))}
                            {dayTasks.length === 0 && (
                                <div className="h-full flex flex-col items-center justify-center opacity-5 grayscale">
                                    <Calendar size={48}/>
                                </div>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    </div>
  );
};

export default AgendaSystem;
