import React, { useState, useEffect } from 'react';
import { ManualTaskAssignment as TaskAssignment, DeveloperWorkload, JiraSprint } from '../types';
import { supabaseJiraService } from '../lib/supabaseJiraService';
import { jiraFilterService } from '../lib/jiraFilterService';
import { Plus, Save, X, User, Clock, AlertTriangle, CheckCircle, ExternalLink, Loader, Download, RefreshCw } from 'lucide-react';
import { useJiraData } from '../context/JiraDataContext';
import { useAuth } from '../context/AuthContext';
import { useDeveloperCapacities } from '../hooks/useDeveloperCapacities';
import { exportManualAssignmentsToCSV } from '../utils/csvExport';
import { DeveloperCapacityAdjustment } from './DeveloperCapacityAdjustment';
import { getOverallSprintDateRange } from '../utils/sprintDateUtils';

const underloadedDevelopersCache = new Map<string, DeveloperWorkload[]>();

export const ManualTaskAssignment: React.FC = () => {
  const {
    workload, projects, sprints, loading, error, refresh,
    updateWorkloadStatus, capacityCalculations, setCapacityCalculations,
    capacityReady, capacityCacheKey
  } = useJiraData();
  const { hasRole, canAccessProject, getAccessibleProjects, hasKolayIK } = useAuth();
  const { getCapacity } = useDeveloperCapacities();
  const [assignments, setAssignments] = useState<TaskAssignment[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [creatingJiraIssue, setCreatingJiraIssue] = useState(false);
  const [jiraCreationOption, setJiraCreationOption] = useState<'local' | 'jira' | 'both'>('local');
  const [availableSprints, setAvailableSprints] = useState<JiraSprint[]>([]);
  const [loadingSprints, setLoadingSprints] = useState(false);
  const [componentError, setComponentError] = useState<string | null>(null);
  const [fallbackDeveloperNames, setFallbackDeveloperNames] = useState<string[]>([]);
  const [formData, setFormData] = useState({
    title: '', description: '', assignee: '', projectKey: '', projectName: '',
    sprint: '', sprintId: '', estimatedHours: '', priority: 'Medium' as const,
    dueDate: '', issueType: 'Task'
  });

  const allProjectOptions = [
    { key: 'ATK', name: 'Albaraka Türk Katılım Bankası' },
    { key: 'ALB', name: 'Alternatif Bank' },
    { key: 'AN', name: 'Anadolubank' },
    { key: 'BB', name: 'Burgan Bank' },
    { key: 'EK', name: 'Emlak Katılım' },
    { key: 'OB', name: 'OdeaBank' },
    { key: 'QNB', name: 'QNB Bank' },
    { key: 'TFKB', name: 'Türkiye Finans' },
    { key: 'VK', name: 'Vakıf Katılım' },
    { key: 'ZK', name: 'Ziraat Katılım Bankası' },
    { key: 'DK', name: 'Dünya Katılım' },
    { key: 'HF', name: 'Hayat Finans' }
  ];

  const projectOptions = hasRole('admin')
    ? allProjectOptions
    : allProjectOptions.filter(project => canAccessProject(project.key));

  useEffect(() => {
    try { loadAssignments(); }
    catch (err) {
      console.error('Error in useEffect:', err);
      setComponentError(err instanceof Error ? err.message : 'Component initialization error');
    }
  }, []);

  useEffect(() => {
    if (workload && workload.length > 0) return;
    let cancelled = false;
    jiraFilterService.getDeveloperNames().then(names => {
      if (!cancelled) setFallbackDeveloperNames(names || []);
    }).catch(() => { if (!cancelled) setFallbackDeveloperNames([]); });
    return () => { cancelled = true; };
  }, [workload]);

  const loadAssignments = () => {
    try {
      const saved = localStorage.getItem('manualAssignments');
      if (saved) {
        const parsed = JSON.parse(saved);
        setAssignments(Array.isArray(parsed) ? parsed : []);
      }
    } catch (err) {
      console.error('Error loading assignments from localStorage:', err);
      setAssignments([]);
    }
  };

  const loadActiveSprintsForProject = async (projectKey: string) => {
    setLoadingSprints(true);
    setComponentError(null);
    try {
      const sprints = await supabaseJiraService.getActiveSprintsForProject(projectKey);
      setAvailableSprints(sprints);
    } catch (error) {
      console.error('Sprint yükleme hatası:', error);
      setComponentError('Sprint yükleme hatası: ' + (error instanceof Error ? error.message : 'Bilinmeyen hata'));
      setAvailableSprints([]);
    } finally {
      setLoadingSprints(false);
    }
  };

  const saveAssignments = (newAssignments: TaskAssignment[]) => {
    try {
      localStorage.setItem('manualAssignments', JSON.stringify(newAssignments));
      setAssignments(newAssignments);
    } catch (err) {
      console.error('Error saving assignments to localStorage:', err);
      setComponentError('Kaydetme hatası: ' + (err instanceof Error ? err.message : 'Bilinmeyen hata'));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setComponentError(null);
    setCreatingJiraIssue(true);
    try {
      let jiraIssueKey = '';
      if (jiraCreationOption === 'jira' || jiraCreationOption === 'both') {
        try {
          const jiraIssue = await supabaseJiraService.createIssue({
            projectKey: formData.projectKey, summary: formData.title,
            description: formData.description, assignee: formData.assignee,
            priority: formData.priority, estimatedHours: parseInt(formData.estimatedHours),
            issueType: formData.issueType, sprintId: formData.sprintId
          });
          jiraIssueKey = jiraIssue.key;
          alert(`✅ Jira'da görev oluşturuldu: ${jiraIssueKey}`);
        } catch (jiraError) {
          console.error('Jira issue oluşturma hatası:', jiraError);
          alert(`❌ Jira'da görev oluşturulamadı: ${jiraError instanceof Error ? jiraError.message : 'Bilinmeyen hata'}`);
          if (jiraCreationOption === 'jira') return;
        }
      }
      if (jiraCreationOption === 'local' || jiraCreationOption === 'both') {
        const newAssignment: TaskAssignment = {
          id: Date.now().toString(), title: formData.title, description: formData.description,
          assignee: formData.assignee, project: formData.projectName, sprint: formData.sprint,
          estimatedHours: parseInt(formData.estimatedHours), priority: formData.priority,
          dueDate: formData.dueDate, createdBy: 'Sistem Yöneticisi', createdAt: new Date().toISOString()
        };
        saveAssignments([...assignments, newAssignment]);
      }
      setFormData({ title: '', description: '', assignee: '', projectKey: '', projectName: '', sprint: '', sprintId: '', estimatedHours: '', priority: 'Medium', dueDate: '', issueType: 'Task' });
      setShowForm(false);
      if (jiraCreationOption === 'jira' || jiraCreationOption === 'both') refresh();
    } catch (error) {
      console.error('Görev oluşturma hatası:', error);
      alert(`❌ Görev oluşturulamadı: ${error instanceof Error ? error.message : 'Bilinmeyen hata'}`);
    } finally {
      setCreatingJiraIssue(false);
    }
  };

  const handleProjectChange = (value: string) => {
    try {
      const selectedProject = projectOptions.find(p => p.key === value);
      setFormData(prev => ({ ...prev, projectKey: value, projectName: selectedProject?.name || '', sprint: '', sprintId: '' }));
      if (value) loadActiveSprintsForProject(value);
      else setAvailableSprints([]);
    } catch (err) {
      console.error('Error in handleProjectChange:', err);
      setComponentError('Proje değiştirme hatası: ' + (err instanceof Error ? err.message : 'Bilinmeyen hata'));
    }
  };

  const handleSprintChange = (sprintId: string) => {
    try {
      const selectedSprint = availableSprints.find(s => s.id === sprintId);
      setFormData(prev => ({ ...prev, sprintId, sprint: selectedSprint?.name || '' }));
    } catch (err) {
      console.error('Error in handleSprintChange:', err);
      setComponentError('Sprint değiştirme hatası: ' + (err instanceof Error ? err.message : 'Bilinmeyen hata'));
    }
  };

  const handleDelete = (id: string) => {
    try {
      if (window.confirm('Bu görevi silmek istediğinizden emin misiniz?')) {
        saveAssignments(assignments.filter(a => a.id !== id));
      }
    } catch (err) {
      console.error('Error in handleDelete:', err);
      setComponentError('Silme hatası: ' + (err instanceof Error ? err.message : 'Bilinmeyen hata'));
    }
  };

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'Eksik Yük': return { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' };
      case 'Yeterli': return { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' };
      case 'Aşırı Yük': return { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' };
      default: return { bg: 'bg-slate-50', text: 'text-slate-600', border: 'border-slate-200' };
    }
  };

  const getPriorityConfig = (priority: string) => {
    switch (priority) {
      case 'Critical': return { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', dot: 'bg-red-500' };
      case 'High': return { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200', dot: 'bg-orange-500' };
      case 'Medium': return { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', dot: 'bg-blue-500' };
      case 'Low': return { bg: 'bg-slate-50', text: 'text-slate-600', border: 'border-slate-200', dot: 'bg-slate-400' };
      default: return { bg: 'bg-slate-50', text: 'text-slate-600', border: 'border-slate-200', dot: 'bg-slate-400' };
    }
  };

  // KolayIK entegrasyonu aktifse ve capacityCalculations varsa izin düşürülmüş kapasiteyi kullan
  const getAdjustedCapacity = (developerName: string): number => {
    if (hasKolayIK && capacityCalculations && capacityCalculations.length > 0) {
      const calc = capacityCalculations.find(c => c.developerName === developerName);
      if (calc) return calc.adjustedCapacity;
    }
    return getCapacity(developerName);
  };

  const overallSprintRange = getOverallSprintDateRange(sprints);
  const workloadReady = !!workload && workload.length > 0;
  const developerNameKey = workloadReady ? workload!.map(w => w.developer).sort().join('-') : '';
  const localCacheKey = workloadReady && overallSprintRange
    ? `leave-calculations-${developerNameKey}-${overallSprintRange.start}-${overallSprintRange.end}` : null;
  const capacitiesReadyForPage = capacityReady && !!localCacheKey && capacityCacheKey === localCacheKey;
  const pageLoading = loading;

  const avatarColors = [
    'from-violet-500 to-purple-600', 'from-blue-500 to-cyan-600',
    'from-emerald-500 to-teal-600', 'from-orange-500 to-amber-600',
    'from-rose-500 to-pink-600', 'from-indigo-500 to-blue-600',
  ];
  const getInitials = (name: string) => name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

  const inputClass = "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-colors bg-white";
  const labelClass = "block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5";

  // Yetki kontrolü
  if (!hasRole('admin') && !hasRole('analyst')) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-6">
        <div className="flex items-center gap-2 mb-2">
          <AlertTriangle className="h-5 w-5 text-amber-500" />
          <p className="text-amber-800 font-medium">Bu sayfaya erişim yetkiniz bulunmuyor.</p>
        </div>
        <p className="text-amber-700 text-sm">Manuel görev atama işlemi sadece Yönetici ve Analist rolleri tarafından yapılabilir.</p>
      </div>
    );
  }

  if (componentError) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6">
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle className="h-5 w-5 text-red-500" />
          <p className="text-red-800 font-medium">{componentError}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { setComponentError(null); loadAssignments(); }} className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors">Tekrar Dene</button>
          <button onClick={() => setComponentError(null)} className="px-4 py-2 bg-slate-600 text-white text-sm font-medium rounded-lg hover:bg-slate-700 transition-colors">Hatayı Gizle</button>
        </div>
      </div>
    );
  }

  if (pageLoading) {
    const shouldBootstrapCapacities = workloadReady && overallSprintRange && (!localCacheKey || capacityCacheKey !== localCacheKey);
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full border-2 border-slate-100 border-t-blue-600 animate-spin" />
          <div className="text-center">
            <p className="text-slate-700 font-medium">Veriler hazırlanıyor…</p>
            <p className="text-sm text-slate-400 mt-1 max-w-sm">Yazılımcıların izinlerle düşürülmüş kapasiteleri hesaplanıyor.</p>
          </div>
          {shouldBootstrapCapacities && (
            <div className="hidden">
              <DeveloperCapacityAdjustment
                workload={workload as DeveloperWorkload[]}
                sprintStartDate={overallSprintRange!.start}
                sprintEndDate={overallSprintRange!.end}
                onCapacityUpdate={updateWorkloadStatus}
                updateWorkloadStatus={updateWorkloadStatus}
                onCapacityCalculationsChange={(calculations, cacheKey) => setCapacityCalculations(calculations, cacheKey)}
              />
            </div>
          )}
        </div>
      </div>
    );
  }

  const shouldBootstrapCapacities = workloadReady && overallSprintRange && (!localCacheKey || capacityCacheKey !== localCacheKey);

  return (
    <div className="space-y-5 p-1">
      {/* Hidden bootstrap */}
      {shouldBootstrapCapacities && (
        <div className="hidden">
          <DeveloperCapacityAdjustment
            workload={workload as DeveloperWorkload[]}
            sprintStartDate={overallSprintRange!.start}
            sprintEndDate={overallSprintRange!.end}
            onCapacityUpdate={updateWorkloadStatus}
            updateWorkloadStatus={updateWorkloadStatus}
            onCapacityCalculationsChange={(calculations, cacheKey) => setCapacityCalculations(calculations, cacheKey)}
          />
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Jira'da İş Açma</h2>
          <p className="text-slate-500 mt-0.5 text-sm max-w-xl">
            Yazılımcının izinlerle düşürülmüş kapasitesi ile atanan işlerin analist tahmin toplamı kıyaslanarak eksik yükü olan yazılımcılar listelenir.
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-all shadow-sm hover:shadow"
        >
          <Plus className="h-4 w-4" />
          Yeni Görev
        </button>
      </div>

      {/* Info banner - veri yoksa */}
      {!workloadReady && !loading && (
        <div className="flex items-start gap-3 bg-blue-50 border border-blue-100 rounded-xl p-4">
          <div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 mt-0.5">
            <span className="text-blue-600 text-xs font-bold">i</span>
          </div>
          <p className="text-blue-800 text-sm">
            Eksik yük listesi için Jira projeleri ve yazılımcı seçimi yapılmış olmalı. Kullanıcı & Filtre Yönetimi sayfasından proje ve yazılımcı seçin.
          </p>
        </div>
      )}

      {/* Kapasite Özeti Tablosu */}
      {workloadReady && workload && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100">
            <h3 className="text-base font-semibold text-slate-800">Yazılımcı Kapasite Özeti</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Tahmini süre (Jira) ve kapasite (saat) — Kolay İK varsa izinler düşülerek hesaplanır
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  {['Yazılımcı', 'Tahmini Süre', 'İzin Düşürülmüş Kapasite', 'Durum'].map((h, i) => (
                    <th key={h} className={`px-5 py-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wider ${i === 0 ? 'text-left' : i < 3 ? 'text-right' : 'text-center'}`}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {workload.map((dev, index) => {
                  const capacity = getAdjustedCapacity(dev.developer);
                  const estimatedHours = Math.round((dev.totalHours || 0) * 100) / 100;
                  const statusCfg = getStatusConfig(dev.status);
                  const avatarGradient = avatarColors[index % avatarColors.length];
                  const fillPct = capacity > 0 ? Math.min(100, (estimatedHours / capacity) * 100) : 0;

                  return (
                    <tr key={dev.developer} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 bg-gradient-to-br ${avatarGradient} rounded-full flex items-center justify-center flex-shrink-0 shadow-sm`}>
                            <span className="text-[11px] font-bold text-white">{getInitials(dev.developer)}</span>
                          </div>
                          <span className="text-sm font-semibold text-slate-800">{dev.developer}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <span className="text-sm font-bold text-blue-600 tabular-nums">{estimatedHours}h</span>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <div className="flex items-center justify-end gap-3">
                          <div className="w-24 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${dev.status === 'Aşırı Yük' ? 'bg-red-500' : dev.status === 'Yeterli' ? 'bg-emerald-500' : 'bg-amber-400'}`}
                              style={{ width: `${fillPct}%` }}
                            />
                          </div>
                          <span className="text-sm font-semibold text-slate-700 tabular-nums">{capacity}h</span>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-center">
                        <span className={`inline-flex px-2.5 py-0.5 text-[11px] font-semibold rounded-full border ${statusCfg.bg} ${statusCfg.text} ${statusCfg.border}`}>
                          {dev.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal Form */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex justify-between items-center px-6 py-5 border-b border-slate-100">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Yeni Manuel Görev</h3>
                <p className="text-xs text-slate-400 mt-0.5">Jira'da veya yerel olarak görev oluşturun</p>
              </div>
              <button onClick={() => setShowForm(false)} className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">
              {/* Oluşturma Seçeneği */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                  <ExternalLink className="h-3.5 w-3.5" />
                  Görev Oluşturma Seçeneği
                </p>
                <div className="flex gap-3">
                  {[
                    { value: 'local', label: 'Sadece Yerel' },
                    { value: 'jira', label: "Sadece Jira'da" },
                    { value: 'both', label: 'Her İkisinde' },
                  ].map(opt => (
                    <label key={opt.value} className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg border-2 cursor-pointer transition-all text-sm font-medium ${
                      jiraCreationOption === opt.value
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-slate-200 text-slate-500 hover:border-slate-300'
                    }`}>
                      <input
                        type="radio"
                        name="creationOption"
                        value={opt.value}
                        checked={jiraCreationOption === opt.value}
                        onChange={(e) => setJiraCreationOption(e.target.value as any)}
                        className="sr-only"
                      />
                      {opt.label}
                    </label>
                  ))}
                </div>
              </div>

              {/* Başlık */}
              <div>
                <label className={labelClass}>Görev Başlığı <span className="text-red-400">*</span></label>
                <input
                  type="text" required value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  className={inputClass} placeholder="Görev başlığını girin"
                />
              </div>

              {/* Açıklama */}
              <div>
                <label className={labelClass}>Açıklama</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  rows={3} className={inputClass} placeholder="Görev açıklamasını girin"
                />
              </div>

              {/* Atanan + Proje */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Atanan Kişi <span className="text-red-400">*</span></label>
                  <select required value={formData.assignee} onChange={(e) => setFormData(prev => ({ ...prev, assignee: e.target.value }))} className={inputClass}>
                    <option value="">Seçiniz</option>
                    {workload && workload.length > 0
                      ? workload.map(dev => {
                          const capacity = getAdjustedCapacity(dev.developer);
                          const estimatedHours = Math.round((dev.totalHours || 0) * 100) / 100;
                          return <option key={dev.developer} value={dev.developer}>{dev.developer} ({estimatedHours}h / {capacity}h)</option>;
                        })
                      : fallbackDeveloperNames.map(name => <option key={name} value={name}>{name}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Proje / Banka <span className="text-red-400">*</span></label>
                  <select required value={formData.projectKey} onChange={(e) => handleProjectChange(e.target.value)} className={inputClass}>
                    <option value="">Seçiniz</option>
                    {projectOptions.map(project => (
                      <option key={project.key} value={project.key}>{project.name} ({project.key})</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Sprint + Issue Tipi + Tahmini Süre + Öncelik */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Sprint</label>
                  <select
                    value={formData.sprintId} onChange={(e) => handleSprintChange(e.target.value)}
                    className={inputClass} disabled={!formData.projectKey || loadingSprints}
                  >
                    <option value="">
                      {!formData.projectKey ? 'Önce proje seçin' :
                       loadingSprints ? 'Yükleniyor…' :
                       availableSprints.length === 0 ? 'Aktif sprint yok' : 'Sprint seçin'}
                    </option>
                    {availableSprints.map(sprint => (
                      <option key={sprint.id} value={sprint.id}>
                        {sprint.name}{sprint.startDate && sprint.endDate && ` (${new Date(sprint.startDate).toLocaleDateString('tr-TR')} – ${new Date(sprint.endDate).toLocaleDateString('tr-TR')})`}
                      </option>
                    ))}
                  </select>
                  {loadingSprints && (
                    <div className="flex items-center gap-1.5 mt-1">
                      <Loader className="h-3 w-3 animate-spin text-blue-500" />
                      <span className="text-[11px] text-slate-400">Sprintler yükleniyor…</span>
                    </div>
                  )}
                </div>

                {(jiraCreationOption === 'jira' || jiraCreationOption === 'both') && (
                  <div>
                    <label className={labelClass}>Issue Tipi</label>
                    <select value={formData.issueType} onChange={(e) => setFormData(prev => ({ ...prev, issueType: e.target.value }))} className={inputClass}>
                      <option value="Task">Task</option>
                      <option value="Bug">Bug</option>
                      <option value="Story">Story</option>
                      <option value="Epic">Epic</option>
                    </select>
                  </div>
                )}

                <div>
                  <label className={labelClass}>Tahmini Süre (saat) <span className="text-red-400">*</span></label>
                  <input
                    type="number" required min="1" value={formData.estimatedHours}
                    onChange={(e) => setFormData(prev => ({ ...prev, estimatedHours: e.target.value }))}
                    className={inputClass} placeholder="0"
                  />
                </div>

                <div>
                  <label className={labelClass}>Öncelik</label>
                  <select value={formData.priority} onChange={(e) => setFormData(prev => ({ ...prev, priority: e.target.value as any }))} className={inputClass}>
                    <option value="Low">Düşük</option>
                    <option value="Medium">Orta</option>
                    <option value="High">Yüksek</option>
                    <option value="Critical">Kritik</option>
                  </select>
                </div>
              </div>

              {/* Teslim Tarihi */}
              <div>
                <label className={labelClass}>Teslim Tarihi</label>
                <input type="date" value={formData.dueDate} onChange={(e) => setFormData(prev => ({ ...prev, dueDate: e.target.value }))} className={inputClass} />
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
                  İptal
                </button>
                <button type="submit" disabled={creatingJiraIssue} className="inline-flex items-center gap-2 px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
                  {creatingJiraIssue ? (
                    <><Loader className="h-4 w-4 animate-spin" /><span>{jiraCreationOption === 'jira' ? "Jira'da Oluşturuluyor…" : jiraCreationOption === 'both' ? 'Oluşturuluyor…' : 'Kaydediliyor…'}</span></>
                  ) : (
                    <><Save className="h-4 w-4" /><span>{jiraCreationOption === 'jira' ? "Jira'da Oluştur" : jiraCreationOption === 'both' ? 'Her İkisinde Oluştur' : 'Kaydet'}</span></>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Assignments Listesi */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-base font-semibold text-slate-800">Manuel Atanan Görevler</h3>
          {assignments.length > 0 && (
            <span className="text-xs text-slate-400 font-medium">{assignments.length} görev</span>
          )}
        </div>

        {assignments.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  {['Görev', 'Atanan', 'Proje', 'Süre', 'Öncelik', 'Teslim', ''].map((h, i) => (
                    <th key={i} className={`px-5 py-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wider ${i === 0 || i === 1 || i === 2 ? 'text-left' : 'text-center'}`}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {assignments.map((assignment, index) => {
                  const priorityCfg = getPriorityConfig(assignment.priority);
                  const avatarGradient = avatarColors[index % avatarColors.length];

                  return (
                    <tr key={assignment.id} className="hover:bg-slate-50/70 transition-colors">
                      {/* Görev */}
                      <td className="px-5 py-3.5 max-w-xs">
                        <p className="text-sm font-semibold text-slate-800 leading-tight">{assignment.title}</p>
                        {assignment.description && (
                          <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">{assignment.description}</p>
                        )}
                        {assignment.sprint && (
                          <span className="inline-block mt-1 text-[11px] text-blue-600 font-medium bg-blue-50 border border-blue-100 px-1.5 py-0.5 rounded">
                            {assignment.sprint}
                          </span>
                        )}
                      </td>

                      {/* Atanan */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <div className={`w-7 h-7 bg-gradient-to-br ${avatarGradient} rounded-full flex items-center justify-center flex-shrink-0 shadow-sm`}>
                            <span className="text-[10px] font-bold text-white">{getInitials(assignment.assignee)}</span>
                          </div>
                          <span className="text-sm text-slate-700 font-medium">{assignment.assignee}</span>
                        </div>
                      </td>

                      {/* Proje */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-slate-700">{assignment.project}</span>
                          {assignment.project && projectOptions.find(p => p.name === assignment.project) && (
                            <span className="text-[11px] font-semibold text-blue-600 bg-blue-50 border border-blue-100 px-1.5 py-0.5 rounded">
                              {projectOptions.find(p => p.name === assignment.project)?.key}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Süre */}
                      <td className="px-5 py-3.5 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Clock className="h-3.5 w-3.5 text-slate-400" />
                          <span className="text-sm font-semibold text-slate-700 tabular-nums">{assignment.estimatedHours}h</span>
                        </div>
                      </td>

                      {/* Öncelik */}
                      <td className="px-5 py-3.5 text-center">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 text-[11px] font-semibold rounded-full border ${priorityCfg.bg} ${priorityCfg.text} ${priorityCfg.border}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${priorityCfg.dot}`} />
                          {assignment.priority}
                        </span>
                      </td>

                      {/* Teslim */}
                      <td className="px-5 py-3.5 text-center">
                        {assignment.dueDate ? (
                          <span className="text-sm text-slate-600 tabular-nums">{new Date(assignment.dueDate).toLocaleDateString('tr-TR')}</span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>

                      {/* Sil */}
                      <td className="px-5 py-3.5 text-center">
                        <button
                          onClick={() => handleDelete(assignment.id)}
                          className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors mx-auto"
                          title="Sil"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-16">
            <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Plus className="h-7 w-7 text-slate-400" />
            </div>
            <p className="text-slate-600 font-medium">Henüz manuel görev atanmamış.</p>
            <p className="text-slate-400 text-sm mt-1">Eksik yükü olan yazılımcılara görev atamak için "Yeni Görev" butonunu kullanın.</p>
          </div>
        )}
      </div>
    </div>
  );
};