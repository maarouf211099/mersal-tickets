-- تقييم النظام (رسالة التقييم المنبثقة) — جدول جديد بس، مفيش أي تعديل على الجداول الموجودة.
-- IF NOT EXISTS عشان الـ migration تعدّي حتى لو الجدول اتعمل قبل كده بأي طريقة.

-- CreateTable
CREATE TABLE IF NOT EXISTS "Feedback" (
    "id" TEXT NOT NULL,
    "campaign" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "overall" INTEGER NOT NULL,
    "ease" INTEGER,
    "speed" INTEGER,
    "value" INTEGER,
    "problems" TEXT,
    "ideas" TEXT,
    "department" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Feedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Feedback_campaign_createdAt_idx" ON "Feedback"("campaign", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Feedback_campaign_userId_key" ON "Feedback"("campaign", "userId");

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint c
        JOIN pg_class t ON t.oid = c.conrelid
        WHERE c.conname = 'Feedback_userId_fkey' AND t.relname = 'Feedback' AND t.relnamespace = current_schema()::regnamespace
    ) THEN
        ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
