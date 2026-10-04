"use client";

import { useState } from "react";
import Image from "next/image";
import BuyButton from "./BuyButton";

type FilterKey = "all" | "available" | "owned";

interface AttackInfo {
  key: string;
  name: string;
  damage: number;
  energyCost: number;
  range: number;
}

interface MarketCinderling {
  uuid: string;
  name: string;
  health: number;
  attack: number;
  speed: number;
  energy: number;
  flavor?: string;
  imageUrl?: string;
  isOwned: boolean;
  powerName?: string;
  powerDescription?: string;
  attacks?: AttackInfo[];
}

function AttackList({ attacks }: { attacks?: AttackInfo[] }) {
  if (!attacks || attacks.length === 0) return null;
  return (
    <div className="mb-4">
      <p className="text-xs font-bold text-gray-700 mb-1.5">⚔️ Attacks</p>
      <div className="space-y-1.5">
        {attacks.map((atk) => (
          <div
            key={atk.key}
            className="flex items-center justify-between bg-gray-50 rounded px-2 py-1"
          >
            <span className="text-xs font-medium text-gray-800">{atk.name}</span>
            <div className="flex items-center gap-2 text-[10px] text-gray-500">
              <span title="Damage">💥 {atk.damage}</span>
              <span title="Energy cost">⚡ {atk.energyCost}</span>
              <span title="Range">🎯 {atk.range}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const filters: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "available", label: "Available" },
  { key: "owned", label: "Owned" },
];

export default function MarketGrid({
  cinderlings,
}: {
  cinderlings: MarketCinderling[];
}) {
  const [filter, setFilter] = useState<FilterKey>("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<MarketCinderling | null>(null);

  const filtered = cinderlings.filter((v) => {
    if (filter === "available" && v.isOwned) return false;
    if (filter === "owned" && !v.isOwned) return false;
    if (search && !v.name.toLowerCase().includes(search.toLowerCase()))
      return false;
    return true;
  });

  const ownedCount = cinderlings.filter((v) => v.isOwned).length;

  return (
    <div>
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="flex items-center gap-2">
          {filters.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-3 py-1 rounded-full text-sm font-medium transition ${
                filter === f.key
                  ? "bg-blue-600 text-white"
                  : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-200"
              }`}
            >
              {f.label}
              {f.key === "owned" && ` (${ownedCount})`}
              {f.key === "available" &&
                ` (${cinderlings.length - ownedCount})`}
            </button>
          ))}
        </div>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name..."
          className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 flex-1 min-w-[160px]"
        />
      </div>

      <div className="flex gap-6">
        {/* Avatar Grid */}
        <div className="flex-1">
          {(filter !== "all" || search) && (
            <p className="text-sm text-gray-500 mb-3">
              Showing {filtered.length} of {cinderlings.length}
            </p>
          )}
          <div className="grid grid-cols-5 sm:grid-cols-7 md:grid-cols-8 lg:grid-cols-10 gap-2">
            {filtered.map((v) => (
              <button
                key={v.uuid}
                onClick={() => setSelected(v)}
                className={`group relative rounded-lg overflow-hidden transition aspect-square ${
                  selected?.uuid === v.uuid
                    ? "ring-3 ring-blue-500 shadow-lg"
                    : "hover:ring-2 hover:ring-blue-300 hover:shadow-md"
                } ${v.isOwned ? "opacity-100" : "opacity-80 hover:opacity-100"}`}
              >
                {v.imageUrl ? (
                  <Image
                    src={v.imageUrl}
                    alt={v.name}
                    fill
                    className="object-cover"
                    sizes="80px"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white font-bold text-lg">
                    {v.name[0]}
                  </div>
                )}
                {v.isOwned && (
                  <div className="absolute top-0.5 right-0.5 w-4 h-4 bg-green-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-[8px] font-bold">✓</span>
                  </div>
                )}
                <div className="absolute bottom-0 inset-x-0 bg-black/50 px-1 py-0.5">
                  <p className="text-[9px] text-white truncate text-center font-medium">
                    {v.name}
                  </p>
                </div>
              </button>
            ))}
          </div>

          {filtered.length === 0 && (
            <div className="text-center py-12">
              <p className="text-5xl mb-4">🔍</p>
              <p className="text-gray-500">No cinderlings match your filters.</p>
            </div>
          )}
        </div>

        {/* Detail Panel */}
        <div className="hidden md:block w-72 shrink-0">
          {selected ? (
            <div className="bg-white rounded-xl shadow-lg sticky top-4 overflow-hidden">
              {selected.imageUrl && (
                <div className="relative w-full aspect-square bg-gray-50">
                  <Image
                    src={selected.imageUrl}
                    alt={selected.name}
                    fill
                    className="object-contain"
                    sizes="288px"
                  />
                </div>
              )}
              <div className="p-4">
                <h3 className="text-xl font-bold text-gray-900 mb-1">
                  {selected.name}
                </h3>
                {selected.flavor && (
                  <p className="text-sm text-gray-500 italic mb-4">
                    &ldquo;{selected.flavor}&rdquo;
                  </p>
                )}

                {/* Stat Bars */}
                <div className="space-y-2 mb-4">
                  <StatBar label="HP" value={selected.health} max={120} color="green" />
                  <StatBar label="ATK" value={selected.attack} max={20} color="red" />
                  <StatBar label="SPD" value={selected.speed} max={10} color="blue" />
                </div>

                {/* Attacks */}
                <AttackList attacks={selected.attacks} />

                {/* Special Power */}
                {selected.powerName ? (
                  <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 mb-4">
                    <p className="text-xs font-bold text-purple-900 mb-1">
                      ✨ {selected.powerName}
                    </p>
                    <p className="text-xs text-purple-700">
                      {selected.powerDescription}
                    </p>
                  </div>
                ) : (
                  <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 mb-4">
                    <p className="text-xs text-purple-700 text-center">
                      ✨ Has a unique special power — discover it in battle!
                    </p>
                  </div>
                )}

                {/* Action */}
                {selected.isOwned ? (
                  <div className="w-full bg-green-100 text-green-700 px-4 py-2 rounded text-center font-medium text-sm">
                    ✓ Owned
                  </div>
                ) : (
                  <BuyButton
                    modelUuid={selected.uuid}
                    cinderlingName={selected.name}
                  />
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm p-8 text-center sticky top-4">
              <p className="text-4xl mb-3">👆</p>
              <p className="text-gray-500 text-sm">
                Click a cinderling to see its details
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Mobile Detail Modal */}
      {selected && (
        <div className="md:hidden fixed inset-0 bg-black/50 z-50 flex items-end">
          <div className="bg-white rounded-t-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-bold">{selected.name}</h3>
              <button
                onClick={() => setSelected(null)}
                className="text-gray-400 hover:text-gray-600 text-xl"
              >
                ✕
              </button>
            </div>
            <div className="p-4">
              {selected.imageUrl && (
                <div className="relative w-full aspect-square max-h-48 bg-gray-50 rounded-lg overflow-hidden mb-4">
                  <Image
                    src={selected.imageUrl}
                    alt={selected.name}
                    fill
                    className="object-contain"
                    sizes="(max-width: 768px) 100vw, 288px"
                  />
                </div>
              )}
              {selected.flavor && (
                <p className="text-sm text-gray-500 italic mb-4">
                  &ldquo;{selected.flavor}&rdquo;
                </p>
              )}
              <div className="space-y-2 mb-4">
                <StatBar label="HP" value={selected.health} max={120} color="green" />
                <StatBar label="ATK" value={selected.attack} max={20} color="red" />
                <StatBar label="SPD" value={selected.speed} max={10} color="blue" />
              </div>
              <AttackList attacks={selected.attacks} />
              {selected.powerName && (
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 mb-4">
                  <p className="text-xs font-bold text-purple-900 mb-1">
                    ✨ {selected.powerName}
                  </p>
                  <p className="text-xs text-purple-700">
                    {selected.powerDescription}
                  </p>
                </div>
              )}
              {selected.isOwned ? (
                <div className="w-full bg-green-100 text-green-700 px-4 py-2 rounded text-center font-medium text-sm">
                  ✓ Owned
                </div>
              ) : (
                <BuyButton
                  modelUuid={selected.uuid}
                  cinderlingName={selected.name}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatBar({
  label,
  value,
  max,
  color,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
}) {
  const pct = Math.round((value / max) * 100);
  const colorMap: Record<string, string> = {
    green: "bg-green-500",
    red: "bg-red-500",
    blue: "bg-blue-500",
  };

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-medium text-gray-500 w-8">{label}</span>
      <div className="h-2 bg-gray-200 rounded-full overflow-hidden flex-1">
        <div
          className={`h-full rounded-full ${colorMap[color] || "bg-gray-500"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs font-bold text-gray-700 w-6 text-right">
        {value}
      </span>
    </div>
  );
}
