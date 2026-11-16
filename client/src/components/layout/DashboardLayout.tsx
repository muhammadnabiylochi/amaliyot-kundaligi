import { useState } from 'react';
import { NavLink, Outlet, Navigate } from 'react-router-dom';
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
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { RoleBadge } from '@/components/ui/Badge';
import { LoadingState } from '@/components/ui/FeedbackStates';

export function DashboardLayout() {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const { user, isLoading, logout } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <LoadingState message="Foydalanuvchi ma'lumotlari yuklanmoqda..." />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Role-based navigation visibility
  const navigation = [
    { name: 'Bosh sahifa', href: '/dashboard', icon: LayoutDashboard, roles: ['ADMIN', 'STUDENT', 'COMPANY_SUPERVISOR', 'UNIVERSITY_SUPERVISOR'] },
    { name: 'Kundalik daftari', href: '/diary', icon: BookOpen, roles: ['ADMIN', 'STUDENT', 'COMPANY_SUPERVISOR', 'UNIVERSITY_SUPERVISOR'] },
    { name: 'Davomat kalendari', href: '/attendance', icon: Calendar, roles: ['ADMIN', 'STUDENT', 'COMPANY_SUPERVISOR', 'UNIVERSITY_SUPERVISOR'] },
    { name: 'Amaliyot tafsilotlari', href: '/internship/clinternship001jasur', icon: Briefcase, roles: ['ADMIN', 'STUDENT', 'COMPANY_SUPERVISOR', 'UNIVERSITY_SUPERVISOR'] },
    { name: 'Tekshirish va tasdiqlash', href: '/reviews', icon: CheckSquare, roles: ['ADMIN', 'COMPANY_SUPERVISOR', 'UNIVERSITY_SUPERVISOR'] },
    { name: 'Yakuniy baholash', href: '/evaluation', icon: Award, roles: ['ADMIN', 'STUDENT', 'COMPANY_SUPERVISOR', 'UNIVERSITY_SUPERVISOR'] },
    { name: 'Hisobot va statistika', href: '/reports', icon: BarChart3, roles: ['ADMIN', 'COMPANY_SUPERVISOR', 'UNIVERSITY_SUPERVISOR'] },
    { name: 'Foydalanuvchilar', href: '/users', icon: Users, roles: ['ADMIN', 'COMPANY_SUPERVISOR', 'UNIVERSITY_SUPERVISOR'] },
    { name: 'Profil va Telegram', href: '/profile', icon: Send, roles: ['ADMIN', 'STUDENT', 'COMPANY_SUPERVISOR', 'UNIVERSITY_SUPERVISOR'] },
  ].filter((item) => item.roles.includes(user.role));

  const roleLabelMap: Record<string, string> = {
    ADMIN: 'Administrator',
    STUDENT: 'Talaba',
    COMPANY_SUPERVISOR: 'Korxona rahbari',
    UNIVERSITY_SUPERVISOR: 'Universitet rahbari',
  };

  const roleLower = user.role === 'ADMIN' ? 'admin' : user.role === 'STUDENT' ? 'student' : 'supervisor';

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col lg:flex-row text-slate-900 font-sans antialiased">
      {/* Mobile Sidebar Backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm lg:hidden transition-opacity"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-72 bg-white border-r border-slate-200/80 flex flex-col transition-transform duration-200 ease-in-out lg:static lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Logo / Brand */}
        <div className="h-16 px-6 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-200">
              <GraduationCap className="h-6 w-6" />
            </div>
            <div>
              <span className="font-bold text-base text-slate-900 tracking-tight block">Amaliyot Kundaligi</span>
              <span className="text-[11px] font-medium text-slate-400 block tracking-wider uppercase">Elektron tizim</span>
            </div>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* User Mini Profile */}
        <div className="p-4 mx-4 my-3 rounded-xl bg-slate-50/80 border border-slate-100 flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-indigo-100 border border-indigo-200 flex items-center justify-center font-semibold text-indigo-700 shrink-0">
            {user.fullName.slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="text-sm font-semibold text-slate-800 truncate">{user.fullName}</h4>
            <div className="flex items-center gap-1.5 mt-0.5">
              <RoleBadge role={roleLower} />
            </div>
          </div>
        </div>

        {/* Navigation links */}
        <nav className="flex-1 px-4 space-y-1 overflow-y-auto pt-2">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-3 mb-2">
            Asosiy bo'limlar
          </div>
          {navigation.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.name}
                to={item.href}
                onClick={() => setSidebarOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-indigo-50 text-indigo-700 font-semibold shadow-xs'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`
                }
              >
                <Icon className="h-4.5 w-4.5 shrink-0" />
                <span>{item.name}</span>
              </NavLink>
            );
          })}
        </nav>

        {/* Logout bottom area */}
        <div className="p-4 border-t border-slate-100">
          <button
            onClick={() => logout()}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-rose-50 hover:text-rose-600 transition-colors"
          >
            <LogOut className="h-4.5 w-4.5" />
            <span>Tizimdan chiqish</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <header className="h-16 bg-white border-b border-slate-200/80 px-4 sm:px-6 flex items-center justify-between sticky top-0 z-30">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="hidden sm:flex items-center relative w-64 md:w-80">
              <Search className="h-4 w-4 absolute left-3 text-slate-400" />
              <input
                type="text"
                placeholder="Qidiruv (talaba, tashkilot, vazifa)..."
                className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Notification button */}
            <button className="p-2 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100 relative">
              <Bell className="h-5 w-5" />
              <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-indigo-600 ring-2 ring-white" />
            </button>

            {/* User Dropdown */}
            <div className="relative">
              <button
                onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-slate-50 transition-colors text-left"
              >
                <div className="h-8 w-8 rounded-full bg-indigo-600 text-white font-medium text-xs flex items-center justify-center">
                  {user.fullName.slice(0, 2).toUpperCase()}
                </div>
                <div className="hidden md:block">
                  <div className="text-xs font-semibold text-slate-800 leading-tight">
                    {user.fullName}
                  </div>
                  <div className="text-[11px] text-slate-500 leading-tight">
                    {roleLabelMap[user.role] || user.role}
                  </div>
                </div>
                <ChevronDown className="h-4 w-4 text-slate-400 hidden md:block" />
              </button>

              {/* Dropdown Menu */}
              {profileDropdownOpen && (
                <>
                  <div
                    className="fixed inset-0 z-30"
                    onClick={() => setProfileDropdownOpen(false)}
                  />
                  <div className="absolute right-0 mt-2 w-56 rounded-xl bg-white border border-slate-200/80 shadow-lg py-1 z-40">
                    <div className="px-4 py-2 border-b border-slate-100">
                      <p className="text-xs font-semibold text-slate-900">{user.fullName}</p>
                      <p className="text-xs text-slate-500 truncate">{user.email}</p>
                      <span className="inline-block mt-1 text-[10px] font-semibold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">
                        {roleLabelMap[user.role] || user.role}
                      </span>
                    </div>
                    <button
                      onClick={() => {
                        setProfileDropdownOpen(false);
                        navigate('/dashboard');
                      }}
                      className="w-full text-left px-4 py-2 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                    >
                      <LayoutDashboard className="h-3.5 w-3.5" />
                      Dashboard
                    </button>
                    <button
                      onClick={() => {
                        setProfileDropdownOpen(false);
                        navigate('/profile');
                      }}
                      className="w-full text-left px-4 py-2 text-xs text-indigo-700 hover:bg-indigo-50 font-medium flex items-center gap-2"
                    >
                      <Send className="h-3.5 w-3.5 text-[#229ED9]" />
                      Profil va Telegram bot
                    </button>
                    <button
                      onClick={() => {
                        setProfileDropdownOpen(false);
                        logout();
                      }}
                      className="w-full text-left px-4 py-2 text-xs text-rose-600 hover:bg-rose-50 flex items-center gap-2 border-t border-slate-100"
                    >
                      <LogOut className="h-3.5 w-3.5" />
                      Chiqish
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {/* Page Content Outlet */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
