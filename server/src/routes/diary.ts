import { Router, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { DiaryEntryStatus } from '@prisma/client';
import { z } from 'zod';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';
import {
  notifyDiarySubmitted,
  notifyDiaryReturned,
  notifyDiaryApproved,
} from '../services/notificationService';
import { validateDiaryEntryDate } from '../lib/dateGuards';

const router = Router();

const createEntrySchema = z.object({
  internshipId: z.string().optional(),
  entryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Sana YYYY-MM-DD formatida bo'lishi kerak"),
  taskTitle: z.string().min(3, "Mavzu kamida 3 belgidan iborat bo'lishi kerak"),
  description: z.string().min(5, "Tavsif kamida 5 belgidan iborat bo'lishi kerak"),
  result: z.string().optional(),
  hours: z.number().min(0.5, "Ish vaqti kamida 0.5 soat bo'lishi kerak").max(24, "Ish vaqti 24 soatdan oshmasligi kerak").default(8),
  status: z.enum(['DRAFT', 'SUBMITTED']).default('SUBMITTED'),
  planItemId: z.string().optional().nullable(),
});

const updateEntrySchema = z.object({
  entryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Sana YYYY-MM-DD formatida bo'lishi kerak").optional(),
  taskTitle: z.string().min(3, "Mavzu kamida 3 belgidan iborat bo'lishi kerak").optional(),
  description: z.string().min(5, "Tavsif kamida 5 belgidan iborat bo'lishi kerak").optional(),
  result: z.string().optional(),
  hours: z.number().min(0.5).max(24).optional(),
  status: z.enum(['DRAFT', 'SUBMITTED']).optional(),
  planItemId: z.string().optional().nullable(),
});

/** Ensures a plan item belongs to the given internship. */
async function planItemBelongs(planItemId: string | null | undefined, internshipId: string): Promise<boolean> {
  if (!planItemId) return true;
  const item = await prisma.internshipPlanItem.findUnique({ where: { id: planItemId } });
  return Boolean(item && item.internshipId === internshipId);
}

const reviewEntrySchema = z
  .object({
    decision: z.enum(['approved', 'returned'], {
      errorMap: () => ({ message: "Qaror faqat 'approved' yoki 'returned' bo'lishi kerak" }),
    }),
    comment: z
      .string({ invalid_type_error: "Izoh matn bo'lishi kerak" })
      .max(1000, "Izoh 1000 belgidan oshmasligi kerak")
      .optional()
      .nullable(),
  })
  .superRefine((data, ctx) => {
    if (data.decision === 'returned') {
      const trimmed = typeof data.comment === 'string' ? data.comment.trim() : '';
      if (!trimmed) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['comment'],
          message: "Kundalik qaytarilganda izoh (comment) kiritilishi shart",
        });
      }
    }
  });

/**
 * GET /api/diary
 * Role-aware & status-scoped:
 * - STUDENT: sees their own diary entries (DRAFT, SUBMITTED, RETURNED, APPROVED).
 * - SUPERVISOR: ONLY sees SUBMITTED & APPROVED entries for assigned internships.
 *   DRAFT and RETURNED are completely excluded from supervisor list/review views!
 * - ADMIN: sees all entries (or filtered by query).
 */
