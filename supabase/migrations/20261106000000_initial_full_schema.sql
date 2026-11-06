-- =============================================================================
-- ELEVATE MÍDIA INDOOR - SETUP COMPLETO DO BANCO DE DADOS SUPABASE
-- Inclui: Tabelas, Índices, Trigger de Auth -> public.users, RLS, Storage e Realtime
-- =============================================================================

-- Extensões necessárias
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- -----------------------------------------------------------------------------
-- 1. TABELA: organizations
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Organização padrão da Elevate Mídia Indoor
INSERT INTO public.organizations (id, name)
VALUES ('00000000-0000-0000-0000-000000000001', 'Elevate Mídia Indoor')
ON CONFLICT (id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 2. TABELA: users (vinculada ao auth.users)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001' REFERENCES public.organizations(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT,
  role TEXT NOT NULL DEFAULT 'operator' CHECK (role IN ('admin', 'operator', 'partner', 'advertiser')),
  raw_user_meta_data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_users_org_id ON public.users(org_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);

-- Trigger para sincronizar novos usuários do Supabase Auth para public.users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
  v_org_id UUID;
  v_name TEXT;
BEGIN
  v_role := COALESCE(
    NEW.raw_app_meta_data->>'role',
    NEW.raw_user_meta_data->>'role',
    'operator'
  );

  IF v_role NOT IN ('admin', 'operator', 'partner', 'advertiser') THEN
    v_role := 'operator';
  END IF;

  BEGIN
    v_org_id := COALESCE(
      (NEW.raw_user_meta_data->>'org_id')::UUID,
      '00000000-0000-0000-0000-000000000001'::UUID
    );
  EXCEPTION WHEN OTHERS THEN
    v_org_id := '00000000-0000-0000-0000-000000000001'::UUID;
  END;

  v_name := COALESCE(
    NEW.raw_user_meta_data->>'name',
    split_part(NEW.email, '@', 1)
  );

  INSERT INTO public.users (id, org_id, email, name, role, raw_user_meta_data)
  VALUES (
    NEW.id,
    v_org_id,
    NEW.email,
    v_name,
    v_role,
    COALESCE(NEW.raw_user_meta_data, '{}'::jsonb)
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    name = COALESCE(EXCLUDED.name, public.users.name),
    role = COALESCE(EXCLUDED.role, public.users.role),
    raw_user_meta_data = EXCLUDED.raw_user_meta_data;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- -----------------------------------------------------------------------------
-- 3. TABELA: partners (Unidades / Academias / Estabelecimentos Parceiros)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.partners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  org_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001' REFERENCES public.organizations(id) ON DELETE CASCADE,
  commission_rate NUMERIC(5,4) NOT NULL DEFAULT 0.10,
  referral_code TEXT UNIQUE,
  establishment_name TEXT DEFAULT 'Academia Parceira',
  student_count INTEGER DEFAULT 0,
  category TEXT DEFAULT 'Comércio & Varejo',
  cep TEXT DEFAULT '',
  city TEXT DEFAULT '',
  state TEXT DEFAULT '',
  neighborhood TEXT DEFAULT '',
  address TEXT DEFAULT '',
  target_audience TEXT DEFAULT 'Jovens e Adultos (18 a 40 anos)',
  working_days TEXT DEFAULT 'Segunda a Sábado',
  operating_hours TEXT DEFAULT '06h00 às 22h00',
  peak_hours TEXT DEFAULT 'Manhã e Noite (06h-09h e 18h-21h)',
  phone TEXT DEFAULT '',
  contact_person TEXT DEFAULT '',
  max_media_slots INTEGER DEFAULT 3,
  pix_key TEXT,
  pix_type TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_partners_user_id ON public.partners(user_id);
CREATE INDEX IF NOT EXISTS idx_partners_org_id ON public.partners(org_id);

-- -----------------------------------------------------------------------------
-- 4. TABELA: advertisers (Empresas Anunciantes)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.advertisers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  org_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001' REFERENCES public.organizations(id) ON DELETE CASCADE,
  partner_id UUID REFERENCES public.partners(id) ON DELETE SET NULL,
  company_name TEXT NOT NULL,
  contact_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_advertisers_user_id ON public.advertisers(user_id);
CREATE INDEX IF NOT EXISTS idx_advertisers_partner_id ON public.advertisers(partner_id);
CREATE INDEX IF NOT EXISTS idx_advertisers_org_id ON public.advertisers(org_id);

-- -----------------------------------------------------------------------------
-- 5. TABELA: terminals (TVs / Players de Mídia Indoor)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.terminals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001' REFERENCES public.organizations(id) ON DELETE CASCADE,
  partner_id UUID REFERENCES public.partners(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  location TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'offline' CHECK (status IN ('online', 'offline')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  device_info JSONB DEFAULT '{}'::jsonb,
  last_sync_at TIMESTAMPTZ,
  last_seen_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_terminals_org_id ON public.terminals(org_id);
CREATE INDEX IF NOT EXISTS idx_terminals_partner_id ON public.terminals(partner_id);

-- -----------------------------------------------------------------------------
-- 6. TABELA: media_files (Vídeos e Imagens)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.media_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001' REFERENCES public.organizations(id) ON DELETE CASCADE,
  partner_id UUID REFERENCES public.partners(id) ON DELETE SET NULL,
  advertiser_id UUID REFERENCES public.advertisers(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  original_name TEXT,
  file_path TEXT NOT NULL,
  url TEXT,
  file_type TEXT DEFAULT 'video/mp4',
  file_size BIGINT DEFAULT 0,
  duration_seconds INTEGER DEFAULT 15,
  checksum TEXT,
  status TEXT NOT NULL DEFAULT 'approved' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_media_files_org_id ON public.media_files(org_id);
CREATE INDEX IF NOT EXISTS idx_media_files_partner_id ON public.media_files(partner_id);
CREATE INDEX IF NOT EXISTS idx_media_files_advertiser_id ON public.media_files(advertiser_id);
CREATE INDEX IF NOT EXISTS idx_media_files_status ON public.media_files(status);

-- -----------------------------------------------------------------------------
-- 7. TABELA: playlists & playlist_items
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.playlists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  terminal_id UUID NOT NULL REFERENCES public.terminals(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_playlists_terminal_id ON public.playlists(terminal_id);

CREATE TABLE IF NOT EXISTS public.playlist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  playlist_id UUID NOT NULL REFERENCES public.playlists(id) ON DELETE CASCADE,
  media_id UUID NOT NULL REFERENCES public.media_files(id) ON DELETE CASCADE,
  "order" INTEGER NOT NULL DEFAULT 1,
  duration_override INTEGER DEFAULT 15,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_playlist_items_playlist_id ON public.playlist_items(playlist_id);
CREATE INDEX IF NOT EXISTS idx_playlist_items_media_id ON public.playlist_items(media_id);

-- -----------------------------------------------------------------------------
-- 8. TABELA: terminal_logs & playback_stats (Telemetria e Exibições)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.terminal_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  terminal_id UUID REFERENCES public.terminals(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_terminal_logs_terminal_id ON public.terminal_logs(terminal_id);
CREATE INDEX IF NOT EXISTS idx_terminal_logs_event_created ON public.terminal_logs(event_type, created_at DESC);

CREATE TABLE IF NOT EXISTS public.playback_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  media_id UUID NOT NULL REFERENCES public.media_files(id) ON DELETE CASCADE,
  total_plays BIGINT NOT NULL DEFAULT 0,
  last_played_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_playback_stats_media_id ON public.playback_stats(media_id);

-- -----------------------------------------------------------------------------
-- 9. TABELA: invoices (Faturamento de Anunciantes)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001' REFERENCES public.organizations(id) ON DELETE CASCADE,
  advertiser_id UUID NOT NULL REFERENCES public.advertisers(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'overdue', 'cancelled')),
  due_date DATE,
  paid_date TIMESTAMPTZ,
  invoice_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_invoices_advertiser_id ON public.invoices(advertiser_id);
CREATE INDEX IF NOT EXISTS idx_invoices_org_id ON public.invoices(org_id);

-- -----------------------------------------------------------------------------
-- 10. TABELA: leads (Captação Landing Page / Opt-in VIP)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  "gymName" TEXT NOT NULL,
  "tvCount" TEXT DEFAULT '1-3',
  vip_code TEXT,
  status TEXT DEFAULT 'pending_onboarding',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- =============================================================================
-- 11. ROW LEVEL SECURITY (RLS) E FUNÇÕES AUXILIARES DE AUTORIZAÇÃO
-- =============================================================================

CREATE OR REPLACE FUNCTION public.is_admin_or_operator()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = (SELECT auth.uid())
      AND role IN ('admin', 'operator')
  );
$$;

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.advertisers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.terminals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.playlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.playlist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.terminal_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.playback_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

-- Policies: organizations
DROP POLICY IF EXISTS "Authenticated users can view organizations" ON public.organizations;
CREATE POLICY "Authenticated users can view organizations"
  ON public.organizations FOR SELECT
  TO authenticated
  USING (true);

-- Policies: users
DROP POLICY IF EXISTS "Users can view own profile or admins view all" ON public.users;
CREATE POLICY "Users can view own profile or admins view all"
  ON public.users FOR SELECT
  TO authenticated
  USING (id = (SELECT auth.uid()) OR public.is_admin_or_operator());

DROP POLICY IF EXISTS "Users can update own profile or admins update all" ON public.users;
CREATE POLICY "Users can update own profile or admins update all"
  ON public.users FOR UPDATE
  TO authenticated
  USING (id = (SELECT auth.uid()) OR public.is_admin_or_operator())
  WITH CHECK (id = (SELECT auth.uid()) OR public.is_admin_or_operator());

DROP POLICY IF EXISTS "Admins can insert users" ON public.users;
CREATE POLICY "Admins can insert users"
  ON public.users FOR INSERT
  TO authenticated
  WITH CHECK (id = (SELECT auth.uid()) OR public.is_admin_or_operator());

-- Policies: partners
DROP POLICY IF EXISTS "Authenticated can view partners" ON public.partners;
CREATE POLICY "Authenticated can view partners"
  ON public.partners FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()) OR public.is_admin_or_operator());

DROP POLICY IF EXISTS "Admins and owners can manage partners" ON public.partners;
CREATE POLICY "Admins and owners can manage partners"
  ON public.partners FOR ALL
  TO authenticated
  USING (user_id = (SELECT auth.uid()) OR public.is_admin_or_operator())
  WITH CHECK (user_id = (SELECT auth.uid()) OR public.is_admin_or_operator());

-- Policies: advertisers
DROP POLICY IF EXISTS "View advertisers policy" ON public.advertisers;
CREATE POLICY "View advertisers policy"
  ON public.advertisers FOR SELECT
  TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR partner_id IN (SELECT id FROM public.partners WHERE user_id = (SELECT auth.uid()))
    OR public.is_admin_or_operator()
  );

DROP POLICY IF EXISTS "Manage advertisers policy" ON public.advertisers;
CREATE POLICY "Manage advertisers policy"
  ON public.advertisers FOR ALL
  TO authenticated
  USING (user_id = (SELECT auth.uid()) OR public.is_admin_or_operator())
  WITH CHECK (user_id = (SELECT auth.uid()) OR public.is_admin_or_operator());

-- Policies: terminals (players TV também podem sincronizar via anon/authenticated)
DROP POLICY IF EXISTS "Anyone can read active terminals" ON public.terminals;
CREATE POLICY "Anyone can read active terminals"
  ON public.terminals FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated manage terminals" ON public.terminals;
CREATE POLICY "Authenticated manage terminals"
  ON public.terminals FOR ALL
  TO authenticated
  USING (
    partner_id IN (SELECT id FROM public.partners WHERE user_id = (SELECT auth.uid()))
    OR public.is_admin_or_operator()
  )
  WITH CHECK (
    partner_id IN (SELECT id FROM public.partners WHERE user_id = (SELECT auth.uid()))
    OR public.is_admin_or_operator()
  );

-- Policies: media_files
DROP POLICY IF EXISTS "Anyone can view media_files" ON public.media_files;
CREATE POLICY "Anyone can view media_files"
  ON public.media_files FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated can insert media_files" ON public.media_files;
CREATE POLICY "Authenticated can insert media_files"
  ON public.media_files FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Owners and admins can update/delete media_files" ON public.media_files;
CREATE POLICY "Owners and admins can update/delete media_files"
  ON public.media_files FOR ALL
  TO authenticated
  USING (
    partner_id IN (SELECT id FROM public.partners WHERE user_id = (SELECT auth.uid()))
    OR advertiser_id IN (SELECT id FROM public.advertisers WHERE user_id = (SELECT auth.uid()))
    OR public.is_admin_or_operator()
  )
  WITH CHECK (
    partner_id IN (SELECT id FROM public.partners WHERE user_id = (SELECT auth.uid()))
    OR advertiser_id IN (SELECT id FROM public.advertisers WHERE user_id = (SELECT auth.uid()))
    OR public.is_admin_or_operator()
  );

-- Policies: playlists & playlist_items
DROP POLICY IF EXISTS "Anyone can read playlists" ON public.playlists;
CREATE POLICY "Anyone can read playlists"
  ON public.playlists FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Manage playlists" ON public.playlists;
CREATE POLICY "Manage playlists"
  ON public.playlists FOR ALL
  TO authenticated
  USING (
    terminal_id IN (
      SELECT t.id FROM public.terminals t
      JOIN public.partners p ON t.partner_id = p.id
      WHERE p.user_id = (SELECT auth.uid())
    )
    OR public.is_admin_or_operator()
  )
  WITH CHECK (
    terminal_id IN (
      SELECT t.id FROM public.terminals t
      JOIN public.partners p ON t.partner_id = p.id
      WHERE p.user_id = (SELECT auth.uid())
    )
    OR public.is_admin_or_operator()
  );

DROP POLICY IF EXISTS "Anyone can read playlist_items" ON public.playlist_items;
CREATE POLICY "Anyone can read playlist_items"
  ON public.playlist_items FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Manage playlist_items" ON public.playlist_items;
CREATE POLICY "Manage playlist_items"
  ON public.playlist_items FOR ALL
  TO authenticated
  USING (
    playlist_id IN (
      SELECT pl.id FROM public.playlists pl
      JOIN public.terminals t ON pl.terminal_id = t.id
      JOIN public.partners p ON t.partner_id = p.id
      WHERE p.user_id = (SELECT auth.uid())
    )
    OR public.is_admin_or_operator()
  )
  WITH CHECK (
    playlist_id IN (
      SELECT pl.id FROM public.playlists pl
      JOIN public.terminals t ON pl.terminal_id = t.id
      JOIN public.partners p ON t.partner_id = p.id
      WHERE p.user_id = (SELECT auth.uid())
    )
    OR public.is_admin_or_operator()
  );

-- Policies: terminal_logs & playback_stats
DROP POLICY IF EXISTS "Anyone can insert and read terminal_logs" ON public.terminal_logs;
CREATE POLICY "Anyone can insert and read terminal_logs"
  ON public.terminal_logs FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone can read and update playback_stats" ON public.playback_stats;
CREATE POLICY "Anyone can read and update playback_stats"
  ON public.playback_stats FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- Policies: invoices
DROP POLICY IF EXISTS "Advertisers view own invoices or admins manage all" ON public.invoices;
CREATE POLICY "Advertisers view own invoices or admins manage all"
  ON public.invoices FOR SELECT
  TO authenticated
  USING (
    advertiser_id IN (SELECT id FROM public.advertisers WHERE user_id = (SELECT auth.uid()))
    OR public.is_admin_or_operator()
  );

DROP POLICY IF EXISTS "Admins manage invoices" ON public.invoices;
CREATE POLICY "Admins manage invoices"
  ON public.invoices FOR ALL
  TO authenticated
  USING (public.is_admin_or_operator())
  WITH CHECK (public.is_admin_or_operator());

-- Policies: leads
DROP POLICY IF EXISTS "Permitir cadastro público de leads" ON public.leads;
CREATE POLICY "Permitir cadastro público de leads"
  ON public.leads FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Admins podem gerenciar leads" ON public.leads;
CREATE POLICY "Admins podem gerenciar leads"
  ON public.leads FOR ALL
  TO authenticated
  USING (public.is_admin_or_operator())
  WITH CHECK (public.is_admin_or_operator());

-- =============================================================================
-- 12. STORAGE BUCKET: media
-- =============================================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('media', 'media', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "Public read access on media bucket" ON storage.objects;
CREATE POLICY "Public read access on media bucket"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'media');

DROP POLICY IF EXISTS "Authenticated upload access on media bucket" ON storage.objects;
CREATE POLICY "Authenticated upload access on media bucket"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'media');

DROP POLICY IF EXISTS "Authenticated update access on media bucket" ON storage.objects;
CREATE POLICY "Authenticated update access on media bucket"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'media')
  WITH CHECK (bucket_id = 'media');

DROP POLICY IF EXISTS "Authenticated delete access on media bucket" ON storage.objects;
CREATE POLICY "Authenticated delete access on media bucket"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'media');

-- =============================================================================
-- 13. REALTIME PUBLICATIONS
-- =============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'terminals'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.terminals;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'terminal_logs'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.terminal_logs;
  END IF;
END $$;

-- =============================================================================
-- 14. DATA API GRANTS (anon, authenticated, service_role)
-- =============================================================================
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;


