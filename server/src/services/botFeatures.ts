/**
 * Interactive Telegram bot features (on top of account linking in telegramBot.ts):
 *  - role-based reply-keyboard menu
 *  - /yoz      student writes a diary entry step by step (with photos as evidence)
 *  - 📍 Keldim  student marks attendance with geolocation (distance to company checked)
 *  - /tekshir  supervisor reviews submitted entries with inline buttons (approve / return with comment)
 *  - /holat    personal statistics for every role
 *  - /hisobot  final PDF report (with QR code) sent straight into the chat
 *  - /elon     admin announcement to all / students / supervisors
 * Every action goes through the same business rules as the REST API (services/diaryActions.ts).
 */
import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { Bot, Context, InlineKeyboard, InputFile, Keyboard } from 'grammy';
import { User, UserRole } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { env } from '../config/env';
import { ymd, parseYmd, todayTashkent, countWorkingDays } from '../lib/http';
import { computeFinalScore, gradeLabel } from '../lib/stats';
import { reviewDiaryEntry, createDiaryEntryForStudent, currentInternshipOfStudent, announceSubmitted } from './diaryActions';
import { esc, notifyAttendanceRecorded, dispatchNotification, reviewKeyboard } from './notificationService';
import { missingDiaryDates } from './reminderService';
import { buildFinalReportPdf } from '../routes/finalReport';

// ─── Menu labels ──────────────────────────────────────────────────────────────
export const BTN = {
  write: '📝 Kundalik yozish',
  checkin: '📍 Keldim',
  status: '📊 Holatim',
  report: '📄 Hisobot',
  review: '📋 Tekshirish',
  stats: '📊 Statistika',
  announce: "📢 E'lon",
  help: '❓ Yordam',
} as const;

export function menuFor(role: UserRole | string): Keyboard {
  const kb = new Keyboard();
  if (role === 'STUDENT') {
    kb.text(BTN.write).requestLocation(BTN.checkin).row().text(BTN.status).text(BTN.report).row().text(BTN.help);
  } else if (role === 'COMPANY_SUPERVISOR' || role === 'UNIVERSITY_SUPERVISOR') {
    kb.text(BTN.review).text(BTN.status).row().text(BTN.report).text(BTN.help);
  } else {
    kb.text(BTN.stats).text(BTN.announce).row().text(BTN.review).text(BTN.help);
  }
  return kb.resized().persistent();
}

export function helpTextFor(role: UserRole | string | null): string {
  const common = `\n/status — akkaunt holati\n/unlink — Telegram'ni tizimdan uzish\n/bekor — joriy amalni bekor qilish\n/help — yordam\n\n🌐 ${env.CLIENT_URL}`;
  if (role === 'STUDENT') {
    return (
      `🤖 <b>Talaba uchun imkoniyatlar</b>\n\n` +
      `📝 /yoz — kundalik yozish (bosqichma-bosqich, rasm bilan)\n` +
      `📍 «Keldim» tugmasi — joylashuv orqali davomat\n` +
      `📊 /holat — kunlar, soatlar, davomat, reja bajarilishi\n` +
      `📄 /hisobot — QR-kodli yakuniy hisobot (PDF)\n` +
      `🔔 Kundalik tasdiqlansa yoki qaytarilsa, shu yerga xabar keladi; har kuni 18:00 da yozilmagan kunlar eslatiladi.` +
      common
    );
  }
  if (role === 'COMPANY_SUPERVISOR' || role === 'UNIVERSITY_SUPERVISOR') {
    return (
      `🤖 <b>Rahbar uchun imkoniyatlar</b>\n\n` +
      `📋 /tekshir — tekshirilmagan kundaliklar: ✅ tasdiqlash yoki ↩️ izoh bilan qaytarish\n` +
      `📊 /holat — talabalaringiz bo'yicha qisqa holat\n` +
      `📄 /hisobot — talabaning yakuniy hisoboti (PDF)\n` +
      `🔔 Har yangi kundalik tugmalari bilan keladi; 2 kundan ortiq tekshirilmagan yozuvlar va har juma haftalik xulosa yuboriladi.` +
      common
    );
  }
  if (role === 'ADMIN') {
    return (
      `🤖 <b>Administrator uchun imkoniyatlar</b>\n\n` +
      `📊 /holat — tizim bo'yicha umumiy statistika\n` +
      `📢 /elon — hammaga, talabalarga yoki rahbarlarga e'lon yuborish\n` +
      `📋 /tekshir — tekshiruvni kutayotgan yozuvlar` +
      common
    );
  }
  return (
    `🤖 <b>Amaliyot Kundaligi boti</b>\n\n` +
    `Botdan foydalanish uchun avval akkauntni bog'lang:\n` +
    `1. Saytga kiring: ${env.CLIENT_URL}\n` +
    `2. Profil sahifasida «Telegram'ni bog'lash» tugmasini bosing.\n` +
    `3. Olingan 6 xonali kodni shu botga yuboring.` +
    common
  );
}

// ─── Conversation state (in memory, 30 min TTL) ───────────────────────────────
type DiaryDraft = {
  date?: string;
  planItemId?: string | null;
  planTitle?: string | null;
  title?: string;
  hours?: number;
  description?: string;
  result?: string | null;
  photos: string[];
};

type Session =
  | { kind: 'diary'; step: 'date' | 'plan' | 'title' | 'hours' | 'desc' | 'result' | 'photos' | 'confirm'; d: DiaryDraft; at: number }
  | { kind: 'return'; entryId: string; at: number }
  | { kind: 'announce'; step: 'audience' | 'text' | 'confirm'; audience?: 'ALL' | 'STUDENTS' | 'SUPERVISORS'; text?: string; at: number };

const sessions = new Map<number, Session>();
const TTL = 30 * 60 * 1000;

