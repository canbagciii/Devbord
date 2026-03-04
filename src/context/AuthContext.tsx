import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, AuthState, LoginCredentials } from '../types/auth';
import { authService } from '../lib/authService';
import { supabase } from '../lib/supabase';

interface AuthContextType extends AuthState {
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => Promise<void>;
  hasRole: (role: string) => boolean;
  canAccessProject: (projectKey: string) => boolean;
  canViewDeveloperData: (developerName: string) => boolean;
  getAccessibleProjects: () => string[];
  hasKolayIK: boolean;
  refreshKolayIK: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    loading: true,
    error: null
  });
  const [hasKolayIK, setHasKolayIK] = useState<boolean>(false);

  useEffect(() => {
    const user = authService.getCurrentUser();
    setAuthState({
      user: user || null,
      isAuthenticated: !!user,
      loading: false,
      error: null
    });

    const checkKolayIK = async () => {
      if (user?.companyId) {
        const { data, error } = await supabase
          .from('companies')
          .select('kolayik_api_token, kolayik_base_url')
          .eq('id', user.companyId)
          .single();
        if (!error && data) {
          setHasKolayIK(!!(data.kolayik_api_token && data.kolayik_base_url));
        }
      }
    };
    checkKolayIK();
  }, []);

  // Dinamik yetki güncellemeleri: Mevcut kullanıcının satırı değişirse authState.user'ı güncelle
  useEffect(() => {
    if (!authState.user?.email) return;
    const email = authState.user.email;
    const companyName = authState.user.companyName;

    const channel = supabase
      .channel('auth-user-changes')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'users', filter: `email=eq.${email}` },
        (payload) => {
          try {
            const row: any = payload.new;
            const updatedUser: User = {
              id: row.id,
              email: row.email,
              name: row.name,
              role: row.role,
              assignedProjects: row.assigned_projects || [],
              companyId: row.company_id,
              companyName: companyName || '',
              onboardingCompleted: row.onboarding_completed ?? false
            };
            setAuthState(prev => {
              if (JSON.stringify(prev.user) !== JSON.stringify(updatedUser)) {
                localStorage.setItem('user', JSON.stringify(updatedUser));
                return { ...prev, user: updatedUser };
              }
              return prev;
            });
          } catch (e) {
            console.error('Error updating auth user from realtime:', e);
          }
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [authState.user?.email]);

  const login = async (credentials: LoginCredentials) => {
    setAuthState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const user = await authService.login(credentials);
      setAuthState({
        user,
        isAuthenticated: true,
        loading: false,
        error: null
      });

      // KolayIK entegrasyonunu kontrol et
      if (user?.companyId) {
        const { data, error } = await supabase
          .from('companies')
          .select('kolayik_api_token, kolayik_base_url')
          .eq('id', user.companyId)
          .single();

        if (!error && data) {
          const hasConfig = !!(data.kolayik_api_token && data.kolayik_base_url);
          setHasKolayIK(hasConfig);
        }
      }
    } catch (error) {
      setAuthState(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Giriş yapılırken hata oluştu'
      }));
      throw error;
    }
  };

  const logout = async () => {
    await authService.logout();
    setAuthState({
      user: null,
      isAuthenticated: false,
      loading: false,
      error: null
    });
  };

  const hasRole = (role: string): boolean => {
    return authService.hasRole(role);
  };

  const canAccessProject = (projectKey: string): boolean => {
    return authService.canAccessProject(projectKey);
  };

  const canViewDeveloperData = (developerName: string): boolean => {
    return authService.canViewDeveloperData(developerName);
  };

  const getAccessibleProjects = (): string[] => {
    return authService.getAccessibleProjects();
  };

  const refreshKolayIK = async () => {
    const user = authService.getCurrentUser();
    if (!user?.companyId) {
      setHasKolayIK(false);
      return;
    }
    const { data, error } = await supabase
      .from('companies')
      .select('kolayik_api_token, kolayik_base_url')
      .eq('id', user.companyId)
      .single();
    if (!error && data) {
      setHasKolayIK(!!(data.kolayik_api_token && data.kolayik_base_url));
    }
  };

  return (
    <AuthContext.Provider value={{
      ...authState,
      login,
      logout,
      hasRole,
      canAccessProject,
      canViewDeveloperData,
      getAccessibleProjects,
      hasKolayIK,
      refreshKolayIK
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};