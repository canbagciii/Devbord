import * as React from "react";
import { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { supabaseJiraService } from "../lib/supabaseJiraService";
import { supabase } from "../lib/supabase";
import { jiraFilterService } from "../lib/jiraFilterService";
import { useAuth } from "./AuthContext";
import type { JiraProject, JiraBoard, DeveloperWorkload, JiraSprint, JiraTask } from "../types";
import { developerProjectKeyMap } from "../data/developerProjectMap";
import { worklogService } from "../services/worklogService";

interface CacheData {
  data: any;
  timestamp: number;
  expiry: number;
}

const jiraDataCache = new Map<string, CacheData>();
const CACHE_DURATION = 10 * 60 * 1000;
const DEVELOPER_ACTUAL_HOURS_TTL = 15 * 60 * 1000;

interface JiraDataContextType {
  projects: JiraProject[] | null;
  boards: JiraBoard[] | null;
  workload: DeveloperWorkload[] | null;
  sprints: JiraSprint[] | null;
  sprintTasks: Record<string, JiraTask[]> | null;
  sprintType: "active" | "closed" | "both";
  setSprintType: (type: "active" | "closed" | "both") => void;
  loading: boolean;
  error: string | null;
  refresh: () => void;
  updateWorkloadStatus: (developerName: string, newCapacity: number) => void;
  createdDateRange: [string | null, string | null];
  setCreatedDateRange: (range: [string | null, string | null]) => void;
  showSprintNotification: boolean;
  hideSprintNotification: () => void;
  cacheStatus: "loading" | "cached" | "fresh";
  capacityCalculations: any[];
  setCapacityCalculations: (calculations: any[], cacheKey?: string | null) => void;
  capacityReady: boolean;
  capacityCacheKey: string | null;
  developerActualHours: Record<string, number> | null;
  setDeveloperActualHours: (data: Record<string, number> | null) => void;
  developerActualHoursUpdatedAt: number | null;
  developerActualHoursLoading: boolean;
  developerActualHoursError: string | null;
  getDeveloperProjectKey: (developerName: string) => string | undefined;
  developerProjectMapReady: boolean;
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
  const [sprintType, setSprintType] = useState<"active" | "closed">("active");
  const prevSprintTypeRef = useRef<"active" | "closed" | null>(null);

  useEffect(() => {
    if (prevSprintTypeRef.current !== null && prevSprintTypeRef.current !== sprintType) {
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
  const [cacheStatus, setCacheStatus] = useState<"loading" | "cached" | "fresh">("loading");
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

  const getFromCache = <T,>(key: string): T | null => {
    const cached = jiraDataCache.get(key);
    if (cached && Date.now() < cached.expiry) return cached.data as T;
    return null;
  };

  const setCache = <T,>(key: string, data: T): void => {
    jiraDataCache.set(key, { data, timestamp: Date.now(), expiry: Date.now() + CACHE_DURATION });
  };

  const clearCache = (): void => { jiraDataCache.clear(); };

  useEffect(() => {
    if (isAuthenticated && !hasShownNotification) {
      setSprintType("active");
      setShowSprintNotification(true);
      setHasShownNotification(true);
    }
  }, [isAuthenticated, hasShownNotification]);

  const hideSprintNotification = () => { setShowSprintNotification(false); };

  const normalizeName = (name: string) => (name || "")
    .toLocaleLowerCase("tr")
    .replace(/ı/g, "i").replace(/ş/g, "s").replace(/ç/g, "c").replace(/ğ/g, "g")
    .replace(/ü/g, "u").replace(/ö/g, "o")
    .replace(/İ/g, "i").replace(/Ş/g, "s").replace(/Ç/g, "c").replace(/Ğ/g, "g").replace(/Ü/g, "u").replace(/Ö/g, "o")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  // ✅ FIX: 4 katmanlı fallback zinciri — yeni eklenen her yazılımcı için statik map güncellemeye gerek yok
  const getDeveloperProjectKey = useCallback((developerName: string): string | undefined => {
    const n = normalizeName(developerName);

    // 1. Kullanıcı Yönetimi (users.assigned_projects) — normalize edilmiş isimle
    const fromUsers = developerProjectMapFromUsers.get(n)?.[0];
    if (fromUsers) return fromUsers;

    // 2. Statik map — tam eşleşme
    if (developerProjectKeyMap[developerName]) return developerProjectKeyMap[developerName];

    // 3. Statik map — normalize edilmiş eşleşme (büyük/küçük harf, Türkçe karakter farkı)
    const staticEntry = Object.entries(developerProjectKeyMap).find(
      ([key]) => normalizeName(key) === n
    );
    if (staticEntry) return staticEntry[1];

    // 4. Workload + sprint verisinden otomatik türet
    //    Yazılımcının Jira issue detaylarındaki proje adını sprint projectKey ile eşleştirir.
    //    Bu sayede statik map veya users tablosunda olmayan yeni yazılımcılar da doğru proje anahtarını alır.
    if (workload && sprints && sprints.length > 0) {
      const dev = workload.find(w => normalizeName(w.developer) === n);
      if (dev && dev.details && dev.details.length > 0) {
        // Sprint projectKey listesi
        const projectKeys = [...new Set(sprints.map(s => s.projectKey).filter(Boolean))];
        for (const detail of dev.details) {
          if (!detail.project) continue;
          const detailUpper = detail.project.toUpperCase();
          // Önce sprint projectKey ile doğrudan eşleştir
          const directMatch = projectKeys.find(pk => detailUpper.includes(pk));
          if (directMatch) return directMatch;
        }
        // Sprint adından projectKey türet (örn. "ZK 2026.04" → "ZK")
        if (dev.details[0]) {
          const matchedSprint = sprints.find(s =>
            dev.details!.some(d => d.project && s.projectKey && d.project.toUpperCase().includes(s.projectKey))
          );
          if (matchedSprint?.projectKey) return matchedSprint.projectKey;
        }
      }
    }

    return undefined;
  }, [developerProjectMapFromUsers, workload, sprints]);

  useEffect(() => {
    if (!isAuthenticated) return;
    jiraFilterService.getDeveloperProjectMapFromUsers().then((map) => {
      setDeveloperProjectMapFromUsers(map);
      setDeveloperProjectMapReady(true);
    });
  }, [isAuthenticated]);

  const updateWorkloadStatus = (developerName: string, newCapacity: number) => {
    if (!workload) return;
    const updatedWorkload = workload.map(dev => {
      if (dev.developer === developerName) {
        const totalEstimatedHours = Math.round(((dev.details || []).reduce((sum, d) => sum + (d.hours || 0), 0)) * 10) / 10;
        let newStatus: "Eksik Yük" | "Yeterli" | "Aşırı Yük";
        if (totalEstimatedHours < newCapacity) newStatus = "Eksik Yük";
        else if (totalEstimatedHours === newCapacity) newStatus = "Yeterli";
        else newStatus = "Aşırı Yük";
        return { ...dev, status: newStatus, dynamicCapacity: newCapacity };
      }
      return dev;
    });
    setWorkload(updatedWorkload);
  };

  const fetchAll = async () => {
    if (!isAuthenticated) return;
    const [projectKeys, developerNames] = await Promise.all([
      jiraFilterService.getProjectKeys(),
      jiraFilterService.getDeveloperNames()
    ]);
    const selectionKey = [...projectKeys].sort().join(",") + "|" + [...developerNames].sort().join(",");
    const cacheKey = `jira-data-${sprintType}-${selectionKey}`;
    const cachedData = getFromCache<{
      projects: JiraProject[]; boards: JiraBoard[]; workload: DeveloperWorkload[];
      sprints: JiraSprint[]; sprintTasks: Record<string, JiraTask[]>;
    }>(cacheKey);

    if (cachedData) {
      setCacheStatus("cached");
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

    setCacheStatus("loading");
    setLoading(true);
    setError(null);
    try {
      const isAnalystOrDeveloper = user && (user.role === "analyst" || user.role === "developer");
      const shouldGetAllClosedSprints = isAnalystOrDeveloper && sprintType === "closed";

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

      const accessibleProjectKeys = getAccessibleProjects();
      const filteredProjects = accessibleProjectKeys.length > 0
        ? projectsData.filter(project => accessibleProjectKeys.includes(project.key))
        : projectsData;

      setProjects(filteredProjects);
      setBoards(boardsData);

      const filteredWorkload = await filterWorkloadByUserAccess(workloadData, user);

      const updatedWorkload = filteredWorkload.map(dev => {
        const totalActualHours = dev.totalActualHours || 0;
        let capacity = 70;
        try {
          if (typeof localStorage !== "undefined") {
            const storedDaily = localStorage.getItem("dailyHours");
            const parsed = storedDaily ? parseFloat(storedDaily) : NaN;
            if (Number.isFinite(parsed) && parsed > 0) capacity = Math.round(parsed * 10);
          }
        } catch (e) {}
        let newStatus: "Eksik Yük" | "Yeterli" | "Aşırı Yük";
        if (totalActualHours < capacity) newStatus = "Eksik Yük";
        else if (totalActualHours === capacity) newStatus = "Yeterli";
        else newStatus = "Aşırı Yük";
        return { ...dev, status: newStatus };
      });
      setWorkload(updatedWorkload);

      const sprintList = sprintsData
        .filter((s: any) => accessibleProjectKeys.length === 0 || accessibleProjectKeys.includes(s.projectKey))
        .map((s: any) => s.sprint);
      setSprints(sprintList);

      const BATCH_SIZE = shouldGetAllClosedSprints ? 10 : 20;
      const sprintTasksObj: Record<string, JiraTask[]> = {};
      const firstBatch = sprintList.slice(0, BATCH_SIZE);
      const firstBatchResults = await Promise.all(firstBatch.map(async (sprint: JiraSprint) => {
        try {
          const tasks = await supabaseJiraService.getSprintIssues(sprint.id, createdDateRange);
          return { sprintId: sprint.id, sprintName: sprint.name, tasks };
        } catch { return { sprintId: sprint.id, sprintName: sprint.name, tasks: [] }; }
      }));
      firstBatchResults.forEach(r => { sprintTasksObj[r.sprintId] = r.tasks; });
      setSprintTasks({ ...sprintTasksObj });

      if (sprintList.length > BATCH_SIZE) {
        for (let i = BATCH_SIZE; i < sprintList.length; i += BATCH_SIZE) {
          const batch = sprintList.slice(i, i + BATCH_SIZE);
          const batchResults = await Promise.all(batch.map(async (sprint: JiraSprint) => {
            try {
              const tasks = await supabaseJiraService.getSprintIssues(sprint.id, createdDateRange);
              return { sprintId: sprint.id, sprintName: sprint.name, tasks };
            } catch { return { sprintId: sprint.id, sprintName: sprint.name, tasks: [] }; }
          }));
          batchResults.forEach(r => { sprintTasksObj[r.sprintId] = r.tasks; });
          setSprintTasks({ ...sprintTasksObj });
        }
      }

      const dataToCache = {
        projects: filteredProjects, boards: boardsData,
        workload: filteredWorkload, sprints: sprintList, sprintTasks: sprintTasksObj
      };
      setCache(cacheKey, dataToCache);
      setCacheStatus("fresh");
      setLastRefreshAt(Date.now());
    } catch (err: any) {
      console.error("Error fetching Jira data:", err);
      setError(err.message || "Bilinmeyen hata");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) fetchAll();
  }, [sprintType, isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated || loading || hasTriedRefreshForEmptyProjects.current) return;
    if (projects && projects.length > 0) return;
    jiraFilterService.getSelectedProjects().then((selected) => {
      if (selected.length > 0 && !hasTriedRefreshForEmptyProjects.current) {
        hasTriedRefreshForEmptyProjects.current = true;
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
    if (!workload || workload.length === 0 || !sprints || sprints.length === 0) return result;

    const normalize = (name: string) => name
      .toLocaleLowerCase("tr")
      .replace(/ı/g, "i").replace(/ş/g, "s").replace(/ç/g, "c").replace(/ğ/g, "g")
      .replace(/ü/g, "u").replace(/ö/g, "o")
      .replace(/İ/g, "i").replace(/Ş/g, "s").replace(/Ç/g, "c").replace(/Ğ/g, "g").replace(/Ü/g, "u").replace(/Ö/g, "o")
      .replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();

    const developerRanges = new Map<string, { start: string; end: string; normalized: string; fallback: number }>();
    let globalStart: string | null = null;
    let globalEnd: string | null = null;

    for (const developer of workload) {
      const developerName = developer.developer;
      const projectKey = getDeveloperProjectKey(developerName);
      const fallback = Math.round((developer.totalActualHours || 0) * 100) / 100;
      if (!projectKey) { result[developerName] = fallback; continue; }

      const developerSprints = sprints.filter(sprint => sprint.projectKey === projectKey);
      if (developerSprints.length === 0) { result[developerName] = fallback; continue; }

      let earliestStart: Date | null = null;
      let latestEnd: Date | null = null;
      for (const sprint of developerSprints) {
        if (sprint.startDate) {
          const d = new Date(sprint.startDate.includes("T") ? sprint.startDate : `${sprint.startDate}T00:00:00`);
          if (!earliestStart || d < earliestStart) earliestStart = d;
        }
        if (sprint.endDate) {
          const d = new Date(sprint.endDate.includes("T") ? sprint.endDate : `${sprint.endDate}T00:00:00`);
          if (!latestEnd || d > latestEnd) latestEnd = d;
        }
      }
      if (!earliestStart || !latestEnd) {
        const today = new Date(); const ago = new Date(today); ago.setDate(today.getDate() - 30);
        earliestStart = ago; latestEnd = today;
      }
      latestEnd.setHours(23, 59, 59, 999);
      const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
      const startDateStr = fmt(earliestStart);
      const endDateStr = fmt(latestEnd);
      const normalized = normalize(developerName);
      developerRanges.set(developerName, { start: startDateStr, end: endDateStr, normalized, fallback });
      if (!globalStart || startDateStr < globalStart) globalStart = startDateStr;
      if (!globalEnd || endDateStr > globalEnd) globalEnd = endDateStr;
    }

    if (!globalStart || !globalEnd || developerRanges.size === 0) return result;

    const normalizedToName = new Map<string, string>();
    developerRanges.forEach((value, key) => { normalizedToName.set(value.normalized, key); });
    const totals = new Map<string, number>();

    try {
      const allWorklogs = await worklogService.getWorklogDataForDateRange(globalStart, globalEnd);
      const getDateString = (iso: string) => {
        const d = new Date(iso);
        return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
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
      console.error("Error fetching worklogs:", err);
    }

    developerRanges.forEach((range, developerName) => {
      if (totals.has(developerName)) result[developerName] = Math.round(totals.get(developerName)! * 100) / 100;
      else if (!(developerName in result)) result[developerName] = range.fallback;
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
        if (!cancelled) setDeveloperActualHours(data);
      } catch (error) {
        if (!cancelled) setDeveloperActualHoursError(error instanceof Error ? error.message : "Harcanan süre verisi yüklenemedi");
      } finally {
        if (!cancelled) setDeveloperActualHoursLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [workload, sprints, developerActualHours, developerActualHoursUpdatedAt, developerActualHoursLoading, computeDeveloperActualHours, setDeveloperActualHours]);

  return (
    <JiraDataContext.Provider value={{
      projects, boards, workload, sprints, sprintTasks, sprintType, setSprintType,
      loading, error, refresh, updateWorkloadStatus, createdDateRange, setCreatedDateRange,
      showSprintNotification, hideSprintNotification, cacheStatus,
      capacityCalculations: capacityCalculationsState, setCapacityCalculations,
      capacityReady, capacityCacheKey,
      developerActualHours, setDeveloperActualHours,
      developerActualHoursUpdatedAt, developerActualHoursLoading, developerActualHoursError,
      getDeveloperProjectKey, developerProjectMapReady, lastRefreshAt
    }}>
      {children}
    </JiraDataContext.Provider>
  );
};

export const useJiraData = () => {
  const context = useContext(JiraDataContext);
  if (!context) throw new Error("useJiraData sadece JiraDataProvider içinde kullanılabilir.");
  return context;
};

const filterWorkloadByUserAccess = async (workloadData: DeveloperWorkload[], user: any): Promise<DeveloperWorkload[]> => {
  if (!user) return [];
  if (user.role === "admin") return workloadData;
  if (user.role === "developer") {
    const normalize = (s: string) => s.toLocaleLowerCase("tr")
      .replace(/ı/g,"i").replace(/ş/g,"s").replace(/ç/g,"c").replace(/ğ/g,"g")
      .replace(/ü/g,"u").replace(/ö/g,"o").replace(/İ/g,"i").replace(/Ş/g,"s")
      .replace(/Ç/g,"c").replace(/Ğ/g,"g").replace(/Ü/g,"u").replace(/Ö/g,"o")
      .replace(/[^a-z0-9\s]/g," ").replace(/\s+/g," ").trim();
    const tokens = (s: string) => normalize(s).split(" ").filter(Boolean);
    const uTokens = tokens(user.name);
    const devMatches = (devName: string) => {
      const dTokens = tokens(devName);
      if (uTokens.join(" ") === dTokens.join(" ")) return true;
      if (uTokens.length >= 2 && dTokens.length >= 2) {
        if (uTokens[0] === dTokens[0] && uTokens[uTokens.length-1] === dTokens[dTokens.length-1]) return true;
      }
      const emailLocal = (user.email.split("@")[0] || "").toLowerCase();
      const emailTokens = emailLocal.replace(/[^a-z0-9\.\-_]/g," ").split(/[.|\-|_]+/).filter(Boolean);
      if (emailTokens.length > 0 && emailTokens.every((t: string) => dTokens.includes(t))) return true;
      return false;
    };
    return workloadData.filter(dev => devMatches(dev.developer));
  }
  if (user.role === "analyst") {
    try {
      const analystProjects: string[] = Array.isArray(user.assignedProjects) ? user.assignedProjects : [];
      const { data: projectUsers, error } = await supabase
        .from("users").select("name, email, role, assigned_projects, is_active").eq("is_active", true);
      if (error) return [];
      const normalize = (s: string) => s.toLocaleLowerCase("tr")
        .replace(/ı/g,"i").replace(/ş/g,"s").replace(/ç/g,"c").replace(/ğ/g,"g")
        .replace(/ü/g,"u").replace(/ö/g,"o").replace(/İ/g,"i").replace(/Ş/g,"s")
        .replace(/Ç/g,"c").replace(/Ğ/g,"g").replace(/Ü/g,"u").replace(/Ö/g,"o")
        .replace(/[^a-z0-9\s]/g," ").replace(/\s+/g," ").trim();
      const analystNameNorm = normalize(user.name || "");
      const sharedUsers = (projectUsers || [])
        .filter(u => u.role !== "admin" && u.email !== user.email)
        .filter(u => { const ap: string[] = Array.isArray(u.assigned_projects) ? u.assigned_projects : []; return ap.some(p => analystProjects.includes(p)); })
        .map(u => u.name);
      const sharedNorm = new Set(sharedUsers.map(normalize));
      return workloadData
        .filter(dev => sharedNorm.has(normalize(dev.developer)))
        .filter(dev => normalize(dev.developer) !== analystNameNorm);
    } catch { return []; }
  }
  return [];
};