import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useThemeStore } from '../stores/themeStore';
import {
  MonitorPlay, Tv, BarChart3, Users, Zap, Shield,
  ChevronDown, ChevronRight, Play, Star, ArrowRight,
  CheckCircle, Clock, Globe, Smartphone, Target,
  TrendingUp, Award, Eye, Sparkles, Building2,
  MapPin, Phone, Mail, Menu, X as XIcon, Sun, Moon
} from 'lucide-react';

// ────────────────────────────────────────────────
// Hook: Intersection Observer para animações ao scroll
// ────────────────────────────────────────────────
function useInView(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setIsVisible(true); },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, isVisible };
}

// ────────────────────────────────────────────────
// Contador animado
// ────────────────────────────────────────────────
function AnimatedCounter({ end, suffix = '', prefix = '', duration = 2000 }: { end: number; suffix?: string; prefix?: string; duration?: number }) {
  const [count, setCount] = useState(0);
  const { ref, isVisible } = useInView(0.3);

  useEffect(() => {
    if (!isVisible) return;
    let start = 0;
    const step = end / (duration / 16);
    const timer = setInterval(() => {
      start += step;
      if (start >= end) {
        setCount(end);
        clearInterval(timer);
      } else {
        setCount(Math.floor(start));
      }
    }, 16);
    return () => clearInterval(timer);
  }, [isVisible, end, duration]);

  return <span ref={ref}>{prefix}{count.toLocaleString('pt-BR')}{suffix}</span>;
}

// ────────────────────────────────────────────────
// FAQ Accordion Item
// ────────────────────────────────────────────────
function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`lp-faq-item ${open ? 'lp-faq-open' : ''}`} onClick={() => setOpen(!open)}>
      <div className="lp-faq-question">
        <span>{q}</span>
        <ChevronDown size={20} className={`lp-faq-chevron ${open ? 'lp-faq-chevron-open' : ''}`} />
      </div>
      <div className={`lp-faq-answer ${open ? 'lp-faq-answer-visible' : ''}`}>
        <p>{a}</p>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════
