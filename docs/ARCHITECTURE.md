# Tizim Arxitekturasi

## 1. Umumiy Ko'rinish

```
┌──────────────────────────────────────────────────────────────────────┐
│                         BROWSER (React SPA)                          │
│  React 18 · TypeScript · Vite 5 · Tailwind CSS · React Router v6    │
└──────────────────────────────┬───────────────────────────────────────┘
                               │  HTTP/REST (JSON) + httpOnly Cookie
                               │  Port: 5173 (dev) / nginx (prod)
┌──────────────────────────────▼───────────────────────────────────────┐
│                     EXPRESS API SERVER                               │
│  Node.js · Express 4 · TypeScript · JWT Auth · RBAC Middleware      │
│  Port: 3001                                                          │
│                                                                      │
│  ┌────────────┐ ┌──────────┐ ┌────────────┐ ┌──────────────────┐   │
│  │  Auth      │ │  Diary   │ │ Attendance │ │   Evaluation     │   │
│  │  Routes    │ │  Routes  │ │  Routes    │ │   Routes         │   │
│  └────────────┘ └──────────┘ └────────────┘ └──────────────────┘   │
│  ┌────────────┐ ┌──────────┐ ┌────────────┐ ┌──────────────────┐   │
│  │Attachments │ │  Reports │ │  Telegram  │ │   Users/Admin    │   │
│  │  Routes    │ │  Routes  │ │  Routes    │ │   Routes         │   │
│  └────────────┘ └──────────┘ └────────────┘ └──────────────────┘   │
└──────────┬──────────────────────────────────────────┬───────────────┘
           │  Prisma 5 ORM                            │  grammY (long-poll)
┌──────────▼────────────────┐             ┌───────────▼───────────────┐
│   PostgreSQL 15 Database  │             │    Telegram Bot API        │
│   Database: internship_   │             │    Bot: @amaliyot_         │
│   diary                   │             │    kundaligibot            │
│   13 modell               │             │                           │
└───────────────────────────┘             └───────────────────────────┘
           │
┌──────────▼────────────────┐
│   Local File Storage      │
│   server/uploads/         │
│   (multer disk storage)   │
└───────────────────────────┘
```

## 2. Frontend Arxitekturasi

### Katalog tuzilmasi
```
client/src/
├── components/           # Qayta ishlatiladigan UI komponentlar
│   ├── AttachmentSection.tsx  # Fayl biriktirish bloki
│   ├── ProtectedRoute.tsx     # Auth himoyasi
│   └── Layout.tsx             # Umumiy tartib
├── pages/               # Sahifalar (route bo'yicha)
│   ├── LoginPage.tsx
│   ├── DiaryPage.tsx         # Kundaliklar ro'yxati
│   ├── DiaryFormPage.tsx     # Kundalik yaratish/tahrirlash
│   ├── AttendancePage.tsx    # Davomat
│   ├── EvaluationPage.tsx    # Baholash
│   ├── ReportsPage.tsx       # Hisobotlar
│   └── ProfilePage.tsx       # Profil + Telegram bog'lash
├── context/
│   └── AuthContext.tsx       # Global auth holati
├── api/
│   └── axios.ts              # Axios instance (baseURL, interceptors)
├── types/               # TypeScript turlar
└── App.tsx              # Router va Layout
```

### Routing (React Router v6)
```
/login                  — Tizimga kirish (ochiq)
/                       — Dashboard (himoyalangan)
/diary                  — Kundaliklar ro'yxati
/diary/new              — Yangi kundalik
/diary/:id              — Kundalikni ko'rish/tahrirlash
/attendance             — Davomat
/evaluation             — Baholash
/reports                — Hisobotlar
/profile                — Profil + Telegram
/admin/*                — Admin paneli (faqat ADMIN)
```

### Auth oqimi (Frontend)
```
LoginPage → POST /api/auth/login
         ← httpOnly cookie (JWT) + { user }
         → AuthContext.user yangilanadi
         → /  (dashboard) ga redirect
```

## 3. Backend Arxitekturasi

