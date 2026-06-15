import { requireAdminClient } from "@/lib/api/admin";
import { apiError } from "@/lib/api/errors";
import { startMockRound } from "@/lib/backend/game-service";

// Compatibility endpoint for the current demo. The canonical Phase 2 endpoint
// is POST /api/rounds.
export async function POST() {
  try {
    const round = await startMockRound(requireAdminClient());
    return Response.json({ game: round });
  } catch (error) {
    return apiError(error);
  }
}
