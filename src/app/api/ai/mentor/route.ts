import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/identity/auth";
import { getOpportunity } from "@/lib/catalogue/queries";
import { evaluateOpportunity } from "@/lib/matching/engine";
import { complete, extractJson } from "@/lib/ai/provider";
import { badRequest, unauthorized, serverError, profileSchema } from "@/lib/validation";
import type {
  EvaluationSummary,
  MentorAction,
  MentorThreadMessage,
  Opportunity,
  ProfileData,
} from "@/lib/types";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

// ---------- Input / output contracts ----------

const mentorRequestSchema = z.object({
  message: z.string().trim().min(1).max(2000),
  context: z.object({
    view: z.string().trim().min(1).max(40),
    refId: z.string().trim().min(1).max(120).optional(),
  }),
  lang: z.enum(["en", "bn"]).default("en"),
  /** Guest context (mirrors plan/generate + evaluate): the local profile
   * and plan facts the student already has. Validated; never trusted for
   * authorization — grounding only. Ignored for signed-in users. */
  profile: profileSchema.optional(),
  planContext: z
    .object({
      done: z.number().int().min(0).max(500),
      open: z.number().int().min(0).max(500),
      nextTaskTitle: z.string().trim().min(1).max(240).optional(),
      nextTaskStableKey: z.string().trim().min(1).max(120).optional(),
    })
    .optional(),
});

/** Strict model-output contract — anything outside it fails the parse. */
const modelReplySchema = z.object({
  answer: z.string().min(1).max(6000),
  clarification: z.string().min(1).max(600).nullish(),
  actions: z.array(z.unknown()).max(6).default([]),
});

const ACTION_TYPES = [
  "open_requirement",
  "open_source",
  "start_task",
  "request_profile_field",
  "propose_task",
  "preview_replan",
] as const;
type ActionType = (typeof ACTION_TYPES)[number];

/** Guests (and signed-in students without a profile row) get a minimal,
 * explicitly undecided profile — no fabricated facts, no PII. */
const GENERIC_PROFILE: ProfileData = {
  degreeLevel: "undecided",
  fieldInterests: [],
  intakeFlexible: true,
  citizenships: [],
  uiLanguage: "en",
  qualifications: [],
  languages: [],
  tests: [],
  financeUncertain: true,
  countryPrefs: [],
  instructionLang: "any",
  willingToLearnLang: false,
  onboardingCompleted: false,
};

function clientIp(request: Request): string | undefined {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim().slice(0, 60) || undefined;
  return undefined;
}

/** Allowlist validation for a single proposed action — drop anything else. */
function sanitizeAction(raw: unknown): MentorAction | null {
  if (typeof raw !== "object" || raw === null) return null;
  const obj = raw as Record<string, unknown>;
  const label = typeof obj.label === "string" ? obj.label.trim().slice(0, 120) : "";
  if (typeof obj.type !== "string" || !label) return null;
  if (!(ACTION_TYPES as readonly string[]).includes(obj.type)) return null;
  const opt = (key: string): string | undefined => {
    const value = obj[key];
    return typeof value === "string" && value.trim() ? value.trim().slice(0, 120) : undefined;
  };
  switch (obj.type as ActionType) {
    case "open_requirement":
      return { type: "open_requirement", ruleId: opt("ruleId"), label };
    case "open_source":
      return { type: "open_source", sourceKey: opt("sourceKey"), label };
    case "start_task":
      return { type: "start_task", stableKey: opt("stableKey"), label };
    case "request_profile_field":
      return { type: "request_profile_field", field: opt("field"), label };
    case "propose_task":
      return { type: "propose_task", title: opt("title"), label };
    case "preview_replan":
      return { type: "preview_replan", label };
  }
}

function parseActionJson(json: string | null): MentorAction[] | undefined {
  if (!json) return undefined;
  try {
    const raw: unknown = JSON.parse(json);
    if (!Array.isArray(raw)) return undefined;
    const actions = raw
      .map(sanitizeAction)
      .filter((a): a is MentorAction => a !== null)
      .slice(0, 2);
    return actions.length > 0 ? actions : undefined;
  } catch {
    return undefined;
  }
}

// ---------- Grounded context (server-side, minimal, no PII) ----------

async function loadActiveGoal(userId: string) {
  try {
    return await db.goal.findFirst({
      where: { userId, status: "active" },
      include: { plans: { where: { isActive: true }, include: { tasks: true } } },
    });
  } catch {
    return null;
  }
}

async function loadProfile(userId: string): Promise<ProfileData | null> {
  try {
    const row = await db.profile.findUnique({ where: { userId } });
    return row ? (JSON.parse(row.data) as ProfileData) : null;
  } catch {
    return null;
  }
}

