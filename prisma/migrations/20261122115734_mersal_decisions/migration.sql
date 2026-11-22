-- AlterTable
ALTER TABLE "Ticket" ADD COLUMN     "mersalDecidedAt" TIMESTAMP(3),
ADD COLUMN     "mersalDecidedById" TEXT,
ADD COLUMN     "mersalDecision" TEXT;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_mersalDecidedById_fkey" FOREIGN KEY ("mersalDecidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
