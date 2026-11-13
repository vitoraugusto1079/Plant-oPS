// ==============================================================================
// PlantãoPS - Página do Painel de Chamadas da Sala de Espera (Item 2.7 & 4)
// Modo TV / Quiosque em tempo real, SEM NOME DO PACIENTE, alerta sonoro
// ==============================================================================

import React, { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { callService } from '../services/callService';
import { useRealtimeTable } from '../hooks/useRealtimeTable';
import { Call, TriageColor } from '../domain/types';
import { RISK_CONFIG } from '../domain/triage';

export const KioskPanelPage: React.FC = () => {
  const [lastCallId, setLastCallId] = useState<string | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);

  // 1. Chamadas Recentes (A chamada atual + 5 anteriores)
  const { data: calls = [], refetch } = useQuery({
    queryKey: ['kiosk-calls'],
    queryFn: () => callService.getRecentCalls(6),
    refetchInterval: 5000,
  });

  // 2. Tempo Médio de Espera Atual por Cor
  const { data: avgWait = { Vermelho: 0, Laranja: 0, Amarelo: 0, Verde: 0, Azul: 0 } } = useQuery({
    queryKey: ['kiosk-avg-wait'],
    queryFn: () => callService.getAverageWaitTimes(),
    refetchInterval: 30000,
  });

  // Sincronização em tempo real na tabela 'calls'
  useRealtimeTable('calls', 'kiosk-calls');

  // Função para tocar bipe sonoro de chamada (Web Audio API)
  const playChime = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioCtx();
      }
      const ctx = audioContextRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      // Ding-dong chord
      osc.frequency.setValueAtTime(587.33, now); // D5
      osc.frequency.setValueAtTime(880.00, now + 0.2); // A5

      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.8);
    } catch (e) {
      console.error('Áudio não habilitado:', e);
    }
  };

  const currentCall: Call | undefined = calls[0];
  const previousCalls: Call[] = calls.slice(1, 6);

  // Efeito para disparar aviso sonoro quando surgir nova chamada
  useEffect(() => {
    if (currentCall && currentCall.id !== lastCallId) {
      if (lastCallId !== null && soundEnabled) {
        playChime();
      }
      setLastCallId(currentCall.id);
    }
  }, [currentCall, lastCallId, soundEnabled]);

  const colors: TriageColor[] = ['Vermelho', 'Laranja', 'Amarelo', 'Verde', 'Azul'];

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '24px',
        backgroundColor: '#06332e',
        color: '#ffffff',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      {/* Topo: Cabeçalho com Relógio e Botão de Áudio */}
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '2px solid #1e293b',
          paddingBottom: '16px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <span style={{ fontSize: '2.5rem' }}>🏥</span>
          <div>
            <h1 style={{ fontSize: '2rem', fontWeight: 900, margin: 0, letterSpacing: '-0.02em', color: '#b1d34b' }}>
              PRONTO-SOCORRO MUNICIPAL
            </h1>
            <span style={{ fontSize: '1rem', color: '#94a3b8' }}>Painel de Atendimento da Sala de Espera</span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <button
            type="button"
            onClick={() => {
              setSoundEnabled(!soundEnabled);
              playChime();
            }}
            style={{
              padding: '8px 16px',
              borderRadius: '999px',
              backgroundColor: soundEnabled ? '#15803d' : '#334155',
              color: '#ffffff',
              border: 'none',
              fontWeight: 700,
              fontSize: '0.9rem',
              cursor: 'pointer',
            }}
          >
            {soundEnabled ? '🔊 Som Ativo' : '🔇 Ativar Som'}
          </button>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#f4f7f6' }}>
            {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
      </header>

      {/* Centro: Chamada Atual em Destaque Gigante e Últimas Chamadas */}
      <main style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '32px', margin: '24px 0', flex: 1 }}>
        {/* Painel de Destaque da Chamada Atual */}
        <div
          style={{
            backgroundColor: '#0a4a42',
            borderRadius: '16px',
            border: '3px solid #3b82f6',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            padding: '36px',
            boxShadow: '0 0 50px rgba(0, 153, 93, 0.25)',
            textAlign: 'center',
          }}
        >
          <span style={{ fontSize: '1.5rem', fontWeight: 800, color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            CHAMADA ATUAL
          </span>

          {currentCall ? (
            <>
              <div
                style={{
                  fontSize: '6.5rem',
                  fontWeight: 900,
                  color: '#ffffff',
                  letterSpacing: '0.08em',
                  lineHeight: 1.1,
                  margin: '16px 0',
                }}
              >
                {currentCall.ticket_number}
              </div>

              <div
                style={{
                  fontSize: '2.75rem',
                  fontWeight: 800,
                  color: '#facc15',
                  backgroundColor: '#1f2937',
                  padding: '12px 32px',
                  borderRadius: '12px',
                  border: '2px solid #eab308',
                }}
              >
                {currentCall.room}
              </div>
            </>
          ) : (
            <div style={{ fontSize: '2rem', color: '#64748b', margin: '40px 0' }}>
              Aguardando próxima chamada...
            </div>
          )}
        </div>

        {/* Painel das Últimas 5 Chamadas */}
        <div
          style={{
            backgroundColor: '#0a4a42',
            borderRadius: '16px',
            border: '1px solid #1f2937',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#cbd5e1', margin: '0 0 16px 0', textTransform: 'uppercase' }}>
            Últimas Chamadas
          </h2>

          {previousCalls.length === 0 ? (
            <p style={{ color: '#64748b', fontSize: '1.1rem' }}>Nenhuma chamada anterior.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: 1, justifyContent: 'space-around' }}>
              {previousCalls.map((call) => (
                <div
                  key={call.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '12px 18px',
                    borderRadius: '8px',
                    backgroundColor: '#0a5f55',
                    border: '1px solid #334155',
                  }}
                >
                  <span style={{ fontSize: '2rem', fontWeight: 800, color: '#ffffff', letterSpacing: '0.05em' }}>
                    {call.ticket_number}
                  </span>
                  <span style={{ fontSize: '1.25rem', fontWeight: 700, color: '#ffffff' }}>
                    {call.room}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Rodapé: Tempo Médio de Espera Atual por Cor (Item 2.7) */}
      <footer
        style={{
          borderTop: '2px solid #1e293b',
          paddingTop: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
        }}
      >
        <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>
          Tempo Médio de Espera Atual por Classificação de Risco:
        </span>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px' }}>
          {colors.map((c) => {
            const config = RISK_CONFIG[c];
            const avgMins = avgWait[c] || 0;
            return (
              <div
                key={c}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  backgroundColor: '#0a4a42',
                  border: `2px solid ${config.hex}`,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span
                    style={{
                      width: '12px',
                      height: '12px',
                      borderRadius: '50%',
                      backgroundColor: config.hex,
                      display: 'inline-block',
                    }}
                  />
                  <strong style={{ fontSize: '0.95rem', color: '#f4f7f6' }}>{c}</strong>
                </div>

                <span style={{ fontSize: '1.1rem', fontWeight: 800, color: config.hex }}>
                  {avgMins} min
                </span>
              </div>
            );
          })}
        </div>
      </footer>
    </div>
  );
};
