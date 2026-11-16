import { useCallback, useEffect, useState } from 'react';
import { Printer, Users, Building2, Clock, Award } from 'lucide-react';
import type { Analytics, AnalyticsAgg } from '@/lib/types';
import { fetchAnalytics } from '@/lib/dataService';
import { Card, Button } from '@/components/ui';
import { PageHeader, Select, StatCard } from '@/components/ui/extra';
import { LoadingState, ErrorState } from '@/components/ui/FeedbackStates';
import { ExportButtons } from '@/components/ExportButtons';
import { WeeklyStackedChart, HorizontalBars, SERIES } from '@/components/charts';
import { useI18n } from '@/i18n';

function AggTable({ rows, nameTitle }: { rows: AnalyticsAgg[]; nameTitle: string }) {
  const { t } = useI18n();
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs">
        <thead>
          <tr className="bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider border-b border-slate-100">
            <th className="py-3 px-4">{nameTitle}</th>
            <th className="py-3 px-4 text-right">{t('Talabalar')}</th>
            <th className="py-3 px-4 text-right">{t('Tasdiqlangan yozuvlar')}</th>
            <th className="py-3 px-4 text-right">{t('Soatlar')}</th>
            <th className="py-3 px-4 text-right">{t('Davomat')}</th>
            <th className="py-3 px-4 text-right">{t("O'rtacha ball")}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 text-slate-700">
          {rows.map((r) => (
            <tr key={r.id} className="hover:bg-slate-50/50">
              <td className="py-2.5 px-4 font-semibold text-slate-900">{r.name}</td>
              <td className="py-2.5 px-4 text-right tabular-nums">{r.students}</td>
              <td className="py-2.5 px-4 text-right tabular-nums">
                {r.approvedEntries}
                <span className="text-slate-400"> / {r.totalEntries}</span>
              </td>
              <td className="py-2.5 px-4 text-right tabular-nums">{r.approvedHours}</td>
              <td className="py-2.5 px-4 text-right tabular-nums">{r.attendanceRate === null ? '—' : `${r.attendanceRate}%`}</td>
              <td className="py-2.5 px-4 text-right tabular-nums font-semibold">{r.averageScore ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function ReportsPage() {
  const { t } = useI18n();
  const [weeks, setWeeks] = useState(12);
  const [data, setData] = useState<Analytics | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    setData(null);
    fetchAnalytics(weeks)
      .then(setData)
      .catch((e) => setError(e.message));
  }, [weeks]);
  useEffect(load, [load]);

  return (
    <div className="space-y-6 print:space-y-4">
      <PageHeader
        title={t('Hisobot va tahliliy statistika')}
        subtitle={t("Guruhlar va korxonalar kesimida amaliyot ko'rsatkichlari (real vaqt ma'lumotlari)")}
        actions={
          <div className="flex flex-wrap items-center gap-2 print:hidden">
            <Select value={weeks} onChange={(e) => setWeeks(Number(e.target.value))} className="w-36 h-8 text-xs" aria-label={t('Davr')}>
              <option value={8}>{t("So'nggi 8 hafta")}</option>
              <option value={12}>{t("So'nggi 12 hafta")}</option>
              <option value={26}>{t("So'nggi 26 hafta")}</option>
            </Select>
            <ExportButtons pdfUrl="/api/reports/diary/pdf" excelUrl="/api/reports/diary/excel" baseFilename="kundalik_hisoboti" />
            <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => window.print()}>
              <Printer className="h-3.5 w-3.5" /> {t('Chop etish')}
            </Button>
          </div>
        }
      />

      {error ? (
        <ErrorState message={error} onRetry={load} />
      ) : !data ? (
        <LoadingState />
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <StatCard label={t('Amaliyotchilar')} value={data.totals.internships} hint={t('{n} tasi faol', { n: data.totals.activeInternships })} icon={<Users className="h-4.5 w-4.5" />} />
            <StatCard label={t('Hamkor korxonalar')} value={data.totals.companies} icon={<Building2 className="h-4.5 w-4.5" />} tone="sky" />
            <StatCard label={t('Tasdiqlangan soatlar')} value={data.totals.approvedHours} hint={t('Tasdiqlash ulushi: {p}', { p: data.totals.approvalRate === null ? '—' : `${data.totals.approvalRate}%` })} icon={<Clock className="h-4.5 w-4.5" />} tone="emerald" />
            <StatCard label={t("O'rtacha yakuniy ball")} value={data.totals.averageScore ?? '—'} hint={t('{n} ta yakunlangan baholash', { n: data.totals.completedEvaluations })} icon={<Award className="h-4.5 w-4.5" />} tone="amber" />
          </div>

          <Card className="p-4 sm:p-5">
            <h3 className="font-semibold text-slate-900 text-sm">{t('Haftalar kesimida kundalik dinamikasi')}</h3>
            <p className="text-xs text-slate-500 mb-3">{t("Yozuv sanasi bo'yicha, holatlar kesimida")}</p>
            <WeeklyStackedChart
              data={data.weekly}
              series={[
                { key: 'submitted', label: t('Yuborilgan'), color: SERIES[0] },
                { key: 'returned', label: t('Qaytarilgan'), color: SERIES[1] },
                { key: 'approved', label: t('Tasdiqlangan'), color: SERIES[2] },
              ]}
            />
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
            <Card className="p-4 sm:p-5">
              <h3 className="font-semibold text-slate-900 text-sm mb-1">{t("Guruhlar bo'yicha o'rtacha yakuniy ball")}</h3>
              <p className="text-xs text-slate-500 mb-4">{t('100 ballik tizimda, faqat yakunlangan baholashlar')}</p>
              <HorizontalBars
                data={data.groups.map((g) => ({ label: g.name, value: g.averageScore, sub: t('{n} talaba', { n: g.students }) }))}
                max={100}
                emptyText={t('Hali yakunlangan baholash yo‘q')}
              />
            </Card>
            <Card className="p-4 sm:p-5">
              <h3 className="font-semibold text-slate-900 text-sm mb-1">{t("Korxonalar bo'yicha davomat")}</h3>
              <p className="text-xs text-slate-500 mb-4">{t('Kelgan va kechikkan kunlar ulushi')}</p>
              <HorizontalBars data={data.companies.map((c) => ({ label: c.name, value: c.attendanceRate, sub: t('{n} talaba', { n: c.students }) }))} unit="%" max={100} />
            </Card>
          </div>

          <Card className="p-0 overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-100">
              <h3 className="font-semibold text-slate-900 text-sm">{t('Guruhlar kesimidagi statistika')}</h3>
            </div>
            <AggTable rows={data.groups} nameTitle={t('Guruh')} />
          </Card>

          <Card className="p-0 overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-100">
              <h3 className="font-semibold text-slate-900 text-sm">{t('Korxonalar kesimidagi statistika')}</h3>
              <p className="text-xs text-slate-500 mt-0.5">{t("Amaliyot o'tash joylari bo'yicha talabalar taqsimoti")}</p>
            </div>
            <AggTable rows={data.companies} nameTitle={t('Korxona')} />
          </Card>
        </>
      )}
    </div>
  );
}
