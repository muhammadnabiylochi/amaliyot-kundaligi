-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'STUDENT', 'COMPANY_SUPERVISOR', 'UNIVERSITY_SUPERVISOR');

-- CreateEnum
CREATE TYPE "InternshipStatus" AS ENUM ('PLANNED', 'ACTIVE', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DiaryEntryStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'RETURNED');

-- CreateEnum
CREATE TYPE "ReviewDecision" AS ENUM ('APPROVED', 'RETURNED', 'REJECTED');

-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENT', 'ABSENT', 'EXCUSED', 'LATE');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'STUDENT',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "studentNumber" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "phone" TEXT,

    CONSTRAINT "StudentProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentGroup" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "faculty" TEXT NOT NULL,
    "studyProgram" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "contactPhone" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Internship" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "companySupervisorId" TEXT,
    "universitySupervisorId" TEXT,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "status" "InternshipStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Internship_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiaryEntry" (
    "id" TEXT NOT NULL,
    "internshipId" TEXT NOT NULL,
    "entryDate" DATE NOT NULL,
    "taskTitle" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "result" TEXT,
    "hours" DECIMAL(4,1) NOT NULL DEFAULT 8.0,
    "status" "DiaryEntryStatus" NOT NULL DEFAULT 'DRAFT',
    "submittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiaryEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiaryAttachment" (
    "id" TEXT NOT NULL,
    "diaryEntryId" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "storedPath" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DiaryAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiaryReview" (
    "id" TEXT NOT NULL,
    "diaryEntryId" TEXT NOT NULL,
    "reviewerId" TEXT NOT NULL,
    "decision" "ReviewDecision" NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DiaryReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attendance" (
    "id" TEXT NOT NULL,
    "internshipId" TEXT NOT NULL,
    "attendanceDate" DATE NOT NULL,
    "status" "AttendanceStatus" NOT NULL DEFAULT 'PRESENT',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Attendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InternshipGrade" (
    "id" TEXT NOT NULL,
    "internshipId" TEXT NOT NULL,
    "reviewerId" TEXT NOT NULL,
    "score" DECIMAL(5,2) NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InternshipGrade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TelegramAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "telegramUserId" BIGINT NOT NULL,
    "username" TEXT,
    "linkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TelegramAccount_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX "User_isActive_idx" ON "User"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "StudentProfile_userId_key" ON "StudentProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentProfile_studentNumber_key" ON "StudentProfile"("studentNumber");

-- CreateIndex
CREATE INDEX "StudentProfile_groupId_idx" ON "StudentProfile"("groupId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentGroup_name_key" ON "StudentGroup"("name");

-- CreateIndex
CREATE INDEX "StudentGroup_faculty_idx" ON "StudentGroup"("faculty");

-- CreateIndex
CREATE UNIQUE INDEX "Company_name_key" ON "Company"("name");

-- CreateIndex
CREATE INDEX "Company_name_idx" ON "Company"("name");

-- CreateIndex
CREATE INDEX "Internship_studentId_idx" ON "Internship"("studentId");

-- CreateIndex
CREATE INDEX "Internship_companyId_idx" ON "Internship"("companyId");

-- CreateIndex
CREATE INDEX "Internship_status_idx" ON "Internship"("status");

-- CreateIndex
CREATE INDEX "Internship_startDate_endDate_idx" ON "Internship"("startDate", "endDate");

-- CreateIndex
CREATE INDEX "DiaryEntry_internshipId_idx" ON "DiaryEntry"("internshipId");

-- CreateIndex
CREATE INDEX "DiaryEntry_status_idx" ON "DiaryEntry"("status");

-- CreateIndex
CREATE INDEX "DiaryEntry_entryDate_idx" ON "DiaryEntry"("entryDate");

-- CreateIndex
CREATE UNIQUE INDEX "DiaryEntry_internshipId_entryDate_key" ON "DiaryEntry"("internshipId", "entryDate");

-- CreateIndex
CREATE INDEX "DiaryAttachment_diaryEntryId_idx" ON "DiaryAttachment"("diaryEntryId");

-- CreateIndex
CREATE INDEX "DiaryReview_diaryEntryId_idx" ON "DiaryReview"("diaryEntryId");

-- CreateIndex
CREATE INDEX "DiaryReview_reviewerId_idx" ON "DiaryReview"("reviewerId");

-- CreateIndex
CREATE INDEX "Attendance_internshipId_idx" ON "Attendance"("internshipId");

-- CreateIndex
CREATE INDEX "Attendance_attendanceDate_idx" ON "Attendance"("attendanceDate");

-- CreateIndex
CREATE UNIQUE INDEX "Attendance_internshipId_attendanceDate_key" ON "Attendance"("internshipId", "attendanceDate");

-- CreateIndex
CREATE INDEX "InternshipGrade_internshipId_idx" ON "InternshipGrade"("internshipId");

-- CreateIndex
CREATE INDEX "InternshipGrade_reviewerId_idx" ON "InternshipGrade"("reviewerId");

-- CreateIndex
CREATE UNIQUE INDEX "TelegramAccount_userId_key" ON "TelegramAccount"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "TelegramAccount_telegramUserId_key" ON "TelegramAccount"("telegramUserId");

-- CreateIndex
CREATE INDEX "TelegramAccount_telegramUserId_idx" ON "TelegramAccount"("telegramUserId");

-- AddForeignKey
ALTER TABLE "StudentProfile" ADD CONSTRAINT "StudentProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentProfile" ADD CONSTRAINT "StudentProfile_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "StudentGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Internship" ADD CONSTRAINT "Internship_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Internship" ADD CONSTRAINT "Internship_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Internship" ADD CONSTRAINT "Internship_companySupervisorId_fkey" FOREIGN KEY ("companySupervisorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Internship" ADD CONSTRAINT "Internship_universitySupervisorId_fkey" FOREIGN KEY ("universitySupervisorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiaryEntry" ADD CONSTRAINT "DiaryEntry_internshipId_fkey" FOREIGN KEY ("internshipId") REFERENCES "Internship"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiaryAttachment" ADD CONSTRAINT "DiaryAttachment_diaryEntryId_fkey" FOREIGN KEY ("diaryEntryId") REFERENCES "DiaryEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiaryReview" ADD CONSTRAINT "DiaryReview_diaryEntryId_fkey" FOREIGN KEY ("diaryEntryId") REFERENCES "DiaryEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiaryReview" ADD CONSTRAINT "DiaryReview_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_internshipId_fkey" FOREIGN KEY ("internshipId") REFERENCES "Internship"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InternshipGrade" ADD CONSTRAINT "InternshipGrade_internshipId_fkey" FOREIGN KEY ("internshipId") REFERENCES "Internship"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InternshipGrade" ADD CONSTRAINT "InternshipGrade_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TelegramAccount" ADD CONSTRAINT "TelegramAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
