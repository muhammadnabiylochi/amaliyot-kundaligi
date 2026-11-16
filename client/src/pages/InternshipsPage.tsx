import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, Pencil, Trash2, BellRing, Building2, CalendarRange } from 'lucide-react';
import type { AppUser, Company, Internship, StudentGroup } from '@/lib/types';
import { formatDate, todayYmd } from '@/lib/types';
import {
  fetchInternships,
  fetchCompanies,
  fetchGroups,
  fetchUsers,
  createInternship,
  updateInternship,
  deleteInternship,
  sendReminder,
  InternshipPayload,
} from '@/lib/dataService';
import { Card, Button, Input } from '@/components/ui';
import { InternshipStatusBadge } from '@/components/ui/Badge';
import { Field, Modal, PageHeader, ProgressBar, Select, Textarea, useConfirm, useToast } from '@/components/ui/extra';
import { LoadingState, ErrorState, EmptyState } from '@/components/ui/FeedbackStates';
import { useAuth } from '@/context/AuthContext';
import { useI18n } from '@/i18n';

const EMPTY: InternshipPayload = {
  studentId: '',
  companyId: '',
  companySupervisorId: '',
  universitySupervisorId: '',
  startDate: todayYmd(),
  endDate: '',
  status: 'ACTIVE',
  position: '',
  programDescription: '',
};

