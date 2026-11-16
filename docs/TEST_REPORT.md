# Test Hisoboti — Elektron Amaliyot Kundaligi

**Sana:** 2026-yil 29-oktabr  
**Test muhiti:** Windows 11, Node.js 20, PostgreSQL 15 (localhost)  
**Test skriptlari:** `server/scripts/test-*.ts` (ts-node bilan ishga tushirildi)

---

## 1. Yakuniy Natijalar

```
╔═══════════════════════════════════════════════════════════════╗
║  Jami testlar: 111 ta                                         ║
║  ✅ PASS:      111 ta  (100%)                                 ║
║  ❌ FAIL:        0 ta                                         ║
║  ⏭️  SKIP:        0 ta                                         ║
╚═══════════════════════════════════════════════════════════════╝
```

---

## 2. Modul bo'yicha Natijalari

### 2.1 Autentifikatsiya Testlari (`test-auth.ts`)

| # | Test nomi | Natija |
|---|-----------|--------|
| 1 | Mavjud bo'lmagan email bilan login qilishga urinish | ✅ PASS |
| 2 | Noto'g'ri parol bilan login | ✅ PASS |
| 3 | STUDENT sifatida muvaffaqiyatli login | ✅ PASS |
| 4 | `/api/auth/me` — cookie bilan joriy foydalanuvchi | ✅ PASS |
| 5 | `/api/auth/me` — cookie siz (401) | ✅ PASS |
| 6 | COMPANY_SUPERVISOR sifatida login | ✅ PASS |
| 7 | UNIVERSITY_SUPERVISOR sifatida login | ✅ PASS |
| 8 | ADMIN sifatida login | ✅ PASS |
| 9 | Logout va cookie o'chirilishi | ✅ PASS |
| 10 | Logout keyin `/api/auth/me` 401 qaytarishi | ✅ PASS |

**Jami: 10/10 ✅**

---

### 2.2 Kundalik Oqimi Testlari (`test-diary-flow.ts`)

| # | Test nomi | Natija |
|---|-----------|--------|
| 1 | STUDENT yangi kundalik yaratadi (DRAFT) | ✅ PASS |
| 2 | DRAFT kundalik rahbarga ko'rinmasligi | ✅ PASS |
| 3 | DRAFT kundalikni tahrirlash | ✅ PASS |
| 4 | Kundalikni topshirish (DRAFT → SUBMITTED) | ✅ PASS |
| 5 | SUBMITTED kundalik rahbarga ko'rinishi | ✅ PASS |
| 6 | Rahbar kundalikni qaytaradi (RETURNED) | ✅ PASS |
| 7 | Talaba izohni ko'radi va qayta tahrirlaydi | ✅ PASS |
| 8 | Rahbar tasdiqlaydi (APPROVED) — o'zgartirish mumkin emas | ✅ PASS |

**Jami: 8/8 ✅**

---

### 2.3 Davomat Testlari (`test-attendance.ts`)

| # | Test nomi | Natija |
|---|-----------|--------|
| 1 | COMPANY_SUPERVISOR davomat belgilaydi | ✅ PASS |
| 2 | Bir kunda ikkinchi urinish upsert qiladi | ✅ PASS |
| 3 | STUDENT davomat belgilay olmaydi (403) | ✅ PASS |
| 4 | UNIVERSITY_SUPERVISOR davomat belgilay olmaydi (403) | ✅ PASS |
| 5 | Davomat ro'yxati olish (RBAC filterlangan) | ✅ PASS |
| 6 | Boshqa talabaning davomatini ko'rish (IDOR: 403) | ✅ PASS |
| 7 | Statistika: jami, kelgan, kelmagan, kechikkan | ✅ PASS |
| 8 | Statistika: davomat foizi hisoblash | ✅ PASS |
| 9 | Sana oralig'i bo'yicha filtrlash | ✅ PASS |
| 10 | Noto'g'ri sana formati (400) | ✅ PASS |
| 11 | Autentifikatsiyasiz so'rov (401) | ✅ PASS |

**Jami: 11/11 ✅**

---

### 2.4 Baholash Testlari (`test-evaluation.ts`)

| # | Test nomi | Natija |
|---|-----------|--------|
| 1 | Baholash mezonlarini olish | ✅ PASS |
| 2 | COMPANY_SUPERVISOR baholash kiritadi | ✅ PASS |
| 3 | Ikkinchi marta kiritishda upsert bo'ladi | ✅ PASS |
| 4 | UNIVERSITY_SUPERVISOR baholash kiritadi | ✅ PASS |
| 5 | STUDENT baholash kirita olmaydi (403) | ✅ PASS |
| 6 | O'z amaliyotiga tegishli emas — 403 | ✅ PASS |
| 7 | Ikkala rahbar SUBMITTED — yakuniy ball hisoblanadi | ✅ PASS |
| 8 | Yakuniy ball 100 dan oshmasligi | ✅ PASS |
| 9-16 | Validatsiya testlari (noto'g'ri ball, noto'g'ri mezon) | ✅ PASS |

**Jami: 16/16 ✅**

---

### 2.5 Fayl Biriktirish Testlari (`test-attachments.ts`)

