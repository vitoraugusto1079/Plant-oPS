import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { encounterService } from '../services/encounterService';
import { sortQueue } from '../domain/queue';
import { Encounter, TriageColor } from '../domain/types';
import { useRealtimeTable } from './useRealtimeTable';

export function useQueue() {
  const [selectedColorFilter, setSelectedColorFilter] = useState<TriageColor | 'TODAS'>('TODAS');

  const {
    data: encounters = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['doctor-queue'],
    queryFn: () => encounterService.getWaitingDoctorQueue(),
    refetchInterval: 10000,
  });

  useRealtimeTable('encounters', 'doctor-queue');
  useRealtimeTable('triages', 'doctor-queue');

  const sortedQueue = useMemo(() => {
    return sortQueue(encounters);
  }, [encounters]);

  const colorCounts = useMemo(() => {
    const counts: Record<TriageColor, number> = {
      Vermelho: 0,
      Laranja: 0,
      Amarelo: 0,
      Verde: 0,
      Azul: 0,
    };

    encounters.forEach((item) => {
      if (item.priority_color && counts[item.priority_color] !== undefined) {
        counts[item.priority_color]++;
      }
    });

    return counts;
  }, [encounters]);

  const filteredQueue = useMemo(() => {
    if (selectedColorFilter === 'TODAS') {
      return sortedQueue;
    }
    return sortedQueue.filter((item) => item.priority_color === selectedColorFilter);
  }, [sortedQueue, selectedColorFilter]);

  return {
    queue: filteredQueue,
    rawQueue: encounters,
    totalPatients: encounters.length,
    colorCounts,
    selectedColorFilter,
    setColorFilter: setSelectedColorFilter,
    isLoading,
    isError,
    error,
    refetch,
  };
}
