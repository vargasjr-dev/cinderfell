"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";

type SortKey = "name" | "health" | "attack" | "speed";

interface RosterCinderling {
  uuid: string;
  name: string;
  health: number;
  attack: number;
  speed: number;
  flavor?: string;
  imageUrl?: string;
  powerName?: string;
  powerDescription?: string;
}

const sortOptions: { key: SortKey; label: string }[] = [
  { key: "name", label: "Name" },
  { key: "health", label: "HP" },
  { key: "attack", label: "ATK" },
  { key: "speed", label: "SPD" },
];

export default function RosterGrid({
  roster,
}: {
  roster: RosterCinderling[];
}) {
  const [sortBy, setSortBy] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<RosterCinderling | null>(null);

  const handleSort = (key: SortKey) => {
    if (sortBy === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortBy(key);
      setSortDir(key === "name" ? "asc" : "desc");
    }
  };

  const filtered = roster
    .filter((v) =>
      search ? v.name.toLowerCase().includes(search.toLowerCase()) : true,
    )
    .sort((a, b) => {
      const aVal = a[sortBy];
      const bVal = b[sortBy];
      const cmp =
        typeof aVal === "string"
          ? aVal.localeCompare(bVal as string)
          : (aVal as number) - (bVal as number);
      return sortDir === "asc" ? cmp : -cmp;
    });

  return (
    <div>
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="flex items-center gap-2">
          {sortOptions.map((opt) => (
            <button
              key={opt.key}
              onClick={() => handleSort(opt.key)}
              className={`px-3 py-1 rounded-full text-sm font-medium transition ${
                sortBy === opt.key
                  ? "bg-blue-600 text-white"
                  : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-200"
              }`}
            >
              {opt.label}
              {sortBy === opt.key && (
                <span className="ml-1">{sortDir === "asc" ? "↑" : "↓"}</span>
              )}
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

      {search && (
        <p className="text-sm text-gray-500 mb-3">
          Showing {filtered.length} of {roster.length}
        </p>
      )}

      <div className="flex gap-6">
        {/* Avatar Grid */}
        <div className="flex-1">
          <div className="grid grid-cols-5 sm:grid-cols-7 md:grid-cols-8 lg:grid-cols-10 gap-2">
            {filtered.map((v) => (
              <button
                key={v.uuid}
                onClick={() => setSelected(v)}
                className={`group relative rounded-lg overflow-hidden transition aspect-square ${
                  selected?.uuid === v.uuid
                    ? "ring-3 ring-blue-500 shadow-lg"
                    : "hover:ring-2 hover:ring-blue-300 hover:shadow-md"
                }`}
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
              <p className="text-gray-500">No cinderlings match your search.</p>
            </div>
          )}
        </div>

        {/* Detail Panel (desktop) */}
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
                <div className="space-y-2 mb-4">
                  <StatBar label="HP" value={selected.health} max={120} color="green" />
                  <StatBar label="ATK" value={selected.attack} max={20} color="red" />
                  <StatBar label="SPD" value={selected.speed} max={10} color="blue" />
                </div>
                {selected.powerName && (
                  <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                    <p className="text-xs font-bold text-purple-900 mb-1">
                      ✨ {selected.powerName}
                    </p>
                    <p className="text-xs text-purple-700">
                      {selected.powerDescription}
                    </p>
                  </div>
                )}
                <Link
                  href={`/roster/${selected.uuid}`}
                  className="block text-center text-sm text-blue-600 hover:text-blue-800 font-medium mt-3 py-2 border border-blue-200 rounded-lg hover:bg-blue-50 transition"
                >
                  View Full Page →
                </Link>
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
              {selected.powerName && (
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                  <p className="text-xs font-bold text-purple-900 mb-1">
                    ✨ {selected.powerName}
                  </p>
                  <p className="text-xs text-purple-700">
                    {selected.powerDescription}
                  </p>
                </div>
              )}
              <Link
                href={`/roster/${selected.uuid}`}
                className="block text-center text-sm text-blue-600 hover:text-blue-800 font-medium mt-4 py-2 border border-blue-200 rounded-lg hover:bg-blue-50 transition"
              >
                View Full Page →
              </Link>
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
