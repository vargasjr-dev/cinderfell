import { auth } from "~/lib/auth.server";
import { isAdmin } from "~/lib/admin";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import Link from "next/link";
import StripeConfigPanel from "./StripeConfigPanel";

export default async function AdminStripePage() {
  const headersList = await headers();
  const session = await auth.api.getSession({ headers: headersList });

  if (!isAdmin(session)) {
    notFound();
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <div className="mb-8">
        <Link
          href="/admin"
          className="text-blue-600 hover:text-blue-800 text-sm"
        >
          ← Back to Admin
        </Link>
        <h1 className="text-3xl font-bold text-gray-900 mt-2">
          💳 Stripe Setup
        </h1>
        <p className="text-gray-600 mt-1">
          Manage the Cinderling Premium subscription product and price.
        </p>
      </div>

      <StripeConfigPanel />
    </div>
  );
}
