-- DropForeignKey
ALTER TABLE "Allocation" DROP CONSTRAINT "Allocation_projectId_fkey";

-- DropForeignKey
ALTER TABLE "WorkOrder" DROP CONSTRAINT "WorkOrder_projectId_fkey";

-- AlterTable
ALTER TABLE "Allocation" ALTER COLUMN "projectId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "WorkOrder" ALTER COLUMN "projectId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "Allocation" ADD CONSTRAINT "Allocation_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrder" ADD CONSTRAINT "WorkOrder_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
