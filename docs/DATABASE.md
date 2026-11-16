# Ma'lumotlar Bazasi Sxemasi

**DBMS**: PostgreSQL 15  
**ORM**: Prisma 5  
**Database**: `internship_diary`

---

## 1. Enumlar (Enum Types)

```sql
-- Foydalanuvchi rollari
UserRole: ADMIN | STUDENT | COMPANY_SUPERVISOR | UNIVERSITY_SUPERVISOR

-- Amaliyot holatlari
InternshipStatus: PLANNED | ACTIVE | COMPLETED | CANCELLED

-- Kundalik yozuvi holatlari
DiaryEntryStatus: DRAFT | SUBMITTED | APPROVED | RETURNED

-- Rahbar qarori
ReviewDecision: APPROVED | RETURNED | REJECTED

-- Davomat holatlari
AttendanceStatus: PRESENT | ABSENT | EXCUSED | LATE

-- Baholash holatlari
EvaluationStatus: DRAFT | SUBMITTED
```

---

## 2. Modellar (ER Diagrammasi)

```
┌─────────────────┐        ┌──────────────────┐
│   StudentGroup  │        │     Company       │
│─────────────────│        │──────────────────│
│ id (PK)         │        │ id (PK)           │
│ name (UNIQUE)   │        │ name (UNIQUE)     │
│ faculty         │        │ address           │
│ studyProgram    │        │ contactPhone      │
│ createdAt       │        │ description       │
│ updatedAt       │        │ createdAt         │
└────────┬────────┘        │ updatedAt         │
         │ 1:N             └────────┬──────────┘
         │                         │ 1:N
┌────────▼────────┐                │
│  StudentProfile │                │
│─────────────────│                │
│ id (PK)         │                │
│ userId (FK,UNQ) │                │
│ studentNumber   │◄───────────────│──────────────────────────────┐
│ (UNIQUE)        │                │                              │
│ groupId (FK)    │                │                              │
│ phone           │                │                              │
└────────┬────────┘                │                              │
         │ 1:1                     │                              │
┌────────▼────────────────────────────────────────────────────┐   │
│                           User                               │   │
│─────────────────────────────────────────────────────────────│   │
│ id (PK, CUID)                                                │   │
│ fullName                                                     │   │
│ email (UNIQUE)                                               │   │
│ passwordHash                                                 │   │
│ role (UserRole)                                              │   │
│ isActive                                                     │   │
│ createdAt / updatedAt                                        │   │
└────┬──────┬───────────────────────────────────────────────┬──┘   │
     │      │                                               │      │
     │1:N   │1:N                                            │1:N   │
     │      │                                               │      │
┌────▼──────────────────────────────────────────────────────▼──────▼──┐
│                         Internship                                    │
│──────────────────────────────────────────────────────────────────────│
│ id (PK)                                                               │
│ studentId (FK → User)                                                 │
│ companyId (FK → Company)                                              │
│ companySupervisorId (FK → User, nullable)                             │
│ universitySupervisorId (FK → User, nullable)                          │
│ startDate / endDate (Date)                                            │
│ status (InternshipStatus)                                             │
│ createdAt / updatedAt                                                 │
└──┬────────────────┬────────────────┬────────────────┬────────────────┘
   │1:N             │1:N             │1:N             │1:N
   │                │                │                │
┌──▼──────────┐ ┌──▼───────────┐ ┌──▼────────────┐ ┌▼────────────────┐
│  DiaryEntry │ │  Attendance  │ │FinalEvaluation│ │InternshipGrade  │
│─────────────│ │──────────────│ │───────────────│ │(legacy model)   │
│ id (PK)     │ │ id (PK)      │ │ id (PK)       │ │ id (PK)         │
│ internshipId│ │ internshipId │ │ internshipId  │ │ internshipId    │
│ entryDate   │ │ attendanceDate│ │ evaluatorId  │ │ reviewerId      │
│ taskTitle   │ │ status       │ │ evaluatorRole │ │ score           │
│ description │ │ hours        │ │ status        │ │ comment         │
│ result      │ │ note         │ │ totalScore    │ │ createdAt       │
│ hoursWorked │ │ createdAt    │ │ generalComment│ └─────────────────┘
│ status      │ │ updatedAt    │ │ submittedAt   │
│ createdAt   │ │              │ │ createdAt     │
│ updatedAt   │ │ @@unique(    │ │ updatedAt     │
└──┬──────────┘ │  internship, │ │               │
   │            │  date)       │ │ @@unique(     │
   │            └──────────────┘ │  internship,  │
   │1:N                          │  evaluatorRole│
   │                             └───────┬───────┘
┌──▼──────────────────────────────┐      │1:N
│   DiaryAttachment  DiaryReview  │  ┌───▼──────────────────┐
│────────────────────────────────│  │EvaluationCriteriaScore│
│ DiaryAttachment:               │  │──────────────────────│
│  id, diaryEntryId, originalName│  │ id (PK)              │
│  storedPath, mimeType          │  │ evaluationId (FK)    │
│  sizeBytes, createdAt          │  │ criterionKey         │
│                                │  │ score                │
│ DiaryReview:                   │  │ comment              │
│  id, diaryEntryId, reviewerId  │  │                      │
│  decision, comment, createdAt  │  │ @@unique(            │
└────────────────────────────────┘  │  evaluationId,       │
                                    │  criterionKey)       │
                                    └──────────────────────┘

┌──────────────────────────────────────────────┐
│         Telegram Models                       │
│──────────────────────────────────────────────│
│ TelegramAccount:                              │
│  id, userId(UNQ), telegramUserId(UNQ),        │
│  username, linkedAt                           │
│                                               │
│ TelegramLinkToken:                            │
│  id, userId, codeHash(UNQ),                  │
│  expiresAt, attempts, createdAt              │
│                                               │
│ NotificationLog:                              │
│  id, eventType, entityId, recipientId,        │
│  telegramUserId, status, errorMessage,        │
│  createdAt                                    │
│  @@unique(eventType, entityId, recipientId)   │
└──────────────────────────────────────────────┘
```

