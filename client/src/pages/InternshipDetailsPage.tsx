import { useParams, Link } from 'react-router-dom';
import {
  Building2,
  Calendar,
  MapPin,
  Clock,
  Mail,
  Phone,
  ChevronRight,
  Download,
} from 'lucide-react';
import {
  MOCK_INTERNSHIPS,
  MOCK_DIARY_ENTRIES,
  formatDate,
} from '@/data/mock';
import { Card, Button } from '@/components/ui';
import { InternshipStatusBadge, StatusBadge } from '@/components/ui/Badge';

export default function InternshipDetailsPage() {
  const { id = 'i1' } = useParams<{ id: string }>();

  // Find target internship or default to first
  const internship = MOCK_INTERNSHIPS.find((i) => i.id === id) || MOCK_INTERNSHIPS[0]!;

  // Filter entries belonging to this internship
  const entries = MOCK_DIARY_ENTRIES.filter((e) => e.internshipId === internship.id);

  const progressPercent = Math.round((internship.approvedEntries / internship.totalDays) * 100);

  return (
    <div className="space-y-6">
      {/* Top Breadcrumb & Status */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
            <Link to="/dashboard" className="hover:text-slate-600">Bosh sahifa</Link>
            <ChevronRight className="h-3 w-3" />
            <span>Amaliyot dasturi</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            {internship.company} — {internship.position}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Talaba: <strong className="text-slate-700">{internship.studentName}</strong> | Bo'lim: {internship.department}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <InternshipStatusBadge status={internship.status} />
          <Button variant="outline" size="sm" className="gap-1.5 text-xs">
            <Download className="h-3.5 w-3.5" />
            Amaliyot shartnomasi (PDF)
          </Button>
        </div>
      </div>

      {/* Overview Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Column: Internship Info Card & Supervisor */}
        <div className="space-y-6">
          {/* Main Info */}
          <Card className="p-5 border-slate-200/80 space-y-4">
            <h3 className="font-semibold text-sm text-slate-900 border-b border-slate-100 pb-2">
              Amaliyot ma'lumotlari
            </h3>
            <div className="space-y-3 text-xs">
              <div className="flex items-start gap-2.5">
                <Building2 className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
                <div>
                  <span className="text-slate-400 block">Qabul qiluvchi tashkilot:</span>
                  <span className="font-semibold text-slate-800">{internship.company}</span>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <MapPin className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
                <div>
                  <span className="text-slate-400 block">Manzil:</span>
                  <span className="text-slate-700">{internship.address}</span>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <Calendar className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
                <div>
                  <span className="text-slate-400 block">Amaliyot davri:</span>
                  <span className="font-semibold text-slate-800">
                    {formatDate(internship.startDate)} — {formatDate(internship.endDate)}
                  </span>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <Clock className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
                <div>
                  <span className="text-slate-400 block">Rejalashtirilgan davomiylik:</span>
                  <span className="font-semibold text-slate-800">{internship.totalDays} ish kuni</span>
                </div>
              </div>
            </div>
          </Card>

          {/* Supervisor Info */}
          <Card className="p-5 border-slate-200/80 space-y-3">
            <h3 className="font-semibold text-sm text-slate-900 border-b border-slate-100 pb-2">
              Korxona rahbari
            </h3>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-indigo-100 text-indigo-700 font-semibold flex items-center justify-center shrink-0">
                SN
              </div>
              <div className="min-w-0">
                <div className="font-semibold text-xs text-slate-900">{internship.supervisorName}</div>
                <div className="text-[11px] text-slate-500">Amaliyot rahbari (Mentor)</div>
              </div>
            </div>
            <div className="space-y-1.5 pt-2 text-xs border-t border-slate-100">
              <div className="flex items-center gap-2 text-slate-600">
                <Mail className="h-3.5 w-3.5 text-slate-400" />
                <span>sherzod@uzcard.uz</span>
              </div>
              <div className="flex items-center gap-2 text-slate-600">
                <Phone className="h-3.5 w-3.5 text-slate-400" />
                <span>+998 90 789-01-23</span>
              </div>
            </div>
          </Card>
        </div>

        {/* Right Column: Progress & Diary Entries Log */}
        <div className="md:col-span-2 space-y-6">
          {/* Progress Card */}
          <Card className="p-5 border-slate-200/80 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-sm text-slate-900">Amaliyot bajarilish ko'rsatkichi</h3>
                <p className="text-xs text-slate-500 mt-0.5">Tasdiqlangan kunlar hisoboti</p>
              </div>
              <div className="text-right">
                <span className="text-2xl font-bold text-indigo-600">{progressPercent}%</span>
                <span className="text-xs text-slate-400 block">bajarildi</span>
              </div>
            </div>

            {/* Progress bar */}
            <div className="space-y-1.5">
              <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                <div
                  className="bg-indigo-600 h-full rounded-full transition-all duration-500"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-500">
                <span>0 kun</span>
                <span>Tasdiqlangan: {internship.approvedEntries} kun</span>
                <span>Jami: {internship.totalDays} kun</span>
              </div>
            </div>

            {/* Quick Metrics */}
            <div className="grid grid-cols-3 gap-3 pt-3 border-t border-slate-100 text-center">
              <div className="p-2 rounded-lg bg-slate-50">
                <span className="text-slate-400 text-[11px] block">Topshirilgan</span>
                <span className="font-bold text-sm text-slate-800">{internship.submittedEntries} ta</span>
              </div>
              <div className="p-2 rounded-lg bg-emerald-50">
                <span className="text-emerald-600 text-[11px] block">Tasdiqlangan</span>
                <span className="font-bold text-sm text-emerald-800">{internship.approvedEntries} ta</span>
              </div>
              <div className="p-2 rounded-lg bg-amber-50">
                <span className="text-amber-600 text-[11px] block">Kutilmoqda</span>
                <span className="font-bold text-sm text-amber-800">{internship.pendingEntries} ta</span>
              </div>
            </div>
          </Card>

          {/* Description */}
          <Card className="p-5 border-slate-200/80 space-y-2">
            <h3 className="font-semibold text-sm text-slate-900">Amaliyot rejasi va dasturi tavsifi</h3>
            <p className="text-xs text-slate-600 leading-relaxed">{internship.description}</p>
          </Card>

          {/* Related Entries */}
          <Card className="p-0 overflow-hidden border-slate-200/80">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-semibold text-sm text-slate-900">Ushbu amaliyot kundalik yozuvlari</h3>
              <Link to="/diary/new">
                <Button size="sm" variant="outline" className="text-xs h-7">
                  + Yangi yozuv qo'shish
                </Button>
              </Link>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider border-b border-slate-100">
                    <th className="py-2.5 px-4">Sana</th>
                    <th className="py-2.5 px-4">Mavzu</th>
                    <th className="py-2.5 px-4">Sarflangan vaqt</th>
                    <th className="py-2.5 px-4">Holat</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {entries.slice(0, 5).map((entry) => (
                    <tr key={entry.id} className="hover:bg-slate-50/50">
                      <td className="py-2.5 px-4 whitespace-nowrap text-slate-600 font-medium">
                        {formatDate(entry.date)}
                      </td>
                      <td className="py-2.5 px-4 font-semibold text-slate-800">
                        {entry.title}
                      </td>
                      <td className="py-2.5 px-4 whitespace-nowrap text-slate-500">
                        {entry.hours} soat
                      </td>
                      <td className="py-2.5 px-4 whitespace-nowrap">
                        <StatusBadge status={entry.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
