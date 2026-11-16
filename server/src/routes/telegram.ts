import { Router, Response, NextFunction } from 'express';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';
import { prisma } from '../lib/prisma';
import { env } from '../config/env';
import { generateRandomCode, hashLinkCode } from '../services/telegramBot';

const router = Router();

/**
 * GET /api/telegram/status
 * Get the current user's Telegram link status
 */
router.get('/status', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = req.user!;

    const tgAccount = await prisma.telegramAccount.findUnique({
      where: { userId: user.id },
    });

    const botUsername = env.TELEGRAM_BOT_USERNAME || 'amaliyot_kundaligibot';
    const botUrl = `https://t.me/${botUsername}`;

    if (!tgAccount) {
      res.json({
        success: true,
        data: {
          isLinked: false,
          botUsername,
          botUrl,
        },
      });
      return;
    }

    res.json({
      success: true,
      data: {
        isLinked: true,
        username: tgAccount.username || null,
        telegramUserId: tgAccount.telegramUserId.toString(),
        linkedAt: tgAccount.linkedAt.toISOString(),
        botUsername,
        botUrl,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/telegram/generate-link-code
 * Generate a 6-character single-use linking code valid for 10 minutes
 */
router.post('/generate-link-code', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = req.user!;
    const botUsername = env.TELEGRAM_BOT_USERNAME || 'amaliyot_kundaligibot';

    // 1. Generate code and hash
    const plainCode = generateRandomCode();
    const codeHash = hashLinkCode(plainCode);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // 2. Clear old pending tokens for this user and save new one
    await prisma.$transaction([
      prisma.telegramLinkToken.deleteMany({
        where: { userId: user.id },
      }),
      prisma.telegramLinkToken.create({
        data: {
          userId: user.id,
          codeHash,
          expiresAt,
        },
      }),
    ]);

    const deepLinkUrl = `https://t.me/${botUsername}?start=${plainCode}`;

    res.json({
      success: true,
      data: {
        code: plainCode,
        expiresAt: expiresAt.toISOString(),
        botUsername,
        botUrl: `https://t.me/${botUsername}`,
        deepLinkUrl,
        instructions: `Telegram'da @${botUsername} botiga kiring va ushbu kodni yuboring yoki quyidagi havolani bosing. Kod 10 daqiqa davomida amal qiladi.`,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/telegram/unlink
 * Unlink the Telegram account from the currently logged in user
 */
router.post('/unlink', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = req.user!;

    const existing = await prisma.telegramAccount.findUnique({
      where: { userId: user.id },
    });

    if (!existing) {
      res.status(400).json({
        error: { message: "Telegram akkaunti allaqachon bog'lanmagan", status: 400 },
      });
      return;
    }

    await prisma.telegramAccount.delete({
      where: { userId: user.id },
    });

    res.json({
      success: true,
      message: "Telegram akkaunti muvaffaqiyatli uzildi.",
    });
  } catch (error) {
    next(error);
  }
});

export default router;
