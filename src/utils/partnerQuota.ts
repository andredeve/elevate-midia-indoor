/**
 * Utilitários para sincronização segura e persistente da cota de mídias do parceiro.
 * Permite que a cota definida no Admin seja armazenada e lida pelo Painel do Parceiro
 * em qualquer dispositivo/navegador, com suporte nativo ao banco de dados Supabase.
 */

export function parsePartnerContactAndQuota(
  contactPersonRaw?: string | null,
  maxMediaSlotsDirect?: number | null
): { contactPerson: string; quota: number } {
  // Se a coluna max_media_slots existir e tiver valor válido
  if (typeof maxMediaSlotsDirect === 'number' && maxMediaSlotsDirect > 0) {
    const cleanContact = (contactPersonRaw || '').replace(/\s*\[cota:\d+\]/gi, '').trim();
    return { contactPerson: cleanContact, quota: maxMediaSlotsDirect };
  }

  if (!contactPersonRaw) {
    return { contactPerson: '', quota: 3 };
  }

  const match = contactPersonRaw.match(/\[cota:(\d+)\]/i);
  if (match && match[1]) {
    const quota = parseInt(match[1], 10);
    const cleanContact = contactPersonRaw.replace(/\s*\[cota:\d+\]/gi, '').trim();
    return { contactPerson: cleanContact, quota: quota > 0 ? quota : 3 };
  }

  return { contactPerson: contactPersonRaw.trim(), quota: 3 };
}

export function formatPartnerContactWithQuota(
  contactPerson: string | null | undefined,
  quota: number | string | null | undefined
): string {
  const cleanContact = (contactPerson || '').replace(/\s*\[cota:\d+\]/gi, '').trim();
  const qNum = typeof quota === 'number' ? quota : parseInt(String(quota || '3'), 10) || 3;
  return cleanContact ? `${cleanContact} [cota:${qNum}]` : `[cota:${qNum}]`;
}

