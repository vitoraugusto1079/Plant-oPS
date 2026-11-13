// ==============================================================================
// PlantãoPS - Testes de Domínio: Ordenação da Fila de Espera (Item 3.9)
// Prioridade por cor, maior tempo de espera e desempate por faixa etária (idosos/crianças)
// ==============================================================================

import { describe, it, expect } from 'vitest';
import { sortQueue, calculateAge, hasAgePriority, isOverdue } from '../domain/queue';
import { Encounter } from '../domain/types';

describe('Ordenação e Regras da Fila (Item 2.9b)', () => {
  it('deve priorizar rigorosamente pela cor (Vermelho > Laranja > Amarelo > Verde > Azul)', () => {
    const list: Encounter[] = [
      {
        id: '1',
        patient_id: 'p1',
        ticket_number: 'A001',
        status: 'Aguardando médico',
        priority_color: 'Verde',
        created_at: '2026-11-13T10:00:00Z',
        triaged_at: '2026-11-13T10:05:00Z',
      },
      {
        id: '2',
        patient_id: 'p2',
        ticket_number: 'A002',
        status: 'Aguardando médico',
        priority_color: 'Vermelho',
        created_at: '2026-11-13T10:20:00Z',
        triaged_at: '2026-11-13T10:25:00Z',
      },
      {
        id: '3',
        patient_id: 'p3',
        ticket_number: 'A003',
        status: 'Aguardando médico',
        priority_color: 'Amarelo',
        created_at: '2026-11-13T10:10:00Z',
        triaged_at: '2026-11-13T10:15:00Z',
      },
      {
        id: '4',
        patient_id: 'p4',
        ticket_number: 'A004',
        status: 'Aguardando médico',
        priority_color: 'Laranja',
        created_at: '2026-11-13T10:12:00Z',
        triaged_at: '2026-11-13T10:18:00Z',
      },
      {
        id: '5',
        patient_id: 'p5',
        ticket_number: 'A005',
        status: 'Aguardando médico',
        priority_color: 'Azul',
        created_at: '2026-11-13T09:00:00Z',
        triaged_at: '2026-11-13T09:10:00Z',
      },
    ];

    const sorted = sortQueue(list);
    expect(sorted.map((s) => s.priority_color)).toEqual([
      'Vermelho',
      'Laranja',
      'Amarelo',
      'Verde',
      'Azul',
    ]);
  });

  it('deve desempatar pela maior espera (menor timestamp de triagem) dentro da mesma cor', () => {
    const list: Encounter[] = [
      {
        id: '1',
        patient_id: 'p1',
        ticket_number: 'A001',
        status: 'Aguardando médico',
        priority_color: 'Amarelo',
        created_at: '2026-11-13T10:15:00Z',
        triaged_at: '2026-11-13T10:20:00Z', // Chegou depois
      },
      {
        id: '2',
        patient_id: 'p2',
        ticket_number: 'A002',
        status: 'Aguardando médico',
        priority_color: 'Amarelo',
        created_at: '2026-11-13T10:00:00Z',
        triaged_at: '2026-11-13T10:05:00Z', // Chegou antes
      },
    ];

    const sorted = sortQueue(list);
    expect(sorted[0].id).toBe('2');
    expect(sorted[1].id).toBe('1');
  });

  it('deve priorizar idosos (>= 60) e crianças (< 12) em caso de empate na mesma cor e tempo', () => {
    const list: Encounter[] = [
      {
        id: 'adulto-30',
        patient_id: 'p1',
        ticket_number: 'A001',
        status: 'Aguardando médico',
        priority_color: 'Verde',
        created_at: '2026-11-13T10:00:00Z',
        triaged_at: '2026-11-13T10:05:00Z',
        patient: {
          id: 'p1',
          name: 'Adulto',
          birth_date: '1995-05-10', // 31 anos
          gender: 'M',
          created_at: '2026-11-13T10:00:00Z',
        },
      },
      {
        id: 'idoso-75',
        patient_id: 'p2',
        ticket_number: 'A002',
        status: 'Aguardando médico',
        priority_color: 'Verde',
        created_at: '2026-11-13T10:00:00Z',
        triaged_at: '2026-11-13T10:05:00Z',
        patient: {
          id: 'p2',
          name: 'Idoso',
          birth_date: '1951-03-15', // 75 anos
          gender: 'M',
          created_at: '2026-11-13T10:00:00Z',
        },
      },
      {
        id: 'crianca-6',
        patient_id: 'p3',
        ticket_number: 'A003',
        status: 'Aguardando médico',
        priority_color: 'Verde',
        created_at: '2026-11-13T10:00:00Z',
        triaged_at: '2026-11-13T10:05:00Z',
        patient: {
          id: 'p3',
          name: 'Criança',
          birth_date: '2020-01-20', // 6 anos
          gender: 'F',
          created_at: '2026-11-13T10:00:00Z',
        },
      },
    ];

    const sorted = sortQueue(list);
    // Idoso e criança devem vir antes do adulto de 30 anos
    expect(sorted[2].id).toBe('adulto-30');
    expect(['idoso-75', 'crianca-6']).toContain(sorted[0].id);
    expect(['idoso-75', 'crianca-6']).toContain(sorted[1].id);
  });

  it('deve detectar tempo de espera estourado (isOverdue)', () => {
    // Amarelo: máximo 60 min. Espera de 65 min deve ser overdue.
    const triagedAt = new Date('2026-11-13T10:00:00Z');
    const now65MinLater = new Date('2026-11-13T11:05:00Z');
    const now50MinLater = new Date('2026-11-13T10:50:00Z');

    expect(isOverdue(triagedAt, 'Amarelo', now65MinLater)).toBe(true);
    expect(isOverdue(triagedAt, 'Amarelo', now50MinLater)).toBe(false);
  });
});
