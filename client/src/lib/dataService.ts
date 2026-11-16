import { api, apiData, ApiError, authHeaders, BASE_URL, NETWORK_ERROR_MESSAGE } from './api';
import type {
  AppUser,
  Analytics,
  Company,
  DiaryEntry,
  Internship,
  InternshipDetail,
  JournalData,
  NotificationItem,
  PlanItem,
  StudentGroup,
  MockDiaryEntry,
  MockInternship,
  MockUser,
} from './types';

export type { MockDiaryEntry, MockInternship, MockUser };
export { ApiError };

export interface DashboardStatsResponse {
  totalDays: number;
  submittedEntries: number;
  approvedEntries: number;
  pendingReviews: number;
  activeInternships?: number;
  totalStudents?: number;
  totalCompanies?: number;
  totalApprovedHours?: number;
}

/** Live dashboard counters (throws ApiError on failure — no mock fallback). */
export function fetchDashboardStats(): Promise<DashboardStatsResponse> {
  return apiData<DashboardStatsResponse>('get', '/api/dashboard/stats');
}

/** Aggregated chart data (diary status, attendance, weekly dynamics, groups, companies). */
export function fetchAnalytics(weeks = 8): Promise<Analytics> {
  return apiData<Analytics>('get', `/api/dashboard/analytics?weeks=${weeks}`);
}

/** Diary entries for the current user (role scoped on the server). */
export async function fetchDiaryEntries(params?: { status?: string; search?: string; limit?: number }): Promise<DiaryEntry[]> {
  const query = new URLSearchParams();
  if (params?.status && params.status !== 'all') query.set('status', params.status);
  if (params?.search) query.set('search', params.search);
  if (params?.limit) query.set('limit', String(params.limit));
  const qs = query.toString();
  return (await apiData<DiaryEntry[]>('get', `/api/diary${qs ? `?${qs}` : ''}`)) ?? [];
}

/** Single diary entry or null when not found / not accessible. */
export async function fetchDiaryEntryById(id: string): Promise<DiaryEntry | null> {
  try {
    return await apiData<DiaryEntry>('get', `/api/diary/${id}`);
  } catch (e) {
    if (e instanceof ApiError && (e.status === 404 || e.status === 403)) return null;
    throw e;
  }
}

type DiaryPayload = {
  internshipId?: string;
  entryDate?: string;
  taskTitle?: string;
  description?: string;
  result?: string;
  hours?: number;
  status?: 'DRAFT' | 'SUBMITTED';
  planItemId?: string | null;
};

async function mutate(method: 'post' | 'patch', path: string, payload: unknown): Promise<{ ok: boolean; data?: any; error?: string }> {
  try {
    const res = await api[method]<{ success: boolean; data?: any; message?: string; error?: { message: string } }>(path, payload);
    if (!res.ok) return { ok: false, error: res.data?.error?.message || 'Serverda xatolik yuz berdi.' };
    return { ok: true, data: res.data?.data ?? res.data?.message };
  } catch (err: any) {
    return { ok: false, error: err.message || NETWORK_ERROR_MESSAGE };
  }
}

export function createDiaryEntry(payload: DiaryPayload & { entryDate: string; taskTitle: string; description: string; status: 'DRAFT' | 'SUBMITTED' }) {
  return mutate('post', '/api/diary', payload);
}

export function updateDiaryEntry(id: string, payload: DiaryPayload) {
  return mutate('patch', `/api/diary/${id}`, payload);
}

export function saveDiaryEntry(
  payload: DiaryPayload & { entryDate: string; taskTitle: string; description: string; status: 'DRAFT' | 'SUBMITTED' },
  existingId?: string,
) {
  return existingId ? updateDiaryEntry(existingId, payload) : createDiaryEntry(payload);
}

export async function submitDiaryReview(entryId: string, payload: { decision: 'approved' | 'rejected' | 'returned'; comment: string }): Promise<{ ok: boolean; error?: string }> {
  const r = await mutate('post', `/api/diary/${entryId}/review`, payload);
  return { ok: r.ok, error: r.error };
}

// ── Internships, plan ───────────────────────────────────────────────────────

export async function fetchInternships(params?: { status?: string; groupId?: string }): Promise<Internship[]> {
  const q = new URLSearchParams();
  if (params?.status) q.set('status', params.status);
  if (params?.groupId) q.set('groupId', params.groupId);
  const qs = q.toString();
  return (await apiData<Internship[]>('get', `/api/internships${qs ? `?${qs}` : ''}`)) ?? [];
}

