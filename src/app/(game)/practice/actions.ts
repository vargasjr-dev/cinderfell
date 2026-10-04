"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { auth } from "~/lib/auth.server";
import { requireSubscriber } from "../../../../lib/subscription";
import { db } from "../../../../data/db";
import { gameSession, gamePlayer, team } from "../../../../data/schema";
import { eq } from "drizzle-orm";
import { listAiProfiles, getAiProfile, createAiProfile } from "~/data/aiProfiles.server";
import { CINDERLING_LIBRARY } from "../../../../server/cinderlings";
import { buildSystemPrompt } from "../../../../server/ai-llm";

/**
 * Create a sparring match against a named AI profile.
 * The profile's specific team is stored in metadata so the game engine uses
 * those exact mons instead of random picks.
 */
export async function createProfileSparringMatchAction(
  playerTeamUuid: string,
  profileId: string,
  mapId: string,
): Promise<{ success: true; matchUuid: string } | { success: false; error: string }> {
  const headersList = await headers();
  const session = (await auth.api.getSession({ headers: headersList }))!;

  try {
    await requireSubscriber(session.user.id);
  } catch {
    return { success: false, error: "Premium subscription required for AI sparring" };
  }

  const [playerTeam] = await db
    .select()
    .from(team)
    .where(eq(team.uuid, playerTeamUuid))
    .limit(1);

  if (!playerTeam || playerTeam.userId !== session.user.id) {
    return { success: false, error: "Invalid team selected" };
  }

  const profile = await getAiProfile(profileId);
  if (!profile) {
    return { success: false, error: "Profile not found" };
  }

  const [match] = await db
    .insert(gameSession)
    .values({
      createdBy: session.user.id,
      status: "playing",
      maxPlayers: 2,
      currentPlayers: 2,
      metadata: {
        matchSettings: {
          timerSeconds: 0 as const,
          mapId,
          mode: "casual" as const,
        },
        sparring: true,
        aiTeamId: 2,
        playerTeamUuid,
        aiProfileId: profile.id,
        aiModel: profile.model === "jev" ? "jev" : "claude",
        aiProfileTeamNames: profile.teamNames as string[],
        aiProfileName: profile.name,
        aiSystemPrompt: profile.description
          ? buildSystemPrompt(profile.description, "")
          : undefined,
        aiProfileStrategy: profile.description || undefined,
      },
    })
    .returning();

  await db.insert(gamePlayer).values({
    gameSessionUuid: match.uuid,
    userId: session.user.id,
    teamUuid: playerTeamUuid,
  });

  return { success: true, matchUuid: match.uuid };
}

/** Convert a display name to a URL-safe slug */
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
 * Falls back to random picks if ANTHROPIC_API_KEY is not set.
 */
async function autoSelectMons(
  description: string,
  existing: string[],
  count: number,
): Promise<string[]> {
  const available = CINDERLING_LIBRARY.filter((v) => !existing.includes(v.name));
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return available.sort(() => Math.random() - 0.5).slice(0, count).map((v) => v.name);
  }
  const Anthropic = (await import("@anthropic-ai/sdk")).default;
  const client = new Anthropic({ apiKey });
  const fullRoster = CINDERLING_LIBRARY.map(
    (v) => `- ${v.name} (HP ${v.hp}, ATK ${v.attack}, SPD ${v.speed}) — "${v.flavor}"`,
  ).join("\n");
  const systemPrompt = `You are a cinderling team-builder. Select cinderlings whose stats best match an AI player profile's described playstyle.\n\nFull cinderling roster:\n${fullRoster}\n\nCall select_mons with exactly the number of picks requested.`;
  const existingNote = existing.length > 0 ? `\nAlready on team (do not pick): ${existing.join(", ")}` : "";
  const selectTool = {
    name: "select_mons",
    description: `Select exactly ${count} cinderling${count > 1 ? "s" : ""} for the team.`,
    input_schema: {
      type: "object" as const,
      properties: { selections: { type: "array" as const, items: { type: "string" as const } } },
      required: ["selections"],
    },
  };
  const msg = await client.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 256,
    system: systemPrompt,
    tools: [selectTool],
    tool_choice: { type: "tool", name: "select_mons" },
    messages: [{ role: "user", content: `Profile: "${description}"${existingNote}\nPick ${count} cinderling${count > 1 ? "s" : ""}.` }],
  });
  const toolUse = msg.content.find((b) => b.type === "tool_use");
  let picked: string[] = [];
  if (toolUse?.type === "tool_use") {
    const input = toolUse.input as { selections?: string[] };
    picked = Array.isArray(input.selections) ? input.selections : [];
  }
  const valid = picked.filter((n) =>
    CINDERLING_LIBRARY.some((v) => v.name.toLowerCase() === n.toLowerCase() && !existing.includes(v.name)),
  );
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

/**
 * Create an AI profile from the practice page — subscriber-gated (not admin-only).
 */
export async function createProfileFromPracticeAction(formData: FormData) {
  const headersList = await headers();
  const session = (await auth.api.getSession({ headers: headersList }))!;
  await requireSubscriber(session.user.id);

  const name = (formData.get("name") as string).trim();
  const description = (formData.get("description") as string | null)?.trim() ?? "";
  const randomnessRaw = formData.get("randomness") as string | null;
  const randomness = randomnessRaw ? Math.max(0, Math.min(1, parseFloat(randomnessRaw))) : 0.5;

  if (!name) throw new Error("Name is required");
  if (!description) throw new Error("Description (prompt) is required");

  const id = nameToSlug(name);
  if (!id) throw new Error("Name must contain at least one letter or digit");

  const teamNamesRaw = (formData.get("teamNames") as string | null) ?? "";
  let teamNames = teamNamesRaw.split(",").map((s) => s.trim()).filter(Boolean);

  const unknown = teamNames.filter(
    (n) => !CINDERLING_LIBRARY.some((v) => v.name.toLowerCase() === n.toLowerCase()),
  );
  if (unknown.length > 0) throw new Error(`Unknown cinderling names: ${unknown.join(", ")}`);

  if (teamNames.length < 8) {
    const autoPicked = await autoSelectMons(description, teamNames, 8 - teamNames.length);
    teamNames = [...teamNames, ...autoPicked];
  }
  if (teamNames.length !== 8) throw new Error("Could not build an 8-cinderling team");

  await createAiProfile({ id, name, teamNames, randomness, description });
  revalidatePath("/practice");
}

/**
 * Fetch the list of active profiles for the practice page picker.
 */
export async function getPracticeProfilesAction(): Promise<
  { id: string; name: string; description: string }[]
> {
  const profiles = await listAiProfiles();
  return profiles.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
  }));
}
