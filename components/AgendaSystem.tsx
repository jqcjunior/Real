
import React, { useState, useEffect } from 'react';
import { AgendaItem, User, TaskPriority, SystemLog } from '../types';
import { Calendar, Plus, CheckCircle, Circle, Trash2, Bell, AlertTriangle, Clock, AlignLeft, Flag, Edit, X, Loader2, Save } from 'lucide-react';

interface AgendaSystemProps {
  user: User;
  tasks: AgendaItem[];
  onAddTask: (task: AgendaItem) => Promise<void>; 
  onUpdateTask: (task: AgendaItem) => Promise<void>;
  onDeleteTask: (id: string) => Promise<void>;
  onLogAction?: (action: SystemLog['action'], details: string) => void;
}

const AgendaSystem: React.FC<AgendaSystemProps> = ({ user, tasks, onAddTask, onUpdateTask, onDeleteTask, onLogAction }) => {
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed'>('all');
  
  const myTasks = (tasks || []).filter(t => t.userId === user.id).sort((a, b) => {
      if (a.isCompleted !== b.isCompleted) return a.isCompleted ? 1 : -1;
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
  });

  const filteredTasks = (myTasks || []).filter(t => {
      if (filter === 'pending') return !t.isCompleted;
      if (filter === 'completed') return t.isCompleted;
      return true;
  });

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto space-y-8">
        <h2 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
            <Calendar className="text-purple-600" size={32} /> Minha Agenda
        </h2>

        <div className="space-y-3">
            {(filteredTasks || []).map(task => (
                <div key={task.id} className={`bg-white p-5 rounded-2xl border flex items-start gap-4 ${task.isCompleted ? 'opacity-60' : ''}`}>
                    <div className="flex-1">
                        <h3 className="font-bold text-lg">{task.title}</h3>
                        <p className="text-sm text-gray-600">{task.description}</p>
                        <span className="text-xs font-bold text-purple-600 mt-2 block">{new Date(task.dueDate).toLocaleDateString('pt-BR')}</span>
                    </div>
                </div>
            ))}
            {filteredTasks.length === 0 && <div className="p-20 text-center text-gray-400">Nenhuma tarefa encontrada.</div>}
        </div>
    </div>
  );
};

export default AgendaSystem;
