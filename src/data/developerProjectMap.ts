import { supabase } from '../lib/supabase';

export const developerProjectKeyMap: { [developerName: string]: string } = {};

interface DeveloperProjectMapService {
  getDeveloperProjectMap(): Promise<Map<string, string[]>>;
  getDeveloperProjectKey(developerName: string): Promise<string | undefined>;
  normalizeName(name: string): string;
  clearCache(): void;
}

class DeveloperProjectMapServiceImpl implements DeveloperProjectMapService {
  private cache: Map<string, string[]> | null = null;
  private cacheTimestamp: number = 0;
  private readonly CACHE_DURATION = 5 * 60 * 1000;

  normalizeName(name: string): string {
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
      .replace(/[^a-zA-Z0-9\s]/g, '')
      .trim();
  }

  clearCache(): void {
    this.cache = null;
    this.cacheTimestamp = 0;
  }

  async getDeveloperProjectMap(): Promise<Map<string, string[]>> {
    if (this.cache && Date.now() - this.cacheTimestamp < this.CACHE_DURATION) {
      return this.cache;
    }

    try {
      const companyId = localStorage.getItem('companyId');
      if (!companyId) {
        console.warn('Company ID not found, returning empty map');
        return new Map();
      }

      const { data: developers, error } = await supabase
        .from('selected_developers')
        .select('developer_name, project_keys')
        .eq('company_id', companyId)
        .eq('is_active', true);

      if (error) {
        console.error('Error fetching developer project map:', error);
        return new Map();
      }

      const map = new Map<string, string[]>();

      if (developers && developers.length > 0) {
        for (const dev of developers) {
          if (dev.developer_name && dev.project_keys && Array.isArray(dev.project_keys)) {
            const normalizedName = this.normalizeName(dev.developer_name);
            map.set(normalizedName, dev.project_keys);
          }
        }
      }

      this.cache = map;
      this.cacheTimestamp = Date.now();

      return map;
    } catch (error) {
      console.error('Error in getDeveloperProjectMap:', error);
      return new Map();
    }
  }

  async getDeveloperProjectKey(developerName: string): Promise<string | undefined> {
    const map = await this.getDeveloperProjectMap();
    const normalizedName = this.normalizeName(developerName);
    const projects = map.get(normalizedName);

    return projects && projects.length > 0 ? projects[0] : undefined;
  }
}

export const developerProjectMapService = new DeveloperProjectMapServiceImpl();


