import { useEffect, useState } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { ShieldCheck, ShieldAlert, GraduationCap, Loader2 } from 'lucide-react';
import { verifyDocument, VerificationResult } from '@/lib/dataService';
import { formatDate } from '@/lib/types';
import { useI18n } from '@/i18n';

/** Public page opened from the QR code on the final report PDF. */
export default function VerifyPage() {
  const { internshipId = '' } = useParams();
  const [params] = useSearchParams();
  const { t } = useI18n();
  const [data, setData] = useState<VerificationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    verifyDocument(internshipId, params.get('c') ?? '')
      .then(setData)
      .catch((e) => setError(e.message));
  }, [internshipId, params]);

  const Row = ({ label, value }: { label: string; value: React.ReactNode }) => (
    <div className="flex justify-between gap-4 py-2 border-b border-slate-100 last:border-0 text-sm">
      <span className="text-slate-500">{label}</span>
      <span className="font-semibold text-slate-900 text-right">{value}</span>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-2 mb-5 text-slate-700">
          <GraduationCap className="h-6 w-6 text-indigo-600" />
          <span className="font-bold">{t('Elektron Amaliyot Kundaligi')}</span>
        </div>
        <div className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
          {!data && !error && (
            <div className="p-10 flex flex-col items-center text-slate-500 text-sm gap-3">
              <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
              {t('Hujjat tekshirilmoqda...')}
            </div>
          )}
          {error && (
            <div className="p-8 text-center space-y-3">
              <ShieldAlert className="h-12 w-12 text-rose-500 mx-auto" />
              <h1 className="text-lg font-bold text-slate-900">{t('Hujjat tasdiqlanmadi')}</h1>
              <p className="text-sm text-slate-600">{error}</p>
            </div>
          )}
          {data && (
            <>
              <div className="p-6 bg-emerald-50 border-b border-emerald-100 text-center space-y-2">
                <ShieldCheck className="h-12 w-12 text-emerald-600 mx-auto" />
                <h1 className="text-lg font-bold text-emerald-900">{t('Hujjat haqiqiy')}</h1>
                <p className="text-xs text-emerald-800">{t("Ushbu amaliyot hisoboti tizim ma'lumotlar bazasida mavjud.")}</p>
              </div>
              <div className="p-5">
                <Row label={t('Talaba')} value={data.studentName} />
                {data.groupName && <Row label={t('Guruh')} value={data.groupName} />}
                {data.studyProgram && <Row label={t('Mutaxassislik')} value={data.studyProgram} />}
                <Row label={t('Amaliyot joyi')} value={data.company} />
                <Row label={t('Davr')} value={`${formatDate(data.startDate)} — ${formatDate(data.endDate)}`} />
                <Row label={t('Tasdiqlangan kundaliklar')} value={`${data.approvedEntries} (${data.approvedHours} ${t('soat')})`} />
                <Row label={t('Davomat')} value={data.attendanceRate === null ? '—' : `${data.attendanceRate}%`} />
                <Row
                  label={t('Yakuniy ball')}
                  value={data.finalScore === null ? t('Baholash yakunlanmagan') : `${data.finalScore} / ${data.maxScore} — ${data.grade}`}
                />
              </div>
              <div className="px-5 pb-5 text-[11px] text-slate-400">
                {t('Tekshirilgan vaqt')}: {new Date(data.checkedAt).toLocaleString()}
              </div>
            </>
          )}
        </div>
        <div className="text-center mt-4">
          <Link to="/login" className="text-xs text-indigo-600 hover:underline">
            {t('Tizimga kirish')}
          </Link>
        </div>
      </div>
    </div>
  );
}