router.get('/', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = req.user!;
    const { status, search, limit } = req.query;

    const whereClause: any = {};

    // ── ROLE FILTERING & STATUS VISIBILITY ──
    if (user.role === 'STUDENT') {
      whereClause.internship = { studentId: user.id };
    } else if (user.role === 'COMPANY_SUPERVISOR') {
      whereClause.internship = { companySupervisorId: user.id };
      // Supervisor MUST NOT see DRAFT or RETURNED entries
      whereClause.status = { in: ['SUBMITTED', 'APPROVED'] };
    } else if (user.role === 'UNIVERSITY_SUPERVISOR') {
      whereClause.internship = { universitySupervisorId: user.id };
      // Supervisor MUST NOT see DRAFT or RETURNED entries
      whereClause.status = { in: ['SUBMITTED', 'APPROVED'] };
    }
    // ADMIN has no default scope restriction

    // If a specific status query is passed
    if (status && typeof status === 'string' && status !== 'all') {
      const requestedStatus = status.toUpperCase() as DiaryEntryStatus;
      if (user.role === 'COMPANY_SUPERVISOR' || user.role === 'UNIVERSITY_SUPERVISOR') {
        // Enforce that supervisor cannot request DRAFT or RETURNED
        if (requestedStatus === 'DRAFT' || requestedStatus === 'RETURNED') {
          res.json({ success: true, data: [] });
          return;
        }
      }
      whereClause.status = requestedStatus;
    }

    if (search && typeof search === 'string') {
      whereClause.AND = [
        {
          OR: [
            { taskTitle: { contains: search, mode: 'insensitive' } },
            { description: { contains: search, mode: 'insensitive' } },
            { internship: { student: { fullName: { contains: search, mode: 'insensitive' } } } },
            { internship: { company: { name: { contains: search, mode: 'insensitive' } } } },
          ],
        },
      ];
    }

    const takeLimit = limit ? Math.min(Number(limit), 100) : 50;

    const entries = await prisma.diaryEntry.findMany({
      where: whereClause,
      take: takeLimit,
      orderBy: { entryDate: 'desc' },
      include: {
        planItem: { select: { id: true, title: true } },
        internship: {
          include: {
            student: { select: { id: true, fullName: true, email: true } },
            company: { select: { id: true, name: true, address: true } },
          },
        },
        reviews: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: {
            reviewer: { select: { id: true, fullName: true, role: true } },
          },
        },
      },
    });

    const formatted = entries.map((e) => {
      const latestReview = e.reviews[0];
      return {
        id: e.id,
        date: e.entryDate.toISOString().split('T')[0],
        internshipId: e.internshipId,
        studentId: e.internship.student.id,
        studentName: e.internship.student.fullName,
        company: e.internship.company.name,
        title: e.taskTitle,
        content: e.description,
        result: e.result,
        hours: Number(e.hours),
        status: e.status.toLowerCase(), // draft, submitted, approved, returned
        supervisorComment: latestReview?.comment || null,
        reviewedAt: latestReview?.createdAt ? latestReview.createdAt.toISOString() : null,
        reviewedBy: latestReview?.reviewer ? latestReview.reviewer.fullName : null,
        tasks: e.result ? [e.taskTitle, e.result] : [e.taskTitle],
        planItemId: e.planItemId,
        planItemTitle: e.planItem?.title ?? null,
        createdAt: e.createdAt.toISOString(),
      };
    });

    res.json({
      success: true,
      data: formatted,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/diary/:id
 */
router.get('/:id', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = req.user!;
    const entry = await prisma.diaryEntry.findUnique({
      where: { id: req.params.id },
      include: {
        planItem: { select: { id: true, title: true } },
        internship: {
          include: {
            student: { select: { id: true, fullName: true, email: true } },
            company: { select: { id: true, name: true, address: true } },
          },
        },
        reviews: {
          orderBy: { createdAt: 'desc' },
          include: {
            reviewer: { select: { id: true, fullName: true, role: true } },
          },
        },
      },
    });

    if (!entry) {
      res.status(404).json({ error: { message: "Kundalik yozuvi topilmadi", status: 404 } });
      return;
    }

    // Authorization check: Student can only view their own entry
    if (user.role === 'STUDENT' && entry.internship.studentId !== user.id) {
      res.status(403).json({ error: { message: "Siz faqat o'z kundaligingizni ko'ra olasiz", status: 403 } });
      return;
    }

    // Supervisor check: must be assigned AND entry must NOT be DRAFT or RETURNED
    if (
      user.role === 'COMPANY_SUPERVISOR' &&
      entry.internship.companySupervisorId !== user.id
    ) {
      res.status(403).json({ error: { message: "Ushbu amaliyot sizning korxonangizga yoki sizga biriktirilmagan", status: 403 } });
      return;
    }

    if (
      user.role === 'UNIVERSITY_SUPERVISOR' &&
      entry.internship.universitySupervisorId !== user.id
    ) {
      res.status(403).json({ error: { message: "Ushbu talaba sizga biriktirilmagan", status: 403 } });
      return;
    }

    if (
      (user.role === 'COMPANY_SUPERVISOR' || user.role === 'UNIVERSITY_SUPERVISOR') &&
      (entry.status === 'DRAFT' || entry.status === 'RETURNED')
    ) {
      res.status(403).json({
        error: { message: "Qoralama yoki tuzatish uchun qaytarilgan kundalik ustozga ko'rinmaydi", status: 403 },
      });
      return;
    }

    const latestReview = entry.reviews[0];

    res.json({
      success: true,
      data: {
        id: entry.id,
        date: entry.entryDate.toISOString().split('T')[0],
        internshipId: entry.internshipId,
        studentId: entry.internship.student.id,
        studentName: entry.internship.student.fullName,
        company: entry.internship.company.name,
        title: entry.taskTitle,
        content: entry.description,
        result: entry.result,
        hours: Number(entry.hours),
        status: entry.status.toLowerCase(),
        supervisorComment: latestReview?.comment || null,
        reviewedAt: latestReview?.createdAt ? latestReview.createdAt.toISOString() : null,
        reviewedBy: latestReview?.reviewer ? latestReview.reviewer.fullName : null,
        tasks: entry.result ? [entry.taskTitle, entry.result] : [entry.taskTitle],
        planItemId: entry.planItemId,
        planItemTitle: entry.planItem?.title ?? null,
        createdAt: entry.createdAt.toISOString(),
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Helper to resolve target internship for current user
 */
async function resolveInternshipForUser(user: any, requestedInternshipId?: string) {
  if (user.role === 'STUDENT') {
    const studentInternship = requestedInternshipId
      ? await prisma.internship.findFirst({ where: { studentId: user.id, id: requestedInternshipId } })
      : null;

    if (studentInternship) {
      return { ok: true as const, internshipId: studentInternship.id, internship: studentInternship };
    }

    if (requestedInternshipId) {
      const exists = await prisma.internship.findUnique({ where: { id: requestedInternshipId } });
      if (exists) {
        return { ok: false as const, status: 403, message: "Siz faqat o'zingizning amaliyotingiz uchun kundalik yoza olasiz" };
      }
    }

    const anyStudentInternship =
      (await prisma.internship.findFirst({ where: { studentId: user.id, status: 'ACTIVE' }, orderBy: { startDate: 'desc' } })) ??
      (await prisma.internship.findFirst({ where: { studentId: user.id }, orderBy: { startDate: 'desc' } }));

    if (!anyStudentInternship) {
      return { ok: false as const, status: 404, message: "Sizga biriktirilgan faol amaliyot dasturi topilmadi" };
    }

    return { ok: true as const, internshipId: anyStudentInternship.id, internship: anyStudentInternship };
  } else {
    // ADMIN
    if (!requestedInternshipId) {
      const first = await prisma.internship.findFirst();
      if (!first) return { ok: false as const, status: 404, message: "Amaliyot dasturi topilmadi" };
      return { ok: true as const, internshipId: first.id, internship: first };
    }
    const check = await prisma.internship.findUnique({ where: { id: requestedInternshipId } });
    if (!check) return { ok: false as const, status: 404, message: "Amaliyot dasturi topilmadi" };
    return { ok: true as const, internshipId: check.id, internship: check };
  }
}

/**
 * POST /api/diary
 * Creates a brand NEW diary entry.
 */
router.post('/', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = req.user!;
    const validated = createEntrySchema.parse(req.body);

    if (user.role === 'COMPANY_SUPERVISOR' || user.role === 'UNIVERSITY_SUPERVISOR') {
      res.status(403).json({
        error: { message: "Rahbarlar kundalik yozuvlarini yaratish huquqiga ega emas", status: 403 },
      });
      return;
    }

    const resolved = await resolveInternshipForUser(user, validated.internshipId);
    if (!resolved.ok) {
      res.status(resolved.status).json({ error: { message: resolved.message, status: resolved.status } });
      return;
    }
    const targetInternship = resolved.internship;
    const targetInternshipId = resolved.internshipId;

    // Validate entryDate and internship status
    const dateCheck = validateDiaryEntryDate(validated.entryDate, targetInternship);
    if (!dateCheck.valid) {
      res.status(400).json({ error: { message: dateCheck.message, status: 400 } });
      return;
    }
    const entryDateObj = dateCheck.entryDateObj!;

    // Check if entry already exists on this date
    const existing = await prisma.diaryEntry.findUnique({
      where: {
        internshipId_entryDate: {
          internshipId: targetInternshipId,
          entryDate: entryDateObj,
        },
      },
    });

    if (existing) {
      if (existing.status === 'APPROVED') {
        res.status(400).json({
          error: {
            message: `Tanlangan sana (${validated.entryDate}) uchun allaqachon tasdiqlangan kundalik yozuvi mavjud. Tasdiqlangan yozuvni qayta o'zgartirib bo'lmaydi. Yangi yozuv yaratish uchun iltimos boshqa sanani tanlang.`,
            status: 400,
          },
        });
        return;
      }

      // Existing entry is DRAFT or SUBMITTED or RETURNED -> reject POST, instruct to edit
      res.status(400).json({
        error: {
          message: `Ushbu sana (${validated.entryDate}) uchun allaqachon kundalik mavjud (${existing.status}). Iltimos mavjud yozuvni tahrirlang yoki boshqa sana tanlang.`,
          status: 400,
          existingId: existing.id,
        },
      });
      return;
    }

    if (!(await planItemBelongs(validated.planItemId, targetInternshipId))) {
      res.status(400).json({ error: { message: "Tanlangan reja bandi ushbu amaliyotga tegishli emas", status: 400 } });
      return;
    }

    // Create fresh entry
    const entry = await prisma.diaryEntry.create({
      data: {
        internshipId: targetInternshipId,
        entryDate: entryDateObj,
        taskTitle: validated.taskTitle,
        description: validated.description,
        result: validated.result,
        hours: validated.hours,
        status: validated.status as DiaryEntryStatus,
        submittedAt: validated.status === 'SUBMITTED' ? new Date() : null,
        planItemId: validated.planItemId || null,
      },
    });

    if (entry.status === 'SUBMITTED') {
      void notifyDiarySubmitted(entry.id);
    }

    res.status(201).json({
      success: true,
      data: entry,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/diary/:id
 * Edits an EXISTING diary entry by ID.
 * - Allows student to update their DRAFT or RETURNED entries ONLY.
 * - Guard: APPROVED entries cannot be edited (even by ADMIN).
 * - Guard: SUBMITTED entries cannot be edited by STUDENT.
 * - Guard: Date within [startDate, endDate], not in future, internship ACTIVE.
 */
router.patch('/:id', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = req.user!;
    const { id } = req.params;
    const validated = updateEntrySchema.parse(req.body);

    const existing = await prisma.diaryEntry.findUnique({
      where: { id },
      include: { internship: true },
    });

    if (!existing) {
      res.status(404).json({ error: { message: "Kundalik yozuvi topilmadi", status: 404 } });
      return;
    }

    // Role check: only owner student or ADMIN can update
    if (user.role === 'STUDENT' && existing.internship.studentId !== user.id) {
      res.status(403).json({ error: { message: "Siz faqat o'z kundaligingizni tahrirlashingiz mumkin", status: 403 } });
      return;
    }

    if (user.role === 'COMPANY_SUPERVISOR' || user.role === 'UNIVERSITY_SUPERVISOR') {
      res.status(403).json({ error: { message: "Rahbarlar kundalik yozuvini to'g'ridan-to'g'ri o'zgartira olmaydi", status: 403 } });
      return;
    }

    // Bug 2: ADMIN must not be able to modify APPROVED entries either (entries are immutable once approved). Return 400.
    if (existing.status === 'APPROVED') {
      res.status(400).json({
        error: { message: "Tasdiqlangan kundalik yozuvini qayta o'zgartirish mumkin emas", status: 400 },
      });
      return;
    }

    // Bug 1: a STUDENT may edit an entry ONLY when its status is DRAFT or RETURNED.
    // Currently only APPROVED is blocked, so SUBMITTED entries can be edited or reverted to DRAFT.
    // Return 400 with an Uzbek message for SUBMITTED/APPROVED.
    if (user.role === 'STUDENT' && existing.status !== 'DRAFT' && existing.status !== 'RETURNED') {
      res.status(400).json({
        error: {
          message: `Topshirilgan (${existing.status}) holatdagi kundalik yozuvini tahrirlash mumkin emas. Faqat qoralama yoki qaytarilgan yozuvlarni tahrirlash mumkin.`,
          status: 400,
        },
      });
      return;
    }

    // Bug 3: Date validation for both POST and PATCH:
    // - entryDate must be within the internship's [startDate, endDate] inclusive.
    // - entryDate must not be in the future (compare date-only, UTC).
    // - the internship status must be ACTIVE; otherwise 400.
    const dateToValidate = validated.entryDate ?? existing.entryDate;
    const dateCheck = validateDiaryEntryDate(dateToValidate, existing.internship);
    if (!dateCheck.valid) {
      res.status(400).json({ error: { message: dateCheck.message, status: 400 } });
      return;
    }

    let newDateObj: Date | undefined;
    if (validated.entryDate) {
      newDateObj = dateCheck.entryDateObj!;

      // Check if new date collides with another entry (different ID)
      const collision = await prisma.diaryEntry.findUnique({
        where: {
          internshipId_entryDate: {
            internshipId: existing.internshipId,
            entryDate: newDateObj,
          },
        },
      });

      if (collision && collision.id !== id) {
        res.status(400).json({
          error: { message: `Tanlangan sana (${validated.entryDate}) uchun boshqa kundalik yozuvi mavjud.`, status: 400 },
        });
        return;
      }
    }

    if (!(await planItemBelongs(validated.planItemId, existing.internshipId))) {
      res.status(400).json({ error: { message: "Tanlangan reja bandi ushbu amaliyotga tegishli emas", status: 400 } });
      return;
    }

    const updated = await prisma.diaryEntry.update({
      where: { id },
      data: {
        ...(newDateObj ? { entryDate: newDateObj } : {}),
        ...(validated.taskTitle ? { taskTitle: validated.taskTitle } : {}),
        ...(validated.description ? { description: validated.description } : {}),
        ...(validated.result !== undefined ? { result: validated.result } : {}),
        ...(validated.hours ? { hours: validated.hours } : {}),
        ...(validated.status ? { status: validated.status as DiaryEntryStatus } : {}),
        ...(validated.status === 'SUBMITTED' ? { submittedAt: new Date() } : {}),
        ...(validated.planItemId !== undefined ? { planItemId: validated.planItemId || null } : {}),
      },
    });

    if (updated.status === 'SUBMITTED') {
      void notifyDiarySubmitted(updated.id);
    }

    res.json({
      success: true,
      data: updated,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/diary/:id/review
 * Only supervisors (company/university) assigned to this internship OR Admin can review.
 * CRITICAL RULE: ONLY SUBMITTED entries can be reviewed!
 * DRAFT, RETURNED, or APPROVED entries will be strictly rejected.
 */
router.post('/:id/review', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = req.user!;
    const { id } = req.params;

    // Bug 4: Validate body with Zod:
    // decision enum ['approved', 'returned'], comment optional string max 1000;
    // comment is REQUIRED when decision is 'returned'.
    const parseResult = reviewEntrySchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        error: {
          message: parseResult.error.errors[0]?.message || "Noto'g'ri ma'lumotlar",
          status: 400,
        },
      });
      return;
    }
    const { decision, comment } = parseResult.data;

    if (user.role === 'STUDENT') {
      res.status(403).json({
        error: { message: "Talabalar kundaliklarni tekshirish yoki baholash huquqiga ega emas", status: 403 },
      });
      return;
    }

    const entry = await prisma.diaryEntry.findUnique({
      where: { id },
      include: { internship: true },
    });

    if (!entry) {
      res.status(404).json({ error: { message: "Kundalik yozuvi topilmadi", status: 404 } });
      return;
    }

    // Business flow check: STRICTLY ONLY SUBMITTED entries can be reviewed!
    if (entry.status !== 'SUBMITTED') {
      res.status(400).json({
        error: {
          message: `Faqat topshirilgan (SUBMITTED) holatdagi kundaliklarni baholash mumkin. Ushbu yozuv holati: ${entry.status}.`,
          status: 400,
        },
      });
      return;
    }

    // If supervisor, check assignment
    if (
      user.role === 'COMPANY_SUPERVISOR' &&
      entry.internship.companySupervisorId !== user.id
    ) {
      res.status(403).json({
        error: { message: "Ushbu amaliyot sizning korxonangizga yoki sizga biriktirilmagan", status: 403 },
      });
      return;
    }

    if (
      user.role === 'UNIVERSITY_SUPERVISOR' &&
      entry.internship.universitySupervisorId !== user.id
    ) {
      res.status(403).json({
        error: { message: "Ushbu talaba sizga biriktirilmagan", status: 403 },
      });
      return;
    }

    const reviewDecision = decision === 'approved' ? 'APPROVED' : 'RETURNED';
    const entryStatus: DiaryEntryStatus = decision === 'approved' ? 'APPROVED' : 'RETURNED';
    const finalComment = comment?.trim() || (decision === 'approved' ? 'Tasdiqlandi' : 'Qayta ishlashga qaytarildi');

    // Bug 5: Atomic status transition using prisma.diaryEntry.updateMany({ where: { id, status: 'SUBMITTED' }, data: {...} }) inside $transaction
    // Return 409 if count === 0 (race condition guard).
    const result = await prisma.$transaction(async (tx) => {
      const updateResult = await tx.diaryEntry.updateMany({
        where: { id, status: 'SUBMITTED' },
        data: { status: entryStatus },
      });

      if (updateResult.count === 0) {
        return null;
      }

      await tx.diaryReview.create({
        data: {
          diaryEntryId: id,
          reviewerId: user.id,
          decision: reviewDecision,
          comment: finalComment,
        },
      });

      return tx.diaryEntry.findUnique({
        where: { id },
      });
    });

    if (!result) {
      res.status(409).json({
        error: {
          message: "Kundalik holati o'zgargan yoki boshqa rahbar tomonidan ko'rib chiqilgan (faqat topshirilgan kundalikni baholash mumkin)",
          status: 409,
        },
      });
      return;
    }

    if (entryStatus === 'APPROVED') {
      void notifyDiaryApproved(id);
    } else if (entryStatus === 'RETURNED') {
      void notifyDiaryReturned(id, finalComment);
    }

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
