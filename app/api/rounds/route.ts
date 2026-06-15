import { requireAdminClient } from "@/lib/api/admin";
import {
  apiError,
  apiSuccess,
  readJsonObject,
} from "@/lib/api/errors";
import { slug } from "@/lib/api/validation";
import { startMockRound } from "@/lib/backend/game-service";

export async function POST(request: Request) {
  try {
    const body = await readJsonObject(request);
    const round = await startMockRound(
      requireAdminClient(),
      slug(body.slug),
    );
    return apiSuccess({ round }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
