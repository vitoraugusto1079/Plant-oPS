// ==============================================================================
// PlantãoPS - Serviço de Chamadas da Sala de Espera (Item 2.7)
// NUNCA expõe nomes de pacientes no painel
// ==============================================================================

import { supabase } from './supabaseClient';
import { Call, TriageColor } from '../domain/types';

export interface AverageWaitStats {
  color: TriageColor;
  averageMinutes: number;
}

export const callService = {
  /**
   * Obtém a chamada atual e o histórico recente (últimas 6 chamadas)
   */
  async getRecentCalls(limit = 6): Promise<Call[]> {
    const { data, error } = await supabase
      .from('calls')
      .select('id, encounter_id, ticket_number, room, created_at')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return (data || []) as Call[];
  },

  /**
   * Calcula o tempo médio de espera atual por cor para os pacientes em atendimento ou concluídos hoje
   */
  async getAverageWaitTimes(): Promise<Record<TriageColor, number>> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { data, error } = await supabase
      .from('encounters')
      .select('priority_color, triaged_at, called_at')
      .gte('created_at', today.toISOString())
      .not('triaged_at', 'is', null)
      .not('called_at', 'is', null);

    const result: Record<TriageColor, number> = {
      Vermelho: 0,
      Laranja: 0,
      Amarelo: 0,
      Verde: 0,
      Azul: 0,
    };

    if (error || !data) return result;

    const counts: Record<TriageColor, { totalMinutes: number; count: number }> = {
      Vermelho: { totalMinutes: 0, count: 0 },
      Laranja: { totalMinutes: 0, count: 0 },
      Amarelo: { totalMinutes: 0, count: 0 },
      Verde: { totalMinutes: 0, count: 0 },
      Azul: { totalMinutes: 0, count: 0 },
    };

    data.forEach((row) => {
      const color = row.priority_color as TriageColor;
      if (color && counts[color] && row.triaged_at && row.called_at) {
        const start = new Date(row.triaged_at).getTime();
        const end = new Date(row.called_at).getTime();
        const diffMinutes = Math.max(0, Math.round((end - start) / 60000));
        counts[color].totalMinutes += diffMinutes;
        counts[color].count += 1;
      }
    });

    (Object.keys(counts) as TriageColor[]).forEach((color) => {
      if (counts[color].count > 0) {
        result[color] = Math.round(counts[color].totalMinutes / counts[color].count);
      }
    });

    return result;
  },
};
