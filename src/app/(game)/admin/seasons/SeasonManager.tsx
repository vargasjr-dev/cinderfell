"use client";

import { useState } from "react";
import {
  createSeasonAction,
  activateSeasonAction,
  archiveSeasonAction,
  generateDefaultTrack,
  type TierDef,
} from "./actions";

type SeasonRow = {
  id: string;
  name: string;
  status: string;
  startDate: Date;
  endDate: Date;
  newCinderlingId: number | null;
};

interface SeasonManagerProps {
  seasons: SeasonRow[];
}

export default function SeasonManager({ seasons }: SeasonManagerProps) {
  const [list, setList] = useState(seasons);
  const [creating, setCreating] = useState(false);
  const [acting, setActing] = useState<string | null>(null);

  // Create form state
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [cinderlingId, setCinderlingId] = useState("");

  async function handleCreate() {
    if (!name || !startDate || !endDate) return;
    setCreating(true);

    const tiers: TierDef[] = await generateDefaultTrack();
    const result = await createSeasonAction({
      name,
      startDate,
      endDate,
      newCinderlingId: cinderlingId ? Number(cinderlingId) : undefined,
      tiers,
    });

    if (result.success && result.seasonId) {
      setList((prev) => [
        ...prev,
        {
          id: result.seasonId!,
          name,
          status: "upcoming",
          startDate: new Date(startDate),
          endDate: new Date(endDate),
          newCinderlingId: cinderlingId ? Number(cinderlingId) : null,
        },
      ]);
      setName("");
      setStartDate("");
      setEndDate("");
      setCinderlingId("");
    }

    setCreating(false);
  }

  async function handleActivate(id: string) {
    setActing(id);
    const result = await activateSeasonAction(id);
    if (result.success) {
      setList((prev) =>
        prev.map((s) => ({
          ...s,
          status: s.id === id ? "active" : s.status === "active" ? "archived" : s.status,
        })),
      );
    }
    setActing(null);
  }

  async function handleArchive(id: string) {
    setActing(id);
    const result = await archiveSeasonAction(id);
    if (result.success) {
      setList((prev) =>
        prev.map((s) => (s.id === id ? { ...s, status: "archived" } : s)),
      );
    }
    setActing(null);
  }

  const statusBadge = (status: string) => {
    const colors: Record<string, string> = {
      active: "bg-green-100 text-green-800",
      upcoming: "bg-blue-100 text-blue-800",
      archived: "bg-gray-100 text-gray-600",
    };
    return (
      <span
        className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors[status] ?? "bg-gray-100 text-gray-600"}`}
      >
        {status}
      </span>
    );
  };

  return (
    <div className="space-y-8">
      {/* Create Season */}
      <div className="bg-white rounded-xl shadow-md p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4">
          Create New Season
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Season Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Season 1: Origins"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              New Cinderling ID (optional)
            </label>
            <input
              type="number"
              value={cinderlingId}
              onChange={(e) => setCinderlingId(e.target.value)}
              placeholder="Library ID"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Start Date
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              End Date
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>
        </div>
        <p className="text-xs text-gray-400 mb-3">
          Creates season with default 25-tier track (credits + cosmetics + cinderling at tier 5 + premium skin at tier 15).
        </p>
        <button
          onClick={handleCreate}
          disabled={creating || !name || !startDate || !endDate}
          className="px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition text-sm"
        >
          {creating ? "Creating…" : "Create Season"}
        </button>
      </div>

      {/* Season List */}
      <div className="bg-white rounded-xl shadow-md p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4">
          All Seasons ({list.length})
        </h2>
        {list.length === 0 ? (
          <p className="text-gray-500 text-sm">No seasons created yet.</p>
        ) : (
          <div className="space-y-3">
            {list.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between p-3 border border-gray-200 rounded-lg"
              >
                <div>
                  <span className="font-medium text-gray-900">{s.name}</span>
                  <span className="ml-2">{statusBadge(s.status)}</span>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {new Date(s.startDate).toLocaleDateString()} —{" "}
                    {new Date(s.endDate).toLocaleDateString()}
                    {s.newCinderlingId && ` · New Cinderling: #${s.newCinderlingId}`}
                  </p>
                </div>
                <div className="flex gap-2">
                  {s.status === "upcoming" && (
                    <button
                      onClick={() => handleActivate(s.id)}
                      disabled={acting === s.id}
                      className="px-3 py-1 text-xs font-medium bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50 transition"
                    >
                      Activate
                    </button>
                  )}
                  {s.status === "active" && (
                    <button
                      onClick={() => handleArchive(s.id)}
                      disabled={acting === s.id}
                      className="px-3 py-1 text-xs font-medium bg-gray-500 text-white rounded hover:bg-gray-600 disabled:opacity-50 transition"
                    >
                      Archive
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
