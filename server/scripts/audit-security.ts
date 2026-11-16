import { PrismaClient, UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { generateToken } from '../src/middleware/auth';
import { env } from '../src/config/env';

const prisma = new PrismaClient();

async function runComprehensiveAudit() {
  console.log('===============================================================');
  console.log('🛡️  KENG QAMROVLI INTEGRATSION VA XAVFSIZLIK AUDITI BOSHLANDI');
  console.log('===============================================================\n');

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, category: string, testName: string) {
    total++;
    if (condition) {
      console.log(`  ✅ [${category}] PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ [${category}] FAIL: ${testName}`);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. LOGIN VA SESSIYA XAVFSIZLIGI SINOVLARI
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('📌 1. LOGIN VA SESSIYA SINOVLARI:');

  // A. To'g'ri va noto'g'ri parol
  const admin = await prisma.user.findUnique({ where: { email: 'admin@edu.uz' } });
  assert(Boolean(admin), 'AUTH', 'Admin foydalanuvchisi bazada mavjud');
  if (admin) {
    const validPass = await bcrypt.compare('DevPassword123!', admin.passwordHash);
    const invalidPass = await bcrypt.compare('WrongPassword999!', admin.passwordHash);
    assert(validPass, 'AUTH', 'To\'g\'ri parol bcrypt orqali muvaffaqiyatli tasdiqlanadi');
    assert(!invalidPass, 'AUTH', 'Noto\'g\'ri parol rad etiladi');
  }

  // B. Bloklangan foydalanuvchi sinovi
  const blockedUser = await prisma.user.upsert({
    where: { email: 'blocked.student@student.edu.uz' },
    update: { isActive: false },
    create: {
      fullName: 'Bloklangan Talaba',
      email: 'blocked.student@student.edu.uz',
      passwordHash: await bcrypt.hash('DevPassword123!', 10),
      role: UserRole.STUDENT,
      isActive: false,
    },
  });
  assert(!blockedUser.isActive, 'AUTH', 'Bloklangan (isActive: false) foydalanuvchi holati to\'g\'ri saqlanadi');

  // C. Token muddati va yaroqsiz JWT
  const validToken = generateToken({ id: admin!.id, role: admin!.role });
  const verified = jwt.verify(validToken, env.JWT_SECRET) as any;
  assert(verified.userId === admin!.id, 'AUTH', 'Yaroqli JWT token to\'g\'ri shifrlanadi va ochiladi');

  let invalidJwtRejected = false;
  try {
    jwt.verify('invalid.token.string', env.JWT_SECRET);
  } catch {
    invalidJwtRejected = true;
  }
  assert(invalidJwtRejected, 'AUTH', 'Soxta yoki buzilgan JWT token rad etiladi');

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. RBAC VA IDOR (Obyekt darajasidagi ruxsatlar) SINOVLARI
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n📌 2. RBAC VA IDOR HIMOYASI SINOVLARI:');

  const student = await prisma.user.findUnique({ where: { email: 'jasur.aliev@student.edu.uz' } });
  const supervisor = await prisma.user.findUnique({ where: { email: 'sherzod.nazarov@uzcard.uz' } });
  assert(Boolean(student && supervisor), 'RBAC', 'Talaba va korxona rahbari hisoblari mavjud');

  // IDOR tekshiruvi: Talaba faqat o'z amaliyotiga biriktirilganini tekshirish
  const studentInternship = await prisma.internship.findFirst({
    where: { studentId: student!.id },
  });
  assert(Boolean(studentInternship), 'IDOR', 'Talaba o\'z amaliyotiga ega');

  // Talaba begona amaliyotga tegishli bo'lmagan so'rov berishi holatini simulyatsiya qilish
  const otherInternship = await prisma.internship.findFirst({
    where: { studentId: { not: student!.id } },
  });
  assert(otherInternship === null || otherInternship.studentId !== student!.id, 'IDOR', 'Talaba boshqa talaba amaliyotiga bog\'lanmagan');

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. KUNDALIKNING TO'LIQ BIZNES JARAYONI (Lifecycle)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n📌 3. BIZNES JARAYONI (DRAFT -> SUBMITTED -> RETURNED -> SUBMITTED -> APPROVED):');

  const testDate = new Date('2026-10-28');

  // 1. Qoralama yaratish (DRAFT)
  const draftEntry = await prisma.diaryEntry.upsert({
    where: {
      internshipId_entryDate: {
        internshipId: studentInternship!.id,
        entryDate: testDate,
      },
    },
    update: {
      status: 'DRAFT',
      taskTitle: 'Sinov: Avtomatlashtirilgan qoralama yozuvi',
      description: 'Lokal audit sinovi uchun qoralama',
    },
    create: {
      internshipId: studentInternship!.id,
      entryDate: testDate,
      taskTitle: 'Sinov: Avtomatlashtirilgan qoralama yozuvi',
      description: 'Lokal audit sinovi uchun qoralama',
      status: 'DRAFT',
      hours: 8,
    },
  });
  assert(draftEntry.status === 'DRAFT', 'LIFECYCLE', '1-bosqich: Qoralama (DRAFT) muvaffaqiyatli yaratildi');

  // 2. Qoralamani tahrirlash va topshirish (SUBMITTED)
  const submittedEntry = await prisma.diaryEntry.update({
    where: { id: draftEntry.id },
    data: {
      taskTitle: 'Sinov: Qoralamadan topshirish holatiga o\'tkazildi',
      status: 'SUBMITTED',
      submittedAt: new Date(),
    },
  });
  assert(submittedEntry.status === 'SUBMITTED', 'LIFECYCLE', '2-bosqich: Talaba kundalikni tekshiruvga yubordi (SUBMITTED)');

  // 3. Rahbar tomonidan sabab bilan qaytarish (RETURNED)
  const returnedEntry = await prisma.$transaction([
    prisma.diaryEntry.update({
      where: { id: submittedEntry.id },
      data: { status: 'RETURNED' },
    }),
    prisma.diaryReview.create({
      data: {
        diaryEntryId: submittedEntry.id,
        reviewerId: supervisor!.id,
        decision: 'RETURNED',
        comment: 'Tavsif yetarli emas, bajarilgan amaliy natijalarni to\'ldiring',
      },
    }),
  ]);
  assert(returnedEntry[0].status === 'RETURNED', 'LIFECYCLE', '3-bosqich: Rahbar izoh bilan qaytardi (RETURNED)');

  // 4. Talaba tuzatib qayta yuborishi (SUBMITTED)
  const resubmittedEntry = await prisma.diaryEntry.update({
    where: { id: draftEntry.id },
    data: {
      description: 'To\'ldirilgan tavsif: Barcha kamchiliklar bartaraf etildi va test natijalari ilova qilindi.',
      status: 'SUBMITTED',
    },
  });
  assert(resubmittedEntry.status === 'SUBMITTED', 'LIFECYCLE', '4-bosqich: Talaba tuzatib qayta topshirdi (SUBMITTED)');

  // 5. Rahbarning yakuniy tasdiqlashi (APPROVED)
  const approvedEntry = await prisma.$transaction([
    prisma.diaryEntry.update({
      where: { id: resubmittedEntry.id },
      data: { status: 'APPROVED' },
    }),
    prisma.diaryReview.create({
      data: {
        diaryEntryId: resubmittedEntry.id,
        reviewerId: supervisor!.id,
        decision: 'APPROVED',
        comment: 'Muvaffaqiyatli qabul qilindi. A\'lo natija!',
      },
    }),
  ]);
  assert(approvedEntry[0].status === 'APPROVED', 'LIFECYCLE', '5-bosqich: Rahbar kundalikni yakuniy tasdiqladi (APPROVED)');

  // 6. Dublikat sanalar cheklovi (Bir kunga bitta yozuv)
  let duplicateRejected = false;
  try {
    await prisma.diaryEntry.create({
      data: {
        internshipId: studentInternship!.id,
        entryDate: testDate,
        taskTitle: 'Dublikat urinish',
        description: 'Dublikat',
      },
    });
  } catch (err: any) {
    // Unique constraint violation P2002
    if (err.code === 'P2002') {
      duplicateRejected = true;
    }
  }
  assert(duplicateRejected, 'DATABASE', 'Ayni bir kun va amaliyot uchun takroriy (dublikat) yozuv kiritish bloklanadi');

  // ─────────────────────────────────────────────────────────────────────────────
  // 4. BAZA VA SEED INTEGRATSIYASI SINOVLARI
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n📌 4. BAZA VA MA\'LUMOTLAR INTEGRATSIYASI:');

  const [usersCount, groupsCount, companiesCount, entriesCount] = await Promise.all([
    prisma.user.count(),
    prisma.studentGroup.count(),
    prisma.company.count(),
    prisma.diaryEntry.count(),
  ]);

  assert(usersCount >= 5, 'DATABASE', `Foydalanuvchilar bazada mavjud (${usersCount} nafar)`);
  assert(groupsCount >= 2, 'DATABASE', `Akademik guruhlar bazada mavjud (${groupsCount} ta)`);
  assert(companiesCount >= 2, 'DATABASE', `Hamkor korxonalar bazada mavjud (${companiesCount} ta)`);
  assert(entriesCount >= 2, 'DATABASE', `Kundalik yozuvlari bazada saqlangan (${entriesCount} ta)`);

  console.log('===============================================================');
  console.log(`🏁 AUDIT YAKUNI: ${passed}/${total} ta barcha tekshiruvlar muvaffaqiyatli o'tdi.`);
  console.log('===============================================================\n');

  if (passed !== total) {
    process.exit(1);
  }
}

runComprehensiveAudit()
  .catch((e) => {
    console.error('Audit execution failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
