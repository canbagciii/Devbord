import React, { useState, useEffect } from 'react';
import {
  X,
  Clock,
  Users,
  TrendingUp,
  CalendarDays,
  ChevronRight,
  ChevronLeft,
  CheckCircle,
  BarChart2,
  Download,
  RefreshCw,
  Sparkles,
  ArrowRight
} from 'lucide-react';

interface OnboardingStep {
  id: number;
  icon: React.ReactNode;
  tag: string;
  title: string;
  description: string;
  visual: React.ReactNode;
  color: {
    tag: string;
    icon: string;
    iconBg: string;
    accent: string;
    border: string;
    progressActive: string;
  };
}

interface DailyWorklogOnboardingProps {
  /** Modalın açık/kapalı durumu */
  isOpen: boolean;
  /** Modalı kapatma callback'i */
  onClose: () => void;
}

/* ─── Mini görseller ─────────────────────────────────────── */

const AnalyticsCardVisual = () => (
  <div className="flex gap-2.5 justify-center">
    {[
      { label: 'Yazılımcı', value: '12', color: 'text-violet-600', bg: 'bg-violet-50', bar: 'bg-violet-400' },
      { label: 'Toplam Süre', value: '380h', color: 'text-emerald-600', bg: 'bg-emerald-50', bar: 'bg-emerald-400' },
      { label: 'Ort. Günlük', value: '7.2h', color: 'text-blue-600', bg: 'bg-blue-50', bar: 'bg-blue-400' },
    ].map((c) => (
      <div key={c.label} className={`${c.bg} rounded-xl px-3 py-2.5 flex flex-col items-center gap-1 min-w-[80px] border border-white shadow-sm`}>
        <span className={`text-xl font-bold ${c.color}`}>{c.value}</span>
        <span className="text-[10px] text-slate-500 text-center leading-tight">{c.label}</span>
        <div className="w-full h-1 bg-white rounded-full mt-0.5">
          <div className={`${c.bar} h-1 rounded-full`} style={{ width: '70%' }} />
        </div>
      </div>
    ))}
  </div>
);

const StatusBadgeVisual = () => (
  <div className="flex flex-col gap-2 items-center">
    <div className="flex items-center gap-3 bg-white rounded-xl px-4 py-2.5 border border-slate-200 shadow-sm w-full max-w-xs">
      <div className="w-7 h-7 bg-gradient-to-br from-violet-500 to-purple-600 rounded-full flex items-center justify-center flex-shrink-0">
        <span className="text-[10px] font-bold text-white">AY</span>
      </div>
      <div className="flex-1">
        <p className="text-xs font-semibold text-slate-700">Ayşe Yılmaz</p>
        <div className="flex items-center gap-1 mt-0.5">
          <div className="h-1.5 w-20 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-emerald-500 rounded-full" style={{ width: '92%' }} />
          </div>
          <span className="text-[10px] text-slate-400">32/35h</span>
        </div>
      </div>
      <span className="text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full px-2 py-0.5">Yeterli</span>
    </div>
    <div className="flex items-center gap-3 bg-white rounded-xl px-4 py-2.5 border border-slate-200 shadow-sm w-full max-w-xs">
      <div className="w-7 h-7 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-full flex items-center justify-center flex-shrink-0">
        <span className="text-[10px] font-bold text-white">MK</span>
      </div>
      <div className="flex-1">
        <p className="text-xs font-semibold text-slate-700">Mehmet Kaya</p>
        <div className="flex items-center gap-1 mt-0.5">
          <div className="h-1.5 w-20 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-red-500 rounded-full" style={{ width: '45%' }} />
          </div>
          <span className="text-[10px] text-slate-400">16/35h</span>
        </div>
      </div>
      <span className="text-[10px] font-semibold bg-red-50 text-red-700 border border-red-200 rounded-full px-2 py-0.5">Eksik</span>
    </div>
    <div className="flex items-center gap-3 bg-white rounded-xl px-4 py-2.5 border border-slate-200 shadow-sm w-full max-w-xs opacity-60">
      <div className="w-7 h-7 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-full flex items-center justify-center flex-shrink-0">
        <span className="text-[10px] font-bold text-white">ZD</span>
      </div>
      <div className="flex-1">
        <p className="text-xs font-semibold text-slate-700">Zeynep Demir</p>
        <div className="flex items-center gap-1 mt-0.5">
          <div className="h-1.5 w-20 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-blue-500 rounded-full" style={{ width: '100%' }} />
          </div>
          <span className="text-[10px] text-slate-400">40/35h</span>
        </div>
      </div>
      <span className="text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200 rounded-full px-2 py-0.5">Fazla</span>
    </div>
  </div>
);

