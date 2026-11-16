/**
 * Diary Attachments Router
 *
 * Endpoints:
 *   POST   /api/diary/:entryId/attachments      — Fayl yuklash
 *   GET    /api/diary/:entryId/attachments      — Ro'yxat
 *   GET    /api/diary/attachments/:attachmentId — Yuklab olish
 *   DELETE /api/diary/attachments/:attachmentId — O'chirish
 *
 * Xavfsizlik:
 *   - multer: faqat ruxsat etilgan MIME turlar, max 10 MiB
 *   - Magic numbers / signature verification: fayl kengaytmasi va ichki baytlari solishtiriladi
 *   - UUID fayl nomi — path traversal xavfi yo'q
 *   - Har bir endpoint autentifikatsiya va ruxsat tekshiruvidan o'tadi
 *   - Fayllar ochiq statik papka orqali XIZMAT QILINMAYDI
 *   - Disk-missing fayl serverni yiqitmaydi, gracefully 410 qaytaradi
 */

import { Router, Request, Response, NextFunction } from 'express';
import multer, { MulterError } from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middleware/auth';
import {
  isStudentOwnerOfEntry,
  canViewEntry,
} from '../middleware/diaryPermissions';

// ─── Upload Storage ────────────────────────────────────────────────────────────

const UPLOAD_ROOT = path.resolve(process.cwd(), 'uploads', 'diary');

const ALLOWED_EXTENSIONS = new Set(['.pdf', '.jpg', '.jpeg', '.png', '.docx', '.xlsx']);
const ALLOWED_MIMES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);

const storage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const entryId = req.params.entryId;
    // entryId Prisma CUID — faqat xavfsiz belgilar
    const dest = path.join(UPLOAD_ROOT, entryId);
    fs.mkdirSync(dest, { recursive: true });
    cb(null, dest);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${uuidv4()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MiB limit
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(ext) || !ALLOWED_MIMES.has(file.mimetype)) {
      return cb(
        new Error(
          `Noto'g'ri fayl turi: ${file.mimetype}. Ruxsat etilganlar: PDF, JPG, PNG, DOCX, XLSX`
        )
      );
    }
    cb(null, true);
  },
});

// ─── Signature / Magic bytes verification ─────────────────────────────────────

