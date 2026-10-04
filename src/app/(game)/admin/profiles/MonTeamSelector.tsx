"use client";

import { useState } from "react";
import Image from "next/image";

export interface CinderlingAttack {
  name: string;
  damage: number;
  energyCost: number;
  range: number;
}

export interface CinderlingData {
  name: string;
  hp: number;
  attack: number;
  speed: number;
  flavor?: string;
  imageUrl?: string;
  powerName?: string;
  powerDescription?: string;
  attacks?: CinderlingAttack[];
}

interface MonTeamSelectorProps {
  cinderlings: CinderlingData[];
  /** 8-slot array of mon names (empty string = empty/auto-fill). */
  slots: string[];
  onChange: (slots: string[]) => void;
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
  color: "green" | "red" | "blue";
}) {
  const pct = Math.min(100, (value / max) * 100);
  const colorClass =
    color === "green"
      ? "bg-green-500"
      : color === "red"
        ? "bg-red-500"
        : "bg-blue-500";
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-gray-400 w-8 shrink-0">{label}</span>
      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${colorClass}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs text-gray-600 w-6 text-right">{value}</span>
    </div>
  );
}

function MonDetailPanel({
  mon,
  isInTeam,
  onPick,
  onClose,
  onBack,
}: {
  mon: CinderlingData;
  isInTeam: boolean;
  onPick: (name: string) => void;
  onClose: () => void;
  onBack?: () => void;
}) {
  return (
    <div className="p-4">
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="text-xs text-gray-500 hover:text-gray-700 mb-3 flex items-center gap-1"
        >
          ← Back
        </button>
      )}
      {mon.imageUrl && (
        <div className="relative w-full aspect-square bg-gray-50 rounded-xl overflow-hidden mb-4">
          <Image
            src={mon.imageUrl}
            alt={mon.name}
            fill
            className="object-contain"
            sizes="300px"
          />
        </div>
      )}
      <p className="font-bold text-base text-gray-900 mb-0.5">{mon.name}</p>
      {mon.flavor && (
        <p className="text-xs text-gray-400 italic mb-4 leading-snug">{mon.flavor}</p>
      )}
      <div className="space-y-2 mb-4">
        <StatBar label="HP" value={mon.hp} max={120} color="green" />
        <StatBar label="ATK" value={mon.attack} max={20} color="red" />
        <StatBar label="SPD" value={mon.speed} max={10} color="blue" />
      </div>
      {mon.attacks && mon.attacks.length > 0 && (
        <div className="mb-4 space-y-1.5">
          {mon.attacks.map((atk) => (
            <div
              key={atk.name}
              className="bg-red-50 border border-red-100 rounded-xl px-3 py-2 flex items-center justify-between"
            >
              <span className="text-xs font-semibold text-red-800">{atk.name}</span>
              <span className="text-[10px] text-gray-500 font-mono">
                {atk.damage} dmg · {atk.energyCost}⚡ · rng {atk.range}
              </span>
            </div>
          ))}
        </div>
      )}
      {mon.powerName && (
        <div className="bg-purple-50 border border-purple-100 rounded-xl p-3 mb-4">
          <p className="text-xs font-bold text-purple-900 mb-0.5">✨ {mon.powerName}</p>
          <p className="text-xs text-purple-700 leading-snug">{mon.powerDescription}</p>
        </div>
      )}
      {isInTeam ? (
        <p className="text-xs text-gray-400 text-center py-2">Already on team</p>
      ) : (
        <button
          type="button"
          onClick={() => { onPick(mon.name); onClose(); }}
          className="w-full bg-blue-600 text-white text-sm font-semibold px-4 py-3 rounded-xl hover:bg-blue-700 transition"
        >
          Add to team
        </button>
      )}
    </div>
  );
}

