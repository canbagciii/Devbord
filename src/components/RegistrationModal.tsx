import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { registrationService, CompanyRegistrationData } from '../lib/registrationService';
import { useAuth } from '../context/AuthContext';

interface RegistrationModalProps {
  onClose: () => void;
}

export const RegistrationModal: React.FC<RegistrationModalProps> = ({ onClose }) => {
  const { login, isAuthenticated } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
    kolayikBaseUrl: ''
  });

  useEffect(() => {
    if (isAuthenticated) {
      onClose();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const result = await registrationService.registerCompany(formData);

      if (!result.success) {
        setError(result.error || 'Kayıt işlemi başarısız oldu');
        setLoading(false);
        return;
      }

      await login({
        email: formData.userEmail,
        password: formData.password
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bir hata oluştu');
      setLoading(false);
    }
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-[999] bg-gray-900/45 backdrop-blur-sm flex items-center justify-center p-5"
      onClick={handleOverlayClick}
    >
      <div className="bg-white rounded-3xl w-full max-w-[520px] shadow-2xl p-10 max-h-[92vh] overflow-y-auto relative animate-in fade-in zoom-in-95 duration-300">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 w-8 h-8 rounded-full bg-gray-100 border-[1.5px] border-gray-300 flex items-center justify-center text-gray-600 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-600 transition-all"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="mb-7">
          <h2 className="text-2xl font-extrabold text-gray-900 mb-1.5">DevPulse'a Katılın 🚀</h2>
          <p className="text-sm text-gray-600">Dakikalar içinde entegrasyonunuzu tamamlayın</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="mb-6">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-blue-600 mb-3.5">
              <span>Şirket Bilgileri</span>
              <div className="flex-1 h-px bg-gray-200" />
            </div>
            <div className="space-y-3.5">
              <div>
                <label className="block text-[0.82rem] font-semibold text-gray-900 mb-1.5">Şirket Adı</label>
                <input
                  type="text"
                  name="companyName"
                  value={formData.companyName}
                  onChange={handleChange}
                  required
                  className="w-full px-3.5 py-2.5 border-[1.5px] border-gray-300 rounded-lg text-sm text-gray-900 bg-gray-50 focus:border-blue-600 focus:bg-white focus:ring-4 focus:ring-blue-600/10 outline-none transition-all"
                  placeholder="Acme Technology"
                />
              </div>
              <div>
                <label className="block text-[0.82rem] font-semibold text-gray-900 mb-1.5">Şirket E-postası</label>
                <input
                  type="email"
                  name="companyEmail"
                  value={formData.companyEmail}
                  onChange={handleChange}
                  required
                  className="w-full px-3.5 py-2.5 border-[1.5px] border-gray-300 rounded-lg text-sm text-gray-900 bg-gray-50 focus:border-blue-600 focus:bg-white focus:ring-4 focus:ring-blue-600/10 outline-none transition-all"
                  placeholder="info@acme.com"
                />
              </div>
            </div>
          </div>

          <div className="mb-6">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-blue-600 mb-3.5">
              <span>Hesap Bilgileri</span>
              <div className="flex-1 h-px bg-gray-200" />
            </div>
            <div className="grid grid-cols-2 gap-3 mb-3.5">
              <div>
                <label className="block text-[0.82rem] font-semibold text-gray-900 mb-1.5">Ad</label>
                <input
                  type="text"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleChange}
                  required
                  className="w-full px-3.5 py-2.5 border-[1.5px] border-gray-300 rounded-lg text-sm text-gray-900 bg-gray-50 focus:border-blue-600 focus:bg-white focus:ring-4 focus:ring-blue-600/10 outline-none transition-all"
                  placeholder="Ahmet"
                />
              </div>
              <div>
                <label className="block text-[0.82rem] font-semibold text-gray-900 mb-1.5">Soyad</label>
                <input
                  type="text"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleChange}
                  required
                  className="w-full px-3.5 py-2.5 border-[1.5px] border-gray-300 rounded-lg text-sm text-gray-900 bg-gray-50 focus:border-blue-600 focus:bg-white focus:ring-4 focus:ring-blue-600/10 outline-none transition-all"
                  placeholder="Kaya"
                />
              </div>
            </div>
            <div className="space-y-3.5">
              <div>
                <label className="block text-[0.82rem] font-semibold text-gray-900 mb-1.5">E-posta</label>
                <input
                  type="email"
                  name="userEmail"
                  value={formData.userEmail}
                  onChange={handleChange}
                  required
                  className="w-full px-3.5 py-2.5 border-[1.5px] border-gray-300 rounded-lg text-sm text-gray-900 bg-gray-50 focus:border-blue-600 focus:bg-white focus:ring-4 focus:ring-blue-600/10 outline-none transition-all"
                  placeholder="ahmet@acme.com"
                />
              </div>
              <div>
                <label className="block text-[0.82rem] font-semibold text-gray-900 mb-1.5">Şifre</label>
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  required
                  minLength={6}
                  className="w-full px-3.5 py-2.5 border-[1.5px] border-gray-300 rounded-lg text-sm text-gray-900 bg-gray-50 focus:border-blue-600 focus:bg-white focus:ring-4 focus:ring-blue-600/10 outline-none transition-all"
                  placeholder="En az 6 karakter"
                />
              </div>
            </div>
          </div>

          <div className="mb-6">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-blue-600 mb-3.5">
              <span>Jira Entegrasyonu</span>
              <div className="flex-1 h-px bg-gray-200" />
            </div>
            <div className="space-y-3.5">
              <div>
                <label className="block text-[0.82rem] font-semibold text-gray-900 mb-1.5">Jira E-posta</label>
                <input
                  type="email"
                  name="jiraEmail"
                  value={formData.jiraEmail}
                  onChange={handleChange}
                  required
                  className="w-full px-3.5 py-2.5 border-[1.5px] border-gray-300 rounded-lg text-sm text-gray-900 bg-gray-50 focus:border-blue-600 focus:bg-white focus:ring-4 focus:ring-blue-600/10 outline-none transition-all"
                  placeholder="jira-kullanici@acme.com"
                />
                <div className="text-xs text-gray-600 mt-1.5">Jira hesabınıza kayıtlı e-posta adresi</div>
              </div>
              <div>
                <label className="block text-[0.82rem] font-semibold text-gray-900 mb-1.5">Jira API Token</label>
                <input
                  type="password"
                  name="jiraApiToken"
                  value={formData.jiraApiToken}
                  onChange={handleChange}
                  required
                  className="w-full px-3.5 py-2.5 border-[1.5px] border-gray-300 rounded-lg text-sm text-gray-900 bg-gray-50 focus:border-blue-600 focus:bg-white focus:ring-4 focus:ring-blue-600/10 outline-none transition-all"
                  placeholder="••••••••••••••••••••"
                />
                <div className="text-xs text-gray-600 mt-1.5">
                  <a href="https://id.atlassian.com/manage-profile/security/api-tokens" target="_blank" rel="noopener noreferrer" className="text-blue-600 no-underline hover:underline">Atlassian hesabınızdan</a> token oluşturabilirsiniz
                </div>
              </div>
              <div>
                <label className="block text-[0.82rem] font-semibold text-gray-900 mb-1.5">Jira Base URL</label>
                <input
                  type="url"
                  name="jiraBaseUrl"
                  value={formData.jiraBaseUrl}
                  onChange={handleChange}
                  required
                  className="w-full px-3.5 py-2.5 border-[1.5px] border-gray-300 rounded-lg text-sm text-gray-900 bg-gray-50 focus:border-blue-600 focus:bg-white focus:ring-4 focus:ring-blue-600/10 outline-none transition-all"
                  placeholder="https://acme.atlassian.net"
                />
                <div className="text-xs text-gray-600 mt-1.5">Örn: https://acme.atlassian.net</div>
              </div>
            </div>
          </div>

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
                <input
                  type="password"
                  name="kolayikApiToken"
                  value={formData.kolayikApiToken}
                  onChange={handleChange}
                  className="w-full px-3.5 py-2.5 border-[1.5px] border-gray-300 rounded-lg text-sm text-gray-900 bg-gray-50 focus:border-blue-600 focus:bg-white focus:ring-4 focus:ring-blue-600/10 outline-none transition-all"
                  placeholder="••••••••••••••••••••"
                />
                <div className="text-xs text-gray-600 mt-1.5">Kolay İK panel → Ayarlar → API bölümünden alabilirsiniz</div>
              </div>
              <div>
                <label className="block text-[0.82rem] font-semibold text-gray-900 mb-1.5">
                  Kolay İK Base URL <span className="text-gray-400 font-normal">(opsiyonel)</span>
                </label>
                <input
                  type="url"
                  name="kolayikBaseUrl"
                  value={formData.kolayikBaseUrl}
                  onChange={handleChange}
                  className="w-full px-3.5 py-2.5 border-[1.5px] border-gray-300 rounded-lg text-sm text-gray-900 bg-gray-50 focus:border-blue-600 focus:bg-white focus:ring-4 focus:ring-blue-600/10 outline-none transition-all"
                  placeholder="https://api.kolayik.com/v2"
                />
                <div className="text-xs text-gray-600 mt-1.5">Kolay İK API dökümantasyonunuzdan edinebilirsiniz</div>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl text-[0.95rem] font-bold text-white bg-blue-600 hover:bg-blue-700 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-blue-600/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-2"
          >
            {loading ? 'Hesap Oluşturuluyor...' : 'Hesap Oluştur ve Başla →'}
          </button>

          <div className="text-center mt-4 text-[0.83rem] text-gray-600">
            Zaten hesabınız var mı? <button type="button" onClick={onClose} className="text-blue-600 font-semibold no-underline hover:underline">Giriş yapın</button>
          </div>
        </form>
      </div>
    </div>
  );
};
