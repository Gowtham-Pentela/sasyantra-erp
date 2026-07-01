-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'OPS', 'ACCOUNTS');

-- CreateEnum
CREATE TYPE "EmployeeStatus" AS ENUM ('ACTIVE', 'LEFT', 'TEMPORARY', 'SUSPENDED', 'BLACKLISTED');

-- CreateEnum
CREATE TYPE "SalaryType" AS ENUM ('DAILY', 'MONTHLY');

-- CreateEnum
CREATE TYPE "AttendanceCode" AS ENUM ('P', 'A', 'OT', 'HD', 'LV', 'WO', 'HL', 'NS', 'DS', 'TR');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'ARCHIVE', 'RESTORE');

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED');

-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'ADMIN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Employee" (
    "id" SERIAL NOT NULL,
    "empCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "fatherName" TEXT,
    "mobile" TEXT,
    "altMobile" TEXT,
    "address" TEXT,
    "dob" TIMESTAMP(3),
    "gender" TEXT,
    "bloodGroup" TEXT,
    "emergencyContact" TEXT,
    "aadhar" TEXT,
    "pan" TEXT,
    "bankAccount" TEXT,
    "ifsc" TEXT,
    "upi" TEXT,
    "joiningDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "skillCategory" TEXT,
    "designation" TEXT,
    "salaryType" "SalaryType" NOT NULL DEFAULT 'DAILY',
    "dailyWage" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "monthlySalary" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "pf" BOOLEAN NOT NULL DEFAULT false,
    "esi" BOOLEAN NOT NULL DEFAULT false,
    "uan" TEXT,
    "photoUrl" TEXT,
    "status" "EmployeeStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "Employee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "clientName" TEXT NOT NULL,
    "clientGst" TEXT,
    "siteLocation" TEXT,
    "mapsUrl" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endDate" TIMESTAMP(3),
    "billingCycle" TEXT,
    "paymentTerms" TEXT,
    "contractValue" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "gstPercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "status" "ProjectStatus" NOT NULL DEFAULT 'ACTIVE',
    "projectManager" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Allocation" (
    "id" SERIAL NOT NULL,
    "employeeId" INTEGER NOT NULL,
    "projectId" INTEGER NOT NULL,
    "role" TEXT,
    "dailyWage" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "effectiveDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endDate" TIMESTAMP(3),
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Allocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attendance" (
    "id" SERIAL NOT NULL,
    "employeeId" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "code" "AttendanceCode" NOT NULL DEFAULT 'P',
    "otHours" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "advance" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "bonus" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "travel" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "food" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "fine" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "otherAllowance" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Attendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payroll" (
    "id" SERIAL NOT NULL,
    "employeeId" INTEGER NOT NULL,
    "projectId" INTEGER,
    "month" INTEGER NOT NULL,
    "workingDays" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "presentDays" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "otHours" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "gross" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "attendanceDeduction" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "basic" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "otAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "bonus" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "advanceRecovery" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "travel" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "food" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "pf" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "esi" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "professionalTax" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "net" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "employerCost" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payroll_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER,
    "userName" TEXT,
    "module" TEXT NOT NULL,
    "action" "AuditAction" NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "oldValue" JSONB,
    "newValue" JSONB,
    "reason" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_empCode_key" ON "Employee"("empCode");

-- CreateIndex
CREATE INDEX "Employee_status_idx" ON "Employee"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Project_code_key" ON "Project"("code");

-- CreateIndex
CREATE INDEX "Project_status_idx" ON "Project"("status");

-- CreateIndex
CREATE INDEX "Allocation_projectId_idx" ON "Allocation"("projectId");

-- CreateIndex
CREATE INDEX "Allocation_employeeId_idx" ON "Allocation"("employeeId");

-- CreateIndex
CREATE INDEX "Attendance_date_idx" ON "Attendance"("date");

-- CreateIndex
CREATE UNIQUE INDEX "Attendance_employeeId_date_key" ON "Attendance"("employeeId", "date");

-- CreateIndex
CREATE INDEX "Payroll_month_idx" ON "Payroll"("month");

-- CreateIndex
CREATE INDEX "Payroll_projectId_idx" ON "Payroll"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "Payroll_employeeId_month_key" ON "Payroll"("employeeId", "month");

-- CreateIndex
CREATE INDEX "AuditLog_module_idx" ON "AuditLog"("module");

-- CreateIndex
CREATE INDEX "AuditLog_entity_entityId_idx" ON "AuditLog"("entity", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- AddForeignKey
ALTER TABLE "Allocation" ADD CONSTRAINT "Allocation_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Allocation" ADD CONSTRAINT "Allocation_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payroll" ADD CONSTRAINT "Payroll_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payroll" ADD CONSTRAINT "Payroll_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
