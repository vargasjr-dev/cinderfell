import { auth } from "~/lib/auth.server";
import { headers } from "next/headers";
import listMarket from "~/data/listMarket.server";
import getOwnedModelUuids from "~/data/getOwnedModelUuids.server";
import { getPower } from "../../../../server/specialPowers";
import "../../../../server/powers"; // trigger power registration
import MarketGrid from "./MarketGrid";

export default async function MarketPage() {
  const headersList = await headers();
  const session = (await auth.api.getSession({ headers: headersList }))!;

  const [cinderlings, ownedUuids] = await Promise.all([
    Promise.resolve(listMarket()),
    getOwnedModelUuids(session.user.id),
  ]);

  // Sort alphabetically, tag owned status + power info
  const sorted = [...cinderlings]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((v) => {
      const power = v.specialPowerId ? getPower(v.specialPowerId) : undefined;
      return {
        ...v,
        isOwned: ownedUuids.has(v.uuid),
        powerName: power?.name,
        powerDescription: power?.description,
      };
    });

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-4xl font-bold mb-2 text-center">Cinderling Market</h1>
      <p className="text-gray-500 text-center mb-8">
        {cinderlings.length} cinderlings available ·{" "}
        {ownedUuids.size} owned
      </p>

      <MarketGrid cinderlings={sorted} />
    </div>
  );
}