function getSession(tgId: number): Session | undefined {
  const s = sessions.get(tgId);
  if (s && Date.now() - s.at > TTL) {
    sessions.delete(tgId);
    return undefined;
  }
  return s;
}
function setSession(tgId: number, s: Session) {
  s.at = Date.now();
  sessions.set(tgId, s);
}

/** Exposed for tests. */
export const __sessions = sessions;

// ─── Helpers ──────────────────────────────────────────────────────────────────
async function linkedUser(ctx: Context): Promise<User | null> {
  const id = ctx.from?.id;
  if (!id) return null;
  const acc = await prisma.telegramAccount.findUnique({ where: { telegramUserId: BigInt(id) }, include: { user: true } });
  if (!acc || !acc.user.isActive) return null;
  return acc.user;
}

async function requireUser(ctx: Context, roles?: (UserRole | string)[]): Promise<User | null> {
  const u = await linkedUser(ctx);
  if (!u) {
    await ctx.reply(`🔗 Avval akkauntni bog'lang: saytdagi profil sahifasidan 6 xonali kod oling va shu yerga yuboring.\n${env.CLIENT_URL}`);
    return null;
  }
  if (roles && !roles.includes(u.role)) {
    await ctx.reply('⛔ Bu amal sizning rolingiz uchun mavjud emas.', { reply_markup: menuFor(u.role) });
    return null;
  }
  return u;
}

const html = { parse_mode: 'HTML' as const, link_preview_options: { is_disabled: true } };

/** Great-circle distance in metres. */
export function distanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(a)));
}

/** Current Tashkent time as "HH:MM". */
export function tashkentTime(d = new Date()): string {
  return new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Tashkent', hour: '2-digit', minute: '2-digit', hour12: false }).format(d);
}

/** Students arriving after this time (Asia/Tashkent) are marked LATE. */
export function lateAfter(): string {
  return /^\d{2}:\d{2}$/.test(process.env.CHECKIN_LATE_AFTER || '') ? process.env.CHECKIN_LATE_AFTER! : '09:15';
}

function shiftDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + n);
  return x;
}

function supervisorScope(u: User) {
  if (u.role === 'COMPANY_SUPERVISOR') return { companySupervisorId: u.id };
  if (u.role === 'UNIVERSITY_SUPERVISOR') return { universitySupervisorId: u.id };
  return {};
}

// ─── Attendance by geolocation ───────────────────────────────────────────────
export type CheckinResult =
  | { ok: true; status: 'PRESENT' | 'LATE'; distance: number; time: string; attendanceId: string }
  | { ok: false; message: string };

export async function checkInByLocation(studentId: string, lat: number, lon: number, now = new Date()): Promise<CheckinResult> {
  const it = await currentInternshipOfStudent(studentId);
  if (!it) return { ok: false, message: "Sizga biriktirilgan amaliyot topilmadi." };
  if (it.status !== 'ACTIVE') return { ok: false, message: `Amaliyot faol emas (holati: ${it.status}).` };
  const today = todayTashkent();
  if (today < it.startDate || today > it.endDate) {
    return { ok: false, message: `Bugun amaliyot davriga kirmaydi (${ymd(it.startDate)} — ${ymd(it.endDate)}).` };
  }
  if (it.company.latitude == null || it.company.longitude == null) {
    return {
      ok: false,
      message: `«${it.company.name}» korxonasining joylashuvi tizimga kiritilmagan, shuning uchun davomatni korxona rahbari belgilaydi. Administratorga murojaat qiling.`,
    };
  }
  const distance = distanceMeters(lat, lon, it.company.latitude, it.company.longitude);
  if (distance > it.company.checkinRadius) {
    return {
      ok: false,
      message: `Siz korxonadan taxminan ${distance} m uzoqdasiz (ruxsat etilgan: ${it.company.checkinRadius} m). Korxona hududiga kelganingizda qayta yuboring.`,
    };
  }
  const existing = await prisma.attendance.findUnique({
    where: { internshipId_attendanceDate: { internshipId: it.id, attendanceDate: today } },
  });
  if (existing) {
    const names: Record<string, string> = { PRESENT: 'kelgan', LATE: 'kechikkan', EXCUSED: 'sababli', ABSENT: 'kelmagan' };
    return { ok: false, message: `Bugungi davomat allaqachon belgilangan: ${names[existing.status] ?? existing.status}.` };
  }
  const time = tashkentTime(now);
  const status = time > lateAfter() ? 'LATE' : 'PRESENT';
  const rec = await prisma.attendance.create({
    data: {
      internshipId: it.id,
      attendanceDate: today,
      status,
      hours: 8,
      note: `Telegram geolokatsiya: ${time}, korxonadan ${distance} m`,
    },
  });
  return { ok: true, status, distance, time, attendanceId: rec.id };
}

