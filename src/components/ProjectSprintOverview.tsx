import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { JiraSprint, JiraProject, JiraTask } from '../types';
import { jiraService } from '../lib/jiraService';
import { SprintEvaluationForm } from './SprintEvaluationForm';
import { supabaseEvaluationService } from '../lib/supabaseEvaluationService';
import { Activity, Calendar, Users, Clock, Loader, RefreshCw, ChevronRight, Download, FileText, Bug, Zap, Target, CheckCircle, HelpCircle, History, X, ChevronDown, ChevronUp, Search } from 'lucide-react';
import { useJiraData } from '../context/JiraDataContext';
import { useAuth } from '../context/AuthContext';
import { supabaseJiraService } from '../lib/supabaseJiraService';

import { getPlainTextFromJiraAdf } from '../utils/jiraUtils';
import ProjectSprintOnboarding, { useProjectSprintOnboarding } from './ProjectSprintOverviewOnboarding';

interface SprintWithDetails extends JiraSprint {
  boardName: string;
  projectName: string;
  taskCount: number;
  totalHours: number;
  assignedDevelopers: string[];
}

// ─── Helper fonksiyonlar ──────────────────────────────────────────────────────
const statusIsDone = (statusRaw: string | undefined): boolean => {
  if (!statusRaw) return false;
  const s = statusRaw.toLowerCase();
  return s === 'done' || s === 'tamam' || s === 'uat' || s === 'tamamlandı' || 
         s === 'completed' || s === 'closed' || s === 'resolved' ||
         s.includes('done') || s.includes('tamam') || s.includes('uat');
};

const getIssueType = (task: JiraTask): string => {
  if (task.issueType) return task.issueType;
  const summary = task.summary.toLowerCase();
  if (summary.includes('bug') || summary.includes('hata') || 
      summary.includes('düzeltme') || summary.includes('sorun')) return 'Bug';
  if (summary.includes('story') || summary.includes('öykü') || summary.includes('hikaye')) return 'Story';
  if (task.description) {
    const description = getPlainTextFromJiraAdf(task.description).toLowerCase();
    if (description.includes('bug') || description.includes('hata')) return 'Bug';
    if (description.includes('story')) return 'Story';
  }
  return 'Task';
};

const filterTasksByDateRange = (tasks: JiraTask[], start: string | null, end: string | null): JiraTask[] => {
  if (!start && !end) return tasks;
  const startDate = start ? new Date(start) : null;
  const endDate = end ? new Date(end + 'T23:59:59') : null;
  return tasks.filter((task: JiraTask) => {
    if (!task.created) return false;
    const taskDate = new Date(task.created);
    if (startDate && endDate) return taskDate >= startDate && taskDate <= endDate;
    else if (startDate) return taskDate >= startDate;
    else if (endDate) return taskDate <= endDate;
    return true;
  });
};

const getProjectNameFromKey = (key: string): string => {
  const projectNames: { [key: string]: string } = {
    'ATK': 'Albaraka Türk Katılım Bankası', 'ALB': 'Alternatif Bank',
    'AN': 'Anadolubank', 'BB': 'Burgan Bank', 'EK': 'Emlak Katılım',
    'OB': 'Odeabank', 'QNB': 'QNB Bank', 'TFKB': 'Türkiye Finans',
    'VK': 'Vakıf Katılım', 'ZK': 'Ziraat Katılım Bankası',
    'DK': 'Dünya Katılım', 'HF': 'Hayat Finans'
  };
  return projectNames[key] || key;
};

const getBoardNameFromProjectKey = (key: string): string => {
  const boardNames: { [key: string]: string } = {
    'VK': 'VK board', 'AN': 'AN board', 'TFKB': 'TFKB board', 'QNB': 'QNB board',
    'ATK': 'ATK board', 'ALB': 'ALB board', 'BB': 'BB board', 'EK': 'EK board',
    'ZK': 'ZK board', 'DK': 'DK board', 'OB': 'OB panosu', 'HF': 'HF board'
  };
  return boardNames[key] || key;
};

