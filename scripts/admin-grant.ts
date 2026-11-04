/**
 * Admin provisioning — the ONLY path that grants the admin role.
 *
 * Run by the owner on a trusted machine with database access:
 *
 *   bun run admin:audit                     # list accounts + roles (spot suspicious grants)
 *   bun run admin:grant -- email@host       # promote an existing account
 *   bun run admin:revoke -- email@host      # demote an account back to student
 *   bun run admin:sync-allowlist            # apply ADMIN_EMAILS (env) to existing accounts
 *
 * Public registration/login can never mint an admin (see
 * src/app/api/auth/register/route.ts). ADMIN_EMAILS is advisory input for
 * this tool only — no request path reads it.
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

const cmd = process.argv[2];
const arg = process.argv[3];

async function audit() {
  const users = await db.user.findMany({ orderBy: { createdAt: "asc" } });
  const admins = users.filter((u) => u.role === "admin");
  console.log(`Accounts: ${users.length} · admins: ${admins.length}`);
  for (const u of users) {
    const flag = u.role === "admin" ? "  ← ADMIN" : "";
    console.log(`  ${u.email}  (${u.role}, created ${u.createdAt.toISOString().slice(0, 10)})${flag}`);
  }
  if (admins.length === 0) {
    console.log("\nNo admin exists. Grant one with:  bun run admin:grant -- you@yourmail.com");
  }
  const allow = (process.env.ADMIN_EMAILS ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  if (allow.length) {
    const missing = allow.filter((e) => !admins.some((a) => a.email === e));
    if (missing.length) {
      console.log(`\nADMIN_EMAILS not yet admins (accounts must exist first): ${missing.join(", ")}`);
      console.log("Apply with:  bun run admin:sync-allowlist");
    }
  }
}

async function grant(email: string) {
  const user = await db.user.findUnique({ where: { email } });
  if (!user) {
    console.error(`No account for ${email}. Register it first (as the owner), then re-run this command.`);
    process.exit(1);
  }
  if (user.role === "admin") {
    console.log(`${email} is already an admin.`);
    return;
  }
  await db.user.update({ where: { email }, data: { role: "admin" } });
  await db.auditEvent.create({
    data: { action: "admin_granted", targetType: "user", targetId: user.id, detailJson: JSON.stringify({ email, via: "admin:grant cli" }) },
  });
  console.log(`Granted admin to ${email}.`);
}

async function revoke(email: string) {
  const user = await db.user.findUnique({ where: { email } });
  if (!user) {
    console.error(`No account for ${email}.`);
    process.exit(1);
  }
  await db.user.update({ where: { email }, data: { role: "student" } });
  await db.auditEvent.create({
    data: { action: "admin_revoked", targetType: "user", targetId: user.id, detailJson: JSON.stringify({ email, via: "admin:revoke cli" }) },
  });
  console.log(`Revoked admin from ${email}.`);
}

async function syncAllowlist() {
  const allow = (process.env.ADMIN_EMAILS ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  if (allow.length === 0) {
    console.error("ADMIN_EMAILS is empty — nothing to sync.");
    process.exit(1);
  }
  for (const email of allow) {
    const user = await db.user.findUnique({ where: { email } });
    if (!user) {
      console.log(`  skip ${email} (no account yet)`);
      continue;
    }
    if (user.role === "admin") {
      console.log(`  ok   ${email} (already admin)`);
      continue;
    }
    await db.user.update({ where: { email }, data: { role: "admin" } });
    await db.auditEvent.create({
      data: { action: "admin_granted", targetType: "user", targetId: user.id, detailJson: JSON.stringify({ email, via: "admin:sync-allowlist" }) },
    });
    console.log(`  granted ${email}`);
  }
}

async function main() {
  try {
    switch (cmd) {
      case "audit":
        await audit();
        break;
      case "grant":
        if (!arg) { console.error("Usage: bun run admin:grant -- email@host"); process.exit(1); }
        await grant(arg.toLowerCase());
        break;
      case "revoke":
        if (!arg) { console.error("Usage: bun run admin:revoke -- email@host"); process.exit(1); }
        await revoke(arg.toLowerCase());
        break;
      case "sync-allowlist":
        await syncAllowlist();
        break;
      default:
        console.log("Commands: audit | grant -- <email> | revoke -- <email> | sync-allowlist");
    }
  } finally {
    await db.$disconnect();
  }
}

void main();
