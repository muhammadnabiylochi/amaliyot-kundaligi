import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { authenticate, authorize, AuthenticatedRequest, AuthUser } from '../middleware/auth';
import { fail, ymd, parseYmd, countWorkingDays } from '../lib/http';

const router = Router();

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Sana YYYY-MM-DD formatida bo'lishi kerak");

const internshipSchema = z
  .object({
    studentId: z.string().min(1, 'Talaba tanlanishi shart'),
    companyId: z.string().min(1, 'Korxona tanlanishi shart'),
    companySupervisorId: z.string().optional().nullable(),
    universitySupervisorId: z.string().optional().nullable(),
    startDate: dateStr,
    endDate: dateStr,
    status: z.enum(['PLANNED', 'ACTIVE', 'COMPLETED', 'CANCELLED']).default('ACTIVE'),
    position: z.string().trim().optional().nullable(),
    programDescription: z.string().trim().optional().nullable(),
  })
  .refine((d) => d.endDate >= d.startDate, {
    message: "Tugash sanasi boshlanish sanasidan oldin bo'lishi mumkin emas",
    path: ['endDate'],
  });

const planItemSchema = z.object({
  title: z.string().trim().min(3, "Mavzu kamida 3 belgidan iborat bo'lishi kerak"),
  description: z.string().trim().optional().nullable(),
  plannedHours: z.number().min(0.5).max(500).default(8),
  orderIndex: z.number().int().min(0).optional(),
});

/** Role-based scope for internship queries. */
export function internshipScope(user: AuthUser): Prisma.InternshipWhereInput {
  if (user.role === 'STUDENT') return { studentId: user.id };
  if (user.role === 'COMPANY_SUPERVISOR') return { companySupervisorId: user.id };
  if (user.role === 'UNIVERSITY_SUPERVISOR') return { universitySupervisorId: user.id };
  return {};
}

function canAccess(user: AuthUser, i: { studentId: string; companySupervisorId: string | null; universitySupervisorId: string | null }): boolean {
  if (user.role === 'ADMIN') return true;
  if (user.role === 'STUDENT') return i.studentId === user.id;
  if (user.role === 'COMPANY_SUPERVISOR') return i.companySupervisorId === user.id;
  return i.universitySupervisorId === user.id;
}

function canEditPlan(user: AuthUser, i: { companySupervisorId: string | null; universitySupervisorId: string | null }): boolean {
  return (
    user.role === 'ADMIN' ||
    (user.role === 'COMPANY_SUPERVISOR' && i.companySupervisorId === user.id) ||
    (user.role === 'UNIVERSITY_SUPERVISOR' && i.universitySupervisorId === user.id)
  );
}

/** Validates referenced users have the right roles. Returns an error message or null. */
async function validateParticipants(d: { studentId?: string; companySupervisorId?: string | null; universitySupervisorId?: string | null; companyId?: string }) {
  if (d.studentId) {
    const s = await prisma.user.findUnique({ where: { id: d.studentId } });
    if (!s || s.role !== 'STUDENT') return "Tanlangan foydalanuvchi talaba emas";
  }
  if (d.companySupervisorId) {
    const s = await prisma.user.findUnique({ where: { id: d.companySupervisorId } });
    if (!s || s.role !== 'COMPANY_SUPERVISOR') return "Korxona rahbari noto'g'ri tanlangan";
  }
  if (d.universitySupervisorId) {
    const s = await prisma.user.findUnique({ where: { id: d.universitySupervisorId } });
    if (!s || s.role !== 'UNIVERSITY_SUPERVISOR') return "Ta'lim muassasasi rahbari noto'g'ri tanlangan";
  }
  if (d.companyId) {
    const c = await prisma.company.findUnique({ where: { id: d.companyId } });
    if (!c) return 'Korxona topilmadi';
  }
  return null;
}

const listInclude = {
  student: { select: { id: true, fullName: true, email: true, studentProfile: { include: { group: true } } } },
  company: true,
  companySupervisor: { select: { id: true, fullName: true, email: true, phone: true } },
  universitySupervisor: { select: { id: true, fullName: true, email: true, phone: true } },
  diaryEntries: { select: { id: true, status: true, entryDate: true, hours: true, planItemId: true } },
  planItems: { orderBy: { orderIndex: 'asc' as const } },
} satisfies Prisma.InternshipInclude;

