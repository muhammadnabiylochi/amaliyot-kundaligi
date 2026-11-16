import { Router, Response, NextFunction } from 'express';
import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';
import { prisma } from '../lib/prisma';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';
import {
  setupPdfFonts,
  getFont,
  drawPdfHeader,
  drawPdfFooter,
  formatUzStatus,
  styleExcelHeader,
  applyExcelBorders,
} from '../lib/exportHelpers';
import { EVALUATION_CRITERIA, TOTAL_MAX_SCORE } from '../config/evaluationCriteria';

const router = Router();

// ─── HELPER: Security Scope Filter ──────────────────────────────────────────

async function getAuthorizedInternshipIds(user: NonNullable<AuthenticatedRequest['user']>): Promise<string[] | 'ALL'> {
  if (user.role === 'ADMIN') return 'ALL';
  if (user.role === 'STUDENT') {
    const list = await prisma.internship.findMany({
      where: { studentId: user.id },
      select: { id: true },
    });
    return list.map((i) => i.id);
  }
  if (user.role === 'COMPANY_SUPERVISOR') {
    const list = await prisma.internship.findMany({
      where: { companySupervisorId: user.id },
      select: { id: true },
    });
    return list.map((i) => i.id);
  }
  if (user.role === 'UNIVERSITY_SUPERVISOR') {
    const list = await prisma.internship.findMany({
      where: { universitySupervisorId: user.id },
      select: { id: true },
    });
    return list.map((i) => i.id);
  }
  return [];
}

/**
 * GET /api/reports/summary (Existing dashboard summary report)
 */
router.get('/summary', authenticate, async (_req, res, next) => {
  try {
    const [studentsCount, companiesCount, approvedEntriesCount, totalHours] =
      await Promise.all([
        prisma.user.count({ where: { role: 'STUDENT', isActive: true } }),
        prisma.company.count(),
        prisma.diaryEntry.count({ where: { status: 'APPROVED' } }),
        prisma.diaryEntry.aggregate({
          _sum: { hours: true },
          where: { status: 'APPROVED' },
        }),
      ]);

    const totalSubmitted = await prisma.diaryEntry.count();
    const approvedRate = totalSubmitted > 0
      ? `${Math.round((approvedEntriesCount / totalSubmitted) * 100)}%`
      : '100%';

    const companies = await prisma.company.findMany({
      include: {
        internships: {
          include: {
            diaryEntries: true,
          },
        },
      },
    });

    const companyStats = companies.map((c) => {
      const allEntries = c.internships.flatMap((i) => i.diaryEntries);
      const approved = allEntries.filter((e) => e.status === 'APPROVED').length;
      const total = allEntries.length || 1;
      const rate = Math.round((approved / total) * 100);

      return {
        name: c.name,
        students: c.internships.length,
        avgDays: '30 kun',
        approved,
        rate: `${rate}%`,
      };
    });

    res.json({
      success: true,
      data: {
        totalStudents: studentsCount,
        totalCompanies: companiesCount,
        approvedRate,
        totalHours: Number(totalHours._sum.hours || 0),
        companies: companyStats,
      },
    });
  } catch (error) {
    next(error);
  }
});

// ─── 1. KUNDALIK HISOBOTI (DIARY EXPORT) ────────────────────────────────────

/**
 * GET /api/reports/diary/excel
 * GET /api/reports/diary/pdf
 */
