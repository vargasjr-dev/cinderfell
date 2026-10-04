"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const navLinks = [
  { href: "/player", label: "🏠 Hub" },
  { href: "/ranked", label: "🏆 Ranked" },
  { href: "/roster", label: "🐾 Roster" },
  { href: "/market", label: "🛒 Market" },
  { href: "/quests", label: "📋 Quests" },
  { href: "/practice", label: "🥊 Practice", premium: true },
];

interface GameNavProps {
  user: { name: string; email: string } | null;
  creditBalance?: number;
  isSubscriber?: boolean;
  /** Count of today's quests still incomplete — drives quest notification badge */
  activeQuestCount?: number;
  /** Current login streak — shows 🔥N badge on account button when streak > 1 */
  currentStreak?: number;
  /** Show admin-only nav link */
  isAdmin?: boolean;
}

export default function GameNav({
  user,
  creditBalance,
  isSubscriber,
  activeQuestCount,
  currentStreak,
  isAdmin,
}: GameNavProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === "/player") {
      return pathname === "/player" || pathname.startsWith("/player/");
    }
    return pathname.startsWith(href);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Close dropdown on route change
  useEffect(() => {
    setDropdownOpen(false);
    setMenuOpen(false);
  }, [pathname]);

  const initials = user?.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "?";

  const handleSignOut = async () => {
    setSigningOut(true);
    setSignOutError(false);
    try {
      const res = await fetch("/api/auth/sign-out", { method: "POST" });
      if (!res.ok) throw new Error("Sign-out failed");
      // Hard navigation clears all Next.js client cache — no stale session data
      window.location.href = "/";
    } catch {
      setSigningOut(false);
      setSignOutError(true);
    }
  };

  return (
    <nav className="bg-gray-900 shadow-lg">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-14">
          {/* Brand */}
          <Link
            href="/player"
            className="text-lg font-bold tracking-wide text-white"
          >
            ⚡ Cinderling
          </Link>

          {/* Desktop Links */}
          <div className="hidden md:flex items-center space-x-1">
            {navLinks.map((link) => {
              const isPremiumLocked =
                "premium" in link && link.premium && !isSubscriber;
              const questCount =
                link.href === "/quests" ? (activeQuestCount ?? 0) : 0;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`relative px-3 py-2 rounded-lg text-sm font-medium transition ${
                    isActive(link.href)
                      ? "bg-blue-600 text-white"
                      : isPremiumLocked
                        ? "text-gray-500 hover:bg-gray-800 hover:text-gray-400"
                        : "text-gray-300 hover:bg-gray-800 hover:text-white"
                  }`}
                >
                  {link.label}
                  {"premium" in link && link.premium && (
                    <span className="ml-1 text-[10px] bg-yellow-500/30 text-yellow-300 px-1.5 py-0.5 rounded-full">
                      {isSubscriber ? "⭐" : "PRO"}
                    </span>
                  )}
                  {questCount > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-orange-500 text-[9px] font-bold text-white">
                      {questCount}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>

          {/* Credit Balance (Desktop) */}
          {isSubscriber && creditBalance !== undefined && (
            <Link
              href="/credits"
              className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-yellow-500/20 text-yellow-300 hover:bg-yellow-500/30 transition"
            >
              <span>💰</span>
              <span>{creditBalance.toLocaleString()}</span>
            </Link>
          )}

          {/* Account Dropdown (Desktop) */}
          <div className="hidden md:block relative" ref={dropdownRef}>
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition ${
                isActive("/user") || dropdownOpen
                  ? "bg-blue-600 text-white"
                  : "text-gray-300 hover:bg-gray-800 hover:text-white"
              }`}
            >
              <span className="relative flex items-center justify-center w-7 h-7 rounded-full bg-blue-500 text-white text-xs font-bold">
                {initials}
                {(currentStreak ?? 0) > 1 && (
                  <span className="absolute -top-1.5 -right-2 flex items-center gap-0.5 bg-orange-500 text-white text-[9px] font-black px-1 py-0.5 rounded-full leading-none shadow-sm">
                    🔥{currentStreak}
                  </span>
                )}
              </span>
              <span className="max-w-[120px] truncate">
                {user?.name || "Account"}
              </span>
              <svg
                className={`w-4 h-4 transition-transform ${dropdownOpen ? "rotate-180" : ""}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>

            {/* Dropdown Panel */}
            {dropdownOpen && (
              <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-xl border border-gray-200 py-2 z-50">
                {/* User Info */}
                <div className="px-4 py-3 border-b border-gray-100">
                  <p className="text-sm font-semibold text-gray-900 truncate">
                    {user?.name || "Player"}
                  </p>
                  <p className="text-xs text-gray-500 truncate">
                    {user?.email}
                  </p>
                  {(currentStreak ?? 0) > 0 && (
                    <p className="text-xs text-orange-500 font-semibold mt-1">
                      🔥 {currentStreak}-day streak
                    </p>
                  )}
                </div>

                {/* Profile Link */}
                <Link
                  href="/user"
                  className="flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition"
                >
                  <svg
                    className="w-4 h-4 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                    />
                  </svg>
                  👤 Profile
                </Link>

                {/* Admin Link (admins only) */}
                {isAdmin && (
                  <Link
                    href="/admin"
                    className="flex items-center gap-3 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                    </svg>
                    🛠️ Admin
                  </Link>
                )}

                {/* Sign Out */}
                <button
                  onClick={handleSignOut}
                  disabled={signingOut}
                  className="flex items-center gap-3 w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition disabled:opacity-50"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                    />
                  </svg>
                  {signingOut ? "Signing out…" : "🚪 Sign Out"}
                </button>
                {signOutError && (
                  <p className="px-4 py-1 text-xs text-red-500">
                    Sign out failed — try again
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Mobile Hamburger */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="md:hidden p-2 rounded-lg text-gray-300 hover:bg-gray-800 hover:text-white transition"
            aria-label="Toggle navigation"
          >
            {menuOpen ? (
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            ) : (
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
            )}
          </button>
        </div>

        {/* Mobile Menu */}
        {menuOpen && (
          <div className="md:hidden pb-4 space-y-1 border-t border-gray-800 pt-2">
            {navLinks.map((link) => {
              const isPremiumLocked =
                "premium" in link && link.premium && !isSubscriber;
              const questCount =
                link.href === "/quests" ? (activeQuestCount ?? 0) : 0;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`relative flex items-center justify-between px-4 py-2 rounded-lg text-sm font-medium transition ${
                    isActive(link.href)
                      ? "bg-blue-600 text-white"
                      : isPremiumLocked
                        ? "text-gray-500 hover:bg-gray-800 hover:text-gray-400"
                        : "text-gray-300 hover:bg-gray-800 hover:text-white"
                  }`}
                >
                  <span>{link.label}</span>
                  <span className="flex items-center gap-2">
                    {"premium" in link && link.premium && (
                      <span className="text-[10px] bg-yellow-500/30 text-yellow-300 px-1.5 py-0.5 rounded-full">
                        {isSubscriber ? "⭐" : "PRO"}
                      </span>
                    )}
                    {questCount > 0 && (
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-orange-500 text-[10px] font-bold text-white">
                        {questCount}
                      </span>
                    )}
                  </span>
                </Link>
              );
            })}

            {/* Mobile Credit Balance */}
            {isSubscriber && creditBalance !== undefined && (
              <Link
                href="/credits"
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-yellow-500/20 text-yellow-300"
              >
                <span>💰</span>
                <span>{creditBalance.toLocaleString()} credits</span>
              </Link>
            )}

            {/* Mobile Account Section */}
            <div className="border-t border-gray-800 mt-2 pt-2">
              {user && (
                <div className="px-4 py-2">
                  <p className="text-sm font-semibold text-white truncate">
                    {user.name}
                  </p>
                  <p className="text-xs text-gray-400 truncate">{user.email}</p>
                </div>
              )}
              <Link
                href="/user"
                className={`block px-4 py-2 rounded-lg text-sm font-medium transition ${
                  isActive("/user")
                    ? "bg-blue-600 text-white"
                    : "text-gray-300 hover:bg-gray-800 hover:text-white"
                }`}
              >
                👤 Profile
              </Link>
              {isAdmin && (
                <Link
                  href="/admin"
                  className={`block px-4 py-2 rounded-lg text-sm font-medium transition ${
                    isActive("/admin")
                      ? "bg-red-600 text-white"
                      : "text-red-400 hover:bg-gray-800 hover:text-red-300"
                  }`}
                >
                  🛠️ Admin
                </Link>
              )}
              <button
                onClick={handleSignOut}
                disabled={signingOut}
                className="block w-full text-left px-4 py-2 rounded-lg text-sm font-medium text-red-400 hover:bg-gray-800 transition disabled:opacity-50"
              >
                {signingOut ? "Signing out…" : "🚪 Sign Out"}
              </button>
              {signOutError && (
                <p className="px-4 py-1 text-xs text-red-400">
                  Sign out failed — try again
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
