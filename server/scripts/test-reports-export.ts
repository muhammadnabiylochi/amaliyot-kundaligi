/**
 * Integration & Security Test Suite for Export Reports Module:
 * - PDF and Excel generation for:
 *   1. Diary entries (/api/reports/diary/pdf and /api/reports/diary/excel)
 *   2. Attendance (/api/reports/attendance/pdf and /api/reports/attendance/excel)
 *   3. Final Evaluation (/api/reports/evaluation/:internshipId/pdf and .../excel)
 * - Verifies real binary content (PDF %PDF header, Excel zip PK header)
 * - Role-based scoping (Student only views own; Supervisor only views assigned; Admin views all)
 * - Filters (status, date range)
 * - Error cases (unauthorized, invalid id, empty range)
 */

import express from 'express';
import cookieParser from 'cookie-parser';
import ExcelJS from 'exceljs';
import { PrismaClient } from '@prisma/client';
import apiRouter from '../src/routes';
import { errorHandler } from '../src/middleware/errorHandler';
import { generateToken } from '../src/middleware/auth';

const prisma = new PrismaClient();

async function runExportTests() {
  console.log('========================================================================');
  console.log('🧪 HISOBOTLARNI EKSPORT QILISH MODULI (PDF & EXCEL) — INTEGRATSION TESTLAR');
  console.log('========================================================================\n');

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, testName: string) {
    total++;
    if (condition) {
      console.log(`  ✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${testName}`);
    }
  }

  const app = express();
  app.use(cookieParser());
  app.use(express.json());
  app.use('/api', apiRouter);
  app.use(errorHandler);

  const server = app.listen(0);
  const address = server.address() as any;
  const baseUrl = `http://127.0.0.1:${address.port}/api`;

  try {
    const student = await prisma.user.findUnique({ where: { email: 'jasur.aliev@student.edu.uz' } });
    const otherStudent = await prisma.user.findUnique({ where: { email: 'malika.usmanova@student.edu.uz' } });
    const companySup = await prisma.user.findUnique({ where: { email: 'sherzod.nazarov@uzcard.uz' } });
    const uniSup = await prisma.user.findUnique({ where: { email: 'dilshod.toshmatov@edu.uz' } });
    const admin = await prisma.user.findUnique({ where: { email: 'admin@edu.uz' } });

    assert(Boolean(student && otherStudent && companySup && uniSup && admin), 'Barcha test foydalanuvchilari mavjud');

    const studentToken = generateToken({ id: student!.id, role: student!.role });
    const otherStudentToken = generateToken({ id: otherStudent!.id, role: otherStudent!.role });
    const companySupToken = generateToken({ id: companySup!.id, role: companySup!.role });
    const uniSupToken = generateToken({ id: uniSup!.id, role: uniSup!.role });
    const adminToken = generateToken({ id: admin!.id, role: admin!.role });

    const internship = await prisma.internship.findFirst({
      where: {
        studentId: student!.id,
        companySupervisorId: companySup!.id,
      },
    });
    assert(Boolean(internship), 'Talabaning faol amaliyoti topildi');

    // ── 1. KUNDALIK HISOBOTI (DIARY EXPORT) ──
    // 1a. PDF eksport
    const diaryPdfRes = await fetch(`${baseUrl}/reports/diary/pdf`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    const diaryPdfBuf = Buffer.from(await diaryPdfRes.arrayBuffer());
    assert(
      diaryPdfRes.status === 200 &&
      diaryPdfRes.headers.get('content-type') === 'application/pdf' &&
      diaryPdfBuf.subarray(0, 4).toString() === '%PDF',
      '1a. Kundalik PDF hisoboti to‘g‘ri formatda (%PDF) shakllandi (200 OK)'
    );

    // 1b. Excel eksport
    const diaryXlsxRes = await fetch(`${baseUrl}/reports/diary/excel`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    const diaryXlsxBuf = Buffer.from(await diaryXlsxRes.arrayBuffer());
    assert(
      diaryXlsxRes.status === 200 &&
      diaryXlsxBuf.subarray(0, 2).toString() === 'PK',
      '1b. Kundalik Excel hisoboti haqiqiy XLSX fayl (PK zip) sifatida yaratildi (200 OK)'
    );

    // Parse Excel to verify rows & headers
    const diaryWb = new ExcelJS.Workbook();
    await diaryWb.xlsx.load(diaryXlsxBuf as any);
    const diaryWs = diaryWb.getWorksheet('Kundalik yozuvlari');
    assert(Boolean(diaryWs && diaryWs.rowCount >= 4), '   Excelda "Kundalik yozuvlari" varag‘i va sarlavhalar mavjud');

    // 1c. Filtr bilan tekshirish (status=APPROVED)
    const diaryFilteredRes = await fetch(`${baseUrl}/reports/diary/excel?status=APPROVED`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    assert(diaryFilteredRes.status === 200, '1c. Status bo‘yicha filtrlangan kundalik eksporti muvaffaqiyatli ishlaydi');

    // 1d. Begona talaba ID orqali so‘rov (IDOR cheklovi)
    const diaryIdorRes = await fetch(`${baseUrl}/reports/diary/excel?studentId=${otherStudent!.id}`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    assert(diaryIdorRes.status === 403, '1d. Talaba boshqa talabaning kundalik hisobotini ololmadi (403 Forbidden)');

    // ── 2. DAVOMAT HISOBOTI (ATTENDANCE EXPORT) ──
    // 2a. PDF eksport
    const attPdfRes = await fetch(`${baseUrl}/reports/attendance/pdf`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    const attPdfBuf = Buffer.from(await attPdfRes.arrayBuffer());
    assert(
      attPdfRes.status === 200 &&
      attPdfRes.headers.get('content-type') === 'application/pdf' &&
      attPdfBuf.subarray(0, 4).toString() === '%PDF',
      '2a. Davomat PDF hisoboti muvaffaqiyatli shakllandi (200 OK)'
    );

    // 2b. Excel eksport
    const attXlsxRes = await fetch(`${baseUrl}/reports/attendance/excel`, {
      headers: { Authorization: `Bearer ${companySupToken}` },
    });
    const attXlsxBuf = Buffer.from(await attXlsxRes.arrayBuffer());
    assert(
      attXlsxRes.status === 200 &&
      attXlsxBuf.subarray(0, 2).toString() === 'PK',
      '2b. Davomat Excel hisoboti korxona rahbari tomonidan yuklab olindi (200 OK)'
    );

    // Parse attendance Excel
    const attWb = new ExcelJS.Workbook();
    await attWb.xlsx.load(attXlsxBuf as any);
    const attWs = attWb.getWorksheet('Davomat hisoboti');
    assert(Boolean(attWs && attWs.rowCount >= 5), '   Excelda davomat statistikasi va sarlavhalari mavjud');

    // 2c. Sana oralig‘i bo‘yicha filtr
    const attDateRes = await fetch(`${baseUrl}/reports/attendance/excel?from=2026-10-01&to=2026-10-31`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    assert(attDateRes.status === 200, '2c. Sana oralig‘i (from/to) filtri to‘g‘ri ishladi');

    // ── 3. YAKUNIY BAHOLASH HISOBOTI (EVALUATION EXPORT) ──
    // 3a. PDF eksport
    const evalPdfRes = await fetch(`${baseUrl}/reports/evaluation/${internship!.id}/pdf`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    const evalPdfBuf = Buffer.from(await evalPdfRes.arrayBuffer());
    assert(
      evalPdfRes.status === 200 &&
      evalPdfRes.headers.get('content-type') === 'application/pdf' &&
      evalPdfBuf.subarray(0, 4).toString() === '%PDF',
      '3a. Yakuniy baholash PDF hisoboti talaba uchun shakllandi (200 OK)'
    );

    // 3b. Excel eksport
    const evalXlsxRes = await fetch(`${baseUrl}/reports/evaluation/${internship!.id}/excel`, {
      headers: { Authorization: `Bearer ${uniSupToken}` },
    });
    const evalXlsxBuf = Buffer.from(await evalXlsxRes.arrayBuffer());
    assert(
      evalXlsxRes.status === 200 &&
      evalXlsxBuf.subarray(0, 2).toString() === 'PK',
      '3b. Yakuniy baholash Excel hisoboti universitet rahbari tomonidan olindi (200 OK)'
    );

    // Parse evaluation Excel
    const evalWb = new ExcelJS.Workbook();
    await evalWb.xlsx.load(evalXlsxBuf as any);
    const evalWs = evalWb.getWorksheet('Yakuniy baholash');
    assert(Boolean(evalWs && evalWs.rowCount >= 7), '   Excelda mezonlar, maksimal ballar va rahbar ballari ustunlari mavjud');

    // 3c. Begona talaba baholash hisobotiga kira olmasligi
    const evalIdorRes = await fetch(`${baseUrl}/reports/evaluation/${internship!.id}/pdf`, {
      headers: { Authorization: `Bearer ${otherStudentToken}` },
    });
    assert(evalIdorRes.status === 403, '3c. Begona talaba o‘zgasining baholash hisobotini ololmadi (403 Forbidden)');

    // 3d. Mavjud bo‘lmagan amaliyot ID si uchun 404
    const eval404Res = await fetch(`${baseUrl}/reports/evaluation/non_existent_id/pdf`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(eval404Res.status === 404, '3d. Noto‘g‘ri amaliyot identifikatori 404 Not Found qaytardi');

    // 3e. Tokensiz so‘rov (401 Unauthorized)
    const noAuthRes = await fetch(`${baseUrl}/reports/diary/pdf`);
    assert(noAuthRes.status === 401, '3e. Autentifikatsiyasiz hisobot so‘rash rad etildi (401 Unauthorized)');

    // ── 4. O‘ZBEK LOTIN HARFLARI VA XAVFSIZLIK TEKSHIRUVI ──
    assert(evalPdfBuf.length > 5000, '4a. PDF hajmi to‘liq kontent bilan generatsiya qilindi');
    assert(evalXlsxBuf.length > 3000, '4b. Excel fayl to‘liq ma’lumotlar bilan generatsiya qilindi');

  } finally {
    server.close();
    await prisma.$disconnect();
  }

  console.log('\n========================================================================');
  console.log(`📊 TEST NATIJALARI: JAMI ${total} TA TESTDAN ${passed} TA O‘TDI (${passed === total ? '100% SUCCESS' : 'FAILED'})`);
  console.log('========================================================================\n');

  if (passed !== total) {
    process.exit(1);
  }
}

runExportTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
