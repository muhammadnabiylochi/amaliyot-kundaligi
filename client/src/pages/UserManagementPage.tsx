import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { UserPlus, Search, Upload, Pencil, KeyRound, Ban, CheckCircle2, Copy, Download, FileSpreadsheet } from 'lucide-react';
import type { AppUser, ApiRole, StudentGroup } from '@/lib/types';
import { ROLE_LABELS } from '@/lib/types';
import {
  fetchUsers,
  fetchGroups,
  createUser,
  updateUser,
  resetUserPassword,
  toggleUserStatus,
  importUsers,
  downloadReport,
  ImportResult,
  UserPayload,
} from '@/lib/dataService';
import { Card, Button, Input } from '@/components/ui';
import { RoleBadge, UserStatusBadge } from '@/components/ui/Badge';
import { Field, Modal, PageHeader, Select, useConfirm, useCopy, useToast } from '@/components/ui/extra';
import { LoadingState, ErrorState, EmptyState } from '@/components/ui/FeedbackStates';
import { useAuth } from '@/context/AuthContext';
import { useI18n } from '@/i18n';

const ROLES: ApiRole[] = ['STUDENT', 'COMPANY_SUPERVISOR', 'UNIVERSITY_SUPERVISOR', 'ADMIN'];
const EMPTY: UserPayload = { fullName: '', email: '', role: 'STUDENT', phone: '', position: '', groupId: '', studentNumber: '' };

