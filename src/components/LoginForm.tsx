import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { User, Lock, Eye, EyeOff, Loader } from 'lucide-react';

export const LoginForm: React.FC = () => {
  const { login, loading, error } = useAuth();
  const [credentials, setCredentials] = useState({
    email: '',
    password: ''
  });
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await login(credentials);
    } catch (error) {
      // Error is handled by AuthContext
    }
  };

  const demoAccounts = [
    {
      role: 'Yönetici',
      email: 'can.bagci@acerpro.com.tr',
      password: '123456',
      description: 'Tüm projelere ve verilere erişim'
    },
    {
      role: 'Analist',
      email: 'ahmet.korkusuz@acerpro.com.tr',
      password: '123456',
      description: 'Atandığı projelerdeki yazılımcı verilerini görüntüleme'
    },
    {
      role: 'Yazılımcı',
      email: 'buse.eren@acerpro.com.tr',
      password: '123456',
      description: 'Sadece kendi verilerini görüntüleme'
    }
  ];

  const fillDemoAccount = (email: string, password: string) => {
    setCredentials({ email, password });
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <div className="mx-auto h-64  w-64">
            <img src="/logo.png" alt="logo"   /> 
          </div>
          <h2 className="mt-2 text-center text-1xl font-extrabold text-gray-900">
             Hesabınızla giriş yapın
          </h2>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-4">
              <div className="text-sm text-red-800">{error}</div>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                E-posta Adresi
              </label>
              <div className="mt-1 relative">
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={credentials.email}
                  onChange={(e) => setCredentials(prev => ({ ...prev, email: e.target.value }))}
                  className="appearance-none relative block w-full px-3 py-2 pl-10 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                  placeholder="E-posta adresinizi girin"
                />
                <User className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Şifre
              </label>
              <div className="mt-1 relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={credentials.password}
                  onChange={(e) => setCredentials(prev => ({ ...prev, password: e.target.value }))}
                  className="appearance-none relative block w-full px-3 py-2 pl-10 pr-10 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                  placeholder="Şifrenizi girin"
                />
                <Lock className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 h-4 w-4 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <Loader className="h-4 w-4 animate-spin" />
              ) : (
                'Giriş Yap'
              )}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};