import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';

export interface ApiError extends Error {
  statusCode?: number;
  status?: number;
}

export function errorHandler(
  err: any,
  _req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
): void {
  let statusCode = err.statusCode || err.status || 500;
  let message = err.message || 'Internal Server Error';

  // 1. Zod Validation Error
  if (err instanceof ZodError) {
    statusCode = 400;
    message = err.errors.map((e) => e.message).join(', ');
  }
  // 2. Prisma Known Request Errors
  else if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      statusCode = 400;
      message = "Ushbu sana uchun allaqachon kundalik yozuvi mavjud. Bir kunga faqat bitta yozuv kiritish mumkin.";
    } else if (err.code === 'P2025') {
      statusCode = 404;
      message = "So'ralgan ma'lumot topilmadi.";
    } else {
      statusCode = 400;
      message = `Ma'lumotlar bazasida xatolik yuz berdi (${err.code}).`;
    }
  }

  // Diagnostics logging on the server console (without leaking secrets to client)
  console.error(`[${new Date().toISOString()}] [API ERROR] status: ${statusCode}, message: ${message}`);
  if (statusCode === 500) {
    console.error(err);
  }

  res.status(statusCode).json({
    error: {
      message,
      status: statusCode,
      timestamp: new Date().toISOString(),
    },
  });
}
