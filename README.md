# Internship Diary — Elektron Amaliyot Kundaligi

A production-minded web application for managing and monitoring university students' internships.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, Vite 5 |
| UI | Tailwind CSS v3, shadcn/ui, Lucide icons |
| Routing | React Router v6 |
| Backend | Node.js, Express 4, TypeScript |
| Database | PostgreSQL 15+ |
| ORM | Prisma 5 |
| Validation | Zod |
| Bot (later) | grammY |

## Project Structure

```
internship-diary/
├── client/               # React + Vite frontend
│   ├── src/
│   │   ├── components/   # Reusable UI components
│   │   ├── pages/        # Route pages
│   │   ├── lib/          # Utilities / API client
│   │   └── main.tsx
│   ├── index.html
│   ├── vite.config.ts
│   └── package.json
├── server/               # Express API
│   ├── src/
│   │   ├── routes/       # Express routers
│   │   ├── middleware/   # Custom middleware
│   │   └── index.ts      # App entry point
│   ├── prisma/
│   │   └── schema.prisma
│   └── package.json
├── .gitignore
└── README.md
```

## Prerequisites

- **Node.js v20 LTS** — https://nodejs.org/en/download  
  *(Download the Windows Installer, run it, then restart your terminal)*
- **PostgreSQL 15+** — https://www.postgresql.org/download/windows/
- **Git** (already installed)

## Quick Start

### 1. Clone / open the project

```powershell
cd <project-directory> # masalan: cd path/to/internship-diary
```

### 2. Configure environment variables

> [!CAUTION]
> **Security Note:** Never commit `.env` files to Git or any version control system! `.env` files contain sensitive secrets, database credentials, JWT secrets, and Telegram bot tokens. Ensure `.env` and `server/.env` are always excluded via `.gitignore` and only `.env.example` templates with generic placeholders are tracked.

```powershell
# Server
copy server\.env.example server\.env
# Client
copy client\.env.example client\.env
```

Edit `server\.env` and fill in your PostgreSQL credentials:

```
DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5432/internship_diary"
PORT=3001
NODE_ENV=development
```

### 3. Set up the database

Make sure PostgreSQL is running and the database exists (e.g. `CREATE DATABASE internship_diary;` in psql/pgAdmin).

```powershell
cd server
npm install

# Apply database migration (never use reset or delete)
npx prisma migrate deploy
# Or for interactive development migration:
# npx prisma migrate dev

# Generate Prisma Client
npx prisma generate

# (Optional) Seed development data (fictional accounts and sample diary entries)
npm run prisma:seed
```

### 4. Start the backend

```powershell
# Inside server/
npm run dev
# → http://localhost:3001
# → http://localhost:3001/api/health
```

### 5. Start the frontend

```powershell
# In a new terminal, inside client/
cd ..\client
npm install
npm run dev
# → http://localhost:5173
```

## Available Scripts

### Server (`server/`)

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server with ts-node-dev (hot reload) |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Run compiled production build |
| `npm run typecheck` | Run `tsc --noEmit` |
| `npm run lint` | ESLint check |

### Client (`client/`)

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Preview production build |
| `npm run typecheck` | Run `tsc --noEmit` |
| `npm run lint` | ESLint check |

## Environment Variables

See `server/.env.example` and `client/.env.example` for all required variables.

## Shadcn/ui Components

After running `npm install` in `client/`, add components with:

```powershell
npx shadcn@latest add button
npx shadcn@latest add card
# etc.
```

## API Documentation

### Fayl biriktirish (Diary Attachments API)

