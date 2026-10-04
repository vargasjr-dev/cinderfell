import { headers } from "next/headers";
import { auth } from "~/lib/auth.server";
import { isAdmin } from "~/lib/admin";
import { redirect } from "next/navigation";
import { listSeasonsAction } from "./actions";
import SeasonManager from "./SeasonManager";
import Link from "next/link";

export default async function AdminSeasonsPage() {
  const headersList = await headers();
  const session = await auth.api.getSession({ headers: headersList });

  if (!session || !isAdmin(session)) {
    redirect("/player");
  }

  const seasons = await listSeasonsAction();

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-6">
        <Link
          href="/admin"
          className="text-blue-600 hover:text-blue-800 text-sm"
        >
          ← Back to Admin
        </Link>
        <h1 className="text-3xl font-bold text-gray-900 mt-2">
          🏆 Season Management
        </h1>
        <p className="text-gray-600 mt-1">
          Create, configure, and manage game seasons.
        </p>
      </div>

      <SeasonManager
        seasons={seasons.map((s: typeof seasons[number]) => ({
          id: s.id,
          name: s.name,
          status: s.status,
          startDate: s.startDate,
          endDate: s.endDate,
          newCinderlingId: s.newCinderlingId,
        }))}
      />
    </div>
  );
}
