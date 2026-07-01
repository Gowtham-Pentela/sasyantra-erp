export type Role = 'ADMIN' | 'OPS' | 'ACCOUNTS';

export interface Employee {
  id: number; empCode: string; name: string; fatherName?: string | null; mobile?: string | null;
  altMobile?: string | null; address?: string | null; dob?: string | null; gender?: string | null;
  bloodGroup?: string | null; emergencyContact?: string | null; aadhar?: string | null; pan?: string | null;
  bankAccount?: string | null; ifsc?: string | null; upi?: string | null; joiningDate: string;
  skillCategory?: string | null; designation?: string | null;
  salaryType: 'DAILY' | 'MONTHLY'; dailyWage: number; monthlySalary: number;
  pf: boolean; esi: boolean; uan?: string | null; photoUrl?: string | null;
  status: 'ACTIVE' | 'LEFT' | 'TEMPORARY' | 'SUSPENDED' | 'BLACKLISTED';
  createdAt: string; updatedAt: string; archivedAt?: string | null;
}

export interface Project {
  id: number; code: string; name: string; clientName: string; clientGst?: string | null;
  siteLocation?: string | null; mapsUrl?: string | null; startDate: string; endDate?: string | null;
  billingCycle?: string | null; paymentTerms?: string | null; contractValue: number;
  gstPercent: number; status: 'ACTIVE' | 'ON_HOLD' | 'COMPLETED' | 'CANCELLED';
  projectManager?: string | null; createdAt: string;
  allocations?: Allocation[];
}

export interface Allocation {
  id: number; employeeId: number; projectId: number; role?: string | null;
  dailyWage: number; effectiveDate: string; endDate?: string | null; remarks?: string | null;
  employee?: { id: number; empCode: string; name: string; designation?: string | null; status: string };
  project?: { id: number; name: string; clientName: string };
}

export type AttendanceCode = 'P' | 'A' | 'OT' | 'HD' | 'LV' | 'WO' | 'HL' | 'NS' | 'DS' | 'TR';

export interface PayrollRow {
  id: number; employeeId: number; projectId?: number | null; month: number;
  workingDays: number; presentDays: number; otHours: number; gross: number;
  attendanceDeduction: number; basic: number; otAmount: number; bonus: number;
  advanceRecovery: number; travel: number; food: number; pf: number; esi: number;
  professionalTax: number; net: number; employerCost: number;
  paid: boolean; paidDate?: string | null;
  salaryPayment?: { id: number; amount: number; paidDate: string; utr?: string | null; mode: string } | null;
  employee: { id: number; empCode: string; name: string; designation?: string | null };
}

export interface AuditLog {
  id: number; userId?: number | null; userName?: string | null; module: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'ARCHIVE' | 'RESTORE'; entity: string;
  entityId?: string | null; oldValue?: any; newValue?: any; reason?: string | null;
  ip?: string | null; userAgent?: string | null; createdAt: string;
}