// ─── Görev istatistiklerini task listesinden hesapla (ProjectSprintOverview ile aynı mantık) ──
const computeSprintStats = (tasks: JiraTask[]) => {
  const epicCache = new Map<string, boolean>();
  const isEpicTask = (task: JiraTask): boolean => {
    if (epicCache.has(task.key)) return epicCache.get(task.key)!;
    if (task.issueType) {
      const l = task.issueType.toLowerCase();
      if (l === 'epic' || l === 'epik') { epicCache.set(task.key, true); return true; }
    }
    const isEpic = ['epic','epik'].includes(getIssueType(task).toLowerCase());
    epicCache.set(task.key, isEpic);
    return isEpic;
  };

  const mainTasks = tasks.filter(t => !t.isSubtask);
  const epicKeys = new Set<string>();
  const parentKeySet = new Set<string>();
  const parentKeyMap = new Map<string, JiraTask>();

  for (const t of mainTasks) {
    if (isEpicTask(t)) epicKeys.add(t.key);
    else { parentKeySet.add(t.key); parentKeyMap.set(t.key, t); }
  }

  const subtasksByParent = new Map<string, JiraTask[]>();
  const orphanParentKeys = new Set<string>();

  for (const t of tasks) {
    if (t.isSubtask && t.parentKey) {
      if (!epicKeys.has(t.parentKey) && !parentKeySet.has(t.parentKey)) orphanParentKeys.add(t.parentKey);
      if (!subtasksByParent.has(t.parentKey)) subtasksByParent.set(t.parentKey, []);
      subtasksByParent.get(t.parentKey)!.push(t);
    }
  }

  for (const pk of orphanParentKeys) {
    if (epicKeys.has(pk)) continue;
    const parent = tasks.find(t => !t.isSubtask && t.key === pk && !isEpicTask(t));
    if (parent && !parentKeyMap.has(parent.key)) {
      parentKeyMap.set(parent.key, parent);
      parentKeySet.add(parent.key);
    }
  }

  const issueTypeBreakdown: Record<string, { count: number; completed: number }> = {};
  let totalHours = 0, totalActualHours = 0;
  const assignedDevelopersSet = new Set<string>();

  for (const t of mainTasks) {
    if (isEpicTask(t)) continue;
    const typeName = getIssueType(t);
    if (!issueTypeBreakdown[typeName]) issueTypeBreakdown[typeName] = { count: 0, completed: 0 };
    issueTypeBreakdown[typeName].count++;
    if (statusIsDone(t.status)) issueTypeBreakdown[typeName].completed++;
  }

  for (const t of tasks) {
    totalHours += t.estimatedHours || 0;
    totalActualHours += t.actualHours || 0;
    if (t.assignee && t.assignee !== 'Unassigned' && t.assignee !== 'Atanmamış') {
      assignedDevelopersSet.add(t.assignee);
    }
  }

  const allParentKeys = new Set([...parentKeySet, ...orphanParentKeys]);
  let completedParentCount = 0;
  for (const pk of allParentKeys) {
    const parent = parentKeyMap.get(pk);
    const relatedSubs = subtasksByParent.get(pk) || [];
    if ((parent && statusIsDone(parent.status)) || relatedSubs.some(st => statusIsDone(st.status))) {
      completedParentCount++;
    }
  }

  return {
    taskCount: allParentKeys.size,
    doneTaskCount: completedParentCount,
    successRate: allParentKeys.size > 0 ? Math.round((completedParentCount / allParentKeys.size) * 100) : 0,
    totalHours: Math.round(totalHours * 10) / 10,
    totalActualHours: Math.round(totalActualHours * 10) / 10,
    assignedDevelopers: Array.from(assignedDevelopersSet),
    issueTypeBreakdown
  };
};

// ─── Drawer'daki her satır: tıklanınca task'ları çekip hesaplar ──────────────
interface DrawerSprintRowProps {
  sprint: any;
  showProjectCol: boolean;
  user: any;
  hasRole: (r: string) => boolean;
  userEvaluations: Record<string, boolean>;
  onEvaluate: (sprint: any) => void;
  fmtDate: (d?: string | null) => string;
  successColor: (r: number) => string;
  successBg: (r: number) => string;
}

