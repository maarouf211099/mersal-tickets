import { randomBytes } from "node:crypto";
import { prisma } from "./prisma";
import { DEFAULT_TEAMS } from "./workflow";
import { notify, teamMemberIds } from "./notify";

const g = globalThis as unknown as { __mersalTicketsBoot?: boolean };

export async function bootstrap() {
  if (g.__mersalTicketsBoot) return;
  g.__mersalTicketsBoot = true;

  try {
    await seedTeams();
    await seedAdmin();
  } catch (e) {
    // الغالب إن الـ migrations لسه ما اتعملتش: npm run db:migrate
    console.error("[mersal-tickets] bootstrap failed:", e);
  }

  setInterval(() => {
    slaBreachTick().catch((err) => console.error("[mersal-tickets] SLA tick failed:", err));
  }, 60_000).unref();
}

// بيضيف التيمات الأساسية لو مش موجودة (بالكود) — ما بيعدّلش أي تيم المدير غيّره
async function seedTeams() {
  for (const t of DEFAULT_TEAMS) {
    const exists = await prisma.team.findUnique({ where: { code: t.code } });
    if (exists) continue;
    await prisma.team.create({
      data: { code: t.code, name: t.name, color: t.color, description: t.description, isReceiver: t.isReceiver },
    });
  }
  for (const t of DEFAULT_TEAMS) {
    if (!t.transferOnlyFrom) continue;
    const [team, from] = await Promise.all([
      prisma.team.findUnique({ where: { code: t.code } }),
      prisma.team.findUnique({ where: { code: t.transferOnlyFrom } }),
    ]);
    if (team && from && !team.transferOnlyFromId) {
      await prisma.team.update({ where: { id: team.id }, data: { transferOnlyFromId: from.id } });
    }
  }
}

async function seedAdmin() {
  if ((await prisma.user.count()) > 0) return;
  const bcrypt = (await import("bcryptjs")).default;
  const username = (process.env.DEFAULT_ADMIN_USERNAME || "admin").toLowerCase();
  const password = process.env.DEFAULT_ADMIN_PASSWORD || randomBytes(9).toString("base64url");
  await prisma.user.create({
    data: {
      username,
      fullName: process.env.DEFAULT_ADMIN_NAME || "مدير النظام",
      passwordHash: await bcrypt.hash(password, 10),
      role: "manager",
      canReopen: true,
      canExport: true,
    },
  });
  console.log(`[mersal-tickets] تم إنشاء حساب المدير: ${username}` +
    (process.env.DEFAULT_ADMIN_PASSWORD ? " (كلمة المرور من .env)" : ` — كلمة المرور: ${password}`));
}

// إشعار مرة واحدة لكل تيكت عدّت موعد الـ SLA
async function slaBreachTick() {
  const now = new Date();
  const due = await prisma.ticket.findMany({
    where: { status: "pending", slaDeadline: { lt: now }, slaBreachNotifiedAt: null },
    select: {
      id: true, ticketNumber: true, createdById: true, assignedToId: true,
      teams: { where: { access: "holder" }, select: { teamId: true } },
    },
    take: 200,
  });
  for (const t of due) {
    const claimed = await prisma.ticket.updateMany({
      where: { id: t.id, slaBreachNotifiedAt: null },
      data: { slaBreachNotifiedAt: now },
    });
    if (claimed.count === 0) continue;
    await prisma.ticketEvent.create({ data: { ticketId: t.id, action: "sla_breached" } });
    const members = await teamMemberIds(t.teams.map((x) => x.teamId));
    await notify({
      userIds: [...members, t.createdById, ...(t.assignedToId ? [t.assignedToId] : [])],
      ticketId: t.id,
      type: "sla_breached",
      title: `⛔ تجاوزت التذكرة مهلة الإنجاز: ${t.ticketNumber}`,
    });
  }
}
