import { api } from './api';
import {
  MOCK_DIARY_ENTRIES,
  MOCK_INTERNSHIPS,
  MOCK_USERS,
  MockDiaryEntry,
  MockInternship,
  MockUser,
  getDashboardStats,
} from '@/data/mock';

export type { MockDiaryEntry, MockInternship, MockUser };

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

/**
 * Fetch live dashboard stats from PostgreSQL.
 * Gracefully falls back to mock stats if backend is unreachable or not yet populated.
 */
export async function fetchDashboardStats(): Promise<DashboardStatsResponse> {
  try {
    const res = await api.get<{ success: boolean; data: DashboardStatsResponse }>('/api/dashboard/stats');
    if (res.ok && res.data?.data) {
      return res.data.data;
    }
  } catch (err) {
    console.warn('[DataService] /api/dashboard/stats fallback to mock:', err);
  }
  return getDashboardStats();
}

/**
 * Fetch diary entries from PostgreSQL.
 */
export async function fetchDiaryEntries(params?: {
  status?: string;
  search?: string;
  limit?: number;
}): Promise<MockDiaryEntry[]> {
  try {
    const query = new URLSearchParams();
    if (params?.status && params.status !== 'all') query.set('status', params.status);
    if (params?.search) query.set('search', params.search);
    if (params?.limit) query.set('limit', String(params.limit));

    const path = `/api/diary${query.toString() ? `?${query.toString()}` : ''}`;
    const res = await api.get<{ success: boolean; data: MockDiaryEntry[] }>(path);

    if (res.ok && Array.isArray(res.data?.data) && res.data.data.length > 0) {
      return res.data.data;
    }
  } catch (err) {
    console.warn('[DataService] /api/diary fallback to mock:', err);
  }
  return MOCK_DIARY_ENTRIES;
}

/**
 * Fetch single diary entry
 */
export async function fetchDiaryEntryById(id: string): Promise<MockDiaryEntry | null> {
  try {
    const res = await api.get<{ success: boolean; data: MockDiaryEntry }>(`/api/diary/${id}`);
    if (res.ok && res.data?.data) {
      return res.data.data;
    }
  } catch (err) {
    console.warn('[DataService] /api/diary/:id fallback:', err);
  }
  return MOCK_DIARY_ENTRIES.find((e) => e.id === id) || null;
}

/**
 * Save brand NEW diary entry (POST /api/diary)
 */
export async function createDiaryEntry(payload: {
  internshipId?: string;
  entryDate: string;
  taskTitle: string;
  description: string;
  result?: string;
  hours?: number;
  status: 'DRAFT' | 'SUBMITTED';
}): Promise<{ ok: boolean; data?: any; error?: string }> {
  try {
    const res = await api.post<{ success: boolean; data?: any; error?: { message: string } }>('/api/diary', payload);
    if (!res.ok) {
      const errorMessage = res.data?.error?.message || "Serverda xatolik yuz berdi.";
      return { ok: false, error: errorMessage };
    }
    return { ok: true, data: res.data?.data };
  } catch (err: any) {
    console.error('[DataService] createDiaryEntry error:', err);
    return { ok: false, error: err.message || "Server bilan aloqa uzildi." };
  }
}

/**
 * Update EXISTING diary entry (PATCH /api/diary/:id)
 */
export async function updateDiaryEntry(
  id: string,
  payload: {
    entryDate?: string;
    taskTitle?: string;
    description?: string;
    result?: string;
    hours?: number;
    status?: 'DRAFT' | 'SUBMITTED';
  }
): Promise<{ ok: boolean; data?: any; error?: string }> {
  try {
    const res = await api.patch<{ success: boolean; data?: any; error?: { message: string } }>(`/api/diary/${id}`, payload);
    if (!res.ok) {
      const errorMessage = res.data?.error?.message || "Serverda xatolik yuz berdi.";
      return { ok: false, error: errorMessage };
    }
    return { ok: true, data: res.data?.data };
  } catch (err: any) {
    console.error('[DataService] updateDiaryEntry error:', err);
    return { ok: false, error: err.message || "Server bilan aloqa uzildi." };
  }
}

/**
 * Unified save handler for backward compatibility
 */
export async function saveDiaryEntry(
  payload: {
    internshipId?: string;
    entryDate: string;
    taskTitle: string;
    description: string;
    result?: string;
    hours?: number;
    status: 'DRAFT' | 'SUBMITTED';
  },
  existingId?: string
): Promise<{ ok: boolean; data?: any; error?: string }> {
  if (existingId) {
    return updateDiaryEntry(existingId, payload);
  }
  return createDiaryEntry(payload);
}

/**
 * Submit supervisor review
 */
export async function submitDiaryReview(
  entryId: string,
  payload: { decision: 'approved' | 'rejected'; comment: string }
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await api.post<{ success: boolean; error?: { message: string } }>(`/api/diary/${entryId}/review`, payload);
    if (!res.ok) {
      return { ok: false, error: res.data?.error?.message || "Xatolik yuz berdi" };
    }
    return { ok: true };
  } catch (err: any) {
    console.error('[DataService] submitDiaryReview error:', err);
    return { ok: false, error: err.message };
  }
}

/**
 * Fetch internships
 */
export async function fetchInternships(): Promise<MockInternship[]> {
  try {
    const res = await api.get<{ success: boolean; data: MockInternship[] }>('/api/internships');
    if (res.ok && Array.isArray(res.data?.data) && res.data.data.length > 0) {
      return res.data.data;
    }
  } catch (err) {
    console.warn('[DataService] /api/internships fallback to mock:', err);
  }
  return MOCK_INTERNSHIPS;
}

/**
 * Fetch users
 */
export async function fetchUsers(): Promise<MockUser[]> {
  try {
    const res = await api.get<{ success: boolean; data: MockUser[] }>('/api/users');
    if (res.ok && Array.isArray(res.data?.data) && res.data.data.length > 0) {
      return res.data.data;
    }
  } catch (err) {
    console.warn('[DataService] /api/users fallback to mock:', err);
  }
  return MOCK_USERS;
}

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
  } catch (err) {
    console.warn('[DataService] fetchAttendance error:', err);
  }
  return [];
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

/**
 * Toggle user active status
 */
export async function toggleUserStatus(userId: string): Promise<boolean> {
  try {
    const res = await api.patch<{ success: boolean }>(`/api/users/${userId}/toggle-status`, {});
    return res.ok;
  } catch {
    return false;
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

export function downloadAttachment(
  attachmentId: string,
  originalName?: string
): void {
  const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
  const BASE = import.meta.env.VITE_API_BASE_URL ?? '';
  const url = `${BASE}/api/diary/attachments/${attachmentId}`;

  fetch(url, {
    credentials: 'include',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
    .then((resp) => {
      if (!resp.ok) throw new Error('Fayl yuklab olishda xato');
      return resp.blob();
    })
    .then((blob) => {
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = originalName ?? 'download';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(objectUrl);
    })
    .catch((err) => {
      console.error('[downloadAttachment]', err);
      alert("Faylni yuklab olishda xato yuz berdi. Qaytadan urinib ko'ring.");
    });
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
  const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
  const BASE = import.meta.env.VITE_API_BASE_URL ?? '';
  const url = `${BASE}${urlPath}`;

  const resp = await fetch(url, {
    credentials: 'include',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

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
