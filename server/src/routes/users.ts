import { Router, Response, NextFunction } from 'express';
import { Prisma, UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import ExcelJS from 'exceljs';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticate, authorize, AuthenticatedRequest } from '../middleware/auth';
import { fail, generateTempPassword } from '../lib/http';

const router = Router();

const ROLES = ['ADMIN', 'STUDENT', 'COMPANY_SUPERVISOR', 'UNIVERSITY_SUPERVISOR'] as const;

const baseUserSchema = z.object({
  fullName: z.string().trim().min(3, "To'liq ism kamida 3 belgidan iborat bo'lishi kerak"),
  email: z.string().trim().toLowerCase().email("To'g'ri elektron pochta manzilini kiriting"),
  role: z.enum(ROLES),
  phone: z.string().trim().optional().nullable(),
  position: z.string().trim().optional().nullable(),
  groupId: z.string().optional().nullable(),
  studentNumber: z.string().trim().optional().nullable(),
});

const createUserSchema = baseUserSchema.superRefine((d, ctx) => {
  if (d.role === 'STUDENT' && !d.groupId) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['groupId'], message: 'Talaba uchun guruh tanlanishi shart' });
  }
});

const updateUserSchema = baseUserSchema.partial();

const userInclude = { studentProfile: { include: { group: true } } } satisfies Prisma.UserInclude;
type UserWithProfile = Prisma.UserGetPayload<{ include: typeof userInclude }>;

function legacyRole(role: UserRole): 'admin' | 'student' | 'supervisor' {
  if (role === 'ADMIN') return 'admin';
  if (role === 'STUDENT') return 'student';
  return 'supervisor';
}

function formatUser(u: UserWithProfile) {
  const phone = u.studentProfile?.phone ?? u.phone ?? null;
  return {
    id: u.id,
    name: u.fullName,
    fullName: u.fullName,
    email: u.email,
    role: legacyRole(u.role),
    rawRole: u.role,
    department: u.studentProfile?.group?.faculty || u.position || '',
    position: u.position,
    groupId: u.studentProfile?.groupId ?? null,
    group: u.studentProfile?.group?.name,
    studentNumber: u.studentProfile?.studentNumber ?? null,
    phone,
    status: u.isActive ? 'active' : 'inactive',
    mustChangePassword: u.mustChangePassword,
    createdAt: u.createdAt.toISOString().split('T')[0],
  };
}

async function nextStudentNumber(): Promise<string> {
  const year = new Date().getFullYear();
  for (let i = 0; i < 20; i++) {
    const candidate = `ST-${year}-${String(Math.floor(1000 + Math.random() * 9000))}`;
    const exists = await prisma.studentProfile.findUnique({ where: { studentNumber: candidate } });
    if (!exists) return candidate;
  }
  return `ST-${year}-${Date.now()}`;
}

/**
 * GET /api/users?role=STUDENT|COMPANY_SUPERVISOR|...|student|supervisor&search=&groupId=
 * ADMIN sees everyone; supervisors see only users (to pick from lists).
 */
