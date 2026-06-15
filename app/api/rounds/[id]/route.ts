import { requireAdminClient } from "@/lib/api/admin";
import { apiError, apiSuccess } from "@/lib/api/errors";
import { uuid } from "@/lib/api/validation";
import { getRound } from "@/lib/backend/game-service";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const data = await getRound(
      requireAdminClient(),
      uuid(id, "轮次 ID"),
    );
    return apiSuccess(data);
  } catch (error) {
    return apiError(error);
  }
}
