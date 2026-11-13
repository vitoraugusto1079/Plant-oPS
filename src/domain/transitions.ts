import { EncounterStatus } from './types';

export const ALLOWED_TRANSITIONS: Record<EncounterStatus, EncounterStatus[]> = {
  'Aguardando triagem': [
    'Aguardando médico',
    'Cancelado',
  ],
  'Aguardando médico': [
    'Em atendimento',
    'Aguardando médico (reclassificação)',
    'Cancelado',
  ],
  'Aguardando médico (reclassificação)': [
    'Em atendimento',
    'Cancelado',
  ],
  'Em atendimento': [
    'Alta',
    'Aguardando leito',
    'Transferido',
  ],
  'Aguardando leito': [
    'Em observação',
  ],
  'Em observação': [
    'Alta',
    'Transferido',
  ],
  'Alta': [],
  'Transferido': [],
  'Cancelado': [],
};

export function canTransition(from: EncounterStatus, to: EncounterStatus): boolean {
  if (from === to) return false;
  const allowed = ALLOWED_TRANSITIONS[from] || [];
  return allowed.includes(to);
}

export function validateTransition(from: EncounterStatus, to: EncounterStatus): void {
  if (!canTransition(from, to)) {
    throw new Error(
      `Transição inválida: Não é permitido mudar a situação de "${from}" para "${to}". Situações válidas permitidas a partir de "${from}": [${ALLOWED_TRANSITIONS[from]?.join(', ') || 'Nenhuma (situação final)'}].`
    );
  }
}