async function getDiaryData(req: AuthenticatedRequest) {
  const user = req.user!;
  const { studentId, internshipId, status, from, to } = req.query as Record<string, string>;

  const authInternships = await getAuthorizedInternshipIds(user);
  if (Array.isArray(authInternships) && authInternships.length === 0) {
    return { error: { status: 403, message: "Sizga biriktirilgan amaliyot topilmadi" } };
  }

  const whereClause: any = {};

  if (authInternships !== 'ALL') {
    whereClause.internshipId = { in: authInternships };
  }

  if (internshipId && internshipId !== 'all') {
    if (authInternships !== 'ALL' && !authInternships.includes(internshipId)) {
      return { error: { status: 403, message: "Ushbu amaliyot hisobotini ko'rish huquqingiz yo'q" } };
    }
    whereClause.internshipId = internshipId;
  }

  if (studentId && studentId !== 'all') {
    if (user.role === 'STUDENT' && user.id !== studentId) {
      return { error: { status: 403, message: "Boshqa talabaning hisobotini ko'ra olmaysiz" } };
    }
    whereClause.internship = { ...whereClause.internship, studentId };
  }

  // Supervisor status visibility restriction
  if (user.role === 'COMPANY_SUPERVISOR' || user.role === 'UNIVERSITY_SUPERVISOR') {
    whereClause.status = { in: ['SUBMITTED', 'APPROVED'] };
  }

  if (status && status !== 'all') {
    const requestedStatus = status.toUpperCase();
    if (
      (user.role === 'COMPANY_SUPERVISOR' || user.role === 'UNIVERSITY_SUPERVISOR') &&
      ['DRAFT', 'RETURNED'].includes(requestedStatus)
    ) {
      return { entries: [], meta: { count: 0 } };
    }
    whereClause.status = requestedStatus;
  }

  if (from || to) {
    whereClause.entryDate = {};
    if (from) whereClause.entryDate.gte = new Date(from);
    if (to) whereClause.entryDate.lte = new Date(to);
  }

  const entries = await prisma.diaryEntry.findMany({
    where: whereClause,
    orderBy: { entryDate: 'asc' },
    include: {
      internship: {
        include: {
          student: {
            include: {
              studentProfile: {
                include: { group: true },
              },
            },
          },
          company: true,
          companySupervisor: true,
          universitySupervisor: true,
        },
      },
    },
  });

  return { entries };
}

