import React, { useState, useEffect } from 'react';
import {
  X,
  Activity,
  Calendar,
  Users,
  Clock,
  ChevronRight,
  ChevronLeft,
  CheckCircle,
  Download,
  Target,
  Bug,
  Zap,
  FileText,
  Sparkles,
  ArrowRight,
  Star,
  Filter,
  BarChart2
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
    border: string;
  };
}

interface ProjectSprintOnboardingProps {
  isOpen: boolean;
  onClose: () => void;
}

/* ─── Mini görseller ─────────────────────────────────────── */

const StatsVisual = () => (
  <div className="grid grid-cols-5 gap-1.5">
    {[
      { label: 'Aktif Sprint', value: '8', color: 'text-blue-600', bg: 'bg-blue-50', icon: <Activity className="h-3.5 w-3.5" /> },
      { label: 'Ana Görev', value: '142', color: 'text-green-600', bg: 'bg-green-50', icon: <Calendar className="h-3.5 w-3.5" /> },
      { label: 'Toplam Süre', value: '680h', color: 'text-purple-600', bg: 'bg-purple-50', icon: <Clock className="h-3.5 w-3.5" /> },
      { label: 'Harcanan', value: '512h', color: 'text-orange-600', bg: 'bg-orange-50', icon: <Clock className="h-3.5 w-3.5" /> },
      { label: '70h Hedef', value: '12', color: 'text-orange-600', bg: 'bg-orange-50', icon: <Users className="h-3.5 w-3.5" /> },
    ].map((c) => (
      <div key={c.label} className={`${c.bg} rounded-xl p-2 flex flex-col items-center gap-1 border border-white shadow-sm`}>
        <span className={`${c.color}`}>{c.icon}</span>
        <span className={`text-base font-bold ${c.color}`}>{c.value}</span>
        <span className="text-[9px] text-slate-500 text-center leading-tight">{c.label}</span>
      </div>
    ))}
  </div>
);

