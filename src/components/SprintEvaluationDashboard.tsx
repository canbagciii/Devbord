import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { SprintEvaluationSummary } from '../types/evaluation';
import { supabaseEvaluationService } from '../lib/supabaseEvaluationService';
import { supabaseJiraService } from '../lib/supabaseJiraService';
import { useJiraData } from '../context/JiraDataContext';
import { useAuth } from '../context/AuthContext';
import { BarChart3, Star, Users, MessageSquare, Download, Eye, Calendar, TrendingUp, Trash2 } from 'lucide-react';
import type { JiraTask } from '../types';

export const SprintEvaluationDashboard: React.FC = () => {
  const { sprints, sprintTasks, loading } = useJiraData();
  const { hasRole, canAccessProject } = useAuth();
  const [evaluationSummaries, setEvaluationSummaries] = useState<SprintEvaluationSummary[]>([]);
  const [evaluationsLoading, setEvaluationsLoading] = useState(true);
  const [selectedSummary, setSelectedSummary] = useState<SprintEvaluationSummary | null>(null);
  const [selectedProject, setSelectedProject] = useState<string>('all');
  const [allProjectEvaluations, setAllProjectEvaluations] = useState<SprintEvaluationSummary[]>([]);
  const [deletingEvaluationId, setDeletingEvaluationId] = useState<string | null>(null);

  // Proje isimleri sabit değeri
  const projectNames: Record<string, string> = useMemo(() => ({
    'ATK': 'Albaraka Türk Katılım Bankası',
    'ALB': 'Alternatif Bank',
    'AN': 'Anadolubank',
    'BB': 'Burgan Bank',
    'EK': 'Emlak Katılım',
    'OB': 'OdeaBank',
    'QNB': 'QNB Bank',
    'TFKB': 'Türkiye Finans',
    'VK': 'Vakıf Katılım',
    'ZK': 'Ziraat Katılım Bankası',
    'DK': 'Dünya Katılım'
  }), []);

  useEffect(() => {
    const loadEvaluationSummaries = async () => {
      if (!hasRole('admin')) {
        setEvaluationsLoading(false);
        return;
      }

      setEvaluationsLoading(true);

      console.log('📊 Değerlendirmeleri yükleniyor...');

      try {
        // ÖNCELİKLE veritabanından değerlendirmesi olan sprintleri al
        const evaluatedSprints = await supabaseEvaluationService.getAllEvaluatedSprints();
        console.log(`✅ Veritabanında ${evaluatedSprints.length} sprint için değerlendirme var`);

        if (evaluatedSprints.length === 0) {
          console.log('ℹ️ Henüz hiç değerlendirme yapılmamış');
          setEvaluationSummaries([]);
          setAllProjectEvaluations([]);
          setEvaluationsLoading(false);
          return;
        }

        // Bu sprintleri JiraSprint formatına çevir
        // Not: Jira'dan gelen sprint bilgileriyle birleştireceğiz
        const evaluatedSprintIds = evaluatedSprints.map(s => s.sprint_id);

        // Jira'dan bu sprintlerin bilgilerini al (eğer varsa)
        const jiraSprintsMap = new Map(sprints?.map(s => [s.id, s]) || []);

        // Değerlendirmesi olan sprintleri hazırla
        const sprintsToProcess = evaluatedSprints.map(evalSprint => {
          const jiraSprint = jiraSprintsMap.get(evalSprint.sprint_id);

          // Jira'da varsa onun bilgilerini kullan, yoksa DB'deki bilgileri kullan
          if (jiraSprint) {
            return jiraSprint;
          } else {
            // Jira'da olmayan eski sprint - minimal bilgiyle oluştur
            return {
              id: evalSprint.sprint_id,
              name: evalSprint.sprint_name,
              state: 'closed',
              projectKey: evalSprint.project_key
            } as any;
          }
        });

        console.log(`📊 İşlenecek sprint sayısı: ${sprintsToProcess.length}`);

        // Eksik sprintler için task verilerini çek
        const missingSprintIds = sprintsToProcess
          .filter(sprint => !sprintTasks || !sprintTasks[sprint.id])
          .map(sprint => sprint.id);

        console.log(`🔍 ${missingSprintIds.length} sprint için task verisi eksik, Jira'dan çekiliyor...`);

        // Eksik sprint task'larını çek
        const additionalSprintTasks: Record<string, JiraTask[]> = {};
        for (const sprintId of missingSprintIds) {
          try {
            const tasks = await supabaseJiraService.getSprintIssues(sprintId);
            additionalSprintTasks[sprintId] = tasks;
            console.log(`✅ Sprint ${sprintId}: ${tasks.length} task çekildi`);
          } catch (error) {
            console.error(`❌ Sprint ${sprintId} için task çekilemedi:`, error);
            additionalSprintTasks[sprintId] = [];
          }
        }

        // Mevcut sprintTasks ile yeni çekilen task'ları birleştir
        const mergedSprintTasks = {
          ...(sprintTasks || {}),
          ...additionalSprintTasks
        };

        console.log(`📊 Toplam sprint task sayısı: ${Object.keys(mergedSprintTasks).length}`);

        // Tüm değerlendirmeleri al
        const allClosedSummaries = await supabaseEvaluationService.getAllEvaluationSummaries(
          sprintsToProcess,
          mergedSprintTasks,
          projectNames
        );
        
        // Tüm değerlendirmeleri sakla (proje filtresi için)
        const allEvaluatedSummaries = allClosedSummaries.filter(summary => 
          summary.totalEvaluations > 0 && 
          canAccessProject(summary.projectKey)
        );
        setAllProjectEvaluations(allEvaluatedSummaries);
        
        // "Tüm Projeler" için sadece son sprint verilerini göster
        const latestSprintPerProject = new Map<string, SprintEvaluationSummary>();
        
        // Her proje için en son kapatılan sprint'i bul
        allEvaluatedSummaries.forEach(summary => {
          const existing = latestSprintPerProject.get(summary.projectKey);
          if (!existing || (summary.endDate && existing.endDate && summary.endDate > existing.endDate)) {
            latestSprintPerProject.set(summary.projectKey, summary);
          }
        });
        
        const latestSprintSummaries = Array.from(latestSprintPerProject.values());
      
        console.log(`📊 İşlenen sprint sayısı: ${sprintsToProcess.length}`);
        console.log(`✅ Tüm değerlendirme yapılmış sprint: ${allEvaluatedSummaries.length}`);
        console.log(`🔐 Son sprint değerlendirmeleri: ${latestSprintSummaries.length}`);

        setEvaluationSummaries(latestSprintSummaries);
      } catch (error) {
        console.error('Error loading evaluation summaries:', error);
        setEvaluationSummaries([]);
        setAllProjectEvaluations([]);
      } finally {
        setEvaluationsLoading(false);
      }
    };

    loadEvaluationSummaries();
  }, [sprints, sprintTasks, hasRole, canAccessProject, projectNames]);

  // Değerlendirme özetlerini yeniden yükle
  const reloadEvaluationSummaries = useCallback(async () => {
    if (!hasRole('admin')) {
      return;
    }

    setEvaluationsLoading(true);

    try {
      // Veritabanından değerlendirmesi olan sprintleri al
      const evaluatedSprints = await supabaseEvaluationService.getAllEvaluatedSprints();

      if (evaluatedSprints.length === 0) {
        setEvaluationSummaries([]);
        setAllProjectEvaluations([]);
        setEvaluationsLoading(false);
        return;
      }

      const jiraSprintsMap = new Map(sprints?.map(s => [s.id, s]) || []);

      const sprintsToProcess = evaluatedSprints.map(evalSprint => {
        const jiraSprint = jiraSprintsMap.get(evalSprint.sprint_id);
        if (jiraSprint) {
          return jiraSprint;
        } else {
          return {
            id: evalSprint.sprint_id,
            name: evalSprint.sprint_name,
            state: 'closed',
            projectKey: evalSprint.project_key
          } as any;
        }
      });

      // Eksik sprintler için task verilerini çek
      const missingSprintIds = sprintsToProcess
        .filter(sprint => !sprintTasks || !sprintTasks[sprint.id])
        .map(sprint => sprint.id);

      const additionalSprintTasks: Record<string, JiraTask[]> = {};
      for (const sprintId of missingSprintIds) {
        try {
          const tasks = await supabaseJiraService.getSprintIssues(sprintId);
          additionalSprintTasks[sprintId] = tasks;
        } catch (error) {
          console.error(`❌ Sprint ${sprintId} için task çekilemedi:`, error);
          additionalSprintTasks[sprintId] = [];
        }
      }

      const mergedSprintTasks = {
        ...(sprintTasks || {}),
        ...additionalSprintTasks
      };

      const allClosedSummaries = await supabaseEvaluationService.getAllEvaluationSummaries(
        sprintsToProcess,
        mergedSprintTasks,
        projectNames
      );

      const allEvaluatedSummaries = allClosedSummaries.filter(summary =>
        summary.totalEvaluations > 0 &&
        canAccessProject(summary.projectKey)
      );
      setAllProjectEvaluations(allEvaluatedSummaries);

      const latestSprintPerProject = new Map<string, SprintEvaluationSummary>();

      allEvaluatedSummaries.forEach(summary => {
        const existing = latestSprintPerProject.get(summary.projectKey);
        if (!existing || (summary.endDate && existing.endDate && summary.endDate > existing.endDate)) {
          latestSprintPerProject.set(summary.projectKey, summary);
        }
      });

      const latestSprintSummaries = Array.from(latestSprintPerProject.values());
      setEvaluationSummaries(latestSprintSummaries);
    } catch (error) {
      console.error('Error loading evaluation summaries:', error);
      setEvaluationSummaries([]);
      setAllProjectEvaluations([]);
    } finally {
      setEvaluationsLoading(false);
    }
  }, [sprints, sprintTasks, hasRole, canAccessProject, projectNames]);

  const filteredEvaluationSummaries = useMemo(() =>
    selectedProject === 'all'
      ? evaluationSummaries
      : allProjectEvaluations.filter(summary => summary.projectKey === selectedProject),
    [selectedProject, evaluationSummaries, allProjectEvaluations]
  );

  const handleDeleteEvaluation = useCallback(async (evaluationId: string, evaluatorName: string) => {
    if (!window.confirm(`${evaluatorName} tarafından yapılan değerlendirmeyi silmek istediğinizden emin misiniz?\n\nBu işlem geri alınamaz.`)) {
      return;
    }

    setDeletingEvaluationId(evaluationId);

    try {
      await supabaseEvaluationService.deleteEvaluation(evaluationId);

      // Verileri yenile - mevcut useEffect'i tetikle
      await reloadEvaluationSummaries();

      // Eğer detay popup açıksa, onu da güncelle
      if (selectedSummary) {
        const updatedSummary = (selectedProject === 'all' ? evaluationSummaries : filteredEvaluationSummaries)
          .find(s => s.sprintId === selectedSummary.sprintId);
        if (updatedSummary) {
          setSelectedSummary(updatedSummary);
        } else {
          setSelectedSummary(null); // Eğer tüm değerlendirmeler silinmişse popup'ı kapat
        }
      }

      alert('Değerlendirme başarıyla silindi.');
    } catch (error) {
      console.error('Error deleting evaluation:', error);
      alert('Değerlendirme silinirken hata oluştu: ' + (error instanceof Error ? error.message : 'Bilinmeyen hata'));
    } finally {
      setDeletingEvaluationId(null);
    }
  }, [evaluationSummaries, filteredEvaluationSummaries, selectedProject, selectedSummary, reloadEvaluationSummaries]);

  const availableProjects = useMemo(() =>
    Array.from(new Set(
      allProjectEvaluations.map(summary => summary.projectKey)
    )).map(projectKey => ({
      key: projectKey,
      name: projectNames[projectKey] || projectKey
    })).sort((a, b) => a.name.localeCompare(b.name)),
    [allProjectEvaluations, projectNames]
  );

  const handleExportCSV = async () => {
    try {
      const csvData = await supabaseEvaluationService.exportEvaluationsToCSV();
    const blob = new Blob(['\uFEFF' + csvData], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `sprint_evaluations_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    } catch (error) {
      console.error('Error exporting CSV:', error);
    }
  };

  if (!hasRole('admin')) {
    return (
      <div className="text-center py-12">
        <BarChart3 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-500 text-lg">Bu sayfaya erişim yetkiniz bulunmuyor.</p>
        <p className="text-gray-400 text-sm mt-2">
          Sprint değerlendirmelerini görüntülemek için yönetici yetkisi gereklidir.
        </p>
      </div>
    );
  }

  if (loading || evaluationsLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <div className="text-center">
            <p className="text-lg text-gray-700">Sprint Değerlendirmeleri Yükleniyor...</p>
            <p className="text-sm text-gray-500 mt-1">
              {loading ? 'Jira verisi alınıyor...' : 'Değerlendirme verileri işleniyor...'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Sprint Değerlendirmeleri</h2>
          <p className="text-gray-600 mt-1">Tamamlanan sprintlerin değerlendirme raporları</p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={handleExportCSV}
            className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <Download className="h-4 w-4" />
            <span>CSV İndir</span>
          </button>
        </div>
      </div>

      {/* Project Filter */}
      {availableProjects.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200">
          <div className="flex items-center space-x-4">
            <label className="text-sm font-medium text-gray-700">Proje Filtresi:</label>
            <select
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">Tüm Projeler - Son Sprintler ({evaluationSummaries.length} sprint)</option>
              {availableProjects.map(project => {
                const projectEvaluationCount = allProjectEvaluations.filter(
                  summary => summary.projectKey === project.key
                ).length;
                return (
                  <option key={project.key} value={project.key}>
                    {project.name} ({project.key}) - {projectEvaluationCount} sprint
                  </option>
                );
              })}
            </select>
            {selectedProject !== 'all' && (
              <span className="text-sm text-blue-600 bg-blue-100 px-3 py-1 rounded-full">
                {filteredEvaluationSummaries.length} sprint gösteriliyor
              </span>
            )}
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredEvaluationSummaries.map((summary) => (
          <div key={summary.sprintId} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                <Calendar className="h-5 w-5 text-blue-600" />
                <span className="text-sm font-medium text-blue-600">{summary.projectKey}</span>
              </div>
              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                Kapatıldı
              </span>
            </div>

            <h3 className="text-lg font-semibold text-gray-900 mb-2">{summary.sprintName}</h3>
            <p className="text-sm text-gray-600 mb-4">{summary.projectName}</p>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Sprint Başarısı:</span>
                <div className="flex items-center space-x-2">
                  <span className={`font-medium ${
                    summary.successRate >= 80 ? 'text-green-600' :
                    summary.successRate >= 60 ? 'text-yellow-600' : 'text-red-600'
                  }`}>
                    %{summary.successRate}
                  </span>
                  <div className="w-16 bg-gray-200 rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full ${
                        summary.successRate >= 80 ? 'bg-green-500' :
                        summary.successRate >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                      }`}
                      style={{ width: `${summary.successRate}%` }}
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Değerlendirme:</span>
                <span className="font-medium">{summary.totalEvaluations} kişi</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Ortalama Puan:</span>
                <div className="flex items-center space-x-1">
                  <Star className="h-4 w-4 text-yellow-400 fill-current" />
                  <span className="font-medium">{summary.averageOverallRating}/5</span>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Sprint Puanı:</span>
                <div className="flex items-center space-x-1">
                  <TrendingUp className="h-4 w-4 text-blue-400" />
                  <span className="font-medium">{summary.averageSprintSuccessRating}/5</span>
                </div>
              </div>
            </div>

            {summary.totalEvaluations > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <button
                  onClick={() => setSelectedSummary(summary)}
                  className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Eye className="h-4 w-4" />
                  <span>Detayları Görüntüle</span>
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {filteredEvaluationSummaries.length === 0 && !evaluationsLoading && (
        <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
          <MessageSquare className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500 text-lg">
            {selectedProject === 'all' 
              ? 'Değerlendirme yapılmış sprint bulunamadı.' 
              : 'Seçilen proje için değerlendirme bulunamadı.'
            }
          </p>
          <p className="text-gray-400 text-sm mt-2">
            {selectedProject === 'all'
              ? 'Yalnızca sprintte çalışan ekip üyeleri tarafından değerlendirilen sprint geri bildirimleri gözükür.”'
              : 'Bu proje için henüz değerlendirme yapılmamış.'
            }
          </p>
        </div>
      )}

      {/* Detailed View Modal */}
      {selectedSummary && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-6 border-b border-gray-200">
              <div>
                <h3 className="text-xl font-semibold text-gray-900">
                  {selectedSummary.sprintName} - Değerlendirme Detayları
                </h3>
                <p className="text-sm text-gray-600 mt-1">{selectedSummary.projectName}</p>
              </div>
              <button
                onClick={() => setSelectedSummary(null)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <span className="sr-only">Kapat</span>
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Sprint İstatistikleri */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-blue-50 rounded-lg p-4">
                  <div className="text-2xl font-bold text-blue-600">{selectedSummary.totalTasks}</div>
                  <div className="text-sm text-gray-600">Toplam Görev</div>
                </div>
                <div className="bg-green-50 rounded-lg p-4">
                  <div className="text-2xl font-bold text-green-600">{selectedSummary.completedTasks}</div>
                  <div className="text-sm text-gray-600">Tamamlanan</div>
                </div>
                <div className="bg-purple-50 rounded-lg p-4">
                  <div className="text-2xl font-bold text-purple-600">{selectedSummary.totalEvaluations}</div>
                  <div className="text-sm text-gray-600">Değerlendirme</div>
                </div>
                <div className="bg-yellow-50 rounded-lg p-4">
                  <div className="text-2xl font-bold text-yellow-600">%{selectedSummary.successRate}</div>
                  <div className="text-sm text-gray-600">Başarı Oranı</div>
                </div>
              </div>

              {/* Takım Puanları */}
              {selectedSummary.teamRatings.length > 0 && (
                <div className="bg-white border border-gray-200 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-900 mb-4">Takım Üyesi Puanları</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {selectedSummary.teamRatings.map((rating) => (
                      <div key={rating.memberName} className="bg-gray-50 rounded-lg p-3">
                        <div className="font-medium text-gray-900">{rating.memberName}</div>
                        <div className="flex items-center space-x-2 mt-1">
                          <div className="flex items-center space-x-1">
                            <Star className="h-4 w-4 text-yellow-400 fill-current" />
                            <span className="font-medium">{rating.averageRating}/5</span>
                          </div>
                          <span className="text-sm text-gray-500">({rating.totalRatings} değerlendirme)</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Tüm Değerlendirmeler */}
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <h4 className="font-semibold text-gray-900 mb-4">Tüm Değerlendirmeler</h4>
                <div className="space-y-4">
                  {selectedSummary.evaluations.map((evaluation, index) => (
                    <div key={evaluation.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <span className="font-medium text-gray-900">{evaluation.evaluatorName}</span>
                          <span className="text-sm text-gray-500 ml-2">({evaluation.evaluatorEmail})</span>
                        </div>
                        <div className="flex items-center space-x-4">
                          <div className="flex items-center space-x-1">
                            <Star className="h-4 w-4 text-yellow-400 fill-current" />
                            <span className="text-sm font-medium">{evaluation.overallRating}/5</span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <TrendingUp className="h-4 w-4 text-blue-400" />
                            <span className="text-sm font-medium">{evaluation.sprintSuccessRating}/5</span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="space-y-3">
                        <div>
                          <h5 className="text-sm font-medium text-gray-700">Genel Yorum:</h5>
                          <p className="text-sm text-gray-600 mt-1">{evaluation.generalComment}</p>
                        </div>
                        
                        {evaluation.deficiencies && (
                          <div>
                            <h5 className="text-sm font-medium text-gray-700">Eksiklikler:</h5>
                            <p className="text-sm text-gray-600 mt-1">{evaluation.deficiencies}</p>
                          </div>
                        )}
                        
                        {evaluation.teamMemberRatings.length > 0 && (
                          <div>
                            <h5 className="text-sm font-medium text-gray-700">Takım Üyesi Puanları:</h5>
                            <div className="mt-2 space-y-2">
                              {evaluation.teamMemberRatings.map((rating) => (
                                <div key={rating.memberName} className="bg-gray-50 rounded p-2">
                                  <div className="flex items-center justify-between">
                                    <span className="text-sm font-medium">{rating.memberName}</span>
                                    <div className="flex items-center space-x-1">
                                      <Star className="h-3 w-3 text-yellow-400 fill-current" />
                                      <span className="text-sm">{rating.rating}/5</span>
                                    </div>
                                  </div>
                                  {rating.comment && (
                                    <p className="text-xs text-gray-600 mt-1">{rating.comment}</p>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                      
                      <div className="text-xs text-gray-500 mt-3">
                        Değerlendirme tarihi: {evaluation.createdAt.toLocaleDateString('tr-TR')} {evaluation.createdAt.toLocaleTimeString('tr-TR')}
                      </div>
                      
                      {/* Delete Button for Admins */}
                      <div className="mt-3 pt-3 border-t border-gray-200">
                        <button
                          onClick={() => handleDeleteEvaluation(evaluation.id, evaluation.evaluatorName)}
                          disabled={deletingEvaluationId === evaluation.id}
                          className="flex items-center space-x-2 px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors text-sm"
                        >
                          {deletingEvaluationId === evaluation.id ? (
                            <>
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                              <span>Siliniyor...</span>
                            </>
                          ) : (
                            <> 
                              <Trash2 className="h-4 w-4" />
                              <span>Değerlendirmeyi Sil</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};