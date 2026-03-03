/**
 * Türkiye resmi tatil günleri
 * Dini bayramlar her yıl değiştiği için manuel güncelleme gerektirir
 */

export interface Holiday {
  date: string; // YYYY-MM-DD formatında
  name: string;
}

/**
 * 2024-2026 arası Türkiye resmi tatil günleri
 * Kaynak: T.C. Resmi Gazete
 */
export const turkishHolidays: Holiday[] = [
  // 2024
  { date: '2024-01-01', name: 'Yılbaşı' },
  { date: '2024-04-23', name: '23 Nisan Ulusal Egemenlik ve Çocuk Bayramı' },
  { date: '2024-05-01', name: 'İşçi Bayramı' },
  { date: '2024-05-19', name: 'Atatürk\'ü Anma, Gençlik ve Spor Bayramı' },
  { date: '2024-07-15', name: '15 Temmuz Demokrasi ve Milli Birlik Günü' },
  { date: '2024-08-30', name: 'Zafer Bayramı' },
  { date: '2024-10-29', name: 'Cumhuriyet Bayramı' },

  // Ramazan Bayramı 2024 (10-11-12 Nisan)
  { date: '2024-04-10', name: 'Ramazan Bayramı 1. Gün' },
  { date: '2024-04-11', name: 'Ramazan Bayramı 2. Gün' },
  { date: '2024-04-12', name: 'Ramazan Bayramı 3. Gün' },

  // Kurban Bayramı 2024 (16-17-18-19 Haziran)
  { date: '2024-06-16', name: 'Kurban Bayramı 1. Gün' },
  { date: '2024-06-17', name: 'Kurban Bayramı 2. Gün' },
  { date: '2024-06-18', name: 'Kurban Bayramı 3. Gün' },
  { date: '2024-06-19', name: 'Kurban Bayramı 4. Gün' },

  // 2025
  { date: '2025-01-01', name: 'Yılbaşı' },
  { date: '2025-04-23', name: '23 Nisan Ulusal Egemenlik ve Çocuk Bayramı' },
  { date: '2025-05-01', name: 'İşçi Bayramı' },
  { date: '2025-05-19', name: 'Atatürk\'ü Anma, Gençlik ve Spor Bayramı' },
  { date: '2025-07-15', name: '15 Temmuz Demokrasi ve Milli Birlik Günü' },
  { date: '2025-08-30', name: 'Zafer Bayramı' },
  { date: '2025-10-29', name: 'Cumhuriyet Bayramı' },

  // Ramazan Bayramı 2025 (30-31 Mart, 1 Nisan)
  { date: '2025-03-30', name: 'Ramazan Bayramı 1. Gün' },
  { date: '2025-03-31', name: 'Ramazan Bayramı 2. Gün' },
  { date: '2025-04-01', name: 'Ramazan Bayramı 3. Gün' },

  // Kurban Bayramı 2025 (6-7-8-9 Haziran)
  { date: '2025-06-06', name: 'Kurban Bayramı 1. Gün' },
  { date: '2025-06-07', name: 'Kurban Bayramı 2. Gün' },
  { date: '2025-06-08', name: 'Kurban Bayramı 3. Gün' },
  { date: '2025-06-09', name: 'Kurban Bayramı 4. Gün' },

  // 2026
  { date: '2026-01-01', name: 'Yılbaşı' },
  { date: '2026-04-23', name: '23 Nisan Ulusal Egemenlik ve Çocuk Bayramı' },
  { date: '2026-05-01', name: 'İşçi Bayramı' },
  { date: '2026-05-19', name: 'Atatürk\'ü Anma, Gençlik ve Spor Bayramı' },
  { date: '2026-07-15', name: '15 Temmuz Demokrasi ve Milli Birlik Günü' },
  { date: '2026-08-30', name: 'Zafer Bayramı' },
  { date: '2026-10-29', name: 'Cumhuriyet Bayramı' },

  // Ramazan Bayramı 2026 (20-21-22 Mart)
  { date: '2026-03-20', name: 'Ramazan Bayramı 1. Gün' },
  { date: '2026-03-21', name: 'Ramazan Bayramı 2. Gün' },
  { date: '2026-03-22', name: 'Ramazan Bayramı 3. Gün' },

  // Kurban Bayramı 2026 (27-28-29-30 Mayıs)
  { date: '2026-05-27', name: 'Kurban Bayramı 1. Gün' },
  { date: '2026-05-28', name: 'Kurban Bayramı 2. Gün' },
  { date: '2026-05-29', name: 'Kurban Bayramı 3. Gün' },
  { date: '2026-05-30', name: 'Kurban Bayramı 4. Gün' },
];

/**
 * Verilen tarihin Türkiye'de resmi tatil olup olmadığını kontrol eder
 * @param date Kontrol edilecek tarih
 * @returns Tatil günü ise true, değilse false
 */
export const isTurkishHoliday = (date: Date): boolean => {
  const dateStr = formatDateForHoliday(date);
  return turkishHolidays.some(holiday => holiday.date === dateStr);
};

/**
 * Tarihi YYYY-MM-DD formatına çevirir
 */
const formatDateForHoliday = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Verilen tarih aralığındaki tatil günlerini döndürür
 * @param startDate Başlangıç tarihi
 * @param endDate Bitiş tarihi
 * @returns Tatil günleri listesi
 */
export const getHolidaysInRange = (startDate: Date, endDate: Date): Holiday[] => {
  const holidays: Holiday[] = [];
  const current = new Date(startDate);

  while (current <= endDate) {
    const dateStr = formatDateForHoliday(current);
    const holiday = turkishHolidays.find(h => h.date === dateStr);
    if (holiday) {
      holidays.push(holiday);
    }
    current.setDate(current.getDate() + 1);
  }

  return holidays;
};
