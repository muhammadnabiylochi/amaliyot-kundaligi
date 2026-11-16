# Elektron Amaliyot Kundaligi — Loyiha Sharhi

> **Diplom ishi**: "Talabalarning amaliyotidagi faoliyatini nazorat qiluvchi elektron kundalik"

---

## 1. Muammo va Motivatsiya

An'anaviy amaliyot kundaliklarida quyidagi kamchiliklar mavjud:

| Muammo | Oqibat |
|--------|--------|
| Qog'oz kundaliklar | Yo'qolish, buzilish, soxtalash xavfi |
| Rahbar real vaqtda ko'rmaydi | Kechikkan feedback, kech aniqlangan muammolar |
| Davomat qo'lda hisoblanadi | Insoniy xatolar, vaqt yo'qolishi |
| Hujjatlar alohida tizimda | Ma'lumotlar tarqoqligi |
| Bildirishnoma yo'q | Talabalar va rahbarlar muhim voqealardan xabarsiz qoladi |

## 2. Tizim Maqsadi

Elektron amaliyot kundaligi — universitetda amaliyotni o'tayotgan talabalarning kundalik faoliyatini raqamli shaklda yozib borish, rahbarlar tomonidan real vaqtda nazorat qilish va baholash imkonini beruvchi to'liq integratsiyalangan web tizimi.

## 3. Foydalanuvchilar va Ularning Vazifalari

```
┌─────────────────────────────────────────────────────────────────┐
│                     FOYDALANUVCHI ROLLARI                       │
├──────────────────────┬──────────────────────────────────────────┤
│ ROLE                 │ IMKONIYATLAR                             │
├──────────────────────┼──────────────────────────────────────────┤
│ STUDENT              │ Kundalik yozish, fayl biriktirish,       │
│ (Talaba)             │ holat kuzatish, hisobot yuklab olish,    │
│                      │ Telegram bog'lash                        │
├──────────────────────┼──────────────────────────────────────────┤
│ COMPANY_SUPERVISOR   │ Kundaliklar ko'rish (SUBMITTED+),        │
│ (Korxona rahbari)    │ Tasdiqlash/qaytarish, davomat belgilash, │
│                      │ baholash kiritish                        │
├──────────────────────┼──────────────────────────────────────────┤
│ UNIVERSITY_SUPERVISOR│ Kundaliklar ko'rish (SUBMITTED+),        │
│ (Universitet rahbari)│ Tasdiqlash/qaytarish, yakuniy baholash, │
│                      │ to'liq hisobotlar                        │
├──────────────────────┼──────────────────────────────────────────┤
│ ADMIN                │ Foydalanuvchilar, kompaniyalar,          │
│ (Administrator)      │ guruhlar va amaliyotlarni boshqarish     │
└──────────────────────┴──────────────────────────────────────────┘
```

## 4. Asosiy Funksiyalar

### 4.1 Elektron Kundalik
- Har kuni amaliyot jurnali yozuvi (ish nomi, tavsif, natija, soatlar)
- **Holat mashinasi**: `DRAFT → SUBMITTED → APPROVED / RETURNED`
- Qoralamalar faqat talabaga ko'rinadi
- Tasdiqlangan kundalikni o'zgartirish mumkin emas (immutable)
- Qaytarilganda izoh ko'rinadi va talaba qayta tahrirlaydi

### 4.2 Fayl Biriktirish
- PDF, JPG, JPEG, PNG, DOCX, XLSX formatlar
- Har bir fayl ≤ 10 MB
- Magic-bytes orqali haqiqiy format tekshiruvi
- Autentifikatsiya orqali himoyalangan yuklab olish
- DRAFT va RETURNED holatlarda o'zgartirish mumkin

### 4.3 Davomat Hisobi
- Kunlik davomat: `PRESENT / ABSENT / LATE / EXCUSED`
- Ishlangan soatlar hisobi
- Statistika: jami kunlar, kelgan/kelmagan, davomat %
- Faqat korxona rahbari belgilaydi

