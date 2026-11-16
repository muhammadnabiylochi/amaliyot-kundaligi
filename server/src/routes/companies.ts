import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticate, authorize, AuthenticatedRequest } from '../middleware/auth';
import { fail } from '../lib/http';

const router = Router();

const companySchema = z.object({
  name: z.string().trim().min(2, "Korxona nomi kamida 2 belgidan iborat bo'lishi kerak"),
  address: z.string().trim().min(3, 'Manzil kiritilishi shart'),
  contactPhone: z.string().trim().optional().nullable(),
  description: z.string().trim().optional().nullable(),
});

/** GET /api/companies — list with internship counts */
router.get('/', authenticate, authorize('ADMIN', 'COMPANY_SUPERVISOR', 'UNIVERSITY_SUPERVISOR'), async (_req, res: Response, next: NextFunction) => {
  try {
    const companies = await prisma.company.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { internships: true } } },
    });
    res.json({
      success: true,
      data: companies.map((c) => ({
        id: c.id,
        name: c.name,
        address: c.address,
        contactPhone: c.contactPhone,
        description: c.description,
        internshipCount: c._count.internships,
        createdAt: c.createdAt.toISOString(),
      })),
    });
  } catch (e) {
    next(e);
  }
});

/** POST /api/companies */
router.post('/', authenticate, authorize('ADMIN'), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const data = companySchema.parse(req.body);
    const company = await prisma.company.create({ data });
    res.status(201).json({ success: true, data: company });
  } catch (e) {
    next(e);
  }
});

/** PATCH /api/companies/:id */
router.patch('/:id', authenticate, authorize('ADMIN'), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const data = companySchema.partial().parse(req.body);
    const company = await prisma.company.update({ where: { id: req.params.id }, data });
    res.json({ success: true, data: company });
  } catch (e) {
    next(e);
  }
});

/** DELETE /api/companies/:id — only when no internships reference it */
router.delete('/:id', authenticate, authorize('ADMIN'), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const used = await prisma.internship.count({ where: { companyId: req.params.id } });
    if (used > 0) {
      fail(res, 400, `Bu korxonaga ${used} ta amaliyot biriktirilgan. Avval amaliyotlarni boshqa korxonaga o'tkazing.`);
      return;
    }
    await prisma.company.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (e) {
    next(e);
  }
});

export default router;
