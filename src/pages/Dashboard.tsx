import { useEffect, useState, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import {
  MonitorPlay,
  Play,
  BarChart3,
  Activity,
  Calendar,
  Radio
} from 'lucide-react';

export default function Dashboard() {
  const [terminals, setTerminals] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [totalPlaysDB, setTotalPlaysDB] = useState<number>(0);
  const [selectedTerminalFilter, setSelectedTerminalFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [lastLiveUpdate, setLastLiveUpdate] = useState<Date | null>(null);
  const [newPlaysCount, setNewPlaysCount] = useState(0);
  const [hoveredDay, setHoveredDay] = useState<number | null>(null);

  useEffect(() => {
    async function loadDashboardData() {
      try {
        const { data: terminalsData } = await supabase.from('terminals').select('*');

        // 1. Busca contagem total exata sem truncamento
        const { count: exactCount } = await supabase
          .from('terminal_logs')
          .select('*', { count: 'exact', head: true })
          .eq('event_type', 'playback_start');

        // 2. Busca os últimos 5000 logs ordenados por data (para que os de HOJE nunca sejam cortados pelo limite de 1000)
        const { data: logsData } = await supabase
          .from('terminal_logs')
          .select('*')
          .eq('event_type', 'playback_start')
          .order('created_at', { ascending: false })
          .limit(5000);

        setTerminals(terminalsData || []);
        setLogs(logsData || []);
        setTotalPlaysDB(exactCount || (logsData || []).length);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadDashboardData();

    // Inscrição em tempo real para novos logs de reprodução
    const subscription = supabase
      .channel('terminal-playback-logs')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'terminal_logs',
          filter: 'event_type=eq.playback_start'
        },
        (payload: any) => {
          setLogs((prev) => [payload.new, ...prev]);
          setTotalPlaysDB((prev) => prev + 1);
          setLastLiveUpdate(new Date());
          setNewPlaysCount((prev) => prev + 1);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, []);

  const { filteredStats, ranking, weeklyChart, topMediaMax } = useMemo(() => {
    const threeMinutesAgo = new Date(Date.now() - 3 * 60 * 1000);

    const activeTerminals = selectedTerminalFilter
      ? terminals.filter((t: any) => t.id === selectedTerminalFilter)
      : terminals;

    const filteredLogs = selectedTerminalFilter
      ? logs.filter((log: any) => log.terminal_id === selectedTerminalFilter)
      : logs;

    const total = activeTerminals.length;
    const online = activeTerminals.filter((t: any) => t.status === 'online').length;
    const activeNow = activeTerminals.filter(
      (t: any) => t.last_seen_at && new Date(t.last_seen_at) > threeMinutesAgo
    ).length;
    const totalPlays = selectedTerminalFilter
      ? filteredLogs.length
      : Math.max(totalPlaysDB, filteredLogs.length);

    // Estatísticas semanais (Segunda a Domingo)
    const weekDays = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
    const dayCounts = [0, 0, 0, 0, 0, 0, 0]; // 0 = Seg, ..., 6 = Dom
    const todayIndex = (new Date().getDay() + 6) % 7; // Mapeia Dom(0)->6, Seg(1)->0...

    filteredLogs.forEach((log: any) => {
      const date = new Date(log.created_at);
      const idx = (date.getDay() + 6) % 7;
      dayCounts[idx] += 1;
    });

    const maxDayCount = Math.max(...dayCounts, 5);
    const totalWeekly = dayCounts.reduce((acc, v) => acc + v, 0);
    const dailyAverage = Math.round(totalWeekly / 7);

    // Identificar dia com mais exibições
    let maxDayIdx = 0;
    dayCounts.forEach((count, idx) => {
      if (count > dayCounts[maxDayIdx]) maxDayIdx = idx;
    });

    // Ranking de Mídias
    const mediaMap: Record<
      string,
      { name: string; total_plays: number; last_played_at: string }
    > = {};

    filteredLogs.forEach((log: any) => {
      const meta = log.metadata || {};
      const mediaId = meta.media_id || 'unknown';
      const mediaName = meta.media_name || 'Mídia Sem Nome';

      if (!mediaMap[mediaId]) {
        mediaMap[mediaId] = {
          name: mediaName,
          total_plays: 0,
          last_played_at: log.created_at
        };
      }

      mediaMap[mediaId].total_plays += 1;
      if (new Date(log.created_at) > new Date(mediaMap[mediaId].last_played_at)) {
        mediaMap[mediaId].last_played_at = log.created_at;
      }
    });

    const rankingData = Object.values(mediaMap).sort(
      (a: any, b: any) => b.total_plays - a.total_plays
    );
    const topMediaMax = rankingData.length > 0 ? rankingData[0].total_plays : 1;

    return {
      filteredStats: { total, online, activeNow, totalPlays, dailyAverage },
      ranking: rankingData,
      weeklyChart: {
        weekDays,
        dayCounts,
        maxDayCount,
        todayIndex,
        maxDayIdx,
        totalWeekly
      },
      topMediaMax
    };
  }, [terminals, logs, selectedTerminalFilter, totalPlaysDB]);

  return (
    <div>
      {/* Cabeçalho */}
      <div className="page-header">
        <div className="page-title-group">
          <div className="page-title-row">
            <h1 className="page-title">Visão Geral</h1>
            <span className="badge badge-success">
              <span className="status-dot online pulse" />
              Tempo real
            </span>
          </div>
          <p className="page-subtitle">
            {lastLiveUpdate
              ? `Último evento recebido às ${lastLiveUpdate.toLocaleTimeString('pt-BR')} (${newPlaysCount} novas exibições nesta sessão)`
              : 'Monitoramento contínuo de exibições e conectividade dos terminais da rede.'}
          </p>
        </div>

        <div className="page-actions">
          <select
            className="select-field"
            style={{ width: 250, background: 'var(--bg-surface)' }}
            value={selectedTerminalFilter}
            onChange={(e) => setSelectedTerminalFilter(e.target.value)}
            aria-label="Filtrar por terminal"
          >
            <option value="">Todos os terminais ({terminals.length})</option>
            {terminals.map((t: any) => (
              <option key={t.id} value={t.id}>
                {t.name} {t.location ? `— ${t.location}` : ''}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-label">Total de Exibições</span>
            <span className="kpi-icon">
              <Play size={15} strokeWidth={1.75} />
            </span>
          </div>
          <div className="kpi-value">
            {loading ? '—' : filteredStats.totalPlays.toLocaleString('pt-BR')}
          </div>
          <div className="kpi-meta">
            <span className="status-dot accent" />
            <span>Contagem acumulada dos players</span>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-label">Terminais com Sinal Ativo</span>
            <span className="kpi-icon">
              <MonitorPlay size={15} strokeWidth={1.75} />
            </span>
          </div>
          <div className="kpi-value">
            {loading ? (
              '—'
            ) : (
              <>
                {filteredStats.activeNow}{' '}
                <span className="kpi-value-muted">/ {filteredStats.total}</span>
              </>
            )}
          </div>
          <div className="kpi-meta">
            <span>Heartbeat recebido nos últimos 3 min</span>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-label">Média Diária</span>
            <span className="kpi-icon">
              <Calendar size={15} strokeWidth={1.75} />
            </span>
          </div>
          <div className="kpi-value">
            {loading ? '—' : filteredStats.dailyAverage.toLocaleString('pt-BR')}
          </div>
          <div className="kpi-meta">
            <span>Reproduções por dia na janela atual</span>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-label">Pico Semanal</span>
            <span className="kpi-icon">
              <BarChart3 size={15} strokeWidth={1.75} />
            </span>
          </div>
          <div className="kpi-value">
            {loading
              ? '—'
              : weeklyChart.dayCounts[weeklyChart.maxDayIdx].toLocaleString('pt-BR')}
          </div>
          <div className="kpi-meta">
            <span>
              Maior volume registrado ({weeklyChart.weekDays[weeklyChart.maxDayIdx]})
            </span>
          </div>
        </div>
      </div>

      {/* Gráfico Semanal */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header">
          <div>
            <h2 className="card-title">Distribuição de Exibições por Dia</h2>
            <p className="card-subtitle">
              Volume de reproduções registradas ao longo dos dias da semana
            </p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span className="text-xs text-muted" style={{ display: 'block' }}>
              Amostra analisada
            </span>
            <span className="font-mono" style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
              {weeklyChart.totalWeekly.toLocaleString('pt-BR')} plays
            </span>
          </div>
        </div>

        <div className="card-body">
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'space-between',
              height: 210,
              paddingTop: 28,
              borderBottom: '1px solid var(--border-subtle)',
              position: 'relative',
              backgroundImage:
                'linear-gradient(to bottom, rgba(255,255,255,0.03) 1px, transparent 1px)',
              backgroundSize: '100% 52px'
            }}
          >
            {weeklyChart.weekDays.map((dayLabel, idx) => {
              const count = weeklyChart.dayCounts[idx];
              const heightPercent = Math.max(
                Math.round((count / weeklyChart.maxDayCount) * 100),
                3
              );
              const isToday = idx === weeklyChart.todayIndex;
              const isHovered = hoveredDay === idx;

              return (
                <div
                  key={dayLabel}
                  style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    height: '100%',
                    justifyContent: 'flex-end',
                    cursor: 'pointer',
                    position: 'relative'
                  }}
                  onMouseEnter={() => setHoveredDay(idx)}
                  onMouseLeave={() => setHoveredDay(null)}
                >
                  {(isHovered || isToday) && (
                    <div
                      className="font-mono"
                      style={{
                        position: 'absolute',
                        bottom: `calc(${heightPercent}% + 8px)`,
                        background: 'var(--bg-elevated)',
                        border: '1px solid var(--border-default)',
                        padding: '3px 8px',
                        borderRadius: 'var(--r-sm)',
                        fontSize: 11,
                        fontWeight: 500,
                        color: 'var(--text-primary)',
                        whiteSpace: 'nowrap',
                        boxShadow: 'var(--shadow-sm)',
                        zIndex: 10
                      }}
                    >
                      {count.toLocaleString('pt-BR')}
                    </div>
                  )}

                  <div
                    style={{
                      width: '52%',
                      maxWidth: 44,
                      height: `${heightPercent}%`,
                      borderRadius: '4px 4px 0 0',
                      background: isToday
                        ? 'var(--accent)'
                        : isHovered
                          ? 'var(--text-secondary)'
                          : 'var(--bg-overlay)',
                      border: isToday
                        ? 'none'
                        : '1px solid rgba(255, 255, 255, 0.06)',
                      borderBottom: 'none',
                      transition:
                        'height 0.4s cubic-bezier(0.16, 1, 0.3, 1), background 0.15s ease'
                    }}
                  />
                </div>
              );
            })}
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              paddingTop: 10
            }}
          >
            {weeklyChart.weekDays.map((dayLabel, idx) => {
              const isToday = idx === weeklyChart.todayIndex;
              return (
                <div key={dayLabel} style={{ flex: 1, textAlign: 'center' }}>
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: isToday ? 600 : 450,
                      color: isToday ? 'var(--text-primary)' : 'var(--text-tertiary)'
                    }}
                  >
                    {dayLabel}
                  </span>
                  {isToday && (
                    <span
                      className="font-mono"
                      style={{
                        display: 'block',
                        fontSize: 10,
                        color: 'var(--accent)',
                        marginTop: 1
                      }}
                    >
                      Hoje
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Grids Inferiores: Ranking e Telemetria */}
      <div className="grid-2">
        {/* Ranking de Conteúdo */}
        <div className="table-card">
          <div className="card-header">
            <div>
              <h2 className="card-title">Mídias Mais Exibidas</h2>
              <p className="card-subtitle">
                Classificação por frequência de reprodução nos terminais
              </p>
            </div>
            <span className="badge badge-neutral">Top {Math.min(ranking.length, 8)}</span>
          </div>

          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Mídia</th>
                  <th style={{ textAlign: 'right' }}>Exibições</th>
                  <th style={{ width: 140 }}>Participação</th>
                  <th style={{ textAlign: 'right' }}>Última exibição</th>
                </tr>
              </thead>
              <tbody>
                {ranking.slice(0, 8).map((item, index) => {
                  const proportion = Math.round((item.total_plays / topMediaMax) * 100);
                  return (
                    <tr key={index}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span className={`rank-badge ${index === 0 ? 'top' : ''}`}>
                            {index + 1}
                          </span>
                          <span className="cell-primary">{item.name}</span>
                        </div>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <span className="font-mono" style={{ fontWeight: 500 }}>
                          {item.total_plays.toLocaleString('pt-BR')}
                        </span>
                      </td>
                      <td>
                        <div className="progress-bar">
                          <div
                            className={`progress-fill ${index === 0 ? 'accent' : ''}`}
                            style={{ width: `${proportion}%` }}
                          />
                        </div>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <span className="font-mono text-muted">
                          {new Date(item.last_played_at).toLocaleTimeString('pt-BR')}
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {ranking.length === 0 && !loading && (
                  <tr>
                    <td colSpan={4}>
                      <div className="empty-state" style={{ padding: '36px 16px' }}>
                        <span className="empty-state-desc">
                          Nenhum evento de reprodução registrado até o momento.
                        </span>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Telemetria Lateral */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="card-header">
            <div>
              <h3 className="card-title">Telemetria da Rede</h3>
              <p className="card-subtitle">Diagnóstico de sincronização</p>
            </div>
            <Radio size={15} style={{ color: 'var(--text-tertiary)' }} />
          </div>

          <div
            className="card-body"
            style={{ display: 'flex', flexDirection: 'column', gap: 14, flex: 1 }}
          >
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
                paddingBottom: 14,
                borderBottom: '1px solid var(--border-subtle)'
              }}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted">Terminais cadastrados</span>
                <span className="font-mono">{filteredStats.total}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted">Status Online</span>
                <span className="font-mono" style={{ color: 'var(--success)' }}>
                  {filteredStats.online}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted">Heartbeat ativo (&lt; 3 min)</span>
                <span className="font-mono">{filteredStats.activeNow}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted">Eventos nesta sessão</span>
                <span className="font-mono">+{newPlaysCount}</span>
              </div>
            </div>

            <div
              style={{
                padding: '12px 14px',
                background: 'var(--bg-surface-sub)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--r-md)'
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 7,
                  marginBottom: 4,
                  fontSize: 12.5,
                  fontWeight: 500,
                  color: 'var(--text-primary)'
                }}
              >
                <Activity size={13} style={{ color: 'var(--text-secondary)' }} />
                <span>Critério de Heartbeat</span>
              </div>
              <p style={{ fontSize: 12, color: 'var(--text-tertiary)', lineHeight: 1.5 }}>
                Os players emitem telemetria a cada início de mídia. Terminais sem sinal
                por mais de 3 minutos deixam a contagem de ativos imediatos.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
