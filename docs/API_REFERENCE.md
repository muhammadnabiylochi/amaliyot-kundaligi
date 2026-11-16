# API Reference

**Base URL**: `http://localhost:3001/api`  
**Autentifikatsiya**: httpOnly Cookie (`token=<JWT>`)  
**Javob formati**: JSON `{ data }` yoki `{ error: { message, status } }`

---

## Autentifikatsiya

### POST /api/auth/login
Tizimga kirish.

**Body:**
```json
{ "email": "user@example.com", "password": "password123" }
```
**Javob (200):**
```json
{
  "token": "<jwt>",
  "user": {
    "id": "...", "fullName": "...", "email": "...", "role": "STUDENT"
  }
}
```
**Xatolar:** 400 (validation), 401 (wrong credentials), 429 (rate limit — 15 min, max 15 urinish)

---

### GET /api/auth/me
Joriy foydalanuvchi ma'lumotlari. `authenticate` talab qilinadi.

**Javob (200):** `{ user: { id, fullName, email, role, studentProfile? } }`

---

### POST /api/auth/logout
Cookieni o'chiradi.

**Javob (200):** `{ message: "Tizimdan chiqildi" }`

---

## Kundalik (Diary)

> **Ruxsatlar:** `STUDENT` — o'z yozuvlari; Rahbarlar — `SUBMITTED/APPROVED` yozuvlar; `ADMIN` — hammasi

### GET /api/diary
Kundaliklar ro'yxati (RBAC asosida filterlangan).

**Query params:** `status`, `startDate`, `endDate`, `internshipId`, `page`, `limit`

**Javob (200):**
```json
{
  "entries": [
    {
      "id": "...", "entryDate": "2026-10-01", "taskTitle": "...",
      "description": "...", "result": "...", "hoursWorked": 8,
      "status": "DRAFT", "internshipId": "...",
      "attachments": [], "reviews": []
    }
  ],
  "total": 25, "page": 1, "limit": 10
}
```

---

### POST /api/diary
Yangi kundalik yaratish. Rol: `STUDENT`.

**Body:**
```json
{
  "internshipId": "...",
  "entryDate": "2026-10-29",
  "taskTitle": "Frontend ishlar",
  "description": "...",
  "result": "...",
  "hoursWorked": 8
}
```
**Javob (201):** `{ entry: { id, ... } }`  
**Xatolar:** 400 (validation), 409 (bu sana uchun yozuv mavjud)

---

### GET /api/diary/:id
Bitta kundalik. Owner yoki supervisor.

**Javob (200):** `{ entry: { ...fields, attachments: [], reviews: [] } }`

---

### PUT /api/diary/:id
Yangilash. Faqat `DRAFT` yoki `RETURNED` holatlarda.

