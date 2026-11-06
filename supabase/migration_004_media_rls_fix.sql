-- =============================================
-- Migration 004: Media Files & Playlists RLS Fix for Partners and Advertisers
-- Permite que parceiros e anunciantes possam inserir e gerenciar suas próprias mídias e playlists vinculadas
-- Execute este script no SQL Editor do seu Supabase Dashboard
-- =============================================

-- 0. Permissão para parceiros e anunciantes consultarem seus próprios perfis
DROP POLICY IF EXISTS "Partners can view own profile" ON partners;
CREATE POLICY "Partners can view own profile"
  ON partners FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Advertisers can view own profile" ON advertisers;
CREATE POLICY "Advertisers can view own profile"
  ON advertisers FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can view own profile" ON users;
CREATE POLICY "Users can view own profile"
  ON users FOR SELECT
  USING (id = auth.uid());

-- 1. Permissão para usuários autenticados inserirem mídias na tabela media_files
DROP POLICY IF EXISTS "Users can insert org media" ON media_files;
CREATE POLICY "Users can insert org media"
  ON media_files FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- 2. Permissão para parceiros gerenciarem (SELECT, UPDATE, DELETE) suas próprias mídias
DROP POLICY IF EXISTS "Partners can manage their own media" ON media_files;
CREATE POLICY "Partners can manage their own media"
  ON media_files FOR ALL
  USING (
    partner_id IN (SELECT id FROM partners WHERE user_id = auth.uid())
  );

-- 3. Permissão para anunciantes gerenciarem suas próprias mídias
DROP POLICY IF EXISTS "Advertisers can manage their own media" ON media_files;
CREATE POLICY "Advertisers can manage their own media"
  ON media_files FOR ALL
  USING (
    advertiser_id IN (SELECT id FROM advertisers WHERE user_id = auth.uid())
  );

-- 4. Permissão para parceiros gerenciarem playlists de terminais vinculados ao seu parceiro
DROP POLICY IF EXISTS "Partners can manage linked terminal playlists" ON playlists;
CREATE POLICY "Partners can manage linked terminal playlists"
  ON playlists FOR ALL
  USING (
    terminal_id IN (
      SELECT t.id FROM terminals t
      JOIN partners p ON t.partner_id = p.id
      WHERE p.user_id = auth.uid()
    )
  )
  WITH CHECK (
    terminal_id IN (
      SELECT t.id FROM terminals t
      JOIN partners p ON t.partner_id = p.id
      WHERE p.user_id = auth.uid()
    )
  );

-- 5. Permissão para parceiros gerenciarem itens de playlist dos seus terminais vinculados
DROP POLICY IF EXISTS "Partners can manage linked terminal playlist items" ON playlist_items;
CREATE POLICY "Partners can manage linked terminal playlist items"
  ON playlist_items FOR ALL
  USING (
    playlist_id IN (
      SELECT pl.id FROM playlists pl
      JOIN terminals t ON pl.terminal_id = t.id
      JOIN partners p ON t.partner_id = p.id
      WHERE p.user_id = auth.uid()
    )
  )
  WITH CHECK (
    playlist_id IN (
      SELECT pl.id FROM playlists pl
      JOIN terminals t ON pl.terminal_id = t.id
      JOIN partners p ON t.partner_id = p.id
      WHERE p.user_id = auth.uid()
    )
  );
