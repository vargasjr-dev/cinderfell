import Link from "next/link";

export default function RulesPage() {
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
        {/* Breadcrumb */}
        <div className="mb-8">
          <Link href="/guide" className="text-blue-600 hover:underline text-sm">
            ← Back to Guide
          </Link>
        </div>

        <h1 className="text-4xl font-bold mb-2 text-gray-900">📖 Game Rules</h1>
        <p className="text-gray-600 mb-10 text-lg">
          Everything you need to know about cinderling matches — from setup to
          victory.
        </p>

        {/* Overview */}
        <Section title="Overview">
          <p>
            Cinderling is a <strong>simultaneous-action tactical RPG</strong>.
            Two players each command a team of cinderlings on an 8×5 grid. Every
            turn, both players issue commands at the same time — no waiting for
            your opponent. Matches last until one of three win conditions is
            met.
          </p>
        </Section>

        {/* Match Setup */}
        <Section title="Match Setup">
          <p>
            Each player brings a <strong>roster of 8 cinderlings</strong> — 4
            start on the field as your <strong>active lineup</strong>, and 4
            sit on the <strong>bench</strong>. When an active cinderling is
            knocked out, a bench replacement automatically enters at that
            cinderling&apos;s spawn point.
          </p>
          <InfoBox>
            <p>
              <strong>Teams start with 20 energy.</strong> Energy is shared
              across the whole team — every command that costs energy draws
              from the same pool.
            </p>
          </InfoBox>
        </Section>

        {/* The Board */}
        <Section title="The Board">
          <p>
            The battlefield is an <strong>8×5 grid</strong> (8 wide, 5 tall)
            with three types of special spaces:
          </p>
          <div className="grid sm:grid-cols-3 gap-4 mt-4">
            <SpaceCard
              emoji="🏁"
              name="Spawn Points"
              desc="4 per team on opposite sides. KO'd bench cinderlings re-enter here."
            />
            <SpaceCard
              emoji="🏴"
              name="Occupation Points"
              desc="3 in the center. Control all 3 to win via Occupation."
            />
            <SpaceCard
              emoji="🌾"
              name="Harvestable Spaces"
              desc="Scattered across the board. Use Harvest to collect energy."
            />
          </div>
        </Section>

        {/* Win Conditions */}
        <Section title="Win Conditions">
          <p className="mb-4">
            A match ends immediately when any one of these is met:
          </p>
          <WinCondition
            emoji="💀"
            name="Elimination"
            color="red"
            desc="Knock out all 8 of your opponent's cinderlings — active and bench. Last team standing wins."
          />
          <WinCondition
            emoji="🏴"
            name="Occupation"
            color="purple"
            desc="Control all 3 Occupation Points simultaneously. A point is controlled when your cinderling stands on it for 2 consecutive ticks unchallenged."
          />
          <WinCondition
            emoji="⚡"
            name="Energy Accumulation"
            color="yellow"
            desc="Reach 120 team energy. You start with 20 — harvest the remaining 100 from the battlefield."
          />
        </Section>

        {/* Commands */}
        <Section title="Commands">
          <p className="mb-4">
            Each cinderling gets <strong>one command per turn</strong>. There are
            three types:
          </p>
          <CommandCard
            name="Move"
            cost="Free"
            desc="Move one space in a cardinal direction (up, down, left, right). No diagonal movement."
          />
          <CommandCard
            name="Attack"
            cost="Varies (1–3 energy)"
            desc="Use one of your cinderling's two attacks on a target position. Each attack has different damage, range, and energy cost."
          />
          <CommandCard
            name="Harvest"
            cost="Free"
            desc="Gather energy from your current space (must be a harvestable space). Adds energy to your team's shared pool."
          />
          <InfoBox>
            <p>
              If your team has <strong>0 energy</strong>, Attack commands are
              unavailable — you can only Move or Harvest.
            </p>
          </InfoBox>
        </Section>

        {/* Attacks */}
        <Section title="Attack Reference">
          <p className="mb-4">
            Every cinderling knows exactly two attacks. Here are all the attack
            types in the game:
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-gray-200">
                  <th className="text-left py-2 pr-4">Attack</th>
                  <th className="text-right py-2 px-3">Base Dmg</th>
                  <th className="text-right py-2 px-3">ATK Scale</th>
                  <th className="text-right py-2 px-3">Cost</th>
                  <th className="text-right py-2 pl-3">Range</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                <AttackRow name="Chip" base={2} scale="×0.2" cost={1} range={2} />
                <AttackRow name="Poke" base={3} scale="×0.3" cost={1} range={1} />
                <AttackRow name="Snipe" base={6} scale="×0.4" cost={2} range={2} />
                <AttackRow name="Strike" base={8} scale="×0.5" cost={2} range={1} />
                <AttackRow name="Lob" base={10} scale="×0.6" cost={3} range={2} />
                <AttackRow name="Slam" base={12} scale="×0.7" cost={3} range={1} />
                <AttackRow name="Nuke" base={15} scale="×1.0" cost={3} range={1} />
              </tbody>
            </table>
          </div>
          <p className="text-sm text-gray-500 mt-3">
            <strong>Damage formula:</strong> Base Damage + (Attacker&apos;s ATK
            stat × ATK Scale). Range 1 = adjacent only. Range 2 = can hit two
            spaces away.
          </p>
        </Section>

        {/* Stats */}
        <Section title="Cinderling Stats">
          <p className="mb-4">Every cinderling has three stats:</p>
          <StatCard
            name="HP (Health)"
            desc="How much damage the cinderling can take before being knocked out. Ranges from 40 to 120."
          />
          <StatCard
            name="ATK (Attack)"
            desc="Scales attack damage. Higher ATK means harder hits. Ranges from 5 to 20."
          />
          <StatCard
            name="SPD (Speed)"
            desc="Determines turn order — faster cinderlings act first. Ranges from 1 to 10."
          />
          <InfoBox>
            <p>
              Stats follow a <strong>budget constraint</strong> — no cinderling
              is best at everything. A tank with massive HP will be slow. A
              speedster that acts first will be fragile. Choose your team
              wisely.
            </p>
          </InfoBox>
        </Section>

        {/* Turn Resolution */}
        <Section title="Turn Resolution">
          <p>Every turn follows the same sequence:</p>
          <ol className="list-decimal list-inside space-y-2 mt-3 text-gray-700">
            <li>
              <strong>Command Phase</strong> (30 seconds) — Both players issue
              commands to each of their active cinderlings simultaneously.
            </li>
            <li>
              <strong>Resolution Phase</strong> — All commands execute in
              Speed order (fastest first). Ties are broken randomly.
            </li>
            <li>
              <strong>Special Powers</strong> — Cinderling abilities trigger at
              their designated moments (start of turn, after commands, on
              damage, etc.).
            </li>
            <li>
              <strong>Cleanup</strong> — Knocked-out cinderlings are removed,
              bench replacements spawn, win conditions are checked.
            </li>
          </ol>
        </Section>

        {/* Special Powers */}
        <Section title="Special Powers">
          <p>
            Every cinderling has a <strong>unique special power</strong> that
            activates automatically during specific moments in the turn.
            Powers can heal, boost stats, drain energy, create terrain effects,
            and more. You won&apos;t see a cinderling&apos;s power listed
            upfront — discovering what each creature does is part of the
            game.
          </p>
          <InfoBox>
            <p>
              <strong>Tip:</strong> Pay attention to what happens during
              matches. If your opponent&apos;s cinderling keeps gaining health
              or dealing extra damage, they have a special power at work.
              Learning the library is how you get better.
            </p>
          </InfoBox>
        </Section>

        {/* CTA */}
        <div className="text-center mt-12 pt-8 border-t border-blue-200">
          <p className="text-gray-500 mb-4">
            Ready to build your first team?
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
              Create Account
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

function InfoBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-blue-50 border-l-4 border-blue-400 p-4 rounded-r-lg mt-4 text-sm text-gray-700">
      {children}
    </div>
  );
}

