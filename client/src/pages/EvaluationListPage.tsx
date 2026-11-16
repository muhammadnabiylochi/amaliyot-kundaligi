import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Award,
  Search,
  ChevronRight,
  CheckCircle2,
  Clock,
  User,
  Building2,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { EvaluationListItem, fetchEvaluationList } from '@/lib/dataService';
import { Card, Input } from '@/components/ui';
import { LoadingState, EmptyState, ErrorState } from '@/components/ui/FeedbackStates';

function FinalStatusBadge({ isCompleted }: { isCompleted: boolean }) {
  if (isCompleted) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
        <CheckCircle2 className="h-3 w-3" />
        Yakunlangan
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
      <Clock className="h-3 w-3" />
      Yakunlanmagan
    </span>
  );
}

function EvalStatusBadge({ status }: { status: 'DRAFT' | 'SUBMITTED' | null }) {
  if (!status) {
    return (
      <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-medium bg-slate-50 text-slate-500 border border-slate-200">
        Kiritilmagan
      </span>
    );
  }
  if (status === 'SUBMITTED') {
    return (
      <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
        Yakunlandi
      </span>
    );
  }
  return (
    <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
      Qoralama
    </span>
  );
}

export default function EvaluationListPage(): JSX.Element {
  const { user } = useAuth();
  const [items, setItems] = useState<EvaluationListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'completed' | 'pending'>('all');

  const isEvaluator =
    user?.role === 'COMPANY_SUPERVISOR' ||
    user?.role === 'UNIVERSITY_SUPERVISOR' ||
    user?.role === 'ADMIN';

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchEvaluationList();
      setItems(data);
    } catch {
      setError("Baholash ma'lumotlarini yuklashda xatolik yuz berdi.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filtered = useMemo(() => {
    return items.filter((item) => {
      const matchSearch =
        item.studentName.toLowerCase().includes(search.toLowerCase()) ||
        item.companyName.toLowerCase().includes(search.toLowerCase()) ||
        item.groupName.toLowerCase().includes(search.toLowerCase());

      const matchFilter =
        filter === 'all' ||
        (filter === 'completed' && item.finalResult.isCompleted) ||
        (filter === 'pending' && !item.finalResult.isCompleted);

      return matchSearch && matchFilter;
    });
  }, [items, search, filter]);

  const completedCount = items.filter((i) => i.finalResult.isCompleted).length;
  const pendingCount = items.length - completedCount;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Yakuniy baholash
            </h1>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Amaliyot natijalari bo'yicha yakuniy baholash va natijalar
          </p>
        </div>
      </div>

      {/* Summary KPI Strip */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="p-4 border-slate-200/80">
          <div className="text-xs font-medium text-slate-500 mb-1">Jami amaliyotlar</div>
          <div className="text-2xl font-bold text-slate-900">{items.length}</div>
        </Card>
        <Card className="p-4 border-emerald-100 bg-emerald-50/40">
          <div className="text-xs font-medium text-emerald-700 mb-1">Yakunlangan</div>
          <div className="text-2xl font-bold text-emerald-900">{completedCount}</div>
        </Card>
        <Card className="p-4 border-amber-100 bg-amber-50/40">
          <div className="text-xs font-medium text-amber-700 mb-1">Kutilmoqda</div>
          <div className="text-2xl font-bold text-amber-900">{pendingCount}</div>
        </Card>
      </div>

      {/* Role notice for student */}
      {user?.role === 'STUDENT' && (
        <div className="p-3.5 rounded-xl bg-blue-50/70 border border-blue-200 text-blue-900 text-xs flex items-center gap-3">
          <Award className="h-4 w-4 text-blue-600 shrink-0" />
          <span>
            Bu sahifada siz o'zingizning amaliyot baholaringizni ko'rishingiz mumkin.
            Baholar faqat rahbarlar tomonidan kiritiladi.
          </span>
        </div>
      )}

      {/* Filters */}
      <Card className="p-4 border-slate-200/80">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <Input
              type="text"
              placeholder="Talaba, korxona yoki guruh bo'yicha qidirish..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              icon={<Search className="h-4 w-4" />}
            />
          </div>
          <div className="flex gap-2">
            {(['all', 'completed', 'pending'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`h-9 px-3 text-xs font-medium rounded-lg border transition-colors ${
                  filter === f
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                {f === 'all' ? 'Barchasi' : f === 'completed' ? 'Yakunlangan' : 'Kutilmoqda'}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* Content */}
      {isLoading ? (
        <LoadingState message="Baholash ma'lumotlari yuklanmoqda..." />
      ) : error ? (
        <ErrorState message={error} onRetry={loadData} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Award className="h-6 w-6" />}
          title="Baholashlar topilmadi"
          description={
            search
              ? `"${search}" bo'yicha hech qanday amaliyot topilmadi.`
              : "Hozircha baholanadigan amaliyot yo'q."
          }
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((item) => (
            <Link to={`/evaluation/${item.id}`} key={item.id}>
              <Card className="p-5 border-slate-200/80 hover:border-indigo-300 hover:shadow-md transition-all cursor-pointer group">
                <div className="flex items-start justify-between gap-4">
                  {/* Left: Student & Company info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <FinalStatusBadge isCompleted={item.finalResult.isCompleted} />
                      {item.finalResult.isCompleted && item.finalResult.finalScore !== null && (
                        <span className="text-sm font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2.5 py-0.5 rounded-full">
                          {item.finalResult.finalScore} / 100 ball
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 text-base font-semibold text-slate-900 mb-1">
                      <User className="h-4 w-4 text-slate-400 shrink-0" />
                      {item.studentName}
                      <span className="text-xs font-normal text-slate-400 ml-1">
                        ({item.groupName})
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 text-sm text-slate-500 mb-3">
                      <Building2 className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                      {item.companyName}
                    </div>

                    {/* Supervisor evaluation statuses */}
                    <div className="flex flex-wrap gap-3">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] font-medium text-slate-500">
                          Korxona rahbari:
                        </span>
                        <EvalStatusBadge status={item.companyEvaluation?.status ?? null} />
                        {item.companyEvaluation?.status === 'SUBMITTED' && (
                          <span className="text-[11px] font-semibold text-slate-700">
                            {item.companyEvaluation.totalScore} ball
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] font-medium text-slate-500">
                          Univ. rahbari:
                        </span>
                        <EvalStatusBadge status={item.universityEvaluation?.status ?? null} />
                        {item.universityEvaluation?.status === 'SUBMITTED' && (
                          <span className="text-[11px] font-semibold text-slate-700">
                            {item.universityEvaluation.totalScore} ball
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: Action */}
                  <div className="flex items-center gap-2 shrink-0">
                    {isEvaluator && !item.finalResult.isCompleted && (
                      <span className="text-xs font-medium text-indigo-600 hidden sm:block">
                        Baholash
                      </span>
                    )}
                    <ChevronRight className="h-5 w-5 text-slate-300 group-hover:text-indigo-500 transition-colors" />
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
