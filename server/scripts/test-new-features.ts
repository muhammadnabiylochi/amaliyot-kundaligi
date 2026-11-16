/**
 * Integration tests for features added in the "mukammal" iteration:
 * companies/groups/internships CRUD, internship plan + diary linking, user management
 * (create / edit / reset password / Excel import), change password, analytics, group journal,
 * final report PDF + public QR verification, notifications and manual reminders.
 */
import express from 'express';
import cookieParser from 'cookie-parser';
import ExcelJS from 'exceljs';
import { PrismaClient } from '@prisma/client';
import { AddressInfo } from 'net';
import apiRouter from '../src/routes';
import { errorHandler } from '../src/middleware/errorHandler';
import { generateToken } from '../src/middleware/auth';
import { verificationCode } from '../src/routes/finalReport';

const prisma = new PrismaClient();
let passed = 0;
let total = 0;
function assert(cond: boolean, name: string, extra?: unknown) {
  total++;
  if (cond) {
    passed++;
    console.log(`  ✅ PASS: ${name}`);
  } else {
    console.error(`  ❌ FAIL: ${name}${extra ? ` → ${JSON.stringify(extra).slice(0, 300)}` : ''}`);
  }
}

async function main() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api', apiRouter);
  app.use(errorHandler);
  const server = app.listen(0);
  const base = `http://localhost:${(server.address() as AddressInfo).port}/api`;

  const call = async (method: string, path: string, token?: string, body?: unknown) => {
    const res = await fetch(base + path, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const type = res.headers.get('content-type') || '';
    const data = type.includes('json') ? await res.json() : Buffer.from(await res.arrayBuffer());
    return { status: res.status, data: data as any, type };
  };

  const admin = (await prisma.user.findUnique({ where: { email: 'admin@edu.uz' } }))!;
  const sup = (await prisma.user.findUnique({ where: { email: 'sherzod.nazarov@uzcard.uz' } }))!;
  const uni = (await prisma.user.findUnique({ where: { email: 'dilshod.toshmatov@edu.uz' } }))!;
  const student = (await prisma.user.findUnique({ where: { email: 'jasur.aliev@student.edu.uz' } }))!;
  const otherStudent = (await prisma.user.findUnique({ where: { email: 'malika.usmanova@student.edu.uz' } }))!;
  const A = generateToken(admin);
  const S = generateToken(sup);
  const ST = generateToken(student);
  const OST = generateToken(otherStudent);
  const tag = Date.now().toString(36);
  const cleanup: (() => Promise<unknown>)[] = [];

  try {
    console.log('\n--- 1. Korxona va guruh katalogi ---');
    const c1 = await call('POST', '/companies', A, { name: `Test korxona ${tag}`, address: 'Toshkent sh., Test 1' });
    assert(c1.status === 201 && c1.data.data?.id, 'Admin korxona yaratadi (201)', c1.data);
    const companyId = c1.data.data.id;
    cleanup.push(() => prisma.company.deleteMany({ where: { id: companyId } }));
    assert((await call('POST', '/companies', ST, { name: 'x', address: 'yyy' })).status === 403, 'Talaba korxona yarata olmaydi (403)');
    const dup = await call('POST', '/companies', A, { name: `Test korxona ${tag}`, address: 'Boshqa manzil' });
    assert(dup.status === 400 && /allaqachon/.test(dup.data.error?.message), 'Takroriy korxona nomi 400 va tushunarli xabar', dup.data);
    assert((await call('PATCH', `/companies/${companyId}`, A, { contactPhone: '+998 71 000-00-00' })).status === 200, 'Korxona tahrirlanadi');

    const g1 = await call('POST', '/groups', A, { name: `TG-${tag}`, faculty: 'Test bo‘limi', studyProgram: 'Test mutaxassisligi' });
    assert(g1.status === 201, 'Admin guruh yaratadi (201)', g1.data);
    const groupId = g1.data.data.id;
    cleanup.push(() => prisma.studentGroup.deleteMany({ where: { id: groupId } }));
    const glist = await call('GET', '/groups', S);
    assert(glist.status === 200 && glist.data.data.some((g: any) => g.id === groupId), 'Rahbar guruhlar ro‘yxatini ko‘radi');

    console.log('\n--- 2. Foydalanuvchilar: yaratish, tahrirlash, parol ---');
    const u1 = await call('POST', '/users', A, { fullName: 'Test Talaba Bir', email: `t1.${tag}@student.edu.uz`, role: 'STUDENT', groupId, phone: '+998901112233' });
    assert(u1.status === 201 && /^Amaliyot-[A-Z0-9]{6}$/.test(u1.data.data?.tempPassword), 'Admin talaba yaratadi va vaqtinchalik parol oladi', u1.data);
    const newStudentId = u1.data.data.user.id;
    cleanup.push(() => prisma.user.deleteMany({ where: { id: newStudentId } }));
    const noGroup = await call('POST', '/users', A, { fullName: 'Guruhsiz Talaba', email: `t2.${tag}@student.edu.uz`, role: 'STUDENT' });
    assert(noGroup.status === 400, 'Guruhsiz talaba yaratish 400', noGroup.data);

    const login1 = await call('POST', '/auth/login', undefined, { email: `t1.${tag}@student.edu.uz`, password: u1.data.data.tempPassword });
    assert(login1.status === 200 && login1.data.data.user.mustChangePassword === true, 'Yangi foydalanuvchi vaqtinchalik parol bilan kiradi, mustChangePassword=true');
    const T1 = login1.data.data.token;
    const weak = await call('POST', '/auth/change-password', T1, { currentPassword: u1.data.data.tempPassword, newPassword: 'short' });
    assert(weak.status === 400, 'Kuchsiz yangi parol rad etiladi');
    const wrong = await call('POST', '/auth/change-password', T1, { currentPassword: 'notit', newPassword: 'YangiParol2026' });
    assert(wrong.status === 400 && /Joriy parol/.test(wrong.data.error?.message), "Noto'g'ri joriy parol rad etiladi");
    const ok = await call('POST', '/auth/change-password', T1, { currentPassword: u1.data.data.tempPassword, newPassword: 'YangiParol2026' });
    assert(ok.status === 200, 'Parol muvaffaqiyatli almashtirildi');
    const me = await call('GET', '/auth/me', T1);
    assert(me.data.data.mustChangePassword === false && me.data.data.phone === '+998901112233', '/auth/me: mustChangePassword=false va telefon saqlangan', me.data);

    const edit = await call('PATCH', `/users/${newStudentId}`, A, { fullName: 'Test Talaba Tahrirlangan', phone: '+998909998877' });
    assert(edit.status === 200 && edit.data.data.name === 'Test Talaba Tahrirlangan' && edit.data.data.phone === '+998909998877', 'Admin foydalanuvchini tahrirlaydi', edit.data);
    const reset = await call('POST', `/users/${newStudentId}/reset-password`, A);
    assert(reset.status === 200 && reset.data.data.tempPassword, 'Admin parolni tiklaydi (yangi vaqtinchalik parol)');
    const oldLogin = await call('POST', '/auth/login', undefined, { email: `t1.${tag}@student.edu.uz`, password: 'YangiParol2026' });
    assert(oldLogin.status === 401, 'Tiklashdan keyin eski parol ishlamaydi');
    const selfBlock = await call('PATCH', `/users/${admin.id}/toggle-status`, A);
    assert(selfBlock.status === 400, 'Admin o‘zini bloklay olmaydi');

    console.log('\n--- 3. Excel import ---');
    const tpl = await call('GET', '/users/import/template', A);
    assert(tpl.status === 200 && Buffer.isBuffer(tpl.data) && tpl.data.subarray(0, 2).toString() === 'PK', 'Import shabloni .xlsx yuklab olinadi');
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Import');
    ws.addRow(['F.I.SH', 'Email', 'Rol', 'Guruh', "Bo'lim", 'Mutaxassislik', 'Talaba ID', 'Telefon']);
    ws.addRow(['Import Talaba Bir', `imp1.${tag}@student.edu.uz`, 'Talaba', `IMP-${tag}`, 'Import bo‘limi', 'Import mutaxassisligi', '', '+998900000001']);
    ws.addRow(['Import Rahbar', `imp2.${tag}@korxona.uz`, 'Korxona rahbari', '', '', '', '', '+998900000002']);
    ws.addRow(['Takroriy', 'admin@edu.uz', 'Administrator', '', '', '', '', '']);
    ws.addRow(['Xato rol', `imp3.${tag}@x.uz`, 'Direktor', '', '', '', '', '']);
    const buf = Buffer.from(await wb.xlsx.writeBuffer());
    const form = new FormData();
    form.append('file', new Blob([buf]), 'import.xlsx');
    const impRes = await fetch(`${base}/users/import`, { method: 'POST', headers: { Authorization: `Bearer ${A}` }, body: form });
    const imp = (await impRes.json()) as any;
    cleanup.push(() => prisma.user.deleteMany({ where: { email: { in: [`imp1.${tag}@student.edu.uz`, `imp2.${tag}@korxona.uz`] } } }));
    cleanup.push(() => prisma.studentGroup.deleteMany({ where: { name: `IMP-${tag}` } }));
    assert(impRes.status === 200 && imp.data.created === 2 && imp.data.skipped === 1 && imp.data.errors === 1, 'Import: 2 yaratildi, 1 o‘tkazib yuborildi, 1 xato', imp.data);
    assert(Boolean(await prisma.studentGroup.findUnique({ where: { name: `IMP-${tag}` } })), 'Importda yangi guruh avtomatik yaratildi');

    console.log('\n--- 4. Amaliyot yaratish va reja ---');
    const i1 = await call('POST', '/internships', A, {
      studentId: newStudentId, companyId, companySupervisorId: sup.id, universitySupervisorId: uni.id,
      startDate: '2026-09-01', endDate: '2027-06-30', status: 'ACTIVE', position: 'Test amaliyotchi',
    });
    assert(i1.status === 201, 'Admin amaliyot yaratadi', i1.data);
    const internshipId = i1.data.data.id;
    cleanup.unshift(() => prisma.internship.deleteMany({ where: { id: internshipId } }));
    const i2 = await call('POST', '/internships', A, { studentId: newStudentId, companyId, startDate: '2026-09-01', endDate: '2026-12-01', status: 'ACTIVE' });
    assert(i2.status === 400, 'Bitta talabaga ikkinchi faol amaliyot berilmaydi', i2.data);
    const badRole = await call('POST', '/internships', A, { studentId: sup.id, companyId, startDate: '2026-09-01', endDate: '2026-12-01' });
    assert(badRole.status === 400, 'Talaba o‘rniga rahbar tanlansa 400');
    const badDates = await call('POST', '/internships', A, { studentId: newStudentId, companyId, startDate: '2026-12-01', endDate: '2026-09-01', status: 'PLANNED' });
    assert(badDates.status === 400, 'Tugash sanasi boshlanishdan oldin bo‘lsa 400');

    const p1 = await call('POST', `/internships/${internshipId}/plan`, S, { title: 'Korxona bilan tanishish', plannedHours: 16 });
    assert(p1.status === 201, 'Biriktirilgan korxona rahbari reja bandini qo‘shadi', p1.data);
    const p2 = await call('POST', `/internships/${internshipId}/plan`, A, { title: 'Asosiy ishlab chiqarish topshiriqlari', plannedHours: 8 });
    const planItemId = p2.data.data.id;
    assert((await call('POST', `/internships/${internshipId}/plan`, ST, { title: 'Talaba qo‘shmoqchi', plannedHours: 8 })).status === 403, 'Talaba rejani o‘zgartira olmaydi');
    assert((await call('PATCH', `/internships/${internshipId}/plan/${p1.data.data.id}`, A, { plannedHours: 24 })).status === 200, 'Reja bandi tahrirlanadi');

    // Diary linked to the plan
    const T1b = (await call('POST', '/auth/login', undefined, { email: `t1.${tag}@student.edu.uz`, password: reset.data.data.tempPassword })).data.data.token;
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    const d1 = await call('POST', '/diary', T1b, { entryDate: yesterday, taskTitle: 'Reja bo‘yicha ish', description: 'Reja bandiga bog‘langan kundalik', hours: 8, status: 'SUBMITTED', planItemId });
    assert(d1.status === 201 && d1.data.data.planItemId === planItemId, 'Kundalik reja bandiga bog‘lanadi', d1.data);
    const foreignPlan = await prisma.internshipPlanItem.findFirst({ where: { internshipId: { not: internshipId } } });
    const d2 = await call('PATCH', `/diary/${d1.data.data.id}`, T1b, { planItemId: foreignPlan!.id });
    assert(d2.status === 400, 'Boshqa amaliyot reja bandiga bog‘lab bo‘lmaydi');
    const rv = await call('POST', `/diary/${d1.data.data.id}/review`, S, { decision: 'approved', comment: 'Yaxshi' });
    assert(rv.status === 200, 'Rahbar kundalikni tasdiqlaydi');
    const det = await call('GET', `/internships/${internshipId}`, S);
    const item = det.data.data.plan.find((x: any) => x.id === planItemId);
    assert(det.status === 200 && item.doneHours === 8 && item.progress === 100 && det.data.data.canEditPlan === true, 'Reja bajarilishi hisoblanadi (8/8 soat = 100%)', det.data.data.plan);
    assert((await call('GET', `/internships/${internshipId}`, OST)).status === 403, 'Begona talaba amaliyot tafsilotini ko‘ra olmaydi');
    const mine = await call('GET', '/internships/mine', ST);
    assert(mine.status === 200 && mine.data.data?.id === 'clinternship001jasur', '/internships/mine talabaning faol amaliyotini qaytaradi', mine.data);
    const delUsed = await call('DELETE', `/internships/${internshipId}`, A);
    assert(delUsed.status === 400, 'Kundaligi bor amaliyotni o‘chirib bo‘lmaydi');
    const delCompany = await call('DELETE', `/companies/${companyId}`, A);
    assert(delCompany.status === 400, 'Amaliyoti bor korxonani o‘chirib bo‘lmaydi');

    console.log('\n--- 5. Statistika va jurnal ---');
    const an = await call('GET', '/dashboard/analytics', A);
    assert(an.status === 200 && an.data.data.weekly.length === 8 && an.data.data.groups.length >= 3 && an.data.data.totals.completedEvaluations >= 1, 'Admin analitikasi: 8 hafta, guruhlar, yakunlangan baholar', an.data.data?.totals);
    const anS = await call('GET', '/dashboard/analytics', S);
    assert(anS.status === 200 && anS.data.data.diaryStatus.DRAFT === 0 && anS.data.data.diaryStatus.RETURNED === 0, 'Rahbar analitikasida qoralama/qaytarilganlar ko‘rinmaydi', anS.data.data?.diaryStatus);
    const month = new Date().toISOString().slice(0, 7);
    const j = await call('GET', `/journal?month=${month}`, S);
    assert(j.status === 200 && j.data.data.rows.length >= 2 && j.data.data.rows.every((r: any) => r.cells.length === j.data.data.days.length), 'Rahbar guruh jurnalini ko‘radi (talaba × kun matritsa)', j.data.data?.rows?.length);
    assert((await call('GET', '/journal', ST)).status === 403, 'Talaba guruh jurnalini ko‘ra olmaydi');
    const jx = await call('GET', `/journal/excel?month=${month}`, A);
    assert(jx.status === 200 && Buffer.isBuffer(jx.data) && jx.data.subarray(0, 2).toString() === 'PK', 'Jurnal Excel eksporti');

    console.log('\n--- 6. Yakuniy hisobot PDF va QR tekshiruvi ---');
    const pdf = await call('GET', '/reports/final/clinternship006dilnoza/pdf', A);
    assert(pdf.status === 200 && Buffer.isBuffer(pdf.data) && pdf.data.subarray(0, 4).toString() === '%PDF', 'Yakuniy hisobot PDF yaratiladi', pdf.status);
    assert((await call('GET', '/reports/final/clinternship006dilnoza/pdf', ST)).status === 403, 'Begona talaba yakuniy hisobotni ola olmaydi');
    const v = await call('GET', `/public/verify/clinternship006dilnoza?c=${verificationCode('clinternship006dilnoza')}`);
    assert(v.status === 200 && typeof v.data.data.finalScore === 'number' && v.data.data.studentName, 'Ochiq QR tekshiruvi to‘g‘ri kod bilan ishlaydi', v.data);
    const vBad = await call('GET', '/public/verify/clinternship006dilnoza?c=0000000000000000');
    assert(vBad.status === 404, 'Soxta tekshiruv kodi rad etiladi (404)');

    console.log('\n--- 7. Bildirishnomalar va eslatma ---');
    const nS = await call('GET', '/notifications', S);
    assert(nS.status === 200 && nS.data.data.some((x: any) => x.link === '/reviews'), 'Rahbarga “tekshirish kutilmoqda” bildirishnomasi', nS.data.data);
    const nST = await call('GET', '/notifications', ST);
    assert(nST.status === 200 && Array.isArray(nST.data.data), 'Talaba bildirishnomalari qaytadi');
    const remind = await call('POST', '/notifications/remind/clinternship009bekzod', S);
    assert(remind.status === 404, 'Rahbar o‘ziga biriktirilmagan talabani eslata olmaydi');
    const remind2 = await call('POST', '/notifications/remind/clinternship009bekzod', A);
    assert(remind2.status === 400 && /Telegram/.test(remind2.data.error?.message), 'Telegram bog‘lanmagan talabaga eslatma: tushunarli xabar', remind2.data);
    const summary = await call('GET', '/reports/summary');
    assert(summary.status === 401, '/reports/summary endi autentifikatsiyasiz yopiq (401)');
  } finally {
    for (const fn of cleanup) {
      try {
        await fn();
      } catch (e: any) {
        console.warn('cleanup:', e.message);
      }
    }
    server.close();
    await prisma.$disconnect();
  }

  console.log('\n========================================================================');
  console.log(`📊 TEST NATIJALARI: ${passed}/${total} muvaffaqiyatli o'tdi.`);
  console.log('========================================================================');
  if (passed !== total) process.exit(1);
}

main().catch((e) => {
  console.error('Test script execution error:', e);
  process.exit(1);
});