const DrawerSprintRow: React.FC<DrawerSprintRowProps> = ({
  sprint: initialSprint, showProjectCol, user, hasRole,
  userEvaluations, onEvaluate, fmtDate, successColor, successBg
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [sprint, setSprint] = useState(initialSprint);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [tasksLoaded, setTasksLoaded] = useState(
    // Context'ten zaten istatistik geldiyse yeniden yüklemeye gerek yok
    (initialSprint.taskCount ?? 0) > 0
  );

  const handleExpand = async () => {
    const nowExpanded = !isExpanded;
    setIsExpanded(nowExpanded);

    // Task'ları sadece bir kez yükle ve sadece gerektiğinde
    if (nowExpanded && !tasksLoaded) {
      setLoadingTasks(true);
      try {
        const tasks = await supabaseJiraService.getSprintIssues(initialSprint.id);
        const stats = computeSprintStats(tasks);
        setSprint((prev: any) => ({ ...prev, ...stats }));
        setTasksLoaded(true);
      } catch (err) {
        console.error(`Sprint ${initialSprint.id} task yüklenemedi:`, err);
      } finally {
        setLoadingTasks(false);
      }
    }
  };

  const issueTypes = Object.entries(sprint.issueTypeBreakdown || {}).filter(([type]) => {
    const tl = type.toLowerCase();
    return tl !== 'epic' && tl !== 'epik';
  });

  return (
    <React.Fragment>
      <tr
        className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors"
        onClick={handleExpand}
      >
        {showProjectCol && (
          <td className="px-4 py-3">
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-100">
              {sprint.projectKey}
            </span>
          </td>
        )}
        <td className="px-4 py-3">
          <div className="text-sm font-medium text-gray-900 truncate max-w-[200px]" title={sprint.name}>
            {sprint.name}
          </div>
          {showProjectCol && (
            <div className="text-xs text-gray-400 truncate max-w-[200px]">{sprint.projectName}</div>
          )}
        </td>
        <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
          <div className="font-medium text-gray-700">{fmtDate(sprint.completeDate || sprint.endDate)}</div>
          <div className="text-gray-400">{fmtDate(sprint.startDate)} →</div>
        </td>

        {/* Görev sayısı — yükleniyorsa spinner */}
        <td className="px-4 py-3 text-center whitespace-nowrap">
          {loadingTasks ? (
            <Loader className="h-4 w-4 animate-spin text-indigo-400 mx-auto" />
          ) : tasksLoaded || (sprint.taskCount ?? 0) > 0 ? (
            <>
              <span className="text-sm font-semibold text-gray-700">{sprint.doneTaskCount}</span>
              <span className="text-xs text-gray-400">/{sprint.taskCount}</span>
            </>
          ) : (
            <span className="text-xs text-gray-400">—</span>
          )}
        </td>

        {/* Başarı oranı */}
        <td className="px-4 py-3 whitespace-nowrap">
          {loadingTasks ? (
            <span className="text-xs text-gray-400">...</span>
          ) : tasksLoaded || (sprint.taskCount ?? 0) > 0 ? (
            <div className="flex items-center space-x-2">
              <span className={`text-sm font-bold ${successColor(sprint.successRate)}`}>%{sprint.successRate}</span>
              <div className="w-12 bg-gray-200 rounded-full h-1.5">
                <div className={`h-1.5 rounded-full ${successBg(sprint.successRate)}`} style={{ width: `${sprint.successRate}%` }} />
              </div>
            </div>
          ) : (
            <span className="text-xs text-gray-400">—</span>
          )}
        </td>

        {/* Saat */}
        <td className="px-4 py-3 text-xs whitespace-nowrap">
          {loadingTasks ? (
            <span className="text-gray-400">...</span>
          ) : (
            <>
              <div className="text-gray-700 font-medium">{(sprint.totalHours ?? 0) > 0 ? `${sprint.totalHours}h` : '—'}</div>
              <div className="text-orange-500">{(sprint.totalActualHours ?? 0) > 0 ? `${sprint.totalActualHours}h` : '—'}</div>
            </>
          )}
        </td>

        {/* Değerlendirme */}
        <td className="px-4 py-3 text-center" onClick={e => e.stopPropagation()}>
          {user && !hasRole('admin') && (
            userEvaluations[sprint.id] ? (
              <span className="text-xs text-green-600 bg-green-50 border border-green-200 px-2 py-1 rounded-full whitespace-nowrap">✓ Tamam</span>
            ) : supabaseEvaluationService.isEvaluationActive(sprint) ? (
              <button
                onClick={() => onEvaluate(sprint)}
                className="text-xs px-2 py-1 bg-orange-500 text-white rounded-full hover:bg-orange-600 transition-colors font-medium whitespace-nowrap"
              >
                Değerlendir
              </button>
            ) : (
              <span className="text-xs text-gray-400 bg-gray-50 border border-gray-200 px-2 py-1 rounded-full whitespace-nowrap">Doldu</span>
            )
          )}
        </td>
        <td className="px-3 py-3 text-center">
          {isExpanded
            ? <ChevronUp className="h-4 w-4 text-gray-400 mx-auto" />
            : <ChevronDown className="h-4 w-4 text-gray-400 mx-auto" />}
        </td>
      </tr>

      {/* Genişletilmiş detay */}
      {isExpanded && (
        <tr className="bg-indigo-50/40 border-b border-indigo-100">
          <td colSpan={showProjectCol ? 8 : 7} className="px-6 py-4">
            {loadingTasks ? (
              <div className="flex items-center space-x-2 text-gray-400 py-2">
                <Loader className="h-4 w-4 animate-spin text-indigo-400" />
                <span className="text-sm">Görev detayları yükleniyor...</span>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Görev Tipleri</p>
                  <div className="flex flex-wrap gap-1.5">
                    {issueTypes.length > 0 ? issueTypes.map(([type, data]: [string, any]) => (
                      <span key={type} className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                        type === 'Bug' ? 'text-red-700 bg-red-100' :
                        type === 'Story' ? 'text-green-700 bg-green-100' :
                        'text-blue-700 bg-blue-100'
                      }`}>
                        {type === 'Bug' && <Bug className="h-3 w-3 mr-1" />}
                        {type === 'Story' && <Zap className="h-3 w-3 mr-1" />}
                        {type === 'Task' && <FileText className="h-3 w-3 mr-1" />}
                        {type}: {data.completed}/{data.count}
                      </span>
                    )) : <span className="text-xs text-gray-400">Veri yok</span>}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Çalışanlar</p>
                  <div className="flex flex-wrap gap-1">
                    {(sprint.assignedDevelopers || []).length > 0
                      ? sprint.assignedDevelopers.map((dev: string, idx: number) => (
                          <span key={idx} className="px-2 py-0.5 bg-white border border-gray-200 text-gray-700 text-xs rounded shadow-sm">{dev}</span>
                        ))
                      : <span className="text-xs text-gray-400">Atanmış kişi yok</span>}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Tarihler</p>
                  <div className="space-y-1 text-xs text-gray-600">
                    <div className="flex justify-between">
                      <span>Başlangıç</span>
                      <span className="font-medium">{sprint.startDate ? new Date(sprint.startDate).toLocaleDateString('tr-TR') : '—'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Bitiş (planlanan)</span>
                      <span className="font-medium">{sprint.endDate ? new Date(sprint.endDate).toLocaleDateString('tr-TR') : '—'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Kapanış (gerçek)</span>
                      <span className="font-medium text-indigo-600">{sprint.completeDate ? new Date(sprint.completeDate).toLocaleDateString('tr-TR') : '—'}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </td>
        </tr>
      )}
    </React.Fragment>
  );
};

// ─── Tüm Kapatılan Sprintler Drawer ──────────────────────────────────────────
interface AllClosedSprintsDrawerProps {
  projectKey: string;
  projectName: string;
  allSprintDetails: any[];
  userEvaluations: Record<string, boolean>;
  sprintTasks: Record<string, JiraTask[]> | null;
  user: any;
  hasRole: (role: string) => boolean;
  onEvaluate: (sprint: any) => void;
  onClose: () => void;
}

const AllClosedSprintsDrawer: React.FC<AllClosedSprintsDrawerProps> = ({
  projectKey, projectName, allSprintDetails, userEvaluations,
  sprintTasks, user, hasRole, onEvaluate, onClose
}) => {
  const [yearFilter, setYearFilter] = useState<string>('all');
  const [nameFilter, setNameFilter] = useState<string>('');
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  // supabaseJiraService üzerinden tüm closed sprintleri çek
  const [allClosedSprints, setAllClosedSprints] = useState<any[]>([]);
  const [fetchStatus, setFetchStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');

  useEffect(() => {
    const fetchAll = async () => {
      setFetchStatus('loading');
      try {
        // supabaseJiraService.getAllClosedSprints() tüm board'ların tüm closed sprintlerini getirir
        const results = await supabaseJiraService.getAllClosedSprints();

        // Proje filtresi uygula
        const filtered = projectKey === 'all'
          ? results
          : results.filter(r => r.projectKey === projectKey);

        // Sprint objesini düzleştir ve context'teki sprintDetails ile zenginleştir
        const flat = filtered.map(({ sprint, boardName, projectKey: pk }) => {
          const fromContext = allSprintDetails.find(s => s.id === sprint.id);
          return {
            ...sprint,
            boardName,
            projectKey: pk,
            projectName: getProjectNameFromKey(pk),
            // Görev istatistikleri context'te varsa kullan, yoksa 0
            taskCount: fromContext?.taskCount ?? 0,
            doneTaskCount: fromContext?.doneTaskCount ?? 0,
            successRate: fromContext?.successRate ?? 0,
            totalHours: fromContext?.totalHours ?? 0,
            totalActualHours: fromContext?.totalActualHours ?? 0,
            assignedDevelopers: fromContext?.assignedDevelopers ?? [],
            issueTypeBreakdown: fromContext?.issueTypeBreakdown ?? {},
          };
        });

        setAllClosedSprints(flat);
        setFetchStatus('done');
      } catch (err) {
        console.error('Failed to fetch all closed sprints:', err);
        setFetchStatus('error');
        // Fallback: context'teki mevcut veriyi kullan
        const fallback = allSprintDetails
          .filter(s => s.state === 'closed' && (projectKey === 'all' || s.projectKey === projectKey));
        setAllClosedSprints(fallback);
      }
    };
    fetchAll();
  }, [projectKey]);

  // Gösterilecek liste: Jira'dan gelen veriye context verisiyle zenginleştirilmiş
  const projectClosedSprints = useMemo(() => {
    const list = allClosedSprints.length > 0
      ? allClosedSprints
      : allSprintDetails.filter(s => s.state === 'closed' && (projectKey === 'all' || s.projectKey === projectKey));

    return [...list].sort((a, b) => {
      const dateA = a.completeDate ? new Date(a.completeDate) : (a.endDate ? new Date(a.endDate) : new Date(0));
      const dateB = b.completeDate ? new Date(b.completeDate) : (b.endDate ? new Date(b.endDate) : new Date(0));
      return dateB.getTime() - dateA.getTime();
    });
  }, [allClosedSprints, allSprintDetails, projectKey]);

  const availableYears = useMemo(() => {
    const years = new Set<number>();
    projectClosedSprints.forEach(s => {
      const d = s.completeDate || s.endDate;
      if (d) {
        const y = new Date(d).getFullYear();
        if (y > 2020) years.add(y);
      }
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [projectClosedSprints]);

  useEffect(() => {
    if (availableYears.includes(2026)) setYearFilter('2026');
    else if (availableYears.length > 0) setYearFilter(availableYears[0].toString());
  }, [availableYears.length]);

  const filteredSprints = useMemo(() => {
    let list = [...projectClosedSprints];
    if (yearFilter !== 'all') {
      const y = parseInt(yearFilter);
      list = list.filter(s => {
        const d = s.completeDate || s.endDate;
        return d && new Date(d).getFullYear() === y;
      });
    }
    if (nameFilter.trim()) {
      const f = nameFilter.toLowerCase().trim();
      list = list.filter(s => s.name.toLowerCase().includes(f));
    }
    return list;
  }, [projectClosedSprints, yearFilter, nameFilter]);

  const fmtDate = (d?: string | null) =>
    d ? new Date(d).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—';

  const successColor = (rate: number) =>
    rate >= 80 ? 'text-green-600' : rate >= 60 ? 'text-yellow-600' : 'text-red-600';
  const successBg = (rate: number) =>
    rate >= 80 ? 'bg-green-500' : rate >= 60 ? 'bg-yellow-500' : 'bg-red-500';

  return (
    <div className="fixed inset-0 z-50 flex" onClick={onClose}>
      <div className="flex-1 bg-black/40" />
      <div
        className="w-full max-w-4xl bg-white h-full flex flex-col shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Panel header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50">
          <div>
            <div className="flex items-center space-x-2">
              <History className="h-5 w-5 text-indigo-600" />
              <h3 className="text-lg font-semibold text-gray-900">Geçmiş Sprintler</h3>
              {projectKey !== 'all' && (
                <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-xs font-semibold rounded">
                  {projectKey}
                </span>
              )}
            </div>
            <p className="text-sm text-gray-500 mt-0.5">{projectName}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-lg transition-colors">
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        {/* Filtreler */}
        <div className="px-6 py-3 border-b border-gray-100 bg-white flex flex-wrap items-center gap-3">
          <div className="flex items-center space-x-2">
            <label className="text-xs font-medium text-gray-600 whitespace-nowrap">Yıl:</label>
            <select
              value={yearFilter}
              onChange={e => setYearFilter(e.target.value)}
              className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            >
              <option value="all">Tüm Yıllar</option>
              {availableYears.map(y => (
                <option key={y} value={y.toString()}>{y}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center space-x-2 flex-1">
            <Search className="h-4 w-4 text-gray-400 flex-shrink-0" />
            <input
              type="text"
              value={nameFilter}
              onChange={e => setNameFilter(e.target.value)}
              placeholder="Sprint adında ara..."
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent flex-1 max-w-xs"
            />
            {nameFilter && (
              <button onClick={() => setNameFilter('')} className="text-xs text-gray-400 hover:text-gray-600">Temizle</button>
            )}
          </div>

          <span className="ml-auto text-xs text-gray-400">
            <span className="font-semibold text-gray-600">{filteredSprints.length}</span> sprint
          </span>
        </div>

        {/* Tablo */}
        <div className="flex-1 overflow-y-auto">
          {fetchStatus === 'loading' && allClosedSprints.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-gray-400 space-y-3">
              <Loader className="h-7 w-7 animate-spin text-indigo-400" />
              <p className="text-sm">Geçmiş sprintler yükleniyor...</p>
            </div>
          ) : filteredSprints.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-gray-400">
              <Activity className="h-8 w-8 mb-2" />
              <p className="text-sm">Sprint bulunamadı.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-gray-50 border-b border-gray-200 z-10">
                <tr>
                  {projectKey === 'all' && (
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide w-14">Proje</th>
                  )}
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Sprint Adı</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide w-32">Kapanış</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide w-20">Görev</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide w-32">Başarı</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide w-24">
                    <span className="text-gray-500 block">Tahmin</span>
                    <span className="text-orange-400 block normal-case font-normal">Harcanan</span>
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide w-24">Değerl.</th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody>
                {filteredSprints.map(sprint => (
                  <DrawerSprintRow
                    key={sprint.id}
                    sprint={sprint}
                    showProjectCol={projectKey === 'all'}
                    user={user}
                    hasRole={hasRole}
                    userEvaluations={userEvaluations}
                    onEvaluate={onEvaluate}
                    fmtDate={fmtDate}
                    successColor={successColor}
                    successBg={successBg}
                  />
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Ana bileşen ──────────────────────────────────────────────────────────────
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
  
  // ── YENİ: Geçmiş sprint drawer ───────────────────────────────────────────
  const [historyDrawer, setHistoryDrawer] = useState<{
    projectKey: string;
    projectName: string;
  } | null>(null);
  // ─────────────────────────────────────────────────────────────────────────

  const isAnalystOrDeveloper = useMemo(() => {
    return user && (hasRole('analyst') || hasRole('developer'));
  }, [user, hasRole]);
  const [selectedYear, setSelectedYear] = useState<string>('all');
  const [sprintNameFilter, setSprintNameFilter] = useState<string>('');
  const [debouncedSprintNameFilter, setDebouncedSprintNameFilter] = useState<string>('');
  const [displayedSprintCount, setDisplayedSprintCount] = useState<number>(30);
  const hasInitializedYear = useRef(false);
  
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSprintNameFilter(sprintNameFilter);
    }, 300);
    return () => clearTimeout(timer);
  }, [sprintNameFilter]);

  const accessibleProjects = useMemo(() => getAccessibleProjects(), [getAccessibleProjects]);
  const accessibleProjectsSet = useMemo(() => new Set(accessibleProjects), [accessibleProjects]);

  const canAccessProjectOptimized = useCallback((projectKey: string): boolean => {
    if (accessibleProjects.length === 0) return true;
    return accessibleProjectsSet.has(projectKey);
  }, [accessibleProjects, accessibleProjectsSet]);

  useEffect(() => {
    if (sprints && sprintTasks) {
      setLastUpdate(new Date());
      if (process.env.NODE_ENV === 'development') {
        setDebugInfo({
          sprintType, sprintsCount: sprints.length,
          sprintTasksKeys: Object.keys(sprintTasks),
          sprintDetails: sprints.map(s => ({ id: s.id, name: s.name, state: s.state, projectKey: s.projectKey }))
        });
      }
    }
  }, [sprints, sprintTasks, sprintType]);

  useEffect(() => {
    const loadUserEvaluations = async () => {
      if (!user || !sprints) return;
      const closedSprints = sprints.filter(sprint => sprint.state === 'closed');
      if (closedSprints.length === 0) { setUserEvaluations({}); return; }

      const evaluationPromises = closedSprints.map(async (sprint) => {
        try {
          const hasEvaluated = await supabaseEvaluationService.hasUserEvaluated(sprint.id, user.email);
          return { sprintId: sprint.id, hasEvaluated };
        } catch (error) {
          return { sprintId: sprint.id, hasEvaluated: false };
        }
      });

      const results = await Promise.all(evaluationPromises);
      const evaluationStatus: Record<string, boolean> = {};
      results.forEach(result => { evaluationStatus[result.sprintId] = result.hasEvaluated; });
      setUserEvaluations(evaluationStatus);
    };
    loadUserEvaluations();
  }, [user, sprints]);

  const sprintDetails = useMemo(() => {
    if (!sprints || !sprintTasks) return [];

    const [start, end] = createdDateRange;
    const shouldFilterByDate = sprintType === 'active' && (start || end);

    return sprints
      .filter(sprint => canAccessProjectOptimized(sprint.projectKey || ''))
      .map((sprint: JiraSprint) => {
          const allTasks: JiraTask[] = sprintTasks[sprint.id] || [];
          let tasks: JiraTask[] = shouldFilterByDate 
            ? filterTasksByDateRange(allTasks, start, end)
            : [...allTasks];

          const epicCache = new Map<string, boolean>();
          const isEpicTask = (task: JiraTask): boolean => {
            if (epicCache.has(task.key)) return epicCache.get(task.key)!;
            if (task.issueType) {
              const l = task.issueType.toLowerCase();
              if (l === 'epic' || l === 'epik') { epicCache.set(task.key, true); return true; }
            }
            const typeName = getIssueType(task);
            const isEpic = typeName.toLowerCase() === 'epic' || typeName.toLowerCase() === 'epik';
            epicCache.set(task.key, isEpic);
            return isEpic;
          };

          const mainTasks = tasks.filter(t => !t.isSubtask);
          const epicKeys = new Set<string>();
          const parentKeySet = new Set<string>();
          const parentKeyMap = new Map<string, JiraTask>();
          
          for (const task of mainTasks) {
            if (isEpicTask(task)) epicKeys.add(task.key);
            else { parentKeySet.add(task.key); parentKeyMap.set(task.key, task); }
          }
          
          const orphanParentKeys = new Set<string>();
          const subtasksByParent = new Map<string, JiraTask[]>();
          
          for (const task of tasks) {
            if (task.isSubtask && task.parentKey) {
              if (!epicKeys.has(task.parentKey) && !parentKeySet.has(task.parentKey)) {
                orphanParentKeys.add(task.parentKey);
              }
              if (!subtasksByParent.has(task.parentKey)) subtasksByParent.set(task.parentKey, []);
              subtasksByParent.get(task.parentKey)!.push(task);
            }
          }
          
          for (const parentKey of orphanParentKeys) {
            if (epicKeys.has(parentKey)) continue;
            const parent = allTasks.find(t => !t.isSubtask && t.key === parentKey && !isEpicTask(t));
            if (parent && !parentKeyMap.has(parent.key)) {
              tasks.push(parent);
              parentKeyMap.set(parent.key, parent);
              parentKeySet.add(parent.key);
            }
          }

          const issueTypeBreakdown: Record<string, { count: number; completed: number }> = {};
          let totalHours = 0, totalActualHours = 0;
          const assignedDevelopersSet = new Set<string>();
          
          for (const task of mainTasks) {
            const typeName = getIssueType(task);
            if (!issueTypeBreakdown[typeName]) issueTypeBreakdown[typeName] = { count: 0, completed: 0 };
            issueTypeBreakdown[typeName].count++;
            if (statusIsDone(task.status)) issueTypeBreakdown[typeName].completed++;
          }
          
          for (const task of tasks) {
            totalHours += task.estimatedHours || 0;
            totalActualHours += task.actualHours || 0;
            if (task.assignee && task.assignee !== 'Unassigned') assignedDevelopersSet.add(task.assignee);
          }

          const allParentKeys = new Set([...parentKeySet, ...orphanParentKeys]);
          let completedParentCount = 0;
          for (const parentKey of allParentKeys) {
            const parent = parentKeyMap.get(parentKey);
            const relatedSubs = subtasksByParent.get(parentKey) || [];
            const isCompleted = (parent && statusIsDone(parent.status)) || relatedSubs.some(st => statusIsDone(st.status));
            if (isCompleted) completedParentCount++;
          }
          
          if (process.env.NODE_ENV === 'development' && sprint.projectKey === 'AN') {
            console.log(`🔍 AN Sprint ${sprint.name} Epic Debug:`, {
              epicKeys: Array.from(epicKeys), epicCount: epicKeys.size,
              parentKeySetSize: parentKeySet.size, orphanParentKeysSize: orphanParentKeys.size,
              totalParentCount: allParentKeys.size
            });
          }

          return {
            ...sprint,
            boardName: getBoardNameFromProjectKey(sprint.projectKey || ''),
            projectName: getProjectNameFromKey(sprint.projectKey || ''),
            taskCount: allParentKeys.size, totalHours,
            totalActualHours: Math.round(totalActualHours * 10) / 10,
            assignedDevelopers: Array.from(assignedDevelopersSet),
            doneTaskCount: completedParentCount,
            successRate: allParentKeys.size > 0 ? Math.round((completedParentCount / allParentKeys.size) * 100) : 0,
            issueTypeBreakdown
          };
        });
  }, [sprints, sprintTasks, canAccessProjectOptimized, sprintType, createdDateRange]);

  const availableYears = useMemo(() => {
    if (!sprintDetails || sprintDetails.length === 0) return [];
    const years = new Set<number>();
    sprintDetails.forEach(sprint => {
      if (sprint.endDate) {
        const year = new Date(sprint.endDate).getFullYear();
        if (year > 2020) years.add(year);
      }
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [sprintDetails]);

  useEffect(() => {
    if (!isAnalystOrDeveloper || sprintType !== 'closed') {
      hasInitializedYear.current = false;
      return;
    }
    if (availableYears.length === 0 || hasInitializedYear.current) return;
    if (availableYears.includes(2026)) setSelectedYear('2026');
    else setSelectedYear(availableYears[0].toString());
    hasInitializedYear.current = true;
  }, [availableYears.length, isAnalystOrDeveloper, sprintType]);

  useEffect(() => {
    setDisplayedSprintCount(30);
  }, [selectedProject, selectedYear, debouncedSprintNameFilter, sprintType]);

  const filteredSprints = useMemo(() => {
    let filtered = selectedProject === 'all'
      ? sprintDetails
      : sprintDetails.filter(sprint => sprint.projectKey === selectedProject);

    if (isAnalystOrDeveloper && sprintType === 'closed') {
      if (selectedYear !== 'all') {
        const year = parseInt(selectedYear);
        filtered = filtered.filter(sprint => {
          if (!sprint.endDate) return false;
          return new Date(sprint.endDate).getFullYear() === year;
        });
      }
      if (debouncedSprintNameFilter.trim() !== '') {
        const filterLower = debouncedSprintNameFilter.toLowerCase().trim();
        filtered = filtered.filter(sprint => sprint.name.toLowerCase().includes(filterLower));
      }
    }
    return filtered;
  }, [selectedProject, sprintDetails, isAnalystOrDeveloper, sprintType, selectedYear, debouncedSprintNameFilter]);

  const sortedSprints = useMemo(() => {
    const list = [...filteredSprints];
    if (isAnalystOrDeveloper && sprintType === 'closed') {
      list.sort((a, b) => {
        const dateA = a.completeDate ? new Date(a.completeDate) : (a.endDate ? new Date(a.endDate) : new Date(0));
        const dateB = b.completeDate ? new Date(b.completeDate) : (b.endDate ? new Date(b.endDate) : new Date(0));
        return dateB.getTime() - dateA.getTime();
      });
    } else {
      list.sort((a, b) => b.successRate - a.successRate);
    }
    return list;
  }, [filteredSprints, isAnalystOrDeveloper, sprintType]);

  const stats = useMemo(() => {
    let totalTasks = 0, totalHours = 0, totalActualHours = 0;
    const developersSet = new Set<string>();
    for (const sprint of sortedSprints) {
      totalTasks += sprint.taskCount;
      totalHours += sprint.totalHours;
      totalActualHours += sprint.totalActualHours || 0;
      sprint.assignedDevelopers.forEach((dev: string) => developersSet.add(dev));
    }
    return {
      totalSprints: sortedSprints.length, totalTasks, totalHours,
      totalActualHours: Math.round(totalActualHours * 10) / 10,
      totalDevelopers: developersSet.size
    };
  }, [sortedSprints]);

  const exportToCSV = () => {
    if (sortedSprints.length === 0) { alert('İndirilecek veri bulunamadı.'); return; }
    const q = (val: string | number | null | undefined) => `"${String(val ?? '').replace(/"/g, '""')}"`;
    const fmtDate = (d?: string | null) => d ? new Date(d).toLocaleDateString('tr-TR') : '—';
    const allTypes = Array.from(new Set(
      sortedSprints.flatMap(s => Object.keys(s.issueTypeBreakdown || {}).filter(t => {
        const tl = t.toLowerCase(); return tl !== 'epic' && tl !== 'epik';
      }))
    )).sort();

    const headers = [
      q('Proje'), q('Sprint Adı'), q('Ana Görev'), q('Tamamlanan'), q('Başarı Oranı (%)'),
      q('Toplam Tahmin (h)'), q('Harcanan Süre (h)'), q('Sprint Başlangıç'), q('Sprint Bitiş'),
      ...allTypes.flatMap(t => [q(`${t} (Toplam)`), q(`${t} (Tamamlanan)`)]),
    ].join(',');

    const rows = sortedSprints.map(sprint => {
      const breakdown = sprint.issueTypeBreakdown || {};
      return [
        q(`${sprint.projectKey} – ${sprint.projectName}`), q(sprint.name),
        q(sprint.taskCount), q(sprint.doneTaskCount || 0), q(`%${sprint.successRate}`),
        q(sprint.totalHours > 0 ? `${Math.round(sprint.totalHours * 10) / 10}h` : '—'),
        q(sprint.totalActualHours > 0 ? `${Math.round((sprint.totalActualHours || 0) * 10) / 10}h` : '—'),
        q(fmtDate(sprint.startDate)), q(fmtDate(sprint.endDate)),
        ...allTypes.flatMap(t => { const data = breakdown[t]; return [q(data?.count ?? 0), q(data?.completed ?? 0)]; }),
      ].join(',');
    });

    const csvContent = [headers, ...rows].join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.setAttribute('href', URL.createObjectURL(blob));
    link.setAttribute('download', `sprint_ozet_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
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
        <button onClick={refresh} className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors">
          Tekrar Dene
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Onboarding Modal */}
      <ProjectSprintOnboarding isOpen={isOnboardingOpen} onClose={closeOnboarding} />

      {/* ── Geçmiş Sprint Drawer ────────────────────────────────────────────── */}
      {historyDrawer && (
        <AllClosedSprintsDrawer
          projectKey={historyDrawer.projectKey}
          projectName={historyDrawer.projectName}
          allSprintDetails={sprintDetails}
          userEvaluations={userEvaluations}
          sprintTasks={sprintTasks}
          user={user}
          hasRole={hasRole}
          onEvaluate={(sprint) => {
            setHistoryDrawer(null);
            setShowEvaluationForm({
              sprint,
              tasks: sprintTasks?.[sprint.id] || [],
              projectName: sprint.projectName
            });
          }}
          onClose={() => setHistoryDrawer(null)}
        />
      )}
      {/* ─────────────────────────────────────────────────────────────────────── */}

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

            {/* ── Geçmiş Sprintler butonu — closed modda filtre barında da göster ── */}
            {sprintType === 'closed' && (
              <button
                onClick={() => setHistoryDrawer({
                  projectKey: selectedProject,
                  projectName: selectedProject === 'all' ? 'Tüm Projeler' : getProjectNameFromKey(selectedProject)
                })}
                className="flex items-center space-x-2 px-4 py-2 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg hover:bg-indigo-100 transition-colors font-medium text-sm"
              >
                <History className="h-4 w-4" />
                <span>Tüm Geçmiş Sprintleri Gör</span>
              </button>
            )}
          </div>
          
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
                  <option key={year} value={year.toString()}>{year}</option>
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
                <button onClick={() => setSprintNameFilter('')} className="text-sm text-gray-600 hover:text-gray-800 px-2">
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
                  {sprint.state === 'active' ? 'Aktif' : sprint.state === 'closed' ? 'Kapatıldı' : sprint.state}
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
                        .filter(([type]) => { const tl = type.toLowerCase(); return tl !== 'epic' && tl !== 'epik'; })
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
                        .filter(([type]) => { const tl = type.toLowerCase(); return tl !== 'epic' && tl !== 'epik'; })
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

              {sprint.assignedDevelopers.length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <p className="text-xs font-medium text-gray-700 mb-2">Sprintte Çalışanlar:</p>
                  <div className="flex flex-wrap gap-1">
                    {sprint.assignedDevelopers.map((developer: string, idx: number) => (
                      <span key={idx} className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">
                        {developer}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* ── YENİ: Geçmiş sprintler butonu — closed modda her kartta ── */}
              {sprintType === 'closed' && (
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <button
                    onClick={() => setHistoryDrawer({
                      projectKey: sprint.projectKey || 'all',
                      projectName: sprint.projectName
                    })}
                    className="w-full flex items-center justify-center space-x-2 px-3 py-2 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg hover:bg-indigo-100 transition-colors text-sm font-medium"
                  >
                    <History className="h-4 w-4" />
                    <span>Tüm Geçmiş Sprintleri Gör</span>
                    <ChevronRight className="h-4 w-4 ml-auto" />
                  </button>
                </div>
              )}
              {/* ──────────────────────────────────────────────────────────── */}

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