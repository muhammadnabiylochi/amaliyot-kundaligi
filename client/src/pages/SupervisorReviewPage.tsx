import { useState, useEffect } from 'react';
import {
  CheckCircle2,
  XCircle,
  Calendar,
  Clock,
  AlertCircle,
} from 'lucide-react';
import { formatDate, MockDiaryEntry } from '@/data/mock';
import { fetchDiaryEntries, submitDiaryReview } from '@/lib/dataService';
import { Card, Button } from '@/components/ui';
import { StatusBadge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/FeedbackStates';
import { AttachmentSection } from '@/components/AttachmentSection';

export default function SupervisorReviewPage() {
  const [entries, setEntries] = useState<MockDiaryEntry[]>([]);
  const [selectedEntryId, setSelectedEntryId] = useState<string>('');
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Load only SUBMITTED entries for supervisor review
  const loadReviewQueue = async () => {
    const data = await fetchDiaryEntries({ status: 'submitted' });
    // Filter strictly to submitted entries
    const submittedOnly = data.filter((e) => e.status === 'submitted');
    setEntries(submittedOnly);

    if (submittedOnly.length > 0) {
      // Keep selected entry if still in queue, else pick first
      setSelectedEntryId((prev) => {
        const stillThere = submittedOnly.find((e) => e.id === prev);
        return stillThere ? stillThere.id : submittedOnly[0].id;
      });
    } else {
      setSelectedEntryId('');
    }
  };

  useEffect(() => {
    loadReviewQueue();
  }, []);

  const selectedEntry = entries.find((e) => e.id === selectedEntryId);

  const handleReviewAction = async (newStatus: 'approved' | 'rejected') => {
    if (!selectedEntry || isSubmitting) return;

    setIsSubmitting(true);
    setActionError(null);

    const res = await submitDiaryReview(selectedEntry.id, {
      decision: newStatus,
      comment: comment || (newStatus === 'approved' ? "Tasdiqlandi" : "Qayta ishlash talab qilinadi"),
    });

    setIsSubmitting(false);

    if (res.ok) {
      setActionSuccess(
        newStatus === 'approved'
          ? `Kundalik yozuvi muvaffaqiyatli tasdiqlandi (APPROVED)!`
          : `Kundalik yozuvi tuzatish uchun qaytarildi (RETURNED).`
      );
      setComment('');

      // Reload queue from server so the reviewed entry vanishes from supervisor list
      await loadReviewQueue();

      setTimeout(() => setActionSuccess(null), 4000);
    } else {
      setActionError(res.error || "Ko'rib chiqishda xatolik yuz berdi.");
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Rahbar tekshiruvi va tasdiqlash
        </h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Talabalarning ko'rib chiqish uchun taqdim etgan kunlik hisobotlari navbati
        </p>
      </div>

      {actionSuccess && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center gap-2 text-xs font-medium animate-in fade-in">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {actionError && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center gap-2 text-xs font-medium animate-in fade-in">
          <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {/* Main 2-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left column: List of pending SUBMITTED entries (5 cols) */}
        <div className="lg:col-span-5 space-y-3">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Tasdiqlash navbati ({entries.length} ta kutilmoqda)
            </span>
          </div>

          {entries.length === 0 ? (
            <EmptyState
              title="Kutilayotgan yozuvlar yo'q"
              description="Ayni paytda talabalar tomonidan ko'rib chiqish uchun yuborilgan yangi hisobotlar mavjud emas."
            />
          ) : (
            <div className="space-y-2 max-h-[750px] overflow-y-auto pr-1">
              {entries.map((entry) => {
                const isSelected = entry.id === selectedEntryId;

                return (
                  <div
                    key={entry.id}
                    onClick={() => {
                      setSelectedEntryId(entry.id);
                      setComment('');
                      setActionError(null);
                    }}
                    className={`p-4 rounded-xl border cursor-pointer transition-all ${
                      isSelected
                        ? 'border-indigo-600 bg-indigo-50/50 shadow-xs ring-1 ring-indigo-600/20'
                        : 'border-slate-200/80 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-semibold text-xs text-slate-900 block truncate">
                        {entry.studentName}
                      </span>
                      <StatusBadge status={entry.status} />
                    </div>

                    <p className="font-medium text-xs text-slate-800 mt-1 line-clamp-1">
                      {entry.title}
                    </p>

                    <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-2">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {formatDate(entry.date)}
                      </span>
                      <span>·</span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {entry.hours} soat
                      </span>
                      <span>·</span>
                      <span className="truncate">{entry.company}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right column: Active Entry Review card (7 cols) */}
        <div className="lg:col-span-7">
          {selectedEntry ? (
            <Card className="p-6 border-slate-200/80 space-y-5 sticky top-20">
              <div className="flex items-start justify-between border-b border-slate-100 pb-4">
                <div>
                  <span className="text-xs font-semibold text-indigo-600 uppercase tracking-wider block">
                    {selectedEntry.company}
                  </span>
                  <h2 className="text-lg font-bold text-slate-900 mt-1">{selectedEntry.title}</h2>
                  <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                    <span className="font-medium text-slate-700">{selectedEntry.studentName}</span>
                    <span>•</span>
                    <span>{formatDate(selectedEntry.date)}</span>
                    <span>•</span>
                    <span>{selectedEntry.hours} ish soati</span>
                  </div>
                </div>
                <StatusBadge status={selectedEntry.status} />
              </div>

              {/* Content description */}
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
                  Bajarilgan ishlar hisoboti:
                </h4>
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">
                  {selectedEntry.content}
                </div>
              </div>

              {/* Sub-tasks */}
              {selectedEntry.tasks.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
                    Talaba tomonidan belgilangan vazifalar / natija:
                  </h4>
                  <div className="space-y-1.5">
                    {selectedEntry.tasks.map((task, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-xs text-slate-700 p-2 rounded-md bg-white border border-slate-100">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                        <span>{task}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Attachments (read-only for supervisor) */}
              <div className="pt-1 border-t border-slate-100">
                <AttachmentSection
                  entryId={selectedEntry.id}
                  entryStatus="SUBMITTED"
                />
              </div>

              {/* Supervisor Feedback Input */}
              <div className="pt-2">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                  Rahbar xulosasi va tavsiyalari (ixtiyoriy)
                </label>
                <textarea
                  rows={3}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Talabaning bajargan ishi bo'yicha izoh yoki qaytarish sababini yozing..."
                  className="w-full rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-800 shadow-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 leading-relaxed"
                />
              </div>

              {/* Decision Action Buttons */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={isSubmitting}
                  onClick={() => handleReviewAction('rejected')}
                  className="border-rose-200 text-rose-700 hover:bg-rose-50 gap-1.5"
                >
                  <XCircle className="h-4 w-4" />
                  Qaytarish (RETURNED)
                </Button>
                <Button
                  size="sm"
                  disabled={isSubmitting}
                  onClick={() => handleReviewAction('approved')}
                  className="bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 gap-1.5"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Tasdiqlash (APPROVED)
                </Button>
              </div>
            </Card>
          ) : (
            <EmptyState
              title="Yozuv tanlanmagan"
              description="Ko'rib chiqish va baholash uchun navbatdan talaba yozuvini tanlang."
            />
          )}
        </div>
      </div>
    </div>
  );
}
