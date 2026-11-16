/**
 * Diary business actions shared by the REST API and the Telegram bot,
 * so both channels enforce exactly the same rules.
 */
import { DiaryEntryStatus, UserRole } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { validateDiaryEntryDate } from '../lib/dateGuards';
import { notifyDiaryApproved, notifyDiaryReturned, notifyDiarySubmitted } from './notificationService';

export interface Actor {
  id: string;
  role: UserRole | string;
}

export type ActionResult<T> = { ok: true; data: T } | { ok: false; status: number; message: string };

/**
 * Approve or return a SUBMITTED diary entry.
 * Rules: only assigned supervisors or admin; only SUBMITTED entries; comment required when returning;
 * atomic status transition (race-safe).
 */
export async function reviewDiaryEntry(
  actor: Actor,
  entryId: string,
  decision: 'approved' | 'returned',
  comment?: string | null,
): Promise<ActionResult<{ id: string; status: DiaryEntryStatus }>> {
  if (actor.role === 'STUDENT') {
    return { ok: false, status: 403, message: 'Talabalar kundaliklarni tekshirish yoki baholash huquqiga ega emas' };
  }
  const trimmed = comment?.trim() || '';
  if (decision === 'returned' && !trimmed) {
    return { ok: false, status: 400, message: 'Kundalik qaytarilganda izoh (comment) kiritilishi shart' };
  }
  if (trimmed.length > 1000) {
    return { ok: false, status: 400, message: 'Izoh 1000 belgidan oshmasligi kerak' };
  }

  const entry = await prisma.diaryEntry.findUnique({ where: { id: entryId }, include: { internship: true } });
  if (!entry) return { ok: false, status: 404, message: 'Kundalik yozuvi topilmadi' };

  if (entry.status !== 'SUBMITTED') {
    return {
      ok: false,
      status: 400,
      message: `Faqat topshirilgan (SUBMITTED) holatdagi kundaliklarni baholash mumkin. Ushbu yozuv holati: ${entry.status}.`,
    };
  }
  if (actor.role === 'COMPANY_SUPERVISOR' && entry.internship.companySupervisorId !== actor.id) {
    return { ok: false, status: 403, message: 'Ushbu amaliyot sizning korxonangizga yoki sizga biriktirilmagan' };
  }
  if (actor.role === 'UNIVERSITY_SUPERVISOR' && entry.internship.universitySupervisorId !== actor.id) {
    return { ok: false, status: 403, message: 'Ushbu talaba sizga biriktirilmagan' };
  }

  const status: DiaryEntryStatus = decision === 'approved' ? 'APPROVED' : 'RETURNED';
  const finalComment = trimmed || (decision === 'approved' ? 'Tasdiqlandi' : 'Qayta ishlashga qaytarildi');

  const updated = await prisma.$transaction(async (tx) => {
    const r = await tx.diaryEntry.updateMany({ where: { id: entryId, status: 'SUBMITTED' }, data: { status } });
    if (r.count === 0) return null;
    await tx.diaryReview.create({
      data: { diaryEntryId: entryId, reviewerId: actor.id, decision: status, comment: finalComment },
    });
    return tx.diaryEntry.findUnique({ where: { id: entryId } });
  });

  if (!updated) {
    return {
      ok: false,
      status: 409,
      message:
        "Kundalik holati o'zgargan yoki boshqa rahbar tomonidan ko'rib chiqilgan (faqat topshirilgan kundalikni baholash mumkin)",
    };
  }

  if (status === 'APPROVED') void notifyDiaryApproved(entryId);
  else void notifyDiaryReturned(entryId, finalComment);

  return { ok: true, data: { id: updated.id, status: updated.status } };
}

/** The internship a student currently writes the diary for (active first, then latest). */
export async function currentInternshipOfStudent(studentId: string) {
  return (
    (await prisma.internship.findFirst({
      where: { studentId, status: 'ACTIVE' },
      orderBy: { startDate: 'desc' },
      include: { company: true, planItems: { orderBy: { orderIndex: 'asc' } } },
    })) ??
    (await prisma.internship.findFirst({
      where: { studentId },
      orderBy: { startDate: 'desc' },
      include: { company: true, planItems: { orderBy: { orderIndex: 'asc' } } },
    }))
  );
}

export interface NewDiaryInput {
  entryDate: string; // YYYY-MM-DD
  taskTitle: string;
  description: string;
  result?: string | null;
  hours: number;
  planItemId?: string | null;
  status: 'DRAFT' | 'SUBMITTED';
}

/** Creates a diary entry for a student with all the same checks as POST /api/diary. */
export async function createDiaryEntryForStudent(
  studentId: string,
  input: NewDiaryInput,
): Promise<ActionResult<{ id: string; status: DiaryEntryStatus }>> {
  const it = await currentInternshipOfStudent(studentId);
  if (!it) return { ok: false, status: 404, message: 'Sizga biriktirilgan faol amaliyot dasturi topilmadi' };

  if (input.taskTitle.trim().length < 3) return { ok: false, status: 400, message: "Mavzu kamida 3 belgidan iborat bo'lishi kerak" };
  if (input.description.trim().length < 5) return { ok: false, status: 400, message: "Tavsif kamida 5 belgidan iborat bo'lishi kerak" };
  if (!(input.hours >= 0.5 && input.hours <= 24)) return { ok: false, status: 400, message: "Ish vaqti 0.5 dan 24 soatgacha bo'lishi kerak" };

  const dateCheck = validateDiaryEntryDate(input.entryDate, it);
  if (!dateCheck.valid) return { ok: false, status: 400, message: dateCheck.message! };

  const existing = await prisma.diaryEntry.findUnique({
    where: { internshipId_entryDate: { internshipId: it.id, entryDate: dateCheck.entryDateObj! } },
  });
  if (existing) {
    return {
      ok: false,
      status: 400,
      message: `Ushbu sana (${input.entryDate}) uchun kundalik allaqachon mavjud (${existing.status}). Uni saytda tahrirlang yoki boshqa sanani tanlang.`,
    };
  }

  if (input.planItemId && !it.planItems.some((p) => p.id === input.planItemId)) {
    return { ok: false, status: 400, message: 'Tanlangan reja bandi ushbu amaliyotga tegishli emas' };
  }

  const entry = await prisma.diaryEntry.create({
    data: {
      internshipId: it.id,
      entryDate: dateCheck.entryDateObj!,
      taskTitle: input.taskTitle.trim(),
      description: input.description.trim(),
      result: input.result?.trim() || null,
      hours: input.hours,
      status: input.status,
      submittedAt: input.status === 'SUBMITTED' ? new Date() : null,
      planItemId: input.planItemId || null,
    },
  });
  return { ok: true, data: { id: entry.id, status: entry.status } };
}

/** Sends the submit notifications for an entry (call after attachments are saved). */
export function announceSubmitted(entryId: string): void {
  void notifyDiarySubmitted(entryId);
}
