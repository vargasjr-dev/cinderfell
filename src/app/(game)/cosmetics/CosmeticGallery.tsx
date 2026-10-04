"use client";

import { useState } from "react";
import { equipCosmeticAction, type CosmeticItem } from "./actions";

function typeLabel(type: string): string {
  switch (type) {
    case "skin": return "Skin";
    case "vfx_harvest": return "Harvest VFX";
    case "vfx_attack": return "Attack VFX";
    case "vfx_ko": return "KO VFX";
    case "board_theme": return "Board Theme";
    case "profile_border": return "Profile Border";
    case "title": return "Title";
    default: return type;
  }
}

function sourceLabel(source: string): string {
  switch (source) {
    case "generated": return "AI Generated";
    case "seasonal": return "Season Reward";
    case "monthly_drop": return "Monthly Drop";
    case "ranked_reward": return "Ranked Reward";
    default: return source;
  }
}

interface CosmeticGalleryProps {
  cosmetics: CosmeticItem[];
  active: boolean;
  loadouts: Record<string, string | null>;
}

export default function CosmeticGallery({
  cosmetics,
  active,
  loadouts,
}: CosmeticGalleryProps) {
  const [equipping, setEquipping] = useState<string | null>(null);
  const [localLoadouts, setLocalLoadouts] = useState(loadouts);
  const [error, setError] = useState<string | null>(null);

  async function handleEquip(cosmeticId: string, cinderlingId: string) {
    setEquipping(cosmeticId);
    setError(null);

    const isCurrentlyEquipped = localLoadouts[cinderlingId] === cosmeticId;
    const newId = isCurrentlyEquipped ? null : cosmeticId;

    const result = await equipCosmeticAction(cinderlingId, newId);

    if (result.success) {
      setLocalLoadouts((prev) => ({ ...prev, [cinderlingId]: newId }));
    } else {
      setError(result.error ?? "Failed");
    }

    setEquipping(null);
  }

  if (cosmetics.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-5xl mb-4">🎨</div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">
          No cosmetics yet
        </h2>
        <p className="text-gray-600">
          Generate custom skins with the AI Cosmetic Builder (coming soon) or
          earn them through seasons and ranked play.
        </p>
      </div>
    );
  }

  // Group by type
  const grouped = cosmetics.reduce<Record<string, CosmeticItem[]>>(
    (acc, c) => {
      (acc[c.type] ??= []).push(c);
      return acc;
    },
    {},
  );

  return (
    <div className="space-y-8">
      {error && (
        <div className="p-3 bg-red-50 rounded-md text-sm text-red-700">
          {error}
        </div>
      )}

      {!active && (
        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-center">
          <p className="text-yellow-800 font-medium">
            ⭐ Your cosmetics are dormant — resubscribe to unlock them.
          </p>
          <p className="text-yellow-600 text-sm mt-1">
            Your designs are waiting for you.
          </p>
        </div>
      )}

      {Object.entries(grouped).map(([type, items]) => (
        <div key={type}>
          <h3 className="text-lg font-bold text-gray-900 mb-3">
            {typeLabel(type)}
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {items.map((item) => {
              const isEquipped =
                item.cinderlingId !== null &&
                localLoadouts[item.cinderlingId] === item.id;
              const isDormant = !active;

              return (
                <div
                  key={item.id}
                  className={`relative bg-white rounded-lg shadow-md overflow-hidden ${
                    isDormant ? "opacity-50 grayscale" : ""
                  }`}
                >
                  {/* Cosmetic Image */}
                  <div className="aspect-square bg-gray-100 flex items-center justify-center">
                    {item.imageUrl ? (
                      <img
                        src={item.imageUrl}
                        alt={item.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-4xl">🎨</span>
                    )}
                  </div>

                  {/* Info */}
                  <div className="p-3">
                    <p className="font-medium text-sm text-gray-900 truncate">
                      {item.name}
                    </p>
                    <p className="text-xs text-gray-500">
                      {sourceLabel(item.source)}
                    </p>
                  </div>

                  {/* Equip Button (skins only, with cinderlingId) */}
                  {item.type === "skin" && item.cinderlingId && !isDormant && (
                    <div className="px-3 pb-3">
                      <button
                        onClick={() =>
                          handleEquip(item.id, item.cinderlingId!)
                        }
                        disabled={equipping === item.id}
                        className={`w-full px-3 py-1.5 rounded text-xs font-medium transition ${
                          isEquipped
                            ? "bg-green-100 text-green-800 hover:bg-red-100 hover:text-red-800"
                            : "bg-blue-100 text-blue-800 hover:bg-blue-200"
                        } disabled:opacity-50`}
                      >
                        {equipping === item.id
                          ? "..."
                          : isEquipped
                            ? "Equipped ✓"
                            : "Equip"}
                      </button>
                    </div>
                  )}

                  {/* Equipped badge */}
                  {isEquipped && !isDormant && (
                    <div className="absolute top-2 right-2 bg-green-500 text-white text-xs px-2 py-0.5 rounded-full font-medium">
                      Equipped
                    </div>
                  )}

                  {/* Dormant overlay */}
                  {isDormant && (
                    <div className="absolute inset-0 bg-gray-900/30 flex items-center justify-center">
                      <span className="text-xs text-white bg-gray-900/70 px-2 py-1 rounded">
                        Dormant
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
