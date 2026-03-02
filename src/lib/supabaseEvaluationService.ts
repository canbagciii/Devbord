import { supabase } from './supabase';
import { SprintEvaluation, SprintEvaluationSummary, TeamMemberRating } from '../types/evaluation';
import { JiraSprint, JiraTask } from '../types';
import { Database } from './database.types';

type SprintEvaluationRow = Database['public']['Tables']['sprint_evaluations']['Row'];
type SprintEvaluationInsert = Database['public']['Tables']['sprint_evaluations']['Insert'];
type SprintEvaluationUpdate = Database['public']['Tables']['sprint_evaluations']['Update'];
type TeamMemberRatingRow = Database['public']['Tables']['team_member_ratings']['Row'];
type TeamMemberRatingInsert = Database['public']['Tables']['team_member_ratings']['Insert'];

// Convert database row to SprintEvaluation type
const convertToSprintEvaluation = (
  row: SprintEvaluationRow, 
  teamRatings: TeamMemberRatingRow[] = []
): SprintEvaluation => ({
  id: row.id,
  sprintId: row.sprint_id,
  sprintName: row.sprint_name,
  projectKey: row.project_key,
  evaluatorId: row.evaluator_id,
  evaluatorName: row.evaluator_name,
  evaluatorEmail: row.evaluator_email,
  generalComment: row.general_comment,
  overallRating: row.overall_rating,
  sprintSuccessRating: row.sprint_success_rating,
  deficiencies: row.deficiencies || '',
  isAnonymous: row.is_anonymous,
  createdAt: new Date(row.created_at),
  updatedAt: new Date(row.updated_at),
  teamMemberRatings: teamRatings.map(rating => ({
    memberName: rating.member_name,
    memberEmail: rating.member_email,
    rating: rating.rating,
    comment: rating.comment || ''
  }))
});

// Convert SprintEvaluation to database insert format
const convertToInsert = (evaluation: Omit<SprintEvaluation, 'id' | 'createdAt' | 'updatedAt'>): SprintEvaluationInsert => ({
  sprint_id: evaluation.sprintId,
  sprint_name: evaluation.sprintName,
  project_key: evaluation.projectKey,
  evaluator_id: evaluation.evaluatorId,
  evaluator_name: evaluation.evaluatorName,
  evaluator_email: evaluation.evaluatorEmail,
  general_comment: evaluation.generalComment,
  overall_rating: evaluation.overallRating,
  sprint_success_rating: evaluation.sprintSuccessRating,
  deficiencies: evaluation.deficiencies || null,
  is_anonymous: evaluation.isAnonymous
});

class SupabaseEvaluationService {
  // Sprint için değerlendirme süresi aktif mi?
  isEvaluationActive(sprint: JiraSprint): boolean {
    return sprint.state === 'closed';
  }

  // Kullanıcının bu sprint için değerlendirme yapıp yapmadığını kontrol et
  async hasUserEvaluated(sprintId: string, userEmail: string): Promise<boolean> {
    try {
      const { data, error, count } = await supabase
        .from('sprint_evaluations')
        .select('id', { count: 'exact' })
        .eq('sprint_id', sprintId)
        .eq('evaluator_email', userEmail);

      if (error) {
        throw error;
      }

      return (count || 0) > 0;
    } catch (error) {
      console.error('Error checking user evaluation:', error);
      return false;
    }
  }

  // Değerlendirme kaydet
  async saveEvaluation(evaluation: Omit<SprintEvaluation, 'id' | 'createdAt' | 'updatedAt'>): Promise<SprintEvaluation> {
    try {
      console.log('🚀 Saving evaluation:', evaluation);
      
      // Ana değerlendirmeyi kaydet
      const evaluationInsert = convertToInsert(evaluation);
      console.log('📝 Insert data:', evaluationInsert);
      
      const { data: evaluationData, error: evaluationError } = await supabase
        .from('sprint_evaluations')
        .insert([evaluationInsert])
        .select()
        .single();

      if (evaluationError) {
        console.error('❌ Evaluation insert error:', evaluationError);
        throw evaluationError;
      }
      
      console.log('✅ Evaluation saved:', evaluationData);

      // Takım üyesi puanlarını kaydet
      if (evaluation.teamMemberRatings.length > 0) {
        console.log('👥 Saving team member ratings...');
        const teamRatingsInsert: TeamMemberRatingInsert[] = evaluation.teamMemberRatings.map(rating => ({
          evaluation_id: evaluationData.id,
          member_name: rating.memberName,
          member_email: rating.memberEmail,
          rating: rating.rating,
          comment: rating.comment || null
        }));

        console.log('📝 Team ratings insert data:', teamRatingsInsert);
        
        const { error: ratingsError } = await supabase
          .from('team_member_ratings')
          .insert(teamRatingsInsert);

        if (ratingsError) {
          console.error('❌ Team ratings insert error:', ratingsError);
          throw ratingsError;
        }
        
        console.log('✅ Team ratings saved');
      }

      // Tam veriyi geri döndür
      return await this.getEvaluationById(evaluationData.id);
    } catch (error) {
      console.error('Error saving evaluation:', error);
      throw error;
    }
  }

