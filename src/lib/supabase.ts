import { createClient } from '@supabase/supabase-js';

const PROD_SUPABASE_URL = 'https://tdbruykbguiojwzrjzik.supabase.co';
const PROD_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRkYnJ1eWtiZ3Vpb2p3enJqemlrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM5NzM3MDgsImV4cCI6MjEwOTU0OTcwOH0.-0m_iv8k86UnJ7M8wkbeNxb5H5TGA5ZsFNfpDPxvZrI';

const envUrl = import.meta.env.VITE_SUPABASE_URL;
const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Garante que variáveis antigas (ex: prlhdjpzflgjtlmknhps) não sobrescrevam o banco ativo
export const supabaseUrl =
  envUrl && envUrl.includes('tdbruykbguiojwzrjzik') ? envUrl : PROD_SUPABASE_URL;
export const supabaseAnonKey =
  envUrl && envUrl.includes('tdbruykbguiojwzrjzik') && envKey ? envKey : PROD_SUPABASE_ANON_KEY;

// Instância real do Supabase (com lock no-op para evitar deadlock de navigator.locks / GoTrueClient no navegador)
const realSupabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    lock: async (_name: string, _acquireTimeout: number, fn: () => Promise<any>) => {
      return await fn();
    },
  },
});

// Utilitários para persistência local dos dados mockados
const getMockData = (key: string, initial: any) => {
  try {
    const val = localStorage.getItem(key);
    if (val) return JSON.parse(val);
  } catch {}
  return initial;
};

const saveMockData = (key: string, val: any) => {
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch {}
};

// Tabelas mock iniciais
const initialTerminals = [
  { id: 't1', org_id: '00000000-0000-0000-0000-000000000001', name: 'TV Recepção Principal', location: 'Hall de Entrada', status: 'online', is_active: true, last_sync_at: new Date().toISOString() },
  { id: 't2', org_id: '00000000-0000-0000-0000-000000000001', name: 'TV Salão Principal 01', location: 'Área de Atendimento', status: 'online', is_active: true, last_sync_at: new Date().toISOString() },
  { id: 't3', org_id: '00000000-0000-0000-0000-000000000001', name: 'TV Lounge / Espera', location: 'Sala de Espera', status: 'offline', is_active: true, last_sync_at: null }
];

const initialMediaFiles = [
  { id: 'm1', org_id: '00000000-0000-0000-0000-000000000001', name: 'Vídeo Institucional Elevate.mp4', file_path: 'mock/promo.mp4', file_type: 'video/mp4', file_size: 15420300, duration_seconds: 30, checksum: 'sum1', created_at: new Date(Date.now() - 24 * 3600 * 1000).toISOString() },
  { id: 'm2', org_id: '00000000-0000-0000-0000-000000000001', name: 'Informativo & Horários.png', file_path: 'mock/horario.png', file_type: 'image/png', file_size: 2048500, duration_seconds: null, checksum: 'sum2', created_at: new Date(Date.now() - 48 * 3600 * 1000).toISOString() },
  { id: 'm3', org_id: '00000000-0000-0000-0000-000000000001', name: 'Campanha Anunciante Destaque.mp4', file_path: 'mock/nutri.mp4', file_type: 'video/mp4', file_size: 25400100, duration_seconds: 15, checksum: 'sum3', created_at: new Date(Date.now() - 12 * 3600 * 1000).toISOString() }
];

const initialPlaylists = [
  {
    id: 'p1',
    terminal_id: 't1',
    name: 'Playlist Recepção',
    is_active: true,
    version: 1,
    created_at: new Date().toISOString(),
    terminals: { name: 'TV Recepção Principal' },
    playlist_items: [
      { media_id: 'm1', order: 1 },
      { media_id: 'm2', order: 2 }
    ]
  },
  {
    id: 'p2',
    terminal_id: 't2',
    name: 'Playlist Salão Principal',
    is_active: true,
    version: 3,
    created_at: new Date().toISOString(),
    terminals: { name: 'TV Salão Principal 01' },
    playlist_items: [
      { media_id: 'm1', order: 1 },
      { media_id: 'm3', order: 2 }
    ]
  }
];

