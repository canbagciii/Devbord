import React, { useState, useEffect } from 'react';
import { kolayikService } from '../services/kolayikService';
import { KolayIKEmployee, KolayIKLeaveRequest, DeveloperLeaveInfo } from '../types/kolayik';
import { useAuth } from '../context/AuthContext';
import { 
  Users, 
  RefreshCw, 
  Search, 
  Filter,
  Building,
  Mail,
  Calendar,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Download,
  Eye,
  EyeOff,
  Loader,
  CalendarDays,
  Clock
} from 'lucide-react';

export const KolayIKEmployees: React.FC = () => {
  const { hasRole } = useAuth();
  const [employeesWithLeave, setEmployeesWithLeave] = useState<KolayIKEmployee[]>([]);
  const [leaveData, setLeaveData] = useState<DeveloperLeaveInfo[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [departmentFilter, setDepartmentFilter] = useState<string>('all');
  const [connectionStatus, setConnectionStatus] = useState<{
    success: boolean;
    message: string;
    employeeCount?: number;
  } | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  // Yetki kontrolü
  if (!hasRole('admin')) {
    return (
      <div className="space-y-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            <p className="text-red-800">Bu sayfaya erişim yetkiniz bulunmuyor.</p>
          </div>
          <p className="text-red-700 text-sm mt-2">
            Kolay İK çalışan listesi sadece Yönetici rolleri tarafından görüntülenebilir.
          </p>
        </div>
      </div>
    );
  }

  useEffect(() => {
    loadEmployeesWithLeave();
  }, []);

  useEffect(() => {
    loadEmployeesWithLeave();
  }, [selectedMonth]);

  const loadEmployeesWithLeave = async () => {
    setLoading(true);
    setError(null);
    setEmployeesWithLeave([]);
    setLeaveData([]);

    try {
      console.log('🚀 Kolay İK sayfası: önce seçili kullanıcılar (person/list), sonra izinler');
      const testResult = await kolayikService.testConnection();
      setConnectionStatus(testResult);
      if (!testResult.success) {
        throw new Error(testResult.message);
      }

      // 1) Sadece Jira Filtre Yönetimi'nde seçili yazılımcılar: person/list + isim eşleşmesi
      const employees = await kolayikService.getEmployees();
      if (!employees.length) {
        setError(
          'Bu sayfada sadece Jira Filtre Yönetimi\'nde seçili yazılımcılar gösterilir. Liste boş ise: ' +
          '1) Kullanıcı & Filtre Yönetimi\'nden en az bir yazılımcı seçin. ' +
          '2) Kolay İK\'daki person isimleri (Ad Soyad) Jira\'daki yazılımcı isimleriyle aynı/benzer olmalı. ' +
          '3) Kolay İK token ve person listesini kontrol edin. "Tekrar Dene" ile yenileyin.'
        );
        setLoading(false);
        return;
      }
      console.log(`📋 Seçili kullanıcılar (Kolay İK person/list): ${employees.length}`, employees.map(e => e.fullName));

      // 2) Seçilen ayın tarih aralığı
      const [year, month] = selectedMonth.split('-');
      const startDate = `${year}-${month}-01`;
      const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
      const endDate = `${year}-${month}-${String(lastDay).padStart(2, '0')}`;

      // 3) Bu kullanıcıların izinlerini çek (resmi tatiller dahil)
      const developerNames = employees.map(e => e.fullName);
      const leaveInfo = await kolayikService.getDeveloperLeaveInfo(developerNames, startDate, endDate);

      setEmployeesWithLeave(employees);
      setLeaveData(leaveInfo);
      console.log(`✅ ${employees.length} seçili kullanıcı, ${leaveInfo.length} izin kaydı yüklendi`);
    } catch (err) {
      console.error('Error loading employees/leave:', err);
      setError(err instanceof Error ? err.message : 'Çalışanlar veya izinler yüklenirken hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  const refresh = () => {
    kolayikService.clearCache();
    loadEmployeesWithLeave();
  };

  // Filtreleme
  const filteredEmployees = employeesWithLeave.filter(employee => {
    const matchesSearch = employee.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         employee.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (employee.department || '').toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || 
                         (statusFilter === 'active' && employee.isActive) ||
                         (statusFilter === 'inactive' && !employee.isActive);
    
    const matchesDepartment = departmentFilter === 'all' || 
                             (employee.department || '').toLowerCase() === departmentFilter.toLowerCase();
    
    return matchesSearch && matchesStatus && matchesDepartment;
  });

  // Departman listesi
  const departments = Array.from(new Set(
    employeesWithLeave
      .map(emp => emp.department)
      .filter(Boolean)
      .map(dept => dept!)
  )).sort();

  // İstatistikler
  const stats = {
    total: employeesWithLeave.length,
    active: employeesWithLeave.filter(emp => emp.isActive).length,
    inactive: employeesWithLeave.filter(emp => !emp.isActive).length,
    withEmail: employeesWithLeave.filter(emp => emp.email).length,
    departments: departments.length
  };

  // CSV Export
  const exportEmployeesToCSV = () => {
    if (filteredEmployees.length === 0) {
      alert('İndirilecek çalışan verisi bulunamadı.');
      return;
    }

    const csvHeaders = [
      'ID',
      'Ad',
      'Soyad',
      'Tam Ad',
      'E-posta',
      'Departman',
      'Pozisyon',
      'Durum',
      'İşe Başlama Tarihi'
    ];

    const csvData = filteredEmployees.map(emp => [
      emp.id,
      emp.firstName,
      emp.lastName,
      emp.fullName,
      emp.email,
      emp.department || '',
      emp.position || '',
      emp.isActive ? 'Aktif' : 'Pasif',
      emp.startDate ? new Date(emp.startDate).toLocaleDateString('tr-TR') : ''
    ]);

    const csvContent = [
      csvHeaders.join(','),
      ...csvData.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `kolayik_calisanlar_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // İzin verilerini CSV'ye export et
  const exportLeaveDataToCSV = () => {
    if (leaveData.length === 0) {
      alert('İndirilecek izin verisi bulunamadı.');
      return;
    }

    const csvHeaders = [
      'Yazılımcı',
      'E-posta',
      'Toplam İzin Günü',
      'İzin Detayları',
      'Ay'
    ];

    const csvData = leaveData.map(dev => [
      dev.developerName,
      dev.email,
      dev.leaveDays,
      dev.leaveDetails.map(leave => 
        `${leave.leaveType}: ${leave.startDate} - ${leave.endDate} (${leave.days} gün)`
      ).join('; '),
      selectedMonth
    ]);

    const csvContent = [
      csvHeaders.join(','),
      ...csvData.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `kolayik_izin_verileri_${selectedMonth}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">İzin Takibi</h2>
          <p className="text-gray-600 mt-1">Seçilen ayda izni olan çalışanlar</p>
        </div>
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2">
            <label className="text-sm font-medium text-gray-700">Ay:</label>
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            />
          </div>
          <button
            onClick={exportEmployeesToCSV}
            disabled={filteredEmployees.length === 0}
            className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
          >
            <Download className="h-4 w-4" />
            <span>Çalışanlar CSV</span>
          </button>
          <button
            onClick={exportLeaveDataToCSV}
            disabled={leaveData.length === 0}
            className="flex items-center space-x-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors"
          >
            <CalendarDays className="h-4 w-4" />
            <span>İzinler CSV</span>
          </button>
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="flex items-center space-x-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            {showDetails ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            <span>{showDetails ? 'Basit Görünüm' : 'Detaylı Görünüm'}</span>
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

      {/* Connection Status */}
      {connectionStatus && (
        <div className={`rounded-lg p-4 border ${
          connectionStatus.success 
            ? 'bg-green-50 border-green-200' 
            : 'bg-red-50 border-red-200'
        }`}>
          <div className="flex items-center space-x-2">
            {connectionStatus.success ? (
              <CheckCircle className="h-5 w-5 text-green-600" />
            ) : (
              <XCircle className="h-5 w-5 text-red-600" />
            )}
            <p className={connectionStatus.success ? 'text-green-800' : 'text-red-800'}>
              {connectionStatus.message}
            </p>
          </div>
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

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Toplam Çalışan</p>
              <p className="text-2xl font-bold text-blue-600">{stats.total}</p>
            </div>
            <Users className="h-8 w-8 text-blue-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Aktif</p>
              <p className="text-2xl font-bold text-green-600">{stats.active}</p>
            </div>
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Pasif</p>
              <p className="text-2xl font-bold text-red-600">{stats.inactive}</p>
            </div>
            <XCircle className="h-8 w-8 text-red-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">E-posta Var</p>
              <p className="text-2xl font-bold text-purple-600">{stats.withEmail}</p>
            </div>
            <Mail className="h-8 w-8 text-purple-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Departman</p>
              <p className="text-2xl font-bold text-orange-600">{stats.departments}</p>
            </div>
            <Building className="h-8 w-8 text-orange-600" />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="İzinli çalışan ara..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">Tüm Durumlar</option>
            <option value="active">Aktif</option>
            <option value="inactive">Pasif</option>
          </select>
          
          <select
            value={departmentFilter}
            onChange={(e) => setDepartmentFilter(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">Tüm Departmanlar</option>
            {departments.map(dept => (
              <option key={dept} value={dept}>{dept}</option>
            ))}
          </select>
        </div>
        
        {searchTerm && (
          <div className="mt-2 text-sm text-gray-600">
            {filteredEmployees.length} çalışan gösteriliyor
          </div>
        )}
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="flex items-center space-x-2">
            <Loader className="h-6 w-6 animate-spin text-blue-600" />
            <span className="text-gray-600">İzinli çalışanlar yükleniyor...</span>
          </div>
        </div>
      )}

      {/* Employees with Leave Table */}
      {!loading && filteredEmployees.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">İzinli Çalışan Listesi</h3>
            <p className="text-sm text-gray-600 mt-1">
              {selectedMonth} ayında izni olan {filteredEmployees.length} çalışan
            </p>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Çalışan
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    E-posta
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    İzin Günleri
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    İzin Detayları
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Kapasite Etkisi
                  </th>
                  {showDetails && (
                    <>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Departman
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Pozisyon
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        İşe Başlama
                      </th>
                    </>
                  )}
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Durum
                  </th>
                  {showDetails && (
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      ID
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredEmployees.map((employee, index) => {
                  // Eşleştirme: önce tam isim, sonra email, sonra normalize edilmiş isim
                  const employeeLeaveData = leaveData.find(leave => {
                    const nameMatch = leave.developerName === employee.fullName;
                    const emailMatch = leave.email && employee.email && leave.email === employee.email;
                    return nameMatch || emailMatch;
                  }) || leaveData.find(leave => {
                    // Normalize edilmiş isim eşleştirmesi
                    const normalize = (name: string) => name.toLowerCase().trim();
                    return normalize(leave.developerName) === normalize(employee.fullName);
                  });
                  
                  return (
                      <tr key={employee.id} className={`hover:bg-gray-50 transition-colors ${
                        index % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'
                      }`}>
                        <td className="px-6 py-4">
                          <div className="flex items-center space-x-3">
                            <div className="flex-shrink-0 h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center">
                              <span className="text-sm font-medium text-blue-800">
                                {employee.firstName[0]}{employee.lastName[0]}
                              </span>
                            </div>
                            <div>
                              <p className="text-sm font-medium text-gray-900">{employee.fullName}</p>
                              <div className="flex items-center space-x-2">
                                <span className="text-xs text-gray-500">{employee.firstName}</span>
                                <span className="text-xs text-gray-500">{employee.lastName}</span>
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center space-x-2">
                            {employee.email ? (
                              <>
                                <Mail className="h-4 w-4 text-gray-400" />
                                <span className="text-sm text-gray-900">{employee.email}</span>
                              </>
                            ) : (
                              <span className="text-sm text-gray-400 italic">E-posta yok</span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <div className="flex items-center justify-center space-x-1">
                            <CalendarDays className="h-4 w-4 text-orange-500" />
                            <span className={`text-sm font-medium ${
                              employeeLeaveData && employeeLeaveData.leaveDays > 0 ? 'text-orange-600' : 'text-gray-400'
                            }`}>
                              {employeeLeaveData?.leaveDays || 0} gün
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          {employeeLeaveData && employeeLeaveData.leaveDetails.length > 0 ? (
                            <div className="space-y-1">
                              {employeeLeaveData.leaveDetails.map((leave, idx) => {
                                const isPublicHoliday = leave.leaveType.includes('Resmi Tatil');
                                return (
                                  <div
                                    key={idx}
                                    className={`text-xs rounded px-2 py-1 ${
                                      isPublicHoliday
                                        ? 'bg-purple-50 border border-purple-200'
                                        : 'bg-orange-50 border border-orange-200'
                                    }`}
                                  >
                                    <div className={`font-medium ${isPublicHoliday ? 'text-purple-800' : 'text-orange-800'}`}>
                                      {leave.leaveType}
                                    </div>
                                    <div className={isPublicHoliday ? 'text-purple-600' : 'text-orange-600'}>
                                      {new Date(leave.startDate).toLocaleDateString('tr-TR')} - {new Date(leave.endDate).toLocaleDateString('tr-TR')}
                                    </div>
                                    <div className={isPublicHoliday ? 'text-purple-600' : 'text-orange-600'}>
                                      {leave.days} {leave.days === 0.5 ? 'yarım gün' : leave.days === 1 ? 'gün' : 'gün'}
                                    </div>
                                    {leave.description && (
                                      <div className={`italic ${isPublicHoliday ? 'text-purple-600' : 'text-orange-600'}`}>
                                        {leave.description}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400">İzin detayı yok</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <div className="flex items-center justify-center space-x-1">
                            <Clock className="h-4 w-4 text-red-500" />
                            <span className={`text-sm font-medium ${
                              employeeLeaveData && employeeLeaveData.leaveDays > 0 ? 'text-red-600' : 'text-gray-400'
                            }`}>
                              -{(employeeLeaveData?.leaveDays || 0) * 7}h
                            </span>
                          </div>
                          {employeeLeaveData && employeeLeaveData.leaveDays > 0 && (
                            <div className="text-xs text-gray-500 mt-1">
                              70h → {70 - (employeeLeaveData.leaveDays * 7)}h
                            </div>
                          )}
                        </td>
                        {showDetails && (
                          <>
                            <td className="px-6 py-4">
                              <div className="flex items-center space-x-2">
                                {employee.department ? (
                                  <>
                                    <Building className="h-4 w-4 text-gray-400" />
                                    <span className="text-sm text-gray-900">{employee.department}</span>
                                  </>
                                ) : (
                                  <span className="text-sm text-gray-400 italic">Departman yok</span>
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <span className="text-sm text-gray-900">
                                {employee.position || '-'}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-center">
                              <div className="flex items-center justify-center space-x-2">
                                {employee.startDate ? (
                                  <>
                                    <Calendar className="h-4 w-4 text-gray-400" />
                                    <span className="text-sm text-gray-900">
                                      {new Date(employee.startDate).toLocaleDateString('tr-TR')}
                                    </span>
                                  </>
                                ) : (
                                  <span className="text-sm text-gray-400">-</span>
                                )}
                              </div>
                            </td>
                          </>
                        )}
                        <td className="px-6 py-4 text-center">
                          <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full border ${
                            employee.isActive 
                              ? 'bg-green-100 text-green-800 border-green-200' 
                              : 'bg-red-100 text-red-800 border-red-200'
                          }`}>
                            {employee.isActive ? 'Aktif' : 'Pasif'}
                          </span>
                        </td>
                        {showDetails && (
                          <td className="px-6 py-4 text-center">
                            <span className="text-sm font-mono text-gray-600">{employee.id}</span>
                          </td>
                        )}
                      </tr>
                    );
                })}
              </tbody>
            </table>
          </div>
          
          {/* Table Footer */}
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">
                {selectedMonth} ayında izni olan {filteredEmployees.length} çalışan gösteriliyor
              </span>
              <div className="flex items-center space-x-4">
                <span className="flex items-center space-x-1">
                  <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                  <span>{stats.active} Aktif</span>
                </span>
                <span className="flex items-center space-x-1">
                  <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                  <span>{stats.inactive} Pasif</span>
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!loading && filteredEmployees.length === 0 && employeesWithLeave.length > 0 && (
        <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
          <Search className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500 text-lg">Arama kriterlerine uygun çalışan bulunamadı.</p>
          <p className="text-gray-400 text-sm mt-2">Filtreleri değiştirmeyi deneyin.</p>
        </div>
      )}

      {/* No Data State */}
      {!loading && employeesWithLeave.length === 0 && !error && (
        <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
          <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500 text-lg">{selectedMonth} ayında izni olan çalışan bulunamadı.</p>
          <p className="text-gray-400 text-sm mt-2">
            Farklı bir ay seçin veya API bağlantısını kontrol edin.
          </p>
        </div>
      )}

      {/* Department Summary */}
      {!loading && departments.length > 0 && showDetails && employeesWithLeave.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Departman Dağılımı</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {departments.map(dept => {
              const deptEmployees = employeesWithLeave.filter(emp => emp.department === dept);
              const activeDeptEmployees = deptEmployees.filter(emp => emp.isActive);
              
              return (
                <div key={dept} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center space-x-2 mb-2">
                    <Building className="h-4 w-4 text-blue-600" />
                    <h4 className="font-medium text-gray-900">{dept}</h4>
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Toplam:</span>
                      <span className="font-medium">{deptEmployees.length}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Aktif:</span>
                      <span className="font-medium text-green-600">{activeDeptEmployees.length}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                      <div 
                        className="bg-green-500 h-2 rounded-full"
                        style={{ width: `${(activeDeptEmployees.length / deptEmployees.length) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};