  // Değerlendirmeyi güncelle
  async updateEvaluation(evaluationId: string, updatedData: Partial<SprintEvaluation>): Promise<SprintEvaluation> {
    try {
      // Ana değerlendirmeyi güncelle
      const updateData: SprintEvaluationUpdate = {
        ...(updatedData.generalComment && { general_comment: updatedData.generalComment }),
        ...(updatedData.overallRating && { overall_rating: updatedData.overallRating }),
        ...(updatedData.sprintSuccessRating && { sprint_success_rating: updatedData.sprintSuccessRating }),
        ...(updatedData.deficiencies !== undefined && { deficiencies: updatedData.deficiencies || null }),
        updated_at: new Date().toISOString()
      };

      const { error: evaluationError } = await supabase
        .from('sprint_evaluations')
        .update(updateData)
        .eq('id', evaluationId);

      if (evaluationError) throw evaluationError;

      // Takım üyesi puanlarını güncelle
      if (updatedData.teamMemberRatings) {
        // Önce mevcut puanları sil
        await supabase
          .from('team_member_ratings')
          .delete()
          .eq('evaluation_id', evaluationId);

        // Yeni puanları ekle
        if (updatedData.teamMemberRatings.length > 0) {
          const teamRatingsInsert: TeamMemberRatingInsert[] = updatedData.teamMemberRatings.map(rating => ({
            evaluation_id: evaluationId,
            member_name: rating.memberName,
            member_email: rating.memberEmail,
            rating: rating.rating,
            comment: rating.comment || null
          }));

          const { error: ratingsError } = await supabase
            .from('team_member_ratings')
            .insert(teamRatingsInsert);

          if (ratingsError) throw ratingsError;
        }
      }

      // Güncellenmiş veriyi geri döndür
      return await this.getEvaluationById(evaluationId);
    } catch (error) {
      console.error('Error updating evaluation:', error);
      throw error;
    }
  }

  // ID ile değerlendirme getir
  async getEvaluationById(evaluationId: string): Promise<SprintEvaluation> {
    try {
      const { data: evaluationData, error: evaluationError } = await supabase
        .from('sprint_evaluations')
        .select('*')
        .eq('id', evaluationId)
        .single();

      if (evaluationError) throw evaluationError;

      const { data: ratingsData, error: ratingsError } = await supabase
        .from('team_member_ratings')
        .select('*')
        .eq('evaluation_id', evaluationId);

      if (ratingsError) throw ratingsError;

      return convertToSprintEvaluation(evaluationData, ratingsData || []);
    } catch (error) {
      console.error('Error getting evaluation by ID:', error);
      throw error;
    }
  }

  // Kullanıcının değerlendirmelerini getir
  async getUserEvaluations(userEmail: string): Promise<SprintEvaluation[]> {
    try {
      const { data: evaluationsData, error: evaluationsError } = await supabase
        .from('sprint_evaluations')
        .select(`
          *,
          team_member_ratings (*)
        `)
        .eq('evaluator_email', userEmail)
        .order('created_at', { ascending: false });

      if (evaluationsError) throw evaluationsError;

      const evaluations: SprintEvaluation[] = (evaluationsData || []).map((evaluation: any) =>
        convertToSprintEvaluation(evaluation, evaluation.team_member_ratings || [])
      );

      return evaluations;
    } catch (error) {
      console.error('Error getting user evaluations:', error);
      throw error;
    }
  }