router.get('/diary/excel', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const data = await getDiaryData(req);
    if ('error' in data && data.error) {
      res.status(data.error.status).json({ error: { message: data.error.message, status: data.error.status } });
      return;
    }

    const { entries } = data;
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Elektron Kundalik Tizimi';
    workbook.created = new Date();

    const ws = workbook.addWorksheet('Kundalik yozuvlari', {
      views: [{ state: 'frozen', ySplit: 4 }],
    });

    // Title rows
    ws.mergeCells('A1:H1');
    const titleCell = ws.getCell('A1');
    titleCell.value = 'TALABANING KUNDALIK HISOBOTI';
    titleCell.font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FF1E293B' } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getRow(1).height = 30;

    ws.mergeCells('A2:H2');
    const subCell = ws.getCell('A2');
    subCell.value = `Chop etilgan sana: ${new Date().toISOString().split('T')[0]} · Jami yozuvlar: ${entries.length} ta`;
    subCell.font = { name: 'Arial', size: 9, italic: true, color: { argb: 'FF64748B' } };
    subCell.alignment = { horizontal: 'center', vertical: 'middle' };

    // Columns
    ws.columns = [
      { key: 'num', width: 6 },
      { key: 'date', width: 14 },
      { key: 'student', width: 24 },
      { key: 'company', width: 20 },
      { key: 'title', width: 30 },
      { key: 'description', width: 45 },
      { key: 'hours', width: 12 },
      { key: 'status', width: 16 },
    ];

    // Headers
    const headerRow = ws.getRow(4);
    headerRow.values = [
      '№',
      'Sana',
      'Talaba F.I.Sh.',
      'Korxona / Tashkilot',
      'Mavzu / Asosiy faoliyat',
      'Bajarilgan ish tavsifi',
      'Soat',
      'Holat',
    ];
    styleExcelHeader(ws, 4);

    let rowIdx = 5;
    for (let i = 0; i < entries.length; i++) {
      const e = entries[i];
      const r = ws.getRow(rowIdx);
      r.values = [
        i + 1,
        e.entryDate.toISOString().split('T')[0],
        e.internship.student.fullName,
        e.internship.company.name,
        e.taskTitle,
        e.description,
        Number(e.hours),
        formatUzStatus(e.status),
      ];
      r.alignment = { vertical: 'middle', wrapText: true };
      r.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
      r.getCell(2).alignment = { horizontal: 'center', vertical: 'middle' };
      r.getCell(7).alignment = { horizontal: 'center', vertical: 'middle' };
      r.getCell(8).alignment = { horizontal: 'center', vertical: 'middle' };
      rowIdx++;
    }

    if (entries.length > 0) {
      applyExcelBorders(ws, 4, rowIdx - 1, 8);
      const totalRow = ws.getRow(rowIdx);
      totalRow.getCell(6).value = 'JAMI SOAT:';
      totalRow.getCell(6).font = { name: 'Arial', bold: true };
      totalRow.getCell(6).alignment = { horizontal: 'right' };
      totalRow.getCell(7).value = { formula: `SUM(G5:G${rowIdx - 1})` };
      totalRow.getCell(7).font = { name: 'Arial', bold: true };
      totalRow.getCell(7).alignment = { horizontal: 'center' };
    }

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="kundalik_hisoboti_${new Date().toISOString().split('T')[0]}.xlsx"`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    next(error);
  }
});

router.get('/diary/pdf', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const data = await getDiaryData(req);
    if ('error' in data && data.error) {
      res.status(data.error.status).json({ error: { message: data.error.message, status: data.error.status } });
      return;
    }

    const { entries } = data;
    const doc = new PDFDocument({ margin: 40, size: 'A4', bufferPages: true });
    setupPdfFonts(doc);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="kundalik_hisoboti_${new Date().toISOString().split('T')[0]}.pdf"`);
    doc.pipe(res);

    const first = entries[0];
    const metaDetails = first
      ? [
          { label: 'Talaba', value: first.internship.student.fullName },
          { label: 'Guruh', value: first.internship.student.studentProfile?.group?.name || '—' },
          { label: 'Amaliyot joyi', value: first.internship.company.name },
          { label: 'Jami yozuvlar', value: `${entries.length} kunlik hisobot` },
        ]
      : undefined;

    let y = drawPdfHeader(doc, 'Talabaning Kundalik Hisoboti', 'Amaliyot davomida bajarilgan kunlik ishlar ro‘yxati', metaDetails);

    const colX = [40, 105, 215, 430, 475];
    const colW = [65, 110, 215, 45, 80];

    const drawTableHeader = (curY: number) => {
      doc.rect(40, curY, 515, 20).fill('#334155');
      doc.font(getFont(doc, true)).fontSize(8.5).fillColor('#ffffff');
      doc.text('Sana', colX[0] + 4, curY + 6, { width: colW[0] - 8, align: 'center' });
      doc.text('Mavzu', colX[1] + 4, curY + 6, { width: colW[1] - 8 });
      doc.text('Bajarilgan ish tavsifi', colX[2] + 4, curY + 6, { width: colW[2] - 8 });
      doc.text('Soat', colX[3] + 4, curY + 6, { width: colW[3] - 8, align: 'center' });
      doc.text('Holat', colX[4] + 4, curY + 6, { width: colW[4] - 8, align: 'center' });
      return curY + 20;
    };

    y = drawTableHeader(y);

    if (entries.length === 0) {
      doc
        .font(getFont(doc, false))
        .fontSize(10)
        .fillColor('#64748b')
        .text('Ko‘rsatilgan parametrlar bo‘yicha yozuvlar topilmadi.', 40, y + 20, { align: 'center', width: 515 });
    } else {
      let isAlt = false;
      for (const e of entries) {
        doc.font(getFont(doc, false)).fontSize(8);
        const descHeight = doc.heightOfString(e.description || '—', { width: colW[2] - 8 });
        const titleHeight = doc.heightOfString(e.taskTitle, { width: colW[1] - 8 });
        const rowH = Math.max(22, descHeight + 10, titleHeight + 10);

        if (y + rowH > doc.page.height - 50) {
          doc.addPage();
          y = 40;
          y = drawTableHeader(y);
        }

        if (isAlt) {
          doc.rect(40, y, 515, rowH).fill('#f8fafc');
        }
        doc.rect(40, y, 515, rowH).stroke('#e2e8f0');

        doc.fillColor('#0f172a');
        doc.font(getFont(doc, false)).fontSize(8);
        doc.text(e.entryDate.toISOString().split('T')[0], colX[0] + 4, y + 6, { width: colW[0] - 8, align: 'center' });
        doc.font(getFont(doc, true)).text(e.taskTitle, colX[1] + 4, y + 6, { width: colW[1] - 8 });
        doc.font(getFont(doc, false)).text(e.description || '—', colX[2] + 4, y + 6, { width: colW[2] - 8 });
        doc.text(Number(e.hours).toFixed(1), colX[3] + 4, y + 6, { width: colW[3] - 8, align: 'center' });

        const statusLabel = formatUzStatus(e.status);
        doc.text(statusLabel, colX[4] + 4, y + 6, { width: colW[4] - 8, align: 'center' });

        y += rowH;
        isAlt = !isAlt;
      }
    }

    drawPdfFooter(doc);
    doc.end();
  } catch (error) {
    next(error);
  }
});

// ─── 2. DAVOMAT HISOBOTI (ATTENDANCE EXPORT) ───────────────────────────────

