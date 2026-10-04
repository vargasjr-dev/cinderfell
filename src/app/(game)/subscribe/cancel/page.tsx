import Link from "next/link";

export default function SubscribeCancelPage() {
  return (
    <div className="container mx-auto px-4 py-12 max-w-lg">
      <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
        <div className="text-5xl mb-4">🤔</div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          No worries!
        </h1>
        <p className="text-gray-600 mb-6">
          You can subscribe anytime. All cinderlings, maps, and game modes are
          always free to play.
        </p>

        <div className="space-y-3">
          <Link
            href="/subscribe"
            className="block w-full px-6 py-3 bg-gradient-to-r from-yellow-400 to-orange-500 text-white font-bold rounded-lg hover:from-yellow-500 hover:to-orange-600 transition-all"
          >
            Try Again
          </Link>
          <Link
            href="/player"
            className="block w-full px-6 py-3 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 transition-colors"
          >
            Back to Player Hub
          </Link>
        </div>
      </div>
    </div>
  );
}