class MockBuilder {
  private filterField: string | null = null;
  private filterValue: any = null;
  private inField: string | null = null;
  private inValues: any[] | null = null;
  private table: string;

  constructor(table: string) {
    this.table = table;
  }

  private getTableData() {
    if (this.table === 'users') {
      const mockEmail = localStorage.getItem('@mock_email') || 'adm@elevatemidia.com.br';
      return [{ id: '00000000-0000-0000-0000-000000000000', org_id: '00000000-0000-0000-0000-000000000001', email: mockEmail, name: 'Administrador Elevate', role: 'admin' }];
    }
    if (this.table === 'terminals') return getMockData('@mock_terminals', initialTerminals);
    if (this.table === 'media_files') return getMockData('@mock_media_files', initialMediaFiles);
    if (this.table === 'playlists') return getMockData('@mock_playlists', initialPlaylists);
    if (this.table === 'playback_stats') {
      return [
        { id: 's1', media_id: 'm1', total_plays: 154, media: { name: 'Vídeo Institucional Elevate.mp4' } },
        { id: 's2', media_id: 'm2', total_plays: 98, media: { name: 'Informativo & Horários.png' } },
        { id: 's3', media_id: 'm3', total_plays: 87, media: { name: 'Campanha Anunciante Destaque.mp4' } }
      ];
    }
    return [];
  }

  private saveTableData(data: any[]) {
    if (this.table === 'terminals') saveMockData('@mock_terminals', data);
    if (this.table === 'media_files') saveMockData('@mock_media_files', data);
    if (this.table === 'playlists') saveMockData('@mock_playlists', data);
  }

  select(_fields?: string, options?: any) {
    if (this.table === 'terminal_logs' && options && options.count === 'exact') {
      // Simular contagem de exibições
      const countPromise = Promise.resolve({ data: null, count: 339, error: null });
      return Object.assign(countPromise, this);
    }
    return this;
  }

  eq(field: string, value: any) {
    this.filterField = field;
    this.filterValue = value;
    return this;
  }

  in(field: string, values: any[]) {
    this.inField = field;
    this.inValues = values;
    return this;
  }

  order(_field: string, _opts?: any) {
    return this;
  }

  limit(_n: number) {
    return this;
  }

  async single() {
    let list = this.getTableData();
    if (this.filterField) {
      list = list.filter((item: any) => item[this.filterField!] === this.filterValue);
    }
    return { data: list[0] || null, error: list[0] ? null : { message: 'Not found', code: 'PGRST116' } };
  }

  async insert(items: any | any[]) {
    const list = this.getTableData();
    const toInsert = Array.isArray(items) ? items : [items];
    const newItems = toInsert.map((item: any) => ({
      id: Math.random().toString(36).substring(2, 15),
      created_at: new Date().toISOString(),
      ...item
    }));
    
    // Tratamento especial para playlist_items para vincular com a tabela playlists mockada
    if (this.table === 'playlist_items') {
      const playlists = getMockData('@mock_playlists', initialPlaylists);
      const playlistId = newItems[0].playlist_id;
      const targetP = playlists.find((p: any) => p.id === playlistId);
      if (targetP) {
        if (!targetP.playlist_items) targetP.playlist_items = [];
        newItems.forEach((ni: any) => {
          targetP.playlist_items.push({
            media_id: ni.media_id,
            order: ni.order
          });
        });
        saveMockData('@mock_playlists', playlists);
      }
    } else {
      list.push(...newItems);
      this.saveTableData(list);
    }

    return { data: newItems, error: null };
  }

  async update(fields: any) {
    let list = this.getTableData();
    let updated: any[] = [];
    list = list.map((item: any) => {
      if (this.filterField && item[this.filterField!] === this.filterValue) {
        const uItem = { ...item, ...fields };
        updated.push(uItem);
        return uItem;
      }
      return item;
    });
    this.saveTableData(list);
    return { data: updated, error: null };
  }

