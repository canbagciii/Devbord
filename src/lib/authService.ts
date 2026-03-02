import { User, LoginCredentials } from '../types/auth';
import { supabase } from './supabase';

// Demo kullanıcıları - gerçek uygulamada bu veriler backend'den gelecek
const DEMO_USERS: Array<User & { password: string }> = [
  {
    id: '1',
    email: 'can.bagci@acerpro.com.tr',
    name: 'Can Bağcı',
    role: 'admin',
    password: '123456',
    assignedProjects: [] // Admin tüm projelere erişebilir
  },
  {
    id: '2',
    email: 'ahmet.korkusuz@acerpro.com.tr',
    name: 'Ahmet Korkusuz',
    role: 'analyst',
    password: '123456',
    assignedProjects: ['EK', 'VK', 'AN'] // Analist belirli projelere erişebilir
  },
  {
    id: '3',
    email: 'buse.eren@acerpro.com.tr',
    name: 'Buse Eren',
    role: 'developer',
    password: '123456',
    assignedProjects: ['EK'] // Yazılımcı sadece kendi projesine erişebilir
  }
];

class AuthService {
  private currentUser: User | null = null;

  // Türkçe karakterleri ve özel karakterleri normalize et
  private normalizeName(name: string): string {
    return name
      .toLocaleLowerCase('tr')
      .replace(/ı/g, 'i')
      .replace(/ş/g, 's')
      .replace(/ç/g, 'c')
      .replace(/ğ/g, 'g')
      .replace(/ü/g, 'u')
      .replace(/ö/g, 'o')
      .replace(/İ/g, 'i')
      .replace(/Ş/g, 's')
      .replace(/Ç/g, 'c')
      .replace(/Ğ/g, 'g')
      .replace(/Ü/g, 'u')
      .replace(/Ö/g, 'o')
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private getNameTokens(name: string): string[] {
    return this.normalizeName(name).split(' ').filter(Boolean);
  }

  // Kullanıcı ile geliştirici isminin aynı kişiyi temsil edip etmediğini esnek kontrol et
  private isSamePerson(user: User, developerDisplayName: string): boolean {
    const userTokens = this.getNameTokens(user.name);
    const devTokens = this.getNameTokens(developerDisplayName);
    if (userTokens.join(' ') === devTokens.join(' ')) return true; // Tam eşleşme

    // İlk + son isim eşleşmesi (ara isimleri yok say)
    if (userTokens.length >= 2 && devTokens.length >= 2) {
      const userFirst = userTokens[0];
      const userLast = userTokens[userTokens.length - 1];
      const devFirst = devTokens[0];
      const devLast = devTokens[devTokens.length - 1];
      if (userFirst === devFirst && userLast === devLast) return true;
    }

    // E-posta yerel kısmındaki token'ların ('.','-','_') hepsi geliştirici isim token'larında varsa
    const emailLocal = (user.email.split('@')[0] || '').toLowerCase();
    const emailTokens = emailLocal.replace(/[^a-z0-9\.\-_]/g, ' ').split(/[\.|\-|_]+/).filter(Boolean);
    if (emailTokens.length > 0) {
      const allFound = emailTokens.every(t => devTokens.includes(t));
      if (allFound) return true;
    }

    return false;
  }

  async login(credentials: LoginCredentials): Promise<User> {
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      // Edge function aracılığıyla login yap
      const response = await fetch(`${supabaseUrl}/functions/v1/user-login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${anonKey}`,
        },
        body: JSON.stringify({
          email: credentials.email,
          password: credentials.password,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Giriş yapılırken hata oluştu');
      }

      const user: User | null = result.user;

      // Edge function başarı dönse bile kullanıcı objesi yoksa bunu hata olarak ele al
      // (örneğin e-posta kayıtlı değilse veya hesap bulunamadıysa)
      if (!user) {
        throw new Error('Bu e-posta ile kayıtlı bir Devbord hesabı bulunamadı. Lütfen önce kayıt olun.');
      }

      // Supabase session'ı ayarla
      if (result.session) {
        await supabase.auth.setSession(result.session);
      }

      this.currentUser = user;

      localStorage.setItem('user', JSON.stringify(user));
      localStorage.setItem('authToken', `token-${user.id}`);
      localStorage.setItem('companyId', user.companyId);

      return user;
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      console.error('Login error:', error);
      throw new Error('Giriş yapılırken hata oluştu');
    }
  }

  async logout(): Promise<void> {
    await supabase.auth.signOut();
    this.currentUser = null;
    localStorage.removeItem('user');
    localStorage.removeItem('authToken');
    localStorage.removeItem('companyId');
  }

  getCurrentUser(): User | null {
    if (this.currentUser) {
      return this.currentUser;
    }

    // LocalStorage'dan kontrol et
    const storedUser = localStorage.getItem('user');
    const storedToken = localStorage.getItem('authToken');

    if (storedUser && storedToken) {
      try {
        this.currentUser = JSON.parse(storedUser);
        return this.currentUser;
      } catch (error) {
        console.error('Stored user data is invalid:', error);
        this.logout();
      }
    }

    return null;
  }

  isAuthenticated(): boolean {
    return this.getCurrentUser() !== null;
  }

  hasRole(role: string): boolean {
    const user = this.getCurrentUser();
    return user?.role === role;
  }

  canAccessProject(projectKey: string): boolean {
    const user = this.getCurrentUser();
    if (!user) return false;

    // Admin tüm projelere erişebilir
    if (user.role === 'admin') return true;

    // Diğer roller sadece atanmış projelerine erişebilir
    return user.assignedProjects?.includes(projectKey) || false;
  }

  canViewDeveloperData(developerName: string): boolean {
    const user = this.getCurrentUser();
    if (!user) return false;

    // Admin tüm yazılımcıları görebilir
    if (user.role === 'admin') return true;

    // Analist kuralları - aynı projelerde çalışan yazılımcıları görebilir
    if (user.role === 'analyst') {
      // Dinamik filtreleme context'te yapılacak
      return true;
    }

    // Yazılımcı kuralları
    if (user.role === 'developer') {
      // Diğer yazılımcılar sadece kendi verilerini görebilir (esnek isim eşleştirme)
      return this.isSamePerson(user, developerName);
    }

    return false;
  }


  getAccessibleProjects(): string[] {
    const user = this.getCurrentUser();
    if (!user) return [];

    // Admin tüm projelere erişebilir - boş array dönerek tüm projelere izin veriyoruz
    // JiraDataContext ve diğer yerler boş array'i "tüm projeler" olarak yorumlayacak
    if (user.role === 'admin') {
      return [];
    }

    // Diğer roller sadece atanmış projelerine erişebilir
    return user.assignedProjects || [];
  }


}

export const authService = new AuthService();