---

## 3. Muhim Cheklovlar (Constraints)

| Model | Cheklov | Maqsad |
|-------|---------|--------|
| `User` | `email` UNIQUE | Bir email bilan faqat bitta akkaunt |
| `StudentProfile` | `studentNumber` UNIQUE | Talaba raqami takrorlanmasin |
| `StudentGroup` | `name` UNIQUE | Guruh nomi unikal |
| `Company` | `name` UNIQUE | Kompaniya nomi unikal |
| `DiaryEntry` | `@@unique([internshipId, entryDate])` | Bir kunda bir yozuv |
| `Attendance` | `@@unique([internshipId, attendanceDate])` | Bir kunda bir davomat |
| `FinalEvaluation` | `@@unique([internshipId, evaluatorRole])` | Har bir rol bir marta baholaydi |
| `EvaluationCriteriaScore` | `@@unique([evaluationId, criterionKey])` | Mezon takrorlanmasin |
| `TelegramAccount` | `userId` UNIQUE, `telegramUserId` UNIQUE | Bir bog'lash |
| `TelegramLinkToken` | `codeHash` UNIQUE | Hash takrorlanmasin |
| `NotificationLog` | `@@unique([eventType, entityId, recipientId])` | Idempotent bildirishnoma |

---

## 4. Indekslar

```sql
-- User
@@index([role])
@@index([isActive])

-- StudentProfile
@@index([groupId])

-- StudentGroup
@@index([faculty])

-- Company
@@index([name])

-- DiaryEntry
@@index([internshipId])
@@index([status])
@@index([entryDate])

-- DiaryAttachment
@@index([diaryEntryId])

-- DiaryReview
@@index([diaryEntryId])
@@index([reviewerId])

-- Attendance
@@index([internshipId])
@@index([attendanceDate])

-- FinalEvaluation
@@index([internshipId])
@@index([evaluatorId])
@@index([status])

-- EvaluationCriteriaScore
@@index([evaluationId])

-- TelegramAccount
@@index([telegramUserId])

-- TelegramLinkToken
@@index([userId])

-- NotificationLog
@@index([recipientId])
@@index([eventType, entityId])
```

---

## 5. Migrations

| Migration nomi | O'zgarishlar |
|----------------|--------------|
| `20261029_init` | Dastlabki schema (User, StudentProfile, StudentGroup, Company, Internship, DiaryEntry, DiaryAttachment, DiaryReview, Attendance, InternshipGrade, FinalEvaluation, EvaluationCriteriaScore) |
| `20261029062458_add_telegram_tokens_and_notifications` | `TelegramLinkToken` va `NotificationLog` modellari qo'shildi |

---

## 5. Seed Ma'lumotlari (Test Foydalanuvchilari)

| Email | Rol | Parol |
|-------|-----|-------|
| `admin@edu.uz` | ADMIN | `admin123` |
| `jasur.aliev@student.edu.uz` | STUDENT | `student123` |
| `malika.usmanova@student.edu.uz` | STUDENT | `student123` |
| `sherzod.nazarov@uzcard.uz` | COMPANY_SUPERVISOR | `super123` |
| `dilshod.toshmatov@edu.uz` | UNIVERSITY_SUPERVISOR | `super123` |

---

## 6. Baholash Mezonlari

```typescript
// server/src/routes/evaluation.ts da aniqlanган
const CRITERIA = [
  { key: 'technical_skills',      label: 'Texnik ko\'nikmalar',         maxScore: 30 },
  { key: 'communication',         label: 'Muloqot va hamkorlik',         maxScore: 20 },
  { key: 'responsibility',        label: 'Ishga mas\'uliyat va intizom', maxScore: 20 },
  { key: 'teamwork',              label: 'Jamoada ishlash',              maxScore: 15 },
  { key: 'results_quality',       label: 'Natijalar sifati',             maxScore: 15 },
  // Jami: 100 ball
];
```
