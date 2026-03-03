import { supabase } from './supabase';
import { developerProjectKeyMap } from '../data/developerProjectMap';
import { DeveloperWorkload, JiraTask, JiraProject, JiraSprint, JiraBoard, ProjectSprintDetail } from '../types';
import { jiraFilterService } from './jiraFilterService';

// Cache interface
interface CacheData {
  data: any;
  timestamp: number;
  expiry: number;
}

// Global cache object
const cache = new Map<string, CacheData>();
const CACHE_DURATION = 15 * 60 * 1000; // 15 minutes (was 5, now moderate increase)
const IS_DEV = import.meta.env.DEV; // Development mode check

class SupabaseJiraService {

  private getFromCache<T>(key: string): T | null {
    const cached = cache.get(key);
    if (cached && Date.now() < cached.expiry) {
      return cached.data as T;
    }
    return null;
  }

  private toLocalYMD(isoString: string): string {
    const d = new Date(isoString);
    const y = d.getFullYear();
    const m = (d.getMonth() + 1).toString().padStart(2, '0');
    const day = d.getDate().toString().padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  // Harici yapılandırılabilir geliştirici -> proje anahtarı eşlemesi
  private static DEFAULT_DEVELOPER_PROJECT: { [name: string]: string } = developerProjectKeyMap;

  // Proje adından proje anahtarını bul (ters eşleme)
  private getProjectKeyFromName(name: string): string {
    const mapping: { [name: string]: string } = {
      'Albaraka Türk Katılım Bankası': 'ATK',
      'Alternatif Bank': 'ALB',
      'Anadolubank': 'AN',
      'Burgan Bank': 'BB',
      'Emlak Katılım': 'EK',
      'OdeaBank': 'OB',
      'QNB Bank': 'QNB',
      'Türkiye Finans Katılım Bankası': 'TFKB',
      'Vakıf Katılım': 'VK',
      'Ziraat Katılım Bankası': 'ZK',
      'Dünya Katılım': 'DK',
      'Aylık Statü Sunumları': 'ASS'
    };
    return mapping[name] || name;
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
  }

  private async callEdgeFunction<T>(functionName: string, options: any = {}): Promise<T> {
    try {
      // Development mode check - console.log only in dev
      if (IS_DEV) {
        console.log(`🚀 Calling Edge Function: ${functionName}`);
      }

      // Get company ID from localStorage
      const companyId = localStorage.getItem('companyId');
      if (!companyId) {
        throw new Error('Company ID not found. Please login again.');
      }

      // Add company ID header to options
      const headers = {
        'x-company-id': companyId,
        ...(options.headers || {})
      };

      const response = await supabase.functions.invoke(functionName, {
        ...options,
        headers
      });
      
      if (response.error) {
        console.error(`❌ Edge function ${functionName} error:`, response.error);
        
        // Handle different types of Supabase errors
        if (response.error.message?.includes('Failed to send a request to the Edge Function')) {
          throw new Error(`Supabase Edge Function '${functionName}' is not accessible. Please check:\n1. Supabase project is active\n2. Edge Functions are deployed\n3. Environment variables are set in Supabase Dashboard\n4. Your internet connection is stable`);
        }
        
        if (response.error.message?.includes('Missing required environment variables')) {
          throw new Error(`Jira credentials not configured in Supabase. Please go to:\nSupabase Dashboard → Project Settings → Edge Functions → Environment Variables\nAnd add: JIRA_EMAIL, JIRA_TOKEN, JIRA_BASE_URL`);
        }
        
        if (response.error.message?.includes('Function not found')) {
          throw new Error(`Edge Function '${functionName}' not found. Please ensure the function is deployed to your Supabase project.`);
        }
        
        // Generic error handling
        let errorMessage = response.error.message || 'Unknown Supabase error';
        if (response.error.context) {
          errorMessage += ` - Context: ${JSON.stringify(response.error.context)}`;
        }
        
        throw new Error(`Supabase Edge Function error: ${errorMessage}`);
      }
      
      if (response.data && response.data.error) {
        console.error(`❌ Edge function ${functionName} returned error:`, response.data);
        
        // Show helpful information if available
        const helpText = response.data.help ? `\n\nHelp: ${response.data.help}` : '';
        throw new Error(`${functionName}: ${response.data.error}${response.data.details ? ` - ${response.data.details}` : ''}${helpText}`);
      }
      
      return response.data;
    } catch (error: any) {
      // If it's already our custom error or a Supabase-specific error, re-throw it
      if (error.message?.includes('Supabase Edge Function') || 
          error.message?.includes('Jira credentials not configured') || 
          error.message?.includes('not accessible')) {
        throw error;
      }
      
      // Handle network and connection errors
      console.error(`❌ Network error calling ${functionName}:`, error);
      
      // Check for common network errors
      if (error.name === 'TypeError' && (error.message?.includes('fetch') || error.message?.includes('Failed to fetch'))) {
        throw new Error(`Network connection failed for '${functionName}'. This could be due to:\n1. Internet connection issues\n2. Supabase service unavailable\n3. Edge Function not deployed\n4. CORS or firewall blocking the request\n\nPlease check your connection and try again.`);
      }
      
      // Check for Supabase authentication errors
      if (error.message?.includes('Invalid JWT') || error.message?.includes('unauthorized')) {
        throw new Error(`Supabase authentication failed. Please check your VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in the .env file.`);
      }
      
      // Generic error fallback
      throw new Error(`Unexpected error calling '${functionName}': ${error.message || 'Unknown error'}. Please check the browser console for more details.`);
    }
  }

  async getProjects(): Promise<JiraProject[]> {
    const cacheKey = 'projects';
    const cached = this.getFromCache<JiraProject[]>(cacheKey);
    if (cached) return cached;

    try {
      console.log('🔄 Fetching projects from Jira...');
      const projects = await this.callEdgeFunction<JiraProject[]>('jira-proxy', {
        body: {
          endpoint: '/rest/api/3/project?fields=key,name,projectTypeKey,lead',
          method: 'GET'
        }
      });

      if (!Array.isArray(projects)) {
        console.error('❌ Projects response is not an array:', projects);
        throw new Error('Invalid projects response format');
      }

      console.log(`✅ Successfully fetched ${projects.length} projects`);
      this.setCache(cacheKey, projects);
      return projects;
    } catch (error) {
      console.error('❌ Error fetching projects:', error);
      throw error;
    }
  }

  async getAllUsers(): Promise<Array<{ accountId: string; displayName: string; emailAddress?: string; active: boolean }>> {
    const cacheKey = 'all-users';
    const cached = this.getFromCache<Array<{ accountId: string; displayName: string; emailAddress?: string; active: boolean }>>(cacheKey);
    if (cached) return cached;

    try {
      console.log('🔄 Fetching users from Jira...');
      const users = await this.callEdgeFunction<Array<{ accountId: string; displayName: string; emailAddress?: string; active: boolean }>>('jira-proxy', {
        body: {
          endpoint: '/rest/api/3/users/search?maxResults=1000',
          method: 'GET'
        }
      });

      if (!Array.isArray(users)) {
        console.error('❌ Users response is not an array:', users);
        throw new Error('Invalid users response format');
      }

      const activeUsers = users.filter(user => user.active);

      console.log(`✅ Successfully fetched ${activeUsers.length} active users`);
      this.setCache(cacheKey, activeUsers);
      return activeUsers;
    } catch (error) {
      console.error('❌ Error fetching users:', error);
      throw error;
    }
  }

  async getBoards(): Promise<JiraBoard[]> {
    try {
      if (IS_DEV) {
        console.log('🔄 Fetching boards from Jira...');
      }

      const allowedProjectKeys = await jiraFilterService.getProjectKeys();
      
      // OPTIMIZE: Cache key'i daha hızlı oluştur (sort yerine)
      const cacheKey = `boards-${allowedProjectKeys.sort().join(',')}`;
      const cached = this.getFromCache<JiraBoard[]>(cacheKey);
      if (cached) {
        if (IS_DEV) {
          console.log('✅ Returning boards from cache');
        }
        return cached;
      }

      const response = await this.callEdgeFunction<{ values: JiraBoard[] }>('jira-proxy', {
        body: {
          endpoint: '/rest/agile/1.0/board?maxResults=200&type=simple',
          method: 'GET'
        }
      });

      if (!response || !Array.isArray(response.values)) {
        console.error('❌ Boards response is invalid:', response);
        throw new Error('Invalid boards response format');
      }

      if (IS_DEV) {
        console.log(`📋 All boards from Jira (${response.values.length} total):`,
          response.values.map(b => `"${b.name}" (location.projectKey: ${b.location?.projectKey || 'N/A'})`).join(', ')
        );
      }

      // If no projects selected, return all boards
      if (allowedProjectKeys.length === 0) {
        if (IS_DEV) {
          console.log(`✅ No project filter active, returning all ${response.values.length} boards`);
        }
        this.setCache(cacheKey, response.values);
        return response.values;
      }

      const allowedBoardPatterns = allowedProjectKeys.flatMap(projectKey => {
        const patterns = [
          { pattern: new RegExp(`^${projectKey}(\\s*board)?$`, 'i'), projectKey }
        ];

        if (projectKey === 'VK') {
          patterns.push(
            { pattern: /vakıf\s*katılım/i, projectKey: 'VK' },
            { pattern: /vakif\s*katilim/i, projectKey: 'VK' }
          );
        } else if (projectKey === 'ZK') {
          patterns.push(
            { pattern: /ziraat\s*katılım/i, projectKey: 'ZK' },
            { pattern: /ziraat\s*katilim/i, projectKey: 'ZK' }
          );
        } else if (projectKey === 'OB') {
          patterns.push(
            { pattern: /OB\s*(panosu|board)/i, projectKey: 'OB' },
            { pattern: /Odea\s*(Bank|board)/i, projectKey: 'OB' }
          );
        } else if (projectKey === 'IGW') {
          patterns.push(
            { pattern: /InsurGateway/i, projectKey: 'IGW' },
            { pattern: /Insur\s*Gateway/i, projectKey: 'IGW' }
          );
        } else if (projectKey === 'AIR') {
          patterns.push(
            { pattern: /InsurGW\s*-\s*AIR/i, projectKey: 'AIR' },
            { pattern: /AIR/i, projectKey: 'AIR' }
          );
        }

        return patterns;
      });

      // OPTIMIZE: Set kullanarak O(1) lookup
      const allowedProjectKeysSet = new Set(allowedProjectKeys);
      
      const filteredBoards = response.values.filter(board => {
        // PRIORITY 1: If board has location.projectKey, check if it's in allowed projects
        // This is the most reliable way to match boards to projects
        if (board.location?.projectKey && allowedProjectKeysSet.has(board.location.projectKey)) {
          board.projectKey = board.location.projectKey;
          if (IS_DEV) {
            console.log(`✅ Board matched by location.projectKey: "${board.name}" → ${board.location.projectKey}`);
          }
          return true;
        }

        // PRIORITY 2: Try to match by board name pattern (fallback for boards without location)
        const matchedPattern = allowedBoardPatterns.find(p => p.pattern.test(board.name));
        if (matchedPattern) {
          board.projectKey = matchedPattern.projectKey;
          if (IS_DEV) {
            console.log(`✅ Board matched by name: "${board.name}" → ${matchedPattern.projectKey}`);
          }
          return true;
        }

        return false;
      });

      if (IS_DEV) {
        console.log(`✅ Successfully fetched ${filteredBoards.length} allowed boards from ${allowedProjectKeys.length} selected projects`);
      }
      this.setCache(cacheKey, filteredBoards);
      return filteredBoards;
    } catch (error) {
      console.error('❌ Error fetching boards:', error);
      throw error;
    }
  }

  async getActiveSprintsForBoard(boardId: string, boardsCache?: JiraBoard[]): Promise<JiraSprint[]> {
    const cacheKey = `active-sprints-${boardId}`;
    const cached = this.getFromCache<JiraSprint[]>(cacheKey);
    if (cached) return cached;

    try {
      // Board bilgisini cache'den al (eğer verilmişse) veya çek
      let board: JiraBoard | undefined;
      if (boardsCache) {
        board = boardsCache.find(b => b.id === boardId);
      } else {
        const boards = await this.getBoards();
        board = boards.find(b => b.id === boardId);
      }
      const projectKey = board ? (board.projectKey || this.extractProjectKeyFromBoard(board.name)) : 'UNKNOWN';

      // Tüm aktif sprintleri al
      const maxResults = 50;
      if (IS_DEV) {
        console.log(`📊 ${projectKey} projesi için tüm aktif sprint alınacak`);
      }
      
      const response = await this.callEdgeFunction<{ values: JiraSprint[] }>('jira-proxy', {
        body: { 
          endpoint: `/rest/agile/1.0/board/${boardId}/sprint?state=active&maxResults=${maxResults}`,
          method: 'GET'
        }
      });
      
      if (IS_DEV) {
        console.log(`📊 Found ${response.values.length} active sprints for board ${boardId} (${projectKey})`);
      }
      
      this.setCache(cacheKey, response.values);
      return response.values;
    } catch (error) {
      console.warn(`Could not fetch sprints for board ${boardId}:`, error);
      return [];
    }
  }

  async getAllClosedSprintsForBoard(boardId: string, boardsCache?: JiraBoard[]): Promise<JiraSprint[]> {
    const cacheKey = `all-closed-sprints-${boardId}`;
    const cached = this.getFromCache<JiraSprint[]>(cacheKey);
    if (cached) return cached;

    try {
      // Board bilgisini cache'den al (eğer verilmişse) veya çek
      let board: JiraBoard | undefined;
      if (boardsCache) {
        board = boardsCache.find(b => b.id === boardId);
      } else {
        const boards = await this.getBoards();
        board = boards.find(b => b.id === boardId);
      }
      const projectKey = board ? (board.projectKey || this.extractProjectKeyFromBoard(board.name)) : 'UNKNOWN';

      // Tüm kapatılan sprintleri almak için sayfalama yap
      const pageSize = 50;
      const maxPages = 50; // Maksimum 2500 sprint (50 * 50)
      let startAt = 0;
      let pageIndex = 0;
      const allClosed: JiraSprint[] = [];

      // Tüm sayfaları çek
      while (pageIndex < maxPages) {
        const page = await this.callEdgeFunction<{ values: JiraSprint[] }>('jira-proxy', {
          body: {
            endpoint: `/rest/agile/1.0/board/${boardId}/sprint?state=closed&maxResults=${pageSize}&startAt=${startAt}`,
            method: 'GET'
          }
        });

        const values = Array.isArray(page?.values) ? page.values : [];
        if (IS_DEV) {
          console.log(`📄 Closed sprints page ${pageIndex + 1}: fetched ${values.length} items (startAt=${startAt})`);
        }
        allClosed.push(...values);

        if (values.length < pageSize) {
          // Son sayfaya ulaşıldı
          break;
        }

        startAt += pageSize;
        pageIndex += 1;
      }

      if (IS_DEV) {
        console.log(`📊 Aggregated ${allClosed.length} total closed sprints for board ${boardId} (${projectKey})`);
      }
      
      // Geçerli endDate'i olan sprint'leri filtrele ve sırala
      const validClosedSprints = allClosed
        .filter(sprint => {
          if (!sprint.endDate || sprint.state !== 'closed') return false;
          try {
            const dateObj = new Date(sprint.endDate);
            return !isNaN(dateObj.getTime()) && dateObj.getFullYear() > 2020;
          } catch {
            return false;
          }
        })
        .sort((a, b) => {
          try {
            const dateA = new Date(a.endDate!);
            const dateB = new Date(b.endDate!);
            
            // Önce completeDate'e bak (varsa), yoksa endDate kullan
            const finalDateA = a.completeDate ? new Date(a.completeDate) : dateA; 
            const finalDateB = b.completeDate ? new Date(b.completeDate) : dateB;
            
            return finalDateB.getTime() - finalDateA.getTime(); // En yeni tarih önce
          } catch (error) {
            console.warn(`❌ Date parsing error for sprints ${a.name} vs ${b.name}:`, error);
            return 0;
          }
        });
      
      if (IS_DEV && validClosedSprints.length > 0) {
        console.log(`📊 All ${validClosedSprints.length} closed sprint(s) for board ${boardId} (${projectKey})`);
      }
      
      this.setCache(cacheKey, validClosedSprints);
      return validClosedSprints;
    } catch (error) {
      console.warn(`Could not fetch all closed sprints for board ${boardId}:`, error);
      return [];
    }
  }

  async getLastClosedSprintForBoard(boardId: string, boardsCache?: JiraBoard[]): Promise<JiraSprint[]> {
    const cacheKey = `last-closed-sprints-${boardId}`;
    const cached = this.getFromCache<JiraSprint[]>(cacheKey);
    if (cached) return cached;

    try {
      // Board bilgisini cache'den al (eğer verilmişse) veya çek
      let board: JiraBoard | undefined;
      if (boardsCache) {
        board = boardsCache.find(b => b.id === boardId);
      } else {
        const boards = await this.getBoards();
        board = boards.find(b => b.id === boardId);
      }
      const projectKey = board ? (board.projectKey || this.extractProjectKeyFromBoard(board.name)) : 'UNKNOWN';

      // Son 1 kapatılan sprint alınacak
      const maxResults = 1;
      
      // OPTIMIZE: Akıllı sayfalama - önce birkaç sayfa çek, eğer yeterli geçerli sprint varsa dur
      // Jira Agile API, closed sprint listesinde tutarlı sıralama döndürmeyebilir
      // Bu yüzden birkaç sayfa çekip client-side sıralama yapıyoruz
      const pageSize = 50;
      const initialPages = 3; // İlk 3 sayfa (150 sprint) - genellikle yeterli
      const maxPages = 20; // üst sınır (50 * 20 = 1000 sprint) - fallback
      let startAt = 0;
      let pageIndex = 0;
      const allClosed: JiraSprint[] = [];
      let foundValidSprint = false;
      let latestValidDate: Date | null = null;

      // İlk birkaç sayfayı çek
      while (pageIndex < initialPages) {
        const page = await this.callEdgeFunction<{ values: JiraSprint[] }>('jira-proxy', {
          body: {
            endpoint: `/rest/agile/1.0/board/${boardId}/sprint?state=closed&maxResults=${pageSize}&startAt=${startAt}`,
            method: 'GET'
          }
        });

        const values = Array.isArray(page?.values) ? page.values : [];
        if (IS_DEV) {
          console.log(`📄 Closed sprints page ${pageIndex + 1}: fetched ${values.length} items (startAt=${startAt})`);
        }
        allClosed.push(...values);

        // Geçerli sprint'leri kontrol et
        for (const sprint of values) {
          if (sprint.endDate && sprint.state === 'closed') {
            try {
              const dateObj = new Date(sprint.endDate);
              if (!isNaN(dateObj.getTime()) && dateObj.getFullYear() > 2020) {
                const finalDate = sprint.completeDate ? new Date(sprint.completeDate) : dateObj;
                if (!latestValidDate || finalDate > latestValidDate) {
                  latestValidDate = finalDate;
                  foundValidSprint = true;
                }
              }
            } catch (e) {
              // Skip invalid date
            }
          }
        }

        if (values.length < pageSize) {
          // Son sayfaya ulaşıldı
          break;
        }

        startAt += pageSize;
        pageIndex += 1;
      }

      // Eğer ilk sayfalarda geçerli sprint bulunduysa ve yeterli sayıda sprint varsa, daha fazla çekme
      // Ama eğer çok az sprint varsa veya hiç geçerli sprint yoksa, daha fazla sayfa çek
      if (foundValidSprint && allClosed.length >= 50) {
        // İlk sayfalarda yeterli sprint var, daha fazla çekmeye gerek yok
        if (IS_DEV) {
          console.log(`✅ Found valid sprint in first ${pageIndex} pages, stopping pagination early`);
        }
      } else if (allClosed.length === pageSize * initialPages) {
        // Tüm sayfalar dolu, daha fazla sprint olabilir - birkaç sayfa daha çek
        if (IS_DEV) {
          console.log(`⚠️ First ${initialPages} pages are full, fetching more pages to ensure we have the latest sprint`);
        }
        
        while (pageIndex < maxPages) {
          const page = await this.callEdgeFunction<{ values: JiraSprint[] }>('jira-proxy', {
            body: {
              endpoint: `/rest/agile/1.0/board/${boardId}/sprint?state=closed&maxResults=${pageSize}&startAt=${startAt}`,
              method: 'GET'
            }
          });

          const values = Array.isArray(page?.values) ? page.values : [];
          if (IS_DEV) {
            console.log(`📄 Closed sprints page ${pageIndex + 1}: fetched ${values.length} items (startAt=${startAt})`);
          }
          allClosed.push(...values);

          if (values.length < pageSize) {
            break;
          }

          startAt += pageSize;
          pageIndex += 1;
          
          // Eğer yeterli geçerli sprint bulunduysa dur (optimizasyon)
          if (foundValidSprint && allClosed.length >= 100) {
            break;
          }
        }
      }

      if (IS_DEV) {
        console.log(`📊 Aggregated ${allClosed.length} total closed sprints for board ${boardId} (${projectKey})`);
      }
      
      // Geçerli endDate'i olan sprint'leri filtrele ve sırala - optimize edilmiş
      const validClosedSprints = allClosed
        .filter(sprint => {
          if (!sprint.endDate || sprint.state !== 'closed') return false;
          try {
            const dateObj = new Date(sprint.endDate);
            return !isNaN(dateObj.getTime()) && dateObj.getFullYear() > 2020;
          } catch {
            return false;
          }
        })
        .sort((a, b) => {
          try {
            const dateA = new Date(a.endDate!);
            const dateB = new Date(b.endDate!);
            
            // Önce completeDate'e bak (varsa), yoksa endDate kullan
            const finalDateA = a.completeDate ? new Date(a.completeDate) : dateA; 
            const finalDateB = b.completeDate ? new Date(b.completeDate) : dateB;
            
            return finalDateB.getTime() - finalDateA.getTime(); // En yeni tarih önce
          } catch (error) {
            console.warn(`❌ Date parsing error for sprints ${a.name} vs ${b.name}:`, error);
            return 0;
          }
        });
      
      // Son kapatılan sprint
      const lastClosedSprints = validClosedSprints.slice(0, maxResults);
      
      if (IS_DEV && lastClosedSprints.length > 0) {
        console.log(`📊 LATEST ${maxResults} closed sprint(s) for board ${boardId} (${projectKey}):`, 
          lastClosedSprints.map(sprint => ({
            name: sprint.name,
            endDate: sprint.endDate,
            completeDate: sprint.completeDate
          }))
        );
      }
      
      this.setCache(cacheKey, lastClosedSprints);
      return lastClosedSprints; // Array döndür
    } catch (error) {
      console.warn(`Could not fetch last closed sprints for board ${boardId}:`, error);
      return [];
    }
  }

  async getActiveSprintsForProject(projectKey: string): Promise<JiraSprint[]> {
    try {
      const boards = await this.getBoards();
      const projectBoard = boards.find(board => {
        const boardProjectKey = this.extractProjectKeyFromBoard(board.name);
        return boardProjectKey === projectKey;
      });
      
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
      const response = await this.callEdgeFunction<{ key: string; id: string }>('jira-create-issue', {
        body: issueData
      });

      // Clear cache to refresh data
      this.clearCache();

      return response;
    } catch (error) {
      console.error('Error creating Jira issue:', error);
      throw error;
    }
  }

  async getSprintIssues(sprintId: string, createdDateRange?: [string | null, string | null]): Promise<JiraTask[]> {
    const cacheKey = `sprint-issues-${sprintId}-${createdDateRange?.[0] || 'null'}-${createdDateRange?.[1] || 'null'}`;
    const cached = this.getFromCache<JiraTask[]>(cacheKey);
    if (cached) return cached;

    try {
      if (IS_DEV) {
        console.log(`🔄 Fetching issues for sprint ${sprintId}...`);
      }
      
      // OPTIMIZE: JQL string building - template literal kullan
      const [start, end] = createdDateRange || [null, null];
      let jql = `sprint = ${sprintId}`;
      if (start) jql += ` AND created >= "${start}"`;
      if (end) jql += ` AND created <= "${end} 23:59"`;
      jql += ' ORDER BY created DESC';
      
      // Single API call to get all issues with subtasks
      const response = await this.callEdgeFunction<{ issues: any[] }>('jira-proxy', {
        body: { 
          endpoint: `/rest/api/3/search?jql=${encodeURIComponent(jql)}&maxResults=500&fields=summary,description,status,assignee,project,priority,created,updated,timeoriginalestimate,timespent,subtasks,issuetype,parent`,
          method: 'GET'
        }
      });
      
      if (!response.issues || !Array.isArray(response.issues)) {
        if (IS_DEV) {
          console.warn(`⚠️ No issues found for sprint ${sprintId}`);
        }
        return [];
      }
      
      if (IS_DEV) {
        console.log(`📊 Sprint ${sprintId}: Found ${response.issues.length} issues`);
      }
      
      const allTasks: JiraTask[] = [];
      
      // Debug: Epic'leri ve issue type'ları kontrol et
      if (IS_DEV) {
        const issueTypes = new Map<string, number>();
        let epicCount = 0;
        for (const issue of response.issues) {
          const issueType = issue.fields.issuetype?.name || 'Unknown';
          issueTypes.set(issueType, (issueTypes.get(issueType) || 0) + 1);
          if (issueType.toLowerCase() === 'epic') {
            epicCount++;
          }
        }
        console.log(`📊 Sprint ${sprintId} Issue Types:`, Object.fromEntries(issueTypes));
        if (epicCount > 0) {
          console.log(`🎯 Sprint ${sprintId}: Found ${epicCount} Epic(s)`);
        }
      }
      
      // OPTIMIZE: Process all issues - for loop yerine map kullan (daha hızlı)
      for (const issue of response.issues) {
        const issueTypeName = issue.fields.issuetype?.name || '';
        // Epic'ler subtask değildir, parent'ı olsa bile
        const isSubtask = (issue.fields.issuetype?.subtask === true || 
                          issue.fields.issuetype?.name === 'Sub-task') &&
                          issueTypeName.toLowerCase() !== 'epic';
        
        // OPTIMIZE: Saat hesaplamalarını önceden yap
        const estimatedHours = issue.fields.timeoriginalestimate 
          ? parseFloat((issue.fields.timeoriginalestimate / 3600).toFixed(2)) 
          : 0;
        const actualHours = issue.fields.timespent 
          ? parseFloat((issue.fields.timespent / 3600).toFixed(2)) 
          : 0;
        
        const task: JiraTask = {
          id: issue.id,
          key: issue.key,
          summary: issue.fields.summary,
          description: issue.fields.description,
          status: issue.fields.status.name,
          assignee: issue.fields.assignee?.displayName || 'Atanmamış',
          project: issue.fields.project.name,
          projectKey: issue.fields.project.key,
          sprint: sprintId,
          estimatedHours,
          actualHours,
          priority: issue.fields.priority?.name || 'Medium',
          created: issue.fields.created,
          updated: issue.fields.updated,
          parentKey: issue.fields.parent?.key || null,
          isSubtask: isSubtask,
          issueType: issue.fields.issuetype?.name,
          worklogs: []
        };
        
        allTasks.push(task);
      }
      
      // OPTIMIZE: Parent backfill'i optimize et - sadece gerçekten eksik olanları çek
      try {
        const existingMainKeys = new Set(allTasks.filter(t => !t.isSubtask).map(t => t.key));
        const missingParentKeys = new Set<string>();
        
        // Eksik parent key'leri topla - optimize edilmiş
        // Epic'lerin parent'ı olabilir ama Epic'ler subtask değildir
        for (const issue of response.issues) {
          const issueTypeName = issue.fields.issuetype?.name || '';
          const isSubtask = issue.fields.issuetype?.subtask === true || 
                           issue.fields.issuetype?.name === 'Sub-task';
          const hasParent = !!issue.fields.parent;
          
          // Sadece gerçek subtask'ların parent'larını kontrol et
          if ((isSubtask || hasParent) && issue.fields.parent?.key && issueTypeName.toLowerCase() !== 'epic') {
            const parentKey = issue.fields.parent.key;
            if (!existingMainKeys.has(parentKey)) {
              missingParentKeys.add(parentKey);
            }
          }
        }
        
        // Debug: TFKB projesi için Epic kontrolü
        if (IS_DEV && missingParentKeys.size > 0) {
          const epicParents = allTasks.filter(t => 
            t.issueType?.toLowerCase() === 'epic' && 
            missingParentKeys.has(t.key)
          );
          if (epicParents.length > 0) {
            console.log(`🎯 Sprint ${sprintId}: Found ${epicParents.length} Epic(s) that are parents but not in sprint`);
          }
        }

        if (missingParentKeys.size > 0) {
          if (IS_DEV) {
            console.log(`🔁 Sprint ${sprintId}: Fetching ${missingParentKeys.size} missing parent issues`);
          }
          
          // OPTIMIZE: Tüm parent'ları tek batch'te çek (Jira IN clause limit 1000)
          const parentKeysArray = Array.from(missingParentKeys);
          const batchSize = 100; // Jira limit'i güvenli şekilde kullan
          
          for (let i = 0; i < parentKeysArray.length; i += batchSize) {
            const batch = parentKeysArray.slice(i, i + batchSize);
            const parentJql = `issuekey in (${batch.map(k => `'${k}'`).join(',')})`;
            const parentResp = await this.callEdgeFunction<{ issues: any[] }>('jira-proxy', {
              body: {
                endpoint: `/rest/api/3/search?jql=${encodeURIComponent(parentJql)}&maxResults=${batch.length}&fields=summary,description,status,assignee,project,priority,created,updated,timeoriginalestimate,timespent,issuetype`,
                method: 'GET'
              }
            });
            
            // OPTIMIZE: Set kullanarak duplicate kontrolü (O(1) lookup)
            const existingKeys = new Set(allTasks.map(t => t.key));
            
            for (const issue of parentResp.issues || []) {
              if (existingKeys.has(issue.key)) continue; // Zaten var
              
              const task: JiraTask = {
                id: issue.id,
                key: issue.key,
                summary: issue.fields.summary,
                description: issue.fields.description,
                status: issue.fields.status.name,
                assignee: issue.fields.assignee?.displayName || 'Atanmamış',
                project: issue.fields.project.name,
                projectKey: issue.fields.project.key,
                sprint: sprintId,
                estimatedHours: issue.fields.timeoriginalestimate ? parseFloat((issue.fields.timeoriginalestimate / 3600).toFixed(2)) : 0,
                actualHours: issue.fields.timespent ? parseFloat((issue.fields.timespent / 3600).toFixed(2)) : 0,
                priority: issue.fields.priority?.name || 'Medium',
                created: issue.fields.created,
                updated: issue.fields.updated,
                parentKey: null,
                isSubtask: false,
                issueType: issue.fields.issuetype?.name,
                worklogs: []
              };
              
              allTasks.push(task);
              existingKeys.add(task.key);
            }
          }
        }
      } catch (parentFetchErr) {
        console.warn(`⚠️ Sprint ${sprintId}: Failed to backfill parent issues for subtasks:`, parentFetchErr);
      }

      if (IS_DEV) {
        console.log(`✅ Sprint ${sprintId}: Processed ${allTasks.length} tasks (including parent backfill if needed)`);
      }
      this.setCache(cacheKey, allTasks);
      return allTasks;
    } catch (error) {
      console.warn(`Could not fetch issues for sprint ${sprintId}:`, error);
      return [];
    }
  }

  async getAllActiveSprints(): Promise<{ sprint: JiraSprint; boardName: string; projectKey: string }[]> {
    return this.getAllSprints('active');
  }

  async getAllClosedSprints(): Promise<{ sprint: JiraSprint; boardName: string; projectKey: string; sprintType: string }[]> {
    const cacheKey = `all-closed-sprints-all-boards`;
    const cached = this.getFromCache<{ sprint: JiraSprint; boardName: string; projectKey: string; sprintType: string }[]>(cacheKey);
    if (cached) return cached;

    if (IS_DEV) {
      console.log(`🔄 Starting to fetch all closed sprints from all boards...`);
    }

    // OPTIMIZE: Board'ları ve project keys'i önceden çek (tekrar çağrıları önle)
    const [allowedProjectKeys, boards] = await Promise.all([
      jiraFilterService.getProjectKeys(),
      this.getBoards()
    ]);

    if (IS_DEV) {
      console.log(`📋 Allowed project keys: ${allowedProjectKeys.length > 0 ? allowedProjectKeys.join(', ') : 'All projects'}`);
      console.log(`📊 Total boards found: ${boards.length}`);
    }

    const allSprints: { sprint: JiraSprint; boardName: string; projectKey: string; sprintType: string }[] = [];

    // OPTIMIZE: Board'ları paralel işle ama board cache'ini geçir
    const boardPromises = boards.map(async (board) => {
      let projectKey = board.projectKey || this.extractProjectKeyFromBoard(board.name);

      // If projectKey is UNKNOWN and board has location.projectKey, use that
      if (projectKey === 'UNKNOWN' && board.location?.projectKey) {
        projectKey = board.location.projectKey;
      }

      if (allowedProjectKeys.length > 0 && !allowedProjectKeys.includes(projectKey)) {
        return [];
      }

      const boardSprints: typeof allSprints = [];
      
      try {
        // Tüm kapatılan sprintleri getir
        const allClosedSprints = await this.getAllClosedSprintsForBoard(board.id, boards);
        if (allClosedSprints.length > 0) {
          for (const sprint of allClosedSprints) {
            boardSprints.push({
              sprint: {
                ...sprint,
                boardId: board.id,
                projectKey
              },
              boardName: board.name,
              projectKey,
              sprintType: 'closed'
            });
          }
        }
      } catch (error) {
        console.warn(`❌ Error processing board ${board.name}:`, error);
      }
      
      return boardSprints;
    });
    
    // Wait for all boards to be processed
    const boardResults = await Promise.all(boardPromises);
    boardResults.forEach(boardSprints => {
      allSprints.push(...boardSprints);
    });
    
    if (IS_DEV) {
      console.log(`✅ Total closed sprints found: ${allSprints.length}`);
    }
    
    this.setCache(cacheKey, allSprints);
    return allSprints;
  }

  async getAllSprints(type: 'active' | 'closed' = 'active'): Promise<{ sprint: JiraSprint; boardName: string; projectKey: string; sprintType: string }[]> {
    const cacheKey = `all-sprints-${type}`;
    const cached = this.getFromCache<{ sprint: JiraSprint; boardName: string; projectKey: string; sprintType: string }[]>(cacheKey);
    if (cached) return cached;

    if (IS_DEV) {
      console.log(`🔄 Starting to fetch ${type} sprints from all boards...`);
    }

    // OPTIMIZE: Board'ları ve project keys'i önceden çek (tekrar çağrıları önle)
    const [allowedProjectKeys, boards] = await Promise.all([
      jiraFilterService.getProjectKeys(),
      this.getBoards()
    ]);

    if (IS_DEV) {
      console.log(`📋 Allowed project keys: ${allowedProjectKeys.length > 0 ? allowedProjectKeys.join(', ') : 'All projects'}`);
      console.log(`📊 Total boards found: ${boards.length}`);
    }

    const allSprints: { sprint: JiraSprint; boardName: string; projectKey: string; sprintType: string }[] = [];

    // OPTIMIZE: Board'ları paralel işle ama board cache'ini geçir
    const boardPromises = boards.map(async (board) => {
      let projectKey = board.projectKey || this.extractProjectKeyFromBoard(board.name);

      // If projectKey is UNKNOWN and board has location.projectKey, use that
      if (projectKey === 'UNKNOWN' && board.location?.projectKey) {
        projectKey = board.location.projectKey;
      }

      if (allowedProjectKeys.length > 0 && !allowedProjectKeys.includes(projectKey)) {
        return [];
      }

      const boardSprints: typeof allSprints = [];
      
      try {
        if (type === 'active') {
          // OPTIMIZE: Board cache'ini geçir (getBoards() tekrar çağrılmasın)
          const activeSprints = await this.getActiveSprintsForBoard(board.id, boards);
          
          for (const sprint of activeSprints) {
            boardSprints.push({
              sprint: {
                ...sprint,
                boardId: board.id,
                projectKey
              },
              boardName: board.name,
              projectKey,
              sprintType: 'active'
            });
          }
        }
        
        if (type === 'closed') {
          // OPTIMIZE: Board cache'ini geçir (getBoards() tekrar çağrılmasın)
          const lastClosedSprints = await this.getLastClosedSprintForBoard(board.id, boards);
          if (lastClosedSprints.length > 0) {
            for (const sprint of lastClosedSprints) {
              boardSprints.push({
                sprint: {
                  ...sprint,
                  boardId: board.id,
                  projectKey
                },
                boardName: board.name,
                projectKey,
                sprintType: 'closed'
              });
            }
          }
        }
      } catch (error) {
        console.warn(`❌ Error processing board ${board.name}:`, error);
      }
      
      return boardSprints;
    });
    
    // Wait for all boards to be processed
    const boardResults = await Promise.all(boardPromises);
    boardResults.forEach(boardSprints => {
      allSprints.push(...boardSprints);
    });
    
    if (IS_DEV) {
      console.log(`✅ Total ${type} sprints found: ${allSprints.length}`);
    }
    
    this.setCache(cacheKey, allSprints);
    return allSprints;
  }

  private extractProjectKeyFromBoard(boardName: string): string {
    const boardNameNormalized = boardName.toLowerCase().trim();

    // IGW ve AIR için kontrol (en üstte olmalı çünkü daha spesifik)
    if (boardNameNormalized.includes('insurgw') && boardNameNormalized.includes('air')) {
      return 'AIR';
    }

    if (boardNameNormalized.includes('insurgateway') || boardNameNormalized.includes('insur gateway')) {
      return 'IGW';
    }

    // VK ve ZK için daha spesifik kontrol
    if (boardNameNormalized === 'vk board' ||
        boardNameNormalized === 'vk' ||
        (boardNameNormalized.includes('vakıf') && boardNameNormalized.includes('katılım')) ||
        (boardNameNormalized.includes('vakif') && boardNameNormalized.includes('katilim'))) {
      return 'VK';
    }

    if (boardNameNormalized === 'zk board' ||
        boardNameNormalized === 'zk' ||
        (boardNameNormalized.includes('ziraat') && boardNameNormalized.includes('katılım')) ||
        (boardNameNormalized.includes('ziraat') && boardNameNormalized.includes('katilim'))) {
      return 'ZK';
    }

    if (boardNameNormalized.includes('odea') || boardNameNormalized.includes('ob panosu')) {
      return 'OB';
    }

    if (boardNameNormalized.includes('an board') || (boardNameNormalized.includes('an') && boardNameNormalized.includes('board'))) {
      return 'AN';
    } else if (boardNameNormalized.includes('tfkb')) {
      return 'TFKB';
    } else if (boardNameNormalized.includes('qnb')) {
      return 'QNB';
    } else if (boardNameNormalized.includes('atk')) {
      return 'ATK';
    } else if (boardNameNormalized.includes('alb')) {
      return 'ALB';
    } else if (boardNameNormalized.includes('bb')) {
      return 'BB';
    } else if (boardNameNormalized.includes('ek')) {
      return 'EK';
    } else if (boardNameNormalized.includes('dk')) {
      return 'DK';
    } else if (boardNameNormalized.includes('ass') || boardNameNormalized.includes('aylık') || boardNameNormalized.includes('statü') || boardNameNormalized.includes('sunum')) {
      return 'ASS';
    }

    console.warn(`⚠️ Unknown board name pattern: "${boardName}" (normalized: "${boardNameNormalized}")`);
    return 'UNKNOWN';
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
      'IGW': 'InsurGateway',
      'AIR': 'InsurGW - AIR'
    };
    return projectNames[key] || key;
  }

