import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { JiraSprint, JiraProject, JiraTask } from '../types';
import { jiraService } from '../lib/jiraService';
import { SprintEvaluationForm } from './SprintEvaluationForm';
import { supabaseEvaluationService } from '../lib/supabaseEvaluationService';
import { Activity, Calendar, Users, Clock, Loader, RefreshCw, ChevronRight, Download, FileText, Bug, Zap, Target, CheckCircle, HelpCircle } from 'lucide-react';
import { useJiraData } from '../context/JiraDataContext';
import { useAuth } from '../context/AuthContext';

import { getPlainTextFromJiraAdf } from '../utils/jiraUtils';
import ProjectSprintOnboarding, { useProjectSprintOnboarding } from './ProjectSprintOverviewOnboarding';

interface SprintWithDetails extends JiraSprint {
  boardName: string;
  projectName: string;
  taskCount: number;
  totalHours: number;
  assignedDevelopers: string[];
}

// Optimize edilmiş helper fonksiyonlar - component dışında tanımlanarak her render'da yeniden oluşturulmasını önler
const statusIsDone = (statusRaw: string | undefined): boolean => {
  if (!statusRaw) return false;
  const s = statusRaw.toLowerCase();
  return s === 'done' || s === 'tamam' || s === 'uat' || s === 'tamamlandı' || 
         s === 'completed' || s === 'closed' || s === 'resolved' ||
         s.includes('done') || s.includes('tamam') || s.includes('uat');
};

const getIssueType = (task: JiraTask): string => {
  if (task.issueType) {
    return task.issueType;
  }
  
  // Sadece gerektiğinde description parse et
  const summary = task.summary.toLowerCase();
  if (summary.includes('bug') || summary.includes('hata') || 
      summary.includes('düzeltme') || summary.includes('sorun')) {
    return 'Bug';
  }
  
  if (summary.includes('story') || summary.includes('öykü') || summary.includes('hikaye')) {
    return 'Story';
  }
  
  // Description parse etmek pahalı, sadece summary'de bulamazsak yap
  if (task.description) {
    const description = getPlainTextFromJiraAdf(task.description).toLowerCase();
    if (description.includes('bug') || description.includes('hata')) {
      return 'Bug';
    }
    if (description.includes('story')) {
      return 'Story';
    }
  }
  
  return 'Task';
};

const filterTasksByDateRange = (tasks: JiraTask[], start: string | null, end: string | null): JiraTask[] => {
  if (!start && !end) return tasks;
  
  // Tarih objelerini önceden oluştur (her task için tekrar oluşturulmasını önle)
  const startDate = start ? new Date(start) : null;
  const endDate = end ? new Date(end + 'T23:59:59') : null;
  
  return tasks.filter((task: JiraTask) => {
    if (!task.created) return false;
    const taskDate = new Date(task.created);
    
    if (startDate && endDate) {
      return taskDate >= startDate && taskDate <= endDate;
    } else if (startDate) {
      return taskDate >= startDate;
    } else if (endDate) {
      return taskDate <= endDate;
    }
    return true;
  });
};

