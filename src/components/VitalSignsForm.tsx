// ==============================================================================
// PlantãoPS - Componente: VitalSignsForm (Item 3.2, 3.8 & 2.3)
// React Hook Form + Zod, sugestão automática de cor e justificativa obrigatória
// ==============================================================================

import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ConsciousnessLevel, TriageColor, VitalSigns } from '../domain/types';
import { classifyRisk } from '../domain/triage';
import { RiskBadge } from './RiskBadge';

const vitalSignsSchema = z.object({
  systolicBp: z
    .number()
    .min(30, 'Pressão sistólica mínima: 30 mmHg')
    .max(300, 'Pressão sistólica máxima: 300 mmHg'),
  diastolicBp: z
    .number()
    .min(20, 'Pressão diastólica mínima: 20 mmHg')
    .max(200, 'Pressão diastólica máxima: 200 mmHg'),
  heartRate: z
    .number()
    .min(20, 'Frequência cardíaca mínima: 20 bpm')
    .max(300, 'Frequência cardíaca máxima: 300 bpm'),
  temperature: z
    .number()
    .min(25, 'Temperatura mínima: 25 °C')
    .max(45, 'Temperatura máxima: 45 °C'),
  oxygenSaturation: z
    .number()
    .min(0, 'Saturação mínima: 0%')
    .max(100, 'Saturação máxima: 100%'),
  painScale: z
    .number()
    .min(0, 'A escala de dor varia de 0 a 10')
    .max(10, 'A escala de dor varia de 0 a 10'),
  consciousnessLevel: z.enum(['alerta', 'confuso', 'inconsciente'] as const),
  chiefComplaint: z
    .string()
    .min(3, 'A queixa principal deve ter no mínimo 3 caracteres'),
  finalColor: z.enum(['Vermelho', 'Laranja', 'Amarelo', 'Verde', 'Azul'] as const),
  justification: z.string().optional(),
});

export type VitalSignsFormData = z.infer<typeof vitalSignsSchema>;

export interface VitalSignsFormProps {
  initialVitals?: Partial<VitalSigns>;
  onSubmitTriage: (
    vitals: VitalSigns,
    suggestedColor: TriageColor,
    finalColor: TriageColor,
    justification?: string
  ) => Promise<void> | void;
  isSubmitting?: boolean;
  isReclassification?: boolean;
}

