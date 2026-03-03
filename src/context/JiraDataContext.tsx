import * as React from "react";
import { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { supabaseJiraService } from "../lib/supabaseJiraService";
import { supabase } from "../lib/supabase";
import { jiraFilterService } from "../lib/jiraFilterService";
import { useAuth } from "./AuthContext";
import type { JiraProject, JiraBoard, DeveloperWorkload, JiraSprint, JiraTask } from "../types";
import { developerProjectMapService } from "../data/developerProjectMap";
import { worklogService } from "../services/worklogService";

// Cache interface
interface CacheData {
  data: any;
  timestamp: number;
  expiry: number;
}

// Global cache object
const jiraDataCache = new Map<string, CacheData>();
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes
const DEVELOPER_ACTUAL_HOURS_TTL = 15 * 60 * 1000; // 15 minutes

interface JiraDataContextType {
  projects: JiraProject[] | null;
  boards: JiraBoard[] | null;
  workload: DeveloperWorkload[] | null;
  sprints: JiraSprint[] | null;
  sprintTasks: Record<string, JiraTask[]> | null;
  sprintType: 'active' | 'closed' | 'both';
  setSprintType: (type: 'active' | 'closed' | 'both') => void;
  loading: boolean;
  error: string | null;
  refresh: () => void;
  updateWorkloadStatus: (developerName: string, newCapacity: number) => void;
  createdDateRange: [string | null, string | null];
  setCreatedDateRange: (range: [string | null, string | null]) => void;
  showSprintNotification: boolean;
  hideSprintNotification: () => void;
  cacheStatus: 'loading' | 'cached' | 'fresh';
  capacityCalculations: any[];
  setCapacityCalculations: (calculations: any[], cacheKey?: string | null) => void;
  capacityReady: boolean;
  capacityCacheKey: string | null;
  developerActualHours: Record<string, number> | null;
  setDeveloperActualHours: (data: Record<string, number> | null) => void;
  developerActualHoursUpdatedAt: number | null;
  developerActualHoursLoading: boolean;
  developerActualHoursError: string | null;
  /** Kullanıcı Yönetimi (users.assigned_projects) öncelikli; yoksa dinamik harita. */
  getDeveloperProjectKey: (developerName: string) => Promise<string | undefined>;
  /** Proje atama haritası yüklendi mi (Günlük Süre Takibi vb. bu değere göre yeniden yükleyebilir). */
  developerProjectMapReady: boolean;
  /** Jira verisinin en son ne zaman yenilendiği (timestamp, ms). */
  lastRefreshAt: number | null;
}

const JiraDataContext = createContext<JiraDataContextType | undefined>(undefined);

export const JiraDataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, getAccessibleProjects, canViewDeveloperData, user } = useAuth();
  const [projects, setProjects] = useState<JiraProject[] | null>(null);
  const [boards, setBoards] = useState<JiraBoard[] | null>(null);
  const [workload, setWorkload] = useState<DeveloperWorkload[] | null>(null);
  const [sprints, setSprints] = useState<JiraSprint[] | null>(null);
  const [sprintTasks, setSprintTasks] = useState<Record<string, JiraTask[]> | null>(null);
  const [sprintType, setSprintType] = useState<'active' | 'closed' | 'both'>('active');
  const prevSprintTypeRef = useRef<'active' | 'closed' | 'both' | null>(null);
  
  // Sprint type değiştiğinde cache'i temizle
  useEffect(() => {
    if (prevSprintTypeRef.current !== null && prevSprintTypeRef.current !== sprintType) {
      console.log(`🔄 Sprint type değişti: ${prevSprintTypeRef.current} → ${sprintType}, cache temizleniyor...`);
      clearCache();
      supabaseJiraService.clearCache();
      setCapacityCalculationsState([]);
      setCapacityReady(false);
      setCapacityCacheKey(null);
      setDeveloperActualHours(null);
      setDeveloperActualHoursUpdatedAt(null);
    }
    prevSprintTypeRef.current = sprintType;
  }, [sprintType]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createdDateRange, setCreatedDateRange] = useState<[string | null, string | null]>([null, null]);
  const [showSprintNotification, setShowSprintNotification] = useState(false);
  const [hasShownNotification, setHasShownNotification] = useState(false);
  const [cacheStatus, setCacheStatus] = useState<'loading' | 'cached' | 'fresh'>('loading');
  const [capacityCalculationsState, setCapacityCalculationsState] = useState<any[]>([]);
  const [capacityReady, setCapacityReady] = useState(false);
  const [capacityCacheKey, setCapacityCacheKey] = useState<string | null>(null);
  const [developerActualHours, setDeveloperActualHoursState] = useState<Record<string, number> | null>(null);
  const [developerActualHoursUpdatedAt, setDeveloperActualHoursUpdatedAt] = useState<number | null>(null);
  const [developerActualHoursLoading, setDeveloperActualHoursLoading] = useState(false);
  const [developerActualHoursError, setDeveloperActualHoursError] = useState<string | null>(null);
  const [developerProjectMapFromUsers, setDeveloperProjectMapFromUsers] = useState<Map<string, string[]>>(new Map());
  const [developerProjectMapReady, setDeveloperProjectMapReady] = useState(false);
  const [lastRefreshAt, setLastRefreshAt] = useState<number | null>(null);
  const hasTriedRefreshForEmptyProjects = useRef(false);

  const setCapacityCalculations = (calculations: any[], cacheKey: string | null = null) => {
    setCapacityCalculationsState(calculations);
    setCapacityReady(calculations.length > 0);
    setCapacityCacheKey(cacheKey);
  };

  const setDeveloperActualHours = (data: Record<string, number> | null) => {
    setDeveloperActualHoursState(data);
    setDeveloperActualHoursUpdatedAt(data ? Date.now() : null);
  };

  // Cache helper functions
  const getFromCache = <T,>(key: string): T | null => {
    const cached = jiraDataCache.get(key);
    if (cached && Date.now() < cached.expiry) {
      console.log(`📦 Cache hit for: ${key}`);
      return cached.data as T;
    }
    return null;
  };

  const setCache = <T,>(key: string, data: T): void => {
    jiraDataCache.set(key, {
      data,
      timestamp: Date.now(),
      expiry: Date.now() + CACHE_DURATION
    });
    console.log(`💾 Cached data for: ${key}`);
  };

  const clearCache = (): void => {
    jiraDataCache.clear();
    console.log('🗑️ Cache cleared');
  };

  // Kullanıcı girişinde veya sayfa yenilendiğinde varsayılan olarak aktif sprint'i getir
  useEffect(() => {
    if (isAuthenticated && !hasShownNotification) {
      console.log('🔄 Kullanıcı girişi tespit edildi, aktif sprint etkinleştiriliyor...');
      setSprintType('active');
      setShowSprintNotification(true);
      setHasShownNotification(true);
    }
  }, [isAuthenticated, hasShownNotification]);

  const hideSprintNotification = () => {
    setShowSprintNotification(false);
  };

  const normalizeName = (name: string) => (name || '')
    .toLocaleLowerCase('tr')
    .replace(/ı/g, 'i').replace(/ş/g, 's').replace(/ç/g, 'c').replace(/ğ/g, 'g')
    .replace(/ü/g, 'u').replace(/ö/g, 'o')
    .replace(/İ/g, 'i').replace(/Ş/g, 's').replace(/Ç/g, 'c').replace(/Ğ/g, 'g').replace(/Ü/g, 'u').replace(/Ö/g, 'o')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const getDeveloperProjectKey = useCallback(async (developerName: string): Promise<string | undefined> => {
    const n = normalizeName(developerName);
    const fromUsers = developerProjectMapFromUsers.get(n)?.[0];
    if (fromUsers) return fromUsers;

    return await developerProjectMapService.getDeveloperProjectKey(developerName);
  }, [developerProjectMapFromUsers]);

  useEffect(() => {
    if (!isAuthenticated) return;
    jiraFilterService.getDeveloperProjectMapFromUsers().then((map) => {
      setDeveloperProjectMapFromUsers(map);
      setDeveloperProjectMapReady(true);
    });
  }, [isAuthenticated]);

  // Kapasite güncellendiğinde workload status'ünü güncelle (tahmini süreye göre)
  const updateWorkloadStatus = (developerName: string, newCapacity: number) => {
    if (!workload) return;
    
    const updatedWorkload = workload.map(dev => {
      if (dev.developer === developerName) {
        // UI ile tutarlılık için tahmini süreyi proje detaylarındaki hours toplamından hesapla
        const totalEstimatedHours = Math.round(((dev.details || []).reduce((sum, d) => sum + (d.hours || 0), 0)) * 10) / 10;
        let newStatus: 'Eksik Yük' | 'Yeterli' | 'Aşırı Yük';
        
        if (totalEstimatedHours < newCapacity) {
          newStatus = 'Eksik Yük';
        } else if (totalEstimatedHours === newCapacity) {
          newStatus = 'Yeterli';
        } else {
          newStatus = 'Aşırı Yük';
        }
        
        console.log(`🔄 ${developerName} status güncellendi: ${dev.status} → ${newStatus} (tahmini: ${totalEstimatedHours}h / kapasite: ${newCapacity}h)`);
        
        return {
          ...dev,
          status: newStatus,
          dynamicCapacity: newCapacity // Kapasiteyi de güncelle
        };
      }
      return dev;
    });
    
    setWorkload(updatedWorkload);
  };

  const fetchAll = async () => {
    if (!isAuthenticated || !user) return;

    // Cache key: seçilen proje ve yazılımcılar dahil - filtre değişince eski cache kullanılmasın
    const [projectKeys, developerNames] = await Promise.all([
      jiraFilterService.getProjectKeys(),
      jiraFilterService.getDeveloperNames()
    ]);
    const selectionKey = [...projectKeys].sort().join(',') + '|' + [...developerNames].sort().join(',');
    const cacheKey = `jira-data-${sprintType}-${selectionKey}`;

    // Check cache first
    const cachedData = getFromCache<{
      projects: JiraProject[];
      boards: JiraBoard[];
      workload: DeveloperWorkload[];
      sprints: JiraSprint[];
      sprintTasks: Record<string, JiraTask[]>;
    }>(cacheKey);

    if (cachedData) {
      console.log('📦 Using cached Jira data');
      setCacheStatus('cached');
      setProjects(cachedData.projects);
      setBoards(cachedData.boards);
      setWorkload(cachedData.workload);
      setSprints(cachedData.sprints);
      setSprintTasks(cachedData.sprintTasks);
      setLoading(false);
      setLastRefreshAt(Date.now());
      jiraFilterService.getDeveloperProjectMapFromUsers().then((map) => {
        setDeveloperProjectMapFromUsers(map);
        setDeveloperProjectMapReady(true);
      });
      return;
    }

    setCacheStatus('loading');
    setLoading(true);
    setError(null);
    console.log('🚀 Starting to fetch all Jira data...');
    try {
      // Analist veya yazılımcı kullanıcıları için kapatılan sprintlerde tüm sprintleri getir
      const isAnalystOrDeveloper = user && (user.role === 'analyst' || user.role === 'developer');
      const shouldGetAllClosedSprints = isAnalystOrDeveloper && sprintType === 'closed';

      const [projectsData, boardsData, sprintsData, workloadData, developerProjectMapData] = await Promise.all([
        supabaseJiraService.getProjects(),
        supabaseJiraService.getBoards(),
        shouldGetAllClosedSprints
          ? supabaseJiraService.getAllClosedSprints()
          : supabaseJiraService.getAllSprints(sprintType),
        supabaseJiraService.getDeveloperWorkloadAnalysis(sprintType),
        jiraFilterService.getDeveloperProjectMapFromUsers()
      ]);
      setDeveloperProjectMapFromUsers(developerProjectMapData);
      setDeveloperProjectMapReady(true);

      console.log('📊 All data fetched successfully:');
      console.log('- Projects:', projectsData.length);
      console.log('- Boards:', boardsData.length);
      console.log('- Workload entries:', workloadData.length);
      console.log(`- ${sprintType} sprints:`, sprintsData.length);

      // Kullanıcının erişebileceği projeleri filtrele
      const accessibleProjectKeys = getAccessibleProjects();
      const filteredProjects = accessibleProjectKeys.length > 0
        ? projectsData.filter(project => accessibleProjectKeys.includes(project.key))
        : projectsData;

      setProjects(filteredProjects);
      setBoards(boardsData);

      // Kullanıcının görebileceği yazılımcı verilerini filtrele
      const filteredWorkload = await filterWorkloadByUserAccess(workloadData, user, supabase);
      
      // Workload verilerindeki status'ü harcanan süreye göre güncelle
      const updatedWorkload = filteredWorkload.map(dev => {
        const totalActualHours = dev.totalActualHours || 0;

        // Varsayılan kapasiteyi frontend günlük kapasite ayarına göre belirle
        let capacity = 70;
        try {
          if (typeof localStorage !== 'undefined') {
            const storedDaily = localStorage.getItem('dailyHours');
            const parsed = storedDaily ? parseFloat(storedDaily) : NaN;
            if (Number.isFinite(parsed) && parsed > 0) {
              // Yaklaşık 2 haftalık sprint için 10 iş günü
              capacity = Math.round(parsed * 10);
            }
          }
        } catch (e) {
          console.warn('Kapasite konfigürasyonu okunamadı, 70h varsayılan kullanılacak:', e);
        }
        
        let newStatus: 'Eksik Yük' | 'Yeterli' | 'Aşırı Yük';
        if (totalActualHours < capacity) {
          newStatus = 'Eksik Yük';
        } else if (totalActualHours === capacity) {
          newStatus = 'Yeterli';
        } else {
          newStatus = 'Aşırı Yük';
        }
        
        return {
          ...dev,
          status: newStatus
        };
      });
      
      setWorkload(updatedWorkload);
      
      // Sprintleri düz liste olarak tut
      const sprintList = sprintsData
        .filter((s: any) => accessibleProjectKeys.length === 0 || accessibleProjectKeys.includes(s.projectKey))
        .map((s: any) => s.sprint);
      setSprints(sprintList);
      
      // OPTIMIZE: Çok fazla sprint varsa batch'ler halinde çek (performans için)
      const BATCH_SIZE = shouldGetAllClosedSprints ? 10 : 20; // Kapatılan sprintler için daha küçük batch
      console.log(`🔄 Fetching tasks for ${sprintList.length} sprints in batches of ${BATCH_SIZE}...`);
      const sprintTasksObj: Record<string, JiraTask[]> = {};
      
      // İlk batch'i hemen göster (UX için)
      const firstBatch = sprintList.slice(0, BATCH_SIZE);
      const firstBatchPromises = firstBatch.map(async (sprint: JiraSprint) => {
        try {
          const tasks = await supabaseJiraService.getSprintIssues(sprint.id, createdDateRange);
          return { sprintId: sprint.id, sprintName: sprint.name, tasks };
        } catch (error) {
          console.error(`❌ Error fetching tasks for sprint ${sprint.name}:`, error);
          return { sprintId: sprint.id, sprintName: sprint.name, tasks: [] };
        }
      });
      
      const firstBatchResults = await Promise.all(firstBatchPromises);
      firstBatchResults.forEach(result => {
        sprintTasksObj[result.sprintId] = result.tasks;
        console.log(`✅ Found ${result.tasks.length} tasks for sprint ${result.sprintName}`);
      });
      setSprintTasks({ ...sprintTasksObj }); // İlk batch'i hemen göster
      
      // Kalan batch'leri arka planda yükle
      if (sprintList.length > BATCH_SIZE) {
        for (let i = BATCH_SIZE; i < sprintList.length; i += BATCH_SIZE) {
          const batch = sprintList.slice(i, i + BATCH_SIZE);
          const batchPromises = batch.map(async (sprint: JiraSprint) => {
            try {
              const tasks = await supabaseJiraService.getSprintIssues(sprint.id, createdDateRange);
              return { sprintId: sprint.id, sprintName: sprint.name, tasks };
            } catch (error) {
              console.error(`❌ Error fetching tasks for sprint ${sprint.name}:`, error);
              return { sprintId: sprint.id, sprintName: sprint.name, tasks: [] };
            }
          });
          
          const batchResults = await Promise.all(batchPromises);
          batchResults.forEach(result => {
            sprintTasksObj[result.sprintId] = result.tasks;
            console.log(`✅ Found ${result.tasks.length} tasks for sprint ${result.sprintName}`);
          });
          
          // Her batch sonrası state'i güncelle (progressive loading)
          setSprintTasks({ ...sprintTasksObj });
        }
      }
      
      // Cache all the data
      const dataToCache = {
        projects: filteredProjects,
        boards: boardsData,
        workload: filteredWorkload,
        sprints: sprintList,
        sprintTasks: sprintTasksObj
      };
      setCache(cacheKey, dataToCache);
      
      setCacheStatus('fresh');
      console.log('🎉 All Jira data loaded successfully!');
      setLastRefreshAt(Date.now());
    } catch (err: any) {
      console.error('❌ Error fetching Jira data:', err);
      setError(err.message || "Bilinmeyen hata");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated && user) {
      fetchAll();
    }
  }, [sprintType, isAuthenticated, user?.id]);

  // Seçim var ama projeler boşsa (eski cache) bir kez refresh dene
  useEffect(() => {
    if (!isAuthenticated || loading || hasTriedRefreshForEmptyProjects.current) return;
    if (projects && projects.length > 0) return;

    jiraFilterService.getSelectedProjects().then((selected) => {
      if (selected.length > 0 && !hasTriedRefreshForEmptyProjects.current) {
        hasTriedRefreshForEmptyProjects.current = true;
        console.log('🔄 Seçili projeler var ama liste boş (cache uyumsuz), yeniden yükleniyor...');
        clearCache();
        supabaseJiraService.clearCache();
        worklogService.clearCache();
        fetchAll();
      }
    });
  }, [isAuthenticated, loading, projects]);

  const refresh = () => {
    clearCache();
    supabaseJiraService.clearCache();
    setCapacityCalculationsState([]);
    setCapacityReady(false);
    setCapacityCacheKey(null);
    setDeveloperActualHours(null);
    setDeveloperActualHoursError(null);
    jiraFilterService.getDeveloperProjectMapFromUsers().then((map) => {
      setDeveloperProjectMapFromUsers(map);
      setDeveloperProjectMapReady(true);
    });
    fetchAll();
  };

  const computeDeveloperActualHours = useCallback(async () => {
    const result: Record<string, number> = {};
    if (!workload || workload.length === 0 || !sprints || sprints.length === 0) {
      return result;
    }

    const normalize = (name: string) => name
      .toLocaleLowerCase('tr')
      .replace(/ı/g, 'i').replace(/ş/g, 's').replace(/ç/g, 'c').replace(/ğ/g, 'g')
      .replace(/ü/g, 'u').replace(/ö/g, 'o')
      .replace(/İ/g, 'i').replace(/Ş/g, 's').replace(/Ç/g, 'c').replace(/Ğ/g, 'g')
      .replace(/Ü/g, 'u').replace(/Ö/g, 'o')
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const developerRanges = new Map<string, { start: string; end: string; normalized: string; fallback: number }>();
    let globalStart: string | null = null;
    let globalEnd: string | null = null;

    for (const developer of workload) {
      const developerName = developer.developer;
      const projectKey = await getDeveloperProjectKey(developerName);
      const fallback = Math.round((developer.totalActualHours || 0) * 100) / 100;

      if (!projectKey) {
        console.warn(`⚠️ ${developerName} için proje anahtarı bulunamadı`);
        result[developerName] = fallback;
        continue;
      }

      const developerSprints = sprints.filter(sprint => sprint.projectKey === projectKey);

      if (developerSprints.length === 0) {
        console.warn(`⚠️ ${developerName} (${projectKey}) için sprint bulunamadı`);
        result[developerName] = fallback;
        continue;
      }

      let earliestStart: Date | null = null;
      let latestEnd: Date | null = null;

      for (const sprint of developerSprints) {
        if (sprint.startDate) {
          // Timezone sorununu önlemek için tarih string'ine yerel timezone'da saat ekle
          const startDateStr = sprint.startDate.includes('T') ? sprint.startDate : `${sprint.startDate}T00:00:00`;
          const startDate = new Date(startDateStr);
          if (!earliestStart || startDate < earliestStart) {
            earliestStart = startDate;
          }
        }

        if (sprint.endDate) {
          // Timezone sorununu önlemek için tarih string'ine yerel timezone'da saat ekle
          const endDateStr = sprint.endDate.includes('T') ? sprint.endDate : `${sprint.endDate}T00:00:00`;
          const endDate = new Date(endDateStr);
          if (!latestEnd || endDate > latestEnd) {
            latestEnd = endDate;
          }
        }
      }

      if (!earliestStart || !latestEnd) {
        const today = new Date();
        const thirtyDaysAgo = new Date(today);
        thirtyDaysAgo.setDate(today.getDate() - 30);
        earliestStart = thirtyDaysAgo;
        latestEnd = today;
      }

      if (latestEnd) {
        latestEnd.setHours(23, 59, 59, 999);
      }

      // Tarihleri yerel timezone'da formatla (timezone kaymasını önlemek için)
      const formatLocalDate = (date: Date): string => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      };

      const startDateStr = formatLocalDate(earliestStart);
      const endDateStr = formatLocalDate(latestEnd);
      const normalized = normalize(developerName);

      developerRanges.set(developerName, {
        start: startDateStr,
        end: endDateStr,
        normalized,
        fallback
      });

      if (!globalStart || startDateStr < globalStart) {
        globalStart = startDateStr;
      }
      if (!globalEnd || endDateStr > globalEnd) {
        globalEnd = endDateStr;
      }
    }

    if (!globalStart || !globalEnd || developerRanges.size === 0) {
      return result;
    }

    const normalizedToName = new Map<string, string>();
    developerRanges.forEach((value, key) => {
      normalizedToName.set(value.normalized, key);
    });

    const totals = new Map<string, number>();

    try {
      const allWorklogs = await worklogService.getWorklogDataForDateRange(globalStart, globalEnd);

      const getDateString = (iso: string) => {
        const date = new Date(iso);
        return date.getFullYear() + '-' +
          String(date.getMonth() + 1).padStart(2, '0') + '-' +
          String(date.getDate()).padStart(2, '0');
      };

      for (const worklog of allWorklogs) {
        const normalizedAuthor = normalize(worklog.author.displayName);
        const developerName = normalizedToName.get(normalizedAuthor);
        if (!developerName) continue;

        const range = developerRanges.get(developerName);
        if (!range) continue;

        const worklogDate = getDateString(worklog.started);
        if (worklogDate < range.start || worklogDate > range.end) continue;

        const hours = Math.round((worklog.timeSpentSeconds / 3600) * 100) / 100;
        totals.set(developerName, (totals.get(developerName) || 0) + hours);
      }
    } catch (err) {
      console.error('❌ Error fetching worklogs for developer actual hours:', err);
    }

    developerRanges.forEach((range, developerName) => {
      if (totals.has(developerName)) {
        result[developerName] = Math.round(totals.get(developerName)! * 100) / 100;
      } else if (!(developerName in result)) {
        result[developerName] = range.fallback;
      }
    });

    return result;
  }, [workload, sprints, getDeveloperProjectKey]);

  useEffect(() => {
    if (!workload || workload.length === 0 || !sprints || sprints.length === 0) return;
    if (developerActualHoursLoading) return;

    const isFresh = developerActualHours && developerActualHoursUpdatedAt &&
      (Date.now() - developerActualHoursUpdatedAt) < DEVELOPER_ACTUAL_HOURS_TTL;
    if (isFresh) return;

    let cancelled = false;
    const load = async () => {
      setDeveloperActualHoursLoading(true);
      setDeveloperActualHoursError(null);
      try {
        const data = await computeDeveloperActualHours();
        if (!cancelled) {
          setDeveloperActualHours(data);
        }
      } catch (error) {
        console.error('❌ Error computing developer actual hours:', error);
        if (!cancelled) {
          setDeveloperActualHoursError(error instanceof Error ? error.message : 'Harcanan süre verisi yüklenemedi');
        }
      } finally {
        if (!cancelled) {
          setDeveloperActualHoursLoading(false);
        }
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [
    workload,
    sprints,
    developerActualHours,
    developerActualHoursUpdatedAt,
    developerActualHoursLoading,
    computeDeveloperActualHours,
    setDeveloperActualHours
  ]);

  return (
    <JiraDataContext.Provider value={{
      projects,
      boards,
      workload,
      sprints,
      sprintTasks,
      sprintType,
      setSprintType,
      loading,
      error,
      refresh,
      updateWorkloadStatus,
      createdDateRange,
      setCreatedDateRange,
      showSprintNotification,
      hideSprintNotification,
      cacheStatus,
      capacityCalculations: capacityCalculationsState,
      setCapacityCalculations,
      capacityReady,
      capacityCacheKey,
      developerActualHours,
      setDeveloperActualHours,
      developerActualHoursUpdatedAt,
      developerActualHoursLoading,
      developerActualHoursError,
      getDeveloperProjectKey,
      developerProjectMapReady,
      lastRefreshAt
    }}>
      {children}
    </JiraDataContext.Provider>
  );
};

export const useJiraData = () => {
  const context = useContext(JiraDataContext);
  if (!context) {
    throw new Error("useJiraData sadece JiraDataProvider içinde kullanılabilir.");
  }
  return context;
};

const filterWorkloadByUserAccess = async (
  workloadData: DeveloperWorkload[],
  user: any,
  supabaseClient: typeof supabase
): Promise<DeveloperWorkload[]> => {
  if (!user) return [];

  if (user.role === 'admin') {
    console.log('👑 Admin kullanıcı - tüm yazılımcılar gösterilecek:', workloadData.length);
    return workloadData;
  }

  if (user.role === 'developer') {
    const normalize = (s: string) => s
      .toLocaleLowerCase('tr')
      .replace(/ı/g, 'i').replace(/ş/g, 's').replace(/ç/g, 'c').replace(/ğ/g, 'g')
      .replace(/ü/g, 'u').replace(/ö/g, 'o')
      .replace(/İ/g, 'i').replace(/Ş/g, 's').replace(/Ç/g, 'c').replace(/Ğ/g, 'g').replace(/Ü/g, 'u').replace(/Ö/g, 'o')
      .replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
    const tokens = (s: string) => normalize(s).split(' ').filter(Boolean);
    const uTokens = tokens(user.name);
    const devMatches = (devName: string) => {
      const dTokens = tokens(devName);
      if (uTokens.join(' ') === dTokens.join(' ')) return true;
      if (uTokens.length >= 2 && dTokens.length >= 2) {
        if (uTokens[0] === dTokens[0] && uTokens[uTokens.length - 1] === dTokens[dTokens.length - 1]) return true;
      }
      const emailLocal = (user.email.split('@')[0] || '').toLowerCase();
      const emailTokens = emailLocal.replace(/[^a-z0-9\.\-_]/g, ' ').split(/[\.|\-|_]+/).filter(Boolean);
      if (emailTokens.length > 0) {
        const allFound = emailTokens.every(t => dTokens.includes(t));
        if (allFound) return true;
      }
      return false;
    };
    const filteredForDeveloper = workloadData.filter(dev => devMatches(dev.developer));
    console.log(`👨‍💻 Developer ${user.name} - sadece kendi verisi gösterilecek:`, filteredForDeveloper.length);
    return filteredForDeveloper;
  }

  if (user.role === 'analyst') {
    try {
      const analystProjects: string[] = Array.isArray(user.assignedProjects) ? user.assignedProjects : [];
      const { data: projectUsers, error } = await supabaseClient
        .from('users')
        .select('name, email, role, assigned_projects, is_active')
        .eq('is_active', true);
      if (error) {
        console.error('Error fetching users for analyst intersection filtering:', error);
        return [];
      }
      const normalize = (s: string) => s
        .toLocaleLowerCase('tr')
        .replace(/ı/g, 'i').replace(/ş/g, 's').replace(/ç/g, 'c').replace(/ğ/g, 'g')
        .replace(/ü/g, 'u').replace(/ö/g, 'o')
        .replace(/İ/g, 'i').replace(/Ş/g, 's').replace(/Ç/g, 'c').replace(/Ğ/g, 'g').replace(/Ü/g, 'u').replace(/Ö/g, 'o')
        .replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
      const analystNameNorm = normalize(user.name || '');
      const sharedUsers = (projectUsers || [])
        .filter(u => u.role !== 'admin' && u.email !== user.email)
        .filter(u => {
          const ap: string[] = Array.isArray(u.assigned_projects) ? u.assigned_projects : [];
          return ap.some(p => analystProjects.includes(p));
        })
        .map(u => u.name);
      const sharedNorm = new Set(sharedUsers.map(normalize));
      const filteredWorkload = workloadData
        .filter(dev => sharedNorm.has(normalize(dev.developer)))
        .filter(dev => normalize(dev.developer) !== analystNameNorm);
      console.log(`📊 Analist (${user.name}) için ${filteredWorkload.length}/${workloadData.length} geliştirici (ortak projelerle) gösteriliyor.`);
      return filteredWorkload;
    } catch (e) {
      console.error('Analyst intersection filter failed:', e);
      return [];
    }
  }

  return [];
}; 

