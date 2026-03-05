import { supabase } from '../lib/supabase';
import { WorklogEntry, DailyWorklogSummary, DeveloperWorklogData, WorklogAnalytics } from '../types/worklog';
import { getWeekRange } from '../utils/dateUtils';
import { jiraFilterService } from '../lib/jiraFilterService';

// Cache for worklog data
const worklogCache = new Map<string, { data: any; timestamp: number; expiry: number }>();
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes - daha uzun cache süresi

class WorklogService {
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

  private async getAllowedDevelopers(): Promise<string[]> {
    try {
      return await jiraFilterService.getDeveloperNames();
    } catch (error) {
      console.error('Error fetching allowed developers:', error);
      return [];
    }
  }

  private async getAllowedProjects(): Promise<string[]> {
    try {
      return await jiraFilterService.getProjectKeys();
    } catch (error) {
      console.error('Error fetching allowed projects:', error);
      return [];
    }
  }

  private getFromCache<T>(key: string): T | null {
    const cached = worklogCache.get(key);
    if (cached && Date.now() < cached.expiry) {
      return cached.data as T;
    }
    return null;
  }

  private setCache<T>(key: string, data: T): void {
    worklogCache.set(key, {
      data,
      timestamp: Date.now(),
      expiry: Date.now() + CACHE_DURATION
    });
  }

  clearCache(): void {
    worklogCache.clear();
  }

  /** jira-proxy Edge Function çağrısı - x-company-id header zorunlu */
  private async invokeJiraProxy(options: { body: Record<string, unknown> }): Promise<any> {
    const companyId = typeof localStorage !== 'undefined' ? localStorage.getItem('companyId') : null;
    if (!companyId) {
      throw new Error('Company ID bulunamadı. Lütfen tekrar giriş yapın.');
    }
    const { data, error } = await supabase.functions.invoke('jira-proxy', {
      ...options,
      headers: { 'x-company-id': companyId }
    });
    if (error) throw error;
    return data;
  }

