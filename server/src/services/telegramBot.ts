import { Bot } from 'grammy';
import crypto from 'crypto';
import { env } from '../config/env';
import { prisma } from '../lib/prisma';
import { registerBotFeatures, menuFor, helpTextFor, BOT_COMMANDS } from './botFeatures';

export interface TelegramBotStatus {
  isConfigured: boolean;
  isRunning: boolean;
  username: string;
}

let botInstance: Bot | null = null;
let isBotRunning = false;

/**
 * Check if the token is present and not a dummy placeholder
 */
export function isTelegramTokenValid(): boolean {
  if (!env.TELEGRAM_BOT_TOKEN) return false;
  const token = env.TELEGRAM_BOT_TOKEN.trim();
  if (token === '' || token.includes('BU_YERGA_YANGILANGAN_BOT_TOKENINI_KIRITAMAN') || token.includes('YOUR_TELEGRAM_BOT_TOKEN')) {
    return false;
  }
  // Standard bot token format: <number>:<string>
  return /^\d+:[A-Za-z0-9_-]+$/.test(token);
}

/**
 * Hash a plain verification code with SHA-256
 */
export function hashLinkCode(code: string): string {
  return crypto.createHash('sha256').update(code.trim().toUpperCase()).digest('hex');
}

/**
 * Generate a random 6-character alphanumeric verification code
 */
export function generateRandomCode(): string {
  // 6 chars alphanumeric excluding ambiguous characters (0, O, I, 1)
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  const bytes = crypto.randomBytes(6);
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars[bytes[i] % chars.length];
  }
  return result;
}

/**
 * Handle linking verification given a telegram user ID and code
 */
export async function verifyAndLinkAccount(
  telegramUserId: number | bigint,
  username: string | undefined,
  inputCode: string
): Promise<{ success: boolean; message: string; userFullName?: string }> {
  const cleanCode = inputCode.trim().toUpperCase();
  const codeHash = hashLinkCode(cleanCode);
  const tgUserIdBigInt = BigInt(telegramUserId);

  // 1. Check if this Telegram account is already linked to another system user
  const existingTgAccount = await prisma.telegramAccount.findUnique({
    where: { telegramUserId: tgUserIdBigInt },
    include: { user: true },
  });

  // 2. Find matching active token
  const tokenRecord = await prisma.telegramLinkToken.findUnique({
    where: { codeHash },
    include: { user: true },
  });

  if (!tokenRecord) {
    return {
      success: false,
      message: "❌ Tasdiqlash kodi noto'g'ri. Iltimos, web-ilovadagi profilingizdan yangi kod oling.",
    };
  }

  // Check expiration (10 min)
  if (new Date() > tokenRecord.expiresAt) {
    await prisma.telegramLinkToken.delete({ where: { id: tokenRecord.id } }).catch(() => {});
    return {
      success: false,
      message: "⏳ Ushbu tasdiqlash kodining amal qilish muddati tugagan (10 daqiqa). Web-ilovadan yangi kod oling.",
    };
  }

  // Check attempt limit
  if (tokenRecord.attempts >= 3) {
    await prisma.telegramLinkToken.delete({ where: { id: tokenRecord.id } }).catch(() => {});
    return {
      success: false,
      message: "🚫 Urinishlar soni oshib ketdi. Xavfsizlik yuzasidan yangi kod oling.",
    };
  }

  // If this Telegram ID is already linked to someone ELSE
  if (existingTgAccount && existingTgAccount.userId !== tokenRecord.userId) {
    return {
      success: false,
      message: `⚠️ Ushbu Telegram akkaunti allaqachon boshqa foydalanuvchi (${existingTgAccount.user.fullName}) hisobiga bog'langan. Avval eski hisobdan /unlink qiling yoki web-ilovadan uzing.`,
    };
  }

  // Link account using upsert
  await prisma.$transaction([
    prisma.telegramAccount.upsert({
      where: { userId: tokenRecord.userId },
      update: {
        telegramUserId: tgUserIdBigInt,
        username: username || null,
        linkedAt: new Date(),
      },
      create: {
        userId: tokenRecord.userId,
        telegramUserId: tgUserIdBigInt,
        username: username || null,
        linkedAt: new Date(),
      },
    }),
    // Delete all tokens for this user once consumed
    prisma.telegramLinkToken.deleteMany({
      where: { userId: tokenRecord.userId },
    }),
  ]);

  return {
    success: true,
    message: `✅ Tabriklaymiz! Sizning Telegram akkauntingiz tizimga muvaffaqiyatli bog'landi.\n\n👤 Foydalanuvchi: ${tokenRecord.user.fullName}\n📧 Email: ${tokenRecord.user.email}\n🎯 Rol: ${tokenRecord.user.role}`,
    userFullName: tokenRecord.user.fullName,
  };
}

