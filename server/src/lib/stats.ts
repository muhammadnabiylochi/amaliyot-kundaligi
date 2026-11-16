import { Prisma } from '@prisma/client';
import { prisma } from './prisma';
import { ymd } from './http';

/** Final score = average of company & institution totals, only when both are SUBMITTED. */
export function computeFinalScore(evals: { evaluatorRole: string; status: string; totalScore: Prisma.Decimal | number }[]): number | null {
  const c = evals.find((e) => e.evaluatorRole === 'COMPANY_SUPERVISOR' && e.status === 'SUBMITTED');
  const u = evals.find((e) => e.evaluatorRole === 'UNIVERSITY_SUPERVISOR' && e.status === 'SUBMITTED');
  if (!c || !u) return null;
  return Math.round(((Number(c.totalScore) + Number(u.totalScore)) / 2) * 100) / 100;
}

/** Uzbek grade from a 100-point score (O'zbekiston baholash shkalasi). */
export function gradeLabel(score: number | null): string {
  if (score === null) return '—';
  if (score >= 86) return "A'lo (5)";
  if (score >= 71) return 'Yaxshi (4)';
  if (score >= 55) return 'Qoniqarli (3)';
  return 'Qoniqarsiz (2)';
}

function mondayOf(d: Date): Date {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = x.getUTCDay() || 7;
  x.setUTCDate(x.getUTCDate() - day + 1);
  return x;
}

/**
 * Aggregated analytics for charts, scoped by an internship filter.
 * `hideDrafts` hides DRAFT/RETURNED entries (supervisor visibility rule).
 */
export async function buildAnalytics(internshipWhere: Prisma.InternshipWhereInput, hideDrafts: boolean, weeks = 8) {
  const internships = await prisma.internship.findMany({
    where: internshipWhere,
    include: {
      company: { select: { id: true, name: true } },
      student: { select: { studentProfile: { select: { group: { select: { id: true, name: true } } } } } },
      diaryEntries: { select: { status: true, entryDate: true, hours: true } },
      attendances: { select: { status: true } },
      finalEvaluations: { select: { evaluatorRole: true, status: true, totalScore: true } },
    },
  });

  const diaryStatus: Record<string, number> = { DRAFT: 0, SUBMITTED: 0, RETURNED: 0, APPROVED: 0 };
  const attendance: Record<string, number> = { PRESENT: 0, LATE: 0, EXCUSED: 0, ABSENT: 0 };

  // Weekly buckets (last N weeks ending this week)
  const thisMonday = mondayOf(new Date());
  const buckets = Array.from({ length: weeks }, (_, i) => {
    const start = new Date(thisMonday);
    start.setUTCDate(start.getUTCDate() - (weeks - 1 - i) * 7);
    return { start, key: ymd(start), submitted: 0, approved: 0, returned: 0 };
  });

  type Agg = { id: string; name: string; students: number; approved: number; totalEntries: number; present: number; attTotal: number; scores: number[]; hours: number };
  const byGroup = new Map<string, Agg>();
  const byCompany = new Map<string, Agg>();
  const newAgg = (id: string, name: string): Agg => ({ id, name, students: 0, approved: 0, totalEntries: 0, present: 0, attTotal: 0, scores: [], hours: 0 });

  let approvedHours = 0;
  let completedEvaluations = 0;
  const allScores: number[] = [];

  for (const it of internships) {
    const g = it.student.studentProfile?.group;
    const gAgg = g ? byGroup.get(g.id) ?? newAgg(g.id, g.name) : null;
    const cAgg = byCompany.get(it.company.id) ?? newAgg(it.company.id, it.company.name);
    for (const agg of [gAgg, cAgg]) if (agg) agg.students++;

    for (const e of it.diaryEntries) {
      if (hideDrafts && (e.status === 'DRAFT' || e.status === 'RETURNED')) continue;
      diaryStatus[e.status]++;
      for (const agg of [gAgg, cAgg]) if (agg) agg.totalEntries++;
      if (e.status === 'APPROVED') {
        approvedHours += Number(e.hours);
        for (const agg of [gAgg, cAgg]) if (agg) {
          agg.approved++;
          agg.hours += Number(e.hours);
        }
      }
      const wk = ymd(mondayOf(e.entryDate));
      const b = buckets.find((x) => x.key === wk);
      if (b) {
        if (e.status === 'APPROVED') b.approved++;
        else if (e.status === 'SUBMITTED') b.submitted++;
        else if (e.status === 'RETURNED') b.returned++;
      }
    }
    for (const a of it.attendances) {
      attendance[a.status]++;
      for (const agg of [gAgg, cAgg]) if (agg) {
        agg.attTotal++;
        if (a.status === 'PRESENT' || a.status === 'LATE') agg.present++;
      }
    }
    const score = computeFinalScore(it.finalEvaluations);
    if (score !== null) {
      completedEvaluations++;
      allScores.push(score);
      for (const agg of [gAgg, cAgg]) if (agg) agg.scores.push(score);
    }
    if (gAgg) byGroup.set(gAgg.id, gAgg);
    byCompany.set(cAgg.id, cAgg);
  }

  const avg = (xs: number[]) => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : null);
  const fmtAgg = (a: Agg) => ({
    id: a.id,
    name: a.name,
    students: a.students,
    approvedEntries: a.approved,
    totalEntries: a.totalEntries,
    approvedHours: a.hours,
    attendanceRate: a.attTotal ? Math.round((a.present / a.attTotal) * 100) : null,
    averageScore: avg(a.scores),
  });

  const attTotal = Object.values(attendance).reduce((a, b) => a + b, 0);
  const reviewed = diaryStatus.APPROVED + diaryStatus.RETURNED;

  return {
    totals: {
      internships: internships.length,
      activeInternships: internships.filter((i) => i.status === 'ACTIVE').length,
      companies: byCompany.size,
      approvedHours,
      approvalRate: diaryStatus.APPROVED + diaryStatus.SUBMITTED + diaryStatus.RETURNED > 0
        ? Math.round((diaryStatus.APPROVED / Math.max(1, reviewed + diaryStatus.SUBMITTED)) * 100)
        : null,
      attendanceRate: attTotal ? Math.round(((attendance.PRESENT + attendance.LATE) / attTotal) * 100) : null,
      completedEvaluations,
      averageScore: avg(allScores),
    },
    diaryStatus,
    attendance,
    weekly: buckets.map((b) => ({ week: b.key, submitted: b.submitted, approved: b.approved, returned: b.returned })),
    groups: [...byGroup.values()].map(fmtAgg).sort((a, b) => a.name.localeCompare(b.name)),
    companies: [...byCompany.values()].map(fmtAgg).sort((a, b) => b.students - a.students),
  };
}
