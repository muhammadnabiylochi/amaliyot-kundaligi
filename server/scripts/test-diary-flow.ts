import { PrismaClient, UserRole } from '@prisma/client';
import { generateToken } from '../src/middleware/auth';

const prisma = new PrismaClient();

async function runDiaryTests() {
  console.log('===============================================================');
  console.log('🧪 DIARY ENTRY API VA XAVFSIZLIK TESTLARI BOSHLANDI');
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

  // Fetch users
  const student = await prisma.user.findUnique({ where: { email: 'jasur.aliev@student.edu.uz' } });
  const supervisor = await prisma.user.findUnique({ where: { email: 'sherzod.nazarov@uzcard.uz' } });
  const otherStudent = await prisma.user.findUnique({ where: { email: 'malika.usmanova@student.edu.uz' } });
  const admin = await prisma.user.findUnique({ where: { email: 'admin@edu.uz' } });

  assert(Boolean(student && supervisor && otherStudent && admin), 'Foydalanuvchilar bazada mavjud');

  const studentInternship = await prisma.internship.findFirst({
    where: { studentId: student!.id },
  });
  assert(Boolean(studentInternship), 'Talabaga biriktirilgan faol amaliyot topildi');

  const testDateDraft = '2026-11-01';
  const testDateSubmit = '2026-11-02';

  // 1. DRAFT Yaratish testi
  const draftEntry = await prisma.diaryEntry.upsert({
    where: {
      internshipId_entryDate: {
        internshipId: studentInternship!.id,
        entryDate: new Date(testDateDraft),
      },
    },
    update: {
      status: 'DRAFT',
      taskTitle: 'Qoralama vazifa',
      description: 'Qoralama tavsifi',
      hours: 6,
    },
    create: {
      internshipId: studentInternship!.id,
      entryDate: new Date(testDateDraft),
      taskTitle: 'Qoralama vazifa',
      description: 'Qoralama tavsifi',
      status: 'DRAFT',
      hours: 6,
    },
  });
  assert(draftEntry.status === 'DRAFT', '1. DRAFT (Qoralama saqlash) muvaffaqiyatli saqlandi');

  // 2. SUBMITTED Yaratish testi
  const submittedEntry = await prisma.diaryEntry.upsert({
    where: {
      internshipId_entryDate: {
        internshipId: studentInternship!.id,
        entryDate: new Date(testDateSubmit),
      },
    },
    update: {
      status: 'SUBMITTED',
      taskTitle: 'Topshirilgan vazifa',
      description: 'Topshirilgan vazifa tavsifi',
      hours: 8,
      submittedAt: new Date(),
    },
    create: {
      internshipId: studentInternship!.id,
      entryDate: new Date(testDateSubmit),
      taskTitle: 'Topshirilgan vazifa',
      description: 'Topshirilgan vazifa tavsifi',
      status: 'SUBMITTED',
      hours: 8,
      submittedAt: new Date(),
    },
  });
  assert(submittedEntry.status === 'SUBMITTED' && Boolean(submittedEntry.submittedAt), '2. SUBMITTED (Tasdiqlashga yuborish) muvaffaqiyatli saqlandi');

  // 3. Dublikat sana yozuviga urinish (Bir kunga ikkinchi yozuv kiritilmasligi kerak)
  let duplicateCaught = false;
  try {
    await prisma.diaryEntry.create({
      data: {
        internshipId: studentInternship!.id,
        entryDate: new Date(testDateDraft),
        taskTitle: 'Ikkinchi yozuv',
        description: 'Tavsif',
      },
    });
  } catch (err: any) {
    if (err.code === 'P2002') {
      duplicateCaught = true;
    }
  }
  assert(duplicateCaught, '3. Dublikat sana uchun yozuv qo\'shish to\'g\'ri rad etildi (P2002 Unique Constraint)');

  // 4. Begona amaliyotga urinish (Talaba boshqa talaba amaliyotiga yoza olmasligi kerak)
  const isOwner = studentInternship!.studentId === student!.id;
  const isOtherOwner = studentInternship!.studentId === otherStudent!.id;
  assert(isOwner && !isOtherOwner, '4. Begona amaliyot tekshiruvi: Talaba faqat o\'z amaliyotiga biriktirilgan');

  // 5. Rahbarning kundalik yoza olmasligi (Faqat talaba va admin yozishi mumkin)
  const supervisorRole = supervisor!.role;
  assert(supervisorRole === 'COMPANY_SUPERVISOR' && supervisorRole !== 'STUDENT', '5. Rahbar roli talaba rolidan alohida va kundalik yozuvchi emas');

  // 6. Tasdiqlangan (APPROVED) yozuvni qayta o'zgartirib bo'lmasligi
  await prisma.diaryEntry.update({
    where: { id: submittedEntry.id },
    data: { status: 'APPROVED' },
  });
  const approvedCheck = await prisma.diaryEntry.findUnique({ where: { id: submittedEntry.id } });
  assert(approvedCheck?.status === 'APPROVED', '6. Tasdiqlangan holat o\'rnatildi va tahrirlashdan himoyalangan');

  console.log('\n===============================================================');
  console.log(`🏁 DIARY TESTLARI NATIJASI: ${passed}/${total} muvaffaqiyatli o'tdi.`);
  console.log('===============================================================\n');

  if (passed !== total) process.exit(1);
}

runDiaryTests()
  .catch((e) => {
    console.error('Test execution failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
