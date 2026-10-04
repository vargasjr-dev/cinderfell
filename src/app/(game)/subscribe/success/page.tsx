import Link from "next/link";

const UNLOCKED = [
  {
    emoji: "🥊",
    title: "Practice Mode",
    desc: "Battle automated opponent profiles",
    href: "/practice",
  },
  {
    emoji: "⚡️",
    title: "Early Access",
    desc: "Day-1 Cinderling unlock each season",
    href: "/player",
  },
  {
    emoji: "🎨",
    title: "Cosmetic Builder",
    desc: "Design your own skins and effects",
    href: "/cosmetics/create",
  },
  {
    emoji: "💰",
    title: "Monthly Credits",
    desc: "500 credits waiting in your account",
    href: "/player",
  },
];

export default function SubscribeSuccessPage() {
  return (
    <div className="container mx-auto px-4 py-12 max-w-lg">
      <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
        <div className="text-5xl mb-4">🎉</div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Welcome to Premium!
        </h1>
        <p className="text-gray-600 mb-8">
          Your Cinderling Premium subscription is now active. Time to make some
          legendary moves.
        </p>

        <div className="space-y-3 mb-8 text-left">
          {UNLOCKED.map((item) => (
            <Link
              key={item.title}
              href={item.href}
              className="flex items-center gap-4 p-4 rounded-xl border border-gray-100 hover:border-orange-200 hover:bg-orange-50 transition-colors group"
            >
              <span className="text-2xl">{item.emoji}</span>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-gray-900 text-sm group-hover:text-orange-600 transition-colors">
                  {item.title}
                </p>
                <p className="text-xs text-gray-500">{item.desc}</p>
              </div>
              <span className="text-gray-300 group-hover:text-orange-400 transition-colors">→</span>
            </Link>
          ))}
        </div>

        <Link
          href="/player"
          className="block w-full px-6 py-3 bg-gradient-to-r from-orange-500 to-orange-400 text-white font-bold rounded-xl hover:opacity-90 transition-opacity"
        >
          Go to Player Hub
        </Link>
      </div>
    </div>
  );
}
