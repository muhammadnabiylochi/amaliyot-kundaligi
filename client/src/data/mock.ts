/**
 * MOCK DATA — UI Development Only
 * -------------------------------------------------------
 * This file contains static sample data in Uzbek for visual
 * development. It is NOT connected to any database or API.
 * Replace these imports with real API calls in production.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type UserRole = 'admin' | 'student' | 'supervisor';
export type EntryStatus = 'draft' | 'submitted' | 'approved' | 'rejected' | 'returned';
export type InternshipStatus = 'active' | 'completed' | 'cancelled';
export type UserStatus = 'active' | 'inactive';

export interface MockUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  department: string;
  group?: string;
  phone?: string;
  status: UserStatus;
  createdAt: string;
}

export interface MockInternship {
  id: string;
  studentId: string;
  studentName: string;
  company: string;
  position: string;
  address: string;
  startDate: string;
  endDate: string;
  supervisorId: string;
  supervisorName: string;
  status: InternshipStatus;
  totalDays: number;
  submittedEntries: number;
  approvedEntries: number;
  pendingEntries: number;
  description: string;
  department: string;
}

export interface MockDiaryEntry {
  id: string;
  date: string;
  studentId: string;
  studentName: string;
  internshipId: string;
  company: string;
  title: string;
  content: string;
  tasks: string[];
  hours: number;
  status: EntryStatus;
  supervisorComment?: string;
  reviewedAt?: string;
  reviewedBy?: string;
  createdAt: string;
}

export interface WeeklyStats {
  week: string;
  submitted: number;
  approved: number;
  rejected: number;
}

// ─── Users ────────────────────────────────────────────────────────────────────

export const MOCK_USERS: MockUser[] = [
  {
    id: 'u1',
    name: 'Aziz Rahimov',
    email: 'aziz@edu.uz',
    role: 'admin',
    department: 'Rektorat',
    phone: '+998 90 123-45-67',
    status: 'active',
    createdAt: '2025-08-15',
  },
  {
    id: 'u2',
    name: 'Malika Tosheva',
    email: 'malika@edu.uz',
    role: 'admin',
    department: "Amaliyot bo'limi",
    phone: '+998 91 234-56-78',
    status: 'active',
    createdAt: '2025-08-15',
  },
  {
    id: 'u3',
    name: 'Jasur Toshmatov',
    email: 'jasur@student.edu.uz',
    role: 'student',
    department: 'TATU',
    group: 'IT-201',
    phone: '+998 93 345-67-89',
    status: 'active',
    createdAt: '2024-09-01',
  },
  {
    id: 'u4',
    name: 'Dilnoza Yusupova',
    email: 'dilnoza@student.edu.uz',
    role: 'student',
    department: 'TATU',
    group: 'IT-202',
    phone: '+998 94 456-78-90',
    status: 'active',
    createdAt: '2024-09-01',
  },
  {
    id: 'u5',
    name: 'Bobur Karimov',
    email: 'bobur@student.edu.uz',
    role: 'student',
    department: 'TDTU',
    group: 'KI-301',
    phone: '+998 95 567-89-01',
    status: 'active',
    createdAt: '2024-09-01',
  },
  {
    id: 'u6',
    name: 'Nodira Rashidova',
    email: 'nodira@student.edu.uz',
    role: 'student',
    department: 'TDTU',
    group: 'KI-302',
    phone: '+998 97 678-90-12',
    status: 'active',
    createdAt: '2024-09-01',
  },
  {
    id: 'u7',
    name: 'Sherzod Nazarov',
    email: 'sherzod@uzcard.uz',
    role: 'supervisor',
    department: 'Uzcard MChJ',
    phone: '+998 90 789-01-23',
    status: 'active',
    createdAt: '2025-09-01',
  },
  {
    id: 'u8',
    name: 'Zulfiya Mirzayeva',
    email: 'zulfiya@epam.uz',
    role: 'supervisor',
    department: 'EPAM Systems',
    phone: '+998 91 890-12-34',
    status: 'active',
    createdAt: '2025-09-01',
  },
  {
    id: 'u9',
    name: 'Eldor Xasanov',
    email: 'eldor@student.edu.uz',
    role: 'student',
    department: "O'zMU",
    group: 'MX-401',
    phone: '+998 93 901-23-45',
    status: 'inactive',
    createdAt: '2023-09-01',
  },
];

// ─── Internships ──────────────────────────────────────────────────────────────

export const MOCK_INTERNSHIPS: MockInternship[] = [
  {
    id: 'i1',
    studentId: 'u3',
    studentName: 'Jasur Toshmatov',
    company: 'Uzcard MChJ',
    position: 'Frontend dasturchi (stajyor)',
    address: 'Toshkent sh., Mirzo Ulugbek tumani, Amir Temur ko\'ch. 108',
    startDate: '2026-09-01',
    endDate: '2026-10-31',
    supervisorId: 'u7',
    supervisorName: 'Sherzod Nazarov',
    status: 'active',
    totalDays: 40,
    submittedEntries: 35,
    approvedEntries: 30,
    pendingEntries: 5,
    description: "React va TypeScript yordamida bank kartalarini boshqarish tizimi uchun foydalanuvchi interfeysini ishlab chiqish.",
    department: 'Mahsulotni ishlab chiqish bo\'limi',
  },
  {
    id: 'i2',
    studentId: 'u4',
    studentName: 'Dilnoza Yusupova',
    company: 'EPAM Systems',
    position: 'Junior QA muhandis (stajyor)',
    address: "Toshkent sh., Yunusobod tumani, Amir Temur shoh ko'ch. 2B",
    startDate: '2026-09-01',
    endDate: '2026-10-31',
    supervisorId: 'u8',
    supervisorName: 'Zulfiya Mirzayeva',
    status: 'active',
    totalDays: 40,
    submittedEntries: 28,
    approvedEntries: 25,
    pendingEntries: 3,
    description: "Dasturiy ta'minot sifatini nazorat qilish va avtomatlashtirilgan testlar yozish. Selenium va Jest frameworks bilan ishlash.",
    department: 'Sifat nazorat bo\'limi',
  },
  {
    id: 'i3',
    studentId: 'u5',
    studentName: 'Bobur Karimov',
    company: 'Beeline Uzbekistan',
    position: 'Backend dasturchi (stajyor)',
    address: 'Toshkent sh., Shayxontohur tumani, Navoiy ko\'ch. 28',
    startDate: '2026-09-01',
    endDate: '2026-10-31',
    supervisorId: 'u7',
    supervisorName: 'Sherzod Nazarov',
    status: 'active',
    totalDays: 40,
    submittedEntries: 38,
    approvedEntries: 36,
    pendingEntries: 2,
    description: "Node.js va PostgreSQL yordamida mobil tarmoq xizmatlariga REST API yaratish va mavjud mikroservislarni qo'llab-quvvatlash.",
    department: 'Backend muhandislik bo\'limi',
  },
  {
    id: 'i4',
    studentId: 'u6',
    studentName: 'Nodira Rashidova',
    company: 'Click MChJ',
    position: 'UX dizayner (stajyor)',
    address: 'Toshkent sh., Chilonzor tumani, Bunyodkor shoh yo\'li 2',
    startDate: '2026-09-15',
    endDate: '2026-11-14',
    supervisorId: 'u8',
    supervisorName: 'Zulfiya Mirzayeva',
    status: 'active',
    totalDays: 40,
    submittedEntries: 22,
    approvedEntries: 18,
    pendingEntries: 4,
    description: "Mobil to'lov ilovasi uchun foydalanuvchi interfeysi dizayni. Figma, prototiplash va foydalanuvchi tadqiqoti.",
    department: 'Mahsulot dizayni bo\'limi',
  },
  {
    id: 'i5',
    studentId: 'u9',
    studentName: 'Eldor Xasanov',
    company: 'Hamkorbank AJ',
    position: 'Ma\'lumotlar tahlilchisi (stajyor)',
    address: "Toshkent sh., Uchtepa tumani, Ko'yliq ko'ch. 1",
    startDate: '2026-02-01',
    endDate: '2026-03-31',
    supervisorId: 'u7',
    supervisorName: 'Sherzod Nazarov',
    status: 'completed',
    totalDays: 40,
    submittedEntries: 40,
    approvedEntries: 38,
    pendingEntries: 0,
    description: "SQL va Python yordamida bank ma'lumotlarini tahlil qilish va hisobot tuzish.",
    department: "Ma'lumotlar tahlili bo'limi",
  },
  {
    id: 'i6',
    studentId: 'u9',
    studentName: 'Eldor Xasanov',
    company: 'IT Park Uzbekiston',
    position: 'Loyiha menejeri (stajyor)',
    address: "Toshkent sh., Mirzo Ulugbek tumani, IT Park binosi",
    startDate: '2026-05-01',
    endDate: '2026-06-30',
    supervisorId: 'u8',
    supervisorName: 'Zulfiya Mirzayeva',
    status: 'cancelled',
    totalDays: 40,
    submittedEntries: 5,
    approvedEntries: 4,
    pendingEntries: 0,
    description: "Startup loyihalarni qo'llab-quvvatlash va boshqarish metodologiyalari bilan tanishish.",
    department: "Startuplarni qo'llab-quvvatlash bo'limi",
  },
];

// ─── Diary Entries ────────────────────────────────────────────────────────────

export const MOCK_DIARY_ENTRIES: MockDiaryEntry[] = [
  // Jasur's entries (i1)
  {
    id: 'e1',
    date: '2026-10-27',
    studentId: 'u3',
    studentName: 'Jasur Toshmatov',
    internshipId: 'i1',
    company: 'Uzcard MChJ',
    title: 'Dashboard komponentini refaktoring qilish',
    content: "Bugun mavjud Dashboard komponentini React hooks va TypeScript bilan qayta yozdim. useCallback va useMemo optimizatsiyalarini qo'shdim. Natijada sahifa yuklash vaqti 40% ga tezlashdi.",
    tasks: [
      'Mavjud kodni tahlil qilish',
      'useCallback va useMemo optimallashtirish',
      'Unit testlarni yangilash',
      'Code review o\'tkazish',
    ],
    hours: 8,
    status: 'submitted',
    createdAt: '2026-10-27T17:00:00Z',
  },
  {
    id: 'e2',
    date: '2026-10-24',
    studentId: 'u3',
    studentName: 'Jasur Toshmatov',
    internshipId: 'i1',
    company: 'Uzcard MChJ',
    title: 'API integratsiyasi va xato ushlash',
    content: "Karta to'lovlari uchun REST API bilan integratsiyani amalga oshirdim. Axios interceptorlar orqali xato ushlash va token yangilash mexanizmini qo'shdim.",
    tasks: [
      'Axios interceptorlarni sozlash',
      'Token yangilash mexanizmini implement qilish',
      'API xatoliklarni foydalanuvchiga ko\'rsatish',
    ],
    hours: 7,
    status: 'approved',
    supervisorComment: "Yaxshi ish! Xato ushlash to'liq va professional darajada.",
    reviewedAt: '2026-10-25T10:00:00Z',
    reviewedBy: 'Sherzod Nazarov',
    createdAt: '2026-10-24T18:00:00Z',
  },
  {
    id: 'e3',
    date: '2026-10-23',
    studentId: 'u3',
    studentName: 'Jasur Toshmatov',
    internshipId: 'i1',
    company: 'Uzcard MChJ',
    title: 'Haftalik jamoaviy yig\'ilish',
    content: "Sprint sharhi yig'ilishiga qatnashdim. Keyingi sprint uchun vazifalar muhokama qilindi va sprint retrospektivasida ishtirok etdim.",
    tasks: [
      'Sprint review taqdimoti',
      'Keyingi sprint rejalash',
      'Retrospektiva muhokamasi',
    ],
    hours: 4,
    status: 'approved',
    supervisorComment: 'Faol ishtirok uchun rahmat.',
    reviewedAt: '2026-10-24T09:00:00Z',
    reviewedBy: 'Sherzod Nazarov',
    createdAt: '2026-10-23T14:00:00Z',
  },
  {
    id: 'e4',
    date: '2026-10-22',
    studentId: 'u3',
    studentName: 'Jasur Toshmatov',
    internshipId: 'i1',
    company: 'Uzcard MChJ',
    title: 'Karta ro\'yxati komponentini ishlab chiqish',
    content: "Foydalanuvchining bank kartalarini ko'rsatuvchi yangi komponent yaratdim. Filtrlash, saralash va pagination funksiyalarini implement qildim.",
    tasks: [
      'Karta ro\'yxati UI dizayni',
      'Filtrlash va saralash',
      'Pagination implement qilish',
      'Responsive dizayn sozlash',
    ],
    hours: 8,
    status: 'approved',
    supervisorComment: "Ajoyib! Komponent to'liq va professional darajada.",
    reviewedAt: '2026-10-23T11:00:00Z',
    reviewedBy: 'Sherzod Nazarov',
    createdAt: '2026-10-22T18:00:00Z',
  },
  {
    id: 'e5',
    date: '2026-10-21',
    studentId: 'u3',
    studentName: 'Jasur Toshmatov',
    internshipId: 'i1',
    company: 'Uzcard MChJ',
    title: 'Xatoliklarni bartaraf etish (debugging)',
    content: "Production muhitida kuzatilgan karta to'lovi xatolarini tahlil qildim va bartaraf etdim. Sentry da xato izlari orqali muammoni tez aniqladim.",
    tasks: [
      'Sentry loglarini tahlil qilish',
      'Lokal muhitda xatoni takrorlash',
      'Xatoni bartaraf etish va test qilish',
    ],
    hours: 6,
    status: 'draft',
    createdAt: '2026-10-21T16:00:00Z',
  },
  // Dilnoza's entries (i2)
  {
    id: 'e6',
    date: '2026-10-27',
    studentId: 'u4',
    studentName: 'Dilnoza Yusupova',
    internshipId: 'i2',
    company: 'EPAM Systems',
    title: 'Avtomatlashtirilgan test ssenariylari yozish',
    content: "Foydalanuvchi autentifikatsiyasi uchun Selenium WebDriver bilan end-to-end test ssenariylarini yozdim. 15 ta yangi test qo'shildi.",
    tasks: [
      'Test ssenariylarini rejalash',
      'Selenium skriptlarini yozish',
      'CI/CD pipeline ga qo\'shish',
    ],
    hours: 8,
    status: 'submitted',
    createdAt: '2026-10-27T17:30:00Z',
  },
  {
    id: 'e7',
    date: '2026-10-24',
    studentId: 'u4',
    studentName: 'Dilnoza Yusupova',
    internshipId: 'i2',
    company: 'EPAM Systems',
    title: 'Xato hisobotlarini tahlil qilish',
    content: "Jira tizimidagi 23 ta xato hisobotini tahlil qildim. 8 tasini qayta ishlab chiquvchilarga qaytardim (xato yo'q), 15 tasini tasdiqlash uchun test muhitida tekshirdim.",
    tasks: [
      'Jira hisobotlarini ko\'rib chiqish',
      'Test muhitida tekshirish',
      'Hisobotlarni yangilash',
    ],
    hours: 7,
    status: 'approved',
    supervisorComment: 'Puxta tahlil va aniq hisobotlar.',
    reviewedAt: '2026-10-25T14:00:00Z',
    reviewedBy: 'Zulfiya Mirzayeva',
    createdAt: '2026-10-24T18:00:00Z',
  },
  {
    id: 'e8',
    date: '2026-10-23',
    studentId: 'u4',
    studentName: 'Dilnoza Yusupova',
    internshipId: 'i2',
    company: 'EPAM Systems',
    title: 'API testlash va dokumentatsiya',
    content: "Postman yordamida yangi API endpointlarni sinovdan o'tkezdim va natijalarni Confluence da hujjatlashtirdim.",
    tasks: [
      'Postman kolleksiyasini yangilash',
      'API xato kodlarini tekshirish',
      'Confluence hujjatini yozish',
    ],
    hours: 8,
    status: 'rejected',
    supervisorComment: "Iltimos, yuklash holati va to'lov APIlari uchun ham test qo'shing. Qayta yuboring.",
    reviewedAt: '2026-10-24T10:00:00Z',
    reviewedBy: 'Zulfiya Mirzayeva',
    createdAt: '2026-10-23T18:00:00Z',
  },
  // Bobur's entries (i3)
  {
    id: 'e9',
    date: '2026-10-27',
    studentId: 'u5',
    studentName: 'Bobur Karimov',
    internshipId: 'i3',
    company: 'Beeline Uzbekistan',
    title: 'Mikroservis arxitekturasi amalga oshirish',
    content: "Tarife xizmatini alohida mikroservislarga ajratish ustida ishladim. Docker va Kubernetes konfiguratsiyalarini yozdim.",
    tasks: [
      'Servis chegaralarini aniqlash',
      'Docker image yaratish',
      'Kubernetes manifest yozish',
      'Lokal muhitda sinovdan o\'tkazish',
    ],
    hours: 8,
    status: 'submitted',
    createdAt: '2026-10-27T18:00:00Z',
  },
  {
    id: 'e10',
    date: '2026-10-24',
    studentId: 'u5',
    studentName: 'Bobur Karimov',
    internshipId: 'i3',
    company: 'Beeline Uzbekistan',
    title: 'Ma\'lumotlar bazasini optimizatsiya qilish',
    content: "Sekin ishlayotgan SQL so'rovlarni tahlil qildim va indekslar qo'shib optimizatsiya qildim. Asosiy so'rov 2.3 soniyadan 0.4 soniyagacha tezlashdi.",
    tasks: [
      'EXPLAIN ANALYZE orqali sekin so\'rovlarni aniqlash',
      'Composite indekslar qo\'shish',
      'So\'rov natijalarini tekshirish',
    ],
    hours: 7,
    status: 'approved',
    supervisorComment: '10% dan ortiq optimizatsiya — zo\'r natija!',
    reviewedAt: '2026-10-25T09:00:00Z',
    reviewedBy: 'Sherzod Nazarov',
    createdAt: '2026-10-24T18:00:00Z',
  },
  // Nodira's entries (i4)
  {
    id: 'e11',
    date: '2026-10-27',
    studentId: 'u6',
    studentName: 'Nodira Rashidova',
    internshipId: 'i4',
    company: 'Click MChJ',
    title: 'Foydalanuvchi tadqiqoti natijalari tahlili',
    content: "15 foydalanuvchi bilan o'tkazilgan intervyu natijalari haqida slayd-taqdimot tayyorladim. Asosiy muammoli nuqtalar va yechimlar aniqlandi.",
    tasks: [
      'Intervyu yozuvlarini tahlil qilish',
      'Affinity diagram yaratish',
      'Taqdimot slaydlarini tayyorlash',
    ],
    hours: 8,
    status: 'submitted',
    createdAt: '2026-10-27T17:00:00Z',
  },
  {
    id: 'e12',
    date: '2026-10-24',
    studentId: 'u6',
    studentName: 'Nodira Rashidova',
    internshipId: 'i4',
    company: 'Click MChJ',
    title: 'To\'lov oqimini qayta loyihalash',
    content: "Mobil ilovadagi to'lov jarayonini soddalashtirish uchun yangi Figma prototipini yaratdim. 5 bosqichdan 3 bosqichgacha qisqartirdim.",
    tasks: [
      'Mavjud oqimni baholash',
      'Yangi wireframe chizish',
      'Figma prototipi yaratish',
      'Jamoa bilan muhokama qilish',
    ],
    hours: 8,
    status: 'approved',
    supervisorComment: 'Juda yaxshi! Soddalashtirish qadamlarini kuzatib borish qulay.',
    reviewedAt: '2026-10-25T15:00:00Z',
    reviewedBy: 'Zulfiya Mirzayeva',
    createdAt: '2026-10-24T18:00:00Z',
  },
  {
    id: 'e13',
    date: '2026-10-23',
    studentId: 'u6',
    studentName: 'Nodira Rashidova',
    internshipId: 'i4',
    company: 'Click MChJ',
    title: 'Dizayn tizimini hujjatlashtirish',
    content: "Click ilovasining dizayn tizimidagi mavjud komponentlarni hujjatlashtirdim. Typographic scale, color palette va spacing qoidalarini yozdim.",
    tasks: [
      'Komponentlarni inventarizatsiya qilish',
      'Storybook hujjatlarini yozish',
      'Rang palitrasini standartlashtirish',
    ],
    hours: 7,
    status: 'approved',
    supervisorComment: 'Batafsil va toza hujjat.',
    reviewedAt: '2026-10-24T11:00:00Z',
    reviewedBy: 'Zulfiya Mirzayeva',
    createdAt: '2026-10-23T17:00:00Z',
  },
  // More Jasur entries for depth
  {
    id: 'e14',
    date: '2026-10-20',
    studentId: 'u3',
    studentName: 'Jasur Toshmatov',
    internshipId: 'i1',
    company: 'Uzcard MChJ',
    title: 'Autentifikatsiya modulini ishlab chiqish',
    content: "JWT asosidagi autentifikatsiya tizimini React tarafida implement qildim. Token yangilash, xavfsiz saqlash va himoyalangan yo'nalishlarni qo'shdim.",
    tasks: [
      'JWT decode va tekshirish',
      'Xavfsiz localStorage yordamida saqlash',
      'Himoyalangan Route komponenti',
      'Tokenni avtomatik yangilash',
    ],
    hours: 8,
    status: 'approved',
    supervisorComment: 'Xavfsizlik nuqtai nazaridan to\'g\'ri yondashuv.',
    reviewedAt: '2026-10-21T10:00:00Z',
    reviewedBy: 'Sherzod Nazarov',
    createdAt: '2026-10-20T18:00:00Z',
  },
  {
    id: 'e15',
    date: '2026-10-17',
    studentId: 'u3',
    studentName: 'Jasur Toshmatov',
    internshipId: 'i1',
    company: 'Uzcard MChJ',
    title: 'Responsive dizayn amalga oshirish',
    content: "Karta boshqaruv panelini mobil qurilmalar uchun optimizatsiya qildim. Tailwind CSS breakpointlari va flexbox yordamida responsive layout yaratdim.",
    tasks: [
      'Mobil wireframeni ko\'rib chiqish',
      'Tailwind responsive classlarni qo\'llash',
      'Turli ekran o\'lchamlarida sinovdan o\'tkazish',
    ],
    hours: 7,
    status: 'approved',
    reviewedAt: '2026-10-18T09:00:00Z',
    reviewedBy: 'Sherzod Nazarov',
    createdAt: '2026-10-17T18:00:00Z',
  },
  // More entries for Bobur
  {
    id: 'e16',
    date: '2026-10-21',
    studentId: 'u5',
    studentName: 'Bobur Karimov',
    internshipId: 'i3',
    company: 'Beeline Uzbekistan',
    title: 'REST API endpoint yaratish',
    content: "Tarif rejalari uchun yangi CRUD endpointlari implement qildim. Input validatsiya, xato ushlash va API hujjatlarini yozdim.",
    tasks: [
      'Express router yaratish',
      'Zod yordamida validatsiya',
      'Swagger hujjatlarini yozish',
      'Integration testlar',
    ],
    hours: 8,
    status: 'approved',
    supervisorComment: 'Hujjat to\'liq va API standartlariga mos.',
    reviewedAt: '2026-10-22T11:00:00Z',
    reviewedBy: 'Sherzod Nazarov',
    createdAt: '2026-10-21T18:00:00Z',
  },
  {
    id: 'e17',
    date: '2026-10-20',
    studentId: 'u4',
    studentName: 'Dilnoza Yusupova',
    internshipId: 'i2',
    company: 'EPAM Systems',
    title: 'Performance testlash',
    content: "Apache JMeter yordamida tizimning kuchlanish testlarini o'tkezdim. 1000 bir vaqtli foydalanuvchi uchun tizim barqarorligini tasdiqlladim.",
    tasks: [
      'JMeter stsenariylarini sozlash',
      'Kuchlanish testini ishga tushirish',
      'Natijalarni tahlil qilish',
      'Hisobot tuzish',
    ],
    hours: 8,
    status: 'approved',
    supervisorComment: 'Puxta test va aniq hisobot.',
    reviewedAt: '2026-10-21T14:00:00Z',
    reviewedBy: 'Zulfiya Mirzayeva',
    createdAt: '2026-10-20T18:00:00Z',
  },
  {
    id: 'e18',
    date: '2026-10-16',
    studentId: 'u6',
    studentName: 'Nodira Rashidova',
    internshipId: 'i4',
    company: 'Click MChJ',
    title: 'A/B test natijalarini baholash',
    content: "Ro'yxatdan o'tish oqimining ikki varianti uchun A/B test natijalari tahlil qilindi. B variant 18% yuqori konversiya ko'rsatdi.",
    tasks: [
      'Mixpanel ma\'lumotlarini eksport qilish',
      'Statistik tahlil',
      'Tavsiyalar tayyorlash',
    ],
    hours: 6,
    status: 'approved',
    reviewedAt: '2026-10-17T10:00:00Z',
    reviewedBy: 'Zulfiya Mirzayeva',
    createdAt: '2026-10-16T16:00:00Z',
  },
  {
    id: 'e19',
    date: '2026-10-28',
    studentId: 'u3',
    studentName: 'Jasur Toshmatov',
    internshipId: 'i1',
    company: 'Uzcard MChJ',
    title: 'Qoralama yozuv',
    content: "Bugungi ish jarayonida karta tranzaksiyalari sahifasida progress bar va loading skeleton komponentlari ustida ishladim.",
    tasks: [],
    hours: 3,
    status: 'draft',
    createdAt: '2026-10-28T13:00:00Z',
  },
  {
    id: 'e20',
    date: '2026-10-15',
    studentId: 'u5',
    studentName: 'Bobur Karimov',
    internshipId: 'i3',
    company: 'Beeline Uzbekistan',
    title: 'WebSocket integratsiyasi',
    content: "Real-vaqt bildirishnomalar uchun Socket.io integratsiyasini amalga oshirdim.",
    tasks: [
      'Socket.io server tomonini sozlash',
      'Client tarafida ulanish',
      'Xonalar va hodisalar boshqaruvi',
    ],
    hours: 8,
    status: 'approved',
    supervisorComment: 'Real-vaqt xususiyati mukammal ishlaydi.',
    reviewedAt: '2026-10-16T09:00:00Z',
    reviewedBy: 'Sherzod Nazarov',
    createdAt: '2026-10-15T18:00:00Z',
  },
];

// ─── Weekly stats (for Reports page) ─────────────────────────────────────────

export const MOCK_WEEKLY_STATS: WeeklyStats[] = [
  { week: '1-7 Sep', submitted: 12, approved: 8, rejected: 1 },
  { week: '8-14 Sep', submitted: 18, approved: 15, rejected: 2 },
  { week: '15-21 Sep', submitted: 22, approved: 20, rejected: 1 },
  { week: '22-28 Sep', submitted: 25, approved: 22, rejected: 3 },
  { week: '29 Sep-5 Oct', submitted: 28, approved: 24, rejected: 2 },
  { week: '6-12 Oct', submitted: 30, approved: 27, rejected: 2 },
  { week: '13-19 Oct', submitted: 26, approved: 24, rejected: 1 },
  { week: '20-26 Oct', submitted: 24, approved: 20, rejected: 3 },
];

// ─── Derived helpers ──────────────────────────────────────────────────────────

export const CURRENT_MOCK_USER: MockUser = MOCK_USERS[0]!; // Admin view by default

export function getStatusLabel(status: EntryStatus): string {
  const labels: Record<EntryStatus, string> = {
    draft: 'Qoralama',
    submitted: 'Yuborilgan',
    approved: 'Tasdiqlangan',
    rejected: 'Rad etilgan',
    returned: 'Qaytarilgan',
  };
  return labels[status];
}

export function getInternshipStatusLabel(status: InternshipStatus): string {
  const labels: Record<InternshipStatus, string> = {
    active: 'Faol',
    completed: 'Tugallangan',
    cancelled: 'Bekor qilingan',
  };
  return labels[status];
}

export function getRoleLabel(role: UserRole): string {
  const labels: Record<UserRole, string> = {
    admin: 'Administrator',
    student: 'Talaba',
    supervisor: 'Rahbar',
  };
  return labels[role];
}

export function getUserStatusLabel(status: UserStatus): string {
  return status === 'active' ? 'Faol' : 'Nofaol';
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('uz-UZ', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

export function getDashboardStats() {
  const activeInternships = MOCK_INTERNSHIPS.filter((i) => i.status === 'active');
  const totalDays = activeInternships.reduce((s, i) => s + i.submittedEntries, 0);
  const submittedEntries = MOCK_DIARY_ENTRIES.filter(
    (e) => e.status === 'submitted' || e.status === 'approved' || e.status === 'rejected',
  ).length;
  const approvedEntries = MOCK_DIARY_ENTRIES.filter((e) => e.status === 'approved').length;
  const pendingReviews = MOCK_DIARY_ENTRIES.filter((e) => e.status === 'submitted').length;

  return { totalDays, submittedEntries, approvedEntries, pendingReviews };
}
