import { auth } from "~/lib/auth.server";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import getCinderlingRoster from "~/data/getCinderlingRoster.server";
import getTeams from "~/data/getTeams.server";
import TeamBuilder from "~/app/(game)/teams/TeamBuilder";

export default async function EditTeamPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const headersList = await headers();
  const session = (await auth.api.getSession({ headers: headersList }))!;

  const [roster, teams] = await Promise.all([
    getCinderlingRoster(session.user.id),
    getTeams(session.user.id),
  ]);

  const team = teams.find((t) => t.uuid === id);
  if (!team) {
    notFound();
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Edit Team</h1>
        <p className="text-gray-600 mt-1">
          Update your team roster and active lineup.
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
        mode="edit"
        teamUuid={team.uuid}
        initialName={team.name}
        initialSlots={team.slots.map((s) => ({
          cinderlingInstanceUuid: s.cinderlingInstanceUuid,
          slotIndex: s.slotIndex,
          isActive: s.isActive,
        }))}
      />
    </div>
  );
}
