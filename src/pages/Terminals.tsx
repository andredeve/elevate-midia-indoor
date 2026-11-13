import { useEffect, useState, useMemo, type FormEvent } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';
import { isTerminalOnline } from '../utils/terminalStatus';
import {
  MonitorPlay,
  Clock,
  Edit2,
  Trash2,
  X,
  Plus,
  RefreshCw,
  Search,
  Wifi,
  WifiOff,
  Link2,
  Unlink,
  Building2
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Terminal {
  id: string;
  name: string;
  location: string;
  status: string;
  is_active: boolean;
  last_sync_at: string | null;
  org_id: string;
  partner_id?: string | null;
  partners?: {
    establishment_name?: string;
    users?: {
      email?: string;
    };
  };
  device_info?: any;
}

interface PartnerOption {
  id: string;
  establishment_name?: string;
  users?: { email?: string };
}

export default function Terminals() {
  const [terminals, setTerminals] = useState<Terminal[]>([]);
  const [partners, setPartners] = useState<PartnerOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'online' | 'offline'>('all');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTerminal, setEditingTerminal] = useState<Terminal | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    location: '',
    partner_id: '',
    show_info_bar: true,
    show_partner_badge: true,
    establishment_name: '',
    advertisement_text: ''
  });
  const [isSaving, setIsSaving] = useState(false);
  const [nowTick, setNowTick] = useState(() => Date.now());
  const { user } = useAuthStore();

  const loadTerminals = async () => {
    setLoading(true);
    const { data: userData } = await supabase
      .from('users')
      .select('org_id')
      .eq('id', user?.id)
      .single();

    if (userData?.org_id) {
      const [termRes, partRes] = await Promise.all([
        supabase
          .from('terminals')
          .select('*, partners(establishment_name, users(email))')
          .eq('org_id', userData.org_id)
          .order('created_at', { ascending: false }),
        supabase
          .from('partners')
          .select('id, establishment_name, users(email)')
          .order('establishment_name', { ascending: true })
      ]);

      if (termRes.data && !termRes.error) {
        const list = termRes.data as Terminal[];
        setTerminals(list);
      }
      if (partRes.data) {
        setPartners(partRes.data as PartnerOption[]);
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    loadTerminals();

    const subscription = supabase
      .channel('terminals-status')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'terminals' }, (payload: any) => {
        setNowTick(Date.now());
        if (payload.eventType === 'UPDATE' && payload.new) {
          // Atualiza em memória preservando os dados aninhados de parceiro
          setTerminals((prev) =>
            prev.map((t) => (t.id === payload.new.id ? { ...t, ...payload.new, partners: t.partners } : t))
          );
        } else {
          loadTerminals();
        }
      })
      .subscribe();

    // Reavalia periodicamente o timeout de heartbeat (a cada 10s) em memória para a UI
    const tickInterval = setInterval(() => {
      setNowTick(Date.now());
    }, 10000);

    return () => {
      clearInterval(tickInterval);
      supabase.removeChannel(subscription);
    };
  }, [user]);

  const stats = useMemo(() => {
    const total = terminals.length;
    const online = terminals.filter((t) => isTerminalOnline(t, nowTick)).length;
    const offline = total - online;
    const pinned = terminals.filter((t) => Boolean(t.device_info?.pinned_at)).length;
    return { total, online, offline, pinned };
  }, [terminals, nowTick]);

  const filteredTerminals = useMemo(() => {
    return terminals.filter((t) => {
      const online = isTerminalOnline(t, nowTick);
      if (statusFilter === 'online' && !online) return false;
      if (statusFilter === 'offline' && online) return false;
      const q = searchQuery.toLowerCase().trim();
      if (!q) return true;
      const partnerName =
        t.partners?.establishment_name || t.partners?.users?.email || '';
      return (
        t.name?.toLowerCase().includes(q) ||
        t.location?.toLowerCase().includes(q) ||
        partnerName.toLowerCase().includes(q)
      );
    });
  }, [terminals, statusFilter, searchQuery, nowTick]);

  const handleOpenModal = (terminal?: Terminal) => {
    if (terminal) {
      setEditingTerminal(terminal);
      const devInfo = terminal.device_info || {};
      setFormData({
        name: terminal.name,
        location: terminal.location || '',
        partner_id: terminal.partner_id || '',
        show_info_bar: devInfo.show_info_bar !== false,
        show_partner_badge: devInfo.show_partner_badge !== false,
        establishment_name: devInfo.establishment_name || '',
        advertisement_text: devInfo.advertisement_text || ''
      });
    } else {
      setEditingTerminal(null);
      setFormData({
        name: '',
        location: '',
        partner_id: '',
        show_info_bar: true,
        show_partner_badge: true,
        establishment_name: '',
        advertisement_text: ''
      });
    }
    setIsModalOpen(true);
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      const { data: userData } = await supabase
        .from('users')
        .select('org_id')
        .eq('id', user?.id)
        .single();

      if (!userData?.org_id) throw new Error('Organização não encontrada');

      const updatedDeviceInfo = editingTerminal
        ? {
            ...(editingTerminal.device_info || {}),
            show_info_bar: formData.show_info_bar,
            show_partner_badge: formData.show_partner_badge,
            establishment_name: formData.establishment_name,
            advertisement_text: formData.advertisement_text
          }
        : {
            show_info_bar: formData.show_info_bar,
            show_partner_badge: formData.show_partner_badge,
            establishment_name: formData.establishment_name,
            advertisement_text: formData.advertisement_text
          };

      if (editingTerminal) {
        const { error } = await supabase
          .from('terminals')
          .update({
            name: formData.name,
            location: formData.location,
            partner_id: formData.partner_id || null,
            device_info: updatedDeviceInfo
          })
          .eq('id', editingTerminal.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('terminals').insert([
          {
            name: formData.name,
            location: formData.location,
            org_id: userData.org_id,
            partner_id: formData.partner_id || null,
            status: 'offline',
            is_active: true,
            device_info: updatedDeviceInfo
          }
        ]);
        if (error) throw error;
      }

      setIsModalOpen(false);
      loadTerminals();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Erro ao salvar terminal');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este terminal?')) return;

    const { error } = await supabase.from('terminals').delete().eq('id', id);
    if (error) {
      alert('Erro ao excluir terminal');
    } else {
      loadTerminals();
    }
  };

  const handleUnlink = async (terminal: Terminal) => {
    if (
      !confirm(
        `Tem certeza que deseja desvincular o dispositivo de "${terminal.name}"? O app voltará para a tela inicial.`
      )
    )
      return;

    const currentDeviceInfo = terminal.device_info || {};

    const { error } = await supabase
      .from('terminals')
      .update({
        device_info: {
          ...currentDeviceInfo,
          force_unlink: true,
          pinned_at: null
        }
      })
      .eq('id', terminal.id);

    if (error) {
      alert('Erro ao desvincular terminal: ' + error.message);
    } else {
      loadTerminals();
    }
  };

  const handleReboot = async (terminal: Terminal) => {
    if (
      !confirm(
        `Tem certeza que deseja forçar a reinicialização da TV "${terminal.name}"?`
      )
    )
      return;

    const currentDeviceInfo = terminal.device_info || {};

    const { error } = await supabase
      .from('terminals')
      .update({
        device_info: {
          ...currentDeviceInfo,
          force_reboot: true
        }
      })
      .eq('id', terminal.id);

    if (error) {
      alert('Erro ao enviar comando de reinicialização: ' + error.message);
    } else {
      try {
        await supabase.from('terminal_logs').insert({
          terminal_id: terminal.id,
          event_type: 'command_reboot',
          metadata: { timestamp: new Date().toISOString(), action: 'force_reboot' }
        });
      } catch (logErr) {
        console.error('Erro ao registrar log de reinicialização:', logErr);
      }
      alert(
        `Comando de reinicialização enviado para "${terminal.name}". A TV reiniciará na próxima sincronização.`
      );
      loadTerminals();
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div className="page-title-group">
          <h1 className="page-title">Terminais</h1>
          <p className="page-subtitle">
            Gerencie telas conectadas, status de transmissão, pareamento de hardware e letreiros.
          </p>
        </div>

        <div className="page-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={loadTerminals}
            disabled={loading}
          >
            <RefreshCw size={14} className={loading ? 'spin' : ''} />
            <span>Atualizar</span>
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => handleOpenModal()}
          >
            <Plus size={15} strokeWidth={2.2} />
            <span>Novo Terminal</span>
          </button>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-label">Total de Telas</span>
            <span className="kpi-icon">
              <MonitorPlay size={15} strokeWidth={1.75} />
            </span>
          </div>
          <div className="kpi-value">{loading ? '—' : stats.total}</div>
          <div className="kpi-meta">Pontos de exibição cadastrados</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-label">Transmitindo (Online)</span>
            <span className="kpi-icon">
              <Wifi size={15} strokeWidth={1.75} />
            </span>
          </div>
          <div className="kpi-value" style={{ color: stats.online > 0 ? 'var(--success)' : undefined }}>
            {loading ? '—' : stats.online}
          </div>
          <div className="kpi-meta">Conexão ativa com o servidor</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-label">Desconectados (Offline)</span>
            <span className="kpi-icon">
              <WifiOff size={15} strokeWidth={1.75} />
            </span>
          </div>
          <div className="kpi-value">{loading ? '—' : stats.offline}</div>
          <div className="kpi-meta">Em repouso ou sem sinal</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-label">Dispositivos Pareados</span>
            <span className="kpi-icon">
              <Link2 size={15} strokeWidth={1.75} />
            </span>
          </div>
          <div className="kpi-value">{loading ? '—' : stats.pinned}</div>
          <div className="kpi-meta">Hardware fixado à licença</div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="toolbar">
        <div className="search-field">
          <Search size={15} className="search-field-icon" />
          <input
            type="text"
            placeholder="Buscar por nome, setor ou unidade..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
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

        <div className="segmented-control">
          <button
            type="button"
            className={`seg-btn ${statusFilter === 'all' ? 'active' : ''}`}
            onClick={() => setStatusFilter('all')}
          >
            Todos <span className="seg-count">{stats.total}</span>
          </button>
          <button
            type="button"
            className={`seg-btn ${statusFilter === 'online' ? 'active' : ''}`}
            onClick={() => setStatusFilter('online')}
          >
            Online <span className="seg-count">{stats.online}</span>
          </button>
          <button
            type="button"
            className={`seg-btn ${statusFilter === 'offline' ? 'active' : ''}`}
            onClick={() => setStatusFilter('offline')}
          >
            Offline <span className="seg-count">{stats.offline}</span>
          </button>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="loading-state">
          <div className="loader" />
          <span>Carregando terminais...</span>
        </div>
      ) : filteredTerminals.length === 0 ? (
        <div className="card empty-state">
          <div className="empty-state-icon">
            <MonitorPlay size={18} />
          </div>
          <div className="empty-state-title">
            {terminals.length === 0
              ? 'Nenhum terminal cadastrado'
              : 'Nenhum terminal encontrado'}
          </div>
          <p className="empty-state-desc">
            {terminals.length === 0
              ? 'Cadastre o primeiro ponto de transmissão para vincular playlists e monitorar o status em tempo real.'
              : 'Ajuste os termos de busca ou altere o filtro de conectividade.'}
          </p>
          {terminals.length === 0 && (
            <button
              type="button"
              className="btn btn-primary"
              style={{ marginTop: 8 }}
              onClick={() => handleOpenModal()}
            >
              <Plus size={15} />
              <span>Novo Terminal</span>
            </button>
          )}
        </div>
      ) : (
        <div
          className="fixed-card-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 300px), 410px))',
            gap: 14
          }}
        >
          {filteredTerminals.map((terminal) => {
            const isOnline = isTerminalOnline(terminal, nowTick);
            const isPinned = Boolean(terminal.device_info?.pinned_at);
            const partnerLabel =
              terminal.partners?.establishment_name ||
              terminal.partners?.users?.email;

            return (
              <div
                key={terminal.id}
                className="card card-interactive"
                style={{
                  padding: 18,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 14
                }}
              >
                {/* Top Row */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    gap: 12
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 11, minWidth: 0 }}>
                    <div className="entity-avatar">
                      <MonitorPlay size={15} strokeWidth={1.75} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <h3
                        style={{
                          fontSize: 14,
                          fontWeight: 600,
                          color: 'var(--text-primary)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis'
                        }}
                        title={terminal.name}
                      >
                        {terminal.name}
                      </h3>
                      <p
                        className="cell-secondary"
                        style={{
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis'
                        }}
                      >
                        {terminal.location || 'Localização não especificada'}
                      </p>
                    </div>
                  </div>

                  <span className={`badge ${isOnline ? 'badge-success' : 'badge-danger'}`}>
                    <span className={`status-dot ${isOnline ? 'online' : 'offline'}`} />
                    {isOnline ? 'Online' : 'Offline'}
                  </span>
                </div>

                {/* Metadata List */}
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 7,
                    padding: '10px 12px',
                    background: 'var(--bg-surface-sub)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--r-md)',
                    fontSize: 12
                  }}
                >
                  <div className="flex items-center justify-between">
                    <span style={{ color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Building2 size={12} />
                      Unidade
                    </span>
                    <span
                      style={{
                        color: partnerLabel ? 'var(--text-primary)' : 'var(--text-tertiary)',
                        fontWeight: partnerLabel ? 500 : 400,
                        maxWidth: 180,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {partnerLabel || 'Rede própria'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span style={{ color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Link2 size={12} />
                      Hardware
                    </span>
                    <span style={{ color: isPinned ? 'var(--text-secondary)' : 'var(--text-tertiary)' }}>
                      {isPinned ? 'Dispositivo vinculado' : 'Sem vínculo ativo'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span style={{ color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Clock size={12} />
                      Sincronização
                    </span>
                    <span className="font-mono" style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>
                      {terminal.last_sync_at
                        ? formatDistanceToNow(new Date(terminal.last_sync_at), {
                            addSuffix: true,
                            locale: ptBR
                          })
                        : 'Nunca'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span style={{ color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <MonitorPlay size={12} />
                      Selo Conteúdo Interno
                    </span>
                    <span
                      style={{
                        color:
                          terminal.device_info?.show_partner_badge !== false
                            ? 'var(--success)'
                            : 'var(--text-tertiary)',
                        fontWeight: 500
                      }}
                    >
                      {terminal.device_info?.show_partner_badge !== false ? 'Ativado' : 'Oculto'}
                    </span>
                  </div>
                </div>

                {/* Footer Controls */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 8,
                    paddingTop: 4
                  }}
                >
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => handleReboot(terminal)}
                      title="Forçar reinicialização remota do app"
                    >
                      <RefreshCw size={12} />
                      <span>Reiniciar</span>
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => handleUnlink(terminal)}
                      title="Desvincular hardware na próxima sincronização"
                    >
                      <Unlink size={12} />
                      <span>Desvincular</span>
                    </button>
                  </div>

                  <div style={{ display: 'flex', gap: 4 }}>
                    <button
                      type="button"
                      className="icon-btn"
                      onClick={() => handleOpenModal(terminal)}
                      title="Configurar terminal"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button
                      type="button"
                      className="icon-btn danger"
                      onClick={() => handleDelete(terminal.id)}
                      title="Excluir terminal"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Criar / Editar Terminal */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal modal-md" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h2 className="modal-title">
                  {editingTerminal ? 'Configurar Terminal' : 'Novo Terminal'}
                </h2>
                <p className="modal-subtitle">
                  Defina identificação, vínculo de unidade e parâmetros da barra informativa.
                </p>
              </div>
              <button
                type="button"
                className="icon-btn"
                onClick={() => setIsModalOpen(false)}
                aria-label="Fechar"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSave}>
              <div className="modal-body">
                <div className="form-grid-2">
                  <div className="input-group">
                    <label className="input-label">Nome do Terminal *</label>
                    <input
                      type="text"
                      className="input-field"
                      placeholder="Ex: Recepção Principal"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                    />
                  </div>

                  <div className="input-group">
                    <label className="input-label">Setor / Localização</label>
                    <input
                      type="text"
                      className="input-field"
                      placeholder="Ex: Salão Principal - Piso 1"
                      value={formData.location}
                      onChange={(e) =>
                        setFormData({ ...formData, location: e.target.value })
                      }
                    />
                  </div>
                </div>

                <div className="input-group">
                  <label className="input-label">Estabelecimento Parceiro (Opcional)</label>
                  <select
                    className="select-field"
                    value={formData.partner_id}
                    onChange={(e) =>
                      setFormData({ ...formData, partner_id: e.target.value })
                    }
                  >
                    <option value="">Rede Própria (Sem vínculo com parceiro)</option>
                    {partners.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.establishment_name || p.users?.email || p.id}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Switch Notificação de Conteúdo Interno do Parceiro */}
                <div
                  className="toggle-row"
                  onClick={() =>
                    setFormData({
                      ...formData,
                      show_partner_badge: !formData.show_partner_badge
                    })
                  }
                >
                  <div>
                    <div className="toggle-label">
                      Notificação de Conteúdo Interno (Mídias do Parceiro)
                    </div>
                    <div className="toggle-desc">
                      Exibe o selo &ldquo;CONTEÚDO INTERNO — Mídia do Parceiro&rdquo; na TV durante a reprodução das mídias exclusivas do estabelecimento
                    </div>
                  </div>
                  <div className={`toggle-track ${formData.show_partner_badge ? 'on' : ''}`}>
                    <div className="toggle-thumb" />
                  </div>
                </div>

                {/* Switch Barra de Informações */}
                <div
                  className="toggle-row"
                  onClick={() =>
                    setFormData({ ...formData, show_info_bar: !formData.show_info_bar })
                  }
                >
                  <div>
                    <div className="toggle-label">Exibir Barra de Informações</div>
                    <div className="toggle-desc">
                      Apresenta relógio, clima e letreiro institucional no rodapé da TV
                    </div>
                  </div>
                  <div className={`toggle-track ${formData.show_info_bar ? 'on' : ''}`}>
                    <div className="toggle-thumb" />
                  </div>
                </div>

                {formData.show_info_bar && (
                  <div className="form-section">
                    <div className="input-group">
                      <label className="input-label">Assinatura da Unidade na TV</label>
                      <input
                        type="text"
                        className="input-field"
                        placeholder="Ex: Unidade Elevate — Centro"
                        value={formData.establishment_name}
                        onChange={(e) =>
                          setFormData({ ...formData, establishment_name: e.target.value })
                        }
                      />
                    </div>

                    <div className="input-group">
                      <label className="input-label">Mensagem do Letreiro (Rodapé)</label>
                      <input
                        type="text"
                        className="input-field"
                        placeholder="Ex: Anuncie sua marca aqui — Fale com a recepção"
                        value={formData.advertisement_text}
                        onChange={(e) =>
                          setFormData({ ...formData, advertisement_text: e.target.value })
                        }
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setIsModalOpen(false)}
                >
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" disabled={isSaving}>
                  {isSaving ? <div className="loader" /> : 'Salvar Terminal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