  // Aylık worklog verisi - ayın tüm günleri için
  async getMonthlyWorklogData(startDate: string, endDate: string, developerLeaveInfo?: any[]): Promise<DeveloperWorklogData[]> {
    console.log(`🚀 Getting MONTHLY worklog data for ${startDate} to ${endDate}`);

    const [allowedDevelopers, allowedProjects, developerEmailMap] = await Promise.all([
      this.getAllowedDevelopers(),
      this.getAllowedProjects(),
      // Bazı ortamlarda getDeveloperEmailMap henüz tanımlı olmayabilir; güvenli fallback kullan
      typeof (jiraFilterService as any).getDeveloperEmailMap === 'function'
        ? jiraFilterService.getDeveloperEmailMap()
        : Promise.resolve(new Map<string, string>())
    ]);
    console.log(`✅ Found ${allowedDevelopers.length} active developers from database`);
    console.log(`✅ Found ${allowedProjects.length} active projects from database:`, allowedProjects);

    const monthlyData: DeveloperWorklogData[] = [];

    // Ayın tüm günlerini oluştur
    const allDates: string[] = [];
    const currentDate = new Date(startDate);
    const endDateObj = new Date(endDate);

    while (currentDate <= endDateObj) {
      allDates.push(currentDate.toISOString().split('T')[0]);
      currentDate.setDate(currentDate.getDate() + 1);
    }

    console.log(`📅 Monthly dates: ${allDates.length} days from ${allDates[0]} to ${allDates[allDates.length - 1]}`);

    // Her yazılımcı için aylık worklog verisi çek
    for (const developer of allowedDevelopers) {
      console.log(`👤 Processing monthly data for: ${developer}`);
      
      try {
        // Bu yazılımcının ayın tüm günlerindeki worklog'larını çek
        const dailyHours: { [date: string]: number } = {};
        const dailyEntries: { [date: string]: WorklogEntry[] } = {};
        
        // Jira'dan bu yazılımcının bu ay aralığındaki tüm worklog'larını çek
        const jqlStartDate = startDate.replace(/-/g, '/');
        const jqlEndDate = endDate.replace(/-/g, '/');

        // Proje filtresi ekle (JQL syntax: project in ("KEY1", "KEY2"))
        const projectFilter = allowedProjects.length > 0
          ? `project in (${allowedProjects.map(p => `"${p}"`).join(', ')}) AND `
          : '';

        const jql = `${projectFilter}worklogAuthor = "${developer}" AND worklogDate >= "${jqlStartDate}" AND worklogDate <= "${jqlEndDate}" ORDER BY updated DESC`;

        console.log(`🔍 Monthly JQL for ${developer}: ${jql}`);

        const pageSize = 100;
        let startAt = 0;
        let total = Infinity;
        const developerIssues: any[] = [];
        
        // Sayfalı issue çekme (GET: POST /search/jql 400 Invalid payload dönüyor)
        while (startAt < total) {
          const fieldsParam = 'worklog,summary,project,issuetype,parent,updated,created';
          const searchUrl = `/rest/api/3/search/jql?jql=${encodeURIComponent(jql)}&startAt=${startAt}&maxResults=${pageSize}&fields=${encodeURIComponent(fieldsParam)}`;
          const page = await this.invokeJiraProxy({
            body: {
              endpoint: searchUrl,
              method: 'GET'
            }
          });

          const issues: any[] = page.issues || [];
          const pageTotal = typeof page.total === 'number' ? page.total : (startAt + issues.length);
          total = pageTotal;
          developerIssues.push(...issues);
          if (issues.length === 0) break;
          startAt += issues.length;
        }
        
        console.log(`📊 ${developer}: Found ${developerIssues.length} issues with worklogs in monthly range`);
        
        // Her issue için worklog'ları işle
        for (const issue of developerIssues) {
          let worklogs: any[] = [];
          
          // Issue fields'dan worklog bilgisini al
          if (issue.fields.worklog) {
            const wl = issue.fields.worklog;
            worklogs = Array.isArray(wl.worklogs) ? wl.worklogs : [];
            const total: number = typeof wl.total === 'number' ? wl.total : worklogs.length;
            const returned: number = worklogs.length;
            
            // Eğer tüm worklog'lar gelmemişse, sayfalama ile çek
            if (total > returned) {
              let start = returned;
              while (start < total) {
                try {
                  const pageResp = await this.invokeJiraProxy({
                    body: {
                      endpoint: `/rest/api/3/issue/${issue.id}/worklog?startAt=${start}&maxResults=100`,
                      method: 'GET'
                    }
                  });

                  const pageLogs = pageResp.worklogs || [];
                  worklogs.push(...pageLogs);
                  start += pageLogs.length;
                  if (pageLogs.length === 0) break;
                } catch (err) {
                  console.warn(`Could not fetch paged worklogs for issue ${issue.key}:`, err);
                  break;
                }
              }
            }
          }
          
          // Tarih aralığındaki worklog'ları filtrele ve günlük toplamları hesapla
          const filteredWorklogs = worklogs.filter(worklog => {
            if (!worklog.started) return false;
            const worklogDate = new Date(worklog.started).toLocaleDateString('en-CA', { timeZone: 'Europe/Istanbul' });
            const isInRange = worklogDate >= startDate && worklogDate <= endDate;
            const isThisDeveloper = worklog.author && 
                                  worklog.author.displayName && 
                                  this.normalizeName(worklog.author.displayName) === this.normalizeName(developer);
            
            return isInRange && isThisDeveloper;
          });

          // Her worklog'u günlük toplamına ve entry listesine ekle
          for (const worklog of filteredWorklogs) {
            const worklogDate = new Date(worklog.started).toLocaleDateString('en-CA', { timeZone: 'Europe/Istanbul' });
            const timeSpentHours = Math.round((worklog.timeSpentSeconds / 3600) * 100) / 100;
            dailyHours[worklogDate] = (dailyHours[worklogDate] || 0) + timeSpentHours;

            // Entry detayını da sakla
            if (!dailyEntries[worklogDate]) {
              dailyEntries[worklogDate] = [];
            }

            const worklogEntry: WorklogEntry = {
              id: `${issue.key}-${worklog.started}`,
              issueKey: issue.key,
              issueSummary: issue.fields.summary,
              author: {
                displayName: worklog.author.displayName,
                accountId: worklog.author.accountId
              },
              timeSpentSeconds: worklog.timeSpentSeconds,
              timeSpentHours: timeSpentHours,
              started: worklog.started,
              comment: worklog.comment,
              project: issue.fields.project.name,
              issueType: issue.fields.issuetype?.name || 'Task'
            };

            dailyEntries[worklogDate].push(worklogEntry);
          }
        }
        
        // Günlük özetleri oluştur
        const dailySummaries: DailyWorklogSummary[] = allDates.map(date => {
          const totalHours = Math.round((dailyHours[date] || 0) * 100) / 100;
          
          return {
            date,
            totalHours,
            status: 'sufficient',
            statusText: totalHours > 0 ? `${totalHours}h` : '-',
            statusColor: 'bg-gray-100 text-gray-800 border-gray-200',
            entries: dailyEntries[date] || []
          };
        });
        
        // Aylık toplam hesapla
        const monthlyTotal = Math.round(Object.values(dailyHours).reduce((sum: number, hours: number) => sum + hours, 0) * 100) / 100;

        // Sadece iş günlerini say (Pazartesi-Cuma)
        const workingDaysInMonth = allDates.filter(date => {
          const dayOfWeek = new Date(date).getDay()
          return dayOfWeek >= 1 && dayOfWeek <= 5 // 1=Pazartesi, 5=Cuma
        }).length

        // İzin günlerini hedeften düş
        const devLeaveInfo = developerLeaveInfo?.find(info =>
          this.normalizeName(info.developerName) === this.normalizeName(developer)
        );
        const leaveDays = devLeaveInfo?.leaveDays || 0;
        const adjustedWorkingDays = Math.max(0, workingDaysInMonth - leaveDays);
        const monthlyTarget = adjustedWorkingDays * 7 // İş günleri - izin günleri x 7 saat

        console.log(`📊 ${developer} monthly target calculation:`, {
          workingDaysInMonth,
          leaveDays,
          adjustedWorkingDays,
          monthlyTarget
        });
        
        let monthlyStatus: 'sufficient' | 'insufficient' | 'excessive';
        if (monthlyTotal < monthlyTarget * 0.8) {
          monthlyStatus = 'insufficient';
        } else if (monthlyTotal <= monthlyTarget * 1.2) {
          monthlyStatus = 'sufficient';
        } else {
          monthlyStatus = 'excessive';
        }

        console.log(`✅ ${developer}: ${monthlyTotal}h monthly total from ${Object.keys(dailyHours).length} days with data`);
        
        const devEmail = developerEmailMap.get(this.normalizeName(developer)) || `${developer.toLowerCase().replace(/\s+/g, '.')}@company.com`;
        monthlyData.push({
          developerName: developer,
          email: devEmail,
          dailySummaries,
          weeklyTotal: monthlyTotal,
          weeklyTarget: monthlyTarget,
          weeklyStatus: monthlyStatus
        });
        
      } catch (error) {
        console.error(`❌ Error processing monthly data for ${developer}:`, error);
        
        // Hata durumunda boş veri oluştur
        const dailySummaries: DailyWorklogSummary[] = allDates.map(date => ({
          date,
          totalHours: 0,
          status: 'missing',
          statusText: '-',
          statusColor: 'bg-gray-100 text-gray-800 border-gray-200',
          entries: []
        }));

        // Hata durumunda da izin günlerini hesapla
        const errorWorkingDays = allDates.filter(date => {
          const dayOfWeek = new Date(date).getDay()
          return dayOfWeek >= 1 && dayOfWeek <= 5
        }).length;
        const errorDevLeaveInfo = developerLeaveInfo?.find(info =>
          this.normalizeName(info.developerName) === this.normalizeName(developer)
        );
        const errorLeaveDays = errorDevLeaveInfo?.leaveDays || 0;
        const errorAdjustedWorkingDays = Math.max(0, errorWorkingDays - errorLeaveDays);
        const errorMonthlyTarget = errorAdjustedWorkingDays * 7;

        const errorDevEmail = developerEmailMap.get(this.normalizeName(developer)) || `${developer.toLowerCase().replace(/\s+/g, '.')}@company.com`;
        monthlyData.push({
          developerName: developer,
          email: errorDevEmail,
          dailySummaries,
          weeklyTotal: 0,
          weeklyTarget: errorMonthlyTarget,
          weeklyStatus: 'insufficient'
        });
      }
    }
    
    console.log(`✅ Monthly worklog data created for ${monthlyData.length} developers`);
    return monthlyData.sort((a, b) => a.developerName.localeCompare(b.developerName));
  }

