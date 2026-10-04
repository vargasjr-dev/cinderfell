"use client";

import { useState } from "react";
import { claimRewardAction, type TrackTier } from "./actions";
import type { SeasonProgressSummary } from "../../../../lib/seasons";

function rewardLabel(reward: unknown): string {
  if (!reward) return "—";
  const r = reward as Record<string, unknown>;
  if (r.type === "credits") return `${r.amount} 💰`;
  if (r.type === "cosmetic") return `🎨 ${r.description ?? "Cosmetic"}`;
  if (r.type === "title") return `🏷️ ${r.description ?? "Title"}`;
  if (r.type === "vellymon") return `🐉 ${r.description ?? "New Cinderling"}`;
  if (r.description) return String(r.description);
  return "🎁 Reward";
}

interface SeasonTrackProps {
  progress: SeasonProgressSummary;
  track: TrackTier[];
  subscribed: boolean;
}

export default function SeasonTrack({
  progress,
  track,
  subscribed,
}: SeasonTrackProps) {
  const [claimedFree, setClaimedFree] = useState<number[]>(
    progress.claimedFreeTiers,
  );
  const [claimedPremium, setClaimedPremium] = useState<number[]>(
    progress.claimedPremiumTiers,
  );
  const [claiming, setClaiming] = useState<string | null>(null);

  async function handleClaim(tier: number, trackType: "free" | "premium") {
    const key = `${trackType}-${tier}`;
    setClaiming(key);

    const result = await claimRewardAction(
      progress.seasonId,
      tier,
      trackType,
    );

    if (result.success) {
      if (trackType === "free") {
        setClaimedFree((prev) => [...prev, tier]);
      } else {
        setClaimedPremium((prev) => [...prev, tier]);
      }
    }

    setClaiming(null);
  }

  return (
    <div className="space-y-6">
      {/* Progress Bar */}
      <div className="bg-white rounded-xl shadow-md p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">
            Tier {progress.currentTier} / {progress.maxTier}
          </span>
          <span className="text-sm text-gray-500">
            {progress.xp.toLocaleString()} ⚡️
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-3">
          <div
            className="bg-gradient-to-r from-blue-500 to-purple-600 h-3 rounded-full transition-all duration-500"
            style={{ width: `${progress.progressPercent}%` }}
          />
        </div>
        <div className="flex items-center justify-between mt-1">
          <span className="text-xs text-gray-400">
            {progress.xpInCurrentTier} / {progress.xpForNextTier} to next tier
          </span>
          <span className="text-xs text-orange-500 font-medium">
            ⏳ {progress.daysRemaining} days left
          </span>
        </div>
      </div>

      {/* Track — horizontal scroll */}
      <div className="overflow-x-auto pb-4">
        <div className="flex gap-3" style={{ minWidth: `${track.length * 140}px` }}>
          {track.map((t) => {
            const reached = progress.currentTier >= t.tier;
            const freeClaimed = claimedFree.includes(t.tier);
            const premiumClaimed = claimedPremium.includes(t.tier);
            const isCurrentTier = progress.currentTier === t.tier;

            return (
              <div
                key={t.tier}
                className={`flex-shrink-0 w-32 rounded-xl border-2 overflow-hidden transition-all ${
                  isCurrentTier
                    ? "border-yellow-400 shadow-lg shadow-yellow-200"
                    : reached
                      ? "border-green-300"
                      : "border-gray-200 opacity-60"
                }`}
              >
                {/* Tier Header */}
                <div
                  className={`px-3 py-1.5 text-center text-xs font-bold ${
                    reached
                      ? "bg-gradient-to-r from-blue-500 to-purple-600 text-white"
                      : "bg-gray-100 text-gray-400"
                  }`}
                >
                  Tier {t.tier}
                </div>

                {/* Free Row */}
                <div className="px-2 py-2 border-b border-gray-100">
                  <p className="text-[10px] text-gray-400 uppercase font-semibold mb-1">
                    Free
                  </p>
                  <p className="text-xs font-medium text-gray-700 truncate mb-1">
                    {rewardLabel(t.freeReward)}
                  </p>
                  {t.freeReward != null && reached && !freeClaimed && (
                    <button
                      onClick={() => handleClaim(t.tier, "free")}
                      disabled={claiming === `free-${t.tier}`}
                      className="w-full px-2 py-1 text-[10px] font-bold bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50 transition"
                    >
                      {claiming === `free-${t.tier}` ? "…" : "Claim"}
                    </button>
                  )}
                  {freeClaimed && (
                    <span className="text-[10px] text-green-600 font-medium">
                      ✅ Claimed
                    </span>
                  )}
                </div>

                {/* Premium Row */}
                <div className="px-2 py-2 bg-gradient-to-b from-yellow-50 to-white">
                  <p className="text-[10px] text-yellow-600 uppercase font-semibold mb-1">
                    ⭐ Premium
                  </p>
                  <p
                    className={`text-xs font-medium truncate mb-1 ${
                      subscribed ? "text-gray-700" : "text-gray-400"
                    }`}
                  >
                    {rewardLabel(t.premiumReward)}
                  </p>
                  {t.premiumReward != null &&
                    reached &&
                    subscribed &&
                    !premiumClaimed && (
                      <button
                        onClick={() => handleClaim(t.tier, "premium")}
                        disabled={claiming === `premium-${t.tier}`}
                        className="w-full px-2 py-1 text-[10px] font-bold bg-yellow-500 text-white rounded hover:bg-yellow-600 disabled:opacity-50 transition"
                      >
                        {claiming === `premium-${t.tier}` ? "…" : "Claim"}
                      </button>
                    )}
                  {premiumClaimed && (
                    <span className="text-[10px] text-yellow-600 font-medium">
                      ✅ Claimed
                    </span>
                  )}
                  {!subscribed && t.premiumReward != null && (
                    <span className="text-[10px] text-gray-400">🔒 Sub required</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
