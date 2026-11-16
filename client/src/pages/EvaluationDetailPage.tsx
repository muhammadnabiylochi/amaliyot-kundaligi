import { formatDate } from '@/lib/types';
import { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Save,
  Send,
  CheckCircle2,
  Clock,
  Lock,
  Info,
  Building2,
  GraduationCap,
  User,
  Calendar,
  AlertCircle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import {
  InternshipEvaluationDetail,
  fetchInternshipEvaluation,
  submitEvaluation,
} from '@/lib/dataService';
import { EVALUATION_CRITERIA, TOTAL_MAX_SCORE, EvaluationCriterionConfig } from '@/config/evaluationCriteria';
import { Card, Button } from '@/components/ui';
import { LoadingState, ErrorState } from '@/components/ui/FeedbackStates';
import { ExportButtons } from '@/components/ExportButtons';

// ── Local types ───────────────────────────────────────────────────────────────

interface CriterionFormState {
  key: string;
  score: number | '';
  comment: string;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="pb-3 border-b border-slate-100">
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
    </div>
  );
}

function ScoreBar({
  score,
  maxScore,
  colorClass = 'bg-indigo-500',
}: {
  score: number;
  maxScore: number;
  colorClass?: string;
}) {
  const pct = maxScore > 0 ? Math.min(100, (score / maxScore) * 100) : 0;
  return (
    <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
      <div
        className={`h-full rounded-full transition-all ${colorClass}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function CriterionReadonlyRow({
  crit,
  score,
  comment,
  colorClass,
}: {
  crit: EvaluationCriterionConfig;
  score: number | null;
  comment: string | null;
  colorClass?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="py-3 border-b border-slate-50 last:border-0">
      <div className="flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-slate-800">{crit.name}</span>
            <span className="text-xs font-bold text-slate-900 shrink-0">
              {score !== null ? score : '—'}
              <span className="font-normal text-slate-400"> / {crit.maxScore}</span>
            </span>
          </div>
          {score !== null && (
            <div className="mt-1.5">
              <ScoreBar score={score} maxScore={crit.maxScore} colorClass={colorClass} />
            </div>
          )}
        </div>
      </div>
      {comment && (
        <div className="mt-1.5 text-[11px] text-slate-500 italic">
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-indigo-600 font-medium hover:underline inline-flex items-center gap-0.5"
          >
            {expanded ? 'Yopish' : "Izohni ko'rish"}
            {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>
          {expanded && (
            <p className="mt-1 bg-slate-50 border border-slate-100 rounded-lg p-2 text-slate-600">
              "{comment}"
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main EvaluationDetailPage ─────────────────────────────────────────────────

export default function EvaluationDetailPage(): JSX.Element {
  const { internshipId } = useParams<{ internshipId: string }>();
  const { user } = useAuth();

  const [detail, setDetail] = useState<InternshipEvaluationDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form states for evaluator
  const [criteriaForm, setCriteriaForm] = useState<CriterionFormState[]>([]);
  const [generalComment, setGeneralComment] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Determine role of current user in this internship
  const evaluatorRole = useMemo(() => {
    if (user?.role === 'COMPANY_SUPERVISOR') return 'COMPANY_SUPERVISOR';
    if (user?.role === 'UNIVERSITY_SUPERVISOR') return 'UNIVERSITY_SUPERVISOR';
    if (user?.role === 'ADMIN') return 'UNIVERSITY_SUPERVISOR'; // admin acts as university supervisor
    return null;
  }, [user]);

  // Can the current user edit evaluation?
  const canEdit = useMemo(() => {
    if (!detail || !evaluatorRole) return false;
    const myEval =
      evaluatorRole === 'COMPANY_SUPERVISOR'
        ? detail.companyEvaluation
        : detail.universityEvaluation;
    // Can edit if no evaluation yet, or existing one is DRAFT
    return !myEval || myEval.status === 'DRAFT';
  }, [detail, evaluatorRole]);

  const loadData = async () => {
    if (!internshipId) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchInternshipEvaluation(internshipId);
      if (!data) {
        setError("Amaliyot baholash ma'lumotlari topilmadi.");
        return;
      }
      setDetail(data);

      // Initialize form from existing draft (if any) or blank
      const existingEval =
        evaluatorRole === 'COMPANY_SUPERVISOR'
          ? data.companyEvaluation
          : data.universityEvaluation;

      const existingMap = new Map(
        (existingEval?.criteria || []).map((c) => [c.key, c])
      );

      setCriteriaForm(
        EVALUATION_CRITERIA.map((crit) => {
          const existing = existingMap.get(crit.key);
          return {
            key: crit.key,
            score: existing ? existing.score : 0,
            comment: existing?.comment || '',
          };
        })
      );
      setGeneralComment(existingEval?.generalComment || '');
    } catch {
      setError("Ma'lumotlarni yuklashda xatolik yuz berdi.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [internshipId, evaluatorRole]);

  // Calculated total from form
  const formTotalScore = useMemo(() => {
    return criteriaForm.reduce((sum, c) => sum + (Number(c.score) || 0), 0);
  }, [criteriaForm]);

  const updateCriterionScore = (key: string, score: number | '') => {
    setCriteriaForm((prev) =>
      prev.map((c) => (c.key === key ? { ...c, score } : c))
    );
  };

  const updateCriterionComment = (key: string, comment: string) => {
    setCriteriaForm((prev) =>
      prev.map((c) => (c.key === key ? { ...c, comment } : c))
    );
  };

  const handleSave = async (status: 'DRAFT' | 'SUBMITTED') => {
    if (!internshipId) return;
    setSaveStatus(null);

    // Validate: all scores must be valid non-negative numbers
    for (const item of criteriaForm) {
      const crit = EVALUATION_CRITERIA.find((c) => c.key === item.key)!;
      const score = Number(item.score);
      if (isNaN(score) || score < 0) {
        setSaveStatus({ type: 'error', message: `"${crit.name}" uchun to'g'ri ball kiriting.` });
        return;
      }
      if (score > crit.maxScore) {
        setSaveStatus({
          type: 'error',
          message: `"${crit.name}" uchun ball ${crit.maxScore} dan oshmasligi kerak. Kiritildi: ${score}`,
        });
        return;
      }
    }

    if (status === 'SUBMITTED' && formTotalScore > TOTAL_MAX_SCORE) {
      setSaveStatus({
        type: 'error',
        message: `Jami ball ${TOTAL_MAX_SCORE} dan oshishi mumkin emas. Hozirgi jami: ${formTotalScore}`,
      });
      return;
    }

    setIsSaving(true);
    try {
      const result = await submitEvaluation({
        internshipId,
        status,
        generalComment: generalComment.trim() || undefined,
        criteria: criteriaForm.map((c) => ({
          criterionKey: c.key,
          score: Number(c.score) || 0,
          comment: c.comment.trim() || undefined,
        })),
      });

      if (!result.ok) {
        setSaveStatus({ type: 'error', message: result.error || "Saqlashda xatolik yuz berdi" });
        return;
      }

      setSaveStatus({
        type: 'success',
        message:
          status === 'SUBMITTED'
            ? 'Baholash yakuniy tarzda yuborildi!'
            : 'Baholash qoralama sifatida saqlandi.',
      });

      // Reload
      setTimeout(() => loadData(), 800);
    } catch (err: any) {
      setSaveStatus({ type: 'error', message: err.message || "Server bilan aloqa uzildi." });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <LoadingState message="Baholash tafsilotlari yuklanmoqda..." />
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <ErrorState message={error || "Ma'lumot topilmadi."} onRetry={loadData} />
      </div>
    );
  }

  const { internship, companyEvaluation, universityEvaluation, breakdown, finalResult } = detail;

  return (
    <div className="space-y-6">
      {/* Back nav + Header */}
      <div className="flex flex-col gap-3">
        <Link
          to="/evaluation"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-indigo-600 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Baholashlar ro'yxatiga qaytish
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900">Yakuniy baholash tafsiloti</h1>
              {finalResult.isCompleted ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <CheckCircle2 className="h-3 w-3" />
                  Yakunlangan
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                  <Clock className="h-3 w-3" />
                  Kutilmoqda
                </span>
              )}
            </div>
            <p className="text-sm text-slate-500 mt-0.5">
              {internship.studentName} · {internship.companyName}
            </p>
          </div>

          {/* Export buttons */}
          <ExportButtons
            pdfUrl={`/api/reports/evaluation/${internship.id}/pdf`}
            excelUrl={`/api/reports/evaluation/${internship.id}/excel`}
            baseFilename={`baholash_${internship.studentName.replace(/\s+/g, '_')}`}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── LEFT COLUMN: Student info + Final Result ── */}
        <div className="space-y-5">
          {/* Student & Internship Card */}
          <Card className="p-5 border-slate-200/80 space-y-4">
            <SectionHeader title="Amaliyot ma'lumotlari" />

            <div className="space-y-2.5 text-xs">
              <div className="flex items-start gap-2">
                <User className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
                <div>
                  <div className="font-semibold text-slate-900">{internship.studentName}</div>
                  <div className="text-slate-500">{internship.studentEmail}</div>
                  <div className="text-slate-400">{internship.studentGroup}</div>
                </div>
              </div>

              <div className="flex items-start gap-2">
                <Building2 className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
                <div>
                  <div className="font-semibold text-slate-900">{internship.companyName}</div>
                  <div className="text-slate-500">Korxona rahbari: {internship.companySupervisorName}</div>
                </div>
              </div>

              <div className="flex items-start gap-2">
                <GraduationCap className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
                <div>
                  <div className="font-semibold text-slate-900">Ta'lim muassasasi rahbari</div>
                  <div className="text-slate-500">{internship.universitySupervisorName}</div>
                </div>
              </div>

              <div className="flex items-start gap-2">
                <Calendar className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
                <div>
                  <div className="text-slate-600">
                    {internship.startDate} — {internship.endDate}
                  </div>
                </div>
              </div>
            </div>
          </Card>

          {/* Final Result Card */}
          <Card
            className={`p-5 border-2 ${
              finalResult.isCompleted
                ? 'border-emerald-200 bg-emerald-50/30'
                : 'border-dashed border-slate-200'
            }`}
          >
            <SectionHeader title="Yakuniy natija" />

            {finalResult.isCompleted ? (
              <div className="pt-4 text-center">
                <div className="text-4xl font-extrabold text-emerald-700">
                  {finalResult.finalScore}
                </div>
                <div className="text-xs text-emerald-600 font-medium mt-1">
                  / {finalResult.maxScore} ball
                </div>
                <div className="mt-3 w-full bg-emerald-100 rounded-full h-2 overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full"
                    style={{ width: `${Math.min(100, ((finalResult.finalScore || 0) / finalResult.maxScore) * 100)}%` }}
                  />
                </div>
                <div className="mt-3 text-xs text-slate-500 space-y-1">
                  <div className="flex justify-between">
                    <span>Korxona baho:</span>
                    <span className="font-semibold text-slate-700">{finalResult.companyTotalScore} ball</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Muassasa bahosi:</span>
                    <span className="font-semibold text-slate-700">{finalResult.universityTotalScore} ball</span>
                  </div>
                  <div className="flex justify-between border-t border-emerald-100 pt-1 mt-1">
                    <span>O'rtacha (yakuniy):</span>
                    <span className="font-bold text-emerald-700">{finalResult.finalScore} ball</span>
                  </div>
                </div>
                <div className="mt-3 p-2 bg-emerald-100/50 rounded-lg text-[11px] text-emerald-700 text-left">
                  <strong>Hisoblash usuli:</strong> Korxona va ta'lim muassasasi rahbarlarining yakunlangan
                  baholari o'rtacha hisoblanadi: ({finalResult.companyTotalScore} + {finalResult.universityTotalScore}) ÷ 2
                  = {finalResult.finalScore}
                </div>
              </div>
            ) : (
              <div className="pt-4 flex flex-col items-center text-center gap-3">
                <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center">
                  <Clock className="h-6 w-6 text-slate-400" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-slate-700">Baholash yakunlanmagan</div>
                  <div className="text-xs text-slate-500 mt-1">
                    Yakuniy natija ikki tomonlama baholash tugallangandan so'ng ko'rsatiladi.
                  </div>
                </div>
                <div className="text-xs space-y-1.5 w-full">
                  <div className="flex items-center justify-between p-2 rounded-lg border border-slate-100 bg-slate-50">
                    <span className="text-slate-500">Korxona rahbari:</span>
                    {companyEvaluation ? (
                      <span
                        className={`font-semibold text-xs ${
                          companyEvaluation.status === 'SUBMITTED'
                            ? 'text-emerald-600'
                            : 'text-amber-600'
                        }`}
                      >
                        {companyEvaluation.status === 'SUBMITTED'
                          ? `✓ Yuborildi (${companyEvaluation.totalScore} ball)`
                          : 'Qoralama'}
                      </span>
                    ) : (
                      <span className="text-slate-400">Kiritilmagan</span>
                    )}
                  </div>
                  <div className="flex items-center justify-between p-2 rounded-lg border border-slate-100 bg-slate-50">
                    <span className="text-slate-500">Univ. rahbari:</span>
                    {universityEvaluation ? (
                      <span
                        className={`font-semibold text-xs ${
                          universityEvaluation.status === 'SUBMITTED'
                            ? 'text-emerald-600'
                            : 'text-amber-600'
                        }`}
                      >
                        {universityEvaluation.status === 'SUBMITTED'
                          ? `✓ Yuborildi (${universityEvaluation.totalScore} ball)`
                          : 'Qoralama'}
                      </span>
                    ) : (
                      <span className="text-slate-400">Kiritilmagan</span>
                    )}
                  </div>
                </div>
              </div>
            )}
          </Card>
        </div>

        {/* ── RIGHT COLUMN: Evaluation forms and breakdown ── */}
        <div className="lg:col-span-2 space-y-5">

          {/* EVALUATOR FORM (Company Supervisor / University Supervisor / Admin) */}
          {evaluatorRole && (user?.role !== 'STUDENT') && (
            <Card className="p-5 border-slate-200/80 space-y-5">
              <div className="flex items-center justify-between">
                <SectionHeader
                  title={
                    evaluatorRole === 'COMPANY_SUPERVISOR'
                      ? 'Korxona rahbari bahosi'
                      : "Ta'lim muassasasi rahbari bahosi"
                  }
                  subtitle={
                    canEdit
                      ? "Har bir mezon uchun ball va izoh kiriting"
                      : "Bu baho yakuniy yuborilgan va tahrirlash taqiqlanadi"
                  }
                />
                {!canEdit && (
                  <div className="flex items-center gap-1.5 text-xs text-slate-500">
                    <Lock className="h-3.5 w-3.5" />
                    Qulflangan
                  </div>
                )}
              </div>

              {/* Criteria Form */}
              <div className="space-y-4">
                {EVALUATION_CRITERIA.map((crit) => {
                  const formItem = criteriaForm.find((c) => c.key === crit.key);
                  const currentScore = Number(formItem?.score || 0);

                  return (
                    <div key={crit.key} className="p-4 rounded-xl border border-slate-100 bg-slate-50/50 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <div className="text-sm font-semibold text-slate-900">{crit.name}</div>
                          <div className="text-xs text-slate-500 mt-0.5">{crit.description}</div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {canEdit ? (
                            <input
                              type="number"
                              min="0"
                              max={crit.maxScore}
                              step="0.5"
                              value={formItem?.score ?? 0}
                              onChange={(e) => {
                                const v = e.target.value === '' ? '' : parseFloat(e.target.value);
                                updateCriterionScore(crit.key, v as number | '');
                              }}
                              className="w-16 h-9 rounded-lg border border-slate-200 bg-white text-center font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                            />
                          ) : (
                            <span className="text-sm font-bold text-slate-800">
                              {formItem?.score ?? '—'}
                            </span>
                          )}
                          <span className="text-xs text-slate-400">/ {crit.maxScore}</span>
                        </div>
                      </div>

                      <ScoreBar
                        score={currentScore}
                        maxScore={crit.maxScore}
                        colorClass={
                          currentScore / crit.maxScore >= 0.8
                            ? 'bg-emerald-500'
                            : currentScore / crit.maxScore >= 0.5
                            ? 'bg-amber-500'
                            : 'bg-rose-500'
                        }
                      />

                      {canEdit ? (
                        <textarea
                          rows={2}
                          maxLength={500}
                          placeholder={`${crit.name} bo'yicha izoh yoki qayd (ixtiyoriy)...`}
                          value={formItem?.comment || ''}
                          onChange={(e) => updateCriterionComment(crit.key, e.target.value)}
                          className="w-full text-xs rounded-lg border border-slate-200 bg-white p-2.5 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                        />
                      ) : (
                        formItem?.comment && (
                          <p className="text-xs text-slate-500 italic bg-white border border-slate-100 rounded-lg p-2.5">
                            "{formItem.comment}"
                          </p>
                        )
                      )}
                    </div>
                  );
                })}
              </div>

              {/* General Comment */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Umumiy xulosa yoki tavsif (ixtiyoriy)
                </label>
                {canEdit ? (
                  <textarea
                    rows={3}
                    maxLength={2000}
                    placeholder="Talabaning umumiy ko'rsatkichlari, xulosa va tavsiyalar..."
                    value={generalComment}
                    onChange={(e) => setGeneralComment(e.target.value)}
                    className="w-full text-xs rounded-lg border border-slate-200 bg-white p-3 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                  />
                ) : (
                  generalComment && (
                    <p className="text-xs text-slate-600 bg-slate-50 border border-slate-100 rounded-xl p-3 italic">
                      "{generalComment}"
                    </p>
                  )
                )}
              </div>

              {/* Total Score Display */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-indigo-50/60 border border-indigo-100">
                <span className="text-sm font-semibold text-indigo-900">Jami ball</span>
                <span className="text-xl font-bold text-indigo-700">
                  {formTotalScore}
                  <span className="text-sm font-normal text-indigo-400"> / {TOTAL_MAX_SCORE}</span>
                </span>
              </div>

              {/* Save / Submit Feedback */}
              {saveStatus && (
                <div
                  className={`flex items-start gap-2 p-3 rounded-xl border text-xs ${
                    saveStatus.type === 'success'
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                      : 'bg-rose-50 border-rose-200 text-rose-800'
                  }`}
                >
                  {saveStatus.type === 'success' ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  )}
                  {saveStatus.message}
                </div>
              )}

              {/* Action Buttons */}
              {canEdit && (
                <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleSave('DRAFT')}
                    isLoading={isSaving}
                    className="gap-1.5"
                  >
                    <Save className="h-4 w-4" />
                    Qoralama saqlash
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => handleSave('SUBMITTED')}
                    isLoading={isSaving}
                    className="gap-1.5"
                  >
                    <Send className="h-4 w-4" />
                    Yakuniy yuborish
                  </Button>
                </div>
              )}

              {!canEdit && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs text-slate-500">
                  <Lock className="h-3.5 w-3.5" />
                  Yakuniy yuborilgan baho tahrirlash uchun qulflangan.
                </div>
              )}
            </Card>
          )}

          {/* ── COMPARATIVE BREAKDOWN TABLE (visible to all roles) ── */}
          <Card className="p-5 border-slate-200/80 space-y-4">
            <SectionHeader
              title="Mezonlar bo'yicha qiyosiy tahlil"
              subtitle="Korxona va ta'lim muassasasi rahbarlarining ballari"
            />

            {/* The other supervisor's evaluation — readonly view for supervisors */}
            {user?.role === 'COMPANY_SUPERVISOR' && universityEvaluation ? (
              <div className="mb-4 p-4 rounded-xl bg-blue-50/40 border border-blue-100">
                <div className="text-xs font-semibold text-blue-800 mb-2">
                  Ta'lim muassasasi rahbari bahosi — {universityEvaluation.evaluatorName}
                  {universityEvaluation.status === 'SUBMITTED' && (
                    <span className="ml-2 text-[10px] font-normal text-blue-600">
                      (Jami: {universityEvaluation.totalScore} ball)
                    </span>
                  )}
                </div>
                {universityEvaluation.criteria.map((c) => {
                  const crit = EVALUATION_CRITERIA.find((cr) => cr.key === c.key);
                  return crit ? (
                    <CriterionReadonlyRow
                      key={c.key}
                      crit={crit}
                      score={c.score}
                      comment={c.comment || null}
                      colorClass="bg-blue-400"
                    />
                  ) : null;
                })}
              </div>
            ) : user?.role === 'UNIVERSITY_SUPERVISOR' && companyEvaluation ? (
              <div className="mb-4 p-4 rounded-xl bg-indigo-50/40 border border-indigo-100">
                <div className="text-xs font-semibold text-indigo-800 mb-2">
                  Korxona rahbari bahosi — {companyEvaluation.evaluatorName}
                  {companyEvaluation.status === 'SUBMITTED' && (
                    <span className="ml-2 text-[10px] font-normal text-indigo-600">
                      (Jami: {companyEvaluation.totalScore} ball)
                    </span>
                  )}
                </div>
                {companyEvaluation.criteria.map((c) => {
                  const crit = EVALUATION_CRITERIA.find((cr) => cr.key === c.key);
                  return crit ? (
                    <CriterionReadonlyRow
                      key={c.key}
                      crit={crit}
                      score={c.score}
                      comment={c.comment || null}
                      colorClass="bg-indigo-400"
                    />
                  ) : null;
                })}
              </div>
            ) : null}

            {/* Full Breakdown Table */}
            <div className="overflow-x-auto rounded-xl border border-slate-100">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 font-semibold text-left">
                    <th className="px-4 py-2.5 w-[38%]">Mezon</th>
                    <th className="px-4 py-2.5 text-center w-[15%]">Maks.</th>
                    <th className="px-4 py-2.5 text-center w-[15%]">Korxona</th>
                    <th className="px-4 py-2.5 text-center w-[15%]">Univ.</th>
                    <th className="px-4 py-2.5 text-center w-[17%]">O'rtacha</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {breakdown.map((row) => (
                    <tr key={row.key} className="hover:bg-slate-50/50">
                      <td className="px-4 py-2.5 font-medium text-slate-800">{row.name}</td>
                      <td className="px-4 py-2.5 text-center text-slate-500">{row.maxScore}</td>
                      <td className="px-4 py-2.5 text-center">
                        {row.companyScore !== null ? (
                          <span className="font-semibold text-indigo-700">{row.companyScore}</span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        {row.universityScore !== null ? (
                          <span className="font-semibold text-blue-700">{row.universityScore}</span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        {row.averageScore !== null ? (
                          <span className="font-bold text-emerald-700">{row.averageScore}</span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-50 font-bold border-t border-slate-200">
                    <td className="px-4 py-3 text-slate-900">JAMI</td>
                    <td className="px-4 py-3 text-center text-slate-700">{TOTAL_MAX_SCORE}</td>
                    <td className="px-4 py-3 text-center text-indigo-700">
                      {companyEvaluation?.totalScore ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-center text-blue-700">
                      {universityEvaluation?.totalScore ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-center text-emerald-700">
                      {finalResult.finalScore !== null ? finalResult.finalScore : '—'}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Info note */}
            {!finalResult.isCompleted && (
              <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50/60 border border-amber-100 text-[11px] text-amber-800">
                <Info className="h-4 w-4 shrink-0 mt-0.5 text-amber-600" />
                Yakuniy natija faqat ikkala rahbarning baholari ham yakuniy yuborilgandan keyin hisoblanadi
                va ko'rsatiladi.
              </div>
            )}
          </Card>

          {/* STUDENT VIEW — read-only supervisor evaluations */}
          {user?.role === 'STUDENT' && (
            <div className="space-y-4">
              {[
                { label: 'Korxona rahbari bahosi', data: companyEvaluation, colorClass: 'bg-indigo-400' },
                { label: "Ta'lim muassasasi rahbari bahosi", data: universityEvaluation, colorClass: 'bg-blue-400' },
              ].map(({ label, data, colorClass }) =>
                data ? (
                  <Card key={label} className="p-5 border-slate-200/80 space-y-3">
                    <div className="flex items-center justify-between">
                      <SectionHeader
                        title={label}
                        subtitle={`${data.evaluatorName} · ${data.submittedAt ? formatDate(data.submittedAt) : 'Qoralama'}`}
                      />
                      <span
                        className={`text-lg font-bold ${
                          data.status === 'SUBMITTED' ? 'text-slate-900' : 'text-slate-400'
                        }`}
                      >
                        {data.status === 'SUBMITTED' ? `${data.totalScore} ball` : 'Qoralama'}
                      </span>
                    </div>

                    {data.status === 'SUBMITTED' ? (
                      <>
                        {data.criteria.map((c) => {
                          const crit = EVALUATION_CRITERIA.find((cr) => cr.key === c.key);
                          return crit ? (
                            <CriterionReadonlyRow
                              key={c.key}
                              crit={crit}
                              score={c.score}
                              comment={c.comment || null}
                              colorClass={colorClass}
                            />
                          ) : null;
                        })}
                        {data.generalComment && (
                          <div className="pt-2">
                            <div className="text-xs font-semibold text-slate-600 mb-1">
                              Umumiy xulosa:
                            </div>
                            <p className="text-xs text-slate-600 bg-slate-50 border border-slate-100 rounded-xl p-3 italic">
                              "{data.generalComment}"
                            </p>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="text-xs text-slate-400 italic py-2">
                        Baho hali yakuniy yuborilmagan.
                      </div>
                    )}
                  </Card>
                ) : (
                  <Card key={label} className="p-5 border-dashed border-slate-200">
                    <div className="text-xs text-slate-400 text-center py-2">
                      {label} hali kiritilmagan.
                    </div>
                  </Card>
                )
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
