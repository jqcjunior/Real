import { supabase } from '../../services/supabaseClient';

export async function runSystemTaskScheduler(userId: string, userRole: string): Promise<void> {
    if (!userId) return;
    
    const normalizedRole = String(userRole || '').toUpperCase().trim();
    const isManagerOrAdmin = normalizedRole === 'MANAGER' || normalizedRole === 'ADMIN' || normalizedRole === 'SUPER_ADMIN';
    
    if (!isManagerOrAdmin) return;

    const now = Date.now();
    const runningKey = `scheduler_running_${userId}`;
    const lastSuccessKey = `scheduler_last_success_${userId}`;

    // 1. Tab Lock / Mutex to prevent multiple concurrent runs in separate tabs
    const runningVal = localStorage.getItem(runningKey);
    if (runningVal) {
        const runTime = parseInt(runningVal, 10);
        if (now - runTime < 10000) { // 10 seconds lock
            return;
        }
    }
    localStorage.setItem(runningKey, now.toString());

    // 2. Throttle checks to once every 30 minutes to minimize Supabase queries
    const lastSuccessVal = localStorage.getItem(lastSuccessKey);
    if (lastSuccessVal) {
        const successTime = parseInt(lastSuccessVal, 10);
        if (now - successTime < 1800000) { // 30 minutes throttle
            localStorage.removeItem(runningKey);
            return;
        }
    }

    try {
        const targetSat = getTargetSaturday();
        const targetSatStr = formatLocalDate(targetSat);

        // 5. Diagnóstico de registros antigos (Apenas leitura e log, sem alteração)
        const { data: allMetaTasks } = await supabase
            .from('agenda_tasks')
            .select('id, user_id, due_date, title')
            .eq('title', 'GERAR METAS DA SEMANA');

        if (allMetaTasks) {
            let sundaysCount = 0;
            const sundayDates: string[] = [];
            const duplicateCheck = new Map<string, number>();
            let duplicatesCount = 0;

            allMetaTasks.forEach(task => {
                if (task.due_date) {
                    const dateObj = parseLocalDate(task.due_date);
                    if (dateObj.getDay() === 0) {
                        sundaysCount++;
                        if (!sundayDates.includes(task.due_date)) {
                            sundayDates.push(task.due_date);
                        }
                    }

                    const key = `${task.user_id}_${task.due_date}`;
                    const count = duplicateCheck.get(key) || 0;
                    if (count > 0) {
                        duplicatesCount++;
                    }
                    duplicateCheck.set(key, count + 1);
                }
            });

            console.log(`[Scheduler Diagnostic] Encontradas ${allMetaTasks.length} tarefas de metas no total.`);
            console.log(`[Scheduler Diagnostic] Gravadas em domingos: ${sundaysCount} tarefas nas datas: ${sundayDates.sort().join(', ')}`);
            console.log(`[Scheduler Diagnostic] Duplicidades encontradas (mesmo usuário e data): ${duplicatesCount}`);
        }

        // 4. Idempotência - verificar se já existe tarefa para o sábado-alvo para este usuário
        const { data: existingTasks, error } = await supabase
            .from('agenda_tasks')
            .select('due_date')
            .eq('user_id', userId)
            .eq('title', 'GERAR METAS DA SEMANA')
            .eq('due_date', targetSatStr);

        if (error) {
            console.error('[Scheduler] Erro ao buscar tarefas do sistema:', error);
            localStorage.removeItem(runningKey);
            return;
        }

        const hasTargetTask = existingTasks && existingTasks.length > 0;

        if (!hasTargetTask) {
            console.log(`[Scheduler] Criando tarefa automática de sábado para o dia ${targetSatStr} para o usuário ${userId}`);
            
            const { error: insertError } = await supabase
                .from('agenda_tasks')
                .insert([{
                    user_id: userId,
                    title: 'GERAR METAS DA SEMANA',
                    description: 'Tarefa automática do sistema para gerar as metas da semana.',
                    due_date: targetSatStr,
                    due_time: '08:00',
                    priority: 'high',
                    is_completed: false
                }]);

            if (insertError) {
                console.error('[Scheduler] Erro ao inserir tarefa automática:', insertError);
            } else {
                console.log('[Scheduler] Tarefa automática de sábado inserida com sucesso.');
                localStorage.setItem(lastSuccessKey, Date.now().toString());
            }
        } else {
            // Já existe para este sábado
            localStorage.setItem(lastSuccessKey, Date.now().toString());
        }
    } catch (err) {
        console.error('[Scheduler] Erro inesperado no Scheduler:', err);
    } finally {
        localStorage.removeItem(runningKey);
    }
}

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

function getTargetSaturday(): Date {
    const today = new Date();
    const target = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 12, 0, 0);
    const dayOfWeek = target.getDay(); // 0 = Sunday, 6 = Saturday
    
    if (dayOfWeek === 6) {
        return target;
    } else {
        const daysUntilSaturday = 6 - dayOfWeek;
        target.setDate(target.getDate() + daysUntilSaturday);
        return target;
    }
}
