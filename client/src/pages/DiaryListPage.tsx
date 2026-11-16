import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Plus,
  Search,
  Calendar,
  Clock,
  Eye,
  FileEdit,
  Building2,
  CheckCircle2,
} from 'lucide-react';
import { formatDate, MockDiaryEntry } from '@/data/mock';
import { fetchDiaryEntries } from '@/lib/dataService';
import { Card, Button, Input } from '@/components/ui';
import { StatusBadge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/FeedbackStates';
import { AttachmentSection } from '@/components/AttachmentSection';
import { ExportButtons } from '@/components/ExportButtons';

export default function DiaryListPage() {
  const [entries, setEntries] = useState<MockDiaryEntry[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [companyFilter, setCompanyFilter] = useState<string>('all');
  const [selectedEntry, setSelectedEntry] = useState<MockDiaryEntry | null>(null);

  useEffect(() => {
    let mounted = true;
    fetchDiaryEntries().then((data) => {
      if (mounted) setEntries(data);
    });
    return () => {
      mounted = false;
    };
  }, []);

  // Extract unique companies for filtering
  const companies = Array.from(new Set(entries.map((e) => e.company)));

  const filteredEntries = entries.filter((entry) => {
    const matchesSearch =
      entry.studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      entry.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      entry.content.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || entry.status === statusFilter;
    const matchesCompany = companyFilter === 'all' || entry.company === companyFilter;
    return matchesSearch && matchesStatus && matchesCompany;
  });

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Elektron kundalik daftari
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Talabalarning kunlik amaliyot yozuvlari ro'yxati va holati
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ExportButtons
            pdfUrl={`/api/reports/diary/pdf${statusFilter !== 'all' ? `?status=${statusFilter}` : ''}`}
            excelUrl={`/api/reports/diary/excel${statusFilter !== 'all' ? `?status=${statusFilter}` : ''}`}
            baseFilename="kundalik_hisoboti"
          />
          <Link to="/diary/new">
            <Button size="sm" className="gap-2">
              <Plus className="h-4 w-4" />
              Yangi yozuv qo'shish
            </Button>
          </Link>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <Card className="p-4 border-slate-200/80">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          {/* Search box */}
          <div className="md:col-span-2">
            <Input
              type="text"
              placeholder="Qidiruv: talaba, mavzu yoki faoliyat matni..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              icon={<Search className="h-4 w-4" />}
            />
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">Barcha holatlar</option>
              <option value="submitted">Yuborilgan (Kutilmoqda)</option>
              <option value="approved">Tasdiqlangan</option>
              <option value="rejected">Rad etilgan</option>
              <option value="draft">Qoralama</option>
            </select>
          </div>

          {/* Company Filter */}
          <div>
            <select
              value={companyFilter}
              onChange={(e) => setCompanyFilter(e.target.value)}
              className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">Barcha korxonalar</option>
              {companies.map((comp) => (
                <option key={comp} value={comp}>
                  {comp}
                </option>
              ))}
            </select>
          </div>
        </div>
      </Card>

      {/* Main Table / Empty State */}
      {filteredEntries.length === 0 ? (
        <EmptyState
          title="Hech qanday yozuv topilmadi"
          description="Tanlangan qidiruv yoki filtr mezonlariga mos keluvchi kundalik yozuvlari mavjud emas."
          action={{
            label: "Filtrlarni tozalash",
            onClick: () => {
              setSearchTerm('');
              setStatusFilter('all');
              setCompanyFilter('all');
            },
          }}
        />
      ) : (
        <Card className="p-0 overflow-hidden border-slate-200/80">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/75 border-b border-slate-100 text-slate-500 font-semibold uppercase tracking-wider">
                  <th className="py-3 px-4">Sana</th>
                  <th className="py-3 px-4">Talaba</th>
                  <th className="py-3 px-4">Amaliyot joyi</th>
                  <th className="py-3 px-4">Bajarilgan ish mavzusi</th>
                  <th className="py-3 px-4">Sarflangan vaqt</th>
                  <th className="py-3 px-4">Holat</th>
                  <th className="py-3 px-4 text-right">Amallar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredEntries.map((entry) => (
                  <tr key={entry.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-4 whitespace-nowrap font-medium text-slate-600">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5 text-slate-400" />
                        <span>{formatDate(entry.date)}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap font-semibold text-slate-900">
                      {entry.studentName}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="flex items-center gap-1.5 text-slate-600">
                        <Building2 className="h-3.5 w-3.5 text-slate-400" />
                        <span>{entry.company}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-900 max-w-xs truncate">{entry.title}</div>
                      <div className="text-[11px] text-slate-400 line-clamp-1">{entry.content}</div>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap text-slate-500">
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3 text-slate-400" />
                        <span>{entry.hours} soat</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <StatusBadge status={entry.status} />
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap text-right space-x-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedEntry(entry)}
                        className="h-7 px-2 text-indigo-600 hover:text-indigo-700"
                      >
                        <Eye className="h-3.5 w-3.5 mr-1" />
                        Ko'rish
                      </Button>
                      {entry.status !== 'approved' && (
                        <Link to={`/diary/edit/${entry.id}`}>
                          <Button variant="ghost" size="sm" className="h-7 px-2 text-slate-600 hover:text-slate-900">
                            <FileEdit className="h-3.5 w-3.5 mr-1" />
                            Tahrirlash
                          </Button>
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="p-3 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 px-4">
            <span>Jami ko'rsatilmoqda: {filteredEntries.length} ta yozuv</span>
            <span>Barcha sahifalar: 1 / 1</span>
          </div>
        </Card>
      )}

      {/* Entry Detail Modal (Quick view) */}
      {selectedEntry && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                  Kundalik tafsiloti
                </span>
                <h3 className="font-bold text-slate-900 text-base mt-0.5">{selectedEntry.title}</h3>
              </div>
              <StatusBadge status={selectedEntry.status} />
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-lg border border-slate-100">
                <div>
                  <span className="text-slate-400 block">Talaba:</span>
                  <span className="font-semibold text-slate-800">{selectedEntry.studentName}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Sana va soat:</span>
                  <span className="font-semibold text-slate-800">
                    {formatDate(selectedEntry.date)} ({selectedEntry.hours} soat)
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block">Tashkilot:</span>
                  <span className="font-semibold text-slate-800">{selectedEntry.company}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Amaliyot ID:</span>
                  <span className="font-semibold text-slate-800">{selectedEntry.internshipId}</span>
                </div>
              </div>

              <div>
                <span className="font-semibold text-slate-800 block mb-1">Bajarilgan ish tavsifi:</span>
                <p className="text-slate-600 leading-relaxed bg-white border border-slate-200 rounded-lg p-3">
                  {selectedEntry.content}
                </p>
              </div>

              {selectedEntry.tasks.length > 0 && (
                <div>
                  <span className="font-semibold text-slate-800 block mb-1.5">Bajarilgan vazifalar:</span>
                  <ul className="space-y-1">
                    {selectedEntry.tasks.map((task, idx) => (
                      <li key={idx} className="flex items-center gap-2 text-slate-700">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                        <span>{task}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {selectedEntry.supervisorComment && (
                <div className="p-3 rounded-lg bg-indigo-50/60 border border-indigo-100">
                  <span className="font-semibold text-indigo-900 block mb-1">Rahbar mulohazasi:</span>
                  <p className="text-indigo-800 italic">"{selectedEntry.supervisorComment}"</p>
                  {selectedEntry.reviewedBy && (
                    <span className="text-[10px] text-indigo-500 mt-1 block">
                      — {selectedEntry.reviewedBy} ({selectedEntry.reviewedAt && formatDate(selectedEntry.reviewedAt)})
                    </span>
                  )}
                </div>
              )}

              {/* Attachments */}
              <div className="pt-2 border-t border-slate-100">
                <AttachmentSection
                  entryId={selectedEntry.id}
                  entryStatus={selectedEntry.status.toUpperCase() as any}
                />
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setSelectedEntry(null)}>
                Yopish
              </Button>
              <Link to={`/diary/edit/${selectedEntry.id}`}>
                <Button size="sm">Tahrirlashga o'tish</Button>
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
