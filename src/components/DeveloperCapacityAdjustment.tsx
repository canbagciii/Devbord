import React, { useState, useEffect } from 'react';
import { useJiraData } from '../context/JiraDataContext';
import { useCapacityMetric } from '../context/CapacityMetricContext';
import { useKolayIKIntegration } from '../hooks/useKolayIKIntegration';
import { useDeveloperCapacities } from '../hooks/useDeveloperCapacities';
import { kolayikService } from '../services/kolayikService';
import { DeveloperWorkload } from '../types';
import { Calendar, Clock, Users, AlertTriangle, CheckCircle, RefreshCw, Eye, EyeOff, Info, Loader, XCircle } from 'lucide-react';

const leaveIntegrationCache = new Map<string, { data: any; timestamp: number; expiry: number }>();
const CACHE_DURATION = 10 * 60 * 1000;

interface DeveloperCapacityAdjustmentProps {
  workload: DeveloperWorkload[];
  sprintStartDate: string | null;
  sprintEndDate: string | null;
  onCapacityUpdate: (developerName: string, newCapacity: number) => void;
  updateWorkloadStatus: (developerName: string, newCapacity: number) => void;
  onCapacityCalculationsChange: (calculations: any[], cacheKey?: string | null) => void;
}

// Deprecated - dailyHours artık context'ten gelir
const getDailyHoursFromStorage = (): number => {
  try {
    const stored = localStorage.getItem('dailyHours');
    const v = stored ? parseFloat(stored) : NaN;
    if (Number.isFinite(v) && v > 0) return v;
  } catch {}
  return 8;
};

