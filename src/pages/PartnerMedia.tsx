import { useEffect, useState, type ChangeEvent } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';
import { parsePartnerContactAndQuota } from '../utils/partnerQuota';
import { isTerminalOnline } from '../utils/terminalStatus';
import {
  uploadLargeMediaToSupabase,
  removeLargeMediaFromSupabase,
  isChunkedStreamUrl
} from '../utils/largeMediaUpload';
import {
  Upload,
  FileVideo,
  CheckCircle2,
  Play,
  Tv,
  Trash2,
  AlertCircle,
  ShieldAlert,
  Copy,
  Check,
  HelpCircle,
  Search,
  Eye,
  X,
  Plus,
  Film,
  Image as ImageIcon,
  RefreshCw,
  PauseCircle,
  Clock
} from 'lucide-react';

interface MediaFile {
  id: string;
  name?: string;
  original_name?: string;
  file_path?: string;
  file_type?: string;
  type?: string;
  file_size?: number;
  size?: number;
  url?: string;
  publicUrl?: string;
  duration_seconds?: number;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
}

const RLS_FIX_SQL = `-- Migration 004: Libera permissão de Upload de Mídias e TV para Parceiros (RLS Fix)
-- Execute este script no SQL Editor do seu painel Supabase
DROP POLICY IF EXISTS "Partners can view own profile" ON partners;
CREATE POLICY "Partners can view own profile" ON partners FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Advertisers can view own profile" ON advertisers;
CREATE POLICY "Advertisers can view own profile" ON advertisers FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can view own profile" ON users;
CREATE POLICY "Users can view own profile" ON users FOR SELECT USING (id = auth.uid());

DROP POLICY IF EXISTS "Users can insert org media" ON media_files;
CREATE POLICY "Users can insert org media" ON media_files FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Partners can manage their own media" ON media_files;
CREATE POLICY "Partners can manage their own media" ON media_files FOR ALL USING (partner_id IN (SELECT id FROM partners WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Advertisers can manage their own media" ON media_files;
CREATE POLICY "Advertisers can manage their own media" ON media_files FOR ALL USING (advertiser_id IN (SELECT id FROM advertisers WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Partners can manage linked terminal playlists" ON playlists;
CREATE POLICY "Partners can manage linked terminal playlists" ON playlists FOR ALL USING (terminal_id IN (SELECT t.id FROM terminals t JOIN partners p ON t.partner_id = p.id WHERE p.user_id = auth.uid())) WITH CHECK (terminal_id IN (SELECT t.id FROM terminals t JOIN partners p ON t.partner_id = p.id WHERE p.user_id = auth.uid()));

DROP POLICY IF EXISTS "Partners can manage linked terminal playlist items" ON playlist_items;
CREATE POLICY "Partners can manage linked terminal playlist items" ON playlist_items FOR ALL USING (playlist_id IN (SELECT pl.id FROM playlists pl JOIN terminals t ON pl.terminal_id = t.id JOIN partners p ON t.partner_id = p.id WHERE p.user_id = auth.uid())) WITH CHECK (playlist_id IN (SELECT pl.id FROM playlists pl JOIN terminals t ON pl.terminal_id = t.id JOIN partners p ON t.partner_id = p.id WHERE p.user_id = auth.uid()));`;

