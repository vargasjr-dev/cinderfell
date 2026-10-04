import Link from "next/link";

export default function StrategyPage() {
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

      <div className="container mx-auto px-4 py-12 max-w-3xl">
        <div className="mb-8">
          <Link
            href="/guide"
            className="text-blue-600 hover:underline text-sm"
          >
            ← Back to Guide
          </Link>
        </div>

        <h1 className="text-4xl font-bold mb-2 text-gray-900">
          🧠 Strategy Basics
        </h1>
        <p className="text-gray-600 mb-10 text-lg">
          Tips for building teams, choosing win conditions, and outplaying your
          opponent.
        </p>

        {/* The Triangle */}
        <Section title="The Win Condition Triangle">
          <p className="mb-4">
            Every match has three paths to victory. Your team should
            specialize in one while being ready to counter the others.
          </p>
          <div className="grid sm:grid-cols-3 gap-4 mb-4">
            <StrategyCard
              emoji="💀"
              name="Elimination"
              desc="Go aggressive — stack high-ATK cinderlings, push into the enemy side, and knock them out one by one."
              strength="Punishes passive play"
              weakness="Burns energy fast on attacks"
            />
            <StrategyCard
              emoji="🏴"
              name="Occupation"
              desc="Control the three occupation points. Put durable cinderlings on them and hold for 2 uncontested ticks."
                strength="Hard to dislodge once planted"
              weakness="Spread thin across 3 points"
            />
            <StrategyCard
              emoji="⚡"
              name="Accumulation"
              desc="Farm energy — use fast cinderlings to harvest nodes and race to 120 before your opponent reacts."
              strength="Can ignore fights entirely"
              weakness="Fragile to early aggression"
            />
          </div>
          <Tip>
            The best teams can flex between win conditions. If your
            Elimination push stalls, can you pivot to Accumulation with
            leftover harvesters?
          </Tip>
        </Section>

        {/* Team Composition */}
        <Section title="Team Composition">
          <p className="mb-4">
            Your roster has 8 cinderlings — 4 active, 4 on the bench. Here are
            some roles to consider when building your team:
          </p>

          <RoleCard
            name="The Anchor"
            desc="A high-HP cinderling that holds a key position (usually an occupation point). Hard to kill, keeps your board presence stable."
            example="Buldrok (HP 120, SPD 1) — slowest but nearly indestructible."
          />
          <RoleCard
            name="The Striker"
            desc="A high-ATK cinderling that threatens knockouts. Your main source of Elimination pressure."
            example="Blastova (ATK 20, HP 45) — hits like a supernova, but burns bright and dies fast."
          />
          <RoleCard
            name="The Scout"
            desc="A fast cinderling that acts first each turn. Controls tempo: grabs harvest nodes, reaches zones early, picks off weakened targets."
            example="Blinkatt (SPD 10, ATK 11) — phases in, strikes, phases out."
          />
          <RoleCard
            name="The Harvester"
            desc="A cinderling dedicated to energy generation. Usually mid-speed with decent HP to survive while farming."
            example="Cloudpuff (HP 78, SPD 7) — floats around harvesting without a care."
          />
        </Section>

        {/* Energy Management */}
        <Section title="Energy Management">
          <p className="mb-4">
            Energy is the most important resource in the game. Every attack
            costs energy. Running dry means you can only Move and Harvest —
            no fighting back.
          </p>
          <div className="space-y-3">
            <Principle
              title="Don't blow your load early"
              desc="Even with lower costs (1–3⚡), firing attacks every turn still drains your pool. Mix cheap attacks (Poke 1⚡, Chip 1⚡) with heavy ones (Slam 3⚡, Nuke 3⚡)."
            />
            <Principle
              title="Harvest with purpose"
              desc="Spending a turn to Harvest isn't wasted — it's investment. A cinderling harvesting is a cinderling funding 2-4 more attacks for your team."
            />
            <Principle
              title="Track your opponent's energy"
              desc="If they've been attacking non-stop, they're probably running low. Pressure them when they're forced to Harvest."
            />
            <Principle
              title="Accumulation is always a threat"
              desc="Even if you're going for Elimination, your opponent might quietly farm to 120. Keep one eye on their energy total."
            />
          </div>
        </Section>

        {/* Positioning */}
        <Section title="Board Positioning">
          <p className="mb-4">
            The 8×5 grid means positioning matters. A few principles:
          </p>
          <div className="space-y-3">
            <Principle
              title="Control the center"
              desc="Occupation points and harvest nodes cluster in the middle. Center control gives you access to all three win conditions."
            />
            <Principle
              title="Range matters"
              desc="Range 1 attacks (Poke, Strike, Slam, Nuke) only hit adjacent spaces. Range 2 attacks (Snipe, Lob, Chip) can hit from safety. Use ranged attackers to pressure without exposing them."
            />
            <Principle
              title="Don't clump"
              desc="If all your cinderlings are on adjacent spaces, area effects and special powers that target positions become devastating."
            />
            <Principle
              title="Block spawn points"
              desc="When you KO an opponent's cinderling, their replacement enters at a spawn point. If you're standing on it, you control when and how they can re-enter."
            />
          </div>
        </Section>

        {/* Special Powers */}
        <Section title="Learning Special Powers">
          <p className="mb-4">
            Every cinderling has a hidden special power. You won&apos;t know
            what it does until you see it in action. Here&apos;s how to
            approach the unknown:
          </p>
          <div className="space-y-3">
            <Principle
              title="Watch the battle log"
              desc="Special powers trigger effects you can observe — unexpected healing, stat changes, terrain effects, energy shifts. Pay attention to what happens AFTER commands resolve."
            />
            <Principle
              title="Test in admin matches"
              desc="If you have admin access, create test matches to safely discover powers before competitive play."
            />
            <Principle
              title="Build for synergy"
              desc="Once you learn what a cinderling's power does, think about how it combos with others. A healer next to a tank. A speed booster behind a striker. The library rewards experimentation."
            />
          </div>
        </Section>

        {/* CTA */}
        <div className="text-center mt-12 pt-8 border-t border-blue-200">
          <p className="text-gray-500 mb-4">
            Ready to put theory into practice?
          </p>
          <div className="flex gap-4 justify-center flex-wrap">
            <Link
              href="/guide/cinderling"
              className="inline-block bg-white text-blue-600 border-2 border-blue-600 px-6 py-3 rounded-lg font-semibold hover:bg-blue-50 transition"
            >
              Browse Cinderlings →
            </Link>
            <Link
              href="/signup"
              className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition"
            >
              Start Playing
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}