  private getDeveloperEmail(name: string): string {
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
      .replace(/[^a-zA-Z0-9\s]/g, '')
      .trim();
  }

  async getDeveloperWorkloadAnalysis(sprintType: 'active' | 'closed' = 'active'): Promise<DeveloperWorkload[]> {
    const cacheKey = `workload-analysis-${sprintType}`;
    const cached = this.getFromCache<DeveloperWorkload[]>(cacheKey);
    if (cached) return cached;

    try {
      if (IS_DEV) {
        console.log(`🔄 Starting workload analysis with ${sprintType} sprints...`);
      }
      
      // OPTIMIZE: Paralel olarak developer, proje haritası (öncelik: User Management > Jira Filtre > statik) ve sprint verilerini çek
      const [allowedDevelopers, developerProjectMapFromUsers, developerProjectMapFromJiraFilter, sprints] = await Promise.all([
        jiraFilterService.getDeveloperNames(),
        jiraFilterService.getDeveloperProjectMapFromUsers(),
        jiraFilterService.getDeveloperProjectMap(),
        this.getAllSprints(sprintType)
      ]);

      // Proje ataması önceliği: 1) Kullanıcı Yönetimi (users.assigned_projects), 2) Jira Filtre (selected_developers), 3) Statik harita
      const normalizedDeveloperProjectMap = new Map<string, Set<string>>();
      developerProjectMapFromUsers.forEach((projects, normalizedKey) => {
        normalizedDeveloperProjectMap.set(normalizedKey, new Set(projects));
      });
      developerProjectMapFromJiraFilter.forEach((projects, devName) => {
        const n = this.normalizeName(devName);
        if (!normalizedDeveloperProjectMap.has(n)) {
          normalizedDeveloperProjectMap.set(n, new Set(projects));
        }
      });
      Object.entries(SupabaseJiraService.DEFAULT_DEVELOPER_PROJECT).forEach(([name, key]) => {
        const n = this.normalizeName(name);
        if (!normalizedDeveloperProjectMap.has(n)) {
          normalizedDeveloperProjectMap.set(n, new Set([key]));
        }
      });
      
      if (IS_DEV) {
        console.log(`✅ Allowed developers from database: ${allowedDevelopers.length} developers`);
        console.log(`📊 Found ${sprints.length} ${sprintType} sprints`);
      }

      // OPTIMIZE: Sprint task'larını paralel çek (sıralı yerine)
      const allTasks: JiraTask[] = [];
      
      // Batch size: Her seferinde 5 sprint'in task'larını paralel çek
      const BATCH_SIZE = 5;
      for (let i = 0; i < sprints.length; i += BATCH_SIZE) {
        const batch = sprints.slice(i, i + BATCH_SIZE);
        
        const taskPromises = batch.map(async ({ sprint, projectKey }) => {
          try {
            const tasks = await this.getSprintIssues(sprint.id);
            const projectName = this.getProjectNameFromKey(projectKey);
            return tasks.map(task => ({
              ...task,
              project: projectName,
              projectKey: projectKey,
              sprint: sprint.name
            }));
          } catch (error) {
            console.error(`❌ Error fetching tasks for sprint ${sprint.name}:`, error);
            return [];
          }
        });

        const taskResults = await Promise.all(taskPromises);
        for (const tasks of taskResults) {
          allTasks.push(...tasks);
        }
      }
      
      if (IS_DEV) {
        console.log(`✅ Toplam ${allTasks.length} görev yüklendi`);
      }

      // OPTIMIZE: Group tasks by developer with project filtering - Set kullanarak O(1) lookup
      const developerTasksMap = new Map<string, JiraTask[]>();
      const normalizedAllowedSet = new Set(allowedDevelopers.map(name => this.normalizeName(name)));

      // OPTIMIZE: Tek geçişte filtreleme ve gruplama (normalizedDeveloperProjectMap yukarıda oluşturuldu)
      for (const task of allTasks) {
        if (!task.assignee || task.assignee === 'Unassigned' || task.assignee.toLowerCase() === 'unassigned') {
          continue;
        }
        
        const normalizedAssignee = this.normalizeName(task.assignee);
        if (!normalizedAllowedSet.has(normalizedAssignee)) {
          continue;
        }

        const allowedProjects = normalizedDeveloperProjectMap.get(normalizedAssignee);
        if (allowedProjects && allowedProjects.size > 0) {
          if (!allowedProjects.has(task.projectKey)) {
            if (IS_DEV) {
              console.log(`⏭️ Skipping task for ${task.assignee} - project ${task.projectKey} not in their allowed projects`);
            }
            continue;
          }
        }

        if (!developerTasksMap.has(task.assignee)) {
          developerTasksMap.set(task.assignee, []);
        }
        developerTasksMap.get(task.assignee)!.push(task);
      }

      // OPTIMIZE: Calculate workload for each developer - reduce kullanımını minimize et
      const workloadAnalysis: DeveloperWorkload[] = [];

      for (const [developer, tasks] of developerTasksMap) {
        const totalTasks = tasks.length;
        
        // OPTIMIZE: Tek geçişte tüm hesaplamaları yap
        let totalHours = 0;
        let totalActualHours = 0;
        const projectSprintMap = new Map<string, Map<string, JiraTask[]>>();
        
        for (const task of tasks) {
          totalHours += task.estimatedHours;
          totalActualHours += task.actualHours;
          
          // Group by project and sprint
          if (!projectSprintMap.has(task.project)) {
            projectSprintMap.set(task.project, new Map());
          }
          
          const sprintMap = projectSprintMap.get(task.project)!;
          if (!sprintMap.has(task.sprint)) {
            sprintMap.set(task.sprint, []);
          }
          
          sprintMap.get(task.sprint)!.push(task);
        }

        // Create project-sprint details - optimize edilmiş
        const details: ProjectSprintDetail[] = [];
        for (const [project, sprintMap] of projectSprintMap) {
          for (const [sprint, sprintTasks] of sprintMap) {
            let sprintHours = 0;
            let sprintActualHours = 0;
            
            for (const task of sprintTasks) {
              sprintHours += task.estimatedHours;
              sprintActualHours += task.actualHours;
            }
            
            details.push({
              project,
              sprint,
              taskCount: sprintTasks.length,
              hours: sprintHours,
              actualHours: sprintActualHours,
              tasks: sprintTasks
            });
          }
        }

        // Determine status based on total hours
        let status: 'Eksik Yük' | 'Yeterli' | 'Aşırı Yük';
        if (totalHours < 70) {
          status = 'Eksik Yük';
        } else if (totalHours <= 90) {
          status = 'Yeterli';
        } else {
          status = 'Aşırı Yük';
        }

        // Sort details by hours (descending)
        details.sort((a, b) => b.hours - a.hours);

        workloadAnalysis.push({
          developer,
          email: this.getDeveloperEmail(developer),
          totalTasks,
          totalHours,
          totalActualHours,
          status,
          details
        });
      }

      // Sort by total hours (ascending)
      workloadAnalysis.sort((a, b) => a.totalHours - b.totalHours);
      
      if (IS_DEV) {
        console.log(`📈 ${workloadAnalysis.length} yazılımcının analizi tamamlandı`);
      }
      
      this.setCache(cacheKey, workloadAnalysis);
      return workloadAnalysis;
    } catch (error) {
      console.error('Error analyzing developer workload:', error);
      throw error;
    }
  }

