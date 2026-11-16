import { Router, Response, NextFunction, Request } from 'express';
import crypto from 'crypto';
import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import { prisma } from '../lib/prisma';
import { env } from '../config/env';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';
import { setupPdfFonts, getFont, drawPdfHeader, drawPdfFooter, formatUzStatus } from '../lib/exportHelpers';
import { EVALUATION_CRITERIA, TOTAL_MAX_SCORE } from '../config/evaluationCriteria';
import { computeFinalScore, gradeLabel } from '../lib/stats';
import { fail, ymd, countWorkingDays } from '../lib/http';

const router = Router();

/** Short HMAC so verification links can't be forged or enumerated. */
export function verificationCode(internshipId: string): string {
  return crypto.createHmac('sha256', env.JWT_SECRET).update(`final-report:${internshipId}`).digest('hex').slice(0, 16);
}

async function loadReportData(internshipId: string) {
  return prisma.internship.findUnique({
    where: { id: internshipId },
    include: {
      student: { select: { id: true, fullName: true, email: true, studentProfile: { include: { group: true } } } },
      company: true,
      companySupervisor: { select: { fullName: true } },
      universitySupervisor: { select: { fullName: true } },
      planItems: { orderBy: { orderIndex: 'asc' } },
      diaryEntries: { orderBy: { entryDate: 'asc' } },
      attendances: true,
      finalEvaluations: { include: { criteriaScores: true } },
    },
  });
}

type ReportData = NonNullable<Awaited<ReturnType<typeof loadReportData>>>;

function summarize(it: ReportData) {
  const approved = it.diaryEntries.filter((e) => e.status === 'APPROVED');
  const approvedHours = approved.reduce((s, e) => s + Number(e.hours), 0);
  const att = { PRESENT: 0, LATE: 0, EXCUSED: 0, ABSENT: 0 } as Record<string, number>;
  it.attendances.forEach((a) => att[a.status]++);
  const attTotal = att.PRESENT + att.LATE + att.EXCUSED + att.ABSENT;
  const finalScore = computeFinalScore(it.finalEvaluations);
  return {
    approvedCount: approved.length,
    approvedHours,
    workingDays: countWorkingDays(it.startDate, it.endDate),
    att,
    attTotal,
    attendanceRate: attTotal ? Math.round(((att.PRESENT + att.LATE) / attTotal) * 100) : null,
    finalScore,
    grade: gradeLabel(finalScore),
  };
}