export const VitalSignsForm: React.FC<VitalSignsFormProps> = ({
  initialVitals,
  onSubmitTriage,
  isSubmitting = false,
  isReclassification = false,
}) => {
  const [suggestedColor, setSuggestedColor] = useState<TriageColor>('Azul');
  const [matchedCriteria, setMatchedCriteria] = useState<string[]>([]);
  const [validationError, setValidationError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<VitalSignsFormData>({
    resolver: zodResolver(vitalSignsSchema) as any,
    defaultValues: {
      systolicBp: initialVitals?.systolicBp ?? 120,
      diastolicBp: initialVitals?.diastolicBp ?? 80,
      heartRate: initialVitals?.heartRate ?? 75,
      temperature: initialVitals?.temperature ?? 36.5,
      oxygenSaturation: initialVitals?.oxygenSaturation ?? 98,
      painScale: initialVitals?.painScale ?? 0,
      consciousnessLevel: initialVitals?.consciousnessLevel ?? 'alerta',
      chiefComplaint: initialVitals?.chiefComplaint ?? '',
      finalColor: 'Azul',
      justification: '',
    },
  });

  const watchedValues = watch();

  // Recalcular automaticamente a cor sugerida a cada alteração de valores
  useEffect(() => {
    const vitals: VitalSigns = {
      systolicBp: Number(watchedValues.systolicBp) || 0,
      diastolicBp: Number(watchedValues.diastolicBp) || 0,
      heartRate: Number(watchedValues.heartRate) || 0,
      temperature: Number(watchedValues.temperature) || 0,
      oxygenSaturation: Number(watchedValues.oxygenSaturation) || 0,
      painScale: Number(watchedValues.painScale) || 0,
      consciousnessLevel: (watchedValues.consciousnessLevel as ConsciousnessLevel) || 'alerta',
      chiefComplaint: watchedValues.chiefComplaint || '',
    };

    const result = classifyRisk(vitals);
    setSuggestedColor(result.color);
    setMatchedCriteria(result.matchedCriteria);

    // Se o usuário ainda não alterou manualmente, acompanha a sugestão
    if (!watchedValues.justification && watchedValues.finalColor !== result.color) {
      setValue('finalColor', result.color);
    }
  }, [
    watchedValues.systolicBp,
    watchedValues.diastolicBp,
    watchedValues.heartRate,
    watchedValues.temperature,
    watchedValues.oxygenSaturation,
    watchedValues.painScale,
    watchedValues.consciousnessLevel,
    setValue,
  ]);

  const onFormSubmit = (data: VitalSignsFormData) => {
    setValidationError(null);

    // Regra do item 2.3: Ao alterar a cor sugerida, a justificativa é OBRIGATÓRIA!
    if (data.finalColor !== suggestedColor) {
      if (!data.justification || data.justification.trim().length === 0) {
        setValidationError(
          `Justificativa obrigatória: Você alterou a cor sugerida (${suggestedColor}) para ${data.finalColor}. Por favor, descreva o motivo clínico.`
        );
        return;
      }
    }

    const vitals: VitalSigns = {
      systolicBp: data.systolicBp,
      diastolicBp: data.diastolicBp,
      heartRate: data.heartRate,
      temperature: data.temperature,
      oxygenSaturation: data.oxygenSaturation,
      painScale: data.painScale,
      consciousnessLevel: data.consciousnessLevel,
      chiefComplaint: data.chiefComplaint,
    };

    onSubmitTriage(vitals, suggestedColor, data.finalColor, data.justification);
  };

  const isColorOverridden = watchedValues.finalColor !== suggestedColor;

  return (
    <form
      onSubmit={handleSubmit(onFormSubmit)}
      style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
      aria-label="Formulário de Triagem e Sinais Vitais"
    >
      <h3>
        {isReclassification ? '🔄 Reclassificação de Risco' : '📋 Registro de Triagem (Sinais Vitais)'}
      </h3>

      {validationError && (
        <div
          role="alert"
          style={{
            padding: '10px 14px',
            backgroundColor: '#fee2e2',
            color: '#b91c1c',
            border: '1px solid #f87171',
            borderRadius: '6px',
            fontWeight: 600,
          }}
        >
          {validationError}
        </div>
      )}

      {/* Grid de Sinais Vitais */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
        {/* Pressão Arterial */}
        <div>
          <label htmlFor="systolicBp" style={{ display: 'block', fontWeight: 600, marginBottom: '4px' }}>
            PA Sistólica (mmHg) *
          </label>
          <input
            id="systolicBp"
            type="number"
            {...register('systolicBp', { valueAsNumber: true })}
            style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
          />
          {errors.systolicBp && <span style={{ color: '#dc2626', fontSize: '0.8rem' }}>{errors.systolicBp.message}</span>}
        </div>

        <div>
          <label htmlFor="diastolicBp" style={{ display: 'block', fontWeight: 600, marginBottom: '4px' }}>
            PA Diastólica (mmHg) *
          </label>
          <input
            id="diastolicBp"
            type="number"
            {...register('diastolicBp', { valueAsNumber: true })}
            style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
          />
          {errors.diastolicBp && <span style={{ color: '#dc2626', fontSize: '0.8rem' }}>{errors.diastolicBp.message}</span>}
        </div>

        {/* Frequência Cardíaca */}
        <div>
          <label htmlFor="heartRate" style={{ display: 'block', fontWeight: 600, marginBottom: '4px' }}>
            Freq. Cardíaca (bpm) *
          </label>
          <input
            id="heartRate"
            type="number"
            {...register('heartRate', { valueAsNumber: true })}
            style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
          />
          {errors.heartRate && <span style={{ color: '#dc2626', fontSize: '0.8rem' }}>{errors.heartRate.message}</span>}
        </div>

        {/* Temperatura */}
        <div>
          <label htmlFor="temperature" style={{ display: 'block', fontWeight: 600, marginBottom: '4px' }}>
            Temperatura (°C) *
          </label>
          <input
            id="temperature"
            type="number"
            step="0.1"
            {...register('temperature', { valueAsNumber: true })}
            style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
          />
          {errors.temperature && <span style={{ color: '#dc2626', fontSize: '0.8rem' }}>{errors.temperature.message}</span>}
        </div>

        {/* Saturação de O2 */}
        <div>
          <label htmlFor="oxygenSaturation" style={{ display: 'block', fontWeight: 600, marginBottom: '4px' }}>
            Saturação O₂ (%) *
          </label>
          <input
            id="oxygenSaturation"
            type="number"
            {...register('oxygenSaturation', { valueAsNumber: true })}
            style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
          />
          {errors.oxygenSaturation && (
            <span style={{ color: '#dc2626', fontSize: '0.8rem' }}>{errors.oxygenSaturation.message}</span>
          )}
        </div>

        {/* Escala de Dor (0 a 10) */}
        <div>
          <label htmlFor="painScale" style={{ display: 'block', fontWeight: 600, marginBottom: '4px' }}>
            Escala de Dor (0 a 10) *
          </label>
          <input
            id="painScale"
            type="number"
            min="0"
            max="10"
            {...register('painScale', { valueAsNumber: true })}
            style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
          />
          {errors.painScale && <span style={{ color: '#dc2626', fontSize: '0.8rem' }}>{errors.painScale.message}</span>}
        </div>

        {/* Nível de Consciência */}
        <div>
          <label htmlFor="consciousnessLevel" style={{ display: 'block', fontWeight: 600, marginBottom: '4px' }}>
            Nível de Consciência *
          </label>
          <select
            id="consciousnessLevel"
            {...register('consciousnessLevel')}
            style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
          >
            <option value="alerta">Alerta / Orientado</option>
            <option value="confuso">Confuso</option>
            <option value="inconsciente">Inconsciente</option>
          </select>
          {errors.consciousnessLevel && (
            <span style={{ color: '#dc2626', fontSize: '0.8rem' }}>{errors.consciousnessLevel.message}</span>
          )}
        </div>
      </div>

      {/* Queixa Principal */}
      <div>
        <label htmlFor="chiefComplaint" style={{ display: 'block', fontWeight: 600, marginBottom: '4px' }}>
          Queixa Principal *
        </label>
        <textarea
          id="chiefComplaint"
          rows={3}
          placeholder="Descreva a queixa e sintomas relatados pelo paciente..."
          {...register('chiefComplaint')}
          style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
        />
        {errors.chiefComplaint && (
          <span style={{ color: '#dc2626', fontSize: '0.8rem' }}>{errors.chiefComplaint.message}</span>
        )}
      </div>

      {/* Painel de Sugestão Automática de Classificação */}
      <div
        style={{
          padding: '14px',
          borderRadius: '8px',
          backgroundColor: '#f1f5f9',
          border: '1px solid #cbd5e1',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
          <div>
            <span style={{ fontWeight: 700, marginRight: '8px' }}>Sugestão Automática do Sistema:</span>
            <RiskBadge color={suggestedColor} showPriority={true} showMaxWait={true} />
          </div>

          <div>
            <label htmlFor="finalColor" style={{ fontWeight: 700, marginRight: '8px' }}>
              Cor Confirmada pelo Enfermeiro:
            </label>
            <select
              id="finalColor"
              {...register('finalColor')}
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                fontWeight: 700,
                border: isColorOverridden ? '2px solid #ea580c' : '1px solid #94a3b8',
              }}
            >
              <option value="Vermelho">Vermelho - Emergência (Imediato)</option>
              <option value="Laranja">Laranja - Muito urgente (10 min)</option>
              <option value="Amarelo">Amarelo - Urgente (60 min)</option>
              <option value="Verde">Verde - Pouco urgente (120 min)</option>
              <option value="Azul">Azul - Não urgente (240 min)</option>
            </select>
          </div>
        </div>

        {matchedCriteria.length > 0 && (
          <div style={{ fontSize: '0.85rem', color: '#475569' }}>
            <strong>Critérios identificados nos sinais vitais:</strong> {matchedCriteria.join('; ')}
          </div>
        )}

        {isColorOverridden && (
          <div style={{ marginTop: '8px', padding: '10px', backgroundColor: '#fff7ed', borderRadius: '6px', border: '1px solid #fed7aa' }}>
            <label htmlFor="justification" style={{ display: 'block', fontWeight: 700, color: '#9a3412', marginBottom: '4px' }}>
              ⚠️ Justificativa Obrigatória da Alteração Clínica *
            </label>
            <textarea
              id="justification"
              rows={2}
              placeholder="Explique detalhadamente o julgamento clínico que motivou a alteração da cor sugerida..."
              {...register('justification')}
              style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ea580c' }}
            />
          </div>
        )}
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        style={{
          padding: '12px 24px',
          backgroundColor: '#059669',
          color: '#ffffff',
          fontWeight: 700,
          fontSize: '1rem',
          borderRadius: '6px',
          border: 'none',
          cursor: isSubmitting ? 'not-allowed' : 'pointer',
        }}
      >
        {isSubmitting ? 'Salvando triagem...' : isReclassification ? 'Confirmar Reclassificação' : 'Concluir Triagem e Enviar para Fila'}
      </button>
    </form>
  );
};