export function fetchInternshipDetail(id: string): Promise<InternshipDetail> {
  return apiData<InternshipDetail>('get', `/api/internships/${id}`);
}

export async function fetchMyInternshipId(): Promise<string | null> {
  const r = await apiData<{ id: string } | null>('get', '/api/internships/mine');
  return r?.id ?? null;
}

export interface InternshipPayload {
  studentId: string;
  companyId: string;
  companySupervisorId?: string | null;
  universitySupervisorId?: string | null;
  startDate: string;
  endDate: string;
  status: 'PLANNED' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
  position?: string | null;
  programDescription?: string | null;
}

export const createInternship = (p: InternshipPayload) => apiData<{ id: string }>('post', '/api/internships', p);
export const updateInternship = (id: string, p: Partial<InternshipPayload>) => apiData<void>('patch', `/api/internships/${id}`, p);
export const deleteInternship = (id: string) => apiData<void>('delete', `/api/internships/${id}`);

export async function fetchPlan(internshipId: string): Promise<PlanItem[]> {
  return (await apiData<PlanItem[]>('get', `/api/internships/${internshipId}/plan`)) ?? [];
}
export const createPlanItem = (internshipId: string, p: { title: string; description?: string | null; plannedHours: number }) =>
  apiData<PlanItem>('post', `/api/internships/${internshipId}/plan`, p);
export const updatePlanItem = (
  internshipId: string,
  itemId: string,
  p: Partial<{ title: string; description: string | null; plannedHours: number; orderIndex: number }>,
) => apiData<PlanItem>('patch', `/api/internships/${internshipId}/plan/${itemId}`, p);
export const deletePlanItem = (internshipId: string, itemId: string) => apiData<void>('delete', `/api/internships/${internshipId}/plan/${itemId}`);

// ── Catalog: companies, groups ──────────────────────────────────────────────

export async function fetchCompanies(): Promise<Company[]> {
  return (await apiData<Company[]>('get', '/api/companies')) ?? [];
}
export const createCompany = (p: Partial<Company>) => apiData<Company>('post', '/api/companies', p);
export const updateCompany = (id: string, p: Partial<Company>) => apiData<Company>('patch', `/api/companies/${id}`, p);
export const deleteCompany = (id: string) => apiData<void>('delete', `/api/companies/${id}`);

export async function fetchGroups(): Promise<StudentGroup[]> {
  return (await apiData<StudentGroup[]>('get', '/api/groups')) ?? [];
}
export const createGroup = (p: Partial<StudentGroup>) => apiData<StudentGroup>('post', '/api/groups', p);
export const updateGroup = (id: string, p: Partial<StudentGroup>) => apiData<StudentGroup>('patch', `/api/groups/${id}`, p);
export const deleteGroup = (id: string) => apiData<void>('delete', `/api/groups/${id}`);

// ── Users ───────────────────────────────────────────────────────────────────

export async function fetchUsers(params?: { role?: string; groupId?: string }): Promise<AppUser[]> {
  const q = new URLSearchParams();
  if (params?.role) q.set('role', params.role);
  if (params?.groupId) q.set('groupId', params.groupId);
  const qs = q.toString();
  return (await apiData<AppUser[]>('get', `/api/users${qs ? `?${qs}` : ''}`)) ?? [];
}

export interface UserPayload {
  fullName: string;
  email: string;
  role: 'ADMIN' | 'STUDENT' | 'COMPANY_SUPERVISOR' | 'UNIVERSITY_SUPERVISOR';
  phone?: string | null;
  position?: string | null;
  groupId?: string | null;
  studentNumber?: string | null;
}

export const createUser = (p: UserPayload) => apiData<{ user: AppUser; tempPassword: string }>('post', '/api/users', p);
export const updateUser = (id: string, p: Partial<UserPayload>) => apiData<AppUser>('patch', `/api/users/${id}`, p);
export const resetUserPassword = (id: string) => apiData<{ tempPassword: string }>('post', `/api/users/${id}/reset-password`, {});

export interface ImportResult {
  created: number;
  skipped: number;
  errors: number;
  results: { row: number; fullName: string; email: string; role?: string; status: 'created' | 'skipped' | 'error'; message?: string; tempPassword?: string }[];
}

export async function importUsers(file: File): Promise<ImportResult> {
  const fd = new FormData();
  fd.append('file', file);
  return apiData<ImportResult>('post', '/api/users/import', fd);
}

/** Toggle user active status. Returns the new isActive value, throws on error. */
export async function toggleUserStatus(userId: string): Promise<boolean> {
  const r = await apiData<{ isActive: boolean }>('patch', `/api/users/${userId}/toggle-status`, {});
  return r.isActive;
}

