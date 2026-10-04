"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useToast } from "~/components/Toast";
import { queueForMatchAction } from "../matches/actions";
import type { RankSummary } from "../../../../lib/rank-rewards";
import type { Rank } from "../../../../lib/ranked";
import type { LeaderboardRow } from "./actions";

// ─── Rank display helpers ────────────────────────────────────────────────────

const RANK_EMOJI: Record<Rank, string> = {
  bronze: "🥉",
  silver: "🥈",
  gold: "🥇",
  platinum: "💠",
  diamond: "💎",
  legend: "👑",
};

const RANK_BG: Record<Rank, string> = {
  bronze: "from-amber-50 to-orange-50 border-amber-200",
  silver: "from-slate-50 to-gray-100 border-slate-300",
  gold: "from-yellow-50 to-amber-50 border-yellow-300",
  platinum: "from-cyan-50 to-teal-50 border-cyan-300",
  diamond: "from-blue-50 to-indigo-50 border-blue-300",
  legend: "from-purple-50 to-pink-50 border-purple-300",
};

const RANK_COLOR: Record<Rank, string> = {
  bronze: "text-amber-700",
  silver: "text-slate-500",
  gold: "text-yellow-600",
  platinum: "text-cyan-600",
  diamond: "text-blue-500",
  legend: "text-purple-600",
};

// ─── Types ───────────────────────────────────────────────────────────────────

type CinderlingSlot = {
  uuid: string;
  slotIndex: number;
  cinderling: {
    name: string;
    health: number;
    attack: number;
    speed: number;
    imageUrl?: string;
  } | null;
};

type Team = {
  uuid: string;
  name: string;
  slots: CinderlingSlot[];
};

type Props = {
  teams: Team[];
  summary: RankSummary | null;
  leaderboard: LeaderboardRow[];
  seasonName: string;
  starsPerRank: Record<Rank, number>;
};

// ─── CinderlingAvatar ──────────────────────────────────────────────────────────

function CinderlingAvatar({
  slot,
  size = "sm",
}: {
  slot: CinderlingSlot;
  size?: "sm" | "md" | "lg";
}) {
  const sizeClass =
    size === "lg" ? "w-14 h-14" : size === "md" ? "w-12 h-12" : "w-7 h-7";
  const textClass =
    size === "lg" ? "text-[9px]" : size === "md" ? "text-[8px]" : "text-[6px]";

  return (
    <div
      className={`${sizeClass} rounded-md overflow-hidden bg-gray-100 border border-gray-200 relative flex-shrink-0`}
      title={slot.cinderling?.name ?? "?"}
    >
      {slot.cinderling?.imageUrl ? (
        <Image
          src={slot.cinderling.imageUrl}
          alt={slot.cinderling.name}
          fill
          sizes="56px"
          className="object-cover"
        />
      ) : (
        <div
          className={`w-full h-full flex items-center justify-center text-gray-500 font-bold ${textClass}`}
        >
          {slot.cinderling?.name?.slice(0, 3) ?? "?"}
        </div>
      )}
    </div>
  );
}

// ─── StarRow ─────────────────────────────────────────────────────────────────

function StarRow({ stars, max }: { stars: number; max: number }) {
  return (
    <div className="flex gap-0.5 mt-1">
      {Array.from({ length: max }).map((_, i) => (
        <span
          key={i}
          className={`text-sm ${i < stars ? "opacity-100" : "opacity-20"}`}
        >
          ⭐
        </span>
      ))}
    </div>
  );
}

// ─── LeaderboardPanel (renders inside right panel) ───────────────────────────

