import { Encounter, TriageColor } from './types';
import { RISK_CONFIG } from './triage';

const COLOR_PRIORITY_ORDER: Record<TriageColor, number> = {
  Vermelho: 1,
  Laranja: 2,
  Amarelo: 3,
  Verde: 4,
  Azul: 5,
};

export function calculateAge(birthDateStr: string | Date): number {
  const birth = new Date(birthDateStr);
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

export function hasAgePriority(birthDateStr?: string | null): boolean {
  if (!birthDateStr) return false;
  const age = calculateAge(birthDateStr);
  return age >= 60 || age < 12;
}

export function sortQueue(encounters: Encounter[]): Encounter[] {
  return [...encounters].sort((a, b) => {
    const colorA = a.priority_color ? COLOR_PRIORITY_ORDER[a.priority_color] : 99;
    const colorB = b.priority_color ? COLOR_PRIORITY_ORDER[b.priority_color] : 99;

    if (colorA !== colorB) {
      return colorA - colorB;
    }

    const timeA = new Date(a.triaged_at || a.created_at).getTime();
    const timeB = new Date(b.triaged_at || b.created_at).getTime();

    if (timeA !== timeB) {
      return timeA - timeB;
    }

    const agePriorityA = a.patient?.birth_date ? hasAgePriority(a.patient.birth_date) : false;
    const agePriorityB = b.patient?.birth_date ? hasAgePriority(b.patient.birth_date) : false;

    if (agePriorityA !== agePriorityB) {
      return agePriorityA ? -1 : 1;
    }

    return a.id.localeCompare(b.id);
  });
}

export function getWaitMinutes(triagedAt: string | Date, now: Date = new Date()): number {
  const start = new Date(triagedAt).getTime();
  const diffMs = now.getTime() - start;
  return Math.max(0, Math.floor(diffMs / (1000 * 60)));
}

export function isOverdue(
  triagedAt: string | Date,
  color?: TriageColor | null,
  now: Date = new Date()
): boolean {
  if (!color) return false;
  const maxWait = RISK_CONFIG[color]?.maxWaitMinutes ?? 0;
  const waitedMinutes = getWaitMinutes(triagedAt, now);
  return waitedMinutes > maxWait;
}

export function getRemainingMinutes(
  triagedAt: string | Date,
  color?: TriageColor | null,
  now: Date = new Date()
): number {
  if (!color) return 0;
  const maxWait = RISK_CONFIG[color]?.maxWaitMinutes ?? 0;
  const waitedMinutes = getWaitMinutes(triagedAt, now);
  return maxWait - waitedMinutes;
}
