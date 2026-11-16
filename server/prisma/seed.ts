import {
  PrismaClient,
  UserRole,
  InternshipStatus,
  DiaryEntryStatus,
  ReviewDecision,
  AttendanceStatus,
} from '@prisma/client';
import bcrypt from 'bcryptjs';
import { EVALUATION_CRITERIA } from '../src/config/evaluationCriteria';

const prisma = new PrismaClient();

// ── Date helpers (UTC, relative to "today" so demo data never expires) ─────────
const DAY = 24 * 3600 * 1000;
function utcToday(): Date {
  const s = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tashkent' }).format(new Date());
  const [y, m, d] = s.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}
const TODAY = utcToday();
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * DAY);
const ymd = (d: Date) => d.toISOString().split('T')[0];
const isWeekend = (d: Date) => d.getUTCDay() === 0 || d.getUTCDay() === 6;
function workingDays(from: Date, to: Date): Date[] {
  const out: Date[] = [];
  for (let d = new Date(from); d <= to; d = addDays(d, 1)) if (!isWeekend(d)) out.push(d);
  return out;
}

// Deterministic PRNG so every seed run produces the same demo data
let seedState = 20261116;
function rand(): number {
  seedState = (seedState * 1103515245 + 12345) % 2147483648;
  return seedState / 2147483648;
}

// Dates the automated test scripts create/delete on Jasur's internship — keep them free.
const TEST_RESERVED = new Set([
  '2026-09-01', '2026-09-15', '2026-10-01', '2026-10-15', '2026-10-16', '2026-10-17', '2026-10-18', '2026-10-19',
  '2026-10-20', '2026-10-28', '2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04',
  '2026-11-05', '2026-11-10', '2026-11-15', '2026-11-16', '2026-11-20', '2026-11-21', '2026-11-22', '2026-11-30',
]);

const PLAN_TEMPLATES: Record<string, { title: string; description: string; hours: number }[]> = {
  it: [
    { title: 'Korxona bilan tanishish, mehnat muhofazasi va texnika xavfsizligi', description: "Ichki tartib qoidalari, xavfsizlik yo'riqnomasi, ish o'rni bilan tanishuv", hours: 16 },
    { title: "Korxona axborot tizimlari va infratuzilmasini o'rganish", description: 'Server, tarmoq, ishlatiladigan dasturiy vositalar', hours: 32 },
    { title: "Dasturiy ta'minotni ishlab chiqishda ishtirok etish", description: 'Mentor topshirig‘i asosida modul ishlab chiqish', hours: 120 },
    { title: "Testlash va hujjatlashtirish", description: 'Unit testlar, foydalanuvchi qo‘llanmasi', hours: 40 },
    { title: 'Yakuniy hisobot tayyorlash va himoya', description: 'Kundalik, hisobot va taqdimot', hours: 16 },
  ],
  sec: [
    { title: 'Korxona bilan tanishish va axborot xavfsizligi siyosati', description: 'Ichki hujjatlar, kirish huquqlari tartibi', hours: 16 },
    { title: "Tarmoq monitoringi va hodisalarni qayd etish", description: 'SIEM, loglar tahlili', hours: 64 },
    { title: 'Zaifliklarni aniqlash va bartaraf etish', description: 'Skanerlash vositalari, hisobot', hours: 80 },
    { title: "Zaxira nusxalash va tiklash amaliyoti", description: 'Backup rejasi, sinov tiklash', hours: 32 },
    { title: 'Yakuniy hisobot tayyorlash', description: 'Kundalik va xulosa', hours: 16 },
  ],
  el: [
    { title: 'Ishlab chiqarish sexi bilan tanishish, texnika xavfsizligi', description: 'Sex tuzilmasi, xavfsizlik yo‘riqnomasi', hours: 16 },
    { title: "Elektr jihozlarini yig'ish va montaj qilish", description: 'Yig‘ish liniyasida ishlash', hours: 96 },
    { title: "Sifat nazorati va o'lchash asboblari", description: 'Multimetr, osillograf bilan ishlash', hours: 48 },
    { title: "Texnik xizmat ko'rsatish va nosozliklarni bartaraf etish", description: 'Diagnostika, ta’mirlash', hours: 48 },
    { title: 'Yakuniy hisobot tayyorlash', description: 'Kundalik va xulosa', hours: 16 },
  ],
};