// ── Own account ─────────────────────────────────────────────────────────────

export const changePassword = (currentPassword: string, newPassword: string) =>
  mutate('post', '/api/auth/change-password', { currentPassword, newPassword });
export const updateOwnProfile = (p: { phone: string | null }) => mutate('patch', '/api/auth/profile', p);

// ── Journal, notifications, verification ────────────────────────────────────

export function fetchJournal(month: string, groupId?: string): Promise<JournalData> {
  const q = new URLSearchParams({ month });
  if (groupId && groupId !== 'all') q.set('groupId', groupId);
  return apiData<JournalData>('get', `/api/journal?${q.toString()}`);
}

export async function fetchNotifications(): Promise<NotificationItem[]> {
  return (await apiData<NotificationItem[]>('get', '/api/notifications')) ?? [];
}

export async function sendReminder(internshipId: string): Promise<string> {
  const res = await api.post<{ message?: string; error?: { message: string } }>(`/api/notifications/remind/${internshipId}`, {});
  if (!res.ok) throw new ApiError(res.data?.error?.message || 'Eslatma yuborilmadi', res.status);
  return res.data?.message || 'Eslatma yuborildi';
}

export interface VerificationResult {
  studentName: string;
  groupName: string | null;
  studyProgram: string | null;
  company: string;
  startDate: string;
  endDate: string;
  status: string;
  approvedEntries: number;
  approvedHours: number;
  attendanceRate: number | null;
  finalScore: number | null;
  grade: string;
  maxScore: number;
  checkedAt: string;
}

export function verifyDocument(internshipId: string, code: string): Promise<VerificationResult> {
  return apiData<VerificationResult>('get', `/api/public/verify/${encodeURIComponent(internshipId)}?c=${encodeURIComponent(code)}`);
}

export { authHeaders, BASE_URL };

export interface AttendanceRecord {
  id: string;
  internshipId: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  studentGroup: string;
  company: string;
  date: string;
  status: 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';
  hours: number;
  note: string;
  createdAt: string;
}

export interface AttendanceStats {
  totalDays: number;
  presentDays: number;
  absentDays: number;
  lateDays: number;
  excusedDays: number;
  totalHours: number;
  attendanceRate: number;
}

/**
 * Fetch attendance records
 */
export async function fetchAttendance(params?: {
  month?: string;
  internshipId?: string;
  studentId?: string;
  status?: string;
}): Promise<AttendanceRecord[]> {
  try {
    const query = new URLSearchParams();
    if (params?.month) query.set('month', params.month);
    if (params?.internshipId && params.internshipId !== 'all') query.set('internshipId', params.internshipId);
    if (params?.studentId && params.studentId !== 'all') query.set('studentId', params.studentId);
    if (params?.status && params.status !== 'all') query.set('status', params.status);

    const path = `/api/attendance${query.toString() ? `?${query.toString()}` : ''}`;
    const res = await api.get<{ success: boolean; data: AttendanceRecord[] }>(path);

    if (res.ok && Array.isArray(res.data?.data)) {
      return res.data.data;
    }
    throw new ApiError((res.data as any)?.error?.message || "Davomat ma'lumotlarini yuklab bo'lmadi", res.status);
  } catch (err) {
    console.warn('[DataService] fetchAttendance error:', err);
    throw err;
  }
}

/**
 * Fetch attendance summary statistics
 */
export async function fetchAttendanceStats(params?: {
  month?: string;
  internshipId?: string;
}): Promise<AttendanceStats> {
  try {
    const query = new URLSearchParams();
    if (params?.month) query.set('month', params.month);
    if (params?.internshipId && params.internshipId !== 'all') query.set('internshipId', params.internshipId);

    const path = `/api/attendance/stats${query.toString() ? `?${query.toString()}` : ''}`;
    const res = await api.get<{ success: boolean; data: AttendanceStats }>(path);

    if (res.ok && res.data?.data) {
      return res.data.data;
    }
  } catch (err) {
    console.warn('[DataService] fetchAttendanceStats error:', err);
  }
  return {
    totalDays: 0,
    presentDays: 0,
    absentDays: 0,
    lateDays: 0,
    excusedDays: 0,
    totalHours: 0,
    attendanceRate: 100,
  };
}

/**
 * Mark or update attendance record (Company supervisor / Admin only)
 */
