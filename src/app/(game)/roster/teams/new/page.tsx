import { auth } from "~/lib/auth.server";
import { headers } from "next/headers";
import getCinderlingRoster from "~/data/getCinderlingRoster.server";
import TeamBuilder from "~/app/(game)/teams/TeamBuilder";

export default async function NewTeamPage() {
  const headersList = await headers();
  const session = (await auth.api.getSession({ headers: headersList }))!;
  const roster = await getCinderlingRoster(session.user.id);

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Create New Team</h1>
        <p className="text-gray-600 mt-1">
          Build a team of up to 8 cinderlings with 4 in your active lineup.
        </p>
      </div>

      <TeamBuilder
        roster={roster.map((v) => ({
          uuid: v.uuid,
          name: v.name,
          health: v.health,
          attack: v.attack,
          speed: v.speed,
          energy: v.energy,
          modelUuid: v.modelUuid,
          imageUrl: v.imageUrl,
          flavor: v.flavor,
        }))}
        mode="create"
      />
    </div>
  );
}
