import { useConfirm } from '@/components/ui/extra';
/**
 * AttachmentSection.tsx
 *
 * Kundalik yozuviga biriktirilgan fayllarni ko'rsatish va boshqarish komponenti.
 *
 * Props:
 *   entryId     — Kundalik ID si. Yangi yozuvda undefined bo'lishi mumkin.
 *   entryStatus — DRAFT | RETURNED → yuklash/o'chirish mumkin
 *                 SUBMITTED | APPROVED → faqat ko'rish va yuklab olish
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Paperclip,
  Upload,
  Download,
  Trash2,
  FileText,
  Image,
  File,
  Loader2,
} from 'lucide-react';
import {
  uploadDiaryAttachments,
  fetchDiaryAttachments,
  deleteAttachment,
  downloadAttachment,
  DiaryAttachment,
} from '@/lib/dataService';

interface Props {
  /** Saqlangan kundalik ID si. undefined bo'lsa yuklash bloklanadi. */
  entryId: string | undefined;
  entryStatus: 'DRAFT' | 'RETURNED' | 'SUBMITTED' | 'APPROVED';
}

const ALLOWED_EXTS = '.pdf,.jpg,.jpeg,.png,.docx,.xlsx';
const MAX_MB = 10;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatBytes(bytesStr: string): string {
  const n = Number(bytesStr);
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)} MB`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)} KB`;
  return `${n} B`;
}

function mimeIcon(mimeType: string) {
  if (mimeType.startsWith('image/'))
    return <Image className="h-4 w-4 text-blue-500 shrink-0" />;
  if (mimeType === 'application/pdf')
    return <FileText className="h-4 w-4 text-red-500 shrink-0" />;
  return <File className="h-4 w-4 text-slate-400 shrink-0" />;
}

function validateFiles(files: File[]): string | null {
  const allowedExts = new Set(['.pdf', '.jpg', '.jpeg', '.png', '.docx', '.xlsx']);
  for (const f of files) {
    const ext = '.' + f.name.split('.').pop()!.toLowerCase();
    if (!allowedExts.has(ext)) {
      return `"${f.name}" fayl turi qo'llab-quvvatlanmaydi. Ruxsat etilganlar: PDF, JPG, PNG, DOCX, XLSX`;
    }
    if (f.size > MAX_MB * 1024 * 1024) {
      return `"${f.name}" fayli ${MAX_MB} MB dan katta. Kichikroq fayl tanlang.`;
    }
  }
  return null;
}

// ─── Component ────────────────────────────────────────────────────────────────