const DIARY_TASKS: Record<string, string[]> = {
  it: [
    'Loyiha repozitoriysi va ishlab chiqish muhitini sozlash',
    'REST API uchun yangi endpoint yozish',
    "Ma'lumotlar bazasi sxemasini o'rganish va so'rovlarni optimallashtirish",
    "Frontend komponentlarini ishlab chiqish va kod sharhidan o'tkazish",
    'Unit testlar yozish va xatoliklarni tuzatish',
    'Jamoaviy stand-up va sprint rejalashtirishda ishtirok',
    'Foydalanuvchi qo‘llanmasini tayyorlash',
  ],
  sec: [
    "Xavfsizlik devori qoidalarini o'rganish",
    'Tarmoq trafigini Wireshark yordamida tahlil qilish',
    'Loglar asosida shubhali hodisalarni aniqlash',
    'Parol siyosatini audit qilish',
    'Zaifliklar skaneri natijalarini hisobotga tushirish',
    'Zaxira nusxadan tiklash sinovini o‘tkazish',
  ],
  el: [
    "Yig'ish liniyasida elektron platalarni montaj qilish",
    "Kavsharlash ishlari va sifatini tekshirish",
    "O'lchash asboblari bilan parametrlarni nazorat qilish",
    'Nosoz uskunani diagnostika qilish',
    'Texnik hujjatlar bilan ishlash',
    'Sex ustasi bilan rejaviy texnik xizmat ko‘rsatish',
  ],
};

async function upsertUser(data: {
  email: string;
  fullName: string;
  role: UserRole;
  passwordHash: string;
  phone?: string;
  position?: string;
  student?: { studentNumber: string; groupId: string; phone: string };
}) {
  return prisma.user.upsert({
    where: { email: data.email },
    update: { phone: data.phone ?? null, position: data.position ?? null },
    create: {
      email: data.email,
      fullName: data.fullName,
      role: data.role,
      passwordHash: data.passwordHash,
      isActive: true,
      phone: data.phone ?? null,
      position: data.position ?? null,
      ...(data.student ? { studentProfile: { create: data.student } } : {}),
    },
  });
}

