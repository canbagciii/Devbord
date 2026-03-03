import React, { useState, useEffect } from 'react';
import { Users, Clock, TrendingUp, AlertTriangle, CheckCircle, Download, RefreshCw, ChevronDown, ChevronUp, CreditCard as Edit, Save, X, Loader, Search, Calendar } from 'lucide-react';
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
  const [expandedDeveloper, setExpandedDeveloper] = useState<string | null>(null);
  const [editingCapacity, setEditingCapacity] = useState<string | null>(null);
  const [capacityValue, setCapacityValue] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Actual hours yönetimi için custom hook
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
  const [developerProjectKeys, setDeveloperProjectKeys] = useState<Record<string, string>>({});

  // Tarih aralığını hesapla
  useEffect(() => {
    const dateRange = viewMode === 'weekly'
      ? getWeekRange(currentDate)
      : getMonthRange(currentDate);

    setCustomDateRange({
      start: dateRange.start,
      end: dateRange.end
    });
  }, [currentDate, viewMode]);

  // Global lastRefreshAt değiştiğinde local state'i güncelle
  useEffect(() => {
    if (lastRefreshAt) {
      setLocalLastRefreshAt(lastRefreshAt);
    }
  }, [lastRefreshAt]);

  // Developer'ların proje anahtarlarını yükle
  useEffect(() => {
    if (!workload || workload.length === 0) return;

    const loadProjectKeys = async () => {
      const keys: Record<string, string> = {};
      for (const dev of workload) {
        const key = await getDeveloperProjectKeyFromContext(dev.developer);
        if (key) {
          keys[dev.developer] = key;
        }
      }
      setDeveloperProjectKeys(keys);
    };

    loadProjectKeys();
  }, [workload, getDeveloperProjectKeyFromContext]);

  const formatLastRefresh = () => {
    if (!localLastRefreshAt) return 'Henüz yenilenmedi';
    const d = new Date(localLastRefreshAt);
    return d.toLocaleString('tr-TR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleRefreshClick = () => {
    worklogService.clearCache();
    refresh();
  };

  // Tarih navigasyonu
  const navigateDate = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate);

    if (viewMode === 'weekly') {
      newDate.setDate(newDate.getDate() + (direction === 'next' ? 7 : -7));
    } else {
      newDate.setMonth(newDate.getMonth() + (direction === 'next' ? 1 : -1));
    }

    setCurrentDate(newDate);
  };

  // Bugüne git
  const goToToday = () => {
    setCurrentDate(new Date());
  };

  // Tarih formatı
  const formatDateRange = () => {
    if (!customDateRange) return '';

    const startDate = new Date(customDateRange.start);
    const endDate = new Date(customDateRange.end);

    const formatDate = (date: Date) => {
      return date.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    };

    return `${formatDate(startDate)} - ${formatDate(endDate)}`;
  };


  // Yazılımcının proje anahtarını getir (Kullanıcı Yönetimi öncelikli)
  const getDeveloperProjectKey = (developerName: string): string => {
    return getDeveloperProjectKeyFromContext(developerName) ?? 'UNKNOWN';
  };

  // Sprint tarih aralığı için proje haritası (workload'taki her geliştirici için context'ten)
  const developerProjectKeyMapForUtil = React.useMemo(() => {
    const m: Record<string, string> = {};
    workload?.forEach(w => {
      const k = getDeveloperProjectKeyFromContext(w.developer);
      if (k) m[w.developer] = k;
    });
    return m;
  }, [workload, getDeveloperProjectKeyFromContext]);

  // Yazılımcının sprint tarih aralığını getir
  const getDeveloperSprintDateRange = (developerName: string): { start: string; end: string; sprintNames: string[] } => {
    return getDeveloperSprintDateRangeUtil(developerName, sprints, developerProjectKeyMapForUtil);
  };

  // Genel sprint tarih aralığını hesapla (tüm sprintlerden)
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
      if (isNaN(newCapacity) || newCapacity <= 0) {
        alert('Geçerli bir kapasite değeri girin');
        return;
      }

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
      return dev.developer.toLowerCase().includes(searchLower) ||
             dev.email.toLowerCase().includes(searchLower);
    })
    .sort((a, b) => (actualHoursData[b.developer] || 0) - (actualHoursData[a.developer] || 0)) : [];

  // Statistics
  const stats = calculateWorkloadStats(
    filteredWorkload,
    actualHoursData,
    capacityCalculations,
    showKolayIKIntegration,
    getCapacity
  );


  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <div className="text-center">
            <p className="text-lg text-gray-700">Yazılımcı İş Yükü Analizi</p>
            <p className="text-sm text-gray-500 mt-1">Jira verisi alınıyor, bu işlem 10 saniye sürebilir...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <div className="flex items-center space-x-2">
          <AlertTriangle className="h-5 w-5 text-red-600" />
          <p className="text-red-800">{error}</p>
        </div>
        <button
          onClick={refresh}
          className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
        >
          Tekrar Dene
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Yazılımcı İş Yükü Analizi</h2>
          <p className="text-gray-600 mt-1">
            {viewMode === 'weekly' ? 'Haftalık' : 'Aylık'} görev dağılımı ve iş yükü analizi
          </p>
          {actualHoursLoading && (
            <p className="text-sm text-blue-600 mt-1 flex items-center space-x-2">
              <Loader className="h-4 w-4 animate-spin" />
              <span>Sprint verileri yükleniyor 10 saniye sürebilir...</span>
            </p>
          )}
          {actualHoursError && (
            <p className="text-sm text-red-600 mt-1">
              ⚠️ Harcanan süre verisi yüklenemedi: {actualHoursError}
            </p>
          )}
        </div>
        <div className="flex items-center space-x-3">
          <div className="text-xs text-gray-500 mr-2">
            Son yenileme: {formatLastRefresh()}
          </div>
          <button
            onClick={() => exportDeveloperWorkloadToCSV(filteredWorkload)}
            disabled={filteredWorkload.length === 0}
            className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
          >
            <Download className="h-4 w-4" />
            <span>CSV İndir</span>
          </button>
          {hasKolayIK && (
            <button
              onClick={() => setShowKolayIKIntegration(!showKolayIKIntegration)}
              className="flex items-center space-x-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              <Calendar className="h-4 w-4" />
              <span>{showKolayIKIntegration ? 'İzin Entegrasyonunu Gizle' : 'İzin Entegrasyonu'}</span>
            </button>
          )}
          <button
            onClick={handleRefreshClick}
            disabled={loading}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Yenile</span>
          </button>
        </div>
      </div>  

 

      {/* Kolay İK Integration */}
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
      {/* Search Filter */}
      <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200">
        <div className="flex items-center justify-start">
          <div className="relative w-80">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Yazılımcı adı veya e-posta ile ara..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          {searchTerm && (
            <div className="ml-3">
              <button
                onClick={() => setSearchTerm('')}
                className="flex items-center space-x-2 px-3 py-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors"
              >
                <X className="h-4 w-4" />
                <span>Temizle</span>
              </button>
            </div>
          )}
        </div>
        {searchTerm && (
          <div className="mt-2 text-sm text-gray-600">
            {filteredWorkload.length} yazılımcı gösteriliyor
          </div>
        )}
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Toplam Yazılımcı</p>
              <p className="text-2xl font-bold text-blue-600">{stats.totalDevelopers}</p>
            </div>
            <Users className="h-8 w-8 text-blue-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Eksik Yük</p>
              <p className="text-2xl font-bold text-yellow-600">{stats.underloaded}</p>
            </div>
            <AlertTriangle className="h-8 w-8 text-yellow-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Yeterli Yük</p>
              <p className="text-2xl font-bold text-green-600">{stats.adequate}</p>
            </div>
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Aşırı Yük</p>
              <p className="text-2xl font-bold text-red-600">{stats.overloaded}</p>
            </div>
            <TrendingUp className="h-8 w-8 text-red-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Toplam Harcanan</p>
              <p className="text-2xl font-bold text-purple-600">{stats.totalActualHours}h</p>
              <p className="text-xs text-gray-500 mt-1">Sprint tarihleri </p>
            </div>
            <Clock className="h-8 w-8 text-purple-600" />
          </div>
        </div>
      </div>

      {/* Developer Workload Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Yazılımcı İş Yükü Detayları</h3>
          <p className="text-sm text-gray-600 mt-1">
            Tahmini süreler sprint görevlerinden, harcanan süreler yazılımcının kendi projesinin sprint tarihlerindeki worklog'larından hesaplanır
          </p>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Yazılımcı
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Görev Sayısı
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Analist Tahmini Süre
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Yazılımcı Harcanan Süre
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Kapasite
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Durum
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Detay
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredWorkload.map((developer, index) => {
                const capacity = getCapacity(developer.developer);
                const actualHours = actualHoursData[developer.developer] || 0;
                
                return (
                  <React.Fragment key={developer.developer}>
                    <tr className={`hover:bg-gray-50 transition-colors ${
                      index % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'
                    }`}>
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-3">
                          <div className="flex-shrink-0 h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center">
                            <span className="text-sm font-medium text-blue-800">
                              {developer.developer.split(' ').map(n => n[0]).join('').slice(0, 2)}
                            </span>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900">{developer.developer}</p>
                            <p className="text-xs text-gray-500">{developer.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="text-lg font-semibold text-gray-900">{developer.totalTasks}</span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="text-lg font-semibold text-blue-600">{Math.round(developer.totalHours * 100) / 100}h</span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex flex-col items-center">
                          {actualHoursLoading ? (
                            <div className="flex items-center space-x-1">
                              <Loader className="h-4 w-4 animate-spin text-blue-600" />
                              <span className="text-sm text-gray-500">Sprint verileri bekleniyor...</span>
                            </div>
                          ) : actualHoursError ? (
                            <span className="text-sm text-red-600">Hata</span>
                          ) : (
                            <>
                              <span className="text-lg font-semibold text-purple-600">{actualHours}h</span>
                              <div className="text-xs text-gray-500 mt-1">
                                {developerProjectKeys[developer.developer] || 'Yükleniyor...'} projesi
                              </div>
                            </>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        {editingCapacity === developer.developer ? (
                          <div className="flex items-center justify-center space-x-2">
                            <input
                              type="number"
                              value={capacityValue}
                              onChange={(e) => setCapacityValue(e.target.value)}
                              className="w-16 text-center border border-gray-300 rounded px-2 py-1 text-sm"
                              min="1"
                              max="200"
                            />
                            <button
                              onClick={() => handleCapacitySave(developer.developer)}
                              className="text-green-600 hover:text-green-800 p-1"
                              title="Kaydet"
                            >
                              <Save className="h-4 w-4" />
                            </button>
                            <button
                              onClick={handleCapacityCancel}
                              className="text-gray-600 hover:text-gray-800 p-1"
                              title="İptal"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-center space-x-2">
                            <span className="text-sm font-medium text-gray-900">
                              {/* Kolay İK entegrasyonu aktifse ayarlanmış kapasiteyi göster */}
                              {hasKolayIK && showKolayIKIntegration && capacityCalculations.length > 0 ? (
                                (() => {
                                  const calc = capacityCalculations.find(c => c.developerName === developer.developer);
                                  return calc ? calc.adjustedCapacity : capacity;
                                })()
                              ) : capacity}h
                            </span>
                            {canEdit && (
                              <button
                                onClick={() => handleCapacityEdit(developer.developer)}
                                className="text-gray-400 hover:text-blue-600 p-1"
                                title="Kapasiteyi düzenle"
                              >
                                <Edit className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center space-x-2">
                          {(() => {
                            const capacity = getDeveloperCapacity(
                              developer.developer,
                              getCapacity,
                              hasKolayIK && showKolayIKIntegration,
                              capacityCalculations
                            );
                            const actualHours = actualHoursData[developer.developer] || 0;
                            const currentStatus = calculateDeveloperStatus(actualHours, capacity);
                            
                            return (
                              <>
                                {getStatusIcon(currentStatus)}
                                <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full border ${getStatusColor(currentStatus)}`}>
                                  {currentStatus}
                                </span>
                              </>
                            );
                          })()}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <button
                          onClick={() => setExpandedDeveloper(
                            expandedDeveloper === developer.developer ? null : developer.developer
                          )}
                          className="flex items-center space-x-1 text-blue-600 hover:text-blue-800 transition-colors mx-auto"
                        >
                          <span className="text-sm">Detaylar</span>
                          {expandedDeveloper === developer.developer ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </button>
                      </td>
                    </tr>

                    {/* Expanded Details */}
                    {expandedDeveloper === developer.developer && (
                      <tr>
                        <td colSpan={7} className="px-6 py-4 bg-gray-50">
                          <div className="space-y-4">
                            <h4 className="font-medium text-gray-900">
                              {developer.developer} - Proje Detayları
                            </h4>
                            
                            {developer.details.length > 0 ? (
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {developer.details.map((detail, detailIndex) => (
                                  <div key={detailIndex} className="bg-white rounded-lg border border-gray-200 p-4">
                                    <div className="flex items-center justify-between mb-3">
                                      <div>
                                        <h5 className="font-medium text-gray-900">{detail.project}</h5>
                                        <p className="text-sm text-gray-600">{detail.sprint}</p>
                                        <p className="text-xs text-blue-600">
                                          Proje: {developerProjectKeys[developer.developer] || 'Yükleniyor...'}
                                        </p>
                                      </div>
                                      <div className="text-right">
                                        <p className="text-sm font-medium text-blue-600">{detail.taskCount} görev</p>
                                        <p className="text-xs text-gray-500">{Math.round(detail.hours * 100) / 100}h tahmini</p>
                                        <p className="text-xs text-purple-600">{Math.round(detail.actualHours * 100) / 100}h harcanan</p>
                                      </div>
                                    </div>
                                    
                                    {/* Progress Bar */}
                                    <div className="space-y-2">
                                      <div className="flex justify-between text-xs text-gray-600">
                                        <span>İlerleme</span>
                                        <span>
                                          {detail.hours > 0 ? Math.round((detail.actualHours / detail.hours) * 100) : 
                                           detail.actualHours > 0 ? '∞' : 0}%
                                        </span>
                                      </div>
                                      <div className="w-full bg-gray-200 rounded-full h-2">
                                        <div 
                                          className={`h-2 rounded-full transition-all duration-300 ${
                                            detail.hours > 0 ? 'bg-blue-600' : 'bg-purple-600'
                                          }`}
                                          style={{ 
                                            width: `${detail.hours > 0 ? 
                                              Math.min((detail.actualHours / detail.hours) * 100, 100) : 
                                              detail.actualHours > 0 ? 100 : 0}%` 
                                          }}
                                        />
                                      </div>
                                    </div>

                                    {/* Task List veya Worklog Bilgisi */}
                                    {detail.tasks && detail.tasks.length > 0 ? (
                                      <div className="mt-3 pt-3 border-t border-gray-100">
                                        <p className="text-xs font-medium text-gray-700 mb-2">
                                          {detail.sprint === 'Sprint Dışı Görevler' ? 'Sprint Dışı Görevler:' : 'Sprint Görevleri:'}
                                        </p>
                                        <div className="space-y-1 max-h-32 overflow-y-auto">
                                          {detail.tasks.map((task, taskIndex) => (
                                            <div key={taskIndex} className="flex items-center justify-between text-xs">
                                              <div className="flex-1 min-w-0">
                                                <p className="text-blue-600 font-medium truncate">{task.key}</p>
                                                <p className="text-gray-600 truncate">{task.summary}</p>
                                                <div className="flex items-center space-x-2 mt-1">
                                                  <span className={`text-xs px-1.5 py-0.5 rounded ${
                                                    task.status === 'Sprint Dışı' ? 'bg-purple-100 text-purple-700' :
                                                    task.status.toLowerCase().includes('done') || task.status.toLowerCase().includes('tamam') ? 'bg-green-100 text-green-700' :
                                                    'bg-blue-100 text-blue-700'
                                                  }`}>
                                                    {task.status}
                                                  </span>
                                                  {task.issueType && (
                                                    <span className="text-xs text-gray-500">
                                                      {task.issueType}
                                                    </span>
                                                  )}
                                                </div>
                                              </div>
                                              <div className="text-right ml-2">
                                                <div className="text-right">
                                                  {task.estimatedHours > 0 && (
                                                    <p className="text-blue-600 text-xs">Tahmini: {task.estimatedHours}h</p>
                                                  )}
                                                  {task.actualHours > 0 && (
                                                    <p className="text-purple-600 text-xs font-medium">Harcanan: {task.actualHours}h</p>
                                                  )}
                                                </div>
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    ) : detail.actualHours > 0 ? (
                                      <div className="mt-3 pt-3 border-t border-gray-100">
                                        <p className="text-xs font-medium text-gray-700 mb-2">Süre Bilgisi:</p>
                                        <div className="bg-purple-50 rounded p-2">
                                          <p className="text-xs text-purple-700">
                                            Bu proje/sprint'te görev detayı bulunamadı, ancak {Math.round(detail.actualHours * 100) / 100}h süre harcamış
                                          </p>
                                        </div>
                                      </div>
                                    ) : null}
                                    
                                    {/* Sprint Tarih Bilgisi - Her detay için göster */}
                                    <div className="mt-3 pt-3 border-t border-gray-100">
                                      <div className="text-xs text-gray-500">
                                        <p className="font-medium">Sprint Tarihleri:</p>
                                        {(() => {
                                          const dateRange = getDeveloperSprintDateRange(developer.developer);
                                          return (
                                            <div className="mt-1">
                                              <p>{dateRange.start} - {dateRange.end}</p>
                                              <p className="mt-1">Sprintler: {dateRange.sprintNames.join(', ')}</p>
                                            </div>
                                          );
                                        })()}
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="text-center py-4">
                                <p className="text-gray-500">Bu yazılımcı için sprint görevi bulunamadı.</p>
                                {actualHoursData[developer.developer] > 0 && (
                                  <p className="text-sm text-purple-600 mt-2">
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

      {filteredWorkload.length === 0 && (
        <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
          <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500 text-lg">Yazılımcı verisi bulunamadı.</p>
          <p className="text-gray-400 text-sm mt-2">
            {user?.role === 'developer' 
              ? 'Size atanmış aktif görev bulunamadı.' 
              : 'Aktif sprint veya görev bulunamadı.'
            }
          </p>
        </div>
      )}
    </div>
  );
};

