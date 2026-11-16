import { useCallback, useEffect, useState } from 'react';
import { NavLink, Outlet, Navigate, useNavigate, useLocation, Link } from 'react-router-dom';
import {
  LayoutDashboard,
  BookOpen,
  Calendar,
  Briefcase,
  CheckSquare,
  Award,
  BarChart3,
  Users,
  LogOut,
  Menu,
  X,
  GraduationCap,
  Bell,
  Search,
  ChevronDown,
  Send,
  Table2,
  Building2,
  ClipboardList,
  KeyRound,
  Languages,
  AlertTriangle,
  CheckCircle2,
  Info,
} from 'lucide-react';
import { useAuth, UserRole } from '@/context/AuthContext';
import { RoleBadge } from '@/components/ui/Badge';
import { LoadingState } from '@/components/ui/FeedbackStates';
import { fetchNotifications } from '@/lib/dataService';
import type { NotificationItem } from '@/lib/types';
import { ROLE_LABELS } from '@/lib/types';
import { useI18n } from '@/i18n';

const ALL: UserRole[] = ['ADMIN', 'STUDENT', 'COMPANY_SUPERVISOR', 'UNIVERSITY_SUPERVISOR'];
const STAFF: UserRole[] = ['ADMIN', 'COMPANY_SUPERVISOR', 'UNIVERSITY_SUPERVISOR'];

const SEEN_KEY = 'seen_notifications';
function readSeen(): string[] {
  try {
    return JSON.parse(localStorage.getItem(SEEN_KEY) || '[]');
  } catch {
    return [];
  }
}