export async function recordAttendance(payload: {
  internshipId: string;
  attendanceDate: string;
  status: 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';
  hours?: number;
  note?: string;
}): Promise<{ ok: boolean; data?: any; error?: string }> {
  try {
    const res = await api.post<{ success: boolean; data?: any; error?: { message: string } }>('/api/attendance', payload);
    if (!res.ok) {
      return { ok: false, error: res.data?.error?.message || "Davomatni saqlashda xatolik" };
    }
    return { ok: true, data: res.data?.data };
  } catch (err: any) {
    console.error('[DataService] recordAttendance error:', err);
    return { ok: false, error: err.message || "Server bilan aloqa uzildi." };
  }
}

// ── EVALUATION TYPES & SERVICES ──────────────────────────────────────────────

export interface EvaluationCriterionItem {
  key: string;
  name: string;
  description: string;
  maxScore: number;
  score: number;
  comment?: string;
}

export interface SupervisorEvaluationData {
  id: string;
  evaluatorId: string;
  evaluatorName: string;
  evaluatorRole: 'COMPANY_SUPERVISOR' | 'UNIVERSITY_SUPERVISOR' | 'ADMIN';
  status: 'DRAFT' | 'SUBMITTED';
  totalScore: number;
  generalComment: string;
  submittedAt: string | null;
  createdAt: string;
  criteria: EvaluationCriterionItem[];
}

export interface CriterionBreakdownItem {
  key: string;
  name: string;
  description: string;
  maxScore: number;
  companyScore: number | null;
  companyComment: string | null;
  universityScore: number | null;
  universityComment: string | null;
  averageScore: number | null;
}

export interface FinalResultData {
  isCompleted: boolean;
  status: 'COMPLETED' | 'PENDING';
  statusLabel: string;
  companyTotalScore: number | null;
  universityTotalScore: number | null;
  finalScore: number | null;
  maxScore: number;
}

export interface InternshipEvaluationDetail {
  internship: {
    id: string;
    studentId: string;
    studentName: string;
    studentEmail: string;
    studentGroup: string;
    companyId: string;
    companyName: string;
    companySupervisorName: string;
    universitySupervisorName: string;
    startDate: string;
    endDate: string;
    status: string;
  };
  companyEvaluation: SupervisorEvaluationData | null;
  universityEvaluation: SupervisorEvaluationData | null;
  breakdown: CriterionBreakdownItem[];
  finalResult: FinalResultData;
}

export interface EvaluationListItem {
  id: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  groupName: string;
  companyName: string;
  internshipStatus: string;
  companyEvaluation: {
    status: 'DRAFT' | 'SUBMITTED';
    totalScore: number;
    submittedAt: string | null;
    evaluatorName: string;
  } | null;
  universityEvaluation: {
    status: 'DRAFT' | 'SUBMITTED';
    totalScore: number;
    submittedAt: string | null;
    evaluatorName: string;
  } | null;
  finalResult: {
    isCompleted: boolean;
    status: 'COMPLETED' | 'PENDING';
    statusLabel: string;
    finalScore: number | null;
  };
}

/**
 * Fetch all internships evaluation list
 */
export async function fetchEvaluationList(): Promise<EvaluationListItem[]> {
  try {
    const res = await api.get<{ success: boolean; data: EvaluationListItem[] }>('/api/evaluation/list');
    if (res.ok && Array.isArray(res.data?.data)) {
      return res.data.data;
    }
  } catch (err) {
    console.warn('[DataService] fetchEvaluationList error:', err);
  }
  return [];
}

/**
 * Fetch detailed evaluation for a single internship
 */
export async function fetchInternshipEvaluation(internshipId: string): Promise<InternshipEvaluationDetail | null> {
  try {
    const res = await api.get<{ success: boolean; data: InternshipEvaluationDetail }>(`/api/evaluation/internship/${internshipId}`);
    if (res.ok && res.data?.data) {
      return res.data.data;
    }
  } catch (err) {
    console.warn('[DataService] fetchInternshipEvaluation error:', err);
  }
  return null;
}

/**
 * Submit or save supervisor evaluation
 */
export async function submitEvaluation(payload: {
  internshipId: string;
  status: 'DRAFT' | 'SUBMITTED';
  generalComment?: string;
  criteria: {
    criterionKey: string;
    score: number;
    comment?: string;
  }[];
}): Promise<{ ok: boolean; data?: any; error?: string }> {
  try {
    const res = await api.post<{ success: boolean; data?: any; error?: { message: string } }>('/api/evaluation', payload);
    if (!res.ok) {
      return { ok: false, error: res.data?.error?.message || "Baholashni saqlashda xatolik yuz berdi" };
    }
    return { ok: true, data: res.data?.data };
  } catch (err: any) {
    console.error('[DataService] submitEvaluation error:', err);
    return { ok: false, error: err.message || "Server bilan aloqa uzildi." };
  }
}

