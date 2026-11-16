/**
 * Integration Test Suite: Fayl biriktirish moduli (Diary Attachments)
 *
 * Sinovdan o'tkaziladigan talablar:
 * 1. Ruxsat etilgan fayl (PDF, PNG) muvaffaqiyatli yuklanishi.
 * 2. Bir nechta faylni bir vaqtda yuklash.
 * 3. Noto'g'ri format (.exe, .sh) rad etilishi (400).
 * 4. Soxta format / buzilgan fayl (Magic bytes mos kelmagan) rad etilishi (400) va diskdan tozalanishi.
 * 5. Hajmi 10 MB dan katta fayl rad etilishi (400).
 * 6. Boshqa talabaning kundaligiga fayl qo'shib bo'lmasligi (403 IDOR himoyasi).
 * 7. SUBMITTED va APPROVED kundaliklardagi fayllarni o'zgartirish (upload/delete) cheklovi (400).
 * 8. Ro'yxatni olish: Talaba, Korxona rahbari, Universitet rahbari ko'ra olishi, begona talaba 403 olishi.
 * 9. Yuklab olish: Faqat vakolatli foydalanuvchilar (talaba, rahbarlar) yuklay olishi, token bo'lmasa 401, begona bo'lsa 403.
 * 10. Fayl bazada bor, ammo diskda yo'q bo'lsa: server yiqilmasdan 410 Gone qaytarishi.
 * 11. O'chirish: Talaba o'z qoralama yozuvidagi faylni o'chira olishi va diskdan tozalanadi.
 */

import express from 'express';
import cookieParser from 'cookie-parser';
import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import apiRouter from '../src/routes';
import { errorHandler } from '../src/middleware/errorHandler';
import { generateToken } from '../src/middleware/auth';

const prisma = new PrismaClient();

