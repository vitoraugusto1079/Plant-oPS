import { describe, it, expect } from 'vitest';
import { canTransition, validateTransition } from '../domain/transitions';

describe('Transições de Situação do Atendimento (Item 2.9c)', () => {
  describe('Transições Permitidas', () => {
    it('permite transição de Aguardando triagem -> Aguardando médico', () => {
      expect(canTransition('Aguardando triagem', 'Aguardando médico')).toBe(true);
    });

    it('permite transição de Aguardando triagem -> Cancelado', () => {
      expect(canTransition('Aguardando triagem', 'Cancelado')).toBe(true);
    });

    it('permite transição de Aguardando médico -> Em atendimento', () => {
      expect(canTransition('Aguardando médico', 'Em atendimento')).toBe(true);
    });

    it('permite transição de Aguardando médico -> Aguardando médico (reclassificação)', () => {
      expect(canTransition('Aguardando médico', 'Aguardando médico (reclassificação)')).toBe(true);
    });

    it('permite transição de Aguardando médico -> Cancelado', () => {
      expect(canTransition('Aguardando médico', 'Cancelado')).toBe(true);
    });

    it('permite transição de Em atendimento -> Alta', () => {
      expect(canTransition('Em atendimento', 'Alta')).toBe(true);
    });

    it('permite transição de Em atendimento -> Aguardando leito', () => {
      expect(canTransition('Em atendimento', 'Aguardando leito')).toBe(true);
    });

    it('permite transição de Em atendimento -> Transferido', () => {
      expect(canTransition('Em atendimento', 'Transferido')).toBe(true);
    });

    it('permite transição de Aguardando leito -> Em observação', () => {
      expect(canTransition('Aguardando leito', 'Em observação')).toBe(true);
    });

    it('permite transição de Em observação -> Alta e Transferido', () => {
      expect(canTransition('Em observação', 'Alta')).toBe(true);
      expect(canTransition('Em observação', 'Transferido')).toBe(true);
    });
  });

  describe('Transições Proibidas (Devem ser recusadas pelo sistema)', () => {
    it('proíbe saltar de Aguardando triagem direto para Alta ou Em observação', () => {
      expect(canTransition('Aguardando triagem', 'Alta')).toBe(false);
      expect(canTransition('Aguardando triagem', 'Em observação')).toBe(false);
      expect(() => validateTransition('Aguardando triagem', 'Alta')).toThrow();
    });

    it('proíbe saltar de Aguardando médico direto para Alta sem consulta', () => {
      expect(canTransition('Aguardando médico', 'Alta')).toBe(false);
      expect(() => validateTransition('Aguardando médico', 'Alta')).toThrow();
    });

    it('proíbe qualquer transição a partir de estados finais (Alta, Transferido, Cancelado)', () => {
      expect(canTransition('Alta', 'Em atendimento')).toBe(false);
      expect(canTransition('Transferido', 'Aguardando triagem')).toBe(false);
      expect(canTransition('Cancelado', 'Em observação')).toBe(false);
      expect(() => validateTransition('Alta', 'Em atendimento')).toThrow();
    });

    it('proíbe transição para o mesmo estado', () => {
      expect(canTransition('Em atendimento', 'Em atendimento')).toBe(false);
    });
  });
});