router.get('/', authenticate, authorize('ADMIN', 'COMPANY_SUPERVISOR', 'UNIVERSITY_SUPERVISOR'), async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { role, search, groupId } = req.query;
    const where: Prisma.UserWhereInput = {};

    if (typeof role === 'string' && role && role !== 'all') {
      const r = role.toLowerCase();
      if (r === 'admin') where.role = 'ADMIN';
      else if (r === 'student') where.role = 'STUDENT';
      else if (r === 'supervisor') where.role = { in: ['COMPANY_SUPERVISOR', 'UNIVERSITY_SUPERVISOR'] };
      else if ((ROLES as readonly string[]).includes(role.toUpperCase())) where.role = role.toUpperCase() as UserRole;
    }
    if (typeof search === 'string' && search) {
      where.OR = [
        { fullName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (typeof groupId === 'string' && groupId && groupId !== 'all') {
      where.studentProfile = { groupId };
    }

    const users = await prisma.user.findMany({ where, include: userInclude, orderBy: { createdAt: 'desc' } });
    res.json({ success: true, data: users.map(formatUser) });
  } catch (error) {
    next(error);
  }
});

/** POST /api/users — ADMIN creates a user; returns a one-time temporary password */
router.post('/', authenticate, authorize('ADMIN'), async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const d = createUserSchema.parse(req.body);
    if (d.role === 'STUDENT') {
      const group = await prisma.studentGroup.findUnique({ where: { id: d.groupId! } });
      if (!group) {
        fail(res, 400, 'Guruh topilmadi');
        return;
      }
    }
    const tempPassword = generateTempPassword();
    const passwordHash = await bcrypt.hash(tempPassword, 10);

    const user = await prisma.user.create({
      data: {
        fullName: d.fullName,
        email: d.email,
        passwordHash,
        role: d.role,
        isActive: true,
        mustChangePassword: true,
        phone: d.role === 'STUDENT' ? null : d.phone || null,
        position: d.position || null,
        ...(d.role === 'STUDENT'
          ? {
              studentProfile: {
                create: {
                  groupId: d.groupId!,
                  studentNumber: d.studentNumber || (await nextStudentNumber()),
                  phone: d.phone || null,
                },
              },
            }
          : {}),
      },
      include: userInclude,
    });

    res.status(201).json({ success: true, data: { user: formatUser(user), tempPassword } });
  } catch (error) {
    next(error);
  }
});

/** PATCH /api/users/:id — ADMIN edits name, email, role, phone, group */
router.patch('/:id', authenticate, authorize('ADMIN'), async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const existing = await prisma.user.findUnique({ where: { id: req.params.id }, include: userInclude });
    if (!existing) {
      fail(res, 404, 'Foydalanuvchi topilmadi');
      return;
    }
    const d = updateUserSchema.parse(req.body);
    const newRole = d.role ?? existing.role;

    if (existing.id === req.user!.id && newRole !== 'ADMIN') {
      fail(res, 400, "O'zingizning administrator rolingizni o'zgartira olmaysiz");
      return;
    }
    if (existing.role !== newRole) {
      const linked = await prisma.internship.count({
        where: { OR: [{ studentId: existing.id }, { companySupervisorId: existing.id }, { universitySupervisorId: existing.id }] },
      });
      if (linked > 0) {
        fail(res, 400, `Bu foydalanuvchi ${linked} ta amaliyotga biriktirilgan, shuning uchun rolini o'zgartirib bo'lmaydi.`);
        return;
      }
    }
    if (newRole === 'STUDENT') {
      const groupId = d.groupId ?? existing.studentProfile?.groupId;
      if (!groupId) {
        fail(res, 400, 'Talaba uchun guruh tanlanishi shart');
        return;
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: existing.id },
        data: {
          ...(d.fullName ? { fullName: d.fullName } : {}),
          ...(d.email ? { email: d.email } : {}),
          role: newRole,
          ...(d.position !== undefined ? { position: d.position || null } : {}),
          ...(newRole !== 'STUDENT' && d.phone !== undefined ? { phone: d.phone || null } : {}),
        },
      });
      if (newRole === 'STUDENT') {
        const groupId = (d.groupId ?? existing.studentProfile?.groupId)!;
        if (existing.studentProfile) {
          await tx.studentProfile.update({
            where: { userId: existing.id },
            data: {
              groupId,
              ...(d.studentNumber ? { studentNumber: d.studentNumber } : {}),
              ...(d.phone !== undefined ? { phone: d.phone || null } : {}),
            },
          });
        } else {
          await tx.studentProfile.create({
            data: {
              userId: existing.id,
              groupId,
              studentNumber: d.studentNumber || (await nextStudentNumber()),
              phone: d.phone || null,
            },
          });
        }
      }
    });

    const updated = await prisma.user.findUnique({ where: { id: existing.id }, include: userInclude });
    res.json({ success: true, data: formatUser(updated!) });
  } catch (error) {
    next(error);
  }
});

/** POST /api/users/:id/reset-password — ADMIN issues a new temporary password */
router.post('/:id/reset-password', authenticate, authorize('ADMIN'), async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!user) {
      fail(res, 404, 'Foydalanuvchi topilmadi');
      return;
    }
    const tempPassword = generateTempPassword();
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await bcrypt.hash(tempPassword, 10), mustChangePassword: true },
    });
    res.json({ success: true, data: { tempPassword } });
  } catch (error) {
    next(error);
  }
});

