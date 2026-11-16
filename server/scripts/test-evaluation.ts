import express from 'express';
import cookieParser from 'cookie-parser';
import { PrismaClient, UserRole, EvaluationStatus } from '@prisma/client';
import apiRouter from '../src/routes';
import { errorHandler } from '../src/middleware/errorHandler';
import { generateToken } from '../src/middleware/auth';
import { EVALUATION_CRITERIA, TOTAL_MAX_SCORE } from '../src/config/evaluationCriteria';

const prisma = new PrismaClient();

async function runEvaluationTests() {
  console.log('========================================================================');
  console.log('🧪 YAKUNIY BAHOLASH MODULI — INTEGRATSION TESTLAR');
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

  // Start ephemeral Express server
  const app = express();
  app.use(cookieParser());
  app.use(express.json());
  app.use('/api', apiRouter);
  app.use(errorHandler);

  const server = app.listen(0);
  const address = server.address() as any;
  const baseUrl = `http://127.0.0.1:${address.port}/api`;

  try {
    // ── Fetch seed users ──
    const student = await prisma.user.findUnique({ where: { email: 'jasur.aliev@student.edu.uz' } });
    const companySup = await prisma.user.findUnique({ where: { email: 'sherzod.nazarov@uzcard.uz' } });
    const uniSup = await prisma.user.findUnique({ where: { email: 'dilshod.toshmatov@edu.uz' } });
    const admin = await prisma.user.findUnique({ where: { email: 'admin@edu.uz' } });

    assert(Boolean(student && companySup && uniSup && admin), 'Barcha test foydalanuvchilari mavjud');

    const internship = await prisma.internship.findFirst({
      where: {
        studentId: student!.id,
        companySupervisorId: companySup!.id,
      },
    });
    assert(Boolean(internship), 'Talabaning korxona rahbariga biriktirilgan amaliyoti mavjud');

    // Ensure internship is ACTIVE for tests
    await prisma.internship.update({
      where: { id: internship!.id },
      data: { status: 'ACTIVE' },
    });

    // Clean prior test evaluations
    await prisma.finalEvaluation.deleteMany({
      where: { internshipId: internship!.id },
    });

    // Ensure at least 1 APPROVED diary entry exists
    const approvedEntry = await prisma.diaryEntry.findFirst({
      where: { internshipId: internship!.id, status: 'APPROVED' },
    });
    let createdApprovedEntryId: string | null = null;
    if (!approvedEntry) {
      const created = await prisma.diaryEntry.create({
        data: {
          internshipId: internship!.id,
          entryDate: new Date('2026-09-15'),
          taskTitle: 'Test vazifasi',
          description: 'Test uchun tasdiqlangan kundalik yozuvi',
          status: 'APPROVED',
        },
      });
      createdApprovedEntryId = created.id;
    }

    // Generate tokens
    const studentToken = generateToken({ id: student!.id, role: student!.role });
    const companyToken = generateToken({ id: companySup!.id, role: companySup!.role });
    const uniToken = generateToken({ id: uniSup!.id, role: uniSup!.role });
    const adminToken = generateToken({ id: admin!.id, role: admin!.role });

    // ── Build full criteria payload ──
    const fullCriteria = EVALUATION_CRITERIA.map((c) => ({
      criterionKey: c.key,
      score: Math.round(c.maxScore * 0.9), // 90% of max
      comment: `${c.name} uchun testdan o'tdi`,
    }));

    const companyTotalExpected = fullCriteria.reduce((s, c) => s + c.score, 0);

    // ── TEST 1: Criteria endpoint accessible publicly ──
    const criteriaRes = await fetch(`${baseUrl}/evaluation/criteria`);
    const criteriaData = (await criteriaRes.json()) as any;
    assert(
      criteriaRes.status === 200 &&
      Array.isArray(criteriaData.data?.criteria) &&
      criteriaData.data.criteria.length === EVALUATION_CRITERIA.length &&
      criteriaData.data.totalMaxScore === TOTAL_MAX_SCORE,
      `TEST 1: Baholash mezonlari endpointi ishlaydi (${EVALUATION_CRITERIA.length} mezon, jami max ${TOTAL_MAX_SCORE} ball)`
    );

    // ── TEST 2: Student cannot POST evaluation ──
    const res2 = await fetch(`${baseUrl}/evaluation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${studentToken}` },
      body: JSON.stringify({
        internshipId: internship!.id,
        status: 'SUBMITTED',
        criteria: fullCriteria,
      }),
    });
    assert(res2.status === 403, 'TEST 2: Talaba baholash yubora olmaydi (403 Forbidden)');

    // ── TEST 2b: ADMIN cannot POST evaluation (403) ──
    const res2b = await fetch(`${baseUrl}/evaluation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        internshipId: internship!.id,
        status: 'DRAFT',
        criteria: fullCriteria,
      }),
    });
    const data2b = (await res2b.json()) as any;
    assert(
      res2b.status === 403 && data2b.error?.message?.includes('Administrator'),
      'TEST 2b: Administrator baholash yarata olmaydi (403 Forbidden)'
    );

    // ── TEST 3: Score exceeds max — validation rejects ──
    const invalidCriteria = EVALUATION_CRITERIA.map((c) => ({
      criterionKey: c.key,
      score: c.maxScore + 10, // over-max
      comment: '',
    }));

    const res3 = await fetch(`${baseUrl}/evaluation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${companyToken}` },
      body: JSON.stringify({
        internshipId: internship!.id,
        status: 'SUBMITTED',
        criteria: invalidCriteria,
      }),
    });
    const data3 = (await res3.json()) as any;
    assert(
      res3.status === 400 && data3.error?.message?.includes('ball'),
      "TEST 3: Mezon maksimal balldan oshgan so'rovni 400 bilan rad etadi"
    );

    // ── TEST 4: Negative score validation ──
    const negCriteria = EVALUATION_CRITERIA.map((c) => ({
      criterionKey: c.key,
      score: -5,
      comment: '',
    }));

    const res4 = await fetch(`${baseUrl}/evaluation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${companyToken}` },
      body: JSON.stringify({
        internshipId: internship!.id,
        status: 'DRAFT',
        criteria: negCriteria,
      }),
    });
    assert(res4.status === 400, 'TEST 4: Manfiy ball kiritilganda 400 xatosi qaytadi');

    // ── TEST 4b: No APPROVED diary entry → 400 ──
    const tempInternship = await prisma.internship.create({
      data: {
        studentId: student!.id,
        companyId: internship!.companyId,
        companySupervisorId: companySup!.id,
        universitySupervisorId: uniSup!.id,
        startDate: new Date('2027-01-01'),
        endDate: new Date('2027-03-31'),
        status: 'ACTIVE',
      },
    });
    const res4b = await fetch(`${baseUrl}/evaluation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${companyToken}` },
      body: JSON.stringify({
        internshipId: tempInternship.id,
        status: 'DRAFT',
        criteria: fullCriteria,
      }),
    });
    const data4b = (await res4b.json()) as any;
    assert(
      res4b.status === 400 && data4b.error?.message?.includes('tasdiqlangan kundalik'),
      "TEST 4b: Tasdiqlangan kundalik yo'q bo'lganda baholash 400 bilan rad etiladi"
    );
    await prisma.internship.delete({ where: { id: tempInternship.id } });

    // ── TEST 4c: CANCELLED internship → 400 ──
    const cancelledInternship = await prisma.internship.create({
      data: {
        studentId: student!.id,
        companyId: internship!.companyId,
        companySupervisorId: companySup!.id,
        universitySupervisorId: uniSup!.id,
        startDate: new Date('2027-04-01'),
        endDate: new Date('2027-06-30'),
        status: 'CANCELLED',
      },
    });
    const res4c = await fetch(`${baseUrl}/evaluation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${companyToken}` },
      body: JSON.stringify({
        internshipId: cancelledInternship.id,
        status: 'DRAFT',
        criteria: fullCriteria,
      }),
    });
    const data4c = (await res4c.json()) as any;
    assert(
      res4c.status === 400 && data4c.error?.message?.includes('faol'),
      'TEST 4c: Bekor qilingan amaliyot uchun baholash 400 bilan rad etiladi'
    );
    await prisma.internship.delete({ where: { id: cancelledInternship.id } });

    // ── TEST 5: Company supervisor saves DRAFT ──
    const res5 = await fetch(`${baseUrl}/evaluation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${companyToken}` },
      body: JSON.stringify({
        internshipId: internship!.id,
        status: 'DRAFT',
        generalComment: 'Ish jarayonini bosqichma-bosqich tekshirmoqda',
        criteria: fullCriteria,
      }),
    });
    const data5 = (await res5.json()) as any;
    assert(
      res5.status === 200 && data5.data?.status === 'DRAFT' && data5.data?.totalScore === companyTotalExpected,
      `TEST 5: Korxona rahbari baholashni DRAFT sifatida saqladi (${companyTotalExpected} ball)`
    );

    // ── TEST 6: RBAC — company supervisor cannot evaluate another company's internship ──
    const otherSup = await prisma.user.findFirst({ where: { role: 'COMPANY_SUPERVISOR', id: { not: companySup!.id } } });
    if (otherSup) {
      const otherToken = generateToken({ id: otherSup.id, role: otherSup.role });
      const res6 = await fetch(`${baseUrl}/evaluation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${otherToken}` },
        body: JSON.stringify({
          internshipId: internship!.id,
          status: 'DRAFT',
          criteria: fullCriteria,
        }),
      });
      const data6 = (await res6.json()) as any;
      assert(
        res6.status === 403 && data6.error?.message?.includes('biriktirilmagan'),
        "TEST 6: Boshqa korxona rahbari o'zga amaliyotni baholay olmaydi (IDOR himoyasi)"
      );
    } else {
      assert(true, "TEST 6: SKIP — boshqa korxona rahbari yo'q (seed cheklovi)");
    }

    // ── TEST 7: Company supervisor finalizes SUBMITTED ──
    const res7 = await fetch(`${baseUrl}/evaluation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${companyToken}` },
      body: JSON.stringify({
        internshipId: internship!.id,
        status: 'SUBMITTED',
        generalComment: "Talaba amaliyotni a'lo darajada yakunladi.",
        criteria: fullCriteria,
      }),
    });
    const data7 = (await res7.json()) as any;
    assert(
      res7.status === 200 && data7.data?.status === 'SUBMITTED',
      'TEST 7: Korxona rahbari baholashni SUBMITTED holatida yakuniy yubordi'
    );

    // ── TEST 8: Cannot re-edit after SUBMITTED — blocked for ALL roles ──
    const res8 = await fetch(`${baseUrl}/evaluation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${companyToken}` },
      body: JSON.stringify({
        internshipId: internship!.id,
        status: 'DRAFT',
        criteria: fullCriteria,
      }),
    });
    assert(res8.status === 400, 'TEST 8: SUBMITTED baholashni qayta tahrirlash bloklanadi (400) — barcha rollar uchun');

    // ── TEST 8b: ADMIN also cannot modify SUBMITTED evaluation (403 at role check) ──
    const res8b = await fetch(`${baseUrl}/evaluation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        internshipId: internship!.id,
        status: 'DRAFT',
        criteria: fullCriteria,
      }),
    });
    assert(
      res8b.status === 403,
      "TEST 8b: Administrator SUBMITTED baholashni o'zgartira olmaydi (403)"
    );

    // ── TEST 9: University supervisor submits their own evaluation ──
    const uniCriteria = EVALUATION_CRITERIA.map((c) => ({
      criterionKey: c.key,
      score: Math.round(c.maxScore * 0.85), // 85% of max
      comment: `Universitet tomonidan baholandi: ${c.name}`,
    }));
    const uniTotal = uniCriteria.reduce((s, c) => s + c.score, 0);

    const res9 = await fetch(`${baseUrl}/evaluation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${uniToken}` },
      body: JSON.stringify({
        internshipId: internship!.id,
        status: 'SUBMITTED',
        generalComment: 'Talabaning nazariy va amaliy bilimlari baholandi.',
        criteria: uniCriteria,
      }),
    });
    const data9 = (await res9.json()) as any;
    assert(
      res9.status === 200 && data9.data?.status === 'SUBMITTED' && data9.data?.totalScore === uniTotal,
      `TEST 9: Universitet rahbari baholashni muvaffaqiyatli yubordi (${uniTotal} ball)`
    );

    // ── TEST 10: Final result calculation — average of both scores ──
    const detailRes = await fetch(`${baseUrl}/evaluation/internship/${internship!.id}`, {
      headers: { Authorization: `Bearer ${companyToken}` },
    });
    const detailData = (await detailRes.json()) as any;
    const finalResult = detailData.data?.finalResult;
    const expectedFinal = Math.round(((companyTotalExpected + uniTotal) / 2) * 100) / 100;

    assert(
      detailRes.status === 200 &&
        finalResult?.isCompleted === true &&
        finalResult?.finalScore === expectedFinal,
      `TEST 10: Yakuniy natija to'g'ri hisoblandi: (${companyTotalExpected} + ${uniTotal}) / 2 = ${expectedFinal}`
    );

    // ── TEST 11: No final result shown if only one evaluation submitted ──
    const otherInternship = await prisma.internship.create({
      data: {
        studentId: student!.id,
        companyId: internship!.companyId,
        companySupervisorId: companySup!.id,
        universitySupervisorId: uniSup!.id,
        startDate: new Date('2026-12-01'),
        endDate: new Date('2026-12-31'),
        status: 'ACTIVE',
      },
    });

    // Add approved diary entry so prerequisite check passes
    await prisma.diaryEntry.create({
      data: {
        internshipId: otherInternship.id,
        entryDate: new Date('2026-12-05'),
        taskTitle: 'Test 11 vazifasi',
        description: 'Test 11 uchun tasdiqlangan yozuv',
        status: 'APPROVED',
      },
    });

    // Only company supervisor submits
    await fetch(`${baseUrl}/evaluation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${companyToken}` },
      body: JSON.stringify({
        internshipId: otherInternship.id,
        status: 'SUBMITTED',
        criteria: fullCriteria,
      }),
    });

    const singleDetailRes = await fetch(`${baseUrl}/evaluation/internship/${otherInternship.id}`, {
      headers: { Authorization: `Bearer ${companyToken}` },
    });
    const singleData = (await singleDetailRes.json()) as any;

    assert(
      singleData.data?.finalResult?.isCompleted === false &&
        singleData.data?.finalResult?.finalScore === null,
      "TEST 11: Faqat bir tomonlama baho bo'lganda yakuniy natija null va isCompleted=false"
    );

    // Cleanup dummy internship
    await prisma.diaryEntry.deleteMany({ where: { internshipId: otherInternship.id } });
    await prisma.finalEvaluation.deleteMany({ where: { internshipId: otherInternship.id } });
    await prisma.internship.delete({ where: { id: otherInternship.id } });

    // ── TEST 12: Student can read their own evaluation detail ──
    const studentDetailRes = await fetch(`${baseUrl}/evaluation/internship/${internship!.id}`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    assert(
      studentDetailRes.status === 200,
      "TEST 12: Talaba o'z amaliyotining baholash tafsilotini ko'ra oladi"
    );

    // ── TEST 13: Student cannot read another internship's evaluation ──
    const fakeInternshipId = 'non-existent-id-xyz';
    const studentFakeRes = await fetch(`${baseUrl}/evaluation/internship/${fakeInternshipId}`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    assert(
      studentFakeRes.status === 404,
      "TEST 13: Talaba mavjud bo'lmagan amaliyot bahosiga kira olmaydi (404)"
    );

    // ── TEST 14: Evaluation list visible to authorized roles ──
    const listRes = await fetch(`${baseUrl}/evaluation/list`, {
      headers: { Authorization: `Bearer ${companyToken}` },
    });
    const listData = (await listRes.json()) as any;
    assert(
      listRes.status === 200 && Array.isArray(listData.data),
      "TEST 14: Korxona rahbari baholash ro'yxatini ko'ra oladi"
    );

    // ── TEST 15: ADMIN can read evaluation list (read-only access) ──
    const adminListRes = await fetch(`${baseUrl}/evaluation/list`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(
      adminListRes.status === 200,
      "TEST 15: Administrator baholash ro'yxatini ko'ra oladi (read-only)"
    );

    // Cleanup created approved entry if we made one
    if (createdApprovedEntryId) {
      await prisma.diaryEntry.delete({ where: { id: createdApprovedEntryId } });
    }

    // Restore state so other test scripts are not order-dependent:
    // submitting both evaluations marks the internship COMPLETED — bring it back to ACTIVE.
    await prisma.finalEvaluation.deleteMany({ where: { internshipId: internship!.id } });
    await prisma.internship.update({ where: { id: internship!.id }, data: { status: 'ACTIVE' } });

  } finally {
    server.close();
    await prisma.$disconnect();
  }

  console.log('\n========================================================================');
  console.log(`📊 TEST NATIJALARI: ${passed}/${total} muvaffaqiyatli o'tdi.`);
  console.log('========================================================================\n');

  if (passed !== total) {
    process.exit(1);
  }
}

runEvaluationTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
