import { useState, useRef, useEffect, type ChangeEvent } from 'react';
import {
  Play,
  Pause,
  Film,
  CheckCircle,
  RefreshCw,
  Layers,
  X,
  Eye,
  Key,
  Wand2,
  UploadCloud,
  Trash2,
  Check,
  Info,
  Monitor,
  Smartphone,
  Clapperboard
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';

interface PartnerOption {
  id: string;
  name: string;
}

interface AdvertiserOption {
  id: string;
  company_name: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  partners: PartnerOption[];
  advertisers: AdvertiserOption[];
}

interface SlideContent {
  slide1: { tag: string; title: string; subtitle: string };
  slide2: { badge: string; headline: string; details: string };
  slide3: { tag: string; item1: string; item2: string; item3: string };
  slide4: { badge: string; title: string; desc: string };
  slide5: { cta: string; subtitle: string };
}

// Backgrounds fotográficos de alta resolução otimizados para academia e mídias indoor
const BACKGROUND_ASSETS = [
  'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=1080&q=80',
  'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=1080&q=80',
  'https://images.unsplash.com/photo-1540497077202-7c8a3999166f?w=1080&q=80',
  'https://images.unsplash.com/photo-1518611012118-696072aa579a?w=1080&q=80',
  'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=1080&q=80'
];

export default function AIVideoGeneratorModal({
  isOpen,
  onClose,
  onSuccess,
  partners,
  advertisers
}: Props) {
  const { user } = useAuthStore();

  const DEFAULT_GEMINI_KEY = import.meta.env.VITE_GEMINI_API_KEY || '';

  // Configurações do Prompt e Descrição
  const [topic, setTopic] = useState('Campanha Institucional VIP - Destaque na Rede Elevate');
  const [promptDescription, setPromptDescription] = useState(
    'Apresentação com 5 slides para tela de mídia indoor: posicionamento da marca, oferta especial da semana, diferenciais de atendimento, benefícios exclusivos para clientes e chamada para ação com QR Code.'
  );
  const [apiKey, setApiKey] = useState(
    () => localStorage.getItem('elevate_gemini_key') || localStorage.getItem('gymplay_gemini_key') || DEFAULT_GEMINI_KEY
  );
  const [isImprovingPrompt, setIsImprovingPrompt] = useState(false);
  const [promptImprovedSuccess, setPromptImprovedSuccess] = useState(false);
  const [generationStatus, setGenerationStatus] = useState<string | null>(null);

  // Formato do Vídeo
  const [videoFormat, setVideoFormat] = useState<'16:9' | '9:16'>('16:9');

  // Logo Anexada
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null);
  const [logoFileName, setLogoFileName] = useState<string>('');
  const [overlayLogoOnVideo, setOverlayLogoOnVideo] = useState(true);
  const logoInputRef = useRef<HTMLInputElement>(null);

  // Estados de Processamento da Imagem
  const [generatingAI, setGeneratingAI] = useState(false);
  const [originalImageUrl, setOriginalImageUrl] = useState<string>('/demo-ai-poster.jpg');
  const [croppedSlides, setCroppedSlides] = useState<string[]>([]);

  // Estados do Vídeo
  const [slideDuration, setSlideDuration] = useState<number>(3);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentSlidePreview, setCurrentSlidePreview] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingProgress, setRecordingProgress] = useState(0);

  // Vínculos
  const [targetType, setTargetType] = useState<'advertiser' | 'partner' | 'none'>('none');
  const [selectedAdvId, setSelectedAdvId] = useState('');
  const [selectedPartnerId, setSelectedPartnerId] = useState('');

  // Canvas Refs
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Quando o modal abre ou a imagem original muda, fatia os 5 slides sem modificar o original
  useEffect(() => {
    if (!isOpen || !originalImageUrl) return;
    sliceOriginalImage(originalImageUrl);
  }, [isOpen, originalImageUrl]);

  // Função pura de recorte não-destrutivo
  const sliceOriginalImage = (imgSrc: string) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const totalSlides = 5;
      const slideWidth = img.naturalWidth;
      const slideHeight = Math.floor(img.naturalHeight / totalSlides);
      const slides: string[] = [];

      for (let i = 0; i < totalSlides; i++) {
        const canvas = document.createElement('canvas');
        canvas.width = slideWidth;
        canvas.height = slideHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(
            img,
            0,
            i * slideHeight,
            slideWidth,
            slideHeight,
            0,
            0,
            slideWidth,
            slideHeight
          );
          slides.push(canvas.toDataURL('image/jpeg', 0.95));
        }
      }

      setCroppedSlides(slides);
      setCurrentSlidePreview(0);
      setIsPlaying(true);
    };
    img.src = imgSrc;
  };

  // Upload da Logo
  const handleLogoUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Por favor, selecione um arquivo de imagem válido (PNG, JPG, SVG, WEBP).');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setLogoDataUrl(event.target.result as string);
        setLogoFileName(file.name);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = () => {
    setLogoDataUrl(null);
    setLogoFileName('');
    if (logoInputRef.current) logoInputRef.current.value = '';
  };

  // Melhorar Prompt com Gemini 3.1 Flash Lite
  const handleImprovePrompt = async () => {
    if (!promptDescription.trim()) {
      alert('Por favor, digite uma descrição inicial para otimizar o roteiro.');
      return;
    }

    setIsImprovingPrompt(true);
    setPromptImprovedSuccess(false);

    const activeToken = apiKey || DEFAULT_GEMINI_KEY;

    try {
      const systemPrompt = `Você é um diretor de arte e redator publicitário especializado em campanhas de mídia indoor (DOOH).
Apresentação com 5 slides.
Título: "${topic}".
Ideia: "${promptDescription}".
${logoFileName ? `Marca: ${logoFileName}.` : ''}

Reescreva este conceito em um roteiro publicitário objetivo estruturado em 5 painéis para máxima conversão:
Slide 1: Posicionamento da marca com direção de arte editorial.
Slide 2: A oferta principal (preço, condição ou benefício central).
Slide 3: Destaques, produtos ou serviços principais.
Slide 4: Diferenciais exclusivos e experiência do cliente.
Slide 5: Chamada para ação direta (CTA) no atendimento ou QR Code.
Retorne apenas o roteiro aprimorado, sem emojis.`;

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${activeToken}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: systemPrompt }] }]
          })
        }
      );

      const data = await response.json();
      const textOutput = data?.candidates?.[0]?.content?.parts?.[0]?.text;

      if (textOutput) {
        setPromptDescription(textOutput.trim());
        setPromptImprovedSuccess(true);
        setTimeout(() => setPromptImprovedSuccess(false), 5000);
      } else {
        throw new Error('Sem resposta');
      }
    } catch (err) {
      console.warn('Fallback prompt:', err);
      const enhancedPrompt = `Campanha Institucional 5 Slides — "${topic}"
Slide 1 (Abertura): ${topic} com direção de arte editorial e alto contraste.
Slide 2 (Oferta): ${promptDescription}
Slide 3 (Modalidades): Equipamentos biomecânicos, estúdio de spinning e box funcional.
Slide 4 (Tecnologia): Aplicativo próprio com prescrição digital e acompanhamento de evolução.
Slide 5 (Conversão): Condições vigentes por tempo limitado. Consulte a recepção.`;

      setPromptDescription(enhancedPrompt);
      setPromptImprovedSuccess(true);
      setTimeout(() => setPromptImprovedSuccess(false), 5000);
    } finally {
      setIsImprovingPrompt(false);
    }
  };

  // Motor Gráfico que renderiza o Master Poster 1080x1920 com tipografia editorial limpa (sem emojis)
  const renderCinematicMasterPoster = async (
    content: SlideContent,
    logoUrl: string | null
  ): Promise<string> => {
    const canvas = document.createElement('canvas');
    canvas.width = 1080;
    canvas.height = 1920;
    const ctx = canvas.getContext('2d')!;

    const panelH = 1920 / 5; // 384px por painel

    const bgImages = await Promise.all(
      BACKGROUND_ASSETS.map((url) => {
        return new Promise<HTMLImageElement | null>((resolve) => {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => resolve(img);
          img.onerror = () => resolve(null);
          img.src = url;
        });
      })
    );

    let loadedLogo: HTMLImageElement | null = null;
    if (logoUrl) {
      loadedLogo = await new Promise<HTMLImageElement | null>((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        img.src = logoUrl;
      });
    }

    const drawPanelBackground = (panelIndex: number) => {
      const y = panelIndex * panelH;
      const bgImg = bgImages[panelIndex];

      if (bgImg) {
        ctx.drawImage(bgImg, 0, y, canvas.width, panelH);
        const overlay = ctx.createLinearGradient(0, y, 0, y + panelH);
        overlay.addColorStop(0, 'rgba(9, 9, 11, 0.90)');
        overlay.addColorStop(0.5, 'rgba(9, 9, 11, 0.80)');
        overlay.addColorStop(1, 'rgba(9, 9, 11, 0.94)');
        ctx.fillStyle = overlay;
        ctx.fillRect(0, y, canvas.width, panelH);
      } else {
        ctx.fillStyle = '#09090b';
        ctx.fillRect(0, y, canvas.width, panelH);
      }

      ctx.strokeStyle = 'rgba(168, 85, 247, 0.45)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, y + panelH);
      ctx.lineTo(canvas.width, y + panelH);
      ctx.stroke();
    };

    // PAINEL 1: BRANDING & TÍTULO
    {
      const y = 0;
      drawPanelBackground(0);

      if (loadedLogo && loadedLogo.naturalWidth) {
        const maxH = 64;
        const maxW = 250;
        const aspect = loadedLogo.naturalWidth / loadedLogo.naturalHeight;
        let w = maxH * aspect;
        let h = maxH;
        if (w > maxW) {
          w = maxW;
          h = w / aspect;
        }

        const padX = 18;
        const padY = 10;
        ctx.fillStyle = 'rgba(9, 9, 11, 0.85)';
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.roundRect(65, y + 40, w + padX * 2, h + padY * 2, 10);
        ctx.fill();
        ctx.stroke();

        ctx.drawImage(loadedLogo, 65 + padX, y + 40 + padY, w, h);
      } else {
        ctx.fillStyle = '#c084fc';
        ctx.fillRect(65, y + 58, 28, 3);
        ctx.font = '700 21px Inter, sans-serif';
        ctx.fillText(content.slide1.tag.toUpperCase(), 105, y + 67);
      }

      ctx.fillStyle = '#ffffff';
      ctx.font = '800 46px Inter, sans-serif';
      const title = content.slide1.title.toUpperCase();
      ctx.fillText(title.substring(0, 36), 65, y + 185);
      if (title.length > 36) {
        ctx.fillText(title.substring(36, 72), 65, y + 242);
      }

      ctx.fillStyle = 'rgba(255, 255, 255, 0.78)';
      ctx.font = '500 25px Inter, sans-serif';
      ctx.fillText(content.slide1.subtitle.substring(0, 75), 65, y + 312);
    }

    // PAINEL 2: OFERTA PRINCIPAL
    {
      const y = panelH;
      drawPanelBackground(1);

      ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
      ctx.strokeStyle = 'rgba(168, 85, 247, 0.65)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(65, y + 45, canvas.width - 130, panelH - 90, 14);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#c084fc';
      ctx.font = '700 21px Inter, sans-serif';
      ctx.fillText(`02 / ${content.slide2.badge.toUpperCase()}`, 105, y + 105);

      ctx.fillStyle = '#ffffff';
      ctx.font = '800 52px Inter, sans-serif';
      ctx.fillText(content.slide2.headline.toUpperCase(), 105, y + 180);

      ctx.fillStyle = 'rgba(255, 255, 255, 0.82)';
      ctx.font = '500 25px Inter, sans-serif';
      ctx.fillText(content.slide2.details.substring(0, 78), 105, y + 248);
    }

    // PAINEL 3: DESTAQUES
    {
      const y = panelH * 2;
      drawPanelBackground(2);

      ctx.fillStyle = '#c084fc';
      ctx.font = '700 21px Inter, sans-serif';
      ctx.fillText(`03 / ${content.slide3.tag.toUpperCase()}`, 65, y + 72);

      ctx.fillStyle = '#ffffff';
      ctx.font = '800 40px Inter, sans-serif';
      ctx.fillText('DESTAQUES & DIFERENCIAIS', 65, y + 128);

      const items = [content.slide3.item1, content.slide3.item2, content.slide3.item3];
      const boxW = (canvas.width - 130 - 36) / 3;

      items.forEach((item, idx) => {
        const bx = 65 + idx * (boxW + 18);
        const by = y + 170;

        ctx.fillStyle = 'rgba(17, 17, 19, 0.85)';
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.roundRect(bx, by, boxW, 145, 12);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#c084fc';
        ctx.font = '700 24px Inter, sans-serif';
        ctx.fillText(item.toUpperCase(), bx + 22, by + 64);

        ctx.fillStyle = 'rgba(255, 255, 255, 0.68)';
        ctx.font = '500 19px Inter, sans-serif';
        ctx.fillText('Destaque exclusivo', bx + 22, by + 104);
      });
    }

    // PAINEL 4: BENEFÍCIOS
    {
      const y = panelH * 3;
      drawPanelBackground(3);

      ctx.fillStyle = '#c084fc';
      ctx.font = '700 21px Inter, sans-serif';
      ctx.fillText(`04 / ${content.slide4.badge.toUpperCase()}`, 65, y + 72);

      ctx.fillStyle = '#ffffff';
      ctx.font = '800 42px Inter, sans-serif';
      ctx.fillText(content.slide4.title.toUpperCase(), 65, y + 132);

      ctx.fillStyle = 'rgba(255, 255, 255, 0.82)';
      ctx.font = '500 25px Inter, sans-serif';
      ctx.fillText(content.slide4.desc.substring(0, 78), 65, y + 196);

      const bullets = [
        '— Atendimento personalizado e qualidade superior',
        '— Condições diferenciadas para clientes da unidade'
      ];
      ctx.fillStyle = '#d4d4d8';
      ctx.font = '500 21px Inter, sans-serif';
      bullets.forEach((b, bIdx) => {
        ctx.fillText(b, 65, y + 258 + bIdx * 38);
      });
    }

    // PAINEL 5: CTA & QR CODE
    {
      const y = panelH * 4;
      drawPanelBackground(4);

      ctx.fillStyle = '#c084fc';
      ctx.font = '700 21px Inter, sans-serif';
      ctx.fillText('05 / CONDIÇÃO ESPECIAL', 65, y + 72);

      ctx.fillStyle = '#ffffff';
      ctx.font = '800 46px Inter, sans-serif';
      ctx.fillText(content.slide5.cta.toUpperCase(), 65, y + 138);

      ctx.fillStyle = '#8a08ff';
      ctx.beginPath();
      ctx.roundRect(65, y + 188, 460, 78, 10);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.font = '800 27px Inter, sans-serif';
      ctx.fillText('FALE COM O ATENDIMENTO', 88, y + 237);

      ctx.fillStyle = 'rgba(255, 255, 255, 0.78)';
      ctx.font = '500 21px Inter, sans-serif';
      ctx.fillText(content.slide5.subtitle.substring(0, 62), 65, y + 312);

      const qrX = canvas.width - 240;
      const qrY = y + 130;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.roundRect(qrX, qrY, 170, 170, 12);
      ctx.fill();

      ctx.fillStyle = '#09090b';
      ctx.fillRect(qrX + 20, qrY + 20, 44, 44);
      ctx.fillRect(qrX + 106, qrY + 20, 44, 44);
      ctx.fillRect(qrX + 20, qrY + 106, 44, 44);
      ctx.fillRect(qrX + 82, qrY + 82, 28, 28);
      ctx.fillRect(qrX + 122, qrY + 122, 24, 24);

      ctx.fillStyle = 'rgba(255,255,255,0.68)';
      ctx.font = '600 17px Inter, sans-serif';
      ctx.fillText('Aponte a câmera', qrX + 16, y + 332);
    }

    return canvas.toDataURL('image/jpeg', 0.95);
  };

  // Geração Completa da Apresentação com Inteligência Gemini + Motor Gráfico
  const handleGenerateAI = async () => {
    const activeToken = apiKey || DEFAULT_GEMINI_KEY;
    if (activeToken) {
      localStorage.setItem('gymplay_gemini_key', activeToken);
    }

    setGeneratingAI(true);
    setGenerationStatus('Etapa 1/3 — Estruturando roteiro dos 5 slides com Gemini...');

    try {
      let slideContent: SlideContent = {
        slide1: {
          tag: 'ELEVATE VIP',
          title: topic,
          subtitle: 'Qualidade, atendimento de excelência e condições especiais'
        },
        slide2: {
          badge: 'OFERTA EXCLUSIVA',
          headline: 'CONDIÇÃO ESPECIAL',
          details: promptDescription.substring(0, 80)
        },
        slide3: {
          tag: 'DESTAQUES',
          item1: 'QUALIDADE',
          item2: 'ATENDIMENTO',
          item3: 'EXCLUSIVIDADE'
        },
        slide4: {
          badge: 'EXPERIÊNCIA',
          title: 'VANTAGENS VIP',
          desc: 'Soluções completas pensadas para você'
        },
        slide5: {
          cta: 'APROVEITE HOJE',
          subtitle: 'Fale com nossa equipe ou aponte a câmera para o QR Code'
        }
      };

      try {
        const jsonPrompt = `Você é um diretor de arte e redator publicitário de mídias indoor (DOOH).
Crie os textos para 5 slides sobre este anúncio (sem usar emojis):
Título: "${topic}"
Detalhes: "${promptDescription}"

Retorne APENAS um JSON válido puro, sem marcação markdown ou código extra, neste formato exato:
{
  "slide1": { "tag": "ELEVATE", "title": "TITULO CURTO E FORTE", "subtitle": "Subtítulo engajador" },
  "slide2": { "badge": "OFERTA", "headline": "DESCONTO OU VALOR", "details": "Detalhe da oferta" },
  "slide3": { "tag": "DESTAQUES", "item1": "DESTAQUE 1", "item2": "DESTAQUE 2", "item3": "DESTAQUE 3" },
  "slide4": { "badge": "DIFERENCIAL", "title": "BENEFÍCIO EXCLUSIVO", "desc": "Detalhe do benefício" },
  "slide5": { "cta": "CHAMADA PARA AÇÃO", "subtitle": "Aponte para o QR Code na tela" }
}`;

        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${activeToken}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: jsonPrompt }] }]
            })
          }
        );

        if (response.ok) {
          const data = await response.json();
          const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
          const cleanJsonStr = rawText
            .replace(/```json/g, '')
            .replace(/```/g, '')
            .trim();
          const parsed = JSON.parse(cleanJsonStr);
          if (
            parsed.slide1 &&
            parsed.slide2 &&
            parsed.slide3 &&
            parsed.slide4 &&
            parsed.slide5
          ) {
            slideContent = parsed;
          }
        }
      } catch (err) {
        console.warn('Usando copy otimizada local:', err);
      }

      setGenerationStatus('Etapa 2/3 — Compondo lâmina matriz com fotografia e marca...');
      const masterPosterUrl = await renderCinematicMasterPoster(
        slideContent,
        logoDataUrl
      );

      setGenerationStatus('Etapa 3/3 — Extraindo os 5 slides por recorte não-destrutivo...');
      setOriginalImageUrl(masterPosterUrl);
      sliceOriginalImage(masterPosterUrl);

      setGenerationStatus('Apresentação de 5 slides processada e pronta para exportação.');
    } catch (err) {
      console.error('Erro na criação da apresentação:', err);
      alert('Ocorreu um erro ao gerar a apresentação. Carregando modelo demonstrativo.');
      setOriginalImageUrl('/demo-ai-poster.jpg');
      sliceOriginalImage('/demo-ai-poster.jpg');
    } finally {
      setGeneratingAI(false);
    }
  };

  // Motor de Preview em Loop no Canvas com Transição Fade
  useEffect(() => {
    if (!isPlaying || croppedSlides.length !== 5) {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      return;
    }

    const canvas = previewCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const loadedImgs: HTMLImageElement[] = [];
    let loadedCount = 0;

    croppedSlides.forEach((src, idx) => {
      const im = new Image();
      im.onload = () => {
        loadedCount++;
        if (loadedCount === 5) {
          startAnimation();
        }
      };
      im.src = src;
      loadedImgs[idx] = im;
    });

    let loadedLogo: HTMLImageElement | null = null;
    if (logoDataUrl && overlayLogoOnVideo) {
      loadedLogo = new Image();
      loadedLogo.src = logoDataUrl;
    }

    const startTime = performance.now();
    const durationPerSlideMs = slideDuration * 1000;
    const transitionMs = 600;

    const startAnimation = () => {
      const renderFrame = (now: number) => {
        const elapsed = (now - startTime) % (durationPerSlideMs * 5);
        const currentIdx = Math.floor(elapsed / durationPerSlideMs);
        const nextIdx = (currentIdx + 1) % 5;
        const slideElapsed = elapsed % durationPerSlideMs;
        const fadeStart = durationPerSlideMs - transitionMs;

        setCurrentSlidePreview(currentIdx);

        const currentImg = loadedImgs[currentIdx];
        if (currentImg && currentImg.complete) {
          ctx.globalAlpha = 1.0;
          ctx.drawImage(currentImg, 0, 0, canvas.width, canvas.height);
        }

        if (slideElapsed > fadeStart) {
          const fadeProgress = (slideElapsed - fadeStart) / transitionMs;
          const nextImg = loadedImgs[nextIdx];
          if (nextImg && nextImg.complete) {
            ctx.globalAlpha = fadeProgress;
            ctx.drawImage(nextImg, 0, 0, canvas.width, canvas.height);
          }
        }

        if (loadedLogo && loadedLogo.complete && overlayLogoOnVideo) {
          ctx.globalAlpha = 0.95;
          const maxLogoH = 32;
          const logoAspect = loadedLogo.naturalWidth / loadedLogo.naturalHeight;
          const logoW = maxLogoH * logoAspect;
          const pad = 14;
          ctx.drawImage(loadedLogo, canvas.width - logoW - pad, pad, logoW, maxLogoH);
        }

        ctx.globalAlpha = 1.0;
        animationFrameRef.current = requestAnimationFrame(renderFrame);
      };

      animationFrameRef.current = requestAnimationFrame(renderFrame);
    };

    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [isPlaying, croppedSlides, slideDuration, logoDataUrl, overlayLogoOnVideo]);

  // Compilação do Vídeo e Gravação no Navegador via MediaRecorder
  const handleExportAndSave = async () => {
    if (croppedSlides.length !== 5) {
      alert('Aguarde os 5 slides serem processados.');
      return;
    }

    setIsRecording(true);
    setRecordingProgress(10);

    try {
      const exportCanvas = document.createElement('canvas');
      if (videoFormat === '16:9') {
        exportCanvas.width = 1280;
        exportCanvas.height = 720;
      } else {
        exportCanvas.width = 720;
        exportCanvas.height = 1280;
      }
      const ctx = exportCanvas.getContext('2d')!;

      const loadedImgs: HTMLImageElement[] = await Promise.all(
        croppedSlides.map((src) => {
          return new Promise<HTMLImageElement>((resolve) => {
            const im = new Image();
            im.crossOrigin = 'anonymous';
            im.onload = () => resolve(im);
            im.src = src;
          });
        })
      );

      let loadedLogo: HTMLImageElement | null = null;
      if (logoDataUrl && overlayLogoOnVideo) {
        loadedLogo = await new Promise<HTMLImageElement>((resolve) => {
          const im = new Image();
          im.crossOrigin = 'anonymous';
          im.onload = () => resolve(im);
          im.src = logoDataUrl;
        });
      }

      const stream = exportCanvas.captureStream(30);
      const mimeType = MediaRecorder.isTypeSupported('video/mp4;codecs=avc1')
        ? 'video/mp4;codecs=avc1'
        : MediaRecorder.isTypeSupported('video/mp4')
          ? 'video/mp4'
          : 'video/webm;codecs=vp9';

      const recorder = new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond: 4_500_000
      });

      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      const recordPromise = new Promise<Blob>((resolve, reject) => {
        recorder.onstop = () => {
          const videoBlob = new Blob(chunks, { type: mimeType.split(';')[0] });
          resolve(videoBlob);
        };
        recorder.onerror = reject;
      });

      recorder.start();

      const totalDurationSec = slideDuration * 5;
      const transitionSec = 0.5;
      const fps = 30;
      const totalFrames = totalDurationSec * fps;

      for (let frame = 0; frame < totalFrames; frame++) {
        const currentTime = frame / fps;
        const currentIdx = Math.min(Math.floor(currentTime / slideDuration), 4);
        const nextIdx = (currentIdx + 1) % 5;
        const slideTime = currentTime % slideDuration;
        const fadeStart = slideDuration - transitionSec;

        ctx.fillStyle = '#050505';
        ctx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);

        ctx.globalAlpha = 1.0;
        ctx.drawImage(
          loadedImgs[currentIdx],
          0,
          0,
          exportCanvas.width,
          exportCanvas.height
        );

        if (slideTime > fadeStart) {
          const fadeProg = (slideTime - fadeStart) / transitionSec;
          ctx.globalAlpha = fadeProg;
          ctx.drawImage(
            loadedImgs[nextIdx],
            0,
            0,
            exportCanvas.width,
            exportCanvas.height
          );
        }

        if (loadedLogo && overlayLogoOnVideo) {
          ctx.globalAlpha = 0.95;
          const maxLogoH = 40;
          const logoAspect = loadedLogo.naturalWidth / loadedLogo.naturalHeight;
          const logoW = maxLogoH * logoAspect;
          const pad = 20;
          ctx.drawImage(
            loadedLogo,
            exportCanvas.width - logoW - pad,
            pad,
            logoW,
            maxLogoH
          );
        }

        ctx.globalAlpha = 1.0;

        if (frame % 15 === 0) {
          setRecordingProgress(Math.floor(10 + (frame / totalFrames) * 70));
        }

        await new Promise((r) => setTimeout(r, 1000 / fps));
      }

      recorder.stop();
      const finalVideoBlob = await recordPromise;
      setRecordingProgress(85);

      const extension = finalVideoBlob.type.includes('mp4') ? 'mp4' : 'webm';
      const cleanFileName = `video_studio_${topic
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '_')
        .substring(0, 20)}_${Date.now()}.${extension}`;
      const filePath = `${user?.id || 'admin'}/${cleanFileName}`;

      const { error: uploadError } = await supabase.storage
        .from('media')
        .upload(filePath, finalVideoBlob, {
          contentType: finalVideoBlob.type,
          upsert: true
        });

      if (uploadError) throw uploadError;

      setRecordingProgress(95);

      const { data: userData } = await supabase
        .from('users')
        .select('org_id')
        .eq('id', user?.id)
        .single();

      const { error: dbError } = await supabase.from('media_files').insert({
        org_id: userData?.org_id,
        name: `Apresentação 5 Slides: ${topic}`,
        file_path: filePath,
        file_type: finalVideoBlob.type,
        file_size: finalVideoBlob.size,
        status: 'approved',
        partner_id:
          targetType === 'partner' && selectedPartnerId ? selectedPartnerId : null,
        advertiser_id:
          targetType === 'advertiser' && selectedAdvId ? selectedAdvId : null
      });

      if (dbError) throw dbError;

      setRecordingProgress(100);
      alert('Vídeo de 5 slides exportado e salvo na Biblioteca de Mídias.');
      onSuccess();
      onClose();
    } catch (err) {
      console.error('Erro na exportação do vídeo:', err);
      alert('Ocorreu um erro ao gerar e salvar o vídeo. Verifique o console.');
    } finally {
      setIsRecording(false);
      setRecordingProgress(0);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal modal-xl"
        onClick={(e) => e.stopPropagation()}
        style={{ maxHeight: '94vh' }}
      >
        {/* HEADER */}
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div className="entity-avatar" style={{ color: 'var(--accent)' }}>
              <Clapperboard size={16} strokeWidth={1.75} />
            </div>
            <div>
              <h2 className="modal-title">Estúdio de Vídeo — Compositor de 5 Slides</h2>
              <p className="modal-subtitle">
                Geração de lâmina matriz com recorte não-destrutivo em 5 quadros e compilação de vídeo.
              </p>
            </div>
          </div>

          <button type="button" className="icon-btn" onClick={onClose} aria-label="Fechar">
            <X size={16} />
          </button>
        </div>

        {/* BODY */}
        <div className="modal-body" style={{ gap: 18 }}>
          {generationStatus && (
            <div
              className="notice-bar"
              style={{
                marginBottom: 0,
                background: 'var(--bg-surface-sub)',
                borderColor: 'var(--border-default)'
              }}
            >
              <Info size={14} style={{ color: 'var(--accent)', flexShrink: 0 }} />
              <span style={{ color: 'var(--text-primary)' }}>{generationStatus}</span>
            </div>
          )}

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))',
              gap: 20
            }}
          >
            {/* COLUNA ESQUERDA: PARÂMETROS, ROTEIRO E LOGO */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Upload da Logo */}
              <div className="form-section">
                <div className="form-section-header">
                  <span className="form-section-title">Identidade Visual (Logo)</span>
                  {logoDataUrl && (
                    <span className="badge badge-success">
                      <Check size={11} /> Anexada
                    </span>
                  )}
                </div>

                <input
                  type="file"
                  ref={logoInputRef}
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  style={{ display: 'none' }}
                  onChange={handleLogoUpload}
                />

                {!logoDataUrl ? (
                  <div
                    onClick={() => logoInputRef.current?.click()}
                    style={{
                      border: '1px dashed var(--border-strong)',
                      borderRadius: 'var(--r-md)',
                      padding: '16px',
                      textAlign: 'center',
                      cursor: 'pointer',
                      background: 'var(--bg-base)'
                    }}
                  >
                    <UploadCloud
                      size={18}
                      style={{ color: 'var(--text-secondary)', margin: '0 auto 6px' }}
                    />
                    <p style={{ fontSize: 12.5, color: 'var(--text-primary)', fontWeight: 500 }}>
                      Selecionar arquivo de marca
                    </p>
                    <p style={{ fontSize: 11.5, color: 'var(--text-tertiary)', marginTop: 2 }}>
                      PNG transparente, SVG ou JPG
                    </p>
                  </div>
                ) : (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      background: 'var(--bg-base)',
                      border: '1px solid var(--border-default)',
                      borderRadius: 'var(--r-md)',
                      padding: '10px 12px',
                      gap: 12
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                      <img
                        src={logoDataUrl}
                        alt="Logo Preview"
                        style={{
                          height: 34,
                          maxWidth: 76,
                          objectFit: 'contain',
                          background: 'var(--bg-elevated)',
                          padding: 4,
                          borderRadius: 'var(--r-xs)'
                        }}
                      />
                      <div style={{ minWidth: 0 }}>
                        <span
                          className="cell-primary"
                          style={{
                            fontSize: 12.5,
                            display: 'block',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}
                        >
                          {logoFileName || 'Marca carregada'}
                        </span>
                        <label
                          style={{
                            fontSize: 11.5,
                            color: 'var(--text-secondary)',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            marginTop: 2
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={overlayLogoOnVideo}
                            onChange={(e) => setOverlayLogoOnVideo(e.target.checked)}
                            style={{ accentColor: 'var(--accent)' }}
                          />
                          Assinar marca sobre o vídeo final
                        </label>
                      </div>
                    </div>

                    <button
                      type="button"
                      className="btn btn-danger btn-sm"
                      onClick={handleRemoveLogo}
                    >
                      <Trash2 size={12} />
                      <span>Remover</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Roteiro & Formato */}
              <div className="form-section">
                <div className="input-group">
                  <label className="input-label">Título da Campanha</label>
                  <input
                    type="text"
                    className="input-field"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder="Ex: Plano Black VIP"
                  />
                </div>

                <div className="input-group">
                  <div className="flex items-center justify-between">
                    <label className="input-label">Briefing / Roteiro dos Slides</label>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={handleImprovePrompt}
                      disabled={isImprovingPrompt}
                    >
                      {isImprovingPrompt ? (
                        <RefreshCw size={12} className="spin" />
                      ) : promptImprovedSuccess ? (
                        <CheckCircle size={12} style={{ color: 'var(--success)' }} />
                      ) : (
                        <Wand2 size={12} />
                      )}
                      <span>
                        {isImprovingPrompt
                          ? 'Reescrevendo...'
                          : promptImprovedSuccess
                            ? 'Roteiro otimizado'
                            : 'Aprimorar roteiro'}
                      </span>
                    </button>
                  </div>

                  <textarea
                    className="input-field"
                    value={promptDescription}
                    onChange={(e) => setPromptDescription(e.target.value)}
                    rows={4}
                    placeholder="Descreva oferta, diferenciais e chamada para ação..."
                  />
                </div>

                <div className="form-grid-2">
                  <div className="input-group">
                    <label className="input-label">Proporção de Tela</label>
                    <div className="segmented-control" style={{ width: '100%' }}>
                      <button
                        type="button"
                        className={`seg-btn ${videoFormat === '16:9' ? 'active' : ''}`}
                        style={{ flex: 1, justifyContent: 'center' }}
                        onClick={() => setVideoFormat('16:9')}
                      >
                        <Monitor size={13} /> 16:9 TV
                      </button>
                      <button
                        type="button"
                        className={`seg-btn ${videoFormat === '9:16' ? 'active' : ''}`}
                        style={{ flex: 1, justifyContent: 'center' }}
                        onClick={() => setVideoFormat('9:16')}
                      >
                        <Smartphone size={13} /> 9:16 Totem
                      </button>
                    </div>
                  </div>

                  <div className="input-group">
                    <label className="input-label" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <Key size={12} /> Chave API Gemini
                    </label>
                    <input
                      type="password"
                      className="input-field font-mono"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder="AQ.Ab8RN..."
                    />
                  </div>
                </div>

                <button
                  type="button"
                  className="btn btn-secondary btn-lg"
                  style={{ width: '100%', borderColor: 'var(--border-strong)' }}
                  onClick={handleGenerateAI}
                  disabled={generatingAI}
                >
                  {generatingAI ? (
                    <RefreshCw size={15} className="spin" />
                  ) : (
                    <Layers size={15} style={{ color: 'var(--accent)' }} />
                  )}
                  <span>
                    {generatingAI
                      ? 'Compondo apresentação...'
                      : 'Gerar Matriz & Fatiar 5 Slides'}
                  </span>
                </button>
              </div>

              {/* Miniaturas dos 5 Slides */}
              <div className="form-section">
                <div className="form-section-header">
                  <span className="form-section-title">
                    <Layers size={14} style={{ color: 'var(--text-tertiary)' }} />
                    Quadros Extraídos (5/5)
                  </span>
                  <a
                    href={originalImageUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs"
                    style={{
                      color: 'var(--text-secondary)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4
                    }}
                  >
                    <Eye size={12} /> Ver lâmina matriz intacta
                  </a>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
                  {croppedSlides.map((slideSrc, idx) => {
                    const isActive = currentSlidePreview === idx;
                    return (
                      <div
                        key={idx}
                        onClick={() => {
                          setCurrentSlidePreview(idx);
                          setIsPlaying(false);
                        }}
                        style={{
                          border: isActive
                            ? '1.5px solid var(--accent)'
                            : '1px solid var(--border-default)',
                          borderRadius: 'var(--r-sm)',
                          overflow: 'hidden',
                          cursor: 'pointer',
                          position: 'relative',
                          background: '#050506'
                        }}
                      >
                        <img
                          src={slideSrc}
                          alt={`Slide ${idx + 1}`}
                          style={{
                            width: '100%',
                            height: 52,
                            objectFit: 'cover',
                            display: 'block'
                          }}
                        />
                        <span
                          className="font-mono"
                          style={{
                            position: 'absolute',
                            top: 3,
                            left: 3,
                            background: 'rgba(9, 9, 11, 0.85)',
                            color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
                            fontSize: 10,
                            padding: '1px 4px',
                            borderRadius: 3
                          }}
                        >
                          0{idx + 1}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* COLUNA DIREITA: MONITOR DE PREVIEW E EXPORTAÇÃO */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div
                className="form-section"
                style={{ background: '#070709', borderColor: 'var(--border-default)' }}
              >
                <div className="form-section-header">
                  <span className="form-section-title">Monitor de Pré-visualização</span>
                  <span className="badge badge-neutral font-mono">
                    Quadro 0{currentSlidePreview + 1} / 05
                  </span>
                </div>

                <div
                  style={{
                    width: '100%',
                    height: 250,
                    borderRadius: 'var(--r-md)',
                    overflow: 'hidden',
                    background: '#000',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '1px solid var(--border-subtle)'
                  }}
                >
                  <canvas
                    ref={previewCanvasRef}
                    width={videoFormat === '16:9' ? 720 : 405}
                    height={videoFormat === '16:9' ? 405 : 720}
                    style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                  />
                </div>

                <div className="flex items-center justify-between" style={{ flexWrap: 'wrap', gap: 8 }}>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => setIsPlaying(!isPlaying)}
                  >
                    {isPlaying ? <Pause size={13} /> : <Play size={13} />}
                    <span>{isPlaying ? 'Pausar' : 'Reproduzir'}</span>
                  </button>

                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted">Tempo por slide:</span>
                    <div className="segmented-control">
                      {[2, 3, 5, 8].map((sec) => (
                        <button
                          key={sec}
                          type="button"
                          className={`seg-btn font-mono ${slideDuration === sec ? 'active' : ''}`}
                          style={{ height: 24, padding: '0 8px', fontSize: 11.5 }}
                          onClick={() => setSlideDuration(sec)}
                        >
                          {sec}s
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Atribuição */}
              <div className="form-section">
                <div className="form-section-header">
                  <span className="form-section-title">Destino de Veiculação</span>
                </div>

                <div className="segmented-control" style={{ width: '100%' }}>
                  <button
                    type="button"
                    className={`seg-btn ${targetType === 'none' ? 'active' : ''}`}
                    style={{ flex: 1, justifyContent: 'center' }}
                    onClick={() => setTargetType('none')}
                  >
                    Rede Global
                  </button>
                  <button
                    type="button"
                    className={`seg-btn ${targetType === 'advertiser' ? 'active' : ''}`}
                    style={{ flex: 1, justifyContent: 'center' }}
                    onClick={() => setTargetType('advertiser')}
                  >
                    Anunciante
                  </button>
                  <button
                    type="button"
                    className={`seg-btn ${targetType === 'partner' ? 'active' : ''}`}
                    style={{ flex: 1, justifyContent: 'center' }}
                    onClick={() => setTargetType('partner')}
                  >
                    Parceiro
                  </button>
                </div>

                {targetType === 'advertiser' && (
                  <select
                    className="select-field"
                    value={selectedAdvId}
                    onChange={(e) => setSelectedAdvId(e.target.value)}
                  >
                    <option value="">Selecione o anunciante...</option>
                    {advertisers.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.company_name}
                      </option>
                    ))}
                  </select>
                )}

                {targetType === 'partner' && (
                  <select
                    className="select-field"
                    value={selectedPartnerId}
                    onChange={(e) => setSelectedPartnerId(e.target.value)}
                  >
                    <option value="">Selecione o parceiro...</option>
                    {partners.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Progresso e Exportação */}
              <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {isRecording && (
                  <div
                    className="form-section"
                    style={{ padding: '10px 14px', gap: 6 }}
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span style={{ color: 'var(--text-secondary)' }}>
                        Renderizando e codificando vídeo...
                      </span>
                      <span className="font-mono" style={{ color: 'var(--accent)' }}>
                        {recordingProgress}%
                      </span>
                    </div>
                    <div className="progress-bar">
                      <div
                        className="progress-fill accent"
                        style={{ width: `${recordingProgress}%` }}
                      />
                    </div>
                  </div>
                )}

                <button
                  type="button"
                  className="btn btn-primary btn-lg"
                  style={{ width: '100%' }}
                  onClick={handleExportAndSave}
                  disabled={isRecording}
                >
                  {isRecording ? (
                    <RefreshCw size={15} className="spin" />
                  ) : (
                    <Film size={15} strokeWidth={2} />
                  )}
                  <span>
                    {isRecording
                      ? 'Codificando e enviando...'
                      : `Exportar Vídeo (${slideDuration * 5}s · ${videoFormat}) e Salvar`}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
