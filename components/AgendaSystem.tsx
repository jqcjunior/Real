import React, { useState, useMemo } from 'react';
import { AgendaItem, User, TaskPriority } from '../types';
import { 
  Calendar as CalendarIcon, Plus, Trash2, ChevronLeft, ChevronRight, 
  X, Loader2, Clock, Save, CalendarDays, 
  AlignLeft, BarChart, Edit, Check, List, ToggleLeft, CheckSquare
} from 'lucide-react';
import { toast } from 'sonner';

interface AgendaSystemProps {
  user: User;
  tasks: AgendaItem[];
  onAddTask: (task: Partial<AgendaItem>) => Promise<void>; 
  onUpdateTask: (task: AgendaItem) => Promise<void>;
  onDeleteTask: (id: string) => Promise<void>;
}

const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

const WEEK_DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

const PRIORITY_LABELS: Record<TaskPriority, string> = {
  highest: 'Crítica',
  high: 'Alta',
  medium: 'Média',
  low: 'Baixa',
  lowest: 'Baixa'
};

const PRIORITY_COLORS: Record<TaskPriority, string> = {
  highest: 'bg-red-600',
  high: 'bg-orange-500',
  medium: 'bg-blue-500',
  low: 'bg-green-500',
  lowest: 'bg-gray-400'
};

const PRIORITY_BADGE_COLORS: Record<TaskPriority, string> = {
  highest: 'bg-red-50 text-red-700 border-red-200',
  high: 'bg-orange-50 text-orange-700 border-orange-200',
  medium: 'bg-blue-50 text-blue-700 border-blue-200',
  low: 'bg-green-50 text-green-700 border-green-200',
  lowest: 'bg-gray-50 text-gray-500 border-gray-200'
};

// Priority order for sorting: highest/critical first
const PRIORITY_ORDER: Record<TaskPriority, number> = {
  highest: 4,
  high: 3,
  medium: 2,
  low: 1,
  lowest: 0
};

function parseLocalDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day, 12, 0, 0);
}

