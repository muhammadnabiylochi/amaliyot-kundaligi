/**
 * Integration tests for the interactive Telegram bot features.
 * The bot runs fully offline: Telegram API calls are intercepted by a transformer
 * and updates are fed with bot.handleUpdate(), so nothing is sent to real users.
 *
 * Covers: geolocation check-in, diary wizard (with photo), supervisor review buttons
 * (approve + return with comment), /holat for every role, /hisobot PDF, /elon,
 * scheduled pending-review reminders and weekly summaries.
 */
process.env.TELEGRAM_BOT_TOKEN = ''; // never talk to the real bot from tests
process.env.CHECKIN_LATE_AFTER = '09:15';

import fs from 'fs';

let passed = 0;
let total = 0;
function assert(cond: boolean, name: string, extra?: unknown) {
  total++;
  if (cond) {
    passed++;
    console.log(`  ✅ PASS: ${name}`);
  } else {
    console.error(`  ❌ FAIL: ${name}${extra !== undefined ? ` → ${JSON.stringify(extra).slice(0, 400)}` : ''}`);
  }
}

async function main() {
  const { prisma } = await import('../src/lib/prisma');
  const { Bot } = await import('grammy');
  const F = await import('../src/services/botFeatures');
  const { reviewDiaryEntry, createDiaryEntryForStudent } = await import('../src/services/diaryActions');
  const { runPendingReviewReminders, runWeeklySummaries } = await import('../src/services/reminderService');
  const { buildFinalReportPdf } = await import('../src/routes/finalReport');
  const { todayTashkent, ymd } = await import('../src/lib/http');

  const startedAt = new Date();
  const tag = `bot${Date.now().toString(36)}`;
  const today = todayTashkent();
  const day = (n: number) => {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() + n);
    return d;
  };

  // ── Fixture ───────────────────────────────────────────────────────────────
  const COMPANY = { lat: 41.311081, lon: 69.240562 };
  const company = await prisma.company.create({
    data: { name: `Test korxona ${tag}`, address: 'Toshkent', latitude: COMPANY.lat, longitude: COMPANY.lon, checkinRadius: 300 },
  });
  const noGeoCompany = await prisma.company.create({ data: { name: `Geosiz korxona ${tag}`, address: 'Toshkent' } });
  const mk = (role: any, name: string) =>
    prisma.user.create({ data: { fullName: `${name} ${tag}`, email: `${name.toLowerCase()}.${tag}@test.uz`, passwordHash: 'x', role } });
  const student = await mk('STUDENT', 'Talaba');
  const student2 = await mk('STUDENT', 'Talaba2');
  const compSup = await mk('COMPANY_SUPERVISOR', 'Korxonarahbar');
  const uniSup = await mk('UNIVERSITY_SUPERVISOR', 'Muassasarahbar');
  const otherSup = await mk('COMPANY_SUPERVISOR', 'Begona');
  const admin = await mk('ADMIN', 'Admin');
  const it = await prisma.internship.create({
    data: {
      studentId: student.id,
      companyId: company.id,
      companySupervisorId: compSup.id,
      universitySupervisorId: uniSup.id,
      startDate: day(-20),
      endDate: day(20),
      status: 'ACTIVE',
      planItems: { create: [{ title: 'Xavfsizlik texnikasi', plannedHours: 8, orderIndex: 0 }, { title: 'Montaj ishlari', plannedHours: 16, orderIndex: 1 }] },
    },
    include: { planItems: { orderBy: { orderIndex: 'asc' } } },
  });
  const it2 = await prisma.internship.create({
    data: { studentId: student2.id, companyId: noGeoCompany.id, companySupervisorId: compSup.id, startDate: day(-5), endDate: day(5), status: 'ACTIVE' },
  });
  const TG = { student: 9_100_000_001, sup: 9_100_000_002, uni: 9_100_000_003, admin: 9_100_000_004, other: 9_100_000_005 };
  await prisma.telegramAccount.createMany({
    data: [
      { userId: student.id, telegramUserId: BigInt(TG.student) },
      { userId: compSup.id, telegramUserId: BigInt(TG.sup) },
      { userId: uniSup.id, telegramUserId: BigInt(TG.uni) },
      { userId: admin.id, telegramUserId: BigInt(TG.admin) },
      { userId: otherSup.id, telegramUserId: BigInt(TG.other) },
    ],
  });

  try {
    // ── 1. Pure helpers ─────────────────────────────────────────────────────
    console.log('\n1) Yordamchi funksiyalar');
    const d1 = F.distanceMeters(41.311081, 69.240562, 41.311081, 69.240562);
    const d2 = F.distanceMeters(41.311081, 69.240562, 41.320081, 69.240562); // ~1 km north
    assert(d1 === 0, "Bir nuqta orasidagi masofa 0 m");
    assert(d2 > 950 && d2 < 1050, `~1 km masofa to'g'ri hisoblanadi (${d2} m)`);
    assert(F.menuFor('STUDENT').keyboard.flat().some((b: any) => b.request_location), 'Talaba menyusida «📍 Keldim» joylashuv so‘raydi');
    assert(F.menuFor('COMPANY_SUPERVISOR').keyboard.flat().some((b: any) => b.text === F.BTN.review), 'Rahbar menyusida «Tekshirish» bor');
    assert(F.menuFor('ADMIN').keyboard.flat().some((b: any) => b.text === F.BTN.announce), "Admin menyusida «E'lon» bor");
    assert(F.helpTextFor('STUDENT').includes('/yoz') && F.helpTextFor('COMPANY_SUPERVISOR').includes('/tekshir'), 'Yordam matni rolga mos');

    // ── 2. Geolocation check-in ─────────────────────────────────────────────
    console.log('\n2) Geolokatsiya orqali davomat');
    const far = await F.checkInByLocation(student.id, COMPANY.lat + 0.01, COMPANY.lon);
    assert(!far.ok && /uzoqdasiz/.test((far as any).message), 'Korxonadan 1 km uzoqda — rad etiladi', far);
    const noGeo = await F.checkInByLocation(student2.id, COMPANY.lat, COMPANY.lon);
    assert(!noGeo.ok && /joylashuvi tizimga kiritilmagan/.test((noGeo as any).message), 'Korxona koordinatasi yo‘q — rad etiladi', noGeo);
    // 08:40 Tashkent = 03:40 UTC
    const at0840 = new Date(`${ymd(today)}T03:40:00Z`);
    const ok1 = await F.checkInByLocation(student.id, COMPANY.lat + 0.001, COMPANY.lon, at0840);
    assert(ok1.ok && ok1.status === 'PRESENT' && ok1.time === '08:40', '08:40 da ~110 m masofadan — «keldi»', ok1);
    const dup = await F.checkInByLocation(student.id, COMPANY.lat, COMPANY.lon, at0840);
    assert(!dup.ok && /allaqachon/.test((dup as any).message), 'Bir kunda ikkinchi marta belgilab bo‘lmaydi', dup);
    await prisma.attendance.deleteMany({ where: { internshipId: it.id } });
    const late = await F.checkInByLocation(student.id, COMPANY.lat, COMPANY.lon, new Date(`${ymd(today)}T04:40:00Z`));
    assert(late.ok && late.status === 'LATE', '09:40 da kelgan talaba — «kechikdi»', late);
    const att = await prisma.attendance.findFirst({ where: { internshipId: it.id } });
    assert(Boolean(att?.note?.includes('geolokatsiya')), 'Davomat izohida geolokatsiya qayd etiladi', att?.note);
    await prisma.attendance.deleteMany({ where: { internshipId: it.id } });

    // ── 3. Shared diary actions ─────────────────────────────────────────────
    console.log('\n3) Kundalik amallari (sayt va bot uchun umumiy)');
    const future = await createDiaryEntryForStudent(student.id, { entryDate: ymd(day(2)), taskTitle: 'Kelajak', description: 'Kelajakdagi kun', hours: 8, status: 'SUBMITTED' });
    assert(!future.ok && future.status === 400, 'Kelajakdagi sanaga yozib bo‘lmaydi', future);
    const badPlan = await createDiaryEntryForStudent(student.id, { entryDate: ymd(day(-3)), taskTitle: 'Rejasi xato', description: 'Begona reja bandi', hours: 8, planItemId: 'not-a-plan', status: 'SUBMITTED' });
    assert(!badPlan.ok && /reja bandi/.test((badPlan as any).message), 'Begona reja bandi rad etiladi', badPlan);
    const e1 = await createDiaryEntryForStudent(student.id, { entryDate: ymd(day(-3)), taskTitle: 'Kabel montaji', description: 'Tarmoq kabelini tortdim', hours: 6, planItemId: it.planItems[1].id, status: 'SUBMITTED' });
    assert(e1.ok, 'To‘g‘ri yozuv yaratiladi', e1);
    const dupEntry = await createDiaryEntryForStudent(student.id, { entryDate: ymd(day(-3)), taskTitle: 'Takror', description: 'Shu kunga yana', hours: 6, status: 'SUBMITTED' });
    assert(!dupEntry.ok && /allaqachon/.test((dupEntry as any).message), 'Bir kunga ikkinchi yozuv rad etiladi', dupEntry);
    const e1id = (e1 as any).data.id;
    const byStudent = await reviewDiaryEntry(student, e1id, 'approved');
    assert(!byStudent.ok && byStudent.status === 403, 'Talaba o‘z yozuvini tasdiqlay olmaydi', byStudent);
    const byOther = await reviewDiaryEntry(otherSup, e1id, 'approved');
    assert(!byOther.ok && byOther.status === 403, 'Biriktirilmagan rahbar tasdiqlay olmaydi', byOther);
    const noComment = await reviewDiaryEntry(compSup, e1id, 'returned', '  ');
    assert(!noComment.ok && noComment.status === 400, 'Izohsiz qaytarib bo‘lmaydi', noComment);

    // ── 4. Simulated bot conversation ───────────────────────────────────────
    console.log('\n4) Bot dialogi (simulyatsiya)');
    const calls: { method: string; payload: any }[] = [];
    const bot = new Bot('123456:TEST_TOKEN_OFFLINE', {
      botInfo: { id: 1, is_bot: true, first_name: 'Test', username: 'test_bot', can_join_groups: false, can_read_all_group_messages: false, supports_inline_queries: false, can_connect_to_business: false, has_main_web_app: false } as any,
    });
    let msgId = 1000;
    bot.api.config.use(async (_prev, method, payload: any) => {
      calls.push({ method, payload });
      const chat = { id: payload?.chat_id ?? 1, type: 'private' };
      let result: any = true;
      if (method.startsWith('send')) result = { message_id: ++msgId, date: Math.floor(Date.now() / 1000), chat, text: payload?.text };
      if (method === 'getFile') result = { file_id: payload.file_id, file_unique_id: 'u', file_path: 'photos/test.jpg' };
      return { ok: true, result } as any;
    });
    F.registerBotFeatures(bot);

    // fake download of the Telegram photo: a tiny valid JPEG header
    const realFetch = globalThis.fetch;
    globalThis.fetch = (async (url: any, init?: any) => {
      if (String(url).includes('api.telegram.org/file/')) {
        return new Response(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 16, 74, 70, 73, 70, 0, 1, 0xff, 0xd9]));
      }
      return realFetch(url, init);
    }) as any;

    let upd = 1;
    const from = (id: number) => ({ id, is_bot: false, first_name: 'T' });
    const chat = (id: number) => ({ id, type: 'private' as const, first_name: 'T' });
    const text = (uid: number, t: string) => {
      const entities = t.startsWith('/') ? [{ type: 'bot_command', offset: 0, length: t.split(' ')[0].length }] : undefined;
      return bot.handleUpdate({ update_id: upd++, message: { message_id: upd, date: Math.floor(Date.now() / 1000), chat: chat(uid), from: from(uid), text: t, entities } } as any);
    };
    const press = (uid: number, data: string) =>
      bot.handleUpdate({
        update_id: upd++,
        callback_query: { id: String(upd), from: from(uid), chat_instance: 'c', data, message: { message_id: 5, date: 0, chat: chat(uid), text: 'x' } },
      } as any);
    const photo = (uid: number) =>
      bot.handleUpdate({
        update_id: upd++,
        message: { message_id: upd, date: Math.floor(Date.now() / 1000), chat: chat(uid), from: from(uid), photo: [{ file_id: 'small', file_unique_id: 's', width: 90, height: 90 }, { file_id: 'big', file_unique_id: 'b', width: 800, height: 800 }] },
      } as any);
    const location = (uid: number, lat: number, lon: number, forwarded = false) =>
      bot.handleUpdate({
        update_id: upd++,
        message: {
          message_id: upd,
          date: Math.floor(Date.now() / 1000),
          chat: chat(uid),
          from: from(uid),
          location: { latitude: lat, longitude: lon },
          ...(forwarded ? { forward_origin: { type: 'user', date: 0, sender_user: from(1) } } : {}),
        },
      } as any);
    const lastText = () => [...calls].reverse().find((c) => c.method === 'sendMessage')?.payload.text as string;
    const lastMarkup = () => [...calls].reverse().find((c) => c.method === 'sendMessage')?.payload.reply_markup;

    // unlinked user
    await text(9_100_000_999, '/yoz');
    assert(/Avval akkauntni bog'lang/.test(lastText()), "Bog'lanmagan foydalanuvchiga yo'riqnoma beriladi", lastText());

    // supervisor cannot write diary
    await text(TG.sup, '/yoz');
    assert(/rolingiz uchun mavjud emas/.test(lastText()), 'Rahbar /yoz dan foydalana olmaydi', lastText());

    // student wizard: date → plan → title → hours → desc → result → photo → send
    await text(TG.student, F.BTN.write);
    assert(/Qaysi kun uchun yozasiz/.test(lastText()), 'Menyu tugmasi orqali kundalik so‘rovi boshlanadi', lastText());
    const dateButtons = lastMarkup().inline_keyboard.flat().map((b: any) => b.callback_data);
    assert(dateButtons.includes(`dw:date:${ymd(today)}`), 'Bugungi sana tugmasi taklif qilinadi', dateButtons);
    assert(!dateButtons.includes(`dw:date:${ymd(day(-3))}`), 'Yozuvi bor kun taklif qilinmaydi', dateButtons);
    await press(TG.student, `dw:date:${ymd(today)}`);
    assert(/rejasining qaysi bandiga/.test(lastText()), 'Reja bandi so‘raladi', lastText());
    await press(TG.student, `dw:plan:${it.planItems[0].id}`);
    await text(TG.student, 'ab');
    assert(/3 dan 200 belgigacha/.test(lastText()), 'Juda qisqa mavzu rad etiladi');
    await text(TG.student, 'Mehnat muhofazasi bo‘yicha yo‘riqnoma');
    await text(TG.student, '30');
    assert(/0.5 dan 24 gacha/.test(lastText()), "Noto'g'ri soat rad etiladi");
    await press(TG.student, 'dw:h:8');
    await text(TG.student, 'Xavfsizlik texnikasi bo‘yicha kirish yo‘riqnomasidan o‘tdim, ish o‘rni bilan tanishdim.');
    await text(TG.student, 'Xavfsizlik qoidalarini o‘rgandim <muhim>');
    await photo(TG.student);
    assert(/Rasm qabul qilindi \(1\/5\)/.test(lastText()), 'Rasm qabul qilinadi', lastText());
    await press(TG.student, 'dw:photosdone');
    assert(/Tekshirib chiqing/.test(lastText()) && lastText().includes('&lt;muhim&gt;'), 'Tasdiq oynasi chiqadi, HTML belgilar xavfsiz', lastText());
    await press(TG.student, 'dw:send');
    assert(/rahbarlarga yuborildi, 1 ta rasm biriktirildi/.test(lastText()), 'Kundalik rasm bilan rahbarga yuboriladi', lastText());
    const created = await prisma.diaryEntry.findUnique({
      where: { internshipId_entryDate: { internshipId: it.id, entryDate: today } },
      include: { attachments: true },
    });
    assert(created?.status === 'SUBMITTED' && created.planItemId === it.planItems[0].id && Number(created.hours) === 8, 'Bazada SUBMITTED yozuv reja bandiga bog‘langan', created);
    assert(created?.attachments.length === 1 && fs.existsSync(created.attachments[0].storedPath), 'Rasm diskka saqlanib, ilova sifatida biriktirilgan');

    // cancel flow
    await text(TG.student, '/yoz');
    await text(TG.student, '/bekor');
    assert(/Bekor qilindi/.test(lastText()) && !F.__sessions.has(TG.student), '/bekor so‘rovni to‘xtatadi');

    // supervisor review queue + approve via button
    await text(TG.sup, '/tekshir');
    const queueMsgs = calls.filter((c) => c.method === 'sendMessage' && c.payload.chat_id === TG.sup && c.payload.reply_markup?.inline_keyboard?.[0]?.[0]?.callback_data?.startsWith('rv:a:'));
    assert(queueMsgs.length >= 2, `Rahbarga tekshiruv navbati tugmalar bilan chiqadi (${queueMsgs.length} ta)`);
    await press(TG.sup, `rv:a:${created!.id}`);
    const answered = [...calls].reverse().find((c) => c.method === 'answerCallbackQuery');
    assert(answered?.payload.text === '✅ Tasdiqlandi', 'Tugma orqali tasdiqlandi', answered?.payload);
    assert((await prisma.diaryEntry.findUnique({ where: { id: created!.id } }))?.status === 'APPROVED', 'Bazada APPROVED holat');
    await press(TG.uni, `rv:a:${created!.id}`);
    const again = [...calls].reverse().find((c) => c.method === 'answerCallbackQuery');
    assert(again?.payload.show_alert === true, 'Ikkinchi rahbar allaqachon ko‘rilgan yozuvni qayta tasdiqlay olmaydi', again?.payload);
    await press(TG.other, `rv:a:${e1id}`);
    const foreign = [...calls].reverse().find((c) => c.method === 'answerCallbackQuery');
    assert(/biriktirilmagan/.test(foreign?.payload.text || ''), 'Begona rahbar tugmani bosa olmaydi', foreign?.payload);

    // return with comment
    await press(TG.uni, `rv:r:${e1id}`);
    assert(/Qaytarish sababini yozing/.test(lastText()), 'Qaytarishda izoh so‘raladi');
    await text(TG.uni, 'Kabel turini va ishlatilgan asboblarni yozing');
    assert(/talabaga qaytarildi/.test(lastText()), 'Izoh bilan qaytarildi', lastText());
    const ret = await prisma.diaryEntry.findUnique({ where: { id: e1id }, include: { reviews: true } });
    assert(ret?.status === 'RETURNED' && ret.reviews.some((r) => r.comment === 'Kabel turini va ishlatilgan asboblarni yozing' && r.reviewerId === uniSup.id), 'Bazada RETURNED va rahbar izohi saqlangan');

    // location via bot
    await location(TG.student, COMPANY.lat, COMPANY.lon, true);
    assert(/forward/.test(lastText()), 'Uzatilgan (forward) joylashuv qabul qilinmaydi');
    await location(TG.student, COMPANY.lat + 0.0005, COMPANY.lon);
    assert(/Davomat belgilandi/.test(lastText()), 'Bot orqali davomat belgilandi', lastText());
    await location(TG.sup, COMPANY.lat, COMPANY.lon);
    assert(/rolingiz uchun mavjud emas/.test(lastText()), 'Rahbar joylashuv yuborsa davomat belgilanmaydi');

    // status for each role
    await text(TG.student, F.BTN.status);
    const st = lastText();
    assert(/Amaliyot holati/.test(st) && /✅ 1 tasdiqlangan/.test(st) && /Reja bajarilishi/.test(st) && /Davomat:<\/b> 100%/.test(st), 'Talaba holati: tasdiqlangan, reja %, davomat', st);
    await text(TG.sup, '/holat');
    assert(/Talabalaringiz holati/.test(lastText()) && lastText().includes(`Talaba ${tag}`), 'Rahbar holati talabalar ro‘yxati bilan', lastText());
    await text(TG.admin, F.BTN.stats);
    assert(/Tizim statistikasi/.test(lastText()) && /Telegram ulangan/.test(lastText()), 'Admin statistikasi', lastText());

    // report
    await text(TG.student, '/hisobot');
    const doc = [...calls].reverse().find((c) => c.method === 'sendDocument');
    assert(Boolean(doc), 'Talabaga yakuniy hisobot PDF yuborildi');
    await text(TG.other, '/hisobot');
    assert(/Amaliyotlar yo'q/.test(lastText()), 'Begona rahbarga boshqa talabalar ro‘yxati ko‘rsatilmaydi');
    const before = calls.filter((c) => c.method === 'sendDocument').length;
    await press(TG.other, `rp:${it.id}`);
    assert(/huquqingiz yo'q/.test(lastText()) && calls.filter((c) => c.method === 'sendDocument').length === before, 'Begona rahbar hisobotni yuklab ololmaydi (IDOR)');
    const pdf = await buildFinalReportPdf(it.id);
    assert(Boolean(pdf && pdf.buffer.subarray(0, 4).toString() === '%PDF' && pdf.buffer.length > 5000), `PDF xotirada yaratiladi (${pdf?.buffer.length} bayt)`);

    // announcement
    await text(TG.student, '/elon');
    assert(/rolingiz uchun mavjud emas/.test(lastText()), "Talaba e'lon yubora olmaydi");
    await text(TG.admin, F.BTN.announce);
    await press(TG.admin, 'an:STUDENTS');
    await text(TG.admin, 'Ertaga amaliyot hisobotlari topshiriladi');
    assert(/Ko'rinishi/.test(lastText()), "E'lon ko'rinishi oldindan ko'rsatiladi");
    await press(TG.admin, 'an:send');
    assert(/E'lon yuborildi: \d+ \/ \d+/.test(lastText()), "E'lon yuborish yakunlandi", lastText());

    globalThis.fetch = realFetch;

    // ── 5. Scheduled jobs ───────────────────────────────────────────────────
    console.log('\n5) Rejalashtirilgan xabarlar');
    const old = await createDiaryEntryForStudent(student.id, { entryDate: ymd(day(-6)), taskTitle: 'Eski yozuv', description: 'Uch kun oldin topshirilgan', hours: 4, status: 'SUBMITTED' });
    await prisma.diaryEntry.update({ where: { id: (old as any).data.id }, data: { submittedAt: new Date(Date.now() - 3 * 86400_000) } });
    const pend = await runPendingReviewReminders();
    assert(pend.supervisors >= 2, `48 soatdan eski yozuvi bor rahbarlar topildi (${pend.supervisors})`, pend);
    const log = await prisma.notificationLog.findFirst({ where: { eventType: 'REVIEW_REMINDER', recipientId: compSup.id } });
    assert(Boolean(log), 'Rahbarga eslatma jurnalga yozildi');
    const weekly = await runWeeklySummaries();
    assert(weekly.supervisors >= 2, `Haftalik xulosa rahbarlar uchun tuzildi (${weekly.supervisors})`, weekly);
    const wlog = await prisma.notificationLog.findFirst({ where: { eventType: 'WEEKLY_SUMMARY', recipientId: compSup.id } });
    assert(Boolean(wlog), 'Haftalik xulosa jurnalga yozildi');
  } finally {
    // ── Cleanup ─────────────────────────────────────────────────────────────
    const files = await prisma.diaryAttachment.findMany({ where: { diaryEntry: { internshipId: { in: [it.id, it2.id] } } } });
    files.forEach((f) => {
      try {
        fs.rmSync(f.storedPath, { force: true });
      } catch {}
    });
    const userIds = [student.id, student2.id, compSup.id, uniSup.id, otherSup.id, admin.id];
    await prisma.internship.deleteMany({ where: { id: { in: [it.id, it2.id] } } });
    await prisma.notificationLog.deleteMany({ where: { recipientId: { in: userIds } } });
    // scheduled jobs also touched demo supervisors — remove only what this run created
    await prisma.notificationLog.deleteMany({
      where: { eventType: { in: ['REVIEW_REMINDER', 'WEEKLY_SUMMARY', 'ANNOUNCEMENT'] }, createdAt: { gte: startedAt } },
    });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.company.deleteMany({ where: { id: { in: [company.id, noGeoCompany.id] } } });
    await prisma.$disconnect();
  }

  console.log(`\nNatija: ${passed}/${total} o'tdi`);
  process.exit(passed === total ? 0 : 1);
}

main().catch((e) => {
  console.error('❌ FAIL: test crashed', e);
  process.exit(1);
});
