import React, { useState, useEffect } from 'react';
import {
  X,
  Users,
  Shield,
  Eye,
  Settings,
  CheckCircle,
  ChevronLeft,
  UserPlus,
  UserX,
  Sparkles,
  ArrowRight,
  Building,
  Search,
  Filter,
  Trash2,
  Key,
  Mail
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

interface UserManagementOnboardingProps {
  isOpen: boolean;
  onClose: () => void;
}

/* ─── Mini görseller ─────────────────────────────────────── */

const StatsVisual = () => (
  <div className="grid grid-cols-3 gap-1.5">
    {[
      { label: 'Toplam', value: '12', color: 'text-slate-700', bg: 'bg-slate-50', icon: <Users className="h-3.5 w-3.5" /> },
      { label: 'Aktif', value: '10', color: 'text-emerald-600', bg: 'bg-emerald-50', icon: <CheckCircle className="h-3.5 w-3.5" /> },
      { label: 'Pasif', value: '2', color: 'text-red-600', bg: 'bg-red-50', icon: <UserX className="h-3.5 w-3.5" /> },
      { label: 'Yönetici', value: '2', color: 'text-red-600', bg: 'bg-red-50', icon: <Shield className="h-3.5 w-3.5" /> },
      { label: 'Analist', value: '3', color: 'text-blue-600', bg: 'bg-blue-50', icon: <Eye className="h-3.5 w-3.5" /> },
      { label: 'Yazılımcı', value: '7', color: 'text-emerald-600', bg: 'bg-emerald-50', icon: <Settings className="h-3.5 w-3.5" /> },
    ].map((c) => (
      <div key={c.label} className={`${c.bg} rounded-xl p-2 flex flex-col items-center gap-1 border border-white shadow-sm`}>
        <span className={c.color}>{c.icon}</span>
        <span className={`text-base font-bold ${c.color}`}>{c.value}</span>
        <span className="text-[9px] text-slate-500 text-center leading-tight">{c.label}</span>
      </div>
    ))}
  </div>
);

const RolesVisual = () => (
  <div className="flex flex-col gap-2 max-w-xs mx-auto">
    {[
      {
        role: 'Yönetici',
        icon: <Shield className="h-4 w-4" />,
        color: 'text-red-600',
        bg: 'bg-red-50',
        border: 'border-red-200',
        badge: 'bg-red-100 text-red-800',
        desc: 'Tüm projelere ve verilere tam erişim. Kullanıcı yönetimi yapabilir.',
      },
      {
        role: 'Analist',
        icon: <Eye className="h-4 w-4" />,
        color: 'text-blue-600',
        bg: 'bg-blue-50',
        border: 'border-blue-200',
        badge: 'bg-blue-100 text-blue-800',
        desc: 'Atanmış projelerdeki yazılımcıların iş yükü ve worklog verilerini görüntüler.',
      },
      {
        role: 'Yazılımcı',
        icon: <Settings className="h-4 w-4" />,
        color: 'text-emerald-600',
        bg: 'bg-emerald-50',
        border: 'border-emerald-200',
        badge: 'bg-emerald-100 text-emerald-800',
        desc: 'Yalnızca kendi görev ve worklog verilerini görebilir.',
      },
    ].map((r) => (
      <div key={r.role} className={`flex items-start gap-2.5 ${r.bg} border ${r.border} rounded-xl px-3 py-2.5`}>
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${r.badge}`}>
          <span className={r.color}>{r.icon}</span>
        </div>
        <div>
          <span className={`text-[11px] font-bold ${r.color}`}>{r.role}</span>
          <p className="text-[10px] text-slate-500 mt-0.5 leading-tight">{r.desc}</p>
        </div>
      </div>
    ))}
  </div>
);

const UserTableVisual = () => (
  <div className="flex flex-col gap-1.5 max-w-sm mx-auto">
    <div className="grid grid-cols-5 gap-1 px-2 pb-1.5 border-b border-slate-100">
      {['Kullanıcı', 'Rol', 'Projeler', 'Durum', 'İşlem'].map(h => (
        <span key={h} className="text-[9px] font-semibold text-slate-400 uppercase text-center">{h}</span>
      ))}
    </div>
    {[
      { name: 'Ayşe Y.', role: 'Analist', roleColor: 'bg-blue-100 text-blue-700', projects: 'ATK, VK', status: 'Aktif', statusColor: 'bg-emerald-100 text-emerald-700' },
      { name: 'Mehmet K.', role: 'Yazılımcı', roleColor: 'bg-emerald-100 text-emerald-700', projects: 'ATK', status: 'Aktif', statusColor: 'bg-emerald-100 text-emerald-700' },
      { name: 'Zeynep D.', role: 'Yazılımcı', roleColor: 'bg-emerald-100 text-emerald-700', projects: '—', status: 'Pasif', statusColor: 'bg-red-100 text-red-700' },
    ].map((row) => (
      <div key={row.name} className="grid grid-cols-5 gap-1 items-center bg-white border border-slate-100 rounded-lg px-2 py-2">
        <span className="text-[10px] font-semibold text-slate-700 truncate">{row.name}</span>
        <span className={`text-[9px] font-semibold px-1 py-0.5 rounded-full text-center ${row.roleColor}`}>{row.role}</span>
        <span className="text-[9px] text-slate-500 text-center truncate">{row.projects}</span>
        <span className={`text-[9px] font-semibold px-1 py-0.5 rounded-full text-center ${row.statusColor}`}>{row.status}</span>
        <div className="flex justify-center gap-0.5">
          <div className="w-4 h-4 bg-blue-50 rounded flex items-center justify-center">
            <span className="text-[8px] text-blue-500">✏</span>
          </div>
          <div className="w-4 h-4 bg-red-50 rounded flex items-center justify-center">
            <span className="text-[8px] text-red-500">✕</span>
          </div>
        </div>
      </div>
    ))}
  </div>
);

const NewUserFormVisual = () => (
  <div className="flex flex-col gap-2 max-w-xs mx-auto">
    <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm">
      <p className="text-xs font-semibold text-slate-700 mb-2.5">Yeni Kullanıcı Formu</p>
      <div className="space-y-2">
        <div className="grid grid-cols-2 gap-1.5">
          <div className="border border-slate-200 rounded-lg px-2 py-1.5 flex items-center gap-1.5">
            <Users className="h-3 w-3 text-slate-400 flex-shrink-0" />
            <span className="text-[10px] text-slate-500">Ad Soyad</span>
          </div>
          <div className="border border-slate-200 rounded-lg px-2 py-1.5 flex items-center gap-1.5">
            <Mail className="h-3 w-3 text-slate-400 flex-shrink-0" />
            <span className="text-[10px] text-slate-500">E-posta</span>
          </div>
        </div>
        <div className="border border-slate-200 rounded-lg px-2 py-1.5 flex items-center gap-1.5">
          <Key className="h-3 w-3 text-slate-400 flex-shrink-0" />
          <span className="text-[10px] text-slate-500">Şifre (min. 6 karakter)</span>
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {['Yazılımcı', 'Analist', 'Yönetici'].map((r, i) => (
            <div key={r} className={`border-2 rounded-lg px-1.5 py-1.5 text-center text-[9px] font-semibold ${i === 0 ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-400'}`}>
              {r}
            </div>
          ))}
        </div>
      </div>
    </div>
    <div className="bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 text-[10px] text-slate-500 text-center">
      Düzenleme modunda e-posta değiştirilemez, şifre alanı görünmez
    </div>
  </div>
);

const ProjectAssignVisual = () => (
  <div className="flex flex-col gap-2 max-w-xs mx-auto">
    <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm">
      <div className="flex items-center gap-2 mb-2.5">
        <Building className="h-3.5 w-3.5 text-purple-600" />
        <p className="text-xs font-semibold text-slate-700">Proje Atamaları</p>
      </div>
      <div className="grid grid-cols-3 gap-1.5 mb-2.5">
        {[
          { key: 'ATK', name: 'Albaraka', checked: true },
          { key: 'VK', name: 'Vakıf', checked: true },
          { key: 'ZK', name: 'Ziraat', checked: false },
          { key: 'OB', name: 'Odea', checked: false },
          { key: 'BB', name: 'Burgan', checked: true },
          { key: 'QNB', name: 'QNB', checked: false },
        ].map((p) => (
          <div key={p.key} className={`flex items-center gap-1.5 rounded-lg border px-2 py-1.5 ${p.checked ? 'bg-blue-50 border-blue-200' : 'bg-slate-50 border-slate-100'}`}>
            <div className={`w-3 h-3 rounded flex items-center justify-center flex-shrink-0 ${p.checked ? 'bg-blue-500' : 'bg-slate-200'}`}>
              {p.checked && <span className="text-[8px] text-white font-bold">✓</span>}
            </div>
            <div>
              <p className={`text-[9px] font-bold ${p.checked ? 'text-blue-700' : 'text-slate-500'}`}>{p.key}</p>
              <p className="text-[8px] text-slate-400 leading-tight">{p.name}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="bg-blue-50 border border-blue-100 rounded-lg px-2.5 py-1.5 text-[10px] text-blue-700">
        Analist, seçilen projelerdeki yazılımcı verilerini görebilir
      </div>
    </div>
    <div className="bg-purple-50 border border-purple-100 rounded-xl px-3 py-2 text-[10px] text-purple-700 text-center">
      Yönetici rolünde proje ataması gerekmez — tüm projelere erişim vardır
    </div>
  </div>
);

const FilterSearchVisual = () => (
  <div className="flex flex-col gap-2 max-w-xs mx-auto">
    <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm">
      <div className="space-y-2 mb-3">
        <div className="flex items-center gap-2 border border-blue-300 rounded-lg px-2.5 py-1.5 bg-blue-50/50 ring-2 ring-blue-100">
          <Search className="h-3.5 w-3.5 text-blue-500 flex-shrink-0" />
          <span className="text-[11px] text-slate-600">ayşe</span>
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          <div className="border border-slate-200 rounded-lg px-2 py-1.5 flex items-center gap-1.5">
            <Filter className="h-3 w-3 text-slate-400" />
            <span className="text-[10px] text-slate-500">Analist</span>
          </div>
          <div className="border border-slate-200 rounded-lg px-2 py-1.5 flex items-center gap-1.5">
            <CheckCircle className="h-3 w-3 text-emerald-500" />
            <span className="text-[10px] text-slate-500">Aktif</span>
          </div>
        </div>
      </div>
      <div className="bg-white border border-slate-100 rounded-lg px-2.5 py-2 flex items-center gap-2">
        <div className="w-7 h-7 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
          <span className="text-[10px] font-bold text-blue-800">AY</span>
        </div>
        <div>
          <p className="text-xs font-semibold text-slate-700">Ayşe Yılmaz</p>
          <p className="text-[10px] text-slate-400">ayse@acerpro.com.tr</p>
        </div>
        <span className="ml-auto text-[9px] font-semibold bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">Analist</span>
      </div>
    </div>
    <div className="bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 text-[11px] text-slate-500 text-center">
      Ad/e-posta ile arama + rol ve durum filtreleri birlikte çalışır
    </div>
  </div>
);

/* ─── Adım tanımları ─────────────────────────────────────── */

const STEPS: OnboardingStep[] = [
  {
    id: 1,
    icon: <Users className="h-5 w-5" />,
    tag: 'Genel Bakış',
    title: 'Kullanıcı İstatistik Kartları',
    description:
      'Sayfanın üstündeki 6 kart sistem kullanıcılarının anlık özetini gösterir: toplam, aktif, pasif sayıları ile yönetici, analist ve yazılımcı dağılımı. Tüm değerler gerçek zamanlı olarak güncellenir.',
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
    icon: <Shield className="h-5 w-5" />,
    tag: 'Roller',
    title: '3 Kullanıcı Rolü ve Yetkileri',
    description:
      'Sistemde 3 rol bulunur. Yönetici her şeye tam erişim sahibidir ve kullanıcı yönetimi yapabilir. Analist yalnızca atanmış projelerin verilerini görüntüler. Yazılımcı ise sadece kendi görev ve worklog bilgilerini görebilir.',
    visual: <RolesVisual />,
    color: {
      tag: 'bg-red-100 text-red-700',
      icon: 'text-red-600',
      iconBg: 'bg-red-50',
      border: 'border-red-100',
    },
  },
  {
    id: 3,
    icon: <Eye className="h-5 w-5" />,
    tag: 'Kullanıcı Tablosu',
    title: 'Kullanıcı Listesi ve İşlemler',
    description:
      'Tabloda her kullanıcının adı, rolü, atanmış projeleri, aktif/pasif durumu ve kayıt tarihi görünür. Kalem ikonu ile düzenleyebilir, kullanıcı-X ikonu ile deaktif edebilir, yeniden aktifleştirme için yeşil tik, kalıcı silme için çöp kutusu ikonunu kullanabilirsiniz.',
    visual: <UserTableVisual />,
    color: {
      tag: 'bg-violet-100 text-violet-700',
      icon: 'text-violet-600',
      iconBg: 'bg-violet-50',
      border: 'border-violet-100',
    },
  },
  {
    id: 4,
    icon: <UserPlus className="h-5 w-5" />,
    tag: 'Yeni Kullanıcı',
    title: 'Kullanıcı Ekleme ve Düzenleme',
    description:
      'Sağ üstteki "Yeni Kullanıcı" butonuyla form açılır. Ad, e-posta, şifre ve rol zorunlu alanlardır. Düzenleme modunda e-posta değiştirilemez; şifre alanı gizlenir — şifre ancak Supabase üzerinden sıfırlanabilir.',
    visual: <NewUserFormVisual />,
    color: {
      tag: 'bg-emerald-100 text-emerald-700',
      icon: 'text-emerald-600',
      iconBg: 'bg-emerald-50',
      border: 'border-emerald-100',
    },
  },
  {
    id: 5,
    icon: <Building className="h-5 w-5" />,
    tag: 'Proje Ataması',
    title: 'Analist ve Yazılımcı için Proje Erişimi',
    description:
      'Analist veya Yazılımcı rolü seçildiğinde proje seçim paneli açılır. Analist, atandığı projelerdeki yazılımcı verilerini görebilir. Yönetici rolünde panel görünmez çünkü yöneticiler tüm projelere zaten erişebilir.',
    visual: <ProjectAssignVisual />,
    color: {
      tag: 'bg-purple-100 text-purple-700',
      icon: 'text-purple-600',
      iconBg: 'bg-purple-50',
      border: 'border-purple-100',
    },
  },
  {
    id: 6,
    icon: <Search className="h-5 w-5" />,
    tag: 'Arama & Filtre',
    title: 'Kullanıcıları Arama ve Filtreleme',
    description:
      'Ad veya e-posta ile arama yapabilir; rol (Yönetici / Analist / Yazılımcı) ve durum (Aktif / Pasif) filtrelerini birlikte kullanabilirsiniz. Filtreler anlık çalışır, sonuçlar tablosunda yalnızca eşleşen kullanıcılar listelenir.',
    visual: <FilterSearchVisual />,
    color: {
      tag: 'bg-slate-100 text-slate-700',
      icon: 'text-slate-600',
      iconBg: 'bg-slate-100',
      border: 'border-slate-200',
    },
  },
];

/* ─── Ana bileşen ─────────────────────────────────────────── */

const STORAGE_KEY = 'onboarding_user_management_seen';

const UserManagementOnboarding: React.FC<UserManagementOnboardingProps> = ({ isOpen, onClose }) => {
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
              <span className="text-sm font-semibold text-white">Kullanıcı Yönetimi — Hızlı Başlangıç</span>
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

export const useUserManagementOnboarding = () => {
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

export default UserManagementOnboarding;