type InternshipWithRelations = Prisma.InternshipGetPayload<{ include: typeof listInclude }>;

function formatInternship(item: InternshipWithRelations) {
  const totalDays = countWorkingDays(item.startDate, item.endDate);
  const submitted = item.diaryEntries.filter((d) => d.status === 'SUBMITTED').length;
  const approved = item.diaryEntries.filter((d) => d.status === 'APPROVED').length;
  const approvedHours = item.diaryEntries.filter((d) => d.status === 'APPROVED').reduce((s, d) => s + Number(d.hours), 0);
  const plannedHours = item.planItems.reduce((s, p) => s + Number(p.plannedHours), 0);
  const group = item.student.studentProfile?.group;

  return {
    id: item.id,
    studentId: item.student.id,
    studentName: item.student.fullName,
    studentEmail: item.student.email,
    groupId: group?.id ?? null,
    groupName: group?.name ?? null,
    companyId: item.company.id,
    company: item.company.name,
    position: item.position || 'Amaliyotchi',
    address: item.company.address,
    companyPhone: item.company.contactPhone,
    startDate: ymd(item.startDate),
    endDate: ymd(item.endDate),
    companySupervisorId: item.companySupervisor?.id ?? null,
    companySupervisorName: item.companySupervisor?.fullName ?? null,
    companySupervisorEmail: item.companySupervisor?.email ?? null,
    companySupervisorPhone: item.companySupervisor?.phone ?? null,
    universitySupervisorId: item.universitySupervisor?.id ?? null,
    universitySupervisorName: item.universitySupervisor?.fullName ?? null,
    universitySupervisorEmail: item.universitySupervisor?.email ?? null,
    universitySupervisorPhone: item.universitySupervisor?.phone ?? null,
    // Backward-compatible fields
    supervisorId: item.companySupervisor?.id || item.universitySupervisor?.id || '',
    supervisorName: item.companySupervisor?.fullName || item.universitySupervisor?.fullName || 'Belgilanmagan',
    status: item.status.toLowerCase(),
    totalDays,
    submittedEntries: submitted,
    approvedEntries: approved,
    pendingEntries: submitted,
    totalEntries: item.diaryEntries.length,
    approvedHours,
    plannedHours,
    planItemCount: item.planItems.length,
    description: item.programDescription || item.company.description || '',
    programDescription: item.programDescription,
    department: group?.studyProgram || '',
  };
}

/** GET /api/internships — role scoped list */
router.get('/', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const where: Prisma.InternshipWhereInput = { ...internshipScope(req.user!) };
    const { status, groupId } = req.query;
    if (typeof status === 'string' && status && status !== 'all') {
      where.status = status.toUpperCase() as any;
    }
    if (typeof groupId === 'string' && groupId && groupId !== 'all') {
      where.student = { studentProfile: { groupId } };
    }
    const internships = await prisma.internship.findMany({
      where,
      include: listInclude,
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data: internships.map(formatInternship) });
  } catch (error) {
    next(error);
  }
});

/** GET /api/internships/mine — the current student's active (or latest) internship */
router.get('/mine', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const where = internshipScope(req.user!);
    const active = await prisma.internship.findFirst({ where: { ...where, status: 'ACTIVE' }, orderBy: { startDate: 'desc' } });
    const item = active ?? (await prisma.internship.findFirst({ where, orderBy: { startDate: 'desc' } }));
    res.json({ success: true, data: item ? { id: item.id } : null });
  } catch (error) {
    next(error);
  }
});

