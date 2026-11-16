import { Router, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { AttendanceStatus } from '@prisma/client';
import { z } from 'zod';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';
import { notifyAttendanceRecorded } from '../services/notificationService';

const router = Router();

const recordAttendanceSchema = z.object({
  internshipId: z.string().min(1, "Amaliyot dasturi talab qilinadi"),
  attendanceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Sana YYYY-MM-DD formatida bo'lishi kerak"),
  status: z.enum(['PRESENT', 'ABSENT', 'LATE', 'EXCUSED']),
  hours: z.number().min(0).max(24).default(8.0),
  note: z.string().max(500, "Izoh 500 belgidan oshmasligi kerak").optional().nullable(),
});

/**
 * GET /api/attendance
 * List attendance records with filtering:
 * - month (YYYY-MM)
 * - internshipId
 * - studentId
 * - status
 *
 * RBAC Scope:
 * - STUDENT: sees ONLY their own attendance.
 * - COMPANY_SUPERVISOR: sees attendance for assigned internships.
 * - UNIVERSITY_SUPERVISOR: sees attendance for assigned internships.
 * - ADMIN: sees all.
 */
router.get('/', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = req.user!;
    const { month, internshipId, studentId, status } = req.query;

    const whereClause: any = {};

    // ── ROLE SCOPING ──
    if (user.role === 'STUDENT') {
      whereClause.internship = { studentId: user.id };
    } else if (user.role === 'COMPANY_SUPERVISOR') {
      whereClause.internship = { companySupervisorId: user.id };
    } else if (user.role === 'UNIVERSITY_SUPERVISOR') {
      whereClause.internship = { universitySupervisorId: user.id };
    }

    if (internshipId && typeof internshipId === 'string' && internshipId !== 'all') {
      whereClause.internshipId = internshipId;
    }

    if (studentId && typeof studentId === 'string' && studentId !== 'all') {
      whereClause.internship = {
        ...(whereClause.internship || {}),
        studentId: studentId,
      };
    }

    if (status && typeof status === 'string' && status !== 'all') {
      whereClause.status = status.toUpperCase() as AttendanceStatus;
    }

    // Month filter (e.g., '2026-10')
    if (month && typeof month === 'string' && /^\d{4}-\d{2}$/.test(month)) {
      const [yearStr, monthStr] = month.split('-');
      const year = parseInt(yearStr, 10);
      const m = parseInt(monthStr, 10);
      const startOfMonth = new Date(Date.UTC(year, m - 1, 1));
      const endOfMonth = new Date(Date.UTC(year, m, 0, 23, 59, 59, 999));

      whereClause.attendanceDate = {
        gte: startOfMonth,
        lte: endOfMonth,
      };
    }

    const records = await prisma.attendance.findMany({
      where: whereClause,
      orderBy: { attendanceDate: 'desc' },
      include: {
        internship: {
          include: {
            student: {
              select: {
                id: true,
                fullName: true,
                email: true,
                studentProfile: {
                  include: { group: true },
                },
              },
            },
            company: {
              select: { id: true, name: true },
            },
          },
        },
      },
    });

    const formatted = records.map((r) => ({
      id: r.id,
      internshipId: r.internshipId,
      studentId: r.internship.student.id,
      studentName: r.internship.student.fullName,
      studentEmail: r.internship.student.email,
      studentGroup: r.internship.student.studentProfile?.group?.name || '—',
      company: r.internship.company.name,
      date: r.attendanceDate.toISOString().split('T')[0],
      status: r.status,
      hours: Number(r.hours),
      note: r.note || '',
      createdAt: r.createdAt.toISOString(),
    }));

    res.json({
      success: true,
      data: formatted,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/attendance/stats
 * Aggregates summary counts:
 * - totalDays, presentDays, absentDays, lateDays, excusedDays, totalHours
 */
router.get('/stats', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = req.user!;
    const { month, internshipId } = req.query;

    const whereClause: any = {};

    if (user.role === 'STUDENT') {
      whereClause.internship = { studentId: user.id };
    } else if (user.role === 'COMPANY_SUPERVISOR') {
      whereClause.internship = { companySupervisorId: user.id };
    } else if (user.role === 'UNIVERSITY_SUPERVISOR') {
      whereClause.internship = { universitySupervisorId: user.id };
    }

    if (internshipId && typeof internshipId === 'string' && internshipId !== 'all') {
      whereClause.internshipId = internshipId;
    }

    if (month && typeof month === 'string' && /^\d{4}-\d{2}$/.test(month)) {
      const [yearStr, monthStr] = month.split('-');
      const year = parseInt(yearStr, 10);
      const m = parseInt(monthStr, 10);
      whereClause.attendanceDate = {
        gte: new Date(Date.UTC(year, m - 1, 1)),
        lte: new Date(Date.UTC(year, m, 0, 23, 59, 59, 999)),
      };
    }

    const [
      totalCount,
      presentCount,
      absentCount,
      lateCount,
      excusedCount,
      hoursAgg,
    ] = await Promise.all([
      prisma.attendance.count({ where: whereClause }),
      prisma.attendance.count({ where: { ...whereClause, status: 'PRESENT' } }),
      prisma.attendance.count({ where: { ...whereClause, status: 'ABSENT' } }),
      prisma.attendance.count({ where: { ...whereClause, status: 'LATE' } }),
      prisma.attendance.count({ where: { ...whereClause, status: 'EXCUSED' } }),
      prisma.attendance.aggregate({
        _sum: { hours: true },
        where: whereClause,
      }),
    ]);

    res.json({
      success: true,
      data: {
        totalDays: totalCount,
        presentDays: presentCount,
        absentDays: absentCount,
        lateDays: lateCount,
        excusedDays: excusedCount,
        totalHours: Number(hoursAgg._sum.hours || 0),
        attendanceRate: totalCount > 0 ? Math.round(((presentCount + lateCount) / totalCount) * 100) : 100,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/attendance
 * Records or updates attendance for a date.
 * Permission:
 * - COMPANY_SUPERVISOR: only for their assigned internships.
 * - ADMIN: any internship.
 * - STUDENT & UNIVERSITY_SUPERVISOR: FORBIDDEN (read-only).
 */
router.post('/', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = req.user!;

    // 1. Permission check: Students and University Supervisors cannot mark attendance!
    if (user.role === 'STUDENT') {
      res.status(403).json({
        error: { message: "Talabalar davomatni mustaqil belgilash huquqiga ega emas.", status: 403 },
      });
      return;
    }

    if (user.role === 'UNIVERSITY_SUPERVISOR') {
      res.status(403).json({
        error: { message: "Ta'lim muassasasi rahbari davomatni faqat kuzatishi mumkin, qayd etish korxona rahbari tomonidan bajariladi.", status: 403 },
      });
      return;
    }

    const validated = recordAttendanceSchema.parse(req.body);

    // 2. Verify internship exists and check supervisor assignment
    const internship = await prisma.internship.findUnique({
      where: { id: validated.internshipId },
    });

    if (!internship) {
      res.status(404).json({ error: { message: "Amaliyot dasturi topilmadi", status: 404 } });
      return;
    }

    if (user.role === 'COMPANY_SUPERVISOR' && internship.companySupervisorId !== user.id) {
      res.status(403).json({
        error: { message: "Ushbu amaliyot sizning korxonangizga yoki sizga biriktirilmagan", status: 403 },
      });
      return;
    }

    const dateObj = new Date(validated.attendanceDate);
    if (isNaN(dateObj.getTime())) {
      res.status(400).json({ error: { message: "Noto'g'ri sana kiritildi", status: 400 } });
      return;
    }

    // 3. Upsert attendance record (prevent duplicates per internship & date)
    const record = await prisma.attendance.upsert({
      where: {
        internshipId_attendanceDate: {
          internshipId: validated.internshipId,
          attendanceDate: dateObj,
        },
      },
      update: {
        status: validated.status as AttendanceStatus,
        hours: validated.hours,
        note: validated.note || null,
      },
      create: {
        internshipId: validated.internshipId,
        attendanceDate: dateObj,
        status: validated.status as AttendanceStatus,
        hours: validated.hours,
        note: validated.note || null,
      },
    });

    // Notify student about recorded attendance
    void notifyAttendanceRecorded(record.id);

    res.status(200).json({
      success: true,
      data: {
        id: record.id,
        internshipId: record.internshipId,
        date: record.attendanceDate.toISOString().split('T')[0],
        status: record.status,
        hours: Number(record.hours),
        note: record.note,
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
