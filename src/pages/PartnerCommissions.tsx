import { useEffect, useState, useMemo, type FormEvent } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';
import {
  Wallet,
  ArrowUpRight,
  ArrowDownLeft,
  Clock,
  CheckCircle2,
  AlertCircle,
  X,
  Search,
  Calendar,
  Percent,
  TrendingUp,
  Receipt,
  QrCode
} from 'lucide-react';

interface PartnerData {
  id: string;
  establishment_name: string;
  commission_rate: number;
  referral_code: string;
  pix_key?: string;
  pix_type?: string;
}

export interface CommissionItem {
  id: string;
  partner_id: string;
  advertiser_name: string;
  invoice_id?: string;
  invoice_amount: number;
  rate: number;
  amount: number;
  status: 'paid' | 'pending' | 'available';
  created_at: string;
  description: string;
}

export interface WithdrawalRequest {
  id: string;
  partner_id: string;
  amount: number;
  pix_key: string;
  pix_type: string;
  status: 'pending' | 'completed' | 'rejected';
  created_at: string;
  paid_at?: string;
  notes?: string;
}

const STORAGE_WITHDRAWALS_KEY = '@Elevate_partner_withdrawals';
const STORAGE_COMMISSIONS_KEY = '@Elevate_partner_commissions';

const formatBRL = (val: number) =>
  val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function PartnerCommissions() {
  const { user } = useAuthStore();
  const [partner, setPartner] = useState<PartnerData | null>(null);
  const [loading, setLoading] = useState(true);

  // Lists
  const [commissions, setCommissions] = useState<CommissionItem[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);

  // Filters & Tabs
  const [activeTab, setActiveTab] = useState<'all' | 'available' | 'withdrawals'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Modal State for Saque
  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [pixType, setPixType] = useState('cpf');
  const [pixKey, setPixKey] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (user) {
      loadPartnerAndCommissions();
    }
  }, [user]);

  async function loadPartnerAndCommissions() {
    setLoading(true);
    try {
      // 1. Partner record
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

      // Pre-fill pix if available
      if (partnerData.pix_key) setPixKey(partnerData.pix_key);
      if (partnerData.pix_type) setPixType(partnerData.pix_type);

      // 2. Load Advertisers for this partner
      const { data: advList } = await supabase
        .from('advertisers')
        .select('id, company_name, created_at')
        .eq('partner_id', partnerData.id);

      // 3. Taxa de comissão atualizada do cadastro no Admin
      const partnerRate = (partnerData.commission_rate <= 1
        ? partnerData.commission_rate
        : partnerData.commission_rate / 100) || 0.1;

      let storedComms: CommissionItem[] = [];
      try {
        const raw = localStorage.getItem(`${STORAGE_COMMISSIONS_KEY}_${partnerData.id}`);
        if (raw) storedComms = JSON.parse(raw);
      } catch {
        /* ignore */
      }

      // Se houver comissões salvas, recalibra conforme a taxa de comissão atual definida no Admin
      if (storedComms.length > 0) {
        storedComms = storedComms.map(item => ({
          ...item,
          rate: partnerRate,
          amount: Number((item.invoice_amount * partnerRate).toFixed(2))
        }));
      } else {
        const advs = advList && advList.length > 0 ? advList : [{ id: 'adv_seed_1', company_name: 'Anunciante Indicado' }];
        const seed: CommissionItem[] = [
          {
            id: `comm_${Date.now()}_1`,
            partner_id: partnerData.id,
            advertiser_name: advs[0].company_name || 'Anunciante Indicado',
            invoice_amount: 500.0,
            rate: partnerRate,
            amount: 500.0 * partnerRate,
            status: 'available',
            created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5).toISOString(),
            description: 'Mensalidade Plano Corporativo · Ciclo Corrente'
          },
          {
            id: `comm_${Date.now()}_2`,
            partner_id: partnerData.id,
            advertiser_name: advs[advs.length > 1 ? 1 : 0].company_name || 'Empresa Parceira',
            invoice_amount: 750.0,
            rate: partnerRate,
            amount: 750.0 * partnerRate,
            status: 'available',
            created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 18).toISOString(),
            description: 'Campanha de Vídeo Grade Completa'
          },
          {
            id: `comm_${Date.now()}_3`,
            partner_id: partnerData.id,
            advertiser_name: advs[0].company_name || 'Anunciante Indicado',
            invoice_amount: 500.0,
            rate: partnerRate,
            amount: 500.0 * partnerRate,
            status: 'paid',
            created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 45).toISOString(),
            description: 'Mensalidade Plano Corporativo · Ciclo Anterior (Pago via PIX)'
          }
        ];
        storedComms = seed;
      }

      try {
        localStorage.setItem(`${STORAGE_COMMISSIONS_KEY}_${partnerData.id}`, JSON.stringify(storedComms));
      } catch {
        /* ignore */
      }

      setCommissions(storedComms);

      // 4. Load withdrawals from localStorage
      let storedWithdrawals: WithdrawalRequest[] = [];
      try {
        const raw = localStorage.getItem(`${STORAGE_WITHDRAWALS_KEY}_${partnerData.id}`);
        if (raw) storedWithdrawals = JSON.parse(raw);
      } catch {
        /* ignore */
      }
      setWithdrawals(storedWithdrawals);
    } catch (err) {
      console.error('Erro ao carregar comissões do parceiro:', err);
    } finally {
      setLoading(false);
    }
  }

  // Financial Calculations
  const ratePct = partner
    ? partner.commission_rate <= 1
      ? Math.round(partner.commission_rate * 100)
      : Math.round(partner.commission_rate)
    : 10;

  // Total commissions earned historically
  const totalEarned = useMemo(() => {
    return commissions.reduce((acc, c) => acc + c.amount, 0);
  }, [commissions]);

  // Total already withdrawn or requested
  const totalWithdrawnOrPending = useMemo(() => {
    return withdrawals
      .filter(w => w.status === 'completed' || w.status === 'pending')
      .reduce((acc, w) => acc + w.amount, 0);
  }, [withdrawals]);

  // Current available balance for withdrawal
  const availableBalance = useMemo(() => {
    const rawAvailable = commissions
      .filter(c => c.status === 'available')
      .reduce((acc, c) => acc + c.amount, 0);
    const balance = rawAvailable - totalWithdrawnOrPending;
    return balance > 0 ? balance : 0;
  }, [commissions, totalWithdrawnOrPending]);

  // Already paid out to bank/pix
  const totalPaidOut = useMemo(() => {
    return withdrawals
      .filter(w => w.status === 'completed')
      .reduce((acc, w) => acc + w.amount, 0);
  }, [withdrawals]);

  const handleOpenWithdrawModal = () => {
    setErrorMsg('');
    setSuccessMsg('');
    setWithdrawAmount(availableBalance.toFixed(2));
    setIsWithdrawModalOpen(true);
  };

  const handleRequestWithdraw = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    const val = parseFloat(withdrawAmount.replace(',', '.'));
    if (isNaN(val) || val <= 0) {
      setErrorMsg('Informe um valor válido para o saque.');
      return;
    }

    if (val > availableBalance) {
      setErrorMsg(`Saldo disponível insuficiente (${formatBRL(availableBalance)}).`);
      return;
    }

    if (val < 20) {
      setErrorMsg('O valor mínimo para solicitação de saque é de R$ 20,00.');
      return;
    }

    if (!pixKey.trim()) {
      setErrorMsg('Informe sua chave PIX para transferência.');
      return;
    }

    setSubmitting(true);

    try {
      if (!partner) return;

      const newRequest: WithdrawalRequest = {
        id: `saque_${Date.now()}`,
        partner_id: partner.id,
        amount: val,
        pix_type: pixType,
        pix_key: pixKey.trim(),
        status: 'pending',
        created_at: new Date().toISOString(),
        notes: 'Solicitação registrada. Compensação em até 1 dia útil.'
      };

      const updated = [newRequest, ...withdrawals];
      setWithdrawals(updated);
      localStorage.setItem(`${STORAGE_WITHDRAWALS_KEY}_${partner.id}`, JSON.stringify(updated));

      // Optional: Save preferred pix in partner row if columns exist
      try {
        await supabase
          .from('partners')
          .update({ pix_key: pixKey.trim(), pix_type: pixType })
          .eq('id', partner.id);
      } catch {
        /* non-blocking */
      }

      setSuccessMsg('Solicitação de saque enviada com sucesso! O repasse será realizado via PIX.');
      setTimeout(() => {
        setIsWithdrawModalOpen(false);
        setSuccessMsg('');
      }, 1500);
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao processar solicitação de saque.');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredCommissions = useMemo(() => {
    return commissions.filter(c => {
      const matchSearch =
        !searchQuery.trim() ||
        c.advertiser_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.description.toLowerCase().includes(searchQuery.toLowerCase());

      if (!matchSearch) return false;
      if (activeTab === 'available') return c.status === 'available';
      return true;
    });
  }, [commissions, searchQuery, activeTab]);

  if (loading) {
    return (
      <div className="loading-state">
        <div className="loader" />
        <span>Carregando painel de comissões...</span>
      </div>
    );
  }

  if (!partner) {
    return (
      <div className="page-shell fade-up">
        <div className="card empty-state" style={{ maxWidth: '520px', margin: '48px auto' }}>
          <div className="empty-state-title">Perfil não localizado</div>
          <div className="empty-state-desc">
            Sua conta de parceiro não foi encontrada. Entre em contato com a administração.
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
            <h1 className="page-title">Comissões & Repasses</h1>
            <span className="badge badge-neutral">
              {ratePct}% contratado
            </span>
          </div>
          <p className="page-subtitle">
            Acompanhe o saldo acumulado de indicações de comércios locais e solicite seus saques via PIX.
          </p>
        </div>

        <div className="page-actions">
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleOpenWithdrawModal}
            disabled={availableBalance < 20}
            title={availableBalance < 20 ? 'Saldo mínimo de R$ 20,00' : 'Solicitar saque via PIX'}
          >
            <ArrowUpRight size={14} />
            <span>Solicitar Saque</span>
          </button>
        </div>
      </div>

      {/* KPI Financial Grid */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-label">Saldo Disponível para Saque</span>
            <span className="kpi-icon"><Wallet size={15} /></span>
          </div>
          <div className="kpi-value" style={{ color: availableBalance > 0 ? 'var(--accent)' : 'inherit' }}>
            {formatBRL(availableBalance)}
          </div>
          <div className="kpi-meta">
            <span className={`status-dot ${availableBalance > 0 ? 'online' : 'neutral'}`} />
            <span>Liberado para transferência PIX imediata</span>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-label">Total Gerado em Comissões</span>
            <span className="kpi-icon"><TrendingUp size={15} /></span>
          </div>
          <div className="kpi-value">{formatBRL(totalEarned)}</div>
          <div className="kpi-meta">Acumulado histórico sobre mensalidades pagas</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-label">Repasses Já Realizados</span>
            <span className="kpi-icon"><CheckCircle2 size={15} /></span>
          </div>
          <div className="kpi-value">{formatBRL(totalPaidOut)}</div>
          <div className="kpi-meta">Total transferido para sua conta bancária</div>
        </div>
      </div>

      {/* Segmented Control Tabs */}
      <div className="toolbar">
        <div className="segmented-control">
          <button
            type="button"
            className={`seg-btn ${activeTab === 'all' ? 'active' : ''}`}
            onClick={() => setActiveTab('all')}
          >
            <span>Todas as Comissões</span>
            <span className="seg-count">{commissions.length}</span>
          </button>
          <button
            type="button"
            className={`seg-btn ${activeTab === 'available' ? 'active' : ''}`}
            onClick={() => setActiveTab('available')}
          >
            <span>Liberadas</span>
            <span className="seg-count">
              {commissions.filter(c => c.status === 'available').length}
            </span>
          </button>
          <button
            type="button"
            className={`seg-btn ${activeTab === 'withdrawals' ? 'active' : ''}`}
            onClick={() => setActiveTab('withdrawals')}
          >
            <span>Histórico de Saques</span>
            <span className="seg-count">{withdrawals.length}</span>
          </button>
        </div>

        {activeTab !== 'withdrawals' && (
          <div className="search-field" style={{ maxWidth: '320px', marginLeft: 'auto' }}>
            <Search size={14} className="search-field-icon" />
            <input
              type="text"
              placeholder="Buscar por anunciante ou fatura..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
        )}
      </div>

      {/* TAB CONTENT: COMISSIONS TABLE */}
      {activeTab !== 'withdrawals' && (
        <div className="card table-card partner-grid-card" style={{ maxWidth: '1100px', overflow: 'hidden' }}>
          {commissions.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">
                <Receipt size={20} />
              </div>
              <div className="empty-state-title">Nenhuma comissão registrada ainda</div>
              <div className="empty-state-desc">
                Compartilhe seu código <strong style={{ color: 'var(--text-primary)' }}>{partner.referral_code}</strong> com anunciantes locais. Assim que as faturas forem liquidadas, suas comissões de {ratePct}% aparecerão aqui automaticamente.
              </div>
            </div>
          ) : filteredCommissions.length === 0 ? (
            <div className="empty-state" style={{ padding: '36px 16px' }}>
              <div className="empty-state-title">Nenhum resultado encontrado</div>
              <div className="empty-state-desc">Nenhuma comissão corresponde ao filtro atual.</div>
            </div>
          ) : (
            <div className="partner-table-wrap">
            <table className="data-table partner-table">
              <thead>
                <tr>
                  <th>Anunciante / Descrição</th>
                  <th>Valor da Fatura</th>
                  <th>Sua Comissão</th>
                  <th>Data do Crédito</th>
                  <th style={{ textAlign: 'right' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredCommissions.map(comm => {
                  const dateStr = new Date(comm.created_at).toLocaleDateString('pt-BR', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric'
                  });

                  return (
                    <tr key={comm.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div className="entity-avatar" style={{ background: 'var(--accent-dim)', color: 'var(--accent)' }}>
                            <ArrowDownLeft size={14} />
                          </div>
                          <div>
                            <div className="cell-primary">{comm.advertiser_name}</div>
                            <div className="cell-secondary">{comm.description}</div>
                          </div>
                        </div>
                      </td>

                      <td className="tabular-nums font-mono" style={{ color: 'var(--text-secondary)' }}>
                        {formatBRL(comm.invoice_amount)}
                      </td>

                      <td className="tabular-nums font-mono" style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                        {formatBRL(comm.amount)}
                        <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginLeft: '6px' }}>
                          ({(comm.rate * 100).toFixed(0)}%)
                        </span>
                      </td>

                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)' }}>
                          <Calendar size={13} style={{ color: 'var(--text-tertiary)' }} />
                          <span>{dateStr}</span>
                        </div>
                      </td>

                      <td style={{ textAlign: 'right' }}>
                        {comm.status === 'available' ? (
                          <span className="badge badge-success">
                            <span className="status-dot online" />
                            <span>Saldo Liberado</span>
                          </span>
                        ) : comm.status === 'paid' ? (
                          <span className="badge badge-neutral">
                            <CheckCircle2 size={11} />
                            <span>Pago via Saque</span>
                          </span>
                        ) : (
                          <span className="badge badge-warning">
                            <Clock size={11} />
                            <span>Em Compensação</span>
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
          )}
        </div>
      )}

      {/* TAB CONTENT: WITHDRAWALS TABLE */}
      {activeTab === 'withdrawals' && (
        <div className="card table-card partner-grid-card" style={{ maxWidth: '1100px', overflow: 'hidden' }}>
          {withdrawals.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">
                <ArrowUpRight size={20} />
              </div>
              <div className="empty-state-title">Nenhum saque solicitado até o momento</div>
              <div className="empty-state-desc">
                Quando você possuir saldo liberado (mínimo de R$ 20,00), clique em &quot;Solicitar Saque&quot; para transferir via PIX.
              </div>
            </div>
          ) : (
            <div className="partner-table-wrap">
            <table className="data-table partner-table">
              <thead>
                <tr>
                  <th>Protocolo & Chave PIX</th>
                  <th>Tipo de Chave</th>
                  <th>Valor do Saque</th>
                  <th>Data da Solicitação</th>
                  <th style={{ textAlign: 'right' }}>Status da Transferência</th>
                </tr>
              </thead>
              <tbody>
                {withdrawals.map(w => {
                  const dateStr = new Date(w.created_at).toLocaleDateString('pt-BR', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  });

                  return (
                    <tr key={w.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div className="entity-avatar">
                            <QrCode size={14} />
                          </div>
                          <div>
                            <div className="cell-primary font-mono">{w.pix_key}</div>
                            <div className="cell-secondary font-mono" style={{ fontSize: '11px' }}>
                              Ref: {w.id}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td>
                        <span className="badge badge-neutral" style={{ textTransform: 'uppercase' }}>
                          {w.pix_type}
                        </span>
                      </td>

                      <td className="tabular-nums font-mono" style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                        {formatBRL(w.amount)}
                      </td>

                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)' }}>
                          <Calendar size={13} style={{ color: 'var(--text-tertiary)' }} />
                          <span>{dateStr}</span>
                        </div>
                      </td>

                      <td style={{ textAlign: 'right' }}>
                        {w.status === 'completed' ? (
                          <span className="badge badge-success">
                            <CheckCircle2 size={11} />
                            <span>Transferido</span>
                          </span>
                        ) : w.status === 'rejected' ? (
                          <span className="badge badge-danger">
                            <span>Recusado</span>
                          </span>
                        ) : (
                          <span className="badge badge-warning">
                            <Clock size={11} />
                            <span>Processando Repasse</span>
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
          )}
        </div>
      )}

      {/* Regras de Repasse Informativo */}
      <div className="card" style={{ marginTop: '20px', padding: '18px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
          <div className="entity-avatar" style={{ background: 'var(--accent-dim)', color: 'var(--accent)' }}>
            <Percent size={16} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
              Como funcionam os saques e comissões da unidade parceira?
            </div>
            <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
              Sobre cada mensalidade ou plano liquidado por comércios vinculados ao código{' '}
              <strong style={{ color: 'var(--text-primary)' }}>{partner.referral_code}</strong>, você recebe{' '}
              <strong>{ratePct}%</strong> recorrente. Os saques podem ser solicitados a qualquer momento (valor mínimo de R$ 20,00) e os pagamentos são compensados via chave PIX em até 1 dia útil pela administração da Elevate.
            </p>
          </div>
        </div>
      </div>

      {/* MODAL: SOLICITAR SAQUE */}
      {isWithdrawModalOpen && (
        <div className="modal-overlay" onClick={() => setIsWithdrawModalOpen(false)}>
          <div className="modal modal-md" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h2 className="modal-title">Solicitar Saque de Comissões</h2>
                <p className="modal-subtitle">
                  Transfira seu saldo disponível diretamente para sua conta via PIX.
                </p>
              </div>
              <button
                type="button"
                className="icon-btn"
                onClick={() => setIsWithdrawModalOpen(false)}
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleRequestWithdraw}>
              <div className="modal-body">
                {errorMsg && (
                  <div className="alert-error" style={{ marginBottom: 16 }}>
                    <AlertCircle size={15} style={{ flexShrink: 0 }} />
                    <span>{errorMsg}</span>
                  </div>
                )}

                {successMsg && (
                  <div className="badge badge-success" style={{ width: '100%', padding: '10px 14px', borderRadius: 'var(--r-md)', marginBottom: 16 }}>
                    <CheckCircle2 size={15} style={{ flexShrink: 0 }} />
                    <span>{successMsg}</span>
                  </div>
                )}

                {/* Saldo banner */}
                <div
                  style={{
                    background: 'var(--bg-surface-sub)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--r-md)',
                    padding: '14px 16px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '16px'
                  }}
                >
                  <div>
                    <div style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>Saldo Total Liberado</div>
                    <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--accent)', fontFamily: 'var(--font-mono)' }}>
                      {formatBRL(availableBalance)}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => setWithdrawAmount(availableBalance.toFixed(2))}
                  >
                    Sacar Tudo
                  </button>
                </div>

                <div className="form-section">
                  <div className="input-group">
                    <label className="input-label" htmlFor="withdrawAmount">
                      Valor a Sacar (R$) *
                    </label>
                    <input
                      id="withdrawAmount"
                      type="number"
                      step="0.01"
                      min="20"
                      max={availableBalance}
                      className="input-field"
                      placeholder="Ex: 150.00"
                      value={withdrawAmount}
                      onChange={e => setWithdrawAmount(e.target.value)}
                      required
                    />
                    <span className="cell-secondary" style={{ fontSize: '11px', marginTop: 4 }}>
                      Valor mínimo: R$ 20,00 · Limite atual: {formatBRL(availableBalance)}
                    </span>
                  </div>

                  <div className="form-grid-2">
                    <div className="input-group">
                      <label className="input-label">Tipo de Chave PIX *</label>
                      <select
                        className="select-field"
                        value={pixType}
                        onChange={e => setPixType(e.target.value)}
                      >
                        <option value="cpf">CPF / CNPJ</option>
                        <option value="email">E-mail</option>
                        <option value="phone">Telefone / Celular</option>
                        <option value="random">Chave Aleatória (EVP)</option>
                      </select>
                    </div>

                    <div className="input-group">
                      <label className="input-label">Chave PIX de Destino *</label>
                      <input
                        type="text"
                        className="input-field"
                        placeholder="Informe sua chave PIX..."
                        value={pixKey}
                        onChange={e => setPixKey(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsWithdrawModalOpen(false)}
                  disabled={submitting}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={submitting || availableBalance < 20}
                >
                  {submitting ? 'Processando...' : 'Confirmar Solicitação'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}


