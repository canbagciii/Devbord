import { DeveloperWorkload, JiraTask, JiraProject, JiraSprint, JiraBoard, ProjectSprintDetail } from '../types';

// Cache interface
interface CacheData {
  data: any;
  timestamp: number;
  expiry: number;
}

// Global cache object
const cache = new Map<string, CacheData>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

const JIRA_BASE_URL = '/api/jira';
const JIRA_EMAIL = import.meta.env.VITE_JIRA_EMAIL;
const JIRA_TOKEN = import.meta.env.VITE_JIRA_TOKEN;

const authHeader = JIRA_EMAIL && JIRA_TOKEN ? btoa(`${JIRA_EMAIL}:${JIRA_TOKEN}`) : '';

class JiraService {
  private xsrfToken: string | null = null;

  private async _fetchXsrfToken(): Promise<string> {
    if (this.xsrfToken) {
      return this.xsrfToken;
    }

    const url = `${JIRA_BASE_URL}/rest/api/3/myself`;
    
    const headers: Record<string, string> = {
      'Authorization': `Basic ${authHeader}`,
      'Accept': 'application/json',
    };

    const response = await fetch(url, { headers });

    if (!response.ok) {
      throw new Error(`Failed to fetch XSRF token: ${response.status}`);
    }

    // Get XSRF token from response headers
    const xsrfToken = response.headers.get('X-Atlassian-Token') || 
                     response.headers.get('x-atlassian-token') ||
                     `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    this.xsrfToken = xsrfToken;
    return xsrfToken;
  }

  private async makeRequestWithRetry<T>(endpoint: string, apiVersion: 'api3' | 'agile' = 'api3', options: RequestInit = {}, retries: number = 3): Promise<T> {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        return await this.makeRequest<T>(endpoint, apiVersion, options);
      } catch (error) {
        console.warn(`Jira API attempt ${attempt}/${retries} failed:`, error);
        
        if (attempt === retries) {
          throw error;
        }
        
        // Wait before retry (exponential backoff)
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    throw new Error('All retry attempts failed');
  }

  private getFromCache<T>(key: string): T | null {
    const cached = cache.get(key);
    if (cached && Date.now() < cached.expiry) {
      return cached.data as T;
    }
    return null;
  }

  private setCache<T>(key: string, data: T): void {
    cache.set(key, {
      data,
      timestamp: Date.now(),
      expiry: Date.now() + CACHE_DURATION
    });
  }

  clearCache(): void {
    cache.clear();
    this.xsrfToken = null; // Clear XSRF token when clearing cache
  }

  private async makeRequest<T>(endpoint: string, apiVersion: 'api3' | 'agile' = 'api3', options: RequestInit = {}): Promise<T> {
    // Check if Jira credentials are configured
    if (!JIRA_EMAIL || !JIRA_TOKEN) {
      throw new Error('Jira credentials not configured. Please set VITE_JIRA_EMAIL and VITE_JIRA_TOKEN in your .env file.');
    }

    // Check cache first
    const cacheKey = `${apiVersion}:${endpoint}`;
    const cached = this.getFromCache<T>(cacheKey);
    if (cached) {
      return cached;
    }

    const basePath = apiVersion === 'agile' ? '/rest/agile/1.0' : '/rest/api/3';
    const url = `${JIRA_BASE_URL}${basePath}${endpoint}`;
    
    const headers: Record<string, string> = {
      'Authorization': `Basic ${authHeader}`,
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      ...options.headers,
    };

    // Add XSRF bypass header for non-GET requests
    if (options.method && options.method !== 'GET') {
      try {
        const xsrfToken = await this._fetchXsrfToken();
        headers['X-Atlassian-Token'] = xsrfToken;
      } catch (error) {
        console.warn('Failed to fetch XSRF token, using fallback:', error);
        headers['X-Atlassian-Token'] = 'no-check';
      }
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Jira API Error (${response.status}): ${errorText}`);
    }

    const result = await response.json();
    
    // Cache the result
    this.setCache(cacheKey, result);
    
    return result;
  }

  async getProjects(): Promise<JiraProject[]> {
    if (!JIRA_EMAIL || !JIRA_TOKEN) {
      console.warn('JIRA credentials not configured. Cannot fetch projects from JIRA.');
      return [];
    }

    try {
      const projects = await this.makeRequestWithRetry<JiraProject[]>('/project');
      return projects;
    } catch (error) {
      console.error('Error fetching JIRA projects:', error);
      return [];
    }
  }

  async getAllUsers(): Promise<Array<{ accountId: string; displayName: string; emailAddress?: string; active: boolean }>> {
    if (!JIRA_EMAIL || !JIRA_TOKEN) {
      console.warn('JIRA credentials not configured. Cannot fetch users from JIRA.');
      return [];
    }

    try {
      const users = await this.makeRequestWithRetry<Array<{ accountId: string; displayName: string; emailAddress?: string; active: boolean }>>('/users/search?maxResults=1000');
      return users.filter(user => user.active);
    } catch (error) {
      console.error('Error fetching Jira users:', error);
      return [];
    }
  }

  async getBoards(): Promise<JiraBoard[]> {
    const response = await this.makeRequestWithRetry<{ values: JiraBoard[] }>('/board?maxResults=100', 'agile');
    return response.values;
  }

  async getActiveSprintsForBoard(boardId: string): Promise<JiraSprint[]> {
    try {
      const response = await this.makeRequestWithRetry<{ values: JiraSprint[] }>(`/board/${boardId}/sprint?state=active`, 'agile');
      return response.values;
    } catch (error) {
      console.warn(`Could not fetch sprints for board ${boardId}:`, error);
      return [];
    }
  }

  async getClosedSprintsForBoard(boardId: string): Promise<JiraSprint[]> {
    try {
      const response = await this.makeRequestWithRetry<{ values: JiraSprint[] }>(`/board/${boardId}/sprint?state=closed&maxResults=1`, 'agile');
      return response.values;
    } catch (error) {
      console.warn(`Could not fetch closed sprints for board ${boardId}:`, error);
      return [];
    }
  }
  async getActiveSprintsForProject(projectKey: string): Promise<JiraSprint[]> {
    try {
      const boards = await this.getBoards();
      const projectBoard = boards.find(board => 
        board.name.toUpperCase().includes(projectKey.toUpperCase())
      );
      
      if (!projectBoard) {
        console.warn(`No board found for project ${projectKey}`);
        return [];
      }
      
      return await this.getActiveSprintsForBoard(projectBoard.id);
    } catch (error) {
      console.warn(`Could not fetch sprints for project ${projectKey}:`, error);
      return [];
    }
  }

  async getClosedSprintsForProject(projectKey: string): Promise<JiraSprint[]> {
    try {
      const boards = await this.getBoards();
      const projectBoard = boards.find(board => 
        board.name.toUpperCase().includes(projectKey.toUpperCase())
      );
      
      if (!projectBoard) {
        console.warn(`No board found for project ${projectKey}`);
        return [];
      }
      
      return await this.getClosedSprintsForBoard(projectBoard.id);
    } catch (error) {
      console.warn(`Could not fetch closed sprints for project ${projectKey}:`, error);
      return [];
    }
  }
  async createIssue(issueData: {
    projectKey: string;
    summary: string;
    description?: string;
    issueType: string;
    assignee?: string;
    estimatedHours?: number;
    sprintId?: string;
  }): Promise<{ key: string; id: string }> {
    try {
      const payload: any = {
        fields: {
          project: {
            key: issueData.projectKey
          },
          summary: issueData.summary,
          description: issueData.description || '',
          issuetype: {
            name: issueData.issueType
          }
        }
      };

      // Add assignee if provided
      if (issueData.assignee) {
        payload.fields.assignee = {
          displayName: issueData.assignee
        };
      }

      // Add time estimate if provided
      if (issueData.estimatedHours) {
        payload.fields.timeoriginalestimate = issueData.estimatedHours * 3600; // Convert hours to seconds
      }

      const response = await this.makeRequest<{ key: string; id: string }>('/issue', 'api3', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      // If sprint is provided, add issue to sprint
      if (issueData.sprintId && response.id) {
        try {
          await this.addIssueToSprint(response.id, issueData.sprintId);
        } catch (sprintError) {
          console.warn('Issue created but could not add to sprint:', sprintError);
        }
      }

      // Clear cache to refresh data
      this.clearCache();

      return response;
    } catch (error) {
      console.error('Error creating Jira issue:', error);
      throw error;
    }
  }

  private async addIssueToSprint(issueId: string, sprintId: string): Promise<void> {
    await this.makeRequest(`/sprint/${sprintId}/issue`, 'agile', {
      method: 'POST',
      body: JSON.stringify({
        issues: [issueId]
      })
    });
  }

  async getSprintIssues(sprintId: string): Promise<JiraTask[]> {
    try {
      const jql = `sprint = ${sprintId} AND assignee is not EMPTY ORDER BY updated DESC`;
      const response = await this.makeRequestWithRetry<{
        issues: any[];
      }>(`/search?jql=${encodeURIComponent(jql)}&maxResults=100&fields=summary,description,status,assignee,project,priority,created,updated,timeoriginalestimate,timespent`);
      
      return response.issues.map(issue => ({
        id: issue.id,
        key: issue.key,
        summary: issue.fields.summary,
        description: issue.fields.description,
        status: issue.fields.status.name,
        assignee: issue.fields.assignee?.displayName || 'Unassigned',
        project: issue.fields.project.name,
        sprint: sprintId,
        estimatedHours: issue.fields.timeoriginalestimate ? Math.round(issue.fields.timeoriginalestimate / 3600) : 0,
        actualHours: issue.fields.timespent ? Math.round(issue.fields.timespent / 3600) : 0,
        priority: issue.fields.priority?.name || 'Medium',
        created: issue.fields.created,
        updated: issue.fields.updated
      }));
    } catch (error) {
      console.warn(`Could not fetch issues for sprint ${sprintId}:`, error);
      return [];
    }
  }

  async getAllActiveSprints(): Promise<{ sprint: JiraSprint; boardName: string; projectKey: string }[]> {
    const boards = await this.getBoards();
    const allSprints: { sprint: JiraSprint; boardName: string; projectKey: string }[] = [];

    for (const board of boards) {
      const sprints = await this.getActiveSprintsForBoard(board.id);
      for (const sprint of sprints) {
        allSprints.push({
          sprint: {
            ...sprint,
            boardId: board.id,
            projectKey: this.extractProjectKeyFromBoard(board.name)
          },
          boardName: board.name,
          projectKey: this.extractProjectKeyFromBoard(board.name)
        });
      }
    }

    return allSprints;
  }

  async getAllClosedSprints(): Promise<{ sprint: JiraSprint; boardName: string; projectKey: string }[]> {
    const boards = await this.getBoards();
    const allSprints: { sprint: JiraSprint; boardName: string; projectKey: string }[] = [];

    for (const board of boards) {
      const sprints = await this.getClosedSprintsForBoard(board.id);
      for (const sprint of sprints) {
        allSprints.push({
          sprint: {
            ...sprint,
            boardId: board.id,
            projectKey: this.extractProjectKeyFromBoard(board.name)
          },
          boardName: board.name,
          projectKey: this.extractProjectKeyFromBoard(board.name)
        });
      }
    }

    return allSprints;
  }

  private extractProjectKeyFromBoard(boardName: string): string {
    // Extract project key from board name (e.g., "ATK Board" -> "ATK")
    const bankProjectKeys = ['ATK', 'ALB', 'AN', 'BB', 'EK', 'OB', 'QNB', 'TFKB', 'VK', 'ZK', 'DK', 'HF'];
    for (const key of bankProjectKeys) {
      if (boardName.toUpperCase().includes(key)) {
        return key;
      }
    }
    return 'UNKNOWN';
  }

  async getDeveloperWorkloadAnalysis(): Promise<DeveloperWorkload[]> {
    try {
      // Check if we have cached workload data
      const cacheKey = 'workload-analysis';
      const cached = this.getFromCache<DeveloperWorkload[]>(cacheKey);
      if (cached) {
        return cached;
      }

      const { jiraFilterService } = await import('./jiraFilterService');
      const [allowedDevelopers, selectedProjectKeys] = await Promise.all([
        jiraFilterService.getDeveloperNames(),
        jiraFilterService.getProjectKeys()
      ]);

      if (allowedDevelopers.length === 0) {
        console.warn('⚠️ Seçili yazılımcı bulunmuyor. Lütfen JIRA Filtre Yönetimi sayfasından yazılımcı seçin.');
        return [];
      }

      if (selectedProjectKeys.length === 0) {
        console.warn('⚠️ Seçili proje bulunmuyor. Lütfen JIRA Filtre Yönetimi sayfasından proje seçin.');
      }

      const activeSprints = await this.getAllActiveSprints();

      const filteredSprints = selectedProjectKeys.length > 0
        ? activeSprints.filter(({ projectKey }) => selectedProjectKeys.includes(projectKey))
        : activeSprints;

      const allTasks: JiraTask[] = [];

      console.log(`📊 ${filteredSprints.length} aktif sprint bulundu, görevler yükleniyor...`);

      for (const { sprint, projectKey } of filteredSprints) {
        console.log(`🔄 ${this.getProjectNameFromKey(projectKey)} - ${sprint.name} yükleniyor...`);
        const tasks = await this.getSprintIssues(sprint.id);
        const tasksWithProject = tasks.map(task => ({
          ...task,
          project: this.getProjectNameFromKey(projectKey),
          sprint: sprint.name
        }));
        allTasks.push(...tasksWithProject);
      }

      console.log(`✅ Toplam ${allTasks.length} görev yüklendi`);

      // Group tasks by developer
      const developerTasksMap = new Map<string, JiraTask[]>();
      
      // allowedDevelopers'ı normalize edilmiş şekilde hazırla
      const normalizedAllowed = allowedDevelopers.map(name => this.normalizeName(name));
      
      // Analiz ve rapor hesaplamalarında Unassigned olanları filtrele
      allTasks.forEach(task => {
        if (
          task.assignee &&
          task.assignee !== 'Unassigned' &&
          task.assignee.toLowerCase() !== 'unassigned' &&
          task.assignee.toLowerCase() !== 'unassigned@company.com' &&
          normalizedAllowed.includes(this.normalizeName(task.assignee))
        ) {
          if (!developerTasksMap.has(task.assignee)) {
            developerTasksMap.set(task.assignee, []);
          }
          developerTasksMap.get(task.assignee)!.push(task);
        }
      });

      // Calculate workload for each developer
      const workloadAnalysis: DeveloperWorkload[] = [];

      developerTasksMap.forEach((tasks, developer) => {
        const totalTasks = tasks.length;
        const totalHours = tasks.reduce((sum, task) => sum + task.estimatedHours, 0);
        
        // Group tasks by project and sprint
        const projectSprintMap = new Map<string, Map<string, JiraTask[]>>();
        
        tasks.forEach(task => {
          if (!projectSprintMap.has(task.project)) {
            projectSprintMap.set(task.project, new Map());
          }
          
          const sprintMap = projectSprintMap.get(task.project)!;
          if (!sprintMap.has(task.sprint)) {
            sprintMap.set(task.sprint, []);
          }
          
          sprintMap.get(task.sprint)!.push(task);
        });

        // Create project-sprint details
        const details: ProjectSprintDetail[] = [];
        projectSprintMap.forEach((sprintMap, project) => {
          sprintMap.forEach((sprintTasks, sprint) => {
            details.push({
              project,
              sprint,
              taskCount: sprintTasks.length,
              hours: sprintTasks.reduce((sum, task) => sum + task.estimatedHours, 0),
              actualHours: sprintTasks.reduce((sum, task) => sum + task.actualHours, 0),
              tasks: sprintTasks
            });
          });
        });

        // Determine status based on total hours
        let status: 'Eksik Yük' | 'Yeterli' | 'Aşırı Yük';
        if (totalHours < 70) {
          status = 'Eksik Yük';
        } else if (totalHours <= 90) {
          status = 'Yeterli';
        } else {
          status = 'Aşırı Yük';
        }

        workloadAnalysis.push({
          developer,
          email: this.getDeveloperEmail(developer),
          totalTasks,
          totalHours,
          totalActualHours: tasks.reduce((sum, task) => sum + task.actualHours, 0),
          status,
          details: details.sort((a, b) => b.hours - a.hours) // Sort by hours descending
        });
      });

      const result = workloadAnalysis.sort((a, b) => a.totalHours - b.totalHours);
      
      // Cache the result
      this.setCache(cacheKey, result);
      
      console.log(`📈 ${result.length} yazılımcının analizi tamamlandı`);
      
      return result;
    } catch (error) {
      console.error('Error analyzing developer workload:', error);
      throw error;
    }
  }

  private getProjectNameFromKey(key: string): string {
    const projectNames: { [key: string]: string } = {
      'ATK': 'Albaraka Türk Katılım Bankası',
      'ALB': 'Alternatif Bank',
      'AN': 'Anadolubank',
      'BB': 'Burgan Bank',
      'EK': 'Emlak Katılım',
      'OB': 'OdeaBank',
      'QNB': 'QNB Bank',
      'TFKB': 'Türkiye Finans Katılım Bankası',
      'VK': 'Vakıf Katılım',
      'ZK': 'Ziraat Katılım Bankası',
      'DK': 'Dünya Katılım',
      'ASS': 'Aylık Statü Sunumları',
      'HF': 'Hayat Finans'
    };
    return projectNames[key] || key;
  }

  private getDeveloperEmail(name: string): string {
    // Convert name to email format
    const emailMap: { [name: string]: string } = {
      'Buse Eren': 'buse.eren@acerpro.com.tr',
      'Canberk İsmet DİZDAŞ': 'canberk.dizdas@acerpro.com.tr',
      'Melih Meral': 'melih.meral@acerpro.com.tr',
      'Onur Demir': 'onur.demir@acerpro.com.tr',
      'Sezer SİNANOĞLU': 'sezer.sinanoglu@acerpro.com.tr',
      'Gizem Akay': 'gizem.akay@acerpro.com.tr',
      'Rüstem CIRIK': 'rustem.cirik@acerpro.com.tr',
      'Ahmet Tunç': 'ahmet.tunc@acerpro.com.tr',
      'Soner Canki': 'soner.canki@acerpro.com.tr',
      'Alicem Polat': 'alicem.polat@acerpro.com.tr',
      'Suat Aydoğdu': 'suat.aydogdu@acerpro.com.tr',
      'Oktay MANAVOĞLU': 'oktay.manavoglu@acerpro.com.tr',
      'Fahrettin DEMİRBAŞ': 'fahrettin.demirbas@acerpro.com.tr',
      'Abolfazl Pourmohammad': 'abolfazl.pourmohammad@acerpro.com.tr',
      'Feyza Bilgiç': 'feyza.bilgic@acerpro.com.tr',
      'Hüseyin ORAL': 'huseyin.oral@acerpro.com.tr'
    };
    
    return emailMap[name] || `${name.toLowerCase().replace(/\s+/g, '.')}@company.com`;
  }

  // Türkçe karakter ve büyük/küçük harf duyarsız karşılaştırma için normalize fonksiyonu
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
      .replace(/[^a-zA-Z0-9\s]/g, '') // özel karakterleri kaldır
      .trim();
  }
}

export const jiraService = new JiraService();