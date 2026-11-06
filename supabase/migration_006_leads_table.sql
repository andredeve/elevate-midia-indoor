-- ════════════════════════════════════════════════════════════════
-- Tabela de Leads / Solicitações da Página Optin VIP (3 Meses Grátis)
-- ════════════════════════════════════════════════════════════════

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
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Permissões
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

-- Permitir inserção pública pelo formulário da Landing Page / Optin
DROP POLICY IF EXISTS "Permitir cadastro público de leads" ON public.leads;
CREATE POLICY "Permitir cadastro público de leads" 
ON public.leads 
FOR INSERT 
WITH CHECK (true);

-- Permitir leitura e edição
DROP POLICY IF EXISTS "Admins podem ver todos os leads" ON public.leads;
CREATE POLICY "Admins podem ver todos os leads" 
ON public.leads 
FOR ALL 
USING (true);