function SpaceCard({
  emoji,
  name,
  desc,
}: {
  emoji: string;
  name: string;
  desc: string;
}) {
  return (
    <div className="bg-white rounded-lg shadow-sm p-4 text-center">
      <div className="text-2xl mb-1">{emoji}</div>
      <h4 className="font-semibold text-gray-800 text-sm">{name}</h4>
      <p className="text-xs text-gray-500 mt-1">{desc}</p>
    </div>
  );
}

function WinCondition({
  emoji,
  name,
  color,
  desc,
}: {
  emoji: string;
  name: string;
  color: string;
  desc: string;
}) {
  return (
    <div
      className={`flex items-start gap-4 p-4 bg-${color}-50 rounded-lg mb-3`}
    >
      <span className="text-2xl">{emoji}</span>
      <div>
        <h3 className="font-semibold text-gray-800">{name}</h3>
        <p className="text-sm text-gray-600">{desc}</p>
      </div>
    </div>
  );
}

function CommandCard({
  name,
  cost,
  desc,
}: {
  name: string;
  cost: string;
  desc: string;
}) {
  return (
    <div className="bg-white rounded-lg shadow-sm p-4 mb-3">
      <div className="flex items-center justify-between mb-1">
        <h4 className="font-semibold text-gray-800">{name}</h4>
        <span className="text-xs font-mono bg-gray-100 px-2 py-1 rounded text-gray-600">
          {cost}
        </span>
      </div>
      <p className="text-sm text-gray-600">{desc}</p>
    </div>
  );
}

function StatCard({ name, desc }: { name: string; desc: string }) {
  return (
    <div className="bg-white rounded-lg shadow-sm p-4 mb-3">
      <h4 className="font-semibold text-gray-800">{name}</h4>
      <p className="text-sm text-gray-600">{desc}</p>
    </div>
  );
}

function AttackRow({
  name,
  base,
  scale,
  cost,
  range,
}: {
  name: string;
  base: number;
  scale: string;
  cost: number;
  range: number;
}) {
  return (
    <tr>
      <td className="py-2 pr-4 font-medium text-gray-800">{name}</td>
      <td className="py-2 px-3 text-right text-gray-600">{base}</td>
      <td className="py-2 px-3 text-right text-gray-600">{scale}</td>
      <td className="py-2 px-3 text-right text-gray-600">{cost}⚡</td>
      <td className="py-2 pl-3 text-right text-gray-600">{range}</td>
    </tr>
  );
}
