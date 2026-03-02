export interface WorklogEntry {
  id: string;
  issueKey: string;
  issueSummary: string;
  author: {
    accountId: string;
    displayName: string;
    emailAddress?: string;
  };
  timeSpentSeconds: number;
  timeSpentHours: number;
  started: string;
  comment?: string;
  project: string;
  issueType: string;
}

export interface DailyWorklogSummary {
  date: string;
  totalHours: number;
  status: 'sufficient' | 'insufficient' | 'excessive' | 'missing';
  statusText: string;
  statusColor: string;
  entries: WorklogEntry[];
}

export interface DeveloperWorklogData {
  developerName: string;
  email: string;
  dailySummaries: DailyWorklogSummary[];
  weeklyTotal: number;
  weeklyTarget: number;
  weeklyStatus: 'sufficient' | 'insufficient' | 'excessive';
}

export interface WorklogAnalytics {
  totalDevelopers: number;
  totalWorklogEntries: number;
  totalHours: number;
  averageDailyHours: number;
  developersWithSufficientHours: number;
  developersWithInsufficientHours: number;
  developersWithExcessiveHours: number;
  dateRange: {
    start: string;
    end: string;
  };
}