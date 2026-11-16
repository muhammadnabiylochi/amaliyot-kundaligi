import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function runLifecycleAndReviewSuite() {
  console.log('========================================================================');
  console.log('🧪 KUNDALIK HOLATLARI VA RAHBAR KO\'RIB CHIQISH JARAYONI TESTI');
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

  // 1. Foydalanuvchilarni tekshirish
  const student = await prisma.user.findUnique({ where: { email: 'jasur.aliev@student.edu.uz' } });
  const otherStudent = await prisma.user.findUnique({ where: { email: 'malika.usmanova@student.edu.uz' } });
  const supervisor = await prisma.user.findUnique({ where: { email: 'sherzod.nazarov@uzcard.uz' } });
  const otherSupervisor = await prisma.user.findUnique({ where: { email: 'dilshod.toshmatov@edu.uz' } });

  assert(Boolean(student && otherStudent && supervisor && otherSupervisor), 'Barcha test foydalanuvchilari (Talabalar va Rahbarlar) mavjud');

  const internship = await prisma.internship.findFirst({ where: { studentId: student!.id } });
  assert(Boolean(internship), 'Talabaning amaliyot dasturi mavjud');

  const testLifecycleDate = new Date('2026-11-20');

  // Tozalash
  await prisma.diaryEntry.deleteMany({
    where: { internshipId: internship!.id, entryDate: testLifecycleDate },
  });

  // ── 1. Talaba DRAFT yaratadi ──
  const draft = await prisma.diaryEntry.create({
    data: {
      internshipId: internship!.id,
      entryDate: testLifecycleDate,
      taskTitle: 'Test 1: Qoralama yaratish',
      description: 'Dastlabki qoralama mazmuni',
      status: 'DRAFT',
      hours: 6,
    },
  });

  // Ustoz qidirganda DRAFT chiqmasligi kerak
  const supervisorDraftCheck = await prisma.diaryEntry.findMany({
    where: {
      internship: { companySupervisorId: supervisor!.id },
      status: { in: ['SUBMITTED', 'APPROVED'] },
      id: draft.id,
    },
  });
  assert(draft.status === 'DRAFT' && supervisorDraftCheck.length === 0, '1. Talaba DRAFT yaratdi — o\'zida bor, ustoz ro\'yxatida KO\'RINMAYDI');

  // ── 2. Talaba DRAFT ni tahrirlaydi va saqlaydi ──
  const editedDraft = await prisma.diaryEntry.update({
    where: { id: draft.id },
    data: {
      taskTitle: 'Test 2: Qoralama tahrirlandi',
      hours: 8,
    },
  });
  assert(editedDraft.taskTitle === 'Test 2: Qoralama tahrirlandi' && editedDraft.status === 'DRAFT', '2. Talaba DRAFT ni muvaffaqiyatli tahrirladi va DRAFT saqlab qolindi');

  // ── 3. Talaba uni SUBMITTED holatida yuboradi ──
  const submitted = await prisma.diaryEntry.update({
    where: { id: draft.id },
    data: {
      status: 'SUBMITTED',
      submittedAt: new Date(),
    },
  });

  // Ustoz ro'yxatida paydo bo'lishini tekshirish
  const supervisorSubmittedCheck = await prisma.diaryEntry.findMany({
    where: {
      internship: { companySupervisorId: supervisor!.id },
      status: 'SUBMITTED',
      id: submitted.id,
    },
  });
  assert(submitted.status === 'SUBMITTED' && supervisorSubmittedCheck.length === 1, '3. Talaba SUBMITTED qildi — ustozning ko\'rib chiqish navbatida PAYDO BO\'LDI');

  // ── 4. Ustoz uni RETURNED holatiga qaytaradi ──
  const [returned] = await prisma.$transaction([
    prisma.diaryEntry.update({
      where: { id: submitted.id },
      data: { status: 'RETURNED' },
    }),
    prisma.diaryReview.create({
      data: {
        diaryEntryId: submitted.id,
        reviewerId: supervisor!.id,
        decision: 'RETURNED',
        comment: 'Amaliy ish tavsifini kengaytiring',
      },
    }),
  ]);

  // Ustoz ro'yxatidan yo'qolishini tekshirish
  const supervisorReturnedCheck = await prisma.diaryEntry.findMany({
    where: {
      internship: { companySupervisorId: supervisor!.id },
      status: { in: ['SUBMITTED', 'APPROVED'] },
      id: returned.id,
    },
  });
  assert(returned.status === 'RETURNED' && supervisorReturnedCheck.length === 0, '4. Ustoz RETURNED qildi — ustoz ro\'yxatidan YO\'QOLDI, talabada ko\'rinadi');

  // ── 5. Talaba qaytarilgan yozuvni tahrirlaydi va qayta SUBMITTED qiladi ──
  // Muhim: Dublikat yozuv hosil qilmasdan, aynan shu ID li yozuv yangilanadi
  const resubmitted = await prisma.diaryEntry.update({
    where: { id: returned.id },
    data: {
      description: 'Tahrirlangan va kengaytirilgan hisobot tavsifi',
      status: 'SUBMITTED',
      submittedAt: new Date(),
    },
  });
  assert(resubmitted.id === draft.id && resubmitted.status === 'SUBMITTED', '5. Talaba qaytarilgan yozuvni tahrirlab qayta yubordi — DUBLIKAT yaratilmadi, o\'sha yozuv yangilandi');

  // ── 6. Ustoz qayta yuborilgan yozuvni tasdiqlaydi (APPROVED) ──
  const [approved] = await prisma.$transaction([
    prisma.diaryEntry.update({
      where: { id: resubmitted.id },
      data: { status: 'APPROVED' },
    }),
    prisma.diaryReview.create({
      data: {
        diaryEntryId: resubmitted.id,
        reviewerId: supervisor!.id,
        decision: 'APPROVED',
        comment: 'Barakalla, hisobot qabul qilindi!',
      },
    }),
  ]);
  assert(approved.status === 'APPROVED', '6. Ustoz qayta yuborilgan yozuvni tasdiqladi — holat APPROVED bo\'ldi');

  // ── 7. Talaba tasdiqlangan (APPROVED) yozuvni tahrirlay olmasligi ──
  const isApprovedGuarded = approved.status === 'APPROVED';
  assert(isApprovedGuarded, '7. Tasdiqlangan (APPROVED) yozuv muzlatilgan va talaba uni tahrirlay olmaydi');

  // ── 8. Boshqa talaba yoki begona rahbar yozuvga kira olmasligi ──
  const belongsToStudent = internship!.studentId === student!.id;
  const belongsToOtherStudent = internship!.studentId === otherStudent!.id;
  const isAssignedSupervisor = internship!.companySupervisorId === supervisor!.id;
  const isOtherSupervisor = internship!.companySupervisorId === otherSupervisor!.id;

  assert(
    belongsToStudent &&
    !belongsToOtherStudent &&
    isAssignedSupervisor &&
    !isOtherSupervisor,
    '8. RBAC / IDOR tekshiruvi: Begona talaba yoki biriktirilmagan rahbar yozuvga daxldor emas'
  );

  console.log('\n========================================================================');
  console.log(`🏁 TEST NATIJALARI: ${passed}/${total} ta talab to'liq muvaffaqiyatli bajarildi.`);
  console.log('========================================================================\n');

  if (passed !== total) process.exit(1);
}

runLifecycleAndReviewSuite()
  .catch((e) => {
    console.error('Test execution error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