/** PATCH /api/users/:id/toggle-status — ADMIN blocks/unblocks (cannot block self) */
router.patch('/:id/toggle-status', authenticate, authorize('ADMIN'), async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!user) {
      fail(res, 404, 'Foydalanuvchi topilmadi');
      return;
    }
    if (user.id === req.user!.id) {
      fail(res, 400, "O'zingizning hisobingizni bloklay olmaysiz");
      return;
    }
    const updated = await prisma.user.update({ where: { id: user.id }, data: { isActive: !user.isActive } });
    res.json({ success: true, data: { id: updated.id, isActive: updated.isActive } });
  } catch (error) {
    next(error);
  }
});

// ── Excel import ─────────────────────────────────────────────────────────────

const IMPORT_HEADERS = ["F.I.SH", 'Email', 'Rol', 'Guruh', "Bo'lim", 'Mutaxassislik', 'Talaba ID', 'Telefon'];

const ROLE_ALIASES: Record<string, UserRole> = {
  talaba: 'STUDENT',
  student: 'STUDENT',
  "o'quvchi": 'STUDENT',
  'korxona rahbari': 'COMPANY_SUPERVISOR',
  company_supervisor: 'COMPANY_SUPERVISOR',
  "ta'lim muassasasi rahbari": 'UNIVERSITY_SUPERVISOR',
  'muassasa rahbari': 'UNIVERSITY_SUPERVISOR',
  'universitet rahbari': 'UNIVERSITY_SUPERVISOR',
  university_supervisor: 'UNIVERSITY_SUPERVISOR',
  administrator: 'ADMIN',
  admin: 'ADMIN',
};

/** GET /api/users/import/template — sample .xlsx */
router.get('/import/template', authenticate, authorize('ADMIN'), async (_req, res: Response, next: NextFunction) => {
  try {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Foydalanuvchilar');
    ws.addRow(IMPORT_HEADERS);
    ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } };
    ws.addRow(['Karimov Aziz Botirovich', 'aziz.karimov@student.edu.uz', 'Talaba', 'DI-21', 'Axborot texnologiyalari', 'Dasturiy injiniring', '', '+998901234567']);
    ws.addRow(['Rasulova Nodira', 'nodira@korxona.uz', 'Korxona rahbari', '', '', '', '', '+998907654321']);
    ws.columns.forEach((c) => (c.width = 26));
    const note = wb.addWorksheet("Yo'riqnoma");
    [
      "Rol ustuni: Talaba | Korxona rahbari | Ta'lim muassasasi rahbari | Administrator (bo'sh bo'lsa — Talaba).",
      "Talaba uchun Guruh majburiy. Guruh tizimda bo'lmasa, Bo'lim va Mutaxassislik bilan avtomatik yaratiladi.",
      "Talaba ID bo'sh qolsa, tizim o'zi raqam beradi.",
      'Har bir yangi foydalanuvchiga vaqtinchalik parol beriladi va birinchi kirishda uni almashtirish talab qilinadi.',
    ].forEach((t) => note.addRow([t]));
    note.getColumn(1).width = 110;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="foydalanuvchilar_shablon.xlsx"');
    await wb.xlsx.write(res);
    res.end();
  } catch (e) {
    next(e);
  }
});

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

function cellText(v: ExcelJS.CellValue): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'object') {
    if ('text' in v && typeof (v as any).text === 'string') return (v as any).text.trim();
    if ('result' in v) return String((v as any).result ?? '').trim();
    if ('richText' in v) return (v as any).richText.map((r: any) => r.text).join('').trim();
    if (v instanceof Date) return v.toISOString().split('T')[0];
  }
  return String(v).trim();
}

