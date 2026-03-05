import React, { useState, useEffect } from 'react';
import { Users, Clock, TrendingUp, AlertTriangle, CheckCircle, Download, RefreshCw, ChevronDown, ChevronUp, CreditCard as Edit, Save, X, Loader, Search, Calendar, HelpCircle } from 'lucide-react';
import { useJiraData } from '../context/JiraDataContext';
import { useAuth } from '../context/AuthContext';
import { useDeveloperCapacities } from '../hooks/useDeveloperCapacities';
import { exportDeveloperWorkloadToCSV } from '../utils/csvExport';
import { worklogService } from '../services/worklogService';
import { DeveloperCapacityAdjustment } from './DeveloperCapacityAdjustment';
import { getWeekRange, getMonthRange } from '../utils/dateUtils';
import {
  getDeveloperSprintDateRange as getDeveloperSprintDateRangeUtil,
  getOverallSprintDateRange
} from '../utils/sprintDateUtils';
import {
  calculateDeveloperStatus,
  getStatusColor,
  getStatusIcon,
  calculateWorkloadStats,
  getDeveloperCapacity
} from '../utils/workloadUtils';
import { useDeveloperActualHours } from '../hooks/useDeveloperActualHours';
import DeveloperWorkloadOnboarding, { useDeveloperWorkloadOnboarding } from './DeveloperWorkloadDashboardOnboarding';

type ViewMode = 'weekly' | 'monthly';