export const AttachmentSection: React.FC<Props> = ({ entryId, entryStatus }) => {
  const confirm = useConfirm();
  const [attachments, setAttachments] = useState<DiaryAttachment[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const isMutable = entryStatus === 'DRAFT' || entryStatus === 'RETURNED';

  const loadAttachments = useCallback(async () => {
    if (!entryId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchDiaryAttachments(entryId);
      setAttachments(data);
    } catch (e: any) {
      setError(e?.message ?? "Fayllarni yuklashda xato");
    } finally {
      setLoading(false);
    }
  }, [entryId]);

  useEffect(() => {
    loadAttachments();
  }, [loadAttachments]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = ''; // reset input
    if (files.length === 0) return;

    // Client-side validation
    const validationError = validateFiles(files);
    if (validationError) {
      setError(validationError);
      return;
    }

    if (!entryId) {
      setError("Fayl biriktirish uchun avval kundalikni saqlang (Qoralama saqlash).");
      return;
    }

    setUploading(true);
    setError(null);
    try {
      const uploaded = await uploadDiaryAttachments(entryId, files);
      // Ro'yxatni yangilash
      await loadAttachments();
      // Muvaqqat ko'rsatish
      if (uploaded.length > 0) {
        // loadAttachments allaqachon yangilaydi
      }
    } catch (e: any) {
      setError(e?.message ?? "Fayl yuklashda xato yuz berdi");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (att: DiaryAttachment) => {
    const ok = await confirm({ title: "Faylni o'chirish", message: `"${att.originalName}" faylini o'chirmoqchimisiz?`, confirmLabel: "O'chirish", destructive: true });
    if (!ok) return;
    setDeletingId(att.id);
    setError(null);
    try {
      await deleteAttachment(att.id);
      setAttachments((prev) => prev.filter((a) => a.id !== att.id));
    } catch (e: any) {
      setError(e?.message ?? "Faylni o'chirishda xato");
    } finally {
      setDeletingId(null);
    }
  };

  const handleDownload = (att: DiaryAttachment) => {
    downloadAttachment(att.id, att.originalName).catch((e) => setError(e?.message ?? 'Fayl yuklab olishda xato'));
  };

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="mt-1">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-700">
          <Paperclip className="h-3.5 w-3.5" />
          Biriktirilgan fayllar
        </label>
        {loading && <Loader2 className="h-4 w-4 animate-spin text-slate-400" />}
      </div>

      {/* Error banner */}
      {error && (
        <div className="mb-2 p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800">
          {error}
        </div>
      )}

      {/* Upload button — faqat DRAFT / RETURNED holatida */}
      {isMutable && (
        <div className="mb-3">
          <label htmlFor="attachment-file-input">
            <div
              className="inline-flex items-center gap-2 text-xs font-medium border border-dashed border-slate-300 rounded-lg px-3 py-2 cursor-pointer hover:bg-slate-50 transition-colors"
              style={{ pointerEvents: uploading ? 'none' : 'auto', opacity: uploading ? 0.6 : 1 }}
            >
              {uploading ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-500" />
                  <span>Yuklanmoqda…</span>
                </>
              ) : (
                <>
                  <Upload className="h-3.5 w-3.5 text-indigo-500" />
                  <span>Fayl biriktirish</span>
                  <span className="text-slate-400">({ALLOWED_EXTS}, max {MAX_MB}MB)</span>
                </>
              )}
            </div>
          </label>
          <input
            id="attachment-file-input"
            type="file"
            multiple
            accept={ALLOWED_EXTS}
            onChange={handleFileChange}
            disabled={uploading || !isMutable}
            className="hidden"
          />
          {!entryId && (
            <p className="mt-1 text-[11px] text-amber-700 flex items-center gap-1">
              ⚠️ Fayl biriktirish uchun avval kundalikni <strong>Qoralama saqlash</strong> tugmasi orqali saqlang.
            </p>
          )}
        </div>
      )}

      {/* Attachments list */}
      {!loading && attachments.length === 0 ? (
        <p className="text-xs text-slate-400 italic">Hali biriktirilgan fayl yo'q.</p>
      ) : (
        <ul className="space-y-1.5">
          {attachments.map((att) => (
            <li
              key={att.id}
              className="flex items-center justify-between gap-2 px-3 py-2 bg-slate-50 border border-slate-100 rounded-lg text-xs"
            >
              <div className="flex items-center gap-2 flex-1 min-w-0">
                {mimeIcon(att.mimeType)}
                <span className="truncate text-slate-700" title={att.originalName}>
                  {att.originalName}
                </span>
                <span className="text-slate-400 shrink-0">
                  {formatBytes(att.sizeBytes)}
                </span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {/* Download */}
                <button
                  type="button"
                  title="Yuklab olish"
                  onClick={() => handleDownload(att)}
                  className="p-1 rounded hover:bg-indigo-50 text-indigo-600 transition-colors"
                >
                  <Download className="h-3.5 w-3.5" />
                </button>
                {/* Delete — faqat DRAFT / RETURNED */}
                {isMutable && (
                  <button
                    type="button"
                    title="O'chirish"
                    onClick={() => handleDelete(att)}
                    disabled={deletingId === att.id}
                    className="p-1 rounded hover:bg-rose-50 text-rose-500 transition-colors disabled:opacity-40"
                  >
                    {deletingId === att.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