### Katalog tuzilmasi
```
server/src/
├── routes/              # Express routerlar
│   ├── index.ts         # Barcha routerlarni birlashtiradi
│   ├── auth.ts
│   ├── diary.ts
│   ├── diaryAttachments.ts
│   ├── attendance.ts
│   ├── evaluation.ts
│   ├── reports.ts
│   ├── telegram.ts
│   ├── users.ts
│   ├── internships.ts
│   ├── dashboard.ts
│   └── health.ts
├── middleware/
│   ├── auth.ts          # JWT verifikatsiya
│   └── requireRole.ts   # RBAC tekshiruvi
├── services/
│   ├── telegramBot.ts   # grammY bot instance
│   └── notificationService.ts  # Bildirishnoma mantiq
├── lib/
│   └── prisma.ts        # Prisma singleton
└── index.ts             # Express app bootstrap
```

### Middleware zanjiri
```
Request
  → CORS middleware
  → cookie-parser
  → express.json()
  → authenticate (JWT verify from cookie)
  → requireRole([...roles])  (agar kerak bo'lsa)
  → Route Handler
  → Prisma DB query
  → Response
```

### Fayl saqlash oqimi
```
POST /api/diary/:entryId/attachments
  → multer (memStorage) → MIME check (magic-bytes)
  → rename to unique filename
  → write to server/uploads/
  → DiaryAttachment record in DB
```

## 4. Ma'lumotlar Oqimi — Kundalik Holat Mashinasi

```
     TALABA                RAHBAR               TIZIM
        │                     │                    │
        │── Kundalik yaratadi ──►                  │
        │   (DRAFT)            │                   │
        │                     │                   │
        │── Submit ───────────────────────────────►│
        │   (SUBMITTED)        │◄── Bildirishnoma ─│
        │                     │                   │
        │              Tasdiqlaydi                 │
        │◄─ (APPROVED) ───────────────────────────►│
        │                                 ◄── Bildirishnoma
        │
        │   YOKI
        │              Qaytaradi (izoh bilan)
        │◄─ (RETURNED) ───────────────────────────►│
        │                                 ◄── Bildirishnoma
        │── Tahrirlaydi va qayta submit ──────────►│
```

## 5. Xavfsizlik Arxitekturasi

| Qatlam | Mexanizm |
|--------|---------|
| Autentifikatsiya | JWT, httpOnly cookie, `SameSite=Lax` |
| Avtorizatsiya | RBAC middleware (role-based) |
| Fayl validatsiya | Magic-bytes (haqiqiy format), MIME whitelist, 10MB limit |
| Fayl xavfsizligi | UUID nom, `path.basename()` orqali traversal himoya |
| Fayl yuklab olish | Faqat auth cookie bilan, to'g'ridan-to'g'ri URL yo'q |
| IDOR himoya | Prisma queryda `internshipId` + owner tekshiruvi |
| Telegram xavfsizlik | SHA-256 hash, 10 daqiqa muddati, 3 urinish limiti |
| Token maxfiyligi | `.env`da, loglarda ko'rinmaydi, frontendga bormaydi |

## 6. Muhit Sozlamalari

### server/.env.example
```env
DATABASE_URL=postgresql://user:password@localhost:5432/internship_diary
JWT_SECRET=your_super_secret_jwt_key_here
JWT_EXPIRES_IN=7d
PORT=3001
NODE_ENV=development
CLIENT_URL=http://localhost:5173
UPLOAD_DIR=./uploads
MAX_FILE_SIZE_MB=10
TELEGRAM_BOT_TOKEN=YOUR_BOT_TOKEN_HERE
TELEGRAM_BOT_USERNAME=amaliyot_kundaligibot
```

## 7. Production Deployment (Tavsiya etilgan)

```
Client (React)  →  nginx (static files + reverse proxy)
                      │
                      ▼
Server (Node)   →  PM2 process manager (cluster mode)
                      │
                      ▼
Database        →  PostgreSQL (managed, e.g. Cloud SQL)
                      │
                      ▼
Files           →  Cloud Storage (e.g. Google Cloud Storage)
                   (hozircha: local disk)
```
