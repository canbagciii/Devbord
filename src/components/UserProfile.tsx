import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useUsers } from '../hooks/useUsers';
import { ProfileSettingsModal } from './ProfileSettingsModal';
import { JiraFilterManagement } from './JiraFilterManagement';
import { User, LogOut, Shield, Eye, Settings, Key, Save, X, Filter } from 'lucide-react';

export const UserProfile: React.FC = () => {
  const { user, logout, hasRole, getAccessibleProjects } = useAuth();
  const { changePassword } = useUsers();
  const [showDropdown, setShowDropdown] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [showJiraFilters, setShowJiraFilters] = useState(false);

  if (!user) return null;

  const handleLogout = async () => {
    await logout();
    setShowDropdown(false);
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'admin': return <Shield className="h-4 w-4 text-red-600" />;
      case 'analyst': return <Eye className="h-4 w-4 text-blue-600" />;
      case 'developer': return <Settings className="h-4 w-4 text-green-600" />;
      default: return <User className="h-4 w-4 text-gray-600" />;
    }
  };

  const getRoleText = (role: string) => {
    switch (role) {
      case 'admin': return 'Yönetici';
      case 'analyst': return 'Analist';
      case 'developer': return 'Yazılımcı';
      default: return role;
    }
  };

  const accessibleProjects = getAccessibleProjects();

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    
    // Validasyon
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError('Yeni şifreler eşleşmiyor');
      return;
    }
    
    if (passwordForm.newPassword.length < 6) {
      setPasswordError('Yeni şifre en az 6 karakter olmalıdır');
      return;
    }
    
    setPasswordLoading(true);
    
    try {
      // Şifre değiştirme API çağrısı
      await changePassword(user.id, passwordForm.currentPassword, passwordForm.newPassword);
      
      // Başarılı mesaj
      alert('Şifreniz başarıyla değiştirildi!');
      
      // Form'u temizle ve modal'ı kapat
      setPasswordForm({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });
      setShowPasswordModal(false);
      setShowDropdown(false);
    } catch (error) {
      setPasswordError('Şifre değiştirilirken hata oluştu');
    } finally {
      setPasswordLoading(false);
    }
  };

  const resetPasswordForm = () => {
    setPasswordForm({
      currentPassword: '',
      newPassword: '',
      confirmPassword: ''
    });
    setPasswordError(null);
  };

  return (
    <>
      <div className="relative">
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className="flex items-center space-x-3 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors"
      >
        <div className="flex-shrink-0 h-8 w-8 bg-blue-100 rounded-full flex items-center justify-center">
          <span className="text-sm font-medium text-blue-800">
            {user.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
          </span>
        </div>
        <div className="flex-1 min-w-0 text-left">
          <p className="text-sm font-medium text-gray-900 truncate">{user.name}</p>
          <div className="flex items-center space-x-1">
            {getRoleIcon(user.role)}
            <p className="text-xs text-gray-500">{getRoleText(user.role)}</p>
          </div>
        </div>
      </button>

      {showDropdown && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center space-x-3">
              <div className="flex-shrink-0 h-12 w-12 bg-blue-100 rounded-full flex items-center justify-center">
                <span className="text-lg font-medium text-blue-800">
                  {user.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900">{user.name}</p>
                <p className="text-xs text-gray-500">{user.email}</p>
                <div className="flex items-center space-x-1 mt-1">
                  {getRoleIcon(user.role)}
                  <span className="text-xs text-gray-600">{getRoleText(user.role)}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="p-4 border-b border-gray-200">
            <h4 className="text-sm font-medium text-gray-900 mb-2">Erişim Yetkileriniz</h4>
            <div className="space-y-2">
              {hasRole('admin') ? (
                <div className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded">
                  ✓ Tüm projelere ve verilere tam erişim
                </div>
              ) : (
                <>
                  <div className="text-xs text-gray-600">
                    <strong>Erişilebilir Projeler:</strong>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {accessibleProjects.map(project => (
                      <span key={project} className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                        {project}
                      </span>
                    ))}
                  </div>
                  {user.role === 'developer' && (
                    <div className="text-xs text-yellow-600 bg-yellow-50 px-2 py-1 rounded">
                      ⚠️ Sadece kendi verilerinizi görüntüleyebilirsiniz
                    </div>
                  )}
                  {user.role === 'analyst' && (
                    <div className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded">
                      📊 Atandığınız projelerdeki yazılımcıların verilerini görüntüleyebilirsiniz
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          <div className="p-2">
            <button
              onClick={() => {
                setShowSettingsModal(true);
                setShowDropdown(false);
              }}
              className="w-full flex items-center space-x-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg transition-colors mb-1"
            >
              <Settings className="h-4 w-4" />
              <span>Entegrasyon Ayarları</span>
            </button>
            {hasRole('admin') && (
              <button
                onClick={() => {
                  setShowJiraFilters(true);
                  setShowDropdown(false);
                }}
                className="w-full flex items-center space-x-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg transition-colors mb-1"
              >
                <Filter className="h-4 w-4" />
                <span>Jira Ayarları</span>
              </button>
            )}
            <button
              onClick={() => {
                setShowPasswordModal(true);
                setShowDropdown(false);
                resetPasswordForm();
              }}
              className="w-full flex items-center space-x-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg transition-colors mb-1"
            >
              <Key className="h-4 w-4" />
              <span>Şifre Değiştir</span>
            </button>
            <button
              onClick={handleLogout}
              className="w-full flex items-center space-x-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            >
              <LogOut className="h-4 w-4" />
              <span>Çıkış Yap</span>
            </button>
          </div>
        </div>
      )}

      {showDropdown && (
        <div 
          className="fixed inset-0 z-40" 
          onClick={() => setShowDropdown(false)}
        />
      )}
      </div>

      {/* Profile Settings Modal */}
      <ProfileSettingsModal
        open={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
      />

      {/* Jira Yönetimi Modalı (sadece admin) */}
      {hasRole('admin') && showJiraFilters && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl mx-4 max-h-[90vh] overflow-y-auto border border-gray-200">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <div className="flex items-center gap-2">
                <Filter className="h-5 w-5 text-blue-600" />
                <h3 className="text-lg font-semibold text-gray-900">Jira Yönetimi</h3>
              </div>
              <button
                onClick={() => setShowJiraFilters(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-4 sm:p-6">
              <JiraFilterManagement />
            </div>
          </div>
        </div>
      )}

      {/* Password Change Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
            <div className="flex justify-between items-center p-6 border-b border-gray-200">
              <div className="flex items-center space-x-2">
                <Key className="h-5 w-5 text-blue-600" />
                <h3 className="text-lg font-semibold text-gray-900">Şifre Değiştir</h3>
              </div>
              <button
                onClick={() => setShowPasswordModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handlePasswordChange} className="p-6 space-y-4">
              {passwordError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <p className="text-sm text-red-800">{passwordError}</p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Mevcut Şifre *
                </label>
                <input
                  type="password"
                  required
                  value={passwordForm.currentPassword}
                  onChange={(e) => setPasswordForm(prev => ({ ...prev, currentPassword: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Mevcut şifrenizi girin"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Yeni Şifre *
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={passwordForm.newPassword}
                  onChange={(e) => setPasswordForm(prev => ({ ...prev, newPassword: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Yeni şifrenizi girin"
                />
                <p className="text-xs text-gray-500 mt-1">En az 6 karakter olmalıdır</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Yeni Şifre Tekrar *
                </label>
                <input
                  type="password"
                  required
                  value={passwordForm.confirmPassword}
                  onChange={(e) => setPasswordForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Yeni şifrenizi tekrar girin"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setShowPasswordModal(false)}
                  className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={passwordLoading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center space-x-2"
                >
                  {passwordLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      <span>Değiştiriliyor...</span>
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4" />
                      <span>Şifreyi Değiştir</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}; 