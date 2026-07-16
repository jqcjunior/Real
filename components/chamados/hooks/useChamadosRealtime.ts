import { useEffect, useRef } from 'react';
import { supabase } from '../../../services/supabaseClient';
import { DemandV2, DemandMessageV2 } from '../../../types';

interface UseChamadosRealtimeProps {
    selectedDemandId: string | null;
    onDemandInsert: (demand: DemandV2) => void;
    onDemandUpdate: (demand: DemandV2) => void;
    onMessageInsert: (message: DemandMessageV2) => void;
    onAnyChange: () => void;
}

/**
 * Mantém os canais de Realtime abertos PERMANENTEMENTE (monta uma vez só).
 * Antes, o efeito dependia de `selectedDemand` e recriava os 2 websockets
 * toda vez que o usuário trocava de chamado — causando o travamento.
 * Agora usamos uma ref para ler o chamado selecionado atual dentro do
 * callback, sem precisar recriar a inscrição.
 */
export function useChamadosRealtime({
    selectedDemandId,
    onDemandInsert,
    onDemandUpdate,
    onMessageInsert,
    onAnyChange,
}: UseChamadosRealtimeProps) {
    const selectedDemandIdRef = useRef(selectedDemandId);

    useEffect(() => {
        selectedDemandIdRef.current = selectedDemandId;
    }, [selectedDemandId]);

    // Refs para as callbacks — evita precisar recriar o efeito quando elas mudam de identidade
    const onDemandInsertRef = useRef(onDemandInsert);
    const onDemandUpdateRef = useRef(onDemandUpdate);
    const onMessageInsertRef = useRef(onMessageInsert);
    const onAnyChangeRef = useRef(onAnyChange);

    useEffect(() => {
        onDemandInsertRef.current = onDemandInsert;
        onDemandUpdateRef.current = onDemandUpdate;
        onMessageInsertRef.current = onMessageInsert;
        onAnyChangeRef.current = onAnyChange;
    });

    useEffect(() => {
        const demandsChannel = supabase
            .channel('chamados-realtime-demands')
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'demands_v2' },
                (payload) => {
                    onDemandInsertRef.current(payload.new as DemandV2);
                    onAnyChangeRef.current();
                }
            )
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'demands_v2' },
                (payload) => {
                    onDemandUpdateRef.current(payload.new as DemandV2);
                    onAnyChangeRef.current();
                }
            )
            .subscribe();

        const messagesChannel = supabase
            .channel('chamados-realtime-messages')
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'demands_messages_v2' },
                (payload) => {
                    const msg = payload.new as DemandMessageV2;
                    if (msg.demand_id === selectedDemandIdRef.current) {
                        onMessageInsertRef.current(msg);
                    }
                    onAnyChangeRef.current();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(demandsChannel);
            supabase.removeChannel(messagesChannel);
        };
    }, []); // ← monta uma única vez, nunca recria
}