interface GroundedContext {
  opportunity: Opportunity | null;
  evaluation: EvaluationSummary | null;
  hasPlan: boolean;
  planDone: number;
  planOpen: number;
  nextTaskTitle: string | null;
  nextTaskStableKey: string | null;
}

async function buildGroundedContext(
  userId: string | undefined,
  context: { view: string; refId?: string },
  guestProfile?: ProfileData,
  guestPlan?: { done: number; open: number; nextTaskTitle?: string; nextTaskStableKey?: string },
): Promise<GroundedContext> {
  // refId is used as the target ONLY when it resolves to a real catalogue
  // slug (validation by resolution — an arbitrary string simply misses);
  // signed-in students otherwise ground on their active server-side goal.
  let targetSlug: string | null = context.refId ?? null;
  let opportunity = targetSlug ? await getOpportunity(targetSlug) : null;
  if (!opportunity) targetSlug = null;

  const goal = userId ? await loadActiveGoal(userId) : null;
  if (!targetSlug && goal) {
    targetSlug = goal.opportunitySlug;
    opportunity = await getOpportunity(targetSlug);
  }

  const profile = userId
    ? ((await loadProfile(userId)) ?? GENERIC_PROFILE)
    : (guestProfile ?? GENERIC_PROFILE);
  const evaluation = opportunity
    ? evaluateOpportunity(opportunity.requirements, profile, opportunity.slug)
    : null;

  // Plan facts: server truth for signed-in students; the validated guest
  // snapshot for guests (their local plan IS their durable store).
  if (userId) {
    const tasks = goal?.plans[0]?.tasks ?? [];
    const openTasks = tasks
      .filter((t) => t.status === "todo" || t.status === "in_progress")
      .sort((a, b) => a.order - b.order);
    return {
      opportunity,
      evaluation,
      hasPlan: Boolean(goal?.plans[0]),
      planDone: tasks.filter((t) => t.status === "done").length,
      planOpen: openTasks.length,
      nextTaskTitle: openTasks[0]?.title ?? null,
      nextTaskStableKey: openTasks[0]?.stableKey ?? null,
    };
  }
  const open = guestPlan?.open ?? 0;
  return {
    opportunity,
    evaluation,
    hasPlan: open + (guestPlan?.done ?? 0) > 0,
    planDone: guestPlan?.done ?? 0,
    planOpen: open,
    nextTaskTitle: guestPlan?.nextTaskTitle ?? null,
    nextTaskStableKey: guestPlan?.nextTaskStableKey ?? null,
  };
}

function buildFactLines(
  ctx: GroundedContext,
  signedIn: boolean,
  context: { view: string; refId?: string },
): string[] {
  const facts: string[] = [];
  const { opportunity, evaluation } = ctx;
  if (opportunity) {
    facts.push(
      `Current target: ${opportunity.title} (${opportunity.countryLabel}, ${
        opportunity.kind === "funding_scheme" ? "funding scheme" : "programme"
      }).`,
    );
  } else {
    facts.push("No target opportunity is currently selected (or it was not found).");
  }
  if (evaluation) {
    const c = evaluation.counts;
    facts.push(
      `Deterministic requirement check (never override): ${c.met} met, ${c.notMet} not met, ${c.needsInfo} need information, ${c.needsConfirm} need institution confirmation.`,
    );
    if (evaluation.gapTitles.length > 0) {
      facts.push(`Top gaps: ${evaluation.gapTitles.slice(0, 3).join("; ")}.`);
    }
    facts.push(`Documented official sources for this target: ${opportunity?.sources.length ?? 0}.`);
  }
  if (signedIn) {
    if (ctx.hasPlan) {
      facts.push(
        `Active plan: ${ctx.planDone} tasks done, ${ctx.planOpen} open${
          ctx.nextTaskTitle ? `, next open task: "${ctx.nextTaskTitle}"` : ""
        }.`,
      );
    } else {
      facts.push("Signed-in student with no active plan yet.");
    }
  } else if (ctx.hasPlan) {
    facts.push(
      `Guest plan (this device): ${ctx.planDone} tasks done, ${ctx.planOpen} open${
        ctx.nextTaskTitle ? `, next open task: "${ctx.nextTaskTitle}"` : ""
      }.`,
    );
  } else {
    facts.push("Guest session with no saved plan yet.");
  }
  facts.push(`Current app surface: ${context.view}${context.refId ? `, ref: ${context.refId}` : ""}.`);
  return facts;
}

