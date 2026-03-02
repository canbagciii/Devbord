import React, { useState, useEffect } from 'react';
import { supabaseJiraService } from '../lib/supabaseJiraService';
import { ExternalLink, Users, FolderOpen, Clock, AlertCircle, CheckCircle, Loader, RefreshCw } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface JiraProject {
  id: string;
  key: string;
  name: string;
}

interface JiraUser {
  accountId: string;
  displayName: string;
  emailAddress?: string;
}

interface JiraIssue {
  id: string;
  key: string;
  fields: {
    summary: string;
    description?: string;
    status: {
      name: string;
      statusCategory: {
        key: string;
      };
    };
    assignee?: {
      accountId: string;
      displayName: string;
    };
    project: {
      key: string;
      name: string;
    };
    priority?: {
      name: string;
    };
    created: string;
    updated: string;
    timeoriginalestimate?: number;
    timespent?: number;
  };
}

export const JiraReport: React.FC = () => {
  const { hasRole, getAccessibleProjects, user } = useAuth();
  const [projects, setProjects] = useState<JiraProject[]>([]);
  const [users, setUsers] = useState<JiraUser[]>([]);
  const [visibleUsers, setVisibleUsers] = useState<JiraUser[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>('all');
  const [selectedUser, setSelectedUser] = useState<string>('all');
  const [issues, setIssues] = useState<JiraIssue[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (projects.length > 0 || users.length > 0) {
      loadIssues();
    }
  }, [selectedProject, selectedUser]);

  const loadInitialData = async () => {
    setLoading(true);
    setError(null);

    try {
      const [projectsData, usersData] = await Promise.all([
        supabaseJiraService.getProjects(),
        supabaseJiraService.getAllUsers()
      ]);

      // Filter projects by access
      const accessibleProjectKeys = getAccessibleProjects();
      const filteredProjects = accessibleProjectKeys.length > 0
        ? projectsData.filter(project => accessibleProjectKeys.includes(project.key))
        : projectsData;

      setProjects(filteredProjects);
      setUsers(usersData);

      // Initialize visible users based on role
      let initialVisibleUsers = usersData;
      if (hasRole('developer') && user) {
        initialVisibleUsers = usersData.filter(u => u.displayName === user.name);
      }
      setVisibleUsers(initialVisibleUsers);
      setLastUpdate(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Jira verisi yüklenirken hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  const loadIssues = async () => {
    setLoading(true);
    setError(null);

    try {
      let issuesData: JiraIssue[] = [];

      // Build JQL query based on filters
      let jql = '';

      if (selectedUser !== 'all') {
        jql = `assignee = "${selectedUser}"`;
      } else if (selectedProject !== 'all') {
        jql = `project = "${selectedProject}"`;
      } else {
        jql = 'updated >= -30d';
      }

      jql += ' ORDER BY updated DESC';

      // Fetch issues using searchIssues
      const response = await supabaseJiraService.searchIssues(jql, 100);
      issuesData = response.issues || [];

      // Enforce access rules on issues
      const accessibleProjectKeys = getAccessibleProjects();
      let filteredIssues = issuesData.filter(issue => {
        const projectKey = issue.fields.project.key;
        return accessibleProjectKeys.length === 0 || accessibleProjectKeys.includes(projectKey);
      });

      if (hasRole('developer') && user) {
        filteredIssues = filteredIssues.filter(issue => issue.fields.assignee?.displayName === user.name);
      }

      setIssues(filteredIssues);

      // Derive visible users from filtered issues (assignees only)
      const userMap = new Map<string, JiraUser>();
      filteredIssues.forEach(issue => {
        const assignee = issue.fields.assignee;
        if (assignee && assignee.accountId) {
          userMap.set(assignee.accountId, {
            accountId: assignee.accountId,
            displayName: assignee.displayName
          } as JiraUser);
        }
      });
      const derivedUsers = Array.from(userMap.values());
      // If no issues/assignees, fallback to previously loaded users (already role-filtered)
      setVisibleUsers(derivedUsers.length > 0 ? derivedUsers : (hasRole('developer') && user ? users.filter(u => u.displayName === user.name) : users));
      setLastUpdate(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Görevler yüklenirken hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  // For developer role, auto-select own user if available
  useEffect(() => {
    if (hasRole('developer') && user && visibleUsers.length > 0) {
      const me = visibleUsers.find(u => u.displayName === user.name);
      if (me) {
        setSelectedUser(me.accountId);
      }
    }
  }, [hasRole, user, visibleUsers]);

  const getStatusColor = (statusCategory: string) => {
    switch (statusCategory.toLowerCase()) {
      case 'new':
      case 'indeterminate':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'done':
        return 'bg-green-100 text-green-800 border-green-200';
      default:
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    }
  };

  const getStatusIcon = (statusCategory: string) => {
    switch (statusCategory.toLowerCase()) {
      case 'new':
      case 'indeterminate':
        return <AlertCircle className="h-4 w-4" />;
      case 'done':
        return <CheckCircle className="h-4 w-4" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  const formatTime = (seconds?: number) => {
    if (!seconds) return '-';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  // Statistics
  const stats = {
    totalIssues: issues.length,
    inProgress: issues.filter(issue => issue.fields.status.statusCategory.key === 'indeterminate').length,
    done: issues.filter(issue => issue.fields.status.statusCategory.key === 'done').length,
    totalTimeSpent: issues.reduce((sum, issue) => sum + (issue.fields.timespent || 0), 0),
    totalTimeEstimate: issues.reduce((sum, issue) => sum + (issue.fields.timeoriginalestimate || 0), 0),
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <ExternalLink className="h-6 w-6 text-blue-600" />
          <h2 className="text-2xl font-bold text-gray-900">Jira Raporu</h2>
        </div>
        <div className="flex items-center space-x-4">
          {lastUpdate && (
            <span className="text-sm text-gray-500">
              Son güncelleme: {lastUpdate.toLocaleTimeString('tr-TR')}
            </span>
          )}
          <button
            onClick={loadInitialData}
            disabled={loading}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Yenile</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center space-x-2">
            <AlertCircle className="h-5 w-5 text-red-600" />
            <p className="text-red-800">{error}</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <FolderOpen className="inline h-4 w-4 mr-1" />
              Proje Filtresi
            </label>
            <select
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">Tüm Projeler</option>
              {projects.map(project => (
                <option key={project.id} value={project.key}>
                  {project.name} ({project.key})
                </option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Users className="inline h-4 w-4 mr-1" />
              Yazılımcı Filtresi
            </label>
            <select
              value={selectedUser}
              onChange={(e) => setSelectedUser(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">Tüm Yazılımcılar</option>
              {visibleUsers.map(u => (
                <option key={u.accountId} value={u.accountId}>
                  {u.displayName}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Toplam Görev</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalIssues}</p>
            </div>
            <FolderOpen className="h-8 w-8 text-blue-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Devam Eden</p>
              <p className="text-2xl font-bold text-yellow-600">{stats.inProgress}</p>
            </div>
            <Clock className="h-8 w-8 text-yellow-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Tamamlanan</p>
              <p className="text-2xl font-bold text-green-600">{stats.done}</p>
            </div>
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Harcanan Süre</p>
              <p className="text-2xl font-bold text-purple-600">{formatTime(stats.totalTimeSpent)}</p>
            </div>
            <Clock className="h-8 w-8 text-purple-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Tahmini Süre</p>
              <p className="text-2xl font-bold text-indigo-600">{formatTime(stats.totalTimeEstimate)}</p>
            </div>
            <Clock className="h-8 w-8 text-indigo-600" />
          </div>
        </div>
      </div>

      {/* Issues Table */}
      {/* Developer Summary Section */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Yazılımcı Özeti</h3>
          <p className="text-sm text-gray-600 mt-1">Seçilen filtreye göre yazılımcıların proje bazlı görev dağılımı</p>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Yazılımcı
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Projeler
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Toplam Görev
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Toplam Süre
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tamamlanan
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {(() => {
                // Group issues by developer
                const developerStats = issues.reduce((acc, issue) => {
                  if (!issue.fields.assignee) return acc;
                  
                  const developerId = issue.fields.assignee.accountId;
                  const developerName = issue.fields.assignee.displayName;
                  
                  if (!acc[developerId]) {
                    acc[developerId] = {
                      name: developerName,
                      projects: {},
                      totalTasks: 0,
                      totalTimeSpent: 0,
                      totalTimeEstimate: 0,
                      completedTasks: 0
                    };
                  }
                  
                  const projectKey = issue.fields.project.key;
                  const projectName = issue.fields.project.name;
                  
                  if (!acc[developerId].projects[projectKey]) {
                    acc[developerId].projects[projectKey] = {
                      name: projectName,
                      taskCount: 0,
                      timeSpent: 0,
                      timeEstimate: 0
                    };
                  }
                  
                  acc[developerId].projects[projectKey].taskCount++;
                  acc[developerId].projects[projectKey].timeSpent += issue.fields.timespent || 0;
                  acc[developerId].projects[projectKey].timeEstimate += issue.fields.timeestimate || 0;
                  
                  acc[developerId].totalTasks++;
                  acc[developerId].totalTimeSpent += issue.fields.timespent || 0;
                  acc[developerId].totalTimeEstimate += issue.fields.timeestimate || 0;
                  
                  if (issue.fields.status.statusCategory.key === 'done') {
                    acc[developerId].completedTasks++;
                  }
                  
                  return acc;
                }, {} as Record<string, any>);
                
                return Object.values(developerStats).map((developer: any, index) => (
                  <tr key={developer.name} className={`${index % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'} hover:bg-gray-50 transition-colors`}>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-3">
                        <div className="flex-shrink-0 h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center">
                          <span className="text-sm font-medium text-blue-800">
                            {developer.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                          </span>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{developer.name}</p>
                          <p className="text-xs text-gray-500">{Object.keys(developer.projects).length} proje</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-1">
                        {Object.entries(developer.projects).map(([projectKey, projectData]: [string, any]) => (
                          <div key={projectKey} className="flex items-center justify-between bg-gray-50 rounded px-2 py-1">
                            <div className="flex items-center space-x-2">
                              <span className="text-xs font-medium text-blue-600">{projectKey}</span>
                              <span className="text-xs text-gray-600">{projectData.name}</span>
                            </div>
                            <div className="flex items-center space-x-2 text-xs">
                              <span className="bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded">
                                {projectData.taskCount} görev
                              </span>
                              <span className="text-gray-500">
                                {formatTime(projectData.timeSpent + projectData.timeEstimate)}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="text-lg font-semibold text-gray-900">{developer.totalTasks}</span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="text-sm">
                        <div className="font-medium text-gray-900">
                          {formatTime(developer.totalTimeSpent + developer.totalTimeEstimate)}
                        </div>
                        <div className="text-xs text-gray-500">
                          Harcanan: {formatTime(developer.totalTimeSpent)}
                        </div>
                        <div className="text-xs text-gray-500">
                          Tahmini: {formatTime(developer.totalTimeEstimate)}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex flex-col items-center space-y-1">
                        <span className="text-sm font-medium text-green-600">
                          {developer.completedTasks}/{developer.totalTasks}
                        </span>
                        <div className="w-16 bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-green-600 h-2 rounded-full"
                            style={{ width: `${(developer.completedTasks / developer.totalTasks) * 100}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-500">
                          {Math.round((developer.completedTasks / developer.totalTasks) * 100)}%
                        </span>
                      </div>
                    </td>
                  </tr>
                ));
              })()}
            </tbody>
          </table>
        </div>
        
        {issues.length === 0 && !loading && (
          <div className="text-center py-8">
            <p className="text-gray-500">Seçilen filtreye göre yazılımcı bulunamadı.</p>
          </div>
        )}
      </div>


    </div>
  );
};