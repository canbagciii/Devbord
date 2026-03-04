import React, { useState, useEffect } from 'react';
import { Settings, RefreshCw, CheckCircle, XCircle, AlertCircle, Trash2, ChevronDown, ChevronUp, Users, Folder, ArrowRight, ArrowLeft } from 'lucide-react';
import { supabaseJiraService } from '../lib/supabaseJiraService';
import { jiraFilterService, SelectedProject, SelectedDeveloper } from '../lib/jiraFilterService';
import { JiraProject } from '../types';
import { supabase } from '../lib/supabase';
import { useJiraData } from '../context/JiraDataContext';
import { worklogService } from '../services/worklogService';

interface JiraFilterManagementProps {
  isOnboarding?: boolean;
  onOnboardingComplete?: () => void;
}

// DB'ye yazilmadan once local'de tutulan draft tipler
interface DraftProject {
  project_key: string;
  project_name: string;
  is_active: boolean;
  existing_id?: string;
}

interface DraftDeveloper {
  accountId: string;
  displayName: string;
  emailAddress?: string;
  project_keys: string[];
  existing_id?: string;
}

interface StoryPointFieldConfig {
  project_key: string;
  field_name: string;
}

export const JiraFilterManagement: React.FC<JiraFilterManagementProps> = ({
  isOnboarding = false,
  onOnboardingComplete
}) => {
  const { refresh } = useJiraData();
  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);
  const [refreshing, setRefreshing] = useState(false);
  const [jiraConnected, setJiraConnected] = useState(false);

  const [allProjects, setAllProjects] = useState<JiraProject[]>([]);
  const [allUsers, setAllUsers] = useState<Array<{ accountId: string; displayName: string; emailAddress?: string }>>([]);

  // DB snapshot - diff icin saklanir, loadData'dan sonra degismez
  const [savedProjects, setSavedProjects] = useState<SelectedProject[]>([]);
  const [savedDevelopers, setSavedDevelopers] = useState<SelectedDeveloper[]>([]);

  // *** LOCAL DRAFT STATE ***
  // Kullanici tum adımlarda sadece bu state'i degistirir.
  // "Plani Onayla" butonuna basilana kadar DB'ye hic yazilmaz.
  const [draftProjects, setDraftProjects] = useState<DraftProject[]>([]);
  const [draftDevelopers, setDraftDevelopers] = useState<DraftDeveloper[]>([]);

  const [projectSearchTerm, setProjectSearchTerm] = useState('');
  const [expandedProjectKey, setExpandedProjectKey] = useState<string | null>(null);
  const [userSearchTerm, setUserSearchTerm] = useState('');

  const [dailyHours, setDailyHours] = useState(8);
  const [capacityMetric, setCapacityMetric] = useState<'hours' | 'storyPoints'>('hours');
  const [dailyStoryPoints, setDailyStoryPoints] = useState(8);
  const [storyPointFieldConfigs, setStoryPointFieldConfigs] = useState<StoryPointFieldConfig[]>([]);
  const [savingPlan, setSavingPlan] = useState(false);
  const [planSaveMessage, setPlanSaveMessage] = useState<string | null>(null);
  const [planSaveError, setPlanSaveError] = useState<string | null>(null);

  useEffect(() => { loadData(); }, []);

  // DB'den mevcut verileri yukle ve draft'a kopyala - sadece bir kez calisir
  const loadData = async () => {
    setLoading(true);
    try {
      const companyId = localStorage.getItem('companyId');
      if (companyId) {
        const { data: company, error } = await supabase
          .from('companies').select('jira_email, jira_api_token').eq('id', companyId).single();
        if (!error && company?.jira_email && company?.jira_api_token) setJiraConnected(true);
      }

      try {
        const storedMetric = localStorage.getItem('capacityMetric');
        if (storedMetric === 'hours' || storedMetric === 'storyPoints') setCapacityMetric(storedMetric);
        const storedDailyHours = localStorage.getItem('dailyHours');
        if (storedDailyHours) { const v = parseInt(storedDailyHours, 10); if (!Number.isNaN(v) && v > 0) setDailyHours(v); }
        const storedDailySp = localStorage.getItem('dailyStoryPoints');
        if (storedDailySp) { const v = parseInt(storedDailySp, 10); if (!Number.isNaN(v) && v > 0) setDailyStoryPoints(v); }
      } catch {}

      const [selProjects, selDevelopers, capacitySettingsData, spFieldConfigs] = await Promise.all([
        jiraFilterService.getSelectedProjects(),
        jiraFilterService.getSelectedDevelopers(),
        companyId ? supabase.from('capacity_settings').select('*').eq('company_id', companyId).maybeSingle() : Promise.resolve({ data: null, error: null }),
        companyId ? supabase.from('project_story_point_config').select('*').eq('company_id', companyId) : Promise.resolve({ data: null, error: null })
      ]);

      setSavedProjects(selProjects);
      setSavedDevelopers(selDevelopers);

      if (capacitySettingsData.data) {
        if (capacitySettingsData.data.capacity_metric) setCapacityMetric(capacitySettingsData.data.capacity_metric as 'hours' | 'storyPoints');
        if (capacitySettingsData.data.daily_hours) setDailyHours(Number(capacitySettingsData.data.daily_hours));
        if (capacitySettingsData.data.daily_story_points) setDailyStoryPoints(Number(capacitySettingsData.data.daily_story_points));
      }

      if (spFieldConfigs.data) {
        setStoryPointFieldConfigs(spFieldConfigs.data.map((c: any) => ({
          project_key: c.project_key,
          field_name: c.story_point_field
        })));
      }

      // Draft'i DB'den gelen mevcut veriyle baslat
      setDraftProjects(selProjects.map(p => ({
        project_key: p.project_key, project_name: p.project_name,
        is_active: p.is_active, existing_id: p.id
      })));
      setDraftDevelopers(selDevelopers.map(d => ({
        accountId: d.jira_account_id || '', displayName: d.developer_name,
        emailAddress: d.developer_email, project_keys: d.project_keys || [],
        existing_id: d.id
      })));

      try { const projects = await supabaseJiraService.getAllProjectsFromJira(); setAllProjects(projects); } catch {}
      try { const users = await supabaseJiraService.getAllUsersFromJira(); setAllUsers(users); } catch {}
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
        supabaseJiraService.getAllProjectsFromJira(),
        supabaseJiraService.getAllUsersFromJira()
      ]);
      setAllProjects(projects);
      setAllUsers(users);
      if (projects.length > 0 || users.length > 0) setJiraConnected(true);
    } catch (error) {
      console.error('Error refreshing from Jira:', error);
    } finally {
      setRefreshing(false);
    }
  };

  // ── DRAFT HELPERS (sifir DB yazimi) ──────────────────────────────────────────

  const draftProjectKeys = new Set(draftProjects.map(p => p.project_key));

  /** Projeyi draft'a ekle (yoksa) ve user panelini ac/kapat */
  const handleProjectCardClick = (project: JiraProject) => {
    if (!draftProjectKeys.has(project.key)) {
      setDraftProjects(prev => [...prev, { project_key: project.key, project_name: project.name, is_active: true }]);
    }
    setExpandedProjectKey(prev => (prev === project.key ? null : project.key));
    setUserSearchTerm('');
  };

  /** Proje aktif/pasif durumunu draft'ta degistir */
  const handleToggleProject = (projectKey: string) => {
    setDraftProjects(prev => prev.map(p => p.project_key === projectKey ? { ...p, is_active: !p.is_active } : p));
  };

  /** Projeyi draft'tan kaldir; o projeye atanmis dev'leri de guncelle */
  const handleRemoveProject = (projectKey: string) => {
    if (!confirm('Bu projeyi listeden kaldırmak istediğinize emin misiniz?')) return;
    setDraftProjects(prev => prev.filter(p => p.project_key !== projectKey));
    setDraftDevelopers(prev =>
      prev.map(d => ({ ...d, project_keys: d.project_keys.filter(k => k !== projectKey) }))
          .filter(d => d.project_keys.length > 0)
    );
    if (expandedProjectKey === projectKey) setExpandedProjectKey(null);
  };

  /** Developer'i draft'tan kaldir */
  const handleRemoveDeveloper = (accountId: string) => {
    if (!confirm('Bu yazılımcıyı listeden kaldırmak istediğinize emin misiniz?')) return;
    setDraftDevelopers(prev => prev.filter(d => d.accountId !== accountId));
  };

  /** Checkbox toggle: kullaniciyi projeye ekle / cikar */
  const toggleUserForProject = (projectKey: string, user: { accountId: string; displayName: string; emailAddress?: string }) => {
    setDraftDevelopers(prev => {
      const existing = prev.find(d => d.accountId === user.accountId);
      if (existing) {
        const hasProject = existing.project_keys.includes(projectKey);
        if (hasProject) {
          const newKeys = existing.project_keys.filter(k => k !== projectKey);
          if (newKeys.length === 0) return prev.filter(d => d.accountId !== user.accountId);
          return prev.map(d => d.accountId === user.accountId ? { ...d, project_keys: newKeys } : d);
        } else {
          return prev.map(d => d.accountId === user.accountId ? { ...d, project_keys: [...d.project_keys, projectKey] } : d);
        }
      } else {
        return [...prev, { accountId: user.accountId, displayName: user.displayName, emailAddress: user.emailAddress, project_keys: [projectKey] }];
      }
    });
  };

  // ── FINAL SAVE - sadece "Plani Onayla" butonunda tetiklenir ─────────────────

  const handleConfirm = async () => {
    if (savingPlan) return;
    setPlanSaveMessage(null);
    setPlanSaveError(null);
    setSavingPlan(true);
    try {
      // 1) Silinen projeleri DB'den kaldir
      for (const saved of savedProjects) {
        if (!draftProjects.find(d => d.project_key === saved.project_key))
          await jiraFilterService.removeProject(saved.project_key);
      }
      // 2) Draft projeleri kaydet
      for (const dp of draftProjects) {
        const saved = savedProjects.find(s => s.project_key === dp.project_key);
        if (!saved) await jiraFilterService.addProject(dp.project_key, dp.project_name);
        if (saved && saved.is_active !== dp.is_active) await jiraFilterService.toggleProjectStatus(dp.project_key, dp.is_active);
      }
      // 3) Silinen dev'leri DB'den kaldir
      for (const saved of savedDevelopers) {
        const stillExists = draftDevelopers.find(d => d.accountId === saved.jira_account_id || d.displayName === saved.developer_name);
        if (!stillExists) await jiraFilterService.removeDeveloper(saved.id);
      }
      // 4) Draft dev'leri kaydet
      for (const dd of draftDevelopers) {
        const saved = savedDevelopers.find(s => s.jira_account_id === dd.accountId || s.developer_name === dd.displayName);
        if (!saved) {
          await jiraFilterService.addDeveloper(dd.displayName, dd.emailAddress, dd.accountId, dd.project_keys, allProjects);
        } else {
          const currentKeys = saved.project_keys || [];
          const same = currentKeys.length === dd.project_keys.length && dd.project_keys.every(k => currentKeys.includes(k));
          if (!same) await jiraFilterService.updateDeveloperProjects(saved.id, dd.project_keys);
        }
      }
      // 5) Kapasite ayarlari - Database'e kaydet
      const companyId = localStorage.getItem('companyId');
      if (companyId) {
        // Capacity settings kaydet
        const { data: existingCapacity } = await supabase
          .from('capacity_settings')
          .select('id')
          .eq('company_id', companyId)
          .maybeSingle();

        if (existingCapacity) {
          await supabase
            .from('capacity_settings')
            .update({
              capacity_metric: capacityMetric,
              daily_hours: dailyHours,
              daily_story_points: dailyStoryPoints,
              updated_at: new Date().toISOString()
            })
            .eq('id', existingCapacity.id);
        } else {
          await supabase
            .from('capacity_settings')
            .insert({
              company_id: companyId,
              capacity_metric: capacityMetric,
              daily_hours: dailyHours,
              daily_story_points: dailyStoryPoints
            });
        }

        // Story Point field configs kaydet (sadece story point modunda)
        if (capacityMetric === 'storyPoints') {
          // Önce mevcut kayıtları sil
          await supabase
            .from('project_story_point_config')
            .delete()
            .eq('company_id', companyId);

          // Yeni kayıtları ekle
          const configsToInsert = storyPointFieldConfigs
            .filter(c => c.field_name.trim() !== '')
            .map(c => ({
              company_id: companyId,
              project_key: c.project_key,
              story_point_field: c.field_name.trim()
            }));

          if (configsToInsert.length > 0) {
            await supabase
              .from('project_story_point_config')
              .insert(configsToInsert);
          }
        }
      }

      // LocalStorage'a da yaz (backward compatibility)
      try {
        localStorage.setItem('capacityMetric', capacityMetric);
        localStorage.setItem('dailyHours', String(dailyHours));
        localStorage.setItem('dailyStoryPoints', String(dailyStoryPoints));
      } catch {}

      supabaseJiraService.clearCache();
      worklogService.clearCache();
      refresh();
      setPlanSaveMessage('Kapasite planı başarıyla kaydedildi.');
      if (isOnboarding && onOnboardingComplete) { onOnboardingComplete(); } else { window.location.reload(); }
    } catch (err) {
      setPlanSaveError(err instanceof Error ? err.message : 'Kapasite planı kaydedilirken beklenmeyen bir hata oluştu.');
    } finally {
      setSavingPlan(false);
    }
  };

  // ── DERIVED ──────────────────────────────────────────────────────────────────

  const activeProjectCount = draftProjects.filter(p => p.is_active).length;
  const activeDeveloperCount = draftDevelopers.length;

  const filteredProjects = allProjects
    .filter(p => p.name.toLowerCase().includes(projectSearchTerm.toLowerCase()) || p.key.toLowerCase().includes(projectSearchTerm.toLowerCase()))
    .sort((a, b) => (draftProjectKeys.has(a.key) ? 0 : 1) - (draftProjectKeys.has(b.key) ? 0 : 1));

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-10 w-10 border-[3px] border-indigo-100 border-t-indigo-600"></div>
          <span className="text-sm text-gray-500 font-medium">Yükleniyor...</span>
        </div>
      </div>
    );
  }

  const StepIndicator = () => {
    const steps = [{ label: 'Proje & Ekip', icon: Folder }, { label: 'Ayarlar', icon: Settings }, { label: 'Özet', icon: CheckCircle }];
    return (
      <div className="flex items-center gap-0 mb-8">
        {steps.map((s, i) => {
          const step = i + 1; const isDone = step < currentStep; const isActive = step === currentStep; const Icon = s.icon;
          return (
            <React.Fragment key={step}>
              <div className="flex flex-col items-center gap-1.5">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300 ${isDone ? 'bg-emerald-500 shadow-lg shadow-emerald-200' : isActive ? 'bg-indigo-600 shadow-lg shadow-indigo-200' : 'bg-gray-100'}`}>
                  {isDone ? <CheckCircle className="h-5 w-5 text-white" /> : <Icon className={`h-5 w-5 ${isActive ? 'text-white' : 'text-gray-400'}`} />}
                </div>
                <span className={`text-[0.65rem] font-semibold uppercase tracking-wider ${isDone ? 'text-emerald-600' : isActive ? 'text-indigo-600' : 'text-gray-400'}`}>{s.label}</span>
              </div>
              {i < 2 && <div className={`flex-1 h-[2px] mx-2 mb-5 rounded-full transition-all duration-500 ${step < currentStep ? 'bg-emerald-400' : 'bg-gray-200'}`} />}
            </React.Fragment>
          );
        })}
      </div>
    );
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 p-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center shadow-lg shadow-indigo-200">
            <Settings className="h-5 w-5 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900 tracking-tight">Kapasite Planlama</h2>
            <p className="text-xs text-gray-400 mt-0.5">Jira projelerini ve ekibini yapılandır</p>
          </div>
        </div>
        <button onClick={refreshFromJira} disabled={refreshing} className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-xl hover:border-indigo-300 hover:text-indigo-600 transition-all text-sm font-medium shadow-sm disabled:opacity-50">
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          {refreshing ? 'Yenileniyor...' : "JIRA'dan Yenile"}
        </button>
      </div>

      {!jiraConnected && (
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
          <AlertCircle className="h-5 w-5 text-amber-500 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-amber-900">JIRA Bağlantısı Bulunamadı</p>
            <p className="text-xs text-amber-700 mt-0.5">Şirket ayarlarından JIRA kimlik bilgilerinizi kontrol edin, ardından &quot;JIRA&apos;dan Yenile&quot; butonuna basın.</p>
          </div>
        </div>
      )}

      {isOnboarding && draftProjects.length === 0 && draftDevelopers.length === 0 && (
        <div className="flex items-start gap-3 bg-indigo-50 border border-indigo-200 rounded-xl p-4">
          <AlertCircle className="h-5 w-5 text-indigo-500 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-indigo-900">Başlamak için</p>
            <p className="text-xs text-indigo-700 mt-0.5">Önce &quot;JIRA&apos;dan Yenile&quot; butonuna tıklayın. Ardından en az bir proje ve bir yazılımcı seçin.</p>
          </div>
        </div>
      )}

      <StepIndicator />

      {/* STEP 1 */}
      {currentStep === 1 && (
        <div className="space-y-6">
          <div>
            <h3 className="text-base font-bold text-gray-900">Proje ve Ekip Seç</h3>
            <p className="text-xs text-gray-400 mt-0.5">Bir projeye tıklayarak seçin, ardından o proje için çalışacak yazılımcıları belirleyin.</p>
          </div>

          <div className="relative">
            <input type="text" placeholder="Proje ara..." value={projectSearchTerm} onChange={e => setProjectSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-400 focus:border-transparent text-sm bg-gray-50 placeholder-gray-400" />
            <Folder className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          </div>

          {allProjects.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
              <Folder className="h-10 w-10 text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-400 font-medium">Henüz proje yüklenmedi</p>
              <p className="text-xs text-gray-400 mt-1">&quot;JIRA&apos;dan Yenile&quot; butonuna basarak projeleri yükleyin.</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-gray-200 scrollbar-track-transparent">
              {filteredProjects.map(project => {
                const isSelected = draftProjectKeys.has(project.key);
                const isExpanded = expandedProjectKey === project.key;
                const draftProj = draftProjects.find(p => p.project_key === project.key);
                const devCount = draftDevelopers.filter(d => d.project_keys.includes(project.key)).length;

                return (
                  <div key={project.id} className={`rounded-2xl border-2 transition-all duration-200 overflow-hidden ${isSelected ? isExpanded ? 'border-indigo-400 shadow-lg shadow-indigo-100' : 'border-indigo-200 bg-indigo-50/30' : 'border-gray-200 bg-white hover:border-indigo-200 hover:shadow-sm'}`}>
                    <button type="button" onClick={() => handleProjectCardClick(project)} className="w-full flex items-center justify-between px-5 py-4 text-left">
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 font-bold text-xs transition-all ${isSelected ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200' : 'bg-gray-100 text-gray-500'}`}>
                          {isSelected ? <CheckCircle className="h-4 w-4" /> : project.key.slice(0, 2)}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-gray-900">{project.key}</span>
                            <span className="text-xs text-gray-500">{project.name}</span>
                          </div>
                          {isSelected && (
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <Users className="h-3 w-3 text-indigo-400" />
                              <span className="text-xs text-indigo-600 font-medium">{devCount > 0 ? `${devCount} yazılımcı atanmış` : 'Yazılımcı atanmadı'}</span>
                              {draftProj && !draftProj.is_active && <span className="text-xs text-gray-400">(pasif)</span>}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {isSelected && (
                          <>
                            <button type="button" onClick={e => { e.stopPropagation(); handleToggleProject(project.key); }} className="p-1.5 rounded-lg hover:bg-white transition-colors" title={draftProj?.is_active ? 'Pasif yap' : 'Aktif yap'}>
                              {draftProj?.is_active ? <CheckCircle className="h-4 w-4 text-emerald-500" /> : <XCircle className="h-4 w-4 text-gray-400" />}
                            </button>
                            <button type="button" onClick={e => { e.stopPropagation(); handleRemoveProject(project.key); }} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </>
                        )}
                        {isExpanded ? <ChevronUp className="h-4 w-4 text-indigo-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
                      </div>
                    </button>

                    {/* Expanded user panel - Ekibi Kaydet butonu yok, checkbox anlik draft'i gunceller */}
                    {isExpanded && (
                      <div className="border-t border-indigo-100 bg-white px-5 py-4">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <Users className="h-4 w-4 text-indigo-500" />
                            <span className="text-sm font-semibold text-gray-800">{project.key} için yazılımcılar</span>
                          </div>
                          <span className="text-xs text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full font-medium">
                            {draftDevelopers.filter(d => d.project_keys.includes(project.key)).length} seçili
                          </span>
                        </div>

                        {allUsers.length === 0 ? (
                          <p className="text-sm text-gray-400 italic py-4 text-center">Kullanıcı bulunamadı. JIRA bağlantısını kontrol edin.</p>
                        ) : (
                          <>
                            <div className="relative mb-3">
                              <input type="text" placeholder="Yazılımcı ara..." value={userSearchTerm} onChange={e => setUserSearchTerm(e.target.value)} className="w-full pl-8 pr-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-400 focus:border-transparent text-sm bg-gray-50 placeholder-gray-400" />
                              <Users className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-64 overflow-y-auto pr-1">
                              {allUsers
                                .filter(u => u.displayName.toLowerCase().includes(userSearchTerm.toLowerCase()) || (u.emailAddress && u.emailAddress.toLowerCase().includes(userSearchTerm.toLowerCase())))
                                .map(user => {
                                  const checked = draftDevelopers.some(d => d.accountId === user.accountId && d.project_keys.includes(project.key));
                                  return (
                                    <label key={user.accountId} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all border ${checked ? 'bg-indigo-50 border-indigo-200' : 'bg-gray-50 border-transparent hover:border-gray-200'}`}>
                                      <input type="checkbox" checked={checked} onChange={() => toggleUserForProject(project.key, user)} className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-400" />
                                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 ${checked ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-600'}`}>
                                        {user.displayName.charAt(0).toUpperCase()}
                                      </div>
                                      <div className="flex flex-col min-w-0">
                                        <span className="text-sm font-medium text-gray-800 truncate">{user.displayName}</span>
                                        {user.emailAddress && <span className="text-xs text-gray-400 truncate">{user.emailAddress}</span>}
                                      </div>
                                    </label>
                                  );
                                })}
                            </div>
                          </>
                        )}

                        <div className="flex items-center justify-end mt-4">
                          <button type="button" onClick={() => setExpandedProjectKey(null)} className="px-4 py-2 rounded-xl text-sm font-medium text-gray-600 border border-gray-200 hover:bg-gray-50 transition-colors">
                            Kapat
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {draftDevelopers.length > 0 && (
            <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Seçilen Yazılımcılar</h4>
              <div className="flex flex-wrap gap-2">
                {draftDevelopers.map(dev => (
                  <div key={dev.accountId} className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-1.5">
                    <div className="w-5 h-5 rounded-md bg-indigo-100 flex items-center justify-center text-indigo-700 text-xs font-bold">{dev.displayName.charAt(0)}</div>
                    <span className="text-xs font-medium text-gray-700">{dev.displayName}</span>
                    <button onClick={() => handleRemoveDeveloper(dev.accountId)} className="text-gray-300 hover:text-red-400 transition-colors"><XCircle className="h-3.5 w-3.5" /></button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between pt-2">
            <span className="text-xs text-gray-400">
              {activeProjectCount > 0 && activeDeveloperCount > 0 ? `${activeProjectCount} proje · ${activeDeveloperCount} yazılımcı seçildi` : 'Devam etmek için en az 1 proje ve 1 yazılımcı seçin.'}
            </span>
            <button type="button" onClick={() => setCurrentStep(2)} disabled={activeProjectCount === 0 || activeDeveloperCount === 0} className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-700 disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed transition-all shadow-sm shadow-indigo-200">
              Devam Et<ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 2 */}
      {currentStep === 2 && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-8 py-8">
          <div className="mb-6">
            <h3 className="text-base font-bold text-gray-900">Analiz Ayarları</h3>
            <p className="text-xs text-gray-400 mt-0.5">Günlük çalışma süresini ve kapasite hesaplamasında kullanılacak birimi belirleyin.</p>
          </div>
          <div className="space-y-6">
            {capacityMetric === 'hours' && (
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-2">Günlük çalışma süresi <span className="font-normal text-gray-400">(saat)</span></label>
                <div className="flex items-center gap-3">
                  <input type="number" min={1} max={24} value={dailyHours} onChange={e => { const v = parseInt(e.target.value || '0', 10); setDailyHours(Number.isNaN(v) ? 0 : v); }} className="w-24 px-3 py-2 border-2 border-gray-200 rounded-xl text-sm font-semibold focus:border-indigo-500 focus:outline-none" />
                  <span className="text-xs text-gray-400 font-medium">saat / gün</span>
                </div>
                <p className="text-xs text-gray-400 mt-2">Toplantılar ve molalar hariç, geliştirme için ayırdığınız ortalama süre.</p>
              </div>
            )}
            {capacityMetric === 'storyPoints' && (
              <>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-2">Günlük kapasite <span className="font-normal text-gray-400">(kaç story point?)</span></label>
                  <div className="flex items-center gap-3">
                    <input type="number" min={1} max={100} value={dailyStoryPoints} onChange={e => { const v = parseInt(e.target.value || '0', 10); setDailyStoryPoints(Number.isNaN(v) ? 0 : v); }} className="w-28 px-3 py-2 border-2 border-gray-200 rounded-xl text-sm font-semibold focus:border-indigo-500 focus:outline-none" />
                    <span className="text-xs text-gray-400 font-medium">story point / gün</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-2">Bir geliştiricinin günde tamamlaması beklenen ortalama story point kapasitesi.</p>
                </div>

                {draftProjects.filter(p => p.is_active).length > 0 && (
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-3">Story Point Field Eşleştirme <span className="font-normal text-gray-400">(her proje için)</span></label>
                    <div className="space-y-3">
                      {draftProjects.filter(p => p.is_active).map(project => {
                        const currentConfig = storyPointFieldConfigs.find(c => c.project_key === project.project_key);
                        return (
                          <div key={project.project_key} className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
                            <div className="w-12 h-12 rounded-lg bg-indigo-600 text-white flex items-center justify-center text-xs font-bold shrink-0">
                              {project.project_key.slice(0, 2)}
                            </div>
                            <div className="flex-1">
                              <div className="text-xs font-semibold text-gray-900 mb-1">{project.project_key}</div>
                              <input
                                type="text"
                                placeholder="örn: customfield_10016 veya Story Points"
                                value={currentConfig?.field_name || ''}
                                onChange={e => {
                                  const newFieldName = e.target.value;
                                  setStoryPointFieldConfigs(prev => {
                                    const existing = prev.find(c => c.project_key === project.project_key);
                                    if (existing) {
                                      return prev.map(c => c.project_key === project.project_key ? { ...c, field_name: newFieldName } : c);
                                    } else {
                                      return [...prev, { project_key: project.project_key, field_name: newFieldName }];
                                    }
                                  });
                                }}
                                className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-xs focus:border-indigo-500 focus:outline-none"
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <p className="text-xs text-gray-400 mt-2">Jira'da Story Point değerini tutan field adını girin (örn: "customfield_10016" veya "Story Points").</p>
                  </div>
                )}
              </>
            )}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-2">Hesaplama tipi <span className="font-normal text-gray-400">(story point mi, saat mi?)</span></label>
              <div className="flex gap-3">
                {[{ value: 'hours', label: 'Saat bazlı' }, { value: 'storyPoints', label: 'Story Point bazlı' }].map(opt => (
                  <button key={opt.value} type="button" onClick={() => setCapacityMetric(opt.value as 'hours' | 'storyPoints')} className={`flex-1 px-4 py-2.5 rounded-xl border-2 text-sm font-medium transition-all ${capacityMetric === opt.value ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-600 hover:border-indigo-200'}`}>
                    {opt.label}{capacityMetric === opt.value && <span className="ml-2 text-xs font-bold">✓</span>}
                  </button>
                ))}
              </div>
              <p className="text-xs text-gray-400 mt-2">Bu seçim sadece gösterim amaçlıdır, Jira filtrelerini etkilemez.</p>
            </div>
          </div>
          <div className="flex items-center justify-between mt-8 pt-6 border-t border-gray-100">
            <button type="button" onClick={() => setCurrentStep(1)} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border border-gray-200 text-gray-600 hover:border-indigo-300 hover:text-indigo-600 transition-all">
              <ArrowLeft className="h-4 w-4" />Geri
            </button>
            <button type="button" onClick={() => setCurrentStep(3)} className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-700 transition-all shadow-sm shadow-indigo-200">
              Özeti Gör<ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 3 */}
      {currentStep === 3 && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-8 py-8">
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center mb-4 shadow-lg shadow-emerald-100">
              <CheckCircle className="h-8 w-8 text-emerald-500" />
            </div>
            <h3 className="text-lg font-bold text-gray-900">Kapasite Planı Hazır!</h3>
            <p className="text-xs text-gray-400 mt-1">Özet bilgileri kontrol edin.</p>
          </div>

          <div className="space-y-3 mb-6">
            <div className="rounded-xl bg-gray-50 border border-gray-100 p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-[0.65rem] font-bold text-gray-400 uppercase tracking-widest">Projeler</h4>
                <span className="text-xs font-semibold text-indigo-600 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-full">{activeProjectCount > 0 ? `${activeProjectCount} aktif` : '0 aktif'}</span>
              </div>
              {draftProjects.length === 0 ? <p className="text-sm text-gray-400">Henüz proje seçilmedi.</p> : (
                <div className="space-y-2">
                  {draftProjects.map(project => {
                    const devCount = draftDevelopers.filter(d => d.project_keys.includes(project.project_key)).length;
                    return (
                      <div key={project.project_key} className="flex items-center justify-between bg-white rounded-lg border border-gray-200 px-3 py-2">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold ${project.is_active ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-400'}`}>{project.project_key.slice(0, 2)}</div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-sm font-semibold text-gray-800">{project.project_key}</span>
                              {!project.is_active && <span className="text-[0.6rem] font-semibold text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full uppercase">Pasif</span>}
                            </div>
                            <span className="text-xs text-gray-400">{project.project_name}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-gray-500">
                          <Users className="h-3.5 w-3.5" />
                          <span>{devCount > 0 ? `${devCount} yazılımcı` : 'Atanmadı'}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="rounded-xl bg-gray-50 border border-gray-100 p-4">
              <h4 className="text-[0.65rem] font-bold text-gray-400 uppercase tracking-widest mb-3">Ekip</h4>
              {activeDeveloperCount === 0 ? <p className="text-sm text-gray-400">Henüz aktif yazılımcı yok.</p> : (
                <div className="flex flex-wrap gap-2">
                  {draftDevelopers.map(dev => (
                    <span key={dev.accountId} className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-50 border border-indigo-100 px-3 py-1 text-xs font-semibold text-indigo-700">
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />{dev.displayName}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-xl bg-gray-50 border border-gray-100 p-4">
              <h4 className="text-[0.65rem] font-bold text-gray-400 uppercase tracking-widest mb-3">Ayarlar</h4>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between border-b border-gray-200 pb-2">
                  <span className="text-gray-500">Günlük hedef</span>
                  <span className="font-bold text-gray-900">{capacityMetric === 'hours' ? `${dailyHours} saat/gün` : `${dailyStoryPoints} SP/gün`}</span>
                </div>
                <div className="flex items-center justify-between pt-1">
                  <span className="text-gray-500">Hesaplama tipi</span>
                  <span className="font-bold text-gray-900">{capacityMetric === 'hours' ? 'Saat bazlı' : 'Story Point bazlı'}</span>
                </div>
              </div>
            </div>
          </div>

          {(planSaveMessage || planSaveError) && (
            <div className={`mb-4 rounded-xl border px-4 py-3 text-xs ${planSaveError ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
              {planSaveError || planSaveMessage}
            </div>
          )}

          <div className="flex flex-col gap-3">
            <button type="button" disabled={activeProjectCount === 0 || activeDeveloperCount === 0 || savingPlan} onClick={handleConfirm} className="w-full flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl text-sm font-bold bg-emerald-500 text-white hover:bg-emerald-600 disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed transition-all shadow-md shadow-emerald-200">
              {savingPlan ? (<><div className="h-4 w-4 rounded-full border-2 border-emerald-200 border-t-emerald-600 animate-spin" />Kaydediliyor...</>) : (<><CheckCircle className="h-4 w-4" />Planı Onayla & Devam Et</>)}
            </button>
            <button type="button" onClick={() => setCurrentStep(2)} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border border-gray-200 text-gray-600 hover:border-indigo-300 hover:text-indigo-600 transition-all">
              <ArrowLeft className="h-4 w-4" />Ayarları Düzenle
            </button>
          </div>
        </div>
      )}

      <div className="flex items-start gap-3 bg-indigo-50 border border-indigo-100 rounded-xl p-4">
        <AlertCircle className="h-4 w-4 text-indigo-400 mt-0.5 flex-shrink-0" />
        <p className="text-xs text-indigo-700">
          <strong>Not:</strong> Seçtiğiniz projeler ve yazılımcılar tüm raporlarda filtreleme için kullanılır. Aktif/pasif durumlarını değiştirerek filtreleri geçici olarak açıp kapatabilirsiniz.
        </p>
      </div>
    </div>
  );
};