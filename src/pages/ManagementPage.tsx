// ==============================================================================
// PlantãoPS - Página do Painel da Gestão (Item 2.8 & 4)
// Indicadores calculados a partir do banco, filtros de período e exportação CSV
// ==============================================================================

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { managementService, ManagementPeriod } from '../services/managementService';
import { StatCard } from '../components/StatCard';
import { RiskBadge } from '../components/RiskBadge';
import { RISK_CONFIG } from '../domain/triage';

export const ManagementPage: React.FC = () => {
  const [period, setPeriod] = useState<ManagementPeriod>('hoje');

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['management-dashboard', period],
    queryFn: () => managementService.getDashboardData(period),
    refetchInterval: 30000,
  });

  // Função para exportar os dados do painel em CSV (Item 4 - Diferencial Criativo)
  const exportToCSV = () => {
    if (!data) return;

    let csvContent = 'data:text/csv;charset=utf-8,';
    csvContent += 'INDICADOR,VALOR,DETALHES\r\n';
    csvContent += `Periodo,${data.period},\r\n`;
    csvContent += `Total de Atendimentos,${data.totalEncounters},\r\n`;
    csvContent += `Atendimentos Fora do Prazo,${data.overdueCount},${data.overduePercentage}%\r\n`;
    csvContent += `Taxa de Ocupacao dos Leitos,${data.bedOccupancy.occupancyRate}%,${data.bedOccupancy.occupiedBeds} de ${data.bedOccupancy.totalBeds} leitos\r\n\r\n`;

    csvContent += 'DISTRIBUICAO POR COR\r\n';
    csvContent += 'Cor,Quantidade,Percentual\r\n';
    data.distributionByColor.forEach((d) => {
      csvContent += `${d.color},${d.count},${d.percentage}%\r\n`;
    });

    csvContent += '\r\nTEMPO MEDIO DE ESPERA\r\n';
    csvContent += 'Cor,Tempo Medio (min),Tempo Maximo Permitido (min)\r\n';
    data.waitTimeByColor.forEach((w) => {
      csvContent += `${w.color},${w.avgMinutes},${w.maxAllowedMinutes}\r\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `relatorio_gestao_plantaops_${period}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Cabeçalho e Filtro por Período */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0f172a', margin: '0 0 6px 0' }}>
            Painel de Indicadores da Gestão
          </h1>
          <p style={{ color: '#64748b', margin: 0 }}>
            Métricas de fluxo, ocupação hospitalar e eficiência clínica calculadas diretamente do banco.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Filtros de Período (Item 2.8) */}
          <div style={{ display: 'inline-flex', borderRadius: '6px', border: '1px solid #cbd5e1', overflow: 'hidden' }}>
            {[
              { id: 'hoje', label: 'Hoje' },
              { id: '7dias', label: 'Últimos 7 dias' },
              { id: '30dias', label: 'Últimos 30 dias' },
            ].map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPeriod(p.id as ManagementPeriod)}
                style={{
                  padding: '8px 14px',
                  backgroundColor: period === p.id ? '#0f172a' : '#ffffff',
                  color: period === p.id ? '#ffffff' : '#334155',
                  border: 'none',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                }}
              >
                {p.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={exportToCSV}
            disabled={!data}
            style={{
              padding: '8px 14px',
              backgroundColor: '#0284c7',
              color: '#ffffff',
              borderRadius: '6px',
              border: 'none',
              fontWeight: 700,
              fontSize: '0.85rem',
              cursor: 'pointer',
            }}
          >
            📥 Exportar CSV
          </button>
        </div>
      </div>

      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: '#64748b' }}>
          Calculando indicadores a partir dos dados do banco...
        </div>
      ) : isError || !data ? (
        <div style={{ padding: '16px', backgroundColor: '#fee2e2', color: '#b91c1c', borderRadius: '6px' }}>
          Erro ao calcular indicadores: {(error as any)?.message}
        </div>
      ) : (
        <>
          {/* Linha 1: StatCards Principais */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
            <StatCard
              title="Total de Atendimentos"
              value={data.totalEncounters}
              subtitle={`Período: ${period === 'hoje' ? 'Hoje' : period === '7dias' ? '7 dias' : '30 dias'}`}
              icon="👥"
            />
            <StatCard
              title="Atendimentos Fora do Prazo"
              value={`${data.overduePercentage}%`}
              subtitle={`${data.overdueCount} pacientes aguardaram além do limite`}
              alert={data.overduePercentage > 20}
              icon="⏱️"
            />
            <StatCard
              title="Taxa de Ocupação de Leitos"
              value={`${data.bedOccupancy.occupancyRate}%`}
              subtitle={`${data.bedOccupancy.occupiedBeds} ocupados de ${data.bedOccupancy.totalBeds} totais`}
              alert={data.bedOccupancy.occupancyRate > 85}
              icon="🛏️"
            />
            <StatCard
              title="Leitos em Higienização"
              value={data.bedOccupancy.cleaningBeds}
              subtitle={`${data.bedOccupancy.freeBeds} leitos prontos e livres`}
              icon="🧹"
            />
          </div>

          {/* Linha 2: Distribuição por Cor e Tempo Médio vs Máximo */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '20px' }}>
            {/* Distribuição dos atendimentos por cor */}
            <div style={{ backgroundColor: '#ffffff', padding: '20px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1e293b', margin: '0 0 16px 0' }}>
                Distribuição dos Atendimentos por Cor
              </h2>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {data.distributionByColor.map((item) => {
                  const config = RISK_CONFIG[item.color];
                  return (
                    <div key={item.color}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '4px' }}>
                        <span style={{ fontWeight: 700, color: '#1e293b' }}>{item.color}</span>
                        <span style={{ color: '#64748b' }}>
                          {item.count} atendimentos ({item.percentage}%)
                        </span>
                      </div>
                      <div style={{ height: '10px', backgroundColor: '#f1f5f9', borderRadius: '999px', overflow: 'hidden' }}>
                        <div
                          style={{
                            height: '100%',
                            width: `${item.percentage}%`,
                            backgroundColor: config.hex,
                            borderRadius: '999px',
                            transition: 'width 0.4s ease',
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Tempo Médio de Espera vs Tempo Máximo */}
            <div style={{ backgroundColor: '#ffffff', padding: '20px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1e293b', margin: '0 0 16px 0' }}>
                Tempo Médio de Espera vs. Tempo Máximo
              </h2>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {data.waitTimeByColor.map((item) => (
                  <div
                    key={item.color}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      backgroundColor: item.isOverdueAvg ? '#fef2f2' : '#f8fafc',
                      border: item.isOverdueAvg ? '1px solid #fecaca' : '1px solid #e2e8f0',
                    }}
                  >
                    <RiskBadge color={item.color} size="sm" showPriority={false} />

                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.9rem' }}>
                      <span>
                        Médio: <strong>{item.avgMinutes} min</strong>
                      </span>
                      <span style={{ color: '#64748b', fontSize: '0.8rem' }}>
                        (Máx: {item.maxAllowedMinutes === 0 ? 'Imediato' : `${item.maxAllowedMinutes} min`})
                      </span>
                      {item.isOverdueAvg && (
                        <span style={{ color: '#dc2626', fontWeight: 700, fontSize: '0.75rem' }}>
                          ⚠️ Acima do teto!
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Linha 3: Atendimentos por Hora no Dia */}
          <div style={{ backgroundColor: '#ffffff', padding: '20px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1e293b', margin: '0 0 16px 0' }}>
              Atendimentos por Hora no Dia (00:00 às 23:00)
            </h2>

            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '6px', height: '160px', paddingBottom: '24px', position: 'relative' }}>
              {data.encountersPerHour.map((item) => {
                const maxCount = Math.max(...data.encountersPerHour.map((h) => h.count), 1);
                const heightPercent = Math.round((item.count / maxCount) * 100);

                return (
                  <div
                    key={item.hour}
                    style={{
                      flex: 1,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      height: '100%',
                      justifyContent: 'flex-end',
                    }}
                  >
                    <span style={{ fontSize: '0.7rem', color: '#64748b', marginBottom: '2px' }}>
                      {item.count > 0 ? item.count : ''}
                    </span>
                    <div
                      style={{
                        width: '100%',
                        height: `${Math.max(heightPercent, 4)}%`,
                        backgroundColor: item.count > 0 ? '#2563eb' : '#e2e8f0',
                        borderRadius: '3px 3px 0 0',
                        transition: 'height 0.3s ease',
                      }}
                      title={`${item.hour}: ${item.count} atendimentos`}
                    />
                    <span style={{ fontSize: '0.65rem', color: '#94a3b8', marginTop: '4px', transform: 'rotate(-45deg)', transformOrigin: 'top left' }}>
                      {item.hour.slice(0, 2)}h
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
