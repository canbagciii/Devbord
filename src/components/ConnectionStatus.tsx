import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Wifi, WifiOff } from 'lucide-react';

export const ConnectionStatus: React.FC = () => {
  const [isConnected, setIsConnected] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  useEffect(() => {
    // Test connection periodically
    const testConnection = async () => {
      try {
        const { error } = await supabase.from('tasks').select('id').limit(1);
        setIsConnected(!error);
        if (!error) {
          setLastUpdate(new Date());
        }
      } catch {
        setIsConnected(false);
      }
    };

    // Test immediately
    testConnection();

    // Test every 30 seconds
    const interval = setInterval(testConnection, 30000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <div className={`flex items-center space-x-2 px-3 py-2 rounded-lg shadow-lg ${
        isConnected 
          ? 'bg-green-100 text-green-800 border border-green-200' 
          : 'bg-red-100 text-red-800 border border-red-200'
      }`}>
        {isConnected ? (
          <Wifi className="h-4 w-4" />
        ) : (
          <WifiOff className="h-4 w-4" />
        )}
        <span className="text-sm font-medium">
          {isConnected ? 'Bağlı' : 'Bağlantı Yok'}
        </span>
        {isConnected && (
          <span className="text-xs opacity-75">
            {lastUpdate.toLocaleTimeString('tr-TR')}
          </span>
        )}
      </div>
    </div>
  );
};