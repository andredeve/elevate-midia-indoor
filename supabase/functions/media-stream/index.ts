// Supabase Edge Function: media-stream
// Reassembles chunked large video files (>50MB / >500MB+) stored in Supabase Storage
// Supports HTTP 206 Partial Content (Range requests for instant <video> streaming & seeking)
// and HTTP 200 full stream downloads.

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || 'https://tdbruykbguiojwzrjzik.supabase.co';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
  'Access-Control-Allow-Headers': 'Range, Content-Type, Authorization, apikey, x-client-info',
  'Access-Control-Expose-Headers': 'Content-Length, Content-Range, Accept-Ranges, Content-Type',
};

function partPath(basePath: string, index: number): string {
  const padded = String(index).padStart(3, '0');
  return `${basePath}.part${padded}`;
}

function publicObjectUrl(bucket: string, objectPath: string): string {
  const encodedPath = objectPath
    .split('/')
    .map((seg) => encodeURIComponent(seg))
    .join('/');
  return `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${encodedPath}`;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const basePath = url.searchParams.get('path');
    const bucket = url.searchParams.get('bucket') || 'media';
    const totalSizeParam = url.searchParams.get('size');
    const chunksParam = url.searchParams.get('chunks');
    const chunkSizeParam = url.searchParams.get('chunkSize');
    const contentType = url.searchParams.get('type') || 'video/mp4';

    if (!basePath || !totalSizeParam || !chunksParam) {
      return new Response(
        JSON.stringify({ error: 'Missing required query parameters: path, size, chunks' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const totalSize = Number(totalSizeParam);
    const totalChunks = Number(chunksParam);
    const chunkSize = Number(chunkSizeParam) || 45 * 1024 * 1024;

    if (req.method === 'HEAD') {
      return new Response(null, {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': contentType,
          'Content-Length': String(totalSize),
          'Accept-Ranges': 'bytes',
          'Cache-Control': 'public, max-age=86400',
        },
      });
    }

    const rangeHeader = req.headers.get('range') || req.headers.get('Range');

    if (rangeHeader && rangeHeader.startsWith('bytes=')) {
      const parts = rangeHeader.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const requestedEnd = parts[1] ? parseInt(parts[1], 10) : totalSize - 1;

      if (Number.isNaN(start) || start < 0 || start >= totalSize) {
        return new Response(null, {
          status: 416,
          headers: {
            ...corsHeaders,
            'Content-Range': `bytes */${totalSize}`,
          },
        });
      }

      const end = Math.min(requestedEnd, totalSize - 1);
      const contentLength = end - start + 1;

      const startChunkIdx = Math.floor(start / chunkSize);
      const endChunkIdx = Math.floor(end / chunkSize);

      // Fast path: range falls within a single storage part
      if (startChunkIdx === endChunkIdx) {
        const chunkOffsetStart = start - startChunkIdx * chunkSize;
        const chunkOffsetEnd = end - startChunkIdx * chunkSize;
        const partUrl = publicObjectUrl(bucket, partPath(basePath, startChunkIdx));

        const upstream = await fetch(partUrl, {
          headers: { Range: `bytes=${chunkOffsetStart}-${chunkOffsetEnd}` },
        });

        if (!upstream.ok && upstream.status !== 206) {
          return new Response(`Upstream part ${startChunkIdx} error: ${upstream.status}`, {
            status: 502,
            headers: corsHeaders,
          });
        }

        return new Response(upstream.body, {
          status: 206,
          headers: {
            ...corsHeaders,
            'Content-Type': contentType,
            'Content-Range': `bytes ${start}-${end}/${totalSize}`,
            'Content-Length': String(contentLength),
            'Accept-Ranges': 'bytes',
            'Cache-Control': 'public, max-age=86400',
          },
        });
      }

      // Multi-part range path: stream across chunk boundary
      const stream = new ReadableStream({
        async start(controller) {
          try {
            for (let idx = startChunkIdx; idx <= endChunkIdx; idx++) {
              const partGlobalStart = idx * chunkSize;
              const partGlobalEnd = Math.min((idx + 1) * chunkSize - 1, totalSize - 1);
              const sliceStart = Math.max(start, partGlobalStart) - partGlobalStart;
              const sliceEnd = Math.min(end, partGlobalEnd) - partGlobalStart;

              const partUrl = publicObjectUrl(bucket, partPath(basePath, idx));
              const upstream = await fetch(partUrl, {
                headers: { Range: `bytes=${sliceStart}-${sliceEnd}` },
              });

              if (!upstream.ok || !upstream.body) {
                controller.error(new Error(`Failed fetching part ${idx}: ${upstream.status}`));
                return;
              }

              const reader = upstream.body.getReader();
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                if (value) controller.enqueue(value);
              }
            }
            controller.close();
          } catch (err) {
            controller.error(err);
          }
        },
      });

      return new Response(stream, {
        status: 206,
        headers: {
          ...corsHeaders,
          'Content-Type': contentType,
          'Content-Range': `bytes ${start}-${end}/${totalSize}`,
          'Content-Length': String(contentLength),
          'Accept-Ranges': 'bytes',
          'Cache-Control': 'public, max-age=86400',
        },
      });
    }

    // Full file download (no Range header) — streams all parts sequentially
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for (let idx = 0; idx < totalChunks; idx++) {
            const partUrl = publicObjectUrl(bucket, partPath(basePath, idx));
            const upstream = await fetch(partUrl);
            if (!upstream.ok || !upstream.body) {
              controller.error(new Error(`Failed fetching part ${idx}: ${upstream.status}`));
              return;
            }
            const reader = upstream.body.getReader();
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              if (value) controller.enqueue(value);
            }
          }
          controller.close();
        } catch (err) {
          controller.error(err);
        }
      },
    });

    return new Response(stream, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': contentType,
        'Content-Length': String(totalSize),
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message || 'Internal error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

