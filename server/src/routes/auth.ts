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
        phone: user.studentProfile?.phone,
        createdAt: user.createdAt.toISOString(),
      },
    });
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