function buildSystemPrompt(lang: "en" | "bn"): string {
  return [
    "You are Uraan's study-abroad preparation mentor for a Bangladeshi student.",
    lang === "bn"
      ? "উত্তর দিন সহজ, উষ্ণ ও সৎ বাংলায়।"
      : "Answer in plain, warm, honest English.",
    "Be concise: at most 120 words in the answer.",
    "Base every claim ONLY on the FACTS provided. Never use outside knowledge for specific deadlines, costs, or requirements.",
    "Clearly separate general preparation advice from the documented requirements listed in the facts.",
    "If the student's question needs information you do not have, say so plainly.",
    "NEVER invent deadlines, costs, or admission chances, and never imply admission or funding is guaranteed.",
    "End with ONE useful clarification question when it genuinely helps; otherwise set clarification to null.",
    "Propose at most 2 actions. Allowed action types: open_requirement, open_source, start_task, request_profile_field, propose_task, preview_replan.",
    "You only PROPOSE tasks and replans — the student applies changes through the replan preview, so never claim you edited anything.",
    'Reply ONLY with strict JSON: {"answer": string, "clarification": string | null, "actions": [{"type": string, "label": string}]}.',
  ].join(" ");
}

/** Deterministic provenance line built from real data only. */
function buildBasis(ctx: GroundedContext, lang: "en" | "bn"): string {
  const { evaluation, opportunity } = ctx;
  if (!evaluation || !opportunity) {
    return lang === "bn"
      ? "নির্বাচিত কোনো লক্ষ্য নেই — সাধারণ প্রস্তুতি পরামর্শ মাত্র"
      : "No selected target — general preparation guidance only";
  }
  const { met, notMet, needsInfo, needsConfirm } = evaluation.counts;
  const sources = opportunity.sources.length;
  if (lang === "bn") {
    return `শর্ত যাচাই: ${met} মেটে · ${notMet + needsInfo} ফাঁক · ${needsConfirm} নিশ্চয়তা দরকার — অফিসিয়াল সূত্র থেকে (${sources})`;
  }
  return `Requirements checked: ${met} met · ${notMet + needsInfo} gaps · ${needsConfirm} needs confirmation — from official sources (${sources})`;
}

/** Honest labelled template fallback — never presented as live AI. */
function templateMentorReply(
  ctx: GroundedContext,
  lang: "en" | "bn",
): { content: string; actions: MentorAction[] } {
  const { opportunity, evaluation } = ctx;
  const en: string[] = [];
  const bn: string[] = [];
  en.push("This is a template answer — the live mentor service is unavailable right now, so this text was not generated by AI.");
  bn.push("এটি একটি টেমপ্লেট উত্তর — লাইভ মেন্টর সেবা এখন পাওয়া যাচ্ছে না, তাই এই লেখা AI দিয়ে তৈরি নয়।");

  if (opportunity && evaluation) {
    const c = evaluation.counts;
    en.push(
      `${opportunity.title}: ${c.met} requirements met · ${c.notMet} not met · ${
        c.needsInfo + c.needsConfirm
      } still to resolve.`,
    );
    bn.push(
      `${opportunity.title}: ${c.met}টি শর্ত মেটে · ${c.notMet}টি মেটেনি · ${
        c.needsInfo + c.needsConfirm
      }টি এখনো নিষ্পত্তি বাকি।`,
    );
    if (evaluation.gapTitles.length > 0) {
      en.push(`Top gaps: ${evaluation.gapTitles.slice(0, 3).join("; ")}.`);
      bn.push(`প্রধান ফাঁক: ${evaluation.gapTitles.slice(0, 3).join("; ")}।`);
    }
  } else {
    en.push("No target opportunity is selected yet, so this is general guidance: pick a target, complete onboarding, then run the requirement check.");
    bn.push("এখনো কোনো লক্ষ্য নির্বাচিত নয়, তাই এটি সাধারণ পরামর্শ: একটি লক্ষ্য বেছে নিন, অনবোর্ডিং শেষ করুন, তারপর শর্ত যাচাই চালান।");
  }

  if (ctx.hasPlan) {
    en.push(`Plan: ${ctx.planDone} tasks done, ${ctx.planOpen} open${ctx.nextTaskTitle ? `, next: "${ctx.nextTaskTitle}"` : ""}.`);
    bn.push(`পরিকল্পনা: ${ctx.planDone}টি কাজ শেষ, ${ctx.planOpen}টি বাকি${ctx.nextTaskTitle ? `, পরের কাজ: "${ctx.nextTaskTitle}"` : ""}।`);
  }

  if (evaluation && evaluation.gapTitles.length > 0) {
    en.push(`Suggested next step: resolve the first gap — ${evaluation.gapTitles[0]} — then re-run the check.`);
    bn.push(`পরামর্শিত পরের পদক্ষেপ: প্রথম ফাঁকটি সমাধান করুন — ${evaluation.gapTitles[0]} — তারপর যাচাই আবার চালান।`);
  } else if (ctx.nextTaskTitle) {
    en.push(`Suggested next step: work on "${ctx.nextTaskTitle}".`);
    bn.push(`পরামর্শিত পরের পদক্ষেপ: "${ctx.nextTaskTitle}" কাজটি করুন।`);
  } else {
    en.push("Suggested next step: complete onboarding so the requirement check has your facts.");
    bn.push("পরামর্শিত পরের পদক্ষেপ: অনবোর্ডিং শেষ করুন যাতে শর্ত যাচাই আপনার তথ্য পায়।");
  }

  const actions: MentorAction[] = [];
  if (evaluation && evaluation.gapTitles.length > 0) {
    actions.push({
      type: "open_requirement",
      label: lang === "bn" ? "শর্তের ফাঁক দেখুন" : "Review requirement gaps",
    });
  }
  if (ctx.nextTaskStableKey) {
    actions.push({
      type: "start_task",
      stableKey: ctx.nextTaskStableKey,
      label: lang === "bn" ? "পরের কাজ খুলুন" : "Open next task",
    });
  }
  if (actions.length === 0 && !evaluation) {
    actions.push({
      type: "request_profile_field",
      label: lang === "bn" ? "প্রোফাইল সম্পূর্ণ করুন" : "Complete your profile",
    });
  }

  return { content: (lang === "bn" ? bn : en).join("\n\n"), actions: actions.slice(0, 2) };
}

