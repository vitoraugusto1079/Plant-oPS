import { describe, it, expect } from 'vitest';
import { classifyRisk } from '../domain/triage';
import { VitalSigns } from '../domain/types';

const defaultNormalVitals: VitalSigns = {
  systolicBp: 120,
  diastolicBp: 80,
  heartRate: 75,
  temperature: 36.5,
  oxygenSaturation: 98,
  painScale: 0,
  consciousnessLevel: 'alerta',
  chiefComplaint: 'Check-up',
};

describe('Classificação de Risco - Manchester Simplificado (Item 2.9a)', () => {
  describe('VERMELHO (Emergência - Imediato)', () => {
    it('deve classificar como Vermelho se saturação < 90% (limite: 89%)', () => {
      const res = classifyRisk({ ...defaultNormalVitals, oxygenSaturation: 89 });
      expect(res.color).toBe('Vermelho');
      expect(res.maxWaitMinutes).toBe(0);
    });

    it('deve classificar como Vermelho se pressão sistólica < 80 mmHg (limite: 79)', () => {
      const res = classifyRisk({ ...defaultNormalVitals, systolicBp: 79 });
      expect(res.color).toBe('Vermelho');
    });

    it('deve classificar como Vermelho se FC < 40 bpm (limite: 39)', () => {
      const res = classifyRisk({ ...defaultNormalVitals, heartRate: 39 });
      expect(res.color).toBe('Vermelho');
    });

    it('deve classificar como Vermelho se FC > 140 bpm (limite: 141)', () => {
      const res = classifyRisk({ ...defaultNormalVitals, heartRate: 141 });
      expect(res.color).toBe('Vermelho');
    });

    it('deve classificar como Vermelho se paciente inconsciente', () => {
      const res = classifyRisk({ ...defaultNormalVitals, consciousnessLevel: 'inconsciente' });
      expect(res.color).toBe('Vermelho');
    });
  });

  describe('LARANJA (Muito urgente - 10 min)', () => {
    it('deve classificar como Laranja se saturação de 90% a 93% (limite inferior 90%, superior 93%)', () => {
      expect(classifyRisk({ ...defaultNormalVitals, oxygenSaturation: 90 }).color).toBe('Laranja');
      expect(classifyRisk({ ...defaultNormalVitals, oxygenSaturation: 93 }).color).toBe('Laranja');
    });

    it('deve classificar como Laranja se temperatura >= 40 °C (limite: 40.0 °C)', () => {
      const res = classifyRisk({ ...defaultNormalVitals, temperature: 40.0 });
      expect(res.color).toBe('Laranja');
      expect(res.maxWaitMinutes).toBe(10);
    });

    it('deve classificar como Laranja se temperatura <= 35 °C (hipotermia limite: 35.0 °C)', () => {
      const res = classifyRisk({ ...defaultNormalVitals, temperature: 35.0 });
      expect(res.color).toBe('Laranja');
    });

    it('deve classificar como Laranja se dor de 8 a 10 (limite inferior 8, superior 10)', () => {
      expect(classifyRisk({ ...defaultNormalVitals, painScale: 8 }).color).toBe('Laranja');
      expect(classifyRisk({ ...defaultNormalVitals, painScale: 10 }).color).toBe('Laranja');
    });

    it('deve classificar como Laranja se FC de 121 a 140 bpm (limites 121 e 140)', () => {
      expect(classifyRisk({ ...defaultNormalVitals, heartRate: 121 }).color).toBe('Laranja');
      expect(classifyRisk({ ...defaultNormalVitals, heartRate: 140 }).color).toBe('Laranja');
    });

    it('deve classificar como Laranja se paciente confuso', () => {
      const res = classifyRisk({ ...defaultNormalVitals, consciousnessLevel: 'confuso' });
      expect(res.color).toBe('Laranja');
    });
  });

  describe('AMARELO (Urgente - 60 min)', () => {
    it('deve classificar como Amarelo se temperatura de 38,5 °C a 39,9 °C', () => {
      expect(classifyRisk({ ...defaultNormalVitals, temperature: 38.5 }).color).toBe('Amarelo');
      expect(classifyRisk({ ...defaultNormalVitals, temperature: 39.9 }).color).toBe('Amarelo');
    });

    it('deve classificar como Amarelo se dor de 5 a 7', () => {
      expect(classifyRisk({ ...defaultNormalVitals, painScale: 5 }).color).toBe('Amarelo');
      expect(classifyRisk({ ...defaultNormalVitals, painScale: 7 }).color).toBe('Amarelo');
    });

    it('deve classificar como Amarelo se pressão sistólica >= 180 mmHg (limite: 180)', () => {
      const res = classifyRisk({ ...defaultNormalVitals, systolicBp: 180 });
      expect(res.color).toBe('Amarelo');
      expect(res.maxWaitMinutes).toBe(60);
    });
  });

  describe('VERDE (Pouco urgente - 120 min)', () => {
    it('deve classificar como Verde se temperatura de 37,8 °C a 38,4 °C', () => {
      expect(classifyRisk({ ...defaultNormalVitals, temperature: 37.8 }).color).toBe('Verde');
      expect(classifyRisk({ ...defaultNormalVitals, temperature: 38.4 }).color).toBe('Verde');
    });

    it('deve classificar como Verde se dor de 1 a 4', () => {
      expect(classifyRisk({ ...defaultNormalVitals, painScale: 1 }).color).toBe('Verde');
      expect(classifyRisk({ ...defaultNormalVitals, painScale: 4 }).color).toBe('Verde');
    });
  });

  describe('AZUL (Não urgente - 240 min)', () => {
    it('deve classificar como Azul se nenhum dos critérios de gravidade for atingido', () => {
      const res = classifyRisk(defaultNormalVitals);
      expect(res.color).toBe('Azul');
      expect(res.maxWaitMinutes).toBe(240);
    });
  });

  describe('Hierarquia de Gravidade (Critério mais grave prevalece)', () => {
    it('deve priorizar Vermelho sobre Laranja e Amarelo quando múltiplos critérios coexistirem', () => {
      const res = classifyRisk({
        ...defaultNormalVitals,
        temperature: 38.8,
        painScale: 9,
        oxygenSaturation: 88,
      });
      expect(res.color).toBe('Vermelho');
    });
  });
});