// LANDING PAGE PRINCIPAL
// ════════════════════════════════════════════════
export default function LandingPage() {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useThemeStore();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  // Detecta scroll para mudar navbar
  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 60);
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, []);

  // Animações de seções
  const heroRef = useInView(0.1);
  const featuresRef = useInView(0.1);
  const howRef = useInView(0.1);
  const statsRef = useInView(0.1);
  const pricingRef = useInView(0.1);
  const testimonialsRef = useInView(0.1);
  const faqRef = useInView(0.1);
  const ctaRef = useInView(0.1);
  const partnersRef = useInView(0.1);
  const advertisersRef = useInView(0.1);

  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    setMobileMenuOpen(false);
  };

  return (
    <div className="lp-root">
      {/* ═══════════════════════════════ NAVBAR ═══════════════════════════════ */}
      <nav className={`lp-nav ${scrolled ? 'lp-nav-scrolled' : ''}`}>
        <div className="lp-nav-inner">
          <div className="lp-nav-brand" onClick={() => scrollToSection('hero')}>
            <img
              src={theme === 'dark' ? '/logo-dark.png' : '/logo-light.png'}
              alt="Elevate Mídia Indoor"
              style={{ height: '48px', width: 'auto' }}
            />
          </div>

          <div className="lp-nav-links">
            <button onClick={() => navigate('/teste-gratis')} className="lp-nav-promo-btn">⚡ 3 Meses Grátis</button>
            <button onClick={() => scrollToSection('features')}>Recursos</button>
            <button onClick={() => scrollToSection('how-it-works')}>Como Funciona</button>
            <button onClick={() => scrollToSection('for-partners')}>Parceiros</button>
            <button onClick={() => scrollToSection('for-advertisers')}>Anunciantes</button>
            <button onClick={() => scrollToSection('pricing')}>Planos</button>
            <button onClick={() => scrollToSection('faq')}>FAQ</button>
          </div>

          <div className="lp-nav-actions">
            <button
              type="button"
              className="theme-toggle-btn"
              onClick={toggleTheme}
              title={theme === 'dark' ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
              aria-label={theme === 'dark' ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
            >
              {theme === 'dark' ? (
                <Sun size={15} strokeWidth={2} />
              ) : (
                <Moon size={15} strokeWidth={2} />
              )}
            </button>
            <button className="lp-btn-ghost" onClick={() => navigate('/login')}>Entrar</button>
            <button className="lp-btn-primary-sm" onClick={() => navigate('/teste-gratis')}>
              3 Meses Grátis <ArrowRight size={16} />
            </button>
          </div>

          <button className="lp-nav-mobile-toggle" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
            {mobileMenuOpen ? <XIcon size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {/* Mobile menu */}
        <div className={`lp-mobile-menu ${mobileMenuOpen ? 'lp-mobile-menu-open' : ''}`}>
          <button onClick={() => navigate('/teste-gratis')} className="lp-nav-promo-btn">⚡ 3 Meses Grátis</button>
          <button onClick={() => scrollToSection('features')}>Recursos</button>
          <button onClick={() => scrollToSection('how-it-works')}>Como Funciona</button>
          <button onClick={() => scrollToSection('for-partners')}>Parceiros</button>
          <button onClick={() => scrollToSection('for-advertisers')}>Anunciantes</button>
          <button onClick={() => scrollToSection('pricing')}>Planos</button>
          <button onClick={() => scrollToSection('faq')}>FAQ</button>
          <button className="lp-btn-primary-sm" onClick={() => navigate('/teste-gratis')}>⚡ 3 Meses Grátis</button>
          <button className="lp-btn-ghost" onClick={() => navigate('/login')} style={{ marginTop: 8 }}>Entrar</button>
        </div>
      </nav>

      {/* ═══════════════════════════════ HERO ═══════════════════════════════ */}
      <section id="hero" className={`lp-hero ${heroRef.isVisible ? 'lp-animate-in' : ''}`} ref={heroRef.ref}>
        <div className="lp-hero-bg">
          <div className="lp-hero-orb lp-hero-orb-1" />
          <div className="lp-hero-orb lp-hero-orb-2" />
          <div className="lp-hero-orb lp-hero-orb-3" />
          <div className="lp-hero-grid-overlay" />
        </div>

        <div className="lp-hero-content">
          <div className="lp-hero-badge">
            <Sparkles size={14} />
            <span>Plataforma #1 de Gestão e Monetização de Mídia Indoor</span>
          </div>

          <h1 className="lp-hero-title">
            Transforme suas telas de
            <br />
            mídia indoor em <span className="lp-gradient-text">máquinas de receita</span>
          </h1>

          <p className="lp-hero-subtitle">
            Gerencie e monetize telas em clínicas, restaurantes, condomínios, lojas, academias e estabelecimentos comerciais com anúncios segmentados, gestão remota em tempo real e relatórios de performance.
            <strong> Zero hardware extra. Setup em 5 minutos.</strong>
          </p>

          <div className="lp-hero-ctas">
            <button className="lp-btn-primary" onClick={() => navigate('/teste-gratis')}>
              <Play size={18} />
              Comece Grátis — 3 Meses VIP
            </button>
            <button className="lp-btn-outline" onClick={() => scrollToSection('how-it-works')}>
              Ver Demonstração
              <ChevronRight size={18} />
            </button>
          </div>

          <div className="lp-hero-trust">
            <div className="lp-hero-trust-item">
              <CheckCircle size={16} />
              <span>Sem cartão de crédito</span>
            </div>
            <div className="lp-hero-trust-item">
              <Shield size={16} />
              <span>Dados 100% seguros</span>
            </div>
            <div className="lp-hero-trust-item">
              <Clock size={16} />
              <span>Setup em 5 min</span>
            </div>
          </div>
        </div>

        <div className="lp-hero-visual">
          <div className="lp-hero-mockup">
            <div className="lp-hero-screen">
              <div className="lp-hero-screen-header">
                <div className="lp-hero-screen-dots">
                  <span /><span /><span />
                </div>
                <span className="lp-hero-screen-url">painel.elevatemidia.com.br</span>
              </div>
              <div className="lp-hero-screen-body">
                <div className="lp-hero-dash-sidebar">
                  <div className="lp-dash-nav-item lp-dash-nav-active"><MonitorPlay size={14} /> Dashboard</div>
                  <div className="lp-dash-nav-item"><Tv size={14} /> Terminais</div>
                  <div className="lp-dash-nav-item"><Play size={14} /> Mídias</div>
                  <div className="lp-dash-nav-item"><BarChart3 size={14} /> Relatórios</div>
                  <div className="lp-dash-nav-item"><Users size={14} /> Parceiros</div>
                </div>
                <div className="lp-hero-dash-main">
                  <div className="lp-dash-stat-row">
                    <div className="lp-dash-stat-card">
                      <div className="lp-dash-stat-icon" style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}><Tv size={14} /></div>
                      <div>
                        <div className="lp-dash-stat-value">24</div>
                        <div className="lp-dash-stat-label">TVs Online</div>
                      </div>
                    </div>
                    <div className="lp-dash-stat-card">
                      <div className="lp-dash-stat-icon" style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}><Eye size={14} /></div>
                      <div>
                        <div className="lp-dash-stat-value">12.4K</div>
                        <div className="lp-dash-stat-label">Impressões</div>
                      </div>
                    </div>
                    <div className="lp-dash-stat-card">
                      <div className="lp-dash-stat-icon" style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}><TrendingUp size={14} /></div>
                      <div>
                        <div className="lp-dash-stat-value">R$ 8.7K</div>
                        <div className="lp-dash-stat-label">Receita</div>
                      </div>
                    </div>
                  </div>
                  <div className="lp-dash-chart-placeholder">
                    <div className="lp-dash-chart-bar" style={{ height: '35%' }} />
                    <div className="lp-dash-chart-bar" style={{ height: '55%' }} />
                    <div className="lp-dash-chart-bar" style={{ height: '45%' }} />
                    <div className="lp-dash-chart-bar" style={{ height: '70%' }} />
                    <div className="lp-dash-chart-bar" style={{ height: '60%' }} />
                    <div className="lp-dash-chart-bar lp-dash-chart-bar-active" style={{ height: '90%' }} />
                    <div className="lp-dash-chart-bar" style={{ height: '75%' }} />
                  </div>
                </div>
              </div>
            </div>
            <div className="lp-hero-glow" />
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════ SOCIAL PROOF BAR ═══════════════════════════════ */}
      <section className={`lp-proof-bar ${statsRef.isVisible ? 'lp-animate-in' : ''}`} ref={statsRef.ref}>
        <div className="lp-proof-inner">
          <div className="lp-proof-stat">
            <div className="lp-proof-number"><AnimatedCounter end={150} suffix="+" /></div>
            <div className="lp-proof-label">Pontos Parceiros</div>
          </div>
          <div className="lp-proof-divider" />
          <div className="lp-proof-stat">
            <div className="lp-proof-number"><AnimatedCounter end={500} suffix="+" /></div>
            <div className="lp-proof-label">Telas Ativas</div>
          </div>
          <div className="lp-proof-divider" />
          <div className="lp-proof-stat">
            <div className="lp-proof-number"><AnimatedCounter end={2} suffix="M+" /></div>
            <div className="lp-proof-label">Impressões / Mês</div>
          </div>
          <div className="lp-proof-divider" />
          <div className="lp-proof-stat">
            <div className="lp-proof-number"><AnimatedCounter end={99} suffix="%" /></div>
            <div className="lp-proof-label">Uptime Garantido</div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════ FEATURES BENTO GRID ═══════════════════════════════ */}
      <section id="features" className={`lp-section ${featuresRef.isVisible ? 'lp-animate-in' : ''}`} ref={featuresRef.ref}>
        <div className="lp-section-header">
          <span className="lp-section-tag">RECURSOS</span>
          <h2>Tudo que você precisa para <span className="lp-gradient-text">monetizar suas telas</span></h2>
          <p>Uma plataforma completa para gerenciar, transmitir e lucrar com telas de mídia indoor em qualquer segmento.</p>
        </div>

        <div className="lp-bento">
          <div className="lp-bento-card lp-bento-card-wide">
            <div className="lp-bento-icon" style={{ background: 'linear-gradient(135deg, #d932fc, #8a08ff, #3b01fd)' }}>
              <MonitorPlay size={24} />
            </div>
            <h3>Gestão Remota de Telas</h3>
            <p>Controle todas as telas da sua rede direto do painel web. Ligue, desligue, reinicie e monitore o status de cada TV em tempo real, de qualquer lugar.</p>
            <div className="lp-bento-visual">
              <div className="lp-bento-tv">
                <div className="lp-bento-tv-screen">
                  <div className="lp-bento-tv-led lp-led-green" />
                  <span>TV Salão Principal 01</span>
                  <span className="lp-bento-tv-status">● ONLINE</span>
                </div>
              </div>
              <div className="lp-bento-tv">
                <div className="lp-bento-tv-screen">
                  <div className="lp-bento-tv-led lp-led-green" />
                  <span>TV Recepção Central</span>
                  <span className="lp-bento-tv-status">● ONLINE</span>
                </div>
              </div>
            </div>
          </div>

          <div className="lp-bento-card">
            <div className="lp-bento-icon" style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}>
              <Target size={24} />
            </div>
            <h3>Anúncios Segmentados</h3>
            <p>Exiba conteúdo relevante por horário, região e público-alvo. Seus anunciantes pagam mais por audiência qualificada.</p>
          </div>

          <div className="lp-bento-card">
            <div className="lp-bento-icon" style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}>
              <BarChart3 size={24} />
            </div>
            <h3>Relatórios em Tempo Real</h3>
            <p>Dashboards completos com impressões, plays, horários de pico e comprovantes de veiculação para seus clientes.</p>
          </div>

          <div className="lp-bento-card">
            <div className="lp-bento-icon" style={{ background: 'linear-gradient(135deg, #ec4899, #db2777)' }}>
              <Smartphone size={24} />
            </div>
            <h3>App Nativo Android</h3>
            <p>Player dedicado que roda em qualquer Smart TV ou TV Box Android. Modo kiosk com boot automático — a TV liga e já transmite.</p>
          </div>

          <div className="lp-bento-card">
            <div className="lp-bento-icon" style={{ background: 'linear-gradient(135deg, #14b8a6, #0d9488)' }}>
              <Zap size={24} />
            </div>
            <h3>Atualização OTA Instantânea</h3>
            <p>Envie novos conteúdos para todas as telas simultaneamente. Sem pen drive, sem visita técnica. Atualize remotamente em segundos.</p>
          </div>

          <div className="lp-bento-card lp-bento-card-wide">
            <div className="lp-bento-icon" style={{ background: 'linear-gradient(135deg, #3b82f6, #2563eb)' }}>
              <Globe size={24} />
            </div>
            <h3>Painel de Controle Web</h3>
            <p>Gerencie parceiros, anunciantes, playlists, faturas e terminais em um único painel web responsivo e intuitivo. Acesse de qualquer dispositivo, a qualquer hora.</p>
            <div className="lp-bento-features-list">
              <span><CheckCircle size={14} /> Gestão de Parceiros</span>
              <span><CheckCircle size={14} /> Gestão de Anunciantes</span>
              <span><CheckCircle size={14} /> Biblioteca de Mídias</span>
              <span><CheckCircle size={14} /> Playlists Inteligentes</span>
              <span><CheckCircle size={14} /> Faturamento & Comissões</span>
              <span><CheckCircle size={14} /> Controle Remoto de TVs</span>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════ COMO FUNCIONA ═══════════════════════════════ */}
      <section id="how-it-works" className={`lp-section lp-section-dark ${howRef.isVisible ? 'lp-animate-in' : ''}`} ref={howRef.ref}>
        <div className="lp-section-header">
          <span className="lp-section-tag">COMO FUNCIONA</span>
          <h2>Do zero ao faturamento em <span className="lp-gradient-text">3 passos simples</span></h2>
          <p>Sem necessidade de conhecimento técnico. A Elevate Mídia Indoor cuida de tudo.</p>
        </div>

        <div className="lp-steps">
          <div className="lp-step">
            <div className="lp-step-number">01</div>
            <div className="lp-step-icon"><Building2 size={32} /></div>
            <h3>Cadastre seu Ponto ou Rede</h3>
            <p>Registre seus estabelecimentos parceiros, configure horários de funcionamento e dados do público-alvo para atrair anunciantes relevantes.</p>
          </div>

          <div className="lp-step-connector">
            <ArrowRight size={24} />
          </div>

          <div className="lp-step">
            <div className="lp-step-number">02</div>
            <div className="lp-step-icon"><Tv size={32} /></div>
            <h3>Vincule suas Telas</h3>
            <p>Instale nosso app na Smart TV ou TV Box. Gere um código de pareamento no painel e vincule em segundos. A TV entra em modo kiosk automaticamente.</p>
          </div>

          <div className="lp-step-connector">
            <ArrowRight size={24} />
          </div>

          <div className="lp-step">
            <div className="lp-step-number">03</div>
            <div className="lp-step-icon"><TrendingUp size={32} /></div>
            <h3>Fature com Mídia Indoor</h3>
            <p>Seus anunciantes compram espaço publicitário. Os vídeos e banners são exibidos automaticamente em todas as telas, e você acompanha o faturamento em tempo real.</p>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════ PARA PARCEIROS (ESTABELECIMENTOS) ═══════════════════════════════ */}
      <section id="for-partners" className={`lp-section ${partnersRef.isVisible ? 'lp-animate-in' : ''}`} ref={partnersRef.ref}>
        <div className="lp-two-col">
          <div className="lp-two-col-text">
            <span className="lp-section-tag">PARA ESTABELECIMENTOS & PONTOS PARCEIROS</span>
            <h2>Suas TVs ociosas podem gerar <span className="lp-gradient-text">receita recorrente</span></h2>
            <p>Transforme cada televisor do seu espaço comercial, clínica, restaurante, condomínio ou academia em um ponto de mídia pago. Sem investimento inicial, sem complexidade técnica.</p>

            <div className="lp-benefit-list">
              <div className="lp-benefit-item">
                <div className="lp-benefit-check"><CheckCircle size={20} /></div>
                <div>
                  <strong>Receita passiva mensal</strong>
                  <p>Ganhe comissão sobre cada anúncio veiculado nas suas telas, sem esforço operacional.</p>
                </div>
              </div>
              <div className="lp-benefit-item">
                <div className="lp-benefit-check"><CheckCircle size={20} /></div>
                <div>
                  <strong>Mídia Kit profissional auto-gerado</strong>
                  <p>Apresente dados de alcance, fluxo mensal e horários de pico para seus potenciais anunciantes.</p>
                </div>
              </div>
              <div className="lp-benefit-item">
                <div className="lp-benefit-check"><CheckCircle size={20} /></div>
                <div>
                  <strong>Controle total sobre o conteúdo</strong>
                  <p>Aprove ou rejeite mídias antes de serem exibidas. Você decide o que passa nas suas telas.</p>
                </div>
              </div>
              <div className="lp-benefit-item">
                <div className="lp-benefit-check"><CheckCircle size={20} /></div>
                <div>
                  <strong>Indicação de anunciantes com comissão</strong>
                  <p>Indique empresas da região e ganhe comissão extra sobre cada contrato fechado.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="lp-two-col-visual">
            <div className="lp-partner-card-stack">
              <div className="lp-partner-mockup-card">
                <div className="lp-partner-mockup-header">
                  <Award size={18} />
                  <span>Mídia Kit — Centro Comercial Prime</span>
                </div>
                <div className="lp-partner-mockup-body">
                  <div className="lp-partner-stat-row">
                    <div className="lp-partner-stat">
                      <span className="lp-partner-stat-val">4.500</span>
                      <span className="lp-partner-stat-lbl">Fluxo Mensal</span>
                    </div>
                    <div className="lp-partner-stat">
                      <span className="lp-partner-stat-val">8</span>
                      <span className="lp-partner-stat-lbl">Telas Instaladas</span>
                    </div>
                  </div>
                  <div className="lp-partner-stat-row">
                    <div className="lp-partner-stat">
                      <span className="lp-partner-stat-val">20–55</span>
                      <span className="lp-partner-stat-lbl">Faixa Etária</span>
                    </div>
                    <div className="lp-partner-stat">
                      <span className="lp-partner-stat-val">07h–22h</span>
                      <span className="lp-partner-stat-lbl">Horário</span>
                    </div>
                  </div>
                  <div className="lp-partner-mockup-cta">
                    <span>📄 Exportar Mídia Kit PDF</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════ PARA ANUNCIANTES ═══════════════════════════════ */}
      <section id="for-advertisers" className={`lp-section lp-section-dark ${advertisersRef.isVisible ? 'lp-animate-in' : ''}`} ref={advertisersRef.ref}>
        <div className="lp-two-col lp-two-col-reverse">
          <div className="lp-two-col-visual">
            <div className="lp-advertiser-dash-mockup">
              <div className="lp-adv-metric">
                <Eye size={20} />
                <div>
                  <span className="lp-adv-metric-val">24.350</span>
                  <span className="lp-adv-metric-lbl">Impressões este mês</span>
                </div>
              </div>
              <div className="lp-adv-metric">
                <Tv size={20} />
                <div>
                  <span className="lp-adv-metric-val">18</span>
                  <span className="lp-adv-metric-lbl">Telas Exibindo</span>
                </div>
              </div>
              <div className="lp-adv-metric">
                <MapPin size={20} />
                <div>
                  <span className="lp-adv-metric-val">12</span>
                  <span className="lp-adv-metric-lbl">Pontos Parceiros</span>
                </div>
              </div>
              <div className="lp-adv-chart">
                <div className="lp-adv-chart-title">Performance Semanal</div>
                <div className="lp-adv-chart-bars">
                  <div className="lp-adv-bar" style={{ height: '40%' }}><span>Seg</span></div>
                  <div className="lp-adv-bar" style={{ height: '65%' }}><span>Ter</span></div>
                  <div className="lp-adv-bar" style={{ height: '55%' }}><span>Qua</span></div>
                  <div className="lp-adv-bar" style={{ height: '80%' }}><span>Qui</span></div>
                  <div className="lp-adv-bar" style={{ height: '70%' }}><span>Sex</span></div>
                  <div className="lp-adv-bar lp-adv-bar-highlight" style={{ height: '95%' }}><span>Sáb</span></div>
                  <div className="lp-adv-bar" style={{ height: '45%' }}><span>Dom</span></div>
                </div>
              </div>
            </div>
          </div>

          <div className="lp-two-col-text">
            <span className="lp-section-tag">PARA ANUNCIANTES</span>
            <h2>Alcance um público <span className="lp-gradient-text">engajado e segmentado</span></h2>
            <p>Anuncie diretamente para milhares de clientes em estabelecimentos parceiros da sua região, com métricas reais de exibição.</p>

            <div className="lp-benefit-list">
              <div className="lp-benefit-item">
                <div className="lp-benefit-check"><CheckCircle size={20} /></div>
                <div>
                  <strong>Audiência qualificada e cativa</strong>
                  <p>Pessoas em momentos de espera, compras, lazer ou atendimento com alta atenção visual às telas.</p>
                </div>
              </div>
              <div className="lp-benefit-item">
                <div className="lp-benefit-check"><CheckCircle size={20} /></div>
                <div>
                  <strong>Relatórios de comprovação</strong>
                  <p>Acompanhe em tempo real quantas vezes seu anúncio foi exibido, em quais horários e em quais locais.</p>
                </div>
              </div>
              <div className="lp-benefit-item">
                <div className="lp-benefit-check"><CheckCircle size={20} /></div>
                <div>
                  <strong>Submeta e gerencie suas mídias</strong>
                  <p>Envie vídeos e banners pelo painel. Atualize suas campanhas a qualquer momento sem custo adicional.</p>
                </div>
              </div>
              <div className="lp-benefit-item">
                <div className="lp-benefit-check"><CheckCircle size={20} /></div>
                <div>
                  <strong>Pagamento simplificado via PIX</strong>
                  <p>Faturas claras com pagamento instantâneo por PIX. Sem burocracia, sem contratos longos.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════ DEPOIMENTOS ═══════════════════════════════ */}
      <section className={`lp-section ${testimonialsRef.isVisible ? 'lp-animate-in' : ''}`} ref={testimonialsRef.ref}>
        <div className="lp-section-header">
          <span className="lp-section-tag">DEPOIMENTOS</span>
          <h2>Quem usa, <span className="lp-gradient-text">recomenda</span></h2>
        </div>

        <div className="lp-testimonials">
          <div className="lp-testimonial-card">
            <div className="lp-testimonial-stars">
              {[1,2,3,4,5].map(i => <Star key={i} size={16} fill="#f59e0b" color="#f59e0b" />)}
            </div>
            <p>"Antes nossas TVs só passavam vídeos genéricos. Hoje geram quase R$ 3.500/mês em receita de anúncios locais. A plataforma Elevate Mídia Indoor se pagou já no primeiro mês."</p>
            <div className="lp-testimonial-author">
              <div className="lp-testimonial-avatar">RG</div>
              <div>
                <strong>Rodrigo Gomes</strong>
                <span>Centro Comercial Prime — São Paulo, SP</span>
              </div>
            </div>
          </div>

          <div className="lp-testimonial-card">
            <div className="lp-testimonial-stars">
              {[1,2,3,4,5].map(i => <Star key={i} size={16} fill="#f59e0b" color="#f59e0b" />)}
            </div>
            <p>"Como anunciante regional, consigo exibir minha marca nos melhores pontos comerciais, clínicas e restaurantes da cidade com total transparência. O ROI é incomparável."</p>
            <div className="lp-testimonial-author">
              <div className="lp-testimonial-avatar">CL</div>
              <div>
                <strong>Camila Lima</strong>
                <span>Clínica & Estética Vida — Belo Horizonte, MG</span>
              </div>
            </div>
          </div>

          <div className="lp-testimonial-card">
            <div className="lp-testimonial-stars">
              {[1,2,3,4,5].map(i => <Star key={i} size={16} fill="#f59e0b" color="#f59e0b" />)}
            </div>
            <p>"A instalação foi incrivelmente simples. Baixei o app na TV Box, digitei o código de pareamento e em 2 minutos já estava tudo rodando nas nossas 12 telas. Suporte excepcional."</p>
            <div className="lp-testimonial-author">
              <div className="lp-testimonial-avatar">MF</div>
              <div>
                <strong>Marcos Ferreira</strong>
                <span>Rede Gastronômica Sabor — Curitiba, PR</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════ PRICING ═══════════════════════════════ */}
      <section id="pricing" className={`lp-section lp-section-dark ${pricingRef.isVisible ? 'lp-animate-in' : ''}`} ref={pricingRef.ref}>
        <div className="lp-section-header">
          <span className="lp-section-tag">PLANOS</span>
          <h2>Planos que cabem no <span className="lp-gradient-text">seu crescimento</span></h2>
          <p>Comece grátis e escale conforme sua rede de telas cresce. Sem taxas ocultas.</p>
        </div>

        <div className="lp-pricing-grid">
          <div className="lp-pricing-card">
            <div className="lp-pricing-name">Starter</div>
            <div className="lp-pricing-desc">Para estabelecimentos começando com mídia indoor</div>
            <div className="lp-pricing-price">
              <span className="lp-pricing-currency">R$</span>
              <span className="lp-pricing-amount">0</span>
              <span className="lp-pricing-period">/mês</span>
            </div>
            <ul className="lp-pricing-features">
              <li><CheckCircle size={16} /> Até 2 Telas</li>
              <li><CheckCircle size={16} /> Painel de controle completo</li>
              <li><CheckCircle size={16} /> 5 GB de armazenamento</li>
              <li><CheckCircle size={16} /> Relatórios básicos</li>
              <li><CheckCircle size={16} /> Suporte por e-mail</li>
            </ul>
            <button className="lp-btn-outline lp-btn-block" onClick={() => navigate('/teste-gratis')}>Comece Grátis (3 Meses VIP)</button>
          </div>

          <div className="lp-pricing-card lp-pricing-card-featured">
            <div className="lp-pricing-badge">MAIS POPULAR</div>
            <div className="lp-pricing-name">Professional</div>
            <div className="lp-pricing-desc">Para negócios e redes que querem monetizar de verdade</div>
            <div className="lp-pricing-price">
              <span className="lp-pricing-currency">R$</span>
              <span className="lp-pricing-amount">197</span>
              <span className="lp-pricing-period">/mês</span>
            </div>
            <ul className="lp-pricing-features">
              <li><CheckCircle size={16} /> Até 10 Telas</li>
              <li><CheckCircle size={16} /> Tudo do Starter +</li>
              <li><CheckCircle size={16} /> 50 GB de armazenamento</li>
              <li><CheckCircle size={16} /> Relatórios completos com PDF</li>
              <li><CheckCircle size={16} /> Mídia Kit auto-gerado</li>
              <li><CheckCircle size={16} /> Gestão de anunciantes</li>
              <li><CheckCircle size={16} /> Suporte prioritário</li>
            </ul>
            <button className="lp-btn-primary lp-btn-block" onClick={() => navigate('/teste-gratis')}>Ativar 3 Meses Grátis</button>
          </div>

          <div className="lp-pricing-card">
            <div className="lp-pricing-name">Enterprise</div>
            <div className="lp-pricing-desc">Para redes de mídia indoor e operações multi-unidade</div>
            <div className="lp-pricing-price">
              <span className="lp-pricing-currency">R$</span>
              <span className="lp-pricing-amount">497</span>
              <span className="lp-pricing-period">/mês</span>
            </div>
            <ul className="lp-pricing-features">
              <li><CheckCircle size={16} /> Telas ilimitadas</li>
              <li><CheckCircle size={16} /> Tudo do Professional +</li>
              <li><CheckCircle size={16} /> Armazenamento ilimitado</li>
              <li><CheckCircle size={16} /> API de integração</li>
              <li><CheckCircle size={16} /> Multi-unidades & franquias</li>
              <li><CheckCircle size={16} /> Onboarding dedicado</li>
              <li><CheckCircle size={16} /> SLA 99.9% com suporte 24/7</li>
            </ul>
            <button className="lp-btn-outline lp-btn-block" onClick={() => navigate('/teste-gratis')}>Falar com Vendas / Migração</button>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════ FAQ ═══════════════════════════════ */}
      <section id="faq" className={`lp-section ${faqRef.isVisible ? 'lp-animate-in' : ''}`} ref={faqRef.ref}>
        <div className="lp-section-header">
          <span className="lp-section-tag">FAQ</span>
          <h2>Perguntas <span className="lp-gradient-text">frequentes</span></h2>
        </div>

        <div className="lp-faq-list">
          <FaqItem
            q="Preciso de algum hardware especial?"
            a="Não! A Elevate Mídia Indoor funciona em qualquer Smart TV com Android ou TV Box Android (como Xiaomi Mi Box, Amazon Fire Stick, Chromecast, etc.). Basta instalar nosso app e parear com o painel. Você não precisa comprar nenhum equipamento especial."
          />
          <FaqItem
            q="Como funciona a receita de anúncios?"
            a="Anunciantes compram espaço publicitário na sua rede. Seus vídeos e banners são exibidos nas TVs dos estabelecimentos parceiros conforme a playlist configurada. O ponto parceiro pode receber comissão sobre cada anúncio veiculado. Tudo é rastreado automaticamente com relatórios de comprovação."
          />
          <FaqItem
            q="Quanto tempo leva para configurar?"
            a="Em média, 5 minutos. Cadastre seu estabelecimento no painel, instale o app na TV, digite o código de pareamento e pronto. As mídias começam a ser transmitidas automaticamente."
          />
          <FaqItem
            q="O conteúdo atualiza automaticamente?"
            a="Sim! Quando você adiciona ou altera uma mídia no painel, a atualização é enviada automaticamente para todas as TVs via OTA (Over-The-Air). Não é necessário pen drive ou visita técnica."
          />
          <FaqItem
            q="Posso aprovar os anúncios antes de exibir?"
            a="Com certeza. Toda mídia enviada por anunciantes ou parceiros passa por um fluxo de aprovação. Você tem controle total sobre o que é exibido nas telas."
          />
          <FaqItem
            q="O que acontece se a internet cair?"
            a="O player tem cache local inteligente. Todas as mídias são baixadas previamente e armazenadas no dispositivo. Se a internet cair, a reprodução continua normalmente com o conteúdo já baixado."
          />
          <FaqItem
            q="Posso usar a plataforma para conteúdo próprio e comunicados?"
            a="Sim! Além dos anúncios publicitários, você pode transmitir vídeos institucionais, cardápios digitais, avisos, tabelas de preços e promoções do próprio estabelecimento."
          />
          <FaqItem
            q="Existe contrato de fidelidade?"
            a="Não. Todos os planos são mensais e podem ser cancelados a qualquer momento. Sem multas, sem burocracia."
          />
        </div>
      </section>

      {/* ═══════════════════════════════ CTA FINAL ═══════════════════════════════ */}
      <section className={`lp-cta-section ${ctaRef.isVisible ? 'lp-animate-in' : ''}`} ref={ctaRef.ref}>
        <div className="lp-cta-bg">
          <div className="lp-cta-orb lp-cta-orb-1" />
          <div className="lp-cta-orb lp-cta-orb-2" />
        </div>
        <div className="lp-cta-content">
          <h2>Pronto para elevar suas telas e transformá-las em <span className="lp-gradient-text">receita?</span></h2>
          <p>Junte-se a mais de 150 estabelecimentos e redes que já faturam com a Elevate Mídia Indoor. Comece grátis hoje mesmo.</p>
          <div className="lp-cta-actions">
            <button className="lp-btn-primary lp-btn-lg" onClick={() => navigate('/teste-gratis')}>
              <Play size={20} />
              Comece Grátis — 3 Meses VIP
            </button>
            <button className="lp-btn-outline lp-btn-lg" onClick={() => navigate('/teste-gratis')}>
              <Phone size={20} />
              Reivindicar 3 Meses Grátis
            </button>
          </div>
          <p className="lp-cta-small">Sem cartão de crédito • Setup em 5 minutos • Cancele quando quiser</p>
        </div>
      </section>

      {/* ═══════════════════════════════ FOOTER ═══════════════════════════════ */}
      <footer className="lp-footer">
        <div className="lp-footer-inner">
          <div className="lp-footer-brand">
            <div className="lp-nav-brand">
              <img
                src={theme === 'dark' ? '/logo-dark.png' : '/logo-light.png'}
                alt="Elevate Mídia Indoor"
                style={{ height: '52px', width: 'auto' }}
              />
            </div>
            <p>A plataforma completa de gestão e monetização de telas de mídia indoor no Brasil.</p>
          </div>

          <div className="lp-footer-links-group">
            <h4>Produto</h4>
            <button onClick={() => scrollToSection('features')}>Recursos</button>
            <button onClick={() => scrollToSection('pricing')}>Planos</button>
            <button onClick={() => scrollToSection('how-it-works')}>Como Funciona</button>
            <button onClick={() => scrollToSection('faq')}>FAQ</button>
          </div>

          <div className="lp-footer-links-group">
            <h4>Para Você</h4>
            <button onClick={() => scrollToSection('for-partners')}>Estabelecimentos & Parceiros</button>
            <button onClick={() => scrollToSection('for-advertisers')}>Anunciantes</button>
            <a href="/login">Acessar Painel</a>
          </div>

          <div className="lp-footer-links-group">
            <h4>Contato</h4>
            <a href="mailto:contato@elevatemidia.com.br"><Mail size={14} /> contato@elevatemidia.com.br</a>
            <a href="tel:+5511999999999"><Phone size={14} /> (11) 99999-9999</a>
            <span><MapPin size={14} /> Brasil</span>
          </div>
        </div>

        <div className="lp-footer-bottom">
          <span>© {new Date().getFullYear()} Elevate Mídia Indoor. Todos os direitos reservados.</span>
        </div>
      </footer>
    </div>
  );
}