export const DeveloperWorkloadDashboard: React.FC = () => {
  const {
    workload,
    loading,
    error,
    refresh,
    updateWorkloadStatus,
    sprints,
    sprintType,
    cacheStatus,
    capacityCalculations,
    setCapacityCalculations,
    getDeveloperProjectKey: getDeveloperProjectKeyFromContext,
    lastRefreshAt
  } = useJiraData();
  const { canViewDeveloperData, user, hasKolayIK } = useAuth();
  const { getCapacity, updateCapacity, canEdit } = useDeveloperCapacities();
  const { isOnboardingOpen, openOnboarding, closeOnboarding } = useDeveloperWorkloadOnboarding();
  const [expandedDeveloper, setExpandedDeveloper] = useState<string | null>(null);
  const [editingCapacity, setEditingCapacity] = useState<string | null>(null);
  const [capacityValue, setCapacityValue] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');

  const { actualHoursData, loading: actualHoursLoading, error: actualHoursError } = useDeveloperActualHours({
    workload,
    sprints,
    sprintType,
    cacheStatus
  });
  const [showKolayIKIntegration, setShowKolayIKIntegration] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('weekly');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [customDateRange, setCustomDateRange] = useState<{ start: string; end: string } | null>(null);
  const [localLastRefreshAt, setLocalLastRefreshAt] = useState<number | null>(null);

  useEffect(() => {
    const dateRange = viewMode === 'weekly'
      ? getWeekRange(currentDate)
      : getMonthRange(currentDate);
    setCustomDateRange({ start: dateRange.start, end: dateRange.end });
  }, [currentDate, viewMode]);

  useEffect(() => {
    if (lastRefreshAt) setLocalLastRefreshAt(lastRefreshAt);
  }, [lastRefreshAt]);

  const formatLastRefresh = () => {
    if (!localLastRefreshAt) return 'Henüz yenilenmedi';
    const d = new Date(localLastRefreshAt);
    return d.toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const handleRefreshClick = () => {
    worklogService.clearCache();
    refresh();
  };

  const navigateDate = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate);
    if (viewMode === 'weekly') newDate.setDate(newDate.getDate() + (direction === 'next' ? 7 : -7));
    else newDate.setMonth(newDate.getMonth() + (direction === 'next' ? 1 : -1));
    setCurrentDate(newDate);
  };

  const goToToday = () => setCurrentDate(new Date());

  const formatDateRange = () => {
    if (!customDateRange) return '';
    const startDate = new Date(customDateRange.start);
    const endDate = new Date(customDateRange.end);
    const formatDate = (date: Date) => date.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    return `${formatDate(startDate)} - ${formatDate(endDate)}`;
  };

  const getDeveloperProjectKey = (developerName: string): string => {
    return getDeveloperProjectKeyFromContext(developerName) ?? 'UNKNOWN';
  };

  const developerProjectKeyMapForUtil = React.useMemo(() => {
    const m: Record<string, string> = {};
    workload?.forEach(w => {
      const k = getDeveloperProjectKeyFromContext(w.developer);
      if (k) m[w.developer] = k;
    });
    return m;
  }, [workload, getDeveloperProjectKeyFromContext]);

  const getDeveloperSprintDateRange = (developerName: string): { start: string; end: string; sprintNames: string[] } => {
    return getDeveloperSprintDateRangeUtil(developerName, sprints, developerProjectKeyMapForUtil);
  };

  const getOverallSprintDateRangeLocal = (): { start: string; end: string } | null => {
    return getOverallSprintDateRange(sprints);
  };

  const handleCapacityEdit = (developerName: string) => {
    const currentCapacity = getCapacity(developerName);
    setEditingCapacity(developerName);
    setCapacityValue(currentCapacity.toString());
  };

  const handleCapacitySave = async (developerName: string) => {
    try {
      const newCapacity = parseInt(capacityValue);
      if (isNaN(newCapacity) || newCapacity <= 0) { alert('Geçerli bir kapasite değeri girin'); return; }
      await updateCapacity(developerName, newCapacity);
      updateWorkloadStatus(developerName, newCapacity);
      setEditingCapacity(null);
    } catch (error) {
      console.error('Capacity update error:', error);
      alert('Kapasite güncellenirken hata oluştu');
    }
  };

  const handleCapacityCancel = () => {
    setEditingCapacity(null);
    setCapacityValue('');
  };

  const filteredWorkload = workload ? workload
    .filter(dev => canViewDeveloperData(dev.developer))
    .filter(dev => {
      if (!searchTerm) return true;
      const searchLower = searchTerm.toLowerCase();
      return dev.developer.toLowerCase().includes(searchLower) || dev.email.toLowerCase().includes(searchLower);
    })
    .sort((a, b) => (actualHoursData[b.developer] || 0) - (actualHoursData[a.developer] || 0)) : [];

  const stats = calculateWorkloadStats(filteredWorkload, actualHoursData, capacityCalculations, showKolayIKIntegration, getCapacity);

  const avatarColors = [
    'from-violet-500 to-purple-600',
    'from-blue-500 to-cyan-600',
    'from-emerald-500 to-teal-600',
    'from-orange-500 to-amber-600',
    'from-rose-500 to-pink-600',
    'from-indigo-500 to-blue-600',
  ];

  const getInitials = (name: string) => name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full border-2 border-slate-100 border-t-blue-600 animate-spin" />
          <div className="text-center">
            <p className="text-slate-700 font-medium">Yazılımcı İş Yükü Analizi</p>
            <p className="text-sm text-slate-400 mt-1">Jira verisi alınıyor, bu işlem 10 saniye sürebilir…</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6">
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle className="h-5 w-5 text-red-500" />
          <p className="text-red-800 font-medium">{error}</p>
        </div>
        <button onClick={refresh} className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors">
          Tekrar Dene
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5 p-1">
      {/* Onboarding Modal */}
      <DeveloperWorkloadOnboarding isOpen={isOnboardingOpen} onClose={closeOnboarding} />

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Yazılımcı Sprint Analizi</h2>
          <p className="text-slate-500 mt-0.5 text-sm">
            {viewMode === 'weekly' ? 'Haftalık' : 'Aylık'} görev dağılımı ve iş yükü analizi
          </p>
          {actualHoursLoading && (
            <p className="text-xs text-blue-600 mt-1 flex items-center gap-1.5">
              <Loader className="h-3.5 w-3.5 animate-spin" />
              Sprint verileri yükleniyor, 10 saniye sürebilir…
            </p>
          )}
          {actualHoursError && (
            <p className="text-xs text-red-500 mt-1">⚠️ Harcanan süre verisi yüklenemedi: {actualHoursError}</p>
          )}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 mr-1">Son yenileme: {formatLastRefresh()}</span>
          <button
            onClick={openOnboarding}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-600 text-sm font-medium rounded-lg hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm"
            title="Sayfayı nasıl kullanacağınızı öğrenin"
          >
            <HelpCircle className="h-4 w-4" />
            Nasıl Kullanılır?
          </button>
          <button
            onClick={() => exportDeveloperWorkloadToCSV(filteredWorkload)}
            disabled={filteredWorkload.length === 0}
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-40 transition-all shadow-sm"
          >
            <Download className="h-4 w-4" />
            CSV İndir
          </button>
          {hasKolayIK && (
            <button
              onClick={() => setShowKolayIKIntegration(!showKolayIKIntegration)}
              className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all shadow-sm ${
                showKolayIKIntegration
                  ? 'bg-purple-600 text-white hover:bg-purple-700'
                  : 'bg-white text-purple-600 border border-purple-200 hover:bg-purple-50'
              }`}
            >
              <Calendar className="h-4 w-4" />
              {showKolayIKIntegration ? 'İzni Gizle' : 'İzin Entegrasyonu'}
            </button>
          )}
          <button
            onClick={handleRefreshClick}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 text-white text-sm font-medium rounded-lg hover:bg-slate-700 disabled:opacity-40 transition-all shadow-sm"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Yenile
          </button>
        </div>
      </div>

      {/* KolayIK Integration */}
      {hasKolayIK && showKolayIKIntegration && customDateRange && (
        <DeveloperCapacityAdjustment
          workload={filteredWorkload}
          sprintStartDate={customDateRange.start}
          sprintEndDate={customDateRange.end}
          sprints={sprints}
          onCapacityUpdate={updateWorkloadStatus}
          updateWorkloadStatus={updateWorkloadStatus}
          onCapacityCalculationsChange={setCapacityCalculations}
        />
      )}

      {/* Search */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Yazılımcı adı veya e-posta ile ara…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-700 placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-colors"
            />
          </div>
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm text-slate-500 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
            >
              <X className="h-3.5 w-3.5" />
              Temizle
            </button>
          )}
          {searchTerm && (
            <span className="text-xs text-slate-400">{filteredWorkload.length} yazılımcı gösteriliyor</span>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { label: 'Toplam Yazılımcı', value: stats.totalDevelopers, suffix: '', icon: Users, color: 'text-blue-600', iconBg: 'bg-blue-50' },
          { label: 'Eksik Yük', value: stats.underloaded, suffix: '', icon: AlertTriangle, color: 'text-amber-500', iconBg: 'bg-amber-50' },
          { label: 'Yeterli Yük', value: stats.adequate, suffix: '', icon: CheckCircle, color: 'text-emerald-600', iconBg: 'bg-emerald-50' },
          { label: 'Aşırı Yük', value: stats.overloaded, suffix: '', icon: TrendingUp, color: 'text-red-600', iconBg: 'bg-red-50' },
          { label: 'Toplam Harcanan', value: stats.totalActualHours, suffix: 'h', icon: Clock, color: 'text-violet-600', iconBg: 'bg-violet-50', sub: 'Sprint tarihleri' },
        ].map((card) => (
          <div key={card.label} className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex items-center gap-3">
            <div className={`w-10 h-10 ${card.iconBg} rounded-xl flex items-center justify-center flex-shrink-0`}>
              <card.icon className={`h-5 w-5 ${card.color}`} />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-slate-500 font-medium truncate">{card.label}</p>
              <p className={`text-xl font-bold ${card.color} leading-tight tabular-nums`}>{card.value}{card.suffix}</p>
              {card.sub && <p className="text-[10px] text-slate-400 mt-0.5">{card.sub}</p>}
            </div>
          </div>
        ))}
      </div>

      {/* Workload Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100">
          <h3 className="text-base font-semibold text-slate-800">Yazılımcı İş Yükü Detayları</h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Tahmini süreler sprint görevlerinden, harcanan süreler yazılımcının kendi projesinin sprint tarihlerindeki worklog'larından hesaplanır
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                {['Yazılımcı', 'Görev Sayısı', 'Analist Tahmini', 'Harcanan Süre', 'Kapasite', 'Durum', 'Detay'].map((h, i) => (
                  <th key={h} className={`px-5 py-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wider ${i === 0 ? 'text-left' : 'text-center'}`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredWorkload.map((developer, index) => {
                const capacity = getCapacity(developer.developer);
                const actualHours = actualHoursData[developer.developer] || 0;
                const isExpanded = expandedDeveloper === developer.developer;
                const avatarGradient = avatarColors[index % avatarColors.length];

                const devCapacity = getDeveloperCapacity(
                  developer.developer,
                  getCapacity,
                  hasKolayIK && showKolayIKIntegration,
                  capacityCalculations
                );
                const currentStatus = calculateDeveloperStatus(actualHours, devCapacity);

                return (
                  <React.Fragment key={developer.developer}>
                    <tr className="hover:bg-slate-50/70 transition-colors">
                      {/* Yazılımcı */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className={`flex-shrink-0 w-9 h-9 bg-gradient-to-br ${avatarGradient} rounded-full flex items-center justify-center shadow-sm`}>
                            <span className="text-[11px] font-bold text-white">{getInitials(developer.developer)}</span>
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-slate-800 leading-tight">{developer.developer}</p>
                            <p className="text-xs text-slate-400 leading-tight">{developer.email}</p>
                          </div>
                        </div>
                      </td>

                      {/* Görev Sayısı */}
                      <td className="px-5 py-3.5 text-center">
                        <span className="text-base font-bold text-slate-700 tabular-nums">{developer.totalTasks}</span>
                      </td>

                      {/* Analist Tahmini */}
                      <td className="px-5 py-3.5 text-center">
                        <span className="text-base font-bold text-blue-600 tabular-nums">{Math.round(developer.totalHours * 100) / 100}h</span>
                      </td>

                      {/* Harcanan Süre */}
                      <td className="px-5 py-3.5 text-center">
                        {actualHoursLoading ? (
                          <div className="flex items-center justify-center gap-1.5 text-slate-400">
                            <Loader className="h-3.5 w-3.5 animate-spin" />
                            <span className="text-xs">Yükleniyor…</span>
                          </div>
                        ) : actualHoursError ? (
                          <span className="text-xs text-red-500">Hata</span>
                        ) : (
                          <div>
                            <p className="text-base font-bold text-violet-600 tabular-nums">{actualHours}h</p>
                            <p className="text-[11px] text-slate-400 mt-0.5">{getDeveloperProjectKey(developer.developer)}</p>
                          </div>
                        )}
                      </td>

                      {/* Kapasite */}
                      <td className="px-5 py-3.5 text-center">
                        {editingCapacity === developer.developer ? (
                          <div className="flex items-center justify-center gap-1.5">
                            <input
                              type="number"
                              value={capacityValue}
                              onChange={(e) => setCapacityValue(e.target.value)}
                              className="w-14 text-center border border-slate-300 rounded-lg px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                              min="1" max="200"
                            />
                            <button onClick={() => handleCapacitySave(developer.developer)} className="text-emerald-600 hover:text-emerald-700 p-1 rounded" title="Kaydet">
                              <Save className="h-4 w-4" />
                            </button>
                            <button onClick={handleCapacityCancel} className="text-slate-400 hover:text-slate-600 p-1 rounded" title="İptal">
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-center gap-1.5">
                            <span className="text-sm font-semibold text-slate-700 tabular-nums">
                              {hasKolayIK && showKolayIKIntegration && capacityCalculations.length > 0
                                ? (() => { const calc = capacityCalculations.find(c => c.developerName === developer.developer); return calc ? calc.adjustedCapacity : capacity; })()
                                : capacity}h
                            </span>
                            {canEdit && (
                              <button onClick={() => handleCapacityEdit(developer.developer)} className="text-slate-300 hover:text-blue-500 transition-colors p-0.5 rounded" title="Kapasiteyi düzenle">
                                <Edit className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Durum */}
                      <td className="px-5 py-3.5 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {getStatusIcon(currentStatus)}
                          <span className={`inline-flex px-2.5 py-0.5 text-[11px] font-semibold rounded-full border ${getStatusColor(currentStatus)}`}>
                            {currentStatus}
                          </span>
                        </div>
                      </td>

                      {/* Detay toggle */}
                      <td className="px-5 py-3.5 text-center">
                        <button
                          onClick={() => setExpandedDeveloper(isExpanded ? null : developer.developer)}
                          className={`inline-flex items-center gap-1 text-sm font-medium transition-colors ${
                            isExpanded ? 'text-blue-700' : 'text-blue-500 hover:text-blue-700'
                          }`}
                        >
                          Detaylar
                          {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                        </button>
                      </td>
                    </tr>

                    {/* Expanded Details */}
                    {isExpanded && (
                      <tr className="bg-slate-50/50">
                        <td colSpan={7} className="px-6 py-5">
                          <div className="space-y-4">
                            <h4 className="text-sm font-semibold text-slate-700">
                              {developer.developer} — Proje Detayları
                            </h4>

                            {developer.details.length > 0 ? (
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {developer.details.map((detail, detailIndex) => {
                                  const progressPct = detail.hours > 0
                                    ? Math.min((detail.actualHours / detail.hours) * 100, 100)
                                    : detail.actualHours > 0 ? 100 : 0;
                                  const progressLabel = detail.hours > 0
                                    ? `${Math.round((detail.actualHours / detail.hours) * 100)}%`
                                    : detail.actualHours > 0 ? '∞' : '0%';

                                  return (
                                    <div key={detailIndex} className="bg-white rounded-xl border border-slate-200 p-4">
                                      {/* Kart başlık */}
                                      <div className="flex items-start justify-between mb-3">
                                        <div>
                                          <h5 className="text-sm font-semibold text-slate-800 leading-tight">{detail.project}</h5>
                                          <p className="text-xs text-slate-500 mt-0.5">{detail.sprint}</p>
                                          <span className="inline-block mt-1 text-[11px] font-medium text-blue-600 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-full">
                                            {getDeveloperProjectKey(developer.developer)}
                                          </span>
                                        </div>
                                        <div className="text-right flex-shrink-0 ml-3">
                                          <p className="text-sm font-bold text-slate-700">{detail.taskCount} görev</p>
                                          <p className="text-[11px] text-blue-600 mt-0.5">Tahmini: {Math.round(detail.hours * 100) / 100}h</p>
                                          <p className="text-[11px] text-violet-600">Harcanan: {Math.round(detail.actualHours * 100) / 100}h</p>
                                        </div>
                                      </div>

                                      {/* Progress bar */}
                                      <div className="mb-3">
                                        <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                                          <span>İlerleme</span>
                                          <span className="font-semibold text-slate-600">{progressLabel}</span>
                                        </div>
                                        <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                                          <div
                                            className={`h-full rounded-full transition-all duration-500 ${detail.hours > 0 ? 'bg-blue-500' : 'bg-violet-500'}`}
                                            style={{ width: `${progressPct}%` }}
                                          />
                                        </div>
                                      </div>

                                      {/* Task list */}
                                      {detail.tasks && detail.tasks.length > 0 ? (
                                        <div className="border-t border-slate-100 pt-3">
                                          <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-2">
                                            {detail.sprint === 'Sprint Dışı Görevler' ? 'Sprint Dışı Görevler' : 'Sprint Görevleri'}
                                          </p>
                                          <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                                            {detail.tasks.map((task, taskIndex) => (
                                              <div key={taskIndex} className="flex items-start justify-between gap-2 bg-slate-50 rounded-lg px-2.5 py-2 border border-slate-100">
                                                <div className="flex-1 min-w-0">
                                                  <div className="flex items-center gap-2 flex-wrap">
                                                    <span className="text-[11px] font-bold text-blue-600">{task.key}</span>
                                                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                                                      task.status === 'Sprint Dışı' ? 'bg-violet-100 text-violet-700' :
                                                      task.status.toLowerCase().includes('done') || task.status.toLowerCase().includes('tamam') ? 'bg-emerald-100 text-emerald-700' :
                                                      'bg-blue-100 text-blue-700'
                                                    }`}>
                                                      {task.status}
                                                    </span>
                                                    {task.issueType && (
                                                      <span className="text-[10px] text-slate-400">{task.issueType}</span>
                                                    )}
                                                  </div>
                                                  <p className="text-[11px] text-slate-600 truncate mt-0.5">{task.summary}</p>
                                                </div>
                                                <div className="text-right flex-shrink-0">
                                                  {task.estimatedHours > 0 && (
                                                    <p className="text-[11px] text-blue-600 tabular-nums">{task.estimatedHours}h</p>
                                                  )}
                                                  {task.actualHours > 0 && (
                                                    <p className="text-[11px] font-semibold text-violet-600 tabular-nums">{task.actualHours}h</p>
                                                  )}
                                                </div>
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      ) : detail.actualHours > 0 ? (
                                        <div className="border-t border-slate-100 pt-3">
                                          <div className="bg-violet-50 border border-violet-100 rounded-lg px-3 py-2">
                                            <p className="text-xs text-violet-700">
                                              Görev detayı bulunamadı, ancak <span className="font-semibold">{Math.round(detail.actualHours * 100) / 100}h</span> süre harcamış.
                                            </p>
                                          </div>
                                        </div>
                                      ) : null}

                                      {/* Sprint Tarih Bilgisi */}
                                      <div className="border-t border-slate-100 pt-3 mt-3">
                                        {(() => {
                                          const dateRange = getDeveloperSprintDateRange(developer.developer);
                                          return (
                                            <div className="flex items-start gap-2">
                                              <Calendar className="h-3.5 w-3.5 text-slate-400 mt-0.5 flex-shrink-0" />
                                              <div className="text-[11px] text-slate-400">
                                                <span className="font-medium text-slate-500">Sprint tarihleri:</span>{' '}
                                                {dateRange.start} – {dateRange.end}
                                                <div className="mt-0.5 text-[10px]">{dateRange.sprintNames.join(', ')}</div>
                                              </div>
                                            </div>
                                          );
                                        })()}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <div className="text-center py-8">
                                <p className="text-slate-500 text-sm">Bu yazılımcı için sprint görevi bulunamadı.</p>
                                {actualHoursData[developer.developer] > 0 && (
                                  <p className="text-xs text-violet-600 mt-1.5">
                                    Ancak {actualHoursData[developer.developer]}h worklog kaydı mevcut
                                  </p>
                                )}
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
      </div>

      {/* Empty State */}
      {filteredWorkload.length === 0 && (
        <div className="text-center py-16 bg-white rounded-xl border border-slate-200">
          <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Users className="h-7 w-7 text-slate-400" />
          </div>
          <p className="text-slate-600 font-medium">Yazılımcı verisi bulunamadı.</p>
          <p className="text-slate-400 text-sm mt-1">
            {user?.role === 'developer'
              ? 'Size atanmış aktif görev bulunamadı.'
              : 'Aktif sprint veya görev bulunamadı.'}
          </p>
        </div>
      )}
    </div>
  );
};