async function getAttendanceData(req: AuthenticatedRequest) {
  const user = req.user!;
  const { studentId, internshipId, status, from, to } = req.query as Record<string, string>;

  const authInternships = await getAuthorizedInternshipIds(user);
  if (Array.isArray(authInternships) && authInternships.length === 0) {
    return { error: { status: 403, message: "Sizga biriktirilgan amaliyot topilmadi" } };
  }

  const whereClause: any = {};

  if (authInternships !== 'ALL') {
    whereClause.internshipId = { in: authInternships };
  }

  if (internshipId && internshipId !== 'all') {
    if (authInternships !== 'ALL' && !authInternships.includes(internshipId)) {
      return { error: { status: 403, message: "Ushbu amaliyot davomatini ko'rish huquqingiz yo'q" } };
    }
    whereClause.internshipId = internshipId;
  }

  if (studentId && studentId !== 'all') {
    if (user.role === 'STUDENT' && user.id !== studentId) {
      return { error: { status: 403, message: "Boshqa talabaning davomatini ko'ra olmaysiz" } };
    }
    whereClause.internship = { ...whereClause.internship, studentId };
  }

  if (status && status !== 'all') {
    whereClause.status = status.toUpperCase();
  }

  if (from || to) {
    whereClause.attendanceDate = {};
    if (from) whereClause.attendanceDate.gte = new Date(from);
    if (to) whereClause.attendanceDate.lte = new Date(to);
  }

  const records = await prisma.attendance.findMany({
    where: whereClause,
    orderBy: { attendanceDate: 'asc' },
    include: {
      internship: {
        include: {
          student: {
            include: {
              studentProfile: {
                include: { group: true },
              },
            },
          },
          company: true,
        },
      },
    },
  });

  const totalDays = records.length;
  const presentDays = records.filter((r) => r.status === 'PRESENT').length;
  const absentDays = records.filter((r) => r.status === 'ABSENT').length;
  const lateDays = records.filter((r) => r.status === 'LATE').length;
  const excusedDays = records.filter((r) => r.status === 'EXCUSED').length;
  const totalHours = records.reduce((acc, r) => acc + Number(r.hours), 0);
  const attendanceRate = totalDays > 0 ? Math.round(((presentDays + lateDays) / totalDays) * 100) : 100;

  return {
    records,
    stats: {
      totalDays,
      presentDays,
      absentDays,
      lateDays,
      excusedDays,
      totalHours,
      attendanceRate,
    },
  };
}

