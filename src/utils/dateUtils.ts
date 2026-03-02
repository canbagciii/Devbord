// Date utility functions for worklog tracking

export interface WeekRange {
  start: string;
  end: string;
  dates: string[];
  weekLabel: string;
}

export interface MonthRange {
  start: string;
  end: string;
  dates: string[];
  monthLabel: string;
}

export const getWeekRange = (date: Date): WeekRange => {
  const startOfWeek = new Date(date);
  const day = startOfWeek.getDay();
  const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1); // Monday start
  startOfWeek.setDate(diff);
  startOfWeek.setHours(0, 0, 0, 0);

  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 4); // Friday end
  endOfWeek.setHours(23, 59, 59, 999);

  const dates: string[] = [];
  for (let i = 0; i < 5; i++) { // Only weekdays (Mon-Fri)
    const date = new Date(startOfWeek);
    date.setDate(startOfWeek.getDate() + i);
    dates.push(date.toLocaleDateString('en-CA')); // YYYY-MM-DD format
  }

  const weekLabel = `${startOfWeek.toLocaleDateString('tr-TR')} - ${endOfWeek.toLocaleDateString('tr-TR')}`;

  return {
    start: startOfWeek.toLocaleDateString('en-CA'),
    end: endOfWeek.toLocaleDateString('en-CA'),
    dates,
    weekLabel
  };
};

export const getMonthRange = (date: Date): MonthRange => {
  const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
  const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  
  const dates: string[] = [];
  const currentDate = new Date(startOfMonth);
  
  // Ayın tüm günlerini ekle (hafta sonu dahil)
  while (currentDate <= endOfMonth) {
    dates.push(currentDate.toLocaleDateString('en-CA')); // YYYY-MM-DD format
    currentDate.setDate(currentDate.getDate() + 1);
  }

  const monthLabel = `${startOfMonth.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' })}`;

  return {
    start: startOfMonth.toLocaleDateString('en-CA'),
    end: endOfMonth.toLocaleDateString('en-CA'),
    dates,
    monthLabel
  };
};

export const formatDateForJira = (date: Date): string => {
  return date.toLocaleDateString('en-CA'); // YYYY-MM-DD format
};

export const parseWorklogDate = (worklogStarted: string): string => {
  return new Date(worklogStarted).toISOString().split('T')[0];
};