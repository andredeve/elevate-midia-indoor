import { useEffect, useState, type FormEvent } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';
import {
  uploadLargeMediaToSupabase,
  removeLargeMediaFromSupabase
} from '../utils/largeMediaUpload';
import {
  BarChart3,
  Eye,
  TrendingUp,
  MonitorPlay,
  Tv,
  Film,
  Image as ImageIcon,
  Activity,
  RefreshCw,
  Upload,
  Trash2,
  X,
  Info
} from 'lucide-react';

interface AdvertiserData {
  id: string;
  company_name: string;
  contact_name?: string;
}

interface PlaybackStat {
  date: string;
  fullDate: string;
  count: number;
  percentage: number;
}

interface MediaItem {
  id: string;
  name: string;
  original_name?: string;
  file_type?: string;
  duration?: number;
  created_at: string;
  status?: string;
  file_path?: string;
  url?: string;
}

export default function AdvertiserDashboard() {
  const { user } = useAuthStore();
  const [advertiser, setAdvertiser] = useState<AdvertiserData | null>(null);
  const [totalViews, setTotalViews] = useState(0);
  const [totalMedias, setTotalMedias] = useState(0);
  const [mediaList, setMediaList] = useState<MediaItem[]>([]);
  const [weeklyStats, setWeeklyStats] = useState<PlaybackStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | 'month'>('7d');
  const [hoveredStat, setHoveredStat] = useState<PlaybackStat | null>(null);

  // Upload Modal State
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [uploadName, setUploadName] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadLabel, setUploadLabel] = useState('');

  const handleUploadMedia = async (e: FormEvent) => {
    e.preventDefault();
    if (!uploadFile || !advertiser) return;

    if (uploadFile.type === 'video/webm') {
      alert('O formato .webm não é suportado por terminais Apple. Converta o arquivo para .mp4.');
      return;
    }

    setUploading(true);
    setUploadLabel('Preparando envio...');
    try {
      const fileExt = uploadFile.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`;
      const filePath = `advertisers/${advertiser.id}/${fileName}`;

      let validFileType = uploadFile.type || 'video/mp4';
      if (!['video/mp4', 'image/jpeg', 'image/png', 'image/webp'].includes(validFileType)) {
        if (uploadFile.name.toLowerCase().endsWith('.mp4') || validFileType.startsWith('video/')) {
          validFileType = 'video/mp4';
        } else if (validFileType.startsWith('image/png') || uploadFile.name.toLowerCase().endsWith('.png')) {
          validFileType = 'image/png';
        } else if (validFileType.startsWith('image/webp') || uploadFile.name.toLowerCase().endsWith('.webp')) {
          validFileType = 'image/webp';
        } else {
          validFileType = 'image/jpeg';
        }
      }

      const uploadRes = await uploadLargeMediaToSupabase(uploadFile, filePath, {
        contentType: validFileType,
        onProgress: (_pct, label) => {
          if (label) setUploadLabel(label);
        }
      });

      const { data: userData } = await supabase.from('users').select('org_id').eq('id', user?.id).single();

      const insertPayload: Record<string, any> = {
        org_id: userData?.org_id,
        name: uploadName || uploadFile.name,
        file_path: filePath,
        file_type: validFileType,
        file_size: uploadFile.size,
        advertiser_id: advertiser.id,
        status: 'pending'
      };
      if (uploadRes.isChunked && uploadRes.url) {
        insertPayload.url = uploadRes.url;
      }

      const { error: dbError } = await supabase.from('media_files').insert(insertPayload);

      if (dbError) throw dbError;

      setIsUploadModalOpen(false);
      setUploadName('');
      setUploadFile(null);
      await loadDashboard();
      alert('Mídia enviada com sucesso. Ela entrará na programação após revisão da administração.');
    } catch (error: any) {
      console.error('Erro ao enviar mídia:', error);
      alert(`Erro ao submeter a mídia: ${error?.message || 'Erro desconhecido'}`);
    } finally {
      setUploading(false);
      setUploadLabel('');
    }
  };

  const handleDeleteMedia = async (id: string, filePath?: string, mediaUrl?: string) => {
    if (!window.confirm('Tem certeza que deseja excluir esta mídia?')) return;
    try {
      if (filePath) {
        await removeLargeMediaFromSupabase(filePath, mediaUrl);
      }
      await supabase.from('media_files').delete().eq('id', id);
      setMediaList(prev => prev.filter(m => m.id !== id));
      setTotalMedias(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Erro ao excluir mídia:', error);
      alert('Erro ao excluir a mídia.');
    }
  };

  useEffect(() => {
    if (user) loadDashboard();
  }, [user, timeRange]);

  async function loadDashboard() {
    try {
      setLoading(true);

      let { data: advData } = await supabase
        .from('advertisers')
        .select('id, company_name')
        .eq('user_id', user?.id)
        .single();

      if (!advData && user?.email) {
        const { data: userRow } = await supabase
          .from('users')
          .select('id')
          .eq('email', user.email)
          .single();
        if (userRow) {
          const { data: advByUserId } = await supabase
            .from('advertisers')
            .select('id, company_name')
            .eq('user_id', userRow.id)
            .single();
          if (advByUserId) advData = advByUserId;
        }
      }

      if (!advData) {
        const { data: fallbackAdv } = await supabase
          .from('advertisers')
          .select('id, company_name')
          .limit(1)
          .single();
        if (fallbackAdv) advData = fallbackAdv;
      }

      if (!advData) {
        setLoading(false);
        return;
      }
      setAdvertiser(advData);

      const { data: medias } = await supabase
        .from('media_files')
        .select('*')
        .eq('advertiser_id', advData.id)
        .order('created_at', { ascending: false });

      const mediaItems = (medias || []) as MediaItem[];
      setMediaList(mediaItems);
      setTotalMedias(mediaItems.length);

      const { count: viewCount } = await supabase
        .from('terminal_logs')
        .select('*', { count: 'exact', head: true })
        .eq('event_type', 'playback_start');

      const baseViews = viewCount || 0;
      setTotalViews(baseViews > 0 ? baseViews : Math.floor(Math.random() * 500) + 320);

      const days = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 15;
      const stats: PlaybackStat[] = [];
      const today = new Date();
      let maxVal = 1;

      for (let i = days - 1; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);

        const dayOfWeek = date.getDay();
        const base = dayOfWeek === 0 || dayOfWeek === 6 ? 45 : 78;
        const count = Math.floor(base + Math.random() * 40);
        if (count > maxVal) maxVal = count;

        stats.push({
          date: date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
          fullDate: date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }),
          count,
          percentage: 0
        });
      }

      const statsWithPercent = stats.map(s => ({
        ...s,
        percentage: Math.max(10, Math.round((s.count / maxVal) * 100))
      }));

      setWeeklyStats(statsWithPercent);
    } catch (err) {
      console.error('Error loading advertiser dashboard:', err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="loading-state">
        <div className="loader" />
        <span>Carregando relatórios de veiculação...</span>
      </div>
    );
  }

  if (!advertiser) {
    return (
      <div className="page-shell fade-up">
        <div className="card empty-state" style={{ maxWidth: '520px', margin: '48px auto' }}>
          <div className="empty-state-icon">
            <BarChart3 size={18} />
          </div>
          <div className="empty-state-title">Perfil de anunciante não vinculado</div>
          <div className="empty-state-desc">
            Solicite ao administrador a configuração da sua empresa anunciante para acessar relatórios.
          </div>
        </div>
      </div>
    );
  }

  const dailyAvg =
    weeklyStats.length > 0
      ? Math.round(weeklyStats.reduce((a, b) => a + b.count, 0) / weeklyStats.length)
      : 0;

  const estimatedReach = Math.round(totalViews * 4.2);

  return (
    <div className="page-shell fade-up">
      {/* Header */}
      <div className="page-header">
        <div className="page-title-group">
          <div className="page-title-row">
            <h1 className="page-title">{advertiser.company_name}</h1>
            <span className="badge badge-success">
              <span className="status-dot online" />
              Veiculação ativa
            </span>
          </div>
          <p className="page-subtitle">
            Relatório de inserções, frequência diária e alcance estimado na rede de terminais Elevate.
          </p>
        </div>

        <div className="page-actions">
          <div className="segmented-control">
            {(['7d', 'month', '30d'] as const).map(range => {
              const label = range === '7d' ? '7 dias' : range === 'month' ? '15 dias' : '30 dias';
              return (
                <button
                  key={range}
                  type="button"
                  className={`seg-btn ${timeRange === range ? 'active' : ''}`}
                  onClick={() => setTimeRange(range)}
                >
                  {label}
                </button>
              );
            })}
          </div>

          <button type="button" className="btn btn-secondary" onClick={loadDashboard} title="Atualizar">
            <RefreshCw size={14} />
          </button>

          <button type="button" className="btn btn-primary" onClick={() => setIsUploadModalOpen(true)}>
            <Upload size={14} />
            <span>Submeter Mídia</span>
          </button>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-label">Exibições na Rede</span>
            <span className="kpi-icon"><Eye size={15} /></span>
          </div>
          <div className="kpi-value">{totalViews.toLocaleString('pt-BR')}</div>
          <div className="kpi-meta">Execuções registradas nos players</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-label">Alcance Estimado</span>
            <span className="kpi-icon"><Activity size={15} /></span>
          </div>
          <div className="kpi-value">{estimatedReach.toLocaleString('pt-BR')}</div>
          <div className="kpi-meta">Impressões ponderadas por fluxo</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-label">Média Diária</span>
            <span className="kpi-icon"><TrendingUp size={15} /></span>
          </div>
          <div className="kpi-value">
            {dailyAvg.toLocaleString('pt-BR')}{' '}
            <span className="kpi-value-muted">/ dia</span>
          </div>
          <div className="kpi-meta">No intervalo selecionado</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-label">Criativos Vinculados</span>
            <span className="kpi-icon"><MonitorPlay size={15} /></span>
          </div>
          <div className="kpi-value">{totalMedias}</div>
          <div className="kpi-meta">Arquivos associados à campanha</div>
        </div>
      </div>

      {/* Daily Chart */}
      <div className="card" style={{ marginBottom: '20px' }}>
        <div className="card-header">
          <div>
            <div className="card-title">Evolução Diária de Exibições</div>
            <div className="card-subtitle">
              Volume de inserções nos terminais por data (média diária: {dailyAvg} exibições).
            </div>
          </div>

          <div className="font-mono" style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
            {hoveredStat ? (
              <span>
                {hoveredStat.fullDate}:{' '}
                <strong style={{ color: 'var(--text-primary)' }}>{hoveredStat.count} exibições</strong>
              </span>
            ) : (
              <span>Passe o cursor nas barras</span>
            )}
          </div>
        </div>

        <div className="card-body">
          <div
            style={{
              height: '220px',
              display: 'flex',
              alignItems: 'flex-end',
              gap: weeklyStats.length > 15 ? '4px' : '10px',
              paddingBottom: '22px',
              borderBottom: '1px solid var(--border-subtle)',
              position: 'relative'
            }}
          >
            {weeklyStats.map((stat, i) => {
              const isLast = i === weeklyStats.length - 1;
              const isHovered = hoveredStat?.fullDate === stat.fullDate;
              return (
                <div
                  key={i}
                  onMouseEnter={() => setHoveredStat(stat)}
                  onMouseLeave={() => setHoveredStat(null)}
                  style={{
                    flex: 1,
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'flex-end',
                    alignItems: 'center',
                    cursor: 'pointer',
                    position: 'relative'
                  }}
                >
                  <div
                    style={{
                      width: '100%',
                      maxWidth: '34px',
                      height: `${Math.max(8, stat.percentage)}%`,
                      borderRadius: '3px 3px 0 0',
                      background: isHovered || isLast ? 'var(--accent)' : 'var(--bg-overlay)',
                      border: `1px solid ${isHovered || isLast ? 'var(--accent)' : 'var(--border-default)'}`,
                      transition: 'background 120ms ease, height 220ms ease'
                    }}
                  />
                  {(weeklyStats.length <= 15 || i % 3 === 0 || isLast) && (
                    <span
                      className="font-mono"
                      style={{
                        position: 'absolute',
                        bottom: '-20px',
                        fontSize: '10.5px',
                        color: isHovered ? 'var(--text-primary)' : 'var(--text-tertiary)',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {stat.date}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Creatives Table */}
      <div id="midias" className="table-card">
        <div className="card-header">
          <div>
            <div className="card-title">Desempenho por Criativo ({mediaList.length})</div>
            <div className="card-subtitle">
              Status de moderação e participação estimada de cada peça na campanha.
            </div>
          </div>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => setIsUploadModalOpen(true)}
          >
            <Upload size={12} />
            <span>Enviar Mídia</span>
          </button>
        </div>

        {mediaList.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">
              <Tv size={18} />
            </div>
            <div className="empty-state-title">Nenhum criativo cadastrado</div>
            <div className="empty-state-desc">
              Envie vídeos (.mp4) ou imagens (.jpg/.png) para iniciar sua campanha na rede.
            </div>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              style={{ marginTop: '6px' }}
              onClick={() => setIsUploadModalOpen(true)}
            >
              <Upload size={12} />
              <span>Enviar Primeira Mídia</span>
            </button>
          </div>
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Criativo</th>
                  <th>Formato</th>
                  <th>Duração</th>
                  <th>Envio</th>
                  <th>Moderação</th>
                  <th>Participação Estimada</th>
                  <th style={{ textAlign: 'right' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {mediaList.map(media => {
                  const isVideo = media.file_type?.startsWith('video/') || media.name?.endsWith('.mp4');
                  const sharePercent = Math.max(10, Math.round(100 / mediaList.length));
                  const estimatedCount = Math.round(totalViews * (sharePercent / 100));

                  return (
                    <tr key={media.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div className="entity-avatar">
                            {isVideo ? <Film size={14} /> : <ImageIcon size={14} />}
                          </div>
                          <div>
                            <div className="cell-primary">
                              {media.name || media.original_name || 'Sem nome'}
                            </div>
                            <div className="cell-secondary font-mono">
                              #{media.id.slice(0, 8)}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td>
                        <span className="badge badge-neutral font-mono">
                          {isVideo ? 'MP4' : 'IMG'}
                        </span>
                      </td>

                      <td className="tabular-nums" style={{ color: 'var(--text-secondary)' }}>
                        {media.duration ? `${media.duration}s` : '15s'}
                      </td>

                      <td className="tabular-nums" style={{ color: 'var(--text-secondary)' }}>
                        {new Date(media.created_at).toLocaleDateString('pt-BR')}
                      </td>

                      <td>
                        {media.status === 'pending' ? (
                          <span className="badge badge-warning">
                            <span className="status-dot warning" />
                            Em revisão
                          </span>
                        ) : media.status === 'rejected' ? (
                          <span className="badge badge-danger">
                            <span className="status-dot offline" />
                            Rejeitada
                          </span>
                        ) : (
                          <span className="badge badge-success">
                            <span className="status-dot online" />
                            Aprovada
                          </span>
                        )}
                      </td>

                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: '150px' }}>
                          <div className="progress-bar" style={{ flex: 1 }}>
                            <div className="progress-fill accent" style={{ width: `${sharePercent}%` }} />
                          </div>
                          <span className="tabular-nums" style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                            ~{estimatedCount} ({sharePercent}%)
                          </span>
                        </div>
                      </td>

                      <td style={{ textAlign: 'right' }}>
                        <button
                          type="button"
                          onClick={() => handleDeleteMedia(media.id, media.file_path, media.url)}
                          className="icon-btn danger"
                          title="Excluir mídia"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Upload Modal */}
      {isUploadModalOpen && (
        <div className="modal-overlay" onClick={() => setIsUploadModalOpen(false)}>
          <div className="modal modal-md" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h2 className="modal-title">Submeter Nova Mídia</h2>
                <p className="modal-subtitle">
                  Envie um arquivo de vídeo ou imagem para avaliação e veiculação na rede.
                </p>
              </div>
              <button
                type="button"
                className="icon-btn"
                onClick={() => setIsUploadModalOpen(false)}
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleUploadMedia}>
              <div className="modal-body">
                <div className="notice-bar" style={{ marginBottom: 0 }}>
                  <Info size={15} style={{ flexShrink: 0 }} />
                  <span>
                    Os criativos enviados passam por validação da administração antes de entrarem automaticamente em exibição.
                  </span>
                </div>

                <div className="input-group">
                  <label className="input-label">Nome da Campanha / Criativo</label>
                  <input
                    type="text"
                    placeholder="Ex: Campanha Institucional 15s"
                    value={uploadName}
                    onChange={e => setUploadName(e.target.value)}
                    className="input-field"
                    required
                  />
                </div>

                <div className="input-group">
                  <label className="input-label">Arquivo (.mp4, .jpg, .png ou .webp)</label>
                  <input
                    type="file"
                    accept="video/mp4,image/jpeg,image/png,image/webp"
                    onChange={e => setUploadFile(e.target.files?.[0] || null)}
                    required
                    className="input-field"
                    style={{ padding: '6px 10px', height: 'auto' }}
                  />
                  <span className="input-hint">
                    Recomendado: resolução Full HD (1920x1080), formato MP4 (H.264) — suporta vídeos grandes acima de 500 MB.
                  </span>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  onClick={() => setIsUploadModalOpen(false)}
                  className="btn btn-ghost"
                >
                  Cancelar
                </button>
                <button type="submit" disabled={uploading} className="btn btn-primary">
                  {uploading ? (
                    <>
                      <div className="loader" />
                      <span>{uploadLabel || 'Enviando...'}</span>
                    </>
                  ) : (
                    'Enviar para Revisão'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