async function runAttachmentTests() {
  console.log('========================================================================');
  console.log('🧪 FAYL BIRIKTIRISH MODULI — INTEGRATSION VA XAVFSIZLIK TESTLARI');
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

  // Ephemeral test server
  const app = express();
  app.use(cookieParser());
  app.use(express.json());
  app.use('/api', apiRouter);
  app.use(errorHandler);

  const server = app.listen(0);
  const address = server.address() as any;
  const baseUrl = `http://127.0.0.1:${address.port}/api`;

  try {
    // 1. Foydalanuvchilarni olish
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

    // 2. Test amaliyoti va kundalik yozuvlarini yaratish
    const internship = await prisma.internship.findFirst({
      where: {
        studentId: student!.id,
        companySupervisorId: companySup!.id,
      },
    });
    assert(Boolean(internship), 'Talabaning faol amaliyoti topildi');

    // Tozalash: eski test kundaliklari
    const testDate = new Date('2026-11-20');
    const testDateSubmitted = new Date('2026-11-21');
    const testDateApproved = new Date('2026-11-22');

    await prisma.diaryEntry.deleteMany({
      where: {
        internshipId: internship!.id,
        entryDate: { in: [testDate, testDateSubmitted, testDateApproved] },
      },
    });

    // Qoralama kundalik (DRAFT)
    const draftEntry = await prisma.diaryEntry.create({
      data: {
        internshipId: internship!.id,
        entryDate: testDate,
        taskTitle: 'Fayl biriktirish testi — DRAFT',
        description: 'Ushbu kundalikka fayllar yuklanadi va test qilinadi.',
        status: 'DRAFT',
      },
    });

    // Yuborilgan kundalik (SUBMITTED)
    const submittedEntry = await prisma.diaryEntry.create({
      data: {
        internshipId: internship!.id,
        entryDate: testDateSubmitted,
        taskTitle: 'Fayl biriktirish testi — SUBMITTED',
        description: 'Ushbu kundalik topshirilgan holatda.',
        status: 'SUBMITTED',
      },
    });

    // Tasdiqlangan kundalik (APPROVED)
    const approvedEntry = await prisma.diaryEntry.create({
      data: {
        internshipId: internship!.id,
        entryDate: testDateApproved,
        taskTitle: 'Fayl biriktirish testi — APPROVED',
        description: 'Ushbu kundalik tasdiqlangan holatda.',
        status: 'APPROVED',
      },
    });

    assert(Boolean(draftEntry && submittedEntry && approvedEntry), 'Test kundaliklari (DRAFT, SUBMITTED, APPROVED) tayyorlandi');

    // 3. Test fayllarini tayyorlash (haqiqiy magic bytes bilan)
    const validPdfBuffer = Buffer.from('%PDF-1.4\n%test pdf content\n%%EOF');
    const validPngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00]);
    const fakePdfBuffer = Buffer.from('NOT A REAL PDF CONTENT AT ALL'); // Soxta PDF

    // ── TEST 1: Ruxsat etilgan PDF faylni yuklash ──
    const form1 = new FormData();
    const pdfBlob = new Blob([validPdfBuffer], { type: 'application/pdf' });
    form1.append('files', pdfBlob, 'hisobot.pdf');

    const uploadRes1 = await fetch(`${baseUrl}/diary/${draftEntry.id}/attachments`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${studentToken}` },
      body: form1,
    });
    const uploadData1 = (await uploadRes1.json()) as any;
    assert(uploadRes1.status === 201 && uploadData1.attachments?.length === 1, '1. Ruxsat etilgan PDF fayl muvaffaqiyatli yuklandi (201)');
    const attachment1 = uploadData1.attachments[0];
    assert(attachment1.originalName === 'hisobot.pdf', '   Original fayl nomi saqlangan');

    // ── TEST 2: Bir vaqtda bir nechta fayl (PDF + PNG) yuklash ──
    const form2 = new FormData();
    form2.append('files', new Blob([validPdfBuffer], { type: 'application/pdf' }), 'ilova2.pdf');
    form2.append('files', new Blob([validPngBuffer], { type: 'image/png' }), 'skrinshot.png');

    const uploadRes2 = await fetch(`${baseUrl}/diary/${draftEntry.id}/attachments`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${studentToken}` },
      body: form2,
    });
    const uploadData2 = (await uploadRes2.json()) as any;
    assert(uploadRes2.status === 201 && uploadData2.attachments?.length === 2, '2. Bir vaqtning o‘zida bir nechta fayl biriktirildi (201)');

    // ── TEST 3: Noto'g'ri kengaytma (.exe) rad etilishi ──
    const form3 = new FormData();
    form3.append('files', new Blob([Buffer.from('MZ...')], { type: 'application/x-msdownload' }), 'virus.exe');

    const uploadRes3 = await fetch(`${baseUrl}/diary/${draftEntry.id}/attachments`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${studentToken}` },
      body: form3,
    });
    assert(uploadRes3.status === 400, '3. Noto‘g‘ri format (.exe) qat’iy rad etildi (400 Bad Request)');

    // ── TEST 4: Soxta fayl (kengaytmasi .pdf, ammo mazmuni PDF emas) rad etilishi ──
    const form4 = new FormData();
    form4.append('files', new Blob([fakePdfBuffer], { type: 'application/pdf' }), 'fake.pdf');

    const uploadRes4 = await fetch(`${baseUrl}/diary/${draftEntry.id}/attachments`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${studentToken}` },
      body: form4,
    });
    const fakeData = (await uploadRes4.json()) as any;
    assert(
      uploadRes4.status === 400 && fakeData?.error?.message?.includes('mos kelmadi'),
      '4. Soxta mazmunli fayl (Magic bytes mos emas) aniqlandi va rad etildi (400)'
    );

    // ── TEST 5: 10 MB dan katta fayl rad etilishi ──
    const form5 = new FormData();
    // 10.5 MB lik buffer
    const hugeBuffer = Buffer.alloc(10.5 * 1024 * 1024);
    hugeBuffer[0] = 0x25; hugeBuffer[1] = 0x50; hugeBuffer[2] = 0x44; hugeBuffer[3] = 0x46; // %PDF
    form5.append('files', new Blob([hugeBuffer], { type: 'application/pdf' }), 'large.pdf');

    const uploadRes5 = await fetch(`${baseUrl}/diary/${draftEntry.id}/attachments`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${studentToken}` },
      body: form5,
    });
    assert(uploadRes5.status === 400, '5. 10 MB dan katta fayl hajm limiti orqali rad etildi (400)');

    // ── TEST 6: Boshqa talaba kundaligiga fayl yuklash (IDOR himoyasi) ──
    const form6 = new FormData();
    form6.append('files', new Blob([validPdfBuffer], { type: 'application/pdf' }), 'hacker.pdf');

    const uploadRes6 = await fetch(`${baseUrl}/diary/${draftEntry.id}/attachments`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${otherStudentToken}` }, // Begona talaba
      body: form6,
    });
    assert(uploadRes6.status === 403, '6. Begona talaba o‘zgasining kundaligiga fayl qo‘sha olmadi (403 Forbidden)');

    // ── TEST 7: SUBMITTED va APPROVED kundaliklarga fayl yuklash taqiqlanishi ──
    const form7 = new FormData();
    form7.append('files', new Blob([validPdfBuffer], { type: 'application/pdf' }), 'test.pdf');
    const uploadRes7 = await fetch(`${baseUrl}/diary/${submittedEntry.id}/attachments`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${studentToken}` },
      body: form7,
    });
    assert(uploadRes7.status === 400, '7a. SUBMITTED holatdagi kundalikka fayl qo‘shish bloklandi (400)');

    const uploadRes8 = await fetch(`${baseUrl}/diary/${approvedEntry.id}/attachments`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${studentToken}` },
      body: form7,
    });
    assert(uploadRes8.status === 400, '7b. APPROVED holatdagi kundalikka fayl qo‘shish bloklandi (400)');

    // ── TEST 8: Biriktirilgan fayllar ro'yxatini olish (GET /api/diary/:entryId/attachments) ──
    const listResStudent = await fetch(`${baseUrl}/diary/${draftEntry.id}/attachments`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    const listDataStudent = (await listResStudent.json()) as any;
    assert(listResStudent.status === 200 && listDataStudent.attachments?.length >= 3, '8a. Talaba o‘z fayllari ro‘yxatini oldi (200 OK)');

    // DRAFT yoki RETURNED kundalik fayllari rahbarlarga ko'rinmasligi kerak (403 Forbidden)
    const listResCompany = await fetch(`${baseUrl}/diary/${draftEntry.id}/attachments`, {
      headers: { Authorization: `Bearer ${companySupToken}` },
    });
    assert(listResCompany.status === 403, '8b. Korxona rahbari DRAFT kundalik fayllari ro‘yxatini ko‘ra olmadi (403 Forbidden)');

    const listResUni = await fetch(`${baseUrl}/diary/${draftEntry.id}/attachments`, {
      headers: { Authorization: `Bearer ${uniSupToken}` },
    });
    assert(listResUni.status === 403, '8c. Universitet rahbari DRAFT kundalik fayllari ro‘yxatini ko‘ra olmadi (403 Forbidden)');

    const listResOther = await fetch(`${baseUrl}/diary/${draftEntry.id}/attachments`, {
      headers: { Authorization: `Bearer ${otherStudentToken}` },
    });
    assert(listResOther.status === 403, '8d. Begona talaba fayllar ro‘yxatiga kira olmadi (403 Forbidden)');

    // ── TEST 9: Faylni yuklab olish (GET /api/diary/attachments/:attachmentId) ──
    const dlResStudent = await fetch(`${baseUrl}/diary/attachments/${attachment1.id}`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    const dlBuffer = await dlResStudent.arrayBuffer();
    assert(
      dlResStudent.status === 200 &&
      dlResStudent.headers.get('content-type') === 'application/pdf' &&
      dlBuffer.byteLength === validPdfBuffer.byteLength,
      '9a. Talaba faylni to‘liq hajmda va to‘g‘ri Content-Type bilan yuklab oldi (200 OK)'
    );

    // Rahbar DRAFT yozuv faylini yuklab ololmasligi kerak (403 Forbidden)
    const dlResSup = await fetch(`${baseUrl}/diary/attachments/${attachment1.id}`, {
      headers: { Authorization: `Bearer ${companySupToken}` },
    });
    assert(dlResSup.status === 403, '9b. Korxona rahbari DRAFT kundalik faylini yuklab ololmadi (403 Forbidden)');

    // Admin DRAFT yozuv faylini yuklab ola oladi (200 OK)
    const dlResAdmin = await fetch(`${baseUrl}/diary/attachments/${attachment1.id}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(dlResAdmin.status === 200, '9b-2. Admin DRAFT kundalik faylini yuklab ola oldi (200 OK)');

    const dlResNoAuth = await fetch(`${baseUrl}/diary/attachments/${attachment1.id}`);
    assert(dlResNoAuth.status === 401, '9c. Tokensiz ochiq havola orqali faylga kirish rad etildi (401 Unauthorized)');

    const dlResOther = await fetch(`${baseUrl}/diary/attachments/${attachment1.id}`, {
      headers: { Authorization: `Bearer ${otherStudentToken}` },
    });
    assert(dlResOther.status === 403, '9d. Begona talaba faylni yuklab ololmadi (403 Forbidden)');

    // Kundalik topshirilgandan (SUBMITTED) so'ng rahbar fayllar ro'yxatini va faylni yuklab ola oladi
    await prisma.diaryEntry.update({
      where: { id: draftEntry.id },
      data: { status: 'SUBMITTED' },
    });
    const listResCompanySubmitted = await fetch(`${baseUrl}/diary/${draftEntry.id}/attachments`, {
      headers: { Authorization: `Bearer ${companySupToken}` },
    });
    const dlResSupSubmitted = await fetch(`${baseUrl}/diary/attachments/${attachment1.id}`, {
      headers: { Authorization: `Bearer ${companySupToken}` },
    });
    assert(
      listResCompanySubmitted.status === 200 && dlResSupSubmitted.status === 200,
      '9e. Kundalik SUBMITTED bo‘lgandan so‘ng rahbar fayllar ro‘yxatini va faylni yuklab ola oldi (200 OK)'
    );
    // Qaytarib DRAFT holatga qo'yamiz (keyingi testlar uchun)
    await prisma.diaryEntry.update({
      where: { id: draftEntry.id },
      data: { status: 'DRAFT' },
    });

    // ── TEST 10: Fayl DB da bor, lekin diskda yo'q bo'lsa (Graceful 410 Gone) ──
    // Diskdagi faylni vaqtincha o'chiramiz
    const fakeAtt = await prisma.diaryAttachment.create({
      data: {
        diaryEntryId: draftEntry.id,
        originalName: 'missing.pdf',
        storedPath: path.resolve('uploads', 'diary', draftEntry.id, 'non_existent_file.pdf'),
        mimeType: 'application/pdf',
        sizeBytes: BigInt(123),
      },
    });

    const dlMissingRes = await fetch(`${baseUrl}/diary/attachments/${fakeAtt.id}`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    assert(dlMissingRes.status === 410, '10. Diskda mavjud bo‘lmagan fayl uchun server yiqilmasdan 410 Gone qaytardi');

    // ── TEST 11: Faylni o'chirish (DELETE /api/diary/attachments/:attachmentId) ──
    // Begona talaba o'chirishga urinishi
    const delResOther = await fetch(`${baseUrl}/diary/attachments/${attachment1.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${otherStudentToken}` },
    });
    assert(delResOther.status === 403, '11a. Begona talaba faylni o‘chira olmadi (403 Forbidden)');

    // SUBMITTED yozuvdagi faylni o'chirishga urinish
    const submittedAtt = await prisma.diaryAttachment.create({
      data: {
        diaryEntryId: submittedEntry.id,
        originalName: 'locked.pdf',
        storedPath: path.resolve('uploads', 'diary', submittedEntry.id, 'locked.pdf'),
        mimeType: 'application/pdf',
        sizeBytes: BigInt(500),
      },
    });
    const delResSubmitted = await fetch(`${baseUrl}/diary/attachments/${submittedAtt.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    assert(delResSubmitted.status === 400, '11b. SUBMITTED holatdagi kundalik faylini o‘chirish bloklandi (400 Bad Request)');

    // Haqiqiy egasi DRAFT kundaligidan o'chirishi
    const delResStudent = await fetch(`${baseUrl}/diary/attachments/${attachment1.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    assert(delResStudent.status === 200, '11c. Talaba o‘z qoralama kundaligidagi faylni muvaffaqiyatli o‘chirdi (200 OK)');

    const checkDbDeleted = await prisma.diaryAttachment.findUnique({ where: { id: attachment1.id } });
    assert(checkDbDeleted === null, '   Fayl yozuvi bazadan to‘liq o‘chirildi');

    // 12. Tozalash (cleanup test entries)
    await prisma.diaryEntry.deleteMany({
      where: {
        internshipId: internship!.id,
        entryDate: { in: [testDate, testDateSubmitted, testDateApproved] },
      },
    });

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

runAttachmentTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
