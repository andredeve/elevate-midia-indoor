import { useEffect, useState, useMemo, type FormEvent, type ChangeEvent } from 'react';
import { createClient } from '@supabase/supabase-js';
import { supabase, supabaseUrl, supabaseAnonKey } from '../lib/supabase';
import { parsePartnerContactAndQuota, formatPartnerContactWithQuota } from '../utils/partnerQuota';
import { isTerminalOnline } from '../utils/terminalStatus';
import {
  Users,
  Copy,
  Plus,
  Trash2,
  Edit2,
  X,
  MapPin,
  Phone,
  Building2,
  Award,
  Check,
  Search,
  Clock,
  BarChart3,
  Globe,
  Calendar,
  Tv,
  Wifi,
  WifiOff,
  Unlink,
  Film,
  Play,
  ChevronDown,
  ChevronUp,
  Layers
} from 'lucide-react';
import { useAuthStore } from '../stores/authStore';

interface Partner {
  id: string;
  user_id: string;
  commission_rate: number;
  referral_code: string;
  created_at: string;
  establishment_name?: string;
  student_count?: number;
  category?: string;
  cep?: string;
  city?: string;
  state?: string;
  neighborhood?: string;
  address?: string;
  target_audience?: string;
  working_days?: string;
  operating_hours?: string;
  peak_hours?: string;
  phone?: string;
  contact_person?: string;
  max_media_slots?: number;
  users?: {
    email: string;
    raw_user_meta_data?: any;
  };
}

const CATEGORIES = [
  'Comércio & Varejo',
  'Clínica & Saúde',
  'Restaurante & Gastronomia',
  'Condomínio & Corporativo',
  'Academia & Fitness',
  'Shopping & Galeria',
  'Supermercado & Padaria',
  'Salão & Estética',
  'Outro'
];

const TARGET_AUDIENCES = [
  'Jovens e Adultos (18 a 40 anos)',
  'Público Feminino Predominante (60%+ fem)',
  'Público Masculino Predominante (60%+ masc)',
  'Estudantes & Universitários',
  'Público Executivo / Faria Lima',
  'Atletas & Alta Performance',
  'Meia Idade & Terceira Idade (40+)',
  'Familiar / Todas as Idades',
  'Outro / Geral'
];

export interface DayScheduleItem {
  id: string; // 'seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom'
  label: string; // 'Segunda-feira', ...
  short: string; // 'SEG', 'TER', ...
  isOpen: boolean;
  openTime: string; // '06:00'
  closeTime: string; // '22:00'
}

const DEFAULT_WEEK_SCHEDULE: DayScheduleItem[] = [
  { id: 'seg', label: 'Segunda-feira', short: 'SEG', isOpen: true, openTime: '06:00', closeTime: '22:00' },
  { id: 'ter', label: 'Terça-feira', short: 'TER', isOpen: true, openTime: '06:00', closeTime: '22:00' },
  { id: 'qua', label: 'Quarta-feira', short: 'QUA', isOpen: true, openTime: '06:00', closeTime: '22:00' },
  { id: 'qui', label: 'Quinta-feira', short: 'QUI', isOpen: true, openTime: '06:00', closeTime: '22:00' },
  { id: 'sex', label: 'Sexta-feira', short: 'SEX', isOpen: true, openTime: '06:00', closeTime: '22:00' },
  { id: 'sab', label: 'Sábado', short: 'SÁB', isOpen: true, openTime: '08:00', closeTime: '18:00' },
  { id: 'dom', label: 'Domingo', short: 'DOM', isOpen: false, openTime: '08:00', closeTime: '14:00' }
];

const computeScheduleSummary = (schedule: DayScheduleItem[]) => {
  const openDays = schedule.filter(d => d.isOpen);
  if (openDays.length === 0) {
    return { workingDays: 'Fechado temporariamente', operatingHours: 'Sem funcionamento' };
  }

  let workingDays = '';
  const ids = openDays.map(d => d.id);
  const isSegSex = ids.length === 5 && ['seg', 'ter', 'qua', 'qui', 'sex'].every(id => ids.includes(id));
  const isSegSab = ids.length === 6 && ['seg', 'ter', 'qua', 'qui', 'sex', 'sab'].every(id => ids.includes(id));
  const isAll = ids.length === 7;

  if (isAll) workingDays = 'Todos os dias (Segunda a Domingo)';
  else if (isSegSab) workingDays = 'Segunda a Sábado';
  else if (isSegSex) workingDays = 'Segunda a Sexta-feira';
  else workingDays = openDays.map(d => d.label.replace('-feira', '')).join(', ');

  const first = openDays[0];
  const allSameHours = openDays.every(d => d.openTime === first.openTime && d.closeTime === first.closeTime);

  let operatingHours = '';
  if (allSameHours) {
    if (first.openTime === '00:00' && first.closeTime === '23:59') {
      operatingHours = '24 Horas / Todos os Dias';
    } else {
      operatingHours = `${first.openTime} às ${first.closeTime}`;
    }
  } else {
    const segSexOpen = schedule.filter(d => ['seg', 'ter', 'qua', 'qui', 'sex'].includes(d.id) && d.isOpen);
    const sabOpen = schedule.find(d => d.id === 'sab' && d.isOpen);
    const domOpen = schedule.find(d => d.id === 'dom' && d.isOpen);

    const parts: string[] = [];
    if (segSexOpen.length > 0) {
      parts.push(`Seg-Sex: ${segSexOpen[0].openTime} às ${segSexOpen[0].closeTime}`);
    }
    if (sabOpen) {
      parts.push(`Sáb: ${sabOpen.openTime} às ${sabOpen.closeTime}`);
    }
    if (domOpen) {
      parts.push(`Dom: ${domOpen.openTime} às ${domOpen.closeTime}`);
    }
    operatingHours = parts.join(' • ') || `${first.openTime} às ${first.closeTime}`;
  }

  return { workingDays, operatingHours };
};

const parseInitialWeekSchedule = (workingDaysStr?: string, operatingHoursStr?: string): DayScheduleItem[] => {
  const base = DEFAULT_WEEK_SCHEDULE.map(d => ({ ...d }));
  if (!workingDaysStr) return base;
  const lower = workingDaysStr.toLowerCase();
  const is24h = (operatingHoursStr || '').toLowerCase().includes('24');

  if (lower.includes('todos') || lower.includes('domingo')) {
    base.forEach(d => {
      d.isOpen = true;
      if (is24h) {
        d.openTime = '00:00';
        d.closeTime = '23:59';
      }
    });
  } else if (lower.includes('sábado') || lower.includes('sabado')) {
    base.forEach(d => {
      if (d.id !== 'dom') d.isOpen = true;
      else d.isOpen = false;
      if (is24h && d.isOpen) {
        d.openTime = '00:00';
        d.closeTime = '23:59';
      }
    });
  } else if (lower.includes('sexta')) {
    base.forEach(d => {
      if (['seg', 'ter', 'qua', 'qui', 'sex'].includes(d.id)) d.isOpen = true;
      else d.isOpen = false;
      if (is24h && d.isOpen) {
        d.openTime = '00:00';
        d.closeTime = '23:59';
      }
    });
  }
  return base;
};

const getTimelineOffsets = (openTime: string, closeTime: string) => {
  const [startH, startM] = (openTime || '06:00').split(':').map(Number);
  const [endH, endM] = (closeTime || '22:00').split(':').map(Number);
  const startMin = (startH || 0) * 60 + (startM || 0);
  const endMin = (endH || 0) * 60 + (endM || 0);
  const leftPct = Math.max(0, Math.min(100, (startMin / 1440) * 100));
  const widthPct = Math.max(2, Math.min(100 - leftPct, ((endMin - startMin) / 1440) * 100));
  return { leftPct, widthPct };
};

const PEAK_HOURS_OPTIONS = [
  'Manhã e Noite (06h-09h e 18h-21h) - Padrão',
  'Pico Noturno (17h30 às 21h30)',
  'Pico Matutino (06h00 às 09h30)',
  'Almoço e Noite (11h-14h e 18h-21h)',
  'Horário Comercial (08h00 às 18h00)',
  'Fluxo Constante / O Dia Todo',
  'Outro'
];

