import { auth } from "~/lib/auth.server";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { getCinderlingInstance } from "~/data/getCinderlingInstance.server";



function StatBar({
  label,
  value,
  max,
  color,
}: {
  label: string;
  value: number;
  max: number;
  color: "green" | "red" | "blue";
}) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  const colorMap = {
    green: "bg-green-500",
    red: "bg-red-500",
    blue: "bg-blue-500",
  };
  return (
    <div className="flex items-center gap-3">
      <span className="text-sm font-medium text-gray-500 w-10">{label}</span>
      <div className="h-3 bg-gray-200 rounded-full overflow-hidden flex-1">
        <div
          className={`h-full rounded-full ${colorMap[color]} transition-all`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-sm font-bold text-gray-800 w-8 text-right">
        {value}
      </span>
    </div>
  );
}

export default async function CinderlingDetailPage({
  params,
}: {
  params: Promise<{ uuid: string }>;
}) {
  const { uuid } = await params;
  const headersList = await headers();
  const session = (await auth.api.getSession({ headers: headersList }))!;

  const cinderling = await getCinderlingInstance(uuid, session.user.id);

  if (!cinderling) notFound();

  // Stat budget — same formula as guide
  const statBudget = cinderling.health + cinderling.attack * 5 + cinderling.speed * 8;

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      {/* Back link */}
      <Link
        href="/roster"
        className="text-sm text-blue-600 hover:text-blue-800 font-medium mb-6 inline-flex items-center gap-1"
      >
        ← Back to Roster
      </Link>

      <div className="bg-white rounded-2xl shadow-lg overflow-hidden mt-4">
        {/* Hero image */}
        <div className="relative w-full aspect-square max-h-72 bg-gradient-to-br from-blue-50 to-purple-100">
          {cinderling.imageUrl ? (
            <Image
              src={cinderling.imageUrl}
              alt={cinderling.name}
              fill
              className="object-contain p-8"
              sizes="(max-width: 768px) 100vw, 672px"
              priority
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-8xl text-gray-300">
              ?
            </div>
          )}
        </div>

        <div className="p-6 space-y-6">
          {/* Header */}
          <div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                {cinderling.name}
              </h1>
              {cinderling.flavor && (
                <p className="text-gray-500 italic mt-1 text-sm">
                  &ldquo;{cinderling.flavor}&rdquo;
                </p>
              )}
            </div>
          </div>

          {/* Stats */}
          <section>
            <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wide mb-3">
              Base Stats
            </h2>
            <div className="space-y-3">
              <StatBar label="HP" value={cinderling.health} max={120} color="green" />
              <StatBar label="ATK" value={cinderling.attack} max={20} color="red" />
              <StatBar label="SPD" value={cinderling.speed} max={10} color="blue" />
            </div>
            <p className="text-xs text-gray-400 mt-3 text-right">
              Stat budget: {statBudget}
            </p>
          </section>

          {/* Attacks */}
          <section>
            <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wide mb-3">
              Attacks
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {cinderling.attacks.map((attack) => (
                <div
                  key={attack.name}
                  className="bg-gray-50 border border-gray-200 rounded-xl p-4"
                >
                  <p className="font-bold text-gray-900 text-sm mb-2">
                    {attack.name}
                  </p>
                  <div className="flex gap-6 text-xs text-gray-600">
                    <span>
                      <span className="font-medium text-gray-800">Damage:</span>{" "}
                      {attack.damage}
                    </span>
                    <span>
                      <span className="font-medium text-gray-800">Energy:</span>{" "}
                      {attack.energyCost}
                    </span>
                    <span>
                      <span className="font-medium text-gray-800">Range:</span>{" "}
                      {attack.range}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Special Power */}
          {cinderling.powerName && (
            <section>
              <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wide mb-3">
                Special Power
              </h2>
              <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
                <p className="font-bold text-purple-900 mb-1">
                  ✨ {cinderling.powerName}
                </p>
                <p className="text-sm text-purple-700">
                  {cinderling.powerDescription}
                </p>
              </div>
            </section>
          )}

          {/* Guide link */}
          <div className="pt-2 border-t border-gray-100">
            <Link
              href={`/guide/cinderling/${cinderling.name.toLowerCase()}`}
              className="text-sm text-blue-600 hover:text-blue-800 font-medium"
            >
              View in Cinderling Guide →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
