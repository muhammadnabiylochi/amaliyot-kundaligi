import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { prisma } from '../lib/prisma';
import { UserRole } from '@prisma/client';

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  isActive: boolean;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
}

interface JwtPayload {
  userId: string;
  role: UserRole;
  iat?: number;
  exp?: number;
}

/**
 * Generates a signed JWT token for an authenticated user
 */
export function generateToken(user: { id: string; role: UserRole }): string {
  return jwt.sign(
    { userId: user.id, role: user.role },
    env.JWT_SECRET,
    { expiresIn: env.JWT_EXPIRES_IN } as jwt.SignOptions
  );
}

/**
 * Authentication Middleware: verifies Bearer token or HttpOnly auth_token cookie
 */
export async function authenticate(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    let token: string | undefined;

    // 1. Check Authorization Bearer header
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    }
    // 2. Check HttpOnly cookie
    else if (req.cookies && req.cookies['auth_token']) {
      token = req.cookies['auth_token'];
    }

    if (!token) {
      res.status(401).json({
        error: {
          message: "Autentifikatsiyadan o'tilmagan. Iltimos tizimga kiring.",
          status: 401,
        },
      });
      return;
    }

    // Verify token
    let decoded: JwtPayload;
    try {
      decoded = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
    } catch (jwtErr: any) {
      if (jwtErr.name === 'TokenExpiredError') {
        res.status(401).json({
          error: {
            message: "Sessiya muddati tugagan. Qaytadan tizimga kiring.",
            code: 'TOKEN_EXPIRED',
            status: 401,
          },
        });
        return;
      }
      res.status(401).json({
        error: {
          message: "Yaroqsiz autentifikatsiya tokeni.",
          status: 401,
        },
      });
      return;
    }

    // Fetch user from DB to verify user exists and is active
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        isActive: true,
      },
    });

    if (!user) {
      res.status(401).json({
        error: {
          message: "Foydalanuvchi hisobi topilmadi.",
          status: 401,
        },
      });
      return;
    }

    if (!user.isActive) {
      res.status(403).json({
        error: {
          message: "Ushbu foydalanuvchi hisobi bloklangan. Administratorga murojaat qiling.",
          code: 'USER_INACTIVE',
          status: 403,
        },
      });
      return;
    }

    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Role-Based Authorization Middleware: restricts route to specific roles
 */
export function authorize(...allowedRoles: UserRole[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        error: { message: "Autentifikatsiyadan o'tilmagan.", status: 401 },
      });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        error: {
          message: "Ushbu amalni bajarish uchun sizda yetarli huquqlar yo'q.",
          status: 403,
        },
      });
      return;
    }

    next();
  };
}
