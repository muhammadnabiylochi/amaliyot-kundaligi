import express from 'express';
import cookieParser from 'cookie-parser';
import { PrismaClient, UserRole } from '@prisma/client';
import apiRouter from '../src/routes';
import { errorHandler } from '../src/middleware/errorHandler';
import { generateToken } from '../src/middleware/auth';

const prisma = new PrismaClient();

async function runAttendanceIntegrationTests() {
  console.log('========================================================================');
  console.log('🧪 DAVOMAT KALENDARI VA RBAC INTEGRATSION TESTLARI');
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

  // 1. Ephemeral Express server for end-to-end HTTP requests
  const app = express();
  app.use(cookieParser());
  app.use(express.json());
  app.use('/api', apiRouter);
  app.use(errorHandler);

  const server = app.listen(0);
  const address = server.address() as any;
  const baseUrl = `http://127.0.0.1:${address.port}/api`;

  try {
    // 2. Fetch seed users and check roles
    const student = await prisma.user.findUnique({ where: { email: 'jasur.aliev@student.edu.uz' } });
    const supervisor = await prisma.user.findUnique({ where: { email: 'sherzod.nazarov@uzcard.uz' } });
    const uniSupervisor = await prisma.user.findUnique({ where: { email: 'dilshod.toshmatov@edu.uz' } });
    const admin = await prisma.user.findUnique({ where: { email: 'admin@edu.uz' } });

    assert(Boolean(student && supervisor && uniSupervisor && admin), 'Barcha test foydalanuvchilari (Talaba, Korxona rahbari, Univ rahbari, Admin) mavjud');

    // Generate JWT tokens
    const studentToken = generateToken({ id: student!.id, role: student!.role });
    const supervisorToken = generateToken({ id: supervisor!.id, role: supervisor!.role });
    const uniSupervisorToken = generateToken({ id: uniSupervisor!.id, role: uniSupervisor!.role });
    const adminToken = generateToken({ id: admin!.id, role: admin!.role });

    // Find student's assigned internship
    const internship = await prisma.internship.findFirst({
      where: {
        studentId: student!.id,
        companySupervisorId: supervisor!.id,
      },
    });
    assert(Boolean(internship), 'Talabaning korxona rahbariga biriktirilgan amaliyot dasturi mavjud');

    // Clean any prior test attendance in November 2026 for this internship
    const testMonthStart = new Date(Date.UTC(2026, 10, 1));
    const testMonthEnd = new Date(Date.UTC(2026, 10, 30, 23, 59, 59, 999));
    await prisma.attendance.deleteMany({
      where: {
        internshipId: internship!.id,
        attendanceDate: {
          gte: testMonthStart,
          lte: testMonthEnd,
        },
      },
    });

    // ── TEST 1: Talaba o'z davomatini ko'ra olishi (GET /api/attendance) ──
    const res1 = await fetch(`${baseUrl}/attendance?month=2026-11`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    const data1 = (await res1.json()) as any;
    assert(res1.status === 200 && data1.success === true, 'TEST 1: Talaba o\'z davomatini so\'rab olish huquqiga ega (HTTP 200)');

    // ── TEST 2: Talaba davomatni o'zi belgilay olmasligi (POST /api/attendance) ──
    const res2 = await fetch(`${baseUrl}/attendance`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentToken}`,
      },
      body: JSON.stringify({
        internshipId: internship!.id,
        attendanceDate: '2026-11-01',
        status: 'PRESENT',
        hours: 8.0,
      }),
    });
    const data2 = (await res2.json()) as any;
    assert(
      res2.status === 403 && data2.error?.message?.includes('Talabalar davomatni mustaqil belgilash huquqiga ega emas'),
      'TEST 2: Talaba davomatni o\'zi belgilamoqchi bo\'lsa 403 bilan taqiqlanadi'
    );

    // ── TEST 3: Universitet rahbari davomatni belgilay olmasligi (POST /api/attendance) ──
    const res3 = await fetch(`${baseUrl}/attendance`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${uniSupervisorToken}`,
      },
      body: JSON.stringify({
        internshipId: internship!.id,
        attendanceDate: '2026-11-01',
        status: 'PRESENT',
        hours: 8.0,
      }),
    });
    const data3 = (await res3.json()) as any;
    assert(
      res3.status === 403 && data3.error?.message?.includes('muassasasi rahbari davomatni faqat kuzatishi mumkin'),
      'TEST 3: Universitet rahbari davomatni belgilashga uringanda 403 bilan to\'xtatiladi'
    );

    // ── TEST 4: Korxona rahbari o'ziga biriktirilgan talaba davomatini qayd etishi (PRESENT) ──
    const res4 = await fetch(`${baseUrl}/attendance`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${supervisorToken}`,
      },
      body: JSON.stringify({
        internshipId: internship!.id,
        attendanceDate: '2026-11-01',
        status: 'PRESENT',
        hours: 8.0,
        note: "O'z vaqtida keldi va topshiriqlarni bajardi",
      }),
    });
    const data4 = (await res4.json()) as any;
    assert(
      res4.status === 200 && data4.success === true && data4.data?.status === 'PRESENT' && data4.data?.hours === 8.0,
      'TEST 4: Korxona rahbari o\'z talabasi davomatini (PRESENT, 8 soat) muvaffaqiyatli saqladi'
    );

    // ── TEST 5: Takroriy sana uchun davomat: UPSERT (dublikat yaratilmaydi, yangilanadi) ──
    const res5 = await fetch(`${baseUrl}/attendance`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${supervisorToken}`,
      },
      body: JSON.stringify({
        internshipId: internship!.id,
        attendanceDate: '2026-11-01',
        status: 'LATE',
        hours: 6.5,
        note: '30 daqiqa kechikib keldi',
      }),
    });
    const data5 = (await res5.json()) as any;

    const countOnDate = await prisma.attendance.count({
      where: {
        internshipId: internship!.id,
        attendanceDate: new Date('2026-11-01'),
      },
    });

    assert(
      res5.status === 200 && data5.data?.status === 'LATE' && data5.data?.hours === 6.5 && countOnDate === 1,
      'TEST 5: Takroriy sana dublikat hosil qilmadi, mavjud yozuvni yangiladi (LATE, 6.5 soat, count=1)'
    );

    // ── TEST 6: Turli xil holatlar (ABSENT, EXCUSED) qayd etilishi ──
    // ABSENT
    await fetch(`${baseUrl}/attendance`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${supervisorToken}`,
      },
      body: JSON.stringify({
        internshipId: internship!.id,
        attendanceDate: '2026-11-02',
        status: 'ABSENT',
        hours: 0,
        note: 'Sababsiz kelmadi',
      }),
    });

    // EXCUSED
    await fetch(`${baseUrl}/attendance`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${supervisorToken}`,
      },
      body: JSON.stringify({
        internshipId: internship!.id,
        attendanceDate: '2026-11-03',
        status: 'EXCUSED',
        hours: 8.0,
        note: "Tibbiy ma'lumotnoma taqdim etildi",
      }),
    });

    // PRESENT yana bir kun
    await fetch(`${baseUrl}/attendance`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${supervisorToken}`,
      },
      body: JSON.stringify({
        internshipId: internship!.id,
        attendanceDate: '2026-11-04',
        status: 'PRESENT',
        hours: 8.0,
        note: 'Standart amaliyot kuni',
      }),
    });

    // ── TEST 7: Korxona rahbari begona amaliyotga davomat qo'ya olmasligi (IDOR tekshiruvi) ──
    // Begona dummy internship yaratamiz (boshqa korxona va boshqa rahbar)
    const otherCompany = await prisma.company.findFirst({
      where: { id: { not: internship!.companyId } },
    });
    const dummyOtherInternship = await prisma.internship.create({
      data: {
        studentId: student!.id,
        companyId: otherCompany ? otherCompany.id : internship!.companyId,
        companySupervisorId: admin!.id, // rahbari boshqa odam (admin)
        universitySupervisorId: uniSupervisor!.id,
        startDate: new Date('2026-11-01'),
        endDate: new Date('2026-11-30'),
        status: 'ACTIVE',
      },
    });

    const res7 = await fetch(`${baseUrl}/attendance`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${supervisorToken}`,
      },
      body: JSON.stringify({
        internshipId: dummyOtherInternship.id,
        attendanceDate: '2026-11-05',
        status: 'PRESENT',
        hours: 8.0,
      }),
    });
    const data7 = (await res7.json()) as any;
    assert(
      res7.status === 403 && data7.error?.message?.includes('Ushbu amaliyot sizning korxonangizga yoki sizga biriktirilmagan'),
      'TEST 7: Korxona rahbari o\'ziga biriktirilmagan amaliyot davomatini belgilay olmaydi (IDOR himoyasi)'
    );

    // Dummy internshipni tozalash
    await prisma.internship.delete({ where: { id: dummyOtherInternship.id } });

    // ── TEST 8: Davomat statistikasi agregatsiyasi (GET /api/attendance/stats) ──
    const statsRes = await fetch(`${baseUrl}/attendance/stats?month=2026-11&internshipId=${internship!.id}`, {
      headers: { Authorization: `Bearer ${supervisorToken}` },
    });
    const statsData = (await statsRes.json()) as any;

    const statsObj = statsData.data;
    assert(
      statsRes.status === 200 &&
      statsObj.totalDays === 4 &&
      statsObj.lateDays === 1 &&
      statsObj.absentDays === 1 &&
      statsObj.excusedDays === 1 &&
      statsObj.presentDays === 1 &&
      statsObj.totalHours === (6.5 + 0 + 8.0 + 8.0),
      `TEST 8: Davomat statistikasi to'liq hisoblandi (Jami: ${statsObj.totalDays}, Kelgan: ${statsObj.presentDays}, Kechikkan: ${statsObj.lateDays}, Kelmagan: ${statsObj.absentDays}, Sababli: ${statsObj.excusedDays}, Soat: ${statsObj.totalHours})`
    );

    // ── TEST 9: Status bo'yicha filter (GET /api/attendance?status=ABSENT) ──
    const filterRes = await fetch(`${baseUrl}/attendance?month=2026-11&status=ABSENT&internshipId=${internship!.id}`, {
      headers: { Authorization: `Bearer ${supervisorToken}` },
    });
    const filterData = (await filterRes.json()) as any;
    const allAbsent = filterData.data.every((r: any) => r.status === 'ABSENT');
    assert(
      filterRes.status === 200 && filterData.data.length === 1 && allAbsent,
      'TEST 9: Holat bo\'yicha filtrlash to\'g\'ri ishladi (Faqat ABSENT yozuvlari qaytdi)'
    );

    // ── TEST 10: Administrator davomat ustidan to'liq nazoratga egaligi ──
    const adminRes = await fetch(`${baseUrl}/attendance`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        internshipId: internship!.id,
        attendanceDate: '2026-11-10',
        status: 'PRESENT',
        hours: 8.0,
        note: 'Administrator tomonidan tasdiqlandi',
      }),
    });
    const adminData = (await adminRes.json()) as any;
    assert(
      adminRes.status === 200 && adminData.success === true && adminData.data?.status === 'PRESENT',
      'TEST 10: Administrator istalgan amaliyot uchun davomatni boshqara oladi (Admin nazorati)'
    );

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

runAttendanceIntegrationTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