/** GET /api/internships/:id — full details + plan with progress */
router.get('/:id', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = req.user!;
    const item = await prisma.internship.findUnique({ where: { id: req.params.id }, include: listInclude });
    if (!item) {
      fail(res, 404, 'Amaliyot dasturi topilmadi');
      return;
    }
    if (!canAccess(user, item)) {
      fail(res, 403, user.role === 'STUDENT' ? 'Bu amaliyot sizga tegishli emas' : 'Ushbu amaliyot sizga biriktirilmagan');
      return;
    }

    const isSupervisor = user.role === 'COMPANY_SUPERVISOR' || user.role === 'UNIVERSITY_SUPERVISOR';
    const entries = await prisma.diaryEntry.findMany({
      where: {
        internshipId: item.id,
        ...(isSupervisor ? { status: { in: ['SUBMITTED', 'APPROVED'] } } : {}),
      },
      orderBy: { entryDate: 'desc' },
    });

    const attendance = await prisma.attendance.groupBy({
      by: ['status'],
      where: { internshipId: item.id },
      _count: { _all: true },
    });
    const attendanceCounts = { PRESENT: 0, ABSENT: 0, LATE: 0, EXCUSED: 0 } as Record<string, number>;
    attendance.forEach((a) => (attendanceCounts[a.status] = a._count._all));
    const attendanceTotal = Object.values(attendanceCounts).reduce((a, b) => a + b, 0);

    const plan = item.planItems.map((p) => {
      const linked = item.diaryEntries.filter((d) => d.planItemId === p.id);
      const doneHours = linked.filter((d) => d.status === 'APPROVED').reduce((s, d) => s + Number(d.hours), 0);
      const planned = Number(p.plannedHours);
      return {
        id: p.id,
        orderIndex: p.orderIndex,
        title: p.title,
        description: p.description,
        plannedHours: planned,
        doneHours,
        entryCount: linked.length,
        progress: planned > 0 ? Math.min(100, Math.round((doneHours / planned) * 100)) : 0,
      };
    });
    const plannedTotal = plan.reduce((s, p) => s + p.plannedHours, 0);
    const doneTotal = plan.reduce((s, p) => s + Math.min(p.doneHours, p.plannedHours), 0);

    res.json({
      success: true,
      data: {
        ...formatInternship(item),
        canEditPlan: canEditPlan(user, item),
        plan,
        planProgress: plannedTotal > 0 ? Math.round((doneTotal / plannedTotal) * 100) : null,
        attendance: {
          ...attendanceCounts,
          total: attendanceTotal,
          rate: attendanceTotal > 0 ? Math.round(((attendanceCounts.PRESENT + attendanceCounts.LATE) / attendanceTotal) * 100) : null,
        },
        entries: entries.map((e) => ({
          id: e.id,
          date: ymd(e.entryDate),
          title: e.taskTitle,
          hours: Number(e.hours),
          status: e.status.toLowerCase(),
          planItemId: e.planItemId,
        })),
      },
    });
  } catch (error) {
    next(error);
  }
});

/** POST /api/internships — ADMIN creates an internship (assigns student → company → supervisors) */
router.post('/', authenticate, authorize('ADMIN'), async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const d = internshipSchema.parse(req.body);
    const err = await validateParticipants(d);
    if (err) {
      fail(res, 400, err);
      return;
    }
    if (d.status === 'ACTIVE') {
      const overlapping = await prisma.internship.findFirst({
        where: { studentId: d.studentId, status: 'ACTIVE' },
      });
      if (overlapping) {
        fail(res, 400, "Bu talabaning allaqachon faol amaliyoti bor. Avval uni yakunlang yoki holatini o'zgartiring.");
        return;
      }
    }
    const created = await prisma.internship.create({
      data: {
        studentId: d.studentId,
        companyId: d.companyId,
        companySupervisorId: d.companySupervisorId || null,
        universitySupervisorId: d.universitySupervisorId || null,
        startDate: parseYmd(d.startDate),
        endDate: parseYmd(d.endDate),
        status: d.status,
        position: d.position || null,
        programDescription: d.programDescription || null,
      },
    });
    res.status(201).json({ success: true, data: { id: created.id } });
  } catch (error) {
    next(error);
  }
});

/** PATCH /api/internships/:id — ADMIN edits */
router.patch('/:id', authenticate, authorize('ADMIN'), async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const existing = await prisma.internship.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      fail(res, 404, 'Amaliyot topilmadi');
      return;
    }
    const merged = internshipSchema.parse({
      studentId: existing.studentId,
      companyId: existing.companyId,
      companySupervisorId: existing.companySupervisorId,
      universitySupervisorId: existing.universitySupervisorId,
      startDate: ymd(existing.startDate),
      endDate: ymd(existing.endDate),
      status: existing.status,
      position: existing.position,
      programDescription: existing.programDescription,
      ...req.body,
    });
    const err = await validateParticipants(merged);
    if (err) {
      fail(res, 400, err);
      return;
    }
    if (merged.status === 'ACTIVE') {
      const other = await prisma.internship.findFirst({
        where: { studentId: merged.studentId, status: 'ACTIVE', id: { not: existing.id } },
      });
      if (other) {
        fail(res, 400, 'Bu talabaning boshqa faol amaliyoti mavjud.');
        return;
      }
    }
    await prisma.internship.update({
      where: { id: existing.id },
      data: {
        studentId: merged.studentId,
        companyId: merged.companyId,
        companySupervisorId: merged.companySupervisorId || null,
        universitySupervisorId: merged.universitySupervisorId || null,
        startDate: parseYmd(merged.startDate),
        endDate: parseYmd(merged.endDate),
        status: merged.status,
        position: merged.position || null,
        programDescription: merged.programDescription || null,
      },
    });
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

