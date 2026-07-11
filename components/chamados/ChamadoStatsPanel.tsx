import React from 'react';
import { AlertCircle, BarChart3, CheckCircle2, Pause, Clock, Lock } from 'lucide-react';
import { DemandV2 } from '../../types';

interface SlaAlert extends DemandV2 {
    slaStatus: 'warning' | 'critical';
    slaMessage: string;
    hoursElapsed: number;
}

interface ChamadoStatsPanelProps {
    slaAlerts: SlaAlert[];
    stats: { resolved: number; paused: number; avgTime: string };
    demands: DemandV2[];
    onSelectAlert: (demand: DemandV2) => void;
}

const ChamadoStatsPanel: React.FC<ChamadoStatsPanelProps> = ({ slaAlerts, stats, demands, onSelectAlert }) => {
    return (
        <div className="space-y-4">
            {slaAlerts.length > 0 && (
                <div className="bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-950/30 dark:to-orange-950/30 rounded-2xl p-3 border-2 border-red-200 dark:border-red-900/40">
                    <div className="flex items-center gap-2 mb-3">
                        <div className="p-1.5 bg-red-600 rounded-lg">
                            <AlertCircle className="text-white animate-pulse" size={14} />
                        </div>
                        <div className="flex-1">
                            <h4 className="text-[9px] font-black text-red-900 dark:text-red-100 uppercase tracking-widest">Críticos SD</h4>
                            <p className="text-[7px] font-bold text-red-600 dark:text-red-400">Sem Resposta</p>
                        </div>
                        <span className="bg-red-600 text-white text-xs font-black px-2 py-0.5 rounded-full">{slaAlerts.length}</span>
                    </div>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                        {slaAlerts.map(alert => (
                            <button
                                key={alert.id}
                                onClick={() => onSelectAlert(alert)}
                                className={`w-full p-2 rounded-xl border transition-all text-left ${
                                    alert.slaStatus === 'critical'
                                        ? 'bg-red-100 dark:bg-red-900/20 border-red-300 hover:bg-red-200'
                                        : 'bg-amber-100 dark:bg-amber-900/20 border-amber-300 hover:bg-amber-200'
                                }`}
                            >
                                <div className="flex items-center justify-between mb-1">
                                    <span className="text-[8px] font-black text-slate-900 dark:text-white font-mono">{alert.ticket_number}</span>
                                </div>
                                <p className="text-[9px] font-bold text-slate-700 dark:text-slate-300 line-clamp-1 mb-1">{alert.title}</p>
                                <div className="flex items-center gap-1">
                                    <Clock size={10} className={alert.slaStatus === 'critical' ? 'text-red-600' : 'text-amber-600'} />
                                    <p className={`text-[8px] font-black uppercase ${alert.slaStatus === 'critical' ? 'text-red-600' : 'text-amber-600'}`}>
                                        {Math.floor(alert.hoursElapsed)}h sem resposta
                                    </p>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            <div>
                <div className="flex items-center gap-2 mb-3">
                    <BarChart3 className="text-blue-600" size={16} />
                    <h4 className="text-[9px] font-black text-slate-900 dark:text-white uppercase tracking-widest">Estatísticas</h4>
                </div>
                <div className="space-y-2">
                    <div className="bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-950/20 dark:to-green-950/20 p-3 rounded-xl border border-emerald-200 dark:border-emerald-900/30">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-[7px] font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-widest mb-0.5">✅ Resolvidas</p>
                                <p className="text-2xl font-black text-emerald-600 dark:text-emerald-500 italic leading-none">{stats.resolved}</p>
                            </div>
                            <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg"><CheckCircle2 size={16} className="text-emerald-600" /></div>
                        </div>
                    </div>
                    <div className="bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-950/20 dark:to-yellow-950/20 p-3 rounded-xl border border-amber-200 dark:border-amber-900/30">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-[7px] font-black text-amber-700 dark:text-amber-400 uppercase tracking-widest mb-0.5">⏸️ Pausadas</p>
                                <p className="text-2xl font-black text-amber-600 dark:text-amber-500 italic leading-none">{stats.paused}</p>
                            </div>
                            <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg"><Pause size={16} className="text-amber-600" /></div>
                        </div>
                    </div>
                    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 p-3 rounded-xl border border-blue-200 dark:border-blue-900/30">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-[7px] font-black text-blue-700 dark:text-blue-400 uppercase tracking-widest mb-0.5">⏱️ Tempo Médio</p>
                                <p className="text-2xl font-black text-blue-600 dark:text-blue-500 italic leading-none">{stats.avgTime}</p>
                            </div>
                            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg"><Clock size={16} className="text-blue-600" /></div>
                        </div>
                    </div>
                    <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                        <p className="text-[7px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest mb-2">📋 Abertas por Prioridade</p>
                        <div className="space-y-2">
                            {(['alta', 'media', 'baixa'] as const).map(p => (
                                <div key={p} className="flex items-center justify-between">
                                    <div className="flex items-center gap-1.5">
                                        <div className={`w-2 h-2 rounded-full ${p === 'alta' ? 'bg-red-500' : p === 'media' ? 'bg-blue-500' : 'bg-slate-400'}`}></div>
                                        <span className="text-[8px] font-bold text-slate-600 dark:text-slate-400 uppercase">{p}</span>
                                    </div>
                                    <span className={`text-sm font-black ${p === 'alta' ? 'text-red-600' : p === 'media' ? 'text-blue-600' : 'text-slate-500'}`}>
                                        {demands.filter(d => d.priority === p && d.status !== 'resolvida').length}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            <div className="p-3 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl text-white shadow-xl">
                <div className="flex items-center gap-2 mb-2">
                    <Lock size={18} />
                    <h5 className="text-[9px] font-black uppercase italic">Privacidade</h5>
                </div>
                <p className="text-[8px] font-medium leading-relaxed opacity-90">Sistema com controle hierárquico de visibilidade de mensagens</p>
            </div>
        </div>
    );
};

export default React.memo(ChamadoStatsPanel);