function LeaderboardPanel({
  leaderboard,
  seasonName,
  onClose,
}: {
  leaderboard: LeaderboardRow[];
  seasonName: string;
  onClose: () => void;
}) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-[10px] text-gray-400 uppercase tracking-widest font-semibold">
            {seasonName}
          </p>
          <h2 className="text-lg font-bold text-gray-900">🏆 Leaderboard</h2>
        </div>
        <button
          onClick={onClose}
          className="text-xs text-gray-400 hover:text-gray-700 transition px-2 py-1 rounded hover:bg-gray-100"
        >
          ✕ Close
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-white border-b border-gray-100">
            <tr>
              <th className="py-2 px-1 text-left font-semibold text-gray-500 text-xs">
                #
              </th>
              <th className="py-2 px-2 text-left font-semibold text-gray-500 text-xs">
                Player
              </th>
              <th className="py-2 px-2 text-center font-semibold text-gray-500 text-xs">
                Rank
              </th>
              <th className="py-2 px-2 text-center font-semibold text-gray-500 text-xs">
                W/L
              </th>
              <th className="py-2 px-1 text-right font-semibold text-gray-500 text-xs">
                MMR
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {leaderboard.map((entry, i) => (
              <tr key={entry.userId} className="hover:bg-gray-50 transition">
                <td className="py-2 px-1 text-gray-400 font-mono text-xs">
                  {i + 1}
                </td>
                <td className="py-2 px-2 font-medium text-gray-900 text-xs truncate max-w-[80px]">
                  {entry.username}
                </td>
                <td className="py-2 px-2 text-center text-xs">
                  {RANK_EMOJI[entry.rank]}{" "}
                  {entry.rank !== "legend" && "⭐".repeat(entry.stars)}
                </td>
                <td className="py-2 px-2 text-center text-gray-600 text-xs">
                  {entry.wins}/{entry.losses}
                </td>
                <td className="py-2 px-1 text-right font-mono text-gray-900 text-xs">
                  {entry.mmr}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function RankedPlayPage({
  teams,
  summary,
  leaderboard,
  seasonName,
  starsPerRank,
}: Props) {
  const router = useRouter();
  const { addToast } = useToast();

  const [selectedTeamUuid, setSelectedTeamUuid] = useState<string | null>(
    teams.length === 1 ? teams[0].uuid : null,
  );
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(6);
  const [searching, setSearching] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);

  // Responsive page size: 9 on desktop (lg+), 6 on mobile
  useEffect(() => {
    const update = () => setPageSize(window.innerWidth >= 1024 ? 9 : 6);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  // Reset to page 0 when page size changes to avoid ghost pages
  useEffect(() => {
    setPage(0);
  }, [pageSize]);

  const totalPages = Math.ceil(teams.length / pageSize);
  const pagedTeams = teams.slice(page * pageSize, (page + 1) * pageSize);
  const selectedTeam = teams.find((t) => t.uuid === selectedTeamUuid) ?? null;

  const rank = summary?.rank ?? "bronze";
  const stars = summary?.stars ?? 0;
  const maxStars = starsPerRank[rank] ?? 3;

  const handleQueue = async () => {
    if (!selectedTeamUuid) {
      addToast("Select a team first", "error");
      return;
    }
    setSearching(true);
    try {
      const result = await queueForMatchAction(selectedTeamUuid);
      if (result.success) {
        if (result.matched) {
          addToast("Opponent found! Starting match…", "success");
          router.push(`/matches/${result.matchUuid}/play`);
        } else {
          addToast("Searching for an opponent…", "success");
          router.push(`/matches/${result.matchUuid}`);
        }
        router.refresh();
      } else {
        addToast(result.message, "error");
        setSearching(false);
      }
    } catch {
      addToast("Failed to queue for match", "error");
      setSearching(false);
    }
  };

  // ── No teams state ────────────────────────────────────────────────────────
  if (teams.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 text-center px-4">
        <div className="text-6xl">⚔️</div>
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            No teams yet
          </h2>
          <p className="text-gray-600 mb-6">
            Build a team before entering the arena.
          </p>
          <Link
            href="/roster/teams/new"
            className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition"
          >
            Build a Team
          </Link>
        </div>
      </div>
    );
  }

  // ── Main layout ───────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col lg:flex-row bg-gray-50 lg:h-[calc(100dvh-56px)]">
      {/* ── LEFT: Team Picker ────────────────────────────────────────────── */}
      <div className="flex flex-col lg:w-[58%] lg:h-full lg:overflow-y-auto p-4 sm:p-6 gap-4">
        {/* Header */}
        <h1 className="text-xl font-bold text-gray-900">Choose Your Team</h1>

        {/* Team grid — 3 columns always, 2 rows mobile (6) / 3 rows desktop (9) */}
        <div className="grid grid-cols-3 gap-3">
          {pagedTeams.map((team) => {
            const isSelected = selectedTeamUuid === team.uuid;

            return (
              <button
                key={team.uuid}
                onClick={() => {
                  setSelectedTeamUuid(team.uuid);
                  setShowLeaderboard(false);
                }}
                disabled={searching}
                className={`relative flex flex-col gap-2 rounded-xl border-2 p-3 text-left transition-all ${
                  isSelected
                    ? "border-blue-500 bg-white shadow-md ring-2 ring-blue-200"
                    : "border-gray-200 bg-white hover:border-blue-300 hover:shadow-sm"
                } disabled:opacity-50`}
              >
                {/* Team name */}
                <p className="font-semibold text-xs text-gray-900 truncate">
                  {team.name}
                </p>

                {/* All cinderlings — 4 cols × up to 2 rows */}
                <div className="grid grid-cols-4 gap-1">
                  {team.slots.slice(0, 8).map((slot) => (
                    <CinderlingAvatar key={slot.uuid} slot={slot} size="sm" />
                  ))}
                  {/* Placeholders for empty slots */}
                  {Array.from({
                    length: Math.max(0, 4 - team.slots.length),
                  }).map((_, i) => (
                    <div
                      key={`empty-${i}`}
                      className="w-7 h-7 rounded-md bg-gray-100 border border-dashed border-gray-200"
                    />
                  ))}
                </div>

                {/* Selected indicator */}
                {isSelected && (
                  <span className="absolute top-2 right-2 text-[9px] bg-blue-600 text-white px-1.5 py-0.5 rounded-full font-semibold">
                    ✓
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Pagination + nav links */}
        <div className="flex items-center justify-between mt-auto pt-1">
          <Link
            href="/roster/teams/new"
            className="text-xs text-blue-600 hover:text-blue-800 font-medium transition"
          >
            + New team
          </Link>

          {totalPages > 1 && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="w-7 h-7 rounded-full bg-white border border-gray-200 text-gray-500 hover:border-blue-400 hover:text-blue-600 disabled:opacity-30 transition flex items-center justify-center text-xs"
              >
                ‹
              </button>
              <span className="text-xs text-gray-400">
                {page + 1}/{totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page === totalPages - 1}
                className="w-7 h-7 rounded-full bg-white border border-gray-200 text-gray-500 hover:border-blue-400 hover:text-blue-600 disabled:opacity-30 transition flex items-center justify-center text-xs"
              >
                ›
              </button>
            </div>
          )}

          <Link
            href="/roster"
            className="text-xs text-gray-400 hover:text-gray-600 transition"
          >
            Edit teams →
          </Link>
        </div>
      </div>

      {/* ── RIGHT: Rank card + Preview + Play ───────────────────────────── */}
      <div className="flex flex-col lg:w-[42%] lg:h-full bg-white border-t lg:border-t-0 lg:border-l border-gray-200 p-4 sm:p-6 gap-4 overflow-hidden">
        {showLeaderboard ? (
          /* ── Leaderboard overlay ──────────────────────────────────────── */
          <LeaderboardPanel
            leaderboard={leaderboard}
            seasonName={seasonName}
            onClose={() => setShowLeaderboard(false)}
          />
        ) : (
          /* ── Normal view ──────────────────────────────────────────────── */
          <>
            {/* Rank card — click → leaderboard */}
            <button
              onClick={() => setShowLeaderboard(true)}
              className={`w-full text-left bg-gradient-to-br ${RANK_BG[rank]} border-2 rounded-xl p-4 transition hover:shadow-md group flex-shrink-0`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-3xl" aria-label={rank}>
                    {RANK_EMOJI[rank]}
                  </span>
                  <div>
                    <p className="text-[10px] text-gray-400 uppercase tracking-widest font-semibold">
                      {seasonName}
                    </p>
                    <p
                      className={`text-lg font-bold capitalize ${RANK_COLOR[rank]}`}
                    >
                      {rank}
                    </p>
                    {rank !== "legend" ? (
                      <StarRow stars={stars} max={maxStars} />
                    ) : (
                      <p className="text-xs text-purple-500 font-semibold mt-1">
                        #{summary?.mmr ?? 1000} MMR
                      </p>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-400">W/L</p>
                  <p className="text-sm font-bold text-gray-700">
                    {summary?.wins ?? 0}/{summary?.losses ?? 0}
                  </p>
                  <p className="text-[10px] text-gray-400 mt-1 group-hover:text-blue-500 transition">
                    Leaderboard →
                  </p>
                </div>
              </div>
            </button>

            {/* Selected team preview — fills remaining space */}
            <div className="flex-1 overflow-hidden flex flex-col min-h-0">
              {selectedTeam ? (
                <div className="flex flex-col gap-3 h-full">
                  <h2 className="text-base font-bold text-gray-900 flex-shrink-0">
                    {selectedTeam.name}
                  </h2>

                  {/* All cinderlings — 4 col grid, 2 rows of 4 */}
                  <div className="grid grid-cols-4 gap-2 flex-1 content-start">
                    {selectedTeam.slots.map((slot) => (
                      <div
                        key={slot.uuid}
                        className="flex flex-col items-center gap-1 bg-gray-50 rounded-lg p-2 border border-gray-100"
                      >
                        <CinderlingAvatar slot={slot} size="md" />
                        <p className="text-[9px] font-semibold text-gray-700 text-center leading-tight truncate w-full">
                          {slot.cinderling?.name ?? "?"}
                        </p>
                        {slot.cinderling && (
                          <div className="flex flex-col gap-0.5 text-[8px] text-gray-400 text-center">
                            <span>❤️ {slot.cinderling.health}</span>
                            <span>⚔️ {slot.cinderling.attack}</span>
                            <span>⚡ {slot.cinderling.speed}</span>
                          </div>
                        )}
                      </div>
                    ))}

                    {/* Empty slot placeholders up to 8 */}
                    {Array.from({
                      length: Math.max(0, 4 - selectedTeam.slots.length),
                    }).map((_, i) => (
                      <div
                        key={`empty-${i}`}
                        className="flex items-center justify-center bg-gray-50 rounded-lg border border-dashed border-gray-200 min-h-[80px]"
                      >
                        <span className="text-gray-300 text-[9px]">Empty</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center">
                  <p className="text-gray-400 text-sm text-center">
                    ← Select a team to preview
                  </p>
                </div>
              )}
            </div>

            {/* Play button + match history link */}
            <div className="flex-shrink-0 flex flex-col items-center gap-3 pt-1">
              <button
                onClick={handleQueue}
                disabled={searching || !selectedTeamUuid}
                className={`relative w-32 h-32 rounded-full font-black text-lg text-white shadow-xl transition-all
                  ${
                    selectedTeamUuid && !searching
                      ? "bg-blue-600 hover:bg-blue-500 hover:scale-105 active:scale-95 cursor-pointer"
                      : "bg-gray-300 cursor-not-allowed"
                  }
                `}
              >
                {selectedTeamUuid && !searching && (
                  <span className="absolute inset-0 rounded-full bg-blue-400 opacity-30 animate-ping" />
                )}
                <span className="relative">
                  {searching ? (
                    <span className="flex flex-col items-center gap-1 text-sm font-bold">
                      <span className="animate-spin text-2xl">⚙️</span>
                      Searching
                    </span>
                  ) : (
                    "▶ Play"
                  )}
                </span>
              </button>

              {!selectedTeamUuid && (
                <p className="text-xs text-gray-400">Select a team to play</p>
              )}

              <Link
                href="/ranked/history"
                className="text-xs text-gray-400 hover:text-gray-600 transition self-end"
              >
                Match History →
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