function MonPickerModal({
  cinderlings,
  selectedNames,
  onPick,
  onClose,
}: {
  cinderlings: CinderlingData[];
  selectedNames: string[];
  onPick: (name: string) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState("");
  const [focused, setFocused] = useState<CinderlingData | null>(null);
  // Mobile: tracks which mon is showing the detail bottom-sheet
  const [mobileFocused, setMobileFocused] = useState<CinderlingData | null>(null);

  const filtered = cinderlings.filter(
    (v) => !search || v.name.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          if (mobileFocused) setMobileFocused(null);
          else onClose();
        }
      }}
    >
      <div className="bg-white w-full sm:max-w-2xl rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 shrink-0">
          <h3 className="font-semibold text-gray-900">
            {mobileFocused ? mobileFocused.name : "Pick a Cinderling"}
          </h3>
          <button
            type="button"
            onClick={() => mobileFocused ? setMobileFocused(null) : onClose()}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none"
          >
            {mobileFocused ? "←" : "×"}
          </button>
        </div>

        {/* Mobile detail view — replaces grid when a mon is tapped */}
        {mobileFocused ? (
          <div className="flex-1 overflow-y-auto sm:hidden">
            <MonDetailPanel
              mon={mobileFocused}
              isInTeam={selectedNames.includes(mobileFocused.name)}
              onPick={onPick}
              onClose={onClose}
              onBack={() => setMobileFocused(null)}
            />
          </div>
        ) : (
          <>
            {/* Search */}
            <div className="px-4 py-2 border-b border-gray-100 shrink-0">
              <input
                type="text"
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search cinderlings…"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>

            {/* Grid + Desktop Detail */}
            <div className="flex flex-1 overflow-hidden">
              {/* Grid */}
              <div className="flex-1 overflow-y-auto p-3">
                <div className="grid grid-cols-5 sm:grid-cols-7 gap-2">
                  {filtered.map((v) => {
                    const isInTeam = selectedNames.includes(v.name);
                    return (
                      <button
                        key={v.name}
                        type="button"
                        onClick={() => {
                          if (!isInTeam) {
                            // Mobile: show detail sheet; Desktop: hover handles focus,
                            // tap still shows detail (not immediate add)
                            setMobileFocused(v);
                            setFocused(v);
                          }
                        }}
                        onMouseEnter={() => setFocused(v)}
                        className={`group relative rounded-xl overflow-hidden transition aspect-square ${
                          isInTeam
                            ? "opacity-40 cursor-not-allowed ring-2 ring-gray-300"
                            : focused?.name === v.name
                              ? "ring-2 ring-blue-500 shadow-md"
                              : "hover:ring-2 hover:ring-blue-300 hover:shadow-sm"
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
                          <div className="w-full h-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white font-bold">
                            {v.name[0]}
                          </div>
                        )}
                        {isInTeam && (
                          <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                            <span className="text-white text-xs font-bold">✓</span>
                          </div>
                        )}
                        <div className="absolute bottom-0 inset-x-0 bg-black/50 py-0.5">
                          <p className="text-[9px] text-white truncate text-center font-medium px-0.5">
                            {v.name}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
                {filtered.length === 0 && (
                  <p className="text-sm text-gray-400 text-center py-8">No results</p>
                )}
              </div>

              {/* Desktop detail panel — hidden on mobile, hover-driven */}
              <div className="hidden sm:block w-52 shrink-0 border-l border-gray-100 overflow-y-auto">
                {focused ? (
                  <MonDetailPanel
                    mon={focused}
                    isInTeam={selectedNames.includes(focused.name)}
                    onPick={onPick}
                    onClose={onClose}
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center h-full p-4 text-center">
                    <p className="text-3xl mb-2">👆</p>
                    <p className="text-xs text-gray-400">Hover a cinderling to preview</p>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function MonTeamSelector({
  cinderlings,
  slots,
  onChange,
}: MonTeamSelectorProps) {
  const [openSlot, setOpenSlot] = useState<number | null>(null);

  function handlePick(name: string) {
    if (openSlot === null) return;
    const next = [...slots];
    next[openSlot] = name;
    onChange(next);
    setOpenSlot(null);
  }

  function clearSlot(i: number, e: React.MouseEvent) {
    e.stopPropagation();
    const next = [...slots];
    next[i] = "";
    onChange(next);
  }

  const filledCount = slots.filter(Boolean).length;
  const selectedNames = slots.filter(Boolean);

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-gray-700">Team</span>
        <span className="text-xs text-gray-400">
          {filledCount} / 8 picked
          {filledCount < 8 && (
            <span className="ml-1 text-gray-400">
              — {8 - filledCount} will be auto-filled
            </span>
          )}
        </span>
      </div>

      {/* 8 slots */}
      <div className="grid grid-cols-4 gap-2">
        {slots.map((name, i) => {
          const mon = name ? cinderlings.find((v) => v.name === name) : null;
          return (
            <button
              key={i}
              type="button"
              onClick={() => setOpenSlot(i)}
              className={`group relative rounded-xl border-2 transition overflow-hidden ${
                name
                  ? "border-gray-200 bg-white hover:border-blue-400"
                  : "border-dashed border-gray-200 bg-gray-50 hover:border-blue-300 hover:bg-blue-50"
              }`}
              style={{ minHeight: 80 }}
            >
              {mon ? (
                <>
                  {mon.imageUrl ? (
                    <div className="relative w-full aspect-square">
                      <Image
                        src={mon.imageUrl}
                        alt={mon.name}
                        fill
                        className="object-cover"
                        sizes="120px"
                      />
                    </div>
                  ) : (
                    <div className="w-full aspect-square bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white font-bold">
                      {mon.name[0]}
                    </div>
                  )}
                  <div className="px-1 py-1 text-center bg-white">
                    <p className="text-[10px] text-gray-700 font-medium truncate">{mon.name}</p>
                  </div>
                  {/* Clear button */}
                  <button
                    type="button"
                    onClick={(e) => clearSlot(i, e)}
                    className="absolute top-1 right-1 w-5 h-5 bg-red-500 rounded-full text-white text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition shadow"
                  >
                    ×
                  </button>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center h-full py-4 gap-1">
                  <span className="text-gray-300 text-xl">+</span>
                  <span className="text-[10px] text-gray-400">Mon {i + 1}</span>
                </div>
              )}
            </button>
          );
        })}
      </div>

      <p className="text-xs text-gray-400 mt-2">
        Click any slot to pick a cinderling. Starters vs. bench are chosen at pregame.
      </p>

      {/* Picker modal */}
      {openSlot !== null && (
        <MonPickerModal
          cinderlings={cinderlings}
          selectedNames={selectedNames}
          onPick={handlePick}
          onClose={() => setOpenSlot(null)}
        />
      )}
    </div>
  );
}
