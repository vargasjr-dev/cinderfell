import { headers } from "next/headers";
import Link from "next/link";
import { auth } from "~/lib/auth.server";
import { isSubscriber } from "../../../../lib/subscription";
import { db } from "../../../../data/db";
import { team } from "../../../../data/schema";
import { eq } from "drizzle-orm";
import { listAiProfiles } from "~/data/aiProfiles.server";
import type { AiProfile } from "~/data/aiProfiles.server";
import { CINDERLING_LIBRARY } from "../../../../server/cinderlings";
import "../../../../server/powers";
import { getPower } from "../../../../server/specialPowers";
import PracticeSetup from "./PracticeSetup";

export default async function PracticePage() {
  const headersList = await headers();
  const session = (await auth.api.getSession({ headers: headersList }))!;

  const [subscribed, teams, rawProfiles] = await Promise.all([
    isSubscriber(session.user.id),
    db
      .select({ uuid: team.uuid, name: team.name })
      .from(team)
      .where(eq(team.userId, session.user.id)),
    listAiProfiles(),
  ]);

  const profiles = rawProfiles.map((p: AiProfile) => ({
    id: p.id,
    name: p.name,
    description: p.description,
  }));

  const cinderlings = CINDERLING_LIBRARY.map((v) => ({
    name: v.name,
    hp: v.hp,
    attack: v.attack,
    speed: v.speed,
    flavor: v.flavor,
    imageUrl: v.imageUrl,
    powerName: v.specialPowerId ? getPower(v.specialPowerId)?.name : undefined,
    powerDescription: v.specialPowerId ? getPower(v.specialPowerId)?.description : undefined,
    attacks: v.attacks.map((atk) => ({
      name: atk.name,
      damage: atk.damage,
      energyCost: atk.energyCost,
      range: atk.range,
    })),
  }));

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">🥊 Practice Mode</h1>
        <p className="text-gray-600 mt-1">
          Hone your strategy against AI profiles — or watch two profiles battle
          it out. No ranked impact.
        </p>
      </div>

      <div className="bg-white rounded-2xl shadow-xl p-6">
        <PracticeSetup teams={teams} subscribed={subscribed} profiles={profiles} cinderlings={cinderlings} />
      </div>

      <div className="mt-4 text-center">
        <Link href="/practice/history" className="text-sm text-blue-600 hover:underline">
          View match history →
        </Link>
      </div>
    </div>
  );
}