function verifyFileSignature(filePath: string, ext: string): boolean {
  try {
    const buffer = Buffer.alloc(8);
    const fd = fs.openSync(filePath, 'r');
    const bytesRead = fs.readSync(fd, buffer, 0, 8, 0);
    fs.closeSync(fd);

    if (bytesRead < 3) return false;

    const extLower = ext.toLowerCase();

    // PDF: %PDF (25 50 44 46)
    if (extLower === '.pdf') {
      return (
        buffer[0] === 0x25 &&
        buffer[1] === 0x50 &&
        buffer[2] === 0x44 &&
        buffer[3] === 0x46
      );
    }

    // PNG: 89 50 4E 47
    if (extLower === '.png') {
      return (
        buffer[0] === 0x89 &&
        buffer[1] === 0x50 &&
        buffer[2] === 0x4e &&
        buffer[3] === 0x47
      );
    }

    // JPEG / JPG: FF D8 FF
    if (extLower === '.jpg' || extLower === '.jpeg') {
      return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
    }

    // DOCX / XLSX: ZIP container (PK 03 04, PK 05 06, or PK 07 08)
    if (extLower === '.docx' || extLower === '.xlsx') {
      return (
        buffer[0] === 0x50 &&
        buffer[1] === 0x4b &&
        (buffer[2] === 0x03 || buffer[2] === 0x05 || buffer[2] === 0x07)
      );
    }

    return false;
  } catch (err) {
    return false;
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function serializeAttachment(att: any) {
  return {
    ...att,
    sizeBytes: att.sizeBytes.toString(),
  };
}

async function checkDownloadPermission(
  attachmentId: string,
  user: any
): Promise<
  | { ok: true; attachment: any }
  | { ok: false; status: number; message: string }
> {
  const attachment = await prisma.diaryAttachment.findUnique({
    where: { id: attachmentId },
    include: {
      diaryEntry: {
        include: {
          internship: {
            select: {
              studentId: true,
              companySupervisorId: true,
              universitySupervisorId: true,
            },
          },
        },
      },
    },
  });

  if (!attachment) {
    return { ok: false, status: 404, message: 'Fayl topilmadi' };
  }

  const { studentId, companySupervisorId, universitySupervisorId } =
    attachment.diaryEntry.internship;
  const entryStatus = attachment.diaryEntry.status;

  const isOwner = user.id === studentId;
  const isAdmin = user.role === 'ADMIN';
  const isSupervisor =
    user.id === companySupervisorId || user.id === universitySupervisorId;

  if (!isOwner && !isAdmin && !isSupervisor) {
    return { ok: false, status: 403, message: "Faylga kirish uchun ruxsat yo'q" };
  }

  // Deny supervisors when entry.status is DRAFT or RETURNED
  if (!isAdmin && !isOwner && ['DRAFT', 'RETURNED'].includes(entryStatus)) {
    return {
      ok: false,
      status: 403,
      message: "Qoralama yoki tuzatish uchun qaytarilgan kundalik fayllari ustozga ko'rinmaydi",
    };
  }

  return { ok: true, attachment };
}

// ─── Router ────────────────────────────────────────────────────────────────────

const router = Router();

/**
 * POST /api/diary/:entryId/attachments
 * Bir yoki bir nechta fayl yuklash
 */
router.post(
  '/:entryId/attachments',
  authenticate,
  isStudentOwnerOfEntry,
  (req: Request, res: Response, next: NextFunction) => {
    upload.array('files', 10)(req, res, (err) => {
      if (err instanceof MulterError) {
        const msg =
          err.code === 'LIMIT_FILE_SIZE'
            ? "Fayl hajmi 10 MB dan oshmasligi kerak"
            : `Yuklash xatosi: ${err.message}`;
        res.status(400).json({ error: { message: msg, status: 400 } });
        return;
      }
      if (err) {
        res.status(400).json({ error: { message: err.message, status: 400 } });
        return;
      }
      next();
    });
  },
  async (req: Request, res: Response): Promise<void> => {
    try {
      const entryId = req.params.entryId;
      const files = req.files as Express.Multer.File[];

      if (!files || files.length === 0) {
        res.status(400).json({
          error: { message: "Hech qanday fayl tanlanmadi", status: 400 },
        });
        return;
      }

      // Fayl mazmunining haqiqiyligini tekshirish (Magic bytes)
      for (const file of files) {
        const ext = path.extname(file.originalname).toLowerCase();
        if (!verifyFileSignature(file.path, ext)) {
          // Barcha yangi yuklangan fayllarni diskdan tozalash
          files.forEach((f) => {
            if (fs.existsSync(f.path)) {
              try {
                fs.unlinkSync(f.path);
              } catch (_) {}
            }
          });
          res.status(400).json({
            error: {
              message: `Fayl mazmuni uning formati (${file.originalname}) ga mos kelmadi yoki fayl shikastlangan.`,
              status: 400,
            },
          });
          return;
        }
      }

      const attachments = await Promise.all(
        files.map((file) =>
          prisma.diaryAttachment.create({
            data: {
              diaryEntryId: entryId,
              originalName: file.originalname,
              storedPath: file.path,
              mimeType: file.mimetype,
              sizeBytes: BigInt(file.size),
            },
          })
        )
      );

      res.status(201).json({ attachments: attachments.map(serializeAttachment) });
    } catch (err: any) {
      console.error('[AttachmentUpload] Error:', err);
      res
        .status(500)
        .json({ error: { message: 'Fayl saqlashda ichki xato yuz berdi', status: 500 } });
    }
  }
);

/**
 * GET /api/diary/:entryId/attachments
 * Kundalikka biriktirilgan fayllar ro'yxati
 */
router.get(
  '/:entryId/attachments',
  authenticate,
  canViewEntry,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const entryId = req.params.entryId;
      const attachments = await prisma.diaryAttachment.findMany({
        where: { diaryEntryId: entryId },
        orderBy: { createdAt: 'asc' },
      });
      res.json({ attachments: attachments.map(serializeAttachment) });
    } catch (err: any) {
      console.error('[AttachmentList] Error:', err);
      res
        .status(500)
        .json({ error: { message: "Fayllar ro'yxatini olishda xato", status: 500 } });
    }
  }
);

