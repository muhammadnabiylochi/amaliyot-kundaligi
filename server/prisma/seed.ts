import { PrismaClient, UserRole, InternshipStatus, DiaryEntryStatus, ReviewDecision, AttendanceStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Fictional seed data populating...');

  // 1. Password hashing (standard development fictional hash)
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash('DevPassword123!', salt);

  // 2. Academic Student Group
  const groupIT = await prisma.studentGroup.upsert({
    where: { name: 'IT-210' },
    update: {},
    create: {
      name: 'IT-210',
      faculty: 'Dasturiy injiniring va IT servisi',
      studyProgram: 'Dasturiy injiniring (Bakalavr)',
    },
  });

  const groupCyber = await prisma.studentGroup.upsert({
    where: { name: 'KB-301' },
    update: {},
    create: {
      name: 'KB-301',
      faculty: 'Kiberxavfsizlik',
      studyProgram: 'Axborot xavfsizligi',
    },
  });

  // 3. Companies
  const companyUzcard = await prisma.company.upsert({
    where: { name: 'Uzcard MChJ' },
    update: {},
    create: {
      name: 'Uzcard MChJ',
      address: 'Toshkent sh., Mirobod tumani, Oybek ko\'chasi, 12-uy',
      contactPhone: '+998 71 200-28-28',
      description: 'Yagona Umumrespublika Protsessing Markazi',
    },
  });

  const companyEpam = await prisma.company.upsert({
    where: { name: 'EPAM Systems' },
    update: {},
    create: {
      name: 'EPAM Systems',
      address: 'Toshkent sh., Shayxontohur tumani, Navoiy ko\'chasi, 1A',
      contactPhone: '+998 71 202-00-00',
      description: 'Xalqaro dasturiy ta\'minot injiniringi kompaniyasi',
    },
  });

  // 4. Users
  // Admin
  const admin = await prisma.user.upsert({
    where: { email: 'admin@edu.uz' },
    update: {},
    create: {
      fullName: 'Aziz Rakhimov',
      email: 'admin@edu.uz',
      passwordHash,
      role: UserRole.ADMIN,
      isActive: true,
    },
  });

  // University Supervisor
  const uniSupervisor = await prisma.user.upsert({
    where: { email: 'dilshod.toshmatov@edu.uz' },
    update: {},
    create: {
      fullName: 'Dilshod Toshmatov',
      email: 'dilshod.toshmatov@edu.uz',
      passwordHash,
      role: UserRole.UNIVERSITY_SUPERVISOR,
      isActive: true,
    },
  });

  // Company Supervisor
  const compSupervisor = await prisma.user.upsert({
    where: { email: 'sherzod.nazarov@uzcard.uz' },
    update: {},
    create: {
      fullName: 'Sherzod Nazarov',
      email: 'sherzod.nazarov@uzcard.uz',
      passwordHash,
      role: UserRole.COMPANY_SUPERVISOR,
      isActive: true,
    },
  });

  // Student 1
  const studentUser1 = await prisma.user.upsert({
    where: { email: 'jasur.aliev@student.edu.uz' },
    update: {},
    create: {
      fullName: 'Jasur Aliev',
      email: 'jasur.aliev@student.edu.uz',
      passwordHash,
      role: UserRole.STUDENT,
      isActive: true,
      studentProfile: {
        create: {
          studentNumber: 'ST-2022-0041',
          groupId: groupIT.id,
          phone: '+998 90 123-45-67',
        },
      },
      telegramAccount: {
        create: {
          telegramUserId: BigInt(876543210),
          username: 'jasur_aliev',
        },
      },
    },
  });

  // Student 2
  const studentUser2 = await prisma.user.upsert({
    where: { email: 'malika.usmanova@student.edu.uz' },
    update: {},
    create: {
      fullName: 'Malika Usmanova',
      email: 'malika.usmanova@student.edu.uz',
      passwordHash,
      role: UserRole.STUDENT,
      isActive: true,
      studentProfile: {
        create: {
          studentNumber: 'ST-2022-0098',
          groupId: groupCyber.id,
          phone: '+998 91 987-65-43',
        },
      },
    },
  });

  // 5. Internship Agreements
  const internship1 = await prisma.internship.upsert({
    where: { id: 'clinternship001jasur' },
    update: {},
    create: {
      id: 'clinternship001jasur',
      studentId: studentUser1.id,
      companyId: companyUzcard.id,
      companySupervisorId: compSupervisor.id,
      universitySupervisorId: uniSupervisor.id,
      startDate: new Date('2026-09-01'),
      endDate: new Date('2026-11-30'),
      status: InternshipStatus.ACTIVE,
    },
  });

  // 6. Diary Entries & Reviews
  const diary1 = await prisma.diaryEntry.upsert({
    where: {
      internshipId_entryDate: {
        internshipId: internship1.id,
        entryDate: new Date('2026-09-02'),
      },
    },
    update: {},
    create: {
      internshipId: internship1.id,
      entryDate: new Date('2026-09-02'),
      taskTitle: 'Kompaniya arxitekturasi va loyiha infratuzilmasi bilan tanishuv',
      description: 'DevOps jamoasi bilan uchrashuv o\'tkazildi. GitLab CI/CD pipelinelar va Docker konteynerlar tuzilishi o\'rganildi.',
      result: 'Lokal muhitda loyihaning barcha servislarini docker-compose orqali ishga tushirish muvaffaqiyatli yakunlandi.',
      hours: 8.0,
      status: DiaryEntryStatus.APPROVED,
      submittedAt: new Date('2026-09-02T18:00:00Z'),
      reviews: {
        create: {
          reviewerId: compSupervisor.id,
          decision: ReviewDecision.APPROVED,
          comment: 'Yaxshi boshlanish. Barcha ko\'rsatilgan talablar to\'liq bajarilgan.',
        },
      },
    },
  });

  const diary2 = await prisma.diaryEntry.upsert({
    where: {
      internshipId_entryDate: {
        internshipId: internship1.id,
        entryDate: new Date('2026-09-03'),
      },
    },
    update: {},
    create: {
      internshipId: internship1.id,
      entryDate: new Date('2026-09-03'),
      taskTitle: 'Backend mikroxizmatlari uchun Zod validatorlarini yangilash',
      description: 'To\'lovlar API endpointlari uchun kelayotgan JSON so\'rovlarni validatsiya qilish sxemalari ishlab chiqildi.',
      result: 'Unit testlar yozildi va barcha 14 ta test holatlari muvaffaqiyatli o\'tdi.',
      hours: 8.0,
      status: DiaryEntryStatus.SUBMITTED,
      submittedAt: new Date('2026-09-03T18:30:00Z'),
    },
  });

  // 7. Attendance records
  await prisma.attendance.upsert({
    where: {
      internshipId_attendanceDate: {
        internshipId: internship1.id,
        attendanceDate: new Date('2026-09-02'),
      },
    },
    update: {},
    create: {
      internshipId: internship1.id,
      attendanceDate: new Date('2026-09-02'),
      status: AttendanceStatus.PRESENT,
      note: 'O\'z vaqtida keldi va amaliyot ishlarini to\'liq bajardi.',
    },
  });

  await prisma.attendance.upsert({
    where: {
      internshipId_attendanceDate: {
        internshipId: internship1.id,
        attendanceDate: new Date('2026-09-03'),
      },
    },
    update: {},
    create: {
      internshipId: internship1.id,
      attendanceDate: new Date('2026-09-03'),
      status: AttendanceStatus.PRESENT,
    },
  });

  console.log('✅ Fictional development seed data successfully prepared.');
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
