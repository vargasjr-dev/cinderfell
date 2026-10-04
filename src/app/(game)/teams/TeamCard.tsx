"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { deleteTeamAction } from "./actions";
import { useToast } from "~/components/Toast";

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
    imageUrl?: string;
  } | null;
};

type Team = {
  uuid: string;
  name: string;
  createdAt: Date;
  slots: TeamSlot[];
  activeCount: number;
};

export default function TeamCard({ team }: { team: Team }) {
  const router = useRouter();
  const { addToast } = useToast();

  const handleDelete = async () => {
    const result = await deleteTeamAction(team.uuid);
    if (result.success) {
      addToast(result.message, "success");
      router.refresh();
    } else {
      addToast(result.message, "error");
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">{team.name}</h2>
          <p className="text-sm text-gray-500">
            {team.slots.length}/8 cinderlings
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/roster/teams/${team.uuid}/edit`}
            className="text-sm text-blue-600 hover:text-blue-800 font-medium px-3 py-1 border border-blue-200 rounded-lg hover:bg-blue-50 transition"
          >
            Edit
          </Link>
          <button
            onClick={handleDelete}
            className="text-sm text-red-600 hover:text-red-800 font-medium px-3 py-1 border border-red-200 rounded-lg hover:bg-red-50 transition"
          >
            Delete
          </button>
        </div>
      </div>

      {/* Cinderling Avatar Grid */}
      {team.slots.length > 0 ? (
        <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
          {team.slots.map((slot) => (
            <div
              key={slot.uuid}
              className="aspect-square rounded-lg overflow-hidden bg-gray-100 border border-gray-200 relative group"
              title={slot.cinderling?.name ?? "Unknown"}
            >
              {slot.cinderling?.imageUrl ? (
                <Image
                  src={slot.cinderling.imageUrl}
                  alt={slot.cinderling.name}
                  fill
                  sizes="64px"
                  className="object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs font-bold">
                  {slot.cinderling?.name?.slice(0, 3) ?? "?"}
                </div>
              )}
              {/* Name tooltip on hover */}
              <div className="absolute inset-x-0 bottom-0 bg-black/60 text-white text-[9px] text-center py-0.5 opacity-0 group-hover:opacity-100 transition truncate px-0.5">
                {slot.cinderling?.name ?? "?"}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-4">
          <p className="text-gray-400 text-sm">
            No cinderlings assigned.{" "}
            <Link
              href={`/roster/teams/${team.uuid}/edit`}
              className="text-blue-600 hover:text-blue-800 font-medium"
            >
              Edit team →
            </Link>
          </p>
        </div>
      )}
    </div>
  );
}
