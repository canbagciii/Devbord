import React, { useState, useEffect } from 'react';
import { Settings, Plus, Trash2, RefreshCw, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { supabaseJiraService } from '../lib/supabaseJiraService';
import { jiraFilterService, SelectedProject, SelectedDeveloper } from '../lib/jiraFilterService';
import { JiraProject } from '../types';

interface JiraFilterManagementProps {
  isOnboarding?: boolean;
  onOnboardingComplete?: () => void;
}

export const JiraFilterManagement: React.FC<JiraFilterManagementProps> = ({
  isOnboarding = false,
  onOnboardingComplete
}) => {
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [jiraConnected, setJiraConnected] = useState(false);

  const [allProjects, setAllProjects] = useState<JiraProject[]>([]);
  const [allUsers, setAllUsers] = useState<Array<{ accountId: string; displayName: string; emailAddress?: string }>>([]);

  const [selectedProjects, setSelectedProjects] = useState<SelectedProject[]>([]);
  const [selectedDevelopers, setSelectedDevelopers] = useState<SelectedDeveloper[]>([]);

  const [projectSearchTerm, setProjectSearchTerm] = useState('');
  const [developerSearchTerm, setDeveloperSearchTerm] = useState('');

  const [selectedDeveloperForProject, setSelectedDeveloperForProject] = useState<{
    id: string;
    name: string;
    email?: string;
    accountId: string;
  } | null>(null);
  const [tempSelectedProjectKeys, setTempSelectedProjectKeys] = useState<string[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [selProjects, selDevelopers] = await Promise.all([
        jiraFilterService.getSelectedProjects(),
        jiraFilterService.getSelectedDevelopers()
      ]);

      setSelectedProjects(selProjects);
      setSelectedDevelopers(selDevelopers);

      try {
        const projects = await supabaseJiraService.getProjects();
        setAllProjects(projects);
        if (projects.length > 0) {
          setJiraConnected(true);
        }
      } catch (error) {
        console.warn('Could not fetch projects from JIRA:', error);
      }

      try {
        const users = await supabaseJiraService.getAllUsers();
        setAllUsers(users);
        if (users.length > 0) {
          setJiraConnected(true);
        }
      } catch (error) {
        console.warn('Could not fetch users from JIRA:', error);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const refreshFromJira = async () => {
    setRefreshing(true);
    try {
      supabaseJiraService.clearCache();
      const [projects, users] = await Promise.all([
        supabaseJiraService.getProjects(),
        supabaseJiraService.getAllUsers()
      ]);
      setAllProjects(projects);
      setAllUsers(users);
      if (projects.length > 0 || users.length > 0) {
        setJiraConnected(true);
      }
    } catch (error) {
      console.error('Error refreshing from Jira:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const handleAddProject = async (project: JiraProject) => {
    console.log('🎯 Adding project:', project.key, project.name);
    try {
      await jiraFilterService.addProject(project.key, project.name);
      supabaseJiraService.clearCache();
      console.log('🗑️ Cache cleared after adding project');
      await loadData();
    } catch (error) {
      console.error('Error adding project:', error);
      alert('Proje eklenirken hata oluştu: ' + (error instanceof Error ? error.message : 'Bilinmeyen hata'));
    }
  };

  const handleAddDeveloper = (user: { accountId: string; displayName: string; emailAddress?: string }) => {
    console.log('🎯 Adding developer:', user.displayName, user.accountId);
    setSelectedDeveloperForProject({
      id: user.accountId,
      name: user.displayName,
      email: user.emailAddress,
      accountId: user.accountId
    });
    setTempSelectedProjectKeys([]);
  };

  const handleConfirmDeveloperWithProjects = async (projectKeys: string[]) => {
    if (!selectedDeveloperForProject) return;

    try {
      await jiraFilterService.addDeveloper(
        selectedDeveloperForProject.name,
        selectedDeveloperForProject.email,
        selectedDeveloperForProject.accountId,
        projectKeys,
        allProjects
      );
      supabaseJiraService.clearCache();
      console.log('🗑️ Cache cleared after adding developer');
      setSelectedDeveloperForProject(null);
      await loadData();
    } catch (error) {
      console.error('Error adding developer:', error);
    }
  };

  const handleCancelDeveloperSelection = () => {
    setSelectedDeveloperForProject(null);
    setTempSelectedProjectKeys([]);
  };

  const handleUpdateDeveloperProjects = async (developerId: string, projectKeys: string[]) => {
    try {
      await jiraFilterService.updateDeveloperProjects(developerId, projectKeys);
      await loadData();
    } catch (error) {
      console.error('Error updating developer projects:', error);
    }
  };

  const handleToggleProject = async (projectKey: string, currentStatus: boolean) => {
    try {
      await jiraFilterService.toggleProjectStatus(projectKey, !currentStatus);
      supabaseJiraService.clearCache();
      console.log('🗑️ Cache cleared after toggling project');
      await loadData();
    } catch (error) {
      console.error('Error toggling project:', error);
    }
  };

  const handleToggleDeveloper = async (developerId: string, currentStatus: boolean) => {
    try {
      await jiraFilterService.toggleDeveloperStatus(developerId, !currentStatus);
      supabaseJiraService.clearCache();
      console.log('🗑️ Cache cleared after toggling developer');
      await loadData();
    } catch (error) {
      console.error('Error toggling developer:', error);
    }
  };

  const handleRemoveProject = async (projectKey: string) => {
    if (!confirm('Bu projeyi listeden kaldırmak istediğinize emin misiniz?')) return;
    try {
      await jiraFilterService.removeProject(projectKey);
      supabaseJiraService.clearCache();
      console.log('🗑️ Cache cleared after removing project');
      await loadData();
    } catch (error) {
      console.error('Error removing project:', error);
    }
  };

  const handleRemoveDeveloper = async (developerId: string) => {
    if (!confirm('Bu yazılımcıyı listeden kaldırmak istediğinize emin misiniz?')) return;
    try {
      await jiraFilterService.removeDeveloper(developerId);
      supabaseJiraService.clearCache();
      console.log('🗑️ Cache cleared after removing developer');
      await loadData();
    } catch (error) {
      console.error('Error removing developer:', error);
    }
  };

  const filteredProjects = allProjects.filter(p =>
    p.name.toLowerCase().includes(projectSearchTerm.toLowerCase()) ||
    p.key.toLowerCase().includes(projectSearchTerm.toLowerCase())
  );

  const filteredUsers = allUsers.filter(u =>
    u.displayName.toLowerCase().includes(developerSearchTerm.toLowerCase()) ||
    (u.emailAddress && u.emailAddress.toLowerCase().includes(developerSearchTerm.toLowerCase()))
  );

  const selectedProjectKeys = new Set(selectedProjects.map(p => p.project_key));
  const selectedDeveloperNames = new Set(selectedDevelopers.map(d => d.developer_name));

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Settings className="h-6 w-6 text-blue-600" />
          <h2 className="text-2xl font-bold text-gray-900">JIRA Filtre Yönetimi</h2>
        </div>
        <button
          onClick={refreshFromJira}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          JIRA'dan Yenile
        </button>
      </div>

      {!jiraConnected && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-yellow-900 mb-1">JIRA Bağlantısı Bulunamadı</h3>
              <p className="text-sm text-yellow-800 mb-2">
                Şu anda JIRA'dan veri çekilemiyor. Mevcut seçili projeler ve yazılımcılar ile çalışabilirsiniz.
                JIRA'dan yeni proje ve kullanıcı eklemek için aşağıdaki ayarları yapın:
              </p>
              <ol className="text-sm text-yellow-800 list-decimal list-inside space-y-1">
                <li>.env dosyanıza VITE_JIRA_EMAIL ve VITE_JIRA_TOKEN değerlerini ekleyin</li>
                <li>Sayfayı yenileyin</li>
                <li>"JIRA'dan Yenile" butonuna tıklayarak tüm projeleri ve kullanıcıları görüntüleyin</li>
              </ol>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Proje Seçimi</h3>

          <div className="mb-4">
            <input
              type="text"
              placeholder="Proje ara..."
              value={projectSearchTerm}
              onChange={(e) => setProjectSearchTerm(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div className="mb-4">
            <h4 className="text-sm font-medium text-gray-700 mb-2">
              Seçili Projeler ({selectedProjects.filter(p => p.is_active).length})
            </h4>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {selectedProjects.length === 0 ? (
                <p className="text-sm text-gray-500 italic">Henüz proje seçilmedi</p>
              ) : (
                selectedProjects.map(project => (
                  <div key={project.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleToggleProject(project.project_key, project.is_active)}
                        className="text-gray-600 hover:text-gray-800"
                      >
                        {project.is_active ? (
                          <CheckCircle className="h-4 w-4 text-green-600" />
                        ) : (
                          <XCircle className="h-4 w-4 text-gray-400" />
                        )}
                      </button>
                      <span className={`text-sm font-medium ${project.is_active ? 'text-gray-900' : 'text-gray-400'}`}>
                        {project.project_key}
                      </span>
                      <span className={`text-xs ${project.is_active ? 'text-gray-600' : 'text-gray-400'}`}>
                        {project.project_name}
                      </span>
                    </div>
                    <button
                      onClick={() => handleRemoveProject(project.project_key)}
                      className="text-red-600 hover:text-red-800"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2">JIRA'daki Tüm Projeler</h4>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {allProjects.length === 0 ? (
                <p className="text-sm text-gray-500 italic">
                  JIRA bağlantısı mevcut değil. JIRA'dan proje çekmek için lütfen JIRA ayarlarınızı kontrol edin.
                </p>
              ) : (
                filteredProjects
                  .filter(p => !selectedProjectKeys.has(p.key))
                  .map(project => (
                    <div key={project.id} className="flex items-center justify-between p-2 bg-gray-50 rounded hover:bg-gray-100">
                      <div>
                        <span className="text-sm font-medium text-gray-900">{project.key}</span>
                        <span className="text-xs text-gray-600 ml-2">{project.name}</span>
                      </div>
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleAddProject(project);
                        }}
                        className="flex-shrink-0 p-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                        type="button"
                      >
                        <Plus className="h-5 w-5" />
                      </button>
                    </div>
                  ))
              )}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Kullanıcı Seçimi</h3>

          <div className="mb-4">
            <input
              type="text"
              placeholder="Yazılımcı ara..."
              value={developerSearchTerm}
              onChange={(e) => setDeveloperSearchTerm(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div className="mb-4">
            <h4 className="text-sm font-medium text-gray-700 mb-2">
              Seçili Yazılımcılar ({selectedDevelopers.filter(d => d.is_active).length})
            </h4>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {selectedDevelopers.length === 0 ? (
                <p className="text-sm text-gray-500 italic">Henüz yazılımcı seçilmedi</p>
              ) : (
                selectedDevelopers.map(developer => (
                  <div key={developer.id} className="p-2 bg-gray-50 rounded">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleToggleDeveloper(developer.id, developer.is_active)}
                          className="text-gray-600 hover:text-gray-800"
                        >
                          {developer.is_active ? (
                            <CheckCircle className="h-4 w-4 text-green-600" />
                          ) : (
                            <XCircle className="h-4 w-4 text-gray-400" />
                          )}
                        </button>
                        <div className="flex flex-col">
                          <span className={`text-sm font-medium ${developer.is_active ? 'text-gray-900' : 'text-gray-400'}`}>
                            {developer.developer_name}
                          </span>
                          {developer.developer_email && (
                            <span className={`text-xs ${developer.is_active ? 'text-gray-600' : 'text-gray-400'}`}>
                              {developer.developer_email}
                            </span>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => handleRemoveDeveloper(developer.id)}
                        className="text-red-600 hover:text-red-800"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    {developer.project_keys && developer.project_keys.length > 0 && (
                      <div className="mt-2 ml-6">
                        <div className="flex flex-wrap gap-1">
                          {developer.project_keys.map(projectKey => {
                            const project = selectedProjects.find(p => p.project_key === projectKey);
                            return (
                              <span
                                key={projectKey}
                                className="inline-flex items-center px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded"
                              >
                                {projectKey}
                                {project && ` - ${project.project_name}`}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {selectedDeveloperForProject ? (
            <div className="border-2 border-blue-500 rounded-lg p-4 bg-blue-50">
              <h4 className="text-sm font-semibold text-gray-900 mb-3">
                {selectedDeveloperForProject.name} için proje seçin
              </h4>
              <div className="space-y-2 mb-4 max-h-48 overflow-y-auto">
                {allProjects.length === 0 ? (
                  <p className="text-sm text-gray-600 italic">JIRA'dan proje yüklenemedi</p>
                ) : (
                  allProjects.map(project => (
                    <label key={project.key} className="flex items-center gap-2 p-2 bg-white rounded hover:bg-gray-50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={tempSelectedProjectKeys.includes(project.key)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setTempSelectedProjectKeys([...tempSelectedProjectKeys, project.key]);
                          } else {
                            setTempSelectedProjectKeys(tempSelectedProjectKeys.filter(k => k !== project.key));
                          }
                        }}
                        value={project.key}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm font-medium text-gray-900">{project.key}</span>
                      <span className="text-xs text-gray-600">{project.name}</span>
                    </label>
                  ))
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    handleConfirmDeveloperWithProjects(tempSelectedProjectKeys);
                  }}
                  disabled={allProjects.length === 0 || tempSelectedProjectKeys.length === 0}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Onayla ({tempSelectedProjectKeys.length} proje seçildi)
                </button>
                <button
                  onClick={handleCancelDeveloperSelection}
                  className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors"
                >
                  İptal
                </button>
              </div>
            </div>
          ) : (
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">JIRA'daki Tüm Kullanıcılar</h4>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {allUsers.length === 0 ? (
                  <p className="text-sm text-gray-500 italic">
                    JIRA bağlantısı mevcut değil. JIRA'dan kullanıcı çekmek için lütfen JIRA ayarlarınızı kontrol edin.
                  </p>
                ) : (
                  filteredUsers
                    .filter(u => !selectedDeveloperNames.has(u.displayName))
                    .map(user => (
                      <div key={user.accountId} className="flex items-center justify-between p-2 bg-gray-50 rounded hover:bg-gray-100">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-gray-900">{user.displayName}</span>
                          {user.emailAddress && (
                            <span className="text-xs text-gray-600">{user.emailAddress}</span>
                          )}
                        </div>
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleAddDeveloper(user);
                          }}
                          className="flex-shrink-0 p-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                          type="button"
                        >
                          <Plus className="h-5 w-5" />
                        </button>
                      </div>
                    ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-800">
          <strong>Not:</strong> Seçtiğiniz projeler ve yazılımcılar, tüm raporlarda ve analizlerde filtreleme için kullanılacaktır.
          Aktif/pasif durumu değiştirerek geçici olarak filtreyi açıp kapatabilirsiniz.
        </p>
      </div>

      {isOnboarding && selectedProjects.length > 0 && selectedDevelopers.length > 0 && (
        <div className="sticky bottom-0 bg-white border-t-2 border-blue-500 p-6 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Kurulum Tamamlandı!</h3>
              <p className="text-sm text-gray-600 mt-1">
                {selectedProjects.length} proje ve {selectedDevelopers.length} yazılımcı seçildi. Devam edebilirsiniz.
              </p>
            </div>
            <button
              onClick={onOnboardingComplete}
              className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors shadow-md"
            >
              Devam Et
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
