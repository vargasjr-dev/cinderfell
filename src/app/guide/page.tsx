import Link from "next/link";

const guideCards = [
  {
    title: "Game Rules",
    description:
      "Learn how matches work — win conditions, the energy system, commands, and turn resolution.",
    href: "/guide/rules",
    icon: "📖",
  },
  {
    title: "Cinderling Directory",
    description:
      "Browse every cinderling — stats, attacks, and what makes each one unique.",
    href: "/guide/cinderling",
    icon: "📚",
  },
  {
    title: "Strategy Guide",
    description:
      "Team composition tips, positioning basics, and how to read your opponent.",
    href: "/guide/strategy",
    icon: "🧠",
  },
];

export default function GuidePage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-blue-50 to-blue-200">
      <nav className="border-b border-blue-200 bg-white/60 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="text-xl font-bold text-gray-900">
            cinderling
          </Link>
          <div className="flex gap-4">
            <Link
              href="/guide"
              className="text-blue-600 font-medium"
            >
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

      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold mb-4 text-gray-900">
            How to Play Cinderling
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Cinderling is a simultaneous-action RPG where two players command
            teams of cinderlings on a tactical grid. Every turn, both players act
            at the same time — no waiting.
          </p>
        </div>

        <div className="max-w-4xl mx-auto">
          {/* Quick overview */}
          <div className="bg-white rounded-xl shadow-lg p-8 mb-8">
            <h2 className="text-2xl font-bold mb-4 text-gray-900">
              The Basics
            </h2>
            <div className="grid sm:grid-cols-3 gap-6 text-center">
              <div>
                <div className="text-3xl mb-2">⚔️</div>
                <h3 className="font-semibold text-gray-800">1v1 Matches</h3>
                <p className="text-sm text-gray-500 mt-1">
                  8 cinderlings per roster, 4 active on the field
                </p>
              </div>
              <div>
                <div className="text-3xl mb-2">🗺️</div>
                <h3 className="font-semibold text-gray-800">8×5 Grid</h3>
                <p className="text-sm text-gray-500 mt-1">
                  Teams spawn on opposite sides, fight for control
                </p>
              </div>
              <div>
                <div className="text-3xl mb-2">🏆</div>
                <h3 className="font-semibold text-gray-800">3 Win Conditions</h3>
                <p className="text-sm text-gray-500 mt-1">
                  Elimination, Occupation, or Energy Accumulation
                </p>
              </div>
            </div>
          </div>

          {/* Guide sections */}
          <div className="grid md:grid-cols-3 gap-6 mb-12">
            {guideCards.map((card) => (
              <Link
                key={card.href}
                href={card.href}
                className="bg-white rounded-xl shadow-md p-6 hover:shadow-lg hover:-translate-y-1 transition-all group"
              >
                <div className="text-4xl mb-3">{card.icon}</div>
                <h3 className="text-xl font-bold text-gray-900 mb-2 group-hover:text-blue-600 transition-colors">
                  {card.title}
                </h3>
                <p className="text-gray-600 text-sm">{card.description}</p>
              </Link>
            ))}
          </div>

          {/* Quick reference: Win conditions */}
          <div className="bg-white rounded-xl shadow-lg p-8 mb-8">
            <h2 className="text-2xl font-bold mb-6 text-gray-900">
              Win Conditions at a Glance
            </h2>
            <div className="space-y-4">
              <div className="flex items-start gap-4 p-4 bg-red-50 rounded-lg">
                <span className="text-2xl">💀</span>
                <div>
                  <h3 className="font-semibold text-gray-800">Elimination</h3>
                  <p className="text-sm text-gray-600">
                    Knock out all of your opponent&apos;s cinderlings — active and
                    bench. Last team standing wins.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-4 p-4 bg-purple-50 rounded-lg">
                <span className="text-2xl">🏴</span>
                <div>
                  <h3 className="font-semibold text-gray-800">Occupation</h3>
                  <p className="text-sm text-gray-600">
                    Control all three Occupation Points on the center of the
                    board simultaneously. Hold them and win.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-4 p-4 bg-yellow-50 rounded-lg">
                <span className="text-2xl">⚡</span>
                <div>
                  <h3 className="font-semibold text-gray-800">
                    Energy Accumulation
                  </h3>
                  <p className="text-sm text-gray-600">
                    Reach 120 team energy through harvesting. Your team starts
                    with 20 — gather the rest on the battlefield.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* CTA */}
          <div className="text-center">
            <p className="text-gray-500 mb-4">Ready to play?</p>
            <Link
              href="/signup"
              className="inline-block bg-blue-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-blue-700 transition"
            >
              Create Account
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
