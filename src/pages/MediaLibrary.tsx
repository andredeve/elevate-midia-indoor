import { useEffect, useState, useRef, useMemo, type ChangeEvent } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';
import {
  Upload,
  Trash2,
  FileVideo,
  Info,
  Search,
  X,
  ExternalLink,
  Clapperboard,
  Play,
  Eye
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import AIVideoGeneratorModal from '../components/AIVideoGeneratorModal';

interface MediaFile {
  id: string;
  name: string;
  file_path: string;
  file_type: string;
  file_size: number;
  created_at: string;
  publicUrl?: string;
}

export default function MediaLibrary() {
  const [media, setMedia] = useState<MediaFile[]>([]);
  const [partners, setPartners] = useState<{ id: string; name: string }[]>([]);
  const [advertisers, setAdvertisers] = useState<{ id: string; company_name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [isAIVideoModalOpen, setIsAIVideoModalOpen] = useState(false);
  const [previewItem, setPreviewItem] = useState<MediaFile | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'video' | 'image'>('all');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuthStore();

  const loadMedia = async () => {
    setLoading(true);
    try {
      const { data: userData } = await supabase
        .from('users')
        .select('org_id')
        .eq('id', user?.id)
        .single();

      const [{ data: partnersData }, { data: advData }] = await Promise.all([
        supabase.from('partners').select('*'),
        supabase.from('advertisers').select('id, company_name').order('company_name')
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

      const query = supabase
        .from('media_files')
        .select('*')
        .is('partner_id', null)
        .order('created_at', { ascending: false });

      const { data, error } = userData?.org_id
        ? await query.eq('org_id', userData.org_id)
        : await query;

      if (data && !error) {
        // Gerar URLs assinadas em lote para que o bucket privado funcione e os frames carreguem
        const paths = data.map((item: any) => item.file_path).filter(Boolean);
        const signedMap: Record<string, string> = {};

        if (paths.length > 0) {
          try {
            const { data: signedList } = await supabase.storage
              .from('media')
              .createSignedUrls(paths, 86400);

            (signedList || []).forEach((s: any, idx: number) => {
              const p = s.path || paths[idx];
              if (p && s.signedUrl) {
                signedMap[p] = s.signedUrl;
              }
            });
          } catch (signErr) {
            console.warn('Erro ao gerar URLs assinadas em lote:', signErr);
          }
        }

        const mediaWithUrls = data.map((item: any) => {
          let playUrl = item.url || (item.file_path ? signedMap[item.file_path] : null);
          if (!playUrl && item.file_path) {
            const { data: publicUrlData } = supabase.storage
              .from('media')
              .getPublicUrl(item.file_path);
            playUrl = publicUrlData?.publicUrl;
          }
          return { ...item, publicUrl: playUrl };
        });
        setMedia(mediaWithUrls);
      }
    } catch (err) {
      console.error('Erro ao carregar mídias:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMedia();
  }, [user]);

  const counts = useMemo(() => {
    const videos = media.filter((m) => m.file_type?.includes('video')).length;
    const images = media.length - videos;
    return { total: media.length, videos, images };
  }, [media]);

  const filteredMedia = useMemo(() => {
    return media.filter((item) => {
      const isVideo = item.file_type?.includes('video');
      if (typeFilter === 'video' && !isVideo) return false;
      if (typeFilter === 'image' && isVideo) return false;
      const q = searchQuery.toLowerCase().trim();
      if (!q) return true;
      return item.name?.toLowerCase().includes(q);
    });
  }, [media, typeFilter, searchQuery]);

  const handleFileUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // VALIDAÇÃO DE FORMATO
    if (file.type === 'video/webm') {
      alert(
        'Atenção: O formato .webm não é suportado por dispositivos iOS/Apple TV. Converta o arquivo para .mp4 (H.264) antes de enviar.'
      );
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setUploading(true);
    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
    const filePath = `${user?.id}/${fileName}`;

    try {
      const { error: uploadError } = await supabase.storage
        .from('media')
        .upload(filePath, file);
      if (uploadError) throw uploadError;

      const simpleChecksum = btoa(
        `${file.name}-${file.size}-${file.lastModified}`
      ).substring(0, 32);
      const { data: userData } = await supabase
        .from('users')
        .select('org_id')
        .eq('id', user?.id)
        .single();

      const { error: dbError } = await supabase.from('media_files').insert({
        org_id: userData?.org_id,
        name: file.name,
        file_path: filePath,
        file_type: file.type,
        file_size: file.size,
        checksum: simpleChecksum
      });

      if (dbError) throw dbError;
      await loadMedia();
    } catch (error) {
      console.error('Erro no upload:', error);
      alert('Erro ao enviar o arquivo.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const deleteMedia = async (id: string, filePath: string) => {
    if (!window.confirm('Tem certeza que deseja excluir esta mídia permanentemente?'))
      return;
    await supabase.storage.from('media').remove([filePath]);
    await supabase.from('media_files').delete().eq('id', id);
    setMedia(media.filter((m) => m.id !== id));
  };

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div className="page-title-group">
          <h1 className="page-title">Biblioteca de Mídias</h1>
          <p className="page-subtitle">
            Repositório central de vídeos e imagens homologados para distribuição nos terminais.
          </p>
        </div>

        <input
          type="file"
          accept="video/mp4,image/jpeg,image/png,image/webp"
          ref={fileInputRef}
          style={{ display: 'none' }}
          onChange={handleFileUpload}
        />

        <div className="page-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setIsAIVideoModalOpen(true)}
          >
            <Clapperboard size={15} style={{ color: 'var(--accent)' }} />
            <span>Estúdio de Vídeo</span>
          </button>

          <button
            type="button"
            className="btn btn-primary"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? <div className="loader" /> : <Upload size={15} strokeWidth={2} />}
            <span>{uploading ? 'Enviando...' : 'Enviar Mídia'}</span>
          </button>
        </div>
      </div>

      {/* Specification Notice */}
      <div className="notice-bar">
        <Info size={15} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
        <span>
          Formatos recomendados: <strong style={{ color: 'var(--text-primary)', fontWeight: 500 }}>MP4 (H.264)</strong> para vídeos e{' '}
          <strong style={{ color: 'var(--text-primary)', fontWeight: 500 }}>JPG / PNG / WebP</strong> para imagens estáticas.
        </span>
      </div>

      {/* Toolbar */}
      <div className="toolbar">
        <div className="search-field">
          <Search size={15} className="search-field-icon" />
          <input
            type="text"
            placeholder="Filtrar arquivos por nome..."
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
            className={`seg-btn ${typeFilter === 'all' ? 'active' : ''}`}
            onClick={() => setTypeFilter('all')}
          >
            Todos <span className="seg-count">{counts.total}</span>
          </button>
          <button
            type="button"
            className={`seg-btn ${typeFilter === 'video' ? 'active' : ''}`}
            onClick={() => setTypeFilter('video')}
          >
            Vídeos <span className="seg-count">{counts.videos}</span>
          </button>
          <button
            type="button"
            className={`seg-btn ${typeFilter === 'image' ? 'active' : ''}`}
            onClick={() => setTypeFilter('image')}
          >
            Imagens <span className="seg-count">{counts.images}</span>
          </button>
        </div>
      </div>

      {/* Media Grid */}
      {loading ? (
        <div className="loading-state">
          <div className="loader" />
          <span>Carregando biblioteca...</span>
        </div>
      ) : filteredMedia.length === 0 ? (
        <div className="card empty-state">
          <div className="empty-state-icon">
            <FileVideo size={18} />
          </div>
          <div className="empty-state-title">
            {media.length === 0 ? 'Biblioteca vazia' : 'Nenhum arquivo encontrado'}
          </div>
          <p className="empty-state-desc">
            {media.length === 0
              ? 'Envie um arquivo MP4/PNG ou utilize o Estúdio de Vídeo para produzir uma campanha de 5 slides.'
              : 'Nenhum arquivo corresponde aos critérios de busca selecionados.'}
          </p>
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(245px, 1fr))',
            gap: 14
          }}
        >
          {filteredMedia.map((item) => {
            const isVideo = item.file_type?.includes('video');
            const extLabel = (
              item.file_type?.split('/')[1] ||
              item.name?.split('.').pop() ||
              'FILE'
            )
              .toUpperCase()
              .replace('QUICKTIME', 'MOV')
              .slice(0, 4);

            return (
              <div
                key={item.id}
                className="card card-interactive"
                style={{
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column'
                }}
              >
                {/* Preview Viewport */}
                <div
                  onClick={() => setPreviewItem(item)}
                  style={{
                    aspectRatio: '16 / 9',
                    backgroundColor: '#050506',
                    borderBottom: '1px solid var(--border-subtle)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'relative',
                    overflow: 'hidden',
                    cursor: 'pointer'
                  }}
                  title="Clique para assistir"
                >
                  {isVideo ? (
                    <>
                      <video
                        src={`${item.publicUrl}#t=0.1`}
                        preload="auto"
                        muted
                        playsInline
                        crossOrigin="anonymous"
                        onLoadedMetadata={(e) => {
                          try {
                            e.currentTarget.currentTime = 0.1;
                          } catch {}
                        }}
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                          opacity: 0.88
                        }}
                      />
                      <div
                        style={{
                          position: 'absolute',
                          width: 34,
                          height: 34,
                          borderRadius: 'var(--r-full)',
                          background: 'rgba(9, 9, 11, 0.78)',
                          border: '1px solid rgba(255, 255, 255, 0.18)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#ffffff',
                          boxShadow: '0 4px 12px rgba(0,0,0,0.5)'
                        }}
                      >
                        <Play size={13} style={{ marginLeft: 2 }} />
                      </div>
                    </>
                  ) : (
                    <img
                      src={item.publicUrl}
                      alt={item.name}
                      loading="lazy"
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  )}

                  {/* Type Tag */}
                  <span
                    className="font-mono"
                    style={{
                      position: 'absolute',
                      top: 8,
                      left: 8,
                      background: 'rgba(9, 9, 11, 0.80)',
                      border: '1px solid rgba(255, 255, 255, 0.12)',
                      color:
                        item.file_type === 'video/webm'
                          ? 'var(--danger)'
                          : 'var(--text-secondary)',
                      fontSize: 10,
                      fontWeight: 500,
                      padding: '2px 6px',
                      borderRadius: 'var(--r-xs)'
                    }}
                  >
                    {extLabel}
                  </span>
                </div>

                {/* Metadata Footer */}
                <div
                  style={{
                    padding: '12px 14px',
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: 10
                  }}
                >
                  <div>
                    <h4
                      style={{
                        fontSize: 13,
                        fontWeight: 500,
                        color: 'var(--text-primary)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}
                      title={item.name}
                    >
                      {item.name}
                    </h4>
                    <p
                      className="tabular-nums"
                      style={{
                        fontSize: 11.5,
                        color: 'var(--text-tertiary)',
                        marginTop: 3
                      }}
                    >
                      {(item.file_size / 1024 / 1024).toFixed(2)} MB ·{' '}
                      {formatDistanceToNow(new Date(item.created_at), {
                        addSuffix: true,
                        locale: ptBR
                      })}
                    </p>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'flex-end',
                      gap: 4,
                      paddingTop: 8,
                      borderTop: '1px solid var(--border-subtle)'
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => setPreviewItem(item)}
                      className="icon-btn"
                      title="Visualizar mídia"
                    >
                      <Eye size={14} />
                    </button>
                    {item.publicUrl && (
                      <a
                        href={item.publicUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="icon-btn"
                        title="Abrir arquivo original"
                      >
                        <ExternalLink size={14} />
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => deleteMedia(item.id, item.file_path)}
                      className="icon-btn danger"
                      title="Excluir mídia"
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

      {/* Modal de Pré-visualização de Mídia */}
      {previewItem && (
        <div
          className="modal-overlay"
          style={{ zIndex: 9999 }}
          onClick={() => setPreviewItem(null)}
        >
          <div
            className="modal modal-lg"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 840, padding: 0, overflow: 'hidden' }}
          >
            <div
              className="modal-header"
              style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-subtle)' }}
            >
              <div>
                <h3 className="modal-title" style={{ fontSize: 15 }}>
                  {previewItem.name}
                </h3>
                <span className="cell-secondary" style={{ fontSize: 11 }}>
                  {(previewItem.file_size / 1024 / 1024).toFixed(2)} MB · {new Date(previewItem.created_at).toLocaleDateString('pt-BR')}
                </span>
              </div>
              <button
                type="button"
                className="icon-btn"
                onClick={() => setPreviewItem(null)}
                aria-label="Fechar"
              >
                <X size={16} />
              </button>
            </div>

            <div
              style={{
                background: '#000000',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: 360,
                maxHeight: '65vh'
              }}
            >
              {previewItem.file_type?.includes('video') ? (
                <video
                  src={previewItem.publicUrl}
                  controls
                  autoPlay
                  playsInline
                  style={{ width: '100%', maxHeight: '65vh', objectFit: 'contain' }}
                />
              ) : (
                <img
                  src={previewItem.publicUrl}
                  alt={previewItem.name}
                  style={{ width: '100%', maxHeight: '65vh', objectFit: 'contain' }}
                />
              )}
            </div>

            <div
              className="modal-footer"
              style={{
                padding: '12px 20px',
                borderTop: '1px solid var(--border-subtle)',
                display: 'flex',
                justifyContent: 'flex-end',
                gap: 8
              }}
            >
              {previewItem.publicUrl && (
                <a
                  href={previewItem.publicUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-ghost btn-sm"
                >
                  <ExternalLink size={13} />
                  <span>Abrir original</span>
                </a>
              )}
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setPreviewItem(null)}
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DO ESTÚDIO DE VÍDEOS */}
      <AIVideoGeneratorModal
        isOpen={isAIVideoModalOpen}
        onClose={() => setIsAIVideoModalOpen(false)}
        onSuccess={() => loadMedia()}
        partners={partners}
        advertisers={advertisers}
      />
    </div>
  );
}
