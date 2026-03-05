export interface DeveloperWorkload {
  developer: string;
  email: string;
  totalTasks: number;
  totalHours: number;
  totalActualHours: number;
  dynamicCapacity?: number;
  capacityDetails?: {
    totalWorkingDays: number;
    leaveDays: number;
    availableWorkingDays: number;
  };
  status: 'Eksik Yük' | 'Yeterli' | 'Aşırı Yük';
  details: ProjectSprintDetail[];
}

export interface ProjectSprintDetail {
  project: string;
  sprint: string;
  taskCount: number;
  hours: number;
  actualHours: number;
  tasks?: JiraTask[];
}

export interface JiraTask {
  id: string;
  key: string;
  summary: string;
  description?: string;
  status: string;
  assignee: string;
  project: string;
  projectKey: string;
  sprint: string;
  estimatedHours: number;
  actualHours: number;
  priority: string;
  created: string;
  updated: string;
  parentKey?: string | null;
  isSubtask?: boolean;
  issueType?: string;
  worklogs?: Array<{
    author: { accountId: string; displayName: string; emailAddress?: string };
    timeSpentSeconds: number;
    started?: string;
    comment?: any;
    isSubtask?: boolean;
    parentKey?: string;
    taskKey?: string;
    taskSummary?: string;
    project?: string;
    sprint?: string;
  }>;
}

export interface JiraProject {
  id: string;
  key: string;
  name: string;
  projectTypeKey: string;
  lead?: {
    accountId: string;
    displayName: string;
    emailAddress?: string;
  };
}

export interface JiraSprint {
  id: string;
  name: string;
  state: string;
  boardId?: string;
  projectKey?: string;
  startDate?: string;
  endDate?: string;
  completeDate?: string;
}

export interface JiraBoard {
  id: string;
  name: string;
  type: string;
  projectKey?: string;
  location?: {
    projectId: string;
    projectKey: string;
    projectName: string;
  };
}

export interface ManualTaskAssignment {
  id: string;
  title: string;
  description: string;
  assignee: string;
  project: string;
  sprint: string;
  estimatedHours: number;
  priority: 'Low' | 'Medium' | 'High' | 'Critical';
  dueDate?: string;
  createdBy: string;
  createdAt: string;
}

export interface WorkloadAnalytics {
  totalDevelopers: number;
  averageWorkload: number;
  averageActualWorkload: number;
  underloadedCount: number;
  adequateCount: number;
  overloadedCount: number;
  totalTasks: number;
  totalHours: number;
  totalActualHours: number;
  projectDistribution: { [project: string]: number };
  projectActualDistribution: { [project: string]: number };
  sprintDistribution: { [sprint: string]: number };
}