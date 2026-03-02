import { SprintEvaluation, SprintEvaluationSummary, TeamMemberRating } from '../types/evaluation';
import { JiraSprint, JiraTask } from '../types';

class EvaluationService {
  private readonly STORAGE_KEY = 'sprint-evaluations';
  private readonly EVALUATION_PERIOD_DAYS = 3;

  // Değerlendirmeleri localStorage'dan yükle
  private loadEvaluations(): SprintEvaluation[] {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (!stored) return [];
      
      const parsed = JSON.parse(stored);
      return parsed.map((evaluation: any) => ({
        ...evaluation,
        createdAt: new Date(evaluation.createdAt),
        updatedAt: new Date(evaluation.updatedAt)
      }));
    } catch (error) {
      console.error('Error loading evaluations:', error);
      return [];
    }
  }

  // Değerlendirmeleri localStorage'a kaydet
  private saveEvaluations(evaluations: SprintEvaluation[]): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(evaluations));
    } catch (error) {
      console.error('Error saving evaluations:', error);
    }
  }

  // Sprint için değerlendirme süresi aktif mi?
  isEvaluationActive(sprint: JiraSprint): boolean {
    // Sprint kapatıldıysa her zaman değerlendirme yapılabilir
    return sprint.state === 'closed';
  }

  // Kullanıcının bu sprint için değerlendirme yapıp yapmadığını kontrol et
  hasUserEvaluated(sprintId: string, userEmail: string): boolean {
    const evaluations = this.loadEvaluations();
    return evaluations.some(evaluation => 
      evaluation.sprintId === sprintId && evaluation.evaluatorEmail === userEmail
    );
  }

  // Değerlendirme kaydet
  saveEvaluation(evaluation: Omit<SprintEvaluation, 'id' | 'createdAt' | 'updatedAt'>): SprintEvaluation {
    const evaluations = this.loadEvaluations();
    
    const newEvaluation: SprintEvaluation = {
      ...evaluation,
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      createdAt: new Date(),
      updatedAt: new Date(),
      isAnonymous: true
    };
    
    evaluations.push(newEvaluation);
    this.saveEvaluations(evaluations);
    
    return newEvaluation;
  }

  // Değerlendirmeyi güncelle
  updateEvaluation(updatedEvaluation: SprintEvaluation): void {
    const evaluations = this.loadEvaluations();
    const index = evaluations.findIndex(evaluation => evaluation.id === updatedEvaluation.id);
    
    if (index !== -1) {
      evaluations[index] = updatedEvaluation;
      this.saveEvaluations(evaluations);
    }
  }

  // Kullanıcının değerlendirmelerini getir (sadece kendi değerlendirmeleri)
  getUserEvaluations(userEmail: string): SprintEvaluation[] {
    const evaluations = this.loadEvaluations();
    return evaluations.filter(evaluation => evaluation.evaluatorEmail === userEmail);
  }

  // Sprint özeti getir (admin için tüm veriler, diğerleri için sınırlı)
  getSprintEvaluationSummary(
    sprintId: string, 
    sprintName: string, 
    projectKey: string, 
    projectName: string,
    sprint: JiraSprint,
    sprintTasks: JiraTask[],
    isAdmin: boolean = false
  ): SprintEvaluationSummary {
    const evaluations = this.loadEvaluations();
    const sprintEvaluations = evaluations.filter(evaluation => evaluation.sprintId === sprintId);
    
    // Sprint istatistikleri
    const totalTasks = sprintTasks.length;
    const completedTasks = sprintTasks.filter(task => {
      const status = task.status.toLowerCase();
      return status === 'done' || status === 'tamam' || status === 'uat' || 
             status === 'tamamlandı' || status === 'completed' || status === 'closed' ||
             status === 'resolved' || status.includes('done') || status.includes('tamam');
    }).length;
    const successRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
    
    // Değerlendirme istatistikleri
    const totalEvaluations = sprintEvaluations.length;
    const averageOverallRating = totalEvaluations > 0 
      ? Math.round((sprintEvaluations.reduce((sum, evaluation) => sum + evaluation.overallRating, 0) / totalEvaluations) * 10) / 10
      : 0;
    const averageSprintSuccessRating = totalEvaluations > 0
      ? Math.round((sprintEvaluations.reduce((sum, evaluation) => sum + evaluation.sprintSuccessRating, 0) / totalEvaluations) * 10) / 10
      : 0;
    
    // Takım değerlendirmeleri
    const teamRatingsMap = new Map<string, { totalRating: number; count: number }>();
    
    sprintEvaluations.forEach(evaluation => {
      evaluation.teamMemberRatings.forEach(rating => {
        const existing = teamRatingsMap.get(rating.memberName) || { totalRating: 0, count: 0 };
        teamRatingsMap.set(rating.memberName, {
          totalRating: existing.totalRating + rating.rating,
          count: existing.count + 1
        });
      });
    });
    
    const teamRatings = Array.from(teamRatingsMap.entries()).map(([memberName, data]) => ({
      memberName,
      averageRating: Math.round((data.totalRating / data.count) * 10) / 10,
      totalRatings: data.count
    }));
    
    // Değerlendirme süresi
    
    return {
      sprintId,
      sprintName,
      projectKey,
      projectName,
      totalTasks,
      completedTasks,
      successRate,
      totalEvaluations,
      averageOverallRating,
      averageSprintSuccessRating,
      teamRatings,
      evaluations: isAdmin ? sprintEvaluations : [], // Sadece admin tüm değerlendirmeleri görebilir
      startDate: sprint.startDate,
      endDate: sprint.endDate,
      evaluationDeadline: undefined,
      isEvaluationActive: this.isEvaluationActive(sprint)
    };
  }

  // Tüm değerlendirme özetlerini getir (admin için)
  getAllEvaluationSummaries(
    sprints: JiraSprint[],
    sprintTasks: Record<string, JiraTask[]>,
    projectNames: Record<string, string>
  ): SprintEvaluationSummary[] {
    return sprints.map(sprint => {
      const tasks = sprintTasks[sprint.id] || [];
      const projectName = projectNames[sprint.projectKey || ''] || sprint.projectKey || 'Unknown';
      
      return this.getSprintEvaluationSummary(
        sprint.id,
        sprint.name,
        sprint.projectKey || '',
        projectName,
        sprint,
        tasks,
        true // Admin için tüm veriler
      );
    });
  }

  // CSV export için veri hazırla
  exportEvaluationsToCSV(): string {
    const evaluations = this.loadEvaluations();
    
    if (evaluations.length === 0) {
      return 'Değerlendirme bulunamadı.';
    }
    
    const headers = [
      'Sprint Adı',
      'Proje',
      'Değerlendiren',
      'E-posta',
      'Genel Yorum',
      'Genel Puan',
      'Sprint Başarı Puanı',
      'Eksiklikler',
      'Takım Üyesi Puanları',
      'Değerlendirme Tarihi'
    ];
    
    const rows = evaluations.map(evaluation => [
      evaluation.sprintName,
      evaluation.projectKey,
      evaluation.evaluatorName,
      evaluation.evaluatorEmail,
      `"${evaluation.generalComment.replace(/"/g, '""')}"`,
      evaluation.overallRating,
      evaluation.sprintSuccessRating,
      `"${evaluation.deficiencies.replace(/"/g, '""')}"`,
      `"${evaluation.teamMemberRatings.map(rating => 
        `${rating.memberName}: ${rating.rating}/5 - ${rating.comment}`
      ).join('; ')}"`,
      evaluation.createdAt.toLocaleDateString('tr-TR')
    ]);
    
    return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
  }

  // Değerlendirme verilerini temizle (test amaçlı)
  clearAllEvaluations(): void {
    localStorage.removeItem(this.STORAGE_KEY);
  }
}

export const evaluationService = new EvaluationService();