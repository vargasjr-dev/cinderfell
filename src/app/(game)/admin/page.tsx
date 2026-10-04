import { auth } from "~/lib/auth.server";
import { isAdmin } from "~/lib/admin";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import Link from "next/link";
import ImpersonatePanel from "./ImpersonatePanel";
import { getSubscriptionInfo } from "../../../../lib/subscription";

export default async function AdminPage() {
  const headersList = await headers();
  const session = await auth.api.getSession({ headers: headersList });

  if (!isAdmin(session)) {
    notFound();
  }

  const subInfo = await getSubscriptionInfo(session!.user.id);
  const currentStatus = subInfo?.subscriptionStatus ?? "none";

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">🔧 Admin Panel</h1>
        <p className="text-gray-600 mt-1">
          Playtesting tools for admin users.
        </p>
      </div>

      {/* Matchmaking Lobby */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-xl font-bold text-gray-900 mb-2">
          🎮 Matchmaking Lobby
        </h2>
        <p className="text-gray-600 mb-4">
          Monitor players currently waiting for an opponent.
        </p>
        <Link
          href="/admin/matchmaking"
          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium"
        >
          View Lobby →
        </Link>
      </div>

      {/* Impersonate free / pro */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-xl font-bold text-gray-900 mb-2">🎭 Impersonate Subscription</h2>
        <p className="text-gray-600 mb-4">
          Toggle your own account between Free and Pro for testing. Writes directly
          to the DB — does not touch Stripe.
        </p>
        <ImpersonatePanel currentStatus={currentStatus} />
      </div>

      {/* Stripe Configuration */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-xl font-bold text-gray-900 mb-2">
          💳 Stripe Configuration
        </h2>
        <p className="text-gray-600 mb-4">
          Manage the Cinderling Premium subscription product and verify Stripe
          integration.
        </p>
        <Link
          href="/admin/stripe"
          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium"
        >
          Open Stripe Setup →
        </Link>
      </div>

      {/* Practice Usage */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-xl font-bold text-gray-900 mb-2">📊 Simulation Usage</h2>
        <p className="text-gray-600 mb-4">
          Per-user automated match counts, daily rate-limit status, and average
          simulation time — our proxy for compute cost.
        </p>
        <Link
          href="/admin/usage"
          className="inline-flex items-center px-4 py-2 bg-gray-700 text-white rounded-md hover:bg-gray-800 text-sm font-medium"
        >
          View Usage →
        </Link>
      </div>

      {/* API Keys */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-2">🔑 API Keys</h2>
        <p className="text-gray-600 mb-4">
          Create named bearer tokens for programmatic access — roster updates,
          match uploads, and more. Keys are shown once at creation.
        </p>
        <Link
          href="/admin/api-keys"
          className="inline-flex items-center px-4 py-2 bg-gray-800 text-white rounded-md hover:bg-gray-900 text-sm font-medium"
        >
          Manage API Keys →
        </Link>
      </div>
    </div>
  );
}
