export interface SprintEvaluation {
  id: string;
  sprintId: string;
  sprintName: string;
  projectKey: string;
  evaluatorId: string;
  evaluatorName: string;
  evaluatorEmail: string;
  
  // Genel değerlendirme
  generalComment: string;
  overallRating: number; // 1-5 arası
  
  // Takım arkadaşları değerlendirmesi
  teamMemberRatings: TeamMemberRating[];
  
  // Eksiklikler
  deficiencies: string;
  
  // Sprint başarı değerlendirmesi
  sprintSuccessRating: number; // 1-5 arası
  
  // Meta bilgiler
  createdAt: Date;
  updatedAt: Date;
  isAnonymous: boolean;
}

export interface TeamMemberRating {
  memberName: string;
  memberEmail: string;
  rating: number; // 1-5 arası
  comment: string;
}

export interface SprintEvaluationSummary {
  sprintId: string;
  sprintName: string;
  projectKey: string;
  projectName: string;
  
  // Sprint istatistikleri
  totalTasks: number;
  completedTasks: number;
  successRate: number;
  
  // Değerlendirme istatistikleri
  totalEvaluations: number;
  averageOverallRating: number;
  averageSprintSuccessRating: number;
  
  // Takım değerlendirmeleri
  teamRatings: {
    memberName: string;
    averageRating: number;
    totalRatings: number;
  }[];
  
  // Tüm değerlendirmeler (sadece admin görebilir)
  evaluations: SprintEvaluation[];
  
  // Sprint tarihleri
  startDate?: string;
  endDate?: string;
  evaluationDeadline?: Date;
  isEvaluationActive: boolean;
}