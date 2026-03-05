import React, { useState, useEffect } from 'react';
import { supabaseJiraService } from '../lib/supabaseJiraService';
import { Wifi, WifiOff, AlertCircle } from 'lucide-react';

export const JiraConnectionStatus: React.FC = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [error, setError] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    const checkConnection = async () => {
      setTesting(true);
      try {
        console.log('Testing Jira connection...');
        
        // First check if Supabase is configured
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
        
        if (!supabaseUrl || !supabaseKey || supabaseUrl.includes('your-project') || supabaseKey.includes('your-anon-key')) {
          throw new Error('Supabase not configured. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file.');
        }
        
        // Test Jira connection by trying to fetch a simple endpoint
        const projects = await supabaseJiraService.getProjects();
        console.log('Connection test successful:', projects.length, 'projects found');
        setIsConnected(true);
        setError(null);
        setLastUpdate(new Date());
      } catch (err) {
        console.error('Connection test failed:', err);
        setIsConnected(false);
        let errorMessage = 'Jira connection failed';
        
        if (err instanceof Error) {
          errorMessage = err.message;
          
          // Provide user-friendly error messages
          if (err.message.includes('not accessible')) {
            errorMessage = 'Supabase Edge Functions not accessible. Please check your Supabase project status.';
          } else if (err.message.includes('Network connection failed')) {
            errorMessage = 'Network connection failed. Please check your internet connection.';
          } else if (err.message.includes('Supabase not configured')) {
            errorMessage = 'Supabase configuration missing. Please check your .env file.';
          }
        }
        
        setError(errorMessage);
      } finally {
        setTesting(false);
      }
    };

    checkConnection();
    const interval = setInterval(checkConnection, 30000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="fixed bottom-4 left-4 z-40 w-48">
      <div className={`flex items-center space-x-2 px-3 py-2 rounded-lg shadow-lg ${
        isConnected
          ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 border border-green-200 dark:border-green-700'
          : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 border border-red-200 dark:border-red-700'
      }`}>
        {testing ? (
          <div className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full" />
        ) : isConnected ? (
          <Wifi className="h-4 w-4" />
        ) : (
          <WifiOff className="h-4 w-4" />
        )}
        <div className="flex flex-col min-w-0 flex-1">
          <span className="text-xs opacity-75 truncate">
            Jira {testing ? 'Test Ediliyor...' : isConnected ? 'Bağlı' : 'Bağlantı Hatası'}
          </span>
          {!isConnected && !testing && error && (
            <AlertCircle className="h-4 w-4" title={error || 'Bağlantı sorunu'} />
          )}

        </div>
      </div>
    </div>
  );
};