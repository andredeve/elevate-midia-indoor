import { useEffect, useState, useMemo, type FormEvent } from 'react';
import { supabase } from '../lib/supabase';
import {
  DollarSign,
  Plus,
  X,
  Trash2,
  Edit2,
  Search,
  CheckCircle2,
  Clock,
  Receipt
} from 'lucide-react';
import { useAuthStore } from '../stores/authStore';

interface Invoice {
  id: string;
  advertiser_id: string;
  amount: number;
  status: string;
  due_date: string;
  created_at: string;
  org_id: string;
  advertisers?: {
    company_name?: string;
    users?: {
      email: string;
    };
  };
}

interface AdvertiserOption {
  id: string;
  company_name: string;
  users?: { email: string };
}

const formatBRL = (val: number) =>
  val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function Billing() {
  const { user } = useAuthStore();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [advertisers, setAdvertisers] = useState<AdvertiserOption[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'paid'>('all');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);

  // Form State
  const [advertiserId, setAdvertiserId] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [status, setStatus] = useState('pending');

  const loadData = async () => {
    setLoading(true);

    // Carregar faturas e anunciantes ao mesmo tempo
    const [invRes, advRes] = await Promise.all([
      supabase
        .from('invoices')
        .select('*, advertisers(company_name, users(email))')
        .order('created_at', { ascending: false }),
      supabase
        .from('advertisers')
        .select('id, company_name, users(email)')
    ]);

    if (invRes.data) {
      setInvoices(invRes.data as Invoice[]);
    }
    if (advRes.data) {
      setAdvertisers(advRes.data as AdvertiserOption[]);
    }

    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenModal = (invoice?: Invoice) => {
    setErrorMsg('');
    if (invoice) {
      setEditingInvoice(invoice);
      setAdvertiserId(invoice.advertiser_id);
      setAmount(invoice.amount.toString());
      setDueDate(invoice.due_date ? invoice.due_date.split('T')[0] : '');
      setStatus(invoice.status);
    } else {
      setEditingInvoice(null);
      setAdvertiserId('');
      setAmount('');
      setDueDate('');
      setStatus('pending');
    }
    setIsModalOpen(true);
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    if (!advertiserId) {
      setErrorMsg('Por favor, selecione um anunciante.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');

    try {
      const { data: adminData } = await supabase
        .from('users')
        .select('org_id')
        .eq('id', user?.id)
        .single();

      if (!adminData?.org_id) throw new Error('Não foi possível identificar a organização (org_id).');

      const invoiceData = {
        advertiser_id: advertiserId,
        amount: parseFloat(amount),
        due_date: dueDate || null,
        status: status,
        org_id: adminData.org_id
      };

      if (editingInvoice) {
        const { error } = await supabase
          .from('invoices')
          .update(invoiceData)
          .eq('id', editingInvoice.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('invoices')
          .insert([invoiceData]);

        if (error) throw error;
      }

      setIsModalOpen(false);
      loadData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao salvar a fatura.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta fatura?')) return;
    const { error } = await supabase.from('invoices').delete().eq('id', id);
    if (error) {
      alert('Erro ao excluir: ' + error.message);
    } else {
      loadData();
    }
  };

  const metrics = useMemo(() => {
    const totalBilled = invoices.reduce((acc, inv) => acc + Number(inv.amount || 0), 0);
    const paidList = invoices.filter(inv => inv.status === 'paid');
    const pendingList = invoices.filter(inv => inv.status !== 'paid');
    const paidSum = paidList.reduce((acc, inv) => acc + Number(inv.amount || 0), 0);
    const pendingSum = pendingList.reduce((acc, inv) => acc + Number(inv.amount || 0), 0);

    return {
      totalBilled,
      paidSum,
      pendingSum,
      paidCount: paidList.length,
      pendingCount: pendingList.length
    };
  }, [invoices]);

  const filteredInvoices = useMemo(() => {
    return invoices.filter(inv => {
      if (statusFilter === 'paid' && inv.status !== 'paid') return false;
      if (statusFilter === 'pending' && inv.status === 'paid') return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const company = inv.advertisers?.company_name?.toLowerCase() || '';
        const email = inv.advertisers?.users?.email?.toLowerCase() || '';
        const val = Number(inv.amount || 0).toFixed(2);
        return company.includes(q) || email.includes(q) || val.includes(q);
      }
      return true;
    });
  }, [invoices, statusFilter, searchQuery]);

  return (
    <div className="page-shell fade-up">
      <div className="page-header">
        <div className="page-title-group">
          <h1 className="page-title">Faturamento</h1>
          <p className="page-subtitle">
            Controle cobranças, vencimentos e conciliação de faturas das contas anunciantes.
          </p>
        </div>

        <div className="page-actions">
          <button type="button" className="btn btn-primary" onClick={() => handleOpenModal()}>
            <Plus size={15} />
            <span>Nova Fatura</span>
          </button>
        </div>
      </div>

      {/* Financial KPIs */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-label">Volume Faturado</span>
            <span className="kpi-icon"><DollarSign size={15} /></span>
          </div>
          <div className="kpi-value">{formatBRL(metrics.totalBilled)}</div>
          <div className="kpi-meta">{invoices.length} fatura(s) emitida(s)</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-label">Receita Confirmada</span>
            <span className="kpi-icon"><CheckCircle2 size={15} /></span>
          </div>
          <div className="kpi-value">{formatBRL(metrics.paidSum)}</div>
          <div className="kpi-meta">
            <span className="status-dot online" />
            <span>{metrics.paidCount} fatura(s) liquidada(s)</span>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-label">Em Aberto</span>
            <span className="kpi-icon"><Clock size={15} /></span>
          </div>
          <div className="kpi-value">{formatBRL(metrics.pendingSum)}</div>
          <div className="kpi-meta">
            <span className={`status-dot ${metrics.pendingCount > 0 ? 'warning' : 'neutral'}`} />
            <span>{metrics.pendingCount} fatura(s) aguardando pagamento</span>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="toolbar">
        <div className="toolbar-left">
          <div className="segmented-control">
            <button
              type="button"
              className={`seg-btn ${statusFilter === 'all' ? 'active' : ''}`}
              onClick={() => setStatusFilter('all')}
            >
              <span>Todas</span>
              <span className="seg-count">{invoices.length}</span>
            </button>
            <button
              type="button"
              className={`seg-btn ${statusFilter === 'pending' ? 'active' : ''}`}
              onClick={() => setStatusFilter('pending')}
            >
              <span>Pendentes</span>
              <span className="seg-count">{metrics.pendingCount}</span>
            </button>
            <button
              type="button"
              className={`seg-btn ${statusFilter === 'paid' ? 'active' : ''}`}
              onClick={() => setStatusFilter('paid')}
            >
              <span>Pagas</span>
              <span className="seg-count">{metrics.paidCount}</span>
            </button>
          </div>
        </div>

        <div className="toolbar-right">
          <div className="search-field">
            <Search size={14} className="search-field-icon" />
            <input
              type="text"
              placeholder="Buscar por anunciante, e-mail ou valor..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                type="button"
                className="search-field-clear"
                onClick={() => setSearchQuery('')}
                aria-label="Limpar busca"
              >
                <X size={13} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Invoices Table */}
      <div className="table-card">
        {loading ? (
          <div className="loading-state">
            <div className="loader" />
            <span>Carregando faturas...</span>
          </div>
        ) : filteredInvoices.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">
              <Receipt size={18} />
            </div>
            <div className="empty-state-title">Nenhuma fatura encontrada</div>
            <div className="empty-state-desc">
              {searchQuery || statusFilter !== 'all'
                ? 'Altere os filtros aplicados ou limpe a busca.'
                : 'Emita a primeira fatura para acompanhar recebimentos dos anunciantes.'}
            </div>
          </div>
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Anunciante</th>
                  <th>Referência</th>
                  <th>Vencimento</th>
                  <th>Valor</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredInvoices.map(inv => {
                  const displayName =
                    inv.advertisers?.company_name ||
                    inv.advertisers?.users?.email ||
                    'Anunciante';
                  const initial = displayName.charAt(0).toUpperCase();
                  const isPaid = inv.status === 'paid';

                  return (
                    <tr key={inv.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div className="entity-avatar">{initial}</div>
                          <div>
                            <div className="cell-primary">{displayName}</div>
                            {inv.advertisers?.company_name && inv.advertisers?.users?.email && (
                              <div className="cell-secondary">{inv.advertisers.users.email}</div>
                            )}
                          </div>
                        </div>
                      </td>

                      <td>
                        <span className="font-mono" style={{ color: 'var(--text-tertiary)' }}>
                          #{inv.id.slice(0, 8)}
                        </span>
                      </td>

                      <td className="tabular-nums">
                        {inv.due_date ? new Date(inv.due_date).toLocaleDateString('pt-BR') : '—'}
                      </td>

                      <td className="tabular-nums" style={{ fontWeight: 600 }}>
                        {formatBRL(Number(inv.amount || 0))}
                      </td>

                      <td>
                        {isPaid ? (
                          <span className="badge badge-success">
                            <span className="status-dot online" />
                            Pago
                          </span>
                        ) : (
                          <span className="badge badge-warning">
                            <span className="status-dot warning" />
                            Pendente
                          </span>
                        )}
                      </td>

                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '4px', justifyContent: 'flex-end' }}>
                          <button
                            type="button"
                            className="icon-btn"
                            onClick={() => handleOpenModal(inv)}
                            title="Editar fatura"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            type="button"
                            className="icon-btn danger"
                            onClick={() => handleDelete(inv.id)}
                            title="Excluir fatura"
                          >
                            <Trash2 size={14} />
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

      {/* Modal Criar / Editar Fatura */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h2 className="modal-title">
                  {editingInvoice ? 'Editar Fatura' : 'Nova Fatura'}
                </h2>
                <p className="modal-subtitle">
                  {editingInvoice
                    ? `Atualizando cobrança #${editingInvoice.id.slice(0, 8)}`
                    : 'Registre uma nova cobrança vinculada a um anunciante.'}
                </p>
              </div>
              <button type="button" className="icon-btn" onClick={() => setIsModalOpen(false)}>
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSave}>
              <div className="modal-body">
                {errorMsg && <div className="alert-error">{errorMsg}</div>}

                <div className="input-group">
                  <label className="input-label">Anunciante</label>
                  <select
                    className="select-field"
                    value={advertiserId}
                    onChange={e => setAdvertiserId(e.target.value)}
                    required
                  >
                    <option value="">Selecione um anunciante...</option>
                    {advertisers.map(adv => (
                      <option key={adv.id} value={adv.id}>
                        {adv.company_name || adv.users?.email}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-grid-2">
                  <div className="input-group">
                    <label className="input-label">Valor (R$)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className="input-field tabular-nums"
                      placeholder="0.00"
                      value={amount}
                      onChange={e => setAmount(e.target.value)}
                      required
                    />
                  </div>

                  <div className="input-group">
                    <label className="input-label">Data de Vencimento</label>
                    <input
                      type="date"
                      className="input-field"
                      value={dueDate}
                      onChange={e => setDueDate(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="input-group">
                  <label className="input-label">Status de Liquidação</label>
                  <select
                    className="select-field"
                    value={status}
                    onChange={e => setStatus(e.target.value)}
                  >
                    <option value="pending">Pendente</option>
                    <option value="paid">Pago</option>
                  </select>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setIsModalOpen(false)}
                >
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <div className="loader" />
                  ) : editingInvoice ? (
                    'Salvar Alterações'
                  ) : (
                    'Gerar Fatura'
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
