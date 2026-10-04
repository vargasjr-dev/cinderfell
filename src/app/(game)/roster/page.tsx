import { auth } from "~/lib/auth.server";
import { headers } from "next/headers";
import Link from "next/link";
import getCinderlingRoster from "~/data/getCinderlingRoster.server";
import getTeams from "~/data/getTeams.server";
import { getPower } from "../../../../server/specialPowers";
import "../../../../server/powers"; // trigger power registration
import RosterGrid from "./RosterGrid";
import TeamCard from "../teams/TeamCard";

export default async function RosterPage() {
  const headersList = await headers();
  const session = (await auth.api.getSession({ headers: headersList }))!;
  const [roster, teams] = await Promise.all([
    getCinderlingRoster(session.user.id),
    getTeams(session.user.id),
  ]);

  const enriched = roster.map((v) => {
    const power = v.specialPowerId ? getPower(v.specialPowerId) : undefined;
    return {
      uuid: v.uuid,
      name: v.name,
      health: v.health,
      attack: v.attack,
      speed: v.speed,
      flavor: v.flavor,
      imageUrl: v.imageUrl,
      powerName: power?.name,
      powerDescription: power?.description,
    };
  });

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Roster Section */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Your Roster</h1>
          <p className="text-gray-600 mt-1">
            {roster.length} cinderling{roster.length !== 1 ? "s" : ""} collected
          </p>
        </div>
        <Link
          href="/market"
          className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition text-sm"
        >
          Visit Market
        </Link>
      </div>

      {roster.length === 0 ? (
        <div className="bg-white rounded-lg shadow-md p-12 text-center mb-12">
          <p className="text-5xl mb-4">🥚</p>
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            No cinderlings yet
          </h2>
          <p className="text-gray-600 mb-6">
            Head to the Market to collect your first cinderling and start building
            your roster.
          </p>
          <Link
            href="/market"
            className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition"
          >
            Visit the Market
          </Link>
        </div>
      ) : (
        <div className="mb-12">
          <RosterGrid roster={enriched} />
        </div>
      )}

      {/* Teams Section */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Your Teams</h2>
          <p className="text-gray-600 mt-0.5">
            {teams.length} team{teams.length !== 1 ? "s" : ""} built
          </p>
        </div>
        <Link
          href="/roster/teams/new"
          className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition text-sm"
        >
          + New Team
        </Link>
      </div>

      {teams.length === 0 ? (
        <div className="bg-white rounded-lg shadow-md p-12 text-center">
          <p className="text-5xl mb-4">⚔️</p>
          <h2 className="text-xl font-bold text-gray-900 mb-2">No teams yet</h2>
          <p className="text-gray-600 mb-6">
            Build a team of 8 cinderlings with 4 in your active lineup to compete
            in matches.
          </p>
          <Link
            href="/roster/teams/new"
            className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition"
          >
            Create Your First Team
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {teams.map((team) => (
            <TeamCard key={team.uuid} team={team} />
          ))}
        </div>
      )}
    </div>
  );
}