// ── ATTACHMENT TYPES & SERVICES ─────────────────────────────────────────────

export interface DiaryAttachment {
  id: string;
  diaryEntryId: string;
  originalName: string;
  storedPath: string;
  mimeType: string;
  sizeBytes: string;
  createdAt: string;
}

export async function uploadDiaryAttachments(
  entryId: string,
  files: File[]
): Promise<DiaryAttachment[]> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
  const formData = new FormData();
  files.forEach((file) => formData.append('files', file));

  const BASE = import.meta.env.VITE_API_BASE_URL ?? '';
  const response = await fetch(`${BASE}/api/diary/${entryId}/attachments`, {
    method: 'POST',
    credentials: 'include',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });

  const data = await response.json();
  if (!response.ok) {
    const msg = data?.error?.message ?? 'Fayl yuklashda xato';
    throw new Error(msg);
  }
  return data.attachments as DiaryAttachment[];
}

export async function fetchDiaryAttachments(
  entryId: string
): Promise<DiaryAttachment[]> {
  const res = await api.get<{ attachments: DiaryAttachment[] }>(
    `/api/diary/${entryId}/attachments`
  );
  if (!res.ok) {
    const msg = (res.data as any)?.error?.message ?? "Fayllar ro'yxatini olishda xato";
    throw new Error(msg);
  }
  return res.data.attachments ?? [];
}

export async function downloadAttachment(attachmentId: string, originalName?: string): Promise<void> {
  await downloadReport(`/api/diary/attachments/${attachmentId}`, originalName ?? 'download');
}

export async function deleteAttachment(attachmentId: string): Promise<void> {
  const res = await api.delete<{ message: string }>(
    `/api/diary/attachments/${attachmentId}`
  );
  if (!res.ok) {
    const msg = (res.data as any)?.error?.message ?? "Faylni o'chirishda xato";
    throw new Error(msg);
  }
}

// ── REPORT EXPORTS (PDF & EXCEL) ────────────────────────────────────────────

export async function downloadReport(
  urlPath: string,
  filename: string
): Promise<void> {
  let resp: Response;
  try {
    resp = await fetch(`${BASE_URL}${urlPath}`, { credentials: 'include', headers: authHeaders() });
  } catch {
    throw new ApiError(NETWORK_ERROR_MESSAGE, 0);
  }

  if (!resp.ok) {
    let errorMsg = 'Hisobotni yuklab olishda xatolik yuz berdi';
    try {
      const errJson = await resp.json();
      errorMsg = errJson.error?.message || errorMsg;
    } catch {}
    throw new Error(errorMsg);
  }

  const blob = await resp.blob();
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(objectUrl);
}

// ── TELEGRAM BOT INTEGRATION ───────────────────────────────────────────────

export interface TelegramStatusResponse {
  isLinked: boolean;
  username?: string | null;
  telegramUserId?: string | null;
  linkedAt?: string | null;
  botUsername: string;
  botUrl: string;
}

export interface TelegramLinkCodeResponse {
  code: string;
  expiresAt: string;
  botUsername: string;
  botUrl: string;
  deepLinkUrl: string;
  instructions: string;
}

export async function fetchTelegramStatus(): Promise<TelegramStatusResponse> {
  const res = await api.get<{ success: boolean; data: TelegramStatusResponse }>('/api/telegram/status');
  if (res.ok && res.data?.data) {
    return res.data.data;
  }
  return {
    isLinked: false,
    botUsername: 'amaliyot_kundaligibot',
    botUrl: 'https://t.me/amaliyot_kundaligibot',
  };
}

export async function generateTelegramLinkCode(): Promise<TelegramLinkCodeResponse> {
  const res = await api.post<{ success: boolean; data: TelegramLinkCodeResponse }>('/api/telegram/generate-link-code', {});
  if (res.ok && res.data?.data) {
    return res.data.data;
  }
  const msg = (res as any).data?.error?.message || 'Telegram bog‘lash kodini yaratishda xatolik';
  throw new Error(msg);
}

export async function unlinkTelegram(): Promise<{ success: boolean; message: string }> {
  const res = await api.post<{ success: boolean; message: string }>('/api/telegram/unlink', {});
  if (res.ok) {
    return { success: true, message: res.data?.message || 'Telegram akkaunti muvaffaqiyatli uzildi' };
  }
  const msg = (res as any).data?.error?.message || 'Telegram akkauntini uzishda xatolik';
  throw new Error(msg);
}
