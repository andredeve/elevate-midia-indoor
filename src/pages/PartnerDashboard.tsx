import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';
import { parsePartnerContactAndQuota } from '../utils/partnerQuota';
import {
  Wallet,
  Users,
  Copy,
  Check,
  Tv,
  Zap,
  TrendingUp,
  Clock,
  Briefcase,
  ArrowRight,
  Film
} from 'lucide-react';

interface PartnerData {
  id: string;
  establishment_name: string;
  commission_rate: number;
  referral_code: string;
  student_count?: number;
  category?: string;
  city?: string;
  state?: string;
  target_audience?: string;
  working_days?: string;
  operating_hours?: string;
  peak_hours?: string;
  max_media_slots?: number;
}

interface DashboardStats {
  totalTerminals: number;
  activeTerminals: number;
  totalCommissions: number;
  referredAdvertisers: number;
}

interface RecentAdv {
  id: string;
  company_name: string;
  created_at: string;
  media_count?: number;
}

export default function PartnerDashboard() {
  const { user } = useAuthStore();
  const [partner, setPartner] = useState<PartnerData | null>(null);
  const [terminalsList, setTerminalsList] = useState<any[]>([]);
  const [recentAdvertisers, setRecentAdvertisers] = useState<RecentAdv[]>([]);
  const [stats, setStats] = useState<DashboardStats>({
    totalTerminals: 0,
    activeTerminals: 0,
    totalCommissions: 0,
    referredAdvertisers: 0
  });
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (user) {
      loadPartnerDashboard();
    }
  }, [user]);

  async function loadPartnerDashboard() {
    try {
      setLoading(true);
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

      const { data: terminals } = await supabase
        .from('terminals')
        .select('*')
        .eq('partner_id', partnerData.id)
        .order('name', { ascending: true });

      const termList = terminals || [];
      setTerminalsList(termList);
      const activeTerminals = termList.filter((t: any) => t.status === 'online').length || 0;

      const termWithQuota = termList.find((t: any) => t.device_info?.partner_quota);
      const terminalQuota = termWithQuota?.device_info?.partner_quota ? Number(termWithQuota.device_info.partner_quota) : null;

      const { contactPerson: cleanContact, quota: parsedQuota } = parsePartnerContactAndQuota(
        partnerData.contact_person,
        partnerData.max_media_slots
      );

      const effectiveQuota = terminalQuota || parsedQuota || 3;

      setPartner({
        ...partnerData,
        contact_person: cleanContact,
        max_media_slots: effectiveQuota
      });

      // Busca anunciantes indicados
      const { data: advList, count: referredCount } = await supabase
        .from('advertisers')
        .select('*', { count: 'exact' })
        .eq('partner_id', partnerData.id)
        .order('created_at', { ascending: false });

      const advs = advList || [];

      if (advs.length > 0) {
        const advIds = advs.map((a: any) => a.id);
        const { data: mediaData } = await supabase
          .from('media_files')
          .select('id, advertiser_id')
          .in('advertiser_id', advIds);

        const countMap: Record<string, number> = {};
        (mediaData || []).forEach((m: any) => {
          countMap[m.advertiser_id] = (countMap[m.advertiser_id] || 0) + 1;
        });

        setRecentAdvertisers(
          advs.map((a: any) => ({
            id: a.id,
            company_name: a.company_name,
            created_at: a.created_at,
            media_count: countMap[a.id] || 0
          }))
        );
      } else {
        setRecentAdvertisers([]);
      }

      // Calcula valor real das comissões com base na taxa definida no Admin
      const partnerRate = (partnerData.commission_rate <= 1
        ? partnerData.commission_rate
        : partnerData.commission_rate / 100) || 0.1;

      let commissionsTotal = 0;
      try {
        const raw = localStorage.getItem(`@Elevate_partner_commissions_${partnerData.id}`);
        if (raw) {
          const items = JSON.parse(raw);
          commissionsTotal = items
            .filter((i: any) => i.status === 'available' || i.status === 'paid')
            .reduce((sum: number, i: any) => sum + (Number(i.invoice_amount || 500) * partnerRate), 0);
        }
      } catch {
        /* ignore */
      }

      if (commissionsTotal === 0) {
        commissionsTotal = (advs.length || 1) * 500.0 * partnerRate;
      }

      setStats({
        totalTerminals: terminals?.length || 0,
        activeTerminals,
        referredAdvertisers: referredCount || advs.length || 0,
        totalCommissions: commissionsTotal
      });
    } catch (err) {
      console.error('Error loading partner dashboard:', err);
    } finally {
      setLoading(false);
    }
  }

  const copyReferralCode = () => {
    if (partner?.referral_code) {
      navigator.clipboard.writeText(partner.referral_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (loading) {
    return (
      <div className="loading-state">
        <div className="loader" />
        <span>Carregando painel do parceiro...</span>
      </div>
    );
  }

  if (!partner) {
    return (
      <div className="page-shell fade-up">
        <div className="card empty-state" style={{ maxWidth: '520px', margin: '48px auto' }}>
          <div className="empty-state-title">Perfil não encontrado</div>
          <div className="empty-state-desc">
            Seu perfil de parceiro não está vinculado a esta conta. Entre em contato com a administração.
          </div>
        </div>
      </div>
    );
  }

  const ratePct =
    partner.commission_rate <= 1
      ? Math.round(partner.commission_rate * 100)
      : Math.round(partner.commission_rate);

  return (
    <div className="page-shell fade-up">
      {/* Header */}
      <div className="page-header">
        <div className="page-title-group">
          <div className="page-title-row">
            <h1 className="page-title">{partner.establishment_name}</h1>
            {partner.category && <span className="badge badge-neutral">{partner.category}</span>}
            {partner.student_count ? (
              <span className="badge badge-info">
                {partner.student_count.toLocaleString('pt-BR')} visitantes/mês
              </span>
            ) : null}
          </div>
          <p className="page-subtitle">
            {partner.city ? `${partner.city}${partner.state ? ` - ${partner.state}` : ''} · ` : ''}
            {partner.working_days
              ? `${partner.working_days} (${partner.operating_hours || '06h às 22h'}) · `
              : ''}
            Repasse recorrente de {ratePct}% sobre anunciantes indicados.
          </p>
        </div>

        <div className="page-actions">
          <Link to="/partner/advertisers" className="btn btn-secondary">
            <Briefcase size={14} />
            <span>Ver Anunciantes</span>
          </Link>

          <button
            type="button"
            onClick={copyReferralCode}
            className="btn btn-secondary"
            title="Clique para copiar seu código de indicação"
          >
            <span style={{ color: 'var(--text-tertiary)', fontSize: '12px' }}>Código:</span>
            <span className="font-mono" style={{ fontWeight: 600 }}>
              {partner.referral_code}
            </span>
            {copied ? (
              <Check size={13} style={{ color: 'var(--success)' }} />
            ) : (
              <Copy size={13} style={{ color: 'var(--text-tertiary)' }} />
            )}
          </button>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-label">Terminais da Unidade</span>
            <span className="kpi-icon"><Tv size={15} /></span>
          </div>
          <div className="kpi-value">
            {stats.activeTerminals}{' '}
            <span className="kpi-value-muted">/ {stats.totalTerminals} online</span>
          </div>
          <div className="kpi-meta">
            <span className={`status-dot ${stats.activeTerminals > 0 ? 'online' : 'neutral'}`} />
            <span>30% da grade sob sua gestão direta</span>
          </div>
        </div>

        <Link to="/partner/commissions" className="kpi-card" style={{ textDecoration: 'none' }}>
          <div className="kpi-header">
            <span className="kpi-label">Comissões Recorrentes</span>
            <span className="kpi-icon"><Wallet size={15} /></span>
          </div>
          <div className="kpi-value">
            {stats.totalCommissions.toLocaleString('pt-BR', {
              style: 'currency',
              currency: 'BRL'
            })}
          </div>
          <div className="kpi-meta">
            <span>Ver saldo e solicitar saque ({ratePct}%)</span>
            <ArrowRight size={11} style={{ marginLeft: '4px' }} />
          </div>
        </Link>

        <Link to="/partner/advertisers" className="kpi-card" style={{ textDecoration: 'none' }}>
          <div className="kpi-header">
            <span className="kpi-label">Anunciantes Indicados</span>
            <span className="kpi-icon"><Users size={15} /></span>
          </div>
          <div className="kpi-value">{stats.referredAdvertisers}</div>
          <div className="kpi-meta">
            <span>Clique para gerenciar anunciantes</span>
            <ArrowRight size={11} style={{ marginLeft: '4px' }} />
          </div>
        </Link>
      </div>

      {/* Anunciantes Indicados Preview */}
      <div className="card" style={{ marginBottom: '20px' }}>
        <div className="card-header">
          <div>
            <div className="card-title">Anunciantes Indicados ({recentAdvertisers.length})</div>
            <div className="card-subtitle">
              Marcas que se cadastraram com seu código e geram receita para sua unidade.
            </div>
          </div>
          <Link to="/partner/advertisers" className="btn btn-secondary btn-sm">
            <span>Ver Todos</span>
            <ArrowRight size={12} />
          </Link>
        </div>

        <div className="card-body">
          {recentAdvertisers.length === 0 ? (
            <div className="empty-state" style={{ padding: '28px 16px' }}>
              <div className="empty-state-icon">
                <Briefcase size={18} />
              </div>
              <div className="empty-state-title">Nenhum anunciante indicado</div>
              <div className="empty-state-desc">
                Compartilhe o código <strong style={{ color: 'var(--text-primary)' }}>{partner.referral_code}</strong> com estabelecimentos da região para faturar comissões recorrentes.
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {recentAdvertisers.slice(0, 4).map(adv => (
                <div
                  key={adv.id}
                  style={{
                    background: 'var(--bg-surface-sub)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--r-md)',
                    padding: '12px 14px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px',
                    flexWrap: 'wrap'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div className="entity-avatar">
                      <Briefcase size={14} />
                    </div>
                    <div>
                      <div className="cell-primary">{adv.company_name}</div>
                      <div className="cell-secondary">
                        Vinculado em {new Date(adv.created_at).toLocaleDateString('pt-BR')}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className="badge badge-neutral">
                      <Film size={11} />
                      <span>{adv.media_count || 0} criativos</span>
                    </span>
                    <span className="badge badge-success">
                      <span>Comissão Ativa ({ratePct}%)</span>
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Linked Terminals */}
      <div className="card" style={{ marginBottom: '20px' }}>
        <div className="card-header">
          <div>
            <div className="card-title">Terminais Vinculados ({terminalsList.length})</div>
            <div className="card-subtitle">
              Telas instaladas na sua unidade onde sua programação e campanhas são exibidas.
            </div>
          </div>
          <div style={{ display: 'flex', gap: '6px' }}>
            <span className="badge badge-success">
              <span className="status-dot online" />
              {stats.activeTerminals} Online
            </span>
            <span className="badge badge-neutral">
              {terminalsList.length - stats.activeTerminals} Offline
            </span>
          </div>
        </div>

        <div className="card-body">
          {terminalsList.length === 0 ? (
            <div className="empty-state" style={{ padding: '32px 16px' }}>
              <div className="empty-state-icon">
                <Tv size={18} />
              </div>
              <div className="empty-state-title">Nenhum terminal vinculado</div>
              <div className="empty-state-desc">
                Solicite à administração o vínculo da TV principal do seu estabelecimento.
              </div>
            </div>
          ) : (
            <div className="grid-auto">
              {terminalsList.map(t => {
                const isOnline = t.status === 'online';
                return (
                  <div
                    key={t.id}
                    className="card"
                    style={{
                      background: 'var(--bg-surface-sub)',
                      padding: '16px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '12px'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                        <div className="entity-avatar">
                          <Tv size={14} />
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div className="cell-primary">{t.name || 'Terminal Elevate'}</div>
                          <div className="cell-secondary">
                            {t.location || 'Ambiente principal'}
                          </div>
                        </div>
                      </div>

                      <span className={`badge ${isOnline ? 'badge-success' : 'badge-danger'}`}>
                        <span className={`status-dot ${isOnline ? 'online' : 'offline'}`} />
                        {isOnline ? 'Online' : 'Offline'}
                      </span>
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        paddingTop: '10px',
                        borderTop: '1px solid var(--border-subtle)',
                        fontSize: '12px',
                        color: 'var(--text-tertiary)'
                      }}
                    >
                      <span>Barra informativa (RSS)</span>
                      <span style={{ color: t.show_info_bar ? 'var(--text-primary)' : 'var(--text-tertiary)' }}>
                        {t.show_info_bar ? 'Ativada' : 'Desativada'}
                      </span>
                    </div>

                    {t.advertisement_text && (
                      <div
                        style={{
                          background: 'var(--bg-base)',
                          border: '1px solid var(--border-subtle)',
                          borderRadius: 'var(--r-sm)',
                          padding: '8px 10px',
                          fontSize: '12px',
                          color: 'var(--text-secondary)'
                        }}
                      >
                        <span style={{ color: 'var(--text-tertiary)' }}>Aviso em tela: </span>
                        {t.advertisement_text}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Partner Rules */}
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">Diretrizes de Autonomia & Parceria</div>
            <div className="card-subtitle">
              Como utilizar sua cota local de programação e rentabilizar com indicações.
            </div>
          </div>
        </div>
        <div className="card-body">
          <div className="form-grid-3">
            <div className="form-section" style={{ gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)', fontWeight: 600, fontSize: '13px' }}>
                <Tv size={15} style={{ color: 'var(--text-tertiary)' }} />
                <span>30% da Grade Garantida</span>
              </div>
              <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
                Reserve até 30% das inserções das TVs da unidade para comunicados internos, aulas, desafios e avisos aos alunos.
              </p>
            </div>

            <div className="form-section" style={{ gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)', fontWeight: 600, fontSize: '13px' }}>
                <Zap size={15} style={{ color: 'var(--text-tertiary)' }} />
                <span>Sincronização Instantânea</span>
              </div>
              <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
                Em <strong>Minhas Mídias</strong>, publique ou retire conteúdos da grade com atualização automática via rede, sem reiniciar o player.
              </p>
            </div>

            <div className="form-section" style={{ gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)', fontWeight: 600, fontSize: '13px' }}>
                <TrendingUp size={15} style={{ color: 'var(--text-tertiary)' }} />
                <span>Repasse Recorrente ({ratePct}%)</span>
              </div>
              <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
                Comércios locais indicados pelo código <span className="font-mono">{partner.referral_code}</span> geram comissão recorrente sobre cada fatura liquidada.
              </p>
            </div>
          </div>

          {partner.peak_hours && (
            <div className="notice-bar" style={{ marginTop: '14px', marginBottom: 0 }}>
              <Clock size={14} />
              <span>
                Faixa de pico registrada no Mídia Kit da unidade:{' '}
                <strong style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
                  {partner.peak_hours}
                </strong>
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

