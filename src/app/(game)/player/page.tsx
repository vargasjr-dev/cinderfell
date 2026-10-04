import { auth } from "~/lib/auth.server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getSubscriptionInfo } from "../../../../lib/subscription";

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function PlayerHubPage() {
  const headersList = await headers();
  const session = await auth.api.getSession({ headers: headersList });
  if (!session) redirect("/login");

  const subInfo = await getSubscriptionInfo(session.user.id);
  const isSubscribed = subInfo?.subscriptionStatus === "active";

  return (
    // Full-height canvas. Layout's bg gradient shows through.
    <div className="relative flex items-center justify-center h-[calc(100dvh-56px)] overflow-hidden">
      {/* ── Decorative floating cinderling emojis ──────────────────────────── */}
      <FloatingEmojis />

      {/* ── Centre card ─────────────────────────────────────────────────── */}
      <div className="relative z-10 flex flex-col items-center gap-3 w-full max-w-xs px-4 sm:max-w-sm">
        {/* Wordmark / greeting */}
        <div className="text-center mb-2">
          <p className="text-4xl mb-1">⚡️</p>
          <h1 className="text-2xl font-black text-white drop-shadow-lg tracking-tight">
            Cinderling
          </h1>
          <p className="text-xs text-white/70 font-medium tracking-widest uppercase mt-0.5">
            Trainer Hub
          </p>
        </div>

        {/* Primary actions */}
        <HubButton href="/ranked" emoji="🏆" label="Play" sublabel="Ranked" />
        <HubButton
          href="/roster"
          emoji="🐾"
          label="Roster"
          sublabel="Build your team"
        />
        <HubButton
          href="/market"
          emoji="🛒"
          label="Market"
          sublabel="Collect cinderlings"
        />

        {/* Practice — locked unless subscribed */}
        {isSubscribed ? (
          <HubButton
            href="/practice"
            emoji="🥊"
            label="Practice Mode"
            sublabel="Battle opponent profiles"
          />
        ) : (
          <HubButton
            href="/subscribe"
            emoji="🥊"
            label="Practice Mode"
            sublabel="Subscribe to unlock"
            locked
          />
        )}
      </div>
    </div>
  );
}

// ─── HubButton ────────────────────────────────────────────────────────────────

function HubButton({
  href,
  emoji,
  label,
  sublabel,
  locked = false,
}: {
  href: string;
  emoji: string;
  label: string;
  sublabel: string;
  locked?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`
        group w-full flex items-center gap-4 rounded-2xl px-5 py-3.5 shadow-lg
        border transition-all duration-150
        ${
          locked
            ? "bg-white/10 border-white/10 cursor-pointer opacity-60 hover:opacity-75"
            : "bg-white/90 border-white/30 hover:bg-white hover:scale-[1.02] active:scale-[0.98] hover:shadow-xl"
        }
      `}
    >
      <span className="text-2xl flex-shrink-0">{emoji}</span>
      <div className="flex-1 min-w-0">
        <p
          className={`font-black text-base leading-tight ${locked ? "text-white" : "text-gray-900"}`}
        >
          {label}
          {locked && (
            <span className="ml-2 text-[9px] bg-yellow-400 text-yellow-900 px-1.5 py-0.5 rounded-full font-bold align-middle uppercase tracking-wide">
              PRO
            </span>
          )}
        </p>
        <p
          className={`text-xs mt-0.5 ${locked ? "text-white/60" : "text-gray-500"}`}
        >
          {sublabel}
        </p>
      </div>
      <span
        className={`text-lg flex-shrink-0 transition-transform group-hover:translate-x-0.5 ${locked ? "text-white/40" : "text-gray-400"}`}
      >
        ›
      </span>
    </Link>
  );
}

// ─── FloatingEmojis ──────────────────────────────────────────────────────────
// Pure CSS animation — no JS, no hydration cost.

const FLOATERS = [
  {
    emoji: "🐲",
    cls: "top-[8%]  left-[6%]  text-5xl  animate-float-a opacity-30",
  },
  {
    emoji: "⚡",
    cls: "top-[12%] right-[8%] text-4xl  animate-float-b opacity-25",
  },
  {
    emoji: "🔥",
    cls: "top-[30%] left-[3%]  text-3xl  animate-float-c opacity-20",
  },
  {
    emoji: "💎",
    cls: "top-[22%] right-[5%] text-3xl  animate-float-a opacity-20",
  },
  {
    emoji: "🌊",
    cls: "bottom-[28%] left-[7%]  text-4xl  animate-float-b opacity-25",
  },
  {
    emoji: "🌿",
    cls: "bottom-[18%] right-[6%] text-5xl  animate-float-c opacity-20",
  },
  {
    emoji: "⚔️",
    cls: "bottom-[8%]  left-[12%] text-3xl  animate-float-a opacity-20",
  },
  {
    emoji: "🛡️",
    cls: "bottom-[10%] right-[12%] text-3xl animate-float-b opacity-20",
  },
  {
    emoji: "✨",
    cls: "top-[55%] left-[2%]  text-2xl  animate-float-c opacity-30",
  },
  {
    emoji: "🌟",
    cls: "top-[45%] right-[3%] text-2xl  animate-float-a opacity-25",
  },
];

function FloatingEmojis() {
  return (
    <>
      {FLOATERS.map(({ emoji, cls }, i) => (
        <span
          key={i}
          aria-hidden="true"
          className={`pointer-events-none select-none absolute ${cls}`}
        >
          {emoji}
        </span>
      ))}
    </>
  );
}
