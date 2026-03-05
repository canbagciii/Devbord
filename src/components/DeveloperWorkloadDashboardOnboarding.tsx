import React, { useState, useEffect } from 'react';
import {
  X,
  Users,
  Clock,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  ChevronRight,
  ChevronLeft,
  Calendar,
  Search,
  Sparkles,
  ArrowRight,
  BarChart2,
  Edit,
  Loader
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

interface DeveloperWorkloadOnboardingProps {
  isOpen: boolean;
  onClose: () => void;
}

/* ─── Mini görseller ─────────────────────────────────────── */

const StatsVisual = () => (
  <div className="grid grid-cols-5 gap-1.5">
    {[
      { label: 'Toplam Yazılımcı', value: '14', color: 'text-blue-600', bg: 'bg-blue-50', icon: <Users className="h-3.5 w-3.5" /> },
      { label: 'Eksik Yük', value: '3', color: 'text-amber-500', bg: 'bg-amber-50', icon: <AlertTriangle className="h-3.5 w-3.5" /> },
      { label: 'Yeterli Yük', value: '8', color: 'text-emerald-600', bg: 'bg-emerald-50', icon: <CheckCircle className="h-3.5 w-3.5" /> },
      { label: 'Aşırı Yük', value: '3', color: 'text-red-600', bg: 'bg-red-50', icon: <TrendingUp className="h-3.5 w-3.5" /> },
      { label: 'Toplam Harcanan', value: '284h', color: 'text-violet-600', bg: 'bg-violet-50', icon: <Clock className="h-3.5 w-3.5" /> },
    ].map((c) => (
      <div key={c.label} className={`${c.bg} rounded-xl p-2 flex flex-col items-center gap-1 border border-white shadow-sm`}>
        <span className={c.color}>{c.icon}</span>
        <span className={`text-base font-bold ${c.color}`}>{c.value}</span>
        <span className="text-[9px] text-slate-500 text-center leading-tight">{c.label}</span>
      </div>
    ))}
  </div>
);

const WorkloadTableVisual = () => (
  <div className="flex flex-col gap-1.5 max-w-sm mx-auto">
    <div className="grid grid-cols-6 gap-1 px-2 pb-1 border-b border-slate-100">
      {['Yazılımcı', 'Görev', 'Tahmin', 'Harcanan', 'Kapasite', 'Durum'].map(h => (
        <span key={h} className="text-[9px] font-semibold text-slate-400 uppercase text-center">{h}</span>
      ))}
    </div>
    {[
      { name: 'Ayşe Y.', tasks: 12, est: '48h', spent: '52h', cap: '70h', status: 'Yeterli', statusColor: 'bg-emerald-100 text-emerald-700' },
      { name: 'Mehmet K.', tasks: 5, est: '20h', spent: '18h', cap: '70h', status: 'Eksik', statusColor: 'bg-amber-100 text-amber-700' },
      { name: 'Zeynep D.', tasks: 18, est: '82h', spent: '79h', cap: '70h', status: 'Aşırı', statusColor: 'bg-red-100 text-red-700' },
    ].map((row) => (
      <div key={row.name} className="grid grid-cols-6 gap-1 items-center bg-white border border-slate-100 rounded-lg px-2 py-1.5">
        <span className="text-[10px] font-semibold text-slate-700 truncate">{row.name}</span>
        <span className="text-[10px] font-bold text-slate-600 text-center">{row.tasks}</span>
        <span className="text-[10px] font-bold text-blue-600 text-center">{row.est}</span>
        <span className="text-[10px] font-bold text-violet-600 text-center">{row.spent}</span>
        <span className="text-[10px] font-semibold text-slate-500 text-center">{row.cap}</span>
        <span className={`text-[9px] font-semibold px-1 py-0.5 rounded-full text-center ${row.statusColor}`}>{row.status}</span>
      </div>
    ))}
  </div>
);

const HoursExplainVisual = () => (
  <div className="flex flex-col gap-2 max-w-xs mx-auto">
    <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm">
      <div className="flex items-start gap-3 mb-3">
        <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center flex-shrink-0">
          <BarChart2 className="h-4 w-4 text-blue-600" />
        </div>
        <div>
          <p className="text-xs font-semibold text-slate-800">Analist Tahmini</p>
          <p className="text-[11px] text-slate-500 mt-0.5">Sprint görevlerindeki toplam tahmini süreler</p>
          <p className="text-sm font-bold text-blue-600 mt-1">48h</p>
        </div>
      </div>
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 bg-violet-50 rounded-lg flex items-center justify-center flex-shrink-0">
          <Clock className="h-4 w-4 text-violet-600" />
        </div>
        <div>
          <p className="text-xs font-semibold text-slate-800">Harcanan Süre</p>
          <p className="text-[11px] text-slate-500 mt-0.5">Yazılımcının kendi projesi sprint tarihleri arasındaki Jira worklog toplamı</p>
          <p className="text-sm font-bold text-violet-600 mt-1">52h</p>
        </div>
      </div>
    </div>
    <div className="bg-slate-50 border border-slate-100 rounded-xl p-2.5 text-center">
      <p className="text-[11px] text-slate-500">Her yazılımcının harcanan süresi <span className="font-semibold text-slate-700">kendi projesinin sprint tarihlerine</span> göre hesaplanır</p>
    </div>
  </div>
);

const CapacityVisual = () => (
  <div className="flex flex-col gap-2 max-w-xs mx-auto">
    <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm">
      <p className="text-xs font-semibold text-slate-700 mb-2.5">Kapasite Yönetimi</p>
      <div className="space-y-2">
        <div className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2 border border-slate-100">
          <div>
            <p className="text-xs font-semibold text-slate-700">Can Öztürk</p>
            <p className="text-[10px] text-slate-400">Varsayılan kapasite</p>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-bold text-slate-700">70h</span>
            <div className="w-5 h-5 bg-blue-50 rounded flex items-center justify-center">
              <Edit className="h-3 w-3 text-blue-500" />
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between bg-amber-50 rounded-lg px-3 py-2 border border-amber-100">
          <div>
            <p className="text-xs font-semibold text-slate-700">Selin Ak</p>
            <div className="flex items-center gap-1 mt-0.5">
              <Calendar className="h-3 w-3 text-amber-500" />
              <p className="text-[10px] text-amber-600">2 gün izin → kapasite düşürüldü</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-slate-400 line-through">70h</p>
            <p className="text-sm font-bold text-amber-600">56h</p>
          </div>
        </div>
      </div>
    </div>
    <div className="bg-purple-50 border border-purple-100 rounded-xl px-3 py-2 text-[11px] text-purple-700 text-center">
      KolayIK entegrasyonu aktifken izin günleri otomatik düşürülür
    </div>
  </div>
);

const SearchVisual = () => (
  <div className="flex flex-col gap-2 max-w-xs mx-auto">
    <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <div className="flex-1 flex items-center gap-2 border border-blue-300 rounded-lg px-2.5 py-1.5 bg-blue-50/50 ring-2 ring-blue-100">
          <Search className="h-3.5 w-3.5 text-blue-500 flex-shrink-0" />
          <span className="text-[11px] text-slate-600">ayşe</span>
        </div>
        <span className="text-[10px] text-slate-400 whitespace-nowrap">1 gösteriliyor</span>
      </div>
      <div className="bg-white border border-slate-100 rounded-lg px-2.5 py-2 flex items-center gap-2">
        <div className="w-7 h-7 bg-gradient-to-br from-violet-500 to-purple-600 rounded-full flex items-center justify-center flex-shrink-0">
          <span className="text-[10px] font-bold text-white">AY</span>
        </div>
        <div>
          <p className="text-xs font-semibold text-slate-700">Ayşe Yılmaz</p>
          <p className="text-[10px] text-slate-400">ayse@firma.com</p>
        </div>
      </div>
    </div>
    <div className="bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 text-[11px] text-slate-500 text-center">
      İsim veya e-posta ile anlık filtreleme yapabilirsiniz
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
      'Sayfanın üstündeki 5 kart anlık durumu özetler: toplam yazılımcı, eksik/yeterli/aşırı yük sayıları ve sprint tarihleri arasında harcanan toplam süre. Tüm değerler aktif sprintlerdeki verilere göre hesaplanır.',
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
    icon: <Users className="h-5 w-5" />,
    tag: 'İş Yükü Tablosu',
    title: 'Yazılımcı Satırları',
    description:
      'Her yazılımcı için görev sayısı, analist tahmini, harcanan süre, kapasite ve iş yükü durumu tek satırda görünür. Satır sonundaki "Detaylar" butonuna tıklayarak proje ve görev bazlı kırılıma ulaşabilirsiniz.',
    visual: <WorkloadTableVisual />,
    color: {
      tag: 'bg-violet-100 text-violet-700',
      icon: 'text-violet-600',
      iconBg: 'bg-violet-50',
      border: 'border-violet-100',
    },
  },
  {
    id: 3,
    icon: <Clock className="h-5 w-5" />,
    tag: 'Süre Hesabı',
    title: '"Analist Tahmini" vs "Harcanan Süre"',
    description:
      'Analist Tahmini, sprint görevlerine girilen toplam tahmini süredir. Harcanan Süre ise yazılımcının kendi projesine ait sprint tarih aralığındaki Jira worklog toplamıdır — bu iki değer birbiriyle doğrudan karşılaştırılabilir.',
    visual: <HoursExplainVisual />,
    color: {
      tag: 'bg-emerald-100 text-emerald-700',
      icon: 'text-emerald-600',
      iconBg: 'bg-emerald-50',
      border: 'border-emerald-100',
    },
  },
  {
    id: 4,
    icon: <Calendar className="h-5 w-5" />,
    tag: 'Kapasite',
    title: 'Kapasite Düzenleme & İzin Ayarı',
    description:
      'Admin kullanıcılar kalem ikonuna tıklayarak her yazılımcının kapasitesini düzenleyebilir. KolayIK entegrasyonu açıksa izinli günler otomatik olarak kapasiteden düşürülür; bu sayede durum hesabı haksız yere "Eksik" çıkmaz.',
    visual: <CapacityVisual />,
    color: {
      tag: 'bg-amber-100 text-amber-700',
      icon: 'text-amber-600',
      iconBg: 'bg-amber-50',
      border: 'border-amber-100',
    },
  },
  {
    id: 5,
    icon: <Search className="h-5 w-5" />,
    tag: 'Arama & Filtre',
    title: 'İsim veya E-posta ile Arama',
    description:
      'Arama kutusu anlık filtreler; yazılımcı adı veya e-posta adresiyle arama yapabilirsiniz. "CSV İndir" butonu o anki filtreye göre tabloyu dışa aktarır. "İzin Entegrasyonu" butonu KolayIK kapasite ayarını açıp kapatır.',
    visual: <SearchVisual />,
    color: {
      tag: 'bg-slate-100 text-slate-700',
      icon: 'text-slate-600',
      iconBg: 'bg-slate-100',
      border: 'border-slate-200',
    },
  },
];

/* ─── Ana bileşen ─────────────────────────────────────────── */

const STORAGE_KEY = 'onboarding_developer_workload_seen';

const DeveloperWorkloadOnboarding: React.FC<DeveloperWorkloadOnboardingProps> = ({ isOpen, onClose }) => {
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
              <span className="text-sm font-semibold text-white">Yazılımcı İş Yükü Analizi — Hızlı Başlangıç</span>
            </div>
            <button
              onClick={handleClose}
              className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
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

export const useDeveloperWorkloadOnboarding = () => {
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

export default DeveloperWorkloadOnboarding;