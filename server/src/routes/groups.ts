import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticate, authorize, AuthenticatedRequest } from '../middleware/auth';
import { fail } from '../lib/http';

const router = Router();

const groupSchema = z.object({
  name: z.string().trim().min(2, "Guruh nomi kamida 2 belgidan iborat bo'lishi kerak"),
  faculty: z.string().trim().min(2, "Bo'lim (yo'nalish) kiritilishi shart"),
  studyProgram: z.string().trim().min(2, 'Mutaxassislik kiritilishi shart'),
});

/** GET /api/groups — list with student counts */
router.get('/', authenticate, authorize('ADMIN', 'COMPANY_SUPERVISOR', 'UNIVERSITY_SUPERVISOR'), async (_req, res: Response, next: NextFunction) => {
  try {
    const groups = await prisma.studentGroup.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { students: true } } },
    });
    res.json({
      success: true,
      data: groups.map((g) => ({
        id: g.id,
        name: g.name,
        faculty: g.faculty,
        studyProgram: g.studyProgram,
        studentCount: g._count.students,
      })),
    });
  } catch (e) {
    next(e);
  }
});

router.post('/', authenticate, authorize('ADMIN'), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const group = await prisma.studentGroup.create({ data: groupSchema.parse(req.body) });
    res.status(201).json({ success: true, data: group });
  } catch (e) {
    next(e);
  }
});

router.patch('/:id', authenticate, authorize('ADMIN'), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const group = await prisma.studentGroup.update({
      where: { id: req.params.id },
      data: groupSchema.partial().parse(req.body),
    });
    res.json({ success: true, data: group });
  } catch (e) {
    next(e);
  }
});

router.delete('/:id', authenticate, authorize('ADMIN'), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const used = await prisma.studentProfile.count({ where: { groupId: req.params.id } });
    if (used > 0) {
      fail(res, 400, `Bu guruhda ${used} nafar talaba bor. Avval talabalarni boshqa guruhga o'tkazing.`);
      return;
    }
    await prisma.studentGroup.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (e) {
    next(e);
  }
});

export default router;