// ─── Statistics texts ────────────────────────────────────────────────────────
export async function studentStatusText(studentId: string): Promise<string> {
  const it = await prisma.internship.findFirst({
    where: { studentId },
    orderBy: [{ status: 'asc' }, { startDate: 'desc' }],
    include: {
      company: true,
      planItems: true,
      diaryEntries: { select: { status: true, hours: true, planItemId: true } },
      attendances: { select: { status: true } },
      finalEvaluations: { select: { evaluatorRole: true, status: true, totalScore: true } },
    },
  });
  if (!it) return "Sizga hali amaliyot biriktirilmagan.";
  const by = { DRAFT: 0, SUBMITTED: 0, APPROVED: 0, RETURNED: 0 } as Record<string, number>;
  let approvedHours = 0;
  for (const e of it.diaryEntries) {
    by[e.status]++;
    if (e.status === 'APPROVED') approvedHours += Number(e.hours);
  }
  const att = { PRESENT: 0, LATE: 0, EXCUSED: 0, ABSENT: 0 } as Record<string, number>;
  it.attendances.forEach((a) => att[a.status]++);
  const attTotal = att.PRESENT + att.LATE + att.EXCUSED + att.ABSENT;
  const attRate = attTotal ? Math.round(((att.PRESENT + att.LATE) / attTotal) * 100) : null;

  let planned = 0;
  let done = 0;
  for (const p of it.planItems) {
    const ph = Number(p.plannedHours);
    const dh = it.diaryEntries.filter((e) => e.planItemId === p.id && e.status === 'APPROVED').reduce((s, e) => s + Number(e.hours), 0);
    planned += ph;
    done += Math.min(ph, dh);
  }
  const planPct = planned ? Math.round((done / planned) * 100) : null;
  const today = todayTashkent();
  const daysLeft = today <= it.endDate ? countWorkingDays(today, it.endDate) : 0;
  const missing = it.status === 'ACTIVE' ? await missingDiaryDates(it.id, 5) : [];
  const score = computeFinalScore(it.finalEvaluations);
  const bar = (pct: number) => '▓'.repeat(Math.round(pct / 10)) + '░'.repeat(10 - Math.round(pct / 10));

  return (
    `📊 <b>Amaliyot holati</b>\n\n` +
    `🏢 ${esc(it.company.name)}\n` +
    `📅 ${ymd(it.startDate)} — ${ymd(it.endDate)}` +
    (it.status === 'ACTIVE' ? `  (qoldi: ${daysLeft} ish kuni)\n\n` : `  (${it.status})\n\n`) +
    `📝 <b>Kundalik:</b> ✅ ${by.APPROVED} tasdiqlangan · ⏳ ${by.SUBMITTED} tekshiruvda · ↩️ ${by.RETURNED} qaytarilgan · ✏️ ${by.DRAFT} qoralama\n` +
    `⏱ <b>Tasdiqlangan soat:</b> ${approvedHours}\n` +
    `🕒 <b>Davomat:</b> ${attRate === null ? '—' : `${attRate}%`} (kelgan ${att.PRESENT}, kechikkan ${att.LATE}, sababli ${att.EXCUSED}, kelmagan ${att.ABSENT})\n` +
    (planPct === null ? '' : `🗂 <b>Reja bajarilishi:</b> ${bar(planPct)} ${planPct}%\n`) +
    (score === null ? '' : `⭐️ <b>Yakuniy ball:</b> ${score} — ${gradeLabel(score)}\n`) +
    (missing.length ? `\n⚠️ Yozilmagan kunlar: ${missing.join(', ')}\nYozish uchun: /yoz` : `\n👍 So'nggi kunlar uchun kundalik to'liq.`)
  );
}

export async function supervisorStatusText(u: User): Promise<string> {
  const its = await prisma.internship.findMany({
    where: { ...supervisorScope(u), status: 'ACTIVE' },
    include: {
      student: { select: { fullName: true } },
      diaryEntries: { select: { status: true, submittedAt: true } },
      attendances: { select: { status: true } },
    },
    orderBy: { student: { fullName: 'asc' } },
  });
  if (!its.length) return "Sizga biriktirilgan faol amaliyotlar yo'q.";
  let pending = 0;
  const lines: string[] = [];
  for (const it of its) {
    const p = it.diaryEntries.filter((e) => e.status === 'SUBMITTED').length;
    const a = it.diaryEntries.filter((e) => e.status === 'APPROVED').length;
    pending += p;
    const missing = await missingDiaryDates(it.id, 3);
    const attTotal = it.attendances.length;
    const attOk = it.attendances.filter((x) => x.status === 'PRESENT' || x.status === 'LATE').length;
    lines.push(
      `• ${esc(it.student.fullName)} — ✅${a}` +
        (p ? ` ⏳${p}` : '') +
        (attTotal ? ` · 🕒${Math.round((attOk / attTotal) * 100)}%` : '') +
        (missing.length >= 2 ? ` · ⚠️ ${missing.length} kun yozmagan` : ''),
    );
  }
  return (
    `📊 <b>Talabalaringiz holati</b> (${its.length} ta faol amaliyot)\n\n` +
    lines.slice(0, 40).join('\n') +
    (lines.length > 40 ? `\n… yana ${lines.length - 40} ta` : '') +
    `\n\n⏳ Tekshiruvni kutayotgan yozuvlar: <b>${pending}</b>` +
    (pending ? '\nKo\'rib chiqish: /tekshir' : '')
  );
}

export async function adminStatusText(): Promise<string> {
  const today = todayTashkent();
  const [students, supervisors, activeIts, pending, todayEntries, todayAtt, linked] = await Promise.all([
    prisma.user.count({ where: { role: 'STUDENT', isActive: true } }),
    prisma.user.count({ where: { role: { in: ['COMPANY_SUPERVISOR', 'UNIVERSITY_SUPERVISOR'] }, isActive: true } }),
    prisma.internship.count({ where: { status: 'ACTIVE' } }),
    prisma.diaryEntry.count({ where: { status: 'SUBMITTED' } }),
    prisma.diaryEntry.count({ where: { entryDate: today } }),
    prisma.attendance.count({ where: { attendanceDate: today } }),
    prisma.telegramAccount.count(),
  ]);
  return (
    `📊 <b>Tizim statistikasi</b> (${ymd(today)})\n\n` +
    `🎓 Talabalar: ${students}\n` +
    `👔 Rahbarlar: ${supervisors}\n` +
    `📁 Faol amaliyotlar: ${activeIts}\n` +
    `📝 Bugungi kundaliklar: ${todayEntries}\n` +
    `🕒 Bugungi davomat qaydlari: ${todayAtt}\n` +
    `⏳ Tekshiruvni kutayotganlar: ${pending}\n` +
    `🤖 Telegram ulangan foydalanuvchilar: ${linked}`
  );
}

