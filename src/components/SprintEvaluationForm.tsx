import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { SprintEvaluation, TeamMemberRating } from '../types/evaluation';
import { JiraSprint, JiraTask } from '../types';
import { supabaseEvaluationService } from '../lib/supabaseEvaluationService';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { Star, MessageSquare, Users, AlertTriangle, Save, X, Clock } from 'lucide-react';

interface SprintEvaluationFormProps {
  sprint: JiraSprint;
  sprintTasks: JiraTask[];
  projectName: string;
  onClose: () => void;
  onSubmit: () => void;
}

export const SprintEvaluationForm: React.FC<SprintEvaluationFormProps> = ({
  sprint,
  sprintTasks,
  projectName,
  onClose,
  onSubmit
}) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [projectTeamMembers, setProjectTeamMembers] = useState<string[]>([]);
  const [formData, setFormData] = useState({
    generalComment: '',
    overallRating: 0,
    sprintSuccessRating: 0,
    deficiencies: '',
    teamMemberRatings: [] as TeamMemberRating[]
  });

  const teamMembers: string[] = useMemo(() =>
    Array.from(new Set(
      sprintTasks
        .filter(task => task.assignee !== 'Unassigned' && task.assignee !== user?.name)
        .map(task => task.assignee)
    )).filter(Boolean) as string[],
    [sprintTasks, user?.name]
  );

  const getDynamicProjectTeamMembers = useCallback(async (): Promise<string[]> => {
    if (!user) return [];
    
    try {
      // Supabase'den kullanıcının atandığı projelerdeki diğer kullanıcıları al
      const { data: projectUsers, error } = await supabase
        .from('users')
        .select('name, email, role, assigned_projects')
        .eq('is_active', true)
        .neq('email', user.email); // Kullanıcının kendisi hariç

      if (error) {
        console.error('Error fetching project users:', error);
        return [];
      }

      // Kullanıcının atandığı projeler
      const userProjects = user.assignedProjects || [];
      
      // Eğer kullanıcı admin ise, sprint'teki tüm takım üyelerini döndür
      if (user.role === 'admin') {
        return teamMembers;
      }
      
      // Kullanıcının projelerinde çalışan diğer kullanıcıları bul
      const projectTeamMembers = projectUsers
        .filter(projectUser => {
          // Admin kullanıcıları değerlendirmeden hariç tut
          if (projectUser.role === 'admin') return false;
          
          // Kullanıcının projelerinden en az birinde çalışan kullanıcıları bul
          const userProjectsArray = projectUser.assigned_projects || [];
          return userProjects.some(userProject => 
            userProjectsArray.includes(userProject)
          );
        })
        .map(projectUser => projectUser.name);

      console.log('🔍 Dynamic team members for evaluation:', {
        currentUser: user.name,
        userRole: user.role,
        userProjects,
        sprintProject: sprint.projectKey,
        foundTeamMembers: projectTeamMembers
      });

      return projectTeamMembers;
    } catch (error) {
      console.error('Error getting dynamic team members:', error);
      return [];
    }
  }, [user, teamMembers, sprint.projectKey]);

  // Component mount olduğunda takım üyelerini yükle
  useEffect(() => {
    const loadTeamMembers = async () => {
      const members = await getDynamicProjectTeamMembers();
      setProjectTeamMembers(members);
    };
    
    if (user) {
      loadTeamMembers();
    }
  }, [user, sprint.projectKey]);

  // Değerlendirilebilir üyeler
  const allEvaluatableMembers = projectTeamMembers;

  useEffect(() => {
    const initialRatings: TeamMemberRating[] = allEvaluatableMembers.map(member => ({
      memberName: member,
      memberEmail: `${member.toLowerCase().replace(/\s+/g, '.')}@company.com`,
      rating: 0,
      comment: ''
    }));

    setFormData(prev => ({
      ...prev,
      teamMemberRatings: initialRatings
    }));
  }, [allEvaluatableMembers.join(',')]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) return;
    
    console.log('🚀 Starting evaluation submission...');
    console.log('👤 Current user:', user);
    
    // Validasyon
    if (formData.overallRating === 0) {
      alert('Lütfen genel değerlendirme puanı verin.');
      return;
    }
    
    if (formData.sprintSuccessRating === 0) {
      alert('Lütfen sprint başarı puanı verin.');
      return;
    }
    
    if (!formData.generalComment.trim()) {
      alert('Lütfen genel değerlendirme yorumu yazın.');
      return;
    }
    
    // Takım üyesi puanları kontrolü
    const unratedMembers = formData.teamMemberRatings.filter(rating => rating.rating === 0);
    if (unratedMembers.length > 0) {
      const confirm = window.confirm(
        `${unratedMembers.length} takım üyesine puan vermediniz. Devam etmek istiyor musunuz?`
      );
      if (!confirm) return;
    }
    
    setLoading(true);
    
    try {
      const evaluation: Omit<SprintEvaluation, 'id' | 'createdAt' | 'updatedAt'> = {
        sprintId: sprint.id,
        sprintName: sprint.name,
        projectKey: sprint.projectKey || '',
        evaluatorId: user.id,
        evaluatorName: user.name,
        evaluatorEmail: user.email,
        generalComment: formData.generalComment.trim(),
        overallRating: formData.overallRating,
        sprintSuccessRating: formData.sprintSuccessRating,
        deficiencies: formData.deficiencies.trim(),
        teamMemberRatings: formData.teamMemberRatings.filter(rating => rating.rating > 0),
        isAnonymous: true
      };
      
      console.log('📝 Evaluation data to save:', evaluation);
      
      await supabaseEvaluationService.saveEvaluation(evaluation);
      
      console.log('✅ Evaluation saved successfully');
      alert('Değerlendirmeniz başarıyla kaydedildi!');
      onSubmit();
      onClose();
    } catch (error) {
      console.error('Değerlendirme kaydedilirken hata:', error);
      
      // Daha detaylı hata mesajı
      let errorMessage = 'Değerlendirme kaydedilirken hata oluştu.';
      if (error instanceof Error) {
        if (error.message.includes('row-level security')) {
          errorMessage = 'Yetki hatası: Değerlendirme kaydetme izniniz bulunmuyor. Lütfen giriş yapıp tekrar deneyin.';
        } else if (error.message.includes('duplicate key')) {
          errorMessage = 'Bu sprint için zaten değerlendirme yapmışsınız.';
        } else {
          errorMessage = `Hata: ${error.message}`;
        }
      }
      
      alert(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const updateTeamMemberRating = (memberName: string, field: 'rating' | 'comment', value: number | string) => {
    setFormData(prev => ({
      ...prev,
      teamMemberRatings: prev.teamMemberRatings.map(rating =>
        rating.memberName === memberName
          ? { ...rating, [field]: value }
          : rating
      )
    }));
  };

  const StarRating: React.FC<{ 
    rating: number; 
    onRatingChange: (rating: number) => void;
    size?: 'sm' | 'md' | 'lg';
  }> = ({ rating, onRatingChange, size = 'md' }) => {
    const sizeClasses = {
      sm: 'h-4 w-4',
      md: 'h-5 w-5',
      lg: 'h-6 w-6'
    };
    
    return (
      <div className="flex space-x-1">
        {[1, 2, 3, 4, 5].map(star => (
          <button
            key={star}
            type="button"
            onClick={() => onRatingChange(star)}
            className={`${sizeClasses[size]} transition-colors ${
              star <= rating 
                ? 'text-yellow-400 fill-current' 
                : 'text-gray-300 hover:text-yellow-300'
            }`}
          >
            <Star className="w-full h-full" />
          </button>
        ))}
      </div>
    );
  };

  // Değerlendirme süresi kontrolü
  const isEvaluationActive = supabaseEvaluationService.isEvaluationActive(sprint);

  if (!isEvaluationActive) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
          <div className="p-6 text-center">
            <Clock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Değerlendirme Yapılamaz
            </h3>
            <p className="text-gray-600 mb-4">
              Bu sprint henüz kapatılmamış veya değerlendirme yapılamaz.
            </p>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              Kapat
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center p-6 border-b border-gray-200">
          <div>
            <h3 className="text-xl font-semibold text-gray-900">Sprint Değerlendirmesi</h3>
            <p className="text-sm text-gray-600 mt-1">
              {sprint.name} - {projectName}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Genel Değerlendirme */}
          <div className="bg-blue-50 rounded-lg p-4">
            <div className="flex items-center space-x-2 mb-3">
              <MessageSquare className="h-5 w-5 text-blue-600" />
              <h4 className="font-medium text-gray-900">Genel Değerlendirme</h4>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Genel Puan *
                </label>
                <div className="flex items-center space-x-3">
                  <StarRating 
                    rating={formData.overallRating}
                    onRatingChange={(rating) => setFormData(prev => ({ ...prev, overallRating: rating }))}
                    size="lg"
                  />
                  <span className="text-sm text-gray-600">
                    {formData.overallRating > 0 ? `${formData.overallRating}/5` : 'Puan verin'}
                  </span>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Sprint Başarı Puanı *
                </label>
                <div className="flex items-center space-x-3">
                  <StarRating 
                    rating={formData.sprintSuccessRating}
                    onRatingChange={(rating) => setFormData(prev => ({ ...prev, sprintSuccessRating: rating }))}
                    size="lg"
                  />
                  <span className="text-sm text-gray-600">
                    {formData.sprintSuccessRating > 0 ? `${formData.sprintSuccessRating}/5` : 'Puan verin'}
                  </span>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Genel Yorum *
                </label>
                <textarea
                  required
                  value={formData.generalComment}
                  onChange={(e) => setFormData(prev => ({ ...prev, generalComment: e.target.value }))}
                  rows={4}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Sprint hakkında genel değerlendirmenizi yazın..."
                />
              </div>
            </div>
          </div>

          {/* Takım Arkadaşları Değerlendirmesi */}
          {allEvaluatableMembers.length > 0 && (
            <div className="bg-green-50 rounded-lg p-4">
              <div className="flex items-center space-x-2 mb-3">
                <Users className="h-5 w-5 text-green-600" />
                <h4 className="font-medium text-gray-900">Takım Arkadaşları ve Analist Değerlendirmesi</h4>
              </div>
              
              <div className="space-y-4">
                {formData.teamMemberRatings.map((rating, index) => (
                  <div key={rating.memberName} className="bg-white rounded-lg p-4 border border-gray-200">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-2">
                        <h5 className="font-medium text-gray-900">{rating.memberName}</h5>
                        {rating.memberName === 'Ahmet Korkusuz' && (
                          <span className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded-full">
                            Analist
                          </span>
                        )}
                      </div>
                      <div className="flex items-center space-x-2">
                        <StarRating 
                          rating={rating.rating}
                          onRatingChange={(newRating) => updateTeamMemberRating(rating.memberName, 'rating', newRating)}
                        />
                        <span className="text-sm text-gray-600">
                          {rating.rating > 0 ? `${rating.rating}/5` : 'Puan verin'}
                        </span>
                      </div>
                    </div>
                    <textarea
                      value={rating.comment}
                      onChange={(e) => updateTeamMemberRating(rating.memberName, 'comment', e.target.value)}
                      rows={2}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      placeholder={`${rating.memberName} hakkında yorumunuz (isteğe bağlı)...`}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Eksiklikler */}
          <div className="bg-orange-50 rounded-lg p-4">
            <div className="flex items-center space-x-2 mb-3">
              <AlertTriangle className="h-5 w-5 text-orange-600" />
              <h4 className="font-medium text-gray-900">Eksiklikler ve İyileştirme Önerileri</h4>
            </div>
            
            <textarea
              value={formData.deficiencies}
              onChange={(e) => setFormData(prev => ({ ...prev, deficiencies: e.target.value }))}
              rows={4}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              placeholder="Sprint sürecinde gözlemlediğiniz eksiklikleri ve iyileştirme önerilerinizi yazın..."
            />
          </div>

          {/* Form Actions */}
          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              İptal
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center space-x-2"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Kaydediliyor...</span>
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  <span>Değerlendirmeyi Kaydet</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};