// ---------- POST: ask the grounded mentor ----------

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const parsed = mentorRequestSchema.safeParse(body);
    if (!parsed.success) return badRequest("invalid_input");
    const { message, context, lang } = parsed.data;

    const user = await getCurrentUser(); // guests allowed
    const ctx = await buildGroundedContext(
      user?.id,
      context,
      user ? undefined : parsed.data.profile,
      user ? undefined : parsed.data.planContext,
    );
    const facts = buildFactLines(ctx, Boolean(user), context);

    const result = await complete({
      system: buildSystemPrompt(lang),
      user: [...facts, "", `Student's message: ${message}`].join("\n"),
      userId: user?.id,
      ip: clientIp(request),
      purpose: "mentor_reply",
      json: true,
    });

    let content: string;
    let actions: MentorAction[];
    let aiGenerated = false;

    const modelParsed = result.ok ? extractJson(result.text, modelReplySchema.parse) : null;
    const answer = modelParsed?.answer.trim().slice(0, 4000) ?? "";
    if (result.ok && modelParsed && answer) {
      const clarification = modelParsed.clarification?.trim().slice(0, 600);
      content = clarification ? `${answer}\n\n${clarification}` : answer;
      actions = modelParsed.actions
        .map(sanitizeAction)
        .filter((a): a is MentorAction => a !== null)
        .slice(0, 2);
      aiGenerated = true;
    } else {
      // Provider failure / timeout / quota / malformed output — honest
      // labelled template, never faked as live AI.
      const template = templateMentorReply(ctx, lang);
      content = template.content;
      actions = template.actions;
    }

    const reply = { content, basis: buildBasis(ctx, lang), actions, aiGenerated };

    // Persist both turns for signed-in students. Persistence must never
    // break the reply itself.
    if (user) {
      try {
        await db.mentorMessage.create({
          data: {
            userId: user.id,
            role: "user",
            content: message,
            contextView: context.view.slice(0, 40),
            contextRef: context.refId?.slice(0, 120) ?? null,
          },
        });
        await db.mentorMessage.create({
          data: {
            userId: user.id,
            role: "mentor",
            content: reply.content,
            contextView: context.view.slice(0, 40),
            contextRef: context.refId?.slice(0, 120) ?? null,
            actionJson: reply.actions.length > 0 ? JSON.stringify(reply.actions) : null,
            aiGenerated: reply.aiGenerated,
          },
        });
      } catch {
        /* history logging must never break the reply */
      }
    }

    return Response.json({ ok: true, data: { reply } }, { headers: NO_STORE });
  } catch {
    return serverError();
  }
}

// ---------- GET: signed-in thread history ----------

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorized();

    const rows = await db.mentorMessage.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    const messages: MentorThreadMessage[] = rows.reverse().map((row) => ({
      id: row.id,
      role: row.role === "user" ? "user" : "mentor",
      content: row.content,
      actions: parseActionJson(row.actionJson),
      aiGenerated: row.aiGenerated,
      createdAt: row.createdAt.toISOString(),
    }));

    return Response.json({ ok: true, data: { messages } }, { headers: NO_STORE });
  } catch {
    return serverError();
  }
}

// ---------- DELETE: clear this user's mentor history ----------

export async function DELETE() {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorized();
    await db.mentorMessage.deleteMany({ where: { userId: user.id } });
    return Response.json({ ok: true, data: { cleared: true } }, { headers: NO_STORE });
  } catch {
    return serverError();
  }
}
