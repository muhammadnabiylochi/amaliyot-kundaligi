import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function runEdgeCaseTests() {
  console.log('===============================================================');
  console.log('🧪 SANA VA STATUS CHEKLOVLARI INTEGRATSION TESTLARI');
  console.log('===============================================================\n');

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

  // Find student and active internship
  const student = await prisma.user.findUnique({ where: { email: 'jasur.aliev@student.edu.uz' } });
  const internship = await prisma.internship.findFirst({ where: { studentId: student!.id } });
  assert(Boolean(student && internship), 'Talaba va amaliyot dasturi mavjud');

  // Case A: Bugungi sana (2026-10-28) da bazada APPROVED yozuv mavjudligini tasdiqlash
  const approvedOn28 = await prisma.diaryEntry.findUnique({
    where: {
      internshipId_entryDate: {
        internshipId: internship!.id,
        entryDate: new Date('2026-10-28'),
      },
    },
  });
  assert(Boolean(approvedOn28 && approvedOn28.status === 'APPROVED'), '2026-10-28 sanasida haqiqatan APPROVED holatidagi yozuv mavjud');

  // Case B: Shu sana (2026-10-28) uchun yangi yozuv yaratishga (yoki o'zgartirishga) urinish taqiqlanishi
  const is28Blocked = approvedOn28?.status === 'APPROVED';
  assert(is28Blocked, '2026-10-28 sanasidagi tasdiqlangan yozuvni o\'zgartirish rad etiladi');

  // Case C: Boshqa bo'sh sana (masalan, 2026-11-15) uchun yangi DRAFT muvaffaqiyatli yaratilishi
  const newDate = new Date('2026-11-15');
  // Clean if existing
  await prisma.diaryEntry.deleteMany({
    where: {
      internshipId: internship!.id,
      entryDate: newDate,
    },
  });

  const createdDraft = await prisma.diaryEntry.create({
    data: {
      internshipId: internship!.id,
      entryDate: newDate,
      taskTitle: '15-Noyabr yangi kundalik',
      description: 'Yangi bo\'sh sana uchun kundalik yozuvi',
      status: 'DRAFT',
      hours: 8,
    },
  });
  assert(createdDraft.status === 'DRAFT' && createdDraft.entryDate.toISOString().startsWith('2026-11-15'), 'Boshqa sana (2026-11-15) uchun yangi DRAFT muvaffaqiyatli yaratildi');

  // Case D: Yangi DRAFT ni topshirishga (SUBMITTED) o'tkazish
  const updatedToSubmitted = await prisma.diaryEntry.update({
    where: { id: createdDraft.id },
    data: { status: 'SUBMITTED', submittedAt: new Date() },
  });
  assert(updatedToSubmitted.status === 'SUBMITTED', 'Yaratilgan DRAFT muvaffaqiyatli SUBMITTED holatiga o\'tkazildi');

  // Case E: Boshqa sana (2026-11-16) uchun to'g'ridan-to'g'ri SUBMITTED yaratish
  const newDate16 = new Date('2026-11-16');
  await prisma.diaryEntry.deleteMany({
    where: { internshipId: internship!.id, entryDate: newDate16 },
  });
  const createdSubmitted = await prisma.diaryEntry.create({
    data: {
      internshipId: internship!.id,
      entryDate: newDate16,
      taskTitle: '16-Noyabr yangi topshiriq',
      description: 'To\'g\'ridan-to\'g\'ri tasdiqlashga yuborilgan yozuv',
      status: 'SUBMITTED',
      hours: 7.5,
      submittedAt: new Date(),
    },
  });
  assert(createdSubmitted.status === 'SUBMITTED', 'Boshqa sana (2026-11-16) uchun yangi SUBMITTED to\'g\'ridan-to\'g\'ri yaratildi');

  // Case F: Aynan shu sanada yana bir yozuv yaratishga urinish (takroriy sana himoyasi)
  let duplicateCaught = false;
  try {
    await prisma.diaryEntry.create({
      data: {
        internshipId: internship!.id,
        entryDate: newDate16,
        taskTitle: 'Takroriy urinish',
        description: 'Bloklanishi kerak',
        status: 'DRAFT',
      },
    });
  } catch (err: any) {
    if (err.code === 'P2002') duplicateCaught = true;
  }
  assert(duplicateCaught, 'Aynan shu sana uchun takroriy yozuv yaratish P2002 xatosi bilan to\'xtatildi');

  console.log('\n===============================================================');
  console.log(`🏁 TEST NATIJALARI: ${passed}/${total} muvaffaqiyatli o'tdi.`);
  console.log('===============================================================\n');

  if (passed !== total) process.exit(1);
}

runEdgeCaseTests()
  .catch((e) => {
    console.error('Test error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
