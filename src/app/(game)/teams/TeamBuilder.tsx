"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "~/components/Toast";
import CinderlingCard from "~/components/CinderlingCard";
import { createTeamAction, updateTeamAction } from "./actions";
import type { SlotInput } from "~/data/createTeam.server";
import { TEAM_NAME_MAX_LENGTH } from "~/data/teamConstants";

type RosterCinderling = {
  uuid: string;
  name: string;
  health: number;
  attack: number;
  speed: number;
  energy: number;
  modelUuid: string;
  imageUrl?: string;
  flavor?: string;
};

type ExistingSlot = {
  cinderlingInstanceUuid: string;
  slotIndex: number;
  isActive: boolean;
};

type TeamBuilderProps = {
  roster: RosterCinderling[];
  mode: "create" | "edit";
  teamUuid?: string;
  initialName?: string;
  initialSlots?: ExistingSlot[];
};

type BuilderSlot = {
  cinderlingInstanceUuid: string;
  isActive: boolean;
};

export default function TeamBuilder({
  roster,
  mode,
  teamUuid,
  initialName = "",
  initialSlots = [],
}: TeamBuilderProps) {
  const router = useRouter();
  const { addToast } = useToast();

  const [name, setName] = useState(initialName);
  const [slots, setSlots] = useState<BuilderSlot[]>(
    initialSlots.map((s) => ({
      cinderlingInstanceUuid: s.cinderlingInstanceUuid,
      isActive: s.isActive,
    })),
  );
  const [saving, setSaving] = useState(false);

  const assignedUuids = new Set(slots.map((s) => s.cinderlingInstanceUuid));

  // Get model UUIDs already in slots (for dupe-type prevention)
  const assignedModelUuids = new Set(
    slots
      .map((s) => roster.find((r) => r.uuid === s.cinderlingInstanceUuid)?.modelUuid)
      .filter(Boolean),
  );

  const availableRoster = roster.filter((v) => {
    if (assignedUuids.has(v.uuid)) return false;
    // Don't show cinderlings whose type is already in the team
    if (assignedModelUuids.has(v.modelUuid)) return false;
    return true;
  });

  const addCinderling = (instanceUuid: string) => {
    if (slots.length >= 8) return;
    setSlots((prev) => [
      ...prev,
      { cinderlingInstanceUuid: instanceUuid, isActive: false },
    ]);
  };

  const removeSlot = (index: number) => {
    setSlots((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      addToast("Team name is required", "error");
      return;
    }
    if (name.trim().length > TEAM_NAME_MAX_LENGTH) {
      addToast(`Team name must be ${TEAM_NAME_MAX_LENGTH} characters or fewer`, "error");
      return;
    }

    setSaving(true);

    // Auto-set first 4 slots as active lineup, rest as bench
    const slotInputs: SlotInput[] = slots.map((s, i) => ({
      cinderlingInstanceUuid: s.cinderlingInstanceUuid,
      slotIndex: i,
      isActive: i < 4,
    }));

    try {
      const result =
        mode === "create"
          ? await createTeamAction(name.trim(), slotInputs)
          : await updateTeamAction(teamUuid!, name.trim(), slotInputs);

      if (result.success) {
        addToast(result.message, "success");
        router.push("/roster");
        router.refresh();
      } else {
        addToast(result.message, "error");
      }
    } catch {
      addToast("Something went wrong", "error");
    } finally {
      setSaving(false);
    }
  };

  const getCinderling = (uuid: string) => roster.find((v) => v.uuid === uuid);

  return (
    <div className="space-y-8">
      {/* Team Name */}
      <div>
        <label
          htmlFor="teamName"
          className="block text-sm font-semibold text-gray-700 mb-2"
        >
          Team Name
        </label>
        <input
          id="teamName"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Enter a team name..."
          className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none ${
            !name.trim() && slots.length > 0
              ? "border-amber-400 bg-amber-50"
              : name.length > TEAM_NAME_MAX_LENGTH
                ? "border-red-400 bg-red-50"
                : "border-gray-300"
          }`}
          maxLength={TEAM_NAME_MAX_LENGTH}
        />
        <div className="flex justify-between mt-1">
          <div>
            {!name.trim() && slots.length > 0 && (
              <p className="text-xs text-amber-600">⚠️ Team name required to save</p>
            )}
          </div>
          <p className={`text-xs ${name.length >= TEAM_NAME_MAX_LENGTH ? "text-red-500 font-semibold" : "text-gray-400"}`}>
            {name.length}/{TEAM_NAME_MAX_LENGTH}
          </p>
        </div>
      </div>

      {/* Team Slots */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-gray-900">
            Team Slots ({slots.length}/8)
          </h2>
          <span className="text-sm text-gray-500">
            Pick up to 8 cinderlings
          </span>
        </div>

        {slots.length === 0 ? (
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
            <p className="text-gray-400">
              Add cinderlings from your roster below
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {slots.map((slot, index) => {
              const v = getCinderling(slot.cinderlingInstanceUuid);
              if (!v) return null;
              return (
                <div key={`${slot.cinderlingInstanceUuid}-${index}`} className="relative">
                  <CinderlingCard
                    name={v.name}
                    health={v.health}
                    attack={v.attack}
                    speed={v.speed}
                    energy={v.energy}
                    imageUrl={v.imageUrl}
                    flavor={v.flavor}
                    variant="compact"
                  />
                  <button
                    onClick={() => removeSlot(index)}
                    className="absolute top-1 right-1 w-6 h-6 flex items-center justify-center rounded-full bg-red-100 text-red-600 hover:bg-red-200 text-xs font-bold transition"
                  >
                    ✕
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Available Roster */}
      <div>
        <h2 className="text-lg font-bold text-gray-900 mb-3">
          Add from Roster
        </h2>

        {roster.length === 0 ? (
          <div className="bg-gray-50 rounded-lg p-8 text-center">
            <p className="text-gray-400">
              No cinderlings in your roster. Visit the Market first!
            </p>
          </div>
        ) : availableRoster.length === 0 ? (
          <div className="bg-gray-50 rounded-lg p-6 text-center">
            <p className="text-gray-400 text-sm">
              {slots.length >= 8
                ? "Team is full (8/8 slots)"
                : "All eligible roster cinderlings are assigned"}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {availableRoster.map((v) => (
              <button
                key={v.uuid}
                onClick={() => addCinderling(v.uuid)}
                disabled={slots.length >= 8}
                className="text-left disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <CinderlingCard
                  name={v.name}
                  health={v.health}
                  attack={v.attack}
                  speed={v.speed}
                  energy={v.energy}
                  imageUrl={v.imageUrl}
                  flavor={v.flavor}
                  variant="compact"
                />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Save Button */}
      <div className="flex items-center justify-between pt-4 border-t border-gray-200">
        <button
          onClick={() => router.push("/roster")}
          className="text-gray-600 hover:text-gray-900 font-medium transition"
        >
          ← Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={saving || !name.trim()}
          className="bg-blue-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving
            ? "Saving..."
            : mode === "create"
              ? "Create Team"
              : "Save Changes"}
        </button>
      </div>
    </div>
  );
}
