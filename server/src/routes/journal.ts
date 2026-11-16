import { Router, Response, NextFunction } from 'express';
import ExcelJS from 'exceljs';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { authenticate, authorize, AuthenticatedRequest } from '../middleware/auth';
import { internshipScope } from './internships';
import { fail, ymd, todayTashkent } from '../lib/http';

const router = Router();

const ATT_SHORT: Record<string, string> = { PRESENT: '+', LATE: 'K', EXCUSED: 'S', ABSENT: '−' };
const DIARY_SHORT: Record<string, string> = { APPROVED: '✓', SUBMITTED: '•', RETURNED: '↩', DRAFT: '' };

async function buildJournal(req: AuthenticatedRequest) {
  const user = req.user!;
  const month = typeof req.query.month === 'string' && /^\d{4}-\d{2}$/.test(req.query.month) ? req.query.month : ymd(todayTashkent()).slice(0, 7);
  const groupId = typeof req.query.groupId === 'string' && req.query.groupId !== 'all' ? req.query.groupId : undefined;

  const [y, m] = month.split('-').map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1));
  const last = new Date(Date.UTC(y, m, 0));

  const days: { date: string; day: number; weekday: number; isWeekend: boolean }[] = [];
  for (let d = new Date(first); d <= last; d.setUTCDate(d.getUTCDate() + 1)) {
    const wd = d.getUTCDay();
    days.push({ date: ymd(d), day: d.getUTCDate(), weekday: wd, isWeekend: wd === 0 || wd === 6 });
  }

  const where: Prisma.InternshipWhereInput = {
    ...internshipScope(user),
    status: { in: ['ACTIVE', 'COMPLETED'] },
    startDate: { lte: last },
    endDate: { gte: first },
    ...(groupId ? { student: { studentProfile: { groupId } } } : {}),
  };
  const hideDrafts = user.role === 'COMPANY_SUPERVISOR' || user.role === 'UNIVERSITY_SUPERVISOR';

  const internships = await prisma.internship.findMany({
    where,
    include: {
      student: { select: { id: true, fullName: true, studentProfile: { select: { studentNumber: true, group: { select: { name: true } } } } } },
      company: { select: { name: true } },
      attendances: { where: { attendanceDate: { gte: first, lte: last } } },
      diaryEntries: { where: { entryDate: { gte: first, lte: last } } },
    },
    orderBy: { student: { fullName: 'asc' } },
  });

  const rows = internships.map((it) => {
    const att = new Map(it.attendances.map((a) => [ymd(a.attendanceDate), a]));
    const diary = new Map(
      it.diaryEntries
        .filter((e) => !(hideDrafts && (e.status === 'DRAFT' || e.status === 'RETURNED')))
        .map((e) => [ymd(e.entryDate), e]),
    );
    const totals = { PRESENT: 0, LATE: 0, EXCUSED: 0, ABSENT: 0, hours: 0, diaryApproved: 0, diaryTotal: 0 };
    const startS = ymd(it.startDate);
    const endS = ymd(it.endDate);

    const cells = days.map((d) => {
      const a = att.get(d.date);
      const e = diary.get(d.date);
      if (a) {
        totals[a.status]++;
        totals.hours += Number(a.hours);
      }
      if (e) {
        totals.diaryTotal++;
        if (e.status === 'APPROVED') totals.diaryApproved++;
      }
      return {
        date: d.date,
        inRange: d.date >= startS && d.date <= endS,
        attendance: a?.status ?? null,
        hours: a ? Number(a.hours) : null,
        diary: e?.status ?? null,
        diaryId: e?.id ?? null,
      };
    });
    const marked = totals.PRESENT + totals.LATE + totals.EXCUSED + totals.ABSENT;
    return {
      internshipId: it.id,
      studentId: it.student.id,
      studentName: it.student.fullName,
      studentNumber: it.student.studentProfile?.studentNumber ?? '',
      groupName: it.student.studentProfile?.group.name ?? '',
      company: it.company.name,
      cells,
      totals: { ...totals, attendanceRate: marked ? Math.round(((totals.PRESENT + totals.LATE) / marked) * 100) : null },
    };
  });

  return { month, days, rows };
}

/** GET /api/journal?month=YYYY-MM&groupId= */
router.get('/', authenticate, authorize('ADMIN', 'COMPANY_SUPERVISOR', 'UNIVERSITY_SUPERVISOR'), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    res.json({ success: true, data: await buildJournal(req) });
  } catch (e) {
    next(e);
  }
});

/** GET /api/journal/excel?month=&groupId= */
router.get('/excel', authenticate, authorize('ADMIN', 'COMPANY_SUPERVISOR', 'UNIVERSITY_SUPERVISOR'), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const j = await buildJournal(req);
    if (!j.rows.length) {
      fail(res, 404, "Tanlangan oy va guruh bo'yicha ma'lumot topilmadi");
      return;
    }
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Amaliyot kundaligi';
    const ws = wb.addWorksheet(`Jurnal ${j.month}`, { views: [{ state: 'frozen', xSplit: 3, ySplit: 3 }] });

    const totalCols = 3 + j.days.length + 6;
    ws.mergeCells(1, 1, 1, totalCols);
    ws.getCell(1, 1).value = `Amaliyot jurnali — ${j.month} (davomat / kundalik)`;
    ws.getCell(1, 1).font = { bold: true, size: 14 };

    const header = ['№', 'Talaba', 'Guruh', ...j.days.map((d) => String(d.day)), 'Kelgan', 'Kechikkan', 'Sababli', 'Kelmagan', 'Soat', 'Davomat %'];
    ws.getRow(3).values = header;
    ws.getRow(3).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    ws.getRow(3).alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getRow(3).eachCell((c) => (c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } }));

    const fills: Record<string, string> = { PRESENT: 'FFD1FAE5', LATE: 'FFFEF3C7', EXCUSED: 'FFE0F2FE', ABSENT: 'FFFFE4E6' };
    j.rows.forEach((r, idx) => {
      const row = ws.getRow(4 + idx);
      row.values = [
        idx + 1,
        r.studentName,
        r.groupName,
        ...r.cells.map((c) => `${c.attendance ? ATT_SHORT[c.attendance] : ''}${c.diary ? DIARY_SHORT[c.diary] : ''}`),
        r.totals.PRESENT,
        r.totals.LATE,
        r.totals.EXCUSED,
        r.totals.ABSENT,
        r.totals.hours,
        r.totals.attendanceRate === null ? '—' : `${r.totals.attendanceRate}%`,
      ];
      r.cells.forEach((c, i) => {
        const cell = row.getCell(4 + i);
        cell.alignment = { horizontal: 'center' };
        if (c.attendance) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fills[c.attendance] } };
        else if (j.days[i].isWeekend) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
      });
    });

    ws.getColumn(1).width = 5;
    ws.getColumn(2).width = 30;
    ws.getColumn(3).width = 10;
    for (let i = 0; i < j.days.length; i++) ws.getColumn(4 + i).width = 4.5;
    for (let i = 0; i < 6; i++) ws.getColumn(4 + j.days.length + i).width = 11;

    const legendRow = 5 + j.rows.length;
    ws.getCell(legendRow, 2).value = "Belgilar: + kelgan, K kechikkan, S sababli, − kelmagan | ✓ kundalik tasdiqlangan, • topshirilgan, ↩ qaytarilgan";
    ws.getCell(legendRow, 2).font = { italic: true, size: 9 };

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="amaliyot_jurnali_${j.month}.xlsx"`);
    await wb.xlsx.write(res);
    res.end();
  } catch (e) {
    next(e);
  }
});

export default router;
