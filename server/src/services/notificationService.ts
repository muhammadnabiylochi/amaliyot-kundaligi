import { prisma } from '../lib/prisma';
import { env } from '../config/env';
import { sendTelegramMessage } from './telegramBot';

export type NotificationEventType =
  | 'DIARY_SUBMITTED'
  | 'DIARY_RETURNED'
  | 'DIARY_APPROVED'
  | 'ATTENDANCE_RECORDED'
  | 'EVALUATION_COMPLETED'
  | 'DIARY_REMINDER';

interface SendNotificationParams {
  eventType: NotificationEventType;
  entityId: string;
  recipientId: string;
  messageText: string;
}

/**
 * Dispatch a notification to a specific user with idempotency check
 */
export async function dispatchNotification({
  eventType,
  entityId,
  recipientId,
  messageText,
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
    const sendResult = await sendTelegramMessage(tgAccount.telegramUserId, messageText);

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

    // 1. Notification to Student
    const studentMsg =
      `📋 <b>Kundalik muvaffaqiyatli topshirildi!</b>\n\n` +
      `📅 <b>Sana:</b> ${dateStr}\n` +
      `📌 <b>Vazifa:</b> ${entry.taskTitle}\n` +
      `⏱ <b>Ishlangan vaqt:</b> ${hours} soat\n` +
      `🏢 <b>Korxona:</b> ${entry.internship.company.name}\n\n` +
      `Kundalik rahbarlar ko'rib chiqishi uchun yuborildi.\n` +
      `🔗 <a href="${env.CLIENT_URL}/diary">Kundalikni ko'rish</a>`;

    await dispatchNotification({
      eventType: 'DIARY_SUBMITTED',
      entityId: entry.id,
      recipientId: student.id,
      messageText: studentMsg,
    });

    // 2. Notification to Company Supervisor (if assigned)
    if (entry.internship.companySupervisorId) {
      const supervisorMsg =
        `🔔 <b>Yangi kundalik yozuvi topshirildi!</b>\n\n` +
        `👤 <b>Talaba:</b> ${student.fullName}\n` +
        `📅 <b>Sana:</b> ${dateStr}\n` +
        `📌 <b>Vazifa:</b> ${entry.taskTitle}\n` +
        `⏱ <b>Ishlangan vaqt:</b> ${hours} soat\n\n` +
        `Iltimos, kundalikni ko'rib chiqing va tasdiqlang yoki qaytaring:\n` +
        `🔗 <a href="${env.CLIENT_URL}/reviews">Kundalikni tekshirish</a>`;

      await dispatchNotification({
        eventType: 'DIARY_SUBMITTED',
        entityId: entry.id,
        recipientId: entry.internship.companySupervisorId,
        messageText: supervisorMsg,
      });
    }

    // 3. Notification to University Supervisor (if assigned)
    if (entry.internship.universitySupervisorId) {
      const uniMsg =
        `🔔 <b>Talaba yangi kundalik topshirdi!</b>\n\n` +
        `👤 <b>Talaba:</b> ${student.fullName}\n` +
        `🏢 <b>Korxona:</b> ${entry.internship.company.name}\n` +
        `📅 <b>Sana:</b> ${dateStr}\n` +
        `📌 <b>Vazifa:</b> ${entry.taskTitle}\n\n` +
        `🔗 <a href="${env.CLIENT_URL}/reviews">Kundalikni tekshirish</a>`;

      await dispatchNotification({
        eventType: 'DIARY_SUBMITTED',
        entityId: entry.id,
        recipientId: entry.internship.universitySupervisorId,
        messageText: uniMsg,
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
      `📌 <b>Vazifa:</b> ${entry.taskTitle}` +
      commentText +
      `\nIltimos, ko'rsatilgan kamchiliklarni to'g'rilab, qayta topshiring.\n` +
      `🔗 <a href="${env.CLIENT_URL}/diary/edit/${entry.id}">Kundalikni tahrirlash</a>`;

    await dispatchNotification({
      eventType: 'DIARY_RETURNED',
      entityId: entry.id,
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
      `📌 <b>Vazifa:</b> ${entry.taskTitle}\n` +
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
      entityId: attendance.id,
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
