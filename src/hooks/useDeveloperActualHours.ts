/**
 * Developer actual hours yönetimi için custom hook
 * DeveloperWorkloadDashboard component'inden taşınmıştır
 */

import { useState, useEffect } from 'react';
import { worklogService } from '../services/worklogService';
import { useJiraData } from '../context/JiraDataContext';
import { formatLocalDate, normalizeDeveloperName, calculateSprintDateRange } from '../utils/sprintDateUtils';
import type { JiraSprint } from '../types';

// DeveloperWorkload tipi types'tan import edilemiyor, bu yüzden any kullanıyoruz
// TODO: DeveloperWorkload tipini types/index.ts'den export et
type DeveloperWorkload = any;

interface UseDeveloperActualHoursParams {
  workload: DeveloperWorkload[] | null;
  sprints: JiraSprint[] | null;
  sprintType: 'active' | 'closed';
  cacheStatus: string;
}

interface UseDeveloperActualHoursReturn {
  actualHoursData: Record<string, number>;
  loading: boolean;
  error: string | null;
}

/**
 * Developer actual hours hook'u
 * Sprint tarihlerine göre gerçek harcanan süreleri yükler
 */
export const useDeveloperActualHours = ({
  workload,
  sprints,
  sprintType,
  cacheStatus
}: UseDeveloperActualHoursParams): UseDeveloperActualHoursReturn => {
  const { getDeveloperProjectKey } = useJiraData();
  const [actualHoursData, setActualHoursData] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sprint type değiştiğinde actualHours verilerini sıfırla
  useEffect(() => {
    console.log(`🔄 Sprint type değişti: ${sprintType}, actualHours verileri sıfırlanıyor...`);
    setActualHoursData({});
    setLoading(true);
    setError(null);
  }, [sprintType]);

  // Actual hours yükleme
  useEffect(() => {
    // Eğer cache'den veri geliyorsa ama sprintType değişmişse cache'i ignore et
    // Sprint type değiştiğinde her zaman yeni veri çekilmeli
    if (cacheStatus === 'cached' && workload && sprints && sprints.length > 0) {
      // Sprint type değişikliğini kontrol et - eğer sprint'ler yoksa veya farklıysa cache'i kullanma
      console.log('📦 Cache durumu kontrol ediliyor, sprint verileri yeniden hesaplanıyor...');
      // Cache'i ignore et ve devam et
    }
    
    const loadActualHours = async () => {
      if (!workload || workload.length === 0 || !sprints || sprints.length === 0) return;
      
      setLoading(true);
      setError(null);
      
      try {
        console.log(`🚀 OPTIMIZED: Loading actual hours for ${sprintType} sprints...`);
        
        // OPTIMIZED: Tüm yazılımcılar için tek seferde tarih aralığını hesapla
        const allDateRanges = new Map<string, { start: string; end: string }>();
        
        // Her yazılımcı için tarih aralığını hesapla
        for (const developer of workload) {
          const developerName = developer.developer;
          const developerProjectKey = getDeveloperProjectKey(developerName);
          
          if (!developerProjectKey) {
            console.warn(`⚠️ ${developerName} için proje anahtarı bulunamadı`);
            continue;
          }
          
          const developerSprints = sprints.filter(sprint => sprint.projectKey === developerProjectKey);
          
          if (developerSprints.length === 0) {
            console.warn(`⚠️ ${developerName} (${developerProjectKey}) için sprint bulunamadı`);
            continue;
          }
          
          // Sprint tarih aralıklarını birleştir (utility fonksiyonu kullan)
          const { earliestStart, latestEnd: calculatedLatestEnd } = calculateSprintDateRange(developerSprints);
          
          let earliestStartDate = earliestStart;
          let latestEndDate = calculatedLatestEnd;
          
          // Eğer tarih bulunamazsa, varsayılan olarak son 30 gün kullan
          if (!earliestStartDate || !latestEndDate) {
            const today = new Date();
            const thirtyDaysAgo = new Date(today);
            thirtyDaysAgo.setDate(today.getDate() - 30);
            earliestStartDate = thirtyDaysAgo;
            latestEndDate = today;
          }
          
          // Sprint bitiş tarihini o günün sonuna ayarla
          if (latestEndDate) {
            latestEndDate.setHours(23, 59, 59, 999);
          }
          
          const startDateStr = formatLocalDate(earliestStartDate);
          const endDateStr = formatLocalDate(latestEndDate);
          
          allDateRanges.set(developerName, { start: startDateStr, end: endDateStr });
        }
        
        // ESKİ MANTIK: Her yazılımcı için ayrı API çağrısı yap
        const developerActualHours: Record<string, number> = {};
        
        // Her yazılımcı için kendi projesinin sprint tarihlerini kullan
        for (const developer of workload) {
          const developerName = developer.developer;
          console.log(`👤 Processing ${developerName}...`);
          
          // Yazılımcının projesini bul (Kullanıcı Yönetimi öncelikli)
          const developerProjectKey = getDeveloperProjectKey(developerName);
          if (!developerProjectKey) {
            console.warn(`⚠️ ${developerName} için proje anahtarı bulunamadı`);
            developerActualHours[developerName] = 0;
            continue;
          }
          
          console.log(`🏢 ${developerName} -> ${developerProjectKey} projesi`);
          
          // Bu yazılımcının projesine ait sprint'leri bul
          let developerSprints = sprints.filter(sprint => sprint.projectKey === developerProjectKey);
          console.log(`📊 ${developerName} için ${developerSprints.length} sprint bulundu`);
          
          if (developerSprints.length === 0) {
            console.warn(`⚠️ ${developerName} (${developerProjectKey}) için sprint bulunamadı`);
            developerActualHours[developerName] = 0;
            continue;
          }
          
          // Eğer kapatılan sprintler için sadece son kapatılan sprinti kullan
          // DeveloperWorkloadDashboard sayfasında harcanan süre hesaplaması için
          if (sprintType === 'closed') {
            // Kapatılan sprintleri tarihe göre sırala (en yeni önce)
            const closedSprints = developerSprints
              .filter(sprint => sprint.state === 'closed')
              .sort((a, b) => {
                const dateA = a.completeDate ? new Date(a.completeDate) : (a.endDate ? new Date(a.endDate) : new Date(0));
                const dateB = b.completeDate ? new Date(b.completeDate) : (b.endDate ? new Date(b.endDate) : new Date(0));
                return dateB.getTime() - dateA.getTime(); // En yeni önce
              });
            
            // Sadece son kapatılan sprinti kullan
            if (closedSprints.length > 0) {
              developerSprints = [closedSprints[0]];
              console.log(`📊 ${developerName} için sadece son kapatılan sprint kullanılıyor: ${developerSprints[0].name}`);
            }
          }
          
          // Sprint tarih aralıklarını birleştir (utility fonksiyonu kullan)
          const { earliestStart, latestEnd: calculatedLatestEnd } = calculateSprintDateRange(developerSprints);
          
          let earliestStartDate = earliestStart;
          let latestEndDate = calculatedLatestEnd;
          
          // Eğer tarih bulunamazsa, varsayılan olarak son 30 gün kullan
          if (!earliestStartDate || !latestEndDate) {
            console.warn(`⚠️ ${developerName} sprint'lerinde tarih bulunamadı, son 30 gün kullanılıyor`);
            const today = new Date();
            const thirtyDaysAgo = new Date(today);
            thirtyDaysAgo.setDate(today.getDate() - 30);
            earliestStartDate = thirtyDaysAgo;
            latestEndDate = today;
          }
          
          // Sprint bitiş tarihini o günün sonuna ayarla (23:59:59)
          if (latestEndDate) {
            latestEndDate.setHours(23, 59, 59, 999);
          }
          
          const startDateStr = formatLocalDate(earliestStartDate);
          const endDateStr = formatLocalDate(latestEndDate);
          
          console.log(`📅 ${developerName} sprint tarihleri: ${startDateStr} - ${endDateStr}`);
          
          // Bu yazılımcının bu tarih aralığındaki tüm worklog'larını çek
          try {
            const developerWorklogs = await worklogService.getWorklogDataForDateRange(startDateStr, endDateStr);
            
            // Sadece bu yazılımcının worklog'larını filtrele
            const filteredWorklogs = developerWorklogs.filter(worklog => {
              return normalizeDeveloperName(worklog.author.displayName) === normalizeDeveloperName(developerName);
            });
            
            // Proje bazlı gruplama yap
            const projectHoursMap = new Map<string, number>();
            
            filteredWorklogs.forEach(worklog => {
              const projectName = worklog.projectName;
              const timeSpentHours = Math.round((worklog.timeSpentSeconds / 3600) * 100) / 100;
              
              projectHoursMap.set(projectName, (projectHoursMap.get(projectName) || 0) + timeSpentHours);
            });
            
            // Toplam süreyi hesapla
            const totalHours = Array.from(projectHoursMap.values()).reduce((sum, hours) => sum + hours, 0);
            developerActualHours[developerName] = Math.round(totalHours * 100) / 100;
            
            // Developer'ın workload detaylarını güncelle
            if (workload) {
              const developerWorkload = workload.find(w => w.developer === developerName);
              if (developerWorkload) {
                // Mevcut sprint görevlerindeki actualHours'ı güncelle
                developerWorkload.details.forEach(detail => {
                  // Bu proje-sprint kombinasyonundaki görevlerin actualHours'ını hesapla
                  const sprintTaskActualHours = detail.tasks?.reduce((sum, task) => {
                    // Sadece bu yazılımcıya atanan görevlerin worklog'larını say
                    if (task.assignee === developerName) {
                      // Bu görevin worklog'larını filteredWorklogs'dan bul
                      const taskWorklogs = filteredWorklogs.filter(wl => wl.issueKey === task.key);
                      const taskActualHours = taskWorklogs.reduce((taskSum, wl) => 
                        taskSum + Math.round((wl.timeSpentSeconds / 3600) * 100) / 100, 0
                      );
                      return sum + taskActualHours;
                    }
                    return sum;
                  }, 0) || 0;
                  
                  detail.actualHours = Math.round(sprintTaskActualHours * 100) / 100;
                });
                
                // Worklog'da olan ama sprint görevlerinde olmayan projeleri/görevleri ekle
                projectHoursMap.forEach((hours, projectName) => {
                  // Bu projedeki worklog'ları kontrol et
                  const projectWorklogs = filteredWorklogs.filter(wl => wl.projectName === projectName);
                  
                  // Sprint'te olmayan görevleri bul
                  const nonSprintWorklogs = projectWorklogs.filter(wl => {
                    // Bu worklog'un issue'su mevcut sprint görevlerinde var mı?
                    const isInSprintTasks = developerWorkload.details.some(detail => 
                      detail.tasks?.some(task => task.key === wl.issueKey)
                    );
                    return !isInSprintTasks;
                  });
                  
                  if (nonSprintWorklogs.length > 0) {
                    // Sprint dışı görevleri grupla
                    const nonSprintIssues = new Map<string, {
                      issueKey: string;
                      issueSummary: string;
                      totalHours: number;
                      issueType: string;
                    }>();
                    
                    nonSprintWorklogs.forEach(wl => {
                      const key = wl.issueKey;
                      if (!nonSprintIssues.has(key)) {
                        nonSprintIssues.set(key, {
                          issueKey: wl.issueKey,
                          issueSummary: wl.issueSummary,
                          totalHours: 0,
                          issueType: wl.issueTypeName || 'Task'
                        });
                      }
                      
                      const issue = nonSprintIssues.get(key)!;
                      issue.totalHours += Math.round((wl.timeSpentSeconds / 3600) * 100) / 100;
                    });
                    
                    const totalNonSprintHours = Array.from(nonSprintIssues.values())
                      .reduce((sum, issue) => sum + issue.totalHours, 0);
                    
                    if (totalNonSprintHours > 0) {
                      // Mevcut proje detayında "Sprint Dışı Görevler" kategorisi ekle
                      const existingDetail = developerWorkload.details.find(d => d.project === projectName);
                      if (existingDetail) {
                        // Mevcut proje detayına sprint dışı görevleri ekle
                        const nonSprintTasks = Array.from(nonSprintIssues.values()).map(issue => ({
                          id: issue.issueKey,
                          key: issue.issueKey,
                          summary: issue.issueSummary,
                          status: 'Sprint Dışı',
                          assignee: developerName,
                          project: projectName,
                          sprint: 'Sprint Dışı',
                          estimatedHours: 0,
                          actualHours: issue.totalHours,
                          priority: 'Medium',
                          created: '',
                          updated: '',
                          issueType: issue.issueType
                        }));
                        
                        existingDetail.tasks = [...(existingDetail.tasks || []), ...nonSprintTasks];
                        existingDetail.actualHours += totalNonSprintHours;
                      } else {
                        // Yeni proje detayı ekle
                        const nonSprintTasks = Array.from(nonSprintIssues.values()).map(issue => ({
                          id: issue.issueKey,
                          key: issue.issueKey,
                          summary: issue.issueSummary,
                          status: 'Sprint Dışı',
                          assignee: developerName,
                          project: projectName,
                          sprint: 'Sprint Dışı',
                          estimatedHours: 0,
                          actualHours: issue.totalHours,
                          priority: 'Medium',
                          created: '',
                          updated: '',
                          issueType: issue.issueType
                        }));
                        
                        developerWorkload.details.push({
                          project: projectName,
                          sprint: 'Sprint Dışı Görevler',
                          taskCount: nonSprintTasks.length,
                          hours: 0, // Sprint'te görev yok
                          actualHours: totalNonSprintHours,
                          tasks: nonSprintTasks
                        });
                      }
                    }
                  }
                });
                
                // Detayları actualHours'a göre sırala (en yüksek önce)
                developerWorkload.details.sort((a, b) => b.actualHours - a.actualHours);
              }
            }
            
            console.log(`✅ ${developerName}: ${developerActualHours[developerName]}h from ${filteredWorklogs.length} worklog entries`);
            console.log(`📊 ${developerName} proje dağılımı:`, Object.fromEntries(projectHoursMap));
            
          } catch (error) {
            console.error(`❌ Error fetching worklogs for ${developerName}:`, error);
            developerActualHours[developerName] = 0;
          }
        }
        
        console.log('✅ All developer actual hours calculated:', developerActualHours);
        setActualHoursData(developerActualHours);
        
      } catch (error) {
        console.error('❌ Error loading actual hours:', error);
        setError(error instanceof Error ? error.message : 'Harcanan süre verileri yüklenirken hata oluştu');
      } finally {
        setLoading(false);
      }
    };

    loadActualHours();
  }, [workload, sprints, sprintType, cacheStatus]);

  return {
    actualHoursData,
    loading,
    error
  };
};