/**
 * GET /api/diary/attachments/:attachmentId
 * Fayl yuklab olish — stream orqali, ochiq URL yo'q
 */
router.get(
  '/attachments/:attachmentId',
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const user = (req as any).user;
      const result = await checkDownloadPermission(
        req.params.attachmentId,
        user
      );

      if (!result.ok) {
        res
          .status(result.status)
          .json({ error: { message: result.message, status: result.status } });
        return;
      }

      const { attachment } = result;
      const filePath = attachment.storedPath;

      // Fayl diskda mavjudligini tekshir (410 Gone — DB da bor, diskda yo'q)
      if (!fs.existsSync(filePath)) {
        console.warn(
          `[AttachmentDownload] File missing on disk: ${filePath}, attachmentId=${attachment.id}`
        );
        res.status(410).json({
          error: {
            message: "Fayl diskda topilmadi. Administrator bilan bog'laning.",
            status: 410,
          },
        });
        return;
      }

      // Xavfsiz fayl nomi — original faqat Content-Disposition headerda
      const safeOriginalName = encodeURIComponent(attachment.originalName);
      res.setHeader('Content-Type', attachment.mimeType);
      res.setHeader(
        'Content-Disposition',
        `attachment; filename*=UTF-8''${safeOriginalName}`
      );
      res.setHeader('X-Content-Type-Options', 'nosniff');

      const stream = fs.createReadStream(filePath);
      stream.on('error', (streamErr) => {
        console.error('[AttachmentDownload] Stream error:', streamErr);
        if (!res.headersSent) {
          res
            .status(500)
            .json({ error: { message: 'Fayl uzatishda xato', status: 500 } });
        }
      });
      stream.pipe(res);
    } catch (err: any) {
      console.error('[AttachmentDownload] Error:', err);
      res
        .status(500)
        .json({ error: { message: 'Ichki server xatosi', status: 500 } });
    }
  }
);

/**
 * DELETE /api/diary/attachments/:attachmentId
 * Faylni o'chirish — faqat egasi talaba, DRAFT yoki RETURNED holatda
 */
router.delete(
  '/attachments/:attachmentId',
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const user = (req as any).user;
      const { attachmentId } = req.params;

      const attachment = await prisma.diaryAttachment.findUnique({
        where: { id: attachmentId },
        include: {
          diaryEntry: {
            include: {
              internship: {
                select: { studentId: true },
              },
            },
          },
        },
      });

      if (!attachment) {
        res
          .status(404)
          .json({ error: { message: 'Fayl topilmadi', status: 404 } });
        return;
      }

      // Faqat kundalik egasi yoki ADMIN o'chira oladi
      const isOwner = attachment.diaryEntry.internship.studentId === user.id;
      const isAdmin = user.role === 'ADMIN';

      if (!isOwner && !isAdmin) {
        res.status(403).json({
          error: { message: "Faylni o'chirishga ruxsat yo'q", status: 403 },
        });
        return;
      }

      // Faqat mutable holatda
      const { status } = attachment.diaryEntry;
      if (!['DRAFT', 'RETURNED'].includes(status)) {
        res.status(400).json({
          error: {
            message: `Faqat qoralama yoki qaytarilgan kundalik faylini o'chirish mumkin (hozirgi holat: ${status})`,
            status: 400,
          },
        });
        return;
      }

      // Diskdan o'chirish
      const filePath = attachment.storedPath;
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch (unlinkErr) {
          console.error('[AttachmentDelete] Failed to remove file from disk:', unlinkErr);
        }
      }

      await prisma.diaryAttachment.delete({ where: { id: attachmentId } });

      res.json({ message: "Fayl muvaffaqiyatli o'chirildi" });
    } catch (err: any) {
      console.error('[AttachmentDelete] Error:', err);
      res
        .status(500)
        .json({ error: { message: "Faylni o'chirishda ichki xato", status: 500 } });
    }
  }
);

export default router;
