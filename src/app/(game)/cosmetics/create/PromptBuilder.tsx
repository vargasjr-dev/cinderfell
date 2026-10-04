"use client";

import { useState } from "react";
import { generateCosmeticAction, type RosterItem } from "./actions";
import { GENERATION_COSTS } from "../../../../../lib/cosmetic-generator";
import type { CosmeticType } from "../../../../../lib/cosmetics";
import CinderfellPremiumLogo from "~/components/CinderfellPremiumLogo";

const COSMETIC_TYPES: { value: CosmeticType; label: string; needsCinderling: boolean }[] = [
  { value: "skin", label: "🎨 Skin", needsCinderling: true },
  { value: "vfx_harvest", label: "✨ Harvest VFX", needsCinderling: true },
  { value: "vfx_attack", label: "⚡ Attack VFX", needsCinderling: true },
  { value: "vfx_ko", label: "💥 KO VFX", needsCinderling: true },
  { value: "board_theme", label: "🗺️ Board Theme", needsCinderling: false },
  { value: "profile_border", label: "🖼️ Profile Border", needsCinderling: false },
  { value: "title", label: "🏷️ Title", needsCinderling: false },
];

const THEMES = [
  "default",
  "dark",
  "neon",
  "nature",
  "cosmic",
  "retro",
  "candy",
  "ice",
  "fire",
];

const COLOR_PALETTES = [
  "auto",
  "warm",
  "cool",
  "monochrome",
  "rainbow",
  "pastel",
  "neon",
  "earthy",
];

interface PromptBuilderProps {
  roster: RosterItem[];
  balance: number;
  subscribed: boolean;
}

export default function PromptBuilder({
  roster,
  balance,
  subscribed,
}: PromptBuilderProps) {
  const [type, setType] = useState<CosmeticType>("skin");
  const [cinderlingId, setCinderlingId] = useState<string>(roster[0]?.uuid ?? "");
  const [prompt, setPrompt] = useState("");
  const [theme, setTheme] = useState("default");
  const [colorPalette, setColorPalette] = useState("auto");
  const [intensity, setIntensity] = useState(5);
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<{
    imageUrl?: string;
    error?: string;
    cosmeticId?: string;
  } | null>(null);

  const selectedType = COSMETIC_TYPES.find((t) => t.value === type)!;
  const cost = GENERATION_COSTS[type] ?? 50;
  const canAfford = balance >= cost;

  async function handleGenerate() {
    if (!prompt.trim()) return;
    setGenerating(true);
    setResult(null);

    const res = await generateCosmeticAction(
      selectedType.needsCinderling ? cinderlingId : null,
      type,
      prompt.trim(),
      {
        colorPalette: colorPalette !== "auto" ? colorPalette : undefined,
        theme: theme !== "default" ? theme : undefined,
        intensity,
      },
    );

    setResult({
      imageUrl: res.imageUrl,
      error: res.error,
      cosmeticId: res.cosmeticId,
    });
    setGenerating(false);
  }

  if (!subscribed) {
    return (
      <div className="text-center py-12">
        <div className="flex justify-center mb-5">
          <CinderfellPremiumLogo />
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">
          Premium Required
        </h2>
        <p className="text-gray-600 mb-4">
          Subscribe to Cinderling Premium to generate custom cosmetics with AI.
        </p>
        <a
          href="/subscribe"
          className="inline-block px-6 py-3 bg-gradient-to-r from-yellow-400 to-orange-500 text-white font-bold rounded-lg"
        >
          Subscribe — $8/month
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Type Selector */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Cosmetic Type
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {COSMETIC_TYPES.map((t) => (
            <button
              key={t.value}
              onClick={() => setType(t.value)}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition ${
                type === t.value
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              {t.label}
              <span className="block text-xs opacity-70">
                {GENERATION_COSTS[t.value]} 💰
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Cinderling Selector (when needed) */}
      {selectedType.needsCinderling && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select Cinderling
          </label>
          {roster.length === 0 ? (
            <p className="text-gray-500 text-sm">
              No cinderlings in your roster. Visit the Market first!
            </p>
          ) : (
            <select
              value={cinderlingId}
              onChange={(e) => setCinderlingId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              {roster.map((v) => (
                <option key={v.uuid} value={v.uuid}>
                  {v.name}
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      {/* Style Controls */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Theme
          </label>
          <select
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
          >
            {THEMES.map((t) => (
              <option key={t} value={t}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Color Palette
          </label>
          <select
            value={colorPalette}
            onChange={(e) => setColorPalette(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
          >
            {COLOR_PALETTES.map((c) => (
              <option key={c} value={c}>
                {c.charAt(0).toUpperCase() + c.slice(1)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Intensity: {intensity}/10
          </label>
          <input
            type="range"
            min={1}
            max={10}
            value={intensity}
            onChange={(e) => setIntensity(Number(e.target.value))}
            className="w-full"
          />
        </div>
      </div>

      {/* Prompt Input */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Describe your design
        </label>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="A dragon scale armor with glowing blue runes..."
          rows={3}
          maxLength={300}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none"
        />
        <p className="text-xs text-gray-400 mt-1">
          {prompt.length}/300 characters
        </p>
      </div>

      {/* Generate Button */}
      <div className="flex items-center gap-4">
        <button
          onClick={handleGenerate}
          disabled={generating || !prompt.trim() || !canAfford}
          className="px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold rounded-lg shadow-lg hover:from-purple-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          {generating
            ? "Generating…"
            : `🎨 Generate (${cost} 💰)`}
        </button>
        <span className="text-sm text-gray-500">
          Balance: {balance.toLocaleString()} 💰
          {!canAfford && (
            <span className="text-red-500 ml-2">
              (need {cost - balance} more)
            </span>
          )}
        </span>
      </div>

      {/* Result */}
      {result && (
        <div className="mt-6 p-4 bg-gray-50 rounded-xl">
          {result.error ? (
            <div className="text-center">
              <p className="text-red-600 font-medium">{result.error}</p>
            </div>
          ) : (
            <div className="text-center">
              <p className="text-green-600 font-bold mb-3">
                ✅ Cosmetic created! ({cost} 💰 deducted)
              </p>
              {result.imageUrl && (
                <img
                  src={result.imageUrl}
                  alt="Generated cosmetic"
                  className="mx-auto max-w-xs rounded-lg shadow-md"
                />
              )}
              <p className="text-sm text-gray-500 mt-3">
                Find it in your{" "}
                <a href="/cosmetics" className="text-blue-600 hover:underline">
                  Cosmetics Gallery
                </a>
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