### 4.4 Yakuniy Baholash
- 5 ta mezon bo'yicha 100 ballik tizim
- Korxona va universitet rahbarlari alohida baholaydi
- Ikkala rahbar `SUBMITTED` qilganda yakuniy ball hisoblanadi
- Mezonlar: texnik ko'nikmalar, muloqot, ishga mas'uliyat, jamoada ishlash, natijalar sifati

### 4.5 PDF va Excel Hisobotlar
- Kundalik hisoboti (sana oralig'i va status bo'yicha filter)
- Davomat hisoboti (talaba, amaliyot, sana bo'yicha filter)
- Yakuniy baholash sertifikati
- Barcha hisobotlar RBAC asosida chiqariladi

### 4.6 Telegram Bot Bildirishnomalari
- Bot: `@amaliyot_kundalik_uz_bot`
- Talaba profilidan Telegram akkauntini bog'lash (10 daqiqa kuchli, 3 urinish)
- Avtomatik bildirishnomalar: kundalik topshirildi, tasdiqlandi, qaytarildi
- Bog'lanmagan foydalanuvchilar uchun `SKIPPED_NO_TG` (tizim to'xtamaydi)

### 4.7 Telegram Bot — interaktiv imkoniyatlar
Bot faqat xabar yubormaydi, undan to'liq ishlash mumkin. Barcha amallar sayt bilan bir xil biznes qoidalari (`services/diaryActions.ts`) orqali bajariladi.

| Rol | Imkoniyat | Buyruq / tugma |
|---|---|---|
| Talaba | Kundalik yozish: sana → reja bandi → mavzu → soat → tavsif → natija → rasm (5 tagacha) → yuborish yoki qoralama | `/yoz`, 📝 Kundalik yozish |
| Talaba | Geolokatsiya orqali davomat: korxonadan radius (standart 300 m) ichida bo'lsa «keldi», `CHECKIN_LATE_AFTER` (09:15) dan keyin «kechikdi»; forward qilingan joylashuv rad etiladi | 📍 Keldim |
| Talaba | Holat: kundaliklar, tasdiqlangan soat, davomat %, reja bajarilishi, yozilmagan kunlar | `/holat`, 📊 Holatim |
| Barcha | QR-kodli yakuniy hisobot PDF chatga | `/hisobot`, 📄 Hisobot |
| Rahbar | Yangi kundalik xabari ostida ✅ Tasdiqlash / ↩️ Qaytarish (izoh so'raladi) tugmalari; tekshiruv navbati | `/tekshir`, 📋 Tekshirish |
| Rahbar | 48 soatdan ortiq tekshirilmagan yozuvlar haqida kunlik eslatma; har juma haftalik xulosa | avtomatik |
| Admin | Tizim statistikasi; hammaga / talabalarga / rahbarlarga e'lon | `/holat`, `/elon` |

Korxona koordinatalari «Katalog → Korxonalar» formasida kiritiladi (koordinatalar va radius).

## 5. Texnologiyalar To'plami

```
Frontend:  React 18 + TypeScript + Vite 5 + Tailwind CSS + React Router v6
Backend:   Node.js + Express 4 + TypeScript + JWT + cookie-parser
Database:  PostgreSQL 15 + Prisma 5 ORM
Files:     Multer (upload) + fs (local disk storage)
Reports:   PDFKit (PDF) + ExcelJS (Excel/XLSX)
Bot:       grammY (Telegram Bot API)
Testing:   Custom TypeScript integration test scripts
```

## 6. Muhim Ko'rsatkichlar

| Ko'rsatkich | Qiymat |
|-------------|--------|
| Test natijalari | 111 / 111 PASS |
| Server build | ✅ 0 xato |
| Client build | ✅ 1598 modul |
| API endpointlar | 40+ |
| DB modellari | 13 |
| Foydalanuvchi rollari | 4 |

---

*Mualliflik yili: 2026 | Toshkent*
