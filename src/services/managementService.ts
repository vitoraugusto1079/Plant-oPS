import { supabase } from './supabaseClient';
import { TriageColor } from '../domain/types';
import { RISK_CONFIG } from '../domain/triage';

export type ManagementPeriod = 'hoje' | '7dias' | '30dias';

export interface ManagementDashboardData {
  period: ManagementPeriod;
  totalEncounters: number;
  encountersPerHour: { hour: string; count: number }[];
  distributionByColor: { color: TriageColor; count: number; percentage: number }[];
  waitTimeByColor: {
    color: TriageColor;
    avgMinutes: number;
    maxAllowedMinutes: number;
    isOverdueAvg: boolean;
  }[];
  overduePercentage: number;
  overdueCount: number;
  bedOccupancy: {
    totalBeds: number;
    occupiedBeds: number;
    cleaningBeds: number;
    freeBeds: number;
    occupancyRate: number;
  };
}

export const managementService = {
  async getDashboardData(period: ManagementPeriod = 'hoje'): Promise<ManagementDashboardData> {
    const now = new Date();
    const startDate = new Date();

    if (period === 'hoje') {
      startDate.setHours(0, 0, 0, 0);
    } else if (period === '7dias') {
      startDate.setDate(now.getDate() - 7);
      startDate.setHours(0, 0, 0, 0);
    } else if (period === '30dias') {
      startDate.setDate(now.getDate() - 30);
      startDate.setHours(0, 0, 0, 0);
    }

    const { data: encounters, error: encError } = await supabase
      .from('encounters')
      .select('id, created_at, triaged_at, called_at, priority_color, status')
      .gte('created_at', startDate.toISOString())
      .order('created_at', { ascending: true });

    if (encError) throw encError;

    const list = encounters || [];
    const totalEncounters = list.length;

    const hoursMap = new Map<string, number>();
    for (let h = 0; h < 24; h++) {
      const label = `${String(h).padStart(2, '0')}:00`;
      hoursMap.set(label, 0);
    }

    list.forEach((enc) => {
      const date = new Date(enc.created_at);
      const hourLabel = `${String(date.getHours()).padStart(2, '0')}:00`;
      hoursMap.set(hourLabel, (hoursMap.get(hourLabel) || 0) + 1);
    });

    const encountersPerHour = Array.from(hoursMap.entries()).map(([hour, count]) => ({
      hour,
      count,
    }));

    const colorCounts: Record<TriageColor, number> = {
      Vermelho: 0,
      Laranja: 0,
      Amarelo: 0,
      Verde: 0,
      Azul: 0,
    };

    list.forEach((enc) => {
      if (enc.priority_color && colorCounts[enc.priority_color as TriageColor] !== undefined) {
        colorCounts[enc.priority_color as TriageColor]++;
      }
    });

    const distributionByColor = (Object.keys(colorCounts) as TriageColor[]).map((color) => {
      const count = colorCounts[color];
      const percentage = totalEncounters > 0 ? Math.round((count / totalEncounters) * 100) : 0;
      return { color, count, percentage };
    });

    const waitTimes: Record<TriageColor, { totalWait: number; count: number; overdueCount: number }> = {
      Vermelho: { totalWait: 0, count: 0, overdueCount: 0 },
      Laranja: { totalWait: 0, count: 0, overdueCount: 0 },
      Amarelo: { totalWait: 0, count: 0, overdueCount: 0 },
      Verde: { totalWait: 0, count: 0, overdueCount: 0 },
      Azul: { totalWait: 0, count: 0, overdueCount: 0 },
    };

    let totalTriagedAndCalled = 0;
    let totalOverdue = 0;

    list.forEach((enc) => {
      const color = enc.priority_color as TriageColor;
      if (color && enc.triaged_at && enc.called_at && waitTimes[color]) {
        const start = new Date(enc.triaged_at).getTime();
        const end = new Date(enc.called_at).getTime();
        const diffMin = Math.max(0, Math.round((end - start) / 60000));
        const maxWait = RISK_CONFIG[color]?.maxWaitMinutes ?? 0;

        waitTimes[color].totalWait += diffMin;
        waitTimes[color].count += 1;
        totalTriagedAndCalled += 1;

        if (diffMin > maxWait) {
          waitTimes[color].overdueCount += 1;
          totalOverdue += 1;
        }
      }
    });

    const waitTimeByColor = (Object.keys(waitTimes) as TriageColor[]).map((color) => {
      const item = waitTimes[color];
      const avgMinutes = item.count > 0 ? Math.round(item.totalWait / item.count) : 0;
      const maxAllowedMinutes = RISK_CONFIG[color]?.maxWaitMinutes ?? 0;
      return {
        color,
        avgMinutes,
        maxAllowedMinutes,
        isOverdueAvg: avgMinutes > maxAllowedMinutes,
      };
    });

    const overduePercentage =
      totalTriagedAndCalled > 0 ? Math.round((totalOverdue / totalTriagedAndCalled) * 100) : 0;

    const { data: beds, error: bedError } = await supabase.from('beds').select('status');
    if (bedError) throw bedError;

    const totalBeds = beds?.length || 0;
    const occupiedBeds = beds?.filter((b) => b.status === 'ocupado').length || 0;
    const cleaningBeds = beds?.filter((b) => b.status === 'em_limpeza').length || 0;
    const freeBeds = beds?.filter((b) => b.status === 'livre').length || 0;
    const occupancyRate = totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0;

    return {
      period,
      totalEncounters,
      encountersPerHour,
      distributionByColor,
      waitTimeByColor,
      overduePercentage,
      overdueCount: totalOverdue,
      bedOccupancy: {
        totalBeds,
        occupiedBeds,
        cleaningBeds,
        freeBeds,
        occupancyRate,
      },
    };
  },
};
