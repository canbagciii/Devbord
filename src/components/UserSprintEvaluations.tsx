import React, { useState, useEffect, useMemo } from 'react';
import { SprintEvaluation } from '../types/evaluation';
import { supabaseEvaluationService } from '../lib/supabaseEvaluationService';
import { useAuth } from '../context/AuthContext';
import { Star, MessageSquare, Edit, Calendar, Users, AlertTriangle, Save, X } from 'lucide-react';
import { SprintEvaluationForm } from './SprintEvaluationForm';
import { useJiraData } from '../context/JiraDataContext';

export const UserSprintEvaluations: React.FC = () => {
  const { user } = useAuth();
  const { sprints, sprintTasks } = useJiraData();
  const [userEvaluations, setUserEvaluations] = useState<SprintEvaluation[]>([]);
  const [editingEvaluation, setEditingEvaluation] = useState<SprintEvaluation | null>(null);

  useEffect(() => {
    if (user) {
      const loadEvaluations = async () => {
        try {
          const evaluations = await supabaseEvaluationService.getUserEvaluations(user.email);
          setUserEvaluations(evaluations);
        } catch (error) {
          console.error('Error loading user evaluations:', error);
        }
      };
      
      loadEvaluations();
    }
  }, [user]);

  const handleEditEvaluation = (evaluation: SprintEvaluation) => {
    setEditingEvaluation(evaluation);
  };

  const handleUpdateEvaluation = async (updatedData: Partial<SprintEvaluation>) => {
    if (!editingEvaluation || !user) return;


    try {
      await supabaseEvaluationService.updateEvaluation(editingEvaluation.id, updatedData);
      
      // Refresh user evaluations
      const evaluations = await supabaseEvaluationService.getUserEvaluations(user.email);
      setUserEvaluations(evaluations);
      setEditingEvaluation(null);
    } catch (error) {
      console.error('Error updating evaluation:', error);
      alert('Değerlendirme güncellenirken hata oluştu. Lütfen tekrar deneyin.');
    }
  };

  const sprintInfoMap = useMemo(() => {
    const map = new Map();
    sprints?.forEach(sprint => {
      map.set(sprint.id, { name: sprint.name, projectKey: sprint.projectKey });
    });
    return map;
  }, [sprints]);

  const getSprintInfo = (sprintId: string) => {
    return sprintInfoMap.get(sprintId) || { name: 'Bilinmeyen Sprint', projectKey: 'N/A' };
  };

  if (!user) {
    return (
      <div className="text-center py-12">
        <MessageSquare className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-500 text-lg">Giriş yapmanız gerekiyor.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Sprint Değerlendirmelerim</h2>
        <p className="text-gray-600 mt-1">Yaptığınız sprint değerlendirmelerini görüntüleyin ve düzenleyin</p>
      </div>

      {/* Evaluations List */}
      {userEvaluations.length > 0 ? (
        <div className="space-y-6">
          {userEvaluations.map((evaluation) => {
            const sprintInfo = getSprintInfo(evaluation.sprintId);
            
            return (
              <div key={evaluation.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <Calendar className="h-5 w-5 text-blue-600" />
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">{evaluation.sprintName}</h3>
                      <p className="text-sm text-gray-600">{evaluation.projectKey} - {sprintInfo.projectKey}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-4">
                    <div className="text-right">
                      <p className="text-xs text-gray-500">Değerlendirme Tarihi</p>
                      <p className="text-sm font-medium">{evaluation.createdAt.toLocaleDateString('tr-TR')}</p>
                    </div>
                    <button
                      onClick={() => handleEditEvaluation(evaluation)}
                      className="flex items-center space-x-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      <Edit className="h-4 w-4" />
                      <span>Düzenle</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Puanlar */}
                  <div className="space-y-4">
                    <div>
                      <h4 className="font-medium text-gray-900 mb-2">Verdiğiniz Puanlar</h4>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-600">Genel Puan:</span>
                          <div className="flex items-center space-x-1">
                            <Star className="h-4 w-4 text-yellow-400 fill-current" />
                            <span className="font-medium">{evaluation.overallRating}/5</span>
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-600">Sprint Başarı Puanı:</span>
                          <div className="flex items-center space-x-1">
                            <Star className="h-4 w-4 text-yellow-400 fill-current" />
                            <span className="font-medium">{evaluation.sprintSuccessRating}/5</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Takım Üyesi Puanları */}
                    {evaluation.teamMemberRatings.length > 0 && (
                      <div>
                        <h4 className="font-medium text-gray-900 mb-2">Takım Arkadaşları</h4>
                        <div className="space-y-2">
                          {evaluation.teamMemberRatings.map((rating) => (
                            <div key={rating.memberName} className="flex items-center justify-between">
                              <span className="text-sm text-gray-600">{rating.memberName}:</span>
                              <div className="flex items-center space-x-1">
                                <Star className="h-4 w-4 text-yellow-400 fill-current" />
                                <span className="font-medium">{rating.rating}/5</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Yorumlar */}
                  <div className="space-y-4">
                    <div>
                      <h4 className="font-medium text-gray-900 mb-2">Genel Yorum</h4>
                      <p className="text-sm text-gray-600 bg-gray-50 rounded p-3">
                        {evaluation.generalComment}
                      </p>
                    </div>

                    {evaluation.deficiencies && (
                      <div>
                        <h4 className="font-medium text-gray-900 mb-2">Eksiklikler</h4>
                        <p className="text-sm text-gray-600 bg-orange-50 rounded p-3">
                          {evaluation.deficiencies}
                        </p>
                      </div>
                    )}

                    {/* Takım Üyesi Yorumları */}
                    {evaluation.teamMemberRatings.some(rating => rating.comment) && (
                      <div>
                        <h4 className="font-medium text-gray-900 mb-2">Takım Arkadaşları Hakkında</h4>
                        <div className="space-y-2">
                          {evaluation.teamMemberRatings
                            .map((rating) => (
                              <div key={rating.memberName} className="bg-blue-50 rounded p-3">
                                <p className="text-sm font-medium text-gray-900">{rating.memberName}</p>
                                <div className="flex items-center space-x-2 mt-1">
                                  <div className="flex items-center space-x-1">
                                    <Star className="h-3 w-3 text-yellow-400 fill-current" />
                                    <span className="text-xs font-medium">{rating.rating}/5</span>
                                  </div>
                                </div>
                                {rating.comment && (
                                  <p className="text-sm text-gray-600 mt-2">{rating.comment}</p>
                                )}
                                {!rating.comment && (
                                  <p className="text-xs text-gray-400 mt-1 italic">Yorum yazılmamış</p>
                                )}
                              </div>
                            ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {evaluation.updatedAt.getTime() !== evaluation.createdAt.getTime() && (
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <p className="text-xs text-gray-500">
                      Son güncelleme: {evaluation.updatedAt.toLocaleDateString('tr-TR')} {evaluation.updatedAt.toLocaleTimeString('tr-TR')}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
          <MessageSquare className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500 text-lg">Henüz değerlendirme yapmadınız.</p>
          <p className="text-gray-400 text-sm mt-2">
            Kapatılmış sprintleri "Proje & Sprint Genel Bakış" sekmesinden değerlendirebilirsiniz.
          </p>
        </div>
      )}

      {/* Edit Evaluation Modal */}
      {editingEvaluation && (
        <EditEvaluationModal
          evaluation={editingEvaluation}
          onSave={handleUpdateEvaluation}
          onClose={() => setEditingEvaluation(null)}
        />
      )}
    </div>
  );
};

// Edit Evaluation Modal Component
interface EditEvaluationModalProps {
  evaluation: SprintEvaluation;
  onSave: (updatedData: Partial<SprintEvaluation>) => void;
  onClose: () => void;
}

const EditEvaluationModal: React.FC<EditEvaluationModalProps> = ({
  evaluation,
  onSave,
  onClose
}) => {
  const [formData, setFormData] = useState({
    generalComment: evaluation.generalComment,
    overallRating: evaluation.overallRating,
    sprintSuccessRating: evaluation.sprintSuccessRating,
    deficiencies: evaluation.deficiencies,
    teamMemberRatings: [...evaluation.teamMemberRatings]
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
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

    onSave(formData);
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
  }> = ({ rating, onRatingChange }) => (
    <div className="flex space-x-1">
      {[1, 2, 3, 4, 5].map(star => (
        <button
          key={star}
          type="button"
          onClick={() => onRatingChange(star)}
          className={`h-5 w-5 transition-colors ${
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

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center p-6 border-b border-gray-200">
          <div>
            <h3 className="text-xl font-semibold text-gray-900">Değerlendirmeyi Düzenle</h3>
            <p className="text-sm text-gray-600 mt-1">{evaluation.sprintName}</p>
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
          {formData.teamMemberRatings.length > 0 && (
            <div className="bg-green-50 rounded-lg p-4">
              <div className="flex items-center space-x-2 mb-3">
                <Users className="h-5 w-5 text-green-600" />
                <h4 className="font-medium text-gray-900">Takım Arkadaşları Değerlendirmesi</h4>
              </div>
              
              <div className="space-y-4">
                {formData.teamMemberRatings.map((rating) => (
                  <div key={rating.memberName} className="bg-white rounded-lg p-4 border border-gray-200">
                    <div className="flex items-center justify-between mb-3">
                      <h5 className="font-medium text-gray-900">{rating.memberName}</h5>
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
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
            >
              <Save className="h-4 w-4" />
              <span>Değişiklikleri Kaydet</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};