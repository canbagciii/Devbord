import React, { useState, useEffect } from 'react';
import {
  X,
  Plus,
  Clock,
  AlertTriangle,
  CheckCircle,
  ChevronRight,
  ChevronLeft,
  Save,
  ExternalLink,
  Users,
  Sparkles,
  ArrowRight,
  BarChart2,
  Calendar,
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

interface ManualTaskOnboardingProps {
  isOpen: boolean;
  onClose: () => void;
}

/* ─── Mini görseller ─────────────────────────────────────── */

const CapacityTableVisual = () => (
  <div className="flex flex-col gap-1.5 max-w-sm mx-auto">
    <div className="grid grid-cols-4 gap-1 px-2 pb-1.5 border-b border-slate-100">
      {['Yazılımcı', 'Tahmin', 'Kapasite', 'Durum'].map(h => (
        <span key={h} className="text-[9px] font-semibold text-slate-400 uppercase text-center">{h}</span>
      ))}
    </div>
    {[
      { name: 'Ayşe Y.', est: '22h', cap: '70h', fill: 31, status: 'Eksik Yük', statusColor: 'bg-amber-100 text-amber-700' },
      { name: 'Mehmet K.', est: '65h', cap: '70h', fill: 93, status: 'Yeterli', statusColor: 'bg-emerald-100 text-emerald-700' },
      { name: 'Zeynep D.', est: '80h', cap: '56h', fill: 100, status: 'Aşırı Yük', statusColor: 'bg-red-100 text-red-700' },
    ].map((row) => (
      <div key={row.name} className="grid grid-cols-4 gap-1 items-center bg-white border border-slate-100 rounded-lg px-2 py-2">
        <span className="text-[10px] font-semibold text-slate-700 truncate">{row.name}</span>
        <span className="text-[10px] font-bold text-blue-600 text-center">{row.est}</span>
        <div className="flex flex-col items-center gap-0.5">
          <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${row.fill === 100 ? 'bg-red-500' : row.fill > 80 ? 'bg-emerald-500' : 'bg-amber-400'}`}
              style={{ width: `${row.fill}%` }}
            />
          </div>
          <span className="text-[9px] text-slate-500">{row.cap}</span>
        </div>
        <span className={`text-[9px] font-semibold px-1 py-0.5 rounded-full text-center ${row.statusColor}`}>{row.status}</span>
      </div>
    ))}
    <p className="text-[10px] text-slate-400 text-center mt-1">Kapasiteler KolayIK izinlerine göre otomatik düşürülür</p>
  </div>
);

const NewTaskVisual = () => (
  <div className="flex flex-col gap-2 max-w-xs mx-auto">
    <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm">
      <p className="text-xs font-semibold text-slate-700 mb-2.5">Yeni Görev Formu</p>
      <div className="space-y-2">
        <div className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-[11px] text-slate-600 bg-slate-50">
          ATK Entegrasyon Modülü Testi
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          <div className="border border-slate-200 rounded-lg px-2 py-1.5 text-[10px] text-slate-500 bg-slate-50">
            Ayşe Yılmaz (22h/70h)
          </div>
          <div className="border border-slate-200 rounded-lg px-2 py-1.5 text-[10px] text-slate-500 bg-slate-50">
            Albaraka (ATK)
          </div>
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          <div className="border border-slate-200 rounded-lg px-2 py-1.5 text-[10px] text-slate-500 bg-slate-50">
            Sprint 24
          </div>
          <div className="border border-slate-200 rounded-lg px-2 py-1.5 text-[10px] text-slate-500 bg-slate-50">
            16h • Medium
          </div>
        </div>
      </div>
    </div>
  </div>
);

const CreationOptionVisual = () => (
  <div className="flex flex-col gap-2 max-w-xs mx-auto">
    <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm">
      <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-1">
        <ExternalLink className="h-3 w-3" />Görev Oluşturma Seçeneği
      </p>
      <div className="flex gap-1.5">
        <div className="flex-1 flex items-center justify-center py-2 px-2 rounded-lg border-2 border-slate-200 text-[10px] font-medium text-slate-500">
          Sadece Yerel
        </div>
        <div className="flex-1 flex items-center justify-center py-2 px-2 rounded-lg border-2 border-blue-500 bg-blue-50 text-[10px] font-semibold text-blue-700">
          Sadece Jira
        </div>
        <div className="flex-1 flex items-center justify-center py-2 px-2 rounded-lg border-2 border-slate-200 text-[10px] font-medium text-slate-500">
          Her İkisi
        </div>
      </div>
    </div>
    <div className="grid grid-cols-3 gap-1.5 text-center">
      <div className="bg-slate-50 border border-slate-100 rounded-lg p-2">
        <p className="text-[10px] font-semibold text-slate-600">Sadece Yerel</p>
        <p className="text-[9px] text-slate-400 mt-0.5">Tarayıcıda saklanır, Jira etkilenmez</p>
      </div>
      <div className="bg-blue-50 border border-blue-100 rounded-lg p-2">
        <p className="text-[10px] font-semibold text-blue-700">Sadece Jira</p>
        <p className="text-[9px] text-blue-500 mt-0.5">Doğrudan Jira'da görev açılır</p>
      </div>
      <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-2">
        <p className="text-[10px] font-semibold text-emerald-700">Her İkisi</p>
        <p className="text-[9px] text-emerald-500 mt-0.5">Hem Jira hem yerel kaydedilir</p>
      </div>
    </div>
  </div>
);

const AssignmentListVisual = () => (
  <div className="flex flex-col gap-1.5 max-w-sm mx-auto">
    {[
      { title: 'ATK Entegrasyon Testi', assignee: 'Ayşe Y.', project: 'ATK', hours: 16, priority: 'High', priorityColor: 'bg-orange-100 text-orange-700', sprint: 'Sprint 24' },
      { title: 'VK Raporlama Modülü', assignee: 'Can Ö.', project: 'VK', hours: 8, priority: 'Medium', priorityColor: 'bg-blue-100 text-blue-700', sprint: 'Sprint 24' },
    ].map((a, i) => (
      <div key={i} className="bg-white border border-slate-200 rounded-xl px-3 py-2.5 shadow-sm flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-slate-800 truncate">{a.title}</p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-[10px] text-slate-400">{a.assignee}</span>
            <span className="text-slate-300">·</span>
            <span className="text-[10px] font-semibold text-blue-600 bg-blue-50 px-1 rounded">{a.project}</span>
            <span className="text-slate-300">·</span>
            <span className="text-[10px] text-blue-500">{a.sprint}</span>
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <Clock className="h-3 w-3 text-slate-400" />
          <span className="text-[10px] font-bold text-slate-700">{a.hours}h</span>
          <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${a.priorityColor}`}>{a.priority}</span>
          <button className="w-5 h-5 flex items-center justify-center rounded text-slate-300 hover:text-red-400 transition-colors">
            <X className="h-3 w-3" />
          </button>
        </div>
      </div>
    ))}
    <div className="text-center text-[10px] text-slate-400 mt-1">
      Görevler tarayıcıda saklanır • Silmek için × ikonunu kullanın
    </div>
  </div>
);

