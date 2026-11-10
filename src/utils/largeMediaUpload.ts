import { supabase, supabaseUrl, supabaseAnonKey } from '../lib/supabase';

// Limite seguro por parte (45 MB) para respeitar o teto de 50 MB por objeto do Supabase Storage
export const PART_SIZE_BYTES = 45 * 1024 * 1024;
// Tamanho do sub-bloco TUS (6 MB é o padrão recomendado pelo protocolo TUS do Supabase)
const TUS_CHUNK_SIZE = 6 * 1024 * 1024;

export interface LargeUploadOptions {
  bucket?: string;
  contentType?: string;
  onProgress?: (percent: number, label?: string) => void;
}

export interface LargeUploadResult {
  filePath: string;
  url: string;
  isChunked: boolean;
  totalChunks: number;
}

export function isChunkedStreamUrl(url?: string | null): boolean {
  return Boolean(url && url.includes('/functions/v1/media-stream'));
}

/**
 * Faz upload de um único Blob/File (<= 45 MB) usando protocolo TUS Resumable em blocos de 6 MB
 * com retentativa automática e progresso real em porcentagem.
 */
async function uploadSingleBlobTus(
  bucket: string,
  objectPath: string,
  blob: Blob,
  contentType: string,
  token: string,
  onBytesUploaded?: (uploadedBytes: number) => void
): Promise<void> {
  const encodeMeta = (val: string) => btoa(unescape(encodeURIComponent(val)));
  const metadata = [
    `bucketName ${encodeMeta(bucket)}`,
    `objectName ${encodeMeta(objectPath)}`,
    `contentType ${encodeMeta(contentType)}`,
    `cacheControl ${encodeMeta('3600')}`
  ].join(',');

  const createRes = await fetch(`${supabaseUrl}/storage/v1/upload/resumable`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: supabaseAnonKey,
      'Tus-Resumable': '1.0.0',
      'Upload-Length': String(blob.size),
      'Upload-Metadata': metadata,
      'x-upsert': 'true'
    }
  });

  if (!createRes.ok) {
    // Fallback para upload padrão caso o endpoint TUS falhe por qualquer motivo
    const { error } = await supabase.storage.from(bucket).upload(objectPath, blob, {
      cacheControl: '3600',
      contentType,
      upsert: true
    });
    if (error) throw error;
    onBytesUploaded?.(blob.size);
    return;
  }

  let uploadUrl = createRes.headers.get('Location') || createRes.headers.get('location');
  if (!uploadUrl) {
    throw new Error('Servidor de armazenamento não retornou URL de sessão TUS.');
  }
  if (uploadUrl.startsWith('/')) {
    uploadUrl = `${supabaseUrl}${uploadUrl}`;
  }

  let offset = 0;
  while (offset < blob.size) {
    const end = Math.min(offset + TUS_CHUNK_SIZE, blob.size);
    const slice = blob.slice(offset, end);

    let success = false;
    let lastErr: any = null;

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const patchRes = await fetch(uploadUrl, {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${token}`,
            apikey: supabaseAnonKey,
            'Tus-Resumable': '1.0.0',
            'Upload-Offset': String(offset),
            'Content-Type': 'application/offset+octet-stream'
          },
          body: slice
        });

        if (patchRes.ok || patchRes.status === 204) {
          const newOffsetHeader = patchRes.headers.get('Upload-Offset') || patchRes.headers.get('upload-offset');
          offset = newOffsetHeader ? parseInt(newOffsetHeader, 10) : end;
          onBytesUploaded?.(offset);
          success = true;
          break;
        } else {
          lastErr = new Error(`Falha no bloco TUS (HTTP ${patchRes.status})`);
        }
      } catch (err) {
        lastErr = err;
      }
      await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
    }

    if (!success) {
      throw lastErr || new Error('Erro de rede durante envio do vídeo.');
    }
  }
}

/**
 * Faz o upload inteligente de qualquer mídia (inclusive vídeos > 500 MB / até 2 GB+).
 * - Arquivos <= 45 MB: enviados diretamente via TUS Resumable Upload.
 * - Arquivos > 45 MB (500 MB+): fatiados automaticamente sem perda de qualidade em partes de 45 MB
 *   e servidos via Edge Function `media-stream` com suporte a HTTP 206 Range Requests.
 */
export async function uploadLargeMediaToSupabase(
  file: File,
  filePath: string,
  options?: LargeUploadOptions
): Promise<LargeUploadResult> {
  const bucket = options?.bucket || 'media';
  const contentType = options?.contentType || file.type || 'video/mp4';
  const onProgress = options?.onProgress;

  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token || supabaseAnonKey;

  onProgress?.(1, 'Iniciando envio...');

  // Caso 1: Arquivo até 45 MB -> objeto único
  if (file.size <= PART_SIZE_BYTES) {
    await uploadSingleBlobTus(bucket, filePath, file, contentType, token, (uploaded) => {
      const pct = Math.min(99, Math.max(1, Math.round((uploaded / file.size) * 100)));
      onProgress?.(pct, `Enviando (${pct}%)`);
    });

    const { data: pubData } = supabase.storage.from(bucket).getPublicUrl(filePath);
    onProgress?.(100, 'Concluído!');

    return {
      filePath,
      url: pubData?.publicUrl || '',
      isChunked: false,
      totalChunks: 1
    };
  }

  // Caso 2: Vídeo grande (> 45 MB, ex: 500 MB, 1 GB+) -> fatiamento binário zero-copy em partes de 45 MB
  const totalChunks = Math.ceil(file.size / PART_SIZE_BYTES);

  for (let idx = 0; idx < totalChunks; idx++) {
    const start = idx * PART_SIZE_BYTES;
    const end = Math.min(start + PART_SIZE_BYTES, file.size);
    const partBlob = file.slice(start, end);
    const partObjectPath = `${filePath}.part${String(idx).padStart(3, '0')}`;

    await uploadSingleBlobTus(
      bucket,
      partObjectPath,
      partBlob,
      'application/octet-stream',
      token,
      (partUploadedBytes) => {
        const totalUploaded = start + partUploadedBytes;
        const pct = Math.min(99, Math.max(1, Math.round((totalUploaded / file.size) * 100)));
        onProgress?.(pct, `Enviando parte ${idx + 1}/${totalChunks} (${pct}%)`);
      }
    );
  }

  const streamUrl =
    `${supabaseUrl}/functions/v1/media-stream` +
    `?path=${encodeURIComponent(filePath)}` +
    `&size=${file.size}` +
    `&chunks=${totalChunks}` +
    `&chunkSize=${PART_SIZE_BYTES}` +
    `&type=${encodeURIComponent(contentType)}`;

  onProgress?.(100, 'Concluído!');

  return {
    filePath,
    url: streamUrl,
    isChunked: true,
    totalChunks
  };
}

/**
 * Remove tanto arquivos únicos quanto todos os segmentos (.part000, .part001...) de vídeos grandes (> 45 MB).
 */
export async function removeLargeMediaFromSupabase(
  filePath?: string | null,
  mediaUrl?: string | null,
  bucket = 'media'
): Promise<void> {
  if (!filePath) return;

  try {
    if (isChunkedStreamUrl(mediaUrl)) {
      const parsed = new URL(mediaUrl!);
      const chunks = parseInt(parsed.searchParams.get('chunks') || '0', 10);
      if (chunks > 0) {
        const pathsToDelete: string[] = [];
        for (let i = 0; i < chunks; i++) {
          pathsToDelete.push(`${filePath}.part${String(i).padStart(3, '0')}`);
        }
        await supabase.storage.from(bucket).remove(pathsToDelete);
        return;
      }
    }
    await supabase.storage.from(bucket).remove([filePath]);
  } catch (err) {
    console.warn('Aviso ao remover mídia do storage:', err);
  }
}