const LeaveVisual = () => (
  <div className="flex flex-col gap-2 items-center max-w-xs mx-auto">
    <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 w-full flex items-start gap-3">
      <CalendarDays className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
      <div>
        <p className="text-xs font-semibold text-blue-800">İzin Entegrasyonu Aktif</p>
        <p className="text-[11px] text-blue-600 mt-0.5">3 yazılımcının bu hafta izni var</p>
      </div>
    </div>
    <div className="bg-white border border-slate-200 rounded-xl p-3 w-full">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold text-slate-700">Can Öztürk</p>
          <div className="flex items-center gap-1 mt-0.5">
            <CalendarDays className="h-3 w-3 text-amber-500" />
            <span className="text-[11px] text-amber-600">2 gün izin</span>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs font-semibold text-slate-600">21h</p>
          <p className="text-[11px] text-amber-500">hedef: <span className="line-through text-slate-400">35h</span> 21h</p>
        </div>
      </div>
    </div>
    <div className="flex items-center gap-1.5 text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-1.5 w-full justify-center">
      <CheckCircle className="h-3.5 w-3.5" />
      Kapasiteler otomatik ayarlandı
    </div>
  </div>
);

const ViewModeVisual = () => (
  <div className="flex flex-col gap-3 items-center max-w-xs mx-auto">
    <div className="flex items-center bg-slate-100 rounded-xl p-1 gap-0.5 self-start">
      <div className="px-4 py-1.5 rounded-lg text-sm font-medium bg-white text-slate-900 shadow-sm">Haftalık</div>
      <div className="px-4 py-1.5 rounded-lg text-sm font-medium text-slate-500">Aylık</div>
    </div>
    <div className="bg-white border border-slate-200 rounded-xl p-3 w-full">
      <p className="text-[11px] font-semibold text-slate-500 mb-2 uppercase tracking-wide">Haftalık Görünüm</p>
      <div className="flex gap-1.5">
        {['Pzt', 'Sal', 'Çar', 'Per', 'Cum'].map((d, i) => (
          <div key={d} className="flex-1 text-center">
            <p className="text-[10px] text-slate-400 mb-1">{d}</p>
            <div className={`rounded-md text-[11px] font-semibold py-1 ${
              i === 2 ? 'bg-red-50 text-red-500' : 'bg-emerald-50 text-emerald-600'
            }`}>{[7, 8, 3, 7, 6][i]}h</div>
          </div>
        ))}
      </div>
    </div>
    <div className="flex items-center gap-2 self-center">
      <div className="w-6 h-6 rounded-lg bg-slate-100 flex items-center justify-center">
        <ChevronLeft className="h-3.5 w-3.5 text-slate-500" />
      </div>
      <span className="text-xs font-medium text-slate-600">3–7 Mart 2025</span>
      <div className="w-6 h-6 rounded-lg bg-slate-100 flex items-center justify-center">
        <ChevronRight className="h-3.5 w-3.5 text-slate-500" />
      </div>
    </div>
  </div>
);

const ExportVisual = () => (
  <div className="flex flex-col gap-3 items-center max-w-xs mx-auto">
    <div className="flex items-center gap-2">
      <button className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg shadow-sm">
        <Download className="h-4 w-4" />
        CSV İndir
      </button>
      <button className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 text-white text-sm font-medium rounded-lg shadow-sm">
        <RefreshCw className="h-4 w-4" />
        Yenile
      </button>
    </div>
    <div className="bg-white border border-slate-200 rounded-xl p-3 w-full text-[11px] font-mono text-slate-500">
      <p className="text-slate-400 mb-1"># Örnek CSV çıktısı</p>
      <p>Yazılımcı, Toplam, Hedef, Durum</p>
      <p className="text-emerald-600">Ayşe Y., 32h, 35h, Yeterli</p>
      <p className="text-red-500">Mehmet K., 16h, 35h, Eksik</p>
      <p className="text-blue-500">Zeynep D., 40h, 35h, Fazla</p>
    </div>
  </div>
);

/* ─── Adım tanımları ─────────────────────────────────────── */