const WorkflowVisual = () => (
  <div className="flex flex-col gap-2 max-w-xs mx-auto">
    {[
      { step: '1', title: 'Kapasite Özeti\'ni İncele', desc: 'Eksik Yük durumundaki yazılımcıları tespit et', color: 'bg-amber-50 border-amber-200 text-amber-700', dot: 'bg-amber-500' },
      { step: '2', title: 'Yeni Görev Oluştur', desc: '"Yeni Görev" butonuna tıkla, formu doldur', color: 'bg-blue-50 border-blue-200 text-blue-700', dot: 'bg-blue-500' },
      { step: '3', title: 'Yazılımcıya Ata', desc: 'Atanan kişi listesinde saat/kapasite bilgisi görünür', color: 'bg-violet-50 border-violet-200 text-violet-700', dot: 'bg-violet-500' },
      { step: '4', title: 'Jira\'da Görev Aç', desc: '"Sadece Jira" veya "Her İkisi" seçerek senkronize et', color: 'bg-emerald-50 border-emerald-200 text-emerald-700', dot: 'bg-emerald-500' },
    ].map((s, i) => (
      <div key={i} className={`flex items-start gap-2.5 border rounded-xl px-3 py-2 ${s.color}`}>
        <div className={`w-5 h-5 ${s.dot} rounded-full flex items-center justify-center flex-shrink-0 mt-0.5`}>
          <span className="text-[10px] font-bold text-white">{s.step}</span>
        </div>
        <div>
          <p className="text-[11px] font-semibold leading-tight">{s.title}</p>
          <p className="text-[10px] opacity-80 mt-0.5">{s.desc}</p>
        </div>
      </div>
    ))}
  </div>
);

