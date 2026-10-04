import { headers } from "next/headers";
import { auth } from "~/lib/auth.server";
import { getCreatePageData } from "./actions";
import PromptBuilder from "./PromptBuilder";
import Link from "next/link";

export default async function CreateCosmeticPage() {
  const headersList = await headers();
  const session = (await auth.api.getSession({ headers: headersList }))!;

  const data = await getCreatePageData();

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <div className="mb-8">
        <Link
          href="/cosmetics"
          className="text-blue-600 hover:text-blue-800 text-sm"
        >
          ← Back to Cosmetics
        </Link>
        <h1 className="text-3xl font-bold text-gray-900 mt-2">
          🎨 AI Cosmetic Builder
        </h1>
        <p className="text-gray-600 mt-1">
          Design custom skins and effects for your cinderlings using AI.
        </p>
      </div>

      <div className="bg-white rounded-2xl shadow-xl p-6">
        <PromptBuilder
          roster={data.roster}
          balance={data.balance}
          subscribed={data.subscribed}
        />
      </div>
    </div>
  );
}
