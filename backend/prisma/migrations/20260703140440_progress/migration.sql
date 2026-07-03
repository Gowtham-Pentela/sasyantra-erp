-- CreateTable
CREATE TABLE "ProjectProgress" (
    "id" SERIAL NOT NULL,
    "projectId" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "percent" DECIMAL(5,2) NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectProgress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProjectProgress_projectId_idx" ON "ProjectProgress"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectProgress_projectId_month_key" ON "ProjectProgress"("projectId", "month");

-- AddForeignKey
ALTER TABLE "ProjectProgress" ADD CONSTRAINT "ProjectProgress_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
