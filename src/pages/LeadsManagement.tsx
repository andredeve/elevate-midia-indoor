import { useEffect, useState, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import {
  Users,
  Search,
  Tv,
  Clock,
  Copy,
  Check,
  Trash2,
  RefreshCw,
  MessageSquare,
  ShieldCheck,
  X
} from 'lucide-react';
import './LeadsManagement.css';

export interface LeadItem {
  id?: string;
  name: string;
  email: string;
  phone: string;
  gymName: string;
  tvCount: '1-3' | '4-10' | '10+' | string;
  vip_code?: string;
  status?: string;
  created_at?: string;
}

export default function LeadsManagement() {
  const [leads, setLeads] = useState<LeadItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const fetchLeads = async () => {
    setLoading(true);
    let remoteLeads: LeadItem[] = [];
    let localLeads: LeadItem[] = [];

    // 1. Fetch from Supabase if table exists
    try {
      const { data, error } = await (supabase as any)
        .from('leads')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && data) {
        remoteLeads = data;
      }
    } catch {
      // Tabela pode não estar criada ainda no banco remoto
    }

    // 2. Fetch from localStorage fallback (@elevate_leads_capture / @gymplay_leads_capture)
    try {
      const raw = localStorage.getItem('@elevate_leads_capture') || localStorage.getItem('@gymplay_leads_capture');
      if (raw) {
        localLeads = JSON.parse(raw);
      }
    } catch {}

    // Merge without duplicates (by email or vip_code)
    const mergedMap = new Map<string, LeadItem>();

    remoteLeads.forEach(item => {
      const key = item.vip_code || item.email || item.name;
      mergedMap.set(key, item);
    });

    localLeads.forEach(item => {
      const key = item.vip_code || item.email || item.name;
      if (!mergedMap.has(key)) {
        mergedMap.set(key, item);
      }
    });

    const allLeads = Array.from(mergedMap.values()).sort((a, b) => {
      const dateA = new Date(a.created_at || 0).getTime();
      const dateB = new Date(b.created_at || 0).getTime();
      return dateB - dateA;
    });

    setLeads(allLeads);
    setLoading(false);
  };

  useEffect(() => {
    fetchLeads();
  }, []);

  const handleCopyCode = (code?: string) => {
    if (!code) return;
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const handleStatusChange = async (lead: LeadItem, newStatus: string) => {
    // Atualiza estado local de imediato
    const updated = leads.map(item => {
      if ((lead.id && item.id === lead.id) || item.vip_code === lead.vip_code) {
        return { ...item, status: newStatus };
      }
      return item;
    });
    setLeads(updated);

    // Atualiza no localStorage
    try {
      localStorage.setItem('@elevate_leads_capture', JSON.stringify(updated));
    } catch {}

    // Atualiza no Supabase se possuir ID ou vip_code
    try {
      if (lead.id) {
        await (supabase as any)
          .from('leads')
          .update({ status: newStatus })
          .eq('id', lead.id);
      } else if (lead.vip_code) {
        await (supabase as any)
          .from('leads')
          .update({ status: newStatus })
          .eq('vip_code', lead.vip_code);
      }
    } catch {}
  };

  const handleDelete = async (lead: LeadItem) => {
    if (!window.confirm(`Deseja excluir a solicitação de ${lead.name} (${lead.gymName})?`)) return;

    const filtered = leads.filter(item => {
      if (lead.id && item.id === lead.id) return false;
      if (lead.vip_code && item.vip_code === lead.vip_code) return false;
      if (item.email === lead.email && item.name === lead.name) return false;
      return true;
    });

    setLeads(filtered);

    try {
      localStorage.setItem('@elevate_leads_capture', JSON.stringify(filtered));
    } catch {}

    try {
      if (lead.id) {
        await (supabase as any).from('leads').delete().eq('id', lead.id);
      } else if (lead.vip_code) {
        await (supabase as any).from('leads').delete().eq('vip_code', lead.vip_code);
      }
    } catch {}
  };

  const getWhatsAppLink = (lead: LeadItem) => {
    const phoneNum = lead.phone.replace(/\D/g, '');
    const msg = encodeURIComponent(
      `Olá ${lead.name}! Aqui é da equipe Elevate Mídia Indoor. Recebemos sua solicitação VIP (${lead.vip_code || '3 Meses Grátis'}) para "${lead.gymName}" (${lead.tvCount} TVs) e viemos liberar seu acesso!`
    );
    return `https://wa.me/55${phoneNum}?text=${msg}`;
  };

  const filteredLeads = useMemo(() => {
    return leads.filter(item => {
      const q = searchTerm.toLowerCase();
      const matchSearch =
        item.name?.toLowerCase().includes(q) ||
        item.email?.toLowerCase().includes(q) ||
        item.gymName?.toLowerCase().includes(q) ||
        item.phone?.includes(searchTerm) ||
        item.vip_code?.toLowerCase().includes(q);

      const matchStatus =
        statusFilter === 'all' ||
        item.status === statusFilter ||
        (statusFilter === 'pending_onboarding' && !item.status);

      return matchSearch && matchStatus;
    });
  }, [leads, searchTerm, statusFilter]);

  // KPIs
  const totalLeads = leads.length;
  const totalPending = leads.filter(l => !l.status || l.status === 'pending_onboarding').length;
  const totalInProgress = leads.filter(l => l.status === 'in_progress').length;
  const totalActivated = leads.filter(l => l.status === 'activated').length;
  const totalTvsEstimate = useMemo(() => {
    return leads.reduce((acc, curr) => {
      if (curr.tvCount === '4-10') return acc + 7;
      if (curr.tvCount === '10+') return acc + 12;
      return acc + 2; // '1-3'
    }, 0);
  }, [leads]);

  return (
    <div className="page-shell fade-up">
      <div className="page-header">
        <div className="page-title-group">
          <div className="page-title-row">
            <h1 className="page-title">Solicitações VIP</h1>
            <span className="badge badge-neutral">Campanha Opt-in</span>
          </div>
          <p className="page-subtitle">
            Gerencie solicitações de estabelecimentos captadas pela página de degustação (/teste-gratis).
          </p>
        </div>

        <div className="page-actions">
          <button
            type="button"
            onClick={fetchLeads}
            className="btn btn-secondary"
            disabled={loading}
          >
            <RefreshCw size={14} className={loading ? 'spin' : ''} />
            <span>Atualizar</span>
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-label">Total de Solicitações</span>
            <span className="kpi-icon"><Users size={15} /></span>
          </div>
          <div className="kpi-value">{totalLeads}</div>
          <div className="kpi-meta">Leads captados no funil VIP</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-label">Pendente Contato</span>
            <span className="kpi-icon"><Clock size={15} /></span>
          </div>
          <div className="kpi-value">{totalPending}</div>
          <div className="kpi-meta">
            <span className={`status-dot ${totalPending > 0 ? 'warning' : 'neutral'}`} />
            <span>Aguardando abordagem comercial</span>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-label">Licenças Ativadas</span>
            <span className="kpi-icon"><ShieldCheck size={15} /></span>
          </div>
          <div className="kpi-value">{totalActivated}</div>
          <div className="kpi-meta">
            <span className="status-dot online" />
            <span>Convertidas em unidades ativas</span>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-label">Potencial de Telas</span>
            <span className="kpi-icon"><Tv size={15} /></span>
          </div>
          <div className="kpi-value">~{totalTvsEstimate}</div>
          <div className="kpi-meta">Estimativa de terminais nas unidades</div>
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
              <span>Todos</span>
              <span className="seg-count">{totalLeads}</span>
            </button>
            <button
              type="button"
              className={`seg-btn ${statusFilter === 'pending_onboarding' ? 'active' : ''}`}
              onClick={() => setStatusFilter('pending_onboarding')}
            >
              <span>Pendentes</span>
              <span className="seg-count">{totalPending}</span>
            </button>
            <button
              type="button"
              className={`seg-btn ${statusFilter === 'in_progress' ? 'active' : ''}`}
              onClick={() => setStatusFilter('in_progress')}
            >
              <span>Em Atendimento</span>
              <span className="seg-count">{totalInProgress}</span>
            </button>
            <button
              type="button"
              className={`seg-btn ${statusFilter === 'activated' ? 'active' : ''}`}
              onClick={() => setStatusFilter('activated')}
            >
              <span>Ativados</span>
              <span className="seg-count">{totalActivated}</span>
            </button>
          </div>
        </div>

        <div className="toolbar-right">
          <div className="search-field">
            <Search size={14} className="search-field-icon" />
            <input
              type="text"
              placeholder="Buscar por estabelecimento, responsável, e-mail ou código..."
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

      {/* Data Table */}
      <div className="table-card">
        {loading ? (
          <div className="loading-state">
            <div className="loader" />
            <span>Carregando solicitações...</span>
          </div>
        ) : filteredLeads.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">
              <Users size={18} />
            </div>
            <div className="empty-state-title">Nenhuma solicitação encontrada</div>
            <div className="empty-state-desc">
              {searchTerm || statusFilter !== 'all'
                ? 'Nenhum registro corresponde aos filtros aplicados.'
                : 'Novos cadastros realizados na página de teste grátis aparecerão aqui.'}
            </div>
          </div>
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Código VIP</th>
                  <th>Estabelecimento</th>
                  <th>Responsável</th>
                  <th>Contato</th>
                  <th>Porte</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredLeads.map((lead, idx) => {
                  const initial = (lead.gymName || 'E').charAt(0).toUpperCase();
                  const codeStr = lead.vip_code || 'VIP-ELV-0000';
                  return (
                    <tr key={lead.id || lead.vip_code || idx}>
                      <td className="tabular-nums">
                        <div className="cell-primary">
                          {lead.created_at
                            ? new Date(lead.created_at).toLocaleDateString('pt-BR')
                            : 'Hoje'}
                        </div>
                        <div className="cell-secondary">
                          {lead.created_at
                            ? new Date(lead.created_at).toLocaleTimeString('pt-BR', {
                                hour: '2-digit',
                                minute: '2-digit'
                              })
                            : '—'}
                        </div>
                      </td>

                      <td>
                        <button
                          type="button"
                          className="code-chip"
                          onClick={() => handleCopyCode(lead.vip_code)}
                          title="Copiar código VIP"
                        >
                          <span>{codeStr}</span>
                          {copiedCode === lead.vip_code ? (
                            <Check size={12} style={{ color: 'var(--success)' }} />
                          ) : (
                            <Copy size={12} style={{ color: 'var(--text-tertiary)' }} />
                          )}
                        </button>
                      </td>

                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div className="entity-avatar">{initial}</div>
                          <div className="cell-primary">{lead.gymName}</div>
                        </div>
                      </td>

                      <td>
                        <span className="cell-primary">{lead.name}</span>
                      </td>

                      <td>
                        <div className="cell-primary tabular-nums">{lead.phone}</div>
                        <div className="cell-secondary">{lead.email}</div>
                      </td>

                      <td>
                        <span className="badge badge-neutral">
                          {lead.tvCount || '1-3'} TVs
                        </span>
                      </td>

                      <td>
                        <select
                          className={`lead-status-select ${lead.status || 'pending_onboarding'}`}
                          value={lead.status || 'pending_onboarding'}
                          onChange={e => handleStatusChange(lead, e.target.value)}
                        >
                          <option value="pending_onboarding">Pendente</option>
                          <option value="in_progress">Em Atendimento</option>
                          <option value="activated">Ativado (VIP)</option>
                          <option value="rejected">Descartado</option>
                        </select>
                      </td>

                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          <a
                            href={getWhatsAppLink(lead)}
                            target="_blank"
                            rel="noreferrer"
                            className="btn btn-secondary btn-sm"
                            title="Iniciar conversa no WhatsApp"
                          >
                            <MessageSquare size={12} />
                            <span>WhatsApp</span>
                          </a>

                          <button
                            type="button"
                            className="icon-btn danger"
                            onClick={() => handleDelete(lead)}
                            title="Excluir solicitação"
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
    </div>
  );
}