export default function InternshipsPage() {
  const { user } = useAuth();
  const { t } = useI18n();
  const toast = useToast();
  const confirm = useConfirm();
  const isAdmin = user?.role === 'ADMIN';

  const [items, setItems] = useState<Internship[]>([]);
  const [groups, setGroups] = useState<StudentGroup[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [people, setPeople] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('all');
  const [groupId, setGroupId] = useState('all');

  const [editing, setEditing] = useState<Internship | null>(null);
  const [form, setForm] = useState<InternshipPayload>(EMPTY);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [list, g] = await Promise.all([fetchInternships(), fetchGroups()]);
      setItems(list);
      setGroups(g);
      if (isAdmin) {
        const [c, u] = await Promise.all([fetchCompanies(), fetchUsers()]);
        setCompanies(c);
        setPeople(u);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(
    () =>
      items.filter((i) => {
        const text = `${i.studentName} ${i.company} ${i.groupName ?? ''} ${i.companySupervisorName ?? ''} ${i.universitySupervisorName ?? ''}`.toLowerCase();
        return (!q || text.includes(q.toLowerCase())) && (status === 'all' || i.status === status) && (groupId === 'all' || i.groupId === groupId);
      }),
    [items, q, status, groupId],
  );

  const students = people.filter((p) => p.rawRole === 'STUDENT' && p.status === 'active');
  const companySups = people.filter((p) => p.rawRole === 'COMPANY_SUPERVISOR' && p.status === 'active');
  const uniSups = people.filter((p) => p.rawRole === 'UNIVERSITY_SUPERVISOR' && p.status === 'active');

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY);
    setFormError(null);
    setModalOpen(true);
  };
  const openEdit = (i: Internship) => {
    setEditing(i);
    setForm({
      studentId: i.studentId,
      companyId: i.companyId ?? '',
      companySupervisorId: i.companySupervisorId ?? '',
      universitySupervisorId: i.universitySupervisorId ?? '',
      startDate: i.startDate,
      endDate: i.endDate,
      status: i.status.toUpperCase() as InternshipPayload['status'],
      position: i.position,
      programDescription: i.programDescription ?? '',
    });
    setFormError(null);
    setModalOpen(true);
  };

  const save = async () => {
    setFormError(null);
    if (!form.studentId || !form.companyId || !form.startDate || !form.endDate) {
      setFormError(t("Talaba, korxona va sanalar to'ldirilishi shart"));
      return;
    }
    setSaving(true);
    const payload = {
      ...form,
      companySupervisorId: form.companySupervisorId || null,
      universitySupervisorId: form.universitySupervisorId || null,
    };
    try {
      if (editing) await updateInternship(editing.id, payload);
      else await createInternship(payload);
      toast(editing ? t('Amaliyot yangilandi') : t('Amaliyot yaratildi'));
      setModalOpen(false);
      await load();
    } catch (e: any) {
      setFormError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (i: Internship) => {
    const ok = await confirm({
      title: t("Amaliyotni o'chirish"),
      message: t("{name} amaliyoti o'chiriladi. Bu amalni qaytarib bo'lmaydi.", { name: i.studentName }),
      confirmLabel: t("O'chirish"),
      destructive: true,
    });
    if (!ok) return;
    try {
      await deleteInternship(i.id);
      toast(t("Amaliyot o'chirildi"));
      await load();
    } catch (e: any) {
      toast(e.message, 'error');
    }
  };

  const remind = async (i: Internship) => {
    try {
      toast(await sendReminder(i.id));
    } catch (e: any) {
      toast(e.message, 'warning');
    }
  };

  const set = <K extends keyof InternshipPayload>(k: K, v: InternshipPayload[K]) => setForm((f) => ({ ...f, [k]: v }));

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('Amaliyotlar')}
        subtitle={isAdmin ? t('Talabalarni korxona va rahbarlarga biriktirish, muddatlar va holatlarni boshqarish') : t('Sizga biriktirilgan talabalar amaliyotlari')}
        actions={
          isAdmin && (
            <Button size="sm" onClick={openCreate} className="gap-2">
              <Plus className="h-4 w-4" /> {t('Yangi amaliyot')}
            </Button>
          )
        }
      />

      <Card className="p-3 sm:p-4">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div className="sm:col-span-2">
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('Talaba, korxona yoki rahbar...')} icon={<Search className="h-4 w-4" />} />
          </div>
          <Select value={groupId} onChange={(e) => setGroupId(e.target.value)} aria-label={t('Guruh')}>
            <option value="all">{t('Barcha guruhlar')}</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </Select>
          <Select value={status} onChange={(e) => setStatus(e.target.value)} aria-label={t('Holat')}>
            <option value="all">{t('Barcha holatlar')}</option>
            <option value="planned">{t('Rejalashtirilgan')}</option>
            <option value="active">{t('Faol')}</option>
            <option value="completed">{t('Tugallangan')}</option>
            <option value="cancelled">{t('Bekor qilingan')}</option>
          </Select>
        </div>
      </Card>

      {filtered.length === 0 ? (
        <EmptyState
          title={t('Amaliyotlar topilmadi')}
          description={isAdmin ? t('Yangi amaliyot yaratib, talabani korxonaga biriktiring.') : t("Filtrga mos amaliyot yo'q.")}
          action={isAdmin ? { label: t('Yangi amaliyot'), onClick: openCreate } : undefined}
        />
      ) : (
        <Card className="p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider border-b border-slate-100">
                  <th className="py-3 px-4">{t('Talaba')}</th>
                  <th className="py-3 px-4">{t('Korxona')}</th>
                  <th className="py-3 px-4">{t('Rahbarlar')}</th>
                  <th className="py-3 px-4">{t('Davr')}</th>
                  <th className="py-3 px-4 min-w-[140px]">{t('Bajarilishi')}</th>
                  <th className="py-3 px-4">{t('Holat')}</th>
                  <th className="py-3 px-4 text-right">{t('Amallar')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filtered.map((i) => {
                  const pct = i.totalDays ? Math.round((i.approvedEntries / i.totalDays) * 100) : 0;
                  return (
                    <tr key={i.id} className="hover:bg-slate-50/50 align-top">
                      <td className="py-3 px-4">
                        <Link to={`/internship/${i.id}`} className="font-semibold text-slate-900 hover:text-indigo-600">
                          {i.studentName}
                        </Link>
                        <div className="text-[11px] text-slate-400">
                          {i.groupName ?? '—'} · {i.position}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5 font-medium text-slate-800">
                          <Building2 className="h-3.5 w-3.5 text-slate-400" />
                          {i.company}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-[11px] leading-5">
                        <div>
                          <span className="text-slate-400">{t('Korxona')}:</span> {i.companySupervisorName ?? '—'}
                        </div>
                        <div>
                          <span className="text-slate-400">{t('Muassasa')}:</span> {i.universitySupervisorName ?? '—'}
                        </div>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap text-[11px]">
                        <div className="flex items-center gap-1">
                          <CalendarRange className="h-3.5 w-3.5 text-slate-400" />
                          {formatDate(i.startDate)} — {formatDate(i.endDate)}
                        </div>
                        <div className="text-slate-400">{t('{n} ish kuni', { n: i.totalDays })}</div>
                      </td>
                      <td className="py-3 px-4">
                        <ProgressBar value={pct} />
                        <div className="text-[11px] text-slate-500 mt-1">
                          {i.approvedEntries}/{i.totalDays} · {t('{n} soat', { n: i.approvedHours ?? 0 })}
                          {i.pendingEntries > 0 && <span className="text-amber-600"> · {t('{n} kutilmoqda', { n: i.pendingEntries })}</span>}
                        </div>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <InternshipStatusBadge status={i.status} />
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap text-right">
                        <div className="inline-flex gap-1">
                          {i.status === 'active' && (
                            <Button variant="ghost" size="sm" className="h-7 px-2" title={t('Kundalik yozishni eslatish (Telegram)')} onClick={() => remind(i)}>
                              <BellRing className="h-3.5 w-3.5 text-amber-600" />
                            </Button>
                          )}
                          {isAdmin && (
                            <>
                              <Button variant="ghost" size="sm" className="h-7 px-2" title={t('Tahrirlash')} onClick={() => openEdit(i)}>
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button variant="ghost" size="sm" className="h-7 px-2 text-rose-600 hover:bg-rose-50" title={t("O'chirish")} onClick={() => remove(i)}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="p-3 bg-slate-50/50 border-t border-slate-100 text-xs text-slate-500 px-4">{t('Jami: {n} ta amaliyot', { n: filtered.length })}</div>
        </Card>
      )}

      <Modal
        open={modalOpen}
        size="lg"
        title={editing ? t('Amaliyotni tahrirlash') : t('Yangi amaliyot')}
        description={t('Talabani korxonaga va ikki rahbarga biriktiring')}
        onClose={() => setModalOpen(false)}
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setModalOpen(false)}>
              {t('Bekor qilish')}
            </Button>
            <Button size="sm" onClick={save} isLoading={saving}>
              {t('Saqlash')}
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {formError && <div className="sm:col-span-2 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs">{formError}</div>}
          <Field label={t('Talaba')} required>
            <Select value={form.studentId} onChange={(e) => set('studentId', e.target.value)} disabled={Boolean(editing)}>
              <option value="">{t('Tanlang...')}</option>
              {(editing ? people.filter((p) => p.id === form.studentId) : students).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} {s.group ? `(${s.group})` : ''}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t('Korxona')} required hint={companies.length ? undefined : t("Avval «Korxonalar va guruhlar» bo'limida korxona qo'shing")}>
            <Select value={form.companyId} onChange={(e) => set('companyId', e.target.value)}>
              <option value="">{t('Tanlang...')}</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t('Korxona rahbari')}>
            <Select value={form.companySupervisorId ?? ''} onChange={(e) => set('companySupervisorId', e.target.value)}>
              <option value="">{t('Belgilanmagan')}</option>
              {companySups.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                  {s.position ? ` — ${s.position}` : ''}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t("Ta'lim muassasasi rahbari")}>
            <Select value={form.universitySupervisorId ?? ''} onChange={(e) => set('universitySupervisorId', e.target.value)}>
              <option value="">{t('Belgilanmagan')}</option>
              {uniSups.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t('Boshlanish sanasi')} required>
            <Input type="date" value={form.startDate} onChange={(e) => set('startDate', e.target.value)} />
          </Field>
          <Field label={t('Tugash sanasi')} required>
            <Input type="date" value={form.endDate} min={form.startDate} onChange={(e) => set('endDate', e.target.value)} />
          </Field>
          <Field label={t('Lavozim / kasb')}>
            <Input value={form.position ?? ''} onChange={(e) => set('position', e.target.value)} placeholder={t('Masalan: Elektr montajchi (amaliyotchi)')} />
          </Field>
          <Field label={t('Holat')}>
            <Select value={form.status} onChange={(e) => set('status', e.target.value as InternshipPayload['status'])}>
              <option value="PLANNED">{t('Rejalashtirilgan')}</option>
              <option value="ACTIVE">{t('Faol')}</option>
              <option value="COMPLETED">{t('Tugallangan')}</option>
              <option value="CANCELLED">{t('Bekor qilingan')}</option>
            </Select>
          </Field>
          <Field label={t('Amaliyot maqsadi va mazmuni')} className="sm:col-span-2">
            <Textarea rows={3} value={form.programDescription ?? ''} onChange={(e) => set('programDescription', e.target.value)} />
          </Field>
        </div>
      </Modal>
    </div>
  );
}
