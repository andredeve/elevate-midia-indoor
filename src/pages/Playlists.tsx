import { useEffect, useState, useMemo, type FormEvent } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';
import {
  ListVideo,
  Plus,
  Trash2,
  Film,
  Image as ImageIcon,
  MonitorPlay,
  Edit2,
  X,
  Clock,
  Layers
} from 'lucide-react';

export default function Playlists() {
  const [loading, setLoading] = useState(true);
  const [playlists, setPlaylists] = useState<any[]>([]);
  const [terminals, setTerminals] = useState<any[]>([]);
  const [mediaFiles, setMediaFiles] = useState<any[]>([]);

  // States para o form
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [playlistName, setPlaylistName] = useState('');
  const [selectedTerminal, setSelectedTerminal] = useState('');
  const [selectedMedia, setSelectedMedia] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const [mediaDurations, setMediaDurations] = useState<Record<string, number>>({});
  const { user } = useAuthStore();

  const loadData = async () => {
    setLoading(true);
    try {
      const { data: userData } = await supabase
        .from('users')
        .select('org_id')
        .eq('id', user?.id)
        .single();
      if (!userData) return;

      const { data: tData } = await supabase
        .from('terminals')
        .select('*')
        .eq('org_id', userData.org_id);

      let pData: any[] = [];
      if (tData && tData.length > 0) {
        const terminalIds = tData.map((t: any) => t.id);
        const { data } = await supabase
          .from('playlists')
          .select('*, terminals(name), playlist_items(media_id, order, duration_override, media:media_files(partner_id))')
          .in('terminal_id', terminalIds)
          .order('created_at', { ascending: false });
        pData = (data || []).map((pl: any) => ({
          ...pl,
          playlist_items: (pl.playlist_items || []).filter((pi: any) => !pi.media?.partner_id)
        }));
      }

      const { data: mData } = await supabase
        .from('media_files')
        .select('*')
        .eq('org_id', userData.org_id)
        .is('partner_id', null);

      setPlaylists(pData);
      setTerminals(tData || []);
      setMediaFiles(mData || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) loadData();
  }, [user]);

  const totalLoopSeconds = useMemo(() => {
    return selectedMedia.reduce((acc, id) => acc + (mediaDurations[id] || 15), 0);
  }, [selectedMedia, mediaDurations]);

  const activePlaylistsCount = useMemo(() => {
    return playlists.filter((p) => p.is_active).length;
  }, [playlists]);

  const handleEdit = (playlist: any) => {
    setEditingId(playlist.id);
    setPlaylistName(playlist.name);
    setSelectedTerminal(playlist.terminal_id);

    const mediaIds: string[] = [];
    const durations: Record<string, number> = {};

    [...(playlist.playlist_items || [])]
      .sort((a, b) => a.order - b.order)
      .forEach((item) => {
        mediaIds.push(item.media_id);
        durations[item.media_id] = item.duration_override || 15;
      });

    setSelectedMedia(mediaIds);
    setMediaDurations(durations);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingId(null);
    setPlaylistName('');
    setSelectedTerminal('');
    setSelectedMedia([]);
    setMediaDurations({});
  };

  const handleSavePlaylist = async (e: FormEvent) => {
    e.preventDefault();
    if (!playlistName || !selectedTerminal || selectedMedia.length === 0) {
      alert('Preencha nome, terminal e selecione ao menos uma mídia.');
      return;
    }

    setIsSaving(true);
    try {
      if (editingId) {
        const { data: currentPlaylist } = await supabase
          .from('playlists')
          .select('version')
          .eq('id', editingId)
          .single();
        const nextVersion = (currentPlaylist?.version || 1) + 1;

        const { error: pError } = await supabase
          .from('playlists')
          .update({
            name: playlistName,
            terminal_id: selectedTerminal,
            version: nextVersion,
            is_active: true
          })
          .eq('id', editingId);

        if (pError) throw pError;

        await supabase.from('playlist_items').delete().eq('playlist_id', editingId);

        const itemsToInsert = selectedMedia.map((mediaId, index) => ({
          playlist_id: editingId,
          media_id: mediaId,
          order: index + 1,
          duration_override: mediaDurations[mediaId] || 15
        }));

        const { error: iError } = await supabase
          .from('playlist_items')
          .insert(itemsToInsert);
        if (iError) throw iError;

        alert('Playlist atualizada. O terminal sincronizará na próxima verificação.');
      } else {
        await supabase
          .from('playlists')
          .update({ is_active: false })
          .eq('terminal_id', selectedTerminal);

        const { data: newPlaylist, error: pError } = await supabase
          .from('playlists')
          .insert({
            terminal_id: selectedTerminal,
            name: playlistName,
            is_active: true,
            version: 1
          })
          .select()
          .single();

        if (pError) throw pError;

        const itemsToInsert = selectedMedia.map((mediaId, index) => ({
          playlist_id: newPlaylist.id,
          media_id: mediaId,
          order: index + 1,
          duration_override: mediaDurations[mediaId] || 15
        }));

        const { error: iError } = await supabase
          .from('playlist_items')
          .insert(itemsToInsert);
        if (iError) throw iError;

        alert('Playlist criada com sucesso.');
      }

      handleCancel();
      loadData();
    } catch (error) {
      console.error(error);
      alert('Erro ao salvar playlist.');
    } finally {
      setIsSaving(false);
    }
  };

  const deletePlaylist = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta playlist?')) return;
    await supabase.from('playlists').delete().eq('id', id);
    loadData();
  };

  const toggleMediaSelection = (mediaId: string) => {
    setSelectedMedia((prev) =>
      prev.includes(mediaId) ? prev.filter((id) => id !== mediaId) : [...prev, mediaId]
    );
  };

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div className="page-title-group">
          <h1 className="page-title">Playlists</h1>
          <p className="page-subtitle">
            Estruture grades sequenciais de exibição e gerencie versões distribuídas para cada terminal.
          </p>
        </div>

        {!showForm && (
          <div className="page-actions">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setShowForm(true)}
            >
              <Plus size={15} strokeWidth={2.2} />
              <span>Nova Playlist</span>
            </button>
          </div>
        )}
      </div>

      {/* KPI Strip */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-label">Total de Playlists</span>
            <span className="kpi-icon">
              <ListVideo size={15} strokeWidth={1.75} />
            </span>
          </div>
          <div className="kpi-value">{loading ? '—' : playlists.length}</div>
          <div className="kpi-meta">Grades configuradas</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-label">Grades em Transmissão</span>
            <span className="kpi-icon">
              <MonitorPlay size={15} strokeWidth={1.75} />
            </span>
          </div>
          <div
            className="kpi-value"
            style={{ color: activePlaylistsCount > 0 ? 'var(--success)' : undefined }}
          >
            {loading ? '—' : activePlaylistsCount}
          </div>
          <div className="kpi-meta">Ativas nos terminais vinculados</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-label">Acervo Disponível</span>
            <span className="kpi-icon">
              <Layers size={15} strokeWidth={1.75} />
            </span>
          </div>
          <div className="kpi-value">{loading ? '—' : mediaFiles.length}</div>
          <div className="kpi-meta">Arquivos prontos na biblioteca</div>
        </div>
      </div>

      {/* Editor Inline */}
      {showForm && (
        <div
          className="card"
          style={{ marginBottom: 20, borderColor: 'var(--border-default)' }}
        >
          <div className="card-header">
            <div>
              <h2 className="card-title">
                {editingId ? 'Editar Grade de Programação' : 'Nova Grade de Programação'}
              </h2>
              <p className="card-subtitle">
                A ordem de seleção das mídias define a sequência do loop na TV.
              </p>
            </div>

            <div className="flex items-center gap-2">
              {selectedMedia.length > 0 && (
                <span className="badge badge-neutral font-mono">
                  <Clock size={11} />
                  {selectedMedia.length} itens · {totalLoopSeconds}s loop
                </span>
              )}
              <button
                type="button"
                className="icon-btn"
                onClick={handleCancel}
                aria-label="Fechar editor"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          <form onSubmit={handleSavePlaylist}>
            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div className="form-grid-2">
                <div className="input-group">
                  <label className="input-label">Nome da Playlist *</label>
                  <input
                    type="text"
                    className="input-field"
                    value={playlistName}
                    onChange={(e) => setPlaylistName(e.target.value)}
                    placeholder="Ex: Programação Principal — Recepção"
                    required
                  />
                </div>

                <div className="input-group">
                  <label className="input-label">Terminal de Destino *</label>
                  <select
                    className="select-field"
                    value={selectedTerminal}
                    onChange={(e) => setSelectedTerminal(e.target.value)}
                    required
                  >
                    <option value="">Selecione um terminal...</option>
                    {terminals.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} {t.location ? `(${t.location})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <div
                  className="flex items-center justify-between"
                  style={{ marginBottom: 10 }}
                >
                  <span className="input-label" style={{ color: 'var(--text-primary)' }}>
                    Seleção e Ordem de Mídias
                  </span>
                  {selectedMedia.length > 0 && (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => setSelectedMedia([])}
                    >
                      Limpar seleção
                    </button>
                  )}
                </div>

                {mediaFiles.length === 0 ? (
                  <div
                    className="form-section"
                    style={{ textAlign: 'center', padding: 24, color: 'var(--text-tertiary)' }}
                  >
                    Nenhuma mídia disponível na biblioteca. Envie arquivos na aba Biblioteca de Mídias primeiro.
                  </div>
                ) : (
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(215px, 1fr))',
                      gap: 10
                    }}
                  >
                    {mediaFiles.map((media) => {
                      const isSelected = selectedMedia.includes(media.id);
                      const orderIndex = selectedMedia.indexOf(media.id) + 1;
                      const isVideo = media.file_type?.includes('video');

                      return (
                        <div
                          key={media.id}
                          onClick={() => toggleMediaSelection(media.id)}
                          style={{
                            border: isSelected
                              ? '1px solid var(--accent-border)'
                              : '1px solid var(--border-subtle)',
                            borderRadius: 'var(--r-md)',
                            padding: '12px',
                            cursor: 'pointer',
                            background: isSelected
                              ? 'var(--accent-dim)'
                              : 'var(--bg-surface-sub)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 10,
                            transition: 'all var(--dur-fast) ease'
                          }}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8,
                                minWidth: 0
                              }}
                            >
                              {isVideo ? (
                                <Film
                                  size={15}
                                  style={{
                                    color: isSelected
                                      ? 'var(--accent)'
                                      : 'var(--text-tertiary)',
                                    flexShrink: 0
                                  }}
                                />
                              ) : (
                                <ImageIcon
                                  size={15}
                                  style={{
                                    color: isSelected
                                      ? 'var(--accent)'
                                      : 'var(--text-tertiary)',
                                    flexShrink: 0
                                  }}
                                />
                              )}
                              <div style={{ minWidth: 0 }}>
                                <p
                                  style={{
                                    fontSize: 12.5,
                                    fontWeight: 500,
                                    color: 'var(--text-primary)',
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis'
                                  }}
                                  title={media.name}
                                >
                                  {media.name}
                                </p>
                                <p
                                  className="font-mono"
                                  style={{ fontSize: 10.5, color: 'var(--text-tertiary)' }}
                                >
                                  {(media.file_type?.split('/')[1] || 'MEDIA').toUpperCase()}
                                </p>
                              </div>
                            </div>

                            {isSelected && (
                              <span
                                className="font-mono"
                                style={{
                                  background: 'var(--accent)',
                                  color: 'var(--text-on-accent)',
                                  height: 20,
                                  minWidth: 20,
                                  padding: '0 6px',
                                  borderRadius: 'var(--r-xs)',
                                  fontSize: 11,
                                  fontWeight: 600,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  flexShrink: 0
                                }}
                              >
                                {String(orderIndex).padStart(2, '0')}
                              </span>
                            )}
                          </div>

                          {isSelected && (
                            <div
                              className="flex items-center justify-between gap-2"
                              style={{
                                paddingTop: 8,
                                borderTop: '1px solid rgba(255,255,255,0.06)'
                              }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <label
                                style={{
                                  fontSize: 11.5,
                                  color: 'var(--text-secondary)'
                                }}
                              >
                                Tempo (seg)
                              </label>
                              <input
                                type="number"
                                min="1"
                                className="input-field font-mono"
                                style={{ width: 72, height: 28, padding: '0 8px' }}
                                value={mediaDurations[media.id] || 15}
                                onChange={(e) =>
                                  setMediaDurations((prev) => ({
                                    ...prev,
                                    [media.id]: parseInt(e.target.value, 10) || 15
                                  }))
                                }
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div
              className="modal-footer"
              style={{ borderBottomLeftRadius: 'var(--r-lg)', borderBottomRightRadius: 'var(--r-lg)' }}
            >
              <button type="button" className="btn btn-ghost" onClick={handleCancel}>
                Cancelar
              </button>
              <button type="submit" className="btn btn-primary" disabled={isSaving}>
                {isSaving ? (
                  <div className="loader" />
                ) : editingId ? (
                  'Salvar e Publicar Nova Versão'
                ) : (
                  'Criar Playlist'
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Playlists Table */}
      {loading && !showForm ? (
        <div className="loading-state">
          <div className="loader" />
          <span>Carregando playlists...</span>
        </div>
      ) : playlists.length === 0 ? (
        <div className="card empty-state">
          <div className="empty-state-icon">
            <ListVideo size={18} />
          </div>
          <div className="empty-state-title">Nenhuma playlist cadastrada</div>
          <p className="empty-state-desc">
            Crie uma grade de programação para definir quais vídeos e imagens serão reproduzidos em cada terminal.
          </p>
          {!showForm && (
            <button
              type="button"
              className="btn btn-primary"
              style={{ marginTop: 8 }}
              onClick={() => setShowForm(true)}
            >
              <Plus size={15} />
              <span>Nova Playlist</span>
            </button>
          )}
        </div>
      ) : (
        <div className="table-card">
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Playlist</th>
                  <th>Terminal vinculado</th>
                  <th>Mídias</th>
                  <th>Versão</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {playlists.map((playlist) => (
                  <tr key={playlist.id}>
                    <td>
                      <div className="flex items-center gap-3">
                        <div className="entity-avatar">
                          <ListVideo size={15} strokeWidth={1.75} />
                        </div>
                        <span className="cell-primary">{playlist.name}</span>
                      </div>
                    </td>

                    <td>
                      <div className="flex items-center gap-2 text-muted">
                        <MonitorPlay size={13} />
                        <span>{playlist.terminals?.name || 'Sem terminal'}</span>
                      </div>
                    </td>

                    <td>
                      <span className="font-mono">
                        {playlist.playlist_items?.length || 0} itens
                      </span>
                    </td>

                    <td>
                      <span className="badge badge-neutral font-mono">
                        v{playlist.version || 1}
                      </span>
                    </td>

                    <td>
                      {playlist.is_active ? (
                        <span className="badge badge-success">
                          <span className="status-dot online" />
                          Ativa
                        </span>
                      ) : (
                        <span className="badge badge-neutral">
                          <span className="status-dot neutral" />
                          Inativa
                        </span>
                      )}
                    </td>

                    <td style={{ textAlign: 'right' }}>
                      <div
                        style={{
                          display: 'flex',
                          gap: 4,
                          justifyContent: 'flex-end'
                        }}
                      >
                        <button
                          type="button"
                          className="icon-btn"
                          onClick={() => handleEdit(playlist)}
                          title="Editar playlist"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          type="button"
                          className="icon-btn danger"
                          onClick={() => deletePlaylist(playlist.id)}
                          title="Excluir playlist"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