/** DELETE /api/internships/:id — only empty internships (no diary/attendance/evaluations) */
router.delete('/:id', authenticate, authorize('ADMIN'), async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = req.params.id;
    const [entries, att, evals] = await Promise.all([
      prisma.diaryEntry.count({ where: { internshipId: id } }),
      prisma.attendance.count({ where: { internshipId: id } }),
      prisma.finalEvaluation.count({ where: { internshipId: id } }),
    ]);
    if (entries + att + evals > 0) {
      fail(res, 400, "Bu amaliyotda kundalik, davomat yoki baholash yozuvlari bor. O'chirish o'rniga holatini \"Bekor qilingan\" qiling.");
      return;
    }
    await prisma.internship.delete({ where: { id } });
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// ── Internship plan (programme) ──────────────────────────────────────────────

async function loadForPlan(req: AuthenticatedRequest, res: Response) {
  const item = await prisma.internship.findUnique({ where: { id: req.params.id } });
  if (!item) {
    fail(res, 404, 'Amaliyot topilmadi');
    return null;
  }
  if (!canEditPlan(req.user!, item)) {
    fail(res, 403, "Amaliyot rejasini faqat administrator yoki biriktirilgan rahbar o'zgartira oladi");
    return null;
  }
  return item;
}

/** GET /api/internships/:id/plan */
router.get('/:id/plan', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const item = await prisma.internship.findUnique({ where: { id: req.params.id } });
    if (!item || !canAccess(req.user!, item)) {
      fail(res, item ? 403 : 404, item ? "Ruxsat yo'q" : 'Amaliyot topilmadi');
      return;
    }
    const items = await prisma.internshipPlanItem.findMany({
      where: { internshipId: item.id },
      orderBy: { orderIndex: 'asc' },
    });
    res.json({
      success: true,
      data: items.map((p) => ({ id: p.id, orderIndex: p.orderIndex, title: p.title, description: p.description, plannedHours: Number(p.plannedHours) })),
    });
  } catch (error) {
    next(error);
  }
});

/** POST /api/internships/:id/plan */
router.post('/:id/plan', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const item = await loadForPlan(req, res);
    if (!item) return;
    const d = planItemSchema.parse(req.body);
    const max = await prisma.internshipPlanItem.aggregate({ where: { internshipId: item.id }, _max: { orderIndex: true } });
    const created = await prisma.internshipPlanItem.create({
      data: {
        internshipId: item.id,
        title: d.title,
        description: d.description || null,
        plannedHours: d.plannedHours,
        orderIndex: d.orderIndex ?? (max._max.orderIndex ?? -1) + 1,
      },
    });
    res.status(201).json({ success: true, data: created });
  } catch (error) {
    next(error);
  }
});

/** PATCH /api/internships/:id/plan/:itemId */
router.patch('/:id/plan/:itemId', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const item = await loadForPlan(req, res);
    if (!item) return;
    const planItem = await prisma.internshipPlanItem.findUnique({ where: { id: req.params.itemId } });
    if (!planItem || planItem.internshipId !== item.id) {
      fail(res, 404, 'Reja bandi topilmadi');
      return;
    }
    const d = planItemSchema.partial().parse(req.body);
    const updated = await prisma.internshipPlanItem.update({ where: { id: planItem.id }, data: d });
    res.json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
});

/** DELETE /api/internships/:id/plan/:itemId — linked diary entries are kept (link set to null) */
router.delete('/:id/plan/:itemId', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const item = await loadForPlan(req, res);
    if (!item) return;
    const planItem = await prisma.internshipPlanItem.findUnique({ where: { id: req.params.itemId } });
    if (!planItem || planItem.internshipId !== item.id) {
      fail(res, 404, 'Reja bandi topilmadi');
      return;
    }
    await prisma.internshipPlanItem.delete({ where: { id: planItem.id } });
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

export default router;
