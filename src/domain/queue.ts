// ==============================================================================
// PlantãoPS - Regras de Domínio: Ordenação e Gestão da Fila (Item 2.9b)
// ==============================================================================

import { Encounter, TriageColor } from './types';
import { RISK_CONFIG } from './triage';

const COLOR_PRIORITY_ORDER: Record<TriageColor, number> = {
  Vermelho: 1,
  Laranja: 2,
  Amarelo: 3,
  Verde: 4,
  Azul: 5,
};

/**
 * Calcula a idade em anos a partir da data de nascimento.
 */
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

/**
 * Verifica se o paciente possui prioridade legal por faixa etária
 * (idosos com 60 anos ou mais ou crianças com menos de 12 anos).
 */
export function hasAgePriority(birthDateStr?: string | null): boolean {
  if (!birthDateStr) return false;
  const age = calculateAge(birthDateStr);
  return age >= 60 || age < 12;
}

/**
 * Ordenação da Fila de Atendimento (Item 2.9b):
 * 1. Primeiro pela cor (Vermelho primeiro).
 * 2. Dentro da mesma cor, pelo maior tempo de espera (quem triou antes).
 * 3. Em caso de empate, pacientes com 60 anos ou mais e crianças com menos de 12 anos vêm primeiro.
 */
export function sortQueue(encounters: Encounter[]): Encounter[] {
  return [...encounters].sort((a, b) => {
    const colorA = a.priority_color ? COLOR_PRIORITY_ORDER[a.priority_color] : 99;
    const colorB = b.priority_color ? COLOR_PRIORITY_ORDER[b.priority_color] : 99;

    // 1. Prioridade por cor
    if (colorA !== colorB) {
      return colorA - colorB;
    }

    // 2. Tempo de espera: quem esperou mais tempo (menor timestamp de triagem/criação)
    const timeA = new Date(a.triaged_at || a.created_at).getTime();
    const timeB = new Date(b.triaged_at || b.created_at).getTime();

    if (timeA !== timeB) {
      return timeA - timeB;
    }

    // 3. Desempate por idade: idosos (>= 60) e crianças (< 12) têm preferência
    const agePriorityA = a.patient?.birth_date ? hasAgePriority(a.patient.birth_date) : false;
    const agePriorityB = b.patient?.birth_date ? hasAgePriority(b.patient.birth_date) : false;

    if (agePriorityA !== agePriorityB) {
      return agePriorityA ? -1 : 1;
    }

    // Desempate estável final
    return a.id.localeCompare(b.id);
  });
}

/**
 * Calcula os minutos transcorridos desde a triagem.
 */
export function getWaitMinutes(triagedAt: string | Date, now: Date = new Date()): number {
  const start = new Date(triagedAt).getTime();
  const diffMs = now.getTime() - start;
  return Math.max(0, Math.floor(diffMs / (1000 * 60)));
}

/**
 * Verifica se o tempo máximo de espera da cor de risco foi estourado.
 */
export function isOverdue(
  triagedAt: string | Date,
  color?: TriageColor | null,
  now: Date = new Date()
): boolean {
  if (!color) return false;
  const maxWait = RISK_CONFIG[color]?.maxWaitMinutes ?? 0;
  // Para Vermelho (maxWait = 0), qualquer espera > 0 já é crítica
  const waitedMinutes = getWaitMinutes(triagedAt, now);
  return waitedMinutes > maxWait;
}

/**
 * Retorna os minutos restantes antes de estourar o prazo (ou negativos se estourado).
 */
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
