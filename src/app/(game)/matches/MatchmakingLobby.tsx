"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useToast } from "~/components/Toast";
import { queueForMatchAction } from "./actions";

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

export default function MatchmakingLobby({ teams }: { teams: Team[] }) {
  const router = useRouter();
  const { addToast } = useToast();
  const [selectedTeam, setSelectedTeam] = useState<string | null>(
    teams.length === 1 ? teams[0].uuid : null,
  );
  const [searching, setSearching] = useState(false);

  const handleQueue = async () => {
    if (!selectedTeam) {
      addToast("Select a team first", "error");
      return;
    }

    setSearching(true);
    try {
      const result = await queueForMatchAction(selectedTeam);
      if (result.success) {
        if (result.matched) {
          addToast("Opponent found! Starting match...", "success");
          router.push(`/matches/${result.matchUuid}/play`);
        } else {
          addToast("Searching for an opponent...", "success");
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

  if (teams.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-md p-12 text-center mb-8">
        <p className="text-5xl mb-4">⚔️</p>
        <h2 className="text-xl font-bold text-gray-900 mb-2">No teams yet</h2>
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
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-md p-6 mb-8">
      <h2 className="text-lg font-bold text-gray-900 mb-4">Pick a Team</h2>

      <div className="space-y-3 mb-6">
        {teams.map((team) => {
          const isSelected = selectedTeam === team.uuid;
          const activeSlots = team.slots.filter((s) => s.isActive);
          const benchSlots = team.slots.filter((s) => !s.isActive);

          return (
            <button
              key={team.uuid}
              onClick={() => setSelectedTeam(team.uuid)}
              disabled={searching}
              className={`w-full text-left border-2 rounded-lg p-4 transition ${
                isSelected
                  ? "border-blue-500 bg-blue-50 shadow-sm"
                  : "border-gray-200 bg-white hover:border-blue-300"
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-bold text-gray-900">{team.name}</h3>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">
                    {team.activeCount}/4 active
                  </span>
                  {isSelected && (
                    <span className="text-xs bg-blue-600 text-white px-2 py-0.5 rounded-full font-medium">
                      Selected
                    </span>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {activeSlots.map((slot) => (
                  <span
                    key={slot.uuid}
                    className="border border-green-200 bg-green-50 rounded px-2 py-0.5 text-xs font-medium text-gray-700"
                  >
                    {slot.cinderling?.name ?? "Unknown"}
                  </span>
                ))}
                {benchSlots.length > 0 && (
                  <span className="text-xs text-gray-400 self-center">
                    +{benchSlots.length} bench
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      <button
        onClick={handleQueue}
        disabled={searching || !selectedTeam}
        className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold text-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {searching ? (
          <>
            <span className="animate-spin">⚙️</span>
            Searching...
          </>
        ) : (
          "⚔️ Start Match!"
        )}
      </button>
    </div>
  );
}