// ─── Review queue ───────────────────────────────────────────────────────────
async function sendReviewQueue(ctx: Context, u: User) {
  const where = { status: 'SUBMITTED' as const, internship: supervisorScope(u) };
  const [total, entries] = await Promise.all([
    prisma.diaryEntry.count({ where }),
    prisma.diaryEntry.findMany({
      where,
      orderBy: [{ submittedAt: 'asc' }, { entryDate: 'asc' }],
      take: 5,
      include: { internship: { include: { student: { select: { fullName: true } } } }, planItem: { select: { title: true } } },
    }),
  ]);
  if (!total) {
    await ctx.reply('🎉 Tekshiruvni kutayotgan kundalik yozuvlari yo\'q.', { reply_markup: menuFor(u.role) });
    return;
  }
  await ctx.reply(`📋 Tekshiruvni kutayotgan yozuvlar: <b>${total}</b> ta${total > 5 ? ' (eng eskilaridan 5 tasi)' : ''}`, html);
  for (const e of entries) {
    const text =
      `👤 <b>${esc(e.internship.student.fullName)}</b>\n` +
      `📅 ${ymd(e.entryDate)}   ⏱ ${Number(e.hours)} soat\n` +
      (e.planItem ? `🗂 ${esc(e.planItem.title)}\n` : '') +
      `📌 <b>${esc(e.taskTitle)}</b>\n\n` +
      esc(e.description.length > 600 ? `${e.description.slice(0, 600)}…` : e.description) +
      (e.result ? `\n\n🎯 ${esc(e.result)}` : '');
    await ctx.reply(text, { ...html, reply_markup: reviewKeyboard(e.id) });
  }
  if (total > 5) await ctx.reply(`Qolganlari uchun ko'rib chiqqach /tekshir ni yana bosing yoki saytda oching: ${env.CLIENT_URL}/reviews`);
}

// ─── Final report ───────────────────────────────────────────────────────────
async function sendReport(ctx: Context, internshipId: string) {
  await ctx.replyWithChatAction('upload_document');
  const pdf = await buildFinalReportPdf(internshipId);
  if (!pdf) {
    await ctx.reply('Amaliyot topilmadi.');
    return;
  }
  await ctx.replyWithDocument(new InputFile(pdf.buffer, pdf.fileName), {
    caption: '📄 Yakuniy hisobot. Hujjatdagi QR-kod orqali uning haqiqiyligini tekshirish mumkin.',
  });
}

// ─── Diary wizard ───────────────────────────────────────────────────────────
const cancelKb = () => new InlineKeyboard().text('❌ Bekor qilish', 'dw:cancel');

async function startDiary(ctx: Context, u: User) {
  const it = await currentInternshipOfStudent(u.id);
  if (!it) {
    await ctx.reply('Sizga biriktirilgan amaliyot topilmadi.');
    return;
  }
  if (it.status !== 'ACTIVE') {
    await ctx.reply(`Kundalik faqat faol amaliyot uchun yoziladi (joriy holat: ${it.status}).`);
    return;
  }
  const today = todayTashkent();
  const options: string[] = [];
  for (let i = 0; i < 7 && options.length < 3; i++) {
    const d = shiftDays(today, -i);
    if (d >= it.startDate && d <= it.endDate) options.push(ymd(d));
  }
  const existing = await prisma.diaryEntry.findMany({
    where: { internshipId: it.id, entryDate: { in: options.map(parseYmd) } },
    select: { entryDate: true },
  });
  const taken = new Set(existing.map((e) => ymd(e.entryDate)));
  const free = options.filter((d) => !taken.has(d));

  setSession(ctx.from!.id, { kind: 'diary', step: 'date', d: { photos: [] }, at: Date.now() });
  const kb = new InlineKeyboard();
  free.forEach((d, i) => kb.text(i === 0 && d === ymd(today) ? `Bugun (${d})` : d, `dw:date:${d}`).row());
  kb.text('❌ Bekor qilish', 'dw:cancel');
  await ctx.reply(
    `📝 <b>Yangi kundalik yozuvi</b>\n🏢 ${esc(it.company.name)}\n\n1/7. Qaysi kun uchun yozasiz? Tugmani tanlang yoki sanani <code>YYYY-MM-DD</code> ko'rinishida yozing.` +
      (taken.size ? `\n\nℹ️ ${[...taken].join(', ')} uchun yozuv allaqachon bor.` : ''),
    { ...html, reply_markup: kb },
  );
}

async function askPlan(ctx: Context, studentId: string) {
  const it = await currentInternshipOfStudent(studentId);
  const items = it?.planItems ?? [];
  const s = getSession(ctx.from!.id);
  if (!s || s.kind !== 'diary') return;
  if (!items.length) {
    s.d.planItemId = null;
    s.step = 'title';
    setSession(ctx.from!.id, s);
    await ctx.reply('3/7. Bugungi ish mavzusini yozing (masalan: «Tarmoq kabelini montaj qilish»):', { reply_markup: cancelKb() });
    return;
  }
  s.step = 'plan';
  setSession(ctx.from!.id, s);
  const kb = new InlineKeyboard();
  items.slice(0, 12).forEach((p, i) => kb.text(`${i + 1}. ${p.title.length > 40 ? `${p.title.slice(0, 40)}…` : p.title}`, `dw:plan:${p.id}`).row());
  kb.text('Rejadan tashqari ish', 'dw:plan:none').row().text('❌ Bekor qilish', 'dw:cancel');
  await ctx.reply('2/7. Bu ish amaliyot rejasining qaysi bandiga tegishli?', { reply_markup: kb });
}

function hoursKb() {
  return new InlineKeyboard().text('2', 'dw:h:2').text('4', 'dw:h:4').text('6', 'dw:h:6').text('8', 'dw:h:8').row().text('❌ Bekor qilish', 'dw:cancel');
}

