import React, { useState, useEffect } from 'react';
import { ManualTaskAssignment as TaskAssignment, DeveloperWorkload, JiraSprint } from '../types';
import { supabaseJiraService } from '../lib/supabaseJiraService';
import { Plus, Save, X, User, Clock, AlertTriangle, CheckCircle, ExternalLink, Loader, Download, RefreshCw } from 'lucide-react';
import { useJiraData } from '../context/JiraDataContext';
import { useAuth } from '../context/AuthContext';
import { useDeveloperCapacities } from '../hooks/useDeveloperCapacities';
import { exportManualAssignmentsToCSV } from '../utils/csvExport';
import { DeveloperCapacityAdjustment } from './DeveloperCapacityAdjustment';
import { getOverallSprintDateRange } from '../utils/sprintDateUtils';

// Sayfa bazlı cache: kapasite + sprint aralığı bazında eksik yükteki geliştiricileri sakla
const underloadedDevelopersCache = new Map<string, DeveloperWorkload[]>();

export const ManualTaskAssignment: React.FC = () => {
  const {
    workload,
    projects,
    sprints,
    loading,
    error,
    refresh,
    updateWorkloadStatus,
    capacityCalculations,
    setCapacityCalculations,
    capacityReady,
    capacityCacheKey
  } = useJiraData();
  const { hasRole, canAccessProject, getAccessibleProjects } = useAuth();
  const { getCapacity } = useDeveloperCapacities();
  const [assignments, setAssignments] = useState<TaskAssignment[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [creatingJiraIssue, setCreatingJiraIssue] = useState(false);
  const [jiraCreationOption, setJiraCreationOption] = useState<'local' | 'jira' | 'both'>('local');
  const [availableSprints, setAvailableSprints] = useState<JiraSprint[]>([]);
  const [loadingSprints, setLoadingSprints] = useState(false);
  const [componentError, setComponentError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    assignee: '',
    projectKey: '',
    projectName: '',
    sprint: '',
    sprintId: '',
    estimatedHours: '',
    priority: 'Medium' as const,
    dueDate: '',
    issueType: 'Task'
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

  // Kullanıcının erişebileceği projeleri filtrele
  const projectOptions = hasRole('admin') 
    ? allProjectOptions 
    : allProjectOptions.filter(project => canAccessProject(project.key));

  useEffect(() => {
    try {
      loadAssignments();
    } catch (err) {
      console.error('Error in useEffect:', err);
      setComponentError(err instanceof Error ? err.message : 'Component initialization error');
    }
  }, []);

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
      
      // Jira'da issue oluştur
      if (jiraCreationOption === 'jira' || jiraCreationOption === 'both') {
        try {
          const jiraIssue = await supabaseJiraService.createIssue({
            projectKey: formData.projectKey,
            summary: formData.title,
            description: formData.description,
            assignee: formData.assignee,
            priority: formData.priority,
            estimatedHours: parseInt(formData.estimatedHours),
            issueType: formData.issueType,
            sprintId: formData.sprintId
          });
          
          jiraIssueKey = jiraIssue.key;
          
          // Success notification
          alert(`✅ Jira'da görev oluşturuldu: ${jiraIssueKey}`);
        } catch (jiraError) {
          console.error('Jira issue oluşturma hatası:', jiraError);
          alert(`❌ Jira'da görev oluşturulamadı: ${jiraError instanceof Error ? jiraError.message : 'Bilinmeyen hata'}`);
          
          if (jiraCreationOption === 'jira') {
            // Sadece Jira seçilmişse ve hata varsa işlemi durdur
            return;
          }
        }
      }
      
      // Yerel kayıt oluştur
      if (jiraCreationOption === 'local' || jiraCreationOption === 'both') {
        const newAssignment: TaskAssignment = {
          id: Date.now().toString(),
          title: formData.title,
          description: formData.description,
          assignee: formData.assignee,
          project: formData.projectName,
          sprint: formData.sprint,
          estimatedHours: parseInt(formData.estimatedHours),
          priority: formData.priority,
          dueDate: formData.dueDate,
          createdBy: 'Sistem Yöneticisi',
          createdAt: new Date().toISOString()
        };

        const updatedAssignments = [...assignments, newAssignment];
        saveAssignments(updatedAssignments);
      }
      
      // Form'u temizle ve kapat
      setFormData({
        title: '',
        description: '',
        assignee: '',
        projectKey: '',
        projectName: '',
        sprint: '',
        sprintId: '',
        estimatedHours: '',
        priority: 'Medium',
        dueDate: '',
        issueType: 'Task'
      });
      setShowForm(false);
      
      // Cache'i temizle ki yeni görev listede görünsün
      if (jiraCreationOption === 'jira' || jiraCreationOption === 'both') {
        refresh();
      }
      
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
      setFormData(prev => ({
        ...prev,
        projectKey: value,
        projectName: selectedProject?.name || '',
        sprint: '',
        sprintId: ''
      }));
      
      // Load active sprints for selected project
      if (value) {
        loadActiveSprintsForProject(value);
      } else {
        setAvailableSprints([]);
      }
    } catch (err) {
      console.error('Error in handleProjectChange:', err);
      setComponentError('Proje değiştirme hatası: ' + (err instanceof Error ? err.message : 'Bilinmeyen hata'));
    }
  };
    

  const handleSprintChange = (sprintId: string) => {
    try {
      const selectedSprint = availableSprints.find(s => s.id === sprintId);
      setFormData(prev => ({
        ...prev,
        sprintId,
        sprint: selectedSprint?.name || ''
      }));
    } catch (err) {
      console.error('Error in handleSprintChange:', err);
      setComponentError('Sprint değiştirme hatası: ' + (err instanceof Error ? err.message : 'Bilinmeyen hata'));
    }
  };

  const handleDelete = (id: string) => {
    try {
      if (window.confirm('Bu görevi silmek istediğinizden emin misiniz?')) {
        const updatedAssignments = assignments.filter(a => a.id !== id);
        saveAssignments(updatedAssignments);
      }
    } catch (err) {
      console.error('Error in handleDelete:', err);
      setComponentError('Silme hatası: ' + (err instanceof Error ? err.message : 'Bilinmeyen hata'));
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Eksik Yük': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'Yeterli': return 'bg-green-100 text-green-800 border-green-200';
      case 'Aşırı Yük': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Eksik Yük': return <AlertTriangle className="h-4 w-4" />;
      case 'Yeterli': return <CheckCircle className="h-4 w-4" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'Critical': return 'bg-red-100 text-red-800';
      case 'High': return 'bg-orange-100 text-orange-800';
      case 'Medium': return 'bg-blue-100 text-blue-800';
      case 'Low': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getAdjustedCapacity = (developerName: string): number => {
    if (capacityCalculations && capacityCalculations.length > 0) {
      const calc = capacityCalculations.find(c => c.developerName === developerName);
      if (calc) {
        return calc.adjustedCapacity;
      }
    }
    return getCapacity(developerName);
  };

  // Tüm sprintler için genel tarih aralığı (kapasite hesaplamasını tetiklemek için kullanılır)
  const overallSprintRange = getOverallSprintDateRange(sprints);

  const workloadReady = !!workload && workload.length > 0;
  // DeveloperCapacityAdjustment ile aynı cache key mantığını kullan
  const developerNameKey = workloadReady ? workload!.map(w => w.developer).sort().join('-') : '';
  const localCacheKey =
    workloadReady && overallSprintRange
      ? `leave-calculations-${developerNameKey}-${overallSprintRange.start}-${overallSprintRange.end}`
      : null;
  const capacitiesReadyForPage =
    capacityReady &&
    !!localCacheKey &&
    capacityCacheKey === localCacheKey;
  const pageLoading = loading || !workloadReady || !capacitiesReadyForPage;

  // Eksik yükteki geliştiricileri cache'leyen local state
  const [underloadedDevelopers, setUnderloadedDevelopers] = useState<DeveloperWorkload[]>([]);

  // Kapasite ve workload hazır olduğunda, önce cache'e bak; yoksa hesaplayıp cache'e yaz
  useEffect(() => {
    if (!workloadReady || !capacitiesReadyForPage || !localCacheKey) {
      return;
    }

    const cached = underloadedDevelopersCache.get(localCacheKey);
    if (cached) {
      setUnderloadedDevelopers(cached);
      return;
    }

    if (workload) {
      const list = workload.filter(dev => {
        const capacity = getAdjustedCapacity(dev.developer);
        const estimatedHours = dev.totalHours || 0;
        return estimatedHours < capacity;
      });
      underloadedDevelopersCache.set(localCacheKey, list);
      setUnderloadedDevelopers(list);
    }
  }, [workloadReady, capacitiesReadyForPage, localCacheKey, workload]);

  // Yetki kontrolü - sadece admin ve analist görev atayabilir
  if (!hasRole('admin') && !hasRole('analyst')) {
    return (
      <div className="space-y-6">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="h-5 w-5 text-yellow-600" />
            <p className="text-yellow-800">Bu sayfaya erişim yetkiniz bulunmuyor.</p>
          </div>
          <p className="text-yellow-700 text-sm mt-2">
            Manuel görev atama işlemi sadece Yönetici ve Analist rolleri tarafından yapılabilir.
          </p>
        </div>
      </div>
    );
  }

  // Component error display
  if (componentError) {
    return (
      <div className="space-y-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            <p className="text-red-800">{componentError}</p>
          </div>
          <div className="mt-4 flex space-x-3">
            <button
              onClick={() => {
                setComponentError(null);
                loadAssignments();
              }}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              Tekrar Dene
            </button>
            <button
              onClick={() => setComponentError(null)}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              Hatayı Gizle
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Kapasite / workload verileri hazırlanırken bekleme ekranı göster
  if (pageLoading) {
    const shouldBootstrapCapacities =
      workloadReady &&
      overallSprintRange &&
      (!localCacheKey || capacityCacheKey !== localCacheKey);

    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex flex-col items-center space-y-4">
          <Loader className="h-8 w-8 animate-spin text-blue-600" />
          <div className="text-center">
            <p className="text-lg text-gray-700">Veriler hazırlanıyor...</p>
            <p className="text-sm text-gray-500 mt-1">
              Yazılımcıların izinlerle düşürülmüş kapasiteleri hesaplanıyor. Bu işlem tamamlandığında eksik yükü olan yazılımcılar otomatik olarak listelenecektir.
            </p>
          </div>

          {/* Kapasite hesaplamasını, Yazılımcı Analizi sayfasını açmaya gerek kalmadan otomatik tetikle */}
          {shouldBootstrapCapacities && (
            <div className="hidden">
              <DeveloperCapacityAdjustment
                workload={workload as DeveloperWorkload[]}
                sprintStartDate={overallSprintRange!.start}
                sprintEndDate={overallSprintRange!.end}
                onCapacityUpdate={updateWorkloadStatus}
                updateWorkloadStatus={updateWorkloadStatus}
                onCapacityCalculationsChange={(calculations, cacheKey) => {
                  setCapacityCalculations(calculations, cacheKey);
                }}
              />
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Jirada İş Açma</h2>
          <p className="text-gray-600 mt-1">
            Yazılımcının izinlerle düşürülmüş kapasitesi ile, ona atanan işlerin analist tahmin toplamı kıyaslanarak
            eksik yükü olan yazılımcılar listelenir.
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="h-5 w-5" />
            <span>Yeni Görev</span>
          </button>
        </div>
      </div>

      {/* Underloaded Developers Alert */}
      {underloadedDevelopers.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-center space-x-2 mb-2">
            <AlertTriangle className="h-5 w-5 text-yellow-600" />
            <h3 className="font-medium text-yellow-800">Eksik Yükü Olan Yazılımcılar</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {underloadedDevelopers.map(dev => {
              const capacity = getAdjustedCapacity(dev.developer);
              const estimatedHours = Math.round((dev.totalHours || 0) * 100) / 100;
              return (
                <div key={dev.developer} className="bg-white rounded p-3 border border-yellow-200">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-gray-900">{dev.developer}</span>
                    <span className="text-sm text-yellow-700">{estimatedHours}h / {capacity}h</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                    <div
                      className="bg-yellow-500 h-2 rounded-full"
                      style={{ width: `${Math.min((estimatedHours / capacity) * 100, 100)}%` }}
                    ></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Assignment Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-6 border-b border-gray-200">
              <h3 className="text-xl font-semibold text-gray-900">Yeni Manuel Görev</h3>
              <button
                onClick={() => setShowForm(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {/* Jira Creation Option */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <ExternalLink className="inline h-4 w-4 mr-1" />
                  Görev Oluşturma Seçeneği
                </label>
                <div className="space-y-2">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="creationOption"
                      value="local"
                      checked={jiraCreationOption === 'local'}
                      onChange={(e) => setJiraCreationOption(e.target.value as any)}
                      className="mr-2"
                    />
                    <span className="text-sm">Sadece yerel kayıt</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="creationOption"
                      value="jira"
                      checked={jiraCreationOption === 'jira'}
                      onChange={(e) => setJiraCreationOption(e.target.value as any)}
                      className="mr-2"
                    />
                    <span className="text-sm">Sadece Jira'da oluştur</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="creationOption"
                      value="both"
                      checked={jiraCreationOption === 'both'}
                      onChange={(e) => setJiraCreationOption(e.target.value as any)}
                      className="mr-2"
                    />
                    <span className="text-sm">Her ikisinde de oluştur</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Görev Başlığı *
                </label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Görev başlığını girin"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Açıklama
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  rows={3}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Görev açıklamasını girin"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Atanan Kişi *
                  </label>
                  <select
                    required
                    value={formData.assignee}
                    onChange={(e) => setFormData(prev => ({ ...prev, assignee: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Seçiniz</option>
                    {workload && workload.map(dev => {
                      const capacity = getAdjustedCapacity(dev.developer);
                      const estimatedHours = Math.round((dev.totalHours || 0) * 100) / 100;
                      return (
                        <option key={dev.developer} value={dev.developer}>
                          {dev.developer} ({estimatedHours}h / {capacity}h - {dev.status})
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Proje/Banka *
                  </label>
                  <select
                    required
                    value={formData.projectKey}
                    onChange={(e) => handleProjectChange(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Seçiniz</option>
                    {projectOptions.map(project => (
                      <option key={project.key} value={project.key}>
                        {project.name} ({project.key})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {(jiraCreationOption === 'jira' || jiraCreationOption === 'both') && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Issue Tipi
                    </label>
                    <select
                      value={formData.issueType}
                      onChange={(e) => setFormData(prev => ({ ...prev, issueType: e.target.value }))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="Task">Task</option>
                      <option value="Bug">Bug</option>
                      <option value="Story">Story</option>
                      <option value="Epic">Epic</option>
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Sprint
                  </label>
                  <select
                    value={formData.sprintId}
                    onChange={(e) => handleSprintChange(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    disabled={!formData.projectKey || loadingSprints}
                  >
                    <option value="">
                      {!formData.projectKey ? 'Önce proje seçin' : 
                       loadingSprints ? 'Sprintler yükleniyor...' : 
                       availableSprints.length === 0 ? 'Aktif sprint bulunamadı' : 'Sprint seçin'}
                    </option>
                    {availableSprints.map(sprint => (
                      <option key={sprint.id} value={sprint.id}>
                        {sprint.name}
                        {sprint.startDate && sprint.endDate && (
                          ` (${new Date(sprint.startDate).toLocaleDateString('tr-TR')} - ${new Date(sprint.endDate).toLocaleDateString('tr-TR')})`
                        )}
                      </option>
                    ))}
                  </select>
                  {loadingSprints && (
                    <div className="flex items-center space-x-2 mt-1">
                      <Loader className="h-3 w-3 animate-spin text-blue-600" />
                      <span className="text-xs text-gray-500">Aktif sprintler yükleniyor...</span>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tahmini Süre (saat) *
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={formData.estimatedHours}
                    onChange={(e) => setFormData(prev => ({ ...prev, estimatedHours: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="0"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Öncelik
                  </label>
                  <select
                    value={formData.priority}
                    onChange={(e) => setFormData(prev => ({ ...prev, priority: e.target.value as any }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="Low">Düşük</option>
                    <option value="Medium">Orta</option>
                    <option value="High">Yüksek</option>
                    <option value="Critical">Kritik</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Teslim Tarihi
                </label>
                <input
                  type="date"
                  value={formData.dueDate}
                  onChange={(e) => setFormData(prev => ({ ...prev, dueDate: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={creatingJiraIssue}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center space-x-2"
                >
                  {creatingJiraIssue ? (
                    <>
                      <Loader className="h-4 w-4 animate-spin" />
                      <span>
                        {jiraCreationOption === 'jira' ? 'Jira\'da Oluşturuluyor...' : 
                         jiraCreationOption === 'both' ? 'Oluşturuluyor...' : 'Kaydediliyor...'}
                      </span>
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4" />
                      <span>
                        {jiraCreationOption === 'jira' ? 'Jira\'da Oluştur' : 
                         jiraCreationOption === 'both' ? 'Her İkisinde Oluştur' : 'Kaydet'}
                      </span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Assignments List */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Manuel Atanan Görevler</h3>
        </div>
        
        {assignments.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Görev
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Atanan
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Proje
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Süre
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Öncelik
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Teslim
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    İşlem
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {assignments.map((assignment, index) => (
                  <tr key={assignment.id} className={`hover:bg-gray-50 transition-colors ${
                    index % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'
                  }`}>
                    <td className="px-6 py-4">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{assignment.title}</p>
                        {assignment.description && (
                          <p className="text-xs text-gray-500 mt-1 line-clamp-2">{assignment.description}</p>
                        )}
                        {assignment.sprint && (
                          <p className="text-xs text-blue-600 mt-1">{assignment.sprint}</p>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-2">
                        <div className="flex-shrink-0 h-8 w-8 bg-blue-100 rounded-full flex items-center justify-center">
                          <span className="text-xs font-medium text-blue-800">
                            {assignment.assignee.split(' ').map(n => n[0]).join('').slice(0, 2)}
                          </span>
                        </div>
                        <span className="text-sm text-gray-900">{assignment.assignee}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-2">
                        <span className="text-sm text-gray-900">{assignment.project}</span>
                        {assignment.project && projectOptions.find(p => p.name === assignment.project) && (
                          <span className="text-xs text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded">
                            {projectOptions.find(p => p.name === assignment.project)?.key}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center space-x-1">
                        <Clock className="h-3 w-3 text-gray-400" />
                        <span className="text-sm font-medium">{assignment.estimatedHours}h</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getPriorityColor(assignment.priority)}`}>
                        {assignment.priority}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      {assignment.dueDate ? (
                        <span className="text-sm text-gray-900">
                          {new Date(assignment.dueDate).toLocaleDateString('tr-TR')}
                        </span>
                      ) : (
                        <span className="text-sm text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button
                        onClick={() => handleDelete(assignment.id)}
                        className="text-red-600 hover:text-red-800 transition-colors"
                        title="Sil"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12">
            <Plus className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 text-lg">Henüz manuel görev atanmamış.</p>
            <p className="text-gray-400 text-sm mt-2">Eksik yükü olan yazılımcılara görev atamak için "Yeni Görev" butonunu kullanın.</p>
          </div>
        )}
      </div>
    </div>
  );
};