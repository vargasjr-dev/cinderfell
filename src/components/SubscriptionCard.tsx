import Link from "next/link";
import ManageSubscriptionButton from "~/app/(game)/subscribe/manage/ManageSubscriptionButton";

interface SubscriptionCardProps {
  subscriptionStatus: string;
  subscriptionStreakMonths: number;
}

export default function SubscriptionCard({
  subscriptionStatus,
  subscriptionStreakMonths,
}: SubscriptionCardProps) {
  const isActive = subscriptionStatus === "active";
  const isPastDue = subscriptionStatus === "past_due";

  if (isActive) {
    return (
      <div className="bg-gradient-to-br from-yellow-50 to-orange-50 border border-yellow-200 rounded-lg shadow-md p-6">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-2xl">⭐</span>
          <h2 className="text-lg font-semibold text-gray-900">
            Cinderling Premium
          </h2>
        </div>
        <p className="text-sm text-gray-600 mb-1">
          Active
          {subscriptionStreakMonths > 0 && (
            <> — {subscriptionStreakMonths} month streak 🔥</>
          )}
        </p>
        <div className="mt-3">
          <ManageSubscriptionButton />
        </div>
      </div>
    );
  }

  if (isPastDue) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg shadow-md p-6">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-2xl">⚠️</span>
          <h2 className="text-lg font-semibold text-gray-900">
            Payment Issue
          </h2>
        </div>
        <p className="text-sm text-gray-600 mb-3">
          Your last payment failed. Update your payment method to keep Premium.
        </p>
        <ManageSubscriptionButton />
      </div>
    );
  }

  // Not subscribed
  return (
    <Link
      href="/subscribe"
      className="block bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition group"
    >
      <div className="flex items-center gap-3 mb-2">
        <span className="text-2xl">⭐</span>
        <h2 className="text-lg font-semibold text-gray-900 group-hover:text-orange-600 transition">
          Go Premium
        </h2>
      </div>
      <p className="text-sm text-gray-500">
        Unlock AI cosmetics, season pass, and ranked play — $8/mo
      </p>
    </Link>
  );
}
