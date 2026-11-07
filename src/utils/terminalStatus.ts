/**
 * Utilitário centralizado para verificar se um terminal está realmente Online.
 *
 * Como a TV pode ser desligada da tomada, perder o Wi-Fi ou ter o app fechado abruptamente
 * sem conseguir enviar uma requisição final de "offline", não podemos confiar apenas
 * em `terminal.status === 'online'` gravado no banco.
 *
 * O app da TV envia heartbeats periódicos atualizando `last_sync_at`.
 * Consideramos o terminal ONLINE apenas se:
 *  1) `status === 'online'` E
 *  2) `last_sync_at` ocorreu dentro da janela máxima de tolerância (padrão: 75 segundos).
 */

export const TERMINAL_ONLINE_TIMEOUT_MS = 75 * 1000; // 75 segundos (heartbeat do app ocorre a cada 25s)

export function isTerminalOnline(
  terminal?: { status?: string | null; last_sync_at?: string | null; last_seen_at?: string | null } | null,
  nowMs: number = Date.now()
): boolean {
  if (!terminal) return false;
  if (terminal.status !== 'online') return false;

  const syncTimestamp = terminal.last_sync_at || terminal.last_seen_at;
  if (!syncTimestamp) return false;

  const lastSyncMs = new Date(syncTimestamp).getTime();
  if (Number.isNaN(lastSyncMs)) return false;

  return nowMs - lastSyncMs <= TERMINAL_ONLINE_TIMEOUT_MS;
}

