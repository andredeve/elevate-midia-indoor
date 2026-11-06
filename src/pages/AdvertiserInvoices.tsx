import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';
import {
  DollarSign,
  Clock,
  CheckCircle2,
  FileText,
  Search,
  Copy,
  Check,
  ShieldCheck,
  CreditCard,
  RefreshCw,
  X,
  ExternalLink
} from 'lucide-react';

interface Invoice {
  id: string;
  amount: number;
  status: 'pending' | 'paid' | 'overdue' | 'cancelled';
  due_date: string;
  paid_date: string | null;
  invoice_url: string | null;
  created_at: string;
}

const formatBRL = (val: number) =>
  Number(val || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function AdvertiserInvoices() {
  const { user } = useAuthStore();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [advertiserId, setAdvertiserId] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState<string>('');

  // Filter & Search states
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'paid' | 'overdue'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Interactive Modal state
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [copiedPix, setCopiedPix] = useState(false);

  useEffect(() => {
    if (user) loadInvoices();
  }, [user]);

  async function loadInvoices() {
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
      setAdvertiserId(advData.id);
      setCompanyName(advData.company_name);

      const { data } = await supabase
        .from('invoices')
        .select('*')
        .eq('advertiser_id', advData.id)
        .order('due_date', { ascending: false });

      if (data) setInvoices(data as Invoice[]);
    } catch (err) {
      console.error('Error loading invoices:', err);
    } finally {
      setLoading(false);
    }
  }

  const renderStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return (
          <span className="badge badge-success">
            <span className="status-dot online" />
            Paga
          </span>
        );
      case 'overdue':
        return (
          <span className="badge badge-danger">
            <span className="status-dot offline" />
            Atrasada
          </span>
        );
      case 'cancelled':
        return <span className="badge badge-neutral">Cancelada</span>;
      case 'pending':
      default:
        return (
          <span className="badge badge-warning">
            <span className="status-dot warning" />
            Pendente
          </span>
        );
    }
  };

  const totalPending = invoices
    .filter(i => i.status === 'pending' || i.status === 'overdue')
    .reduce((sum, i) => sum + Number(i.amount), 0);

  const totalPaid = invoices
    .filter(i => i.status === 'paid')
    .reduce((sum, i) => sum + Number(i.amount), 0);

  const hasOverdue = invoices.some(i => i.status === 'overdue');

  const filteredInvoices = invoices.filter(inv => {
    if (filterStatus !== 'all' && inv.status !== filterStatus) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const dateStr = new Date(inv.due_date).toLocaleDateString('pt-BR');
      const amountStr = Number(inv.amount).toFixed(2);
      return dateStr.includes(q) || amountStr.includes(q) || inv.id.toLowerCase().includes(q);
    }
    return true;
  });

  const handleCopyPix = () => {
    navigator.clipboard.writeText(
      '00020126580014br.gov.bcb.pix0136Elevate@midiasindoor.com.br5204000053039865802BR5915Elevate MIDIAS6009SAO PAULO62070503***6304E6B2'
    );
    setCopiedPix(true);
    setTimeout(() => setCopiedPix(false), 3000);
  };

  if (loading) {
    return (
      <div className="loading-state">
        <div className="loader" />
        <span>Carregando histórico financeiro...</span>
      </div>
    );
  }

  if (!advertiserId) {
    return (
      <div className="page-shell fade-up">
        <div className="card empty-state" style={{ maxWidth: '520px', margin: '48px auto' }}>
          <div className="empty-state-icon">
            <DollarSign size={18} />
          </div>
          <div className="empty-state-title">Perfil financeiro não configurado</div>
          <div className="empty-state-desc">
            Sua conta ainda não possui perfil de anunciante vinculado.
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
            <h1 className="page-title">Minhas Faturas</h1>
            <span className={`badge ${hasOverdue ? 'badge-danger' : 'badge-success'}`}>
              <span className={`status-dot ${hasOverdue ? 'offline' : 'online'}`} />
              {hasOverdue ? 'Pendências em atraso' : 'Situação regular'}
            </span>
            {companyName && <span className="badge badge-neutral">{companyName}</span>}
          </div>
          <p className="page-subtitle">
            Consulte vencimentos, comprovantes em PDF e realize pagamentos via PIX Copia e Cola.
          </p>
        </div>

        <div className="page-actions">
          <button type="button" className="btn btn-secondary" onClick={loadInvoices}>
            <RefreshCw size={14} />
            <span>Atualizar</span>
          </button>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-label">Total em Aberto</span>
            <span className="kpi-icon"><Clock size={15} /></span>
          </div>
          <div className="kpi-value">{formatBRL(totalPending)}</div>
          <div className="kpi-meta">Faturas pendentes ou vencidas</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-label">Total Liquidado</span>
            <span className="kpi-icon"><CheckCircle2 size={15} /></span>
          </div>
          <div className="kpi-value">{formatBRL(totalPaid)}</div>
          <div className="kpi-meta">Histórico acumulado de pagamentos</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-label">Meios de Liquidação</span>
            <span className="kpi-icon"><ShieldCheck size={15} /></span>
          </div>
          <div className="kpi-value" style={{ fontSize: '18px', marginTop: '4px' }}>
            PIX & Boleto Bancário
          </div>
          <div className="kpi-meta">Compensação automática</div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="toolbar">
        <div className="toolbar-left">
          <div className="segmented-control">
            <button
              type="button"
              className={`seg-btn ${filterStatus === 'all' ? 'active' : ''}`}
              onClick={() => setFilterStatus('all')}
            >
              <span>Todas</span>
              <span className="seg-count">{invoices.length}</span>
            </button>
            <button
              type="button"
              className={`seg-btn ${filterStatus === 'pending' ? 'active' : ''}`}
              onClick={() => setFilterStatus('pending')}
            >
              <span>Pendentes</span>
              <span className="seg-count">{invoices.filter(i => i.status === 'pending').length}</span>
            </button>
            <button
              type="button"
              className={`seg-btn ${filterStatus === 'paid' ? 'active' : ''}`}
              onClick={() => setFilterStatus('paid')}
            >
              <span>Pagas</span>
              <span className="seg-count">{invoices.filter(i => i.status === 'paid').length}</span>
            </button>
            <button
              type="button"
              className={`seg-btn ${filterStatus === 'overdue' ? 'active' : ''}`}
              onClick={() => setFilterStatus('overdue')}
            >
              <span>Atrasadas</span>
              <span className="seg-count">{invoices.filter(i => i.status === 'overdue').length}</span>
            </button>
          </div>
        </div>

        <div className="toolbar-right">
          <div className="search-field">
            <Search size={14} className="search-field-icon" />
            <input
              type="text"
              placeholder="Buscar por vencimento, valor ou ID..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                type="button"
                className="search-field-clear"
                onClick={() => setSearchQuery('')}
              >
                <X size={13} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="table-card">
        {filteredInvoices.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">
              <FileText size={18} />
            </div>
            <div className="empty-state-title">Nenhuma fatura encontrada</div>
            <div className="empty-state-desc">
              Não existem cobranças correspondentes aos filtros aplicados.
            </div>
          </div>
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Vencimento</th>
                  <th>Referência</th>
                  <th>Valor</th>
                  <th>Status</th>
                  <th>Data de Quitação</th>
                  <th style={{ textAlign: 'right' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredInvoices.map(inv => {
                  const dateObj = new Date(inv.due_date);
                  return (
                    <tr
                      key={inv.id}
                      style={{ cursor: 'pointer' }}
                      onClick={() => setSelectedInvoice(inv)}
                    >
                      <td className="tabular-nums">
                        <span className="cell-primary">
                          {dateObj.toLocaleDateString('pt-BR')}
                        </span>
                      </td>

                      <td>
                        <span className="font-mono" style={{ color: 'var(--text-tertiary)' }}>
                          #{inv.id.slice(0, 8)}
                        </span>
                      </td>

                      <td className="tabular-nums" style={{ fontWeight: 600 }}>
                        {formatBRL(inv.amount)}
                      </td>

                      <td>{renderStatusBadge(inv.status)}</td>

                      <td className="tabular-nums" style={{ color: 'var(--text-secondary)' }}>
                        {inv.paid_date
                          ? new Date(inv.paid_date).toLocaleDateString('pt-BR')
                          : '—'}
                      </td>

                      <td style={{ textAlign: 'right' }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'inline-flex', gap: '6px', justifyContent: 'flex-end' }}>
                          {inv.invoice_url && (
                            <a
                              href={inv.invoice_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="btn btn-ghost btn-sm"
                            >
                              <ExternalLink size={12} />
                              <span>PDF</span>
                            </a>
                          )}
                          <button
                            type="button"
                            className={`btn btn-sm ${inv.status === 'paid' ? 'btn-secondary' : 'btn-primary'}`}
                            onClick={() => setSelectedInvoice(inv)}
                          >
                            <CreditCard size={12} />
                            <span>{inv.status === 'paid' ? 'Recibo' : 'Pagar PIX'}</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Invoice Details & PIX Modal */}
      {selectedInvoice && (
        <div className="modal-overlay" onClick={() => setSelectedInvoice(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h2 className="modal-title">Fatura #{selectedInvoice.id.slice(0, 8)}</h2>
                <p className="modal-subtitle">
                  Vencimento em {new Date(selectedInvoice.due_date).toLocaleDateString('pt-BR')}
                </p>
              </div>
              <button
                type="button"
                className="icon-btn"
                onClick={() => setSelectedInvoice(null)}
              >
                <X size={16} />
              </button>
            </div>

            <div className="modal-body">
              <div
                className="form-section"
                style={{ alignItems: 'center', textAlign: 'center', padding: '20px' }}
              >
                <span className="kpi-label">Valor Total</span>
                <div className="kpi-value" style={{ fontSize: '28px' }}>
                  {formatBRL(selectedInvoice.amount)}
                </div>
                <div style={{ marginTop: '4px' }}>
                  {renderStatusBadge(selectedInvoice.status)}
                </div>
              </div>

              {selectedInvoice.status !== 'paid' ? (
                <div className="form-section">
                  <div className="form-section-header">
                    <span className="form-section-title">
                      <CreditCard size={14} />
                      <span>Pagamento via PIX Copia e Cola</span>
                    </span>
                  </div>
                  <p className="input-hint">
                    Copie o código abaixo no aplicativo do seu banco para compensação imediata:
                  </p>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input
                      type="text"
                      readOnly
                      className="input-field font-mono"
                      value="00020126580014br.gov.bcb.pix0136Elevate@midiasindoor.com.br..."
                      style={{ flex: 1, fontSize: '11.5px', color: 'var(--text-secondary)' }}
                    />
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={handleCopyPix}
                    >
                      {copiedPix ? <Check size={13} style={{ color: 'var(--success)' }} /> : <Copy size={13} />}
                      <span>{copiedPix ? 'Copiado' : 'Copiar'}</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="notice-bar" style={{ marginBottom: 0 }}>
                  <CheckCircle2 size={15} style={{ color: 'var(--success)' }} />
                  <span>
                    Fatura liquidada em{' '}
                    {new Date(selectedInvoice.paid_date || selectedInvoice.due_date).toLocaleDateString('pt-BR')}.
                  </span>
                </div>
              )}
            </div>

            <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
              {selectedInvoice.invoice_url ? (
                <a
                  href={selectedInvoice.invoice_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-secondary btn-sm"
                >
                  <FileText size={13} />
                  <span>Abrir Boleto PDF</span>
                </a>
              ) : (
                <span className="input-hint">PDF indisponível</span>
              )}
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setSelectedInvoice(null)}
              >
                Concluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