function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export const AgendaSystem: React.FC<AgendaSystemProps> = ({ user, tasks, onAddTask, onUpdateTask, onDeleteTask }) => {
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar');
  const [currentMonth, setCurrentMonth] = useState(() => new Date());
  const [selectedDateStr, setSelectedDateStr] = useState(() => formatLocalDate(new Date()));
  
  // List Filters
  const [listStatusFilter, setListStatusFilter] = useState<'all' | 'pending' | 'completed'>('pending');
  const [listPriorityFilter, setListPriorityFilter] = useState<'all' | 'high_critical' | 'medium' | 'low'>('all');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingTask, setEditingTask] = useState<AgendaItem | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    dueDate: formatLocalDate(new Date()),
    dueTime: '08:00',
    priority: 'medium' as TaskPriority
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // TAREFAS AUTOMÁTICAS (SÁBADO: GERAR METAS DA SEMANA)
  // ═══════════════════════════════════════════════════════════════════════════
  const getSaturdaysRange = (startDateStr: string, endDateStr: string): string[] => {
    const dates: string[] = [];
    const start = parseLocalDate(startDateStr);
    const end = parseLocalDate(endDateStr);
    
    // Encontra o primeiro sábado
    const curr = new Date(start);
    while (curr.getDay() !== 6) {
      curr.setDate(curr.getDate() + 1);
    }
    
    const today = new Date();
    
    // Limita geração de sábados futuros a no máximo 1 semana após hoje para evitar poluir a agenda
    const maxFutureDate = new Date(today);
    maxFutureDate.setDate(maxFutureDate.getDate() + 14);

    while (curr <= end) {
      const sDateStr = formatLocalDate(curr);
      if (curr <= maxFutureDate) {
        dates.push(sDateStr);
      }
      curr.setDate(curr.getDate() + 7);
    }
    return dates;
  };

  const isUserManagerOrAdmin = useMemo(() => {
    const role = String(user?.role || '').toUpperCase().trim();
    return role === 'MANAGER' || role === 'ADMIN' || role === 'SUPER_ADMIN' || role === 'SUPER';
  }, [user]);

  // Injeta tarefas automáticas de sábado e filtra tarefas do próprio usuário
  const allEnrichedTasks = useMemo(() => {
    const filteredRealTasks = (tasks || []).filter(task => String(task.userId) === String(user.id));
    if (!isUserManagerOrAdmin) return filteredRealTasks;

    const saturdays = getSaturdaysRange('2026-06-01', '2026-12-31');
    const enriched = [...filteredRealTasks];

    saturdays.forEach(sDate => {
      const hasTask = filteredRealTasks.some(t => 
        t.title.toUpperCase().includes('GERAR METAS DA SEMANA') && 
        t.dueDate === sDate
      );

      if (!hasTask) {
        enriched.push({
          id: `system-meta-task-${sDate}`,
          userId: user.id,
          title: 'GERAR METAS DA SEMANA',
          description: 'Tarefa automática do sistema para gerar as metas da semana.',
          dueDate: sDate,
          dueTime: '08:00',
          priority: 'high',
          isCompleted: false,
          createdAt: parseLocalDate(sDate)
        });
      }
    });

    return enriched;
  }, [tasks, user.id, isUserManagerOrAdmin]);

  // ═══════════════════════════════════════════════════════════════════════════
  // CALENDAR GRID GENERATION (Google Calendar standard 42-cells)
  // ═══════════════════════════════════════════════════════════════════════════
  const calendarGrid = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    const daysInMonth = lastDay.getDate();
    const startDayOfWeek = firstDay.getDay(); // 0 = Dom, 6 = Sáb

    const grid: { dateStr: string; dayNum: number; isCurrentMonth: boolean }[] = [];

    // Preenchimento do mês anterior
    const prevMonthLast = new Date(year, month, 0).getDate();
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const d = new Date(year, month - 1, prevMonthLast - i);
      grid.push({
        dateStr: formatLocalDate(d),
        dayNum: d.getDate(),
        isCurrentMonth: false
      });
    }

    // Dias do mês atual
    for (let i = 1; i <= daysInMonth; i++) {
      const d = new Date(year, month, i);
      grid.push({
        dateStr: formatLocalDate(d),
        dayNum: i,
        isCurrentMonth: true
      });
    }

    // Preenchimento do próximo mês
    const totalCells = 42;
    const nextPaddingCount = totalCells - grid.length;
    for (let i = 1; i <= nextPaddingCount; i++) {
      const d = new Date(year, month + 1, i);
      grid.push({
        dateStr: formatLocalDate(d),
        dayNum: i,
        isCurrentMonth: false
      });
    }

    return grid;
  }, [currentMonth]);

  // Agrupa tarefas por data
  const tasksByDateMap = useMemo(() => {
    const map: Record<string, AgendaItem[]> = {};
    allEnrichedTasks.forEach(task => {
      const d = task.dueDate ? task.dueDate.split('T')[0] : '';
      if (!map[d]) map[d] = [];
      map[d].push(task);
    });

    // Ordenação de prioridade (Crítica/Alta antes) e depois por horário
    Object.keys(map).forEach(d => {
      map[d].sort((a, b) => {
        const pDiff = PRIORITY_ORDER[b.priority] - PRIORITY_ORDER[a.priority];
        if (pDiff !== 0) return pDiff;
        return (a.dueTime || '').localeCompare(b.dueTime || '');
      });
    });

    return map;
  }, [allEnrichedTasks]);

  // Lista de tarefas filtradas (Para visualização em LISTA)
  const filteredListTasks = useMemo(() => {
    return allEnrichedTasks.filter(task => {
      // Filtro de Status
      if (listStatusFilter === 'pending' && task.isCompleted) return false;
      if (listStatusFilter === 'completed' && !task.isCompleted) return false;

      // Filtro de Prioridade
      if (listPriorityFilter === 'high_critical') {
        return task.priority === 'highest' || task.priority === 'high';
      }
      if (listPriorityFilter === 'medium') return task.priority === 'medium';
      if (listPriorityFilter === 'low') return task.priority === 'low' || task.priority === 'lowest';

      return true;
    }).sort((a, b) => {
      // Ordenação primária: data
      const dateCompare = a.dueDate.localeCompare(b.dueDate);
      if (dateCompare !== 0) return dateCompare;
      
      // Ordenação secundária: prioridade
      const pDiff = PRIORITY_ORDER[b.priority] - PRIORITY_ORDER[a.priority];
      if (pDiff !== 0) return pDiff;

      // Ordenação terciária: hora
      return (a.dueTime || '').localeCompare(b.dueTime || '');
    });
  }, [allEnrichedTasks, listStatusFilter, listPriorityFilter]);

  // Tarefas do dia selecionado no calendário
  const selectedDayTasks = useMemo(() => {
    return tasksByDateMap[selectedDateStr] || [];
  }, [tasksByDateMap, selectedDateStr]);

  // ═══════════════════════════════════════════════════════════════════════════
  // HANDLERS
  // ═══════════════════════════════════════════════════════════════════════════
  const handleSaveTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || isSubmitting) return;

    setIsSubmitting(true);
    try {
      if (editingTask) {
        if (editingTask.id.startsWith('system-meta-task-')) {
          toast.error("Não é possível editar uma tarefa de sistema.");
          return;
        }
        await onUpdateTask({
          ...editingTask,
          ...formData,
          title: formData.title.toUpperCase()
        });
        toast.success("Tarefa atualizada com sucesso!");
      } else {
        await onAddTask({
          ...formData,
          title: formData.title.toUpperCase(),
          isCompleted: false
        });
        toast.success("Tarefa adicionada com sucesso!");
      }
      closeModal();
    } catch (error) {
      console.error("Erro ao salvar tarefa:", error);
      toast.error("Erro ao salvar tarefa.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleComplete = async (task: AgendaItem) => {
    try {
      if (task.id.startsWith('system-meta-task-')) {
        // Converte tarefa virtual para real no banco, já como concluída
        await onAddTask({
          title: task.title,
          description: task.description,
          dueDate: task.dueDate,
          dueTime: task.dueTime,
          priority: task.priority,
          isCompleted: true
        });
        toast.success("Tarefa de sistema concluída!");
      } else {
        await onUpdateTask({
          ...task,
          isCompleted: !task.isCompleted
        });
        toast.success(task.isCompleted ? "Tarefa marcada como pendente!" : "Tarefa concluída com sucesso!");
      }
    } catch (err) {
      console.error("Erro ao alternar conclusão da tarefa:", err);
      toast.error("Erro ao atualizar tarefa.");
    }
  };

  const openModal = (task?: AgendaItem, prefilledDate?: string) => {
    if (task) {
      if (task.id.startsWith('system-meta-task-')) {
        toast.error("Não é possível editar tarefas automáticas do sistema.");
        return;
      }
      setEditingTask(task);
      setFormData({
        title: task.title,
        description: task.description || '',
        dueDate: task.dueDate ? task.dueDate.split('T')[0] : formatLocalDate(new Date()),
        dueTime: task.dueTime || '08:00',
        priority: task.priority
      });
    } else {
      setEditingTask(null);
      setFormData({
        title: '',
        description: '',
        dueDate: prefilledDate || selectedDateStr || formatLocalDate(new Date()),
        dueTime: '08:00',
        priority: 'medium'
      });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingTask(null);
  };

  const changeMonth = (direction: 'next' | 'prev') => {
    const newMonth = new Date(currentMonth);
    newMonth.setMonth(newMonth.getMonth() + (direction === 'next' ? 1 : -1));
    setCurrentMonth(newMonth);
  };

  return (
    <div className="p-8 max-w-full mx-auto space-y-6 animate-in fade-in duration-500 pb-24">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-center bg-white p-6 rounded-[32px] shadow-sm border border-gray-100 gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-blue-100 text-blue-700 rounded-2xl shadow-inner">
            <CalendarIcon size={24} />
          </div>
          <div>
            <h2 className="text-2xl font-black text-gray-900 uppercase italic tracking-tighter leading-none">
              Minha <span className="text-blue-600">Agenda Operacional</span>
            </h2>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1 tracking-[0.2em]">
              Calendário de Tarefas e Compromissos
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Alternar Visualização */}
          <div className="flex bg-gray-100 p-1 rounded-2xl border border-gray-100 shadow-inner">
            <button 
              onClick={() => setViewMode('calendar')}
              className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-1.5 ${viewMode === 'calendar' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-400 hover:text-gray-700'}`}
            >
              <CalendarIcon size={12} /> Calendário
            </button>
            <button 
              onClick={() => setViewMode('list')}
              className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-1.5 ${viewMode === 'list' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-400 hover:text-gray-700'}`}
            >
              <List size={12} /> Lista
            </button>
          </div>

          <button 
            onClick={() => openModal()} 
            className="bg-gray-950 text-white px-6 py-3 rounded-2xl font-black uppercase text-[10px] shadow-lg hover:bg-black transition-all flex items-center gap-2 border-b-4 border-blue-600 active:scale-95"
          >
            <Plus size={16} /> Novo Compromisso
          </button>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════════
          MODO CALENDÁRIO MENSAL (GOOGLE CALENDAR STYLE)
          ═══════════════════════════════════════════════════════════════════════════ */}
      {viewMode === 'calendar' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* LADO ESQUERDO: Calendário Mensal (8 colunas) */}
          <div className="lg:col-span-8 bg-white p-6 rounded-[36px] shadow-sm border border-gray-100 flex flex-col space-y-5">
            {/* Controles de Mês */}
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-1">
                <span className="text-lg font-black text-gray-900 uppercase italic">
                  {MONTHS[currentMonth.getMonth()]}
                </span>
                <span className="text-lg font-black text-blue-600 ml-1">
                  {currentMonth.getFullYear()}
                </span>
              </div>

              <div className="flex bg-gray-50 p-1 rounded-xl border">
                <button 
                  onClick={() => changeMonth('prev')} 
                  className="p-2 hover:bg-white hover:text-blue-600 rounded-lg transition-all text-gray-500"
                >
                  <ChevronLeft size={16}/>
                </button>
                <button 
                  onClick={() => {
                    setCurrentMonth(new Date());
                    setSelectedDateStr(formatLocalDate(new Date()));
                  }} 
                  className="px-3 py-1.5 text-[9px] font-black uppercase text-gray-500 hover:text-blue-600"
                >
                  Hoje
                </button>
                <button 
                  onClick={() => changeMonth('next')} 
                  className="p-2 hover:bg-white hover:text-blue-600 rounded-lg transition-all text-gray-500"
                >
                  <ChevronRight size={16}/>
                </button>
              </div>
            </div>

            {/* Grid dos Dias da Semana */}
            <div className="grid grid-cols-7 gap-2 text-center">
              {WEEK_DAYS.map(wd => (
                <div key={wd} className="text-[9px] font-black text-gray-400 uppercase tracking-widest py-2">
                  {wd}
                </div>
              ))}
            </div>

            {/* Grid do Mês */}
            <div className="grid grid-cols-7 gap-2">
              {calendarGrid.map((cell, idx) => {
                const isSelected = cell.dateStr === selectedDateStr;
                const isToday = cell.dateStr === formatLocalDate(new Date());
                const dayTasks = tasksByDateMap[cell.dateStr] || [];
                const pendingTasksCount = dayTasks.filter(t => !t.isCompleted).length;

                return (
                  <button
                    key={`${cell.dateStr}-${idx}`}
                    onClick={() => setSelectedDateStr(cell.dateStr)}
                    className={`h-20 lg:h-24 p-2 rounded-2xl border text-left flex flex-col justify-between transition-all relative outline-none hover:scale-[1.02] active:scale-95 ${
                      !cell.isCurrentMonth ? 'bg-gray-50/40 border-gray-100 text-gray-300' : 'bg-white border-gray-100 text-gray-800'
                    } ${
                      isSelected ? 'border-blue-500 ring-4 ring-blue-50 z-10' : ''
                    } ${
                      isToday ? 'border-blue-200 bg-blue-50/20' : ''
                    }`}
                  >
                    {/* Número do dia e badge de pendência */}
                    <div className="flex justify-between items-center w-full">
                      <span className={`text-[11px] font-black ${
                        isToday ? 'bg-blue-600 text-white w-5 h-5 flex items-center justify-center rounded-full shadow-sm' : ''
                      } ${!cell.isCurrentMonth && !isSelected ? 'opacity-40' : ''}`}>
                        {cell.dayNum}
                      </span>
                      {pendingTasksCount > 0 && (
                        <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse shadow-sm"></span>
                      )}
                    </div>

                    {/* Previa de Tarefas */}
                    <div className="flex flex-col gap-0.5 w-full mt-1 overflow-hidden">
                      {dayTasks.slice(0, 2).map((t, tIdx) => (
                        <div 
                          key={t.id} 
                          className={`text-[8px] font-bold px-1 py-0.5 rounded-md truncate uppercase ${
                            t.isCompleted 
                              ? 'bg-gray-100 text-gray-400 line-through' 
                              : t.id.startsWith('system-meta-task-') 
                                ? 'bg-purple-100 text-purple-700 border border-purple-200' 
                                : 'bg-blue-50 text-blue-700 border border-blue-100'
                          }`}
                        >
                          {t.title}
                        </div>
                      ))}
                      {dayTasks.length > 2 && (
                        <div className="text-[7px] font-black text-gray-400 text-right uppercase tracking-tighter">
                          +{dayTasks.length - 2} itens
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* LADO DIREITO: Painel de Tarefas do Dia Selecionado (4 colunas) */}
          <div className="lg:col-span-4 bg-white p-6 rounded-[36px] shadow-sm border border-gray-100 space-y-5 flex flex-col h-full min-h-[400px]">
            <div className="border-b pb-4">
              <span className="text-[9px] font-black text-blue-600 uppercase tracking-widest block mb-1">
                Detalhamento Operacional
              </span>
              <h3 className="text-base font-black text-blue-950 uppercase italic leading-none">
                {selectedDateStr.split('-')[2]} de {MONTHS[parseInt(selectedDateStr.split('-')[1]) - 1]}
              </h3>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 no-scrollbar max-h-[350px]">
              {selectedDayTasks.length === 0 ? (
                <div className="py-10 text-center text-gray-400 flex flex-col items-center justify-center space-y-2">
                  <CalendarDays size={32} className="opacity-30" />
                  <p className="text-[10px] font-black uppercase">Nenhum compromisso para este dia.</p>
                  <button 
                    onClick={() => openModal(undefined, selectedDateStr)}
                    className="text-[9px] font-black text-blue-600 uppercase hover:underline"
                  >
                    + Adicionar Tarefa
                  </button>
                </div>
              ) : (
                selectedDayTasks.map(task => {
                  const isSystemTask = task.id.startsWith('system-meta-task-');
                  return (
                    <div 
                      key={task.id} 
                      className={`p-4 rounded-2xl border transition-all relative flex flex-col gap-2 ${
                        task.isCompleted 
                          ? 'bg-gray-50 opacity-40 grayscale italic border-dashed border-gray-200' 
                          : 'bg-white shadow-sm border-gray-100'
                      }`}
                    >
                      {/* Priority and Time Bar */}
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-1.5">
                          <span className={`w-2.5 h-2.5 rounded-full ${PRIORITY_COLORS[task.priority] || 'bg-gray-400'}`}></span>
                          <span className={`text-[8px] font-black px-1.5 py-0.5 rounded border uppercase ${PRIORITY_BADGE_COLORS[task.priority]}`}>
                            {PRIORITY_LABELS[task.priority]}
                          </span>
                          {isSystemTask && (
                            <span className="text-[8px] font-black px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200 uppercase tracking-tighter">
                              SISTEMA
                            </span>
                          )}
                        </div>
                        <span className="text-[9px] font-black text-gray-400 bg-gray-50 px-2 py-0.5 rounded flex items-center gap-1">
                          <Clock size={10} /> {task.dueTime}
                        </span>
                      </div>

                      {/* Title and Description */}
                      <div>
                        <h4 className={`text-[11px] font-black uppercase italic ${task.isCompleted ? 'line-through text-gray-400' : 'text-blue-950'}`}>
                          {task.title}
                        </h4>
                        {task.description && (
                          <p className="text-[9px] font-medium text-gray-400 line-clamp-2 mt-1 leading-relaxed">
                            {task.description}
                          </p>
                        )}
                      </div>

                      {/* Action buttons */}
                      <div className="flex gap-2 border-t pt-2.5 mt-1 justify-end">
                        <button
                          onClick={() => handleToggleComplete(task)}
                          className={`px-3 py-1.5 rounded-lg text-[8px] font-black uppercase transition-all flex items-center gap-1 ${
                            task.isCompleted 
                              ? 'bg-gray-100 text-gray-500 hover:bg-gray-200' 
                              : 'bg-blue-50 text-blue-700 hover:bg-blue-600 hover:text-white'
                          }`}
                        >
                          <Check size={10} /> {task.isCompleted ? 'Desmarcar' : 'Concluir'}
                        </button>

                        {!isSystemTask && (
                          <>
                            <button
                              onClick={() => openModal(task)}
                              className="p-1.5 bg-gray-50 text-gray-400 rounded-lg hover:bg-gray-100 hover:text-blue-600 transition-all border border-gray-100"
                            >
                              <Edit size={10} />
                            </button>
                            <button
                              onClick={() => {
                                if (confirm("Excluir esta tarefa?")) {
                                  onDeleteTask(task.id);
                                  toast.success("Tarefa excluída.");
                                }
                              }}
                              className="p-1.5 bg-gray-50 text-gray-400 rounded-lg hover:bg-red-50 hover:text-red-600 transition-all border border-gray-100"
                            >
                              <Trash2 size={10} />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {selectedDayTasks.length > 0 && (
              <button 
                onClick={() => openModal(undefined, selectedDateStr)}
                className="w-full py-3 bg-gray-50 hover:bg-blue-50 border border-gray-100 hover:border-blue-100 rounded-2xl text-[9px] font-black text-gray-500 hover:text-blue-600 uppercase transition-all flex items-center justify-center gap-1.5"
              >
                <Plus size={12} /> Adicionar Novo Compromisso
              </button>
            )}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════════
          MODO LISTA (COM FILTROS PODEROSOS)
          ═══════════════════════════════════════════════════════════════════════════ */}
      {viewMode === 'list' && (
        <div className="bg-white p-6 rounded-[36px] shadow-sm border border-gray-100 space-y-6">
          {/* Barra de Filtros */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-gray-50/50 p-4 rounded-2xl gap-4 border border-gray-100">
            <div className="flex flex-wrap items-center gap-4">
              {/* Filtro de Status */}
              <div className="flex flex-col gap-1">
                <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest ml-1">Status</span>
                <div className="flex bg-white p-0.5 rounded-xl border shadow-sm">
                  <button 
                    onClick={() => setListStatusFilter('pending')}
                    className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${listStatusFilter === 'pending' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-gray-700'}`}
                  >
                    Pendentes
                  </button>
                  <button 
                    onClick={() => setListStatusFilter('completed')}
                    className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${listStatusFilter === 'completed' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-gray-700'}`}
                  >
                    Concluídas
                  </button>
                  <button 
                    onClick={() => setListStatusFilter('all')}
                    className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${listStatusFilter === 'all' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-gray-700'}`}
                  >
                    Todas
                  </button>
                </div>
              </div>

              {/* Filtro de Prioridade */}
              <div className="flex flex-col gap-1">
                <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest ml-1">Prioridade</span>
                <div className="flex bg-white p-0.5 rounded-xl border shadow-sm">
                  <button 
                    onClick={() => setListPriorityFilter('all')}
                    className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${listPriorityFilter === 'all' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-gray-700'}`}
                  >
                    Todas
                  </button>
                  <button 
                    onClick={() => setListPriorityFilter('high_critical')}
                    className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${listPriorityFilter === 'high_critical' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-gray-700'}`}
                  >
                    Crítica/Alta
                  </button>
                  <button 
                    onClick={() => setListPriorityFilter('medium')}
                    className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${listPriorityFilter === 'medium' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-gray-700'}`}
                  >
                    Média
                  </button>
                  <button 
                    onClick={() => setListPriorityFilter('low')}
                    className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${listPriorityFilter === 'low' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-gray-700'}`}
                  >
                    Baixa
                  </button>
                </div>
              </div>
            </div>

            <span className="text-[9px] font-black text-blue-950 uppercase italic">
              {filteredListTasks.length} tarefas encontradas
            </span>
          </div>

          {/* Lista de Tarefas */}
          <div className="space-y-3">
            {filteredListTasks.length === 0 ? (
              <div className="py-20 text-center text-gray-300">
                <CheckSquare size={48} className="mx-auto opacity-30 mb-2" />
                <p className="text-[10px] font-black uppercase tracking-wider">Nenhuma tarefa com as especificações atuais.</p>
              </div>
            ) : (
              filteredListTasks.map(task => {
                const isSystemTask = task.id.startsWith('system-meta-task-');
                const [year, month, day] = task.dueDate.split('-');
                return (
                  <div 
                    key={task.id} 
                    className={`p-4 rounded-2xl border transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                      task.isCompleted 
                        ? 'bg-gray-50 opacity-40 grayscale italic border-dashed border-gray-200' 
                        : 'bg-white shadow-sm hover:shadow-md border-gray-100'
                    }`}
                  >
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      {/* Círculo com a Data */}
                      <div className="bg-gray-50 p-2.5 rounded-2xl flex flex-col items-center justify-center min-w-[52px] border text-blue-950">
                        <span className="text-sm font-black italic leading-none">{day}</span>
                        <span className="text-[8px] font-black uppercase">{MONTHS[parseInt(month) - 1]?.substring(0,3)}</span>
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1.5">
                          <span className={`w-2.5 h-2.5 rounded-full ${PRIORITY_COLORS[task.priority] || 'bg-gray-400'}`}></span>
                          <span className={`text-[8px] font-black px-1.5 py-0.5 rounded border uppercase ${PRIORITY_BADGE_COLORS[task.priority]}`}>
                            {PRIORITY_LABELS[task.priority]}
                          </span>
                          {isSystemTask && (
                            <span className="text-[8px] font-black px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200 uppercase tracking-tighter">
                              SISTEMA
                            </span>
                          )}
                          <span className="text-[9px] font-black text-gray-400 bg-gray-50 px-2 py-0.5 rounded flex items-center gap-1">
                            <Clock size={10} /> {task.dueTime}
                          </span>
                        </div>
                        <h4 className={`text-[11px] font-black uppercase italic ${task.isCompleted ? 'line-through text-gray-400' : 'text-blue-950'}`}>
                          {task.title}
                        </h4>
                        {task.description && (
                          <p className="text-[9px] font-medium text-gray-400 leading-relaxed mt-1">
                            {task.description}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Botões de Ação */}
                    <div className="flex gap-2 items-center justify-end">
                      <button
                        onClick={() => handleToggleComplete(task)}
                        className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase transition-all flex items-center gap-1.5 ${
                          task.isCompleted 
                            ? 'bg-gray-100 text-gray-500 hover:bg-gray-200' 
                            : 'bg-blue-50 text-blue-700 hover:bg-blue-600 hover:text-white'
                        }`}
                      >
                        <Check size={12} /> {task.isCompleted ? 'Desmarcar' : 'Concluir'}
                      </button>

                      {!isSystemTask && (
                        <>
                          <button
                            onClick={() => openModal(task)}
                            className="p-2.5 bg-gray-50 text-gray-400 rounded-xl hover:bg-gray-100 hover:text-blue-600 transition-all border border-gray-100"
                          >
                            <Edit size={12} />
                          </button>
                          <button
                            onClick={() => {
                              if (confirm("Excluir esta tarefa?")) {
                                onDeleteTask(task.id);
                                toast.success("Tarefa excluída.");
                              }
                            }}
                            className="p-2.5 bg-gray-50 text-gray-400 rounded-xl hover:bg-red-50 hover:text-red-600 transition-all border border-gray-100"
                          >
                            <Trash2 size={12} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════════
          MODAL DE CADASTRO / EDIÇÃO DE COMPROMISSO
          ═══════════════════════════════════════════════════════════════════════════ */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center z-[200] p-4">
          <div className="bg-white rounded-[40px] w-full max-w-md shadow-2xl animate-in zoom-in duration-300 overflow-hidden border-t-8 border-blue-600">
            <div className="p-8 border-b bg-gray-50 flex justify-between items-center">
              <h3 className="text-xl font-black uppercase italic text-blue-950 flex items-center gap-3">
                {editingTask ? (
                  <><Edit className="text-blue-600" size={20} /> Editar <span className="text-blue-600">Compromisso</span></>
                ) : (
                  <><Plus className="text-blue-600" size={20} /> Novo <span className="text-blue-600">Compromisso</span></>
                )}
              </h3>
              <button 
                onClick={closeModal} 
                className="bg-white p-2 rounded-full text-gray-400 hover:text-red-600 shadow-sm border transition-all"
              >
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSaveTask} className="p-8 space-y-6">
              {/* Título */}
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase ml-2 tracking-widest flex items-center gap-2">
                  <AlignLeft size={12}/> Título do Compromisso
                </label>
                <input 
                  required 
                  value={formData.title} 
                  onChange={e => setFormData({...formData, title: e.target.value})} 
                  className="w-full p-4 bg-gray-50 border-none rounded-2xl font-black text-gray-800 uppercase italic outline-none focus:ring-4 focus:ring-blue-50 transition-all shadow-inner" 
                  placeholder="EX: FAZER CONFERÊNCIA DE METAS"
                />
              </div>

              {/* Data e Hora */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase ml-2 tracking-widest flex items-center gap-2">
                    <CalendarDays size={12}/> Data
                  </label>
                  <input 
                    type="date" 
                    required 
                    value={formData.dueDate} 
                    onChange={e => setFormData({...formData, dueDate: e.target.value})} 
                    className="w-full p-4 bg-gray-50 border-none rounded-2xl font-bold text-gray-700 outline-none shadow-inner" 
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase ml-2 tracking-widest flex items-center gap-2">
                    <Clock size={12}/> Horário
                  </label>
                  <input 
                    type="time" 
                    required 
                    value={formData.dueTime} 
                    onChange={e => setFormData({...formData, dueTime: e.target.value})} 
                    className="w-full p-4 bg-gray-50 border-none rounded-2xl font-bold text-gray-700 outline-none shadow-inner" 
                  />
                </div>
              </div>

              {/* Prioridade */}
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase ml-2 tracking-widest flex items-center gap-2">
                  <BarChart size={12}/> Grau de Prioridade
                </label>
                <div className="grid grid-cols-5 gap-2">
                  {(['lowest', 'low', 'medium', 'high', 'highest'] as TaskPriority[]).map(p => (
                    <button 
                      key={p} 
                      type="button" 
                      onClick={() => setFormData({...formData, priority: p})} 
                      className={`h-11 rounded-xl transition-all border-2 flex flex-col items-center justify-center gap-1 ${
                        formData.priority === p 
                          ? `${PRIORITY_COLORS[p]} border-transparent scale-110 shadow-lg` 
                          : 'bg-gray-50 border-gray-100 hover:border-gray-200 text-gray-400'
                      }`}
                    >
                      <div className={`w-3 h-3 rounded-full ${formData.priority === p ? 'bg-white' : PRIORITY_COLORS[p]}`}></div>
                      <span className={`text-[7px] font-black uppercase ${formData.priority === p ? 'text-white' : 'text-gray-400'}`}>
                        {PRIORITY_LABELS[p]}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Descrição */}
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase ml-2 tracking-widest">Descrição (Opcional)</label>
                <textarea 
                  value={formData.description} 
                  onChange={e => setFormData({...formData, description: e.target.value})} 
                  className="w-full p-4 bg-gray-50 border-none rounded-2xl font-medium text-gray-700 outline-none shadow-inner h-24 no-scrollbar resize-none leading-relaxed" 
                  placeholder="Adicione detalhes sobre o compromisso..."
                />
              </div>

              <button 
                type="submit" 
                disabled={isSubmitting} 
                className="w-full py-5 bg-blue-900 text-white rounded-[28px] font-black uppercase text-xs shadow-xl active:scale-95 transition-all border-b-4 border-blue-950 flex items-center justify-center gap-2 hover:bg-black"
              >
                {isSubmitting ? <Loader2 className="animate-spin" /> : <Save size={18}/>} 
                {editingTask ? 'SALVAR ALTERAÇÕES' : 'AGENDAR COMPROMISSO'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AgendaSystem;