router.get('/attendance/excel', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const data = await getAttendanceData(req);
    if ('error' in data && data.error) {
      res.status(data.error.status).json({ error: { message: data.error.message, status: data.error.status } });
      return;
    }

    const { records, stats } = data;
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Elektron Kundalik Tizimi';
    workbook.created = new Date();

    const ws = workbook.addWorksheet('Davomat hisoboti', {
      views: [{ state: 'frozen', ySplit: 6 }],
    });

    ws.mergeCells('A1:G1');
    const titleCell = ws.getCell('A1');
    titleCell.value = 'AMALIYOT DAVOMAT HISOBOTI';
    titleCell.font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FF1E293B' } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getRow(1).height = 28;

    ws.mergeCells('A2:G2');
    const kpiCell = ws.getCell('A2');
    kpiCell.value = `Jami kun: ${stats.totalDays} | Kelgan: ${stats.presentDays} | Kechikkan: ${stats.lateDays} | Kelmagan: ${stats.absentDays} | Sababli: ${stats.excusedDays} | Davomat: ${stats.attendanceRate}% | Jami soat: ${stats.totalHours.toFixed(1)}`;
    kpiCell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF0F172A' } };
    kpiCell.alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getRow(2).height = 22;

    ws.columns = [
      { key: 'num', width: 6 },
      { key: 'date', width: 14 },
      { key: 'student', width: 24 },
      { key: 'company', width: 22 },
      { key: 'status', width: 16 },
      { key: 'hours', width: 12 },
      { key: 'note', width: 35 },
    ];

    const headerRow = ws.getRow(5);
    headerRow.values = ['№', 'Sana', 'Talaba F.I.Sh.', 'Korxona', 'Davomat holati', 'Soat', 'Izoh'];
    styleExcelHeader(ws, 5);

    let rowIdx = 6;
    for (let i = 0; i < records.length; i++) {
      const r = records[i];
      const row = ws.getRow(rowIdx);
      row.values = [
        i + 1,
        r.attendanceDate.toISOString().split('T')[0],
        r.internship.student.fullName,
        r.internship.company.name,
        formatUzStatus(r.status),
        Number(r.hours),
        r.note || '—',
      ];
      row.alignment = { vertical: 'middle', wrapText: true };
      row.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
      row.getCell(2).alignment = { horizontal: 'center', vertical: 'middle' };
      row.getCell(5).alignment = { horizontal: 'center', vertical: 'middle' };
      row.getCell(6).alignment = { horizontal: 'center', vertical: 'middle' };
      rowIdx++;
    }

    if (records.length > 0) {
      applyExcelBorders(ws, 5, rowIdx - 1, 7);
    }

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="davomat_hisoboti_${new Date().toISOString().split('T')[0]}.xlsx"`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    next(error);
  }
});

router.get('/attendance/pdf', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const data = await getAttendanceData(req);
    if ('error' in data && data.error) {
      res.status(data.error.status).json({ error: { message: data.error.message, status: data.error.status } });
      return;
    }

    const { records, stats } = data;
    const doc = new PDFDocument({ margin: 40, size: 'A4', bufferPages: true });
    setupPdfFonts(doc);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="davomat_hisoboti_${new Date().toISOString().split('T')[0]}.pdf"`);
    doc.pipe(res);

    const first = records[0];
    const metaDetails = [
      { label: 'Talaba', value: first ? first.internship.student.fullName : 'Barcha talabalar' },
      { label: 'Guruh', value: first?.internship.student.studentProfile?.group?.name || '—' },
      { label: 'Jami amaliyot kunlari', value: `${stats.totalDays} kun` },
      { label: 'Davomat foizi', value: `${stats.attendanceRate}%` },
      { label: 'Kelgan / Kechikkan', value: `${stats.presentDays} kun / ${stats.lateDays} kun` },
      { label: 'Kelmagan / Sababli', value: `${stats.absentDays} kun / ${stats.excusedDays} kun` },
    ];

    let y = drawPdfHeader(doc, 'Amaliyot Davomat Hisoboti', 'Davomat monitoringi va ishlangan soatlar bo‘yicha hisobot', metaDetails);

    const colX = [40, 115, 245, 325, 375];
    const colW = [75, 130, 80, 50, 180];

    const drawTableHeader = (curY: number) => {
      doc.rect(40, curY, 515, 20).fill('#334155');
      doc.font(getFont(doc, true)).fontSize(8.5).fillColor('#ffffff');
      doc.text('Sana', colX[0] + 4, curY + 6, { width: colW[0] - 8, align: 'center' });
      doc.text('Talaba', colX[1] + 4, curY + 6, { width: colW[1] - 8 });
      doc.text('Holat', colX[2] + 4, curY + 6, { width: colW[2] - 8, align: 'center' });
      doc.text('Soat', colX[3] + 4, curY + 6, { width: colW[3] - 8, align: 'center' });
      doc.text('Izoh', colX[4] + 4, curY + 6, { width: colW[4] - 8 });
      return curY + 20;
    };

    y = drawTableHeader(y);

    if (records.length === 0) {
      doc
        .font(getFont(doc, false))
        .fontSize(10)
        .fillColor('#64748b')
        .text('Ko‘rsatilgan parametrlar bo‘yicha davomat yozuvlari topilmadi.', 40, y + 20, { align: 'center', width: 515 });
    } else {
      let isAlt = false;
      for (const r of records) {
        doc.font(getFont(doc, false)).fontSize(8);
        const noteHeight = doc.heightOfString(r.note || '—', { width: colW[4] - 8 });
        const nameHeight = doc.heightOfString(r.internship.student.fullName, { width: colW[1] - 8 });
        const rowH = Math.max(20, noteHeight + 8, nameHeight + 8);

        if (y + rowH > doc.page.height - 50) {
          doc.addPage();
          y = 40;
          y = drawTableHeader(y);
        }

        if (isAlt) {
          doc.rect(40, y, 515, rowH).fill('#f8fafc');
        }
        doc.rect(40, y, 515, rowH).stroke('#e2e8f0');

        doc.fillColor('#0f172a');
        doc.font(getFont(doc, false)).fontSize(8);
        doc.text(r.attendanceDate.toISOString().split('T')[0], colX[0] + 4, y + 5, { width: colW[0] - 8, align: 'center' });
        doc.font(getFont(doc, true)).text(r.internship.student.fullName, colX[1] + 4, y + 5, { width: colW[1] - 8 });

        const statusLabel = formatUzStatus(r.status);
        doc.font(getFont(doc, false)).text(statusLabel, colX[2] + 4, y + 5, { width: colW[2] - 8, align: 'center' });
        doc.text(Number(r.hours).toFixed(1), colX[3] + 4, y + 5, { width: colW[3] - 8, align: 'center' });
        doc.text(r.note || '—', colX[4] + 4, y + 5, { width: colW[4] - 8 });

        y += rowH;
        isAlt = !isAlt;
      }
    }

    drawPdfFooter(doc);
    doc.end();
  } catch (error) {
    next(error);
  }
});