  // Simplified worklog fetching - only when specifically needed
  async getAllowedDevelopers(): Promise<string[]> {
    try {
      return await jiraFilterService.getDeveloperNames();
    } catch (error) {
      console.error('Error fetching allowed developers:', error);
      return [];
    }
  }

  async searchIssues(jql: string, maxResults: number = 100): Promise<any> {
    try {
      const response = await this.callEdgeFunction<{ issues: any[] }>('jira-proxy', {
        body: {
          endpoint: `/rest/api/3/search?jql=${encodeURIComponent(jql)}&maxResults=${maxResults}&fields=summary,description,status,assignee,project,priority,created,updated,timeoriginalestimate,timespent`,
          method: 'GET'
        }
      });
      return response;
    } catch (error) {
      console.error('Error searching issues:', error);
      throw error;
    }
  }

  async getWorklogDataForDateRange(startDate: string, endDate: string): Promise<Array<{
    author: { displayName: string; accountId: string };
    timeSpentSeconds: number;
    started: string;
    projectKey: string;
    projectName: string;
    issueKey: string;
    issueSummary: string;
    comment?: string;
    isSubtask?: boolean;
    parentKey?: string;
    issueTypeName?: string;
  }>> {
    const cacheKey = `worklog-range-${startDate}-${endDate}`;
    const cached = this.getFromCache<any[]>(cacheKey);
    if (cached) return cached;

    try {
      console.log(`🔄 Fetching worklog data for date range: ${startDate} to ${endDate}`);
      
      // Use a more efficient JQL query
      const jqlStartDate = startDate.replace(/-/g, '/');
      const jqlEndDate = endDate.replace(/-/g, '/');
      const jql = `worklogDate >= "${jqlStartDate}" AND worklogDate <= "${jqlEndDate}" ORDER BY updated DESC`;
      
      const response = await this.callEdgeFunction<{ issues: any[] }>('jira-proxy', {
        body: { 
          endpoint: `/rest/api/3/search?jql=${encodeURIComponent(jql)}&maxResults=1000&fields=worklog,summary,project,issuetype,parent`,
          method: 'GET'
        }
      });
      
      const allWorklogs: any[] = [];
      const allowedDevelopers = await jiraFilterService.getDeveloperNames();
      const normalizedAllowed = allowedDevelopers.map(n => this.normalizeName(n));
      
      for (const issue of response.issues || []) {
        const worklogs = issue.fields.worklog?.worklogs || [];
        
        for (const worklog of worklogs) {
          if (!worklog.started || !worklog.author?.displayName) continue;
          
          const worklogDate = worklog.started.split('T')[0];
          if (worklogDate < startDate || worklogDate > endDate) continue;
          
          if (normalizedAllowed.includes(this.normalizeName(worklog.author.displayName))) {
            allWorklogs.push({
              author: {
                displayName: worklog.author.displayName,
                accountId: worklog.author.accountId
              },
              timeSpentSeconds: worklog.timeSpentSeconds || 0,
              started: worklog.started,
              projectKey: issue.fields.project.key,
              projectName: issue.fields.project.name,
              issueKey: issue.key,
              issueSummary: issue.fields.summary,
              comment: worklog.comment,
              isSubtask: issue.fields.issuetype?.name === 'Sub-task',
              parentKey: issue.fields.parent?.key,
              issueTypeName: issue.fields.issuetype?.name
            });
          } 
        }
      }
      
      console.log(`✅ Total worklogs found: ${allWorklogs.length}`);
      this.setCache(cacheKey, allWorklogs);
      return allWorklogs;
    } catch (error) {
      console.error('❌ Error fetching worklog data:', error);
      throw error;
    }
  }
}

export const supabaseJiraService = new SupabaseJiraService();