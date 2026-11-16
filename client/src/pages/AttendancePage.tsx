import React, { useState, useEffect, useMemo } from 'react';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  FileQuestion,
  Info,
  Save,
  X,
  Percent,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import {
  AttendanceRecord,
  AttendanceStats,
  fetchAttendance,
  fetchAttendanceStats,
  recordAttendance,
  fetchInternships,
} from '@/lib/dataService';
import { MockInternship } from '@/data/mock';
import { Card, Button, Input } from '@/components/ui';
import { AttendanceStatusBadge } from '@/components/ui/Badge';
import { LoadingState, ErrorState } from '@/components/ui/FeedbackStates';
import { ExportButtons } from '@/components/ExportButtons';

const MONTH_NAMES_UZ = [
  'Yanvar',
  'Fevral',
  'Mart',
  'Aprel',
  'May',
  'Iyun',
  'Iyul',
  'Avgust',
  'Sentabr',
  'Oktabr',
  'Noyabr',
  'Dekabr',
];

const WEEKDAY_NAMES_UZ = ['Dush', 'Sesh', 'Chor', 'Pay', 'Juma', 'Shan', 'Yak'];

export default function AttendancePage(): JSX.Element {
  const { user } = useAuth();

  // Selected date state (defaults to current date)
  const today = useMemo(() => new Date(), []);
  const [currentYear, setCurrentYear] = useState<number>(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState<number>(today.getMonth()); // 0-indexed

  // Filters & Data
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [stats, setStats] = useState<AttendanceStats>({
    totalDays: 0,
    presentDays: 0,
    absentDays: 0,
    lateDays: 0,
    excusedDays: 0,
    totalHours: 0,
    attendanceRate: 100,
  });
  const [internships, setInternships] = useState<MockInternship[]>([]);
  const [selectedInternshipId, setSelectedInternshipId] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Loading & Error states
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Modal / Drawer state for recording attendance
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [modalDate, setModalDate] = useState<string>('');
  const [modalInternshipId, setModalInternshipId] = useState<string>('');
  const [modalStatus, setModalStatus] = useState<'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED'>('PRESENT');
  const [modalHours, setModalHours] = useState<number>(8.0);
  const [modalNote, setModalNote] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [modalSuccessMessage, setModalSuccessMessage] = useState<string | null>(null);

  // Read-only state viewer for students & university supervisors
  const [viewDetailRecord, setViewDetailRecord] = useState<AttendanceRecord | null>(null);

  const canEditAttendance = user?.role === 'COMPANY_SUPERVISOR' || user?.role === 'ADMIN';

  const currentMonthStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;

  // Load internships list for supervisor / admin selection
  useEffect(() => {
    let mounted = true;
    fetchInternships().then((data) => {
      if (mounted) {
        setInternships(data);
        if (data.length > 0 && selectedInternshipId === 'all' && (user?.role === 'COMPANY_SUPERVISOR' || user?.role === 'STUDENT')) {
          setSelectedInternshipId(data[0].id);
        }
      }
    });
    return () => {
      mounted = false;
    };
  }, [user]);

  // Load attendance data whenever month or filters change
  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [fetchedRecords, fetchedStats] = await Promise.all([
        fetchAttendance({
          month: currentMonthStr,
          internshipId: selectedInternshipId !== 'all' ? selectedInternshipId : undefined,
          status: statusFilter !== 'all' ? statusFilter : undefined,
        }),
        fetchAttendanceStats({
          month: currentMonthStr,
          internshipId: selectedInternshipId !== 'all' ? selectedInternshipId : undefined,
        }),
      ]);

      setRecords(fetchedRecords);
      setStats(fetchedStats);
    } catch (err: any) {
      console.error('[AttendancePage] loadData error:', err);
      setError("Davomat ma'lumotlarini yuklashda xatolik yuz berdi.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [currentMonthStr, selectedInternshipId, statusFilter]);

  // Month navigation handlers
  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  };

  const handleGoToday = () => {
    setCurrentYear(today.getFullYear());
    setCurrentMonth(today.getMonth());
  };

  // Map records by date string `YYYY-MM-DD`
  const recordsByDate = useMemo(() => {
    const map = new Map<string, AttendanceRecord>();
    records.forEach((r) => {
      map.set(r.date, r);
    });
    return map;
  }, [records]);

  // Generate calendar grid days
  const calendarDays = useMemo(() => {
    const firstDayOfMonth = new Date(currentYear, currentMonth, 1);
    const lastDayOfMonth = new Date(currentYear, currentMonth + 1, 0);

    // Day of week: 0 is Sun, 1 is Mon... in ISO week Monday is 0
    let startDayOfWeek = firstDayOfMonth.getDay() - 1;
    if (startDayOfWeek === -1) startDayOfWeek = 6; // Sunday is 6

    const totalDaysInMonth = lastDayOfMonth.getDate();

    const days: {
      dateString: string;
      dayNumber: number;
      isCurrentMonth: boolean;
      isToday: boolean;
      record?: AttendanceRecord;
    }[] = [];

    // Previous month padding days
    const prevMonthLastDay = new Date(currentYear, currentMonth, 0).getDate();
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const dayNum = prevMonthLastDay - i;
      const prevM = currentMonth === 0 ? 11 : currentMonth - 1;
      const prevY = currentMonth === 0 ? currentYear - 1 : currentYear;
      const dStr = `${prevY}-${String(prevM + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
      days.push({
        dateString: dStr,
        dayNumber: dayNum,
        isCurrentMonth: false,
        isToday: false,
        record: recordsByDate.get(dStr),
      });
    }

    // Current month days
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    for (let day = 1; day <= totalDaysInMonth; day++) {
      const dStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      days.push({
        dateString: dStr,
        dayNumber: day,
        isCurrentMonth: true,
        isToday: dStr === todayStr,
        record: recordsByDate.get(dStr),
      });
    }

    // Next month padding days to complete 35 or 42 cells (6 rows * 7 cols)
    const totalCells = days.length <= 35 ? 35 : 42;
    const remainingDays = totalCells - days.length;
    for (let i = 1; i <= remainingDays; i++) {
      const nextM = currentMonth === 11 ? 0 : currentMonth + 1;
      const nextY = currentMonth === 11 ? currentYear + 1 : currentYear;
      const dStr = `${nextY}-${String(nextM + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      days.push({
        dateString: dStr,
        dayNumber: i,
        isCurrentMonth: false,
        isToday: false,
        record: recordsByDate.get(dStr),
      });
    }

    return days;
  }, [currentYear, currentMonth, recordsByDate, today]);

  // Click on calendar day cell
  const handleDayClick = (day: { dateString: string; dayNumber: number; record?: AttendanceRecord }) => {
    if (!canEditAttendance) {
      if (day.record) {
        setViewDetailRecord(day.record);
      }
      return;
    }

    // Default target internship
    const targetInternshipId =
      selectedInternshipId !== 'all' ? selectedInternshipId : (internships[0]?.id || 'clinternship001jasur');

    setModalDate(day.dateString);
    setModalInternshipId(targetInternshipId);
    setModalError(null);
    setModalSuccessMessage(null);

    if (day.record) {
      setModalStatus(day.record.status);
      setModalHours(day.record.hours);
      setModalNote(day.record.note || '');
    } else {
      setModalStatus('PRESENT');
      setModalHours(8.0);
      setModalNote('');
    }

    setIsModalOpen(true);
  };

  // Submit attendance record
  const handleSaveAttendance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalInternshipId) {
      setModalError("Amaliyot dasturi tanlanmagan");
      return;
    }

    setIsSubmitting(true);
    setModalError(null);
    setModalSuccessMessage(null);

    try {
      const result = await recordAttendance({
        internshipId: modalInternshipId,
        attendanceDate: modalDate,
        status: modalStatus,
        hours: Number(modalHours),
        note: modalNote.trim() || undefined,
      });

      if (!result.ok) {
        setModalError(result.error || "Davomatni saqlashda xatolik yuz berdi");
        setIsSubmitting(false);
        return;
      }

      setModalSuccessMessage("Davomat muvaffaqiyatli saqlandi!");
      setTimeout(() => {
        setIsModalOpen(false);
        loadData();
      }, 700);
    } catch (err: any) {
      setModalError(err.message || "Kutilmagan xatolik yuz berdi");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Davomat kalendari
            </h1>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
              {MONTH_NAMES_UZ[currentMonth]} {currentYear}
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Talabalarning amaliyotdagi kunlik ishtiroki, ishlangan soatlari va monitoringi
          </p>
        </div>

        {/* Month Switcher Controls & Export */}
        <div className="flex flex-wrap items-center gap-2">
          <ExportButtons
            pdfUrl={`/api/reports/attendance/pdf?${new URLSearchParams({
              ...(selectedInternshipId !== 'all' ? { internshipId: selectedInternshipId } : {}),
              ...(statusFilter !== 'all' ? { status: statusFilter } : {}),
              from: `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`,
              to: `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${new Date(currentYear, currentMonth + 1, 0).getDate()}`,
            }).toString()}`}
            excelUrl={`/api/reports/attendance/excel?${new URLSearchParams({
              ...(selectedInternshipId !== 'all' ? { internshipId: selectedInternshipId } : {}),
              ...(statusFilter !== 'all' ? { status: statusFilter } : {}),
              from: `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`,
              to: `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${new Date(currentYear, currentMonth + 1, 0).getDate()}`,
            }).toString()}`}
            baseFilename="davomat_hisoboti"
          />
          <Button variant="outline" size="sm" onClick={handleGoToday}>
            Bugun
          </Button>
          <div className="flex items-center bg-white border border-slate-200 rounded-lg p-0.5 shadow-xs">
            <button
              onClick={handlePrevMonth}
              className="p-1.5 rounded-md hover:bg-slate-100 text-slate-600 transition-colors"
              title="Oldingi oy"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="px-3 text-xs font-semibold text-slate-800 min-w-[120px] text-center">
              {MONTH_NAMES_UZ[currentMonth]} {currentYear}
            </span>
            <button
              onClick={handleNextMonth}
              className="p-1.5 rounded-md hover:bg-slate-100 text-slate-600 transition-colors"
              title="Keyingi oy"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Role Notice Banner */}
      {!canEditAttendance && (
        <div className="p-3.5 rounded-xl bg-blue-50/70 border border-blue-200 text-blue-900 text-xs flex items-center gap-3">
          <Info className="h-4 w-4 text-blue-600 shrink-0" />
          <span>
            {user?.role === 'STUDENT'
              ? "Siz o'z davomatingizni faol rejimda kuzatmoqdasiz. Davomat faqat korxona amaliyot rahbari tomonidan qayd etiladi."
              : "Universitet rahbari sifatida talabalar davomatini kuzatish imkoniyatiga egasiz. Qayd etish amallari korxona rahbari tomonidan yuritiladi."}
          </span>
        </div>
      )}

      {/* KPI Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
        {/* Total Days */}
        <Card className="p-4 border-slate-200/80 bg-white">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-medium">Jami kunlar</span>
            <CalendarIcon className="h-4 w-4 text-slate-400" />
          </div>
          <div className="text-xl font-bold text-slate-900">{stats.totalDays}</div>
          <span className="text-[11px] text-slate-400">qayd etilgan</span>
        </Card>

        {/* Present Days */}
        <Card className="p-4 border-emerald-100 bg-emerald-50/40">
          <div className="flex items-center justify-between text-emerald-700 mb-1">
            <span className="text-xs font-medium">Kelgan</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="text-xl font-bold text-emerald-900">{stats.presentDays}</div>
          <span className="text-[11px] text-emerald-600/80">to'liq ishtirok</span>
        </Card>

        {/* Absent Days */}
        <Card className="p-4 border-rose-100 bg-rose-50/40">
          <div className="flex items-center justify-between text-rose-700 mb-1">
            <span className="text-xs font-medium">Kelmagan</span>
            <XCircle className="h-4 w-4 text-rose-600" />
          </div>
          <div className="text-xl font-bold text-rose-900">{stats.absentDays}</div>
          <span className="text-[11px] text-rose-600/80">sababsiz</span>
        </Card>

        {/* Late Days */}
        <Card className="p-4 border-amber-100 bg-amber-50/40">
          <div className="flex items-center justify-between text-amber-700 mb-1">
            <span className="text-xs font-medium">Kechikkan</span>
            <AlertTriangle className="h-4 w-4 text-amber-600" />
          </div>
          <div className="text-xl font-bold text-amber-900">{stats.lateDays}</div>
          <span className="text-[11px] text-amber-600/80">kech kelgan</span>
        </Card>

        {/* Excused Days */}
        <Card className="p-4 border-sky-100 bg-sky-50/40">
          <div className="flex items-center justify-between text-sky-700 mb-1">
            <span className="text-xs font-medium">Sababli</span>
            <FileQuestion className="h-4 w-4 text-sky-600" />
          </div>
          <div className="text-xl font-bold text-sky-900">{stats.excusedDays}</div>
          <span className="text-[11px] text-sky-600/80">ma'lumot bilan</span>
        </Card>

        {/* Total Hours */}
        <Card className="p-4 border-indigo-100 bg-indigo-50/40">
          <div className="flex items-center justify-between text-indigo-700 mb-1">
            <span className="text-xs font-medium">Jami soat</span>
            <Clock className="h-4 w-4 text-indigo-600" />
          </div>
          <div className="text-xl font-bold text-indigo-900">{stats.totalHours.toFixed(1)}</div>
          <span className="text-[11px] text-indigo-600/80">ishlangan</span>
        </Card>

        {/* Attendance Rate */}
        <Card className="p-4 border-purple-100 bg-purple-50/40 col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between text-purple-700 mb-1">
            <span className="text-xs font-medium">Davomat %</span>
            <Percent className="h-4 w-4 text-purple-600" />
          </div>
          <div className="text-xl font-bold text-purple-900">{stats.attendanceRate}%</div>
          <span className="text-[11px] text-purple-600/80">davomat ko'rsatkichi</span>
        </Card>
      </div>

      {/* Filters Bar */}
      <Card className="p-4 border-slate-200/80">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            {/* Internship / Student Selector (if supervisor or admin) */}
            {canEditAttendance && internships.length > 0 && (
              <div className="min-w-[220px]">
                <label className="block text-xs font-medium text-slate-500 mb-1">
                  Amaliyotchi talaba:
                </label>
                <select
                  value={selectedInternshipId}
                  onChange={(e) => setSelectedInternshipId(e.target.value)}
                  className="w-full text-xs h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="all">Barcha biriktirilgan talabalar</option>
                  {internships.map((intern) => (
                    <option key={intern.id} value={intern.id}>
                      {intern.studentName} — {intern.company}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Status Filter */}
            <div className="min-w-[170px]">
              <label className="block text-xs font-medium text-slate-500 mb-1">
                Holat bo'yicha saralash:
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full text-xs h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="all">Barcha holatlar</option>
                <option value="PRESENT">Kelgan (PRESENT)</option>
                <option value="ABSENT">Kelmagan (ABSENT)</option>
                <option value="LATE">Kechikkan (LATE)</option>
                <option value="EXCUSED">Sababli (EXCUSED)</option>
              </select>
            </div>
          </div>

          {/* Quick Info Badge */}
          <div className="text-xs text-slate-500 flex items-center gap-2 pt-2 md:pt-0">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" /> Kelgan
            <span className="inline-block w-2 h-2 rounded-full bg-rose-500 ml-2" /> Kelmagan
            <span className="inline-block w-2 h-2 rounded-full bg-amber-500 ml-2" /> Kechikkan
            <span className="inline-block w-2 h-2 rounded-full bg-sky-500 ml-2" /> Sababli
          </div>
        </div>
      </Card>

      {/* Main Calendar Section */}
      <Card className="p-0 border-slate-200/80 overflow-hidden shadow-sm">
        {/* Calendar Weekdays Header */}
        <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50/80 text-center py-3 text-xs font-semibold text-slate-600 tracking-wider uppercase">
          {WEEKDAY_NAMES_UZ.map((dayName, idx) => (
            <div key={dayName} className={idx >= 5 ? 'text-amber-600' : ''}>
              {dayName}
            </div>
          ))}
        </div>

        {/* Calendar Days Grid */}
        {isLoading ? (
          <div className="p-12">
            <LoadingState message="Davomat jadvali yuklanmoqda..." />
          </div>
        ) : error ? (
          <div className="p-8">
            <ErrorState message={error} onRetry={loadData} />
          </div>
        ) : (
          <div className="grid grid-cols-7 auto-rows-fr divide-x divide-y divide-slate-100 bg-slate-100">
            {calendarDays.map((day, idx) => {
              const rec = day.record;
              const isWeekend = (idx % 7 === 5) || (idx % 7 === 6);

              return (
                <div
                  key={`${day.dateString}-${idx}`}
                  onClick={() => handleDayClick(day)}
                  className={`min-h-[105px] p-2 bg-white transition-all flex flex-col justify-between group ${
                    !day.isCurrentMonth ? 'bg-slate-50/50 text-slate-400' : 'text-slate-800'
                  } ${
                    day.isToday ? 'ring-2 ring-indigo-500 ring-inset bg-indigo-50/20' : ''
                  } ${
                    canEditAttendance
                      ? 'cursor-pointer hover:bg-slate-50 hover:shadow-xs'
                      : rec
                      ? 'cursor-pointer hover:bg-slate-50'
                      : ''
                  }`}
                >
                  {/* Day Header: Day Number + Today Tag */}
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-xs font-semibold inline-flex items-center justify-center w-6 h-6 rounded-full ${
                        day.isToday
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : isWeekend && day.isCurrentMonth
                          ? 'text-amber-600'
                          : ''
                      }`}
                    >
                      {day.dayNumber}
                    </span>

                    {/* Quick indicator for company supervisor to edit */}
                    {canEditAttendance && (
                      <span className="opacity-0 group-hover:opacity-100 text-[10px] text-indigo-600 font-medium transition-opacity">
                        {rec ? 'Tahrirlash' : '+ Qayd etish'}
                      </span>
                    )}
                  </div>

                  {/* Day Content: Attendance Status */}
                  <div className="my-1.5 flex flex-col gap-1">
                    {rec ? (
                      <div className="space-y-1">
                        <div className="flex items-center justify-between gap-1">
                          <AttendanceStatusBadge status={rec.status} />
                          <span className="text-[10px] font-semibold text-slate-600">
                            {rec.hours}s
                          </span>
                        </div>

                        {/* Note snippet or student indicator */}
                        {rec.note && (
                          <p
                            className="text-[10px] text-slate-500 line-clamp-1 italic bg-slate-50 px-1 py-0.5 rounded border border-slate-100"
                            title={rec.note}
                          >
                            "{rec.note}"
                          </p>
                        )}

                        {selectedInternshipId === 'all' && rec.studentName && (
                          <div className="text-[9px] text-slate-400 truncate">
                            {rec.studentName}
                          </div>
                        )}
                      </div>
                    ) : (
                      day.isCurrentMonth && !isWeekend && (
                        <div className="text-[10px] text-slate-300 italic">
                          Belgilanmagan
                        </div>
                      )
                    )}
                  </div>

                  {/* Cell Footer Spacer */}
                  <div className="text-[9px] text-slate-300 flex justify-end">
                    {day.dateString.slice(5)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* MODAL: Record / Update Attendance (Company Supervisor & Admin) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2">
                <CalendarIcon className="h-5 w-5 text-indigo-600" />
                <div>
                  <h3 className="font-semibold text-slate-900 text-sm">
                    Davomatni qayd etish
                  </h3>
                  <p className="text-xs text-slate-500">
                    Sana: <span className="font-semibold text-slate-700">{modalDate}</span>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Form Body */}
            <form onSubmit={handleSaveAttendance} className="p-6 space-y-4">
              {modalError && (
                <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs">
                  {modalError}
                </div>
              )}

              {modalSuccessMessage && (
                <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs">
                  {modalSuccessMessage}
                </div>
              )}

              {/* Internship Selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Amaliyotchi talaba <span className="text-rose-500">*</span>
                </label>
                <select
                  value={modalInternshipId}
                  onChange={(e) => setModalInternshipId(e.target.value)}
                  required
                  className="w-full text-xs h-10 rounded-lg border border-slate-200 bg-white px-3 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {internships.map((intern) => (
                    <option key={intern.id} value={intern.id}>
                      {intern.studentName} — {intern.company} ({intern.department})
                    </option>
                  ))}
                </select>
              </div>

              {/* Attendance Status Selection */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Davomat holati <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { key: 'PRESENT', label: 'Kelgan (Keldi)', desc: '8 soat', color: 'border-emerald-300 hover:bg-emerald-50/50' },
                    { key: 'ABSENT', label: 'Kelmagan (Kelmadi)', desc: '0 soat', color: 'border-rose-300 hover:bg-rose-50/50' },
                    { key: 'LATE', label: 'Kechikkan', desc: 'Qisman soat', color: 'border-amber-300 hover:bg-amber-50/50' },
                    { key: 'EXCUSED', label: 'Sababli', desc: 'Hujjat bilan', color: 'border-sky-300 hover:bg-sky-50/50' },
                  ].map((st) => (
                    <button
                      type="button"
                      key={st.key}
                      onClick={() => {
                        const nextSt = st.key as any;
                        setModalStatus(nextSt);
                        if (nextSt === 'ABSENT') setModalHours(0);
                        if (nextSt === 'PRESENT' && modalHours === 0) setModalHours(8.0);
                      }}
                      className={`p-2.5 rounded-xl border text-left transition-all ${st.color} ${
                        modalStatus === st.key
                          ? 'ring-2 ring-indigo-600 bg-indigo-50/40 border-indigo-500'
                          : 'border-slate-200 bg-white'
                      }`}
                    >
                      <div className="text-xs font-semibold text-slate-900">{st.label}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">{st.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Hours Input */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Ishlangan soat hajmi <span className="text-rose-500">*</span>
                </label>
                <Input
                  type="number"
                  min="0"
                  max="24"
                  step="0.5"
                  value={modalHours}
                  onChange={(e) => setModalHours(parseFloat(e.target.value) || 0)}
                  icon={<Clock className="h-4 w-4" />}
                  required
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Standart kunlik amaliyot: 8.0 soat (yarim kun: 4.0 soat)
                </p>
              </div>

              {/* Note / Reason Textarea */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Izoh yoki sabab (ixtiyoriy)
                </label>
                <textarea
                  rows={2}
                  maxLength={500}
                  placeholder="Kechikish sababi, topshiriq bajarilishi yoki boshqa izoh..."
                  value={modalNote}
                  onChange={(e) => setModalNote(e.target.value)}
                  className="w-full text-xs rounded-lg border border-slate-200 p-2.5 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="text-[11px] text-slate-400 bg-slate-50 p-2.5 rounded-lg border border-slate-100 flex items-start gap-1.5">
                <Info className="h-3.5 w-3.5 text-slate-500 mt-0.5 shrink-0" />
                <span>
                  Bir talaba uchun shu sanada mavjud yozuv bo'lsa, u avtomatik yangilanadi (takroriy dublikat yaratilmaydi).
                </span>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsModalOpen(false)}
                  disabled={isSubmitting}
                >
                  Bekor qilish
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  isLoading={isSubmitting}
                  className="gap-1.5"
                >
                  <Save className="h-4 w-4" />
                  Davomatni saqlash
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Read-Only Record Detail Viewer for Students/Supervisors */}
      {viewDetailRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-sm w-full overflow-hidden p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <CalendarIcon className="h-5 w-5 text-indigo-600" />
                <h3 className="font-semibold text-slate-900 text-sm">Davomat tafsiloti</h3>
              </div>
              <button
                onClick={() => setViewDetailRecord(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Sana:</span>
                <span className="font-semibold text-slate-800">{viewDetailRecord.date}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Holat:</span>
                <AttendanceStatusBadge status={viewDetailRecord.status} />
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Ishlangan soat:</span>
                <span className="font-semibold text-slate-800">{viewDetailRecord.hours} soat</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Korxona:</span>
                <span className="font-semibold text-slate-800">{viewDetailRecord.company}</span>
              </div>
              {viewDetailRecord.note && (
                <div className="pt-1">
                  <span className="text-slate-500 block mb-1">Qayd etilgan izoh:</span>
                  <p className="bg-slate-50 p-2.5 rounded-lg border border-slate-100 text-slate-700 italic">
                    "{viewDetailRecord.note}"
                  </p>
                </div>
              )}
            </div>

            <div className="pt-2 flex justify-end">
              <Button size="sm" variant="outline" onClick={() => setViewDetailRecord(null)}>
                Yopish
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