/** GET /api/reports/final/:internshipId/pdf — combined official document */
router.get('/:internshipId/pdf', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;
    const it = await loadReportData(req.params.internshipId);
    if (!it) {
      fail(res, 404, 'Amaliyot topilmadi');
      return;
    }
    const allowed =
      user.role === 'ADMIN' ||
      (user.role === 'STUDENT' && it.studentId === user.id) ||
      (user.role === 'COMPANY_SUPERVISOR' && it.companySupervisorId === user.id) ||
      (user.role === 'UNIVERSITY_SUPERVISOR' && it.universitySupervisorId === user.id);
    if (!allowed) {
      fail(res, 403, "Ushbu amaliyot hisobotini ko'rish huquqingiz yo'q");
      return;
    }

    const s = summarize(it);
    const verifyUrl = `${env.CLIENT_URL.replace(/\/$/, '')}/verify/${it.id}?c=${verificationCode(it.id)}`;
    const qrPng = await QRCode.toBuffer(verifyUrl, { margin: 1, width: 220, errorCorrectionLevel: 'M' });

    const doc = new PDFDocument({ margin: 40, size: 'A4', bufferPages: true });
    setupPdfFonts(doc);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="yakuniy_hisobot_${it.student.fullName.replace(/\s+/g, '_')}.pdf"`);
    doc.pipe(res);

    const group = it.student.studentProfile?.group;
    let y = drawPdfHeader(doc, 'Ishlab chiqarish amaliyoti yakuniy hisoboti', 'Elektron kundalik, davomat va baholash natijalari asosida shakllantirildi', [
      { label: 'Talaba', value: it.student.fullName },
      { label: 'Talaba ID', value: it.student.studentProfile?.studentNumber || '—' },
      { label: 'Guruh', value: group?.name || '—' },
      { label: 'Mutaxassislik', value: group?.studyProgram || '—' },
      { label: 'Amaliyot joyi', value: it.company.name },
      { label: 'Lavozim', value: it.position || 'Amaliyotchi' },
      { label: 'Davr', value: `${ymd(it.startDate)} — ${ymd(it.endDate)} (${s.workingDays} ish kuni)` },
      { label: 'Holat', value: formatUzStatus(it.status) },
      { label: 'Korxona rahbari', value: it.companySupervisor?.fullName || '—' },
      { label: "Ta'lim muassasasi rahbari", value: it.universitySupervisor?.fullName || '—' },
    ]);

    const L = 40;
    const W = 515;
    const ensure = (h: number) => {
      if (y + h > doc.page.height - 55) {
        doc.addPage();
        y = 40;
      }
    };
    const section = (title: string) => {
      ensure(40);
      doc.font(getFont(doc, true)).fontSize(11).fillColor('#1e293b').text(title, L, y);
      y += 16;
      doc.moveTo(L, y).lineTo(L + W, y).strokeColor('#cbd5e1').lineWidth(0.7).stroke();
      y += 8;
    };
    const table = (cols: { title: string; width: number; align?: 'left' | 'center' | 'right' }[], rows: string[][]) => {
      const head = () => {
        doc.rect(L, y, W, 20).fill('#334155');
        let x = L;
        doc.font(getFont(doc, true)).fontSize(8).fillColor('#ffffff');
        cols.forEach((c) => {
          doc.text(c.title, x + 4, y + 6, { width: c.width - 8, align: c.align ?? 'left' });
          x += c.width;
        });
        y += 20;
      };
      ensure(44);
      head();
      rows.forEach((r, i) => {
        doc.font(getFont(doc, false)).fontSize(8);
        const h = Math.max(18, ...r.map((t, j) => doc.heightOfString(t, { width: cols[j].width - 8 }) + 8));
        if (y + h > doc.page.height - 55) {
          doc.addPage();
          y = 40;
          head();
        }
        if (i % 2) doc.rect(L, y, W, h).fill('#f8fafc');
        doc.rect(L, y, W, h).strokeColor('#e2e8f0').lineWidth(0.5).stroke();
        let x = L;
        doc.fillColor('#0f172a').font(getFont(doc, false)).fontSize(8);
        r.forEach((t, j) => {
          doc.text(t, x + 4, y + 4, { width: cols[j].width - 8, align: cols[j].align ?? 'left' });
          x += cols[j].width;
        });
        y += h;
      });
      y += 10;
    };

    // 1. Key indicators
    section('1. Asosiy ko‘rsatkichlar');
    const kpis = [
      ['Tasdiqlangan kundaliklar', `${s.approvedCount} ta`],
      ['Tasdiqlangan ish soatlari', `${s.approvedHours} soat`],
      ['Davomat', s.attendanceRate === null ? '—' : `${s.attendanceRate}%`],
      ['Yakuniy ball', s.finalScore === null ? 'Kutilmoqda' : `${s.finalScore} / ${TOTAL_MAX_SCORE}`],
    ];
    const kw = W / 4;
    ensure(48);
    kpis.forEach(([label, value], i) => {
      const x = L + i * kw;
      doc.roundedRect(x + 2, y, kw - 4, 42, 4).fillAndStroke('#f1f5f9', '#e2e8f0');
      doc.font(getFont(doc, false)).fontSize(7.5).fillColor('#64748b').text(label, x + 8, y + 7, { width: kw - 16 });
      doc.font(getFont(doc, true)).fontSize(12).fillColor('#1e293b').text(value, x + 8, y + 20, { width: kw - 16 });
    });
    y += 54;

    // 2. Plan execution
    section('2. Amaliyot dasturi (reja) bajarilishi');
    if (it.planItems.length) {
      table(
        [
          { title: '№', width: 28, align: 'center' },
          { title: 'Mavzu / topshiriq', width: 287 },
          { title: 'Reja (soat)', width: 65, align: 'center' },
          { title: 'Bajarildi (soat)', width: 75, align: 'center' },
          { title: '%', width: 60, align: 'center' },
        ],
        it.planItems.map((p, i) => {
          const done = it.diaryEntries.filter((e) => e.planItemId === p.id && e.status === 'APPROVED').reduce((a, e) => a + Number(e.hours), 0);
          const planned = Number(p.plannedHours);
          return [String(i + 1), p.title, String(planned), String(done), planned ? `${Math.min(100, Math.round((done / planned) * 100))}%` : '—'];
        }),
      );
    } else {
      doc.font(getFont(doc, false)).fontSize(9).fillColor('#64748b').text('Amaliyot rejasi kiritilmagan.', L, y);
      y += 20;
    }

    // 3. Diary
    section('3. Kundalik yozuvlari');
    const entries = it.diaryEntries.filter((e) => e.status !== 'DRAFT');
    if (entries.length) {
      table(
        [
          { title: 'Sana', width: 65 },
          { title: 'Bajarilgan ish', width: 300 },
          { title: 'Soat', width: 45, align: 'center' },
          { title: 'Holat', width: 105 },
        ],
        entries.map((e) => [ymd(e.entryDate), e.result ? `${e.taskTitle}\nNatija: ${e.result}` : e.taskTitle, String(Number(e.hours)), formatUzStatus(e.status)]),
      );
    } else {
      doc.font(getFont(doc, false)).fontSize(9).fillColor('#64748b').text('Topshirilgan kundalik yozuvlari yo‘q.', L, y);
      y += 20;
    }

    // 4. Attendance
    section('4. Davomat');
    table(
      [
        { title: 'Kelgan', width: 86, align: 'center' },
        { title: 'Kechikkan', width: 86, align: 'center' },
        { title: 'Sababli', width: 86, align: 'center' },
        { title: 'Kelmagan', width: 86, align: 'center' },
        { title: 'Jami qayd', width: 86, align: 'center' },
        { title: 'Davomat %', width: 85, align: 'center' },
      ],
      [[String(s.att.PRESENT), String(s.att.LATE), String(s.att.EXCUSED), String(s.att.ABSENT), String(s.attTotal), s.attendanceRate === null ? '—' : `${s.attendanceRate}%`]],
    );

    // 5. Evaluation
    section('5. Yakuniy baholash');
    const ce = it.finalEvaluations.find((e) => e.evaluatorRole === 'COMPANY_SUPERVISOR');
    const ue = it.finalEvaluations.find((e) => e.evaluatorRole === 'UNIVERSITY_SUPERVISOR');
    const scoreOf = (ev: typeof ce, key: string) => {
      const c = ev?.criteriaScores.find((x) => x.criterionKey === key);
      return c ? Number(c.score) : null;
    };
    table(
      [
        { title: 'Mezon', width: 235 },
        { title: 'Maks', width: 50, align: 'center' },
        { title: 'Korxona', width: 75, align: 'center' },
        { title: 'Muassasa', width: 75, align: 'center' },
        { title: "O'rtacha", width: 80, align: 'center' },
      ],
      [
        ...EVALUATION_CRITERIA.map((c) => {
          const a = scoreOf(ce, c.key);
          const b = scoreOf(ue, c.key);
          const avg = a !== null && b !== null ? String(Math.round(((a + b) / 2) * 10) / 10) : '—';
          return [c.name, String(c.maxScore), a === null ? '—' : String(a), b === null ? '—' : String(b), avg];
        }),
        ['JAMI', String(TOTAL_MAX_SCORE), ce ? String(Number(ce.totalScore)) : '—', ue ? String(Number(ue.totalScore)) : '—', s.finalScore === null ? '—' : String(s.finalScore)],
      ],
    );
    ensure(30);
    doc.font(getFont(doc, true)).fontSize(10.5).fillColor(s.finalScore === null ? '#b45309' : '#15803d')
      .text(`Xulosa: ${s.finalScore === null ? "baholash hali yakunlanmagan (ikkala rahbar bahosi talab qilinadi)" : `${s.finalScore} ball — ${s.grade}`}`, L, y);
    y += 26;

    // Signatures + QR
    ensure(150);
    const sigTop = y;
    const sig = (label: string, name: string, yy: number) => {
      doc.font(getFont(doc, false)).fontSize(9).fillColor('#334155').text(label, L, yy, { width: 200 });
      doc.moveTo(L + 205, yy + 10).lineTo(L + 300, yy + 10).strokeColor('#94a3b8').lineWidth(0.7).stroke();
      doc.fontSize(8).fillColor('#64748b').text(name, L + 305, yy + 2, { width: 100 });
    };
    sig('Talaba:', it.student.fullName, sigTop);
    sig('Korxona rahbari (M.O‘.):', it.companySupervisor?.fullName || '', sigTop + 34);
    sig("Ta'lim muassasasi rahbari:", it.universitySupervisor?.fullName || '', sigTop + 68);
    doc.font(getFont(doc, false)).fontSize(8).fillColor('#64748b').text(`Sana: «____» ______________ ${new Date().getFullYear()}-yil`, L, sigTop + 104);

    doc.image(qrPng, L + W - 100, sigTop - 4, { width: 100 });
    doc.font(getFont(doc, false)).fontSize(6.5).fillColor('#64748b').text('Hujjat haqiqiyligini tekshirish uchun QR-kodni skanerlang', L + W - 110, sigTop + 98, { width: 120, align: 'center' });

    drawPdfFooter(doc);
    doc.end();
  } catch (error) {
    next(error);
  }
});

/** Public: GET /api/public/verify/:internshipId?c=code — confirms document authenticity */
export const publicRouter = Router();
publicRouter.get('/verify/:internshipId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const code = String(req.query.c || '');
    const expected = verificationCode(req.params.internshipId);
    const valid = code.length === expected.length && crypto.timingSafeEqual(Buffer.from(code), Buffer.from(expected));
    if (!valid) {
      fail(res, 404, 'Hujjat topilmadi yoki tekshiruv kodi noto‘g‘ri');
      return;
    }
    const it = await loadReportData(req.params.internshipId);
    if (!it) {
      fail(res, 404, 'Hujjat topilmadi');
      return;
    }
    const s = summarize(it);
    res.json({
      success: true,
      data: {
        studentName: it.student.fullName,
        groupName: it.student.studentProfile?.group.name ?? null,
        studyProgram: it.student.studentProfile?.group.studyProgram ?? null,
        company: it.company.name,
        startDate: ymd(it.startDate),
        endDate: ymd(it.endDate),
        status: it.status,
        approvedEntries: s.approvedCount,
        approvedHours: s.approvedHours,
        attendanceRate: s.attendanceRate,
        finalScore: s.finalScore,
        grade: s.grade,
        maxScore: TOTAL_MAX_SCORE,
        checkedAt: new Date().toISOString(),
      },
    });
  } catch (e) {
    next(e);
  }
});

export default router;
