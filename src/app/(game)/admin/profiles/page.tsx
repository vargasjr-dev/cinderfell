import { headers } from "next/headers";
import { notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "~/lib/auth.server";
import { isAdmin } from "~/lib/admin";
import { listAiProfiles } from "~/data/aiProfiles.server";
import { CINDERLING_LIBRARY } from "../../../../../server/cinderlings";
import "../../../../../server/powers";
import { getPower } from "../../../../../server/specialPowers";
import ProfileCreateForm from "./ProfileCreateForm";

export default async function ProfilesPage() {
  const headersList = await headers();
  const session = await auth.api.getSession({ headers: headersList });
  if (!isAdmin(session)) notFound();

  const profiles = await listAiProfiles();

  const allCinderlings = CINDERLING_LIBRARY.map((v) => ({
    name: v.name,
    hp: v.hp,
    attack: v.attack,
    speed: v.speed,
    flavor: v.flavor,
    imageUrl: v.imageUrl,
    powerName: v.specialPowerId ? getPower(v.specialPowerId)?.name : undefined,
    powerDescription: v.specialPowerId
      ? getPower(v.specialPowerId)?.description
      : undefined,
    attacks: v.attacks.map((atk) => ({
      name: atk.name,
      damage: atk.damage,
      energyCost: atk.energyCost,
      range: atk.range,
    })),
  }));

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <div className="mb-6 flex items-center gap-4">
        <Link href="/admin" className="text-gray-500 hover:text-gray-700 text-sm">
          ← Admin
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">🤖 AI Player Profiles</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            LLM-driven AI personas. Click a profile to view details and match history.
          </p>
        </div>
      </div>

      {/* Profile list — name only */}
      {profiles.length === 0 ? (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-8 text-center text-gray-500 mb-8">
          No profiles yet. Create one below.
        </div>
      ) : (
        <div className="divide-y divide-gray-100 border border-gray-200 rounded-xl overflow-hidden mb-8">
          {profiles.map((p) => (
            <Link
              key={p.id}
              href={`/admin/profiles/${p.id}`}
              className="flex items-center justify-between px-4 py-3 bg-white hover:bg-gray-50 transition group"
            >
              <span className="font-medium text-gray-900 group-hover:text-blue-600 transition">
                {p.name}
              </span>
              <span className="text-sm text-gray-400 group-hover:text-blue-500 transition">
                →
              </span>
            </Link>
          ))}
        </div>
      )}

      {/* Create form */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Create Profile</h2>
        <ProfileCreateForm cinderlings={allCinderlings} />
      </div>
    </div>
  );
}
