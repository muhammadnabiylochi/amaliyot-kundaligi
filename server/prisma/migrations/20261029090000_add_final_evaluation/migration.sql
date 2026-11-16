-- CreateEnum
CREATE TYPE "EvaluationStatus" AS ENUM ('DRAFT', 'SUBMITTED');

-- CreateTable
CREATE TABLE "FinalEvaluation" (
    "id" TEXT NOT NULL,
    "internshipId" TEXT NOT NULL,
    "evaluatorId" TEXT NOT NULL,
    "evaluatorRole" "UserRole" NOT NULL,
    "status" "EvaluationStatus" NOT NULL DEFAULT 'DRAFT',
    "totalScore" DECIMAL(5,2) NOT NULL,
    "generalComment" TEXT,
    "submittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinalEvaluation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvaluationCriteriaScore" (
    "id" TEXT NOT NULL,
    "evaluationId" TEXT NOT NULL,
    "criterionKey" TEXT NOT NULL,
    "score" DECIMAL(5,2) NOT NULL,
    "comment" TEXT,

    CONSTRAINT "EvaluationCriteriaScore_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FinalEvaluation_internshipId_evaluatorRole_key" ON "FinalEvaluation"("internshipId", "evaluatorRole");

-- CreateIndex
CREATE INDEX "FinalEvaluation_internshipId_idx" ON "FinalEvaluation"("internshipId");

-- CreateIndex
CREATE INDEX "FinalEvaluation_evaluatorId_idx" ON "FinalEvaluation"("evaluatorId");

-- CreateIndex
CREATE INDEX "FinalEvaluation_status_idx" ON "FinalEvaluation"("status");

-- CreateIndex
CREATE UNIQUE INDEX "EvaluationCriteriaScore_evaluationId_criterionKey_key" ON "EvaluationCriteriaScore"("evaluationId", "criterionKey");

-- CreateIndex
CREATE INDEX "EvaluationCriteriaScore_evaluationId_idx" ON "EvaluationCriteriaScore"("evaluationId");

-- AddForeignKey
ALTER TABLE "FinalEvaluation" ADD CONSTRAINT "FinalEvaluation_internshipId_fkey" FOREIGN KEY ("internshipId") REFERENCES "Internship"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinalEvaluation" ADD CONSTRAINT "FinalEvaluation_evaluatorId_fkey" FOREIGN KEY ("evaluatorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvaluationCriteriaScore" ADD CONSTRAINT "EvaluationCriteriaScore_evaluationId_fkey" FOREIGN KEY ("evaluationId") REFERENCES "FinalEvaluation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
