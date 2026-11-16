# Diplom Himoyasi — Demo Ssenariy

**Loyiha:** Talabalarning amaliyotidagi faoliyatini nazorat qiluvchi elektron kundalik  
**Bot:** [@amaliyot_kundaligibot](https://t.me/amaliyot_kundaligibot)

---

## Tayyorgarlik

Himoyadan oldin tekshiring:

```powershell
# 1. PostgreSQL ishlamoqda
# 2. Backend ishga tushirish
cd E:\Lazizbek\tt\server
npm run dev   # port 3001

# 3. Frontend ishga tushirish
cd E:\Lazizbek\tt\client
npm run dev   # port 5173

# 4. Brauzerda oching: http://localhost:5173
```

**Seed foydalanuvchilar:**

| Rol | Email | Parol |
|-----|-------|-------|
| Talaba | `jasur.aliev@student.edu.uz` | `student123` |
| Korxona rahbari | `sherzod.nazarov@uzcard.uz` | `super123` |
| Universitet rahbari | `dilshod.toshmatov@edu.uz` | `super123` |
| Admin | `admin@edu.uz` | `admin123` |

---

## Ssenariy 1: Talaba kundalik yozadi

### 1.1 Tizimga kirish
1. `http://localhost:5173/login` sahifasini oching
2. Email: `jasur.aliev@student.edu.uz`, Parol: `student123`
3. **Kirish** tugmasini bosing
4. Dashboard ko'rinadi — amaliyot ma'lumotlari

**Ko'rsating:** JWT httpOnly cookie brauzerda saqlanadi (DevTools → Application → Cookies)

---

### 1.2 Yangi kundalik yozuvi yaratish
1. Sidebar'dan **Kundalik** bo'limiga o'ting
2. **Yangi yozuv** tugmasini bosing
3. To'ldiring:
   - Sana: Bugungi sana
   - Ish nomi: `React komponentlarini ishlab chiqish`
   - Tavsif: `Yangi dashboard komponentlari yaratildi va testlar yozildi`
   - Natija: `3 ta komponent muvaffaqiyatli yaratildi`
   - Soatlar: `8`
4. **Qoralama saqlash** tugmasini bosing
5. Status: **DRAFT** ko'rinadi

**Ko'rsating:** DRAFT holatda yozuv faqat talabaga ko'rinadi.

---

### 1.3 Fayl biriktirish
1. Yangi yaratilgan yozuvni oching
2. **Fayl biriktirish** bo'limida **Fayl tanlash** tugmasini bosing
3. PDF yoki JPG fayl tanlang (≤ 10 MB)
4. Yuklanish progressi ko'rinadi
5. Fayl ro'yxatda paydo bo'ladi

**Ko'rsating:** 11 MB fayl yuklashga urinib, xato xabarini ko'rsating.

---

### 1.4 Kundalikni topshirish
1. Yozuvni oching
2. **Topshirish** tugmasini bosing
3. Status: `SUBMITTED` ga o'tadi
4. Endi tahrirlash tugmasi ko'rinmaydi

---

## Ssenariy 2: Rahbar qaror qiladi

### 2.1 Korxona rahbari sifatida kirish
1. Yangi brauzer tab yoki incognito oching
2. Email: `sherzod.nazarov@uzcard.uz`, Parol: `super123`
3. Dashboard → **Kundaliklar**
4. Jasurning SUBMITTED kundaliği ko'rinadi

**Ko'rsating:** DRAFT kundaliği ko'rinmasligini ham tekshiring.

---

### 2.2 Kundalikni qaytarish
1. Jasurning SUBMITTED kundaligini oching
2. **Qaytarish** tugmasini bosing
3. Izoh: `Ish natijasini batafsil ko'rsating`
4. Tasdiqlang

---

### 2.3 Talaba izohni ko'radi
1. Talaba akkauntiga qayting
2. Kundaliklar ro'yxatida status: **RETURNED** ko'rinadi
3. Yozuvni oching — izoh ko'rinadi
4. Tahrirlab qayta topshiring

---

### 2.4 Rahbar tasdiqlaydi
1. Rahbar akkauntida yangilangan yozuvni oching
2. **Tasdiqlash** tugmasini bosing
3. Status: **APPROVED**
4. Talaba akkauntida yozuv endi tahrirlanmaydi

---

## Ssenariy 3: Davomat

1. Korxona rahbari akkauntida **Davomat** bo'limiga o'ting
2. Bugungi sana uchun: `Keldi (PRESENT)`, `8 soat` belgilang
3. **Saqlash** tugmasini bosing
4. Statistikani ko'ring: kelgan kunlar, davomat foizi

---

## Ssenariy 4: Yakuniy Baholash

### 4.1 Korxona rahbari baholaydi
1. **Baholash** bo'limiga o'ting
2. 5 ta mezon bo'yicha ball bering:
   - Texnik ko'nikmalar: 27/30
   - Muloqot: 18/20
   - Mas'uliyat: 18/20
   - Jamoada ishlash: 13/15
   - Natijalar: 13/15
3. Izoh yozing → **Topshirish**

### 4.2 Universitet rahbari baholaydi
1. `dilshod.toshmatov@edu.uz` bilan kiring
2. Xuddi shunday baholash kiriting
3. **Ikkala rahbar SUBMITTED** bo'lganda yakuniy ball chiqadi

**Ko'rsating:** Yakuniy ball = ikki rahbarning o'rtacha bali

---

## Ssenariy 5: Hisobotlar eksport

1. Talaba akkauntida **Hisobotlar** bo'limiga o'ting
2. **Kundalik → PDF** yuklab oling — brauzerda oching
3. **Kundalik → Excel** yuklab oling — ochib ko'rsating
4. Sana oralig'i va status filtrlarini ko'rsating

**Ko'rsating:** PDF va Excel to'g'ri ma'lumotlarni o'z ichiga olishini tekshiring.

---

## Ssenariy 6: Telegram Bot

### 6.1 Bog'lash
1. Talaba → **Profil** sahifasi
2. **Telegram bog'lash** tugmasini bosing
3. Kod va `t.me/amaliyot_kundaligibot?start=<kod>` havolasi chiqadi
4. Telegram'da botni oching → `/start <kod>` → `✅ Akkaunt muvaffaqiyatli bog'landi`

### 6.2 Bildirishnomalar
Talaba kundalik topshirganda → Rahbar Telegram'da bildirishnoma oladi:
```
📬 Yangi kundalik topshirildi

👤 Talaba: Jasur Aliev
📅 Sana: 2026-10-29
📝 Ish: React komponentlarini ishlab chiqish
```

**Muhim:** Real bot uchun `.env` faylida haqiqiy `TELEGRAM_BOT_TOKEN` bo'lishi kerak.

---

## Ssenariy 7: Admin Panel

1. `admin@edu.uz` bilan kiring
2. Foydalanuvchilar, kompaniyalar, guruhlar va amaliyotlarni boshqarish
3. Barcha kundaliklarni ko'rish

---

## Tizim Arxitekturasi (Himoya uchun)

```
Brauzer (React SPA)
    │  JWT httpOnly Cookie
    ▼
Express API (port 3001)
    │  Prisma ORM
    ▼
PostgreSQL (internship_diary)
    +
grammY → Telegram Bot API (@amaliyot_kundaligibot)
```

---

## Savollarga Javoblar

**S: Nega httpOnly cookie?**  
J: XSS hujumlaridan himoya — JavaScript cookie'ga kira olmaydi.

**S: Fayllar qanday himoyalangan?**  
J: To'g'ridan-to'g'ri URL yo'q — faqat autentifikatsiya orqali yuklab olish mumkin. Magic-bytes bilan haqiqiy format tekshiriladi.

**S: IDOR qanday oldini olingan?**  
J: Har bir so'rovda Prisma query `internshipId + studentId` kombinatsiyasini tekshiradi.

**S: Telegram token qanday xavfsiz?**  
J: `.env` faylida, loglarda ko'rinmaydi, frontendga bormaydi, `.gitignore`da.

**S: Agar bir sana uchun ikki kundalik yozilsa?**  
J: DB darajasida `@@unique([internshipId, entryDate])` — API 409 qaytaradi.
