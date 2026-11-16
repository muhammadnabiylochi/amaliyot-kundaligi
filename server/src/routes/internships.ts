import { Router, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

/**
 * GET /api/internships
 * Scope:
 * - STUDENT: only their own internship
 * - SUPERVISOR: only internships assigned to them
 * - ADMIN: all internships
 */
router.get('/', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = req.user!;
    const whereClause: any = {};

    if (user.role === 'STUDENT') {
      whereClause.studentId = user.id;
    } else if (user.role === 'COMPANY_SUPERVISOR') {
      whereClause.companySupervisorId = user.id;
    } else if (user.role === 'UNIVERSITY_SUPERVISOR') {
      whereClause.universitySupervisorId = user.id;
    }

    const internships = await prisma.internship.findMany({
      where: whereClause,
      include: {
        student: { select: { id: true, fullName: true, email: true } },
        company: true,
        companySupervisor: { select: { id: true, fullName: true, email: true } },
        universitySupervisor: { select: { id: true, fullName: true, email: true } },
        diaryEntries: {
          select: { id: true, status: true, entryDate: true, hours: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const formatted = internships.map((item) => {
      const start = new Date(item.startDate);
      const end = new Date(item.endDate);
      const diffTime = Math.abs(end.getTime() - start.getTime());
      const totalDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 60;

      const submitted = item.diaryEntries.filter((d) => d.status === 'SUBMITTED').length;
      const approved = item.diaryEntries.filter((d) => d.status === 'APPROVED').length;

      return {
        id: item.id,
        studentId: item.student.id,
        studentName: item.student.fullName,
        company: item.company.name,
        position: 'Amaliyotchi talaba',
        address: item.company.address,
        startDate: item.startDate.toISOString().split('T')[0],
        endDate: item.endDate.toISOString().split('T')[0],
        supervisorId: item.companySupervisor?.id || item.universitySupervisor?.id || '',
        supervisorName: item.companySupervisor?.fullName || item.universitySupervisor?.fullName || 'Belgilanmagan',
        status: item.status.toLowerCase(),
        totalDays: Math.min(totalDays, 90),
        submittedEntries: submitted,
        approvedEntries: approved,
        pendingEntries: submitted,
        description: item.company.description || 'Amaliyot dasturi',
        department: 'Dasturiy injiniring',
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
 * GET /api/internships/:id
 */
router.get('/:id', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = req.user!;
    const item = await prisma.internship.findUnique({
      where: { id: req.params.id },
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
        company: true,
        companySupervisor: { select: { id: true, fullName: true, email: true } },
        universitySupervisor: { select: { id: true, fullName: true, email: true } },
        diaryEntries: {
          orderBy: { entryDate: 'desc' },
        },
      },
    });

    if (!item) {
      res.status(404).json({ error: { message: "Amaliyot dasturi topilmadi", status: 404 } });
      return;
    }

    // Role check
    if (user.role === 'STUDENT' && item.studentId !== user.id) {
      res.status(403).json({ error: { message: "Bu amaliyot sizga tegishli emas", status: 403 } });
      return;
    }
    if (
      user.role === 'COMPANY_SUPERVISOR' &&
      item.companySupervisorId !== user.id
    ) {
      res.status(403).json({ error: { message: "Ushbu amaliyot sizga biriktirilmagan", status: 403 } });
      return;
    }
    if (
      user.role === 'UNIVERSITY_SUPERVISOR' &&
      item.universitySupervisorId !== user.id
    ) {
      res.status(403).json({ error: { message: "Ushbu amaliyot sizga biriktirilmagan", status: 403 } });
      return;
    }

    const submitted = item.diaryEntries.filter((d) => d.status === 'SUBMITTED').length;
    const approved = item.diaryEntries.filter((d) => d.status === 'APPROVED').length;

    res.json({
      success: true,
      data: {
        id: item.id,
        studentId: item.student.id,
        studentName: item.student.fullName,
        company: item.company.name,
        position: 'Amaliyotchi talaba',
        address: item.company.address,
        startDate: item.startDate.toISOString().split('T')[0],
        endDate: item.endDate.toISOString().split('T')[0],
        supervisorId: item.companySupervisor?.id || item.universitySupervisor?.id || '',
        supervisorName: item.companySupervisor?.fullName || item.universitySupervisor?.fullName || 'Belgilanmagan',
        supervisorEmail: item.companySupervisor?.email || item.universitySupervisor?.email,
        status: item.status.toLowerCase(),
        totalDays: 60,
        submittedEntries: submitted,
        approvedEntries: approved,
        pendingEntries: submitted,
        description: item.company.description || "Talabaning kasbiy ko'nikmalarini oshirish amaliyoti",
        department: item.student.studentProfile?.group.studyProgram || 'Axborot texnologiyalari',
        entries: item.diaryEntries.map((e) => ({
          id: e.id,
          date: e.entryDate.toISOString().split('T')[0],
          title: e.taskTitle,
          hours: Number(e.hours),
          status: e.status.toLowerCase(),
        })),
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