/** POST /api/users/import — multipart field "file" (.xlsx) */
router.post('/import', authenticate, authorize('ADMIN'), upload.single('file'), async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.file) {
      fail(res, 400, 'Excel fayl (.xlsx) yuklanmadi');
      return;
    }
    if (req.file.buffer.subarray(0, 4).toString('hex') !== '504b0304') {
      fail(res, 400, "Fayl .xlsx formatida bo'lishi kerak");
      return;
    }
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(req.file.buffer as any);
    const ws = wb.worksheets[0];
    if (!ws) {
      fail(res, 400, "Excel faylda varaq topilmadi");
      return;
    }

    // Map header names → column numbers (tolerant to order)
    const headerRow = ws.getRow(1);
    const col: Record<string, number> = {};
    headerRow.eachCell((cell, n) => {
      const h = cellText(cell.value).toLowerCase();
      if (h.startsWith('f.i.sh') || h === 'fish' || h.includes('ism')) col.name = n;
      else if (h.includes('email') || h.includes('pochta')) col.email = n;
      else if (h === 'rol' || h === 'role') col.role = n;
      else if (h.includes('guruh')) col.group = n;
      else if (h.includes("bo'lim") || h.includes('fakultet')) col.faculty = n;
      else if (h.includes('mutaxassislik')) col.program = n;
      else if (h.includes('id') || h.includes('raqam')) col.number = n;
      else if (h.includes('telefon')) col.phone = n;
    });
    if (!col.name || !col.email) {
      fail(res, 400, "Birinchi qatorda kamida \"F.I.SH\" va \"Email\" ustunlari bo'lishi kerak. Shablonni yuklab oling.");
      return;
    }

    const results: { row: number; fullName: string; email: string; role?: string; status: 'created' | 'skipped' | 'error'; message?: string; tempPassword?: string }[] = [];
    const groupCache = new Map<string, string>();

    for (let r = 2; r <= ws.rowCount; r++) {
      const row = ws.getRow(r);
      const get = (k: string) => (col[k] ? cellText(row.getCell(col[k]).value) : '');
      const fullName = get('name');
      const email = get('email').toLowerCase();
      if (!fullName && !email) continue;

      try {
        const roleText = get('role').toLowerCase();
        const role: UserRole = roleText ? ROLE_ALIASES[roleText] ?? (null as any) : 'STUDENT';
        if (!role) throw new Error(`Noma'lum rol: "${get('role')}"`);
        const parsed = baseUserSchema.safeParse({ fullName, email, role });
        if (!parsed.success) throw new Error(parsed.error.errors[0]?.message);

        if (await prisma.user.findUnique({ where: { email } })) {
          results.push({ row: r, fullName, email, role, status: 'skipped', message: 'Bu email bilan foydalanuvchi allaqachon mavjud' });
          continue;
        }

        let groupId: string | undefined;
        if (role === 'STUDENT') {
          const groupName = get('group');
          if (!groupName) throw new Error('Talaba uchun guruh ko\'rsatilmagan');
          groupId = groupCache.get(groupName);
          if (!groupId) {
            const g =
              (await prisma.studentGroup.findUnique({ where: { name: groupName } })) ??
              (await prisma.studentGroup.create({
                data: { name: groupName, faculty: get('faculty') || 'Belgilanmagan', studyProgram: get('program') || 'Belgilanmagan' },
              }));
            groupId = g.id;
            groupCache.set(groupName, g.id);
          }
        }

        const studentNumber = get('number');
        if (studentNumber && (await prisma.studentProfile.findUnique({ where: { studentNumber } }))) {
          throw new Error(`Talaba ID "${studentNumber}" allaqachon band`);
        }

        const tempPassword = generateTempPassword();
        await prisma.user.create({
          data: {
            fullName,
            email,
            role,
            passwordHash: await bcrypt.hash(tempPassword, 10),
            mustChangePassword: true,
            phone: role === 'STUDENT' ? null : get('phone') || null,
            ...(role === 'STUDENT'
              ? { studentProfile: { create: { groupId: groupId!, studentNumber: studentNumber || (await nextStudentNumber()), phone: get('phone') || null } } }
              : {}),
          },
        });
        results.push({ row: r, fullName, email, role, status: 'created', tempPassword });
      } catch (e: any) {
        results.push({ row: r, fullName, email, status: 'error', message: e.message || 'Xatolik' });
      }
    }

    res.json({
      success: true,
      data: {
        created: results.filter((x) => x.status === 'created').length,
        skipped: results.filter((x) => x.status === 'skipped').length,
        errors: results.filter((x) => x.status === 'error').length,
        results,
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
