import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, FileSpreadsheet, BellRing } from 'lucide-react';
import type { JournalData, StudentGroup } from '@/lib/types';
import { monthLabel } from '@/lib/types';
import { fetchJournal, fetchGroups, downloadReport, sendReminder } from '@/lib/dataService';
import { Card, Button } from '@/components/ui';
import { PageHeader, Select, useToast } from '@/components/ui/extra';
import { LoadingState, ErrorState, EmptyState } from '@/components/ui/FeedbackStates';
import { useI18n } from '@/i18n';

const ATT_STYLE: Record<string, { cls: string; short: string }> = {
  PRESENT: { cls: 'bg-emerald-100 text-emerald-800', short: '+' },
  LATE: { cls: 'bg-amber-100 text-amber-800', short: 'K' },
  EXCUSED: { cls: 'bg-sky-100 text-sky-800', short: 'S' },
  ABSENT: { cls: 'bg-rose-100 text-rose-800', short: '−' },
};
const DIARY_MARK: Record<string, { mark: string; cls: string }> = {
  APPROVED: { mark: '✓', cls: 'text-emerald-700' },
  SUBMITTED: { mark: '•', cls: 'text-indigo-600' },
  RETURNED: { mark: '↩', cls: 'text-rose-600' },
  DRAFT: { mark: '○', cls: 'text-slate-400' },
};

