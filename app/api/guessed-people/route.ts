import { requireAdminClient } from "@/lib/api/admin";
import { apiError, apiSuccess } from "@/lib/api/errors";
import { limit } from "@/lib/api/validation";
import { listGuessedPeople } from "@/lib/backend/game-service";

export async function GET(request: Request) {
  try {
    const resultLimit = limit(new URL(request.url).searchParams.get("limit"));
    const people = await listGuessedPeople(
      requireAdminClient(),
      resultLimit,
    );
    return apiSuccess({ people });
  } catch (error) {
    return apiError(error);
  }
}