async function showConfirm(ctx: Context, d: DiaryDraft) {
  const text =
    `🧾 <b>Tekshirib chiqing</b>\n\n` +
    `📅 <b>Sana:</b> ${d.date}\n` +
    (d.planTitle ? `🗂 <b>Reja bandi:</b> ${esc(d.planTitle)}\n` : '') +
    `📌 <b>Mavzu:</b> ${esc(d.title)}\n` +
    `⏱ <b>Soat:</b> ${d.hours}\n\n` +
    `${esc(d.description)}\n` +
    (d.result ? `\n🎯 <b>Natija:</b> ${esc(d.result)}\n` : '') +
    (d.photos.length ? `\n📎 Rasmlar: ${d.photos.length} ta\n` : '');
  const kb = new InlineKeyboard()
    .text('📤 Rahbarga yuborish', 'dw:send')
    .row()
    .text('💾 Qoralama sifatida saqlash', 'dw:draft')
    .row()
    .text('🔁 Qaytadan', 'dw:restart')
    .text('❌ Bekor', 'dw:cancel');
  await ctx.reply(text, { ...html, reply_markup: kb });
}

async function saveTelegramPhotos(bot: Bot, entryId: string, fileIds: string[]): Promise<number> {
  if (!fileIds.length) return 0;
  const dir = path.resolve(process.cwd(), 'uploads', 'diary', entryId);
  fs.mkdirSync(dir, { recursive: true });
  let saved = 0;
  for (const [i, fid] of fileIds.entries()) {
    try {
      const file = await bot.api.getFile(fid);
      if (!file.file_path) continue;
      const resp = await fetch(`https://api.telegram.org/file/bot${env.TELEGRAM_BOT_TOKEN}/${file.file_path}`);
      if (!resp.ok) continue;
      const buf = Buffer.from(await resp.arrayBuffer());
      // JPEG signature check, same rule as web uploads
      if (!(buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff)) continue;
      const stored = path.join(dir, `${randomUUID()}.jpg`);
      fs.writeFileSync(stored, buf);
      await prisma.diaryAttachment.create({
        data: { diaryEntryId: entryId, originalName: `telegram_rasm_${i + 1}.jpg`, storedPath: stored, mimeType: 'image/jpeg', sizeBytes: BigInt(buf.length) },
      });
      saved++;
    } catch (e: any) {
      console.warn('[BotFeatures] photo save failed:', e.message || e);
    }
  }
  return saved;
}

async function finishDiary(ctx: Context, bot: Bot, u: User, status: 'SUBMITTED' | 'DRAFT') {
  const s = getSession(ctx.from!.id);
  if (!s || s.kind !== 'diary') return;
  const d = s.d;
  const r = await createDiaryEntryForStudent(u.id, {
    entryDate: d.date!,
    taskTitle: d.title!,
    description: d.description!,
    result: d.result,
    hours: d.hours!,
    planItemId: d.planItemId,
    status,
  });
  sessions.delete(ctx.from!.id);
  if (!r.ok) {
    await ctx.reply(`❌ ${r.message}`, { reply_markup: menuFor(u.role) });
    return;
  }
  const saved = await saveTelegramPhotos(bot, r.data.id, d.photos);
  if (status === 'SUBMITTED') announceSubmitted(r.data.id);
  await ctx.reply(
    status === 'SUBMITTED'
      ? `✅ Kundalik (${d.date}) rahbarlarga yuborildi${saved ? `, ${saved} ta rasm biriktirildi` : ''}. Tasdiqlansa shu yerga xabar keladi.`
      : `💾 Kundalik (${d.date}) qoralama sifatida saqlandi${saved ? ` (${saved} ta rasm bilan)` : ''}. Saytda tahrirlab, keyin yuborishingiz mumkin.`,
    { reply_markup: menuFor(u.role) },
  );
}

// ─── Announcement ───────────────────────────────────────────────────────────
const AUDIENCE_NAMES = { ALL: 'barcha foydalanuvchilar', STUDENTS: 'talabalar', SUPERVISORS: 'rahbarlar' } as const;

export async function broadcast(audience: 'ALL' | 'STUDENTS' | 'SUPERVISORS', text: string, fromName: string) {
  const roleFilter =
    audience === 'STUDENTS'
      ? { role: 'STUDENT' as const }
      : audience === 'SUPERVISORS'
        ? { role: { in: ['COMPANY_SUPERVISOR', 'UNIVERSITY_SUPERVISOR'] as UserRole[] } }
        : {};
  const users = await prisma.user.findMany({
    where: { isActive: true, telegramAccount: { isNot: null }, ...roleFilter },
    select: { id: true },
  });
  const key = `announce:${Date.now()}`;
  let sent = 0;
  for (const u of users) {
    const r = await dispatchNotification({
      eventType: 'ANNOUNCEMENT',
      entityId: key,
      recipientId: u.id,
      messageText: `📢 <b>E'lon</b>\n\n${esc(text)}\n\n— ${esc(fromName)}`,
    });
    if (r.sent) sent++;
    await new Promise((res) => setTimeout(res, 60)); // stay well under Telegram's 30 msg/s limit
  }
  return { total: users.length, sent };
}

// ─── Registration ───────────────────────────────────────────────────────────
export const BOT_COMMANDS = [
  { command: 'start', description: 'Botni ishga tushirish va menyu' },
  { command: 'yoz', description: 'Kundalik yozish (talaba)' },
  { command: 'holat', description: "Mening holatim / statistika" },
  { command: 'tekshir', description: 'Kundaliklarni tekshirish (rahbar)' },
  { command: 'hisobot', description: 'Yakuniy hisobot PDF' },
  { command: 'elon', description: "E'lon yuborish (administrator)" },
  { command: 'status', description: "Akkaunt bog'lanish holati" },
  { command: 'bekor', description: 'Joriy amalni bekor qilish' },
  { command: 'unlink', description: "Telegram'ni tizimdan uzish" },
  { command: 'help', description: 'Yordam' },
];