async function main() {
  console.log('🌱 Fictional seed data populating...');
  const passwordHash = await bcrypt.hash('DevPassword123!', 10);

  // ── Groups (professional education: kollej/texnikum) ──
  const groups = {
    it: await prisma.studentGroup.upsert({
      where: { name: 'IT-210' },
      update: {},
      create: { name: 'IT-210', faculty: 'Axborot texnologiyalari bo‘limi', studyProgram: 'Dasturiy ta’minot texnigi' },
    }),
    sec: await prisma.studentGroup.upsert({
      where: { name: 'KB-301' },
      update: {},
      create: { name: 'KB-301', faculty: 'Kiberxavfsizlik bo‘limi', studyProgram: 'Axborot xavfsizligi texnigi' },
    }),
    el: await prisma.studentGroup.upsert({
      where: { name: 'EM-205' },
      update: {},
      create: { name: 'EM-205', faculty: 'Elektrotexnika bo‘limi', studyProgram: 'Elektr jihozlari montajchisi' },
    }),
  };

  // ── Companies ──
  const companies = {
    uzcard: await prisma.company.upsert({
      where: { name: 'Uzcard MChJ' },
      update: {},
      create: { name: 'Uzcard MChJ', address: "Toshkent sh., Mirobod tumani, Oybek ko'chasi, 12-uy", contactPhone: '+998 71 200-28-28', description: 'Yagona umumrespublika protsessing markazi' },
    }),
    epam: await prisma.company.upsert({
      where: { name: 'EPAM Systems' },
      update: {},
      create: { name: 'EPAM Systems', address: "Toshkent sh., Shayxontohur tumani, Navoiy ko'chasi, 1A", contactPhone: '+998 71 202-00-00', description: "Xalqaro dasturiy ta'minot injiniringi kompaniyasi" },
    }),
    artel: await prisma.company.upsert({
      where: { name: 'Artel Electronics' },
      update: {},
      create: { name: 'Artel Electronics', address: 'Toshkent sh., Yangihayot tumani, Sanoat zonasi', contactPhone: '+998 71 205-55-55', description: 'Maishiy texnika va elektronika ishlab chiqaruvchisi' },
    }),
    uztelecom: await prisma.company.upsert({
      where: { name: "O'zbektelekom AK" },
      update: {},
      create: { name: "O'zbektelekom AK", address: "Toshkent sh., Amir Temur shoh ko'chasi, 24", contactPhone: '+998 71 233-42-00', description: 'Milliy telekommunikatsiya operatori' },
    }),
  };

  // ── Staff ──
  await upsertUser({ email: 'admin@edu.uz', fullName: 'Aziz Rakhimov', role: UserRole.ADMIN, passwordHash, phone: '+998 71 123-45-67', position: 'Amaliyot bo‘limi boshlig‘i' });
  const uniSupervisor = await upsertUser({ email: 'dilshod.toshmatov@edu.uz', fullName: 'Dilshod Toshmatov', role: UserRole.UNIVERSITY_SUPERVISOR, passwordHash, phone: '+998 90 111-22-33', position: 'Ishlab chiqarish ta’limi ustasi' });
  const uniSupervisor2 = await upsertUser({ email: 'gulnora.saidova@edu.uz', fullName: 'Gulnora Saidova', role: UserRole.UNIVERSITY_SUPERVISOR, passwordHash, phone: '+998 93 444-55-66', position: 'Ishlab chiqarish ta’limi ustasi' });
  const compSupervisor = await upsertUser({ email: 'sherzod.nazarov@uzcard.uz', fullName: 'Sherzod Nazarov', role: UserRole.COMPANY_SUPERVISOR, passwordHash, phone: '+998 90 789-01-23', position: 'Bosh dasturchi (mentor)' });
  const compSupervisorEpam = await upsertUser({ email: 'nodira.karimova@epam.com', fullName: 'Nodira Karimova', role: UserRole.COMPANY_SUPERVISOR, passwordHash, phone: '+998 97 555-12-12', position: 'Xavfsizlik muhandisi' });
  const compSupervisorArtel = await upsertUser({ email: 'bobur.ergashev@artel.uz', fullName: 'Bobur Ergashev', role: UserRole.COMPANY_SUPERVISOR, passwordHash, phone: '+998 99 321-65-87', position: 'Sex ustasi' });
  const compSupervisorTel = await upsertUser({ email: 'kamola.yusupova@uztelecom.uz', fullName: 'Kamola Yusupova', role: UserRole.COMPANY_SUPERVISOR, passwordHash, phone: '+998 94 700-80-90', position: 'Tarmoq muhandisi' });

  // ── Original demo students (kept for automated tests) ──
  const jasur = await prisma.user.upsert({
    where: { email: 'jasur.aliev@student.edu.uz' },
    update: {},
    create: {
      fullName: 'Jasur Aliev',
      email: 'jasur.aliev@student.edu.uz',
      passwordHash,
      role: UserRole.STUDENT,
      isActive: true,
      studentProfile: { create: { studentNumber: 'ST-2022-0041', groupId: groups.it.id, phone: '+998 90 123-45-67' } },
      telegramAccount: { create: { telegramUserId: BigInt(876543210), username: 'jasur_aliev' } },
    },
  });
  const malika = await upsertUser({
    email: 'malika.usmanova@student.edu.uz',
    fullName: 'Malika Usmanova',
    role: UserRole.STUDENT,
    passwordHash,
    student: { studentNumber: 'ST-2022-0098', groupId: groups.sec.id, phone: '+998 91 987-65-43' },
  });

  // ── Extra students ──
  const extra = [
    { email: 'otabek.rasulov@student.edu.uz', name: 'Otabek Rasulov', num: 'ST-2022-0052', group: 'it', phone: '+998 90 222-11-00' },
    { email: 'zarina.qodirova@student.edu.uz', name: 'Zarina Qodirova', num: 'ST-2022-0057', group: 'it', phone: '+998 93 210-44-55' },
    { email: 'sardor.mirzayev@student.edu.uz', name: 'Sardor Mirzayev', num: 'ST-2022-0103', group: 'sec', phone: '+998 97 888-77-66' },
    { email: 'dilnoza.abdullayeva@student.edu.uz', name: 'Dilnoza Abdullayeva', num: 'ST-2022-0110', group: 'sec', phone: '+998 99 101-20-30' },
    { email: 'javohir.tursunov@student.edu.uz', name: 'Javohir Tursunov', num: 'ST-2023-0012', group: 'el', phone: '+998 90 600-70-80' },
    { email: 'shahnoza.ismoilova@student.edu.uz', name: 'Shahnoza Ismoilova', num: 'ST-2023-0019', group: 'el', phone: '+998 91 500-40-30' },
    { email: 'bekzod.hamidov@student.edu.uz', name: 'Bekzod Hamidov', num: 'ST-2023-0024', group: 'el', phone: '+998 94 321-00-12' },
    { email: 'aziza.nurmatova@student.edu.uz', name: 'Aziza Nurmatova', num: 'ST-2022-0061', group: 'it', phone: '+998 95 777-88-99' },
  ] as const;
  const students: Record<string, { id: string }> = {};
  for (const s of extra) {
    students[s.email] = await upsertUser({
      email: s.email,
      fullName: s.name,
      role: UserRole.STUDENT,
      passwordHash,
      student: { studentNumber: s.num, groupId: groups[s.group].id, phone: s.phone },
    });
  }

  // ── Internships ──
  const activeStart = new Date(Math.min(Date.UTC(2026, 8, 1), addDays(TODAY, -75).getTime()));
  const activeEnd = new Date(Math.max(Date.UTC(2026, 11, 26), addDays(TODAY, 30).getTime()));

  const jasurInternship = await prisma.internship.upsert({
    where: { id: 'clinternship001jasur' },
    update: { endDate: activeEnd, position: 'Backend dasturchi (amaliyotchi)' },
    create: {
      id: 'clinternship001jasur',
      studentId: jasur.id,
      companyId: companies.uzcard.id,
      companySupervisorId: compSupervisor.id,
      universitySupervisorId: uniSupervisor.id,
      startDate: activeStart,
      endDate: activeEnd,
      status: InternshipStatus.ACTIVE,
      position: 'Backend dasturchi (amaliyotchi)',
      programDescription: "Talabaning dasturiy ta'minot ishlab chiqish bo'yicha kasbiy ko'nikmalarini korxona sharoitida mustahkamlash.",
    },
  });

  type Spec = {
    id: string;
    studentId: string;
    company: { id: string };
    cs: { id: string };
    us: { id: string };
    kind: 'it' | 'sec' | 'el';
    position: string;
    status: InternshipStatus;
    start: Date;
    end: Date;
    diligence: number; // 0..1 — share of working days with a diary entry
    evaluate?: [number, number]; // company & institution share of max score
  };
  const completedStart = addDays(TODAY, -160);
  const completedEnd = addDays(TODAY, -40);
  const specs: Spec[] = [
    { id: 'clinternship002malika', studentId: malika.id, company: companies.epam, cs: compSupervisorEpam, us: uniSupervisor2, kind: 'sec', position: 'Axborot xavfsizligi bo‘yicha amaliyotchi', status: 'ACTIVE', start: activeStart, end: activeEnd, diligence: 0.85 },
    { id: 'clinternship003otabek', studentId: students['otabek.rasulov@student.edu.uz'].id, company: companies.uzcard, cs: compSupervisor, us: uniSupervisor, kind: 'it', position: 'Frontend dasturchi (amaliyotchi)', status: 'ACTIVE', start: activeStart, end: activeEnd, diligence: 0.92 },
    { id: 'clinternship004zarina', studentId: students['zarina.qodirova@student.edu.uz'].id, company: companies.uztelecom, cs: compSupervisorTel, us: uniSupervisor, kind: 'it', position: 'Tarmoq administratori yordamchisi', status: 'ACTIVE', start: activeStart, end: activeEnd, diligence: 0.55 },
    { id: 'clinternship005sardor', studentId: students['sardor.mirzayev@student.edu.uz'].id, company: companies.epam, cs: compSupervisorEpam, us: uniSupervisor2, kind: 'sec', position: 'SOC tahlilchisi (amaliyotchi)', status: 'ACTIVE', start: activeStart, end: activeEnd, diligence: 0.8 },
    { id: 'clinternship006dilnoza', studentId: students['dilnoza.abdullayeva@student.edu.uz'].id, company: companies.uztelecom, cs: compSupervisorTel, us: uniSupervisor2, kind: 'sec', position: 'Axborot xavfsizligi amaliyotchisi', status: 'COMPLETED', start: completedStart, end: completedEnd, diligence: 0.95, evaluate: [0.91, 0.88] },
    { id: 'clinternship007javohir', studentId: students['javohir.tursunov@student.edu.uz'].id, company: companies.artel, cs: compSupervisorArtel, us: uniSupervisor2, kind: 'el', position: 'Elektr montajchi (amaliyotchi)', status: 'ACTIVE', start: activeStart, end: activeEnd, diligence: 0.75 },
    { id: 'clinternship008shahnoza', studentId: students['shahnoza.ismoilova@student.edu.uz'].id, company: companies.artel, cs: compSupervisorArtel, us: uniSupervisor2, kind: 'el', position: 'Sifat nazorati amaliyotchisi', status: 'COMPLETED', start: completedStart, end: completedEnd, diligence: 0.88, evaluate: [0.78, 0.82] },
    { id: 'clinternship009bekzod', studentId: students['bekzod.hamidov@student.edu.uz'].id, company: companies.artel, cs: compSupervisorArtel, us: uniSupervisor2, kind: 'el', position: 'Elektr montajchi (amaliyotchi)', status: 'ACTIVE', start: activeStart, end: activeEnd, diligence: 0.35 },
    { id: 'clinternship010aziza', studentId: students['aziza.nurmatova@student.edu.uz'].id, company: companies.epam, cs: compSupervisorEpam, us: uniSupervisor, kind: 'it', position: 'QA muhandisi (amaliyotchi)', status: 'COMPLETED', start: completedStart, end: completedEnd, diligence: 0.9, evaluate: [0.66, 0.7] },
  ];

  // Plan hours are scaled so the whole plan equals the internship's working days × 8 h
  const ensurePlan = async (internshipId: string, kind: keyof typeof PLAN_TEMPLATES, start: Date, end: Date) => {
    const existing = await prisma.internshipPlanItem.findMany({ where: { internshipId }, orderBy: { orderIndex: 'asc' } });
    if (existing.length) return existing;
    const template = PLAN_TEMPLATES[kind];
    const templateTotal = template.reduce((a, p) => a + p.hours, 0);
    const totalHours = workingDays(start, end).length * 8;
    for (const [i, p] of template.entries()) {
      const hours = Math.max(8, Math.round((p.hours / templateTotal) * totalHours / 8) * 8);
      await prisma.internshipPlanItem.create({ data: { internshipId, orderIndex: i, title: p.title, description: p.description, plannedHours: hours } });
    }
    return prisma.internshipPlanItem.findMany({ where: { internshipId }, orderBy: { orderIndex: 'asc' } });
  };

  // ── Jasur: original two entries + plan + a few September/October entries outside test-reserved dates ──
  const jasurPlan = await ensurePlan(jasurInternship.id, 'it', activeStart, activeEnd);
  await prisma.diaryEntry.upsert({
    where: { internshipId_entryDate: { internshipId: jasurInternship.id, entryDate: new Date('2026-09-02') } },
    update: { planItemId: jasurPlan[1].id },
    create: {
      internshipId: jasurInternship.id,
      entryDate: new Date('2026-09-02'),
      planItemId: jasurPlan[1].id,
      taskTitle: 'Kompaniya arxitekturasi va loyiha infratuzilmasi bilan tanishuv',
      description: "DevOps jamoasi bilan uchrashuv o'tkazildi. GitLab CI/CD pipelinelar va Docker konteynerlar tuzilishi o'rganildi.",
      result: 'Lokal muhitda loyihaning barcha servislarini docker-compose orqali ishga tushirish muvaffaqiyatli yakunlandi.',
      hours: 8.0,
      status: DiaryEntryStatus.APPROVED,
      submittedAt: new Date('2026-09-02T18:00:00Z'),
      reviews: { create: { reviewerId: compSupervisor.id, decision: ReviewDecision.APPROVED, comment: "Yaxshi boshlanish. Barcha ko'rsatilgan talablar to'liq bajarilgan." } },
    },
  });
  await prisma.diaryEntry.upsert({
    where: { internshipId_entryDate: { internshipId: jasurInternship.id, entryDate: new Date('2026-09-03') } },
    update: { planItemId: jasurPlan[2].id },
    create: {
      internshipId: jasurInternship.id,
      entryDate: new Date('2026-09-03'),
      planItemId: jasurPlan[2].id,
      taskTitle: 'Backend mikroxizmatlari uchun Zod validatorlarini yangilash',
      description: "To'lovlar API endpointlari uchun kelayotgan JSON so'rovlarni validatsiya qilish sxemalari ishlab chiqildi.",
      result: "Unit testlar yozildi va barcha 14 ta test holatlari muvaffaqiyatli o'tdi.",
      hours: 8.0,
      status: DiaryEntryStatus.SUBMITTED,
      submittedAt: new Date('2026-09-03T18:30:00Z'),
    },
  });
  for (const ds of ['2026-09-02', '2026-09-03']) {
    await prisma.attendance.upsert({
      where: { internshipId_attendanceDate: { internshipId: jasurInternship.id, attendanceDate: new Date(ds) } },
      update: {},
      create: { internshipId: jasurInternship.id, attendanceDate: new Date(ds), status: AttendanceStatus.PRESENT },
    });
  }
  const jasurDays = workingDays(new Date('2026-09-04'), new Date('2026-10-14')).filter((d) => !TEST_RESERVED.has(ymd(d)));
  for (const [i, d] of jasurDays.entries()) {
    const planItem = jasurPlan[Math.min(jasurPlan.length - 2, 1 + Math.floor(i / 12))];
    const exists = await prisma.diaryEntry.findUnique({ where: { internshipId_entryDate: { internshipId: jasurInternship.id, entryDate: d } } });
    if (!exists) {
      await prisma.diaryEntry.create({
        data: {
          internshipId: jasurInternship.id,
          entryDate: d,
          planItemId: planItem.id,
          taskTitle: DIARY_TASKS.it[i % DIARY_TASKS.it.length],
          description: 'Mentor topshirig‘iga muvofiq ish bajarildi, natijalar jamoa bilan muhokama qilindi.',
          result: 'Topshiriq bajarildi, kod repozitoriyga yuklandi.',
          hours: 8,
          status: DiaryEntryStatus.APPROVED,
          submittedAt: addDays(d, 0),
          reviews: { create: { reviewerId: compSupervisor.id, decision: ReviewDecision.APPROVED, comment: 'Tasdiqlandi.' } },
        },
      });
    }
    await prisma.attendance.upsert({
      where: { internshipId_attendanceDate: { internshipId: jasurInternship.id, attendanceDate: d } },
      update: {},
      create: { internshipId: jasurInternship.id, attendanceDate: d, status: i % 11 === 5 ? AttendanceStatus.LATE : AttendanceStatus.PRESENT, hours: 8 },
    });
  }

  // ── Other internships: full generated history ──
  for (const sp of specs) {
    const exists = await prisma.internship.findUnique({ where: { id: sp.id } });
    if (exists) {
      if (sp.status === 'ACTIVE') await prisma.internship.update({ where: { id: sp.id }, data: { endDate: activeEnd } });
      continue;
    }
    await prisma.internship.create({
      data: {
        id: sp.id,
        studentId: sp.studentId,
        companyId: sp.company.id,
        companySupervisorId: sp.cs.id,
        universitySupervisorId: sp.us.id,
        startDate: sp.start,
        endDate: sp.end,
        status: sp.status,
        position: sp.position,
        programDescription: "Kasbiy ko'nikmalarni ishlab chiqarish sharoitida shakllantirish va mustahkamlash.",
      },
    });
    const plan = await ensurePlan(sp.id, sp.kind, sp.start, sp.end);
    const lastDay = sp.status === 'COMPLETED' ? sp.end : addDays(TODAY, -1);
    const days = workingDays(sp.start, lastDay);

    for (const d of days) {
      // Attendance
      const r = rand();
      const att: AttendanceStatus = r < 0.84 ? 'PRESENT' : r < 0.92 ? 'LATE' : r < 0.96 ? 'EXCUSED' : 'ABSENT';
      await prisma.attendance.create({
        data: { internshipId: sp.id, attendanceDate: d, status: att, hours: att === 'ABSENT' || att === 'EXCUSED' ? 0 : att === 'LATE' ? 7 : 8 },
      });
      if (att === 'ABSENT' || att === 'EXCUSED') continue;
      // Low-diligence students skip more days, especially recently (drives reminders)
      const recent = (lastDay.getTime() - d.getTime()) / DAY < 6;
      if (rand() > sp.diligence || (recent && sp.diligence < 0.6)) continue;

      // Position within the WHOLE internship period (not just the days elapsed so far)
      const progress = (d.getTime() - sp.start.getTime()) / Math.max(1, sp.end.getTime() - sp.start.getTime());
      // Pick the plan item whose cumulative share of planned hours covers this point in time
      const totalPlanned = plan.reduce((acc, p) => acc + Number(p.plannedHours), 0);
      let acc = 0;
      const planItem =
        plan.find((p) => {
          acc += Number(p.plannedHours);
          return progress <= acc / totalPlanned;
        }) ?? plan[plan.length - 1];
      const ageDays = (TODAY.getTime() - d.getTime()) / DAY;
      let status: DiaryEntryStatus = 'APPROVED';
      if (sp.status === 'ACTIVE') {
        if (ageDays < 3) status = rand() < 0.5 ? 'SUBMITTED' : 'DRAFT';
        else if (ageDays < 9) status = rand() < 0.6 ? 'SUBMITTED' : 'APPROVED';
        else if (rand() < 0.06) status = 'RETURNED';
      }
      const task = DIARY_TASKS[sp.kind][Math.floor(rand() * DIARY_TASKS[sp.kind].length)];
      const reviewer = rand() < 0.75 ? sp.cs.id : sp.us.id;
      await prisma.diaryEntry.create({
        data: {
          internshipId: sp.id,
          entryDate: d,
          planItemId: planItem.id,
          taskTitle: task,
          description: `${task}. Ish jarayoni rahbar ko'rsatmasi asosida bajarildi va natijalar qayd etildi.`,
          result: rand() < 0.8 ? 'Topshiriq to‘liq bajarildi.' : null,
          hours: att === 'LATE' ? 7 : 8,
          status,
          submittedAt: status === 'DRAFT' ? null : d,
          ...(status === 'APPROVED' || status === 'RETURNED'
            ? {
                reviews: {
                  create: {
                    reviewerId: reviewer,
                    decision: status === 'APPROVED' ? ReviewDecision.APPROVED : ReviewDecision.RETURNED,
                    comment: status === 'APPROVED' ? 'Tasdiqlandi.' : "Bajarilgan ish natijasini batafsilroq yozing.",
                  },
                },
              }
            : {}),
        },
      });
    }

    // Final evaluations for completed internships
    if (sp.evaluate) {
      const pairs: [UserRole, string, number][] = [
        ['COMPANY_SUPERVISOR', sp.cs.id, sp.evaluate[0]],
        ['UNIVERSITY_SUPERVISOR', sp.us.id, sp.evaluate[1]],
      ];
      for (const [role, evaluatorId, share] of pairs) {
        const scores = EVALUATION_CRITERIA.map((c) => ({
          criterionKey: c.key,
          score: Math.max(0, Math.min(c.maxScore, Math.round(c.maxScore * (share + (rand() - 0.5) * 0.12)))),
          comment: null as string | null,
        }));
        await prisma.finalEvaluation.create({
          data: {
            internshipId: sp.id,
            evaluatorId,
            evaluatorRole: role,
            status: 'SUBMITTED',
            totalScore: scores.reduce((a, b) => a + b.score, 0),
            generalComment: role === 'COMPANY_SUPERVISOR' ? 'Amaliyotchi topshiriqlarni mas’uliyat bilan bajardi.' : 'Kundalik muntazam va sifatli yuritildi.',
            submittedAt: addDays(sp.end, 2),
            criteriaScores: { create: scores },
          },
        });
      }
    }
  }

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