/* ─── Adım tanımları ─────────────────────────────────────── */

const STEPS: OnboardingStep[] = [
  {
    id: 1,
    icon: <BarChart2 className="h-5 w-5" />,
    tag: 'Sayfanın Amacı',
    title: 'Eksik Yükü Olan Yazılımcıya Görev Atama',
    description:
      'Bu sayfa; Jira sprint verilerinden hesaplanan analist tahmin toplamını, izin düşürülmüş kapasiteyle kıyaslayarak "Eksik Yük" olan yazılımcıları tespit eder. Ardından bu yazılımcılara doğrudan Jira\'da veya yerel olarak yeni görev açabilirsiniz.',
    visual: <WorkflowVisual />,
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
    tag: 'Kapasite Özeti',
    title: 'Yazılımcı Kapasite Tablosu',
    description:
      'Tabloda her yazılımcının analist tahmini, izin düşürülmüş kapasitesi ve doluluk oranı gösterilir. KolayIK entegrasyonu aktifse izin günleri kapasitenin otomatik düşürülmesini sağlar; bu sayede izinli geliştirici haksız yere "Eksik Yük" görünmez.',
    visual: <CapacityTableVisual />,
    color: {
      tag: 'bg-violet-100 text-violet-700',
      icon: 'text-violet-600',
      iconBg: 'bg-violet-50',
      border: 'border-violet-100',
    },
  },
  {
    id: 3,
    icon: <Plus className="h-5 w-5" />,
    tag: 'Görev Formu',
    title: 'Yeni Görev Nasıl Oluşturulur?',
    description:
      'Sağ üstteki "Yeni Görev" butonuna tıkladığınızda form açılır. Başlık, atanan kişi, proje ve tahmini süre zorunludur. Proje seçilince o projeye ait aktif sprintler otomatik yüklenir, atanan kişi listesinde her yazılımcının mevcut yükü de gösterilir.',
    visual: <NewTaskVisual />,
    color: {
      tag: 'bg-emerald-100 text-emerald-700',
      icon: 'text-emerald-600',
      iconBg: 'bg-emerald-50',
      border: 'border-emerald-100',
    },
  },
  {
    id: 4,
    icon: <ExternalLink className="h-5 w-5" />,
    tag: 'Jira Entegrasyonu',
    title: '3 Farklı Oluşturma Seçeneği',
    description:
      '"Sadece Yerel" seçeneği görevi yalnızca tarayıcıda saklar. "Sadece Jira" seçeneği doğrudan Jira\'da issue açar ve Jira issue key\'ini döner. "Her İkisinde" seçeneği ise aynı anda hem Jira\'da issue oluşturur hem de yerel listeye kaydeder.',
    visual: <CreationOptionVisual />,
    color: {
      tag: 'bg-amber-100 text-amber-700',
      icon: 'text-amber-600',
      iconBg: 'bg-amber-50',
      border: 'border-amber-100',
    },
  },
  {
    id: 5,
    icon: <Save className="h-5 w-5" />,
    tag: 'Görev Listesi',
    title: 'Manuel Atanan Görevler',
    description:
      'Yerel kaydedilen görevler sayfanın altındaki tabloda listelenir; görev adı, atanan kişi, proje, sprint, tahmini süre ve öncelik görünür. Satır sonundaki × ikonuyla görev silinebilir. Bu liste yalnızca tarayıcıda saklanır, sayfa yenilense de kaybolmaz.',
    visual: <AssignmentListVisual />,
    color: {
      tag: 'bg-slate-100 text-slate-700',
      icon: 'text-slate-600',
      iconBg: 'bg-slate-100',
      border: 'border-slate-200',
    },
  },
];

/* ─── Ana bileşen ─────────────────────────────────────────── */

const STORAGE_KEY = 'onboarding_manual_task_seen';

const ManualTaskOnboarding: React.FC<ManualTaskOnboardingProps> = ({ isOpen, onClose }) => {
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
              <span className="text-sm font-semibold text-white">Jira'da İş Açma — Hızlı Başlangıç</span>
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

export const useManualTaskOnboarding = () => {
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

export default ManualTaskOnboarding; 