**Body:** `{ taskTitle?, description?, result?, hoursWorked? }`  
**Xatolar:** 400 (SUBMITTED/APPROVED holatlarda o'zgartirish mumkin emas)

---

### DELETE /api/diary/:id
O'chirish. Faqat `DRAFT` holatda.

**Javob (200):** `{ message: "..." }`

---

### POST /api/diary/:id/submit
Kundalikni topshirish (DRAFT → SUBMITTED). Rol: `STUDENT`.

**Javob (200):** `{ entry: { ...updated } }`

---

### POST /api/diary/:id/review
Tasdiqlash yoki qaytarish. Rol: `COMPANY_SUPERVISOR | UNIVERSITY_SUPERVISOR`.

**Body:**
```json
{ "decision": "APPROVED", "comment": "Yaxshi!" }
```
**Javob (200):** `{ entry: { status: "APPROVED", ... } }`  
**Xatolar:** 400 (faqat SUBMITTED holatlarda), 403 (talaba o'zini approve qila olmaydi)

---

## Fayl Biriktirish (Attachments)

### POST /api/diary/:entryId/attachments
Fayl yuklash. Rol: `STUDENT`. Faqat `DRAFT | RETURNED`.

**Content-Type:** `multipart/form-data`  
**Field:** `file` (bir yoki bir nechta)  
**Ruxsat etilgan formatlar:** PDF, JPG, JPEG, PNG, DOCX, XLSX  
**Limit:** 10 MB / fayl

**Javob (201):**
```json
{
  "attachments": [
    {
      "id": "...", "originalName": "hisobot.pdf",
      "mimeType": "application/pdf", "sizeBytes": "204800",
      "createdAt": "..."
    }
  ]
}
```
**Xatolar:** 400 (noto'g'ri format yoki hajm), 403 (SUBMITTED/APPROVED holatlarda)

---

### GET /api/diary/:entryId/attachments
Kundalik fayllar ro'yxati.

**Javob (200):** `{ attachments: [...] }`

---

### GET /api/diary/attachments/:id/download
Faylni yuklab olish. Cookie autentifikatsiyasi talab qilinadi.

**Javob (200):** Fayl stream (`Content-Disposition: attachment`)  
**Xatolar:** 404 (disk yoki DB da yo'q), 403 (boshqa talabaning fayli)

---

### DELETE /api/diary/attachments/:id
Faylni o'chirish. Faqat `DRAFT | RETURNED` holatlarda. Diskdan va DBdan o'chiriladi.

**Javob (200):** `{ message: "..." }`

---

## Davomat (Attendance)

### GET /api/attendance
Davomat yozuvlari. RBAC asosida filterlangan.

**Query:** `internshipId`, `startDate`, `endDate`

---

### POST /api/attendance
Davomat belgilash/yangilash (upsert). Rol: `COMPANY_SUPERVISOR`.

**Body:**
```json
{
  "internshipId": "...",
  "attendanceDate": "2026-10-29",
  "status": "PRESENT",
  "hours": 8,
  "note": null
}
```
**Javob (200/201):** `{ attendance: { ... } }`

---

### GET /api/attendance/stats
Davomat statistikasi.

**Query:** `internshipId` (talab)

**Javob (200):**
```json
{
  "total": 22, "present": 18, "absent": 2,
  "late": 1, "excused": 1,
  "attendancePercent": 81.8,
  "totalHours": 144
}
```

---

## Yakuniy Baholash (Evaluation)

### GET /api/evaluation/criteria
Baholash mezonlari ro'yxati.

**Javob (200):**
```json
{
  "criteria": [
    { "key": "technical_skills", "label": "Texnik ko'nikmalar", "maxScore": 30 },
    { "key": "communication", "label": "Muloqot va hamkorlik", "maxScore": 20 },
    ...
  ],
  "totalMaxScore": 100
}
```

---

### POST /api/evaluation/:internshipId
Baholash kiritish/yangilash. Rol: `COMPANY_SUPERVISOR | UNIVERSITY_SUPERVISOR`.

**Body:**
```json
{
  "criteriaScores": [
    { "criterionKey": "technical_skills", "score": 25, "comment": "..." }
  ],
  "generalComment": "...",
  "status": "SUBMITTED"
}
```

---

### GET /api/evaluation/:internshipId
Amaliyot baholash ma'lumotlari. Ikkala rahbarning natijasi + yakuniy ball.

**Javob (200):**
```json
{
  "evaluations": [...],
  "finalScore": 87.5,
  "isComplete": true
}
```

---

### GET /api/evaluation
Barcha baholashlar ro'yxati. RBAC asosida.

---

## Hisobotlar (Reports)

### GET /api/reports/diary/excel
Kundalik hisoboti Excel formatida.

**Query:** `internshipId` (talab), `startDate?`, `endDate?`, `status?`  
**Javob:** `.xlsx` fayl stream

---

### GET /api/reports/diary/pdf
Kundalik hisoboti PDF formatida.

**Javob:** `.pdf` fayl stream

---

### GET /api/reports/attendance/excel
Davomat hisoboti Excel formatida.

**Query:** `internshipId` (talab), `startDate?`, `endDate?`  
**Javob:** `.xlsx` fayl stream

---

### GET /api/reports/attendance/pdf
Davomat hisoboti PDF formatida.

---

### GET /api/reports/evaluation/excel
Yakuniy baholash sertifikati Excel formatida.

**Query:** `internshipId` (talab)

---

### GET /api/reports/evaluation/pdf
Yakuniy baholash sertifikati PDF formatida.

---

## Telegram Bot

### GET /api/telegram/status
Telegram bog'lanish holati.

**Javob (200):**
```json
{
  "linked": true,
  "username": "jasur_aliev",
  "linkedAt": "2026-10-29T..."
}
```

---

### POST /api/telegram/generate-link-code
Yangi bog'lash kodi yaratish.

**Javob (200):**
```json
{
  "linkCode": "abc123",
  "expiresAt": "2026-10-29T12:10:00.000Z",
  "botUsername": "amaliyot_kundaligibot",
  "deepLink": "https://t.me/amaliyot_kundaligibot?start=abc123"
}
```

---

### POST /api/telegram/unlink
Telegram akkauntni ajratish.

**Javob (200):** `{ message: "Telegram akkaunt ajratildi" }`

---

## Boshqa

### GET /api/health
Tizim holati.

**Javob (200):**
```json
{
  "status": "ok",
  "db": "connected",
  "timestamp": "...",
  "uptime": 3600
}
```

### GET /api/dashboard
Dashboard statistikasi (RBAC asosida).

---

## Xato Formatlari

```json
// 400 Bad Request
{ "error": { "message": "...", "status": 400 } }

// 401 Unauthorized
{ "error": { "message": "Autentifikatsiya talab qilinadi", "status": 401 } }

// 403 Forbidden
{ "error": { "message": "Ruxsat yo'q", "status": 403 } }

// 404 Not Found
{ "error": { "message": "Topilmadi", "status": 404 } }

// 409 Conflict
{ "error": { "message": "Bu sana uchun yozuv allaqachon mavjud", "status": 409 } }

// 500 Internal Server Error
{ "error": { "message": "Server xatosi", "status": 500 } }
```
