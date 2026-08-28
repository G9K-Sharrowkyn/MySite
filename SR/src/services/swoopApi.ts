import type { LeaderboardEntry, TrackId } from '../store/gameStore.ts';

interface LeaderboardResponse {
  leaderboard?: LeaderboardEntry[];
}

interface SubmitRunResponse extends LeaderboardResponse {
  accepted?: boolean;
  rank?: number | null;
}

function readLeaderboard(payload: LeaderboardResponse): LeaderboardEntry[] {
  if (!Array.isArray(payload.leaderboard)) return [];
  return payload.leaderboard.filter((entry) =>
    entry &&
    typeof entry.nickname === 'string' &&
    typeof entry.trackId === 'string' &&
    Number.isFinite(entry.timeMs) &&
    Number.isFinite(entry.collisions),
  );
}

export async function fetchSwoopLeaderboard(trackId: TrackId): Promise<LeaderboardEntry[]> {
  const response = await fetch(`/api/swoop/leaderboard/${trackId}`, {
    credentials: 'same-origin',
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) throw new Error(`Leaderboard request failed (${response.status}).`);
  const payload = await response.json() as LeaderboardResponse;
  return readLeaderboard(payload);
}

export async function submitSwoopRun(entry: LeaderboardEntry): Promise<LeaderboardEntry[]> {
  const response = await fetch('/api/swoop/runs', {
    method: 'POST',
    credentials: 'same-origin',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      trackId: entry.trackId,
      timeMs: entry.timeMs,
      collisions: entry.collisions,
    }),
  });
  if (!response.ok) throw new Error(`Result submission failed (${response.status}).`);
  const payload = await response.json() as SubmitRunResponse;
  return readLeaderboard(payload);
}