export function DashboardLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t, lang, setLang } = useI18n();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [seen, setSeen] = useState<string[]>(readSeen);
  const { user, isLoading, logout } = useAuth();

  const loadNotifications = useCallback(() => {
    if (!user) return;
    fetchNotifications()
      .then(setNotifications)
      .catch(() => setNotifications([]));
  }, [user]);

  useEffect(() => {
    loadNotifications();
    const id = setInterval(loadNotifications, 120000);
    return () => clearInterval(id);
  }, [loadNotifications, location.pathname]);

  useEffect(() => {
    setSidebarOpen(false);
    setBellOpen(false);
    setProfileOpen(false);
  }, [location.pathname]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <LoadingState message={t("Foydalanuvchi ma'lumotlari yuklanmoqda...")} />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;

  const sections: { title: string; items: { name: string; href: string; icon: typeof LayoutDashboard; roles: UserRole[] }[] }[] = [
    {
      title: t("Asosiy bo'limlar"),
      items: [
        { name: t('Bosh sahifa'), href: '/dashboard', icon: LayoutDashboard, roles: ALL },
        { name: t('Kundalik daftari'), href: '/diary', icon: BookOpen, roles: ALL },
        { name: t('Davomat kalendari'), href: '/attendance', icon: Calendar, roles: ALL },
        { name: t('Mening amaliyotim'), href: '/internship/mine', icon: Briefcase, roles: ['STUDENT'] },
        { name: t('Amaliyotlar'), href: '/internships', icon: Briefcase, roles: STAFF },
        { name: t('Guruh jurnali'), href: '/journal', icon: Table2, roles: STAFF },
        { name: t('Tekshirish va tasdiqlash'), href: '/reviews', icon: CheckSquare, roles: STAFF },
        { name: t('Yakuniy baholash'), href: '/evaluation', icon: Award, roles: ALL },
        { name: t('Hisobot va statistika'), href: '/reports', icon: BarChart3, roles: STAFF },
      ],
    },
    {
      title: t('Boshqaruv'),
      items: [
        { name: t('Foydalanuvchilar'), href: '/users', icon: Users, roles: ['ADMIN'] },
        { name: t('Korxonalar va guruhlar'), href: '/catalog', icon: Building2, roles: ['ADMIN'] },
        { name: t('Profil va Telegram'), href: '/profile', icon: Send, roles: ALL },
      ],
    },
  ];

  const unread = notifications.filter((n) => !seen.includes(n.id));
  const markAllSeen = () => {
    const ids = Array.from(new Set([...seen, ...notifications.map((n) => n.id)])).slice(-200);
    setSeen(ids);
    try {
      localStorage.setItem(SEEN_KEY, JSON.stringify(ids));
    } catch {
      /* ignore */
    }
  };

  const onSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = search.trim();
    if (!q) return;
    navigate(`/diary?search=${encodeURIComponent(q)}`);
  };

  const roleLabel = t(ROLE_LABELS[user.role] || user.role);
  const initials = user.fullName
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const notifIcon = (type: NotificationItem['type']) =>
    type === 'warning' ? <AlertTriangle className="h-4 w-4 text-amber-500" /> : type === 'success' ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : type === 'action' ? <ClipboardList className="h-4 w-4 text-indigo-500" /> : <Info className="h-4 w-4 text-sky-500" />;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col lg:flex-row text-slate-900 font-sans antialiased">
      {sidebarOpen && <div className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm lg:hidden" onClick={() => setSidebarOpen(false)} />}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-72 bg-white border-r border-slate-200/80 flex flex-col transition-transform duration-200 ease-in-out lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="h-16 px-5 border-b border-slate-100 flex items-center justify-between shrink-0">
          <Link to="/dashboard" className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-200">
              <GraduationCap className="h-6 w-6" />
            </div>
            <div>
              <span className="font-bold text-base text-slate-900 tracking-tight block">{t('Amaliyot Kundaligi')}</span>
              <span className="text-[11px] font-medium text-slate-400 block tracking-wider uppercase">{t("Professional ta'lim")}</span>
            </div>
          </Link>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100" aria-label={t('Yopish')}>
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-3 mx-4 my-3 rounded-xl bg-slate-50/80 border border-slate-100 flex items-center gap-3 shrink-0">
          <div className="h-10 w-10 rounded-full bg-indigo-100 border border-indigo-200 flex items-center justify-center font-semibold text-indigo-700 shrink-0">{initials}</div>
          <div className="min-w-0 flex-1">
            <h4 className="text-sm font-semibold text-slate-800 truncate">{user.fullName}</h4>
            <div className="mt-0.5">
              <RoleBadge role={user.role} />
            </div>
          </div>
        </div>

        <nav className="flex-1 px-3 overflow-y-auto pb-3 space-y-4">
          {sections.map((sec) => {
            const items = sec.items.filter((i) => i.roles.includes(user.role));
            if (!items.length) return null;
            return (
              <div key={sec.title} className="space-y-0.5">
                <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-3 mb-1.5">{sec.title}</div>
                {items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.href}
                      to={item.href}
                      className={({ isActive }) =>
                        `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                          isActive || (item.href === '/internship/mine' && location.pathname.startsWith('/internship/'))
                            ? 'bg-indigo-50 text-indigo-700 font-semibold'
                            : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                        }`
                      }
                    >
                      <Icon className="h-4.5 w-4.5 shrink-0" />
                      <span>{item.name}</span>
                      {item.href === '/reviews' && notifications.some((n) => n.link === '/reviews') && (
                        <span className="ml-auto h-2 w-2 rounded-full bg-amber-500" />
                      )}
                    </NavLink>
                  );
                })}
              </div>
            );
          })}
        </nav>

        <div className="p-3 border-t border-slate-100 shrink-0">
          <button onClick={() => logout()} className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-rose-50 hover:text-rose-600 transition-colors">
            <LogOut className="h-4.5 w-4.5" />
            <span>{t('Tizimdan chiqish')}</span>
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-16 bg-white/95 backdrop-blur border-b border-slate-200/80 px-3 sm:px-6 flex items-center justify-between gap-2 sticky top-0 z-30">
          <div className="flex items-center gap-2 min-w-0">
            <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-2 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100" aria-label={t('Menyu')}>
              <Menu className="h-5 w-5" />
            </button>
            <form onSubmit={onSearch} className="hidden sm:flex items-center relative w-56 md:w-80" role="search">
              <Search className="h-4 w-4 absolute left-3 text-slate-400" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('Kundaliklardan qidirish (talaba, korxona, mavzu)...')}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
              />
            </form>
          </div>

          <div className="flex items-center gap-1 sm:gap-2">
            {/* Language */}
            <button
              onClick={() => setLang(lang === 'uz' ? 'ru' : 'uz')}
              className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100"
              title={lang === 'uz' ? 'Русский язык' : "O'zbek tili"}
            >
              <Languages className="h-4 w-4" />
              <span className="uppercase">{lang === 'uz' ? 'RU' : 'UZ'}</span>
            </button>

            {/* Notifications */}
            <div className="relative">
              <button
                onClick={() => {
                  setBellOpen(!bellOpen);
                  setProfileOpen(false);
                }}
                className="p-2 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100 relative"
                aria-label={t('Bildirishnomalar')}
              >
                <Bell className="h-5 w-5" />
                {unread.length > 0 && (
                  <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-white">
                    {unread.length}
                  </span>
                )}
              </button>
              {bellOpen && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setBellOpen(false)} />
                  <div className="absolute right-0 mt-2 w-[min(22rem,calc(100vw-1.5rem))] rounded-xl bg-white border border-slate-200/80 shadow-lg z-40 overflow-hidden">
                    <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                      <span className="text-sm font-semibold text-slate-900">{t('Bildirishnomalar')}</span>
                      {unread.length > 0 && (
                        <button onClick={markAllSeen} className="text-xs text-indigo-600 font-medium hover:underline">
                          {t("Hammasini o'qildi deb belgilash")}
                        </button>
                      )}
                    </div>
                    <div className="max-h-96 overflow-y-auto divide-y divide-slate-100">
                      {notifications.length === 0 ? (
                        <div className="px-4 py-8 text-center text-xs text-slate-500">{t("Yangi bildirishnomalar yo'q")}</div>
                      ) : (
                        notifications.map((n) => (
                          <button
                            key={n.id}
                            onClick={() => {
                              setBellOpen(false);
                              if (n.link) navigate(n.link);
                            }}
                            className={`w-full text-left px-4 py-3 flex gap-3 hover:bg-slate-50 ${seen.includes(n.id) ? 'opacity-70' : ''}`}
                          >
                            <span className="mt-0.5 shrink-0">{notifIcon(n.type)}</span>
                            <span className="min-w-0">
                              <span className="block text-xs font-semibold text-slate-900">{t(n.title)}</span>
                              <span className="block text-xs text-slate-600 mt-0.5 break-words">{n.message}</span>
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Profile */}
            <div className="relative">
              <button
                onClick={() => {
                  setProfileOpen(!profileOpen);
                  setBellOpen(false);
                }}
                className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-slate-50 transition-colors text-left"
              >
                <div className="h-8 w-8 rounded-full bg-indigo-600 text-white font-medium text-xs flex items-center justify-center">{initials}</div>
                <div className="hidden md:block">
                  <div className="text-xs font-semibold text-slate-800 leading-tight">{user.fullName}</div>
                  <div className="text-[11px] text-slate-500 leading-tight">{roleLabel}</div>
                </div>
                <ChevronDown className="h-4 w-4 text-slate-400 hidden md:block" />
              </button>
              {profileOpen && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setProfileOpen(false)} />
                  <div className="absolute right-0 mt-2 w-56 rounded-xl bg-white border border-slate-200/80 shadow-lg py-1 z-40">
                    <div className="px-4 py-2 border-b border-slate-100">
                      <p className="text-xs font-semibold text-slate-900">{user.fullName}</p>
                      <p className="text-xs text-slate-500 truncate">{user.email}</p>
                      <span className="inline-block mt-1 text-[10px] font-semibold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">{roleLabel}</span>
                    </div>
                    <button onClick={() => navigate('/profile')} className="w-full text-left px-4 py-2 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2">
                      <Send className="h-3.5 w-3.5 text-[#229ED9]" />
                      {t('Profil va Telegram bot')}
                    </button>
                    <button onClick={() => navigate('/profile#password')} className="w-full text-left px-4 py-2 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2">
                      <KeyRound className="h-3.5 w-3.5" />
                      {t("Parolni o'zgartirish")}
                    </button>
                    <button onClick={() => logout()} className="w-full text-left px-4 py-2 text-xs text-rose-600 hover:bg-rose-50 flex items-center gap-2 border-t border-slate-100">
                      <LogOut className="h-3.5 w-3.5" />
                      {t('Chiqish')}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {user.mustChangePassword && !location.pathname.startsWith('/profile') && (
          <div className="bg-amber-50 border-b border-amber-200 px-4 sm:px-6 py-2.5 text-xs text-amber-800 flex flex-wrap items-center gap-2">
            <KeyRound className="h-4 w-4 shrink-0" />
            <span>{t('Siz vaqtinchalik parol bilan kirdingiz. Xavfsizlik uchun parolingizni almashtiring.')}</span>
            <Link to="/profile#password" className="font-semibold underline">
              {t('Parolni almashtirish')}
            </Link>
          </div>
        )}

        <main className="flex-1 p-3 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
