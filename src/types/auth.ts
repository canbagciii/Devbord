export interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'analyst' | 'developer';
  assignedProjects?: string[];
  companyId: string;
  companyName: string;
  onboardingCompleted?: boolean;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  loading: boolean;
  error: string | null;
}

export interface LoginCredentials {
  email: string;
  password: string;
}