import React, { useState, useEffect } from 'react';
import { X, CheckCircle, XCircle, Loader2, AlertTriangle, ExternalLink } from 'lucide-react';
import { registrationService, CompanyRegistrationData } from '../lib/registrationService';
import { useAuth } from '../context/AuthContext';

interface RegistrationModalProps {
  onClose: () => void;
  onSwitchToLogin?: () => void;
}

type LoadingStep = 'idle' | 'validating' | 'registering';

interface ValidationError {
  title: string;
  description: string;
  hint?: string;
  hintLink?: { label: string; url: string };
}

export const RegistrationModal: React.FC<RegistrationModalProps> = ({ onClose, onSwitchToLogin }) => {
  const { login, isAuthenticated } = useAuth();
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState<LoadingStep>('idle');
  const [validationError, setValidationError] = useState<ValidationError | null>(null);
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [formData, setFormData] = useState<CompanyRegistrationData>({
    companyName: '',
    companyEmail: '',
    firstName: '',
    lastName: '',
    userEmail: '',
    password: '',
    jiraEmail: '',
    jiraApiToken: '',
    jiraBaseUrl: '',
    kolayikApiToken: '',
    kolayikBaseUrl: 'https://api.kolayik.com/v2'
  });

  useEffect(() => {
    if (isAuthenticated) {
      onClose();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setValidationError(null);
    setGeneralError(null);
  };

  const validateJiraConnection = async (): Promise<boolean> => {
    // jira-proxy, şirket bilgilerini DB'den çekiyor ama kayıt öncesinde
    // DB'de henüz şirket yok. Bu yüzden direkt Jira'ya Basic Auth ile
    // istek atıyoruz — bu sefer tarayıcıdan değil, jira-proxy üzerinden
    // body'de credentials gönderip /rest/api/3/myself'i proxy'liyoruz.
    //
    // jira-proxy'nin çalışma şekli:
    //   { endpoint, method, body } + x-company-id header'ı ile çağrılıyor.
    //
    // Kayıt öncesi doğrulama için özel bir "temp" modu kullanıyoruz:
    // x-company-id yerine x-jira-credentials header'ı ile credentials
    // doğrudan gönderiyoruz. Bunun için jira-proxy'ye küçük bir ekleme lazım.
    //
    // EN KOLAY ÇÖZÜM: jira-proxy'den bağımsız, sadece doğrulama için
    // Supabase'in built-in fetch'ini kullanan ayrı bir fonksiyon.
    // Ama mevcut jira-proxy'yi bozmamak için burada direkt fetch yapıyoruz
    // ve CORS sorununu aşmak için credentials'ı proxy üzerinden gönderiyoruz.

    try {
      const credentials = btoa(`${formData.jiraEmail}:${formData.jiraApiToken}`);

      // jira-proxy'ye özel endpoint ile istek at
      // x-company-id olarak "registration-check" gönderiyoruz,
      // proxy bunu bulamayacak — bu yüzden jira-proxy'ye bir ekleme yapıyoruz (aşağıda açıklandı)
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/jira-proxy`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'x-jira-validate': 'true',                    // doğrulama modu
            'x-jira-base-url': formData.jiraBaseUrl,      // direkt credentials
            'x-jira-credentials': credentials,            // base64 email:token
          },
          body: JSON.stringify({
            endpoint: '/rest/api/3/myself',
            method: 'GET',
          }),
        }
      );

      if (res.ok) return true;

      const data = await res.json();
      const errorMessage: string = data?.error || '';

      if (errorMessage.includes('401') || errorMessage.includes('Authentication Failed')) {
        setValidationError({
          title: 'Kimlik doğrulama başarısız',
          description: 'Jira e-posta adresiniz veya API token\'ınız hatalı.',
          hint: 'API token\'ınızı Atlassian hesabınızdan yeniden oluşturmayı deneyin.',
          hintLink: {
            label: 'API token oluştur →',
            url: 'https://id.atlassian.com/manage-profile/security/api-tokens',
          },
        });
      } else if (errorMessage.includes('403') || errorMessage.includes('Forbidden')) {
        setValidationError({
          title: 'Erişim izni reddedildi',
          description: 'API token\'ınızın bu işlem için yeterli yetkisi yok.',
          hint: 'Token oluştururken tüm izinlerin verildiğinden emin olun.',
        });
      } else if (errorMessage.includes('404') || errorMessage.includes('Not Found')) {
        setValidationError({
          title: 'Jira adresi bulunamadı',
          description: `"${formData.jiraBaseUrl}" adresine ulaşılamıyor.`,
          hint: 'Base URL\'nin https://sirketadi.atlassian.net formatında olduğundan emin olun.',
        });
      } else {
        setValidationError({
          title: 'Jira bağlantısı başarısız',
          description: errorMessage || 'Jira sunucusundan beklenmedik bir yanıt alındı.',
          hint: 'Bilgilerinizi kontrol edip tekrar deneyin.',
        });
      }
      return false;
    } catch {
      setValidationError({
        title: "Jira'ya ulaşılamıyor",
        description: 'Doğrulama servisiyle bağlantı kurulamadı.',
        hint: 'İnternet bağlantınızı kontrol edip tekrar deneyin.',
      });
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setValidationError(null);
    setGeneralError(null);

    // 1. ADIM: Jira doğrulama
    setLoadingStep('validating');
    const isValid = await validateJiraConnection();
    if (!isValid) {
      setLoading(false);
      setLoadingStep('idle');
      return;
    }

    // 2. ADIM: Hesap oluştur
    setLoadingStep('registering');
    try {
      const result = await registrationService.registerCompany(formData);
      if (!result.success) {
        setGeneralError(result.error || 'Kayıt işlemi başarısız oldu');
        setLoading(false);
        setLoadingStep('idle');
        return;
      }
      await login({ email: formData.userEmail, password: formData.password });
    } catch (err) {
      setGeneralError(err instanceof Error ? err.message : 'Bir hata oluştu');
      setLoading(false);
      setLoadingStep('idle');
    }
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && !loading) onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[999] bg-gray-900/45 backdrop-blur-sm flex items-center justify-center p-5"
      onClick={handleOverlayClick}
    >
      <div className="bg-white rounded-3xl w-full max-w-[520px] shadow-2xl max-h-[92vh] overflow-y-auto relative animate-in fade-in zoom-in-95 duration-300">

        {/* ── Loading Overlay ── */}
        {loading && (
          <div className="absolute inset-0 z-10 bg-white/95 backdrop-blur-sm rounded-3xl flex flex-col items-center justify-center gap-5 p-10">
            <div className="relative flex items-center justify-center w-20 h-20">
              <svg className="absolute inset-0 w-full h-full animate-spin" viewBox="0 0 80 80">
                <circle cx="40" cy="40" r="34" fill="none" stroke="#e0e7ff" strokeWidth="5" />
                <circle cx="40" cy="40" r="34" fill="none" stroke="#2563eb" strokeWidth="5" strokeLinecap="round" strokeDasharray="60 154" />
              </svg>
              <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center">
                <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
              </div>
            </div>

            <div className="flex flex-col items-center gap-1.5 text-center">
              <p className="text-base font-bold text-gray-900">
                {loadingStep === 'validating' ? 'Entegrasyon bilgileri kontrol ediliyor' : 'Hesabınız oluşturuluyor'}
              </p>
              <p className="text-sm text-gray-500">
                {loadingStep === 'validating'
                  ? 'Jira bağlantınız doğrulanıyor, lütfen bekleyin...'
                  : 'Bilgileriniz kaydediliyor, neredeyse bitti!'}
              </p>
            </div>

            <div className="flex items-center gap-2 mt-1">
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                loadingStep === 'validating' ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30' : 'bg-green-100 text-green-700'
              }`}>
                {loadingStep === 'validating' ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />}
                <span>Jira Doğrulama</span>
              </div>
              <div className="w-6 h-px bg-gray-200" />
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                loadingStep === 'registering' ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30' : 'bg-gray-100 text-gray-400'
              }`}>
                {loadingStep === 'registering' && <Loader2 className="w-3 h-3 animate-spin" />}
                <span>Hesap Oluşturma</span>
              </div>
            </div>
          </div>
        )}

        <div className="p-10">
          {!loading && (
            <button onClick={onClose} className="absolute top-5 right-5 w-8 h-8 rounded-full bg-gray-100 border-[1.5px] border-gray-300 flex items-center justify-center text-gray-600 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-600 transition-all">
              <X className="w-4 h-4" />
            </button>
          )}

          <div className="mb-7">
            <h2 className="text-2xl font-extrabold text-gray-900 mb-1.5">Devbord'a Katılın 🚀</h2>
            <p className="text-sm text-gray-600">Dakikalar içinde entegrasyonunuzu tamamlayın</p>
          </div>

          {/* ── Jira Doğrulama Hatası ── */}
          {validationError && (
            <div className="mb-6 rounded-xl border border-red-200 bg-red-50 overflow-hidden">
              <div className="flex items-center gap-2.5 px-4 py-3 bg-red-100 border-b border-red-200">
                <div className="w-7 h-7 rounded-full bg-red-500 flex items-center justify-center flex-shrink-0">
                  <XCircle className="w-4 h-4 text-white" />
                </div>
                <p className="text-sm font-bold text-red-800">Jira Bağlantısı Başarısız</p>
              </div>
              <div className="px-4 py-3.5 space-y-2">
                <p className="text-[0.88rem] font-semibold text-red-900">{validationError.title}</p>
                <p className="text-[0.83rem] text-red-700 leading-relaxed">{validationError.description}</p>
                {validationError.hint && (
                  <div className="flex items-start gap-2 pt-0.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-500 mt-0.5 flex-shrink-0" />
                    <p className="text-[0.8rem] text-gray-600 leading-relaxed">{validationError.hint}</p>
                  </div>
                )}
                {validationError.hintLink && (
                  <a href={validationError.hintLink.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[0.8rem] font-semibold text-blue-600 hover:underline mt-0.5">
                    <ExternalLink className="w-3 h-3" />
                    {validationError.hintLink.label}
                  </a>
                )}
              </div>
            </div>
          )}

          {/* ── Genel Hata ── */}
          {generalError && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
              {generalError}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {/* Şirket Bilgileri */}
            <div className="mb-6">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-blue-600 mb-3.5">
                <span>Şirket Bilgileri</span>
                <div className="flex-1 h-px bg-gray-200" />
              </div>
              <div>
                <label className="block text-[0.82rem] font-semibold text-gray-900 mb-1.5">Şirket Adı</label>
                <input type="text" name="companyName" value={formData.companyName} onChange={handleChange} required
                  className="w-full px-3.5 py-2.5 border-[1.5px] border-gray-300 rounded-lg text-sm text-gray-900 bg-gray-50 focus:border-blue-600 focus:bg-white focus:ring-4 focus:ring-blue-600/10 outline-none transition-all"
                  placeholder="Coding Technology" />
              </div>
            </div>

            {/* Hesap Bilgileri */}
            <div className="mb-6">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-blue-600 mb-3.5">
                <span>Hesap Bilgileri</span>
                <div className="flex-1 h-px bg-gray-200" />
              </div>
              <div className="grid grid-cols-2 gap-3 mb-3.5">
                <div>
                  <label className="block text-[0.82rem] font-semibold text-gray-900 mb-1.5">Ad</label>
                  <input type="text" name="firstName" value={formData.firstName} onChange={handleChange} required
                    className="w-full px-3.5 py-2.5 border-[1.5px] border-gray-300 rounded-lg text-sm text-gray-900 bg-gray-50 focus:border-blue-600 focus:bg-white focus:ring-4 focus:ring-blue-600/10 outline-none transition-all"
                    placeholder="Can" />
                </div>
                <div>
                  <label className="block text-[0.82rem] font-semibold text-gray-900 mb-1.5">Soyad</label>
                  <input type="text" name="lastName" value={formData.lastName} onChange={handleChange} required
                    className="w-full px-3.5 py-2.5 border-[1.5px] border-gray-300 rounded-lg text-sm text-gray-900 bg-gray-50 focus:border-blue-600 focus:bg-white focus:ring-4 focus:ring-blue-600/10 outline-none transition-all"
                    placeholder="Bağcı" />
                </div>
              </div>
              <div className="space-y-3.5">
                <div>
                  <label className="block text-[0.82rem] font-semibold text-gray-900 mb-1.5">E-posta</label>
                  <input type="email" name="userEmail" value={formData.userEmail} onChange={handleChange} required
                    className="w-full px-3.5 py-2.5 border-[1.5px] border-gray-300 rounded-lg text-sm text-gray-900 bg-gray-50 focus:border-blue-600 focus:bg-white focus:ring-4 focus:ring-blue-600/10 outline-none transition-all"
                    placeholder="can@acer.com" />
                </div>
                <div>
                  <label className="block text-[0.82rem] font-semibold text-gray-900 mb-1.5">Şifre</label>
                  <input type="password" name="password" value={formData.password} onChange={handleChange} required minLength={6}
                    className="w-full px-3.5 py-2.5 border-[1.5px] border-gray-300 rounded-lg text-sm text-gray-900 bg-gray-50 focus:border-blue-600 focus:bg-white focus:ring-4 focus:ring-blue-600/10 outline-none transition-all"
                    placeholder="En az 6 karakter" />
                </div>
              </div>
            </div>

            {/* Jira Entegrasyonu */}
            <div className="mb-6">
              <div className={`flex items-center gap-2 text-xs font-bold uppercase tracking-wider mb-3.5 transition-colors ${validationError ? 'text-red-500' : 'text-blue-600'}`}>
                <span>Jira Entegrasyonu</span>
                {validationError && <XCircle className="w-3.5 h-3.5" />}
                <div className={`flex-1 h-px ${validationError ? 'bg-red-200' : 'bg-gray-200'}`} />
              </div>
              <div className="space-y-3.5">
                <div>
                  <label className="block text-[0.82rem] font-semibold text-gray-900 mb-1.5">Jira E-posta</label>
                  <input type="email" name="jiraEmail" value={formData.jiraEmail} onChange={handleChange} required
                    className={`w-full px-3.5 py-2.5 border-[1.5px] rounded-lg text-sm text-gray-900 bg-gray-50 focus:bg-white focus:ring-4 outline-none transition-all ${validationError ? 'border-red-300 focus:border-red-400 focus:ring-red-500/10' : 'border-gray-300 focus:border-blue-600 focus:ring-blue-600/10'}`}
                    placeholder="jira-kullanici@acme.com" />
                  <div className="text-xs text-gray-600 mt-1.5">Jira hesabınıza kayıtlı e-posta adresi</div>
                </div>
                <div>
                  <label className="block text-[0.82rem] font-semibold text-gray-900 mb-1.5">Jira API Token</label>
                  <input type="password" name="jiraApiToken" value={formData.jiraApiToken} onChange={handleChange} required
                    className={`w-full px-3.5 py-2.5 border-[1.5px] rounded-lg text-sm text-gray-900 bg-gray-50 focus:bg-white focus:ring-4 outline-none transition-all ${validationError ? 'border-red-300 focus:border-red-400 focus:ring-red-500/10' : 'border-gray-300 focus:border-blue-600 focus:ring-blue-600/10'}`}
                    placeholder="••••••••••••••••••••" />
                  <div className="text-xs text-gray-600 mt-1.5">
                    <a href="https://id.atlassian.com/manage-profile/security/api-tokens" target="_blank" rel="noopener noreferrer" className="text-blue-600 no-underline hover:underline">Atlassian hesabınızdan</a> token oluşturabilirsiniz
                  </div>
                </div>
                <div>
                  <label className="block text-[0.82rem] font-semibold text-gray-900 mb-1.5">Jira Base URL</label>
                  <input type="url" name="jiraBaseUrl" value={formData.jiraBaseUrl} onChange={handleChange} required
                    className={`w-full px-3.5 py-2.5 border-[1.5px] rounded-lg text-sm text-gray-900 bg-gray-50 focus:bg-white focus:ring-4 outline-none transition-all ${validationError ? 'border-red-300 focus:border-red-400 focus:ring-red-500/10' : 'border-gray-300 focus:border-blue-600 focus:ring-blue-600/10'}`}
                    placeholder="https://sirketadi.atlassian.net" />
                  <div className="text-xs text-gray-600 mt-1.5">Örn: https://sirketadi.atlassian.net</div>
                </div>
              </div>
            </div>

            {/* Kolay İK */}
            <div className="mb-6">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-blue-600 mb-3.5">
                <span>Kolay İK Entegrasyonu</span>
                <span className="text-[0.7rem] text-gray-400 font-normal normal-case tracking-normal ml-1.5">İsteğe bağlı</span>
                <div className="flex-1 h-px bg-gray-200" />
              </div>
              <div className="space-y-3.5">
                <div>
                  <label className="block text-[0.82rem] font-semibold text-gray-900 mb-1.5">
                    Kolay İK API Token <span className="text-gray-400 font-normal">(opsiyonel)</span>
                  </label>
                  <input type="password" name="kolayikApiToken" value={formData.kolayikApiToken} onChange={handleChange}
                    className="w-full px-3.5 py-2.5 border-[1.5px] border-gray-300 rounded-lg text-sm text-gray-900 bg-gray-50 focus:border-blue-600 focus:bg-white focus:ring-4 focus:ring-blue-600/10 outline-none transition-all"
                    placeholder="••••••••••••••••••••" />
                  <div className="text-xs text-gray-600 mt-1.5">Kolay İK panel → Ayarlar → API bölümünden alabilirsiniz</div>
                </div>
                <div>
                  <label className="block text-[0.82rem] font-semibold text-gray-900 mb-1.5">Kolay İK Base URL</label>
                  <input type="url" name="kolayikBaseUrl" value={formData.kolayikBaseUrl} onChange={handleChange}
                    className="w-full px-3.5 py-2.5 border-[1.5px] border-gray-300 rounded-lg text-sm text-gray-900 bg-gray-50 focus:border-blue-600 focus:bg-white focus:ring-4 focus:ring-blue-600/10 outline-none transition-all"
                    placeholder="https://api.kolayik.com/v2" />
                  <div className="text-xs text-gray-600 mt-1.5">Varsayılan: https://api.kolayik.com/v2</div>
                </div>
              </div>
            </div>

            <button type="submit" disabled={loading}
              className="w-full py-3 rounded-xl text-[0.95rem] font-bold text-white bg-blue-600 hover:bg-blue-700 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-blue-600/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-2">
              Hesap Oluştur ve Başla →
            </button>

            <div className="text-center mt-4 text-[0.83rem] text-gray-600">
              Zaten hesabınız var mı?{' '}
              <button type="button" onClick={onSwitchToLogin ?? onClose} className="text-blue-600 font-semibold no-underline hover:underline">
                Giriş yapın
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};