const STEPS: OnboardingStep[] = [
  {
    id: 1,
    icon: <BarChart2 className="h-5 w-5" />,
    tag: 'Genel Bakış',
    title: 'Üst Metrik Kartları',
    description:
      'Sayfanın en üstünde 4 özet kart bulunur: toplam yazılımcı sayısı, haftalık toplam saat, günlük ortalama saat ve toplam worklog girişi. Bu kartlar seçili zaman aralığına (haftalık/aylık) göre otomatik güncellenir.',
    visual: <AnalyticsCardVisual />,
    color: {
      tag: 'bg-violet-100 text-violet-700',
      icon: 'text-violet-600',
      iconBg: 'bg-violet-50',
      accent: 'text-violet-600',
      border: 'border-violet-100',
      progressActive: 'bg-violet-500',
    },
  },
  {
    id: 2,
    icon: <Users className="h-5 w-5" />,
    tag: 'Durum Takibi',
    title: 'Yazılımcı Satırları & Durum Renkleri',
    description:
      'Her yazılımcı için günlük saat, haftalık toplam ve hedefe göre durum gösterilir. Yeşil (Yeterli) hedefin %90–110 arasında, kırmızı (Eksik) altında, mavi (Fazla) üzerinde demektir. Satıra tıklayarak günlük detaylara ulaşabilirsiniz.',
    visual: <StatusBadgeVisual />,
    color: {
      tag: 'bg-emerald-100 text-emerald-700',
      icon: 'text-emerald-600',
      iconBg: 'bg-emerald-50',
      accent: 'text-emerald-600',
      border: 'border-emerald-100',
      progressActive: 'bg-emerald-500',
    },
  },
  {
    id: 3,
    icon: <CalendarDays className="h-5 w-5" />,
    tag: 'İzin Entegrasyonu',
    title: 'Otomatik Kapasite Ayarı',
    description:
      'KolayIK entegrasyonu aktifken, izinli yazılımcıların haftalık hedefi izin günü başına 7 saat azaltılır. Örneğin 2 günlük izin: 35h → 21h. Bu sayede izinli geliştirici haksız yere "Eksik" görünmez.',
    visual: <LeaveVisual />,
    color: {
      tag: 'bg-amber-100 text-amber-700',
      icon: 'text-amber-600',
      iconBg: 'bg-amber-50',
      accent: 'text-amber-600',
      border: 'border-amber-100',
      progressActive: 'bg-amber-500',
    },
  },
  {
    id: 4,
    icon: <Clock className="h-5 w-5" />,
    tag: 'Zaman Aralığı',
    title: 'Haftalık & Aylık Görünüm',
    description:
      'Sol üstteki toggle ile haftalık veya aylık mod arasında geçiş yapabilirsiniz. Ok butonları ile önceki/sonraki döneme gidin, "Bu Hafta" butonu sizi anında bugüne döndürür. Aylık modda proje bazlı özet açılır.',
    visual: <ViewModeVisual />,
    color: {
      tag: 'bg-blue-100 text-blue-700',
      icon: 'text-blue-600',
      iconBg: 'bg-blue-50',
      accent: 'text-blue-600',
      border: 'border-blue-100',
      progressActive: 'bg-blue-500',
    },
  },
  {
    id: 5,
    icon: <Download className="h-5 w-5" />,
    tag: 'Dışa Aktarım',
    title: 'CSV İndir & Yenile',
    description:
      'Sağ üstteki "CSV İndir" butonu mevcut filtreye göre (tüm yazılımcılar veya tek seçili) tabloyu indirir; izin ayarlamaları ve hedef bilgileri de CSV\'ye dahildir. "Yenile" butonu Jira ve KolayIK önbelleğini temizleyerek taze veri çeker.',
    visual: <ExportVisual />,
    color: {
      tag: 'bg-slate-100 text-slate-700',
      icon: 'text-slate-600',
      iconBg: 'bg-slate-100',
      accent: 'text-slate-700',
      border: 'border-slate-200',
      progressActive: 'bg-slate-500',
    },
  },
];

/* ─── Ana bileşen ─────────────────────────────────────────── */

const STORAGE_KEY = 'onboarding_daily_worklog_seen';

