import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../services/supabaseClient';

export function useRealtimeTable(
  table: string,
  queryKeyToInvalidate: (string | number | undefined)[] | string,
  event: '*' | 'INSERT' | 'UPDATE' | 'DELETE' = '*'
) {
  const queryClient = useQueryClient();

  useEffect(() => {
    const channelName = `realtime-${table}-${Array.isArray(queryKeyToInvalidate) ? queryKeyToInvalidate.join('-') : queryKeyToInvalidate}`;

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event,
          schema: 'public',
          table,
        },
        () => {
          const keys = Array.isArray(queryKeyToInvalidate) ? queryKeyToInvalidate : [queryKeyToInvalidate];
          queryClient.invalidateQueries({ queryKey: keys });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [table, queryKeyToInvalidate, event, queryClient]);
}
