import { useCallback, useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Building2, Calendar, MapPin, Clock, Mail, Phone, ChevronRight, FileDown, Plus, Pencil, Trash2, Target, BellRing, User } from 'lucide-react';
import type { InternshipDetail, PlanItem } from '@/lib/types';
import { formatDate } from '@/lib/types';
import { fetchInternshipDetail, createPlanItem, updatePlanItem, deletePlanItem, downloadReport, sendReminder } from '@/lib/dataService';
import { Card, Button, Input } from '@/components/ui';
import { InternshipStatusBadge, StatusBadge } from '@/components/ui/Badge';
import { Field, Modal, ProgressBar, StatCard, Textarea, useConfirm, useToast } from '@/components/ui/extra';
import { LoadingState, ErrorState } from '@/components/ui/FeedbackStates';
import { useAuth } from '@/context/AuthContext';
import { useI18n } from '@/i18n';

function Contact({ title, name, email, phone }: { title: string; name?: string | null; email?: string | null; phone?: string | null }) {
  const initials = (name ?? '?')
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  return (
    <div className="space-y-2">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{title}</div>
      {name ? (
        <>
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-full bg-indigo-100 text-indigo-700 text-xs font-semibold flex items-center justify-center shrink-0">{initials}</div>
            <div className="font-semibold text-xs text-slate-900">{name}</div>
          </div>
          <div className="space-y-1 text-xs text-slate-600 pl-12">
            {email && (
              <a href={`mailto:${email}`} className="flex items-center gap-2 hover:text-indigo-600 break-all">
                <Mail className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                {email}
              </a>
            )}
            {phone && (
              <a href={`tel:${phone.replace(/\s/g, '')}`} className="flex items-center gap-2 hover:text-indigo-600">
                <Phone className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                {phone}
              </a>
            )}
          </div>
        </>
      ) : (
        <div className="text-xs text-slate-400">—</div>
      )}
    </div>
  );
}