const DailyWorklogOnboarding: React.FC<DailyWorklogOnboardingProps> = ({ isOpen, onClose }) => {
  const [step, setStep] = useState(0);
  const [animating, setAnimating] = useState(false);
  const [direction, setDirection] = useState<'forward' | 'back'>('forward');

  const currentStep = STEPS[step];
  const isLast = step === STEPS.length - 1;

  const goTo = (nextStep: number, dir: 'forward' | 'back') => {
    if (animating) return;
    setDirection(dir);
    setAnimating(true);
    setTimeout(() => {
      setStep(nextStep);
      setAnimating(false);
    }, 220);
  };

  const handleClose = () => {
    try { localStorage.setItem(STORAGE_KEY, 'true'); } catch { /* ignore */ }
    setStep(0);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
    >
      <div
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden"
        style={{ boxShadow: '0 25px 60px -12px rgba(0,0,0,0.25)' }}
      >
        {/* Header stripe */}
        <div className="bg-slate-900 px-6 pt-5 pb-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-white/10 rounded-lg flex items-center justify-center">
                <Sparkles className="h-4 w-4 text-white" />
              </div>
              <span className="text-sm font-semibold text-white">Günlük Süre Takibi — Hızlı Başlangıç</span>
            </div>
            <button
              onClick={handleClose}
              className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Step progress dots */}
          <div className="flex items-center gap-1.5">
            {STEPS.map((s, i) => (
              <button
                key={s.id}
                onClick={() => goTo(i, i > step ? 'forward' : 'back')}
                className={`rounded-full transition-all duration-300 ${
                  i === step
                    ? 'w-6 h-2 bg-white'
                    : i < step
                    ? 'w-2 h-2 bg-white/50'
                    : 'w-2 h-2 bg-white/20'
                }`}
              />
            ))}
            <span className="ml-auto text-xs text-slate-400 font-medium tabular-nums">
              {step + 1} / {STEPS.length}
            </span>
          </div>
        </div>

        {/* Content area */}
        <div
          className="px-6 pt-5 pb-4"
          style={{
            opacity: animating ? 0 : 1,
            transform: animating
              ? `translateX(${direction === 'forward' ? '-16px' : '16px'})`
              : 'translateX(0)',
            transition: 'opacity 0.22s ease, transform 0.22s ease',
          }}
        >
          {/* Tag + Icon */}
          <div className="flex items-center gap-2 mb-3">
            <div className={`w-8 h-8 ${currentStep.color.iconBg} rounded-lg flex items-center justify-center flex-shrink-0`}>
              <span className={currentStep.color.icon}>{currentStep.icon}</span>
            </div>
            <span className={`text-[11px] font-semibold uppercase tracking-wider px-2.5 py-0.5 rounded-full ${currentStep.color.tag}`}>
              {currentStep.tag}
            </span>
          </div>

          {/* Title & description */}
          <h2 className="text-lg font-bold text-slate-900 mb-2 leading-tight">{currentStep.title}</h2>
          <p className="text-sm text-slate-500 leading-relaxed mb-5">{currentStep.description}</p>

          {/* Visual */}
          <div className={`rounded-xl p-4 border ${currentStep.color.border} bg-slate-50/70 mb-2`}>
            {currentStep.visual}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between bg-slate-50/50">
          <button
            onClick={() => goTo(step - 1, 'back')}
            disabled={step === 0}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-500 hover:text-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors rounded-lg hover:bg-slate-100"
          >
            <ChevronLeft className="h-4 w-4" />
            Geri
          </button>

          <button
            onClick={() => { if (isLast) handleClose(); else goTo(step + 1, 'forward'); }}
            className={`inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold rounded-xl transition-all shadow-sm ${
              isLast
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                : 'bg-slate-900 hover:bg-slate-700 text-white'
            }`}
          >
            {isLast ? (
              <>
                <CheckCircle className="h-4 w-4" />
                Başla
              </>
            ) : (
              <>
                İleri
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

/* ─── Hook: ilk girişte otomatik aç ──────────────────────── */

/**
 * DailyWorklogTracking bileşeninde kullanın:
 *
 * const { isOnboardingOpen, openOnboarding, closeOnboarding } = useDailyWorklogOnboarding();
 *
 * return (
 *   <>
 *     <DailyWorklogOnboarding isOpen={isOnboardingOpen} onClose={closeOnboarding} />
 *     // ... sayfa içeriği ...
 *     // Ayarlar sayfasında tekrar açmak için:
 *     <button onClick={openOnboarding}>Turu Tekrar Başlat</button>
 *   </>
 * );
 */
export const useDailyWorklogOnboarding = () => {
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);

  useEffect(() => {
    try {
      const seen = localStorage.getItem(STORAGE_KEY);
      if (!seen) setIsOnboardingOpen(true);
    } catch {
      setIsOnboardingOpen(true);
    }
  }, []);

  const openOnboarding = () => {
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
    setIsOnboardingOpen(true);
  };

  const closeOnboarding = () => setIsOnboardingOpen(false);

  return { isOnboardingOpen, openOnboarding, closeOnboarding };
};

export default DailyWorklogOnboarding;