import { useCallback, useEffect, useState } from 'react';
import { Building2, Users2, Plus, Pencil, Trash2, Phone, MapPin } from 'lucide-react';
import type { Company, StudentGroup } from '@/lib/types';
import { fetchCompanies, fetchGroups, createCompany, updateCompany, deleteCompany, createGroup, updateGroup, deleteGroup } from '@/lib/dataService';
import { Card, Button, Input } from '@/components/ui';
import { Field, Modal, PageHeader, Textarea, useConfirm, useToast } from '@/components/ui/extra';
import { LoadingState, ErrorState, EmptyState } from '@/components/ui/FeedbackStates';
import { useI18n } from '@/i18n';

type Tab = 'companies' | 'groups';

export default function CatalogPage() {
  const { t } = useI18n();
  const toast = useToast();
  const confirm = useConfirm();
  const [tab, setTab] = useState<Tab>('companies');
  const [companies, setCompanies] = useState<Company[]>([]);
  const [groups, setGroups] = useState<StudentGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<{ kind: Tab; item?: Company | StudentGroup } | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [c, g] = await Promise.all([fetchCompanies(), fetchGroups()]);
      setCompanies(c);
      setGroups(g);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const open = (kind: Tab, item?: Company | StudentGroup) => {
    setFormError(null);
    if (kind === 'companies') {
      const c = item as Company | undefined;
      setForm({
        name: c?.name ?? '',
        address: c?.address ?? '',
        contactPhone: c?.contactPhone ?? '',
        description: c?.description ?? '',
        coords: c?.latitude != null && c?.longitude != null ? `${c.latitude}, ${c.longitude}` : '',
        checkinRadius: String(c?.checkinRadius ?? 300),
      });
    } else {
      const g = item as StudentGroup | undefined;
      setForm({ name: g?.name ?? '', faculty: g?.faculty ?? '', studyProgram: g?.studyProgram ?? '' });
    }
    setModal({ kind, item });
  };

  const save = async () => {
    if (!modal) return;
    setSaving(true);
    setFormError(null);
    try {
      if (modal.kind === 'companies') {
        let latitude: number | null = null;
        let longitude: number | null = null;
        if (form.coords?.trim()) {
          const m = form.coords.trim().match(/^(-?\d+(?:\.\d+)?)\s*[,; ]\s*(-?\d+(?:\.\d+)?)$/);
          if (!m) throw new Error(t("Koordinatalar «41.311081, 69.240562» ko'rinishida bo'lishi kerak"));
          latitude = Number(m[1]);
          longitude = Number(m[2]);
        }
        const p = {
          name: form.name,
          address: form.address,
          contactPhone: form.contactPhone || null,
          description: form.description || null,
          latitude,
          longitude,
          checkinRadius: Number(form.checkinRadius) || 300,
        };
        if (modal.item) await updateCompany(modal.item.id, p);
        else await createCompany(p);
      } else {
        const p = { name: form.name, faculty: form.faculty, studyProgram: form.studyProgram };
        if (modal.item) await updateGroup(modal.item.id, p);
        else await createGroup(p);
      }
      toast(t('Saqlandi'));
      setModal(null);
      await load();
    } catch (e: any) {
      setFormError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (kind: Tab, item: Company | StudentGroup) => {
    const ok = await confirm({ title: t("O'chirishni tasdiqlang"), message: t("«{name}» o'chiriladi.", { name: item.name }), confirmLabel: t("O'chirish"), destructive: true });
    if (!ok) return;
    try {
      if (kind === 'companies') await deleteCompany(item.id);
      else await deleteGroup(item.id);
      toast(t("O'chirildi"));
      await load();
    } catch (e: any) {
      toast(e.message, 'error');
    }
  };

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  const tabBtn = (k: Tab, label: string, Icon: typeof Building2, count: number) => (
    <button
      onClick={() => setTab(k)}
      className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium ${tab === k ? 'bg-white shadow-sm text-indigo-700 border border-slate-200' : 'text-slate-600 hover:text-slate-900'}`}
    >
      <Icon className="h-4 w-4" /> {label} <span className="text-xs text-slate-400">{count}</span>
    </button>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('Korxonalar va guruhlar')}
        subtitle={t("Amaliyot o'tash joylari (hamkor korxonalar) va o'quv guruhlari ma'lumotnomasi")}
        actions={
          <Button size="sm" className="gap-2" onClick={() => open(tab)}>
            <Plus className="h-4 w-4" /> {tab === 'companies' ? t("Korxona qo'shish") : t("Guruh qo'shish")}
          </Button>
        }
      />
      <div className="inline-flex gap-1 p-1 rounded-xl bg-slate-100">
        {tabBtn('companies', t('Korxonalar'), Building2, companies.length)}
        {tabBtn('groups', t('Guruhlar'), Users2, groups.length)}
      </div>

      {tab === 'companies' ? (
        companies.length === 0 ? (
          <EmptyState title={t("Korxonalar yo'q")} description={t("Amaliyot o'tkaziladigan birinchi korxonani qo'shing.")} action={{ label: t("Korxona qo'shish"), onClick: () => open('companies') }} />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {companies.map((c) => (
              <Card key={c.id} className="p-4 sm:p-5 flex flex-col gap-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="h-9 w-9 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                      <Building2 className="h-4.5 w-4.5" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-sm text-slate-900 truncate">{c.name}</div>
                      <div className="text-[11px] text-slate-400">{t('{n} ta amaliyot', { n: c.internshipCount })}</div>
                    </div>
                  </div>
                  <div className="flex shrink-0">
                    <button className="p-1.5 text-slate-400 hover:text-indigo-600" onClick={() => open('companies', c)} aria-label={t('Tahrirlash')}>
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button className="p-1.5 text-slate-400 hover:text-rose-600" onClick={() => remove('companies', c)} aria-label={t("O'chirish")}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                <div className="space-y-1 text-xs text-slate-600">
                  <div className="flex gap-2">
                    <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0 mt-0.5" /> {c.address}
                  </div>
                  {c.latitude != null && (
                    <div className="flex items-start gap-1.5 text-emerald-700">
                      <MapPin className="h-3.5 w-3.5 shrink-0 mt-0.5" /> {t('Geolokatsiyali davomat yoqilgan')} ({c.checkinRadius} m)
                    </div>
                  )}
                  {c.contactPhone && (
                    <div className="flex gap-2">
                      <Phone className="h-3.5 w-3.5 text-slate-400 shrink-0 mt-0.5" /> {c.contactPhone}
                    </div>
                  )}
                </div>
                {c.description && <p className="text-xs text-slate-500 border-t border-slate-100 pt-2">{c.description}</p>}
              </Card>
            ))}
          </div>
        )
      ) : groups.length === 0 ? (
        <EmptyState title={t("Guruhlar yo'q")} description={t("Birinchi o'quv guruhini qo'shing.")} action={{ label: t("Guruh qo'shish"), onClick: () => open('groups') }} />
      ) : (
        <Card className="p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider border-b border-slate-100">
                  <th className="py-3 px-4">{t('Guruh')}</th>
                  <th className="py-3 px-4">{t("Bo'lim")}</th>
                  <th className="py-3 px-4">{t('Mutaxassislik')}</th>
                  <th className="py-3 px-4">{t('Talabalar')}</th>
                  <th className="py-3 px-4 text-right">{t('Amallar')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {groups.map((g) => (
                  <tr key={g.id} className="hover:bg-slate-50/50">
                    <td className="py-3 px-4 font-semibold text-slate-900">{g.name}</td>
                    <td className="py-3 px-4">{g.faculty}</td>
                    <td className="py-3 px-4">{g.studyProgram}</td>
                    <td className="py-3 px-4 tabular-nums">{g.studentCount}</td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <button className="p-1.5 text-slate-400 hover:text-indigo-600" onClick={() => open('groups', g)} aria-label={t('Tahrirlash')}>
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button className="p-1.5 text-slate-400 hover:text-rose-600" onClick={() => remove('groups', g)} aria-label={t("O'chirish")}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Modal
        open={Boolean(modal)}
        title={
          modal?.kind === 'companies'
            ? modal.item
              ? t('Korxonani tahrirlash')
              : t('Yangi korxona')
            : modal?.item
              ? t('Guruhni tahrirlash')
              : t('Yangi guruh')
        }
        onClose={() => setModal(null)}
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setModal(null)}>
              {t('Bekor qilish')}
            </Button>
            <Button size="sm" onClick={save} isLoading={saving}>
              {t('Saqlash')}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {formError && <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs">{formError}</div>}
          {modal?.kind === 'companies' ? (
            <>
              <Field label={t('Korxona nomi')} required>
                <Input value={form.name ?? ''} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </Field>
              <Field label={t('Manzil')} required>
                <Input value={form.address ?? ''} onChange={(e) => setForm({ ...form, address: e.target.value })} />
              </Field>
              <Field label={t('Telefon')}>
                <Input value={form.contactPhone ?? ''} onChange={(e) => setForm({ ...form, contactPhone: e.target.value })} placeholder="+998 71 000-00-00" />
              </Field>
              <Field label={t('Faoliyat yo‘nalishi / tavsif')}>
                <Textarea rows={3} value={form.description ?? ''} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </Field>
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <Field label={t('Koordinatalar (kenglik, uzunlik)')}>
                    <Input value={form.coords ?? ''} onChange={(e) => setForm({ ...form, coords: e.target.value })} placeholder="41.311081, 69.240562" />
                  </Field>
                </div>
                <Field label={t('Radius (m)')}>
                  <Input type="number" min={50} max={5000} value={form.checkinRadius ?? '300'} onChange={(e) => setForm({ ...form, checkinRadius: e.target.value })} />
                </Field>
              </div>
              <p className="text-[11px] text-slate-500 -mt-2">
                {t("Talaba Telegram botda «📍 Keldim» tugmasini bosganda joylashuvi shu nuqtadan radius ichida bo'lsa, davomat avtomatik belgilanadi. Koordinatani Google Maps'da joy ustiga sichqonchaning o'ng tugmasini bosib olish mumkin.")}
              </p>
            </>
          ) : (
            <>
              <Field label={t('Guruh nomi')} required>
                <Input value={form.name ?? ''} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="EM-205" />
              </Field>
              <Field label={t("Bo'lim")} required>
                <Input value={form.faculty ?? ''} onChange={(e) => setForm({ ...form, faculty: e.target.value })} placeholder={t("Elektrotexnika bo'limi")} />
              </Field>
              <Field label={t('Mutaxassislik')} required>
                <Input value={form.studyProgram ?? ''} onChange={(e) => setForm({ ...form, studyProgram: e.target.value })} placeholder={t('Elektr jihozlari montajchisi')} />
              </Field>
            </>
          )}
        </div>
      </Modal>
    </div>
  );
}
