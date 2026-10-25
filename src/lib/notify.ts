import "server-only";
import { prisma } from "./prisma";

type NotifyInput = {
  userIds: string[];
  ticketId?: string;
  type: string;
  title: string;
  body?: string;
};

export async function notify(input: NotifyInput) {
  const unique = Array.from(new Set(input.userIds));
  if (unique.length === 0) return;
  await prisma.notification.createMany({
    data: unique.map((userId) => ({
      userId, ticketId: input.ticketId, type: input.type, title: input.title, body: input.body,
    })),
  });
}

// أعضاء التيمات (النشطين) — لإشعار التيم كله لما تيكت توصله
export async function teamMemberIds(teamIds: string[], exclude?: string): Promise<string[]> {
  if (teamIds.length === 0) return [];
  const rows = await prisma.teamMember.findMany({
    where: { teamId: { in: teamIds }, user: { isActive: true } },
    select: { userId: true },
  });
  return [...new Set(rows.map((r) => r.userId))].filter((id) => id !== exclude);
}
