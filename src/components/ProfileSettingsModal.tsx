import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme, ThemeColor } from '../context/ThemeContext';
import { useUsers } from '../hooks/useUsers';
import { supabase } from '../lib/supabase';
import { X, Save, User, Building2, ExternalLink, Users, Palette } from 'lucide-react';

interface CompanyData {
  id: string;
  name: string;
  email: string;
  jira_email: string;
  jira_api_token: string;
  jira_base_url: string;
  kolayik_base_url: string | null;
  kolayik_api_token: string | null;
}

const MASKED_TOKEN = '••••••••••••';

interface ProfileSettingsModalProps {
  open: boolean;
  onClose: () => void;
}

export const ProfileSettingsModal: React.FC<ProfileSettingsModalProps> = ({ open, onClose }) => {
  const { user, refreshKolayIK } = useAuth();
  const { theme, setTheme } = useTheme();
  const { updateUser } = useUsers();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Profil
  const [profileName, setProfileName] = useState('');
  const [profileEmail, setProfileEmail] = useState('');

  // Şirket
  const [companyName, setCompanyName] = useState('');
  const [companyEmail, setCompanyEmail] = useState('');

  // Jira
  const [jiraEmail, setJiraEmail] = useState('');
  const [jiraApiToken, setJiraApiToken] = useState('');
  const [jiraBaseUrl, setJiraBaseUrl] = useState('');
  const [jiraConnected, setJiraConnected] = useState(false);

  // Kolay İK
  const [kolayikBaseUrl, setKolayikBaseUrl] = useState('');
  const [kolayikApiToken, setKolayikApiToken] = useState('');
  const [kolayikConnected, setKolayikConnected] = useState(false);

  // Token alanlarına odaklanıldığında maske temizlensin (yeni token girişi için)
  const [jiraTokenFocused, setJiraTokenFocused] = useState(false);
  const [kolayikTokenFocused, setKolayikTokenFocused] = useState(false);

  useEffect(() => {
    if (open && user) {
      loadData();
    }
  }, [open, user?.id, user?.companyId]);

  const loadData = async () => {
    if (!user) return;
    setLoading(true);
    setMessage(null);
    setJiraTokenFocused(false);
    setKolayikTokenFocused(false);
    try {
      setProfileName(user.name);
      setProfileEmail(user.email);

      const companyId = user.companyId || localStorage.getItem('companyId');
      if (companyId) {
        const { data: company, error } = await supabase
          .from('companies')
          .select('id, name, email, jira_email, jira_api_token, jira_base_url, kolayik_base_url, kolayik_api_token')
          .eq('id', companyId)
          .single();

        if (!error && company) {
          const c = company as CompanyData;
          setCompanyName(c.name || '');
          setCompanyEmail(c.email || '');
          setJiraEmail(c.jira_email || '');
          setJiraApiToken('');
          setJiraBaseUrl(c.jira_base_url || '');
          setJiraConnected(!!(c.jira_email && c.jira_api_token));
          setKolayikBaseUrl(c.kolayik_base_url || 'https://api.kolayik.com/v2');
          setKolayikApiToken('');
          setKolayikConnected(!!(c.kolayik_api_token && c.kolayik_base_url));
        }
      }
    } catch (e) {
      console.error('Ayarlar yüklenemedi:', e);
      setMessage({ type: 'error', text: 'Veriler yüklenirken hata oluştu.' });
    } finally {
      setLoading(false);
    }
  };

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 4000);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving('profile');
    try {
      await updateUser(user.id, { name: profileName });
      showMessage('success', 'Profil bilgileri güncellendi.');
    } catch (e) {
      showMessage('error', 'Profil güncellenemedi.');
    } finally {
      setSaving(null);
    }
  };

  const handleSaveCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    const companyId = user?.companyId || localStorage.getItem('companyId');
    if (!companyId) {
      showMessage('error', 'Şirket bulunamadı.');
      return;
    }
    setSaving('company');
    try {
      const { error } = await supabase
        .from('companies')
        .update({ name: companyName, email: companyEmail })
        .eq('id', companyId);
      if (error) throw error;
      showMessage('success', 'Şirket bilgileri güncellendi.');
    } catch (e) {
      showMessage('error', 'Şirket güncellenemedi.');
    } finally {
      setSaving(null);
    }
  };

  const handleSaveJira = async (e: React.FormEvent) => {
    e.preventDefault();
    const companyId = user?.companyId || localStorage.getItem('companyId');
    if (!companyId) {
      showMessage('error', 'Şirket bulunamadı.');
      return;
    }
    setSaving('jira');
    try {
      const payload: { jira_email: string; jira_base_url: string; jira_api_token?: string } = {
        jira_email: jiraEmail.trim(),
        jira_base_url: (jiraBaseUrl || 'https://your-domain.atlassian.net').trim()
      };
      if (jiraApiToken.trim() && jiraApiToken !== MASKED_TOKEN) payload.jira_api_token = jiraApiToken.trim();
      const { error } = await supabase.from('companies').update(payload).eq('id', companyId);
      if (error) throw error;
      setJiraConnected(!!(payload.jira_email && (payload.jira_api_token || jiraConnected)));
      if (payload.jira_api_token) setJiraApiToken('');
      showMessage('success', 'Jira ayarları güncellendi.');
    } catch (e) {
      showMessage('error', 'Jira ayarları güncellenemedi.');
    } finally {
      setSaving(null);
    }
  };

  const handleSaveKolayIK = async (e: React.FormEvent) => {
    e.preventDefault();
    const companyId = user?.companyId || localStorage.getItem('companyId');
    if (!companyId) {
      showMessage('error', 'Şirket bulunamadı.');
      return;
    }
    setSaving('kolayik');
    try {
      const payload: { kolayik_base_url: string; kolayik_api_token?: string } = {
        kolayik_base_url: (kolayikBaseUrl || 'https://api.kolayik.com/v2').trim()
      };
      if (kolayikApiToken.trim() && kolayikApiToken !== MASKED_TOKEN) payload.kolayik_api_token = kolayikApiToken.trim();
      const { error } = await supabase.from('companies').update(payload).eq('id', companyId);
      if (error) throw error;
      setKolayikConnected(!!(payload.kolayik_base_url && (payload.kolayik_api_token || kolayikConnected)));
      if (payload.kolayik_api_token) setKolayikApiToken('');
      await refreshKolayIK();
      showMessage('success', 'Kolay İK ayarları güncellendi.');
    } catch (e) {
      showMessage('error', 'Kolay İK ayarları güncellenemedi.');
    } finally {
      setSaving(null);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
          <h2 className="text-xl font-semibold text-gray-900">Profil & Entegrasyon Ayarları</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors p-1"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-8">
          {message && (
            <div
              className={`rounded-lg p-3 text-sm ${
                message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
              }`}
            >
              {message.text}
            </div>
          )}

          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
            </div>
          ) : (
            <>
              {/* Profil Bilgileri */}
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <User className="h-5 w-5 text-blue-600" />
                  <h3 className="text-lg font-medium text-gray-900">Profil Bilgileri</h3>
                </div>
                <form onSubmit={handleSaveProfile} className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Ad Soyad</label>
                    <input
                      type="text"
                      value={profileName}
                      onChange={e => setProfileName(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Ad Soyad"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">E-posta</label>
                    <input
                      type="email"
                      value={profileEmail}
                      disabled
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 bg-gray-50 text-gray-500"
                      title="E-posta değiştirilemez"
                    />
                    <p className="text-xs text-gray-500 mt-1">E-posta adresi değiştirilemez.</p>
                  </div>
                  <button
                    type="submit"
                    disabled={saving === 'profile'}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2 text-sm"
                  >
                    {saving === 'profile' ? (
                      <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    Kaydet
                  </button>
                </form>
              </section>

              {/* Tema Ayarları */}
{/*
<section className="border-t border-gray-200 pt-6">
  <div className="flex items-center gap-2 mb-3">
    <Palette className="h-5 w-5 text-blue-600" />
    <h3 className="text-lg font-medium text-gray-900">Tema Rengi</h3>
  </div>
  <p className="text-sm text-gray-600 mb-4">
    Uygulamanın ana rengini seçin. Seçtiğiniz renk tüm sayfalarda kullanılacaktır.
  </p>
  <div className="grid grid-cols-5 gap-3">
    {[
      { name: 'blue', label: 'Mavi', color: 'bg-blue-600', hoverColor: 'hover:bg-blue-700', ringColor: 'ring-blue-600' },
      { name: 'green', label: 'Yeşil', color: 'bg-green-600', hoverColor: 'hover:bg-green-700', ringColor: 'ring-green-600' },
      { name: 'orange', label: 'Turuncu', color: 'bg-orange-600', hoverColor: 'hover:bg-orange-700', ringColor: 'ring-orange-600' },
      { name: 'red', label: 'Kırmızı', color: 'bg-red-600', hoverColor: 'hover:bg-red-700', ringColor: 'ring-red-600' },
      { name: 'slate', label: 'Gri', color: 'bg-slate-600', hoverColor: 'hover:bg-slate-700', ringColor: 'ring-slate-600' }
    ].map((themeOption) => (
      <button
        key={themeOption.name}
        type="button"
        onClick={async () => {
          setSaving('theme');
          try {
            await setTheme(themeOption.name as ThemeColor);
            showMessage('success', 'Tema rengi güncellendi.');
          } catch (e) {
            showMessage('error', 'Tema güncellenemedi.');
          } finally {
            setSaving(null);
          }
        }}
        disabled={saving === 'theme'}
        className={`relative flex flex-col items-center p-3 rounded-lg border-2 transition-all ${
          theme === themeOption.name
            ? \`border-\${themeOption.name}-600 \${themeOption.color} bg-opacity-10\`
            : 'border-gray-200 hover:border-gray-300'
        } \${saving === 'theme' ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <div className={`w-10 h-10 rounded-full ${themeOption.color} ${themeOption.hoverColor} transition-transform ${theme === themeOption.name ? 'ring-2 ' + themeOption.ringColor + ' ring-offset-2 scale-110' : ''}`} />
        <span className={`mt-2 text-xs font-medium ${theme === themeOption.name ? 'text-gray-900' : 'text-gray-600'}`}>
          {themeOption.label}
        </span>
        {theme === themeOption.name && (
          <div className="absolute top-1 right-1">
            <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
          </div>
        )}
      </button>
    ))}
  </div>
</section>
*/}

              {/* Şirket Bilgileri - Sadece admin */}
              {user?.role === 'admin' && (
                <>
                  <section className="border-t border-gray-200 pt-6">
                    <div className="flex items-center gap-2 mb-3">
                      <Building2 className="h-5 w-5 text-blue-600" />
                      <h3 className="text-lg font-medium text-gray-900">Şirket Bilgileri</h3>
                    </div>
                    <form onSubmit={handleSaveCompany} className="space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Şirket Adı</label>
                        <input
                          type="text"
                          value={companyName}
                          onChange={e => setCompanyName(e.target.value)}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="Şirket Adı"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Şirket E-postası</label>
                        <input
                          type="email"
                          value={companyEmail}
                          onChange={e => setCompanyEmail(e.target.value)}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="info@firma.com"
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={saving === 'company'}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2 text-sm"
                      >
                        {saving === 'company' ? (
                          <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                        ) : (
                          <Save className="h-4 w-4" />
                        )}
                        Kaydet
                      </button>
                    </form>
                  </section>

                  {/* Jira Entegrasyonu */}
                  <section className="border-t border-gray-200 pt-6">
                    <div className="flex items-center gap-2 mb-3">
                      <ExternalLink className="h-5 w-5 text-blue-600" />
                      <h3 className="text-lg font-medium text-gray-900">Jira Entegrasyonu</h3>
                      {jiraConnected && (
                        <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full">Bağlı</span>
                      )}
                    </div>
                    <form onSubmit={handleSaveJira} className="space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Jira E-posta</label>
                        <input
                          type="email"
                          value={jiraEmail}
                          onChange={e => setJiraEmail(e.target.value)}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="email@domain.com"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Jira API Token</label>
                        <input
                          type="password"
                          value={jiraTokenFocused ? jiraApiToken : (jiraApiToken || (jiraConnected ? MASKED_TOKEN : ''))}
                          onChange={e => setJiraApiToken(e.target.value)}
                          onFocus={() => setJiraTokenFocused(true)}
                          onBlur={() => setJiraTokenFocused(false)}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder={!jiraConnected ? 'Atlassian API token' : ''}
                          autoComplete="off"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          {jiraConnected && (
                            <>Mevcut token kayıtlı. Değiştirmek için alana tıklayıp yeni token girin. </>
                          )}
                          <a
                            href="https://id.atlassian.com/manage-profile/security/api-tokens"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline"
                          >
                            Atlassian hesabınızdan
                          </a>{' '}
                          token oluşturabilirsiniz.
                        </p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Jira Base URL</label>
                        <input
                          type="url"
                          value={jiraBaseUrl}
                          onChange={e => setJiraBaseUrl(e.target.value)}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="https://your-domain.atlassian.net"
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={saving === 'jira'}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2 text-sm"
                      >
                        {saving === 'jira' ? (
                          <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                        ) : (
                          <Save className="h-4 w-4" />
                        )}
                        Kaydet
                      </button>
                    </form>
                  </section>

                  {/* Kolay İK Entegrasyonu */}
                  <section className="border-t border-gray-200 pt-6">
                    <div className="flex items-center gap-2 mb-3">
                      <Users className="h-5 w-5 text-blue-600" />
                      <h3 className="text-lg font-medium text-gray-900">Kolay İK Entegrasyonu</h3>
                      {kolayikConnected && (
                        <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full">Bağlı</span>
                      )}
                    </div>
                    <form onSubmit={handleSaveKolayIK} className="space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Kolay İK Base URL</label>
                        <input
                          type="url"
                          value={kolayikBaseUrl}
                          onChange={e => setKolayikBaseUrl(e.target.value)}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="https://api.kolayik.com/v2"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">API Token</label>
                        <input
                          type="password"
                          value={kolayikTokenFocused ? kolayikApiToken : (kolayikApiToken || (kolayikConnected ? MASKED_TOKEN : ''))}
                          onChange={e => setKolayikApiToken(e.target.value)}
                          onFocus={() => setKolayikTokenFocused(true)}
                          onBlur={() => setKolayikTokenFocused(false)}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder={!kolayikConnected ? 'Kolay İK API token' : ''}
                          autoComplete="off"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          {kolayikConnected && (
                            <>Mevcut token kayıtlı. Değiştirmek için alana tıklayıp yeni token girin. </>
                          )}
                          Kolay İK panel → Ayarlar → API bölümünden alabilirsiniz.
                        </p>
                      </div>
                      <button
                        type="submit"
                        disabled={saving === 'kolayik'}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2 text-sm"
                      >
                        {saving === 'kolayik' ? (
                          <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                        ) : (
                          <Save className="h-4 w-4" />
                        )}
                        Kaydet
                      </button>
                    </form>
                  </section>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
