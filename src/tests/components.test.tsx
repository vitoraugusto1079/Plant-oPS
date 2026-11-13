// ==============================================================================
// PlantãoPS - Testes de Componentes com React Testing Library (Item 3.9)
// ==============================================================================

import '@testing-library/jest-dom/vitest';
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RiskBadge } from '../components/RiskBadge';
import { WaitTimer } from '../components/WaitTimer';
import { VitalSignsForm } from '../components/VitalSignsForm';

describe('Componentes Visuais e de Acessibilidade', () => {
  describe('RiskBadge (Item 3.2 & 3.10)', () => {
    it('deve exibir tanto a cor quanto o texto descritivo para pessoas com daltonismo', () => {
      render(<RiskBadge color="Vermelho" showPriority={true} />);
      expect(screen.getByRole('status')).toBeInTheDocument();
      expect(screen.getByText('Vermelho')).toBeInTheDocument();
      expect(screen.getByText('- Emergência')).toBeInTheDocument();
    });

    it('deve renderizar fallback acessível quando não classificado', () => {
      render(<RiskBadge color={null} />);
      expect(screen.getByText('Não classificado')).toBeInTheDocument();
    });
  });

  describe('WaitTimer (Item 3.2 & 2.4)', () => {
    it('deve exibir o contador de espera e destacar visualmente quando ultrapassar o prazo', () => {
      // Triagem feita há 20 minutos para cor Laranja (máximo 10 min)
      const twentyMinsAgo = new Date(Date.now() - 20 * 60 * 1000);
      render(<WaitTimer triagedAt={twentyMinsAgo} color="Laranja" />);

      expect(screen.getByRole('timer')).toBeInTheDocument();
      expect(screen.getByText('ATRASADO!')).toBeInTheDocument();
      expect(screen.getByText(/10min máx/)).toBeInTheDocument();
    });
  });

  describe('VitalSignsForm (Item 3.2, 3.8 & 3.9)', () => {
    it('deve renderizar os campos obrigatórios de sinais vitais e queixa', () => {
      const mockSubmit = vi.fn();
      render(<VitalSignsForm onSubmitTriage={mockSubmit} />);

      expect(screen.getByLabelText(/PA Sistólica/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/PA Diastólica/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Freq. Cardíaca/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Temperatura/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Saturação O₂/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Escala de Dor/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Nível de Consciência/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Queixa Principal/i)).toBeInTheDocument();
    });

    it('deve recalcular dinamicamente a sugestão automática para Vermelho quando SpO2 < 90%', async () => {
      const mockSubmit = vi.fn();
      render(<VitalSignsForm onSubmitTriage={mockSubmit} />);

      const spo2Input = screen.getByLabelText(/Saturação O₂/i);
      fireEvent.change(spo2Input, { target: { value: '88' } });

      // O badge de sugestão automática deve refletir Vermelho
      expect(await screen.findByText('Vermelho')).toBeInTheDocument();
    });
  });
});
