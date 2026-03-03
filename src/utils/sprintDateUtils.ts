/**
 * Sprint tarih işlemleri için utility fonksiyonları
 * DeveloperWorkloadDashboard component'inden taşınmıştır
 */

import { JiraSprint } from '../types';

/**
 * Tarihi yerel timezone'da formatla (timezone kaymasını önlemek için)
 * Format: YYYY-MM-DD
 */
export const formatLocalDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Sprint tarih string'ini Date objesine çevir
 * Timezone sorununu önlemek için tarih string'ine yerel timezone'da saat ekler
 */
const parseSprintDate = (dateStr: string | null | undefined): Date | null => {
  if (!dateStr) return null;
  const dateStrWithTime = dateStr.includes('T') ? dateStr : `${dateStr}T00:00:00`;
  return new Date(dateStrWithTime);
};

/**
 * Sprint listesinden en erken başlangıç ve en geç bitiş tarihlerini hesapla
 * @param sprints Sprint listesi
 * @returns En erken başlangıç ve en geç bitiş tarihleri
 */
export const calculateSprintDateRange = (
  sprints: JiraSprint[]
): { earliestStart: Date | null; latestEnd: Date | null } => {
  let earliestStart: Date | null = null;
  let latestEnd: Date | null = null;

  for (const sprint of sprints) {
    if (sprint.startDate) {
      const startDate = parseSprintDate(sprint.startDate);
      if (startDate && (!earliestStart || startDate < earliestStart)) {
        earliestStart = startDate;
      }
    }

    if (sprint.endDate) {
      const endDate = parseSprintDate(sprint.endDate);
      if (endDate && (!latestEnd || endDate > latestEnd)) {
        latestEnd = endDate;
      }
    }
  }

  return { earliestStart, latestEnd };
};

/**
 * Varsayılan tarih aralığını döndür (son 30 gün)
 */
const getDefaultDateRange = (): { start: Date; end: Date } => {
  const today = new Date();
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(today.getDate() - 30);
  return { start: thirtyDaysAgo, end: today };
};

/**
 * Yazılımcının sprint tarih aralığını getir
 * @param developerName Yazılımcı adı
 * @param sprints Tüm sprint listesi
 * @param projectKeyMap Yazılımcı adı -> proje anahtarı mapping
 * @returns Sprint tarih aralığı ve sprint isimleri
 */
export const getDeveloperSprintDateRange = (
  developerName: string,
  sprints: JiraSprint[] | null | undefined,
  projectKeyMap: Record<string, string>
): { start: string; end: string; sprintNames: string[] } => {
  const projectKey = projectKeyMap[developerName] || 'UNKNOWN';
  const developerSprints = sprints?.filter(sprint => sprint.projectKey === projectKey) || [];

  if (developerSprints.length === 0) {
    const { start, end } = getDefaultDateRange();
    return {
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0],
      sprintNames: ['Tarih bulunamadı']
    };
  }

  const sprintNames: string[] = developerSprints.map(sprint => sprint.name);
  const { earliestStart, latestEnd } = calculateSprintDateRange(developerSprints);

  if (!earliestStart || !latestEnd) {
    const { start, end } = getDefaultDateRange();
    return {
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0],
      sprintNames
    };
  }

  // Sprint bitiş tarihini o günün sonuna ayarla
  latestEnd.setHours(23, 59, 59, 999);

  return {
    start: formatLocalDate(earliestStart),
    end: formatLocalDate(latestEnd),
    sprintNames
  };
};

/**
 * Genel sprint tarih aralığını hesapla (tüm sprintlerden)
 * @param sprints Sprint listesi
 * @returns En erken başlangıç ve en geç bitiş tarihleri (formatlanmış string olarak)
 */
export const getOverallSprintDateRange = (
  sprints: JiraSprint[] | null | undefined
): { start: string; end: string } | null => {
  if (!sprints || sprints.length === 0) return null;

  const { earliestStart, latestEnd } = calculateSprintDateRange(sprints);

  if (!earliestStart || !latestEnd) return null;

  return {
    start: formatLocalDate(earliestStart),
    end: formatLocalDate(latestEnd)
  };
};

/**
 * Yazılımcı adını normalize et (Türkçe karakterleri İngilizce karşılıklarına çevir)
 * Worklog filtreleme için kullanılır
 */
export const normalizeDeveloperName = (name: string): string => {
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
};

