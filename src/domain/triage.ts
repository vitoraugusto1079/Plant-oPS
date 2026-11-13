// ==============================================================================
// PlantãoPS - Regras de Domínio: Classificação de Risco (Item 2.9a)
// Funções puras sem dependências externas
// ==============================================================================

import { TriageColor, VitalSigns } from './types';

export interface RiskClassificationResult {
  color: TriageColor;
  priority: string;
  maxWaitMinutes: number;
  matchedCriteria: string[];
}

export const RISK_CONFIG: Record<TriageColor, { priority: string; maxWaitMinutes: number; hex: string; bgClass: string; textClass: string }> = {
  Vermelho: {
    priority: 'Emergência',
    maxWaitMinutes: 0,
    hex: '#dc2626',
    bgClass: 'bg-red-600',
    textClass: 'text-red-600',
  },
  Laranja: {
    priority: 'Muito urgente',
    maxWaitMinutes: 10,
    hex: '#ea580c',
    bgClass: 'bg-orange-500',
    textClass: 'text-orange-500',
  },
  Amarelo: {
    priority: 'Urgente',
    maxWaitMinutes: 60,
    hex: '#eab308',
    bgClass: 'bg-yellow-500',
    textClass: 'text-yellow-600',
  },
  Verde: {
    priority: 'Pouco urgente',
    maxWaitMinutes: 120,
    hex: '#16a34a',
    bgClass: 'bg-green-600',
    textClass: 'text-green-600',
  },
  Azul: {
    priority: 'Não urgente',
    maxWaitMinutes: 240,
    hex: '#2563eb',
    bgClass: 'bg-blue-600',
    textClass: 'text-blue-600',
  },
};

/**
 * Classifica o risco do paciente a partir dos seus sinais vitais.
 * A cor sugerida é definida pelo critério mais grave encontrado (Item 2.9a).
 */
export function classifyRisk(vitals: VitalSigns): RiskClassificationResult {
  const redCriteria: string[] = [];
  const orangeCriteria: string[] = [];
  const yellowCriteria: string[] = [];
  const greenCriteria: string[] = [];

  // Critérios para VERMELHO (Emergência - Imediato):
  // - Saturação < 90%
  // - Pressão sistólica < 80 mmHg
  // - FC < 40 ou > 140 bpm
  // - Paciente inconsciente
  if (vitals.oxygenSaturation < 90) {
    redCriteria.push('Saturação de O₂ < 90%');
  }
  if (vitals.systolicBp < 80) {
    redCriteria.push('Pressão sistólica < 80 mmHg');
  }
  if (vitals.heartRate < 40 || vitals.heartRate > 140) {
    redCriteria.push('Frequência cardíaca < 40 ou > 140 bpm');
  }
  if (vitals.consciousnessLevel === 'inconsciente') {
    redCriteria.push('Paciente inconsciente');
  }

  if (redCriteria.length > 0) {
    return {
      color: 'Vermelho',
      priority: RISK_CONFIG.Vermelho.priority,
      maxWaitMinutes: RISK_CONFIG.Vermelho.maxWaitMinutes,
      matchedCriteria: redCriteria,
    };
  }

  // Critérios para LARANJA (Muito urgente - 10 min):
  // - Saturação de 90% a 93%
  // - Temperatura >= 40 °C ou <= 35 °C
  // - Dor de 8 a 10
  // - Frequência cardíaca de 121 a 140 bpm
  // - Paciente confuso
  if (vitals.oxygenSaturation >= 90 && vitals.oxygenSaturation <= 93) {
    orangeCriteria.push('Saturação de O₂ entre 90% e 93%');
  }
  if (vitals.temperature >= 40.0 || vitals.temperature <= 35.0) {
    orangeCriteria.push('Temperatura corporal ≥ 40 °C ou ≤ 35 °C');
  }
  if (vitals.painScale >= 8 && vitals.painScale <= 10) {
    orangeCriteria.push('Escala de dor intensa (8 a 10)');
  }
  if (vitals.heartRate >= 121 && vitals.heartRate <= 140) {
    orangeCriteria.push('Frequência cardíaca entre 121 e 140 bpm');
  }
  if (vitals.consciousnessLevel === 'confuso') {
    orangeCriteria.push('Paciente confuso / alteração de consciência');
  }

  if (orangeCriteria.length > 0) {
    return {
      color: 'Laranja',
      priority: RISK_CONFIG.Laranja.priority,
      maxWaitMinutes: RISK_CONFIG.Laranja.maxWaitMinutes,
      matchedCriteria: orangeCriteria,
    };
  }

  // Critérios para AMARELO (Urgente - 60 min):
  // - Temperatura de 38,5 °C a 39,9 °C
  // - Dor de 5 a 7
  // - Pressão sistólica >= 180 mmHg
  if (vitals.temperature >= 38.5 && vitals.temperature <= 39.9) {
    yellowCriteria.push('Temperatura entre 38,5 °C e 39,9 °C (Febre alta)');
  }
  if (vitals.painScale >= 5 && vitals.painScale <= 7) {
    yellowCriteria.push('Escala de dor moderada (5 a 7)');
  }
  if (vitals.systolicBp >= 180) {
    yellowCriteria.push('Pressão sistólica ≥ 180 mmHg (Crise hipertensiva)');
  }

  if (yellowCriteria.length > 0) {
    return {
      color: 'Amarelo',
      priority: RISK_CONFIG.Amarelo.priority,
      maxWaitMinutes: RISK_CONFIG.Amarelo.maxWaitMinutes,
      matchedCriteria: yellowCriteria,
    };
  }

  // Critérios para VERDE (Pouco urgente - 120 min):
  // - Temperatura de 37,8 °C a 38,4 °C
  // - Dor de 1 a 4
  if (vitals.temperature >= 37.8 && vitals.temperature <= 38.4) {
    greenCriteria.push('Temperatura entre 37,8 °C e 38,4 °C (Estado febril)');
  }
  if (vitals.painScale >= 1 && vitals.painScale <= 4) {
    greenCriteria.push('Escala de dor leve (1 a 4)');
  }

  if (greenCriteria.length > 0) {
    return {
      color: 'Verde',
      priority: RISK_CONFIG.Verde.priority,
      maxWaitMinutes: RISK_CONFIG.Verde.maxWaitMinutes,
      matchedCriteria: greenCriteria,
    };
  }

  // Se nenhum dos critérios acima for atendido -> AZUL (Não urgente - 240 min)
  return {
    color: 'Azul',
    priority: RISK_CONFIG.Azul.priority,
    maxWaitMinutes: RISK_CONFIG.Azul.maxWaitMinutes,
    matchedCriteria: ['Nenhum critério de gravidade identificado'],
  };
}