function csvEscape(v: string) {
  return /[",;\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

export default function UserManagementPage() {
  const { user: me } = useAuth();
  const { t } = useI18n();
  const toast = useToast();
  const confirm = useConfirm();
  const copy = useCopy();
  const fileRef = useRef<HTMLInputElement>(null);

  const [users, setUsers] = useState<AppUser[]>([]);
  const [groups, setGroups] = useState<StudentGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [role, setRole] = useState('all');
  const [status, setStatus] = useState('all');
  const [groupFilter, setGroupFilter] = useState('all');

  const [editing, setEditing] = useState<AppUser | null>(null);
  const [form, setForm] = useState<UserPayload>(EMPTY);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [credential, setCredential] = useState<{ name: string; email: string; password: string } | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [u, g] = await Promise.all([fetchUsers(), fetchGroups()]);
      setUsers(u);
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

  const filtered = useMemo(
    () =>
      users.filter((u) => {
        const text = `${u.name} ${u.email} ${u.group ?? ''} ${u.studentNumber ?? ''} ${u.position ?? ''}`.toLowerCase();
        return (
          (!q || text.includes(q.toLowerCase())) &&
          (role === 'all' || u.rawRole === role) &&
          (status === 'all' || u.status === status) &&
          (groupFilter === 'all' || u.groupId === groupFilter)
        );
      }),
    [users, q, role, status, groupFilter],
  );

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    users.forEach((u) => (c[u.rawRole ?? ''] = (c[u.rawRole ?? ''] ?? 0) + 1));
    return c;
  }, [users]);

  const openCreate = () => {
    setEditing(null);
    setForm({ ...EMPTY, groupId: groups[0]?.id ?? '' });
    setFormError(null);
    setModalOpen(true);
  };
  const openEdit = (u: AppUser) => {
    setEditing(u);
    setForm({
      fullName: u.name,
      email: u.email,
      role: (u.rawRole ?? 'STUDENT') as UserPayload['role'],
      phone: u.phone ?? '',
      position: u.position ?? '',
      groupId: u.groupId ?? groups[0]?.id ?? '',
      studentNumber: u.studentNumber ?? '',
    });
    setFormError(null);
    setModalOpen(true);
  };

  const save = async () => {
    setSaving(true);
    setFormError(null);
    const payload: UserPayload = {
      ...form,
      phone: form.phone || null,
      position: form.position || null,
      groupId: form.role === 'STUDENT' ? form.groupId || null : null,
      studentNumber: form.role === 'STUDENT' ? form.studentNumber || null : null,
    };
    try {
      if (editing) {
        await updateUser(editing.id, payload);
        toast(t('Foydalanuvchi yangilandi'));
      } else {
        const r = await createUser(payload);
        setCredential({ name: r.user.name, email: r.user.email, password: r.tempPassword });
      }
      setModalOpen(false);
      await load();
    } catch (e: any) {
      setFormError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const resetPassword = async (u: AppUser) => {
    const ok = await confirm({
      title: t('Parolni tiklash'),
      message: t('{name} uchun yangi vaqtinchalik parol yaratiladi. Eski parol ishlamay qoladi.', { name: u.name }),
      confirmLabel: t('Tiklash'),
    });
    if (!ok) return;
    try {
      const r = await resetUserPassword(u.id);
      setCredential({ name: u.name, email: u.email, password: r.tempPassword });
    } catch (e: any) {
      toast(e.message, 'error');
    }
  };

  const toggle = async (u: AppUser) => {
    if (u.status === 'active') {
      const ok = await confirm({
        title: t('Hisobni bloklash'),
        message: t("{name} tizimga kira olmaydi. Keyinroq qayta faollashtirish mumkin.", { name: u.name }),
        confirmLabel: t('Bloklash'),
        destructive: true,
      });
      if (!ok) return;
    }
    try {
      const active = await toggleUserStatus(u.id);
      setUsers((list) => list.map((x) => (x.id === u.id ? { ...x, status: active ? 'active' : 'inactive' } : x)));
      toast(active ? t('Hisob faollashtirildi') : t('Hisob bloklandi'));
    } catch (e: any) {
      toast(e.message, 'error');
    }
  };

  const onImportFile = async (file?: File) => {
    if (!file) return;
    setImporting(true);
    try {
      const r = await importUsers(file);
      setImportResult(r);
      await load();
    } catch (e: any) {
      toast(e.message, 'error');
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const downloadCredentials = () => {
    if (!importResult) return;
    const rows = [['F.I.SH', 'Email', 'Vaqtinchalik parol'], ...importResult.results.filter((r) => r.tempPassword).map((r) => [r.fullName, r.email, r.tempPassword!])];
    const blob = new Blob(['﻿' + rows.map((r) => r.map(csvEscape).join(';')).join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'yangi_foydalanuvchilar_parollar.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  const set = <K extends keyof UserPayload>(k: K, v: UserPayload[K]) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('Foydalanuvchilarni boshqarish')}
        subtitle={t('Talabalar, rahbarlar va administratorlar: yaratish, tahrirlash, parol tiklash va Excel orqali import')}
        actions={
          <>
            <input ref={fileRef} type="file" accept=".xlsx" className="hidden" onChange={(e) => onImportFile(e.target.files?.[0])} />
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => downloadReport('/api/users/import/template', 'foydalanuvchilar_shablon.xlsx').catch((e) => toast(e.message, 'error'))}>
              <Download className="h-4 w-4" /> {t('Shablon')}
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => fileRef.current?.click()} isLoading={importing}>
              <Upload className="h-4 w-4" /> {t('Excel import')}
            </Button>
            <Button size="sm" onClick={openCreate} className="gap-2">
              <UserPlus className="h-4 w-4" /> {t("Foydalanuvchi qo'shish")}
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {ROLES.map((r) => (
          <button
            key={r}
            onClick={() => setRole(role === r ? 'all' : r)}
            className={`rounded-xl border p-3 text-left transition-colors ${role === r ? 'border-indigo-300 bg-indigo-50' : 'border-slate-200 bg-white hover:bg-slate-50'}`}
          >
            <div className="text-[11px] text-slate-500">{t(ROLE_LABELS[r])}</div>
            <div className="text-lg font-bold text-slate-900 tabular-nums">{counts[r] ?? 0}</div>
          </button>
        ))}
      </div>

      <Card className="p-3 sm:p-4">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div className="sm:col-span-2">
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('Ism, email, guruh yoki talaba ID...')} icon={<Search className="h-4 w-4" />} />
          </div>
          <Select value={groupFilter} onChange={(e) => setGroupFilter(e.target.value)} aria-label={t('Guruh')}>
            <option value="all">{t('Barcha guruhlar')}</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </Select>
          <Select value={status} onChange={(e) => setStatus(e.target.value)} aria-label={t('Holat')}>
            <option value="all">{t('Barcha holatlar')}</option>
            <option value="active">{t('Faol')}</option>
            <option value="inactive">{t('Nofaol')}</option>
          </Select>
        </div>
      </Card>

      {filtered.length === 0 ? (
        <EmptyState title={t('Foydalanuvchilar topilmadi')} description={t("Filtrni o'zgartiring yoki yangi foydalanuvchi qo'shing.")} />
      ) : (
        <Card className="p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider border-b border-slate-100">
                  <th className="py-3 px-4">{t('Foydalanuvchi')}</th>
                  <th className="py-3 px-4">{t('Roli')}</th>
                  <th className="py-3 px-4">{t('Guruh / lavozim')}</th>
                  <th className="py-3 px-4">{t('Telefon')}</th>
                  <th className="py-3 px-4">{t('Holati')}</th>
                  <th className="py-3 px-4 text-right">{t('Amallar')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filtered.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50/50">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center font-semibold text-slate-700 shrink-0">
                          {u.name
                            .split(' ')
                            .map((p) => p[0])
                            .join('')
                            .slice(0, 2)
                            .toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold text-slate-900">{u.name}</div>
                          <div className="text-[11px] text-slate-400 break-all">{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <RoleBadge role={u.rawRole ?? u.role} />
                      {u.mustChangePassword && <div className="text-[10px] text-amber-600 mt-1">{t('Vaqtinchalik parol')}</div>}
                    </td>
                    <td className="py-3 px-4">
                      {u.rawRole === 'STUDENT' ? (
                        <>
                          <span className="font-medium text-slate-800">{u.group ?? '—'}</span>
                          <span className="block text-[11px] text-slate-400">{u.studentNumber}</span>
                        </>
                      ) : (
                        <span className="text-slate-600">{u.position || '—'}</span>
                      )}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap text-slate-500">{u.phone || '—'}</td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <UserStatusBadge status={u.status} />
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap text-right">
                      <div className="inline-flex gap-0.5">
                        <Button variant="ghost" size="sm" className="h-7 px-2" title={t('Tahrirlash')} onClick={() => openEdit(u)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 px-2" title={t('Parolni tiklash')} onClick={() => resetPassword(u)}>
                          <KeyRound className="h-3.5 w-3.5" />
                        </Button>
                        {u.id !== me?.id && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className={`h-7 px-2 ${u.status === 'active' ? 'text-rose-600 hover:bg-rose-50' : 'text-emerald-600 hover:bg-emerald-50'}`}
                            title={u.status === 'active' ? t('Bloklash') : t('Faollashtirish')}
                            onClick={() => toggle(u)}
                          >
                            {u.status === 'active' ? <Ban className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="p-3 bg-slate-50/50 border-t border-slate-100 text-xs text-slate-500 px-4">{t('Jami: {n} nafar', { n: filtered.length })}</div>
        </Card>
      )}

      {/* Create / edit */}
      <Modal
        open={modalOpen}
        title={editing ? t('Foydalanuvchini tahrirlash') : t('Yangi foydalanuvchi')}
        description={editing ? undefined : t('Saqlangandan keyin vaqtinchalik parol ko‘rsatiladi')}
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
          <Field label={t('F.I.SH')} required className="sm:col-span-2">
            <Input value={form.fullName} onChange={(e) => set('fullName', e.target.value)} placeholder={t('Familiya Ism Otasining ismi')} />
          </Field>
          <Field label={t('Elektron pochta')} required>
            <Input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="nomi@edu.uz" />
          </Field>
          <Field label={t('Rol')} required>
            <Select value={form.role} onChange={(e) => set('role', e.target.value as UserPayload['role'])} disabled={editing?.id === me?.id}>
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {t(ROLE_LABELS[r])}
                </option>
              ))}
            </Select>
          </Field>
          {form.role === 'STUDENT' ? (
            <>
              <Field label={t('Guruh')} required hint={groups.length ? undefined : t("Avval «Korxonalar va guruhlar» bo'limida guruh yarating")}>
                <Select value={form.groupId ?? ''} onChange={(e) => set('groupId', e.target.value)}>
                  <option value="">{t('Tanlang...')}</option>
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name} — {g.studyProgram}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={t('Talaba ID')} hint={t("Bo'sh qolsa, avtomatik beriladi")}>
                <Input value={form.studentNumber ?? ''} onChange={(e) => set('studentNumber', e.target.value)} placeholder="ST-2026-0001" />
              </Field>
            </>
          ) : (
            <Field label={t('Lavozim')} className="sm:col-span-2">
              <Input value={form.position ?? ''} onChange={(e) => set('position', e.target.value)} placeholder={t("Masalan: Ishlab chiqarish ta'limi ustasi")} />
            </Field>
          )}
          <Field label={t('Telefon')} className="sm:col-span-2">
            <Input value={form.phone ?? ''} onChange={(e) => set('phone', e.target.value)} placeholder="+998 90 000-00-00" />
          </Field>
        </div>
      </Modal>

      {/* One-time credential */}
      <Modal
        open={Boolean(credential)}
        size="sm"
        title={t('Vaqtinchalik parol')}
        onClose={() => setCredential(null)}
        footer={
          <Button size="sm" onClick={() => setCredential(null)}>
            {t('Tushunarli')}
          </Button>
        }
      >
        {credential && (
          <div className="space-y-3 text-sm">
            <p className="text-slate-600">{t("Ushbu ma'lumotlarni foydalanuvchiga yetkazing. Parol faqat hozir ko'rsatiladi; birinchi kirishda uni almashtirish so'raladi.")}</p>
            <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 space-y-1 text-xs">
              <div>
                <span className="text-slate-500">{t('Foydalanuvchi')}:</span> <strong>{credential.name}</strong>
              </div>
              <div>
                <span className="text-slate-500">Email:</span> <strong className="break-all">{credential.email}</strong>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-slate-500">{t('Parol')}:</span>
                <code className="font-mono font-bold text-indigo-700 text-sm">{credential.password}</code>
                <button className="p-1 text-slate-400 hover:text-indigo-600" onClick={() => copy(`${credential.email} / ${credential.password}`)} aria-label={t('Nusxalash')}>
                  <Copy className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Import result */}
      <Modal
        open={Boolean(importResult)}
        size="lg"
        title={t('Import natijasi')}
        onClose={() => setImportResult(null)}
        footer={
          <>
            {importResult && importResult.created > 0 && (
              <Button variant="outline" size="sm" className="gap-1.5" onClick={downloadCredentials}>
                <FileSpreadsheet className="h-4 w-4" /> {t('Parollarni yuklab olish (CSV)')}
              </Button>
            )}
            <Button size="sm" onClick={() => setImportResult(null)}>
              {t('Yopish')}
            </Button>
          </>
        }
      >
        {importResult && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="rounded-lg bg-emerald-50 p-2 text-emerald-800">
                {t('Yaratildi')}
                <div className="text-lg font-bold">{importResult.created}</div>
              </div>
              <div className="rounded-lg bg-slate-100 p-2 text-slate-700">
                {t("O'tkazib yuborildi")}
                <div className="text-lg font-bold">{importResult.skipped}</div>
              </div>
              <div className="rounded-lg bg-rose-50 p-2 text-rose-800">
                {t('Xatolar')}
                <div className="text-lg font-bold">{importResult.errors}</div>
              </div>
            </div>
            <div className="max-h-72 overflow-y-auto border border-slate-200 rounded-lg">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 sticky top-0">
                  <tr className="text-left text-slate-500">
                    <th className="py-2 px-3">{t('Qator')}</th>
                    <th className="py-2 px-3">{t('Foydalanuvchi')}</th>
                    <th className="py-2 px-3">{t('Natija')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {importResult.results.map((r) => (
                    <tr key={r.row}>
                      <td className="py-1.5 px-3 tabular-nums">{r.row}</td>
                      <td className="py-1.5 px-3">
                        <div className="font-medium">{r.fullName || '—'}</div>
                        <div className="text-slate-400 break-all">{r.email}</div>
                      </td>
                      <td className="py-1.5 px-3">
                        {r.status === 'created' ? (
                          <span className="text-emerald-700">
                            {t('Yaratildi')} · <code className="font-mono">{r.tempPassword}</code>
                          </span>
                        ) : (
                          <span className={r.status === 'error' ? 'text-rose-700' : 'text-slate-500'}>{r.message}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
