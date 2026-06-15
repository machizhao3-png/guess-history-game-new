import { requireAdminClient } from "@/lib/api/admin";
import {
  apiError,
  apiSuccess,
  readJsonObject,
} from "@/lib/api/errors";
import { requiredString, uuid } from "@/lib/api/validation";
import {
  listQuestions,
  submitMockQuestion,
} from "@/lib/backend/game-service";

export async function GET(request: Request) {
  try {
    const roundId = uuid(
      new URL(request.url).searchParams.get("roundId"),
      "轮次 ID",
    );
    const questions = await listQuestions(requireAdminClient(), roundId);
    return apiSuccess({ questions });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = await readJsonObject(request);
    const player =
      body.player && typeof body.player === "object" && !Array.isArray(body.player)
        ? (body.player as Record<string, unknown>)
        : {};

    const result = await submitMockQuestion(requireAdminClient(), {
      roundId: uuid(body.roundId, "轮次 ID"),
      clientId: uuid(body.clientId, "客户端 ID"),
      clientRequestId: uuid(body.clientRequestId, "请求 ID"),
      nickname: requiredString(player.nickname, "昵称", 16),
      emoji: requiredString(player.emoji, "头像", 16),
      content: requiredString(body.content, "问题", 120),
    });
    return apiSuccess(result, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