export const ProjectSprintOverview: React.FC = () => {
  const { projects, sprints, sprintTasks, loading, error, refresh, sprintType, createdDateRange } = useJiraData();
  const { canAccessProject, getAccessibleProjects, user, hasRole } = useAuth();
  const { isOnboardingOpen, openOnboarding, closeOnboarding } = useProjectSprintOnboarding();
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [selectedProject, setSelectedProject] = useState<string>('all');
  const [userEvaluations, setUserEvaluations] = useState<Record<string, boolean>>({});
  const [showEvaluationForm, setShowEvaluationForm] = useState<{
    sprint: JiraSprint;
    tasks: JiraTask[];
    projectName: string;
  } | null>(null);
  const [debugInfo, setDebugInfo] = useState<any>(null);
  
  // Analist/yazılımcı kullanıcıları için filtreler
  const isAnalystOrDeveloper = useMemo(() => {
    return user && (hasRole('analyst') || hasRole('developer'));
  }, [user, hasRole]);
  const [selectedYear, setSelectedYear] = useState<string>('all');
  const [sprintNameFilter, setSprintNameFilter] = useState<string>('');
  const [debouncedSprintNameFilter, setDebouncedSprintNameFilter] = useState<string>('');
  const [displayedSprintCount, setDisplayedSprintCount] = useState<number>(30); // İlk 30 sprint'i göster
  const hasInitializedYear = useRef(false);
  
  // Debounce sprint name filter (300ms gecikme)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSprintNameFilter(sprintNameFilter);
    }, 300);
    return () => clearTimeout(timer);
  }, [sprintNameFilter]);

  // Erişilebilir projeleri önceden hesapla (her sprint için tekrar kontrol etmeyi önle)
  const accessibleProjects = useMemo(() => {
    return getAccessibleProjects();
  }, [getAccessibleProjects]);

  // Erişilebilir proje kontrolü için Set kullan (O(1) lookup)
  const accessibleProjectsSet = useMemo(() => {
    return new Set(accessibleProjects);
  }, [accessibleProjects]);

  // canAccessProject fonksiyonunu optimize et
  const canAccessProjectOptimized = useCallback((projectKey: string): boolean => {
    if (accessibleProjects.length === 0) return true; // Admin - tüm projelere erişebilir
    return accessibleProjectsSet.has(projectKey);
  }, [accessibleProjects, accessibleProjectsSet]);

  useEffect(() => {
    if (sprints && sprintTasks) {
      setLastUpdate(new Date());
      
      // Debug bilgilerini sadece development modunda güncelle
      if (process.env.NODE_ENV === 'development') {
        setDebugInfo({
          sprintType,
          sprintsCount: sprints.length,
          sprintTasksKeys: Object.keys(sprintTasks),
          sprintDetails: sprints.map(s => ({
            id: s.id,
            name: s.name,
            state: s.state,
            projectKey: s.projectKey
          }))
        });
      }
    }
  }, [sprints, sprintTasks, sprintType]);

  useEffect(() => {
    const loadUserEvaluations = async () => {
      if (!user || !sprints) return;

      const closedSprints = sprints.filter(sprint => sprint.state === 'closed');
      if (closedSprints.length === 0) {
        setUserEvaluations({});
        return;
      }

      // Paralel olarak tüm değerlendirmeleri kontrol et
      const evaluationPromises = closedSprints.map(async (sprint) => {
        try {
          const hasEvaluated = await supabaseEvaluationService.hasUserEvaluated(sprint.id, user.email);
          return { sprintId: sprint.id, hasEvaluated };
        } catch (error) {
          console.error(`Error checking evaluation for sprint ${sprint.id}:`, error);
          return { sprintId: sprint.id, hasEvaluated: false };
        }
      });

      const results = await Promise.all(evaluationPromises);
      const evaluationStatus: Record<string, boolean> = {};
      results.forEach(result => {
        evaluationStatus[result.sprintId] = result.hasEvaluated;
      });

      setUserEvaluations(evaluationStatus);
    };

    loadUserEvaluations();
  }, [user, sprints]);

  // Sprint detaylarını context'ten oluştur - optimize edilmiş versiyon
  const sprintDetails = useMemo(() => {
    if (!sprints || !sprintTasks) return [];

    const [start, end] = createdDateRange;
    const shouldFilterByDate = sprintType === 'active' && (start || end);

    return sprints
      .filter(sprint => canAccessProjectOptimized(sprint.projectKey || ''))
      .map((sprint: JiraSprint) => {
          const allTasks: JiraTask[] = sprintTasks[sprint.id] || [];
          
          // Tarih filtreleme - optimize edilmiş
          let tasks: JiraTask[] = shouldFilterByDate 
            ? filterTasksByDateRange(allTasks, start, end)
            : [...allTasks];

          // Epic tespiti için cache (aynı task için tekrar kontrol etmemek için)
          const epicCache = new Map<string, boolean>();
          const isEpicTask = (task: JiraTask): boolean => {
            if (epicCache.has(task.key)) {
              return epicCache.get(task.key)!;
            }
            // Önce task.issueType'ı kontrol et (Jira'dan gelen gerçek değer)
            if (task.issueType) {
              const issueTypeLower = task.issueType.toLowerCase();
              if (issueTypeLower === 'epic' || issueTypeLower === 'epik') {
                epicCache.set(task.key, true);
                return true;
              }
            }
            // Sonra getIssueType ile kontrol et
            const typeName = getIssueType(task);
            const typeNameLower = typeName.toLowerCase();
            const isEpic = typeNameLower === 'epic' || typeNameLower === 'epik';
            epicCache.set(task.key, isEpic);
            return isEpic;
          };

          // Parent key'leri önceden hesapla (Set kullanarak O(1) lookup)
          // Epic'leri hariç tut
          const mainTasks = tasks.filter(t => !t.isSubtask);
          const epicKeys = new Set<string>();
          const parentKeySet = new Set<string>();
          const parentKeyMap = new Map<string, JiraTask>();
          
          // Tek geçişte main task'ları işle
          for (const task of mainTasks) {
            if (isEpicTask(task)) {
              epicKeys.add(task.key);
            } else {
              parentKeySet.add(task.key);
              parentKeyMap.set(task.key, task);
            }
          }
          
          // Subtask'ların parent'larını kontrol et (Epic parent'ları hariç)
          const orphanParentKeys = new Set<string>();
          const subtasksByParent = new Map<string, JiraTask[]>(); // Optimize: relatedSubs için
          
          for (const task of tasks) {
            if (task.isSubtask && task.parentKey) {
              // Parent Epic değilse ve parentKeySet'te yoksa ekle
              if (!epicKeys.has(task.parentKey) && !parentKeySet.has(task.parentKey)) {
                orphanParentKeys.add(task.parentKey);
              }
              
              // Subtask'ları parent'a göre grupla (daha sonra kullanmak için)
              if (!subtasksByParent.has(task.parentKey)) {
                subtasksByParent.set(task.parentKey, []);
              }
              subtasksByParent.get(task.parentKey)!.push(task);
            }
          }
          
          // Eksik parent'ları ekle (Epic'ler hariç)
          for (const parentKey of orphanParentKeys) {
            // Epic değilse ekle
            if (epicKeys.has(parentKey)) {
              continue; // Epic'i atla
            }
            const parent = allTasks.find(t => !t.isSubtask && t.key === parentKey && !isEpicTask(t));
            if (parent && !parentKeyMap.has(parent.key)) {
              tasks.push(parent);
              parentKeyMap.set(parent.key, parent);
              parentKeySet.add(parent.key);
            }
          }

          // Issue type breakdown ve saat hesaplamaları - tek geçişte
          const issueTypeBreakdown: Record<string, { count: number; completed: number }> = {};
          let totalHours = 0;
          let totalActualHours = 0;
          const assignedDevelopersSet = new Set<string>();
          
          for (const task of mainTasks) {
            const typeName = getIssueType(task);
            
            if (!issueTypeBreakdown[typeName]) {
              issueTypeBreakdown[typeName] = { count: 0, completed: 0 };
            }
            
            issueTypeBreakdown[typeName].count++;
            
            if (statusIsDone(task.status)) {
              issueTypeBreakdown[typeName].completed++;
            }
          }
          
          // Tüm task'lar için saat hesaplamaları
          for (const task of tasks) {
            totalHours += task.estimatedHours || 0;
            totalActualHours += task.actualHours || 0;
            if (task.assignee && task.assignee !== 'Unassigned') {
              assignedDevelopersSet.add(task.assignee);
            }
          }

          // Parent bazlı tamamlanma sayısı - optimize edilmiş
          // Epic'ler zaten parentKeySet'ten hariç tutuldu
          const allParentKeys = new Set([...parentKeySet, ...orphanParentKeys]);
          let completedParentCount = 0;
          
          // Debug: Epic kontrolü
          if (process.env.NODE_ENV === 'development' && sprint.projectKey === 'AN') {
            console.log(`🔍 AN Sprint ${sprint.name} Epic Debug:`, {
              epicKeys: Array.from(epicKeys),
              epicCount: epicKeys.size,
              parentKeySetSize: parentKeySet.size,
              orphanParentKeysSize: orphanParentKeys.size,
              totalParentCount: allParentKeys.size
            });
          }
          
          // Parent tamamlanma kontrolü - optimize edilmiş (Map kullanarak)
          for (const parentKey of allParentKeys) {
            const parent = parentKeyMap.get(parentKey);
            const relatedSubs = subtasksByParent.get(parentKey) || [];
            
            const isCompleted = (parent && statusIsDone(parent.status)) || 
                              relatedSubs.some(st => statusIsDone(st.status));
            
            if (isCompleted) {
              completedParentCount++;
            }
          }
          
          return {
            ...sprint,
            boardName: getBoardNameFromProjectKey(sprint.projectKey || ''),
            projectName: getProjectNameFromKey(sprint.projectKey || ''),
            taskCount: allParentKeys.size,
            totalHours,
            totalActualHours: Math.round(totalActualHours * 10) / 10,
            assignedDevelopers: Array.from(assignedDevelopersSet),
            doneTaskCount: completedParentCount,
            successRate: allParentKeys.size > 0 ? Math.round((completedParentCount / allParentKeys.size) * 100) : 0,
            issueTypeBreakdown
          };
        });
  }, [sprints, sprintTasks, canAccessProjectOptimized, sprintType, createdDateRange]);

  // Mevcut yılları hesapla (analist/yazılımcı için)
  const availableYears = useMemo(() => {
    if (!sprintDetails || sprintDetails.length === 0) return [];
    const years = new Set<number>();
    sprintDetails.forEach(sprint => {
      if (sprint.endDate) {
        const year = new Date(sprint.endDate).getFullYear();
        if (year > 2020) {
          years.add(year);
        }
      }
    });
    return Array.from(years).sort((a, b) => b - a); // En yeni yıl önce
  }, [sprintDetails]);

  // Varsayılan olarak 2026 yılını seç (eğer mevcut yıllar arasındaysa)
  useEffect(() => {
    // Sadece analist/yazılımcı kullanıcıları için ve kapatılan sprintlerde çalış
    if (!isAnalystOrDeveloper || sprintType !== 'closed') {
      hasInitializedYear.current = false;
      return;
    }

    // availableYears henüz hesaplanmadıysa bekle
    if (availableYears.length === 0) {
      return;
    }

    // Sadece bir kez initialize et
    if (hasInitializedYear.current) {
      return;
    }

    // Varsayılan olarak 2026'yı seç veya en yeni yılı
    if (availableYears.includes(2026)) {
      setSelectedYear('2026');
    } else if (availableYears.length > 0) {
      // 2026 yoksa en yeni yılı seç
      setSelectedYear(availableYears[0].toString());
    }
    
    hasInitializedYear.current = true;
  }, [availableYears.length, isAnalystOrDeveloper, sprintType]);

  // Filtre değiştiğinde pagination'ı sıfırla
  useEffect(() => {
    setDisplayedSprintCount(30);
  }, [selectedProject, selectedYear, debouncedSprintNameFilter, sprintType]);

  const filteredSprints = useMemo(() => {
    let filtered = selectedProject === 'all'
      ? sprintDetails
      : sprintDetails.filter(sprint => sprint.projectKey === selectedProject);

    // Analist/yazılımcı kullanıcıları için ek filtreler
    if (isAnalystOrDeveloper && sprintType === 'closed') {
      // Yıl filtresi
      if (selectedYear !== 'all') {
        const year = parseInt(selectedYear);
        filtered = filtered.filter(sprint => {
          if (!sprint.endDate) return false;
          const sprintYear = new Date(sprint.endDate).getFullYear();
          return sprintYear === year;
        });
      }

      // Sprint adı filtresi (debounced)
      if (debouncedSprintNameFilter.trim() !== '') {
        const filterLower = debouncedSprintNameFilter.toLowerCase().trim();
        filtered = filtered.filter(sprint => 
          sprint.name.toLowerCase().includes(filterLower)
        );
      }
    }

    return filtered;
  }, [selectedProject, sprintDetails, isAnalystOrDeveloper, sprintType, selectedYear, debouncedSprintNameFilter]);

  const sortedSprints = useMemo(() => {
    // Array kopyalama yerine doğrudan sıralama yap (daha hızlı)
    const sprints = [...filteredSprints];
    // Analist/yazılımcı için kapatılan sprintlerde tarihe göre sırala (en yeni önce)
    if (isAnalystOrDeveloper && sprintType === 'closed') {
      sprints.sort((a, b) => {
        const dateA = a.completeDate ? new Date(a.completeDate) : (a.endDate ? new Date(a.endDate) : new Date(0));
        const dateB = b.completeDate ? new Date(b.completeDate) : (b.endDate ? new Date(b.endDate) : new Date(0));
        return dateB.getTime() - dateA.getTime(); // En yeni önce
      });
    } else {
      sprints.sort((a, b) => b.successRate - a.successRate);
    }
    return sprints;
  }, [filteredSprints, isAnalystOrDeveloper, sprintType]);

  // Stats hesaplamasını optimize et - tek geçişte tüm hesaplamaları yap
  const stats = useMemo(() => {
    let totalTasks = 0;
    let totalHours = 0;
    let totalActualHours = 0;
    const developersSet = new Set<string>();
    
    for (const sprint of sortedSprints) {
      totalTasks += sprint.taskCount;
      totalHours += sprint.totalHours;
      totalActualHours += sprint.totalActualHours || 0;
      sprint.assignedDevelopers.forEach(dev => developersSet.add(dev));
    }
    
    return {
      totalSprints: sortedSprints.length,
      totalTasks,
      totalHours,
      totalActualHours: Math.round(totalActualHours * 10) / 10,
      totalDevelopers: developersSet.size
    };
  }, [sortedSprints]);

  const exportToCSV = () => {
    if (sortedSprints.length === 0) { alert('İndirilecek veri bulunamadı.'); return; }

    const q = (val: string | number | null | undefined) =>
      `"${String(val ?? '').replace(/"/g, '""')}"`;

    const fmtDate = (d?: string | null) =>
      d ? new Date(d).toLocaleDateString('tr-TR') : '—';

    // Tüm sprint'lerde geçen issue tiplerini topla (Epic hariç)
    const allTypes = Array.from(new Set(
      sortedSprints.flatMap(s =>
        Object.keys(s.issueTypeBreakdown || {}).filter(t => {
          const tl = t.toLowerCase();
          return tl !== 'epic' && tl !== 'epik';
        })
      )
    )).sort();

    const headers = [
      q('Proje'), q('Sprint Adı'),
      q('Ana Görev'), q('Tamamlanan'),
      q('Başarı Oranı (%)'),
      q('Toplam Tahmin (h)'), q('Harcanan Süre (h)'),
      q('Sprint Başlangıç'), q('Sprint Bitiş'),
      ...allTypes.flatMap(t => [q(`${t} (Toplam)`), q(`${t} (Tamamlanan)`)]),
    ].join(',');

    const rows = sortedSprints.map(sprint => {
      const breakdown = sprint.issueTypeBreakdown || {};
      return [
        q(`${sprint.projectKey} – ${sprint.projectName}`),
        q(sprint.name),
        q(sprint.taskCount),
        q(sprint.doneTaskCount || 0),
        q(`%${sprint.successRate}`),
        q(sprint.totalHours > 0 ? `${Math.round(sprint.totalHours * 10) / 10}h` : '—'),
        q(sprint.totalActualHours > 0 ? `${Math.round((sprint.totalActualHours || 0) * 10) / 10}h` : '—'),
        q(fmtDate(sprint.startDate)),
        q(fmtDate(sprint.endDate)),
        ...allTypes.flatMap(t => {
          const data = breakdown[t];
          return [q(data?.count ?? 0), q(data?.completed ?? 0)];
        }),
      ].join(',');
    });

    const csvContent = [headers, ...rows].join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.setAttribute('href', URL.createObjectURL(blob));
    link.setAttribute('download', `sprint_ozet_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex items-center space-x-2">
          <Loader className="h-6 w-6 animate-spin text-blue-600" />
          <span className="text-gray-600">Proje ve sprint bilgileri yükleniyor bu işlem 10 saniye sürecektir...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <div className="flex items-center space-x-2">
          <Activity className="h-5 w-5 text-red-600" />
          <p className="text-red-800">{error}</p>
        </div>
        <button
          onClick={refresh}
          className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
        >
          Tekrar Dene
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Onboarding Modal */}
      <ProjectSprintOnboarding isOpen={isOnboardingOpen} onClose={closeOnboarding} />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Sprint & Değerlendirme Genel Bakış</h2>
          <p className="text-gray-600 mt-1">
            {sprintType === 'active' 
              ? 'Aktif sprintlerin proje bazlı analizi'
              : isAnalystOrDeveloper 
                ? 'Tüm kapatılan sprintlerin proje bazlı analizi'
                : 'Son kapatılan sprintlerin proje bazlı analizi'}
          </p>
          {debugInfo && (
            <div className="mt-2 text-xs text-gray-500 bg-gray-100 p-2 rounded">
              Debug: {debugInfo.sprintType} | Sprints: {debugInfo.sprintsCount} | Tasks: {debugInfo.sprintTasksKeys.length}
            </div>
          )}
        </div>
        <div className="flex items-center space-x-3">
          {lastUpdate && (
            <span className="text-sm text-gray-500">
              Son güncelleme: {lastUpdate.toLocaleTimeString('tr-TR')}
            </span>
          )}
          <button
            onClick={openOnboarding}
            className="flex items-center space-x-2 px-4 py-2 bg-white border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 hover:border-gray-300 transition-colors shadow-sm"
            title="Sayfayı nasıl kullanacağınızı öğrenin"
          >
            <HelpCircle className="h-4 w-4" />
            <span>Nasıl Kullanılır?</span>
          </button>
          <button
            onClick={exportToCSV}
            disabled={sortedSprints.length === 0}
            className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
          >
            <Download className="h-4 w-4" />
            <span>CSV İndir</span>
          </button>
          <button
            onClick={refresh}
            disabled={loading}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Yenile</span>
          </button>
        </div>
      </div>

      {/* Filter */}
      <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200">
        <div className="flex flex-col space-y-4">
          <div className="flex items-center space-x-4">
            <label className="text-sm font-medium text-gray-700">Proje Filtresi:</label>
            <select
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">Tüm Projeler</option>
              {Array.from(new Set(sprintDetails.map(sprint => sprint.projectKey)))
                .filter(projectKey => canAccessProject(projectKey))
                .sort()
                .map(projectKey => (
                  <option key={projectKey} value={projectKey}>
                    {getProjectNameFromKey(projectKey)} ({projectKey})
                  </option>
                ))}
            </select>
          </div>
          
          {/* Analist/Yazılımcı kullanıcıları için ek filtreler */}
          {isAnalystOrDeveloper && sprintType === 'closed' && (
            <div className="flex items-center space-x-4 pt-2 border-t border-gray-200">
              <label className="text-sm font-medium text-gray-700">Yıl Filtresi:</label>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">Tüm Yıllar</option>
                {availableYears.map(year => (
                  <option key={year} value={year.toString()}>
                    {year}
                  </option>
                ))}
              </select>
              
              <label className="text-sm font-medium text-gray-700 ml-4">Sprint Adı:</label>
              <input
                type="text"
                value={sprintNameFilter}
                onChange={(e) => setSprintNameFilter(e.target.value)}
                placeholder="Sprint adına göre ara..."
                className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent flex-1 max-w-md"
              />
              
              {sprintNameFilter && (
                <button
                  onClick={() => setSprintNameFilter('')}
                  className="text-sm text-gray-600 hover:text-gray-800 px-2"
                >
                  Temizle
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Aktif Sprint</p>
              <p className="text-2xl font-bold text-blue-600">{stats.totalSprints}</p>
            </div>
            <Activity className="h-8 w-8 text-blue-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Ana Görev</p>
              <p className="text-2xl font-bold text-green-600">{stats.totalTasks}</p>
            </div>
            <Calendar className="h-8 w-8 text-green-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Toplam Süre</p>
              <p className="text-2xl font-bold text-purple-600">{stats.totalHours}h</p>
            </div>
            <Clock className="h-8 w-8 text-purple-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Yazılımcı Harcanan Süre</p>
              <p className="text-2xl font-bold text-orange-600">{stats.totalActualHours}h</p>
            </div>
            <Clock className="h-8 w-8 text-orange-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <div className="flex items-center space-x-2">
                <p className="text-sm font-medium text-gray-600 mb-0">70h Hedef</p>
                <button
                  onClick={refresh}
                  className="ml-1 px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 text-xs border border-blue-200 flex items-center"
                  title="Jira verilerini yenile"
                  disabled={loading}
                >
                  <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                  <span className="ml-1">Yenile</span>
                </button>
              </div>
              <p className="text-2xl font-bold text-orange-600">{stats.totalDevelopers}</p>
            </div>
            <Users className="h-8 w-8 text-orange-600" />
          </div>
        </div>
      </div>

      {/* Sprint Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {sortedSprints.slice(0, displayedSprintCount).map((sprint) => (
          <div key={sprint.id} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                  <Activity className="h-5 w-5 text-blue-600" />
                  <span className="text-sm font-medium text-blue-600">{sprint.projectKey}</span>
                </div>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  sprint.state === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                }`}>
                  {sprint.state === 'active' ? 'Aktif' : 
                   sprint.state === 'closed' ? 'Kapatıldı' : sprint.state}
                </span>
              </div>

              <h3 className="text-lg font-semibold text-gray-900 mb-2">{sprint.name}</h3>
              <p className="text-sm text-gray-600 mb-4">{sprint.projectName}</p>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Ana Görev Sayısı:</span>
                  <div className="text-right">
                    <span className="font-medium text-blue-600">{sprint.taskCount} görev</span>
                    <div className="text-xs text-gray-500 mt-1">
                      {Object.entries(sprint.issueTypeBreakdown || {})
                        .filter(([type]) => {
                          const typeLower = type.toLowerCase();
                          return typeLower !== 'epic' && typeLower !== 'epik';
                        })
                        .map(([type, data]: [string, any]) => (
                        <div key={type} className="flex items-center justify-end space-x-1">
                          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${
                            type === 'Bug' ? 'text-red-600 bg-red-100' :
                            type === 'Story' ? 'text-green-600 bg-green-100' :
                            'text-blue-600 bg-blue-100'
                          }`}>
                            {type === 'Bug' && <Bug className="h-3 w-3 mr-1" />}
                            {type === 'Story' && <Zap className="h-3 w-3 mr-1" />}
                            {type === 'Task' && <FileText className="h-3 w-3 mr-1" />}
                            {type}: {data.count}
                          </span> 
                        </div> 
                      ))}
                    </div>
                  </div> 
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Tamamlanan Görev:</span>
                  <div className="text-right">
                    <span className="font-medium text-green-600">{sprint.doneTaskCount} görev</span>
                    <div className="text-xs text-gray-500 mt-1">
                      {Object.entries(sprint.issueTypeBreakdown || {})
                        .filter(([type]) => {
                          const typeLower = type.toLowerCase();
                          return typeLower !== 'epic' && typeLower !== 'epik';
                        })
                        .map(([type, data]: [string, any]) => (
                        data.completed > 0 && (
                          <div key={type} className="flex items-center justify-end space-x-1">
                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${
                              type === 'Bug' ? 'text-red-600 bg-red-100' :
                              type === 'Story' ? 'text-green-600 bg-green-100' :
                              'text-blue-600 bg-blue-100'
                            }`}>
                              <CheckCircle className="h-3 w-3 mr-1" />
                              {type}: {data.completed}
                            </span>
                          </div>
                        )
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Sprint Başarı Oranı:</span>
                  <div className="flex items-center space-x-2">
                    <span className={`font-medium ${
                      sprint.successRate >= 80 ? 'text-green-600' :
                      sprint.successRate >= 60 ? 'text-yellow-600' : 'text-red-600'
                    }`}>
                      %{sprint.successRate}
                    </span>
                    <div className="w-16 bg-gray-200 rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full ${
                          sprint.successRate >= 80 ? 'bg-green-500' :
                          sprint.successRate >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                        }`}
                        style={{ width: `${sprint.successRate}%` }}
                      />
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Toplam Orijinal Tahmin:</span>
                  <span className="font-medium">{sprint.totalHours}h</span>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Harcanan Süre:</span>
                  <span className="font-medium text-orange-600">{Math.round((sprint.totalActualHours || 0) * 10) / 10}h</span>
                </div>

                {sprint.startDate && sprint.endDate && (
                  <div className="pt-2 border-t border-gray-100">
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span>Başlangıç: {new Date(sprint.startDate).toLocaleDateString('tr-TR')}</span>
                      <span>Bitiş: {new Date(sprint.endDate).toLocaleDateString('tr-TR')}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Assigned Developers */}
              {sprint.assignedDevelopers.length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <p className="text-xs font-medium text-gray-700 mb-2">Sprintte Çalışanlar:</p>
                  <div className="flex flex-wrap gap-1">
                    {sprint.assignedDevelopers.map((developer, idx) => (
                      <span key={idx} className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">
                        {developer}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Evaluation Button for Closed Sprints */}
              {sprint.state === 'closed' && user && !hasRole('admin') && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  {userEvaluations[sprint.id] ? (
                    <div className="text-center py-2">
                      <span className="text-sm text-green-600 bg-green-100 px-3 py-1 rounded-full">
                        ✓ Değerlendirme tamamlandı
                      </span>
                    </div>
                  ) : supabaseEvaluationService.isEvaluationActive(sprint) ? (
                    <button
                      onClick={() => setShowEvaluationForm({
                        sprint,
                        tasks: sprintTasks?.[sprint.id] || [],
                        projectName: sprint.projectName
                      })}
                      className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
                    >
                      <span>Sprint Değerlendir</span>
                    </button>
                  ) : (
                    <div className="text-center py-2">
                      <span className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
                        Değerlendirme süresi doldu
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Load More Button */}
      {sortedSprints.length > displayedSprintCount && (
        <div className="flex justify-center mt-6">
          <button
            onClick={() => setDisplayedSprintCount(prev => Math.min(prev + 30, sortedSprints.length))}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            Daha Fazla Yükle ({sortedSprints.length - displayedSprintCount} sprint kaldı)
          </button>
        </div>
      )}

      {sortedSprints.length === 0 && (
        <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
          <Activity className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500 text-lg">
            {getAccessibleProjects().length === 0 ? 'Erişim yetkiniz bulunmuyor.' : 
             sprintType === 'active' ? 'Aktif sprint bulunamadı.' : 'Son kapatılan sprint bulunamadı.'}
          </p>
          <p className="text-gray-400 text-sm mt-2">
            {getAccessibleProjects().length === 0 
              ? 'Size atanmış proje bulunmuyor.' 
              : sprintType === 'active' 
              ? 'Jira\'da aktif sprint bulunmuyor.'
              : 'Jira\'da son kapatılan sprint bulunamadı.'
            }
          </p>
          {debugInfo && (
            <div className="mt-4 text-xs text-gray-400 bg-gray-50 p-3 rounded">
              <strong>Debug Info:</strong><br/>
              Sprint Type: {debugInfo.sprintType}<br/>
              Raw Sprints: {debugInfo.sprintsCount}<br/>
              Sprint Tasks Keys: {debugInfo.sprintTasksKeys.join(', ')}<br/>
              Sprint Details: {JSON.stringify(debugInfo.sprintDetails, null, 2)}
            </div>
          )}
        </div>
      )}

      {/* Sprint Evaluation Form */}
      {showEvaluationForm && (
        <SprintEvaluationForm
          sprint={showEvaluationForm.sprint}
          sprintTasks={showEvaluationForm.tasks}
          projectName={showEvaluationForm.projectName}
          onClose={() => setShowEvaluationForm(null)}
          onSubmit={() => {
            // Refresh to update evaluation status
            if (user && showEvaluationForm) {
              setUserEvaluations(prev => ({
                ...prev,
                [showEvaluationForm.sprint.id]: true
              }));
            }
            refresh();
            setShowEvaluationForm(null);
          }}
        />
      )}
    </div>
  );
};

// getProjectNameFromKey fonksiyonunu tekrar ekle
const getProjectNameFromKey = (key: string): string => {
  const projectNames: { [key: string]: string } = {
    'ATK': 'Albaraka Türk Katılım Bankası',
    'ALB': 'Alternatif Bank',
    'AN': 'Anadolubank',
    'BB': 'Burgan Bank',
    'EK': 'Emlak Katılım',
    'OB': 'Odeabank',
    'QNB': 'QNB Bank',
    'TFKB': 'Türkiye Finans',
    'VK': 'Vakıf Katılım',
    'ZK': 'Ziraat Katılım Bankası',
    'DK': 'Dünya Katılım',
    'HF': 'Hayat Finans'
  };
  return projectNames[key] || key;
}; 
 
const getBoardNameFromProjectKey = (key: string): string => {
  const boardNames: { [key: string]: string } = {
    'VK': 'VK board',
    'AN': 'AN board',
    'TFKB': 'TFKB board',
    'QNB': 'QNB board',
    'ATK': 'ATK board',
    'ALB': 'ALB board',
    'BB': 'BB board',
    'EK': 'EK board',
    'ZK': 'ZK board',
    'DK': 'DK board',
    'OB': 'OB panosu',
    'HF': 'HF board'
  };
  return boardNames[key] || key;
};