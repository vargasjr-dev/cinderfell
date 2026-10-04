/**
 * Spectator page — watch a match live without being a player.
 *
 * No authentication required. Polls /api/spectate/[id] every 2s.
 * Works for:
 *  - Local CLI matches (reads .cinderling/[id].json from filesystem)
 *  - Web matches (TODO: add DB fallback in route.ts)
 */

import SpectateClient from "./SpectateClient";

export default async function SpectatePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ turn?: string }>;
}) {
  const { id } = await params;
  const { turn } = await searchParams;
  const initialTurn = turn !== undefined ? Math.max(0, parseInt(turn, 10) || 0) : 0;

  return <SpectateClient matchId={id} initialTurn={initialTurn} />;
}