/** Replies to a linking attempt; on success shows the role menu. */
async function replyLinkResult(ctx: any, tgUserId: number, result: { success: boolean; message: string }) {
  if (!result.success) {
    await ctx.reply(result.message);
    return;
  }
  const acc = await prisma.telegramAccount.findUnique({ where: { telegramUserId: BigInt(tgUserId) }, include: { user: true } });
  await ctx.reply(`${result.message}\n\nPastdagi menyudan foydalaning. Imkoniyatlar: /help`, acc ? { reply_markup: menuFor(acc.user.role) } : {});
}

/**
 * Initialize Telegram Bot instance and register handlers
 */
export function getTelegramBot(): Bot | null {
  if (botInstance) return botInstance;

  if (!isTelegramTokenValid()) {
    return null;
  }

  try {
    const bot = new Bot(env.TELEGRAM_BOT_TOKEN);

    // /start command with optional deep-link payload
    bot.command('start', async (ctx) => {
      const payload = ctx.match?.trim();
      const tgUserId = ctx.from?.id;
      if (!tgUserId) return;

      // Deep link payload: /start <CODE>
      if (payload && payload.length >= 6) {
        const result = await verifyAndLinkAccount(tgUserId, ctx.from?.username, payload);
        await replyLinkResult(ctx, tgUserId, result);
        return;
      }

      // Check current link status
      const linked = await prisma.telegramAccount.findUnique({
        where: { telegramUserId: BigInt(tgUserId) },
        include: { user: true },
      });

      if (linked) {
        await ctx.reply(
          `👋 Assalomu alaykum, ${linked.user.fullName}!\n\n` +
          `Sizning Telegram akkauntingiz “Elektron amaliyot kundaligi” tizimiga allaqachon bog'langan.\n\n` +
          `Pastdagi menyudan foydalaning, imkoniyatlar ro'yxati: /help`,
          { reply_markup: menuFor(linked.user.role) }
        );
      } else {
        await ctx.reply(
          `👋 Assalomu alaykum!\n\n` +
          `Ushbu bot “Elektron amaliyot kundaligi” tizimidagi amaliyot, kundalik va baholash bildirishnomalarini tezkor yetkazish uchun xizmat qiladi.\n\n` +
          `🔗 Akkauntni bog'lash uchun:\n` +
          `1. Web-ilovaga kiring: ${env.CLIENT_URL}\n` +
          `2. Profil sozlamalari sahifasida “Telegram’ni bog‘lash” tugmasini bosing.\n` +
          `3. Olingan 6 xonali kodni ushbu botga yuboring.\n\n` +
          `Yordam uchun: /help`
        );
      }
    });

    // /help command — role-aware
    bot.command('help', async (ctx) => {
      const acc = ctx.from
        ? await prisma.telegramAccount.findUnique({ where: { telegramUserId: BigInt(ctx.from.id) }, include: { user: true } })
        : null;
      await ctx.reply(helpTextFor(acc?.user.role ?? null), {
        parse_mode: 'HTML',
        link_preview_options: { is_disabled: true },
        ...(acc ? { reply_markup: menuFor(acc.user.role) } : {}),
      });
    });

    // /status command
    bot.command('status', async (ctx) => {
      const tgUserId = ctx.from?.id;
      if (!tgUserId) return;

      const account = await prisma.telegramAccount.findUnique({
        where: { telegramUserId: BigInt(tgUserId) },
        include: { user: true },
      });

      if (!account) {
        await ctx.reply(
          `❌ Sizning Telegram akkauntingiz tizimga bog'lanmagan.\n\n` +
          `Bog'lash uchun web-ilovadagi profilingizdan bir martalik kod oling va ushbu botga yuboring.\n` +
          `Havola: ${env.CLIENT_URL}`
        );
      } else {
        const roleNames: Record<string, string> = {
          STUDENT: 'Talaba',
          COMPANY_SUPERVISOR: 'Korxona rahbari',
          UNIVERSITY_SUPERVISOR: "Ta'lim muassasasi rahbari",
          ADMIN: 'Administrator',
        };
        const dateStr = account.linkedAt.toLocaleDateString('uz-UZ', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });

        await ctx.reply(
          `✅ Sizning hisobingiz tizimga muvaffaqiyatli bog'langan:\n\n` +
          `👤 Ism: ${account.user.fullName}\n` +
          `📧 Email: ${account.user.email}\n` +
          `🎯 Rol: ${roleNames[account.user.role] || account.user.role}\n` +
          `📅 Bog'langan vaqt: ${dateStr}\n\n` +
          `Akkauntni uzish uchun /unlink buyrug'ini yuboring.`
        );
      }
    });

    // /unlink command
    bot.command('unlink', async (ctx) => {
      const tgUserId = ctx.from?.id;
      if (!tgUserId) return;

      const account = await prisma.telegramAccount.findUnique({
        where: { telegramUserId: BigInt(tgUserId) },
        include: { user: true },
      });

      if (!account) {
        await ctx.reply(`ℹ️ Sizning akkauntingiz allaqachon bog'lanmagan.`);
        return;
      }

      await prisma.telegramAccount.delete({
        where: { telegramUserId: BigInt(tgUserId) },
      });

      await ctx.reply(
        `✅ Telegram akkauntingiz ${account.user.fullName} hisobidan muvaffaqiyatli uzildi.\n\n` +
        `Qayta bog'lash uchun web-ilovadagi profilingizdan yangi kod olishingiz mumkin.`,
        { reply_markup: { remove_keyboard: true } }
      );
    });

    // Interactive features (menu, diary wizard, reviews, check-in, reports, announcements)
    registerBotFeatures(bot);

    // Handle plain text message as verification code
    bot.on('message:text', async (ctx) => {
      const text = ctx.message.text.trim();
      const tgUserId = ctx.from.id;

      // Ignore standard commands that didn't match
      if (text.startsWith('/')) return;

      // Check if text looks like a 6-character code
      if (/^[A-Za-z0-9]{6}$/.test(text)) {
        const result = await verifyAndLinkAccount(tgUserId, ctx.from.username, text);
        await replyLinkResult(ctx, tgUserId, result);
        return;
      }

      // Default helper reply
      const account = await prisma.telegramAccount.findUnique({
        where: { telegramUserId: BigInt(tgUserId) },
      });

      if (!account) {
        await ctx.reply(
          `ℹ️ Tizimga ulanish uchun web-ilovada olingan 6 xonali kodni yuboring.\n` +
          `Yordam uchun: /help`
        );
      } else {
        const user = await prisma.user.findUnique({ where: { id: account.userId } });
        await ctx.reply(
          `ℹ️ Buyruqni tushunmadim. Pastdagi menyudan foydalaning yoki /help ni bosing.`,
          user ? { reply_markup: menuFor(user.role) } : {}
        );
      }
    });

    // Catch bot errors safely without crashing app
    bot.catch((err) => {
      console.error('[TelegramBot] Safe error catch:', err.message || 'Unknown bot error');
    });

    botInstance = bot;
    return botInstance;
  } catch (error: any) {
    console.warn('[TelegramBot] Failed to create bot instance safely:', error.message);
    return null;
  }
}

