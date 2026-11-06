-- =============================================
-- Migration 005: Extra fields for Partners
-- Enriquecimento de dados dos parceiros (academias/estabelecimentos)
-- para geração de relatórios publicitários e segmentação de anunciantes
-- =============================================

-- Adicionar colunas de estabelecimento e alcance
ALTER TABLE partners ADD COLUMN IF NOT EXISTS establishment_name TEXT DEFAULT 'Academia Parceira';
ALTER TABLE partners ADD COLUMN IF NOT EXISTS student_count INTEGER DEFAULT 0;
ALTER TABLE partners ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'Musculação';
ALTER TABLE partners ADD COLUMN IF NOT EXISTS cep TEXT DEFAULT '';
ALTER TABLE partners ADD COLUMN IF NOT EXISTS city TEXT DEFAULT '';
ALTER TABLE partners ADD COLUMN IF NOT EXISTS state TEXT DEFAULT '';
ALTER TABLE partners ADD COLUMN IF NOT EXISTS neighborhood TEXT DEFAULT '';
ALTER TABLE partners ADD COLUMN IF NOT EXISTS address TEXT DEFAULT '';
ALTER TABLE partners ADD COLUMN IF NOT EXISTS target_audience TEXT DEFAULT 'Jovens e Adultos (18 a 40 anos)';
ALTER TABLE partners ADD COLUMN IF NOT EXISTS working_days TEXT DEFAULT 'Segunda a Sábado';
ALTER TABLE partners ADD COLUMN IF NOT EXISTS operating_hours TEXT DEFAULT '06h00 às 22h00';
ALTER TABLE partners ADD COLUMN IF NOT EXISTS peak_hours TEXT DEFAULT 'Manhã e Noite (06h-09h e 18h-21h)';
ALTER TABLE partners ADD COLUMN IF NOT EXISTS phone TEXT DEFAULT '';
ALTER TABLE partners ADD COLUMN IF NOT EXISTS contact_person TEXT DEFAULT '';

-- Atualizar registros que possam estar nulos com valores padrão
UPDATE partners SET establishment_name = 'Academia Parceira' WHERE establishment_name IS NULL;
UPDATE partners SET student_count = 0 WHERE student_count IS NULL;
UPDATE partners SET category = 'Musculação & Cardio' WHERE category IS NULL;
UPDATE partners SET cep = '' WHERE cep IS NULL;
UPDATE partners SET city = '' WHERE city IS NULL;
UPDATE partners SET state = '' WHERE state IS NULL;
UPDATE partners SET neighborhood = '' WHERE neighborhood IS NULL;
UPDATE partners SET address = '' WHERE address IS NULL;
UPDATE partners SET target_audience = 'Jovens e Adultos (18 a 40 anos)' WHERE target_audience IS NULL;
UPDATE partners SET working_days = 'Segunda a Sábado' WHERE working_days IS NULL;
UPDATE partners SET operating_hours = '06h00 às 22h00' WHERE operating_hours IS NULL;
UPDATE partners SET peak_hours = 'Manhã e Noite (06h-09h e 18h-21h)' WHERE peak_hours IS NULL;
UPDATE partners SET phone = '' WHERE phone IS NULL;
UPDATE partners SET contact_person = '' WHERE contact_person IS NULL;