| # | Test nomi | Natija |
|---|-----------|--------|
| 1 | PDF fayl yuklash (DRAFT holatda) | ✅ PASS |
| 2 | JPG fayl yuklash | ✅ PASS |
| 3 | PNG fayl yuklash | ✅ PASS |
| 4 | DOCX fayl yuklash | ✅ PASS |
| 5 | XLSX fayl yuklash | ✅ PASS |
| 6 | 10 MB dan katta fayl (413/400) | ✅ PASS |
| 7 | Noto'g'ri format (MP4) — 400 | ✅ PASS |
| 8 | Magic-bytes tekshiruvi — soxta PDF (400) | ✅ PASS |
| 9 | SUBMITTED holatda yuklash (403) | ✅ PASS |
| 10 | APPROVED holatda yuklash (403) | ✅ PASS |
| 11 | Fayllar ro'yxatini olish | ✅ PASS |
| 12 | Faylni yuklab olish (autentifikatsiya bilan) | ✅ PASS |
| 13 | Autentifikatsiyasiz yuklab olish (401) | ✅ PASS |
| 14 | Boshqa talabaning faylini yuklab olish (403/404) | ✅ PASS |
| 15 | Faylni o'chirish (DRAFT holatda) | ✅ PASS |
| 16 | O'chirilgan fayl qayta topilmaydi (404) | ✅ PASS |
| 17 | Disk da yo'q fayl — server yiqilmaydi (404) | ✅ PASS |
| 18 | Path traversal urinishi (`../../etc/passwd`) — 400 | ✅ PASS |
| 19-25 | RBAC va edge-case testlari | ✅ PASS |

**Jami: 25/25 ✅**

---

### 2.6 Hisobot Eksport Testlari (`test-reports-export.ts`)

| # | Test nomi | Natija |
|---|-----------|--------|
| 1 | Kundalik hisoboti — Excel olish | ✅ PASS |
| 2 | Kundalik hisoboti — PDF olish | ✅ PASS |
| 3 | Excel fayl to'g'ri format (xlsx) | ✅ PASS |
| 4 | PDF fayl to'g'ri format | ✅ PASS |
| 5 | Sana oralig'i bo'yicha filtrlash | ✅ PASS |
| 6 | Status bo'yicha filtrlash | ✅ PASS |
| 7 | Davomat hisoboti — Excel | ✅ PASS |
| 8 | Davomat hisoboti — PDF | ✅ PASS |
| 9 | Statistikalar to'g'ri hisoblanishi | ✅ PASS |
| 10 | Yakuniy baholash sertifikati — Excel | ✅ PASS |
| 11 | Yakuniy baholash sertifikati — PDF | ✅ PASS |
| 12 | Boshqa talabaning hisobotini ko'rish (403) | ✅ PASS |
| 13-19 | RBAC va edge-case testlari | ✅ PASS |

**Jami: 19/19 ✅**

---

### 2.7 Telegram Bot Testlari (`test-telegram.ts`)

| # | Test nomi | Natija |
|---|-----------|--------|
| 1 | Telegram holat so'rovi (bog'lanmagan) | ✅ PASS |
| 2 | Bog'lash kodi yaratish | ✅ PASS |
| 3 | Kod 10 daqiqa muddat bilan | ✅ PASS |
| 4 | Muddati o'tgan kod qayta ishlatib bo'lmaydi | ✅ PASS |
| 5 | 3 ta noto'g'ri urinishdan so'ng bloklanadi | ✅ PASS |
| 6 | SHA-256 hash tekshiruvi | ✅ PASS |
| 7 | Telegram akkauntni ajratish (unlink) | ✅ PASS |
| 8 | Bildirishnoma: kundalik topshirildi | ✅ PASS |
| 9 | Bildirishnoma: kundalik tasdiqlandi | ✅ PASS |
| 10 | Bildirishnoma: kundalik qaytarildi | ✅ PASS |
| 11 | Bog'lanmagan foydalanuvchi → SKIPPED_NO_TG | ✅ PASS |
| 12 | Idempotentlik: bir bildirishnoma bir marta | ✅ PASS |
| 13 | Telegram API xatosi → HTTP oqim davom etadi | ✅ PASS |
| 14-22 | Edge cases va xavfsizlik testlari | ✅ PASS |

**Jami: 22/22 ✅**

---

## 3. Build Natijalari

```
Server TypeScript check (tsc --noEmit):
  ✅ 0 xato, 0 ogohlantirish

Server build (tsc):
  ✅ Muvaffaqiyatli → dist/ papkasi

Client build (tsc && vite build):
  ✅ 1598 modul qayta ishlandi
  ✅ dist/assets/ papkasiga chiqarildi
  ✅ CSS va JS bundle'lar muvaffaqiyatli
```

---

## 4. Ma'lum Cheklovlar

> [!NOTE]
> Quyidagi punktlar tizim nuqsoni emas, balki test doirasining chegarasi:

| Cheklov | Sabab | Xavf darajasi |
|---------|-------|---------------|
| Haqiqiy Telegram bot test qilinmadi | `.env`da placeholder token | Past — bot arxitekturasi tekshirildi |
| Frontend E2E (browser) test yo'q | Playwright/Cypress o'rnatilmagan | O'rta — manual test qilingan |
| Fayl saqlash: local disk | Cloud storage yo'q | O'rta — production uchun GCS tavsiya |
| Load testing o'tkazilmadi | k6/artillery yo'q | Past — diplom loyihasi uchun zarur emas |

---

## 5. Xulosa

Barcha **111 ta test muvaffaqiyatli o'tdi**. Server va client build'lari xatosiz tugadi.
Tizim diplom himoyasiga tayyordir.