const SprintCardVisual = () => (
  <div className="flex flex-col gap-2 max-w-xs mx-auto">
    <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <Activity className="h-3.5 w-3.5 text-blue-600" />
          <span className="text-xs font-semibold text-blue-600">ATK</span>
        </div>
        <span className="px-2 py-0.5 bg-green-100 text-green-800 text-[10px] font-medium rounded-full">Aktif</span>
      </div>
      <p className="text-sm font-semibold text-slate-800 mb-0.5">Sprint 24 – Q1 2025</p>
      <p className="text-xs text-slate-500 mb-2">Albaraka Türk Katılım Bankası</p>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-slate-500">Ana Görev Sayısı:</span>
          <div className="flex items-center gap-1">
            <span className="text-[11px] font-semibold text-blue-600">18 görev</span>
          </div>
        </div>
        <div className="flex gap-1 flex-wrap">
          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium text-blue-600 bg-blue-100">
            <FileText className="h-2.5 w-2.5" />Task: 12
          </span>
          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium text-red-600 bg-red-100">
            <Bug className="h-2.5 w-2.5" />Bug: 4
          </span>
          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium text-green-600 bg-green-100">
            <Zap className="h-2.5 w-2.5" />Story: 2
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-slate-500">Sprint Başarı Oranı:</span>
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-semibold text-green-600">%83</span>
            <div className="w-12 h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-green-500 rounded-full" style={{ width: '83%' }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
);

const SuccessRateVisual = () => (
  <div className="flex flex-col gap-2 max-w-xs mx-auto">
    {[
      { name: 'Sprint 22 – VK', rate: 92, color: 'bg-green-500', label: 'text-green-600', done: 11, total: 12 },
      { name: 'Sprint 18 – ATK', rate: 75, color: 'bg-yellow-500', label: 'text-yellow-600', done: 9, total: 12 },
      { name: 'Sprint 15 – AN', rate: 48, color: 'bg-red-500', label: 'text-red-600', done: 6, total: 12 },
    ].map((s) => (
      <div key={s.name} className="bg-white border border-slate-200 rounded-xl px-3 py-2.5 shadow-sm">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-semibold text-slate-700">{s.name}</span>
          <span className={`text-xs font-bold ${s.label}`}>%{s.rate}</span>
        </div>
        <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden mb-1">
          <div className={`${s.color} h-full rounded-full`} style={{ width: `${s.rate}%` }} />
        </div>
        <p className="text-[10px] text-slate-400">{s.done}/{s.total} görev tamamlandı</p>
      </div>
    ))}
    <div className="flex items-center gap-3 text-[10px] text-slate-500 justify-center mt-1">
      <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" />≥%80 İyi</span>
      <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-500 inline-block" />%60–79 Orta</span>
      <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" />{"<"}%60 Düşük</span>
    </div>
  </div>
);

const FilterVisual = () => (
  <div className="flex flex-col gap-2 max-w-xs mx-auto">
    <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm">
      <div className="flex items-center gap-2 mb-2.5">
        <Filter className="h-3.5 w-3.5 text-slate-500" />
        <span className="text-xs font-semibold text-slate-700">Filtreler</span>
      </div>
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-slate-500 w-20 flex-shrink-0">Proje:</span>
          <div className="flex-1 border border-slate-200 rounded-lg px-2 py-1 text-[11px] text-slate-700 bg-slate-50">
            Albaraka Türk (ATK)
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-slate-500 w-20 flex-shrink-0">Yıl:</span>
          <div className="flex-1 border border-slate-200 rounded-lg px-2 py-1 text-[11px] text-slate-700 bg-slate-50">
            2025
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-slate-500 w-20 flex-shrink-0">Sprint Adı:</span>
          <div className="flex-1 border border-slate-200 rounded-lg px-2 py-1 text-[11px] text-slate-400 bg-slate-50">
            Sprint adına göre ara...
          </div>
        </div>
      </div>
    </div>
    <div className="bg-blue-50 border border-blue-100 rounded-xl px-3 py-2 text-[11px] text-blue-700 text-center">
      Yıl filtresi sadece analist/yazılımcı rolünde ve kapalı sprintlerde görünür
    </div>
  </div>
);

const EvaluationVisual = () => (
  <div className="flex flex-col gap-2 max-w-xs mx-auto">
    <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm">
      <div className="space-y-2">
        <div className="border border-slate-100 rounded-lg p-2.5 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-700">Sprint 20 – VK</p>
            <p className="text-[10px] text-slate-400 mt-0.5">Kapatıldı • 15 Ocak 2025</p>
          </div>
          <button className="px-2.5 py-1 bg-orange-600 text-white text-[10px] font-semibold rounded-lg">
            Değerlendir
          </button>
        </div>
        <div className="border border-slate-100 rounded-lg p-2.5 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-700">Sprint 19 – ATK</p>
            <p className="text-[10px] text-slate-400 mt-0.5">Kapatıldı • 1 Ocak 2025</p>
          </div>
          <span className="px-2.5 py-1 bg-green-100 text-green-700 text-[10px] font-semibold rounded-lg flex items-center gap-1">
            <CheckCircle className="h-3 w-3" />Tamamlandı
          </span>
        </div>
        <div className="border border-slate-100 rounded-lg p-2.5 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-700">Sprint 18 – AN</p>
            <p className="text-[10px] text-slate-400 mt-0.5">Kapatıldı • 15 Ara 2024</p>
          </div>
          <span className="px-2.5 py-1 bg-slate-100 text-slate-500 text-[10px] font-semibold rounded-lg">
            Süre doldu
          </span>
        </div>
      </div>
    </div>
  </div>
);

/* ─── Adım tanımları ─────────────────────────────────────── */

const STEPS: OnboardingStep[] = [
  {
    id: 1,
    icon: <BarChart2 className="h-5 w-5" />,
    tag: 'Genel Bakış',
    title: 'Özet İstatistik Kartları',
    description:
      'Sayfanın üstündeki 5 kart anlık durumu özetler: aktif sprint sayısı, toplam ana görev, orijinal tahmin saati, geliştiricilerin harcadığı gerçek süre ve sprint\'te yer alan yazılımcı sayısı. Tüm değerler seçili proje filtresine göre güncellenir.',
    visual: <StatsVisual />,
    color: {
      tag: 'bg-blue-100 text-blue-700',
      icon: 'text-blue-600',
      iconBg: 'bg-blue-50',
      border: 'border-blue-100',
    },
  },
  {
    id: 2,
    icon: <Activity className="h-5 w-5" />,
    tag: 'Sprint Kartları',
    title: 'Sprint Detay Kartları',
    description:
      'Her sprint için proje kodu, durum etiketi (Aktif/Kapatıldı), ana görev sayısı ve görev tipi dağılımı (Task/Bug/Story) gösterilir. Tamamlanan görevler ayrıca listelenir, başlangıç ve bitiş tarihleri kartın altında yer alır.',
    visual: <SprintCardVisual />,
    color: {
      tag: 'bg-violet-100 text-violet-700',
      icon: 'text-violet-600',
      iconBg: 'bg-violet-50',
      border: 'border-violet-100',
    },
  },
  {
    id: 3,
    icon: <Target className="h-5 w-5" />,
    tag: 'Başarı Oranı',
    title: 'Sprint Başarı Oranı Renk Kodları',
    description:
      'Her sprintin tamamlanan görev / toplam görev oranı yüzde olarak hesaplanır. %80 ve üzeri yeşil (iyi), %60–79 sarı (orta), %60 altı kırmızı (düşük) renk ile gösterilir. Kartlar varsayılan olarak başarı oranına göre azalan sırada listelenir.',
    visual: <SuccessRateVisual />,
    color: {
      tag: 'bg-emerald-100 text-emerald-700',
      icon: 'text-emerald-600',
      iconBg: 'bg-emerald-50',
      border: 'border-emerald-100',
    },
  },
  {
    id: 4,
    icon: <Filter className="h-5 w-5" />,
    tag: 'Filtreleme',
    title: 'Proje, Yıl & Sprint Adı Filtresi',
    description:
      'Proje seçici ile belirli bir bankaya odaklanabilirsiniz. Analist ve yazılımcı rolündeyseniz ek olarak yıl filtresi ve sprint adı arama kutusu açılır; bu sayede kapalı sprint arşivinde hızlıca arama yapabilirsiniz. "Daha Fazla Yükle" ile 30\'ar sprint eklenir.',
    visual: <FilterVisual />,
    color: {
      tag: 'bg-amber-100 text-amber-700',
      icon: 'text-amber-600',
      iconBg: 'bg-amber-50',
      border: 'border-amber-100',
    },
  },
  {
    id: 5,
    icon: <Star className="h-5 w-5" />,
    tag: 'Sprint Değerlendirme',
    title: 'Kapalı Sprint Değerlendirmesi',
    description:
      'Admin dışındaki kullanıcılar, kapanan sprintler için değerlendirme formu doldurabilir. Değerlendirme süresi dolmamışsa turuncu "Sprint Değerlendir" butonu görünür. Tamamlananlar yeşil onay ile, süresi dolanlar gri etiketle işaretlenir.',
    visual: <EvaluationVisual />,
    color: {
      tag: 'bg-orange-100 text-orange-700',
      icon: 'text-orange-600',
      iconBg: 'bg-orange-50',
      border: 'border-orange-100',
    },
  },
];

/* ─── Ana bileşen ─────────────────────────────────────────── */

const STORAGE_KEY = 'onboarding_project_sprint_seen';

const ProjectSprintOnboarding: React.FC<ProjectSprintOnboardingProps> = ({ isOpen, onClose }) => {
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
        {/* Header */}
        <div className="bg-slate-900 px-6 pt-5 pb-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-white/10 rounded-lg flex items-center justify-center">
                <Sparkles className="h-4 w-4 text-white" />
              </div>
              <span className="text-sm font-semibold text-white">Proje & Sprint Genel Bakış — Hızlı Başlangıç</span>
            </div>
            <button
              onClick={handleClose}
              className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          {/* Progress dots */}
          <div className="flex items-center gap-1.5">
            {STEPS.map((s, i) => (
              <button
                key={s.id}
                onClick={() => goTo(i, i > step ? 'forward' : 'back')}
                className={`rounded-full transition-all duration-300 ${
                  i === step ? 'w-6 h-2 bg-white' : i < step ? 'w-2 h-2 bg-white/50' : 'w-2 h-2 bg-white/20'
                }`}
              />
            ))}
            <span className="ml-auto text-xs text-slate-400 font-medium tabular-nums">
              {step + 1} / {STEPS.length}
            </span>
          </div>
        </div>

        {/* Content */}
        <div
          className="px-6 pt-5 pb-4"
          style={{
            opacity: animating ? 0 : 1,
            transform: animating ? `translateX(${direction === 'forward' ? '-16px' : '16px'})` : 'translateX(0)',
            transition: 'opacity 0.22s ease, transform 0.22s ease',
          }}
        >
          <div className="flex items-center gap-2 mb-3">
            <div className={`w-8 h-8 ${currentStep.color.iconBg} rounded-lg flex items-center justify-center flex-shrink-0`}>
              <span className={currentStep.color.icon}>{currentStep.icon}</span>
            </div>
            <span className={`text-[11px] font-semibold uppercase tracking-wider px-2.5 py-0.5 rounded-full ${currentStep.color.tag}`}>
              {currentStep.tag}
            </span>
          </div>
          <h2 className="text-lg font-bold text-slate-900 mb-2 leading-tight">{currentStep.title}</h2>
          <p className="text-sm text-slate-500 leading-relaxed mb-5">{currentStep.description}</p>
          <div className={`rounded-xl p-4 border ${currentStep.color.border} bg-slate-50/70`}>
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
              isLast ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'bg-slate-900 hover:bg-slate-700 text-white'
            }`}
          >
            {isLast ? (
              <><CheckCircle className="h-4 w-4" />Başla</>
            ) : (
              <>İleri<ArrowRight className="h-4 w-4" /></>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

/* ─── Hook ───────────────────────────────────────────────── */

export const useProjectSprintOnboarding = () => {
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

export default ProjectSprintOnboarding;