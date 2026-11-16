import { prisma } from '../lib/prisma';
import { env } from '../config/env';
import { sendTelegramMessage } from './telegramBot';

export type NotificationEventType =
  | 'DIARY_SUBMITTED'
  | 'DIARY_RETURNED'
  | 'DIARY_APPROVED'
  | 'ATTENDANCE_RECORDED'
  | 'EVALUATION_COMPLETED'
  | 'DIARY_REMINDER'
  | 'REVIEW_REMINDER'
  | 'WEEKLY_SUMMARY'
  | 'CHECKIN_LATE'
  | 'ANNOUNCEMENT';

/** Escapes user-provided text for Telegram HTML parse mode. */
export function esc(s: string | null | undefined): string {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Inline keyboard shown to supervisors under a submitted diary entry. */
export function reviewKeyboard(entryId: string) {
  return {
    inline_keyboard: [
      [
        { text: '✅ Tasdiqlash', callback_data: `rv:a:${entryId}` },
        { text: '↩️ Qaytarish', callback_data: `rv:r:${entryId}` },
      ],
    ],
  };
}

interface SendNotificationParams {
  eventType: NotificationEventType;
  entityId: string;
  recipientId: string;
  messageText: string;
  replyMarkup?: any;
}

/**
 * Dispatch a notification to a specific user with idempotency check
 */
export async function dispatchNotification({
  eventType,
  entityId,
  recipientId,
  messageText,
  replyMarkup,
}: SendNotificationParams): Promise<{ sent: boolean; reason?: string }> {
  try {
    // 1. Idempotency Check: if already successfully sent, skip
    const existingLog = await prisma.notificationLog.findUnique({
      where: {
        eventType_entityId_recipientId: {
          eventType,
          entityId,
          recipientId,
        },
      },
    });

    if (existingLog && existingLog.status === 'SENT') {
      return { sent: false, reason: 'Already sent (idempotent)' };
    }

    // 2. Check if recipient has a linked Telegram account
    const tgAccount = await prisma.telegramAccount.findUnique({
      where: { userId: recipientId },
    });

    if (!tgAccount) {
      await prisma.notificationLog.upsert({
        where: {
          eventType_entityId_recipientId: {
            eventType,
            entityId,
            recipientId,
          },
        },
        update: {
          status: 'SKIPPED_NO_TG',
          errorMessage: 'User has no linked Telegram account',
        },
        create: {
          eventType,
          entityId,
          recipientId,
          status: 'SKIPPED_NO_TG',
          errorMessage: 'User has no linked Telegram account',
        },
      });
      return { sent: false, reason: 'No linked Telegram account' };
    }

    // 3. Send message via Telegram bot
    const sendResult = await sendTelegramMessage(tgAccount.telegramUserId, messageText, replyMarkup);

    // 4. Record audit log
    await prisma.notificationLog.upsert({
      where: {
        eventType_entityId_recipientId: {
          eventType,
          entityId,
          recipientId,
        },
      },
      update: {
        status: sendResult.success ? 'SENT' : 'FAILED',
        telegramUserId: tgAccount.telegramUserId,
        errorMessage: sendResult.error || null,
      },
      create: {
        eventType,
        entityId,
        recipientId,
        telegramUserId: tgAccount.telegramUserId,
        status: sendResult.success ? 'SENT' : 'FAILED',
        errorMessage: sendResult.error || null,
      },
    });

    return { sent: sendResult.success, reason: sendResult.error };
  } catch (err: any) {
    console.warn(`[NotificationService] Error dispatching notification ${eventType}:`, err.message || err);
    return { sent: false, reason: err.message };
  }
}

/**
 * A. Notify when a student submits a diary entry
 */
export async function notifyDiarySubmitted(diaryEntryId: string): Promise<void> {
  try {
    const entry = await prisma.diaryEntry.findUnique({
      where: { id: diaryEntryId },
      include: {
        planItem: { select: { title: true } },
        _count: { select: { attachments: true } },
        internship: {
          include: {
            student: true,
            company: true,
            companySupervisor: true,
            universitySupervisor: true,
          },
        },
      },
    });

    if (!entry) return;

    const student = entry.internship.student;
    const dateStr = entry.entryDate.toISOString().split('T')[0];
    const hours = Number(entry.hours);
    // A returned entry can be submitted again — each submission is a separate event.
    const eventKey = `${entry.id}:${entry.submittedAt ? entry.submittedAt.getTime() : 0}`;
    const excerpt = entry.description.length > 350 ? `${entry.description.slice(0, 350)}…` : entry.description;

    // 1. Notification to Student
    const studentMsg =
      `📋 <b>Kundalik muvaffaqiyatli topshirildi!</b>\n\n` +
      `📅 <b>Sana:</b> ${dateStr}\n` +
      `📌 <b>Vazifa:</b> ${esc(entry.taskTitle)}\n` +
      `⏱ <b>Ishlangan vaqt:</b> ${hours} soat\n` +
      `🏢 <b>Korxona:</b> ${esc(entry.internship.company.name)}\n\n` +
      `Kundalik rahbarlar ko'rib chiqishi uchun yuborildi.\n` +
      `🔗 <a href="${env.CLIENT_URL}/diary">Kundalikni ko'rish</a>`;

    await dispatchNotification({
      eventType: 'DIARY_SUBMITTED',
      entityId: eventKey,
      recipientId: student.id,
      messageText: studentMsg,
    });

    // 2. Supervisors get the full entry and approve/return buttons right in Telegram
    const supervisorMsg =
      `🔔 <b>Yangi kundalik yozuvi topshirildi</b>\n\n` +
      `👤 <b>Talaba:</b> ${esc(student.fullName)}\n` +
      `🏢 <b>Korxona:</b> ${esc(entry.internship.company.name)}\n` +
      `📅 <b>Sana:</b> ${dateStr}   ⏱ ${hours} soat\n` +
      (entry.planItem ? `🗂 <b>Reja bandi:</b> ${esc(entry.planItem.title)}\n` : '') +
      `📌 <b>Mavzu:</b> ${esc(entry.taskTitle)}\n\n` +
      `${esc(excerpt)}\n` +
      (entry.result ? `\n🎯 <b>Natija:</b> ${esc(entry.result)}\n` : '') +
      (entry._count.attachments ? `📎 Ilova fayllar: ${entry._count.attachments} ta\n` : '') +
      `\nQuyidagi tugmalar orqali shu yerning o'zida tasdiqlang yoki izoh bilan qaytaring.\n` +
      `🔗 <a href="${env.CLIENT_URL}/reviews">Saytda ochish</a>`;

    for (const supervisorId of [entry.internship.companySupervisorId, entry.internship.universitySupervisorId]) {
      if (!supervisorId) continue;
      await dispatchNotification({
        eventType: 'DIARY_SUBMITTED',
        entityId: eventKey,
        recipientId: supervisorId,
        messageText: supervisorMsg,
        replyMarkup: reviewKeyboard(entry.id),
      });
    }
  } catch (err: any) {
    console.warn('[NotificationService] notifyDiarySubmitted error:', err.message);
  }
}

/**
 * B. Notify student when diary is returned with supervisor comment
 */
export async function notifyDiaryReturned(diaryEntryId: string, supervisorComment?: string): Promise<void> {
  try {
    const entry = await prisma.diaryEntry.findUnique({
      where: { id: diaryEntryId },
      include: {
        internship: {
          include: { student: true, company: true },
        },
      },
    });

    if (!entry) return;

    const dateStr = entry.entryDate.toISOString().split('T')[0];
    const commentText = supervisorComment ? `\n💬 <b>Rahbar izohi:</b> <i>${supervisorComment}</i>\n` : '';

    const msg =
      `↩️ <b>Kundalik qayta ishlashga qaytarildi!</b>\n\n` +
      `📅 <b>Sana:</b> ${dateStr}\n` +
      `📌 <b>Vazifa:</b> ${esc(entry.taskTitle)}` +
      commentText +
      `\nIltimos, ko'rsatilgan kamchiliklarni to'g'rilab, qayta topshiring.\n` +
      `🔗 <a href="${env.CLIENT_URL}/diary/edit/${entry.id}">Kundalikni tahrirlash</a>`;

    await dispatchNotification({
      eventType: 'DIARY_RETURNED',
      entityId: `${entry.id}:${entry.updatedAt.getTime()}`,
      recipientId: entry.internship.studentId,
      messageText: msg,
    });
  } catch (err: any) {
    console.warn('[NotificationService] notifyDiaryReturned error:', err.message);
  }
}

/**
 * C. Notify student when diary is approved
 */
export async function notifyDiaryApproved(diaryEntryId: string): Promise<void> {
  try {
    const entry = await prisma.diaryEntry.findUnique({
      where: { id: diaryEntryId },
      include: {
        internship: {
          include: { student: true, company: true },
        },
      },
    });

    if (!entry) return;

    const dateStr = entry.entryDate.toISOString().split('T')[0];

    const msg =
      `✅ <b>Kundalik tasdiqlandi!</b>\n\n` +
      `📅 <b>Sana:</b> ${dateStr}\n` +
      `📌 <b>Vazifa:</b> ${esc(entry.taskTitle)}\n` +
      `⏱ <b>Qabul qilingan soat:</b> ${Number(entry.hours)} soat\n\n` +
      `Kundalik yozuvingiz rahbar tomonidan muvaffaqiyatli tasdiqlandi.\n` +
      `🔗 <a href="${env.CLIENT_URL}/diary">Kundaliklar ro'yxati</a>`;

    await dispatchNotification({
      eventType: 'DIARY_APPROVED',
      entityId: entry.id,
      recipientId: entry.internship.studentId,
      messageText: msg,
    });
  } catch (err: any) {
    console.warn('[NotificationService] notifyDiaryApproved error:', err.message);
  }
}

/**
 * D. Notify student when attendance is recorded
 */
export async function notifyAttendanceRecorded(attendanceId: string): Promise<void> {
  try {
    const attendance = await prisma.attendance.findUnique({
      where: { id: attendanceId },
      include: {
        internship: {
          include: { student: true, company: true },
        },
      },
    });

    if (!attendance) return;

    const statusTranslations: Record<string, string> = {
      PRESENT: 'Kelgan (Qatnashgan)',
      ABSENT: 'Kelmagan (Sababsiz)',
      LATE: 'Kechikkan',
      EXCUSED: 'Uzrli sabab bilan',
    };

    const dateStr = attendance.attendanceDate.toISOString().split('T')[0];
    const statusText = statusTranslations[attendance.status] || attendance.status;

    const msg =
      `🕒 <b>Davomat qayd etildi</b>\n\n` +
      `📅 <b>Sana:</b> ${dateStr}\n` +
      `📊 <b>Holat:</b> ${statusText}\n` +
      `⏱ <b>Soat:</b> ${Number(attendance.hours)} soat\n` +
      (attendance.note ? `📝 <b>Izoh:</b> ${attendance.note}\n` : '') +
      `\n🔗 <a href="${env.CLIENT_URL}/attendance">Davomatni ko'rish</a>`;

    await dispatchNotification({
      eventType: 'ATTENDANCE_RECORDED',
      entityId: `${attendance.id}:${attendance.updatedAt.getTime()}`,
      recipientId: attendance.internship.studentId,
      messageText: msg,
    });
  } catch (err: any) {
    console.warn('[NotificationService] notifyAttendanceRecorded error:', err.message);
  }
}

/**
 * E. Notify student when final evaluation is completed (both supervisors have submitted)
 */
export async function notifyEvaluationCompleted(internshipId: string, finalScore: number): Promise<void> {
  try {
    const internship = await prisma.internship.findUnique({
      where: { id: internshipId },
      include: {
        student: true,
        company: true,
      },
    });

    if (!internship) return;

    const msg =
      `🎉 <b>Yakuniy amaliyot baholash natijasi tayyor!</b>\n\n` +
      `🏢 <b>Korxona:</b> ${internship.company.name}\n` +
      `⭐️ <b>Yakuniy umumiy ball:</b> <b>${finalScore}</b> / 100 ball\n\n` +
      `Korxona va ta'lim muassasasi rahbarlari tomonidan baholash to'liq yakunlandi.\n` +
      `Batafsil mezonlar va taqrizlarni ko'rish uchun quyidagi havolaga o'ting:\n` +
      `🔗 <a href="${env.CLIENT_URL}/evaluation/${internship.id}">Yakuniy bahoni ko'rish</a>`;

    await dispatchNotification({
      eventType: 'EVALUATION_COMPLETED',
      entityId: internship.id,
      recipientId: internship.studentId,
      messageText: msg,
    });
  } catch (err: any) {
    console.warn('[NotificationService] notifyEvaluationCompleted error:', err.message);
  }
}
