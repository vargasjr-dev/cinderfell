/**
 * Consistent Cinderling Premium logo lockup.
 * Matches the subscribe page header treatment: yellow-to-orange gradient,
 * star icon, wordmark. Use wherever a premium gate is shown.
 */
export default function CinderlingPremiumLogo() {
  return (
    <div className="inline-flex flex-col items-center gap-1">
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center shadow-lg shadow-orange-200">
        <span className="text-3xl">⭐</span>
      </div>
      <span className="text-xs font-black tracking-widest uppercase bg-gradient-to-r from-yellow-500 to-orange-500 bg-clip-text text-transparent">
        Cinderling Premium
      </span>
    </div>
  );
}
