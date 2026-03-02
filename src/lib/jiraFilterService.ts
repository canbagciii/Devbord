import { supabase } from './supabase';

export interface SelectedProject {
  id: string;
  project_key: string;
  project_name: string;
  is_active: boolean;
  created_at: string;
  created_by: string | null;
  updated_at: string;
}

export interface SelectedDeveloper {
  id: string;
  developer_name: string;
  developer_email: string | null;
  jira_account_id: string | null;
  project_keys: string[];
  is_active: boolean;
  created_at: string;
  created_by: string | null;
  updated_at: string;
}

class JiraFilterService {
  async getSelectedProjects(): Promise<SelectedProject[]> {
    const { data: { user } } = await supabase.auth.getUser();
    // JWT app_metadata'da olmayabilir (eski oturum); localStorage login sırasında set edilir
    const companyId = user?.app_metadata?.company_id ?? (typeof localStorage !== 'undefined' ? localStorage.getItem('companyId') : null);

    console.log('🔍 getSelectedProjects - company_id:', companyId);

    let query = supabase
      .from('selected_projects')
      .select('*')
      .eq('is_active', true)
      .order('project_name');

    if (companyId) {
      query = query.eq('company_id', companyId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('❌ Error fetching selected projects:', error);
      throw error;
    }

    console.log(`📋 getSelectedProjects: Found ${data?.length || 0} active projects`, data?.map(p => p.project_key));
    return data || [];
  }

  async getSelectedDevelopers(): Promise<SelectedDeveloper[]> {
    const { data: { user } } = await supabase.auth.getUser();
    const companyId = user?.app_metadata?.company_id ?? (typeof localStorage !== 'undefined' ? localStorage.getItem('companyId') : null);

    console.log('🔍 getSelectedDevelopers - company_id:', companyId);

    let query = supabase
      .from('selected_developers')
      .select('*')
      .eq('is_active', true)
      .order('developer_name');

    if (companyId) {
      query = query.eq('company_id', companyId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('❌ Error fetching selected developers:', error);
      throw error;
    }

    console.log(`👥 getSelectedDevelopers: Found ${data?.length || 0} active developers`, data?.map(d => d.developer_name));
    return data || [];
  }

  async addProject(projectKey: string, projectName: string): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();

    console.log('🔍 addProject - User:', user?.email);
    console.log('🔍 addProject - app_metadata:', user?.app_metadata);

    if (!user) {
      throw new Error('Kullanıcı oturum açmamış');
    }

    const company_id = user.app_metadata?.company_id ?? (typeof localStorage !== 'undefined' ? localStorage.getItem('companyId') : null);

    console.log('🔍 addProject - company_id:', company_id);

    if (!company_id) {
      throw new Error('Kullanıcının company_id bilgisi bulunamadı. Lütfen çıkış yapıp tekrar giriş yapın.');
    }

    const { data: existing } = await supabase
      .from('selected_projects')
      .select('*')
      .eq('project_key', projectKey)
      .eq('company_id', company_id)
      .maybeSingle();

    if (existing) {
      const { error } = await supabase
        .from('selected_projects')
        .update({ is_active: true, updated_at: new Date().toISOString() })
        .eq('id', existing.id);

      if (error) {
        console.error('❌ Error activating project:', error);
        throw new Error(`Proje aktifleştirilemedi: ${error.message}`);
      }
      console.log('✅ Project reactivated:', projectKey);
    } else {
      console.log('📝 Inserting new project:', { projectKey, projectName, company_id });
      const { error } = await supabase
        .from('selected_projects')
        .insert({
          project_key: projectKey,
          project_name: projectName,
          is_active: true,
          created_by: user.id,
          company_id: company_id
        });

      if (error) {
        console.error('❌ Error adding project:', error);
        throw new Error(`Proje eklenemedi: ${error.message}`);
      }
      console.log('✅ Project added successfully:', projectKey);
    }
  }

  async addDeveloper(
    developerName: string,
    email?: string,
    jiraAccountId?: string,
    projectKeys?: string[],
    allProjects?: Array<{ key: string; name: string }>
  ): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();

    console.log('🔍 addDeveloper - User:', user?.email);
    console.log('🔍 addDeveloper - app_metadata:', user?.app_metadata);

    if (!user) {
      throw new Error('Kullanıcı oturum açmamış');
    }

    const company_id = user.app_metadata?.company_id ?? (typeof localStorage !== 'undefined' ? localStorage.getItem('companyId') : null);

    console.log('🔍 addDeveloper - company_id:', company_id);

    if (!company_id) {
      throw new Error('Kullanıcının company_id bilgisi bulunamadı. Lütfen çıkış yapıp tekrar giriş yapın.');
    }

    if (projectKeys && projectKeys.length > 0 && allProjects) {
      for (const projectKey of projectKeys) {
        const project = allProjects.find(p => p.key === projectKey);
        if (project) {
          const { data: existingProject } = await supabase
            .from('selected_projects')
            .select('*')
            .eq('project_key', projectKey)
            .maybeSingle();

          if (!existingProject) {
            await supabase
              .from('selected_projects')
              .insert({
                project_key: project.key,
                project_name: project.name,
                is_active: true,
                created_by: user.id,
                company_id: company_id
              });
            console.log(`✅ Auto-added project: ${project.key} - ${project.name}`);
          }
        }
      }
    }

    // Önce e-posta ile ara (UNIQUE kısıt company_id + developer_email üzerinde)
    const emailToUse = email ?? '';
    let existing: SelectedDeveloper | null = null;

    if (emailToUse) {
      const { data: byEmail } = await supabase
        .from('selected_developers')
        .select('*')
        .eq('company_id', company_id)
        .eq('developer_email', emailToUse)
        .maybeSingle();
      existing = byEmail as SelectedDeveloper | null;
    }

    // E-posta ile bulunamadıysa isim ile ara
    if (!existing) {
      const { data: byName } = await supabase
        .from('selected_developers')
        .select('*')
        .eq('developer_name', developerName)
        .eq('company_id', company_id)
        .maybeSingle();
      existing = byName as SelectedDeveloper | null;
    }

    if (existing) {
      const { error } = await supabase
        .from('selected_developers')
        .update({
          developer_name: developerName,
          developer_email: emailToUse || existing.developer_email,
          jira_account_id: jiraAccountId ?? existing.jira_account_id,
          is_active: true,
          project_keys: projectKeys ?? existing.project_keys ?? [],
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.id);

      if (error) {
        console.error('❌ Error updating developer:', error);
        throw new Error(`Yazılımcı güncellenemedi: ${error.message}`);
      }
      console.log('✅ Developer updated/reactivated:', developerName);
    } else {
      console.log('📝 Inserting new developer:', { developerName, email: emailToUse || '(empty)', company_id, projectKeys });
      const { error } = await supabase
        .from('selected_developers')
        .insert({
          developer_name: developerName,
          developer_email: emailToUse || null,
          jira_account_id: jiraAccountId ?? null,
          project_keys: projectKeys || [],
          is_active: true,
          created_by: user.id,
          company_id: company_id
        });

      if (error) {
        console.error('❌ Error adding developer:', error);
        throw new Error(`Yazılımcı eklenemedi: ${error.message}`);
      }
      console.log('✅ Developer added successfully:', developerName);
    }
  }

  async updateDeveloperProjects(developerId: string, projectKeys: string[]): Promise<void> {
    const { error } = await supabase
      .from('selected_developers')
      .update({
        project_keys: projectKeys,
        updated_at: new Date().toISOString()
      })
      .eq('id', developerId);

    if (error) {
      console.error('Error updating developer projects:', error);
      throw error;
    }
  }

  async toggleProjectStatus(projectKey: string, isActive: boolean): Promise<void> {
    const { error } = await supabase
      .from('selected_projects')
      .update({ is_active: isActive })
      .eq('project_key', projectKey);

    if (error) {
      console.error('Error toggling project status:', error);
      throw error;
    }
  }

  async toggleDeveloperStatus(developerId: string, isActive: boolean): Promise<void> {
    const { error } = await supabase
      .from('selected_developers')
      .update({ is_active: isActive })
      .eq('id', developerId);

    if (error) {
      console.error('Error toggling developer status:', error);
      throw error;
    }
  }

  async removeProject(projectKey: string): Promise<void> {
    const { error } = await supabase
      .from('selected_projects')
      .delete()
      .eq('project_key', projectKey);

    if (error) {
      console.error('Error removing project:', error);
      throw error;
    }
  }

  async removeDeveloper(developerId: string): Promise<void> {
    const { error } = await supabase
      .from('selected_developers')
      .delete()
      .eq('id', developerId);

    if (error) {
      console.error('Error removing developer:', error);
      throw error;
    }
  }

  async getProjectKeys(): Promise<string[]> {
    const projects = await this.getSelectedProjects();
    const projectKeys = projects.map(p => p.project_key);
    console.log(`📋 getProjectKeys: ${projectKeys.length} projects:`, projectKeys);
    return projectKeys;
  }

  async getDeveloperNames(): Promise<string[]> {
    const developers = await this.getSelectedDevelopers();
    const developerNames = developers.map(d => d.developer_name);
    console.log(`👥 getDeveloperNames: ${developerNames.length} developers:`, developerNames);
    return developerNames;
  }

  /**
   * Yazılımcı ismi (normalize) -> e-posta eşlemesi. Kolay İK izin listesi vb. için kullanılır.
   * selected_developers.developer_email kullanır; company_id filtresi getSelectedDevelopers ile aynı.
   */
  async getDeveloperEmailMap(): Promise<Map<string, string>> {
    const developers = await this.getSelectedDevelopers();
    const map = new Map<string, string>();
    developers.forEach(dev => {
      const name = dev.developer_name;
      const email = dev.developer_email?.trim();
      if (name) {
        map.set(JiraFilterService.normalizeName(name), email || '');
        map.set(name, email || '');
      }
    });
    return map;
  }

  /** İsim normalizasyonu (JIRA ile users tablosu eşleşmesi için) */
  private static normalizeName(name: string): string {
    return (name || '')
      .toLocaleLowerCase('tr')
      .replace(/ı/g, 'i').replace(/ş/g, 's').replace(/ç/g, 'c').replace(/ğ/g, 'g')
      .replace(/ü/g, 'u').replace(/ö/g, 'o')
      .replace(/İ/g, 'i').replace(/Ş/g, 's').replace(/Ç/g, 'c').replace(/Ğ/g, 'g').replace(/Ü/g, 'u').replace(/Ö/g, 'o')
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Kullanıcı Yönetimi sayfasındaki proje atamalarını kullanır (users.assigned_projects).
   * Yazılımcı -> proje eşlemesi için öncelikli kaynak. Key'ler normalize edilmiş isimdir.
   */
  async getDeveloperProjectMapFromUsers(): Promise<Map<string, string[]>> {
    const { data, error } = await supabase
      .from('users')
      .select('name, assigned_projects')
      .eq('role', 'developer')
      .eq('is_active', true);

    if (error) {
      console.error('Error fetching developer project map from users:', error);
      return new Map();
    }

    const map = new Map<string, string[]>();
    (data || []).forEach((row: { name: string | null; assigned_projects: string[] | null }) => {
      const name = row.name;
      const projects = Array.isArray(row.assigned_projects) ? row.assigned_projects : [];
      if (name && projects.length > 0) {
        map.set(JiraFilterService.normalizeName(name), projects);
      }
    });
    return map;
  }

  async getDeveloperProjectMap(): Promise<Map<string, string[]>> {
    const developers = await this.getSelectedDevelopers();
    const map = new Map<string, string[]>();

    developers.forEach(dev => {
      if (dev.project_keys && dev.project_keys.length > 0) {
        map.set(dev.developer_name, dev.project_keys);
      }
    });

    return map;
  }

  async getProjectsForDeveloper(developerName: string): Promise<string[]> {
    const { data, error } = await supabase
      .from('selected_developers')
      .select('project_keys')
      .eq('developer_name', developerName)
      .eq('is_active', true)
      .maybeSingle();

    if (error) {
      console.error('Error fetching developer projects:', error);
      return [];
    }

    return data?.project_keys || [];
  }
}

export const jiraFilterService = new JiraFilterService();
