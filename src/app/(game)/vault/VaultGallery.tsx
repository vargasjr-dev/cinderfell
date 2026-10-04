"use client";

import { useState } from "react";
import { purchaseVaultItemAction, type VaultItem } from "./actions";
import CinderfellPremiumLogo from "~/components/CinderfellPremiumLogo";

interface VaultGalleryProps {
  items: VaultItem[];
  balance: number;
  subscribed: boolean;
}

export default function VaultGallery({
  items,
  balance,
  subscribed,
}: VaultGalleryProps) {
  const [currentBalance, setCurrentBalance] = useState(balance);
  const [purchased, setPurchased] = useState<Set<string>>(new Set());
  const [buying, setBuying] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // Group items by season
  const grouped = items.reduce<Record<string, VaultItem[]>>((acc, item) => {
    if (!acc[item.seasonName]) acc[item.seasonName] = [];
    acc[item.seasonName].push(item);
    return acc;
  }, {});

  async function handlePurchase(item: VaultItem) {
    const key = `${item.seasonId}-${item.tier}`;
    setBuying(key);
    setMessage(null);

    const result = await purchaseVaultItemAction(item.seasonId, item.tier);

    if (result.success) {
      setPurchased((prev) => new Set([...prev, key]));
      setCurrentBalance((prev) => prev - item.creditCost);
      setMessage(result.message);
    } else {
      setMessage(result.error);
    }

    setBuying(null);
  }

  if (!subscribed) {
    return (
      <div className="text-center py-12">
        <div className="flex justify-center mb-5">
          <CinderfellPremiumLogo />
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">
          Subscribers Only
        </h2>
        <p className="text-gray-600 mb-4">
          The Vault is exclusive to Premium subscribers. Access past season
          rewards with your credits.
        </p>
        <a
          href="/subscribe"
          className="inline-block px-6 py-3 bg-gradient-to-r from-yellow-400 to-orange-500 text-white font-bold rounded-lg"
        >
          Subscribe — $8/month
        </a>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-5xl mb-4">🏛️</div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">
          Vault is Empty
        </h2>
        <p className="text-gray-600">
          No archived seasons yet. Complete a season to see past rewards here.
        </p>
      </div>
    );
  }

  const rewardIcon = (type: string) => {
    if (type === "cosmetic") return "🎨";
    if (type === "title") return "🏷️";
    if (type === "vellymon") return "🐉";
    return "🎁";
  };

  return (
    <div className="space-y-8">
      {message && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
          {message}
        </div>
      )}

      <p className="text-sm text-gray-500">
        Balance: {currentBalance.toLocaleString()} 💰
      </p>

      {Object.entries(grouped).map(([seasonName, seasonItems]) => (
        <div key={seasonName}>
          <h2 className="text-lg font-bold text-gray-900 mb-3">
            🏛️ {seasonName}
            <span className="ml-2 text-xs font-normal text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
              Past Season
            </span>
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {seasonItems.map((item) => {
              const key = `${item.seasonId}-${item.tier}`;
              const isPurchased = purchased.has(key);
              const canAfford = currentBalance >= item.creditCost;

              return (
                <div
                  key={key}
                  className={`p-4 border rounded-xl transition ${
                    isPurchased
                      ? "border-green-300 bg-green-50"
                      : "border-gray-200 bg-white hover:shadow-md"
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <span className="text-2xl">
                      {rewardIcon(item.reward.type)}
                    </span>
                    <span className="text-xs text-gray-400 font-medium">
                      Tier {item.tier}
                    </span>
                  </div>
                  <p className="font-medium text-gray-900 text-sm mb-1">
                    {item.reward.description}
                  </p>
                  <p className="text-xs text-yellow-600 mb-3">
                    ⭐ Premium Track
                  </p>

                  {isPurchased ? (
                    <span className="text-xs text-green-600 font-medium">
                      ✅ Purchased
                    </span>
                  ) : (
                    <button
                      onClick={() => handlePurchase(item)}
                      disabled={buying === key || !canAfford}
                      className="w-full px-3 py-1.5 text-xs font-bold bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                    >
                      {buying === key
                        ? "Purchasing…"
                        : `Buy for ${item.creditCost} 💰`}
                    </button>
                  )}
                  {!isPurchased && !canAfford && (
                    <p className="text-[10px] text-red-400 mt-1">
                      Need {item.creditCost - currentBalance} more 💰
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