function shiftMonth(m: string, delta: number): string {
  const [y, mo] = m.split('-').map(Number);
  const d = new Date(y, mo - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export default function JournalPage() {
  const { t, lang } = useI18n();
  const toast = useToast();
  const now = new Date();
  const [month, setMonth] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
  const [groupId, setGroupId] = useState('all');
  const [groups, setGroups] = useState<StudentGroup[]>([]);
  const [data, setData] = useState<JournalData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    fetchGroups()
      .then(setGroups)
      .catch(() => setGroups([]));
  }, []);

  const load = useCallback(() => {
    setData(null);
    setError(null);
    fetchJournal(month, groupId)
      .then(setData)
      .catch((e) => setError(e.message));
  }, [month, groupId]);
  useEffect(load, [load]);

  const label = monthLabel(month, lang);
  const weekdayShort = lang === 'ru' ? ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'] : ['Ya', 'Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh'];

  const exportExcel = async () => {
    setExporting(true);
    try {
      const q = new URLSearchParams({ month });
      if (groupId !== 'all') q.set('groupId', groupId);
      await downloadReport(`/api/journal/excel?${q.toString()}`, `amaliyot_jurnali_${month}.xlsx`);
    } catch (e: any) {
      toast(e.message, 'error');
    } finally {
      setExporting(false);
    }
  };

  const remind = async (internshipId: string) => {
    try {
      toast(await sendReminder(internshipId));
    } catch (e: any) {
      toast(e.message, 'warning');
    }
  };

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-5">
      <PageHeader
        title={t('Guruh jurnali')}
        subtitle={t('Har bir talaba uchun oy kunlari kesimida davomat va kundalik holati')}
        actions={
          <Button variant="outline" size="sm" className="gap-1.5" onClick={exportExcel} isLoading={exporting} disabled={!data?.rows.length}>
            <FileSpreadsheet className="h-4 w-4 text-emerald-600" /> Excel
          </Button>
        }
      />

      <Card className="p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setMonth(shiftMonth(month, -1))} aria-label={t('Oldingi oy')}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-[150px] text-center text-sm font-semibold text-slate-900 capitalize">{label}</span>
          <Button variant="outline" size="icon" onClick={() => setMonth(shiftMonth(month, 1))} aria-label={t('Keyingi oy')}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <Select value={groupId} onChange={(e) => setGroupId(e.target.value)} className="sm:w-56" aria-label={t('Guruh')}>
          <option value="all">{t('Barcha guruhlar')}</option>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name} — {g.studyProgram}
            </option>
          ))}
        </Select>
      </Card>

      <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-[11px] text-slate-600">
        {Object.entries(ATT_STYLE).map(([k, v]) => (
          <span key={k} className="inline-flex items-center gap-1.5">
            <span className={`h-4 w-4 rounded text-[10px] font-bold flex items-center justify-center ${v.cls}`}>{v.short}</span>
            {t({ PRESENT: 'Kelgan', LATE: 'Kechikkan', EXCUSED: 'Sababli', ABSENT: 'Kelmagan' }[k]!)}
          </span>
        ))}
        <span className="text-slate-300">|</span>
        {Object.entries(DIARY_MARK).map(([k, v]) => (
          <span key={k} className="inline-flex items-center gap-1">
            <span className={`font-bold ${v.cls}`}>{v.mark}</span>
            {t({ APPROVED: 'kundalik tasdiqlangan', SUBMITTED: 'topshirilgan', RETURNED: 'qaytarilgan', DRAFT: 'qoralama' }[k]!)}
          </span>
        ))}
      </div>

      {error ? (
        <ErrorState message={error} onRetry={load} />
      ) : !data ? (
        <LoadingState />
      ) : data.rows.length === 0 ? (
        <EmptyState title={t("Ma'lumot yo'q")} description={t("Tanlangan oy va guruh bo'yicha faol amaliyot topilmadi.")} />
      ) : (
        <Card className="p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="text-[11px] border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-500 border-b border-slate-200">
                  <th className="sticky left-0 z-10 bg-slate-50 py-2 px-3 text-left font-semibold min-w-[180px] border-r border-slate-200">{t('Talaba')}</th>
                  {data.days.map((d) => (
                    <th key={d.date} className={`py-1 px-0.5 font-medium w-7 min-w-[28px] text-center ${d.isWeekend ? 'bg-slate-100 text-slate-400' : ''} ${d.date === today ? 'text-indigo-700' : ''}`}>
                      <div className="text-[9px] uppercase">{weekdayShort[d.weekday]}</div>
                      <div className={d.date === today ? 'font-bold' : ''}>{d.day}</div>
                    </th>
                  ))}
                  <th className="py-2 px-2 font-semibold text-center border-l border-slate-200" title={t('Davomat foizi')}>%</th>
                  <th className="py-2 px-2 font-semibold text-center" title={t('Tasdiqlangan kundaliklar')}>✓</th>
                  <th className="py-2 px-2 font-semibold text-center">{t('Soat')}</th>
                  <th className="py-2 px-2" />
                </tr>
              </thead>
              <tbody>
                {data.rows.map((r) => (
                  <tr key={r.internshipId} className="border-b border-slate-100 hover:bg-slate-50/60">
                    <td className="sticky left-0 z-10 bg-white py-1.5 px-3 border-r border-slate-200">
                      <Link to={`/internship/${r.internshipId}`} className="font-semibold text-slate-900 hover:text-indigo-600 block truncate max-w-[190px]">
                        {r.studentName}
                      </Link>
                      <div className="text-[10px] text-slate-400 truncate max-w-[190px]">
                        {r.groupName} · {r.company}
                      </div>
                    </td>
                    {r.cells.map((c, i) => {
                      const day = data.days[i];
                      const a = c.attendance ? ATT_STYLE[c.attendance] : null;
                      const dm = c.diary ? DIARY_MARK[c.diary] : null;
                      const title = [day.date, c.attendance && t({ PRESENT: 'Kelgan', LATE: 'Kechikkan', EXCUSED: 'Sababli', ABSENT: 'Kelmagan' }[c.attendance]!), c.hours ? `${c.hours} ${t('soat')}` : '', c.diary && `${t('Kundalik')}: ${t({ APPROVED: 'Tasdiqlangan', SUBMITTED: 'Yuborilgan', RETURNED: 'Qaytarilgan', DRAFT: 'Qoralama' }[c.diary]!)}`]
                        .filter(Boolean)
                        .join(' · ');
                      return (
                        <td key={c.date} className={`p-0.5 text-center ${day.isWeekend ? 'bg-slate-50' : ''} ${!c.inRange ? 'opacity-30' : ''}`} title={title}>
                          <div className={`h-6 w-6 mx-auto rounded flex items-center justify-center font-bold ${a ? a.cls : ''}`}>
                            {a ? a.short : dm ? <span className={dm.cls}>{dm.mark}</span> : ''}
                          </div>
                          {a && dm && <div className={`-mt-1 text-[9px] leading-none font-bold ${dm.cls}`}>{dm.mark}</div>}
                        </td>
                      );
                    })}
                    <td className={`py-1 px-2 text-center font-semibold border-l border-slate-200 tabular-nums ${r.totals.attendanceRate !== null && r.totals.attendanceRate < 80 ? 'text-rose-600' : 'text-slate-800'}`}>
                      {r.totals.attendanceRate ?? '—'}
                    </td>
                    <td className="py-1 px-2 text-center tabular-nums">{r.totals.diaryApproved}</td>
                    <td className="py-1 px-2 text-center tabular-nums">{r.totals.hours}</td>
                    <td className="py-1 px-2">
                      <button className="p-1 text-slate-400 hover:text-amber-600" title={t('Kundalik yozishni eslatish (Telegram)')} onClick={() => remind(r.internshipId)}>
                        <BellRing className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="p-3 bg-slate-50/50 border-t border-slate-100 text-xs text-slate-500 px-4">{t('Jami: {n} nafar talaba', { n: data.rows.length })}</div>
        </Card>
      )}
    </div>
  );
}
