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

  private isAllowedDeveloper(displayName: string, allowedDevelopers: string[]): boolean {
    const normalizedInput = this.normalizeName(displayName);
    const normalizedAllowed = allowedDevelopers.map(name => this.normalizeName(name));
    return normalizedAllowed.includes(normalizedInput);
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

  // Aylık worklog verisi - ayın tüm günleri için
  async getMonthlyWorklogData(startDate: string, endDate: string, developerLeaveInfo?: any[]): Promise<DeveloperWorklogData[]> {
    console.log(`🚀 Getting MONTHLY worklog data for ${startDate} to ${endDate}`);

    const allowedDevelopers = await this.getAllowedDevelopers();
    console.log(`✅ Found ${allowedDevelopers.length} active developers from database`);

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
        const jql = `worklogAuthor = "${developer}" AND worklogDate >= "${jqlStartDate}" AND worklogDate <= "${jqlEndDate}" ORDER BY updated DESC`;
        
        console.log(`🔍 Monthly JQL for ${developer}: ${jql}`);

        const pageSize = 100;
        let startAt = 0;
        let total = Infinity;
        const developerIssues: any[] = [];
        
        // Sayfalı issue çekme
        while (startAt < total) {
          const endpoint = `/rest/api/3/search?jql=${encodeURIComponent(jql)}&maxResults=${pageSize}&startAt=${startAt}&fields=worklog,summary,project,issuetype,parent,updated,created`;
          
          const { data: page, error } = await supabase.functions.invoke('jira-proxy', {
            body: { 
              endpoint,
              method: 'GET'
            }
          });

          if (error) throw error;

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
                  const { data: pageResp, error: pageError } = await supabase.functions.invoke('jira-proxy', {
                    body: {
                      endpoint: `/rest/api/3/issue/${issue.id}/worklog?startAt=${start}&maxResults=100`,
                      method: 'GET'
                    }
                  });

                  if (pageError) throw pageError;

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
            
            const worklogDateObj = new Date(worklog.started);
            const worklogDate = worklogDateObj.getFullYear() + '-' + 
                               String(worklogDateObj.getMonth() + 1).padStart(2, '0') + '-' + 
                               String(worklogDateObj.getDate()).padStart(2, '0');
            
            const isInRange = worklogDate >= startDate && worklogDate <= endDate;
            const isThisDeveloper = worklog.author && 
                                  worklog.author.displayName && 
                                  this.normalizeName(worklog.author.displayName) === this.normalizeName(developer);
            
            return isInRange && isThisDeveloper;
          });

          // Her worklog'u günlük toplamına ve entry listesine ekle
          for (const worklog of filteredWorklogs) {
            const worklogDateObj = new Date(worklog.started);
            const worklogDate = worklogDateObj.getFullYear() + '-' +
                               String(worklogDateObj.getMonth() + 1).padStart(2, '0') + '-' +
                               String(worklogDateObj.getDate()).padStart(2, '0');

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
        
        monthlyData.push({
          developerName: developer,
          email: this.getDeveloperEmail(developer),
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

        monthlyData.push({
          developerName: developer,
          email: this.getDeveloperEmail(developer),
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
      console.log(`🚀 HYBRID OPTIMIZED: Fetching worklog data for date range: ${startDate} to ${endDate}`);
      
      // HYBRID YAKLAŞIM: Paralel işlem ile her yazılımcı için ayrı JQL sorgusu
      const allWorklogs: any[] = [];
      
      const allowedDevelopers = await this.getAllowedDevelopers();
      console.log(`🚀 Fetching worklogs for ${allowedDevelopers.length} developers in parallel...`);

      // Paralel işlem için Promise.all kullan
      const developerPromises = allowedDevelopers.map(async (developer) => {
        console.log(`👤 Fetching worklogs for: ${developer}`);
        
        try {
          // Bu yazılımcının belirtilen tarih aralığında worklog girdiği TÜM issue'ları çek
          const jqlStartDate = startDate.replace(/-/g, '/');
          const jqlEndDate = endDate.replace(/-/g, '/');
          
          // Yazılımcı bazlı JQL - hangi projede olursa olsun
          const jql = `worklogAuthor = "${developer}" AND worklogDate >= "${jqlStartDate}" AND worklogDate <= "${jqlEndDate}" ORDER BY updated DESC`;
          
          console.log(`🔍 JQL for ${developer}: ${jql}`);

          const pageSize = 200; // Daha büyük sayfa boyutu
          let startAt = 0;
          let total = Infinity;
          const developerIssues: any[] = [];
          
          // Sayfalı issue çekme
          while (startAt < total) {
            const endpoint = `/rest/api/3/search?jql=${encodeURIComponent(jql)}&maxResults=${pageSize}&startAt=${startAt}&fields=worklog,summary,project,issuetype,parent,updated,created`;
            
            const { data: page, error } = await supabase.functions.invoke('jira-proxy', {
              body: { 
                endpoint,
                method: 'GET'
              }
            });

            if (error) throw error;

            const issues: any[] = page.issues || [];
            const pageTotal = typeof page.total === 'number' ? page.total : (startAt + issues.length);
            total = pageTotal;
            developerIssues.push(...issues);
            console.log(`📄 ${developer} issues page: startAt=${startAt}, got=${issues.length}, total=${total}`);
            if (issues.length === 0) break;
            startAt += issues.length;
          }
          
          console.log(`📊 ${developer}: Found ${developerIssues.length} issues with worklogs in date range`);
          
          const developerWorklogs: any[] = [];
          
          // Her issue için TÜM worklog'ları sayfalı çek
          for (const issue of developerIssues) {
            console.log(`🔍 Processing issue: ${issue.key} (${issue.fields.project.key}) for ${developer}`);
            
            let worklogs: any[] = [];
            
            // Issue fields'dan worklog bilgisini kontrol et
            if (issue.fields.worklog) {
              const wl = issue.fields.worklog;
              worklogs = Array.isArray(wl.worklogs) ? wl.worklogs : [];
              const total: number = typeof wl.total === 'number' ? wl.total : worklogs.length;
              const returned: number = worklogs.length;
              
              console.log(`📝 Issue ${issue.key}: ${returned}/${total} worklogs in fields`);
              
              // Eğer tüm worklog'lar gelmemişse, sayfalama ile TÜM worklog'ları çek
              if (total > returned) {
                console.log(`🔄 Fetching remaining worklogs for ${issue.key}: need ${total - returned} more`);
                let start = returned;
                while (start < total) {
                  try {
                    const { data: pageResp, error: pageError } = await supabase.functions.invoke('jira-proxy', {
                      body: {
                        endpoint: `/rest/api/3/issue/${issue.id}/worklog?startAt=${start}&maxResults=200`,
                        method: 'GET'
                      }
                    });

                    if (pageError) throw pageError;

                    const pageLogs = pageResp.worklogs || [];
                    console.log(`📄 Fetched worklog page for ${issue.key}: startAt=${start}, got=${pageLogs.length} worklogs`);
                    worklogs.push(...pageLogs);
                    start += pageLogs.length;
                    if (pageLogs.length === 0) break;
                  } catch (err) {
                    console.warn(`Could not fetch paged worklogs for issue ${issue.key} at startAt=${start}:`, err);
                    break;
                  }
                }
                console.log(`✅ Total worklogs collected for ${issue.key}: ${worklogs.length}/${total}`);
              }
            } else {
              // Fields'da worklog yoksa, direkt endpoint'ten TÜM worklog'ları sayfalı çek
              console.log(`🔄 No worklog in fields for ${issue.key}, fetching all worklogs via endpoint`);
              let start = 0;
              let totalFromEndpoint = Infinity;
              
              while (true) {
                const { data: pageResp, error: pageError } = await supabase.functions.invoke('jira-proxy', {
                  body: {
                    endpoint: `/rest/api/3/issue/${issue.id}/worklog?startAt=${start}&maxResults=200`,
                    method: 'GET'
                  }
                });

                if (pageError) throw pageError;

                const pageLogs = pageResp.worklogs || [];
                if (start === 0 && typeof pageResp.total === 'number') {
                  totalFromEndpoint = pageResp.total;
                  console.log(`📊 Issue ${issue.key}: Total worklogs available via endpoint: ${totalFromEndpoint}`);
                }
                
                console.log(`📄 Fetched worklog page for ${issue.key}: startAt=${start}, got=${pageLogs.length} worklogs`);
                worklogs.push(...pageLogs);
                if (pageLogs.length === 0) break;
                start += pageLogs.length;
                
                // Güvenlik kontrolü: sonsuz döngüyü önle
                if (start >= totalFromEndpoint) break;
              }
              console.log(`✅ Total worklogs collected for ${issue.key}: ${worklogs.length}`);
            }
            
            console.log(`📝 Issue ${issue.key}: Found ${worklogs.length} total worklogs (before date filtering)`);
            
            // Tarih aralığındaki worklog'ları filtrele ve normalize et
            const filteredWorklogs = worklogs.filter(worklog => {
              if (!worklog.started) return false;
              
              // Timezone'dan bağımsız lokal tarih hesaplama
              const worklogDateObj = new Date(worklog.started);
              const worklogDate = worklogDateObj.getFullYear() + '-' + 
                                 String(worklogDateObj.getMonth() + 1).padStart(2, '0') + '-' + 
                                 String(worklogDateObj.getDate()).padStart(2, '0');
              
              const isInRange = worklogDate >= startDate && worklogDate <= endDate;
              
              // Sadece bu yazılımcının worklog'larını al
              const isThisDeveloper = worklog.author && 
                                    worklog.author.displayName && 
                                    this.normalizeName(worklog.author.displayName) === this.normalizeName(developer);
              
              if (isInRange && isThisDeveloper) {
                console.log(`✅ INCLUDED: ${worklog.author.displayName} - ${worklogDate} (UTC: ${worklog.started.split('T')[0]}) - ${issue.key} - ${Math.round((worklog.timeSpentSeconds / 3600) * 100) / 100}h`);
              } else if (!isInRange) {
                console.log(`❌ OUT OF RANGE: ${worklog.author?.displayName} - ${worklogDate} - ${issue.key}`);
              } else if (!isThisDeveloper) {
                console.log(`❌ DIFFERENT DEVELOPER: ${worklog.author?.displayName} (looking for ${developer}) - ${issue.key}`);
              }
              
              return isInRange && isThisDeveloper;
            });

            console.log(`📝 Issue ${issue.key}: ${filteredWorklogs.length}/${worklogs.length} worklogs for ${developer} in date range`);
            
            // Bu yazılımcının worklog'larını ana listeye ekle
            for (const worklog of filteredWorklogs) {
              const timeSpentHours = Math.round((worklog.timeSpentSeconds / 3600) * 100) / 100;
              
              console.log(`✅ FINAL ADD: ${worklog.author.displayName} - ${issue.key} - ${timeSpentHours}h - ${worklog.started.split('T')[0]}`);
              
              developerWorklogs.push({
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
          
          console.log(`✅ ${developer}: Collected ${developerWorklogs.length} worklogs from ${developerIssues.length} issues`);
          return developerWorklogs;
          
        } catch (developerError) {
          console.error(`❌ Error fetching worklogs for ${developer}:`, developerError);
          return []; // Hata durumunda boş array döndür
        }
      });
      
      // Tüm yazılımcıların worklog'larını paralel olarak bekle
      const allDeveloperWorklogs = await Promise.all(developerPromises);
      
      // Tüm worklog'ları birleştir
      for (const developerWorklogs of allDeveloperWorklogs) {
        allWorklogs.push(...developerWorklogs);
      }
      
      console.log(`✅ HYBRID OPTIMIZED: Total worklogs found: ${allWorklogs.length}`);
      console.log(`📊 Worklog breakdown by developer:`, 
        allWorklogs.reduce((acc, wl) => {
          acc[wl.author.displayName] = (acc[wl.author.displayName] || 0) + 1;
          return acc;
        }, {} as Record<string, number>)
      );
      console.log(`📊 Worklog breakdown by project:`, 
        allWorklogs.reduce((acc, wl) => {
          acc[wl.projectKey] = (acc[wl.projectKey] || 0) + 1;
          return acc;
        }, {} as Record<string, number>)
      );
      
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
    const rawWorklogs = await this.getWorklogDataForDateRange(startDate, endDate);
    const weekRange = getWeekRange(new Date(startDate));
    
    const allowedDevelopers = await this.getAllowedDevelopers();
    console.log(`📊 Processing ${rawWorklogs.length} ALL worklogs for ${allowedDevelopers.length} developers`);
    console.log(`📊 Raw worklog sample:`, rawWorklogs.slice(0, 3));

    // Yazılımcı bazlı gruplama
    const developerMap = new Map<string, Map<string, WorklogEntry[]>>();
    
    // Her worklog'u yazılımcı ve tarihe göre grupla - DETAYLI HESAPLAMA
    for (const worklog of rawWorklogs) {
      const developer = worklog.author.displayName;
      
      // Timezone'dan bağımsız tarih hesaplama (lokal gün)
      const worklogDateObj = new Date(worklog.started);
      const worklogDate = worklogDateObj.getFullYear() + '-' + 
                         String(worklogDateObj.getMonth() + 1).padStart(2, '0') + '-' + 
                         String(worklogDateObj.getDate()).padStart(2, '0');
      
      // Saat hesaplama - saniyeyi saate çevir
      const timeSpentHours = Math.round((worklog.timeSpentSeconds / 3600) * 100) / 100;
      
      console.log(`📝 Processing worklog: ${developer} - ${worklogDate} (UTC: ${worklog.started.split('T')[0]}) - ${timeSpentHours}h (${worklog.timeSpentSeconds}s) - ${worklog.issueKey}`);
      
      if (!developerMap.has(developer)) {
        developerMap.set(developer, new Map());
        console.log(`👤 New developer added to map: ${developer}`);
      }
      
      const devMap = developerMap.get(developer)!;
      if (!devMap.has(worklogDate)) {
        devMap.set(worklogDate, []);
        console.log(`📅 New date added for ${developer}: ${worklogDate}`);
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
      console.log(`✅ Worklog added: ${developer} - ${worklogDate} - ${timeSpentHours}h - Total entries for this day: ${devMap.get(worklogDate)!.length}`);
    }
    
    console.log(`📊 Developer map created:`, 
      Array.from(developerMap.entries()).map(([dev, dateMap]) => ({
        developer: dev,
        daysWithData: dateMap.size,
        totalEntries: Array.from(dateMap.values()).reduce((sum, entries) => sum + entries.length, 0),
        totalHours: Array.from(dateMap.values()).reduce((sum, entries) => 
          sum + entries.reduce((entrySum, entry) => entrySum + entry.timeSpentHours, 0), 0
        )
      }))
    );
      // Her worklog'u yazılımcı ve tarihe göre grupla
    // Her yazılımcı için günlük özetler oluştur
    const developerData: DeveloperWorklogData[] = [];

    for (const developer of allowedDevelopers) {
      const devMap = developerMap.get(developer) || new Map();
      const dailySummaries: DailyWorklogSummary[] = [];
      
      console.log(`🔍 Processing daily summaries for: ${developer}`);
      
      // Her gün için özet oluştur
      for (const date of weekRange.dates) {
        const dayEntries = devMap.get(date) || [];
        const totalHours = Math.round(dayEntries.reduce((sum, entry) => sum + entry.timeSpentHours, 0) * 100) / 100;
        
        console.log(`📊 ${developer} - ${date}: ${totalHours}h from ${dayEntries.length} entries`);
        if (dayEntries.length > 0) {
          console.log(`  📝 Entries: ${dayEntries.map(e => `${e.issueKey}(${e.timeSpentHours}h)`).join(', ')}`);
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
      
      developerData.push({
        developerName: developer,
        email: this.getDeveloperEmail(developer),
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

  private getDeveloperEmail(name: string): string {
    const emailMap: { [name: string]: string } = {
      'Buse Eren': 'buse.eren@acerpro.com.tr',
      'Canberk İsmet DİZDAŞ': 'canberk.dizdas@acerpro.com.tr',
      'Melih Meral': 'melih.meral@acerpro.com.tr',
      'Onur Demir': 'onur.demir@acerpro.com.tr',
      'Sezer SİNANOĞLU': 'sezer.sinanoglu@acerpro.com.tr',
      'Sezer Sinanoğlu': 'sezer.sinanoglu@acerpro.com.tr',
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

    return emailMap[name] || `${name.toLowerCase().replace(/\s+/g, '.')}@acerpro.com.tr`;
  }
}

export const worklogService = new WorklogService();