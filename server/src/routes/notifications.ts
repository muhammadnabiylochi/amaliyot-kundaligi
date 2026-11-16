import { Router, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, authorize, AuthenticatedRequest } from '../middleware/auth';
import { internshipScope } from './internships';
import { missingDiaryDates, sendManualReminder } from '../services/reminderService';
import { fail, ymd, todayTashkent } from '../lib/http';

const router = Router();

interface NotificationItem {
  id: string;
  type: 'warning' | 'info' | 'success' | 'action';
  title: string;
  message: string;
  link?: string;
  date: string;
}

/**
 * GET /api/notifications — computed, role-specific to-do items for the header bell.
 */
router.get('/', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;
    const items: NotificationItem[] = [];
    const today = todayTashkent();
    const weekAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000);

    if (user.role === 'STUDENT') {
      const active = await prisma.internship.findFirst({ where: { studentId: user.id, status: 'ACTIVE' } });
      if (active) {
        const missing = await missingDiaryDates(active.id, 3);
        if (missing.length) {
          items.push({
            id: `missing:${missing.join(',')}`,
            type: 'warning',
            title: 'Kundalik yozilmagan',
            message: `${missing.join(', ')} sanalari uchun kundalik kiritilmagan`,
            link: '/diary/new',
            date: ymd(today),
          });
        }
      } else {
        items.push({ id: 'no-internship', type: 'info', title: 'Faol amaliyot yo‘q', message: 'Sizga hali faol amaliyot biriktirilmagan', date: ymd(today) });
      }
      const returned = await prisma.diaryEntry.findMany({
        where: { internship: { studentId: user.id }, status: 'RETURNED' },
        include: { reviews: { orderBy: { createdAt: 'desc' }, take: 1 } },
        take: 10,
      });
      returned.forEach((e) =>
        items.push({
          id: `returned:${e.id}:${e.updatedAt.getTime()}`,
          type: 'action',
          title: 'Kundalik qaytarildi',
          message: `${ymd(e.entryDate)}: ${e.reviews[0]?.comment || 'tuzatish talab qilinadi'}`,
          link: `/diary/edit/${e.id}`,
          date: ymd(e.updatedAt),
        }),
      );
      const approved = await prisma.diaryReview.findMany({
        where: { decision: 'APPROVED', createdAt: { gte: weekAgo }, diaryEntry: { internship: { studentId: user.id } } },
        include: { diaryEntry: true },
        orderBy: { createdAt: 'desc' },
        take: 5,
      });
      approved.forEach((r) =>
        items.push({ id: `approved:${r.id}`, type: 'success', title: 'Kundalik tasdiqlandi', message: `${ymd(r.diaryEntry.entryDate)} — ${r.diaryEntry.taskTitle}`, link: '/diary', date: ymd(r.createdAt) }),
      );
    } else {
      const scope = internshipScope(user);
      const pending = await prisma.diaryEntry.count({ where: { status: 'SUBMITTED', internship: scope } });
      if (pending) {
        items.push({ id: `pending:${pending}`, type: 'action', title: 'Tekshirish kutilmoqda', message: `${pending} ta kundalik yozuvi tasdiqlashni kutmoqda`, link: '/reviews', date: ymd(today) });
      }
      const internships = await prisma.internship.findMany({
        where: { ...scope, status: 'ACTIVE' },
        include: { student: { select: { fullName: true } }, finalEvaluations: true },
      });
      let lagging = 0;
      for (const it of internships) {
        const m = await missingDiaryDates(it.id, 3);
        if (m.length >= 2) lagging++;
      }
      if (lagging) {
        items.push({ id: `lagging:${lagging}:${ymd(today)}`, type: 'warning', title: 'Kundalik yozmayotganlar', message: `${lagging} nafar talaba so'nggi kunlarda kundalik yozmagan`, link: '/journal', date: ymd(today) });
      }
      if (user.role !== 'ADMIN') {
        const soon = new Date(today);
        soon.setUTCDate(soon.getUTCDate() + 7);
        const role = user.role;
        const needEval = await prisma.internship.findMany({
          where: { ...scope, status: { in: ['ACTIVE', 'COMPLETED'] }, endDate: { lte: soon } },
          include: { student: { select: { fullName: true } }, finalEvaluations: { where: { evaluatorRole: role, status: 'SUBMITTED' } } },
        });
        needEval
          .filter((i) => i.finalEvaluations.length === 0)
          .forEach((i) =>
            items.push({ id: `eval:${i.id}`, type: 'action', title: 'Yakuniy baholash', message: `${i.student.fullName} amaliyoti ${ymd(i.endDate)} da tugaydi — baho qo'ying`, link: `/evaluation/${i.id}`, date: ymd(today) }),
          );
      } else {
        const withoutInternship = await prisma.user.count({
          where: { role: 'STUDENT', isActive: true, studentInternships: { none: { status: { in: ['ACTIVE', 'PLANNED'] } } } },
        });
        if (withoutInternship) {
          items.push({ id: `noint:${withoutInternship}`, type: 'info', title: 'Amaliyotga biriktirilmagan', message: `${withoutInternship} nafar faol talabaga amaliyot biriktirilmagan`, link: '/internships', date: ymd(today) });
        }
      }
    }

    res.json({ success: true, data: items });
  } catch (e) {
    next(e);
  }
});

/** POST /api/notifications/remind/:internshipId — supervisor/admin nudges a student via Telegram */
router.post('/remind/:internshipId', authenticate, authorize('ADMIN', 'COMPANY_SUPERVISOR', 'UNIVERSITY_SUPERVISOR'), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;
    const it = await prisma.internship.findFirst({ where: { id: req.params.internshipId, ...internshipScope(user) } });
    if (!it) {
      fail(res, 404, 'Amaliyot topilmadi yoki sizga biriktirilmagan');
      return;
    }
    const r = await sendManualReminder(it.id, user.fullName);
    res.status(r.ok ? 200 : 400).json(r.ok ? { success: true, message: r.message, data: { missing: r.missing } } : { error: { message: r.message, status: 400 } });
  } catch (e) {
    next(e);
  }
});

export default router;
