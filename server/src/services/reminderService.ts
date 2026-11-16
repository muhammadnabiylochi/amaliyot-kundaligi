import { prisma } from '../lib/prisma';
import { dispatchNotification, esc } from './notificationService';
import { ymd, todayTashkent } from '../lib/http';

/** Last `n` working days (Mon–Fri) before and including `from`. */
export function lastWorkingDays(from: Date, n: number): Date[] {
  const out: Date[] = [];
  const d = new Date(from);
  while (out.length < n) {
    const wd = d.getUTCDay();
    if (wd !== 0 && wd !== 6) out.push(new Date(d));
    d.setUTCDate(d.getUTCDate() - 1);
  }
  return out;
}

/** Dates (YYYY-MM-DD) in the last `days` working days with no diary entry, within the internship period. */
export async function missingDiaryDates(internshipId: string, days = 3): Promise<string[]> {
  const it = await prisma.internship.findUnique({ where: { id: internshipId } });
  if (!it) return [];
  const today = todayTashkent();
  const candidates = lastWorkingDays(today, days).filter((d) => d >= it.startDate && d <= it.endDate);
  if (!candidates.length) return [];
  const entries = await prisma.diaryEntry.findMany({
    where: { internshipId, entryDate: { in: candidates } },
    select: { entryDate: true },
  });
  const have = new Set(entries.map((e) => ymd(e.entryDate)));
  return candidates.map(ymd).filter((d) => !have.has(d)).sort();
}

function reminderText(fullName: string, missing: string[], fromSupervisor?: string): string {
  const list = missing.map((d) => `• ${d}`).join('\n');
  return (
    `📝 <b>Kundalik eslatmasi</b>\n\n` +
    `Hurmatli ${fullName}, quyidagi ish kunlari uchun amaliyot kundaligi hali yozilmagan:\n${list}\n\n` +
    (fromSupervisor ? `Eslatma yuboruvchi: ${fromSupervisor}\n\n` : '') +
    `Iltimos, bugun kundalikni to'ldirib, rahbaringizga topshiring.`
  );
}

/**
 * Sends reminders to every student of an ACTIVE internship who missed ≥ 2 of the last 3 working days.
 * Idempotent per internship per day via NotificationLog.
 */
export async function runDailyReminders(): Promise<{ checked: number; reminded: number }> {
  const today = todayTashkent();
  const wd = today.getUTCDay();
  if (wd === 0 || wd === 6) return { checked: 0, reminded: 0 };

  const internships = await prisma.internship.findMany({
    where: { status: 'ACTIVE', startDate: { lte: today }, endDate: { gte: today } },
    include: { student: { select: { id: true, fullName: true, isActive: true } } },
  });

  let reminded = 0;
  for (const it of internships) {
    if (!it.student.isActive) continue;
    const missing = await missingDiaryDates(it.id, 3);
    if (missing.length < 2) continue;
    const r = await dispatchNotification({
      eventType: 'DIARY_REMINDER',
      entityId: `${it.id}:${ymd(today)}`,
      recipientId: it.student.id,
      messageText: reminderText(it.student.fullName, missing),
    });
    if (r.sent) reminded++;
  }
  return { checked: internships.length, reminded };
}

/** Manual reminder from a supervisor/admin (at most one per internship per hour). */
export async function sendManualReminder(internshipId: string, senderName: string) {
  const it = await prisma.internship.findUnique({
    where: { id: internshipId },
    include: { student: { select: { id: true, fullName: true } } },
  });
  if (!it) return { ok: false as const, message: 'Amaliyot topilmadi' };
  const missing = await missingDiaryDates(internshipId, 5);
  if (!missing.length) return { ok: false as const, message: "Talabada so'nggi ish kunlari uchun yozilmagan kundalik yo'q" };
  const hourKey = new Date().toISOString().slice(0, 13);
  const r = await dispatchNotification({
    eventType: 'DIARY_REMINDER',
    entityId: `${internshipId}:manual:${hourKey}`,
    recipientId: it.student.id,
    messageText: reminderText(it.student.fullName, missing, senderName),
  });
  if (r.sent) return { ok: true as const, message: 'Eslatma Telegram orqali yuborildi', missing };
  if (r.reason?.includes('No linked')) return { ok: false as const, message: "Talaba Telegram botini bog'lamagan — eslatma yuborilmadi", missing };
  if (r.reason?.includes('idempotent')) return { ok: false as const, message: 'Bu talabaga so‘nggi bir soat ichida eslatma yuborilgan', missing };
  return { ok: false as const, message: `Eslatma yuborilmadi: ${r.reason ?? "noma'lum xato"}`, missing };
}

/** Supervisors who have SUBMITTED entries waiting longer than `olderThanHours`. One reminder per supervisor per day. */
export async function runPendingReviewReminders(olderThanHours = 48): Promise<{ supervisors: number; reminded: number }> {
  const cutoff = new Date(Date.now() - olderThanHours * 3600 * 1000);
  const stale = await prisma.diaryEntry.findMany({
    where: { status: 'SUBMITTED', submittedAt: { lte: cutoff }, internship: { status: 'ACTIVE' } },
    select: { internship: { select: { companySupervisorId: true, universitySupervisorId: true } } },
  });
  const counts = new Map<string, number>();
  for (const e of stale) {
    for (const id of [e.internship.companySupervisorId, e.internship.universitySupervisorId]) {
      if (id) counts.set(id, (counts.get(id) ?? 0) + 1);
    }
  }
  const day = ymd(todayTashkent());
  let reminded = 0;
  for (const [supervisorId, n] of counts) {
    const r = await dispatchNotification({
      eventType: 'REVIEW_REMINDER',
      entityId: `${supervisorId}:${day}`,
      recipientId: supervisorId,
      messageText:
        `⏳ <b>Tekshiruvni kutayotgan kundaliklar</b>\n\n` +
        `${n} ta kundalik yozuvi ${Math.round(olderThanHours / 24)} kundan ortiq vaqtdan beri tasdiqlanmagan. ` +
        `Talabalar o'z vaqtida javob olishi uchun ularni ko'rib chiqing.`,
      replyMarkup: { inline_keyboard: [[{ text: "📋 Ko'rib chiqish", callback_data: 'tk' }]] },
    });
    if (r.sent) reminded++;
  }
  return { supervisors: counts.size, reminded };
}