export default function PartnerManagement() {
  const { user } = useAuthStore();
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedPartnerForReport, setSelectedPartnerForReport] = useState<Partner | null>(null);
  const [selectedPartnerForTerminals, setSelectedPartnerForTerminals] = useState<Partner | null>(null);
  const [selectedPartnerForMedia, setSelectedPartnerForMedia] = useState<Partner | null>(null);
  const [partnerMediaList, setPartnerMediaList] = useState<any[]>([]);
  const [partnerPlaylistItems, setPartnerPlaylistItems] = useState<any[]>([]);
  const [partnerTerminals, setPartnerTerminals] = useState<any[]>([]);
  const [partnerPlaylists, setPartnerPlaylists] = useState<any[]>([]);
  const [loadingPartnerMedia, setLoadingPartnerMedia] = useState(false);
  const [isPlaylistCollapsed, setIsPlaylistCollapsed] = useState(false);
  const [isInternalVideosCollapsed, setIsInternalVideosCollapsed] = useState(false);
  const [mediaModalTab, setMediaModalTab] = useState<'all' | 'playlist' | 'internal'>('all');
  const [videoPreviewItem, setVideoPreviewItem] = useState<{ url: string; name: string; type: string } | null>(null);
  const [allTerminals, setAllTerminals] = useState<any[]>([]);
  const [terminalSearchQuery, setTerminalSearchQuery] = useState('');
  const [terminalStatusFilter, setTerminalStatusFilter] = useState<'all' | 'online' | 'offline'>('all');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // CEP Auto-fill state
  const [loadingCep, setLoadingCep] = useState(false);
  const [cepError, setCepError] = useState('');

  // Filter & Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Todos');

  // Form State
  const [editingPartner, setEditingPartner] = useState<Partner | null>(null);
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [commission, setCommission] = useState('0.10');
  const [referralCode, setReferralCode] = useState('');
  const [establishmentName, setEstablishmentName] = useState('');
  const [studentCount, setStudentCount] = useState('500');
  const [category, setCategory] = useState('Comércio & Varejo');
  const [cep, setCep] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('SP');
  const [neighborhood, setNeighborhood] = useState('');
  const [address, setAddress] = useState('');
  const [targetAudience, setTargetAudience] = useState('Jovens e Adultos (18 a 40 anos)');
  const [workingDays, setWorkingDays] = useState('Segunda a Sábado');
  const [operatingHours, setOperatingHours] = useState('06h00 às 22h00');
  const [peakHours, setPeakHours] = useState('Manhã e Noite (06h-09h e 18h-21h) - Padrão');
  const [phone, setPhone] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [maxMediaSlots, setMaxMediaSlots] = useState('3');
  const [weekSchedule, setWeekSchedule] = useState<DayScheduleItem[]>(DEFAULT_WEEK_SCHEDULE);

  const updateScheduleState = (next: DayScheduleItem[]) => {
    setWeekSchedule(next);
    const { workingDays: wd, operatingHours: oh } = computeScheduleSummary(next);
    setWorkingDays(wd);
    setOperatingHours(oh);
  };

  const loadPartners = async () => {
    setLoading(true);
    const [partnersRes, terminalsRes] = await Promise.all([
      supabase.from('partners').select('*, users(email)').order('created_at', { ascending: false }),
      supabase.from('terminals').select('*').order('name', { ascending: true })
    ]);

    if (partnersRes.data && !partnersRes.error) {
      const termsList = terminalsRes.data || [];
      const enriched = (partnersRes.data as Partner[]).map(p => {
        const { contactPerson: cleanContact, quota: parsedQuota } = parsePartnerContactAndQuota(
          p.contact_person,
          p.max_media_slots
        );

        // Verifica cota nos terminais vinculados no banco de dados
        const termWithQuota = termsList.find((t: any) => t.partner_id === p.id && t.device_info?.partner_quota);
        const termQuota = termWithQuota?.device_info?.partner_quota ? Number(termWithQuota.device_info.partner_quota) : null;

        let quota = termQuota || parsedQuota || 3;
        try {
          const stored = localStorage.getItem(`@gymplay_partner_slots_${p.id}`) ||
            (p.referral_code ? localStorage.getItem(`@gymplay_partner_slots_code_${p.referral_code}`) : null);
          if (stored) quota = parseInt(stored, 10);
        } catch {
          /* ignore */
        }
        return {
          ...p,
          contact_person: cleanContact,
          max_media_slots: quota
        };
      });
      setPartners(enriched);
    } else if (partnersRes.error) {
      console.error('Error loading partners:', partnersRes.error);
    }
    if (terminalsRes.data) {
      setAllTerminals(terminalsRes.data);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadPartners();
  }, []);

  const handleOpenPartnerMediaModal = async (partner: Partner) => {
    setSelectedPartnerForMedia(partner);
    setLoadingPartnerMedia(true);
    setPartnerMediaList([]);
    setPartnerPlaylistItems([]);
    setPartnerTerminals([]);
    setPartnerPlaylists([]);
    setIsPlaylistCollapsed(false);
    setIsInternalVideosCollapsed(false);
    setMediaModalTab('all');

    try {
      // 1. Terminais vinculados ao parceiro
      const { data: terms } = await supabase
        .from('terminals')
        .select('id, name, location, status, last_sync_at, device_info')
        .eq('partner_id', partner.id);

      const loadedTerms = terms || [];
      setPartnerTerminals(loadedTerms);

      const termWithQuota = loadedTerms.find((t: any) => t.device_info?.partner_quota);
      const liveQuota = termWithQuota?.device_info?.partner_quota
        ? Number(termWithQuota.device_info.partner_quota)
        : (partner.max_media_slots || 3);

      setSelectedPartnerForMedia({
        ...partner,
        max_media_slots: liveQuota
      });
      const terminalIds = loadedTerms.map((t: any) => t.id);

      // 2. Playlists vinculadas aos terminais
      const activeItems: any[] = [];
      const loadedPlaylists: any[] = [];

      if (terminalIds.length > 0) {
        const { data: pls } = await supabase
          .from('playlists')
          .select(`
            id,
            name,
            terminal_id,
            version,
            playlist_items (
              id,
              order,
              duration_override,
              media:media_files (*)
            )
          `)
          .in('terminal_id', terminalIds);

        (pls || []).forEach((p: any) => {
          const terminalObj = loadedTerms.find((t: any) => t.id === p.terminal_id);
          const terminalName = terminalObj?.name || 'Terminal';
          loadedPlaylists.push({
            ...p,
            terminalName
          });

          (p.playlist_items || []).forEach((pi: any) => {
            activeItems.push({
              ...pi,
              terminalName,
              playlistName: p.name
            });
          });
        });
      }

      setPartnerPlaylists(loadedPlaylists);

      // Ordenar os itens da playlist comercial pelo order
      activeItems.sort((a, b) => (a.order || 0) - (b.order || 0));

      // 3. Mídias cadastradas pelo parceiro (vídeos internos)
      const { data: mediaFiles } = await supabase
        .from('media_files')
        .select('*')
        .eq('partner_id', partner.id)
        .order('created_at', { ascending: false });

      // 4. Resolver URLs assinadas seguras
      const resolvedMediaList = await Promise.all(
        (mediaFiles || []).map(async (m: any) => {
          let playUrl = m.url;
          if (m.file_path) {
            try {
              const { data: signed } = await supabase.storage
                .from('media')
                .createSignedUrl(m.file_path, 86400);
              playUrl = signed?.signedUrl || playUrl;
            } catch {
              // fallback
            }
          }
          return { ...m, playUrl };
        })
      );

      const resolvedPlaylistItems = await Promise.all(
        activeItems.map(async (pi: any) => {
          let playUrl = pi.media?.url;
          if (pi.media?.file_path) {
            try {
              const { data: signed } = await supabase.storage
                .from('media')
                .createSignedUrl(pi.media.file_path, 86400);
              playUrl = signed?.signedUrl || playUrl;
            } catch {
              // fallback
            }
          }
          return { ...pi, playUrl };
        })
      );

      setPartnerMediaList(resolvedMediaList);
      setPartnerPlaylistItems(resolvedPlaylistItems);
    } catch (err) {
      console.error('Erro ao carregar mídias do parceiro:', err);
    } finally {
      setLoadingPartnerMedia(false);
    }
  };

  const handleOpenModal = (partner?: Partner) => {
    setErrorMsg('');
    setCepError('');
    if (partner) {
      setEditingPartner(partner);
      setCommission(partner.commission_rate ? partner.commission_rate.toString() : '0.10');
      setReferralCode(partner.referral_code || '');
      setEstablishmentName(partner.establishment_name || 'Unidade Elevate');
      setStudentCount((partner.student_count || 0).toString());
      setCategory(partner.category || 'Comércio & Varejo');
      setCep(partner.cep || '');
      setCity(partner.city || '');
      setState(partner.state || 'SP');
      setNeighborhood(partner.neighborhood || '');
      setAddress(partner.address || '');
      setTargetAudience(partner.target_audience || 'Jovens e Adultos (18 a 40 anos)');
      setWorkingDays(partner.working_days || 'Segunda a Sábado');
      setOperatingHours(partner.operating_hours || '06h00 às 22h00');
      setWeekSchedule(parseInitialWeekSchedule(partner.working_days, partner.operating_hours));
      setPeakHours(partner.peak_hours || 'Manhã e Noite (06h-09h e 18h-21h) - Padrão');
      setPhone(partner.phone || '');

      const { contactPerson: cleanContact, quota: parsedQuota } = parsePartnerContactAndQuota(
        partner.contact_person,
        partner.max_media_slots
      );
      setContactPerson(cleanContact);

      let partnerQuota = String(partner.max_media_slots || parsedQuota || 3);
      try {
        const storedQuota = localStorage.getItem(`@gymplay_partner_slots_${partner.id}`);
        if (storedQuota) partnerQuota = storedQuota;
      } catch {
        /* ignore */
      }
      setMaxMediaSlots(partnerQuota);
    } else {
      setEditingPartner(null);
      setNewEmail('');
      setNewPassword('');
      setCommission('0.10');
      setReferralCode('');
      setEstablishmentName('');
      setStudentCount('500');
      setCategory('Comércio & Varejo');
      setCep('');
      setCity('');
      setState('SP');
      setNeighborhood('');
      setAddress('');
      setTargetAudience('Jovens e Adultos (18 a 40 anos)');
      setWorkingDays('Segunda a Sábado');
      setOperatingHours('06h00 às 22h00');
      setWeekSchedule(DEFAULT_WEEK_SCHEDULE.map(d => ({ ...d })));
      setPeakHours('Manhã e Noite (06h-09h e 18h-21h) - Padrão');
      setPhone('');
      setContactPerson('');
      setMaxMediaSlots('3');
    }
    setIsModalOpen(true);
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  // Formatação dinâmica do WhatsApp / Telefone: (DD) 9XXXX-XXXX ou (DD) XXXX-XXXX
  const formatPhoneInput = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 11);
    if (!digits) return '';
    if (digits.length <= 2) return `(${digits}`;
    if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
  };

  const handlePhoneChange = (e: ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneInput(e.target.value);
    setPhone(formatted);
  };

  // Formatação e preenchimento automático por CEP via ViaCEP
  const formatCepInput = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 8);
    if (digits.length <= 5) return digits;
    return `${digits.slice(0, 5)}-${digits.slice(5, 8)}`;
  };

  const handleCepChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCepInput(e.target.value);
    setCep(formatted);
    const cleanCep = formatted.replace(/\D/g, '');

    if (cleanCep.length === 8) {
      setLoadingCep(true);
      setCepError('');
      try {
        const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
        const data = await response.json();
        if (data.erro) {
          setCepError('CEP não encontrado nos Correios.');
        } else {
          if (data.logradouro) setAddress(data.logradouro);
          if (data.bairro) setNeighborhood(data.bairro);
          if (data.localidade) setCity(data.localidade);
          if (data.uf) setState(data.uf);
        }
      } catch (err) {
        console.error('Erro na consulta do CEP:', err);
        setCepError('Erro de conexão ao buscar CEP.');
      } finally {
        setLoadingCep(false);
      }
    }
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg('');

    try {
      const quotaNum = parseInt(maxMediaSlots, 10) || 3;
      const encodedContact = formatPartnerContactWithQuota(contactPerson, quotaNum);

      if (editingPartner) {
        // Mode: EDIT
        const basePayload: any = {
          commission_rate: parseFloat(commission) || 0.1,
          referral_code: referralCode || null,
          establishment_name: establishmentName || 'Unidade Elevate',
          student_count: parseInt(studentCount, 10) || 0,
          category,
          cep,
          city,
          state,
          neighborhood,
          address,
          target_audience: targetAudience,
          working_days: workingDays,
          operating_hours: operatingHours,
          peak_hours: peakHours,
          phone,
          contact_person: encodedContact
        };

        let { error } = await supabase
          .from('partners')
          .update({
            ...basePayload,
            max_media_slots: quotaNum
          })
          .eq('id', editingPartner.id);

        if (error && error.message?.includes('max_media_slots')) {
          const fallbackRes = await supabase
            .from('partners')
            .update(basePayload)
            .eq('id', editingPartner.id);
          error = fallbackRes.error;
        }

        if (error) throw new Error('Erro ao atualizar parceiro: ' + error.message);

        // Atualiza cota nos terminais vinculados no Supabase (garantindo acesso ao painel do parceiro em qualquer dispositivo)
        try {
          const { data: linkedTerms } = await supabase
            .from('terminals')
            .select('id, device_info')
            .eq('partner_id', editingPartner.id);

          if (linkedTerms && linkedTerms.length > 0) {
            for (const term of linkedTerms) {
              const updatedDeviceInfo = {
                ...(term.device_info || {}),
                partner_quota: quotaNum
              };
              await supabase
                .from('terminals')
                .update({ device_info: updatedDeviceInfo })
                .eq('id', term.id);
            }
          }
        } catch (tErr) {
          console.warn('Aviso ao sincronizar cota no terminal:', tErr);
        }

        // Persiste cota de mídias deste parceiro em cache local
        try {
          localStorage.setItem(`@gymplay_partner_slots_${editingPartner.id}`, quotaNum.toString());
          if (referralCode) {
            localStorage.setItem(`@gymplay_partner_slots_code_${referralCode}`, quotaNum.toString());
          }
        } catch {
          /* ignore */
        }
      } else {
        // Mode: CREATE
        const { data: adminData } = await supabase
          .from('users')
          .select('org_id')
          .eq('id', user?.id)
          .single();

        const orgId = adminData?.org_id;
        if (!orgId) throw new Error('Não foi possível identificar a organização do admin.');

        const tempClient = createClient(
          supabaseUrl,
          supabaseAnonKey,
          { auth: { persistSession: false } }
        );

        const { data: authData, error: authError } = await tempClient.auth.signUp({
          email: newEmail,
          password: newPassword,
          options: {
            data: {
              role: 'partner',
              org_id: orgId
            }
          }
        });

        if (authError) {
          if (authError.message.includes('already registered')) {
            throw new Error('Este e-mail já está cadastrado no sistema.');
          }
          throw new Error(authError.message);
        }

        const newUserId = authData.user?.id;
        if (!newUserId) throw new Error('Falha ao obter ID do novo usuário.');

        await new Promise(resolve => setTimeout(resolve, 1000));

        const generatedCode = referralCode || `PART-${Math.floor(1000 + Math.random() * 9000)}`;

        const newPartnerPayload: any = {
          user_id: newUserId,
          org_id: orgId,
          commission_rate: parseFloat(commission) || 0.1,
          referral_code: generatedCode,
          establishment_name: establishmentName || 'Unidade Elevate',
          student_count: parseInt(studentCount, 10) || 0,
          category,
          cep,
          city,
          state,
          neighborhood,
          address,
          target_audience: targetAudience,
          working_days: workingDays,
          operating_hours: operatingHours,
          peak_hours: peakHours,
          phone,
          contact_person: encodedContact
        };

        let { error: partError } = await supabase
          .from('partners')
          .insert([{ ...newPartnerPayload, max_media_slots: quotaNum }]);

        if (partError && partError.message?.includes('max_media_slots')) {
          const fallbackRes = await supabase
            .from('partners')
            .insert([newPartnerPayload]);
          partError = fallbackRes.error;
        }

        if (partError) {
          console.error('Insert Partner error:', partError);
          throw new Error('Falha ao criar o perfil do parceiro. ' + partError.message);
        }

        // Persiste cota de mídias por código/user do parceiro
        try {
          localStorage.setItem(`@gymplay_partner_slots_code_${generatedCode}`, quotaNum.toString());
          if (newUserId) {
            localStorage.setItem(`@gymplay_partner_slots_user_${newUserId}`, quotaNum.toString());
          }
        } catch {
          /* ignore */
        }
      }

      setIsModalOpen(false);
      loadPartners();
      if (!editingPartner) {
        alert('Estabelecimento parceiro cadastrado com sucesso!');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Ocorreu um erro ao salvar o parceiro.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeletePartner = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este parceiro? Esta ação não pode ser desfeita.')) return;

    const { error } = await supabase.from('partners').delete().eq('id', id);
    if (error) {
      alert('Erro ao excluir: ' + error.message);
    } else {
      loadPartners();
    }
  };

  const handleUnlinkTerminal = async (terminalId: string) => {
    if (!confirm('Deseja realmente desvincular este terminal desta unidade?')) return;
    try {
      const { error } = await supabase
        .from('terminals')
        .update({ partner_id: null })
        .eq('id', terminalId);
      if (error) throw error;
      await loadPartners();
    } catch (err: any) {
      alert('Erro ao desvincular terminal: ' + (err.message || 'Erro desconhecido'));
    }
  };

  // KPIs & Statistics for report generation
  const totalStudentsReach = useMemo(() => {
    return partners.reduce((acc, p) => acc + (p.student_count || 0), 0);
  }, [partners]);

  const uniqueCities = useMemo(() => {
    const cities = partners.map(p => p.city).filter(Boolean);
    return new Set(cities).size;
  }, [partners]);

  const averageCommission = useMemo(() => {
    if (partners.length === 0) return 10;
    const total = partners.reduce((acc, p) => acc + (p.commission_rate || 0), 0);
    return ((total / partners.length) * 100).toFixed(0);
  }, [partners]);

  // Filtered list
  const filteredPartners = useMemo(() => {
    return partners.filter(p => {
      const matchCat =
        selectedCategory === 'Todos' || (p.category || 'Comércio & Varejo') === selectedCategory;
      const q = searchQuery.toLowerCase().trim();
      if (!q) return matchCat;
      const nameMatch = (p.establishment_name || '').toLowerCase().includes(q);
      const emailMatch = (p.users?.email || '').toLowerCase().includes(q);
      const cityMatch = (p.city || '').toLowerCase().includes(q);
      const contactMatch = (p.contact_person || '').toLowerCase().includes(q);
      return matchCat && (nameMatch || emailMatch || cityMatch || contactMatch);
    });
  }, [partners, selectedCategory, searchQuery]);

  return (
    <div className="page-shell fade-up">
      {/* Header */}
      <div className="page-header">
        <div className="page-title-group">
          <div className="page-title-row">
            <h1 className="page-title">Parceiros & Unidades</h1>
            <span className="badge badge-neutral">Mídia Kit</span>
          </div>
          <p className="page-subtitle">
            Gerencie estabelecimentos parceiros, indicadores de audiência, grade de funcionamento e terminais vinculados.
          </p>
        </div>

        <div className="page-actions">
          <button type="button" className="btn btn-primary" onClick={() => handleOpenModal()}>
            <Plus size={15} />
            <span>Novo Parceiro</span>
          </button>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-label">Unidades na Rede</span>
            <span className="kpi-icon"><Building2 size={15} /></span>
          </div>
          <div className="kpi-value">{partners.length}</div>
          <div className="kpi-meta">Estabelecimentos credenciados</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-label">Alcance Total de Público</span>
            <span className="kpi-icon"><Users size={15} /></span>
          </div>
          <div className="kpi-value">{totalStudentsReach.toLocaleString('pt-BR')}</div>
          <div className="kpi-meta">Público frequentador ativo</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-label">Cidades Cobertas</span>
            <span className="kpi-icon"><Globe size={15} /></span>
          </div>
          <div className="kpi-value">{uniqueCities}</div>
          <div className="kpi-meta">Abrangência geográfica</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-label">Comissão Média</span>
            <span className="kpi-icon"><Award size={15} /></span>
          </div>
          <div className="kpi-value">{averageCommission}%</div>
          <div className="kpi-meta">Repasse sobre indicações</div>
        </div>
      </div>

      {/* Toolbar: Search + Category Filter Pills */}
      <div className="toolbar" style={{ alignItems: 'flex-start' }}>
        <div className="filter-pills">
          <button
            type="button"
            className={`filter-pill ${selectedCategory === 'Todos' ? 'active' : ''}`}
            onClick={() => setSelectedCategory('Todos')}
          >
            Todos
          </button>
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              type="button"
              className={`filter-pill ${selectedCategory === cat ? 'active' : ''}`}
              onClick={() => setSelectedCategory(cat)}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="search-field">
          <Search size={14} className="search-field-icon" />
          <input
            type="text"
            placeholder="Buscar estabelecimento, e-mail, cidade ou contato..."
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

      {/* Partners Table */}
      <div className="table-card">
        {loading ? (
          <div className="loading-state">
            <div className="loader" />
            <span>Carregando rede de parceiros...</span>
          </div>
        ) : filteredPartners.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">
              <Building2 size={18} />
            </div>
            <div className="empty-state-title">Nenhum estabelecimento encontrado</div>
            <div className="empty-state-desc">
              {searchQuery || selectedCategory !== 'Todos'
                ? 'Ajuste a categoria selecionada ou limpe o campo de busca.'
                : 'Cadastre o primeiro estabelecimento parceiro para expandir sua rede de telas.'}
            </div>
          </div>
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Estabelecimento</th>
                  <th>Audiência (Mídia Kit)</th>
                  <th>Terminais</th>
                  <th>Localização & Contato</th>
                  <th>Comissão & Código</th>
                  <th style={{ textAlign: 'right' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredPartners.map(partner => {
                  const students = partner.student_count || 0;
                  const estName = partner.establishment_name || 'Unidade Elevate';
                  const catName = partner.category || 'Comércio & Varejo';
                  const initial = estName.charAt(0).toUpperCase();
                  const partnerTerminals = allTerminals.filter(t => t.partner_id === partner.id);
                  const onlineCount = partnerTerminals.filter(t => isTerminalOnline(t)).length;

                  return (
                    <tr key={partner.id}>
                      {/* Estabelecimento */}
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '11px' }}>
                          <div className="entity-avatar">{initial}</div>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                              <span className="cell-primary">{estName}</span>
                              <span className="badge badge-neutral">{catName}</span>
                            </div>
                            <div className="cell-secondary">
                              {partner.users?.email || 'E-mail indisponível'}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Alcance & Alunos */}
                      <td>
                        <div className="cell-primary tabular-nums">
                          {students.toLocaleString('pt-BR')} visitantes/mês
                        </div>
                        <div className="cell-secondary">
                          Pico: {partner.peak_hours || '18h às 21h'}
                        </div>
                      </td>

                      {/* Terminais & TVs */}
                      <td>
                        <button
                          type="button"
                          className={`btn btn-sm ${partnerTerminals.length > 0 ? 'btn-secondary' : 'btn-ghost'}`}
                          onClick={() => {
                            setTerminalSearchQuery('');
                            setTerminalStatusFilter('all');
                            setSelectedPartnerForTerminals(partner);
                          }}
                          title="Gerenciar telas vinculadas"
                        >
                          {partnerTerminals.length > 0 ? (
                            <>
                              <span className={`status-dot ${onlineCount > 0 ? 'online' : 'neutral'}`} />
                              <span className="tabular-nums">
                                {partnerTerminals.length} TV{partnerTerminals.length > 1 ? 's' : ''} ({onlineCount} online)
                              </span>
                            </>
                          ) : (
                            <>
                              <Tv size={12} />
                              <span>Sem TVs</span>
                            </>
                          )}
                        </button>
                      </td>

                      {/* Localização & Contato */}
                      <td>
                        <div className="cell-primary">
                          {partner.city
                            ? `${partner.city}${partner.state ? ` - ${partner.state}` : ''}`
                            : 'Local não informado'}
                        </div>
                        <div className="cell-secondary tabular-nums">
                          {partner.phone || partner.contact_person
                            ? [partner.contact_person, partner.phone].filter(Boolean).join(' · ')
                            : 'Sem telefone'}
                        </div>
                      </td>

                      {/* Comissão & Referência */}
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '5px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span className="cell-secondary tabular-nums" style={{ marginTop: 0, color: 'var(--success)' }}>
                              {((partner.commission_rate || 0.1) * 100).toFixed(0)}% comissão
                            </span>
                            <span className="badge badge-neutral" style={{ fontSize: '10.5px' }} title="Limite de mídias permitidas pelo parceiro na grade">
                              Cota: {partner.max_media_slots || 3} mídias
                            </span>
                          </div>
                          {partner.referral_code ? (
                            <button
                              type="button"
                              className="code-chip"
                              onClick={() => handleCopyCode(partner.referral_code)}
                              title="Copiar código de indicação"
                            >
                              <span>{partner.referral_code}</span>
                              {copiedCode === partner.referral_code ? (
                                <Check size={11} style={{ color: 'var(--success)' }} />
                              ) : (
                                <Copy size={11} style={{ color: 'var(--text-tertiary)' }} />
                              )}
                            </button>
                          ) : (
                            <span className="cell-secondary">—</span>
                          )}
                        </div>
                      </td>

                      {/* Ações */}
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleOpenPartnerMediaModal(partner)}
                            title="Ver quais vídeos este parceiro está exibindo na TV"
                          >
                            <Film size={12} />
                            <span>Vídeos na TV</span>
                          </button>
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            onClick={() => setSelectedPartnerForReport(partner)}
                            title="Abrir Ficha Mídia Kit"
                          >
                            <BarChart3 size={12} />
                            <span>Mídia Kit</span>
                          </button>
                          <button
                            type="button"
                            className="icon-btn"
                            onClick={() => handleOpenModal(partner)}
                            title="Editar estabelecimento"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            type="button"
                            className="icon-btn danger"
                            onClick={() => handleDeletePartner(partner.id)}
                            title="Excluir parceiro"
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

      {/* MODAL 1: CRIAR / EDITAR PARCEIRO */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h2 className="modal-title">
                  {editingPartner ? 'Editar Estabelecimento Parceiro' : 'Novo Estabelecimento Parceiro'}
                </h2>
                <p className="modal-subtitle">
                  Os indicadores preenchidos alimentam o Mídia Kit comercial e os relatórios de audiência.
                </p>
              </div>
              <button type="button" className="icon-btn" onClick={() => setIsModalOpen(false)}>
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', minHeight: 0, flex: 1 }}>
              <div className="modal-body">
                {errorMsg && <div className="alert-error">{errorMsg}</div>}

                {/* SEÇÃO 1: ESTABELECIMENTO & ALCANCE */}
                <div className="form-section">
                  <div className="form-section-header">
                    <span className="form-section-title">
                      <Building2 size={14} />
                      <span>Dados do Estabelecimento & Audiência</span>
                    </span>
                  </div>

                  <div className="form-grid-2">
                    <div className="input-group">
                      <label className="input-label">Nome do Estabelecimento / Unidade *</label>
                      <input
                        type="text"
                        className="input-field"
                        placeholder="Ex: Unidade Elevate Centro"
                        value={establishmentName}
                        onChange={e => setEstablishmentName(e.target.value)}
                        required
                      />
                    </div>

                    <div className="input-group">
                      <label className="input-label">Categoria / Segmento *</label>
                      <select
                        className="select-field"
                        value={category}
                        onChange={e => setCategory(e.target.value)}
                      >
                        {CATEGORIES.map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="form-grid-2">
                    <div className="input-group">
                      <label className="input-label">Fluxo Mensal / Frequentadores *</label>
                      <input
                        type="number"
                        min="0"
                        className="input-field tabular-nums"
                        placeholder="Ex: 1500"
                        value={studentCount}
                        onChange={e => setStudentCount(e.target.value)}
                        required
                      />
                      <span className="input-hint">Base para cálculo de alcance e CPM</span>
                    </div>

                    <div className="input-group">
                      <label className="input-label">Público Predominante *</label>
                      <select
                        className="select-field"
                        value={targetAudience}
                        onChange={e => setTargetAudience(e.target.value)}
                      >
                        {TARGET_AUDIENCES.map(aud => (
                          <option key={aud} value={aud}>{aud}</option>
                        ))}
                      </select>
                      <span className="input-hint">Perfil demográfico principal da unidade</span>
                    </div>
                  </div>

                  {/* CALENDÁRIO SEMANAL DE FUNCIONAMENTO */}
                  <div style={{ paddingTop: '12px', borderTop: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '7px' }}>
                          <Calendar size={14} />
                          <span>Grade Semanal de Funcionamento</span>
                        </div>
                        <p className="input-hint" style={{ marginTop: '2px' }}>
                          Configure os dias e horários de transmissão das telas na unidade.
                        </p>
                      </div>

                      <span className="badge badge-neutral">
                        <Clock size={11} />
                        <span>{workingDays} · {operatingHours}</span>
                      </span>
                    </div>

                    {/* Presets */}
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        className="btn-preset-calendar"
                        onClick={() => {
                          const next = DEFAULT_WEEK_SCHEDULE.map(d => ({
                            ...d,
                            isOpen: ['seg', 'ter', 'qua', 'qui', 'sex'].includes(d.id),
                            openTime: '06:00',
                            closeTime: '22:00'
                          }));
                          updateScheduleState(next);
                        }}
                      >
                        Seg a Sex (06h–22h)
                      </button>
                      <button
                        type="button"
                        className="btn-preset-calendar"
                        onClick={() => {
                          const next = DEFAULT_WEEK_SCHEDULE.map(d => ({
                            ...d,
                            isOpen: d.id !== 'dom',
                            openTime: '06:00',
                            closeTime: '22:00'
                          }));
                          updateScheduleState(next);
                        }}
                      >
                        Seg a Sáb (06h–22h)
                      </button>
                      <button
                        type="button"
                        className="btn-preset-calendar"
                        onClick={() => {
                          const next = DEFAULT_WEEK_SCHEDULE.map(d => ({
                            ...d,
                            isOpen: true,
                            openTime: '06:00',
                            closeTime: '22:00'
                          }));
                          updateScheduleState(next);
                        }}
                      >
                        Todos os Dias (06h–22h)
                      </button>
                      <button
                        type="button"
                        className="btn-preset-calendar"
                        onClick={() => {
                          const next = DEFAULT_WEEK_SCHEDULE.map(d => ({
                            ...d,
                            isOpen: true,
                            openTime: '00:00',
                            closeTime: '23:59'
                          }));
                          updateScheduleState(next);
                        }}
                      >
                        24 Horas / 7 Dias
                      </button>
                    </div>

                    {/* 7-Day Timeline List */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {weekSchedule.map(day => {
                        const { leftPct, widthPct } = getTimelineOffsets(day.openTime, day.closeTime);
                        return (
                          <div
                            key={day.id}
                            style={{
                              background: day.isOpen ? 'var(--bg-surface)' : 'var(--bg-base)',
                              border: `1px solid ${day.isOpen ? 'var(--border-default)' : 'var(--border-subtle)'}`,
                              borderRadius: 'var(--r-md)',
                              padding: '10px 12px',
                              display: 'grid',
                              gridTemplateColumns: '155px 1fr auto',
                              alignItems: 'center',
                              gap: '14px',
                              opacity: day.isOpen ? 1 : 0.65
                            }}
                          >
                            {/* Toggle + Day Label */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <button
                                type="button"
                                role="switch"
                                aria-checked={day.isOpen}
                                onClick={() => {
                                  const next = weekSchedule.map(d =>
                                    d.id === day.id ? { ...d, isOpen: !d.isOpen } : d
                                  );
                                  updateScheduleState(next);
                                }}
                                className={`toggle-track ${day.isOpen ? 'on' : ''}`}
                                style={{ cursor: 'pointer' }}
                              >
                                <span className="toggle-thumb" />
                              </button>
                              <div>
                                <div style={{ fontSize: '12.5px', fontWeight: 500, color: 'var(--text-primary)' }}>
                                  {day.label}
                                </div>
                                <div style={{ fontSize: '11px', color: day.isOpen ? 'var(--success)' : 'var(--text-tertiary)' }}>
                                  {day.isOpen ? 'Aberto' : 'Fechado'}
                                </div>
                              </div>
                            </div>

                            {/* 24h Visual Bar */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '140px' }}>
                              <div
                                className="font-mono"
                                style={{
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  fontSize: '10px',
                                  color: 'var(--text-quaternary)'
                                }}
                              >
                                <span>00h</span>
                                <span>06h</span>
                                <span>12h</span>
                                <span>18h</span>
                                <span>24h</span>
                              </div>
                              <div
                                style={{
                                  position: 'relative',
                                  height: '8px',
                                  background: 'var(--bg-elevated)',
                                  borderRadius: 'var(--r-full)',
                                  overflow: 'hidden'
                                }}
                              >
                                {day.isOpen && (
                                  <div
                                    style={{
                                      position: 'absolute',
                                      left: `${leftPct}%`,
                                      width: `${widthPct}%`,
                                      height: '100%',
                                      background: 'var(--accent)',
                                      borderRadius: 'var(--r-full)'
                                    }}
                                  />
                                )}
                              </div>
                            </div>

                            {/* Time Inputs + Replicate */}
                            {day.isOpen ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <input
                                  type="time"
                                  value={day.openTime}
                                  onChange={e => {
                                    const next = weekSchedule.map(d =>
                                      d.id === day.id ? { ...d, openTime: e.target.value } : d
                                    );
                                    updateScheduleState(next);
                                  }}
                                  className="input-field font-mono"
                                  style={{ width: '96px', height: '28px', padding: '0 8px', fontSize: '12px' }}
                                />
                                <span style={{ fontSize: '11.5px', color: 'var(--text-tertiary)' }}>às</span>
                                <input
                                  type="time"
                                  value={day.closeTime}
                                  onChange={e => {
                                    const next = weekSchedule.map(d =>
                                      d.id === day.id ? { ...d, closeTime: e.target.value } : d
                                    );
                                    updateScheduleState(next);
                                  }}
                                  className="input-field font-mono"
                                  style={{ width: '96px', height: '28px', padding: '0 8px', fontSize: '12px' }}
                                />
                                <button
                                  type="button"
                                  className="btn btn-ghost btn-sm"
                                  onClick={() => {
                                    const next = weekSchedule.map(d =>
                                      d.isOpen ? { ...d, openTime: day.openTime, closeTime: day.closeTime } : d
                                    );
                                    updateScheduleState(next);
                                  }}
                                  title="Replicar este horário para todos os dias abertos"
                                >
                                  <Copy size={11} />
                                  <span>Replicar</span>
                                </button>
                              </div>
                            ) : (
                              <span style={{ fontSize: '12px', color: 'var(--text-tertiary)', paddingRight: '6px' }}>
                                Sem transmissão
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Peak Hours */}
                    <div className="input-group" style={{ marginTop: '4px' }}>
                      <label className="input-label">Horário de Pico / Maior Fluxo de Público *</label>
                      <select
                        className="select-field"
                        value={peakHours}
                        onChange={e => setPeakHours(e.target.value)}
                      >
                        {PEAK_HOURS_OPTIONS.map(pk => (
                          <option key={pk} value={pk}>{pk}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* SEÇÃO 2: LOCALIZAÇÃO & CONTATO */}
                <div className="form-section">
                  <div className="form-section-header">
                    <span className="form-section-title">
                      <MapPin size={14} />
                      <span>Localização (ViaCEP) & Contato</span>
                    </span>
                  </div>

                  <div className="form-grid-3">
                    <div className="input-group">
                      <label className="input-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>CEP</span>
                        {loadingCep && <span style={{ fontSize: '11px', color: 'var(--info)' }}>Consultando...</span>}
                      </label>
                      <input
                        type="text"
                        maxLength={9}
                        className="input-field tabular-nums"
                        placeholder="00000-000"
                        value={cep}
                        onChange={handleCepChange}
                      />
                      {cepError ? (
                        <span className="input-hint" style={{ color: 'var(--danger)' }}>{cepError}</span>
                      ) : (
                        <span className="input-hint">Preenchimento automático</span>
                      )}
                    </div>

                    <div className="input-group">
                      <label className="input-label">Cidade</label>
                      <input
                        type="text"
                        className="input-field"
                        placeholder="Ex: São Paulo"
                        value={city}
                        onChange={e => setCity(e.target.value)}
                      />
                    </div>

                    <div className="input-group">
                      <label className="input-label">Estado (UF)</label>
                      <input
                        type="text"
                        maxLength={2}
                        className="input-field"
                        placeholder="SP"
                        value={state}
                        onChange={e => setState(e.target.value.toUpperCase())}
                      />
                    </div>
                  </div>

                  <div className="form-grid-3">
                    <div className="input-group">
                      <label className="input-label">Bairro</label>
                      <input
                        type="text"
                        className="input-field"
                        placeholder="Ex: Pinheiros"
                        value={neighborhood}
                        onChange={e => setNeighborhood(e.target.value)}
                      />
                    </div>

                    <div className="input-group">
                      <label className="input-label">Endereço Completo</label>
                      <input
                        type="text"
                        className="input-field"
                        placeholder="Av. Principal, 1000"
                        value={address}
                        onChange={e => setAddress(e.target.value)}
                      />
                    </div>

                    <div className="input-group">
                      <label className="input-label">Responsável / Gerente</label>
                      <input
                        type="text"
                        className="input-field"
                        placeholder="Ex: Carlos Silva"
                        value={contactPerson}
                        onChange={e => setContactPerson(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="form-grid-2">
                    <div className="input-group">
                      <label className="input-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Phone size={12} />
                        <span>WhatsApp / Telefone *</span>
                      </label>
                      <input
                        type="text"
                        maxLength={15}
                        className="input-field tabular-nums"
                        placeholder="(11) 99999-9999"
                        value={phone}
                        onChange={handlePhoneChange}
                        required
                      />
                    </div>
                  </div>
                </div>

                {/* SEÇÃO 3: ACESSO & COMISSÃO */}
                <div className="form-section">
                  <div className="form-section-header">
                    <span className="form-section-title">
                      <Users size={14} />
                      <span>Credenciais de Acesso & Comissionamento</span>
                    </span>
                  </div>

                  {!editingPartner && (
                    <div className="form-grid-2">
                      <div className="input-group">
                        <label className="input-label">E-mail de Login *</label>
                        <input
                          type="email"
                          className="input-field"
                          placeholder="parceiro@empresa.com.br"
                          value={newEmail}
                          onChange={e => setNewEmail(e.target.value)}
                          required
                        />
                      </div>

                      <div className="input-group">
                        <label className="input-label">Senha Inicial *</label>
                        <input
                          type="password"
                          className="input-field"
                          placeholder="Mínimo 6 caracteres"
                          value={newPassword}
                          onChange={e => setNewPassword(e.target.value)}
                          required
                          minLength={6}
                        />
                      </div>
                    </div>
                  )}

                  <div className="form-grid-2">
                    <div className="input-group">
                      <label className="input-label">Taxa de Comissão (0 a 1) *</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        max="1"
                        className="input-field tabular-nums"
                        placeholder="0.10"
                        value={commission}
                        onChange={e => setCommission(e.target.value)}
                        required
                      />
                      <span className="input-hint">Ex: 0.10 equivale a 10% sobre anunciantes indicados</span>
                    </div>

                    <div className="input-group">
                      <label className="input-label">Código de Indicação</label>
                      <input
                        type="text"
                        className="input-field font-mono"
                        placeholder="Ex: ELEVATE10 (Opcional)"
                        value={referralCode}
                        onChange={e => setReferralCode(e.target.value.toUpperCase())}
                      />
                      <span className="input-hint">Gerado automaticamente se deixado em branco</span>
                    </div>

                    <div className="input-group">
                      <label className="input-label">Limite de Mídias na Grade (Cota de Autonomia) *</label>
                      <input
                        type="number"
                        min="1"
                        max="30"
                        className="input-field tabular-nums"
                        placeholder="3"
                        value={maxMediaSlots}
                        onChange={e => setMaxMediaSlots(e.target.value)}
                        required
                      />
                      <span className="input-hint">Quantidade máxima de conteúdos simultâneos que este parceiro pode veicular</span>
                    </div>
                  </div>
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
                  ) : editingPartner ? (
                    'Salvar Alterações'
                  ) : (
                    'Cadastrar Estabelecimento'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: FICHA COMERCIAL / MÍDIA KIT */}
      {selectedPartnerForReport && (
        <div className="modal-overlay" onClick={() => setSelectedPartnerForReport(null)}>
          <div className="modal modal-md" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <h2 className="modal-title">
                    {selectedPartnerForReport.establishment_name || 'Unidade Elevate'}
                  </h2>
                  <span className="badge badge-neutral">
                    {selectedPartnerForReport.category || 'Comércio & Varejo'}
                  </span>
                </div>
                <p className="modal-subtitle">
                  Ficha Mídia Kit — Indicadores comerciais para apresentação a anunciantes.
                </p>
              </div>
              <button
                type="button"
                className="icon-btn"
                onClick={() => setSelectedPartnerForReport(null)}
              >
                <X size={16} />
              </button>
            </div>

            <div className="modal-body">
              <div className="form-grid-2">
                <div className="card" style={{ padding: '14px 16px' }}>
                  <div className="kpi-label">Alcance Mensal</div>
                  <div className="kpi-value" style={{ fontSize: '20px', marginTop: '4px' }}>
                    {(selectedPartnerForReport.student_count || 0).toLocaleString('pt-BR')} visitantes/mês
                  </div>
                  <div className="cell-secondary" style={{ marginTop: '4px' }}>
                    Audiência recorrente de alta frequência
                  </div>
                </div>

                <div className="card" style={{ padding: '14px 16px' }}>
                  <div className="kpi-label">Perfil Demográfico</div>
                  <div className="cell-primary" style={{ fontSize: '14px', marginTop: '6px' }}>
                    {selectedPartnerForReport.target_audience || 'Jovens e Adultos'}
                  </div>
                  <div className="cell-secondary" style={{ marginTop: '4px' }}>
                    Segmentação predominante
                  </div>
                </div>

                <div className="card" style={{ padding: '14px 16px' }}>
                  <div className="kpi-label">Funcionamento</div>
                  <div className="cell-primary" style={{ fontSize: '14px', marginTop: '6px' }}>
                    {selectedPartnerForReport.operating_hours || '06h00 às 22h00'}
                  </div>
                  <div className="cell-secondary" style={{ marginTop: '4px' }}>
                    {selectedPartnerForReport.working_days || 'Segunda a Sábado'}
                  </div>
                </div>

                <div className="card" style={{ padding: '14px 16px' }}>
                  <div className="kpi-label">Faixa de Maior Fluxo</div>
                  <div className="cell-primary" style={{ fontSize: '14px', marginTop: '6px' }}>
                    {selectedPartnerForReport.peak_hours || 'Manhã e Noite (06h-09h e 18h-21h)'}
                  </div>
                  <div className="cell-secondary" style={{ marginTop: '4px' }}>
                    Janela de pico nos terminais
                  </div>
                </div>
              </div>

              <div className="form-section" style={{ gap: '8px' }}>
                <div className="form-section-header">
                  <span className="form-section-title">Localização & Dados Comerciais</span>
                </div>
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  <div>
                    <strong style={{ color: 'var(--text-primary)', fontWeight: 500 }}>Local:</strong>{' '}
                    {selectedPartnerForReport.city
                      ? `${selectedPartnerForReport.city} - ${selectedPartnerForReport.state || ''}`
                      : 'Cidade não informada'}
                    {selectedPartnerForReport.neighborhood ? ` · ${selectedPartnerForReport.neighborhood}` : ''}
                    {selectedPartnerForReport.cep ? ` (${selectedPartnerForReport.cep})` : ''}
                  </div>
                  <div>
                    <strong style={{ color: 'var(--text-primary)', fontWeight: 500 }}>Endereço:</strong>{' '}
                    {selectedPartnerForReport.address || 'Não informado'}
                  </div>
                  <div>
                    <strong style={{ color: 'var(--text-primary)', fontWeight: 500 }}>Contato:</strong>{' '}
                    {selectedPartnerForReport.contact_person || 'Não informado'} ·{' '}
                    {selectedPartnerForReport.phone || 'Sem telefone'}
                  </div>
                  <div>
                    <strong style={{ color: 'var(--text-primary)', fontWeight: 500 }}>Código Comercial:</strong>{' '}
                    <span className="font-mono" style={{ color: 'var(--text-primary)' }}>
                      {selectedPartnerForReport.referral_code || '—'}
                    </span>{' '}
                    ({((selectedPartnerForReport.commission_rate || 0.1) * 100).toFixed(0)}% comissão)
                  </div>
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  const txt = `MÍDIA KIT ELEVATE MÍDIA INDOOR - ${selectedPartnerForReport.establishment_name || 'Academia'}\nAlcance: ${(selectedPartnerForReport.student_count || 0).toLocaleString('pt-BR')} visitantes/mês ativos\nPúblico: ${selectedPartnerForReport.target_audience || '-'}\nFuncionamento: ${selectedPartnerForReport.working_days || ''} (${selectedPartnerForReport.operating_hours || ''})\nHorário de Pico: ${selectedPartnerForReport.peak_hours || '-'}\nLocal: ${selectedPartnerForReport.address || ''} - ${selectedPartnerForReport.neighborhood || ''}, ${selectedPartnerForReport.city || '-'} (${selectedPartnerForReport.state || '-'})`;
                  navigator.clipboard.writeText(txt);
                  alert('Resumo do Mídia Kit copiado para a área de transferência!');
                }}
              >
                <Copy size={14} />
                <span>Copiar Resumo Comercial</span>
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setSelectedPartnerForReport(null)}
              >
                Concluir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: TERMINAIS VINCULADOS AO PARCEIRO */}
      {selectedPartnerForTerminals && (() => {
        const partnerTerminals = allTerminals.filter(t => t.partner_id === selectedPartnerForTerminals.id);
        const onlineCount = partnerTerminals.filter(t => isTerminalOnline(t)).length;
        const offlineCount = partnerTerminals.length - onlineCount;

        const filteredTerminals = partnerTerminals.filter(t => {
          const matchQuery =
            !terminalSearchQuery ||
            t.name?.toLowerCase().includes(terminalSearchQuery.toLowerCase()) ||
            t.location?.toLowerCase().includes(terminalSearchQuery.toLowerCase());
          const online = isTerminalOnline(t);
          const matchStatus =
            terminalStatusFilter === 'all' ||
            (terminalStatusFilter === 'online' ? online : !online);
          return matchQuery && matchStatus;
        });

        return (
          <div className="modal-overlay" onClick={() => setSelectedPartnerForTerminals(null)}>
            <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <div>
                  <h2 className="modal-title">
                    Terminais — {selectedPartnerForTerminals.establishment_name || 'Unidade Parceira'}
                  </h2>
                  <p className="modal-subtitle">
                    Gerencie as telas vinculadas a este estabelecimento.
                  </p>
                </div>
                <button
                  type="button"
                  className="icon-btn"
                  onClick={() => setSelectedPartnerForTerminals(null)}
                >
                  <X size={16} />
                </button>
              </div>

              <div className="modal-body">
                {/* Summary Strip */}
                <div className="form-grid-3">
                  <div className="card" style={{ padding: '12px 14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span className="kpi-label">Transmitindo</span>
                      <Wifi size={14} style={{ color: 'var(--success)' }} />
                    </div>
                    <div className="kpi-value" style={{ fontSize: '20px', marginTop: '6px' }}>
                      {onlineCount}
                    </div>
                  </div>

                  <div className="card" style={{ padding: '12px 14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span className="kpi-label">Offline</span>
                      <WifiOff size={14} style={{ color: offlineCount > 0 ? 'var(--danger)' : 'var(--text-tertiary)' }} />
                    </div>
                    <div className="kpi-value" style={{ fontSize: '20px', marginTop: '6px' }}>
                      {offlineCount}
                    </div>
                  </div>

                  <div className="card" style={{ padding: '12px 14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span className="kpi-label">Total da Unidade</span>
                      <Tv size={14} style={{ color: 'var(--text-tertiary)' }} />
                    </div>
                    <div className="kpi-value" style={{ fontSize: '20px', marginTop: '6px' }}>
                      {partnerTerminals.length}
                    </div>
                  </div>
                </div>

                {partnerTerminals.length > 0 && (
                  <div className="toolbar" style={{ marginBottom: 0 }}>
                    <div className="segmented-control">
                      <button
                        type="button"
                        className={`seg-btn ${terminalStatusFilter === 'all' ? 'active' : ''}`}
                        onClick={() => setTerminalStatusFilter('all')}
                      >
                        <span>Todas</span>
                        <span className="seg-count">{partnerTerminals.length}</span>
                      </button>
                      <button
                        type="button"
                        className={`seg-btn ${terminalStatusFilter === 'online' ? 'active' : ''}`}
                        onClick={() => setTerminalStatusFilter('online')}
                      >
                        <span>Online</span>
                        <span className="seg-count">{onlineCount}</span>
                      </button>
                      <button
                        type="button"
                        className={`seg-btn ${terminalStatusFilter === 'offline' ? 'active' : ''}`}
                        onClick={() => setTerminalStatusFilter('offline')}
                      >
                        <span>Offline</span>
                        <span className="seg-count">{offlineCount}</span>
                      </button>
                    </div>

                    <div className="search-field" style={{ width: '240px' }}>
                      <Search size={13} className="search-field-icon" />
                      <input
                        type="text"
                        placeholder="Filtrar por nome ou setor..."
                        value={terminalSearchQuery}
                        onChange={e => setTerminalSearchQuery(e.target.value)}
                      />
                    </div>
                  </div>
                )}

                {partnerTerminals.length === 0 ? (
                  <div className="card empty-state" style={{ padding: '40px 20px' }}>
                    <div className="empty-state-icon">
                      <Tv size={18} />
                    </div>
                    <div className="empty-state-title">Nenhum terminal vinculado</div>
                    <div className="empty-state-desc">
                      Acesse a página de Terminais para atribuir telas a esta unidade parceira.
                    </div>
                  </div>
                ) : filteredTerminals.length === 0 ? (
                  <div className="card empty-state" style={{ padding: '32px 20px' }}>
                    <div className="empty-state-title">Nenhum terminal para o filtro atual</div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {filteredTerminals.map(t => {
                      const isOnline = isTerminalOnline(t);
                      return (
                        <div
                          key={t.id}
                          style={{
                            background: 'var(--bg-surface-sub)',
                            border: '1px solid var(--border-subtle)',
                            borderRadius: 'var(--r-md)',
                            padding: '11px 14px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '12px',
                            flexWrap: 'wrap'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '11px', flex: 1, minWidth: '180px' }}>
                            <div className="entity-avatar">
                              <Tv size={14} />
                            </div>
                            <div style={{ minWidth: 0 }}>
                              <div className="cell-primary">
                                {t.name || 'Terminal Elevate'}
                              </div>
                              <div className="cell-secondary">
                                {t.location || 'Setor não informado'}
                              </div>
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span className={`badge ${isOnline ? 'badge-success' : 'badge-danger'}`}>
                              <span className={`status-dot ${isOnline ? 'online' : 'offline'}`} />
                              {isOnline ? 'Online' : 'Offline'}
                            </span>

                            {t.show_info_bar !== undefined && (
                              <span className="badge badge-neutral">
                                RSS {t.show_info_bar ? 'Ativo' : 'Inativo'}
                              </span>
                            )}

                            <button
                              type="button"
                              className="btn btn-danger btn-sm"
                              onClick={() => handleUnlinkTerminal(t.id)}
                            >
                              <Unlink size={12} />
                              <span>Desvincular</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setSelectedPartnerForTerminals(null)}
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* MODAL 4: VÍDEOS & GRADE DO PARCEIRO (ADMIN VIEW) */}
      {selectedPartnerForMedia && (
        <div className="modal-overlay" onClick={() => setSelectedPartnerForMedia(null)}>
          <div className="modal modal-lg" onClick={e => e.stopPropagation()} style={{ maxWidth: '1000px', width: '95%' }}>
            <div className="modal-header">
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <h2 className="modal-title">
                    Vídeos & Grade Interna — {selectedPartnerForMedia.establishment_name || 'Estabelecimento Parceiro'}
                  </h2>
                  <span className="badge badge-neutral">
                    Cota: {selectedPartnerForMedia.max_media_slots || 3} mídias
                  </span>
                </div>
                <p className="modal-subtitle">
                  Supervisione a playlist vinculada ao terminal e os vídeos internos cadastrados por este parceiro.
                </p>
              </div>
              <button
                type="button"
                className="icon-btn"
                onClick={() => setSelectedPartnerForMedia(null)}
                aria-label="Fechar"
              >
                <X size={16} />
              </button>
            </div>

            <div className="modal-body">
              {loadingPartnerMedia ? (
                <div style={{ padding: '48px 0', textAlign: 'center' }}>
                  <span className="spinner" />
                  <p style={{ marginTop: '12px', color: 'var(--text-tertiary)', fontSize: '13px' }}>
                    Carregando grade de programação e mídias do parceiro...
                  </p>
                </div>
              ) : (
                <>
                  {/* KPI Strip */}
                  <div className="form-grid-3">
                    <div className="card" style={{ padding: '12px 16px' }}>
                      <span className="stat-label">Terminais Vinculados</span>
                      <div className="stat-value" style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {partnerTerminals.length > 0 ? (
                          partnerTerminals.map(t => t.name).join(', ')
                        ) : (
                          <span style={{ color: 'var(--text-tertiary)', fontSize: '13px' }}>Nenhum terminal vinculado</span>
                        )}
                      </div>
                      <span className="stat-help">
                        {partnerPlaylists.length} playlist(s) ativa(s)
                      </span>
                    </div>

                    <div className="card" style={{ padding: '12px 16px' }}>
                      <span className="stat-label">Itens na Playlist do Terminal</span>
                      <div className="stat-value">
                        {partnerPlaylistItems.length}
                      </div>
                      <span className="stat-help">Anúncios comerciais no loop</span>
                    </div>

                    <div className="card" style={{ padding: '12px 16px' }}>
                      <span className="stat-label">Vídeos Internos do Parceiro</span>
                      <div className="stat-value" style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                        <span>
                          {partnerMediaList.filter(m => m.status === 'approved').length}
                        </span>
                        <span style={{ fontSize: '12px', color: 'var(--text-tertiary)', fontWeight: 400 }}>
                          / {selectedPartnerForMedia.max_media_slots || 3} ativas
                        </span>
                      </div>
                      <span className="stat-help">{partnerMediaList.length} arquivos no acervo próprio</span>
                    </div>
                  </div>

                  {/* CONTROLE DE SEGMENTOS & FILTROS DA GRADE */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginTop: '22px',
                      marginBottom: '12px',
                      gap: '12px',
                      flexWrap: 'wrap'
                    }}
                  >
                    <div>
                      <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                        Grade de Transmissão na TV (Ciclo Completo)
                      </h3>
                      <p style={{ fontSize: '12px', color: 'var(--text-tertiary)', margin: '2px 0 0 0' }}>
                        Grid única segmentada entre anúncios da playlist e vídeos institucionais do parceiro.
                      </p>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        className={`btn btn-sm ${mediaModalTab === 'all' ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => setMediaModalTab('all')}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                      >
                        <Layers size={13} />
                        <span>Todos no Loop ({partnerPlaylistItems.length + partnerMediaList.filter(m => m.status === 'approved').length})</span>
                      </button>

                      <button
                        type="button"
                        className={`btn btn-sm ${mediaModalTab === 'playlist' ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => {
                          setMediaModalTab('playlist');
                          setIsPlaylistCollapsed(false);
                        }}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                      >
                        <Tv size={13} />
                        <span>Playlist ({partnerPlaylistItems.length})</span>
                      </button>

                      <button
                        type="button"
                        className={`btn btn-sm ${mediaModalTab === 'internal' ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => {
                          setMediaModalTab('internal');
                          setIsInternalVideosCollapsed(false);
                        }}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                      >
                        <Film size={13} />
                        <span>Vídeos Internos ({partnerMediaList.length})</span>
                      </button>

                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginLeft: '4px' }}
                        onClick={() => {
                          const shouldCollapse = !isPlaylistCollapsed || !isInternalVideosCollapsed;
                          setIsPlaylistCollapsed(shouldCollapse);
                          setIsInternalVideosCollapsed(shouldCollapse);
                        }}
                      >
                        {!isPlaylistCollapsed || !isInternalVideosCollapsed ? (
                          <>
                            <ChevronUp size={13} />
                            <span>Recolher</span>
                          </>
                        ) : (
                          <>
                            <ChevronDown size={13} />
                            <span>Expandir</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* GRID ÚNICA PADRONIZADA COM SEGMENTAÇÃO DE PLAYLIST E VÍDEOS */}
                  <div
                    className="table-container"
                    style={{
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-md)',
                      maxHeight: '440px',
                      overflowY: 'auto'
                    }}
                  >
                    <table className="table" style={{ margin: 0 }}>
                      <thead>
                        <tr>
                          <th style={{ width: '55px', whiteSpace: 'nowrap' }}>Ordem</th>
                          <th style={{ width: '85px', whiteSpace: 'nowrap' }}>Prévia</th>
                          <th>Mídia / Conteúdo</th>
                          <th style={{ width: '150px', whiteSpace: 'nowrap' }}>Segmento</th>
                          <th style={{ width: '130px', whiteSpace: 'nowrap' }}>Terminal</th>
                          <th style={{ width: '85px', whiteSpace: 'nowrap' }}>Duração</th>
                          <th style={{ width: '155px', whiteSpace: 'nowrap' }}>Status na TV</th>
                          <th style={{ width: '95px', textAlign: 'right', whiteSpace: 'nowrap' }}>Ação</th>
                        </tr>
                      </thead>
                      <tbody>
                        {/* SEGMENTO 1: PLAYLIST VINCULADA AO TERMINAL */}
                        {(mediaModalTab === 'all' || mediaModalTab === 'playlist') && (
                          <>
                            <tr
                              style={{
                                background: 'rgba(234, 179, 8, 0.06)',
                                borderTop: '1px solid var(--border-subtle)',
                                borderBottom: '1px solid var(--border-subtle)',
                                cursor: 'pointer'
                              }}
                              onClick={() => setIsPlaylistCollapsed(!isPlaylistCollapsed)}
                            >
                              <td colSpan={8} style={{ padding: '8px 14px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <div
                                      style={{
                                        width: '22px',
                                        height: '22px',
                                        borderRadius: '4px',
                                        background: 'rgba(234, 179, 8, 0.18)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        color: 'var(--accent)'
                                      }}
                                    >
                                      <Tv size={12} />
                                    </div>
                                    <span style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--text-primary)' }}>
                                      Segmento 1: Playlist Comercial Vinculada ao Terminal
                                    </span>
                                    {partnerPlaylists.length > 0 && (
                                      <span className="badge badge-neutral" style={{ fontSize: '10.5px' }}>
                                        {partnerPlaylists[0].terminalName}: {partnerPlaylists[0].name} (v{partnerPlaylists[0].version || 1})
                                      </span>
                                    )}
                                    <span className="badge badge-neutral" style={{ fontSize: '10.5px' }}>
                                      {partnerPlaylistItems.length} anúncio(s)
                                    </span>
                                  </div>

                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
                                      {isPlaylistCollapsed ? 'Clique para expandir' : 'Clique para ocultar'}
                                    </span>
                                    {isPlaylistCollapsed ? <ChevronDown size={14} style={{ color: 'var(--text-secondary)' }} /> : <ChevronUp size={14} style={{ color: 'var(--text-secondary)' }} />}
                                  </div>
                                </div>
                              </td>
                            </tr>

                            {!isPlaylistCollapsed && partnerPlaylistItems.length === 0 && (
                              <tr>
                                <td colSpan={8} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-tertiary)' }}>
                                  <Tv size={22} style={{ margin: '0 auto 6px auto', display: 'block', opacity: 0.6 }} />
                                  <span style={{ fontSize: '12.5px' }}>Nenhum anúncio comercial na playlist deste terminal.</span>
                                </td>
                              </tr>
                            )}

                            {!isPlaylistCollapsed && partnerPlaylistItems.map((item, idx) => {
                              const isVideo = item.media?.file_type?.includes('video');
                              return (
                                <tr key={`playlist-${item.id || idx}`}>
                                  <td>
                                    <span className="badge badge-neutral" style={{ fontWeight: 600 }}>
                                      #{item.order || idx + 1}
                                    </span>
                                  </td>
                                  <td>
                                    <div
                                      style={{
                                        width: '64px',
                                        height: '36px',
                                        borderRadius: '4px',
                                        background: '#090d16',
                                        position: 'relative',
                                        overflow: 'hidden',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        cursor: 'pointer',
                                        border: '1px solid var(--border-subtle)'
                                      }}
                                      onClick={() => {
                                        if (item.playUrl) {
                                          setVideoPreviewItem({
                                            url: item.playUrl,
                                            name: item.media?.name || 'Mídia da Playlist',
                                            type: item.media?.file_type || 'video/mp4'
                                          });
                                        }
                                      }}
                                      title="Clique para assistir frame"
                                    >
                                      {item.playUrl ? (
                                        isVideo ? (
                                          <video
                                            src={`${item.playUrl}#t=0.1`}
                                            muted
                                            playsInline
                                            preload="metadata"
                                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                          />
                                        ) : (
                                          <img
                                            src={item.playUrl}
                                            alt={item.media?.name || ''}
                                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                          />
                                        )
                                      ) : (
                                        <Tv size={14} style={{ color: 'var(--text-tertiary)' }} />
                                      )}
                                      <div
                                        style={{
                                          position: 'absolute',
                                          inset: 0,
                                          background: 'rgba(0,0,0,0.3)',
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'center'
                                        }}
                                      >
                                        <div
                                          style={{
                                            width: '18px',
                                            height: '18px',
                                            borderRadius: '50%',
                                            background: 'rgba(0,0,0,0.7)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            color: '#ffffff'
                                          }}
                                        >
                                          <Play size={9} style={{ marginLeft: '1px' }} />
                                        </div>
                                      </div>
                                    </div>
                                  </td>
                                  <td>
                                    <div>
                                      <div className="cell-primary" style={{ fontWeight: 500 }} title={item.media?.name}>
                                        {item.media?.name || 'Mídia da Playlist'}
                                      </div>
                                      <div className="cell-secondary">
                                        {item.media?.file_type || 'Campanha Comercial'}
                                      </div>
                                    </div>
                                  </td>
                                  <td>
                                    <span className="badge badge-neutral" style={{ fontSize: '11px' }}>
                                      <Tv size={10} style={{ marginRight: '4px' }} />
                                      Playlist Comercial
                                    </span>
                                  </td>
                                  <td>
                                    <span className="cell-secondary" style={{ whiteSpace: 'nowrap' }}>
                                      {item.terminalName || 'Terminal'}
                                    </span>
                                  </td>
                                  <td>
                                    <span className="tabular-nums cell-primary" style={{ whiteSpace: 'nowrap' }}>
                                      {item.duration_override || item.media?.duration_seconds || (isVideo ? 15 : 10)}s
                                    </span>
                                  </td>
                                  <td>
                                    <span className="badge badge-success" style={{ fontSize: '11px' }}>
                                      <span className="status-dot online" />
                                      Em exibição na TV
                                    </span>
                                  </td>
                                  <td style={{ textAlign: 'right' }}>
                                    <button
                                      type="button"
                                      className="btn btn-ghost btn-sm"
                                      onClick={() => {
                                        if (item.playUrl) {
                                          setVideoPreviewItem({
                                            url: item.playUrl,
                                            name: item.media?.name || 'Mídia da Playlist',
                                            type: item.media?.file_type || 'video/mp4'
                                          });
                                        }
                                      }}
                                    >
                                      <Play size={11} />
                                      <span>Assistir</span>
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </>
                        )}

                        {/* SEGMENTO 2: VÍDEOS INTERNOS DO PARCEIRO */}
                        {(mediaModalTab === 'all' || mediaModalTab === 'internal') && (
                          <>
                            <tr
                              style={{
                                background: 'rgba(34, 197, 94, 0.06)',
                                borderTop: '2px solid var(--border-subtle)',
                                borderBottom: '1px solid var(--border-subtle)',
                                cursor: 'pointer'
                              }}
                              onClick={() => setIsInternalVideosCollapsed(!isInternalVideosCollapsed)}
                            >
                              <td colSpan={8} style={{ padding: '8px 14px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <div
                                      style={{
                                        width: '22px',
                                        height: '22px',
                                        borderRadius: '4px',
                                        background: 'rgba(34, 197, 94, 0.18)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        color: 'var(--primary)'
                                      }}
                                    >
                                      <Film size={12} />
                                    </div>
                                    <span style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--text-primary)' }}>
                                      Segmento 2: Vídeos e Mídias Internas do Parceiro
                                    </span>
                                    <span className="badge badge-success" style={{ fontSize: '10.5px' }}>
                                      <span className="status-dot online" />
                                      {partnerMediaList.filter(m => m.status === 'approved').length} de {selectedPartnerForMedia.max_media_slots || 3} na TV
                                    </span>
                                    <span className="badge badge-neutral" style={{ fontSize: '10.5px' }}>
                                      {partnerMediaList.length} arquivo(s)
                                    </span>
                                  </div>

                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
                                      {isInternalVideosCollapsed ? 'Clique para expandir' : 'Clique para ocultar'}
                                    </span>
                                    {isInternalVideosCollapsed ? <ChevronDown size={14} style={{ color: 'var(--text-secondary)' }} /> : <ChevronUp size={14} style={{ color: 'var(--text-secondary)' }} />}
                                  </div>
                                </div>
                              </td>
                            </tr>

                            {!isInternalVideosCollapsed && partnerMediaList.length === 0 && (
                              <tr>
                                <td colSpan={8} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-tertiary)' }}>
                                  <Film size={22} style={{ margin: '0 auto 6px auto', display: 'block', opacity: 0.6 }} />
                                  <span style={{ fontSize: '12.5px' }}>Este parceiro ainda não enviou vídeos institucionais próprios.</span>
                                </td>
                              </tr>
                            )}

                            {!isInternalVideosCollapsed && (() => {
                              let activeIndex = 0;
                              return partnerMediaList.map((media) => {
                                const isInTv = media.status === 'approved';
                                const isVideo = media.file_type?.includes('video');
                                const sizeMb = media.file_size ? (media.file_size / (1024 * 1024)).toFixed(1) : null;
                                const orderNum = isInTv
                                  ? partnerPlaylistItems.length + (++activeIndex)
                                  : null;

                                return (
                                  <tr key={`partner-media-${media.id}`}>
                                    <td>
                                      {orderNum ? (
                                        <span className="badge badge-neutral" style={{ fontWeight: 600 }}>
                                          #{orderNum}
                                        </span>
                                      ) : (
                                        <span className="cell-secondary" style={{ fontSize: '11px' }}>
                                          —
                                        </span>
                                      )}
                                    </td>
                                    <td>
                                      <div
                                        style={{
                                          width: '64px',
                                          height: '36px',
                                          borderRadius: '4px',
                                          background: '#090d16',
                                          position: 'relative',
                                          overflow: 'hidden',
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                          cursor: 'pointer',
                                          border: isInTv ? '1px solid var(--success-border)' : '1px solid var(--border-subtle)'
                                        }}
                                        onClick={() => {
                                          if (media.playUrl) {
                                            setVideoPreviewItem({
                                              url: media.playUrl,
                                              name: media.name,
                                              type: media.file_type || 'video/mp4'
                                            });
                                          }
                                        }}
                                        title="Clique para assistir frame"
                                      >
                                        {media.playUrl ? (
                                          isVideo ? (
                                            <video
                                              src={`${media.playUrl}#t=0.1`}
                                              muted
                                              playsInline
                                              preload="metadata"
                                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                            />
                                          ) : (
                                            <img
                                              src={media.playUrl}
                                              alt={media.name}
                                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                            />
                                          )
                                        ) : (
                                          <Film size={14} style={{ color: 'var(--text-tertiary)' }} />
                                        )}
                                        <div
                                          style={{
                                            position: 'absolute',
                                            inset: 0,
                                            background: 'rgba(0,0,0,0.3)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center'
                                          }}
                                        >
                                          <div
                                            style={{
                                              width: '18px',
                                              height: '18px',
                                              borderRadius: '50%',
                                              background: 'rgba(0,0,0,0.7)',
                                              display: 'flex',
                                              alignItems: 'center',
                                              justifyContent: 'center',
                                              color: '#ffffff'
                                            }}
                                          >
                                            <Play size={9} style={{ marginLeft: '1px' }} />
                                          </div>
                                        </div>
                                      </div>
                                    </td>
                                    <td>
                                      <div>
                                        <div className="cell-primary" style={{ fontWeight: 500 }} title={media.name}>
                                          {media.name}
                                        </div>
                                        <div className="cell-secondary">
                                          {sizeMb ? `${sizeMb} MB · ` : ''}{new Date(media.created_at).toLocaleDateString('pt-BR')}
                                        </div>
                                      </div>
                                    </td>
                                    <td>
                                      <span className="badge badge-success" style={{ fontSize: '11px' }}>
                                        <Building2 size={10} style={{ marginRight: '4px' }} />
                                        Mídia Própria
                                      </span>
                                    </td>
                                    <td>
                                      <span className="cell-secondary" style={{ whiteSpace: 'nowrap' }}>
                                        {partnerTerminals[0]?.name || 'Terminal'}
                                      </span>
                                    </td>
                                    <td>
                                      <span className="tabular-nums cell-primary" style={{ whiteSpace: 'nowrap' }}>
                                        {media.duration_seconds || (isVideo ? 15 : 10)}s
                                      </span>
                                    </td>
                                    <td>
                                      {isInTv ? (
                                        <span className="badge badge-success" style={{ fontSize: '11px' }}>
                                          <span className="status-dot online" />
                                          Em exibição na TV
                                        </span>
                                      ) : (
                                        <span className="badge badge-neutral" style={{ fontSize: '11px' }}>
                                          Fora da grade
                                        </span>
                                      )}
                                    </td>
                                    <td style={{ textAlign: 'right' }}>
                                      <button
                                        type="button"
                                        className="btn btn-ghost btn-sm"
                                        onClick={() => {
                                          if (media.playUrl) {
                                            setVideoPreviewItem({
                                              url: media.playUrl,
                                              name: media.name,
                                              type: media.file_type || 'video/mp4'
                                            });
                                          }
                                        }}
                                      >
                                        <Play size={11} />
                                        <span>Assistir</span>
                                      </button>
                                    </td>
                                  </tr>
                                );
                              });
                            })()}
                          </>
                        )}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setSelectedPartnerForMedia(null)}
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PLAYER MODAL INTEGRADO PARA PRÉ-VISUALIZAÇÃO DE VÍDEO DO PARCEIRO */}
      {videoPreviewItem && (
        <div
          className="modal-overlay"
          style={{ zIndex: 99999 }}
          onClick={() => setVideoPreviewItem(null)}
        >
          <div
            className="modal modal-lg"
            onClick={e => e.stopPropagation()}
            style={{ maxWidth: '820px', padding: 0, overflow: 'hidden' }}
          >
            <div className="modal-header" style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-subtle)' }}>
              <div>
                <h3 className="modal-title" style={{ fontSize: '15px' }}>
                  {videoPreviewItem.name}
                </h3>
                <span className="cell-secondary" style={{ fontSize: '11px' }}>
                  Visualização de Conteúdo em Alta Resolução
                </span>
              </div>
              <button
                type="button"
                className="icon-btn"
                onClick={() => setVideoPreviewItem(null)}
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
                minHeight: '340px',
                maxHeight: '65vh'
              }}
            >
              {videoPreviewItem.type.includes('video') ? (
                <video
                  src={videoPreviewItem.url}
                  controls
                  autoPlay
                  playsInline
                  style={{ width: '100%', maxHeight: '65vh', objectFit: 'contain' }}
                />
              ) : (
                <img
                  src={videoPreviewItem.url}
                  alt={videoPreviewItem.name}
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
                justifyContent: 'flex-end'
              }}
            >
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setVideoPreviewItem(null)}
              >
                Fechar Player
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