| Metod | Endpoint | Ruxsat (Rollar) | Tavsif |
|-------|----------|-----------------|--------|
| `POST` | `/api/diary/:entryId/attachments` | Talaba (kundalik egasi) | Kundalikka bir yoki bir nechta fayl yuklash (multipart/form-data, max 10MB, PDF/JPG/PNG/DOCX/XLSX). Faqat `DRAFT` va `RETURNED` holatda ruxsat beriladi. |
| `GET` | `/api/diary/:entryId/attachments` | Talaba, Korxona rahbari, Universitet rahbari, Admin | Kundalikka biriktirilgan fayllar ro'yxatini olish. |
| `GET` | `/api/diary/attachments/:attachmentId` | Talaba, Korxona rahbari, Universitet rahbari, Admin | Faylni stream orqali xavfsiz yuklab olish. To'g'ridan-to'g'ri ochiq statik havola yo'q. |
| `DELETE` | `/api/diary/attachments/:attachmentId` | Talaba (kundalik egasi), Admin | Biriktirilgan faylni o'chirish. Faqat `DRAFT` va `RETURNED` holatdagi kundaliklar uchun ruxsat etiladi. |

### Hisobotlarni eksport qilish (Reports Export API)

| Metod | Endpoint | Ruxsat | Format | Tavsif |
|-------|----------|--------|--------|--------|
| `GET` | `/api/reports/diary/pdf` | Talaba, Rahbar, Admin | PDF | Kundalik hisobotini A4 PDF formatda eksport qilish (status, sana, filtrlar bilan) |
| `GET` | `/api/reports/diary/excel` | Talaba, Rahbar, Admin | Excel (.xlsx) | Kundalik hisobotini Excel formatda eksport qilish (summa formulalari va sarlavhalar bilan) |
| `GET` | `/api/reports/attendance/pdf` | Talaba, Rahbar, Admin | PDF | Davomat kalendari va statistikasi (kelgan, kechikkan, foiz) PDF hisoboti |
| `GET` | `/api/reports/attendance/excel` | Talaba, Rahbar, Admin | Excel (.xlsx) | Davomat jadvallari va KPI ko'rsatkichlari Excel hisoboti |
| `GET` | `/api/reports/evaluation/:internshipId/pdf` | Talaba, Rahbar, Admin | PDF | Yakuniy baholash (5 ta mezon, rahbarlar ballari, o'rtacha ball) rasmiy PDF hisoboti |
| `GET` | `/api/reports/evaluation/:internshipId/excel` | Talaba, Rahbar, Admin | Excel (.xlsx) | Yakuniy baholash tafsilotlari Excel jadvali |

#### Xavfsizlik choralari:
- **Magic Bytes Signature Tekshiruvi:** Fayl faqat kengaytmasi bo'yicha emas, balki haqiqiy baytlari (magic numbers) bo'yicha tekshiriladi (PDF `%PDF`, PNG `\x89PNG`, JPG `\xFF\xD8\xFF`, DOCX/XLSX `PK\x03\x04`).
- **Path Traversal himoyasi:** Har bir fayl UUID asosidagi tasodifiy nom bilan server papkasiga saqlanadi.
- **Ruxsatsiz kirishdan himoya:** Barcha fayllarga kirish `Bearer` token orqali tekshiriladi va begona foydalanuvchilar (boshqa talabalar) `403 Forbidden` oladi.
- **Graceful Error Handling:** Fayl ma'lumotlar bazasida mavjud bo'lib, diskda yo'q bo'lsa server yiqilmaydi va tushunarli `410 Gone` xatosi qaytariladi.
- **O'zbek lotin shriftlari:** PDF hisobotlarida to'liq Unicode va O'zbek lotin harflari (`o‘`, `g‘`, `sh`, `ch`) to'g'ri chop etilishi ta'minlangan.

## Key Modules Implemented

- ✅ **Authentication & RBAC:** JWT, Cookie, Admin / Student / Company Supervisor / University Supervisor rollari.
- ✅ **Elektron Kundalik (Diary):** DRAFT, SUBMITTED, RETURNED, APPROVED davriy holatlar boshqaruvi.
- ✅ **Davomat Kalendari (Attendance):** Oylik kalendar, holatlar (PRESENT, ABSENT, LATE, EXCUSED), ishlangan soatlar va statistika.
- ✅ **Yakuniy Baholash (Evaluation):** 5 ta mezon (100 ball), korxona va universitet rahbarlari alohida baholashi, o'rtacha ball avto-hisobi.
- ✅ **Fayl biriktirish (Attachments):** Kundalikka dalil fayllari biriktirish, ko'rish, yuklab olish va xavfsiz o'chirish.
- ✅ **Hisobotlarni Eksport qilish (Reports Export):** Kundalik, davomat va yakuniy baholash bo'yicha professional PDF va Excel eksportlari.
- ✅ **Telegram Bot Integratsiyasi (@amaliyot_kundaligibot):** Profil orqali xavfsiz 1 martalik kod bilan bog'lash, buyruqlar (`/start`, `/status`, `/unlink`, `/help`), kundalik topshirish/qaytarish/tasdiqlash, davomat va yakuniy baholash bo'yicha tezkor bildirishnomalar, idempotent yuborish.

---

### Telegram Bot Integratsiyasi (@amaliyot_kundaligibot)

Tizimga rasmiy [@amaliyot_kundaligibot](https://t.me/amaliyot_kundaligibot) boti to'liq integratsiya qilingan.

#### Sozlamalar (`server/.env`):
```env
# Telegram Bot
TELEGRAM_BOT_TOKEN="BU_YERGA_YANGILANGAN_BOT_TOKENINI_KIRITAMAN"
TELEGRAM_BOT_USERNAME="amaliyot_kundaligibot"
CLIENT_URL="http://localhost:5173"
```

#### Bot Buyruqlari:
- `/start` — Botni ishga tushirish, xush kelibsiz xabari va deep-link orqali bog'lash (`/start <code>`).
- `/status` — Foydalanuvchi hisobi bog'langanligi, ism-sharif, rol va bog'langan vaqtni ko'rsatish.
- `/unlink` — Telegram akkauntini web-ilovadagi profildan xavfsiz uzish.
- `/help` — Buyruqlar ro'yxati va yo'riqnoma.

#### REST API Endpointlari:
| Metod | Endpoint | Ruxsat | Tavsif |
|-------|----------|--------|--------|
| `GET` | `/api/telegram/status` | Autentifikatsiyadan o'tgan foydalanuvchi | Foydalanuvchining Telegram ulanish holatini qaytaradi. |
| `POST` | `/api/telegram/generate-link-code` | Autentifikatsiyadan o'tgan foydalanuvchi | 10 daqiqa amal qiluvchi 6 xonali bir martalik kod yaratadi (SHA-256 xeshlanadi). |
| `POST` | `/api/telegram/unlink` | Autentifikatsiyadan o'tgan foydalanuvchi | Telegram akkauntini foydalanuvchi hisobidan uzadi. |

#### Avtomatik Bildirishnomalar:
1. **Kundalik topshirilganda (`SUBMITTED`):** Talabaga topshirilgani haqida xabar, biriktirilgan korxona va universitet rahbarlariga ko'rib chiqish havolasi bilan xabar.
2. **Kundalik qaytarilganda (`RETURNED`):** Talabaga kamchiliklar va rahbarning izohi bilan xabar.
3. **Kundalik tasdiqlanganda (`APPROVED`):** Talabaga muvaffaqiyatli tasdiqlangani haqida xabar.
4. **Davomat qayd etilganda (`ATTENDANCE_RECORDED`):** Talabaga sana, holat (Kelgan, Kechikkan, Uzrli) va ishlangan soat haqida xabar.
5. **Yakuniy baholash yakunlanganda (`EVALUATION_COMPLETED`):** Har ikki rahbar bahosi topshirilgach, talabaga yakuniy ball haqida xabar.
6. **Idempotency & Ishonchlilik:** Har bir xabar `NotificationLog` orqali tekshiriladi, dublikatlar qayta yuborilmaydi; Telegram API yoki tarmoq xatolari asosiy HTTP operatsiyalarini to'xtatmaydi.

---

## Security

- **Environment Secrets:** Never commit `.env` files. The repository `.gitignore` explicitly ignores `.env`, `server/.env`, and related local environment configurations.
- **Access Tokens & Credentials:** Database credentials, JWT secrets, and Telegram bot tokens must remain in untracked `.env` files only. Never push them to version control. Always maintain `.env.example` templates with generic placeholders.

