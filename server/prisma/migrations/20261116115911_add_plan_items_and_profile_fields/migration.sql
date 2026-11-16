-- AlterTable
ALTER TABLE "DiaryEntry" ADD COLUMN     "planItemId" TEXT;

-- AlterTable
ALTER TABLE "Internship" ADD COLUMN     "position" TEXT,
ADD COLUMN     "programDescription" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "position" TEXT;

-- CreateTable
CREATE TABLE "InternshipPlanItem" (
    "id" TEXT NOT NULL,
    "internshipId" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "plannedHours" DECIMAL(5,1) NOT NULL DEFAULT 8.0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InternshipPlanItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InternshipPlanItem_internshipId_idx" ON "InternshipPlanItem"("internshipId");

-- CreateIndex
CREATE INDEX "DiaryEntry_planItemId_idx" ON "DiaryEntry"("planItemId");

-- AddForeignKey
ALTER TABLE "DiaryEntry" ADD CONSTRAINT "DiaryEntry_planItemId_fkey" FOREIGN KEY ("planItemId") REFERENCES "InternshipPlanItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InternshipPlanItem" ADD CONSTRAINT "InternshipPlanItem_internshipId_fkey" FOREIGN KEY ("internshipId") REFERENCES "Internship"("id") ON DELETE CASCADE ON UPDATE CASCADE;
