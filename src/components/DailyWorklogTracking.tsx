import React, { useState, useEffect } from 'react';
import { worklogService } from '../services/worklogService';
import { kolayikService } from '../services/kolayikService';
import { DeveloperWorklogData, WorklogAnalytics } from '../types/worklog';
import { DeveloperLeaveInfo } from '../types/kolayik';
import { getWeekRange, getMonthRange } from '../utils/dateUtils';
import { useAuth } from '../context/AuthContext';
import { useJiraData } from '../context/JiraDataContext';
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
  Briefcase
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

  // Tarih aralığını hesapla
  const dateRange = viewMode === 'weekly'
    ? getWeekRange(currentDate)
    : getMonthRange(currentDate);

  // İzin verilerine göre worklog verilerini ayarla (pure function)
  const applyLeaveAdjustments = (data: DeveloperWorklogData[], leaveInfo: DeveloperLeaveInfo[]): DeveloperWorklogData[] => {
    console.log(`🔄 Applying leave adjustments to ${data.length} developers with ${leaveInfo.length} leave records`);
    console.log(`📊 Leave info details:`, leaveInfo.map(l => ({
      name: l.developerName,
      email: l.email,
      leaveDays: l.leaveDays
    })));

    return data.map(developer => {
      // Normalize names for comparison (Türkçe karakterler dahil)
      const normalizeName = (name: string) => name
        .toLocaleLowerCase('tr')
        .replace(/ı/g, 'i')
        .replace(/ş/g, 's')
        .replace(/ç/g, 'c')
        .replace(/ğ/g, 'g')
        .replace(/ü/g, 'u')
        .replace(/ö/g, 'o')
        .replace(/İ/g, 'i')
        .replace(/Ş/g, 's')
        .replace(/Ç/g, 'c')
        .replace(/Ğ/g, 'g')
        .replace(/Ü/g, 'u')
        .replace(/Ö/g, 'o')
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      const normalizedDevName = normalizeName(developer.developerName);
      console.log(`🔍 Looking for leave data for: ${developer.developerName} (normalized: ${normalizedDevName})`);

      const developerLeave = leaveInfo.find(leave => {
        const normalizedLeaveName = normalizeName(leave.developerName);
        const normalizedLeaveEmail = leave.email ? normalizeName(leave.email) : '';
        const normalizedDevEmail = developer.email ? normalizeName(developer.email) : '';

        const nameMatch = normalizedLeaveName === normalizedDevName;
        const emailMatch = normalizedLeaveEmail && normalizedDevEmail && normalizedLeaveEmail === normalizedDevEmail;

        console.log(`  🔎 Comparing with: ${leave.developerName} (normalized: ${normalizedLeaveName})`);
        console.log(`    nameMatch: ${nameMatch}, emailMatch: ${emailMatch}`);

        return nameMatch || emailMatch;
      });

      if (!developerLeave || developerLeave.leaveDays === 0) {
        console.log(`✓ ${developer.developerName}: No leave adjustment (${!developerLeave ? 'no record' : '0 days'})`);
        return developer;
      }

      // İzin günlerine göre haftalık hedefi ayarla
      const originalTarget = 35;
      const leaveDays = developerLeave.leaveDays;
      const adjustedTarget = Math.max(0, originalTarget - (leaveDays * 7));

      // Yeni status hesapla
      let newWeeklyStatus: 'sufficient' | 'insufficient' | 'excessive';
      if (developer.weeklyTotal < adjustedTarget * 0.9) {
        newWeeklyStatus = 'insufficient';
      } else if (developer.weeklyTotal <= adjustedTarget * 1.1) {
        newWeeklyStatus = 'sufficient';
      } else {
        newWeeklyStatus = 'excessive';
      }

      console.log(`📊 ${developer.developerName}: ${originalTarget}h → ${adjustedTarget}h (${leaveDays} gün izin), weeklyTotal: ${developer.weeklyTotal}h, status: ${developer.weeklyStatus} → ${newWeeklyStatus}`);

      return {
        ...developer,
        weeklyTarget: adjustedTarget,
        weeklyStatus: newWeeklyStatus
      };
    });
  };

  // Rol bazlı filtreleme
  const filterWorklogDataByRole = (data: DeveloperWorklogData[]): DeveloperWorklogData[] => {
    if (!user) return [];

    // Admin tüm yazılımcıları görebilir
    if (user.role === 'admin') {
      return data;
    }

    // Developer sadece kendi verisini görebilir
    if (user.role === 'developer') {
      return data.filter(dev => canViewDeveloperData(dev.developerName));
    }

    // Analyst kendi takımındaki yazılımcıları görebilir
    if (user.role === 'analyst') {
      const analystProjects = user.assignedProjects || [];
      return data.filter(dev => {
        const developerProject = getDeveloperProjectKey(dev.developerName);
        return developerProject && analystProjects.includes(developerProject);
      });
    }

    return [];
  };

  // Worklog verilerini yükle
  const loadWorklogData = async () => {
    setLoading(true);
    setError(null);

    try {
      console.log(`🚀 Loading ${viewMode} worklog data for ${dateRange.start} to ${dateRange.end}`);

      let data: DeveloperWorklogData[];
      let analyticsData: WorklogAnalytics;

      // Önce filtrelemeyi yap
      let filteredData: DeveloperWorklogData[];

      // Kapasite ayarlaması aktifse izin verilerini de yükle
      if (capacityAdjustmentEnabled && canViewDeveloperData) {
        try {
          // KolayIK entegrasyonu varsa izin bilgilerini yükle
          if (hasKolayIK) {
            setLeaveLoading(true);
            console.log(`🔄 Loading leave data for all developers`);

            const allDeveloperNames = await worklogService['getAllowedDevelopers']();
            console.log(`👥 Developer names from DB:`, allDeveloperNames);

            const leaveInfo = await kolayikService.getDeveloperLeaveInfo(
              allDeveloperNames,
              dateRange.start,
              dateRange.end
            );

            console.log(`📊 Leave info received:`, leaveInfo.map(l => ({
              name: l.developerName,
              email: l.email,
              leaveDays: l.leaveDays,
              hasLeave: l.leaveDays > 0
            })));

            setLeaveData(leaveInfo);
            console.log(`✅ Leave data loaded for ${leaveInfo.length} developers`);
            console.log(`📊 Developers with leave:`, leaveInfo.filter(l => l.leaveDays > 0).map(l => l.developerName));
          }

          // İzin bilgisi ile veriyi çek
          if (viewMode === 'weekly') {
            data = await worklogService.getDeveloperWorklogData(dateRange.start, dateRange.end);
            console.log(`📊 Worklog data received for ${data.length} developers:`, data.map(d => d.developerName));

            // Haftalık modda izin ayarlamasını uygula
            filteredData = filterWorklogDataByRole(data);
            console.log(`📊 Filtered worklog data (by role): ${filteredData.length} developers`);

            filteredData = applyLeaveAdjustments(filteredData, leaveInfo);
            console.log(`📊 After leave adjustments: ${filteredData.length} developers`);
          } else {
            // Aylık modda izin bilgisini servise gönder
            data = await worklogService.getMonthlyWorklogData(dateRange.start, dateRange.end, leaveInfo);
            filteredData = filterWorklogDataByRole(data);
          }

          console.log(`✅ Applied leave adjustments to worklog data`);
        } catch (leaveErr) {
          console.error('❌ Error loading leave data:', leaveErr);
          console.error('❌ Full error object:', JSON.stringify(leaveErr, null, 2));
          setLeaveError(leaveErr instanceof Error ? leaveErr.message : 'İzin verileri yüklenirken hata oluştu');

          // İzin verileri yüklenemezse izinsiz devam et
          if (viewMode === 'weekly') {
            data = await worklogService.getDeveloperWorklogData(dateRange.start, dateRange.end);
          } else {
            data = await worklogService.getMonthlyWorklogData(dateRange.start, dateRange.end);
          }
          filteredData = filterWorklogDataByRole(data);
        } finally {
          setLeaveLoading(false);
        }
      } else {
        // İzin ayarlaması kapalıysa izinsiz veriyi çek
        if (viewMode === 'weekly') {
          data = await worklogService.getDeveloperWorklogData(dateRange.start, dateRange.end);
        } else {
          data = await worklogService.getMonthlyWorklogData(dateRange.start, dateRange.end);
        }
        filteredData = filterWorklogDataByRole(data);
      }

      analyticsData = await worklogService.getWorklogAnalytics(dateRange.start, dateRange.end);
      console.log(`🔒 Filtered ${data.length} → ${filteredData.length} developers (role: ${user?.role})`);

      setWorklogData(filteredData);
      setAnalytics(analyticsData);
      console.log(`✅ ${viewMode} worklog data loaded for ${filteredData.length} developers`);
    } catch (err) {
      console.error('Error loading worklog data:', err);
      setError(err instanceof Error ? err.message : 'Worklog verileri yüklenirken hata oluştu');
    } finally {
      setLoading(false);
    }
  };


  // İlk yükleme ve tarih/mod değişikliklerinde yeniden yükle.
  // Analist/yazılımcı: Proje haritası hazır olana kadar bekle, yoksa filtre yanlış uygulanır (örn. Arif Tanış kendi bankasındaki Fahrettin'i göremez).
  useEffect(() => {
    const needsMapForFilter = user?.role === 'analyst' || user?.role === 'developer';
    if (needsMapForFilter && !developerProjectMapReady) {
      return;
    }
    loadWorklogData();
  }, [currentDate, viewMode, capacityAdjustmentEnabled, developerProjectMapReady, user?.role, lastRefreshAt]);

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

  // CSV Export
  const exportToCSV = () => {
    const dataToExport = selectedDeveloper === 'all' ? worklogData : filteredWorklogData;

    if (dataToExport.length === 0) {
      alert('İndirilecek veri bulunamadı.');
      return;
    }

    const csvHeaders = [
      'Yazılımcı',
      'E-posta',
      viewMode === 'weekly' ? 'Haftalık Toplam (saat)' : 'Aylık Toplam (saat)',
      viewMode === 'weekly' ? 'Haftalık Hedef (saat)' : 'Aylık Hedef (saat)',
      'Durum',
      'İzin Günleri',
      'Kapasite Ayarlaması',
      ...dateRange.dates.map(date => new Date(date).toLocaleDateString('tr-TR'))
    ];

    const csvData = dataToExport.map(dev => {
      const developerLeave = leaveData.find(leave => leave.developerName === dev.developerName);
      const leaveDays = developerLeave?.leaveDays || 0;
      const originalTarget = viewMode === 'weekly' ? 35 : dateRange.dates.filter(date => {
        const dayOfWeek = new Date(date).getDay();
        return dayOfWeek >= 1 && dayOfWeek <= 5;
      }).length * 7;
      const capacityAdjustment = leaveDays > 0 ? `${originalTarget}h → ${dev.weeklyTarget}h (-${leaveDays * 7}h)` : 'Ayarlama yok';
      
      return [
        dev.developerName,
        dev.email,
        dev.weeklyTotal,
        dev.weeklyTarget,
        dev.weeklyStatus === 'sufficient' ? 'Yeterli' : 
        dev.weeklyStatus === 'insufficient' ? 'Eksik' : 'Fazla',
        leaveDays,
        capacityAdjustment,
        ...dev.dailySummaries.map(day => day.totalHours)
      ];
    });

    const csvContent = [
      csvHeaders.join(','),
      ...csvData.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

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

  // Yenile
  const refresh = () => {
    worklogService.clearCache();
    kolayikService.clearCache();
    loadWorklogData();
  };

  // Durum renkleri
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'sufficient': return 'bg-green-100 text-green-800 border-green-200';
      case 'insufficient': return 'bg-red-100 text-red-800 border-red-200';
      case 'excessive': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'missing': return 'bg-gray-100 text-gray-800 border-gray-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'sufficient': return 'Yeterli';
      case 'insufficient': return 'Eksik';
      case 'excessive': return 'Fazla';
      case 'missing': return 'Veri Yok';
      default: return status;
    }
  };

  // Filtrelenmiş worklog verisi
  const filteredWorklogData = selectedDeveloper === 'all'
    ? worklogData
    : worklogData.filter(dev => dev.developerName === selectedDeveloper);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Günlük Süre Takibi</h2>
          <p className="text-gray-600 mt-1">
            Yazılımcıların günlük worklog kayıtları ve haftalık hedef takibi
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={exportToCSV}
            disabled={filteredWorklogData.length === 0}
            className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
          >
            <Download className="h-4 w-4" />
            <span>CSV İndir</span>
          </button>
          <button
            onClick={refresh}
            disabled={loading}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Yenile</span>
          </button>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
          {/* View Mode Toggle */}
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-1 bg-gray-100 p-1 rounded-lg">
              <button
                onClick={() => setViewMode('weekly')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  viewMode === 'weekly'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Haftalık
              </button>
              <button
                onClick={() => setViewMode('monthly')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  viewMode === 'monthly'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Aylık
              </button>
            </div>

            {/* Capacity Adjustment Toggle - Sadece haftalık modda */}
            {viewMode === 'weekly' && (
              <div className="flex items-center space-x-3">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="capacityAdjustment"
                    checked={capacityAdjustmentEnabled}
                    onChange={(e) => setCapacityAdjustmentEnabled(e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <label htmlFor="capacityAdjustment" className="text-sm font-medium text-gray-700">
                    İzin Günlerine Göre Kapasite Ayarla
                  </label>
                </div>
               
              </div>
            )}

            {/* Developer Filter */}
            <div className="flex items-center space-x-2">
              <label htmlFor="developerFilter" className="text-sm font-medium text-gray-700">
                Yazılımcı:
              </label>
              <select
                id="developerFilter"
                value={selectedDeveloper}
                onChange={(e) => setSelectedDeveloper(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">Tümü ({worklogData.length})</option>
                {worklogData.map(dev => (
                  <option key={dev.developerName} value={dev.developerName}>
                    {dev.developerName}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Date Navigation */}
          <div className="flex items-center space-x-4">
            <button
              onClick={() => navigateDate('prev')}
              className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            
            <div className="text-center">
              <h3 className="text-lg font-semibold text-gray-900">
                {viewMode === 'weekly' ? dateRange.weekLabel : dateRange.monthLabel}
              </h3>
              <p className="text-sm text-gray-600">
                {dateRange.start} - {dateRange.end}
              </p>
            </div>
            
            <button
              onClick={() => navigateDate('next')}
              className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
            
            <button
              onClick={goToToday}
              className="px-3 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm"
            >
              Bu Hafta
            </button>
          </div>

        </div>
      </div>

      {/* Leave Integration Status - Sadece haftalık modda */}
      {viewMode === 'weekly' && capacityAdjustmentEnabled && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <CalendarDays className="h-5 w-5 text-blue-600" />
              <div>
                <h3 className="font-semibold text-gray-900">İzin Entegrasyonu</h3>
                <p className="text-sm text-gray-600">
                  Haftalık kapasiteler izin günlerine göre otomatik ayarlanıyor
                </p>
              </div>
            </div>
            
            {leaveLoading && (
              <div className="flex items-center space-x-2 text-blue-600">
                <Loader className="h-4 w-4 animate-spin" />
                <span className="text-sm">İzin verileri yükleniyor...</span>
              </div>
            )}
          </div>

          {leaveError && (
            <div className="mt-3 bg-red-50 border border-red-200 rounded-lg p-3">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="h-4 w-4 text-red-600" />
                <p className="text-red-800 text-sm">{leaveError}</p>
              </div>
            </div>
          )}

          {!leaveLoading && !leaveError && leaveData.length > 0 && (
            <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-blue-50 rounded-lg p-3">
                <div className="flex items-center space-x-2">
                  <Users className="h-4 w-4 text-blue-600" />
                  <span className="text-sm font-medium text-blue-800">
                    {leaveData.filter(leave => leave.leaveDays > 0).length} yazılımcının izni var
                  </span>
                </div>
              </div>
              
              <div className="bg-orange-50 rounded-lg p-3">
                <div className="flex items-center space-x-2">
                  <Clock className="h-4 w-4 text-orange-600" />
                  <span className="text-sm font-medium text-orange-800">
                    {leaveData.reduce((sum, leave) => sum + leave.leaveDays, 0)} toplam izin günü
                  </span>
                </div>
              </div>
              
              <div className="bg-green-50 rounded-lg p-3">
                <div className="flex items-center space-x-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span className="text-sm font-medium text-green-800">
                    Kapasiteler otomatik ayarlandı
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            <p className="text-red-800">{error}</p>
          </div>
          <button
            onClick={refresh}
            className="mt-3 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            Tekrar Dene
          </button>
        </div>
      )}

      {/* Analytics Cards */}
      {analytics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Toplam Yazılımcı</p>
                <p className="text-2xl font-bold text-blue-600">{analytics.totalDevelopers}</p>
              </div>
              <Users className="h-8 w-8 text-blue-600" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Toplam Süre</p>
                <p className="text-2xl font-bold text-green-600">{analytics.totalHours}h</p>
              </div>
              <Clock className="h-8 w-8 text-green-600" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Ortalama Günlük</p>
                <p className="text-2xl font-bold text-purple-600">{analytics.averageDailyHours}h</p>
              </div>
              <TrendingUp className="h-8 w-8 text-purple-600" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Worklog Kayıt</p>
                <p className="text-2xl font-bold text-orange-600">{analytics.totalWorklogEntries}</p>
              </div>
              <Calendar className="h-8 w-8 text-orange-600" />
            </div>
          </div>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="flex items-center space-x-2">
            <Loader className="h-6 w-6 animate-spin text-blue-600" />
            <span className="text-gray-600">
              {viewMode === 'weekly' ? 'Haftalık' : 'Aylık'} worklog verileri yükleniyor...
            </span>
          </div>
        </div>
      )}

      {/* Worklog Data Table */}
      {!loading && filteredWorklogData.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">
                {viewMode === 'weekly' ? 'Haftalık' : 'Aylık'} Süre Takibi
              </h3>
              {viewMode === 'weekly' && capacityAdjustmentEnabled && leaveData.some(leave => leave.leaveDays > 0) && (
                <div className="flex items-center space-x-2 text-sm text-blue-600 bg-blue-50 px-3 py-1 rounded-full">
                  <CalendarDays className="h-4 w-4" />
                  <span>İzin ayarlaması aktif</span>
                </div>
              )}
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Yazılımcı
                  </th>
                  {dateRange.dates.map(date => (
                    <th key={date} className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <div>
                        {new Date(date).toLocaleDateString('tr-TR', { 
                          weekday: 'short',
                          day: 'numeric',
                          month: 'short'
                        })}
                      </div>
                    </th>
                  ))}
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {viewMode === 'weekly' ? 'Haftalık' : 'Aylık'} Toplam
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Hedef
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Durum
                  </th>
                  {viewMode === 'weekly' && capacityAdjustmentEnabled && (
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      İzin Etkisi
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredWorklogData.map((developer, index) => {
                  const developerLeave = leaveData.find(leave => leave.developerName === developer.developerName);
                  const hasLeave = developerLeave && developerLeave.leaveDays > 0;
                  const originalTarget = viewMode === 'weekly' ? 35 : dateRange.dates.filter(date => {
                    const dayOfWeek = new Date(date).getDay();
                    return dayOfWeek >= 1 && dayOfWeek <= 5;
                  }).length * 7;
                  
                  const isExpanded = expandedDevelopers.has(developer.developerName);
                  const toggleExpanded = () => {
                    const newExpanded = new Set(expandedDevelopers);
                    if (isExpanded) {
                      newExpanded.delete(developer.developerName);
                    } else {
                      newExpanded.add(developer.developerName);
                    }
                    setExpandedDevelopers(newExpanded);
                  };

                  return (
                    <React.Fragment key={developer.developerName}>
                    <tr className={`hover:bg-gray-50 transition-colors ${
                      index % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'
                    }`}>
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-3">
                          <button
                            onClick={toggleExpanded}
                            className="flex-shrink-0 p-1 hover:bg-gray-200 rounded transition-colors"
                          >
                            {isExpanded ? (
                              <ChevronUp className="h-4 w-4 text-gray-600" />
                            ) : (
                              <ChevronDown className="h-4 w-4 text-gray-600" />
                            )}
                          </button>
                          <div className="flex-shrink-0 h-8 w-8 bg-blue-100 rounded-full flex items-center justify-center">
                            <span className="text-xs font-medium text-blue-800">
                              {developer.developerName.split(' ').map(n => n[0]).join('').slice(0, 2)}
                            </span>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900">{developer.developerName}</p>
                            <p className="text-xs text-gray-500">{developer.email}</p>
                            {hasLeave && viewMode === 'weekly' && capacityAdjustmentEnabled && (
                              <div className="flex items-center space-x-1 mt-1">
                                <CalendarDays className="h-3 w-3 text-orange-500" />
                                <span className="text-xs text-orange-600">
                                  {developerLeave.leaveDays} gün izin
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      
                      {/* Daily Hours */}
                      {developer.dailySummaries.map((day) => (
                        <td key={day.date} className="px-3 py-4 text-center">
                          <div className="flex flex-col items-center space-y-1">
                            <span className={`text-sm font-medium ${
                              day.totalHours === 0 ? 'text-gray-400' :
                              day.totalHours >= 7 ? 'text-green-600' :
                              day.totalHours >= 5 ? 'text-yellow-600' : 'text-red-600'
                            }`}>
                              {day.totalHours > 0 ? `${day.totalHours}h` : '-'}
                            </span>
                            
                          </div>
                        </td>
                      ))}
                      
                      {/* Weekly/Monthly Total */}
                      <td className="px-6 py-4 text-center">
                        <span className="text-sm font-semibold text-gray-900">
                          {developer.weeklyTotal}h
                        </span>
                      </td>
                      
                      {/* Target */}
                      <td className="px-6 py-4 text-center">
                        <div className="flex flex-col items-center space-y-1">
                          <span className="text-sm font-medium text-gray-900">
                            {developer.weeklyTarget}h
                          </span>
                          {hasLeave && viewMode === 'weekly' && capacityAdjustmentEnabled && (
                            <span className="text-xs text-orange-600">
                              (orijinal: {originalTarget}h)
                            </span>
                          )}
                        </div>
                      </td>
                      
                      {/* Status */}
                      <td className="px-6 py-4 text-center">
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full border ${getStatusColor(developer.weeklyStatus)}`}>
                          {getStatusText(developer.weeklyStatus)}
                        </span>
                        <div className="mt-1">
                          <div className="w-16 bg-gray-200 rounded-full h-2 mx-auto">
                            <div 
                              className={`h-2 rounded-full ${
                                developer.weeklyStatus === 'sufficient' ? 'bg-green-500' :
                                developer.weeklyStatus === 'insufficient' ? 'bg-red-500' : 'bg-blue-500'
                              }`}
                              style={{ 
                                width: `${Math.min(100, (developer.weeklyTotal / developer.weeklyTarget) * 100)}%` 
                              }}
                            />
                          </div>
                        </div>
                      </td>
                      
                      {/* Leave Impact - Sadece haftalık modda */}
                      {viewMode === 'weekly' && capacityAdjustmentEnabled && (
                        <td className="px-6 py-4 text-center">
                          {hasLeave ? (
                            <div className="space-y-1">
                              <div className="text-xs text-orange-600 font-medium">
                                -{developerLeave.leaveDays * 7}h
                              </div>
                              <div className="text-xs text-gray-500">
                                {developerLeave.leaveDays} gün izin
                              </div>
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400">İzin yok</span>
                          )}
                        </td>
                      )}
                    </tr>

                    {/* Expanded Details Row */}
                    {isExpanded && (
                      <tr className="bg-gray-50">
                        <td colSpan={dateRange.dates.length + 4 + (viewMode === 'weekly' && capacityAdjustmentEnabled ? 1 : 0)} className="px-6 py-4">
                          <div className="space-y-4">
                            {/* Leave Details */}
                            {hasLeave && viewMode === 'weekly' && capacityAdjustmentEnabled && (
                              <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                                <div className="flex items-center space-x-2 mb-2">
                                  <CalendarDays className="h-4 w-4 text-orange-600" />
                                  <span className="text-sm font-medium text-orange-800">İzin Detayları</span>
                                </div>
                                <div className="space-y-1">
                                  {developerLeave.leaveDetails.map((leave, idx) => (
                                    <div key={idx} className="text-xs text-orange-700">
                                      <span className="font-medium">{leave.leaveType}:</span> {' '}
                                      {new Date(leave.startDate).toLocaleDateString('tr-TR')} - {' '}
                                      {new Date(leave.endDate).toLocaleDateString('tr-TR')} {' '}
                                      ({leave.days} gün)
                                      {leave.description && (
                                        <span className="italic"> - {leave.description}</span>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Project Summary - Aylık modda göster */}
                            {viewMode === 'monthly' && (
                              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                                <div className="flex items-center space-x-2 mb-3">
                                  <Briefcase className="h-5 w-5 text-blue-600" />
                                  <h4 className="text-sm font-semibold text-blue-900">Proje Bazlı Özet</h4>
                                </div>
                                {(() => {
                                  const allEntries = developer.dailySummaries.flatMap(day => day.entries);
                                  const projectHours = allEntries.reduce((acc, entry) => {
                                    const project = entry.project || 'Bilinmeyen Proje';
                                    acc[project] = (acc[project] || 0) + entry.timeSpentHours;
                                    return acc;
                                  }, {} as Record<string, number>);

                                  const sortedProjects = Object.entries(projectHours)
                                    .sort(([, a], [, b]) => b - a);

                                  if (sortedProjects.length === 0) {
                                    return (
                                      <div className="text-sm text-gray-600 text-center py-4">
                                        Bu dönemde kayıtlı proje çalışması bulunamadı.
                                      </div>
                                    );
                                  }

                                  return (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                      {sortedProjects.map(([project, hours]) => (
                                        <div key={project} className="bg-white rounded-lg p-3 border border-blue-100">
                                          <div className="flex items-center justify-between mb-2">
                                            <span className="text-sm font-medium text-gray-900 truncate flex-1 mr-2">
                                              {project}
                                            </span>
                                            <span className="text-sm font-bold text-blue-600 whitespace-nowrap">
                                              {Math.round(hours * 100) / 100}h
                                            </span>
                                          </div>
                                          <div className="w-full bg-gray-200 rounded-full h-2">
                                            <div
                                              className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                                              style={{
                                                width: `${(hours / developer.weeklyTotal) * 100}%`
                                              }}
                                            />
                                          </div>
                                          <div className="mt-1 text-xs text-gray-500">
                                            {Math.round((hours / developer.weeklyTotal) * 100)}% toplam
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  );
                                })()}
                              </div>
                            )}

                            {/* Daily Entries - Sadece haftalık modda göster */}
                            {viewMode === 'weekly' && (
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
                                {developer.dailySummaries
                                  .filter(day => day.entries.length > 0)
                                  .map((day) => (
                                    <div key={day.date} className="border border-gray-200 rounded-lg p-3 bg-white">
                                      <div className="flex items-center justify-between mb-2">
                                        <h5 className="text-sm font-medium text-gray-900">
                                          {new Date(day.date).toLocaleDateString('tr-TR', {
                                            weekday: 'short',
                                            day: 'numeric',
                                            month: 'short'
                                          })}
                                        </h5>
                                        <span className={`text-sm font-semibold ${
                                          day.totalHours >= 7 ? 'text-green-600' :
                                          day.totalHours >= 5 ? 'text-yellow-600' : 'text-red-600'
                                        }`}>
                                          {day.totalHours}h
                                        </span>
                                      </div>

                                      <div className="space-y-1">
                                        {day.entries.map((entry, entryIndex) => (
                                          <div key={entryIndex} className="text-xs bg-gray-50 rounded p-2">
                                            <div className="font-medium text-blue-600">{entry.issueKey}</div>
                                            <div className="text-gray-700 line-clamp-2">{entry.issueSummary}</div>
                                            <div className="flex items-center justify-between mt-1">
                                              <span className="text-gray-500">{entry.project}</span>
                                              <span className="font-medium text-gray-900">{entry.timeSpentHours}h</span>
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
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">
                {worklogData.length} yazılımcı gösteriliyor
              </span>
              <div className="flex items-center space-x-4">
                <span className="flex items-center space-x-1">
                  <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                  <span>{analytics?.developersWithSufficientHours || 0} Yeterli</span>
                </span>
                <span className="flex items-center space-x-1">
                  <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                  <span>{analytics?.developersWithInsufficientHours || 0} Eksik</span>
                </span>
                <span className="flex items-center space-x-1">
                  <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                  <span>{analytics?.developersWithExcessiveHours || 0} Fazla</span>
                </span>
              </div>
            </div>
          </div>
        </div>
      )}


      {/* Empty State */}
      {!loading && worklogData.length === 0 && (
        <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
          <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500 text-lg">
            {viewMode === 'weekly' ? 'Bu hafta' : 'Bu ay'} için worklog verisi bulunamadı.
          </p>
          <p className="text-gray-400 text-sm mt-2">
            Farklı bir {viewMode === 'weekly' ? 'hafta' : 'ay'} seçin veya Jira bağlantısını kontrol edin.
          </p>
        </div>
      )}

      {/* Filtered Empty State */}
      {!loading && worklogData.length > 0 && filteredWorklogData.length === 0 && (
        <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
          <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500 text-lg">
            Seçili yazılımcı için veri bulunamadı.
          </p>
          <p className="text-gray-400 text-sm mt-2">
            Farklı bir yazılımcı seçin veya filtreyi kaldırın.
          </p>
        </div>
      )}
    </div>
  );
};

export default DailyWorklogTracking;