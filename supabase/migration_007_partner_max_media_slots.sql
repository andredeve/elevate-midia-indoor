-- =============================================
-- Migration 007: Adicionar coluna max_media_slots e liberar permissão RLS
-- Permite que o administrador configure a cota de mídias simultâneas na TV
-- e atualize os dados do parceiro (comissão, nome, etc.) no Supabase Dashboard.
-- Execute no SQL Editor do seu Supabase Dashboard.
-- =============================================

-- 1. Adicionar coluna dedicada para a cota de mídias
ALTER TABLE partners ADD COLUMN IF NOT EXISTS max_media_slots INTEGER DEFAULT 3;

-- 2. Atualizar registros existentes
UPDATE partners SET max_media_slots = 3 WHERE max_media_slots IS NULL;
UPDATE partners SET max_media_slots = 5 WHERE id = '07f37b69-c99a-4bcd-abbb-8af6cae26378';

-- 3. Liberar política de atualização (RLS) para administradores e parceiros autenticados na tabela partners
DROP POLICY IF EXISTS "Allow authenticated to update partners" ON partners;
CREATE POLICY "Allow authenticated to update partners"
  ON partners FOR ALL
  USING (true)
  WITH CHECK (true);

-- 4. Liberar política de atualização (RLS) para a tabela terminals
DROP POLICY IF EXISTS "Allow authenticated to update terminals" ON terminals;
CREATE POLICY "Allow authenticated to update terminals"
  ON terminals FOR ALL
  USING (true)
  WITH CHECK (true);
