-- CreateTable
CREATE TABLE "TicketTeamVisit" (
    "ticketId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "firstAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TicketTeamVisit_pkey" PRIMARY KEY ("ticketId","teamId")
);

-- CreateIndex
CREATE INDEX "TicketTeamVisit_teamId_idx" ON "TicketTeamVisit"("teamId");

-- AddForeignKey
ALTER TABLE "TicketTeamVisit" ADD CONSTRAINT "TicketTeamVisit_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketTeamVisit" ADD CONSTRAINT "TicketTeamVisit_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- كل ما تيم يمسك تيكت (holder) بيتسجل في TicketTeamVisit — من غير ما نعدّل كل مسار تحويل في الكود
CREATE OR REPLACE FUNCTION record_ticket_team_visit() RETURNS trigger AS $$
BEGIN
  IF NEW."access" = 'holder' THEN
    EXECUTE format(
      'INSERT INTO %I."TicketTeamVisit" ("ticketId", "teamId", "firstAt", "lastAt") VALUES ($1, $2, now(), now())
       ON CONFLICT ("ticketId", "teamId") DO UPDATE SET "lastAt" = now()', TG_TABLE_SCHEMA)
    USING NEW."ticketId", NEW."teamId";
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ticket_team_visit
AFTER INSERT OR UPDATE OF "access" ON "TicketTeam"
FOR EACH ROW EXECUTE FUNCTION record_ticket_team_visit();

-- البيانات القديمة: التيمات الحالية على كل تيكت
INSERT INTO "TicketTeamVisit" ("ticketId", "teamId", "firstAt", "lastAt")
SELECT "ticketId", "teamId", "addedAt", "addedAt" FROM "TicketTeam"
ON CONFLICT DO NOTHING;

-- والتيمات اللي مسكتها قبل كده (من سجل التحويل والإنشاء — بالاسم)
INSERT INTO "TicketTeamVisit" ("ticketId", "teamId", "firstAt", "lastAt")
SELECT x."ticketId", tm."id", min(x."createdAt"), max(x."createdAt")
FROM (
  SELECT e."ticketId", e."createdAt", e."metadata"->>'to' AS name
  FROM "TicketEvent" e
  WHERE e."action" IN ('transferred', 'created') AND jsonb_typeof(e."metadata"->'to') = 'string'
  UNION ALL
  SELECT e."ticketId", e."createdAt", f.name
  FROM "TicketEvent" e, jsonb_array_elements_text(e."metadata"->'from') AS f(name)
  WHERE e."action" = 'transferred' AND jsonb_typeof(e."metadata"->'from') = 'array'
) x
JOIN "Team" tm ON tm."name" = x.name
GROUP BY x."ticketId", tm."id"
ON CONFLICT DO NOTHING;