export default function InternshipDetailsPage() {
  const { id = '' } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { t } = useI18n();
  const toast = useToast();
  const confirm = useConfirm();
  const [data, setData] = useState<InternshipDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [planModal, setPlanModal] = useState<{ open: boolean; item?: PlanItem }>({ open: false });
  const [planForm, setPlanForm] = useState({ title: '', description: '', plannedHours: 8 });
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const load = useCallback(() => {
    setError(null);
    fetchInternshipDetail(id)
      .then(setData)
      .catch((e) => setError(e.message));
  }, [id]);
  useEffect(load, [load]);

  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!data) return <LoadingState />;

  const progress = data.totalDays ? Math.round((data.approvedEntries / data.totalDays) * 100) : 0;
  const isStudent = user?.role === 'STUDENT';
  const isStaff = !isStudent;

  const openPlan = (item?: PlanItem) => {
    setPlanForm({ title: item?.title ?? '', description: item?.description ?? '', plannedHours: item?.plannedHours ?? 8 });
    setPlanModal({ open: true, item });
  };
  const savePlan = async () => {
    if (planForm.title.trim().length < 3) {
      toast(t("Mavzu kamida 3 belgidan iborat bo'lishi kerak"), 'error');
      return;
    }
    setSaving(true);
    try {
      const payload = { title: planForm.title.trim(), description: planForm.description.trim() || null, plannedHours: Number(planForm.plannedHours) };
      if (planModal.item) await updatePlanItem(data.id, planModal.item.id, payload);
      else await createPlanItem(data.id, payload);
      toast(t('Reja saqlandi'));
      setPlanModal({ open: false });
      load();
    } catch (e: any) {
      toast(e.message, 'error');
    } finally {
      setSaving(false);
    }
  };
  const removePlan = async (item: PlanItem) => {
    const ok = await confirm({
      title: t("Reja bandini o'chirish"),
      message: t("«{title}» o'chiriladi. Unga bog'langan kundaliklar saqlanib qoladi.", { title: item.title }),
      confirmLabel: t("O'chirish"),
      destructive: true,
    });
    if (!ok) return;
    try {
      await deletePlanItem(data.id, item.id);
      toast(t("Reja bandi o'chirildi"));
      load();
    } catch (e: any) {
      toast(e.message, 'error');
    }
  };
  const move = async (item: PlanItem, dir: -1 | 1) => {
    const idx = data.plan.findIndex((p) => p.id === item.id);
    const other = data.plan[idx + dir];
    if (!other) return;
    try {
      await Promise.all([updatePlanItem(data.id, item.id, { orderIndex: other.orderIndex }), updatePlanItem(data.id, other.id, { orderIndex: item.orderIndex })]);
      load();
    } catch (e: any) {
      toast(e.message, 'error');
    }
  };

  const downloadFinal = async () => {
    setDownloading(true);
    try {
      await downloadReport(`/api/reports/final/${data.id}/pdf`, `yakuniy_hisobot_${data.studentName.replace(/\s+/g, '_')}.pdf`);
    } catch (e: any) {
      toast(e.message, 'error');
    } finally {
      setDownloading(false);
    }
  };

  const remind = async () => {
    try {
      toast(await sendReminder(data.id));
    } catch (e: any) {
      toast(e.message, 'warning');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
            <Link to={isStudent ? '/dashboard' : '/internships'} className="hover:text-slate-600">
              {isStudent ? t('Bosh sahifa') : t('Amaliyotlar')}
            </Link>
            <ChevronRight className="h-3 w-3" />
            <span>{t('Amaliyot dasturi')}</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            {data.company} — {data.position}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5 flex flex-wrap items-center gap-x-2">
            <span className="inline-flex items-center gap-1">
              <User className="h-3.5 w-3.5" /> <strong className="text-slate-700">{data.studentName}</strong>
            </span>
            {data.groupName && <span>· {t('Guruh')}: {data.groupName}</span>}
            {data.department && <span>· {data.department}</span>}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <InternshipStatusBadge status={data.status} />
          {isStaff && data.status === 'active' && (
            <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={remind}>
              <BellRing className="h-3.5 w-3.5 text-amber-600" /> {t('Eslatish')}
            </Button>
          )}
          <Button size="sm" className="gap-1.5 text-xs" onClick={downloadFinal} isLoading={downloading}>
            <FileDown className="h-3.5 w-3.5" /> {t('Yakuniy hisobot (PDF)')}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard label={t('Tasdiqlangan kunlar')} value={`${data.approvedEntries}/${data.totalDays}`} hint={`${progress}%`} tone="emerald" />
        <StatCard label={t('Tasdiqlangan soatlar')} value={data.approvedHours ?? 0} hint={data.plannedHours ? t('Reja: {n} soat', { n: data.plannedHours }) : t('Reja kiritilmagan')} tone="indigo" />
        <StatCard label={t('Davomat')} value={data.attendance.rate === null ? '—' : `${data.attendance.rate}%`} hint={t('{n} kun qayd etilgan', { n: data.attendance.total })} tone="sky" />
        <StatCard label={t('Reja bajarilishi')} value={data.planProgress === null ? '—' : `${data.planProgress}%`} hint={t('{n} ta reja bandi', { n: data.plan.length })} tone="amber" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        <div className="space-y-4 sm:space-y-6">
          <Card className="p-4 sm:p-5 space-y-4">
            <h3 className="font-semibold text-sm text-slate-900 border-b border-slate-100 pb-2">{t("Amaliyot ma'lumotlari")}</h3>
            <div className="space-y-3 text-xs">
              <div className="flex items-start gap-2.5">
                <Building2 className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
                <div>
                  <span className="text-slate-400 block">{t('Qabul qiluvchi tashkilot')}</span>
                  <span className="font-semibold text-slate-800">{data.company}</span>
                  {data.companyPhone && <span className="block text-slate-500">{data.companyPhone}</span>}
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <MapPin className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
                <div>
                  <span className="text-slate-400 block">{t('Manzil')}</span>
                  <span className="text-slate-700">{data.address}</span>
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <Calendar className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
                <div>
                  <span className="text-slate-400 block">{t('Amaliyot davri')}</span>
                  <span className="font-semibold text-slate-800">
                    {formatDate(data.startDate)} — {formatDate(data.endDate)}
                  </span>
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <Clock className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
                <div>
                  <span className="text-slate-400 block">{t('Davomiyligi')}</span>
                  <span className="font-semibold text-slate-800">{t('{n} ish kuni', { n: data.totalDays })}</span>
                </div>
              </div>
            </div>
            {data.programDescription && <p className="text-xs text-slate-600 leading-relaxed border-t border-slate-100 pt-3">{data.programDescription}</p>}
          </Card>

          <Card className="p-4 sm:p-5 space-y-4">
            <Contact title={t('Korxona rahbari')} name={data.companySupervisorName} email={data.companySupervisorEmail} phone={data.companySupervisorPhone} />
            <div className="border-t border-slate-100 pt-4">
              <Contact title={t("Ta'lim muassasasi rahbari")} name={data.universitySupervisorName} email={data.universitySupervisorEmail} phone={data.universitySupervisorPhone} />
            </div>
          </Card>

          <Card className="p-4 sm:p-5 space-y-3">
            <h3 className="font-semibold text-sm text-slate-900">{t('Davomat')}</h3>
            <div className="grid grid-cols-2 gap-2 text-center text-xs">
              {(
                [
                  ['PRESENT', t('Kelgan'), 'bg-emerald-50 text-emerald-800'],
                  ['LATE', t('Kechikkan'), 'bg-amber-50 text-amber-800'],
                  ['EXCUSED', t('Sababli'), 'bg-sky-50 text-sky-800'],
                  ['ABSENT', t('Kelmagan'), 'bg-rose-50 text-rose-800'],
                ] as const
              ).map(([k, label, cls]) => (
                <div key={k} className={`rounded-lg p-2 ${cls}`}>
                  <div className="text-[11px] opacity-80">{label}</div>
                  <div className="text-base font-bold tabular-nums">{data.attendance[k]}</div>
                </div>
              ))}
            </div>
            <Link to="/attendance" className="text-xs text-indigo-600 font-medium hover:underline">
              {t('Davomat kalendari')} →
            </Link>
          </Card>
        </div>

        <div className="lg:col-span-2 space-y-4 sm:space-y-6">
          {/* Plan */}
          <Card className="p-0 overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-semibold text-sm text-slate-900 flex items-center gap-2">
                  <Target className="h-4 w-4 text-indigo-600" /> {t('Amaliyot dasturi (reja)')}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">{t("Mavzular, rejadagi soatlar va tasdiqlangan kundaliklar bo'yicha bajarilish")}</p>
              </div>
              {data.canEditPlan && (
                <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => openPlan()}>
                  <Plus className="h-3.5 w-3.5" /> {t("Band qo'shish")}
                </Button>
              )}
            </div>
            {data.plan.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500">
                {data.canEditPlan ? t("Hali reja kiritilmagan. «Band qo'shish» orqali amaliyot mavzularini kiriting.") : t('Rahbar hali amaliyot rejasini kiritmagan.')}
              </div>
            ) : (
              <ol className="divide-y divide-slate-100">
                {data.plan.map((p, idx) => (
                  <li key={p.id} className="p-4 sm:px-5 flex gap-3">
                    <span className="h-6 w-6 rounded-full bg-slate-100 text-slate-600 text-[11px] font-semibold flex items-center justify-center shrink-0">{idx + 1}</span>
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-slate-900">{p.title}</div>
                          {p.description && <div className="text-xs text-slate-500">{p.description}</div>}
                        </div>
                        <div className="text-xs text-slate-600 tabular-nums shrink-0">
                          <strong className="text-slate-900">{p.doneHours}</strong> / {p.plannedHours} {t('soat')} · {t('{n} ta yozuv', { n: p.entryCount ?? 0 })}
                        </div>
                      </div>
                      <ProgressBar value={p.progress ?? 0} tone={(p.progress ?? 0) >= 100 ? 'emerald' : 'indigo'} />
                    </div>
                    {data.canEditPlan && (
                      <div className="flex flex-col sm:flex-row gap-0.5 shrink-0">
                        <button className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30" disabled={idx === 0} onClick={() => move(p, -1)} aria-label={t('Yuqoriga')}>
                          ↑
                        </button>
                        <button className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30" disabled={idx === data.plan.length - 1} onClick={() => move(p, 1)} aria-label={t('Pastga')}>
                          ↓
                        </button>
                        <button className="p-1 text-slate-400 hover:text-indigo-600" onClick={() => openPlan(p)} aria-label={t('Tahrirlash')}>
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button className="p-1 text-slate-400 hover:text-rose-600" onClick={() => removePlan(p)} aria-label={t("O'chirish")}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </Card>

          {/* Entries */}
          <Card className="p-0 overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between gap-2">
              <h3 className="font-semibold text-sm text-slate-900">{t('Kundalik yozuvlari ({n})', { n: data.entries.length })}</h3>
              {isStudent && data.status === 'active' && (
                <Link to="/diary/new">
                  <Button size="sm" variant="outline" className="text-xs h-7">
                    + {t('Yangi yozuv')}
                  </Button>
                </Link>
              )}
            </div>
            <div className="overflow-x-auto max-h-[480px]">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0">
                  <tr className="bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider border-b border-slate-100">
                    <th className="py-2.5 px-4">{t('Sana')}</th>
                    <th className="py-2.5 px-4">{t('Mavzu')}</th>
                    <th className="py-2.5 px-4">{t('Reja bandi')}</th>
                    <th className="py-2.5 px-4">{t('Soat')}</th>
                    <th className="py-2.5 px-4">{t('Holat')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {data.entries.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-400">
                        {t("Hozircha yozuvlar yo'q")}
                      </td>
                    </tr>
                  ) : (
                    data.entries.map((e) => (
                      <tr key={e.id} className="hover:bg-slate-50/50">
                        <td className="py-2.5 px-4 whitespace-nowrap text-slate-600">{formatDate(e.date)}</td>
                        <td className="py-2.5 px-4 font-medium text-slate-900">
                          {isStudent && (e.status === 'draft' || e.status === 'returned') ? (
                            <Link to={`/diary/edit/${e.id}`} className="hover:text-indigo-600">
                              {e.title}
                            </Link>
                          ) : (
                            e.title
                          )}
                        </td>
                        <td className="py-2.5 px-4 text-slate-500">{data.plan.find((p) => p.id === e.planItemId)?.title ?? '—'}</td>
                        <td className="py-2.5 px-4 tabular-nums">{e.hours}</td>
                        <td className="py-2.5 px-4 whitespace-nowrap">
                          <StatusBadge status={e.status} />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </div>

      <Modal
        open={planModal.open}
        title={planModal.item ? t('Reja bandini tahrirlash') : t('Yangi reja bandi')}
        onClose={() => setPlanModal({ open: false })}
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setPlanModal({ open: false })}>
              {t('Bekor qilish')}
            </Button>
            <Button size="sm" onClick={savePlan} isLoading={saving}>
              {t('Saqlash')}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label={t('Mavzu / topshiriq')} required>
            <Input value={planForm.title} onChange={(e) => setPlanForm((f) => ({ ...f, title: e.target.value }))} placeholder={t("Masalan: Texnika xavfsizligi bo'yicha yo'riqnoma")} />
          </Field>
          <Field label={t('Rejadagi soat')} required>
            <Input type="number" min={0.5} max={500} step={0.5} value={planForm.plannedHours} onChange={(e) => setPlanForm((f) => ({ ...f, plannedHours: Number(e.target.value) }))} />
          </Field>
          <Field label={t('Tavsif')}>
            <Textarea rows={3} value={planForm.description} onChange={(e) => setPlanForm((f) => ({ ...f, description: e.target.value }))} />
          </Field>
        </div>
      </Modal>
    </div>
  );
}
