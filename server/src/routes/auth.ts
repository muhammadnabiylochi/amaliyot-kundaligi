import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { prisma } from '../lib/prisma';
import { generateToken, authenticate, AuthenticatedRequest } from '../middleware/auth';
import { env } from '../config/env';

const router = Router();

// Rate limiter for brute-force protection: max 10 attempts per 15 minutes per IP
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      message: "Juda ko'p muvaffaqiyatsiz urinishlar. Iltimos, 15 daqiqadan so'ng qayta urinib ko'ring.",
      status: 429,
    },
  },
});

const loginSchema = z.object({
  email: z.string().email("To'g'ri elektron pochta manzilini kiriting").trim().toLowerCase(),
  password: z.string().min(1, 'Parol kiritilishi shart'),
});

/**
 * POST /api/auth/login
 * Authenticates user via email and password using bcrypt.
 * Sets HttpOnly cookie AND returns token + sanitized user in body.
 */
router.post('/login', loginLimiter, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const parseResult = loginSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        error: {
          message: parseResult.error.errors[0]?.message || "Noto'g'ri ma'lumotlar",
          status: 400,
        },
      });
      return;
    }

    const { email, password } = parseResult.data;

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        studentProfile: {
          include: { group: true },
        },
      },
    });

    // Check user exists
    if (!user) {
      res.status(401).json({
        error: {
          message: "Elektron pochta yoki parol noto'g'ri.",
          status: 401,
        },
      });
      return;
    }

    // Verify bcrypt password hash (never compare plain text!)
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      res.status(401).json({
        error: {
          message: "Elektron pochta yoki parol noto'g'ri.",
          status: 401,
        },
      });
      return;
    }

    // Check if account is active
    if (!user.isActive) {
      res.status(403).json({
        error: {
          message: "Ushbu hisob nofaol yoki bloklangan. Administratorga murojaat qiling.",
          code: 'USER_INACTIVE',
          status: 403,
        },
      });
      return;
    }

    // Generate JWT access token
    const token = generateToken({ id: user.id, role: user.role });

    // Set HttpOnly cookie for security (SameSite=lax, Secure in production)
    const isProduction = env.NODE_ENV === 'production';
    res.cookie('auth_token', token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: '/',
    });

    // Return sanitized user details (NO password, NO hash!)
    res.json({
      success: true,
      message: "Tizimga muvaffaqiyatli kirildi.",
      data: {
        token,
        user: {
          id: user.id,
          fullName: user.fullName,
          email: user.email,
          role: user.role,
          isActive: user.isActive,
          department: user.studentProfile?.group?.faculty || 'Boshqaruv',
          group: user.studentProfile?.group?.name,
          studentNumber: user.studentProfile?.studentNumber,
          mustChangePassword: user.mustChangePassword,
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/auth/me
 * Returns current authenticated user and profile information
 */
router.get('/me', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: { message: "Autentifikatsiyadan o'tilmagan", status: 401 } });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
        phone: true,
        position: true,
        mustChangePassword: true,
        studentProfile: {
          select: {
            studentNumber: true,
            phone: true,
            group: {
              select: {
                id: true,
                name: true,
                faculty: true,
                studyProgram: true,
              },
            },
          },
        },
      },
    });

    if (!user) {
      res.status(404).json({ error: { message: "Foydalanuvchi topilmadi", status: 404 } });
      return;
    }

    res.json({
      success: true,
      data: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
        department: user.studentProfile?.group?.faculty || 'Boshqaruv',
        group: user.studentProfile?.group?.name,
        studentNumber: user.studentProfile?.studentNumber,
        phone: user.studentProfile?.phone ?? user.phone,
        position: user.position,
        studyProgram: user.studentProfile?.group?.studyProgram,
        mustChangePassword: user.mustChangePassword,
        createdAt: user.createdAt.toISOString(),
      },
    });
  } catch (error) {
    next(error);
  }
});

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Joriy parolni kiriting'),
    newPassword: z
      .string()
      .min(8, "Yangi parol kamida 8 belgidan iborat bo'lishi kerak")
      .regex(/[A-Za-z]/, "Parolda kamida bitta harf bo'lishi kerak")
      .regex(/[0-9]/, "Parolda kamida bitta raqam bo'lishi kerak"),
  })
  .refine((d) => d.currentPassword !== d.newPassword, {
    message: "Yangi parol joriy paroldan farq qilishi kerak",
    path: ['newPassword'],
  });

/**
 * POST /api/auth/change-password
 */
router.post('/change-password', authenticate, loginLimiter, async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const parsed = changePasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: { message: parsed.error.errors[0]?.message || "Noto'g'ri ma'lumotlar", status: 400 } });
      return;
    }
    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!user || !(await bcrypt.compare(parsed.data.currentPassword, user.passwordHash))) {
      res.status(400).json({ error: { message: "Joriy parol noto'g'ri", status: 400 } });
      return;
    }
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await bcrypt.hash(parsed.data.newPassword, 10), mustChangePassword: false },
    });
    res.json({ success: true, message: "Parol muvaffaqiyatli o'zgartirildi" });
  } catch (error) {
    next(error);
  }
});

const profileSchema = z.object({
  phone: z.string().trim().max(30).optional().nullable(),
});

/**
 * PATCH /api/auth/profile — user updates own phone number
 */
router.patch('/profile', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const d = profileSchema.parse(req.body);
    const me = await prisma.user.findUnique({ where: { id: req.user!.id }, include: { studentProfile: true } });
    if (me?.studentProfile) {
      await prisma.studentProfile.update({ where: { userId: me.id }, data: { phone: d.phone || null } });
    } else {
      await prisma.user.update({ where: { id: req.user!.id }, data: { phone: d.phone || null } });
    }
    res.json({ success: true, message: 'Profil yangilandi' });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/auth/logout
 * Clears the HttpOnly auth cookie
 */
router.post('/logout', (_req: Request, res: Response): void => {
  res.clearCookie('auth_token', {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
  });
  res.json({
    success: true,
    message: "Tizimdan muvaffaqiyatli chiqildi.",
  });
});

export default router;