export default function PartnerMedia() {
  const { user } = useAuthStore();
  const [partnerId, setPartnerId] = useState<string | null>(null);
  const [partnerOrgId, setPartnerOrgId] = useState<string | null>(null);
  const [partnerConfiguredSlots, setPartnerConfiguredSlots] = useState<number>(3);
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([]);
  const [linkedTerminals, setLinkedTerminals] = useState<any[]>([]);
  const [selectedTerminalId, setSelectedTerminalId] = useState<string>('');
  const [playlist, setPlaylist] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadLabel, setUploadLabel] = useState<string>('');

  // RLS Help Box State
  const [showRlsHelp, setShowRlsHelp] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);

  // Filter, Search & Modal State for Media Library
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'in_tv' | 'videos' | 'images' | 'approved'>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'name'>('newest');
  const [previewMedia, setPreviewMedia] = useState<MediaFile | null>(null);

  // Duration Modal State
  const [editingDurationMedia, setEditingDurationMedia] = useState<MediaFile | null>(null);
  const [customDuration, setCustomDuration] = useState<number>(15);
  const [detectedVideoDuration, setDetectedVideoDuration] = useState<number | null>(null);
  const [savingDuration, setSavingDuration] = useState<boolean>(false);

  const formatDurationBadge = (seconds?: number | null) => {
    const s = Math.max(1, Math.round(seconds || 15));
    if (s < 60) return `${s}s`;
    const m = Math.floor(s / 60);
    const rem = s % 60;
    if (rem === 0) return `${m} min (${s}s)`;
    return `${m}m ${rem}s (${s}s)`;
  };

  const handleOpenDurationModal = (file: MediaFile) => {
    setEditingDurationMedia(file);
    const initial = file.duration_seconds && file.duration_seconds > 0 ? file.duration_seconds : 15;
    setCustomDuration(initial);
    setDetectedVideoDuration(null);

    // Se for vídeo, tenta ler a duração nativa do arquivo via elemento de vídeo
    if (isVideoFile(file)) {
      const mediaUrl = file.publicUrl || file.url;
      if (mediaUrl) {
        try {
          const v = document.createElement('video');
          v.preload = 'metadata';
          v.onloadedmetadata = () => {
            const dur = Math.round(v.duration);
            if (dur > 0 && Number.isFinite(dur)) {
              setDetectedVideoDuration(dur);
            }
          };
          v.src = mediaUrl;
        } catch {
          // ignore
        }
      }
    }
  };

  const handleSaveDuration = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!editingDurationMedia) return;

    const seconds = Math.max(1, Math.min(3600, Math.round(customDuration || 15)));
    setSavingDuration(true);
    try {
      const { error: updErr } = await supabase
        .from('media_files')
        .update({ duration_seconds: seconds })
        .eq('id', editingDurationMedia.id);

      if (updErr) {
        throw updErr;
      }

      // Atualiza também em playlist_items caso esteja vinculado
      try {
        await supabase
          .from('playlist_items')
          .update({ duration_override: seconds })
          .eq('media_id', editingDurationMedia.id);
      } catch {}

      // Incrementa a versão da playlist para a TV atualizar imediatamente
      if (playlist?.id) {
        const currentVersion = playlist.version || 1;
        await supabase.from('playlists').update({ version: currentVersion + 1 }).eq('id', playlist.id);
      }

      setMediaFiles(prev =>
        prev.map(m => (m.id === editingDurationMedia.id ? { ...m, duration_seconds: seconds } : m))
      );
      if (previewMedia?.id === editingDurationMedia.id) {
        setPreviewMedia(prev => (prev ? { ...prev, duration_seconds: seconds } : null));
      }

      setEditingDurationMedia(null);
    } catch (err: any) {
      console.error('Erro ao atualizar tempo de exibição:', err);
      alert('Erro ao atualizar tempo de exibição: ' + (err.message || 'Erro desconhecido'));
    } finally {
      setSavingDuration(false);
    }
  };

  const handleOpenPreview = async (file: MediaFile) => {
    let playUrl = file.publicUrl || file.url;
    if (file.file_path && !isChunkedStreamUrl(playUrl)) {
      try {
        const { data: signed } = await supabase.storage
          .from('media')
          .createSignedUrl(file.file_path, 86400);
        if (signed?.signedUrl) {
          playUrl = signed.signedUrl;
        }
      } catch (err) {
        console.warn('Erro ao gerar URL assinada:', err);
      }
    }
    setPreviewMedia({
      ...file,
      publicUrl: playUrl,
      url: playUrl
    });
  };

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  const loadPlaylistForTerminal = async (terminalId: string) => {
    if (!terminalId) return;
    try {
      const { data: playlists } = await supabase
        .from('playlists')
        .select('*')
        .eq('terminal_id', terminalId)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1);

      if (playlists && playlists.length > 0) {
        setPlaylist(playlists[0]);
      } else {
        setPlaylist(null);
      }
    } catch (err) {
      console.error('Error loading playlist:', err);
    }
  };

  const loadData = async () => {
    if (!user) return;
    try {
      setLoading(true);
      let { data: partnerData, error: partnerError } = await supabase
        .from('partners')
        .select('*')
        .eq('user_id', user.id)
        .single();

      // Fallback caso o usuário logado esteja em modo de supervisão/teste
      if (!partnerData) {
        const { data: fallbackPartners } = await supabase
          .from('partners')
          .select('*')
          .limit(1);
        partnerData = fallbackPartners?.[0] || null;
      }

      if (!partnerData) {
        console.error('Partner profile not found:', partnerError);
        setLoading(false);
        return;
      }

      setPartnerId(partnerData.id);
      setPartnerOrgId(partnerData.org_id || null);

      const { data: termsData } = await supabase
        .from('terminals')
        .select('*')
        .eq('partner_id', partnerData.id);

      const terms = termsData || [];
      setLinkedTerminals(terms);

      // Carrega cota configurada pelo administrador:
      // 1. Prioridade: cota sincronizada no terminal vinculado (Supabase)
      const termWithQuota = terms.find((t: any) => t.device_info?.partner_quota);
      const terminalQuota = termWithQuota?.device_info?.partner_quota ? Number(termWithQuota.device_info.partner_quota) : null;

      // 2. Cota no registro do parceiro (Supabase)
      const { quota: parsedQuota } = parsePartnerContactAndQuota(
        partnerData.contact_person,
        partnerData.max_media_slots
      );

      let quota = terminalQuota || parsedQuota || 3;

      // 3. Fallback em cache local
      try {
        const storedQuota =
          localStorage.getItem(`@gymplay_partner_slots_${partnerData.id}`) ||
          (partnerData.referral_code
            ? localStorage.getItem(`@gymplay_partner_slots_code_${partnerData.referral_code}`)
            : null) ||
          localStorage.getItem(`@gymplay_partner_slots_user_${user.id}`);
        if (storedQuota && !terminalQuota) {
          quota = parseInt(storedQuota, 10);
        }
      } catch {
        /* ignore */
      }
      setPartnerConfiguredSlots(quota > 0 ? quota : 3);

      if (terms.length > 0 && !selectedTerminalId) {
        const firstId = terms[0].id;
        setSelectedTerminalId(firstId);
        await loadPlaylistForTerminal(firstId);
      } else if (selectedTerminalId) {
        await loadPlaylistForTerminal(selectedTerminalId);
      }

      const { data: mediaData, error: mediaErr } = await supabase
        .from('media_files')
        .select('*')
        .eq('partner_id', partnerData.id)
        .order('created_at', { ascending: false });

      if (mediaErr) throw mediaErr;

      const mediaWithUrls = await Promise.all(
        (mediaData || []).map(async (file: any) => {
          let playUrl = file.url;
          if (file.file_path && !isChunkedStreamUrl(file.url)) {
            try {
              const { data: signedData } = await supabase.storage
                .from('media')
                .createSignedUrl(file.file_path, 86400);
              if (signedData?.signedUrl) {
                playUrl = signedData.signedUrl;
              } else {
                const { data: pubData } = supabase.storage
                  .from('media')
                  .getPublicUrl(file.file_path);
                playUrl = pubData?.publicUrl;
              }
            } catch {
              const { data: pubData } = supabase.storage
                .from('media')
                .getPublicUrl(file.file_path);
              playUrl = pubData?.publicUrl;
            }
          }
          return {
            ...file,
            publicUrl: playUrl,
            url: playUrl
          };
        })
      );

      setMediaFiles(mediaWithUrls);
    } catch (error) {
      console.error('Error loading partner media data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTerminalChange = async (terminalId: string) => {
    setSelectedTerminalId(terminalId);
    await loadPlaylistForTerminal(terminalId);
  };

  const detectMediaDuration = (file: File): Promise<number> => {
    return new Promise((resolve) => {
      const isVideo =
        file.type.startsWith('video/') ||
        file.name.toLowerCase().endsWith('.mp4') ||
        file.name.toLowerCase().endsWith('.mov') ||
        file.name.toLowerCase().endsWith('.m4v');

      if (!isVideo) {
        // Padrão para imagens: 15s
        return resolve(15);
      }

      try {
        const video = document.createElement('video');
        video.preload = 'metadata';
        const objectUrl = URL.createObjectURL(file);
        video.onloadedmetadata = () => {
          URL.revokeObjectURL(objectUrl);
          const dur = Math.round(video.duration);
          resolve(dur > 0 && Number.isFinite(dur) ? dur : 15);
        };
        video.onerror = () => {
          URL.revokeObjectURL(objectUrl);
          resolve(15);
        };
        video.src = objectUrl;
      } catch {
        resolve(15);
      }
    });
  };

  const handleFileUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !partnerId || !user) return;

    try {
      setUploading(true);
      setUploadProgress(1);
      setUploadLabel('Detectando duração e preparando envio...');

      // Detecta a duração total do vídeo ou define padrão para imagens
      const detectedDuration = await detectMediaDuration(file);

      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;

      let validFileType = file.type || 'video/mp4';
      if (!['video/mp4', 'image/jpeg', 'image/png', 'image/webp'].includes(validFileType)) {
        if (file.name.toLowerCase().endsWith('.mp4') || validFileType.startsWith('video/')) {
          validFileType = 'video/mp4';
        } else if (validFileType.startsWith('image/png') || file.name.toLowerCase().endsWith('.png')) {
          validFileType = 'image/png';
        } else if (validFileType.startsWith('image/webp') || file.name.toLowerCase().endsWith('.webp')) {
          validFileType = 'image/webp';
        } else {
          validFileType = 'image/jpeg';
        }
      }

      const uploadRes = await uploadLargeMediaToSupabase(file, filePath, {
        contentType: validFileType,
        onProgress: (pct, label) => {
          setUploadProgress(pct);
          if (label) setUploadLabel(label);
        }
      });

      const { data: userData } = await supabase.from('users').select('org_id').eq('id', user.id).single();
      const targetOrgId = userData?.org_id || partnerOrgId;

      const simpleChecksum = btoa(
        unescape(encodeURIComponent(`${file.name}-${file.size}-${file.lastModified}`))
      ).substring(0, 32);

      const newMedia: Record<string, any> = {
        org_id: targetOrgId,
        name: file.name,
        file_path: filePath,
        file_type: validFileType,
        file_size: file.size,
        duration_seconds: detectedDuration,
        checksum: simpleChecksum,
        partner_id: partnerId,
        status: 'approved'
      };
      if (uploadRes.isChunked && uploadRes.url) {
        newMedia.url = uploadRes.url;
      }

      const { error: dbError } = await supabase
        .from('media_files')
        .insert([newMedia]);

      if (dbError) {
        console.error('Database insert error:', dbError);
        if (
          dbError.message?.includes('row-level security') ||
          dbError.message?.includes('policy') ||
          dbError.message?.includes('violates row-level')
        ) {
          setShowRlsHelp(true);
        }
        throw dbError;
      }

      setUploadProgress(100);
      await loadData();
    } catch (error: any) {
      console.error('Error uploading file:', error);
      const isRls = error.message?.includes('row-level security') || error.message?.includes('violates row-level');
      if (isRls) {
        setShowRlsHelp(true);
        alert('Aviso do Banco de Dados: Sua conta precisa da permissão RLS do Supabase. As instruções foram abertas na tela.');
      } else {
        alert(`Erro ao fazer upload da mídia: ${error.message || 'Erro desconhecido'}`);
      }
    } finally {
      setUploading(false);
      setUploadProgress(0);
      setUploadLabel('');
      if (event.target) event.target.value = '';
    }
  };

  const maxPartnerSlots = partnerConfiguredSlots || 3;
  const currentPartnerCount = mediaFiles.filter(m => m.status === 'approved').length;
  const isMediaInPlaylist = (mediaId: string) =>
    mediaFiles.some(m => m.id === mediaId && m.status === 'approved');

  const handleAddToTerminal = async (mediaId: string) => {
    if (!selectedTerminalId) {
      alert('Nenhum terminal selecionado.');
      return;
    }

    if (currentPartnerCount >= maxPartnerSlots) {
      alert(
        `Você atingiu o limite de veiculação contratado (${maxPartnerSlots} mídias permitidas). Remova alguma mídia da grade para adicionar outra.`
      );
      return;
    }

    const { error: updateErr } = await supabase
      .from('media_files')
      .update({ status: 'approved' })
      .eq('id', mediaId);

    if (updateErr) {
      alert('Erro ao ativar mídia na TV.');
      return;
    }

    // Notificar terminal incrementando a versão da playlist sem poluir a tabela com itens
    if (playlist?.id) {
      const currentVersion = playlist?.version || 1;
      await supabase.from('playlists').update({ version: currentVersion + 1 }).eq('id', playlist.id);
    }

    await loadData();
  };

  const handleRemoveFromTerminal = async (mediaId: string) => {
    try {
      // Remove também de playlist_items caso tenha sido vinculado diretamente
      await supabase.from('playlist_items').delete().eq('media_id', mediaId);

      // A constraint media_files_status_check permite ('pending', 'approved', 'rejected').
      // 'pending' retira a mídia da grade ativa da TV mantendo-a na biblioteca do parceiro.
      const { error: updateErr } = await supabase
        .from('media_files')
        .update({ status: 'pending' })
        .eq('id', mediaId);

      if (updateErr) {
        console.error('Erro ao remover mídia da TV:', updateErr);
        alert('Erro ao remover mídia da TV: ' + updateErr.message);
        return;
      }

      // Notificar terminal incrementando a versão da playlist
      if (playlist?.id) {
        const currentVersion = playlist.version || 1;
        await supabase.from('playlists').update({ version: currentVersion + 1 }).eq('id', playlist.id);
      }

      await loadData();
    } catch (err: any) {
      console.error('Erro ao remover mídia da TV:', err);
      alert('Erro ao remover mídia da TV.');
    }
  };

  const handleDeleteMedia = async (file: MediaFile) => {
    const mediaName = file.name || file.original_name || 'esta mídia';
    if (!confirm(`Tem certeza que deseja excluir permanentemente "${mediaName}"?`)) {
      return;
    }

    try {
      await supabase.from('playlist_items').delete().eq('media_id', file.id);

      const { error: delErr } = await supabase
        .from('media_files')
        .delete()
        .eq('id', file.id);

      if (delErr) {
        console.error('Erro ao excluir mídia:', delErr);
        alert('Erro ao excluir mídia: ' + delErr.message);
        return;
      }

      if (file.file_path) {
        try {
          await removeLargeMediaFromSupabase(file.file_path, file.url || file.publicUrl);
        } catch (storageErr) {
          console.warn('Aviso ao remover arquivo do storage:', storageErr);
        }
      }

      if (playlist?.id) {
        const currentVersion = playlist.version || 1;
        await supabase.from('playlists').update({ version: currentVersion + 1 }).eq('id', playlist.id);
      }

      if (previewMedia?.id === file.id) {
        setPreviewMedia(null);
      }

      await loadData();
    } catch (err: any) {
      console.error('Erro ao excluir mídia:', err);
      alert('Erro ao excluir mídia.');
    }
  };

  const handleRebootTerminal = async (terminal: any) => {
    if (!terminal) return;
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
      await loadData();
    }
  };

  const copyRlsSql = () => {
    navigator.clipboard.writeText(RLS_FIX_SQL);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 3000);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return (
          <span className="badge badge-success" style={{ background: 'rgba(9,9,11,0.82)', backdropFilter: 'blur(6px)' }}>
            <CheckCircle2 size={11} /> Aprovada
          </span>
        );
      case 'rejected':
        return (
          <span className="badge badge-danger" style={{ background: 'rgba(9,9,11,0.82)', backdropFilter: 'blur(6px)' }}>
            Rejeitada
          </span>
        );
      default:
        return (
          <span className="badge badge-neutral" style={{ background: 'rgba(9,9,11,0.82)', backdropFilter: 'blur(6px)' }}>
            <PauseCircle size={11} /> Fora da Grade
          </span>
        );
    }
  };

  const isVideoFile = (file: MediaFile) => {
    return Boolean((file.file_type && file.file_type.includes('video')) || file.type === 'video');
  };

  const filteredMedia = mediaFiles
    .filter(file => {
      const mediaName = (file.name || file.original_name || '').toLowerCase();
      const matchesSearch = mediaName.includes(searchQuery.toLowerCase());
      if (!matchesSearch) return false;

      if (filterType === 'in_tv') return isMediaInPlaylist(file.id);
      if (filterType === 'videos') return isVideoFile(file);
      if (filterType === 'images') return !isVideoFile(file);
      if (filterType === 'approved') return file.status === 'approved';
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'oldest') {
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      }
      if (sortBy === 'name') {
        const nameA = a.name || a.original_name || '';
        const nameB = b.name || b.original_name || '';
        return nameA.localeCompare(nameB);
      }
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

  const totalInTv = mediaFiles.filter(m => isMediaInPlaylist(m.id)).length;
  const totalVideos = mediaFiles.filter(m => isVideoFile(m)).length;
  const totalImages = mediaFiles.filter(m => !isVideoFile(m)).length;

  if (loading) {
    return (
      <div className="loading-state">
        <div className="loader" />
        <span>Carregando biblioteca da unidade...</span>
      </div>
    );
  }

  const activeTerminal = linkedTerminals.find(t => t.id === selectedTerminalId);

  return (
    <div className="page-shell fade-up">
      {/* Header */}
      <div className="page-header">
        <div className="page-title-group">
          <div className="page-title-row">
            <h1 className="page-title">Minhas Mídias</h1>
            <span className="badge badge-neutral">Cota: {maxPartnerSlots} mídias permitidas</span>
          </div>
          <p className="page-subtitle">
            Envie vídeos e imagens institucionais para exibição direta nas TVs vinculadas ao seu estabelecimento.
          </p>
        </div>

        <div className="page-actions">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => setShowRlsHelp(!showRlsHelp)}
          >
            <HelpCircle size={14} />
            <span>Permissões RLS</span>
          </button>

          <input
            type="file"
            id="partner-media-upload"
            accept="image/*,video/mp4,video/quicktime,video/*"
            style={{ display: 'none' }}
            onChange={handleFileUpload}
            disabled={uploading}
          />
          <label
            htmlFor="partner-media-upload"
            className="btn btn-primary"
            style={{ cursor: uploading ? 'wait' : 'pointer', opacity: uploading ? 0.65 : 1 }}
          >
            {uploading ? <div className="loader" /> : <Upload size={14} />}
            <span>{uploading ? (uploadLabel || `Enviando (${uploadProgress}%)`) : 'Enviar Mídia'}</span>
          </label>
        </div>
      </div>

      {/* RLS Help Panel */}
      {showRlsHelp && (
        <div className="card" style={{ marginBottom: '20px', borderColor: 'var(--warning-border)' }}>
          <div className="card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--warning)' }}>
              <ShieldAlert size={16} />
              <span className="card-title" style={{ color: 'var(--warning)' }}>
                Política RLS do Supabase para Parceiros
              </span>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button type="button" className="btn btn-secondary btn-sm" onClick={copyRlsSql}>
                {copiedSql ? <Check size={12} /> : <Copy size={12} />}
                <span>{copiedSql ? 'Copiado' : 'Copiar SQL'}</span>
              </button>
              <button type="button" className="icon-btn" onClick={() => setShowRlsHelp(false)}>
                <X size={15} />
              </button>
            </div>
          </div>
          <div className="card-body">
            <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', marginBottom: '10px' }}>
              Caso o upload retorne erro de permissão, execute o script abaixo no SQL Editor do Supabase:
            </p>
            <pre
              className="font-mono"
              style={{
                background: 'var(--bg-base)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--r-md)',
                padding: '12px',
                overflowX: 'auto',
                whiteSpace: 'pre-wrap',
                maxHeight: '160px',
                color: 'var(--text-secondary)',
                fontSize: '11.5px'
              }}
            >
              {RLS_FIX_SQL}
            </pre>
          </div>
        </div>
      )}

      {/* Terminal Autonomy Quota Card */}
      {linkedTerminals.length > 0 ? (
        <div className="card" style={{ marginBottom: '20px' }}>
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <div className="entity-avatar">
                  <Tv size={15} />
                </div>
                <div>
                  <div className="card-title">Sintonia da Grade por Terminal</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px', flexWrap: 'wrap' }}>
                    <select
                      className="select-field"
                      style={{ width: 'auto', minWidth: 'min(100%, 220px)', maxWidth: '100%', height: '30px', fontSize: '12.5px' }}
                      value={selectedTerminalId}
                      onChange={e => handleTerminalChange(e.target.value)}
                    >
                      {linkedTerminals.map(t => (
                        <option key={t.id} value={t.id}>
                          {t.name} ({t.location || 'Sem setor'})
                        </option>
                      ))}
                    </select>
                    <span className={`badge ${isTerminalOnline(activeTerminal) ? 'badge-success' : 'badge-danger'}`}>
                      <span className={`status-dot ${isTerminalOnline(activeTerminal) ? 'online' : 'offline'}`} />
                      {isTerminalOnline(activeTerminal) ? 'Online · Sync ativo' : 'Offline'}
                    </span>
                    {activeTerminal && (
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleRebootTerminal(activeTerminal)}
                        title="Forçar reinicialização remota do app na TV"
                      >
                        <RefreshCw size={12} />
                        <span>Reiniciar Terminal</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div style={{ textAlign: 'right' }}>
                <div className="kpi-label">Ocupação da Cota de Mídias</div>
                <div className="kpi-value" style={{ fontSize: '20px', marginTop: '2px' }}>
                  {currentPartnerCount}{' '}
                  <span className="kpi-value-muted">/ {maxPartnerSlots} mídias</span>
                </div>
              </div>
            </div>

            <div className="progress-bar">
              <div
                className="progress-fill accent"
                style={{ width: `${Math.min(100, (currentPartnerCount / maxPartnerSlots) * 100)}%` }}
              />
            </div>
          </div>
        </div>
      ) : (
        <div className="notice-bar">
          <AlertCircle size={15} style={{ color: 'var(--warning)' }} />
          <span>
            Nenhum terminal vinculado à sua unidade ainda. Após o vínculo pelo administrador, você poderá publicar até 30% da grade.
          </span>
        </div>
      )}

      {/* Toolbar */}
      <div className="toolbar">
        <div className="toolbar-left">
          <div className="segmented-control">
            <button
              type="button"
              className={`seg-btn ${filterType === 'all' ? 'active' : ''}`}
              onClick={() => setFilterType('all')}
            >
              <span>Todos</span>
              <span className="seg-count">{mediaFiles.length}</span>
            </button>
            <button
              type="button"
              className={`seg-btn ${filterType === 'in_tv' ? 'active' : ''}`}
              onClick={() => setFilterType('in_tv')}
            >
              <span>Na Grade</span>
              <span className="seg-count">{totalInTv}</span>
            </button>
            <button
              type="button"
              className={`seg-btn ${filterType === 'videos' ? 'active' : ''}`}
              onClick={() => setFilterType('videos')}
            >
              <span>Vídeos</span>
              <span className="seg-count">{totalVideos}</span>
            </button>
            <button
              type="button"
              className={`seg-btn ${filterType === 'images' ? 'active' : ''}`}
              onClick={() => setFilterType('images')}
            >
              <span>Imagens</span>
              <span className="seg-count">{totalImages}</span>
            </button>
          </div>
        </div>

        <div className="toolbar-right">
          <div className="search-field" style={{ width: '250px' }}>
            <Search size={14} className="search-field-icon" />
            <input
              type="text"
              placeholder="Buscar arquivo..."
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

          <select
            className="select-field"
            style={{ width: '160px', height: '34px' }}
            value={sortBy}
            onChange={(e: any) => setSortBy(e.target.value)}
          >
            <option value="newest">Mais recentes</option>
            <option value="oldest">Mais antigos</option>
            <option value="name">Nome (A–Z)</option>
          </select>
        </div>
      </div>

      {/* Media Grid */}
      {filteredMedia.length === 0 ? (
        <div className="card empty-state">
          <div className="empty-state-icon">
            <FileVideo size={18} />
          </div>
          <div className="empty-state-title">
            {searchQuery || filterType !== 'all'
              ? 'Nenhuma mídia para o filtro atual'
              : 'Nenhuma mídia enviada'}
          </div>
          <div className="empty-state-desc">
            {searchQuery || filterType !== 'all'
              ? 'Altere a aba selecionada ou limpe o campo de busca.'
              : 'Utilize o botão "Enviar Mídia" acima para adicionar vídeos ou imagens.'}
          </div>
        </div>
      ) : (
        <div
          className="partner-media-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 240px), 290px))',
            gap: '14px',
            maxWidth: '920px'
          }}
        >
          {filteredMedia.map(file => {
            const inTv = isMediaInPlaylist(file.id);
            const isVideo = isVideoFile(file);
            const mediaUrl = file.publicUrl || file.url || '';
            const mediaName = file.name || file.original_name || 'Mídia sem nome';
            const fileSizeMB =
              file.file_size || file.size
                ? ((file.file_size || file.size!) / (1024 * 1024)).toFixed(1) + ' MB'
                : null;

            return (
              <div
                key={file.id}
                className="card card-interactive"
                style={{
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                  borderColor: inTv ? 'var(--success-border)' : undefined
                }}
              >
                <div
                  onClick={() => handleOpenPreview(file)}
                  style={{
                    aspectRatio: '16 / 9',
                    background: '#050507',
                    borderBottom: '1px solid var(--border-subtle)',
                    position: 'relative',
                    overflow: 'hidden',
                    cursor: 'pointer'
                  }}
                >
                  {isVideo ? (
                    <>
                      <video
                        src={`${mediaUrl}#t=0.1`}
                        preload="metadata"
                        muted
                        playsInline
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        onError={(e) => {
                          const target = e.currentTarget;
                          if (!target.dataset.triedFallback) {
                            target.dataset.triedFallback = 'true';
                            target.src = '/sample-video.webm#t=0.1';
                          }
                        }}
                      />
                      <div
                        style={{
                          position: 'absolute',
                          inset: 0,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: 'rgba(0,0,0,0.28)'
                        }}
                      >
                        <div
                          style={{
                            width: '36px',
                            height: '36px',
                            borderRadius: '50%',
                            background: 'rgba(9,9,11,0.82)',
                            border: '1px solid var(--border-default)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'var(--text-primary)'
                          }}
                        >
                          <Play size={14} fill="currentColor" />
                        </div>
                      </div>
                    </>
                  ) : (
                    <img
                      src={mediaUrl}
                      alt={mediaName}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  )}

                  <div style={{ position: 'absolute', top: '10px', left: '10px' }}>
                    {getStatusBadge(file.status)}
                  </div>

                  <div style={{ position: 'absolute', top: '10px', right: '10px', display: 'flex', gap: '6px' }}>
                    {inTv && (
                      <span
                        className="badge badge-success"
                        style={{ background: 'rgba(9,9,11,0.85)', backdropFilter: 'blur(6px)' }}
                      >
                        <span className="status-dot online" />
                        Na Grade
                      </span>
                    )}
                    <span
                      className="badge badge-neutral"
                      style={{
                        background: 'rgba(9,9,11,0.85)',
                        backdropFilter: 'blur(6px)',
                        fontFamily: 'var(--font-mono)',
                        fontSize: '10.5px'
                      }}
                    >
                      {isVideo ? <Film size={11} /> : <ImageIcon size={11} />}
                      {isVideo ? 'MP4' : 'IMG'}
                    </span>
                  </div>
                </div>

                <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '10px', flex: 1 }}>
                  <div>
                    <div
                      className="cell-primary"
                      title={mediaName}
                      style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                    >
                      {mediaName}
                    </div>
                    <div className="cell-secondary tabular-nums" style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>{new Date(file.created_at).toLocaleDateString('pt-BR')}</span>
                      {fileSizeMB && <span>{fileSizeMB}</span>}
                    </div>
                  </div>

                  {/* Tempo de exibição configurado na TV */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      background: 'var(--bg-subtle, rgba(255,255,255,0.03))',
                      padding: '6px 10px',
                      borderRadius: 'var(--r-md, 8px)',
                      border: '1px solid var(--border-subtle)'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Clock size={13} style={{ color: 'var(--accent)' }} />
                      <span style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>Tempo na TV:</span>
                      <strong
                        style={{
                          fontSize: '12px',
                          color: 'var(--text-primary)',
                          fontFamily: 'var(--font-mono)'
                        }}
                      >
                        {formatDurationBadge(file.duration_seconds)}
                      </strong>
                    </div>

                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      style={{ height: '24px', padding: '0 8px', fontSize: '11px' }}
                      onClick={() => handleOpenDurationModal(file)}
                      title="Alterar o tempo que este conteúdo fica na TV"
                    >
                      Alterar
                    </button>
                  </div>

                  <div
                    style={{
                      marginTop: 'auto',
                      paddingTop: '10px',
                      borderTop: '1px solid var(--border-subtle)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: '8px'
                    }}
                  >
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => handleOpenPreview(file)}
                    >
                      <Eye size={12} />
                      <span>Visualizar</span>
                    </button>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {linkedTerminals.length > 0 && (
                        inTv ? (
                          <button
                            type="button"
                            className="btn btn-danger btn-sm"
                            onClick={() => handleRemoveFromTerminal(file.id)}
                            title="Retirar esta mídia da grade da TV"
                          >
                            <PauseCircle size={12} />
                            <span>Remover da TV</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            onClick={() => handleAddToTerminal(file.id)}
                            disabled={currentPartnerCount >= maxPartnerSlots}
                            title={currentPartnerCount >= maxPartnerSlots ? 'Cota de 30% atingida' : 'Exibir na TV'}
                          >
                            <Plus size={12} />
                            <span>Exibir na TV</span>
                          </button>
                        )
                      )}

                      <button
                        type="button"
                        className="icon-btn danger"
                        onClick={() => handleDeleteMedia(file)}
                        title="Excluir mídia permanentemente"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Preview Modal */}
      {previewMedia && (
        <div className="modal-overlay" onClick={() => setPreviewMedia(null)}>
          <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h2 className="modal-title">
                  {previewMedia.name || previewMedia.original_name || 'Visualização de Mídia'}
                </h2>
                <p className="modal-subtitle">
                  Enviado em {new Date(previewMedia.created_at).toLocaleDateString('pt-BR')}
                </p>
              </div>
              <button type="button" className="icon-btn" onClick={() => setPreviewMedia(null)}>
                <X size={16} />
              </button>
            </div>

            <div className="modal-body" style={{ background: '#050507', padding: 0, alignItems: 'center', justifyContent: 'center' }}>
              {isVideoFile(previewMedia) ? (
                <video
                  src={previewMedia.publicUrl || previewMedia.url || ''}
                  controls
                  autoPlay
                  playsInline
                  style={{ width: '100%', maxHeight: '58vh', objectFit: 'contain' }}
                  onError={(e) => {
                    const target = e.currentTarget;
                    if (!target.dataset.triedFallback) {
                      target.dataset.triedFallback = 'true';
                      target.src = '/sample-video.webm';
                      target.load();
                      target.play().catch(() => {});
                    }
                  }}
                />
              ) : (
                <img
                  src={previewMedia.publicUrl || previewMedia.url || ''}
                  alt={previewMedia.name}
                  style={{ width: '100%', maxHeight: '58vh', objectFit: 'contain' }}
                  onError={(e) => {
                    const target = e.currentTarget;
                    if (!target.dataset.triedFallback) {
                      target.dataset.triedFallback = 'true';
                      target.src = '/logo-dark.png';
                    }
                  }}
                />
              )}
            </div>

            <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
              <div>
                {isMediaInPlaylist(previewMedia.id) ? (
                  <span className="badge badge-success">
                    <span className="status-dot online" />
                    Em exibição na grade da TV
                  </span>
                ) : (
                  <span className="badge badge-neutral">Fora da grade</span>
                )}
              </div>

              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => handleOpenDurationModal(previewMedia)}
                  title="Alterar tempo de exibição na TV"
                >
                  <Clock size={13} />
                  <span>Ajustar Tempo ({formatDurationBadge(previewMedia.duration_seconds)})</span>
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  style={{ color: 'var(--danger)' }}
                  onClick={() => handleDeleteMedia(previewMedia)}
                >
                  <Trash2 size={14} />
                  <span>Excluir Mídia</span>
                </button>
                <button type="button" className="btn btn-ghost" onClick={() => setPreviewMedia(null)}>
                  Fechar
                </button>
                {linkedTerminals.length > 0 && (
                  isMediaInPlaylist(previewMedia.id) ? (
                    <button
                      type="button"
                      className="btn btn-danger"
                      onClick={() => {
                        handleRemoveFromTerminal(previewMedia.id);
                        setPreviewMedia(null);
                      }}
                    >
                      <PauseCircle size={14} />
                      <span>Remover da Grade</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-primary"
                      disabled={currentPartnerCount >= maxPartnerSlots}
                      onClick={() => {
                        handleAddToTerminal(previewMedia.id);
                        setPreviewMedia(null);
                      }}
                    >
                      <Plus size={14} />
                      <span>Adicionar à Grade</span>
                    </button>
                  )
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Ajuste de Tempo de Exibição */}
      {editingDurationMedia && (
        <div className="modal-overlay" onClick={() => !savingDuration && setEditingDurationMedia(null)}>
          <div className="modal modal-md" onClick={e => e.stopPropagation()} style={{ maxWidth: '520px' }}>
            <div className="modal-header">
              <div>
                <h2 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Clock size={18} style={{ color: 'var(--accent)' }} />
                  <span>Tempo de Exibição na TV</span>
                </h2>
                <p className="modal-subtitle">
                  Defina por quantos segundos esta mídia será exibida a cada ciclo da grade.
                </p>
              </div>
              <button
                type="button"
                className="icon-btn"
                disabled={savingDuration}
                onClick={() => setEditingDurationMedia(null)}
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveDuration}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* Cartão informativo da mídia */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '12px',
                    background: 'var(--bg-subtle, rgba(255,255,255,0.03))',
                    borderRadius: 'var(--r-md, 8px)',
                    border: '1px solid var(--border-subtle)'
                  }}
                >
                  <div
                    style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '8px',
                      background: 'rgba(0,0,0,0.4)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--accent)',
                      flexShrink: 0
                    }}
                  >
                    {isVideoFile(editingDurationMedia) ? <Film size={20} /> : <ImageIcon size={20} />}
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div
                      style={{
                        fontWeight: 600,
                        fontSize: '13.5px',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}
                    >
                      {editingDurationMedia.name || editingDurationMedia.original_name}
                    </div>
                    <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                      {isVideoFile(editingDurationMedia) ? 'Arquivo de Vídeo MP4' : 'Arquivo de Imagem'}
                      {detectedVideoDuration ? ` · Duração original do arquivo: ${formatDurationBadge(detectedVideoDuration)}` : ''}
                    </div>
                  </div>
                </div>

                {/* Opção Rápida: Colocar tempo do vídeo completo */}
                {isVideoFile(editingDurationMedia) && (
                  <div
                    style={{
                      background: 'var(--accent-glow, rgba(212, 255, 0, 0.08))',
                      border: '1px solid var(--accent, #d4ff00)',
                      borderRadius: 'var(--r-md, 8px)',
                      padding: '12px 14px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '12px'
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '12.5px', color: 'var(--text-primary)' }}>
                        Exibir Vídeo Completo
                      </div>
                      <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                        Tocar do início ao fim sem cortar
                        {detectedVideoDuration ? ` (${formatDurationBadge(detectedVideoDuration)})` : ''}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={() => setCustomDuration(detectedVideoDuration || 300)}
                    >
                      Usar Vídeo Completo
                    </button>
                  </div>
                )}

                {/* Campo de Tempo em Segundos */}
                <div className="input-group">
                  <label className="input-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Duração de Exibição (segundos)</span>
                    <span style={{ color: 'var(--accent)', fontWeight: 600 }}>
                      {formatDurationBadge(customDuration)}
                    </span>
                  </label>
                  <input
                    type="number"
                    min="3"
                    max="3600"
                    step="1"
                    className="input-field"
                    style={{ fontSize: '16px', fontWeight: 600, height: '42px' }}
                    value={customDuration}
                    onChange={e => setCustomDuration(parseInt(e.target.value, 10) || 0)}
                    required
                  />
                  <span className="input-hint" style={{ fontSize: '11.5px', color: 'var(--text-tertiary)' }}>
                    {isVideoFile(editingDurationMedia)
                      ? 'Dica: Se definir um tempo menor que o vídeo, a TV avançará após atingir essa duração.'
                      : 'Recomendado para imagens: entre 10 e 30 segundos.'}
                  </span>
                </div>

                {/* Botões de Seleção Rápida */}
                <div>
                  <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                    Atalhos rápidos:
                  </div>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {[10, 15, 30, 45, 60, 120, 300].map(sec => (
                      <button
                        key={sec}
                        type="button"
                        className={`btn btn-sm ${customDuration === sec ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => setCustomDuration(sec)}
                      >
                        {formatDurationBadge(sec)}
                      </button>
                    ))}
                    {detectedVideoDuration && ![10, 15, 30, 45, 60, 120, 300].includes(detectedVideoDuration) && (
                      <button
                        type="button"
                        className={`btn btn-sm ${customDuration === detectedVideoDuration ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => setCustomDuration(detectedVideoDuration)}
                      >
                        Vídeo ({formatDurationBadge(detectedVideoDuration)})
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-ghost"
                  disabled={savingDuration}
                  onClick={() => setEditingDurationMedia(null)}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={savingDuration || customDuration <= 0}
                >
                  {savingDuration ? <div className="loader" /> : <Check size={14} />}
                  <span>{savingDuration ? 'Salvando...' : 'Salvar Tempo na TV'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
