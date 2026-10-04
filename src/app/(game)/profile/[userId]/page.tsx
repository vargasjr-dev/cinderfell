import { notFound } from "next/navigation";
import { headers } from "next/headers";
import Link from "next/link";
import { auth } from "~/lib/auth.server";
import getPlayerProfile from "~/data/getPlayerProfile.server";

import type { Rank } from "../../../../../lib/ranked";

// ─── Rank display helpers ─────────────────────────────────────────────────────

const RANK_EMOJI: Record<Rank, string> = {
  bronze: "🥉",
  silver: "🥈",
  gold: "🥇",
  platinum: "💠",
  diamond: "💎",
  legend: "👑",
};

const RANK_COLOR: Record<Rank, string> = {
  bronze: "text-amber-700",
  silver: "text-slate-500",
  gold: "text-yellow-600",
  platinum: "text-cyan-600",
  diamond: "text-blue-500",
  legend: "text-purple-600",
};

const RANK_BADGE_BG: Record<Rank, string> = {
  bronze: "bg-amber-100 border-amber-300",
  silver: "bg-slate-100 border-slate-300",
  gold: "bg-yellow-100 border-yellow-300",
  platinum: "bg-cyan-100 border-cyan-300",
  diamond: "bg-blue-100 border-blue-300",
  legend: "bg-purple-100 border-purple-300",
};

function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 text-center">
      <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold mb-1">
        {label}
      </p>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function PlayerProfilePage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  const headersList = await headers();
  const session = (await auth.api.getSession({ headers: headersList }))!;

  const profile = await getPlayerProfile(userId);
  if (!profile) notFound();

  const isOwnProfile = session.user.id === userId;
  const initials = profile.name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const joinedYear = profile.joinedAt.getFullYear();

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      {/* Back link */}
      <div className="mb-6">
        <Link href="/ranked" className="text-sm text-blue-600 hover:underline">
          ← Leaderboard
        </Link>
      </div>

      {/* Profile header card */}
      <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-6 mb-6">
        <div className="flex items-start gap-5">
          {/* Avatar */}
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-400 to-indigo-600 flex items-center justify-center text-white text-2xl font-bold flex-shrink-0 shadow-md">
            {profile.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={profile.image}
                alt={profile.name}
                className="w-full h-full rounded-full object-cover"
              />
            ) : (
              initials
            )}
          </div>

          {/* Name + badges */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <h1 className="text-2xl font-bold text-gray-900 truncate">
                {profile.name}
              </h1>
              {isOwnProfile && (
                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-semibold">
                  You
                </span>
              )}
              {profile.isSubscriber && (
                <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-semibold">
                  ⭐ Pro
                </span>
              )}
            </div>
            {profile.username && (
              <p className="text-sm text-blue-500 font-mono mb-0.5">
                @{profile.username}
              </p>
            )}
            <p className="text-sm text-gray-500">Trainer since {joinedYear}</p>

            {/* Rank badge */}
            <div
              className={`inline-flex items-center gap-2 mt-3 px-3 py-1.5 rounded-lg border text-sm font-semibold ${RANK_BADGE_BG[profile.rank]}`}
            >
              <span className="text-lg">{RANK_EMOJI[profile.rank]}</span>
              <span className={`capitalize ${RANK_COLOR[profile.rank]}`}>
                {profile.rank}
              </span>
              {profile.rank !== "legend" && (
                <span className="text-gray-400">
                  {"⭐".repeat(profile.stars)}
                  {"☆".repeat(Math.max(0, 3 - profile.stars))}
                </span>
              )}
              {profile.rank === "legend" && (
                <span className="text-purple-400 text-xs">
                  #{profile.mmr} MMR
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <StatCard label="Matches" value={profile.totalMatches} sub="all time" />
        <StatCard
          label="Win Rate"
          value={`${profile.winRate}%`}
          sub={`${profile.wins}W / ${profile.losses}L`}
        />
        <StatCard label="Ranked" value={profile.gamesPlayed} sub="PvP games" />
        <StatCard
          label="Cinderlings"
          value={profile.rosterSize}
          sub="collected"
        />
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Link
          href="/matches/new"
          className="flex-1 text-center bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-semibold transition"
        >
          ⚔️ {isOwnProfile ? "Play a Match" : "Challenge"}
        </Link>
        <Link
          href="/ranked"
          className="flex-1 text-center border border-gray-300 text-gray-700 hover:bg-gray-50 py-3 rounded-xl font-semibold transition"
        >
          View Leaderboard
        </Link>
      </div>
    </div>
  );
}
