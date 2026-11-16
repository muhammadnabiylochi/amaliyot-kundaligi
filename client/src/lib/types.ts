/**
 * Shared front-end types and label helpers.
 * (Replaces the former `data/mock.ts` — all data now comes from the API.)
 */

export type UserRole = 'admin' | 'student' | 'supervisor';
export type ApiRole = 'ADMIN' | 'STUDENT' | 'COMPANY_SUPERVISOR' | 'UNIVERSITY_SUPERVISOR';
export type EntryStatus = 'draft' | 'submitted' | 'approved' | 'rejected' | 'returned';
export type InternshipStatus = 'planned' | 'active' | 'completed' | 'cancelled';
export type UserStatus = 'active' | 'inactive';

export interface AppUser {
  id: string;
  name: string;
  fullName?: string;
  email: string;
  role: UserRole;
  rawRole?: ApiRole;
  department: string;
  position?: string | null;
  groupId?: string | null;
  group?: string;
  studentNumber?: string | null;
  phone?: string | null;
  status: UserStatus;
  mustChangePassword?: boolean;
  createdAt: string;
}

export interface Internship {
  id: string;
  studentId: string;
  studentName: string;
  studentEmail?: string;
  groupId?: string | null;
  groupName?: string | null;
  companyId?: string;
  company: string;
  position: string;
  address: string;
  companyPhone?: string | null;
  startDate: string;
  endDate: string;
  companySupervisorId?: string | null;
  companySupervisorName?: string | null;
  companySupervisorEmail?: string | null;
  companySupervisorPhone?: string | null;
  universitySupervisorId?: string | null;
  universitySupervisorName?: string | null;
  universitySupervisorEmail?: string | null;
  universitySupervisorPhone?: string | null;
  supervisorId: string;
  supervisorName: string;
  status: InternshipStatus;
  totalDays: number;
  submittedEntries: number;
  approvedEntries: number;
  pendingEntries: number;
  totalEntries?: number;
  approvedHours?: number;
  plannedHours?: number;
  planItemCount?: number;
  description: string;
  programDescription?: string | null;
  department: string;
}

export interface PlanItem {
  id: string;
  orderIndex: number;
  title: string;
  description?: string | null;
  plannedHours: number;
  doneHours?: number;
  entryCount?: number;
  progress?: number;
}

export interface InternshipDetail extends Internship {
  canEditPlan: boolean;
  plan: PlanItem[];
  planProgress: number | null;
  attendance: { PRESENT: number; LATE: number; EXCUSED: number; ABSENT: number; total: number; rate: number | null };
  entries: { id: string; date: string; title: string; hours: number; status: EntryStatus; planItemId: string | null }[];
}

export interface DiaryEntry {
  id: string;
  date: string;
  studentId: string;
  studentName: string;
  internshipId: string;
  company: string;
  title: string;
  content: string;
  result?: string | null;
  tasks: string[];
  hours: number;
  status: EntryStatus;
  supervisorComment?: string;
  reviewedAt?: string;
  reviewedBy?: string;
  planItemId?: string | null;
  planItemTitle?: string | null;
  createdAt: string;
}

export interface Company {
  id: string;
  name: string;
  address: string;
  contactPhone?: string | null;
  description?: string | null;
  internshipCount: number;
}

export interface StudentGroup {
  id: string;
  name: string;
  faculty: string;
  studyProgram: string;
  studentCount: number;
}

export interface AnalyticsAgg {
  id: string;
  name: string;
  students: number;
  approvedEntries: number;
  totalEntries: number;
  approvedHours: number;
  attendanceRate: number | null;
  averageScore: number | null;
}

export interface Analytics {
  totals: {
    internships: number;
    activeInternships: number;
    companies: number;
    approvedHours: number;
    approvalRate: number | null;
    attendanceRate: number | null;
    completedEvaluations: number;
    averageScore: number | null;
  };
  diaryStatus: Record<'DRAFT' | 'SUBMITTED' | 'RETURNED' | 'APPROVED', number>;
  attendance: Record<'PRESENT' | 'LATE' | 'EXCUSED' | 'ABSENT', number>;
  weekly: { week: string; submitted: number; approved: number; returned: number }[];
  groups: AnalyticsAgg[];
  companies: AnalyticsAgg[];
}

export interface JournalData {
  month: string;
  days: { date: string; day: number; weekday: number; isWeekend: boolean }[];
  rows: {
    internshipId: string;
    studentId: string;
    studentName: string;
    studentNumber: string;
    groupName: string;
    company: string;
    cells: { date: string; inRange: boolean; attendance: 'PRESENT' | 'LATE' | 'EXCUSED' | 'ABSENT' | null; hours: number | null; diary: 'DRAFT' | 'SUBMITTED' | 'RETURNED' | 'APPROVED' | null; diaryId: string | null }[];
    totals: { PRESENT: number; LATE: number; EXCUSED: number; ABSENT: number; hours: number; diaryApproved: number; diaryTotal: number; attendanceRate: number | null };
  }[];
}

export interface NotificationItem {
  id: string;
  type: 'warning' | 'info' | 'success' | 'action';
  title: string;
  message: string;
  link?: string;
  date: string;
}

// Backward-compatible aliases used by existing pages
export type MockUser = AppUser;
export type MockInternship = Internship;
export type MockDiaryEntry = DiaryEntry;

// ─── Labels ──────────────────────────────────────────────────────────────────

export const ROLE_LABELS: Record<ApiRole, string> = {
  ADMIN: 'Administrator',
  STUDENT: 'Talaba',
  COMPANY_SUPERVISOR: 'Korxona rahbari',
  UNIVERSITY_SUPERVISOR: "Ta'lim muassasasi rahbari",
};

export function getStatusLabel(status: EntryStatus): string {
  const labels: Record<EntryStatus, string> = {
    draft: 'Qoralama',
    submitted: 'Yuborilgan',
    approved: 'Tasdiqlangan',
    rejected: 'Rad etilgan',
    returned: 'Qaytarilgan',
  };
  return labels[status] ?? status;
}

export function getInternshipStatusLabel(status: InternshipStatus): string {
  const labels: Record<InternshipStatus, string> = {
    planned: 'Rejalashtirilgan',
    active: 'Faol',
    completed: 'Tugallangan',
    cancelled: 'Bekor qilingan',
  };
  return labels[status] ?? status;
}

export function getRoleLabel(role: UserRole): string {
  const labels: Record<UserRole, string> = { admin: 'Administrator', student: 'Talaba', supervisor: 'Rahbar' };
  return labels[role];
}

export function getUserStatusLabel(status: UserStatus): string {
  return status === 'active' ? 'Faol' : 'Nofaol';
}

/** DD.MM.YYYY — explicit, because browsers render the 'uz-UZ' locale inconsistently. */
export function formatDate(dateStr: string): string {
  if (!dateStr) return '—';
  const d = /^\d{4}-\d{2}-\d{2}$/.test(dateStr) ? new Date(`${dateStr}T00:00:00`) : new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
}

const MONTHS_UZ = ['Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun', 'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr'];
const MONTHS_RU = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];

/** "Noyabr 2026" / "Ноябрь 2026" from YYYY-MM. */
export function monthLabel(ym: string, lang: 'uz' | 'ru' = 'uz'): string {
  const [y, m] = ym.split('-').map(Number);
  return `${(lang === 'ru' ? MONTHS_RU : MONTHS_UZ)[m - 1]} ${y}`;
}

/** Local (browser) date as YYYY-MM-DD. */
export function todayYmd(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
