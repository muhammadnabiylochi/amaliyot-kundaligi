import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Save,
  Send,
  Plus,
  Trash2,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { Card, Button, Input } from '@/components/ui';
import { AttachmentSection } from '@/components/AttachmentSection';
import {
  saveDiaryEntry,
  fetchInternships,
  fetchDiaryEntryById,
  fetchPlan,
  MockInternship,
} from '@/lib/dataService';
import type { PlanItem } from '@/lib/types';
import { todayYmd } from '@/lib/types';
import { Target } from 'lucide-react';
import { useI18n } from '@/i18n';

export default function DiaryFormPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useI18n();
  const [currentEntryId, setCurrentEntryId] = useState<string | undefined>(id);
  const isEditing = Boolean(id || currentEntryId);

  useEffect(() => {
    setCurrentEntryId(id);
  }, [id]);

  const [date, setDate] = useState(todayYmd());
  const [internships, setInternships] = useState<MockInternship[]>([]);
  const [internshipId, setInternshipId] = useState('');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [hours, setHours] = useState(8);
  const [tasks, setTasks] = useState<string[]>([]);
  const [plan, setPlan] = useState<PlanItem[]>([]);
  const [planItemId, setPlanItemId] = useState<string>('');
  const [newTaskInput, setNewTaskInput] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isEntryApproved, setIsEntryApproved] = useState(false);
  const [entryStatus, setEntryStatus] = useState<'DRAFT' | 'RETURNED' | 'SUBMITTED' | 'APPROVED'>('DRAFT');

  useEffect(() => {
    let mounted = true;

    // Load available internships for current user
    fetchInternships()
      .then((data) => {
        if (!mounted) return;
        // Students write only into ACTIVE internships; prefer the active one by default
        const usable = data.filter((i) => i.status === 'active');
        setInternships(usable.length ? usable : data);
        if (!id && (usable[0] || data[0])) setInternshipId((usable[0] || data[0]).id);
      })
      .catch((e) => mounted && setErrorMessage(e.message));

    // If editing existing entry, load entry data
    if (id) {
      fetchDiaryEntryById(id).then((entry) => {
        if (mounted && !entry) {
          setErrorMessage(t("Kundalik yozuvi topilmadi yoki uni ko'rish huquqingiz yo'q."));
        }
        if (mounted && entry) {
          setPlanItemId(entry.planItemId ?? '');
          setDate(entry.date);
          setInternshipId(entry.internshipId);
          setTitle(entry.title);
          setContent(entry.content);
          setHours(entry.hours);
          // `result` is stored as "task1; task2" — the title is NOT part of it
          setTasks(entry.result ? entry.result.split(';').map((x) => x.trim()).filter(Boolean) : []);
          if (entry.status === 'approved') {
            setIsEntryApproved(true);
            setEntryStatus('APPROVED');
            setErrorMessage(t("Diqqat: Ushbu kundalik allaqachon tasdiqlangan (APPROVED). Uni o'zgartirish taqiqlanadi."));
          } else if (entry.status === 'returned') {
            setEntryStatus('RETURNED');
          } else if (entry.status === 'submitted') {
            setEntryStatus('SUBMITTED');
            setErrorMessage(t("Bu yozuv rahbarga topshirilgan va ko'rib chiqilmoqda — hozircha uni tahrirlab bo'lmaydi."));
          } else {
            setEntryStatus('DRAFT');
          }
        }
      }).catch((e) => mounted && setErrorMessage(e.message));
    }

    return () => {
      mounted = false;
    };
  }, [id]);

  useEffect(() => {
    if (!internshipId) return;
    let mounted = true;
    fetchPlan(internshipId)
      .then((items) => mounted && setPlan(items))
      .catch(() => mounted && setPlan([]));
    return () => {
      mounted = false;
    };
  }, [internshipId]);

  const isLocked = isEntryApproved || entryStatus === 'SUBMITTED';

  const handleAddTask = () => {
    if (newTaskInput.trim()) {
      setTasks([...tasks, newTaskInput.trim()]);
      setNewTaskInput('');
    }
  };

  const handleRemoveTask = (index: number) => {
    setTasks(tasks.filter((_, i) => i !== index));
  };

  const handleSubmit = async (actionType: 'save_draft' | 'submit') => {
    if (isSaving) return; // Prevent duplicate clicks

    if (isEntryApproved) {
      setErrorMessage(t("Tasdiqlangan kundalikni qayta saqlash mumkin emas."));
      return;
    }

    if (!title.trim()) {
      setErrorMessage(t("Iltimos, ish mavzusini kiriting."));
      return;
    }
    if (!content.trim()) {
      setErrorMessage(t("Bajarilgan ishlarning tavsifini yozing."));
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);

    const payload = {
      internshipId: internshipId || undefined,
      entryDate: date,
      taskTitle: title.trim(),
      description: content.trim(),
      result: tasks.length > 0 ? tasks.join('; ') : '',
      hours,
      planItemId: planItemId || null,
      status: (actionType === 'save_draft' ? 'DRAFT' : 'SUBMITTED') as 'DRAFT' | 'SUBMITTED',
    };

    const targetId = id || currentEntryId;
    const res = await saveDiaryEntry(payload, targetId);
    setIsSaving(false);

    if (res.ok) {
      const createdId = res.data?.id || targetId;
      const newStatus = actionType === 'save_draft' ? 'DRAFT' : 'SUBMITTED';
      setEntryStatus(newStatus as any);

      if (actionType === 'save_draft') {
        if (createdId && !id) {
          setCurrentEntryId(createdId);
          navigate(`/diary/edit/${createdId}`, { replace: true });
        }
        setSaveSuccess(t("Qoralama muvaffaqiyatli saqlandi! Endi fayl biriktirishingiz yoki tahrirlashni davom ettirishingiz mumkin."));
        setTimeout(() => {
          setSaveSuccess(null);
        }, 4000);
      } else {
        setSaveSuccess(t("Kundalik muvaffaqiyatli topshirildi va rahbar tekshiruviga yuborildi!"));
        setTimeout(() => {
          navigate('/diary');
        }, 1200);
      }
    } else {
      setErrorMessage(res.error || t("Yozuvni saqlashda xatolik yuz berdi. Qaytadan urinib ko'ring."));
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Top back navigation and title */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/diary">
            <Button variant="outline" size="sm" className="h-8 w-8 p-0">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              {isEditing ? t("Kundalik yozuvini tahrirlash") : t("Yangi kundalik yozuvi yaratish")}
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              {t("Kunlik o'tilgan amaliyot va bajarilgan ishlar hisoboti")}
            </p>
          </div>
        </div>
      </div>

      {saveSuccess && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center gap-2 text-xs font-medium animate-in fade-in">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
          <span>{saveSuccess}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center gap-2 text-xs font-medium animate-in fade-in">
          <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Main Form Card */}
      <Card className="p-6 border-slate-200/80 space-y-5">
        {/* Row 1: Internship & Date */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
              {t("Amaliyot dasturi")} <span className="text-rose-500">*</span>
            </label>
            <select
              value={internshipId}
              disabled={isEditing}
              onChange={(e) => setInternshipId(e.target.value)}
              className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-100 disabled:cursor-not-allowed"
            >
              {internships.length > 0 ? (
                internships.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.company} ({item.studentName})
                  </option>
                ))
              ) : (
                <option value="">{t("Faol amaliyot (Standart)")}</option>
              )}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
              {t("Sana")} <span className="text-rose-500">*</span>
            </label>
            <Input
              type="date"
              value={date}
              disabled={isLocked}
              onChange={(e) => setDate(e.target.value)}
              icon={<Calendar className="h-4 w-4" />}
            />
          </div>
        </div>

        {/* Plan item */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
            <Target className="inline h-3.5 w-3.5 mr-1 -mt-0.5 text-indigo-600" />
            {t("Amaliyot rejasidagi mavzu")}
          </label>
          <select
            value={planItemId}
            disabled={isLocked}
            onChange={(e) => setPlanItemId(e.target.value)}
            className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-100 disabled:cursor-not-allowed"
          >
            <option value="">{plan.length ? t("— Reja bandini tanlang (ixtiyoriy) —") : t("Rahbar hali reja kiritmagan")}</option>
            {plan.map((p, i) => (
              <option key={p.id} value={p.id}>
                {i + 1}. {p.title} ({p.plannedHours} soat)
              </option>
            ))}
          </select>
          <p className="text-[11px] text-slate-400 mt-1">{t("Tasdiqlangan soatlar shu reja bandining bajarilishiga qo'shiladi.")}</p>
        </div>

        {/* Row 2: Title and Hours */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
              {t("Mavzu yoki Asosiy faoliyat")} <span className="text-rose-500">*</span>
            </label>
            <Input
              type="text"
              disabled={isLocked}
              placeholder={t("Masalan: React komponentlarini refaktoring qilish")}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
              {t("Ish vaqti (soat)")}
            </label>
            <Input
              type="number"
              min={0.5}
              max={24}
              step={0.5}
              disabled={isLocked}
              value={hours}
              onChange={(e) => setHours(Number(e.target.value))}
              icon={<Clock className="h-4 w-4" />}
            />
          </div>
        </div>

        {/* Tasks list */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
            {t("Kun davomida bajarilgan alohida vazifalar ro'yxati")}
          </label>
          {!isLocked && (
            <div className="flex gap-2 mb-2">
              <Input
                type="text"
                placeholder={t("Vazifa nomini yozing...")}
                value={newTaskInput}
                onChange={(e) => setNewTaskInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTask())}
              />
              <Button type="button" variant="secondary" size="sm" onClick={handleAddTask} className="shrink-0">
                <Plus className="h-4 w-4 mr-1" />
                {t("Qo'shish")}
              </Button>
            </div>
          )}

          {tasks.length > 0 ? (
            <div className="space-y-1.5 bg-slate-50 p-3 rounded-lg border border-slate-100">
              {tasks.map((task, index) => (
                <div key={index} className="flex items-center justify-between gap-2 text-xs bg-white px-3 py-2 rounded-md border border-slate-200">
                  <span className="text-slate-700 flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-indigo-600 shrink-0" />
                    {task}
                  </span>
                  {!isLocked && (
                    <button
                      type="button"
                      onClick={() => handleRemoveTask(index)}
                      className="text-slate-400 hover:text-rose-600 p-0.5 rounded transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-400 italic">{t("Vazifalar qo'shilmagan.")}</p>
          )}
        </div>

        {/* Content Details */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
            {t("Bajarilgan ishlarning batafsil tavsifi")} <span className="text-rose-500">*</span>
          </label>
          <textarea
            rows={5}
            disabled={isLocked}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={t("Bugungi amaliyot jarayonida qanday bilim va ko'nikmalarni qo'lladingiz, qanday muammolar paydo bo'ldi va ularni qanday bartaraf etdingiz...")}
            className="w-full rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-800 shadow-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 leading-relaxed disabled:bg-slate-100 disabled:cursor-not-allowed"
          />
        </div>

        {/* Attachments */}
        <div className="pt-2 border-t border-slate-100">
          <AttachmentSection
            entryId={id || currentEntryId}
            entryStatus={entryStatus}
          />
        </div>

        {/* Action Buttons */}
        <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
            <AlertCircle className="h-3.5 w-3.5 text-slate-400" />
            <span>{t("Yuborilgandan so'ng rahbar ko'rib chiqishi uchun taqdim etiladi.")}</span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isSaving || isLocked}
              onClick={() => handleSubmit('save_draft')}
              isLoading={isSaving}
              className="flex-1 sm:flex-none gap-1.5"
            >
              <Save className="h-4 w-4" />
              {t("Qoralama saqlash")}
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={isSaving || isLocked}
              onClick={() => handleSubmit('submit')}
              isLoading={isSaving}
              className="flex-1 sm:flex-none gap-1.5"
            >
              <Send className="h-4 w-4" />
              {t("Tasdiqlashga yuborish")}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
