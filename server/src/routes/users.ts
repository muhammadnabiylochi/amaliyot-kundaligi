import { Router, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { authenticate, authorize, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

const createUserSchema = z.object({
  fullName: z.string().min(3, "To'liq ism kiritilishi shart"),
  email: z.string().email("To'g'ri elektron pochta manzilini kiriting").toLowerCase(),
  role: z.enum(['ADMIN', 'STUDENT', 'COMPANY_SUPERVISOR', 'UNIVERSITY_SUPERVISOR']),
  department: z.string().optional(),
  group: z.string().optional(),
  phone: z.string().optional(),
});

/**
 * GET /api/users
 * Only ADMIN or SUPERVISORS can view users
 */
router.get('/', authenticate, authorize('ADMIN', 'COMPANY_SUPERVISOR', 'UNIVERSITY_SUPERVISOR'), async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { role, search } = req.query;
    const whereClause: any = {};

    if (role && typeof role === 'string' && role !== 'all') {
      const roleMap: Record<string, UserRole> = {
        admin: 'ADMIN',
        student: 'STUDENT',
        supervisor: 'COMPANY_SUPERVISOR',
      };
      whereClause.role = roleMap[role.toLowerCase()] || role.toUpperCase();
    }

    if (search && typeof search === 'string') {
      whereClause.OR = [
        { fullName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    const users = await prisma.user.findMany({
      where: whereClause,
      include: {
        studentProfile: {
          include: { group: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const formatted = users.map((u) => {
      let roleLower: 'admin' | 'student' | 'supervisor' = 'student';
      if (u.role === 'ADMIN') roleLower = 'admin';
      else if (u.role === 'COMPANY_SUPERVISOR' || u.role === 'UNIVERSITY_SUPERVISOR') roleLower = 'supervisor';

      return {
        id: u.id,
        name: u.fullName,
        email: u.email,
        role: roleLower,
        department: u.studentProfile?.group?.faculty || 'Boshqaruv',
        group: u.studentProfile?.group?.name,
        phone: u.studentProfile?.phone || '+998 90 000-00-00',
        status: u.isActive ? 'active' : 'inactive',
        createdAt: u.createdAt.toISOString().split('T')[0],
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
 * POST /api/users
 * Only ADMIN can create users
 */
router.post('/', authenticate, authorize('ADMIN'), async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const validated = createUserSchema.parse(req.body);

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash('TempPass2026!', salt);

    const user = await prisma.user.create({
      data: {
        fullName: validated.fullName,
        email: validated.email,
        passwordHash,
        role: validated.role,
        isActive: true,
      },
    });

    res.status(201).json({
      success: true,
      data: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/users/:id/toggle-status
 * Only ADMIN can toggle user status
 */
router.patch('/:id/toggle-status', authenticate, authorize('ADMIN'), async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!user) {
      res.status(404).json({ error: { message: "Foydalanuvchi topilmadi", status: 404 } });
      return;
    }

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { isActive: !user.isActive },
    });

    res.json({
      success: true,
      data: { id: updated.id, isActive: updated.isActive },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
