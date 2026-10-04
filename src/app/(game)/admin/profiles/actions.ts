"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { auth } from "~/lib/auth.server";
import { isAdmin } from "~/lib/admin";
import { createAiProfile, archiveAiProfile } from "~/data/aiProfiles.server";
import { CINDERLING_LIBRARY } from "../../../../../server/cinderlings";

function assertAdmin(session: Awaited<ReturnType<typeof auth.api.getSession>>) {
  if (!isAdmin(session)) throw new Error("Forbidden");
}

/** Convert a display name to a URL-safe slug, e.g. "Aggro Hard!" → "aggro-hard" */
function nameToSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Auto-select cinderlings using Claude Haiku based on the profile description.
 * Returns a list of `count` names from CINDERLING_LIBRARY.
 * Falls back to random picks if ANTHROPIC_API_KEY is not set.
 */
async function autoSelectMons(
  description: string,
  existing: string[],
  count: number,
): Promise<string[]> {
  const available = CINDERLING_LIBRARY.filter(
    (v) => !existing.includes(v.name),
  );

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    // Fallback: random picks from available pool
    const shuffled = available.sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count).map((v) => v.name);
  }

  // Use Anthropic SDK to call Claude Haiku
  const Anthropic = (await import("@anthropic-ai/sdk")).default;
  const client = new Anthropic({ apiKey });

  // Full roster in the system prompt so Haiku has stable context per-call.
  // Stats drive selection — no archetype labels to avoid pigeonholing the meta.
  const fullRoster = CINDERLING_LIBRARY.map(
    (v) =>
      `- ${v.name} (HP ${v.hp}, ATK ${v.attack}, SPD ${v.speed}) — "${v.flavor}"`,
  ).join("\n");

  const systemPrompt = `You are a cinderling team-builder. Select cinderlings whose stats best match an AI player profile's described playstyle.

Prioritise raw stat alignment: a speed-focused profile gets high-SPD mons, an aggressive profile gets high-ATK mons, a durable profile gets high-HP mons. Mix and match freely — there are no prescribed combinations.

Full cinderling roster:
${fullRoster}

Call select_mons with exactly the number of picks requested. Do not pick mons already on the team.`;

  const existingNote =
    existing.length > 0 ? `\nAlready on team (do not pick): ${existing.join(", ")}` : "";

  const userMessage = `Profile description: "${description}"${existingNote}
Pick ${count} cinderling${count > 1 ? "s" : ""} to add to the team.`;

  const selectTool = {
    name: "select_mons",
    description: `Select exactly ${count} cinderling${count > 1 ? "s" : ""} for the team.`,
    input_schema: {
      type: "object" as const,
      properties: {
        selections: {
          type: "array" as const,
          items: { type: "string" as const },
          description:
            "Names of the selected cinderlings, exactly as they appear in the roster.",
        },
      },
      required: ["selections"],
    },
  };

  const msg = await client.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 256,
    system: systemPrompt,
    tools: [selectTool],
    tool_choice: { type: "tool", name: "select_mons" },
    messages: [{ role: "user", content: userMessage }],
  });

  const toolUse = msg.content.find((b) => b.type === "tool_use");
  let picked: string[] = [];
  if (toolUse?.type === "tool_use") {
    const input = toolUse.input as { selections?: string[] };
    picked = Array.isArray(input.selections) ? input.selections : [];
  }

  if (picked.length === 0) {
    // Unexpected — tool call returned nothing; fall back to random
    const shuffled = available.sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count).map((v) => v.name);
  }

  // Validate each name is real and not already in team
  const valid = picked.filter((n) =>
    CINDERLING_LIBRARY.some(
      (v) => v.name.toLowerCase() === n.toLowerCase() && !existing.includes(v.name),
    ),
  );

  // Pad with random picks if Haiku returned fewer than needed
  if (valid.length < count) {
    const remaining = available
      .filter((v) => !valid.includes(v.name))
      .sort(() => Math.random() - 0.5)
      .slice(0, count - valid.length)
      .map((v) => v.name);
    return [...valid, ...remaining];
  }

  return valid.slice(0, count);
}

export async function createProfileAction(formData: FormData) {
  const headersList = await headers();
  const session = await auth.api.getSession({ headers: headersList });
  assertAdmin(session);

  const name = (formData.get("name") as string).trim();
  const description = (formData.get("description") as string | null)?.trim() ?? "";
  const randomnessRaw = formData.get("randomness") as string | null;
  const randomness = randomnessRaw ? Math.max(0, Math.min(1, parseFloat(randomnessRaw))) : 0.5;
  const modelRaw = formData.get("model") as string | null;
  const model = modelRaw === "jev" ? "jev" : "claude";

  if (!name) throw new Error("Name is required");
  if (!description) throw new Error("Description (prompt) is required");

  const id = nameToSlug(name);
  if (!id) throw new Error("Name must contain at least one letter or digit");

  // teamNames is a comma-separated list submitted from the MonTeamSelector
  const teamNamesRaw = (formData.get("teamNames") as string | null) ?? "";
  let teamNames = teamNamesRaw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  // Validate any manually-picked names exist in the library
  const unknown = teamNames.filter(
    (n) => !CINDERLING_LIBRARY.some((v) => v.name.toLowerCase() === n.toLowerCase()),
  );
  if (unknown.length > 0) {
    throw new Error(`Unknown cinderling names: ${unknown.join(", ")}`);
  }

  // Auto-fill remaining slots up to 8 (starters vs bench decided at pregame)
  if (teamNames.length < 8) {
    const needed = 8 - teamNames.length;
    const autoPicked = await autoSelectMons(description, teamNames, needed);
    teamNames = [...teamNames, ...autoPicked];
  }

  // Final validation: exactly 8
  if (teamNames.length !== 8) {
    throw new Error("Could not build an 8-cinderling team");
  }

  await createAiProfile({ id, name, teamNames, randomness, description, model });
  revalidatePath("/admin/profiles");
}

export async function archiveProfileAction(profileId: string) {
  const headersList = await headers();
  const session = await auth.api.getSession({ headers: headersList });
  assertAdmin(session);
  await archiveAiProfile(profileId);
  revalidatePath("/admin/profiles");
}
