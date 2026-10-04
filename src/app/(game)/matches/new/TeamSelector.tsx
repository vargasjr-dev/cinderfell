"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "~/components/Toast";
import { createMatchAction } from "../actions";
import MatchSettingsPanel from "~/components/MatchSettingsPanel";
import {
  DEFAULT_MATCH_SETTINGS,
  type MatchSettings,
} from "~/lib/matchSettings";

type TeamSlot = {
  uuid: string;
  slotIndex: number;
  isActive: boolean;
  cinderling: {
    name: string;
    health: number;
    attack: number;
    speed: number;
    energy: number;
  } | null;
};

type Team = {
  uuid: string;
  name: string;
  slots: TeamSlot[];
  activeCount: number;
};

export default function TeamSelector({ teams }: { teams: Team[] }) {
  const router = useRouter();
  const { addToast } = useToast();
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [settings, setSettings] = useState<MatchSettings>({
    ...DEFAULT_MATCH_SETTINGS,
    timerSeconds: 30, // Default to 30s for PvP
  });

  const handleCreate = async () => {
    if (!selectedTeam) {
      addToast("Select a team first", "error");
      return;
    }

    setCreating(true);
    try {
      const result = await createMatchAction(selectedTeam, settings);
      if (result.success && result.matchUuid) {
        addToast("Match created! Waiting for opponent...", "success");
        router.push(`/matches/${result.matchUuid}`);
        router.refresh();
      } else {
        addToast(result.message, "error");
      }
    } catch {
      addToast("Failed to create match", "error");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Team Selection */}
      <div className="space-y-3">
        {teams.map((team) => {
          const isSelected = selectedTeam === team.uuid;
          const activeSlots = team.slots.filter((s) => s.isActive);
          const benchSlots = team.slots.filter((s) => !s.isActive);

          return (
            <button
              key={team.uuid}
              onClick={() => setSelectedTeam(team.uuid)}
              className={`w-full text-left border-2 rounded-lg p-5 transition ${
                isSelected
                  ? "border-blue-500 bg-blue-50 shadow-md"
                  : "border-gray-200 bg-white hover:border-blue-300 hover:shadow-sm"
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-bold text-gray-900">
                  {team.name}
                </h3>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">
                    {team.slots.length}/8 slots · {team.activeCount}/4 active
                  </span>
                  {isSelected && (
                    <span className="text-xs bg-blue-600 text-white px-2 py-0.5 rounded-full font-medium">
                      Selected
                    </span>
                  )}
                </div>
              </div>

              {/* Active Lineup Preview */}
              <div className="mb-2">
                <p className="text-xs font-semibold text-green-600 uppercase tracking-wide mb-1">
                  Active Lineup
                </p>
                <div className="flex flex-wrap gap-2">
                  {activeSlots.map((slot) => (
                    <span
                      key={slot.uuid}
                      className="border border-green-200 bg-green-50 rounded px-2 py-1 text-xs font-medium text-gray-700"
                    >
                      {slot.cinderling?.name ?? "Unknown"}
                    </span>
                  ))}
                </div>
              </div>

              {/* Bench Preview */}
              {benchSlots.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">
                    Bench ({benchSlots.length})
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {benchSlots.map((slot) => (
                      <span
                        key={slot.uuid}
                        className="text-xs text-gray-500"
                      >
                        {slot.cinderling?.name ?? "Unknown"}
                        {benchSlots.indexOf(slot) < benchSlots.length - 1 &&
                          " · "}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Match Settings */}
      <div className="bg-white rounded-lg shadow-md p-5">
        <MatchSettingsPanel settings={settings} onChange={setSettings} />
      </div>

      {/* Action Bar */}
      <div className="flex items-center justify-between pt-4 border-t border-gray-200">
        <button
          onClick={() => router.push("/matches")}
          className="text-gray-600 hover:text-gray-900 font-medium transition"
        >
          ← Cancel
        </button>
        <button
          onClick={handleCreate}
          disabled={creating || !selectedTeam}
          className="bg-blue-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {creating ? "Creating..." : "Create Match"}
        </button>
      </div>
    </div>
  );
}
