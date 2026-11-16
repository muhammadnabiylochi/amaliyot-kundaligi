import express from 'express';
import cookieParser from 'cookie-parser';
import { PrismaClient } from '@prisma/client';
import apiRouter from '../src/routes';
import { errorHandler } from '../src/middleware/errorHandler';
import { generateToken } from '../src/middleware/auth';

const prisma = new PrismaClient();

function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api', apiRouter);
  app.use(errorHandler);
  return app;
}

async function request(
  app: express.Express,
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  path: string,
  token?: string,
  body?: any
): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, async () => {
      const port = (server.address() as any).port;
      try {
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        };
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
          headers['Cookie'] = `auth_token=${token}`;
        }

        const res = await fetch(`http://localhost:${port}${path}`, {
          method,
          headers,
          body: body ? JSON.stringify(body) : undefined,
        });

        const resBody = await res.json().catch(() => ({}));
        server.close(() => {
          resolve({ status: res.status, body: resBody });
        });
      } catch (err) {
        server.close(() => reject(err));
      }
    });
  });
}

async function runBugfixTests() {
  console.log('========================================================================');
  console.log('🧪 DIARY BUSINESS-RULE BUGFIX INTEGRATION TESTS');
  console.log('========================================================================\n');

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    total++;
    if (condition) {
      console.log(`  ✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${testName}`);
      if (detail) console.error(`     Detail: ${detail}`);
    }
  }

  const app = createTestApp();

  // Load test users
  const student = await prisma.user.findUnique({ where: { email: 'jasur.aliev@student.edu.uz' } });
  const supervisor = await prisma.user.findUnique({ where: { email: 'sherzod.nazarov@uzcard.uz' } });
  const admin = await prisma.user.findUnique({ where: { email: 'admin@edu.uz' } });

  if (!student || !supervisor || !admin) {
    throw new Error('Seed users not found in DB');
  }

  const studentToken = generateToken(student);
  const supervisorToken = generateToken(supervisor);
  const adminToken = generateToken(admin);

  const internship = await prisma.internship.findFirst({
    where: { studentId: student.id, status: 'ACTIVE' },
  });

  if (!internship) {
    throw new Error('Active internship not found for student');
  }

  // Clean up any test diary entries for dates we will use
  const testDates = ['2026-10-15', '2026-10-16', '2026-10-17', '2026-10-18', '2026-10-19'];
  await prisma.diaryEntry.deleteMany({
    where: {
      internshipId: internship.id,
      entryDate: { in: testDates.map((d) => new Date(`${d}T00:00:00.000Z`)) },
    },
  });

  // ──────────────────────────────────────────────────────────────────────────
  // TEST GROUP 1: Date validation (POST & PATCH)
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- TEST GROUP 1: Date Validation (dateGuards) ---');

  // Future dates are computed relative to today so the test never goes stale
  const futureYmd = (days: number) => new Date(Date.now() + days * 86400000).toISOString().split('T')[0];

  // 1a. POST with future date -> 400
  const futureRes = await request(app, 'POST', '/api/diary', studentToken, {
    entryDate: futureYmd(5), // always in the future
    taskTitle: 'Kelajakdagi ish',
    description: 'Kelajakda qilinadigan ish tavsifi',
    hours: 8,
    status: 'DRAFT',
  });
  assert(
    futureRes.status === 400 && futureRes.body.error?.message?.includes('kelajakdagi'),
    '1a. POST /api/diary: Kelajakdagi sana 400 xatosi bilan rad etiladi',
    JSON.stringify(futureRes.body)
  );

  // 1b. POST with date before internship startDate -> 400
  const beforeStartRes = await request(app, 'POST', '/api/diary', studentToken, {
    entryDate: '2026-08-15', // internship starts 2026-09-01
    taskTitle: 'Muddati oldingi ish',
    description: 'Amaliyotdan oldingi ish',
    hours: 8,
    status: 'DRAFT',
  });
  assert(
    beforeStartRes.status === 400 && beforeStartRes.body.error?.message?.includes('amaliyot davriga'),
    '1b. POST /api/diary: Amaliyot boshlanishidan oldingi sana 400 bilan rad etiladi',
    JSON.stringify(beforeStartRes.body)
  );

  // 1c. POST with valid date within internship and not in future -> 201
  const validCreateRes = await request(app, 'POST', '/api/diary', studentToken, {
    entryDate: '2026-10-15',
    taskTitle: 'Haqiqiy ish kuni',
    description: 'Bajarilgan haqiqiy vazifa tavsifi',
    hours: 8,
    status: 'DRAFT',
  });
  assert(
    validCreateRes.status === 201 && validCreateRes.body.data?.id,
    '1c. POST /api/diary: To\'g\'ri sana bilan yozuv 201 Created qaytaradi',
    JSON.stringify(validCreateRes.body)
  );
  const entryId = validCreateRes.body.data.id;

  // 1d. PATCH date with future date -> 400
  const patchFutureRes = await request(app, 'PATCH', `/api/diary/${entryId}`, studentToken, {
    entryDate: futureYmd(10),
  });
  assert(
    patchFutureRes.status === 400 && patchFutureRes.body.error?.message?.includes('kelajakdagi'),
    '1d. PATCH /api/diary/:id: Kelajakdagi sana 400 bilan rad etiladi',
    JSON.stringify(patchFutureRes.body)
  );

  // 1e. PATCH date before internship startDate -> 400
  const patchBeforeRes = await request(app, 'PATCH', `/api/diary/${entryId}`, studentToken, {
    entryDate: '2026-08-20',
  });
  assert(
    patchBeforeRes.status === 400 && patchBeforeRes.body.error?.message?.includes('amaliyot davriga'),
    '1e. PATCH /api/diary/:id: Amaliyot davridan tashqari sana 400 bilan rad etiladi',
    JSON.stringify(patchBeforeRes.body)
  );

  // ──────────────────────────────────────────────────────────────────────────
  // TEST GROUP 2: Student PATCH status constraints (DRAFT, RETURNED vs SUBMITTED, APPROVED)
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- TEST GROUP 2: Student PATCH status constraints ---');

  // 2a. Student can edit DRAFT entry -> 200
  const editDraftRes = await request(app, 'PATCH', `/api/diary/${entryId}`, studentToken, {
    taskTitle: 'Tahrirlangan DRAFT vazifa',
  });
  assert(
    editDraftRes.status === 200 && editDraftRes.body.data?.taskTitle === 'Tahrirlangan DRAFT vazifa',
    '2a. PATCH /api/diary/:id: STUDENT o\'z DRAFT kundaligini muvaffaqiyatli tahrirlay oladi (200)',
    JSON.stringify(editDraftRes.body)
  );

  // 2b. Student submits entry (DRAFT -> SUBMITTED) -> 200
  const submitRes = await request(app, 'PATCH', `/api/diary/${entryId}`, studentToken, {
    status: 'SUBMITTED',
  });
  assert(
    submitRes.status === 200 && submitRes.body.data?.status === 'SUBMITTED',
    '2b. PATCH /api/diary/:id: STUDENT kundalikni topshiradi (DRAFT -> SUBMITTED)',
    JSON.stringify(submitRes.body)
  );

  // 2c. STUDENT attempts to edit SUBMITTED entry -> MUST BE 400
  const editSubmittedRes = await request(app, 'PATCH', `/api/diary/${entryId}`, studentToken, {
    taskTitle: 'Noqonuniy tahrir urinishi',
  });
  assert(
    editSubmittedRes.status === 400 &&
      editSubmittedRes.body.error?.message?.includes('Topshirilgan (SUBMITTED)'),
    '2c. PATCH /api/diary/:id: STUDENT topshirilgan (SUBMITTED) kundalikni tahrirlay olmaydi (400 rad etildi)',
    JSON.stringify(editSubmittedRes.body)
  );

  // 2d. STUDENT attempts to revert SUBMITTED back to DRAFT -> MUST BE 400
  const revertSubmittedRes = await request(app, 'PATCH', `/api/diary/${entryId}`, studentToken, {
    status: 'DRAFT',
  });
  assert(
    revertSubmittedRes.status === 400,
    '2d. PATCH /api/diary/:id: STUDENT topshirilgan kundalikni DRAFT ga qaytara olmaydi (400 rad etildi)',
    JSON.stringify(revertSubmittedRes.body)
  );

  // ──────────────────────────────────────────────────────────────────────────
  // TEST GROUP 3: Review validation & Atomic transition (POST /api/diary/:id/review)
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- TEST GROUP 3: Review Validation & Atomic Status Transition ---');

  // 3a. Invalid decision enum ('rejected' or 'invalid') -> 400
  const invalidDecisionRes = await request(app, 'POST', `/api/diary/${entryId}/review`, supervisorToken, {
    decision: 'rejected',
    comment: 'Qaytarildi',
  });
  assert(
    invalidDecisionRes.status === 400 &&
      invalidDecisionRes.body.error?.message?.includes("approved' yoki 'returned"),
    "3a. POST /api/diary/:id/review: Noto'g'ri qaror ('rejected') 400 bilan rad etiladi",
    JSON.stringify(invalidDecisionRes.body)
  );

  // 3b. decision = 'returned' WITHOUT comment -> 400 (comment is REQUIRED for returned)
  const returnedNoCommentRes = await request(app, 'POST', `/api/diary/${entryId}/review`, supervisorToken, {
    decision: 'returned',
  });
  assert(
    returnedNoCommentRes.status === 400 &&
      returnedNoCommentRes.body.error?.message?.includes('izoh (comment) kiritilishi shart'),
    "3b. POST /api/diary/:id/review: 'returned' qarorida izohsiz yuborish 400 bilan rad etiladi",
    JSON.stringify(returnedNoCommentRes.body)
  );

  // 3c. decision = 'returned' with empty whitespace comment -> 400
  const returnedEmptyCommentRes = await request(app, 'POST', `/api/diary/${entryId}/review`, supervisorToken, {
    decision: 'returned',
    comment: '   ',
  });
  assert(
    returnedEmptyCommentRes.status === 400,
    "3c. POST /api/diary/:id/review: 'returned' bo'sh izoh bilan 400 bilan rad etiladi",
    JSON.stringify(returnedEmptyCommentRes.body)
  );

  // 3d. decision = 'returned' WITH valid comment -> 200
  const returnedValidRes = await request(app, 'POST', `/api/diary/${entryId}/review`, supervisorToken, {
    decision: 'returned',
    comment: 'Iltimos, ish natijalarini to\'liqroq yozing.',
  });
  assert(
    returnedValidRes.status === 200 && returnedValidRes.body.data?.status === 'RETURNED',
    "3d. POST /api/diary/:id/review: 'returned' to'g'ri izoh bilan 200 OK qaytaradi",
    JSON.stringify(returnedValidRes.body)
  );

  // 3e. Now that entry is RETURNED, student CAN edit it again!
  const editReturnedRes = await request(app, 'PATCH', `/api/diary/${entryId}`, studentToken, {
    taskTitle: 'Tuzatilgan vazifa',
    description: 'Batafsilroq yozilgan tavsif',
    status: 'SUBMITTED', // re-submit
  });
  assert(
    editReturnedRes.status === 200 && editReturnedRes.body.data?.status === 'SUBMITTED',
    '3e. PATCH /api/diary/:id: STUDENT qaytarilgan (RETURNED) kundalikni tahrirlab qayta topshira oladi (200 OK)',
    JSON.stringify(editReturnedRes.body)
  );

  // 3f. decision = 'approved' without comment -> 200 (comment optional for approved)
  const approveRes = await request(app, 'POST', `/api/diary/${entryId}/review`, supervisorToken, {
    decision: 'approved',
  });
  assert(
    approveRes.status === 200 && approveRes.body.data?.status === 'APPROVED',
    "3f. POST /api/diary/:id/review: 'approved' izohsiz ham muvaffaqiyatli tasdiqlanadi (200 OK)",
    JSON.stringify(approveRes.body)
  );

  // 3g. Atomic status guard: Reviewing an already APPROVED entry (not SUBMITTED) -> 400 / 409
  const doubleReviewRes = await request(app, 'POST', `/api/diary/${entryId}/review`, supervisorToken, {
    decision: 'approved',
  });
  assert(
    doubleReviewRes.status === 400 || doubleReviewRes.status === 409,
    '3g. POST /api/diary/:id/review: SUBMITTED bo\'lmagan yozuvni qayta baholash rad etiladi (400/409)',
    JSON.stringify(doubleReviewRes.body)
  );

  // ──────────────────────────────────────────────────────────────────────────
  // TEST GROUP 4: Immutable APPROVED entries (STUDENT & ADMIN)
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- TEST GROUP 4: Immutable APPROVED entries ---');

  // 4a. STUDENT tries to edit APPROVED entry -> 400
  const studentEditApprovedRes = await request(app, 'PATCH', `/api/diary/${entryId}`, studentToken, {
    taskTitle: 'Student approved tahrirlashga urindi',
  });
  assert(
    studentEditApprovedRes.status === 400 &&
      studentEditApprovedRes.body.error?.message?.includes('Tasdiqlangan'),
    '4a. PATCH /api/diary/:id: STUDENT tasdiqlangan (APPROVED) kundalikni o\'zgartira olmaydi (400 rad etildi)',
    JSON.stringify(studentEditApprovedRes.body)
  );

  // 4b. ADMIN tries to edit APPROVED entry -> MUST BE 400
  const adminEditApprovedRes = await request(app, 'PATCH', `/api/diary/${entryId}`, adminToken, {
    taskTitle: 'Admin approved tahrirlashga urindi',
  });
  assert(
    adminEditApprovedRes.status === 400 &&
      adminEditApprovedRes.body.error?.message?.includes('Tasdiqlangan'),
    '4b. PATCH /api/diary/:id: ADMIN ham tasdiqlangan (APPROVED) kundalikni o\'zgartira olmaydi (400 rad etildi)',
    JSON.stringify(adminEditApprovedRes.body)
  );

  // ──────────────────────────────────────────────────────────────────────────
  // TEST GROUP 5: Inactive Internship Guard
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- TEST GROUP 5: Inactive Internship Guard ---');

  // Create or mock an inactive internship
  const inactiveInternship = await prisma.internship.create({
    data: {
      studentId: student.id,
      companyId: internship.companyId,
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-03-31'),
      status: 'COMPLETED',
    },
  });

  const postInactiveRes = await request(app, 'POST', '/api/diary', studentToken, {
    internshipId: inactiveInternship.id,
    entryDate: '2026-02-15',
    taskTitle: 'Yakunlangan amaliyotga yozuv',
    description: 'Bu yozuv rad etilishi kerak',
    hours: 8,
  });
  assert(
    postInactiveRes.status === 400 &&
      postInactiveRes.body.error?.message?.includes('Faqat faol (ACTIVE) amaliyot'),
    '5a. POST /api/diary: No-faol (COMPLETED) amaliyotga kundalik yozish 400 bilan rad etiladi',
    JSON.stringify(postInactiveRes.body)
  );

  // Clean up inactive test internship
  await prisma.internship.delete({ where: { id: inactiveInternship.id } });

  // Clean up test entry
  await prisma.diaryReview.deleteMany({ where: { diaryEntryId: entryId } });
  await prisma.diaryEntry.deleteMany({ where: { id: entryId } });

  console.log('\n========================================================================');
  console.log(`📊 TEST NATIJALARI: ${passed}/${total} muvaffaqiyatli o'tdi.`);
  console.log('========================================================================\n');

  if (passed !== total) {
    process.exit(1);
  }
}

runBugfixTests()
  .catch((err) => {
    console.error('Test script execution error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
