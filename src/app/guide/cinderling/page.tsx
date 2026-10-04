import Link from "next/link";
import Image from "next/image";
import { CINDERLING_LIBRARY } from "../../../../server/cinderlings";

export default function CinderlingDirectoryPage() {
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

      <div className="container mx-auto px-4 py-12 max-w-5xl">
        <div className="mb-8">
          <Link
            href="/guide"
            className="text-blue-600 hover:underline text-sm"
          >
            ← Back to Guide
          </Link>
        </div>

        <h1 className="text-4xl font-bold mb-2 text-gray-900">
          📚 Cinderling Directory
        </h1>
        <p className="text-gray-600 mb-10 text-lg">
          All {CINDERLING_LIBRARY.length} cinderlings. Click any creature to see
          its stats, attacks, and lore.
        </p>

        {/* Avatar Grid */}
        <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-3">
          {CINDERLING_LIBRARY.map((v) => (
            <Link
              key={v.id}
              href={`/guide/cinderling/${v.name.toLowerCase()}`}
              className="group bg-white rounded-lg shadow-sm hover:shadow-md transition p-2 text-center"
            >
              {v.imageUrl ? (
                <div className="relative w-full aspect-square mb-1 rounded overflow-hidden bg-gray-50">
                  <Image
                    src={v.imageUrl}
                    alt={v.name}
                    fill
                    className="object-cover group-hover:scale-110 transition-transform"
                    sizes="80px"
                  />
                </div>
              ) : (
                <div className="w-full aspect-square mb-1 rounded bg-gray-100 flex items-center justify-center text-2xl">
                  ❓
                </div>
              )}
              <p className="text-xs font-medium text-gray-700 truncate">
                {v.name}
              </p>
            </Link>
          ))}
        </div>

        {/* Stats Legend */}
        <div className="mt-12 bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-3">
            Quick Reference
          </h2>
          <div className="grid sm:grid-cols-3 gap-4 text-sm text-gray-600">
            <div>
              <strong className="text-gray-800">HP</strong> — Health points.
              Range: 40–120.
            </div>
            <div>
              <strong className="text-gray-800">ATK</strong> — Attack power.
              Range: 5–20.
            </div>
            <div>
              <strong className="text-gray-800">SPD</strong> — Speed / turn
              order. Range: 1–10.
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
