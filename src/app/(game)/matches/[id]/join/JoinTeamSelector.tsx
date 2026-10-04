"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "~/components/Toast";
import { joinMatchAction } from "../../actions";

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

export default function JoinTeamSelector({
  matchUuid,
  teams,
}: {
  matchUuid: string;
  teams: Team[];
}) {
  const router = useRouter();
  const { addToast } = useToast();
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);

  const handleJoin = async () => {
    if (!selectedTeam) {
      addToast("Select a team first", "error");
      return;
    }

    setJoining(true);
    try {
      const result = await joinMatchAction(matchUuid, selectedTeam);
      if (result.success) {
        addToast("Joined! Match is ready.", "success");
        router.push(`/matches/${matchUuid}`);
        router.refresh();
      } else {
        addToast(result.message, "error");
      }
    } catch {
      addToast("Failed to join match", "error");
    } finally {
      setJoining(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        {teams.map((team) => {
          const isSelected = selectedTeam === team.uuid;
          const activeSlots = team.slots.filter((s) => s.isActive);

          return (
            <button
              key={team.uuid}
              onClick={() => setSelectedTeam(team.uuid)}
              className={`w-full text-left border-2 rounded-lg p-5 transition ${
                isSelected
                  ? "border-green-500 bg-green-50 shadow-md"
                  : "border-gray-200 bg-white hover:border-green-300 hover:shadow-sm"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-bold text-gray-900">
                  {team.name}
                </h3>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">
                    {team.activeCount}/4 active
                  </span>
                  {isSelected && (
                    <span className="text-xs bg-green-600 text-white px-2 py-0.5 rounded-full font-medium">
                      Selected
                    </span>
                  )}
                </div>
              </div>
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
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between pt-4 border-t border-gray-200">
        <button
          onClick={() => router.push("/matches")}
          className="text-gray-600 hover:text-gray-900 font-medium transition"
        >
          ← Cancel
        </button>
        <button
          onClick={handleJoin}
          disabled={joining || !selectedTeam}
          className="bg-green-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {joining ? "Joining..." : "Join Match"}
        </button>
      </div>
    </div>
  );
}
