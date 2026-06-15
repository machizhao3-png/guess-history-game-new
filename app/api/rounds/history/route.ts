import { requireAdminClient } from "@/lib/api/admin";
import { apiError, apiSuccess } from "@/lib/api/errors";
import { limit } from "@/lib/api/validation";
import { listCompletedRounds } from "@/lib/backend/game-service";

export async function GET(request: Request) {
  try {
    const resultLimit = limit(new URL(request.url).searchParams.get("limit"));
    const rounds = await listCompletedRounds(
      requireAdminClient(),
      resultLimit,
    );
    return apiSuccess({ rounds });
  } catch (error) {
    return apiError(error);
  }
}