  // Sprint özeti getir
  async getSprintEvaluationSummary(
    sprintId: string,
    sprintName: string,
    projectKey: string,
    projectName: string,
    sprint: JiraSprint,
    sprintTasks: JiraTask[],
    isAdmin: boolean = false
  ): Promise<SprintEvaluationSummary> {
    try {
      const { data: evaluationsData, error: evaluationsError } = await supabase
        .from('sprint_evaluations')
        .select(`
          *,
          team_member_ratings (*)
        `)
        .eq('sprint_id', sprintId);

      if (evaluationsError) throw evaluationsError;

      const evaluations: SprintEvaluation[] = (evaluationsData || []).map((evaluation: any) =>
        convertToSprintEvaluation(evaluation, evaluation.team_member_ratings || [])
      );

      // Sprint istatistikleri
      const totalTasks = sprintTasks.length;
      const completedTasks = sprintTasks.filter(task => {
        const status = task.status.toLowerCase();
        return status === 'done' || status === 'tamam' || status === 'uat' || 
               status === 'tamamlandı' || status === 'completed' || status === 'closed' ||
               status === 'resolved' || status.includes('done') || status.includes('tamam') || status.includes('uat');
      }).length;
      const successRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
      
      // Değerlendirme istatistikleri
      const totalEvaluations = evaluations.length;
      const averageOverallRating = totalEvaluations > 0 
        ? Math.round((evaluations.reduce((sum, evaluation) => sum + evaluation.overallRating, 0) / totalEvaluations) * 10) / 10
        : 0;
      const averageSprintSuccessRating = totalEvaluations > 0
        ? Math.round((evaluations.reduce((sum, evaluation) => sum + evaluation.sprintSuccessRating, 0) / totalEvaluations) * 10) / 10
        : 0;
      
      // Takım değerlendirmeleri
      const teamRatingsMap = new Map<string, { totalRating: number; count: number }>();
      
      evaluations.forEach(evaluation => {
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
        evaluations: isAdmin ? evaluations : [], // Sadece admin tüm değerlendirmeleri görebilir
        startDate: sprint.startDate,
        endDate: sprint.endDate,
        evaluationDeadline: undefined,
        isEvaluationActive: this.isEvaluationActive(sprint)
      };
    } catch (error) {
      console.error('Error getting sprint evaluation summary:', error);
      throw error;
    }
  }

  // Tüm değerlendirme özetlerini getir (admin için)
  // Veritabanından değerlendirmesi olan TÜM sprintleri getir
  async getAllEvaluatedSprints(): Promise<Array<{ sprint_id: string; sprint_name: string; project_key: string }>> {
    const { data, error } = await supabase
      .from('sprint_evaluations')
      .select('sprint_id, sprint_name, project_key')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Error fetching evaluated sprints:', error);
      throw error;
    }

    // Unique sprint listesi oluştur
    const uniqueSprints = new Map<string, { sprint_id: string; sprint_name: string; project_key: string }>();
    (data || []).forEach((item: any) => {
      if (!uniqueSprints.has(item.sprint_id)) {
        uniqueSprints.set(item.sprint_id, {
          sprint_id: item.sprint_id,
          sprint_name: item.sprint_name,
          project_key: item.project_key
        });
      }
    });

    const result = Array.from(uniqueSprints.values());
    console.log('📊 Değerlendirmesi olan sprint sayısı:', result.length);
    return result;
  }

