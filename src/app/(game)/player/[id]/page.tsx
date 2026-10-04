import getCinderlingByUuid from "~/data/getCinderling.server";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function PlayerDetailPage({ params }: PageProps) {
  // Auth guaranteed by (game)/layout.tsx — no session needed here
  const { id } = await params;
  const cinderling = await getCinderlingByUuid(id);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-xl p-8">
        <h1 className="text-4xl font-bold mb-8 text-center">{cinderling.name}</h1>

        <div className="space-y-4">
          <div className="border-b pb-4">
            <p className="text-gray-600 text-sm">Health</p>
            <p className="text-2xl font-semibold">{cinderling.health}</p>
          </div>

          <div className="border-b pb-4">
            <p className="text-gray-600 text-sm">Attack</p>
            <p className="text-2xl font-semibold">{cinderling.attack}</p>
          </div>

          <div className="border-b pb-4">
            <p className="text-gray-600 text-sm">Speed</p>
            <p className="text-2xl font-semibold">{cinderling.speed}</p>
          </div>

          <div className="border-b pb-4">
            <p className="text-gray-600 text-sm">Energy</p>
            <p className="text-2xl font-semibold">{cinderling.energy}</p>
          </div>

          <div className="mt-6">
            <a
              href="/player"
              className="inline-block bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 transition"
            >
              Back to Roster
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
