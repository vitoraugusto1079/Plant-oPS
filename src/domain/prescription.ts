import { Medication, PatientAllergy } from './types';

export interface AllergyValidationResult {
  isAllergic: boolean;
  matchedAllergen?: string;
  reason?: string;
}

export interface DoseValidationResult {
  isValid: boolean;
  maxDose: number;
  unit: string;
  reason?: string;
}

function normalizeString(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

export function validateMedicationAllergy(
  allergies: (PatientAllergy | string)[] = [],
  medicationName: string
): AllergyValidationResult {
  const normMed = normalizeString(medicationName);

  for (const item of allergies) {
    const allergenName = typeof item === 'string' ? item : item.allergen_name;
    const normAllergen = normalizeString(allergenName);

    if (normAllergen && (normMed.includes(normAllergen) || normAllergen.includes(normMed))) {
      return {
        isAllergic: true,
        matchedAllergen: allergenName,
        reason: `Prescrição bloqueada: O paciente possui alergia confirmada a "${allergenName}".`,
      };
    }
  }

  return { isAllergic: false };
}

export function validateMedicationDose(
  dose: number,
  medication: Medication
): DoseValidationResult {
  if (dose <= 0) {
    return {
      isValid: false,
      maxDose: medication.max_dose,
      unit: medication.unit,
      reason: 'A dose prescrita deve ser maior que zero.',
    };
  }

  if (dose > medication.max_dose) {
    return {
      isValid: false,
      maxDose: medication.max_dose,
      unit: medication.unit,
      reason: `Prescrição bloqueada: A dose informada (${dose} ${medication.unit}) excede a dose máxima permitida de ${medication.max_dose} ${medication.unit} para ${medication.name}.`,
    };
  }

  return {
    isValid: true,
    maxDose: medication.max_dose,
    unit: medication.unit,
  };
}
