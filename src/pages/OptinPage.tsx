import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MonitorPlay, Zap, Shield, ChevronDown, CheckCircle,
  Clock, Sparkles, Building2, Phone, Mail, User,
  Award, RefreshCw, ArrowRight, Check, Copy, MessageSquare,
  DollarSign, WifiOff, LayoutDashboard
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import './OptinPage.css';

interface LeadData {
  name: string;
  email: string;
  phone: string;
  gymName: string;
  tvCount: '1-3' | '4-10' | '10+';
}

export default function OptinPage() {
  const navigate = useNavigate();
  const [lead, setLead] = useState<LeadData>({
    name: '',
    email: '',
    phone: '',
    gymName: '',
    tvCount: '1-3'
  });
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [copied, setCopied] = useState(false);
  const [vipCode, setVipCode] = useState('');

  // Formatar telefone à medida que o usuário digita
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/\D/g, '');
    if (val.length > 11) val = val.slice(0, 11);
    if (val.length > 2) {
      val = `(${val.slice(0, 2)}) ${val.slice(2)}`;
    }
    if (val.length > 9) {
      val = `${val.slice(0, 9)}-${val.slice(9)}`;
    }
    setLead(prev => ({ ...prev, phone: val }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lead.name || !lead.email || !lead.phone || !lead.gymName) {
      alert('Por favor, preencha todos os campos obrigatórios.');
      return;
    }

    setLoading(true);

    const generatedCode = `VIP-ELV-${Math.floor(1000 + Math.random() * 9000)}`;
    const newLead = {
      ...lead,
      vip_code: generatedCode,
      created_at: new Date().toISOString(),
      status: 'pending_onboarding'
    };

    // 1. Salvar no localStorage de segurança
    try {
      const existing = JSON.parse(localStorage.getItem('@elevate_leads_capture') || '[]');
      localStorage.setItem('@elevate_leads_capture', JSON.stringify([newLead, ...existing]));
    } catch {}

    // 2. Tentar inserir na tabela do Supabase (se existente)
    try {
      await (supabase as any).from('leads').insert([newLead]);
    } catch {}

    setVipCode(generatedCode);
    setLoading(false);
    setSubmitted(true);
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(vipCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const getWhatsAppUrl = () => {
    const text = encodeURIComponent(
      `Olá! Me chamo ${lead.name} do estabelecimento "${lead.gymName}". Acabei de me cadastrar para os 3 MESES GRÁTIS da Elevate Mídia Indoor com o código ${vipCode}. Tenho ${lead.tvCount === '10+' ? 'mais de 10' : lead.tvCount} TVs e gostaria de ativar minha licença VIP!`
    );
    return `https://wa.me/5511999999999?text=${text}`;
  };

  return (
    <div className="opt-root">
      {/* ── TICKER DE TOPO ── */}
      <div className="opt-top-ticker">
        <span className="opt-ticker-badge">OFERTA DE MIGRAÇÃO</span>
        <span>⚡ 3 MESES (90 DIAS) DE ACESSO PRO GRÁTIS PARA EMPRESAS E ESTABELECIMENTOS QUE JÁ POSSUEM TELAS OU SMART TVS INSTALADAS ⚡</span>
      </div>

      {/* ── NAVBAR ── */}
      <nav className="opt-nav">
        <div className="opt-nav-logo" onClick={() => navigate('/')}>
          <img src="/logo.png" alt="Elevate Mídia Indoor" className="opt-nav-logo-img" />
          <span className="opt-nav-tag">
            <Sparkles size={14} /> PROGRAMA VIP 2026
          </span>
        </div>

        <button className="opt-nav-login-btn" onClick={() => navigate('/login')}>
          Já é cliente? Entrar <ArrowRight size={16} />
        </button>
      </nav>

      {/* ── HERO SECTION ── */}
      <main className="opt-hero">
        <div className="opt-bg-glow" />

        {/* COLUNA ESQUERDA: COPY E PROPOSTA */}
        <div className="opt-hero-left">
          <div className="opt-hero-badge">
            <Sparkles size={14} />
            <span>OFERTA EXCLUSIVA PARA ESTABELECIMENTOS E REDES DE MÍDIA INDOOR</span>
          </div>

          <h1 className="opt-hero-title">
            Você Já Tem Telas no Seu Espaço. Agora Transforme Cada TV Em uma <span className="opt-highlight">Máquina de Receita</span>
          </h1>

          <p className="opt-hero-subtitle">
            Chega de pen-drives travando, planilhas desatualizadas ou sistemas lentos. 
            Instale o <strong>Elevate Mídia Indoor</strong> em seus dispositivos atuais (Smart TVs, TV Box ou Chromecast) 
            e teste <strong>100% dos recursos PRO por 3 MESES GRÁTIS</strong>. Zero custo inicial e sem fidelidade.
          </p>

          <div className="opt-benefits-list">
            <div className="opt-benefit-item">
              <Zap size={22} className="opt-benefit-icon" />
              <div className="opt-benefit-content">
                <h4>Instalação Remota em 5 Minutos (Zero Hardware Extra)</h4>
                <p>Compatível com Smart TVs Samsung Tizen, LG webOS, Android TV, Fire TV Stick e Chromecast. Não compre nenhum equipamento novo.</p>
              </div>
            </div>

            <div className="opt-benefit-item">
              <Award size={22} className="opt-benefit-icon" />
              <div className="opt-benefit-content">
                <h4>3 Meses Grátis (90 Dias de Licença PRO Liberada)</h4>
                <p>Use playlists ilimitadas, relatórios de impressão e gestão multitelas de graça. Risco zero para você validar o retorno do sistema.</p>
              </div>
            </div>

            <div className="opt-benefit-item">
              <DollarSign size={22} className="opt-benefit-icon" />
              <div className="opt-benefit-content">
                <h4>Monetize com Anunciantes da Sua Região</h4>
                <p>Além de exibir comunicados e ofertas do próprio local, venda cotas de patrocínio local e pague o sistema com sobra após o período de teste.</p>
              </div>
            </div>
          </div>

          <div className="opt-testimonial-box">
            <p className="opt-testimonial-text">
              "Já tínhamos 6 Smart TVs rodando com pen-drive. Migrar para a Elevate Mídia Indoor levou menos de 20 minutos. Os 3 meses grátis nos deram tranquilidade para fechar 3 anunciantes antes de investir qualquer real!"
            </p>
            <div className="opt-testimonial-author">
              <div className="opt-author-avatar">CM</div>
              <div className="opt-author-info">
                <h5>Carlos Mendes</h5>
                <span>Diretor — Centro Comercial Prime (São Paulo/SP)</span>
              </div>
            </div>
          </div>
        </div>

        {/* COLUNA DIREITA: FORMULÁRIO GLASSMORPHIC VIP */}
        <div className="opt-form-card">
          <div className="opt-form-header">
            <span className="opt-form-badge">🔥 LICENÇAS DISPONÍVEIS ESTA SEMANA</span>
            <h2 className="opt-form-title">Ativar 3 Meses Grátis</h2>
            <p className="opt-form-subtitle">Preencha abaixo para emitir sua licença VIP imediata</p>
          </div>

          <form className="opt-form" onSubmit={handleSubmit}>
            <div className="opt-field-group">
              <label className="opt-label">Seu Nome Completo</label>
              <div className="opt-input-wrapper">
                <User size={18} className="opt-input-icon" />
                <input
                  type="text"
                  required
                  placeholder="Ex: Rafael Souza"
                  className="opt-input"
                  value={lead.name}
                  onChange={e => setLead({ ...lead, name: e.target.value })}
                />
              </div>
            </div>

            <div className="opt-field-group">
              <label className="opt-label">E-mail Comercial</label>
              <div className="opt-input-wrapper">
                <Mail size={18} className="opt-input-icon" />
                <input
                  type="email"
                  required
                  placeholder="contato@suaempresa.com.br"
                  className="opt-input"
                  value={lead.email}
                  onChange={e => setLead({ ...lead, email: e.target.value })}
                />
              </div>
            </div>

            <div className="opt-field-group">
              <label className="opt-label">WhatsApp com DDD</label>
              <div className="opt-input-wrapper">
                <Phone size={18} className="opt-input-icon" />
                <input
                  type="tel"
                  required
                  placeholder="(11) 99999-9999"
                  className="opt-input"
                  value={lead.phone}
                  onChange={handlePhoneChange}
                />
              </div>
            </div>

            <div className="opt-field-group">
              <label className="opt-label">Nome da Empresa / Estabelecimento ou Rede</label>
              <div className="opt-input-wrapper">
                <Building2 size={18} className="opt-input-icon" />
                <input
                  type="text"
                  required
                  placeholder="Ex: Centro Comercial Prime"
                  className="opt-input"
                  value={lead.gymName}
                  onChange={e => setLead({ ...lead, gymName: e.target.value })}
                />
              </div>
            </div>

            <div className="opt-field-group">
              <label className="opt-label">Quantas telas / TVs você já possui?</label>
              <div className="opt-radio-grid">
                <div
                  className={`opt-radio-btn ${lead.tvCount === '1-3' ? 'active' : ''}`}
                  onClick={() => setLead({ ...lead, tvCount: '1-3' })}
                >
                  1 a 3 Telas
                </div>
                <div
                  className={`opt-radio-btn ${lead.tvCount === '4-10' ? 'active' : ''}`}
                  onClick={() => setLead({ ...lead, tvCount: '4-10' })}
                >
                  4 a 10 Telas
                </div>
                <div
                  className={`opt-radio-btn ${lead.tvCount === '10+' ? 'active' : ''}`}
                  onClick={() => setLead({ ...lead, tvCount: '10+' })}
                >
                  Mais de 10
                </div>
              </div>
            </div>

            <button type="submit" className="opt-submit-btn" disabled={loading}>
              {loading ? (
                <span>PROCESSANDO SUA LICENÇA...</span>
              ) : (
                <>
                  <span>QUERO 3 MESES GRÁTIS AGORA</span>
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>

          <div className="opt-form-footer">
            <span><Shield size={14} /> Zero cartão de crédito</span>
            <span>•</span>
            <span><Clock size={14} /> Ativação em 5 min</span>
            <span>•</span>
            <span><CheckCircle size={14} /> Sem multa</span>
          </div>
        </div>
      </main>

      {/* ── SEÇÃO: DIFERENCIAIS PARA QUEM JÁ TEM TELAS ── */}
      <section className="opt-section">
        <div className="opt-section-header">
          <h2 className="opt-section-title">Por Que Empresas e Redes Estão Substituindo Seus Sistemas Antigos?</h2>
          <p className="opt-section-subtitle">
            Ter a TV na parede é apenas 20% da estratégia. A Elevate Mídia Indoor resolve os outros 80% com tecnologia inteligente de nível corporativo.
          </p>
        </div>

        <div className="opt-reasons-grid">
          <div className="opt-reason-card">
            <div className="opt-reason-icon-wrap"><MonitorPlay size={26} /></div>
            <h3>Compatibilidade Universal</h3>
            <p>Roda nativamente nas principais marcas do mercado (Samsung, LG, Android TV, Fire TV, Chromecast). Aproveite seu investimento atual sem surpresas.</p>
          </div>

          <div className="opt-reason-card">
            <div className="opt-reason-icon-wrap"><RefreshCw size={26} /></div>
            <h3>Gestão 100% Remota</h3>
            <p>Atualize campanhas, informativos, cardápios e vídeos promocionais de casa ou pelo celular. As TVs sincronizam em tempo real.</p>
          </div>

          <div className="opt-reason-card">
            <div className="opt-reason-icon-wrap"><DollarSign size={26} /></div>
            <h3>Módulo Anunciantes</h3>
            <p>Área exclusiva para vincular parceiros e comércios locais. Emita relatórios automáticos em PDF com número exato de impressões para seus clientes.</p>
          </div>

          <div className="opt-reason-card">
            <div className="opt-reason-icon-wrap"><WifiOff size={26} /></div>
            <h3>Modo Offline Resiliente</h3>
            <p>Se a internet do local cair ou oscilar, as TVs não param de rodar. O cache inteligente garante reprodução contínua 24/7/365.</p>
          </div>
        </div>
      </section>

      {/* ── SEÇÃO: COMO FUNCIONA O PERÍODO GRÁTIS ── */}
      <section className="opt-section" style={{ background: 'rgba(255,255,255,0.015)', borderRadius: 32 }}>
        <div className="opt-section-header">
          <h2 className="opt-section-title">Como Funciona Seus 3 Meses de Acesso Gratuito?</h2>
          <p className="opt-section-subtitle">
            Três etapas simples para modernizar sua rede de telas hoje mesmo.
          </p>
        </div>

        <div className="opt-steps-grid">
          <div className="opt-step-card">
            <div className="opt-step-num">01</div>
            <h3>Cadastro Rápido</h3>
            <p>Preencha o formulário acima. Nossa plataforma gerará imediatamente o seu Código VIP com 90 dias de isenção de mensalidade.</p>
          </div>

          <div className="opt-step-card">
            <div className="opt-step-num">02</div>
            <h3>Pareamento das Suas TVs</h3>
            <p>Instale o aplicativo Elevate Player na loja da sua Smart TV ou dispositivo. Digite o código de 6 dígitos na tela para sincronizar.</p>
          </div>

          <div className="opt-step-card">
            <div className="opt-step-num">03</div>
            <h3>90 Dias de Lucro e Teste</h3>
            <p>Use playlists infinitas e cadastre anunciantes sem custo. No 91º dia, continue assinando apenas se o sistema tiver gerado lucro e valor real.</p>
          </div>
        </div>
      </section>

      {/* ── SEÇÃO: COMPARAÇÃO ANTES VS DEPOIS ── */}
      <section className="opt-section">
        <div className="opt-section-header">
          <h2 className="opt-section-title">O Fim dos Pen-Drives e Sistemas Ultrapassados</h2>
          <p className="opt-section-subtitle">
            Veja por que redes e estabelecimentos em todo o Brasil confiam no padrão Elevate Mídia Indoor.
          </p>
        </div>

        <div className="opt-table-container">
          <table className="opt-table">
            <thead>
              <tr>
                <th>Recurso ou Vantagem</th>
                <th>Pen-drive / Sistema Antigo</th>
                <th className="highlight-col">Elevate Mídia Indoor (3 Meses Grátis)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>Custo inicial ou compra de aparelhos</strong></td>
                <td className="negative">Gasto frequente com hardwares ou cartões</td>
                <td className="positive">R$ 0,00 — Usa suas Smart TVs atuais</td>
              </tr>
              <tr>
                <td><strong>Atualização de vídeos e recados</strong></td>
                <td className="negative">Manual (ir em TV por TV tirando pen-drive)</td>
                <td className="positive">Em Tempo Real (Via painel web de qualquer lugar)</td>
              </tr>
              <tr>
                <td><strong>Segmentação de Anúncios por Horário</strong></td>
                <td className="negative">Inexistente (roda o mesmo vídeo em loop)</td>
                <td className="positive">100% Automatizada por faixa horária</td>
              </tr>
              <tr>
                <td><strong>Relatórios de Comprovação para Anunciante</strong></td>
                <td className="negative">Nenhum relatório (difícil cobrar patrocinador)</td>
                <td className="positive">PDF profissional com número de exibições</td>
              </tr>
              <tr>
                <td><strong>Garantia de Teste sem Compromisso</strong></td>
                <td className="negative">Multas de fidelidade abusivas</td>
                <td className="positive">90 Dias Grátis com risco ZERO</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* ── SEÇÃO: FAQ DA OFERTA ── */}
      <section className="opt-section">
        <div className="opt-section-header">
          <h2 className="opt-section-title">Perguntas Frequentes (FAQ)</h2>
          <p className="opt-section-subtitle">Tire suas dúvidas sobre a oferta de migração de 3 meses grátis.</p>
        </div>

        <div className="opt-faq-list">
          <FaqItem
            q="1. Eu realmente não preciso pagar nada nos primeiros 3 meses (90 dias)?"
            a="Sim! Você terá acesso 100% gratuito ao plano PRO para testar a ferramenta em todas as TVs do seu estabelecimento. Não pedimos cartão de crédito na ativação e não existem taxas ocultas."
          />
          <FaqItem
            q="2. Já tenho Smart TVs e TV Box instaladas. Preciso comprar algum aparelho?"
            a="Não. A Elevate Mídia Indoor foi projetada para rodar nos equipamentos que você já possui: Smart TVs Samsung, LG, Android TV, Amazon Fire TV Stick ou Chromecasts."
          />
          <FaqItem
            q="3. O que acontece depois de terminarem os 3 meses gratuitos?"
            a="Ao final dos 90 dias, você poderá escolher o plano que melhor atende à sua operação ou cancelar o serviço sem qualquer multa ou burocracia."
          />
          <FaqItem
            q="4. Como funciona para cadastrar anunciantes na minha rede de telas?"
            a="Você tem um módulo exclusivo para anunciantes no painel. Você cadastra empresas parceiras da sua cidade e define em quais TVs e horários o anúncio delas vai rodar."
          />
          <FaqItem
            q="5. Terei suporte técnico se precisar de ajuda na configuração?"
            a="Sim! Nossa equipe de especialistas oferece suporte completo via WhatsApp para auxiliar você e sua equipe a parearem as telas e montarem as primeiras playlists de vídeos."
          />
        </div>
      </section>

      {/* ── CTA FINAL BAR ── */}
      <div className="opt-final-cta">
        <h2 className="opt-final-title">Pronto para Elevar as Telas do Seu Negócio?</h2>
        <p className="opt-final-subtitle">
          Garanta agora sua licença de 3 Meses Grátis. Sem cartão de crédito, sem risco e com ativação imediata.
        </p>
        <button
          className="opt-submit-btn"
          style={{ margin: '0 auto' }}
          onClick={() => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
        >
          <span>QUERO REIVINDICAR MEUS 3 MESES GRÁTIS</span>
          <ArrowRight size={18} />
        </button>
      </div>

      {/* ── FOOTER ── */}
      <footer className="opt-footer">
        <p>© 2026 Elevate Mídia Indoor — Todos os direitos reservados.</p>
      </footer>

      {/* ── MODAL DE SUCESSO EXCLUSIVO VIP ── */}
      {submitted && (
        <div className="opt-modal-overlay">
          <div className="opt-modal-card">
            <div className="opt-modal-icon">
              <CheckCircle size={44} />
            </div>

            <h2>Parabéns, {lead.name.split(' ')[0]}!</h2>
            <p>
              Seus <strong>3 MESES GRÁTIS</strong> foram liberados com sucesso para <strong>{lead.gymName}</strong>!
            </p>

            <div className="opt-code-box">
              <div>
                <div className="opt-code-label">SEU CÓDIGO VIP DE MIGRAÇÃO:</div>
                <div className="opt-code-value">{vipCode}</div>
              </div>
              <button className="opt-code-copy" onClick={handleCopyCode}>
                {copied ? <Check size={16} /> : <Copy size={16} />}
                {copied ? ' COPIADO!' : ' COPIAR'}
              </button>
            </div>

            <div className="opt-modal-actions">
              <a
                href={getWhatsAppUrl()}
                target="_blank"
                rel="noopener noreferrer"
                className="opt-btn-whatsapp"
              >
                <MessageSquare size={18} />
                Falar com Especialista para Ativar Agora
              </a>

              <button
                className="opt-btn-secondary"
                onClick={() => navigate('/login')}
              >
                <LayoutDashboard size={16} style={{ marginRight: 8, display: 'inline' }} />
                Acessar o Painel Administrativo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── COMPONENTE DE ACCORDION FAQ ──
function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = React.useState(false);
  return (
    <div className={`opt-faq-item ${open ? 'open' : ''}`} onClick={() => setOpen(!open)}>
      <div className="opt-faq-question">
        <span>{q}</span>
        <ChevronDown size={20} className="opt-faq-chevron" />
      </div>
      <div className="opt-faq-answer">
        <p>{a}</p>
      </div>
    </div>
  );
}
