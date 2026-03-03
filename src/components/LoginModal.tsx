import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface LoginModalProps {
  onClose: () => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({ onClose }) => {
  const { login, isAuthenticated } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    email: '',
    password: ''
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
      await login(formData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Giriş yapılırken hata oluştu');
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
      <div className="bg-white rounded-3xl w-full max-w-[520px] shadow-2xl p-10 relative animate-in fade-in zoom-in-95 duration-300">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 w-8 h-8 rounded-full bg-gray-100 border-[1.5px] border-gray-300 flex items-center justify-center text-gray-600 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-600 transition-all"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="mb-7">
          <h2 className="text-2xl font-extrabold text-gray-900 mb-1.5">Tekrar hoş geldiniz 👋</h2>
          <p className="text-sm text-gray-600">DevPulse hesabınıza giriş yapın</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="space-y-3.5 mb-6">
            <div>
              <label className="block text-[0.82rem] font-semibold text-gray-900 mb-1.5">E-posta</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
                className="w-full px-3.5 py-2.5 border-[1.5px] border-gray-300 rounded-lg text-sm text-gray-900 bg-gray-50 focus:border-blue-600 focus:bg-white focus:ring-4 focus:ring-blue-600/10 outline-none transition-all"
                placeholder="ornek@sirket.com"
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
                className="w-full px-3.5 py-2.5 border-[1.5px] border-gray-300 rounded-lg text-sm text-gray-900 bg-gray-50 focus:border-blue-600 focus:bg-white focus:ring-4 focus:ring-blue-600/10 outline-none transition-all"
                placeholder="••••••••"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl text-[0.95rem] font-bold text-white bg-blue-600 hover:bg-blue-700 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-blue-600/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Giriş Yapılıyor...' : 'Giriş Yap'}
          </button>

          <div className="text-center mt-4 text-[0.83rem] text-gray-600">
            Hesabınız yok mu? <button type="button" onClick={onClose} className="text-blue-600 font-semibold no-underline hover:underline">Ücretsiz kaydolun</button>
          </div>
        </form>
      </div>
    </div>
  );
};