/** Friday summary for each supervisor: this week's activity per student. */
export async function runWeeklySummaries(): Promise<{ supervisors: number; sent: number }> {
  const today = todayTashkent();
  const monday = new Date(today);
  monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() || 7) - 1));
  const weekKey = ymd(monday);
  const its = await prisma.internship.findMany({
    where: { status: 'ACTIVE' },
    include: {
      student: { select: { fullName: true } },
      diaryEntries: { where: { entryDate: { gte: monday, lte: today } }, select: { status: true, hours: true } },
      attendances: { where: { attendanceDate: { gte: monday, lte: today } }, select: { status: true } },
    },
  });
  const workDays = lastWorkingDays(today, 5).filter((d) => d >= monday).length;
  const bySupervisor = new Map<string, string[]>();
  const pendingBy = new Map<string, number>();
  for (const it of its) {
    const written = it.diaryEntries.filter((e) => e.status !== 'DRAFT').length;
    const approved = it.diaryEntries.filter((e) => e.status === 'APPROVED');
    const pending = it.diaryEntries.filter((e) => e.status === 'SUBMITTED').length;
    const hours = approved.reduce((a, e) => a + Number(e.hours), 0);
    const present = it.attendances.filter((a) => a.status === 'PRESENT' || a.status === 'LATE').length;
    const late = it.attendances.filter((a) => a.status === 'LATE').length;
    const line =
      `• ${esc(it.student.fullName)}: ${written}/${workDays} kun yozilgan, ✅${approved.length} (${hours} soat)` +
      (pending ? `, ⏳${pending}` : '') +
      (it.attendances.length ? ` · 🕒 ${present}/${it.attendances.length}${late ? ` (${late} kechikish)` : ''}` : '') +
      (written < workDays - 1 ? ' ⚠️' : '');
    for (const id of [it.companySupervisorId, it.universitySupervisorId]) {
      if (!id) continue;
      if (!bySupervisor.has(id)) bySupervisor.set(id, []);
      bySupervisor.get(id)!.push(line);
      pendingBy.set(id, (pendingBy.get(id) ?? 0) + pending);
    }
  }
  let sent = 0;
  for (const [supervisorId, lines] of bySupervisor) {
    const pending = pendingBy.get(supervisorId) ?? 0;
    const r = await dispatchNotification({
      eventType: 'WEEKLY_SUMMARY',
      entityId: `${supervisorId}:${weekKey}`,
      recipientId: supervisorId,
      messageText:
        `🗓 <b>Haftalik xulosa</b> (${weekKey} — ${ymd(today)})\n\n` +
        lines.slice(0, 40).join('\n') +
        (lines.length > 40 ? `\n… yana ${lines.length - 40} ta talaba` : '') +
        `\n\n⚠️ — hafta davomida kundalik yetarli yozilmagan` +
        (pending ? `\n⏳ Tekshiruvni kutayotganlar: ${pending} ta` : ''),
      replyMarkup: pending ? { inline_keyboard: [[{ text: "📋 Ko'rib chiqish", callback_data: 'tk' }]] } : undefined,
    });
    if (r.sent) sent++;
  }
  return { supervisors: bySupervisor.size, sent };
}

let timer: NodeJS.Timeout | null = null;

/** Checks every 15 minutes; fires once per day after REMINDER_HOUR (Asia/Tashkent). */
export function startReminderScheduler(): void {
  if (timer || process.env.REMINDERS_ENABLED === 'false') return;
  const hour = Number(process.env.REMINDER_HOUR ?? 18);
  let lastRunDay = '';
  const tick = async () => {
    const nowHour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Tashkent', hour: '2-digit', hour12: false }).format(new Date()));
    const day = ymd(todayTashkent());
    if (nowHour >= hour && lastRunDay !== day) {
      lastRunDay = day;
      try {
        const r = await runDailyReminders();
        console.log(`⏰ [Reminders] ${day}: ${r.checked} ta faol amaliyot tekshirildi, ${r.reminded} ta eslatma yuborildi`);
        const p = await runPendingReviewReminders();
        console.log(`⏰ [Reminders] ${day}: ${p.supervisors} ta rahbarda kechikkan tekshiruv, ${p.reminded} ta eslatma`);
        if (todayTashkent().getUTCDay() === 5) {
          const w = await runWeeklySummaries();
          console.log(`🗓 [Weekly] ${w.sent}/${w.supervisors} ta rahbarga haftalik xulosa yuborildi`);
        }
      } catch (e: any) {
        console.warn('[Reminders] error:', e.message || e);
      }
    }
  };
  timer = setInterval(tick, 15 * 60 * 1000);
  void tick();
}

export function stopReminderScheduler(): void {
  if (timer) clearInterval(timer);
  timer = null;
}