export function registerBotFeatures(bot: Bot): void {
  // /bekor — cancel any flow
  bot.command(['bekor', 'cancel'], async (ctx) => {
    sessions.delete(ctx.from!.id);
    const u = await linkedUser(ctx);
    await ctx.reply('Bekor qilindi.', u ? { reply_markup: menuFor(u.role) } : {});
  });

  bot.command('menyu', async (ctx) => {
    const u = await requireUser(ctx);
    if (u) await ctx.reply('Menyu 👇', { reply_markup: menuFor(u.role) });
  });

  // ── Diary wizard
  const startWrite = async (ctx: Context) => {
    const u = await requireUser(ctx, ['STUDENT']);
    if (u) await startDiary(ctx, u);
  };
  bot.command('yoz', startWrite);
  bot.hears(BTN.write, startWrite);

  bot.callbackQuery(/^dw:(.+)$/, async (ctx) => {
    const tgId = ctx.from.id;
    const arg = ctx.match![1];
    const s = getSession(tgId);
    await ctx.answerCallbackQuery().catch(() => {});
    const u = await linkedUser(ctx);
    if (!u || u.role !== 'STUDENT') return;
    if (arg === 'cancel') {
      sessions.delete(tgId);
      await ctx.editMessageReplyMarkup().catch(() => {});
      await ctx.reply('Bekor qilindi.', { reply_markup: menuFor(u.role) });
      return;
    }
    if (arg === 'restart') {
      await ctx.editMessageReplyMarkup().catch(() => {});
      await startDiary(ctx, u);
      return;
    }
    if (!s || s.kind !== 'diary') {
      await ctx.reply("Bu so'rovnoma eskirgan. Qaytadan boshlash: /yoz");
      return;
    }
    await ctx.editMessageReplyMarkup().catch(() => {});
    if (arg.startsWith('date:') && s.step === 'date') {
      s.d.date = arg.slice(5);
      setSession(tgId, s);
      await askPlan(ctx, u.id);
    } else if (arg.startsWith('plan:') && s.step === 'plan') {
      const id = arg.slice(5);
      if (id === 'none') {
        s.d.planItemId = null;
        s.d.planTitle = null;
      } else {
        const p = await prisma.internshipPlanItem.findUnique({ where: { id } });
        s.d.planItemId = p?.id ?? null;
        s.d.planTitle = p?.title ?? null;
      }
      s.step = 'title';
      setSession(tgId, s);
      await ctx.reply('3/7. Bugungi ish mavzusini qisqa yozing:', { reply_markup: cancelKb() });
    } else if (arg.startsWith('h:') && s.step === 'hours') {
      s.d.hours = Number(arg.slice(2));
      s.step = 'desc';
      setSession(tgId, s);
      await ctx.reply("5/7. Nima ish qildingiz? Batafsil yozing (kamida 5 belgi):", { reply_markup: cancelKb() });
    } else if (arg === 'skipresult' && s.step === 'result') {
      s.d.result = null;
      s.step = 'photos';
      setSession(tgId, s);
      await ctx.reply('7/7. Dalil sifatida rasm yuboring (5 tagacha) yoki «Rasmsiz davom etish»ni bosing.', {
        reply_markup: new InlineKeyboard().text('➡️ Rasmsiz davom etish', 'dw:photosdone').row().text('❌ Bekor qilish', 'dw:cancel'),
      });
    } else if (arg === 'photosdone' && s.step === 'photos') {
      s.step = 'confirm';
      setSession(tgId, s);
      await showConfirm(ctx, s.d);
    } else if ((arg === 'send' || arg === 'draft') && s.step === 'confirm') {
      await finishDiary(ctx, bot, u, arg === 'send' ? 'SUBMITTED' : 'DRAFT');
    }
  });

  bot.on('message:photo', async (ctx, next) => {
    const s = getSession(ctx.from.id);
    if (!s || s.kind !== 'diary' || s.step !== 'photos') return next();
    if (s.d.photos.length >= 5) {
      await ctx.reply('Ko\'pi bilan 5 ta rasm biriktiriladi.');
      return;
    }
    const best = ctx.message.photo[ctx.message.photo.length - 1];
    s.d.photos.push(best.file_id);
    setSession(ctx.from.id, s);
    await ctx.reply(`📎 Rasm qabul qilindi (${s.d.photos.length}/5). Yana yuboring yoki tugating.`, {
      reply_markup: new InlineKeyboard().text('✅ Tayyor', 'dw:photosdone'),
    });
  });

  // ── Geolocation attendance
  bot.on('message:location', async (ctx) => {
    const u = await requireUser(ctx, ['STUDENT']);
    if (!u) return;
    if (ctx.message.forward_origin) {
      await ctx.reply("⛔ Uzatilgan (forward) joylashuv qabul qilinmaydi. «📍 Keldim» tugmasini bosing.");
      return;
    }
    const { latitude, longitude } = ctx.message.location;
    const r = await checkInByLocation(u.id, latitude, longitude);
    if (!r.ok) {
      await ctx.reply(`⚠️ ${r.message}`, { reply_markup: menuFor(u.role) });
      return;
    }
    void notifyAttendanceRecorded(r.attendanceId);
    if (r.status === 'LATE') {
      const it = await currentInternshipOfStudent(u.id);
      if (it?.companySupervisorId) {
        void dispatchNotification({
          eventType: 'CHECKIN_LATE',
          entityId: r.attendanceId,
          recipientId: it.companySupervisorId,
          messageText: `🕘 <b>${esc(u.fullName)}</b> bugun ${r.time} da keldi (kechikish, belgilangan vaqt ${lateAfter()}).`,
        });
      }
    }
    await ctx.reply(
      r.status === 'PRESENT'
        ? `✅ Davomat belgilandi: <b>keldi</b>, ${r.time} (korxonadan ${r.distance} m). Omad!`
        : `🕘 Davomat belgilandi: <b>kechikdi</b>, ${r.time} (belgilangan vaqt ${lateAfter()}). Rahbaringizga xabar berildi.`,
      { ...html, reply_markup: menuFor(u.role) },
    );
  });
  bot.command('keldim', async (ctx) => {
    const u = await requireUser(ctx, ['STUDENT']);
    if (u) await ctx.reply('Pastdagi «📍 Keldim» tugmasini bosing — joylashuvingiz yuboriladi.', { reply_markup: menuFor(u.role) });
  });

  // ── Status
  const status = async (ctx: Context) => {
    const u = await requireUser(ctx);
    if (!u) return;
    const text =
      u.role === 'STUDENT' ? await studentStatusText(u.id) : u.role === 'ADMIN' ? await adminStatusText() : await supervisorStatusText(u);
    await ctx.reply(text, { ...html, reply_markup: menuFor(u.role) });
  };
  bot.command('holat', status);
  bot.hears([BTN.status, BTN.stats], status);

  // ── Review
  const review = async (ctx: Context) => {
    const u = await requireUser(ctx, ['COMPANY_SUPERVISOR', 'UNIVERSITY_SUPERVISOR', 'ADMIN']);
    if (u) await sendReviewQueue(ctx, u);
  };
  bot.command('tekshir', review);
  bot.hears(BTN.review, review);
  bot.callbackQuery('tk', async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => {});
    await review(ctx);
  });

  bot.callbackQuery(/^rv:([ar]):(.+)$/, async (ctx) => {
    const [, action, entryId] = ctx.match!;
    const u = await linkedUser(ctx);
    if (!u) {
      await ctx.answerCallbackQuery({ text: "Akkaunt bog'lanmagan", show_alert: true });
      return;
    }
    if (action === 'a') {
      const r = await reviewDiaryEntry(u, entryId, 'approved');
      if (!r.ok) {
        await ctx.answerCallbackQuery({ text: r.message.slice(0, 190), show_alert: true });
        if (r.status === 409 || r.status === 400) await ctx.editMessageReplyMarkup().catch(() => {});
        return;
      }
      await ctx.answerCallbackQuery({ text: '✅ Tasdiqlandi' });
      await ctx.editMessageReplyMarkup({ reply_markup: new InlineKeyboard().text('✅ Tasdiqlandi', 'noop') }).catch(() => {});
      return;
    }
    // return: comment required → ask for it
    const entry = await prisma.diaryEntry.findUnique({ where: { id: entryId }, select: { status: true } });
    if (!entry || entry.status !== 'SUBMITTED') {
      await ctx.answerCallbackQuery({ text: 'Bu yozuv allaqachon ko‘rib chiqilgan', show_alert: true });
      await ctx.editMessageReplyMarkup().catch(() => {});
      return;
    }
    setSession(ctx.from.id, { kind: 'return', entryId, at: Date.now() });
    await ctx.answerCallbackQuery();
    await ctx.reply('↩️ Qaytarish sababini yozing — talaba nimani tuzatishi kerak?', {
      reply_markup: new InlineKeyboard().text('❌ Bekor qilish', 'rvcancel'),
    });
  });
  bot.callbackQuery('rvcancel', async (ctx) => {
    sessions.delete(ctx.from.id);
    await ctx.answerCallbackQuery({ text: 'Bekor qilindi' });
    await ctx.editMessageReplyMarkup().catch(() => {});
  });
  bot.callbackQuery('noop', (ctx) => ctx.answerCallbackQuery());

  // ── Report
  const report = async (ctx: Context) => {
    const u = await requireUser(ctx);
    if (!u) return;
    if (u.role === 'STUDENT') {
      const it = await currentInternshipOfStudent(u.id);
      if (!it) {
        await ctx.reply('Amaliyot topilmadi.');
        return;
      }
      await sendReport(ctx, it.id);
      return;
    }
    const its = await prisma.internship.findMany({
      where: supervisorScope(u),
      orderBy: [{ status: 'asc' }, { student: { fullName: 'asc' } }],
      take: 30,
      include: { student: { select: { fullName: true } } },
    });
    if (!its.length) {
      await ctx.reply("Amaliyotlar yo'q.");
      return;
    }
    const kb = new InlineKeyboard();
    its.forEach((it) => kb.text(`${it.student.fullName}`, `rp:${it.id}`).row());
    await ctx.reply('Qaysi talabaning yakuniy hisoboti kerak?', { reply_markup: kb });
  };
  bot.command('hisobot', report);
  bot.hears(BTN.report, report);
  bot.callbackQuery(/^rp:(.+)$/, async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => {});
    const u = await linkedUser(ctx);
    if (!u) return;
    const it = await prisma.internship.findUnique({ where: { id: ctx.match![1] } });
    const allowed =
      it &&
      (u.role === 'ADMIN' ||
        (u.role === 'COMPANY_SUPERVISOR' && it.companySupervisorId === u.id) ||
        (u.role === 'UNIVERSITY_SUPERVISOR' && it.universitySupervisorId === u.id) ||
        (u.role === 'STUDENT' && it.studentId === u.id));
    if (!allowed) {
      await ctx.reply("⛔ Bu hisobotni ko'rish huquqingiz yo'q.");
      return;
    }
    await sendReport(ctx, it.id);
  });

  // ── Announcement (admin)
  const announce = async (ctx: Context) => {
    const u = await requireUser(ctx, ['ADMIN']);
    if (!u) return;
    setSession(ctx.from!.id, { kind: 'announce', step: 'audience', at: Date.now() });
    await ctx.reply("📢 E'lon kimga yuborilsin?", {
      reply_markup: new InlineKeyboard()
        .text('Hammaga', 'an:ALL')
        .text('Talabalarga', 'an:STUDENTS')
        .text('Rahbarlarga', 'an:SUPERVISORS')
        .row()
        .text('❌ Bekor qilish', 'an:cancel'),
    });
  };
  bot.command('elon', announce);
  bot.hears(BTN.announce, announce);
  bot.callbackQuery(/^an:(.+)$/, async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => {});
    await ctx.editMessageReplyMarkup().catch(() => {});
    const u = await linkedUser(ctx);
    if (!u || u.role !== 'ADMIN') return;
    const arg = ctx.match![1];
    const s = getSession(ctx.from.id);
    if (arg === 'cancel' || !s || s.kind !== 'announce') {
      sessions.delete(ctx.from.id);
      await ctx.reply('Bekor qilindi.', { reply_markup: menuFor(u.role) });
      return;
    }
    if (arg === 'send' && s.step === 'confirm' && s.audience && s.text) {
      sessions.delete(ctx.from.id);
      await ctx.reply('⏳ Yuborilmoqda…');
      const r = await broadcast(s.audience, s.text, u.fullName);
      await ctx.reply(`✅ E'lon yuborildi: ${r.sent} / ${r.total} ta foydalanuvchiga (Telegram ulanganlar).`, { reply_markup: menuFor(u.role) });
      return;
    }
    if (arg === 'ALL' || arg === 'STUDENTS' || arg === 'SUPERVISORS') {
      setSession(ctx.from.id, { kind: 'announce', step: 'text', audience: arg, at: Date.now() });
      await ctx.reply(`E'lon matnini yozing (${AUDIENCE_NAMES[arg]} uchun):`);
    }
  });

  // ── Free text: drives the active flow; otherwise falls through to the linking handler
  bot.on('message:text', async (ctx, next) => {
    const text = ctx.message.text.trim();
    if (text.startsWith('/')) return next();
    const tgId = ctx.from.id;
    const s = getSession(tgId);
    if (text === BTN.help) {
      const u = await linkedUser(ctx);
      await ctx.reply(helpTextFor(u?.role ?? null), { ...html, ...(u ? { reply_markup: menuFor(u.role) } : {}) });
      return;
    }
    if (!s) return next();
    const u = await linkedUser(ctx);
    if (!u) {
      sessions.delete(tgId);
      return next();
    }

    if (s.kind === 'return') {
      if (text.length < 3) {
        await ctx.reply('Izoh juda qisqa — talabaga tushunarli qilib yozing.');
        return;
      }
      sessions.delete(tgId);
      const r = await reviewDiaryEntry(u, s.entryId, 'returned', text);
      await ctx.reply(r.ok ? '↩️ Kundalik izoh bilan talabaga qaytarildi.' : `❌ ${r.message}`, { reply_markup: menuFor(u.role) });
      return;
    }

    if (s.kind === 'announce') {
      if (s.step !== 'text') return;
      if (text.length < 3 || text.length > 3500) {
        await ctx.reply("Matn 3 dan 3500 belgigacha bo'lsin.");
        return;
      }
      s.text = text;
      s.step = 'confirm';
      setSession(tgId, s);
      await ctx.reply(`Ko'rinishi:\n\n📢 <b>E'lon</b>\n\n${esc(text)}\n\n— ${esc(u.fullName)}\n\nKimga: ${AUDIENCE_NAMES[s.audience!]}`, {
        ...html,
        reply_markup: new InlineKeyboard().text('📤 Yuborish', 'an:send').text('❌ Bekor', 'an:cancel'),
      });
      return;
    }

    // diary wizard
    const d = s.d;
    switch (s.step) {
      case 'date': {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
          await ctx.reply('Sanani YYYY-MM-DD ko‘rinishida yozing yoki tugmani tanlang.');
          return;
        }
        d.date = text;
        setSession(tgId, s);
        await askPlan(ctx, u.id);
        return;
      }
      case 'plan':
        await ctx.reply('Iltimos, yuqoridagi tugmalardan birini tanlang.');
        return;
      case 'title':
        if (text.length < 3 || text.length > 200) {
          await ctx.reply("Mavzu 3 dan 200 belgigacha bo'lsin.");
          return;
        }
        d.title = text;
        s.step = 'hours';
        setSession(tgId, s);
        await ctx.reply('4/7. Necha soat ishladingiz? Tanlang yoki raqam yozing (0.5–24):', { reply_markup: hoursKb() });
        return;
      case 'hours': {
        const h = Number(text.replace(',', '.'));
        if (!(h >= 0.5 && h <= 24)) {
          await ctx.reply("Soat 0.5 dan 24 gacha bo'lsin.");
          return;
        }
        d.hours = h;
        s.step = 'desc';
        setSession(tgId, s);
        await ctx.reply("5/7. Nima ish qildingiz? Batafsil yozing (kamida 5 belgi):", { reply_markup: cancelKb() });
        return;
      }
      case 'desc':
        if (text.length < 5) {
          await ctx.reply('Tavsif kamida 5 belgidan iborat bo‘lsin.');
          return;
        }
        d.description = text;
        s.step = 'result';
        setSession(tgId, s);
        await ctx.reply('6/7. Natija / o‘rganganlaringiz (ixtiyoriy):', {
          reply_markup: new InlineKeyboard().text("⏭ O'tkazib yuborish", 'dw:skipresult').row().text('❌ Bekor qilish', 'dw:cancel'),
        });
        return;
      case 'result':
        d.result = text;
        s.step = 'photos';
        setSession(tgId, s);
        await ctx.reply('7/7. Dalil sifatida rasm yuboring (5 tagacha) yoki «Rasmsiz davom etish»ni bosing.', {
          reply_markup: new InlineKeyboard().text('➡️ Rasmsiz davom etish', 'dw:photosdone').row().text('❌ Bekor qilish', 'dw:cancel'),
        });
        return;
      case 'photos':
        await ctx.reply('Rasm yuboring yoki «✅ Tayyor» / «Rasmsiz davom etish» tugmasini bosing.');
        return;
      case 'confirm':
        await ctx.reply('Yuqoridagi tugmalardan birini tanlang: yuborish, qoralama yoki bekor qilish.');
        return;
    }
  });
}

/** Message + button for the supervisor "pending reviews" reminder. */
export function pendingReminderMarkup() {
  return { inline_keyboard: [[{ text: "📋 Ko'rib chiqish", callback_data: 'tk' }]] };
}
