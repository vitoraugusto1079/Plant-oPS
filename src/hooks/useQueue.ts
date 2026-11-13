// ==============================================================================
// PlantãoPS - Hook da Fila de Atendimento (useQueue)
// Integra TanStack Query, Supabase Realtime e Ordenação de Domínio
// ==============================================================================

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { encounterService } from '../services/encounterService';
import { sortQueue } from '../domain/queue';
import { Encounter, TriageColor } from '../domain/types';
import { useRealtimeTable } from './useRealtimeTable';

export function useQueue() {
  const [selectedColorFilter, setSelectedColorFilter] = useState<TriageColor | 'TODAS'>('TODAS');

  // React Query para buscar a fila de espera do médico
  const {
    data: encounters = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['doctor-queue'],
    queryFn: () => encounterService.getWaitingDoctorQueue(),
    refetchInterval: 10000, // Revalidação a cada 10s como garantia secundária
  });

  // Escuta em tempo real nas tabelas encounters e triages
  useRealtimeTable('encounters', 'doctor-queue');
  useRealtimeTable('triages', 'doctor-queue');

  // 1. Ordenação rigorosa pelo domínio (Prioridade por Cor > Tempo > Idade)
  const sortedQueue = useMemo(() => {
    return sortQueue(encounters);
  }, [encounters]);

  // 2. Contadores por cor
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

  // 3. Fila filtrada pela cor selecionada
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
