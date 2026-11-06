import { useEffect, useState, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import {
  Check,
  X,
  Clock,
  CheckCircle2,
  XCircle,
  RefreshCw,
  ShieldCheck,
  Search,
  ExternalLink,
  Film,
  Image as ImageIcon
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface MediaApprovalItem {
  id: string;
  name: string;
  url?: string;
  publicUrl?: string;
  file_path?: string;
  file_type?: string;
  type?: string;
  status: string;
  created_at: string;
  partner_id?: string;
  advertiser_id?: string;
}

interface PartnerOption {
  id: string;
  name: string;
}

interface AdvertiserOption {
  id: string;
  company_name: string;
}

export default function MediaApproval() {
  const [mediaList, setMediaList] = useState<MediaApprovalItem[]>([]);
  const [partners, setPartners] = useState<PartnerOption[]>([]);
  const [advertisers, setAdvertisers] = useState<AdvertiserOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'pending' | 'approved' | 'rejected'>('pending');
  const [searchTerm, setSearchTerm] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadData = async (showRefresh = false) => {
    if (showRefresh) setIsRefreshing(true);
    else setLoading(true);

    try {
      const [{ data: partnersData }, { data: advData }] = await Promise.all([
        supabase.from('partners').select('*'),
        supabase.from('advertisers').select('id, company_name')
      ]);

      if (partnersData) {
        setPartners(
          partnersData.map((p: any) => ({
            id: p.id,
            name: p.establishment_name || p.name || 'Parceiro'
          }))
        );
      }
      if (advData) setAdvertisers(advData);

      const { data, error } = await supabase
        .from('media_files')
        .select('*')
        .order('created_at', { ascending: false });

      if (data && !error) {
        const itemsWithFilePath = data.filter((i: any) => i.file_path);
        const paths = itemsWithFilePath.map((item: any) => item.file_path);

        const signedUrlsMap: Record<string, string> = {};
        if (paths.length > 0) {
          const { data: signedUrlsData } = await supabase.storage.from('media').createSignedUrls(paths, 86400);
          if (signedUrlsData) {
            signedUrlsData.forEach((s: any, idx: number) => {
              const p = s.path || paths[idx];
              if (p && s.signedUrl) {
                signedUrlsMap[p] = s.signedUrl;
              }
            });
          }
        }

        const enhanced = data.map((item: any) => {
          const { data: publicUrlData } = supabase.storage.from('media').getPublicUrl(item.file_path || '');
          const finalUrl = item.url || (item.file_path ? signedUrlsMap[item.file_path] : null) || publicUrlData.publicUrl;
          return { ...item, publicUrl: finalUrl };
        });
        setMediaList(enhanced);
      }
    } catch (err) {
      console.error('Erro ao carregar aprovações:', err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const partnerMap = useMemo(() => {
    const map = new Map<string, string>();
    partners.forEach(p => map.set(p.id, p.name));
    return map;
  }, [partners]);

  const advertiserMap = useMemo(() => {
    const map = new Map<string, string>();
    advertisers.forEach(a => map.set(a.id, a.company_name));
    return map;
  }, [advertisers]);

  const handleApprove = async (id: string) => {
    const { error } = await supabase.from('media_files').update({ status: 'approved' }).eq('id', id);
    if (!error) {
      setMediaList(prev => prev.map(m => (m.id === id ? { ...m, status: 'approved' } : m)));
    } else {
      alert('Erro ao aprovar mídia.');
    }
  };

  const handleReject = async (id: string) => {
    const { error } = await supabase.from('media_files').update({ status: 'rejected' }).eq('id', id);
    if (!error) {
      setMediaList(prev => prev.map(m => (m.id === id ? { ...m, status: 'rejected' } : m)));
    } else {
      alert('Erro ao rejeitar mídia.');
    }
  };

  const pendingCount = mediaList.filter(m => m.status === 'pending').length;
  const approvedCount = mediaList.filter(m => m.status === 'approved').length;
  const rejectedCount = mediaList.filter(m => m.status === 'rejected').length;

  const filteredItems = useMemo(() => {
    return mediaList.filter(item => {
      if (item.status !== activeTab) return false;
      if (searchTerm.trim() !== '') {
        const q = searchTerm.toLowerCase();
        const nameMatch = item.name?.toLowerCase().includes(q);
        const advName = item.advertiser_id ? advertiserMap.get(item.advertiser_id)?.toLowerCase() || '' : '';
        const partnerName = item.partner_id ? partnerMap.get(item.partner_id)?.toLowerCase() || '' : '';
        return nameMatch || advName.includes(q) || partnerName.includes(q);
      }
      return true;
    });
  }, [mediaList, activeTab, searchTerm, advertiserMap, partnerMap]);

  return (
    <div className="page-shell fade-up">
      <div className="page-header">
        <div className="page-title-group">
          <div className="page-title-row">
            <h1 className="page-title">Aprovação de Mídias</h1>
            {pendingCount > 0 && (
              <span className="badge badge-warning">
                <span className="status-dot warning" />
                {pendingCount} pendente{pendingCount > 1 ? 's' : ''}
              </span>
            )}
          </div>
          <p className="page-subtitle">
            Modere conteúdos e criativos enviados por anunciantes e parceiros antes da exibição nos terminais.
          </p>
        </div>

        <div className="page-actions">
          <button
            type="button"
            onClick={() => loadData(true)}
            className="btn btn-secondary"
            disabled={isRefreshing}
          >
            <RefreshCw size={14} className={isRefreshing ? 'spin' : ''} />
            <span>Atualizar</span>
          </button>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-label">Aguardando Revisão</span>
            <span className="kpi-icon"><Clock size={15} /></span>
          </div>
          <div className="kpi-value">{pendingCount}</div>
          <div className="kpi-meta">
            <span className={`status-dot ${pendingCount > 0 ? 'warning' : 'neutral'}`} />
            <span>{pendingCount > 0 ? 'Requerem validação manual' : 'Fila de revisão zerada'}</span>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-label">Mídias Aprovadas</span>
            <span className="kpi-icon"><CheckCircle2 size={15} /></span>
          </div>
          <div className="kpi-value">{approvedCount}</div>
          <div className="kpi-meta">
            <span className="status-dot online" />
            <span>Aptas para veiculação em grade</span>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-label">Mídias Rejeitadas</span>
            <span className="kpi-icon"><XCircle size={15} /></span>
          </div>
          <div className="kpi-value">{rejectedCount}</div>
          <div className="kpi-meta">
            <span>Bloqueadas na moderação</span>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="toolbar">
        <div className="toolbar-left">
          <div className="segmented-control">
            <button
              type="button"
              className={`seg-btn ${activeTab === 'pending' ? 'active' : ''}`}
              onClick={() => setActiveTab('pending')}
            >
              <span>Pendentes</span>
              <span className="seg-count">{pendingCount}</span>
            </button>
            <button
              type="button"
              className={`seg-btn ${activeTab === 'approved' ? 'active' : ''}`}
              onClick={() => setActiveTab('approved')}
            >
              <span>Aprovadas</span>
              <span className="seg-count">{approvedCount}</span>
            </button>
            <button
              type="button"
              className={`seg-btn ${activeTab === 'rejected' ? 'active' : ''}`}
              onClick={() => setActiveTab('rejected')}
            >
              <span>Rejeitadas</span>
              <span className="seg-count">{rejectedCount}</span>
            </button>
          </div>
        </div>

        <div className="toolbar-right">
          <div className="search-field">
            <Search size={14} className="search-field-icon" />
            <input
              type="text"
              placeholder="Buscar por arquivo, anunciante ou parceiro..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button
                type="button"
                className="search-field-clear"
                onClick={() => setSearchTerm('')}
                aria-label="Limpar busca"
              >
                <X size={13} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="loading-state">
          <div className="loader" />
          <span>Carregando fila de moderação...</span>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="card empty-state">
          <div className="empty-state-icon">
            <ShieldCheck size={18} />
          </div>
          <div className="empty-state-title">
            {activeTab === 'pending'
              ? 'Nenhuma mídia aguardando revisão'
              : 'Nenhum item encontrado'}
          </div>
          <div className="empty-state-desc">
            {activeTab === 'pending'
              ? 'Todos os criativos submetidos pelos anunciantes e parceiros já foram revisados.'
              : 'Altere o status selecionado ou limpe o termo de busca.'}
          </div>
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(310px, 1fr))',
            gap: '14px'
          }}
        >
          {filteredItems.map(item => {
            const isVideo =
              item.file_type?.includes('video') ||
              item.type === 'video' ||
              item.name?.toLowerCase().endsWith('.mp4');
            const advName = item.advertiser_id ? advertiserMap.get(item.advertiser_id) : undefined;
            const partnerName = item.partner_id ? partnerMap.get(item.partner_id) : undefined;
            const extLabel = isVideo ? 'MP4' : (item.name?.split('.').pop() || 'IMG').toUpperCase().slice(0, 4);

            return (
              <div
                key={item.id}
                className="card card-interactive"
                style={{
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                  borderColor: item.status === 'pending' ? 'var(--warning-border)' : undefined
                }}
              >
                {/* 16:9 Media Stage */}
                <div
                  style={{
                    aspectRatio: '16 / 9',
                    background: '#050507',
                    borderBottom: '1px solid var(--border-subtle)',
                    position: 'relative',
                    overflow: 'hidden',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  {isVideo ? (
                    <video
                      src={`${item.publicUrl}#t=0.1`}
                      preload="auto"
                      muted
                      playsInline
                      crossOrigin="anonymous"
                      controls
                      onLoadedMetadata={(e) => {
                        try {
                          e.currentTarget.currentTime = 0.1;
                        } catch {}
                      }}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  ) : (
                    <img
                      src={item.publicUrl}
                      alt={item.name}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  )}

                  {/* Origin Tag */}
                  <div style={{ position: 'absolute', top: '10px', left: '10px', pointerEvents: 'none' }}>
                    {advName ? (
                      <span
                        className="badge badge-info"
                        style={{ background: 'rgba(9, 9, 11, 0.82)', backdropFilter: 'blur(6px)' }}
                      >
                        Anunciante: {advName}
                      </span>
                    ) : partnerName ? (
                      <span
                        className="badge badge-success"
                        style={{ background: 'rgba(9, 9, 11, 0.82)', backdropFilter: 'blur(6px)' }}
                      >
                        Parceiro: {partnerName}
                      </span>
                    ) : (
                      <span
                        className="badge badge-neutral"
                        style={{ background: 'rgba(9, 9, 11, 0.82)', backdropFilter: 'blur(6px)' }}
                      >
                        Acervo Geral
                      </span>
                    )}
                  </div>

                  {/* Format + Open External */}
                  <div style={{ position: 'absolute', top: '10px', right: '10px', display: 'flex', gap: '6px' }}>
                    <span
                      className="badge badge-neutral"
                      style={{
                        background: 'rgba(9, 9, 11, 0.82)',
                        backdropFilter: 'blur(6px)',
                        fontFamily: 'var(--font-mono)',
                        fontSize: '10.5px'
                      }}
                    >
                      {isVideo ? <Film size={11} /> : <ImageIcon size={11} />}
                      {extLabel}
                    </span>
                    {item.publicUrl && (
                      <a
                        href={item.publicUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="icon-btn"
                        title="Abrir arquivo original"
                        style={{
                          width: '22px',
                          height: '22px',
                          background: 'rgba(9, 9, 11, 0.82)',
                          border: '1px solid var(--border-default)',
                          color: 'var(--text-secondary)'
                        }}
                      >
                        <ExternalLink size={11} />
                      </a>
                    )}
                  </div>
                </div>

                {/* Details */}
                <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '12px', flex: 1 }}>
                  <div>
                    <div
                      className="cell-primary"
                      title={item.name}
                      style={{
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        fontSize: '13.5px'
                      }}
                    >
                      {item.name}
                    </div>
                    <div className="cell-secondary" style={{ marginTop: '3px' }}>
                      Enviado em {new Date(item.created_at).toLocaleDateString('pt-BR')} ·{' '}
                      {formatDistanceToNow(new Date(item.created_at), { addSuffix: true, locale: ptBR })}
                    </div>
                  </div>

                  <div style={{ marginTop: 'auto', paddingTop: '10px', borderTop: '1px solid var(--border-subtle)' }}>
                    {item.status === 'pending' ? (
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          type="button"
                          className="btn btn-danger"
                          style={{ flex: 1 }}
                          onClick={() => handleReject(item.id)}
                        >
                          <X size={14} />
                          <span>Rejeitar</span>
                        </button>
                        <button
                          type="button"
                          className="btn btn-primary"
                          style={{ flex: 1 }}
                          onClick={() => handleApprove(item.id)}
                        >
                          <Check size={14} />
                          <span>Aprovar</span>
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                        {item.status === 'approved' ? (
                          <span className="badge badge-success">
                            <span className="status-dot online" />
                            Aprovada
                          </span>
                        ) : (
                          <span className="badge badge-danger">
                            <span className="status-dot offline" />
                            Rejeitada
                          </span>
                        )}

                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() =>
                            item.status === 'approved' ? handleReject(item.id) : handleApprove(item.id)
                          }
                        >
                          {item.status === 'approved' ? 'Rejeitar' : 'Aprovar'}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