// ─── 3. YAKUNIY BAHOLASH HISOBOTI (EVALUATION EXPORT) ───────────────────────

async function getEvaluationData(req: AuthenticatedRequest, internshipId: string) {
  const user = req.user!;
  if (!internshipId) {
    return { error: { status: 400, message: "Amaliyot identifikatori (internshipId) kiritilmadi" } };
  }

  const internship = await prisma.internship.findUnique({
    where: { id: internshipId },
    include: {
      student: {
        include: {
          studentProfile: {
            include: { group: true },
          },
        },
      },
      company: true,
      companySupervisor: true,
      universitySupervisor: true,
      finalEvaluations: {
        include: {
          evaluator: true,
          criteriaScores: true,
        },
      },
    },
  });

  if (!internship) {
    return { error: { status: 404, message: "Amaliyot topilmadi" } };
  }

  // Permission check
  const isStudentOwner = user.role === 'STUDENT' && internship.studentId === user.id;
  const isCompanySup = user.role === 'COMPANY_SUPERVISOR' && internship.companySupervisorId === user.id;
  const isUniSup = user.role === 'UNIVERSITY_SUPERVISOR' && internship.universitySupervisorId === user.id;
  const isAdmin = user.role === 'ADMIN';

  if (!isStudentOwner && !isCompanySup && !isUniSup && !isAdmin) {
    return { error: { status: 403, message: "Ushbu amaliyot baholash ma'lumotlariga ruxsatingiz yo'q" } };
  }

  const companyEval = internship.finalEvaluations.find(
    (e) => e.evaluatorRole === 'COMPANY_SUPERVISOR'
  );
  const universityEval = internship.finalEvaluations.find(
    (e) => e.evaluatorRole === 'UNIVERSITY_SUPERVISOR' || e.evaluatorRole === 'ADMIN'
  );

  const isBothSubmitted =
    companyEval?.status === 'SUBMITTED' && universityEval?.status === 'SUBMITTED';

  const finalScore = isBothSubmitted
    ? Math.round(((Number(companyEval.totalScore) + Number(universityEval.totalScore)) / 2) * 100) / 100
    : null;

  const companyScoresMap = new Map(companyEval?.criteriaScores.map((c) => [c.criterionKey, c]));
  const universityScoresMap = new Map(universityEval?.criteriaScores.map((c) => [c.criterionKey, c]));

  const breakdown = EVALUATION_CRITERIA.map((criterion) => {
    const cScore = companyScoresMap.get(criterion.key);
    const uScore = universityScoresMap.get(criterion.key);

    const cVal = cScore ? Number(cScore.score) : null;
    const uVal = uScore ? Number(uScore.score) : null;

    let avg: number | null = null;
    if (cVal !== null && uVal !== null) {
      avg = Math.round(((cVal + uVal) / 2) * 100) / 100;
    }

    return {
      key: criterion.key,
      name: criterion.name,
      maxScore: criterion.maxScore,
      companyScore: cVal,
      companyComment: cScore?.comment || null,
      universityScore: uVal,
      universityComment: uScore?.comment || null,
      averageScore: avg,
    };
  });

  return {
    internship,
    companyEval,
    universityEval,
    breakdown,
    isBothSubmitted,
    finalScore,
  };
}