// ─── Components ──────────────────────────────────────────────────────────────

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-10">
      <h2 className="text-2xl font-bold text-gray-900 mb-4">{title}</h2>
      <div className="text-gray-700 leading-relaxed">{children}</div>
    </section>
  );
}

function Tip({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-r-lg mt-4 text-sm text-gray-700">
      <strong>💡 Tip:</strong> {children}
    </div>
  );
}

function StrategyCard({
  emoji,
  name,
  desc,
  strength,
  weakness,
}: {
  emoji: string;
  name: string;
  desc: string;
  strength: string;
  weakness: string;
}) {
  return (
    <div className="bg-white rounded-lg shadow-sm p-4">
      <div className="text-2xl mb-2">{emoji}</div>
      <h3 className="font-bold text-gray-800 mb-1">{name}</h3>
      <p className="text-sm text-gray-600 mb-3">{desc}</p>
      <div className="text-xs space-y-1">
        <p className="text-green-600">✅ {strength}</p>
        <p className="text-red-600">⚠️ {weakness}</p>
      </div>
    </div>
  );
}

function RoleCard({
  name,
  desc,
  example,
}: {
  name: string;
  desc: string;
  example: string;
}) {
  return (
    <div className="bg-white rounded-lg shadow-sm p-4 mb-3">
      <h3 className="font-semibold text-gray-800 mb-1">{name}</h3>
      <p className="text-sm text-gray-600 mb-2">{desc}</p>
      <p className="text-xs text-gray-400 italic">{example}</p>
    </div>
  );
}

function Principle({
  title,
  desc,
}: {
  title: string;
  desc: string;
}) {
  return (
    <div className="bg-white rounded-lg shadow-sm p-4">
      <h4 className="font-semibold text-gray-800 mb-1">{title}</h4>
      <p className="text-sm text-gray-600">{desc}</p>
    </div>
  );
}
