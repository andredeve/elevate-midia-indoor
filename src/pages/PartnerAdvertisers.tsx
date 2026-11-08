import { useEffect, useState, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';
import {
  Briefcase,
  Search,
  Copy,
  Check,
  Film,
  Image as ImageIcon,
  Calendar,
  Percent,
  RefreshCw,
  ShieldCheck,
  TrendingUp,
  UserCheck
} from 'lucide-react';

interface PartnerData {
  id: string;
  establishment_name: string;
  commission_rate: number;
  referral_code: string;
  category?: string;
  city?: string;
  state?: string;
}

interface ReferredAdvertiser {
  id: string;
  company_name: string;
  created_at: string;
  user_id: string;
  partner_id: string;
  media_count?: number;
  active_media_count?: number;
}

interface MediaItem {
  id: string;
  advertiser_id: string;
  name: string;
  file_type?: string;
  status?: string;
  created_at?: string;
}

export default function PartnerAdvertisers() {
  const { user } = useAuthStore();
  const [partner, setPartner] = useState<PartnerData | null>(null);
  const [advertisers, setAdvertisers] = useState<ReferredAdvertiser[]>([]);
  const [medias, setMedias] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAdvForMedias, setSelectedAdvForMedias] = useState<ReferredAdvertiser | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);

  useEffect(() => {
    if (user) {
      loadPartnerAndAdvertisers();
    }
  }, [user]);

  async function loadPartnerAndAdvertisers(isRefresh = false) {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      // 1. Carrega dados do parceiro logado
      let { data: partnerData } = await supabase
        .from('partners')
        .select('*')
        .eq('user_id', user?.id)
        .single();

      if (!partnerData) {
        const { data: fallbackPartners } = await supabase
          .from('partners')
          .select('*')
          .limit(1);
        partnerData = fallbackPartners?.[0] || null;
      }

      if (!partnerData) throw new Error('Parceiro não encontrado');
      setPartner(partnerData);

      // 2. Carrega anunciantes vinculados ao parceiro
      const { data: advData, error: advError } = await supabase
        .from('advertisers')
        .select('*')
        .eq('partner_id', partnerData.id)
        .order('created_at', { ascending: false });

      if (advError) throw advError;

      const advList = advData || [];

      // 3. Carrega mídias associadas aos anunciantes desse parceiro
      if (advList.length > 0) {
        const advIds = advList.map((a: any) => a.id);
        const { data: mediaData } = await supabase
          .from('media_files')
          .select('id, advertiser_id, name, file_type, status, created_at')
          .in('advertiser_id', advIds);

        const allMedias: MediaItem[] = (mediaData as MediaItem[]) || [];
        setMedias(allMedias);

        // Agrupa contadores por anunciante
        const countMap: Record<string, { total: number; approved: number }> = {};
        allMedias.forEach((m: MediaItem) => {
          if (!countMap[m.advertiser_id]) {
            countMap[m.advertiser_id] = { total: 0, approved: 0 };
          }
          countMap[m.advertiser_id].total += 1;
          if (m.status === 'approved') {
            countMap[m.advertiser_id].approved += 1;
          }
        });

        const enriched: ReferredAdvertiser[] = advList.map((a: any) => ({
          ...a,
          media_count: countMap[a.id]?.total || 0,
          active_media_count: countMap[a.id]?.approved || 0
        }));

        setAdvertisers(enriched);
      } else {
        setAdvertisers([]);
        setMedias([]);
      }
    } catch (err) {
      console.error('Erro ao carregar anunciantes indicados:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  const copyCode = () => {
    if (partner?.referral_code) {
      navigator.clipboard.writeText(partner.referral_code);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  const filteredAdvertisers = useMemo(() => {
    if (!searchQuery.trim()) return advertisers;
    const q = searchQuery.toLowerCase();
    return advertisers.filter(a =>
      a.company_name?.toLowerCase().includes(q) ||
      a.id.toLowerCase().includes(q)
    );
  }, [advertisers, searchQuery]);

  const totalMediasCount = useMemo(() => {
    return advertisers.reduce((acc, a) => acc + (a.media_count || 0), 0);
  }, [advertisers]);

  const activeMediasCount = useMemo(() => {
    return advertisers.reduce((acc, a) => acc + (a.active_media_count || 0), 0);
  }, [advertisers]);

  const ratePct = partner
    ? partner.commission_rate <= 1
      ? Math.round(partner.commission_rate * 100)
      : Math.round(partner.commission_rate)
    : 10;

  if (loading) {
    return (
      <div className="loading-state">
        <div className="loader" />
        <span>Carregando anunciantes indicados...</span>
      </div>
    );
  }

  if (!partner) {
    return (
      <div className="page-shell fade-up">
        <div className="card empty-state" style={{ maxWidth: '520px', margin: '48px auto' }}>
          <div className="empty-state-title">Perfil não localizado</div>
          <div className="empty-state-desc">
            Sua conta de parceiro não foi encontrada. Entre em contato com o suporte da plataforma.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell fade-up">
      {/* Header */}
      <div className="page-header">
        <div className="page-title-group">
          <div className="page-title-row">
            <h1 className="page-title">Anunciantes Indicados</h1>
            <span className="badge badge-neutral">
              {advertisers.length} {advertisers.length === 1 ? 'anunciante' : 'anunciantes'}
            </span>
          </div>
          <p className="page-subtitle">
            Acompanhe empresas e marcas parceiras vinculadas ao seu código de indicação{' '}
            <strong style={{ color: 'var(--text-primary)' }}>{partner.referral_code}</strong>.
          </p>
        </div>

        <div className="page-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={copyCode}
            title="Copiar código de indicação"
          >
            <span style={{ color: 'var(--text-tertiary)', fontSize: '12px' }}>Código:</span>
            <span className="font-mono" style={{ fontWeight: 600 }}>
              {partner.referral_code}
            </span>
            {copiedCode ? (
              <Check size={13} style={{ color: 'var(--success)' }} />
            ) : (
              <Copy size={13} style={{ color: 'var(--text-tertiary)' }} />
            )}
          </button>

          <button
            type="button"
            className="icon-btn"
            onClick={() => loadPartnerAndAdvertisers(true)}
            disabled={refreshing}
            title="Atualizar lista"
          >
            <RefreshCw size={14} className={refreshing ? 'spin' : ''} />
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-label">Anunciantes Vinculados</span>
            <span className="kpi-icon"><Briefcase size={15} /></span>
          </div>
          <div className="kpi-value">{advertisers.length}</div>
          <div className="kpi-meta">
            <span className="status-dot online" />
            <span>Contas comerciais cadastradas</span>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-label">Campanhas em Exibição</span>
            <span className="kpi-icon"><Film size={15} /></span>
          </div>
          <div className="kpi-value">
            {activeMediasCount}{' '}
            <span className="kpi-value-muted">/ {totalMediasCount} mídias</span>
          </div>
          <div className="kpi-meta">Criativos veiculados na rede Elevate</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-label">Comissão por Indicação</span>
            <span className="kpi-icon"><Percent size={15} /></span>
          </div>
          <div className="kpi-value">{ratePct}%</div>
          <div className="kpi-meta">Repasse mensal sobre as faturas confirmadas</div>
        </div>
      </div>

      {/* Toolbar & Filter */}
      <div className="toolbar">
        <div className="search-field" style={{ maxWidth: '340px' }}>
          <Search size={14} className="search-field-icon" />
          <input
            type="text"
            placeholder="Buscar por razão social ou código..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>

        <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginLeft: 'auto' }}>
          Mostrando {filteredAdvertisers.length} de {advertisers.length}
        </div>
      </div>

      {/* Table Card */}
      <div className="card table-card partner-grid-card" style={{ maxWidth: '1100px', overflow: 'hidden' }}>
        {advertisers.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">
              <Briefcase size={20} />
            </div>
            <div className="empty-state-title">Nenhum anunciante indicado ainda</div>
            <div className="empty-state-desc">
              Compartilhe seu código de parceiro <strong style={{ color: 'var(--text-primary)' }}>{partner.referral_code}</strong> com comércios locais (nutricionistas, lojas, restaurantes) para que eles anunciem nas telas da sua unidade e você receba comissões recorrentes.
            </div>
          </div>
        ) : filteredAdvertisers.length === 0 ? (
          <div className="empty-state" style={{ padding: '36px 16px' }}>
            <div className="empty-state-title">Nenhum resultado encontrado</div>
            <div className="empty-state-desc">Nenhum anunciante corresponde à busca &quot;{searchQuery}&quot;.</div>
          </div>
        ) : (
          <div className="partner-table-wrap">
          <table className="data-table partner-table">
            <thead>
              <tr>
                <th>Empresa / Razão Social</th>
                <th>Status da Indicação</th>
                <th>Criativos Submetidos</th>
                <th>Data de Vínculo</th>
                <th style={{ textAlign: 'right' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {filteredAdvertisers.map(adv => {
                const dateStr = adv.created_at
                  ? new Date(adv.created_at).toLocaleDateString('pt-BR', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric'
                    })
                  : '—';

                return (
                  <tr key={adv.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div className="entity-avatar">
                          <Briefcase size={14} />
                        </div>
                        <div>
                          <div className="cell-primary">{adv.company_name}</div>
                          <div className="cell-secondary font-mono" style={{ fontSize: '11px' }}>
                            ID: {adv.id.slice(0, 8)}...
                          </div>
                        </div>
                      </div>
                    </td>

                    <td>
                      <span className="badge badge-success">
                        <UserCheck size={11} />
                        <span>Indicado Vinculado</span>
                      </span>
                    </td>

                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span className="badge badge-neutral">
                          <Film size={11} />
                          <span>{adv.media_count || 0} mídias</span>
                        </span>
                        {adv.active_media_count ? (
                          <span className="badge badge-info" title="Mídias ativas/aprovadas">
                            {adv.active_media_count} ativas
                          </span>
                        ) : null}
                      </div>
                    </td>

                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)' }}>
                        <Calendar size={13} style={{ color: 'var(--text-tertiary)' }} />
                        <span>{dateStr}</span>
                      </div>
                    </td>

                    <td style={{ textAlign: 'right' }}>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => setSelectedAdvForMedias(adv)}
                      >
                        <Film size={12} />
                        <span>Ver Criativos ({adv.media_count || 0})</span>
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

      {/* Info Callout */}
      <div className="card" style={{ marginTop: '20px', padding: '18px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
          <div className="entity-avatar" style={{ background: 'var(--accent-dim)', color: 'var(--accent)' }}>
            <TrendingUp size={16} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
              Como funciona o repasse de anunciantes indicados?
            </div>
            <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
              Sempre que uma empresa se cadastra com seu código <strong style={{ color: 'var(--text-primary)' }}>{partner.referral_code}</strong> ou é indicada por você, ela passa a fazer parte da sua rede. Sobre cada mensalidade paga pelo anunciante na plataforma, sua unidade recebe automaticamente o repasse de <strong>{ratePct}%</strong> recorrente contratado.
            </p>
          </div>
        </div>
      </div>

      {/* Modal: Criativos do Anunciante */}
      {selectedAdvForMedias && (() => {
        const advMedias = medias.filter(m => m.advertiser_id === selectedAdvForMedias.id);
        return (
          <div className="modal-overlay" onClick={() => setSelectedAdvForMedias(null)}>
            <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <div>
                  <h2 className="modal-title">
                    Criativos — {selectedAdvForMedias.company_name}
                  </h2>
                  <p className="modal-subtitle">
                    Mídias e campanhas cadastradas por este anunciante indicado.
                  </p>
                </div>
                <button
                  type="button"
                  className="icon-btn"
                  onClick={() => setSelectedAdvForMedias(null)}
                >
                  ✕
                </button>
              </div>

              <div className="modal-body">
                {advMedias.length === 0 ? (
                  <div className="empty-state" style={{ padding: '36px 16px' }}>
                    <div className="empty-state-icon">
                      <Film size={18} />
                    </div>
                    <div className="empty-state-title">Nenhum criativo cadastrado</div>
                    <div className="empty-state-desc">
                      Este anunciante ainda não realizou upload de vídeos ou imagens para veiculação.
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {advMedias.map(m => {
                      const isApproved = m.status === 'approved';
                      const isPending = m.status === 'pending';
                      const isVideo = m.file_type?.includes('video');

                      return (
                        <div
                          key={m.id}
                          style={{
                            background: 'var(--bg-surface-sub)',
                            border: '1px solid var(--border-subtle)',
                            borderRadius: 'var(--r-md)',
                            padding: '12px 14px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '12px'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                            <div className="entity-avatar">
                              {isVideo ? <Film size={14} /> : <ImageIcon size={14} />}
                            </div>
                            <div style={{ minWidth: 0 }}>
                              <div className="cell-primary" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {m.name || 'Criativo sem nome'}
                              </div>
                              <div className="cell-secondary">
                                {isVideo ? 'Vídeo publicitário' : 'Banner / Imagem'}
                              </div>
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span className={`badge ${isApproved ? 'badge-success' : isPending ? 'badge-warning' : 'badge-neutral'}`}>
                              {isApproved ? (
                                <>
                                  <ShieldCheck size={11} />
                                  <span>Em Veiculação</span>
                                </>
                              ) : isPending ? (
                                <span>Em Moderação</span>
                              ) : (
                                <span>{m.status || 'Arquivo'}</span>
                              )}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setSelectedAdvForMedias(null)}
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}


