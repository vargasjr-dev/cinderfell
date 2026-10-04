import { db } from "../data/db";
import { cosmetic } from "../data/schema";
import { spendCredits, getBalance } from "./currency";
import { isSubscriber } from "./subscription";
import type { CosmeticType } from "./cosmetics";

// ─── Credit Costs ────────────────────────────────────────────────────────────

export const GENERATION_COSTS: Record<string, number> = {
  skin: 50,
  vfx_harvest: 30,
  vfx_attack: 30,
  vfx_ko: 30,
  board_theme: 40,
  profile_border: 20,
  title: 10,
};

export function getGenerationCost(type: string): number {
  return GENERATION_COSTS[type] ?? 50;
}

// ─── Generation Types ────────────────────────────────────────────────────────

export type GenerationRequest = {
  userId: string;
  cinderlingId: string | null; // null for global cosmetics
  type: CosmeticType;
  prompt: string;
  styleParams?: {
    colorPalette?: string;
    theme?: string;
    intensity?: number;
  };
};

export type GenerationResult = {
  success: boolean;
  cosmeticId?: string;
  imageUrl?: string;
  error?: string;
  creditCost?: number;
};

// ─── Pre-flight Checks ──────────────────────────────────────────────────────

export async function validateGeneration(
  userId: string,
  type: string,
): Promise<{ valid: boolean; error?: string; cost: number }> {
  const cost = getGenerationCost(type);

  // Must be subscriber
  const subscribed = await isSubscriber(userId);
  if (!subscribed) {
    return {
      valid: false,
      error: "Cinderling Premium subscription required to generate cosmetics.",
      cost,
    };
  }

  // Must have enough credits
  const balance = await getBalance(userId);
  if (balance < cost) {
    return {
      valid: false,
      error: `Insufficient credits: need ${cost}, have ${balance}.`,
      cost,
    };
  }

  return { valid: true, cost };
}

// ─── Image Generation ────────────────────────────────────────────────────────

/**
 * Call Gemini (Nano Banana) to generate a cosmetic image.
 *
 * Requires GEMINI_API_KEY environment variable.
 * Uses the Imagen/Gemini image generation endpoint directly.
 */
async function generateImage(
  prompt: string,
  type: CosmeticType,
  styleParams?: GenerationRequest["styleParams"],
): Promise<{ imageUrl: string } | { error: string }> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return { error: "Image generation not configured (GEMINI_API_KEY missing)" };
  }

  // Build the full prompt with style context
  const styleContext = [
    styleParams?.colorPalette && `color palette: ${styleParams.colorPalette}`,
    styleParams?.theme && `theme: ${styleParams.theme}`,
    styleParams?.intensity !== undefined &&
      `intensity: ${styleParams.intensity}/10`,
  ]
    .filter(Boolean)
    .join(", ");

  const typeContext: Record<string, string> = {
    skin: "game character skin sprite, pixel art style, transparent background",
    vfx_harvest:
      "particle effect animation sprite sheet, sparkles and glow, transparent background",
    vfx_attack:
      "attack impact effect sprite, energy burst, transparent background",
    vfx_ko: "knockout explosion effect sprite, dramatic, transparent background",
    board_theme: "game board tile texture, seamless pattern, top-down view",
    profile_border: "decorative profile frame border, ornate, transparent background",
    title: "stylized text banner, game UI element, transparent background",
  };

  const fullPrompt = [
    typeContext[type] ?? "game cosmetic asset",
    prompt,
    styleContext,
    "high quality digital art, game asset, clean edges",
  ]
    .filter(Boolean)
    .join(". ");

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: `Generate an image: ${fullPrompt}` }],
            },
          ],
          generationConfig: {
            responseModalities: ["IMAGE", "TEXT"],
            responseMimeType: "image/png",
          },
        }),
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Gemini API error:", errorText);
      return { error: "Image generation failed — please try again." };
    }

    const data = await response.json();

    // Extract image data from Gemini response
    const parts = data.candidates?.[0]?.content?.parts ?? [];
    const imagePart = parts.find(
      (p: { inlineData?: { mimeType: string; data: string } }) =>
        p.inlineData?.mimeType?.startsWith("image/"),
    );

    if (!imagePart?.inlineData?.data) {
      return { error: "No image generated — try a different prompt." };
    }

    // Return as base64 data URL for now
    // TODO: Upload to blob storage (Vercel Blob / S3) for persistent URL
    const imageUrl = `data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}`;
    return { imageUrl };
  } catch (err) {
    console.error("Image generation error:", err);
    return { error: "Image generation failed — please try again." };
  }
}

// ─── Main Generation Flow ────────────────────────────────────────────────────

/**
 * Full cosmetic generation pipeline:
 * 1. Validate (subscriber + credits)
 * 2. Generate image via Gemini
 * 3. Store cosmetic record
 * 4. Deduct credits
 */
export async function generateCosmetic(
  request: GenerationRequest,
): Promise<GenerationResult> {
  const { userId, cinderlingId, type, prompt, styleParams } = request;

  // Step 1: Validate
  const validation = await validateGeneration(userId, type);
  if (!validation.valid) {
    return { success: false, error: validation.error, creditCost: validation.cost };
  }

  // Step 2: Generate image
  const imageResult = await generateImage(prompt, type, styleParams);
  if ("error" in imageResult) {
    return { success: false, error: imageResult.error, creditCost: validation.cost };
  }

  // Step 3: Store cosmetic
  const [created] = await db
    .insert(cosmetic)
    .values({
      userId,
      cinderlingId,
      type,
      name: prompt.slice(0, 64), // Use prompt start as default name
      imageUrl: imageResult.imageUrl,
      metadata: { prompt, styleParams, generatedAt: new Date().toISOString() },
      source: "generated",
    })
    .returning({ id: cosmetic.id });

  // Step 4: Deduct credits
  await spendCredits(
    userId,
    validation.cost,
    "spend",
    `Generated ${type}: "${prompt.slice(0, 40)}"`,
  );

  return {
    success: true,
    cosmeticId: created.id,
    imageUrl: imageResult.imageUrl,
    creditCost: validation.cost,
  };
}
