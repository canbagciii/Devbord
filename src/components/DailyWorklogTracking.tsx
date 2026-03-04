import React, { useState, useEffect } from 'react';
import { worklogService } from '../services/worklogService';
import { kolayikService } from '../services/kolayikService';
import { DeveloperWorklogData, WorklogAnalytics } from '../types/worklog';
import { DeveloperLeaveInfo } from '../types/kolayik';
import { getWeekRange, getMonthRange } from '../utils/dateUtils';
import { useAuth } from '../context/AuthContext';
import { useJiraData } from '../context/JiraDataContext';
import { jiraService } from '../lib/jiraService';
import {
  Calendar,
  Clock,
  Users,
  TrendingUp,
  Download,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  CheckCircle,
  Info,
  CalendarDays,
  Loader,
  Briefcase,
  Settings
} from 'lucide-react';

type ViewMode = 'weekly' | 'monthly';

const DailyWorklogTracking: React.FC = () => {
  const { user, canViewDeveloperData, hasKolayIK } = useAuth();
  const { getDeveloperProjectKey, developerProjectMapReady, lastRefreshAt } = useJiraData();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('weekly');
  const [worklogData, setWorklogData] = useState<DeveloperWorklogData[]>([]);
  const [analytics, setAnalytics] = useState<WorklogAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedDevelopers, setExpandedDevelopers] = useState<Set<string>>(new Set());
  const [leaveData, setLeaveData] = useState<DeveloperLeaveInfo[]>([]);
  const [leaveLoading, setLeaveLoading] = useState(false);
  const [leaveError, setLeaveError] = useState<string | null>(null);
  const [capacityAdjustmentEnabled, setCapacityAdjustmentEnabled] = useState(true);
  const [selectedDeveloper, setSelectedDeveloper] = useState<string>('all');
  const [showStoryPointConfig, setShowStoryPointConfig] = useState(false);
  const [storyPointFields, setStoryPointFields] = useState<Array<{ id: string; name: string }>>([]);
  const [loadingFields, setLoadingFields] = useState(false);
  const [selectedStoryPointField, setSelectedStoryPointField] = useState<string>('');
  const [estimationType, setEstimationType] = useState<'hours' | 'story_points'>('hours');

  const dateRange = viewMode === 'weekly'
    ? getWeekRange(currentDate)
    : getMonthRange(currentDate);

  useEffect(() => {
    const storedEstimationType = localStorage.getItem('estimationType') as 'hours' | 'story_points' | null;
    const storedStoryPointField = localStorage.getItem('selectedStoryPointField');

    if (storedEstimationType) {
      setEstimationType(storedEstimationType);
    }
    if (storedStoryPointField) {
      setSelectedStoryPointField(storedStoryPointField);
    }
  }, []);

  const loadStoryPointFields = async () => {
    setLoadingFields(true);
    try {
      const fields = await jiraService.getStoryPointFields();
      setStoryPointFields(fields);
      if (fields.length === 0) {
        alert('Jira\'da story point içeren field bulunamadı.');
      }
    } catch (error) {
      console.error('Story point fields yüklenirken hata:', error);
      alert('Story point field\'ları yüklenirken hata oluştu.');
    } finally {
      setLoadingFields(false);
    }
  };

  const handleEstimationTypeChange = async (type: 'hours' | 'story_points') => {
    setEstimationType(type);
    localStorage.setItem('estimationType', type);

    if (type === 'story_points' && storyPointFields.length === 0) {
      await loadStoryPointFields();
      setShowStoryPointConfig(true);
    }
  };

  const handleStoryPointFieldSelect = (fieldId: string) => {
    setSelectedStoryPointField(fieldId);
    localStorage.setItem('selectedStoryPointField', fieldId);
    setShowStoryPointConfig(false);
  };

  const getCapacityTarget = (): number => {
    try {
      if (typeof localStorage !== 'undefined') {
        const metric = localStorage.getItem('capacityMetric');
        if (metric === 'hours') {
          const stored = localStorage.getItem('dailyHours');
          const parsed = stored ? parseFloat(stored) : NaN;
          const daily = Number.isFinite(parsed) && parsed > 0 ? parsed : 7;
          if (viewMode === 'weekly') return Math.round(daily * 5);
          const workingDays = dateRange.dates.filter(date => {
            const dayOfWeek = new Date(date).getDay();
            return dayOfWeek >= 1 && dayOfWeek <= 5;
          }).length;
          return Math.round(daily * workingDays);
        }
      }
    } catch (e) {
      console.warn('Günlük kapasite konfigürasyonu okunamadı, varsayılan hedef kullanılacak:', e);
    }
    if (viewMode === 'weekly') return 35;
    const workingDays = dateRange.dates.filter(date => {
      const dayOfWeek = new Date(date).getDay();
      return dayOfWeek >= 1 && dayOfWeek <= 5;
    }).length;
    return workingDays * 7;
  };

  const applyLeaveAdjustments = (data: DeveloperWorklogData[], leaveInfo: DeveloperLeaveInfo[]): DeveloperWorklogData[] => {
    return data.map(developer => {
      const normalizeName = (name: string) => name
        .toLocaleLowerCase('tr')
        .replace(/ı/g, 'i').replace(/ş/g, 's').replace(/ç/g, 'c')
        .replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ö/g, 'o')
        .replace(/İ/g, 'i').replace(/Ş/g, 's').replace(/Ç/g, 'c')
        .replace(/Ğ/g, 'g').replace(/Ü/g, 'u').replace(/Ö/g, 'o')
        .replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();

      const normalizedDevName = normalizeName(developer.developerName);
      const developerLeave = leaveInfo.find(leave => {
        const normalizedLeaveName = normalizeName(leave.developerName);
        const normalizedLeaveEmail = leave.email ? normalizeName(leave.email) : '';
        const normalizedDevEmail = developer.email ? normalizeName(developer.email) : '';
        return normalizedLeaveName === normalizedDevName || (normalizedLeaveEmail && normalizedDevEmail && normalizedLeaveEmail === normalizedDevEmail);
      });

      if (!developerLeave || developerLeave.leaveDays === 0) return developer;

      let originalTarget = 35;
      try {
        const metric = typeof localStorage !== 'undefined' ? localStorage.getItem('capacityMetric') : null;
        if (metric === 'hours') {
          const stored = typeof localStorage !== 'undefined' ? localStorage.getItem('dailyHours') : null;
          const parsed = stored ? parseFloat(stored) : NaN;
          const daily = Number.isFinite(parsed) && parsed > 0 ? parsed : 7;
          originalTarget = Math.round(daily * 5);
        }
      } catch (e) { console.warn('Günlük kapasite konfigürasyonu okunamadı, 35h varsayılan kullanılacak:', e); }

      const leaveDays = developerLeave.leaveDays;
      const adjustedTarget = Math.max(0, originalTarget - (leaveDays * 7));
      let newWeeklyStatus: 'sufficient' | 'insufficient' | 'excessive';
      if (developer.weeklyTotal < adjustedTarget * 0.9) newWeeklyStatus = 'insufficient';
      else if (developer.weeklyTotal <= adjustedTarget * 1.1) newWeeklyStatus = 'sufficient';
      else newWeeklyStatus = 'excessive';

      return { ...developer, weeklyTarget: adjustedTarget, weeklyStatus: newWeeklyStatus };
    });
  };

  const filterWorklogDataByRole = (data: DeveloperWorklogData[]): DeveloperWorklogData[] => {
    if (!user) return [];
    if (user.role === 'admin') return data;
    if (user.role === 'developer') return data.filter(dev => canViewDeveloperData(dev.developerName));
    if (user.role === 'analyst') {
      const analystProjects = user.assignedProjects || [];
      return data.filter(dev => {
        const developerProject = getDeveloperProjectKey(dev.developerName);
        return developerProject && analystProjects.includes(developerProject);
      });
    }
    return [];
  };

  const loadWorklogData = async () => {
    setLoading(true);
    setError(null);
    try {
      let data: DeveloperWorklogData[];
      let analyticsData: WorklogAnalytics;
      let filteredData: DeveloperWorklogData[];

      if (capacityAdjustmentEnabled && canViewDeveloperData && hasKolayIK) {
        let leaveInfo: DeveloperLeaveInfo[] = [];
        try {
          setLeaveLoading(true);
          const allDeveloperNames = await worklogService['getAllowedDevelopers']();
          leaveInfo = await kolayikService.getDeveloperLeaveInfo(allDeveloperNames, dateRange.start, dateRange.end);
          setLeaveData(leaveInfo);

          if (viewMode === 'weekly') {
            data = await worklogService.getDeveloperWorklogData(dateRange.start, dateRange.end);
            filteredData = filterWorklogDataByRole(data);
            filteredData = applyLeaveAdjustments(filteredData, leaveInfo);
            const baseTarget = getCapacityTarget();
            filteredData = filteredData.map(dev => {
              const developerLeave = leaveInfo.find(leave => leave.developerName === dev.developerName);
              if (developerLeave && developerLeave.leaveDays > 0) return dev;
              return { ...dev, weeklyTarget: baseTarget };
            });
          } else {
            data = await worklogService.getMonthlyWorklogData(dateRange.start, dateRange.end, leaveInfo);
            filteredData = filterWorklogDataByRole(data);
            const baseTarget = getCapacityTarget();
            filteredData = filteredData.map(dev => ({ ...dev, weeklyTarget: baseTarget }));
          }
        } catch (leaveErr) {
          console.error('❌ Error loading leave data:', leaveErr);
          setLeaveError(leaveErr instanceof Error ? leaveErr.message : 'İzin verileri yüklenirken hata oluştu');
          if (viewMode === 'weekly') data = await worklogService.getDeveloperWorklogData(dateRange.start, dateRange.end);
          else data = await worklogService.getMonthlyWorklogData(dateRange.start, dateRange.end);
          filteredData = filterWorklogDataByRole(data);
          const baseTarget = getCapacityTarget();
          filteredData = filteredData.map(dev => ({ ...dev, weeklyTarget: baseTarget }));
        } finally {
          setLeaveLoading(false);
        }
      } else {
        if (viewMode === 'weekly') data = await worklogService.getDeveloperWorklogData(dateRange.start, dateRange.end);
        else data = await worklogService.getMonthlyWorklogData(dateRange.start, dateRange.end);
        filteredData = filterWorklogDataByRole(data);
        const baseTarget = getCapacityTarget();
        filteredData = filteredData.map(dev => ({ ...dev, weeklyTarget: baseTarget }));
      }

      analyticsData = await worklogService.getWorklogAnalytics(dateRange.start, dateRange.end);
      setWorklogData(filteredData);
      setAnalytics(analyticsData);
    } catch (err) {
      console.error('Error loading worklog data:', err);
      setError(err instanceof Error ? err.message : 'Worklog verileri yüklenirken hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const needsMapForFilter = user?.role === 'analyst' || user?.role === 'developer';
    if (needsMapForFilter && !developerProjectMapReady) return;
    loadWorklogData();
  }, [currentDate, viewMode, capacityAdjustmentEnabled, developerProjectMapReady, user?.role, lastRefreshAt]);

  const navigateDate = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate);
    if (viewMode === 'weekly') newDate.setDate(newDate.getDate() + (direction === 'next' ? 7 : -7));
    else newDate.setMonth(newDate.getMonth() + (direction === 'next' ? 1 : -1));
    setCurrentDate(newDate);
  };

  const goToToday = () => setCurrentDate(new Date());

  const exportToCSV = () => {
    const dataToExport = selectedDeveloper === 'all' ? worklogData : filteredWorklogData;
    if (dataToExport.length === 0) { alert('İndirilecek veri bulunamadı.'); return; }

    const csvHeaders = [
      'Yazılımcı', 'E-posta',
      viewMode === 'weekly' ? 'Haftalık Toplam (saat)' : 'Aylık Toplam (saat)',
      viewMode === 'weekly' ? 'Haftalık Hedef (saat)' : 'Aylık Hedef (saat)',
      'Durum', 'İzin Günleri', 'Kapasite Ayarlaması',
      ...dateRange.dates.map(date => new Date(date).toLocaleDateString('tr-TR'))
    ];

    const csvData = dataToExport.map(dev => {
      const developerLeave = leaveData.find(leave => leave.developerName === dev.developerName);
      const leaveDays = developerLeave?.leaveDays || 0;
      let originalTarget: number;
      try {
        const metric = typeof localStorage !== 'undefined' ? localStorage.getItem('capacityMetric') : null;
        if (metric === 'hours') {
          const stored = typeof localStorage !== 'undefined' ? localStorage.getItem('dailyHours') : null;
          const parsed = stored ? parseFloat(stored) : NaN;
          const daily = Number.isFinite(parsed) && parsed > 0 ? parsed : 7;
          if (viewMode === 'weekly') originalTarget = Math.round(daily * 5);
          else {
            const workingDays = dateRange.dates.filter(date => { const d = new Date(date).getDay(); return d >= 1 && d <= 5; }).length;
            originalTarget = Math.round(daily * workingDays);
          }
        } else {
          originalTarget = viewMode === 'weekly' ? 35 : dateRange.dates.filter(date => { const d = new Date(date).getDay(); return d >= 1 && d <= 5; }).length * 7;
        }
      } catch (e) {
        originalTarget = viewMode === 'weekly' ? 35 : dateRange.dates.filter(date => { const d = new Date(date).getDay(); return d >= 1 && d <= 5; }).length * 7;
      }
      const capacityAdjustment = leaveDays > 0 ? `${originalTarget}h → ${dev.weeklyTarget}h (-${leaveDays * 7}h)` : 'Ayarlama yok';
      return [dev.developerName, dev.email, dev.weeklyTotal, dev.weeklyTarget,
        dev.weeklyStatus === 'sufficient' ? 'Yeterli' : dev.weeklyStatus === 'insufficient' ? 'Eksik' : 'Fazla',
        leaveDays, capacityAdjustment, ...dev.dailySummaries.map(day => day.totalHours)];
    });

    const csvContent = [csvHeaders.join(','), ...csvData.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))].join('\n');
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `gunluk_sure_takibi_${viewMode}_${dateRange.start}_${dateRange.end}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const refresh = () => {
    worklogService.clearCache();
    kolayikService.clearCache();
    loadWorklogData();
  };

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'sufficient': return { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-500', bar: 'bg-emerald-500', label: 'Yeterli' };
      case 'insufficient': return { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', dot: 'bg-red-500', bar: 'bg-red-500', label: 'Eksik' };
      case 'excessive': return { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', dot: 'bg-blue-500', bar: 'bg-blue-500', label: 'Fazla' };
      default: return { bg: 'bg-slate-50', text: 'text-slate-600', border: 'border-slate-200', dot: 'bg-slate-400', bar: 'bg-slate-400', label: 'Veri Yok' };
    }
  };

  const filteredWorklogData = selectedDeveloper === 'all'
    ? worklogData
    : worklogData.filter(dev => dev.developerName === selectedDeveloper);

  const getInitials = (name: string) => name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

  const avatarColors = [
    'from-violet-500 to-purple-600',
    'from-blue-500 to-cyan-600',
    'from-emerald-500 to-teal-600',
    'from-orange-500 to-amber-600',
    'from-rose-500 to-pink-600',
    'from-indigo-500 to-blue-600',
  ];

  return (
    <div className="space-y-5 p-1">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Günlük Süre Takibi</h2>
          <p className="text-slate-500 mt-0.5 text-sm">
            Yazılımcıların günlük worklog kayıtları ve haftalık hedef takibi
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={exportToCSV}
            disabled={filteredWorklogData.length === 0}
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm hover:shadow"
          >
            <Download className="h-4 w-4" />
            CSV İndir
          </button>
          <button
            onClick={refresh}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 text-white text-sm font-medium rounded-lg hover:bg-slate-700 disabled:opacity-40 transition-all shadow-sm hover:shadow"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Yenile
          </button>
        </div>
      </div>

      {/* Story Point Configuration Modal */}
      {showStoryPointConfig && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-900">Story Point Field Seçimi</h3>
              <button
                onClick={() => setShowStoryPointConfig(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <ChevronUp className="h-5 w-5" />
              </button>
            </div>

            {loadingFields ? (
              <div className="flex items-center justify-center py-8">
                <Loader className="h-6 w-6 animate-spin text-blue-600" />
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-slate-600">
                  Jira'nızda kullanılan story point field'ını seçin:
                </p>
                {storyPointFields.length === 0 ? (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-700">
                    Hiç story point field bulunamadı. Lütfen Jira ayarlarınızı kontrol edin.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {storyPointFields.map((field) => (
                      <button
                        key={field.id}
                        onClick={() => handleStoryPointFieldSelect(field.id)}
                        className={`w-full text-left px-4 py-3 rounded-lg border-2 transition-all ${
                          selectedStoryPointField === field.id
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-slate-200 hover:border-slate-300 bg-white'
                        }`}
                      >
                        <div className="font-medium text-slate-900">{field.name}</div>
                        <div className="text-xs text-slate-500 mt-1">{field.id}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Controls Bar */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            {/* Estimation Type Toggle */}
            <div className="flex items-center bg-slate-100 rounded-lg p-1 gap-0.5">
              <button
                onClick={() => handleEstimationTypeChange('hours')}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                  estimationType === 'hours'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Saat Bazlı
              </button>
              <button
                onClick={() => handleEstimationTypeChange('story_points')}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                  estimationType === 'story_points'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Story Point Bazlı
              </button>
            </div>

            {/* Story Point Config Button */}
            {estimationType === 'story_points' && (
              <button
                onClick={() => setShowStoryPointConfig(true)}
                className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-700 text-sm font-medium rounded-lg hover:bg-blue-100 transition-colors border border-blue-200"
              >
                <Settings className="h-4 w-4" />
                Field Ayarla
                {selectedStoryPointField && (
                  <CheckCircle className="h-3.5 w-3.5 text-blue-600" />
                )}
              </button>
            )}

            {/* View Mode Toggle */}
            <div className="flex items-center bg-slate-100 rounded-lg p-1 gap-0.5">
              <button
                onClick={() => setViewMode('weekly')}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                  viewMode === 'weekly'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Haftalık
              </button>
              <button
                onClick={() => setViewMode('monthly')}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                  viewMode === 'monthly'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Aylık
              </button>
            </div>

            {/* Capacity Adjustment Toggle */}
            {viewMode === 'weekly' && hasKolayIK && (
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <div className="relative">
                  <input
                    type="checkbox"
                    id="capacityAdjustment"
                    checked={capacityAdjustmentEnabled}
                    onChange={(e) => setCapacityAdjustmentEnabled(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-slate-200 peer-checked:bg-blue-600 rounded-full transition-colors peer-focus:ring-2 peer-focus:ring-blue-500 peer-focus:ring-offset-1"></div>
                  <div className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform peer-checked:translate-x-4"></div>
                </div>
                <span className="text-sm text-slate-600 font-medium">İzin Günlerine Göre Kapasite Ayarla</span>
              </label>
            )}

            {/* Developer Filter */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-500 font-medium">Yazılımcı:</span>
              <select
                value={selectedDeveloper}
                onChange={(e) => setSelectedDeveloper(e.target.value)}
                className="border border-slate-200 bg-white rounded-lg px-3 py-1.5 text-sm text-slate-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none cursor-pointer hover:border-slate-300 transition-colors"
              >
                <option value="all">Tümü ({worklogData.length})</option>
                {worklogData.map(dev => (
                  <option key={dev.developerName} value={dev.developerName}>{dev.developerName}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Date Navigation */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigateDate('prev')}
              className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            <div className="text-center min-w-[180px]">
              <p className="text-sm font-semibold text-slate-800">
                {viewMode === 'weekly' ? dateRange.weekLabel : dateRange.monthLabel}
              </p>
              <p className="text-xs text-slate-400">{dateRange.start} – {dateRange.end}</p>
            </div>

            <button
              onClick={() => navigateDate('next')}
              className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>

            <button
              onClick={goToToday}
              className="px-3 py-1.5 bg-slate-800 text-white text-sm font-medium rounded-lg hover:bg-slate-700 transition-colors"
            >
              Bu Hafta
            </button>
          </div>
        </div>
      </div>

      {/* Leave Integration Panel */}
      {viewMode === 'weekly' && capacityAdjustmentEnabled && hasKolayIK && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
                <CalendarDays className="h-4 w-4 text-blue-600" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-800">İzin Entegrasyonu</h3>
                <p className="text-xs text-slate-500">Haftalık kapasiteler izin günlerine göre otomatik ayarlanıyor</p>
              </div>
            </div>
            {leaveLoading && (
              <div className="flex items-center gap-2 text-blue-600 text-xs">
                <Loader className="h-3.5 w-3.5 animate-spin" />
                <span>Yükleniyor...</span>
              </div>
            )}
          </div>

          {leaveError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-500 flex-shrink-0" />
              <p className="text-red-700 text-xs">{leaveError}</p>
            </div>
          )}

          {!leaveLoading && !leaveError && leaveData.length > 0 && (
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-2.5 flex items-center gap-3">
                <Users className="h-4 w-4 text-blue-500 flex-shrink-0" />
                <span className="text-xs font-medium text-blue-800">
                  {leaveData.filter(l => l.leaveDays > 0).length} yazılımcının izni var
                </span>
              </div>
              <div className="bg-amber-50 border border-amber-100 rounded-lg px-4 py-2.5 flex items-center gap-3">
                <Clock className="h-4 w-4 text-amber-500 flex-shrink-0" />
                <span className="text-xs font-medium text-amber-800">
                  {leaveData.reduce((sum, l) => sum + l.leaveDays, 0)} toplam izin günü
                </span>
              </div>
              <div className="bg-emerald-50 border border-emerald-100 rounded-lg px-4 py-2.5 flex items-center gap-3">
                <CheckCircle className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                <span className="text-xs font-medium text-emerald-800">Kapasiteler otomatik ayarlandı</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="h-4 w-4 text-red-500" />
            <p className="text-red-700 text-sm font-medium">{error}</p>
          </div>
          <button onClick={refresh} className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors">
            Tekrar Dene
          </button>
        </div>
      )}

      {/* Analytics Cards */}
      {analytics && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Toplam Yazılımcı', value: analytics.totalDevelopers, suffix: '', icon: Users, color: 'text-violet-600', bg: 'bg-violet-50', iconBg: 'bg-violet-100' },
            { label: 'Toplam Süre', value: analytics.totalHours, suffix: 'h', icon: Clock, color: 'text-emerald-600', bg: 'bg-emerald-50', iconBg: 'bg-emerald-100' },
            { label: 'Ortalama Günlük', value: analytics.averageDailyHours, suffix: 'h', icon: TrendingUp, color: 'text-blue-600', bg: 'bg-blue-50', iconBg: 'bg-blue-100' },
            { label: 'Çalışılan İş', value: analytics.totalWorklogEntries, suffix: '', icon: Calendar, color: 'text-orange-600', bg: 'bg-orange-50', iconBg: 'bg-orange-100' },
          ].map((card) => (
            <div key={card.label} className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex items-center gap-4">
              <div className={`w-11 h-11 ${card.iconBg} rounded-xl flex items-center justify-center flex-shrink-0`}>
                <card.icon className={`h-5 w-5 ${card.color}`} />
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium">{card.label}</p>
                <p className={`text-2xl font-bold ${card.color} leading-tight`}>{card.value}{card.suffix}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-16 bg-white rounded-xl border border-slate-200">
          <div className="flex flex-col items-center gap-3">
            <Loader className="h-7 w-7 animate-spin text-blue-600" />
            <span className="text-slate-500 text-sm">
              {viewMode === 'weekly' ? 'Haftalık' : 'Aylık'} worklog verileri yükleniyor…
            </span>
          </div>
        </div>
      )}

      {/* Worklog Data Table */}
      {!loading && filteredWorklogData.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          {/* Table Header */}
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-base font-semibold text-slate-800">
              {viewMode === 'weekly' ? 'Haftalık' : 'Aylık'} Süre Takibi
            </h3>
            {viewMode === 'weekly' && capacityAdjustmentEnabled && hasKolayIK && leaveData.some(l => l.leaveDays > 0) && (
              <div className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-100 px-3 py-1 rounded-full">
                <CalendarDays className="h-3.5 w-3.5" />
                İzin ayarlaması aktif
              </div>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="px-6 py-3 text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    Yazılımcı
                  </th>
                  {dateRange.dates.map(date => (
                    <th key={date} className="px-3 py-3 text-center text-[11px] font-semibold text-slate-400 uppercase tracking-wider whitespace-nowrap">
                      {new Date(date).toLocaleDateString('tr-TR', { weekday: 'short', day: 'numeric', month: 'short' })}
                    </th>
                  ))}
                  <th className="px-4 py-3 text-center text-[11px] font-semibold text-slate-400 uppercase tracking-wider whitespace-nowrap">
                    {viewMode === 'weekly' ? 'Haftalık' : 'Aylık'} Toplam
                  </th>
                  <th className="px-4 py-3 text-center text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Hedef</th>
                  <th className="px-4 py-3 text-center text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Durum</th>
                  {viewMode === 'weekly' && capacityAdjustmentEnabled && hasKolayIK && (
                    <th className="px-4 py-3 text-center text-[11px] font-semibold text-slate-400 uppercase tracking-wider whitespace-nowrap">İzin Etkisi</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredWorklogData.map((developer, index) => {
                  const developerLeave = leaveData.find(leave => leave.developerName === developer.developerName);
                  const hasLeave = developerLeave && developerLeave.leaveDays > 0;
                  let originalTarget: number;
                  try {
                    const metric = typeof localStorage !== 'undefined' ? localStorage.getItem('capacityMetric') : null;
                    if (metric === 'hours') {
                      const stored = typeof localStorage !== 'undefined' ? localStorage.getItem('dailyHours') : null;
                      const parsed = stored ? parseFloat(stored) : NaN;
                      const daily = Number.isFinite(parsed) && parsed > 0 ? parsed : 7;
                      if (viewMode === 'weekly') originalTarget = Math.round(daily * 5);
                      else {
                        const workingDays = dateRange.dates.filter(date => { const d = new Date(date).getDay(); return d >= 1 && d <= 5; }).length;
                        originalTarget = Math.round(daily * workingDays);
                      }
                    } else {
                      originalTarget = viewMode === 'weekly' ? 35 : dateRange.dates.filter(date => { const d = new Date(date).getDay(); return d >= 1 && d <= 5; }).length * 7;
                    }
                  } catch {
                    originalTarget = viewMode === 'weekly' ? 35 : dateRange.dates.filter(date => { const d = new Date(date).getDay(); return d >= 1 && d <= 5; }).length * 7;
                  }

                  const isExpanded = expandedDevelopers.has(developer.developerName);
                  const toggleExpanded = () => {
                    const newExpanded = new Set(expandedDevelopers);
                    if (isExpanded) newExpanded.delete(developer.developerName);
                    else newExpanded.add(developer.developerName);
                    setExpandedDevelopers(newExpanded);
                  };

                  const statusConfig = getStatusConfig(developer.weeklyStatus);
                  const avatarGradient = avatarColors[index % avatarColors.length];
                  const progressPct = Math.min(100, (developer.weeklyTotal / developer.weeklyTarget) * 100);

                  return (
                    <React.Fragment key={developer.developerName}>
                      <tr className="hover:bg-slate-50/70 transition-colors group">
                        <td className="px-6 py-3.5">
                          <div className="flex items-center gap-3">
                            <button
                              onClick={toggleExpanded}
                              className="flex-shrink-0 w-6 h-6 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded transition-colors"
                            >
                              {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                            </button>
                            <div className={`flex-shrink-0 w-8 h-8 bg-gradient-to-br ${avatarGradient} rounded-full flex items-center justify-center shadow-sm`}>
                              <span className="text-[11px] font-bold text-white">{getInitials(developer.developerName)}</span>
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-slate-800 leading-tight">{developer.developerName}</p>
                              <p className="text-xs text-slate-400 leading-tight">{developer.email}</p>
                              {hasLeave && viewMode === 'weekly' && capacityAdjustmentEnabled && hasKolayIK && (
                                <div className="flex items-center gap-1 mt-0.5">
                                  <CalendarDays className="h-3 w-3 text-amber-500" />
                                  <span className="text-[11px] text-amber-600 font-medium">{developerLeave.leaveDays} gün izin</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Daily Hours */}
                        {developer.dailySummaries.map((day) => (
                          <td key={day.date} className="px-3 py-3.5 text-center">
                            <span className={`text-sm font-semibold tabular-nums ${
                              day.totalHours === 0 ? 'text-slate-300' :
                              day.totalHours >= 7 ? 'text-emerald-600' :
                              day.totalHours >= 5 ? 'text-amber-500' : 'text-red-500'
                            }`}>
                              {day.totalHours > 0 ? `${day.totalHours}h` : '–'}
                            </span>
                          </td>
                        ))}

                        {/* Total */}
                        <td className="px-4 py-3.5 text-center">
                          <span className="text-sm font-bold text-slate-800 tabular-nums">{developer.weeklyTotal}h</span>
                        </td>

                        {/* Target */}
                        <td className="px-4 py-3.5 text-center">
                          <span className="text-sm font-medium text-slate-600 tabular-nums">{developer.weeklyTarget}h</span>
                          {hasLeave && viewMode === 'weekly' && capacityAdjustmentEnabled && hasKolayIK && (
                            <p className="text-[11px] text-amber-500 mt-0.5">(orijinal: {originalTarget}h)</p>
                          )}
                        </td>

                        {/* Status */}
                        <td className="px-4 py-3.5 text-center">
                          <div className="flex flex-col items-center gap-1.5">
                            <span className={`inline-flex px-2.5 py-0.5 text-[11px] font-semibold rounded-full border ${statusConfig.bg} ${statusConfig.text} ${statusConfig.border}`}>
                              {statusConfig.label}
                            </span>
                            <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-500 ${statusConfig.bar}`}
                                style={{ width: `${progressPct}%` }}
                              />
                            </div>
                          </div>
                        </td>

                        {/* Leave Impact */}
                        {viewMode === 'weekly' && capacityAdjustmentEnabled && hasKolayIK && (
                          <td className="px-4 py-3.5 text-center">
                            {hasLeave ? (
                              <div>
                                <p className="text-sm font-semibold text-amber-600">-{developerLeave.leaveDays * 7}h</p>
                                <p className="text-[11px] text-slate-400">{developerLeave.leaveDays} gün izin</p>
                              </div>
                            ) : (
                              <span className="text-xs text-slate-300">İzin yok</span>
                            )}
                          </td>
                        )}
                      </tr>

                      {/* Expanded Details */}
                      {isExpanded && (
                        <tr className="bg-slate-50/60">
                          <td colSpan={dateRange.dates.length + 4 + (viewMode === 'weekly' && capacityAdjustmentEnabled && hasKolayIK ? 1 : 0)} className="px-6 py-4">
                            <div className="space-y-4">
                              {/* Leave Details */}
                              {hasLeave && viewMode === 'weekly' && capacityAdjustmentEnabled && hasKolayIK && (
                                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                                  <div className="flex items-center gap-2 mb-2">
                                    <CalendarDays className="h-4 w-4 text-amber-600" />
                                    <span className="text-sm font-semibold text-amber-800">İzin Detayları</span>
                                  </div>
                                  <div className="space-y-1">
                                    {developerLeave.leaveDetails.map((leave, idx) => (
                                      <div key={idx} className="text-xs text-amber-700">
                                        <span className="font-semibold">{leave.leaveType}:</span>{' '}
                                        {new Date(leave.startDate).toLocaleDateString('tr-TR')} –{' '}
                                        {new Date(leave.endDate).toLocaleDateString('tr-TR')}{' '}
                                        ({leave.days} gün)
                                        {leave.description && <span className="italic text-amber-600"> – {leave.description}</span>}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Monthly Project Summary */}
                              {viewMode === 'monthly' && (
                                <div className="bg-white border border-slate-200 rounded-lg p-4">
                                  <div className="flex items-center gap-2 mb-3">
                                    <Briefcase className="h-4 w-4 text-blue-600" />
                                    <h4 className="text-sm font-semibold text-slate-800">Proje Bazlı Özet</h4>
                                  </div>
                                  {(() => {
                                    const allEntries = developer.dailySummaries.flatMap(day => day.entries);
                                    const projectHours = allEntries.reduce((acc, entry) => {
                                      const project = entry.project || 'Bilinmeyen Proje';
                                      acc[project] = (acc[project] || 0) + entry.timeSpentHours;
                                      return acc;
                                    }, {} as Record<string, number>);
                                    const sortedProjects = Object.entries(projectHours).sort(([, a], [, b]) => b - a);

                                    if (sortedProjects.length === 0) {
                                      return <p className="text-sm text-slate-500 text-center py-3">Bu dönemde kayıtlı proje çalışması bulunamadı.</p>;
                                    }

                                    return (
                                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                        {sortedProjects.map(([project, hours]) => (
                                          <div key={project} className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                                            <div className="flex items-center justify-between mb-2">
                                              <span className="text-sm font-medium text-slate-700 truncate flex-1 mr-2">{project}</span>
                                              <span className="text-sm font-bold text-blue-600 whitespace-nowrap tabular-nums">{Math.round(hours * 100) / 100}h</span>
                                            </div>
                                            <div className="w-full bg-slate-200 rounded-full h-1.5">
                                              <div className="bg-blue-500 h-1.5 rounded-full transition-all duration-300" style={{ width: `${(hours / developer.weeklyTotal) * 100}%` }} />
                                            </div>
                                            <p className="mt-1 text-[11px] text-slate-400">{Math.round((hours / developer.weeklyTotal) * 100)}% toplam</p>
                                          </div>
                                        ))}
                                      </div>
                                    );
                                  })()}
                                </div>
                              )}

                              {/* Weekly Daily Entries */}
                              {viewMode === 'weekly' && (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
                                  {developer.dailySummaries.filter(day => day.entries.length > 0).map((day) => (
                                    <div key={day.date} className="bg-white border border-slate-200 rounded-lg p-3">
                                      <div className="flex items-center justify-between mb-2.5">
                                        <h5 className="text-xs font-semibold text-slate-600">
                                          {new Date(day.date).toLocaleDateString('tr-TR', { weekday: 'short', day: 'numeric', month: 'short' })}
                                        </h5>
                                        <span className={`text-xs font-bold tabular-nums ${
                                          day.totalHours >= 7 ? 'text-emerald-600' :
                                          day.totalHours >= 5 ? 'text-amber-500' : 'text-red-500'
                                        }`}>{day.totalHours}h</span>
                                      </div>
                                      <div className="space-y-1.5">
                                        {day.entries.map((entry, entryIndex) => (
                                          <div key={entryIndex} className="bg-slate-50 rounded-md p-2 border border-slate-100">
                                            <div className="text-[11px] font-semibold text-blue-600 mb-0.5">{entry.issueKey}</div>
                                            <div className="text-[11px] text-slate-600 line-clamp-2 leading-tight">{entry.issueSummary}</div>
                                            <div className="flex items-center justify-between mt-1">
                                              <span className="text-[10px] text-slate-400 truncate">{entry.project}</span>
                                              <span className="text-[11px] font-semibold text-slate-700 tabular-nums ml-1">{entry.timeSpentHours}h</span>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Table Footer */}
          <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
            <span className="text-xs text-slate-500">{worklogData.length} yazılımcı gösteriliyor</span>
            <div className="flex items-center gap-4">
              {[
                { color: 'bg-emerald-500', label: 'Yeterli', count: analytics?.developersWithSufficientHours || 0 },
                { color: 'bg-red-500', label: 'Eksik', count: analytics?.developersWithInsufficientHours || 0 },
                { color: 'bg-blue-500', label: 'Fazla', count: analytics?.developersWithExcessiveHours || 0 },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${item.color}`} />
                  <span className="text-xs text-slate-500">{item.count} {item.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!loading && worklogData.length === 0 && (
        <div className="text-center py-16 bg-white rounded-xl border border-slate-200">
          <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Calendar className="h-7 w-7 text-slate-400" />
          </div>
          <p className="text-slate-600 font-medium">{viewMode === 'weekly' ? 'Bu hafta' : 'Bu ay'} için worklog verisi bulunamadı.</p>
          <p className="text-slate-400 text-sm mt-1">Farklı bir {viewMode === 'weekly' ? 'hafta' : 'ay'} seçin veya Jira bağlantısını kontrol edin.</p>
        </div>
      )} 

      {/* Filtered Empty State */}
      {!loading && worklogData.length > 0 && filteredWorklogData.length === 0 && (
        <div className="text-center py-16 bg-white rounded-xl border border-slate-200">
          <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Users className="h-7 w-7 text-slate-400" />
          </div>
          <p className="text-slate-600 font-medium">Seçili yazılımcı için veri bulunamadı.</p>
          <p className="text-slate-400 text-sm mt-1">Farklı bir yazılımcı seçin veya filtreyi kaldırın.</p>
        </div>
      )}
    </div>
  );
};

export default DailyWorklogTracking;