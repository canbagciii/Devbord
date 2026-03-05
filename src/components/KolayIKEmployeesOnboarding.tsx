import React, { useState, useEffect } from 'react';
import {
  X,
  Users,
  CalendarDays,
  Clock,
  CheckCircle,
  ChevronLeft,
  Sparkles,
  ArrowRight,
  Download,
  Search,
  Filter,
  Building,
  Mail,
  Eye,
  RefreshCw,
  AlertTriangle,
  XCircle
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

interface KolayIKOnboardingProps {
  isOpen: boolean;
  onClose: () => void;
}

/* ─── Mini görseller ─────────────────────────────────────── */

const StatsVisual = () => (
  <div className="grid grid-cols-5 gap-1.5">
    {[
      { label: 'Toplam', value: '14', color: 'text-blue-600', bg: 'bg-blue-50', icon: <Users className="h-3.5 w-3.5" /> },
      { label: 'Aktif', value: '12', color: 'text-emerald-600', bg: 'bg-emerald-50', icon: <CheckCircle className="h-3.5 w-3.5" /> },
      { label: 'Pasif', value: '2', color: 'text-red-600', bg: 'bg-red-50', icon: <XCircle className="h-3.5 w-3.5" /> },
      { label: 'E-posta', value: '13', color: 'text-purple-600', bg: 'bg-purple-50', icon: <Mail className="h-3.5 w-3.5" /> },
      { label: 'Dept.', value: '3', color: 'text-orange-600', bg: 'bg-orange-50', icon: <Building className="h-3.5 w-3.5" /> },
    ].map((c) => (
      <div key={c.label} className={`${c.bg} rounded-xl p-2 flex flex-col items-center gap-1 border border-white shadow-sm`}>
        <span className={c.color}>{c.icon}</span>
        <span className={`text-base font-bold ${c.color}`}>{c.value}</span>
        <span className="text-[9px] text-slate-500 text-center leading-tight">{c.label}</span>
      </div>
    ))}
  </div>
);

const MonthSelectorVisual = () => (
  <div className="flex flex-col gap-2 max-w-xs mx-auto">
    <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm">
      <p className="text-xs font-semibold text-slate-700 mb-2.5">Ay Seçimi ile Veri Değişimi</p>
      <div className="flex items-center gap-2 mb-3">
        <label className="text-xs font-medium text-slate-500">Ay:</label>
        <div className="flex-1 border border-blue-300 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50">
          2025-03
        </div>
      </div>
      <div className="space-y-1.5">
        {[
          { name: 'Ayşe Y.', days: 3, type: 'Yıllık İzin', color: 'bg-orange-50 border-orange-200 text-orange-700' },
          { name: 'Mehmet K.', days: 1, type: 'Resmi Tatil', color: 'bg-purple-50 border-purple-200 text-purple-700' },
        ].map((r) => (
          <div key={r.name} className={`flex items-center justify-between border rounded-lg px-2.5 py-1.5 ${r.color}`}>
            <span className="text-[10px] font-semibold">{r.name}</span>
            <span className="text-[10px]">{r.type}</span>
            <div className="flex items-center gap-1">
              <CalendarDays className="h-3 w-3" />
              <span className="text-[10px] font-bold">{r.days} gün</span>
            </div>
          </div>
        ))}
      </div>
    </div>
    <div className="bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 text-[10px] text-slate-500 text-center">
      Ay değiştirildiğinde veriler otomatik yenilenir
    </div>
  </div>
);

const LeaveTableVisual = () => (
  <div className="flex flex-col gap-1.5 max-w-sm mx-auto">
    <div className="grid grid-cols-5 gap-1 px-1 pb-1.5 border-b border-slate-100">
      {['Çalışan', 'İzin', 'Detay', 'Kapasite', 'Durum'].map(h => (
        <span key={h} className="text-[9px] font-semibold text-slate-400 uppercase text-center">{h}</span>
      ))}
    </div>
    {[
      { name: 'Ayşe Y.', days: 3, detail: 'Yıllık İzin', cap: '-21h', status: 'Aktif', statusColor: 'bg-emerald-100 text-emerald-700' },
      { name: 'Can Ö.', days: 1, detail: 'Resmi Tatil', cap: '-7h', status: 'Aktif', statusColor: 'bg-emerald-100 text-emerald-700' },
      { name: 'Zeynep D.', days: 5, detail: 'Yıllık İzin', cap: '-35h', status: 'Pasif', statusColor: 'bg-red-100 text-red-700' },
    ].map((row) => (
      <div key={row.name} className="grid grid-cols-5 gap-1 items-center bg-white border border-slate-100 rounded-lg px-1.5 py-2">
        <span className="text-[9px] font-semibold text-slate-700 truncate">{row.name}</span>
        <div className="flex items-center justify-center gap-0.5">
          <CalendarDays className="h-3 w-3 text-orange-500" />
          <span className="text-[9px] font-bold text-orange-600">{row.days}g</span>
        </div>
        <span className="text-[9px] text-slate-500 text-center truncate">{row.detail}</span>
        <div className="flex items-center justify-center gap-0.5">
          <Clock className="h-3 w-3 text-red-500" />
          <span className="text-[9px] font-bold text-red-600">{row.cap}</span>
        </div>
        <span className={`text-[8px] font-semibold px-1 py-0.5 rounded-full text-center ${row.statusColor}`}>{row.status}</span>
      </div>
    ))}
  </div>
);

const LeaveTypesVisual = () => (
  <div className="flex flex-col gap-2 max-w-xs mx-auto">
    <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm">
      <p className="text-xs font-semibold text-slate-700 mb-2.5">İzin Türleri</p>
      <div className="space-y-2">
        <div className="bg-orange-50 border border-orange-200 rounded-xl px-3 py-2">
          <p className="text-[11px] font-bold text-orange-800">Yıllık İzin / Mazeret / Sağlık</p>
          <p className="text-[10px] text-orange-600 mt-0.5">Çalışanın bireysel izin talepleri</p>
          <div className="flex items-center gap-2 mt-1.5">
            <span className="text-[10px] text-orange-700 font-semibold">15 Mart – 17 Mart (3 gün)</span>
          </div>
        </div>
        <div className="bg-purple-50 border border-purple-200 rounded-xl px-3 py-2">
          <p className="text-[11px] font-bold text-purple-800">Resmi Tatil</p>
          <p className="text-[10px] text-purple-600 mt-0.5">Tüm çalışanlar için ulusal tatil günleri</p>
          <div className="flex items-center gap-2 mt-1.5">
            <span className="text-[10px] text-purple-700 font-semibold">23 Nisan (1 gün)</span>
          </div>
        </div>
      </div>
    </div>
    <div className="bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 text-[10px] text-slate-500 text-center">
      Her izin türü ayrı renk koduyla gösterilir
    </div>
  </div>
);

const CapacityImpactVisual = () => (
  <div className="flex flex-col gap-2 max-w-xs mx-auto">
    <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm">
      <p className="text-xs font-semibold text-slate-700 mb-2.5">Kapasite Etkisi Hesabı</p>
      <div className="space-y-2">
        <div className="bg-slate-50 border border-slate-100 rounded-lg px-3 py-2 flex items-center justify-between">
          <span className="text-[10px] text-slate-500">Standart Kapasite</span>
          <span className="text-sm font-bold text-slate-700">70h</span>
        </div>
        <div className="bg-orange-50 border border-orange-100 rounded-lg px-3 py-2 flex items-center justify-between">
          <div>
            <span className="text-[10px] text-orange-600 font-semibold">3 gün izin</span>
            <span className="text-[10px] text-orange-500 ml-1">(3 × 7h)</span>
          </div>
          <span className="text-sm font-bold text-red-600">−21h</span>
        </div>
        <div className="bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2 flex items-center justify-between">
          <span className="text-[10px] text-emerald-600 font-semibold">Düzeltilmiş Kapasite</span>
          <span className="text-sm font-bold text-emerald-700">49h</span>
        </div>
      </div>
    </div>
    <div className="bg-blue-50 border border-blue-100 rounded-xl px-3 py-2 text-[10px] text-blue-700 text-center">
      Bu değer İş Yükü Analizi sayfasına otomatik yansır
    </div>
  </div>
);

const ExportFilterVisual = () => (
  <div className="flex flex-col gap-2 max-w-xs mx-auto">
    <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm">
      <div className="grid grid-cols-2 gap-1.5 mb-3">
        <div className="flex items-center justify-center gap-1.5 bg-emerald-50 border border-emerald-200 rounded-lg px-2 py-2">
          <Download className="h-3.5 w-3.5 text-emerald-600" />
          <span className="text-[10px] font-semibold text-emerald-700">Çalışanlar CSV</span>
        </div>
        <div className="flex items-center justify-center gap-1.5 bg-purple-50 border border-purple-200 rounded-lg px-2 py-2">
          <CalendarDays className="h-3.5 w-3.5 text-purple-600" />
          <span className="text-[10px] font-semibold text-purple-700">İzinler CSV</span>
        </div>
      </div>
      <div className="space-y-1.5">
        <div className="flex items-center gap-2 border border-slate-200 rounded-lg px-2 py-1.5">
          <Search className="h-3 w-3 text-slate-400" />
          <span className="text-[10px] text-slate-500">İzinli çalışan ara…</span>
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          <div className="border border-slate-200 rounded-lg px-2 py-1.5 text-[9px] text-slate-500 text-center">Aktif / Pasif</div>
          <div className="border border-slate-200 rounded-lg px-2 py-1.5 text-[9px] text-slate-500 text-center">Departman</div>
        </div>
      </div>
    </div>
    <div className="bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 text-[10px] text-slate-500 text-center">
      "Detaylı Görünüm" açıkken departman dağılım grafiği de görünür
    </div>
  </div>
);

/* ─── Adım tanımları ─────────────────────────────────────── */

const STEPS: OnboardingStep[] = [
  {
    id: 1,
    icon: <Users className="h-5 w-5" />,
    tag: 'Genel Bakış',
    title: 'Özet İstatistik Kartları',
    description:
      'Sayfanın üstündeki 5 kart seçili aya ait anlık özeti gösterir: toplam izinli çalışan, aktif, pasif, e-postası kayıtlı olanlar ve departman sayısı. Tüm değerler yalnızca Jira Filtre Yönetimi\'nde seçili yazılımcıları kapsar.',
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
    icon: <CalendarDays className="h-5 w-5" />,
    tag: 'Ay Seçimi',
    title: 'Aylık İzin Verisi Görüntüleme',
    description:
      'Sağ üstteki "Ay" seçiciyle istediğiniz aya ait izin verilerini görüntüleyebilirsiniz. Ay değiştirildiğinde sayfa otomatik olarak KolayIK API\'sinden yeni veriyi çeker; ek bir işlem gerekmez.',
    visual: <MonthSelectorVisual />,
    color: {
      tag: 'bg-orange-100 text-orange-700',
      icon: 'text-orange-600',
      iconBg: 'bg-orange-50',
      border: 'border-orange-100',
    },
  },
  {
    id: 3,
    icon: <Eye className="h-5 w-5" />,
    tag: 'İzin Tablosu',
    title: 'İzinli Çalışan Listesi',
    description:
      'Tabloda her çalışanın izin günü sayısı, izin detayları (tür, tarih aralığı) ve kapasite etkisi (-Xh) görünür. "Detaylı Görünüm" butonu açıkken departman, pozisyon, işe başlama tarihi ve ID kolonları da eklenir.',
    visual: <LeaveTableVisual />,
    color: {
      tag: 'bg-violet-100 text-violet-700',
      icon: 'text-violet-600',
      iconBg: 'bg-violet-50',
      border: 'border-violet-100',
    },
  },
  {
    id: 4,
    icon: <CalendarDays className="h-5 w-5" />,
    tag: 'İzin Türleri',
    title: '2 Farklı İzin Türü',
    description:
      'Turuncu kartlar çalışana özel izinleri (yıllık izin, mazeret, sağlık izni vb.) gösterirken, mor kartlar tüm çalışanları etkileyen resmi tatil günlerini gösterir. Her izin için tür, tarih aralığı, gün sayısı ve açıklama görüntülenir.',
    visual: <LeaveTypesVisual />,
    color: {
      tag: 'bg-amber-100 text-amber-700',
      icon: 'text-amber-600',
      iconBg: 'bg-amber-50',
      border: 'border-amber-100',
    },
  },
  {
    id: 5,
    icon: <Clock className="h-5 w-5" />,
    tag: 'Kapasite Etkisi',
    title: 'İzin → Kapasite Hesabı',
    description:
      'Her izin günü için 7 saatlik kapasite düşürülür (1 gün = 7h). Tablo "Kapasite Etkisi" sütununda bu indirimi ve düzeltilmiş toplam kapasiteyi gösterir. Bu veriler, İş Yükü Analizi sayfasındaki kapasite hesabına otomatik olarak yansır.',
    visual: <CapacityImpactVisual />,
    color: {
      tag: 'bg-red-100 text-red-700',
      icon: 'text-red-600',
      iconBg: 'bg-red-50',
      border: 'border-red-100',
    },
  },
  {
    id: 6,
    icon: <Download className="h-5 w-5" />,
    tag: 'Export & Filtre',
    title: 'CSV Dışa Aktarma ve Filtreleme',
    description:
      '"Çalışanlar CSV" butonu filtrelenmiş çalışan listesini, "İzinler CSV" butonu ise o aya ait izin kayıtlarını dışa aktarır. Ad/e-posta/departman ile arama yapabilir; durum ve departman filtrelerini birlikte kullanabilirsiniz.',
    visual: <ExportFilterVisual />,
    color: {
      tag: 'bg-slate-100 text-slate-700',
      icon: 'text-slate-600',
      iconBg: 'bg-slate-100',
      border: 'border-slate-200',
    },
  },
];

/* ─── Ana bileşen ─────────────────────────────────────────── */

const STORAGE_KEY = 'onboarding_kolayik_employees_seen';

const KolayIKOnboarding: React.FC<KolayIKOnboardingProps> = ({ isOpen, onClose }) => {
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
              <span className="text-sm font-semibold text-white">Kolay IK — Hızlı Başlangıç</span>
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

export const useKolayIKOnboarding = () => {
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

export default KolayIKOnboarding;