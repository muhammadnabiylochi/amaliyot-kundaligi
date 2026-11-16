/**
 * Diary Permission Middleware
 *
 * DiaryEntry modeli studentId maydonini bevosita o'z ichiga olmaydi —
 * talaba internship.studentId orqali aniqlanadi.
 */
import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';

/**
 * isStudentOwnerOfEntry
 * — Autentifikatsiya qilingan foydalanuvchi STUDENT ekanini,
 *   kundalik unga tegishli ekanini,
 *   kundalik DRAFT yoki RETURNED holatda ekanini tekshiradi.
 */
export const isStudentOwnerOfEntry = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const user = (req as any).user;
  const userId = user?.id;
  const { entryId } = req.params;

  const entry = await prisma.diaryEntry.findUnique({
    where: { id: entryId },
    include: {
      internship: {
        select: { studentId: true },
      },
    },
  });

  if (!entry) {
    res
      .status(404)
      .json({ error: { message: 'Kundalik yozuvi topilmadi', status: 404 } });
    return;
  }

  // Talaba faqat o'ziga tegishli kundalikka fayl biriktira oladi
  if (entry.internship.studentId !== userId) {
    res
      .status(403)
      .json({ error: { message: "Bu kundalikka fayl biriktirish uchun ruxsat yo'q", status: 403 } });
    return;
  }

  // Faqat DRAFT yoki RETURNED holatda o'zgartirish mumkin
  if (!['DRAFT', 'RETURNED'].includes(entry.status)) {
    res.status(400).json({
      error: {
        message: `Faqat qoralama yoki qaytarilgan kundalikka fayl biriktirish mumkin (hozirgi holat: ${entry.status})`,
        status: 400,
      },
    });
    return;
  }

  (req as any).diaryEntry = entry;
  next();
};

/**
 * canViewEntry
 * — Foydalanuvchi kundalikni ko'ra olishini tekshiradi:
 *   talaba (egasi), biriktirilgan korxona rahbari yoki ta'lim muassasasi rahbari.
 */
export const canViewEntry = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const user = (req as any).user;
  const userId = user?.id;
  const userRole = user?.role;
  const { entryId } = req.params;

  const entry = await prisma.diaryEntry.findUnique({
    where: { id: entryId },
    include: {
      internship: {
        select: {
          studentId: true,
          companySupervisorId: true,
          universitySupervisorId: true,
        },
      },
    },
  });

  if (!entry) {
    res
      .status(404)
      .json({ error: { message: 'Kundalik yozuvi topilmadi', status: 404 } });
    return;
  }

  const { studentId, companySupervisorId, universitySupervisorId } =
    entry.internship;

  const isOwner = userId === studentId;
  const isAdmin = userRole === 'ADMIN';
  const isSupervisor =
    userId === companySupervisorId || userId === universitySupervisorId;

  if (!isOwner && !isAdmin && !isSupervisor) {
    res.status(403).json({
      error: {
        message: "Bu kundalikni ko'rish uchun ruxsat yo'q",
        status: 403,
      },
    });
    return;
  }

  // Deny supervisors when entry.status is DRAFT or RETURNED
  if (!isAdmin && !isOwner && ['DRAFT', 'RETURNED'].includes(entry.status)) {
    res.status(403).json({
      error: {
        message: "Qoralama yoki tuzatish uchun qaytarilgan kundalik ustozga ko'rinmaydi",
        status: 403,
      },
    });
    return;
  }

  (req as any).diaryEntry = entry;
  next();
};
