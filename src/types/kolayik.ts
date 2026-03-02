



export interface KolayIKEmployee {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  department?: string;
  position?: string;
  isActive: boolean;
  startDate?: string;
}

export interface KolayIKLeaveRequest {
  id: number;
  employeeId: string;
  leaveTypeId: number;
  startDate: string;
  endDate: string;
  totalDays: number;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  description?: string;
  createdAt: string;
  updatedAt: string;
  leaveTypeName?: string;
  personName?: string;
}

export interface KolayIKLeaveType {
  id: number;
  name: string;
  code: string;
  isPaid: boolean;
  isDeductedFromAnnual: boolean;
  color?: string;
}

export interface DeveloperLeaveInfo {
  developerName: string;
  email: string;
  employeeId?: string;
  leaveDays: number;
  leaveDetails: Array<{
    startDate: string;
    endDate: string;
    days: number;
    leaveType: string;
    description?: string;
  }>;
}
 
export interface CapacityCalculation {
  developerName: string;
  originalCapacity: number;
  sprintWorkingDays: number;
  leaveDays: number;
  publicHolidays: number;
  availableWorkingDays: number;
  adjustedCapacity: number;
  capacityReduction: number;
}