  /**
   * Proje 3 ile aynı hybrid mantık: Her yazılımcı için ayrı JQL (worklogAuthor = "İsim")
   * ile worklog'lar çekilir; böylece tek büyük worklogDate sorgusunda kaçan kayıtlar olmaz.
   */
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
      console.log(`🚀 HYBRID: Fetching worklog data for ${startDate} to ${endDate} (per-developer worklogAuthor JQL)`);
      const allowedDevelopers = await this.getAllowedDevelopers();
      const allWorklogs: any[] = [];
      const jqlStartDate = startDate.replace(/-/g, '/');
      const jqlEndDate = endDate.replace(/-/g, '/');
      const fieldsParam = 'worklog,summary,project,issuetype,parent,updated,created';

      for (const developer of allowedDevelopers) {
        try {
          const jql = `worklogAuthor = "${developer}" AND worklogDate >= "${jqlStartDate}" AND worklogDate <= "${jqlEndDate}" ORDER BY updated DESC`;
          let startAt = 0;
          let total = Infinity;
          const developerIssues: any[] = [];

          while (startAt < total) {
            const searchUrl = `/rest/api/3/search/jql?jql=${encodeURIComponent(jql)}&maxResults=200&startAt=${startAt}&fields=${encodeURIComponent(fieldsParam)}`;
            const page = await this.invokeJiraProxy({
              body: { endpoint: searchUrl, method: 'GET' }
            });
            const issues: any[] = page.issues || [];
            total = typeof page.total === 'number' ? page.total : startAt + issues.length;
            developerIssues.push(...issues);
            if (issues.length === 0) break;
            startAt += issues.length;
          }

          for (const issue of developerIssues) {
            let worklogs: any[] = issue.fields.worklog?.worklogs || [];
            const worklogTotal = issue.fields.worklog?.total ?? worklogs.length;

            if (worklogTotal > worklogs.length) {
              let wlStart = worklogs.length;
              while (wlStart < worklogTotal) {
                try {
                  const wlResp = await this.invokeJiraProxy({
                    body: {
                      endpoint: `/rest/api/3/issue/${issue.key}/worklog?startAt=${wlStart}&maxResults=200`,
                      method: 'GET'
                    }
                  });
                  const pageLogs = wlResp.worklogs || [];
                  worklogs.push(...pageLogs);
                  wlStart += pageLogs.length;
                  if (pageLogs.length === 0) break;
                } catch {
                  break;
                }
              }
            }

            for (const worklog of worklogs) {
              if (!worklog.started || !worklog.author?.displayName) continue;
              const worklogDateObj = new Date(worklog.started);
              const worklogDate = worklogDateObj.getFullYear() + '-' +
                String(worklogDateObj.getMonth() + 1).padStart(2, '0') + '-' +
                String(worklogDateObj.getDate()).padStart(2, '0');
              if (worklogDate < startDate || worklogDate > endDate) continue;
              if (this.normalizeName(worklog.author.displayName) !== this.normalizeName(developer)) continue;

              allWorklogs.push({
                author: { displayName: worklog.author.displayName, accountId: worklog.author.accountId },
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
        } catch (err) {
          console.warn(`❌ Worklog fetch failed for ${developer}:`, err);
        }
      }

      console.log(`✅ HYBRID: Total worklogs ${allWorklogs.length}`);
      this.setCache(cacheKey, allWorklogs);
      return allWorklogs;
    } catch (error) {
      console.error('❌ Error fetching worklog data:', error);
      throw error;
    }
  }

  // Yazılımcı bazlı haftalık veri
  async getDeveloperWorklogData(startDate: string, endDate: string): Promise<DeveloperWorklogData[]> {
    console.log(`🚀 Getting ALL daily worklog data for ${startDate} to ${endDate} - NO FILTERS`);
    const [rawWorklogs, allowedDevelopers, developerEmailMap] = await Promise.all([
      this.getWorklogDataForDateRange(startDate, endDate),
      this.getAllowedDevelopers(),
      typeof (jiraFilterService as any).getDeveloperEmailMap === 'function'
        ? jiraFilterService.getDeveloperEmailMap()
        : Promise.resolve(new Map<string, string>())
    ]);
    console.log(`📊 Processing ${rawWorklogs.length} ALL worklogs for ${allowedDevelopers.length} developers`);
    console.log(`📊 Raw worklog sample:`, rawWorklogs.slice(0, 3));

    // Yazılımcı bazlı gruplama - normalize edilmiş isimle key kullan (Jira "Suat Aydogdu" vs DB "Suat Aydoğdu" eşleşmesi)
    const developerMap = new Map<string, Map<string, WorklogEntry[]>>();
    const normalizedToDisplay = new Map<string, string>(); // normalized -> Jira displayName (ilk gördüğümüz)

    for (const worklog of rawWorklogs) {
      const displayName = worklog.author.displayName;
      const norm = this.normalizeName(displayName);
      if (!normalizedToDisplay.has(norm)) normalizedToDisplay.set(norm, displayName);

      // Lokal gün (proje 3 ile aynı: getFullYear/getMonth/getDate)
      const worklogDateObj = new Date(worklog.started);
      const worklogDate = worklogDateObj.getFullYear() + '-' +
        String(worklogDateObj.getMonth() + 1).padStart(2, '0') + '-' +
        String(worklogDateObj.getDate()).padStart(2, '0');
      
      // Saat hesaplama - saniyeyi saate çevir
      const timeSpentHours = Math.round((worklog.timeSpentSeconds / 3600) * 100) / 100;
      
      console.log(`📝 Processing worklog: ${displayName} - ${worklogDate} - ${timeSpentHours}h - ${worklog.issueKey}`);
      
      if (!developerMap.has(norm)) {
        developerMap.set(norm, new Map());
        console.log(`👤 New developer added to map: ${displayName} (norm: ${norm})`);
      }
      
      const devMap = developerMap.get(norm)!;
      if (!devMap.has(worklogDate)) {
        devMap.set(worklogDate, []);
      }
      
      const worklogEntry: WorklogEntry = {
        id: `${worklog.issueKey}-${worklog.started}`,
        issueKey: worklog.issueKey,
        issueSummary: worklog.issueSummary,
        author: worklog.author,
        timeSpentSeconds: worklog.timeSpentSeconds,
        timeSpentHours: timeSpentHours,
        started: worklog.started,
        comment: worklog.comment,
        project: worklog.projectName,
        issueType: worklog.issueTypeName || 'Task'
      };
      
      devMap.get(worklogDate)!.push(worklogEntry);
    }
    
    console.log(`📊 Developer map created:`, 
      Array.from(developerMap.entries()).map(([norm, dateMap]) => ({
        developer: normalizedToDisplay.get(norm) || norm,
        daysWithData: dateMap.size,
        totalEntries: Array.from(dateMap.values()).reduce((sum, entries) => sum + entries.length, 0),
        totalHours: Array.from(dateMap.values()).reduce((sum, entries) => 
          sum + entries.reduce((entrySum, entry) => entrySum + entry.timeSpentHours, 0), 0
        )
      }))
    );

    // Haftalık günler (proje 3 ile aynı: getWeekRange ile Pzt–Cuma tarihleri, lokal YYYY-MM-DD)
    const weekRange = getWeekRange(new Date(startDate));
    const allDates = weekRange.dates;

    // Her yazılımcı için günlük özetler oluştur
    const developerData: DeveloperWorklogData[] = [];

    for (const developer of allowedDevelopers) {
      const norm = this.normalizeName(developer);
      const devMap = developerMap.get(norm) || new Map();
      const dailySummaries: DailyWorklogSummary[] = [];
      
      console.log(`🔍 Processing daily summaries for: ${developer}`);
      
      // Her gün için özet oluştur
      for (const date of allDates) {
        const dayEntries = devMap.get(date) || [];
        const totalHours = Math.round(dayEntries.reduce((sum: number, entry: WorklogEntry) => sum + entry.timeSpentHours, 0) * 100) / 100;
        
        console.log(`📊 ${developer} - ${date}: ${totalHours}h from ${dayEntries.length} entries`);
        if (dayEntries.length > 0) {
          console.log(`  📝 Entries: ${dayEntries.map((e: WorklogEntry) => `${e.issueKey}(${e.timeSpentHours}h)`).join(', ')}`);
        }
        
        let status: 'sufficient' | 'insufficient' | 'excessive' | 'missing';
        let statusText: string;
        let statusColor: string;

        if (totalHours === 0) {
          status = 'missing';
          statusText = 'Süre Yok';
          statusColor = 'bg-gray-100 text-gray-800 border-gray-200';
        } else if (totalHours < 7) {
          status = 'insufficient';
          statusText = `Eksik (${Math.round((7 - totalHours) * 100) / 100}h)`;
          statusColor = 'bg-red-100 text-red-800 border-red-200';
        } else if (totalHours === 7) {
          status = 'sufficient';
          statusText = 'Tam (7h)';
          statusColor = 'bg-green-100 text-green-800 border-green-200';
        } else {
          status = 'excessive';
          statusText = `Fazla (+${Math.round((totalHours - 7) * 100) / 100}h)`;
          statusColor = 'bg-blue-100 text-blue-800 border-blue-200';
        }

        dailySummaries.push({
          date,
          totalHours,
          status,
          statusText,
          statusColor,
          entries: dayEntries
        });
      }
      
      // Haftalık toplam hesapla
      const weeklyTotal = Math.round(dailySummaries.reduce((sum, day) => sum + day.totalHours, 0) * 100) / 100;
      const weeklyTarget = 35; // 7 saat x 5 iş günü
      
      let weeklyStatus: 'sufficient' | 'insufficient' | 'excessive';
      if (weeklyTotal < weeklyTarget * 0.9) { // %90 tolerans (31.5h)
        weeklyStatus = 'insufficient';
      } else if (weeklyTotal <= weeklyTarget * 1.1) { // %110 tolerans (38.5h)
        weeklyStatus = 'sufficient';
      } else {
        weeklyStatus = 'excessive';
      }

      console.log(`✅ ${developer}: ${weeklyTotal}h weekly total, status: ${weeklyStatus}, days with data: ${dailySummaries.filter(d => d.totalHours > 0).length}/5`);
      
      const devEmail = developerEmailMap.get(this.normalizeName(developer)) || `${developer.toLowerCase().replace(/\s+/g, '.')}@company.com`;
      developerData.push({
        developerName: developer,
        email: devEmail,
        dailySummaries,
        weeklyTotal,
        weeklyTarget,
        weeklyStatus
      });
    }

    console.log(`✅ ALL Developer worklog data created for ${developerData.length} developers`);
    console.log(`📊 Final summary:`, developerData.map(dev => ({
      name: dev.developerName,
      weeklyTotal: dev.weeklyTotal,
      daysWithData: dev.dailySummaries.filter(day => day.totalHours > 0).length
    })));
    
    return developerData.sort((a, b) => a.developerName.localeCompare(b.developerName));
  }

  // Analitik veriler
  async getWorklogAnalytics(startDate: string, endDate: string): Promise<WorklogAnalytics> {
    const developerData = await this.getDeveloperWorklogData(startDate, endDate);
    
    const totalDevelopers = developerData.length;
    const totalWorklogEntries = developerData.reduce((sum, dev) => 
      sum + dev.dailySummaries.reduce((entrySum, day) => entrySum + day.entries.length, 0), 0
    );
    const totalHours = Math.round(developerData.reduce((sum, dev) => sum + dev.weeklyTotal, 0) * 100) / 100;
    const averageDailyHours = totalDevelopers > 0 ? Math.round((totalHours / (totalDevelopers * 5)) * 100) / 100 : 0;
    
    const developersWithSufficientHours = developerData.filter(dev => dev.weeklyStatus === 'sufficient').length;
    const developersWithInsufficientHours = developerData.filter(dev => dev.weeklyStatus === 'insufficient').length;
    const developersWithExcessiveHours = developerData.filter(dev => dev.weeklyStatus === 'excessive').length;

    return {
      totalDevelopers, 
      totalWorklogEntries,
      totalHours,
      averageDailyHours,
      developersWithSufficientHours,
      developersWithInsufficientHours,
      developersWithExcessiveHours,
      dateRange: { start: startDate, end: endDate }
    };
  }

}

export const worklogService = new WorklogService();