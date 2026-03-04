


import { KolayIKEmployee, KolayIKLeaveRequest, KolayIKLeaveType, DeveloperLeaveInfo, CapacityCalculation } from '../types/kolayik';
import { supabase } from '../lib/supabase';
import { jiraFilterService } from '../lib/jiraFilterService';

// Cache for API responses
const apiCache = new Map<string, { data: any; timestamp: number; expiry: number }>();
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

class KolayIKService {
  private getFromCache<T>(key: string): T | null {
    const cached = apiCache.get(key);
    if (cached && Date.now() < cached.expiry) {
      console.log(`📦 Cache hit for: ${key}`);
      return cached.data as T;
    }
    return null; 
  }

  private setCache<T>(key: string, data: T): void {
    apiCache.set(key, {
      data,
      timestamp: Date.now(),
      expiry: Date.now() + CACHE_DURATION
    });
    console.log(`💾 Cached data for: ${key}`);
  }

  clearCache(): void {
    apiCache.clear();
    console.log('🗑️ Kolay İK cache cleared');
  }

  private getCompanyId(): string | null {
    if (typeof localStorage === 'undefined') return null;
    return localStorage.getItem('companyId');
  }

  /**
   * Proxy'yi anon key + fetch ile çağırır → Supabase 401 Invalid JWT olmaz.
   * Varsa kullanıcı JWT'sini X-User-JWT header'ında gönderir; proxy şirketi oradan alır (güvenli).
   * JWT yoksa/geçersizse proxy body'deki companyId kullanır.
   */
  private async makeRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const companyId = this.getCompanyId();
    const cacheKey = `kolayik:${companyId || 'default'}:${endpoint}`;
    const cached = this.getFromCache<T>(cacheKey);
    if (cached) return cached;

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !anonKey) {
      throw new Error('VITE_SUPABASE_URL veya VITE_SUPABASE_ANON_KEY tanımlı değil.');
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${anonKey}`,
    };
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
      headers['x-user-jwt'] = session.access_token;
    }

    const url = `${supabaseUrl}/functions/v1/kolayik-proxy`;
    console.log(`🌐 Making Kolay İK request via proxy (anon key${session?.access_token ? ' + JWT' : ''}): ${endpoint}`);

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          endpoint,
          method: options.method || 'GET',
          ...(companyId && { companyId }),
          ...(options.body && { body: JSON.parse(options.body as string) }),
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        const errMsg = (data?.error ?? res.statusText) || `HTTP ${res.status}`;
        const help = data?.help ?? '';
        throw new Error(help ? `${errMsg}\n\n${help}` : errMsg);
      }

      if (data && typeof data === 'object' && 'error' in data && typeof data.error === 'string') {
        const msg = data.help ? `${data.error}\n\n${data.help}` : data.error;
        throw new Error(msg);
      }

      if (data === null || data === undefined) {
        throw new Error(`Kolay İK API'den boş response geldi (${endpoint})`);
      }

      this.setCache(cacheKey, data);
      console.log(`✅ Kolay İK proxy request successful for: ${endpoint}`);
      return data;
    } catch (error) {
      console.error(`🚨 Kolay İK proxy request failed for ${endpoint}:`, error);
      throw error;
    }
  }

  // Tüm çalışanları getir
  async getEmployees(): Promise<KolayIKEmployee[]> {
    try {
      console.log('🚀 Starting getEmployees request...');
      const response = await this.makeRequest<{ data: any[] }>('/person/list', {
        method: 'POST'
      });
      
      console.log('📊 Raw response from Kolay İK:', response);
      console.log('📊 Response type:', typeof response);
      console.log('📊 Response keys:', typeof response === 'object' ? Object.keys(response) : 'N/A');
      
      // Response validation
      if (!response) {
        throw new Error('Kolay İK API\'den boş response geldi');
      }
      
      if (typeof response !== 'object') {
        throw new Error(`Kolay İK API\'den beklenmeyen response tipi: ${typeof response}`);
      }
      
      // Flexible response handling
      let employeeData: any[] = [];
      
      if (Array.isArray(response)) {
        // Response direkt array ise
        console.log('📊 Response is direct array, using it directly');
        employeeData = response;
      } else if ('data' in response) {
        const dataProperty = response.data;
        console.log('📊 Response has data property, keys:', typeof dataProperty === 'object' && dataProperty !== null ? Object.keys(dataProperty) : []);

        if (Array.isArray(dataProperty)) {
          employeeData = dataProperty;
        } else if (typeof dataProperty === 'object' && dataProperty !== null) {
          // Kolay İK person/list POST formatı: data: { total, perPage, currentPage, lastPage, items: [...] }
          if ('items' in dataProperty && Array.isArray((dataProperty as { items?: unknown[] }).items)) {
            employeeData = (dataProperty as { items: any[] }).items;
            console.log('📊 Using response.data.items (Kolay İK person/list format), count:', employeeData.length);
          } else if ('employees' in dataProperty && Array.isArray((dataProperty as { employees?: unknown[] }).employees)) {
            employeeData = (dataProperty as { employees: any[] }).employees;
          } else if ('persons' in dataProperty && Array.isArray((dataProperty as { persons?: unknown[] }).persons)) {
            employeeData = (dataProperty as { persons: any[] }).persons;
          } else if ('people' in dataProperty && Array.isArray((dataProperty as { people?: unknown[] }).people)) {
            employeeData = (dataProperty as { people: any[] }).people;
          } else if ('results' in dataProperty && Array.isArray((dataProperty as { results?: unknown[] }).results)) {
            employeeData = (dataProperty as { results: any[] }).results;
          } else {
            // If data is object but no known array property, try to extract values
            const values = Object.values(dataProperty);
            const arrayValue = values.find(val => Array.isArray(val));
            if (arrayValue) {
              console.log('📊 Found array in object values');
              employeeData = arrayValue as any[];
            } else {
              console.log('📊 No array found in data object, treating as single employee');
              employeeData = [dataProperty];
            }
          }
        } else {
          throw new Error(`Response.data is not array or object: ${typeof dataProperty}`);
        }
      } else {
        // Response object ama data property yok
        console.log('📊 Response is object without data property, checking for direct arrays...');
        console.log('📊 Response keys:', Object.keys(response));
        
        // Check for common array properties
        if ('employees' in response && Array.isArray(response.employees)) {
          employeeData = response.employees;
        } else if ('persons' in response && Array.isArray(response.persons)) {
          employeeData = response.persons;
        } else if ('people' in response && Array.isArray(response.people)) {
          employeeData = response.people;
        } else if ('items' in response && Array.isArray(response.items)) {
          employeeData = response.items;
        } else if ('results' in response && Array.isArray(response.results)) {
          employeeData = response.results;
        } else {
          // Try to find any array property
          const values = Object.values(response);
          const arrayValue = values.find(val => Array.isArray(val));
          if (arrayValue) {
            console.log('📊 Found array in response values');
            employeeData = arrayValue as any[];
          } else {
            console.log('📊 No array found, treating entire response as single employee');
            employeeData = [response];
          }
        }
      }
      
      console.log('📊 Final employee data:', {
        type: typeof employeeData,
        isArray: Array.isArray(employeeData),
        length: Array.isArray(employeeData) ? employeeData.length : 'N/A'
      });
      
      if (!Array.isArray(employeeData)) {
        throw new Error(`Final employee data is not array: ${typeof employeeData}`);
      }

      if (employeeData.length === 0) {
        console.warn('⚠️ Kolay İK person/list boş döndü');
        return [];
      }

      const selectedDevelopers = await jiraFilterService.getSelectedDevelopers();
      const selectedDeveloperNames = selectedDevelopers.map(d => d.developer_name);
      if (selectedDeveloperNames.length === 0) {
        console.warn('⚠️ Jira Filtre Yönetimi\'nde seçili yazılımcı yok');
        return [];
      }

      return this.mapEmployeeData(employeeData, selectedDeveloperNames);
    } catch (error) {
      console.error('❌ Error in getEmployees:', error);
      throw new Error('Çalışan listesi alınırken hata oluştu: ' + (error instanceof Error ? error.message : 'Bilinmeyen hata'));
    }
  }
  
  // Employee data mapping helper (Jira Filtre Yönetimi'ndeki yazılımcılara göre filtreler)
  private mapEmployeeData(employeeArray: any[], selectedDeveloperNames: string[]): KolayIKEmployee[] {
    console.log(`🔄 Mapping ${employeeArray.length} employees (filter by ${selectedDeveloperNames.length} Jira developers)...`);
    
    // İsim bazlı filtreleme - Jira Filtre Yönetimi'ndeki yazılımcılar
    const filteredEmployees = employeeArray.filter(emp => {
      const empName = emp.name || emp.full_name || emp.fullName || `${emp.first_name || emp.firstName || ''} ${emp.last_name || emp.lastName || ''}`.trim();
      const isAllowed = selectedDeveloperNames.length === 0 || selectedDeveloperNames.some(devName => this.isNameMatch(empName, devName));
      
      if (isAllowed) {
        console.log(`✅ INCLUDED: ${empName || 'Unknown'} (ID: ${emp.id || emp.employee_id || emp._id || emp.uuid})`);
      } else {
        console.log(`❌ EXCLUDED: ${empName || 'Unknown'} (ID: ${emp.id || emp.employee_id || emp._id || emp.uuid})`);
      }
      
      return isAllowed;
    });
    
    console.log(`🔍 Filtered from ${employeeArray.length} to ${filteredEmployees.length} employees`);
    
      return filteredEmployees.map((emp, index) => {
        console.log(`👤 Employee ${index + 1}:`, emp);
        
        const mapped = {
          id: String(emp.id || emp.employee_id || emp._id || emp.uuid || index + 1),
          email: emp.email || emp.mail || '',
          firstName: emp.first_name || emp.firstName || emp.name?.split(' ')[0] || '',
          lastName: emp.last_name || emp.lastName || emp.name?.split(' ').slice(1).join(' ') || '',
          fullName: emp.name || emp.full_name || emp.fullName || `${emp.first_name || emp.firstName || ''} ${emp.last_name || emp.lastName || ''}`.trim(),
          department: emp.department || emp.dept || '',
          position: emp.position || emp.title || '',
          isActive: emp.is_active !== false && emp.isActive !== false && emp.status !== 0,
          startDate: emp.hire_date || emp.start_date || emp.startDate
        };
        
        console.log(`✅ Mapped employee:`, mapped);
        return mapped;
      });
  }

  // İzni olan çalışanları getir (tarih aralığına göre)
  async getEmployeesWithLeave(startDate: string, endDate: string): Promise<KolayIKEmployee[]> {
    try {
      console.log(`🚀 Getting employees with leave between ${startDate} and ${endDate}...`);
      
      const developerEmailMap = await jiraFilterService.getDeveloperEmailMap();
      const selectedDevelopers = await jiraFilterService.getSelectedDevelopers();
      const selectedDeveloperNames = selectedDevelopers.map(d => d.developer_name);
      
      // Önce izin kayıtlarını çek
      const leaveRequests = await this.getLeaveRequests(startDate, endDate);
      console.log(`📊 Found ${leaveRequests.length} leave requests in date range`);
      
      if (leaveRequests.length === 0) {
        console.log('📊 No leave requests found, returning empty list');
        return [];
      }
      
      // İzin verilerinden direkt çalışan bilgilerini çıkar
      const employeesWithLeave: KolayIKEmployee[] = [];
      const processedEmployeeIds = new Set<string>();
      
      console.log(`🔄 Processing ${leaveRequests.length} leave requests...`);
      
      for (const leave of leaveRequests) {
        const personId = String(leave.employeeId || '').trim();
        const personName = leave.personName || 'Bilinmeyen';
        
        if (!personId) {
          console.log(`⚠️ Skipping leave record with no employee ID: ${personName}`);
          continue;
        }
        
        console.log(`👤 Processing leave for: ${personName} (ID: ${personId})`);
        
        // Bu çalışanı daha önce işledik mi?
        if (processedEmployeeIds.has(personId)) {
          console.log(`⏭️ Already processed: ${personName}`);
          continue;
        }
        
        // Sadece Jira Filtre Yönetimi'ndeki yazılımcıları dahil et (isim bazlı)
        const isAllowed = selectedDeveloperNames.some(devName => this.isNameMatch(personName, devName));
        if (!isAllowed) {
          console.log(`❌ EXCLUDED: ${personName} (ID: ${personId}) - not in Jira filter`);
          continue;
        }
        
        console.log(`✅ INCLUDED: ${personName} (ID: ${personId}) - in Jira filter`);
        
        // Çalışan bilgilerini oluştur
        const nameParts = personName.split(' ');
        const firstName = nameParts[0] || '';
        const lastName = nameParts.slice(1).join(' ') || '';
        const normName = this.normalizeName(personName);
        const devEmail = developerEmailMap.get(normName) || selectedDevelopers.find(d => this.isNameMatch(personName, d.developer_name))?.developer_email || `${personName.toLowerCase().replace(/\s+/g, '.')}@company.com`;
        
        const employee: KolayIKEmployee = {
          id: personId,
          email: devEmail,
          firstName: firstName,
          lastName: lastName,
          fullName: personName,
          department: 'Yazılım Geliştirme', // İzin verilerinde departman bilgisi yok
          position: 'Yazılım Geliştirici',
          isActive: true, // İzin alabiliyorsa aktif
          startDate: undefined // İzin verilerinde işe başlama tarihi yok
        };
        
        employeesWithLeave.push(employee);
        processedEmployeeIds.add(personId);
        
        console.log(`✅ Added employee: ${personName} (${employee.email})`);
      }
      
      console.log(`✅ Final result: ${employeesWithLeave.length} employees with leave`);
      console.log(`👥 Final employee list:`, employeesWithLeave.map(emp => ({
        id: emp.id,
        name: emp.fullName,
        email: emp.email
      })));
      
      return employeesWithLeave;
    } catch (error) {
      console.error('Error getting employees with leave:', error);
      throw new Error('İzinli çalışan listesi alınırken hata oluştu: ' + (error instanceof Error ? error.message : 'Bilinmeyen hata'));
    }
  }

  // İzin türlerini getir
  async getLeaveTypes(): Promise<KolayIKLeaveType[]> {
    try {
      console.log('🔄 Fetching leave types from Kolay İK...');
      const response = await this.makeRequest<{ data: any[] }>('/leave/type/list', {
        method: 'GET'
      });
      
      console.log('📊 Leave types response:', response);
      
      let leaveTypeData: any[] = [];
      
      if (Array.isArray(response)) {
        leaveTypeData = response;
      } else if (response && typeof response === 'object' && 'data' in response) {
        leaveTypeData = Array.isArray(response.data) ? response.data : [];
      }
      
      return leaveTypeData.map((type, index) => ({
        id: type.id || index + 1,
        name: type.name || type.title || 'Bilinmeyen İzin Türü',
        code: type.code || type.key || '',
        isPaid: type.is_paid !== false,
        isDeductedFromAnnual: type.is_deducted_from_annual !== false,
        color: type.color || '#3B82F6'
      }));
    } catch (error) {
      console.error('Error fetching leave types:', error);
      throw new Error('İzin türleri alınırken hata oluştu: ' + (error instanceof Error ? error.message : 'Bilinmeyen hata'));
    }
  }

  // Türkiye 2025 resmi tatilleri (fallback için statik liste)
  private static TURKEY_PUBLIC_HOLIDAYS_2025 = [
    { id: '1', name: 'Yılbaşı', date: '2026-01-01', isHalfDay: false },
    { id: '2', name: 'Ramazan Bayramı Arefe', date: '2025-03-30', isHalfDay: true },
    { id: '3', name: 'Ramazan Bayramı 1. Gün', date: '2025-03-31', isHalfDay: false },
    { id: '4', name: 'Ramazan Bayramı 2. Gün', date: '2025-04-01', isHalfDay: false },
    { id: '5', name: 'Ramazan Bayramı 3. Gün', date: '2025-04-02', isHalfDay: false },
    { id: '6', name: 'Ulusal Egemenlik ve Çocuk Bayramı', date: '2025-04-23', isHalfDay: false },
    { id: '7', name: 'Emek ve Dayanışma Günü', date: '2025-05-01', isHalfDay: false },
    { id: '8', name: 'Gençlik ve Spor Bayramı', date: '2025-05-19', isHalfDay: false },
    { id: '9', name: 'Kurban Bayramı Arefe', date: '2025-06-06', isHalfDay: true },
    { id: '10', name: 'Kurban Bayramı 1. Gün', date: '2025-06-07', isHalfDay: false },
    { id: '11', name: 'Kurban Bayramı 2. Gün', date: '2025-06-08', isHalfDay: false },
    { id: '12', name: 'Kurban Bayramı 3. Gün', date: '2025-06-09', isHalfDay: false },
    { id: '13', name: 'Kurban Bayramı 4. Gün', date: '2025-06-10', isHalfDay: false },
    { id: '14', name: 'Demokrasi ve Milli Birlik Günü', date: '2025-07-15', isHalfDay: false },
    { id: '15', name: 'Zafer Bayramı', date: '2025-08-30', isHalfDay: false },
    { id: '16', name: 'Cumhuriyet Bayramı Arefe', date: '2025-10-28', isHalfDay: true },
    { id: '17', name: 'Cumhuriyet Bayramı', date: '2025-10-29', isHalfDay: false },
  ];

  // Resmi tatilleri getir
  async getPublicHolidays(startDate: string, endDate: string): Promise<Array<{
    id: string;
    name: string;
    date: string;
    isHalfDay: boolean;
  }>> {
    try {
      console.log(`🔄 Fetching public holidays from ${startDate} to ${endDate}...`);

      const params = new URLSearchParams();
      params.append('startDate', `${startDate} 00:00:00`);
      params.append('endDate', `${endDate} 23:59:59`);

      const endpoint = `/publicholiday/list?${params.toString()}`;
      console.log(`🔍 Public holiday endpoint: ${endpoint}`);

      const response = await this.makeRequest<{ error: boolean; data: any[] }>(endpoint, {
        method: 'GET'
      });

      console.log('📊 Public holidays API response:', JSON.stringify(response, null, 2));

      let holidayData: any[] = [];

      if (response && typeof response === 'object' && 'data' in response) {
        holidayData = Array.isArray(response.data) ? response.data : [];
      } else if (Array.isArray(response)) {
        holidayData = response;
      }

      console.log(`📊 Found ${holidayData.length} public holidays from API`);

      // API'den veri geldiyse kullan
      if (holidayData.length > 0) {
        const mappedHolidays = holidayData.map((holiday, index) => ({
          id: holiday.id || String(index + 1),
          name: holiday.name || holiday.title || 'Resmi Tatil',
          date: holiday.date || holiday.startDate || '',
          isHalfDay: holiday.isHalfDay || holiday.is_half_day || false
        }));
        console.log('✅ Using public holidays from KolayIK API');
        return mappedHolidays;
      }

      // API'den veri gelmediyse statik listeyi kullan
      console.warn('⚠️ No public holidays from API, using static fallback list');
      return this.getStaticPublicHolidays(startDate, endDate);

    } catch (error) {
      console.error('❌ Error fetching public holidays from API:', error);
      console.log('⚠️ Falling back to static public holidays list');
      return this.getStaticPublicHolidays(startDate, endDate);
    }
  }

  // Statik resmi tatil listesinden tarih aralığına uygun olanları getir
  private getStaticPublicHolidays(startDate: string, endDate: string): Array<{
    id: string;
    name: string;
    date: string;
    isHalfDay: boolean;
  }> {
    const start = new Date(startDate);
    const end = new Date(endDate);

    const filtered = KolayIKService.TURKEY_PUBLIC_HOLIDAYS_2025.filter(holiday => {
      const holidayDate = new Date(holiday.date);
      return holidayDate >= start && holidayDate <= end;
    });

    console.log(`📊 Filtered ${filtered.length} public holidays from static list for date range ${startDate} to ${endDate}`);
    filtered.forEach(h => console.log(`  🎉 ${h.name}: ${h.date} ${h.isHalfDay ? '(Yarım gün)' : ''}`));

    return filtered;
  }

  // İzin kayıtlarını getir
  async getLeaveRequests(startDate: string, endDate: string, personId?: string): Promise<KolayIKLeaveRequest[]> {
    try {
      console.log(`🔄 Fetching leave requests from ${startDate} to ${endDate}${personId ? ` for person ${personId}` : ''}...`);
      console.log(`🌐 API URL will be: https://api.kolayik.com/v2/leave/list?status=approved&startDate=${startDate} 00:00:00&endDate=${endDate} 23:59:59&limit=100`);

      const params = new URLSearchParams();
      params.append('status', 'approved');
      params.append('startDate', `${startDate} 00:00:00`);
      params.append('endDate', `${endDate} 23:59:59`);
      params.append('limit', '100');
      
      const endpoint = `/leave/list?${params.toString()}`;
      console.log(`🔍 Leave request endpoint: ${endpoint}`);
      
      const response = await this.makeRequest<{ error: boolean; data: any[] }>(endpoint, {
        method: 'GET'
      });
      
      console.log('📊 Leave requests response:', response);
      console.log('📊 Leave requests response type:', typeof response);
      console.log('📊 Leave requests response keys:', typeof response === 'object' ? Object.keys(response) : 'N/A');
      console.log('📊 Leave requests response sample:', JSON.stringify(response, null, 2));
      
      // Response validation
      if (response && typeof response === 'object' && 'error' in response && response.error) {
        console.error('❌ Kolay İK API returned error response:', response);
        throw new Error('Kolay İK API returned error response');
      }
      
      let leaveData: any[] = [];
      
      if (response && typeof response === 'object' && 'data' in response) {
        console.log('📊 Using response.data, type:', typeof response.data, 'isArray:', Array.isArray(response.data));
        leaveData = Array.isArray(response.data) ? response.data : [];
      } else if (Array.isArray(response)) {
        console.log('📊 Response is direct array');
        leaveData = response;
      } else {
        console.warn('⚠️ Unexpected response format:', typeof response);
        console.warn('⚠️ Response content:', JSON.stringify(response, null, 2));
      }
      
      console.log(`📊 Final leave data: ${leaveData.length} records`);
      console.log(`📊 Leave data sample:`, leaveData.slice(0, 3));
      
      return leaveData.map((leave, index) => ({
        id: leave.id || index + 1,
        employeeId: String(leave.person?.id || leave.employee_id || leave.personId || '').trim(),
        leaveTypeId: leave.type?.id || leave.leaveTypeId || 0,
        startDate: leave.startDate,
        endDate: leave.endDate,
        totalDays: parseFloat(leave.usedDays) || 0,
        status: leave.status || 'approved',
        description: leave.comment || leave.description || '',
        createdAt: leave.createdAt || new Date().toISOString(),
        updatedAt: leave.updatedAt || new Date().toISOString(),
        leaveTypeName: leave.type?.name || 'İzin',
        personName: leave.person?.name || leave.personName || 'Bilinmeyen'
      }));
    } catch (error) {
      console.error('Error fetching leave requests:', error);
      console.error('Full leave request error:', JSON.stringify(error, null, 2));
      throw new Error('İzin kayıtları alınırken hata oluştu: ' + (error instanceof Error ? error.message : 'Bilinmeyen hata'));
    }
  }

  // İş günü hesaplama helper (resmi tatiller hariç)
  private calculateWorkingDays(startDate: string, endDate: string, publicHolidays: Array<{ date: string; isHalfDay: boolean }> = []): number {
    if (!startDate || !endDate) return 0;

    const start = new Date(startDate);
    const end = new Date(endDate);
    let workingDays = 0;

    // Resmi tatil tarihlerini set'e çevir (hızlı arama için)
    const holidayDates = new Set(publicHolidays.map(h => h.date));
    const halfDayHolidays = new Set(
      publicHolidays.filter(h => h.isHalfDay).map(h => h.date)
    );

    const currentDate = new Date(start);
    while (currentDate <= end) {
      const dayOfWeek = currentDate.getDay();
      const dateStr = currentDate.toISOString().split('T')[0];

      // Hafta sonu kontrolü
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        // Resmi tatil mi kontrol et
        if (halfDayHolidays.has(dateStr)) {
          // Yarım gün tatil
          workingDays += 0.5;
        } else if (!holidayDates.has(dateStr)) {
          // Normal iş günü
          workingDays++;
        }
        // Tam gün resmi tatil ise hiç ekleme
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return workingDays;
  }

  // Developer ID'lerini izin kayıtlarından isimle eşleştiren map (Jira Filtre'den gelen isimler için)
  private buildDeveloperIdMapFromLeaves(leaveRequests: KolayIKLeaveRequest[]): Map<string, string> {
    const idMap = new Map<string, string>();
    leaveRequests.forEach(leave => {
      const personName = leave.personName || '';
      const employeeId = leave.employeeId ? String(leave.employeeId).trim() : '';
      if (personName && employeeId) {
        const norm = this.normalizeName(personName);
        if (!idMap.has(norm)) idMap.set(norm, employeeId);
        idMap.set(personName, employeeId);
      }
    });
    return idMap;
  }

  // Yazılımcıların izin bilgilerini getir
  async getDeveloperLeaveInfo(
    developerNames: string[],
    startDate: string,
    endDate: string
  ): Promise<DeveloperLeaveInfo[]> {
    try {
      console.log(`🔄 Getting leave info for ${developerNames.length} developers between ${startDate} and ${endDate}...`);
      console.log(`👥 Developer names: ${developerNames.join(', ')}`);

      const developerEmailMap = await jiraFilterService.getDeveloperEmailMap();

      // Step 0: Resmi tatilleri çek
      console.log('🔄 Step 0: Fetching public holidays...');
      const publicHolidays = await this.getPublicHolidays(startDate, endDate);
      console.log(`📊 Found ${publicHolidays.length} public holidays:`, publicHolidays.map(h => `${h.name} (${h.date})`).join(', '));

      // SADECE izin kayıtlarını çek (tüm çalışanlar için)
      // Kolay İK'nın /leave/list endpoint'i genellikle başlangıç tarihi aralığında filtreler.
      // Haftalar arası taşan izinleri kaçırmamak için aralığı genişleterek fetch edip
      // sonrasında KESİŞİM hesaplamasını lokalde uyguluyoruz.
      console.log('🔄 Step 1: Fetching ALL leave requests (with extended window for overlap safety)...');

      const toDateYmd = (d: string) => (d ? d.substring(0, 10) : '');
      const baseStart = new Date(toDateYmd(startDate));
      const baseEnd = new Date(toDateYmd(endDate));

      // Genişletme: 30 gün geri, 30 gün ileri (haftalar arası ve ay sonu taşmaları yakalamak için)
      const extendedStartDate = new Date(baseStart);
      extendedStartDate.setDate(extendedStartDate.getDate() - 30);
      const extendedEndDate = new Date(baseEnd);
      extendedEndDate.setDate(extendedEndDate.getDate() + 30);

      const fmt = (d: Date) => d.toLocaleDateString('en-CA');

      console.log(`📅 Extended fetch window: ${fmt(extendedStartDate)} → ${fmt(extendedEndDate)} (original ${startDate} → ${endDate})`);

      const leaveRequests = await this.getLeaveRequests(fmt(extendedStartDate), fmt(extendedEndDate));

      // Developer ID map'ini izin kayıtlarından oluştur (isim -> Kolay İK ID)
      const developerIdMap = this.buildDeveloperIdMapFromLeaves(leaveRequests);

      console.log(`📊 Fetched: ${leaveRequests.length} leave requests in date range`);
      console.log(`📊 Leave requests detail:`, leaveRequests.map(l => ({
        employeeId: l.employeeId,
        personName: l.personName,
        startDate: l.startDate,
        endDate: l.endDate,
        totalDays: l.totalDays
      })));

      const developerLeaveInfo: DeveloperLeaveInfo[] = [];

      for (const developerName of developerNames) {
        console.log(`🔍 Processing developer: ${developerName}`);

        // Developer'ın ID'sini bul
        const normalizedDeveloperName = this.normalizeName(developerName);
        const developerId = developerIdMap.get(normalizedDeveloperName) || developerIdMap.get(developerName);

        console.log(`  🔑 Developer ID for "${developerName}": ${developerId || 'NOT FOUND'}`);

        // İzin kayıtlarından bu yazılımcının kayıtlarını bul (hem ID hem isim bazlı)
        const employeeLeaves = leaveRequests.filter(leave => {
          // Önce ID bazlı eşleştirme yap (daha güvenilir)
          if (developerId && leave.employeeId) {
            const leaveEmployeeId = String(leave.employeeId).trim();
            const devId = String(developerId).trim();
            const idMatch = leaveEmployeeId === devId;
            
            if (idMatch) {
              console.log(`  ✅ ID MATCH: "${leave.personName}" (ID: ${leave.employeeId}) matches "${developerName}" (ID: ${developerId})`);
              return true;
            }
          }

          // ID eşleşmezse isim bazlı eşleştirme yap (esnek eşleştirme)
          const personName = leave.personName || '';
          const isNameMatch = this.isNameMatch(personName, developerName);
          const normalizedPersonName = this.normalizeName(personName);

          if (isNameMatch) {
            console.log(`  ✅ NAME MATCH: "${leave.personName}" (normalized: "${normalizedPersonName}") matches "${developerName}" (normalized: "${normalizedDeveloperName}")`);
          } else {
            console.log(`  ❌ NO MATCH: "${leave.personName}" (ID: ${leave.employeeId}, normalized: "${normalizedPersonName}") vs "${developerName}" (ID: ${developerId}, normalized: "${normalizedDeveloperName}")`);
          }

          return isNameMatch;
        });

        console.log(`👤 ${developerName}: Found ${employeeLeaves.length} leave records`);

        // İzin detaylarını, seçili tarih aralığına göre KESİŞEN iş günleriyle hazırla
        const periodStart = toDateYmd(startDate);
        const periodEnd = toDateYmd(endDate);

        // Resmi tatilleri izin detaylarına ekle (tüm yazılımcılar için geçerli - izin kaydı olsun ya da olmasın)
        const publicHolidayDetails = publicHolidays
          .filter(holiday => {
            const holidayDate = toDateYmd(holiday.date);
            return holidayDate >= periodStart && holidayDate <= periodEnd;
          })
          .map(holiday => ({
            startDate: toDateYmd(holiday.date),
            endDate: toDateYmd(holiday.date),
            days: holiday.isHalfDay ? 0.5 : 1,
            leaveType: `Resmi Tatil - ${holiday.name}`,
            description: holiday.name
          }));

        console.log(`🎉 ${developerName}: ${publicHolidayDetails.length} resmi tatil günü eklendi`);

        // Eğer izin kaydı yoksa, sadece resmi tatilleri ekle
        if (employeeLeaves.length === 0) {
          console.log(`✓ ${developerName}: No leave found, but ${publicHolidayDetails.length} public holidays added`);
          const totalPublicHolidayDays = publicHolidayDetails.reduce((sum, h) => sum + h.days, 0);
          const devEmail = developerEmailMap.get(this.normalizeName(developerName)) || `${developerName.toLowerCase().replace(/\s+/g, '.')}@company.com`;
          developerLeaveInfo.push({
            developerName,
            email: devEmail,
            leaveDays: totalPublicHolidayDays,
            leaveDetails: publicHolidayDetails
          });
          continue;
        }

        const leaveDetails = [
          ...publicHolidayDetails,
          ...employeeLeaves.flatMap(leave => {
          const leaveStart = toDateYmd(leave.startDate);
          const leaveEnd = toDateYmd(leave.endDate);

          // Kesişim aralığını hesapla
          const overlapStart = leaveStart > periodStart ? leaveStart : periodStart;
          const overlapEnd = leaveEnd < periodEnd ? leaveEnd : periodEnd;

          // Geçerli bir kesişim yoksa dahil etme
          if (!overlapStart || !overlapEnd || new Date(overlapStart) > new Date(overlapEnd)) {
            return [] as {
              startDate: string;
              endDate: string;
              days: number;
              leaveType: string;
              description?: string;
            }[];
          }

          const workingDays = this.calculateWorkingDays(overlapStart, overlapEnd, publicHolidays);
          if (workingDays <= 0) {
            return [] as any[];
          }

          // Yarım gün izinleri koru: tek gün izinlerde orijinal usedDays'ı kullan
          const isSingleDayLeave = leaveStart === leaveEnd;
          let daysForPeriod: number;
          if (isSingleDayLeave && overlapStart === overlapEnd) {
            // Aynı güne denk geliyorsa 0.5 gibi değerleri aynen kullan
            daysForPeriod = Math.min(leave.totalDays || 0, 1);
          } else {
            // Çok günlük izinlerde, kesişen iş günlerini orijinal toplamla sınırla
            const originalDays = typeof leave.totalDays === 'number' ? leave.totalDays : parseFloat(String(leave.totalDays)) || 0;
            daysForPeriod = Math.min(workingDays, originalDays);
          }

          console.log(`📅 Overlap for ${developerName}: ${overlapStart} → ${overlapEnd} = ${workingDays} gün, applied=${daysForPeriod}`);

          if (daysForPeriod <= 0) return [] as any[];

          return [{
            startDate: overlapStart,
            endDate: overlapEnd,
            days: daysForPeriod,
            leaveType: leave.leaveTypeName || 'İzin',
            description: leave.description
          }];
        })
        ];

        // Toplam izin günlerini, sadece kesişen günlerin toplamı olarak hesapla
        const totalLeaveDays = leaveDetails.reduce((sum, ld) => sum + ld.days, 0);

        console.log(`📊 ${developerName} final leave calculation:`, {
          totalLeaveDays,
          leaveDetailsCount: leaveDetails.length,
          employeeId: employeeLeaves[0]?.employeeId
        });

        const devEmail = developerEmailMap.get(this.normalizeName(developerName)) || `${developerName.toLowerCase().replace(/\s+/g, '.')}@company.com`;
        developerLeaveInfo.push({
          developerName,
          email: devEmail,
          employeeId: employeeLeaves[0]?.employeeId,
          leaveDays: totalLeaveDays,
          leaveDetails
        });

        console.log(`✅ ${developerName}: ${totalLeaveDays} leave days found`);
      }
      
      console.log('📊 Final developer leave info summary:', developerLeaveInfo.map(info => ({
        name: info.developerName,
        leaveDays: info.leaveDays,
        hasLeave: info.leaveDays > 0
      })));
      
      return developerLeaveInfo;
    } catch (error) {
      console.error('Error getting developer leave info:', error);
      console.error('Full error details:', JSON.stringify(error, null, 2));
      throw error;
    }
  }

  // Ayarlanmış kapasiteleri hesapla
  calculateAdjustedCapacities(
    developerNames: string[],
    sprintStartDate: string,
    sprintEndDate: string,
    leaveInfo: DeveloperLeaveInfo[]
  ): CapacityCalculation[] {
    const calculations: CapacityCalculation[] = [];

    // Resmi tatilleri bul - herhangi bir developer'ın leaveDetails'inden al
    // (çünkü resmi tatiller tüm yazılımcılar için aynı)
    let allPublicHolidays: Array<{ date: string; isHalfDay: boolean }> = [];
    
    // Önce leaveInfo'dan resmi tatilleri bul
    for (const info of leaveInfo) {
      if (info.leaveDetails && info.leaveDetails.length > 0) {
        const publicHolidays = info.leaveDetails
          .filter(detail => detail.leaveType.includes('Resmi Tatil'))
          .map(detail => ({
            date: detail.startDate,
            isHalfDay: detail.days === 0.5
          }));
        
        if (publicHolidays.length > 0) {
          allPublicHolidays = publicHolidays;
          break; // İlk bulduğumuz resmi tatilleri kullan
        }
      }
    }

    // Eğer leaveInfo'dan resmi tatil bulunamadıysa, API'den çek
    if (allPublicHolidays.length === 0) {
      console.log('⚠️ No public holidays found in leaveInfo, fetching from API...');
      // Bu durumda getPublicHolidays çağrılmalı ama async olduğu için şimdilik boş bırakıyoruz
      // Çünkü bu fonksiyon sync ve resmi tatiller zaten getDeveloperLeaveInfo'da ekleniyor
    }

    // Sprint'teki toplam iş günlerini hesapla (resmi tatiller hariç)
    const sprintWorkingDays = this.calculateWorkingDays(sprintStartDate, sprintEndDate, allPublicHolidays);

    // Şirket konfigürasyonundan sprint kapasitesini türet
    let originalCapacity = 70;
    try {
      const metric = typeof localStorage !== 'undefined' ? localStorage.getItem('capacityMetric') : null;
      if (metric === 'hours') {
        const stored = typeof localStorage !== 'undefined' ? localStorage.getItem('dailyHours') : null;
        const dailyParsed = stored ? parseFloat(stored) : NaN;
        const dailyHours = Number.isFinite(dailyParsed) && dailyParsed > 0 ? dailyParsed : 7;
        // Gerçek sprint iş günü sayısına göre kapasite
        originalCapacity = Math.max(0, Math.round(dailyHours * sprintWorkingDays));
      }
    } catch (e) {
      console.warn('Kapasite konfigürasyonu okunamadı, 70h varsayılan kullanılacak:', e);
    }

    console.log(`📅 Sprint working days calculation:`, {
      sprintStartDate,
      sprintEndDate,
      publicHolidaysCount: allPublicHolidays.length,
      publicHolidays: allPublicHolidays.map(h => `${h.date} (${h.isHalfDay ? 'yarım' : 'tam'})`).join(', '),
      sprintWorkingDays
    });

    for (const developerName of developerNames) {
      const developerLeave = leaveInfo.find(info => info.developerName === developerName);
      const leaveDays = developerLeave?.leaveDays || 0;

      // Resmi tatil günlerini hesapla (leaveDetails içinde "Resmi Tatil" içerenler)
      const publicHolidayDays = developerLeave?.leaveDetails
        ?.filter(detail => detail.leaveType.includes('Resmi Tatil'))
        .reduce((sum, detail) => sum + detail.days, 0) || 0;

      // Normal izin günleri (resmi tatil hariç)
      const regularLeaveDays = leaveDays - publicHolidayDays;

      console.log(`📊 ${developerName} capacity calculation:`, {
        totalLeaveDays: leaveDays,
        publicHolidayDays,
        regularLeaveDays,
        sprintWorkingDays
      });

      // İzin günlerini kapasiteden düş (1 gün = 7 saat, 0.5 gün = 4 saat)
      const hoursToDeduct = leaveDays >= 1 ? Math.floor(leaveDays) * 7 + (leaveDays % 1) * 8 : leaveDays * 8;
      const adjustedCapacity = Math.max(0, originalCapacity - hoursToDeduct);
      const capacityReduction = originalCapacity - adjustedCapacity;
      const availableWorkingDays = Math.max(0, sprintWorkingDays - regularLeaveDays);

      calculations.push({
        developerName,
        originalCapacity,
        sprintWorkingDays,
        leaveDays: regularLeaveDays,
        publicHolidays: publicHolidayDays,
        availableWorkingDays,
        adjustedCapacity,
        capacityReduction
      });
    }

    return calculations;
  }

  private normalizeName(name: string): string {
    if (!name) return '';
    return name
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
  }

  // İki ismin eşleşip eşleşmediğini kontrol et (daha esnek)
  private isNameMatch(name1: string, name2: string): boolean {
    if (!name1 || !name2) return false;
    
    const normalized1 = this.normalizeName(name1);
    const normalized2 = this.normalizeName(name2);
    
    // Tam eşleşme
    if (normalized1 === normalized2) return true;
    
    // Kelime bazlı eşleşme (her iki isimde de aynı kelimeler varsa)
    const words1 = normalized1.split(/\s+/).filter(w => w.length > 0);
    const words2 = normalized2.split(/\s+/).filter(w => w.length > 0);
    
    if (words1.length === 0 || words2.length === 0) return false;
    
    // Tüm kelimeler eşleşiyorsa (sıra önemli değil)
    if (words1.length === words2.length) {
      const allWordsMatch = words1.every(w1 => words2.includes(w1)) && 
                           words2.every(w2 => words1.includes(w2));
      if (allWordsMatch) return true;
    }
    
    // İlk ve son kelime eşleşiyorsa (orta isimler farklı olabilir)
    if (words1.length >= 2 && words2.length >= 2) {
      const firstMatch = words1[0] === words2[0];
      const lastMatch = words1[words1.length - 1] === words2[words2.length - 1];
      if (firstMatch && lastMatch) return true;
    }

    // Bir isim diğerini içeriyorsa (Kolay "Ad Soyad" vs Jira "Ad Soyad" / farklı yazım)
    const shorter = normalized1.length <= normalized2.length ? normalized1 : normalized2;
    const longer = normalized1.length > normalized2.length ? normalized1 : normalized2;
    if (longer.includes(shorter) && shorter.length >= 4 && (words1.length >= 2 || words2.length >= 2)) {
      return true;
    }

    return false;
  }

  // API bağlantısını test et
  async testConnection(): Promise<{ success: boolean; message: string; employeeCount?: number }> {
    try {
      console.log('🔍 Testing Kolay İK API connection...');
      
      const employees = await this.getEmployees();
      
      console.log('✅ Connection test successful:', employees.length, 'employees found');
      
      return {
        success: true,
        message: `Kolay İK API bağlantısı başarılı`,
        employeeCount: employees.length
      };
    } catch (error) {
      console.error('Kolay İK connection test failed:', error);
      
      let message = 'Kolay İK API bağlantısı başarısız.';
      if (error instanceof Error) {
        if (error.message.includes('401') || error.message.includes('Authentication')) {
          message = 'API anahtarı geçersiz. Lütfen Kolay İK API anahtarınızı kontrol edin.';
        } else if (error.message.includes('403') || error.message.includes('Forbidden')) {
          message = 'API erişim izni yok. Kolay İK hesabınızda API yetkilerini kontrol edin.';
        } else if (error.message.includes('404') || error.message.includes('Not Found')) {
          message = 'API endpoint bulunamadı. Kolay İK API URL\'sini kontrol edin.';
        } else if (error.message.includes('400') || error.message.includes('Bad Request')) {
          message = 'API isteği geçersiz. Request formatını kontrol edin.';
        } else if (error.message.includes('Missing required environment variable')) {
          message = 'KOLAYIK_API_TOKEN environment variable eksik. Supabase Dashboard\'da Edge Functions ayarlarından ekleyin.';
        } else { 
          message = error.message;
        } 
      }
      
      return {
        success: false,
        message
      };
    } 
  }
}

export const kolayikService = new KolayIKService();