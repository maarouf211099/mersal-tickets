-- «مدة المساهمة» بقت «معدل المساهمة» — نفس البيانات
ALTER TABLE "Ticket" RENAME COLUMN "sponsorDuration" TO "sponsorRate";

-- نوع الطلب للأبحاث: بحث / إعادة مناقشة / استبيان
ALTER TABLE "Ticket" ADD COLUMN "researchRequestType" TEXT;