/**
 * Start bot long polling safely
 */
export async function startTelegramBot(): Promise<void> {
  if (isBotRunning) {
    return;
  }

  if (!isTelegramTokenValid()) {
    console.log('[TelegramBot] Bot token is not configured or is a placeholder. Telegram Bot service is idle.');
    return;
  }

  const bot = getTelegramBot();
  if (!bot) return;

  stopRequested = false;
  isBotRunning = true;
  runPolling(bot, 0);
}

let stopRequested = false;

/**
 * Run long polling; if it stops unexpectedly (409 conflict, network error),
 * restart automatically with a growing delay (5 s … 60 s) instead of staying dead.
 */
function runPolling(bot: NonNullable<ReturnType<typeof getTelegramBot>>, attempt: number): void {
  bot
    .start({
      onStart: (botInfo) => {
        attempt = 0;
        console.log(`✅ [TelegramBot] Started polling as @${botInfo.username}`);
        void bot.api.setMyCommands(BOT_COMMANDS).catch((e) => console.warn('[TelegramBot] setMyCommands:', e?.message || e));
      },
    })
    .then(() => {
      if (!stopRequested) scheduleRestart(bot, attempt);
    })
    .catch((err) => {
      console.warn('[TelegramBot] Polling stopped or network error:', err?.message || err);
      if (!stopRequested) scheduleRestart(bot, attempt);
      else isBotRunning = false;
    });
}

function scheduleRestart(bot: NonNullable<ReturnType<typeof getTelegramBot>>, attempt: number): void {
  const delay = Math.min(60_000, 5_000 * (attempt + 1));
  console.log(`[TelegramBot] Restarting polling in ${delay / 1000}s…`);
  setTimeout(() => {
    if (!stopRequested) runPolling(bot, attempt + 1);
  }, delay).unref?.();
}

/**
 * Gracefully stop bot polling
 */
export async function stopTelegramBot(): Promise<void> {
  if (!botInstance || !isBotRunning) return;
  stopRequested = true;
  try {
    console.log('[TelegramBot] Stopping bot polling…');
    await botInstance.stop();
  } catch (err: any) {
    console.warn('[TelegramBot] Error while stopping bot:', err.message);
  } finally {
    isBotRunning = false;
  }
}

/**
 * Send a notification message to a specific Telegram user safely
 */
export async function sendTelegramMessage(
  telegramUserId: bigint | number,
  text: string,
  replyMarkup?: any
): Promise<{ success: boolean; error?: string }> {
  const bot = getTelegramBot();
  if (!bot || !isTelegramTokenValid()) {
    return { success: false, error: 'Telegram bot is not active or token is missing' };
  }

  try {
    await bot.api.sendMessage(Number(telegramUserId), text, {
      parse_mode: 'HTML',
      link_preview_options: { is_disabled: true },
      ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
    });
    return { success: true };
  } catch (err: any) {
    console.warn(`[TelegramBot] Failed to send message to tg user ${telegramUserId}:`, err.message || 'API error');
    return { success: false, error: err.message || 'Telegram API Error' };
  }
}