  async delete() {
    let list = this.getTableData();
    if (this.filterField) {
      list = list.filter((item: any) => item[this.filterField!] !== this.filterValue);
    }
    this.saveTableData(list);
    return { data: [], error: null };
  }

  // Suporte a Promises no MockBuilder
  then(onfulfilled?: any, onrejected?: any) {
    let list = this.getTableData();
    if (this.filterField) {
      list = list.filter((item: any) => item[this.filterField!] === this.filterValue);
    }
    if (this.inField && this.inValues) {
      list = list.filter((item: any) => this.inValues!.includes(item[this.inField!]));
    }
    return Promise.resolve({ data: list, error: null }).then(onfulfilled, onrejected);
  }
}

// Exportação do wrapper do cliente Supabase
export const supabase = {
  auth: {
    getSession: () => realSupabase.auth.getSession(),
    getUser: () => realSupabase.auth.getUser(),
    signInWithPassword: (credentials: any) => realSupabase.auth.signInWithPassword(credentials),
    signUp: (credentials: any) => realSupabase.auth.signUp(credentials),
    signOut: () => realSupabase.auth.signOut(),
    onAuthStateChange: (callback: any) => realSupabase.auth.onAuthStateChange(callback),
    resetPasswordForEmail: (email: string, options?: any) =>
      realSupabase.auth.resetPasswordForEmail(email, options),
    updateUser: (attributes: any) => realSupabase.auth.updateUser(attributes),
  },
  
  from(table: string) {
    if (localStorage.getItem('@is_mock_session') === 'true') {
      return new MockBuilder(table) as any;
    }
    return realSupabase.from(table);
  },

  storage: {
    from(bucket: string) {
      if (localStorage.getItem('@is_mock_session') === 'true') {
        return {
          getPublicUrl: (filePath: string) => {
            if (filePath.startsWith('mock/')) {
              if (filePath.includes('promo')) return { data: { publicUrl: 'https://assets.mixkit.co/videos/preview/mixkit-gym-member-doing-barbell-squats-41589-large.mp4' } };
              if (filePath.includes('horario')) return { data: { publicUrl: 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=800&auto=format&fit=crop' } };
              if (filePath.includes('nutri')) return { data: { publicUrl: 'https://assets.mixkit.co/videos/preview/mixkit-athlete-drinking-water-from-his-bottle-41584-large.mp4' } };
            }
            return { data: { publicUrl: 'https://assets.mixkit.co/videos/preview/mixkit-gym-member-doing-barbell-squats-41589-large.mp4' } };
          },
          upload: async (filePath: string, file: File) => {
            const media = getMockData('@mock_media_files', initialMediaFiles);
            media.push({
              id: Math.random().toString(36).substring(2, 15),
              org_id: '00000000-0000-0000-0000-000000000001',
              name: file.name,
              file_path: filePath,
              file_type: file.type,
              file_size: file.size,
              duration_seconds: file.type.startsWith('video/') ? 15 : null,
              checksum: 'mock-sum',
              created_at: new Date().toISOString()
            });
            saveMockData('@mock_media_files', media);
            return { data: {}, error: null };
          },
          remove: async (paths: string[]) => {
            let media = getMockData('@mock_media_files', initialMediaFiles);
            media = media.filter((m: any) => !paths.includes(m.file_path));
            saveMockData('@mock_media_files', media);
            return { data: {}, error: null };
          }
        } as any;
      }
      return realSupabase.storage.from(bucket);
    }
  },

  channel(name: string) {
    if (localStorage.getItem('@is_mock_session') === 'true') {
      return {
        on: function() { return this; },
        subscribe: () => ({})
      } as any;
    }
    return realSupabase.channel(name);
  },

  removeChannel(subscription: any) {
    if (localStorage.getItem('@is_mock_session') === 'true') return;
    realSupabase.removeChannel(subscription);
  }
} as any;

export default supabase;
