import { auth } from "~/lib/auth.server";
import { isAdmin } from "~/lib/admin";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { db } from "../../../../../data/db";
import { adminApiKey } from "../../../../../data/schema";
import { desc } from "drizzle-orm";
import ApiKeyManager from "./ApiKeyManager";

export default async function ApiKeysPage() {
  const headersList = await headers();
  const session = await auth.api.getSession({ headers: headersList });

  if (!isAdmin(session)) {
    notFound();
  }

  const keys = await db
    .select({
      id: adminApiKey.id,
      name: adminApiKey.name,
      keyPrefix: adminApiKey.keyPrefix,
      createdAt: adminApiKey.createdAt,
      lastUsedAt: adminApiKey.lastUsedAt,
      revokedAt: adminApiKey.revokedAt,
    })
    .from(adminApiKey)
    .orderBy(desc(adminApiKey.createdAt));

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">🔑 API Keys</h1>
        <p className="text-gray-600 mt-1 text-sm">
          Named bearer tokens for programmatic access to the Cinderling API.
          Each key is shown exactly once — store it somewhere safe.
        </p>
        <p className="text-gray-500 mt-2 text-xs font-mono bg-gray-50 border border-gray-200 rounded px-3 py-2">
          Authorization: Bearer vjk_…
        </p>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-base font-semibold text-gray-800 mb-4">Available endpoints</h2>
        <div className="space-y-1 text-xs font-mono text-gray-600">
          <p><span className="text-blue-600 font-semibold">GET</span>    /api/v1/users/:userId/cinderlings</p>
          <p><span className="text-blue-600 font-semibold">GET</span>    /api/v1/users/:userId/teams</p>
          <p><span className="text-green-600 font-semibold">POST</span>   /api/v1/users/:userId/teams</p>
          <p><span className="text-blue-600 font-semibold">GET</span>    /api/v1/users/:userId/teams/:teamUuid</p>
          <p><span className="text-yellow-600 font-semibold">PUT</span>    /api/v1/users/:userId/teams/:teamUuid</p>
          <p><span className="text-red-600 font-semibold">DELETE</span> /api/v1/users/:userId/teams/:teamUuid</p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <ApiKeyManager initialKeys={keys} />
      </div>
    </div>
  );
}