export const DeveloperCapacityAdjustment: React.FC<DeveloperCapacityAdjustmentProps> = ({
  workload,
  sprintStartDate,
  sprintEndDate,
  onCapacityUpdate,
  updateWorkloadStatus,
  onCapacityCalculationsChange
}) => {
  const { sprints, capacityCalculations: contextCapacityCalculations, capacityCacheKey, sprintType, getDeveloperProjectKey: getDeveloperProjectKeyFromContext } = useJiraData();
  const { dailyHours, dailyStoryPoints } = useCapacityMetric();
  const {
    leaveInfo,
    capacityCalculations,
    loading: kolayikLoading,
    error: kolayikError,
    connectionStatus,
    testConnection,
    loadLeaveDataAndCalculateCapacities,
    getAdjustedCapacity,
    getDeveloperLeaveDetails,
    refresh
  } = useKolayIKIntegration(workload, sprintStartDate, sprintEndDate);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [autoApplyEnabled, setAutoApplyEnabled] = useState(true);
  const [sprintBasedCalculations, setSprintBasedCalculations] = useState<any[]>([]);
  const [forceUpdateTrigger, setForceUpdateTrigger] = useState(0);

  const getFromCache = <T,>(key: string): T | null => {
    const cached = leaveIntegrationCache.get(key);
    if (cached && Date.now() < cached.expiry) return cached.data as T;
    return null;
  };

  const setCache = <T,>(key: string, data: T): void => {
    leaveIntegrationCache.set(key, { data, timestamp: Date.now(), expiry: Date.now() + CACHE_DURATION });
  };

  const clearCache = (): void => { leaveIntegrationCache.clear(); };

  useEffect(() => { testConnection(); }, []);

  useEffect(() => {
    if (workload.length > 0 && sprintStartDate && sprintEndDate) {
      const wasEnabled = autoApplyEnabled;
      setAutoApplyEnabled(false);
      clearCache();
      loadSprintBasedLeaveData();
      setTimeout(() => { if (wasEnabled) setAutoApplyEnabled(true); }, 100);
    }
  }, [workload.length, sprintStartDate, sprintEndDate]);

  const calculateWorkingDays = (startDate: string, endDate: string): number => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    let workingDays = 0;
    const currentDate = new Date(start);
    while (currentDate <= end) {
      const dayOfWeek = currentDate.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) workingDays++;
      currentDate.setDate(currentDate.getDate() + 1);
    }
    return workingDays;
  };

  const getDeveloperProjectKey = (developerName: string): string => {
    return getDeveloperProjectKeyFromContext(developerName) ?? 'UNKNOWN';
  };

  const getDeveloperSprintDateRange = (developerName: string): { start: string; end: string; sprintNames: string[] } => {
    const projectKey = getDeveloperProjectKey(developerName);

    if (!sprints || sprints.length === 0) {
      const today = new Date();
      const thirtyDaysAgo = new Date(today);
      thirtyDaysAgo.setDate(today.getDate() - 30);
      return { start: thirtyDaysAgo.toISOString().split('T')[0], end: today.toISOString().split('T')[0], sprintNames: ['Sprints data not available'] };
    }

    let developerSprints = sprints.filter(sprint => sprint.projectKey === projectKey);

    if (developerSprints.length === 0) {
      const today = new Date();
      const thirtyDaysAgo = new Date(today);
      thirtyDaysAgo.setDate(today.getDate() - 30);
      return { start: thirtyDaysAgo.toISOString().split('T')[0], end: today.toISOString().split('T')[0], sprintNames: [`${projectKey} için sprint bulunamadı`] };
    }

    if (sprintType === 'closed') {
      const closedSprints = developerSprints
        .filter(sprint => sprint.state === 'closed')
        .sort((a, b) => {
          const dateA = a.completeDate ? new Date(a.completeDate) : (a.endDate ? new Date(a.endDate) : new Date(0));
          const dateB = b.completeDate ? new Date(b.completeDate) : (b.endDate ? new Date(b.endDate) : new Date(0));
          return dateB.getTime() - dateA.getTime();
        });
      if (closedSprints.length > 0) developerSprints = [closedSprints[0]];
    }

    let earliestStart: Date | null = null;
    let latestEnd: Date | null = null;
    const sprintNames: string[] = [];

    for (const sprint of developerSprints) {
      sprintNames.push(sprint.name);
      if (sprint.startDate) {
        const startDateStr = sprint.startDate.includes('T') ? sprint.startDate : `${sprint.startDate}T00:00:00`;
        const startDate = new Date(startDateStr);
        if (!earliestStart || startDate < earliestStart) earliestStart = startDate;
      }
      if (sprint.endDate) {
        const endDateStr = sprint.endDate.includes('T') ? sprint.endDate : `${sprint.endDate}T00:00:00`;
        const endDate = new Date(endDateStr);
        if (!latestEnd || endDate > latestEnd) latestEnd = endDate;
      }
    }

    if (!earliestStart || !latestEnd) {
      const today = new Date();
      const thirtyDaysAgo = new Date(today);
      thirtyDaysAgo.setDate(today.getDate() - 30);
      return { start: thirtyDaysAgo.toISOString().split('T')[0], end: today.toISOString().split('T')[0], sprintNames };
    }

    const formatLocalDate = (date: Date): string => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    return { start: formatLocalDate(earliestStart), end: formatLocalDate(latestEnd), sprintNames };
  };

  const loadSprintBasedLeaveData = async () => {
    const cacheKey = `leave-calculations-${workload.map(w => w.developer).sort().join('-')}-${sprintStartDate}-${sprintEndDate}`;
    const cachedCalculations = getFromCache<any[]>(cacheKey);

    if (capacityCacheKey === cacheKey && contextCapacityCalculations.length > 0) {
      setSprintBasedCalculations(contextCapacityCalculations);
      onCapacityCalculationsChange(contextCapacityCalculations, cacheKey);
      return;
    }

    if (cachedCalculations) {
      setSprintBasedCalculations(cachedCalculations);
      onCapacityCalculationsChange(cachedCalculations, cacheKey);
      return;
    }

    setSprintBasedCalculations([]);
    onCapacityCalculationsChange([], null);
    setLoading(true);
    setError(null);

    // dailyHours artık context'ten geliyor

    try {
      const calculations: any[] = [];

      for (const developer of workload) {
        const developerName = developer.developer;
        const developerProjectKey = getDeveloperProjectKey(developerName);
        const dateRange = getDeveloperSprintDateRange(developerName);
        const sprintWorkingDays = calculateWorkingDays(dateRange.start, dateRange.end);
        const originalCapacity = Math.round(dailyHours * sprintWorkingDays);

        if (!developerProjectKey || developerProjectKey === 'UNKNOWN') {
          calculations.push({
            developerName, originalCapacity, sprintWorkingDays,
            leaveDays: 0, publicHolidays: 0, availableWorkingDays: sprintWorkingDays,
            adjustedCapacity: originalCapacity, capacityReduction: 0
          });
          continue;
        }

        try {
          const leaveInfoArray = await kolayikService.getDeveloperLeaveInfo([developerName], dateRange.start, dateRange.end);
          const leaveInfo = leaveInfoArray[0];

          if (!leaveInfo) {
            calculations.push({
              developerName, originalCapacity, sprintWorkingDays,
              leaveDays: 0, publicHolidays: 0, availableWorkingDays: sprintWorkingDays,
              adjustedCapacity: originalCapacity, capacityReduction: 0,
              leaveDetails: [], sprintDateRange: dateRange
            });
            continue;
          }

          const publicHolidayDays = leaveInfo.leaveDetails
            ?.filter(detail => detail.leaveType.includes('Resmi Tatil'))
            .reduce((sum, detail) => sum + detail.days, 0) || 0;

          const regularLeaveDays = leaveInfo.leaveDays - publicHolidayDays;
          const totalLeaveDays = leaveInfo.leaveDays;

          // ✅ FIX: Math.round(x * 10) / 10 — ondalık hassasiyet korunur
          // Örnek: 1.5 gün × 7h = 10.5h düşülür (Math.round(10.5) = 11 olduğu için eskisi yanlıştı)
          const hoursToDeduct = Math.round(totalLeaveDays * dailyHours * 10) / 10;
          const adjustedCapacity = Math.max(0, originalCapacity - hoursToDeduct);
          const capacityReduction = originalCapacity - adjustedCapacity;
          const availableWorkingDays = Math.max(0, sprintWorkingDays - totalLeaveDays);

          console.log(`🧮 ${developerName}: ${originalCapacity}h - ${hoursToDeduct}h (${totalLeaveDays} gün × ${dailyHours}h) = ${adjustedCapacity}h`);

          calculations.push({
            developerName, originalCapacity, sprintWorkingDays,
            leaveDays: regularLeaveDays, publicHolidays: publicHolidayDays,
            availableWorkingDays, adjustedCapacity, capacityReduction,
            sprintDateRange: dateRange, leaveDetails: leaveInfo.leaveDetails
          });

        } catch (error) {
          console.error(`❌ Error fetching leave data for ${developerName}:`, error);
          calculations.push({
            developerName, originalCapacity, sprintWorkingDays,
            leaveDays: 0, publicHolidays: 0, availableWorkingDays: sprintWorkingDays,
            adjustedCapacity: originalCapacity, capacityReduction: 0
          });
        }
      }

      setCache(cacheKey, calculations);
      setSprintBasedCalculations(calculations);
      onCapacityCalculationsChange(calculations, cacheKey);
      setForceUpdateTrigger(prev => prev + 1);

    } catch (error) {
      console.error('Error loading sprint-based leave data:', error);
      setError(error instanceof Error ? error.message : 'Sprint bazlı izin verileri yüklenirken hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (autoApplyEnabled && sprintBasedCalculations.length > 0) {
      sprintBasedCalculations.forEach(calc => {
        onCapacityUpdate(calc.developerName, calc.adjustedCapacity);
        updateWorkloadStatus(calc.developerName, calc.adjustedCapacity);
      });
    }
  }, [forceUpdateTrigger]);

  const handleManualApply = () => {
    capacityCalculations.forEach(calc => {
      if (calc.adjustedCapacity !== calc.originalCapacity) {
        onCapacityUpdate(calc.developerName, calc.adjustedCapacity);
      }
    });
  };

  const handleRefresh = () => {
    clearCache();
    refresh();
    loadSprintBasedLeaveData();
  };

  const hasLeaveAdjustments = capacityCalculations.some(calc => calc.leaveDays > 0);
  const totalCapacityReduction = capacityCalculations.reduce((sum, calc) => sum + calc.capacityReduction, 0);

  if (!sprintStartDate || !sprintEndDate) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div className="flex items-center space-x-2">
          <AlertTriangle className="h-5 w-5 text-yellow-600" />
          <p className="text-yellow-800">Sprint tarihleri belirlenmemiş.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Calendar className="h-5 w-5 text-blue-600" />
            <div>
              <h3 className="font-semibold text-gray-900">Kolay İK Entegrasyonu</h3>
              <p className="text-sm text-gray-600">İzin günleri otomatik kapasite ayarlaması sağlandı...</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2">
              {connectionStatus?.success ? (
                <CheckCircle className="h-4 w-4 text-green-600" />
              ) : connectionStatus?.success === false ? (
                <XCircle className="h-4 w-4 text-red-600" />
              ) : (
                <Clock className="h-4 w-4 text-gray-400" />
              )}
              <span className="text-sm text-gray-600">
                {connectionStatus?.success ? 'Bağlı' : connectionStatus?.success === false ? 'Bağlantı Hatası' : 'Test Edilmedi'}
              </span>
            </div>
            <button onClick={handleRefresh} disabled={loading}
              className="flex items-center space-x-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors text-sm">
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              <span>Yenile</span>
            </button>
            <button onClick={() => setShowDetails(!showDetails)}
              className="flex items-center space-x-2 px-3 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm">
              {showDetails ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              <span>{showDetails ? 'Gizle' : 'Detaylar'}</span>
            </button>
          </div>
        </div>

        {(error || kolayikError) && (
          <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-3">
            <div className="flex items-center space-x-2">
              <XCircle className="h-4 w-4 text-red-600" />
              <p className="text-red-800 text-sm">{error || kolayikError}</p>
            </div>
          </div>
        )}

        {(loading || kolayikLoading) && (
          <div className="mt-4 flex items-center space-x-2 text-blue-600">
            <Loader className="h-4 w-4 animate-spin" />
            <span className="text-sm">İzin verileri yükleniyor...</span>
          </div>
        )}

        {!loading && !kolayikLoading && !error && !kolayikError && capacityCalculations.length > 0 && (
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-blue-50 rounded-lg p-3">
              <div className="flex items-center space-x-2">
                <Users className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium text-blue-800">{capacityCalculations.length} yazılımcı analiz edildi</span>
              </div>
            </div>
            <div className="bg-yellow-50 rounded-lg p-3">
              <div className="flex items-center space-x-2">
                <Calendar className="h-4 w-4 text-yellow-600" />
                <span className="text-sm font-medium text-yellow-800">{capacityCalculations.filter(calc => calc.leaveDays > 0).length} yazılımcının izni var</span>
              </div>
            </div>
            <div className="bg-purple-50 rounded-lg p-3">
              <div className="flex items-center space-x-2">
                <Calendar className="h-4 w-4 text-purple-600" />
                <span className="text-sm font-medium text-purple-800">{capacityCalculations.filter(calc => calc.publicHolidays > 0).length} yazılımcıda resmi tatil</span>
              </div>
            </div>
            <div className="bg-orange-50 rounded-lg p-3">
              <div className="flex items-center space-x-2">
                <Clock className="h-4 w-4 text-orange-600" />
                <span className="text-sm font-medium text-orange-800">{Math.round(totalCapacityReduction * 10) / 10}h toplam kapasite azalması</span>
              </div>
            </div>
          </div>
        )}

        {hasLeaveAdjustments && !loading && !kolayikLoading && !error && !kolayikError && (
          <div className="mt-4 flex items-center justify-between bg-green-50 border border-green-200 rounded-lg p-3">
            <div className="flex items-center space-x-2">
              <Info className="h-4 w-4 text-green-600" />
              <span className="text-sm text-green-800">İzin ayarlamaları mevcut. Kapasiteleri otomatik güncellemek ister misiniz?</span>
            </div>
            <div className="flex items-center space-x-3">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input type="checkbox" checked={autoApplyEnabled}
                  onChange={(e) => setAutoApplyEnabled(e.target.checked)}
                  className="rounded border-gray-300 text-green-600 focus:ring-green-500" />
                <span className="text-sm text-green-700">Otomatik Uygula</span>
              </label>
              {!autoApplyEnabled && (
                <button onClick={handleManualApply}
                  className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700 transition-colors">
                  Manuel Uygula
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {showDetails && sprintBasedCalculations.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h4 className="font-semibold text-gray-900">Kapasite Ayarlama Detayları</h4>
            <p className="text-sm text-gray-600 mt-1">Her yazılımcının kendi projesinin sprint tarihleri kullanılır</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['Yazılımcı', 'Sprint Tarihleri', 'Orijinal Kapasite', 'İzin Günleri', 'Resmi Tatil', 'Ayarlanmış Kapasite', 'Azalma', 'İzin Detayları'].map(h => (
                    <th key={h} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {sprintBasedCalculations.map((calc, index) => {
                  // dailyHours artık context'ten geliyor
                  return (
                    <tr key={calc.developerName} className={`hover:bg-gray-50 transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}`}>
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-3">
                          <div className="flex-shrink-0 h-8 w-8 bg-blue-100 rounded-full flex items-center justify-center">
                            <span className="text-xs font-medium text-blue-800">
                              {calc.developerName.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                            </span>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900">{calc.developerName}</p>
                            <p className="text-xs text-gray-500">{getDeveloperProjectKey(calc.developerName)} projesi</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="text-xs">
                          <div className="font-medium text-gray-900">{calc.sprintDateRange?.start} -</div>
                          <div className="font-medium text-gray-900">{calc.sprintDateRange?.end}</div>
                          <div className="text-gray-500 mt-1">{calc.sprintDateRange?.sprintNames.join(', ')}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="text-sm font-medium text-gray-900">{calc.originalCapacity}h</span>
                        <div className="text-xs text-gray-500">{calc.sprintWorkingDays} iş günü × {dailyHours}h</div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        {calc.leaveDays > 0 ? (
                          <div>
                            <span className="text-sm font-medium text-orange-600">{calc.leaveDays} gün</span>
                            <div className="text-xs text-gray-500">{Math.round(calc.leaveDays * dailyHours * 10) / 10}h azalma</div>
                          </div>
                        ) : <span className="text-sm text-gray-400">İzin yok</span>}
                      </td>
                      <td className="px-6 py-4 text-center">
                        {calc.publicHolidays > 0 ? (
                          <div>
                            <span className="text-sm font-medium text-purple-600">{calc.publicHolidays} gün</span>
                            <div className="text-xs text-gray-500">{Math.round(calc.publicHolidays * dailyHours * 10) / 10}h azalma</div>
                          </div>
                        ) : <span className="text-sm text-gray-400">Tatil yok</span>}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`text-sm font-medium ${calc.adjustedCapacity < calc.originalCapacity ? 'text-orange-600' : 'text-green-600'}`}>
                          {calc.adjustedCapacity}h
                        </span>
                        <div className="text-xs text-gray-500">{calc.availableWorkingDays} gün × {dailyHours}h</div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        {calc.capacityReduction > 0
                          ? <span className="text-sm font-medium text-red-600">-{Math.round(calc.capacityReduction * 10) / 10}h</span>
                          : <span className="text-sm text-gray-400">-</span>}
                      </td>
                      <td className="px-6 py-4">
                        {calc.leaveDetails && calc.leaveDetails.length > 0 ? (
                          <div className="space-y-1">
                            {calc.leaveDetails.map((leave: any, idx: number) => {
                              const isPublicHoliday = leave.leaveType.includes('Resmi Tatil');
                              return (
                                <div key={idx} className={`text-xs rounded px-2 py-1 ${isPublicHoliday ? 'bg-purple-50 border border-purple-200' : 'bg-orange-50 border border-orange-200'}`}>
                                  <div className={`font-medium ${isPublicHoliday ? 'text-purple-800' : 'text-orange-800'}`}>{leave.leaveType}</div>
                                  <div className={isPublicHoliday ? 'text-purple-600' : 'text-orange-600'}>
                                    {new Date(leave.startDate).toLocaleDateString('tr-TR')} - {new Date(leave.endDate).toLocaleDateString('tr-TR')}
                                  </div>
                                  <div className={isPublicHoliday ? 'text-purple-600' : 'text-orange-600'}>
                                    {leave.days} {leave.days === 0.5 ? 'yarım gün' : 'gün'}
                                  </div>
                                  {leave.description && (
                                    <div className={`italic ${isPublicHoliday ? 'text-purple-600' : 'text-orange-600'}`}>{leave.description}</div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        ) : <span className="text-xs text-gray-400">İzin yok</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Toplam {sprintBasedCalculations.length} yazılımcı, {sprintBasedCalculations.filter((c: any) => c.leaveDays > 0).length} izinli</span>
              <span className="font-medium text-gray-900">{sprintBasedCalculations.length} yazılımcı analiz edildi</span>
            </div>
          </div>
        </div>
      )}

      {!loading && !kolayikLoading && !error && !kolayikError && sprintBasedCalculations.length > 0 && !hasLeaveAdjustments && (
        <div className="border border-blue-200 rounded-lg p-4" style={{ backgroundColor: '#E6F2FF' }}>
          <div className="flex items-center space-x-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <p className="text-black">İzin sürelerine göre kapasiteler güncellendi</p>
          </div>
          <div className="mt-3 text-sm text-black">
            <p>
              Harcanan sürenin kapasiteyi aştığı durum <span className="font-semibold text-red-600">aşırı yük</span>,
              kapasiteyle eşit olduğu durum <span className="font-semibold text-green-600">yeterli</span>,
              kapasitenin altında kaldığı durum ise <span className="font-semibold text-yellow-600">eksik yük</span>tür.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};