router.get('/evaluation/:internshipId/excel', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const data = await getEvaluationData(req, req.params.internshipId);
    if ('error' in data && data.error) {
      res.status(data.error.status).json({ error: { message: data.error.message, status: data.error.status } });
      return;
    }

    const { internship, companyEval, universityEval, breakdown, isBothSubmitted, finalScore } = data;
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Elektron Kundalik Tizimi';
    workbook.created = new Date();

    const ws = workbook.addWorksheet('Yakuniy baholash', {
      views: [{ state: 'frozen', ySplit: 7 }],
    });

    ws.mergeCells('A1:G1');
    const titleCell = ws.getCell('A1');
    titleCell.value = 'TALABANING AMALIYOT BO‘YICHA YAKUNIY BAHOLASH HISOBOTI';
    titleCell.font = { name: 'Arial', size: 13, bold: true, color: { argb: 'FF1E293B' } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getRow(1).height = 28;

    ws.getCell('A3').value = 'Talaba:';
    ws.getCell('B3').value = internship.student.fullName;
    ws.getCell('A4').value = 'Guruh:';
    ws.getCell('B4').value = internship.student.studentProfile?.group?.name || '—';
    ws.getCell('D3').value = 'Korxona:';
    ws.getCell('E3').value = internship.company.name;
    ws.getCell('D4').value = 'Yakuniy natija:';
    ws.getCell('E4').value = isBothSubmitted ? `${finalScore} / ${TOTAL_MAX_SCORE} ball (Yakunlangan)` : 'Baholash jarayonda (Yakunlanmagan)';
    ws.getCell('E4').font = { bold: true, color: { argb: isBothSubmitted ? 'FF16A34A' : 'FFD97706' } };

    for (const r of [3, 4]) {
      ws.getRow(r).font = { name: 'Arial', size: 9 };
      ws.getCell(`A${r}`).font = { name: 'Arial', size: 9, bold: true };
      ws.getCell(`D${r}`).font = { name: 'Arial', size: 9, bold: true };
    }

    ws.columns = [
      { key: 'num', width: 6 },
      { key: 'criterion', width: 32 },
      { key: 'max', width: 14 },
      { key: 'companyScore', width: 16 },
      { key: 'companyComment', width: 28 },
      { key: 'uniScore', width: 16 },
      { key: 'uniComment', width: 28 },
    ];

    const headerRow = ws.getRow(7);
    headerRow.values = [
      '№',
      'Baholash mezoni',
      'Maks. ball',
      'Korxona bali',
      'Korxona izohi',
      'Muassasa bali',
      'Muassasa izohi',
    ];
    styleExcelHeader(ws, 7);

    let rowIdx = 8;
    for (let i = 0; i < breakdown.length; i++) {
      const b = breakdown[i];
      const row = ws.getRow(rowIdx);
      row.values = [
        i + 1,
        b.name,
        b.maxScore,
        b.companyScore !== null ? b.companyScore : '—',
        b.companyComment || '—',
        b.universityScore !== null ? b.universityScore : '—',
        b.universityComment || '—',
      ];
      row.alignment = { vertical: 'middle', wrapText: true };
      row.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
      row.getCell(3).alignment = { horizontal: 'center', vertical: 'middle' };
      row.getCell(4).alignment = { horizontal: 'center', vertical: 'middle' };
      row.getCell(6).alignment = { horizontal: 'center', vertical: 'middle' };
      rowIdx++;
    }

    const sumRow = ws.getRow(rowIdx);
    sumRow.values = [
      '',
      'JAMI TO‘PLANGAN BALL',
      TOTAL_MAX_SCORE,
      companyEval ? Number(companyEval.totalScore) : '—',
      companyEval?.generalComment || '—',
      universityEval ? Number(universityEval.totalScore) : '—',
      universityEval?.generalComment || '—',
    ];
    sumRow.font = { name: 'Arial', bold: true };
    sumRow.alignment = { vertical: 'middle', wrapText: true };
    sumRow.getCell(3).alignment = { horizontal: 'center' };
    sumRow.getCell(4).alignment = { horizontal: 'center' };
    sumRow.getCell(6).alignment = { horizontal: 'center' };

    applyExcelBorders(ws, 7, rowIdx, 7);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="baholash_${internship.student.fullName.replace(/\s+/g, '_')}.xlsx"`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    next(error);
  }
});

router.get('/evaluation/:internshipId/pdf', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const data = await getEvaluationData(req, req.params.internshipId);
    if ('error' in data && data.error) {
      res.status(data.error.status).json({ error: { message: data.error.message, status: data.error.status } });
      return;
    }

    const { internship, companyEval, universityEval, breakdown, isBothSubmitted, finalScore } = data;
    const doc = new PDFDocument({ margin: 40, size: 'A4', bufferPages: true });
    setupPdfFonts(doc);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="baholash_${internship.student.fullName.replace(/\s+/g, '_')}.pdf"`);
    doc.pipe(res);

    const metaDetails = [
      { label: 'Talaba', value: internship.student.fullName },
      { label: 'Guruh', value: internship.student.studentProfile?.group?.name || '—' },
      { label: 'Korxona', value: internship.company.name },
      { label: 'Korxona rahbari', value: internship.companySupervisor?.fullName || '—' },
      { label: "Ta'lim muassasasi rahbari", value: internship.universitySupervisor?.fullName || '—' },
      {
        label: 'Yakuniy natija',
        value: isBothSubmitted ? `${finalScore} / ${TOTAL_MAX_SCORE} ball (Tasdiqlangan)` : 'Baholash hali yakunlanmagan',
      },
    ];

    let y = drawPdfHeader(doc, 'Amaliyot Yakuniy Baholash Hisoboti', 'Amaliyot mezonlari bo‘yicha qo‘yilgan ballar va sharhlar', metaDetails);

    const colX = [40, 225, 275, 340, 405, 465];
    const colW = [185, 50, 65, 65, 60, 90];

    const drawTableHeader = (curY: number) => {
      doc.rect(40, curY, 515, 22).fill('#334155');
      doc.font(getFont(doc, true)).fontSize(8).fillColor('#ffffff');
      doc.text('Mezon', colX[0] + 4, curY + 7, { width: colW[0] - 8 });
      doc.text('Maks', colX[1] + 4, curY + 7, { width: colW[1] - 8, align: 'center' });
      doc.text('Korxona', colX[2] + 4, curY + 7, { width: colW[2] - 8, align: 'center' });
      doc.text('Muassasa', colX[3] + 4, curY + 7, { width: colW[3] - 8, align: 'center' });
      doc.text('O‘rtacha', colX[4] + 4, curY + 7, { width: colW[4] - 8, align: 'center' });
      doc.text('Izohlar', colX[5] + 4, curY + 7, { width: colW[5] - 8 });
      return curY + 22;
    };

    y = drawTableHeader(y);

    let isAlt = false;
    for (const b of breakdown) {
      doc.font(getFont(doc, false)).fontSize(8);
      const commentsText = [b.companyComment ? `Korxona: ${b.companyComment}` : '', b.universityComment ? `Muassasa: ${b.universityComment}` : ''].filter(Boolean).join('\n') || '—';
      const commHeight = doc.heightOfString(commentsText, { width: colW[5] - 8 });
      const nameHeight = doc.heightOfString(b.name, { width: colW[0] - 8 });
      const rowH = Math.max(22, commHeight + 10, nameHeight + 10);

      if (y + rowH > doc.page.height - 50) {
        doc.addPage();
        y = 40;
        y = drawTableHeader(y);
      }

      if (isAlt) {
        doc.rect(40, y, 515, rowH).fill('#f8fafc');
      }
      doc.rect(40, y, 515, rowH).stroke('#e2e8f0');

      doc.fillColor('#0f172a');
      doc.font(getFont(doc, true)).text(b.name, colX[0] + 4, y + 6, { width: colW[0] - 8 });
      doc.font(getFont(doc, false)).text(String(b.maxScore), colX[1] + 4, y + 6, { width: colW[1] - 8, align: 'center' });
      doc.text(b.companyScore !== null ? String(b.companyScore) : '—', colX[2] + 4, y + 6, { width: colW[2] - 8, align: 'center' });
      doc.text(b.universityScore !== null ? String(b.universityScore) : '—', colX[3] + 4, y + 6, { width: colW[3] - 8, align: 'center' });
      doc.text(b.averageScore !== null ? String(b.averageScore) : '—', colX[4] + 4, y + 6, { width: colW[4] - 8, align: 'center' });
      doc.text(commentsText, colX[5] + 4, y + 6, { width: colW[5] - 8 });

      y += rowH;
      isAlt = !isAlt;
    }

    y += 10;
    if (y + 60 > doc.page.height - 40) {
      doc.addPage();
      y = 40;
    }

    doc.rect(40, y, 515, 52).fillAndStroke(isBothSubmitted ? '#f0fdf4' : '#fffbeb', isBothSubmitted ? '#86efac' : '#fde68a');
    doc.fillColor('#1e293b');
    doc.font(getFont(doc, true)).fontSize(10).text('Umumiy Baholash Xulosasi:', 52, y + 10);

    const cTotal = companyEval ? `${Number(companyEval.totalScore)} ball (${formatUzStatus(companyEval.status)})` : 'Kiritilmagan';
    const uTotal = universityEval ? `${Number(universityEval.totalScore)} ball (${formatUzStatus(universityEval.status)})` : 'Kiritilmagan';
    const fTotal = isBothSubmitted ? `${finalScore} ball` : 'Kutilmoqda (Ikkala rahbar tasdiqlashi shart)';

    doc.font(getFont(doc, false)).fontSize(8.5).text(`Korxona rahbari: ${cTotal}   |   Ta'lim muassasasi rahbari: ${uTotal}`, 52, y + 24);
    doc.font(getFont(doc, true)).fontSize(9.5).fillColor(isBothSubmitted ? '#15803d' : '#b45309').text(`YAKUNIY O‘RTACHA NATIJA: ${fTotal}`, 52, y + 37);

    drawPdfFooter(doc);
    doc.end();
  } catch (error) {
    next(error);
  }
});

export default router;
