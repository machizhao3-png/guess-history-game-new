import { requireAdminClient } from "@/lib/api/admin";
import { apiError, apiSuccess } from "@/lib/api/errors";
import { slug } from "@/lib/api/validation";
import { getCurrentGameState } from "@/lib/backend/game-service";

export async function GET(request: Request) {
  try {
    const gameSlug = slug(new URL(request.url).searchParams.get("slug"));
    const data = await getCurrentGameState(requireAdminClient(), gameSlug);
    return apiSuccess(data);
  } catch (error) {
    return apiError(error);
  }
}
