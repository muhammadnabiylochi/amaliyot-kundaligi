import { Router, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { EvaluationStatus, UserRole } from '@prisma/client';
import { z } from 'zod';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';
import { notifyEvaluationCompleted } from '../services/notificationService';
import {
  EVALUATION_CRITERIA,
  TOTAL_MAX_SCORE,
  CRITERIA_MAP,
} from '../config/evaluationCriteria';

const router = Router();

const criterionInputSchema = z.object({
  criterionKey: z.string().min(1, "Mezon kaliti ko'rsatilishi shart"),
  score: z.number().min(0, "Ball manfiy bo'lishi mumkin emas"),
  comment: z.string().max(1000, "Izoh 1000 belgidan oshmasligi kerak").optional().nullable(),
});

const submitEvaluationSchema = z.object({
  internshipId: z.string().min(1, "Amaliyot dasturi talab qilinadi"),
  status: z.enum(['DRAFT', 'SUBMITTED']),
  generalComment: z.string().max(2000, "Umumiy xulosa 2000 belgidan oshmasligi kerak").optional().nullable(),
  criteria: z.array(criterionInputSchema).min(1, "Kamida bitta mezon kiritilishi shart"),
});

/**
 * GET /api/evaluation/criteria
 * Returns centralized evaluation criteria configurations and maximal points.
 */
router.get('/criteria', (_req, res: Response): void => {
  res.json({
    success: true,
    data: {
      criteria: EVALUATION_CRITERIA,
      totalMaxScore: TOTAL_MAX_SCORE,
    },
  });
});

/**
 * GET /api/evaluation/list
 * Returns list of internships for evaluation management according to RBAC.
 */
router.get('/list', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = req.user!;
    const whereClause: any = {};

    if (user.role === 'STUDENT') {
      whereClause.studentId = user.id;
    } else if (user.role === 'COMPANY_SUPERVISOR') {
      whereClause.companySupervisorId = user.id;
    } else if (user.role === 'UNIVERSITY_SUPERVISOR') {
      whereClause.universitySupervisorId = user.id;
    }

    const internships = await prisma.internship.findMany({
      where: whereClause,
      include: {
        student: {
          select: {
            id: true,
            fullName: true,
            email: true,
            studentProfile: {
              include: { group: true },
            },
          },
        },
        company: {
          select: { id: true, name: true },
        },
        finalEvaluations: {
          include: {
            evaluator: {
              select: { id: true, fullName: true, role: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const result = internships.map((internship) => {
      const companyEval = internship.finalEvaluations.find(
        (e) => e.evaluatorRole === UserRole.COMPANY_SUPERVISOR
      );
      const universityEval = internship.finalEvaluations.find(
        (e) => e.evaluatorRole === UserRole.UNIVERSITY_SUPERVISOR
      );

      const isBothSubmitted =
        companyEval?.status === EvaluationStatus.SUBMITTED &&
        universityEval?.status === EvaluationStatus.SUBMITTED;

      const finalScore = isBothSubmitted
        ? Math.round(((Number(companyEval.totalScore) + Number(universityEval.totalScore)) / 2) * 100) / 100
        : null;

      return {
        id: internship.id,
        studentId: internship.student.id,
        studentName: internship.student.fullName,
        studentEmail: internship.student.email,
        groupName: internship.student.studentProfile?.group?.name || '—',
        companyName: internship.company.name,
        internshipStatus: internship.status,
        companyEvaluation: companyEval
          ? {
              status: companyEval.status,
              totalScore: Number(companyEval.totalScore),
              submittedAt: companyEval.submittedAt?.toISOString() || null,
              evaluatorName: companyEval.evaluator.fullName,
            }
          : null,
        universityEvaluation: universityEval
          ? {
              status: universityEval.status,
              totalScore: Number(universityEval.totalScore),
              submittedAt: universityEval.submittedAt?.toISOString() || null,
              evaluatorName: universityEval.evaluator.fullName,
            }
          : null,
        finalResult: {
          isCompleted: isBothSubmitted,
          status: isBothSubmitted ? 'COMPLETED' : 'PENDING',
          statusLabel: isBothSubmitted ? 'Yakunlangan' : 'Yakunlanmagan',
          finalScore,
        },
      };
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/evaluation/internship/:internshipId
 * Retrieves detailed evaluation records and calculation for a specific internship.
 */
router.get('/internship/:internshipId', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = req.user!;
    const { internshipId } = req.params;

    const internship = await prisma.internship.findUnique({
      where: { id: internshipId },
      include: {
        student: {
          select: {
            id: true,
            fullName: true,
            email: true,
            studentProfile: {
              include: { group: true },
            },
          },
        },
        company: {
          select: { id: true, name: true, address: true },
        },
        companySupervisor: {
          select: { id: true, fullName: true, email: true },
        },
        universitySupervisor: {
          select: { id: true, fullName: true, email: true },
        },
        finalEvaluations: {
          include: {
            evaluator: {
              select: { id: true, fullName: true, email: true, role: true },
            },
            criteriaScores: true,
          },
        },
      },
    });

    if (!internship) {
      res.status(404).json({ error: { message: "Amaliyot dasturi topilmadi", status: 404 } });
      return;
    }

    // RBAC: Verify access rights
    if (user.role === 'STUDENT' && internship.studentId !== user.id) {
      res.status(403).json({ error: { message: "Siz faqat o'z amaliyotingiz bahosini ko'rishingiz mumkin", status: 403 } });
      return;
    }
    if (user.role === 'COMPANY_SUPERVISOR' && internship.companySupervisorId !== user.id) {
      res.status(403).json({ error: { message: "Ushbu amaliyot sizga biriktirilmagan", status: 403 } });
      return;
    }
    if (user.role === 'UNIVERSITY_SUPERVISOR' && internship.universitySupervisorId !== user.id) {
      res.status(403).json({ error: { message: "Ushbu talaba sizga biriktirilmagan", status: 403 } });
      return;
    }

    const companyEval = internship.finalEvaluations.find(
      (e) => e.evaluatorRole === UserRole.COMPANY_SUPERVISOR
    );
    const universityEval = internship.finalEvaluations.find(
      (e) => e.evaluatorRole === UserRole.UNIVERSITY_SUPERVISOR
    );

    const isBothSubmitted =
      companyEval?.status === EvaluationStatus.SUBMITTED &&
      universityEval?.status === EvaluationStatus.SUBMITTED;

    const finalScore = isBothSubmitted
      ? Math.round(((Number(companyEval.totalScore) + Number(universityEval.totalScore)) / 2) * 100) / 100
      : null;

    // Helper to format criteria list with scores & comments
    const formatEval = (evaluation: typeof companyEval) => {
      if (!evaluation) return null;
      const scoreMap = new Map(evaluation.criteriaScores.map((c) => [c.criterionKey, c]));

      return {
        id: evaluation.id,
        evaluatorId: evaluation.evaluator.id,
        evaluatorName: evaluation.evaluator.fullName,
        evaluatorRole: evaluation.evaluatorRole,
        status: evaluation.status,
        totalScore: Number(evaluation.totalScore),
        generalComment: evaluation.generalComment || '',
        submittedAt: evaluation.submittedAt?.toISOString() || null,
        createdAt: evaluation.createdAt.toISOString(),
        criteria: EVALUATION_CRITERIA.map((crit) => {
          const rec = scoreMap.get(crit.key);
          return {
            key: crit.key,
            name: crit.name,
            description: crit.description,
            maxScore: crit.maxScore,
            score: rec ? Number(rec.score) : 0,
            comment: rec?.comment || '',
          };
        }),
      };
    };

    // Comparative breakdown table across both supervisors
    const breakdown = EVALUATION_CRITERIA.map((crit) => {
      const cScoreObj = companyEval?.criteriaScores.find((c) => c.criterionKey === crit.key);
      const uScoreObj = universityEval?.criteriaScores.find((c) => c.criterionKey === crit.key);

      const cScore = cScoreObj ? Number(cScoreObj.score) : null;
      const uScore = uScoreObj ? Number(uScoreObj.score) : null;

      const avgScore =
        isBothSubmitted && cScore !== null && uScore !== null
          ? Math.round(((cScore + uScore) / 2) * 100) / 100
          : null;

      return {
        key: crit.key,
        name: crit.name,
        description: crit.description,
        maxScore: crit.maxScore,
        companyScore: cScore,
        companyComment: cScoreObj?.comment || null,
        universityScore: uScore,
        universityComment: uScoreObj?.comment || null,
        averageScore: avgScore,
      };
    });

    res.json({
      success: true,
      data: {
        internship: {
          id: internship.id,
          studentId: internship.student.id,
          studentName: internship.student.fullName,
          studentEmail: internship.student.email,
          studentGroup: internship.student.studentProfile?.group?.name || '—',
          companyId: internship.company.id,
          companyName: internship.company.name,
          companySupervisorName: internship.companySupervisor?.fullName || '—',
          universitySupervisorName: internship.universitySupervisor?.fullName || '—',
          startDate: internship.startDate.toISOString().split('T')[0],
          endDate: internship.endDate.toISOString().split('T')[0],
          status: internship.status,
        },
        companyEvaluation: formatEval(companyEval),
        universityEvaluation: formatEval(universityEval),
        breakdown,
        finalResult: {
          isCompleted: isBothSubmitted,
          status: isBothSubmitted ? 'COMPLETED' : 'PENDING',
          statusLabel: isBothSubmitted ? 'Yakunlangan' : 'Yakunlanmagan',
          companyTotalScore: companyEval && companyEval.status === 'SUBMITTED' ? Number(companyEval.totalScore) : null,
          universityTotalScore: universityEval && universityEval.status === 'SUBMITTED' ? Number(universityEval.totalScore) : null,
          finalScore,
          maxScore: TOTAL_MAX_SCORE,
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/evaluation
 * Saves (DRAFT) or finalizes (SUBMITTED) a supervisor's evaluation.
 */
router.post('/', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = req.user!;

    // 1. Role permission: Students cannot evaluate; ADMIN cannot create/modify evaluations
    if (user.role === 'STUDENT') {
      res.status(403).json({
        error: { message: "Talabalar baholash huquqiga ega emas.", status: 403 },
      });
      return;
    }

    if (user.role === 'ADMIN') {
      res.status(403).json({
        error: {
          message: "Administrator baholash yaratish yoki o'zgartirishga ruxsat yo'q. Faqat ko'rish imkoniyati mavjud.",
          status: 403,
        },
      });
      return;
    }

    const validated = submitEvaluationSchema.parse(req.body);

    // 2. Fetch internship and verify mentor assignment
    const internship = await prisma.internship.findUnique({
      where: { id: validated.internshipId },
    });

    if (!internship) {
      res.status(404).json({ error: { message: "Amaliyot dasturi topilmadi", status: 404 } });
      return;
    }

    // 2a. Internship must be ACTIVE or COMPLETED (not yet both-evaluations-submitted)
    if (internship.status !== 'ACTIVE' && internship.status !== 'COMPLETED') {
      res.status(400).json({
        error: {
          message: "Faqat faol yoki yakunlangan amaliyot uchun baholash kiritish mumkin.",
          status: 400,
        },
      });
      return;
    }

    // 2b. Must have at least 1 APPROVED diary entry
    const approvedDiaryCount = await prisma.diaryEntry.count({
      where: { internshipId: validated.internshipId, status: 'APPROVED' },
    });

    if (approvedDiaryCount === 0) {
      res.status(400).json({
        error: {
          message: "Baholash kiritish uchun kamida bitta tasdiqlangan kundalik yozuvi bo'lishi shart.",
          status: 400,
        },
      });
      return;
    }

    // Determine evaluation role
    let evaluatorRole: UserRole;
    if (user.role === 'COMPANY_SUPERVISOR') {
      if (internship.companySupervisorId !== user.id) {
        res.status(403).json({
          error: { message: "Ushbu amaliyot sizning korxonangizga yoki sizga biriktirilmagan", status: 403 },
        });
        return;
      }
      evaluatorRole = UserRole.COMPANY_SUPERVISOR;
    } else if (user.role === 'UNIVERSITY_SUPERVISOR') {
      if (internship.universitySupervisorId !== user.id) {
        res.status(403).json({
          error: { message: "Ushbu talaba sizga biriktirilmagan", status: 403 },
        });
        return;
      }
      evaluatorRole = UserRole.UNIVERSITY_SUPERVISOR;
    } else {
      res.status(403).json({ error: { message: "Ruxsat etilmagan rol", status: 403 } });
      return;
    }

    // 3. Check if an evaluation already exists and is already SUBMITTED — immutable for ALL roles
    const existingEvaluation = await prisma.finalEvaluation.findUnique({
      where: {
        internshipId_evaluatorRole: {
          internshipId: validated.internshipId,
          evaluatorRole,
        },
      },
    });

    if (existingEvaluation && existingEvaluation.status === EvaluationStatus.SUBMITTED) {
      res.status(400).json({
        error: {
          message: "Yakuniy yuborilgan baholashni qayta o'zgartirish taqiqlanadi.",
          status: 400,
        },
      });
      return;
    }

    // 4. Validate criteria scores against criteria configuration
    const criteriaScoresToSave: { criterionKey: string; score: number; comment?: string }[] = [];
    let calculatedTotalScore = 0;

    for (const item of validated.criteria) {
      const config = CRITERIA_MAP.get(item.criterionKey);
      if (!config) {
        res.status(400).json({
          error: { message: `Noma'lum mezon: ${item.criterionKey}`, status: 400 },
        });
        return;
      }

      if (item.score < 0 || item.score > config.maxScore) {
        res.status(400).json({
          error: {
            message: `"${config.name}" mezoni bo'yicha ball 0 dan ${config.maxScore} gacha bo'lishi shart. Kiritildi: ${item.score}`,
            status: 400,
          },
        });
        return;
      }

      calculatedTotalScore += item.score;
      criteriaScoresToSave.push({
        criterionKey: item.criterionKey,
        score: item.score,
        comment: item.comment?.trim() || undefined,
      });
    }

    // If final SUBMITTED status, ensure all criteria are evaluated
    if (validated.status === 'SUBMITTED') {
      const evaluatedKeys = new Set(criteriaScoresToSave.map((c) => c.criterionKey));
      for (const reqCrit of EVALUATION_CRITERIA) {
        if (!evaluatedKeys.has(reqCrit.key)) {
          res.status(400).json({
            error: {
              message: `Yakuniy yuborish uchun "${reqCrit.name}" mezoni baholanishi shart.`,
              status: 400,
            },
          });
          return;
        }
      }
    }

    calculatedTotalScore = Math.round(calculatedTotalScore * 100) / 100;

    let isCompletedNow = false;
    let finalCompositeScore = 0;

    // 5. Transaction: Atomic upsert of FinalEvaluation and CriteriaScores
    const result = await prisma.$transaction(async (tx) => {
      const evaluation = await tx.finalEvaluation.upsert({
        where: {
          internshipId_evaluatorRole: {
            internshipId: validated.internshipId,
            evaluatorRole,
          },
        },
        update: {
          evaluatorId: user.id,
          status: validated.status as EvaluationStatus,
          totalScore: calculatedTotalScore,
          generalComment: validated.generalComment?.trim() || null,
          submittedAt: validated.status === 'SUBMITTED' ? new Date() : null,
        },
        create: {
          internshipId: validated.internshipId,
          evaluatorId: user.id,
          evaluatorRole,
          status: validated.status as EvaluationStatus,
          totalScore: calculatedTotalScore,
          generalComment: validated.generalComment?.trim() || null,
          submittedAt: validated.status === 'SUBMITTED' ? new Date() : null,
        },
      });

      // Clear existing criteria scores for this evaluation and recreate
      await tx.evaluationCriteriaScore.deleteMany({
        where: { evaluationId: evaluation.id },
      });

      for (const sc of criteriaScoresToSave) {
        await tx.evaluationCriteriaScore.create({
          data: {
            evaluationId: evaluation.id,
            criterionKey: sc.criterionKey,
            score: sc.score,
            comment: sc.comment || null,
          },
        });
      }

      // Check if both evaluations are now SUBMITTED
      const otherRole =
        evaluatorRole === UserRole.COMPANY_SUPERVISOR
          ? UserRole.UNIVERSITY_SUPERVISOR
          : UserRole.COMPANY_SUPERVISOR;

      const otherEval = await tx.finalEvaluation.findUnique({
        where: {
          internshipId_evaluatorRole: {
            internshipId: validated.internshipId,
            evaluatorRole: otherRole,
          },
        },
      });

      if (
        validated.status === 'SUBMITTED' &&
        otherEval &&
        otherEval.status === EvaluationStatus.SUBMITTED
      ) {
        // Mark internship as COMPLETED
        await tx.internship.update({
          where: { id: validated.internshipId },
          data: { status: 'COMPLETED' },
        });
        isCompletedNow = true;
        finalCompositeScore = Math.round(((calculatedTotalScore + Number(otherEval.totalScore)) / 2) * 100) / 100;
      }

      return evaluation;
    });

    if (isCompletedNow) {
      void notifyEvaluationCompleted(validated.internshipId, finalCompositeScore);
    }

    res.status(200).json({
      success: true,
      data: {
        id: result.id,
        internshipId: result.internshipId,
        evaluatorRole: result.evaluatorRole,
        status: result.status,
        totalScore: Number(result.totalScore),
        submittedAt: result.submittedAt?.toISOString() || null,
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
