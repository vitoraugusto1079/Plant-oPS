import { describe, it, expect } from 'vitest';
import { validateMedicationAllergy, validateMedicationDose } from '../domain/prescription';
import { Medication } from '../domain/types';

describe('Segurança da Prescrição Médica (Item 2.5 & 3.7)', () => {
  const sampleMedication: Medication = {
    id: 'med-1',
    name: 'Dipirona',
    max_dose: 1000,
    unit: 'mg',
    default_route: 'EV',
    created_at: '2026-11-13T10:00:00Z',
  };

  describe('Bloqueio por Alergia', () => {
    it('deve bloquear a prescrição se o paciente tiver alergia ao medicamento (match exato)', () => {
      const allergies = ['Dipirona', 'Penicilina'];
      const result = validateMedicationAllergy(allergies, 'Dipirona');
      expect(result.isAllergic).toBe(true);
      expect(result.reason).toContain('Prescrição bloqueada');
    });

    it('deve bloquear a prescrição em caso de correspondência parcial ou case-insensitive', () => {
      const allergies = [{ id: 'a1', patient_id: 'p1', allergen_name: 'dipirona monoidratada', created_at: '' }];
      const result = validateMedicationAllergy(allergies, 'DIPIRONA');
      expect(result.isAllergic).toBe(true);
    });

    it('deve liberar a prescrição se o paciente não tiver alergia ao medicamento', () => {
      const allergies = ['Penicilina', 'Iodo'];
      const result = validateMedicationAllergy(allergies, 'Dipirona');
      expect(result.isAllergic).toBe(false);
      expect(result.reason).toBeUndefined();
    });
  });

  describe('Bloqueio por Dose Máxima', () => {
    it('deve permitir prescrição se a dose for menor ou igual à dose máxima cadastrada', () => {
      expect(validateMedicationDose(500, sampleMedication).isValid).toBe(true);
      expect(validateMedicationDose(1000, sampleMedication).isValid).toBe(true);
    });

    it('deve bloquear a prescrição se a dose ultrapassar o limite máximo cadastrado', () => {
      const result = validateMedicationDose(1500, sampleMedication);
      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('excede a dose máxima permitida de 1000 mg');
    });

    it('deve invalidar dose menor ou igual a zero', () => {
      expect(validateMedicationDose(0, sampleMedication).isValid).toBe(false);
      expect(validateMedicationDose(-10, sampleMedication).isValid).toBe(false);
    });
  });
});
