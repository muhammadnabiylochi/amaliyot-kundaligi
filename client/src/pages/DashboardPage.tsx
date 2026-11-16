import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Calendar,
  Send,
  CheckCircle,
  Clock,
  ArrowRight,
  TrendingUp,
  Building2,
  FileText,
  Search,
  Eye,
} from 'lucide-react';
import {
  formatDate,
  MockDiaryEntry,
  MockInternship,
} from '@/data/mock';
import {
  fetchDashboardStats,
  fetchDiaryEntries,
  fetchInternships,
  DashboardStatsResponse,
} from '@/lib/dataService';
import { Card, Button } from '@/components/ui';
import { StatusBadge, InternshipStatusBadge } from '@/components/ui/Badge';

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStatsResponse>({
    totalDays: 0,
    submittedEntries: 0,
    approvedEntries: 0,
    pendingReviews: 0,
  });
  const [entries, setEntries] = useState<MockDiaryEntry[]>([]);
  const [internships, setInternships] = useState<MockInternship[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    let mounted = true;

    async function loadData() {
      const [statsData, entriesData, internshipsData] = await Promise.all([
        fetchDashboardStats(),
        fetchDiaryEntries({ limit: 10 }),
        fetchInternships(),
      ]);

      if (mounted) {
        setStats(statsData);
        setEntries(entriesData);
        setInternships(internshipsData);
      }
    }

    loadData();
    return () => {
      mounted = false;
    };
  }, []);

  const filteredEntries = entries.filter((entry) => {
    const matchesSearch =
      entry.studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      entry.company.toLowerCase().includes(searchTerm.toLowerCase()) ||
      entry.title.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || entry.status === statusFilter;
    return matchesSearch && matchesStatus;
  }).slice(0, 6);

  return (
    <div className="space-y-6">
      {/* Top Welcome Section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Boshqaruv paneli (Dashboard)
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Universitet amaliyoti monitoringi va kundaliklar faolligi ko'rsatkichlari
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Link to="/diary/new">
            <Button size="sm" className="gap-2">
              <FileText className="h-4 w-4" />
              Yangi kundalik yozuvi
            </Button>
          </Link>
          <Link to="/reports">
            <Button variant="outline" size="sm">
              Hisobotlar
            </Button>
          </Link>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Internship Days */}
        <Card className="p-5 border-slate-200/80 hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              O'tilgan amaliyot kunlari
            </span>
            <div className="h-9 w-9 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Calendar className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">{stats.totalDays} kun</span>
            <span className="text-xs font-medium text-emerald-600 flex items-center gap-0.5">
              <TrendingUp className="h-3 w-3" /> +12%
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">4 ta faol amaliyotchi talaba hisobiga</p>
        </Card>

        {/* Card 2: Submitted Entries */}
        <Card className="p-5 border-slate-200/80 hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Yuborilgan yozuvlar
            </span>
            <div className="h-9 w-9 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center">
              <Send className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">{stats.submittedEntries} ta</span>
          </div>
          <p className="text-xs text-slate-400 mt-1">Talabalar tomonidan topshirilgan</p>
        </Card>

        {/* Card 3: Approved Entries */}
        <Card className="p-5 border-slate-200/80 hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Tasdiqlangan yozuvlar
            </span>
            <div className="h-9 w-9 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">{stats.approvedEntries} ta</span>
            <span className="text-xs font-medium text-emerald-600">88%</span>
          </div>
          <p className="text-xs text-slate-400 mt-1">Rahbarlar tomonidan qabul qilingan</p>
        </Card>

        {/* Card 4: Pending Reviews */}
        <Card className="p-5 border-slate-200/80 hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Kutilayotgan tekshiruvlar
            </span>
            <div className="h-9 w-9 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <Clock className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-amber-600">{stats.pendingReviews} ta</span>
            <span className="text-xs font-medium text-amber-600">Diqqat talab</span>
          </div>
          <p className="text-xs text-slate-400 mt-1">Rahbar tasdig'i kutilmoqda</p>
        </Card>
      </div>

      {/* Main Grid: Active Internships & Recent Entries */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Recent Diary Entries (2 cols) */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="p-0 overflow-hidden border-slate-200/80">
            <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h3 className="font-semibold text-slate-900">So'nggi kundalik yozuvlari</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Talabalarning kunlik bajargan amaliyot ishlari
                </p>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative w-44">
                  <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Qidirish..."
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-md pl-8 pr-2.5 py-1 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="text-xs bg-slate-50 border border-slate-200 rounded-md px-2.5 py-1 text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="all">Barchasi</option>
                  <option value="submitted">Kutilmoqda</option>
                  <option value="approved">Tasdiqlangan</option>
                  <option value="draft">Qoralama</option>
                </select>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50/75 border-b border-slate-100 text-slate-500 font-semibold uppercase tracking-wider">
                    <th className="py-3 px-4">Sana</th>
                    <th className="py-3 px-4">Talaba</th>
                    <th className="py-3 px-4">Tashkilot &amp; Mavzu</th>
                    <th className="py-3 px-4">Holat</th>
                    <th className="py-3 px-4 text-right">Amal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {filteredEntries.map((entry) => (
                    <tr key={entry.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-3 px-4 whitespace-nowrap font-medium text-slate-600">
                        {formatDate(entry.date)}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap font-semibold text-slate-900">
                        {entry.studentName}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-900 line-clamp-1">{entry.title}</div>
                        <div className="text-[11px] text-slate-400">{entry.company}</div>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <StatusBadge status={entry.status} />
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap text-right">
                        <Link to={`/diary`}>
                          <Button variant="ghost" size="sm" className="h-7 px-2 text-indigo-600 hover:text-indigo-700">
                            <Eye className="h-3.5 w-3.5 mr-1" />
                            Ko'rish
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="p-3 bg-slate-50/50 border-t border-slate-100 text-center">
              <Link to="/diary" className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 inline-flex items-center gap-1">
                Barcha kundaliklarni ko'rish ({entries.length} ta)
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </Card>
        </div>

        {/* Right Column: Active Internship Programs */}
        <div className="space-y-4">
          <Card className="p-5 border-slate-200/80">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-semibold text-slate-900 text-sm">Faol amaliyot dasturlari</h3>
              <Link to="/internship/i1" className="text-xs text-indigo-600 font-medium hover:underline">
                Barchasi
              </Link>
            </div>

            <div className="divide-y divide-slate-100 mt-2">
              {internships.slice(0, 4).map((internship) => {
                const progressPct = internship.totalDays > 0
                  ? Math.round((internship.approvedEntries / internship.totalDays) * 100)
                  : 0;
                return (
                  <div key={internship.id} className="py-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <Link
                          to={`/internship/${internship.id}`}
                          className="font-semibold text-xs text-slate-900 hover:text-indigo-600 transition-colors"
                        >
                          {internship.studentName}
                        </Link>
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mt-0.5">
                          <Building2 className="h-3 w-3 text-slate-400" />
                          <span>{internship.company}</span>
                        </div>
                      </div>
                      <InternshipStatusBadge status={internship.status} />
                    </div>

                    {/* Progress Bar */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[11px] text-slate-500">
                        <span>Bajarilgan: {internship.approvedEntries}/{internship.totalDays} kun</span>
                        <span className="font-medium text-slate-700">{progressPct}%</span>
                      </div>
                      <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                        <div
                          className="bg-indigo-600 h-full rounded-full transition-all duration-300"
                          style={{ width: `${progressPct}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100">
              <Link to="/reviews">
                <Button variant="outline" size="sm" className="w-full justify-center text-xs">
                  Rahbar tekshiruvi sahifasiga o'tish
                </Button>
              </Link>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
