import { headers } from "next/headers";
import { auth } from "~/lib/auth.server";
import getTeams from "~/data/getTeams.server";
import { getRankedPageData } from "./actions";
import { STARS_PER_RANK } from "../../../../lib/ranked";
import { getPower } from "../../../../server/specialPowers";
import "../../../../server/powers"; // trigger power registration
import RankedPlayPage from "./RankedPlayPage";

export default async function RankedPage() {
  const headersList = await headers();
  const session = (await auth.api.getSession({ headers: headersList }))!;

  const [data, teams] = await Promise.all([
    getRankedPageData(),
    getTeams(session.user.id),
  ]);

  // Strip to only what RankedPlayPage needs — no isActive (designation
  // moves to the initial match flow, not team construction). Slots carry
  // flavor + power info + the instance uuid so the preview modal can show
  // full cinderling details and link to /roster/{uuid}.
  const teamProps = teams.map((t) => ({
    uuid: t.uuid,
    name: t.name,
    slots: t.slots.map((s) => {
      const power =
        s.cinderling?.specialPowerId != null
          ? getPower(s.cinderling.specialPowerId)
          : undefined;
      return {
        uuid: s.uuid,
        slotIndex: s.slotIndex,
        cinderling: s.cinderling
          ? {
              name: s.cinderling.name,
              health: s.cinderling.health,
              attack: s.cinderling.attack,
              speed: s.cinderling.speed,
              imageUrl: s.cinderling.imageUrl,
              flavor: s.cinderling.flavor,
              powerName: power?.name,
              powerDescription: power?.description,
              instanceUuid: s.instanceUuid,
            }
          : null,
      };
    }),
  }));

  if (!data.hasActiveSeason) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center px-4">
        <div className="text-6xl">🏔️</div>
        <h1 className="text-2xl font-bold text-gray-900">No Active Season</h1>
        <p className="text-gray-600">
          Ranked play begins when a season starts. Check back soon!
        </p>
      </div>
    );
  }

  return (
    <RankedPlayPage
      teams={teamProps}
      summary={data.summary}
      leaderboard={data.leaderboard}
      seasonName={data.seasonName ?? "Season"}
      starsPerRank={STARS_PER_RANK}
    />
  );
}
