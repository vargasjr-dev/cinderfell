"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createProfileSparringMatchAction, createProfileFromPracticeAction } from "./actions";
import { MAP_OPTIONS } from "~/lib/matchSettings";
import CinderlingPremiumLogo from "~/components/CinderlingPremiumLogo";
import MonTeamSelector, { type CinderlingData } from "../admin/profiles/MonTeamSelector";

type TeamOption = { uuid: string; name: string };
type ProfileOption = { id: string; name: string; description: string };

interface PracticeSetupProps {
  teams: TeamOption[];
  subscribed: boolean;
  profiles: ProfileOption[];
  cinderlings: CinderlingData[];
}

// ── Paywall ───────────────────────────────────────────────────────────────────
function PremiumGate() {
  return (
    <div className="text-center py-12">
      <div className="flex justify-center mb-5">
        <CinderlingPremiumLogo />
      </div>
      <h2 className="text-xl font-bold text-gray-900 mb-2">Premium Required</h2>
      <p className="text-gray-600 mb-4">
        Practice Mode is a Premium feature — subscribe to battle custom
        opponent profiles and sharpen your strategy.
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

// ── No teams ──────────────────────────────────────────────────────────────────
function NoTeamsGate() {
  return (
    <div className="text-center py-12">
      <div className="text-5xl mb-4">🏗️</div>
      <h2 className="text-xl font-bold text-gray-900 mb-2">No Teams Yet</h2>
      <p className="text-gray-600 mb-4">
        Build a team first, then come back for sparring practice.
      </p>
      <a
        href="/roster"
        className="inline-block px-6 py-3 bg-blue-600 text-white font-bold rounded-lg"
      >
        Build a Team
      </a>
    </div>
  );
}

// ── No profiles ───────────────────────────────────────────────────────────────
function NoProfilesGate() {
  return (
    <div className="text-center py-10 text-gray-500">
      <p className="text-4xl mb-3">🥊</p>
      <p className="font-medium text-gray-700">No opponent profiles yet</p>
      <p className="text-sm mt-1">
        AI profiles are coming soon — check back shortly.
      </p>
    </div>
  );
}

// ── Play tab ──────────────────────────────────────────────────────────────────
function PlayTab({
  teams,
  profiles,
}: {
  teams: TeamOption[];
  profiles: ProfileOption[];
}) {
  const router = useRouter();
  const [teamUuid, setTeamUuid] = useState(teams[0]?.uuid ?? "");
  const [profileId, setProfileId] = useState(profiles[0]?.id ?? "");
  const [mapId, setMapId] = useState("standard");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleStart() {
    if (!teamUuid || !profileId) return;
    setCreating(true);
    setError(null);

    const result = await createProfileSparringMatchAction(teamUuid, profileId, mapId);

    if (result.success) {
      router.push(`/matches/${result.matchUuid}/play`);
    } else {
      setError(result.error);
      setCreating(false);
    }
  }

  if (profiles.length === 0) return <NoProfilesGate />;

  return (
    <div className="space-y-6">
      {/* Your Team */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Your Team
        </label>
        <select
          value={teamUuid}
          onChange={(e) => setTeamUuid(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
        >
          {teams.map((t) => (
            <option key={t.uuid} value={t.uuid}>
              {t.name}
            </option>
          ))}
        </select>
      </div>

      {/* Opponent profile */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Opponent
        </label>
        <div className="space-y-2">
          {profiles.map((p) => (
            <button
              key={p.id}
              onClick={() => setProfileId(p.id)}
              className={`w-full text-left p-3 rounded-xl border-2 transition ${
                profileId === p.id
                  ? "border-orange-400 bg-orange-50"
                  : "border-gray-200 bg-white hover:border-gray-300"
              }`}
            >
              <span className="font-semibold text-sm text-gray-900">{p.name}</span>
              {p.description && (
                <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">
                  {p.description}
                </p>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Map */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Map</label>
        <div className="grid grid-cols-2 gap-3">
          {MAP_OPTIONS.map((m) => (
            <button
              key={m.id}
              onClick={() => setMapId(m.id)}
              className={`p-3 rounded-lg border-2 text-left transition ${
                mapId === m.id
                  ? "border-blue-500 bg-blue-50"
                  : "border-gray-200 bg-white hover:border-gray-300"
              }`}
            >
              <span className="font-medium text-sm text-gray-900">{m.name}</span>
              <span className="text-xs text-gray-400 ml-2">{m.dimensions}</span>
              <p className="text-xs text-gray-500 mt-0.5">{m.description}</p>
            </button>
          ))}
        </div>
      </div>

      {error && <p className="text-red-600 text-sm">{error}</p>}

      <button
        onClick={handleStart}
        disabled={creating || !teamUuid || !profileId}
        className="w-full px-6 py-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white text-lg font-bold rounded-xl shadow-lg hover:from-green-600 hover:to-emerald-700 disabled:opacity-50 transition-all"
      >
        {creating ? "Setting up match…" : "🥊 Start Practice"}
      </button>

      <p className="text-xs text-gray-400 text-center">
        Practice Mode has no ranked impact. Train freely!
      </p>
    </div>
  );
}

// ── Watch tab ─────────────────────────────────────────────────────────────────
type SimResult = {
  matchId: string;
  spectateUrl: string;
  winner: string | null;
  turns: number;
  simulationMs: number;
  remaining: number;
  limit: number;
};

function WatchTab({ profiles }: { profiles: ProfileOption[] }) {
  const [p1Id, setP1Id] = useState(profiles[0]?.id ?? "");
  const [p2Id, setP2Id] = useState(profiles[1]?.id ?? profiles[0]?.id ?? "");
  const [simulating, setSimulating] = useState(false);
  const [result, setResult] = useState<SimResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSimulate() {
    if (!p1Id || !p2Id) return;
    setSimulating(true);
    setResult(null);
    setError(null);

    try {
      const res = await fetch("/api/practice/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ p1ProfileId: p1Id, p2ProfileId: p2Id }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Simulation failed");
      } else {
        setResult(data as SimResult);
      }
    } catch {
      setError("Network error — please try again");
    } finally {
      setSimulating(false);
    }
  }

  if (profiles.length < 2) {
    return (
      <div className="text-center py-10 text-gray-500">
        <p className="text-4xl mb-3">🥊</p>
        <p className="font-medium text-gray-700">Not enough profiles yet</p>
        <p className="text-sm mt-1">
          At least 2 AI profiles are needed for a Watch simulation.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-gray-500">
        Pick two AI profiles — we&apos;ll run a full match server-side and give
        you a spectate link. Up to{" "}
        <span className="font-semibold text-gray-700">10 simulations / day</span>.
      </p>

      {/* Profile pickers */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Profile 1
          </label>
          <div className="space-y-2">
            {profiles.map((p) => (
              <button
                key={p.id}
                onClick={() => setP1Id(p.id)}
                className={`w-full text-left p-3 rounded-xl border-2 transition ${
                  p1Id === p.id
                    ? "border-blue-500 bg-blue-50"
                    : "border-gray-200 bg-white hover:border-gray-300"
                }`}
              >
                <span className="font-semibold text-sm text-gray-900 block">
                  {p.name}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Profile 2
          </label>
          <div className="space-y-2">
            {profiles.map((p) => (
              <button
                key={p.id}
                onClick={() => setP2Id(p.id)}
                className={`w-full text-left p-3 rounded-xl border-2 transition ${
                  p2Id === p.id
                    ? "border-orange-400 bg-orange-50"
                    : "border-gray-200 bg-white hover:border-gray-300"
                }`}
              >
                <span className="font-semibold text-sm text-gray-900 block">
                  {p.name}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && <p className="text-red-600 text-sm">{error}</p>}

      {/* Result */}
      {result && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5">
          <p className="text-sm font-semibold text-emerald-700 mb-1">
            ✅ Simulation complete — {result.turns} turns
          </p>
          <p className="text-sm text-gray-600 mb-3">
            {result.winner ? (
              <>
                <span className="font-bold text-gray-900">{result.winner}</span>{" "}
                wins!
              </>
            ) : (
              "Draw — both teams held on!"
            )}
          </p>
          <div className="flex items-center gap-3">
            <Link
              href={result.spectateUrl}
              className="px-4 py-2 bg-emerald-600 text-white text-sm font-bold rounded-lg hover:bg-emerald-700 transition"
            >
              👁 Watch Replay →
            </Link>
            <span className="text-xs text-gray-400">
              {result.remaining} simulation{result.remaining !== 1 ? "s" : ""} remaining today
            </span>
          </div>
        </div>
      )}

      <button
        onClick={handleSimulate}
        disabled={simulating || !p1Id || !p2Id}
        className="w-full px-6 py-4 bg-gradient-to-r from-purple-500 to-indigo-600 text-white text-lg font-bold rounded-xl shadow-lg hover:from-purple-600 hover:to-indigo-700 disabled:opacity-50 transition-all"
      >
        {simulating ? "⏳ Simulating…" : "▶️ Simulate Match"}
      </button>

      <p className="text-xs text-gray-400 text-center">
        Simulations run in the background. Results are spectatable replays.
      </p>
    </div>
  );
}

// ── Profiles tab ──────────────────────────────────────────────────────────────
function ProfilesTab({
  profiles,
  cinderlings,
}: {
  profiles: ProfileOption[];
  cinderlings: CinderlingData[];
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [slots, setSlots] = useState<string[]>(["", "", "", "", "", "", "", ""]);
  const [randomness, setRandomness] = useState(0.5);
  const [showForm, setShowForm] = useState(profiles.length === 0);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    const fd = new FormData(e.currentTarget);
    fd.set("teamNames", slots.filter(Boolean).join(","));
    fd.set("randomness", String(randomness));

    startTransition(async () => {
      try {
        await createProfileFromPracticeAction(fd);
        setSuccess(true);
        setSlots(["", "", "", "", "", "", "", ""]);
        setRandomness(0.5);
        (e.target as HTMLFormElement).reset();
        setShowForm(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to create profile");
      }
    });
  }

  return (
    <div className="space-y-5">
      {/* Existing profiles list */}
      {profiles.length > 0 && (
        <div className="divide-y divide-gray-100 border border-gray-200 rounded-xl overflow-hidden">
          {profiles.map((p) => (
            <div key={p.id} className="px-4 py-3 bg-white">
              <p className="font-semibold text-sm text-gray-900">{p.name}</p>
              {p.description && (
                <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{p.description}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Toggle create form */}
      {!showForm ? (
        <button
          onClick={() => setShowForm(true)}
          className="w-full py-3 border-2 border-dashed border-gray-200 rounded-xl text-sm font-medium text-gray-500 hover:border-blue-300 hover:text-blue-600 transition"
        >
          + Create new profile
        </button>
      ) : (
        <div className="border border-gray-200 rounded-xl p-5 space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-900 text-sm">New Profile</h3>
            {profiles.length > 0 && (
              <button
                onClick={() => { setShowForm(false); setError(null); }}
                className="text-xs text-gray-400 hover:text-gray-600"
              >
                Cancel
              </button>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Name</label>
              <input
                name="name"
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                placeholder="Aggro Hard"
              />
            </div>

            {/* Prompt */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Prompt <span className="text-gray-400 font-normal">(shapes every AI decision)</span>
              </label>
              <textarea
                name="description"
                required
                rows={3}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-blue-400"
                placeholder="You are an aggressive cinderling player. Always push forward and attack the nearest enemy…"
              />
            </div>

            {/* Randomness */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-medium text-gray-700">Randomness</label>
                <span className="text-xs font-mono text-gray-600">{randomness.toFixed(2)}</span>
              </div>
              <input
                type="range" min="0" max="1" step="0.01"
                value={randomness}
                onChange={(e) => setRandomness(parseFloat(e.target.value))}
                className="w-full accent-blue-600"
              />
              <div className="flex justify-between text-xs text-gray-400 mt-0.5">
                <span>0.0 — Deterministic</span>
                <span>1.0 — Very random</span>
              </div>
            </div>

            {/* Mon selector */}
            <MonTeamSelector cinderlings={cinderlings} slots={slots} onChange={setSlots} />
            {slots.filter(Boolean).length === 0 && (
              <p className="text-xs text-gray-400">
                ✨ Leave empty and a team will be auto-picked based on your prompt.
              </p>
            )}

            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">{error}</p>
            )}
            {success && (
              <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg p-3">
                ✅ Profile created!
              </p>
            )}

            <button
              type="submit"
              disabled={pending}
              className="w-full py-3 bg-blue-600 text-white text-sm font-bold rounded-xl hover:bg-blue-700 disabled:opacity-50 transition"
            >
              {pending ? "Creating…" : "Create Profile"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

// ── Root ──────────────────────────────────────────────────────────────────────
export default function PracticeSetup({ teams, subscribed, profiles, cinderlings }: PracticeSetupProps) {
  const [tab, setTab] = useState<"play" | "watch" | "profiles">("play");

  if (!subscribed) return <PremiumGate />;
  if (tab === "play" && teams.length === 0) return <NoTeamsGate />;

  return (
    <div>
      {/* Tab switcher */}
      <div className="flex gap-1 mb-6 bg-gray-100 rounded-xl p-1">
        <button
          onClick={() => setTab("play")}
          className={`flex-1 py-2 rounded-lg text-sm font-semibold transition ${
            tab === "play"
              ? "bg-white shadow text-gray-900"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          🥊 Play
        </button>
        <button
          onClick={() => setTab("watch")}
          className={`flex-1 py-2 rounded-lg text-sm font-semibold transition ${
            tab === "watch"
              ? "bg-white shadow text-gray-900"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          👁 Watch
        </button>
        <button
          onClick={() => setTab("profiles")}
          className={`flex-1 py-2 rounded-lg text-sm font-semibold transition ${
            tab === "profiles"
              ? "bg-white shadow text-gray-900"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          🧠 Profiles
        </button>
      </div>

      {tab === "play" ? (
        <PlayTab teams={teams} profiles={profiles} />
      ) : tab === "watch" ? (
        <WatchTab profiles={profiles} />
      ) : (
        <ProfilesTab profiles={profiles} cinderlings={cinderlings} />
      )}
    </div>
  );
}
