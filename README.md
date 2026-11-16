# Elektron Amaliyot Kundaligi

**Mavzu:** Professional ta'lim uchun elektron kundalik va amaliyot jurnalini yaratish.

Kollej va texnikum talabalarining ishlab chiqarish amaliyotini boshqaradigan veb-ilova: kundalik yuritish, davomat, amaliyot rejasi, rahbar tekshiruvi, yakuniy baholash, guruh jurnali, hisobotlar (PDF/Excel) va Telegram bildirishnomalari.

## Rollar

| Rol | Imkoniyatlar |
|---|---|
| **Administrator** (amaliyot bo'limi) | Foydalanuvchilar (yaratish, tahrirlash, parol tiklash, Excel import), korxonalar va guruhlar, amaliyotlarni biriktirish, barcha hisobotlar |
| **Korxona rahbari** | Amaliyot rejasini tuzish, kundaliklarni tasdiqlash/qaytarish, davomatni belgilash, yakuniy baholash, talabani eslatish |
| **Ta'lim muassasasi rahbari** (ishlab chiqarish ta'limi ustasi) | Kuzatish, kundaliklarni tasdiqlash, reja, yakuniy baholash, guruh jurnali |
| **Talaba** | Kundalik yozish (reja bandiga bog'lab), fayl biriktirish, o'z amaliyoti, davomat va baholarini ko'rish, yakuniy hisobotni yuklab olish |

## Asosiy imkoniyatlar

- **Elektron kundalik**: qoralama → topshirilgan → tasdiqlangan / qaytarilgan; dalil fayllari (PDF, rasm, DOCX, XLSX).
- **Amaliyot rejasi (dasturi)**: mavzular va soatlar; kundalik reja bandiga bog'lanadi, bajarilish foizi avtomatik hisoblanadi.
- **Davomat kalendari** va **guruh jurnali**: talaba × kun jadvali (davomat + kundalik holati), Excel eksport.
- **Yakuniy baholash**: 5 mezon (100 ball), korxona va muassasa rahbari alohida baholaydi, o'rtacha ball avtomatik.
- **Yakuniy rasmiy hujjat (PDF)**: reja bajarilishi, kundaliklar, davomat, baholash, imzo joylari va **QR-kod**. QR ochiq `/verify/...` sahifasiga olib boradi; havola HMAC bilan imzolangan, soxtalashtirib bo'lmaydi.
- **Grafiklar**: haftalik dinamika, kundalik holati, davomat taqsimoti, guruh va korxona kesimidagi ko'rsatkichlar.
- **Bildirishnomalar**: sarlavhadagi qo'ng'iroqcha (tekshirish kutilmoqda, qaytarilgan kundalik, yozilmagan kunlar, baholash muddati).
- **Telegram bot**: hodisalar bo'yicha xabarlar; har kuni soat 18:00 (Toshkent) da kundalik yozmagan talabalarga avtomatik **eslatma**, rahbar uchun qo'lda «Eslatish» tugmasi.
- **Excel import**: talabalar va rahbarlarni shablon orqali ommaviy qo'shish (vaqtinchalik parollar CSV sifatida yuklab olinadi).
- **Xavfsizlik**: bcrypt, JWT + HttpOnly cookie, rollar bo'yicha ruxsat (RBAC), login urinishlarini cheklash, birinchi kirishda parolni almashtirish talabi.
- **O'zbek / rus tili**, **mobil moslashuv** va **PWA**: telefonga ilova sifatida o'rnatiladi.

## Texnologiyalar

React 18 + TypeScript + Vite + Tailwind CSS + Recharts · Node.js 20 + Express + Prisma 5 + PostgreSQL 16 · pdfkit, exceljs, qrcode · grammY (Telegram).

## Lokal ishga tushirish

Talablar: Node.js 20+, PostgreSQL 15+.

```bash
# 1. Server
cd server
cp .env.example .env          # DATABASE_URL, JWT_SECRET va boshqalarni yozing
npm install
npx prisma migrate deploy
npm run prisma:seed           # demo ma'lumotlar (ixtiyoriy)
npm run dev                   # http://localhost:3001

# 2. Client (yangi terminalda)
cd client
npm install
npm run dev                   # http://localhost:5173
```

Demo akkauntlar (parol `DevPassword123!`):

| Rol | Email |
|---|---|
| Administrator | `admin@edu.uz` |
| Korxona rahbari | `sherzod.nazarov@uzcard.uz` |
| Ta'lim muassasasi rahbari | `dilshod.toshmatov@edu.uz` |
| Talaba | `jasur.aliev@student.edu.uz` |

Demo profillar kirish sahifasida faqat dev rejimida (yoki `VITE_DEMO_MODE=true` bo'lganda) ko'rinadi.

## Docker bilan (bitta buyruq)

```bash
cp .env.docker.example .env        # parollar va JWT_SECRET ni o'zgartiring
docker compose up -d --build       # http://localhost:3001
docker compose exec app npm run prisma:seed   # ixtiyoriy demo ma'lumotlar
```

Production rejimda server React ilovasini ham o'zi tarqatadi (bitta konteyner, bitta port). PDF'dagi QR-kod to'g'ri ishlashi uchun `PUBLIC_URL` ga saytning haqiqiy manzilini yozing.

## Testlar

```bash
cd server
npm run prisma:seed
npm test          # barcha integratsion testlar (auth, kundalik, davomat, fayllar, baholash, hisobotlar, xavfsizlik, yangi funksiyalar)
```

## Yangi API endpointlari

| Metod | Endpoint | Ruxsat | Tavsif |
|---|---|---|---|
| GET/POST/PATCH/DELETE | `/api/companies` | Admin (o'qish — rahbarlar ham) | Korxonalar |
| GET/POST/PATCH/DELETE | `/api/groups` | Admin (o'qish — rahbarlar ham) | O'quv guruhlari |
| POST/PATCH/DELETE | `/api/internships/:id?` | Admin | Amaliyot yaratish / tahrirlash / bo'sh amaliyotni o'chirish |
| GET | `/api/internships/mine` | Hamma | Talabaning faol amaliyoti |
| GET/POST/PATCH/DELETE | `/api/internships/:id/plan[/:itemId]` | Admin, biriktirilgan rahbar | Amaliyot rejasi |
| PATCH | `/api/users/:id` | Admin | Foydalanuvchini tahrirlash |
| POST | `/api/users/:id/reset-password` | Admin | Vaqtinchalik parol berish |
| GET / POST | `/api/users/import/template`, `/api/users/import` | Admin | Excel shablon va import |
| POST | `/api/auth/change-password` | Hamma | Parolni almashtirish |
| PATCH | `/api/auth/profile` | Hamma | O'z telefon raqamini yangilash |
| GET | `/api/dashboard/analytics?weeks=8` | Hamma (rol bo'yicha) | Grafiklar uchun statistika |
| GET | `/api/journal?month=YYYY-MM&groupId=`, `/api/journal/excel` | Rahbarlar, Admin | Guruh jurnali |
| GET | `/api/reports/final/:internshipId/pdf` | Talaba (o'zi), rahbar, Admin | Yakuniy hisobot + QR |
| GET | `/api/public/verify/:internshipId?c=` | Ochiq | QR orqali hujjatni tekshirish |
| GET | `/api/notifications` | Hamma | Bildirishnomalar |
| POST | `/api/notifications/remind/:internshipId` | Rahbarlar, Admin | Telegram eslatma yuborish |

## Xavfsizlik eslatmasi

`.env` fayllarida parollar va bot tokeni bo'ladi — ularni hech qachon arxivga yoki gitga qo'shmang. Tarqatish uchun faqat `.env.example` fayllaridan foydalaning.
