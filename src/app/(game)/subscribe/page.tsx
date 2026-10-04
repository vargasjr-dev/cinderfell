import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "~/lib/auth.server";
import { db } from "../../../../data/db";
import { user } from "../../../../data/schema";
import { eq } from "drizzle-orm";
import SubscribeButton from "./SubscribeButton";

const PERKS = [
  {
    emoji: "🥊",
    title: "Practice Mode",
    desc: "Build your own automated players to practice against",
  },
  {
    emoji: "⚡️",
    title: "Early Access",
    desc: "Day-1 Cinderling unlock each season",
  },
  {
    emoji: "🎨",
    title: "Cosmetic Builder",
    desc: "Design your own skins and effects",
  },
  {
    emoji: "💰",
    title: "Monthly Credits",
    desc: "500 credits/month",
  },
];

export default async function SubscribePage() {
  const headersList = await headers();
  const session = await auth.api.getSession({ headers: headersList });

  if (!session?.user) {
    redirect("/login");
  }

  const [existing] = await db
    .select({ subscriptionStatus: user.subscriptionStatus })
    .from(user)
    .where(eq(user.id, session.user.id))
    .limit(1);

  if (existing?.subscriptionStatus === "active") {
    redirect("/player");
  }

  return (
    <div className="flex items-center justify-center min-h-[calc(100dvh-56px)] px-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-br from-yellow-400 to-orange-500 px-6 pt-6 pb-5 text-center">
          <p className="text-4xl mb-1">⭐</p>
          <h1 className="text-2xl font-black text-white tracking-tight">
            Cinderling Premium
          </h1>
          <p className="text-yellow-100 text-sm mt-0.5">
            Unlock the full experience
          </p>
        </div>

        {/* Perks */}
        <ul className="px-5 pt-4 pb-2 space-y-3">
          {PERKS.map((p) => (
            <li key={p.title} className="flex items-center gap-3">
              <span className="text-green-500 font-black text-base flex-shrink-0">
                ✓
              </span>
              <span className="text-sm text-gray-700">
                <strong className="text-gray-900">{p.title}</strong>
                {" — "}
                {p.desc}
              </span>
            </li>
          ))}
        </ul>

        {/* CTA */}
        <div className="px-5 pb-5 pt-3">
          <SubscribeButton />
        </div>
      </div>
    </div>
  );
}
