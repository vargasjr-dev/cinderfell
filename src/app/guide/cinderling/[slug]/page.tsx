import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import {
  CINDERLING_LIBRARY,
  type CinderlingTemplate,
} from "../../../../../server/cinderlings";


/** Generate static params for all 64 cinderlings */
export function generateStaticParams() {
  return CINDERLING_LIBRARY.map((v) => ({
    slug: v.name.toLowerCase(),
  }));
}

export default async function CinderlingDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const cinderling = CINDERLING_LIBRARY.find(
    (v) => v.name.toLowerCase() === slug.toLowerCase(),
  );

  if (!cinderling) {
    notFound();
  }

  const statBudget =
    cinderling.hp + cinderling.attack * 5 + cinderling.speed * 8;

  // Find neighbors for navigation
  const idx = CINDERLING_LIBRARY.indexOf(cinderling);
  const prev = idx > 0 ? CINDERLING_LIBRARY[idx - 1] : null;
  const next =
    idx < CINDERLING_LIBRARY.length - 1 ? CINDERLING_LIBRARY[idx + 1] : null;

  return (
    <main className="min-h-screen bg-gradient-to-b from-blue-50 to-blue-200">
      <nav className="border-b border-blue-200 bg-white/60 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="text-xl font-bold text-gray-900">
            cinderling
          </Link>
          <div className="flex gap-4">
            <Link href="/guide" className="text-blue-600 font-medium">
              Guide
            </Link>
            <Link
              href="/login"
              className="text-gray-600 hover:text-gray-900 transition"
            >
              Sign In
            </Link>
          </div>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-12 max-w-2xl">
        <div className="mb-8">
          <Link
            href="/guide/cinderling"
            className="text-blue-600 hover:underline text-sm"
          >
            ← Back to Directory
          </Link>
        </div>

        {/* Hero Card */}
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden mb-8">
          {/* Avatar */}
          {cinderling.imageUrl && (
            <div className="relative w-full aspect-square max-h-80 bg-gray-50">
              <Image
                src={cinderling.imageUrl}
                alt={cinderling.name}
                fill
                className="object-contain"
                sizes="(max-width: 640px) 100vw, 640px"
                priority
              />
            </div>
          )}

          {/* Info */}
          <div className="p-6">
            <div className="flex items-center justify-between mb-2">
              <h1 className="text-3xl font-bold text-gray-900">
                {cinderling.name}
              </h1>
              <span className="text-sm font-mono text-gray-400">
                #{cinderling.id}
              </span>
            </div>
            <p className="text-gray-600 italic text-lg mb-6">
              &ldquo;{cinderling.flavor}&rdquo;
            </p>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              <StatBar label="HP" value={cinderling.hp} max={120} color="green" />
              <StatBar
                label="ATK"
                value={cinderling.attack}
                max={20}
                color="red"
              />
              <StatBar
                label="SPD"
                value={cinderling.speed}
                max={10}
                color="blue"
              />
            </div>

            <p className="text-xs text-gray-400 text-center mb-6">
              Stat Budget: {statBudget} (HP + ATK×5 + SPD×8)
            </p>

            {/* Attacks */}
            <h2 className="text-lg font-bold text-gray-900 mb-3">Attacks</h2>
            <div className="space-y-3">
              {cinderling.attacks.map((atk, i) => {
                const totalDamage = atk.damage + cinderling.attack;
                return (
                  <div
                    key={i}
                    className="bg-gray-50 rounded-lg p-4 flex items-center justify-between"
                  >
                    <div>
                      <h3 className="font-semibold text-gray-800">
                        {atk.name}
                      </h3>
                      <p className="text-sm text-gray-500">
                        Range {atk.range} · {atk.energyCost}⚡ energy
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-red-600">
                        {totalDamage}
                      </p>
                      <p className="text-xs text-gray-400">damage</p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Special Power hint */}
            <div className="mt-6 bg-purple-50 border border-purple-200 rounded-lg p-4 text-center">
              <p className="text-sm text-purple-700">
                ✨ This cinderling has a <strong>unique special power</strong>{" "}
                that activates during battle. Discover it in a match!
              </p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <div className="flex justify-between items-center">
          {prev ? (
            <Link
              href={`/guide/cinderling/${prev.name.toLowerCase()}`}
              className="text-blue-600 hover:underline text-sm"
            >
              ← {prev.name}
            </Link>
          ) : (
            <span />
          )}
          {next ? (
            <Link
              href={`/guide/cinderling/${next.name.toLowerCase()}`}
              className="text-blue-600 hover:underline text-sm"
            >
              {next.name} →
            </Link>
          ) : (
            <span />
          )}
        </div>
      </div>
    </main>
  );
}

// ─── Components ──────────────────────────────────────────────────────────────

function StatBar({
  label,
  value,
  max,
  color,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
}) {
  const pct = Math.round((value / max) * 100);
  const colorMap: Record<string, string> = {
    green: "bg-green-500",
    red: "bg-red-500",
    blue: "bg-blue-500",
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium text-gray-500">{label}</span>
        <span className="text-sm font-bold text-gray-800">{value}</span>
      </div>
      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${colorMap[color] || "bg-gray-500"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
