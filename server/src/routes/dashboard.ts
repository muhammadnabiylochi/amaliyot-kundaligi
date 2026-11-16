import { Router, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';
import { buildAnalytics } from '../lib/stats';
import { internshipScope } from './internships';

const router = Router();

/**
 * GET /api/dashboard/stats
 * Role-scoped live stats
 */
router.get('/stats', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = req.user!;
    let internshipWhere: any = {};
    let diaryWhere: any = {};

    if (user.role === 'STUDENT') {
      internshipWhere = { studentId: user.id };
      diaryWhere = { internship: { studentId: user.id } };
    } else if (user.role === 'COMPANY_SUPERVISOR') {
      internshipWhere = { companySupervisorId: user.id };
      diaryWhere = { internship: { companySupervisorId: user.id } };
    } else if (user.role === 'UNIVERSITY_SUPERVISOR') {
      internshipWhere = { universitySupervisorId: user.id };
      diaryWhere = { internship: { universitySupervisorId: user.id } };
    }

    const [
      activeInternshipsCount,
      submittedEntriesCount,
      approvedEntriesCount,
      pendingReviewsCount,
      totalStudentsCount,
      totalCompaniesCount,
      totalHoursAggregate,
    ] = await Promise.all([
      prisma.internship.count({ where: { ...internshipWhere, status: 'ACTIVE' } }),
      prisma.diaryEntry.count({
        where: { ...diaryWhere, status: { in: ['SUBMITTED', 'APPROVED'] } },
      }),
      prisma.diaryEntry.count({ where: { ...diaryWhere, status: 'APPROVED' } }),
      prisma.diaryEntry.count({ where: { ...diaryWhere, status: 'SUBMITTED' } }),
      prisma.user.count({ where: { role: 'STUDENT', isActive: true } }),
      prisma.company.count(),
      prisma.diaryEntry.aggregate({
        _sum: { hours: true },
        where: { ...diaryWhere, status: 'APPROVED' },
      }),
    ]);

    const totalDays = approvedEntriesCount;

    res.json({
      success: true,
      data: {
        totalDays,
        submittedEntries: submittedEntriesCount,
        approvedEntries: approvedEntriesCount,
        pendingReviews: pendingReviewsCount,
        activeInternships: activeInternshipsCount,
        totalStudents: totalStudentsCount,
        totalCompanies: totalCompaniesCount,
        totalApprovedHours: Number(totalHoursAggregate._sum.hours || 0),
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/dashboard/analytics?weeks=8
 * Role-scoped aggregates for charts (diary status, attendance, weekly dynamics, groups, companies)
 */
router.get('/analytics', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = req.user!;
    const weeks = Math.min(26, Math.max(4, Number(req.query.weeks) || 8));
    const isSupervisor = user.role === 'COMPANY_SUPERVISOR' || user.role === 'UNIVERSITY_SUPERVISOR';
    const data = await buildAnalytics(internshipScope(user), isSupervisor, weeks);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

export default router;