  async getAllEvaluationSummaries(
    sprints: JiraSprint[],
    sprintTasks: Record<string, JiraTask[]>,
    projectNames: Record<string, string>
  ): Promise<SprintEvaluationSummary[]> {
    const sprintIds = sprints.map(s => s.id);

    console.log('🔍 Searching evaluations for sprint IDs:', sprintIds);

    const { data: allEvaluationsData, error: evaluationsError } = await supabase
      .from('sprint_evaluations')
      .select(`
        *,
        team_member_ratings (*)
      `)
      .in('sprint_id', sprintIds);

    if (evaluationsError) throw evaluationsError;

    console.log('📋 Found evaluations in DB:', allEvaluationsData?.length || 0);
    if (allEvaluationsData && allEvaluationsData.length > 0) {
      console.log('📌 Sprint IDs in DB:', allEvaluationsData.map((e: any) => e.sprint_id));
    }

    const evaluationsBySprintId = new Map<string, SprintEvaluation[]>();

    (allEvaluationsData || []).forEach((evaluation: any) => {
      const sprintEval = convertToSprintEvaluation(evaluation, evaluation.team_member_ratings || []);
      const existing = evaluationsBySprintId.get(evaluation.sprint_id) || [];
      evaluationsBySprintId.set(evaluation.sprint_id, [...existing, sprintEval]);
    });

    const summaries: SprintEvaluationSummary[] = [];

    for (const sprint of sprints) {
      const tasks = sprintTasks[sprint.id] || [];
      const projectName = projectNames[sprint.projectKey || ''] || sprint.projectKey || 'Unknown';
      const evaluations = evaluationsBySprintId.get(sprint.id) || [];

      const totalTasks = tasks.length;
      const completedTasks = tasks.filter(task => {
        const status = task.status.toLowerCase();
        return status === 'done' || status === 'tamam' || status === 'uat' ||
               status === 'tamamlandı' || status === 'completed' || status === 'closed' ||
               status === 'resolved' || status.includes('done') || status.includes('tamam') || status.includes('uat');
      }).length;
      const successRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

      if (totalTasks === 0) {
        console.log(`⚠️ Sprint ${sprint.name} (${sprint.id}) için task verisi yok - başarı oranı hesaplanamıyor`);
      } else {
        console.log(`✅ Sprint ${sprint.name}: ${completedTasks}/${totalTasks} task tamamlanmış (${successRate}%)`);
      }

      const totalEvaluations = evaluations.length;
      const averageOverallRating = totalEvaluations > 0
        ? Math.round((evaluations.reduce((sum, evaluation) => sum + evaluation.overallRating, 0) / totalEvaluations) * 10) / 10
        : 0;
      const averageSprintSuccessRating = totalEvaluations > 0
        ? Math.round((evaluations.reduce((sum, evaluation) => sum + evaluation.sprintSuccessRating, 0) / totalEvaluations) * 10) / 10
        : 0;

      const teamRatingsMap = new Map<string, { totalRating: number; count: number }>();

      evaluations.forEach(evaluation => {
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

      summaries.push({
        sprintId: sprint.id,
        sprintName: sprint.name,
        projectKey: sprint.projectKey || '',
        projectName,
        totalTasks,
        completedTasks,
        successRate,
        totalEvaluations,
        averageOverallRating,
        averageSprintSuccessRating,
        teamRatings,
        evaluations,
        startDate: sprint.startDate,
        endDate: sprint.endDate,
        evaluationDeadline: undefined,
        isEvaluationActive: this.isEvaluationActive(sprint)
      });
    }

    return summaries;
  }

  // CSV export için veri hazırla
  async exportEvaluationsToCSV(): Promise<string> {
    try {
      const { data: evaluationsData, error: evaluationsError } = await supabase
        .from('sprint_evaluations')
        .select(`
          *,
          team_member_ratings (*)
        `)
        .order('created_at', { ascending: false });

      if (evaluationsError) throw evaluationsError;

      if (!evaluationsData || evaluationsData.length === 0) {
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
      
      const rows = evaluationsData.map((evaluation: any) => [
        evaluation.sprint_name,
        evaluation.project_key,
        evaluation.evaluator_name,
        evaluation.evaluator_email,
        `"${evaluation.general_comment.replace(/"/g, '""')}"`,
        evaluation.overall_rating,
        evaluation.sprint_success_rating,
        `"${(evaluation.deficiencies || '').replace(/"/g, '""')}"`,
        `"${(evaluation.team_member_ratings || []).map((rating: any) => 
          `${rating.member_name}: ${rating.rating}/5 - ${rating.comment || ''}`
        ).join('; ')}"`,
        new Date(evaluation.created_at).toLocaleDateString('tr-TR')
      ]);
      
      return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    } catch (error) {
      console.error('Error exporting evaluations to CSV:', error);
      throw error;
    }
  }

  // Değerlendirme verilerini temizle (test amaçlı)
  async clearAllEvaluations(): Promise<void> {
    try {
      await supabase.from('team_member_ratings').delete().neq('id', '');
      await supabase.from('sprint_evaluations').delete().neq('id', '');
    } catch (error) {
      console.error('Error clearing evaluations:', error);
      throw error;
    }
  }

  // Değerlendirme sil
  async deleteEvaluation(evaluationId: string): Promise<void> {
    try {
      // Önce takım üyesi puanlarını sil
      const { error: ratingsError } = await supabase
        .from('team_member_ratings')
        .delete()
        .eq('evaluation_id', evaluationId);

      if (ratingsError) {
        console.error('Error deleting team member ratings:', ratingsError);
        throw ratingsError;
      }

      // Sonra ana değerlendirmeyi sil
      const { error: evaluationError } = await supabase
        .from('sprint_evaluations')
        .delete()
        .eq('id', evaluationId);

      if (evaluationError) {
        console.error('Error deleting evaluation:', evaluationError);
        throw evaluationError;
      }

      console.log(`✅ Evaluation ${evaluationId} deleted successfully`);
    } catch (error) {
      console.error('Error deleting evaluation:', error);
      throw error;
    }
  }
}

export const supabaseEvaluationService = new SupabaseEvaluationService();