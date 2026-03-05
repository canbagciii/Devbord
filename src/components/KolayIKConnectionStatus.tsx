import React, { useState, useEffect } from 'react';
import { kolayikService } from '../services/kolayikService';
import { CheckCircle, XCircle, Loader, RefreshCw, Users, Calendar } from 'lucide-react';

export const KolayIKConnectionStatus: React.FC = () => {
  const [connectionStatus, setConnectionStatus] = useState<{
    success: boolean;
    message: string;
    employeeCount?: number;
  } | null>(null);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    testConnection();
  }, []);

  const testConnection = async () => {
    setTesting(true);
    try {
      const result = await kolayikService.testConnection();
      setConnectionStatus(result);
    } catch (error) {
      setConnectionStatus({
        success: false,
        message: error instanceof Error ? error.message : 'Bağlantı testi başarısız'
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="fixed bottom-4 left-52 z-40 w-48">
      <div className={`flex items-center space-x-2 px-3 py-2 rounded-lg shadow-lg border ${
        connectionStatus?.success
          ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 border-green-200 dark:border-green-700'
          : connectionStatus?.success === false
          ? 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 border-red-200 dark:border-red-700'
          : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300 border-gray-200 dark:border-gray-600'
      }`}>
        {testing ? (
          <Loader className="h-4 w-4 animate-spin" />
        ) : connectionStatus?.success ? (
          <CheckCircle className="h-4 w-4" />
        ) : connectionStatus?.success === false ? (
          <XCircle className="h-4 w-4" />
        ) : (
          <Calendar className="h-4 w-4" />
        )}

        <div className="flex flex-col min-w-0 flex-1">
          <span className="text-xs font-medium truncate">
            Kolay İK {testing ? 'Test Ediliyor...' : connectionStatus?.success ? 'Bağlı' : 'Bağlantı Hatası'}
          </span>

        </div>

        <button
          onClick={testConnection}
          disabled={testing}
          className="p-1 hover:bg-black hover:bg-opacity-10 dark:hover:bg-white dark:hover:bg-opacity-10 rounded transition-colors flex-shrink-0"
          title="Bağlantıyı test et"
        >

        </button>
      </div>

      {/* Error tooltip */}
      {connectionStatus && !connectionStatus.success && (
        <div className="absolute bottom-full left-0 mb-2 w-80 bg-white dark:bg-gray-800 border border-red-200 dark:border-red-700 rounded-lg shadow-lg p-3 z-[60]">
          <p className="text-sm text-red-800 dark:text-red-300">{connectionStatus.message}</p>
          <div className="mt-2 text-xs text-red-600 dark:text-red-400">
            <p>• API anahtarını kontrol edin</p>
            <p>• Kolay İK hesabınızda API yetkilerini kontrol edin</p>
            <p>• İnternet bağlantınızı kontrol edin</p>
          </div>
        </div>
      )}
    </div>
  );
};