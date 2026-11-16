import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, CheckCircle, Clock, ArrowRight, Building2, FileText, Eye, Briefcase, Award, Target } from 'lucide-react';
import { formatDate } from '@/lib/types';
import type { Analytics, DiaryEntry, Internship, InternshipDetail } from '@/lib/types';
import { fetchAnalytics, fetchDiaryEntries, fetchInternships, fetchInternshipDetail, fetchMyInternshipId } from '@/lib/dataService';
import { Card, Button } from '@/components/ui';
import { StatusBadge, InternshipStatusBadge } from '@/components/ui/Badge';
import { PageHeader, StatCard, ProgressBar } from '@/components/ui/extra';
import { LoadingState, ErrorState, EmptyState } from '@/components/ui/FeedbackStates';
import { DonutChart, WeeklyStackedChart, HorizontalBars, SERIES } from '@/components/charts';
import { useAuth } from '@/context/AuthContext';
import { useI18n } from '@/i18n';

export default function DashboardPage() {
  const { user } = useAuth();
  const { t } = useI18n();
  const isStudent = user?.role === 'STUDENT';
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [internships, setInternships] = useState<Internship[]>([]);
  const [mine, setMine] = useState<InternshipDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [a, e, i] = await Promise.all([fetchAnalytics(8), fetchDiaryEntries({ limit: 8 }), fetchInternships()]);
      setAnalytics(a);
      setEntries(e);
      setInternships(i);
      if (isStudent) {
        const id = await fetchMyInternshipId();
        setMine(id ? await fetchInternshipDetail(id) : null);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [isStudent]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) return <LoadingState />;
  if (error || !analytics) return <ErrorState message={error ?? undefined} onRetry={load} />;

  const ds = analytics.diaryStatus;
  const att = analytics.attendance;
  const weekly = analytics.weekly.map((w) => ({ ...w }));

  const diarySlices = [
    { key: 'SUBMITTED', label: t('Yuborilgan'), value: ds.SUBMITTED, color: SERIES[0] },
    { key: 'RETURNED', label: t('Qaytarilgan'), value: ds.RETURNED, color: SERIES[1] },
    { key: 'APPROVED', label: t('Tasdiqlangan'), value: ds.APPROVED, color: SERIES[2] },
    ...(isStudent || user?.role === 'ADMIN' ? [{ key: 'DRAFT', label: t('Qoralama'), value: ds.DRAFT, color: SERIES[3] }] : []),
  ];
  const attSlices = [
    { key: 'PRESENT', label: t('Kelgan'), value: att.PRESENT, color: SERIES[0] },
    { key: 'LATE', label: t('Kechikkan'), value: att.LATE, color: SERIES[1] },
    { key: 'EXCUSED', label: t('Sababli'), value: att.EXCUSED, color: SERIES[2] },
    { key: 'ABSENT', label: t('Kelmagan'), value: att.ABSENT, color: SERIES[3] },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={isStudent ? t('Xush kelibsiz, {name}!', { name: user!.fullName.split(' ')[0] }) : t('Boshqaruv paneli')}
        subtitle={isStudent ? t('Amaliyotingiz holati va kundalik faolligingiz') : t("Amaliyot monitoringi: kundaliklar, davomat va baholash ko'rsatkichlari")}
        actions={
          isStudent ? (
            <Link to="/diary/new">
              <Button size="sm" className="gap-2">
                <FileText className="h-4 w-4" /> {t('Yangi kundalik yozuvi')}
              </Button>
            </Link>
          ) : (
            <>
              <Link to="/reviews">
                <Button size="sm" className="gap-2">
                  <Clock className="h-4 w-4" /> {t('Tekshirish')} {ds.SUBMITTED > 0 && `(${ds.SUBMITTED})`}
                </Button>
              </Link>
              <Link to="/reports">
                <Button variant="outline" size="sm">
                  {t('Hisobotlar')}
                </Button>
              </Link>
            </>
          )
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {isStudent ? (
          <>
            <StatCard label={t('Tasdiqlangan kunlar')} value={`${ds.APPROVED}`} hint={mine ? t('{n} ish kunidan', { n: mine.totalDays }) : undefined} icon={<CheckCircle className="h-4.5 w-4.5" />} tone="emerald" />
            <StatCard label={t('Tasdiqlangan soatlar')} value={`${analytics.totals.approvedHours}`} hint={mine?.plannedHours ? t('Reja: {n} soat', { n: mine.plannedHours }) : undefined} icon={<Clock className="h-4.5 w-4.5" />} tone="indigo" />
            <StatCard label={t('Davomat')} value={analytics.totals.attendanceRate === null ? '—' : `${analytics.totals.attendanceRate}%`} hint={t('{n} kun qayd etilgan', { n: att.PRESENT + att.LATE + att.EXCUSED + att.ABSENT })} icon={<Calendar className="h-4.5 w-4.5" />} tone="sky" />
            <StatCard label={t('Reja bajarilishi')} value={mine?.planProgress == null ? '—' : `${mine.planProgress}%`} hint={mine ? t('{n} ta reja bandi', { n: mine.plan.length }) : t('Amaliyot biriktirilmagan')} icon={<Target className="h-4.5 w-4.5" />} tone="amber" />
          </>
        ) : (
          <>
            <StatCard label={t('Faol amaliyotlar')} value={analytics.totals.activeInternships} hint={t('{n} ta korxonada', { n: analytics.totals.companies })} icon={<Briefcase className="h-4.5 w-4.5" />} tone="indigo" />
            <StatCard label={t('Tekshirish kutilmoqda')} value={<span className={ds.SUBMITTED ? 'text-amber-600' : ''}>{ds.SUBMITTED}</span>} hint={t('Tasdiqlash ulushi: {p}', { p: analytics.totals.approvalRate === null ? '—' : `${analytics.totals.approvalRate}%` })} icon={<Clock className="h-4.5 w-4.5" />} tone="amber" />
            <StatCard label={t("O'rtacha davomat")} value={analytics.totals.attendanceRate === null ? '—' : `${analytics.totals.attendanceRate}%`} hint={t('Kelgan va kechikkan kunlar ulushi')} icon={<Calendar className="h-4.5 w-4.5" />} tone="sky" />
            <StatCard label={t("O'rtacha yakuniy ball")} value={analytics.totals.averageScore ?? '—'} hint={t('{n} ta yakunlangan baholash', { n: analytics.totals.completedEvaluations })} icon={<Award className="h-4.5 w-4.5" />} tone="emerald" />
          </>
        )}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        <Card className="lg:col-span-2 p-4 sm:p-5">
          <h3 className="font-semibold text-slate-900 text-sm">{t('Haftalik kundalik dinamikasi')}</h3>
          <p className="text-xs text-slate-500 mb-3">{t("So'nggi 8 hafta, yozuv sanasi bo'yicha")}</p>
          <WeeklyStackedChart
            data={weekly}
            series={[
              { key: 'submitted', label: t('Yuborilgan'), color: SERIES[0] },
              { key: 'returned', label: t('Qaytarilgan'), color: SERIES[1] },
              { key: 'approved', label: t('Tasdiqlangan'), color: SERIES[2] },
            ]}
          />
        </Card>
        <Card className="p-4 sm:p-5 space-y-5">
          <div>
            <h3 className="font-semibold text-slate-900 text-sm mb-3">{t('Kundaliklar holati')}</h3>
            <DonutChart data={diarySlices} centerLabel={t('yozuv')} />
          </div>
          <div className="border-t border-slate-100 pt-4">
            <h3 className="font-semibold text-slate-900 text-sm mb-3">{t('Davomat taqsimoti')}</h3>
            <DonutChart data={attSlices} centerLabel={t('kun')} />
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Recent entries */}
        <Card className="lg:col-span-2 p-0 overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between gap-3">
            <div>
              <h3 className="font-semibold text-slate-900 text-sm">{t("So'nggi kundalik yozuvlari")}</h3>
              <p className="text-xs text-slate-500 mt-0.5">{t('Eng yangi 8 ta yozuv')}</p>
            </div>
            <Link to="/diary" className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 inline-flex items-center gap-1 shrink-0">
              {t('Barchasi')} <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          {entries.length === 0 ? (
            <div className="p-5">
              <EmptyState title={t("Hozircha yozuvlar yo'q")} description={isStudent ? t('Birinchi kundalik yozuvingizni qo‘shing.') : t('Talabalar hali kundalik topshirmagan.')} />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50/75 border-b border-slate-100 text-slate-500 font-semibold uppercase tracking-wider">
                    <th className="py-2.5 px-4">{t('Sana')}</th>
                    {!isStudent && <th className="py-2.5 px-4">{t('Talaba')}</th>}
                    <th className="py-2.5 px-4">{t('Mavzu')}</th>
                    <th className="py-2.5 px-4">{t('Holat')}</th>
                    <th className="py-2.5 px-4 text-right"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {entries.map((e) => (
                    <tr key={e.id} className="hover:bg-slate-50/50">
                      <td className="py-2.5 px-4 whitespace-nowrap text-slate-600">{formatDate(e.date)}</td>
                      {!isStudent && <td className="py-2.5 px-4 whitespace-nowrap font-semibold text-slate-900">{e.studentName}</td>}
                      <td className="py-2.5 px-4">
                        <div className="font-medium text-slate-900 line-clamp-1">{e.title}</div>
                        <div className="text-[11px] text-slate-400">{e.planItemTitle || e.company}</div>
                      </td>
                      <td className="py-2.5 px-4 whitespace-nowrap">
                        <StatusBadge status={e.status} />
                      </td>
                      <td className="py-2.5 px-4 text-right">
                        <Link to={isStudent && (e.status === 'draft' || e.status === 'returned') ? `/diary/edit/${e.id}` : '/diary'} aria-label={t("Ko'rish")}>
                          <Button variant="ghost" size="sm" className="h-7 px-2 text-indigo-600">
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* Right column */}
        {isStudent ? (
          <Card className="p-4 sm:p-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-semibold text-slate-900 text-sm">{t('Amaliyot rejasi')}</h3>
              {mine && (
                <Link to={`/internship/${mine.id}`} className="text-xs text-indigo-600 font-medium hover:underline">
                  {t('Batafsil')}
                </Link>
              )}
            </div>
            {!mine ? (
              <p className="text-xs text-slate-500 pt-4">{t('Sizga hali amaliyot biriktirilmagan.')}</p>
            ) : mine.plan.length === 0 ? (
              <p className="text-xs text-slate-500 pt-4">{t('Rahbaringiz hali amaliyot rejasini kiritmagan.')}</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {mine.plan.map((p) => (
                  <li key={p.id} className="py-3 space-y-1.5">
                    <div className="flex items-start justify-between gap-2 text-xs">
                      <span className="font-medium text-slate-800">{p.title}</span>
                      <span className="text-slate-500 tabular-nums shrink-0">
                        {p.doneHours}/{p.plannedHours} {t('soat')}
                      </span>
                    </div>
                    <ProgressBar value={p.progress ?? 0} tone={(p.progress ?? 0) >= 100 ? 'emerald' : 'indigo'} />
                  </li>
                ))}
              </ul>
            )}
          </Card>
        ) : (
          <Card className="p-4 sm:p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-semibold text-slate-900 text-sm">{t("Guruhlar bo'yicha davomat")}</h3>
              <Link to="/journal" className="text-xs text-indigo-600 font-medium hover:underline">
                {t('Jurnal')}
              </Link>
            </div>
            <HorizontalBars data={analytics.groups.map((g) => ({ label: g.name, value: g.attendanceRate, sub: t('{n} talaba', { n: g.students }) }))} unit="%" max={100} />
            <div className="pt-3 border-t border-slate-100">
              <h4 className="text-xs font-semibold text-slate-700 mb-2">{t('Faol amaliyotlar')}</h4>
              <ul className="divide-y divide-slate-100">
                {internships
                  .filter((i) => i.status === 'active')
                  .slice(0, 5)
                  .map((i) => {
                    const pct = i.totalDays ? Math.round((i.approvedEntries / i.totalDays) * 100) : 0;
                    return (
                      <li key={i.id} className="py-2.5 space-y-1.5">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <Link to={`/internship/${i.id}`} className="font-semibold text-xs text-slate-900 hover:text-indigo-600">
                              {i.studentName}
                            </Link>
                            <div className="flex items-center gap-1 text-[11px] text-slate-500">
                              <Building2 className="h-3 w-3" /> <span className="truncate">{i.company}</span>
                            </div>
                          </div>
                          <InternshipStatusBadge status={i.status} />
                        </div>
                        <ProgressBar value={pct} />
                        <div className="text-[11px] text-slate-400">{t('Tasdiqlangan: {a}/{b} kun', { a: i.approvedEntries, b: i.totalDays })}</div>
                      </li>
                    );
                  })}
              </ul>
              <Link to="/internships" className="mt-2 inline-flex text-xs font-semibold text-indigo-600 hover:underline">
                {t('Barcha amaliyotlar')} →
              </Link>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
