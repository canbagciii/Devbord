import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LandingPage } from './components/LandingPage';
import { Header } from './components/Header';
import { DeveloperWorkloadDashboard } from './components/DeveloperWorkloadDashboard';
import { ProjectSprintOverview } from './components/ProjectSprintOverview';
import { ManualTaskAssignment } from './components/ManualTaskAssignment';
import { SprintEvaluationDashboard } from './components/SprintEvaluationDashboard';
import { UserSprintEvaluations } from './components/UserSprintEvaluations';
import { UserManagement } from './components/UserManagement';
import { KolayIKEmployees } from './components/KolayIKEmployees';
import DailyWorklogTracking from './components/DailyWorklogTracking';
import { Users, BarChart3, Plus, Activity, MessageSquare, Settings } from 'lucide-react';
import { JiraDataProvider } from "./context/JiraDataContext";
import { SprintNotification } from './components/SprintNotification';
import { JiraFilterManagement } from './components/JiraFilterManagement';
import { onboardingService } from './lib/onboardingService';
import { jiraFilterService } from './lib/jiraFilterService';

const AppContent: React.FC = () => {
  const { isAuthenticated, loading, hasRole, hasKolayIK, user } = useAuth();
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [activeTab, setActiveTab] = useState<
    'dashboard' | 'projects' | 'assignment' | 'analytics' | 'evaluations' | 'my-evaluations' | 'daily-tracking' | 'user-management' | 'kolayik-employees'
  >('daily-tracking');
  const [activeSubTab, setActiveSubTab] = useState<{
    dashboard: 'workload';
    projects: 'overview' | 'evaluations';
  }>({
    dashboard: 'workload',
    projects: 'overview'
  });

  const handleSubTabChange = (mainTab: 'dashboard' | 'projects', subTab: string) => {
    setActiveSubTab(prev => ({ ...prev, [mainTab]: subTab }));
  };

  useEffect(() => {
    if (!isAuthenticated || !user) return;

    // Onboarding tamamlanmamışsa direkt yönlendir — async bekleme yok
    if (!user.onboardingCompleted) {
      setNeedsOnboarding(true);
      return;
    }

    // Onboarding tamamlanmış ama veri silinmiş olabilir — arka planda kontrol et
    const checkSelections = async () => {
      try {
        const [projects, developers] = await Promise.all([
          jiraFilterService.getSelectedProjects(),
          jiraFilterService.getSelectedDevelopers()
        ]);
        if (projects.length === 0 || developers.length === 0) {
          setNeedsOnboarding(true);
        }
      } catch (error) {
        console.error('Error checking selections:', error);
      }
    };

    checkSelections();
  }, [isAuthenticated, user?.id, user?.onboardingCompleted]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Yükleniyor...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LandingPage />;
  }

  if (user && needsOnboarding) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-6 bg-white rounded-lg shadow-sm p-6 border border-blue-200">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              {!user.onboardingCompleted ? 'Devbord\'a Hoş Geldiniz!' : 'Proje ve Yazılımcı Seçimi Gerekli'}
            </h1>
            <p className="text-gray-600">
              {!user.onboardingCompleted
                ? 'Başlamak için lütfen Jira projeleri ve yazılımcıları seçin. Bu seçimler tüm raporlarınızı filtreleyecektir.'
                : 'Sistemde proje veya yazılımcı seçimi bulunmuyor. Devam edebilmek için lütfen en az bir proje ve bir yazılımcı seçin.'
              }
            </p>
          </div>
          <JiraFilterManagement
            isOnboarding={true}
            onOnboardingComplete={async () => {
              if (user?.id) {
                if (!user.onboardingCompleted) {
                  await onboardingService.completeOnboarding(user.id);
                }
                setNeedsOnboarding(false);
                window.location.reload();
              }
            }}
          />
        </div>
      </div>
    );
  }

  const adminTabs = [
    { id: 'daily-tracking', label: 'Zaman Takibi', icon: BarChart3 },
    { id: 'projects', label: 'Sprintler', icon: Activity },
    { id: 'dashboard', label: 'Ekip Analizi', icon: Users },
    { id: 'assignment', label: 'Kapasite', icon: Plus },
    { id: 'user-management', label: 'Kullanıcılar', icon: Settings },
    ...(hasKolayIK ? [{ id: 'kolayik-employees' as const, label: 'İzin Takibi', icon: Users }] : []),
  ];

  const developerTabs = [
    { id: 'daily-tracking', label: 'Günlük Süre Takibi', icon: BarChart3 },
    { id: 'projects', label: 'Proje & Sprint Genel Bakış', icon: Activity },
    { id: 'dashboard', label: 'Yazılımcı Analizi', icon: Users },
    { id: 'my-evaluations', label: 'Sprint Değerlendirmelerim', icon: MessageSquare }
  ];

  const tabs = hasRole('admin') ? adminTabs : developerTabs;

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      {['projects', 'dashboard', 'assignment'].includes(activeTab) && (
        <SprintNotification />
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8 bg-white sticky top-16 z-30 py-4 border-b border-gray-200 shadow-sm">
          <nav className="flex space-x-8 max-w-7xl mx-auto">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`flex items-center space-x-2 px-1 py-2 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <tab.icon className="h-5 w-5" />
                <span>{tab.label}</span>
              </button>
            ))}
          </nav>
        </div>

        <div>
          <div className={activeTab === 'dashboard' ? '' : 'hidden'}>
            <DeveloperWorkloadDashboard />
          </div>

          <div className={activeTab === 'projects' ? '' : 'hidden'}>
            <div>
              <div className="mb-6 bg-white sticky top-32 z-20 py-3 border-b border-gray-100">
                <nav className="flex space-x-1 bg-gray-100 p-1 rounded-lg max-w-fit">
                  <button
                    onClick={() => handleSubTabChange('projects', 'overview')}
                    className={`flex items-center space-x-2 px-4 py-2 rounded-md font-medium text-sm transition-colors ${
                      activeSubTab.projects === 'overview'
                        ? 'bg-white text-blue-600 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    <Activity className="h-4 w-4" />
                    <span>Sprint Genel Bakış</span>
                  </button>
                  {hasRole('admin') && (
                    <button
                      onClick={() => handleSubTabChange('projects', 'evaluations')}
                      className={`flex items-center space-x-2 px-4 py-2 rounded-md font-medium text-sm transition-colors ${
                        activeSubTab.projects === 'evaluations'
                          ? 'bg-white text-blue-600 shadow-sm'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      <MessageSquare className="h-4 w-4" />
                      <span>Sprint Değerlendirmeleri</span>
                    </button>
                  )}
                </nav>
              </div>
              <div>
                {activeSubTab.projects === 'overview' && <ProjectSprintOverview />}
                {activeSubTab.projects === 'evaluations' && hasRole('admin') && <SprintEvaluationDashboard />}
              </div>
            </div>
          </div>

          {hasRole('admin') && (
            <div className={activeTab === 'assignment' ? '' : 'hidden'}>
              <ManualTaskAssignment />
            </div>
          )}

          {hasRole('admin') && (
            <div className={activeTab === 'user-management' ? '' : 'hidden'}>
              <UserManagement />
            </div>
          )}

          {hasRole('admin') && hasKolayIK && (
            <div className={activeTab === 'kolayik-employees' ? '' : 'hidden'}>
              <KolayIKEmployees />
            </div>
          )}

          <div className={activeTab === 'daily-tracking' ? '' : 'hidden'}>
            <DailyWorklogTracking />
          </div>

          {!hasRole('admin') && (
            <div className={activeTab === 'my-evaluations' ? '' : 'hidden'}>
              <UserSprintEvaluations />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

function App() {
  return (
    <AuthProvider>
      <JiraDataProvider>
        <AppContent />
      </JiraDataProvider>
    </AuthProvider>
  );
}

export default App;